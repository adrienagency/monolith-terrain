// MESURE DU DÉCALAGE DE LA COUCHE « LUMIÈRES NOCTURNES », bout en bout.
//
// On rejoue en nombres exactement ce que fait l'application :
//   dem → demBounds → aerialZoomFor → tilesForBBox → tileGridMerc
//       → aerialUvTransform → (uvSolDrape du shader) → texel échantillonné
// puis on retraduit le texel en lon/lat, et on le compare au lon/lat du point
// de sol qu'on regardait. L'écart EST le décalage visible à l'écran.
//
// Usage : node docs/nuit-recalage/mesure-chaine.mjs

import { demBounds, aerialZoomFor, aerialUvTransform, tileGridMerc, lonLatToMerc } from '../../src/map/aerial-layer.js'
import { tilesForBBox } from '../../src/map/tile-index.js'
import { zoomNuitBorne, NUIT_ZOOM_MAX } from '../../src/nuit.js'
import { latLonToWorld, demSpan } from '../../src/geo.js'

// Le même dem fictif que test/aerial-layer.test.js : trois tuiles de côté,
// origine sur la tuile qui contient le point demandé.
function demFictif(lat, lon, zoom, cote = 1, tilePx = 512) {
  const n = 2 ** zoom
  const r = (lat * Math.PI) / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  const debord = cote > 1 ? 3 : 0
  return {
    size: 3 * tilePx * cote, tilePx, zoom,
    originTileX: cx - 1 - debord, originTileY: cy - 1 - debord,
    ...(cote > 1 ? { empriseCote: cote } : {}),
  }
}

const mercVersLonLat = (x, y) => ({
  lon: x * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
})

// Ce que le shader fait, en JS : uvSolDrape puis l'affine de la couche.
// uBlockOffset = (0,0), uFenetre = (0,0), uMaskSpan = demSpan(dem).
function texelEchantillonne(dem, uv, grid, lat, lon) {
  const span = demSpan(dem)
  const w = latLonToWorld(dem, lat, lon)
  const uvx = w.x / span + 0.5
  const uvy = w.z / span + 0.5 // 0 au NORD (le +Z du monde va vers le sud)
  const s = 1 - uvy // uvSolDrape : `uv.y = 1.0 - uv.y`
  const nu = uv.offset[0] + uvx * uv.scale[0]
  const nv = uv.offset[1] + s * uv.scale[1]
  // flipY vaut TRUE sur la CanvasTexture (aucun `tex.flipY = false` dans
  // aerial-layer.js ni nuit-layer.js, contrairement à tous les autres masques
  // du projet) : v = 1 est donc la PREMIÈRE ligne du canevas, celle du nord.
  const colFrac = nu
  const rowFrac = 1 - nv
  const gw = grid.maxX - grid.minX, gh = grid.maxY - grid.minY
  return mercVersLonLat(grid.minX + colFrac * gw, grid.minY + rowFrac * gh)
}

function mesure(nom, lat, lon, zoom, cote = 1, { budgetPx = 1024, maxZoom = NUIT_ZOOM_MAX, borne = true } = {}) {
  const dem = demFictif(lat, lon, zoom, cote)
  const bbox = demBounds(dem)
  const brut = aerialZoomFor(bbox, { budgetPx, maxZoom })
  const z = borne ? zoomNuitBorne(brut) : brut
  const tuiles = tilesForBBox(bbox, z)
  const xs = tuiles.map((t) => t.x), ys = tuiles.map((t) => t.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const cols = Math.max(...xs) - x0 + 1, rows = Math.max(...ys) - y0 + 1
  const grid = tileGridMerc(x0, y0, cols, rows, z)
  const uv = aerialUvTransform(bbox, grid)

  const vu = texelEchantillonne(dem, uv, grid, lat, lon)
  const dlon = vu.lon - lon, dlat = vu.lat - lat
  const kx = dlon * 111.32 * Math.cos((lat * Math.PI) / 180)
  const ky = dlat * 110.57
  // …et en UNITÉS MONDE, la langue de la scène. Le passage se fait en
  // mercator : en degrés de latitude il serait faux dès qu'on s'éloigne de
  // l'équateur, puisque le bloc est carré en mercator, pas en degrés.
  const wSpan = demSpan(dem)
  const hMerc = lonLatToMerc(0, bbox.minLat).y - lonLatToMerc(0, bbox.maxLat).y
  const dMerc = lonLatToMerc(0, vu.lat).y - lonLatToMerc(0, lat).y
  const uMonde = (dMerc / hMerc) * wSpan
  console.log(
    `${nom.padEnd(16)} z${String(zoom).padStart(2)}${cote > 1 ? '×3' : '  '} → tuiles z${z} ${cols}×${rows}` +
    `  | Δlon ${dlon.toFixed(4).padStart(8)}° Δlat ${dlat.toFixed(4).padStart(8)}°` +
    `  | ${kx.toFixed(2).padStart(8)} km E, ${ky.toFixed(2).padStart(8)} km N` +
    `  | ${Math.hypot(kx, ky).toFixed(2).padStart(7)} km, ${uMonde.toFixed(2).padStart(7)} u`
  )
  return { nom, dlon, dlat, kx, ky, uMonde }
}

const CAS = [
  ['Reykjavik', 64.1466, -21.9426],
  ['Anchorage', 61.2181, -149.9003],
  ['Paris', 48.8566, 2.3522],
  ['Las Vegas', 36.1699, -115.1398],
  ['Honolulu', 21.3069, -157.8583],
  ['Dakar', 14.7167, -17.4677],
  ['Noumea', -22.2758, 166.458],
  ['Perth', -31.9523, 115.8613],
]

for (const zoom of [10, 11, 12, 13]) {
  console.log(`\n── zoom DEM ${zoom} ─────────────────────────────────────────`)
  for (const [nom, lat, lon] of CAS) mesure(nom, lat, lon, zoom)
}
console.log(`\n── mode continu 3×3, zoom DEM 11 ────────────────────────`)
for (const [nom, lat, lon] of CAS) mesure(nom, lat, lon, 11, 3)

// ═══════════════════════════════════════════════════════════════════════════
// LE TÉMOIN — la PHOTO AÉRIENNE, par le MÊME chemin de code
// ═══════════════════════════════════════════════════════════════════════════
//
// Elle est réputée bien calée. Si le défaut vient du chemin partagé, il faut
// que le témoin l'explique, sinon le diagnostic ne tient pas. Deux cas :
//   · un fournisseur NATIONAL (IGN, maxZoom 19) : le zoom d'imagerie retenu est
//     ≥ au zoom du DEM, donc la grille de tuiles COÏNCIDE avec l'emprise du
//     bloc (les bords d'une tuile z13 sont aussi des bords de tuile z15). Il
//     n'y a pas de débord, donc pas d'asymétrie, donc pas de décalage ;
//   · le PLANCHER MONDIAL NASA (maxZoom 8) : même plafond que les lumières
//     nocturnes, donc le même débord, donc le MÊME décalage.
console.log(`\n── témoin : PHOTO AÉRIENNE, fournisseur national (maxZoom 19, budget 4096) ──`)
for (const [nom, lat, lon] of CAS) mesure(nom, lat, lon, 12, 1, { budgetPx: 4096, maxZoom: 19, borne: false })
console.log(`\n── témoin : PHOTO AÉRIENNE, plancher mondial NASA (maxZoom 8, budget 4096) ──`)
for (const [nom, lat, lon] of CAS) mesure(nom, lat, lon, 12, 1, { budgetPx: 4096, maxZoom: 8, borne: false })
