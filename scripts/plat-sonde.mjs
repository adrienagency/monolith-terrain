// PLAT — la sonde : que porte le TERRARIUM, tuile par tuile, et que devient-il
// après fusion ? On refait le damier à la main pour voir les DEUX champs.
//   node scripts/plat-sonde.mjs --port 8231 --lieu 43.45,4.60 --zoom 17
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8231'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const ZOOM = Number(opt('--zoom', '17'))
const NOM = opt('--nom', 'camargue')
const ICI = path.join(RACINE, '.banc', 'PLAT', 'sonde')
fs.mkdirSync(ICI, { recursive: true })
// Page NUE, sur l'origine du serveur : on importe les modules de `src/` sans
// charger l'application. Semee ici pour qu'aucun banc ne depende d'un fichier
// de travail reste au depot.
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const R = await page.evaluate(async (lat, lon, zoom) => {
  const { overzoomTile } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const n = 2 ** zoom
  const latRad = lat * Math.PI / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  const src = DEM_SOURCES.mapterhorn
  const maxZoom = await resolveRegionMaxZoom(src, zoom, cx, cy)
  const index = await indexBathy()
  const out = { zoom, cx, cy, maxZoom, tuiles: [] }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = cx + dx, ty = cy + dy
    const t = overzoomTile(zoom, tx, ty, maxZoom ?? src.maxZoom)
    const url = src.url(t.z, t.x, t.y)
    const r = await fetch(url)
    const rec = { tx, ty, url, statut: r.status, octets: 0 }
    if (r.ok) {
      const b = await r.blob(); rec.octets = b.size
      const img = await createImageBitmap(b)
      const c = document.createElement('canvas'); c.width = c.height = 512
      const g = c.getContext('2d', { willReadFrequently: true })
      const s = 512 / t.scale
      g.drawImage(img, t.ox * 512, t.oy * 512, s, s, 0, 0, 512, 512)
      const p = g.getImageData(0, 0, 512, 512).data
      // valeurs EXACTES et leur poids : un remplissage est UNE constante
      const compte = new Map()
      let mn = Infinity, mx = -Infinity
      for (let i = 0; i < 512 * 512; i++) {
        const m = p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
        if (m < mn) mn = m; if (m > mx) mx = m
        compte.set(m, (compte.get(m) ?? 0) + 1)
      }
      const top = [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([v, c2]) => ({ m: v, pct: +(100 * c2 / (512 * 512)).toFixed(1) }))
      rec.min = mn; rec.max = mx; rec.valeursDistinctes = compte.size; rec.top = top
    }
    // la bathy fine y répond-elle ?
    const patch = new Float32Array(64 * 64).fill(NaN)
    const zb = await peindreBathyTuile({ zoom, tx, ty, index, dst: patch, dstStride: 64, dx: 0, dy: 0, dw: 64, dh: 64 })
    let bmn = Infinity, bmx = -Infinity, nb = 0
    for (const v of patch) if (Number.isFinite(v)) { nb++; if (v < bmn) bmn = v; if (v > bmx) bmx = v }
    rec.bathyZ = zb; rec.bathyN = nb; rec.bathyMin = nb ? bmn : null; rec.bathyMax = nb ? bmx : null
    out.tuiles.push(rec)
  }
  return out
}, LAT, LON, ZOOM)
fs.writeFileSync(path.join(ICI, `${NOM}-z${ZOOM}.json`), JSON.stringify(R, null, 2))
console.log(JSON.stringify(R, null, 1))
await nav.close()
