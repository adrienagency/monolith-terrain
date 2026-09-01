// DIAG R20 ② — LA COQUILLE DU GLOBE EST-ELLE RENDUE ? Dans les DEUX sens, à
// quatre altitudes, dont deux au-dessus de son seuil de fondu.
//
// ⛔ Le brief affirme « elle EST déjà rendue, captures d'imagerie mondiale à
// l'appui, nuages blancs volumétriques sur l'Afrique ». Cette sonde ne lit pas
// le code : elle éteint la coquille, la rallume, et mesure l'écart à l'écran.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
fs.mkdirSync(SORTIE, { recursive: true })

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20.js'), 'utf8')

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { releves: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)
  await page.evaluate(instrument)
  await dodo(1000)

  const mesurer = async (nom) => {
    const etat = await page.evaluate(() => {
      const e = window.__exp
      return { mode: e.modes.mode, camDist: +e.camera.position.length().toFixed(2), camGlobeDist: +(e.camGlobe?.position.length() ?? 0).toFixed(2), altKm: +(((e.camGlobe?.position.length() ?? 0) - 100) * 63.71).toFixed(0), uFade: +e.globe.clouds.uniforms.uFade.value.toFixed(4) }
    })
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('ON', 8))
    await page.screenshot({ path: path.join(SORTIE, `coquille-${nom}-ON.png`) })
    await page.evaluate(() => window.__exp.globe.clouds.setVisible(false))
    await dodo(900)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('OFF', 8))
    await page.screenshot({ path: path.join(SORTIE, `coquille-${nom}-OFF.png`) })
    await page.evaluate(() => window.__exp.globe.clouds.setVisible(true))
    await dodo(900)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('RET', 8))
    etat.ecart = await page.evaluate(() => window.__r20.distance('ON', 'OFF'))
    etat.retour = await page.evaluate(() => window.__r20.distance('ON', 'RET'))
    etat.nom = nom
    out.releves.push(etat)
    console.log(nom, JSON.stringify(etat))
  }

  await mesurer('surface-18km')
  await page.evaluate(() => window.__exp.modes.enterOrbit(1200000))
  await dodo(9000)
  await mesurer('orbite-1200km')
  // ⛔ `enterOrbit` sort à sa garde `mode !== 'surface'` : une seconde
  // demande d'altitude ne fait RIEN. On pousse donc la caméra ET la cible
  // d'altitude de la machine à modes, qui la relit à chaque image.
  for (const d of [200, 400, 800, 1000]) {
    await page.evaluate((dd) => {
      const e = window.__exp
      e.camera.position.setLength(dd)
      e.modes.orbAlt = e.modes.orbAltTarget = dd - 100
      e.camera.lookAt(0, 0, 0)
      e.controls.update()
    }, d)
    await dodo(7000)
    await mesurer('orbite-d' + d)
  }
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-coquille.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
