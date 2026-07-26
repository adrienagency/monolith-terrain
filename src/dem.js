// Real-world elevation via AWS Terrain Tiles (Mapzen/Tilezen "terrarium" PNGs).
// Public S3 bucket, no API key. meters = (R*256 + G + B/256) - 32768
// Attribution: Terrain Tiles / Mapzen / Tilezen — AWS Open Data.

import { fuseBathymetry, decodeTerrarium, overzoomTile } from './bathy.js'

const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
const TILE_PX = 256

// BATHYMÉTRIE FINE — nos propres tuiles, au MÊME encodage terrarium, servies
// depuis le site. Le jeu s'arrête à BATHY_ZMAX : au-delà, on relit l'ancêtre
// (voir overzoomTile). Absent ⇒ tout continue exactement comme avant, ce qui
// permet de déployer le code avant les données.
const BATHY_URL = (z, x, y) => `data/bathy/${z}/${x}/${y}.png`
const BATHY_ZMAX = 8
// une tuile manquante est le cas NORMAL (on n'écrit pas les tuiles sans mer) :
// on mémorise les absences pour ne pas les redemander à chaque déplacement
const bathyMisses = new Set()

// `originTile` (optionnel) : origine-tuile EXPLICITE {x, y} du coin haut-gauche
// — le damier (block-grid.js) charge les blocs voisins alignés sur la grille de
// tuiles du bloc central (originTileX ± tilesAcross) : zéro couture entre blocs.
export async function loadDem({ lat, lon, zoom, tilesAcross = 3, originTile = null, bathy = true }) {
  const n = 2 ** zoom
  const half = Math.floor(tilesAcross / 2)
  let cx, cy
  if (originTile) {
    cx = originTile.x + half
    cy = originTile.y + half
    // lat/lon deviennent le CENTRE réel de cette grille de tuiles (métadonnée
    // + metersPerPixel cohérents avec le géoréférencement)
    const cxF = cx + 0.5, cyF = cy + 0.5
    lon = (cxF / n) * 360 - 180
    lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cyF) / n))) * 180) / Math.PI
  } else {
    const latRad0 = (lat * Math.PI) / 180
    cx = Math.floor(((lon + 180) / 360) * n)
    cy = Math.floor(((1 - Math.log(Math.tan(latRad0) + 1 / Math.cos(latRad0)) / Math.PI) / 2) * n)
  }
  const latRad = (lat * Math.PI) / 180
  const sizePx = tilesAcross * TILE_PX
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = sizePx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  const jobs = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      jobs.push(
        fetch(TILE_URL(zoom, tx, ty))
          .then((r) => {
            if (!r.ok) throw new Error(`elevation tile ${zoom}/${tx}/${ty} → HTTP ${r.status}`)
            return r.blob()
          })
          .then(createImageBitmap)
          .then((img) => ctx.drawImage(img, (dx + half) * TILE_PX, (dy + half) * TILE_PX))
      )
    }
  }
  await Promise.all(jobs)

  const rgba = ctx.getImageData(0, 0, sizePx, sizePx).data
  // BATHYMÉTRIE : on peint le même damier dans un second canevas, puis on
  // fusionne. Tout échec est silencieux et sans conséquence — la carte reste
  // celle d'avant.
  const seaData = bathy === false ? null : await loadBathyPatch({ zoom, cx, cy, half, n, sizePx })
  const data = new Float32Array(sizePx * sizePx)
  let minM = Infinity
  let maxM = -Infinity
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const m = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
    data[i] = m
    if (m < minM) minM = m
    if (m > maxM) maxM = m
    sum += m
  }

  // La fusion ne peut que CREUSER la mer : la terre et le trait de côte
  // restent ceux du terrarium (voir src/bathy.js, et la session polders).
  const fused = seaData ? fuseBathymetry(data, seaData) : data
  if (fused !== data) {
    minM = Infinity; maxM = -Infinity; sum = 0
    for (let i = 0; i < fused.length; i++) {
      const m = fused[i]
      if (m < minM) minM = m
      if (m > maxM) maxM = m
      sum += m
    }
  }

  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / 2 ** zoom
  return {
    data: fused,
    size: sizePx,
    metersPerPixel,
    extentMeters: metersPerPixel * sizePx,
    minM,
    maxM,
    meanM: sum / data.length,
    lat,
    lon,
    zoom,
    // exact georeference: fractional tile coords of the canvas top-left corner,
    // so lat/lon ↔ world XZ conversions are pixel-accurate (see geo.js)
    originTileX: cx - half,
    originTileY: cy - half,
  }
}

// bilinear sample of the height grid at fractional pixel coords
export function sampleDem(dem, px, py) {
  const { data, size } = dem
  const x = Math.min(Math.max(px, 0), size - 1.001)
  const y = Math.min(Math.max(py, 0), size - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * size + x0
  const a = data[i]
  const b = data[i + 1]
  const c = data[i + size]
  const d = data[i + size + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// Peint le damier de tuiles BATHYMÉTRIQUES dans un canevas et le décode.
// Rend `null` dès que rien d'utile n'a été trouvé — l'appelant continue alors
// avec le seul terrarium, sans le savoir.
async function loadBathyPatch({ zoom, cx, cy, half, n, sizePx }) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = sizePx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let painted = 0
  const jobs = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      const t = overzoomTile(zoom, tx, ty, BATHY_ZMAX)
      const url = BATHY_URL(t.z, t.x, t.y)
      if (bathyMisses.has(url)) continue
      const ox = (dx + half) * TILE_PX
      const oy = (dy + half) * TILE_PX
      jobs.push(
        fetch(url)
          .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('miss'))))
          .then(createImageBitmap)
          .then((img) => {
            // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre
            const s = TILE_PX / t.scale
            ctx.drawImage(img, t.ox * TILE_PX, t.oy * TILE_PX, s, s, ox, oy, TILE_PX, TILE_PX)
            painted++
          })
          .catch(() => {
            // absence = cas normal (tuile sans mer, ou jeu pas encore cuit)
            bathyMisses.add(url)
          })
      )
    }
  }
  await Promise.all(jobs)
  if (!painted) return null
  return decodeTerrarium(ctx.getImageData(0, 0, sizePx, sizePx).data)
}
