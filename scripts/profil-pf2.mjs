// SONDE PF2 — L'ORDRE D'ARRIVÉE DES TUILES : le visible d'abord ? le centre d'abord ?
//
// ══════════ CE QU'ELLE MESURE ═══════════════════════════════════════════════
//
// Adrien : « Ce qui est visible doit toujours être calculé en premier. Ce qui
// est au centre de l'écran est la priorité. » Cette sonde rend ce principe
// MESURABLE : pour chaque tuile qui devient prête (`_buildMesh`), elle relève
// où la tuile tombe à l'écran AU MOMENT où elle arrive :
//   · `tronc`   — dans le tronc de vue ET devant l'horizon (les deux tris de
//                 `_traverse`, rejoués avec la caméra de l'image courante) ;
//   · `central` — son centre projeté tombe dans le TIERS CENTRAL de l'écran
//                 (|x| ≤ 1/3 et |y| ≤ 1/3 en NDC) ;
//   · `dNdc`    — la distance de son centre au centre de l'écran, en NDC.
// et le rang d'arrivée. La fraction des 20 premières arrivées qui sont dans le
// tronc / au centre est LE chiffre à battre.
//
// Elle relève aussi, DANS `update()` (pas après — une sonde posée après lit un
// état écrasé, §3 de /threejs-optimisation) :
//   · le coût CPU de `_traverse` par image (somme des appels racine), p50/p99 ;
//   · `zCentre` — le niveau de la tuile DESSINÉE sous le centre de l'écran, d'où
//     « le temps jusqu'à la première image nette au centre » (l'instant, après
//     l'arrêt du geste, où `zCentre` atteint sa valeur finale) ;
//   · les places du cache occupées par des tuiles HORS TRONC, par état ;
//   · la file, le vol, le crédit restant, les refus.
// Et au protocole CDP (`Network.*`, pas `performance.getEntries` qui plafonne à
// 250) : requêtes et octets par hôte, par phase.
//
// ══════════ LE BANC ═════════════════════════════════════════════════════════
//
// Chrome sans tête (`--headless=new`, `--use-angle=default`), 1280×720,
// pixelRatio 1. `--cpu N` pose `Emulation.setCPUThrottlingRate` (machine lente).
// Trois scénarios :
//   descente  orbite posée à `--depart` m, puis N crans de molette au centre
//             (WheelEvent sur `renderer.domElement`, comme sonde-descente.mjs :
//             le pixel du centre porte un bouton, pas le canvas), 160 ms le cran.
//   glisse    orbite posée à `--depart` m, file vidée, puis un glissé de 400 px
//             vers la droite en 24 pas (CDP `Input.dispatchMouseEvent`).
//   cache     jalons `--jalons` (s) avec usage entre deux (glissés + zoom
//             aller-retour) : l'occupation du cache par des tuiles hors tronc à
//             1 / 5 / 15 min. Une fuite se voit dans le temps, pas sur une image.
//
// ⚠️ Le voile d'accueil `.ce-hubveil` avale tous les gestes : on le lève et on
// VÉRIFIE que le canevas est découvert. ⚠️ La pose de démarrage arrive après un
// vol de ~8 s : on attend que `modes.busy` retombe avant de poser l'orbite.
//
// EMPLOI
//   node scripts/profil-pf2.mjs --port 6123 --scenario descente --etiquette avant
//   node scripts/profil-pf2.mjs --dist <dossier build> --port 6124 --scenario glisse
//   node scripts/profil-pf2.mjs --port 6123 --scenario cache --jalons 60,300,900
//   --cpu 4        ralentissement CPU ×4      --depart 3000000   altitude de départ (m)
//   --crans 40     crans de molette           --visible 1        fenêtre à l'écran
// Sort `.banc/PF2/<etiquette>-<scenario>.json` et un résumé en console.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '6123'))
const DIST = opt('--dist', null)
const SCENARIO = opt('--scenario', 'descente')
const ETIQ = opt('--etiquette', 'releve')
const CPU = Number(opt('--cpu', '1'))
const DEPART_M = Number(opt('--depart', SCENARIO === 'glisse' || SCENARIO === 'rotation' ? '1500000' : '3000000'))
const CRANS = Number(opt('--crans', '600'))
const PERIODE = Number(opt('--periode', '40'))
const ARRIVEE_M = Number(opt('--arrivee', '20000'))
const JALONS = opt('--jalons', '60,300,900').split(',').map(Number)
const VISIBLE = opt('--visible', '0') !== '0'
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'PF2'))
const LARGEUR = 1280, HAUTEUR = 720
const ORBITAL_M_PER_UNIT = 6371000 / 100 // geo.js : EARTH_RADIUS_M / R_GLOBE

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable (`npm i -D puppeteer-core`).')
  process.exit(2)
}

// un serveur statique minimal pour un build (`--dist`) — patron de sonde-demarrage.mjs
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
}
function servir(dist, port) {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0].split('#')[0])
    let f = path.join(dist, u)
    try {
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' })
      fs.createReadStream(f).pipe(res)
    } catch { res.writeHead(404).end() }
  })
  return new Promise((r) => s.listen(port, () => r(s)))
}

// ═══════════════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ═══════════════════════
function INSTRUMENTER() {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__pf2) return 'déjà posé'
  const g = e.globe
  const P = {
    phase: 'attente',
    arrivees: [], // une entrée par tuile devenue prête
    demandes: [], // une entrée par tuile passée `empty → loading`
    images: [], // une entrée par `update()`
    dtRaf: [], // durée entre deux rAF (ms) — la cadence réelle
    longtasks: [],
    tCompletion: [], // { t, utile } — une réponse arrivée pour une tuile encore demandée ?
  }
  window.__pf2 = P
  const ROOT_Z = 2
  const ORBITAL_M_PER_UNIT = 63710 // geo.js : EARTH_RADIUS_M / R_GLOBE

  // — projection d'un point de scène en NDC, avec le signe de w
  const ndcDe = (v) => {
    const m = g._matVue.elements
    const x = v.x, y = v.y, z = v.z
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    if (!(w > 0)) return null
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w]
  }
  let camDir = null
  const dansTronc = (t) => {
    if (t.z <= ROOT_Z) return true
    if (!g.continu || !camDir) return true
    if (g._horsHorizon(t, camDir)) return false
    return g._frustum.intersectsSphere(g._sphereDe(t))
  }
  const fiche = (t) => {
    const n = ndcDe(t.center)
    const d = n ? Math.hypot(n[0], n[1]) : null
    return {
      key: t.key, z: t.z, frame: g.frame, t: Math.round(performance.now()), phase: P.phase,
      tronc: dansTronc(t), central: !!n && Math.abs(n[0]) <= 1 / 3 && Math.abs(n[1]) <= 1 / 3,
      dNdc: d === null ? null : Math.round(d * 1000) / 1000,
      lastUsed: t.lastUsed, frameNow: g.frame,
    }
  }

  // — le départ RÉEL des requêtes (par URL), pour dater le vol de chaque tuile
  const departs = new Map()
  const fetchOrig = window.fetch.bind(window)
  window.fetch = function (url, ...rest) {
    if (typeof url === 'string') departs.set(url, performance.now())
    return fetchOrig(url, ...rest)
  }
  const urlDe = (t) => { try { return t.plan.source.url(t.plan.tile.z, t.plan.tile.x, t.plan.tile.y) } catch { return null } }
  // — l'arrivée : `_buildMesh` est le premier instant où la tuile peut dessiner
  let msBuildImage = 0
  let nBuildImage = 0
  const buildOrig = g._buildMesh.bind(g)
  g._buildMesh = function (t) {
    const a = performance.now()
    const r = buildOrig(t)
    const f = fiche(t)
    f.msBuild = Math.round((performance.now() - a) * 100) / 100
    msBuildImage += performance.now() - a
    nBuildImage++
    f.utile = t.lastUsed === g.frame || t.z <= ROOT_Z // encore demandée par le parcours courant ?
    const u = urlDe(t)
    const d0 = u ? departs.get(u) : undefined
    f.msVol = d0 === undefined ? null : Math.round(performance.now() - d0)
    // temps passé EN VOL alors que la tuile était déjà sortie du champ : ce
    // qu'une annulation (AbortController) aurait rendu aux six créneaux
    f.msPerdu = t._pf2Sorti === undefined ? 0 : Math.round(performance.now() - t._pf2Sorti)
    P.arrivees.push(f)
    return r
  }
  // — la demande : quand une tuile part réellement dans la file
  const reqOrig = g._request.bind(g)
  g._request = function (t, priority) {
    const avant = t.state
    const r = reqOrig(t, priority)
    if (avant === 'empty' && t.state === 'loading') {
      const f = fiche(t)
      f.priority = priority
      // le parent : passé par le tronc, lui ? (sinon la demande vient d'ailleurs)
      const parent = t.z > ROOT_Z ? g.tiles.get(`${t.z - 1}/${t.x >> 1}/${t.y >> 1}`) : null
      f.parentTronc = parent ? dansTronc(parent) : null
      f.parentDrawn = parent ? !!(parent.mesh && parent.mesh.visible) : null
      f.horsHorizon = t.z > ROOT_Z && g.continu && !!camDir ? g._horsHorizon(t, camDir) : null
      f.frustum = t.z > ROOT_Z && g.continu ? g._frustum.intersectsSphere(g._sphereDe(t)) : null
      P.demandes.push(f)
    }
    return r
  }
  // — le coût de `_traverse` : somme des appels de premier niveau
  let profondeur = 0
  let msTraverse = 0
  const travOrig = g._traverse.bind(g)
  g._traverse = function (t, camPos, camDir2) {
    if (profondeur === 0) {
      const a = performance.now()
      profondeur++
      try { return travOrig(t, camPos, camDir2) } finally { profondeur--; msTraverse += performance.now() - a }
    }
    profondeur++
    try { return travOrig(t, camPos, camDir2) } finally { profondeur-- }
  }

  // — le point de la planète sous le centre de l'écran, et la tuile dessinée qui le porte
  const R2D = 180 / Math.PI
  function zSousLeCentre(camera) {
    const p = camera.position
    const q = camera.quaternion
    // direction de visée : (0,0,-1) tournée par le quaternion
    const x = q.x, y = q.y, z = q.z, w = q.w
    const dx = -(2 * (x * z + w * y)), dy = -(2 * (y * z - w * x)), dz = -(1 - 2 * (x * x + y * y))
    const R = g.radius
    const b = p.x * dx + p.y * dy + p.z * dz
    const c = p.x * p.x + p.y * p.y + p.z * p.z - R * R
    const disc = b * b - c
    if (disc < 0) return { z: null, lat: null, lon: null }
    const s = -b - Math.sqrt(disc)
    if (s < 0) return { z: null, lat: null, lon: null }
    const hx = p.x + s * dx, hy = p.y + s * dy, hz = p.z + s * dz
    const r = Math.hypot(hx, hy, hz)
    const lat = Math.asin(Math.max(-1, Math.min(1, hy / r))) * R2D
    const lon = Math.atan2(hx, hz) * R2D
    let zMax = null
    let zVoulu = null
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      const n = 2 ** t.z
      const fx = ((lon + 180) / 360) * n
      const la = lat * Math.PI / 180
      const fy = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n
      if (fx >= t.x && fx < t.x + 1 && fy >= t.y && fy < t.y + 1) {
        if (zMax === null || t.z > zMax) zMax = t.z
      }
    }
    return { z: zMax, lat, lon }
  }

  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    msTraverse = 0
    msBuildImage = 0
    nBuildImage = 0
    camDir = camera.position.clone().normalize()
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a
    // recensement DANS l'appel : `lastUsed === frame` n'est pas encore périmé
    const hors = { ready: 0, empty: 0, loading: 0, error: 0 }
    const dedans = { ready: 0, empty: 0, loading: 0, error: 0 }
    for (const t of g.tiles.values()) {
      if (t.z <= ROOT_Z) continue
      ;(dansTronc(t) ? dedans : hors)[t.state]++
    }
    const centre = zSousLeCentre(camera)
    // les vols sortis du champ : on date la première image où une `loading` en
    // vol (pas en file) n'est plus dans le tronc
    const enFile = new Set(g.queue.map((e) => e.t))
    let volsHorsChamp = 0
    for (const t of g.tiles.values()) {
      if (t.state !== 'loading' || enFile.has(t)) { if (t.state !== 'loading') delete t._pf2Sorti; continue }
      if (dansTronc(t)) delete t._pf2Sorti
      else { volsHorsChamp++; if (t._pf2Sorti === undefined) t._pf2Sorti = performance.now() }
    }
    // les tuiles DESSINÉES : où tombent-elles à l'écran ? (témoin de la projection)
    let dMax = 0, dSomme = 0, nVis = 0, nVisHorsEcran = 0
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      const n = ndcDe(t.center)
      const d = n ? Math.hypot(n[0], n[1]) : 9
      nVis++; dSomme += d; if (d > dMax) dMax = d; if (d > 1.5) nVisHorsEcran++
    }
    const cp = camera.position
    P.images.push({
      cam: [Math.round(cp.x * 1000) / 1000, Math.round(cp.y * 1000) / 1000, Math.round(cp.z * 1000) / 1000],
      visibles: { n: nVis, dMoy: nVis ? Math.round(dSomme / nVis * 100) / 100 : null, dMax: Math.round(dMax * 100) / 100, horsEcran: nVisHorsEcran },
      frame: g.frame, t: Math.round(performance.now()), phase: P.phase,
      msTraverse: Math.round(msTraverse * 1000) / 1000, msUpdate: Math.round(msUpdate * 1000) / 1000,
      msBuild: Math.round(msBuildImage * 100) / 100, nBuild: nBuildImage, volsHorsChamp,
      drawn: g._drawn, visites: g._visites, cache: g.tiles.size, file: g.queue.length, vol: g.inFlight,
      credit: g._credit, refus: g._refus, refusFile: g._refusFile, purgees: g._purgees,
      busy: !!e.modes?.busy, travel: !!e.modes?.travel, az: e.controls?.getAzimuthalAngle ? Math.round(e.controls.getAzimuthalAngle() * 1000) / 1000 : null,
      zCentre: centre.z, lat: centre.lat === null ? null : Math.round(centre.lat * 1000) / 1000, lon: centre.lon === null ? null : Math.round(centre.lon * 1000) / 1000, hors, dedans, mode: e.modes?.mode ?? null,
      alt: Math.round((camera.position.length() - g.radius) * ORBITAL_M_PER_UNIT),
    })
    if (P.images.length > 20000) P.images.splice(0, 5000)
    return out
  }
  // — la cadence réelle et les tâches longues
  let tPrec = performance.now()
  const boucle = () => {
    const n = performance.now()
    P.dtRaf.push(Math.round((n - tPrec) * 100) / 100)
    tPrec = n
    if (P.dtRaf.length > 20000) P.dtRaf.splice(0, 5000)
    requestAnimationFrame(boucle)
  }
  requestAnimationFrame(boucle)
  try {
    new PerformanceObserver((l) => {
      for (const en of l.getEntries()) P.longtasks.push({ t: Math.round(en.startTime), ms: Math.round(en.duration), phase: P.phase })
    }).observe({ entryTypes: ['longtask'] })
  } catch { /* pas de longtask ici */ }
  // — le coût du décodage d'une tuile, tel que `fetchTile` le paie sur le fil
  // principal : drawImage + getImageData + la boucle terrarium (px² itérations)
  P.decode = {}
  for (const px of [256, 512]) {
    const src = document.createElement('canvas'); src.width = src.height = px
    const sctx = src.getContext('2d'); sctx.fillStyle = '#7f8081'; sctx.fillRect(0, 0, px, px)
    const temps = []
    for (let k = 0; k < 7; k++) {
      const a = performance.now()
      const c = document.createElement('canvas'); c.width = c.height = px
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(src, 0, 0)
      const rgba = ctx.getImageData(0, 0, px, px).data
      const heights = new Float32Array(px * px)
      for (let i = 0; i < heights.length; i++) heights[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
      temps.push(performance.now() - a)
    }
    temps.sort((x, y) => x - y)
    P.decode[px] = Math.round(temps[3] * 100) / 100
  }
  return 'posé'
}

// lecture, en JSON sûr
const LIRE = () => {
  const P = window.__pf2
  const g = window.__exp.globe
  return JSON.parse(JSON.stringify({
    phase: P.phase, arrivees: P.arrivees, demandes: P.demandes, images: P.images, dtRaf: P.dtRaf, longtasks: P.longtasks,
    cache: g.tiles.size, cacheMax: g.cacheMax, continu: !!g.continu, enVol: g.tuilesEnVol ? g.tuilesEnVol() : null, decode: P.decode,
  }))
}

const quantile = (arr, q) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

async function attendreImages(page, n) {
  await page.evaluate(
    (k) => new Promise((res) => { let i = 0; const t = () => (++i >= k ? res() : requestAnimationFrame(t)); requestAnimationFrame(t) }),
    n
  )
}
// « calme » = plus rien en vol ni en file, ET le compte de tuiles prêtes ne bouge
// plus depuis 1,5 s. ⚠️ `tuilesEnVol()` compte aussi les `empty` fraîches qu'un
// parcours redemande à chaque image sans jamais les obtenir (quarantaine après
// un double 404) : mesuré, il ne retombe JAMAIS à zéro sur certaines vues
// (porte expirée à 60 s, deux fois). Ce n'est pas le calme qu'on attend ici.
async function attendreCalme(page, maxMs = 30000) {
  const a = Date.now()
  let precedent = null
  let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => {
      const g = window.__exp.globe
      let ready = 0
      for (const t of g.tiles.values()) if (t.state === 'ready') ready++
      return { ready, file: g.queue.length, vol: g.inFlight }
    })
    const cle = `${e.ready}/${e.file}/${e.vol}`
    if (e.file === 0 && e.vol === 0 && cle === precedent) {
      if (stableDepuis === null) stableDepuis = Date.now()
      else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false }
    } else stableDepuis = null
    precedent = cle
    await dodo(150)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  let serveur = null
  if (DIST) serveur = await servir(DIST, PORT)
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(),
    headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })

  // ── le réseau, au protocole, par phase ──
  const enCours = new Map() // requestId → { hote, phase, url }
  let phase = 'attente'
  const reseau = {} // phase → { requetes, octets, parHote: { hote: { requetes, octets } } }
  const cle = (ph) => (reseau[ph] ??= { requetes: 0, octets: 0, parHote: {} })
  cdp.on('Network.requestWillBeSent', (ev) => {
    let hote = '?'
    try { hote = new URL(ev.request.url).host } catch { /* data: */ }
    if (hote === `localhost:${PORT}` || hote === '?') return // le code de l'app, pas les tuiles
    enCours.set(ev.requestId, { hote, phase })
    const r = cle(phase)
    r.requetes++
    const h = (r.parHote[hote] ??= { requetes: 0, octets: 0 })
    h.requetes++
  })
  cdp.on('Network.loadingFinished', (ev) => {
    const q = enCours.get(ev.requestId)
    if (!q) return
    enCours.delete(ev.requestId)
    const r = cle(q.phase)
    r.octets += ev.encodedDataLength || 0
    r.parHote[q.hote].octets += ev.encodedDataLength || 0
  })
  const poserPhase = async (p) => {
    phase = p
    await page.evaluate((p2) => { window.__pf2.phase = p2 }, p)
  }

  const journal = { etiquette: ETIQ, scenario: SCENARIO, port: PORT, dist: DIST, cpu: CPU, departM: DEPART_M, crans: CRANS, periodeMs: PERIODE, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString() }
  const erreurs = []
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + String(e.message).slice(0, 160)))

  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
  journal.instrument = await page.evaluate(INSTRUMENTER)
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  journal.msVoileParti = Date.now() - t0
  await page.keyboard.press('Escape')
  await dodo(500)
  journal.voile = await page.evaluate(() => {
    document.body.classList.remove('ce-hub')
    document.querySelector('.ce-hubveil')?.remove()
    const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    return { canevas: e === window.__exp.renderer.domElement, nom: e ? e.tagName + '.' + (e.className || '') : 'null' }
  })
  journal.machine = await page.evaluate(() => {
    let gpu = 'inconnu'
    try {
      const gl = window.__exp.renderer.getContext()
      const d = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    } catch (e) { gpu = 'erreur: ' + e.message }
    return { gpu, palier: window.__palierMachine ?? null, pixelRatio: window.devicePixelRatio, ecran: [innerWidth, innerHeight] }
  })
  console.log(`pilote : ${journal.machine.gpu} · palier ${JSON.stringify(journal.machine.palier)} · cpu ×${CPU}`)

  // la pose de démarrage : on attend que le vol d'ouverture retombe
  const a1 = Date.now()
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 40000, polling: 200 }).catch(() => {})
  await dodo(1500)
  journal.msPoseDemarrage = Date.now() - a1
  journal.modeDepart = await page.evaluate(() => ({ mode: window.__exp.modes.mode, altM: window.__exp.modes.altM, orbAlt: window.__exp.modes.orbAlt }))
  console.log(`mode au départ : ${JSON.stringify(journal.modeDepart)}`)

  // ── l'altitude posée AU CRAN, dans le mode natif ──
  // ⚠️ `enterOrbit` est un PIÈGE ici : sous les drapeaux levés la sphère EST le
  // mode `surface` continu (le crop sur le globe), et le premier cran ramène de
  // l'orbite au mode surface. Mesuré au premier tour de cette sonde :
  // `arretCran: 1`. On pose donc l'altitude avec le geste du produit — la
  // molette, ×√2 le cran (D19) — jusqu'à tomber dans [0,7 ; 1,45] de la cible.
  const cran = (sens) => page.evaluate((s) => {
    const el = window.__exp.renderer.domElement
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: s * -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }))
  }, sens)
  const altitude = () => page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? null)
  // ⚠️ LA MOLETTE N'EST PAS UN CRAN : en mode surface `_zoomGesture` ajoute une
  // IMPULSION à une vitesse de zoom inertielle (`_zoomVel`), plafonnée. Un
  // événement isolé toutes les 160 ms ne porte que ×1,015 (mesuré) ; un vrai
  // défilement en envoie vingt par seconde. Le CRAN du produit (×√2, D19) est
  // `modes.cranZoom(dir)` — le bouton +/−. On pose donc l'altitude au bouton,
  // en attendant que l'altitude se POSE entre deux (deux lectures égales à
  // 100 ms), et on descend à la molette en RAFALE (toutes les 40 ms).
  const cranBouton = async (sens) => {
    await page.evaluate((s) => window.__exp.modes.cranZoom(s), sens)
    let prec = await altitude()
    const a = Date.now()
    while (Date.now() - a < 6000) {
      await dodo(100)
      const alt = await altitude()
      if (alt !== null && prec !== null && Math.abs(alt - prec) < 1e-6 * Math.max(1, alt)) return alt
      prec = alt
    }
    return prec
  }
  const poserAltitude = async (altM) => {
    const serie = []
    for (let i = 0; i < 60; i++) {
      const alt = await altitude()
      if (alt === null) break
      serie.push(Math.round(alt))
      const ratio = altM / alt
      // ⚠️ `cranZoom(+1)` ZOOME (×1/√2) : mesuré, la première pose a plongé à 102 m.
      if (ratio > 1.45) await cranBouton(-1)
      else if (ratio < 0.7) await cranBouton(+1)
      else break
    }
    journal.poseSerie = serie
    return serie.length
  }
  await poserPhase('pose')
  journal.cransPose = await poserAltitude(DEPART_M)
  await dodo(1500)
  journal.calmeDepart = await attendreCalme(page, 60000)
  // ⚠️ et le pilote doit avoir rendu la main : un glissé pendant `busy` est
  // jeté (mesuré : 0 u de déplacement, 89 requêtes quand même)
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 40000, polling: 200 }).catch(() => { journal.busyAuDepart = true })
  await dodo(500)
  journal.etatDepart = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  console.log(`altitude posée en ${journal.cransPose} crans : ${JSON.stringify(journal.etatDepart)} · calme en ${journal.calmeDepart.ms} ms${journal.calmeDepart.expire ? ' (EXPIRÉ)' : ''}`)

  const CX = Math.round(LARGEUR / 2), CY = Math.round(HAUTEUR / 2)
  const souris = (type, x, y, bouton = 'left', boutons = 1) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: bouton, buttons: boutons, clickCount: type === 'mousePressed' ? 1 : 0 })
  // ⚠️ LE GLISSÉ GAUCHE NE DÉPLACE PAS LA CAMÉRA DU GLOBE : mesuré, il fait
  // tourner la caméra principale autour du bloc (azimut 0 → −3,1 rad) pendant
  // que la caméra que le globe voit reste au même point (0,001 u), lat/lon sous
  // le centre inchangés. Le PAN — celui qui déplace l'emprise, donc la planète
  // sous la vue — est le bouton DROIT (`controls.target` bouge). C'est lui, le
  // « glissé » au sens de la tuile qui entre à l'écran.
  async function glisser(dx, dy, pas = 24) {
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY, 'right', 2)
    await attendreImages(page, 2)
    for (let i = 1; i <= pas; i++) {
      await souris('mouseMoved', CX + Math.round((dx * i) / pas), CY + Math.round((dy * i) / pas), 'right', 2)
      await attendreImages(page, 2)
    }
    await souris('mouseReleased', CX + dx, CY + dy, 'right', 0)
  }
  const marques = {}
  if (SCENARIO === 'descente') {
    await poserPhase('descente')
    marques.debut = await page.evaluate(() => Math.round(performance.now()))
    const altSerie = []
    for (let i = 0; i < CRANS; i++) {
      await cran(+1)
      await dodo(PERIODE)
      const alt = await altitude()
      if (i % 5 === 0) altSerie.push(Math.round(alt))
      if (alt !== null && alt < ARRIVEE_M) { marques.arretCran = i + 1; break }
    }
    journal.altSerie = altSerie
    marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
    journal.calmeFin = await attendreCalme(page, 60000)
    marques.calme = await page.evaluate(() => Math.round(performance.now()))
    journal.etatFin = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  } else if (SCENARIO === 'glisse') {
    await poserPhase('glisse')
    marques.debut = await page.evaluate(() => Math.round(performance.now()))
    // ⚠️ le déplacement se lit sur la caméra QUE LE GLOBE VOIT (celle passée à
    // `update`) : en mode surface le glissé déplace l'emprise, pas `camera`.
    await glisser(400, 0)
    marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
    journal.calmeFin = await attendreCalme(page, 60000)
    marques.calme = await page.evaluate(() => Math.round(performance.now()))
    journal.etatFin = await page.evaluate(() => ({ mode: window.__exp.modes.mode, cache: window.__exp.globe.tiles.size }))
  } else if (SCENARIO === 'rotation') {
    // le glissé GAUCHE : la caméra principale tourne autour du bloc, la caméra
    // du globe ne bouge pas — mais le geste lève le repos (`_cropSeul`), et le
    // parcours s'étend à tout le tronc. C'est LE témoin des demandes hors champ.
    await poserPhase('rotation')
    marques.debut = await page.evaluate(() => Math.round(performance.now()))
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    for (let i = 1; i <= 24; i++) { await souris('mouseMoved', CX + Math.round((400 * i) / 24), CY); await attendreImages(page, 2) }
    await souris('mouseReleased', CX + 400, CY, 'left', 0)
    marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
    journal.calmeFin = await attendreCalme(page, 60000)
    marques.calme = await page.evaluate(() => Math.round(performance.now()))
    journal.etatFin = await page.evaluate(() => ({ mode: window.__exp.modes.mode, cache: window.__exp.globe.tiles.size }))
  } else if (SCENARIO === 'cache') {
    await poserPhase('cache')
    const depart = Date.now()
    journal.releves = []
    for (const jalon of JALONS) {
      const cible = depart + jalon * 1000
      while (Date.now() < cible) {
        const reste = cible - Date.now()
        if (reste > 6000) {
          try {
            await glisser(180, 0); await attendreImages(page, 20)
            await glisser(-120, 80); await attendreImages(page, 20)
            for (let i = 0; i < 5; i++) { await cran(+1); await dodo(120) }
            await attendreImages(page, 40)
            for (let i = 0; i < 5; i++) { await cran(-1); await dodo(120) }
            await attendreImages(page, 40)
          } catch (err) {
            erreurs.push('usage: ' + String(err.message).slice(0, 120))
            await dodo(1000)
          }
        } else await dodo(Math.min(reste, 500))
      }
      const r = await page.evaluate(() => {
        const g = window.__exp.globe
        const P = window.__pf2
        const derniere = P.images[P.images.length - 1]
        let ready = 0
        for (const t of g.tiles.values()) if (t.state === 'ready') ready++
        return { cache: g.tiles.size, cacheMax: g.cacheMax, ready, file: g.queue.length, vol: g.inFlight, hors: derniere?.hors, dedans: derniere?.dedans, frame: g.frame, mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null }
      })
      const rz = cle('cache')
      journal.releves.push({ jalonS: jalon, ms: Date.now() - depart, ...r, reseau: { requetes: rz.requetes, octets: rz.octets } })
      const h = r.hors || {}
      console.log(`t+${String(jalon).padStart(4)}s · cache ${r.cache}/${r.cacheMax} · ready ${r.ready} · HORS TRONC ready ${h.ready} empty ${h.empty} loading ${h.loading} error ${h.error} · dans le tronc ready ${r.dedans?.ready} · req ${rz.requetes} · ${(rz.octets / 1048576).toFixed(1)} Mio · alt ${r.alt && Math.round(r.alt)}`)
    }
  }
  journal.marques = marques

  // ── la lecture et le dépouillement ──
  const P = await page.evaluate(LIRE)
  journal.reseau = reseau
  journal.erreurs = erreurs
  journal.machineFin = await page.evaluate(() => ({ palier: window.__palierMachine ?? null }))

  const ph = SCENARIO
  const arr = P.arrivees.filter((a) => a.phase === ph)
  const dem = P.demandes.filter((a) => a.phase === ph)
  const imgs = P.images.filter((a) => a.phase === ph)
  const frac = (xs, f) => (xs.length ? Math.round((xs.filter(f).length / xs.length) * 1000) / 10 : null)
  const N = 20
  const premieres = arr.slice(0, N)
  const resume = {
    arrivees: arr.length, demandes: dem.length,
    premieres20: { n: premieres.length, tronc: frac(premieres, (a) => a.tronc), central: frac(premieres, (a) => a.central), dNdcMoyen: premieres.length ? Math.round(premieres.reduce((s, a) => s + (a.dNdc ?? 2), 0) / premieres.length * 1000) / 1000 : null, zs: premieres.map((a) => a.z).join(' ') },
    toutes: { tronc: frac(arr, (a) => a.tronc), central: frac(arr, (a) => a.central), utile: frac(arr, (a) => a.utile) },
    demandesHorsTronc: frac(dem, (a) => !a.tronc),
    // par niveau : combien de tuiles de ce niveau sont arrivées AVANT la
    // première qui tombe dans le tiers central — 0 = le centre d'abord
    rangCentralParZ: Object.fromEntries([...new Set(arr.map((a) => a.z))].sort((x, y) => x - y).map((z) => {
      const dz = arr.filter((a) => a.z === z)
      const i = dz.findIndex((a) => a.central)
      return [z, { n: dz.length, rangCentral: i < 0 ? null : i, dNdcPremiers5: Math.round(dz.slice(0, 5).reduce((s2, a) => s2 + (a.dNdc ?? 2), 0) / Math.min(5, dz.length) * 100) / 100 }]
    })),
    msBuild: { p50: quantile(arr.map((a) => a.msBuild), 0.5), p99: quantile(arr.map((a) => a.msBuild), 0.99), somme: Math.round(arr.reduce((s, a) => s + a.msBuild, 0)), parImageP99: quantile(imgs.map((i) => i.msBuild), 0.99), parImageMax: Math.max(0, ...imgs.map((i) => i.msBuild)), nParImageMax: Math.max(0, ...imgs.map((i) => i.nBuild)) },
    decode: P.decode,
    vol: { p50: quantile(arr.map((a) => a.msVol).filter((v) => v !== null), 0.5), p99: quantile(arr.map((a) => a.msVol).filter((v) => v !== null), 0.99), perduSomme: arr.reduce((s, a) => s + (a.msPerdu || 0), 0), perdues: arr.filter((a) => a.msPerdu > 0).length, volsHorsChampMax: Math.max(0, ...imgs.map((i) => i.volsHorsChamp | 0)), dureePhaseMs: imgs.length ? imgs[imgs.length - 1].t - imgs[0].t : 0 },
    traverse: { p50: quantile(imgs.map((i) => i.msTraverse), 0.5), p99: quantile(imgs.map((i) => i.msTraverse), 0.99), images: imgs.length },
    update: { p50: quantile(imgs.map((i) => i.msUpdate), 0.5), p99: quantile(imgs.map((i) => i.msUpdate), 0.99) },
    dtRaf: { p50: quantile(P.dtRaf, 0.5), p99: quantile(P.dtRaf, 0.99), n: P.dtRaf.length },
    longtasks: { n: P.longtasks.filter((l) => l.phase === ph).length, msTotal: P.longtasks.filter((l) => l.phase === ph).reduce((s, l) => s + l.ms, 0), max: Math.max(0, ...P.longtasks.filter((l) => l.phase === ph).map((l) => l.ms)) },
    refusMax: Math.max(0, ...imgs.map((i) => i.refus | 0)), refusFileMax: Math.max(0, ...imgs.map((i) => i.refusFile | 0)),
    fileMax: Math.max(0, ...imgs.map((i) => i.file | 0)), cacheMax: Math.max(0, ...imgs.map((i) => i.cache | 0)),
    reseau: reseau[ph] ?? null,
  }
  // la première image nette au centre : après l'arrêt du geste, quand zCentre
  // atteint sa valeur finale (et n'en redescend plus)
  if (marques.arretGeste && imgs.length) {
    const apres = imgs.filter((i) => i.t >= marques.arretGeste)
    const zFin = apres.length ? apres[apres.length - 1].zCentre : null
    let tNette = null
    for (let i = 0; i < apres.length; i++) {
      if (apres[i].zCentre === zFin && apres.slice(i).every((k) => k.zCentre === zFin)) { tNette = apres[i].t; break }
    }
    const zArret = apres.length ? apres[0].zCentre : null
    resume.nettete = { zAuCentreALArret: zArret, zFinal: zFin, msApresArret: tNette === null ? null : tNette - marques.arretGeste, msCalme: journal.calmeFin?.ms ?? null }
    // et pendant le geste : à chaque image, le z au centre (série courte)
    resume.zCentreSerie = imgs.filter((_, k) => k % Math.max(1, Math.floor(imgs.length / 40)) === 0).map((i) => i.zCentre).join(' ')
  }
  const derniere = imgs[imgs.length - 1]
  if (derniere) resume.horsTroncFin = derniere.hors
  if (imgs.length) {
    const c0 = imgs[0].cam, c1 = derniere.cam
    resume.deplacementCamGlobe = Math.round(Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) * 1000) / 1000
    resume.visibles = { dMoyMax: Math.max(...imgs.map((i) => i.visibles.dMoy ?? 0)), dMaxMax: Math.max(...imgs.map((i) => i.visibles.dMax)), horsEcranMax: Math.max(...imgs.map((i) => i.visibles.horsEcran)) }
    resume.demandesParent = { parentTronc: frac(dem, (a) => a.parentTronc === true), horsHorizon: frac(dem, (a) => a.horsHorizon === true), frustum: frac(dem, (a) => a.frustum === true) }
  }
  journal.resume = resume
  journal.brut = { arrivees: arr.slice(0, 200), demandes: dem.slice(0, 200), images: imgs.filter((_, k) => k % 2 === 0).slice(0, 3000), longtasks: P.longtasks.slice(0, 300) }

  const nom = path.join(SORTIE, `${ETIQ}-${SCENARIO}${CPU > 1 ? `-cpu${CPU}` : ''}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log('')
  console.log(`— ${ETIQ} · ${SCENARIO} · ${arr.length} arrivées, ${dem.length} demandes —`)
  console.log(`20 premières : tronc ${resume.premieres20.tronc} % · tiers central ${resume.premieres20.central} % · dNdc moyen ${resume.premieres20.dNdcMoyen} · z : ${resume.premieres20.zs}`)
  console.log(`toutes       : tronc ${resume.toutes.tronc} % · central ${resume.toutes.central} % · encore utiles à l'arrivée ${resume.toutes.utile} % · demandes hors tronc ${resume.demandesHorsTronc} %`)
  console.log(`par niveau   : ${Object.entries(resume.rangCentralParZ).map(([z, v]) => `z${z}:${v.n} tuiles, centre au rang ${v.rangCentral ?? '∅'}, dNdc des 5 premières ${v.dNdcPremiers5}`).join(' · ')}`)
  if (resume.nettete) console.log(`netteté      : z au centre à l'arrêt ${resume.nettete.zAuCentreALArret} → final ${resume.nettete.zFinal}, nette ${resume.nettete.msApresArret} ms après l'arrêt · calme en ${resume.nettete.msCalme} ms`)
  console.log(`_traverse    : p50 ${resume.traverse.p50} ms · p99 ${resume.traverse.p99} ms (${resume.traverse.images} images) · update p50 ${resume.update.p50} p99 ${resume.update.p99}`)
  console.log(`_buildMesh   : p50 ${resume.msBuild.p50} ms · p99 ${resume.msBuild.p99} ms · Σ ${resume.msBuild.somme} ms · rAF p50 ${resume.dtRaf.p50} p99 ${resume.dtRaf.p99} · tâches longues ${resume.longtasks.n} (Σ ${resume.longtasks.msTotal} ms, max ${resume.longtasks.max})`)
  console.log(`décodage     : 256² ${resume.decode?.[256]} ms · 512² ${resume.decode?.[512]} ms · builds par image p99 ${resume.msBuild.parImageP99} ms, max ${resume.msBuild.parImageMax} ms (${resume.msBuild.nParImageMax} tuiles)`)
  console.log(`vol          : p50 ${resume.vol.p50} ms · p99 ${resume.vol.p99} ms · créneaux perdus hors champ Σ ${resume.vol.perduSomme} ms sur ${resume.vol.perdues} tuiles (phase ${resume.vol.dureePhaseMs} ms × 6 créneaux = ${resume.vol.dureePhaseMs * 6} ms) · vols hors champ max ${resume.vol.volsHorsChampMax}`)
  console.log(`file max ${resume.fileMax} · cache max ${resume.cacheMax} · refus max ${resume.refusMax} · refus file ${resume.refusFileMax} · hors tronc à la fin ${JSON.stringify(resume.horsTroncFin)}`)
  console.log(`témoins      : déplacement caméra-globe ${resume.deplacementCamGlobe} u · dessinées dNdc moyen max ${resume.visibles?.dMoyMax} · max ${resume.visibles?.dMaxMax} · hors écran max ${resume.visibles?.horsEcranMax} · demandes : parent dans le tronc ${resume.demandesParent?.parentTronc} % · hors horizon ${resume.demandesParent?.horsHorizon} % · dans le frustum ${resume.demandesParent?.frustum} %`)
  if (resume.reseau) console.log(`réseau       : ${resume.reseau.requetes} requêtes · ${(resume.reseau.octets / 1048576).toFixed(2)} Mio · ${JSON.stringify(Object.fromEntries(Object.entries(resume.reseau.parHote).map(([h, v]) => [h, v.requetes])))}`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
  if (serveur) serveur.close()
}

lancer().catch((e) => { console.error(e); process.exit(1) })
