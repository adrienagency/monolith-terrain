// B6 — LA VUE RÉELLE, cadrée comme la vidéo d'Adrien : Rodrigues, molette
// arrière, capture d'écran + comptage des PLAQUES dans les tuiles du quadtree.
//
// « PLAQUE » = un pixel de tuile qui ressort ÉMERGÉ (>= 0) alors que la tuile
// est entièrement en pleine mer (le trait de côte n'y déclare aucune terre).
// C'est ce que le nuanceur peint en couleur de TERRE au milieu de l'océan.
// On compte aussi les tuiles ENTIÈREMENT à zéro : la plaque rectangulaire
// pleine, la plus visible.
//
//   node scripts/b6-vue.mjs --port 9317 --lieu -19.7253,63.3691 --nom rodrigues --crans 9
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const LL = opt('--lieu', '-19.7253,63.3691')
const NOM = opt('--nom', 'rodrigues')
const CRANS = Number(opt('--crans', '9'))
const ICI = path.join(RACINE, '.banc', 'B6', opt('--dossier', 'apres'))
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

await page.evaluate((q) => window.__exp.gotoCtl.go(q), LL)
await dodo(9000); await wait(30)
const SENS = Number(opt('--sens', '1')) // +1 = molette ARRIÈRE (dézoom), comme la vidéo
for (let k = 0; k < CRANS; k++) { await cran(120 * SENS); await wait(3) }
await dodo(12000); await wait(60)
await page.screenshot({ path: path.join(ICI, `${NOM}.png`) })

const R = await page.evaluate(async () => {
  const { vetoTerre, merFranche } = await import('/src/coast-veto.js')
  const g = window.__exp.globe
  const tuiles = [...g.tiles.values()].filter((t) => t.heights)
  let plaquePx = 0, tuilesPleines = 0, tuilesOceanes = 0, pxOceans = 0, tuilesTotal = 0
  const detail = []
  for (const t of tuiles) {
    tuilesTotal++
    const px = t.size ?? Math.round(Math.sqrt(t.heights.length))
    const n = 2 ** t.z
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + 0.5)) / n))) * 180) / Math.PI
    const pasM = ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** t.z) * (256 / px)
    const veto = await vetoTerre({
      u0: t.x / n, u1: (t.x + 1) / n, v0: t.y / n, v1: (t.y + 1) / n,
      largeur: px, hauteur: px, metresParCellule: pasM, zoom: t.z, cle: `t/${t.z}/${t.x}/${t.y}/${px}`,
    })
    const franche = await merFranche({
      u0: t.x / n, u1: (t.x + 1) / n, v0: t.y / n, v1: (t.y + 1) / n,
      largeur: px, hauteur: px, metresParCellule: pasM, zoom: t.z, cle: `t/${t.z}/${t.x}/${t.y}/${px}`,
    })
    let terreCote = 0
    if (veto) for (const v of veto) if (v) terreCote++
    if (terreCote > 0) continue // la tuile touche une vraie terre : hors sujet
    tuilesOceanes++
    let emerges = 0, zeros = 0, hMax = -Infinity
    for (let i = 0; i < t.heights.length; i++) { const h = t.heights[i]; if (h >= 0) { emerges++; if (h > hMax) hMax = h }; if (h === 0) zeros++ }
    plaquePx += emerges
    pxOceans += t.heights.length
    if (emerges === t.heights.length) { tuilesPleines++; detail.push(`${t.z}/${t.x}/${t.y} PLEINE (${zeros} zéros) franche=${franche}`) }
    else if (emerges > 0) detail.push(`${t.z}/${t.x}/${t.y} ${emerges}/${t.heights.length} hMax=${hMax.toFixed(3)} zéros=${zeros} franche=${franche}`)
  }
  const c = window.__exp.camera, ct = window.__exp.controls
  return {
    alt: +c.position.distanceTo(ct.target).toFixed(0),
    tuilesTotal, tuilesOceanes, pxOceans, plaquePx, tuilesPleines,
    partPlaques: pxOceans ? +((100 * plaquePx) / pxOceans).toFixed(3) : null,
    detail: detail.slice(0, 40),
  }
})
console.log(`\n${NOM} · ${LL} · ${CRANS} crans · altitude ${R.alt} m`)
console.log(`  tuiles en cache ${R.tuilesTotal} · dont EN PLEINE MER (aucune terre au trait de côte) ${R.tuilesOceanes} (${R.pxOceans} px)`)
console.log(`  ⛔ PLAQUES : ${R.plaquePx} px émergés en pleine mer (${R.partPlaques} %) · tuiles ENTIÈREMENT émergées : ${R.tuilesPleines}`)
for (const d of R.detail) console.log('     ' + d)
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
