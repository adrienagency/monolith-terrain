// DIAG R20 ⑨ — LE CIEL PAR DÉFAUT SE VOIT-IL, ET COMBIEN COÛTE-T-IL ?
//
// ⛔ **LE DÉFAUT N'EST PAS DANS `main.js`.** Le littéral `params` y pose
// `cloudsEnabled: false`, `cloudAltitude: 1`, `cloudOpacity: 2.25` — et
// l'application démarre avec `true`, `13,5`, `0,6`. **Le vrai défaut est
// `public/templates/defaults/shibustart.json`**, le gabarit d'ouverture
// (`main.js` : `import SHIBU_START from '.../shibustart.json'`). Changer le
// littéral n'aurait RIEN changé à l'écran.
//
// ⚠️ **COMPTAGE DE PIXELS À PLEINE RÉSOLUTION**, pas une moyenne sur vignette :
// voir `scripts/instrument-r20-pleine.js`.
//
// ⚠️ **TROIS LIEUX** — une île volcanique, un massif continental, le plein
// océan. Un défaut réglé pour La Réunion et faux ailleurs n'est pas réglé.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5571'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/defaut'))
const LADDER = A.includes('--echelle')
fs.mkdirSync(SORTIE, { recursive: true })

const LIEUX = [
  { nom: 'la-reunion', lat: -21.2484, lon: 55.7666, quoi: 'ile volcanique (le lieu d ouverture)' },
  { nom: 'alpes', lat: 46.6863, lon: 7.8632, quoi: 'massif continental (Interlaken)' },
  { nom: 'pacifique', lat: -8.5, lon: -140.0, quoi: 'plein ocean (Marquises, au large)' },
]

// LE DÉFAUT D'AUJOURD'HUI, lu dans shibustart.json
const AVANT = { cloudsEnabled: true, cloudOpacity: 0.6, cloudAltitude: 13.5, cloudAltSpread: 0.97, cloudCoverage: 0.85 }
// LES CANDIDATS. On ne touche QUE ce que la mesure accuse : l'opacité (le ciel
// est transparent) et l'étalement (la moitié du ciel est enterrée dans le
// relief). ⚡ L'opacité N'AJOUTE PAS DE BOÎTES au palier 0 — le peuplement vaut
// round(4 × (0,65 + opacite × 0,18)), qui sature à 4 dès 0,49. C'est donc le
// levier le moins cher en fragments : mêmes boîtes, mêmes pas de marche.
const CANDIDATS = [
  { nom: 'A-opacite-seule', v: { cloudOpacity: 1.4 } },
  { nom: 'B-etalement-seul', v: { cloudAltSpread: 0.45 } },
  { nom: 'C-les-deux', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45 } },
  { nom: 'D-les-deux-fort', v: { cloudOpacity: 1.9, cloudAltSpread: 0.35 } },
]
const RETENU = { cloudOpacity: 1.4, cloudAltSpread: 0.45 }

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20-pleine.js'), 'utf8')
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { avant: AVANT, retenu: RETENU, lieux: [], echelle: [], paliers: [] }
try {
  const page = await nav.newPage()
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 160)) })
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(16000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2500)
  await page.evaluate(instrument)
  await dodo(800)

  const poser = (v) => page.evaluate((x) => {
    Object.assign(window.__exp.params, x)
    window.__exp.clouds.build(window.__exp.params)
    return { cible: window.__exp.clouds.sky.target, entites: window.__exp.clouds.group.children[0]?.count }
  }, v)

  const mesurer = async (etiq, reglages, lieu) => {
    const etat = await poser({ ...AVANT, ...reglages, cloudsEnabled: true })
    await dodo(2600)
    await page.evaluate(() => window.__r20p.prendre('ON'))
    await page.screenshot({ path: path.join(SORTIE, `${lieu}-${etiq}-ON.png`) })
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
    await dodo(2200)
    await page.evaluate(() => window.__r20p.prendre('OFF'))
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = true; window.__exp.clouds.setVisible(true) })
    const c = await page.evaluate(() => window.__r20p.compter('ON', 'OFF', 2))
    await dodo(1500)
    return { etiq, ...etat, ...c }
  }

  await page.evaluate(() => window.__r20p.prendre('P1'))
  await dodo(900)
  await page.evaluate(() => window.__r20p.prendre('P2'))
  out.plancher = await page.evaluate(() => window.__r20p.compter('P1', 'P2', 2))
  console.log('plancher', JSON.stringify(out.plancher))

  if (LADDER) {
    for (const c of [{ nom: 'AVANT', v: {} }, ...CANDIDATS]) {
      const r = await mesurer(c.nom, c.v, 'la-reunion')
      out.echelle.push({ ...r, reglages: c.v })
      console.log('echelle', c.nom, JSON.stringify({ cible: r.cible, n: r.entites, pct: r.pourcent, px: r.pixelsTouches, d: r.deltaMoyenSurTouches }))
    }
  }

  for (const L of LIEUX) {
    if (L.nom !== 'la-reunion') {
      await page.evaluate(async (ll) => { await window.__exp.loadRealTerrain({ centreSur: { lat: ll.lat, lon: ll.lon } }) }, L)
      await dodo(18000)
      await page.evaluate(() => { window.__exp.params.animations = false })
      await dodo(2000)
    }
    const avant = await mesurer('AVANT', {}, L.nom)
    const apres = await mesurer('APRES', RETENU, L.nom)
    out.lieux.push({ ...L, avant, apres, gain: avant.pixelsTouches ? +(apres.pixelsTouches / avant.pixelsTouches).toFixed(2) : null })
    console.log('LIEU', L.nom,
      'AVANT', JSON.stringify({ pct: avant.pourcent, px: avant.pixelsTouches, d: avant.deltaMoyenSurTouches, pire: avant.deltaPire }),
      'APRES', JSON.stringify({ pct: apres.pourcent, px: apres.pixelsTouches, d: apres.deltaMoyenSurTouches, pire: apres.deltaPire }))
  }

  out.paliers = await page.evaluate((r) => {
    const e = window.__exp
    Object.assign(e.params, r)
    const l = []
    const t0 = e.clouds._tier
    for (let t = 0; t <= 3; t++) {
      e.clouds.setTier(t)
      l.push({ palier: t, grappes: e.clouds.sky.target, entites: e.clouds.group.children[0]?.count ?? null })
    }
    e.clouds.setTier(t0)
    return l
  }, RETENU)
  console.log('paliers', JSON.stringify(out.paliers))
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-defaut.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
