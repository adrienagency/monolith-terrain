// SONDE B1 — AUDIT DE LA BATHYMETRIE (globe vs crop)
//
// Plomberie CDP reprise de `scripts/sonde-r36.mjs` (R36) : Chrome sans tete,
// pose forcee dans `composer.render`, et lecture de la texture TELLE QUE LE GPU
// LA TIENT (`readPixels` sur la texture GL attachee a un tampon).
//
// Serveur : npm run dev -- --host 127.0.0.1 --port 6311
//
// SCENARIOS :
//   points     les 25 points de reference : GPU (globe) + loadDem (crop) + brut
//   reseau     le releve requete par requete sur trois zones
//   vue        une capture PNG a une pose donnee
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const SCENARIO = opt('--scenario', 'points')
const PORT = Number(opt('--port', '6311'))
const SORTIE = opt('--sortie', null)
const PNG = opt('--png', null)
const DBG_PORT = Number(opt('--dbg', '9351'))
const LARGEUR = 1280, HAUTEUR = 800
const ATTENTE = Number(opt('--attente', '7000'))
const dors = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
function getJson(url) { return new Promise((res, rej) => { http.get(url, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.attente = new Map(); this.ecouteurs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id != null && this.attente.has(m.id)) { const w = this.attente.get(m.id); this.attente.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result) }
      else if (m.method) for (const f of this.ecouteurs) f(m)
    }
  }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId; this.ws.send(JSON.stringify(msg)); return new Promise((res, rej) => this.attente.set(id, { res, rej })) }
  on(f) { this.ecouteurs.push(f) }
}
async function ouvrirPage() {
  const chrome = trouverChrome()
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'b1-chrome-'))
  const args = ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--remote-debugging-port=' + DBG_PORT, '--user-data-dir=' + profil, '--window-size=' + LARGEUR + ',' + HAUTEUR,
    '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', 'about:blank']
  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let version = null
  for (let i = 0; i < 200 && !version; i++) { try { version = await getJson('http://127.0.0.1:' + DBG_PORT + '/json/version') } catch { await dors(100) } }
  if (!version) { proc.kill(); throw new Error('Chrome ne repond pas') }
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const cdp = new Cdp(ws)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const att = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const s = att.sessionId
  const journal = []
  const reseau = []
  cdp.on((m) => {
    if (m.sessionId !== s) return
    if (m.method === 'Runtime.consoleAPICalled') journal.push({ quoi: 'console', niveau: m.params.type, texte: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') })
    else if (m.method === 'Runtime.exceptionThrown') journal.push({ quoi: 'exception', texte: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text })
    else if (m.method === 'Network.requestWillBeSent') reseau.push({ id: m.params.requestId, url: m.params.request.url })
    else if (m.method === 'Network.responseReceived') { const e = reseau.find((r) => r.id === m.params.requestId); if (e) { e.statut = m.params.response.status; e.mime = m.params.response.mimeType } }
    else if (m.method === 'Network.loadingFinished') { const e = reseau.find((r) => r.id === m.params.requestId); if (e) e.octets = m.params.encodedDataLength }
    else if (m.method === 'Network.loadingFailed') { const e = reseau.find((r) => r.id === m.params.requestId); if (e && e.statut == null) e.statut = 'ECHEC' }
  })
  await cdp.send('Page.enable', {}, s)
  await cdp.send('Runtime.enable', {}, s)
  await cdp.send('Network.enable', {}, s)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1, mobile: false }, s)
  const evaluer = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 180000 }, s)
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result.value
  }
  const fermer = async () => { try { ws.close() } catch { /* rien */ } proc.kill(); await dors(300); try { fs.rmSync(profil, { recursive: true, force: true }) } catch { /* rien */ } }
  return {
    fermer, version: version.Browser, journal, reseau, evaluer,
    capture: async () => (await cdp.send('Page.captureScreenshot', { format: 'png' }, s)).data,
    naviguer: (url) => cdp.send('Page.navigate', { url }, s),
  }
}
async function attendrePret(p, maxMs = 180000) {
  const t0 = Date.now()
  const q = '(() => { const e = window.__exp; return !!(e && e.renderer && e.renderer.info.render.frame > 3 && document.getElementById("loading")?.classList.contains("hidden")) })()'
  while (Date.now() - t0 < maxMs) {
    if (await p.evaluer(q)) return Date.now() - t0
    await dors(250)
  }
  throw new Error('la page n a pas dessine')
}

// ── LA POSE FORCEE (patron R36) ─────────────────────────────────────────────
const POSE = [
  '(() => {',
  '  if (window.__b1) return "deja"',
  '  const e = window.__exp',
  '  const st = { lat: 0, lon: 0, altKm: 2500, actif: false, images: 0 }',
  '  const R = 100, MPU = 63710',
  '  const orig = e.composer.render.bind(e.composer)',
  '  e.composer.render = function (dt) {',
  '    if (st.actif) {',
  '      const la = st.lat * Math.PI / 180, lo = st.lon * Math.PI / 180',
  '      const r = R + (st.altKm * 1000) / MPU',
  '      const cam = e.camera',
  '      cam.position.set(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo))',
  '      cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0)',
  '      e.controls.target.set(0, 0, 0)',
  '      e.modes.orbAlt = e.modes.orbAltTarget = (st.altKm * 1000) / MPU',
  '      cam.updateMatrixWorld(true); cam.updateProjectionMatrix()',
  '    }',
  '    st.images++',
  '    return orig(dt)',
  '  }',
  '  window.__b1 = st',
  '  return "posee"',
  '})()',
].join('\n')

// ── LECTURE GPU D UN POINT ──────────────────────────────────────────────────
// La tuile PRETE la plus fine qui contient (lat, lon) ; sa texture GL attachee
// a un tampon ; readPixels sur LE texel du point ; decodage terrarium.
// ⚠️ readPixels rend la ligne 0 EN BAS ; v = 0 est le SUD de la tuile
// (convention `_buildMesh` : « canvas row 0 = north = uv v 1 »).
const LIRE_GPU = [
  '((lat, lon) => {',
  '  const e = window.__exp',
  '  const gl = e.renderer.getContext()',
  '  const props = e.renderer.properties',
  '  const n = (z) => Math.pow(2, z)',
  '  const wx = (z) => ((lon + 180) / 360) * n(z)',
  '  const wy = (z) => { const r = lat * Math.PI / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n(z) }',
  '  let best = null, prets = 0',
  '  for (const t of e.globe.tiles.values()) {',
  '    if (t.state !== "ready" || !t.texture || !t.mesh) continue',
  '    prets++',
  '    const X = wx(t.z), Y = wy(t.z)',
  '    if (X >= t.x && X < t.x + 1 && Y >= t.y && Y < t.y + 1) { if (!best || t.z > best.z) best = t }',
  '  }',
  '  if (!best) return { trouve: false, prets }',
  '  const p = props.get(best.texture)',
  '  const gt = p && p.__webglTexture',
  '  if (!gt) return { trouve: false, prets, raison: "pas de texture GL" }',
  '  const px = best.size',
  '  const u = wx(best.z) - best.x',
  '  const vNord = wy(best.z) - best.y',
  '  const col = Math.min(px - 1, Math.max(0, Math.floor(u * px)))',
  '  const ligne = Math.min(px - 1, Math.max(0, Math.floor((1 - vNord) * px)))',
  '  const fb = gl.createFramebuffer()',
  '  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)',
  '  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gt, 0)',
  '  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { trouve: false, prets, raison: "tampon incomplet" } }',
  '  const a = new Uint8Array(4)',
  '  gl.readPixels(col, ligne, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a)',
  '  const R = 4, W = 2 * R + 1',
  '  const c0 = Math.min(px - W, Math.max(0, col - R)), l0 = Math.min(px - W, Math.max(0, ligne - R))',
  '  const win = new Uint8Array(W * W * 4)',
  '  gl.readPixels(c0, l0, W, W, gl.RGBA, gl.UNSIGNED_BYTE, win)',
  '  const errGl = gl.getError()',
  '  gl.bindFramebuffer(gl.FRAMEBUFFER, null)',
  '  gl.deleteFramebuffer(fb)',
  '  const dec = (r, g, b) => r * 256 + g + b / 256 - 32768',
  '  const vals = []',
  '  for (let i = 0; i < W * W; i++) vals.push(dec(win[i * 4], win[i * 4 + 1], win[i * 4 + 2]))',
  '  let mn = Infinity, mx = -Infinity, sm = 0',
  '  for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; sm += v }',
  '  let ecarts = 0, cnt = 0',
  '  for (let y = 0; y < W; y++) for (let x = 1; x < W; x++) { ecarts += Math.abs(vals[y * W + x] - vals[y * W + x - 1]); cnt++ }',
  '  return { trouve: true, prets, z: best.z, x: best.x, y: best.y, px, col, ligne, errGl,',
  '    mGpu: dec(a[0], a[1], a[2]), fen: { min: mn, max: mx, moy: sm / vals.length, etendue: mx - mn, peigne: ecarts / cnt } }',
  '})',
].join('\n')

// ── LECTURE CROP : le chemin du bloc plat, avec et sans bathymetrie ─────────
const LIRE_CROP = [
  '(async (lat, lon, zoom) => {',
  '  const dem = await window.__b1dem.loadDem({ lat, lon, zoom, tilesAcross: 1, bathy: true, memo: false })',
  '  const brut = await window.__b1dem.loadDem({ lat, lon, zoom, tilesAcross: 1, bathy: false, memo: false })',
  '  const n = Math.pow(2, zoom)',
  '  const r = lat * Math.PI / 180',
  '  const wx = ((lon + 180) / 360) * n, wy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n',
  '  const idx = (d) => {',
  '    const px = Math.round((wx - d.originTileX) * d.tilePx), py = Math.round((wy - d.originTileY) * d.tilePx)',
  '    return { px: Math.min(d.size - 1, Math.max(0, px)), py: Math.min(d.size - 1, Math.max(0, py)) }',
  '  }',
  '  const echan = (d) => { const q = idx(d); return d.data[q.py * d.size + q.px] }',
  '  const peigne = (d) => {',
  '    const q = idx(d)',
  '    let mn = Infinity, mx = -Infinity, s = 0, c = 0, e = 0, ec = 0, prev = null',
  '    for (let y = q.py - 4; y <= q.py + 4; y++) { prev = null; for (let x = q.px - 4; x <= q.px + 4; x++) {',
  '      if (x < 0 || y < 0 || x >= d.size || y >= d.size) continue',
  '      const v = d.data[y * d.size + x]; if (v < mn) mn = v; if (v > mx) mx = v; s += v; c++',
  '      if (prev !== null) { e += Math.abs(v - prev); ec++ } prev = v',
  '    } }',
  '    return { min: mn, max: mx, moy: s / c, etendue: mx - mn, peigne: ec ? e / ec : null }',
  '  }',
  '  return { zoom, source: dem.demSource, maxZoom: dem.maxZoom,',
  '    mCrop: echan(dem), mBrut: echan(brut), fen: peigne(dem), fenBrut: peigne(brut),',
  '    minBloc: dem.minM, maxBloc: dem.maxM }',
  '})',
].join('\n')

// regime, lieu, lat, lon, reference (m, ALTITUDE ABSOLUE du fond), source
const POINTS = [
  ['fosse', 'Fosse des Mariannes (Challenger)', 11.373, 142.591, -10935, 'NOAA/GEBCO'],
  ['fosse', 'Fosse de Porto Rico (Milwaukee)', 19.80, -66.80, -8376, 'NOAA'],
  ['fosse', 'Fosse de la Sonde (Java)', -10.30, 109.90, -7290, 'GEBCO'],
  ['fosse', 'Fosse des Tonga (Horizon)', -23.28, -174.75, -10800, 'GEBCO'],
  ['abyssale', 'Plaine abyssale Atlantique central', 35.00, -50.00, -5200, 'GEBCO'],
  ['abyssale', 'Plaine abyssale d Angola', -15.00, 3.00, -5100, 'GEBCO'],
  ['abyssale', 'Bassin central Pacifique', 10.00, -150.00, -5300, 'GEBCO'],
  ['abyssale', 'Bassin de Somalie', 0.00, 55.00, -5000, 'GEBCO'],
  ['dorsale', 'Dorsale medio-atlantique nord', 30.00, -41.50, -2700, 'GEBCO'],
  ['dorsale', 'Dorsale medio-atlantique sud', -25.00, -13.50, -2800, 'GEBCO'],
  ['dorsale', 'Dorsale Pacifique Est', -15.00, -113.00, -2700, 'GEBCO'],
  ['dorsale', 'Dorsale de Reykjanes', 58.00, -32.00, -2000, 'GEBCO'],
  ['plateau', 'Manche (au large de Portland)', 50.00, -1.50, -60, 'SHOM/EMODnet'],
  ['plateau', 'Mer du Nord (Dogger Bank)', 55.00, 3.00, -40, 'EMODnet'],
  ['plateau', 'Plateau du golfe de Gascogne', 46.00, -3.00, -100, 'EMODnet'],
  ['plateau', 'Plateau au large de Chesapeake', 37.00, -74.50, -40, 'BlueTopo/NOAA'],
  ['plateau', 'Grand Banc de Terre-Neuve', 45.00, -50.00, -80, 'GEBCO'],
  ['mer fermee', 'Mediterranee, plaine ionienne', 35.50, 19.00, -4000, 'EMODnet'],
  ['mer fermee', 'Mer Noire (centre)', 43.00, 34.00, -2212, 'GEBCO'],
  ['mer fermee', 'Caspienne sud', 38.50, 51.50, -1053, 'surface -28 m, 1025 m de fond'],
  ['lac', 'Lac Baikal (le plus profond)', 53.50, 108.10, -1187, 'surface +456 m, 1642 m de fond'],
  ['lac', 'Lac Tanganyika', -6.00, 29.60, -697, 'surface +773 m, 1470 m de fond'],
  ['lac', 'Lac Superieur', 47.50, -87.50, -223, 'surface +183 m, 406 m de fond'],
  ['lac', 'Crater Lake (Oregon)', 42.94, -122.11, 1289, 'surface +1883 m, 594 m de fond'],
  ['lac', 'Leman (Grand Lac)', 46.45, 6.55, 63, 'surface +372 m, 309 m de fond'],
]

// ══════════ POINTS SUPPLÉMENTAIRES — B3, ADDITIF ET SANS EFFET PAR DÉFAUT ═════
//
// ⚠️ **LA LISTE `POINTS` CI-DESSUS N'EST PAS TOUCHÉE, ET C'EST LA CONDITION.**
// `test/attaque-b1-ROUGE.mjs` cherche ses lieux par `nom.includes(...)` et prend
// le PREMIER qui correspond : ajouter « Caspienne (fosse sud) » à la liste de
// base aurait pu détourner B1-4 vers un autre point que celui qu'il vise, et le
// verdir sans que rien ne le dise. Les points de B3 n'entrent donc QUE si
// `--points` est passé — ce que les tests de B1 ne font jamais.
function pointsEnPlus() {
  const f = opt('--points', null)
  if (!f) return []
  const brut = JSON.parse(fs.readFileSync(f, 'utf8'))
  return brut.map((p) => [p.regime, p.nom, p.lat, p.lon, p.ref, p.srcRef || ''])
}

async function principal() {
  const p = await ouvrirPage()
  const res = { scenario: SCENARIO, chrome: p.version, quand: new Date().toISOString() }
  try {
    await p.naviguer('http://127.0.0.1:' + PORT + '/')
    res.pret = await attendrePret(p)
    await p.evaluer('document.querySelectorAll(".ce-hubveil,.ce-elemwrap").forEach(n => n.remove())')
    await p.evaluer('window.__exp.modes.enterOrbit()')
    await dors(4000)
    await p.evaluer(POSE)
    await p.evaluer('import("/src/dem.js").then(m => { window.__b1dem = m; return "ok" })')
    await p.evaluer('window.__b1lire = ' + LIRE_GPU + '; window.__b1crop = ' + LIRE_CROP + '; "ok"')
    res.indexBathy = await p.evaluer('(async () => { try { const r = await fetch("data/bathy/index.json"); return { statut: r.status, corps: r.ok ? await r.json() : null } } catch (e) { return { erreur: String(e) } } })()')

    if (SCENARIO === 'points') {
      const altKm = Number(opt('--altkm', '2500'))
      const zoomCrop = Number(opt('--zoomcrop', '8'))
      res.altKm = altKm; res.zoomCrop = zoomCrop
      res.points = []
      for (const pt of [...POINTS, ...pointsEnPlus()]) {
        const [regime, nom, lat, lon, ref, srcRef] = pt
        await p.evaluer('(() => { const s = window.__b1; s.lat = ' + lat + '; s.lon = ' + lon + '; s.altKm = ' + altKm + '; s.actif = true; return 1 })()')
        await dors(ATTENTE)
        const gpu = await p.evaluer('window.__b1lire(' + lat + ', ' + lon + ')')
        let crop = null
        try { crop = await p.evaluer('window.__b1crop(' + lat + ', ' + lon + ', ' + zoomCrop + ')') } catch (e) { crop = { erreur: String(e).slice(0, 200) } }
        res.points.push({ regime, nom, lat, lon, ref, srcRef, gpu, crop })
        console.error(nom.padEnd(38) + ' ref ' + String(ref).padStart(7) +
          '  globe ' + (gpu && gpu.trouve ? gpu.mGpu.toFixed(1).padStart(9) : '   ABSENT') +
          '  crop ' + (crop && crop.mCrop != null ? String(crop.mCrop).padStart(8) : '      --') +
          '  brut ' + (crop && crop.mBrut != null ? String(crop.mBrut).padStart(8) : '      --'))
      }
    } else if (SCENARIO === 'descente') {
      // LE CAS QUE L HYPOTHESE DU SOCLE PREDIT : en approche, le globe monte en
      // zoom ; si la cascade n est pas cablee, il tombe sur du terrarium fin,
      // qui est MUET en mer. On lit le globe au GPU et le crop AU MEME ZOOM.
      const alts = (opt('--alts', '2500,600,200,60')).split(',').map(Number)
      const noms = (opt('--lieux', 'Manche,Mer Noire,Caspienne,Mediterranee,Baikal,Leman,Java')).split(',')
      res.descente = []
      for (const pt of [...POINTS, ...pointsEnPlus()]) {
        const [regime, nom, lat, lon, ref] = pt
        if (!noms.some((n) => nom.toLowerCase().includes(n.toLowerCase().slice(0, 7)))) continue
        for (const altKm of alts) {
          await p.evaluer('(() => { const s = window.__b1; s.lat = ' + lat + '; s.lon = ' + lon + '; s.altKm = ' + altKm + '; s.actif = true; return 1 })()')
          await dors(ATTENTE)
          const gpu = await p.evaluer('window.__b1lire(' + lat + ', ' + lon + ')')
          let crop = null
          if (gpu && gpu.trouve) {
            try { crop = await p.evaluer('window.__b1crop(' + lat + ', ' + lon + ', ' + gpu.z + ')') } catch (e) { crop = { erreur: String(e).slice(0, 160) } }
          }
          res.descente.push({ regime, nom, lat, lon, ref, altKm, gpu, crop })
          console.error(nom.padEnd(30) + ' alt ' + String(altKm).padStart(5) + ' km  z' + (gpu.trouve ? gpu.z : '?') + '/' + (gpu.px || '?') +
            '  globe ' + (gpu.trouve ? gpu.mGpu.toFixed(1).padStart(9) : '   ABSENT') +
            '  crop ' + (crop && crop.mCrop != null ? String(crop.mCrop).padStart(8) : '      --') +
            '  brut ' + (crop && crop.mBrut != null ? String(crop.mBrut).padStart(8) : '      --') +
            '  ref ' + ref)
        }
      }
    } else if (SCENARIO === 'fusion') {
      // Y A-T-IL UN CHEMIN QUI FUSIONNE, DANS LE MODE PAR DEFAUT ?
      await p.evaluer([
        'window.__b1f = { bathy: 0, terrain: 0 };',
        'const of = window.fetch;',
        'window.fetch = function (u, o) {',
        '  const s = String(u && u.url ? u.url : u);',
        '  if (s.indexOf("/data/bathy/") >= 0) window.__b1f.bathy++;',
        '  else if (s.indexOf("terrarium") >= 0 || s.indexOf("mapterhorn") >= 0) window.__b1f.terrain++;',
        '  return of.call(this, u, o)',
        '};',
        '"ok"',
      ].join('\n'))
      const lieux = [[50, -1.5], [43, 34], [-10.3, 109.9]]
      const alts = [2500, 600, 110]
      for (const [la, lo] of lieux) for (const a of alts) {
        await p.evaluer('(() => { const s = window.__b1; s.lat = ' + la + '; s.lon = ' + lo + '; s.altKm = ' + a + '; s.actif = true; return 1 })()')
        await dors(6000)
      }
      res.compteurs = await p.evaluer('window.__b1f')
      res.flux = await p.evaluer('(() => { const e = window.__exp; const f = e.fluxSocle || e.flux || (e.fenetre && e.fenetre.flux); return { fluxTrouve: !!f, bathyEtat: f && f.bathy ? { cle: f.bathy.cle, peintes: f.bathy.peintes, prete: f.bathy.prete } : null } })()')
      console.error('fusion : ' + JSON.stringify(res.compteurs) + ' ' + JSON.stringify(res.flux))
    } else if (SCENARIO === 'reseau') {
      const zones = [
        { nom: 'EMODnet - Manche / mer du Nord', lat: 51.0, lon: 1.5, altKm: 900 },
        { nom: 'BlueTopo - cote est des Etats-Unis', lat: 37.0, lon: -74.5, altKm: 900 },
        { nom: 'large - plaine abyssale Atlantique', lat: 35.0, lon: -50.0, altKm: 900 },
      ]
      const classe = '(u) => u.includes("/data/bathy/") ? "bathy" : u.includes("mapterhorn") ? "mapterhorn" : u.includes("elevation-tiles-prod") ? "aws-terrarium" : u.includes("emodnet") ? "emodnet" : (u.includes("bluetopo") || u.includes("noaa")) ? "bluetopo" : "autre"'
      const cl = eval(classe)
      res.zones = []
      for (const z of zones) {
        const avant = p.reseau.length
        await p.evaluer('(() => { const s = window.__b1; s.lat = ' + z.lat + '; s.lon = ' + z.lon + '; s.altKm = ' + z.altKm + '; s.actif = true; return 1 })()')
        await dors(15000)
        const tranche = p.reseau.slice(avant)
        const comptes = {}
        for (const r of tranche) { const c = cl(r.url); comptes[c] = comptes[c] || { total: 0, ok: 0, s404: 0 }; comptes[c].total++; if (r.statut === 200) comptes[c].ok++; if (r.statut === 404) comptes[c].s404++ }
        res.zones.push({ ...z, requetes: tranche.length, comptes, exemples: tranche.filter((r) => cl(r.url) !== 'autre').slice(0, 14).map((r) => ({ url: r.url, statut: r.statut, octets: r.octets })) })
        console.error('[globe] ' + z.nom + ' ' + JSON.stringify(comptes))
      }
      res.cropReseau = []
      for (const z of zones) {
        const avant = p.reseau.length
        try { await p.evaluer('window.__b1crop(' + z.lat + ', ' + z.lon + ', 10)') } catch { /* rien */ }
        await dors(4000)
        const tranche = p.reseau.slice(avant)
        const comptes = {}
        for (const r of tranche) { const c = cl(r.url); comptes[c] = comptes[c] || { total: 0, ok: 0, s404: 0 }; comptes[c].total++; if (r.statut === 200) comptes[c].ok++; if (r.statut === 404) comptes[c].s404++ }
        res.cropReseau.push({ nom: z.nom, comptes, urls: tranche.filter((r) => cl(r.url) !== 'autre').slice(0, 20).map((r) => ({ url: r.url, statut: r.statut, octets: r.octets })) })
        console.error('[crop]  ' + z.nom + ' ' + JSON.stringify(comptes))
      }
    } else if (SCENARIO === 'vue') {
      const lat = Number(opt('--lat', '11.373')), lon = Number(opt('--lon', '142.591')), altKm = Number(opt('--altkm', '2500'))
      await p.evaluer('(() => { const s = window.__b1; s.lat = ' + lat + '; s.lon = ' + lon + '; s.altKm = ' + altKm + '; s.actif = true; return 1 })()')
      await dors(ATTENTE + 5000)
      res.pose = { lat, lon, altKm }
      res.gpu = await p.evaluer('window.__b1lire(' + lat + ', ' + lon + ')')
      if (PNG) { fs.writeFileSync(PNG, Buffer.from(await p.capture(), 'base64')); res.png = PNG }
    }
    res.journal = p.journal.filter((l) => l.quoi === 'exception' || l.niveau === 'error').slice(0, 25)
    if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(res, null, 2))
    console.log(JSON.stringify(res, null, 2))
  } finally { await p.fermer() }
}
principal().catch((e) => { console.error(e); process.exit(1) })
