// DIAG R20 ⑥ — LES QUINZE CURSEURS, LE COÛT, ET LES TROIS ALTITUDES.
//
// ⛔ **DEUX PIÈGES D'INSTRUMENT, TOUS DEUX PAYÉS SUR CETTE TÂCHE** :
//
//   ① **`setVisible(false)` NE TIENT PAS UNE IMAGE.** `majNuagesGlobe`
//      réapplique la visibilité à chaque image, exactement comme
//      `majCartoucheGlobe`. Une sonde qui éteint par là mesure 0,000 et croit
//      que rien n'est dessiné. **On coupe `params.cloudsEnabled`.**
//   ② **`cloudCoverage` VA DANS LE SENS INVERSE DE L'INTUITION** — le nuanceur
//      l'écrit : « 0 = masses pleines, 0.8 = dentelle trouée ». Poussé à 2,6 en
//      croyant rendre le ciel franc, on l'EFFACE : 0,0001 des deux côtés.
//
// ⚠️ **ET LE CIEL PAR DÉFAUT EST QUASI VIDE À CE LIEU**, dans les DEUX modes :
// la cible du peuplement vaut 4 grappes, le plafond 13,5 avec un étalement de
// 0,97 les met À HAUTEUR DE SOMMET (le relief monte à 8,87 unités de bloc), donc
// derrière la montagne. La base de mesure relève donc le plafond et resserre
// l'étalement — sans quoi on mesurerait le plancher de bruit quinze fois.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/curseurs'))
const URL_MODE = opt('--url', `http://localhost:${PORT}/`)
fs.mkdirSync(SORTIE, { recursive: true })

// La base de mesure : les défauts, plus un plafond au-dessus du relief.
const BASE = { cloudAltitude: 16, cloudAltSpread: 0.12, cloudOpacity: 1.4 }

// LES QUINZE, par ordre de valeur visuelle attendue. `a` est une valeur franche
// dans la plage ACTUELLE — jamais héritée d'une version antérieure.
const CURSEURS = [
  { cle: 'cloudsEnabled', de: true, a: false, nom: '01-interrupteur' },
  { cle: 'cloudOpacity', de: 1.4, a: 0.08, nom: '02-opacite' },
  { cle: 'cloudCoverage', de: 0.85, a: 2.4, nom: '03-couverture' },
  { cle: 'cloudAltitude', de: 16, a: 6, nom: '04-altitude' },
  { cle: 'cloudBrightness', de: 5, a: 1, nom: '05-luminosite' },
  { cle: 'cloudAltSpread', de: 0.12, a: 0.95, nom: '06-etalement' },
  { cle: 'cloudBillow', de: 1.05, a: 2.9, nom: '07-bourgeonnement' },
  { cle: 'cloudTexMix', de: 0.4, a: 1, nom: '08-coton' },
  { cle: 'cloudScale', de: 5, a: 1.2, nom: '09-grain' },
  { cle: 'cloudContrast', de: 2.5, a: 0.3, nom: '10-contraste' },
  { cle: 'cloudSSS', de: 2, a: 0, nom: '11-translucidite' },
  { cle: 'windDir', de: 7, a: 200, nom: '12-direction-vent' },
  { cle: 'windSpeed', de: 1.7, a: 6, nom: '13-force-vent' },
  { cle: 'cloudDrift', de: 0.5, a: 2, nom: '14-derive' },
  { cle: 'cloudDriftVar', de: 1, a: 0, nom: '15-variation-derive' },
]

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const instrument = fs.readFileSync(path.join(RACINE, 'scripts/instrument-r20.js'), 'utf8')
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { base: BASE, curseurs: [], altitudes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(URL_MODE, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(15000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2500)
  await page.evaluate(instrument)
  await dodo(900)
  const capt = async (n) => {
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(8), { timeout: 30000, polling: 60 })
    await page.evaluate((x) => window.__r20.capturer(x, 8), n)
  }
  const ec = (a, b) => page.evaluate(([x, y]) => window.__r20.distance(x, y), [a, b])

  // ── le plancher de bruit, vérifié ───────────────────────────────────────
  await capt('P1'); await dodo(700); await capt('P2')
  out.plancher = await ec('P1', 'P2')
  console.log('plancher', JSON.stringify(out.plancher))

  await page.evaluate((b) => { Object.assign(window.__exp.params, b); window.__exp.clouds.build(window.__exp.params) }, BASE)
  await dodo(3000)
  await capt('BASE')
  await page.screenshot({ path: path.join(SORTIE, 'base.png') })

  const poser = (cle, val) => page.evaluate(([k, v]) => {
    const e = window.__exp
    e.params[k] = v
    if (k === 'cloudsEnabled') { e.clouds.setVisible(!!v) } else e.clouds.build(e.params)
    return e.params[k]
  }, [cle, val])

  for (const c of CURSEURS) {
    const lu = await poser(c.cle, c.a)
    await dodo(2200)
    await capt('C')
    await page.screenshot({ path: path.join(SORTIE, `curseur-${c.nom}.png`) })
    const d = await ec('BASE', 'C')
    await poser(c.cle, c.de)
    await dodo(2200)
    await capt('R')
    const r = await ec('BASE', 'R')
    out.curseurs.push({ ...c, lu, ecart: d, retour: r })
    console.log(c.nom, JSON.stringify({ ecart: d, retour: r }))
  }

  // ── LE COÛT ─────────────────────────────────────────────────────────────
  //
  // ⛔ **`gl.finish()` SYNCHRONISE ICI MAIS NE PÈSE PAS LES FRAGMENTS** — ×35
  // de fragments donne ×0,96 de temps par image (`diag-charge-fragment.mjs`,
  // Tâche R6). Un effet volumétrique EST du fragment : le mesurer en temps sur
  // ce banc, ce serait mesurer zéro par construction.
  //
  // ⚡ **ON MESURE DONC LE TRAVAIL, PAS LE TEMPS**, et par deux voies :
  //   · **la minuterie GPU** (`EXT_disjoint_timer_query_webgl2`) si le pilote
  //     la donne — c'est la seule qui pèse vraiment les fragments ;
  //   · **la surface couverte**, en peignant les boîtes en rouge opaque et en
  //     COMPTANT les pixels qui changent. Multipliée par le nombre de pas de
  //     marche, elle donne le nombre d'échantillons de volume par image — la
  //     grandeur qui décide du coût sur la machine d'Adrien.
  out.cout = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    return {
      minuterieGPU: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
      pilote: (() => { const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null })(),
      tampon: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    }
  })
  // surface couverte : boîtes en rouge franc, comptage de pixels
  await page.evaluate(() => {
    const m = window.__exp.clouds.group.children[0]
    m.material.orig = m.material.fragmentShader
    m.material.fragmentShader = m.material.fragmentShader.replace(
      '    vec3 bmin = vCenter - vHalf;',
      '    outColor = vec4(1.0, 0.0, 0.0, 1.0); return;\n    vec3 bmin = vCenter - vHalf;'
    )
    m.material.needsUpdate = true
  })
  await dodo(2000)
  await capt('ROUGE')
  out.cout.pixels = await page.evaluate(() => window.__r20.compte ? window.__r20.compte('BASE', 'ROUGE') : null)
  out.cout.ecartRouge = await ec('BASE', 'ROUGE')
  out.cout.pas = await page.evaluate(() => {
    // le nombre de pas que la marche s'accorde, boîte par boîte
    const m = window.__exp.clouds.group.children[0]
    const Mat4 = m.matrixWorld.constructor
    const im = new Mat4()
    const l = []
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, im)
      const span = Math.hypot(im.elements[0], im.elements[1], im.elements[2])
      l.push(Math.min(26, Math.max(8, Math.round(span / 0.42))))
    }
    return { n: m.count, min: Math.min(...l), max: Math.max(...l), moy: +(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1) }
  })
  await page.evaluate(() => { const m = window.__exp.clouds.group.children[0]; m.material.fragmentShader = m.material.orig; m.material.needsUpdate = true })
  await dodo(1500)
  console.log('cout', JSON.stringify(out.cout))

  // ── LES TROIS ALTITUDES ─────────────────────────────────────────────────
  const alt = async (nom) => {
    const e = await page.evaluate(() => {
      const x = window.__exp
      return {
        mode: x.modes.mode,
        altKm: +(((x.camGlobe?.position.length() ?? 0) - 100) * 63.71).toFixed(0),
        volumeVisible: !!x.clouds?.group?.visible,
        uFadeCoquille: +(x.globe?.clouds?.uniforms?.uFade?.value ?? -1).toFixed(4),
      }
    })
    await page.screenshot({ path: path.join(SORTIE, `altitude-${nom}.png`) })
    e.nom = nom
    out.altitudes.push(e)
    console.log('altitude', JSON.stringify(e))
  }
  await alt('18km')
  await page.evaluate(() => window.__exp.modes.enterOrbit(1200000))
  await dodo(10000)
  await alt('1200km')
  await page.evaluate(() => {
    const e = window.__exp
    e.camera.position.setLength(300)
    e.modes.orbAlt = e.modes.orbAltTarget = 200
    e.camera.lookAt(0, 0, 0)
    e.controls.update()
  })
  await dodo(9000)
  await alt('globe-entier')
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-curseurs.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
