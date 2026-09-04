// B6 — LE CHEMIN DU FLUX (fenêtre continue) À RODRIGUES : la nappe est-elle
// peinte, et que reste-t-il à ZÉRO dans le champ fusionné ?
//
// C'est le TROISIÈME site de fusion (`src/monde/flux-terrain.js`), celui que
// PLAT nomme et que VETO câble — mais dont la descente « tuile fine → plancher »
// n'a JAMAIS reçu la seconde chance du terrarium muet, contrairement à
// `dem.js:loadBathyPatch` et `globe.js:fondMarinTuile`.
//
//   node scripts/b6-flux.mjs --port 9317
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const NOM = opt('--nom', 'defaut')
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
// lieu, demi-largeur en degrés, et zoom demandé
const LIEUX = JSON.parse(opt('--lieux', JSON.stringify([
  { nom: 'Rodrigues', lat: -19.7253, lon: 63.3691, demi: 0.26 },
  { nom: 'La Reunion', lat: -21.1378, lon: 55.5291, demi: 0.26 },
  { nom: 'Bretagne', lat: 48.65, lon: -2.02, demi: 0.26 },
  { nom: 'Camargue', lat: 43.45, lon: 4.6, demi: 0.26 },
  { nom: 'Moorea', lat: -17.53, lon: -149.83, demi: 0.26 },
  { nom: 'Porquerolles', lat: 43.0, lon: 6.2, demi: 0.26 },
])))
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lieux) => {
  const F = await import('/src/monde/flux-terrain.js')
  const out = []
  for (const L of lieux) {
    const emprise = { ouest: L.lon - L.demi, est: L.lon + L.demi, sud: L.lat - L.demi, nord: L.lat + L.demi }
    const zoom = F.zoomPourEmprise(emprise)
    for (const secours of [false, true]) {
      const flux = F.creerFlux({ globe: { _request() {}, tiles: new Map() } })
      const t0 = performance.now()
      await F.demanderBathy(flux, { emprise, zoom, ...(secours ? { secours: true } : {}) })
      // le secours est lancé PAR remplirHauteurs quand le relief est muet ;
      // ici on l'appelle directement pour mesurer les deux régimes
      if (secours && flux.bathy?.secours) await flux.bathy.secours
      const ms = performance.now() - t0
      const e = flux.bathy
      let nan = 0
      for (const v of e.patch) if (!Number.isFinite(v)) nan++
      out.push({
        lieu: L.nom, zoom, secours, tuiles: e.colonnes * e.lignes, peintes: e.peintes,
        zPire: e.zPire, px: e.patch.length, pxNaN: nan,
        partNaN: +((100 * nan) / e.patch.length).toFixed(1), ms: +ms.toFixed(0),
      })
    }
  }
  return out
}, LIEUX)

console.log('\n  lieu           z  secours  tuiles peintes  zPire   px de nappe  NON PEINTS (%)      ms')
for (const r of R) console.log(`  ${r.lieu.padEnd(13)} ${String(r.zoom).padStart(2)}  ${(r.secours ? 'oui' : 'non').padStart(7)} ${String(r.tuiles).padStart(6)} ${String(r.peintes).padStart(7)}  ${String(r.zPire).padStart(5)} ${String(r.px).padStart(12)} ${String(r.pxNaN).padStart(9)} (${String(r.partNaN).padStart(5)} %) ${String(r.ms).padStart(6)}`)
fs.writeFileSync(path.join(ICI, `flux-${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
