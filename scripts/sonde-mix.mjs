// SONDE MIX — les deux défauts ① (scintillement) et ③ (décalage) d'Adrien.
//
// ══════════ CE QU'ELLE MESURE ═══════════════════════════════════════════════
//
// ① LE SCINTILLEMENT — relevé sur N IMAGES CONSÉCUTIVES, jamais sur une seule
//   (le cycle de période 4 documenté du chantier). À CHAQUE image rendue on
//   note, DANS `composer.render` (pas après — une sonde posée après lit un état
//   écrasé) : `uEstompage`, `uEstompageOn`, `uCropOn`, `uHabOn`, `_cropSeul`,
//   `_crop` présent, le nombre de tuiles DESSINÉES, les appels de dessin, et
//   `veilleEstompage.valeur` / `.auRepos`. Un scintillement de COUCHE se lit
//   comme une bascule aller-retour d'un de ces états sur la fenêtre.
//
// ③ LE DÉCALAGE — le juge est un CHIFFRE. Deux écritures indépendantes de
//   « où tombe ce point géographique » :
//     · **le socle** — `mondeVersLatLonEmprise(emprise, x, z)`, la loi que le
//       MNT, le masque de côte, les toponymes et le drapage GPX suivent ;
//     · **le crop** — `latLonDeLocal(x/half, z/half, globe._crop)`, la loi que
//       le NUANCEUR applique pour découper et pour habiller.
//   On les confronte sur une grille de points du bloc, et on rend l'écart en
//   MÈTRES au sol et en PIXELS à l'écran (les deux lat/lon projetés sur la
//   sphère par la caméra QUI REND).
//
// EMPLOI
//   node scripts/sonde-mix.mjs --port 7931 --etiquette avant --lat 39.5 --lon 2.9
//   [--seuil-z10 1]   pose localement le seuil du crop à z10 (D23)
//
// Sort `.banc/MIX/<etiquette>.json` et des captures PNG.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const PORT = Number(opt('--port', '7931'))
const ETIQ = opt('--etiquette', 'releve')
const LAT = Number(opt('--lat', '39.5696'))
const LON = Number(opt('--lon', '2.6502'))
const ZOOM = Number(opt('--zoom', '11'))
const DBG_PORT = Number(opt('--dbg', '9401'))
const IMAGES = Number(opt('--images', '40'))
const CAPTURES = Number(opt('--captures', '0'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'MIX'))
const LARGEUR = 1280, HAUTEUR = 800
const dors = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
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
// ⛔ **ON NE TUE QUE NOTRE PROPRE CHROME** (PID connu) — consigne de banc du
// 2026-09-03, payée par le Chrome d'Adrien fermé à 23 h 39.
async function lancerChrome() {
  const chrome = trouverChrome()
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-chrome-'))
  const args = ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profil}`, `--window-size=${LARGEUR},${HAUTEUR}`, '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', 'about:blank']
  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let version = null
  for (let i = 0; i < 150 && !version; i++) { try { version = await getJson(`http://127.0.0.1:${DBG_PORT}/json/version`) } catch { await dors(100) } }
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
  const touche = async (key) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: 27 }, s)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: 27 }, s)
  }
  const capture = async (fichier) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, s)
    fs.writeFileSync(fichier, Buffer.from(r.data, 'base64'))
  }
  return { fermer, version, journal, evaluer, naviguer, touche, capture }
}

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
    await dors(500)
    const apres = await p.evaluer(`(window.__exp.camGlobe || window.__exp.camera).position.toArray()`)
    const bouge = Math.hypot(...avant.map((v, i) => v - apres[i]))
    const occupe = await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween || window.__exp.tween.active)`)
    if (bouge < seuil && !occupe) return Date.now() - t0
    avant = apres
  }
  return -1
}

// ═══════════════════ LA SONDE EN PAGE — DANS `composer.render` ═══════════════
const SONDE = `(() => {
  if (window.__mix) return 'déjà posée'
  const e = window.__exp
  const st = { trames: [], compter: false, images: 0 }
  window.__mix = st
  const R2D = 180 / Math.PI, D2R = Math.PI / 180
  const R_GLOBE = 100, TERRE_M = 6371000

  // — les DEUX écritures de « où tombe ce point du bloc »
  const mercXn = (lon) => (lon + 180) / 360
  const mercYn = (lat) => { const r = lat * D2R; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 }
  const mercatorYbrut = (lat) => { const r = lat * D2R; return Math.log(Math.tan(r) + 1 / Math.cos(r)) }
  // ① le SOCLE : geo.js mondeVersLatLonEmprise, la loi du MNT et de la carto
  const latLonSocle = (emprise, x, z, span) => {
    let large = emprise.est - emprise.ouest
    if (large <= 0) large += 360
    let lon = emprise.ouest + (x / span + 0.5) * large
    lon = ((((lon + 180) % 360) + 360) % 360) - 180
    const mN = mercatorYbrut(emprise.nord), mS = mercatorYbrut(emprise.sud)
    const m = mN + (z / span + 0.5) * (mS - mN)
    return { lat: Math.atan(Math.sinh(m)) * R2D, lon }
  }
  // ② le CROP : crop-sphere.js latLonDeLocal, la loi du NUANCEUR
  const latLonCrop = (rep, u, v) => {
    const mx = rep.cx + u * rep.demi, my = rep.cy + v * rep.demi
    const mxr = mx - Math.floor(mx)
    return { lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * R2D, lon: mxr * 360 - 180 }
  }
  const projeter = (cam, lat, lon) => {
    const g = e.globe
    const hM = g.hauteurDessinee ? (g.hauteurDessinee(lat, lon) || 0) : 0
    const r = R_GLOBE + hM * (R_GLOBE / TERRE_M) * (g.exaggeration || 1)
    const la = lat * D2R, lo = lon * D2R
    const v = new e.THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo))
    v.project(cam)
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, v.z]
  }
  const distM = (a, b) => {
    const dLat = (b.lat - a.lat) * D2R
    let dLon = (b.lon - a.lon); dLon -= Math.round(dLon / 360) * 360; dLon *= D2R
    const m = (a.lat + b.lat) / 2 * D2R
    return Math.hypot(dLat, dLon * Math.cos(m)) * TERRE_M
  }

  // ⚠️ **LE RELEVÉ D'ALIGNEMENT, APPELABLE SEUL** : neuf points du bloc
  // (les coins, les milieux d'arêtes, le centre), les deux lois confrontées.
  st.alignement = () => {
    const g = e.globe
    const rep = g._crop
    if (!rep) return { crop: false }
    const emprise = e.terrain.fenetreBornee?.emprise || null
    if (!emprise) return { emprise: false }
    const span = 56 // TERRAIN_SIZE
    const half = g.uniforms?.uCropDemi ? 28 : 28
    const cam = e.camGlobe || e.camera
    const pts = []
    for (const [fx, fz] of [[0,0],[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0],[-0.5,-0.5],[0.5,0.5]]) {
      const x = fx * half, z = fz * half
      const a = latLonSocle(emprise, x, z, span)
      const b = latLonCrop(rep, x / half, z / half)
      const pa = projeter(cam, a.lat, a.lon), pb = projeter(cam, b.lat, b.lon)
      pts.push({ fx, fz, socle: [a.lat, a.lon], crop: [b.lat, b.lon], m: distM(a, b), px: Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) })
    }
    return {
      crop: true, rep: { cx: rep.cx, cy: rep.cy, demi: rep.demi, zoom: rep.zoom }, emprise,
      demiSocleX: (() => { let l = emprise.est - emprise.ouest; if (l <= 0) l += 360; return l / 720 })(),
      demiSocleY: (mercYn(emprise.sud) - mercYn(emprise.nord)) / 2,
      maxM: Math.max(...pts.map(p => p.m)), maxPx: Math.max(...pts.map(p => p.px)), pts,
    }
  }

  // ⚠️ **LE TÉMOIN DE PIXELS — c'est lui qui départage un COMBAT DE PROFONDEUR
  // d'un fondu mal borné.** Un z-fighting scintille AU REPOS, caméra immobile ;
  // un fondu mal borné ne bouge qu'au moment de la bascule. On relit donc le
  // tampon de dessin à chaque image (un pixel sur 16) et on compte ceux qui ont
  // changé depuis l'image précédente.
  const gl = e.renderer.getContext()
  const LP = 1 / 4
  const W = Math.floor(e.renderer.domElement.width), H = Math.floor(e.renderer.domElement.height)
  let tampon = new Uint8Array(W * H * 4), precedent = null
  const lirePixels = () => {
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, tampon)
    } catch { return null }
    let chg = 0, fort = 0, somme = 0, n = 0
    if (precedent) {
      for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
        const k = (y * W + x) * 4; n++
        const d = Math.max(Math.abs(tampon[k] - precedent[k]), Math.abs(tampon[k + 1] - precedent[k + 1]), Math.abs(tampon[k + 2] - precedent[k + 2]))
        somme += d
        if (d > 8) chg++
        if (d > 64) fort++
      }
    } else n = 1
    const p = precedent; precedent = tampon; tampon = p || new Uint8Array(W * H * 4)
    return n ? { chg: chg / n, fort: fort / n, moy: somme / n } : null
  }
  st.pixels = false
  st.aligner = false

  // ══ LE SAUT DE FINESSE A LA FRONTIERE DU CROP — la SECONDE lecture de ③ ══
  //
  // A l interieur, le crop force z = ZOOM_SOCLE ; a l exterieur, le quadtree
  // choisit par la distance. Les deux Terres ne sont donc pas decrites par le
  // meme MNT le long du bord. On releve, sur des points du contour, le niveau
  // de la tuile DESSINEE juste dedans et juste dehors, et la hauteur que
  // chacune rend au MEME lat/lon — l ecart en metres, puis en pixels a l ecran.
  st.couture = () => {
    const g = e.globe, rep = g._crop
    if (!rep) return { crop: false }
    const cam = e.camGlobe || e.camera
    const toutes = g.tuilesAvecHauteurs ? g.tuilesAvecHauteurs() : []
    const tuileXY = (lat, lon, z) => { const n = 2 ** z; const la = lat * D2R; return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)] }
    const dessineeSous = (lat, lon) => { for (let z = 15; z >= 2; z--) { const [x, y] = tuileXY(lat, lon, z); const t = g.tiles.get(z + '/' + x + '/' + y); if (t && t.mesh && t.mesh.visible) return t } return null }
    const pts = []
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      const u = Math.cos(a), v = Math.sin(a)
      const dedans = latLonCrop(rep, u * 0.985, v * 0.985)
      const dehors = latLonCrop(rep, u * 1.015, v * 1.015)
      const ti = dessineeSous(dedans.lat, dedans.lon), te = dessineeSous(dehors.lat, dehors.lon)
      if (!ti || !te) continue
      // la MEME position geographique, lue par chacune des deux tuiles dessinees
      const milieu = latLonCrop(rep, u, v)
      const hi = g.hauteurDessinee(milieu.lat, milieu.lon, toutes.filter((t) => t === ti))
      const he = g.hauteurDessinee(milieu.lat, milieu.lon, toutes.filter((t) => t === te))
      if (hi == null || he == null) continue
      const pa = projeter(cam, milieu.lat, milieu.lon)
      const R = 100, exa = g.exaggeration || 1
      const pb = (() => { const la = milieu.lat * D2R, lo = milieu.lon * D2R
        const r = R + he * (R / TERRE_M) * exa
        const w = new e.THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)); w.project(cam)
        return [(w.x * 0.5 + 0.5) * innerWidth, (-w.y * 0.5 + 0.5) * innerHeight] })()
      pts.push({ k, zDedans: ti.z, zDehors: te.z, hDedans: hi, hDehors: he, dM: hi - he, dPx: Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) })
    }
    if (!pts.length) return { crop: true, points: 0 }
    return { crop: true, points: pts.length,
      dzMax: Math.max(...pts.map((p) => p.zDedans - p.zDehors)),
      dMmax: Math.max(...pts.map((p) => Math.abs(p.dM))),
      dPxMax: Math.max(...pts.map((p) => p.dPx)), pts }
  }

  const orig = e.composer.render.bind(e.composer)
  e.composer.render = function (dt) {
    st.images++
    const r = orig(dt)
    if (!st.compter) return r
    const px = st.pixels ? lirePixels() : null
    const g = e.globe, u = g.uniforms || {}
    let dessinees = 0
    for (const t of g.tiles.values()) if (t.mesh && t.mesh.visible) dessinees++
    const inf = e.renderer.info.render
    st.trames.push({
      i: st.images, t: Math.round(performance.now()),
      mode: e.modes.mode, busy: !!e.modes.busy,
      alt: e.altitudeCadrageM ? Math.round(e.altitudeCadrageM()) : null,
      est: u.uEstompage ? u.uEstompage.value : null, estOn: u.uEstompageOn ? u.uEstompageOn.value : null,
      cropOn: u.uCropOn ? u.uCropOn.value : null, habOn: u.uHabOn ? u.uHabOn.value : null,
      merRampeOn: u.uMerRampeOn ? u.uMerRampeOn.value : null,
      crop: !!g._crop, cropSeul: !!g._cropSeul,
      vEst: e.veilleEstompage ? e.veilleEstompage.valeur : null,
      vRepos: e.veilleEstompage ? e.veilleEstompage.auRepos : null,
      vSocle: e.veilleSocle ? e.veilleSocle.valeur : null,
      dessinees, calls: inf.calls, tri: inf.triangles,
      chg: px ? px.chg : null, fort: px ? px.fort : null, moy: px ? px.moy : null,
      camY: e.camera.position.y, dCible: e.camera.position.distanceTo(e.controls.target),
      // LE COUPLE QUI SE DESACCORDE PENDANT UN CRAN — le suspect de ③.
      // (Aucun accent grave dans ce bloc : il vit dans un template literal JS
      // et le terminerait — le piege que globe.js et terrain.js documentent.)
      // majSeuilSocle ne decide pas pendant busy parce que largeurBlocM() est
      // divisee par deux UNE IMAGE avant que _rescale ne double camY ;
      // majCameraFond, elle, N A PAS cette garde et pose la similitude sur le
      // couple desaccorde. On releve donc les deux moities, et la position a
      // l ecran d un point geographique FIXE, a chaque image.
      largeur: e.terrain.fenetreBornee?.largeurM ?? null,
      dGlobe: (e.camGlobe || e.camera).position.length(),
      capPx: (() => { const q = projeter(e.camGlobe || e.camera, ${LAT} + 0.35, ${LON} + 0.55); return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100] })(),
      // ③ PAR IMAGE, cran compris — l ecart entre la loi du SOCLE et celle du
      // CROP, en metres au sol et en pixels a l ecran, sur onze points du bloc.
      ...(st.aligner ? (() => { const a = st.alignement(); return a && a.crop ? { alM: a.maxM, alPx: a.maxPx } : { alM: null, alPx: null } })() : {}),
      parois: !!(g._paroisMesh && g._paroisMesh.visible), cache: g.tiles.size, file: g.queue.length, vol: g.inFlight,
    })
    if (st.trames.length > 8000) st.trames.splice(0, 2000)
    return r
  }
  st.releve = () => { const t = st.trames; st.trames = []; return t }
  return 'posée'
})()`

// ═════════════════════════════ LE DÉROULÉ ════════════════════════════════════
const p = await ouvrirPage()
console.log(`Chrome ${p.version} · ${LARGEUR}×${HAUTEUR} · MIX ${ETIQ}`)
const out = { etiquette: ETIQ, port: PORT, lieu: [LAT, LON], zoom: ZOOM, date: new Date().toISOString(), paliers: [] }
try {
  fs.mkdirSync(SORTIE, { recursive: true })
  await p.naviguer(`http://127.0.0.1:${PORT}/`)
  console.log(`  premier dessin après ${await attendrePret(p)} ms`)
  await p.evaluer(SONDE)
  await dors(9000)
  await attendreImmobile(p, 30000)
  await p.touche('Escape'); await dors(400)
  await p.evaluer(`document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelector('.ce-elemwrap')?.remove()`)
  out.voile = await p.evaluer(`({ sousLeCentre: (document.elementFromPoint(innerWidth/2, innerHeight/2)||{}).tagName })`)
  console.log(`  voile : ${JSON.stringify(out.voile)}`)

  // au lieu d'Adrien
  console.log(`  vol vers ${LAT}, ${LON} z${ZOOM}…`)
  await p.evaluer(`window.__exp.modes.flyTo(${LAT}, ${LON}, ${ZOOM})`)
  await dors(3000)
  await attendreImmobile(p, 60000)
  out.arrivee = await p.evaluer(`({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.(), zoom: window.__exp.params.demZoom, crop: !!window.__exp.globe._crop })`)
  console.log(`  arrivée : ${JSON.stringify(out.arrivee)}`)

  // ── la descente, palier par palier : à chaque palier, N images consécutives
  // ⚠️ **LA COUTURE SE MESURE PENDANT LE CRAN, PAS AU REPOS** : au repos rien
  // n'est dessine hors du crop (`_cropSeul`), donc il n'y a pas deux Terres a
  // confronter. Les deux representations ne coexistent QUE pendant le flash.
  const cranBouton = async (sens, echantillons = null) => {
    await p.evaluer(`window.__exp.modes.cranZoom(${sens})`)
    if (echantillons) {
      for (let n = 0; n < 10; n++) { await dors(90); const c = await p.evaluer(`window.__mix.couture()`); if (c && c.points) echantillons.push(c) }
    }
    await dors(400); await attendreImmobile(p, 25000)
  }
  // on remonte d'abord au-dessus de la bande, puis on redescend cran par cran
  for (let i = 0; i < 14; i++) {
    const a = await p.evaluer(`window.__exp.altitudeCadrageM?.()`)
    if (!(a > 0) || a > 250000) break
    await cranBouton(-1)
  }
  for (let k = 0; k < 20; k++) {
    const alt = await p.evaluer(`window.__exp.altitudeCadrageM?.()`)
    if (!(alt > 0)) break
    await p.evaluer(`window.__mix.pixels = true; window.__mix.aligner = true; window.__mix.compter = true; window.__mix.releve()`)
    await dors(IMAGES * 40)
    const trames = await p.evaluer(`window.__mix.releve()`)
    const align = await p.evaluer(`window.__mix.alignement()`)
    const couture = await p.evaluer(`window.__mix.couture()`)
    const palier = { k, alt: Math.round(alt), trames, align, couture }
    if (CAPTURES > 0 && k < CAPTURES) { const f = path.join(SORTIE, `${ETIQ}-${String(k).padStart(2, '0')}.png`); await p.capture(f); palier.capture = f }
    // ⚠️ **LE CRAN LUI-MÊME EST LA TRANSITION** — c'est là qu'Adrien voit le
    // scintillement, pas au repos. On garde le compteur allumé PENDANT.
    const coutures = []
    if (alt >= 12000) await cranBouton(+1, coutures)
    palier.coutures = coutures
    palier.tramesCran = await p.evaluer(`window.__mix.releve()`)
    await p.evaluer(`window.__mix.compter = false`)
    out.paliers.push(palier)
    const bascules = compterBascules(trames)
    const basculesCran = compterBascules(palier.tramesCran)
    console.log(`  palier ${k} · ${Math.round(alt)} m · repos ${trames.length} im ${JSON.stringify(bascules)} · cran ${palier.tramesCran.length} im ${JSON.stringify(basculesCran)} · cout/cran ${coutures.length ? 'dz ' + Math.max(...coutures.map(c=>c.dzMax)) + ' · ' + Math.max(...coutures.map(c=>c.dMmax)).toFixed(0) + ' m · ' + Math.max(...coutures.map(c=>c.dPxMax)).toFixed(1) + ' px' : '-'} · repos ${couture.points ? 'dz ' + couture.dzMax + ' · ' + couture.dMmax.toFixed(0) + ' m · ' + couture.dPxMax.toFixed(1) + ' px' : 'nc'} · align ${align.crop ? align.maxM.toFixed(1) + ' m / ' + align.maxPx.toFixed(2) + ' px' : 'pas de crop'}`)
    if (alt < 12000) break
  }
  out.exceptions = p.journal.filter((j) => j.quoi === 'exception').map((j) => j.texte).slice(0, 10)
  if (out.exceptions.length) console.log('  exceptions : ' + JSON.stringify(out.exceptions))
} finally {
  await p.fermer()
}

// combien de fois chaque état a BASCULÉ sur la fenêtre d'images — un
// scintillement de couche est une bascule aller-retour, jamais un seul front
function compterBascules(trames) {
  const champs = ['est', 'estOn', 'cropOn', 'habOn', 'crop', 'cropSeul', 'vEst', 'vRepos', 'parois']
  const out = {}
  for (const c of champs) {
    let n = 0
    for (let i = 1; i < trames.length; i++) if (trames[i][c] !== trames[i - 1][c]) n++
    if (n) out[c] = n
  }
  // le nombre de tuiles dessinées qui varie de plus de 2 d'une image à l'autre
  let saut = 0
  for (let i = 1; i < trames.length; i++) if (Math.abs(trames[i].dessinees - trames[i - 1].dessinees) > 2) saut++
  if (saut) out.dessinees = saut
  // ⚡ **LA MARCHE D'ESTOMPAGE — le critère ① .** Une image est SCINTILLANTE si
  // l'opacité de la couche « Terre autour » saute d'au moins un demi en une
  // image : c'est un affichage/désaffichage, pas un fondu.
  let marches = 0, pireMarche = 0
  for (let i = 1; i < trames.length; i++) {
    const a = trames[i - 1].est, b = trames[i].est
    if (typeof a !== 'number' || typeof b !== 'number') continue
    const d = Math.abs(b - a)
    if (d > pireMarche) pireMarche = d
    if (d >= 0.5) marches++
  }
  if (marches) out.marches = marches
  out.pireMarche = +pireMarche.toFixed(4)
  // le témoin de pixels AU REPOS : caméra immobile ET aucun état qui bascule
  let immobiles = 0, bougent = 0
  for (let i = 1; i < trames.length; i++) {
    const a = trames[i - 1], b = trames[i]
    if (typeof b.chg !== 'number') continue
    if (Math.abs(Math.log(b.dCible / a.dCible)) > 1e-6) continue
    immobiles++
    if (b.chg > 0.005) bougent++
  }
  out.imagesImmobiles = immobiles
  out.pixelsBougentImmobile = bougent
  return out
}

for (const pa of out.paliers) { pa.bascules = compterBascules(pa.trames); pa.basculesCran = compterBascules(pa.tramesCran || []) }
fs.writeFileSync(path.join(SORTIE, `${ETIQ}.json`), JSON.stringify(out, null, 1))
console.log(`→ ${path.join(SORTIE, ETIQ + '.json')}`)
