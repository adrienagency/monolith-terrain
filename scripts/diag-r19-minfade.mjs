// DIAGNOSTIC R19 — ÉTAPE 2 (suite) : ON NEUTRALISE VRAIMENT `minFade`.
//
// ⛔ **R18 A CRU LE NEUTRALISER EN POSANT `uMppFacteur = 0`.** Cette écriture ne
// neutralise rien : elle fait BASCULER DE BRANCHE.
//
//     float texel = uMppFacteur > 0.0 ? texelMonde : texelTuile;
//     float minFade = clamp(1.6 - texel * 0.55, 0.0, 1.0);
//
// `uMppFacteur = 0` renvoie sur `texelTuile`, qui est l'ancienne loi — pas sur
// `minFade = 1`. La seule neutralisation vraie est de rendre `texel` NUL, et le
// seul chemin qui le fasse sans toucher au nuanceur est `uResRefM` immense.
//
// On mesure les trois états avec l'instrument de R18 (condensé 256 × 160).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5563'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R19'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LARG = 256, HAUT = 160

const { poserInstrument } = await import('file:///' + path.join(RACINE, 'scripts/instrument-r19.mjs').replace(/\\/g, '/'))
function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { essais: [], distances: {} }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (er) => console.log('ERREUR PAGE', String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.modes, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(poserInstrument, LARG, HAUT)
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1500)

  // ══════ LA GÉOMÉTRIE DU CADRAGE, MESURÉE ET NON DÉDUITE ═══════════════════
  journal.cadrage = await page.evaluate(() => {
    const e = window.__exp
    const u = e.globe.uniforms
    const cam = e.camGlobe
    return {
      fov: cam.fov,
      distCentreGlobe: cam.position.length(),
      mppFacteur: u.uMppFacteur.value,
      resRefM: u.uResRefM.value,
      cropDemi: u.uCropDemi?.value ? { x: u.uCropDemi.value.x, y: u.uCropDemi.value.y } : null,
      dessin: { w: e.renderer.domElement.width, h: e.renderer.domElement.height },
      dpr: window.devicePixelRatio,
      demZoom: e.params.demZoom ?? null,
      zoom: e.params.zoom ?? null,
    }
  })
  console.log('CADRAGE :', JSON.stringify(journal.cadrage))

  const essais = [
    ['op0', { op: 0 }],
    ['op1', { op: 1 }],
    ['op1-mpp0(R18)', { op: 1, mpp: 0 }],          // ce que R18 a réellement fait
    ['op1-minFade1', { op: 1, res: 1e9 }],         // la vraie neutralisation
    ['op1-minFade1-int100', { op: 1, res: 1e9, iv: 100 }],
  ]
  for (const [nom, c] of essais) {
    await page.evaluate((c) => {
      const e = window.__exp
      const u = e.globe.uniforms
      window.__r19ref = window.__r19ref || { mpp: u.uMppFacteur.value, res: u.uResRefM.value }
      e.params.contourOpacity = c.op
      e.terrain.mapUniforms.uContourOpacity.value = c.op
      window.__r19cfg = c
    }, c)
    await dodo(2200)
    // ⛔ **UNE ÉCRITURE PAR IMAGE NE SUFFIT PAS, ET C'EST MESURÉ.** `majLoiTextureMonde`
    // repose `uResRefM` À CHAQUE IMAGE, et le rendu a lieu DANS la boucle de
    // l'application — donc avant mon `requestAnimationFrame`, enregistré plus
    // tard. Premier essai : `uResRefM` lu à 1e9 après coup, image inchangée au
    // bit près. On VERROUILLE donc l'uniforme par un accesseur : `three` lit
    // `.value` au moment du téléversement, personne ne peut plus l'écraser.
    await page.evaluate(() => {
      const u = window.__exp.globe.uniforms
      const c = window.__r19cfg
      const bloquer = (nom, v) => {
        const o = u[nom]
        if (o.__r19fige) { o.__r19v = v; return }
        o.__r19v = v
        delete o.value
        Object.defineProperty(o, 'value', { get() { return this.__r19v }, set() {}, configurable: true })
        o.__r19fige = true
      }
      const rendre = (nom) => {
        const o = u[nom]
        if (!o.__r19fige) return
        const v = o.__r19v
        delete o.value
        o.value = v
        o.__r19fige = false
      }
      for (const [nom, cle] of [['uMppFacteur', 'mpp'], ['uResRefM', 'res'], ['uContourInterval', 'iv']]) {
        if (c[cle] != null) bloquer(nom, c[cle]); else rendre(nom)
      }
    })
    await dodo(1500)
    await page.evaluate(() => window.__r19.vider())
    await page.waitForFunction(() => window.__r19.pret(6), { timeout: 30000, polling: 100 })
    await page.evaluate((n) => window.__r19.capturer(n, 6), nom)
    const lu = await page.evaluate(() => {
      const u = window.__exp.globe.uniforms
      return { op: u.uContourOpacity.value, iv: u.uContourInterval.value, mpp: +u.uMppFacteur.value.toFixed(3), res: u.uResRefM.value }
    })
    journal.essais.push({ nom, lu })
    await page.screenshot({ path: path.join(SORTIE, `e2-${nom.replace(/[()]/g, '')}.png`) })
    console.log('relevé', nom, JSON.stringify(lu))
  }
  for (const [a, b] of [['op0', 'op1'], ['op0', 'op1-mpp0(R18)'], ['op0', 'op1-minFade1'], ['op1', 'op1-minFade1'], ['op0', 'op1-minFade1-int100']]) {
    const d = await page.evaluate((x, y) => window.__r19.distance(x, y), a, b)
    journal.distances[`${a} → ${b}`] = d
    console.log(`Δ ${a} → ${b} : moy ${d.moy.toFixed(4)} | grad ${d.grad.toFixed(4)}`)
  }
  fs.writeFileSync(path.join(SORTIE, 'etape2-minfade.json'), JSON.stringify(journal, null, 1))
} finally { await nav.close() }
