// Shared geographic conversions: lat/lon ↔ Web-Mercator tiles ↔ terrain world
// XZ ↔ globe sphere positions. Single source of truth for georeferencing —
// used by the DEM terrain, the orbital globe, go-to travel and GPX tracks.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

export const EARTH_RADIUS_M = 6371000
export const MERCATOR_MAX_LAT = 85.05112878 // Web-Mercator tile coverage limit
export const R_GLOBE = 100 // globe radius in scene units

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// meters of camera altitude represented by one scene unit in orbital mode
export const ORBITAL_M_PER_UNIT = EARTH_RADIUS_M / R_GLOBE

// ---------------------------------------------------------------- mercator

// lat/lon → global fractional tile coords at `zoom` (x right, y down, 0..2^z)
export function latLonToTile(lat, lon, zoom) {
  const n = 2 ** zoom
  const latRad = lat * D2R
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  }
}

export function tileToLatLon(tx, ty, zoom) {
  const n = 2 ** zoom
  const lon = (tx / n) * 360 - 180
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * R2D
  return { lat, lon }
}

// ground resolution (m/px) of a mercator tile row at `lat`
export function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos(lat * D2R)) / 2 ** zoom
}

// ---------------------------------------------------------------- terrain patch

// lat/lon → terrain world XZ for the currently loaded DEM (needs dem.originTile).
// World axes: +x east, +z south (canvas row order), y up.
export function latLonToWorld(dem, lat, lon) {
  const t = latLonToTile(lat, lon, dem.zoom)
  const px = (t.x - dem.originTileX) * 256
  const py = (t.y - dem.originTileY) * 256
  return {
    x: (px / dem.size - 0.5) * TERRAIN_SIZE,
    z: (py / dem.size - 0.5) * TERRAIN_SIZE,
  }
}

export function worldToLatLon(dem, x, z) {
  const px = (x / TERRAIN_SIZE + 0.5) * dem.size
  const py = (z / TERRAIN_SIZE + 0.5) * dem.size
  return tileToLatLon(dem.originTileX + px / 256, dem.originTileY + py / 256, dem.zoom)
}

// true (unexaggerated) meters per scene unit for the loaded DEM patch
export function surfaceMetersPerUnit(dem) {
  return dem.extentMeters / TERRAIN_SIZE
}

// ---------------------------------------------------------------- globe sphere

// lat/lon → position on the globe sphere. North pole +Y; lon 0 faces +Z,
// lon 90°E faces +X — a right-handed, east-positive layout.
export function latLonToSphere(lat, lon, radius = R_GLOBE, out = new THREE.Vector3()) {
  const la = lat * D2R
  const lo = lon * D2R
  return out.set(radius * Math.cos(la) * Math.sin(lo), radius * Math.sin(la), radius * Math.cos(la) * Math.cos(lo))
}

export function sphereToLatLon(v) {
  const r = v.length()
  return {
    lat: Math.asin(THREE.MathUtils.clamp(v.y / r, -1, 1)) * R2D,
    lon: Math.atan2(v.x, v.z) * R2D,
  }
}

// ---------------------------------------------------------------- parsing

// Parse "45.8326, 6.8652", "45.8326 6.8652", "45.83°N 6.86°E", Google-Maps
// pastes etc. Returns {lat, lon} or null — never throws.
export function parseLatLon(text) {
  if (!text) return null
  const s = String(text).trim()
  const m = s.match(
    /^\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([EWOew])?\s*$/
  )
  if (!m) return null
  let lat = parseFloat(m[1].replace(',', '.'))
  let lon = parseFloat(m[3].replace(',', '.'))
  if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat)
  if (m[4] && /[wo]/i.test(m[4])) lon = -Math.abs(lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null
  return { lat, lon }
}
