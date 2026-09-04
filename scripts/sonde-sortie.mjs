// SORTIE — LA MOLETTE DOIT SORTIR DU CROP EN QUELQUES CRANS.
//
// ⚠️ **UN GESTE PAR CHARGEMENT.** Chaque passe recharge la page, attend la fin du
// vol de démarrage (la pose arrive entre 30,7 et 33,6 km, À CHEVAL sur le seuil de
// naissance revenu à 32 274 m — sans cette attente on mesure un crop qui n'existe
// pas encore, une fois sur deux), lève le voile `.ce-elemwrap` (`elementFromPoint`
// doit rendre le `CANVAS`, sinon les crans partent dans le vide), puis joue UN
// geste et relève.
//
// Les épreuves (`--epreuve`) :
//   sortie   : dans le crop, dézoom cran par cran jusqu'à la mort du crop
//   isole    : dans le crop, UN SEUL cran de dézoom — le crop doit VIVRE
//   courbe   : dans le crop, la courbe d'altitude cran par cran (zoom ordinaire)
//   horscrop : hors du crop, la molette zoome-t-elle comme avant ?
//
//   node scripts/sonde-sortie.mjs --epreuve sortie --repete 8 --port 8433
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8433'))
const EPREUVE = opt('--epreuve', 'sortie')
const REPETE = Number(opt('--repete', '8'))
const PLAFOND = Number(opt('--plafond', '300'))
const ETIQ = opt('--etiq', EPREUVE)
const ICI = path.join(RACINE, '.banc', 'SORTIE')
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

async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 180000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  // le vol de démarrage : distance stable 1,5 s, `d > 100`, `modes` au repos
  await page.waitForFunction(() => {
    const e = window.__exp
    const d = e.camera.position.distanceTo(e.controls.target)
    const R = (window.__stab ??= { d: NaN, t: 0 })
    if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
    return d > 100 && !e.modes.busy && performance.now() - R.t > 1500
  }, { timeout: 120000, polling: 100 })
  for (let k = 0; k < 12; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
    const s = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY])
    if (s === 'CANVAS') return
  }
  throw new Error('voile non ferme')
}
// ⚠️ **SONDE AU RENDU**, pas dans `controls.update` : `altitudeCadrageM()` est la
// grandeur que la loi du crop lit (espace BLOC) — `altFondM` est en espace GLOBE
// et vaut ~2 × celle-ci. Les confondre a déjà produit un faux constat (REV n° 4).
const lire = () => page.evaluate(() => {
  const e = window.__exp
  const g = e.camGlobe ?? e.camera
  return {
    altCadrageM: Math.round(e.altitudeCadrageM?.() ?? -1),
    altFondM: Math.round((g.position.length() - 100) * 63710),
    d: e.camera.position.distanceTo(e.controls.target),
    max: e.controls.maxDistance, min: e.controls.minDistance,
    niveau: e.modes?.zoomNiveau?.() ?? null, vel: e.modes?._zoomVel ?? null,
    poussee: !!e.modes?.pousseeSortieActive,
    pose: !!e.veilleCrop?.pose, armee: !!e.veilleCrop?.sortieArmee,
    auBloc: !!e.veilleCrop?.auBloc, mode: e.modes?.mode ?? null,
  }
})
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const cran = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: d, pointerType: 'mouse' })

// Descendre jusqu'au crop, à la molette (le geste de l'utilisateur).
async function dansLeCrop() {
  await page.evaluate(() => window.__exp.gotoCtl.go('43.05,6.15'))
  await dodo(8000); await wait(30)
  for (let k = 0; k < 30; k++) { await cran(-120); await wait(2) }
  await dodo(2500); await wait(10)
  return lire()
}

const R = { epreuve: EPREUVE, port: PORT, quand: new Date().toISOString(), passes: [] }

for (let p = 0; p < REPETE; p++) {
  await neuf()
  if (EPREUVE === 'horscrop') {
    // ⚠️ **HORS DU CROP POUR DE VRAI.** Un `goto` atterrit DANS le crop : la
    // première écriture de cette épreuve mesurait `crop true->true` et se croyait
    // dehors. On sort donc par la sortie qui n'est pas mesurée ici — le bouton
    // « map monde » — puis on joue TROIS crans de dézoom : plus que
    // `CRANS_SORTIE`, donc de quoi attraper une poussée qui fuirait hors du crop.
    await page.evaluate(() => window.__exp.gotoCtl.go('43.05,6.15'))
    await dodo(8000); await wait(30)
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.ce-globebtn'); if (!b) return null
      const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', buttons: 0, clickCount: 1 })
    await dodo(7000); await wait(30)
    const avant = await lire()
    for (let i = 0; i < 3; i++) { await cran(120); await wait(6) }
    await dodo(2500); await wait(10)
    const apres = await lire()
    R.passes.push({ avant, apres, rapportAlt: apres.altFondM / avant.altFondM, poussee: apres.poussee })
    etape(`hors crop ${p + 1}/${REPETE} : mode ${avant.mode}->${apres.mode} · crop ${avant.pose}->${apres.pose} · alt ${avant.altFondM} -> ${apres.altFondM} m (×${(apres.altFondM / avant.altFondM).toFixed(4)}) · poussee ${apres.poussee}`)
    continue
  }
  const depart = await dansLeCrop()
  if (!depart.pose) { R.passes.push({ erreur: 'pas dans le crop', depart }); etape(`⛔ passe ${p + 1} : crop absent au depart`); continue }
  if (EPREUVE === 'isole') {
    await cran(120)
    await dodo(3000); await wait(20)
    const apres = await lire()
    R.passes.push({ depart, apres })
    etape(`isole ${p + 1}/${REPETE} : crop ${depart.pose}->${apres.pose} · ${depart.altCadrageM} -> ${apres.altCadrageM} m`)
    continue
  }
  if (EPREUVE === 'courbe') {
    // la courbe du zoom ORDINAIRE, relevée cran par cran — la preuve que D19 tient.
    // ⚠️ **DEUX CRANS DE DÉZOOM, PAS DOUZE — et c'est le sens même du correctif.**
    // Au-delà de `CRANS_SORTIE` un dézoom EST une sortie : mesurer douze crans
    // arrière mesurerait la sortie, pas le zoom ordinaire. Le zoom ordinaire du
    // crop, c'est le zoom AVANT et la correction de un ou deux crans.
    const arriere = [], avant = []
    for (let i = 1; i <= 2; i++) { await cran(120); await wait(6); arriere.push((await lire()).altCadrageM) }
    await dodo(1500)
    for (let i = 1; i <= 12; i++) { await cran(-120); await wait(6); avant.push((await lire()).altCadrageM) }
    R.passes.push({ depart, arriere, avant })
    etape(`courbe ${p + 1}/${REPETE} : arriere ${arriere.join(' ')} | avant ${avant.join(' ')}`)
    continue
  }
  // sortie : un cran, une lecture, jusqu'à la mort du crop
  const courbe = []
  let mort = null
  for (let i = 1; i <= PLAFOND; i++) {
    await cran(120)
    await wait(2)
    const s = await lire()
    courbe.push({ cran: i, alt: s.altCadrageM, pose: s.pose, armee: s.armee, poussee: s.poussee, d: +s.d.toFixed(3), max: +s.max.toFixed(3), niveau: s.niveau == null ? null : +s.niveau.toFixed(4) })
    if (!s.pose) { mort = { cran: i, ...s }; break }
  }
  const armement = courbe.find((c) => c.poussee)?.cran ?? null
  R.passes.push({ depart, mort, crans: mort?.cran ?? null, cransArmement: armement, courbe })
  etape(`sortie ${p + 1}/${REPETE} : ${mort ? `${mort.cran} crans (armee au ${armement})` : `JAMAIS en ${PLAFOND}`} · depart ${depart.altCadrageM} m · mort ${mort?.altCadrageM ?? '—'} m`)
}

const dossier = path.join(ICI, `${ETIQ}.json`)
fs.writeFileSync(dossier, JSON.stringify(R, null, 2))
console.log(`\n=== ${dossier}`)
await nav.close()
