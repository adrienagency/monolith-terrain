// Diagnostic GX1 — POURQUOI le tracé ne pose aucun pixel sous `terre unique`.
// Chaque variante est un CONTREFACTUEL posé sur la scène vivante, puis mesuré
// par différence (tracé allumé / éteint), image par image, boucle rAF capturée.
// ⛔ Ne corrige rien : tout est reposé après mesure.
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
  window.__exp.params.grain = 0
  window.__exp.params.animations = false
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__c = () => window.__exp.gpxLayer.layers?.[0]?.gpx || null
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

async function mesure(nom, png = false) {
  await tourner(2)
  const a = await snap()
  await page.evaluate(() => { window.__c().group.visible = false })
  await tourner(1)
  const b = await snap()
  await page.evaluate(() => { window.__c().group.visible = true })
  await tourner(1)
  const px = await page.evaluate((x, y) => window.__diff(x, y), a, b)
  if (png) fs.writeFileSync(path.join(SORTIE, `cause-${nom}.png`), Buffer.from(a.split(',')[1], 'base64'))
  console.log(`  ${nom.padEnd(34)} ${String(px).padStart(7)} px`)
  return px
}

const r = {}
r.contexte = await page.evaluate(() => {
  const e = window.__exp, c = window.__c()
  return {
    mode: e.modes.mode, terreUnique: typeof e.terreUniqueBranchee === 'function' ? !!e.terreUniqueBranchee() : e.terreUniqueBranchee,
    frontiere: typeof e.frontiereActive === 'function' ? !!e.frontiereActive() : e.frontiereActive,
    dedansCrop: (() => { try { return e.dedansCrop() } catch { return String(e.dedansCrop) } })(),
    veilleCrop: e.veilleCrop ? { pose: e.veilleCrop.pose, refus: e.veilleCrop.refus, bascules: e.veilleCrop.bascules } : null,
    camNear: e.camera.near, camFar: e.camera.far, camPos: e.camera.position.toArray(),
    clipPlans: c.rubanMat?.clippingPlanes?.length || 0,
    localClipping: e.renderer.localClippingEnabled,
    globalClip: e.renderer.clippingPlanes?.length || 0,
    rubanY: c.track.world.slice(0, 5).map((p) => p.y),
    groupY: c.group.position.y,
    parentDuGroupe: c.group.parent?.name || c.group.parent?.type,
    sceneName: e.scene.name || e.scene.type,
    couches: e.renderer.info ? { calls: e.renderer.info.render.calls } : null,
  }
})
console.log(JSON.stringify(r.contexte, null, 1))

r.base = await mesure('base', true)
// ① le tracé est-il MASQUÉ PAR LE RELIEF ? (test de profondeur)
await page.evaluate(() => { const c = window.__c(); c.rubanMat.depthTest = false; c.rubanMat.needsUpdate = true })
r.sansDepthTest = await mesure('sans depthTest', true)
await page.evaluate(() => { const c = window.__c(); c.rubanMat.depthTest = true; c.rubanMat.needsUpdate = true })
// ② le tracé est-il TROP BAS ? on le soulève franchement
for (const dy of [1, 5, 30]) {
  await page.evaluate((d) => { window.__c().group.position.y = d }, dy)
  r['souleve' + dy] = await mesure(`soulevé +${dy} u`, dy === 5)
}
await page.evaluate(() => { window.__c().group.position.y = 0 })
// ③ le tracé est-il ÉCRÊTÉ par des plans de coupe ?
await page.evaluate(() => { const c = window.__c(); c.rubanMat.clippingPlanes = null; c.rubanMat.needsUpdate = true })
r.sansCoupe = await mesure('sans plans de coupe')
// ④ est-il seulement DESSINÉ ? on le rend énorme et opaque devant tout
await page.evaluate(() => {
  const c = window.__c()
  c.rubanMat.depthTest = false; c.rubanMat.transparent = false; c.rubanMat.opacity = 1
  c.ruban.renderOrder = 9999; c.rubanMat.needsUpdate = true
})
r.forcage = await mesure('forcé au premier plan', true)
fs.writeFileSync(path.join(SORTIE, `cause${ADRESSE ? '-' + ADRESSE.replace(/[=&]/g, '-') : ''}.json`), JSON.stringify(r, null, 1))
await nav.close()
