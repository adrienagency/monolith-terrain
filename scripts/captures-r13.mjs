// CAPTURES R13 — LE GESTE, À L'ÉCRAN, DE L'ORBITE AU BLOC.
//
// Trois stations (orbite haute, mi-descente, bloc) et, à chacune, un glissé de
// 100 px filmé en cinq images. ⚡ Ce qu'il faut regarder n'est pas la beauté du
// rendu mais **où est le centre du bloc (ou de la Terre) d'une image à l'autre** :
// en orbite il ne bouge jamais, et c'est ce qu'Adrien appelle « parfait ».
//
// ⛔ **LE SPIN D'INACTIVITÉ EST GELÉ PAR LE BOUTON TENU** — `main.js` fait
// tourner la planète après 3 s sans entrée, et une capture prise bouton relâché
// mesurerait cette rotation-là (témoin : 2,79° en 4,5 s, `.banc/R13/apres.json`).
//
//   node scripts/captures-r13.mjs --port 5549

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R13', 'captures')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5549'))
const W = 1280, H = 800

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 60000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 90000 })
await wait(200)

const CX = W / 2, CY = H / 2
const m = (t, x, y, b = 'left', bs = 1) => cdp.send('Input.dispatchMouseEvent', { type: t, x, y, button: b, buttons: bs, clickCount: t === 'mousePressed' ? 1 : 0 })
const shot = (n) => page.screenshot({ path: path.join(ICI, n + '.png') })
const etat = () => page.evaluate(`(() => {
  const e = window.__exp, c = e.controls, cam = e.camera
  const V = new (cam.position.constructor)(0, 0, 0); V.project(cam)
  // ⛔ le canevas, pas la fenêtre : le Race Studio en occupe la moitié gauche
  const r = e.renderer.domElement.getBoundingClientRect()
  return { mode: e.modes.mode, altM: e.modes.altM, rotateSpeed: c.rotateSpeed,
    azimut: c.getAzimuthalAngle(), polaire: c.getPolarAngle(), canevas: [r.width, r.height],
    centre: { x: (V.x * .5 + .5) * r.width, y: (-V.y * .5 + .5) * r.height } }
})()`)

const journal = []
async function station(nom) {
  await m('mouseMoved', CX, CY, 'none', 0); await wait(1)
  await m('mousePressed', CX, CY); await wait(3)
  const suite = []
  for (let i = 0; i <= 4; i++) {
    if (i > 0) { await m('mouseMoved', CX + 25 * i, CY); await wait(30) }
    suite.push(await etat())
    await shot(`${nom}-${i}`)
  }
  await m('mouseReleased', CX + 100, CY, 'left', 0); await wait(10)
  const d = Math.hypot(suite[4].centre.x - suite[0].centre.x, suite[4].centre.y - suite[0].centre.y)
  journal.push({ station: nom, mode: suite[0].mode, altM: suite[0].altM, rotateSpeed: suite[0].rotateSpeed, deriveCentrePx: d, suite })
  console.log(`${nom.padEnd(22)} ${suite[0].mode.padEnd(9)} alt ${Math.round(suite[0].altM)} m  rotSpeed ${suite[0].rotateSpeed}  centre dérive ${d.toFixed(3)} px`)
}

// ⚠️ ÉCHAUFFEMENT : le tout premier `pointerdown` d'une session n'atteint pas
// OrbitControls (mesuré : 0,000° pour 100 px). Sans lui la première station
// rendrait un faux zéro.
await m('mouseMoved', CX, CY, 'none', 0); await m('mousePressed', CX, CY); await wait(3)
await m('mouseMoved', CX + 20, CY); await wait(40); await m('mouseReleased', CX + 20, CY, 'left', 0); await wait(120)
// ⚡ ET ON DÉCENTRE : cible et centre du bloc coïncident à l'ouverture, où les
// deux pivots rendraient le même chiffre. Le clic droit fait glisser la fenêtre
// de terrain — c'est ainsi que la cible s'éloigne de l'axe dans la vraie vie.
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY, button: 'right', buttons: 2, clickCount: 1 })
await wait(3)
for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX - 14 * i, y: CY - 8 * i, button: 'right', buttons: 2 }); await wait(2) }
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX - 168, y: CY - 96, button: 'right', buttons: 0 })
await wait(220)

await station('3-bloc')
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 60000 })
await wait(120)
await station('1-orbite-haute')
await page.evaluate(() => { const m = window.__exp.modes; m.orbAlt = m.orbAltTarget = 400000 / 63710; m._diveArmed = false })
await wait(60)
await station('2-descente-400km')

fs.writeFileSync(path.join(ICI, 'captures.json'), JSON.stringify(journal, null, 1), 'utf8')
await nav.close()
console.log(`\n→ .banc/R13/captures/ (${journal.length * 5} images)`)
