// DENT — LE COIN ROUGE : la paroi PERCE-T-ELLE la nappe ?
// A/B en une image : on monte la nappe de `--hausse` unité de scène le long de
// sa verticale locale (`mer.position.y`, le Y du repère du crop). Si le coin
// rouge se ferme, ce n'est pas une nappe trop petite — c'est une ARÊTE PLUS
// HAUTE QUE L'EAU, et le correctif ne se cherche pas dans l'emprise.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
import path from 'node:path'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9433')
const LAT = Number(opt('--lat', '-21.0561')), LON = Number(opt('--lon', '55.6170'))
const ZOOM = Number(opt('--zoom', '11')), ALT = Number(opt('--alt', '26000'))
const ELEV = Number(opt('--elevation', '30')), AZIM = Number(opt('--azimut', '20'))
const OUT = opt('--out', '.banc/DENT/coin')
fs.mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(200) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(1500)
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
await dodo(9000)
const poser = () => page.evaluate(([a, el, az]) => {
  const e = window.__exp, cam = e.camera, ct = e.controls
  ct.minDistance = 1e-4; ct.maxDistance = 1e12
  const dir = cam.position.clone().sub(ct.target).normalize()
  for (let i = 0; i < 60; i++) {
    const v = e.altitudeCadrageM(); if (!(v > 0)) break
    const d = cam.position.distanceTo(ct.target); const nd = d * (a / v); if (!(nd > 0)) break
    cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.()
    if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
  }
  const d = cam.position.distanceTo(ct.target), p = (el * Math.PI) / 180, q = (az * Math.PI) / 180
  cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(q), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(q))
  cam.lookAt(ct.target); ct.update?.()
}, [ALT, ELEV, AZIM])
await poser(); await dodo(3000)
for (const h of [0, 0.002, 0.01, 0]) {
  await page.evaluate((k) => {
    const g = window.__exp.globe, mer = g._mer, par = g._parois
    if (!mer) return
    if (window.__DENT_Y0 === undefined) window.__DENT_Y0 = mer.position.y
    mer.position.y = window.__DENT_Y0 + k
    mer.updateMatrixWorld(true)
  }, h)
  await dodo(1200)
  await page.screenshot({ path: path.join(OUT, `hausse-${h}.png`) })
  console.log('hausse', h)
}
await nav.close()
