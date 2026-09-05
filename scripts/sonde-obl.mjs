// SONDE OBL — EN OBLIQUE, LA TERRE SE DÉCALE-T-ELLE AU ZOOM ? (brief OBL)
//
// Deux mesures, AU GESTE (molette CDP au centre de l'écran), sur la surface
// RENDUE (les maillages de tuiles du globe, lus par lancer de rayon — la
// méthode de GX3), à travers la caméra QUI DESSINE (`camGlobe`) :
//   ① la hauteur DESSINÉE d'un même sommet à chaque niveau (z11 → z14) —
//      rayon du maillage sous un rayon radial, converti en mètres par
//      `(R_GLOBE / EARTH_RADIUS_M) × exagération` ; à côté, ce que le BLOC
//      (`terrain.sample`, le pivot du zoom) croit de la même hauteur ;
//   ② la dérive à l'écran du point RENDU sous le centre, avant / après chaque
//      cran de molette, à l'inclinaison demandée (45°) et au nadir (0°).
//
// Usage :
//   node scripts/sonde-obl.mjs --port 11237 --lieu reunion --tilt 45 --n 8
//   lieux : reunion | montblanc | teide      tilt : degrés depuis la verticale
// Sortie : .banc/OBL/<lieu>-t<tilt>-<tag>.json
//
// ⛔ Rien n'est écrit dans src/. ⛔ Ne ferme QUE son propre Chrome.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'OBL')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '11237'))
const LIEU = opt('--lieu', 'reunion')
const TILT = Number(opt('--tilt', '45'))
const N = Number(opt('--n', '8'))
const TAG = opt('--tag', 'run')
const NIVEAUX = Number(opt('--niveaux', '3')) // crans de niveau à franchir
const NOTCHES = Number(opt('--notches', '20')) // crans de molette par geste
const INTERVALLE_MS = Number(opt('--intervalle', '40'))
const GARDER_IMAGES = A.includes('--images') // garder le relevé image par image dans le JSON
const ESPION = A.includes('--espion') // journaliser chaque écrivain de la caméra autour du franchissement
const CRAN = A.includes('--cran') // le BOUTON (`modes.cranZoom(1)`, ×√2 par cran, toutes les 250 ms) au lieu de la molette — le chemin de rapport-VID3
const W = 1280, H = 800, CX = W / 2, CY = H / 2

const LIEUX = {
  // lieu de départ, zoom de départ, sommet suivi (lat, lon, altitude réelle m)
  reunion: { vol: [-21.25, 55.77, 11], sommet: [-21.2444, 55.7139, 2632], nom: 'Piton de la Fournaise' },
  montblanc: { vol: [45.85, 6.88, 11], sommet: [45.8326, 6.8652, 4808], nom: 'Mont-Blanc' },
  teide: { vol: [28.25, -16.60, 11], sommet: [28.2724, -16.6425, 3715], nom: 'Teide' },
}
const L = LIEUX[LIEU]
if (!L) throw new Error('lieu inconnu : ' + LIEU)

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--headless=new', '--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H + 120}`],
  defaultViewport: { width: W, height: H },
})
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const log = (...m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s]`, ...m)

async function chargement(k) {
  const page = await nav.newPage()
  const cdp = await page.target().createCDPSession()
  const erreurs = []
  page.on('pageerror', (e) => { const m = String(e.message).slice(0, 300); if (!erreurs.includes(m)) log('  [page] ' + m); erreurs.push(m) })
  const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.terrain && window.__exp?.camGlobe, { timeout: 180000, polling: 100 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  await dodo(3000)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
    const sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
    if (sous === 'CANVAS') break
  }
  if (ESPION) await page.evaluate(async () => {
    const e = window.__exp, m = e.modes, c = m.controls, cam = e.camera
    const PO = await import('/src/monde/pivot-oblique.js')
    const J = (window.__espion = [])
    const G = () => { const p = m.hooks.similitudeBloc?.(c.target.x, c.target.z); const S = p ? PO.similitudeBloc(p) : null; return S ? S.versGlobe([cam.position.x, cam.position.y, cam.position.z]).map((v) => +v.toFixed(5)) : null }
    const etat = () => ({ cam: cam.position.toArray().map((v) => +v.toFixed(4)), cib: c.target.toArray().map((v) => +v.toFixed(4)), d: +cam.position.distanceTo(c.target).toFixed(4), G: G(), min: +c.minDistance.toFixed(3), polMax: +(c.maxPolarAngle * 180 / Math.PI).toFixed(2), z: e.params.demZoom, busy: m.busy })
    const note = (qui, avant, apres) => { if (J.length < 20000) J.push({ t: +performance.now().toFixed(1), qui, avant, apres }) }
    for (const nom of ['_transporterSiRepereChange', '_applyZoom', '_suivreEmprise', '_avancerFonduPose', '_rescale', '_franchirSiBesoin']) {
      const orig = m[nom]
      if (typeof orig !== 'function') continue
      m[nom] = function (...a) { const av = etat(); const r = orig.apply(this, a); if (r && typeof r.then === 'function') return r.then((v) => { note(nom + ' (fin)', av, etat()); return v }); const ap = etat(); if (JSON.stringify(av.cam) !== JSON.stringify(ap.cam) || JSON.stringify(av.cib) !== JSON.stringify(ap.cib)) note(nom, av, ap); return r }
    }
    const origU = c.update.bind(c)
    c.update = function () { const av = etat(); const r = origU(); const ap = etat(); if (JSON.stringify(av.cam) !== JSON.stringify(ap.cam)) note('controls.update', av, ap); return r }
    // les écritures directes de main.js (redresserSurLeSol, pivoterAutourDuBloc) : on relève la caméra à chaque image après le tick
    let dernier = null
    const tick = () => { const s = etat(); if (dernier && JSON.stringify(dernier.G) !== JSON.stringify(s.G)) note('image', dernier, s); dernier = s; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  // ── l'instrument, dans la page ─────────────────────────────────────────
  await page.evaluate(() => {
    const e = window.__exp
    const THREE = e.THREE
    const R_GLOBE = 100, EARTH = 6371000
    const D2R = Math.PI / 180
    const ray = new THREE.Raycaster()
    // ⚠️ pas de filtre `visible` : sur le crop, les tuiles fines sont dessinées avec
    // un drapeau basculé par passe ; toute tuile posée dans le groupe compte
    const tuiles = () => { const out = []; for (const t of e.globe.tiles.values()) if (t.mesh && t.mesh.parent && t.mesh.geometry?.attributes?.position) out.push(t.mesh); return out }
    const dirDe = (lat, lon) => new THREE.Vector3(Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.cos(lon * D2R))
    const latLonDe = (p) => ({ lat: Math.asin(p.y / p.length()) / D2R, lon: Math.atan2(p.x, p.z) / D2R })
    const exag = () => e.globe.exaggeration
    const uParM = () => (R_GLOBE / EARTH) * exag()
    // rayon RENDU sous un rayon radial (ciel → centre) — méthode GX3
    const rayonRendu = (lat, lon) => {
      const d = dirDe(lat, lon)
      ray.set(d.clone().multiplyScalar(300), d.clone().negate())
      ray.far = 400
      const hits = ray.intersectObjects(tuiles(), false)
      if (!hits.length) return null
      const p = hits[0].point
      return { r: p.length(), hM: (p.length() - R_GLOBE) / uParM(), z: hits[0].object.userData?.z ?? null }
    }
    // le point RENDU sous un pixel de l'écran, à travers camGlobe
    const rendreSous = (px, py) => {
      const cam = e.camGlobe
      const ndc = new THREE.Vector2((px / innerWidth) * 2 - 1, -((py / innerHeight) * 2 - 1))
      ray.setFromCamera(ndc, cam)
      ray.far = 1e4
      const hits = ray.intersectObjects(tuiles(), false)
      if (!hits.length) return null
      const p = hits[0].point
      const { lat, lon } = latLonDe(p)
      return { lat, lon, r: p.length(), hM: (p.length() - R_GLOBE) / uParM(), dist: hits[0].distance }
    }
    const projette = (lat, lon, r) => {
      const v = dirDe(lat, lon).multiplyScalar(r)
      v.project(e.camGlobe)
      return { px: ((v.x + 1) / 2) * innerWidth, py: ((1 - v.y) / 2) * innerHeight, devant: v.z < 1 }
    }
    // le bloc : ce que le pivot du zoom (`pointUnder`) et la cible lisent
    const blocM = (y) => {
      const f = e.terrain.fenetreBornee
      if (f?.echelleVerticale > 0) return y / f.echelleVerticale + f.moyenneM
      const ech = e.modes.hooks.echelleVerticaleBloc?.()
      return ech > 0 ? y / ech + (e.terrain.dem?.meanM ?? 0) : null
    }
    const etat = () => {
      const m = e.modes, cam = e.camera, c = m.controls
      const dir = cam.position.clone().sub(c.target)
      const tilt = Math.acos(dir.y / dir.length()) / D2R
      const f = e.terrain.fenetreBornee
      return {
        z: e.params.demZoom, busy: m.busy, mode: m.mode, dist: +dir.length().toFixed(4), tilt: +tilt.toFixed(3),
        cible: [+c.target.x.toFixed(4), +c.target.y.toFixed(4), +c.target.z.toFixed(4)],
        cam: [+cam.position.x.toFixed(4), +cam.position.y.toFixed(4), +cam.position.z.toFixed(4)],
        levelZoom: +(m._levelZoom ?? 0).toFixed(4), zoomVel: +(m._zoomVel ?? 0).toFixed(5),
        exag: exag(), exagBloc: e.params.exagPartage?.valeur ?? e.params.demExaggeration,
        ech: f?.echelleVerticale ?? null, moyM: f?.moyenneM ?? null, empriseM: Math.round(m.hooks.empriseBlocM?.() ?? -1),
        horsCrop: m.hooks.horsDuCrop?.() ?? null, altFondM: Math.round((e.camGlobe.position.length() - 100) * 63710),
        pivot: m._zoomPivot ? [+m._zoomPivot.x.toFixed(4), +m._zoomPivot.y.toFixed(4), +m._zoomPivot.z.toFixed(4)] : null,
      }
    }
    const S = (window.__obl = { on: false, suivi: null, frames: [], rayonRendu, rendreSous, projette, blocM, etat })
    const tick = () => {
      if (S.on && S.suivi) {
        const { lat, lon } = S.suivi
        const rr = rayonRendu(lat, lon)
        const p = rr ? projette(lat, lon, rr.r) : null
        const m = e.modes, cg = e.camGlobe, f = e.terrain.fenetreBornee
        S.frames.push({ t: +performance.now().toFixed(1), z: e.params.demZoom, busy: m.busy, px: p ? +p.px.toFixed(1) : null, py: p ? +p.py.toFixed(1) : null, devant: p?.devant ?? null, hM: rr ? Math.round(rr.hM) : null,
          rG: +cg.position.length().toFixed(5), cG: cg.position.toArray().map((v) => +v.toFixed(4)), camY: +e.camera.position.y.toFixed(4), cibY: +m.controls.target.y.toFixed(4), dist: +e.camera.position.distanceTo(m.controls.target).toFixed(4),
          emp: Math.round(m.hooks.empriseBlocM?.() ?? -1), moy: f?.moyenneM != null ? Math.round(f.moyenneM) : null, rep: m._repereVue?.empreinte?.slice(0, 40) ?? null, piv: m._zoomPivot ? +m._zoomPivot.y.toFixed(3) : null, vel: +(m._zoomVel ?? 0).toFixed(3),
          fondu: !!m._fonduPose, polMax: +(m.controls.maxPolarAngle * 180 / Math.PI).toFixed(2), tilt: +(Math.acos(Math.max(-1, Math.min(1, (e.camera.position.y - m.controls.target.y) / e.camera.position.distanceTo(m.controls.target)))) * 180 / Math.PI).toFixed(3), sortie: !!m._sortieCourse })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const reposer = async (max = 60000) => {
    await page.waitForFunction(() => { const m = window.__exp.modes; return !m.busy && !m.travel && !m._diveTween && !m._fonduPose && m._zoomVel === 0 }, { timeout: max, polling: 'raf' }).catch(async () => log('  (repos : délai) ' + JSON.stringify(await page.evaluate(() => { const m = window.__exp.modes; return { busy: m.busy, travel: !!m.travel, dive: !!m._diveTween, fondu: !!m._fonduPose, zoomVel: m._zoomVel, z: window.__exp.params.demZoom, msg: m.msgEl?.textContent } }))))
    await wait(6)
  }
  const cran = (delta) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: delta, pointerType: 'mouse' })
  const etat = () => page.evaluate(() => window.__obl.etat())
  const sommet = () => page.evaluate(([lat, lon]) => {
    const e = window.__exp, S = window.__obl
    const rr = S.rayonRendu(lat, lon)
    const maille = e.globe.hauteurMaillee?.(lat, lon) ?? null
    const dess = e.globe.hauteurDessinee?.(lat, lon) ?? null
    const w = e.modes.hooks.viseeDuLieu?.(lat, lon)
    const yBloc = w ? e.terrain.sample?.(w.x, w.z) : null
    return { rendu: rr, hMailleeM: maille, hDessineeM: dess, blocY: yBloc, blocM: yBloc != null ? S.blocM(yBloc) : null }
  }, L.sommet)

  const R = { k, lieu: LIEU, tilt: TILT, erreurs, niveaux: [], crans: [], sommets: [] }
  // ── le chemin : vol vers le niveau de départ, repos, inclinaison posée ──
  await page.evaluate(([la, lo, z]) => window.__exp.modes.flyTo(la, lo, z), L.vol)
  await dodo(3000); await reposer(120000); await dodo(6000)
  await page.waitForFunction(() => window.__exp.modes.hooks.horsDuCrop?.() === false, { timeout: 30000, polling: 200 }).catch(() => log('  (crop non posé)'))
  await dodo(1500)
  // inclinaison EXACTE demandée, autour de la cible, à distance et azimut constants
  await page.evaluate((tiltDeg) => {
    const e = window.__exp, c = e.modes.controls, cam = e.camera
    const d = cam.position.clone().sub(c.target)
    const dist = d.length()
    const az = Math.atan2(d.x, d.z)
    const t = tiltDeg * Math.PI / 180
    cam.position.set(c.target.x + dist * Math.sin(t) * Math.sin(az), c.target.y + dist * Math.cos(t), c.target.z + dist * Math.sin(t) * Math.cos(az))
    c.update()
  }, TILT)
  await wait(10); await dodo(800)
  R.arrivee = await etat()
  R.sommets.push({ z: R.arrivee.z, ...(await sommet()) })
  log(`  charg. ${k} : arrivée z${R.arrivee.z} tilt ${R.arrivee.tilt}° dist ${R.arrivee.dist} alt ${R.arrivee.altFondM} m · sommet rendu ${Math.round(R.sommets[0].rendu?.hM ?? NaN)} m · bloc ${Math.round(R.sommets[0].blocM ?? NaN)} m`)

  const zDepart = R.arrivee.z
  for (let n = 1; n <= NIVEAUX; n++) {
    const zVise = zDepart + n
    // le point RENDU sous le centre AVANT le premier cran du niveau
    const centre0 = await page.evaluate(() => window.__obl.rendreSous(innerWidth / 2, innerHeight / 2))
    if (!centre0) { log('  pas de surface sous le centre'); break }
    await page.evaluate((c) => { const S = window.__obl; S.suivi = c; S.frames = []; S.on = true; if (window.__espion) window.__espion.length = 0 }, centre0)
    const e0 = await etat()
    let crans = 0
    while (crans < (CRAN ? 8 : 4)) {
      const c0 = await page.evaluate(() => window.__obl.rendreSous(innerWidth / 2, innerHeight / 2))
      const s0 = await etat()
      // un GESTE de molette : `NOTCHES` crans en rafale (< WHEEL_GAP_MS entre deux),
      // c'est-à-dire un tour de molette d'Adrien (« vingt crans par niveau »)
      if (CRAN) { await page.evaluate(() => window.__exp.modes.cranZoom(1)) }
      else for (let i = 0; i < NOTCHES; i++) { await cran(-100); await dodo(INTERVALLE_MS) }
      crans++
      await dodo(250)
      await reposer(60000)
      const s1 = await etat()
      const p1 = c0 ? await page.evaluate(([lat, lon]) => { const S = window.__obl, rr = S.rayonRendu(lat, lon); return rr ? { ...S.projette(lat, lon, rr.r), hM: rr.hM } : null }, [c0.lat, c0.lon]) : null
      const derive = p1 ? Math.hypot(p1.px - CX, p1.py - CY) : null
      R.crans.push({ niveauVise: zVise, cran: crans, zAvant: s0.z, zApres: s1.z, distAvant: s0.dist, distApres: s1.dist, tiltAvant: s0.tilt, tiltApres: s1.tilt, cibleY: s1.cible[1], pivotY: s0.pivot?.[1] ?? null, centreAvant: c0 ? { lat: +c0.lat.toFixed(5), lon: +c0.lon.toFixed(5), hM: Math.round(c0.hM) } : null, apres: p1 ? { px: +p1.px.toFixed(1), py: +p1.py.toFixed(1), hM: Math.round(p1.hM) } : null, derivePx: derive != null ? +derive.toFixed(1) : null })
      log(`    cran ${crans} : z${s0.z}→z${s1.z} dist ${s0.dist}→${s1.dist} dérive ${derive?.toFixed(1)} px (h ${Math.round(c0?.hM ?? NaN)}→${Math.round(p1?.hM ?? NaN)} m)`)
      if (s1.z >= zVise) break
    }
    await dodo(2500); await reposer(60000)
    const frames = await page.evaluate(() => { const S = window.__obl; S.on = false; return S.frames })
    const espion = ESPION ? await page.evaluate(() => { const J = window.__espion.slice(); window.__espion.length = 0; return J }) : undefined
    const e1 = await etat()
    const pFin = await page.evaluate(([lat, lon]) => { const S = window.__obl, rr = S.rayonRendu(lat, lon); return rr ? { ...S.projette(lat, lon, rr.r), hM: rr.hM } : null }, [centre0.lat, centre0.lon])
    const ys = frames.filter((f) => f.py != null).map((f) => f.py)
    const xs = frames.filter((f) => f.px != null).map((f) => f.px)
    const excursion = ys.length ? Math.max(...ys.map((y, i) => Math.hypot(xs[i] - CX, y - CY))) : null
    R.niveaux.push({ zAvant: e0.z, zApres: e1.z, crans, centreAvant: { lat: +centre0.lat.toFixed(5), lon: +centre0.lon.toFixed(5), hM: Math.round(centre0.hM) }, apres: pFin ? { px: +pFin.px.toFixed(1), py: +pFin.py.toFixed(1), hM: Math.round(pFin.hM) } : null, derivePx: pFin ? +Math.hypot(pFin.px - CX, pFin.py - CY).toFixed(1) : null, excursionMaxPx: excursion != null ? +excursion.toFixed(1) : null, images: frames.length, frames: GARDER_IMAGES ? frames : undefined, espion, tiltApres: e1.tilt, distApres: e1.dist, cibleY: e1.cible[1], ech: e1.ech, moyM: e1.moyM, empriseM: e1.empriseM })
    const so = await sommet()
    R.sommets.push({ z: e1.z, ...so })
    log(`  niveau z${e0.z}→z${e1.z} (${crans} crans) : dérive du point visé ${R.niveaux.at(-1).derivePx} px, excursion max ${excursion?.toFixed(0)} px · sommet rendu ${Math.round(so.rendu?.hM ?? NaN)} m (maillée ${Math.round(so.hMailleeM ?? NaN)}) · bloc ${Math.round(so.blocM ?? NaN)} m`)
    if (e1.z < zVise) { log('  niveau non franchi, arrêt'); break }
  }
  await page.close().catch(() => {})
  return R
}

const sortie = path.join(ICI, `${LIEU}-t${TILT}-${CRAN ? 'cran-' : ''}${TAG}.json`)
const tout = { lieu: LIEU, tilt: TILT, port: PORT, date: new Date().toISOString(), chargements: [] }
try {
  for (let k = 1; k <= N; k++) {
    log(`chargement ${k}/${N}`)
    try { tout.chargements.push(await chargement(k)) } catch (er) { log('ERREUR', er?.message); tout.chargements.push({ k, erreur: String(er?.stack || er) }) }
    fs.writeFileSync(sortie, JSON.stringify(tout, null, 1))
  }
} finally { await nav.close() }
// ── résumé ─────────────────────────────────────────────────────────────────
const ok = tout.chargements.filter((c) => c.niveaux?.length)
console.log(`\n=== ${LIEU} tilt ${TILT}° — ${ok.length}/${N} chargements ===`)
const parNiveau = new Map()
for (const c of ok) for (const n of c.niveaux) { const k = `z${n.zAvant}→z${n.zApres}`; if (!parNiveau.has(k)) parNiveau.set(k, []); parNiveau.get(k).push(n) }
for (const [k, ns] of parNiveau) console.log(`${k} : dérive [${ns.map((n) => n.derivePx).join(' ')}] px · excursion max [${ns.map((n) => n.excursionMaxPx).join(' ')}] px`)
const parZ = new Map()
for (const c of ok) for (const s of c.sommets) { if (!parZ.has(s.z)) parZ.set(s.z, []); parZ.get(s.z).push(s) }
console.log(`${L.nom} (${L.sommet[2]} m réels) — hauteur RENDUE (m, sans exagération) / maillée / bloc :`)
for (const [z, ss] of [...parZ].sort((a, b) => a[0] - b[0])) console.log(`  z${z} : rendu [${ss.map((s) => Math.round(s.rendu?.hM ?? NaN)).join(' ')}] · maillée [${ss.map((s) => Math.round(s.hMailleeM ?? NaN)).join(' ')}] · bloc [${ss.map((s) => Math.round(s.blocM ?? NaN)).join(' ')}]`)
console.log('→', sortie)
