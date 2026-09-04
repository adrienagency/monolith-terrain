// Sonde jetable : la molette bouge-t-elle uCropDemi ? (DENT, diagnostic)
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const pup = pupmod.default ?? pupmod
const PORT = process.argv[2] || '9433'
const ZOOM = process.argv[3] || '11'
const W = 1280, H = 800
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluateOnNewDocument((z) => { window.__ZOOM = z }, ZOOM)
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(200) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
const etat = () => page.evaluate(() => {
  const e = window.__exp, g = e.globe
  return { alt: e.altitudeCadrageM(), demi: g.uniforms.uCropDemi.value, on: g.uniforms.uCropOn.value, mer: !!g._mer, cen: [g.uniforms.uCropCentre.value.x, g.uniforms.uCropCentre.value.y] }
})
console.log('depart', await etat())
await page.evaluate(() => window.__exp.modes.flyTo(-19.7253, 63.3691, Number(window.__ZOOM)))
await dodo(9000)
console.log('apres goto', await etat())
for (let i = 0; i < 0; i++) {
  await page.evaluate(() => {
    const cv = window.__exp.renderer.domElement, r = cv.getBoundingClientRect()
    cv.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }))
  })
  await dodo(1200)
  console.log('cran-' + (i + 1), await etat())
}
await nav.close()
