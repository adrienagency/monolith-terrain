// SONDE R32 — LE PIVOT, MESURÉ DANS L'ESPACE OÙ LA RÈGLE SE VÉRIFIE.
//
// ══════════ POURQUOI UNE CINQUIÈME SONDE ═════════════════════════════════
//
// R27, R29 bis et R30 ont toutes mesuré `hypot(controls.target.x, target.z)` et
// l'ont appelé « écart à l'axe de la Terre ». C'est l'axe du BLOC : en mode
// surface les contrôles vivent dans l'espace du bloc plat, où `(0, y, 0)` est le
// point de la surface SOUS la caméra. Le centre de la Terre, lui, est à
// `(0, −R_bloc, 0)` avec `R_bloc = EARTH_RADIUS_M × span / emprise` — des milliers
// d'unités sous l'origine. Personne ne l'avait converti.
//
// Cette sonde relève donc TOUT en espace globe ou en pixels (règle D19) :
//   1. le pivot (`controls.target`) transporté par la similitude bloc → globe,
//      en mètres du centre de la Terre ;
//   2. le lat/lon du point sous la caméra (`camGlobe.position`), image par
//      image — LA signature qui distingue une orbite (il change) d'un lacet
//      (il ne change pas) ;
//   3. le centre de la Terre projeté à l'écran, en pixels ;
//   4. le point SAISI au clic, projeté à l'écran, contre la position du
//      pointeur (D19 : « on attrape la Terre ») ;
//   5. le point au centre de l'écran au début d'un scroll, projeté à l'écran
//      pendant le scroll (D19 : « je scrolle vers le point visé au centre »).
//
// ══════════ LE BANC ═══════════════════════════════════════════════════════
//
// Chrome sans tête 1280 × 800, gestes envoyés à la SOURIS (CDP
// `Input.dispatchMouseEvent`), relevé dans un `requestAnimationFrame` posé
// APRÈS celui de `tick()` — donc après `majCameraFond()`, sur la caméra qui
// rend. Le voile d'accueil est FERMÉ par Échap et vérifié par
// `elementFromPoint(640, 400)` : la sonde refuse de mesurer derrière un voile.
//
// ⚠️ La pose de démarrage arrive après un vol de 8,3 s, et la caméra est
// immobile 5 s AVANT ce vol (R29 bis) : on attend `d ≈ 145,5` ET 90 images
// stables, pas « la stabilité ».
//
//   node scripts/sonde-pivot-r32.mjs --port 5851 --etiquette avant
//   node scripts/sonde-pivot-r32.mjs --port 5851 --etiquette apres
//
// Sorties : `.banc/R32/<etiquette>.json`, et le tableau ci-dessous.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R32')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5851'))
const ETIQ = opt('--etiquette', 'avant')
const PAS_PX = Number(opt('--pas', '5')) // pixels par image de glissé
const COURSE_PX = Number(opt('--course', '200')) // longueur du glissé
const ALTS_KM = opt('--altitudes', '2000,130,50').split(',').map(Number)
const W = 1280, H = 800

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const journal = []
page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') journal.push(`${t}: ${m.text().slice(0, 200)}`) })
page.on('pageerror', (e) => journal.push(`pageerror: ${String(e).slice(0, 240)}`))
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })

// ══════════ ① LE VOILE D'ACCUEIL — FERMÉ, ET VÉRIFIÉ ═════════════════════
// ⚠️ **IL S'OUVRE APRÈS `#loading`** (mesuré : 7,2 s → 7,7 s) : un Échap envoyé
// trop tôt ne ferme rien. On attend son ouverture, puis on ferme.
await page.waitForFunction("document.body.classList.contains('ce-hub')", { timeout: 20000, polling: 100 }).catch(() => {})
for (let k = 0; k < 6; k++) {
  await page.keyboard.press('Escape').catch(() => {})
  await wait(20)
  const sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
  if (sous === 'CANVAS') break
  if (k === 5) throw new Error(`le voile d'accueil n'est pas fermé : elementFromPoint rend ${sous}`)
}
const voile = await page.evaluate(() => ({
  sousLeCurseur: document.elementFromPoint(640, 400)?.tagName ?? null,
  hubveil: !!document.querySelector('.ce-hubveil'),
  hubOuvert: document.body.classList.contains('ce-hub'),
}))

// ══════════ ② LA POSE DE DÉMARRAGE — la caméra immobile 2 s, `busy` faux ═══
// ⚠️ Fermer le voile ANNULE le vol de présentation vers `d = 145,5` (mesuré :
// Échap à l'ouverture → `d = 28,15` pour toujours). On ne suppose donc aucune
// valeur : on attend que `d` ne bouge plus pendant deux secondes.
await page.waitForFunction(() => {
  const e = window.__exp
  const d = e.camera.position.distanceTo(e.controls.target)
  const R = (window.__stab ??= { d: NaN, t: 0 })
  if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
  return !e.modes.busy && performance.now() - R.t > 2000
}, { timeout: 60000, polling: 100 })

// ══════════ ③ L'ENREGISTREUR — APRÈS `tick`, SUR LA CAMÉRA QUI REND ══════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera
  const V3 = cam.position.constructor
  const Q = cam.quaternion.constructor
  const R_GLOBE = 100, MPU = 6371000 / 100, SPAN = 56
  const R = (window.__R32 = { on: false, tag: '', frames: [], pointer: null, saisi: null, centre0: null })
  const gcam = () => e.camGlobe ?? cam
  const proj = (camera, x, y, z) => {
    const v = new V3(x, y, z); v.project(camera)
    return [(v.x * 0.5 + 0.5) * W(), (-v.y * 0.5 + 0.5) * Hh(), v.z]
  }
  const W = () => e.renderer.domElement.getBoundingClientRect().width
  const Hh = () => e.renderer.domElement.getBoundingClientRect().height
  // la similitude bloc → globe, RELUE sur les deux caméras : q_R = q_globe · q_bloc⁻¹,
  // k = emprise / span / MPU. En orbite les deux espaces coïncident (k = 1, q_R = 1).
  const versGlobe = (X) => {
    if (e.modes.mode === 'orbital' || !e.camGlobe) return new V3(X.x, X.y, X.z)
    const emprise = e.modes.hooks.empriseBlocM?.() ?? 0
    if (!(emprise > 0)) return null
    const k = emprise / SPAN / MPU
    const qR = new Q().copy(e.camGlobe.quaternion).multiply(new Q().copy(cam.quaternion).invert())
    return new V3(X.x - cam.position.x, X.y - cam.position.y, X.z - cam.position.z).applyQuaternion(qR).multiplyScalar(k).add(e.camGlobe.position)
  }
  const latLon = (p) => {
    const r = p.length()
    return { lat: (Math.asin(p.y / r) * 180) / Math.PI, lon: (Math.atan2(p.x, p.z) * 180) / Math.PI }
  }
  // le point de la sphère (rayon R_GLOBE) sous un pixel, ou null s'il rate
  const sphereSous = (px, py) => {
    const camera = gcam()
    const nx = (px / W()) * 2 - 1, ny = -((py / Hh()) * 2 - 1)
    const o = camera.position.clone()
    const d = new V3(nx, ny, 0.5).unproject(camera).sub(o).normalize()
    const b = o.dot(d), cc = o.dot(o) - R_GLOBE * R_GLOBE
    const disc = b * b - cc
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    return o.clone().addScaledVector(d, t).normalize()
  }
  R.sphereSous = sphereSous
  R.saisir = (px, py) => { R.saisi = sphereSous(px, py); return !!R.saisi }
  R.saisirCentre = () => { R.centre0 = sphereSous(W() / 2, Hh() / 2); return !!R.centre0 }
  const tick = () => {
    if (R.on) {
      const camera = gcam()
      const fwd = new V3(0, 0, -1).applyQuaternion(camera.quaternion)
      const bas = camera.position.clone().negate().normalize()
      const tilt = (Math.acos(Math.max(-1, Math.min(1, fwd.dot(bas)))) * 180) / Math.PI
      const pivotG = versGlobe(c.target)
      const sl = latLon(camera.position)
      const pT = proj(camera, 0, 0, 0)
      const f = {
        t: R.frames.length, tag: R.tag, now: performance.now(),
        mode: e.modes.mode, busy: !!e.modes.busy, fondu: !!e.modes._fonduPose,
        crop: !!(e.globe && e.globe._crop), pose: !!e.veilleCrop?.pose,
        altM: e.altitudeCadrageM(), altFondM: (camera.position.length() - R_GLOBE) * MPU,
        d: cam.position.distanceTo(c.target),
        tx: c.target.x, ty: c.target.y, tz: c.target.z,
        cx: cam.position.x, cy: cam.position.y, cz: cam.position.z,
        phi: (c.getPolarAngle() * 180) / Math.PI,
        // ① le pivot en mètres du centre de la Terre, ESPACE GLOBE
        pivotM: pivotG ? pivotG.length() * MPU : null,
        pivotSurfM: pivotG ? (pivotG.length() - R_GLOBE) * MPU : null,
        // ② le point sous la caméra
        lat: sl.lat, lon: sl.lon,
        // ③ le centre de la Terre à l'écran
        pxTerre: [pT[0], pT[1]], terreDevant: pT[2] < 1,
        tilt,
        // ④ le point saisi, et le pointeur
        pointer: R.pointer ? [R.pointer[0], R.pointer[1]] : null,
        pxSaisi: R.saisi ? (() => { const p = proj(camera, R.saisi.x * R_GLOBE, R.saisi.y * R_GLOBE, R.saisi.z * R_GLOBE); return [p[0], p[1]] })() : null,
        saisiVisible: R.saisi ? R.saisi.dot(camera.position.clone().normalize()) > R_GLOBE / camera.position.length() : null,
        // ⑤ le point qui était au centre au début du scroll
        pxCentre0: R.centre0 ? (() => { const p = proj(camera, R.centre0.x * R_GLOBE, R.centre0.y * R_GLOBE, R.centre0.z * R_GLOBE); return [p[0], p[1]] })() : null,
        // le centre du BLOC (l'ancien « axe ») à l'écran, pour comparer avec les passes précédentes
        pxBloc: (() => { const p = proj(cam, 0, 0, 0); return [p[0], p[1]] })(),
        zoom: e.params?.demZoom ?? null,
        emprise: e.modes.hooks.empriseBlocM?.() ?? null,
        vel: e.modes._zoomVel, niveau: e.modes.zoomNiveau(),
        bascules: e.veilleRepos ? e.veilleRepos.bascules : null,
      }
      R.frames.push(f)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)
const on = (tag) => { etape('on ' + tag); return page.evaluate((t) => { window.__R32.on = true; window.__R32.tag = t }, tag) }
const off = () => page.evaluate(() => { window.__R32.on = false; window.__R32.saisi = null; window.__R32.centre0 = null; window.__R32.pointer = null })
const tag = (t) => page.evaluate((x) => { window.__R32.tag = x }, t)
const etat = () => page.evaluate(() => {
  const e = window.__exp, c = e.controls, m = e.modes
  const camera = e.camGlobe ?? e.camera
  return {
    mode: m.mode, busy: !!m.busy, fondu: !!m._fonduPose, crop: !!(e.globe && e.globe._crop),
    altM: m.altM, altFondM: (camera.position.length() - 100) * 63710,
    d: e.camera.position.distanceTo(c.target), zoom: e.params?.demZoom ?? null,
    vel: m._zoomVel, target: { x: c.target.x, y: c.target.y, z: c.target.z },
  }
})

// ══════════ LES GESTES, À LA SOURIS ═══════════════════════════════════════
const souris = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
async function glisse(dx, dy, etiquette) {
  const x0 = W / 2, y0 = H / 2
  const n = Math.max(1, Math.round(Math.hypot(dx, dy) / PAS_PX))
  await page.evaluate(([x, y]) => { window.__R32.pointer = [x, y]; window.__R32.saisir(x, y) }, [x0, y0])
  await souris('mousePressed', x0, y0, { clickCount: 1, buttons: 1 })
  await wait(1)
  for (let i = 1; i <= n; i++) {
    const x = x0 + (dx * i) / n, y = y0 + (dy * i) / n
    await page.evaluate(([px, py]) => { window.__R32.pointer = [px, py] }, [x, y])
    await souris('mouseMoved', x, y, { buttons: 1 })
    await wait(1)
  }
  await souris('mouseReleased', x0 + dx, y0 + dy, { clickCount: 1, buttons: 0 })
  await page.evaluate(() => { window.__R32.pointer = null })
  // l'élan (damping d'OrbitControls, ou l'élan de saisie) doit être ÉTEINT avant le geste suivant
  await page.waitForFunction(() => {
    const c = window.__exp.controls, sd = c._sphericalDelta
    const el = window.__exp.saisieTerre?.elan
    return (!sd || Math.hypot(sd.theta, sd.phi) < 2e-4) && (!el || Math.hypot(el.dLat, el.dLon) < 1e-6)
  }, { timeout: 15000, polling: 'raf' }).catch(() => etape('⚠️ élan : délai dépassé'))
  await wait(10)
}
async function cran(delta = -100) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: delta, modifiers: 0, pointerType: 'mouse' })
}
async function reposer() {
  const t = Date.now()
  await page.waitForFunction(
    '(window.__exp.modes.mode === "orbital" ? Math.abs(window.__exp.modes.orbAlt - window.__exp.modes.orbAltTarget) < window.__exp.modes.orbAltTarget * 0.002 : window.__exp.modes._zoomVel === 0) && !window.__exp.modes.busy && !window.__exp.modes._fonduPose',
    { timeout: 30000, polling: 'raf' },
  ).catch(async () => etape('⚠️ reposer : délai dépassé ' + JSON.stringify(await etat())))
  if (Date.now() - t > 5000) etape('reposer a pris ' + ((Date.now() - t) / 1000).toFixed(1) + ' s')
  await wait(6)
}
// descendre à la molette jusqu'à une altitude de FOND (mètres) — sans dépasser
async function descendreA(altM, maxCrans = 900) {
  await on(`descente-vers-${Math.round(altM / 1000)}km`)
  // en continu jusqu'à 1,5 × la cible (le glissé inertiel court encore ~1 s après le dernier cran)
  for (let i = 0; i < maxCrans; i++) {
    const s = await etat()
    if (s.altFondM <= altM * 1.25) break
    await cran(-100)
    await wait(2)
  }
  await reposer()
  // puis cran par cran, glissé éteint entre deux, jusqu'à passer sous la cible
  for (let i = 0; i < 40; i++) {
    const s = await etat()
    if (s.altFondM <= altM && !s.busy) return s
    await cran(-100)
    await reposer()
  }
  return etat()
}
async function remonterA(altM, maxCrans = 900) {
  for (let i = 0; i < maxCrans; i++) {
    const s = await etat()
    if (s.altFondM >= altM && !s.busy) return s
    await cran(100)
    await wait(4)
  }
  return etat()
}

// un jalon complet : glissé H, glissé V, scroll 6 crans vers l'intérieur
const jalons = []
async function jalon(nom) {
  await reposer()
  const depart = await etat()
  await on(`${nom}/H`)
  etape('glissé H ' + nom); await glisse(COURSE_PX, 0, 'H')
  await tag(`${nom}/V`)
  await page.evaluate(() => { window.__R32.saisi = null })
  etape('glissé V ' + nom); await glisse(0, -COURSE_PX, 'V') // vers le HAUT : vers le bas, φ bute à 0 depuis le nadir (R30)
  await tag(`${nom}/scroll`)
  await page.evaluate(() => { window.__R32.saisi = null; window.__R32.saisirCentre() })
  for (let k = 0; k < 6; k++) { await cran(-100); await wait(4) }
  await reposer()
  await off()
  const fin = await etat()
  jalons.push({ nom, depart, fin })
}

// ⚠️ **UN GLISSÉ DE 200 px À 60 000 km SORT DU DISQUE (130 px de rayon)** et,
// même dans le disque, un glissé horizontal à nord constant suit un grand
// cercle, pas un parallèle : la caméra finit vers −60° de latitude (mesuré :
// −58,7°). Les jalons de surface se joueraient alors près du pôle, sous la
// butée de latitude — un cas dégénéré. On ramène donc la caméra au-dessus de
// La Réunion après chaque jalon d'orbite, à l'altitude où elle est.
async function ramenerSurLaReunion() {
  await page.evaluate(() => {
    const e = window.__exp
    if (e.modes.mode !== 'orbital') return
    const la = -21.13 * Math.PI / 180, lo = 55.53 * Math.PI / 180
    const r = e.camera.position.length()
    e.camera.position.set(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r)
    e.camera.up.set(0, 1, 0); e.camera.lookAt(0, 0, 0); e.controls.update()
  })
  await wait(10)
}
// ══════════ ④ LE SCÉNARIO D'ADRIEN ════════════════════════════════════════
const demarrage = await etat()
// l'orbite haute : l'ÉTALON du geste (Adrien : « parfait en mode orbital »)
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 90000 })
await wait(90)
await jalon('orbite-60000km')
await ramenerSurLaReunion()
// l'orbite basse, juste au-dessus de la porte de plongée
await descendreA(10000000)
await jalon('orbite-10000km')
await ramenerSurLaReunion()
// la surface, aux trois altitudes du brief
for (const km of ALTS_KM) {
  await descendreA(km * 1000)
  const s = await etat()
  if (s.mode !== 'surface') journal.push(`jalon ${km} km : le mode est encore ${s.mode}`)
  await jalon(`surface-${km}km`)
}
// le crop : rien ne doit changer
await descendreA(28000)
await reposer()
await wait(120) // le repos du crop et la bascule de trois quarts (D16 ter)
await jalon('crop-28km')
// le retour : on dézoome depuis le crop jusqu'à sa mort, SANS autre geste
await on('retour')
await remonterA(95000, 600)
await reposer()
await off()

const frames = await page.evaluate(() => window.__R32.frames)

// ══════════ ⑤ LES CHIFFRES ═════════════════════════════════════════════════
const par = (t) => frames.filter((f) => f.tag === t)
const maxDe = (arr, fn) => arr.reduce((m, f) => { const v = fn(f); return v != null && v > m ? v : m }, 0)
const centreEcran = [W / 2, H / 2]
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
function resumeSegment(t) {
  const F = par(t)
  if (!F.length) return null
  const f0 = F[0], f1 = F[F.length - 1]
  let dln = 0, sautTerre = 0
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], b = F[i]
    if (a.d > 0 && b.d > 0) dln = Math.max(dln, Math.abs(Math.log(b.d / a.d)))
    sautTerre = Math.max(sautTerre, dist2(a.pxTerre, b.pxTerre))
  }
  const dLat = f1.lat - f0.lat
  let dLon = f1.lon - f0.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360
  const km = 6371 * Math.acos(Math.max(-1, Math.min(1,
    Math.sin(f0.lat * Math.PI / 180) * Math.sin(f1.lat * Math.PI / 180) + Math.cos(f0.lat * Math.PI / 180) * Math.cos(f1.lat * Math.PI / 180) * Math.cos(dLon * Math.PI / 180))))
  const avecSaisi = F.filter((f) => f.pxSaisi && f.pointer)
  const deriveSaisi = avecSaisi.map((f) => dist2(f.pxSaisi, f.pointer))
  const avecCentre = F.filter((f) => f.pxCentre0)
  const deriveCentre = avecCentre.map((f) => dist2(f.pxCentre0, centreEcran))
  return {
    tag: t, images: F.length, mode: f0.mode, crop: f0.crop, zoom: f0.zoom,
    altFondKm: f0.altFondM / 1000, altFondKmFin: f1.altFondM / 1000,
    pivotSurfM: [f0.pivotSurfM, f1.pivotSurfM], pivotM: [f0.pivotM, f1.pivotM],
    latLon0: [f0.lat, f0.lon], latLon1: [f1.lat, f1.lon], dLatDeg: dLat, dLonDeg: dLon, deplacementKm: km,
    terreEcart0: dist2(f0.pxTerre, centreEcran), terreEcartMax: maxDe(F, (f) => dist2(f.pxTerre, centreEcran)), terreEcartFin: dist2(f1.pxTerre, centreEcran),
    terreSautMax: sautTerre, terreDevantToujours: F.every((f) => f.terreDevant),
    tilt0: f0.tilt, tiltMax: maxDe(F, (f) => f.tilt), tiltFin: f1.tilt,
    dlnMax: dln,
    saisiDeriveMax: deriveSaisi.length ? Math.max(...deriveSaisi) : null,
    saisiDeriveFin: deriveSaisi.length ? deriveSaisi[deriveSaisi.length - 1] : null,
    saisiPerdu: avecSaisi.some((f) => f.saisiVisible === false),
    centreDeriveMax: deriveCentre.length ? Math.max(...deriveCentre) : null,
    centreDeriveFin: deriveCentre.length ? deriveCentre[deriveCentre.length - 1] : null,
    blocEcartMax: maxDe(F, (f) => dist2(f.pxBloc, centreEcran)),
    tx1: f1.tx, tz1: f1.tz, phi1: f1.phi,
    basculesRepos: [f0.bascules, f1.bascules],
  }
}
const tags = [...new Set(frames.map((f) => f.tag))].filter((t) => !t.startsWith('descente'))
const resumes = tags.map(resumeSegment).filter(Boolean)
// les descentes : les sauts d'une image à l'autre du point sous la caméra et du centre de la Terre
const descentes = [...new Set(frames.map((f) => f.tag))].filter((t) => t.startsWith('descente')).map((t) => {
  const F = par(t)
  const sauts = []
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], b = F[i]
    let dLon = b.lon - a.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360
    const km = 6371 * Math.hypot((b.lat - a.lat) * Math.PI / 180, dLon * Math.PI / 180 * Math.cos(a.lat * Math.PI / 180))
    const px = dist2(a.pxTerre, b.pxTerre)
    if (km > 0.5 || px > 3) sauts.push({ img: b.t, km: +km.toFixed(2), px: +px.toFixed(1), altKm: +(b.altFondM / 1000).toFixed(1), zoom: [a.zoom, b.zoom], mode: [a.mode, b.mode], busy: [a.busy, b.busy], tilt: +b.tilt.toFixed(3) })
  }
  const fps = F.length > 2 ? (F.length - 1) / ((F[F.length - 1].now - F[0].now) / 1000) : null
  return { tag: t, images: F.length, fps, tiltMax: maxDe(F, (f) => f.tilt), sauts: sauts.slice(0, 40), nbSauts: sauts.length }
})
// le retour : la mort du crop, et ce qui suit
const retour = (() => {
  const F = par('retour')
  let mort = -1
  for (let i = 1; i < F.length; i++) if (F[i - 1].crop && !F[i].crop) { mort = i; break }
  if (mort < 0) return { mort: null }
  const suite = F.slice(mort)
  let sautTerre = 0, dln = 0
  for (let i = 1; i < suite.length; i++) {
    sautTerre = Math.max(sautTerre, dist2(suite[i - 1].pxTerre, suite[i].pxTerre))
    if (suite[i - 1].d > 0 && suite[i].d > 0) dln = Math.max(dln, Math.abs(Math.log(suite[i].d / suite[i - 1].d)))
  }
  const f0 = suite[0], f1 = suite[suite.length - 1]
  return {
    mort, altMortM: f0.altFondM, images: suite.length,
    terreEcartALaMort: dist2(f0.pxTerre, centreEcran), terreEcartFin: dist2(f1.pxTerre, centreEcran),
    terreSautMax: sautTerre, dlnMax: dln, tiltALaMort: f0.tilt, tiltFin: f1.tilt,
    pivotSurfMALaMort: f0.pivotSurfM, pivotSurfMFin: f1.pivotSurfM,
    axeBlocALaMort: Math.hypot(f0.tx, f0.tz), axeBlocFin: Math.hypot(f1.tx, f1.tz),
    fonduImages: suite.filter((f) => f.fondu).length,
  }
})()

const out = {
  etiquette: ETIQ, port: PORT, quand: new Date().toISOString(),
  banc: `Chrome sans tete ${W}x${H}, gestes CDP, glisse de ${COURSE_PX} px par pas de ${PAS_PX} px/image, releve apres tick sur camGlobe`,
  voile, demarrage, jalons, resumes, descentes, retour, images: frames.length,
  frames: frames.map((f) => ({ ...f })),
  journal: journal.slice(0, 80),
}
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(out))

const f = (x, n = 1) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: n }))
console.log(`\n=== R32 / ${ETIQ} — voile : sous le curseur ${voile.sousLeCurseur}, .ce-hubveil ${voile.hubveil ? 'présent' : 'absent'}, body.ce-hub ${voile.hubOuvert}`)
console.log(`démarrage : mode ${demarrage.mode}, d ${f(demarrage.d, 2)}, alt fond ${f(demarrage.altFondM / 1000, 1)} km, crop ${demarrage.crop}`)
console.log('\nsegment                 | mode    | alt km  | pivot/surf m | lat/lon Δ°      | dépl. km | Terre px max | saut px | tilt max | |Δln d| max | saisi px max/fin | centre px max/fin')
for (const r of resumes) {
  console.log(
    `${r.tag.padEnd(23)} | ${String(r.mode).padEnd(7)} | ${f(r.altFondKm, 0).padStart(7)} | ${f(r.pivotSurfM[1], 0).padStart(12)} | ${(f(r.dLatDeg, 3) + ' / ' + f(r.dLonDeg, 3)).padStart(15)} | ${f(r.deplacementKm, 1).padStart(8)} | ${f(r.terreEcartMax, 1).padStart(12)} | ${f(r.terreSautMax, 2).padStart(7)} | ${f(r.tiltMax, 2).padStart(8)} | ${r.dlnMax.toExponential(2).padStart(11)} | ${(r.saisiDeriveMax == null ? '—' : f(r.saisiDeriveMax, 1) + ' / ' + f(r.saisiDeriveFin, 1)).padStart(16)} | ${(r.centreDeriveMax == null ? '—' : f(r.centreDeriveMax, 1) + ' / ' + f(r.centreDeriveFin, 1)).padStart(16)}`)
}
console.log('\n--- LES DESCENTES : sauts du point sous la caméra (> 0,5 km) ou du centre de la Terre (> 3 px) ---')
for (const d of descentes) console.log(`${d.tag} : ${d.images} img à ${f(d.fps, 1)} i/s, tilt max ${f(d.tiltMax, 3)}°, ${d.nbSauts} sauts — ${JSON.stringify(d.sauts.slice(0, 12))}`)
console.log('\n--- LE RETOUR DEPUIS LE CROP ---')
console.log(JSON.stringify(retour, null, 1))
if (journal.length) { console.log('\n⚠️ CONSOLE :'); journal.slice(0, 15).forEach((l) => console.log('  ' + l)) }
await nav.close()
