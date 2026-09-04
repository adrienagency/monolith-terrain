// SUR — sonde de la « surcouche colorée ». Reproduit la scène d'Adrien
// (Alpes suisses, flyTo) puis franchit un cran d'échelle en relevant, image
// par image, les 4 uniformes d'ombrage + un échantillon de pixels au centre.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9833')
const LAT = Number(opt('--lat', '46.0122'))
const LON = Number(opt('--lon', '7.8223'))
const ZOOM = Number(opt('--zoom', '11'))
const OUT = opt('--out', '.banc/SUR')
const CRANS = Number(opt('--crans', '2'))
fs.mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(150) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
await dodo(14000)

const etat = () => page.evaluate(() => {
  const e = window.__exp
  const u = e.terrain?.mapUniforms || {}
  const d = e.dem
  const px = (() => {
    try {
      const gl = e.renderer.getContext()
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const n = 64
      const b = new Uint8Array(n * n * 4)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.readPixels((w >> 1) - n / 2, (h >> 1) - n / 2, n, n, gl.RGBA, gl.UNSIGNED_BYTE, b)
      let r = 0, g = 0, bl = 0
      for (let i = 0; i < n * n; i++) { r += b[i * 4]; g += b[i * 4 + 1]; bl += b[i * 4 + 2] }
      const k = n * n
      return { r: +(r / k).toFixed(1), g: +(g / k).toFixed(1), b: +(bl / k).toFixed(1) }
    } catch { return null }
  })()
  const chroma = px ? +(Math.max(px.r, px.g, px.b) - Math.min(px.r, px.g, px.b)).toFixed(1) : null
  return {
    t: +performance.now().toFixed(0),
    cartouche: document.querySelector('#status, .ce-status, [class*=status]')?.textContent?.trim()?.slice(0, 60) || '',
    uTint: u.uTint?.value ?? null,
    uHeightContrast: u.uHeightContrast?.value ?? null,
    uHeightPivot: u.uHeightPivot?.value ?? null,
    uSlopeTint: u.uSlopeTint?.value ?? null,
    colorMode: e.params?.colorMode ?? null,
    shadeAuto: e.params?.shadeAuto ?? null,
    demMin: d?.minM ?? null, demMax: d?.maxM ?? null, demW: d?.width ?? null,
    extentM: d?.extentMeters ?? null,
    px, chroma,
  }
})

const journal = []
const shot = async (nom) => { await page.screenshot({ path: `${OUT}/${nom}.png` }) }
journal.push({ etape: 'avant', ...(await etat()) })
await shot('00-avant')

for (let c = 0; c < CRANS; c++) {
  await page.evaluate(() => window.__exp.modes.stepFiner())
  for (let i = 0; i < 24; i++) {
    await dodo(400)
    const s = await etat()
    journal.push({ etape: `cran${c + 1}`, i, ...s })
    if (i % 4 === 0) await shot(`c${c + 1}-${String(i).padStart(2, '0')}`)
  }
}
fs.writeFileSync(`${OUT}/journal.json`, JSON.stringify(journal, null, 1))
console.log(JSON.stringify(journal.filter((_, i) => i % 2 === 0).map((j) => [j.etape, j.i ?? '', j.uTint, j.uHeightContrast, j.uHeightPivot, j.uSlopeTint, j.chroma, j.demMin, j.demMax]), null, 0))
await nav.close()
