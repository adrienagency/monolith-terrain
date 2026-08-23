// SONDE DE CLAQUEMENT — DE QUOI EST FAIT LE SAUT D'IMAGE À LA NAISSANCE DU CROP.
//
// ══════════ POURQUOI ELLE EXISTE ═══════════════════════════════════════════
//
// La naissance du crop remplace l'image d'un coup : `uCropOn` passe de 0 à 1 en
// une image, et avec lui six autres interrupteurs que la chaîne allume ensemble.
// « Il faudrait un fondu » est une phrase ; **sur QUOI** est une mesure.
//
// Cette sonde immobilise la caméra juste sous `SEUIL_NAISSANCE_M`, puis retire
// les maillons du crop UN PAR UN, en capturant l'image composée à chaque étape.
// Elle rend l'écart moyen par pixel entre chaque état et l'état crop-posé, sur
// la zone de canevas seule (l'interface est exclue du cadre).
//
// ⚠️ **LE CADRE DE MESURE EXCLUT L'INTERFACE, ET C'EST UNE DÉCISION.** Les
// panneaux de ShibuMap sont translucides : ils suivent le canevas et
// gonfleraient l'écart d'un effet qui n'est pas le leur. Le cadre retenu est
// `600×300` au centre, là où il n'y a que de la scène.
//
// ⚠️ **CHROME SANS TÊTE COMPOSITE**, `readPixels` non : `preserveDrawingBuffer`
// est faux sur ce contexte. Même patron que `scripts/sonde-demarrage.mjs`.
//
// EMPLOI
//   node scripts/sonde-claquement.mjs                 # sur le serveur de dev 5503
//   node scripts/sonde-claquement.mjs --port 5503 --altitude 30000
//
// Sort : `.banc/R4/claquement/*.png` et un tableau sur la sortie standard.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SORTIE = path.join(RACINE, '.banc', 'R4', 'claquement')
fs.mkdirSync(SORTIE, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5503'))
const ALT_CIBLE = Number(opt('--altitude', '30000'))
const URL_SUFFIXE = opt('--url', '?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0')

// ══════════ LE GRAIN ANIMÉ, ET POURQUOI ON PEUT LE GELER ════════════════════
//
// ⛔ **UN PLANCHER DE BRUIT DE 8,97 A FAIT RETIRER UN CHIFFRE — IL FALLAIT
// D'ABORD ESSAYER D'ÉTEINDRE LE BRUIT.** La première version de ce banc mesurait
// son plancher, ce qui était juste ; elle ne se demandait pas ce qu'il devient
// quand on coupe le mouvement d'ambiance, ce qui l'était moins.
// `params.animations` est l'interrupteur UNIQUE de ce mouvement
// (`src/animations.js`) : à `false`, `main.js` alimente les agréments avec
// `dtAmb = 0`.
//
//   node scripts/sonde-claquement.mjs --anim 0   # ambiance GELÉE
//
// ⚠️ **CE N'EST PAS LE RÉGIME D'ADRIEN**, qui joue animations allumées. Le banc
// gelé sert à SÉPARER ce qui bouge de ce qui claque ; les deux planchers se
// publient ensemble, jamais l'un à la place de l'autre.
const ANIM = opt('--anim', '1') !== '0'
const SUFFIXE = ANIM ? '' : '-gele'

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable. `npm i -D puppeteer-core`.')
  process.exit(2)
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,800'],
})

// ⚠️ **LA COMPARAISON SE FAIT SUR LES PIXELS, PAS SUR UNE MOYENNE.** Deux images
// de moyenne identique peuvent être entièrement différentes ; c'est exactement
// le piège qu'un « écart de luminance » aurait laissé passer ici, la mer bleue
// et l'aplat olive ayant des luminances voisines. On rend donc l'écart moyen
// ABSOLU par pixel — et la moyenne, à côté, pour mémoire.
function comparer(a, b) {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return s / n
}

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 160)))
  await page.goto(`http://localhost:${PORT}/${URL_SUFFIXE}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 60000, polling: 100 })
  await new Promise((r) => setTimeout(r, 6000))
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 1500))
  // ⚠️ **ON VÉRIFIE QUE L'INTERRUPTEUR A PRIS**, au lieu de l'espérer.
  const animEtat = await page.evaluate((on) => {
    window.__exp.params.animations = on
    return window.__exp.params.animations
  }, ANIM)
  console.log(`ambiance : ${animEtat ? 'ANIMÉE' : 'GELÉE'} (params.animations = ${animEtat})`)

  // ── la descente, PAR CRANS, jusqu'à passer juste sous le seuil ───────────
  //
  // ⚠️ **PAR CRANS ET PAS À LA MOLETTE, ET LA PREMIÈRE VERSION L'A PAYÉ.** Le
  // glissé inertiel court après le dernier événement : viser 30 000 m à la
  // molette a rendu **5 225 m**, c'est-à-dire une mesure faite six crans sous
  // la naissance du crop — donc sur un régime établi, pas sur la transition.
  // `cranZoom(1)` applique ×1/√2 IMMÉDIATEMENT et sans élan : on s'arrête où
  // l'on veut, au cran près.
  //
  // ⚠️ **ON REPART DE L'ORBITE, ET CE N'EST PAS UN DÉTOUR.** L'application
  // DÉMARRE en surface à ~12 km, c'est-à-dire DÉJÀ sous la naissance du crop :
  // une descente qui part de là n'a aucune transition à traverser, et la
  // première version de cette sonde a mesuré 5 842 m en croyant mesurer 32 000.
  await page.evaluate(() => window.__exp.modes.enterOrbit(120000))
  await new Promise((r) => setTimeout(r, 4000))
  for (let i = 0; i < 60; i++) {
    const e = await page.evaluate(() => ({ alt: window.__exp.altitudeCadrageM?.() ?? 0, mode: window.__exp.modes.mode }))
    if (e.mode === 'surface' && e.alt > 0 && e.alt < ALT_CIBLE) break
    await page.evaluate(() => window.__exp.modes.cranZoom(1))
    await new Promise((r) => setTimeout(r, 600))
  }
  // ⚠️ **ON LAISSE TOUT SE POSER AVANT DE MESURER.** Une caméra encore en
  // mouvement, ou une chaîne de crop dont un maillon vient de refuser et sera
  // repris à la trentième image, ferait attribuer à un retrait un écart qui
  // n'est que du temps qui passe.
  await page.evaluate(() => window.__exp.modes._resetZoom())
  await new Promise((r) => setTimeout(r, 4000))

  const etat = await page.evaluate(() => ({
    alt: window.__exp.altitudeCadrageM?.(),
    pose: !!window.__exp.veilleCrop?.pose,
    cropOn: window.__exp.globe?.uniforms?.uCropOn?.value,
    estompe: window.__exp.veilleEstompage?.valeur,
  }))
  console.log(`altitude ${Math.round(etat.alt)} m · crop posé ${etat.pose} · uCropOn ${etat.cropOn} · estompage ${Number(etat.estompe).toFixed(3)}`)

  const client = await page.createCDPSession()
  // ⛔ **LE BANC CALCULE SON PROPRE TABLEAU — Tâche R4, tour de correction.** La
  // première version écrivait « l'écart se calcule hors de ce script » : les
  // chiffres publiés venaient donc d'un calcul qui n'est nulle part, avec une
  // formule de luminance et un cadre que personne ne peut relire. Ici, la
  // luminance est extraite DANS la page (Chrome sait décoder son propre PNG,
  // node non), sur le cadre `CADRE`, et le tableau sort sur la sortie standard.
  const CADRE = { x: 40, y: 80, w: 1200, h: 640 }
  const luminance = async (dataB64) => {
    const b64 = await page.evaluate(async (uri, C) => {
      const img = new Image()
      img.src = uri
      await img.decode()
      const c = document.createElement('canvas')
      c.width = C.w; c.height = C.h
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, C.x, C.y, C.w, C.h, 0, 0, C.w, C.h)
      const d = g.getImageData(0, 0, C.w, C.h).data
      const out = new Uint8Array(C.w * C.h)
      for (let i = 0, j = 0; j < out.length; i += 4, j++) {
        out[j] = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
      }
      let s = ''
      for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode.apply(null, out.subarray(k, k + 8192))
      return btoa(s)
    }, 'data:image/png;base64,' + dataB64, CADRE)
    return Buffer.from(b64, 'base64')
  }
  const prendre = async (nom) => {
    await new Promise((r) => setTimeout(r, 900)) // laisser deux ou trois images passer
    const b = await client.send('Page.captureScreenshot', { format: 'png' })
    const f = path.join(SORTIE, `${nom}${SUFFIXE}.png`)
    fs.writeFileSync(f, Buffer.from(b.data, 'base64'))
    const lum = await luminance(b.data)
    fs.writeFileSync(path.join(SORTIE, `${nom}${SUFFIXE}.raw`), lum)
    return { f, lum }
  }

  // ── les états, du plus complet au plus nu ────────────────────────────────
  const etapes = []
  etapes.push({ nom: '0-crop-entier', ...(await prendre('0-crop-entier')) })
  // ⚠️ **LE PLANCHER DE BRUIT SE MESURE, IL NE SE SUPPOSE PAS — ET IL A FAILLI
  // FAIRE PUBLIER UN FAUX CHIFFRE.** Le grain de film est ANIMÉ : deux captures
  // du MÊME état, à 900 ms d'écart, diffèrent sur presque tout l'écran. La
  // première lecture de ce banc donnait « les parois changent 43 % des pixels de
  // plus de 8 niveaux » — c'était le grain, pas les parois. Cet état témoin ne
  // touche à RIEN : tout écart mesuré contre lui est du bruit, et tout écart
  // qui ne le dépasse pas n'est pas une mesure.
  etapes.push({ nom: '0bis-temoin', ...(await prendre('0bis-temoin')) })
  // ⛔ **UN TROISIÈME TÉMOIN, ET IL CHANGE LA LECTURE — Tâche R4, tour de
  // correction.** Le tableau d'origine comparait TOUT à `0-crop-entier` : la
  // première étape était à 900 ms de la référence, la deuxième à 1 800, la
  // dernière à 4 500. Un banc qui dérive avec le temps attribue donc au dernier
  // maillon retiré ce qui n'est que du temps écoulé. Avec ce témoin-ci, on
  // dispose d'un plancher mesuré à ÉCART DE TEMPS ÉGAL, et le second tableau
  // (« écarts consécutifs ») compare chaque état au précédent, tous à 900 ms.
  etapes.push({ nom: '0ter-temoin', ...(await prendre('0ter-temoin')) })

  await page.evaluate(() => window.__exp.globe.retirerParoisCrop())
  etapes.push({ nom: '1-sans-parois', ...(await prendre('1-sans-parois')) })

  await page.evaluate(() => window.__exp.globe.retirerFondCrop())
  etapes.push({ nom: '2-sans-fond', ...(await prendre('2-sans-fond')) })

  // ⚠️ **LE STYLE EN DERNIER, ET D'UN SEUL BLOC** : `retirerHabillage`,
  // `retirerRampe` et `retirerMer` éteignent `uHabOn`, `uRampCropOn`,
  // `uMerRampeOn` et `uEclairageOn`. C'est la part que la règle D15 réattribue à
  // R6 — on la MESURE ici, on ne la corrige pas.
  await page.evaluate(() => {
    const g = window.__exp.globe
    g.retirerHabillage(); g.retirerRampe(); g.retirerMer()
  })
  etapes.push({ nom: '3-sans-style', ...(await prendre('3-sans-style')) })

  await page.evaluate(() => { window.__exp.globe.retirerCrop(); window.__exp.globe.retirerEstompage() })
  etapes.push({ nom: '4-planete-nue', ...(await prendre('4-planete-nue')) })

  console.log(`\ncaptures dans .banc/R4/claquement/ (suffixe « ${SUFFIXE || 'aucun'} »)`)
  console.log(`erreurs de page : ${erreurs.length}${erreurs.length ? ' — ' + erreurs.slice(0, 2).join(' | ') : ''}`)
  // ── LE TABLEAU, calculé ICI ──────────────────────────────────────────────
  const ref = etapes[0].lum
  console.log(`\ncadre ${CADRE.w}×${CADRE.h} · ambiance ${ANIM ? 'ANIMÉE' : 'GELÉE'}`)
  console.log('  état                écart moyen |Δ|   % de pixels > 8 niveaux')
  for (const e of etapes.slice(1)) {
    let s = 0
    let c = 0
    for (let i = 0; i < ref.length; i++) { const d = Math.abs(e.lum[i] - ref[i]); s += d; if (d > 8) c++ }
    console.log(`  ${e.nom.padEnd(18)} ${(s / ref.length).toFixed(2).padStart(8)}   ${((100 * c) / ref.length).toFixed(1).padStart(10)} %`)
  }
  console.log(`\n⚠️ les DEUX premières lignes ne touchent à rien : c'est le plancher, mais à écart de temps CROISSANT.`)
  console.log(`\nécarts CONSÉCUTIFS (chacun à 900 ms du précédent — c'est la lecture juste) :`)
  console.log('  écart                                    |Δ| moyen   % > 8 niveaux')
  for (let i = 1; i < etapes.length; i++) {
    const a = etapes[i - 1].lum
    const b = etapes[i].lum
    let s = 0
    let c = 0
    for (let k = 0; k < a.length; k++) { const d = Math.abs(b[k] - a[k]); s += d; if (d > 8) c++ }
    const lib = `${etapes[i - 1].nom} → ${etapes[i].nom}`
    console.log(`  ${lib.padEnd(40)} ${(s / a.length).toFixed(2).padStart(8)}   ${((100 * c) / a.length).toFixed(1).padStart(8)} %`)
  }
} finally {
  await nav.close()
}
