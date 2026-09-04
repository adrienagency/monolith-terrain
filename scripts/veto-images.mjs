// VETO — LES CAPTURES POUR ADRIEN. Le champ fusionné rendu en fausses couleurs
// (terre verte / mer bleue), AVANT et APRÈS le veto, plus le masque du trait de
// côte lui-même — pour qu'on VOIE d'où vient chaque décision.
//   node scripts/veto-images.mjs --port 8531 --lieu 43.45,4.60 --nom camargue
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8531'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const NOM = opt('--nom', 'camargue')
const ZOOMS = opt('--zooms', '11,12,13,15,17').split(',').map(Number)
const ICI = path.join(RACINE, '.banc', 'VETO')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zooms) => {
  const { fuseBathymetry, bandeBruitAdmise, resolutionBathyM, overzoomTile } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const { vetoTerre } = await import('/src/coast-veto.js')
  const index = await indexBathy()
  const src = DEM_SOURCES.mapterhorn
  const sorties = []
  const peindre = (champ, PX, teinte) => {
    const c = document.createElement('canvas'); c.width = c.height = PX
    const g = c.getContext('2d')
    const im = g.createImageData(PX, PX)
    for (let i = 0; i < PX * PX; i++) {
      const [r, v, b] = teinte(champ[i], i)
      im.data[i * 4] = r; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255
    }
    g.putImageData(im, 0, 0)
    return c.toDataURL('image/png')
  }
  for (const z of zooms) {
    const n = 2 ** z, latRad = (lat * Math.PI) / 180
    const tx = Math.floor(((lon + 180) / 360) * n)
    const ty = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    const maxZoom = (await resolveRegionMaxZoom(src, z, tx, ty)) ?? src.maxZoom
    const t = overzoomTile(z, tx, ty, maxZoom)
    const r = await fetch(src.url(t.z, t.x, t.y))
    if (!r.ok) continue
    const img = await createImageBitmap(await r.blob())
    const PX = src.tilePx
    const c = document.createElement('canvas'); c.width = c.height = PX
    const g = c.getContext('2d', { willReadFrequently: true })
    const s = PX / t.scale
    g.drawImage(img, t.ox * PX, t.oy * PX, s, s, 0, 0, PX, PX)
    const p = g.getImageData(0, 0, PX, PX).data
    const land = new Float32Array(PX * PX)
    for (let i = 0; i < PX * PX; i++) land[i] = p[i * 4 + 3] === 0 ? 0 : p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
    const sea = new Float32Array(PX * PX).fill(NaN)
    const peint = await peindreBathyTuile({ zoom: z, tx, ty, index, dst: sea, dstStride: PX, dx: 0, dy: 0, dw: PX, dh: PX })
    if (peint < 0) continue
    const pasM = ((156543.03392 * Math.cos(latRad)) / 2 ** z) * (256 / PX)
    const bande = bandeBruitAdmise(resolutionBathyM(peint, lat), pasM)
    const veto = await vetoTerre({ u0: tx / n, u1: (tx + 1) / n, v0: ty / n, v1: (ty + 1) / n, largeur: PX, hauteur: PX, metresParCellule: pasM, zoom: z, cle: `i/${z}/${tx}/${ty}` })
    const fAvant = fuseBathymetry(land, sea, { noiseBand: bande })
    const fApres = fuseBathymetry(land, sea, { noiseBand: bande, ...(veto ? { terreVeto: veto } : {}) })
    // terre = vert (clair = haut), mer = bleu (sombre = profond)
    const teinte = (h) => (h >= 0
      ? [60 + Math.min(150, h * 6), 130 + Math.min(120, h * 4), 60]
      : [10, 40 + Math.max(0, 60 + h * 3), 110 + Math.min(120, -h * 4)])
    sorties.push({ z, tx, ty,
      avant: peindre(fAvant, PX, teinte),
      apres: peindre(fApres, PX, teinte),
      terrarium: peindre(land, PX, teinte),
      masque: peindre(veto ?? new Float32Array(PX * PX), PX, (_, i) => (veto && veto[i] ? [235, 225, 190] : [20, 60, 130])),
    })
  }
  return sorties
}, LAT, LON, ZOOMS)

for (const s of R) {
  for (const k of ['terrarium', 'avant', 'apres', 'masque']) {
    fs.writeFileSync(path.join(ICI, `${NOM}-z${s.z}-${k}.png`), Buffer.from(s[k].split(',')[1], 'base64'))
  }
  console.log(`  ${NOM} z${s.z} (${s.tx}/${s.ty}) → terrarium / avant / apres / masque`)
}
await nav.close()
