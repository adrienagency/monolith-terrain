// DIAG BLA — LA BORNE DE LA BRUME DE DISTANCE : trois candidats, mêmes vues.
// Pose uFdFacteur = demiCropM / D pour D ∈ {20, 40, 80 km} et mesure la fenêtre
// centrale (luminance, chroma) à z9 / z11 / z13 — même session, même chemin.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '9711'))
const SORTIE = path.join(RACINE, '.banc/BLA/distance')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LIEU = { lat: 44.2, lon: 5.78 }
const CURSEURS = { texShade: 0.98, wetK: 0.88, expoK: 1, treeLine: 0.99, hazeAmt: 0.68, rampDry: 1, rampWet: 1 }
const BORNES = [20000, 40000, 80000, Infinity]
const FENETRE = { x0: 0.32, x1: 0.68, y0: 0.28, y1: 0.72 }
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}
async function mesurerPng(b64, fen) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
  const x0 = Math.round(c.width * fen.x0), x1 = Math.round(c.width * fen.x1), y0 = Math.round(c.height * fen.y0), y1 = Math.round(c.height * fen.y1)
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let L = 0, C = 0, n = 0
  for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; L += 0.2126 * r + 0.7152 * gg + 0.0722 * b; C += Math.max(r, gg, b) - Math.min(r, gg, b); n++ }
  return { lum: L / n, chroma: C / n }
}
function poserCurseurs(c) { const e = window.__exp; Object.assign(e.params, c); e.terrain.applyColorParams(e.params); e.terrain.rebuildRamp(e.params); e.blockGrid?.restyle(e.params) }
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = []
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.terrain, { timeout: 180000, polling: 100 })
  await dodo(9000); await page.keyboard.press('Escape'); await dodo(1500)
  await page.evaluate(() => { window.__exp.params.animations = false })
  await page.evaluate(poserCurseurs, CURSEURS)
  for (const z of [9, 11, 13]) {
    await page.evaluate((a) => window.__exp.modes.flyTo(a.lat, a.lon, a.zoom), { ...LIEU, zoom: z })
    await dodo(2000)
    await page.waitForFunction(() => { const e = window.__exp; return !e.modes.busy && !e.modes.travel && e.globe.tuilesEnVol() === 0 }, { polling: 250, timeout: 120000 }).catch(() => {})
    await dodo(7000)
    await page.evaluate(poserCurseurs, CURSEURS)
    await dodo(1500)
    const demiM = await page.evaluate(() => window.__exp.globe.uniforms.uCropDemiM.value)
    const ligne = { zoom: z, demiM, mesures: {} }
    for (const D of BORNES) {
      const f = D === Infinity ? 0 : demiM / D
      await page.evaluate((v) => { window.__exp.globe.uniforms.uFdFacteur.value = v }, f)
      await dodo(900)
      const b64 = await page.screenshot({ encoding: 'base64' })
      const nom = `z${z}-D${D === Infinity ? 'inf' : D / 1000}k`
      fs.writeFileSync(path.join(SORTIE, nom + '.png'), Buffer.from(b64, 'base64'))
      ligne.mesures[nom] = { facteur: f, ...(await page.evaluate(mesurerPng, b64, FENETRE)) }
    }
    // témoin : le voile éteint
    await page.evaluate(() => { window.__exp.globe.uniforms.uHazeAmt.value = 0 })
    await dodo(900)
    const b64 = await page.screenshot({ encoding: 'base64' })
    ligne.mesures['haze0'] = await page.evaluate(mesurerPng, b64, FENETRE)
    await page.evaluate((c) => { window.__exp.globe.uniforms.uHazeAmt.value = c.hazeAmt }, CURSEURS)
    rapport.push(ligne)
    console.log(`z${z} demiM=${demiM.toFixed(0)}`)
    for (const [k, m] of Object.entries(ligne.mesures)) console.log(`  ${k.padEnd(10)} f=${(m.facteur ?? NaN).toFixed(3)} lum=${m.lum.toFixed(1)} chroma=${m.chroma.toFixed(1)}`)
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, 'distance.json'), JSON.stringify(rapport, null, 1))
