// DIAGNOSTIC R18 — « Échelle fine » ne tient pas sa valeur.
// Les chips ×1/×8 changent le relief (mesuré 0,138) ; le curseur qui écrit le
// MÊME paramètre rend 0,000. On regarde donc ce que devient la valeur.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const PORT = Number(opt('--port', '5561'))
async function chargerPuppeteer() {
  for (const p of ['C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => { for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed'); for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open') })
  const trace = await page.evaluate(async () => {
    const e = window.__exp
    const nomDe = (r) => { const l = r.querySelector('.ce-label'); return l ? [...l.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : '' }
    const row = [...document.querySelectorAll('.ce-row')].find((r) => nomDe(r) === 'Échelle fine')
    const inp = row.querySelector('input[type=range]')
    const out = { min: inp.min, max: inp.max, depart: e.params.demExaggeration, globeAvant: e.globe?.exaggeration }
    inp.value = '8'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    out.apresInput = e.params.demExaggeration
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    out.apresChange = e.params.demExaggeration
    out.valeurInput = inp.value
    await new Promise((r) => setTimeout(r, 3000))
    out.apres3s = e.params.demExaggeration
    out.globeApres = e.globe?.exaggeration
    out.valeurInput3s = inp.value
    out.source = e.params.source
    return out
  })
  console.log(JSON.stringify(trace, null, 1))
} finally { await nav.close() }
