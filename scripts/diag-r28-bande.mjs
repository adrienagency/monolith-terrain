// DIAG R28 — D'OÙ VIENT LA BANDE VERTE DES CÔTES, ÉTAGE PAR ÉTAGE
//
// ⚠️ **PAS UN RAISONNEMENT : UN RELEVÉ.** La méthode est celle de R19 (lire la
// valeur de CHAQUE étage du nuanceur, pas la couleur finale) appliquée à la
// colorisation : on relève les uniformes VIVANTS, on relit les DEUX tables de
// couleur (`uRamp` 1D et `uRampCrop` 2D) **octet par octet**, et on rejoue la
// suite exacte du nuanceur en JS sur un balayage d'altitudes. Ce que rend ce
// script n'est donc pas « la couleur que je crois » mais la couleur que le GPU
// écrit, pour chaque hauteur, à chaque étage.
//
// ⚠️ **ET LE BALAYAGE EST LE SEUL INSTRUMENT QUI VOIE UNE BANDE.** Une moyenne
// d'image la noie (constat ① de l'inventaire) ; une capture ne dit pas POURQUOI.
// Ici la bande se lit comme un intervalle d'altitudes sur lequel la sortie d'un
// étage est CONSTANTE — et l'étage se nomme tout seul.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5911'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R28'))
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
//
// ⚠️ **LES DEUX TABLES SE LISENT DIFFÉREMMENT, ET LES CONFONDRE REND DU BRUIT.**
// `uRamp` est une `CanvasTexture` 512×1 (`globe.rebuildRamp`) : son image est un
// `<canvas>`, donc `getImageData`. `uRampCrop` est une `DataTexture` RGBA
// (`terrain.rebuildRamp`, `buildRamp2D`) avec **`flipY = false`** : ses octets
// sont dans `image.data`, ligne 0 = pôle SEC.
function releverColorisation() {
  const e = window.__exp
  if (!e?.globe) return { erreur: 'pas de globe' }
  const u = e.globe.uniforms
  const val = (n) => {
    const o = u[n]
    if (!o) return null
    const v = o.value
    if (v == null) return null
    if (typeof v === 'number') return v
    if (v.isColor) return [v.r, v.g, v.b]
    if (v.isVector2) return [v.x, v.y]
    if (v.isVector3) return [v.x, v.y, v.z]
    if (v.isVector4) return [v.x, v.y, v.z, v.w]
    if (v.isTexture) return 'texture'
    return String(v)
  }
  const NOMS = [
    'uLandBas', 'uLandMax', 'uOceanDepth', 'uReliefBas', 'uPlancherRampeM',
    'uMerRampeOn', 'uMerFondBudgetM', 'uMerZeroSousEau',
    'uOceanShallow', 'uOceanMid', 'uOceanDeep',
    'uCropOn', 'uHabOn', 'uCoastMaskOn', 'uMargeCoteM',
    'uAnalysisOn', 'uTexShade', 'uWetK', 'uExpoK', 'uHemi', 'uTreeLine',
    'uRampCropOn', 'uHeightContrast', 'uHeightPivot',
    'uHazeAmt', 'uHazeAlt', 'uHazeDist', 'uHazeColor',
    'uSlopeTint', 'uEclairageOn', 'uNormaleFineOn', 'uReliefMondeGain',
    'uPhotoOn', 'uPhotoMonde', 'uPhotoFonduMer',
    'uAerialOn', 'uAerialOpacity', 'uAerialCoastFade',
    'uSolOn', 'uSolOpacite', 'uGrainForceM', 'uGrainEchelle',
    'uContourOpacity', 'uGridOpacity', 'uSurfaceFx', 'uAlbedoBase', 'uAlbedoTeinte',
  ]
  const uniformes = {}
  for (const n of NOMS) uniformes[n] = val(n)

  // ── la table 1D du globe (CanvasTexture 512×1)
  let ramp1D = null
  const t1 = u.uRamp?.value
  if (t1?.image) {
    try {
      const cv = t1.image
      const ctx = cv.getContext('2d')
      const d = ctx.getImageData(0, 0, cv.width, 1).data
      ramp1D = { largeur: cv.width, px: Array.from(d) }
    } catch (err) { ramp1D = { erreur: String(err).slice(0, 120) } }
  }
  // ── la table 2D du socle (DataTexture RGBA, flipY = false)
  let ramp2D = null
  const t2 = u.uRampCrop?.value
  if (t2?.image?.data) {
    ramp2D = { largeur: t2.image.width, hauteur: t2.image.height, px: Array.from(t2.image.data) }
  }

  const P = window.__palierMachine || {}
  return {
    uniformes,
    ramp1D,
    ramp2D,
    scene: {
      mode: e.modes?.mode,
      altM: e.modes?.altM,
      crop: !!e.globe._crop,
      rampeMesuree: e.globe._rampe || null,
      lat: e.params?.lat, lon: e.params?.lon, zoom: e.params?.zoom,
      colorMode: e.params?.colorMode,
      heightContrastParam: e.params?.heightContrast,
      heightPivotParam: e.params?.heightPivot,
      shadeAuto: e.params?.shadeAuto,
    },
    palier: {
      palier: P.palier, nom: P.nom, ombres: P.ombres, grain: P.grain,
      ecran: P.signaux?.ecran, pixelRatio: e.renderer?.getPixelRatio?.(),
    },
  }
}

// ══════════ LA LOI DU NUANCEUR, REJOUÉE EN JS ═══════════════════════════════
//
// ⛔ **TRANSCRIPTION, PAS RÉÉCRITURE.** Chaque ligne cite celle de `globe.js`
// qu'elle rejoue. Une divergence ici invaliderait tout ce que le script dit.
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

function lire1D(ramp, t) {
  const n = ramp.largeur
  const x = Math.min(n - 1, Math.max(0, Math.round(clamp01(t) * (n - 1))))
  return [ramp.px[x * 4], ramp.px[x * 4 + 1], ramp.px[x * 4 + 2]]
}
function lire2D(ramp, x01, y01) {
  const W = ramp.largeur
  const H = ramp.hauteur
  const x = Math.min(W - 1, Math.max(0, Math.round(clamp01(x01) * (W - 1))))
  const y = Math.min(H - 1, Math.max(0, Math.round(clamp01(y01) * (H - 1))))
  const i = (y * W + x) * 4
  return [ramp.px[i], ramp.px[i + 1], ramp.px[i + 2]]
}

function loi(h, U) {
  // globe.js — `bool sousEau = uMerZeroSousEau > 0.5 ? h <= 0.0 : h < 0.0;`
  const sousEau = U.uMerZeroSousEau > 0.5 ? h <= 0 : h < 0
  // globe.js — `float hNorm = clamp((h - uLandBas) / max(uLandMax - uLandBas, uPlancherRampeM), 0., 1.);`
  const hNorm = clamp01((h - U.uLandBas) / Math.max(U.uLandMax - U.uLandBas, U.uPlancherRampeM))
  // globe.js — `float t = sousEau ? 0.35 * (1. - clamp(-h / max(uOceanDepth, …))) : 0.35 + 0.65 * hNorm;`
  const t = sousEau
    ? 0.35 * (1 - clamp01(-h / Math.max(U.uOceanDepth, U.uPlancherRampeM)))
    : 0.35 + 0.65 * hNorm
  // globe.js — `float hNormRelief = clamp((h - uReliefBas) / max(uLandMax - uReliefBas, uPlancherRampeM), 0., 1.);`
  const hNormRelief = clamp01((h - U.uReliefBas) / Math.max(U.uLandMax - U.uReliefBas, U.uPlancherRampeM))
  // naturel-crop.js — natPlancherPivot / natRampT
  const hNormMer = (0 - U.uReliefBas) / Math.max(U.uLandMax - U.uReliefBas, U.uPlancherRampeM)
  const pivot = Math.max(U.uHeightPivot, Math.min(Math.max(hNormMer, 0), 0.95) + 0.02)
  const rampT = clamp01(0.5 + (hNormRelief - pivot) * U.uHeightContrast)
  // le voile aérien, au centre du crop (fd = 0) et au bord (fd = 1)
  const fa = 1 - smoothstep(0, Math.max(U.uHazeAlt, 1e-3), hNormRelief)
  const voile0 = Math.min(0.9, Math.max(0, U.uHazeAmt * (0.6 * fa + U.uHazeDist * 0)))
  return { sousEau, hNorm, t, hNormRelief, hNormMer, pivot, rampT, voile0 }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })

const LIEUX = [
  { nom: 'borneo-z10', lat: 5.98, lon: 116.07, zoom: 10 },
  { nom: 'reunion-z12', lat: -21.115, lon: 55.536, zoom: 12 },
]

const rapport = { port: PORT, quand: new Date().toISOString(), lieux: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('shibumap-ui-advanced', '1')
      localStorage.setItem('shibumap-workmode', 'studio')
    } catch {}
  })
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
    await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'DIAG R28'), L)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
    await dodo(6000)
    const r = await page.evaluate(releverColorisation)
    if (r.erreur) { console.log(L.nom, 'ERREUR', r.erreur); continue }
    const U = r.uniformes
    const ligne = { ...L, scene: r.scene, palier: r.palier, uniformes: U, etages: [] }

    // ── le balayage d'altitudes
    const HS = []
    for (let h = -400; h <= 3200; h += 10) HS.push(h)
    for (const h of HS) {
      const s = loi(h, U)
      const col1D = r.ramp1D ? lire1D(r.ramp1D, s.t) : null
      const col2D = r.ramp2D && U.uRampCropOn > 0.5 && !s.sousEau
        ? lire2D(r.ramp2D, s.rampT, 0.5) : null
      ligne.etages.push({ h, ...s, col1D, col2D })
    }

    // ── LA BANDE SE DÉSIGNE : l'intervalle d'altitudes de TERRE où `rampT` est
    //    saturé à 0 (donc où la table rend son PREMIER texel, une seule couleur)
    const terre = ligne.etages.filter((x) => !x.sousEau)
    const plat0 = terre.filter((x) => x.rampT <= 1e-6)
    const plat1 = terre.filter((x) => x.rampT >= 1 - 1e-6)
    ligne.bande = {
      rampT0_de: plat0.length ? plat0[0].h : null,
      rampT0_a: plat0.length ? plat0[plat0.length - 1].h : null,
      rampT0_pixels: plat0.length,
      rampT1_de: plat1.length ? plat1[0].h : null,
      couleurPlat0: plat0.length ? plat0[0].col2D : null,
      // la même mesure sur la table 1D, pour départager les deux tables
      t_a_0m: terre.length ? terre.find((x) => x.h === 0)?.t : null,
      col1D_a_0m: terre.length ? terre.find((x) => x.h === 0)?.col1D : null,
    }
    rapport.lieux.push(ligne)
    console.log(
      `\n[${L.nom}] mode=${r.scene.mode} alt=${Math.round(r.scene.altM)} m crop=${r.scene.crop}`
      + ` | uRampCropOn=${U.uRampCropOn} contraste=${U.uHeightContrast} pivot=${U.uHeightPivot}`
      + ` | uReliefBas=${U.uReliefBas?.toFixed?.(1)} uLandBas=${U.uLandBas?.toFixed?.(1)} uLandMax=${U.uLandMax?.toFixed?.(1)}`
      + ` | uAnalysisOn=${U.uAnalysisOn} uTexShade=${U.uTexShade} uHazeAmt=${U.uHazeAmt} uSlopeTint=${U.uSlopeTint}`
      + ` | uPhotoMonde=${U.uPhotoMonde} uAerialOn=${U.uAerialOn}`
    )
    console.log(`   hNormMer=${loi(0, U).hNormMer.toFixed(4)} pivot effectif=${loi(0, U).pivot.toFixed(4)}`)
    console.log(`   BANDE PLATE (rampT = 0) : de ${ligne.bande.rampT0_de} m à ${ligne.bande.rampT0_a} m`
      + ` — couleur ${JSON.stringify(ligne.bande.couleurPlat0)}`)
    console.log(`   rampT sature en haut à partir de ${ligne.bande.rampT1_de} m`)
    console.log(`   table 1D à 0 m : t=${ligne.bande.t_a_0m} → ${JSON.stringify(ligne.bande.col1D_a_0m)}`)
    for (const h of [0, 50, 100, 200, 300, 500, 800, 1200, 2000]) {
      const x = ligne.etages.find((y) => y.h === h)
      if (x) console.log(`     h=${String(h).padStart(5)} m  hNormRelief=${x.hNormRelief.toFixed(4)}  rampT=${x.rampT.toFixed(4)}  2D=${JSON.stringify(x.col2D)}  1D=${JSON.stringify(x.col1D)}`)
    }
  }
  rapport.erreurs = erreurs
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, 'bande.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'bande.json'))
