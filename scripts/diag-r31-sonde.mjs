// DIAG R31 — LA SONDE : `majEchelleRampe` TOURNE-T-ELLE PAR IMAGE ?
//
// ⚠️ **CE SCRIPT EXISTE PARCE QUE LE PREMIER RELEVÉ A MENTI PAR SILENCE** : le
// poids de recollage valait la MÊME valeur à seize décimales près à trois
// altitudes différentes, et ZÉRO à l'Everest. Un uniforme qui ne bouge pas quand
// son entrée bouge n'est pas « stable », il n'est **pas réévalué**.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5731'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
function trouverChrome() {
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  process.exit(2)
}
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const LIEUX = [
  { nom: 'reunion', lat: -21.115, lon: 55.536, zoom: 13 },
  { nom: 'everest', lat: 27.99, lon: 86.93, zoom: 13 },
]
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  for (const L of LIEUX) {
    await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG R31 sonde'), L)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
    await dodo(8000)
    const r = await page.evaluate(() => {
      const e = window.__exp
      const g = e.globe
      const u = g.uniforms
      const avant = u.uRecollage.value
      // ⚠️ ON APPELLE LA MÉTHODE À LA MAIN, avec une altitude ABSURDE : si le
      // poids ne bouge pas, c'est que les ancres sont vides.
      const rendu = g.majEchelleRampe(200000)
      const apres = u.uRecollage.value
      return {
        altM: e.modes.altM, crop: !!g._crop, busy: !!e.modes.busy,
        ancres: g._echelleContinue?.ancres?.size ?? null,
        cran: g._echelleContinue?.cran ?? null,
        altAncree: g._echelleContinue?.altitudeM ?? null,
        rampeMesuree: !!g._rampe,
        uRecollageAvant: avant, uRecollageApres: apres, majRend: rendu ? 'objet' : String(rendu),
        terreBas: u.uLandBas.value,
      }
    })
    console.log(`[${L.nom}]`, JSON.stringify(r, null, 1))
  }
} finally { await nav.close() }
