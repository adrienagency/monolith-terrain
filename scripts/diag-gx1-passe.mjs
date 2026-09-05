// Diagnostic GX1 — QUELLE PASSE dessine ce qu'on voit, et où passe le tracé.
// Instrumente renderer.render / composer.render pour compter les passes par
// image, puis éteint des objets un par un et mesure la différence à l'écran.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const ADRESSE = opt('--adresse', '')
const PORT = opt('--port', '9233')
const SORTIE = path.resolve(RACINE, '.banc/GX1')
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE || PP).href)).default
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--window-size=1440,1024', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024 })
page.on('pageerror', (e) => console.error('  [page] ' + e.message))
await page.goto(`http://127.0.0.1:${PORT}/${ADRESSE ? '?' + ADRESSE : ''}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 8000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 6000))

await page.evaluate(() => {
  const e = window.__exp
  e.params.grain = 0; e.params.animations = false
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__c = () => e.gpxLayer.layers?.[0]?.gpx || null
  // ── espion sur renderer.render : quelle scène, quelle caméra, quelle cible ─
  window.__passes = []
  const vraiRender = e.renderer.render.bind(e.renderer)
  e.renderer.render = (sc, cam) => {
    window.__passes.push({
      scene: sc.name || sc.uuid.slice(0, 6), objets: sc.children.length,
      cam: cam.name || cam.type, near: cam.near, far: cam.far,
      cible: e.renderer.getRenderTarget() ? 'cible' : 'ÉCRAN',
      gpxDansCetteScene: (() => { let t = false; sc.traverse((o) => { if (o.name === 'gpx') t = true }); return t })(),
      autoClear: e.renderer.autoClear, autoClearDepth: e.renderer.autoClearDepth,
    })
    return vraiRender(sc, cam)
  }
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

// ── les passes d'UNE image ──────────────────────────────────────────────────
await page.evaluate(() => { window.__passes = [] })
await tourner(1)
const passes = await page.evaluate(() => window.__passes)
console.log('PASSES D’UNE IMAGE :')
for (const p of passes) console.log('  ' + JSON.stringify(p))

// ── qui pose des pixels ? on éteint, une image, on compare ─────────────────
// ⚠️ trois relevés par cible : un seul relevé ne prouve rien ici.
async function eteindre(nom, allume, eteins, n = 6) {
  const vals = []
  for (let k = 0; k < n; k++) {
    await tourner(2)
    const a = await snap()
    await page.evaluate(eteins)
    await tourner(1)
    const b = await snap()
    await page.evaluate(allume)
    await tourner(1)
    vals.push(await page.evaluate((x, y) => window.__diff(x, y), a, b))
  }
  console.log(`  ${nom.padEnd(30)} ${vals.join('  ')} px`)
  return vals
}
const r = { passes }
r.gpx = await eteindre('groupe GPX', () => { window.__c().group.visible = true }, () => { window.__c().group.visible = false })
r.terrain = await eteindre('terrain (bloc)', () => { window.__exp.terrain.group.visible = true }, () => { window.__exp.terrain.group.visible = false })
r.globe = await eteindre('globe', () => { window.__exp.globe.group.visible = true }, () => { window.__exp.globe.group.visible = false })

fs.writeFileSync(path.join(SORTIE, `passe${ADRESSE ? '-' + ADRESSE.replace(/[=&]/g, '-') : ''}.json`), JSON.stringify(r, null, 1))
await nav.close()
