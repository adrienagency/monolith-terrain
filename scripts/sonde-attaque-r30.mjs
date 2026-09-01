// SONDE R30 — L'ATTAQUE DE LA CHAÎNE CAMÉRA, AU GESTE RÉEL.
//
// ══════════ CE QUI LA DISTINGUE DES BANCS DE R23 ET R27 ════════════════════
//
// ⛔ **R23 ET R27 PILOTENT PAR L'API** (`modes.cranZoom`, `modes.enterOrbit`).
// Cette sonde envoie des ÉVÉNEMENTS SOURIS par CDP — `page.mouse.wheel`,
// `mouse.down/move/up` — et ne touche `modes` que pour LIRE. Le seul appel
// d'API autorisé est le repositionnement de départ (`flyTo`), qui n'est pas
// mesuré.
//
// ⛔ **LE VOILE D'ACCUEIL MANGE TOUS LES GESTES** (`.ce-hubveil`) — rétractation
// de R23. On le ferme AVANT toute mesure, et on le vérifie.
//
// Tout est relevé **DANS la boucle** : `controls.update` est enveloppé, et les
// quatre fonctions de la chaîne de zoom (`_zoomGesture`, `_applyZoom`,
// `cranZoom`, `_franchirSiBesoin`) sont tracées à l'ENTRÉE et à la SORTIE, avec
// leurs grandeurs internes. C'est le §Q1 : « chiffre le chemin réellement
// emprunté par un cran de molette, fonction par fonction ».
//
//   node scripts/sonde-attaque-r30.mjs --port 5931 --manche repro
//
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R30')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5931'))
const MANCHE = opt('--manche', 'repro')
const W = 1280, H = 800

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const console_erreurs = []
page.on('console', (m) => { if (m.type() === 'error') console_erreurs.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => console_erreurs.push('PAGEERROR ' + String(e).slice(0, 300)))
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 240000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
// ⚠️ **LA MANCHE `voile` MESURE JUSTEMENT L'ÉTAT VOILE LEVÉ** : c'est la seule
// où l'on ne ferme rien, parce que c'est cet état-là qui est le sujet.
const GARDER_VOILE = MANCHE === 'voile'
if (!GARDER_VOILE) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
}
await wait(60)

// ⚠️ LA GARDE DU VOILE : si `elementFromPoint` au centre n'est pas le canevas,
// le geste n'atteint pas l'application et TOUTE la mesure est fausse.
const gardeVoile = await page.evaluate(() => {
  const el = document.elementFromPoint(640, 400)
  return { tag: el ? el.tagName : null, cls: el ? String(el.className).slice(0, 80) : null }
})
if (!GARDER_VOILE && gardeVoile.tag !== 'CANVAS') {
  console.error('⛔ VOILE ENCORE LÀ — elementFromPoint(640,400) =', gardeVoile)
  await nav.close(); process.exit(2)
}

// ══════════ L'ENREGISTREUR, DANS LA BOUCLE ════════════════════════════════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera, m = e.modes
  const T = {
    on: false, tag: '', frames: [], appels: [], image: 0,
    nZoomGesture: 0, nApplyZoom: 0, nCranZoom: 0, nFranchir: 0,
    nRefine: 0, nCoarsen: 0, nEnterOrbit: 0, nRescale: 0, nResetZoom: 0,
    tracerAppels: false,
  }
  window.__R30 = T
  const maj = () => { T.image++; requestAnimationFrame(maj) }
  requestAnimationFrame(maj)

  const mpu = () => {
    if (m.mode === 'orbital') return 6371000 / 100
    const emp = m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null
    const span = m.hooks.coteBloc ? m.hooks.coteBloc() : null
    return (emp > 0 && span > 0) ? emp / span : null
  }
  const inclinaisonDeg = () => {
    const dx = cam.position.x - c.target.x, dy = cam.position.y - c.target.y, dz = cam.position.z - c.target.z
    const dist = Math.hypot(dx, dy, dz)
    let ux = 0, uy = 1, uz = 0
    if (m.mode === 'orbital') {
      const n = Math.hypot(cam.position.x, cam.position.y, cam.position.z) || 1
      ux = cam.position.x / n; uy = cam.position.y / n; uz = cam.position.z / n
    }
    const cs = dist > 1e-9 ? (dx * ux + dy * uy + dz * uz) / dist : 1
    return Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI
  }
  // ⚡ **LE CHIFFRE QUI TRANCHE EST EN PIXELS** — R27 §① l'écrit ainsi, et
  // publie 188,7 px. On projette donc l'AXE du centre de la Terre (`x=z=0`, à
  // la hauteur de la cible) et on rend son écart au centre de l'écran.
  const T3 = cam.position.constructor
  const projPx = (x, y, z) => {
    const V = new T3(x, y, z); V.project(cam)
    const r = e.renderer.domElement.getBoundingClientRect()
    return [(V.x * 0.5 + 0.5) * r.width, (-V.y * 0.5 + 0.5) * r.height]
  }
  window.__R30.instant = () => {
    const g = e.globe
    const sol = (m.mode !== 'orbital' && e.terrain && e.terrain.sample) ? e.terrain.sample(cam.position.x, cam.position.z) : null
    return {
      i: T.image, tag: T.tag, mode: m.mode, busy: !!m.busy, fondu: !!m._fonduPose,
      altM: e.altitudeCadrageM ? e.altitudeCadrageM() : null, altModeM: m.altM,
      emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
      zoom: e.params ? e.params.demZoom : null,
      crop: !!(g && g._crop), cropPose: !!(e.veilleCrop && e.veilleCrop.pose),
      d: Math.hypot(cam.position.x - c.target.x, cam.position.y - c.target.y, cam.position.z - c.target.z),
      dmin: c.minDistance, dmax: c.maxDistance,
      niveau: m.zoomNiveau ? m.zoomNiveau() : null,
      zoomVel: m._zoomVel,
      tx: c.target.x, ty: c.target.y, tz: c.target.z,
      ecartAxe: Math.hypot(c.target.x, c.target.z),
      pAxe: projPx(0, c.target.y, 0),
      pCentreEcran: [e.renderer.domElement.clientWidth / 2, e.renderer.domElement.clientHeight / 2],
      cx: cam.position.x, cy: cam.position.y, cz: cam.position.z,
      phi: c.getPolarAngle() * 180 / Math.PI, az: c.getAzimuthalAngle(),
      maxPhi: c.maxPolarAngle * 180 / Math.PI,
      incl: inclinaisonDeg(),
      rs: c.rotateSpeed,
      degPx: 360 * c.rotateSpeed / e.renderer.domElement.clientHeight,
      solY: sol, hauteurSol: sol == null ? null : cam.position.y - sol,
      mpu: mpu(),
      repos: !!(e.veilleRepos && e.veilleRepos.auRepos),
      basculesRepos: e.veilleRepos ? e.veilleRepos.bascules : null,
      // ⚡ CE QUI EST ÉCRIT À L'ÉCRAN — la seule altitude qu'un utilisateur lit.
      altimetre: m.altValueEl ? m.altValueEl.textContent : null,
      voile: document.querySelectorAll('.ce-hubveil').length,
      sousLeCurseur: (() => { const el = document.elementFromPoint(640, 400); return el ? el.tagName + '.' + String(el.className).slice(0, 40) : null })(),
    }
  }

  const updOrig = c.update.bind(c)
  c.update = function (...a) {
    if (T.on) T.frames.push(window.__R30.instant())
    return updOrig(...a)
  }

  // ══════ LA CHAÎNE DE ZOOM, FONCTION PAR FONCTION ════════════════════════
  const tracer = (nom, avant, apres) => {
    if (!T.tracerAppels) return
    T.appels.push({ i: T.image, tag: T.tag, nom, avant, apres })
  }
  const capsule = () => ({
    d: Math.hypot(cam.position.x - c.target.x, cam.position.y - c.target.y, cam.position.z - c.target.z),
    niveau: m._levelZoom, vel: m._zoomVel, dmax: c.maxDistance, dmin: c.minDistance,
    zoom: e.params ? e.params.demZoom : null, mode: m.mode, busy: !!m.busy,
    altM: e.altitudeCadrageM ? e.altitudeCadrageM() : null,
    emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
    crop: !!(e.globe && e.globe._crop),
  })
  const enveloppe = (nom, cle) => {
    const orig = m[nom].bind(m)
    m[nom] = function (...a) {
      T[cle]++
      const av = capsule()
      const r = orig(...a)
      tracer(nom, av, capsule())
      return r
    }
  }
  enveloppe('_zoomGesture', 'nZoomGesture')
  enveloppe('_applyZoom', 'nApplyZoom')
  enveloppe('cranZoom', 'nCranZoom')
  enveloppe('_franchirSiBesoin', 'nFranchir')
  enveloppe('_refine', 'nRefine')
  enveloppe('_coarsen', 'nCoarsen')
  enveloppe('enterOrbit', 'nEnterOrbit')
  enveloppe('_resetZoom', 'nResetZoom')
  if (typeof m._rescale === 'function') enveloppe('_rescale', 'nRescale')
})

const on = (t) => page.evaluate((x) => { window.__R30.on = true; window.__R30.tag = x }, t)
const off = () => page.evaluate(() => { window.__R30.on = false })
const tag = (t) => page.evaluate((x) => { window.__R30.tag = x }, t)
const tracerOn = () => page.evaluate(() => { window.__R30.tracerAppels = true })
const tracerOff = () => page.evaluate(() => { window.__R30.tracerAppels = false })
const etat = () => page.evaluate(() => window.__R30.instant())
const compteurs = () => page.evaluate(() => {
  const T = window.__R30
  return { nZoomGesture: T.nZoomGesture, nApplyZoom: T.nApplyZoom, nCranZoom: T.nCranZoom, nFranchir: T.nFranchir, nRefine: T.nRefine, nCoarsen: T.nCoarsen, nEnterOrbit: T.nEnterOrbit, nResetZoom: T.nResetZoom, nRescale: T.nRescale }
})

// ── LES GESTES, À LA SOURIS ────────────────────────────────────────────────
// ⚠️ **LE CURSEUR N'EST PAS AU CENTRE CHEZ UN UTILISATEUR**, et `_applyZoom`
// met à l'échelle la scène AUTOUR du point sous le curseur (`_zoomPivot`) : la
// CIBLE bouge avec lui. Un banc qui garde le curseur à (640,400) mesure le seul
// cas où le pivot est le centre du bloc. `--x/--y` déplacent le curseur.
const CURX = Number(opt('--x', '640')), CURY = Number(opt('--y', '400'))
const molette = async (dy, n = 1, pause = 4, x = CURX, y = CURY) => {
  for (let k = 0; k < n; k++) {
    await page.mouse.move(x, y)
    await page.mouse.wheel({ deltaY: dy })
    if (pause > 0) await wait(pause)
  }
}
// glissé BOUTON TENU du début à la fin (le globe tourne seul après 3 s
// d'inactivité : relâcher entre deux pas fait entrer la rotation automatique)
const glisse = async (x0, y0, dx, dy, pas = 20, pause = 2) => {
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let k = 1; k <= pas; k++) {
    await page.mouse.move(x0 + (dx * k) / pas, y0 + (dy * k) / pas)
    await wait(pause)
  }
  await page.mouse.up()
}
const calme = async (n = 40) => { await wait(n) }

const sortie = { manche: MANCHE, port: PORT, gardeVoile }

// ══════════════════════════════════════════════════════════════════════════
// LA DESCENTE À LA MOLETTE, COMME UN UTILISATEUR — jusqu'au crop.
// ══════════════════════════════════════════════════════════════════════════
async function descendreALaMolette(limite = 400) {
  const jalons = []
  for (let i = 0; i < limite; i++) {
    await molette(-120, 1, 5)
    const s = await etat()
    if (i % 10 === 0) jalons.push(s)
    if (s.busy) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(12) }
    if (s.mode === 'surface' && s.crop) { jalons.push(s); return { jalons, atteint: true, crans: i + 1 } }
  }
  jalons.push(await etat())
  return { jalons, atteint: false, crans: limite }
}

// ⛔ **COUCHER LA VUE VERS L'HORIZON, ET LE SENS EST LA MOITIÉ DU GESTE.**
// `OrbitControls.rotateUp(2π·dy/h)` : la souris qui DESCEND fait tomber `φ`
// vers 0 (le nadir), la souris qui MONTE le pousse vers `maxPolarAngle`. Mon
// premier jet glissait vers le bas et rendait **φ = 0,000°** — c'est-à-dire la
// pente d'arrivée, exactement le cas favorable de R23 et le seul que R27 ait
// mesuré. On glisse donc du BAS vers le HAUT, et on VÉRIFIE `φ` après.
async function coucherVersLHorizon(tours = 8) {
  const pas = []
  for (let k = 0; k < tours; k++) {
    await glisse(640, 640, 0, -420, 34, 2)
    await calme(10)
    pas.push(await etat())
  }
  return pas
}

if (MANCHE === 'repro') {
  // ①  descendre au crop, à la molette
  await on('descente-molette')
  const desc = await descendreALaMolette()
  await calme(90)
  await tag('pose-crop')
  await calme(40)
  sortie.descente = desc
  sortie.auCrop = await etat()

  // ②  COUCHER LA VUE VERS L'HORIZON — le geste que R23 décrit comme le seul
  //    qui reproduit le défaut, et que R27 n'a jamais fait.
  await tag('coucher')
  sortie.pasCoucher = await coucherVersLHorizon(8)
  await calme(60)
  sortie.couchee = await etat()

  // ③  HUIT CRANS DE BOUTON (`cranZoom(-1)`) — le geste d'Adrien, à l'API,
  //    parce que le bouton de l'interface appelle exactement ça.
  await tag('huit-crans')
  await tracerOn()
  const cransBouton = []
  for (let k = 0; k < 8; k++) {
    await page.evaluate(() => window.__exp.modes.cranZoom(-1))
    await wait(10)
    const b = await page.evaluate(() => !!window.__exp.modes.busy)
    if (b) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(20) }
    cransBouton.push(await etat())
  }
  await tracerOff()
  sortie.cransBouton = cransBouton
  await calme(40)
  sortie.apresHuitCrans = await etat()

  // ④  TRENTE-DEUX CRANS DE MOLETTE, CONTINUS
  await tag('molette-32')
  await tracerOn()
  const avant32 = await etat()
  await molette(120, 32, 4)
  await calme(120)
  await tracerOff()
  sortie.molette32 = { avant: avant32, apres: await etat() }

  // ⑤  ET ON INSISTE : 200 crans de molette de plus. Un utilisateur insiste.
  await tag('molette-200')
  await molette(120, 200, 3)
  await calme(150)
  sortie.molette200 = await etat()
  await off()
  sortie.compteurs = await compteurs()
  sortie.appels = await page.evaluate(() => window.__R30.appels)
  sortie.frames = await page.evaluate(() => window.__R30.frames)
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `molette` — LE GESTE D'UTILISATEUR PUR : plus une seule ligne d'API
// de zoom. On descend à la molette, on couche la vue au glissé, on dézoome à
// la molette, un cran à la fois, et on relève l'état APRÈS CHAQUE CRAN.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'molette') {
  const COUCHER = opt('--coucher', '1') !== '0'
  sortie.coucher = COUCHER
  await on('depart')
  sortie.depart = await etat()
  await calme(60)
  sortie.auCrop = await etat()
  if (COUCHER) {
    await tag('coucher')
    sortie.pasCoucher = await coucherVersLHorizon(8)
    await calme(60)
  }
  sortie.couchee = await etat()
  await tag('dezoom-molette')
  await tracerOn()
  const PAUSE = Number(opt('--pause', '6'))
  const RAFALE = Number(opt('--rafale', '1')) // crans envoyés d'affilée, sans image entre eux
  sortie.cadence = { pause: PAUSE, rafale: RAFALE, x: CURX, y: CURY }
  const crans = []
  for (let k = 0; k < 400; k++) {
    await molette(120, RAFALE, 0)
    if (PAUSE > 0) await wait(PAUSE)
    const s = await etat()
    crans.push(s)
    if (s.mode === 'orbital') break
  }
  await tracerOff()
  await calme(120)
  sortie.crans = crans
  sortie.final = await etat()
  await off()
  sortie.compteurs = await compteurs()
  sortie.appels = await page.evaluate(() => window.__R30.appels)
  sortie.frames = await page.evaluate(() => window.__R30.frames)
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `depart` — LA POSE D'OUVERTURE, SANS UN SEUL GESTE.
// ⚠️ Le globe tourne seul après 3 s d'inactivité : on relève à trois instants
// et on publie les trois, au lieu d'un relevé unique qui ne décide de rien.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'depart') {
  await on('depart')
  sortie.t0 = await etat()
  await calme(60); sortie.t60 = await etat()
  await calme(240); sortie.t300 = await etat()
  await calme(600); sortie.t900 = await etat()
  // vingt images consécutives, pour la stabilité que le brief exige
  const vingt = []
  for (let k = 0; k < 20; k++) { await wait(1); vingt.push(await etat()) }
  sortie.vingt = vingt
  await off()
  sortie.frames = await page.evaluate(() => window.__R30.frames)
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `chasse` — LA CHASSE À `d = 150`. Plusieurs combinaisons de geste
// dans UNE page, chacune ramenée à la pose d'ouverture par un rechargement de
// l'escalier. On relève, pour chacune : `d` maximal atteint, l'orbite est-elle
// atteinte, et en combien de crans.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'chasse') {
  const combos = [
    { nom: 'centre-nadir', coucher: 0, x: 640, y: 400, pause: 6 },
    { nom: 'horizon-ciel', coucher: 8, x: 640, y: 90, pause: 6 },
    { nom: 'horizon-bas', coucher: 8, x: 640, y: 700, pause: 6 },
    { nom: 'demi-couche', coucher: 2, x: 640, y: 400, pause: 6 },
    { nom: 'lent-30im', coucher: 0, x: 640, y: 400, pause: 30 },
    { nom: 'horizon-lent', coucher: 8, x: 640, y: 400, pause: 30 },
  ]
  sortie.combos = []
  for (const cb of combos) {
    // remise à la pose d'ouverture : on redescend au bloc de départ par
    // l'escalier, puis on laisse le repos se poser
    await page.evaluate(() => window.__exp.modes._rescale({ lat: -21.2, lon: 55.5, zoom: 12 }, 'BANC R30'))
    await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 }).catch(() => {})
    await calme(120)
    await on(cb.nom)
    const depart = await etat()
    if (cb.coucher) await coucherVersLHorizon(cb.coucher)
    await calme(30)
    const pose = await etat()
    const suivi = []
    let orbite = false
    for (let k = 0; k < 300; k++) {
      await molette(120, 1, cb.pause, cb.x, cb.y)
      const s = await etat()
      suivi.push({ i: k, d: s.d, dmax: s.dmax, alt: s.altM, z: s.zoom, phi: s.phi, niv: s.niveau, mode: s.mode, crop: s.crop })
      if (s.mode === 'orbital') { orbite = true; break }
    }
    await off()
    sortie.combos.push({
      ...cb, depart, pose, orbite, crans: suivi.length,
      dMax: Math.max(...suivi.map((x) => x.d)),
      altMax: Math.max(...suivi.map((x) => x.alt)),
      nivMax: Math.max(...suivi.map((x) => x.niv)),
      cropMortAu: suivi.findIndex((x) => !x.crop),
      suivi: suivi.filter((x, i) => i % 10 === 0 || i >= suivi.length - 2),
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `sol` — LE CONTRE-EXEMPLE QUE R23 N'A PAS CHERCHÉ.
//
// ⛔ **R23 A TOURNÉ À LA BUTÉE. ELLE N'A JAMAIS ZOOMÉ À LA BUTÉE, NI CHANGÉ DE
// NIVEAU EN Y ÉTANT.** Ses 7 569 images sont 15 configurations de ROTATION à
// distance figée. Ici on ajoute les deux gestes qu'elle n'a pas faits, et qui
// sont ceux d'un utilisateur : coucher la vue au ras du relief, PUIS zoomer à
// la molette (donc franchir des niveaux) sans jamais redresser.
//
// ⚠️ Le placement (`_rescale`) est un APPEL D'API, et il n'est pas mesuré :
// c'est le décor. Tout ce qui suit est envoyé à la souris.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'sol') {
  const LIEUX = [
    ['Mont-Blanc', 45.8326, 6.8652, 12],
    ['Cervin', 45.9763, 7.6586, 12],
    ['Everest', 27.9881, 86.925, 12],
    ['Everest-fin', 27.9881, 86.925, 13],
    ['Svalbard', 78.65, 16.37, 12],
  ]
  sortie.lieux = []
  for (const [nom, lat, lon, zoom] of LIEUX) {
    await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'BANC R30'), { lat, lon, zoom })
    await page.waitForFunction('!window.__exp.modes.busy', { timeout: 150000 }).catch(() => {})
    await calme(150)
    const pose = await etat()

    // ① coucher la vue au ras du relief, à la souris
    await on(nom + '/coucher')
    await coucherVersLHorizon(8)
    await calme(30)
    const couchee = await etat()

    // ② TOURNER 360° À LA BUTÉE, bouton tenu — le geste de R23, pour comparer
    await tag(nom + '/tourner')
    await page.mouse.move(640, 640)
    await page.mouse.down()
    for (let i = 1; i <= 60; i++) { await page.mouse.move(640 + 24 * i, 220); await wait(2) }
    await page.mouse.up()
    await calme(30)

    // ③ ⚡ LE GESTE NEUF : ZOOMER À LA BUTÉE, sans redresser. Vers l'INTÉRIEUR
    //    d'abord (la caméra plonge vers le relief), puis vers l'extérieur.
    await tag(nom + '/zoom-a-la-butee')
    await molette(-120, 40, 4)
    await calme(40)
    await molette(120, 40, 4)
    await calme(40)

    // ④ et un glissé de rotation PENDANT que l'élan de zoom court encore
    await tag(nom + '/melange')
    await molette(-120, 12, 1)
    await page.mouse.move(300, 600)
    await page.mouse.down()
    for (let i = 1; i <= 40; i++) { await page.mouse.move(300 + 18 * i, 600 - 9 * i); await wait(1) }
    await page.mouse.up()
    await calme(60)
    await off()

    const fr = await page.evaluate((n) => {
      const F = window.__R30.frames.filter((x) => String(x.tag).startsWith(n + '/'))
      window.__R30.frames = []
      return F
    }, nom)
    const parTag = {}
    for (const x of fr) {
      const k = x.tag
      const b = (parTag[k] ??= { n: 0, sous: 0, hmin: Infinity, mpu: x.mpu, phiMax: 0, pasPhiMax: 0, dernierPhi: null })
      b.n++
      if (x.hauteurSol != null) { b.hmin = Math.min(b.hmin, x.hauteurSol); if (x.hauteurSol < 0) b.sous++ }
      b.phiMax = Math.max(b.phiMax, x.phi)
      if (b.dernierPhi != null) b.pasPhiMax = Math.max(b.pasPhiMax, Math.abs(x.phi - b.dernierPhi))
      b.dernierPhi = x.phi
    }
    for (const k of Object.keys(parTag)) { const b = parTag[k]; if (b.hmin === Infinity) b.hmin = null; delete b.dernierPhi }
    sortie.lieux.push({ nom, lat, lon, zoom, pose, couchee, parTag, images: fr.length })
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `latitude` — LE GESTE EST-IL CONTINU AUX HAUTES LATITUDES ?
//
// R23 avait trouvé ×2,027 à 80° et ×3,367 à 84° AVANT son correctif. On va
// voir 85°, 88° et le pôle, en relevant `rotateSpeed` et le °/px **DANS la
// boucle** sur une descente et une remontée complètes.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'latitude') {
  const LATS = [[0, 'equateur', 0.0, 20.0], [80, 'lat80', 80.0, 20.0], [85, 'lat85', 85.0, 20.0],
    [88, 'lat88', 88.0, 20.0], [89.9, 'lat89-9', 89.9, 20.0], [-89.9, 'pole-sud', -89.9, 20.0]]
  sortie.lats = []
  for (const [, nom, lat, lon] of LATS) {
    await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: 12 }, 'BANC R30'), { lat, lon })
    await page.waitForFunction('!window.__exp.modes.busy', { timeout: 150000 }).catch(() => {})
    await calme(90)
    await on(nom)
    // remontée jusqu'à l'orbite, À LA MOLETTE
    for (let k = 0; k < 300; k++) {
      await molette(120, 1, 5)
      const s = await etat()
      if (s.mode === 'orbital') break
    }
    await calme(60)
    // redescente, à la molette aussi
    for (let k = 0; k < 300; k++) {
      await molette(-120, 1, 5)
      const s = await etat()
      if (s.mode === 'surface' && s.zoom >= 11) break
      if (s.busy) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(10) }
    }
    await calme(60)
    await off()
    const fr = await page.evaluate((n) => {
      const F = window.__R30.frames.filter((x) => x.tag === n)
      window.__R30.frames = []
      return F
    }, nom)
    // le rapport MAXIMAL de °/px entre deux images consécutives
    let pire = 1, ou = null
    for (let i = 1; i < fr.length; i++) {
      const a = fr[i - 1].degPx, b = fr[i].degPx
      if (!(a > 0) || !(b > 0)) continue
      const r = Math.max(a / b, b / a)
      if (r > pire) { pire = r; ou = { i, a, b, rsA: fr[i - 1].rs, rsB: fr[i].rs, modeA: fr[i - 1].mode, modeB: fr[i].mode, altA: fr[i - 1].altM, altB: fr[i].altM } }
    }
    sortie.lats.push({
      nom, lat, images: fr.length,
      rsSet: [...new Set(fr.map((x) => x.rs))],
      degPxSet: [...new Set(fr.map((x) => Number(x.degPx.toFixed(6))))],
      pireRapport: pire, ou,
      modes: [...new Set(fr.map((x) => x.mode))],
      orbiteAtteinte: fr.some((x) => x.mode === 'orbital'),
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `crans` — HUIT CRANS, TROIS CADENCES.
//
// ⛔ **`cranZoom` SORT SANS RIEN FAIRE SI `busy`** (`if (this.busy || this.travel
// || this._diveTween) return`, première ligne). Or `_coarsen` met `busy` à vrai
// pendant le fondu. Huit crans envoyés d'affilée n'en dépensent donc que les
// premiers : le reste tombe. C'est la seule différence entre « huit crans = un
// niveau » et « huit crans = quatre niveaux », et elle est de CADENCE.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'crans') {
  await on('depart')
  await calme(60)
  sortie.depart = await etat()
  sortie.cadences = []
  // trois cadences, une par chargement serait plus propre ; ici on remet la
  // scène par l'escalier entre chaque et on le DIT.
  for (const [nom, attendre] of [['tout-de-suite', 0], ['dix-images', 10], ['attend-busy', -1]]) {
    await page.evaluate(() => window.__exp.modes._rescale({ lat: -21.2, lon: 55.5, zoom: 12 }, 'BANC R30'))
    await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 }).catch(() => {})
    await calme(120)
    await tag('crans/' + nom)
    const av = await etat()
    const n0 = (await compteurs()).nCoarsen
    for (let k = 0; k < 8; k++) {
      await page.evaluate(() => window.__exp.modes.cranZoom(-1))
      if (attendre > 0) await wait(attendre)
      else if (attendre < 0) { await wait(6); await page.waitForFunction('!window.__exp.modes.busy', { timeout: 60000 }).catch(() => {}); await wait(20) }
    }
    await calme(120)
    const ap = await etat()
    const n1 = (await compteurs()).nCoarsen
    sortie.cadences.push({
      nom, attendre, avant: av, apres: ap, coarsen: n1 - n0,
      niveauxEmprise: Math.round(Math.log2(ap.emprise / av.emprise)),
      zAvant: av.zoom, zApres: ap.zoom, altAvant: av.altM, altApres: ap.altM,
      empriseAvant: av.emprise, empriseApres: ap.emprise,
    })
  }
  await off()
  sortie.frames = await page.evaluate(() => window.__R30.frames)
}

// ══════════════════════════════════════════════════════════════════════════
// MANCHE `voile` — L'ÉTAT D'ACCUEIL, VOILE NON LEVÉ.
//
// ⚡ C'est l'état que la mesure d'Adrien décrit, et aucun banc de la campagne
// ne l'a jamais relevé : R23 et R27 ferment le voile en première ligne. On
// relève la pose, l'altimètre AFFICHÉ, puis on envoie 32 crans de molette et
// huit `cranZoom(-1)` SANS rien fermer.
// ══════════════════════════════════════════════════════════════════════════
if (MANCHE === 'voile') {
  await on('voile')
  sortie.t0 = await etat()
  await calme(120); sortie.t120 = await etat()
  await calme(300); sortie.t420 = await etat()
  await tag('voile/molette32')
  await tracerOn()
  const av32 = await etat()
  await molette(120, 32, 6)
  await calme(90)
  sortie.molette32 = { avant: av32, apres: await etat() }
  await tag('voile/huit-crans')
  const av8 = await etat()
  const crans = []
  for (let k = 0; k < 8; k++) {
    await page.evaluate(() => window.__exp.modes.cranZoom(-1))
    await wait(10)
    crans.push(await etat())
  }
  await calme(90)
  sortie.huitCrans = { avant: av8, pas: crans, apres: await etat() }
  // ⚡ ET LA QUESTION QUI DÉCIDE : QUEL GESTE LÈVE LE VOILE ?
  //    On essaie, dans l'ordre, la molette seule, puis un GLISSÉ, puis un clic.
  await tag('voile/quel-geste')
  const essais = []
  await molette(120, 5, 6); essais.push({ geste: 'molette ×5', ...(await etat()) })
  await glisse(640, 400, 160, 0, 16, 2); essais.push({ geste: 'glissé 160 px', ...(await etat()) })
  await page.mouse.move(640, 400); await page.mouse.down(); await wait(2); await page.mouse.up()
  await calme(30); essais.push({ geste: 'clic simple', ...(await etat()) })
  await molette(120, 5, 6); essais.push({ geste: 'molette ×5 après le clic', ...(await etat()) })
  sortie.quelGeste = essais.map((e) => ({ geste: e.geste, voile: e.voile, sousLeCurseur: e.sousLeCurseur, altimetre: e.altimetre, d: e.d, niveau: e.niveau, zoom: e.zoom }))
  sortie.compteursApresGestes = await compteurs()
  await tracerOff()
  await off()
  sortie.compteurs = await compteurs()
  sortie.appels = await page.evaluate(() => window.__R30.appels)
  sortie.frames = await page.evaluate(() => window.__R30.frames)
}

sortie.consoleErreurs = console_erreurs
fs.writeFileSync(path.join(ICI, `${MANCHE}.json`), JSON.stringify(sortie), 'utf8')
console.log('écrit', path.join(ICI, `${MANCHE}.json`), 'frames', (sortie.frames || []).length, 'appels', (sortie.appels || []).length)
console.log('erreurs console :', console_erreurs.length)
await nav.close()
