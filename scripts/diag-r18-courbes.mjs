// DIAGNOSTIC R18 — pourquoi les courbes de niveau du crop ne se voient pas.
// Trois suspects dans le nuanceur du globe : `uContourOpacity` (elle traverse,
// mesuré), `minFade` (l'évanouissement par minification) et `uContourInterval`
// (calé sur l'amplitude). On les neutralise UN PAR UN et on regarde.
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
  const etat = await page.evaluate(() => {
    const u = window.__exp.globe.uniforms
    const l = {}
    for (const k of ['uContourOpacity', 'uContourInterval', 'uContourWeight', 'uHabOn', 'uMppFacteur', 'uResRefM', 'uLandMax', 'uReliefBas', 'uGraticuleOpacity'])
      l[k] = u[k]?.value ?? null
    return l
  })
  console.log('état :', JSON.stringify(etat))
  const essais = [
    ['temoin', () => {}],
    ['opacite1', (u) => { u.uContourOpacity.value = 1 }],
    ['opacite1-sansMinFade', (u) => { u.uContourOpacity.value = 1; u.uMppFacteur.value = 0 }],
    ['opacite1-interval2000', (u) => { u.uContourOpacity.value = 1; u.uContourInterval.value = 2000 }],
    ['opacite3-interval2000', (u) => { u.uContourOpacity.value = 3; u.uContourInterval.value = 2000 }],
    ['graticule1', (u) => { u.uGraticuleOpacity.value = 1 }],
  ]
  for (const [nom, fn] of essais) {
    await page.evaluate((n) => {
      const u = window.__exp.globe.uniforms
      // on repart du témoin à chaque essai
      window.__r18c = window.__r18c || { op: u.uContourOpacity.value, iv: u.uContourInterval.value, mp: u.uMppFacteur.value, gr: u.uGraticuleOpacity.value }
      u.uContourOpacity.value = window.__r18c.op
      u.uContourInterval.value = window.__r18c.iv
      u.uMppFacteur.value = window.__r18c.mp
      u.uGraticuleOpacity.value = window.__r18c.gr
      window.__r18f = n
    }, nom)
    await page.evaluate(`(${fn.toString()})(window.__exp.globe.uniforms)`)
    await dodo(1500)
    await page.screenshot({ path: `.banc/R18/courbes-${nom}.png` })
    console.log('capture', nom)
  }
} finally { await nav.close() }
