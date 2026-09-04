// SONDE BT-A — AUDIT DES COTES AMERICAINES, ETAT D'AVANT BLUETOPO
//
// Plomberie CDP reprise de `scripts/sonde-r36.mjs` (R36) : Chrome sans tete,
// pose forcee dans `composer.render`, et lecture de la texture TELLE QUE LE GPU
// LA TIENT (`readPixels` sur la texture GL attachee a un tampon).
//
// Serveur : npm run dev -- --host 127.0.0.1 --port 6533
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
const PORT = Number(opt('--port', '6533'))
const SORTIE = opt('--sortie', null)
const PNG = opt('--png', null)
const DBG_PORT = Number(opt('--dbg', '9451'))
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
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'bta-chrome-'))
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
  '  if (window.__bta) return "deja"',
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
  '  window.__bta = st',
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
  '  const dem = await window.__btadem.loadDem({ lat, lon, zoom, tilesAcross: 1, bathy: true, memo: false })',
  '  const brut = await window.__btadem.loadDem({ lat, lon, zoom, tilesAcross: 1, bathy: false, memo: false })',
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

// ═══════════════════════════════════════════════════════════════════════════
// LES POINTS — 17 dans les eaux americaines (dont 2 Grands Lacs) + 5 TEMOINS
// hors USA, qui ne doivent pas bouger d'un metre apres la cuisson BlueTopo.
//
// `ref` est une ALTITUDE ABSOLUE DE FOND en metres (pas une profondeur sous une
// nappe). `srcRef` nomme la source EXTERNE : `otd` = api.opentopodata.org, jeu
// `gebco2020`, releve le 2026-09-03.
// regime, lieu, lat, lon, reference (m), source externe
const POINTS = [
  ['USA baie', 'Chesapeake - embouchure (Thimble Shoal)', 37.00, -76.05, -10, 'otd gebco2020 -10'],
  ['USA baie', 'Chesapeake - bassin median', 38.20, -76.30, -13, 'otd gebco2020 -13'],
  ['USA plateau', 'Plateau au large de Virginia Beach', 36.80, -75.30, -24, 'otd gebco2020 -24'],
  ['USA estuaire', 'New York Bight / sortie de l Hudson', 40.50, -73.90, -10, 'otd gebco2020 -10'],
  ['USA talus', 'Tete du canyon de l Hudson', 39.60, -72.60, -76, 'otd gebco2020 -76'],
  ['USA baie', 'Massachusetts Bay', 42.35, -70.60, -70, 'otd gebco2020 -70'],
  ['USA plateau', 'Golfe du Maine (Jeffreys Ledge)', 42.90, -70.30, -157, 'otd gebco2020 -157'],
  ['USA plateau', 'Georges Bank', 41.30, -67.50, -40, 'otd gebco2020 -40'],
  ['USA plateau', 'Plateau louisianais (large de Terrebonne)', 28.80, -90.50, -19, 'otd gebco2020 -19'],
  ['USA abyssal', 'Golfe du Mexique - canyon du Mississippi', 27.50, -89.50, -1835, 'otd gebco2020 -1835'],
  ['USA lagon', 'Florida Bay / Keys', 24.80, -81.30, -1, 'otd gebco2020 -1'],
  ['USA plateau', 'Plateau ouest-Floride (large de Tampa)', 27.50, -83.20, -30, 'otd gebco2020 -30'],
  ['USA detroit', 'Detroit de Puget - bassin principal', 47.60, -122.45, -203, 'otd gebco2020 -203'],
  ['USA baie', 'Baie de San Francisco - Golden Gate', 37.82, -122.50, -51, 'otd gebco2020 -51'],
  ['USA Alaska', 'Cook Inlet (Alaska)', 60.50, -151.60, -46, 'otd gebco2020 -46'],
  ['Grand Lac', 'Lac Michigan (large de Muskegon)', 43.30, -86.90, 76, 'nappe +176 m, ~100 m de fond (NOAA NCEI)'],
  ['Grand Lac', 'Lac Erie (bassin central)', 42.00, -81.50, 114, 'nappe +174 m, ~60 m de fond (NOAA NCEI)'],
  ['TEMOIN', 'TEMOIN Manche (large de Portland)', 50.00, -1.50, -72, 'otd gebco2020 -72'],
  ['TEMOIN', 'TEMOIN Rade de Brest (zone EMODnet)', 48.35, -4.50, -25, 'otd gebco2020 -25'],
  ['TEMOIN', 'TEMOIN Mer Noire (centre)', 43.00, 34.00, -2197, 'otd gebco2020 -2197'],
  ['TEMOIN', 'TEMOIN Fosse de la Sonde (Java)', -10.30, 109.90, -7114, 'otd gebco2020 -7114'],
  ['TEMOIN', 'TEMOIN Leman (point le plus bas)', 46.44064, 6.59996, 62, 'swissBATHY3D / CIPEL : nappe 372,05 m, fond +62 m'],
]

const POINTS_FICHIER = opt('--points', null)
if (POINTS_FICHIER) { POINTS.length = 0; POINTS.push(...JSON.parse(fs.readFileSync(POINTS_FICHIER, 'utf8'))) }

// ── RESOLUTION EFFECTIVE ────────────────────────────────────────────────────
// Le peigne rendu par LIRE_GPU est une moyenne de |difference| entre texels
// VOISINS, en metres. Pour en faire une PENTE PAR KILOMETRE il faut la taille
// au sol d'un texel, qui depend du zoom, de la latitude ET du nombre de pixels
// de la tuile — c'est le piege que B3 a paye : a z11 le globe sert du 256 px et
// le damier du 512, et comparer les deux peignes bruts fabrique un facteur 2.
const mParTexel = (lat, z, px) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (2 ** z * (px / 256))
const penteKm = (peigneM, lat, z, px) => {
  if (peigneM == null || z == null || !px) return null
  return (peigneM / mParTexel(lat, z, px)) * 1000
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
    await p.evaluer('import("/src/dem.js").then(m => { window.__btadem = m; return "ok" })')
    await p.evaluer('window.__btalire = ' + LIRE_GPU + '; window.__btacrop = ' + LIRE_CROP + '; "ok"')
    res.indexBathy = await p.evaluer('(async () => { try { const r = await fetch("data/bathy/index.json"); return { statut: r.status, corps: r.ok ? await r.json() : null } } catch (e) { return { erreur: String(e) } } })()')

    if (SCENARIO === 'usa') {
      const alts = (opt('--alts', '250,110,60,30')).split(',').map(Number)
      const filtre = opt('--filtre', null)
      res.mesures = []
      for (const pt of POINTS) {
        const [regime, nom, lat, lon, ref, srcRef] = pt
        if (filtre && !nom.toLowerCase().includes(filtre.toLowerCase())) continue
        for (const altKm of alts) {
          await p.evaluer('(() => { const s = window.__bta; s.lat = ' + lat + '; s.lon = ' + lon + '; s.altKm = ' + altKm + '; s.actif = true; return 1 })()')
          await dors(ATTENTE)
          const gpu = await p.evaluer('window.__btalire(' + lat + ', ' + lon + ')')
          let crop = null
          if (gpu && gpu.trouve) {
            try { crop = await p.evaluer('window.__btacrop(' + lat + ', ' + lon + ', ' + gpu.z + ')') } catch (e) { crop = { erreur: String(e).slice(0, 160) } }
          }
          const l = {
            regime, nom, lat, lon, ref, srcRef, altKm,
            z: gpu && gpu.trouve ? gpu.z : null,
            px: gpu && gpu.trouve ? gpu.px : null,
            mGlobe: gpu && gpu.trouve ? gpu.mGpu : null,
            mDamier: crop && crop.mCrop != null ? crop.mCrop : null,
            mBrut: crop && crop.mBrut != null ? crop.mBrut : null,
            srcDamier: crop && crop.source ? crop.source : null,
            maxZoomDamier: crop && crop.maxZoom != null ? crop.maxZoom : null,
            etendueGlobe: gpu && gpu.trouve ? gpu.fen.etendue : null,
            etendueDamier: crop && crop.fen ? crop.fen.etendue : null,
            peigneGlobe: gpu && gpu.trouve ? gpu.fen.peigne : null,
            peigneDamier: crop && crop.fen ? crop.fen.peigne : null,
            errGl: gpu && gpu.trouve ? gpu.errGl : null,
          }
          l.mSolTexelGlobe = l.z != null ? mParTexel(lat, l.z, l.px) : null
          l.penteKmGlobe = penteKm(l.peigneGlobe, lat, l.z, l.px)
          l.penteKmDamier = penteKm(l.peigneDamier, lat, l.z, 512)
          res.mesures.push(l)
          console.error(nom.slice(0, 40).padEnd(41) + ' z' + String(l.z).padStart(2) + '/' + String(l.px).padEnd(4) +
            ' globe ' + (l.mGlobe == null ? '  ABSENT' : l.mGlobe.toFixed(1).padStart(9)) +
            ' damier ' + (l.mDamier == null ? '    --' : String(l.mDamier).padStart(8)) +
            ' ref ' + String(ref).padStart(6) +
            ' | et ' + (l.etendueGlobe == null ? ' --' : l.etendueGlobe.toFixed(2).padStart(7)) +
            ' m  pente ' + (l.penteKmGlobe == null ? ' --' : l.penteKmGlobe.toFixed(3).padStart(8)) + ' m/km')
        }
      }
    } else if (SCENARIO === 'reseau') {
      const zones = [
        { nom: 'Chesapeake (37.0 / -76.05)', lat: 37.0, lon: -76.05, altKm: 110 },
        { nom: 'Detroit de Puget (47.6 / -122.45)', lat: 47.6, lon: -122.45, altKm: 110 },
        { nom: 'Golfe du Mexique - Mississippi (27.5 / -89.5)', lat: 27.5, lon: -89.5, altKm: 110 },
        { nom: 'TEMOIN Manche (50.0 / -1.5)', lat: 50.0, lon: -1.5, altKm: 110 },
      ]
      const cl = (u) => u.includes('/data/bathy/') ? 'bathy' : u.includes('mapterhorn') ? 'mapterhorn' : u.includes('elevation-tiles-prod') ? 'aws-terrarium' : u.includes('emodnet') ? 'emodnet' : (u.includes('bluetopo') || u.includes('noaa')) ? 'bluetopo-noaa' : 'autre'
      res.zones = []
      for (const z of zones) {
        const avant = p.reseau.length
        await p.evaluer('(() => { const s = window.__bta; s.lat = ' + z.lat + '; s.lon = ' + z.lon + '; s.altKm = ' + z.altKm + '; s.actif = true; return 1 })()')
        await dors(15000)
        const tranche = p.reseau.slice(avant)
        const comptes = {}
        const zoomsBathy = {}
        const zoomsAlt = {}
        for (const r of tranche) {
          const c = cl(r.url)
          comptes[c] = comptes[c] || { total: 0, ok: 0, s404: 0 }
          comptes[c].total++
          if (r.statut === 200) comptes[c].ok++
          if (r.statut === 404) comptes[c].s404++
          const m = /\/data\/bathy\/(\d+)\//.exec(r.url)
          if (m) { const k = 'z' + m[1]; zoomsBathy[k] = zoomsBathy[k] || { total: 0, ok: 0, s404: 0 }; zoomsBathy[k].total++; if (r.statut === 200) zoomsBathy[k].ok++; if (r.statut === 404) zoomsBathy[k].s404++ }
          if (c === 'aws-terrarium' || c === 'mapterhorn') {
            const q = /\/(\d+)\/(\d+)\/(\d+)/.exec(r.url.replace(/^https?:\/\/[^/]+/, ''))
            if (q) { const k = 'z' + q[1]; zoomsAlt[k] = zoomsAlt[k] || { total: 0, ok: 0, s404: 0 }; zoomsAlt[k].total++; if (r.statut === 200) zoomsAlt[k].ok++; if (r.statut === 404) zoomsAlt[k].s404++ }
          }
        }
        res.zones.push({ ...z, requetes: tranche.length, comptes, zoomsBathy, zoomsAlt, exemples: tranche.filter((r) => cl(r.url) !== 'autre').slice(0, 26).map((r) => ({ url: r.url.replace(/^https?:\/\/[^/]+/, ''), statut: r.statut, octets: r.octets })) })
        console.error('[globe] ' + z.nom + '\n   ' + JSON.stringify(comptes) + '\n   bathy ' + JSON.stringify(zoomsBathy) + '\n   alt ' + JSON.stringify(zoomsAlt))
      }
    } else if (SCENARIO === 'vue') {
      const lat = Number(opt('--lat', '37.0')), lon = Number(opt('--lon', '-76.05')), altKm = Number(opt('--altkm', '110'))
      await p.evaluer('(() => { const s = window.__bta; s.lat = ' + lat + '; s.lon = ' + lon + '; s.altKm = ' + altKm + '; s.actif = true; return 1 })()')
      await dors(ATTENTE + 5000)
      res.pose = { lat, lon, altKm }
      res.gpu = await p.evaluer('window.__btalire(' + lat + ', ' + lon + ')')
      if (PNG) { fs.writeFileSync(PNG, Buffer.from(await p.capture(), 'base64')); res.png = PNG }
    }
    res.journal = p.journal.filter((l) => l.quoi === 'exception' || l.niveau === 'error').slice(0, 25)
    if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(res, null, 2))
    else console.log(JSON.stringify(res, null, 2))
  } finally { await p.fermer() }
}
principal().catch((e) => { console.error(e); process.exit(1) })
