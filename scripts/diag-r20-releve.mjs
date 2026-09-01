// RELEVÉ R20 — les nombres du repère du crop, pris à MON banc, pour le test.
// ⛔ On ne recopie pas le relevé de D16-c : on le refait.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
fs.mkdirSync(SORTIE, { recursive: true })
const trouverChrome = () => ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
let out = {}
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(13000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)
  out = await page.evaluate(() => {
    const e = window.__exp
    const g = e.globe
    const par = g?._parois || g?.parois || null
    let paroisPose = null
    if (par) {
      const o = par.mesh || par.group || par
      o.updateMatrixWorld?.(true)
      paroisPose = { position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray() }
    }
    // le ciel : la plus haute boîte, en unités de BLOC
    const sky = e.clouds?.sky
    let plafond = null
    if (sky) {
      let top = -Infinity
      for (const c of sky.clouds) top = Math.max(top, c.y + c.h * 1.15)
      plafond = { topBloc: +top.toFixed(4), ceilReglage: e.params.cloudAltitude, n: sky.clouds.length }
    }
    return {
      ancre: e.pilote?.latLonOrigineBloc?.() ?? null,
      cible: { lat: e.modes?.lat, lon: e.modes?.lon },
      params: { demZoom: e.params.demZoom, exageration: e.params.demExaggeration, source: e.params.source },
      baseYCrop: g?.baseYCrop,
      paroisPose,
      plafond,
      globeUniformes: Object.keys(g?.uniforms || {}).length,
    }
  })
  // le lat/lon d'origine et l'emprise : lus par la fonction qui les calcule
  out.viaSonde = await page.evaluate(() => {
    const e = window.__exp
    // reproduire ce que main.js appelle : on n'y a pas accès, on lit le globe
    const g = e.globe
    return { cropCentre: g?.uniforms?.uCropCentre?.value?.toArray?.(), cropDemi: g?.uniforms?.uCropDemi?.value?.toArray?.() ?? g?.uniforms?.uCropDemi?.value, resRefM: g?.uniforms?.uResRefM?.value }
  })
} catch (e) { out.erreur = String(e?.stack || e) } finally {
  fs.writeFileSync(path.join(SORTIE, 'releve.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
console.log(JSON.stringify(out, null, 1))
