// SUR — on descend de 7 crans (là où Adrien voit la surcouche), puis on éteint
// les candidats UN PAR UN dans la MÊME session, à pose figée.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9833')
const OUT = opt('--out', '.banc/SUR-ETEINDRE')
const CRANS = Number(opt('--crans', '7'))
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
await page.evaluate(() => window.__exp.modes.flyTo(46.0122, 7.8223, 11))
await dodo(15000)
for (let c = 0; c < CRANS; c++) { await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(3000) }
await dodo(6000)
const etat = await page.evaluate(() => {
  const e = window.__exp, u = e.terrain.mapUniforms
  const couches = {}
  for (const k of Object.keys(e.params)) if (/aerial|nuit|occup|canop|photo|sat/i.test(k)) couches[k] = e.params[k]
  return { dem: { min: e.dem?.minM, max: e.dem?.maxM, ext: Math.round(e.dem?.extentMeters ?? 0) }, u: { uTint: u.uTint.value, uHC: u.uHeightContrast.value, uHP: u.uHeightPivot.value, uST: u.uSlopeTint.value }, colorMode: e.params.colorMode, shadeAuto: e.params.shadeAuto, couches }
})
console.log(JSON.stringify(etat))
fs.writeFileSync(`${OUT}/etat.json`, JSON.stringify(etat, null, 1))
const cas = [
  ['A-tel-quel', '1'],
  ['B-teinte-hypso-0', 'window.__exp.terrain.mapUniforms.uTint.value=0'],
  ['C-retour', 'window.__exp.terrain.mapUniforms.uTint.value=window.__exp.params.mapTint'],
  ['D-mode-classique', 'window.__exp.setColorMode?window.__exp.setColorMode("classic"):0'],
  ['E-teinte-0-classique', 'window.__exp.terrain.mapUniforms.uTint.value=0'],
]
for (const [nom, js] of cas) { await page.evaluate(js).catch((e) => console.log(nom, 'REFUS', String(e).slice(0, 80))); await dodo(1500); await page.screenshot({ path: `${OUT}/${nom}.png` }) }
await nav.close()
