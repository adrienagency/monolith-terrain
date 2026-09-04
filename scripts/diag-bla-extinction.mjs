// DIAG BLA — LE TERRAIN BLANCHIT AU ZOOM FIN (mode Naturel) : DÉPARTAGE PAR
// EXTINCTION, UN UNIFORME À LA FOIS, DANS LA MÊME SESSION.
//
// Trois candidats (brief-BLA) : ① la perspective aérienne (uHazeAmt), ② la
// limite des arbres / l'humidité (uTreeLine, uWetK, uExpoK), ③ l'éclairage.
// On mesure d'abord le TÉMOIN (deux captures sans rien changer), puis chaque
// extinction, et on lit la luminance et la chroma moyennes d'une fenêtre
// centrale — par DIFFÉRENCE avec la capture « tel quel ».
//
// ⚠️ La lecture des pixels passe par la CAPTURE D'ÉCRAN (puppeteer), pas par
// readPixels ni drawImage (pieges-communs.md : ils rendent 0 sous composer).
// Le PNG est décodé DANS la page (Image + canvas 2D), donc sans dépendance.
//
// Usage : node scripts/diag-bla-extinction.mjs --port 9711 --etiquette avant
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '9711'))
const ETIQUETTE = opt('--etiquette', 'avant')
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/BLA', ETIQUETTE))
const ZOOMS = (opt('--zooms', '9,11,13')).split(',').map(Number)
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// Le lieu de la vidéo d'Adrien (mission-2026-09-05.md)
const LIEU = { lat: 44.2, lon: 5.78 }
// Les curseurs de la vidéo (panneau Terrain, image m_010)
const CURSEURS = { texShade: 0.98, wetK: 0.88, expoK: 1, treeLine: 0.99, hazeAmt: 0.68, rampDry: 1, rampWet: 1 }

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ── dans la page ────────────────────────────────────────────────────────────
function relever() {
  const e = window.__exp
  const m = e.terrain.mapUniforms
  const u = e.globe.uniforms
  const hr = m.uHeightRange.value
  return {
    scene: { altM: e.modes.altM, zoom: e.params.zoom, mode: e.modes.mode, crop: !!e.globe._crop, busy: e.modes.busy },
    params: { colorMode: e.params.colorMode, texShade: e.params.texShade, wetK: e.params.wetK, expoK: e.params.expoK, treeLine: e.params.treeLine, hazeAmt: e.params.hazeAmt, hazeAlt: e.params.hazeAlt, hazeDist: e.params.hazeDist, hazeColor: e.params.hazeColor, heightPivot: e.params.heightPivot, heightContrast: e.params.heightContrast, mapTint: e.params.mapTint, rampeRenormalise: e.params.rampeRenormalise },
    socle: {
      heightRange: [hr.x, hr.y], colorMode: m.uColorMode.value,
      hazeAmt: m.uHazeAmt.value, hazeAlt: m.uHazeAlt.value, hazeDist: m.uHazeDist.value,
      treeLine: m.uTreeLine.value, wetK: m.uWetK.value, expoK: m.uExpoK.value, texShade: m.uTexShade.value,
      pivot: m.uHeightPivot.value, contraste: m.uHeightContrast.value, tint: m.uTint.value,
      visible: e.terrain.mesh?.visible ?? null,
    },
    globe: {
      reliefBas: u.uReliefBas.value, landMax: u.uLandMax.value, landBas: u.uLandBas.value,
      hazeAmt: u.uHazeAmt.value, hazeAlt: u.uHazeAlt.value, hazeDist: u.uHazeDist.value,
      treeLine: u.uTreeLine.value, wetK: u.uWetK.value, expoK: u.uExpoK.value, texShade: u.uTexShade.value,
      rampCropOn: u.uRampCropOn.value, analysisOn: u.uAnalysisOn.value,
      pivot: u.uHeightPivot.value, contraste: u.uHeightContrast.value,
      // Tâche BLA — absents AVANT le correctif (null), c'est normal
      hNormRefA: u.uHNormRefA?.value ?? null, hNormRefB: u.uHNormRefB?.value ?? null,
      fdFacteur: u.uFdFacteur?.value ?? null, cropDemiM: u.uCropDemiM?.value ?? null,
    },
    socleRef: {
      hNormRefA: m.uHNormRefA?.value ?? null, hNormRefB: m.uHNormRefB?.value ?? null, fdFacteur: m.uFdFacteur?.value ?? null,
    },
    dem: e.dem ? { minM: e.dem.minM, maxM: e.dem.maxM, extentMeters: e.dem.extentMeters } : null,
    frontiere: typeof e.frontiereActive === 'function' ? e.frontiereActive() : e.frontiereActive,
    veilleSocle: e.veilleSocle ? { auSeuil: e.veilleSocle.auSeuil } : null,
  }
}

// décode un PNG (base64) dans la page et mesure la fenêtre centrale
async function mesurerPng(b64, fen) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0)
  const x0 = Math.round(c.width * fen.x0), x1 = Math.round(c.width * fen.x1)
  const y0 = Math.round(c.height * fen.y0), y1 = Math.round(c.height * fen.y1)
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let L = 0, C = 0, R = 0, G = 0, B = 0, n = 0
  const pix = new Float32Array((x1 - x0) * (y1 - y0) * 3)
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2]
    L += 0.2126 * r + 0.7152 * gg + 0.0722 * b
    C += Math.max(r, gg, b) - Math.min(r, gg, b)
    R += r; G += gg; B += b
    pix[n * 3] = r; pix[n * 3 + 1] = gg; pix[n * 3 + 2] = b
    n++
  }
  window.__bla = window.__bla || {}
  return { lum: L / n, chroma: C / n, rgb: [R / n, G / n, B / n], n, w: x1 - x0, h: y1 - y0 }
}

const FENETRE = { x0: 0.32, x1: 0.68, y0: 0.28, y1: 0.72 }

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { quand: new Date().toISOString(), etiquette: ETIQUETTE, lieu: LIEU, curseurs: CURSEURS, fenetre: FENETRE, crans: [] }

async function capture(page, nom) {
  const b64 = await page.screenshot({ encoding: 'base64' })
  fs.writeFileSync(path.join(SORTIE, nom + '.png'), Buffer.from(b64, 'base64'))
  const m = await page.evaluate(mesurerPng, b64, FENETRE)
  return m
}
async function attendreRepos(page) {
  await page.waitForFunction(() => {
    const e = window.__exp
    const g = e.globe
    return !e.modes.busy && !e.modes.travel && (!g || g.tuilesEnVol() === 0)
  }, { polling: 250, timeout: 120000 }).catch(() => {})
  await dodo(7000)
}
// pose les curseurs de la vidéo par le MÊME chemin que le panneau (setColorParam)
function poserCurseurs(c) {
  const e = window.__exp
  Object.assign(e.params, c)
  e.terrain.applyColorParams(e.params)
  e.terrain.rebuildRamp(e.params)
  e.blockGrid?.restyle(e.params)
}

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.terrain, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  // animations coupées : le témoin doit bouger le moins possible
  await page.evaluate(() => { window.__exp.params.animations = false })
  await page.evaluate(poserCurseurs, CURSEURS)

  for (const z of ZOOMS) {
    console.log(`\n═══ z${z} ═══`)
    await page.evaluate((a) => window.__exp.modes.flyTo(a.lat, a.lon, a.zoom), { ...LIEU, zoom: z })
    await dodo(2000)
    await attendreRepos(page)
    await page.evaluate(poserCurseurs, CURSEURS)
    await dodo(1500)
    const etat = await page.evaluate(relever)
    await page.evaluate(() => { window.__exp.__blaSocleVisible = window.__exp.terrain.mesh?.visible })
    const cran = { zoom: z, etat, mesures: {} }
    const tel = await capture(page, `z${z}-A-tel-quel`)
    cran.mesures['A-tel-quel'] = tel
    cran.mesures['A2-temoin'] = await capture(page, `z${z}-A2-temoin`)

    const essais = [
      // ① la perspective aérienne — socle (params + uniformes, chemin du panneau)
      ['B-haze0', (e) => { e.params.hazeAmt = 0; e.terrain.applyColorParams(e.params); e.blockGrid?.restyle(e.params) }],
      // ② humidité + exposition
      ['C-wet0-expo0', (e) => { e.params.wetK = 0; e.params.expoK = 0; e.terrain.applyColorParams(e.params); e.blockGrid?.restyle(e.params) }],
      // ② bis la limite des arbres au plancher
      ['D-treeLine02', (e) => { e.params.treeLine = 0.2; e.terrain.applyColorParams(e.params); e.blockGrid?.restyle(e.params) }],
      // ③ le peigné / l'ombrage cuit
      ['E-texShade0', (e) => { e.params.texShade = 0; e.terrain.applyColorParams(e.params); e.blockGrid?.restyle(e.params) }],
      // ①′ le voile du globe SEUL (sans toucher au socle) — dit QUI peint
      ['F-globe-haze0', (e) => { e.globe.uniforms.uHazeAmt.value = 0 }],
      // le socle caché — dit QUI peint
      ['G-socle-cache', (e) => { if (e.terrain.mesh) e.terrain.mesh.visible = false }],
    ]
    for (const [nom, fn] of essais) {
      await page.evaluate((src) => (0, eval)(src)(window.__exp), fn.toString())
      await dodo(1200)
      const apres = await page.evaluate(relever)
      cran.mesures[nom] = await capture(page, `z${z}-${nom}`)
      cran.mesures[nom].uniformes = { socleHaze: apres.socle.hazeAmt, globeHaze: apres.globe.hazeAmt, socleVisible: apres.socle.visible, treeLine: apres.socle.treeLine, wetK: apres.socle.wetK, texShade: apres.socle.texShade }
      // restauration
      await page.evaluate((c) => {
        const e = window.__exp
        // ⚠️ on rend la visibilité D'AVANT (le socle est caché sous le crop),
        // pas `true` : une première rédaction le rallumait par erreur
        if (e.terrain.mesh) e.terrain.mesh.visible = e.__blaSocleVisible ?? e.terrain.mesh.visible
        Object.assign(e.params, c)
        e.terrain.applyColorParams(e.params)
        e.blockGrid?.restyle(e.params)
        e.globe.uniforms.uHazeAmt.value = c.hazeAmt
      }, CURSEURS)
      await dodo(800)
    }
    cran.mesures['H-retour'] = await capture(page, `z${z}-H-retour`)
    rapport.crans.push(cran)

    const S = etat.socle, G = etat.globe, D = etat.dem
    console.log(`alt=${Math.round(etat.scene.altM)} m mode=${etat.scene.mode} crop=${etat.scene.crop} colorMode=${etat.params.colorMode} socleVisible=${S.visible}`)
    console.log(`SOCLE uHeightRange=[${S.heightRange[0].toFixed(2)} ; ${S.heightRange[1].toFixed(2)}] dem=[${D?.minM?.toFixed(1)} ; ${D?.maxM?.toFixed(1)}] m extent=${D?.extentMeters?.toFixed(0)} m · haze=${S.hazeAmt} alt=${S.hazeAlt} dist=${S.hazeDist} treeLine=${S.treeLine} pivot=${S.pivot?.toFixed(3)} contraste=${S.contraste?.toFixed(3)}`)
    console.log(`GLOBE [${G.reliefBas.toFixed(1)} ; ${G.landMax.toFixed(1)}] haze=${G.hazeAmt} treeLine=${G.treeLine} rampCropOn=${G.rampCropOn} analysisOn=${G.analysisOn}`)
    for (const [k, m] of Object.entries(cran.mesures)) {
      const dl = m.lum - tel.lum, dc = m.chroma - tel.chroma
      console.log(`  ${k.padEnd(16)} lum=${m.lum.toFixed(1)} chroma=${m.chroma.toFixed(1)} rgb=(${m.rgb.map((v) => v.toFixed(0)).join(',')})  Δlum=${dl >= 0 ? '+' : ''}${dl.toFixed(1)} Δchroma=${dc >= 0 ? '+' : ''}${dc.toFixed(1)}${m.uniformes ? '  ' + JSON.stringify(m.uniformes) : ''}`)
    }
  }
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, 'extinction.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'extinction.json'))
