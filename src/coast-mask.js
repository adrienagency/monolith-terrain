// COASTLINE MASK — the real land/sea boundary at coarse zoom (z4–z8).
//
// At coarse zoom the DEM's 0 m isoline is a poor proxy for the true coast
// (flat coastal plains shift it kilometres; bilinear smoothing erodes shape).
// So we stop deriving land/sea from elevation and rasterize a REAL vector
// coastline instead: Natural Earth 1:10m "land" polygons (public domain),
// filtered to the patch bbox and drawn white-on-black over the exact DEM
// footprint — the same georeferencing region-mask.js uses. The terrain shader
// samples this as uCoastMask and decides land/sea from it (see terrain.js).
//
// Self-contained rasterizer (small, deliberate ~25-line overlap with
// region-mask.js) so the working "isolate the zone" path is left untouched.

import * as THREE from 'three'

export const COAST_ZOOM_MIN = 4
export const COAST_ZOOM_MAX = 12
// z4–z8 use the bundled Natural Earth 10m land (Phase 1). z9–z12 switch to the
// finer OSM-derived land grid (Phase 2) — real shoreline for bays/estuaries.
export const COAST_NE_MAX = 8
export const GRID_ZOOM = 6 // the OSM land grid is cut into slippy z6 tiles
export const MASK_SIZE = 2048

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// ---- pure geometry (unit tested) ----

export function bboxIntersects(a, b) {
  return a.west <= b.east && b.west <= a.east && a.south <= b.north && b.south <= a.north
}

export function ringBBox(ring) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return { west, south, east, north }
}

// GeoJSON features → flat list of polygon ring-groups whose outer ring meets bbox
export function landPolygonsInBBox(features, bbox) {
  const kept = []
  for (const f of features) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const rings of polys) {
      if (!rings.length || !rings[0].length) continue
      if (bboxIntersects(ringBBox(rings[0]), bbox)) kept.push(rings)
    }
  }
  return kept
}

// lon/lat → slippy tile (x,y) at gridZoom, clamped in range (pure, tested)
export function lonLatToGridTile(lon, lat, gridZoom) {
  const n = 2 ** gridZoom
  const la = clampLat(lat) * (Math.PI / 180)
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  const clamp = (v) => Math.max(0, Math.min(n - 1, v))
  return [clamp(x), clamp(y)]
}

// the grid tiles covering a lon/lat bbox (north = smaller tileY) — pure, tested
export function gridTileRange(bbox, gridZoom) {
  const [xW, yN] = lonLatToGridTile(bbox.west, bbox.north, gridZoom)
  const [xE, yS] = lonLatToGridTile(bbox.east, bbox.south, gridZoom)
  return { x0: Math.min(xW, xE), x1: Math.max(xW, xE), y0: Math.min(yN, yS), y1: Math.max(yN, yS) }
}

// lon/lat bbox of the DEM patch footprint, from its four corners
export function patchLatLonBBox(dem) {
  // sample the patch edges in world space isn't needed — the DEM already knows
  // its geographic span via its tile georef; derive corners from tile math.
  const n = 2 ** dem.zoom
  const tileToLon = (tx) => (tx / n) * 360 - 180
  const tileToLat = (ty) => {
    const m = Math.PI * (1 - 2 * (ty / n))
    return (180 / Math.PI) * Math.atan(Math.sinh(m))
  }
  const tilesAcross = dem.size / 256
  const west = tileToLon(dem.originTileX)
  const east = tileToLon(dem.originTileX + tilesAcross)
  const north = tileToLat(dem.originTileY) // north edge = smaller ty
  const south = tileToLat(dem.originTileY + tilesAcross)
  return { west, south, east, north }
}

// ---- projection (pure, unit tested) ----

// lon/lat → mask-canvas pixel over the DEM patch footprint, WITHOUT the
// antimeridian shortest-delta wrap that geo.latLonToWorld applies. That wrap
// tears any polygon spanning >180° of longitude — Afro-Eurasia spans ~198° — so
// at coarse zoom (small tile count) its far-east vertices fold to the opposite
// canvas edge, and the evenodd fill parity flips in latitude bands (the
// "Denmark / North Sea inverted" coarse-zoom bug). A land polygon must be drawn
// as ONE continuous shape, so longitude is projected continuously here; parts
// beyond the patch simply fall off-canvas and are clipped. Same footprint
// mapping as the shader (uSlabHalf*2 = TERRAIN_SIZE) — only the wrap is dropped.
// (Patches straddling ±180° remain a known Phase-1 limitation, as before.)
export function projectPatchPx(dem, lon, lat, size) {
  const n = 2 ** dem.zoom
  const la = clampLat(lat) * (Math.PI / 180)
  const tx = ((lon + 180) / 360) * n
  const ty = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n
  return [
    (((tx - dem.originTileX) * 256) / dem.size) * size,
    (((ty - dem.originTileY) * 256) / dem.size) * size,
  ]
}

function rasterize(ringGroups, dem, size) {
  const sharp = document.createElement('canvas')
  sharp.width = sharp.height = size
  const ctx = sharp.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  for (const rings of ringGroups) {
    ctx.beginPath()
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [px, py] = projectPatchPx(dem, ring[i][0], ring[i][1], size)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
    ctx.fill('evenodd') // outer ring + holes
  }
  // soft coast: blur so the shader's 0.5 iso-line is smooth, not stair-stepped
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const bctx = canvas.getContext('2d')
  bctx.filter = 'blur(1.5px)'
  bctx.drawImage(sharp, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

// ---- data (lazy, memoised) ----
// public/ is served at the site root by Vite, so public/data/* is fetched
// relative to the site root — the exact pattern cities.js uses.

// z4–z8: the bundled Natural Earth 10m land (one file, whole world)
let landPromise = null
function loadLand() {
  landPromise ??= fetch('data/land-10m.json').then((r) => {
    if (!r.ok) throw new Error(`land-10m.json → HTTP ${r.status}`)
    return r.json()
  })
  return landPromise
}

// z9–z12: the finer OSM-derived land grid, cut into slippy z6 tiles at
// data/coast-z6/{x}/{y}.json. Ocean tiles are omitted (404 = no land), and
// each fetched tile's features are memoised (adjacent patches reuse them).
const gridCache = new Map() // "x/y" → Promise<Feature[]>
function fetchGridTile(x, y) {
  const key = `${x}/${y}`
  let p = gridCache.get(key)
  if (!p) {
    p = fetch(`data/coast-z6/${x}/${y}.json`)
      .then((r) => (r.ok ? r.json().then((fc) => fc.features || []) : [])) // 404 → ocean
      .catch(() => [])
    gridCache.set(key, p)
  }
  return p
}
async function loadGridFeatures(bbox) {
  const { x0, x1, y0, y1 } = gridTileRange(bbox, GRID_ZOOM)
  const jobs = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(fetchGridTile(x, y))
  const tiles = await Promise.all(jobs)
  return tiles.flat()
}

// ---- public API ----
// Build the land/sea mask for the current patch, or null when out of the
// coast band (z4–z12) or on any failure — the caller then keeps the current
// elevation-based rendering (repli). z4–z8 use Natural Earth 10m; z9–z12 use
// the finer OSM z6 land grid.
export async function fetchCoastMask({ lat, lon, zoom, dem }) {
  if (!dem || zoom < COAST_ZOOM_MIN || zoom > COAST_ZOOM_MAX) return null
  try {
    const bbox = patchLatLonBBox(dem)
    const features = zoom <= COAST_NE_MAX ? (await loadLand()).features : await loadGridFeatures(bbox)
    const rings = landPolygonsInBBox(features, bbox)
    // no land in view (open ocean) is legitimate — still return a mask so the
    // shader paints all-sea rather than falling back to the noisy 0-isoline
    const tex = rasterize(rings, dem, MASK_SIZE)
    return { maskTexture: tex, source: zoom <= COAST_NE_MAX ? 'ne' : 'osm' }
  } catch (err) {
    console.warn('coast mask failed:', err)
    return null
  }
}
