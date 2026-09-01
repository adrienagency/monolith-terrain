// DIAG R29 bis — LA CAMÉRA EST-ELLE SOUS LE SOL SUR L'IMAGE **DESSINÉE** ?
//
// ⛔ **LA SONDE DE R30 EST POSÉE DANS `controls.update`, ET CE N'EST PAS LA FIN
// DE L'IMAGE.** L'ordre réel d'une image de surface est :
//
//     updateCameraMotion → … → controls.update()   ← la sonde R30 relève ICI
//                             → pivoterAutourDuBloc → recentrerSurLaTerre
//                             → redresserSurLeSol()  ← la butée s'applique ICI
//     modes.update(dt)    → _applyZoom → controls.update()  ← et ICI aussi
//                        → redresserSurLeSol()       ← puis ICI (R29 bis)
//     composer.render()                              ← CE QUI EST DESSINÉ
//
// `redresserSurLeSol` écrit `camera.position` **sans** rappeler
// `controls.update()` : la correction est donc INVISIBLE à une sonde branchée
// sur `controls.update`. Toutes les images fautives de `.banc/R30/sol.json`
// portent `phi > maxPhi` — la butée SAIT. La question que ce diagnostic tranche
// est : sait-elle trop tard, ou la sonde regarde-t-elle trop tôt ?
//
// On relève donc au SEUL endroit qui ne ment pas : juste avant le rendu.
//
//   node scripts/diag-r29-sol-dessine.mjs --port 5843
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
const W = 1280, H = 800

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 90000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
await page.keyboard.press('Escape').catch(() => {})
await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
await wait(60)

const LIEUX = [
  { nom: 'Mont-Blanc', lat: 45.8326, lon: 6.8652, zoom: 12 },
  { nom: 'Cervin', lat: 45.9763, lon: 7.6586, zoom: 12 },
  { nom: 'Everest', lat: 27.9881, lon: 86.925, zoom: 12 },
  { nom: 'Svalbard', lat: 78.6, lon: 16.5, zoom: 11 },
]

// ══════════ LES DEUX SONDES, LA MÊME IMAGE ════════════════════════════════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera
  window.__D = { on: false, tag: '', update: [], dessin: [] }
  const mesure = () => {
    const s = e.terrain?.sample
    if (typeof s !== 'function') return null
    const h = s(cam.position.x, cam.position.z)
    if (!Number.isFinite(h)) return null
    return {
      tag: window.__D.tag,
      h: cam.position.y - h,
      phi: c.getPolarAngle() * 180 / Math.PI,
      maxPhi: c.maxPolarAngle * 180 / Math.PI,
      d: cam.position.distanceTo(c.target),
    }
  }
  const origU = c.update.bind(c)
  c.update = (...a) => { const r = origU(...a); if (window.__D.on) { const m = mesure(); if (m) window.__D.update.push(m) } return r }
  // ⚡ **LE SEUL RELEVÉ QUI NE MENT PAS** : juste avant que l'image parte au GPU.
  const cible = e.composer && typeof e.composer.render === 'function' ? e.composer : e.renderer
  const origR = cible.render.bind(cible)
  cible.render = (...a) => { if (window.__D.on) { const m = mesure(); if (m) window.__D.dessin.push(m) } return origR(...a) }
})

const glisser = async (x0, y0, dx, dy, pas) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1, buttons: 1 })
  for (let i = 1; i <= pas; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (dx * i) / pas, y: y0 + (dy * i) / pas, button: 'left', buttons: 1 })
    await wait(2)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + dx, y: y0 + dy, button: 'left', clickCount: 1, buttons: 0 })
}
const molette = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: d, modifiers: 0, pointerType: 'mouse' })

const sortie = { quand: new Date().toISOString(), lieux: [] }
for (const L of LIEUX) {
  await page.evaluate(async (l) => {
    const e = window.__exp
    e.params.demLat = l.lat; e.params.demLon = l.lon; e.params.demZoom = l.zoom
    await e.loadRealTerrain()
  }, L)
  await page.waitForFunction('!window.__exp.modes.busy', { timeout: 120000 }).catch(() => {})
  await wait(120)
  await page.evaluate(() => { window.__D.on = true; window.__D.update = []; window.__D.dessin = [] })

  // ① TOURNER seul — le geste de R23
  await page.evaluate(() => { window.__D.tag = 'tourner' })
  await glisser(640, 500, 0, -320, 60) // coucher vers l'horizon
  await glisser(640, 400, 700, 0, 90) // puis 360° d'azimut à la butée
  await wait(40)
  // ② MÉLANGE — tourner PENDANT que l'élan de zoom court (le geste de R30)
  await page.evaluate(() => { window.__D.tag = 'melange' })
  for (let k = 0; k < 6; k++) {
    await molette(-100)
    await glisser(640, 400, 140, -40, 12)
  }
  await wait(40)
  await page.evaluate(() => { window.__D.on = false })

  const d = await page.evaluate(() => ({ update: window.__D.update, dessin: window.__D.dessin }))
  const bilan = (arr) => {
    const par = {}
    for (const x of arr) {
      const b = (par[x.tag] ??= { n: 0, sous: 0, hmin: Infinity, pireButee: 0 })
      b.n++
      if (x.h < 0) { b.sous++; b.hmin = Math.min(b.hmin, x.h); b.pireButee = Math.max(b.pireButee, x.phi - x.maxPhi) }
    }
    for (const k of Object.keys(par)) if (par[k].hmin === Infinity) par[k].hmin = null
    return par
  }
  sortie.lieux.push({ nom: L.nom, update: bilan(d.update), dessin: bilan(d.dessin) })
  console.log(`\n=== ${L.nom} ===`)
  for (const tag of ['tourner', 'melange']) {
    const u = bilan(d.update)[tag], r = bilan(d.dessin)[tag]
    const f = (b) => (b ? `${b.sous}/${b.n} sous le sol, pire ${b.hmin == null ? '—' : b.hmin.toFixed(4)} u (butée dépassée de ${b.pireButee.toFixed(2)}°)` : '—')
    console.log(`  ${tag.padEnd(8)} · dans controls.update : ${f(u)}`)
    console.log(`  ${' '.repeat(8)} · AU RENDU            : ${f(r)}`)
  }
}
fs.writeFileSync(path.join(ICI, 'sol-dessine.json'), JSON.stringify(sortie, null, 1))
console.log(`\n→ ${path.join(ICI, 'sol-dessine.json')}`)
await nav.close()
