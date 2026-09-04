// Diagnostic GX1 — LE CYCLE D'IMAGES. Le tracé mesuré par différence oscillait
// entre 162 et 89 581 pixels : est-ce le tracé, ou l'image qui bat toute seule ?
// On capture 10 images consécutives SANS RIEN CHANGER et on compare k et k+1,
// k et k+2, k et k+4. Caméra au repos, grain coupé, animations coupées.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const ADRESSE = opt('--adresse', '')
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(PP).href)).default
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--window-size=1440,1024', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024 })
await page.goto(`http://127.0.0.1:${opt('--port', '9233')}/${ADRESSE ? '?' + ADRESSE : ''}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 8000)); await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 6000))
await page.evaluate(() => {
  const e = window.__exp
  e.params.grain = 0; e.params.animations = false
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__c = () => e.gpxLayer.layers?.[0]?.gpx || null
  window.__diff = async (a, b) => {
    const lire = async (u) => { const im = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data }
    const x = await lire(a), y = await lire(b)
    let n = 0
    for (let i = 0; i < x.length; i += 4) { if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 12) n++ }
    return n
  }
})
const tourner = (n) => page.evaluate((k) => window.__h.tourner(k), n)
const snap = async () => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
const gpx = fs.readFileSync(path.resolve(RACINE, '.banc/marathon-mont-blanc-90km.gpx'), 'utf8')
await page.evaluate((t) => window.__exp.loadGpxText(t), gpx)
for (let i = 0; i < 12; i++) { await tourner(120); await new Promise((r) => setTimeout(r, 1500)) }

const imgs = []
for (let k = 0; k < 10; k++) { await tourner(1); imgs.push(await snap()) }
const d = async (i, j) => page.evaluate((a, b) => window.__diff(a, b), imgs[i], imgs[j])
const un = [], deux = [], quatre = []
for (let i = 0; i + 1 < imgs.length; i++) un.push(await d(i, i + 1))
for (let i = 0; i + 2 < imgs.length; i++) deux.push(await d(i, i + 2))
for (let i = 0; i + 4 < imgs.length; i++) quatre.push(await d(i, i + 4))
console.log('écart k↔k+1 :', un.join(' '))
console.log('écart k↔k+2 :', deux.join(' '))
console.log('écart k↔k+4 :', quatre.join(' '))
fs.writeFileSync(path.resolve(RACINE, '.banc/GX1/cadence.json'), JSON.stringify({ un, deux, quatre }, null, 1))
await nav.close()
