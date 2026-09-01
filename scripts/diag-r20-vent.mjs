// DIAG R20 ⑧ — LES TROIS CURSEURS DE MOUVEMENT, MESURÉS À LA SOURCE.
//
// ⛔ **À L'ÉCRAN ILS SONT NOYÉS.** Mouvement ambiant remis, l'image bouge de
// 0,95 d'une capture à l'autre — mer, soleil, faune —, et le déplacement des
// quatre grappes de nuages disparaît dedans. Les trois relevés d'écran rendent
// 0,847 / 0,963, 0,951 / 0,950 et 0,982 / 0,915 : **du bruit, pas un verdict**
// (`.banc/R20/cout/diag-cout.json`). Et mouvement COUPÉ, ils valent exactement
// 0,0000 — par construction, puisqu'ils ne changent QUE le déplacement.
//
// ⚡ **ON LES MESURE DONC SUR LES ENTITÉS ELLES-MÊMES** : la position de chaque
// nuage, en unités de bloc, à deux instants. C'est la grandeur que le curseur
// pilote, et elle n'a aucun autre contributeur.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/cout'))
fs.mkdirSync(SORTIE, { recursive: true })
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { mesures: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(15000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  await page.evaluate(() => { Object.assign(window.__exp.params, { cloudAltitude: 16, cloudAltSpread: 0.12, cloudOpacity: 1.4 }); window.__exp.clouds.build(window.__exp.params) })
  await dodo(2500)

  // le déplacement moyen des entités, en unités de bloc, sur 3 secondes
  const deplacement = async (cle, val) => {
    await page.evaluate(([k, v]) => { window.__exp.params[k] = v }, [cle, val])
    await dodo(2000)
    const a = await page.evaluate(() => window.__exp.clouds.sky.clouds.map((c) => [c.id ?? null, c.x, c.z]))
    await dodo(3000)
    const b = await page.evaluate(() => window.__exp.clouds.sky.clouds.map((c) => [c.id ?? null, c.x, c.z]))
    // appariement par rang : le tri du rendu peut permuter la liste, on
    // apparie donc par la position la plus proche, ce qui borne PAR EN BAS
    const d = []
    for (const [, bx, bz] of b) {
      let m = Infinity
      for (const [, ax, az] of a) m = Math.min(m, Math.hypot(bx - ax, bz - az))
      if (Number.isFinite(m)) d.push(m)
    }
    const n = d.length
    const moy = n ? d.reduce((x, y) => x + y, 0) / n : 0
    // ⚠️ cloudDriftVar ne change PAS la moyenne : c'est la VARIANCE des
    // vitesses par nuage. Une mesure de moyenne y est aveugle par
    // construction — on lit donc aussi l'ecart-type et sa part relative.
    const et = n ? Math.sqrt(d.reduce((x, y) => x + (y - moy) ** 2, 0) / n) : 0
    return { valeur: val, n, deplacementBloc: +moy.toFixed(4), ecartType: +et.toFixed(4), dispersion: moy > 0 ? +(et / moy).toFixed(4) : null }
  }
  for (const [cle, bas, haut] of [['windSpeed', 0.1, 6], ['cloudDrift', 0.05, 2], ['cloudDriftVar', 0, 1]]) {
    const l = { cle, bas: await deplacement(cle, bas), haut: await deplacement(cle, haut) }
    l.rapport = l.bas.deplacementBloc > 0 ? +(l.haut.deplacementBloc / l.bas.deplacementBloc).toFixed(2) : null
    out.mesures.push(l)
    console.log(cle, JSON.stringify(l))
    await page.evaluate(([k]) => { window.__exp.params[k] = { windSpeed: 1.7, cloudDrift: 0.5, cloudDriftVar: 1 }[k] }, [cle])
    await dodo(1500)
  }
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-vent.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
