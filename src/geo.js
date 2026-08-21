// Shared geographic conversions: lat/lon ↔ Web-Mercator tiles ↔ terrain world
// XZ ↔ globe sphere positions. Single source of truth for georeferencing —
// used by the DEM terrain, the orbital globe, go-to travel and GPX tracks.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { demTilePx } from './dem-source.js'

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
  const n = 2 ** dem.zoom
  // shortest tile-x delta so patches touching the antimeridian stay local
  // (dem.js wraps tile x when fetching, this must mirror it)
  let dtx = t.x - dem.originTileX
  dtx -= Math.round(dtx / n) * n
  // ⚠️ pixels de TUILE, pas 256 en dur : Mapterhorn sert du 512, AWS du 256
  const tpx = demTilePx(dem)
  const px = dtx * tpx
  const py = (t.y - dem.originTileY) * tpx
  const span = demSpan(dem)
  return {
    x: (px / dem.size - 0.5) * span,
    z: (py / dem.size - 0.5) * span,
  }
}

// ══════════ L'EMPRISE DU BLOC, SANS AVOIR À LE CHARGER — Tâche 6 quinquies ══
//
// ⚠️ **`empriseSocle` (seuil-socle.js) N'EST PAS L'EMPREINTE DU BLOC, ET L'ÉCART
// EST MESURÉ.** Elle centre l'emprise EXACTEMENT sur le lieu ; `loadDem`, lui,
// CALE son bloc sur la grille de tuiles entières (`cx = Math.floor(tuileX)`,
// `dem.js:242`). Les deux ont la même LARGEUR — trois tuiles — mais pas la même
// position : décalage mesuré le 2026-08-21 sur trois lieux, **−0,389 / +0,376 /
// −0,183 tuile**, soit jusqu'à **un sixième de socle** en longitude comme en
// latitude. Remplir la nappe sur l'une pendant que le masque de mer, le trait de
// côte, les étiquettes et le drapage GPX sont cuits sur l'autre déplacerait la
// carte sous ses propres repères — un défaut MUET, pas une erreur.
//
// Cette fonction rend l'emprise que `loadDem` chargerait, **sans rien charger**.
// ⚠️ **UNE SEULE LOI :** quand le MNT est là, on lui demande son empreinte
// (`patchLatLonBBox`, coast-mask.js) ; celle-ci n'existe que pour l'instant où il
// n'est PAS là, et `test/fenetre-branchee.test.js` verrouille leur accord.
//
// @param {{lat:number, lon:number, zoom:number, tuiles?:number}} arg
// @returns {{ouest:number, sud:number, est:number, nord:number}} en degrés
export function empriseBlocMNT({ lat, lon, zoom, tuiles = 3 }) {
  const n = 2 ** zoom
  const demi = Math.floor(tuiles / 2)
  const t = latLonToTile(lat, lon, zoom)
  const cx = Math.floor(t.x)
  const cy = Math.floor(t.y)
  const ox = cx - demi
  const oy = cy - demi
  const nw = tileToLatLon(ox, oy, zoom)
  const se = tileToLatLon(ox + tuiles, oy + tuiles, zoom)
  return { ouest: nw.lon, sud: se.lat, est: se.lon, nord: nw.lat }
}

// LA LARGEUR MONDE DU CHAMP — et pourquoi ce n'est plus toujours 56.
//
// ⚠️ UNE EMPRISE 3×3 FAIT 168 UNITÉS, PAS 56. `TERRAIN_SIZE` écrit en dur dans
// les deux conversions ci-dessus écrasait tout un 3×3 dans la largeur d'un seul
// bloc : chaque lieu, chaque lac, chaque tracé se retrouvait à un TIERS de sa
// distance au centre. Ce défaut ne se lit pas comme un décalage, il se lit comme
// une carte dont toutes les villes ont glissé vers le milieu — c'est-à-dire
// comme des données fausses.
//
// C'est exactement `terrain._span()`, et c'est la même règle : la GÉOMÉTRIE fait
// toujours 56 unités, mais le CHAMP qu'elle lit fait `56 × empriseCote`. Le
// nombre d'unités par mètre, lui, ne change pas : un champ trois fois plus large
// couvre trois fois plus de sol.
//
// Hors mode continu `empriseCote` est absent et la valeur redevient 56 au bit
// près — tous les appelants d'aujourd'hui sont donc rigoureusement inchangés.
export function demSpan(dem) {
  return TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1)
}

export function worldToLatLon(dem, x, z) {
  const span = demSpan(dem)
  const px = (x / span + 0.5) * dem.size
  const py = (z / span + 0.5) * dem.size
  const n = 2 ** dem.zoom
  // originTileX can sit outside [0, n) for patches straddling ±180° — wrap
  const tpx = demTilePx(dem)
  const tx = ((((dem.originTileX + px / tpx) % n) + n) % n)
  return tileToLatLon(tx, dem.originTileY + py / tpx, dem.zoom)
}

// true (unexaggerated) meters per scene unit for the loaded DEM patch
// ⚠️ `demSpan`, pas `TERRAIN_SIZE` : sur une emprise 3×3, `extentMeters` est déjà
// triplé. Divisé par 56, il rendrait trois fois trop de mètres par unité — donc
// des distances, des échelles de carte et des largeurs de rivière toutes fausses
// d'un facteur 3, sans que rien ne paraisse cassé.
export function surfaceMetersPerUnit(dem) {
  return dem.extentMeters / demSpan(dem)
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

// Parse "45.8326, 6.8652", "45.8326 6.8652", "45.83°N 6.86°E", DMS pastes
// like 45°49'57"N 6°51'52"E (Wikipedia/GPS), Google-Maps pastes etc.
// Returns {lat, lon} or null — never throws.
export function parseLatLon(text) {
  if (!text) return null
  const s = String(text).trim()

  const dms = s.match(
    /^\s*(\d{1,2})\s*°\s*(\d{1,2})\s*['′’]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*["″”]\s*)?([NSns])\s*[,;]?\s*(\d{1,3})\s*°\s*(\d{1,2})\s*['′’]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*["″”]\s*)?([EWOewo])\s*$/
  )
  if (dms) {
    const toDec = (d, mn, sec) =>
      parseInt(d, 10) + parseInt(mn, 10) / 60 + (sec ? parseFloat(sec.replace(',', '.')) : 0) / 3600
    let lat = toDec(dms[1], dms[2], dms[3])
    let lon = toDec(dms[5], dms[6], dms[7])
    if (/s/i.test(dms[4])) lat = -lat
    if (/[wo]/i.test(dms[8])) lon = -lon
    if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null
    return { lat, lon }
  }

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
