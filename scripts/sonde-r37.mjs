// SONDE R37 — LE FLOU DE ZOOM, EN PIXELS : quelle fraction de l'écran est
// dessinée par une tuile plus grossière que celle que le parcours veut ?
//
// ══════════ CE QU'ELLE MESURE, DANS `update()` ═══════════════════════════════
//
// Une grille de 32 × 18 points d'écran (NDC). Pour chaque point : le rayon de
// la caméra coupe la sphère → lat/lon → la tuile DESSINÉE qui porte ce point
// (`mesh.visible`, du niveau le plus fin au plus grossier). On relève :
//   · `trou`    — aucune tuile dessinée ne couvre le point (la planète est
//                 devant, pas le ciel) ;
//   · `retard`  — combien de niveaux la tuile dessinée est en dessous de ce
//                 que `_traverse` VEUT à cet endroit (`chord / dist` contre
//                 `SPLIT_RATIO`, ou le zoom prescrit du crop) ;
//   · `etire`   — pixels par texel de la tuile dessinée (≥ 2 = parent étiré
//                 au sens du brief) ;
//   · `recul`   — la tuile dessinée à ce point d'écran est PLUS GROSSIÈRE qu'à
//                 l'image d'avant (une zone nette qui redevient floue).
// Par image : fraction d'écran en retard ≥ 1, étirée ≥ 2, en recul, en trou ;
// le déplacement de la caméra ; les compteurs `_rechargeTuiles`, `poserCrop`,
// évictions de tuiles dessinées, annulations en vol de tuiles du champ ;
// `_traverse` (ms), dessinées, requêtes (CDP).
//
// Le geste : altitude posée au bouton à `--depart` m, puis rafale de molette
// (40 ms) jusqu'à `--arrivee` m ; captures d'écran toutes les `--capture` ms
// pendant la descente (pour la couture, dépouillée par scripts/couture-r37.py).
//
// EMPLOI
//   node scripts/sonde-r37.mjs --port 6931 --etiquette avant
//   --depart 800000 --arrivee 20000 --cpu 1 --capture 400 --visible 0
// Sort `.banc/R37/<etiquette>.json` et `.banc/R37/<etiquette>-NNN.png`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '6931'))
const ETIQ = opt('--etiquette', 'releve')
const CPU = Number(opt('--cpu', '1'))
const DEPART_M = Number(opt('--depart', '800000'))
const ARRIVEE_M = Number(opt('--arrivee', '20000'))
const PERIODE = Number(opt('--periode', '40'))
const CAPTURE = Number(opt('--capture', '400'))
const VISIBLE = opt('--visible', '0') !== '0'
const PRELECTURE = opt('--prelecture', '1') !== '0'
const RATIO = Number(opt('--ratio', '0'))
// avant | partiel (partiel seul) | surplace (partiel + sur place + enfants protégés, sans prélecture) | complet
const VARIANTE = opt('--variante', 'complet')
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'R37'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ═══════════════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ═══════════════════════
function INSTRUMENTER() {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__r37) return 'déjà posé'
  const g = e.globe
  const P = { phase: 'attente', images: [], compteurs: { recharge: 0, poserCrop: 0, evicteesDessinees: 0, annuleesChamp: 0 } }
  window.__r37 = P
  const ROOT_Z = 2, MAX_Z = 15, SPLIT = 0.38, ZOOM_SOCLE = 13
  const PLANCHER = 1 * (100 / 6371000) // PLANCHER_DIST_M = 1 m, en unités
  const NX = 32, NY = 18
  const R2D = 180 / Math.PI

  // — les compteurs
  const rechOrig = g._rechargeTuiles.bind(g)
  g._rechargeTuiles = function () { P.compteurs.recharge++; return rechOrig() }
  const cropOrig = g.poserCrop.bind(g)
  g.poserCrop = function (o) { P.compteurs.poserCrop++; return cropOrig(o) }
  const evOrig = g._evictJusqua.bind(g)
  g._evictJusqua = function (max) {
    const dessinees = new Set()
    for (const t of g.tiles.values()) if (t.mesh && (t.mesh.visible || t.coverFrame === g.frame - 1)) dessinees.add(t.key)
    const r = evOrig(max)
    for (const k of dessinees) if (!g.tiles.has(k)) P.compteurs.evicteesDessinees++
    return r
  }
  const annOrig = g._annuler.bind(g)
  g._annuler = function (t) {
    if (t.state === 'loading' && t.lastUsed === g.frame) P.compteurs.annuleesChamp++
    return annOrig(t)
  }
  let profondeur = 0, msTraverse = 0
  const travOrig = g._traverse.bind(g)
  g._traverse = function (t, a, b) {
    if (profondeur === 0) { const d = performance.now(); profondeur++; try { return travOrig(t, a, b) } finally { profondeur--; msTraverse += performance.now() - d } }
    profondeur++; try { return travOrig(t, a, b) } finally { profondeur-- }
  }

  // — la tuile sous un point lat/lon
  const tuileXY = (lat, lon, z) => {
    const n = 2 ** z
    const la = lat * Math.PI / 180
    return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)]
  }
  const dessineeSous = (lat, lon) => {
    for (let z = MAX_Z; z >= ROOT_Z; z--) {
      const [x, y] = tuileXY(lat, lon, z)
      const t = g.tiles.get(`${z}/${x}/${y}`)
      if (t && t.mesh && t.mesh.visible) return t
    }
    return null
  }
  const dansCrop = (z, x, y) => {
    const rep = g._crop
    if (!rep) return false
    const n = 2 ** z
    if ((y + 1) / n <= rep.cy - rep.demi || y / n >= rep.cy + rep.demi) return false
    let dx = (x + 0.5) / n - rep.cx; dx -= Math.round(dx)
    return Math.abs(dx) < rep.demi + 0.5 / n
  }
  // le niveau que `_traverse` VEUT à cet endroit, depuis la tuile dessinée
  const zVoulu = (t, camPos) => {
    if (dansCrop(t.z, t.x, t.y) && g._cropSeul !== undefined) {
      const zc = dansCrop(t.z, t.x, t.y) ? ZOOM_SOCLE : 0
      if (zc) return Math.max(t.z, zc)
    }
    let z = t.z, chord = t.chord
    const d0 = camPos.distanceTo(t.center)
    while (z < MAX_Z) {
      const dist = Math.max(d0 - chord * 0.5, PLANCHER)
      if (chord / dist > SPLIT) { z++; chord /= 2 } else break
    }
    return z
  }
  const appl = (m, x, y, z) => {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]
  }
  let precedent = null // z dessiné par point d'écran, image d'avant
  let camPrec = null
  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    msTraverse = 0
    const c0 = { ...P.compteurs }
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a
    // la grille d'écran
    const p = camera.position
    const R = g.radius
    const inv = camera.projectionMatrixInverse
    const mw = camera.matrixWorld
    const fovT = Math.tan((camera.fov * Math.PI / 180) / 2)
    const pxParUniteA1 = HAUTEUR_PX / (2 * fovT)
    const zs = new Array(NX * NY).fill(null)
    let planete = 0, trou = 0, retard1 = 0, retard2 = 0, etire2 = 0, recul = 0, sommeZ = 0, sommeVoulu = 0, sommeEtire = 0
    const parZ = {}
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const nx = ((i + 0.5) / NX) * 2 - 1, ny = 1 - ((j + 0.5) / NY) * 2
      // rayon monde : point NDC (nx, ny, 1) déprojeté
      const w1 = appl(inv.elements, nx, ny, 1)
      const w2 = appl(mw.elements, w1[0], w1[1], w1[2])
      let vx = w2[0] - p.x, vy = w2[1] - p.y, vz = w2[2] - p.z
      const nv = Math.hypot(vx, vy, vz); vx /= nv; vy /= nv; vz /= nv
      const b = p.x * vx + p.y * vy + p.z * vz, c = p.lengthSq() - R * R, disc = b * b - c
      if (disc < 0) continue
      const s = -b - Math.sqrt(disc)
      if (s < 0) continue
      planete++
      const hx = p.x + vx * s, hy = p.y + vy * s, hz = p.z + vz * s
      const r = Math.hypot(hx, hy, hz)
      const lat = Math.asin(hy / r) * R2D, lon = Math.atan2(hx, hz) * R2D
      const t = dessineeSous(lat, lon)
      const k = j * NX + i
      if (!t) {
        // un trou ne compte que là où la planète est visible : hors crop au repos
        // (`uEstompage = 1`), rien ne se dessine PAR DESSEIN (Tâche N)
        const est = g.uniforms?.uEstompage?.value ?? 0
        const on = g.uniforms?.uEstompageOn?.value ?? 0
        const [xz, yz] = tuileXY(lat, lon, ZOOM_SOCLE)
        if (!(on > 0.5 && est >= 1) || dansCrop(ZOOM_SOCLE, xz, yz)) trou++
        zs[k] = null; continue
      }
      zs[k] = t.z
      const zv = zVoulu(t, p)
      const ret = zv - t.z
      sommeZ += t.z; sommeVoulu += zv
      if (ret >= 1) retard1++
      if (ret >= 2) retard2++
      const texels = t.size || 256
      const et = (t.chord / texels) * pxParUniteA1 / Math.max(s, 1e-9)
      sommeEtire += et
      if (et >= 2) etire2++
      parZ[t.z] = (parZ[t.z] || 0) + 1
      if (precedent && precedent[k] !== null && precedent[k] !== undefined && t.z < precedent[k]) recul++
    }
    precedent = zs
    const cp = camera.position
    const dep = camPrec ? Math.hypot(cp.x - camPrec[0], cp.y - camPrec[1], cp.z - camPrec[2]) : 0
    camPrec = [cp.x, cp.y, cp.z]
    let partiels = 0, dessinees = 0
    // pourquoi un parent dessiné qui VEUT descendre ne descend-il pas ? l'état de ses enfants
    const blocages = { absent: 0, empty: 0, loading: 0, error: 0, readySansMesh: 0, horsChamp: 0, parents: 0 }
    const camDir = p.clone().normalize()
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      dessinees++; if (t._partiel) partiels++
      if (t.z >= MAX_Z || zVoulu(t, p) <= t.z) continue
      blocages.parents++
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const k = g.tiles.get(`${t.z + 1}/${t.x * 2 + dx}/${t.y * 2 + dy}`)
        if (!k) { blocages.absent++; continue }
        if (g.continu && !g._dansLeChamp(k, camDir)) { blocages.horsChamp++; continue }
        if (k.state === 'ready' && !k.mesh) blocages.readySansMesh++
        else if (k.state !== 'ready') blocages[k.state] = (blocages[k.state] || 0) + 1
      }
    }
    P.images.push({
      frame: g.frame, t: Math.round(performance.now()), phase: P.phase, planete, trou, retard1, retard2, etire2, recul,
      zMoy: planete - trou ? Math.round(sommeZ / (planete - trou) * 100) / 100 : null,
      zVouluMoy: planete - trou ? Math.round(sommeVoulu / (planete - trou) * 100) / 100 : null,
      etireMoy: planete - trou ? Math.round(sommeEtire / (planete - trou) * 100) / 100 : null,
      parZ, depCam: Math.round(dep * 1e6) / 1e6, alt: Math.round((cp.length() - R) * 63710),
      msTraverse: Math.round(msTraverse * 1000) / 1000, msUpdate: Math.round(msUpdate * 1000) / 1000,
      drawn: g._drawn, dessinees, partiels, prelues: g._prelues ?? 0, visites: g._visites, cache: g.tiles.size, file: g.queue.length, vol: g.inFlight, credit: g._credit,
      recharge: P.compteurs.recharge - c0.recharge, poserCrop: P.compteurs.poserCrop - c0.poserCrop,
      evicteesDessinees: P.compteurs.evicteesDessinees - c0.evicteesDessinees, annuleesChamp: P.compteurs.annuleesChamp - c0.annuleesChamp,
      cropSeul: !!g._cropSeul, estompage: g.uniforms?.uEstompage?.value ?? null, estompageOn: g.uniforms?.uEstompageOn?.value ?? null, crop: !!g._crop, blocages, mode: e.modes?.mode ?? null, busy: !!e.modes?.busy,
    })
    if (P.images.length > 30000) P.images.splice(0, 5000)
    return out
  }
  const HAUTEUR_PX = e.renderer.domElement.height / (window.devicePixelRatio || 1)
  // — les coutures : pour chaque parent dessiné PARTIELLEMENT, les arêtes
  //   (écran) entre un quadrant enfant dessiné et un quadrant porté par le parent
  P.coutures = () => {
    const out = []
    const projeter = (lat, lon) => {
      const hM = g.hauteurDessinee ? (g.hauteurDessinee(lat, lon) || 0) : 0
      const r = g.radius + hM * (100 / 6371000) * (g.exaggeration || 1)
      const la = lat * Math.PI / 180, lo = lon * Math.PI / 180
      const v = appl(g._matVue.elements, r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo))
      return [(v[0] + 1) / 2 * innerWidth, (1 - v[1]) / 2 * innerHeight, v[2]]
    }
    const latLonDe = (z, x, y) => { const n = 2 ** z; const lon = x / n * 360 - 180; const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * R2D; return [lat, lon] }
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible || !t._partiel) continue
      const z = t.z + 1, x0 = t.x * 2, y0 = t.y * 2
      const enfants = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]].map(([x, y]) => { const k = g.tiles.get(`${z}/${x}/${y}`); return { x, y, dessine: !!(k && k.mesh && k.mesh.visible) } })
      // arêtes internes : entre (0,1) (2,3) verticales, (0,2) (1,3) horizontales
      const paires = [[0, 1, 'v'], [2, 3, 'v'], [0, 2, 'h'], [1, 3, 'h']]
      for (const [a, b, sens] of paires) {
        if (enfants[a].dessine === enfants[b].dessine) continue
        // l'arête commune : côté droit de a (v) ou bas de a (h)
        const ea = enfants[a]
        const pts = []
        for (let s = 0; s <= 8; s++) {
          const f = s / 8
          const [lat, lon] = sens === 'v' ? latLonDe(z, ea.x + 1, ea.y + f) : latLonDe(z, ea.x + f, ea.y + 1)
          pts.push(projeter(lat, lon))
        }
        out.push({ parent: t.key, sens, enfantDessine: enfants[a].dessine ? a : b, pts })
      }
    }
    return out
  }
  return 'posé'
}

const LIRE = () => JSON.parse(JSON.stringify({ images: window.__r37.images, compteurs: window.__r37.compteurs }))
const quantile = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }

async function attendreCalme(page, maxMs = 30000) {
  const a = Date.now(); let precedent = null; let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => { const g = window.__exp.globe; let ready = 0; for (const t of g.tiles.values()) if (t.state === 'ready') ready++; return { ready, file: g.queue.length, vol: g.inFlight } })
    const cle = `${e.ready}/${e.file}/${e.vol}`
    if (e.file === 0 && e.vol === 0 && cle === precedent) { if (stableDepuis === null) stableDepuis = Date.now(); else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false } } else stableDepuis = null
    precedent = cle
    await dodo(150)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  let phase = 'attente'
  const reseau = {}
  const cle = (ph) => (reseau[ph] ??= { requetes: 0, octets: 0 })
  const enCours = new Map()
  cdp.on('Network.requestWillBeSent', (ev) => {
    let hote = '?'; try { hote = new URL(ev.request.url).host } catch { /* data: */ }
    if (hote === `localhost:${PORT}` || hote === `127.0.0.1:${PORT}` || hote === '?') return
    enCours.set(ev.requestId, phase); cle(phase).requetes++
  })
  cdp.on('Network.loadingFinished', (ev) => { const ph = enCours.get(ev.requestId); if (ph === undefined) return; enCours.delete(ev.requestId); cle(ph).octets += ev.encodedDataLength || 0 })
  const poserPhase = async (p) => { phase = p; await page.evaluate((p2) => { window.__r37.phase = p2 }, p) }
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)) })

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, departM: DEPART_M, arriveeM: ARRIVEE_M, periodeMs: PERIODE, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString() }
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
  journal.instrument = await page.evaluate(INSTRUMENTER)
  journal.prelecture = PRELECTURE
  await page.evaluate((v, r, va) => {
    const g = window.__exp.globe
    if (!('prelecture' in g)) return
    g.prelecture = v && va === 'complet'
    if (r > 0) g.prelectureRatio = 0.38 * r
    g.raffinementPartiel = va !== 'avant'
    g.protegerEnfants = va === 'surplace' || va === 'complet'
    if (va === 'avant' || va === 'partiel') g.redemanderSurPlace = undefined // le flux retombe sur l'ancien chemin
  }, PRELECTURE, RATIO, VARIANTE)
  journal.variante = VARIANTE
  journal.ratioPrelecture = RATIO
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  journal.machine = await page.evaluate(() => ({ palier: window.__palierMachine ?? null, pixelRatio: window.devicePixelRatio, ecran: [innerWidth, innerHeight] }))
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 40000, polling: 200 }).catch(() => {})
  await dodo(1500)
  journal.modeDepart = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null }))

  const cran = (sens) => page.evaluate((s) => { const el = window.__exp.renderer.domElement; el.dispatchEvent(new WheelEvent('wheel', { deltaY: s * -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })) }, sens)
  const altitude = () => page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? null)
  const cranBouton = async (sens) => {
    await page.evaluate((s) => window.__exp.modes.cranZoom(s), sens)
    let prec = await altitude(); const a = Date.now()
    while (Date.now() - a < 6000) { await dodo(100); const alt = await altitude(); if (alt !== null && prec !== null && Math.abs(alt - prec) < 1e-6 * Math.max(1, alt)) return alt; prec = alt }
    return prec
  }
  await poserPhase('pose')
  const serie = []
  for (let i = 0; i < 60; i++) {
    const alt = await altitude(); if (alt === null) break
    serie.push(Math.round(alt)); const ratio = DEPART_M / alt
    if (ratio > 1.45) await cranBouton(-1); else if (ratio < 0.7) await cranBouton(+1); else break
  }
  journal.poseSerie = serie
  await dodo(1500)
  journal.calmeDepart = await attendreCalme(page, 60000)
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 40000, polling: 200 }).catch(() => { journal.busyAuDepart = true })
  await dodo(500)
  journal.etatDepart = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  console.log(`départ : ${JSON.stringify(journal.etatDepart)} · palier ${JSON.stringify(journal.machine.palier)} · calme ${journal.calmeDepart.ms} ms`)

  // ── la descente, captures d'écran au passage ──
  await poserPhase('descente')
  const marques = { debut: await page.evaluate(() => Math.round(performance.now())) }
  const captures = []
  let derniereCapture = Date.now()
  const capturer = async (nom) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const f = path.join(SORTIE, `${ETIQ}-${nom}.png`)
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'))
    const etat = await page.evaluate(() => { const P = window.__r37; const im = P.images[P.images.length - 1]; return { frame: im?.frame, alt: im?.alt, retard1: im?.retard1, etire2: im?.etire2, trou: im?.trou, planete: im?.planete, partiels: im?.partiels, coutures: P.coutures() } })
    captures.push({ nom, f, ...etat })
  }
  for (let i = 0; i < 600; i++) {
    await cran(+1)
    await dodo(PERIODE)
    if (CAPTURE > 0 && Date.now() - derniereCapture >= CAPTURE) { derniereCapture = Date.now(); await capturer(String(captures.length).padStart(3, '0')) }
    const alt = await altitude()
    if (alt !== null && alt < ARRIVEE_M) { marques.arretCran = i + 1; break }
  }
  marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
  // après l'arrêt : captures encore 4 s (la fin du chargement)
  for (let k = 0; k < 8 && CAPTURE > 0; k++) { await dodo(500); await capturer(String(captures.length).padStart(3, '0')) }
  journal.calmeFin = await attendreCalme(page, 60000)
  marques.calme = await page.evaluate(() => Math.round(performance.now()))
  await poserPhase('fin')
  journal.etatFin = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  journal.marques = marques
  journal.captures = captures

  const P = await page.evaluate(LIRE)
  const imgs = P.images.filter((i) => i.phase === 'descente')
  const frac = (k) => imgs.map((i) => (i.planete ? i[k] / i.planete : 0))
  const stat = (xs) => ({ p50: Math.round(quantile(xs, 0.5) * 1000) / 10, p90: Math.round(quantile(xs, 0.9) * 1000) / 10, max: Math.round(Math.max(0, ...xs) * 1000) / 10, moy: Math.round(xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length) * 1000) / 10 })
  // les épisodes de flou : suites d'images à retard1 > 0, avec la cause
  const episodes = []
  let cur = null
  for (const im of imgs) {
    const f = im.planete ? im.retard1 / im.planete : 0
    if (f > 0.05) {
      if (!cur) cur = { debut: im.t, frames: 0, fracMax: 0, reculMax: 0, depCam: 0, evictees: 0, recharge: 0, poserCrop: 0, annulees: 0 }
      cur.frames++; cur.fracMax = Math.max(cur.fracMax, f); cur.reculMax = Math.max(cur.reculMax, im.planete ? im.recul / im.planete : 0)
      cur.depCam += im.depCam; cur.evictees += im.evicteesDessinees; cur.recharge += im.recharge; cur.poserCrop += im.poserCrop; cur.annulees += im.annuleesChamp
    } else if (cur) { cur.fin = im.t; episodes.push(cur); cur = null }
  }
  if (cur) episodes.push(cur)
  const resume = {
    images: imgs.length, dureeMs: imgs.length ? imgs[imgs.length - 1].t - imgs[0].t : 0,
    retard1: stat(frac('retard1')), retard2: stat(frac('retard2')), etire2: stat(frac('etire2')), recul: stat(frac('recul')),
    trous: { max: Math.max(0, ...imgs.map((i) => i.trou)), images: imgs.filter((i) => i.trou > 0).length },
    imagesFloues: imgs.filter((i) => i.planete && i.retard1 / i.planete > 0.05).length,
    episodes: episodes.length, episodesDetail: episodes.slice(0, 40).map((ep) => ({ ...ep, fracMax: Math.round(ep.fracMax * 100), reculMax: Math.round(ep.reculMax * 100), depCam: Math.round(ep.depCam * 1e4) / 1e4, duree: (ep.fin ?? marques.arretGeste) - ep.debut })),
    compteurs: P.compteurs,
    traverse: { p50: quantile(imgs.map((i) => i.msTraverse), 0.5), p99: quantile(imgs.map((i) => i.msTraverse), 0.99) },
    update: { p50: quantile(imgs.map((i) => i.msUpdate), 0.5), p99: quantile(imgs.map((i) => i.msUpdate), 0.99) },
    drawn: { p50: quantile(imgs.map((i) => i.drawn), 0.5), max: Math.max(0, ...imgs.map((i) => i.drawn)) },
    partielsMax: Math.max(0, ...imgs.map((i) => i.partiels)),
    cacheMax: Math.max(0, ...imgs.map((i) => i.cache)),
    reseau: { descente: reseau.descente ?? null, tout: Object.values(reseau).reduce((s, r) => ({ requetes: s.requetes + r.requetes, octets: s.octets + r.octets }), { requetes: 0, octets: 0 }) },
    calmeFinMs: journal.calmeFin.ms,
  }
  journal.resume = resume
  journal.brut = imgs
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log(`— ${ETIQ} · ${imgs.length} images de descente (${resume.dureeMs} ms) · ${journal.etatDepart.alt | 0} → ${journal.etatFin.alt | 0} m —`)
  console.log(`retard ≥1 niveau (% écran) : p50 ${resume.retard1.p50} · p90 ${resume.retard1.p90} · max ${resume.retard1.max} · moy ${resume.retard1.moy} · images floues ${resume.imagesFloues}/${imgs.length}`)
  console.log(`retard ≥2 : p50 ${resume.retard2.p50} · max ${resume.retard2.max} · étiré ≥2× : p50 ${resume.etire2.p50} · max ${resume.etire2.max} · recul : p50 ${resume.recul.p50} · max ${resume.recul.max}`)
  console.log(`trous : max ${resume.trous.max} points, ${resume.trous.images} images · épisodes de flou ${resume.episodes} · compteurs ${JSON.stringify(P.compteurs)} · partiels max ${resume.partielsMax}`)
  console.log(`_traverse p50 ${resume.traverse.p50} p99 ${resume.traverse.p99} ms · update p50 ${resume.update.p50} p99 ${resume.update.p99} · dessinées p50 ${resume.drawn.p50} max ${resume.drawn.max} · cache max ${resume.cacheMax}`)
  console.log(`réseau descente : ${resume.reseau.descente?.requetes} req · ${((resume.reseau.descente?.octets || 0) / 1048576).toFixed(2)} Mio · calme fin ${resume.calmeFinMs} ms`)
  for (const ep of resume.episodesDetail) console.log(`  épisode ${ep.frames} img / ${ep.duree} ms · flou max ${ep.fracMax} % · recul max ${ep.reculMax} % · Δcam ${ep.depCam} u · évincées dessinées ${ep.evictees} · recharge ${ep.recharge} · poserCrop ${ep.poserCrop} · annulées champ ${ep.annulees}`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
