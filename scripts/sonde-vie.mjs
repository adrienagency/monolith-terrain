// VIE — DANS LE CROP, LA TERRE ENTIÈRE NE REVIENT PLUS (sauf molette ou bouton monde).
//
// ⚠️ **UN CHARGEMENT PAR GESTE.** Chaque passe recharge la page, attend la fin du
// vol de démarrage, lève le voile, entre dans le crop par `modes.flyTo` (la seule
// entrée qui n'atterrit pas 32× trop serré — pièges communs), puis joue UN geste
// et relève À CHAQUE IMAGE, au rendu : `pose` (le crop vit ?), `_cropSeul` (le
// quadtree ne parcourt que le crop ?), `porteRepos` (la porte du repos, 0 = les
// alentours), `estompage` (ce qui est POSÉ sur le nuanceur : 1 = le dehors est
// éteint), `sortieArmee`, `auBloc`, l'altitude de CADRAGE (espace bloc) et le
// nombre de tuiles dessinées.
//
// « La Terre est visible » = en surface ET (le crop est mort OU l'estompage posé
// est < 1). C'est la grandeur qu'Adrien voit ; les quatre relevés disent lequel
// des deux chemins — (a) le crop meurt, (b) le dehors est redessiné — l'a produite.
//
//   node scripts/sonde-vie.mjs --geste glisse --repete 8 --port 9601
//   gestes : glisse · glisse-bas · inclin · iso · stepper · goto · molette · monde
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9601'))
const GESTE = opt('--geste', 'glisse')
const REPETE = Number(opt('--repete', '8'))
const ZOOM = Number(opt('--zoom', '10'))
const LIEU = opt('--lieu', '44.2,5.78') // Provence / Alpes du Sud — le lieu de la vidéo d'Adrien
const ETIQ = opt('--etiq', GESTE)
const CAPTURE = A.includes('--capture')
const ICI = path.join(RACINE, '.banc', 'VIE')
fs.mkdirSync(ICI, { recursive: true })

const W = 1280, H = 800, CX = W / 2, CY = H / 2
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

async function voile() {
  for (let k = 0; k < 12; k++) {
    const s = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY]).catch(() => null)
    if (s === 'CANVAS') return
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
  }
  throw new Error('voile non ferme')
}
async function immobile() {
  await page.waitForFunction(() => {
    const e = window.__exp
    if (!e?.camera || !e?.controls || !e?.modes) return false
    const d = e.camera.position.distanceTo(e.controls.target)
    const R = (window.__stab ??= { d: NaN, t: 0 })
    if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
    return !e.modes.busy && !e.modes.travel && performance.now() - R.t > 1500
  }, { timeout: 120000, polling: 100 })
}
async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 180000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await immobile()
  await voile()
}

// ⚠️ **SONDE AU RENDU**, une image = une ligne, installée dans la page.
const lire = () => page.evaluate(() => {
  const e = window.__exp
  const g = e.globe
  const est = e.veilleEstompage
  return {
    t: Math.round(performance.now()),
    alt: Math.round(e.altitudeCadrageM?.() ?? -1),
    d: +e.camera.position.distanceTo(e.controls.target).toFixed(3),
    polaire: +((e.controls.getPolarAngle?.() ?? 0) * 180 / Math.PI).toFixed(2),
    mode: e.modes?.mode ?? null,
    pose: !!e.veilleCrop?.pose, crop: !!g?._crop, cropSeul: !!g?._cropSeul,
    porteRepos: +(est?.porteRepos ?? -1).toFixed(3), estompage: +(est?.valeur ?? -1).toFixed(3),
    auRepos: !!e.veilleRepos?.auRepos, armee: !!e.veilleCrop?.sortieArmee, auBloc: !!e.veilleCrop?.auBloc,
    dessinees: g?._drawn ?? null, busy: !!e.modes?.busy,
  }
})
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const cran = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: d, pointerType: 'mouse' })
async function enregistrer(on) {
  return page.evaluate((on) => {
    const V = (window.__vie ??= { rec: [], on: false })
    V.on = on
    if (!on) return V.rec
    V.rec = []
    const lire = () => {
      const e = window.__exp, g = e.globe, est = e.veilleEstompage
      return {
        t: Math.round(performance.now()), alt: Math.round(e.altitudeCadrageM?.() ?? -1),
        d: +e.camera.position.distanceTo(e.controls.target).toFixed(3),
        polaire: +((e.controls.getPolarAngle?.() ?? 0) * 180 / Math.PI).toFixed(2), mode: e.modes?.mode ?? null,
        pose: !!e.veilleCrop?.pose, crop: !!g?._crop, cropSeul: !!g?._cropSeul,
        porteRepos: +(est?.porteRepos ?? -1).toFixed(3), estompage: +(est?.valeur ?? -1).toFixed(3),
        auRepos: !!e.veilleRepos?.auRepos, armee: !!e.veilleCrop?.sortieArmee, auBloc: !!e.veilleCrop?.auBloc,
        dessinees: g?._drawn ?? null, busy: !!e.modes?.busy,
      }
    }
    const boucle = () => { if (!V.on) return; V.rec.push(lire()); requestAnimationFrame(boucle) }
    requestAnimationFrame(boucle)
    return null
  }, on)
}
const terreVisible = (s) => s.mode === 'surface' && (!s.pose || s.estompage < 0.999)

// ⚠️ **ON ENTRE DANS LE CROP COMME ADRIEN : PAR LE HAUT.** `flyTo(…, 10)` pose
// la caméra à ~50 km, AU-DESSUS de la naissance (32 274 m) ; puis des crans de
// zoom avant, un par un, jusqu'à ce que le crop naisse — il naît donc EN HAUT
// (25 – 31 km), là où un geste qui remonte peut franchir les seuils. Un départ
// au fond du crop (z11 : 3,8 km, sous `ALT_ESTOMPAGE_FIN_M` = 19 364 m) ne
// prouverait rien : l'estompage y vaut 1 par la LOI, quel que soit le repos —
// c'est le banc de PORTE, « qui ne montait pas ».
async function dansLeCrop() {
  const [lat, lon] = LIEU.split(',').map(Number)
  await page.evaluate(([la, lo, z]) => window.__exp.modes.flyTo(la, lo, z), [lat, lon, ZOOM])
  await dodo(3000)
  await immobile()
  await dodo(1000); await wait(20)
  // ⚠️ `flyTo` plonge TOUJOURS à `DIVE_ALT_M` (8 km, 3,8 km de cadrage), quel
  // que soit le zoom demandé : on ressort en orbite basse (`enterOrbit(80 km)`,
  // le chemin du bouton monde) et on REDESCEND à la molette, cran par cran,
  // jusqu'à la naissance — l'entrée d'Adrien, par le haut.
  await page.evaluate(() => window.__exp.modes.enterOrbit(80000))
  await dodo(2500); await immobile(); await wait(10)
  let s = await lire()
  for (let i = 1; i <= 200 && !s.pose; i++) { await cran(-120); await wait(3); s = await lire() }
  await dodo(2500); await wait(40)
  return lire()
}
async function glisser(bouton, dx, dy, images = 20) {
  const buttons = bouton === 'left' ? 1 : bouton === 'middle' ? 4 : 2
  const x0 = CX - dx / 2, y0 = CY - dy / 2
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: bouton, buttons, clickCount: 1 })
  for (let k = 1; k <= images; k++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (dx * k) / images, y: y0 + (dy * k) / images, button: bouton, buttons })
    await wait(2)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + dx, y: y0 + dy, button: bouton, buttons: 0, clickCount: 1 })
}
async function cliquer(sel) {
  const b = await page.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return null
    const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }, sel)
  if (!b) throw new Error(`bouton absent : ${sel}`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', buttons: 1, clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', buttons: 0, clickCount: 1 })
}

function bilan(rec) {
  const vis = rec.filter(terreVisible)
  const morts = rec.filter((s) => !s.pose).length
  const dehors = rec.filter((s) => s.pose && s.estompage < 0.999).length
  const altMax = Math.max(...rec.map((s) => s.alt))
  const pic = vis.length ? vis.reduce((a, b) => (b.estompage < a.estompage ? b : a)) : null
  return { images: rec.length, terreVisibleImages: vis.length, cropMortImages: morts, dehorsDessineImages: dehors, altMax, estompageMin: Math.min(...rec.map((s) => s.estompage)), pic }
}

const R = { geste: GESTE, port: PORT, lieu: LIEU, zoom: ZOOM, quand: new Date().toISOString(), passes: [] }

for (let p = 0; p < REPETE; p++) {
  await neuf()
  const depart = await dansLeCrop()
  if (!depart.pose) { R.passes.push({ erreur: 'pas dans le crop', depart }); etape(`⛔ passe ${p + 1} : crop absent au depart (alt ${depart.alt} m, mode ${depart.mode})`); continue }
  await enregistrer(true)
  let note = {}
  if (GESTE === 'glisse' || GESTE === 'glisse-bas') {
    // le glissé GAUCHE : dans le crop c'est la rotation d'OrbitControls — vers le
    // haut, la caméra remonte vers le nadir jusqu'à la butée (l'altitude monte à
    // distance constante) ; vers le bas, elle s'incline jusqu'à la butée basse.
    const sens = GESTE === 'glisse' ? -1 : 1
    for (let g = 0; g < 4; g++) { await glisser('left', 0, sens * 360, 24); await dodo(600); await wait(5) }
  } else if (GESTE === 'inclin') {
    for (let g = 0; g < 3; g++) { await glisser('middle', 0, -340, 20); await dodo(600); await wait(5) }
  } else if (GESTE === 'iso') {
    // le bouton de vue de caméra (isométries successives)
    for (let g = 0; g < 4; g++) { await cliquer('.ce-isobtn:not(.ce-cinebtn)'); await dodo(2200); await wait(5) }
  } else if (GESTE === 'stepper') {
    // le bouton « − » du stepper vertical : `modes.stepWider()`, sans molette
    for (let g = 0; g < 6; g++) { await cliquer('.zs-minus'); await dodo(1500); await wait(5) }
  } else if (GESTE === 'goto') {
    // un aller-retour de vol : goto vers un lieu voisin, puis retour
    await page.evaluate(() => window.__exp.modes.flyTo(44.9, 6.6, 11))
    await dodo(3000); await immobile()
    note.milieu = await lire()
    await page.evaluate(() => window.__exp.modes.flyTo(44.2, 5.78, 11))
    await dodo(3000); await immobile()
  } else if (GESTE === 'molette') {
    // la SORTIE légitime : trois crans en < 1 s, puis la course — puis rentrer
    let sortie = null
    for (let i = 1; i <= 60; i++) { await cran(120); await wait(2); const s = await lire(); if (!s.pose) { sortie = { cran: i, alt: s.alt }; break } }
    note.sortie = sortie
    await dodo(2500); await wait(10)
    note.reposSortie = await lire()
    let retour = null
    for (let i = 1; i <= 300; i++) { await cran(-120); await wait(2); const s = await lire(); if (s.pose) { retour = { cran: i, alt: s.alt }; break } }
    note.retour = retour
  } else if (GESTE === 'monde') {
    await cliquer('.ce-globebtn')
    await dodo(6000)
  }
  await dodo(2500); await wait(40)
  let rec = await enregistrer(false).catch(() => null)
  if (!rec) {
    // le bouton monde navigue et détruit le contexte : on relit après coup
    await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 }).catch(() => {})
    rec = []
  }
  const apres = await lire().catch(() => null)
  const b = bilan(rec.length ? rec : [apres])
  let capture = null
  if (CAPTURE && b.terreVisibleImages > 0) {
    capture = path.join(ICI, `${ETIQ}-${p + 1}.png`)
    await page.screenshot({ path: capture })
  }
  R.passes.push({ depart, apres, ...note, bilan: b, capture, courbe: rec })
  etape(`${GESTE} ${p + 1}/${REPETE} : crop ${depart.pose}->${apres?.pose} · alt ${depart.alt} -> ${apres?.alt} m (max ${b.altMax}) · Terre visible ${b.terreVisibleImages}/${b.images} images (crop mort ${b.cropMortImages}, dehors dessiné ${b.dehorsDessineImages}) · estompage min ${b.estompageMin} · cropSeul ${apres?.cropSeul} porteRepos ${apres?.porteRepos}${note.sortie ? ` · sortie ${note.sortie.cran} crans` : ''}${note.retour ? ` · retour ${note.retour.cran} crans` : ''}`)
}

const dossier = path.join(ICI, `${ETIQ}.json`)
fs.writeFileSync(dossier, JSON.stringify(R, null, 2))
console.log(`\n=== ${dossier}`)
await nav.close()
