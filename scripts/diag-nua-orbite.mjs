// DIAG NUA — HORS CROP, RIEN NE CHANGE : en ORBITE, le volume de nuages est
// caché par `visibiliteSurface` ; sa contribution à l'image doit être NULLE,
// nuages allumés comme éteints (témoin exclu : la barre de mode animée, voir
// `banc-nua.mjs`). À lancer AVANT et APRÈS le correctif : deux zéros.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '10620'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/NUA/orbite'))
fs.mkdirSync(SORTIE, { recursive: true })
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const p = 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import('file:///' + p)).default
const src = fs.readFileSync(path.join(RACINE, 'scripts/banc-nua.mjs'), 'utf8')
const INSTRUMENT = '(' + src.slice(src.indexOf('function INSTRUMENT_FN()'), src.indexOf('const INSTRUMENT = ')) + ')()'
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = {}
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  await page.evaluate(INSTRUMENT)
  await page.evaluate(() => { const p = window.__exp.params; p.animations = false; p.grain = 0 })
  const EXCL = [395, 620, 885, 800]
  const capturer = async (nom) => { const b64 = await page.screenshot({ encoding: 'base64' }); return page.evaluate((n, b) => window.__nua.prendre(n, b), nom, b64) }
  const abOnOff = async (etiq) => {
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
    await dodo(900); await capturer('OFF1'); await dodo(600); await capturer('OFF2')
    const temoin = await page.evaluate((x) => window.__nua.compter('OFF1', 'OFF2', 2, null, x), EXCL)
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = true; window.__exp.clouds.setVisible(true) })
    await dodo(900); await capturer('ON')
    const c = await page.evaluate((x) => window.__nua.compter('ON', 'OFF1', 2, null, x), EXCL)
    const etat = await page.evaluate(() => ({ mode: window.__exp.modes.mode, visible: window.__exp.clouds.group.visible, k: window.__exp.clouds.group.parent.scale.x, plafondM: window.__exp.clouds._plafondM ?? null }))
    await page.screenshot({ path: path.join(SORTIE, `${etiq}.png`) })
    const r = { etiq, temoin: temoin.pixels, nuagesMoinsTemoin: c.pixels, etat }
    console.log(etiq.padEnd(22), JSON.stringify(r))
    return r
  }
  // ① la vue de surface d'ouverture (La Réunion, 18 km) — un témoin de présence
  out.surface = await abOnOff('surface-reunion')
  // ② l'orbite
  await page.evaluate(() => window.__exp.modes.enterOrbit(3000000))
  await page.waitForFunction(() => window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy, { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(8000)
  out.orbite = await abOnOff('orbite-3000km')
} catch (err) { out.erreur = String(err?.stack || err); console.error(out.erreur) } finally {
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
