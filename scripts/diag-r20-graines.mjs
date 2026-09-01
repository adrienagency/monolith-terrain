// DIAG R20 ⑪ — LA LOTERIE DE DISPOSITION, ET LE COÛT PROPRE.
//
// ⛔ **UNE SEULE POSE PAR CANDIDAT NE PROUVE RIEN.** Le ciel compte 3 à 8
// GRAPPES : à ce nombre-là, deux dispositions du même réglage n'ont pas la même
// surface à l'écran, et l'écart entre elles dépasse l'écart entre deux
// réglages. La première échelle a mesuré 4 085 pixels à 6 grappes et 13 259 à
// 8 — ×3,2 pour ×1,3 d'entités : ce n'est pas une courbe, c'est un tirage.
// **On tire donc N graines par candidat et on rend la MÉDIANE et l'étendue.**
//
// ⛔ **ET LES TEMPS DE LA PASSE PRÉCÉDENTE ÉTAIENT CONTAMINÉS** : son témoin
// rendait ×1,47 pour ×16 de fragments, quand la mesure propre rend ×8,2 — et
// trois surcoûts sortaient NÉGATIFS. Cause : le flux de tuiles tournait
// pendant le chronométrage. Ici on laisse la scène se poser, on coupe la
// simulation, et **on rejette tout bloc dont le témoin ne tient pas**.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5571'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/defaut'))
const GRAINES = Number(opt('--graines', '5'))
fs.mkdirSync(SORTIE, { recursive: true })

const AVANT = { cloudsEnabled: true, cloudOpacity: 0.6, cloudAltitude: 13.5, cloudAltSpread: 0.97, cloudCoverage: 0.85 }
const SOCLE = { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }
const CANDIDATS = [
  { nom: 'AVANT', v: {}, grappes: null },
  { nom: 'C-4-grappes', v: SOCLE, grappes: 4 },
  { nom: 'H-6-grappes', v: SOCLE, grappes: 6 },
  { nom: 'I-8-grappes', v: SOCLE, grappes: 8 },
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
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { graines: GRAINES, candidats: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(20000) // ⚠️ le flux de tuiles doit avoir fini AVANT le chronomètre
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(3000)
  await page.evaluate(instrument)
  await dodo(800)

  for (const c of CANDIDATS) {
    const px = []
    const npx = []
    for (let g = 0; g < GRAINES; g++) {
      const etat = await page.evaluate(([v, gr, seed]) => {
        const e = window.__exp
        if (gr) e.clouds._targetCount = () => gr
        else delete e.clouds._targetCount
        Object.assign(e.params, { ...v, cloudsEnabled: true, seaSeed: seed })
        e.clouds.build(e.params)
        return { cible: e.clouds.sky.target, entites: e.clouds.group.children[0]?.count }
      }, [{ ...AVANT, ...c.v }, c.grappes, 101 + g * 977])
      await dodo(2600)
      await page.evaluate(() => window.__r20p.prendre('ON'))
      if (g === 0) await page.screenshot({ path: path.join(SORTIE, `graine-${c.nom}.png`) })
      await page.evaluate(() => { window.__exp.params.cloudsEnabled = false; window.__exp.clouds.setVisible(false) })
      await dodo(2000)
      await page.evaluate(() => window.__r20p.prendre('OFF'))
      await page.evaluate(() => { window.__exp.params.cloudsEnabled = true; window.__exp.clouds.setVisible(true) })
      const r = await page.evaluate(() => window.__r20p.compter('ON', 'OFF', 2))
      px.push(r.pixelsTouches)
      npx.push(etat.entites)
      await dodo(900)
    }
    const ligne = {
      nom: c.nom, reglages: c.v, grappes: c.grappes,
      entites: npx, pixels: px,
      medianePixels: med(px), min: Math.min(...px), max: Math.max(...px),
      pourcentMedian: +((med(px) / 1024000) * 100).toFixed(4),
    }
    out.candidats.push(ligne)
    console.log(c.nom, JSON.stringify({ n: npx, px, med: ligne.medianePixels, pct: ligne.pourcentMedian }))
  }
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-graines.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
