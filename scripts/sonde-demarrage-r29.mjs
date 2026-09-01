// SONDE R29 bis — LA MOLETTE DEPUIS L'ÉTAT DE DÉMARRAGE, ET QUI MANGE LE CRAN.
//
// ══════════ POURQUOI CETTE SONDE EXISTE ═══════════════════════════════════
//
// ⛔ **`sonde-sortie-r29.mjs` PART D'UN ÉTAT QU'ELLE A FABRIQUÉ** : elle monte
// en orbite à 60 000 km puis redescend au cran. Le coordinateur a relevé que
// la molette, **depuis le chargement neuf** (Échap, puis molette, rien d'autre),
// ne sort PAS du crop : `d` part de **145,5**, colle à **150,0**, et 100 crans
// ne donnent que **+544 m**. Il y a donc DEUX chemins de molette et un seul
// était mesuré.
//
// ⚠️ **ON NE LIT PAS LE CODE, ON COMPTE LES APPELS.** Chaque maillon de la
// chaîne du cran porte son compteur, posé sur la FONCTION elle-même :
//
//   wheel(DOM) → _zoomGesture → followWheel? → cadrageWheel? → _zoomVel
//              → _applyZoom → _franchirSiBesoin → _coarsen / enterOrbit
//
// Un maillon qui reçoit N et rend N−k a mangé k crans, et on sait lequel.
//
//   node scripts/sonde-demarrage-r29.mjs --port 5843 --etiquette avant
//
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R29')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5843'))
const ETIQ = opt('--etiquette', 'avant')
const CRANS = Number(opt('--crans', '100'))
const W = 1280, H = 800

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

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 90000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })

// ⛔ **UNE SEULE TOUCHE ÉCHAP, ET RIEN D'AUTRE.** Pas de `remove()` sur le
// voile : c'est le geste d'Adrien qu'on rejoue, pas un état fabriqué.
await page.keyboard.press('Escape').catch(() => {})
await wait(90)
await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 }).catch(() => {})
await wait(150) // laisser le chargement du bloc et la pose d'arrivée finir

// ══════════ LES COMPTEURS, UN PAR MAILLON ═════════════════════════════════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera, m = e.modes
  window.__R29B = {
    on: false, frames: [],
    n: { wheelDom: 0, zoomGesture: 0, followVrai: 0, cadrageVrai: 0, sortiePrecoce: 0, velNourri: 0, applyZoom: 0, franchir: 0, franchirBloque: 0, coarsen: 0, refine: 0, orbit: 0 },
    blocages: {},
  }
  const N = window.__R29B.n
  // ① l'événement DOM lui-même, avant tout code de l'appli
  window.addEventListener('wheel', () => { N.wheelDom++ }, { capture: true, passive: true })
  // ② le gestionnaire de l'appli
  const zg = m._zoomGesture.bind(m)
  m._zoomGesture = (ev) => { N.zoomGesture++; const v0 = m._zoomVel; const r = zg(ev); if (m._zoomVel !== v0) N.velNourri++; return r }
  // ③ les deux hooks qui peuvent AVALER le cran avant tout le reste
  const fw = m.hooks.followWheel
  if (fw) m.hooks.followWheel = (d) => { const r = fw(d); if (r) N.followVrai++; return r }
  const cw = m.hooks.cadrageWheel
  if (cw) m.hooks.cadrageWheel = (d) => { const r = cw(d); if (r) N.cadrageVrai++; return r }
  // ④ le glissé et le franchissement
  const az = m._applyZoom.bind(m)
  m._applyZoom = (dt) => { N.applyZoom++; return az(dt) }
  const fr = m._franchirSiBesoin.bind(m)
  m._franchirSiBesoin = () => {
    N.franchir++
    // ⚠️ LA GARDE QUI A REFUSÉ, NOMMÉE — pas « il n'a rien fait ».
    const g = !m._continu() ? 'pasContinu' : m.busy ? 'busy' : m.travel ? 'travel'
      : m._diveTween ? 'diveTween' : m._fonduPose ? 'fonduPose' : null
    if (g) { N.franchirBloque++; window.__R29B.blocages[g] = (window.__R29B.blocages[g] || 0) + 1 }
    return fr()
  }
  for (const [nom, cle] of [['_coarsen', 'coarsen'], ['_refine', 'refine'], ['enterOrbit', 'orbit']]) {
    const f = m[nom].bind(m)
    m[nom] = (...a) => { N[cle]++; return f(...a) }
  }
  // ⑤ le relevé DANS la boucle
  const orig = c.update.bind(c)
  c.update = (...a) => {
    const r = orig(...a)
    const R = window.__R29B
    if (R.on) {
      const g = e.globe
      R.frames.push({
        t: R.frames.length, mode: m.mode, busy: !!m.busy,
        altM: e.altitudeCadrageM(), emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
        crop: !!(g && g._crop), niveau: m.zoomNiveau(), vel: m._zoomVel,
        d: cam.position.distanceTo(c.target), dmax: c.maxDistance, dmin: c.minDistance,
        tx: c.target.x, ty: c.target.y, tz: c.target.z,
        phi: c.getPolarAngle(), zoom: e.params?.demZoom ?? null,
        cadrage: !!window.__exp.__cadrageActif?.(),
      })
    }
    return r
  }
})

const etat = () => page.evaluate(() => {
  const e = window.__exp, c = e.controls, m = e.modes
  return {
    mode: m.mode, busy: !!m.busy, altM: e.altitudeCadrageM(),
    emprise: m.hooks.empriseBlocM ? m.hooks.empriseBlocM() : null,
    crop: !!(e.globe && e.globe._crop), niveau: m.zoomNiveau(), vel: m._zoomVel,
    d: e.camera.position.distanceTo(c.target), dmax: c.maxDistance, dmin: c.minDistance,
    phi: c.getPolarAngle(), zoom: e.params?.demZoom ?? null,
    continu: m._continu(), locked: !!m.locked,
    coarsenTarget: !!m.hooks.getCoarsenTarget?.(), refineTarget: !!m.hooks.getRefineTarget?.(),
    axe: Math.hypot(c.target.x, c.target.z),
    n: { ...window.__R29B.n }, blocages: { ...window.__R29B.blocages },
  }
})

const depart = await etat()
await page.evaluate(() => { window.__R29B.on = true })

// ── LES CRANS, EN RAFALES DE 25 COMME LE COORDINATEUR ─────────────────────
const table = [{ cran: 0, ...depart }]
let orbiteA = null
for (let k = 1; k <= CRANS; k++) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: 100, modifiers: 0, pointerType: 'mouse',
  })
  await wait(4)
  const s = await etat()
  table.push({ cran: k, ...s })
  if (s.mode === 'orbital') { orbiteA = k; break }
  if (k % 25 === 0) await wait(45) // le creux entre deux rafales
}
await wait(120)
await page.evaluate(() => { window.__R29B.on = false })
const fin = await etat()
const frames = await page.evaluate(() => window.__R29B.frames)

let bascule = null
for (let i = 1; i < frames.length; i++) if (frames[i - 1].crop && !frames[i].crop) { bascule = i; break }

const out = {
  etiquette: ETIQ, port: PORT, quand: new Date().toISOString(),
  banc: 'chargement neuf, UNE touche Echap, puis molette reelle — rien d autre',
  depart, fin, table, orbiteA, bascule,
  autour: bascule == null ? [] : frames.slice(Math.max(0, bascule - 4), bascule + 10),
  images: frames.length, journal: journal.slice(0, 40),
}
fs.writeFileSync(path.join(ICI, `demarrage-${ETIQ}.json`), JSON.stringify(out, null, 1))

const f = (x, n = 0) => (x == null ? '—' : Number(x).toLocaleString('fr-FR', { maximumFractionDigits: n }))
console.log(`\n=== R29 bis / ${ETIQ} — MOLETTE DEPUIS LE DÉMARRAGE ===`)
console.log(`départ : ${JSON.stringify({ mode: depart.mode, crop: depart.crop, z: depart.zoom, d: +depart.d.toFixed(3), dmax: depart.dmax, alt: Math.round(depart.altM), emprise: Math.round(depart.emprise), niveau: +depart.niveau.toFixed(5), continu: depart.continu, locked: depart.locked, coarsen: depart.coarsenTarget })}`)
console.log('\ncran |        d |   plafond |    altitude |     emprise | crop | mode    | z  | _levelZoom')
for (const r of table) {
  if (!(r.cran <= 10 || r.cran % 5 === 0 || r.cran === orbiteA)) continue
  console.log(`${String(r.cran).padStart(4)} | ${f(r.d, 3).padStart(8)} | ${f(r.dmax, 1).padStart(9)} | ${(f(r.altM) + ' m').padStart(11)} | ${(f(r.emprise) + ' m').padStart(11)} | ${(r.crop ? 'oui' : 'non').padStart(4)} | ${String(r.mode).padEnd(7)} | ${String(r.zoom).padStart(2)} | ${f(r.niveau, 5)}`)
}
console.log(`\norbite atteinte au cran : ${orbiteA ?? 'JAMAIS'}   ·   crop mort : ${bascule == null ? 'JAMAIS' : 'img ' + bascule}`)
console.log('\n--- LES COMPTEURS, MAILLON PAR MAILLON ---')
for (const [k, v] of Object.entries(fin.n)) console.log(`  ${k.padEnd(16)} ${v}`)
console.log('--- LES GARDES QUI ONT REFUSÉ LE FRANCHISSEMENT ---')
const b = Object.entries(fin.blocages)
console.log(b.length ? b.map(([k, v]) => `  ${k.padEnd(16)} ${v}`).join('\n') : '  (aucune)')
if (journal.length) { console.log('\n⚠️ CONSOLE :'); [...new Set(journal)].slice(0, 12).forEach((l) => console.log('  ' + l)) }

await nav.close()
