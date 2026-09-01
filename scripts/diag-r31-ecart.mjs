// DIAG R31 — L'ÉCART DE COULEUR ENTRE LES DEUX RÉGIMES D'ÉCHELLE
//
// ⚠️ **CE N'EST PAS UN BANC D'IMAGE, ET C'EST VOULU.** Une moyenne d'image
// mélange le style et le sujet (R28 §⑥⑤). Ici on relève les uniformes VIVANTS,
// on relit la table 2D `uRampCrop` **octet par octet**, et on rejoue les DEUX
// lois d'indice — celle du crop (`natRampT` sur `hNormRelief`) et celle du monde
// (`natRampTMonde`) — sur les MÊMES hauteurs de sol, en lisant la MÊME table.
// L'écart rendu est donc, au sens strict, « la même terre, deux couleurs ».
//
// ⚠️ **LE ΔE EST UN CIE76 L*a*b* D65**, écrit ici en toutes lettres. Ce n'est
// pas un écart RGB : 10 unités de rouge et 10 de bleu ne se voient pas pareil.
// Seuil de perception courant : ΔE ≈ 2,3 (JND).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// ⛔ **LE RÉGIME DU MONDE SE LIT DANS LE MODULE, IL NE SE RECOPIE PAS.** Les
// cinq nombres n'ont qu'une écriture (`rampe-crop.js` §⑥) ; les retaper ici
// aurait fait un banc qui mesure sa propre copie.
import { REGIME_MONDE, RAMPE_MONDE } from '../src/monde/rampe-crop.js'
import { plancherPivot as plancherPivotSocle } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5731'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R31'))
const ETIQ = opt('--etiquette', 'avant')
const VISIBLE = has('--visible')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable')
  process.exit(2)
}

// ══════════ LE RELEVÉ DANS LA PAGE ══════════════════════════════════════════
function relever() {
  const e = window.__exp
  if (!e?.globe) return { erreur: 'pas de globe' }
  const u = e.globe.uniforms
  const num = (n) => (u[n] && typeof u[n].value === 'number' ? u[n].value : null)
  const NOMS = [
    'uLandBas', 'uLandMax', 'uOceanDepth', 'uReliefBas', 'uPlancherRampeM',
    'uMerZeroSousEau', 'uRampCropOn', 'uHeightContrast', 'uHeightPivot',
    'uAnalysisOn', 'uTexShade', 'uWetK', 'uExpoK', 'uHemi', 'uTreeLine',
    'uHazeAmt', 'uHazeAlt', 'uHazeDist', 'uCropOn', 'uHabOn', 'uSolOn',
    'uSlopeTint', 'uPhotoMonde', 'uAerialOn', 'uMatOn', 'uRecollage',
  ]
  const uniformes = {}
  for (const n of NOMS) uniformes[n] = num(n)
  let ramp2D = null
  const t2 = u.uRampCrop?.value
  if (t2?.image?.data) ramp2D = { largeur: t2.image.width, hauteur: t2.image.height, px: Array.from(t2.image.data) }
  const P = window.__palierMachine || {}
  return {
    uniformes,
    ramp2D,
    scene: {
      mode: e.modes?.mode, altM: e.modes?.altM, crop: !!e.globe._crop,
      rampeMesuree: e.globe._rampe || null,
      echellePosee: e.globe.echelleRampePosee?.() || null,
      lat: e.params?.lat, lon: e.params?.lon, zoom: e.params?.zoom,
      colorMode: e.params?.colorMode,
      heightContrastParam: e.params?.heightContrast,
      heightPivotParam: e.params?.heightPivot,
      demMin: e.__dem?.minM ?? null, demMax: e.__dem?.maxM ?? null,
    },
    palier: {
      palier: P.palier, nom: P.nom, ombres: P.ombres, grain: P.grain,
      pixelRatio: e.renderer?.getPixelRatio?.(),
    },
  }
}

// ══════════ LES DEUX LOIS, REJOUÉES EN JS — TRANSCRIPTION ═══════════════════
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
// naturel-crop.js — natPlancherPivot
const plancherPivot = (hNormMer) => Math.min(Math.max(hNormMer, 0), 0.95) + 0.02
// naturel-crop.js — natRampT
const natRampT = (hNorm, pivot, contraste) => clamp01(0.5 + (hNorm - pivot) * contraste)

function lire2D(ramp, x01, y01) {
  const W = ramp.largeur, H = ramp.hauteur
  const x = Math.min(W - 1, Math.max(0, Math.round(clamp01(x01) * (W - 1))))
  const y = Math.min(H - 1, Math.max(0, Math.round(clamp01(y01) * (H - 1))))
  const i = (y * W + x) * 4
  return [ramp.px[i], ramp.px[i + 1], ramp.px[i + 2]]
}

// ── CIE76 ΔE*ab, sRGB → linéaire → XYZ D65 → L*a*b*
const inv = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
const fLab = (t) => (t > 0.008856451679035631 ? Math.cbrt(t) : t / (3 * 0.04280618311533888 ** 2) + 4 / 29)
function lab(rgb) {
  const r = inv(rgb[0]), g = inv(rgb[1]), b = inv(rgb[2])
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
function deltaE(a, b) {
  const A = lab(a), B = lab(b)
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })

// ⚠️ **TROIS AMPLITUDES TRÈS DIFFÉRENTES — c'est la lettre du brief** : une île
// volcanique, une plaine, une haute montagne. Trois zooms par lieu, donc trois
// altitudes de caméra, parce que c'est l'ALTITUDE qui décide du régime.
const LIEUX = [
  { nom: 'reunion', genre: 'ile volcanique', lat: -21.115, lon: 55.536 },
  { nom: 'paysbas', genre: 'plaine', lat: 52.09, lon: 5.12 },
  { nom: 'everest', genre: 'haute montagne', lat: 27.99, lon: 86.93 },
  { nom: 'borneo', genre: 'plaine cotiere tropicale', lat: 5.98, lon: 116.07 },
]
const ZOOMS = [13, 11, 9]
const H_TEMOINS = [0, 50, 100, 200, 300, 500, 800, 1200, 2000, 3000]

const MONDE = {
  reliefBas: REGIME_MONDE.reliefBas,
  landMax: REGIME_MONDE.landMax,
  contraste: REGIME_MONDE.contraste,
  pivot: Math.max(
    REGIME_MONDE.pivot,
    plancherPivotSocle((0 - REGIME_MONDE.reliefBas)
      / Math.max(REGIME_MONDE.landMax - REGIME_MONDE.reliefBas, RAMPE_MONDE.plancherM))
  ),
}
const rapport = { etiquette: ETIQ, port: PORT, quand: new Date().toISOString(), monde: MONDE, lieux: [] }
console.log('régime du MONDE :', JSON.stringify(MONDE))
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const journal = []
  page.on('pageerror', (e) => journal.push('pageerror: ' + String(e.message).slice(0, 220)))
  page.on('console', (m) => { if (/not compiled|not linked|ERROR: 0:|WARNING: 0:/.test(m.text())) journal.push('SHADER: ' + m.text().slice(0, 400)) })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape') // ⚠️ le voile d'accueil mange TOUS les gestes
  await dodo(2000)
  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  console.log('pilote :', rapport.gpu)

  for (const L of LIEUX) {
    const bloc = { ...L, vues: [] }
    for (const z of ZOOMS) {
      await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG R31'), { lat: L.lat, lon: L.lon, zoom: z })
      await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
      await dodo(7000)
      const r = await page.evaluate(relever)
      if (r.erreur) { console.log(L.nom, z, 'ERREUR', r.erreur); continue }
      const U = r.uniformes
      if (!r.ramp2D) { console.log(L.nom, z, 'pas de table 2D'); continue }

      const amp = Math.max(U.uLandMax - U.uReliefBas, U.uPlancherRampeM)
      const hNormMer = (0 - U.uReliefBas) / amp
      const pivot = Math.max(U.uHeightPivot, plancherPivot(hNormMer))
      // le régime du monde, tel que GLSL_REGIME_MONDE le fige
      const M = MONDE
      // ⚠️ **LE POIDS DE RECOLLAGE EST LU DANS LA PAGE, PAS RECALCULÉ ICI** —
      // Tâche R31. Absent (relevé d'avant la tâche), il vaut zéro et le banc rend
      // exactement ce qu'il rendait.
      const w = Number.isFinite(U.uRecollage) ? U.uRecollage : 0
      const echantillon = (h) => {
        const hNormRelief = clamp01((h - U.uReliefBas) / amp)
        const tCrop = natRampT(hNormRelief, pivot, U.uHeightContrast)
        const hNormM = clamp01((h - M.reliefBas) / (M.landMax - M.reliefBas))
        const tMon = natRampT(hNormM, M.pivot, M.contraste)
        // globe.js — `rampT = mix(rampT, rampTMonde, uRecollage);`
        const tLoc = tCrop * (1 - w) + tMon * w
        // ⚠️ **Y = 0,5, LA LIGNE MÉDIANE**, exactement comme R28 : hors analyse
        // `natHumiditeY` rend sa médiane, et c'est l'axe X qu'on départage ici.
        const cLoc = lire2D(r.ramp2D, tLoc, 0.5)
        const cMon = lire2D(r.ramp2D, tMon, 0.5)
        return { h, tCrop, tLoc, tMon, cLoc, cMon, dE: deltaE(cLoc, cMon) }
      }
      const temoins = H_TEMOINS.map(echantillon)
      // le balayage complet, pour la médiane et le maximum sur les terres du lieu
      const balayage = []
      for (let h = 0; h <= 4000; h += 10) balayage.push(echantillon(h))
      const dEs = balayage.map((x) => x.dE).sort((a, b) => a - b)
      // ⛔ **ET LA MÊME MESURE SUR LA TRANCHE QUI EXISTE VRAIMENT DANS LE CROP.**
      // Comparer deux couleurs à 3 000 m au-dessus d'un crop dont la terre plafonne
      // à 324 m, c'est comparer deux couleurs que personne ne voit : le balayage
      // large sert au départage, celui-ci sert au verdict.
      const basCrop = Math.max(0, U.uReliefBas)
      const dansCrop = balayage.filter((x) => x.h >= basCrop && x.h <= U.uLandMax)
      const dEsCrop = dansCrop.map((x) => x.dE).sort((a, b) => a - b)
      const platCrop = dansCrop.filter((x) => x.tLoc <= 1e-6)
      const platCropSans = dansCrop.filter((x) => x.tCrop <= 1e-6)
      // l'aplat : l'intervalle de TERRE où l'indice local est saturé à 0
      // ⚠️ **L'APLAT SE MESURE SUR CE QUI EST PEINT (`tLoc`, recollage compris),
      // et le témoin `tCrop` dit ce qu'il aurait valu SANS le recollage.**
      const plat = balayage.filter((x) => x.tLoc <= 1e-6)
      const platSansRecollage = balayage.filter((x) => x.tCrop <= 1e-6)
      const platMonde = balayage.filter((x) => x.tMon <= 1e-6)
      const vue = {
        zoom: z, altM: r.scene.altM, crop: r.scene.crop, mode: r.scene.mode,
        uniformes: U, palier: r.palier, echellePosee: r.scene.echellePosee,
        pivotEffectif: pivot, hNormMer, amplitude: amp,
        temoins: temoins.map((x) => ({ h: x.h, tLoc: +x.tLoc.toFixed(4), tMon: +x.tMon.toFixed(4), cLoc: x.cLoc, cMon: x.cMon, dE: +x.dE.toFixed(2) })),
        dE: {
          median: +dEs[Math.floor(dEs.length / 2)].toFixed(2),
          max: +dEs[dEs.length - 1].toFixed(2),
          moyen: +(dEs.reduce((a, b) => a + b, 0) / dEs.length).toFixed(2),
        },
        aplatLocalM: plat.length ? plat[plat.length - 1].h - plat[0].h + 10 : 0,
        aplatLocalJusqua: plat.length ? plat[plat.length - 1].h : null,
        aplatMondeM: platMonde.length ? platMonde[platMonde.length - 1].h - platMonde[0].h + 10 : 0,
        aplatSansRecollageM: platSansRecollage.length ? platSansRecollage[platSansRecollage.length - 1].h - platSansRecollage[0].h + 10 : 0,
        trancheCropM: [basCrop, U.uLandMax],
        dECrop: dEsCrop.length ? {
          median: +dEsCrop[Math.floor(dEsCrop.length / 2)].toFixed(2),
          max: +dEsCrop[dEsCrop.length - 1].toFixed(2),
        } : null,
        aplatDansCropM: platCrop.length ? platCrop[platCrop.length - 1].h - platCrop[0].h + 10 : 0,
        aplatDansCropSansM: platCropSans.length ? platCropSans[platCropSans.length - 1].h - platCropSans[0].h + 10 : 0,
        recollage: w,
        // ⚡ **L'ÉTALEMENT DE LA TRANCHE BASSE — la vraie mesure de l'aplat.**
        // Un « plat » qui n'est plus strictement plat peut rester invisiblement
        // plat : on chiffre donc l'écart de couleur ENTRE 0 m et 300 m, et entre
        // 0 m et 600 m, DANS le régime peint.
        etalement0_300: +deltaE(echantillon(0).cLoc, echantillon(300).cLoc).toFixed(2),
        etalement0_600: +deltaE(echantillon(0).cLoc, echantillon(600).cLoc).toFixed(2),
        // ⚡ **ET LE TÉMOIN APPARIÉ, DANS LE MÊME RELEVÉ** : le même étalement au
        // régime du crop SEUL. C'est l'AVANT, calculé sur les uniformes de
        // l'APRÈS — donc sans comparer deux chargements de tuiles.
        etalementSansRecollage0_300: +deltaE(lire2D(r.ramp2D, echantillon(0).tCrop, 0.5), lire2D(r.ramp2D, echantillon(300).tCrop, 0.5)).toFixed(2),
        etalementSansRecollage0_600: +deltaE(lire2D(r.ramp2D, echantillon(0).tCrop, 0.5), lire2D(r.ramp2D, echantillon(600).tCrop, 0.5)).toFixed(2),
      }
      bloc.vues.push(vue)
      console.log(`[${L.nom} z${z}] alt=${Math.round(vue.altM)} m crop=${vue.crop}`
        + ` | reliefBas=${U.uReliefBas?.toFixed(1)} landMax=${U.uLandMax?.toFixed(1)}`
        + ` pivot=${U.uHeightPivot?.toFixed(3)}→${pivot.toFixed(3)} contraste=${U.uHeightContrast?.toFixed(2)}`
        + ` recollage=${U.uRecollage}`)
      console.log(`    ΔE médian=${vue.dE.median} max=${vue.dE.max} | aplat PEINT ${vue.aplatLocalM} m (jusqu'à ${vue.aplatLocalJusqua} m)`
        + ` · aplat SANS recollage ${vue.aplatSansRecollageM} m · aplat monde ${vue.aplatMondeM} m`
        + `
    ÉTALEMENT de la tranche basse — 0→300 m : ΔE ${vue.etalementSansRecollage0_300} (sans) → ${vue.etalement0_300} (avec)`
        + ` · 0→600 m : ΔE ${vue.etalementSansRecollage0_600} (sans) → ${vue.etalement0_600} (avec)`
        + `
    ⚡ SUR LA TRANCHE DU CROP [${basCrop.toFixed(0)} ; ${U.uLandMax.toFixed(0)}] m : ΔE médian ${vue.dECrop?.median} max ${vue.dECrop?.max}`
        + ` · APLAT ${vue.aplatDansCropSansM} m (sans) → ${vue.aplatDansCropM} m (avec)`)
      for (const t of vue.temoins) {
        console.log(`      h=${String(t.h).padStart(5)} m  tLoc=${t.tLoc.toFixed(4)} ${JSON.stringify(t.cLoc)}   tMon=${t.tMon.toFixed(4)} ${JSON.stringify(t.cMon)}   ΔE=${t.dE.toFixed(2)}`)
      }
    }
    rapport.lieux.push(bloc)
  }
  rapport.journal = journal
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, `ecart-${ETIQ}.json`), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, `ecart-${ETIQ}.json`))
