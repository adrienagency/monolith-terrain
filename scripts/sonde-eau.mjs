// SONDE EAU — LA MER RESSEMBLE-T-ELLE À UNE MER ? Captures A/B, Fresnel mesuré,
// coût GPU, tuilage — Tâche EAU (2026-09-05).
//
// ⚡ **L'A/B EST DANS LA MÊME IMAGE** : `uMerVraieEau` vaut 0 (l'image d'avant,
// au bit près) ou 1 (la loi de cette tâche), et les deux rendus sont pris dans
// la MÊME tâche que `composer.render` (`toDataURL` juste après — rapport MER
// §7.2 : une capture prise après coup lit un tampon recomposé par la boucle).
//
// ⛔ Pas de lien profond (`#s=`, la mer y est cuite VIDE), pas de `gotoCtl.go`
// (zoom 32× trop serré) : `modes.flyTo(lat, lon, 11)`, la pose de la vidéo
// d'Adrien (rapport DENT §③).
//
// EMPLOI :
//   npx vite --host 127.0.0.1 --port 9877
//   node scripts/sonde-eau.mjs --port 9877 --etiquette EAU
//
// Sortie : `.banc/EAU/<etiquette>.json`, captures dans `.banc/EAU/pour-adrien/`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'EAU')
const POUR_ADRIEN = path.join(ICI, 'pour-adrien')
fs.mkdirSync(POUR_ADRIEN, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9877'))
const ETIQ = opt('--etiquette', 'EAU')
const ZOOM = Number(opt('--zoom', '11'))
const HEURES = opt('--heures', '15.5').split(',').map(Number)
const IMAGES = Number(opt('--images', '20'))
const COUT = opt('--cout', '1') !== '0'
// ⚠️ 1600×1000 : la résolution du critère du brief (coût ≤ +1,0 ms « à 1600×1000 »)
const W = Number(opt('--w', '1600')), H = Number(opt('--h', '1000'))
const CX = W / 2, CY = H / 2

// trois lieux, trois cadrages — le brief, mot pour mot
// ⚠️ **LA CIBLE EST SUR L'EAU, PAS SUR LA TERRE** : au ras (12°) la caméra
// regarde la cible, et une cible posée sur un sommet de Moorea rend un cadre
// gris (relief devant l'objectif) — première campagne, `.banc/EAU/EAU-1.json`.
// Lagon de Moorea (nord), baie de Saint-Malo, large de Rodrigues (nord-ouest).
const LIEUX = JSON.parse(opt('--lieux', JSON.stringify([
  { nom: 'Moorea', lat: -17.47, lon: -149.85 },
  { nom: 'Bretagne', lat: 48.70, lon: -2.00 },
  { nom: 'Rodrigues', lat: -19.62, lon: 63.30 },
])))
const CADRAGES = JSON.parse(opt('--cadrages', JSON.stringify([
  { nom: 'ras', elev: 12, azim: 45 },
  { nom: '45', elev: 45, azim: 45 },
  { nom: 'nadir', elev: 88, azim: 45 },
])))

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: [`--window-size=${W},${H + 120}`, '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
  defaultViewport: { width: W, height: H },
})
let page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(200)
    const sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY])
    if (sous === 'CANVAS') break
  }
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(2500)
}

const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

async function aller(lat, lon, zoom) {
  await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [lat, lon, zoom])
  await dodo(6000)
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 120000, polling: 300 }).catch(() => {})
  await dodo(3000)
}

async function incliner(elevDeg, azDeg) {
  await page.evaluate(([el, az]) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    const d = cam.position.distanceTo(ct.target)
    const p = (el * Math.PI) / 180, a = (az * Math.PI) / 180
    cam.position.set(
      ct.target.x + d * Math.cos(p) * Math.sin(a),
      ct.target.y + d * Math.sin(p),
      ct.target.z + d * Math.cos(p) * Math.cos(a)
    )
    cam.lookAt(ct.target)
    ct.update?.()
  }, [elevDeg, azDeg])
  await wait(6)
  await dodo(1500)
}

async function stabiliser(essais = 40) {
  const signature = () => page.evaluate(() => {
    const g = window.__exp.globe
    return JSON.stringify({ mer: !!g._mer, compte: g._merEtat?.compte ?? null, tuiles: g.tiles?.size ?? null, busy: !!window.__exp.modes.busy })
  })
  let prec = null, stables = 0
  for (let i = 0; i < essais; i++) {
    const s = await signature().catch(() => null)
    if (s === null) { await dodo(1500); stables = 0; continue }
    if (s === prec) { if (++stables >= 2) return true } else { stables = 0 }
    prec = s
    await dodo(700)
  }
  return false
}

// ══════════ LA MESURE, ENTIÈREMENT DANS LA PAGE ═══════════════════════════════
const MESURE = `((nImages, avecCout, prefixe) => {
  const e = window.__exp, g = e.globe, mer = g._mer
  if (!mer) return { mer: false }
  const gl = e.renderer.getContext()
  const mu = mer.material.uniforms
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  // ⚠️ LE GRAIN ET LE TEMPS DES PASSES SONT GELES : sans cela deux rendus
  // identiques different sur 93 % des pixels (le grain change de phase a
  // chaque image) et le masque de la nappe vaut l ecran entier. C est le
  // geste de sonde-mer-crop.mjs (--pixelab).
  const rendre = () => {
    if (e.composer) {
      for (const p of e.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0
      e.composer.render(0)
    } else e.renderer.render(e.scene, e.camera)
  }
  const lire = () => {
    const buf = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    return buf
  }
  const capture = () => e.renderer.domElement.toDataURL('image/png')
  const t0 = mu.uMerTemps.value
  const vraie0 = mu.uMerVraieEau.value
  const sky0 = mu.uSky.value.clone()

  // ─── ① le MASQUE de la nappe, par A/B mer.visible (compte par différence) ───
  mer.visible = true; mu.uMerVraieEau.value = 1; rendre(); const A = lire()
  mer.visible = false; rendre(); const B = lire()
  mer.visible = true
  const masque = new Uint8Array(w * h)
  let nMer = 0
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(A[i*4] - B[i*4]) + Math.abs(A[i*4+1] - B[i*4+1]) + Math.abs(A[i*4+2] - B[i*4+2])
    if (d > 24) { masque[i] = 1; nMer++ }
  }
  if (nMer < 2000) { mu.uMerVraieEau.value = vraie0; return { mer: true, refus: 'AUCUNE MER A L ECRAN — poste non probant', nMer } }
  const moyenneSur = (buf) => {
    let r = 0, gg = 0, b = 0
    for (let i = 0; i < w * h; i++) if (masque[i]) { r += buf[i*4]; gg += buf[i*4+1]; b += buf[i*4+2] }
    return [r / nMer, gg / nMer, b / nMer]
  }

  // ─── ② les CAPTURES avant / après, même phase de houle ───────────────────────
  mu.uMerVraieEau.value = 0; rendre(); const pngAvant = capture(); const moyAvant = moyenneSur(lire())
  mu.uMerVraieEau.value = 1; rendre(); const pngApres = capture(); const moyApres = moyenneSur(lire())
  let diffAB = 0
  { mu.uMerVraieEau.value = 0; rendre(); const a = lire(); mu.uMerVraieEau.value = 1; rendre(); const b = lire()
    for (let i = 0; i < w * h; i++) if (masque[i]) diffAB += Math.abs(a[i*4] - b[i*4]) + Math.abs(a[i*4+1] - b[i*4+1]) + Math.abs(a[i*4+2] - b[i*4+2])
    diffAB /= nMer }

  // ─── ③ le FRESNEL MESURÉ : delta ciel blanc − ciel noir sur la nappe ─────────
  // Ce que le ciel reflechi ajoute au pixel vaut F * (ciel) : on pose uSky a 1
  // puis a 0 et la difference moyenne sur la nappe est la reflectance PEINTE.
  const fresnelPeint = (vraie) => {
    mu.uMerVraieEau.value = vraie
    mu.uSky.value.setRGB(1, 1, 1); rendre(); const bl = moyenneSur(lire())
    mu.uSky.value.setRGB(0, 0, 0); rendre(); const no = moyenneSur(lire())
    mu.uSky.value.copy(sky0)
    return ((bl[0] - no[0]) + (bl[1] - no[1]) + (bl[2] - no[2])) / 3 / 255
  }
  const fresnelApres = fresnelPeint(1), fresnelAvant = fresnelPeint(0)
  mu.uMerVraieEau.value = 1

  // ─── ③bis la COUVERTURE D ECUME : part de la nappe quasi blanche ─────────────
  // Monahan & O Muircheartaigh (1980) : W = 3,84e-6 * U^3,41 (1 % a 10 m/s).
  const couverture = (vraie) => {
    mu.uMerVraieEau.value = vraie; rendre(); const b = lire()
    let n = 0
    for (let i = 0; i < w * h; i++) if (masque[i] && Math.min(b[i*4], b[i*4+1], b[i*4+2]) > 225) n++
    return n / nMer
  }
  const ecumeAvant = couverture(0), ecumeApres = couverture(1)
  // ─── ③ter le MIROITEMENT : barycentre des 0,5 % de pixels de nappe les plus
  // clairs — il doit SUIVRE l heure (le soleil tourne) ───────────────────────
  const barycentreClair = (vraie) => {
    mu.uMerVraieEau.value = vraie; rendre(); const b = lire()
    const lums = []
    for (let i = 0; i < w * h; i += 3) if (masque[i]) lums.push([b[i*4] + b[i*4+1] + b[i*4+2], i])
    lums.sort((p, q) => q[0] - p[0])
    const n = Math.max(1, Math.floor(lums.length * 0.005))
    let sx = 0, sy = 0
    for (let k = 0; k < n; k++) { const i = lums[k][1]; sx += i % w; sy += Math.floor(i / w) }
    return { x: +(sx / n / w).toFixed(3), y: +(sy / n / h).toFixed(3), lumMin: lums[n - 1]?.[0] ?? 0 }
  }
  const clairAvant = barycentreClair(0), clairApres = barycentreClair(1)
  const ventMs = mu.uMerVentMs.value
  const ecumeMonahan = 3.84e-6 * Math.pow(ventMs, 3.41)

  // ─── ④ le TUILAGE : autocorrelation spatiale de la luminance de la nappe ─────
  // sur nImages consecutives (uMerTemps avance de 0,137 s). Un motif repete a
  // un pas p ferait un pic secondaire d autocorrelation en p. ⚠️ Le champ est
  // passe au filtre PASSE-HAUT (moins sa moyenne glissante sur 24 px) : sans
  // lui, le degrade de profondeur rend r(8 px) = 0,9 sur n importe quelle mer
  // lisse, et la premiere campagne a lu « 0,76 » sur une nappe sans motif. Le
  // pic secondaire est le premier MAXIMUM LOCAL apres le premier minimum.
  const lum = (buf, i) => 0.299 * buf[i*4] + 0.587 * buf[i*4+1] + 0.114 * buf[i*4+2]
  const pics = []
  let diffTemporelle = 0
  let prec = null
  const lags = []
  for (let lag = 4; lag <= Math.floor(w / 4); lag += 4) lags.push(lag)
  for (let k = 0; k < nImages; k++) {
    mu.uMerTemps.value = t0 + k * 0.137
    rendre(); const buf = lire()
    const acc = new Float64Array(lags.length), cnt = new Float64Array(lags.length)
    for (let y = 0; y < h; y += 4) {
      let n = 0; for (let x = 0; x < w; x++) if (masque[y * w + x]) n++
      if (n < 0.6 * w) continue
      const L = new Float64Array(w)
      for (let x = 0; x < w; x++) L[x] = lum(buf, y * w + x)
      // passe-haut : moins la moyenne glissante sur 24 px
      const Hf = new Float64Array(w)
      for (let x = 0; x < w; x++) {
        let s = 0, c = 0
        for (let d = -12; d <= 12; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += L[xx]; c++ } }
        Hf[x] = L[x] - s / c
      }
      let v = 0; for (let x = 0; x < w; x++) v += Hf[x] * Hf[x]
      if (v < 1e-6) continue
      for (let j = 0; j < lags.length; j++) {
        const lag = lags[j]; let s = 0
        for (let x = 0; x + lag < w; x++) s += Hf[x] * Hf[x + lag]
        acc[j] += s / v; cnt[j]++
      }
    }
    const r = lags.map((_, j) => cnt[j] ? acc[j] / cnt[j] : 0)
    let jMin = 0; while (jMin + 1 < r.length && r[jMin + 1] < r[jMin]) jMin++
    let meilleur = -1, meilleurLag = 0
    for (let j = jMin; j < r.length; j++) if (r[j] > meilleur) { meilleur = r[j]; meilleurLag = lags[j] }
    pics.push({ image: k, picSecondaire: +meilleur.toFixed(4), lag: meilleurLag, premierMin: lags[jMin] })
    if (prec) { let d = 0, c = 0; for (let i = 0; i < w * h; i += 7) if (masque[i]) { d += Math.abs(lum(buf, i) - lum(prec, i)); c++ } diffTemporelle += d / Math.max(1, c) }
    prec = buf
  }
  mu.uMerTemps.value = t0
  mu.uMerVraieEau.value = vraie0
  rendre()
  return {
    mer: true, w, h, nMer, partEcran: +(nMer / (w * h)).toFixed(4),
    moyAvant, moyApres, diffAB: +diffAB.toFixed(2),
    fresnelAvant: +fresnelAvant.toFixed(4), fresnelApres: +fresnelApres.toFixed(4),
    ecume: { avant: +ecumeAvant.toFixed(4), apres: +ecumeApres.toFixed(4), monahan: +ecumeMonahan.toFixed(4), ventMs },
    miroitement: { avant: clairAvant, apres: clairApres },
    tuilage: { picMax: Math.max(...pics.map(p => p.picSecondaire)), pics },
    diffTemporelleMoy: +(diffTemporelle / Math.max(1, nImages - 1)).toFixed(2),
    uniformes: { vent: [mu.uMerVent.value.x, mu.uMerVent.value.y], ventMs: mu.uMerVentMs.value, houle: mu.uMerHoule.value, chop: mu.uMerChop.value, soleilFx: mu.uMerSoleilFx.value, jour: mu.uMerJour.value, sky: '#' + mu.uSky.value.getHexString() },
    pngAvant, pngApres,
  }
})`

// ══════════ LE COÛT GPU — en deux temps, parce que la requête ne répond pas dans
// la tâche qui l'a posée ═══════════════════════════════════════════════════════
//
// ⚠️ **PREMIÈRE CAMPAGNE : 0,000 ms PARTOUT.** `QUERY_RESULT_AVAILABLE` ne passe
// à vrai qu'après un retour à la boucle d'événements ; lu dans la même tâche, la
// boucle d'attente sortait sur son plafond et lisait 0. On POSE les requêtes dans
// une évaluation, on les LIT dans une autre, après un `setTimeout`.
const COUT_POSER = `((vraie, n, sansMer) => {
  const e = window.__exp, g = e.globe, mer = g._mer
  const gl = e.renderer.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  if (!ext || !mer) return false
  const mu = mer.material.uniforms
  const rendre = () => { if (e.composer) { for (const p of e.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0; e.composer.render(0) } else e.renderer.render(e.scene, e.camera) }
  mu.uMerVraieEau.value = vraie
  mer.visible = !sansMer
  const qs = []
  for (let i = 0; i < n; i++) {
    const q = gl.createQuery()
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q); rendre(); gl.endQuery(ext.TIME_ELAPSED_EXT)
    qs.push(q)
  }
  mer.visible = true
  mu.uMerVraieEau.value = 1
  gl.flush()
  window.__eauQ = qs
  return true
})`
const COUT_LIRE = `(() => {
  const e = window.__exp, gl = e.renderer.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const qs = window.__eauQ || []
  const v = []
  let indisponibles = 0
  for (const q of qs) {
    if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) v.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
    } else indisponibles++
    gl.deleteQuery(q)
  }
  window.__eauQ = null
  v.sort((a, b) => a - b)
  return { valeurs: v, indisponibles }
})`
async function mesurerCout() {
  const series = { avant: [], apres: [], sansMer: [] }
  const med = (v) => Array.isArray(v) && v.length ? v[Math.floor(v.length / 2)] : null
  let indispo = 0
  for (let rep = 0; rep < 6; rep++) {
    for (const [nom, vraie, sans] of [['avant', 0, false], ['apres', 1, false], ['sansMer', 1, true]]) {
      const ok = await page.evaluate(`${COUT_POSER}(${vraie}, 30, ${sans})`)
      if (!ok) return { refus: 'pas d extension timer ou pas de mer' }
      await dodo(400)
      const r = await page.evaluate(`${COUT_LIRE}()`)
      indispo += r.indisponibles
      const m = med(r.valeurs)
      if (m !== null) series[nom].push(m)
    }
  }
  const moy = (v) => v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN
  const ecart = (v) => { const m = moy(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, v.length)) }
  return {
    imageAvantMs: +moy(series.avant).toFixed(3), imageApresMs: +moy(series.apres).toFixed(3), imageSansMerMs: +moy(series.sansMer).toFixed(3),
    bruitMs: +Math.max(ecart(series.avant), ecart(series.apres), ecart(series.sansMer)).toFixed(3),
    deltaMs: +(moy(series.apres) - moy(series.avant)).toFixed(3),
    nappeAvantMs: +(moy(series.avant) - moy(series.sansMer)).toFixed(3),
    nappeApresMs: +(moy(series.apres) - moy(series.sansMer)).toFixed(3),
    repetitions: series.avant.length, indisponibles: indispo,
  }
}

const RES = { etiquette: ETIQ, date: new Date().toISOString(), w: W, h: H, zoom: ZOOM, postes: [] }
const ecrire = () => fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(RES, null, 1))
const sauvePng = (nom, dataUrl) => fs.writeFileSync(path.join(POUR_ADRIEN, nom), Buffer.from(dataUrl.split(',')[1], 'base64'))

etape('page neuve')
await neuf()
for (const lieu of LIEUX) {
  etape(`→ ${lieu.nom}`)
  await aller(lieu.lat, lieu.lon, ZOOM)
  await stabiliser()
  for (const heure of HEURES) {
    await page.evaluate((h) => window.__exp.applyTimeOfDay(h), heure)
    await wait(4)
    for (const cad of CADRAGES) {
      await incliner(cad.elev, cad.azim)
      await stabiliser()
      const r = await page.evaluate(`${MESURE}(${IMAGES}, false, '')`)
      const { pngAvant, pngApres, ...reste } = r
      if (COUT && r.mer && !r.refus) reste.cout = await mesurerCout()
      const poste = { lieu: lieu.nom, heure, cadrage: cad.nom, elev: cad.elev, ...reste }
      RES.postes.push(poste)
      ecrire()
      if (pngAvant) sauvePng(`${lieu.nom}-${cad.nom}-${heure}h-AVANT.png`, pngAvant)
      if (pngApres) sauvePng(`${lieu.nom}-${cad.nom}-${heure}h-APRES.png`, pngApres)
      etape(`${lieu.nom} ${cad.nom} ${heure} h : ${r.refus ?? `mer ${r.partEcran * 100 | 0} % · fresnel ${r.fresnelAvant} → ${r.fresnelApres} · écume ${r.ecume.avant} → ${r.ecume.apres} (Monahan ${r.ecume.monahan}) · ΔAB ${r.diffAB} · tuilage ${r.tuilage?.picMax} · coût ${JSON.stringify(reste.cout)}`}`)
    }
  }
}
await nav.close()
etape(`fini — ${path.join(ICI, `${ETIQ}.json`)}`)
