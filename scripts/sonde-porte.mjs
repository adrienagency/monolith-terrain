// PORTE — LA MOLETTE DOIT SORTIR DU CROP *ET* Y FAIRE RENTRER.
//
// ⚠️ **UN CHARGEMENT PAR SITUATION.** Chaque passe recharge la page, attend la fin
// du vol de démarrage (la pose arrive entre 30,7 et 33,6 km, À CHEVAL sur le seuil
// de naissance 32 274 m — sans cette attente on mesure une renaissance qui n'a pas
// lieu une fois sur deux), lève le voile `.ce-elemwrap` (`elementFromPoint` doit
// rendre le `CANVAS`), puis joue la situation et relève cran par cran.
//
// Les épreuves (`--epreuve`) :
//   retour  : dans le crop → dézoom jusqu'à la mort → zoom avant jusqu'à la
//             renaissance. Compte les crans DES DEUX CÔTÉS.
//   ar3     : le même aller-retour TROIS FOIS de suite, même chargement.
//   inclin  : dans le crop, incliner fort — le crop doit VIVRE (D21 ①).
//
//   node scripts/sonde-porte.mjs --epreuve retour --repete 8 --port 9533
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9533'))
const EPREUVE = opt('--epreuve', 'retour')
const REPETE = Number(opt('--repete', '8'))
const PLAFOND = Number(opt('--plafond', '120'))
const CRANS_DEPART = Number(opt('--crans', '30'))
const LIEU = opt('--lieu', '43.05,6.15')
const ETIQ = opt('--etiq', EPREUVE)
const ICI = path.join(RACINE, '.banc', 'PORTE')
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
// ⚠️ **SONDE AU RENDU**, pas dans `controls.update`. `altitudeCadrageM()` est la
// grandeur que la loi du crop lit (espace BLOC) ; `altFondM` est en espace GLOBE.
const lire = () => page.evaluate(() => {
  const e = window.__exp
  const g = e.camGlobe ?? e.camera
  return {
    altCadrageM: Math.round(e.altitudeCadrageM?.() ?? -1),
    altFondM: Math.round((g.position.length() - 100) * 63710),
    d: e.camera.position.distanceTo(e.controls.target),
    max: e.controls.maxDistance, min: e.controls.minDistance,
    niveau: e.modes?.zoomNiveau?.() ?? null,
    poussee: !!e.modes?.pousseeSortieActive,
    pose: !!e.veilleCrop?.pose, armee: !!e.veilleCrop?.sortieArmee,
    auBloc: !!e.veilleCrop?.auBloc, mode: e.modes?.mode ?? null,
    compte: e.confirmationSortie?.compte ?? null, arme: !!e.confirmationSortie?.arme,
  }
})
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
const cran = (d) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: d, pointerType: 'mouse' })

async function dansLeCrop() {
  await page.evaluate((l) => window.__exp.gotoCtl.go(l), LIEU)
  await dodo(8000); await wait(30)
  // ⚠️ `--crans` règle la PROFONDEUR du départ dans le crop. Pour l'épreuve
  // d'inclinaison il faut rester HAUT (juste sous la naissance, ~31 km) : une
  // inclinaison ne monte l'altitude que de ×1,25 (mesuré, `apres-d19-8.json`),
  // donc depuis 460 m elle n'approchera JAMAIS `SEUIL_MORT_M` et l'épreuve ne
  // prouverait rien de D21 ①.
  for (let k = 0; k < CRANS_DEPART; k++) { await cran(-120); await wait(2) }
  await dodo(2500); await wait(10)
  return lire()
}

// Un sens : des crans de même signe jusqu'à ce que `pose` vaille `cible`.
async function jusqua(signe, cible) {
  const courbe = []
  let fin = null
  for (let i = 1; i <= PLAFOND; i++) {
    await cran(120 * signe)
    await wait(2)
    const s = await lire()
    courbe.push({ cran: i, alt: s.altCadrageM, pose: s.pose, armee: s.armee, poussee: s.poussee, d: +s.d.toFixed(3), max: +s.max.toFixed(3), niveau: s.niveau == null ? null : +s.niveau.toFixed(4), mode: s.mode })
    if (s.pose === cible) { fin = { cran: i, ...s }; break }
  }
  return { courbe, fin, crans: fin?.cran ?? null, cransArmement: courbe.find((c) => c.poussee)?.cran ?? null }
}

const R = { epreuve: EPREUVE, port: PORT, quand: new Date().toISOString(), passes: [] }

for (let p = 0; p < REPETE; p++) {
  await neuf()
  const depart = await dansLeCrop()
  if (!depart.pose) { R.passes.push({ erreur: 'pas dans le crop', depart }); etape(`⛔ passe ${p + 1} : crop absent au depart`); continue }

  if (EPREUVE === 'inclin') {
    // D21 ① : l'inclinaison ne tue pas le crop, quelle que soit l'altitude.
    // ⚠️ **TROIS GLISSÉS, ET C'EST LE MINIMUM POUR QUE L'ÉPREUVE PROUVE QUELQUE
    // CHOSE.** Une inclinaison ne monte l'altitude que de ×1,25 (mesuré,
    // `apres-d19-8.json`) : depuis un départ à 31 km il en faut plusieurs pour
    // dépasser franchement `SEUIL_MORT_M` = 40 343 m. Un seul glissé laisserait
    // le crop en deçà du seuil, et « le crop vit » ne dirait rien de D21 ①.
    const etapes = []
    for (let g = 0; g < 3; g++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY + 200, button: 'middle', buttons: 4, clickCount: 1 })
      for (let k = 1; k <= 20; k++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX, y: CY + 200 - k * 17, button: 'middle', buttons: 4 }); await wait(2) }
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX, y: CY - 140, button: 'middle', buttons: 0, clickCount: 1 })
      await dodo(1200); await wait(10)
      etapes.push(await lire())
    }
    const apres = etapes[etapes.length - 1]
    const altMax = Math.max(...etapes.map((e) => e.altCadrageM))
    const vivant = etapes.every((e) => e.pose)
    R.passes.push({ depart, etapes, apres, altMax, vivant })
    etape(`inclin ${p + 1}/${REPETE} : crop ${depart.pose}->${etapes.map((e) => e.pose).join(',')} · alt ${depart.altCadrageM} -> ${etapes.map((e) => e.altCadrageM).join(',')} m (max ${altMax})`)
    continue
  }

  if (EPREUVE === 'monde') {
    // L'AUTRE sortie (D21 ①, le bouton « map monde »), puis la descente : le crop
    // doit renaître. ⚠️ Rien de la poussée ne doit survivre à ce chemin-là.
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.ce-globebtn'); if (!b) return null
      const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', buttons: 0, clickCount: 1 })
    await dodo(7000)
    // ⚠️ **LE BOUTON MONDE NAVIGUE** (il réécrit l'URL) : le contexte
    // d'exécution de la page est détruit sous les pieds du banc. Une première
    // écriture de cette épreuve mourait ici en « Execution context was
    // destroyed » — ce n'était PAS un défaut de l'application.
    await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
    for (let k = 0; k < 12; k++) {
      const s = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY]).catch(() => null)
      if (s === 'CANVAS') break
      await page.keyboard.press('Escape').catch(() => {}); await dodo(250)
    }
    await wait(30)
    const sorti = await lire()
    const retour = await jusqua(-1, true)
    await dodo(2500); await wait(10)
    const apres = await lire()
    R.passes.push({ depart, sorti, cransRetour: retour.crans, altRenaissance: retour.fin?.altCadrageM ?? null, apres, courbeRetour: retour.courbe })
    etape(`monde ${p + 1}/${REPETE} : sorti pose ${sorti.pose} mode ${sorti.mode} alt ${sorti.altCadrageM} m · retour ${retour.crans ?? 'JAMAIS'} crans · crop ${apres.pose}`)
    continue
  }

  const tours = EPREUVE === 'ar3' ? 3 : 1
  const cycles = []
  let ok = true
  for (let t = 0; t < tours && ok; t++) {
    const sortie = await jusqua(+1, false)
    await dodo(2500); await wait(10)
    const reposSortie = await lire()
    let retour = { courbe: [], fin: null, crans: null }
    if (sortie.fin) {
      retour = await jusqua(-1, true)
      await dodo(2500); await wait(10)
    }
    const reposRetour = await lire()
    cycles.push({
      tour: t + 1,
      cransSortie: sortie.crans, cransArmement: sortie.cransArmement,
      altMort: sortie.fin?.altCadrageM ?? null, reposSortie,
      cransRetour: retour.crans, altRenaissance: retour.fin?.altCadrageM ?? null, reposRetour,
      courbeSortie: sortie.courbe, courbeRetour: retour.courbe,
    })
    etape(`  tour ${t + 1} : sortie ${sortie.crans ?? 'JAMAIS'} crans (mort ${sortie.fin?.altCadrageM ?? '—'} m, repos ${reposSortie.altCadrageM} m) · retour ${retour.crans ?? 'JAMAIS'} crans (renaissance ${retour.fin?.altCadrageM ?? '—'} m)`)
    if (!sortie.fin || !retour.fin) ok = false
  }
  R.passes.push({ depart, cycles })
  etape(`${EPREUVE} ${p + 1}/${REPETE} : ${cycles.map((c) => `${c.cransSortie ?? 'X'}/${c.cransRetour ?? 'X'}`).join(' · ')}`)
}

const dossier = path.join(ICI, `${ETIQ}.json`)
fs.writeFileSync(dossier, JSON.stringify(R, null, 2))
console.log(`\n=== ${dossier}`)
await nav.close()
