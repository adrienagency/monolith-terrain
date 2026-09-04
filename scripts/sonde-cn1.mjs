// SONDE CN1 — L'ÉCART ENTRE LE TEXEL SERVI ET LE PIXEL AFFICHÉ.
//
// ══════════ CE QU'ELLE MESURE, ET POURQUOI COMME ÇA ═══════════════════════════
//
// Adrien : « quand je zoome dans le socle, l'image ne gagne pas en détail, elle
// grossit ». Un agent avait avancé « un texel servi couvre 15 pixels d'écran,
// 4 niveaux de manque ». Ce chiffre n'avait jamais été reproduit. Cette sonde le
// remesure — et rien ici n'est dérivé d'une constante du code : tout est lu sur
// ce qui est RÉELLEMENT DESSINÉ à l'image mesurée.
//
// La chaîne, maillon par maillon :
//   ① le point du sol au CENTRE DU CROP → la tuile la plus fine DESSINÉE qui le
//     contient (balayage de `globe.tiles`, `mesh.visible`) ;
//   ② **le texel servi** : la largeur au sol de cette tuile divisée par son
//     nombre de texels — `uTilePx` lu SUR LE MATÉRIAU de la tuile dessinée, pas
//     sur une constante de source (Mapterhorn sert du 512, le repli AWS du 256,
//     et un surzoom sert un ancêtre : les trois se lisent ici) ;
//   ③ **le pixel d'écran** : la position monde du maillage de cette tuile
//     (`matrixWorld`, donc l'origine relative de §4 de la compétence), projetée
//     par la caméra RÉELLEMENT UTILISÉE POUR LE RENDU, deux fois, à 100 m
//     d'écart au sol, dans la tangente horizontale de l'écran ET dans la
//     verticale. Le rapport des deux, c'est le chiffre d'Adrien.
//
// ⛔ **LA PROJECTION EST FAITE À LA MAIN, PAS PAR `Vector3.project`.** Ce n'est
// pas un caprice : les trois espaces de coordonnées (bloc 56 unités, globe
// R = 100, caméra d'effets) sont la classe de défaut revenue dix fois sur ce
// chantier. On lit `camGlobe.projectionMatrix` et `camGlobe.matrixWorldInverse`
// telles qu'elles sont au moment de l'image, on multiplie, on divise par w. Il
// n'y a aucune conversion d'unité dans la chaîne : la seule grandeur physique
// qui y entre est `ORBITAL_M_PER_UNIT`, et elle est lue dans `/src/geo.js`.
//
// ⚠️ **ET ON PROUVE QU'ON REGARDE QUELQUE CHOSE** (§3 de la compétence, deux
// faux zéros payés par CULL) : le journal porte `cropVivant`, `tuileCentre`,
// `dessineesDansCrop`. Une cellule sans crop, ou sans tuile dessinée au centre,
// est déclarée INVALIDE et ne produit aucun chiffre.
//
// ⚠️ **20 IMAGES CONSÉCUTIVES, JAMAIS UNE** (cycle de période 4 documenté ici).
//
// EMPLOI
//   node scripts/sonde-cn1.mjs --port 8941 --lieu majorque --zoombloc 13 \
//     --altitudes 20000,10000,5000,2000,900,400,170 --cpu 4
// Sort `.banc/CN1/<etiquette>.json`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8941'))
const CPU = Number(opt('--cpu', '4'))
const LIEU = opt('--lieu', 'majorque')
const ZOOM_BLOC = Number(opt('--zoombloc', '13'))
const IMAGES = Number(opt('--images', '20'))
const ALTS = String(opt('--altitudes', '20000,10000,5000,2000,900,400,170')).split(',').map(Number).filter((v) => v > 0)
const ETIQ = opt('--etiquette', `${LIEU}-z${ZOOM_BLOC}`)
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'CN1'))
const CLICHES = opt('--cliches', null) // dossier des captures, si demandé
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// Trois échelles différentes, comme le brief l'exige.
const LIEUX = {
  alpes: [45.92, 6.87],       // relief fort
  bretagne: [48.38, -4.49],   // littoral découpé
  beauce: [48.20, 1.72],      // plaine
  majorque: [39.62, 2.98],    // le lieu des captures d'Adrien
  zermatt: [46.02, 7.75],     // z17 disponible (swissALTI3D)
}

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ═══════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ════════════════════════════
function INSTRUMENTER({ SRC_DANS_CROP, MPU, W, H }) {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__cn1) return 'déjà posé'
  const g = e.globe
  const dansCrop = new Function('return (' + SRC_DANS_CROP + ')')()
  const P = { phase: 'attente', images: [] }
  window.__cn1 = P
  const CIRC = 40075016.686

  // --- projection à la main : m4 (tableau colonne-major de three) × vec4 -----
  const appl = (m, v) => [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ]
  const enPixels = (cam, p) => {
    const vue = appl(cam.matrixWorldInverse.elements, [p[0], p[1], p[2], 1])
    const clip = appl(cam.projectionMatrix.elements, vue)
    if (!(Math.abs(clip[3]) > 1e-12)) return null
    return [(clip[0] / clip[3]) * (W / 2), (clip[1] / clip[3]) * (H / 2)]
  }
  const norm = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n] }
  const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const pdt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const orthoNorm = (v, u) => norm(moins(v, [u[0] * pdt(v, u), u[1] * pdt(v, u), u[2] * pdt(v, u)]))

  function mesureImage() {
    const c = g._crop
    if (!c) return { cropVivant: false }
    // le centre du crop en lat/lon (l'inverse de mercX / mercY)
    const lonC = c.cx * 360 - 180
    const latC = (Math.atan(Math.sinh(Math.PI * (1 - 2 * c.cy))) * 180) / Math.PI

    // ① la tuile la plus fine DESSINÉE qui contient le centre du crop
    let best = null
    const histo = {}
    let dessineesDansCrop = 0
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      if (!(g._crop && dansCrop(t.z, t.x, t.y, g._crop))) continue
      dessineesDansCrop++
      histo[t.z] = (histo[t.z] || 0) + 1
      const n = 2 ** t.z
      const tx = Math.min(n - 1, Math.max(0, Math.floor(c.cx * n)))
      const ty = Math.min(n - 1, Math.max(0, Math.floor(c.cy * n)))
      if (t.x === tx && t.y === ty && (!best || t.z > best.z)) best = t
    }
    if (!best) return { cropVivant: true, tuileCentre: null, histo, dessineesDansCrop }

    // ② le texel servi — `uTilePx` LU SUR LE MATÉRIAU DE LA TUILE DESSINÉE
    const u = best.mesh.material?.uniforms
    const tilePx = u?.uTilePx?.value ?? null
    const largeurTuileM = (CIRC * Math.cos((latC * Math.PI) / 180)) / 2 ** best.z
    const mParTexel = tilePx ? largeurTuileM / tilePx : null

    // ③ le pixel d'écran, par la caméra RÉELLEMENT rendue
    const cam = e.camGlobe
    cam.updateMatrixWorld?.()
    const mw = best.mesh.matrixWorld.elements
    const p0 = [mw[12], mw[13], mw[14]]
    const up = norm(p0) // la verticale locale : le maillage vit sur la sphère
    const camM = cam.matrixWorld.elements
    const droite = [camM[0], camM[1], camM[2]]
    const hautCam = [camM[4], camM[5], camM[6]]
    const tH = orthoNorm(droite, up)   // tangente ~ horizontale d'écran
    const tV = orthoNorm(hautCam, up)  // tangente ~ verticale d'écran
    const eps = 100 / MPU              // 100 m de sol, en unités de globe
    const a = enPixels(cam, p0)
    const bH = enPixels(cam, [p0[0] + tH[0] * eps, p0[1] + tH[1] * eps, p0[2] + tH[2] * eps])
    const bV = enPixels(cam, [p0[0] + tV[0] * eps, p0[1] + tV[1] * eps, p0[2] + tV[2] * eps])
    const dpxH = a && bH ? Math.hypot(bH[0] - a[0], bH[1] - a[1]) : null
    const dpxV = a && bV ? Math.hypot(bV[0] - a[0], bV[1] - a[1]) : null
    const mppH = dpxH > 1e-9 ? 100 / dpxH : null
    const mppV = dpxV > 1e-9 ? 100 / dpxV : null

    return {
      cropVivant: true, latC, lonC,
      tuileCentre: { z: best.z, x: best.x, y: best.y, tilePx },
      largeurTuileM, mParTexel,
      mppEcranH: mppH, mppEcranV: mppV,
      // ⚡ LE CHIFFRE D'ADRIEN : combien de pixels d'écran pour un texel servi.
      // Dans la direction la MOINS raccourcie (horizontale d'écran) : c'est là
      // que le texel est le plus étalé, donc là que le flou se voit.
      pxParTexelH: mppH ? mParTexel / mppH : null,
      pxParTexelV: mppV ? mParTexel / mppV : null,
      histo, dessineesDansCrop,
      niveauxDansCrop: Object.keys(histo).map(Number).sort((x, y) => x - y),
    }
  }

  let tPrec = null
  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a
    if (P.phase !== 'releve') { return out } // la mesure coûte : seulement au relevé
    const m = mesureImage()
    const now = performance.now()
    const dtImage = tPrec === null ? null : now - tPrec
    tPrec = now
    const d = e.dem
    P.images.push({
      frame: g.frame, phase: P.phase, poste: P.poste ?? null,
      alt: e.altitudeCadrageM ? Math.round(e.altitudeCadrageM()) : null,
      cache: g.tiles.size, credit: g._credit, file: g.queue.length,
      cacheMax: g.cacheMax, zCropEcran: g._zCropEcran ?? null,
      cropDemi: g._crop ? g._crop.demi : null,
      msUpdate: Math.round(msUpdate * 1000) / 1000,
      dtImage: dtImage === null ? null : Math.round(dtImage * 100) / 100,
      demZoom: e.params.demZoom,
      // ⚠️ LE BLOC, SÉPARÉMENT : ce que le MNT du socle sait, face à ce que le
      // crop montre. Les deux moitiés du brief.
      bloc: d ? { zoom: d.zoom, mParTexel: d.metersPerPixel, size: d.size, extentM: d.extentMeters, source: d.demSource, maxZoom: d.maxZoom } : null,
      terrainVisible: !!e.terrain?.group?.visible,
      ...m,
    })
    if (P.images.length > 20000) P.images.splice(0, 4000)
    return out
  }
  return 'posé'
}

const quantile = (arr, q) => { const s = arr.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null }
const med = (xs) => quantile(xs, 0.5)
const uniq = (xs) => [...new Set(xs.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v))

async function attendreCalme(page, maxMs) {
  const a = Date.now(); let precedent = null; let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => { const g = window.__exp.globe; return { n: g.tiles.size, file: g.queue.length, vol: g.inFlight } })
    const cle = `${e.n}/${e.file}/${e.vol}`
    if (e.file === 0 && e.vol === 0 && cle === precedent) {
      if (stableDepuis === null) stableDepuis = Date.now()
      else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false }
    } else stableDepuis = null
    precedent = cle
    await dodo(200)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  if (CLICHES) fs.mkdirSync(CLICHES, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  let phase = 'attente'
  const reseau = {}
  const enCours = new Map()
  cdp.on('Network.requestWillBeSent', (ev) => {
    let hote = '?'; try { hote = new URL(ev.request.url).host } catch { /* data: */ }
    if (hote === `localhost:${PORT}` || hote === `127.0.0.1:${PORT}` || hote === '?') return
    enCours.set(ev.requestId, phase); (reseau[phase] ??= { requetes: 0, octets: 0 }).requetes++
  })
  cdp.on('Network.loadingFinished', (ev) => { const ph = enCours.get(ev.requestId); if (ph === undefined) return; enCours.delete(ev.requestId); (reseau[ph] ??= { requetes: 0, octets: 0 }).octets += ev.encodedDataLength || 0 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 200)))

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, lieu: LIEU, latlon: LIEUX[LIEU], zoomBloc: ZOOM_BLOC, altitudes: ALTS, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString(), postes: [] }
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  const prep = await page.evaluate(async () => {
    const m = await import('/src/monde/crop-sphere.js')
    const geo = await import('/src/geo.js')
    return { src: m.tuileDansCrop.toString(), mpu: geo.ORBITAL_M_PER_UNIT, rGlobe: geo.R_GLOBE }
  })
  journal.orbitalMParUnite = prep.mpu
  journal.instrument = await page.evaluate(INSTRUMENTER, { SRC_DANS_CROP: prep.src, MPU: prep.mpu, W: LARGEUR, H: HAUTEUR })

  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  journal.seuil = await page.evaluate(async () => {
    const s = await import('/src/monde/seuil-socle.js')
    return { naissanceM: s.SEUIL_NAISSANCE_M, mortM: s.SEUIL_MORT_M, zoomSocle: s.ZOOM_SOCLE }
  })
  // ⛔ la pose de démarrage arrive après plusieurs secondes, entre 30,7 et 33,6 km
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 90000, polling: 200 }).catch(() => { journal.busyDemarrage = true })
  await dodo(2500)

  const [lat, lon] = LIEUX[LIEU] || LIEUX.majorque
  await page.evaluate(async ({ la, lo, z }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: z }, 'CN1')
  }, { la: lat, lo: lon, z: ZOOM_BLOC })
  await dodo(3000)
  journal.calmeArrivee = await attendreCalme(page, 180000)
  journal.plafondSource = await page.evaluate(() => {
    const d = window.__exp.dem
    return d ? { zoom: d.zoom, source: d.demSource, maxZoom: d.maxZoom, mParTexel: d.metersPerPixel, size: d.size, extentM: d.extentMeters } : null
  })

  for (const alt of ALTS) {
    phase = `alt${alt}`
    await page.evaluate((p) => { window.__cn1.phase = 'vol'; window.__cn1.poste = p }, alt)
    // ⚠️ GLISSÉ LE LONG DE L'AXE — pas un geste de dézoom (D21 ①), donc le crop
    // ne meurt pas, et `params.demZoom` n'est écrit par personne : c'est
    // exactement la question du brief.
    const pas = await page.evaluate(async (a) => {
      const e = window.__exp, cam = e.camera, ct = e.controls
      ct.minDistance = 1e-6; ct.maxDistance = 1e12
      const dir = cam.position.clone().sub(ct.target).normalize()
      const out = []
      for (let i = 0; i < 60; i++) {
        const cur = e.altitudeCadrageM()
        if (!Number.isFinite(cur) || cur <= 0) break
        const d = cam.position.distanceTo(ct.target)
        const nd = d * (a / cur)
        if (!Number.isFinite(nd) || nd <= 0) break
        cam.position.copy(ct.target).addScaledVector(dir, nd)
        ct.update?.()
        await new Promise((r) => setTimeout(r, 120))
        out.push(Math.round(e.altitudeCadrageM()))
        if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
      }
      return out
    }, alt)
    await dodo(1500)
    const calme = await attendreCalme(page, 120000)
    await page.evaluate(() => { window.__cn1.phase = 'releve' })
    const t0 = Date.now()
    while (Date.now() - t0 < 45000) {
      const n = await page.evaluate((p) => window.__cn1.images.filter((i) => i.phase === 'releve' && i.poste === p).length, alt)
      if (n >= IMAGES) break
      await dodo(200)
    }
    await page.evaluate(() => { window.__cn1.phase = 'vol' })
    const brut = await page.evaluate((p) => JSON.parse(JSON.stringify(window.__cn1.images.filter((i) => i.phase === 'releve' && i.poste === p))), alt)
    const im = brut.slice(0, Math.max(IMAGES, 1))
    const valide = im.length >= IMAGES && im.every((i) => i.cropVivant && i.tuileCentre)
    const poste = {
      altVisee: alt, pas, calme, images: im.length, valide,
      altReelle: med(im.map((i) => i.alt)),
      demZoom: uniq(im.map((i) => i.demZoom)),
      zCropEcran: uniq(im.map((i) => i.zCropEcran)),
      zTuileCentre: uniq(im.map((i) => i.tuileCentre?.z ?? null)),
      tilePxCentre: uniq(im.map((i) => i.tuileCentre?.tilePx ?? null)),
      mParTexelCrop: med(im.map((i) => i.mParTexel)),
      mppEcranH: med(im.map((i) => i.mppEcranH)),
      mppEcranV: med(im.map((i) => i.mppEcranV)),
      pxParTexelH: med(im.map((i) => i.pxParTexelH)),
      pxParTexelV: med(im.map((i) => i.pxParTexelV)),
      niveauxManquantsH: (() => { const r = med(im.map((i) => i.pxParTexelH)); return r > 0 ? Math.log2(r) : null })(),
      blocMParTexel: med(im.map((i) => i.bloc?.mParTexel ?? null)),
      blocZoom: uniq(im.map((i) => i.bloc?.zoom ?? null)),
      blocSource: uniq(im.map((i) => i.bloc?.source ?? null)),
      blocMaxZoom: uniq(im.map((i) => i.bloc?.maxZoom ?? null)),
      terrainVisible: uniq(im.map((i) => i.terrainVisible)),
      histoUnique: uniq(im.map((i) => i.histo)),
      niveauxDansCrop: uniq(im.map((i) => i.niveauxDansCrop)),
      dessineesDansCrop: uniq(im.map((i) => i.dessineesDansCrop)),
      cropDemi: med(im.map((i) => i.cropDemi)),
      cache: med(im.map((i) => i.cache)),
      credit: med(im.map((i) => i.credit)),
      file: med(im.map((i) => i.file)),
      msUpdate: { p50: quantile(im.map((i) => i.msUpdate), 0.5), p99: quantile(im.map((i) => i.msUpdate), 0.99) },
      msImage: { p50: quantile(im.map((i) => i.dtImage), 0.5), p99: quantile(im.map((i) => i.dtImage), 0.99) },
      reseau: reseau[phase] ?? null,
    }
    journal.postes.push(poste)
    console.log(`[${ETIQ}] ${alt} m → alt ${poste.altReelle} · valide ${valide} · demZoom ${JSON.stringify(poste.demZoom)} · zCentre ${JSON.stringify(poste.zTuileCentre)} · tilePx ${JSON.stringify(poste.tilePxCentre)}`)
    console.log(`         m/texel ${poste.mParTexelCrop?.toFixed(3)} · m/px écran H ${poste.mppEcranH?.toFixed(3)} · ⚡ px/texel H ${poste.pxParTexelH?.toFixed(2)} (V ${poste.pxParTexelV?.toFixed(2)}) · manque ${poste.niveauxManquantsH?.toFixed(2)} niveaux`)
    console.log(`         bloc MNT ${poste.blocMParTexel?.toFixed(3)} m/texel (z${JSON.stringify(poste.blocZoom)}, ${JSON.stringify(poste.blocSource)}) · histo ${JSON.stringify(poste.niveauxDansCrop)} · cache ${poste.cache}`)
    if (CLICHES) {
      const f = path.join(CLICHES, `${ETIQ}-${alt}m.png`)
      await page.screenshot({ path: f })
      poste.cliche = f
    }
  }

  journal.erreurs = erreurs
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
