// SONDE R29 — SORTIR DU CROP À LA MOLETTE, SUR DES ÉVÉNEMENTS DE MOLETTE RÉELS.
//
// ══════════ EN QUOI CE BANC DIFFÈRE DES DEUX PRÉCÉDENTS ═══════════════════
//
// R23 et R27 ont piloté leur remontée par APPEL D'API (`modes.cranZoom(-1)` et
// l'API de dézoom de l'appli). Ici la remontée est faite par
// `Input.dispatchMouseEvent` type `mouseWheel` — le MÊME chemin que le doigt
// d'Adrien : `_zoomGesture` → `_zoomVel` → `_applyZoom` → `_franchirSiBesoin`.
//
// Trois différences de banc, écrites parce qu'un relevé qui ne décrit pas son
// banc ne se compare à rien :
//   1. **Un cran = un événement de molette**, `deltaY = +100`, puis on laisse
//      le glissé inertiel s'éteindre (`_zoomVel` sous `ZOOM_STOP`) avant de
//      relever. R23/R27 appelaient une fonction qui repose la caméra tout de
//      suite, sans glissé.
//   2. **On attend `busy`** entre deux crans. Huit appels synchrones d'affilée
//      à `cranZoom` en avalent sept (`if (this.busy ...) return`) : c'est ce
//      qui donne « 8 crans, 1 niveau » et ce n'est PAS le défaut de fond.
//   3. **Le voile d'accueil est retiré** (rétractation R23) : sans ça la
//      molette n'atteint jamais le canevas.
//
// La sonde est posée DANS la boucle, en enveloppant `controls.update`.
//
//   node scripts/sonde-sortie-r29.mjs --port 5841 --etiquette avant
//
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R29')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5841'))
const ETIQ = opt('--etiquette', 'avant')
const MAX_CRANS = Number(opt('--crans', '40'))
// ⚠️ **LA POSE DE DÉPART CHANGE TOUT, ET C'EST LA LEÇON DE R23 §④.** À la pente
// d'arrivée (46,5°) la caméra a de la place sous `maxDistance` ; couchée vers
// l'horizon (φ → 88,2°) elle est CONTRE la butée dès le bloc. Les deux poses
// sont mesurées, et le banc dit laquelle il tient.
const COUCHER = A.includes('--coucher')
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
page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') journal.push(`${t}: ${m.text().slice(0, 240)}`) })
page.on('pageerror', (e) => journal.push(`pageerror: ${String(e).slice(0, 240)}`))
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 90000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 120000 })
// ⚠️ LE VOILE D'ACCUEIL MANGE TOUS LES GESTES (rétractation R23) — on le ferme.
await page.keyboard.press('Escape').catch(() => {})
await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
await wait(60)

// ══════════ L'ENREGISTREUR, DANS LA BOUCLE ════════════════════════════════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera
  const T = cam.position.constructor
  window.__R29 = { on: false, tag: '', frames: [], crans: 0 }
  const proj = (camera, x, y, z) => {
    const V = new T(x, y, z); V.project(camera)
    const r = e.renderer.domElement.getBoundingClientRect()
    return [(V.x * 0.5 + 0.5) * r.width, (-V.y * 0.5 + 0.5) * r.height]
  }
  // ⚠️ Compteur de molette posé sur le GESTIONNAIRE lui-même : c'est la seule
  // façon de dire « l'événement est arrivé » sans supposer qu'il a fait effet.
  const zg = e.modes._zoomGesture.bind(e.modes)
  e.modes._zoomGesture = (ev) => { window.__R29.crans++; return zg(ev) }
  // ⚠️ **UN BALAYAGE QUI NE FINIT PAS ET UN BALAYAGE QUI SE RÉ-ARME NE SE
  // DISTINGUENT PAS** en lisant `_fonduPose` : les deux rendent « vrai à chaque
  // image ». On compte donc les ARMEMENTS, et on note qui arme.
  window.__R29.armements = []
  const af = e.modes._armerFonduPose.bind(e.modes)
  e.modes._armerFonduPose = (cible, dir, versNadir) => {
    const r = af(cible, dir, versNadir)
    window.__R29.armements.push({ img: window.__R29.frames.length, versNadir: !!versNadir, arme: !!e.modes._fonduPose })
    return r
  }
  const orig = c.update.bind(c)
  c.update = (...a) => {
    const r = orig(...a)
    const R = window.__R29
    if (R.on) {
      const g = e.globe, m = e.modes
      R.frames.push({
        t: R.frames.length, tag: R.tag,
        mode: m.mode, busy: !!m.busy, fondu: !!m._fonduPose,
        fT: m._fonduPose ? m._fonduPose.t : null, fE: m._fonduPose ? m._fonduPose.e : null,
        fAng: m._fonduPose ? m._fonduPose.angleTotalDeg : null, fNadir: m._fonduPose ? !!m._fonduPose.versNadir : null,
        altM: e.altitudeCadrageM(),
        emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
        crop: !!(g && g._crop),
        niveau: m.zoomNiveau(), vel: m._zoomVel,
        d: cam.position.distanceTo(c.target),
        dmax: c.maxDistance, dmin: c.minDistance,
        tx: c.target.x, ty: c.target.y, tz: c.target.z,
        cx: cam.position.x, cy: cam.position.y, cz: cam.position.z,
        phi: c.getPolarAngle(),
        zoom: e.params?.demZoom ?? null,
        pTerre: e.camGlobe ? proj(e.camGlobe, 0, 0, 0) : null,
        pBloc: proj(cam, 0, 0, 0),
        repos: !!(e.veilleRepos && e.veilleRepos.auRepos),
        basculesRepos: e.veilleRepos ? e.veilleRepos.bascules : null,
        ecartRepos: e.veilleRepos ? e.veilleRepos.dernierEcart : null,
      })
    }
    return r
  }
})

const on = (tag) => page.evaluate((t) => { window.__R29.on = true; window.__R29.tag = t }, tag)
const off = () => page.evaluate(() => { window.__R29.on = false })
const tag = (t) => page.evaluate((x) => { window.__R29.tag = x }, t)
const etat = () => page.evaluate(() => {
  const e = window.__exp, c = e.controls, m = e.modes
  return {
    mode: m.mode, busy: !!m.busy, altM: e.altitudeCadrageM(),
    emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
    crop: !!(e.globe && e.globe._crop),
    niveau: m.zoomNiveau(), vel: m._zoomVel,
    d: e.camera.position.distanceTo(c.target), dmax: c.maxDistance,
    phi: c.getPolarAngle(),
    target: { x: c.target.x, y: c.target.y, z: c.target.z },
    zoom: e.params?.demZoom ?? null,
    cransRecus: window.__R29.crans,
    // ⚠️ LES QUATRE GARDES DE _franchirSiBesoin, RELEVÉES SÉPARÉMENT : sans
    // elles on sait que le niveau ne se franchit pas, pas POURQUOI.
    gBusy: !!m.busy, gTravel: !!m.travel, gDive: !!m._diveTween, gFondu: !!m._fonduPose,
    gCoarsen: !!m.hooks.getCoarsenTarget?.(), gContinu: m._continu(),
    basculesRepos: e.veilleRepos ? e.veilleRepos.bascules : null,
  }
})

// UN CRAN DE MOLETTE RÉEL, au centre du canevas.
async function cranMolette(delta = 100) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: delta,
    modifiers: 0, pointerType: 'mouse',
  })
}
// laisser le glissé s'éteindre, et le rechargement de niveau finir
async function reposer(maxImg = 260) {
  await page.waitForFunction(
    '(Math.abs(window.__exp.modes._zoomVel) < 0.0151) && !window.__exp.modes.busy',
    { timeout: 60000, polling: 'raf' },
  ).catch(() => {})
  await wait(12)
}

// ── ① MONTER EN ORBITE HAUTE, PUIS DESCENDRE JUSQU'AU BLOC CROPPÉ ──────────
//    (la descente n'est pas le sujet : elle est le décor du geste mesuré)
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 90000 })
await wait(90)
// ⚠️ **DEUX DESCENTES, ET ELLES NE POSENT PAS LA MÊME CAMÉRA.** Par API
// (`cranZoom(1)`) la caméra arrive à la pente d'arrivée ; à la molette elle
// arrive où le glissé et le pivot sous le curseur l'ont laissée. Le geste réel
// est le second, et c'est celui que le brief décrit.
const DESCENTE_MOLETTE = A.includes('--descente-molette')
if (DESCENTE_MOLETTE) {
  for (let i = 0; i < 420; i++) {
    await cranMolette(-100)
    await wait(4)
    const s = await page.evaluate(() => ({ m: window.__exp.modes.mode, c: !!(window.__exp.globe && window.__exp.globe._crop), z: window.__exp.params?.demZoom }))
    if (s.m === 'surface' && s.c && s.z >= 11) break
  }
  await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {})
} else {
  for (let i = 0; i < 140; i++) {
    await page.evaluate(() => { const m = window.__exp.modes; m._diveArmed = true; m.cranZoom(1) })
    await wait(8)
    const s = await page.evaluate(() => ({ m: window.__exp.modes.mode, b: !!window.__exp.modes.busy, c: !!(window.__exp.globe && window.__exp.globe._crop), z: window.__exp.params?.demZoom }))
    if (s.b) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(20) }
    if (s.m === 'surface' && s.c && s.z >= 11) break
  }
}
await wait(140) // laisser le repos se poser

// ── ①bis COUCHER LA VUE VERS L'HORIZON, AU GLISSÉ RÉEL ─────────────────────
//    (bouton TENU du début à la fin — R23 : le globe tourne seul sinon)
if (COUCHER) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: W / 2, y: H / 2, button: 'left', clickCount: 1, buttons: 1 })
  for (let i = 1; i <= 40; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: W / 2, y: H / 2 - i * 9, button: 'left', buttons: 1 })
    await wait(2)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: W / 2, y: H / 2 - 360, button: 'left', clickCount: 1, buttons: 0 })
  await wait(90)
}
// ── ①ter COLLER LA CAMÉRA CONTRE `maxDistance` — l'état du brief R29 ───────
//    Une rafale de molette SANS attendre l'extinction : c'est le geste continu
//    d'un utilisateur, et c'est ce qui amène `d` contre le plafond.
const PINCER = Number(opt('--pincer', '0'))
if (PINCER > 0) {
  for (let i = 0; i < PINCER; i++) { await cranMolette(100); await wait(3) }
  await reposer()
  await wait(60)
}
const depart = await etat()

// ── ② LA REMONTÉE, À LA MOLETTE, CRAN PAR CRAN ─────────────────────────────
//    ⚠️ **DEUX RÉGIMES, ET ILS NE DONNENT PAS LE MÊME NOMBRE.** En `--rafale` on
//    défile en continu (le geste d'Adrien) : la vitesse s'accumule et le cran
//    délivre `ZOOM_IMPULSE × ZOOM_TAU`. Cran par cran avec extinction complète,
//    `ZOOM_STOP` en rogne la moitié. Le banc dit lequel il tient.
const RAFALE = A.includes('--rafale')
// ⚠️ **LE BOUTON « − » N'EST PAS LA MOLETTE**, et c'est le chemin que le brief
// mesure (« huit `cranZoom(-1)` d'affilée »). `stepWider()` → `cranZoom(-1)`.
// La CADENCE est le paramètre qui compte : un rechargement de niveau dure des
// centaines de millisecondes, et pendant ce temps `busy` est levé.
const BOUTON = A.includes('--bouton')
const CADENCE = Number(opt('--cadence', '1'))
await on('remontee')
const table = [{ cran: 0, ...depart }]
let orbiteA = null
for (let k = 1; k <= MAX_CRANS; k++) {
  await tag(`cran-${k}`)
  if (BOUTON) { await page.evaluate(() => window.__exp.modes.stepWider()); await wait(CADENCE) }
  else {
    await cranMolette(100)
    if (RAFALE) await wait(4) // ~66 ms : un défilement continu, pas une rafale d'API
    else await reposer()
  }
  const s = await etat()
  table.push({ cran: k, ...s })
  if (s.mode === 'orbital') { orbiteA = k; break }
}
await wait(60)
await off()

// ── ②bis LE RECENTRAGE, SEUL À L'ÉCRAN — protocole R27 §③, rejoué ─────────
//    ⚠️ **DANS UNE REMONTÉE ORDINAIRE, `|Δ ln d|` EST DOMINÉ PAR LE BALAYAGE DE
//    D16 ter, PAS PAR LE RECENTRAGE** (R27 §⑥ n° 6 : 0,0225 et 35 px relevés à
//    l'identique sur un dépôt qui n'a AUCUN recentrage). Pour lire le
//    recentrage il faut qu'il soit seul : on décale la cible ET la caméra du
//    MÊME vecteur (le pas est rigide, donc la distance est invariante par
//    construction), puis plus un geste.
let isole = null
if (A.includes('--retour-isole')) {
  // ⛔ **ET « PLUS UN GESTE » VEUT DIRE PLUS UN GESTE.** Un premier relevé a
  // rendu `|Δ ln d| = 1,69e-3` et une distance qui passait de 71,36 à 79,30 :
  // c'était le glissé inertiel qui courait ENCORE (`ZOOM_TAU = 1,2 s`), pas le
  // recentrage — qui est rigide et invariant en distance par construction. On
  // attend donc l'extinction complète du glissé, du chargement et du balayage.
  await page.waitForFunction(
    'window.__exp.modes._zoomVel === 0 && !window.__exp.modes.busy && !window.__exp.modes._fonduPose',
    { timeout: 60000, polling: 'raf' },
  ).catch(() => {})
  await wait(120)
  isole = await page.evaluate(async () => {
    const e = window.__exp, c = e.controls, cam = e.camera
    const releve = []
    const dep = 12.7208 // le même écart injecté que R27, pour être comparable
    cam.position.x += dep; c.target.x += dep
    const d0 = cam.position.distanceTo(c.target)
    const axe = () => Math.hypot(c.target.x, c.target.z)
    const proj = (camera, x, y, z) => {
      const V = new cam.position.constructor(x, y, z); V.project(camera)
      const r = e.renderer.domElement.getBoundingClientRect()
      return [(V.x * 0.5 + 0.5) * r.width, (-V.y * 0.5 + 0.5) * r.height]
    }
    await new Promise((res) => {
      let n = 0
      const t = () => {
        releve.push({
          ecart: axe(), d: cam.position.distanceTo(c.target),
          pBloc: proj(cam, 0, 0, 0), pTerre: e.camGlobe ? proj(e.camGlobe, 0, 0, 0) : null,
          bascules: e.veilleRepos ? e.veilleRepos.bascules : null,
          ecartRepos: e.veilleRepos ? e.veilleRepos.dernierEcart : null,
        })
        if (++n >= 320) res(); else requestAnimationFrame(t)
      }
      requestAnimationFrame(t)
    })
    let iZero = -1
    for (let i = 0; i < releve.length; i++) if (releve[i].ecart < 1e-9) { iZero = i; break }
    const fin = iZero >= 0 ? iZero : releve.length - 1
    let dln = 0, sBloc = 0, sTerre = 0
    for (let i = 1; i <= fin; i++) {
      const a = releve[i - 1], b = releve[i]
      dln = Math.max(dln, Math.abs(Math.log(b.d / a.d)))
      sBloc = Math.max(sBloc, Math.hypot(b.pBloc[0] - a.pBloc[0], b.pBloc[1] - a.pBloc[1]))
      if (a.pTerre && b.pTerre) sTerre = Math.max(sTerre, Math.hypot(b.pTerre[0] - a.pTerre[0], b.pTerre[1] - a.pTerre[1]))
    }
    return {
      ecartInjecte: dep, d0, images: iZero >= 0 ? iZero : null,
      ecartFinal: releve[fin].ecart, dlnMax: dln, sautBlocPxMax: sBloc, sautTerrePxMax: sTerre,
      basculesAvant: releve[0].bascules, basculesApres: releve[fin].bascules,
      ecartReposMax: Math.max(...releve.slice(0, fin + 1).map((r) => r.ecartRepos ?? 0)),
      dFinal: releve[fin].d,
    }
  })
}

const frames = await page.evaluate(() => window.__R29.frames)

// ── ③ LES IMAGES QUI ENCADRENT LA MORT DU CROP ─────────────────────────────
let bascule = null
for (let i = 1; i < frames.length; i++) {
  if (frames[i - 1].crop && !frames[i].crop) { bascule = i; break }
}
const autour = bascule == null ? [] : frames.slice(Math.max(0, bascule - 4), bascule + 8)
// ── ③bis LE RETOUR DU PIVOT SUR L'AXE, ET LE SAUT À L'ÉCRAN ────────────────
//    ⚠️ L'écart à l'axe se lit sur `(target.x, target.z)` SEULS : le centre de
//    la Terre est sur la VERTICALE du centre du bloc, donc `y` ne le vise pas
//    moins bien (R27 §②). Le saut, lui, se lit en PIXELS.
const axe = (f) => Math.hypot(f.tx, f.tz)
let retour = null
if (bascule != null) {
  const suite = frames.slice(bascule)
  let iZero = -1
  for (let i = 0; i < suite.length; i++) { if (axe(suite[i]) < 1e-9) { iZero = i; break } }
  let sautBloc = 0, sautTerre = 0, dlnRetour = 0
  const fin = iZero >= 0 ? iZero : suite.length - 1
  for (let i = 1; i <= fin; i++) {
    const a = suite[i - 1], b = suite[i]
    sautBloc = Math.max(sautBloc, Math.hypot(b.pBloc[0] - a.pBloc[0], b.pBloc[1] - a.pBloc[1]))
    if (a.pTerre && b.pTerre) sautTerre = Math.max(sautTerre, Math.hypot(b.pTerre[0] - a.pTerre[0], b.pTerre[1] - a.pTerre[1]))
    if (a.d > 0 && b.d > 0) dlnRetour = Math.max(dlnRetour, Math.abs(Math.log(b.d / a.d)))
  }
  retour = {
    ecartALaMort: axe(suite[0]), images: iZero >= 0 ? iZero : null,
    ecartFinal: axe(suite[fin]), sautBlocPxMax: sautBloc, sautTerrePxMax: sautTerre,
    dlnMaxSurLeRetour: dlnRetour,
    basculesReposAvant: suite[0].basculesRepos,
    basculesReposApres: suite[fin].basculesRepos,
    ecartReposMax: Math.max(...suite.slice(0, fin + 1).map((f) => f.ecartRepos ?? 0)),
  }
}
const fonduTrace = frames.filter((f) => f.fondu).slice(0, 400).map((f) => [f.t, +f.fT.toFixed(4), +f.fE.toFixed(4), +f.fAng.toFixed(2), f.fNadir ? 1 : 0])

// ── ④ `veille-repos` : |Δ ln d| par image sur toute la remontée ────────────
let dlnMax = 0, dlnMaxT = -1
for (let i = 1; i < frames.length; i++) {
  const a = frames[i - 1].d, b = frames[i].d
  if (!(a > 0 && b > 0)) continue
  const v = Math.abs(Math.log(b / a))
  if (v > dlnMax) { dlnMax = v; dlnMaxT = i }
}
// et le même, restreint aux images SANS geste (vel éteint) autour de la bascule
let dlnBascule = null
if (bascule != null) {
  let m = 0
  for (let i = Math.max(1, bascule - 3); i < Math.min(frames.length, bascule + 4); i++) {
    const a = frames[i - 1].d, b = frames[i].d
    if (a > 0 && b > 0) m = Math.max(m, Math.abs(Math.log(b / a)))
  }
  dlnBascule = m
}

const out = {
  etiquette: ETIQ, port: PORT, quand: new Date().toISOString(),
  banc: 'evenements de molette REELS (Input.dispatchMouseEvent mouseWheel, deltaY=+100), un cran puis extinction du glisse',
  depart, table, orbiteA, cransUtilises: table.length - 1,
  bascule, autour, retour, isole, dlnMax, dlnMaxT, dlnBascule,
  images: frames.length,
  fonduTrace,
  armements: await page.evaluate(() => window.__R29.armements),
  journal: journal.slice(0, 60),
}
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(out, null, 1))

const f = (x, n = 0) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: n }))
console.log(`\n=== R29 / ${ETIQ} — remontée à la MOLETTE, ${table.length - 1} crans ===`)
console.log('cran |        d |   plafond |    altitude |     emprise | crop | mode    | z  | _levelZoom')
for (const r of table) {
  console.log(
    `${String(r.cran).padStart(4)} | ${f(r.d, 3).padStart(8)} | ${f(r.dmax, 1).padStart(9)} | ${(f(r.altM) + ' m').padStart(11)} | ${(f(r.emprise) + ' m').padStart(11)} | ${(r.crop ? 'oui' : 'non').padStart(4)} | ${String(r.mode).padEnd(7)} | ${String(r.zoom).padStart(2)} | ${f(r.niveau, 5)}`)
}
console.log(`\norbite atteinte au cran : ${orbiteA ?? 'JAMAIS'}`)
console.log(`crans de molette reçus par _zoomGesture : ${(await etat()).cransRecus}`)
console.log(`bascule du crop à l'image : ${bascule ?? 'AUCUNE'}`)
console.log(`|Δ ln d| max sur la remontée : ${dlnMax.toExponential(4)} (img ${dlnMaxT})`)
console.log(`|Δ ln d| max autour de la bascule : ${dlnBascule == null ? '—' : dlnBascule.toExponential(4)}`)
if (retour) {
  console.log(`\n--- LE RETOUR DU PIVOT SUR L'AXE ---`)
  console.log(`  écart à la mort du crop      : ${retour.ecartALaMort.toFixed(4)} u`)
  console.log(`  images pour revenir sur l'axe: ${retour.images ?? 'JAMAIS'}`)
  console.log(`  écart final                  : ${retour.ecartFinal.toExponential(4)} u`)
  console.log(`  saut MAX du centre du bloc   : ${retour.sautBlocPxMax.toFixed(3)} px`)
  console.log(`  saut MAX du centre de la Terre: ${retour.sautTerrePxMax.toFixed(3)} px`)
  console.log(`  |Δ ln d| MAX sur le retour   : ${retour.dlnMaxSurLeRetour.toExponential(4)} (seuil 1e-4)`)
  console.log(`  bascules veille-repos        : ${retour.basculesReposAvant} → ${retour.basculesReposApres}`)
  console.log(`  veilleRepos.dernierEcart max : ${retour.ecartReposMax.toExponential(4)}`)
}
if (isole) {
  console.log(`
--- LE RECENTRAGE, SEUL A L ECRAN (protocole R27) ---`)
  console.log(`  ecart injecte (rigide)       : ${isole.ecartInjecte} u`)
  console.log(`  images pour revenir sur l axe: ${isole.images ?? 'JAMAIS'}`)
  console.log(`  ecart final                  : ${isole.ecartFinal.toExponential(4)} u`)
  console.log(`  distance : ${isole.d0} -> ${isole.dFinal}`)
  console.log(`  |D ln d| MAX                 : ${isole.dlnMax.toExponential(4)} (seuil 1e-4)`)
  console.log(`  saut MAX centre du bloc      : ${isole.sautBlocPxMax.toFixed(4)} px`)
  console.log(`  saut MAX centre de la Terre  : ${isole.sautTerrePxMax.toFixed(4)} px`)
  console.log(`  bascules veille-repos        : ${isole.basculesAvant} -> ${isole.basculesApres}`)
  console.log(`  veilleRepos.dernierEcart max : ${isole.ecartReposMax.toExponential(4)}`)
}
if (journal.length) { console.log('\n⚠️ CONSOLE :'); journal.slice(0, 20).forEach((l) => console.log('  ' + l)) }

await nav.close()
