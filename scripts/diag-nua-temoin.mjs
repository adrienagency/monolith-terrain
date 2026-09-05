// DIAG NUA — QU'EST-CE QUI BOUGE DANS LE TÉMOIN ? Deux captures sans nuages,
// rien de changé entre les deux, et pourtant 30 à 50 k pixels diffèrent.
// On isole le bougeur en coupant les suspects un à un, et on imprime la boîte
// des pixels qui bougent.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '10620'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const p = 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import('file:///' + p)).default
const src = fs.readFileSync(path.join(RACINE, 'scripts/banc-nua.mjs'), 'utf8')
const INSTRUMENT = '(' + src.slice(src.indexOf('function INSTRUMENT_FN()'), src.indexOf('const INSTRUMENT = ')) + ')()'
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
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
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 11))
  await page.waitForFunction(() => window.__exp.terrain.dem?.zoom === 11 && !window.__exp.modes.busy, { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(6000)
  const capturer = async (nom) => { const b64 = await page.screenshot({ encoding: 'base64' }); return page.evaluate((n, b) => window.__nua.prendre(n, b), nom, b64) }
  const mesure = async (etiq) => {
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
    await dodo(800); await capturer('A'); await dodo(700); await capturer('B')
    const c = await page.evaluate(() => window.__nua.compter('A', 'B', 2, null))
    console.log(etiq.padEnd(28), 'pixels', c.pixels, 'boite', JSON.stringify(c.boite))
    return c
  }
  await mesure('tel quel')
  await page.evaluate(() => { const p = window.__exp.params; p.animations = false })
  await mesure('animations=false')
  await page.evaluate(() => { const p = window.__exp.params; p.grain = 0 })
  await mesure('+ grain=0')
  await page.evaluate(() => { const p = window.__exp.params; p.surfaceFx = 0 })
  await mesure('+ surfaceFx=0')
  await page.evaluate(() => { const e = window.__exp; e.traffic && (e.traffic.enabled = false); e.traffic?.group && (e.traffic.group.visible = false) })
  await mesure('+ trafic caché')
  await page.evaluate(() => { const e = window.__exp; e.boats?.group && (e.boats.group.visible = false); e.peaksLayer?.group && (e.peaksLayer.group.visible = false) })
  await mesure('+ bateaux/sommets cachés')
  await page.evaluate(() => { const e = window.__exp; e.params.dayCycleSpeed = 0; e.params.shadowMode = 'static' })
  await mesure('+ cycle jour 0 / ombres statiques')
  await page.evaluate(() => { const e = window.__exp; e.groundInfo?.setVisible?.(false); e.params.groundInfo = false })
  await mesure('+ cartouche caché')
  await page.evaluate(() => { const e = window.__exp; e.params.placesEnabled = false; e.labels?.group && (e.labels.group.visible = false) })
  await mesure('+ toponymes cachés')
  await page.evaluate(() => { const e = window.__exp; e.params.hazeAmt = 0; e.params.bokehEnabled = false })
  await mesure('+ brume 0')
} finally { await nav.close() }
