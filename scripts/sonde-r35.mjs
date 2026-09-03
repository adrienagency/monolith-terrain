// SONDE R35 — les deux restes de caméra : `flyTo` → NaN, et le clic qui saute.
//
// Chrome sans tête piloté au protocole (CDP brut, Node ≥ 22), comme
// `profil-pf4.mjs` dont la plomberie est reprise. Le serveur de dev doit tourner
// (`npm run dev -- --port 5871 --strictPort`).
//
// Relevé AU RENDU : `composer.render` est enveloppé, et chaque image note la
// caméra QUI REND (`camGlobe` sous la frontière) — distance au centre de la
// Terre, centre de la Terre projeté à l'écran (px), distance caméra→cible
// (`ln d`), mode, busy, zoom. Le voile d'accueil est fermé APRÈS le vol de
// présentation (8,3 s), et vérifié (`elementFromPoint` au centre = CANVAS).
//
// SCÉNARIOS (`--scenario`) :
//   clic    `enterOrbit(60 000 km)` puis N clics au centre ; rapport de distance
//           image à image, centre de la Terre en px, |Δ ln d|
//   flyto   depuis la pose de démarrage (surface), `modes.flyTo(lat, lon, zoom)`
//           avec un traceur de NaN posé sur chaque écrivain de la caméra ;
//           `--exp 1` appelle `__exp.flyTo(lat, lon, zoom)` (l'appel de PF3)
//
// OPTIONS : --port 5871 · --url "?x=1" · --clics 8 · --lat --lon --zoom ·
//           --sortie fichier.json · --chrome <chemin> · --dbg 9335

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const SCENARIO = opt('--scenario', 'clic')
const PORT = Number(opt('--port', '5871'))
const URL_SUFFIXE = opt('--url', '')
const CLICS = Number(opt('--clics', '8'))
const LAT = Number(opt('--lat', '-21.115'))
const LON = Number(opt('--lon', '55.536'))
const ZOOM = opt('--zoom', '9') === 'null' ? null : Number(opt('--zoom', '9'))
const EXP = opt('--exp', '0') === '1'
const ANIMATIONS = opt('--animations', '1') !== '0'
const SORTIE = opt('--sortie', null)
const DBG_PORT = Number(opt('--dbg', '9335'))
const LARGEUR = 1280, HAUTEUR = 800
const ALTITUDE = Number(opt('--altitude', '60000000'))

const dors = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable : --chrome <chemin>'); process.exit(2) }
  return t
}
function getJson(url) {
  return new Promise((res, rej) => { http.get(url, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { rej(e) } }) }).on('error', rej) })
}
class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.attente = new Map(); this.ecouteurs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id != null && this.attente.has(m.id)) { const { res, rej } = this.attente.get(m.id); this.attente.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) }
      else if (m.method) for (const f of this.ecouteurs) f(m)
    }
  }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId; this.ws.send(JSON.stringify(msg)); return new Promise((res, rej) => this.attente.set(id, { res, rej })) }
  on(f) { this.ecouteurs.push(f) }
}
async function lancerChrome() {
  const chrome = trouverChrome()
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'r35-chrome-'))
  const args = ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profil}`, `--window-size=${LARGEUR},${HAUTEUR}`, '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', 'about:blank']
  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let version = null
  for (let i = 0; i < 100 && !version; i++) { try { version = await getJson(`http://127.0.0.1:${DBG_PORT}/json/version`) } catch { await dors(100) } }
  if (!version) { proc.kill(); throw new Error('Chrome ne répond pas') }
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const cdp = new Cdp(ws)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const fermer = async () => { try { ws.close() } catch { /* rien */ } proc.kill(); await dors(300); try { fs.rmSync(profil, { recursive: true, force: true }) } catch { /* rien */ } }
  return { cdp, sessionId, fermer, version: version.Browser }
}
async function ouvrirPage() {
  const { cdp, sessionId: s, fermer, version } = await lancerChrome()
  const journal = []
  cdp.on((m) => {
    if (m.sessionId !== s) return
    if (m.method === 'Runtime.consoleAPICalled') journal.push({ quoi: 'console', niveau: m.params.type, texte: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') })
    else if (m.method === 'Runtime.exceptionThrown') journal.push({ quoi: 'exception', texte: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text })
  })
  await cdp.send('Page.enable', {}, s)
  await cdp.send('Runtime.enable', {}, s)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1, mobile: false }, s)
  const evaluer = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s)
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result.value
  }
  const naviguer = (url) => cdp.send('Page.navigate', { url }, s)
  const touche = async (key, code) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: 27 }, s)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: 27 }, s)
  }
  const souris = (p) => cdp.send('Input.dispatchMouseEvent', p, s)
  return { fermer, version, journal, evaluer, naviguer, touche, souris }
}

async function attendrePret(p, maxMs = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (await p.evaluer(`(() => { const e = window.__exp; return !!(e && e.renderer && e.renderer.info.render.frame > 3 && document.getElementById('loading')?.classList.contains('hidden')) })()`)) return Date.now() - t0
    await dors(250)
  }
  throw new Error('la page n’a pas dessiné')
}
// immobile = la caméra qui rend ne bouge plus ET rien n'est en cours
async function attendreImmobile(p, maxMs = 40000, seuil = 1e-5) {
  const t0 = Date.now()
  let avant = await p.evaluer(`(window.__exp.camGlobe || window.__exp.camera).position.toArray()`)
  while (Date.now() - t0 < maxMs) {
    await dors(500)
    const apres = await p.evaluer(`(window.__exp.camGlobe || window.__exp.camera).position.toArray()`)
    const bouge = Math.hypot(...avant.map((v, i) => v - apres[i]))
    const occupe = await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween || window.__exp.tween.active)`)
    if (bouge < seuil && !occupe) return Date.now() - t0
    avant = apres
  }
  return -1
}

// LA SONDE EN PAGE — au rendu, sur la caméra qui rend
const SONDE = `(() => {
  if (window.__r35) return 'déjà posée'
  const e = window.__exp
  const st = { trames: [], compter: false, marques: [], nan: null, images: 0 }
  const v = new (e.camera.position.constructor)()
  const orig = e.composer.render.bind(e.composer)
  const nanDe = (o) => o && [o.x, o.y, o.z].some((x) => !Number.isFinite(x))
  e.composer.render = function (dt) {
    st.images++
    const r = orig(dt)
    const cg = e.camGlobe || e.camera
    const cam = e.camera
    const orbital = e.modes.mode === 'orbital'
    // la caméra qui rend : camGlobe hors orbite (similitude), camera en orbite (espace globe)
    const cr = orbital ? cam : cg
    const dG = cr.position.length() // unités globe (R_GLOBE = 100)
    v.set(0, 0, 0).project(cr)
    const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight
    const d = e.controls.getDistance()
    const t = { i: st.images, t: performance.now(), mode: e.modes.mode, busy: !!e.modes.busy, zoom: e.params.demZoom,
      altG: (dG - 100) * 63710, dG, cx: px, cy: py, lnd: Math.log(d), camY: cam.position.y,
      nanCam: nanDe(cam.position), nanCg: nanDe(cg.position), altM: e.modes.altM, tween: !!e.tween.active, travel: !!e.modes.travel, diveTween: !!e.modes._diveTween }
    if (st.compter) st.trames.push(t)
    if (!st.nan && (t.nanCam || t.nanCg || !Number.isFinite(t.altM))) st.nan = { image: st.images, ...t }
    return r
  }
  const annonce = e.modes.announce.bind(e.modes)
  e.modes.announce = (m) => { st.marques.push({ i: st.images, texte: m }); return annonce(m) }
  st.releve = () => { const t = st.trames; st.trames = []; return t }
  window.__r35 = st
  return 'posée'
})()`

// LE TRACEUR DE NaN — chaque écrivain de la caméra est enveloppé ; après son
// retour on regarde si la caméra ou l'état est passé à NaN, et on note le
// PREMIER coupable avec ses arguments.
const TRACEUR = `(() => {
  const e = window.__exp, m = e.modes
  const st = window.__r35
  st.traces = []
  const etat = () => ({ cam: e.camera.position.toArray(), cible: e.controls.target.toArray(), orbAlt: m.orbAlt, altM: m.altM, mode: m.mode, travel: m.travel ? { t: m.travel.t, fromAlt: m.travel.fromAlt, cruise: m.travel.cruise, endAlt: m.travel.endAlt, fromDir: m.travel.fromDir.toArray(), toDir: m.travel.toDir.toArray() } : null })
  const nanDans = (o) => JSON.stringify(o, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'NaN' : x)).includes('"NaN"')
  const envelopper = (nom) => {
    const f = m[nom]
    m[nom] = function (...args) {
      const avant = etat()
      const r = f.apply(this, args)
      const fin = () => { const apres = etat(); if (!nanDans(avant) && nanDans(apres)) st.traces.push({ nom, args: args.map((a) => (a && a.toArray ? a.toArray() : (typeof a === 'object' ? '[obj]' : a))), avant, apres, image: st.images }) }
      if (r && typeof r.then === 'function') return r.then((x) => { fin(); return x })
      fin(); return r
    }
  }
  for (const nom of ['enterOrbit', 'flyTo', '_updateTravel', '_dive', '_posePlongee', '_attendreLeBloc', '_suivreEmprise', '_rescale', '_applyZoom', '_arrivalPose', '_cibleVisee', '_poseButees', 'update']) if (typeof m[nom] === 'function') envelopper(nom)
  return 'traceur posé'
})()`

async function fermerVoile(p) {
  const t0 = Date.now()
  while (Date.now() - t0 < 15000 && !(await p.evaluer(`document.body.classList.contains('ce-hub')`))) await dors(250)
  await p.touche('Escape', 'Escape')
  await dors(400)
  return p.evaluer(`({ ferme: !document.body.classList.contains('ce-hub'), sousLeCentre: (document.elementFromPoint(innerWidth / 2, innerHeight / 2) || {}).tagName })`)
}

async function scenarioClic(p) {
  await p.evaluer(`window.__exp.modes.enterOrbit(${ALTITUDE})`)
  const t1 = Date.now()
  while (Date.now() - t1 < 30000 && !(await p.evaluer(`window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy`))) await dors(250)
  await dors(1500)
  console.log(`  orbite : ${await p.evaluer(`window.__exp.modes.mode`)} · immobile après ${await attendreImmobile(p)} ms`)
  await p.evaluer(`window.__r35.compter = true; window.__r35.releve()`)
  const sx = LARGEUR / 2, sy = HAUTEUR / 2
  const clics = []
  for (let n = 1; n <= CLICS; n++) {
    // le MNT du niveau précédent doit être arrivé : un clic pendant son vol mesurerait la course, pas le geste
    const tM = Date.now()
    while (Date.now() - tM < 30000 && !(await p.evaluer(`(() => { const e = window.__exp; return !e.modes.busy && (!e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0) && (e.modes.mode === "orbital" || !!(e.dem || e.terrain.fenetreBornee)) })()`))) await dors(250)
    const avant = await p.evaluer(`({ i: window.__r35.images, mode: window.__exp.modes.mode, altG: window.__r35.trames.at(-1)?.altG, zoom: window.__exp.params.demZoom })`)
    await p.souris({ type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: 1 })
    await dors(40)
    await p.souris({ type: 'mouseReleased', x: sx, y: sy, button: 'left', buttons: 0, clickCount: 1 })
    await dors(1500)
    const t0 = Date.now()
    while (Date.now() - t0 < 30000 && (await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween)`))) await dors(250)
    await attendreImmobile(p, 15000)
    const apres = await p.evaluer(`({ i: window.__r35.images, mode: window.__exp.modes.mode, altG: window.__r35.trames.at(-1)?.altG, zoom: window.__exp.params.demZoom })`)
    clics.push({ n, avant, apres })
    console.log(`  clic ${n} : ${avant.mode} ${Math.round(avant.altG / 1000)} km z${avant.zoom} → ${apres.mode} ${Math.round(apres.altG / 1000)} km z${apres.zoom} (${apres.i - avant.i} images)`)
  }
  const trames = await p.evaluer(`window.__r35.releve()`)
  // analyse : par clic, le pire rapport image à image, le pire |Δ ln d|, le pire déplacement du centre de la Terre
  for (const c of clics) {
    const seg = trames.filter((t) => t.i > c.avant.i && t.i <= c.apres.i + 2)
    let pire = 1, pireI = null, pireLnd = 0, cxMax = 0
    for (let k = 1; k < seg.length; k++) {
      const a = seg[k - 1], b = seg[k]
      const r = Math.max(a.dG / b.dG, b.dG / a.dG)
      if (r > pire) { pire = r; pireI = { image: b.i, avantKm: Math.round(a.altG / 1000), apresKm: Math.round(b.altG / 1000), mode: b.mode, busy: b.busy } }
      if (Number.isFinite(a.lnd) && Number.isFinite(b.lnd) && a.mode === b.mode) pireLnd = Math.max(pireLnd, Math.abs(b.lnd - a.lnd))
      cxMax = Math.max(cxMax, Math.hypot(b.cx - LARGEUR / 2, b.cy - HAUTEUR / 2))
    }
    c.pireRapport = +pire.toFixed(4); c.pireImage = pireI; c.pireDeltaLnd = +pireLnd.toExponential(2); c.centreTerreMaxPx = +cxMax.toFixed(1)
    console.log(`    → pire rapport ${c.pireRapport} ${pireI ? `(image ${pireI.image}, ${pireI.avantKm} → ${pireI.apresKm} km, ${pireI.mode}${pireI.busy ? '!' : ''})` : ''} · |Δ ln d| max ${c.pireDeltaLnd} · centre Terre max ${c.centreTerreMaxPx} px`)
  }
  const sauts = []
  for (let i = 1; i < trames.length; i++) { const a = trames[i - 1], b = trames[i]; const r = Math.max(a.dG / b.dG, b.dG / a.dG); if (r > 1.05) sauts.push({ image: b.i, avantKm: Math.round(a.altG / 1000), apresKm: Math.round(b.altG / 1000), rapport: +r.toFixed(3), mode: b.mode, busy: b.busy, zoom: b.zoom }) }
  return { images: trames.length, clics, sauts, nan: await p.evaluer(`window.__r35.nan`), marques: await p.evaluer(`window.__r35.marques.map((m) => m.i + ' ' + m.texte)`), trames }
}

async function scenarioFlyto(p) {
  await p.evaluer(TRACEUR)
  if (!ANIMATIONS) await p.evaluer(`window.__exp.params.animations = false`)
  const depart = await p.evaluer(`({ mode: window.__exp.modes.mode, altM: window.__exp.modes.altM, cam: window.__exp.camera.position.toArray(), zoom: window.__exp.params.demZoom, orbAlt: window.__exp.modes.orbAlt })`)
  console.log(`  départ : ${JSON.stringify(depart)}`)
  await p.evaluer(`window.__r35.compter = true; window.__r35.releve()`)
  const appel = EXP ? `window.__exp.flyTo(${LAT}, ${LON}, ${ZOOM})` : `window.__exp.modes.flyTo(${LAT}, ${LON}, ${ZOOM})`
  console.log(`  appel : ${appel}`)
  const retour = await p.evaluer(`Promise.resolve(${appel}).then((r) => String(r)).catch((e) => 'erreur : ' + e.message)`)
  console.log(`  retour : ${retour}`)
  const t0 = Date.now()
  let nan = null
  while (Date.now() - t0 < 40000) {
    await dors(250)
    nan = await p.evaluer(`window.__r35.nan`)
    if (nan) break
    if (!(await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.tween.active)`))) { await dors(1500); nan = await p.evaluer(`window.__r35.nan`); break }
  }
  await attendreImmobile(p, 20000)
  const trames = await p.evaluer(`window.__r35.releve()`)
  const arrivee = await p.evaluer(`({ mode: window.__exp.modes.mode, altM: window.__exp.modes.altM, cam: window.__exp.camera.position.toArray(), zoom: window.__exp.params.demZoom, lieu: window.__exp.params.demLat + ',' + window.__exp.params.demLon })`)
  const traces = await p.evaluer(`window.__r35.traces`)
  console.log(`  NaN au rendu : ${nan ? `image ${nan.image} (${nan.mode}, cam ${nan.nanCam}, camGlobe ${nan.nanCg}, altM ${nan.altM})` : 'aucun'}`)
  console.log(`  premier écrivain fautif : ${traces[0] ? traces[0].nom + ' ' + JSON.stringify(traces[0].args) : 'aucun'}`)
  console.log(`  arrivée : ${JSON.stringify(arrivee)}`)
  return { depart, appel, retour, nan, traces, arrivee, images: trames.length, marques: await p.evaluer(`window.__r35.marques.map((m) => m.i + ' ' + m.texte)`), trames: trames.slice(0, 400) }
}

const p = await ouvrirPage()
console.log(`Chrome ${p.version} · ${LARGEUR}×${HAUTEUR} · scénario ${SCENARIO}`)
let resultat
try {
  await p.naviguer(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`)
  console.log(`  premier dessin après ${await attendrePret(p)} ms`)
  await p.evaluer(SONDE)
  // la pose de démarrage arrive APRÈS le vol de présentation (8,3 s) : on
  // l'attend AVANT de fermer le voile (fermer avant annule le vol)
  await dors(9000)
  console.log(`  pose de démarrage : immobile après ${await attendreImmobile(p, 30000)} ms · d = ${(await p.evaluer(`window.__exp.controls.getDistance()`)).toFixed(2)}`)
  const voile = await fermerVoile(p)
  console.log(`  voile fermé : ${voile.ferme} · sous le centre : ${voile.sousLeCentre}`)
  if (!voile.ferme || voile.sousLeCentre !== 'CANVAS') throw new Error('voile non fermé ou toile couverte')
  if (SCENARIO === 'clic') resultat = await scenarioClic(p)
  else if (SCENARIO === 'flyto') resultat = await scenarioFlyto(p)
  else throw new Error('scénario inconnu')
  resultat.exceptionsPage = p.journal.filter((j) => j.quoi === 'exception').map((j) => j.texte).slice(0, 10)
  resultat.erreursConsole = p.journal.filter((j) => j.niveau === 'error').map((j) => j.texte).slice(0, 10)
  if (resultat.exceptionsPage.length) console.log('  exceptions : ' + JSON.stringify(resultat.exceptionsPage))
  if (SORTIE) { fs.mkdirSync(path.dirname(SORTIE), { recursive: true }); fs.writeFileSync(SORTIE, JSON.stringify({ scenario: SCENARIO, banc: { port: PORT, url: URL_SUFFIXE, taille: [LARGEUR, HAUTEUR], chrome: p.version }, resultat }, null, 1)) }
} finally {
  await p.fermer()
}
