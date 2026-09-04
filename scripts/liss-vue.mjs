// LISS — LES CAPTURES POUR ADRIEN, au cadrage de sa vidéo.
//
// Reprend le protocole d'amorçage de `scripts/b6-vue.mjs` (attente du globe,
// attente de la stabilisation, Échap pour dégager le voile `.ce-elemwrap`,
// `gotoCtl.go` puis molette ARRIÈRE) et ne fait qu'une chose de plus : capturer.
//
// ⚠️ `--sens 1` = molette ARRIÈRE (dézoom). B6 a payé l'inverse : un relevé pris
// à 112 m d'altitude ressemble exactement à un relevé propre, mais ce n'est pas
// la scène d'Adrien.
// ⚠️ ⛔ ON NE TUE QUE SON PROPRE CHROME : `nav.close()`, jamais un taskkill.
//
//   node scripts/liss-vue.mjs --port 9711 --dossier avant
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9711'))
const ICI = path.join(RACINE, '.banc', 'LISS', opt('--dossier', 'apres'))
fs.mkdirSync(ICI, { recursive: true })
const W = 1280, H = 800, CX = W / 2, CY = H / 2

// lieu | crans de molette arrière — les trois que le brief demande
const PLANS = JSON.parse(opt('--plans', JSON.stringify([
  { nom: 'rodrigues', ll: '-19.7253,63.3691', crans: 9 },
  { nom: 'rodrigues-large', ll: '-19.7253,63.3691', crans: 16 },
  { nom: 'moorea-lagon', ll: '-17.5388,-149.8295', crans: 4 },
  { nom: 'bretagne', ll: '48.3904,-4.4861', crans: 5 },
])))

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
console.log(`  chrome pid ${nav.process()?.pid} — ⛔ celui-là et pas un autre`)
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 180000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
await page.waitForFunction(() => {
  const e = window.__exp
  const d = e.camera.position.distanceTo(e.controls.target)
  const R = (window.__stab ??= { d: NaN, t: 0 })
  if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
  return d > 100 && !e.modes.busy && performance.now() - R.t > 1500
}, { timeout: 120000, polling: 100 })
for (let k = 0; k < 12; k++) {
  await page.keyboard.press('Escape').catch(() => {})
  await dodo(250)
  if ((await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName)) === 'CANVAS') break
}
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const cran = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: d, pointerType: 'mouse' })

for (const p of PLANS) {
  await page.evaluate((q) => window.__exp.gotoCtl.go(q), p.ll)
  await dodo(9000); await wait(30)
  for (let k = 0; k < p.crans; k++) { await cran(120); await wait(3) }
  // ⚠️ UN RELEVÉ SUR UNE IMAGE NE PROUVE RIEN : on laisse le quadtree finir de
  // charger (le brief : « 8 chargements au démarrage »).
  await dodo(14000); await wait(60)
  const f = path.join(ICI, `${p.nom}.png`)
  await page.screenshot({ path: f })
  console.log(`  ✔ ${f}`)
}
await nav.close()
