// SONDE DE DESCENTE — R6, « la planète ne doit plus jamais être nue ».
//
// Elle relève, PAR PALIER D'ALTITUDE : l'altitude de cadrage, la valeur des
// sept interrupteurs de style du globe, et un condensé de l'image RÉELLEMENT
// COMPOSÉE (moyenne, écart-type, entropie, part du pixel le plus fréquent).
//
// ⚠️ CHROME SANS TÊTE, ET C'EST LE POINT. Le panneau navigateur de session ne
// composite pas toujours (un banc a compté « 0 image en 3,7 s »). Un Chrome
// piloté par CDP rend l'image composée quel que soit `preserveDrawingBuffer` —
// et c'est POUR ÇA que le condensé se calcule sur la CAPTURE renvoyée dans la
// page, jamais en dessinant `renderer.domElement` dans un canvas 2D : hors de
// l'image, ce dernier rend du NOIR (mesuré : moy = 0 sur les 19 paliers).
//
// EMPLOI
//   node scripts/sonde-descente-nue.mjs --port 5519 --sortie .banc/R6/avant.json
//   node scripts/sonde-descente-nue.mjs --vues .banc/R6/vues-avant   # + les PNG
//
// ⚠️ **APRÈS UN `npm ci`, CETTE SONDE NE DÉMARRE PAS TOUTE SEULE — RÉSERVE I3.**
// `puppeteer-core` n'est PAS dans `package.json` : c'est un outil de
// diagnostic, pas une dépendance produit. **La phrase à rejouer est :**
//     npm i --no-save puppeteer-core@25.8.0
// Les relevés, eux, sont commités sous
// `.superpowers/sdd/2026-08-22-globe-studio/traces-R6/` — PAS sous `.banc/`,
// qui est gitignoré (`.gitignore:44`) et ne survit pas à la fusion.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5519'))
const SORTIE = opt('--sortie', null)
const VUES = opt('--vues', null)
const ADRESSE = opt('--adresse', 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0')
// La descente d'Adrien part de l'orbite et traverse le seuil (32 274,3 m).
const PALIERS = (opt('--paliers', '') || [
  2000000, 1000000, 500000, 250000, 120000, 80000,
  60000, 48000, 40000, 36000, 33000, 32000, 28000, 20000, 12000, 6000,
].join(',')).split(',').map(Number)
const ATTENTE = Number(opt('--attente', '2600'))
// ══════ ⚡ LE MODE APPARIÉ, ET IL EST NÉ D'UN PLANCHER DE BRUIT MESURÉ ══════
//
// ⛔ **DEUX SESSIONS NE SONT PAS COMPARABLES.** Deux descentes du MÊME dépôt,
// lancées l'une après l'autre (`.banc/R6/avant.json` contre `avant-bis.json`),
// ont rendu des écarts-types distants de **15,6 % au pire** (47 980 m et
// 39 984 m) : le quadtree n'a pas chargé les mêmes tuiles, donc l'image n'est
// pas la même. Un effet de +18 % lu entre deux sessions ne prouve donc RIEN.
//
// ➡️ En mode apparié, les deux variantes sont capturées **dans la même session,
// au même palier, sur le même jeu de tuiles**, en basculant les uniformes ; et
// une TROISIÈME capture, identique à la première, donne le plancher de bruit
// du palier. Le grain de film est gelé (`params.animations = false`) pour que
// deux captures d'un état identique soient réellement identiques.
const APPARIE = A.includes('--apparie')
// Le mode APPARIÉ à trois états — voir `poserEtat` plus bas (constat C2).
const TRIPLE = A.includes('--triple')
// ⚠️ **LE LIEU SE POSE PAR LE HASH `#s=`, PAS PAR LA REQUÊTE.** `main.js` ne lit
// un lien de partage que dans `location.hash` (ligne « A pasted share link
// carries #s=<payload> in the URL HASH — never the query »). Sans ça, la sonde
// mesure toujours le lieu de départ, et la comparaison avec la vidéo d'Adrien —
// tournée au-dessus du Maroc — n'a aucun sens.
const LIEU = opt('--lieu', null)   // « lat,lon,zoom »
const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin> ou pose CHROME_PATH.'); process.exit(2) }
  return t
}

const puppeteer = await (async () => {
  try { return (await import('puppeteer-core')).default } catch {
    console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2)
  }
})()

export const LANCEMENT = [
  '--headless=new', '--hide-scrollbars', '--mute-audio',
  '--window-size=1280,800',
  // Le GPU RÉEL, pas SwiftShader : le nuanceur doit tourner comme chez Adrien.
  '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
  '--disable-dev-shm-usage',
]

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new', args: LANCEMENT,
})
const page = await nav.newPage()
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  [page] ' + e.message))

const hash = LIEU
  ? '#s=' + b64url({ loc: { lat: Number(LIEU.split(',')[0]), lon: Number(LIEU.split(',')[1]), zoom: Number(LIEU.split(',')[2] ?? 12) } })
  : ''
const url = `http://localhost:${PORT}/?${ADRESSE}${hash}`
console.log('→ ' + url)
await page.goto(url, { waitUntil: 'load', timeout: 90000 })
await page.waitForFunction('window.__exp && window.__exp.globe && window.__exp.globe.uniforms', { timeout: 90000 })
await new Promise((r) => setTimeout(r, 6000))
// ⚠️ LE SAS D'ACCUEIL COUVRE L'ÉCRAN ET FIGE LA CAMÉRA. « Échap — explorer
// librement » est écrit dessus ; sans ce geste la sonde a mesuré 19 paliers à
// 18 321 m, c'est-à-dire un seul.
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 10000))

// ── LA DESCENTE. On pilote la caméra DU SOCLE le long de sa ligne de visée :
// `altitudeCadrageM()` lit `camera.position.y`, et `majCameraFond` dérive la
// caméra de fond de celle-ci à chaque image.
async function poserAltitude(m) {
  return page.evaluate((cible) => {
    const e = window.__exp
    const cam = e.camera
    const ct = e.controls
    if (!ct) return { erreur: 'pas de controls' }
    // ⚠️ LES BORNES D'ORBITE SONT LEVÉES, PUIS REPOSÉES PAR L'APPELANT : sans
    // cela `maxDistance` retient la caméra bien en dessous de l'orbite.
    ct.minDistance = 1e-4
    ct.maxDistance = 1e12
    const t = ct.target
    const dir = cam.position.clone().sub(t).normalize()
    for (let i = 0; i < 40; i++) {
      const a = e.altitudeCadrageM()
      if (!Number.isFinite(a) || a <= 0) break
      const d = cam.position.distanceTo(t)
      const nd = d * (cible / a)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(t).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - cible) / cible < 0.004) break
    }
    return { altitude: e.altitudeCadrageM() }
  }, m)
}

// Le condensé se calcule DANS LA PAGE, sur la capture composée qu'on lui rend.
async function condense(b64) {
  return page.evaluate(async (dataUrl) => {
    const img = new Image()
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = dataUrl })
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0, s = 0, s2 = 0
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      hist[Math.min(255, L | 0)]++
      s += L; s2 += L * L; n++
    }
    const moy = s / n
    const ecart = Math.sqrt(Math.max(0, s2 / n - moy * moy))
    let H = 0, pic = 0
    for (let i = 0; i < 256; i++) {
      const p = hist[i] / n
      if (p > 0) H -= p * Math.log2(p)
      if (hist[i] > pic) pic = hist[i]
    }
    return { moy: +moy.toFixed(3), ecart: +ecart.toFixed(3), entropie: +H.toFixed(3), partPic: +(pic / n).toFixed(4) }
  }, b64)
}

// ⚠️ L'ÉCART MOYEN PAR PIXEL entre deux captures — la grandeur que la tâche R4
// a mesurée sur son propre plancher. Calculé DANS LA PAGE, comme le condensé.
async function ecartPixels(b64a, b64b) {
  return page.evaluate(async (deux) => {
    const lire = async (u) => {
      const img = new Image()
      await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = u })
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    }
    const [x, y] = [await lire(deux[0]), await lire(deux[1])]
    let s = 0, n = 0, bouges = 0
    for (let i = 0; i < x.length; i += 4) {
      const d = (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2])) / 3
      s += d; n++
      if (d > 8) bouges++
    }
    return { ecartPixel: +(s / n).toFixed(3), partBougee: +(bouges / n).toFixed(4) }
  }, [b64a, b64b])
}

// ══════ ⚡ LES TROIS ÉTATS — NÉS DU CONSTAT C2 DE LA RELECTURE ═════════════
//
// ⛔ **CE QUE `--triple` CORRIGE.** Le premier tour de R6 justifiait l'ajout de
// la lampe de carte par « écart-type 14,053 contre 14,089, soit +0,26 % », en
// citant un `.banc/R6/apres-normale-seule.json` **qui n'existe pas** — et la
// référence était **gravée dans le code livré**. Les deux valeurs comparées
// venaient de DEUX SESSIONS : exactement la faute que l'Étape 7 du même rapport
// déclare ne rien prouver (15,6 % de dérive inter-session).
//
// ➡️ `--triple` capture les TROIS états au même palier, dans la même session,
// sur le même jeu de tuiles, grain gelé : `nue` (rien), `normale` (la normale
// par fragment SEULE, gain à zéro), `d15` (les deux). C'est la seule façon de
// dire ce que la normale fine pèse toute seule.
//
// @param {'nue'|'normale'|'d15'} quoi
async function poserEtat(quoi) {
  return page.evaluate((e) => {
    const u = window.__exp.globe.uniforms
    // ⚠️ Le gain de production est capturé UNE fois, à la première bascule :
    // ensuite les uniformes sont écrasés par la sonde elle-même.
    if (window.__R6gain == null) window.__R6gain = (u.uReliefMondeGain && u.uReliefMondeGain.value) || 0.9
    u.uNormaleFineOn.value = e === 'nue' ? 0 : 1
    if (u.uReliefMondeGain) u.uReliefMondeGain.value = e === 'd15' ? window.__R6gain : 0
    window.__exp.params.animations = false
    return { etat: e, normale: u.uNormaleFineOn.value, gain: u.uReliefMondeGain ? u.uReliefMondeGain.value : null }
  }, quoi)
}

// Les deux postes que D15 rend globaux, coupés et rallumés SANS recharger.
async function poserD15(on) {
  return page.evaluate((allume) => {
    const u = window.__exp.globe.uniforms
    if (window.__R6gain == null) window.__R6gain = u.uReliefMondeGain ? u.uReliefMondeGain.value : 0
    if (window.__R6norm == null) window.__R6norm = u.uNormaleFineOn.value
    u.uNormaleFineOn.value = allume ? window.__R6norm : 0
    if (u.uReliefMondeGain) u.uReliefMondeGain.value = allume ? window.__R6gain : 0
    window.__exp.params.animations = false
    return { normale: u.uNormaleFineOn.value, gain: u.uReliefMondeGain ? u.uReliefMondeGain.value : null }
  }, on)
}

// ⚠️ LA FENÊTRE DE MESURE ÉVITE L'INTERFACE : le panneau « Explorer » occupe la
// colonne de gauche et la barre du bas, et leur aplat écraserait l'écart-type.
const CADRE = { x: 340, y: 130, width: 620, height: 340 }

const releves = []
if (VUES) fs.mkdirSync(path.resolve(RACINE, VUES), { recursive: true })

for (const m of PALIERS) {
  await poserAltitude(m)
  await new Promise((r) => setTimeout(r, ATTENTE))
  const etat = await page.evaluate(() => {
    const e = window.__exp
    const u = e.globe.uniforms
    const v = (n) => (u[n] ? u[n].value : null)
    return {
      altitude: e.altitudeCadrageM(),
      crop: !!(e.veilleCrop && e.veilleCrop.pose),
      uCropOn: v('uCropOn'), uHabOn: v('uHabOn'), uEclairageOn: v('uEclairageOn'),
      uNormaleFineOn: v('uNormaleFineOn'), uAnalysisOn: v('uAnalysisOn'),
      uRampCropOn: v('uRampCropOn'), uMerZeroSousEau: v('uMerZeroSousEau'),
      uMppFacteur: v('uMppFacteur'), uEstompage: v('uEstompage'), uEstompageOn: v('uEstompageOn'),
      // ⚡ LE HUITIÈME POSTE, celui que D15 ajoute — Tâche R6. Il est relevé
      // pour que « drapeau baissé, la production est inchangée » se VÉRIFIE au
      // lieu de se déclarer.
      uReliefMondeGain: v('uReliefMondeGain'),
      tuiles: e.globe.tiles ? e.globe.tiles.size : null,
    }
  })
  if (TRIPLE) {
    // ⚠️ MÊME ORDRE QUE LE MODE APPARIÉ, et une image passe entre chaque
    // bascule : un uniforme posé n'atteint le GPU qu'au dessin suivant.
    const cliche = async () => {
      await new Promise((r) => setTimeout(r, 400))
      return 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
    }
    etat.postes = await poserEtat('nue')
    const a1 = await cliche()
    const a2 = await cliche()          // le plancher de bruit DU PALIER
    etat.nue = await condense(a1)
    etat.plancher = (await ecartPixels(a1, a2)).ecartPixel
    await poserEtat('normale')
    const b1 = await cliche()
    etat.normaleSeule = await condense(b1)
    const eN = await ecartPixels(a1, b1)
    etat.effetNormale = eN.ecartPixel
    etat.partBougeeNormale = eN.partBougee
    await poserEtat('d15')
    const c1 = await cliche()
    etat.eclairee = await condense(c1)
    const eD = await ecartPixels(a1, c1)
    etat.effet = eD.ecartPixel
    etat.partBougee = eD.partBougee
    etat.gainNormalePct = +((etat.normaleSeule.ecart / etat.nue.ecart - 1) * 100).toFixed(2)
    etat.gainD15Pct = +((etat.eclairee.ecart / etat.nue.ecart - 1) * 100).toFixed(2)
    Object.assign(etat, etat.eclairee)
  } else if (APPARIE) {
    // ⚠️ L'ORDRE COMPTE : on éteint D'ABORD, on rallume ENSUITE, et on laisse
    // une image passer entre chaque bascule — un uniforme posé n'atteint le
    // GPU qu'au dessin suivant.
    etat.postes = await poserD15(false)
    await new Promise((r) => setTimeout(r, 400))
    const a1 = 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
    await new Promise((r) => setTimeout(r, 400))
    const a2 = 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
    etat.nue = await condense(a1)
    etat.plancher = (await ecartPixels(a1, a2)).ecartPixel
    await poserD15(true)
    await new Promise((r) => setTimeout(r, 400))
    const b1 = 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
    etat.eclairee = await condense(b1)
    const e = await ecartPixels(a1, b1)
    etat.effet = e.ecartPixel
    etat.partBougee = e.partBougee
    Object.assign(etat, etat.eclairee)
  } else {
    const crop = await page.screenshot({ clip: CADRE, encoding: 'base64' })
    Object.assign(etat, await condense('data:image/png;base64,' + crop))
  }
  if (VUES) {
    const base = String(Math.round(etat.altitude)).padStart(8, '0')
    if (APPARIE) {
      // ⚠️ LES DEUX VUES DU MÊME PALIER, PLEIN CADRE, SUR LE MÊME JEU DE TUILES :
      // c'est la seule comparaison qu'Adrien puisse trancher à l'œil.
      await poserD15(false)
      await new Promise((r) => setTimeout(r, 400))
      await page.screenshot({ path: path.resolve(RACINE, VUES, `alt-${base}-nue.png`) })
      await poserD15(true)
      await new Promise((r) => setTimeout(r, 400))
      await page.screenshot({ path: path.resolve(RACINE, VUES, `alt-${base}-eclairee.png`) })
      etat.vue = `alt-${base}-{nue,eclairee}.png`
    } else {
      await page.screenshot({ path: path.resolve(RACINE, VUES, `alt-${base}.png`) })
      etat.vue = `alt-${base}.png`
    }
  }
  releves.push(etat)
  const b = (x) => (x === 1 ? '1' : x === 0 ? '.' : '?')
  if (TRIPLE) {
    const pc = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)} %`
    console.log(
      `${String(Math.round(etat.altitude)).padStart(9)} m  crop=${etat.crop ? 'O' : '.'} n=${String(etat.tuiles).padStart(4)}  ` +
      `ecart nue=${etat.nue.ecart.toFixed(3).padStart(7)}  normale seule=${etat.normaleSeule.ecart.toFixed(3).padStart(7)} (${pc(etat.gainNormalePct)})  ` +
      `D15=${etat.eclairee.ecart.toFixed(3).padStart(7)} (${pc(etat.gainD15Pct)})   ` +
      `plancher=${etat.plancher.toFixed(3)}  ecart/pixel normale=${etat.effetNormale.toFixed(2)} D15=${etat.effet.toFixed(2)}`)
  } else if (APPARIE) {
    const g = (etat.eclairee.ecart / etat.nue.ecart - 1) * 100
    console.log(
      `${String(Math.round(etat.altitude)).padStart(9)} m  crop=${etat.crop ? 'O' : '.'} n=${String(etat.tuiles).padStart(4)}  ` +
      `ecart nue=${etat.nue.ecart.toFixed(2).padStart(6)} eclairee=${etat.eclairee.ecart.toFixed(2).padStart(6)} ` +
      `(${g >= 0 ? '+' : ''}${g.toFixed(1)} %)   ` +
      `ecart/pixel : plancher=${etat.plancher.toFixed(2).padStart(5)} effet=${etat.effet.toFixed(2).padStart(6)} ` +
      `(x${(etat.effet / Math.max(etat.plancher, 1e-6)).toFixed(1)})  bouges=${(etat.partBougee * 100).toFixed(1)} %`)
  } else console.log(
    `${String(Math.round(etat.altitude)).padStart(9)} m  crop=${etat.crop ? 'O' : '.'}  ` +
    `[${b(etat.uCropOn)}${b(etat.uHabOn)}${b(etat.uEclairageOn)}${b(etat.uNormaleFineOn)}` +
    `${b(etat.uAnalysisOn)}${b(etat.uRampCropOn)}${b(etat.uMerZeroSousEau)}]  ` +
    `moy=${String(etat.moy).padStart(7)} ecart=${String(etat.ecart).padStart(6)} ` +
    `H=${String(etat.entropie).padStart(5)} pic=${String(etat.partPic).padStart(6)} n=${etat.tuiles}`)
}

if (SORTIE) {
  const f = path.resolve(RACINE, SORTIE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({ url, cadre: CADRE, quand: new Date().toISOString(), releves }, null, 2))
  console.log('→ ' + f)
}
await nav.close()
