// SONDE DU COÛT — Tâche D16-b, étape 6.
//
// ⚠️ **LE COÛT DE CETTE TÂCHE EST DU CPU, PAS DU GPU**, et c'est mesurable :
// ce qui s'ajoute, c'est un `hauteurDessinee` par SOMMET de calque, c'est-à-dire
// une recherche de tuile + une interpolation de maille sur le fil principal.
// Le GPU, lui, dessine EXACTEMENT les mêmes objets qu'avant — ils ont seulement
// changé de scène.
//
// ⛔ **ON N'EMPLOIE DONC PAS LA MÉTHODE GPU** (compter les appels de dessin
// autour d'une passe) : elle rendrait zéro et rassurerait à tort.
//
// LE PROTOCOLE — A/B ALTERNÉ, jamais deux blocs. La machine dérive et l'ordre
// ment : on alterne « poseur de globe » / « poseur plat » N fois et on compare
// les médianes. Le poseur plat est le drapage du dépôt, au bit près.
//
// EMPLOI  node scripts/sonde-cout-carto.mjs --tours 5

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const PORT = arg('--port', '5543')
const TOURS = Number(arg('--tours', '5'))
const ZOOMS = arg('--zooms', '6,8,10,12').split(',').map(Number)

function trouverChrome() {
  const donne = arg('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2 }

const SORTIE = path.join(RACINE, '.banc', 'D16b')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const releve = { quand: new Date().toISOString(), tours: TOURS, lignes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(6000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  // on retient le fabricant vivant pour pouvoir l'ÉTEINDRE et le rallumer
  await page.evaluate(() => {
    const w = window.__exp.mapLayers.water
    window.__fab = w._faitPoseur
  })

  for (const z of ZOOMS) {
    await page.evaluate(async (a) => { await window.__exp.modes.flyTo(45.9237, 6.8694, a) }, z)
    await dodo(9000)
    // ⚠️ un tour à blanc : la première reconstruction paie le réseau (cellules,
    // tuiles de lacs, et l'attente d'Overpass à z12). On la jette.
    await page.evaluate(() => window.__exp.rebuildMapLayers())
    await dodo(7000)
    const l = await page.evaluate(async (a) => {
      const e = window.__exp
      const ml = e.mapLayers
      const mesure = async () => { const t = performance.now(); await e.rebuildMapLayers(); return performance.now() - t }
      const globe = [], plat = []
      for (let i = 0; i < a.tours; i++) {
        ml.poserFabricantDePoseur(window.__fab); globe.push(await mesure())
        ml.poserFabricantDePoseur(null); plat.push(await mesure())
      }
      ml.poserFabricantDePoseur(window.__fab)
      await e.rebuildMapLayers()
      const p = ml.water._poseur
      // le desencombrement, lui, tourne PAR IMAGE (throttlé) : on le chronomètre à part
      const decl = []
      for (let i = 0; i < 40; i++) { const t = performance.now(); ml.places._declutter(); decl.push(performance.now() - t) }
      return {
        zoom: e.params.demZoom, globe, plat, decl,
        sommets: p?.points ?? null, refus: p?.refus ?? null,
        noms: ml.places._entries.length,
      }
    }, { tours: TOURS })
    l.medGlobe = Math.round(med(l.globe) * 10) / 10
    l.medPlat = Math.round(med(l.plat) * 10) / 10
    l.medDecl = Math.round(med(l.decl) * 100) / 100
    releve.lignes.push(l)
    console.log(`z${l.zoom} · reconstruction GLOBE ${l.medGlobe} ms · PLAT ${l.medPlat} ms · écart ${Math.round((l.medGlobe - l.medPlat) * 10) / 10} ms · ${l.sommets} sommets sondés (${l.refus} repliés) · désencombrement ${l.medDecl} ms/appel sur ${l.noms} noms`)
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, 'cout.json')
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f)
}
