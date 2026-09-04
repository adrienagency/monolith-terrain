// PLAT — que fait réellement la réparation « dalle vide » de dem.js ?
// On appelle `loadDem` POUR DE VRAI dans la page (même origine, même décodage
// canvas), on compte les requêtes par hôte au CDP, et on relit le champ rendu.
//   node scripts/plat-dalles.mjs --port 8231 --lieu 43.45,4.60 --zoom 15 --nom camargue
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8231'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const ZOOM = Number(opt('--zoom', '15'))
const NOM = opt('--nom', 'camargue')
const ICI = path.join(RACINE, '.banc', 'PLAT')
fs.mkdirSync(ICI, { recursive: true })

// Page NUE, sur l'origine du serveur : on importe les modules de `src/` sans
// charger l'application. Semee ici pour qu'aucun banc ne depende d'un fichier
// de travail reste au depot.
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 },
})
const page = (await nav.pages())[0]
const hotes = {}
page.on('response', (r) => { let h; try { h = new URL(r.url()).host } catch { h = '?' }; hotes[h] = (hotes[h] ?? 0) + 1 })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zoom) => {
  const dem = await import('/src/dem.js')
  const bloc = await dem.loadDem({ lat, lon, zoom, tilesAcross: 3, bathy: true })
  const d = bloc.data
  // histogramme grossier + repérage des PLATEAUX : une case de 32×32 dont
  // l'étendue est nulle au décimètre est un carré plat.
  const s = bloc.size
  const P = 32
  let plateaux = 0, cases = 0
  const platsEmerges = []
  for (let by = 0; by + P <= s; by += P) {
    for (let bx = 0; bx + P <= s; bx += P) {
      let mn = Infinity, mx = -Infinity
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const v = d[(by + y) * s + bx + x]
        if (v < mn) mn = v; if (v > mx) mx = v
      }
      cases++
      if (mx - mn <= 0.5) { plateaux++; if (mn > 0.5) platsEmerges.push([bx, by, mn]) }
    }
  }
  // combien de pixels émergés (> 0,5 m) — un « carré blanc dans l'eau » en est
  let emerges = 0, sousZero = 0, aZero = 0
  for (let i = 0; i < d.length; i++) { const v = d[i]; if (v > 0.5) emerges++; else if (v < -0.5) sousZero++; else aZero++ }
  return {
    size: s, demSource: bloc.demSource, maxZoom: bloc.maxZoom,
    metersPerPixel: bloc.metersPerPixel, minM: bloc.minM, maxM: bloc.maxM,
    cases, plateaux, platsEmerges: platsEmerges.length,
    exemplesPlatsEmerges: platsEmerges.slice(0, 12),
    emerges, sousZero, aZero,
  }
}, LAT, LON, ZOOM)

R.hotes = hotes
R.lieu = `${LAT},${LON}`
R.zoom = ZOOM
const f = path.join(ICI, `${NOM}-z${ZOOM}.json`)
fs.writeFileSync(f, JSON.stringify(R, null, 2))
console.log(NOM, 'z' + ZOOM, JSON.stringify(R, null, 2))
await nav.close()
