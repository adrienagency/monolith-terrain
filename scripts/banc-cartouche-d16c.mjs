// BANC D16-c — LE CARTOUCHE À L'ÉCRAN, À PLUSIEURS ALTITUDES.
//
// Il ne mesure pas une performance : il PROUVE que le cartouche est dessiné, à
// sa place et à la bonne taille, après son relogement dans la scène du globe.
// Pour chaque palier il enregistre une capture ET les nombres qui vont avec —
// l'échelle `k`, la base servie, et la HAUTEUR À L'ÉCRAN du titre, en pixels.
//
// ⚠️ **LA HAUTEUR À L'ÉCRAN EST LA SEULE MESURE QUI ATTRAPE L'ERREUR
// D'ESPACE.** Un cartouche resté en unités de bloc dans un monde de globe est
// 130 fois trop grand ici, 3 700 fois à z16 : il remplirait l'écran ou en
// sortirait. Une capture seule ne le dirait pas si le texte sort du cadre.
//
//   node scripts/banc-cartouche-d16c.mjs --port 5545

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const PORT = arg('--port', '5545')
const SORTIE = path.join(RACINE, '.banc', 'D16c')

function trouverChrome() {
  const p = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].filter(Boolean)
  const t = p.find((x) => fs.existsSync(x))
  if (!t) { console.error('Chrome introuvable.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable.'); process.exit(2)
}

// Ce qu'on lit dans la page : l'état du cartouche + la boîte du TITRE projetée
// à l'écran. Le titre est `meshes[0]` — le premier plan posé par `render()`.
const releve = () => {
  const e = window.__exp
  const gi = e.groundInfo
  // ⚠️ **LA CAMÉRA QUI REND N'EST PLUS CELLE DU BLOC DEPUIS D16-a** : c'est
  // celle de la passe de fond. Projeter avec l'autre rendrait des pixels d'un
  // monde qui n'est plus dessiné.
  const cam = e.composer?.passes?.[0]?.camera || e.camera
  // projection à la main : ce banc ne charge pas three.
  const mul = (m, v) => {
    const o = [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) o[i] = m[i] * v[0] + m[i + 4] * v[1] + m[i + 8] * v[2] + m[i + 12] * v[3]
    return o
  }
  const boite = (m) => {
    if (!m) return null
    m.updateWorldMatrix(true, false)
    cam.updateMatrixWorld()
    const g = m.geometry
    g.computeBoundingBox()
    const bb = g.boundingBox
    const MW = m.matrixWorld.elements
    const VI = cam.matrixWorldInverse.elements
    const P = cam.projectionMatrix.elements
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9, devant = false
    for (const sx of [bb.min.x, bb.max.x]) for (const sy of [bb.min.y, bb.max.y]) {
      const c = mul(P, mul(VI, mul(MW, [sx, sy, 0, 1])))
      if (!(c[3] > 0)) continue
      const nx = c[0] / c[3], ny = c[1] / c[3], nz = c[2] / c[3]
      if (nz < 1) devant = true
      const px = (nx * 0.5 + 0.5) * window.innerWidth
      const py = (-ny * 0.5 + 0.5) * window.innerHeight
      xmin = Math.min(xmin, px); xmax = Math.max(xmax, px)
      ymin = Math.min(ymin, py); ymax = Math.max(ymax, py)
    }
    return { devant, largeurPx: +(xmax - xmin).toFixed(1), hauteurPx: +(ymax - ymin).toFixed(1), xmin: +xmin.toFixed(1), ymin: +ymin.toFixed(1) }
  }
  return {
    zoom: e.params.demZoom,
    mode: e.modes.mode,
    camY: +e.camera.position.y.toFixed(2),
    visible: gi.group.visible,
    nom: gi.info?.name || null,
    description: (gi.info?.description || '').slice(0, 60),
    mailles: gi.meshes.length,
    echelle: gi.group.parent?.scale?.x ?? null,
    baseY: +gi.getBaseY().toFixed(4),
    baseYCrop: e.globe.baseYCrop,
    titre: boite(gi.meshes[0]),
    ecran: { w: window.innerWidth, h: window.innerHeight },
  }
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
fs.mkdirSync(SORTIE, { recursive: true })
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const journal = []
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.groundInfo, { timeout: 90000, polling: 100 })
  await dodo(16000)
  // ⚠️ **L'ACCUEIL INTERCEPTE LA MOLETTE.** Un premier tour l'a laissé posé :
  // les quatre paliers rendaient le MÊME zoom et la même altitude. On le ferme,
  // et on VÉRIFIE que le centre de la vue est bien le canevas.
  await page.keyboard.press('Escape')
  await dodo(1500)
  const centre = await page.evaluate(() => {
    const el = document.elementFromPoint(640, 400)
    return el ? el.tagName + '.' + (el.className || '') : 'rien'
  })
  console.log('centre de la vue :', centre)
  if (!/CANVAS/i.test(centre)) throw new Error('accueil encore posé : ' + centre)
  await dodo(3000)

  const molette = async (dy, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate((d) => {
        window.__exp.renderer.domElement.dispatchEvent(
          new WheelEvent('wheel', { deltaY: d, clientX: 640, clientY: 400, bubbles: true, cancelable: true })
        )
      }, dy)
      await dodo(120)
    }
  }

  const palier = async (nom) => {
    await dodo(6000)
    const r = await page.evaluate(releve)
    r.palier = nom
    journal.push(r)
    await page.screenshot({ path: path.join(SORTIE, `${nom}.png`) })
    console.log(nom, JSON.stringify(r))
  }

  // ⚠️ **CINQ ÉTATS, PAS CINQ DISTANCES.** Un premier tour n'a fait varier que
  // la distance dans le MÊME palier : `k` y est constant, donc il ne prouvait
  // rien sur la conversion d'espace. On CHANGE DE PALIER — `k` change avec —, et
  // on passe par l'orbite pour voir le cartouche s'éteindre puis revenir.
  await palier('01-reunion-z12')
  await page.evaluate(() => window.__exp.modes.stepFiner())
  await dodo(14000); await palier('02-palier-fin')
  await page.evaluate(() => { window.__exp.modes.stepWider(); })
  await dodo(9000)
  await page.evaluate(() => { window.__exp.modes.stepWider() })
  await dodo(14000); await palier('03-palier-large')
  await page.evaluate(() => window.__exp.modes.enterOrbit(2_000_000))
  await dodo(8000); await palier('04-orbite')
  await page.evaluate(() => window.__exp.modes.plongeDepuisGlobe(-21.115, 55.53))
  await dodo(26000); await palier('05-retour-surface')
  journal.push({ erreurs })
} finally {
  fs.writeFileSync(path.join(SORTIE, 'releve.json'), JSON.stringify(journal, null, 2))
  await nav.close()
}
console.log('→', SORTIE)
