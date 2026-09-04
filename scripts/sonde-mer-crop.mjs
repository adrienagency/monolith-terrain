// SONDE MER — LA NAPPE DÉBORDE-T-ELLE DU CROP, ET DE COMBIEN DE PIXELS ?
//
// ⚡ **DEUX QUESTIONS SÉPARÉES, ET LA SONDE LES SÉPARE.**
//   ① la GÉOMÉTRIE : jusqu'où va la calotte (`_merEtat.portee`, en demi-côtés) ;
//   ② le DÉCOUPAGE : où le nuanceur l'éteint (`uMerBord`), et sur quelle
//      emprise il est posé (`uEstompageOn` / `uEstompage`).
//
// ⚠️ **A/B DANS LA MÊME SESSION, AU GPU, PASSE BRUTE** — le patron de PF3
// (`--pixelab`) : phase du grain remise à 0, `composer.render`, `readPixels`.
// Une capture d'écran composée verrait l'écume et le grain par-dessus.
//
//   A = l'état vivant.
//   B = `uMerBord` forcé au découpage IDÉAL, celui de l'estompage plein
//       (`fin = −RETRAIT_EAU_CROP`, la mer rentre de 0,22 unité de socle comme
//       dans `plinth.js`). La MÊME superellipse que le `discard` des tuiles.
//   diff(A, B) = **la surface de mer dessinée hors de l'emprise du socle**.
//       C'est le chiffre du critère : il doit valoir 0.
//   C = la nappe cachée — sa silhouette entière, pour situer le débordement.
//
// EMPLOI
//   npm run dev -- --host 127.0.0.1 --port 8321
//   node scripts/sonde-mer-crop.mjs --port 8321 --lieu Majorque --repete 8
//
// Sortie : `.banc/MER/<etiquette>.json`
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'MER')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8321'))
// ⛔ **LE LIEU PASSE PAR LE HASH DE DÉMARRAGE, PAS PAR `gotoCtl.go`.**
// `gotoCtl.go` appelle `modes.flyTo`, et PF3 §7.4 a mesuré ce que ce chemin
// laisse derrière lui : `camera.position` et `modes.altM` à **NaN**. Relevé ici
// aussi — après un `go`, la nappe de mer rend **0 pixel** à toutes les
// altitudes et à tous les estompages, c'est-à-dire un banc entier de « 0 px
// hors emprise » qui ne prouve rien. Le hash `#s=` pose le lieu AVANT le
// premier vol : c'est le chemin de `sonde-demarrage.mjs`.
const LIEU = opt('--lieu', '') // « lat,lon[,zoom] », vide = le lieu de démarrage
const ETIQ = opt('--etiquette', 'mer')
const N = Number(opt('--repete', '3'))
const ALTS = opt('--alts', '28000,12000,5000').split(',').map(Number)
const SCENARIO = opt('--scenario', 'poses') // poses | intermittence
const CAPTURES = opt('--captures', '') // dossier où écrire des PNG
const W = 1280, H = 800
const CX = W / 2, CY = H / 2

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: [`--window-size=${W},${H + 120}`, '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
  defaultViewport: { width: W, height: H },
})
let page = (await nav.pages())[0]
let cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

async function pageNeuve() {
  try { await page.close() } catch {}
  page = await nav.newPage()
  cdp = await page.target().createCDPSession()
}

const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function hashDuLieu() {
  if (!LIEU) return ''
  const [lat, lon, zoom] = LIEU.split(',').map((v) => Number(v.trim()))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`lieu illisible : ${LIEU}`)
  return '#s=' + b64url({ loc: { lat, lon, zoom: Number.isFinite(zoom) ? zoom : 13 } })
}

async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/${hashDuLieu()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  // le voile `.ce-elemwrap` avale les gestes — même geste que sonde-cib
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(200)
    const sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY])
    if (sous === 'CANVAS') break
  }
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(2500)
}

const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

async function porter(altM) {
  await page.evaluate(async (a) => {
    const e = window.__exp
    const cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const v = e.altitudeCadrageM()
      if (!Number.isFinite(v) || v <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (a / v)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
  }, altM)
  await wait(10)
  await dodo(2500) // laisser la veille du repos se calmer et la chaîne se poser
  await stabiliser()
}

// ⚠️ **UN RELEVÉ SUR UNE CHAÎNE QUI SE POSE ENCORE NE PROUVE RIEN.** À
// Majorque, sans cette attente, A et B tombaient de part et d'autre d'une repose
// de la mer : le A/B rendait 15 938 px « hors emprise » **avec le correctif**,
// c'est-à-dire exactement la silhouette entière — la nappe avait disparu entre
// les deux captures, pas débordé. On attend donc que la chaîne du crop ne bouge
// plus : même `_merEtat`, mêmes tuiles prêtes, deux relevés de suite.
async function stabiliser(essais = 30) {
  const signature = () => page.evaluate(() => {
    const g = window.__exp.globe
    return JSON.stringify({
      mer: !!g._mer,
      compte: g._merEtat?.compte ?? null,
      couverture: g._merEtat?.couverture ?? null,
      tuiles: g.tiles?.size ?? null,
      busy: !!window.__exp.modes.busy,
    })
  })
  let prec = null, stables = 0
  for (let i = 0; i < essais; i++) {
    const s = await signature()
    if (s === prec) { if (++stables >= 2) return true } else { stables = 0 }
    prec = s
    await dodo(700)
  }
  return false
}

// ⚠️ **L'ÉTAT, LU AU MÊME INSTANT QUE LES PIXELS.** Un relevé pris après coup
// lit un état déjà réécrit — le piège nommé dans le brief.
const ETAT = `(() => {
  const e = window.__exp, g = e.globe, u = g.uniforms
  const mer = g._mer
  const mu = mer ? mer.material.uniforms : null
  return {
    alt: e.altitudeCadrageM?.() ?? null,
    mode: e.modes.mode,
    crop: !!g._crop,
    cropPose: !!e.veilleCrop?.pose,
    auBloc: !!e.veilleCrop?.auBloc,
    estompageOn: u.uEstompageOn.value,
    estompage: u.uEstompage.value,
    veilleValeur: e.veilleEstompage?.valeur ?? null,
    veilleAuSeuil: e.veilleEstompage?.auSeuil ?? null,
    veilleAuRepos: e.veilleEstompage?.auRepos ?? null,
    veilleApplications: e.veilleEstompage?.applications ?? null,
    mer: !!mer,
    portee: g._merEtat?.portee ?? null,
    bord: mu ? [mu.uMerBord.value.x, mu.uMerBord.value.y] : null,
  }
})()`

// A/B au GPU, dans la même session.
const PIXELAB = `(() => {
  const e = window.__exp, gl = e.renderer.getContext()
  const g = e.globe, mer = g._mer
  const passes = e.composer.passes
  const cap = () => {
    for (const p of passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0
    e.composer.render(0)
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
    const a = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a)
    return a
  }
  const diff = (a, b) => { let n = 0, m = 0, s = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])); if (d > 4) n++; if (d > m) m = d; s += d } return { n, max: m, moyen: +(s / (a.length / 4)).toFixed(4), N: a.length / 4 } }
  if (!mer) return { mer: false }
  const mu = mer.material.uniforms
  const bord0 = [mu.uMerBord.value.x, mu.uMerBord.value.y]
  // L IMAGE SE PREND DANS LA MEME TACHE QUE LE RENDU : sans
  // preserveDrawingBuffer, une capture d ecran prise plus tard lit un tampon
  // deja recompose par la boucle rAF. C est ce qui a rendu mes trois premieres
  // captures identiques alors que les pixels disaient 40 % d ecart.
  const png = () => e.renderer.domElement.toDataURL('image/png')
  const A = cap()
  const imgA = png()
  const temoin = diff(A, cap())
  // B — le découpage IDÉAL : la mer rentre de RETRAIT_EAU_CROP, comme au socle
  const RETRAIT = (0.16 + 0.06) / 28
  mu.uMerBord.value.set(-2 * RETRAIT, -RETRAIT)
  const B = cap()
  const imgB = png()
  const horsEmprise = diff(A, B)
  // C — la nappe cachée : sa silhouette entière
  mu.uMerBord.value.set(bord0[0], bord0[1])
  mer.visible = false
  const C = cap()
  const silhouette = diff(A, C)
  mer.visible = true
  const D = cap()
  const retour = diff(A, D)
  return { mer: true, bord0, temoin, horsEmprise, silhouette, retour, imgA, imgB }
})()`

const lire = () => page.evaluate(ETAT)
const pixelab = () => page.evaluate(PIXELAB)

const R = { lieu: LIEU, port: PORT, alts: ALTS, scenario: SCENARIO, viewport: [W, H], date: new Date().toISOString(), passes: [] }

if (CAPTURES) fs.mkdirSync(path.join(RACINE, CAPTURES), { recursive: true })

// ⚠️ **LES DEUX IMAGES DU A/B, TELLES QUE LE GPU LES A RENDUES** — c'est ce
// qu'Adrien regarde : la mer vivante, et la mer écrêtée à l'emprise.
const sansImages = (ab) => { if (!ab) return ab; const { imgA, imgB, ...r } = ab; return r }

function ecrirePng(base, ab) {
  if (!ab || !ab.imgA) return
  const brut = (d) => Buffer.from(String(d).split(',')[1], 'base64')
  fs.writeFileSync(path.join(RACINE, CAPTURES, `${base}-A.png`), brut(ab.imgA))
  fs.writeFileSync(path.join(RACINE, CAPTURES, `${base}-B.png`), brut(ab.imgB))
}

for (let k = 0; k < N; k++) {
  let ok = false
  for (let essai = 0; essai < 3 && !ok; essai++) {
    try { await neuf(); ok = true }
    catch (err) { etape(`  chargement raté (${err.message.slice(0, 80)})`); await pageNeuve() }
  }
  if (!ok) throw new Error('trois chargements ratés')
  const passe = { i: k, postes: [] }

  if (SCENARIO === 'intermittence') {
    // ⚡ **CE QUE LE « PARFOIS » DEMANDE** : les instants où l'emprise peut
    // n'être pas repassée — orbite aller-retour, sortie/rentrée du crop,
    // déménagement du crop (le socle bouge sans que le crop meure).
    await porter(12000)
    passe.postes.push({ nom: 'pose', etat: await lire(), ab: await pixelab() })
    await page.evaluate(() => window.__exp.modes.enterOrbit?.())
    await dodo(4000)
    passe.postes.push({ nom: 'orbite', etat: await lire() })
    await page.evaluate(() => window.__exp.modes.exitOrbit?.() ?? window.__exp.modes.enterSurface?.())
    await dodo(4000)
    await porter(12000)
    passe.postes.push({ nom: 'retour-surface', etat: await lire(), ab: await pixelab() })
    // déménagement : on translate la cible d'un demi-bloc
    await page.evaluate(() => {
      const e = window.__exp, ct = e.controls, cam = e.camera
      const d = cam.position.clone().sub(ct.target)
      ct.target.x += 20; cam.position.copy(ct.target).add(d); ct.update?.()
    })
    await wait(6); await dodo(3000)
    passe.postes.push({ nom: 'demenagement', etat: await lire(), ab: await pixelab() })
  } else if (SCENARIO === 'estompage') {
    // ⚡ **LA MESURE PARAMÉTRIQUE** : l'estompage est une RAMPE, et la nappe la
    // suit. On pose chaque valeur que l'application pose réellement pendant un
    // mouvement, et on lit combien de pixels de mer tombent hors de l'emprise.
    for (const altCourante of ALTS) {
    await porter(Number(altCourante))
    for (const e of [0, 0.22, 0.5, 0.75, 1]) {
      await page.evaluate((v) => { window.__exp.globe.poserEstompage(v) }, e)
      await wait(3)
      const etat = await lire()
      const ab = await pixelab()
      passe.postes.push({ nom: `alt${altCourante}-estompage${e}`, etat, ab: sansImages(ab) })
      const pc = ab.horsEmprise ? (100 * ab.horsEmprise.n / ab.horsEmprise.N).toFixed(3) : '-'
      // ⚠️ **UN ZÉRO SUR UNE NAPPE INVISIBLE NE PROUVE RIEN** : si la
      // silhouette est nulle, le poste ne porte pas de mer à l'écran et son
      // « 0 px hors emprise » est une tautologie. On le DIT.
      const vide = !ab.silhouette || ab.silhouette.n === 0
      etape(`#${k + 1} ${altCourante} m · estompage ${e} → bord [${etat.bord?.map((v) => v.toFixed(4)).join(', ')}] · HORS EMPRISE ${ab.horsEmprise?.n} px (${pc} %) · silhouette ${ab.silhouette?.n} px${vide ? ' ⚠️ AUCUNE MER À L ÉCRAN — poste non probant' : ''} · témoin ${ab.temoin?.n}`)
      if (CAPTURES) ecrirePng(`${ETIQ}-p${k}-${altCourante}-est${e}`, ab)
    }
    }
  } else if (SCENARIO === 'mouvement') {
    // ⚡ **CE QUE FAIT UN VRAI GESTE** : on relève `veilleEstompage.valeur` à
    // chaque image pendant un zoom à la molette. Aucun réglage forcé.
    await porter(Number(ALTS[0]))
    const journal = await page.evaluate(async () => {
      const e = window.__exp
      const el = e.renderer.domElement
      const suivi = []
      let images = 0
      const boucle = () => {
        suivi.push({ i: images, est: e.globe.uniforms.uEstompage.value, on: e.globe.uniforms.uEstompageOn.value, repos: e.veilleEstompage?.auRepos ?? null, bordFin: e.globe._mer ? e.globe._mer.material.uniforms.uMerBord.value.y : null })
        if (++images < 180) requestAnimationFrame(boucle)
      }
      requestAnimationFrame(boucle)
      for (let k = 0; k < 3; k++) {
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }))
        await new Promise((r) => setTimeout(r, 400))
      }
      await new Promise((r) => setTimeout(r, 2200))
      return suivi
    })
    const min = journal.reduce((m, s) => (s.est < m.est ? s : m), journal[0])
    const maxFin = journal.reduce((m, s) => ((s.bordFin ?? -9) > (m.bordFin ?? -9) ? s : m), journal[0])
    passe.postes.push({ nom: 'mouvement', journal, min, maxFin })
    etape(`#${k + 1} mouvement : estompage min ${min.est.toFixed(3)} (image ${min.i}) · bord.fin max ${maxFin.bordFin?.toFixed(4)} (image ${maxFin.i}) · images sous 1 : ${journal.filter((s) => s.est < 0.999).length}/${journal.length}`)
  } else {
    for (const alt of ALTS) {
      await porter(alt)
      const etat = await lire()
      const ab = await pixelab()
      passe.postes.push({ nom: `alt${alt}`, etat, ab: sansImages(ab) })
      const pc = ab.horsEmprise ? (100 * ab.horsEmprise.n / ab.horsEmprise.N).toFixed(3) : '-'
      etape(`#${k + 1} ${alt} m → alt ${Math.round(etat.alt)} · crop ${etat.crop} · estOn ${etat.estompageOn} est ${etat.estompage.toFixed(3)} · portee ${etat.portee} · bord [${etat.bord?.map((v) => v.toFixed(4)).join(', ')}] · HORS EMPRISE ${ab.horsEmprise?.n ?? '-'} px (${pc} %) · silhouette ${ab.silhouette?.n ?? '-'} px · témoin ${ab.temoin?.n ?? '-'} · retour ${ab.retour?.n ?? '-'}`)
      if (CAPTURES) ecrirePng(`${ETIQ}-p${k}-${alt}`, ab)
    }
  }
  R.passes.push(passe)
  if (SCENARIO === 'intermittence') {
    for (const p of passe.postes) {
      etape(`#${k + 1} ${p.nom} : estOn ${p.etat.estompageOn} est ${p.etat.estompage.toFixed(3)} veille ${p.etat.veilleValeur} (app ${p.etat.veilleApplications}) crop ${p.etat.crop} bord [${p.etat.bord?.map((v) => v.toFixed(4)).join(', ')}] hors ${p.ab?.horsEmprise?.n ?? '-'}`)
    }
  }
  await pageNeuve()
}

fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(R, null, 2))
console.log(`\n=== .banc/MER/${ETIQ}.json`)
await nav.close()
