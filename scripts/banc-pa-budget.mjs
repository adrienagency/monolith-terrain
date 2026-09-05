// BANC PA — LE BUDGET D'UNE IMAGE, POSTE PAR POSTE, PAR SCÈNE.
//
// ══════════ CE QU'IL MESURE, ET POURQUOI COMME ÇA ═══════════════════════════
//
// Question d'Adrien : « quelles options me reste-t-il pour améliorer le
// framerate ? ». Avant de répondre il faut savoir OÙ part le temps d'image, et
// PAR QUOI on est borné (fil principal / GPU / réseau / mémoire) — et ce n'est
// pas la même réponse en orbite et dans le crop.
//
// TROIS SCÈNES : ① orbite (globe entier), ② descente (le moment où ça charge),
// ③ dans le crop (là où Adrien travaille). Deux bancs : CPU ×1 et CPU ×4
// (`Emulation.setCPUThrottlingRate`).
//
// ⚠️ **LES PIÈGES DÉJÀ PAYÉS SUR CE DÉPÔT, ET COMMENT CE BANC LES ÉVITE :**
//
//  · **Un chronomètre autour du calcul exclut le téléversement des sommets.**
//    On encadre donc `composer.render()` — pas `globe.update()` seul — et on
//    pose EN PLUS une requête temporelle GPU (`EXT_disjoint_timer_query_webgl2`)
//    autour du même appel : le CPU rend la main au pilote, le GPU dit quand il
//    a fini.
//  · **60 images/s ne dit pas si on est à 4 ms ou à 16,4.** On lance donc
//    Chrome avec `--disable-gpu-vsync --disable-frame-rate-limit` : sans ça la
//    cadence est bornée par le compositeur et le p99 ne mesure que le vsync.
//    Le temps CPU du fil principal (`tFin - timestamp de la rAF`) est mesuré
//    séparément du temps d'image, et c'est LUI le budget.
//  · **Une sonde posée APRÈS la fonction lit un état écrasé.** Toutes les
//    sondes sont des enveloppes POSÉES SUR les fonctions elles-mêmes
//    (`globe.update`, `composer.render`, `modes.update`…), depuis la page, à
//    l'exécution. ⛔ Aucune ligne de `src/` n'est modifiée.
//  · **Un relevé sur une image ne prouve rien** (cycle de période 4 documenté) :
//    chaque scène relève au moins 120 images consécutives et rend p50/p95/p99.
//  · **`requestAnimationFrame` ne se déclenche pas dans un onglet qui ne
//    composite pas** : Chrome sans tête `--headless=new` composite ; on vérifie
//    quand même qu'on a bien reçu le nombre d'images demandé.
//  · **`getEntriesByType('resource')` plafonne à 250** : le réseau est compté
//    par le protocole CDP (`Network.loadingFinished`), jamais par l'API page.
//  · **Le voile d'accueil avale tout** : on appuie sur Échap et on vérifie que
//    le centre de la vue est bien le canvas.
//  · **La cadence au repos dessine une image sur deux en orbite** (PF4). On
//    envoie donc un `pointermove` toutes les 100 ms pendant TOUTE la mesure :
//    c'est le régime « en cours d'utilisation », celui dont Adrien parle.
//
// EMPLOI
//   node scripts/banc-pa-budget.mjs --port 8711 --throttle 1
//   node scripts/banc-pa-budget.mjs --port 8711 --throttle 4
//
// Sort : `.banc/PA/budget-x<throttle>.json`

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'PA')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8711'))
const THROTTLE = Number(opt('--throttle', '1'))
const IMAGES = Number(opt('--images', '150'))
const URL_SUFFIXE = opt('--url', '')
const SCENES = ['orbite', 'orbite-geste', 'descente', 'crop', 'crop-geste']
const PROFIL = opt('--profil', '1') !== '0'
const SANS_VSYNC = opt('--novsync', '1') !== '0'
const ETIQ = opt('--etiquette', `x${opt('--throttle','1')}${opt('--novsync','1')!=='0'?'':'-vsync'}`)

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}

async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) {
    if (!fs.existsSync(p)) continue
    return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

// ── L'INSTRUMENT, tel qu'il est posé DANS la page ────────────────────────────
// Une seule fonction, sérialisée telle quelle : elle enveloppe les fonctions du
// produit et ouvre `window.__pa`.
function instrument() {
  const e = window.__exp
  const P = {
    frames: [],        // une entrée par image
    postes: null,      // accumulateur de l'image en cours
    longtasks: [],
    on: false,
    etiquette: '',
    gpu: { ext: null, files: [], dispo: false, disjoint: 0 },
  }
  window.__pa = P

  const POSTES = []
  const N0 = () => ({})

  // enveloppe générique : ajoute le temps passé dans `obj[nom]` au poste `poste`
  const enrobe = (obj, nom, poste) => {
    if (!obj || typeof obj[nom] !== 'function' || obj['__pa_' + nom]) return false
    const brut = obj[nom].bind(obj)
    obj['__pa_' + nom] = brut
    obj[nom] = function (...a) {
      if (!P.on || !P.postes) return brut(...a)
      const t0 = performance.now()
      try { return brut(...a) } finally { P.postes[poste] = (P.postes[poste] || 0) + (performance.now() - t0) }
    }
    POSTES.push(poste)
    return true
  }

  const pose = {}
  pose.globe = enrobe(e.globe, 'update', 'globe.update')       // quadtree + streaming + maillage
  pose.modes = enrobe(e.modes, 'update', 'modes.update')
  pose.controls = enrobe(e.controls, 'update', 'controls.update')
  pose.clouds = enrobe(e.clouds, 'update', 'clouds.update')
  pose.eau = enrobe(e.realWater, 'update', 'realWater.update')
  pose.peaks = enrobe(e.peaksLayer, 'update', 'peaksLayer.update')
  pose.boats = enrobe(e.boats, 'update', 'boats.update')
  pose.raceLabels = enrobe(e.raceLabels, 'update', 'raceLabels.update')
  pose.mer = enrobe(e.globe, 'animerMer', 'globe.animerMer')
  pose.hud = enrobe(e.terrain, 'tickSurfaceFx', 'terrain.tickSurfaceFx')
  pose.aq = enrobe(e.aq, 'update', 'aq.update')
  pose.places = enrobe(e.mapLayers?.places, 'refresh', 'places.refresh')
  // ⚠️ **`veilleCrop.maj` ENFERME `contexteCrop`**, qui est le gros poste JS
  // nommé du profil. On ne peut pas envelopper `contexteCrop` lui-même : la
  // veille en a capturé la référence à sa construction, donc réécrire
  // `__exp.contexteCrop` n'atteindrait personne. On mesure la porte.
  pose.veilleCrop = enrobe(e.veilleCrop, 'maj', 'veilleCrop.maj')
  pose.veilleSocle = enrobe(e.veilleSocle, 'maj', 'veilleSocle.maj')

  // ⚠️ **`renderer.info` SE REMET À ZÉRO À CHAQUE `render()`.** Lu après
  // `composer.render`, il ne rend que la DERNIÈRE passe de post-traitement :
  // un quad plein écran, soit « 1 appel, 1 triangle ». Le premier tour de ce
  // banc a écrit exactement ça. On coupe donc la remise à zéro automatique et
  // on la fait soi-même, une fois par image, après lecture.
  e.renderer.info.autoReset = false

  // ── LA REQUÊTE TEMPORELLE GPU ───────────────────────────────────────────
  const gl = e.renderer.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  P.gpu.dispo = !!ext
  P.gpu.raison = ext ? '' : 'EXT_disjoint_timer_query_webgl2 absent de ce contexte'
  let enCours = null

  // ── L'ENVELOPPE DU RENDU — jusqu'au render(), pas jusqu'au return ───────
  const brutRender = e.composer.render.bind(e.composer)
  e.composer.render = function (...a) {
    if (!P.on || !P.postes) return brutRender(...a)
    let q = null
    if (ext && !enCours) {
      try { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); enCours = q } catch { q = null }
    }
    const t0 = performance.now()
    try { return brutRender(...a) } finally {
      P.postes['composer.render'] = (P.postes['composer.render'] || 0) + (performance.now() - t0)
      if (q) { try { gl.endQuery(ext.TIME_ELAPSED_EXT); P.gpu.files.push({ q, image: P.frames.length }) } catch {} ; enCours = null }
    }
  }
  POSTES.push('composer.render')

  // récolte des requêtes GPU prêtes (elles reviennent une à quelques images plus tard)
  const recolteGpu = () => {
    if (!ext) return
    const reste = []
    for (const f of P.gpu.files) {
      let pret = false
      try { pret = gl.getQueryParameter(f.q, gl.QUERY_RESULT_AVAILABLE) } catch { pret = true }
      const dj = gl.getParameter(ext.GPU_DISJOINT_EXT)
      if (dj) { P.gpu.disjoint++; try { gl.deleteQuery(f.q) } catch {} ; continue }
      if (!pret) { reste.push(f); continue }
      let ns = 0
      try { ns = gl.getQueryParameter(f.q, gl.QUERY_RESULT) } catch {}
      try { gl.deleteQuery(f.q) } catch {}
      const img = P.frames[f.image]
      if (img) img.gpuMs = ns / 1e6
      else P.gpuOrphelins = (P.gpuOrphelins || 0) + 1
    }
    P.gpu.files = reste
  }

  // ── LES TÂCHES LONGUES ───────────────────────────────────────────────────
  try {
    new PerformanceObserver((l) => {
      for (const t of l.getEntries()) {
        if (!P.on) continue
        P.longtasks.push({ etiquette: P.etiquette, debut: Math.round(t.startTime), ms: +t.duration.toFixed(1), nom: t.name, attr: (t.attribution || []).map((x) => x.name + ':' + x.containerType).join(',') })
      }
    }).observe({ entryTypes: ['longtask'] })
  } catch (err) { P.longtaskErr = String(err) }

  // ── LA BOUCLE DE RELEVÉ ──────────────────────────────────────────────────
  // Elle s'enregistre APRÈS `tick` (tick se réarme en première ligne de
  // lui-même), donc son callback court une fois `tick()` terminé pour CETTE
  // image. `ts` est l'horodatage de début de la salve de rAF : `fin - ts` est
  // donc le temps CPU du fil principal consommé par l'image.
  let prevTs = null
  const boucle = (ts) => {
    requestAnimationFrame(boucle)
    const fin = performance.now()
    if (!P.on) { prevTs = ts; P.postes = N0(); return }
    const info = e.renderer.info
    P.frames.push({
      etiquette: P.etiquette,
      ts: +ts.toFixed(2),
      periodeMs: prevTs == null ? null : +(ts - prevTs).toFixed(2),
      cpuMs: +(fin - ts).toFixed(2),
      postes: P.postes || {},
      calls: info.render.calls,
      tris: info.render.triangles,
      geo: info.memory.geometries,
      tex: info.memory.textures,
      prog: info.programs?.length ?? null,
      mode: e.modes?.mode,
      alt: Math.round(e.altitudeCadrageM?.() ?? -1),
      altM: Math.round(e.modes?.altM ?? -1),
      crop: !!e.veilleCrop?.pose,
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      gpuMs: null,
    })
    prevTs = ts
    P.postes = N0()
    e.renderer.info.reset()
    // une récolte sur huit : `getQueryParameter` pesait 2,6 % du profil quand
    // elle tournait à chaque image — l'instrument ne doit pas être le sujet.
    if (P.frames.length % 8 === 0) recolteGpu()
  }
  requestAnimationFrame(boucle)

  P.demarre = (etiquette) => { P.etiquette = etiquette; P.postes = N0(); P.on = true; return P.frames.length }
  P.arrete = () => { P.on = false; return P.frames.length }
  P.postesConnus = POSTES
  P.pose = pose
  return { pose, gpu: P.gpu.dispo, raison: P.gpu.raison }
}

// ── STATISTIQUES ─────────────────────────────────────────────────────────────
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))].toFixed(2) }
const moy = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null)

function resume(frames, etiquette) {
  const f = frames.filter((x) => x.etiquette === etiquette)
  if (!f.length) return { etiquette, images: 0 }
  const per = f.map((x) => x.periodeMs).filter((x) => x != null)
  const cpu = f.map((x) => x.cpuMs)
  const gpu = f.map((x) => x.gpuMs).filter((x) => x != null)
  const postes = {}
  for (const x of f) for (const [k, v] of Object.entries(x.postes)) (postes[k] ||= []).push(v)
  const tableau = Object.entries(postes)
    .map(([k, v]) => ({ poste: k, p50: q(v, 0.5), p99: q(v, 0.99), moy: moy(v), images: v.length }))
    .sort((a, b) => b.moy - a.moy)
  const sommePostes = moy(f.map((x) => Object.values(x.postes).reduce((s, v) => s + v, 0)))
  return {
    etiquette,
    images: f.length,
    periodeMs: { p50: q(per, 0.5), p95: q(per, 0.95), p99: q(per, 0.99), max: q(per, 1), moy: moy(per) },
    fps: per.length ? +(1000 / moy(per)).toFixed(1) : null,
    cpuMs: { p50: q(cpu, 0.5), p95: q(cpu, 0.95), p99: q(cpu, 0.99), max: q(cpu, 1), moy: moy(cpu) },
    gpuMs: gpu.length ? { p50: q(gpu, 0.5), p95: q(gpu, 0.95), p99: q(gpu, 0.99), max: q(gpu, 1), moy: moy(gpu), images: gpu.length } : null,
    postes: tableau,
    sommePostesMoy: sommePostes,
    resteMoy: sommePostes == null ? null : +(moy(cpu) - sommePostes).toFixed(2),
    // ⚠️ **LA PREMIÈRE IMAGE DE LA SCÈNE EST JETÉE POUR LES COMPTEURS**, et
    // seulement pour eux : `renderer.info` accumule pendant que le relevé est
    // arrêté (on ne le remet à zéro que dans les images relevées), donc elle
    // porte le cumul de l'entre-deux — 22 millions de triangles là où l'image
    // en dessine 207 000.
    calls: { p50: q(f.slice(1).map((x) => x.calls), 0.5), max: q(f.slice(1).map((x) => x.calls), 1) },
    tris: { p50: q(f.slice(1).map((x) => x.tris), 0.5), max: q(f.slice(1).map((x) => x.tris), 1) },
    memoire: { geometries: f.at(-1).geo, textures: f.at(-1).tex, programmes: f.at(-1).prog, heapMo: f.at(-1).heap, heapMoDebut: f[0].heap },
    alt: { debut: f[0].alt, fin: f.at(-1).alt, altM: f.at(-1).altM },
    mode: f.at(-1).mode,
    crop: f.at(-1).crop,
  }
}

// ── LE BANC ──────────────────────────────────────────────────────────────────
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader',
    // ⚠️ SANS CES DEUX-LÀ, LE p99 NE MESURE QUE LE VSYNC — mais AVEC elles la
    // page tourne à 300-600 i/s et le tampon de commandes du pilote sature :
    // le fil principal se met alors à bloquer DANS un appel GL quelconque
    // (`drawElements`, `frontFace`, `disable`…). Les deux régimes se relèvent,
    // et c'est la comparaison des deux qui dit si un à-coup est réel.
    ...(SANS_VSYNC ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
    '--window-size=1600,1000', '--autoplay-policy=no-user-gesture-required'],
})

const sortie = { commit: null, throttle: THROTTLE, sansVsync: SANS_VSYNC, etiquetteBanc: ETIQ, port: PORT, url: URL_SUFFIXE, date: new Date().toISOString(), scenes: {}, reseau: {}, longtasks: [], profils: {} }

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  await cdp.send('Performance.enable').catch(() => {})

  // ⚠️ LE RÉSEAU PAR LE PROTOCOLE, PAS PAR `getEntriesByType('resource')`.
  const reqs = new Map()
  let etiquetteCourante = 'boot'
  const reseau = {}
  const compte = (et) => (reseau[et] ||= { requetes: 0, octets: 0, parType: {} })
  cdp.on('Network.requestWillBeSent', (p) => reqs.set(p.requestId, { url: p.request.url, et: etiquetteCourante, t: p.timestamp }))
  cdp.on('Network.loadingFinished', (p) => {
    const r = reqs.get(p.requestId); if (!r) return
    const c = compte(r.et); c.requetes++; c.octets += p.encodedDataLength || 0
    const m = /\.(png|webp|jpg|json|js|css|bin|terrain)/i.exec(r.url)
    const k = m ? m[1].toLowerCase() : 'autre'
    c.parType[k] = (c.parType[k] || 0) + 1
    reqs.delete(p.requestId)
  })

  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 200)))

  await page.goto(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })

  sortie.gpuPilote = await page.evaluate(() => {
    try {
      const gl = window.__exp.renderer.getContext()
      const d = gl.getExtension('WEBGL_debug_renderer_info')
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    } catch (e) { return 'erreur: ' + e.message }
  })
  console.log('pilote WebGL :', sortie.gpuPilote)

  // le premier dessin, la première pose : on ATTEND, on ne suppose pas
  await new Promise((r) => setTimeout(r, 9000))
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 3000))
  sortie.centreVue = await page.evaluate(() => { const el = document.elementFromPoint(800, 500); return el ? el.tagName + '.' + (el.className || '') : 'rien' })
  console.log('centre de la vue :', sortie.centreVue)

  sortie.instrument = await page.evaluate(instrument)
  console.log('sondes posées :', JSON.stringify(sortie.instrument))

  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

  // le pointeur bouge en continu : sans ça la cadence au repos (PF4) dessine
  // une image sur deux en orbite, et on mesurerait un régime que personne n'a
  // sous les yeux quand il travaille.
  let bougeur = null
  const bouge = () => {
    let x = 700
    bougeur = setInterval(() => { x = x === 700 ? 900 : 700; cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: 500, button: 'none' }).catch(() => {}) }, 100)
  }
  bouge()

  const attends = (ms) => new Promise((r) => setTimeout(r, ms))

  // ══════ LE GESTE — ET POURQUOI IL EST UNE SCÈNE À PART ═════════════════════
  // ⚠️ Un pointeur qui glisse sans bouton **n'est pas un geste** pour la veille
  // du repos : celle-ci regarde la variation d'ÉCHELLE. Une carte laissée
  // tranquille passe en « crop seul » (le quadtree cesse de parcourir les
  // alentours) et se mesure donc bien moins cher que la carte qu'Adrien
  // MANIPULE. Les deux régimes sont relevés séparément, jamais confondus.
  let dragTimer = null
  async function demarreDrag() {
    let a = 0
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'left', clickCount: 1, buttons: 1 })
    dragTimer = setInterval(() => {
      a += 0.12
      const x = Math.round(800 + 180 * Math.cos(a))
      const y = Math.round(500 + 110 * Math.sin(a))
      cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }).catch(() => {})
    }, 16)
  }
  async function arreteDrag() {
    if (dragTimer) clearInterval(dragTimer)
    dragTimer = null
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 800, y: 500, button: 'left', clickCount: 1, buttons: 0 }).catch(() => {})
  }

  async function scene(etiquette, avant, ms, profiler = PROFIL) {
    etiquetteCourante = etiquette
    if (avant) await avant()
    await page.evaluate((et) => window.__pa.demarre(et), etiquette)
    if (profiler) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start') }
    await attends(ms)
    let prof = null
    if (profiler) { prof = (await cdp.send('Profiler.stop')).profile; await cdp.send('Profiler.disable') }
    await page.evaluate(() => window.__pa.arrete())
    if (prof) sortie.profils[etiquette] = agregeProfil(prof)
    console.log(`  ${etiquette} : relevé`)
  }

  // ── ① ORBITE ────────────────────────────────────────────────────────────
  // ⚠️ **LA POSE DE DÉMARRAGE N'EST PAS L'ORBITE.** Le premier tour de ce banc
  // a étiqueté « orbite » une vue de surface à 4 416 m, crop posé : la mesure
  // était juste, le nom était faux. On monte donc EXPLICITEMENT en orbite
  // (12 000 km : la planète entière dans le cadre) et on VÉRIFIE le mode.
  await scene('orbite', async () => {
    await page.evaluate(async () => { const e = window.__exp; if (e.modes.mode !== 'orbital') await e.modes.enterOrbit(12e6) })
    await attends(6000)
    sortie.modeOrbite = await page.evaluate(() => window.__exp.modes.mode)
    if (sortie.modeOrbite !== 'orbital') console.log('⚠️ la scène ① n\'est PAS orbitale :', sortie.modeOrbite)
  }, 8000)

  // ── ② DESCENTE ──────────────────────────────────────────────────────────
  // Chamonix, z12 : du relief, de la neige, des toponymes — un cas réel.
  // ⚠️ Le vol part JUSTE AVANT le relevé : la descente EST la scène, c'est le
  // moment où le quadtree réclame, décode et maille.
  await scene('descente', async () => {
    await page.evaluate(() => window.__exp.modes.flyTo(45.92, 6.87, 12))
    await attends(200)
  }, 14000)

  // ── ③ DANS LE CROP ──────────────────────────────────────────────────────
  // On laisse le chargement finir : ce qu'on mesure ici est le régime de
  // TRAVAIL, pas la queue de la descente.
  await scene('crop', async () => { await attends(14000) }, 8000)

  // ── ③ bis — LE CROP QU'ON MANIPULE ──────────────────────────────────────
  await scene('crop-geste', async () => { await demarreDrag(); await attends(1500) }, 8000)
  await arreteDrag()

  // ── ① bis — L'ORBITE QU'ON FAIT TOURNER ─────────────────────────────────
  await scene('orbite-geste', async () => {
    await page.evaluate(async () => { const e = window.__exp; if (e.modes.mode !== 'orbital') await e.modes.enterOrbit(12e6) })
    await attends(5000)
    await demarreDrag()
    await attends(1500)
  }, 8000)
  await arreteDrag()

  clearInterval(bougeur)

  sortie.commit = null
  sortie.reseau = reseau
  sortie.erreurs = erreurs
  const dump = await page.evaluate(() => ({ frames: window.__pa.frames, longtasks: window.__pa.longtasks, gpu: { dispo: window.__pa.gpu.dispo, raison: window.__pa.gpu.raison, disjoint: window.__pa.gpu.disjoint }, longtaskErr: window.__pa.longtaskErr ?? null }))
  sortie.gpuQuery = dump.gpu
  sortie.longtaskErr = dump.longtaskErr
  for (const et of SCENES) sortie.scenes[et] = resume(dump.frames, et)
  // la plus longue tâche unique, par scène
  sortie.longtasks = dump.longtasks
  sortie.plusLongue = {}
  for (const et of SCENES) {
    const l = dump.longtasks.filter((x) => x.etiquette === et).sort((a, b) => b.ms - a.ms)
    sortie.plusLongue[et] = { n: l.length, top: l.slice(0, 5) }
  }
  sortie.framesBrutes = dump.frames.length
  fs.writeFileSync(path.join(ICI, `budget-${ETIQ}.json`), JSON.stringify(sortie, null, 1))
  fs.writeFileSync(path.join(ICI, `frames-${ETIQ}.json`), JSON.stringify(dump.frames))
  console.log('écrit :', path.join(ICI, `budget-${ETIQ}.json`))
  for (const et of SCENES) {
    const s = sortie.scenes[et]
    console.log(`\n── ${et} (${s.images} images, ${s.mode}, alt ${s.alt?.debut}→${s.alt?.fin} m, crop=${s.crop})`)
    console.log(`   période p50 ${s.periodeMs?.p50} ms  p99 ${s.periodeMs?.p99} ms  (${s.fps} i/s)`)
    console.log(`   CPU fil principal p50 ${s.cpuMs?.p50} ms  p99 ${s.cpuMs?.p99} ms`)
    console.log(`   GPU ${s.gpuMs ? `p50 ${s.gpuMs.p50} ms p99 ${s.gpuMs.p99} ms` : 'indisponible'}`)
    console.log(`   appels ${s.calls?.p50}  triangles ${s.tris?.p50}`)
    for (const p of s.postes.slice(0, 8)) console.log(`     ${p.poste.padEnd(24)} moy ${String(p.moy).padStart(7)} ms  p99 ${p.p99}`)
    console.log(`     ${'(reste de tick)'.padEnd(24)} moy ${s.resteMoy} ms`)
  }
} finally {
  await nav.close()
}

// ── AGRÉGATION DU PROFIL CPU ────────────────────────────────────────────────
// Temps propre (self time) par fonction, nommé au fichier et à la ligne.
function agregeProfil(prof) {
  const parId = new Map()
  for (const n of prof.nodes) parId.set(n.id, n)
  const self = new Map()
  const total = prof.samples?.length ? prof.timeDeltas.reduce((s, x) => s + Math.max(0, x), 0) : 0
  for (let i = 0; i < (prof.samples?.length ?? 0); i++) {
    const dt = Math.max(0, prof.timeDeltas[i] || 0)
    const n = parId.get(prof.samples[i]); if (!n) continue
    const cf = n.callFrame
    const cle = `${cf.functionName || '(anonyme)'} — ${String(cf.url).replace(/^https?:\/\/[^/]+/, '')}:${cf.lineNumber + 1}`
    self.set(cle, (self.get(cle) || 0) + dt)
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([k, v]) => ({ fonction: k, ms: +(v / 1000).toFixed(1), pct: +((100 * v) / (total || 1)).toFixed(1) }))
  // par fichier
  const parFichier = new Map()
  for (const [k, v] of self) { const f = k.split(' — ')[1]?.replace(/:\d+$/, '') || '?'; parFichier.set(f, (parFichier.get(f) || 0) + v) }
  const fichiers = [...parFichier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([k, v]) => ({ fichier: k, ms: +(v / 1000).toFixed(1), pct: +((100 * v) / (total || 1)).toFixed(1) }))
  return { totalMs: +(total / 1000).toFixed(1), top, fichiers }
}
