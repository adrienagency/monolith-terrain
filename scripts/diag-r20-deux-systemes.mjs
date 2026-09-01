// DIAG R20 — ce que les deux systèmes SONT, avant toute correction.
//   ① quelles scènes sont réellement soumises au GPU, avec quelle caméra ;
//   ② clouds2 : instances, boîte englobante, unités ;
//   ③ la coquille : uFade en fonction de l'altitude, mesuré et non déduit.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
fs.mkdirSync(SORTIE, { recursive: true })

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = {}
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(2000)

  // ① QUI EST SOUMIS AU GPU — on enregistre les appels de rendu d'une image.
  out.passes = await page.evaluate(async () => {
    const e = window.__exp
    const R = e.renderer
    const orig = R.render.bind(R)
    const journal = []
    R.render = function (sc, cam) {
      journal.push({
        scene: sc === e.scene ? 'scene(bloc)' : sc === e.sceneGlobe ? 'sceneGlobe' : (sc?.name || sc?.type || '?'),
        cam: cam === e.camera ? 'camera(bloc)' : cam === e.camGlobe ? 'camGlobe' : '?',
      })
      return orig(sc, cam)
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    R.render = orig
    return journal
  })

  // ② clouds2 : ce qu'il porte, et où
  out.clouds2 = await page.evaluate(() => {
    const e = window.__exp
    const c = e.clouds
    e.params.cloudsEnabled = true
    c.build?.(e.params)
    c.setVisible(true)
    const g = c.group || c.mesh
    const enfants = []
    g.traverse((o) => {
      if (o === g) return
      const b = { nom: o.name || o.type, type: o.type, visible: o.visible, count: o.count ?? null, instanceCount: o.instanceCount ?? null }
      if (o.geometry) { o.geometry.computeBoundingBox?.(); const bb = o.geometry.boundingBox; if (bb) b.bbGeo = [bb.min.toArray().map((v) => +v.toFixed(2)), bb.max.toArray().map((v) => +v.toFixed(2))] }
      b.pos = o.position.toArray().map((v) => +v.toFixed(2))
      b.scale = o.scale.toArray().map((v) => +v.toFixed(2))
      enfants.push(b)
    })
    // les centres des instances, lus dans la matrice
    let instances = null
    const im = g.children.find((o) => o.isInstancedMesh)
    if (im) {
      const m = new (window.THREE?.Matrix4 || Object)()
      const arr = im.instanceMatrix.array
      const n = Math.min(im.count, 8)
      instances = []
      for (let i = 0; i < n; i++) instances.push({ x: +arr[i * 16 + 12].toFixed(2), y: +arr[i * 16 + 13].toFixed(2), z: +arr[i * 16 + 14].toFixed(2), sx: +arr[i * 16 + 0].toFixed(2) })
      void m
    }
    const u = im?.material?.uniforms
    return {
      TERRAIN_SIZE_devine: 56,
      enfants, count: im?.count ?? null, instances,
      uniformes: u ? Object.fromEntries(Object.keys(u).map((k) => {
        const v = u[k].value
        return [k, typeof v === 'number' ? +v.toFixed(4) : (v?.isVector2 || v?.isVector3 ? v.toArray().map((x) => +x.toFixed(3)) : (v?.isColor ? v.getHexString() : (v?.isTexture ? 'texture' : String(v).slice(0, 30))))]
      })) : null,
      reglages: Object.fromEntries(['cloudsEnabled', 'cloudOpacity', 'cloudTexMix', 'cloudScale', 'cloudCoverage', 'cloudBillow', 'cloudBrightness', 'cloudContrast', 'cloudSSS', 'cloudAltitude', 'cloudAltSpread', 'cloudDrift', 'cloudDriftVar', 'windDir', 'windSpeed'].map((k) => [k, e.params[k]])),
    }
  })
  await page.evaluate(() => window.__exp.clouds.setVisible(false))

  // ③ uFade en fonction de l'altitude — la loi de la coquille, MESURÉE
  out.echelle = await page.evaluate(() => {
    const e = window.__exp
    const gc = e.globe.clouds
    const R = gc.radius
    const faux = { position: { length: () => 0 } }
    const pts = []
    for (const d of [100.3, 105, 110, 115, 118, 120, 125, 130, 134, 140, 145, 150, 160, 200]) {
      faux.position.length = () => d
      gc.update(faux, 0)
      pts.push({ dist: d, altKm: +(((d - 100) * 63710) / 1000).toFixed(0), uFade: +gc.uniforms.uFade.value.toFixed(4) })
    }
    return pts
  })

  // ④ L'ORBITE, pour de vrai
  await page.evaluate(() => window.__exp.modes.enterOrbit(1200000))
  await dodo(9000)
  out.orbite = await page.evaluate(() => {
    const e = window.__exp
    const visEff = (o) => { let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent } return v }
    return {
      mode: e.modes.mode,
      camDist: +e.camera.position.length().toFixed(2),
      camGlobeDist: +(e.camGlobe?.position.length() ?? 0).toFixed(2),
      uFade: +e.globe.clouds.uniforms.uFade.value.toFixed(4),
      coquilleVisible: visEff(e.globe.clouds.group),
      frontiere: e.frontiereActive,
    }
  })
  await page.screenshot({ path: path.join(SORTIE, 'diag-orbite.png') })
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-deux-systemes.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
console.log(JSON.stringify(out, null, 1))
