// SONDE R36 — LES BANDES DE LATITUDE DÉCALÉES
//
// Chrome sans tête au protocole (plomberie reprise de `sonde-r35.mjs`).
// Le serveur de dev doit tourner : `npm run dev -- --host 127.0.0.1 --port 5871`
//
// ⚠️ Vite DOIT écouter sur 127.0.0.1 : sans ça il n'écoute que sur [::1] et la
// sonde ne dessine jamais (piège relevé par R35).
//
// SCÉNARIOS (`--scenario`) :
//   flip    le test décisif de l'orientation : une ImageBitmap téléversée avec
//           UNPACK_FLIP_Y_WEBGL, relue au pixel. Ne touche pas la scène.
//   vue     pose forcée (lat, lon, altitude) et capture PNG + critère
//   critere le critère automatique aux trois altitudes × deux lieux
//
// OPTIONS : --port 5871 · --url "?x=1" · --lat --lon --altkm · --sortie f.json
//           --png fichier.png · --chrome <chemin> · --dbg 9336

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const SCENARIO = opt('--scenario', 'critere')
const PORT = Number(opt('--port', '5871'))
const URL_SUFFIXE = opt('--url', '')
const SORTIE = opt('--sortie', null)
const PNG = opt('--png', null)
const DBG_PORT = Number(opt('--dbg', '9336'))
const LARGEUR = 1280, HAUTEUR = 800
const ATTENTE = Number(opt('--attente', '9000'))

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
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'r36-chrome-'))
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
  const capture = async () => (await cdp.send('Page.captureScreenshot', { format: 'png' }, s)).data
  return { fermer, version, journal, evaluer, naviguer, capture }
}

async function attendrePret(p, maxMs = 120000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (await p.evaluer(`(() => { const e = window.__exp; return !!(e && e.renderer && e.renderer.info.render.frame > 3 && document.getElementById('loading')?.classList.contains('hidden')) })()`)) return Date.now() - t0
    await dors(250)
  }
  throw new Error('la page n a pas dessine')
}

// ── LE TEST DÉCISIF DE L'ORIENTATION ────────────────────────────────────────
// Une ImageBitmap de 2×2 dont la ligne du HAUT est rouge, téléversée avec
// UNPACK_FLIP_Y_WEBGL = true (ce que three écrit pour `texture.flipY`), puis
// relue. Si le rouge revient EN BAS, le drapeau a été honoré ; s'il revient en
// haut, l'ImageBitmap ignore le drapeau — et alors le chemin Worker rend une
// texture retournée par rapport au chemin canevas.
const TEST_FLIP = `(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 2
  const x = c.getContext('2d')
  x.fillStyle = '#ff0000'; x.fillRect(0, 0, 2, 1)   // ligne du HAUT rouge
  x.fillStyle = '#0000ff'; x.fillRect(0, 1, 2, 1)   // ligne du BAS bleue
  const bmp = await createImageBitmap(c)
  const g = document.createElement('canvas').getContext('webgl2')
  const lire = (src) => {
    const t = g.createTexture()
    g.bindTexture(g.TEXTURE_2D, t)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    const err = g.getError()
    const fb = g.createFramebuffer()
    g.bindFramebuffer(g.FRAMEBUFFER, fb)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0)
    const px = new Uint8Array(16)
    g.readPixels(0, 0, 2, 2, g.RGBA, g.UNSIGNED_BYTE, px)
    // readPixels rend la ligne 0 = BAS de la texture
    return { erreurGl: err, bas: [px[0], px[1], px[2]], haut: [px[8], px[9], px[10]] }
  }
  return { bitmap: lire(bmp), canevas: lire(c) }
})()`

// ── LA POSE FORCÉE ──────────────────────────────────────────────────────────
// Le globe tourne tout seul à ~2 °/s après 3 s ; `modes.update` repose la
// caméra à partir de sa direction courante, APRÈS la rotation propre. On
// enveloppe donc `composer.render` — le DERNIER écrivain avant l'image — et on
// y repose la caméra depuis (lat, lon, altitude). L'image devient déterministe.
const POSE = `(() => {
  if (window.__r36) return 'deja'
  const e = window.__exp
  const st = { lat: 0, lon: 0, altKm: 10000, actif: false, images: 0 }
  const R = 100, MPU = 63710
  const orig = e.composer.render.bind(e.composer)
  e.composer.render = function (dt) {
    if (st.actif) {
      const la = st.lat * Math.PI / 180, lo = st.lon * Math.PI / 180
      const r = R + (st.altKm * 1000) / MPU
      const cam = e.camera
      cam.position.set(
        r * Math.cos(la) * Math.sin(lo),
        r * Math.sin(la),
        r * Math.cos(la) * Math.cos(lo))
      cam.up.set(0, 1, 0)
      cam.lookAt(0, 0, 0)
      e.controls.target.set(0, 0, 0)
      e.modes.orbAlt = e.modes.orbAltTarget = (st.altKm * 1000) / MPU
      cam.updateMatrixWorld(true)
      cam.updateProjectionMatrix()
    }
    st.images++
    return orig(dt)
  }
  window.__r36 = st
  return 'posee'
})()`

// ── LE CRITÈRE AUTOMATIQUE ──────────────────────────────────────────────────
// Voir `rapport-R36.md`. Il se lit dans la SCÈNE, pas sur une capture : pour
// chaque tuile dessinée on compare la hauteur que le NUANCEUR lit dans la
// texture (téléversée telle que le GPU la voit) à la hauteur que la GÉOMÉTRIE
// porte au même endroit. Un décalage rend un nombre en texels, donc en degrés.
// ⚡ LE CRITÈRE — l'écart, EN MÈTRES, à la couture nord-sud entre deux tuiles
// voisines, lu dans les textures TELLES QUE LE GPU LES TIENT.
//
// Deux tuiles (z, x, y) et (z, x, y+1) partagent une ligne de latitude : la
// dernière ligne de texels de la première EST la première ligne de la seconde
// (terrarium, tuiles jointives). On attache chaque texture GL à un tampon, on
// relit la ligne de la couture des deux côtés, on décode en mètres, et on
// compare. Sur un globe sain, ces deux lignes sont la MÊME donnée : l'écart
// vaut 0. Toute erreur d'orientation, d'UV, de sous-fenêtre ou d'appariement
// (z, x, y) le fait exploser.
//
// ⚠️ readPixels rend la ligne 0 EN BAS de la texture. `v = 0` doit être le SUD
// de la tuile (y croît vers le sud en mercator) : la couture entre y et y+1 est
// donc la ligne v=0 de la tuile y et la ligne v=1 (dernière lue) de y+1.
//
// Rendu : { paires, ecartMoyenM, ecartMedianM, miroir } — `miroir` est le
// nombre de paires où l'écart TOMBE quand on relit la tuile du haut à l'envers,
// c'est-à-dire la signature d'une texture retournée.
const CRITERE = `(() => {
  const e = window.__exp
  const gl = e.renderer.getContext()
  const props = e.renderer.properties
  const tuiles = e.globe.tiles
  const glTex = (t) => {
    const tex = t && t.texture
    if (!tex) return null
    const p = props.get(tex)
    return p && p.__webglTexture ? p.__webglTexture : null
  }
  const fb = gl.createFramebuffer()
  const lignes = new Map()   // clé -> { bas: Float32Array, haut: Float32Array, px }
  const lire = (t) => {
    const gt = glTex(t)
    if (!gt) return null
    const px = t.size
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gt, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return null }
    const b = new Uint8Array(px * 4), h = new Uint8Array(px * 4)
    gl.readPixels(0, 0, px, 1, gl.RGBA, gl.UNSIGNED_BYTE, b)        // v = 0
    gl.readPixels(0, px - 1, px, 1, gl.RGBA, gl.UNSIGNED_BYTE, h)   // v = 1
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const m = (a) => { const o = new Float32Array(px); for (let i = 0, j = 0; i < px; i++, j += 4) o[i] = a[j] * 256 + a[j + 1] + a[j + 2] / 256 - 32768; return o }
    return { bas: m(b), haut: m(h), px }
  }
  const prets = []
  for (const t of tuiles.values()) if (t.state === 'ready' && t.mesh && t.mesh.visible && t.texture) prets.push(t)
  for (const t of prets) { const l = lire(t); if (l) lignes.set(t.z + '/' + t.x + '/' + t.y, l) }
  const ecarts = [], ecartsMiroir = []
  for (const t of prets) {
    const a = lignes.get(t.z + '/' + t.x + '/' + t.y)
    const b = lignes.get(t.z + '/' + t.x + '/' + (t.y + 1))
    if (!a || !b || a.px !== b.px) continue
    // la couture : v=0 de la tuile du HAUT (y) contre v=1 de celle du BAS (y+1)
    let s = 0, sm = 0
    for (let i = 0; i < a.px; i++) { s += Math.abs(a.bas[i] - b.haut[i]); sm += Math.abs(a.haut[i] - b.bas[i]) }
    ecarts.push(s / a.px)
    ecartsMiroir.push(sm / a.px)
  }
  const med = (v) => { if (!v.length) return null; const s = [...v].sort((p, q) => p - q); return s[s.length >> 1] }
  const moy = (v) => v.length ? v.reduce((p, q) => p + q, 0) / v.length : null
  return {
    tuilesPretes: prets.length,
    paires: ecarts.length,
    ecartMoyenM: moy(ecarts),
    ecartMedianM: med(ecarts),
    ecartMiroirMoyenM: moy(ecartsMiroir),
    miroir: ecarts.filter((v, i) => ecartsMiroir[i] < v).length
  }
})()`

function decrire(j) { return j.filter((l) => l.quoi === 'exception' || l.niveau === 'error' || l.niveau === 'warning').slice(0, 20) }

async function principal() {
  const p = await ouvrirPage()
  const res = { scenario: SCENARIO, chrome: p.version }
  try {
    if (SCENARIO === 'flip') {
      await p.naviguer('about:blank')
      await dors(500)
      res.flip = await p.evaluer(TEST_FLIP)
      console.log(JSON.stringify(res, null, 2))
      return
    }
    await p.naviguer(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`)
    res.pret = await attendrePret(p)
    await p.evaluer(`document.querySelectorAll('.ce-hubveil,.ce-elemwrap').forEach(n => n.remove())`)
    await p.evaluer(`window.__exp.modes.enterOrbit()`)
    await dors(4000)
    await p.evaluer(POSE)
    const lat = Number(opt('--lat', '0')), lon = Number(opt('--lon', '20')), altKm = Number(opt('--altkm', '10000'))
    if (SCENARIO === 'serie') {
      // trois altitudes orbitales × deux lieux, DANS LA MÊME SESSION
      const lieux = [{ nom: 'Afrique', lat: 0, lon: 20 }, { nom: 'Amerique du Sud', lat: -15, lon: -60 }]
      const alts = [2000, 10000, 30000]
      res.serie = []
      for (const l of lieux) for (const a of alts) {
        await p.evaluer(`(() => { const s = window.__r36; s.lat = ${l.lat}; s.lon = ${l.lon}; s.altKm = ${a}; s.actif = true; return 1 })()`)
        await dors(ATTENTE)
        res.serie.push({ lieu: l.nom, altKm: a, ...(await p.evaluer(CRITERE)) })
        if (PNG) fs.writeFileSync(PNG.replace(/\.png$/, `-${l.nom.split(' ')[0]}-${a}.png`), Buffer.from(await p.capture(), 'base64'))
      }
      res.journal = decrire(p.journal)
      console.log(JSON.stringify(res, null, 2))
      if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(res, null, 2))
      return
    }
    await p.evaluer(`(() => { const s = window.__r36; s.lat = ${lat}; s.lon = ${lon}; s.altKm = ${altKm}; s.actif = true; return 1 })()`)
    await dors(ATTENTE)
    res.pose = { lat, lon, altKm }
    res.critere = await p.evaluer(CRITERE)
    if (PNG) { fs.writeFileSync(PNG, Buffer.from(await p.capture(), 'base64')); res.png = PNG }
    res.journal = decrire(p.journal)
    console.log(JSON.stringify(res, null, 2))
    if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(res, null, 2))
  } finally {
    await p.fermer()
  }
}
principal().catch((e) => { console.error(e); process.exit(1) })
