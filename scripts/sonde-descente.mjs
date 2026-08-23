// SONDE DE DESCENTE — LA DESCENTE INSTRUMENTÉE, IMAGE PAR IMAGE.
//
// ══════════ CE QU'IL MESURE, ET POURQUOI CELUI-CI ET PAS UN AUTRE ═══════════
//
// La Tâche M avait mesuré la descente et conclu « aucun saut de caméra ». Sa
// mesure portait sur l'ALTITUDE et sur le rapport d'une image à l'autre. Deux
// choses lui échappaient par construction :
//
//   · **l'ORIENTATION de la caméra.** Une caméra qui bascule du nadir à
//     l'oblique sans bouger d'un mètre garde son altitude ET son rapport
//     d'altitude. Le saut qu'Adrien filme est là.
//   · **le CONTENU.** `uCropOn` vaut 0 ou 1 ; le crop ne paraît pas, il surgit.
//     Aucune grandeur de caméra ne peut le voir.
//
// Ce banc enregistre donc, à CHAQUE image de rendu :
//   alt (altitudeCadrageM), dist (distanceCadrageM), la direction de visée en
//   coordonnées monde, **l'inclinaison au nadir LOCAL** (voir plus bas),
//   `uCropOn`, `veilleCrop.pose`, `.bascules`, le mode, `modes.busy`,
//   l'estompage, et le zoom du bloc.
//
// ⚠️ **L'INCLINAISON EST LA GRANDEUR QUI COMPTE, ET ELLE EST COMPARABLE ENTRE
// LES DEUX RÉGIMES.** C'est l'angle entre la direction de visée et le « bas »
// LOCAL :
//   · en orbite, le bas local est `-position.normalisée` (la caméra est sur une
//     sphère centrée à l'origine) ;
//   · en surface, le monde est Y-haut (`camera.up = (0,1,0)`,
//     `controls.maxPolarAngle = π×0,49`), donc le bas local est `(0,-1,0)`.
// 0° = visée au nadir (« à la verticale »), 90° = visée à l'horizontale
// (« rasante »). Un écart d'une image à l'autre EST le saut de pose.
//
// ⚠️ **LE CONDENSÉ D'IMAGE PASSE PAR `Page.captureScreenshot`, PAS PAR
// `readPixels`.** `preserveDrawingBuffer` est faux et `autoClear` aussi : lire
// le tampon depuis une autre image rendrait du vide. Chrome sans tête, lui,
// composite (patron de `scripts/sonde-demarrage.mjs`).
//
// EMPLOI
//   node scripts/sonde-descente.mjs                       # depuis MAX_ALT_M (60 000 km)
//   node scripts/sonde-descente.mjs --depart 1600000      # depuis 1 600 km (la Tâche M)
//   node scripts/sonde-descente.mjs --etiquette apres     # nomme la trace
//   node scripts/sonde-descente.mjs --port 5503 --images 1
//
// Sort : `.banc/R4/<etiquette>.json` (une ligne par image) et, si `--images 1`,
// `.banc/R4/img-<etiquette>/*.png`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ **LES TRACES VONT DANS `.banc/R4/`, LE SCRIPT VIT DANS `scripts/`.**
// `.banc/` est ignoré par git (« bancs de mesure jetables ») : y laisser
// l'instrument, c'est le perdre au prochain nettoyage — et ce chantier a huit
// rapports d'affilée qui n'ont pas su mesurer faute d'instrument.
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R4')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5503'))
const DEPART_M = Number(opt('--depart', '60000000'))
const ETIQ = opt('--etiquette', 'descente')
const IMAGES = opt('--images', '1') !== '0'
const CRANS = Number(opt('--crans', '160'))
const PERIODE = Number(opt('--periode', '160')) // ms entre deux crans de molette
const URL_SUFFIXE = opt('--url', '?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}

// puppeteer-core n'est pas une dépendance du produit (même règle que
// `scripts/sonde-demarrage.mjs`). On le prend là où il est installé.
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
  console.error('puppeteer-core introuvable. `npm i -D puppeteer-core`, ou pointe une autre copie.')
  process.exit(2)
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required'],
})

const sortie = { etiquette: ETIQ, departM: DEPART_M, url: URL_SUFFIXE, images: [] }
const dossierImg = path.join(ICI, `img-${ETIQ}`)
if (IMAGES) fs.mkdirSync(dossierImg, { recursive: true })

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 60000, polling: 100 })
  // laisser le premier dessin et le premier bloc arriver
  await new Promise((r) => setTimeout(r, 6000))
  // ⚠️ **L'ÉCRAN D'ACCUEIL RECOUVRE TOUT, ET IL FAUSSAIT LA MESURE D'IMAGE.**
  // Il porte un `backdrop-filter`, donc la scène derrière est floutée et
  // délavée : les premières captures de ce banc rendaient 215 de luminance
  // moyenne pour un écran… d'accueil. Adrien filme SANS lui (« Echap —
  // explorer librement »). On appuie donc sur Échap, et on vérifie qu'il est
  // parti au lieu de l'espérer.
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 1500))
  const accueil = await page.evaluate(() => {
    const el = document.elementFromPoint(640, 400)
    return el ? el.tagName + '.' + (el.className || '') : 'rien'
  })
  if (!/CANVAS/i.test(accueil)) console.log(`⚠️ le centre de la vue n'est pas le canvas mais ${accueil}`)

  // ── L'INSTRUMENT ─────────────────────────────────────────────────────────
  // Il s'installe DANS la page et échantillonne à chaque image d'animation.
  // ⚠️ On ne touche à rien : lecture seule, aucun uniforme écrit.
  await page.evaluate(() => {
    const e = window.__exp
    window.__banc = { lignes: [], on: true, marque: '' }
    const dir = new (window.THREE?.Vector3 ?? Object)()
    const lireUniforme = () => {
      // `uCropOn` vit sur les uniformes partagés du globe. On le cherche là où
      // `globe.js` le pose, sans supposer une profondeur.
      const g = e.globe
      const u = g?.uniforms ?? g?._uniforms ?? null
      if (u && u.uCropOn) return u.uCropOn.value
      return null
    }
    const boucle = () => {
      if (!window.__banc.on) return
      requestAnimationFrame(boucle)
      try {
        const cam = e.camera
        const v = new cam.position.constructor(0, 0, -1).applyQuaternion(cam.quaternion).normalize()
        const p = cam.position
        const mode = e.modes?.mode ?? '?'
        // le « bas » LOCAL : centre de la planète en orbite, -Y en surface
        let bx = 0, by = -1, bz = 0
        if (mode === 'orbital') {
          const n = Math.hypot(p.x, p.y, p.z) || 1
          bx = -p.x / n; by = -p.y / n; bz = -p.z / n
        }
        const cos = Math.max(-1, Math.min(1, v.x * bx + v.y * by + v.z * bz))
        const t = e.controls?.target
        window.__banc.lignes.push({
          t: Math.round(performance.now()),
          mode,
          busy: !!e.modes?.busy,
          alt: e.altitudeCadrageM?.() ?? null,
          dist: e.distanceCadrageM?.() ?? null,
          altM: e.modes?.altM ?? null,
          incl: (Math.acos(cos) * 180) / Math.PI,
          vx: v.x, vy: v.y, vz: v.z,
          px: p.x, py: p.y, pz: p.z,
          tx: t?.x ?? null, ty: t?.y ?? null, tz: t?.z ?? null,
          upy: e.camera.up.y,
          cropOn: lireUniforme(),
          pose: !!e.veilleCrop?.pose,
          bascules: e.veilleCrop?.bascules ?? null,
          repos: !!e.veilleCrop?.repos,
          estompe: e.veilleEstompage?.valeur ?? null,
          zoom: e.dem?.zoom ?? null,
          marque: window.__banc.marque,
        })
        window.__banc.marque = ''
      } catch (err) { window.__banc.lignes.push({ err: String(err).slice(0, 120) }) }
    }
    requestAnimationFrame(boucle)
  })

  // ── LE DÉPART : L'ORBITE, À L'ALTITUDE DEMANDÉE ─────────────────────────
  await page.evaluate((altM) => {
    const m = window.__exp.modes
    m.enterOrbit(altM)
    window.__banc.marque = 'orbite'
  }, DEPART_M)
  await new Promise((r) => setTimeout(r, 3000))
  // `enterOrbit` amortit ; on force la valeur atteinte pour partir NET du haut
  await page.evaluate((altM) => {
    const m = window.__exp.modes
    const parUnite = m.orbAlt > 0 && m.altM > 0 ? m.altM / m.orbAlt : null
    if (parUnite) { m.orbAlt = m.orbAltTarget = altM / parUnite }
  }, DEPART_M)
  await new Promise((r) => setTimeout(r, 1500))

  const client = await page.createCDPSession()

  let nImg = 0
  const t0 = Date.now()

  for (let i = 0; i < CRANS; i++) {
    // ⚠️ **L'ÉVÉNEMENT PART SUR LE CANVAS, PAS SUR LE POINT DE L'ÉCRAN.**
    // `Input.dispatchMouseEvent` vise le PIXEL : au centre de la vue, ce pixel
    // porte un bouton d'interface (`document.elementFromPoint(640,400)` rend
    // `BUTTON.ce-wm-btn`), et `modes.js` écoute sur `renderer.domElement`. Un
    // bouton qui n'est pas un descendant du canvas ne fait pas remonter la
    // molette jusqu'à lui : mesuré, **120 crans, zéro mouvement**. On dispatche
    // donc sur l'écouteur réel — c'est le même chemin de code, sans le hasard
    // de la mise en page.
    await page.evaluate((n) => {
      const el = window.__exp.renderer.domElement
      el.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120, clientX: 640, clientY: 400, bubbles: true, cancelable: true,
      }))
      window.__banc.marque = 'molette' + n
    }, i)
    await new Promise((r) => setTimeout(r, PERIODE))
    if (IMAGES && i % 4 === 0) {
      const b = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const alt = await page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? 0)
      fs.writeFileSync(path.join(dossierImg, `${String(nImg).padStart(3, '0')}-c${i}-alt${Math.round(alt)}.png`), Buffer.from(b.data, 'base64'))
      nImg++
    }
    const fini = await page.evaluate(() => (window.__exp.altitudeCadrageM?.() ?? 1e9) < 2500 && window.__exp.modes?.mode === 'surface')
    if (fini) break
  }

  await new Promise((r) => setTimeout(r, 2000))
  const lignes = await page.evaluate(() => { window.__banc.on = false; return window.__banc.lignes })
  sortie.images = lignes
  sortie.erreurs = erreurs
  sortie.dureeMs = Date.now() - t0
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(sortie))
  console.log(`${lignes.length} images enregistrées → .banc/R4/${ETIQ}.json`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs de page : ${erreurs.slice(0, 3).join(' | ')}`)
} finally {
  await nav.close()
}
