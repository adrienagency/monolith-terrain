// DIAG R20 ⑤ — SUR QUELLE GARDE `majNuagesGlobe` SORT-ELLE ?
// Le groupe est adopté (`parent = ancrage-nuages`) mais son échelle vaut 1 et
// sa position [0,0,0] : la pose n'a pas eu lieu. On interroge chaque terme.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
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
const out = {}
try {
  const page = await nav.newPage()
  page.on('pageerror', (e) => { (out.erreursPage ??= []).push(String(e).slice(0, 300)) })
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)

  out.exp = await page.evaluate(() => Object.keys(window.__exp).sort())
  out.arbre = await page.evaluate(() => {
    const e = window.__exp
    const chaine = []
    let o = e.clouds?.group
    while (o) { chaine.push(o.name || o.type); o = o.parent }
    return {
      chaine,
      groupe: {
        visible: e.clouds.group.visible,
        echelle: e.clouds.group.scale.x,
        pos: e.clouds.group.position.toArray(),
        matriceAuto: e.clouds.group.matrixAutoUpdate,
      },
      // le cartouche, qui MARCHE, sert de témoin
      cartouche: (() => {
        const g = e.scene?.getObjectByName?.('ancrage-cartouche')
          || e.sceneGlobe?.getObjectByName?.('ancrage-cartouche')
        return g ? { echelle: g.scale.x, pos: g.position.toArray(), visible: g.visible, parent: g.parent?.name || g.parent?.type } : null
      })(),
    }
  })
  console.log('arbre', JSON.stringify(out.arbre, null, 1))
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-garde.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
