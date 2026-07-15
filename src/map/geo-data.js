import { worldToLatLon } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'

const HALF = TERRAIN_SIZE / 2
const _cache = new Map()

// fetch + cache a trimmed layer file (never throws — empty collection on failure)
export function loadLayer(name) {
  if (!_cache.has(name)) {
    _cache.set(name, fetch(`data/map/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return _cache.get(name)
}

// lat/lon bbox of the loaded DEM patch, sampled at the 4 corners + edge mids
// (mercator lat is nonlinear, so include edge midpoints), padded a touch.
export function patchBounds(dem) {
  const pts = []
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) pts.push(worldToLatLon(dem, fx * HALF, fz * HALF))
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const p of pts) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon) }
  const padLat = (maxLat - minLat) * 0.05 + 0.01
  const padLon = (maxLon - minLon) * 0.05 + 0.01
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLon: minLon - padLon, maxLon: maxLon + padLon }
}

export function featureBBox(f) {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') { minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]); minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]) }
    else c.forEach(walk)
  }
  walk(f.geometry.coordinates)
  return [minLon, minLat, maxLon, maxLat]
}

export function bboxOverlap([aMinLon, aMinLat, aMaxLon, aMaxLat], b) {
  return aMinLon <= b.maxLon && aMaxLon >= b.minLon && aMinLat <= b.maxLat && aMaxLat >= b.minLat
}

export function clipToPatch(features, bounds) {
  return features.filter((f) => bboxOverlap(featureBBox(f), bounds))
}

export function filterByZoom(features, zoom) {
  return features.filter((f) => (f.properties?.min_zoom ?? 0) <= zoom)
}
