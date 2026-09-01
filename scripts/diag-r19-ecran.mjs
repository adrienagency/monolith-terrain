// R19 — ÉTAPES 4 ET 6 : LES TROIS CURSEURS, ET L'ÉCRAN.
//
// ⚠️ **LE CHEMIN EST CELUI DU PANNEAU, PAS UN RACCOURCI.** `ui/map-panel.js`
// écrit `params.X = v` PUIS `terrain.mapUniforms.uX.value = v` pour l'intervalle
// et l'opacité, et la couleur passe par `applyGridContour` → `globe.setInk`.
// Ce script fait exactement ces trois écritures-là.
//
// ⚠️ **ET LE LIEU EST VÉRIFIÉ À CHAQUE CAPTURE.** Le globe tourne seul à ~2 °/s
// après trois secondes d'inactivité ; on relit donc `uCropCentre` — le centre du
// crop en Mercator — et on le retraduit en lat/lon dans le journal.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5563'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R19'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LARG = 256, HAUT = 160
const { poserInstrument } = await import('file:///' + path.join(RACINE, 'scripts/instrument-r19.mjs').replace(/\\/g, '/'))

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}

const LIEUX = [
  { nom: 'reunion', lat: -21.1151, lon: 55.5364, zoom: 12 },   // le Piton des Neiges — le cadrage de R18
  { nom: 'montblanc', lat: 45.8326, lon: 6.8652, zoom: 12 },   // fort relief : 3 800 m d'amplitude
]

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { curseurs: [], lieux: [] }

async function ouvrir(adresse) {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (er) => console.log('ERREUR PAGE', String(er.message).slice(0, 200)))
  await page.goto(adresse, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1200)
  return page
}
const OU = () => ({
  centre: (() => {
    const u = window.__exp.globe?.uniforms?.uCropCentre?.value
    if (!u) return null
    const lon = u.x * 360 - 180
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * u.y))) * 180) / Math.PI
    return { lat: +lat.toFixed(4), lon: +lon.toFixed(4) }
  })(),
  iv: window.__exp.globe?.uniforms?.uContourInterval?.value ?? null,
  op: window.__exp.globe?.uniforms?.uContourOpacity?.value ?? null,
  ivSocle: window.__exp.terrain.mapUniforms.uContourInterval.value,
})

try {
  // ══════════ ÉTAPE 4 — LES TROIS CURSEURS ═════════════════════════════════
  const page = await ouvrir(`http://localhost:${PORT}/`)
  await page.evaluate(poserInstrument, LARG, HAUT)
  await dodo(1200)

  const poser = async (c) => {
    await page.evaluate((c) => {
      const e = window.__exp
      if (c.op != null) { e.params.contourOpacity = c.op; e.terrain.mapUniforms.uContourOpacity.value = c.op }
      if (c.iv != null) { e.params.contourInterval = c.iv; e.terrain.mapUniforms.uContourInterval.value = c.iv }
      if (c.col != null) {
        e.params.contourColor = c.col
        e.applyGridContour({ contourInterval: e.params.contourInterval, contourOpacity: e.params.contourOpacity, contourColor: c.col, contourWeight: e.params.contourWeight, gridStep: e.params.gridStep, gridOpacity: e.params.gridOpacity, gridColor: e.params.gridColor })
      }
    }, c)
    await dodo(2500)
  }
  const relever = async (nom) => {
    await page.evaluate(() => window.__r19.vider())
    await page.waitForFunction(() => window.__r19.pret(6), { timeout: 30000, polling: 100 })
    await page.evaluate((n) => window.__r19.capturer(n, 6), nom)
    return page.evaluate(OU)
  }

  const suite = [
    ['ref', { op: 1, iv: 0.29, col: '#000000' }],
    ['opacite-0', { op: 0 }],
    ['opacite-1', { op: 1 }],
    ['intervalle-0.10', { iv: 0.10 }],
    ['intervalle-0.55', { iv: 0.55 }],
    ['intervalle-0.29', { iv: 0.29 }],
    ['couleur-rouge', { col: '#c02020' }],
    ['couleur-noir', { col: '#000000' }],
  ]
  for (const [nom, c] of suite) {
    await poser(c)
    const ou = await relever(nom)
    journal.curseurs.push({ nom, c, ou })
    await page.screenshot({ path: path.join(SORTIE, `e4-${nom}.png`) })
    console.log('relevé', nom.padEnd(18), JSON.stringify(ou))
  }
  journal.distancesCurseurs = {}
  for (const [a, b, quoi] of [
    ['opacite-0', 'opacite-1', 'OPACITÉ 0 → 1'],
    ['intervalle-0.29', 'intervalle-0.10', 'INTERVALLE 0,29 → 0,10'],
    ['intervalle-0.29', 'intervalle-0.55', 'INTERVALLE 0,29 → 0,55'],
    ['couleur-noir', 'couleur-rouge', 'COULEUR noir → rouge'],
    ['ref', 'intervalle-0.29', 'témoin (même état deux fois)'],
  ]) {
    const d = await page.evaluate((x, y) => window.__r19.distance(x, y), a, b)
    journal.distancesCurseurs[quoi] = d
    console.log(`Δ ${quoi.padEnd(30)} moy ${d.moy.toFixed(4)} | grad ${d.grad.toFixed(4)}`)
  }
  await page.close()

  // ══════════ ÉTAPE 6 — DEUX LIEUX, ET LE SOCLE EN VIS-À-VIS ═══════════════
  for (const mode of [{ nom: 'sphere', adresse: `http://localhost:${PORT}/` }, { nom: 'socle', adresse: `http://localhost:${PORT}/?terre=0` }]) {
    const p = await ouvrir(mode.adresse)
    await p.evaluate(() => {
      const e = window.__exp
      e.params.contourOpacity = 1
      e.terrain.mapUniforms.uContourOpacity.value = 1
      e.params.contourInterval = 0.29
      e.terrain.mapUniforms.uContourInterval.value = 0.29
    })
    await dodo(2500)
    for (const l of LIEUX) {
      const alle = await p.evaluate(async (l) => window.__exp.modes.flyTo(l.lat, l.lon, l.zoom), l)
      await dodo(16000)
      await p.evaluate(() => { window.__exp.params.animations = false })
      await dodo(2500)
      const ou = await p.evaluate(OU)
      const f = path.join(SORTIE, `e6-${l.nom}-${mode.nom}.png`)
      await p.screenshot({ path: f })
      journal.lieux.push({ lieu: l.nom, mode: mode.nom, alle, ou, capture: path.basename(f) })
      console.log(`capture ${l.nom}/${mode.nom}`, JSON.stringify(ou))
    }
    await p.close()
  }
  fs.writeFileSync(path.join(SORTIE, 'etapes4-6.json'), JSON.stringify(journal, null, 1))
} finally { await nav.close() }
