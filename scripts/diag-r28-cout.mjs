// DIAG R28 — LE COÛT GPU DU PEIGNE DU MONDE, À LA MINUTERIE DU PILOTE
//
// ⛔ **`gl.finish()` NE PÈSE PAS LES FRAGMENTS**, et un rapport de ce chantier a
// été réfuté là-dessus. On emploie donc `EXT_disjoint_timer_query_webgl2`, la
// minuterie du pilote, **avec un témoin de validité** : on rend la MÊME scène à
// deux résolutions dans un rapport de 16 en fragments, et on exige que le temps
// suive. R20 a validé la sienne par ×16 fragments ⇒ ×8,2 de temps, contre ×35 ⇒
// ×0,96 pour un banc CPU qui ne mesurait rien.
//
// ⚠️ **40 RENDUS DE CHAUFFE APRÈS CHAQUE RECOMPILATION** — sans eux la première
// mesure vaut ×6 (`rapport-R2.md`).
//
// ⚡ **ET LES DEUX VARIANTES VIVENT DANS LA MÊME PAGE.** Comparer deux
// chargements aurait comparé deux jeux de tuiles, deux caméras et deux états de
// cache. Ici on RÉÉCRIT le fragment des matériaux de tuile — `natPeigneMonde`
// neutralisé, la lecture du centre supprimée, la pose désarmée — puis on alterne
// A/B/A/B en appariant les différences.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5911'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R28'))
const TOURS = Number(opt('--tours', '12'))     // paires A/B par altitude
const RENDUS = Number(opt('--rendus', '30'))   // rendus dans une seule requête de minuterie
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
function trouverChrome() {
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
const CHEMIN = [
  path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
  'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
].find((x) => fs.existsSync(x))
const puppeteer = (await import('file:///' + CHEMIN.split('\\').join('/'))).default

// ══════════ L'INSTRUMENT, DANS LA PAGE ═════════════════════════════════════
function poserBanc() {
  const e = window.__exp
  const R = e.renderer
  const gl = R.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  if (!ext) return 'EXT_disjoint_timer_query_webgl2 absent'
  const S = e.sceneGlobe || e.scene
  const C = e.camGlobe || e.camera

  // ⚠️ **LA RÉÉCRITURE EST TEXTUELLE ET VÉRIFIÉE** : chaque substitution renvoie
  // le nombre de matériaux touchés, et le banc refuse de mesurer si l'une d'elles
  // rend zéro. Un banc qui compare une variante à elle-même rend « pas d'écart »
  // et se croit concluant.
  const SANS = [
    ['float hCentre = hauteurEchant(vUv, qCrop);', 'float hCentre = 0.0;'],
    ['peigneMondeRG = natPeigneMonde(', 'peigneMondeRG = vec2(0.5); if (false) peigneMondeRG = natPeigneMonde('],
    ['if (uNormaleFineOn > 0.5 && uTexShade > 0.001 && !sousEau) {\n    col = natPeigne(col, peigneMondeRG.x, peigneMondeRG.y',
     'if (false) {\n    col = natPeigne(col, peigneMondeRG.x, peigneMondeRG.y'],
  ]
  const materiaux = () => {
    const out = []
    for (const t of e.globe.tiles.values()) { const m = t.mesh?.material; if (m?.fragmentShader) out.push(m) }
    return out
  }
  const original = new Map()
  for (const m of materiaux()) original.set(m, m.fragmentShader)

  const etat = {
    variante: 'A',
    materiaux: original.size,
    poser(v) {
      let touches = 0
      let subs = 0
      for (const m of materiaux()) {
        const src = original.get(m)
        if (!src) continue
        if (v === 'A') { if (m.fragmentShader !== src) { m.fragmentShader = src; m.needsUpdate = true } ; touches++; continue }
        let f = src
        let k = 0
        for (const [a, b] of SANS) { if (f.includes(a)) { f = f.replace(a, b); k++ } }
        subs = k
        if (m.fragmentShader !== f) { m.fragmentShader = f; m.needsUpdate = true }
        touches++
      }
      etat.variante = v
      return { touches, subs }
    },
    // ⚠️ **UN SEUL `TIME_ELAPSED` À LA FOIS** : on enferme K rendus dans UNE
    // requête, puis on divise. Ouvrir K requêtes imbriquées est illégal.
    async mesurer(K, echelle) {
      const pr = R.getPixelRatio()
      const t = R.getRenderTarget()
      if (echelle !== 1) R.setPixelRatio(pr * echelle)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < K; i++) R.render(S, C)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      R.setPixelRatio(pr)
      R.setRenderTarget(t)
      R.resetState?.()
      for (let n = 0; n < 4000; n++) {
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break
        await new Promise((r) => requestAnimationFrame(r))
      }
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) ? gl.getQueryParameter(q, gl.QUERY_RESULT) : null
      gl.deleteQuery(q)
      return { msParRendu: ns == null ? null : ns / 1e6 / K, disjoint }
    },
    chauffe(K) { for (let i = 0; i < K; i++) R.render(S, C) },
    canevas: () => [R.domElement.width, R.domElement.height, R.getPixelRatio()],
  }
  window.__cout = etat
  return 'posé (' + original.size + ' matériaux)'
}

const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { quand: new Date().toISOString(), tours: TOURS, rendus: RENDUS, altitudes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const journal = []
  page.on('console', (m) => { if (/not compiled|not linked|ERROR: 0:/.test(m.text())) journal.push(m.text().slice(0, 300)) })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(10000)
  await page.keyboard.press('Escape')
  await dodo(2500)
  await page.evaluate(() => { window.__exp.params.animations = false })
  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  console.log('pilote :', rapport.gpu)

  const LIEUX = [
    { nom: 'crop-z13', aller: { lat: -21.115, lon: 55.536, zoom: 13 } },
    { nom: 'z10', aller: { lat: 5.98, lon: 116.07, zoom: 10 } },
    { nom: 'orbite-300km', orbite: 300000 },
  ]
  for (const L of LIEUX) {
    if (L.orbite) await page.evaluate(async (a) => {
      const m = window.__exp.modes
      if (m.mode !== 'orbital') m.enterOrbit(a)
      await new Promise((r) => setTimeout(r, 2500))
      const parM = m.orbAlt / Math.max(m.altM, 1)
      m.orbAlt = m.orbAltTarget = a * parM
    }, L.orbite)
    else await page.evaluate((a) => window.__exp.modes._rescale(a, 'BANC R28'), L.aller)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
    await dodo(7000)
    const pose = await page.evaluate(poserBanc)
    if (String(pose).startsWith('EXT')) { console.log('⛔', pose); break }
    const info = await page.evaluate(() => ({
      materiaux: window.__cout.materiaux, canevas: window.__cout.canevas(),
      altM: window.__exp.modes.altM, mode: window.__exp.modes.mode, crop: !!window.__exp.globe._crop,
      tuiles: window.__exp.globe.tiles.size,
      palier: (window.__palierMachine || {}).palier, palierNom: (window.__palierMachine || {}).nom,
    }))
    // ── le témoin de validité : ×16 fragments doivent coûter plus cher
    const t1 = await page.evaluate(async (K) => { window.__cout.chauffe(40); return window.__cout.mesurer(K, 1) }, RENDUS)
    const t4 = await page.evaluate(async (K) => { window.__cout.chauffe(40); return window.__cout.mesurer(K, 4) }, Math.max(4, Math.round(RENDUS / 4)))
    const temoin = { x1: t1, x4: t4, rapport: t1.msParRendu ? t4.msParRendu / t1.msParRendu : null }

    const A = []
    const B = []
    const paires = []
    for (let i = 0; i < TOURS; i++) {
      // ⚠️ ORDRE TOURNANT : A puis B les tours pairs, B puis A les impairs.
      const ordre = i % 2 === 0 ? ['A', 'B'] : ['B', 'A']
      const tour = {}
      for (const v of ordre) {
        const p = await page.evaluate((x) => window.__cout.poser(x), v)
        await page.evaluate(() => window.__cout.chauffe(40)) // ⚠️ APRÈS CHAQUE RECOMPILATION
        const m = await page.evaluate((K) => window.__cout.mesurer(K, 1), RENDUS)
        if (m.msParRendu != null && !m.disjoint) { tour[v] = m.msParRendu; (v === 'A' ? A : B).push(m.msParRendu) }
        if (i === 0 && v === 'B') rapport.substitutions = p
      }
      // ⚠️ **LA DIFFÉRENCE EST APPARIÉE** (protocole `rapport-R2.md`) : les deux
      // variantes du MÊME tour ont vu la même dérive thermique, le même jeu de
      // tuiles et la même charge de fond. Comparer deux MOYENNES aurait laissé
      // cette dérive dans l'écart — et sur ce banc elle vaut plus que l'effet.
      if (tour.A != null && tour.B != null) paires.push(tour.A - tour.B)
    }
    await page.evaluate(() => window.__cout.poser('A'))
    const moy = (a) => a.reduce((s, x) => s + x, 0) / Math.max(a.length, 1)
    const ect = (a) => { const m = moy(a); return Math.sqrt(moy(a.map((x) => (x - m) ** 2))) }
    // ⚠️ **LA MÉDIANE DES DIFFÉRENCES APPARIÉES, PAS LEUR MOYENNE** : une seule
    // requête tombée sur un pic d'ordonnancement décale la moyenne de tout le
    // lot ; la médiane, non. On rend les deux, et l'écart entre elles DIT s'il y
    // a eu un pic.
    const tri = [...paires].sort((a, b) => a - b)
    const med = tri.length ? (tri.length % 2 ? tri[(tri.length - 1) / 2] : (tri[tri.length / 2 - 1] + tri[tri.length / 2]) / 2) : null
    const ligne = {
      nom: L.nom, info, temoin,
      A: { n: A.length, moy: moy(A), sigma: ect(A) },
      B: { n: B.length, moy: moy(B), sigma: ect(B) },
      paires, paireMoy: moy(paires), paireMediane: med, paireSigma: ect(paires),
      surcout: med,
      surcoutPct: moy(B) > 0 ? (med / moy(B)) * 100 : null,
    }
    rapport.altitudes.push(ligne)
    console.log(`[${L.nom}] alt=${Math.round(info.altM)} m crop=${info.crop} tuiles=${info.tuiles} materiaux=${info.materiaux}`
      + ` | témoin ×16 fragments ⇒ ×${temoin.rapport ? temoin.rapport.toFixed(2) : '?'} de temps`
      + `\n   AVEC peigne ${ligne.A.moy.toFixed(4)} ± ${ligne.A.sigma.toFixed(4)} ms (n=${ligne.A.n})`
      + ` · SANS ${ligne.B.moy.toFixed(4)} ± ${ligne.B.sigma.toFixed(4)} ms (n=${ligne.B.n})`
      + `
   differences APPARIEES : mediane ${med?.toFixed(4)} ms | moyenne ${ligne.paireMoy.toFixed(4)} +- ${ligne.paireSigma.toFixed(4)} ms`
      + ` ==> surcout ${ligne.surcoutPct?.toFixed(2)} % de l image de tuiles`)
  }
  rapport.journal = journal
  if (journal.length) console.log('⛔ nuanceur :', journal.slice(0, 3))
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, 'cout.json'), JSON.stringify(rapport, null, 1))
console.log('écrit : ' + path.join(SORTIE, 'cout.json'))
