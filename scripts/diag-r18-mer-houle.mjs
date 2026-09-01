// DIAGNOSTIC R18 — la houle du crop : traverse-t-elle, et se voit-elle ?
// Deux états extrêmes de « Hauteur des vagues », par le VRAI curseur, avec
// à chaque fois l'uniforme `uMerHoule` du maillage `crop-mer` ET une capture.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5561'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R18'))
const CLES = (opt('--cles', 'seaWaveH:0:2') || '').split(',')

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of ['C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = []
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  // vue rapprochée sur la mer : le bloc vu de haut à 18 km rend la houle
  // sous-pixellaire — une option peut être branchée ET invisible à cette échelle,
  // et c'est exactement la distinction que cette tâche doit trancher.
  const merU = () => page.evaluate(() => {
    let u = null
    window.__exp.sceneGlobe.traverse((o) => { if (o.name === 'crop-mer') u = o.material.uniforms })
    if (!u) return null
    const o = {}
    for (const k of ['uMerHoule', 'uMerChop', 'uMerVitesse', 'uMerTransp', 'uMerSoleilFx', 'uMerRefract', 'uMerEcume', 'uMerGivre', 'uMerUnite']) o[k] = u[k]?.value ?? null
    return o
  })
  for (const spec of CLES) {
    const [cle, bas, haut] = spec.split(':')
    for (const [etiq, val] of [['bas', +bas], ['haut', +haut]]) {
      await page.evaluate((k, v) => {
        const e = window.__exp
        e.params[k] = v
        e.realWater?.setWaves({ height: e.params.seaWaveH, choppiness: e.params.seaChop, speed: e.params.seaSpeed })
        e.realWater?.setLook(e.params)
      }, cle, val)
      await dodo(2200)
      const u = await merU()
      const f = path.join(SORTIE, `mer-${cle}-${etiq}.png`)
      await page.screenshot({ path: f })
      out.push({ cle, etiq, val, u, capture: f })
      console.log(cle, etiq, val, JSON.stringify(u))
    }
  }
} finally {
  await nav.close()
  fs.writeFileSync(path.join(SORTIE, 'diag-mer-houle.json'), JSON.stringify(out, null, 1))
}
