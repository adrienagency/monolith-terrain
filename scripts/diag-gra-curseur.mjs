// DIAG GRA — LA COURBE DU CURSEUR « OMBRAGE » (Pivot d'altitude), À z13
//
// ⛔ **LA CONDITION N° 2 DU BRIEF, ET C'EST UN ÉCHEC SI ELLE TOMBE** :
// « `uHeightPivot` est un RÉGLAGE d'Adrien. Le corriger ne doit ni figer son
// curseur, ni changer ce que le curseur veut dire. Si le curseur ne produit
// plus le même effet qu'avant à z13, c'est un échec. »
//
// Ce banc TRAÎNE le curseur de 0 à 1 par pas de 0,05, exactement comme
// `create-panel.js` le fait (`params[key] = v ; u()[uni].value = v`), et relève
// à chaque cran **le pivot RENDU sur le bloc, en mètres** — la ligne du
// nuanceur, plancher de R28 compris. La courbe est la preuve : même sens (elle
// monte), même effet (les mêmes mètres pour la même position du curseur).
//
// ⚠️ **ON NE RECHARGE PAS LE RELIEF ENTRE DEUX CRANS** : `applyAutoShade` ne
// tourne qu'au chargement, donc le grade auto du socle ne bouge pas pendant le
// balayage — ce qui est exactement la situation d'Adrien qui traîne sa tirette.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAFOND_PIVOT, MARGE_PIVOT } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '7643'))
const ETIQUETTE = opt('--etiquette', 'apres')
const SORTIE = path.join(RACINE, '.banc/GRA')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

const LIEUX = [
  { nom: 'reunion', lat: -21.115, lon: 55.536 },
  { nom: 'everest', lat: 27.99, lon: 86.93 },
  { nom: 'paysbas', lat: 52.09, lon: 5.12 },
]
const CRANS = Array.from({ length: 21 }, (_, i) => i * 0.05)

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { quand: new Date().toISOString(), etiquette: ETIQUETTE, courbes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.terrain, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  for (const L of LIEUX) {
    await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG GRA curseur'), { lat: L.lat, lon: L.lon, zoom: 13 })
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
    await dodo(6000)
    const points = []
    for (const v of CRANS) {
      // le geste du panneau, mot pour mot (create-panel.js `shadeSlider.set`)
      await page.evaluate((x) => {
        window.__exp.params.heightPivot = x
        window.__exp.terrain.mapUniforms.uHeightPivot.value = x
      }, v)
      await dodo(400)
      const r = await page.evaluate(() => {
        const u = window.__exp.globe.uniforms
        return { reliefBas: u.uReliefBas.value, landMax: u.uLandMax.value, plancher: u.uPlancherRampeM.value, pivot: u.uHeightPivot.value, contraste: u.uHeightContrast.value }
      })
      const amp = Math.max(r.landMax - r.reliefBas, r.plancher)
      const hNormMer = (0 - r.reliefBas) / amp
      const pivotEff = Math.max(r.pivot, Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT)
      points.push({ curseur: v, uniforme: r.pivot, pivotRenduM: r.reliefBas + pivotEff * amp })
    }
    rapport.courbes.push({ lieu: L.nom, points })
    console.log(`[${L.nom} z13] curseur → pivot rendu (m) :`)
    console.log('   ' + points.map((p) => `${p.curseur.toFixed(2)}→${p.pivotRenduM.toFixed(0)}`).join('  '))
    const monotone = points.every((p, i) => i === 0 || p.pivotRenduM >= points[i - 1].pivotRenduM - 1e-6)
    console.log('   monotone croissante : ' + (monotone ? 'OUI' : '⛔ NON'))
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, `curseur-${ETIQUETTE}.json`), JSON.stringify(rapport, null, 1))
console.log('\necrit : ' + path.join(SORTIE, `curseur-${ETIQUETTE}.json`))
