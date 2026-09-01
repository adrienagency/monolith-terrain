// SONDE R19 — ÉTAPE 2 : À QUEL « if » LA COURBE MEURT-ELLE ?
//
// ⚡ **UNE VALEUR DE SORTIE FORCÉE À CHAQUE ÉTAGE DU CALCUL.** Le nuanceur porte
// un `uDbgCourbes` TEMPORAIRE (bloc « SONDE R19 » de `src/globe.js`) qui
// remplace `gl_FragColor` par la grandeur demandée, avec la TERRE en vert et la
// MER en bleu : on lit donc la même grandeur des deux côtés du littoral, là où
// l'écran montre des courbes dans la mer et aucune sur la terre.
//
// ⚠️ **TOUT LE CALCUL RESTE DANS LA PAGE** (readPixels de 1 280 × 800, puis des
// scalaires) : faire traverser 4 Mo par image à CDP coûterait plus que le rendu.
//
// ⚠️ **ET LES ÉCHELLES SONT ÉTALONNÉES, PAS SUPPOSÉES** : le mode 12 rend
// `dedansCrop`, qui vaut exactement 0 ou 1 — il dit ce que 1,0 devient à
// l'écran après le composeur, donc ce que valent les autres modes.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5563'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R19'))
const VISIBLE = has('--visible')
const CAPTURES = has('--captures')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// La sonde vit dans la page : readPixels du tampon par défaut dans un rAF, puis
// des STATISTIQUES sur les seuls fragments du nuanceur de tuile (reconnus à leur
// vert/bleu de marquage).
function poserSonde() {
  const e = window.__exp
  if (window.__r19s) return 'déjà posée'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const etat = { n: 0, w: CV.width, h: CV.height }
  window.__r19s = etat
  let px = new Uint8Array(CV.width * CV.height * 4)
  let dernier = null
  // ⛔ **ON NE LIT PAS L'ÉCRAN, ON REDESSINE LE GLOBE SEUL.** Mesuré : lu après
  // le composeur, l'étalon `dedansCrop` — qui vaut exactement 0 ou 1 — ressort
  // entre 34 et 128. Bloom, mise au point et étalonnage écrasent la grandeur
  // sondée. On refait donc UNE passe brute de `sceneGlobe` / `camGlobe` dans le
  // tampon par défaut juste avant de lire : le nuanceur de tuile écrit
  // `gl_FragColor` en direct, sans chunk de tonemapping ni d'espace de couleur.
  function lire() {
    if (px.length !== CV.width * CV.height * 4) { px = new Uint8Array(CV.width * CV.height * 4); etat.w = CV.width; etat.h = CV.height }
    R.setRenderTarget(null)
    R.clear()
    R.render(e.sceneGlobe, e.camGlobe)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, CV.width, CV.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
    R.resetState?.()
    dernier = px.slice()
    etat.n++
  }
  function boucle() { try { lire() } catch (err) { etat.erreur = String(err).slice(0, 140) } requestAnimationFrame(boucle) }
  // TERRE : vert marqué (~89), bleu nul. MER : bleu marqué, vert nul.
  etat.stats = () => {
    if (!dernier) return null
    const res = {}
    for (const [nom, test] of [['terre', (g, b) => g > 60 && g < 120 && b < 20], ['mer', (g, b) => b > 60 && b < 120 && g < 20]]) {
      let n = 0, som = 0, mn = 255, mx = 0
      const hist = new Array(16).fill(0)
      for (let i = 0; i < dernier.length; i += 4) {
        const r = dernier[i], g = dernier[i + 1], b = dernier[i + 2]
        if (!test(g, b)) continue
        n++; som += r; if (r < mn) mn = r; if (r > mx) mx = r
        hist[Math.min(15, r >> 4)]++
      }
      res[nom] = n ? { n, moy: +(som / n).toFixed(2), min: mn, max: mx, hist } : { n: 0 }
    }
    return res
  }
  requestAnimationFrame(boucle)
  return 'posée'
}

const MODES = [
  [12, 'dedansCrop (étalon 0/1)'],
  [9, 'h en metres  (h+3000)/6000'],
  [7, 'fract(ch)'],
  [10, 'abs(fract(ch+0.5)-0.5) x 2'],
  [1, 'dch x 50'],
  [11, '|grad h| ecran x 0,02'],
  [4, 'minor'],
  [5, 'major'],
  [2, 'crowd'],
  [3, 'minFade'],
  [8, 'texel x 0,2'],
  [6, 'contour'],
]

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { port: PORT, modes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (er) => console.log('ERREUR PAGE', String(er.message).slice(0, 240)))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 240)) })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.modes, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => { window.__exp.params.animations = false })
  // Le chemin réel : les courbes sont ÉTEINTES par le gabarit d'ouverture.
  await page.evaluate(() => {
    const e = window.__exp
    e.params.contourOpacity = 1
    e.terrain.mapUniforms.uContourOpacity.value = 1
  })
  await dodo(2500)
  await page.evaluate(poserSonde)
  await dodo(1200)

  for (const [m, nom] of MODES) {
    await page.evaluate((v) => { window.__exp.globe.uniforms.uDbgCourbes.value = v }, m)
    await dodo(1200)
    const st = await page.evaluate(() => window.__r19s.stats())
    journal.modes.push({ mode: m, nom, ...st })
    const f = (x) => x && x.n ? `n=${x.n} moy=${x.moy} min=${x.min} max=${x.max}` : 'aucun fragment'
    console.log(`[${String(m).padStart(2)}] ${nom.padEnd(28)} TERRE ${f(st.terre)} | MER ${f(st.mer)}`)
    if (CAPTURES) await page.screenshot({ path: path.join(SORTIE, `sonde-${String(m).padStart(2, '0')}.png`) })
  }
  await page.evaluate(() => { window.__exp.globe.uniforms.uDbgCourbes.value = 0 })
  fs.writeFileSync(path.join(SORTIE, 'etape2-sonde.json'), JSON.stringify(journal, null, 1))
} finally { await nav.close() }
