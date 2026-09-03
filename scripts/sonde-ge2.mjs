// SONDE GE2 — LE VOCABULAIRE SOURIS DE GOOGLE EARTH, MESURÉ GESTE PAR GESTE.
//
// ══════════ CE QU'ELLE MESURE, ET DANS QUELLE UNITÉ ═════════════════════════
//
// D19 impose que tout se vérifie « en mètres du centre de la Terre, en espace
// globe, ou en PIXELS à l'écran — jamais en unités de bloc ». Chaque geste rend
// donc les mêmes six colonnes, toutes en degrés ou en pixels :
//
//   ① inclinaison — l'angle entre l'axe optique et la verticale locale du point
//     sous la caméra, en DEGRÉS. C'est la grandeur de D16 ter.
//   ② cap — l'angle du haut de l'écran contre le nord local, en DEGRÉS.
//   ③ altitude — en mètres au-dessus de la sphère, et le RAPPORT avant/après
//     (le zoom d'un clic droit se lit là).
//   ④ point du CENTRE de l'écran — le point de la sphère visé au centre avant
//     le geste, reprojeté après, en PIXELS de dérive. C'est le pivot de D19 ②.
//   ⑤ point SAISI sous le curseur — même chose au point du pointeur (D19 ①).
//   ⑥ |Δ ln d| max par image — la grandeur de `veille-repos`, seuil 1e-4.
//
// ⚠️ **TOUT SE LIT SUR LA CAMÉRA QUI REND** : `camGlobe` sous la frontière,
// `camera` en orbite (les deux espaces y coïncident) — c'est le patron de R32 et
// R35. Et le relevé se fait AU RENDU (`composer.render` enveloppé), pas dans
// `controls.update` : `redresserSurLeSol` écrit `camera.position` après.
//
// ══════════ LE BANC ═════════════════════════════════════════════════════════
//
// Chrome sans tête 1280 × 800, CDP brut. Le voile d'accueil est fermé APRÈS le
// vol de présentation (~8,3 s) et VÉRIFIÉ (`elementFromPoint` au centre doit
// rendre `CANVAS` — et c'est `.ce-elemwrap`, pas `.ce-hubveil`, qui avale les
// gestes). Vite doit écouter sur `--host 127.0.0.1`.
//
// USAGE : node scripts/sonde-ge2.mjs --port 6841 --alt 10000000 --sortie f.json
//   --gestes liste,séparée,par,virgules   (défaut : tous)
//   --alt <mètres>  l'altitude d'orbite visée avant les gestes

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const PORT = Number(opt('--port', '6841'))
const URL_SUFFIXE = opt('--url', '')
const ALTITUDE = Number(opt('--alt', '10000000'))
const SORTIE = opt('--sortie', null)
const DBG_PORT = Number(opt('--dbg', '9351'))
const COURSE_PX = Number(opt('--course', '200'))
const CRANS = Number(opt('--crans', '0'))
const VOL_DABORD = A.includes('--vol-dabord')
const VOL = opt('--vol', null) // 'lat,lon,zoom' : le vol de contrôle de D16 ter
const PAS_PX = Number(opt('--pas', '20'))
const W = 1280, H = 800
const TOUS = ['gauche-h', 'gauche-v', 'molette', 'droite-v', 'droite-h', 'milieu-v', 'milieu-h', 'ctrl-v', 'ctrl-h', 'maj-h', 'alt-h', 'double-clic', 'menu', 'elan']
const GESTES = (opt('--gestes', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const LISTE = GESTES.length ? GESTES : TOUS

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
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'ge2-chrome-'))
  const args = ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profil}`, `--window-size=${W},${H}`, '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', 'about:blank']
  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let version = null
  for (let i = 0; i < 120 && !version; i++) { try { version = await getJson(`http://127.0.0.1:${DBG_PORT}/json/version`) } catch { await dors(100) } }
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, s)
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
  const souris = (p) => cdp.send('Input.dispatchMouseEvent', { pointerType: 'mouse', ...p }, s)
  return { fermer, version, journal, evaluer, naviguer, touche, souris }
}

// ═══════════════ LA SONDE EN PAGE — au rendu, sur la caméra qui rend ═════════
const SONDE = `(() => {
  if (window.__ge2) return 'déjà posée'
  const e = window.__exp
  const R = 100 // R_GLOBE : le rayon de la sphère en unités globe
  const st = { trames: [], compter: false, images: 0, menus: [], dbl: 0 }
  const V = e.THREE.Vector3
  const tmp = new V(), tmp2 = new V()
  const camRend = () => (e.modes.mode === 'orbital' ? e.camera : (e.camGlobe || e.camera))
  const latLonDe = (p) => { const r = Math.hypot(p.x, p.y, p.z); return { lat: Math.asin(Math.max(-1, Math.min(1, p.y / r))) * 180 / Math.PI, lon: Math.atan2(p.x, p.z) * 180 / Math.PI, r } }
  const vecDe = (lat, lon) => { const a = lat * Math.PI / 180, o = lon * Math.PI / 180; return new V(Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)) }
  // le point de la sphère sous un pixel — null si le rayon rate le disque
  const sousLePixel = (px, py) => {
    const c = camRend()
    const d = new V(((px / innerWidth) * 2 - 1), -((py / innerHeight) * 2 - 1), 0.5).unproject(c).sub(c.position).normalize()
    const o = c.position
    const b = o.dot(d), cc = o.dot(o) - R * R, disc = b * b - cc
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    return latLonDe(tmp.copy(o).addScaledVector(d, t))
  }
  // le pixel d'un lat/lon (null si derrière la caméra)
  const pixelDe = (lat, lon) => {
    const c = camRend()
    const p = vecDe(lat, lon).multiplyScalar(R)
    tmp2.copy(p).project(c)
    if (tmp2.z > 1) return null
    return [(tmp2.x * 0.5 + 0.5) * innerWidth, (-tmp2.y * 0.5 + 0.5) * innerHeight]
  }
  // ① l'inclinaison : l'axe optique contre la verticale locale du point sous la caméra
  const inclinaisonDeg = () => {
    const c = camRend()
    const up = tmp.copy(c.position).normalize()
    const avant = tmp2.set(0, 0, -1).applyQuaternion(c.quaternion)
    return Math.acos(Math.max(-1, Math.min(1, -avant.dot(up)))) * 180 / Math.PI
  }
  // ② le cap : le haut de l'écran contre le nord local
  const capDeg = () => {
    const c = camRend()
    const up = new V().copy(c.position).normalize()
    const nord = new V(-up.x * up.y, 1 - up.y * up.y, -up.z * up.y)
    if (nord.lengthSq() < 1e-18) return 0
    nord.normalize()
    const est = new V().crossVectors(nord, up)
    const haut = new V(0, 1, 0).applyQuaternion(c.quaternion)
    return Math.atan2(-haut.dot(est), haut.dot(nord)) * 180 / Math.PI
  }
  const etat = () => {
    const c = camRend()
    const s = latLonDe(c.position)
    const centre = sousLePixel(innerWidth / 2, innerHeight / 2)
    return { i: st.images, t: performance.now(), mode: e.modes.mode, busy: !!e.modes.busy, zoom: e.params.demZoom,
      altM: (s.r - R) * 63710, dG: s.r, lat: s.lat, lon: s.lon,
      inclinaison: inclinaisonDeg(), cap: capDeg(),
      centre: centre ? { lat: centre.lat, lon: centre.lon } : null,
      cropPose: !!e.veilleCrop?.pose, horsDuCrop: !!e.modes.hooks?.horsDuCrop?.(),
      lnd: Math.log(e.controls.getDistance()),
      camY: e.camera.position.y, cible: [e.controls.target.x, e.controls.target.y, e.controls.target.z] }
  }
  const orig = e.composer.render.bind(e.composer)
  e.composer.render = function (dt) { st.images++; const r = orig(dt); if (st.compter) st.trames.push(etat()); return r }
  st.etat = etat
  st.pixelDe = (lat, lon) => pixelDe(lat, lon)
  st.sousLePixel = (px, py) => sousLePixel(px, py)
  st.releve = () => { const t = st.trames; st.trames = []; return t }
  // le menu contextuel : est-il empêché ? (et par qui)
  addEventListener('contextmenu', (ev) => st.menus.push({ i: st.images, empeche: ev.defaultPrevented, x: ev.clientX, y: ev.clientY }), false)
  addEventListener('dblclick', () => st.dbl++, true)
  window.__ge2 = st
  return 'posée'
})()`

async function attendrePret(p, maxMs = 120000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (await p.evaluer(`(() => { const e = window.__exp; return !!(e && e.renderer && e.renderer.info.render.frame > 3 && document.getElementById('loading')?.classList.contains('hidden')) })()`)) return Date.now() - t0
    await dors(250)
  }
  throw new Error('la page n’a pas dessiné')
}
async function attendreImmobile(p, maxMs = 40000, seuil = 1e-5) {
  const t0 = Date.now()
  let avant = await p.evaluer(`(window.__exp.camGlobe || window.__exp.camera).position.toArray()`)
  while (Date.now() - t0 < maxMs) {
    await dors(400)
    const apres = await p.evaluer(`(window.__exp.camGlobe || window.__exp.camera).position.toArray()`)
    const bouge = Math.hypot(...avant.map((v, i) => v - apres[i]))
    const occupe = await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween || window.__exp.tween.active)`)
    if (bouge < seuil && !occupe) return Date.now() - t0
    avant = apres
  }
  return -1
}
async function fermerVoile(p) {
  const t0 = Date.now()
  while (Date.now() - t0 < 20000 && !(await p.evaluer(`document.body.classList.contains('ce-hub')`))) await dors(250)
  await p.touche('Escape', 'Escape')
  await dors(500)
  return p.evaluer(`({ ferme: !document.body.classList.contains('ce-hub'), sousLeCentre: (document.elementFromPoint(innerWidth / 2, innerHeight / 2) || {}).tagName })`)
}

// ═══════════════ LES GESTES ═════════════════════════════════════════════════
const BOUTONS = { gauche: { button: 'left', buttons: 1 }, droit: { button: 'right', buttons: 2 }, milieu: { button: 'middle', buttons: 4 } }
const MODIF = { aucun: 0, alt: 1, ctrl: 2, maj: 8 }

async function glisse(p, { bouton = 'gauche', modif = 'aucun', dx = 0, dy = 0 }) {
  const b = BOUTONS[bouton], m = MODIF[modif]
  const x0 = W / 2, y0 = H / 2
  await p.souris({ type: 'mouseMoved', x: x0, y: y0, button: 'none', buttons: 0, modifiers: m })
  await p.souris({ type: 'mousePressed', x: x0, y: y0, ...b, clickCount: 1, modifiers: m })
  const n = Math.max(1, Math.round(Math.hypot(dx, dy) / PAS_PX))
  for (let k = 1; k <= n; k++) {
    await p.souris({ type: 'mouseMoved', x: x0 + (dx * k) / n, y: y0 + (dy * k) / n, button: b.button, buttons: b.buttons, modifiers: m })
    await dors(32)
  }
  await p.souris({ type: 'mouseReleased', x: x0 + dx, y: y0 + dy, button: b.button, buttons: 0, clickCount: 1, modifiers: m })
}

// Un geste mesuré : on fige l'état, on note le point du centre et le point saisi,
// on joue le geste, on attend l'apaisement, on relit — tout en px ou en degrés.
// ⚠️ **REMETTRE LA VUE À PLAT ENTRE DEUX GESTES — sinon on mesure la SOMME.**
// Première passe : les quatorze gestes s'enchaînaient sur la même caméra, et
// l'inclinaison héritée du bouton du milieu faussait tout ce qui suivait
// (`double-clic` rendait −11,6° d'inclinaison qu'il n'avait pas produits, et la
// saisie sous 55° d'inclinaison finissait à 3 225 px). La remise à plat emploie
// LE MÊME motif que le code mesuré — la rotation à rayon constant autour de
// `controls.target` — donc elle ne fabrique aucun `|Δ ln d|` de son cru.
async function remettreAPlat(p) {
  // ⛔ **PAS SUR LE CROP.** Première passe : la remise à plat y écrasait
  // l'inclinaison d'arrivée de D16 ter (46,476° → 0°) entre chaque geste, et le
  // banc mesurait alors une vue que l'application ne montre jamais. Sur le bloc,
  // la pose de trois quarts EST l'état normal.
  if (await p.evaluer('!!window.__exp.veilleCrop?.pose')) return
  await p.evaluer(`(() => { const e = window.__exp, c = e.controls
    const d = c.getDistance(); if (!(d > 0)) return 'pas de distance'
    e.camera.position.set(c.target.x, c.target.y + d, c.target.z)
    e.camera.lookAt(c.target); c.update(); return 'à plat' })()`)
  await dors(200)
}

async function mesurer(p, nom, jouer, { attendreMs = 1200 } = {}) {
  await p.evaluer(`window.__ge2.compter = true; window.__ge2.releve(); window.__ge2.menus.length = 0; window.__ge2.dbl = 0`)
  const avant = await p.evaluer(`(() => { const s = window.__ge2, e = s.etat()
    return { etat: e, saisi: s.sousLePixel(innerWidth / 2, innerHeight / 2) } })()`)
  await jouer()
  // ⚠️ **ON ATTEND QUE L'ÉLAN SOIT MORT AVANT DE LIRE.** Google Earth « lance »
  // la scène au relâché (τ = 0,35 s, R32), et lire 1,2 s après le relâché
  // mesurait un point de la course, pas sa fin : le point saisi rendait 0 px ou
  // 137 px selon la charge de l'image. On attend donc l'immobilité, puis on lit.
  await dors(attendreMs)
  await attendreImmobile(p, 12000, 1e-4)
  const trames = await p.evaluer(`window.__ge2.releve()`)
  const apres = await p.evaluer(`(() => { const s = window.__ge2, e = s.etat()
    const c = ${JSON.stringify(avant.etat.centre)}
    const g = ${JSON.stringify(avant.saisi)}
    return { etat: e,
      pxCentre: c ? s.pixelDe(c.lat, c.lon) : null,
      pxSaisi: g ? s.pixelDe(g.lat, g.lon) : null,
      menus: s.menus.slice(), dbl: s.dbl } })()`)
  await p.evaluer(`window.__ge2.compter = false`)
  let lnd = 0
  for (let k = 1; k < trames.length; k++) {
    const a = trames[k - 1], b = trames[k]
    if (a.mode === b.mode && Number.isFinite(a.lnd) && Number.isFinite(b.lnd)) lnd = Math.max(lnd, Math.abs(b.lnd - a.lnd))
  }
  const dPx = (q, cible) => (q ? +Math.hypot(q[0] - cible[0], q[1] - cible[1]).toFixed(2) : null)
  // le curseur a fini là où le geste l'a laissé : c'est `finPointeur`, posé par le joueur
  const fin = jouer.finPointeur || [W / 2, H / 2]
  const r = {
    geste: nom,
    images: trames.length,
    altAvantM: Math.round(avant.etat.altM), altApresM: Math.round(apres.etat.altM),
    rapportAlt: +((avant.etat.altM + 6371000) / (apres.etat.altM + 6371000)).toFixed(4),
    dInclinaisonDeg: +(apres.etat.inclinaison - avant.etat.inclinaison).toFixed(3),
    inclinaisonApresDeg: +apres.etat.inclinaison.toFixed(3),
    dCapDeg: +(((apres.etat.cap - avant.etat.cap + 540) % 360) - 180).toFixed(3),
    dLatDeg: +(apres.etat.lat - avant.etat.lat).toFixed(4),
    dLonDeg: +(((apres.etat.lon - avant.etat.lon + 540) % 360) - 180).toFixed(4),
    centreDerivePx: dPx(apres.pxCentre, [W / 2, H / 2]),
    saisiSousCurseurPx: dPx(apres.pxSaisi, fin),
    deltaLndMax: +lnd.toExponential(2),
    menus: apres.menus, dblclick: apres.dbl,
    modeAvant: avant.etat.mode, modeApres: apres.etat.mode,
  }
  console.log(`  ${nom.padEnd(13)} alt ${r.altAvantM > 9999 ? Math.round(r.altAvantM / 1000) + ' km' : r.altAvantM + ' m'} → ${r.altApresM > 9999 ? Math.round(r.altApresM / 1000) + ' km' : r.altApresM + ' m'} (×${(1 / r.rapportAlt).toFixed(3)}) · Δincl ${r.dInclinaisonDeg}° · Δcap ${r.dCapDeg}° · Δlat/lon ${r.dLatDeg}/${r.dLonDeg}° · centre ${r.centreDerivePx} px · saisi ${r.saisiSousCurseurPx} px · |Δln d| ${r.deltaLndMax}`)
  return r
}

async function molette(p, crans, delta = 100) {
  for (let k = 0; k < crans; k++) {
    await p.souris({ type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: delta, modifiers: 0 })
    await dors(120)
  }
}

// ═══════════════ LE DÉROULÉ ═════════════════════════════════════════════════
const p = await ouvrirPage()
console.log(`Chrome ${p.version} · ${W}×${H} · port ${PORT} · altitude visée ${Math.round(ALTITUDE / 1000)} km`)
const resultats = []
try {
  await p.naviguer(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`)
  console.log(`  premier dessin après ${await attendrePret(p)} ms`)
  await p.evaluer(SONDE)
  // ⚠️ la pose de démarrage arrive APRÈS le vol de présentation (8,3 s) :
  // fermer le voile avant l'annule
  await dors(9000)
  console.log(`  pose de démarrage : immobile après ${await attendreImmobile(p, 30000)} ms`)
  const voile = await fermerVoile(p)
  console.log(`  voile fermé : ${voile.ferme} · sous le centre : ${voile.sousLeCentre}`)
  if (!voile.ferme || voile.sousLeCentre !== 'CANVAS') throw new Error('voile non fermé ou toile couverte')

  await p.evaluer(`window.__exp.modes.enterOrbit(${ALTITUDE})`)
  const t1 = Date.now()
  while (Date.now() - t1 < 40000 && !(await p.evaluer(`window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy`))) await dors(250)
  await attendreImmobile(p, 20000)
  // descente à la MOLETTE jusqu'au régime voulu — c'est la porte que `gestes.js`
  // désigne comme unique : l'escalier de paliers n'a pas d'autre entrée
  let d16ter = null
  let volD16 = null
  if (CRANS > 0) {
    // ⚡ **D16 TER SE VÉRIFIE PENDANT LA DESCENTE, PAS APRÈS.** « On passe en vue
    // 3/4 quand on arrive au bloc, pas avant » : on relève donc l'inclinaison À
    // CHAQUE IMAGE de la descente, avec l'état du crop, et on cherche la
    // PREMIÈRE image où elle dépasse un degré. Si le crop n'y est pas posé,
    // D16 ter est violée — et c'est le seul énoncé qui la teste.
    await p.evaluer(`window.__ge2.compter = true; window.__ge2.releve()`)
    for (let k = 0; k < CRANS; k++) {
      await p.souris({ type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: -100, modifiers: 0 })
      await dors(500)
      const t = Date.now()
      while (Date.now() - t < 30000 && (await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween)`))) await dors(250)
    }
    await attendreImmobile(p, 25000)
    const trames = await p.evaluer(`window.__ge2.releve()`)
    await p.evaluer(`window.__ge2.compter = false`)
    const e = await p.evaluer(`window.__ge2.etat()`)
    const horsDuCrop = await p.evaluer(`!!window.__exp.modes.hooks?.horsDuCrop?.()`)
    const premiere = trames.find((t) => t.inclinaison > 1)
    d16ter = {
      images: trames.length,
      inclinaisonMaxDeg: +Math.max(0, ...trames.map((t) => t.inclinaison)).toFixed(3),
      premiereInclinaison: premiere ? { image: premiere.i, altKm: Math.round(premiere.altM / 1000), inclinaison: +premiere.inclinaison.toFixed(3), zoom: premiere.zoom } : null,
      arriveeHorsDuCrop: horsDuCrop, altFinaleKm: Math.round(e.altM / 1000), zoomFinal: e.zoom,
    }
    console.log(`  descente ${CRANS} crans : ${e.mode} · ${Math.round(e.altM / 1000)} km · z${e.zoom} · hors du crop ${horsDuCrop}`)
    console.log(`  D16 ter : inclinaison max ${d16ter.inclinaisonMaxDeg}° sur ${trames.length} images · première > 1° : ${premiere ? `image ${premiere.i} à ${d16ter.premiereInclinaison.altKm} km` : 'AUCUNE'}`)
  }
  const depart = await p.evaluer(`window.__ge2.etat()`)
  console.log(`  départ : ${depart.mode} · ${Math.round(depart.altM / 1000)} km · inclinaison ${depart.inclinaison.toFixed(2)}° · cap ${depart.cap.toFixed(2)}°`)

  // ⚠️ **LE GLOBE TOURNE SEUL** — `main.js` : en orbite, sans geste depuis 3 s,
  // `camera.position.applyAxisAngle(UP, dtAmb * 0.035)`, soit **2,0 °/s**. Une
  // attente d'apaisement de plus de 3 s le déclenche, et toute dérive de
  // longitude devient illisible (mesuré : 0,96° de longitude parasite sur un
  // `droite-v` pourtant INERTE). On le gèle par `dtAmb`, l'interrupteur
  // d'animations : c'est le SEUL delta que reçoit cette rotation.
  const gel = await p.evaluer(`(() => { const e = window.__exp; const av = e.params.animations; e.params.animations = false; return { avant: av, apres: e.params.animations } })()`)
  console.log(`  rotation propre : ${JSON.stringify(gel)}`)

  // le vol de contrôle, appelable avant les gestes (--vol-dabord, pour mesurer
  // SUR le crop) ou après (le défaut, pour mesurer D16 ter sur une descente nue)
  async function volDeControle() {
    // ══════════ D16 TER, LE TEST QUI COMPTE : LA DESCENTE JUSQU'AU BLOC ═══════
    //
    // ⚠️ **22 CRANS DE MOLETTE NE DESCENDENT QUE JUSQU'À 3 374 km** — le pas de
    // l'escalier est petit en surface, et une descente à la molette jusqu'au bloc
    // demanderait des centaines de crans et un quart d'heure. Le vol y va d'un
    // coup, par le chemin que la machine emprunte elle-même, et c'est LUI qu'il
    // faut regarder : D16 ter parle de ce que la vue fait TOUTE SEULE.
    if (VOL) {
      const [lat, lon, zoom] = VOL.split(',').map(Number)
      await p.evaluer(`window.__ge2.compter = true; window.__ge2.releve()`)
      await p.evaluer(`Promise.resolve(window.__exp.modes.flyTo(${lat}, ${lon}, ${zoom})).then(String).catch((e) => 'erreur : ' + e.message)`)
      const t = Date.now()
      while (Date.now() - t < 90000 && (await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween || window.__exp.tween.active)`))) await dors(300)
      await attendreImmobile(p, 30000)
      await dors(1500)
      const tr = await p.evaluer(`window.__ge2.releve()`)
      await p.evaluer(`window.__ge2.compter = false`)
      const premiere = tr.find((x) => x.inclinaison > 1)
      const avantCrop = tr.filter((x) => !x.cropPose)
      volD16 = {
        lieu: [lat, lon, zoom], images: tr.length,
        inclinaisonMaxAvantLeCrop: +Math.max(0, ...avantCrop.map((x) => x.inclinaison)).toFixed(3),
        imagesAvantLeCrop: avantCrop.length,
        premiereInclinaison: premiere ? { image: premiere.i, altKm: +(premiere.altM / 1000).toFixed(1), inclinaison: +premiere.inclinaison.toFixed(3), cropPose: premiere.cropPose, horsDuCrop: premiere.horsDuCrop } : null,
        finale: tr.length ? { altM: Math.round(tr[tr.length - 1].altM), inclinaison: +tr[tr.length - 1].inclinaison.toFixed(3), cropPose: tr[tr.length - 1].cropPose } : null,
      }
      console.log(`  D16 ter (vol) : ${tr.length} images · inclinaison max AVANT le crop ${volD16.inclinaisonMaxAvantLeCrop}° sur ${avantCrop.length} images`)
      console.log(`     première > 1° : ${premiere ? `image ${premiere.i}, ${volD16.premiereInclinaison.altKm} km, crop posé ${premiere.cropPose}` : 'AUCUNE'} · arrivée ${JSON.stringify(volD16.finale)}`)
    }
  }
  if (VOL_DABORD) await volDeControle()

  const remettre = async () => { await attendreImmobile(p, 12000); await remettreAPlat(p); await dors(400) }

  for (const g of LISTE) {
    if (g === 'gauche-h') { const j = () => glisse(p, { dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'gauche-v') { const j = () => glisse(p, { dx: 0, dy: -COURSE_PX }); j.finPointeur = [W / 2, H / 2 - COURSE_PX]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'molette') resultats.push(await mesurer(p, g, () => molette(p, 3)))
    else if (g === 'droite-v') { const j = () => glisse(p, { bouton: 'droit', dx: 0, dy: -COURSE_PX }); j.finPointeur = [W / 2, H / 2 - COURSE_PX]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'droite-h') { const j = () => glisse(p, { bouton: 'droit', dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'milieu-v') { const j = () => glisse(p, { bouton: 'milieu', dx: 0, dy: -COURSE_PX }); j.finPointeur = [W / 2, H / 2 - COURSE_PX]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'milieu-h') { const j = () => glisse(p, { bouton: 'milieu', dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'ctrl-v') { const j = () => glisse(p, { modif: 'ctrl', dx: 0, dy: -COURSE_PX }); j.finPointeur = [W / 2, H / 2 - COURSE_PX]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'ctrl-h') { const j = () => glisse(p, { modif: 'ctrl', dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'maj-h') { const j = () => glisse(p, { modif: 'maj', dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'alt-h') { const j = () => glisse(p, { modif: 'alt', dx: COURSE_PX, dy: 0 }); j.finPointeur = [W / 2 + COURSE_PX, H / 2]; resultats.push(await mesurer(p, g, j)) }
    else if (g === 'double-clic') {
      resultats.push(await mesurer(p, g, async () => {
        for (const n of [1, 2]) {
          await p.souris({ type: 'mousePressed', x: W / 2, y: H / 2, button: 'left', buttons: 1, clickCount: n })
          await dors(30)
          await p.souris({ type: 'mouseReleased', x: W / 2, y: H / 2, button: 'left', buttons: 0, clickCount: n })
          await dors(60)
        }
      }, { attendreMs: 4000 }))
    } else if (g === 'menu') {
      resultats.push(await mesurer(p, g, async () => {
        await p.souris({ type: 'mousePressed', x: W / 2, y: H / 2, button: 'right', buttons: 2, clickCount: 1 })
        await dors(50)
        await p.souris({ type: 'mouseReleased', x: W / 2, y: H / 2, button: 'right', buttons: 0, clickCount: 1 })
      }, { attendreMs: 800 }))
    } else if (g === 'elan') {
      // l'élan : combien la vue continue APRÈS le relâché, en degrés d'arc
      await p.evaluer(`window.__ge2.compter = true; window.__ge2.releve()`)
      await glisse(p, { dx: COURSE_PX, dy: 0 })
      // ⚠️ **L'ÉLAN SE LIT À LA SOURCE, PAS SEULEMENT À L'ŒIL.** `saisieTerre.elan`
      // est la vitesse (°/s) que `relacherSaisie` a armée au relâché ; un banc
      // sans tête peut manquer la course elle-même (elle dure τ = 0,35 s et la
      // cadence y est irrégulière), mais il ne peut pas manquer le fait qu'elle
      // a été armée. Première passe : la course rendait 0° et j'ai cru l'avoir
      // cassée — c'était le banc, pas le code.
      const arme = await p.evaluer(`({ ...window.__exp.saisieTerre.elan })`)
      const auLache = await p.evaluer(`window.__ge2.etat()`)
      // relevé DENSE : l'élan décroît en exp(−t/τ) avec τ = 0,35 s, il est mort
      // en ~1 s. Un seul point à 1,5 s ne dit pas s'il a existé.
      const suite = []
      for (let k = 0; k < 15; k++) { await dors(100); suite.push(await p.evaluer(`window.__ge2.etat()`)) }
      const apres = suite[suite.length - 1]
      await p.evaluer(`window.__ge2.compter = false; window.__ge2.releve()`)
      const arc = (a, b) => Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180))
      const r = { geste: 'elan', apresLacheDeg: +arc(auLache, apres).toFixed(4), dureeMs: 1500,
        vitesseArmeeDegParS: +Math.hypot(arme.dLat, arme.dLon).toFixed(4),
        courbe: suite.map((s) => +arc(auLache, s).toFixed(4)) }
      console.log(`  ${'elan'.padEnd(13)} vitesse armée ${r.vitesseArmeeDegParS} °/s · course ${r.apresLacheDeg}° d'arc en 1,5 s · courbe ${r.courbe.slice(0, 8).join(' ')}`)
      resultats.push(r)
    }
    await remettre()
  }
  if (!VOL_DABORD) await volDeControle()
  const fin = await p.evaluer(`window.__ge2.etat()`)
  console.log(`  fin : ${fin.mode} · ${Math.round(fin.altM / 1000)} km · inclinaison ${fin.inclinaison.toFixed(2)}°`)
  const exceptions = p.journal.filter((j) => j.quoi === 'exception').map((j) => j.texte).slice(0, 10)
  if (exceptions.length) console.log('  exceptions : ' + JSON.stringify(exceptions))
  if (SORTIE) {
    fs.mkdirSync(path.dirname(SORTIE), { recursive: true })
    fs.writeFileSync(SORTIE, JSON.stringify({ banc: { port: PORT, url: URL_SUFFIXE, taille: [W, H], chrome: p.version, altitudeVisee: ALTITUDE, coursePx: COURSE_PX, crans: CRANS }, depart, d16ter, volD16, resultats, exceptions }, null, 1))
    console.log(`  → ${SORTIE}`)
  }
} finally {
  await p.fermer()
}
