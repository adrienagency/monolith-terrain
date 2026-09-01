// DIAG R31 — LES DEUX DOMAINES DE NORMALISATION, CÔTE À CÔTE
//
// ⛔ **LA QUESTION QUE CE SCRIPT TRANCHE**, et elle est plus précise que celle du
// brief : `uHeightPivot` et `uHeightContrast` sont GRADÉS sur le domaine du
// SOCLE (`terrain.mapUniforms.uHeightRange`, l'amplitude du MNT chargé, qui suit
// le ZOOM de la carte) et CONSOMMÉS sur le domaine du GLOBE (`[uReliefBas ;
// uLandMax]`, le relief de l'emprise z13 du crop, qui NE suit PAS le zoom).
//
// `globe.js` affirme que la conversion est exacte (« Relevé le même jour :
// −2 106,8 et 2 584,4 contre −2 116 et 2 626 côté socle »). Ce script mesure les
// deux domaines AU MÊME INSTANT, à plusieurs zooms, et rend le pivot **EN
// MÈTRES** dans chacun. Si les deux mètres diffèrent, l'affirmation ne tient
// qu'au zoom où elle a été relevée.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5731'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R31'))
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

function relever() {
  const e = window.__exp
  const u = e.globe.uniforms
  const m = e.terrain?.mapUniforms
  const hr = m?.uHeightRange?.value
  return {
    socle: {
      heightRange: hr ? [hr.x, hr.y] : null,
      pivot: m?.uHeightPivot?.value ?? null,
      contraste: m?.uHeightContrast?.value ?? null,
      seaY: m?.uSeaY?.value ?? null,
      seaRange: m?.uSeaRange?.value ?? null,
    },
    globe: {
      reliefBas: u.uReliefBas.value, landBas: u.uLandBas.value,
      landMax: u.uLandMax.value, oceanDepth: u.uOceanDepth.value,
      pivot: u.uHeightPivot.value, contraste: u.uHeightContrast.value,
      plancher: u.uPlancherRampeM.value,
    },
    scene: { altM: e.modes.altM, zoom: e.params.zoom, crop: !!e.globe._crop, exag: e.params.exaggeration },
  }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const LIEUX = [
  { nom: 'reunion', lat: -21.115, lon: 55.536 },
  { nom: 'borneo', lat: 5.98, lon: 116.07 },
  { nom: 'everest', lat: 27.99, lon: 86.93 },
]
const ZOOMS = [13, 12, 11, 10, 9]
const rapport = { quand: new Date().toISOString(), lignes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.terrain, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  for (const L of LIEUX) {
    for (const z of ZOOMS) {
      await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG R31 domaines'), { lat: L.lat, lon: L.lon, zoom: z })
      await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
      await dodo(6000)
      const r = await page.evaluate(relever)
      const S = r.socle, G = r.globe
      const ampS = S.heightRange ? S.heightRange[1] - S.heightRange[0] : NaN
      const ampG = G.landMax - G.reliefBas
      // le pivot, EN MÈTRES, dans chacun des deux domaines
      const pivotSocleM = S.heightRange ? S.heightRange[0] + S.pivot * ampS : NaN
      const pivotGlobeM = G.reliefBas + G.pivot * ampG
      const ligne = {
        lieu: L.nom, zoom: z, altM: r.scene.altM, crop: r.scene.crop,
        socle: S, globe: G, ampSocle: ampS, ampGlobe: ampG,
        pivotSocleM, pivotGlobeM, ecartPivotM: pivotGlobeM - pivotSocleM,
        fenetreSocleM: ampS / S.contraste, fenetreGlobeM: ampG / G.contraste,
      }
      rapport.lignes.push(ligne)
      console.log(`[${L.nom} z${z}] alt=${Math.round(r.scene.altM)} crop=${r.scene.crop}`
        + `\n   SOCLE  heightRange=[${S.heightRange?.map((x) => x.toFixed(1))}] amp=${ampS.toFixed(1)} pivot=${S.pivot} → ${pivotSocleM.toFixed(1)} m · contraste=${S.contraste} → fenêtre ${(ampS / S.contraste).toFixed(1)} m`
        + `\n   GLOBE  [${G.reliefBas.toFixed(1)} ; ${G.landMax.toFixed(1)}] amp=${ampG.toFixed(1)} pivot=${G.pivot} → ${pivotGlobeM.toFixed(1)} m · contraste=${G.contraste} → fenêtre ${(ampG / G.contraste).toFixed(1)} m`
        + `\n   ⛔ ÉCART DU PIVOT : ${(pivotGlobeM - pivotSocleM).toFixed(1)} m`)
    }
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, 'domaines.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'domaines.json'))
