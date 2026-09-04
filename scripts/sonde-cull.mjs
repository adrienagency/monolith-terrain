// SONDE CULL — ① ce qui est calculé HORS DE L'EMPRISE DU SOCLE, ② les TROUS
// aux coutures, en pixels de fond vus à travers le terrain.
//
// ══════════ CE QU'ELLE MESURE ════════════════════════════════════════════════
//
// **① L'emprise.** À chaque image, dans `update()` (jamais après — §3 de
// `/threejs-optimisation`), sur l'ensemble des tuiles du cache :
//   · `cacheHors`    — entrées de cache dont l'emprise NE RECOUPE PAS celle du
//                      crop (`tuileDansCrop`, la fonction du produit, importée
//                      de `monde/crop-sphere.js` — pas une recopie) ;
//   · `mailleesHors` — les mêmes, mais qui portent un MAILLAGE (le chiffre
//                      d'Adrien : « l'ordi calcule des choses hors crop ») ;
//   · `dessineesHors`— les mêmes, `mesh.visible` à cette image ;
//   · `visitesHors`  — tuiles PARCOURUES hors emprise (relevé DANS `_traverse`).
// Les racines (z ≤ ROOT_Z) sont comptées à part : elles portent la planète
// entière et ne se purgent jamais.
//
// **② Les trous, en PIXELS.** Sur une image donnée, on rend dans une cible
// hors écran le SEUL groupe du globe — tuiles et parois, tout le reste masqué —
// sur un fond magenta, puis on remplit depuis le bord de l'image. Le magenta
// qui SURVIT au remplissage est du fond enclavé : des pixels de ciel vus à
// travers le terrain. C'est la définition d'Adrien, sans interprétation.
//   ⚠️ La mesure ne dépend d'aucune couleur du terrain : le fond est posé par
//   la sonde, et le critère est la CONNEXITÉ au bord, pas une teinte.
//
// **③ Le temps jusqu'au crop entièrement net** : après l'arrêt du geste, le
// premier instant où tout point d'écran du crop est dessiné au zoom prescrit
// (`ZOOM_SOCLE`) et n'en redescend plus.
//
// EMPLOI
//   node scripts/sonde-cull.mjs --port 8137 --etiquette avant-z7 --cpu 4
//     --lieu majorque --depart 900000 --arrivee 20000 [--seuil 100000]
// `--seuil` pose `window.__seuilNaissanceM` AVANT le premier rendu (le shim de
// `seuil-socle.js` le lit) : c'est ainsi qu'on mesure « la part de ⑤ qui
// appartient à z7 » sans changer de branche.
// Sort `.banc/CULL/<etiquette>.json`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8137'))
const ETIQ = opt('--etiquette', 'releve')
const CPU = Number(opt('--cpu', '4'))
const DEPART_M = Number(opt('--depart', '900000'))
const ARRIVEE_M = Number(opt('--arrivee', '20000'))
const PERIODE = Number(opt('--periode', '40'))
const VISIBLE = opt('--visible', '0') !== '0'
const LIEU = opt('--lieu', 'majorque')
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'CULL'))
const IMAGES_REPOS = Number(opt('--repos', '20'))
// `--levier 0` débraye le plafond d'écran du crop (CULL ⑤) : c'est le « avant »,
// mesurable DANS LA MÊME SESSION que le « après ».
const LEVIER = opt('--levier', '1') !== '0'
// `--partiel 0` débraye le raffinement partiel de R37 : c'est l'expérience qui
// ATTRIBUE les trous, au lieu de les supposer.
const PARTIEL = opt('--partiel', '1') !== '0'
// `--jupe 0` débraye la jupe des tuiles (banc d'attribution, jamais un correctif)
const JUPE = opt('--jupe', '1') !== '0'
const LATERAL = opt('--lateral', '1') !== '0'
const DILAT = opt('--dilat', '1') !== '0'
const BANDE = opt('--bande', '1') !== '0'
// `--domaine 0` rejoue l'effacement latéral partout — le dépôt d'avant CULL ④.
const DOMAINE = opt('--domaine', '1') !== '0'
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// Les trois lieux du critère : une île méditerranéenne (le cas d'Adrien), une
// côte atlantique très découpée, un relief alpin.
const LIEUX = {
  majorque: [39.62, 2.98],
  bretagne: [48.38, -4.49],
  alpes: [45.92, 6.87],
}

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
// `dansCrop` est passé depuis le module du produit (voir `poserInstrument`).
function INSTRUMENTER(SRC_DANS_CROP) {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__cull) return 'déjà posé'
  const THREE = e.THREE || (e.scene && e.scene.constructor && window.__THREE) || null
  const g = e.globe
  const dansCrop = new Function('return (' + SRC_DANS_CROP + ')')()
  const P = { phase: 'attente', images: [], repos: [] }
  window.__cull = P
  const ROOT_Z = 2, MAX_Z = 15, SPLIT = 0.38, ZOOM_SOCLE = 13
  const PLANCHER = 1 * (100 / 6371000)
  const NX = 48, NY = 27
  const R2D = 180 / Math.PI

  // — les visites hors emprise, relevées DANS le parcours, au moment de la décision
  let profondeur = 0, msTraverse = 0, visitesHors = 0, visitesTotal = 0
  const travOrig = g._traverse.bind(g)
  g._traverse = function (t, a, b) {
    // le compteur est posé APRÈS le filtre de crop du produit, donc il compte
    // ce qui est réellement parcouru — c'est la grandeur d'Adrien
    if (profondeur === 0) {
      const d = performance.now(); profondeur++
      try { return travOrig(t, a, b) } finally { profondeur--; msTraverse += performance.now() - d }
    }
    profondeur++
    try { return travOrig(t, a, b) } finally { profondeur-- }
  }
  const champOrig = g._dansLeChamp.bind(g)
  g._dansLeChamp = function (t, camDir) {
    const r = champOrig(t, camDir)
    if (r) { visitesTotal++; if (g._crop && t.z > ROOT_Z && !dansCrop(t.z, t.x, t.y, g._crop)) visitesHors++ }
    return r
  }

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
  const appl = (m, x, y, z) => {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]
  }

  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    msTraverse = 0; visitesHors = 0; visitesTotal = 0
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a

    // ── ① l'emprise : une seule passe sur le cache ──
    let cache = 0, cacheHors = 0, mailleesHors = 0, dessineesHors = 0, dessinees = 0, maillees = 0, racines = 0
    let chargementHors = 0
    for (const t of g.tiles.values()) {
      cache++
      if (t.z <= ROOT_Z) { racines++; continue }
      const hors = g._crop ? !dansCrop(t.z, t.x, t.y, g._crop) : false
      if (t.mesh) maillees++
      if (t.mesh && t.mesh.visible) dessinees++
      if (!hors) continue
      cacheHors++
      if (t.state === 'loading') chargementHors++
      if (t.mesh) mailleesHors++
      if (t.mesh && t.mesh.visible) dessineesHors++
    }

    // ── ③ la netteté du crop : grille d'écran, points DANS l'emprise ──
    const p = camera.position
    const R = g.radius
    const inv = camera.projectionMatrixInverse
    const mw = camera.matrixWorld
    let planete = 0, trouGrille = 0, dansCropPts = 0, cropNets = 0
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const nx = ((i + 0.5) / NX) * 2 - 1, ny = 1 - ((j + 0.5) / NY) * 2
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
      const [xz, yz] = tuileXY(lat, lon, ZOOM_SOCLE)
      const dedans = g._crop ? dansCrop(ZOOM_SOCLE, xz, yz, g._crop) : false
      const t = dessineeSous(lat, lon)
      if (dedans) { dansCropPts++; if (t && t.z >= ZOOM_SOCLE) cropNets++ }
      if (!t) {
        const est = g.uniforms?.uEstompage?.value ?? 0
        const on = g.uniforms?.uEstompageOn?.value ?? 0
        if (!(on > 0.5 && est >= 1) || dedans) trouGrille++
      }
    }
    const cp = camera.position
    P.images.push({
      frame: g.frame, t: Math.round(performance.now()), phase: P.phase,
      alt: Math.round((cp.length() - R) * 63710),
      cache, racines, cacheHors, mailleesHors, dessineesHors, dessinees, maillees, chargementHors,
      visites: visitesTotal, visitesHors,
      planete, trouGrille, dansCropPts, cropNets,
      msTraverse: Math.round(msTraverse * 1000) / 1000, msUpdate: Math.round(msUpdate * 1000) / 1000,
      file: g.queue.length, vol: g.inFlight, credit: g._credit,
      crop: !!g._crop, cropSeul: !!g._cropSeul,
      zCropEcran: g._zCropEcran ?? null, cropDemi: g._crop?.demi ?? null,
      estompage: g.uniforms?.uEstompage?.value ?? null, estompageOn: g.uniforms?.uEstompageOn?.value ?? null,
    })
    if (P.images.length > 40000) P.images.splice(0, 8000)
    return out
  }

  // ── ② LES TROUS EN PIXELS ────────────────────────────────────────────────
  // Le seul groupe du globe, fond magenta, dans une cible hors écran ; le
  // magenta qui ne touche pas le bord de l'image est du fond ENCLAVÉ.
  P.trousPixels = (echelle, avecPng) => {
    const ren = e.renderer
    const cam = e.camGlobe || e.camera
    const G = g.group
    if (!G || !G.parent) return { erreur: 'groupe du globe détaché' }
    const permis = new Set()
    for (const t of g.tiles.values()) if (t.mesh) permis.add(t.mesh)
    if (g._parois) permis.add(g._parois)
    const memo = []
    for (const enf of G.children) if (!permis.has(enf)) { memo.push([enf, enf.visible]); enf.visible = false }
    const W = Math.max(64, Math.round(ren.domElement.width * (echelle || 1)))
    const H = Math.max(64, Math.round(ren.domElement.height * (echelle || 1)))
    // la cible est bâtie par le module three du produit (posé par la sonde)
    const TH = P._three
    if (!TH) { for (const [o, v] of memo) o.visible = v; return { erreur: 'three introuvable' } }
    if (!P.cible || P.cible.width !== W || P.cible.height !== H) {
      P.cible?.dispose?.()
      P.cible = new TH.WebGLRenderTarget(W, H)
    }
    // ⚠️ **ON NE REPARENTE PAS LE GROUPE DU GLOBE, ET C'EST UNE LEÇON PAYÉE** :
    // sorti de sa scène, il perd la transformation de son parent et le premier
    // relevé a rendu « 921 600 pixels de fond », c'est-à-dire une image vide
    // qu'on aurait lue comme « zéro trou ». On masque, on rend la scène du
    // produit, on restaure.
    const scene = e.sceneGlobe || e.scene
    for (const enf of scene.children) if (enf !== G) { memo.push([enf, enf.visible]); enf.visible = false }
    const fondAvant = scene.background
    scene.background = P.magenta ??= new TH.Color(1, 0, 1)
    const cibleAvant = ren.getRenderTarget()
    ren.setRenderTarget(P.cible)
    ren.render(scene, cam)
    const buf = new Uint8Array(W * H * 4)
    ren.readRenderTargetPixels(P.cible, 0, 0, W, H, buf)
    ren.setRenderTarget(cibleAvant)
    scene.background = fondAvant
    for (const [o, v] of memo) o.visible = v

    // fond = magenta pur (le shader ne produit jamais 255,0,255 exact ici)
    const estFond = new Uint8Array(W * H)
    let fond = 0
    for (let i = 0; i < W * H; i++) {
      const r = buf[i * 4], v = buf[i * 4 + 1], b = buf[i * 4 + 2]
      if (r > 240 && v < 24 && b > 240) { estFond[i] = 1; fond++ }
    }
    // remplissage depuis le bord
    const pile = []
    const vu = new Uint8Array(W * H)
    const pousser = (x, y) => { const k = y * W + x; if (!vu[k] && estFond[k]) { vu[k] = 1; pile.push(k) } }
    for (let x = 0; x < W; x++) { pousser(x, 0); pousser(x, H - 1) }
    for (let y = 0; y < H; y++) { pousser(0, y); pousser(W - 1, y) }
    let ouverts = 0
    while (pile.length) {
      const k = pile.pop(); ouverts++
      const x = k % W, y = (k / W) | 0
      if (x > 0) pousser(x - 1, y)
      if (x < W - 1) pousser(x + 1, y)
      if (y > 0) pousser(x, y - 1)
      if (y < H - 1) pousser(x, y + 1)
    }
    const enclaves = fond - ouverts
    // les composantes enclavées, pour dire s'il s'agit de fentes ou d'un trou
    let composantes = 0, plusGrande = 0
    const vu2 = new Uint8Array(W * H)
    for (let k = 0; k < W * H; k++) {
      if (!estFond[k] || vu[k] || vu2[k]) continue
      composantes++
      let n = 0
      const p2 = [k]; vu2[k] = 1
      while (p2.length) {
        const c = p2.pop(); n++
        const x = c % W, y = (c / W) | 0
        const v = (xx, yy) => { const kk = yy * W + xx; if (estFond[kk] && !vu[kk] && !vu2[kk]) { vu2[kk] = 1; p2.push(kk) } }
        if (x > 0) v(x - 1, y); if (x < W - 1) v(x + 1, y)
        if (y > 0) v(x, y - 1); if (y < H - 1) v(x, y + 1)
      }
      if (n > plusGrande) plusGrande = n
    }
    let png = null
    if (avecPng) {
      // l'image telle qu'elle a été jugée, trous marqués en vert vif
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H
      const ctx = cv.getContext('2d')
      const im = ctx.createImageData(W, H)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4
        const k = (H - 1 - y) * W + x
        const enclave = estFond[k] && !vu[k]
        im.data[d] = enclave ? 0 : buf[s]
        im.data[d + 1] = enclave ? 255 : buf[s + 1]
        im.data[d + 2] = enclave ? 0 : buf[s + 2]
        im.data[d + 3] = 255
      }
      ctx.putImageData(im, 0, 0)
      png = cv.toDataURL('image/png')
    }
    return { W, H, pixels: W * H, fond, enclaves, composantes, plusGrande, frame: g.frame, alt: Math.round((cam.position.length() - g.radius) * 63710), partiels: P.nPartiels?.() ?? null, png }
  }
  P.nPartiels = () => { let n = 0; for (const t of g.tiles.values()) if (t._partiel) n++; return n }
  return 'posé'
}

const quantile = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }

async function attendreCalme(page, maxMs = 40000) {
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
  const poserPhase = async (p) => { phase = p; await page.evaluate((p2) => { window.__cull.phase = p2 }, p) }
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 200)) })

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, lieu: LIEU, latlon: LIEUX[LIEU], departM: DEPART_M, arriveeM: ARRIVEE_M, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString() }
  const SEUIL = Number(opt('--seuil', '0'))
  if (SEUIL > 0) await page.evaluateOnNewDocument((v) => { globalThis.__SEUIL_NAISSANCE_M = v }, SEUIL)
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })

  // le module du produit, pas une recopie : `tuileDansCrop` et le three vivant
  journal.instrument = await page.evaluate(async () => {
    const m = await import('/src/monde/crop-sphere.js')
    window.__SRC_DANS_CROP = m.tuileDansCrop.toString()
    return 'module chargé'
  })
  const src = await page.evaluate(() => window.__SRC_DANS_CROP)
  journal.instrument = await page.evaluate(INSTRUMENTER, src)
  journal.levier = await page.evaluate((v) => {
    const g = window.__exp.globe
    if (!('cropZoomEcran' in g)) return 'absent'
    g.cropZoomEcran = v
    return g.cropZoomEcran
  }, LEVIER)
  journal.partiel = await page.evaluate((v) => {
    const g = window.__exp.globe
    g.raffinementPartiel = v
    return g.raffinementPartiel
  }, PARTIEL)
  journal.jupe = await page.evaluate((v, LAT_V, DIL_V, BAN_V, DOM_V) => {
    const g = window.__exp.globe
    g.jupeEcretee = v
    g.jupeLaterale = LAT_V
    g.jupeDilatation = DIL_V
    g.jupeBandeInterne = BAN_V
    g.jupeDomaine = DOM_V
    g._retaillerJupes?.()
    return g.jupeEcretee
  }, JUPE, LATERAL, DILAT, BANDE, DOMAINE)
  // three vivant : pris sur le constructeur d'un objet de la scène
  await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js')
    window.__cull._three = T
  })

  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  journal.machine = await page.evaluate(() => ({ palier: window.__palierMachine ?? null, pixelRatio: window.devicePixelRatio, ecran: [innerWidth, innerHeight] }))
  journal.seuil = await page.evaluate(async () => {
    const s = await import('/src/monde/seuil-socle.js')
    return { naissanceM: s.SEUIL_NAISSANCE_M, mortM: s.SEUIL_MORT_M }
  })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(1500)

  // ── le lieu ──
  const [lat, lon] = LIEUX[LIEU] || LIEUX.majorque
  await page.evaluate((a, b) => window.__exp.modes.flyTo(a, b, 10), lat, lon).catch(() => {})
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => { journal.busyApresVol = true })
  await dodo(2000)

  const altitude = () => page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? null)
  const cranBouton = async (sens) => {
    await page.evaluate((s) => window.__exp.modes.cranZoom(s), sens)
    let prec = await altitude(); const a = Date.now()
    while (Date.now() - a < 6000) { await dodo(100); const alt = await altitude(); if (alt !== null && prec !== null && Math.abs(alt - prec) < 1e-6 * Math.max(1, alt)) return alt; prec = alt }
    return prec
  }
  const cran = (sens) => page.evaluate((s) => { const el = window.__exp.renderer.domElement; el.dispatchEvent(new WheelEvent('wheel', { deltaY: s * -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })) }, sens)

  await poserPhase('pose')
  const serie = []
  for (let i = 0; i < 60; i++) {
    const alt = await altitude(); if (alt === null) break
    serie.push(Math.round(alt)); const ratio = DEPART_M / alt
    if (ratio > 1.45) await cranBouton(-1); else if (ratio < 0.7) await cranBouton(+1); else break
  }
  journal.poseSerie = serie
  await dodo(1500)
  journal.calmeDepart = await attendreCalme(page, 90000)
  await dodo(500)
  journal.etatDepart = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size, crop: !!window.__exp.globe._crop }))
  console.log(`[${ETIQ}] départ : ${JSON.stringify(journal.etatDepart)} · seuil ${JSON.stringify(journal.seuil)} · calme ${journal.calmeDepart.ms} ms`)

  // ── la descente ──
  await poserPhase('descente')
  const marques = { debut: await page.evaluate(() => Math.round(performance.now())) }
  const trousVol = []
  let derniereMesure = Date.now()
  for (let i = 0; i < 900; i++) {
    await cran(+1)
    await dodo(PERIODE)
    if (Date.now() - derniereMesure > 900) {
      derniereMesure = Date.now()
      const rv = await page.evaluate(() => window.__cull.trousPixels(1))
      // une IMAGE du défaut, pas seulement un compte : le premier relevé qui
      // dépasse le seuil est rejoué avec sa capture, trous marqués en vert
      if (!journal.pngVol && (rv.enclaves || 0) > 20) {
        const avec = await page.evaluate(() => window.__cull.trousPixels(1, true))
        if (avec.png) { fs.writeFileSync(path.join(SORTIE, `${ETIQ}-vol.png`), Buffer.from(avec.png.split(',')[1], 'base64')); journal.pngVol = { alt: avec.alt, enclaves: avec.enclaves, composantes: avec.composantes, plusGrande: avec.plusGrande, partiels: avec.partiels } }
      }
      trousVol.push(rv)
    }
    const alt = await altitude()
    if (alt !== null && alt < ARRIVEE_M) { marques.arretCran = i + 1; break }
  }
  journal.trousVol = trousVol
  marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
  journal.calmeFin = await attendreCalme(page, 120000)
  marques.calme = await page.evaluate(() => Math.round(performance.now()))

  // ── le repos : N images consécutives, trous en pixels ──
  await poserPhase('repos')
  await dodo(800)
  const trous = []
  for (let k = 0; k < IMAGES_REPOS; k++) {
    const r = await page.evaluate((png) => window.__cull.trousPixels(1, png), k === 0)
    if (r.png) { fs.writeFileSync(path.join(SORTIE, `${ETIQ}-repos.png`), Buffer.from(r.png.split(',')[1], 'base64')); delete r.png }
    trous.push(r)
    await dodo(60)
  }
  journal.trous = trous
  journal.etatFin = await page.evaluate(() => ({ mode: window.__exp.modes.mode, alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size, crop: !!window.__exp.globe._crop }))
  journal.marques = marques

  const P = await page.evaluate(() => JSON.parse(JSON.stringify({ images: window.__cull.images })))
  const desc = P.images.filter((i) => i.phase === 'descente')
  const repos = P.images.filter((i) => i.phase === 'repos')
  // la naissance du crop : première image de la descente où `crop` passe à vrai
  let iNaissance = desc.findIndex((i) => i.crop)
  const naissance = iNaissance >= 0 ? desc[iNaissance] : null
  const apres = iNaissance >= 0 ? desc.slice(iNaissance) : []
  const st = (xs) => ({ p50: quantile(xs, 0.5), p90: quantile(xs, 0.9), p99: quantile(xs, 0.99), max: Math.max(0, ...xs), moy: Math.round(xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length) * 100) / 100 })
  // netteté : après l'arrêt, dernier instant où le crop n'est pas entièrement net
  const apresArret = desc.filter((i) => i.t >= marques.arretGeste)
  let netA = null
  for (let k = apresArret.length - 1; k >= 0; k--) {
    const im = apresArret[k]
    if (im.dansCropPts > 0 && im.cropNets < im.dansCropPts) { netA = apresArret[Math.min(k + 1, apresArret.length - 1)].t - marques.arretGeste; break }
  }
  if (netA === null && apresArret.length) netA = 0
  const resume = {
    imagesDescente: desc.length, imagesApresNaissance: apres.length,
    seuil: journal.seuil,
    naissance: naissance ? { alt: naissance.alt, cache: naissance.cache, cacheHors: naissance.cacheHors, mailleesHors: naissance.mailleesHors } : null,
    cacheMax: Math.max(0, ...desc.map((i) => i.cache)),
    cacheMaxApresNaissance: Math.max(0, ...apres.map((i) => i.cache)),
    cacheHors: st(apres.map((i) => i.cacheHors)),
    mailleesHors: st(apres.map((i) => i.mailleesHors)),
    dessineesHors: st(apres.map((i) => i.dessineesHors)),
    visitesHors: st(apres.map((i) => i.visitesHors)),
    visites: st(apres.map((i) => i.visites)),
    chargementHors: st(apres.map((i) => i.chargementHors)),
    traverse: { p50: quantile(desc.map((i) => i.msTraverse), 0.5), p99: quantile(desc.map((i) => i.msTraverse), 0.99) },
    update: { p50: quantile(desc.map((i) => i.msUpdate), 0.5), p99: quantile(desc.map((i) => i.msUpdate), 0.99) },
    msImage: (() => { const dt = []; for (let k = 1; k < apres.length; k++) dt.push(apres[k].t - apres[k - 1].t); return st(dt) })(),
    nettetéCropMs: netA,
    calmeFinMs: journal.calmeFin.ms,
    reposCacheHors: repos.length ? st(repos.map((i) => i.cacheHors)) : null,
    reposMailleesHors: repos.length ? st(repos.map((i) => i.mailleesHors)) : null,
    reposCache: repos.length ? st(repos.map((i) => i.cache)) : null,
    trous: {
      images: trous.length,
      enclavesMax: Math.max(0, ...trous.map((t) => t.enclaves || 0)),
      enclavesMoy: Math.round(trous.reduce((s, t) => s + (t.enclaves || 0), 0) / Math.max(1, trous.length) * 10) / 10,
      composantesMax: Math.max(0, ...trous.map((t) => t.composantes || 0)),
      plusGrande: Math.max(0, ...trous.map((t) => t.plusGrande || 0)),
      erreurs: trous.filter((t) => t.erreur).length,
      premierErreur: trous.find((t) => t.erreur)?.erreur ?? null,
    },
    trousVol: journal.trousVol.length ? {
      images: journal.trousVol.length,
      enclavesMax: Math.max(0, ...journal.trousVol.map((t) => t.enclaves || 0)),
      enclavesMoy: Math.round(journal.trousVol.reduce((s, t) => s + (t.enclaves || 0), 0) / journal.trousVol.length * 10) / 10,
      composantesMax: Math.max(0, ...journal.trousVol.map((t) => t.composantes || 0)),
      plusGrande: Math.max(0, ...journal.trousVol.map((t) => t.plusGrande || 0)),
      partielsMax: Math.max(0, ...journal.trousVol.map((t) => t.partiels || 0)),
      erreur: journal.trousVol.find((t) => t.erreur)?.erreur ?? null,
    } : null,
    reseau: { descente: reseau.descente ?? null },
  }
  journal.resume = resume
  journal.brut = desc.concat(repos)
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log(`— ${ETIQ} (${LIEU}, CPU ×${CPU}) · ${desc.length} images, naissance à ${naissance?.alt ?? '?'} m —`)
  console.log(`cache à la naissance ${resume.naissance?.cache} (hors emprise ${resume.naissance?.cacheHors}, maillées ${resume.naissance?.mailleesHors}) · cache max ${resume.cacheMax}`)
  console.log(`hors emprise, après la naissance — cache p50 ${resume.cacheHors.p50} max ${resume.cacheHors.max} · maillées p50 ${resume.mailleesHors.p50} max ${resume.mailleesHors.max} · dessinées p50 ${resume.dessineesHors.p50} max ${resume.dessineesHors.max}`)
  console.log(`parcourues hors emprise p50 ${resume.visitesHors.p50} / ${resume.visites.p50} · ms/image p50 ${resume.msImage.p50} p99 ${resume.msImage.p99} · _traverse p50 ${resume.traverse.p50} p99 ${resume.traverse.p99}`)
  console.log(`crop net ${resume.nettetéCropMs} ms après l'arrêt · calme ${resume.calmeFinMs} ms · req ${resume.reseau.descente?.requetes}`)
  console.log(`TROUS repos (fond enclavé, ${resume.trous.images} images) : max ${resume.trous.enclavesMax} px · moy ${resume.trous.enclavesMoy} · composantes max ${resume.trous.composantesMax} · plus grande ${resume.trous.plusGrande} px${resume.trous.erreurs ? ' · ERREURS ' + resume.trous.premierErreur : ''}`)
  if (resume.trousVol) console.log(`TROUS en vol (${resume.trousVol.images} images) : max ${resume.trousVol.enclavesMax} px · moy ${resume.trousVol.enclavesMoy} · composantes max ${resume.trousVol.composantesMax} · plus grande ${resume.trousVol.plusGrande} · parents partiels max ${resume.trousVol.partielsMax}${resume.trousVol.erreur ? ' · ERREUR ' + resume.trousVol.erreur : ''}`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
