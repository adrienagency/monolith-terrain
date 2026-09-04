// SONDE C1 — OÙ EXACTEMENT LE CROP MEURT SOUS LA MOLETTE, ET DANS QUEL ESPACE.
//
// ⛔ **LA QUESTION QUE `sonde-ge3` A OUVERTE SANS POUVOIR LA FERMER.** Le banc
// des gestes relève `altFondM` — l'altitude de la caméra de FOND, en espace
// globe. La loi du crop, elle, lit `altitudeCadrageM()` — l'altitude en espace
// BLOC. Les deux ne sont pas la même grandeur (`main.js` mesure +38,6 % d'écart
// à la sortie d'orbite), et le dézoom de six crans a rendu `altFondM` à
// **759 179 m** — au-dessus de `SEUIL_MORT_M = 750 000` — avec le crop
// **toujours vivant** sur les huit chargements.
//
// ⚠️ **C'EST EXACTEMENT LE PIÈGE « CONFUSION D'ESPACE BLOC / GLOBE » QUE CE
// CHANTIER A DÉJÀ PAYÉ.** On ne conclut donc pas depuis `altFondM` : on relève
// **les deux altitudes à la même image**, cran par cran, et on regarde laquelle
// des deux franchit 750 000 m quand `veilleCrop.pose` retombe.
//
// EMPLOI
//   npm run dev -- --host 127.0.0.1 --port 7341
//   node scripts/sonde-c1-mort.mjs --port 7341 --repete 8
//
// Sortie : `.banc/C1/mort.json`
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'C1')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '7341'))
const N = Number(opt('--repete', '8'))
const ALT = Number(opt('--alt', '576000'))
const CRANS_MAX = Number(opt('--crans', '30'))
const W = 1280, H = 800
const CX = W / 2, CY = H / 2

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
let page = (await nav.pages())[0]
let cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

async function pageNeuve() {
  try { await page.close() } catch {}
  page = await nav.newPage()
  cdp = await page.target().createCDPSession()
}

// ⚠️ **LE VOILE ET LE VOL DE PRÉSENTATION — les deux pièges du brief C1.**
// Échap envoyé trop tôt FIGE le vol où il en est, et la pose tombe alors entre
// 30,7 et 33,6 km, à cheval sur l'ancien seuil. On attend `d` stable ET > 100.
async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
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
    sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY])
    if (sous === 'CANVAS') break
  }
  if (sous !== 'CANVAS') throw new Error(`voile non ferme : ${sous}`)
}

// ⚠️ **LES DEUX ALTITUDES À LA MÊME IMAGE, ET LE DRAPEAU AVEC.**
const lire = () => page.evaluate(() => {
  const e = window.__exp
  const g = e.camGlobe ?? e.camera
  return {
    altFondM: (g.position.length() - 100) * 63710,
    altCadrageM: e.altitudeCadrageM?.() ?? null,
    d: e.camera.position.distanceTo(e.controls.target),
    pose: !!e.veilleCrop?.pose,
    auBloc: !!e.veilleCrop?.auBloc,
    armee: !!e.veilleCrop?.sortieArmee,
    mode: e.modes.mode,
  }
})

const cran = (delta) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: delta, pointerType: 'mouse' })
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

async function porter(altM) {
  await page.evaluate(async (a) => {
    const e = window.__exp
    const cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const v = e.altitudeCadrageM()
      if (!Number.isFinite(v) || v <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (a / v)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
  }, altM)
  await wait(10)
  await dodo(1200)
}

const R = { altViseeM: ALT, passes: [] }
for (let k = 0; k < N; k++) {
  let ok = false
  for (let essai = 0; essai < 3 && !ok; essai++) {
    try { await neuf(); await porter(ALT); ok = true }
    catch (err) { etape(`  chargement rate (${err.message.slice(0, 70)})`); await pageNeuve() }
  }
  if (!ok) throw new Error('trois chargements rates')
  const depart = await lire()
  const crans = []
  let mort = null
  for (let i = 1; i <= CRANS_MAX; i++) {
    await cran(100)
    await wait(8)
    const s = await lire()
    crans.push({ i, ...s })
    if (!s.pose) { mort = { cran: i, ...s }; break }
  }
  R.passes.push({ depart, mort, crans })
  etape(`#${k + 1} depart alt cadrage=${Math.round(depart.altCadrageM)} fond=${Math.round(depart.altFondM)} · mort au cran ${mort?.cran ?? 'JAMAIS'} · cadrage=${mort ? Math.round(mort.altCadrageM) : '-'} fond=${mort ? Math.round(mort.altFondM) : '-'}`)
}
fs.writeFileSync(path.join(ICI, 'mort.json'), JSON.stringify(R, null, 2))
console.log('\n=== .banc/C1/mort.json')
await nav.close()
