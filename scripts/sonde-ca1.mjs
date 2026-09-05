// CA1 — L'ATTAQUANT DU « CROP D'ABORD » (D27) : LE DÉZOOM, IMAGE PAR IMAGE.
//
// > Adrien, 2026-09-05 : « Voilà la vidéo d'un dézoom, honnêtement, c'est bourré
// > de bugs. On ne peut pas lancer le crop avant même d'afficher la terre ou la
// > mer ? Ça évite d'afficher des éléments qui sont hors crop. »
//
// Ce banc rejoue le geste de la vidéo (La Réunion, crop z13 CHAUD, dézoom à la
// molette cran par cran jusqu'à z10, puis re-zoom) et relève À CHAQUE IMAGE,
// dans un rAF posé APRÈS celui de l'application (donc sur l'état DESSINÉ) :
//   · l'emprise du crop (`_crop.demi`, `uCropDemi`), le repère des parois
//     (`_parois.userData.repere`), `provisoire`, la présence de la plaque ;
//   · `_cropSeul`, `porteRepos`, l'estompage POSÉ (`uEstompage`), `dehorsPermis`,
//     les refus de la veille, `_zCropServi`, le nombre de tuiles dessinées et
//     celles dessinées HORS de l'emprise (`tuileDansCrop`, la loi du produit) ;
//   · **les PIXELS dessinés hors de l'emprise** : le groupe du globe (tuiles +
//     parois, rien d'autre) est rendu dans une cible hors écran sur fond
//     magenta (la méthode de CULL — `readPixels` sur le compositeur rend 0, sur
//     SA cible non), et l'on compte les fragments non-magenta qui tombent hors
//     de l'enveloppe convexe de l'emprise projetée à l'écran (les huit sommets
//     du haut du crop + les huit de la boîte des parois, dilatés d'un pixel).
//     ⚠️ Témoin à 0 : au repos crop seul, `horsPx` DOIT valoir 0 ; le relevé le
//     dit avant chaque geste.
//   · un screencast CDP (passe 1) horodaté sur `performance.timeOrigin`, pour
//     retrouver les images de la vidéo (`r_014`, `r_020`) sur le banc.
//
//   node scripts/sonde-ca1.mjs --port 11311 --repete 8 [--pixels 0] [--cpu 4]
//        [--gap 1500] [--lieu -21.2482,55.7664] [--z 13] [--zbas 10] [--etiq nom]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '11311'))
const REPETE = Number(opt('--repete', '8'))
const LIEU = opt('--lieu', '-21.2482,55.7664')
const Z = Number(opt('--z', '13'))
const ZBAS = Number(opt('--zbas', '11')) // z11 : le palier de la vidéo (r_014 / r_020) ; z10 = la mort du crop dans cet arbre
// ⚠️ **UN CRAN ISOLÉ NE FRANCHIT PAS DE PALIER** (mesuré : +0,017 de `_levelZoom` par
// cran pour un niveau à ln 2 = 0,693 — quarante crans isolés pour un niveau). Le
// geste d'Adrien est un DÉFILEMENT : plusieurs crans en moins d'une seconde, ce
// qui confirme la sortie (`sortie-molette.js`, 3 crans < 1 s) et lance la poussée
// qui franchit les paliers. Trois crans à 60 ms : z13 → z12 → z11, crop vivant
// (l'état de `r_014` / `r_020`) ; trois de plus : z10 et la mort du crop.
const RAFALE = Number(opt('--rafale', '3'))
const ESPACE = Number(opt('--espace', '60'))
const GAP = Number(opt('--gap', '4000')) // ms entre deux gestes
const PIXELS = opt('--pixels', '1') !== '0'
const ECHELLE = Number(opt('--echelle', '0.25')) // la cible hors écran, en fraction de l'écran
const CPU = Number(opt('--cpu', '1'))
const LATENCE = Number(opt('--latence', '0'))
const ETIQ = opt('--etiq', `dezoom${PIXELS ? '' : '-nu'}${CPU > 1 ? `-x${CPU}` : ''}`)
const SCREENCAST = opt('--screencast', '1') !== '0'
const ICI = path.join(RACINE, '.banc', 'CA1')
fs.mkdirSync(ICI, { recursive: true })

const W = 1280, H = 800, CX = W / 2, CY = H / 2
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
if (LATENCE > 0) {
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCE, downloadThroughput: -1, uploadThroughput: -1 })
}

// le réseau, compté au protocole (requêtes de tuiles)
let requetes = 0
await cdp.send('Network.enable').catch(() => {})
cdp.on('Network.requestWillBeSent', (ev) => { if (/\/(dem|bathy|tiles?|relief)\//i.test(ev.request?.url || '') || /\.(png|webp|bin|pmtiles)(\?|$)/i.test(ev.request?.url || '')) requetes++ })

async function voile() {
  for (let k = 0; k < 12; k++) {
    const s = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY]).catch(() => null)
    if (s === 'CANVAS') return
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
  }
  throw new Error('voile non ferme')
}
async function immobile() {
  await page.waitForFunction(() => {
    const e = window.__exp
    if (!e?.camera || !e?.controls || !e?.modes) return false
    const d = e.camera.position.distanceTo(e.controls.target)
    const R = (window.__stab ??= { d: NaN, t: 0 })
    if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
    return !e.modes.busy && !e.modes.travel && performance.now() - R.t > 1500
  }, { timeout: 120000, polling: 100 })
}
async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 180000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await immobile()
  await voile()
}
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const cran = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: d, pointerType: 'mouse' })

// ══════════ LA SONDE DANS LA PAGE ═══════════════════════════════════════════
async function installer() {
  await page.evaluate(async ([pixels, echelle]) => {
    const e = window.__exp
    const TH = e.THREE || (await import('/node_modules/three/build/three.module.js'))
    const S = (window.__ca1 = { on: false, rec: [], TH, pixels, echelle, cible: null, magenta: new TH.Color(1, 0, 1), tPrev: 0, origine: performance.timeOrigin })
    const R = 100
    // ⚠️ **TROIS ESPACES** : le globe (R_GLOBE = 100, sphère nue, x = cos la sin lo,
    // y = sin la, z = cos la cos lo — la convention de `latLonToSphere`, reprise
    // par sonde-mix), le bloc (TERRAIN_SIZE = 56), la caméra d'effets. Ici tout
    // se projette dans l'espace du GLOBE avec `camGlobe`, celle qui le dessine.
    const sphere = (lat, lon, r) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return new TH.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)) }
    const latLonDeMerc = (mx, my) => ({ lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180 / Math.PI, lon: (mx - Math.floor(mx)) * 360 - 180 })
    const tuileDansCrop = (z, x, y, rep) => {
      const n = 2 ** z, y0 = y / n, y1 = (y + 1) / n
      if (y1 <= rep.cy - rep.demi || y0 >= rep.cy + rep.demi) return false
      let dx = (x + 0.5) / n - rep.cx; dx -= Math.round(dx)
      return Math.abs(dx) < rep.demi + 0.5 / n
    }
    const enveloppe = (pts) => { // enveloppe convexe (chaîne monotone)
      const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
      if (P.length < 3) return P
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
      const bas = []; for (const p of P) { while (bas.length >= 2 && cr(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop(); bas.push(p) }
      const haut = []; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (haut.length >= 2 && cr(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop(); haut.push(p) }
      bas.pop(); haut.pop(); return bas.concat(haut)
    }
    const dedansPoly = (poly, x, y) => {
      let d = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j]
        if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d
      }
      return d
    }
    // les sommets de l'emprise à l'écran (pixels de la cible hors écran)
    S.enveloppeCrop = (rep, Wc, Hc) => {
      const g = e.globe, cam = e.camGlobe || e.camera
      const exag = g.exaggeration || 1
      const rHaut = R * (1 + (4000 * exag) / 6371000) // 4 000 m de relief, exagérés : le Piton des Neiges est couvert
      const pts = []
      const proj = (v) => { const p = v.clone().project(cam); pts.push([(p.x + 1) / 2 * Wc, (1 - p.y) / 2 * Hc]) }
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const { lat, lon } = latLonDeMerc(rep.cx + u * rep.demi, rep.cy + w * rep.demi)
        proj(sphere(lat, lon, rHaut))
      }
      const par = g._parois
      if (par?.geometry) {
        par.geometry.computeBoundingBox?.()
        const bb = par.geometry.boundingBox
        if (bb) { par.updateMatrixWorld?.(true); for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) proj(new TH.Vector3(x, y, z).applyMatrix4(par.matrixWorld)) }
      }
      // dilatation d'un pixel et demi autour du centre de l'enveloppe
      const env = enveloppe(pts)
      const cx = env.reduce((s, p) => s + p[0], 0) / env.length, cy = env.reduce((s, p) => s + p[1], 0) / env.length
      return env.map(([x, y]) => { const dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy) || 1; return [x + dx / n * 1.5, y + dy / n * 1.5] })
    }
    // ⚠️ **LA MÉTHODE DE CULL** : le seul groupe du globe, sur fond magenta, dans
    // une cible hors écran ; on ne reparente rien, on masque et on restaure.
    S.pixels = () => {
      const g = e.globe, ren = e.renderer, cam = e.camGlobe || e.camera
      const G = g?.group
      if (!G || !G.parent || !g._crop) return null
      const Wc = Math.max(64, Math.round(ren.domElement.width * S.echelle)), Hc = Math.max(64, Math.round(ren.domElement.height * S.echelle))
      if (!S.cible || S.cible.width !== Wc || S.cible.height !== Hc) { S.cible?.dispose?.(); S.cible = new TH.WebGLRenderTarget(Wc, Hc) }
      const permis = new Set()
      for (const t of g.tiles.values()) if (t.mesh) permis.add(t.mesh)
      if (g._parois) permis.add(g._parois)
      const memo = []
      for (const enf of G.children) if (!permis.has(enf)) { memo.push([enf, enf.visible]); enf.visible = false }
      const scene = e.sceneGlobe || e.scene
      for (const enf of scene.children) if (enf !== G) { memo.push([enf, enf.visible]); enf.visible = false }
      const fondAvant = scene.background
      scene.background = S.magenta
      const cibleAvant = ren.getRenderTarget()
      ren.setRenderTarget(S.cible)
      ren.render(scene, cam)
      const buf = (S.buf && S.buf.length === Wc * Hc * 4) ? S.buf : (S.buf = new Uint8Array(Wc * Hc * 4))
      ren.readRenderTargetPixels(S.cible, 0, 0, Wc, Hc, buf)
      ren.setRenderTarget(cibleAvant)
      scene.background = fondAvant
      for (const [o, v] of memo) o.visible = v
      const poly = S.enveloppeCrop(g._crop, Wc, Hc)
      let dessin = 0, hors = 0, dedans = 0
      for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) {
        const i = (y * Wc + x) * 4
        const r = buf[i], v = buf[i + 1], b = buf[i + 2]
        if (r > 240 && v < 24 && b > 240) continue // fond
        dessin++
        // ⚠️ readRenderTargetPixels rend l'image la tête en bas (origine en bas à gauche)
        if (dedansPoly(poly, x + 0.5, Hc - 1 - y + 0.5)) dedans++; else hors++
      }
      return { dessin, hors, dedans, Wc, Hc, poly: poly.map(([x, y]) => [Math.round(x), Math.round(y)]) }
    }
    const lire = () => {
      const g = e.globe, est = e.veilleEstompage, vc = e.veilleCrop, u = g?.uniforms
      const rep = g?._crop
      let dessinees = 0, dessineesHors = 0, zMin = 99, zMax = 0
      if (g?.tiles) for (const t of g.tiles.values()) {
        if (!t.mesh?.visible) continue
        dessinees++
        if (rep && !tuileDansCrop(t.z, t.x, t.y, rep)) dessineesHors++
        else if (rep) { if (t.z < zMin) zMin = t.z; if (t.z > zMax) zMax = t.z }
      }
      const par = g?._parois
      const fe = e.terrain?.fenetreBornee?.emprise
      let largeDeg = null
      if (fe) { largeDeg = fe.est - fe.ouest; if (largeDeg <= 0) largeDeg += 360 }
      const t = performance.now()
      const row = {
        t: Math.round(t), dt: +(t - S.tPrev).toFixed(1), frame: g?.frame ?? null,
        alt: Math.round(e.altitudeCadrageM?.() ?? -1), d: +e.camera.position.distanceTo(e.controls.target).toFixed(3), mode: e.modes?.mode ?? null,
        busy: !!e.modes?.busy, annonce: e.modes?.msgEl && !e.modes.msgEl.classList.contains('hidden') ? e.modes.msgEl.textContent : '',
        demZoom: e.params?.demZoom ?? null, largeDeg: largeDeg == null ? null : +largeDeg.toFixed(6),
        pose: !!vc?.pose, crop: !!rep, cropDemi: rep ? +rep.demi.toFixed(8) : null, cropZoom: rep?.zoom ?? null, cropCx: rep ? +rep.cx.toFixed(8) : null, cropCy: rep ? +rep.cy.toFixed(8) : null,
        uCropDemi: u ? +u.uCropDemi.value.toFixed(8) : null, uCropOn: u?.uCropOn?.value ?? null,
        parois: !!par, paroisDemi: par?.userData?.repere ? +par.userData.repere.demi.toFixed(8) : null, provisoire: !!par?.userData?.provisoire,
        cropSeul: !!g?._cropSeul, porteRepos: +(est?.porteRepos ?? -1).toFixed(3), estompagePose: +(est?.valeur ?? -1).toFixed(3),
        uEstompage: u ? +u.uEstompage.value.toFixed(3) : null, uEstompageOn: u?.uEstompageOn?.value ?? null,
        dehorsPermis: !!vc?.dehorsPermis, armee: !!vc?.sortieArmee, auRepos: !!e.veilleRepos?.auRepos, refus: (vc?.refus || []).join('+'),
        zServi: g?._zCropServi ?? null, zCible: g?._zCropCible ?? null, zEcran: g?._zCropEcran ?? null,
        dessinees, dessineesHors, zMin: zMin === 99 ? null : zMin, zMax: zMax || null,
        cache: g?.tiles?.size ?? null, file: g?.queue?.length ?? null, vol: g?.inFlight ?? null,
        level: +(e.modes?._levelZoom ?? 0).toFixed(4), vel: +(e.modes?._zoomVel ?? 0).toFixed(4), poussee: !!e.modes?._sortieCourse, voile: !document.getElementById('loading')?.classList.contains('hidden'),
      }
      S.tPrev = t
      if (S.pixels && S.pixelsOn) {
        const t1 = performance.now()
        const p = S.pixels()
        if (p) { row.horsPx = p.hors; row.dessinPx = p.dessin; row.dedansPx = p.dedans; row.msPixels = +(performance.now() - t1).toFixed(1); S.dernierPoly = p.poly; S.cibleWH = [p.Wc, p.Hc] }
      }
      return row
    }
    S.pixelsOn = pixels
    S.lire = lire
    const boucle = () => { if (!S.on) return; try { S.rec.push(lire()) } catch (er) { S.rec.push({ erreur: String(er) }) } requestAnimationFrame(boucle) }
    S.demarrer = () => { S.rec = []; S.on = true; S.tPrev = performance.now(); requestAnimationFrame(boucle) }
    S.arreter = () => { S.on = false; return S.rec }
  }, [PIXELS, ECHELLE])
}
const lire = () => page.evaluate(() => window.__ca1.lire())
const marquer = (nom) => page.evaluate((n) => { const S = window.__ca1; S.rec.push({ marque: n, t: Math.round(performance.now()) }) }, nom)

// ══════════ L'ENTRÉE, COMME ADRIEN : LE CROP z13 CHAUD, VU DE TROIS QUARTS ══
async function dansLeCropChaud() {
  const [lat, lon] = LIEU.split(',').map(Number)
  await page.evaluate(([la, lo, z]) => window.__exp.modes.flyTo(la, lo, z), [lat, lon, Z])
  await dodo(3000)
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 })
  await immobile()
  await page.waitForFunction('!!(window.__exp.globe && window.__exp.globe._crop)', { timeout: 30000, polling: 50 })
  // la pose de la vidéo (SOC) : le bloc entier dans le cadre, 1,1 × largeur, 35°, cap 15°
  await page.evaluate(async ([elevDeg, azDeg, latLieu]) => {
    const e = window.__exp, cam = e.camera, ct = e.controls, g = e.globe
    const cropM = 2 * g._crop.demi * 2 * Math.PI * 6371000 * Math.cos(latLieu * Math.PI / 180)
    const a = cropM * 1.1
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const v = e.altitudeCadrageM(); if (!Number.isFinite(v) || v <= 0) break
      const d = cam.position.distanceTo(ct.target), nd = d * (a / v)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
    const d = cam.position.distanceTo(ct.target), p = elevDeg * Math.PI / 180, az = azDeg * Math.PI / 180
    cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(az), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(az))
    cam.lookAt(ct.target); ct.update?.()
  }, [35, 15, lat])
  // ⚠️ **CHAUFFER JUSQU'À LA NETTETÉ — le piège du cache froid.** On attend que
  // la file et le vol soient vides, que la veille n'ait plus de refus, et que
  // le crop soit seul (repos) pendant 60 images d'affilée.
  const t0 = Date.now()
  let s = null
  while (Date.now() - t0 < 90000) {
    await wait(10)
    s = await lire()
    if (s.pose && s.cropSeul && s.file === 0 && s.vol === 0 && !s.refus && !s.busy && s.zServi >= Z) {
      await wait(60); const s2 = await lire()
      if (s2.cropSeul && s2.file === 0 && s2.vol === 0 && !s2.refus) return s2
    }
  }
  return s
}

// ══════════ LE SCREENCAST (passe 1) ═════════════════════════════════════════
let cast = null
async function castOn(dossier) {
  fs.mkdirSync(dossier, { recursive: true })
  cast = { dossier, n: 0, index: [] }
  cdp.on('Page.screencastFrame', async (ev) => {
    if (!cast) return
    const k = cast.n++
    const nom = `f_${String(k).padStart(4, '0')}.jpg`
    fs.writeFileSync(path.join(cast.dossier, nom), Buffer.from(ev.data, 'base64'))
    cast.index.push({ k, nom, tEpochMs: ev.metadata.timestamp * 1000 })
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
}
async function castOff() {
  if (!cast) return null
  await cdp.send('Page.stopScreencast').catch(() => {})
  await dodo(300)
  const c = cast; cast = null
  fs.writeFileSync(path.join(c.dossier, 'index.json'), JSON.stringify(c.index))
  return c
}

// ══════════ LE BILAN D'UNE PASSE ════════════════════════════════════════════
function bilan(rec) {
  const imgs = rec.filter((r) => r.frame != null)
  const marques = rec.filter((r) => r.marque)
  const horsPxMax = Math.max(0, ...imgs.map((r) => r.horsPx ?? 0))
  const horsPxImages = imgs.filter((r) => (r.horsPx ?? 0) > 0).length
  const dessineesHorsImages = imgs.filter((r) => r.dessineesHors > 0).length
  const estompeImages = imgs.filter((r) => r.pose && r.uEstompage < 0.999).length
  const mixte = imgs.filter((r) => r.pose && r.uEstompage < 0.999 && (!r.parois || r.provisoire || r.paroisDemi !== r.cropDemi)).length
  const sansParois = imgs.filter((r) => r.pose && !r.parois).length
  const paroisDecalees = imgs.filter((r) => r.pose && r.parois && r.paroisDemi !== r.cropDemi).length
  const provisoires = imgs.filter((r) => r.pose && r.provisoire).length
  const cropMort = imgs.filter((r) => !r.pose).length
  // les paliers : chaque image où cropDemi change
  const paliers = []
  for (let i = 1; i < imgs.length; i++) if (imgs[i].cropDemi !== imgs[i - 1].cropDemi) paliers.push({ i, t: imgs[i].t, de: imgs[i - 1].cropDemi, a: imgs[i].cropDemi, demZoom: imgs[i].demZoom })
  const premierHors = imgs.find((r) => (r.horsPx ?? 0) > 0) || null
  const premierDessinHors = imgs.find((r) => r.dessineesHors > 0) || null
  const dt = imgs.map((r) => r.dt).filter((x) => x > 0).sort((a, b) => a - b)
  const p = (q) => dt.length ? dt[Math.min(dt.length - 1, Math.floor(q * dt.length))] : null
  return { images: imgs.length, marques: marques.length, horsPxMax, horsPxImages, dessineesHorsImages, estompeImages, mixte, sansParois, paroisDecalees, provisoires, cropMort, paliers, premierHors: premierHors && { t: premierHors.t, i: imgs.indexOf(premierHors), horsPx: premierHors.horsPx, uEstompage: premierHors.uEstompage, cropDemi: premierHors.cropDemi }, premierDessinHors: premierDessinHors && { t: premierDessinHors.t, i: imgs.indexOf(premierDessinHors), n: premierDessinHors.dessineesHors }, dtP50: p(0.5), dtP99: p(0.99) }
}

const R = { etiq: ETIQ, port: PORT, lieu: LIEU, z: Z, zbas: ZBAS, gap: GAP, rafale: RAFALE, espace: ESPACE, pixels: PIXELS, cpu: CPU, latence: LATENCE, quand: new Date().toISOString(), passes: [] }

for (let p = 0; p < REPETE; p++) {
  requetes = 0
  await neuf()
  await installer()
  const depart = await dansLeCropChaud()
  if (!depart?.pose) { R.passes.push({ erreur: 'pas dans le crop', depart }); etape(`⛔ passe ${p + 1} : crop absent (alt ${depart?.alt} m)`); continue }
  // témoin : 20 images au repos, crop seul — horsPx doit valoir 0
  await page.evaluate(() => window.__ca1.demarrer())
  await wait(20)
  const temoin = await page.evaluate(() => window.__ca1.arreter())
  const temoinHors = Math.max(0, ...temoin.map((r) => r.horsPx ?? 0))
  const temoinDessin = Math.min(...temoin.map((r) => r.dessinPx ?? 0))
  const origine = await page.evaluate(() => performance.timeOrigin)
  const requetesChauffe = requetes; requetes = 0
  if (SCREENCAST && p === 0) await castOn(path.join(ICI, `${ETIQ}-cast`))
  await page.evaluate(() => window.__ca1.demarrer())
  const tDebut = await page.evaluate(() => Math.round(performance.now()))
  // ── le dézoom, geste par geste (une rafale de RAFALE crans), jusqu'à z bas ──
  const rafale = async (sens) => { for (let k = 0; k < RAFALE; k++) { await cran(120 * sens); if (k < RAFALE - 1) await dodo(ESPACE) } }
  const crans = []
  const busyBloque = []
  const attendreLibre = async (etiq) => {
    const t0 = Date.now()
    while (Date.now() - t0 < 20000) { const x = await lire(); if (!x.busy) return x; await dodo(200) }
    const x = await lire(); busyBloque.push({ etiq, t: x.t, demZoom: x.demZoom, annonce: x.annonce }); return x
  }
  let s = depart
  for (let i = 1; i <= 12; i++) {
    await marquer(`cran-dezoom-${i}`)
    await rafale(1)
    await dodo(GAP)
    s = await attendreLibre(`dezoom-${i}`)
    crans.push({ i, t: s.t, demZoom: s.demZoom, cropDemi: s.cropDemi, pose: s.pose, alt: s.alt, level: s.level })
    if (!s.pose || s.demZoom <= ZBAS) break
  }
  const bas = s
  await marquer('repos-bas')
  // le temps jusqu'au palier NET : file et vol vides, plus aucun refus, parois définitives
  {
    const t0 = Date.now()
    while (Date.now() - t0 < 25000) { const x = await lire(); if (x.file === 0 && x.vol === 0 && !x.refus && !x.busy && x.parois && !x.provisoire) break; await dodo(200) }
  }
  await dodo(1000); await wait(40)
  const reposBas = await lire()
  // ── le re-zoom, cran par cran, jusqu'au z de départ ──
  const crans2 = []
  for (let i = 1; i <= 16; i++) {
    await marquer(`cran-zoom-${i}`)
    await rafale(-1)
    await dodo(GAP)
    s = await attendreLibre(`zoom-${i}`)
    crans2.push({ i, t: s.t, demZoom: s.demZoom, cropDemi: s.cropDemi, pose: s.pose, alt: s.alt, level: s.level })
    if (s.demZoom >= Z) break
  }
  await marquer('repos-haut')
  await dodo(3000); await wait(40)
  const fin = await lire()
  const rec = await page.evaluate(() => window.__ca1.arreter())
  const c = await castOff()
  const poly = await page.evaluate(() => ({ poly: window.__ca1.dernierPoly, wh: window.__ca1.cibleWH }))
  const b = bilan(rec)
  // le temps jusqu'au nouveau palier net, à chaque cran de dézoom : de la marque
  // au premier `zServi >= zCible` avec file et vol vides ET refus vides
  const imgs = rec.filter((r) => r.frame != null)
  const netApresCran = []
  for (const m of rec.filter((r) => r.marque && r.marque.startsWith('cran-'))) {
    const suiv = imgs.filter((r) => r.t >= m.t)
    const net = suiv.find((r) => r.file === 0 && r.vol === 0 && !r.refus && !r.busy && r.parois && !r.provisoire && r.paroisDemi === r.cropDemi)
    netApresCran.push({ marque: m.marque, t: m.t, netMs: net ? net.t - m.t : null })
  }
  R.passes.push({ depart, busyBloque, temoin: { images: temoin.length, horsPxMax: temoinHors, dessinPxMin: temoinDessin }, origine, tDebut, requetesChauffe, requetes, crans, bas, reposBas, crans2, fin, bilan: b, netApresCran, cast: c && { dossier: c.dossier, images: c.index.length }, poly, courbe: rec })
  etape(`passe ${p + 1}/${REPETE} : témoin horsPx ${temoinHors} (dessin ≥ ${temoinDessin}) · dézoom ${crans.length} crans z${depart.demZoom}→z${bas.demZoom} (crop ${bas.pose ? 'vit' : 'MORT'}) · re-zoom ${crans2.length} crans →z${fin.demZoom} · images ${b.images} · horsPx max ${b.horsPxMax} sur ${b.horsPxImages} images · dessinéesHors ${b.dessineesHorsImages} img · estompé ${b.estompeImages} img · MIXTE ${b.mixte} img · sans parois ${b.sansParois} · parois décalées ${b.paroisDecalees} · provisoires ${b.provisoires} · paliers ${b.paliers.length} · dt p50 ${b.dtP50} p99 ${b.dtP99} · requêtes ${requetes}${busyBloque.length ? ` · ⛔ BUSY BLOQUÉ ${JSON.stringify(busyBloque)}` : ''}`)
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(R))
}

fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(R))
console.log(`\n=== ${path.join(ICI, `${ETIQ}.json`)}`)
await nav.close()
