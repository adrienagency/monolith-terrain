// DIAG R28 — LA FUMÉE : le nuanceur se lie-t-il, et reste-t-il des tuiles ?
//
// ⛔ **C'EST LA LEÇON DE R25, ET ELLE A COÛTÉ UNE PASSE ENTIÈRE.** Un fragment
// qui refuse de se lier fait disparaître TOUTES les tuiles — et un banc
// différentiel ne le voit pas : dix-sept images cassées de la même façon
// s'écartent de 0,12 à 0,33, c'est-à-dire du bruit. **C'est la console qui le
// dit, pas la mesure.** Ce script ne mesure donc rien : il regarde la console,
// compte les programmes liés, et vérifie qu'il reste des pixels de planète.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5911'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
function trouverChrome() {
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
// ⚠️ le même repli que les autres sondes : `node_modules` est un LIEN vers
// l'arbre de fusion, qui n'a pas puppeteer-core.
const CHEMIN = [
  path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
  'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
].find((x) => fs.existsSync(x))
if (!CHEMIN) { console.error('puppeteer-core introuvable'); process.exit(2) }
const puppeteer = (await import('file:///' + CHEMIN.split('\\').join('/'))).default
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const journal = []
  page.on('pageerror', (e) => journal.push('pageerror: ' + String(e.message).slice(0, 300)))
  page.on('console', (m) => {
    const t = m.text()
    // ⚠️ on garde TOUT ce qui parle de nuanceur, quel que soit le niveau : three
    // rapporte les erreurs de liaison en `console.error` ET en `console.warn`.
    if (m.type() === 'error' || /shader|program|GLSL|THREE|compil/i.test(t)) journal.push(m.type() + ': ' + t.slice(0, 500))
  })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  // ⛔ **LA LECTURE SE FAIT DANS LE rAF, PAS APRES.** Premier jet de ce script :
  // `moy = 0`, `sigma = 0`, `calls = 1` — alors que le nuanceur compilait et que
  // la page etait juste. Hors de la boucle, le tampon par defaut a deja ete
  // efface et `info.render` porte le dernier passage du compositeur, pas la
  // scene. Un instrument qui lit au mauvais instant rend « rien ne se dessine »
  // sur une page saine : c'est un faux ⛔, et c'est le patron des autres sondes.
  const etat = await page.evaluate(() => new Promise((resolve) => {
    const e = window.__exp
    const R = e.renderer
    const gl = R.getContext()
    const CV = R.domElement
    const px = new Uint8Array(CV.width * CV.height * 4)
    requestAnimationFrame(() => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, CV.width, CV.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
    R.resetState?.()
    let s = 0, s2 = 0
    const N = CV.width * CV.height
    for (let i = 0; i < N; i++) {
      const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
      s += l; s2 += l * l
    }
    const m = s / N
    resolve({
      tuiles: e.globe.tiles?.size ?? -1,
      dessinees: R.info.render.calls,
      triangles: R.info.render.triangles,
      programmes: R.info.programs?.length ?? -1,
      moy: m, sigma: Math.sqrt(Math.max(0, s2 / N - m * m)),
      uTexShade: e.globe.uniforms.uTexShade.value,
      uNormaleFineOn: e.globe.uniforms.uNormaleFineOn.value,
      mode: e.modes.mode, altM: e.modes.altM, crop: !!e.globe._crop,
    })
    })
  }))
  console.log(JSON.stringify(etat, null, 1))
  const graves = journal.filter((l) => /error|Error|erreur|not compile|not link|WARNING: /.test(l))
  console.log('\njournal (' + journal.length + ' lignes, ' + graves.length + ' graves) :')
  for (const l of journal.slice(0, 25)) console.log('  ' + l)
  console.log(etat.triangles > 0 && etat.sigma > 1 ? '\n✅ des tuiles sont dessinees et l image a du contenu' : '\n⛔ RIEN NE SE DESSINE')
} finally {
  await nav.close()
}
