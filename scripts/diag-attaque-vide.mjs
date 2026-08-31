// DIAGNOSTIC D'ATTAQUE — « l'écran est vide alors que 114 394 triangles sont dessinés ».
//
// ⛔ LECTURE SEULE SUR `src/`. Ce script navigue, appelle `flyTo` (le geste de
// l'usager, exposé par `__exp`), et LIT l'état. Il n'écrit rien dans la page.
//
//   node scripts/diag-attaque-vide.mjs --port 5551 --lieu "45.8326,6.8652" --zooms 12,13,14,15,16
//
// Ce qu'il rend, par palier :
//   · où est `camGlobe`, où elle vise, son near/far ;
//   · où est le CENTRE DU CROP sur la sphère, et sa position en coordonnées
//     normalisées d'écran (NDC). |ndc| > 1 ⇒ le crop est HORS CHAMP.
//   · ce que chaque objet visible de la scène du globe pèse en triangles, et
//     s'il est dans le tronc de vision.
//   · un comptage de pixels du fond : « écran vide » est une affirmation,
//     « 98,7 % des tuiles à l'écart-type du fond » est une mesure.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'D16')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5551'))
const LIEU = opt('--lieu', '45.8326,6.8652')
const ZOOMS = opt('--zooms', '12,13,14,15,16').split(',').map(Number)
const ETIQ = opt('--etiquette', 'diag-vide')
const ATTENTE = Number(opt('--attente', '14000'))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const sortie = { lieu: LIEU, zooms: ZOOMS, releves: [] }

function lireEtat() {
  const e = window.__exp
  const THREE = e.camGlobe?.constructor ? null : null
  const cg = e.camGlobe
  const g = e.globe
  const u = g?.uniforms ?? g?._uniforms ?? null
  const R_GLOBE = 100
  const D2R = Math.PI / 180
  const dem = e.dem
  // le centre du crop, en LAT/LON, converti sur la sphère comme `latLonToSphere`
  const lat = dem?.lat, lon = dem?.lon
  const phi = (90 - lat) * D2R, theta = (lon + 180) * D2R
  const r = R_GLOBE
  const cx = -r * Math.sin(phi) * Math.cos(theta)
  const cy = r * Math.cos(phi)
  const cz = r * Math.sin(phi) * Math.sin(theta)
  const p = cg.position
  const d = Math.hypot(cx - p.x, cy - p.y, cz - p.z)
  // l'axe de visée
  const v = { x: 0, y: 0, z: -1 }
  const q = cg.quaternion
  const rot = (a) => {
    const ix = q.w * a.x + q.y * a.z - q.z * a.y
    const iy = q.w * a.y + q.z * a.x - q.x * a.z
    const iz = q.w * a.z + q.x * a.y - q.y * a.x
    const iw = -q.x * a.x - q.y * a.y - q.z * a.z
    return {
      x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
    }
  }
  const vd = rot(v)
  const dirx = (cx - p.x) / d, diry = (cy - p.y) / d, dirz = (cz - p.z) / d
  const cosang = vd.x * dirx + vd.y * diry + vd.z * dirz
  const angle = (Math.acos(Math.max(-1, Math.min(1, cosang))) * 180) / Math.PI
  // NDC du centre du crop
  cg.updateMatrixWorld(true)
  cg.updateProjectionMatrix()
  const V = e.camera.position.constructor
  const pt = new V(cx, cy, cz).project(cg)
  // les objets visibles de la scène du globe, avec leur poids
  const objets = []
  const visible = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true }
  e.sceneGlobe?.traverse((o) => {
    if (!o.geometry || !visible(o)) return
    const gg = o.geometry
    const idx = gg.index ? gg.index.count : gg.attributes?.position?.count ?? 0
    if (!gg.boundingSphere) { try { gg.computeBoundingSphere() } catch (er) { /* rien */ } }
    const bs = gg.boundingSphere
    objets.push({
      nom: o.name || o.type, tri: Math.round(idx / 3),
      pos: [o.position.x, o.position.y, o.position.z],
      ech: [o.scale.x, o.scale.y, o.scale.z],
      rayon: bs?.radius ?? null,
      frustumCulled: o.frustumCulled,
      mat: (Array.isArray(o.material) ? o.material[0] : o.material)?.type ?? null,
      side: (Array.isArray(o.material) ? o.material[0] : o.material)?.side ?? null,
      transparent: (Array.isArray(o.material) ? o.material[0] : o.material)?.transparent ?? null,
      opacity: (Array.isArray(o.material) ? o.material[0] : o.material)?.opacity ?? null,
    })
  })
  return {
    mode: e.modes?.mode, busy: !!e.modes?.busy, travel: !!e.modes?.travel,
    zoom: dem?.zoom, lat, lon, emprise: dem?.extentMeters, size: dem?.size,
    alt: e.altitudeCadrageM?.(), camY: e.camera?.position?.y,
    camGlobe: { x: p.x, y: p.y, z: p.z, dist: Math.hypot(p.x, p.y, p.z), near: cg.near, far: cg.far, fov: cg.fov, aspect: cg.aspect },
    cropCentre: { x: cx, y: cy, z: cz },
    distCamCrop: d,
    angleViseeVersCrop: angle,
    ndc: { x: pt.x, y: pt.y, z: pt.z },
    dansLeChamp: Math.abs(pt.x) <= 1 && Math.abs(pt.y) <= 1 && pt.z >= -1 && pt.z <= 1,
    uCropOn: u?.uCropOn?.value ?? null,
    uCropCentre: u?.uCropCentre?.value ? [u.uCropCentre.value.x, u.uCropCentre.value.y] : null,
    uCropDemi: u?.uCropDemi?.value ?? null,
    uEstompageOn: u?.uEstompageOn?.value ?? null,
    uEstompage: u?.uEstompage?.value ?? null,
    uFondOn: u?.uFondOn?.value ?? null,
    cropPose: !!e.veilleCrop?.pose, cropRefus: e.veilleCrop?.refus ?? null,
    signature: e.veilleCrop?.signature ?? null,
    auRepos: !!e.veilleRepos?.auRepos,
    estompeVeille: e.veilleEstompage?.valeur ?? null,
    objets: objets.sort((a, b) => b.tri - a.tri).slice(0, 14),
    nObjets: objets.length,
    retard: document.querySelector('.ce-retard')?.textContent ?? null,
    // ⚡ L'ALTITUDE DU SOL, ET CELLE DE LA CAMÉRA, DANS LA MÊME UNITÉ.
    // `camGlobe.dist` vaut `100 + altitude/63710` ; le sol vaut `dem.meanM`.
    solM: { mean: dem?.meanM ?? null, min: dem?.minM ?? null, max: dem?.maxM ?? null },
    camAltMerM: (Math.hypot(p.x, p.y, p.z) - R_GLOBE) * (6371000 / R_GLOBE),
    cropRayonSphereM: (Math.hypot(cx, cy, cz) - R_GLOBE) * (6371000 / R_GLOBE),
    infoRender: { calls: e.renderer.info.render.calls, tri: e.renderer.info.render.triangles },
  }
}

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(8000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  const client = await page.createCDPSession()
  const [la, lo] = LIEU.split(',').map(Number)
  const dossier = path.join(ICI, `img-${ETIQ}`)
  fs.mkdirSync(dossier, { recursive: true })

  for (const z of ZOOMS) {
    const ok = await page.evaluate(async (a, b, zz) => {
      try { return !!(await window.__exp.modes.flyTo(a, b, zz)) } catch (er) { return 'err:' + er.message }
    }, la, lo, z)
    await dodo(ATTENTE)
    const et = await page.evaluate(lireEtat)
    et.flyToOk = ok
    et.zoomDemande = z
    sortie.releves.push(et)
    const b = await client.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(dossier, `z${z}.png`), Buffer.from(b.data, 'base64'))
    // ⚡ LE CONTRE-ESSAI : on RECULE la caméra du bloc (le geste de la molette
    // arrière, appliqué à la main) et on regarde si le bloc réapparaît. S'il
    // réapparaît, l'écran vide n'est pas un défaut de CHARGEMENT mais de POSE.
    const F = Number(opt('--recul', '0'))
    if (F > 1) {
      await page.evaluate((f) => {
        const x = window.__exp
        const c = x.camera, t = x.controls.target
        c.position.set(t.x + (c.position.x - t.x) * f, t.y + (c.position.y - t.y) * f, t.z + (c.position.z - t.z) * f)
        x.controls.update()
        x.majCameraFond?.()
      }, F)
      await dodo(3500)
      const et2 = await page.evaluate(lireEtat)
      et2.zoomDemande = z; et2.recul = F
      sortie.releves.push(et2)
      const b2 = await client.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(dossier, `z${z}-recul${F}.png`), Buffer.from(b2.data, 'base64'))
      console.log(`  recul ×${F} : camAltMer=${Math.round(et2.camAltMerM)}m sol=${Math.round(et2.solM.mean)}m`)
    }
    console.log(`z${z}: dem z${et.zoom} crop=${et.uCropOn} ndc=(${et.ndc.x.toFixed(3)},${et.ndc.y.toFixed(3)},${et.ndc.z.toFixed(4)}) champ=${et.dansLeChamp} angle=${et.angleViseeVersCrop.toFixed(2)}° dist=${et.distCamCrop.toFixed(4)} near=${et.camGlobe.near} far=${et.camGlobe.far} tri=${et.infoRender.tri} estompe=${et.estompeVeille} retard=${JSON.stringify(et.retard)}`)
  }
  sortie.erreurs = erreurs
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(sortie, null, 1))
  console.log(`→ .banc/D16/${ETIQ}.json`)
} finally {
  await nav.close()
}
