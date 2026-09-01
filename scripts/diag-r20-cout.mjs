// DIAG R20 ⑦ — LE COÛT, PESÉ EN FRAGMENTS ; ET LES TROIS CURSEURS DE MOUVEMENT.
//
// ⛔ **LE BANC DE CE DÉPÔT NE PÈSE PAS LES FRAGMENTS EN TEMPS CPU** : ×35 de
// fragments donne ×0,96 de temps par image (`diag-charge-fragment.mjs`, R6).
// `gl.finish()` synchronise, mais le temps qu'il rend est celui de la
// SOUMISSION. **Un effet volumétrique EST du fragment** : le mesurer là, ce
// serait mesurer zéro par construction.
//
// ⚡ **ON PÈSE DONC AVEC `EXT_disjoint_timer_query_webgl2`** — la minuterie du
// pilote, qui compte le temps passé DANS le GPU, fragments compris. Le témoin
// de sa validité est imprimé : `disjoint` doit rester faux, sinon le relevé est
// jeté par le pilote lui-même et le nombre ne vaut rien.
//
// ⚠️ **ET LES TROIS CURSEURS DE MOUVEMENT NE SE MESURENT PAS À IMAGE FIGÉE.**
// `windSpeed`, `cloudDrift` et `cloudDriftVar` ne changent QUE le déplacement.
// Le banc coupe le mouvement ambiant pour descendre son plancher de bruit à
// 0,0000 — donc il les rend nuls PAR CONSTRUCTION. On les mesure autrement :
// mouvement REMIS, on compare l'image à elle-même à deux secondes d'écart, et
// c'est l'AMPLITUDE DU DÉPLACEMENT qu'on lit.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/cout'))
fs.mkdirSync(SORTIE, { recursive: true })
const BASE = { cloudAltitude: 16, cloudAltSpread: 0.12, cloudOpacity: 1.4 }
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20.js'), 'utf8')
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = {}
try {
  const page = await nav.newPage()
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)) })
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(15000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2500)
  await page.evaluate(instrument)
  await dodo(800)
  await page.evaluate((b) => { Object.assign(window.__exp.params, b); window.__exp.clouds.build(window.__exp.params) }, BASE)
  await dodo(3000)

  // ── la minuterie GPU, posée sur la boucle de rendu du compositeur ────────
  out.gpu = await page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (!ext) return { dispo: false }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    async function bloc(images) {
      // chauffe
      for (let i = 0; i < 30; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < images; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 400; k++) {
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break
        await dodo(6)
      }
      const dispo = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      const ns = dispo ? gl.getQueryParameter(q, gl.QUERY_RESULT) : null
      gl.deleteQuery(q)
      return { dispo, disjoint, msParImage: ns == null ? null : ns / 1e6 / images }
    }
    const mediane = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
    const mesurer = async () => {
      const l = []
      for (let b = 0; b < 5; b++) { const r = await bloc(40); if (r.dispo && !r.disjoint) l.push(r.msParImage) }
      return { n: l.length, mediane: l.length ? +mediane(l).toFixed(4) : null, tous: l.map((x) => +x.toFixed(4)) }
    }
    const res = { pilote: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, tampon: [gl.drawingBufferWidth, gl.drawingBufferHeight] }
    e.params.cloudsEnabled = true; e.clouds.setVisible(true)
    res.avec = await mesurer()
    e.params.cloudsEnabled = false; e.clouds.setVisible(false)
    res.sans = await mesurer()
    e.params.cloudsEnabled = true; e.clouds.setVisible(true)
    res.avec2 = await mesurer()
    return res
  })
  console.log('GPU', JSON.stringify(out.gpu))

  // ── LE TÉMOIN : la minuterie voit-elle vraiment les fragments ? ──────────
  // On double la surface de rendu à nombre d'appels CONSTANT. Si le temps ne
  // bouge pas, la minuterie ne pèse rien et le relevé ci-dessus ne vaut rien.
  out.temoin = await page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    const t = []
    for (const f of [0.5, 1, 2]) {
      e.renderer.setPixelRatio(f)
      e.composer.setSize(Math.round(1280 * f), Math.round(800 * f))
      await dodo(600)
      for (let i = 0; i < 30; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < 30; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 400; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
      gl.deleteQuery(q)
      t.push({ facteur: f, tampon: [gl.drawingBufferWidth, gl.drawingBufferHeight], megapixels: +(gl.drawingBufferWidth * gl.drawingBufferHeight / 1e6).toFixed(3), msParImage: +(ns / 1e6 / 30).toFixed(4) })
    }
    e.renderer.setPixelRatio(1)
    e.composer.setSize(1280, 800)
    return t
  })
  console.log('temoin', JSON.stringify(out.temoin))
  await dodo(2000)

  // ── LES TROIS CURSEURS DE MOUVEMENT, MOUVEMENT REMIS ────────────────────
  await page.evaluate(() => { window.__exp.params.animations = true })
  await dodo(1500)
  const capt = async (n) => {
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate((x) => window.__r20.capturer(x, 8), n)
  }
  const ec = (a, b) => page.evaluate(([x, y]) => window.__r20.distance(x, y), [a, b])
  out.mouvement = []
  for (const [cle, bas, haut] of [['windSpeed', 0.1, 6], ['cloudDrift', 0.05, 2], ['cloudDriftVar', 0, 1]]) {
    const ligne = { cle }
    for (const [etiq, v] of [['bas', bas], ['haut', haut]]) {
      await page.evaluate(([k, x]) => { window.__exp.params[k] = x }, [cle, v])
      await dodo(2500)
      await capt('T0')
      await dodo(2500)
      await capt('T1')
      ligne[etiq] = { valeur: v, deplacement: await ec('T0', 'T1') }
    }
    // on remet un défaut raisonnable avant le curseur suivant
    await page.evaluate(([k]) => { window.__exp.params[k] = { windSpeed: 1.7, cloudDrift: 0.5, cloudDriftVar: 1 }[k] }, [cle])
    out.mouvement.push(ligne)
    console.log('mouvement', JSON.stringify(ligne))
  }
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-cout.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
