// CAPTURES R18 — deux images par option, aux deux bouts de sa course.
//
// C'est la seule preuve qu'un chiffre ne remplace pas : « ça se voit » se
// regarde. La sonde d'image dit COMBIEN l'écran a bougé ; celle-ci dit À QUOI
// ça ressemble, et c'est ce qui décide si une option mérite d'être rebranchée.
//
// Usage : node scripts/captures-r18.mjs --cibles 16,17,19 [--fige] [--pre]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { poserCibles } from './cibles-studio-r18.mjs'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5561'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R18/captures'))
const CIBLES = (opt('--cibles', '') || '').split(',').filter((x) => x !== '').map(Number)
const ATTENTE = Number(opt('--attente', '2600'))

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
fs.mkdirSync(SORTIE, { recursive: true })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
    for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
    document.body.classList.add('ce-railL-off', 'ce-railR-off')
    window.__r18 = window.__r18 || {}
    if (window.__figeR18) window.__exp.params.animations = false
  })
  if (has('--fige')) await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1200)
  const liste = await page.evaluate(poserCibles)
  for (const i of CIBLES) {
    const c = liste[i]
    if (!c) { console.log('cible', i, 'absente'); continue }
    const base = `${i}-${(c.panneau + '-' + c.nom).replace(/[^\wÀ-ɏ-]+/g, '_').slice(0, 50)}`
    for (const ph of [0, 1]) {
      const pose = await page.evaluate((idx, p) => { try { return String(window.__r18.cibles[idx].apply(p)) } catch (er) { return 'ERR ' + er.message } }, i, ph)
      await dodo(ATTENTE)
      const f = path.join(SORTIE, `${base}-${ph === 0 ? 'min' : 'max'}.png`)
      await page.screenshot({ path: f })
      console.log(i, c.nom, ph === 0 ? 'min' : 'max', '=', pose, '→', f)
    }
    await page.evaluate((idx) => { try { window.__r18.cibles[idx].apply(2) } catch {} }, i)
    await dodo(ATTENTE)
  }
} finally {
  await nav.close()
}
