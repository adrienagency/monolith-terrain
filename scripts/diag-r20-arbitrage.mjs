// DIAG R20 ⑩ — L'ARBITRAGE : COMBIEN DE CIEL POUR COMBIEN DE MILLISECONDES ?
//
// Chaque candidat est pesé DEUX FOIS dans la même page :
//   · **la surface**, en comptant les pixels du tampon ENTIER (1280 × 800) qui
//     changent quand on éteint le ciel — pas une moyenne sur vignette ;
//   · **le temps GPU**, avec `EXT_disjoint_timer_query_webgl2`, dont le témoin
//     de sensibilité aux fragments a été validé (×16 de fragments ⇒ ×8,2 de
//     temps, quand le banc CPU de ce dépôt rend ×0,96 pour ×35).
//
// ⚡ **CE QUE LA PREMIÈRE ÉCHELLE A APPRIS** : l'opacité ne coûte RIEN en
// boîtes — le peuplement vaut `round(4 × (0,65 + opacité × 0,18))` et sature à
// 4 dès l'opacité 0,49, plafonné par `CLOUD_COUNT_MAX = 5`. Monter l'opacité,
// c'est donc changer l'alpha accumulé sans ajouter un seul fragment marché.
// Le nombre de grappes, lui, se paie.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5571'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/defaut'))
fs.mkdirSync(SORTIE, { recursive: true })

const AVANT = { cloudsEnabled: true, cloudOpacity: 0.6, cloudAltitude: 13.5, cloudAltSpread: 0.97, cloudCoverage: 0.85 }
const CANDIDATS = [
  { nom: 'AVANT', v: {}, grappes: null },
  { nom: 'C-op1.4-spr0.45', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45 }, grappes: null },
  { nom: 'E-plus-pleines', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }, grappes: null },
  { nom: 'F-op2.2', v: { cloudOpacity: 2.2, cloudAltSpread: 0.45, cloudCoverage: 0.8 }, grappes: null },
  { nom: 'G-5-grappes', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }, grappes: 5 },
  { nom: 'H-6-grappes', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }, grappes: 6 },
  { nom: 'I-8-grappes', v: { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }, grappes: 8 },
]

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20-pleine.js'), 'utf8')
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { candidats: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(16000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2500)
  await page.evaluate(instrument)
  await dodo(800)

  // la minuterie GPU, et son témoin de sensibilité aux fragments
  out.temoin = await page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (!ext) return { dispo: false }
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    const t = []
    for (const f of [1, 2]) {
      e.renderer.setPixelRatio(f)
      e.composer.setSize(Math.round(1280 * f), Math.round(800 * f))
      await dodo(700)
      for (let i = 0; i < 30; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < 30; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 400; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
      gl.deleteQuery(q)
      t.push({ megapixels: +(gl.drawingBufferWidth * gl.drawingBufferHeight / 1e6).toFixed(3), msParImage: +(ns / 1e6 / 30).toFixed(4) })
    }
    e.renderer.setPixelRatio(1)
    e.composer.setSize(1280, 800)
    await dodo(700)
    return { dispo: true, echelle: t, rapport: +(t[1].msParImage / t[0].msParImage).toFixed(2) }
  })
  console.log('temoin', JSON.stringify(out.temoin))

  const chrono = () => page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    const bloc = async () => {
      for (let i = 0; i < 30; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < 40; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 400; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { gl.deleteQuery(q); return null }
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
      gl.deleteQuery(q)
      return ns / 1e6 / 40
    }
    const l = []
    for (let b = 0; b < 5; b++) { const r = await bloc(); if (r != null) l.push(r) }
    l.sort((a, b) => a - b)
    return l.length ? +l[Math.floor(l.length / 2)].toFixed(4) : null
  })

  for (const c of CANDIDATS) {
    const etat = await page.evaluate(([v, g]) => {
      const e = window.__exp
      // ⚠️ on force le peuplement en court-circuitant `_targetCount` : c'est
      // le seul moyen de PESER un budget de grappes avant de le décider.
      if (g) e.clouds._targetCount = () => g
      else delete e.clouds._targetCount
      Object.assign(e.params, { ...v, cloudsEnabled: true })
      e.clouds.build(e.params)
      return { cible: e.clouds.sky.target, entites: e.clouds.group.children[0]?.count }
    }, [{ ...AVANT, ...c.v }, c.grappes])
    await dodo(2800)
    await page.evaluate(() => window.__r20p.prendre('ON'))
    await page.screenshot({ path: path.join(SORTIE, `arb-${c.nom}.png`) })
    const msAvec = await chrono()
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
    await dodo(2200)
    await page.evaluate(() => window.__r20p.prendre('OFF'))
    const msSans = await chrono()
    const px = await page.evaluate(() => window.__r20p.compter('ON', 'OFF', 2))
    await page.evaluate(() => { window.__exp.params.cloudsEnabled = true; window.__exp.clouds.setVisible(true) })
    await dodo(1200)
    const ligne = {
      nom: c.nom, reglages: c.v, grappesForcees: c.grappes, ...etat,
      pixelsTouches: px?.pixelsTouches, pourcent: px?.pourcent, deltaMoyen: px?.deltaMoyenSurTouches, deltaPire: px?.deltaPire,
      msAvec, msSans, surcout: msAvec != null && msSans != null ? +(msAvec - msSans).toFixed(4) : null,
    }
    ligne.pxParMs = ligne.surcout > 0 ? Math.round(ligne.pixelsTouches / ligne.surcout) : null
    out.candidats.push(ligne)
    console.log(c.nom, JSON.stringify({ n: ligne.entites, cible: ligne.cible, pct: ligne.pourcent, px: ligne.pixelsTouches, d: ligne.deltaMoyen, avec: msAvec, sans: msSans, surcout: ligne.surcout, pxParMs: ligne.pxParMs }))
  }
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-arbitrage.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
