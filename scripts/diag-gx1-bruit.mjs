// Diagnostic GX1 — d'où vient le bruit entre deux captures ? (banc de mesure)
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(PP).href)).default
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--window-size=1440,1024', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024 })
await page.goto('http://127.0.0.1:9233/', { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 12000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 8000))

await page.evaluate(() => {
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__diff = async (a, b) => {
    const lire = async (u) => { const im = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data }
    const x = await lire(a), y = await lire(b)
    let n = 0, max = 0
    for (let i = 0; i < x.length; i += 4) { const m = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])); if (m > max) max = m; if (m > 12) n++ }
    return { n, max }
  }
})
await page.evaluate((n) => window.__h.tourner(n), 60)
const snap = async () => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })

const essais = {}
// ① deux captures, AUCUN rendu entre
let a = await snap(); let b = await snap()
essais.sansRendu = await page.evaluate((x, y) => window.__diff(x, y), a, b)
// ② deux captures avec composer.render() entre
a = await snap(); await page.evaluate(() => window.__exp.composer.render()); b = await snap()
essais.avecRendu = await page.evaluate((x, y) => window.__diff(x, y), a, b)
// ③ animations coupées + rendu
await page.evaluate(() => { window.__exp.params.animations = false; window.__exp.composer.render() })
a = await snap(); await page.evaluate(() => window.__exp.composer.render()); b = await snap()
essais.animationsOff = await page.evaluate((x, y) => window.__diff(x, y), a, b)
// ④ grain coupé
await page.evaluate(() => { window.__exp.params.grain = 0; window.__exp.composer.render() })
a = await snap(); await page.evaluate(() => window.__exp.composer.render()); b = await snap()
essais.grainOff = await page.evaluate((x, y) => window.__diff(x, y), a, b)
// ⑤ grain coupé + tracé éteint : LE signal
await page.evaluate(() => { window.__exp.gpxLayer.layers[0] && (window.__exp.gpxLayer.layers[0].gpx.group.visible = false); window.__exp.composer.render() })
b = await snap()
essais.traceEteinte = await page.evaluate((x, y) => window.__diff(x, y), a, b)

essais.params = await page.evaluate(() => Object.keys(window.__exp.params).filter((k) => /grain|noise|film|dither|jitter|taa|anim/i.test(k)).reduce((o, k) => (o[k] = window.__exp.params[k], o), {}))
console.log(JSON.stringify(essais, null, 1))
await nav.close()
