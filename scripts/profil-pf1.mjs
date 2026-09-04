// PROFIL PF1 — le banc commun de la campagne PERFORMANCE (PF1 → PF4).
//
// Ce qu'il rend, en UNE commande : le budget d'une image DÉCOMPOSÉ, à trois
// postes de vue (orbite 2 000 km · surface hors crop 130 km · crop 5 km) sur
// trois machines émulées (la tienne · CPU ×4 · CPU ×6 + pixelRatio 2), avec
// p50 / p99 du temps d'image, la part CPU de chaque consommateur, le GPU par
// passe du compositeur, les appels de dessin, le réseau au protocole, le tas
// JS et la mémoire GPU — et le coût du « rien », avec et sans l'animation
// ambiante (dont la rotation propre du globe).
//
// ⚠️ **CE QUI MENT, ET CE QU'ON FAIT CONTRE** (socle-perf.md, § « comment
// peser ») :
//   · `gl.finish()` mesure la soumission CPU, pas les fragments → le GPU est
//     chronométré par `EXT_disjoint_timer_query_webgl2`, une requête par passe,
//     AVEC un témoin de validité : ×4 rendus dans une requête doivent rendre
//     ≈ ×4 de temps. Une cellule dont le témoin rend < ×2,5 est marquée
//     `temoinInvalide` — ses colonnes GPU ne se lisent pas.
//   · `requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
//     composite pas → Chrome sans tête, `--disable-frame-rate-limit` et
//     `--disable-gpu-vsync` (sinon toutes les cellules rendent 16,7 ms).
//   · 40 images de chauffe jetées après chaque changement de pose ou de
//     variante ; p50 et p99 sur ≥ 60 images CONSÉCUTIVES.
//   · Le palier machine réimpose `setTier` sous charge → il est FIXÉ à 0
//     (`aq.setTier(0, true)` puis `aq.update` neutralisé) et relevé avant.
//   · Le ralentissement CPU est MESURÉ (une boucle JS calibrée avant/après
//     `Emulation.setCPUThrottlingRate`), pas supposé.
//   · Le réseau est compté au protocole (CDP `Network.*`), jamais par
//     `getEntriesByType('resource')` qui plafonne à 250.
//   · Les sous-minuteries sont EXCLUSIVES (une pile) : le temps d'un appel
//     imbriqué n'est pas compté deux fois, et « reste » = tick − Σ exclusifs.
//   · Le décodage des tuiles (`getImageData`, `_buildMesh`) court HORS du tick,
//     en microtâche : il est compté à part (`horsTick.*`), sinon il disparaît.
//
// EMPLOI
//   npm run dev -- --port 6210 --strictPort
//   node scripts/profil-pf1.mjs --port 6210
//   node scripts/profil-pf1.mjs --machines mienne --postes crop --images 60
//   node scripts/profil-pf1.mjs --swiftshader          # + un profil « GPU logiciel »
//   node scripts/profil-pf1.mjs --cpuprofile           # + le profil V8 par poste (qui fait « reste »)
//   node scripts/profil-pf1.mjs --sortie .banc/pf1.json
//
// Sortie : un JSON complet (+ un tableau Markdown sur la sortie standard).
// Par défaut sous `.superpowers/sdd/2026-08-22-globe-studio/traces-PF1/`.
//
// Dépendance : puppeteer-core, NON déclarée (outil de diagnostic). Le script
// le cherche dans node_modules puis dans les arbres voisins (`C:/Dev/wt-*`).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const flag = (n) => A.includes(n)
const PORT = Number(opt('--port', '6210'))
const IMAGES = Number(opt('--images', '60'))
const CHAUFFE = Number(opt('--chauffe', '40'))
const MACHINES = opt('--machines', 'mienne,x4,x6r').split(',').filter(Boolean)
const POSTES = opt('--postes', 'surface,crop,orbite').split(',').filter(Boolean)
const TAS_S = Number(opt('--tas', '20'))
// PF4 : un suffixe d'URL (`--url "?tuiles=amont&matrices=amont&crop=amont"`) pour mesurer
// l'avant/après d'un correctif dans un seul build, mêmes cellules
const URL_SUFFIXE = opt('--url', '')
const SWIFT = flag('--swiftshader')
const CPUPROFILE = flag('--cpuprofile') // échantillonnage V8 (CDP Profiler) par poste : qui fait « reste »
const LIEU = { lat: -21.115, lon: 55.536 } // La Réunion : mer + relief, le crop z13 de R31
const QUAND = new Date()
const SORTIE = opt('--sortie', path.join(RACINE, '.superpowers/sdd/2026-08-22-globe-studio/traces-PF1',
  `profil-${QUAND.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------ machines
// Chaque machine émulée : ralentissement CPU (CDP), densité de pixels, moteur.
const CATALOGUE_MACHINES = {
  mienne: { cpu: 1, dsf: 1, angle: 'd3d11' },
  x4: { cpu: 4, dsf: 1, angle: 'd3d11' },
  x6r: { cpu: 6, dsf: 2, angle: 'd3d11' },
  swiftshader: { cpu: 1, dsf: 1, angle: 'swiftshader' },
}
if (SWIFT && !MACHINES.includes('swiftshader')) MACHINES.push('swiftshader')

// Les postes de vue. `alt` est l'altitude de cadrage visée (m) ; la cellule est
// refusée si l'altitude obtenue s'écarte de plus de 5 % (le nombre de tuiles ne
// serait pas le même — brief PF1).
const CATALOGUE_POSTES = {
  surface: { alt: 130000, zoom: 9 },
  crop: { alt: 5000, zoom: 13 },
  orbite: { alt: 2000000, orbite: true },
  // ⚡ **LE POSTE DE D21 ③ — LE CROP À SA NOUVELLE NAISSANCE.** `DIVE_TIERS`
  // pose le palier z7 à 600 km ; depuis D21 le crop y naît. C'est le poste que
  // le brief C1 demande de chiffrer (tuiles, maillage, temps d'image à ×4/×6),
  // et il n'existait pas : `surface` s'arrêtait à 130 km, sans crop.
  crop7: { alt: 600000, zoom: 7 },
  // le témoin : le MÊME cadrage, un cran plus haut, où le crop ne naît pas
  // encore (620 km > 600 km). L'écart des deux cellules EST le coût de D21 ③.
  temoinz7: { alt: 700000, zoom: 7 },
}

// -------------------------------------------------------------------- Chrome
function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  try { return (await import('puppeteer-core')).default } catch {}
  const voisins = fs.existsSync('C:/Dev') ? fs.readdirSync('C:/Dev').map((d) => `C:/Dev/${d}/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js`) : []
  const c = [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), ...voisins].find((x) => fs.existsSync(x))
  if (!c) { console.error('puppeteer-core absent : npm i --no-save puppeteer-core'); process.exit(2) }
  return (await import('file:///' + c.replace(/\\/g, '/'))).default
}

// ------------------------------------------------------------ sondes (page)
// Tout ce qui suit s'exécute DANS la page. Aucune ligne de src/ n'est touchée :
// on enveloppe ce que `window.__exp` expose, et les prototypes du globe.
function poserSondes() {
  if (window.__pf1) return 'déjà posé'
  const e = window.__exp
  const R = e.renderer
  const gl = R.getContext()
  const THREE = { Vector3: e.camera.position.constructor }
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const now = () => performance.now()
  const S = {
    actif: false, modeGpu: 'total', frames: [], pending: [], cur: null,
    pile: [], longtasks: [], enveloppes: [], compteurs: {}, glErreurs: 0,
  }

  // -- minuterie exclusive : une pile, le temps des enfants est retiré du parent
  const timeCat = (cat, fn, ctx, args) => {
    if (!S.actif || !S.cur) return fn.apply(ctx, args)
    const cadre = { cat, enfants: 0 }
    S.pile.push(cadre)
    const t0 = now()
    try { return fn.apply(ctx, args) } finally {
      const total = now() - t0
      S.pile.pop()
      const parent = S.pile[S.pile.length - 1]
      if (parent) parent.enfants += total
      const c = S.cur.cpu
      if (cat === 'tick') {
        // le tick est relevé EN TOTAL (c'est le JS de l'image) ; son exclusif
        // devient « reste » : ce que les sous-minuteries ne nomment pas.
        c.tick = (c.tick || 0) + total
        c.reste = (c.reste || 0) + (total - cadre.enfants)
      } else c[cat] = (c[cat] || 0) + (total - cadre.enfants)
      S.cur.n[cat] = (S.cur.n[cat] || 0) + 1
    }
  }
  const wrap = (obj, meth, cat) => {
    const o = obj?.[meth]
    if (typeof o !== 'function') return false
    obj[meth] = function (...a) { return timeCat(cat, o, this, a) }
    S.enveloppes.push(cat)
    return true
  }

  // -- la boucle : chaque rappel rAF est enveloppé ; une image = un horodatage
  const vraiRaf = window.requestAnimationFrame.bind(window)
  const finImage = () => {
    const f = S.cur
    if (!f) return
    f.info = { appels: R.info.render.calls, triangles: R.info.render.triangles, points: R.info.render.points, lignes: R.info.render.lines }
    S.frames.push(f)
    S.cur = null
  }
  window.requestAnimationFrame = (cb) => vraiRaf((t) => {
    const apres = () => { if (S.apresTick && S.dernierApres !== t) { S.dernierApres = t; S.apresTick() } }
    if (S.mouvement && S.actif && S.dernierPas !== t) { S.dernierPas = t; S.mouvement() }
    if (!S.actif) { if (S.cur) finImage(); try { return cb(t) } finally { apres() } }
    if (!S.cur || S.cur.t !== t) {
      finImage()
      S.cur = { t, cpu: {}, n: {}, gpu: {}, tas: performance.memory ? performance.memory.usedJSHeapSize : null }
      R.info.reset()
    }
    // les requêtes GPU des images précédentes : on relève ce qui est prêt
    for (let i = S.pending.length - 1; i >= 0; i--) {
      const p = S.pending[i]
      if (gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) {
        const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT)
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
        gl.deleteQuery(p.q)
        S.pending.splice(i, 1)
        if (!disjoint) p.frame.gpu[p.cle] = (p.frame.gpu[p.cle] || 0) + ns / 1e6
        else p.frame.gpuDisjoint = true
      }
    }
    try { return timeCat('tick', cb, null, [t]) } finally { apres() }
  })
  R.info.autoReset = false

  // -- GPU : une requête autour de composer.render (mode total), ou une par passe
  const mesurerGpu = (cle, fn) => {
    if (!ext || !S.actif || !S.cur) return fn()
    const q = gl.createQuery()
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
    try { return fn() } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); S.pending.push({ q, frame: S.cur, cle }) }
  }
  const compRender = e.composer.render.bind(e.composer)
  e.composer.render = (dt) => timeCat('composer.render', () => {
    if (S.modeGpu === 'total') return mesurerGpu('total', () => compRender(dt))
    return compRender(dt)
  }, null, [])
  const nomPasse = (p, i) => {
    const base = p.constructor?.name || 'Pass'
    const effets = Array.isArray(p.effects) ? p.effects.map((x) => x.constructor?.name?.replace(/Effect$/, '')).join('+') : ''
    return `${i}:${base}${effets ? '[' + effets + ']' : ''}${p.enabled === false ? '(off)' : ''}`
  }
  const envelopperPasses = () => {
    e.composer.passes.forEach((p, i) => {
      if (p.__pf1) return
      p.__pf1 = true
      const o = p.render
      p.render = function (...a) {
        if (S.modeGpu !== 'passes' || !S.actif || !S.cur) return o.apply(this, a)
        const cle = nomPasse(this, e.composer.passes.indexOf(this))
        return timeCat('passe.' + cle, () => mesurerGpu(cle, () => o.apply(this, a)), null, [])
      }
    })
  }

  // -- sous-minuteries CPU du tick (tout passe par __exp, rien dans src/)
  const G = Object.getPrototypeOf(e.globe)
  let prof = 0
  const oTrav = G._traverse
  G._traverse = function (...a) {
    if (prof++ > 0) { try { return oTrav.apply(this, a) } finally { prof-- } }
    try { return timeCat('globe._traverse', oTrav, this, a) } finally { prof-- }
  }
  wrap(G, '_request', 'globe._request')
  wrap(G, '_purgerFile', 'globe._purgerFile')
  wrap(G, '_pump', 'globe._pump')
  wrap(G, '_evict', 'globe._evict')
  wrap(G, '_preparerTriSpatial', 'globe._triSpatial')
  wrap(G, '_majRampeMonde', 'globe._majRampeMonde')
  wrap(G, '_buildMesh', 'horsTick.tuile.maillage')
  wrap(G, 'update', 'globe.update')
  wrap(G, 'animerMer', 'globe.animerMer')
  wrap(G, 'majReglagesMer', 'globe.majReglagesMer')
  if (e.globe.clouds) wrap(Object.getPrototypeOf(e.globe.clouds), 'update', 'globe.nuages')
  wrap(CanvasRenderingContext2D.prototype, 'getImageData', 'horsTick.tuile.decode')
  const oBitmap = window.createImageBitmap
  window.createImageBitmap = function (...a) { S.compteurs.createImageBitmap = (S.compteurs.createImageBitmap || 0) + 1; return oBitmap.apply(this, a) }
  wrap(e.modes, 'update', 'modes.update')
  wrap(e.controls, 'update', 'controls.update')
  wrap(e.clouds, 'update', 'nuages.update')
  wrap(e.peaksLayer, 'update', 'sommets.update')
  wrap(e.boats, 'update', 'bateaux.update')
  if (e.realWater) wrap(e.realWater, 'update', 'eau.update')
  wrap(e.traffic, 'update', 'trafic.update')
  wrap(e.raceLabels, 'update', 'etiquettesCourse.update')
  wrap(e.aq, 'update', 'aq.update')
  wrap(e, 'majCameraFond', 'majCameraFond')
  if (e.mapLayers?.places) wrap(e.mapLayers.places, 'refresh', 'lieux.refresh')
  wrap(e.terrain, 'tickSurfaceFx', 'terrain.tickFx')
  wrap(e.terrain, 'tickLiquidMetal', 'terrain.tickLiquidMetal')
  wrap(e.terrain, 'tickSurfaceMaterial', 'terrain.tickMateriau')
  wrap(e.gpxLayer, 'tick', 'gpx.tick')
  if (e.scan) wrap(e.scan, 'update', 'scan.update')
  wrap(e.renderer.shadowMap, 'render', 'ombres.render')
  // le coût PAR OBJET du rendu (setProgram + uniformes + draw) séparé du reste de renderer.render
  wrap(R, 'renderBufferDirect', 'rendu.objets')

  // -- tâches longues
  try {
    new PerformanceObserver((l) => { if (S.actif) for (const x of l.getEntries()) S.longtasks.push({ debut: x.startTime, duree: x.duration }) })
      .observe({ entryTypes: ['longtask'] })
  } catch {}

  // -- outils exposés au pilote
  const p = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] }
  const moy = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
  window.__pf1 = {
    S,
    ext: !!ext,
    envelopperPasses,
    passes: () => e.composer.passes.map(nomPasse),
    /** Relève `n` images consécutives (après `chauffe` images jetées) dans le mode GPU donné. */
    mesurer(n, modeGpu, chauffe, mouvement = null) {
      return new Promise((res) => {
        envelopperPasses()
        S.modeGpu = modeGpu
        // un déplacement scripté, un pas par image : en orbite le globe tourne
        // de 0,25°/image ; en surface la visée glisse de 0,3 % de la distance
        S.mouvement = mouvement === 'orbite'
          ? () => { e.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.25 * Math.PI / 180); e.camera.lookAt(0, 0, 0) }
          : mouvement === 'surface'
            ? () => { const d = e.controls.getDistance() * 0.003; e.controls.target.x += d; e.camera.position.x += d }
            : null
        S.frames = []
        S.longtasks = []
        S.compteurs = {}
        S.glErreurs = 0
        S.actif = true
        let jetees = 0
        const attendre = () => {
          if (S.frames.length && jetees < chauffe) { jetees += S.frames.length; S.frames = []; S.longtasks = [] }
          if (jetees >= chauffe && S.frames.length >= n) { S.actif = false; S.mouvement = null; return finir() }
          vraiRaf(attendre)
        }
        const finir = () => {
          let tours = 0
          const poll = () => {
            // on relève à la main les requêtes GPU encore en vol
            for (let i = S.pending.length - 1; i >= 0; i--) {
              const q = S.pending[i]
              if (gl.getQueryParameter(q.q, gl.QUERY_RESULT_AVAILABLE)) {
                const ns = gl.getQueryParameter(q.q, gl.QUERY_RESULT)
                gl.deleteQuery(q.q); S.pending.splice(i, 1)
                if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) q.frame.gpu[q.cle] = (q.frame.gpu[q.cle] || 0) + ns / 1e6
              }
            }
            if (S.pending.length && tours++ < 200) return setTimeout(poll, 10)
            for (const q of S.pending) gl.deleteQuery(q.q)
            S.pending = []
            res(resumer(S.frames.slice(0, n), S.longtasks, S.compteurs))
          }
          poll()
        }
        vraiRaf(attendre)
      })
    },
    /** Témoin de validité de la minuterie GPU : ×4 rendus ⇒ ≈ ×4 de temps. */
    async temoin() {
      if (!ext) return null
      const anim = e.params.animations
      e.params.animations = false
      const une = (K) => new Promise((res) => {
        for (let i = 0; i < 10; i++) compRender(0)
        const q = gl.createQuery()
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
        for (let i = 0; i < K; i++) compRender(0)
        gl.endQuery(ext.TIME_ELAPSED_EXT)
        let tours = 0
        const poll = () => {
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
            const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
            const dj = gl.getParameter(ext.GPU_DISJOINT_EXT)
            gl.deleteQuery(q)
            return res(dj ? null : ns / 1e6)
          }
          if (tours++ > 300) { gl.deleteQuery(q); return res(null) }
          setTimeout(poll, 5)
        }
        poll()
      })
      const x1 = await une(1), x4 = await une(4), x1b = await une(1)
      e.params.animations = anim
      const base = x1 != null && x1b != null ? (x1 + x1b) / 2 : x1 ?? x1b
      return { x1: base, x4, rapport: base && x4 ? x4 / base : null }
    },
    /**
     * Trois images CONSÉCUTIVES DE LA BOUCLE DE L'APPLICATION (pas des rendus
     * à la main, qui partagent le même dt = 0) : l'écran change-t-il ? Si non,
     * un rendu à la demande aurait sauté les suivantes.
     */
    identiquesBoucle() {
      return new Promise((res) => {
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
        const px = new Uint8Array(w * h * 4)
        const somme = () => {
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
          let s = 0
          for (let i = 0; i < px.length; i += 7) s = (s * 31 + px[i]) >>> 0
          return s
        }
        const releves = []
        S.apresTick = () => {
          releves.push(somme())
          if (releves.length >= 3) { S.apresTick = null; res({ identiques: releves[0] === releves[1] && releves[1] === releves[2], releves }) }
        }
      })
    },
    /** Deux rendus consécutifs à la main (dt = 0) : l'image est-elle déterministe ? */
    imagesIdentiques() {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const lire = () => {
        compRender(0)
        const px = new Uint8Array(w * h * 4)
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
        let s = 0
        for (let i = 0; i < px.length; i += 7) s = (s * 31 + px[i]) >>> 0
        return s
      }
      const a = lire(), b = lire()
      return { identiques: a === b, a, b }
    },
    /** Erreurs GL par passe, sur UNE image (getError synchrone après chaque passe). */
    erreursParPasse() {
      const out = []
      while (gl.getError() !== gl.NO_ERROR) {}
      const passes = e.composer.passes
      const orig = passes.map((p) => p.render)
      passes.forEach((p, i) => {
        p.render = function (...a) {
          const r = orig[i].apply(this, a)
          const codes = []
          let err
          while ((err = gl.getError()) !== gl.NO_ERROR) codes.push('0x' + err.toString(16))
          if (codes.length) out.push({ passe: nomPasse(p, i), codes })
          return r
        }
      })
      try { compRender(0) } finally { passes.forEach((p, i) => { p.render = orig[i] }) }
      return out
    },
    etat() {
      const m = e.modes
      const mem = R.info.memory
      return {
        mode: m.mode, altM: m.altM, altCadrageM: e.altitudeCadrageM?.(), busy: m.busy,
        crop: !!e.globe._crop, tuiles: e.globe.tiles.size, enVol: e.globe.tuilesEnVol?.(),
        file: e.globe.queue?.length, credit: e.globe._credit, refusFile: e.globe._refusFile,
        palier: window.__palierMachine?.palier, palierNom: window.__palierMachine?.nom,
        ecran: window.__palierMachine?.signaux?.ecran, tier: e.aq?.tier,
        pixelRatio: R.getPixelRatio(), tampon: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        programmes: R.info.programs?.length, geometries: mem.geometries, textures: mem.textures,
        uniformesTuile: (() => { for (const t of e.globe.tiles.values()) if (t.mesh?.material?.uniforms) return Object.keys(t.mesh.material.uniforms).length; return null })(),
        materiauxTuile: (() => { const s = new Set(); for (const t of e.globe.tiles.values()) if (t.mesh?.material) s.add(t.mesh.material); return s.size })(),
        tas: performance.memory?.usedJSHeapSize ?? null,
        animations: e.params.animations, dof: !!e.params.bokehEnabled, ssao: e.params.ssaoEnabled,
        ombres: e.params.shadowMode, passes: e.composer.passes.map(nomPasse),
      }
    },
    /** Boucle JS calibrée : mesure le ralentissement CPU réellement appliqué. */
    etalonCpu() {
      // le meilleur de cinq tours : le premier paie la compilation JIT
      let best = Infinity, x = 0
      for (let k = 0; k < 5; k++) {
        const t0 = performance.now()
        for (let i = 0; i < 3e6; i++) x += Math.sqrt(i) * Math.sin(i)
        best = Math.min(best, performance.now() - t0)
      }
      return { ms: best, x: x > 0 }
    },
    gelerPalier() {
      const avant = e.aq.tier
      e.aq.setTier(0, true)
      e.aq.update = () => {}
      return avant
    },
    ecranTexte: () => e.params.animations,
  }
  function resumer(frames, longtasks, compteurs) {
    const dts = []
    for (let i = 1; i < frames.length; i++) dts.push(frames[i].t - frames[i - 1].t)
    const cats = new Set()
    for (const f of frames) for (const k of Object.keys(f.cpu)) cats.add(k)
    const cpu = {}
    for (const k of cats) {
      const v = frames.map((f) => f.cpu[k] || 0)
      cpu[k] = { moy: moy(v), p50: p(v, 0.5), p99: p(v, 0.99), n: frames.reduce((s, f) => s + (f.n[k] || 0), 0) }
    }
    const gpuCles = new Set()
    for (const f of frames) for (const k of Object.keys(f.gpu)) gpuCles.add(k)
    const gpu = {}
    for (const k of gpuCles) {
      const v = frames.filter((f) => f.gpu[k] != null).map((f) => f.gpu[k])
      gpu[k] = { moy: moy(v), p50: p(v, 0.5), p99: p(v, 0.99), n: v.length }
    }
    const gpuTotal = frames.map((f) => Object.values(f.gpu).reduce((s, x) => s + x, 0)).filter((x) => x > 0)
    const tick = frames.map((f) => f.cpu.tick || 0)
    const hors = frames.map((f) => Object.entries(f.cpu).filter(([k]) => k.startsWith('horsTick.')).reduce((s, [, v]) => s + v, 0))
    const tas = frames.map((f) => f.tas).filter((x) => x != null)
    return {
      images: frames.length,
      cadence: { p50: p(dts, 0.5), p99: p(dts, 0.99), moy: moy(dts), min: p(dts, 0), max: p(dts, 1) },
      tick: { p50: p(tick, 0.5), p99: p(tick, 0.99), moy: moy(tick) },
      horsTick: { p50: p(hors, 0.5), p99: p(hors, 0.99), moy: moy(hors), total: hors.reduce((s, x) => s + x, 0) },
      gpuTotal: { p50: p(gpuTotal, 0.5), p99: p(gpuTotal, 0.99), moy: moy(gpuTotal), n: gpuTotal.length },
      disjoint: frames.filter((f) => f.gpuDisjoint).length,
      cpu, gpu,
      dessin: {
        appels: { p50: p(frames.map((f) => f.info.appels), 0.5), max: p(frames.map((f) => f.info.appels), 1) },
        triangles: { p50: p(frames.map((f) => f.info.triangles), 0.5), max: p(frames.map((f) => f.info.triangles), 1) },
      },
      tas: tas.length ? { debut: tas[0], fin: tas[tas.length - 1], min: p(tas, 0), max: p(tas, 1) } : null,
      longtasks: { n: longtasks.length, ms: longtasks.reduce((s, x) => s + x.duree, 0) },
      compteurs,
      // les trois images les plus lentes (au tick) et ce qui les a faites
      lentes: [...frames].sort((a, b) => (b.cpu.tick || 0) - (a.cpu.tick || 0)).slice(0, 3).map((f) => ({
        tick: f.cpu.tick || 0, gpu: Object.values(f.gpu).reduce((s, x) => s + x, 0) || null,
        top: Object.entries(f.cpu).filter(([k]) => k !== 'tick').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`),
      })),
    }
  }
  return `posé (${S.enveloppes.length} enveloppes, minuterie GPU ${ext ? 'oui' : 'NON'})`
}

// --------------------------------------------------------- pose de la caméra
async function poserPoste(page, poste) {
  const P = CATALOGUE_POSTES[poste]
  if (P.orbite) {
    await page.evaluate(async (alt) => {
      const m = window.__exp.modes
      if (m.mode !== 'orbital') await m.enterOrbit(alt)
      await new Promise((r) => setTimeout(r, 1500))
      for (let i = 0; i < 6; i++) {
        const parM = m.orbAlt / Math.max(m.altM, 1)
        m.orbAlt = m.orbAltTarget = alt * parM
        await new Promise((r) => setTimeout(r, 300))
        if (Math.abs(m.altM - alt) / alt < 0.005) break
      }
    }, P.alt)
  } else {
    await page.evaluate(async ({ lieu, zoom, alt }) => {
      const e = window.__exp
      const m = e.modes
      if (m.mode === 'orbital') {
        // on redescend par la porte du produit : plongée vers le lieu
        await m.diveTo?.({ lat: lieu.lat, lon: lieu.lon })
        await new Promise((r) => setTimeout(r, 3000))
      }
      await m._rescale({ lat: lieu.lat, lon: lieu.lon, zoom }, 'PF1')
      await new Promise((r) => setTimeout(r, 1500))
      // altitude exacte : on glisse la caméra le long de son axe vers la cible
      const cam = e.camera, ct = e.controls
      ct.minDistance = 1e-4; ct.maxDistance = 1e12
      const dir = cam.position.clone().sub(ct.target).normalize()
      for (let i = 0; i < 40; i++) {
        const a = e.altitudeCadrageM()
        if (!Number.isFinite(a) || a <= 0) break
        const d = cam.position.distanceTo(ct.target)
        const nd = d * (alt / a)
        if (!Number.isFinite(nd) || nd <= 0) break
        cam.position.copy(ct.target).addScaledVector(dir, nd)
        ct.update?.()
        if (Math.abs(e.altitudeCadrageM() - alt) / alt < 0.004) break
      }
    }, { lieu: LIEU, zoom: P.zoom, alt: P.alt })
  }
  // le quadtree finit de charger CE cadrage : on chronomètre une scène posée
  await page.waitForFunction(() => { const e = window.__exp; return !e.modes.busy && (!e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0) }, { polling: 250, timeout: 90000 }).catch(() => {})
  await dodo(4000)
  await page.waitForFunction(() => { const e = window.__exp; return !e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
  await dodo(1500)
}

// ---------------------------------------------------------------------- main
const puppeteer = await chargerPuppeteer()
const chrome = trouverChrome()
const rapport = {
  quand: QUAND.toISOString(), port: PORT, images: IMAGES, chauffe: CHAUFFE, lieu: LIEU,
  machines: {}, cellules: [],
}
fs.mkdirSync(path.dirname(SORTIE), { recursive: true })

for (const nomMachine of MACHINES) {
  const M = CATALOGUE_MACHINES[nomMachine]
  if (!M) { console.error(`machine inconnue : ${nomMachine}`); continue }
  console.log(`\n══════ machine « ${nomMachine} » : CPU ×${M.cpu}, densité ${M.dsf}, ANGLE ${M.angle}`)
  const nav = await puppeteer.launch({
    executablePath: chrome, headless: true,
    // SwiftShader : un readPixels 1280×720 ou un témoin ×4 peut dépasser les 180 s par défaut
    protocolTimeout: 900000,
    args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,720',
      `--use-angle=${M.angle}`, ...(M.angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist']),
      '--disable-dev-shm-usage', '--enable-precise-memory-info',
      // ⚠️ Sans ces deux lignes, Chrome plafonne à la fréquence de l'écran
      // virtuel et toutes les cellules rendent le même chiffre.
      '--disable-frame-rate-limit', '--disable-gpu-vsync'],
  })
  try {
    const page = await nav.newPage()
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: M.dsf })
    const console_ = { gl: 0, nuanceur: [], autres: 0 }
    page.on('console', (m) => {
      const t = m.text()
      if (/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|WebGL: /.test(t)) console_.gl++
      else if (/not compiled|not linked|ERROR: 0:/.test(t)) console_.nuanceur.push(t.slice(0, 200))
      else if (m.type() === 'error') console_.autres++
    })
    page.on('pageerror', (er) => console.error('  [page] ' + er.message))
    const cdp = await page.createCDPSession()
    await cdp.send('Network.enable')
    const reseau = { requetes: 0, octets: 0 }
    cdp.on('Network.requestWillBeSent', () => { reseau.requetes++ })
    cdp.on('Network.loadingFinished', (ev) => { reseau.octets += ev.encodedDataLength || 0 })
    const litReseau = () => ({ ...reseau })

    const t0 = Date.now()
    await page.goto(`http://localhost:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
    await page.waitForFunction(() => !!(window.__exp && window.__exp.globe && window.__exp.modes), { timeout: 180000, polling: 100 })
    await page.waitForFunction(() => !!document.getElementById('loading')?.classList.contains('hidden'), { timeout: 180000, polling: 200 }).catch(() => {})
    await page.evaluate(() => document.querySelector('.ce-hubclose')?.click())
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForFunction(() => !window.__exp.modes.busy, { timeout: 120000, polling: 200 }).catch(() => {})
    await dodo(3000)
    const demarrage = { ms: Date.now() - t0, reseau: litReseau() }

    const materiel = await page.evaluate(() => {
      const gl = window.__exp.renderer.getContext()
      const d = gl.getExtension('WEBGL_debug_renderer_info')
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    })
    const pose = await page.evaluate(poserSondes)
    const palierAvant = await page.evaluate(() => ({ palier: window.__palierMachine?.palier, nom: window.__palierMachine?.nom, densite: window.__palierMachine?.densite, ecran: window.__palierMachine?.signaux?.ecran, carte: window.__palierMachine?.carte, tier: window.__exp.aq.tier, pixelRatio: window.__exp.renderer.getPixelRatio() }))
    const tierAvant = await page.evaluate(() => window.__pf1.gelerPalier())
    if (M.dsf !== 1) {
      await page.evaluate((d) => { window.__exp.params.pixelRatio = d; window.dispatchEvent(new Event('resize')) }, M.dsf)
      await dodo(500)
    }
    const etalonAvant = await page.evaluate(() => window.__pf1.etalonCpu())
    if (M.cpu !== 1) await page.emulateCPUThrottling(M.cpu)
    const etalonApres = await page.evaluate(() => window.__pf1.etalonCpu())
    const facteurMesure = etalonApres.ms / etalonAvant.ms
    console.log(`  ${materiel}\n  ${pose} · palier machine ${palierAvant.palier} (${palierAvant.nom}), écran ${JSON.stringify(palierAvant.ecran)}, tier ${tierAvant} → fixé 0`
      + `\n  ralentissement demandé ×${M.cpu}, MESURÉ ×${facteurMesure.toFixed(2)} (${etalonAvant.ms.toFixed(0)} → ${etalonApres.ms.toFixed(0)} ms)`
      + `\n  démarrage ${demarrage.ms} ms, ${demarrage.reseau.requetes} requêtes, ${(demarrage.reseau.octets / 1e6).toFixed(1)} Mo`)
    rapport.machines[nomMachine] = { ...M, materiel, palierAvant, tierAvant, etalon: { avant: etalonAvant.ms, apres: etalonApres.ms, facteur: facteurMesure }, demarrage }

    for (const poste of POSTES) {
      const P = CATALOGUE_POSTES[poste]
      try {
      const r0 = litReseau()
      const tPose = Date.now()
      await poserPoste(page, poste)
      const chargement = { ms: Date.now() - tPose, requetes: litReseau().requetes - r0.requetes, octets: litReseau().octets - r0.octets }
      await page.evaluate(() => { window.__exp.params.animations = true })
      const etat = await page.evaluate(() => window.__pf1.etat())
      // en orbite c'est `modes.altM` qui fait foi ; `altitudeCadrageM()` ne parle que du bloc
      const altLue = P.orbite ? etat.altM : (etat.altCadrageM ?? etat.altM)
      const ecartAlt = Math.abs(altLue - P.alt) / P.alt
      const cell = { machine: nomMachine, poste, cible: P.alt, altLue, etat, chargement, ecartAlt, ok: ecartAlt <= 0.05 }
      console.log(`\n  ── ${poste} : mode ${etat.mode}, altitude ${Math.round(altLue)} m (cible ${P.alt}, écart ${(ecartAlt * 100).toFixed(1)} %), crop ${etat.crop}, ${etat.tuiles} tuiles, tampon ${etat.tampon.join('×')} @${etat.pixelRatio}, ${etat.programmes} programmes`
        + `\n     chargement de la pose : ${chargement.ms} ms, ${chargement.requetes} requêtes, ${(chargement.octets / 1e6).toFixed(1)} Mo`)
      if (!cell.ok) console.log('     ⛔ altitude hors des 5 % : cellule marquée non comparable')

      // témoin de validité de la minuterie GPU
      cell.temoin = await page.evaluate(() => window.__pf1.temoin())
      cell.temoinValide = !!(cell.temoin?.rapport && cell.temoin.rapport >= 2.5)
      console.log(`     témoin GPU : ×4 rendus ⇒ ×${cell.temoin?.rapport?.toFixed(2) ?? '?'} de temps ${cell.temoinValide ? '(valide)' : '⛔ NON VALIDE'}`)

      // ① état actuel (animation ambiante + rotation propre), requête GPU totale
      const rIdle0 = litReseau()
      const glAvant = console_.gl
      cell.anim = await page.evaluate((n, c) => window.__pf1.mesurer(n, 'total', c), IMAGES, CHAUFFE)
      cell.anim.reseau = { requetes: litReseau().requetes - rIdle0.requetes, octets: litReseau().octets - rIdle0.octets }
      cell.anim.glConsole = console_.gl - glAvant
      // ② même état, une requête GPU PAR PASSE
      cell.passes = await page.evaluate((n, c) => window.__pf1.mesurer(n, 'passes', c), IMAGES, CHAUFFE)
      // ③ tout figé (animations = false ⇒ dtAmb = 0 : ni rotation propre, ni houle, ni grain)
      await page.evaluate(() => { window.__exp.params.animations = false })
      await dodo(300)
      cell.gel = await page.evaluate((n, c) => window.__pf1.mesurer(n, 'total', c), IMAGES, CHAUFFE)
      cell.gel.identiques = await page.evaluate(() => window.__pf1.identiquesBoucle())
      cell.gel.deterministe = await page.evaluate(() => window.__pf1.imagesIdentiques())
      cell.gelPasses = await page.evaluate((n, c) => window.__pf1.mesurer(n, 'passes', c), Math.max(20, IMAGES / 2), CHAUFFE)
      await page.evaluate(() => { window.__exp.params.animations = true })
      cell.animIdentiques = await page.evaluate(() => window.__pf1.identiquesBoucle())
      // ④ en MOUVEMENT : le globe tourne (orbite) ou la visée glisse (surface, crop),
      // requêtes et octets comptés au protocole pendant le déplacement
      const rMouv = litReseau()
      const tMouv = Date.now()
      cell.mouvement = await page.evaluate((n, c, m) => window.__pf1.mesurer(n, 'total', c, m), IMAGES, CHAUFFE, P.orbite ? 'orbite' : 'surface')
      cell.mouvement.dureeMs = Date.now() - tMouv
      cell.mouvement.reseau = { requetes: litReseau().requetes - rMouv.requetes, octets: litReseau().octets - rMouv.octets }
      await page.waitForFunction(() => { const e = window.__exp; return !e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
      cell.mouvement.reseauApres = { requetes: litReseau().requetes - rMouv.requetes, octets: litReseau().octets - rMouv.octets }
      cell.erreursGL = await page.evaluate(() => window.__pf1.erreursParPasse())
      if (CPUPROFILE) {
        // Profil V8 par échantillonnage (CDP), 3 s d'état animé : le temps PROPRE par
        // fonction, pour nommer ce que les sous-minuteries appellent « reste ».
        await cdp.send('Profiler.enable')
        await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
        await cdp.send('Profiler.start')
        await dodo(3000)
        const { profile } = await cdp.send('Profiler.stop')
        await cdp.send('Profiler.disable')
        const parId = new Map(profile.nodes.map((n) => [n.id, n]))
        const propre = new Map()
        const dt = profile.timeDeltas
        for (let i = 0; i < profile.samples.length; i++) {
          const n = parId.get(profile.samples[i])
          const cf = n.callFrame
          const cle = `${cf.functionName || '(anonyme)'} ${cf.url.split('/').slice(-1)[0] || ''}:${cf.lineNumber + 1}`
          propre.set(cle, (propre.get(cle) || 0) + (dt[i] || 0))
        }
        const total = [...propre.values()].reduce((a, b) => a + b, 0)
        cell.profilV8 = { totalMs: total / 1000, top: [...propre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ fn: k, ms: v / 1000, pct: 100 * v / total })) }
        console.log('     V8     ' + cell.profilV8.top.slice(0, 12).map((x) => `${x.fn} ${x.pct.toFixed(1)}%`).join(' · '))
      }
      cell.etatFin = await page.evaluate(() => window.__pf1.etat())
      cell.console = { ...console_, nuanceur: console_.nuanceur.slice(0, 5) }

      const f = (x, d = 2) => x == null ? '—' : x.toFixed(d)
      const a = cell.anim, g = cell.gel
      console.log(`     ANIMÉ  cadence p50 ${f(a.cadence.p50)} / p99 ${f(a.cadence.p99)} ms · tick CPU p50 ${f(a.tick.p50)} / p99 ${f(a.tick.p99)} · hors-tick moy ${f(a.horsTick.moy)} · GPU p50 ${f(a.gpuTotal.p50)} / p99 ${f(a.gpuTotal.p99)} (n=${a.gpuTotal.n}, disjoint ${a.disjoint}) · ${a.dessin.appels.p50} appels, ${a.dessin.triangles.p50} tri · longtasks ${a.longtasks.n} (${f(a.longtasks.ms, 0)} ms) · réseau ${a.reseau.requetes} req`)
      console.log(`     FIGÉ   cadence p50 ${f(g.cadence.p50)} / p99 ${f(g.cadence.p99)} ms · tick CPU p50 ${f(g.tick.p50)} / p99 ${f(g.tick.p99)} · GPU p50 ${f(g.gpuTotal.p50)} / p99 ${f(g.gpuTotal.p99)} · images identiques ${g.identiques.identiques} (animé : ${cell.animIdentiques.identiques})`)
      const mv = cell.mouvement
      console.log(`     MOUV.  cadence p50 ${f(mv.cadence.p50)} / p99 ${f(mv.cadence.p99)} ms · tick CPU p50 ${f(mv.tick.p50)} / p99 ${f(mv.tick.p99)} · hors-tick moy ${f(mv.horsTick.moy)} · GPU p50 ${f(mv.gpuTotal.p50)} · longtasks ${mv.longtasks.n} · réseau ${mv.mouvement?.reseau?.requetes ?? mv.reseau.requetes} req pendant ${mv.dureeMs} ms (+ ${mv.reseauApres.requetes - mv.reseau.requetes} après), ${(mv.reseauApres.octets / 1e6).toFixed(1)} Mo`)
      console.log('     MOUV.CPU ' + Object.entries(mv.cpu).filter(([k]) => k !== 'tick').sort((x, y) => y[1].moy - x[1].moy).slice(0, 8).map(([k, v]) => `${k} ${f(v.moy)}`).join(' · '))
      console.log('     LENTES ' + a.lentes.map((l) => `tick ${l.tick.toFixed(1)} ms [${l.top.join(', ')}]`).join(' · '))
      const top = Object.entries(a.cpu).filter(([k]) => k !== 'tick' && !k.startsWith('passe.')).sort((x, y) => y[1].moy - x[1].moy).slice(0, 8)
      console.log('     CPU    ' + top.map(([k, v]) => `${k} ${f(v.moy)}`).join(' · '))
      const topG = Object.entries(cell.passes.gpu).sort((x, y) => y[1].moy - x[1].moy)
      console.log('     GPU    ' + topG.map(([k, v]) => `${k} ${f(v.moy)}`).join(' · '))
      if (cell.erreursGL.length) console.log('     GL     ' + cell.erreursGL.map((x) => `${x.passe} → ${x.codes.join(',')}`).join(' · '))
      rapport.cellules.push(cell)
      } catch (err) {
        // une cellule cassée ne doit pas emporter les autres : on la note et on continue
        console.log(`     ⛔ cellule ${nomMachine}/${poste} abandonnée : ${String(err.message || err).split(/\r?\n/)[0]}`)
        rapport.cellules.push({ machine: nomMachine, poste, erreur: String(err.message || err) })
      }
      fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 1))
    }

    // le tas JS sur TAS_S secondes, au dernier poste, image par image
    if (TAS_S > 0) {
      await page.evaluate(() => { window.__exp.params.animations = true })
      const tas = await page.evaluate(async (s) => {
        const out = []
        const t0 = performance.now()
        while (performance.now() - t0 < s * 1000) {
          out.push({ t: Math.round(performance.now() - t0), tas: performance.memory?.usedJSHeapSize, textures: window.__exp.renderer.info.memory.textures, geometries: window.__exp.renderer.info.memory.geometries, tuiles: window.__exp.globe.tiles.size })
          await new Promise((r) => setTimeout(r, 1000))
        }
        return out
      }, TAS_S)
      rapport.machines[nomMachine].tas = tas
      const d = tas[0], fin = tas[tas.length - 1]
      console.log(`\n  tas JS sur ${TAS_S} s (poste ${POSTES[POSTES.length - 1]}) : ${(d.tas / 1e6).toFixed(0)} → ${(fin.tas / 1e6).toFixed(0)} Mo · textures ${d.textures} → ${fin.textures} · géométries ${d.geometries} → ${fin.geometries}`)
    }
  } finally {
    await nav.close()
  }
  fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 1))
}

// ----------------------------------------------------------- tableau final
console.log('\n=== BUDGET D IMAGE (p50 / p99 de la cadence, ms) — animé (état actuel) ===')
console.log('| poste | ' + MACHINES.join(' | ') + ' |')
for (const poste of POSTES) {
  const cols = MACHINES.map((m) => {
    const c = rapport.cellules.find((x) => x.machine === m && x.poste === poste)
    if (!c) return '—'
    return `${c.anim.cadence.p50.toFixed(1)} / ${c.anim.cadence.p99.toFixed(1)}${c.ok ? '' : ' ⛔alt'}${c.temoinValide ? '' : ' ⛔gpu'}`
  })
  console.log(`| ${poste} | ${cols.join(' | ')} |`)
}
console.log('\n→ ' + SORTIE)
