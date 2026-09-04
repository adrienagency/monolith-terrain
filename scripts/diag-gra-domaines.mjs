// DIAG GRA — LE PIVOT ET LA FENÊTRE UTILE RENDUS, EN MÈTRES, À TROIS ZOOMS
//
// ⛔ **CE QUE CE SCRIPT TRANCHE, ET QUE `diag-r31-domaines.mjs` NE TRANCHAIT
// PAS** : R31 a mesuré l'écart des deux domaines ; il n'a pas séparé les DEUX
// causes possibles de la dérive du pivot rendu (1 519 → 2 324 m).
//
//   ① le DÉSACCORD DE DOMAINES — le grade est posé dans l'échelle du socle et
//      consommé dans celle du globe, et les deux ne coïncident qu'à z12/z13 ;
//   ② la REGRADATION — `applyAutoShade` recalcule le grade sur le MNT chargé,
//      dont l'histogramme change avec le zoom.
//
// Le départage tient en une colonne : **`pivotSocleM`**, le pivot du socle
// exprimé EN MÈTRES. S'il est stable d'un zoom à l'autre alors que
// `pivotGlobeM` dérive, la dérive est ①, et une conversion la supprime. S'il
// dérive lui aussi, ② en porte sa part et aucune conversion ne l'atteindra.
//
// ⚠️ **LE PIVOT RENDU N'EST PAS `uHeightPivot`** : le nuanceur consomme
// `max(uHeightPivot, natPlancherPivot(hNorm du niveau de la mer))` — le plancher
// de R28, qui interdit au pivot de descendre sous la mer. Ce script rejoue la
// ligne du nuanceur, pas l'uniforme nu.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAFOND_PIVOT, MARGE_PIVOT } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '7643'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/GRA'))
const ETIQUETTE = opt('--etiquette', 'avant')
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
    },
    globe: {
      reliefBas: u.uReliefBas.value, landBas: u.uLandBas.value,
      landMax: u.uLandMax.value, oceanDepth: u.uOceanDepth.value,
      pivot: u.uHeightPivot.value, contraste: u.uHeightContrast.value,
      plancher: u.uPlancherRampeM.value,
    },
    // ⚠️ LE GRADE DU BLOC, EN MÈTRES — absent AVANT la correction, c'est normal.
    gradeBlocM: e.globe._gradeBlocM ? { ...e.globe._gradeBlocM } : null,
    gradeSocle: e.globe._gradeSocle ? { ...e.globe._gradeSocle } : null,
    mesureBloc: e.globe._mesureBloc ? { ...e.globe._mesureBloc } : null,
    crop: e.globe._crop ? { cx: e.globe._crop.cx, cy: e.globe._crop.cy, demi: e.globe._crop.demi, largeurM: e.globe._crop.largeurM ?? null } : null,
    rampe: e.globe._rampe ? { ...e.globe._rampe } : null,
    dem: e.dem ? { minM: e.dem.minM, maxM: e.dem.maxM, extentMeters: e.dem.extentMeters } : null,
    scene: { altM: e.modes.altM, zoom: e.params.zoom, crop: !!e.globe._crop },
  }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
fs.mkdirSync(path.join(SORTIE, 'vues'), { recursive: true })
const LIEUX = [
  { nom: 'reunion', lat: -21.115, lon: 55.536 },
  { nom: 'everest', lat: 27.99, lon: 86.93 },
  { nom: 'paysbas', lat: 52.09, lon: 5.12 },
]
const ZOOMS = [13, 11, 9]
const rapport = { quand: new Date().toISOString(), etiquette: ETIQUETTE, lignes: [] }
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
    for (const z of ZOOMS) {
      await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG GRA domaines'), { lat: L.lat, lon: L.lon, zoom: z })
      await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
      await dodo(6000)
      const r = await page.evaluate(relever)
      // ⚠️ LA CAPTURE POUR ADRIEN — c'est son affiche, il doit voir ce qui change.
      await page.screenshot({ path: path.join(SORTIE, 'vues', `${L.nom}-z${z}.png`) })
      const S = r.socle, G = r.globe
      const ampS = S.heightRange ? S.heightRange[1] - S.heightRange[0] : NaN
      const ampG = Math.max(G.landMax - G.reliefBas, G.plancher)
      // le pivot RENDU : la ligne du nuanceur, plancher compris
      const hNormMer = (0 - G.reliefBas) / ampG
      const plancherPivot = Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT
      const pivotEff = Math.max(G.pivot, plancherPivot)
      const pivotRenduM = G.reliefBas + pivotEff * ampG
      const pivotSocleM = S.heightRange ? S.heightRange[0] + S.pivot * ampS : NaN
      const ligne = {
        lieu: L.nom, zoom: z, altM: r.scene.altM, crop: r.scene.crop, dem: r.dem,
        gradeBlocM: r.gradeBlocM, gradeSocle: r.gradeSocle, mesureBloc: r.mesureBloc, crop: r.crop, rampe: r.rampe,
        socle: S, globe: G, ampSocle: ampS, ampGlobe: ampG,
        hNormMer, plancherPivot, pivotEff,
        pivotRenduM, pivotSocleM,
        fenetreRenduM: ampG / G.contraste,
        fenetreSocleM: ampS / S.contraste,
      }
      rapport.lignes.push(ligne)
      console.log(`[${L.nom} z${z}] alt=${Math.round(r.scene.altM)} crop=${r.scene.crop}`
        + `\n   SOCLE amp=${ampS.toFixed(1)} pivot=${S.pivot} → ${pivotSocleM.toFixed(1)} m · contraste=${S.contraste} → fenêtre ${(ampS / S.contraste).toFixed(1)} m`
        + `\n   GLOBE [${G.reliefBas.toFixed(1)} ; ${G.landMax.toFixed(1)}] amp=${ampG.toFixed(1)} pivotU=${G.pivot} pivotEff=${pivotEff.toFixed(4)}`
        + `\n   ➡️ PIVOT RENDU ${pivotRenduM.toFixed(1)} m · FENÊTRE UTILE ${(ampG / G.contraste).toFixed(1)} m`)
    }
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, `domaines-${ETIQUETTE}.json`), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, `domaines-${ETIQUETTE}.json`))
