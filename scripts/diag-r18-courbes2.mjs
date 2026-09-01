// DIAGNOSTIC R18 (suite) — les courbes par le CHEMIN RÉEL, pas par une écriture
// directe sur le globe. `poserHabillage` est le seul écrivain légitime de
// `uContourOpacity` côté globe, et la veille ne repose que sur CHANGEMENT :
// écrire l'uniforme du globe à la main pouvait être annulé à l'image suivante.
import fs from 'node:fs'
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
async function pptr() {
  for (const p of ['C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p)).default
  process.exit(2)
}
const puppeteer = await pptr()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto('http://localhost:5561/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => { window.__exp.params.animations = false })
  for (const [nom, op, iv] of [['reel-0', 0, null], ['reel-1', 1, null], ['reel-1-int100', 1, 100]]) {
    const r = await page.evaluate((o, i) => {
      const e = window.__exp
      e.params.contourOpacity = o
      e.terrain.mapUniforms.uContourOpacity.value = o
      if (i) e.terrain.mapUniforms.uContourInterval.value = i
      return null
    }, op, iv)
    await dodo(3000)
    const lu = await page.evaluate(() => {
      const u = window.__exp.globe.uniforms
      return { globe: u.uContourOpacity.value, interval: u.uContourInterval.value, socle: window.__exp.terrain.mapUniforms.uContourOpacity.value }
    })
    await page.screenshot({ path: `.banc/R18/courbes2-${nom}.png` })
    console.log(nom, JSON.stringify(lu))
  }
} finally { await nav.close() }
