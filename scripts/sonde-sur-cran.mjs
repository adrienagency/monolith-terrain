// SUR — le CRAN d'échelle, échantillonné dans le temps. Le pixel est lu par
// drawImage sur le canvas WebGL (le tampon composité), et le cran est donné
// par `modes.cranZoom(1)` — le voile `.ce-elemwrap` avale la molette.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9833')
const LAT = Number(opt('--lat', '46.0122'))
const LON = Number(opt('--lon', '7.8223'))
const ZOOM = Number(opt('--zoom', '11'))
const OUT = opt('--out', '.banc/SUR-CRAN')
const CRANS = Number(opt('--crans', '10'))
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
await dodo(15000)

// sonde : le canvas WebGL recopié dans un 2D, carré central de 128 px
await page.evaluate(() => {
  const e = window.__exp
  const cv = document.createElement('canvas')
  cv.width = 128; cv.height = 128
  const cx = cv.getContext('2d', { willReadFrequently: true })
  window.__surEch = () => {
    const src = e.renderer.domElement
    try {
      cx.drawImage(src, (src.width >> 1) - 64, (src.height >> 1) - 64, 128, 128, 0, 0, 128, 128)
      const d = cx.getImageData(0, 0, 128, 128).data
      let R = 0, G = 0, B = 0, chr = 0
      for (let i = 0; i < 128 * 128; i++) {
        const a = d[i * 4], b = d[i * 4 + 1], c = d[i * 4 + 2]
        R += a; G += b; B += c; chr += Math.max(a, b, c) - Math.min(a, b, c)
      }
      const k = 128 * 128
      const u = e.terrain.mapUniforms
      return {
        R: +(R / k).toFixed(1), G: +(G / k).toFixed(1), B: +(B / k).toFixed(1), chroma: +(chr / k).toFixed(2),
        uTint: u.uTint.value, uHC: u.uHeightContrast.value, uHP: u.uHeightPivot.value, uST: u.uSlopeTint.value,
        alt: Math.round(e.altitudeCadrageM?.() ?? 0),
        demMin: e.dem?.minM, demMax: e.dem?.maxM, demW: e.dem?.width, ext: Math.round(e.dem?.extentMeters ?? 0),
        busy: !!e.modes?.busy,
        cart: document.querySelector('.ce-hud, #hud, [class*=announce]')?.textContent?.trim().slice(0, 40) || '',
      }
    } catch (err) { return { err: String(err) } }
  }
})
const ech = () => page.evaluate(() => window.__surEch())
const journal = []
const note = async (etape) => { const s = await ech(); journal.push({ etape, ...s }); if (process.env.SUR_SHOTS) await page.screenshot({ path: OUT + "/" + etape + ".png" }); return s }
await note('avant')
await page.screenshot({ path: `${OUT}/avant.png` })
for (let c = 0; c < CRANS; c++) {
  await page.evaluate(() => window.__exp.modes.cranZoom(1))
  for (let i = 0; i < 10; i++) { await dodo(300); await note(`c${c + 1}.${i}`) }
}
await dodo(8000)
await note('fin')
await page.screenshot({ path: `${OUT}/apres.png` })
fs.writeFileSync(`${OUT}/suite.json`, JSON.stringify(journal, null, 0))
for (const x of journal) console.log(x.etape, 'chroma', x.chroma, 'RGB', x.R, x.G, x.B, '| uTint', x.uTint, 'HC', x.uHC, 'HP', x.uHP, 'ST', x.uST, '| alt', x.alt, 'dem', x.demMin + '/' + x.demMax, 'w', x.demW, 'ext', x.ext, x.busy ? 'BUSY' : '', x.err || '')
await nav.close()
