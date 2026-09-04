// CAPTURES POUR ADRIEN — LE CHANGEMENT D'ÉCHELLE, AVANT ET APRÈS D25.
//
// Le geste film\u00e9 : une carte nette, puis un changement d'\u00e9chelle. On photographie
// l'instant juste avant, puis 1, 3, 6 et 12 images apr\u00e8s. Sous le palier atomique
// les quatre images d'apr\u00e8s sont la « surcouche » ; sans lui, le centre reste net
// et seuls les bords neufs s'affinent.
//
//   node scripts/captures-tuile.mjs --port 9917 --lieu alpes --alt 600 --etiq apres
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9917'))
const LIEU = opt('--lieu', 'alpes')
const ALT = Number(opt('--alt', '600'))
const ETIQ = opt('--etiq', 'apres')
const DE = Number(opt('--de', '15'))
const VERS = Number(opt('--vers', '14'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'TUILE', 'cliches'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LIEUX = { alpes: [45.92, 6.87], majorque: [39.62, 2.98], beauce: [48.20, 1.72] }

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH)
  if (d) return d
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  // ⚠️ le voile `.ce-elemwrap` avale les gestes : on le retire, comme les sondes CN.
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  await dodo(2500)
  const [lat, lon] = LIEUX[LIEU] || LIEUX.alpes
  await page.evaluate(async ({ la, lo, z }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: z }, 'TUILE')
  }, { la: lat, lo: lon, z: DE })
  await dodo(4000)
  await page.evaluate(async (a) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-6; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const cur = e.altitudeCadrageM()
      if (!Number.isFinite(cur) || cur <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (a / cur)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      await new Promise((r) => setTimeout(r, 120))
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
  }, ALT)
  await dodo(16000)
  const etat = async () => page.evaluate(() => ({ servi: window.__exp.globe._zCropServi, cible: window.__exp.globe._zCropCible, alt: Math.round(window.__exp.altitudeCadrageM()) }))
  console.log(`${ETIQ} · avant le changement d’échelle : ${JSON.stringify(await etat())}`)
  await page.screenshot({ path: path.join(SORTIE, `${ETIQ}-${LIEU}-00-avant.png`) })
  // LE CHANGEMENT D'ÉCHELLE
  await page.evaluate(async ({ la, lo, z }) => { await window.__exp.modes._rescale({ lat: la, lon: lo, zoom: z }, 'TUILE') }, { la: lat, lo: lon, z: VERS })
  for (const ms of [80, 250, 600, 1500, 4000]) {
    await dodo(ms)
    const e = await etat()
    const nom = `${ETIQ}-${LIEU}-apres-${String(ms).padStart(4, '0')}ms`
    await page.screenshot({ path: path.join(SORTIE, `${nom}.png`) })
    console.log(`   +${ms} ms → ${JSON.stringify(e)} · ${nom}.png`)
  }
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
