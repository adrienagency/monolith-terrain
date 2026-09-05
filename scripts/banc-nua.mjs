// BANC NUA — LES NUAGES DESCENDENT-ILS AVEC LE ZOOM, ET SORTENT-ILS DU SOCLE ?
//
// Rejoue le vol de la vidéo du 2026-09-04 (rapport VID2, § N1–N2) : Provence,
// `modes.flyTo(44.3425, 5.7777, 9)`, caméra à `controls.maxDistance`, puis
// `modes.cranZoom(1)` deux fois par palier jusqu'à z14, puis trois crans
// arrière en moins d'une seconde (la sortie molette).
//
// À chaque palier il relève :
//   · le PLAFOND des nuages EN MÈTRES (moyenneM + topY / échelle verticale) ;
//   · la crête la plus haute du bloc (`fenetreBornee.maxM`) ;
//   · l'altitude de la caméra du bloc, en mètres ;
//   · les pixels de nuage à l'écran (capture ON − capture OFF, seuil 2) ;
//   · les pixels de nuage HORS du prisme du socle (enveloppe convexe des huit
//     coins du prisme [±28 × yBas..yHaut] projetés par la caméra de rendu) ;
//   · un TÉMOIN (deux captures OFF sans rien changer) — pièges communs :
//     « le témoin bouge seul, mesure le témoin d'abord ».
//
// ⛔ Seule la capture d'écran est fiable (pièges communs) : `page.screenshot`,
// décodée dans la page par un canvas, comparée pixel à pixel DANS la page.
//
// Usage : node scripts/banc-nua.mjs --port 10620 --sortie .banc/NUA/avant
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '10620'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/NUA/run'))
const N_IMAGES = Number(opt('--images', '20'))
const PALIER_MAX = Number(opt('--zmax', '14'))
fs.mkdirSync(SORTIE, { recursive: true })

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ══════ L'INSTRUMENT, INJECTÉ DANS LA PAGE ══════════════════════════════════
// ⛔ Une FONCTION sérialisée, pas un template literal : un backtick dans un
// commentaire le terminerait (le piège n° 1 de `shibu-clouds`, payé ici aussi).
function INSTRUMENT_FN() {
  const e = window.__exp
  const prises = new Map()
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  function decoder(b64) {
    return new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => { cv.width = im.width; cv.height = im.height; ctx.drawImage(im, 0, 0); res(ctx.getImageData(0, 0, im.width, im.height)) }
      im.onerror = rej
      im.src = 'data:image/png;base64,' + b64
    })
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
    up.pop(); lo.pop(); return lo.concat(up)
  }
  function dedans(poly, x, y) {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  // Les huit coins du prisme du socle, en unités de BLOC, projetés par la
  // caméra de RENDU (camGlobe sous la fusion des passes, sinon la caméra du bloc)
  // à travers la matrice monde du groupe des nuages (qui porte la similitude).
  function prismeEcran(yBas, yHaut, demi, w, h) {
    const T = e.THREE
    const cam = e.camGlobe && e.frontiereActive ? e.camGlobe : e.camera
    cam.updateMatrixWorld(true)
    const grp = e.clouds.group
    grp.updateMatrixWorld(true)
    const pts = []
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [yBas, yHaut]) {
      const v = new T.Vector3(sx * demi, y, sz * demi).applyMatrix4(grp.matrixWorld).project(cam)
      pts.push([(v.x + 1) / 2 * w, (1 - v.y) / 2 * h])
    }
    return hull(pts)
  }
  window.__nua = {
    async prendre(nom, b64) { const d = await decoder(b64); prises.set(nom, d); return { w: d.width, h: d.height } },
    vider() { prises.clear() },
    // pixels dont un canal bouge de plus de `seuil` entre A et B, et parmi eux
    // ceux qui tombent HORS du prisme du socle
    compter(a, b, seuil, prisme, exclusion = null) {
      const A = prises.get(a), B = prises.get(b)
      if (!A || !B || A.width !== B.width || A.height !== B.height) return null
      const w = A.width, h = A.height
      const poly = prisme ? prismeEcran(prisme.yBas, prisme.yHaut, prisme.demi, w, h) : null
      let n = 0, hors = 0
      let xmin = w, xmax = -1, ymin = h, ymax = -1
      const pa = A.data, pb = B.data
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]))
        if (d <= seuil) continue
        if (exclusion && x >= exclusion[0] && x <= exclusion[2] && y >= exclusion[1] && y <= exclusion[3]) continue
        n++
        if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y
        if (poly && !dedans(poly, x + 0.5, y + 0.5)) hors++
      }
      return { total: w * h, pixels: n, pourcent: +((n / (w * h)) * 100).toFixed(4), hors, boite: n ? [xmin, ymin, xmax, ymax] : null, prisme: poly }
    },
    etat() {
      const t = e.terrain, f = t.fenetreBornee, dem = t.dem, p = e.params
      const sky = e.clouds.sky
      const ech = f?.echelleVerticale ?? null
      const moy = f?.moyenneM ?? dem?.meanM ?? null
      const topY = sky?.opts?.topY ?? null, baseY = sky?.opts?.baseY ?? null
      let boiteHaute = -Infinity
      for (const c of sky?.clouds ?? []) boiteHaute = Math.max(boiteHaute, c.y + c.h * 1.15)
      // la largeur des parois du crop, en unités de bloc (via la similitude)
      let paroisBloc = null
      const par = e.globe?._parois
      if (par?.geometry) {
        par.geometry.computeBoundingBox(); par.updateMatrixWorld(true)
        const b = par.geometry.boundingBox.clone().applyMatrix4(par.matrixWorld)
        const k = e.clouds.group.parent?.scale?.x || 1 // le groupe de Clouds2 est l'ENFANT de groupeNuages, qui porte la similitude
        paroisBloc = { largeurGlobe: b.max.x - b.min.x, k, largeurBloc: (b.max.x - b.min.x) / k, profondeurBloc: (b.max.z - b.min.z) / k }
      }
      return {
        zoom: dem?.zoom ?? null, busy: !!e.modes?.busy, mode: e.modes?.mode ?? null,
        largeurM: f?.largeurM ?? dem?.extentMeters ?? null, moyenneM: moy, minM: f?.minM ?? dem?.minM ?? null, maxM: f?.maxM ?? dem?.maxM ?? null,
        exageration: f?.exageration ?? null, echelleVerticale: ech,
        cloudAltitude: p.cloudAltitude, cloudAltitudeM: p.cloudAltitudeM ?? null, cloudAltSpread: p.cloudAltSpread,
        baseY, topY, boiteHaute: Number.isFinite(boiteHaute) ? boiteHaute : null,
        plafondM: ech && moy != null && topY != null ? moy + topY / ech : null,
        baseM: ech && moy != null && baseY != null ? moy + baseY / ech : null,
        boiteHauteM: ech && moy != null && Number.isFinite(boiteHaute) ? moy + boiteHaute / ech : null,
        camY: e.camera.position.y, camAltM: ech && moy != null ? moy + e.camera.position.y / ech : null,
        camDist: e.camera.position.distanceTo(e.controls.target),
        entites: e.clouds.mesh?.count ?? null, paroisBloc,
        k: e.clouds.group.parent?.scale?.x ?? null, plafondM_module: e.clouds._plafondM ?? null,
      }
    },
  }
}
const INSTRUMENT = '(' + INSTRUMENT_FN.toString() + ')()'

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const pidChrome = nav.process()?.pid
const out = { port: PORT, pidChrome, paliers: [], sortie: null, erreurs: [] }
try {
  const page = await nav.newPage()
  page.on('console', (m) => { if (m.type() === 'error') out.erreurs.push(m.text().slice(0, 200)) })
  page.on('pageerror', (er) => out.erreurs.push('pageerror ' + String(er).slice(0, 200)))
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  await page.evaluate(INSTRUMENT)
  // ⚡ LE TÉMOIN BOUGEAIT SEUL : 30 à 50 k pixels entre deux captures OFF, tous
  // dans la boîte [405..875 × 630..799] — la barre de mode et la recherche, une
  // interface animée (sonde `scripts/diag-nua-temoin.mjs`, neuf suspects de
  // scène coupés un à un sans effet). On exclut ce rectangle du comptage.
  await page.evaluate(() => { window.__nuaExclusion = [395, 620, 885, 800] })

  const attendreCalme = async (zoomVoulu = null, ms = 25000) => {
    const t0 = Date.now()
    await page.waitForFunction((z) => {
      const e = window.__exp
      if (e.modes?.busy || e.modes?.travel || e.modes?._diveTween) return false
      if (!e.terrain?.dem) return false
      if (z != null && e.terrain.dem.zoom !== z) return false
      return true
    }, { timeout: ms, polling: 150 }, zoomVoulu).catch(() => {})
    await dodo(3500)
    return Date.now() - t0
  }

  // ── le vol de la vidéo ──
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 9))
  await attendreCalme(9, 60000)
  await dodo(6000)
  await page.evaluate(() => { const p = window.__exp.params; p.animations = false; p.grain = 0; p.surfaceFx = 0 })
  // la caméra montée au plafond, comme Adrien (cadrage du bloc entier)
  await page.evaluate(() => {
    const e = window.__exp, T = e.THREE
    const dir = new T.Vector3().subVectors(e.camera.position, e.controls.target).normalize()
    e.camera.position.copy(e.controls.target).addScaledVector(dir, e.controls.maxDistance)
    e.controls.update()
  })
  await dodo(2500)

  const capturer = async (nom) => {
    const b64 = await page.screenshot({ encoding: 'base64' })
    return page.evaluate((n, b) => window.__nua.prendre(n, b), nom, b64)
  }
  const nuagesOn = (v) => page.evaluate((x) => {
    const e = window.__exp
    e.params.cloudsEnabled = x
    if (x) { e.clouds.setVisible(true) } else e.clouds.setVisible(false)
  }, v)

  const mesurerPalier = async (etiq, nImages) => {
    const etat = await page.evaluate(() => window.__nua.etat())
    const prisme = { demi: 28, yBas: Math.min(-2, (etat.minM != null && etat.moyenneM != null && etat.echelleVerticale ? (etat.minM - etat.moyenneM) * etat.echelleVerticale : -2) - 3), yHaut: (etat.boiteHaute ?? etat.topY ?? 20) + 2 }
    await page.evaluate(() => window.__nua.vider())
    // témoin : deux captures OFF, rien ne change entre les deux
    await nuagesOn(false); await dodo(900)
    await capturer('OFF1'); await dodo(700); await capturer('OFF2')
    const temoin = await page.evaluate((p) => window.__nua.compter('OFF1', 'OFF2', 2, p, window.__nuaExclusion), prisme)
    await page.screenshot({ path: path.join(SORTIE, `${etiq}-OFF.png`) })
    await nuagesOn(true); await dodo(900)
    const images = []
    for (let i = 0; i < nImages; i++) {
      await capturer('ON')
      const c = await page.evaluate((p) => window.__nua.compter('ON', 'OFF1', 2, p, window.__nuaExclusion), prisme)
      images.push({ i, pixels: c.pixels, hors: c.hors, pourcent: c.pourcent, boite: c.boite })
      if (i === 0) { await page.screenshot({ path: path.join(SORTIE, `${etiq}-ON.png`) }); out._prisme = c.prisme }
      await dodo(180)
    }
    const px = images.map((x) => x.pixels).sort((a, b) => a - b)
    const hors = images.map((x) => x.hors)
    const r = {
      etiq, etat, prisme, temoin: { pixels: temoin.pixels, hors: temoin.hors },
      nuages: { min: px[0], mediane: px[Math.floor(px.length / 2)], max: px[px.length - 1] },
      horsSocle: { max: Math.max(...hors), images: hors.filter((h) => h > 0).length, sur: hors.length, liste: hors },
      images,
    }
    console.log(etiq, JSON.stringify({ z: etat.zoom, largeurM: etat.largeurM && Math.round(etat.largeurM), maxM: etat.maxM && Math.round(etat.maxM), moyM: etat.moyenneM && Math.round(etat.moyenneM), plafondM: etat.plafondM && Math.round(etat.plafondM), baseM: etat.baseM && Math.round(etat.baseM), camAltM: etat.camAltM && Math.round(etat.camAltM), exag: etat.exageration, topY: etat.topY, parois: etat.paroisBloc?.largeurBloc, temoin: r.temoin, nuages: r.nuages, hors: r.horsSocle.max, imgHors: r.horsSocle.images }))
    return r
  }

  // Une pose OBLIQUE à une altitude donnée en MÈTRES (la caméra du bloc, via
  // l'échelle verticale de la fenêtre bornée), inclinée de 55° sur la verticale
  // — le cadrage d'Adrien à z13 (3 115 m, rapport VID2) et à z14.
  const poserOblique = async (altM, degres = 55) => page.evaluate((alt, deg) => {
    const e = window.__exp, T = e.THREE, f = e.terrain.fenetreBornee
    const ech = f.echelleVerticale, camY = (alt - f.moyenneM) * ech
    const th = (deg * Math.PI) / 180
    const dist = camY / Math.cos(th)
    const cible = e.controls.target.clone(); cible.y = 0
    e.camera.position.set(cible.x + Math.sin(th) * dist * 0.7071, camY, cible.z + Math.sin(th) * dist * 0.7071)
    e.controls.target.copy(cible); e.controls.update()
    return { camY, dist, altM: f.moyenneM + e.camera.position.y / ech }
  }, altM, degres)

  out.paliers.push(await mesurerPalier('z09', N_IMAGES))
  for (let z = 10; z <= PALIER_MAX; z++) {
    for (let essai = 0; essai < 4; essai++) {
      await page.evaluate(() => window.__exp.modes.cranZoom(1))
      await dodo(400)
      await page.evaluate(() => window.__exp.modes.cranZoom(1))
      await attendreCalme(z, 30000)
      const zz = await page.evaluate(() => window.__exp.terrain.dem?.zoom)
      if (zz === z) break
    }
    out.paliers.push(await mesurerPalier(`z${z}`, N_IMAGES))
    if (z === 13 || z === 14) {
      const alt = z === 13 ? 3115 : 1560
      const pose = await poserOblique(alt)
      await dodo(2500)
      const r = await mesurerPalier(`z${z}-oblique-${alt}m`, N_IMAGES)
      r.pose = pose
      out.paliers.push(r)
      // on remet la caméra d'où elle était pour la suite du vol
      await page.evaluate(() => { const e = window.__exp, T = e.THREE; const dir = new T.Vector3(0.001, 1, 0.001).normalize(); e.camera.position.copy(e.controls.target).addScaledVector(dir, e.controls.maxDistance); e.controls.update() })
      await dodo(2000)
    }
  }
  // la sortie molette : trois crans arrière en moins d'une seconde
  await page.evaluate(async () => { const m = window.__exp.modes; m.cranZoom(-1); await new Promise((r) => setTimeout(r, 200)); m.cranZoom(-1); await new Promise((r) => setTimeout(r, 200)); m.cranZoom(-1) })
  await attendreCalme(PALIER_MAX - 2, 60000)
  await page.waitForFunction(() => window.__exp.clouds.group.parent.scale.x !== 1, { timeout: 30000, polling: 200 }).catch(() => {})
  await dodo(2000)
  out.sortie = await mesurerPalier('sortie-3crans', N_IMAGES)
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
