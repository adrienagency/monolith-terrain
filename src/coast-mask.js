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
import { latLonToWorld } from './geo.js'
import { TERRAIN_SIZE } from './terrain.js'

export const COAST_ZOOM_MIN = 4
export const COAST_ZOOM_MAX = 8
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

// ---- browser rasterizer (self-contained) ----

function project(dem, lon, lat, size) {
  const w = latLonToWorld(dem, clampLat(lat), lon)
  return [(w.x / TERRAIN_SIZE + 0.5) * size, (w.z / TERRAIN_SIZE + 0.5) * size]
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
        const [px, py] = project(dem, ring[i][0], ring[i][1], size)
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
// public/ is served at the site root by Vite, so public/data/land-10m.json is
// fetched as 'data/land-10m.json' — the exact pattern cities.js uses.
let landPromise = null
function loadLand() {
  landPromise ??= fetch('data/land-10m.json').then((r) => {
    if (!r.ok) throw new Error(`land-10m.json → HTTP ${r.status}`)
    return r.json()
  })
  return landPromise
}

// ---- public API ----
// Build the land/sea mask for the current patch, or null when out of the
// coarse band (z4–z8) or on any failure — the caller then keeps the current
// elevation-based rendering (repli).
export async function fetchCoastMask({ lat, lon, zoom, dem }) {
  if (!dem || zoom < COAST_ZOOM_MIN || zoom > COAST_ZOOM_MAX) return null
  try {
    const fc = await loadLand()
    const bbox = patchLatLonBBox(dem)
    const rings = landPolygonsInBBox(fc.features, bbox)
    // no land in view (open ocean) is legitimate — still return a mask so the
    // shader paints all-sea rather than falling back to the noisy 0-isoline
    const tex = rasterize(rings, dem, MASK_SIZE)
    return { maskTexture: tex }
  } catch (err) {
    console.warn('coast mask failed:', err)
    return null
  }
}
