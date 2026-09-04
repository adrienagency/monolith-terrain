// CAPTURE CN4 — le cartouche, OUVERT À L'ÉCRAN, avec sa valeur du moment.
//
// La sonde `sonde-cn4-cartouche.mjs` lit le `textContent` du libellé, ce qui
// suffit à COMPTER les écarts mais ne montre rien. Ici on ouvre réellement le
// panneau Terrain, on descend à l'altitude demandée, et on photographie la
// ligne « Détail (zoom) » telle qu'Adrien la voit — plus une capture de la page
// entière, pour que le relief affiché et le chiffre annoncé soient sur la même
// image.
//
//   node scripts/sonde-cn4-capture.mjs --port 9601 --lieu majorque --alt 300
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9601'))
const LIEU = opt('--lieu', 'majorque')
const ALT = Number(opt('--alt', '300'))
const ZOOM_BLOC = Number(opt('--zoombloc', '15'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'CN4', 'cliches'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const LIEUX = { majorque: [39.62, 2.98], beauce: [48.20, 1.72], zermatt: [46.02, 7.75], outback: [-23.70, 133.88] }

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH)
  if (d) return d
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'), path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
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
  // ⚠️ **LE DOCK N'EXISTE QU'EN MODE STUDIO** : en mode Explorer (le défaut),
  // `.ce-dock-left` est en `display:none` et le cartouche, quoique juste dans
  // le DOM, n'est PAS à l'écran. On pose donc le mode de travail avant le
  // premier script de la page — sinon la capture montrerait un panneau absent.
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 90000, polling: 200 }).catch(() => {})
  await dodo(2500)
  const [lat, lon] = LIEUX[LIEU] || LIEUX.majorque
  await page.evaluate(async ({ la, lo, z }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: z }, 'CN4')
  }, { la: lat, lo: lon, z: ZOOM_BLOC })
  await dodo(4000)
  // descendre à l'altitude
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
  await dodo(12000)
  // ouvrir le panneau qui porte le libellé, et le remonter à l'écran
  const ouvert = await page.evaluate(() => {
    let lab = null
    for (const n of document.querySelectorAll('.ce-label')) if ((n.textContent || '').startsWith('Détail (zoom)')) lab = n
    if (!lab) return { ok: false }
    // le panneau qui le porte : on le déplie (accordéon exclusif, `ui/shell.js`)
    document.body.classList.remove('ce-simple')
    const panneau = lab.closest('.ce-panel')
    panneau?.classList.remove('collapsed', 'wm-off')
    // puis la SECTION « Qualité » : son en-tête est le geste réel d'Adrien
    const sec = lab.closest('.ce-section')
    const tete = sec?.querySelector('.ce-section-head')
    if (tete && !sec.classList.contains('open')) tete.click()
    lab.scrollIntoView({ block: 'center' })
    const r = lab.getBoundingClientRect()
    return { ok: true, texte: lab.textContent, panneau: !!panneau, tete: !!tete, visible: r.width > 0 && r.height > 0 }
  })
  await dodo(600)
  const etiq = `${LIEU}-${ALT}m-cartouche`
  const rect = await page.evaluate(() => {
    let lab = null
    for (const n of document.querySelectorAll('.ce-label')) if ((n.textContent || '').startsWith('Détail (zoom)')) lab = n
    const r = lab?.closest('.ce-row')?.getBoundingClientRect() || lab?.getBoundingClientRect()
    return r ? { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: Math.min(700, r.width + 24), height: r.height + 24 } : null
  })
  await page.screenshot({ path: path.join(SORTIE, `${etiq}-page.png`) })
  if (rect && rect.width > 4 && rect.height > 4) await page.screenshot({ path: path.join(SORTIE, `${etiq}.png`), clip: rect })
  const etat = await page.evaluate(() => ({ servi: window.__exp.globe._zCropServi, maxZoom: window.__exp.dem?.maxZoom, alt: Math.round(window.__exp.altitudeCadrageM()) }))
  console.log(etiq, JSON.stringify(ouvert), JSON.stringify(etat), JSON.stringify(rect))
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
