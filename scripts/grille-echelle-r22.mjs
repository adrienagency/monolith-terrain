// L'ÉCHELLE DE LA GRILLE, VÉRIFIÉE SUR DES PIXELS — Tâche R22.
//
// ⚠️ **LE BRIEF L'EXIGE EN CES TERMES : « vérifie la grille contre une distance
// connue au sol (un méridien, une échelle), pas à l'œil ».** L'arithmétique est
// tenue par `test/grille-crop.test.js` ; ce script-ci va chercher le CARROYAGE
// LUI-MÊME dans l'image et compte ses lignes.
//
// ══════════ CE QU'IL MESURE, ET POURQUOI C'EST FALSIFIABLE ═════════════════
//
// On isole la grille par DIFFÉRENCE : deux captures pleine résolution, opacité 0
// puis opacité 1, tout le reste identique. `|B − A|` ne contient plus QUE la
// grille — ni relief, ni courbes, ni mer. On compte ensuite ses pics le long de
// bandes de balayage horizontales.
//
// ⚡ **LA PRÉDICTION EST CALCULÉE AVANT, PAS APRÈS.** La caméra du cadrage
// d'ouverture est à (88, 72, 88) et vise l'origine : sa direction de vue en plan
// est (−1, 0, −1)/√2, donc le « vers la droite de l'écran » en plan est
// (1, 0, −1)/√2 — la DIAGONALE du bloc. Une ligne de balayage horizontale
// traverse donc les DEUX familles de lignes, et le nombre de croisements sur la
// largeur entière du bloc vaut
//
//     N = span / gridStep  (famille X)  +  span / gridStep  (famille Z)
//       = 2 × 56 / gridStep
//
// soit **22,4 pour gridStep = 5** et **56 pour gridStep = 2**. Un carroyage qui
// aurait raté sa conversion d'un facteur 18 (le piège de l'exagération) rendrait
// 403 pics, et un carroyage qui aurait oublié le facteur 28 en rendrait UN.
// ⚠️ La bande de balayage ne traverse pas toujours le bloc de bout en bout (le
// relief et la mer mangent les bords) : on publie donc le compte MESURÉ, le
// compte PRÉDIT, et surtout le RAPPORT entre les deux réglages, qui, lui, ne
// dépend d'aucune géométrie de cadrage.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const PORT = Number(opt('--port', '5731'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R22'))
const IMAGES = Number(opt('--images', '6'))

function trouverChrome() {
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable.'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// L'instrument : une capture PLEINE RÉSOLUTION du tampon de dessin, moyennée.
function poserLecteur() {
  const e = window.__exp
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const W = CV.width, H = CV.height
  const px = new Uint8Array(W * H * 4)
  const etat = { W, H }
  window.__gr = etat
  etat.moyenne = (k) => new Promise((resolve) => {
    const somme = new Float32Array(W * H)
    let n = 0
    const tour = () => {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
      R.resetState?.()
      for (let i = 0; i < W * H; i++) {
        somme[i] += 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
      }
      if (++n >= k) { for (let i = 0; i < W * H; i++) somme[i] /= n; resolve(Array.from(somme)) }
      else requestAnimationFrame(tour)
    }
    requestAnimationFrame(tour)
  })
  return { W, H }
}

function poseParLabel(nom, v) {
  const nomDe = (r) => {
    const lab = r.querySelector('.ce-label')
    return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
  }
  for (const r of document.querySelectorAll('.ce-row')) {
    if (nomDe(r) !== nom) continue
    const rng = r.querySelector('input[type=range]')
    if (!rng) return 'pas un curseur'
    rng.value = String(v)
    rng.dispatchEvent(new Event('input', { bubbles: true }))
    rng.dispatchEvent(new Event('change', { bubbles: true }))
    return rng.value
  }
  return 'absent'
}

// ══════════ LE COMPTAGE DES PICS ═══════════════════════════════════════════
//
// ⚠️ **UNE BANDE, PAS UNE LIGNE.** Un seul rang de pixels attrape le bruit de
// quantification ; on moyenne 9 rangs, ce qui n'efface PAS le motif (les lignes
// de grille sont quasi verticales à l'écran, donc elles survivent à une moyenne
// verticale) mais divise le bruit par trois.
//
// ⚠️ **LE SEUIL SE DÉRIVE DU SIGNAL, IL NE SE POSE PAS.** On prend la moitié du
// maximum de la bande : un seuil absolu aurait compté d'autant plus de pics que
// la grille est sombre, et le verdict aurait dépendu de la palette.
function compterPics(diff, W, H, y0, hauteurBande) {
  const bande = new Float64Array(W)
  for (let x = 0; x < W; x++) {
    let s = 0
    for (let y = y0; y < y0 + hauteurBande; y++) s += diff[y * W + x]
    bande[x] = s / hauteurBande
  }
  let max = 0
  for (let x = 0; x < W; x++) if (bande[x] > max) max = bande[x]
  if (max < 2) return { pics: 0, max, premier: null, dernier: null, periodePx: null }
  const seuil = max * 0.5
  let pics = 0, dedans = false, premier = null, dernier = null
  for (let x = 0; x < W; x++) {
    if (bande[x] >= seuil) {
      if (!dedans) { pics++; dedans = true; if (premier === null) premier = x }
      dernier = x
    } else dedans = false
  }
  // ══════ LA PÉRIODE, ET C'EST ELLE QUI DÉCIDE ═════════════════════════════
  //
  // ⛔ **LE COMPTAGE DE PICS EST UN INSTRUMENT MÉDIOCRE ICI, ET IL FAUT LE
  // DIRE : mesuré, il rend 20 / 17 / 11 pics sur trois bandes du MÊME état.**
  // En vue de trois quarts, les lignes du fond de bloc se resserrent par
  // perspective et FUSIONNENT sous le pixel ; le compte dépend donc de la bande
  // choisie, ce qui est exactement le défaut que la règle du chantier interdit
  // (« un relevé sur UNE image ne prouve rien »).
  //
  // ⚡ **LA PÉRIODE DOMINANTE, ELLE, NE DÉPEND PAS DES FUSIONS DE BORD.** On la
  // cherche par une transformée directe sur la partie de la bande qui porte du
  // signal : la période qui maximise |Σ b(x)·e^{−2iπx/T}|. Un carroyage deux
  // fois et demie plus fin doit rendre une période deux fois et demie plus
  // courte, et cette grandeur-là est comparable d'une bande à l'autre.
  const x0 = premier ?? 0
  const x1 = dernier ?? W - 1
  const n = x1 - x0 + 1
  let moy = 0
  for (let x = x0; x <= x1; x++) moy += bande[x]
  moy /= Math.max(1, n)
  let meilleure = null, meilleurG = 0
  for (let T = 5; T <= 240; T += 0.25) {
    let re = 0, im = 0
    for (let x = x0; x <= x1; x++) {
      const v = bande[x] - moy
      const a = (2 * Math.PI * (x - x0)) / T
      re += v * Math.cos(a)
      im += v * Math.sin(a)
    }
    const g = Math.hypot(re, im) / Math.max(1, n)
    if (g > meilleurG) { meilleurG = g; meilleure = T }
  }
  return { pics, max, premier, dernier, largeurPx: n, periodePx: meilleure, force: meilleurG }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { port: PORT, images: IMAGES, mesures: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('shibumap-ui-advanced', '1')
      localStorage.setItem('shibumap-workmode', 'studio')
    } catch {}
  })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
    for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
    document.body.classList.add('ce-railL-off', 'ce-railR-off')
    window.__exp.params.animations = false
  })
  await dodo(1500)
  const dims = await page.evaluate(poserLecteur)
  rapport.tampon = dims
  rapport.etat = await page.evaluate(() => {
    const u = window.__exp.globe.uniforms
    return { cropDemiM: u.uCropDemiM.value, largeurM: u.uCropDemiM.value * 2 }
  })

  // ══════ LA VUE DE MESURE EST AU NADIR, ET C'EST UNE NÉCESSITÉ ═══════════
  //
  // ⛔ **EN VUE DE TROIS QUARTS, LA QUESTION N'A PAS DE RÉPONSE UNIQUE.** Une
  // ligne de balayage horizontale y traverse les DEUX familles de lignes à la
  // fois, et la perspective resserre le fond du bloc : la « période » du signal
  // change le long de la ligne. Premier essai, mesuré : période dominante
  // 56,8 / 51,8 / 48,3 px sur trois bandes du même état, et un rapport 5→2 qui
  // rendait 1,66 puis 1,74 puis 2,47 selon la bande. **L'instrument était le
  // problème, pas la grille.**
  //
  // ⚡ **AU NADIR, l'écran EST le plan du sol** : screen-x suit le x du monde,
  // les lignes de la famille X sont verticales et régulièrement espacées, et la
  // largeur du bloc en pixels devient une RÈGLE. On lit alors directement
  // `cellules = largeurBlocPx / périodePx`, à comparer aux 11,2 attendues.
  // ⚠️ **C'est un cadrage de BANC, pas un changement de produit** — D16 ter dit
  // que la vue de trois quarts arrive au bloc, et elle y reste : on ne fait que
  // poser une caméra le temps de compter, exactement comme R19 posait la sienne
  // pour apparier ses deux captures.
  await page.evaluate(() => {
    const e = window.__exp
    e.camera.position.set(0, 140, 0.0001)
    e.controls.target.set(0, 0, 0)
    e.controls.update?.()
  })
  await dodo(2500)
  // ⚡ **LA PRÉDICTION SE CALCULE SUR LA CAMÉRA VIVANTE, PAS SUR CELLE QU'ON A
  // DEMANDÉE.** L'application peut recaler la vue ; lire la position posée au
  // lieu de la position obtenue, c'est le défaut que ce chantier a payé neuf
  // fois. Au nadir, un pixel vaut `2 · d · tan(fov/2) / hauteurTampon` unités de
  // scène, avec `d` la distance de la caméra au plan visé — donc la période
  // attendue d'une grille de pas `gridStep` vaut `gridStep / unitesParPixel`.
  rapport.camera = await page.evaluate(() => {
    const e = window.__exp
    return {
      y: e.camera.position.y, x: e.camera.position.x, z: e.camera.position.z,
      cibleY: e.controls.target.y, fov: e.camera.fov,
      hauteurTampon: e.renderer.domElement.height,
    }
  })
  {
    const c = rapport.camera
    const d = Math.abs(c.y - c.cibleY)
    rapport.unitesParPixel = (2 * d * Math.tan((c.fov * Math.PI) / 360)) / c.hauteurTampon
  }
  await page.evaluate(poseParLabel, 'Opacité de la grille', '0')
  await dodo(1200)
  const A = await page.evaluate((k) => window.__gr.moyenne(k), IMAGES)

  for (const step of [5, 2]) {
    await page.evaluate(poseParLabel, 'Taille de la grille', String(step))
    await page.evaluate(poseParLabel, 'Opacité de la grille', '1')
    await dodo(1400)
    const B = await page.evaluate((k) => window.__gr.moyenne(k), IMAGES)
    await page.screenshot({ path: path.join(SORTIE, `echelle-step${step}.png`) })
    const { W, H } = dims
    const diff = new Float64Array(W * H)
    for (let i = 0; i < W * H; i++) diff[i] = Math.abs(B[i] - A[i])
    const pasM = await page.evaluate(() => window.__exp.globe.uniforms.uGridStepM.value)
    const bandes = []
    // trois bandes réparties sur la hauteur du bloc — un relevé sur UNE ligne ne
    // prouve rien (règle du chantier), et le bloc n'occupe pas toute l'image
    for (const frac of [0.42, 0.5, 0.58]) {
      const y0 = Math.round(H * frac)
      bandes.push({ frac, ...compterPics(diff, W, H, y0, 9) })
    }
    // au nadir, la ligne de balayage ne croise qu'UNE famille : 56 / gridStep
    const predit = 56 / step
    rapport.mesures.push({
      step, pasM,
      cellules: rapport.etat.largeurM / pasM,
      predit,
      bandes,
      picsMax: Math.max(...bandes.map((b) => b.pics)),
      // la médiane des trois périodes — on ne prend ni la plus favorable ni une
      // moyenne qu'un aberrant tirerait
      periodeMediane: bandes.map((b) => b.periodePx).filter((p) => p != null).sort((a, b) => a - b)[1] ?? null,
      // ⚡ **LA GRANDEUR QUI DÉCIDE : le bloc mesuré EN CELLULES.** La largeur du
      // bloc en pixels est la règle (elle vaut 27 356 m de sol au nadir), la
      // période est la graduation. Leur quotient doit rendre `span / gridStep`,
      // et il ne dépend ni de la distance de la caméra ni de la taille du canevas.
      cellulesEcran: bandes.map((b) => (b.periodePx && b.largeurPx ? b.largeurPx / b.periodePx : null)),
      // ⚡ **LA VÉRIFICATION ABSOLUE, CONTRE UNE DISTANCE CONNUE.** La période
      // attendue ne vient d'aucune mesure d'image : c'est la trigonométrie de la
      // caméra appliquée au pas en unités de scène. ⚠️ Elle est légèrement
      // SOUS-estimée par construction — la grille est peinte sur le RELIEF, qui
      // est plus près de la caméra que le plan visé, donc plus gros à l'écran.
      periodeAttenduePx: step / rapport.unitesParPixel,
    })
    console.log(`gridStep ${step} · pas ${pasM.toFixed(1)} m · cellules attendues ${(rapport.etat.largeurM / pasM).toFixed(3)} · pics ${bandes.map((b) => b.pics).join('/')} (prédit ${predit.toFixed(1)}) · T ${bandes.map((b) => (b.periodePx ?? 0).toFixed(1)).join('/')} px · largeur ${bandes.map((b) => b.largeurPx ?? 0).join('/')} px · T ATTENDUE ${(step / rapport.unitesParPixel).toFixed(2)} px`)
    await page.evaluate(poseParLabel, 'Opacité de la grille', '0')
    await dodo(900)
  }
  const [m5, m2] = rapport.mesures
  rapport.rapportPics = m2.picsMax / m5.picsMax
  rapport.rapportPeriode = m5.periodeMediane / m2.periodeMediane
  rapport.rapportPredit = m5.step / m2.step
  // et le rapport bande à bande, la MÊME bande des deux côtés : c'est celui qui
  // ne mélange pas deux géométries de balayage
  rapport.rapportParBande = m5.bandes.map((b, i) => ({
    frac: b.frac,
    periode: b.periodePx / m2.bandes[i].periodePx,
    pics: m2.bandes[i].pics / b.pics,
  }))
  console.log(`rapport 5→2 : période ${rapport.rapportPeriode.toFixed(3)} · pics ${rapport.rapportPics.toFixed(3)} · prédit ${rapport.rapportPredit.toFixed(3)}`)
  console.log('par bande :', rapport.rapportParBande.map((r) => `${r.frac}: T×${r.periode.toFixed(3)}`).join('  '))
} finally {
  await nav.close()
}
fs.writeFileSync(path.join(SORTIE, 'echelle-grille.json'), JSON.stringify(rapport, null, 2), { encoding: 'utf8' })
console.log('→', path.join(SORTIE, 'echelle-grille.json'))
