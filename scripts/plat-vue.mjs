// PLAT — la vue réelle : requêtes AWS attribuées par appelant, carrés plats et
// pixels émergés lus AU GPU, capture d'écran. Protocole CHASSE.
//   node scripts/plat-vue.mjs --port 8231 --lieu 43.45,4.60 --nom camargue --crans 30
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8231'))
const LL = opt('--lieu', '43.45,4.60')
const NOM = opt('--nom', 'camargue')
const CRANS = Number(opt('--crans', '30'))
const ICI = path.join(RACINE, '.banc', 'PLAT', opt('--dossier', 'vue'))
fs.mkdirSync(ICI, { recursive: true })
const W = 1280, H = 800, CX = W / 2, CY = H / 2
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const hotes = {}
page.on('response', (r) => { let h; try { h = new URL(r.url()).host } catch { h = '?' }; hotes[h] = (hotes[h] ?? 0) + 1 })

// ⚠️ ATTRIBUER les requêtes AWS à leur appelant : la pile est prise DANS la page,
// avant tout `await`, donc elle nomme la fonction qui a lancé le fetch.
await page.evaluateOnNewDocument(() => {
  window.__aws = { total: 0, par: {} }
  const f = window.fetch
  window.fetch = function (...a) {
    const u = typeof a[0] === 'string' ? a[0] : a[0]?.url ?? ''
    if (u.includes('elevation-tiles-prod')) {
      window.__aws.total++
      const pile = (new Error().stack || '').split('\n').slice(1, 8).join(' | ')
      const cle = /dem\.js/.test(pile) ? (/loadDem|repar/.test(pile) ? 'dem.js' : 'dem.js') : /globe\.js/.test(pile) ? 'globe.js' : /flux-terrain/.test(pile) ? 'flux-terrain.js' : 'autre'
      window.__aws.par[cle] = (window.__aws.par[cle] ?? 0) + 1
      ;(window.__aws.piles ??= []).push(pile.slice(0, 300))
    }
    return f.apply(this, a)
  }
})

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

await page.evaluate(() => { window.__aws = { total: 0, par: {}, piles: [] } })
await page.evaluate((q) => window.__exp.gotoCtl.go(q), LL)
await dodo(9000); await wait(30)
for (let k = 0; k < CRANS; k++) { await cran(-120); await wait(2) }
await dodo(8000); await wait(30)
await page.screenshot({ path: path.join(ICI, `${NOM}.png`) })

// LE CHAMP RENDU, LU DANS LE MNT DU BLOC (pas dans la trame composée).
const champ = await page.evaluate(() => {
  const d = window.__exp?.dem ?? window.__exp?.terrain?.dem ?? window.__exp?.currentDem
  if (!d?.data) return { erreur: 'pas de dem exposé', cles: Object.keys(window.__exp || {}).slice(0, 60) }
  const a = d.data, s = d.size, P = 32
  let plateaux = 0, cases = 0, platsEmerges = 0
  for (let by = 0; by + P <= s; by += P) for (let bx = 0; bx + P <= s; bx += P) {
    let mn = Infinity, mx = -Infinity
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const v = a[(by + y) * s + bx + x]; if (v < mn) mn = v; if (v > mx) mx = v }
    cases++
    if (mx - mn <= 0.5) { plateaux++; if (mn > 0.5) platsEmerges++ }
  }
  return { size: s, zoom: d.zoom, mpp: d.metersPerPixel, minM: d.minM, maxM: d.maxM, cases, plateaux, platsEmerges, demSource: d.demSource }
})
const aws = await page.evaluate(() => ({ total: window.__aws.total, par: window.__aws.par, piles: window.__aws.piles.slice(0, 6) }))
const R = { nom: NOM, lieu: LL, crans: CRANS, hotes, aws, champ }
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
console.log(JSON.stringify(R, null, 2))
await nav.close()
