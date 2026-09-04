// PLAT — LE MÊME POINT, LU À TOUS LES NIVEAUX DE LA PYRAMIDE TERRARIUM.
// La fenêtre continue mélange des tuiles de z différents (`remplirHauteurs`,
// « du plus grossier au plus fin »). Si le même sol sort tantôt à +0,2 m,
// tantôt à −0,3 m selon le niveau servi, alors le seuil terre/mer à 0 découpe
// la carte en carrés de tuile — sans qu'aucune bathymétrie soit en cause.
//   node scripts/plat-niveaux.mjs --port 8231 --lieu 43.45,4.60
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8231'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const NOM = opt('--nom', 'camargue')
const ICI = path.join(RACINE, '.banc', 'PLAT', 'niveaux')
fs.mkdirSync(ICI, { recursive: true })
// Page NUE, sur l'origine du serveur : on importe les modules de `src/` sans
// charger l'application. Semee ici pour qu'aucun banc ne depende d'un fichier
// de travail reste au depot.
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const R = await page.evaluate(async (lat, lon) => {
  const { DEM_SOURCES } = await import('/src/dem-source.js')
  const lignes = []
  for (const [nomSrc, src] of [['mapterhorn', DEM_SOURCES.mapterhorn], ['aws', DEM_SOURCES.aws]])
  for (let z = 8; z <= (nomSrc === 'aws' ? 15 : 17); z++) {
    const n = 2 ** z, latRad = lat * Math.PI / 180
    const fx = ((lon + 180) / 360) * n
    const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    const tx = Math.floor(fx), ty = Math.floor(fy)
    const r = await fetch(src.url(z, tx, ty))
    if (!r.ok) { lignes.push({ src: nomSrc, z, statut: r.status }); continue }
    const img = await createImageBitmap(await r.blob())
    const w = img.width, h = img.height
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
    const p = g.getImageData(0, 0, w, h).data
    const val = (px, py) => { const i = (py * w + px) * 4; return p[i] * 256 + p[i + 1] + p[i + 2] / 256 - 32768 }
    // le pixel qui contient EXACTEMENT notre point
    const px = Math.min(w - 1, Math.floor((fx - tx) * w))
    const py = Math.min(h - 1, Math.floor((fy - ty) * h))
    // et la part de la tuile sous zéro : c'est elle qui devient bleue
    let sous = 0, mn = Infinity, mx = -Infinity
    for (let i = 0; i < w * h; i++) {
      const m = p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
      if (m < 0) sous++
      if (m < mn) mn = m; if (m > mx) mx = m
    }
    lignes.push({
      src: nomSrc, z, px: w, auPoint: +val(px, py).toFixed(3),
      partSousZeroPct: +(100 * sous / (w * h)).toFixed(1),
      min: +mn.toFixed(3), max: +mx.toFixed(3),
      resolutionM: +((156543.03392 * Math.cos(lat * Math.PI / 180)) / 2 ** z * (256 / w)).toFixed(2),
    })
  }
  return lignes
}, LAT, LON)
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
console.log('src        z   px   res(m)   au point   % sous 0   min      max')
for (const l of R) console.log(String(l.src).padEnd(11), String(l.z).padEnd(4), String(l.px ?? '-').padEnd(5), String(l.resolutionM ?? l.statut).padEnd(8), String(l.auPoint).padEnd(10), String(l.partSousZeroPct).padEnd(10), String(l.min).padEnd(9), l.max)
await nav.close()
