// SONDE GE3 — LE BANC DU NOTEUR : sonde-ge1 (même relevé, mêmes champs, pour que
// les tests rouges se relisent tels quels), plus trois RÉGIMES (--regime orbite |
// surface | crop), un |Δ ln d| par image, et les gestes HORS BARÈME du brief GE3.
//   node scripts/sonde-ge3.mjs --port 7311 --regime surface --alt 2000000
//   node scripts/sonde-ge3.mjs --port 7311 --regime crop --lieu -21.1,55.5,12
//   node scripts/sonde-ge3.mjs --port 7311 --regime orbite --alt 24000000
// (SONDE GE1 d'origine :) LE VOCABULAIRE DE LA SOURIS, MESURÉ GESTE PAR GESTE.
//
// N'écrit RIEN dans src/. Relève, pour chaque geste du tableau du brief GE1, ce
// que fait la caméra AU RENDU (rAF posé après `tick`), en grandeurs OBSERVABLES :
//   · lat/lon du point sous la caméra (degrés)          → rotation de la Terre
//   · altitude de fond (m) et rapport d'altitude        → zoom
//   · inclinaison (deg, visée contre la verticale)      → tilt
//   · azimut (deg, cap du nord local à l'écran)         → rotation du nord
//   · centre de la Terre projeté à l'écran (px)         → D19 §1
//   · point saisi projeté vs pointeur (px)              → « on attrape la Terre »
//   · point qui était AU CENTRE au début du zoom (px)   → D19 §2 (centre)
//   · point qui était SOUS LE CURSEUR au début (px)     → Google Earth (curseur)
//
// ⛔ DEUX PIÈGES PAYÉS ICI, ET C'EST POURQUOI LA PAGE EST RECHARGÉE :
//  ① **Échap envoyé trop tôt fige le vol de présentation en cours** : la sonde
//     mesurait alors depuis 9,8 km au lieu de 36,7 km. Le vol se termine à
//     3,1 s après `#loading` (d : 26,7 → 68,5 → 132,3 → 145,5). On attend donc
//     `d` STABLE **et** `d > 100` avant de fermer le voile.
//  ② **Les gestes se contaminent** : une première passe a enchaîné les quinze
//     gestes dans la même page et a fini à −385 m d'altitude, sous la mer. Un
//     geste = un chargement de page.
//
//   node scripts/sonde-ge1.mjs --port 6771
//
// Sortie : `.banc/GE1/mesures.json`
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'GE3')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '6771'))
const SEUL = opt('--geste', null)
const SEULS = (opt('--gestes', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const REGIME = opt('--regime', 'surface')
const LIEU = opt('--lieu', '-21.1,55.5,12').split(',').map(Number)
const SORTIE = opt('--sortie', null)
const W = 1280, H = 800
const CX = W / 2, CY = H / 2
const OFF = [CX + 200, CY - 120] // le point « hors centre » : curseur ≠ centre

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
let page = (await nav.pages())[0]
let cdp = await page.target().createCDPSession()
// ⚠️ Un cadre perdu (« detached Frame ») ne revient jamais : on ouvre un ONGLET NEUF
// et une session CDP neuve, sinon chaque retentative rejoue la même erreur.
async function pageNeuve() {
  try { await page.close() } catch {}
  page = await nav.newPage()
  cdp = await page.target().createCDPSession()
}
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

// ══════════ LE CHARGEMENT PROPRE — une page neuve, la pose de démarrage ═══
async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  // ① le vol de présentation doit être FINI : d > 100 et immobile 1,5 s
  await page.waitForFunction(() => {
    const e = window.__exp
    const d = e.camera.position.distanceTo(e.controls.target)
    const R = (window.__stab ??= { d: NaN, t: 0 })
    if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
    return d > 100 && !e.modes.busy && performance.now() - R.t > 1500
  }, { timeout: 60000, polling: 100 })
  let sous = null
  for (let k = 0; k < 10; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
    sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
    if (sous === 'CANVAS') break
  }
  if (sous !== 'CANVAS') throw new Error(`voile non ferme : elementFromPoint rend ${sous}`)
  await enregistreur()
  await reposer()
  return page.evaluate(() => {
    const e = window.__exp
    const g = e.camGlobe ?? e.camera
    return { mode: e.modes.mode, d: +e.camera.position.distanceTo(e.controls.target).toFixed(3), altFondM: Math.round((g.position.length() - 100) * 63710) }
  })
}

async function enregistreur() {
  await page.evaluate(() => {
    const e = window.__exp
    const c = e.controls, cam = e.camera
    const V3 = cam.position.constructor
    const R_GLOBE = 100, MPU = 6371000 / 100
    const R = (window.__GE = { on: false, frames: [], pointer: null, saisi: null, centre0: null, curseur0: null, menu: 0, defaut: null, defautBulle: null })
    const gcam = () => e.camGlobe ?? cam
    const bb = () => e.renderer.domElement.getBoundingClientRect()
    const proj = (camera, x, y, z) => {
      const v = new V3(x, y, z); v.project(camera)
      const r = bb()
      return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height, v.z]
    }
    const latLon = (p) => { const r = p.length(); return { lat: Math.asin(p.y / r) * 180 / Math.PI, lon: Math.atan2(p.x, p.z) * 180 / Math.PI } }
    const sphereSous = (px, py) => {
      const camera = gcam(), r = bb()
      const nx = (px / r.width) * 2 - 1, ny = -((py / r.height) * 2 - 1)
      const o = camera.position.clone()
      const d = new V3(nx, ny, 0.5).unproject(camera).sub(o).normalize()
      const b = o.dot(d), cc = o.dot(o) - R_GLOBE * R_GLOBE
      const disc = b * b - cc
      if (disc < 0) return null
      const t = -b - Math.sqrt(disc)
      if (t < 0) return null
      return o.clone().addScaledVector(d, t).normalize()
    }
    R.saisir = (px, py) => { R.saisi = sphereSous(px, py); return !!R.saisi }
    R.saisirCentre = () => { R.centre0 = sphereSous(bb().width / 2, bb().height / 2); return !!R.centre0 }
    R.saisirCurseur = (px, py) => { R.curseur0 = sphereSous(px, py); return !!R.curseur0 }
    const pxDe = (u) => u ? (() => { const p = proj(gcam(), u.x * R_GLOBE, u.y * R_GLOBE, u.z * R_GLOBE); return [p[0], p[1]] })() : null
    // ⚠️ GE1 lisait `defaultPrevented` en phase de CAPTURE sur `document`, donc AVANT
    // le gestionnaire posé sur le canvas : il lisait toujours `false`. On garde ce
    // relevé (`defaut`) et on ajoute la lecture en phase de BULLE sur `window`,
    // qui passe APRÈS le canvas : c'est elle qui dit si le menu s'ouvre.
    document.addEventListener('contextmenu', (ev) => { R.menu++; R.defaut = ev.defaultPrevented }, true)
    window.addEventListener('contextmenu', (ev) => { R.defautBulle = ev.defaultPrevented }, false)
    const tick = () => {
      if (R.on) {
        const camera = gcam()
        const fwd = new V3(0, 0, -1).applyQuaternion(camera.quaternion)
        const bas = camera.position.clone().negate().normalize()
        const tilt = Math.acos(Math.max(-1, Math.min(1, fwd.dot(bas)))) * 180 / Math.PI
        const sl = latLon(camera.position)
        const up = camera.position.clone().normalize()
        const nord = new V3(0, 1, 0).addScaledVector(up, -up.y).normalize()
        const droite = new V3(1, 0, 0).applyQuaternion(camera.quaternion)
        const haut = new V3(0, 1, 0).applyQuaternion(camera.quaternion)
        const azimut = Math.atan2(nord.dot(droite), nord.dot(haut)) * 180 / Math.PI
        const pT = proj(camera, 0, 0, 0)
        R.frames.push({
          now: performance.now(), mode: e.modes.mode, busy: !!e.modes.busy,
          altFondM: (camera.position.length() - R_GLOBE) * MPU,
          d: cam.position.distanceTo(c.target), lnd: Math.log(c.getDistance()), cropPose: !!(e.veilleCrop?.pose), horsDuCrop: !!e.modes.hooks?.horsDuCrop?.(), refus: e.gestesTerre?.refus ?? null,
          lat: sl.lat, lon: sl.lon, tilt, azimut,
          pxTerre: [pT[0], pT[1]],
          pointer: R.pointer ? [R.pointer[0], R.pointer[1]] : null,
          pxSaisi: pxDe(R.saisi), pxCentre0: pxDe(R.centre0), pxCurseur0: pxDe(R.curseur0),
        })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

const on = () => page.evaluate(() => { const R = window.__GE; R.frames.length = 0; R.on = true })
const off = () => page.evaluate(() => { window.__GE.on = false })
const lire = () => page.evaluate(() => window.__GE.frames.map((f) => f))
async function reposer() {
  await page.waitForFunction(
    '(window.__exp.modes.mode === "orbital" ? Math.abs(window.__exp.modes.orbAlt - window.__exp.modes.orbAltTarget) < window.__exp.modes.orbAltTarget * 0.002 : window.__exp.modes._zoomVel === 0) && !window.__exp.modes.busy && !window.__exp.modes._fonduPose',
    { timeout: 30000, polling: 'raf' },
  ).catch(() => etape('  (reposer : delai depasse)'))
  await page.waitForFunction(() => {
    const c = window.__exp.controls, sd = c._sphericalDelta
    const el = window.__exp.saisieTerre?.elan
    return (!sd || Math.hypot(sd.theta, sd.phi) < 2e-4) && (!el || Math.hypot(el.dLat, el.dLon) < 1e-6)
  }, { timeout: 15000, polling: 'raf' }).catch(() => etape('  (elan residuel)'))
  await wait(6)
}

const BTN = { left: 1, middle: 4, right: 2 }
const souris = (type, x, y, button, buttons, extra = {}) =>
  cdp.send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1, pointerType: 'mouse', ...extra })
const cran = (delta, x = CX, y = CY, modifiers = 0) =>
  cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: delta, modifiers, pointerType: 'mouse' })

async function glisse({ button = 'left', dx = 0, dy = 0, modifiers = 0, pas = 5, depuis = [CX, CY], apresMs = 0 }) {
  const [x0, y0] = depuis
  const bts = BTN[button]
  await page.evaluate(([x, y]) => { const R = window.__GE; R.pointer = [x, y]; R.saisir(x, y); R.saisirCentre(); R.saisirCurseur(x, y) }, [x0, y0])
  await on()
  await wait(2)
  await souris('mousePressed', x0, y0, button, bts, { modifiers })
  await wait(2)
  const n = Math.max(1, Math.round(Math.hypot(dx, dy) / pas))
  for (let i = 1; i <= n; i++) {
    const x = x0 + dx * i / n, y = y0 + dy * i / n
    await page.evaluate(([px, py]) => { window.__GE.pointer = [px, py] }, [x, y])
    await souris('mouseMoved', x, y, 'none', bts, { modifiers })
    await wait(1)
  }
  await souris('mouseReleased', x0 + dx, y0 + dy, button, 0, { modifiers })
  await page.evaluate(() => { window.__GE.pointer = null })
  if (apresMs) await dodo(apresMs); else await wait(4)
  const f = await lire(); await off()
  return f
}

// ══════════ LE RÉSUMÉ — que des grandeurs observables ═════════════════════
const resume = (f) => {
  if (!f.length) return { images: 0 }
  const a = f[0], z = f[f.length - 1]
  const dpx = (k) => (a[k] && z[k]) ? +Math.hypot(z[k][0] - a[k][0], z[k][1] - a[k][1]).toFixed(2) : null
  let saisiVsPointeur = null
  for (let i = f.length - 1; i >= 0; i--) { const x = f[i]; if (x.pointer && x.pxSaisi) { saisiVsPointeur = +Math.hypot(x.pxSaisi[0] - x.pointer[0], x.pxSaisi[1] - x.pointer[1]).toFixed(2); break } }
  let pire = 1, pireAlt = 1
  for (let i = 1; i < f.length; i++) { const r = (f[i].altFondM + 6371000) / (f[i - 1].altFondM + 6371000); if (Number.isFinite(r) && r > 0) pireAlt = Math.max(pireAlt, r, 1 / r) }
  for (let i = 1; i < f.length; i++) {
    const r = f[i].d / f[i - 1].d
    if (Number.isFinite(r) && r > 0) pire = Math.max(pire, r, 1 / r)
  }
  let lndMax = 0
  for (let i = 1; i < f.length; i++) if (f[i].mode === f[i - 1].mode && Number.isFinite(f[i].lnd) && Number.isFinite(f[i - 1].lnd)) lndMax = Math.max(lndMax, Math.abs(f[i].lnd - f[i - 1].lnd))
  const dLon = ((z.lon - a.lon + 540) % 360) - 180
  // déplacement angulaire total du point sous la caméra (grand cercle, degrés)
  const rad = Math.PI / 180
  const gc = Math.acos(Math.max(-1, Math.min(1,
    Math.sin(a.lat * rad) * Math.sin(z.lat * rad) + Math.cos(a.lat * rad) * Math.cos(z.lat * rad) * Math.cos(dLon * rad)))) / rad
  return {
    images: f.length,
    dLatDeg: +(z.lat - a.lat).toFixed(4), dLonDeg: +dLon.toFixed(4), rotationDeg: +gc.toFixed(4),
    dTiltDeg: +(z.tilt - a.tilt).toFixed(3), dAzimutDeg: +(((z.azimut - a.azimut + 540) % 360) - 180).toFixed(3),
    altDebutM: Math.round(a.altFondM), altFinM: Math.round(z.altFondM),
    rapportDistance: +(a.d / z.d).toFixed(4), pireRapportImage: +pire.toFixed(4), rapportAlt: +((a.altFondM) / (z.altFondM)).toFixed(4), pireRapportAlt: +pireAlt.toFixed(4),
    terreDerivePx: dpx('pxTerre'),
    saisiVsPointeurPx: saisiVsPointeur,
    centre0DerivePx: dpx('pxCentre0'), curseur0DerivePx: dpx('pxCurseur0'),
    mode: `${a.mode}→${z.mode}`, deltaLndMax: +lndMax.toExponential(2), cropPose: `${a.cropPose}→${z.cropPose}`, horsDuCrop: `${a.horsDuCrop}→${z.horsDuCrop}`, tiltDebutDeg: +a.tilt.toFixed(3), refus: `${a.refus}→${z.refus}`,
  }
}

// un glissé gauche relâché à un point donné (hors toile ou sur l'interface), puis
// des mouvements SANS bouton : la Terre ne doit plus suivre.
async function relacheA([xr, yr]) {
  await page.evaluate(([x, y]) => { const R = window.__GE; R.pointer = [x, y]; R.saisir(x, y); R.saisirCentre() }, [CX, CY])
  await on(); await wait(2)
  await souris('mousePressed', CX, CY, 'left', 1)
  for (let i = 1; i <= 30; i++) { const x = CX + (xr - CX) * i / 30, y = CY + (yr - CY) * i / 30; await page.evaluate(([px, py]) => { window.__GE.pointer = [px, py] }, [x, y]); await souris('mouseMoved', x, y, 'none', 1); await wait(1) }
  await souris('mouseReleased', xr, yr, 'left', 0)
  await page.evaluate(() => { window.__GE.pointer = null })
  await dodo(1500)
  const sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [xr, yr])
  const avant = await page.evaluate(() => { const f = window.__GE.frames; return f[f.length - 1] })
  for (let i = 1; i <= 20; i++) { await souris('mouseMoved', CX + 10 * i, CY + 5 * i, 'none', 0); await wait(1) }
  await wait(4)
  const f = await lire(); await off()
  const z = f[f.length - 1]
  f.horsToile = { relacheSur: sous, rotApresRelacheDeg: +Math.hypot(z.lat - avant.lat, ((z.lon - avant.lon + 540) % 360) - 180).toFixed(4), saisieActive: await page.evaluate(() => !!window.__exp.saisieTerre.active) }
  return f
}
// ══════════ LES GESTES ════════════════════════════════════════════════════
const GESTES = {
  // ⚠️ **LE TÉMOIN : AUCUN GESTE.** Le socle prévient que « le globe tourne seul
  // à ~2 °/s après 3 s ». Sans ce témoin, toute rotation mesurée sur un glissé
  // horizontal est un mélange du geste et de la dérive.
  'temoin-sans-geste': async () => {
    await on(); await page.evaluate(() => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(640, 400) })
    await wait(90)
    const f = await lire(); await off(); return f
  },
  'temoin-sans-geste-long': async () => {
    await on(); await page.evaluate(() => { const R = window.__GE; R.saisirCentre() })
    await dodo(5000)
    const f = await lire(); await off(); return f
  },
  'gauche-glisse-H-50px': () => glisse({ dx: 50 }),
  'gauche-glisse-H-100px': () => glisse({ dx: 100 }),
  'gauche-glisse-H': () => glisse({ dx: 200 }),
  'gauche-glisse-V': () => glisse({ dy: -200 }),
  'gauche-elan': () => glisse({ dx: 200, apresMs: 2000 }),
  'droit-glisse-V-haut': () => glisse({ button: 'right', dy: -200 }),
  'droit-glisse-V-bas': () => glisse({ button: 'right', dy: 200 }),
  'droit-glisse-H': () => glisse({ button: 'right', dx: 200 }),
  'milieu-glisse-H': () => glisse({ button: 'middle', dx: 200 }),
  'milieu-glisse-V': () => glisse({ button: 'middle', dy: -200 }),
  'maj-gauche-glisse': () => glisse({ dx: 200, modifiers: 8 }),
  'ctrl-gauche-glisse-V': () => glisse({ dy: -200, modifiers: 2 }),
  'alt-gauche-glisse-V': () => glisse({ dy: -200, modifiers: 1 }),
  'molette-avant-6crans': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    for (let k = 0; k < 6; k++) { await cran(-100, OFF[0], OFF[1]); await wait(5) }
    await reposer()
    const f = await lire(); await off(); return f
  },
  'molette-arriere-6crans': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    for (let k = 0; k < 6; k++) { await cran(100, OFF[0], OFF[1]); await wait(5) }
    await reposer()
    const f = await lire(); await off(); return f
  },
  'molette-1cran': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    await cran(-100, OFF[0], OFF[1])
    await reposer()
    const f = await lire(); await off(); return f
  },
  'maj-molette': async () => {
    await page.evaluate(() => { window.__GE.saisirCentre() })
    await on(); await wait(2)
    for (let k = 0; k < 6; k++) { await cran(-100, CX, CY, 8); await wait(5) }
    await reposer()
    const f = await lire(); await off(); return f
  },
  'clic-simple': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    await souris('mousePressed', OFF[0], OFF[1], 'left', 1)
    await souris('mouseReleased', OFF[0], OFF[1], 'left', 0)
    await dodo(4000)
    const f = await lire(); await off(); return f
  },
  'double-clic-gauche': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    await souris('mousePressed', OFF[0], OFF[1], 'left', 1, { clickCount: 1 })
    await souris('mouseReleased', OFF[0], OFF[1], 'left', 0, { clickCount: 1 })
    await dodo(60)
    await souris('mousePressed', OFF[0], OFF[1], 'left', 1, { clickCount: 2 })
    await souris('mouseReleased', OFF[0], OFF[1], 'left', 0, { clickCount: 2 })
    await dodo(4000)
    const f = await lire(); await off(); return f
  },
  'double-clic-droit': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    for (let n = 1; n <= 2; n++) {
      await souris('mousePressed', OFF[0], OFF[1], 'right', 2, { clickCount: n })
      await souris('mouseReleased', OFF[0], OFF[1], 'right', 0, { clickCount: n })
      await dodo(60)
    }
    await dodo(3000)
    const f = await lire(); await off(); return f
  },
  'menu-contextuel': async () => {
    await on(); await wait(2)
    await souris('mousePressed', OFF[0], OFF[1], 'right', 2)
    await souris('mouseReleased', OFF[0], OFF[1], 'right', 0)
    await dodo(500)
    const f = await lire(); await off(); return f
  },
  // ══════════ HORS BARÈME (brief GE3) ═══════════════════════════════════
  'gauche-glisse-diag': () => glisse({ dx: 140, dy: -140 }),
  'droit-glisse-diag': () => glisse({ button: 'right', dx: 140, dy: -140 }),
  'ctrl-glisse-H': () => glisse({ dx: 200, modifiers: 2 }),
  'maj-glisse-V': () => glisse({ dy: -200, modifiers: 8 }),
  'ctrl-molette': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, OFF)
    await on(); await wait(2)
    for (let k = 0; k < 6; k++) { await cran(-100, OFF[0], OFF[1], 2); await wait(5) }
    await reposer()
    const f = await lire(); await off(); return f
  },
  'relache-hors-toile': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.pointer = [x, y]; R.saisir(x, y); R.saisirCentre() }, [CX, CY])
    await on(); await wait(2)
    await souris('mousePressed', CX, CY, 'left', 1)
    for (let i = 1; i <= 30; i++) { const x = CX - (CX + 40) * i / 30; await page.evaluate(([px, py]) => { window.__GE.pointer = [px, py] }, [x, CY]); await souris('mouseMoved', x, CY, 'none', 1); await wait(1) }
    await souris('mouseReleased', -40, CY, 'left', 0)
    await page.evaluate(() => { window.__GE.pointer = null })
    await dodo(1500)
    const avant = await page.evaluate(() => { const f = window.__GE.frames; return f[f.length - 1] })
    for (let i = 1; i <= 20; i++) { await souris('mouseMoved', CX + 10 * i, CY + 5 * i, 'none', 0); await wait(1) }
    await wait(4)
    const f = await lire(); await off()
    const z = f[f.length - 1]
    f.horsToile = { rotApresRelacheDeg: +Math.hypot(z.lat - avant.lat, ((z.lon - avant.lon + 540) % 360) - 180).toFixed(4), saisieActive: await page.evaluate(() => !!window.__exp.saisieTerre.active) }
    return f
  },
  'relache-coin-fenetre': () => relacheA([1279, 799]),
  'relache-sur-ui': () => relacheA([5, 5]),
  'droit-pendant-elan': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.pointer = [x, y]; R.saisir(x, y); R.saisirCentre() }, [CX, CY])
    await on(); await wait(2)
    await souris('mousePressed', CX, CY, 'left', 1)
    for (let i = 1; i <= 8; i++) { await souris('mouseMoved', CX + 25 * i, CY, 'none', 1); await wait(1) }
    await souris('mouseReleased', CX + 200, CY, 'left', 0)
    await page.evaluate(() => { window.__GE.pointer = null })
    const elan = await page.evaluate(() => ({ ...window.__exp.saisieTerre.elan }))
    await wait(2)
    await souris('mousePressed', CX, CY, 'right', 2)
    for (let i = 1; i <= 20; i++) { await souris('mouseMoved', CX, CY - 10 * i, 'none', 2); await wait(1) }
    await souris('mouseReleased', CX, CY - 200, 'right', 0)
    const elanApres = await page.evaluate(() => ({ ...window.__exp.saisieTerre.elan }))
    await dodo(2500)
    const f = await lire(); await off()
    f.elanArme = { avantDroit: elan, apresDroit: elanApres }
    return f
  },
  'double-clic-gauche-centre': async () => {
    await page.evaluate(([x, y]) => { const R = window.__GE; R.saisirCentre(); R.saisirCurseur(x, y) }, [CX, CY])
    await on(); await wait(2)
    for (const n of [1, 2]) { await souris('mousePressed', CX, CY, 'left', 1, { clickCount: n }); await souris('mouseReleased', CX, CY, 'left', 0, { clickCount: n }); await dodo(60) }
    await dodo(4000)
    const f = await lire(); await off(); return f
  },
}

// ⛔ **LA POSE DE DÉMARRAGE EST À 30,7–33,6 km SELON LE CHARGEMENT, ET
// `SEUIL_NAISSANCE_M` VAUT 32 274,3 m** : mesurer là, c'est mesurer à cheval
// sur la naissance du crop — deux gestes voisins ne tombent pas dans le même
// régime. On PORTE donc la caméra à une altitude franche avant chaque geste.
async function porterRegime(altM) {
  if (REGIME === 'surface') return porterA(altM)
  if (REGIME === 'orbite') {
    await page.evaluate((a) => window.__exp.modes.enterOrbit(a), altM)
    await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 60000, polling: 200 }).catch(() => etape('  (orbite : delai)'))
    await reposer()
    return page.evaluate(() => (window.__exp.camera.position.length() - 100) * 63710)
  }
  if (REGIME === 'crop') {
    const [lat, lon, z] = LIEU
    await page.evaluate(([a, b, c]) => { Promise.resolve(window.__exp.modes.flyTo(a, b, c)).catch(() => {}) }, [lat, lon, z])
    await dodo(1500)
    await page.waitForFunction(() => { const e = window.__exp; return !(e.modes.busy || e.modes.travel || e.modes._diveTween || e.tween.active) }, { timeout: 120000, polling: 300 }).catch(() => etape('  (vol : delai)'))
    await page.waitForFunction(() => !window.__exp.modes.hooks?.horsDuCrop?.(), { timeout: 60000, polling: 300 }).catch(() => etape('  (crop non pose)'))
    // ⚠️ L'ARRIVÉE SUR LE BLOC ANIME ENCORE (la pente d'arrivée de D16 ter) : le
    // témoin d'une première passe rendait +20,3° d'inclinaison et ×0,77 d'altitude
    // SANS geste. On attend l'inclinaison ET l'altitude stables 2,4 s de suite.
    let stable = 0, prev = null
    for (let i = 0; i < 300 && stable < 6; i++) {
      const s = await page.evaluate(() => { const e = window.__exp; const g = e.camGlobe ?? e.camera; return { t: e.inclinaisonCouranteDeg?.() ?? 0, a: (g.position.length() - 100) * 63710, r: !!e.modes.hooks?.arriveeSurLeBloc?.() } })
      if (prev && Math.abs(s.t - prev.t) < 0.005 && Math.abs(s.a - prev.a) < 0.5) stable++; else stable = 0
      prev = s
      await dodo(400)
    }
    etape(`  crop stable : ${JSON.stringify(prev)} (${stable}/6)`)
    await reposer(); await dodo(500)
    return page.evaluate(() => { const g = window.__exp.camGlobe ?? window.__exp.camera; return (g.position.length() - 100) * 63710 })
  }
  throw new Error('regime inconnu ' + REGIME)
}
async function porterA(altM) {
  const lire1 = () => page.evaluate(() => {
    const e = window.__exp; const g = e.camGlobe ?? e.camera
    return { alt: (g.position.length() - 100) * 63710, busy: !!e.modes.busy }
  })
  for (let i = 0; i < 400; i++) {
    const s = await lire1()
    if (Math.abs(Math.log(s.alt / altM)) < 0.12) break
    await cran(s.alt < altM ? 100 : -100, CX, CY)
    await wait(3)
  }
  await reposer()
  return (await lire1()).alt
}

const ALT_M = Number(opt('--alt', '2000000'))
const R = { pose: null, altViseeM: ALT_M, gestes: {} }
for (const [nom, faire] of Object.entries(GESTES)) {
  if (SEUL && nom !== SEUL) continue
  if (SEULS.length && !SEULS.includes(nom)) continue
  let pose = null
  for (let essai = 0; essai < 3 && !pose; essai++) {
    try { pose = await neuf(); pose.altPorteeM = Math.round(await porterRegime(ALT_M)) }
    catch (err) { etape(`  chargement rate (${err.message.slice(0, 80)}), onglet neuf`); pose = null; await pageNeuve() }
  }
  if (!pose) throw new Error('trois chargements rates')
  pose.regime = await page.evaluate(() => ({ regimeGeste: window.__exp.regimeGeste?.() ?? null, horsDuCrop: !!window.__exp.modes.hooks?.horsDuCrop?.(), surLeBloc: !!window.__exp.modes.hooks?.surLeBloc?.(), tiltDeg: window.__exp.inclinaisonCouranteDeg?.() ?? null, mouseButtons: { ...window.__exp.controls.mouseButtons }, enableRotate: window.__exp.controls.enableRotate, enablePan: window.__exp.controls.enablePan }))
  etape(`pose ${JSON.stringify(pose)}`)
  if (!R.pose) R.pose = pose
  // ⚠️ Chrome sans tête perd parfois son cadre en plein geste (« detached Frame »,
  // ~1 chargement sur 10) : on recharge et on rejoue CE geste, seul.
  let f = null
  for (let essai = 0; essai < 3 && !f; essai++) {
    try { f = await faire() } catch (err) { etape(`  geste rate (${err.message.slice(0, 60)}), onglet neuf`); f = null; await pageNeuve(); try { await neuf(); await porterRegime(ALT_M) } catch {} }
  }
  if (!f) throw new Error('geste rate trois fois : ' + nom)
  const s = resume(f)
  if (nom === 'gauche-elan') {
    let iRel = 0; for (let i = 0; i < f.length; i++) if (f[i].pointer) iRel = i
    const ap = f.slice(iRel)
    const rad = Math.PI / 180
    const gcAp = ap.length > 1 ? Math.acos(Math.max(-1, Math.min(1,
      Math.sin(ap[0].lat * rad) * Math.sin(ap[ap.length - 1].lat * rad) +
      Math.cos(ap[0].lat * rad) * Math.cos(ap[ap.length - 1].lat * rad) *
      Math.cos((ap[ap.length - 1].lon - ap[0].lon) * rad)))) / rad : 0
    let pas0 = 0, dureeMs = 0
    for (let i = 1; i < ap.length; i++) {
      const p = Math.hypot(ap[i].lat - ap[i - 1].lat, ((ap[i].lon - ap[i - 1].lon + 540) % 360) - 180)
      if (i === 1) pas0 = p
      if (pas0 > 0 && p > pas0 * 0.02) dureeMs = ap[i].now - ap[0].now
    }
    s.elanDeg = +gcAp.toFixed(4)
    s.elanDureeMs = Math.round(dureeMs)
  }
  if (f.horsToile) s.horsToile = f.horsToile
  if (f.elanArme) s.elanArme = f.elanArme
  if (nom.startsWith('menu-contextuel')) s.menu = await page.evaluate(() => ({ evenements: window.__GE.menu, defaultPrevented: window.__GE.defautBulle, captureAvantCanvas: window.__GE.defaut }))
  const N = Number(opt('--repete', '1'))
  if (N > 1) {
    R.gestes[nom] = [s]
    for (let k = 1; k < N; k++) {
      for (let essai = 0; essai < 3; essai++) { try { await neuf(); await porterRegime(ALT_M); break } catch (err) { etape(`  chargement rate (${err.message.slice(0, 80)})`); await pageNeuve() } }
      let f2 = null
      for (let essai = 0; essai < 3 && !f2; essai++) { try { f2 = await faire() } catch (err) { etape(`  geste rate (${err.message.slice(0, 60)})`); f2 = null; await pageNeuve(); try { await neuf(); await porterRegime(ALT_M) } catch {} } }
      const s2 = resume(f2 || [])
      R.gestes[nom].push(s2)
      etape(`${nom} #${k + 1} saisi=${s2.saisiVsPointeurPx} px rot=${s2.rotationDeg}deg centre0=${s2.centre0DerivePx} px`)
    }
    etape(`${nom} : ${N} passes, saisiVsPointeurPx = ${R.gestes[nom].map((x) => x.saisiVsPointeurPx).join(' · ')}`)
    continue
  }
  R.gestes[nom] = s
  etape(`${nom.padEnd(24)} ${JSON.stringify(s)}`)
}
R.reglages = await page.evaluate(() => {
  const c = window.__exp.controls
  return {
    mouseButtons: { LEFT: c.mouseButtons.LEFT, MIDDLE: c.mouseButtons.MIDDLE, RIGHT: c.mouseButtons.RIGHT },
    NOMS: 'THREE.MOUSE: 0=ROTATE 1=DOLLY 2=PAN',
    enableZoom: c.enableZoom, enablePan: c.enablePan, enableRotate: c.enableRotate,
    enableDamping: c.enableDamping, dampingFactor: c.dampingFactor,
  }
})
fs.writeFileSync(SORTIE || path.join(ICI, `mesures-${REGIME}-${Math.round(ALT_M/1000)}km.json`), JSON.stringify(R, null, 2))
console.log('\n=== .banc/GE1/mesures.json')
console.log(JSON.stringify(R.reglages, null, 2))
await nav.close()
