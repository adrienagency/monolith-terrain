// DIAG NUA — la présence selon la caméra : que valent uPresence, la caméra en
// bloc et la colonne, à z13 au repos (caméra dans la couche) ?
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.argv[2] || '10620')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape'); await dodo(1500)
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 13))
  await page.waitForFunction(() => window.__exp.terrain.dem?.zoom === 13 && !window.__exp.modes.busy, { timeout: 90000, polling: 200 }).catch(() => {})
  await dodo(6000)
  for (const alt of [10000, 5500, 4500, 3115]) {
    await page.evaluate((a) => {
      const e = window.__exp, f = e.terrain.fenetreBornee
      e.camera.position.y = (a - f.moyenneM) * f.echelleVerticale
      e.controls.update()
    }, alt)
    await dodo(1200)
    const r = await page.evaluate(() => {
      const e = window.__exp, c = e.clouds
      const u = c.mesh.material.uniforms
      const cb = e.camNuagesBloc ? e.camNuagesBloc() : null
      return { camY: e.camera.position.y, camBloc: cb ? [cb.x, cb.y, cb.z] : 'non exposé', uCamBloc: u.uCamBloc.value.toArray(), uPresence: u.uPresence?.value, colonne: c._colonne, sky: { base: c.sky.opts.baseY, top: c.sky.opts.topY }, plafondM: c._plafondM }
    })
    console.log(alt, JSON.stringify(r))
  }
} finally { await nav.close() }
