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
  leman: { lat: 46.45, lon: 6.5, nom: 'Léman' },
  baikal: { lat: 53.5, lon: 108.0, nom: 'Baïkal' },
}
const CLES = arg('--lieux', 'chamonix,amazonie').split(',')
// ⚠️ Le mode sphère est le DÉFAUT : `--url ''`. `--url '?terre=deux'` ou
// `--url '?frontiere=0'` exercent le régime d'AVANT le chantier, où les calques
// doivent rester dans la scène du bloc et se draper à plat.
const URL_SUFFIXE = arg('--url', '')

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
  await page.goto(`http://localhost:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.mapLayers,
    { timeout: 90000, polling: 100 })
  await dodo(6000)
  // ⚠️ **LE SAS D'ACCUEIL COUVRE L'ÉCRAN.** « Echap — explorer librement » :
  // sans ça, toutes les captures montrent le voile et pas la carte.
  await page.keyboard.press('Escape')
  await dodo(2500)

  for (const cle of CLES) {
    const lieu = LIEUX[cle]
    if (!lieu) { console.error('lieu inconnu :', cle); continue }
    for (const z of ZOOMS) {
      await page.evaluate(async (a) => { await window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, { ...lieu, z })
      await dodo(ATTENTE)
      // ⚠️ **UNE POSE DE CADRAGE, IDENTIQUE À TOUS LES ZOOMS.** `flyTo` laisse la
      // caméra où sa descente la dépose — bas, et pas au même endroit d'un zoom
      // à l'autre : les captures ne seraient pas comparables. On repose donc la
      // vue à trois quarts au-dessus du centre du bloc, en unités de BLOC ; la
      // similitude (`majCameraFond`) la transporte vers le globe toute seule.
      await page.evaluate(() => {
        const e = window.__exp
        e.controls.target.set(0, 0, 0)
        e.camera.position.set(0, 58, 58)
        e.controls.update()
        e.majCameraFond?.()
      })
      await dodo(1800)
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
          // ══════ LE CONTRÔLE QUI DIT SI L'EAU FLOTTE ═══════════════════════
          //
          // Pour un échantillon de sommets du calque d'eau : leur distance à la
          // SURFACE DESSINÉE du globe, en mètres. Une rivière posée vaut
          // quelques dizaines de mètres (la marge `offset`) ; une rivière
          // drapée sur le mauvais champ de hauteurs, des centaines ou des
          // milliers. ⚠️ **C'est ce chiffre, pas l'œil, qui attrape la classe
          // de défaut « conversion d'espace ».**
          drape: (() => {
            const R = 100, UPM = R / 6371000
            const liste = e.globe.tuilesAvecHauteurs?.() ?? []
            if (!liste.length) return null
            const ech = UPM * (e.globe.exaggeration ?? 1)
            const ecarts = []
            let sansCouverture = 0
            const v = new (e.scene.constructor === Object ? Object : Object)()
            e.mapLayers.water.group.traverse((o) => {
              const pos = o.geometry?.attributes?.position ?? o.geometry?.attributes?.instanceStart
              if (!pos) return
              const n = pos.count ?? 0
              for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 40))) {
                const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
                const r = Math.hypot(x, y, z)
                if (!(r > 1)) continue
                const lat = Math.asin(y / r) * 180 / Math.PI
                const lon = Math.atan2(x, z) * 180 / Math.PI
                const h = e.globe.hauteurDessinee(lat, lon, liste)
                if (h == null) { sansCouverture++; continue }
                ecarts.push((r - (R + h * ech)) / ech)
              }
            })
            if (!ecarts.length) return { n: 0, sansCouverture }
            ecarts.sort((a, b) => a - b)
            const q = (f) => ecarts[Math.min(ecarts.length - 1, Math.floor(f * ecarts.length))]
            return {
              n: ecarts.length, sansCouverture,
              minM: Math.round(ecarts[0]), medM: Math.round(q(0.5)),
              p95M: Math.round(q(0.95)), maxM: Math.round(ecarts[ecarts.length - 1]),
            }
          })(),
          nomsVisibles: e.mapLayers.places._entries.filter((x) => x.sprite.visible).length,
          // ⚠️ **LE CHIFFRE QUI FAIT AUTORITÉ SUR LA COUVERTURE**, et il vient du
          // poseur lui-même, pendant la construction — pas d'un ré-échantillonnage
          // d'après coup, qui interroge un globe dont les hauteurs ont pu être
          // relâchées entre-temps.
          poseur: { points: e.mapLayers.water._poseur?.points ?? null, refus: e.mapLayers.water._poseur?.refus ?? null },
        }
      })
      ligne.lieu = lieu.nom
      releve.lignes.push(ligne)
      const nom = `${ETIQ}-${cle}-z${z}.png`
      await page.screenshot({ path: path.join(SORTIE, nom) })
      const d = ligne.drape
      console.log(`   poseur : ${ligne.poseur.points} sommets, ${ligne.poseur.refus} repliés sur le bloc`)
      console.log(`${lieu.nom} z${z} → water ${ligne.water.objets} obj (${ligne.water.scene}, vis=${ligne.water.visible}) · places ${ligne.places.objets} obj, ${ligne.nomsVisibles} lisibles · drapé ${d ? `n=${d.n} med ${d.medM} m, p95 ${d.p95M} m, max ${d.maxM} m, sans couverture ${d.sansCouverture}` : '—'} · ${ligne.msRebuild} ms`)
    }
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f, '·', releve.erreurs.length, 'erreurs de page')
  if (releve.erreurs.length) console.log(releve.erreurs.slice(0, 5))
}
