// SONDE PLF — LE CROP PORTÉ À HAUTE ALTITUDE SANS INTENTION DE SORTIR.
//
// ══════════ CE QU'ELLE REPRODUIT ════════════════════════════════════════════
//
// La situation exacte du brief PLF, et de la mesure « 1 700 tuiles / 44,1 ms »
// qui l'a motivée : le crop **naît au bloc** (sous `SEUIL_BLOC_M`), puis la
// caméra est **glissée le long de son axe** jusqu'à ~130 km d'altitude de
// cadrage. Ce déplacement n'est PAS un geste de dézoom, donc D21 ① ne tue pas
// le crop : il vit à 130 km, et c'est là qu'on mesure. (Le glissé d'axe est
// exactement la pose de `scripts/profil-pf1.mjs`, `poserPoste`.)
//
// ⛔ **LA NAISSANCE EST VÉRIFIÉE AVANT LA MONTÉE.** Poser directement la caméra
// à 130 km ne fait naître aucun crop (le seuil est à 32 274 m) : on mesurerait
// alors une scène SANS crop et on lirait « pas de défaut ». Le journal porte
// `cropAuBloc` et `cropEnHaut` ; si l'un des deux est faux, la cellule est
// invalide et le dit.
//
// ══════════ CE QU'ELLE RELÈVE, ET OÙ ═══════════════════════════════════════
//
// Tout est relevé **DANS `update()` et DANS `_traverse`**, au moment de la
// décision — §3 de `/threejs-optimisation` : une sonde posée APRÈS la fonction
// lit un état écrasé (`_credit` lu après `update()` rendait 404 là où sa valeur
// était 0).
//   · `cache` (`tiles.size`), `credit` (`_credit`), `file` (`queue.length`) ;
//   · `visites` — tuiles PARCOURUES, comptées dans `_dansLeChamp` ;
//   · `msTraverse` — le parcours seul, chronométré à la racine de la récursion ;
//   · `msUpdate` — `update()` en entier ; `dtImage` — l'écart entre deux images ;
//   · `zCropEcran` — le niveau prescrit par `_zoomCropEcran` à cette image ;
//   · `zMax` — le niveau le PLUS FIN réellement maillé (le plafond effectif) et
//     `zUnique` — le nombre de niveaux distincts DESSINÉS dans l'emprise du
//     crop : c'est l'invariant d'uniformité de l'affiche.
//
// ⚠️ **20 IMAGES CONSÉCUTIVES, JAMAIS UNE.** Un relevé sur une image tombe sur
// une phase du cycle (période 4 documentée sur ce chantier).
//
// EMPLOI
//   node scripts/sonde-plf.mjs --port 8837 --etiquette apres-majorque \
//     --lieu majorque --alt 130000 --cpu 4 --levier 1
// `--levier 0` débraye `cropZoomEcran` : c'est le dépôt d'AVANT le correctif
// CULL ⑤, mesuré dans la même campagne, même banc, même geste.
// Sort `.banc/PLF/<etiquette>.json`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8837'))
const ETIQ = opt('--etiquette', 'plf')
const CPU = Number(opt('--cpu', '4'))
const ALT = Number(opt('--alt', '130000'))
const LIEU = opt('--lieu', 'majorque')
const LEVIER = opt('--levier', '1') !== '0'
const IMAGES = Number(opt('--images', '20'))
// ⚠️ **LE NIVEAU DU BLOC EN HAUT — ET C'EST LUI QUI FAIT L'EMPRISE.** L'emprise
// du crop N'EST PAS le socle : `assietteCrop` la déduit du bloc courant, qui
// suit `params.demZoom`. Monter la caméra seule laisse le bloc à z13, donc un
// crop de 14,7 km : on mesurerait une scène minuscule et on lirait « pas de
// défaut ». `--zoomhaut 9` re-pose le bloc au niveau de l'altitude visée — la
// pose du poste `surface` de `scripts/profil-pf1.mjs`, celle des 1 700 tuiles.
const ZOOM_HAUT = Number(opt('--zoomhaut', '9'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'PLF'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const LIEUX = {
  majorque: [39.62, 2.98],
  bretagne: [48.38, -4.49],
  alpes: [45.92, 6.87],
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

// ═══════════════ L'INSTRUMENT, POSÉ DANS LA PAGE (jamais après) ═════════════
function INSTRUMENTER(SRC_DANS_CROP) {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__plf) return 'déjà posé'
  const g = e.globe
  const dansCrop = new Function('return (' + SRC_DANS_CROP + ')')()
  const P = { phase: 'attente', images: [] }
  window.__plf = P
  const ROOT_Z = 2

  let profondeur = 0, msTraverse = 0, visites = 0
  const travOrig = g._traverse.bind(g)
  g._traverse = function (t, a, b) {
    if (profondeur === 0) {
      const d = performance.now(); profondeur++
      try { return travOrig(t, a, b) } finally { profondeur--; msTraverse += performance.now() - d }
    }
    profondeur++
    try { return travOrig(t, a, b) } finally { profondeur-- }
  }
  const champOrig = g._dansLeChamp.bind(g)
  g._dansLeChamp = function (t, camDir) {
    const r = champOrig(t, camDir)
    if (r) visites++
    return r
  }

  let tPrec = null
  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    msTraverse = 0; visites = 0
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a

    // ⚠️ le recensement se fait ICI, dans la même image que la décision
    let cache = 0, maillees = 0, dessinees = 0, enChargement = 0
    let zMax = 0
    const niveauxDessinesDansCrop = {}
    for (const t of g.tiles.values()) {
      cache++
      if (t.state === 'loading') enChargement++
      if (t.mesh) { maillees++; if (t.z > zMax) zMax = t.z }
      if (t.mesh && t.mesh.visible) {
        dessinees++
        if (t.z > ROOT_Z && g._crop && dansCrop(t.z, t.x, t.y, g._crop)) niveauxDessinesDansCrop[t.z] = (niveauxDessinesDansCrop[t.z] || 0) + 1
      }
    }
    const now = performance.now()
    const dtImage = tPrec === null ? null : now - tPrec
    tPrec = now
    P.images.push({
      frame: g.frame, t: Math.round(now), phase: P.phase,
      alt: e.altitudeCadrageM ? Math.round(e.altitudeCadrageM()) : null,
      cache, maillees, dessinees, enChargement, visites,
      credit: g._credit, file: g.queue.length, vol: g.inFlight,
      cacheMax: g.cacheMax,
      msTraverse: Math.round(msTraverse * 1000) / 1000,
      msUpdate: Math.round(msUpdate * 1000) / 1000,
      dtImage: dtImage === null ? null : Math.round(dtImage * 100) / 100,
      crop: !!g._crop, cropDemi: g._crop ? g._crop.demi : null,
      zCropEcran: g._zCropEcran ?? null, zMax,
      niveauxDansCrop: niveauxDessinesDansCrop,
      cropZoomEcran: g.cropZoomEcran,
    })
    if (P.images.length > 40000) P.images.splice(0, 8000)
    return out
  }
  return 'posé'
}

const quantile = (arr, q) => { const s = arr.filter((v) => typeof v === 'number').sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null }
const st = (xs) => ({ p50: quantile(xs, 0.5), p99: quantile(xs, 0.99), max: Math.max(0, ...xs.filter((v) => typeof v === 'number')) })

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
  const poserPhase = async (p) => { phase = p; await page.evaluate((x) => { window.__plf.phase = x }, p) }
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 200)))

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, lieu: LIEU, latlon: LIEUX[LIEU], altVisee: ALT, levier: LEVIER, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString() }
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  await page.evaluate(async () => {
    const m = await import('/src/monde/crop-sphere.js')
    window.__SRC_DANS_CROP = m.tuileDansCrop.toString()
  })
  const src = await page.evaluate(() => window.__SRC_DANS_CROP)
  journal.instrument = await page.evaluate(INSTRUMENTER, src)
  journal.levierPose = await page.evaluate((v) => {
    const g = window.__exp.globe
    if (!('cropZoomEcran' in g)) return 'absent'
    g.cropZoomEcran = v
    return g.cropZoomEcran
  }, LEVIER)

  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  // ⚠️ le voile `.ce-elemwrap` / `.ce-hubveil` avale les gestes — brief PLF
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  journal.seuil = await page.evaluate(async () => {
    const s = await import('/src/monde/seuil-socle.js')
    return { naissanceM: s.SEUIL_NAISSANCE_M, mortM: s.SEUIL_MORT_M }
  })
  // ⛔ la pose de démarrage arrive après plusieurs secondes, entre 30,7 et
  // 33,6 km : toute mesure prise avant qu'elle soit immobile est un faux constat
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 90000, polling: 200 }).catch(() => { journal.busyDemarrage = true })
  await dodo(2500)

  const [lat, lon] = LIEUX[LIEU] || LIEUX.majorque

  // ── ① LA NAISSANCE AU BLOC (sous le seuil) ──
  await poserPhase('bloc')
  await page.evaluate(async ({ la, lo }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: 13 }, 'PLF')
  }, { la: lat, lo: lon })
  await dodo(3000)
  journal.calmeBloc = await attendreCalme(page, 120000)
  journal.etatBloc = await page.evaluate(() => {
    const e = window.__exp, g = e.globe
    return { mode: e.modes.mode, alt: e.altitudeCadrageM?.() ?? null, crop: !!g._crop, cache: g.tiles.size, zCropEcran: g._zCropEcran ?? null }
  })
  journal.cropAuBloc = journal.etatBloc.crop
  console.log(`[${ETIQ}] bloc : ${JSON.stringify(journal.etatBloc)}`)

  // ── ② LA MONTÉE, SANS GESTE DE DÉZOOM (D21 ①) ──
  await poserPhase('montee')
  if (ZOOM_HAUT > 0) {
    await page.evaluate(async ({ la, lo, z }) => { await window.__exp.modes._rescale({ lat: la, lon: lo, zoom: z }, 'PLF-haut') }, { la: lat, lo: lon, z: ZOOM_HAUT })
    await dodo(2500)
  }
  journal.zoomHaut = ZOOM_HAUT
  journal.montee = await page.evaluate(async (alt) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    const pas = []
    for (let i = 0; i < 60; i++) {
      const a = e.altitudeCadrageM()
      if (!Number.isFinite(a) || a <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (alt / a)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      await new Promise((r) => setTimeout(r, 120))
      pas.push(Math.round(e.altitudeCadrageM()))
      if (Math.abs(e.altitudeCadrageM() - alt) / alt < 0.004) break
    }
    return pas
  }, ALT)
  await dodo(2000)
  journal.calmeHaut = await attendreCalme(page, 180000)

  // ── ③ LE RELEVÉ : N images consécutives, au repos, à l'altitude visée ──
  await poserPhase('haut')
  await dodo(1200)
  // on laisse passer N images du produit (le relevé se fait DANS `update`)
  const depart = await page.evaluate(() => window.__plf.images.length)
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const n = await page.evaluate(() => window.__plf.images.filter((i) => i.phase === 'haut').length)
    if (n >= IMAGES) break
    await dodo(250)
  }
  journal.etatHaut = await page.evaluate(() => {
    const e = window.__exp, g = e.globe
    return { mode: e.modes.mode, alt: e.altitudeCadrageM?.() ?? null, crop: !!g._crop, cache: g.tiles.size, credit: g._credit, file: g.queue.length, cacheMax: g.cacheMax, zCropEcran: g._zCropEcran ?? null, cropDemi: g._crop?.demi ?? null }
  })
  journal.cropEnHaut = journal.etatHaut.crop
  journal.imagesDepart = depart

  const P = await page.evaluate(() => JSON.parse(JSON.stringify({ images: window.__plf.images })))
  const haut = P.images.filter((i) => i.phase === 'haut').slice(0, Math.max(IMAGES, 1))
  const resume = {
    images: haut.length,
    valide: journal.cropAuBloc === true && journal.cropEnHaut === true && haut.length >= IMAGES,
    altP50: quantile(haut.map((i) => i.alt), 0.5),
    cache: st(haut.map((i) => i.cache)),
    maillees: st(haut.map((i) => i.maillees)),
    dessinees: st(haut.map((i) => i.dessinees)),
    credit: st(haut.map((i) => i.credit)),
    file: st(haut.map((i) => i.file)),
    visites: st(haut.map((i) => i.visites)),
    traverse: { p50: quantile(haut.map((i) => i.msTraverse), 0.5), p99: quantile(haut.map((i) => i.msTraverse), 0.99) },
    update: { p50: quantile(haut.map((i) => i.msUpdate), 0.5), p99: quantile(haut.map((i) => i.msUpdate), 0.99) },
    msImage: { p50: quantile(haut.map((i) => i.dtImage), 0.5), p99: quantile(haut.map((i) => i.dtImage), 0.99) },
    zCropEcran: [...new Set(haut.map((i) => i.zCropEcran))],
    zMax: [...new Set(haut.map((i) => i.zMax))],
    // l'uniformité de l'affiche : combien de niveaux DIFFÉRENTS sont dessinés
    // dans l'emprise du crop, par image
    niveauxDansCrop: haut.map((i) => Object.keys(i.niveauxDansCrop).map(Number).sort((a, b) => a - b)),
    cropDemi: haut.length ? haut[haut.length - 1].cropDemi : null,
    reseau: reseau.haut ?? null,
  }
  journal.resume = resume
  journal.brut = haut
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log(`— ${ETIQ} (${LIEU}, CPU ×${CPU}, levier ${LEVIER ? 'ON' : 'OFF'}) — ${haut.length} images à ${resume.altP50} m —`)
  console.log(`VALIDE ${resume.valide} · crop au bloc ${journal.cropAuBloc} · crop en haut ${journal.cropEnHaut}`)
  console.log(`cache p50 ${resume.cache.p50} / ${journal.etatHaut.cacheMax} · credit p50 ${resume.credit.p50} · file p50 ${resume.file.p50} · parcourues p50 ${resume.visites.p50}`)
  console.log(`_traverse p50/p99 ${resume.traverse.p50} / ${resume.traverse.p99} ms · update ${resume.update.p50} / ${resume.update.p99} ms · ms/image ${resume.msImage.p50} / ${resume.msImage.p99}`)
  console.log(`zCropEcran ${JSON.stringify(resume.zCropEcran)} · zMax maillé ${JSON.stringify(resume.zMax)} · niveaux dessinés dans le crop (dernière image) ${JSON.stringify(resume.niveauxDansCrop[resume.niveauxDansCrop.length - 1] || [])}`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
