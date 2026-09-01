// SONDE R23 — LE GESTE DE ROTATION D'UN BOUT À L'AUTRE, ET LA HAUTEUR SOL.
//
// ══════════ CE QU'ELLE MESURE ═══════════════════════════════════════════════
//
//   ① °/px D'AZIMUT, PAR GLISSÉ RÉEL, à N altitudes dans les deux régimes.
//   ② °/px PAR IMAGE, relevé DANS LA BOUCLE (`controls.update` enveloppé), sur
//      une descente complète orbite → bloc — donc le rapport d'une image à la
//      suivante AU FRANCHISSEMENT, qui est le critère chiffré de la tâche.
//   ③ LA HAUTEUR CAMÉRA − SOL par image (`camera.y − terrain.sample(x, z)`),
//      sur la descente ET sur une rotation poussée jusqu'à la butée polaire.
//   ④ |Δ ln(distance caméra→cible)| sur chaque glissé — le signal de
//      `veille-repos` (`SEUIL_BOUGE_LOG = 1e-4`).
//   ⑤ L'INCLINAISON au nadir par image — D16 ter : la bascule de trois quarts
//      arrive AU BLOC, pas avant.
//
// ══════════ LES INSTRUMENTS QUI MENTENT, ET CE QU'ON FAIT CONTRE ════════════
//
// ⛔ **`Input.dispatchMouseEvent` type `mouseWheel` N'ATTEINT PAS L'APPLI** —
// 0 cran sur 175 dans un banc réel. Cette sonde ne le suppose pas : elle
// ENVELOPPE `modes._zoomGesture` d'un compteur, tire N molettes CDP, et publie
// le compte (`temoins.moletteCdp`). La descente, elle, est pilotée par des
// appels DIRECTS à `_zoomGesture` — le code que la molette exécuterait — et le
// même compteur prouve qu'ils arrivent.
//
// ⛔ **LE GLOBE TOURNE TOUT SEUL** à ~2 °/s après 3 s d'inactivité. Les glissés
// sont relevés BOUTON TENU (`controlsHeld` reste vrai, le spin est gelé), et un
// témoin nul bouton tenu le prouve.
//
// ⛔ **UNE SONDE POSÉE APRÈS LA FONCTION LIT UN ÉTAT ÉCRASÉ.** Le °/px par
// image n'est pas relu après coup : `controls.update` est enveloppé, donc la
// valeur relevée est celle qui était EN VIGUEUR quand la loi de rotation s'est
// appliquée.
//
// ⛔ **UN RELEVÉ SUR UNE IMAGE NE PROUVE RIEN.** Chaque palier de glissé est
// relevé après convergence du damping (`--images-repos`), et la descente est
// relevée sur toutes ses images, pas sur celle du franchissement.
//
// EMPLOI
//   node scripts/sonde-vitesse-r23.mjs --port 5811 --etiquette avant
//
// Sort `.banc/R23/<etiquette>.json`.
//
// ⛔ LECTURE SEULE SUR `src/`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R23')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5811'))
const ETIQ = opt('--etiquette', 'geste')
const VISIBLE = opt('--visible', '0') !== '0'
const DX = Number(opt('--dx', '100'))
const REPOS = Number(opt('--images-repos', '150'))
const LARGEUR = Number(opt('--largeur', '1280'))
const HAUTEUR = Number(opt('--hauteur', '800'))

const R2D = 180 / Math.PI

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
  ]
  for (const p of pistes) {
    if (!fs.existsSync(p)) continue
    return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

// ══════════ L'INSTRUMENTATION, POSÉE DANS LA BOUCLE ═════════════════════════
//
// ⚠️ **`controls.update` EST LE SEUL ENDROIT OÙ LA LOI DE ROTATION S'APPLIQUE**
// (`rotateLeft(2π·dx/clientHeight)` avec `rotateDelta ×= rotateSpeed`). On
// relève donc `rotateSpeed` AU MOMENT de l'appel, pas après l'image.
const INSTRUMENTER = `(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera, m = e.modes
  if (window.__r23) return 'deja'
  const T = {
    frames: [],          // un enregistrement par appel de controls.update
    image: 0,            // compteur d'image, incrémenté par notre propre rAF
    zoomGeste: 0,        // appels de _zoomGesture RÉELLEMENT reçus
    actif: false,
  }
  window.__r23 = T
  const majImage = () => { T.image++; requestAnimationFrame(majImage) }
  requestAnimationFrame(majImage)

  const updOrig = c.update.bind(c)
  c.update = function (...a) {
    if (T.actif) {
      const el = e.renderer.domElement
      const t = c.target
      const dx = cam.position.x - t.x, dy = cam.position.y - t.y, dz = cam.position.z - t.z
      const dist = Math.hypot(dx, dy, dz)
      // ⛔ **L'INCLINAISON SE MESURE CONTRE LA VERTICALE LOCALE, ET LE PREMIER
      // JET MESURAIT LA LATITUDE.** En orbite la verticale locale est le RAYON
      // (la caméra est sur la sphère de rayon R+alt, elle vise le centre) :
      // prendre dy/dist rendait 90 moins la colatitude, c'est-a-dire la latitude
      // du point survolé — 21,26° relevés là où D16 ter en attend 0,000057.
      let ux = 0, uy = 1, uz = 0
      if (m.mode === 'orbital') {
        const n = Math.hypot(cam.position.x, cam.position.y, cam.position.z) || 1
        ux = cam.position.x / n; uy = cam.position.y / n; uz = cam.position.z / n
      }
      const cosn = dist > 1e-9 ? (dx * ux + dy * uy + dz * uz) / dist : 1
      const nadir = Math.acos(Math.max(-1, Math.min(1, cosn))) * 180 / Math.PI
      const sol = (m.mode !== 'orbital' && e.terrain && e.terrain.sample)
        ? e.terrain.sample(cam.position.x, cam.position.z) : null
      T.frames.push({
        i: T.image,
        t: performance.now(),
        mode: m.mode,
        busy: !!m.busy,
        rs: c.rotateSpeed,
        h: el.clientHeight,
        // °/px d'azimut : la loi d'OrbitControls, 2π par hauteur d'écran
        degPx: 360 * c.rotateSpeed / el.clientHeight,
        altM: m.altM,
        dist,
        inclinaisonDeg: nadir,   // 0 au nadir, 46,548 en vue de trois quarts
        camY: cam.position.y,
        solY: sol,
        hauteurSol: sol == null ? null : cam.position.y - sol,
        maxPolar: c.maxPolarAngle,
        polar: c.getPolarAngle(),
      })
    }
    return updOrig(...a)
  }

  const zgOrig = m._zoomGesture.bind(m)
  m._zoomGesture = function (ev) { T.zoomGeste++; return zgOrig(ev) }
  return 'pose'
})()`

const LIRE_ETAT = `(() => {
  const e = window.__exp
  if (!e) return { pret: false }
  const c = e.controls, cam = e.camera, m = e.modes
  const dir = new (cam.position.constructor)()
  cam.getWorldDirection(dir)
  const t = c.target
  const off = { x: cam.position.x - t.x, y: cam.position.y - t.y, z: cam.position.z - t.z }
  const dist = Math.hypot(off.x, off.y, off.z)
  let mParUnite = null
  if (m.mode === 'orbital') mParUnite = 6371000 / 100
  else {
    const emprise = m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null
    const span = m.hooks.coteBloc ? m.hooks.coteBloc() : null
    if (emprise > 0 && span > 0) mParUnite = emprise / span
  }
  const sol = (m.mode !== 'orbital' && e.terrain && e.terrain.sample)
    ? e.terrain.sample(cam.position.x, cam.position.z) : null
  return {
    pret: true,
    mode: m.mode, busy: !!m.busy, travel: !!m.travel,
    altM: m.altM, orbAlt: m.orbAlt ?? null,
    cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    target: { x: t.x, y: t.y, z: t.z },
    visee: { x: dir.x, y: dir.y, z: dir.z },
    dist, fovDeg: cam.fov, mParUnite,
    rotateSpeed: c.rotateSpeed,
    hauteurEcran: e.renderer.domElement.clientHeight,
    minPolarDeg: c.minPolarAngle * 180 / Math.PI,
    maxPolarDeg: c.maxPolarAngle * 180 / Math.PI,
    polarDeg: c.getPolarAngle() * 180 / Math.PI,
    azimut: c.getAzimuthalAngle(),
    enabled: c.enabled, enableRotate: c.enableRotate, enablePan: c.enablePan,
    minDistance: c.minDistance, maxDistance: c.maxDistance,
    dampingFactor: c.dampingFactor,
    solY: sol,
    hauteurSol: sol == null ? null : cam.position.y - sol,
    continu: m.hooks.zoomContinu ? !!m.hooks.zoomContinu() : null,
    surLeBloc: m.hooks.surLeBloc ? !!m.hooks.surLeBloc() : null,
    arriveeSurLeBloc: m.hooks.arriveeSurLeBloc ? !!m.hooks.arriveeSurLeBloc() : null,
    reposBascules: e.veilleRepos ? (e.veilleRepos.bascules ?? null) : null,
    auRepos: e.veilleRepos ? !!e.veilleRepos.auRepos : null,
  }
})()`

function angleEntre(a, b) {
  const d = a.x * b.x + a.y * b.y + a.z * b.z
  return Math.acos(Math.max(-1, Math.min(1, d))) * R2D
}

async function attendreImages(page, n) {
  await page.evaluate(
    (k) => new Promise((res) => { let i = 0; const t = () => (++i >= k ? res() : requestAnimationFrame(t)); requestAnimationFrame(t) }),
    n
  )
}

async function lancer() {
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(),
    headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  const journal = { etiquette: ETIQ, port: PORT, dx: DX, viewport: [LARGEUR, HAUTEUR], releves: [], temoins: {} }
  page.on('console', (m) => { if (m.type() === 'error') journal.erreurConsole = (journal.erreurConsole || []).concat([m.text().slice(0, 200)]) })

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.modes && window.__exp.controls)', { timeout: 60000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 120000 })
  await attendreImages(page, 120)
  // ⛔ **LE VOILE D'ACCUEIL MANGE TOUS LES GESTES, PAS SEULEMENT LE PREMIER.**
  // `.ce-hubveil` (z-index 56, `pointer-events: auto`) couvre le canevas tant
  // que `body.ce-hub` est posée : `document.elementFromPoint(640, 400)` rend
  // `BUTTON.ce-wm-btn`, et un compteur posé sur le canevas relève **0
  // `pointerdown` sur 20 gestes tirés**. Le premier jet de cette sonde a mesuré
  // 59,330° d'angle polaire, identique sur SIX relevés à quatre lieux
  // différents — c'était la pose d'ouverture, jamais touchée. On lève le voile,
  // et on VÉRIFIE que le canevas est bien découvert avant de mesurer.
  journal.voile = await page.evaluate(() => {
    const avant = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    document.body.classList.remove('ce-hub')
    document.querySelector('.ce-hubveil')?.remove()
    const apres = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    const nom = (e) => (e ? e.tagName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '') : 'null')
    return { avant: nom(avant), apres: nom(apres) }
  })
  await attendreImages(page, 90) // la barre de l'accueil redescend en ~340 ms
  journal.voile.apresAttente = await page.evaluate(() => {
    const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    return { nom: e ? e.tagName + (typeof e.className === 'string' && e.className ? '.' + e.className.trim() : '') : 'null', canevas: e === window.__exp.renderer.domElement }
  })
  if (!journal.voile.apresAttente.canevas) console.error('⛔ le canevas reste couvert par', journal.voile.apresAttente.nom)
  journal.instrumentation = await page.evaluate(INSTRUMENTER)
  journal.etatOuverture = await page.evaluate(LIRE_ETAT)

  const lire = () => page.evaluate(LIRE_ETAT)
  const CX = Math.round(LARGEUR / 2), CY = Math.round(HAUTEUR / 2)
  const souris = (type, x, y, bouton = 'left', boutons = 1) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: bouton, buttons: boutons, clickCount: type === 'mousePressed' ? 1 : 0 })

  // ══════════ TÉMOIN — LA MOLETTE CDP ATTEINT-ELLE L'APPLI ? ════════════════
  {
    const avant = await page.evaluate('window.__r23.zoomGeste')
    for (let i = 0; i < 40; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: -100, buttons: 0 })
      await attendreImages(page, 1)
    }
    const apres = await page.evaluate('window.__r23.zoomGeste')
    journal.temoins.moletteCdp = { tirees: 40, recues: apres - avant }
  }
  // ══════════ TÉMOIN — L'APPEL DIRECT, LUI, ARRIVE ══════════════════════════
  {
    const avant = await page.evaluate('window.__r23.zoomGeste')
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) window.__exp.modes._zoomGesture({ deltaY: -100, clientX: innerWidth / 2, clientY: innerHeight / 2, preventDefault() {} })
    })
    const apres = await page.evaluate('window.__r23.zoomGeste')
    journal.temoins.appelDirect = { tires: 5, recus: apres - avant }
  }

  async function glisser(dx, dy = 0) {
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const avant = await lire()
    const pas = 10
    for (let i = 1; i <= pas; i++) {
      await souris('mouseMoved', CX + Math.round((dx * i) / pas), CY + Math.round((dy * i) / pas))
      await attendreImages(page, 1)
    }
    await attendreImages(page, REPOS)
    const apres = await lire()
    await souris('mouseReleased', CX + dx, CY + dy, 'left', 0)
    await attendreImages(page, 4)
    return { avant, apres }
  }

  function mesurer(nom, { avant, apres }, dx) {
    const dVisee = angleEntre(avant.visee, apres.visee)
    // ⛔ **L'AZIMUT S'ENROULE, ET LE PREMIER JET NE LE DÉROULAIT PAS.** Sur
    // ]−π, π], un glissé de 100 px (44,7°) qui franchit ±π rendait 3,15225 °/px
    // au lieu de 0,4478 — un chiffre parfaitement plausible de la mauvaise
    // grandeur. Même déroulement que `deltaAzimut` (`monde/pivot-bloc.js`).
    let _d = apres.azimut - avant.azimut
    while (_d > Math.PI) _d -= 2 * Math.PI
    while (_d <= -Math.PI) _d += 2 * Math.PI
    const dAz = Math.abs(_d) * R2D
    const dPol = Math.abs(apres.polarDeg - avant.polarDeg)
    const mpu = avant.mParUnite
    const dPosU = Math.hypot(apres.cam.x - avant.cam.x, apres.cam.y - avant.cam.y, apres.cam.z - avant.cam.z)
    const champU = 2 * avant.dist * Math.tan((avant.fovDeg * Math.PI) / 360)
    return {
      nom, dx, mode: avant.mode, altM: avant.altM,
      distU: avant.dist, mParUnite: mpu,
      rotateSpeed: avant.rotateSpeed,
      hauteurEcran: avant.hauteurEcran,
      degPxLoi: (360 * avant.rotateSpeed) / avant.hauteurEcran,
      dAzimutDeg: dAz, dAzimutDegParPx: dAz / Math.abs(dx),
      dViseeDeg: dVisee, dViseeDegParPx: dVisee / Math.abs(dx),
      dPolaireDeg: dPol,
      dPosUnites: dPosU,
      fractionChampParPx: champU > 0 ? dPosU / champU / Math.abs(dx) : null,
      dLnDistance: Math.abs(Math.log(Math.max(apres.dist, 1e-12) / Math.max(avant.dist, 1e-12))),
      hauteurSolAvant: avant.hauteurSol, hauteurSolApres: apres.hauteurSol,
      maxPolarDeg: avant.maxPolarDeg,
      avant, apres,
    }
  }

  const actif = (v) => page.evaluate((x) => { window.__r23.actif = x }, v)
  const videTrace = () => page.evaluate(() => { const f = window.__r23.frames; window.__r23.frames = []; return f })

  // ══════════ LE BLOC, À L'OUVERTURE ════════════════════════════════════════
  await actif(true)
  journal.releves.push(mesurer('bloc-ouverture', await glisser(DX), DX))

  // ══════════ MONTER EN ORBITE ══════════════════════════════════════════════
  await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
  await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 60000 })
  await attendreImages(page, 90)
  journal.etatOrbite = await lire()

  // ── témoin nul, bouton TENU ───────────────────────────────────────────────
  {
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const a = await lire()
    await attendreImages(page, REPOS)
    const b = await lire()
    await souris('mouseReleased', CX, CY, 'left', 0)
    journal.temoins.nulBoutonTenu = mesurer('temoin-nul-bouton-tenu', { avant: a, apres: b }, 1)
  }
  // ── témoin du spin, bouton relâché ────────────────────────────────────────
  {
    const a = await lire()
    await new Promise((r) => setTimeout(r, 4500))
    const b = await lire()
    const w = mesurer('temoin-spin', { avant: a, apres: b }, 1)
    w.dureeMs = 4500
    journal.temoins.spinInactivite = w
  }

  // ══════════ ① LA TABLE DES °/px — RÉGIME ORBITAL ══════════════════════════
  const paliers = [60000000, 20000000, 10000000, 3000000, 1000000, 300000, 100000, 40000]
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
    const r = mesurer(`orbital-${Math.round(altM / 1000)}km`, await glisser(DX), DX)
    r.consigneAltM = altM
    journal.releves.push(r)
    await page.evaluate(() => { window.__exp.modes._diveArmed = false })
  }

  // ══════════ ② LA DESCENTE COMPLÈTE — °/px PAR IMAGE ═══════════════════════
  // On remonte au sommet, on arme, et on descend PAR L'API DE L'APPLI (le code
  // que la molette exécuterait), une impulsion par image.
  await page.evaluate(() => {
    const m = window.__exp.modes
    m.orbAlt = m.orbAltTarget = 60000000 / (6371000 / 100)
    m._diveArmed = false
  })
  await attendreImages(page, 60)
  await videTrace()
  journal.avantDescente = await lire()
  const compteAvant = await page.evaluate('window.__r23.zoomGeste')
  await page.evaluate(() => new Promise((res) => {
    const m = window.__exp.modes
    m._diveArmed = true
    let n = 0
    const pas = () => {
      n++
      if (m.mode === 'orbital') m._diveArmed = true
      m._zoomGesture({ deltaY: -100, clientX: innerWidth / 2, clientY: innerHeight / 2, preventDefault() {} })
      if (n > 2200 || (m.mode === 'surface' && n > 1400)) return res(n)
      requestAnimationFrame(pas)
    }
    requestAnimationFrame(pas)
  }))
  await attendreImages(page, 60)
  journal.descente = { impulsions: (await page.evaluate('window.__r23.zoomGeste')) - compteAvant }
  await new Promise((r) => setTimeout(r, 4000))
  await attendreImages(page, 120)
  const trace = await videTrace()
  journal.descente.images = trace.length
  journal.descente.trace = trace
  journal.apresDescente = await lire()

  // ══════════ ③ LE BLOC APRÈS LA DESCENTE ══════════════════════════════════
  journal.releves.push(mesurer('bloc-apres-descente', await glisser(DX), DX))
  journal.releves.push(mesurer('bloc-vertical', await glisser(0, DX), DX))

  // ══════════ ④ LA BUTÉE POLAIRE ET LE SOL — EN MONTAGNE, PAS SUR UN LAC ════
  //
  // ⛔ **LE LIEU DE DÉPART EST PLAT, ET UN RELEVÉ FAIT LÀ NE PROUVE RIEN.**
  // Premier jet : `hauteur sol min` rendait le MÊME nombre (0,148189) sur trois
  // gestes différents — le sol sous la caméra ne variait pas d'un centimètre.
  // On mesure donc sur du relief, et on tourne de 360° À LA BUTÉE : le relief
  // n'est pas le même de tous les côtés du bloc.
  journal.sol = {}
  for (const [nom, lat, lon, zoom] of [['Mont-Blanc', 45.8326, 6.8652, 12], ['Cervin', 45.9763, 7.6586, 12], ['Everest', 27.9881, 86.925, 12]]) {
    await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'BANC R23'), { lat, lon, zoom })
    await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 })
    await attendreImages(page, 150)
    for (const facteur of [141, 70, 30, 12, 6]) {
      // ⛔ **DES FACTEURS RELATIFS NE COUVRAIENT QU'UN SEUL CAS.** Premier jet :
      // `[1, 0,5, 0,25, 0,1]` appliqués à une distance qui valait déjà 6 (la
      // butée basse) — les QUATRE relevés portaient sur `d = 6`. On écrit donc
      // des distances ABSOLUES, de la pose d'arrivée (141) à la butée basse.
      await page.evaluate((f) => {
        const e = window.__exp, c = e.controls, cam = e.camera
        const nd = Math.min(c.maxDistance, Math.max(c.minDistance, f))
        const dir = cam.position.clone().sub(c.target).normalize()
        cam.position.copy(c.target).addScaledVector(dir, nd)
        c.update()
      }, facteur)
      await attendreImages(page, 30)
      await videTrace()
      await souris('mouseMoved', CX, CY, 'none', 0)
      await attendreImages(page, 1)
      await souris('mousePressed', CX, CY)
      await attendreImages(page, 2)
      // ── vers l'horizon, bien au-delà de la course : on colle à la butée ──
      for (let i = 1; i <= 30; i++) { await souris('mouseMoved', CX, CY - 20 * i); await attendreImages(page, 2) }
      await attendreImages(page, 60)
      const polarButee = await page.evaluate('window.__exp.controls.getPolarAngle()*180/Math.PI')
      // ── puis 360° d'azimut EN RESTANT à la butée ─────────────────────────
      for (let i = 1; i <= 60; i++) { await souris('mouseMoved', CX + 24 * i, CY - 600); await attendreImages(page, 2) }
      await attendreImages(page, 60)
      await souris('mouseReleased', CX + 1440, CY - 600, 'left', 0)
      await attendreImages(page, 20)
      const tr = await videTrace()
      const st = await lire()
      const h = tr.map((f) => f.hauteurSol).filter((v) => v != null)
      const mpu = st.mParUnite
      const cle = `${nom} d=${facteur}`
      journal.sol[cle] = {
        zoom, distance: st.dist, polarButee, maxPolarDeg: st.maxPolarDeg,
        // ⚠️ **UNE BUTÉE QUI CLAQUE SERAIT UN SAUT DE PLUS.** On relève le pas
        // d'angle polaire d'une image à la suivante : il doit rester sous le
        // plafond de R4 (1,5°/image), sinon le correctif du sol aurait rouvert
        // par l'autre bout ce que la campagne vient de fermer.
        pasPolarMaxDeg: (() => {
          let pire = 0
          for (let i = 1; i < tr.length; i++) if (tr[i].i !== tr[i - 1].i) pire = Math.max(pire, Math.abs(tr[i].polar - tr[i - 1].polar) * R2D)
          return pire
        })(),
        buteeMinDeg: Math.min(...tr.map((f) => f.maxPolar * R2D)),
        buteeMaxDeg: Math.max(...tr.map((f) => f.maxPolar * R2D)),
        mParUnite: mpu, images: tr.length,
        hauteurSolMinU: h.length ? Math.min(...h) : null,
        hauteurSolMinM: h.length && mpu ? Math.min(...h) * mpu : null,
        imagesSousLeSol: h.filter((v) => v < 0).length,
        camYMin: Math.min(...tr.map((f) => f.camY)),
        solYMax: Math.max(...tr.map((f) => (f.solY == null ? -Infinity : f.solY))),
      }
    }
  }

  // ══════════ ⑤ LE SENS INVERSE — REMONTER DU BLOC À L'ORBITE ══════════════
  //
  // ⚠️ **D16 NOMME CE SEGMENT COMME UN ANGLE MORT** (« le sens INVERSE —
  // remonter du bloc à l'orbite ») et personne ne l'avait relevé. Même pilotage
  // que la descente : l'API de l'appli, une impulsion par image, et le compteur
  // prouve qu'elles arrivent.
  journal.remontees = {}
  for (const incline of [false, true]) {
    // ⛔ **ZOOMER DEHORS À LA PENTE D'ARRIVÉE EST LE CAS LE PLUS FAVORABLE, ET
    // CE N'EST PAS CELUI DE L'UTILISATEUR.** À `pente` faible (vue couchée vers
    // l'horizon), `distance = (camY − yCible) / pente` explose : le plafond
    // `maxDistance` est atteint à une altitude bien plus BASSE, et le budget de
    // niveau se fait clipper avant d'être dépensé. On mesure les deux.
    await page.evaluate(() => window.__exp.modes.enterOrbit(2000000))
    await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 90000 })
    await attendreImages(page, 60)
    await page.evaluate(() => new Promise((res) => {
      const m = window.__exp.modes
      let n = 0
      const pas = () => {
        n++
        if (m.mode === 'orbital') m._diveArmed = true
        m._zoomGesture({ deltaY: -100, clientX: innerWidth / 2, clientY: innerHeight / 2, preventDefault() {} })
        if (n > 600 || (m.mode === 'surface' && n > 240)) return res(n)
        requestAnimationFrame(pas)
      }
      requestAnimationFrame(pas)
    }))
    await attendreImages(page, 90)
    if (incline) {
      await souris('mouseMoved', CX, CY, 'none', 0); await attendreImages(page, 1)
      await souris('mousePressed', CX, CY); await attendreImages(page, 2)
      for (let i = 1; i <= 30; i++) { await souris('mouseMoved', CX, CY - 20 * i); await attendreImages(page, 2) }
      await attendreImages(page, 90)
      await souris('mouseReleased', CX, CY - 600, 'left', 0)
      await attendreImages(page, 30)
    }
    await videTrace()
    const depart = await lire()
    const compte = await page.evaluate('window.__r23.zoomGeste')
    const suivi = await page.evaluate(() => new Promise((res) => {
      const e = window.__exp, m = e.modes, c = e.controls
      const tr = []; let n = 0
      const pas = () => {
        n++
        m._zoomGesture({ deltaY: +100, clientX: innerWidth / 2, clientY: innerHeight / 2, preventDefault() {} })
        tr.push([n, +c.getDistance().toFixed(3), +m._levelZoom.toFixed(5), e.params.demZoom, m.mode, Math.round(m.altM), +c.maxDistance.toFixed(1)])
        if (n >= 1500 || m.mode === 'orbital') return res(tr)
        requestAnimationFrame(pas)
      }
      requestAnimationFrame(pas)
    }))
    await attendreImages(page, 60)
    const tr = await videTrace()
    const dern = suivi[suivi.length - 1]
    journal.remontees[incline ? 'couchee-vers-horizon' : 'pente-arrivee'] = {
      polarDepart: depart.polarDeg, altDepartM: depart.altM, distDepart: depart.distU,
      impulsions: (await page.evaluate('window.__r23.zoomGeste')) - compte,
      images: suivi.length,
      atteintOrbite: dern[4] === 'orbital',
      // ⚠️ le SIGNE de la saturation : le niveau ne se dépense plus alors que la
      // distance est collée au plafond
      derniereDistance: dern[1], plafond: dern[6], dernierLevelZoom: dern[2], dernierZoom: dern[3],
      niveaux: suivi.filter((r, i) => i > 0 && (r[3] !== suivi[i - 1][3] || r[4] !== suivi[i - 1][4])),
      trace: suivi,
      traceLoi: tr,
    }
  }

  await actif(false)
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(journal, null, 1), 'utf8')
  await nav.close()
  resume(journal)
  console.log(`\n→ .banc/R23/${ETIQ}.json`)
}

export function resume(journal) {
  const l = (x) => (x == null ? '—' : typeof x === 'number' ? x.toPrecision(6) : String(x))
  console.log(`\n=== R23 — °/px par glissé de ${journal.dx} px ===`)
  console.log('nom                     mode      altM         rotSpeed   dAzim°/px    loi °/px     |Δln d|      haut. sol')
  for (const r of journal.releves) {
    if (r.saute) { console.log(`${r.nom.padEnd(23)} SAUTÉ (${r.saute})`); continue }
    console.log(
      `${r.nom.padEnd(23)} ${String(r.mode).padEnd(9)} ${l(r.altM).padEnd(12)} ${l(r.rotateSpeed).padEnd(10)} ` +
      `${l(r.dAzimutDegParPx).padEnd(12)} ${l(r.degPxLoi).padEnd(12)} ${l(r.dLnDistance).padEnd(12)} ${l(r.hauteurSolAvant)}`
    )
  }
  console.log('\ntémoins :')
  console.log(`  molette CDP : ${journal.temoins.moletteCdp?.recues} reçues sur ${journal.temoins.moletteCdp?.tirees} tirées`)
  console.log(`  appel direct : ${journal.temoins.appelDirect?.recus} reçus sur ${journal.temoins.appelDirect?.tires} tirés`)
  console.log(`  nul bouton tenu : dVisée ${l(journal.temoins.nulBoutonTenu?.dViseeDeg)}°`)
  console.log(`  spin 4,5 s : dVisée ${l(journal.temoins.spinInactivite?.dViseeDeg)}°`)
  analyseDescente(journal)
  console.log('\nbutées :')
  for (const [k, v] of Object.entries(journal.butees || {})) {
    console.log(`  ${k.padEnd(18)} polar ${l(v.polarMax)}° max · maxPolar ${l(v.maxPolarDeg)}° · hauteur sol min ${l(v.hauteurSolMin)}`)
  }
}

export function analyseDescente(journal) {
  const tr = journal.descente?.trace ?? []
  if (!tr.length) { console.log('\ndescente : AUCUNE image'); return null }
  // une valeur par IMAGE : la dernière application de la loi dans l'image
  const parImage = []
  for (const f of tr) {
    const d = parImage[parImage.length - 1]
    if (d && d.i === f.i) { parImage[parImage.length - 1] = { ...f } } else parImage.push({ ...f })
  }
  let pire = { rapport: 1 }
  for (let k = 1; k < parImage.length; k++) {
    const a = parImage[k - 1].degPx, b = parImage[k].degPx
    if (!(a > 0) || !(b > 0)) continue
    const r = Math.max(a / b, b / a)
    if (r > pire.rapport) pire = { rapport: r, i: parImage[k].i, de: a, vers: b, modeA: parImage[k - 1].mode, modeB: parImage[k].mode, altA: parImage[k - 1].altM, altB: parImage[k].altM }
  }
  const iFranchi = parImage.findIndex((f, k) => k > 0 && parImage[k - 1].mode === 'orbital' && f.mode === 'surface')
  const hs = parImage.map((f) => f.hauteurSol).filter((v) => v != null)
  const inclOrb = parImage.filter((f) => f.mode === 'orbital').map((f) => Math.abs(f.inclinaisonDeg))
  const res = {
    images: parImage.length,
    pireRapport: pire,
    franchissement: iFranchi < 0 ? null : {
      image: parImage[iFranchi].i,
      avant: { degPx: parImage[iFranchi - 1].degPx, rs: parImage[iFranchi - 1].rs, altM: parImage[iFranchi - 1].altM },
      apres: { degPx: parImage[iFranchi].degPx, rs: parImage[iFranchi].rs, altM: parImage[iFranchi].altM },
      rapport: Math.max(parImage[iFranchi].degPx / parImage[iFranchi - 1].degPx, parImage[iFranchi - 1].degPx / parImage[iFranchi].degPx),
    },
    hauteurSolMin: hs.length ? Math.min(...hs) : null,
    inclinaisonOrbitaleMax: inclOrb.length ? Math.max(...inclOrb) : null,
  }
  console.log(`\ndescente : ${res.images} images · ${journal.descente.impulsions} impulsions reçues`)
  if (res.franchissement) {
    const f = res.franchissement
    console.log(`  franchissement image ${f.image} : ${f.avant.degPx.toPrecision(6)} → ${f.apres.degPx.toPrecision(6)} °/px  (×${f.rapport.toFixed(3)})`)
    console.log(`      altitude ${Math.round(f.avant.altM)} m → ${Math.round(f.apres.altM)} m · rotateSpeed ${f.avant.rs} → ${f.apres.rs}`)
  } else console.log('  ⛔ pas de franchissement dans la trace')
  console.log(`  pire rapport image à image : ×${res.pireRapport.rapport.toFixed(4)} (image ${res.pireRapport.i}, ${res.pireRapport.modeA}→${res.pireRapport.modeB})`)
  console.log(`  hauteur caméra − sol min : ${res.hauteurSolMin == null ? '—' : res.hauteurSolMin.toFixed(4)}`)
  console.log(`  inclinaison max EN ORBITE (D16 ter) : ${res.inclinaisonOrbitaleMax == null ? '—' : res.inclinaisonOrbitaleMax.toFixed(6)}°`)
  return res
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  lancer().catch((e) => { console.error(e); process.exit(1) })
}
