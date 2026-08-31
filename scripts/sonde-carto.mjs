// SONDE CARTOGRAPHIE — Tâche D16-b.
//
// Elle répond à UNE question : « les calques `water` et `places` sont-ils
// PEUPLÉS, et sont-ils dans la scène QUI EST RENDUE, à chaque zoom ? »
//
// Elle relève, par lieu et par zoom :
//   · le nombre d'objets dans chaque groupe (peuplé ou non) ;
//   · la SCÈNE d'accueil du groupe (`scene` = bloc plat, plus rendu sous
//     `terre=unique` ; `sceneGlobe` = la seule passe qui dessine) ;
//   · `usingOsm` (le calque a-t-il demandé Overpass) ;
//   · le TEMPS de reconstruction, mesuré côté page (CPU, pas GPU) ;
//   · une capture d'écran.
//
// ⚠️ Le mode sphère est le DÉFAUT : l'adresse est `/`, sans paramètre.
//
// EMPLOI
//   node scripts/sonde-carto.mjs --etiq avant
//   node scripts/sonde-carto.mjs --etiq apres --zooms 6,8,10,12
//   node scripts/sonde-carto.mjs --lieux reunion,chamonix --visible

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d = null) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const ETIQ = arg('--etiq', 'sonde')
const PORT = arg('--port', '5543')
const VISIBLE = process.argv.includes('--visible')
const ZOOMS = arg('--zooms', '6,8,10,12').split(',').map(Number)
const ATTENTE = Number(arg('--attente', '9000'))

const LIEUX = {
  chamonix: { lat: 45.9237, lon: 6.8694, nom: 'Chamonix' },
  reunion: { lat: -21.115, lon: 55.536, nom: 'La Réunion' },
  amazonie: { lat: -3.1, lon: -60.02, nom: 'Amazonie (Manaus)' },
  norvege: { lat: 61.0, lon: 7.0, nom: 'Norvège (Sognefjord)' },
}
const CLES = arg('--lieux', 'chamonix,amazonie').split(',')

function trouverChrome() {
  const donne = arg('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) {
    if (!fs.existsSync(p)) continue
    return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const SORTIE = path.join(RACINE, '.banc', 'D16b')
fs.mkdirSync(SORTIE, { recursive: true })

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader',
    '--window-size=1280,900', '--autoplay-policy=no-user-gesture-required'],
})

const releve = { etiquette: ETIQ, quand: new Date().toISOString(), lignes: [], erreurs: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (e) => releve.erreurs.push(String(e.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.mapLayers,
    { timeout: 90000, polling: 100 })
  await dodo(6000)

  for (const cle of CLES) {
    const lieu = LIEUX[cle]
    if (!lieu) { console.error('lieu inconnu :', cle); continue }
    for (const z of ZOOMS) {
      await page.evaluate(async (a) => { await window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, { ...lieu, z })
      await dodo(ATTENTE)
      // reconstruction CHRONOMÉTRÉE, côté page : c'est du CPU (fetch + cuisson)
      const ligne = await page.evaluate(async () => {
        const e = window.__exp
        const t0 = performance.now()
        await e.rebuildMapLayers()
        const ms = performance.now() - t0
        const nomScene = (o) => {
          let p = o
          while (p.parent) p = p.parent
          if (p === e.sceneGlobe) return 'sceneGlobe'
          if (p === e.scene) return 'scene'
          return 'orpheline'
        }
        const compte = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh || o.isSprite || o.isLine || o.isLineSegments2 || o.isLine2) n++ }); return n }
        const w = e.mapLayers.water, p = e.mapLayers.places
        return {
          zoom: e.params.demZoom, lat: e.params.demLat, lon: e.params.demLon,
          mode: e.modes?.mode,
          msRebuild: Math.round(ms),
          water: { objets: compte(w.group), enfants: w.group.children.length, visible: w.group.visible, scene: nomScene(w.group), osm: !!w.usingOsm },
          places: { objets: compte(p.group), enfants: p.group.children.length, visible: p.group.visible, scene: nomScene(p.group) },
          cropPose: !!e.veilleCrop?.pose,
        }
      })
      ligne.lieu = lieu.nom
      releve.lignes.push(ligne)
      const nom = `${ETIQ}-${cle}-z${z}.png`
      await page.screenshot({ path: path.join(SORTIE, nom) })
      console.log(`${lieu.nom} z${z} → water ${ligne.water.objets} obj (${ligne.water.scene}, vis=${ligne.water.visible}, osm=${ligne.water.osm}) · places ${ligne.places.objets} obj (${ligne.places.scene}, vis=${ligne.places.visible}) · ${ligne.msRebuild} ms`)
    }
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f, '·', releve.erreurs.length, 'erreurs de page')
  if (releve.erreurs.length) console.log(releve.erreurs.slice(0, 5))
}
