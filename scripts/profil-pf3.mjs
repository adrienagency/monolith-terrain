// PROFIL PF3 — LE COÛT DE CHAQUE PASSE DU COMPOSITEUR, PAR MODE, À LA MINUTERIE
// DU PILOTE — et la preuve en pixels de ce que chaque mode dessine.
//
// ══════════ CE QU'ELLE MESURE ═══════════════════════════════════════════════
//
// À trois postes de vue — orbite (2 000 km), surface hors crop (z9, ≈ 103 km),
// crop (z13, ≈ 6,4 km) — et sur trois machines émulées (la mienne ; CPU ×4 ;
// CPU ×6 + pixelRatio 2), pour chaque passe de `composer.passes` :
//
//   · le temps GPU (`EXT_disjoint_timer_query_webgl2`, UNE requête par passe,
//     jamais imbriquées — les passes sont séquentielles) ;
//   · le temps CPU de soumission (`performance.now()` autour de `pass.render`) ;
//   · les appels de dessin et les triangles (`renderer.info`, `autoReset` coupé
//     et remis à zéro par image, delta par passe) ;
//   · `enabled`, pour dire si la passe est SAUTÉE (0) ou exécutée.
//
// Plus, par image : l'intervalle rAF (le temps d'image vu par l'utilisateur),
// les erreurs GL après `composer.render`, et l'état du régime : crop posé,
// `globe._mer` présent, `aoPass.enabled`, `dofPass.enabled`, opacité du grain.
//
// ⚠️ **≥ 30 IMAGES CONSÉCUTIVES, p50 ET p99** — jamais une valeur isolée
// (`socle-perf.md`, cycle de période 4 documenté).
//
// ⚠️ **TÉMOIN DE VALIDITÉ DE LA MINUTERIE** : les mêmes images à ×4 fragments
// (pixelRatio ×2). Une passe plein écran dont le temps ne suit pas les
// fragments est une ligne NON VALIDE, et le tableau le dit.
//
// ⚠️ **LES PIXELS** : après `composer.render`, `readPixels` sur le tampon de la
// page, dans la même tâche (patron `sonde-flou-focus.mjs`). L'image est
// écrite en `.rgba.gz` pour être comparée AVANT/APRÈS par `--comparer`.
// `params.animations = false` fige tout ce qui bouge sans geste (rotation
// d'orbite, houle, grain) : deux images au repos doivent être identiques.
//
// ⚠️ **LA BASCULE** (`--bascule 1`) : descente à la molette depuis ≈ 100 km à
// travers `SEUIL_NAISSANCE_M` (32 274 m), puis remontée à travers
// `SEUIL_MORT_M` (40 343 m). À CHAQUE image : altitude, `veilleCrop.pose`,
// pixels changés par rapport à l'image précédente. La marche est un pic de
// pixels changés au moment où `pose` bascule, au-delà du fond dû au mouvement.
//
// EMPLOI
//   npm run dev -- --port 6231 --strictPort
//   node scripts/profil-pf3.mjs --port 6231 --etiquette avant
//   node scripts/profil-pf3.mjs --port 6231 --etiquette avant --effets 1
//   node scripts/profil-pf3.mjs --port 6231 --etiquette avant --bascule 1 --effets 1
//   node scripts/profil-pf3.mjs --comparer .banc/PF3/avant.json .banc/PF3/apres.json
//
// Options : --machines mienne,x4,x6dpr2 · --postes crop,surface,orbite · --images 30
//
// ⚠️ **`puppeteer-core` N'EST PAS UNE DÉPENDANCE PRODUIT** (même règle que
// `sonde-demarrage.mjs`) : on le prend là où il est installé.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d }
const PORT = Number(opt('--port', '6231'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/PF3'))
const ETIQ = opt('--etiquette', 'releve')
const IMAGES = Number(opt('--images', '30'))
const EFFETS = opt('--effets', '0') !== '0' // AO + grain + bokeh allumés par l'utilisateur
const BASCULE = opt('--bascule', '0') !== '0'
const MACHINES = (opt('--machines', 'mienne,x4,x6dpr2')).split(',')
const POSTES = (opt('--postes', 'crop,surface,orbite')).split(',')
const SEUIL_PX = Number(opt('--seuil', '4'))
// ⚠️ **GPU LOGICIEL** (`--swiftshader 1`) : le pire cas, un portable sans carte.
// PF1 l'a mesuré à 337–490 ms par image, dont 11–15 % dans l'EffectPass — c'est
// là que « les effets hors crop » pèsent vraiment. Le nom de machine est suffixé.
const SWIFTSHADER = opt('--swiftshader', '0') !== '0'
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ══════════ --comparer : le tableau avant/après, en markdown ═══════════════
if (opt('--comparer')) {
  const A = JSON.parse(fs.readFileSync(opt('--comparer'), 'utf8'))
  const B = JSON.parse(fs.readFileSync(args[args.indexOf('--comparer') + 2], 'utf8'))
  comparer(A, B)
  process.exit(0)
}

function trouverChrome() {
  const t = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(Boolean).find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — CHROME_PATH'); process.exit(2) }
  return t
}
const CHEMIN = [
  path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
  'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
].find((x) => fs.existsSync(x))
if (!CHEMIN) { console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2) }
const puppeteer = (await import('file:///' + CHEMIN.split('\\').join('/'))).default

// ══════════ L'INSTRUMENT, DANS LA PAGE ═════════════════════════════════════
function poserBanc() {
  const e = window.__exp
  const R = e.renderer
  const gl = R.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const composer = e.composer
  const passes = composer.passes
  const nomPasse = (p) => {
    // ⚠️ le nom de classe de n8ao est MINIFIÉ par vite (`$…$export$…`) : on
    // reconnaît la passe à sa `configuration.aoRadius`, pas à son nom
    const c = p.configuration && p.configuration.aoRadius !== undefined ? 'N8AOPostPass' : p.constructor.name
    if (c === 'EffectPass') return 'EffectPass(' + p.effects.map((f) => f.constructor.name.replace(/Effect$/, '')).join('+') + ')'
    if (c === 'RenderPass' || c === 'PasseFond') return c + (p.scene === e.sceneGlobe ? '[globe]' : '[bloc]')
    return c
  }
  const banc = {
    ext: !!ext, noms: passes.map(nomPasse), images: [], attente: [], on: false,
    capture: false, precedent: null, diffPrecedent: null, seuil: 4,
    apresRendu: null,
  }
  R.info.autoReset = false
  for (const [i, p] of passes.entries()) {
    const orig = p.render.bind(p)
    p.render = (...a) => {
      const img = banc.courante
      if (!img) return orig(...a)
      const c0 = R.info.render.calls, t0v = R.info.render.triangles
      const t0 = performance.now()
      let q = null
      if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q) }
      orig(...a)
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); banc.attente.push({ q, i, idx: img.idx }) }
      img.cpu[i] = performance.now() - t0
      img.calls[i] = R.info.render.calls - c0
      img.tris[i] = R.info.render.triangles - t0v
    }
  }
  const origRender = composer.render.bind(composer)
  let idx = 0
  let tPrec = null
  composer.render = (dt) => {
    if (!banc.on) return origRender(dt)
    const t = performance.now()
    const img = {
      idx: idx++, t, dtRaf: tPrec == null ? null : t - tPrec,
      enabled: passes.map((p) => !!p.enabled), cpu: passes.map(() => 0), gpu: passes.map(() => null),
      calls: passes.map(() => 0), tris: passes.map(() => 0), glErr: [],
      etat: banc.lireEtat(),
    }
    tPrec = t
    R.info.reset()
    banc.courante = img
    origRender(dt)
    banc.courante = null
    img.cpuTotal = performance.now() - t
    let err, n = 0
    while ((err = gl.getError()) !== gl.NO_ERROR && n < 8) { img.glErr.push(err); n++ }
    if (banc.capture) {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const a = new Uint8Array(w * h * 4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a)
      img.w = w; img.h = h
      if (banc.precedent && banc.precedent.length === a.length) {
        let ch = 0, max = 0
        const p = banc.precedent
        for (let k = 0; k < a.length; k += 4) {
          const d = Math.max(Math.abs(a[k] - p[k]), Math.abs(a[k + 1] - p[k + 1]), Math.abs(a[k + 2] - p[k + 2]))
          if (d > banc.seuil) ch++
          if (d > max) max = d
        }
        img.pxChanges = ch; img.pxMax = max; img.pxTotal = w * h
      }
      banc.precedent = a
      banc.derniere = a
    }
    banc.images.push(img)
    if (banc.apresRendu) banc.apresRendu(img)
  }
  banc.lireEtat = () => {
    const g = e.globe
    const ao = passes.find((p) => p.configuration && p.configuration.aoRadius !== undefined)
    const dof = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'DepthOfFieldEffect'))
    const fx = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
    const grain = fx && fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
    return {
      // ⚠️ en orbite `altitudeCadrageM()` est un résidu (voir `veille-socle.js` §2) : on lit `modes.altM`
      mode: e.modes.mode, busy: !!e.modes.busy, altM: e.modes.mode === 'orbital' ? e.modes.altM : (e.altitudeCadrageM?.() ?? e.modes.altM),
      pose: !!e.veilleCrop?.pose, bascules: e.veilleCrop?.bascules ?? null,
      crop: !!g?._crop, mer: !!g?._mer, merRT: !!g?._merRefractRT,
      cropOn: g?.uniforms?.uCropOn?.value ?? null,
      ao: ao ? !!ao.enabled : null, dof: dof ? !!dof.enabled : null,
      grain: grain ? grain.blendMode.opacity.value : null,
      tuiles: g?.tiles?.size ?? null, enVol: g?.tuilesEnVol?.() ?? null,
    }
  }
  // récolte les requêtes GPU terminées
  banc.recolter = async () => {
    for (let n = 0; n < 600 && banc.attente.length; n++) {
      const reste = []
      for (const r of banc.attente) {
        if (gl.getQueryParameter(r.q, gl.QUERY_RESULT_AVAILABLE)) {
          const ns = gl.getQueryParameter(r.q, gl.QUERY_RESULT)
          const img = banc.images.find((x) => x.idx === r.idx)
          if (img) img.gpu[r.i] = ns / 1e6
          gl.deleteQuery(r.q)
        } else reste.push(r)
      }
      banc.attente = reste
      if (reste.length) await new Promise((r) => requestAnimationFrame(r))
    }
    return { restantes: banc.attente.length, disjoint: ext ? gl.getParameter(ext.GPU_DISJOINT_EXT) : null }
  }
  banc.echelle = (k) => {
    const pr = R.getPixelRatio()
    R.setPixelRatio(pr * k)
    composer.setSize(window.innerWidth, window.innerHeight)
    return { avant: pr, apres: R.getPixelRatio(), canevas: [R.domElement.width, R.domElement.height] }
  }
  banc.canevas = () => [R.domElement.width, R.domElement.height, R.getPixelRatio()]
  // la fonction de mélange d'origine du grain, pour l'A/B `--grainAB`
  const fxGrain = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
  banc.blendOrigine = fxGrain ? fxGrain.effects.find((f) => f.constructor.name === 'NoiseEffect').blendMode.blendFunction : null
  banc.DST = 9 // BlendFunction.DST (= SKIP) dans postprocessing 6.39 : l'effet n'entre pas dans le programme
  window.__pf3 = banc
  return { ext: !!ext, noms: banc.noms, enabled: passes.map((p) => !!p.enabled) }
}

// Attendre N images RENDUES (celles que le composer produit vraiment).
async function releverImages(page, n, { capture = false } = {}) {
  // ⚠️ **LA PHASE DU GRAIN EST REMISE À ZÉRO AVANT UNE CAPTURE.** `EffectMaterial.time`
  // avance de `deltaTime` à chaque image rendue ; figée par `animations = false`,
  // elle garde la valeur atteinte au gel — différente d'un chargement à l'autre
  // (mesuré : 78 % de pixels « changés », moyenne 13 niveaux, sur deux images
  // par ailleurs identiques). Même phase, même bruit.
  await page.evaluate((cap) => {
    const b = window.__pf3
    if (cap) for (const p of window.__exp.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0
    b.images = []; b.attente = []; b.capture = cap; b.precedent = null; b.on = true
  }, capture)
  // ⚠️ sur GPU logiciel le fil principal est saturé par SwiftShader : les sondes
  // CDP mettent des secondes à répondre, 25 images ont dépassé 180 s. 20 min.
  await page.waitForFunction((n) => window.__pf3.images.length >= n, { polling: 200, timeout: SWIFTSHADER ? 1200000 : 180000 }, n)
  const recolte = await page.evaluate(async () => { const b = window.__pf3; b.on = false; b.capture = false; return b.recolter() })
  const images = await page.evaluate(() => window.__pf3.images)
  return { images, recolte }
}

function quantiles(a) {
  const t = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y)
  if (!t.length) return { n: 0, p50: null, p99: null, moy: null }
  const q = (p) => t[Math.min(t.length - 1, Math.floor(p * (t.length - 1)))]
  return { n: t.length, p50: q(0.5), p99: q(0.99), moy: t.reduce((s, x) => s + x, 0) / t.length }
}

function resumer(noms, images) {
  // on jette les 5 premières : chauffe des requêtes et des cibles
  const imgs = images.slice(5)
  const parPasse = noms.map((nom, i) => ({
    nom, enabled: imgs.every((x) => x.enabled[i]) ? true : imgs.some((x) => x.enabled[i]) ? 'mixte' : false,
    gpu: quantiles(imgs.map((x) => x.gpu[i])), cpu: quantiles(imgs.map((x) => x.cpu[i])),
    calls: quantiles(imgs.map((x) => x.calls[i])), tris: quantiles(imgs.map((x) => x.tris[i])),
  }))
  return {
    n: imgs.length,
    parPasse,
    gpuTotal: quantiles(imgs.map((x) => x.gpu.every((v) => v != null || !x.enabled[x.gpu.indexOf(v)]) ? x.gpu.reduce((s, v) => s + (v || 0), 0) : NaN)),
    cpuComposer: quantiles(imgs.map((x) => x.cpuTotal)),
    dtRaf: quantiles(imgs.map((x) => x.dtRaf)),
    glErr: imgs.reduce((s, x) => s + x.glErr.length, 0),
    glErrCodes: [...new Set(imgs.flatMap((x) => x.glErr))],
    etat: imgs.at(-1)?.etat ?? null,
  }
}

// Un cran de molette sur le CANVAS — le chemin de l'utilisateur (patron
// `sonde-descente.mjs` : `modes.js` écoute sur `renderer.domElement`).
async function molette(page, sens, periode = 150) {
  await page.evaluate((dy) => {
    window.__exp.renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, clientX: 640, clientY: 400, bubbles: true, cancelable: true }))
  }, sens * 120)
  await dodo(periode)
}
const lireAlt = (page) => page.evaluate(() => ({ alt: window.__exp.altitudeCadrageM?.() ?? 0, mode: window.__exp.modes.mode, busy: !!window.__exp.modes.busy, enVol: window.__exp.globe?.tuilesEnVol?.() ?? 0 }))
// au repos : plus occupé, altitude stable à 0,2 % près, aucune tuile en vol
async function attendreRepos(page) {
  let prec = null
  for (let i = 0; i < 60; i++) {
    const s = await lireAlt(page)
    if (!s.busy && prec != null && Math.abs(s.alt - prec) < Math.abs(s.alt) * 0.002 && s.enVol === 0) return s
    prec = s.alt
    await dodo(500)
  }
  return lireAlt(page)
}

// ⛔ **NI `flyTo` NI `_rescale` POUR SE PLACER.** Mesuré sur l'arbre figé :
// `__exp.flyTo(lat, lon, 9)` depuis la surface laisse la caméra à NaN (camY,
// altM — un défaut pour PF4), et `_rescale` en mode continu ne déplace pas la
// caméra (z13 → z9 : altitude inchangée). On prend donc la molette, comme
// l'utilisateur : le crop en zoomant jusqu'à ≤ 6,5 km, la surface hors crop en
// dézoomant jusqu'à 100–150 km (le crop meurt à 40,3 km), l'orbite par
// `enterOrbit`.
async function allerAuPoste(page, poste) {
  if (poste === 'orbite') {
    await page.evaluate(async (a) => {
      const m = window.__exp.modes
      if (m.mode !== 'orbital') m.enterOrbit(a)
      await new Promise((r) => setTimeout(r, 2500))
      const parM = m.orbAlt / Math.max(m.altM, 1)
      m.orbAlt = m.orbAltTarget = a * parM
    }, 2_000_000)
  } else {
    // ⛔ **PAS DE MOLETTE POUR SE PLACER, ET C'EST MESURÉ.** Deux chargements
    // posés « au même endroit » à la molette rendaient 80 % de pixels différents
    // (moyenne 15 niveaux) alors qu'une même page ne dérive pas d'un pixel en
    // deux minutes : les ancres de l'échelle continue (`oublierAncres`,
    // globe.js) dépendent des CRANS visités, et la molette n'en fait jamais le
    // même nombre. On part donc de la pose de démarrage, sans geste.
    // ⚠️ **LA POSE EST FIGÉE PAR VALEUR, ET C'EST CE QUI REND LES PIXELS
    // COMPARABLES.** La molette ne s'arrête pas au même cran d'un chargement à
    // l'autre (5 668 m contre 5 020 m relevés) : deux images de deux caméras ne
    // prouvent rien. On fige donc le BLOC (`_rescale` sur un centre et un zoom
    // fixes — en mode continu il ne déplace pas la caméra) puis la CAMÉRA, en
    // unités de bloc : cible au sol au centre, altitude métrique convertie par
    // l'échelle du bloc, inclinaison ~20° du nadir.
    // ⚠️ `__exp.dem` est NUL sous `terre unique` (pas de bloc plat) : l'échelle
    // « mètres par unité » n'est pas lisible. On pose donc la hauteur par
    // ITÉRATION sur `altitudeCadrageM()` — trois passes suffisent, l'altitude est
    // linéaire en la hauteur au-dessus du sol.
    await page.evaluate(async (a) => {
      const e = window.__exp, m = e.modes
      await m._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'PF3 pose fixe')
      const gy = (typeof e.terrain?.sample === 'function' ? e.terrain.sample(0, 0) : 0) || 0
      let H = 20
      for (let n = 0; n < 3; n++) {
        e.controls.target.set(0, gy, 0)
        e.camera.position.set(0, gy + H * 0.94, H * 0.342)
        e.controls.update()
        const alt = e.altitudeCadrageM()
        if (!(alt > 0)) break
        H = H * (a.altM / alt)
      }
      e.controls.target.set(0, gy, 0)
      e.camera.position.set(0, gy + H * 0.94, H * 0.342)
      e.controls.update()
    }, poste === 'crop' ? { lat: -21.115, lon: 55.536, zoom: 13, altM: 5000 } : { lat: -21.115, lon: 55.536, zoom: 9, altM: 130000 })
    await attendreRepos(page)
    const s2 = await lireAlt(page)
    console.log('  pose fixe ' + poste + ' : ' + JSON.stringify(s2))
  }
  await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
  await dodo(5000)
  await page.waitForFunction(() => !window.__exp.modes.busy, { polling: 100, timeout: 30000 }).catch(() => {})
}

async function allumerEffets(page) {
  // par les mêmes portes que l'utilisateur : le panneau écrit params ET l'objet
  await page.evaluate(() => {
    const e = window.__exp
    e.params.ssaoEnabled = true
    e.params.grain = 0.2
    const fx = e.composer.passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
    const grain = fx && fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
    if (grain) grain.blendMode.opacity.value = 0.2
    // ⚠️ le brassage du look tire `bokehScale` au sort (16,2 relevé) : épinglé à 4
    e.params.bokehScale = 4
    e.params.autoFocus = false
    // la bascule bokeh de l'interface — le chemin de l'utilisateur, et le SEUL
    // qui bâtisse la passe (`setDofEnabled` n'est pas sur `__exp`). ⚠️ Ne pas
    // poser `bokehEnabled` avant : le clic inverse la valeur courante.
    const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
    const btn = lab?.parentElement?.querySelector('button.ce-toggle')
    if (btn && !e.params.bokehEnabled) btn.click()
    const passeDof = e.composer.passes.find((p) => p.effects && p.effects.some((x) => x.constructor.name === 'DepthOfFieldEffect'))
    const dof = passeDof && passeDof.effects.find((x) => x.constructor.name === 'DepthOfFieldEffect')
    if (dof) dof.bokehScale = 4
    if (typeof e.poserRegimeCrop === 'function') e.poserRegimeCrop()
  })
  await dodo(1500)
}

async function ouvrirPage(nav, machine) {
  const page = await nav.newPage()
  const dpr = machine === 'x6dpr2' ? 2 : 1
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: dpr })
  const journal = []
  page.on('console', (m) => { const t = m.text(); if (/not compiled|not linked|ERROR: 0:|WebGL/.test(t)) journal.push(t.slice(0, 300)) })
  page.on('pageerror', (e) => journal.push('pageerror: ' + String(e.message).slice(0, 200)))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  // ⚠️ `?cadence=pleine` : PF4 (`cadence-repos.js`) ne dessine plus qu'une image
  // sur 2 (sur 30 si figé) en orbite au repos. Ce banc pèse le coût d'UNE image
  // composée, passe par passe : il rend donc toutes les images. Le gain de PF4
  // est orthogonal et se mesure chez lui.
  await page.goto('http://127.0.0.1:' + PORT + '/?cadence=pleine', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(10000)
  await page.keyboard.press('Escape')
  await dodo(2500)
  await page.evaluate(() => { window.__exp.params.animations = false })
  // ⚠️ **LE PALIER EST FIXÉ À 0 POUR COMPARER** (`socle-perf.md` : « le palier
  // machine change tes chiffres sous toi »). Sous CPU ×4 le gouverneur
  // descendait au palier 3 en cours de relevé — pixelRatio 0,85 et grain 0 —
  // et deux relevés ne mesuraient plus la même image. On pose le palier 0 et on
  // rend le gouverneur muet pour la durée du banc ; `palierMachine` (l'estimation
  // au démarrage) est relevé à côté, tel quel.
  const palier = await page.evaluate(() => {
    const aq = window.__exp.aq
    const avant = aq ? { tier: aq.tier, startTier: aq.startTier } : null
    if (aq) { aq.setTier(0, true); aq.update = () => {} }
    return { avant, grainDepart: window.__exp.params.grain, ssaoDepart: window.__exp.params.ssaoEnabled, bokehDepart: window.__exp.params.bokehEnabled }
  })
  const cdp = await page.createCDPSession()
  const taux = machine === 'x4' ? 4 : machine === 'x6dpr2' ? 6 : 1
  if (taux > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: taux })
  const contexte = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    const P = window.__palierMachine || {}
    return {
      gpu: d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu',
      palier: P.palier ?? P.tier ?? null, palierNom: P.nom ?? null, ecran: P.signaux?.ecran ?? null,
      pixelRatio: window.__exp.renderer.getPixelRatio(), dpr: window.devicePixelRatio,
      canevas: [window.__exp.renderer.domElement.width, window.__exp.renderer.domElement.height],
      flags: location.search,
    }
  })
  contexte.gouverneur = palier
  return { page, cdp, journal, contexte, taux, dpr }
}

// ══════════ LE RELEVÉ ═══════════════════════════════════════════════════════
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  // ⚠️ GPU logiciel : un `Runtime.callFunctionOn` peut attendre des minutes derrière
  // une image SwiftShader ; le délai de protocole par défaut (180 s) tuait le banc.
  protocolTimeout: SWIFTSHADER ? 1200000 : 180000,
  // ⚠️ sans `--disable-frame-rate-limit` / `--disable-gpu-vsync`, toute cellule
  // rapide rend 16,7 ms : le temps d'image serait celui du vsync, pas du travail
  // (même réglage que `profil-pf1.mjs`).
  args: ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--window-size=1280,900',
    '--disable-frame-rate-limit', '--disable-gpu-vsync',
    ...(SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']),
    '--disable-dev-shm-usage'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { etiquette: ETIQ, quand: new Date().toISOString(), images: IMAGES, effets: EFFETS, bascule: BASCULE, swiftshader: SWIFTSHADER, machines: [] }
try {
  for (const machine of (BASCULE ? ['mienne'] : MACHINES)) {
    const { page, cdp, journal, contexte, taux, dpr } = await ouvrirPage(nav, machine)
    console.log(`\n═══ machine ${machine} (CPU ×${taux}, dpr ${dpr}) — ${contexte.gpu} — palier ${contexte.palier} — pixelRatio ${contexte.pixelRatio} — canevas ${contexte.canevas.join('×')}`)
    const M = { machine, taux, dpr, contexte, postes: [] }
    if (EFFETS) await allumerEffets(page)
    const pose = await page.evaluate(poserBanc)
    console.log(`passes : ${pose.noms.map((n, i) => n + (pose.enabled[i] ? '' : ' [off]')).join(' → ')} | minuterie GPU : ${pose.ext}`)
    M.passes = pose

    if (BASCULE) {
      // z10 : 51 km, au-dessus de la mort (40,3 km) ; on descend à la molette
      await allerAuPoste(page, 'surface') // ≈ 103 km, au-dessus de la mort (40,3 km)
      if (EFFETS) await allumerEffets(page)
      await page.evaluate(() => { const b = window.__pf3; b.images = []; b.attente = []; b.capture = true; b.precedent = null; b.seuil = 4; b.on = true })
      await dodo(1000)
      // descente jusqu'à la naissance, +2 s ; remontée jusqu'à la mort, +2 s
      for (let i = 0; i < 80; i++) {
        await molette(page, -1, 120)
        if (await page.evaluate(() => !!window.__exp.veilleCrop?.pose)) break
      }
      await dodo(2500)
      for (let i = 0; i < 80; i++) {
        await molette(page, +1, 120)
        if (await page.evaluate(() => !window.__exp.veilleCrop?.pose)) break
      }
      await dodo(2500)
      const recolte = await page.evaluate(async () => { const b = window.__pf3; b.on = false; b.capture = false; return b.recolter() })
      const images = await page.evaluate(() => window.__pf3.images.map((x) => ({ idx: x.idx, dtRaf: x.dtRaf, alt: x.etat.altM, pose: x.etat.pose, bascules: x.etat.bascules, mer: x.etat.mer, ao: x.etat.ao, dof: x.etat.dof, grain: x.etat.grain, enabled: x.enabled, px: x.pxChanges ?? null, pxMax: x.pxMax ?? null, gpu: x.gpu, glErr: x.glErr.length })))
      M.bascule = { images, recolte }
      // les images qui encadrent chaque bascule
      let prec = null
      for (const im of images) {
        if (prec && prec.pose !== im.pose) console.log(`  bascule ${prec.pose ? 'MORT' : 'NAISSANCE'} à l'image ${im.idx} (alt ${Math.round(im.alt)} m) : px changés ${prec.px} → ${im.px} → ${images[im.idx + 1]?.px} | ao ${prec.ao}→${im.ao} grain ${prec.grain}→${im.grain} mer ${prec.mer}→${im.mer}`)
        prec = im
      }
      const fond = quantiles(images.filter((x) => x.px != null).map((x) => x.px))
      console.log(`  fond de mouvement (px changés/image) : p50 ${fond.p50} · p99 ${fond.p99} · n ${fond.n}`)
      M.journal = journal
      rapport.machines.push(M)
      await page.close()
      continue
    }

    // ══════════ --pixelab : l'A/B en pixels DANS LA MÊME SESSION (méthode PF4) ═══════
    //
    // Entre deux sessions, seule l'orbite est déterministe (mer, nuages,
    // caustiques ont des phases différentes). Ici, sur la page « après », on
    // capture l'image du régime (A), puis on rejoue l'ÉTAT que l'ancien code
    // posait — grain à `params.grain` en surface / 0 en orbite, occlusion sur
    // `ssaoEnabled && surface`, profondeur de champ coupée en orbite — on
    // capture (B), et on rend la main au régime (`poserRegimeCrop`). Le crop doit
    // rendre 0 pixel (même état) ; hors crop, l'écart EST ce que l'ancien code
    // dessinait de trop.
    if (opt('--pixelab', '0') !== '0') {
      for (const poste of POSTES) {
        await allerAuPoste(page, poste)
        await page.evaluate(() => { if (typeof window.__exp.poserRegimeCrop === 'function') window.__exp.poserRegimeCrop() })
        await dodo(500)
        const r = await page.evaluate(() => {
          const e = window.__exp, gl = e.renderer.getContext()
          const passes = e.composer.passes
          const fx = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
          const grain = fx && fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
          const ao = passes.find((p) => p.configuration && p.configuration.aoRadius !== undefined)
          const dofP = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'DepthOfFieldEffect'))
          const cap = () => { for (const p of passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0; e.composer.render(0); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a }
          const diff = (a, b) => { let n = 0, m = 0, s = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])); if (d > 4) n++; if (d > m) m = d; s += d } return { n, max: m, moyen: +(s / (a.length / 4)).toFixed(4), N: a.length / 4 } }
          const etatA = { ao: ao ? ao.enabled : null, dof: dofP ? dofP.enabled : null, grain: grain ? grain.blendMode.opacity.value : null }
          const A = cap()
          const temoin = diff(A, cap())
          // l'état de l'ANCIEN code
          const surface = e.modes.mode === 'surface'
          if (grain) grain.blendMode.opacity.value = surface ? e.params.grain : 0
          if (ao) ao.enabled = !!e.params.ssaoEnabled && e.params._aoTierOk !== false && surface && !e.modes.busy
          if (dofP) dofP.enabled = surface && !!e.params.bokehEnabled && e.params.bokehScale > 0
          const etatB = { ao: ao ? ao.enabled : null, dof: dofP ? dofP.enabled : null, grain: grain ? grain.blendMode.opacity.value : null }
          const B = cap()
          const ecart = diff(A, B)
          e.poserRegimeCrop()
          if (dofP) dofP.enabled = !!e.params.bokehEnabled && e.params.bokehScale > 0
          const C = cap()
          const retour = diff(A, C)
          return { mode: e.modes.mode, alt: e.modes.mode === 'orbital' ? e.modes.altM : e.altitudeCadrageM(), crop: !!e.globe._crop, etatA, etatB, temoin, ecart, retour }
        })
        M.postes.push({ poste, pixelab: r })
        console.log(`[${machine} · ${poste}] ${r.mode} ${Math.round(r.alt)} m crop ${r.crop} — régime ${JSON.stringify(r.etatA)} → ancien code ${JSON.stringify(r.etatB)} : ${r.ecart.n} px / ${r.ecart.N} (${(100 * r.ecart.n / r.ecart.N).toFixed(3)} %), max ${r.ecart.max}, moyen ${r.ecart.moyen} | témoin ${r.temoin.n} px | retour au régime ${r.retour.n} px`)
      }
      M.journal = journal
      rapport.machines.push(M)
      await page.close()
      continue
    }

    // ══════════ --grainAB : le résidu du grain à opacité 0 dans la passe fusionnée ═════
    //
    // Le grain est un effet FUSIONNÉ dans la passe finale (un seul programme) :
    // « une passe à intensité 0 coûte son plein prix » se mesure donc ici en
    // A/B : A = grain présent à opacité 0 (ce que fait le régime hors crop),
    // B = grain EXCLU du nuanceur (`BlendFunction.SKIP` = 9 : `postprocessing`
    // ne l'intègre pas au programme, recompilation). Protocole R31 : 40 rendus
    // de chauffe après chaque recompilation, ordre tournant, différences
    // appariées, médiane — sur le temps GPU de la passe finale.
    if (opt('--grainAB', '0') !== '0') {
      await allerAuPoste(page, 'surface')
      const iFx = pose.noms.findIndex((n) => /Noise/.test(n))
      const paires = []
      const A = [], B = []
      for (let tour = 0; tour < 6; tour++) {
        const ordre = tour % 2 === 0 ? ['A', 'B'] : ['B', 'A']
        const t = {}
        for (const v of ordre) {
          await page.evaluate((v) => {
            const e = window.__exp
            const fx = e.composer.passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
            const g = fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
            g.blendMode.opacity.value = 0
            // A : la fonction de mélange d'origine (OVERLAY) ; B : DST — dans
            // postprocessing 6.39 c'est DST (pas SKIP) que l'intégration exclut du
            // programme fusionné (`if (blendFunction === BlendFunction.DST)`)
            g.blendMode.blendFunction = v === 'A' ? window.__pf3.blendOrigine : window.__pf3.DST
          }, v)
          await dodo(300)
          const { images } = await releverImages(page, 45) // 40 de chauffe + 5… on jette 15
          const r = quantiles(images.slice(15).map((x) => x.gpu[iFx]))
          t[v] = r.p50; (v === 'A' ? A : B).push(r.p50)
        }
        if (t.A != null && t.B != null) paires.push(t.A - t.B)
        console.log(`  tour ${tour} : A (grain à 0) ${t.A?.toFixed(4)} ms · B (grain exclu) ${t.B?.toFixed(4)} ms`)
      }
      const tri = [...paires].sort((a, b) => a - b)
      const med = tri.length ? tri[Math.floor(tri.length / 2)] : null
      const moy = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
      M.grainAB = { A, B, paires, mediane: med, pctDeLaPasse: moy(A) > 0 ? (med / moy(A)) * 100 : null, canevas: contexte.canevas }
      console.log(`  ⇒ résidu du grain à opacité 0 : médiane des différences appariées ${med?.toFixed(4)} ms (${M.grainAB.pctDeLaPasse?.toFixed(1)} % de la passe finale, ${contexte.canevas.join('×')})`)
      M.journal = journal
      rapport.machines.push(M)
      await page.close()
      continue
    }

    for (const poste of POSTES) {
      await allerAuPoste(page, poste)
      if (EFFETS) await page.evaluate(() => { if (typeof window.__exp.poserRegimeCrop === 'function') window.__exp.poserRegimeCrop() })
      await dodo(500)
      const etat0 = await page.evaluate(() => window.__pf3.lireEtat())
      const { images, recolte } = await releverImages(page, IMAGES + 5, { capture: true })
      const res = resumer(pose.noms, images)
      // témoin : ×4 fragments
      const ech = await page.evaluate(() => window.__pf3.echelle(2))
      await dodo(800)
      const t4 = await releverImages(page, 15)
      await page.evaluate(() => window.__pf3.echelle(0.5))
      await dodo(500)
      const res4 = resumer(pose.noms, t4.images)
      const temoin = pose.noms.map((n, i) => {
        const a = res.parPasse[i].gpu.p50, b = res4.parPasse[i].gpu.p50
        return a && b ? +(b / a).toFixed(2) : null
      })
      // l'image, écrite pour la comparaison avant/après
      const rgba = await page.evaluate(() => {
        const b = window.__pf3
        const a = b.derniere
        if (!a) return null
        let s = ''
        const CH = 0x8000
        for (let i = 0; i < a.length; i += CH) s += String.fromCharCode.apply(null, a.subarray(i, i + CH))
        return btoa(s)
      })
      let fichierImage = null
      if (rgba) {
        const buf = Buffer.from(rgba, 'base64')
        const w = images.at(-1).w, h = images.at(-1).h
        fichierImage = path.join(SORTIE, `${ETIQ}-${machine}-${poste}${EFFETS ? '-effets' : ''}${SWIFTSHADER ? '-swiftshader' : ''}-${w}x${h}.rgba.gz`)
        fs.writeFileSync(fichierImage, zlib.gzipSync(buf))
      }
      const P = { poste, etat0, etat: res.etat, resume: res, temoin, echelleTemoin: ech, recolte, image: fichierImage ? path.basename(fichierImage) : null, w: images.at(-1).w, h: images.at(-1).h,
        repos: quantiles(images.slice(6).map((x) => x.pxChanges)) }
      M.postes.push(P)
      const f = (q) => q.p50 == null ? '   —  ' : q.p50.toFixed(3).padStart(6)
      console.log(`\n[${machine} · ${poste}] mode ${res.etat.mode} alt ${Math.round(res.etat.altM)} m crop ${res.etat.crop} mer ${res.etat.mer} ao ${res.etat.ao} dof ${res.etat.dof} grain ${res.etat.grain} tuiles ${res.etat.tuiles} | rAF p50 ${res.dtRaf.p50?.toFixed(2)} p99 ${res.dtRaf.p99?.toFixed(2)} ms | GPU Σ p50 ${res.gpuTotal.p50?.toFixed(3)} p99 ${res.gpuTotal.p99?.toFixed(3)} ms | CPU composer p50 ${res.cpuComposer.p50?.toFixed(3)} ms | erreurs GL ${res.glErr}/${res.n} img [${res.glErrCodes}] | pixels changés au repos p50 ${P.repos.p50} p99 ${P.repos.p99} (disjoint ${recolte.disjoint})`)
      for (const [i, pp] of res.parPasse.entries()) {
        console.log(`   ${pp.nom.padEnd(52)} ${pp.enabled === true ? 'on ' : pp.enabled === false ? 'OFF' : 'mix'}  GPU p50 ${f(pp.gpu)} p99 ${f(pp.gpu.p99 != null ? { p50: pp.gpu.p99 } : pp.gpu)} ms  CPU ${f(pp.cpu)} ms  appels ${String(pp.calls.p50).padStart(4)}  tris ${String(pp.tris.p50).padStart(8)}  témoin ×4 fragments ⇒ ×${temoin[i] ?? '—'}`)
      }
    }
    M.journal = journal
    rapport.machines.push(M)
    await page.close()
  }
} finally {
  await nav.close()
}
const cible = path.join(SORTIE, `${ETIQ}${EFFETS ? '-effets' : ''}${BASCULE ? '-bascule' : ''}${SWIFTSHADER ? '-swiftshader' : ''}${opt('--pixelab', '0') !== '0' ? '-pixelab' : ''}.json`)
fs.writeFileSync(cible, JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + cible)

// ══════════ --comparer ═════════════════════════════════════════════════════
function comparer(A, B) {
  const f = (x, d = 3) => x == null ? '—' : (+x).toFixed(d)
  for (const MA of A.machines) {
    const MB = B.machines.find((m) => m.machine === MA.machine)
    if (!MB) continue
    console.log(`\n### ${MA.machine} — CPU ×${MA.taux}, pixelRatio ${MA.contexte.pixelRatio} (${MA.contexte.canevas.join('×')}), palier ${MA.contexte.palier}, ${MA.contexte.gpu}`)
    for (const PA of MA.postes) {
      const PB = MB.postes.find((p) => p.poste === PA.poste)
      if (!PB) continue
      console.log(`\n**${PA.poste}** — alt ${Math.round(PA.etat.altM)} m · crop ${PA.etat.crop} · mer ${PA.etat.mer}→${PB.etat.mer} · ao ${PA.etat.ao}→${PB.etat.ao} · dof ${PA.etat.dof}→${PB.etat.dof} · grain ${PA.etat.grain}→${PB.etat.grain}`)
      console.log('| passe | avant | GPU p50 avant | après | GPU p50 après | témoin ×4 (avant/après) |')
      console.log('|---|---|---|---|---|---|')
      const noms = new Set([...PA.resume.parPasse.map((p) => p.nom), ...PB.resume.parPasse.map((p) => p.nom)])
      for (const nom of noms) {
        const a = PA.resume.parPasse.find((p) => p.nom === nom), b = PB.resume.parPasse.find((p) => p.nom === nom)
        const on = (p) => !p ? 'absente' : p.enabled === true ? 'on' : p.enabled === false ? 'OFF (0)' : 'mixte'
        console.log(`| ${nom} | ${on(a)} | ${a && a.enabled ? f(a.gpu.p50) : '0'} | ${on(b)} | ${b && b.enabled ? f(b.gpu.p50) : '0'} | ×${f(PA.temoin[PA.resume.parPasse.indexOf(a)], 2)} / ×${f(PB.temoin[PB.resume.parPasse.indexOf(b)], 2)} |`)
      }
      console.log(`| **Σ GPU** | | ${f(PA.resume.gpuTotal.p50)} (p99 ${f(PA.resume.gpuTotal.p99)}) | | ${f(PB.resume.gpuTotal.p50)} (p99 ${f(PB.resume.gpuTotal.p99)}) | |`)
      console.log(`| **rAF (temps d'image)** | | ${f(PA.resume.dtRaf.p50, 2)} (p99 ${f(PA.resume.dtRaf.p99, 2)}) | | ${f(PB.resume.dtRaf.p50, 2)} (p99 ${f(PB.resume.dtRaf.p99, 2)}) | |`)
      console.log(`| **CPU composer** | | ${f(PA.resume.cpuComposer.p50)} | | ${f(PB.resume.cpuComposer.p50)} | |`)
      console.log(`| erreurs GL / image | | ${(PA.resume.glErr / PA.resume.n).toFixed(2)} | | ${(PB.resume.glErr / PB.resume.n).toFixed(2)} | |`)
      // pixels
      if (PA.image && PB.image) {
        const dir = path.dirname(opt('--comparer'))
        const dirB = path.dirname(args[args.indexOf('--comparer') + 2])
        try {
          const ia = zlib.gunzipSync(fs.readFileSync(path.join(dir, PA.image)))
          const ib = zlib.gunzipSync(fs.readFileSync(path.join(dirB, PB.image)))
          if (ia.length !== ib.length) console.log(`pixels : tailles différentes (${ia.length} / ${ib.length})`)
          else {
            let n = 0, max = 0, somme = 0
            for (let k = 0; k < ia.length; k += 4) {
              const d = Math.max(Math.abs(ia[k] - ib[k]), Math.abs(ia[k + 1] - ib[k + 1]), Math.abs(ia[k + 2] - ib[k + 2]))
              if (d > SEUIL_PX) n++
              if (d > max) max = d
              somme += d
            }
            const N = ia.length / 4
            console.log(`\npixels avant/après (${PA.w}×${PA.h}) : **${n} changés sur ${N}** (${(100 * n / N).toFixed(3)} %), écart max ${max}, moyen ${(somme / N).toFixed(4)} — repos avant p50 ${PA.repos.p50} / après p50 ${PB.repos.p50}`)
          }
        } catch (e) { console.log('pixels : ' + e.message) }
      }
    }
  }
}
