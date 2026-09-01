// DIAG R20 ③ — LA VOIE 1 EST-ELLE VIABLE ? On FORCE la coquille visible en vue
// de surface (uFade = 1, garde neutralisee) et on regarde ce qui apparait.
//
// ⛔ La garde `smoothstep(R*1.18, R*1.50, d)` de `globe-clouds.js` porte un
// commentaire d'intention (« the final approach to the surface stays crisp »).
// Un commentaire n'est pas une mesure. Cette sonde la leve et mesure.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
fs.mkdirSync(SORTIE, { recursive: true })
function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20.js'), 'utf8')
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = {}
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)
  await page.evaluate(instrument)
  await dodo(1000)

  // ── la geometrie de la coquille, en metres reels ────────────────────────
  out.geometrie = await page.evaluate(() => {
    const e = window.__exp
    const g = e.globe.clouds
    const R = g.radius
    const rayonCoquille = g.mesh.geometry.parameters.radius
    const M_PAR_U = 6371000 / R // le globe fait R unites pour 6371 km
    const tex = g.uniforms.uTex.value
    return {
      rayonGlobe: R,
      rayonCoquille,
      altitudeCoquilleM: (rayonCoquille - R) * M_PAR_U,
      texW: tex.image?.width ?? null,
      texH: tex.image?.height ?? null,
      // un texel a l'equateur, en metres
      texelEquateurM: tex.image?.width ? (2 * Math.PI * 6371000) / tex.image.width : null,
      camAltM: (e.camGlobe.position.length() - R) * M_PAR_U,
    }
  })
  console.log('geometrie', JSON.stringify(out.geometrie))

  // ── on force la garde, en vue de surface ───────────────────────────────
  const capt = async (etiq, avant) => {
    await page.evaluate(avant)
    await dodo(900)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate((n) => window.__r20.capturer(n, 8), etiq)
    await page.screenshot({ path: path.join(SORTIE, `voie1-${etiq}.png`) })
  }
  await capt('SANS', () => { window.__exp.globe.clouds.setVisible(true) })
  // la garde est reecrite a chaque image par update() : on la court-circuite
  await capt('FORCE', () => {
    const g = window.__exp.globe.clouds
    g.__maj = g.update.bind(g)
    g.update = (cam, dt) => { g.__maj(cam, dt); g.uniforms.uFade.value = 1 }
  })
  out.forcee = await page.evaluate(() => ({
    uFade: +window.__exp.globe.clouds.uniforms.uFade.value.toFixed(4),
    ecart: window.__r20.distance('SANS', 'FORCE'),
  }))
  console.log('forcee', JSON.stringify(out.forcee))
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-voie1.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
