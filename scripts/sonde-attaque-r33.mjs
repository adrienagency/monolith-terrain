// SONDE R33 — ATTAQUANT : OÙ EST LE PIVOT, EN MÈTRES DU CENTRE DE LA TERRE ?
//
// ══════════ CE QUE CE BANC MESURE, ET DANS QUEL ESPACE ═════════════════════
//
// Quatre passes (R27, R29, R29 bis, R30) ont mesuré `hypot(target.x, target.z)`
// — l'écart de la cible à l'axe VERTICAL DU BLOC, en unités de bloc — et l'ont
// appelé « écart à l'axe de la Terre ». Ce banc ne lit RIEN en unités de bloc
// pour décider. Il lit :
//
//   · `camGlobe` — la caméra qui DESSINE (main.js, `majCameraFond`), en espace
//     globe, où le centre de la Terre est l'origine et `R_GLOBE = 100` la
//     surface (1 unité = 63 710 m) ;
//   · la cible transportée dans ce même espace : `camGlobe.position +
//     avant × k·d` (la similitude conserve les angles et multiplie les
//     longueurs par `k = (emprise/span) / ORBITAL_M_PER_UNIT`) ;
//   · l'AXE INSTANTANÉ DE ROTATION de `camGlobe` entre deux images
//     consécutives (axe hélicoïdal du déplacement rigide), et la distance du
//     centre de la Terre à cet axe — c'est LE pivot, mesuré et non supposé ;
//   · des pixels : le centre de la Terre projeté par `camGlobe`, le point de
//     surface saisi au `mousedown` contre le curseur, le point de surface au
//     centre de l'écran avant un scroll.
//
// La sonde est posée AU RENDU (`composer.render` enveloppé), pas dans
// `controls.update` : `redresserSurLeSol` et `majCameraFond` écrivent après.
//
// Les gestes sont RÉELS : `Input.dispatchMouseEvent` (mousePressed / mouseMoved
// / mouseReleased / mouseWheel), jamais l'API des modes pour le geste mesuré.
// Le voile d'accueil est fermé par Échap et VÉRIFIÉ (`elementFromPoint`).
// La pose de démarrage est attendue (vol de ~8 s) avant tout geste.
//
//   node scripts/sonde-attaque-r33.mjs --port 5951 --etiquette apres
//
// Sortie : `.banc/R33/<etiquette>.json` + résumé console.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R33')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5951'))
const ETIQ = opt('--etiquette', 'releve')
const ALTITUDES = opt('--altitudes', '2000000,130000,50000').split(',').map(Number)
// --serie complete : H, V(-200), molette couchee, retour, molette d'aplomb
// --serie inclinaison : H, V(-60) — une inclinaison MODEREE qui reste hors du crop —, molette 2/2, retour, molette d'aplomb 2/2
const SERIE = opt('--serie', 'complete')
const W = 1280, H = 800
const CX = W / 2, CY = H / 2
const MPU = 6371000 / 100 // ORBITAL_M_PER_UNIT : mètres par unité-globe
const R2D = 180 / Math.PI

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const journal = []
page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') journal.push(`${t}: ${m.text().slice(0, 200)}`) })
page.on('pageerror', (e) => journal.push(`pageerror: ${String(e).slice(0, 200)}`))
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

const t0 = Date.now()
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.camGlobe)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
const tCache = Date.now()

// ══════════ LE VOILE D'ACCUEIL : FERMÉ ET VÉRIFIÉ, PAS SUPPOSÉ ════════════
await page.keyboard.press('Escape').catch(() => {})
await wait(10)
let sous = await page.evaluate(() => { const el = document.elementFromPoint(640, 400); return el ? el.tagName + '.' + String(el.className).slice(0, 40) : null })
const voile = { apresEchap: sous, retire: false }
if (!/^CANVAS/.test(sous || '')) {
  await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
  await wait(5)
  sous = await page.evaluate(() => { const el = document.elementFromPoint(640, 400); return el ? el.tagName + '.' + String(el.className).slice(0, 40) : null })
  voile.retire = true
  voile.apresRetrait = sous
}
if (!/^CANVAS/.test(sous || '')) { console.error('⛔ VOILE ENCORE LÀ :', sous); await nav.close(); process.exit(2) }

// ══════════ LA POSE DE DÉMARRAGE : APRÈS LE VOL, PAS AVANT ════════════════
// R29 bis : immobile à d = 26,4 pendant 5 s, PUIS vol de 8,3 s vers d = 145,5.
// « Stable » est vrai deux fois. On exige les deux : ≥ 14 s depuis la fin du
// chargement ET 120 images sans mouvement ni machine occupée.
const chrono = []
{
  let stable = 0, dPrev = -1
  for (let i = 0; i < 2400; i++) {
    const s = await page.evaluate(() => {
      const e = window.__exp
      return { d: e.camera.position.distanceTo(e.controls.target), busy: !!e.modes.busy, travel: !!e.modes.travel, tween: !!(e.tween && e.tween.active), fondu: !!e.modes._fonduPose, mode: e.modes.mode }
    })
    if (i % 30 === 0) chrono.push({ t: (Date.now() - tCache) / 1000, ...s })
    const ok = !s.busy && !s.travel && !s.tween && !s.fondu && Math.abs(s.d - dPrev) < 1e-6
    stable = ok ? stable + 1 : 0
    dPrev = s.d
    if (stable >= 120 && Date.now() - tCache > 14000) break
    await wait(1)
  }
}
const poseDemarrage = await page.evaluate(() => { const e = window.__exp; return { d: e.camera.position.distanceTo(e.controls.target), alt: e.altitudeCadrageM(), mode: e.modes.mode, crop: !!(e.globe && e.globe._crop) } })

// ══════════ L'ENREGISTREUR, AU RENDU ══════════════════════════════════════
await page.evaluate(({ MPU, CX, CY }) => {
  const e = window.__exp
  const c = e.controls, cam = e.camera, m = e.modes, cg = e.camGlobe
  const V3 = cam.position.constructor
  const R_GLOBE = 100
  const T = { on: false, tag: '', frames: [], image: 0, curseur: [CX, CY], saisi: null, centreAvant: null, cran: 0 }
  window.__R33 = T
  const maj = () => { T.image++; requestAnimationFrame(maj) }
  requestAnimationFrame(maj)
  // ⚠️ le curseur relevé par le DOM lui-même, pas supposé depuis node
  window.addEventListener('pointermove', (ev) => { T.curseur = [ev.clientX, ev.clientY] }, { capture: true, passive: true })
  window.addEventListener('pointerdown', (ev) => { T.curseur = [ev.clientX, ev.clientY] }, { capture: true, passive: true })

  const k = () => {
    if (m.mode === 'orbital') return 1
    const emp = m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null
    const span = m.hooks.coteBloc ? m.hooks.coteBloc() : 56
    return emp > 0 ? emp / span / MPU : null
  }
  const latLon = (v) => {
    const r = Math.hypot(v.x, v.y, v.z) || 1
    return [Math.asin(Math.max(-1, Math.min(1, v.y / r))) * 180 / Math.PI, Math.atan2(v.x, v.z) * 180 / Math.PI]
  }
  // le rayon DESSINÉ à (lat, lon) : la sphère plus le relief, tel que globe.js
  // le pose (max(h, 0) × échelle × exagération)
  const rayonDessine = (lat, lon) => {
    let h = null
    try { h = e.globe && e.globe.hauteurDessinee ? e.globe.hauteurDessinee(lat, lon) : null } catch { h = null }
    const ex = (e.globe && e.globe.exaggeration > 0) ? e.globe.exaggeration : 1
    return R_GLOBE + Math.max(Number.isFinite(h) ? h : 0, 0) * (R_GLOBE / 6371000) * ex
  }
  const _ray = new V3(), _o = new V3()
  // le point de la SURFACE DESSINÉE sous le pixel (px, py), en espace globe
  T.pointSousPixel = (px, py) => {
    const r = e.renderer.domElement.getBoundingClientRect()
    const nx = ((px - r.left) / r.width) * 2 - 1, ny = -(((py - r.top) / r.height) * 2 - 1)
    _ray.set(nx, ny, 0.5).unproject(cg).sub(cg.position).normalize()
    _o.copy(cg.position)
    let rayon = R_GLOBE
    let p = null
    for (let it = 0; it < 4; it++) {
      // intersection rayon / sphère de rayon `rayon`
      const b = _o.dot(_ray), cc = _o.lengthSq() - rayon * rayon
      const disc = b * b - cc
      if (disc < 0) return null
      const t = -b - Math.sqrt(disc)
      if (t < 0) return null
      p = [_o.x + _ray.x * t, _o.y + _ray.y * t, _o.z + _ray.z * t]
      const [la, lo] = latLon({ x: p[0], y: p[1], z: p[2] })
      const r2 = rayonDessine(la, lo)
      if (Math.abs(r2 - rayon) < 1e-7) break
      rayon = r2
    }
    return p
  }
  const _pv = new V3()
  const projette = (p) => {
    if (!p) return null
    _pv.set(p[0], p[1], p[2]).applyMatrix4(cg.matrixWorldInverse)
    const devant = _pv.z < 0
    _pv.applyMatrix4(cg.projectionMatrix)
    const r = e.renderer.domElement.getBoundingClientRect()
    return [(_pv.x * 0.5 + 0.5) * r.width, (-_pv.y * 0.5 + 0.5) * r.height, devant ? 1 : 0]
  }
  const _fwd = new V3(), _up = new V3(), _cib = new V3()
  T.instant = () => {
    const g = e.globe
    const kk = k()
    const d = cam.position.distanceTo(c.target)
    _fwd.set(0, 0, -1).applyQuaternion(cg.quaternion)
    _up.copy(cg.position).normalize()
    const angleVertCam = Math.acos(Math.max(-1, Math.min(1, -_fwd.dot(_up)))) * 180 / Math.PI
    // la cible en espace globe : la caméra vise la cible, et la similitude
    // multiplie les longueurs par k
    let cibleG = null, cibleM = null, angleVertCible = null, sousCible = null
    if (m.mode === 'orbital') { cibleG = [c.target.x, c.target.y, c.target.z] }
    else if (kk > 0) { _cib.copy(cg.position).addScaledVector(_fwd, kk * d); cibleG = [_cib.x, _cib.y, _cib.z] }
    if (cibleG) {
      cibleM = Math.hypot(cibleG[0], cibleG[1], cibleG[2]) * MPU
      const n = Math.hypot(cibleG[0], cibleG[1], cibleG[2])
      angleVertCible = n > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, -(_fwd.x * cibleG[0] + _fwd.y * cibleG[1] + _fwd.z * cibleG[2]) / n))) * 180 / Math.PI : null
      sousCible = n > 1e-9 ? latLon({ x: cibleG[0], y: cibleG[1], z: cibleG[2] }) : null
    }
    return {
      i: T.image, tag: T.tag, t: performance.now(), cran: T.cran,
      mode: m.mode, busy: !!m.busy, fondu: !!m._fonduPose, travel: !!m.travel, dive: !!m._diveTween,
      crop: !!(g && g._crop), cropPose: !!(e.veilleCrop && e.veilleCrop.pose),
      horsDuCrop: m.hooks.horsDuCrop ? !!m.hooks.horsDuCrop() : null,
      altCadrage: e.altitudeCadrageM ? e.altitudeCadrageM() : null,
      altFond: m.hooks.altitudeFondRenduM ? m.hooks.altitudeFondRenduM() : null,
      emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null, zoom: e.params ? e.params.demZoom : null,
      k: kk, d, phi: c.getPolarAngle() * 180 / Math.PI, az: c.getAzimuthalAngle() * 180 / Math.PI,
      maxPhi: c.maxPolarAngle * 180 / Math.PI, zoomVel: m._zoomVel, niveau: m._levelZoom,
      tx: c.target.x, ty: c.target.y, tz: c.target.z, ecartAxeBloc: Math.hypot(c.target.x, c.target.z),
      g: [cg.position.x, cg.position.y, cg.position.z], gq: [cg.quaternion.x, cg.quaternion.y, cg.quaternion.z, cg.quaternion.w],
      gr: cg.position.length(), altCamM: (cg.position.length() - R_GLOBE) * MPU,
      cibleG, cibleM, sousCam: latLon(cg.position), sousCible,
      angleVertCam, angleVertCible,
      pTerre: projette([0, 0, 0]),
      curseur: [T.curseur[0], T.curseur[1]],
      pSaisi: T.saisi ? projette(T.saisi) : null,
      pCentreAvant: T.centreAvant ? projette(T.centreAvant) : null,
      repos: !!(e.veilleRepos && e.veilleRepos.auRepos),
      altimetre: m.altValueEl ? m.altValueEl.textContent : null,
    }
  }
  const cible = (e.composer && typeof e.composer.render === 'function') ? e.composer : e.renderer
  const orig = cible.render.bind(cible)
  cible.render = function (...a) {
    if (T.on) T.frames.push(T.instant())
    return orig(...a)
  }
  // le globe tourne seul en orbite après 3 s : l'interrupteur d'animations le
  // gèle (dtAmb = 0). On mesure le geste, pas la Terre.
  e.params.animations = false
}, { MPU, CX, CY })

const on = (tag) => page.evaluate((t) => { window.__R33.on = true; window.__R33.tag = t }, tag)
const tag = (t) => page.evaluate((x) => { window.__R33.tag = x }, t)
const off = () => page.evaluate(() => { window.__R33.on = false })
const etat = () => page.evaluate(() => window.__R33.instant())
const attendreRepos = async (timeout = 90000) => {
  await page.waitForFunction(
    "(() => { const m = window.__exp.modes; return m._zoomVel === 0 && !m.busy && !m._fonduPose && !m.travel && !m._diveTween && !(window.__exp.tween && window.__exp.tween.active) })()",
    { timeout, polling: 'raf' },
  ).catch(() => {})
}
const attendreRecentrage = async (maxImg = 700) => {
  for (let i = 0; i < maxImg; i += 10) {
    const s = await etat()
    if (s.mode === 'orbital' || s.ecartAxeBloc < 1e-9 || s.cropPose) return i
    await wait(10)
  }
  return null
}

// ── les gestes réels ───────────────────────────────────────────────────────
async function souris(type, x, y, extra = {}) {
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', pointerType: 'mouse', ...extra })
}
async function glisser(nom, dx, dy, pas = 20) {
  await tag(`${nom}/avant`)
  await wait(20)
  await page.evaluate(() => { const T = window.__R33; T.saisi = T.pointSousPixel(640, 400) })
  await tag(`${nom}/pendant`)
  await souris('mousePressed', CX, CY, { clickCount: 1, buttons: 1 })
  for (let i = 1; i <= pas; i++) {
    await souris('mouseMoved', CX + (dx * i) / pas, CY + (dy * i) / pas, { buttons: 1 })
    await wait(1)
  }
  await souris('mouseReleased', CX + dx, CY + dy, { clickCount: 1, buttons: 0 })
  await tag(`${nom}/apres`)
  await wait(20)
  await page.evaluate(() => { window.__R33.saisi = null })
}
async function molette(nom, crans, delta) {
  await tag(`${nom}/avant`)
  await wait(20)
  await page.evaluate(() => { const T = window.__R33; T.centreAvant = T.pointSousPixel(640, 400); T.cran = 0 })
  for (let i = 1; i <= crans; i++) {
    await page.evaluate((k) => { window.__R33.cran = k }, i)
    await tag(`${nom}/cran${i}`)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: delta, modifiers: 0, pointerType: 'mouse' })
    await wait(4)
  }
  await tag(`${nom}/glisse`)
  await attendreRepos()
  await wait(20)
  await tag(`${nom}/apres`)
  await wait(20)
  await page.evaluate(() => { window.__R33.centreAvant = null })
}
// descendre à la molette (geste réel) jusqu'à l'altitude demandée, hors crop
async function descendreVers(altM) {
  for (let tour = 0; tour < 60; tour++) {
    let s = await etat()
    if (s.altFond != null && s.altFond <= altM && s.mode === 'surface') break
    for (let i = 0; i < 12; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: -100, modifiers: 0, pointerType: 'mouse' })
      await wait(4)
      s = await etat()
      if (s.altFond != null && s.altFond <= altM * 1.7) break
    }
    await attendreRepos()
    await wait(10)
  }
  await attendreRepos()
  await wait(60)
  await attendreRecentrage()
}

// ══════════ LA SÉRIE ═══════════════════════════════════════════════════════
// Un banc par altitude : 20 images au repos, glissé horizontal +200 px, 20 images,
// glissé vertical −200 px (vers le haut : la vue se couche — le geste de la
// vidéo), 20 images, molette 3 crans dedans / 3 dehors vue couchée, glissé
// vertical +200 px (retour), molette 3/3 vue d'aplomb.
const bancs = []
async function banc(nom) {
  const dep = await etat()
  await on(`${nom}/repos`)
  await wait(20)
  if (SERIE === 'capture') {
    // le geste de la vidéo d'Adrien, et une capture d'écran après chaque glissé
    await glisser(`${nom}/H`, 200, 0)
    await page.screenshot({ path: path.join(ICI, `${ETIQ}-${nom}-H.png`) })
    await glisser(`${nom}/V`, 0, -200)
    await page.screenshot({ path: path.join(ICI, `${ETIQ}-${nom}-V.png`) })
    await glisser(`${nom}/Vr`, 0, 200)
  } else if (SERIE === 'inclinaison') {
    await glisser(`${nom}/H`, 200, 0)
    await glisser(`${nom}/V60`, 0, -60)
    await molette(`${nom}/Mt-in`, 2, -100)
    await molette(`${nom}/Mt-out`, 2, 100)
    await glisser(`${nom}/V60r`, 0, 60)
    await molette(`${nom}/Ma-in`, 2, -100)
    await molette(`${nom}/Ma-out`, 2, 100)
  } else {
    await glisser(`${nom}/H`, 200, 0)
    await glisser(`${nom}/V`, 0, -200)
    await molette(`${nom}/Mc-in`, 3, -100)
    await molette(`${nom}/Mc-out`, 3, 100)
    await glisser(`${nom}/Vr`, 0, 200)
    await molette(`${nom}/Ma-in`, 3, -100)
    await molette(`${nom}/Ma-out`, 3, 100)
  }
  await off()
  const fin = await etat()
  const frames = await page.evaluate(() => { const f = window.__R33.frames; window.__R33.frames = []; return f })
  bancs.push({ nom, depart: dep, fin, frames })
  console.log(`  banc ${nom} : ${frames.length} images, alt fond ${Math.round(dep.altFond ?? -1)} m, mode ${dep.mode}, crop ${dep.cropPose}`)
}

// ① l'étalon : l'orbite haute
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 90000 })
await wait(120)
await banc('orbite-60000km')
// ② l'orbite basse, à la molette, juste au-dessus de la porte de plongée
for (let i = 0; i < (SERIE !== 'complete' ? 0 : 400); i++) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: -100, modifiers: 0, pointerType: 'mouse' })
  await wait(4)
  const s = await etat()
  if (s.altCamM <= 13000000 || s.mode !== 'orbital') break
}
await attendreRepos()
await wait(60)
if (SERIE === 'complete') await banc('orbite-basse')
// ③ les trois altitudes de surface, hors crop
for (const alt of ALTITUDES) {
  await descendreVers(alt)
  const s = await etat()
  await banc(`surface-${Math.round(alt / 1000)}km`)
  if (s.cropPose) console.log('  ⚠️ crop posé pendant ce banc')
}

const sortie = {
  etiquette: ETIQ, port: PORT, quand: new Date().toISOString(), W, H, MPU,
  banc: 'sonde au rendu (composer.render), gestes CDP reels, espace globe (camGlobe) et pixels',
  voile, chrono, poseDemarrage, bancs, journal: journal.slice(0, 40),
}
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(sortie))
console.log(`\nécrit : .banc/R33/${ETIQ}.json (${bancs.length} bancs, ${bancs.reduce((s, b) => s + b.frames.length, 0)} images)`)
console.log(`voile : ${JSON.stringify(voile)} · pose de départ : ${JSON.stringify(poseDemarrage)}`)
if (journal.length) { console.log('\n⚠️ CONSOLE :'); journal.slice(0, 12).forEach((l) => console.log('  ' + l)) }
await nav.close()
