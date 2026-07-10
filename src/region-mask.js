// Region mask — "individualiser la zone": clip the terrain slab to the
// administrative boundary containing the current view center, like the classic
// shaded-relief country cutouts (Italy / Madagascar / Ireland posters).
//
//  · admin polygons come from Nominatim reverse geocoding (polygon_geojson=1);
//    the request `zoom` selects the granularity: 3 country, 5 state/region,
//    8 county/departement (verified live — see LEVEL_TABLE below)
//  · continents are NOT polygons in OSM — those come from a bundled simplified
//    Natural Earth dataset (src/data/continents.json, public domain)
//  · the polygon is rasterized into an offscreen canvas that covers EXACTLY the
//    DEM patch footprint (same mercator georeferencing as the terrain, via
//    geo.js latLonToWorld) so the shader samples it with world XZ:
//    uv = worldPos.xz / TERRAIN_SIZE + 0.5  — see terrain.js uRegionMask
//  · far-flung parts of the same entity (DOM-TOM, Hawaii…) are dropped: any
//    disjoint polygon part whose centroid lies further than ~1.5× the patch
//    radius from the patch center is excluded (islands near the zone stay)
//
// Nominatim usage policy: one request per view change, responses cached
// in-module by level + rounded lat/lon, absolute max 1 req/s enforced.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld } from './geo.js'

// ---------------------------------------------------------------- zoom → level
// Admin granularity follows the DEM zoom staircase. nominatimZoom is the value
// sent to the reverse geocoder (its own scale, NOT a tile zoom): 3 = country,
// 5 = state/region (admin_level 4 in FR), 8 = county/departement (admin_level 6).
// polygonThreshold is Nominatim's simplification tolerance in degrees — keeps
// country responses ~75 KB instead of multi-MB. Tune freely.
export const LEVEL_TABLE = [
  { minDemZoom: 10, level: 'departement', nominatimZoom: 8, polygonThreshold: 0.002 },
  { minDemZoom: 8, level: 'region', nominatimZoom: 5, polygonThreshold: 0.005 },
  { minDemZoom: 6, level: 'country', nominatimZoom: 3, polygonThreshold: 0.01 },
  { minDemZoom: 5, level: 'continent', nominatimZoom: null, polygonThreshold: null },
]

// dem zoom → LEVEL_TABLE entry, or null below z5 (whole-earth view: no clip)
export function levelForDemZoom(zoom) {
  for (const row of LEVEL_TABLE) if (zoom >= row.minDemZoom) return row
  return null
}

// ---------------------------------------------------------------- far parts
// Distance beyond which a disjoint polygon part is considered "another zone"
// (French Guiana on a metropolitan France view…), in world units from the
// patch center. Patch radius = TERRAIN_SIZE / 2.
export const FAR_PART_MAX_DIST = 1.5 * (TERRAIN_SIZE / 2)

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// vertex-average centroid of a ring — plenty for a keep/drop distance test
function ringCentroid(ring) {
  let sx = 0
  let sy = 0
  for (const [lon, lat] of ring) {
    sx += lon
    sy += lat
  }
  return [sx / ring.length, sy / ring.length]
}

// Filter MultiPolygon coordinates (GeoJSON [[[[lon,lat],…]…]…]) down to the
// parts whose outer-ring centroid lies within maxDist world units of the DEM
// patch center. Pure — unit tested. Never returns empty: if every part is far
// (degenerate geocode), the nearest one is kept so the terrain never vanishes.
export function filterFarParts(coordinates, dem, maxDist = FAR_PART_MAX_DIST) {
  const center = latLonToWorld(dem, dem.lat, dem.lon)
  let best = null
  let bestD = Infinity
  const kept = []
  for (const rings of coordinates) {
    if (!rings.length || !rings[0].length) continue
    const [cLon, cLat] = ringCentroid(rings[0])
    const w = latLonToWorld(dem, clampLat(cLat), cLon)
    const d = Math.hypot(w.x - center.x, w.z - center.z)
    if (d <= maxDist) kept.push(rings)
    if (d < bestD) {
      bestD = d
      best = rings
    }
  }
  return kept.length ? kept : best ? [best] : []
}

// ---------------------------------------------------------------- geometry utils

// normalize a GeoJSON geometry to MultiPolygon coordinates, or null
function toMultiPolygon(geojson) {
  if (!geojson) return null
  if (geojson.type === 'Polygon') return [geojson.coordinates]
  if (geojson.type === 'MultiPolygon') return geojson.coordinates
  return null // Point / LineString → no usable boundary
}

// ray-cast point-in-ring ([lon, lat] space)
function pointInRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointInMultiPolygon(pt, coordinates) {
  for (const rings of coordinates) {
    if (pointInRing(pt, rings[0])) {
      let inHole = false
      for (let h = 1; h < rings.length; h++) if (pointInRing(pt, rings[h])) inHole = true
      if (!inHole) return true
    }
  }
  return false
}

// ---------------------------------------------------------------- continents
// Bundled simplified continent outlines (Natural Earth 1:110m, public domain —
// see the note inside the json). Loaded lazily as a Vite asset so this module
// stays importable under plain node (unit tests) with no JSON-import syntax.
let continentsPromise = null
function loadContinents() {
  continentsPromise ??= fetch(new URL('./data/continents.json', import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`continents.json → HTTP ${r.status}`)
    return r.json()
  })
  return continentsPromise
}

async function continentBoundary(lat, lon) {
  const fc = await loadContinents()
  const pt = [lon, lat]
  // exact containment first…
  for (const f of fc.features) {
    if (pointInMultiPolygon(pt, f.geometry.coordinates)) {
      return { name: f.properties.name, coordinates: f.geometry.coordinates }
    }
  }
  // …else (view centered on open sea) the continent with the nearest part
  let best = null
  let bestD = Infinity
  for (const f of fc.features) {
    for (const rings of f.geometry.coordinates) {
      const [cx, cy] = ringCentroid(rings[0])
      const d = Math.hypot(cx - lon, cy - lat)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
  }
  return best ? { name: best.properties.name, coordinates: best.geometry.coordinates } : null
}

// ---------------------------------------------------------------- nominatim
// Reverse geocode with polygon. Cached by level + rounded coords, in-flight
// requests deduped, and a minimum 1s gap between hits (usage policy).
const nominatimCache = new Map()
let lastNominatimAt = 0

async function nominatimBoundary(lat, lon, levelRow) {
  const key = `${levelRow.nominatimZoom}:${lat.toFixed(2)},${lon.toFixed(2)}`
  if (!nominatimCache.has(key)) {
    const url =
      'https://nominatim.openstreetmap.org/reverse' +
      `?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}` +
      `&zoom=${levelRow.nominatimZoom}&polygon_geojson=1&polygon_threshold=${levelRow.polygonThreshold}`
    const wait = Math.max(0, lastNominatimAt + 1100 - Date.now())
    const job = (async () => {
      if (wait > 0) await new Promise((res) => setTimeout(res, wait))
      lastNominatimAt = Date.now()
      // browsers silently drop User-Agent when forbidden; Referer is automatic
      const r = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!r.ok) throw new Error(`nominatim → HTTP ${r.status}`)
      const j = await r.json()
      if (j.error) throw new Error(`nominatim: ${j.error}`)
      return j
    })()
    // cache the promise; evict on failure so a retry is possible
    nominatimCache.set(key, job)
    job.catch(() => nominatimCache.delete(key))
  }
  const j = await nominatimCache.get(key)
  const coordinates = toMultiPolygon(j.geojson)
  if (!coordinates) return null
  const name = j.name || (j.display_name ? j.display_name.split(',')[0] : 'zone')
  return { name, coordinates }
}

// ---------------------------------------------------------------- rasterizer
export const MASK_SIZE = 2048

// lon/lat → mask pixel, through the exact DEM georeferencing (geo.js) so the
// mask lands precisely on the terrain: world x∈[-T/2,T/2] → px∈[0,size]
function project(dem, lon, lat, size) {
  const w = latLonToWorld(dem, clampLat(lat), lon)
  return [(w.x / TERRAIN_SIZE + 0.5) * size, (w.z / TERRAIN_SIZE + 0.5) * size]
}

// Elevation (meters) at or below which a masked pixel counts as SEA and is
// removed from the region: OSM admin polygons extend into territorial waters,
// but the requested boundary is the LAND outline (islands included — they sit
// above sea level so they survive automatically). Slightly above 0 so noisy
// coastal samples do not leave salt-and-pepper fringes.
export const LAND_MIN_ELEV_M = 0.3

// Draw the MultiPolygon white-on-black over the DEM footprint. Each polygon is
// its own evenodd path (outer ring + holes) — adjacent undissolved polygons
// (continents.json) union cleanly. The admin fill is then clipped to LAND by
// zeroing every white pixel whose DEM elevation sits at/below LAND_MIN_ELEV_M
// (drops the maritime part of the polygons, keeps islands). The 1.5px blur
// pass runs LAST so boundary and coastline both come out soft, seam-free.
// Returns { texture, canvas } — the canvas backs the texture (do not mutate).
export function rasterizeMask(coordinates, dem, size = MASK_SIZE) {
  const sharp = document.createElement('canvas')
  sharp.width = sharp.height = size
  const ctx = sharp.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  for (const rings of coordinates) {
    ctx.beginPath()
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [px, py] = project(dem, ring[i][0], ring[i][1], size)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
    ctx.fill('evenodd')
  }

  // land clip: mask and DEM cover the same footprint, so mask pixel → DEM
  // sample is a plain scale (nearest neighbour — the blur below softens it).
  // Caveat: inland land BELOW sea level (Netherlands polders, Death Valley)
  // gets clipped too — acceptable v1, the DEM cannot tell it from sea.
  if (dem.data) {
    const id = ctx.getImageData(0, 0, size, size)
    const px = id.data
    const demSize = dem.size
    const k = demSize / size
    for (let y = 0; y < size; y++) {
      const row = Math.min(demSize - 1, (y * k) | 0) * demSize
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        if (px[i] > 0 && dem.data[row + Math.min(demSize - 1, (x * k) | 0)] <= LAND_MIN_ELEV_M) {
          px[i] = px[i + 1] = px[i + 2] = 0
        }
      }
    }
    ctx.putImageData(id, 0, 0)
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const bctx = canvas.getContext('2d')
  bctx.filter = 'blur(1.5px)'
  bctx.drawImage(sharp, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  // no flip: canvas row 0 (north) must stay at v=0 because the shader builds
  // v from world +z (south) growing downward, same convention as the DEM
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return { texture: tex, canvas }
}

// ---------------------------------------------------------------- public API

// Resolve + rasterize the admin boundary for the current view.
//   { lat, lon, zoom, dem } → { maskTexture, maskCanvas, name, level } | null
// zoom is the app's demZoom (LEVEL_TABLE above); dem is the loaded DEM patch
// (dem.js) whose georeferencing positions the mask AND whose heightfield clips
// it to land. maskCanvas is the 2048² canvas backing maskTexture — hand it to
// region-plate.js buildRegionPlate to fit the plate. Returns null when the
// view is whole-earth (z<5), when no polygon exists, or on any network
// failure — the caller keeps the square slab in that case.
export async function fetchRegionMask({ lat, lon, zoom, dem }) {
  const levelRow = levelForDemZoom(zoom)
  if (!levelRow || !dem) return null
  try {
    const boundary =
      levelRow.level === 'continent'
        ? await continentBoundary(lat, lon)
        : await nominatimBoundary(lat, lon, levelRow)
    if (!boundary || !boundary.coordinates.length) return null
    const near = filterFarParts(boundary.coordinates, dem)
    if (!near.length) return null
    const raster = rasterizeMask(near, dem)
    return {
      maskTexture: raster.texture,
      maskCanvas: raster.canvas,
      name: boundary.name,
      level: levelRow.level,
    }
  } catch (err) {
    console.warn('region mask failed:', err)
    return null
  }
}
