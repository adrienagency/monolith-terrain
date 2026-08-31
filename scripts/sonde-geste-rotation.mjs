// SONDE R13 — LA RÉPONSE DU GESTE DE ROTATION, DANS LES DEUX RÉGIMES.
//
// ══════════ CE QU'ELLE MESURE, ET POURQUOI CELLE-LÀ ═════════════════════════
//
// Adrien : « le comportement de la rotation de la vue autour de la Terre est
// parfait en mode orbital. Peut-on appliquer celui-là jusqu'au mode crop ? »
//
// Un « comportement de rotation » n'est pas une opinion : c'est un JEU DE
// RAPPORTS mesurables entre le geste (des pixels de souris) et ce que la vue
// fait. La sonde relève, pour un glissé de N pixels, dans chaque régime :
//
//   ① Δ VISÉE      — l'angle dont l'AXE de la caméra tourne, en degrés/pixel.
//                    C'est ce que l'œil voit tourner.
//   ② Δ AZIMUT     — l'angle du repère sphérique d'OrbitControls, deg/px.
//   ③ Δ POSITION   — de combien la caméra se déplace dans l'espace, EN MÈTRES
//                    par pixel (donc converti par le facteur d'échelle du
//                    régime : ORBITAL_M_PER_UNIT en orbite, emprise/span sur
//                    le bloc — ils ne sont PAS les mêmes).
//   ④ Δ VUE AU SOL — le déplacement rapporté au champ visible : combien de
//                    « largeurs d'écran » un pixel de souris fait défiler.
//                    ⚡ C'est la seule grandeur SANS DIMENSION comparable d'un
//                    bout à l'autre, et donc la seule qui puisse dire si un
//                    geste « se sent » pareil.
//   ⑤ LES RÉGLAGES — rotateSpeed, min/maxPolarAngle, dampingFactor,
//                    enablePan/Rotate, la CIBLE, la distance à la cible.
//
// ══════════ LES DEUX PIÈGES DÉJÀ PAYÉS, ET COMMENT ON LES ÉVITE ════════════
//
// ⛔ **LE TÉMOIN NUL N'EST PAS NUL EN ORBITE.** `main.js` fait tourner la
// planète de 0,035 rad/s après 3 s sans entrée. La sonde GARDE LE BOUTON
// ENFONCÉ pendant tout le relevé : `controlsHeld` reste vrai, et la condition
// du spin (`!controlsHeld`) est fausse. Un témoin nul est relevé bouton tenu,
// sans mouvement, pour le prouver — et un second, bouton relâché + 4 s, pour
// montrer ce que la mesure vaudrait sans la précaution.
//
// ⛔ **LE DAMPING ÉTALE LE GESTE SUR ~33 IMAGES** (`dampingFactor = 0.03`).
// Relever une image après le mouvement ne rend que 3 % de l'angle. La sonde
// laisse converger (`--images-repos`) avant de relever l'état d'arrivée.
//
// EMPLOI
//   node scripts/sonde-geste-rotation.mjs --port 5549 --etiquette avant
//   node scripts/sonde-geste-rotation.mjs --port 5549 --visible 1
//
// Sort `.banc/R13/<etiquette>.json`.
//
// ⛔ LECTURE SEULE SUR `src/`. La sonde n'écrit dans la page que des gestes
// (pointeur, molette) et des consignes d'altitude sur `modes.orbAltTarget`,
// que la molette écrirait elle-même.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R13')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5549'))
const ETIQ = opt('--etiquette', 'geste')
const VISIBLE = opt('--visible', '0') !== '0'
const DX = Number(opt('--dx', '100'))
const REPOS = Number(opt('--images-repos', '150'))
const LARGEUR = Number(opt('--largeur', '1280'))
const HAUTEUR = Number(opt('--hauteur', '800'))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
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

// ══════════ L'ÉTAT, TEL QU'IL SE LIT DANS LA PAGE ═══════════════════════════
// Sérialisée et évaluée dans le contexte de la page.
const LIRE_ETAT = `(() => {
  const e = window.__exp
  if (!e) return { pret: false }
  const c = e.controls, cam = e.camera, m = e.modes
  const dir = new (cam.position.constructor)()
  cam.getWorldDirection(dir)
  const t = c.target
  const off = { x: cam.position.x - t.x, y: cam.position.y - t.y, z: cam.position.z - t.z }
  const dist = Math.hypot(off.x, off.y, off.z)
  // le facteur d'échelle du régime : combien de MÈTRES vaut une unité de scène
  let mParUnite = null
  if (m.mode === 'orbital') {
    mParUnite = 6371000 / 100 // ORBITAL_M_PER_UNIT = EARTH_RADIUS_M / R_GLOBE
  } else {
    const emprise = m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null
    const span = m.hooks.coteBloc ? m.hooks.coteBloc() : null
    if (emprise > 0 && span > 0) mParUnite = emprise / span
  }
  return {
    pret: true,
    mode: m.mode, busy: !!m.busy, travel: !!m.travel,
    altM: m.altM,
    orbAlt: m.orbAlt ?? null,
    cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    target: { x: t.x, y: t.y, z: t.z },
    visee: { x: dir.x, y: dir.y, z: dir.z },
    dist,
    fovDeg: cam.fov,
    mParUnite,
    // les réglages qui GOUVERNENT le geste
    rotateSpeed: c.rotateSpeed,
    minPolarAngle: c.minPolarAngle,
    maxPolarAngle: c.maxPolarAngle,
    minAzimuthAngle: c.minAzimuthAngle,
    maxAzimuthAngle: c.maxAzimuthAngle,
    enableDamping: c.enableDamping,
    dampingFactor: c.dampingFactor,
    enabled: c.enabled,
    enableRotate: c.enableRotate,
    enablePan: c.enablePan,
    enableZoom: c.enableZoom,
    panSpeed: c.panSpeed,
    zoomSpeed: c.zoomSpeed,
    screenSpacePanning: c.screenSpacePanning,
    minDistance: c.minDistance,
    maxDistance: c.maxDistance,
    boutons: { LEFT: c.mouseButtons.LEFT, MIDDLE: c.mouseButtons.MIDDLE, RIGHT: c.mouseButtons.RIGHT },
    touches: { ONE: c.touches.ONE, TWO: c.touches.TWO },
    azimut: c.getAzimuthalAngle(),
    // ⚡ le CENTRE DU BLOC à l'écran : la seule grandeur que l'œil juge quand on
    // demande « est-ce que je tourne autour du bloc ? » (voir sonde-cible-rotation)
    // ⛔ **RAPPORTÉ AU CANEVAS, PAS À LA FENÊTRE — ET LE PREMIER JET SE
    // TROMPAIT.** Le Race Studio occupe la moitié gauche de la page : le canevas
    // fait ~720 px de large pour une fenêtre de 1 280. Projeter sur
    // window.innerWidth surestimait toute dérive horizontale d'un facteur 1,78.
    centreBlocEcran: (() => {
      const V = new (cam.position.constructor)(0, 0, 0)
      V.project(cam)
      const r = e.renderer.domElement.getBoundingClientRect()
      return { x: (V.x * 0.5 + 0.5) * r.width, y: (-V.y * 0.5 + 0.5) * r.height, larg: r.width, haut: r.height }
    })(),
    polaire: c.getPolarAngle(),
    attenteTroisQuarts: !!m._attenteTroisQuarts,
    fonduPose: !!m._fonduPose,
    surLeBloc: m.hooks.surLeBloc ? !!m.hooks.surLeBloc() : null,
    arriveeSurLeBloc: m.hooks.arriveeSurLeBloc ? !!m.hooks.arriveeSurLeBloc() : null,
    continu: m.hooks.zoomContinu ? !!m.hooks.zoomContinu() : null,
  }
})()`

const R2D = 180 / Math.PI

function angleEntre(a, b) {
  const d = a.x * b.x + a.y * b.y + a.z * b.z
  return Math.acos(Math.max(-1, Math.min(1, d))) * R2D
}

function main() { return lancer() }

async function lancer() {
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(),
    headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--enable-unsafe-webgpu'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  const journal = { etiquette: ETIQ, port: PORT, dx: DX, imagesRepos: REPOS, viewport: [LARGEUR, HAUTEUR], releves: [], temoins: {} }

  page.on('console', (m) => { if (m.type() === 'error') journal.erreurConsole = (journal.erreurConsole || []).concat([m.text().slice(0, 160)]) })

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.modes && window.__exp.controls)', { timeout: 60000 })
  // ⚠️ **LE VOILE DE CHARGEMENT MANGE LE PREMIER GLISSÉ.** Premier jet de cette
  // sonde : `surface-ouverture` rendait 0,000° pour un glissé de 100 px, pendant
  // que le MÊME glissé rendait 0,382°/px trente secondes plus tard. `#loading`
  // couvre le canevas ; le `pointerdown` n'atteignait pas OrbitControls.
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 90000 })
  // ⚠️ `--r13-off` a servi à produire `.banc/R13/avant-temoin.json` : il posait
  // `window.__R13_OFF` et une garde temporaire de trois mots dans `main.js`
  // court-circuitait `pivoterAutourDuBloc`. **La garde a été retirée après la
  // mesure** (D17 : un drapeau se justifie pour comparer deux états PENDANT un
  // chantier, pas pour rester). Le témoin reste lisible dans le fichier de banc.
  // ⚠️ `--r13-off` a produit `.banc/R13/avant-temoin.json` : il posait
  // `window.__R13_OFF`, qu'une garde temporaire de trois mots dans `main.js`
  // lisait pour court-circuiter `pivoterAutourDuBloc`. **La garde a été retirée
  // après la mesure** — D17 : un drapeau se justifie pour comparer deux états
  // PENDANT un chantier, jamais pour rester. Le témoin reste dans le fichier.
  await attendreImages(page, 120)

  const lire = () => page.evaluate(LIRE_ETAT)

  // ── les gestes, au niveau CDP : de vrais événements d'entrée ──────────────
  const CX = Math.round(LARGEUR / 2), CY = Math.round(HAUTEUR / 2)
  async function souris(type, x, y, bouton = 'left', boutons = 1) {
    await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: bouton, buttons: boutons, clickCount: type === 'mousePressed' ? 1 : 0 })
  }

  /**
   * Un glissé de `dx` pixels, BOUTON TENU du début à la fin du relevé.
   * Le bouton n'est relâché qu'après la lecture d'arrivée : `controlsHeld`
   * reste vrai, donc le spin d'inactivité ne peut pas entrer dans la mesure.
   */
  async function glisser(dx, dy = 0) {
    // ⚠️ un `mouseMoved` AVANT l'appui : sans lui, le premier `pointerdown` de
    // la session n'atteint pas toujours le canevas (pointeur jamais entré).
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const avant = await lire()
    // un mouvement en plusieurs pas, comme une vraie main
    const pas = 10
    for (let i = 1; i <= pas; i++) {
      await souris('mouseMoved', CX + Math.round((dx * i) / pas), CY + Math.round((dy * i) / pas))
      await attendreImages(page, 1)
    }
    await attendreImages(page, REPOS) // laisser le damping converger, bouton TENU
    const apres = await lire()
    await souris('mouseReleased', CX + dx, CY + dy, 'left', 0)
    await attendreImages(page, 4)
    return { avant, apres }
  }

  function mesurer(nom, { avant, apres }, dx) {
    const dVisee = angleEntre(avant.visee, apres.visee)
    const dAz = Math.abs(apres.azimut - avant.azimut) * R2D
    const dPol = Math.abs(apres.polaire - avant.polaire) * R2D
    const dPosU = Math.hypot(apres.cam.x - avant.cam.x, apres.cam.y - avant.cam.y, apres.cam.z - avant.cam.z)
    const dCibleU = Math.hypot(apres.target.x - avant.target.x, apres.target.y - avant.target.y, apres.target.z - avant.target.z)
    const dCentreBlocPx = avant.centreBlocEcran && apres.centreBlocEcran
      ? Math.hypot(apres.centreBlocEcran.x - avant.centreBlocEcran.x, apres.centreBlocEcran.y - avant.centreBlocEcran.y)
      : null
    const mpu = avant.mParUnite
    const dPosM = mpu ? dPosU * mpu : null
    // le champ visible à la distance de la cible : 2·d·tan(fov/2)
    const champU = 2 * avant.dist * Math.tan((avant.fovDeg * Math.PI) / 360)
    const champM = mpu ? champU * mpu : null
    return {
      nom, dx,
      mode: avant.mode,
      altM: avant.altM,
      distU: avant.dist,
      distM: mpu ? avant.dist * mpu : null,
      mParUnite: mpu,
      rotateSpeed: avant.rotateSpeed,
      // ① l'axe de la caméra
      dViseeDeg: dVisee,
      dViseeDegParPx: dVisee / Math.abs(dx),
      // ② le repère sphérique
      dAzimutDeg: dAz, dAzimutDegParPx: dAz / Math.abs(dx),
      dPolaireDeg: dPol,
      // ③ le déplacement
      dPosUnites: dPosU, dPosM, dPosMParPx: dPosM == null ? null : dPosM / Math.abs(dx),
      dCibleUnites: dCibleU,
      dCentreBlocPx,
      // ⚡ la continuité que D16 ter a payée : la distance caméra→cible ne doit
      // pas bouger sous une rotation. `veille-repos` la surveille au seuil 1e-4.
      dLnDistance: Math.abs(Math.log(Math.max(apres.dist, 1e-12) / Math.max(avant.dist, 1e-12))),
      // ④ sans dimension : fraction du champ visible par pixel
      champU, champM,
      fractionChampParPx: champU > 0 ? dPosU / champU / Math.abs(dx) : null,
      avant, apres,
    }
  }

  // ══════════ LE POINT DE DÉPART — ON DÉMARRE SUR LE BLOC ═══════════════════
  // ⚠️ **ET LE BRIEF SE TROMPE EN CROYANT LE CONTRAIRE.** `http://localhost:PORT/`
  // sans paramètre pose `modes.mode === 'surface'` : le « mode sphère » est le
  // RENDU (la Terre en fond, `terre=unique` devenu le défaut), pas le mode de la
  // machine. Le régime orbital s'atteint en DÉZOOMANT. Mesuré, pas supposé :
  // le premier relevé de ce fichier porte l'état d'ouverture.
  journal.etatOuverture = await lire()
  journal.releves.push(mesurer('surface-ouverture', await glisser(DX), DX))

  // ══════════ MONTER EN ORBITE ══════════════════════════════════════════════
  // ⚠️ **PAR LA PORTE DU CODE, PAS PAR 1 200 CRANS DE MOLETTE.** `enterOrbit`
  // est le SEUL chemin d'entrée en orbite (`modes.js:521, 546, 610, 1299`) : la
  // molette y arrive en épuisant les niveaux, elle ne pose pas d'autres réglages.
  // Les mesures des paliers portent donc sur exactement le régime que le geste
  // produit. ⚡ Le FRANCHISSEMENT, lui, est mesuré plus bas au geste réel.
  await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
  await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 60000 })
  await attendreImages(page, 90)
  journal.etatOrbiteAtteinte = await lire()
  if (journal.etatOrbiteAtteinte.mode !== 'orbital') {
    console.error('⛔ orbite jamais atteinte — mode =', journal.etatOrbiteAtteinte.mode)
  }

  // ══════════ TÉMOIN NUL — bouton TENU, aucun mouvement ═════════════════════
  {
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const a = await lire()
    await attendreImages(page, REPOS)
    const b = await lire()
    await souris('mouseReleased', CX, CY, 'left', 0)
    journal.temoins.nulBoutonTenu = mesurer('temoin-nul-bouton-tenu', { avant: a, apres: b }, 1)
  }
  // ══════════ TÉMOIN DU SPIN — bouton RELÂCHÉ, > 3 s ════════════════════════
  // Ce que la mesure vaudrait si on n'avait pas gelé le spin. Il DOIT être gros.
  {
    const a = await lire()
    await new Promise((r) => setTimeout(r, 4500))
    const b = await lire()
    journal.temoins.spinInactivite = mesurer('temoin-spin-inactivite', { avant: a, apres: b }, 1)
    journal.temoins.spinInactivite.dureeMs = 4500
  }

  // ══════════ RÉGIME ORBITAL, À PLUSIEURS ALTITUDES ═════════════════════════
  const paliers = [60000000, 10000000, 1000000, 200000, 60000, 40000]
  for (const altM of paliers) {
    const ok = await page.evaluate((a) => {
      const m = window.__exp.modes
      if (m.mode !== 'orbital') return false
      m.orbAlt = m.orbAltTarget = a / (6371000 / 100)
      m._diveArmed = false
      return true
    }, altM)
    if (!ok) { journal.releves.push({ nom: `orbital-${altM}`, saute: 'plus en orbite' }); continue }
    await attendreImages(page, 40)
    // ⚠️ ré-armer à chaque tour : `update()` réécrit `rotateSpeed` par image
    const r = mesurer(`orbital-${Math.round(altM / 1000)}km`, await glisser(DX), DX)
    r.consigneAltM = altM
    journal.releves.push(r)
    await page.evaluate(() => { window.__exp.modes._diveArmed = false })
  }

  // ── le glissé VERTICAL en orbite, à l'altitude de traversée ──────────────
  journal.releves.push(mesurer('orbital-vertical-40km', await glisser(0, DX), DX))

  // ══════════ LA TRAVERSÉE — descendre à la molette jusqu'au bloc ═══════════
  const avantTraversee = await lire()
  journal.avantTraversee = avantTraversee
  await page.evaluate(() => { window.__exp.modes._diveArmed = true })
  // molette vers l'avant : le geste réel de descente
  for (let i = 0; i < 400; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: -100, buttons: 0 })
    await attendreImages(page, 2)
    const s = await page.evaluate('window.__exp.modes.mode')
    if (s === 'surface') break
  }
  await attendreImages(page, 30)
  journal.justeApresTraversee = await lire()
  // laisser la vue se poser (la bascule de trois quarts tombe au repos)
  await new Promise((r) => setTimeout(r, 4000))
  await attendreImages(page, 60)
  journal.apresPose = await lire()

  // ══════════ RÉGIME SURFACE ════════════════════════════════════════════════
  journal.releves.push(mesurer('surface-arrivee', await glisser(DX), DX))
  // ⚡ **ON DÉCENTRE PAR LE GESTE RÉEL, PAS PAR UN PAN.** Le clic droit en mode
  // continu fait GLISSER la fenêtre de terrain (`boutons-camera.js`) : c'est
  // ainsi que la cible s'éloigne de l'axe du bloc dans la vraie vie. Un pan au
  // clic milieu, lui, enfonce la cible sous le sol (mesuré −10,7 unités) et
  // fabrique une situation qui n'arrive pas.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY, button: 'right', buttons: 2, clickCount: 1 })
  await attendreImages(page, 3)
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX - 14 * i, y: CY - 8 * i, button: 'right', buttons: 2 })
    await attendreImages(page, 2)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX - 168, y: CY - 96, button: 'right', buttons: 0 })
  await attendreImages(page, 200)
  journal.releves.push(mesurer('surface-decentree', await glisser(DX), DX))
  // ── le glissé VERTICAL : c'est lui que la butée polaire arrête (Étape 5) ──
  journal.releves.push(mesurer('surface-vertical', await glisser(0, DX), DX))

  // ══════════ ÉTAPE 5 — LES LIMITES, ET COMMENT ON LES TOUCHE ══════════════
  // ⚠️ **UNE BUTÉE QUI CLAQUE EST UN SAUT COMME UN AUTRE.** On pousse le glissé
  // BIEN AU-DELÀ de la course disponible et on relève l'angle polaire IMAGE PAR
  // IMAGE : le profil dit si la vue s'arrête en douceur ou percute.
  for (const [nom, dy] of [['butee-haute (vers le nadir)', 400], ['butee-basse (vers l’horizon)', -400]]) {
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const suivi = []
    for (let i = 1; i <= 20; i++) {
      await souris('mouseMoved', CX, CY + Math.round((dy * i) / 20))
      const e = await page.evaluate('({p: window.__exp.controls.getPolarAngle(), y: window.__exp.camera.position.y})')
      suivi.push([+(e.p * R2D).toFixed(5), +e.y.toFixed(4)])
      await attendreImages(page, 3)
    }
    for (let i = 0; i < 40; i++) {
      const e = await page.evaluate('({p: window.__exp.controls.getPolarAngle(), y: window.__exp.camera.position.y})')
      suivi.push([+(e.p * R2D).toFixed(5), +e.y.toFixed(4)])
      await attendreImages(page, 3)
    }
    await souris('mouseReleased', CX, CY + dy, 'left', 0)
    await attendreImages(page, 10)
    const pas = []
    for (let i = 1; i < suivi.length; i++) pas.push(Math.abs(suivi[i][0] - suivi[i - 1][0]))
    journal.butees = journal.butees || {}
    journal.butees[nom] = {
      depart: suivi[0][0], arrivee: suivi[suivi.length - 1][0],
      maxPolarDeg: (await lire()).maxPolarAngle * R2D,
      minPolarDeg: (await lire()).minPolarAngle * R2D,
      pasMaxDeg: Math.max(...pas), pasDernier: pas[pas.length - 1],
      suivi,
    }
  }

  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(journal, null, 1), 'utf8')
  await nav.close()

  // ── résumé lisible ────────────────────────────────────────────────────────
  const l = (x) => (x == null ? '—' : typeof x === 'number' ? x.toPrecision(6) : String(x))
  console.log(`\n=== R13 — réponse du geste, glissé de ${DX} px ===`)
  console.log('nom                     mode      altM        rotSpeed  dAzim°/px   dVisee°/px  dPos m/px   frac champ/px  centre bloc px  |Δln d|')
  for (const r of journal.releves) {
    if (r.saute) { console.log(`${r.nom.padEnd(23)} SAUTÉ (${r.saute})`); continue }
    console.log(
      `${r.nom.padEnd(23)} ${String(r.mode).padEnd(9)} ${l(r.altM).padEnd(11)} ${l(r.rotateSpeed).padEnd(9)} ` +
      `${l(r.dAzimutDegParPx).padEnd(11)} ${l(r.dViseeDegParPx).padEnd(11)} ${l(r.dPosMParPx).padEnd(11)} ${l(r.fractionChampParPx).padEnd(14)} ${l(r.dCentreBlocPx).padEnd(12)} ${l(r.dLnDistance)}`
    )
  }
  console.log('\ntémoins :')
  for (const [k, v] of Object.entries(journal.temoins)) {
    console.log(`  ${k.padEnd(22)} dVisée ${l(v.dViseeDeg)}°   dPos ${l(v.dPosUnites)} u`)
  }
  console.log(`\n→ .banc/R13/${ETIQ}.json`)
}

async function attendreImages(page, n) {
  await page.evaluate(
    (k) => new Promise((res) => { let i = 0; const t = () => (++i >= k ? res() : requestAnimationFrame(t)); requestAnimationFrame(t) }),
    n
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
