// CA1 — diagnostic : pourquoi la molette ne franchit-elle pas le palier dans le crop ?
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '11311'))
const MODE = opt('--mode', 'cdp') // cdp | dom | cran
const POSE = opt('--pose', '1') !== '0'
const RAFALE = Number(opt('--rafale', '1'))
const ESPACE = Number(opt('--espace', '60'))
const GESTES = Number(opt('--gestes', '12'))
const SENS = Number(opt('--sens', '1'))
const W = 1280, H = 800, CX = W / 2, CY = H / 2
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
async function immobile() {
  await page.waitForFunction(() => { const e = window.__exp; if (!e?.camera || !e?.controls || !e?.modes) return false; const d = e.camera.position.distanceTo(e.controls.target); const R = (window.__stab ??= { d: NaN, t: 0 }); if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false } return !e.modes.busy && !e.modes.travel && performance.now() - R.t > 1500 }, { timeout: 120000, polling: 100 })
}
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 180000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
await immobile()
for (let k = 0; k < 12; k++) { const s = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY]).catch(() => null); if (s === 'CANVAS') break; await page.keyboard.press('Escape').catch(() => {}); await dodo(250) }
await page.evaluate(() => window.__exp.modes.flyTo(-21.2482, 55.7664, 13))
await dodo(3000)
await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 })
await immobile()
if (POSE) await page.evaluate(async () => {
  const e = window.__exp, cam = e.camera, ct = e.controls, g = e.globe
  const cropM = 2 * g._crop.demi * 2 * Math.PI * 6371000 * Math.cos(-21.2482 * Math.PI / 180)
  const a = cropM * 1.1
  const dir = cam.position.clone().sub(ct.target).normalize()
  for (let i = 0; i < 60; i++) { const v = e.altitudeCadrageM(); if (!Number.isFinite(v) || v <= 0) break; const d = cam.position.distanceTo(ct.target), nd = d * (a / v); if (!Number.isFinite(nd) || nd <= 0) break; cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.(); if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break }
  const d = cam.position.distanceTo(ct.target), p = 35 * Math.PI / 180, az = 15 * Math.PI / 180
  cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(az), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(az))
  cam.lookAt(ct.target); ct.update?.()
})
await dodo(4000)
const lire = () => page.evaluate(() => { const e = window.__exp, m = e.modes; return { t: Math.round(performance.now()), alt: Math.round(e.altitudeCadrageM()), d: +e.camera.position.distanceTo(e.controls.target).toFixed(2), max: e.controls.maxDistance, min: e.controls.minDistance, demZoom: e.params.demZoom, level: +m._levelZoom.toFixed(4), vel: +(m._zoomVel ?? 0).toFixed(4), busy: m.busy, travel: m.travel, fondu: !!m._fonduPose, dive: !!m._diveTween, continu: m.hooks.zoomContinu?.(), coarsen: !!m.hooks.getCoarsenTarget?.(), pose: !!e.veilleCrop?.pose, cropDemi: e.globe._crop?.demi, armee: !!e.veilleCrop?.sortieArmee, annonce: m.msgEl?.textContent, locked: m.locked, polaire: +(e.controls.getPolarAngle() * 180 / Math.PI).toFixed(1) } })
console.log('depart', JSON.stringify(await lire()))
for (let i = 1; i <= GESTES; i++) {
  for (let k = 0; k < RAFALE; k++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: 120 * SENS, pointerType: 'mouse' }); if (k < RAFALE - 1) await dodo(ESPACE) }
  if (MODE === 'cdp') {}
  else if (MODE === 'dom') await page.evaluate(() => { const el = window.__exp.renderer.domElement; el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })) })
  else await page.evaluate(() => window.__exp.modes.cranZoom(-1))
  await dodo(150); const a = await lire()
  await dodo(1850); const b = await lire()
  console.log(`cran ${i}: +150ms ${JSON.stringify(a)}\n         +1500ms ${JSON.stringify(b)}`)
  if (!b.pose) break
}
await nav.close()
