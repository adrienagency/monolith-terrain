// Diagnostic GX1 — LA SCÈNE PRINCIPALE EST-ELLE SEULEMENT DESSINÉE sous
// `terre unique` ? On identifie chaque appel à renderer.render par l'uuid de sa
// scène, comparé à ceux de `__exp.scene` (qui porte le groupe `gpx`) et de
// `__exp.sceneGlobe`.
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
page.on('pageerror', (e) => console.error('  [page] ' + e.message))
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
  window.__passes = []
  const vraiRender = e.renderer.render.bind(e.renderer)
  e.renderer.render = (sc, cam) => {
    let gpx = null, terrainVisible = null
    sc.traverse((o) => { if (o.name === 'gpx') gpx = { visible: o.visible, enfants: o.children.length } })
    window.__passes.push({
      uuid: sc.uuid.slice(0, 8),
      estSceneParPrincipale: sc === e.scene, estSceneGlobe: sc === e.sceneGlobe,
      objets: sc.children.length, cam: cam.type, near: cam.near, far: cam.far,
      versEcran: !e.renderer.getRenderTarget(), gpx,
    })
    return vraiRender(sc, cam)
  }
})
const tourner = (n) => page.evaluate((k) => window.__h.tourner(k), n)
const gpx = fs.readFileSync(path.resolve(RACINE, '.banc/marathon-mont-blanc-90km.gpx'), 'utf8')
await page.evaluate((t) => window.__exp.loadGpxText(t), gpx)
for (let i = 0; i < 10; i++) { await tourner(120); await new Promise((r) => setTimeout(r, 1500)) }
await page.evaluate(() => { window.__passes = [] })
await tourner(1)
const r = await page.evaluate(() => ({
  passes: window.__passes,
  sceneUuid: window.__exp.scene.uuid.slice(0, 8),
  sceneGlobeUuid: window.__exp.sceneGlobe?.uuid.slice(0, 8) || null,
  sceneObjets: window.__exp.scene.children.length,
  terrainVisible: window.__exp.terrain?.group?.visible,
  gpxParent: window.__exp.gpxLayer.layers[0].gpx.group.parent === window.__exp.scene,
}))
console.log(JSON.stringify(r, null, 1))
fs.writeFileSync(path.resolve(RACINE, `.banc/GX1/scene${ADRESSE ? '-' + ADRESSE.replace(/[=&]/g, '-') : ''}.json`), JSON.stringify(r, null, 1))
await nav.close()
