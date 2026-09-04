// DIAG GRA — « OUVRIR LE MÊME LIEU DEPUIS z13, z11 ET z9 »
//
// ⛔ **CE SCRIPT MESURE L'INVARIANCE QUE LE BRIEF DEMANDE, ET PAS CELLE QU'ON
// CROIT LIRE DANS SON TABLEAU.** Le brief écrit : « ouvrir le même lieu
// **DEPUIS** z13, z11 et z9 doit donner la même image du bloc ». C'est une
// **indépendance au CHEMIN**, pas une invariance au zoom — et la différence est
// tout, parce que **l'emprise du bloc SUIT le zoom** :
//
//     La Réunion, `globe._crop.demi` relevé le 2026-09-04 :
//       z13 0,000183   z11 0,000732   z9 0,002930     ⟵ ×4 tous les deux crans
//     et le relief qu'elle contient :
//       z13 [533,7 ; 3 057,2] m   z11 [−1 827 ; 3 005,5]   z9 [−4 913 ; 2 848,8]
//
// ⚡ **DONC « le même bloc » À TROIS ZOOMS N'EXISTE PAS** : à z9 le bloc couvre
// 219 km au lieu de 13,7, et il contient 4,9 km de fond océanique que le bloc
// z13 n'a jamais vus. Exiger la MÊME couleur sur ces trois blocs reviendrait à
// exiger qu'une carte ignore son propre relief. Ce qui doit être invariant,
// c'est l'**image du bloc de z13 selon qu'on y arrive directement ou après un
// détour** — la seule chose qu'Adrien peut comparer côte à côte.
//
// ⚠️ **PAS DE RECHARGEMENT ENTRE DEUX CHEMINS, ET C'EST LE PIÈGE DU BRIEF** :
// « le pixel n'est déterministe qu'en orbite ; en crop, fais l'A/B dans la même
// session (mer, nuages, caustiques déphasés) ». On reste donc dans la MÊME page
// et l'on remet l'horloge et l'animation au même état avant chaque capture.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAFOND_PIVOT, MARGE_PIVOT } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '7643'))
const ETIQUETTE = opt('--etiquette', 'apres')
const SORTIE = path.join(RACINE, '.banc/GRA', ETIQUETTE)
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
  return {
    globe: {
      reliefBas: u.uReliefBas.value, landMax: u.uLandMax.value,
      pivot: u.uHeightPivot.value, contraste: u.uHeightContrast.value,
      plancher: u.uPlancherRampeM.value, recollage: u.uRecollage?.value ?? null,
    },
    socle: { pivot: m?.uHeightPivot?.value ?? null, contraste: m?.uHeightContrast?.value ?? null },
    crop: e.globe._crop ? { demi: e.globe._crop.demi } : null,
    mesureBloc: e.globe._mesureBloc ? { ...e.globe._mesureBloc } : null,
    gradeBlocM: e.globe._gradeBlocM ? { ...e.globe._gradeBlocM } : null,
    dem: e.dem ? { minM: e.dem.minM, maxM: e.dem.maxM } : null,
    scene: { altM: e.modes.altM, zoom: e.params.zoom },
  }
}

// le pivot RENDU et la fenêtre UTILE, en mètres — la ligne du nuanceur
function rendu(G) {
  const amp = Math.max(G.landMax - G.reliefBas, G.plancher)
  const hNormMer = (0 - G.reliefBas) / amp
  const pivotEff = Math.max(G.pivot, Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT)
  return { pivotM: G.reliefBas + pivotEff * amp, fenetreM: amp / G.contraste, amp }
}

const LIEUX = [
  { nom: 'reunion', lat: -21.115, lon: 55.536 },
  { nom: 'everest', lat: 27.99, lon: 86.93 },
  { nom: 'paysbas', lat: 52.09, lon: 5.12 },
]
// le détour, puis TOUJOURS la même vue d'arrivée : z13
const DEPARTS = [13, 11, 9]
const AILLEURS = { lat: -33.87, lon: 151.21 } // Sydney — assez loin pour vider les ancres

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
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
  // ⛔ **LES ANIMATIONS COUPÉES ET LES RAILS CACHÉS — SANS ÇA LE BANC MESURE LA
  // MER.** Premier passage, capté et jeté : SANS ces deux lignes, **69,4 % des
  // pixels** différaient entre deux captures du même état de rampe, écart moyen
  // 17,6/255 — la houle, l'écume et les caustiques déphasés, exactement le piège
  // que le brief nomme (« le pixel n'est déterministe qu'en orbite »). Le témoin
  // nul valait pourtant 0 : l'instrument marchait, c'est la SCÈNE qui bougeait.
  // Même geste que `diag-r31-vues.mjs`.
  await page.evaluate(() => { document.body.classList.add('ce-railL-off', 'ce-railR-off') })
  await page.evaluate(() => { window.__exp.params.animations = false })
  // ⚠️ l'heure GELÉE : sans elle le soleil bouge entre deux captures et l'A/B
  // mesure le cycle horaire au lieu de la rampe.
  await page.evaluate(() => { try { window.__exp.api?.setTimeOfDay?.(11) } catch {} })

  const poser = async (lat, lon, zoom) => {
    await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG GRA chemins'), { lat, lon, zoom })
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
    await dodo(6000)
  }

  for (const L of LIEUX) {
    for (const depart of DEPARTS) {
      // ① on part de loin, pour que le lieu change et que les ancres s'oublient
      await poser(AILLEURS.lat, AILLEURS.lon, 11)
      // ② le détour
      if (depart !== 13) await poser(L.lat, L.lon, depart)
      // ③ la vue d'arrivée — TOUJOURS LA MÊME
      await poser(L.lat, L.lon, 13)
      const r = await page.evaluate(relever)
      const R = rendu(r.globe)
      const nom = `${L.nom}-depuis-z${depart}`
      await page.screenshot({ path: path.join(SORTIE, nom + '.png') })
      rapport.lignes.push({ lieu: L.nom, depart, ...r, pivotRenduM: R.pivotM, fenetreRenduM: R.fenetreM, ampGlobe: R.amp, capture: nom + '.png' })
      console.log(`[${L.nom}] arrivée z13 DEPUIS z${depart} → pivot rendu ${R.pivotM.toFixed(1)} m · fenêtre ${R.fenetreM.toFixed(1)} m`
        + ` · domaine [${r.globe.reliefBas.toFixed(1)} ; ${r.globe.landMax.toFixed(1)}] · demi=${r.crop?.demi}`)
    }
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, 'chemins.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'chemins.json'))
