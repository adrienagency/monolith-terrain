// DIAG R28 — LES QUATRE SITUATIONS D'ADRIEN, EN PLEINE RÉSOLUTION
//
// Les quatre captures qu'il a envoyées : Bornéo vue moyenne, La Réunion loin,
// La Réunion près, le globe entier. Ce script les rejoue, les enregistre en
// pleine résolution, et RÉSUME chacune par quatre nombres.
//
// ⚡ **ET LE JUGE N'EST PAS « LE STYLE DE PRÈS EST-IL PRÉSENT AU LOIN »** — c'est
// la leçon de R25, qui a trouvé quinze matières déclarées vivantes parce qu'on
// les comparait à LEUR ABSENCE et jamais entre elles. Le juge du point ④ est
// donc **la distance entre la vue LOIN et la vue PRÈS du MÊME lieu** : elle doit
// diminuer. Un descripteur, quatre grandeurs, la même formule des deux côtés.
//
// ⚠️ **PAS DE CONDENSÉ** : 1 280 × 800, moyenne sur N images pour effacer le
// bruit d'animation, tout le calcul dans la page.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5911'))
const ETIQ = opt('--etiquette', 'apres')
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R28/vues'))
const IMAGES = Number(opt('--images', '5'))
const CALIBRE = has('--calibre')
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

// ══════════ LE DESCRIPTEUR — quatre grandeurs, la même formule partout ══════
//
// ⚠️ **AUCUNE N'EST « LA » MESURE, ET C'EST VOULU.** La moyenne dit la TEINTE,
// σ dit le MODELÉ, la saturation dit si la palette vit, le gradient dit s'il y a
// un MOTIF là où σ ne verrait qu'une couleur (constat ① de l'inventaire, pris
// par les deux bouts). Un aplat olive se reconnaît aux quatre à la fois.
function poserJuge() {
  const e = window.__exp
  if (window.__vv) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const W = CV.width
  const H = CV.height
  const px = new Uint8Array(W * H * 4)
  let acc = null
  let n = 0
  const etat = { W, H, get n() { return n } }
  window.__vv = etat
  function boucle() {
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
      R.resetState?.()
      if (!acc) acc = new Float32Array(W * H * 3)
      for (let i = 0, j = 0; i < W * H; i++) { acc[j++] += px[i * 4]; acc[j++] += px[i * 4 + 1]; acc[j++] += px[i * 4 + 2] }
      n++
    } catch (err) { etat.erreur = String(err).slice(0, 140) }
    requestAnimationFrame(boucle)
  }
  etat.vider = () => { acc = null; n = 0 }
  etat.pret = (k) => n >= k
  etat.decrire = () => {
    const N = W * H
    const M = new Float32Array(N * 3)
    for (let i = 0; i < N * 3; i++) M[i] = acc[i] / n
    let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, ssat = 0, sgr = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const j = i * 3
        const r = M[j], g = M[j + 1], b = M[j + 2]
        sr += r; sg += g; sb += b
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        sl += l; sl2 += l * l
        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        ssat += mx > 0 ? (mx - mn) / mx : 0
        const lx = x + 1 < W ? 0.299 * M[j + 3] + 0.587 * M[j + 4] + 0.114 * M[j + 5] : l
        const k = j + W * 3
        const ly = y + 1 < H ? 0.299 * M[k] + 0.587 * M[k + 1] + 0.114 * M[k + 2] : l
        sgr += Math.abs(lx - l) + Math.abs(ly - l)
      }
    }
    const ml = sl / N
    return {
      images: n,
      rgb: [sr / N, sg / N, sb / N],
      luminance: ml,
      sigma: Math.sqrt(Math.max(0, sl2 / N - ml * ml)),
      saturation: ssat / N,
      gradient: sgr / N,
    }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

const REUNION = { lat: -21.115, lon: 55.536 }
// ⚠️ **LE ZOOM DÉCIDE DE LA PART DE MONDE À L'ÉCRAN, ET C'EST L'INVERSE DE
// L'INTUITION.** La butée de caméra plafonne l'altitude autour de 18 km tant
// qu'un crop vit (`plan-fusion.md`, constat ①) : on ne recule donc pas. Ce qui
// change la proportion, c'est la TAILLE DU CROP — un zoom ÉLEVÉ fait un petit
// bloc, donc beaucoup d'alentours à l'écran. `borneo-cote` est la vue où la
// bande se voit, et elle est à z13, pas à z8.
const VUES = [
  { nom: 'borneo-moyenne', aller: { lat: 5.98, lon: 116.07, zoom: 10 } },
  { nom: 'borneo-cote', aller: { lat: 5.98, lon: 116.07, zoom: 13 } },
  { nom: 'reunion-loin', aller: { ...REUNION, zoom: 9 } },
  { nom: 'reunion-pres', aller: { ...REUNION, zoom: 13 } },
  // ⚠️ **DEUX ALTITUDES INTERMÉDIAIRES, PARCE QUE C'EST LÀ QUE VIT LA DEMANDE.**
  // « Au-dessus de Z10 » n'est pas l'orbite à 1 200 km : c'est la vue qui vient
  // juste après la mort du crop (40,3 km) et jusqu'à quelques centaines de km.
  // Le globe entier à 1 200 km ne montre presque que de l'eau, et un peigne
  // dont les bandes tombent sous le pixel ne s'y voit pas — mesurer là-haut
  // seulement aurait conclu « sans effet » sur la seule vue où l'effet ne peut
  // pas exister.
  { nom: 'orbite-60km', orbite: 60000 },
  { nom: 'orbite-300km', orbite: 300000 },
  { nom: 'globe', orbite: 1200000 },
]

const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(path.join(SORTIE, ETIQ), { recursive: true })
const rapport = { etiquette: ETIQ, quand: new Date().toISOString(), vues: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const journal = []
  page.on('pageerror', (e) => journal.push('pageerror: ' + String(e.message).slice(0, 200)))
  page.on('console', (m) => { if (/not compiled|not linked|ERROR: 0:/.test(m.text())) journal.push('SHADER: ' + m.text().slice(0, 400)) })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(10000)
  await page.keyboard.press('Escape')
  await dodo(2500)
  // ⚠️ les rails d'interface cachés : on compare des PIXELS DE CARTE, pas des boutons
  await page.evaluate(() => { document.body.classList.add('ce-railL-off', 'ce-railR-off') })
  await page.evaluate(poserJuge)
  await page.evaluate(() => { window.__exp.params.animations = false })
  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })

  for (const V of VUES) {
    // ⛔ **`enterOrbit(alt)` NE REPLACE PAS UNE CAMÉRA DÉJÀ EN ORBITE**, et le
    // banc l'a rendu visible : trois appels d'affilée à 60 000, 300 000 et
    // 1 200 000 m ont tous rendu `altM = 60 000`. On pose donc l'altitude par
    // `orbAltTarget`, l'état que la boucle amortit — et l'unité est DÉRIVÉE du
    // couple (`orbAlt`, `altM`) lu dans la page, jamais recopiée.
    if (V.orbite) await page.evaluate(async (a) => {
      const m = window.__exp.modes
      if (m.mode !== 'orbital') m.enterOrbit(a)
      await new Promise((r) => setTimeout(r, 2500))
      const parM = m.orbAlt / Math.max(m.altM, 1)
      m.orbAlt = m.orbAltTarget = a * parM
    }, V.orbite)
    else await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG R28'), V.aller)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
    await dodo(8000)
    await page.evaluate(() => window.__vv.vider())
    await page.waitForFunction((n) => window.__vv.pret(n), { polling: 30, timeout: 60000 }, IMAGES)
    const d = await page.evaluate(() => window.__vv.decrire())
    const etat = await page.evaluate(() => {
      const e = window.__exp
      const u = e.globe.uniforms
      const P = window.__palierMachine || {}
      return {
        mode: e.modes.mode, altM: e.modes.altM, crop: !!e.globe._crop,
        uTexShade: u.uTexShade.value, uAnalysisOn: u.uAnalysisOn.value,
        uHeightPivot: u.uHeightPivot.value, uHeightContrast: u.uHeightContrast.value,
        uReliefBas: u.uReliefBas.value, uLandMax: u.uLandMax.value,
        uMerFondBudgetM: u.uMerFondBudgetM.value, uHazeAmt: u.uHazeAmt.value,
        uMppFacteur: u.uMppFacteur.value, uResRefM: u.uResRefM?.value ?? null,
        uTilePx: u.uTilePx?.value ?? null, uUnitesParMetre: u.uUnitesParMetre?.value ?? null,
        palier: P.palier, palierNom: P.nom, grain: P.grain, ombres: P.ombres,
        ecranPalier: P.signaux?.ecran, pixelRatio: e.renderer.getPixelRatio(),
      }
    })
    const fichier = path.join(SORTIE, ETIQ, V.nom + '.png')
    await page.screenshot({ path: fichier })
    rapport.vues.push({ nom: V.nom, ...d, etat, fichier })
    console.log(`[${ETIQ}/${V.nom}] alt=${Math.round(etat.altM)} m crop=${etat.crop}`
      + ` | rgb=${d.rgb.map((x) => x.toFixed(1)).join(',')} lum=${d.luminance.toFixed(2)}`
      + ` σ=${d.sigma.toFixed(2)} sat=${d.saturation.toFixed(4)} grad=${d.gradient.toFixed(3)}`
      + ` | texShade=${etat.uTexShade} analyse=${etat.uAnalysisOn} pivot=${etat.uHeightPivot} contraste=${etat.uHeightContrast}`)

    // ══════ LA CALIBRATION DU PEIGNE DU MONDE — l'écart qu'il produit ═══════
    //
    // ⚠️ **ON LE COMPARE À LUI-MÊME ÉTEINT, AU MÊME INSTANT** : `uTexShade` à 0
    // puis à sa valeur. Ce que ça donne DANS le crop (le peigne cuit) et HORS du
    // crop (le peigne du monde) doit être du même ordre — c'est la seule façon
    // de choisir le gain sans le décréter.
    if (CALIBRE) {
      const av = await page.evaluate(() => {
        const u = window.__exp.globe.uniforms
        const v = u.uTexShade.value
        u.uTexShade.value = 0
        return v
      })
      await dodo(700)
      await page.evaluate(() => window.__vv.vider())
      await page.waitForFunction((n) => window.__vv.pret(n), { polling: 30, timeout: 60000 }, IMAGES)
      const d0 = await page.evaluate(() => window.__vv.decrire())
      await page.evaluate((v) => { window.__exp.globe.uniforms.uTexShade.value = v }, av)
      await dodo(700)
      const ecart = {
        dLum: d.luminance - d0.luminance,
        dSigma: d.sigma - d0.sigma,
        dGrad: d.gradient - d0.gradient,
        gradEteint: d0.gradient,
      }
      rapport.vues[rapport.vues.length - 1].calibre = ecart
      console.log(`      peigne : Δσ=${ecart.dSigma.toFixed(3)} Δgrad=${ecart.dGrad.toFixed(4)}`
        + ` (grad éteint ${d0.gradient.toFixed(3)}) Δlum=${ecart.dLum.toFixed(3)}`)
    }
  }
  rapport.journal = journal
  if (journal.length) console.log('\n⛔ JOURNAL DE NUANCEUR :', journal.slice(0, 5))

  // ══════ LE JUGE : la distance LOIN ↔ PRÈS du même lieu ════════════════════
  const loin = rapport.vues.find((v) => v.nom === 'reunion-loin')
  const pres = rapport.vues.find((v) => v.nom === 'reunion-pres')
  if (loin && pres) {
    const d = {
      dLum: Math.abs(loin.luminance - pres.luminance),
      dSigma: Math.abs(loin.sigma - pres.sigma),
      dSat: Math.abs(loin.saturation - pres.saturation),
      dGrad: Math.abs(loin.gradient - pres.gradient),
      dRgb: Math.hypot(...loin.rgb.map((x, i) => x - pres.rgb[i])),
    }
    rapport.juge = d
    console.log(`\nJUGE loin↔près (La Réunion) : ΔRGB=${d.dRgb.toFixed(2)} Δlum=${d.dLum.toFixed(2)}`
      + ` Δσ=${d.dSigma.toFixed(2)} Δsat=${d.dSat.toFixed(4)} Δgrad=${d.dGrad.toFixed(3)}`)
  }
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, ETIQ + '.json'), JSON.stringify(rapport, null, 1))
console.log('écrit : ' + path.join(SORTIE, ETIQ + '.json'))
