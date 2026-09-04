// SUR — la finesse servie de part et d'autre des crans : mètres par texel du
// MNT, et l'amplitude d'altitude sur laquelle la rampe se re-normalise.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9833')
const OUT = opt('--out', '.banc/SUR')
fs.mkdirSync(OUT, { recursive: true })
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--window-size=1280,920', '--use-angle=default'], defaultViewport: { width: 1280, height: 800 } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(150) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
await page.evaluate(() => window.__exp.modes.flyTo(46.0122, 7.8223, 11))
await dodo(15000)
const lis = () => page.evaluate(() => {
  const e = window.__exp, d = e.dem, u = e.terrain.mapUniforms
  const n = d?.data?.length ? Math.round(Math.sqrt(d.data.length)) : null
  return { min: d?.minM, max: d?.maxM, ampl: d ? +(d.maxM - d.minM).toFixed(0) : null, ext: Math.round(d?.extentMeters ?? 0), n, mParTexel: n && d ? +(d.extentMeters / n).toFixed(1) : null, uTint: u.uTint.value, uHC: u.uHeightContrast.value, uHP: u.uHeightPivot.value, alt: Math.round(e.altitudeCadrageM?.() ?? 0), grade: e.reliefGrade }
})
const t = [{ cran: 0, ...(await lis()) }]
for (let c = 1; c <= 9; c++) { await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(3500); t.push({ cran: c, ...(await lis()) }) }
fs.writeFileSync(`${OUT}/finesse.json`, JSON.stringify(t, null, 1))
for (const x of t) console.log(`cran ${x.cran} · alt ${x.alt} m · MNT ${x.n}x${x.n} sur ${x.ext} m = ${x.mParTexel} m/texel · altitudes ${x.min}–${x.max} (amplitude ${x.ampl} m) · uTint ${x.uTint} contraste ${x.uHC} pivot ${x.uHP}`)
await nav.close()
