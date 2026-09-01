// DIAG R28 — LES FUITES DU CROP SUR LA PLANÈTE, CHACUNE FAITE DE SE DÉSIGNER
//
// ⚡ **LA MANŒUVRE DE R21, APPLIQUÉE À LA COLORISATION.** Une bande de côte est
// trop fine pour une moyenne d'image (constat ① de l'inventaire). On ne la
// cherche donc pas : on la fait SE DÉSIGNER. Deux images au même instant, même
// page, même scène ; dans la seconde, l'uniforme suspect prend la valeur du
// MONDE au lieu de celle du CROP. **Tout pixel qui diffère EST un pixel peint
// par le régime du crop**, par construction — rien d'autre ne change.
//
// ⚠️ **ET UN TÉMOIN NUL PASSE EN PREMIER** : la même bascule avec la MÊME valeur
// doit rendre exactement zéro pixel. Sans lui, l'instrument peut fabriquer sa
// propre différence et rien de ce qu'il dit ne vaut.
//
// ⚠️ **PLEINE RÉSOLUTION** (1 280 × 800), moyenne courante sur N images, tout le
// calcul dans la page. Un condensé annulerait le motif fin qu'on mesure.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5911'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R28'))
const IMAGES = Number(opt('--images', '6'))
const REPOS = Number(opt('--repos', '700'))
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
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable')
  process.exit(2)
}

function poserInstrumentPlein() {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__pp && window.__pp.capturer) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const W = CV.width
  const H = CV.height
  const px = new Uint8Array(W * H * 4)
  const etat = { W, H, n: 0, slots: {} }
  window.__pp = etat
  let acc = null
  let nAcc = 0
  function lire() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    R.resetState?.()
    if (!acc) acc = new Float32Array(W * H * 3)
    for (let i = 0, j = 0; i < W * H; i++) { acc[j++] += px[i * 4]; acc[j++] += px[i * 4 + 1]; acc[j++] += px[i * 4 + 2] }
    nAcc++
    etat.n++
  }
  function boucle() {
    try { lire() } catch (err) { etat.erreur = String(err).slice(0, 140) }
    requestAnimationFrame(boucle)
  }
  etat.vider = () => { acc = null; nAcc = 0; etat.n = 0 }
  etat.pret = (k) => nAcc >= k
  etat.capturer = (nom) => {
    const m = new Float32Array(W * H * 3)
    for (let i = 0; i < W * H * 3; i++) m[i] = acc[i] / nAcc
    etat.slots[nom] = m
    return nAcc
  }
  etat.comparer = (a, b, seuil) => {
    const A = etat.slots[a]
    const B = etat.slots[b]
    if (!A || !B) return null
    const S = seuil ?? 1
    let somme = 0, n = 0, sommeSurChanges = 0, pire = 0
    let xmin = 1e9, xmax = -1, ymin = 1e9, ymax = -1, sx = 0, sy = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 3
        const d = Math.abs(A[j] - B[j]) + Math.abs(A[j + 1] - B[j + 1]) + Math.abs(A[j + 2] - B[j + 2])
        somme += d / 3
        if (d > pire) pire = d
        if (d > S) {
          n++; sommeSurChanges += d / 3; sx += x; sy += y
          if (x < xmin) xmin = x
          if (x > xmax) xmax = x
          if (y < ymin) ymin = y
          if (y > ymax) ymax = y
        }
      }
    }
    return {
      moyImage: somme / (W * H), pire, pixels: n, partImage: n / (W * H),
      moySurPixelsChanges: n ? sommeSurChanges / n : 0,
      centre: n ? [Math.round(sx / n), Math.round(sy / n)] : null,
      boite: n ? [xmin, ymin, xmax, ymax] : null, taille: [W, H],
    }
  }
  // ⚠️ **L'ÉCART-TYPE DE LUMINANCE, SUR TOUTE L'IMAGE** — c'est la grandeur qui
  // dit « il y a du MODELÉ » là où une moyenne ne dit que « il y a une couleur ».
  etat.ecartType = (a) => {
    const A = etat.slots[a]
    if (!A) return null
    let s = 0, s2 = 0
    const N = W * H
    for (let i = 0; i < N; i++) {
      const j = i * 3
      const l = 0.299 * A[j] + 0.587 * A[j + 1] + 0.114 * A[j + 2]
      s += l; s2 += l * l
    }
    const m = s / N
    return { moy: m, sigma: Math.sqrt(Math.max(0, s2 / N - m * m)) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
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
  { nom: 'reunion-z9', lat: -21.115, lon: 55.536, zoom: 9 },
  { nom: 'reunion-z12', lat: -21.115, lon: 55.536, zoom: 12 },
]
// ⚠️ **LES VALEURS DU MONDE VIENNENT DE `RAMPE_MONDE` / `GRADE_MONDE`**, lues
// dans le module, jamais recopiées : un littéral jumeau diverge en silence.
const rapport = { port: PORT, quand: new Date().toISOString(), images: IMAGES, mesures: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 180)) })
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('shibumap-ui-advanced', '1')
      localStorage.setItem('shibumap-workmode', 'studio')
    } catch {}
  })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  await page.evaluate(() => { document.body.classList.add('ce-railL-off', 'ce-railR-off') })
  await page.evaluate(poserInstrumentPlein)
  await page.evaluate(() => { window.__exp.params.animations = false })

  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  // ⚠️ le monde vient du module, pas d'un littéral
  const MONDE = await page.evaluate(async () => {
    const m = await import('/src/monde/rampe-crop.js')
    return {
      reliefBas: m.RAMPE_MONDE.terreBas - m.RAMPE_MONDE.creux,
      landMax: m.RAMPE_MONDE.terreHaut,
      profondeur: m.RAMPE_MONDE.profondeur,
      pivot: m.GRADE_MONDE.heightPivot,
      contraste: m.GRADE_MONDE.heightContrast,
    }
  })
  rapport.monde = MONDE
  console.log('pilote :', rapport.gpu)
  console.log('monde  :', JSON.stringify(MONDE))

  const releve = async (nom) => {
    await page.evaluate(() => window.__pp.vider())
    await page.waitForFunction((n) => window.__pp.pret(n), { polling: 30, timeout: 60000 }, IMAGES)
    return page.evaluate((n) => window.__pp.capturer(n), nom)
  }
  const comparer = (a, b) => page.evaluate((x, y) => window.__pp.comparer(x, y, 1), a, b)
  // ⛔ **ET IL FAUT GELER `_poserUniformesRampe`, SINON LA BASCULE NE TIENT PAS
  // UNE IMAGE.** Premier tour du banc : `ancres-monde` et `mer-monde` ont rendu
  // **0 pixel** sur les deux lieux — pas parce que ces uniformes ne peignent
  // rien, mais parce que `majEchelleRampe` (l'échelle continue, Tâche K bis) les
  // RÉÉCRIT à chaque image depuis la mesure du crop. Un banc qui pousse une
  // valeur qu'un autre écrivain repose soixante fois par seconde mesure zéro et
  // se croit concluant : c'est un faux ⛔, exactement la classe que
  // `lecons-campagne-R.md` §③ nomme.
  const poser = (paires) => page.evaluate((p) => {
    const g = window.__exp.globe
    const u = g.uniforms
    const avant = {}
    for (const [n, v] of Object.entries(p)) { avant[n] = u[n].value; u[n].value = v }
    if (!g.__gelRampe) {
      g.__gelRampe = g._poserUniformesRampe
      g._poserUniformesRampe = () => {}
    }
    return avant
  }, paires)
  const degeler = () => page.evaluate(() => {
    const g = window.__exp.globe
    if (g.__gelRampe) { g._poserUniformesRampe = g.__gelRampe; g.__gelRampe = null }
  })

  for (const L of LIEUX) {
    await page.evaluate((a) => window.__exp.modes._rescale({ lat: a.lat, lon: a.lon, zoom: a.zoom }, 'DIAG R28'), L)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 60000 }).catch(() => {})
    await dodo(6000)

    const U0 = await page.evaluate(() => {
      const u = window.__exp.globe.uniforms
      const P = window.__palierMachine || {}
      return {
        uHeightPivot: u.uHeightPivot.value, uHeightContrast: u.uHeightContrast.value,
        uReliefBas: u.uReliefBas.value, uLandMax: u.uLandMax.value,
        uMerFondBudgetM: u.uMerFondBudgetM.value, uHazeAmt: u.uHazeAmt.value,
        uOceanDepth: u.uOceanDepth.value, uTexShade: u.uTexShade.value,
        palier: P.palier, palierNom: P.nom, ombres: P.ombres, grain: P.grain,
        ecranPalier: P.signaux?.ecran, pixelRatio: window.__exp.renderer.getPixelRatio(),
        altM: window.__exp.modes.altM, mode: window.__exp.modes.mode,
      }
    })

    const essai = async (nom, paires) => {
      await releve('A')
      const avant = await poser(paires)
      await dodo(REPOS)
      await releve('B')
      const d = await comparer('A', 'B')
      const sA = await page.evaluate(() => window.__pp.ecartType('A'))
      const sB = await page.evaluate(() => window.__pp.ecartType('B'))
      await poser(avant)
      await degeler()
      await dodo(REPOS)
      await releve('C')
      const retour = await comparer('A', 'C')
      const ligne = { lieu: L.nom, nom, paires, avant, d, retour, sigmaAvant: sA, sigmaApres: sB, machine: U0 }
      rapport.mesures.push(ligne)
      console.log(
        `[${L.nom}/${nom}] pixels = ${d.pixels} (${(d.partImage * 100).toFixed(2)} %)`
        + ` · écart moyen SUR EUX = ${d.moySurPixelsChanges.toFixed(2)}/255`
        + ` · image entière = ${d.moyImage.toFixed(3)} · pire = ${d.pire.toFixed(0)}`
        + ` · σ ${sA.sigma.toFixed(2)} → ${sB.sigma.toFixed(2)} (moy ${sA.moy.toFixed(1)} → ${sB.moy.toFixed(1)})`
        + ` · retour A/C = ${retour.pixels} px`
      )
      return ligne
    }

    // ① LE TÉMOIN — la même valeur, donc zéro pixel, sinon rien ne vaut
    //
    // ⛔ **ET ON REDEMANDE JUSQU'À CE QU'IL SOIT NUL.** Premier tour du banc :
    // 50 416 pixels au témoin de Bornéo, retour A/C à 74 761 — la scène chargeait
    // encore. Toute mesure prise là-dessus aurait mélangé la bascule et l'arrivée
    // des tuiles. Le témoin n'est pas une formalité : il est la porte.
    let t = await essai('temoin-nul', { uHeightPivot: U0.uHeightPivot })
    for (let k = 0; k < 6 && (t.d.pixels > 0 || t.retour.pixels > 0); k++) {
      await dodo(5000)
      t = await essai('temoin-nul', { uHeightPivot: U0.uHeightPivot })
    }
    if (t.d.pixels > 0 || t.retour.pixels > 0) {
      console.log(`   ⛔ ${L.nom} : la scène ne se stabilise pas, les mesures qui suivent ne valent rien`)
    }
    // ② LA LOI DE RAMPE : le grade du crop → le grade du MONDE
    await essai('grade-monde', { uHeightPivot: MONDE.pivot, uHeightContrast: MONDE.contraste })
    // ③ LES ANCRES : les bornes du crop → celles du MONDE
    await essai('ancres-monde', { uReliefBas: MONDE.reliefBas, uLandMax: MONDE.landMax })
    // ④ LES DEUX ENSEMBLE — c'est le régime complet du monde
    await essai('regime-monde', {
      uHeightPivot: MONDE.pivot, uHeightContrast: MONDE.contraste,
      uReliefBas: MONDE.reliefBas, uLandMax: MONDE.landMax,
    })
    // ⑤ LE BUDGET DU FOND MARIN : celui du crop → celui du monde
    await essai('mer-monde', { uMerFondBudgetM: MONDE.profondeur, uOceanDepth: MONDE.profondeur })
    // ⑥ LE VOILE AÉRIEN, qui lit fd = length(qCrop) — donc 1 hors du crop
    await essai('voile-eteint', { uHazeAmt: 0 })
    // ⑦ LE PEIGNE : ce qu'il fait AUJOURD'HUI (donc dans le crop seul)
    await essai('peigne-eteint', { uTexShade: 0 })
  }
  rapport.erreurs = erreurs
  if (erreurs.length) console.log('\n⚠️ erreurs de page :', erreurs.slice(0, 8))
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, 'fuites.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'fuites.json'))
