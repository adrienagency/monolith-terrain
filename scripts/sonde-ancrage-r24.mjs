// SONDE D'ANCRAGE R24 — deux questions que la descente ne répond PAS.
//
// ⚠️ **CE SCRIPT EXISTE PARCE QUE LA PREMIÈRE MESURE A RENDU « AUCUN ÉCART ».**
// La descente de `sonde-toponymie-r24.mjs` finit à z16 (emprise 1 710 m) : là,
// le sol du bloc et le sol dessiné par le globe s'accordent à ~0,1 m près, et
// l'ancrage corrigé ne se distingue pas de l'ancien. Les deux questions qui
// séparent réellement les deux versions se posent AILLEURS :
//
//   ① **À LA VUE DE DÉPART (z12, emprise 27 354 m)** — c'est là que la grille
//      13 × 13 a relevé −72,0 / +98,7 m d'écart entre les deux sols, et 25 % de
//      points où le bloc est SOUS le dessin. C'est aussi la vue qu'Adrien voit
//      en ouvrant l'application.
//   ② **SUR UN ALLER-RETOUR DE ZOOM** — le cache d'emprise ne peut rien
//      économiser sur une descente, où chaque cran regarde un rectangle NEUF.
//      Il économise au RETOUR, et c'est là qu'il faut le compter.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5931'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R24'))
const ETIQ = opt('--etiquette', 'ancrage')
fs.mkdirSync(SORTIE, { recursive: true })
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((x) => fs.existsSync(x))
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const nav = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { etiquette: ETIQ, quand: new Date().toISOString() }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  let overpass = 0
  page.on('response', (r) => { if (r.url().includes('overpass')) overpass++ })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(14000)
  await page.keyboard.press('Escape')
  await dodo(2000)

  // la réponse Overpass fabriquée — voir l'en-tête de sonde-toponymie-r24.mjs
  const cdp = await page.createCDPSession()
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*overpass*' }] })
  let servies = 0
  cdp.on('Fetch.requestPaused', async (ev) => {
    servies++
    const bb = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(decodeURIComponent(ev.request.postData || ''))
    const elements = []
    if (bb) {
      const [, s, o, n, e] = bb.map(Number)
      for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) elements.push({ type: 'node', id: i * 10 + j, lat: s + ((n - s) * i) / 6, lon: o + ((e - o) * j) / 6, tags: { natural: 'peak', name: `SONDE ${i}${j}` } })
    }
    const body = JSON.stringify({ elements })
    await cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: '*' }], body: Buffer.from(body).toString('base64') }).catch(() => null)
  })

  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1200)
  await page.evaluate(() => { const e = window.__exp; e.params.peaksEnabled = true; e.peaksLayer.setEnabled(true) })
  await dodo(12000)

  // ① L'ANCRAGE À LA VUE DE DÉPART
  out.depart = await page.evaluate(async () => {
    const e = window.__exp
    const dem = e.terrain.dem
    let poseur = typeof e.poseurDesReperes === 'function' ? e.poseurDesReperes() : null
    if (!poseur) {
      const m = await import('/src/monde/sol-globe.js')
      const cote = dem.empriseCote > 1 ? dem.empriseCote : 1
      poseur = m.poseurPourReconstruction({ globe: e.globe, dem, sample: e.terrain.sample, echelleBloc: ((56 * cote) / dem.extentMeters) * (e.globe.exaggeration ?? 1), actif: true })
    }
    const fen = e.terrain.fenetre ?? { x: 0, z: 0 }
    const rep = e.peaksLayer.markers.map((m) => {
      const solM = e.globe.hauteurDessinee(m.lat, m.lon)
      const repM = poseur.metresDe(m.world.y)
      const blocM = poseur.metresDe(e.terrain.sample(m.world.x - fen.x, m.world.z - fen.z))
      return {
        nom: m.name,
        repereM: +repM.toFixed(1),
        solDessineM: solM == null ? null : +solM.toFixed(1),
        solBlocM: +blocM.toFixed(1),
        hauteurSurSolM: solM == null ? null : +(repM - solM).toFixed(1),
        ecartDesDeuxSolsM: solM == null ? null : +(blocM - solM).toFixed(1),
      }
    })
    return {
      z: e.params.demZoom, altM: Math.round(e.altitudeCadrageM()), extentM: dem.extentMeters,
      degagementM: +(0.5 / poseur.echelleBloc).toFixed(1),
      n: rep.length, sousLeSol: rep.filter((r) => r.hauteurSurSolM != null && r.hauteurSurSolM < 0).length,
      minHauteurM: rep.length ? Math.min(...rep.filter((r) => r.hauteurSurSolM != null).map((r) => r.hauteurSurSolM)) : null,
      reperes: rep,
    }
  })
  console.log('① départ :', JSON.stringify({ z: out.depart.z, degagementM: out.depart.degagementM, n: out.depart.n, sousLeSol: out.depart.sousLeSol, minHauteurM: out.depart.minHauteurM }))
  console.log('   ', JSON.stringify(out.depart.reperes))

  // ② L'ALLER-RETOUR DE ZOOM — le cache ne s'y voit qu'au retour
  out.avantAllerRetour = { overpass, servies }
  const cran = async (d, n) => { for (let i = 0; i < n; i++) { await page.evaluate((dd) => window.__exp.modes.cranZoom(dd), d); await dodo(4500) } }
  await cran(+1, 4)
  out.apresDescente = { overpass, servies }
  await cran(-1, 4)
  out.apresRemontee = { overpass, servies }
  await cran(+1, 4)
  out.apresSecondeDescente = { overpass, servies }
  console.log('② aller-retour :', JSON.stringify({ depart: out.avantAllerRetour, descente: out.apresDescente, remontee: out.apresRemontee, redescente: out.apresSecondeDescente }))

  // ③ LES DEUX SOLS À CE ZOOM-CI, sur une grille de 13 × 13 — c'est la mesure
  // qui dit si le dégagement disponible couvre encore le désaccord.
  out.grille = await page.evaluate(async () => {
    const e = window.__exp
    const dem = e.terrain.dem
    let poseur = typeof e.poseurDesReperes === 'function' ? e.poseurDesReperes() : null
    if (!poseur) {
      const m = await import('/src/monde/sol-globe.js')
      const cote = dem.empriseCote > 1 ? dem.empriseCote : 1
      poseur = m.poseurPourReconstruction({ globe: e.globe, dem, sample: e.terrain.sample, echelleBloc: ((56 * cote) / dem.extentMeters) * (e.globe.exaggeration ?? 1), actif: true })
    }
    if (!poseur?.globe) return { erreur: 'poseur plat' }
    const fen = e.terrain.fenetre ?? { x: 0, z: 0 }
    const d = []
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = (i / 6) * 28 * 0.95, z = (j / 6) * 28 * 0.95
      const b = poseur.metresDe(e.terrain.sample(x - fen.x, z - fen.z))
      const g = poseur.metresDe(poseur.hauteur(x, z))
      d.push(+(b - g).toFixed(1))
    }
    const tri = [...d].sort((a, b) => a - b)
    return {
      z: e.params.demZoom, extentM: dem.extentMeters,
      degagementM: +(0.5 / poseur.echelleBloc).toFixed(1),
      n: d.length, minM: tri[0], medM: tri[(tri.length / 2) | 0], maxM: tri[tri.length - 1],
      blocSousLeDessin: d.filter((v) => v < -1).length,
      // ⛔ LE SEUL CHIFFRE QUI COMPTE : combien de points où le désaccord
      // DÉPASSE le dégagement disponible, c'est-à-dire où l'ancien ancrage
      // aurait enterré le repère.
      enterres: d.filter((v) => v < -(0.5 / poseur.echelleBloc)).length,
    }
  })
  console.log('③ grille :', JSON.stringify(out.grille))

  // ④ L'INTERRUPTEUR ACTIONNÉ CINQ FOIS — un geste réel, et `setEnabled`
  // rappelle `refresh()` donc `fetchTopPeaks` à chaque fois.
  const avantBascule = servies
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { const e = window.__exp; e.params.peaksEnabled = false; e.peaksLayer.setEnabled(false) })
    await dodo(900)
    await page.evaluate(() => { const e = window.__exp; e.params.peaksEnabled = true; e.peaksLayer.setEnabled(true) })
    await dodo(2500)
  }
  out.bascules = { avant: avantBascule, apres: servies, requetesPourCinqBascules: servies - avantBascule }
  console.log('④ cinq bascules de l’interrupteur :', JSON.stringify(out.bascules))
} catch (err) {
  out.erreur = String((err && err.stack) || err)
  console.error(out.erreur)
} finally {
  await nav.close()
  fs.writeFileSync(path.join(SORTIE, `${ETIQ}.json`), JSON.stringify(out, null, 1))
  console.log('→', path.join(SORTIE, `${ETIQ}.json`))
}
