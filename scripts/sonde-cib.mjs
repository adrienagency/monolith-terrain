// SONDE CIB — LA CIBLE : le centre d'abord, la périphérie en basse définition.
//
// ══════════ CE QU'ELLE MESURE, ET POURQUOI CELLES-LÀ ════════════════════════
//
// Le brief D22 pose trois questions et un piège. Cette sonde répond aux quatre.
//
//  ① **La loi de priorité est-elle une vraie cible ?** On relève, DANS `update()`
//     et pour chaque entrée de file suivie, le couple (distance écran du bord de
//     la tuile au centre, en NDC · clé `_priorite`). Le nuage de points EST la
//     courbe. On y ajoute un balayage SYNTHÉTIQUE de la loi (d = 0 → 4 par pas
//     de 0,05) pour la tracer même quand la file est vide.
//
//  ② **La basse définition de périphérie existe-t-elle déjà (R37) ?** Grille de
//     32 × 18 points d'écran, tuile DESSINÉE sous chaque point (comme R37), mais
//     séparée en DEUX populations par le rayon de la cible (`R_CIBLE`, le disque
//     qui couvre la moitié des pixels) : `retardCentre` / `retardPeri` et,
//     surtout, `couvertPeri` — la fraction de la PÉRIPHÉRIE dessinée par un
//     ancêtre pendant que le centre charge encore. Si elle vaut 1 et que les
//     trous valent 0, la « version low def » d'Adrien est déjà là, gratuitement,
//     et il n'y a pas de seconde mécanique à écrire.
//
//  ③ **La barrière tient-elle sans vider les créneaux ?** ⚠️ C'EST LE PIÈGE
//     NOMMÉ PAR LE BRIEF : « le gain de PF2 est venu de vider la file, pas du
//     vol ; une barrière mal posée laisse des créneaux vides ». On mesure donc
//     le **taux d'occupation des six créneaux**, de DEUX façons qui ne mentent
//     pas de la même manière :
//       · par IMAGE (`vol / MAX_CONCURRENT` relevé dans `update()`) — la vue du
//         parcours, mais elle rate ce qui se passe entre deux images ;
//       · par le TEMPS (échantillon toutes les 5 ms hors rAF) — la vraie
//         occupation du tuyau, y compris pendant les longues tâches où aucune
//         image ne passe. Les deux sont dans le rapport ; c'est la seconde qui
//         juge.
//     Plus les compteurs de la barrière : images tenues, raffinements retenus,
//     échéances anti-famine déclenchées.
//
//  ④ **Le critère d'Adrien** : le temps jusqu'à la PREMIÈRE IMAGE NETTE AU
//     CENTRE — définition de PF2, l'instant après l'arrêt du geste où `zCentre`
//     (le niveau de la tuile DESSINÉE sous le centre de l'écran, rayon → sphère
//     → lat/lon → quadtree) atteint sa valeur finale et n'en redescend plus.
//
//  ⑤ **Le 404 → AWS** : les réponses sont comptées PAR HÔTE ET PAR STATUT au
//     protocole CDP (`Network.responseReceived`), donc les 404 Mapterhorn se
//     lisent séparément des requêtes utiles. ⚠️ `getEntriesByType('resource')`
//     plafonne à 250 et ne dit pas le statut : il n'est pas utilisé ici.
//
// ══════════ CE QUI DIFFÈRE DE LA PRODUCTION ═════════════════════════════════
// Chrome sans tête `--headless=new --use-angle=default`, 1280 × 720, pixelRatio
// 1 ; serveur `vite` de DEV (donc modules non groupés) ; le geste est une rafale
// de molette à 40 ms, inertielle, donc NON déterministe d'un tirage à l'autre
// (R37 : 1 100 à 2 300 images par descente). ⚠️ **L'A/B se fait DANS LA MÊME
// SESSION** par le levier `globe.barriereCible` — le pixel n'est comparable
// qu'ainsi (brief PF1). La machine est partagée avec d'autres agents : les
// FRACTIONS, les COMPTES et les ORDRES se comparent, les temps absolus sont
// bruités, et les paires avant/après sont ENTRELACÉES.
//
// EMPLOI
//   node scripts/sonde-cib.mjs --port 7621 --etiquette apres-chamonix \
//     --lieu Chamonix --barriere 1 --cpu 4 --depart 800000 --arrivee 20000
// Sort `.banc/CIB/<etiquette>.json`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '7621'))
const ETIQ = opt('--etiquette', 'releve')
const CPU = Number(opt('--cpu', '1'))
const LIEU = opt('--lieu', '')
const BARRIERE = opt('--barriere', '1') !== '0'
const DEPART_M = Number(opt('--depart', '800000'))
const ARRIVEE_M = Number(opt('--arrivee', '20000'))
const PERIODE = Number(opt('--periode', '40'))
const VISIBLE = opt('--visible', '0') !== '0'
// ⚠️ **LE DÉBIT EST UN PARAMÈTRE, PAS UN DÉCOR.** La barrière ordonnance des
// CRÉNEAUX ; elle ne peut rien rendre là où les créneaux ne sont pas le goulot.
// Sur la liaison de cette machine, le premier A/B mesurait 20 à 26 % de créneaux
// VIDES à CPU ×4 : le tuyau n'était pas plein, donc retenir la périphérie
// n'accélérait rien (mesuré, §3 du rapport). PF2 travaillait sur un réseau que
// l'application classe « lent » (1,4–1,6 Mb/s) — c'est ce régime-là qu'il faut
// reproduire pour juger, et `--reseau <kbps>` le pose au protocole CDP.
const RESEAU = Number(opt('--reseau', '0'))
const REQUETE = opt('--query', '') // ex. `trous=0` pour débrancher le 404 → AWS
const FAMINE = opt('--famine', '0') !== '0' // coupe le réseau des tuiles du CENTRE
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'CIB'))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ═══════════════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ═══════════════════════
function INSTRUMENTER() {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__cib) return 'déjà posé'
  const g = e.globe
  const P = { phase: 'attente', images: [], nuage: [], creneaux: { n: 0, somme: 0, plein: 0, vide: 0 } }
  window.__cib = P
  const ROOT_Z = 2, MAX_Z = 15, SPLIT = 0.38, ZOOM_SOCLE = 13, MAX_CONCURRENT = 6
  const R_CIBLE = Math.sqrt(2 / Math.PI) // le disque qui couvre la MOITIÉ des pixels
  const PLANCHER = 1 * (100 / 6371000)
  const NX = 32, NY = 18
  const R2D = 180 / Math.PI
  P.rCible = R_CIBLE

  // ⚠️ L'OCCUPATION DES CRÉNEAUX SE PREND HORS rAF. Un échantillon par image ne
  // voit pas ce qui se passe pendant une tâche longue (46 à 56 par descente,
  // jusqu'à 200 ms, PF2 §3) — or c'est exactement là qu'un créneau vide coûte.
  P.echantillonneur = setInterval(() => {
    const c = P.creneaux
    c.n++; c.somme += g.inFlight
    if (g.inFlight >= MAX_CONCURRENT) c.plein++
    if (g.inFlight === 0) c.vide++
  }, 5)

  const tuileXY = (lat, lon, z) => {
    const n = 2 ** z
    const la = lat * Math.PI / 180
    return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)]
  }
  const dessineeSous = (lat, lon) => {
    for (let z = MAX_Z; z >= ROOT_Z; z--) {
      const [x, y] = tuileXY(lat, lon, z)
      const t = g.tiles.get(`${z}/${x}/${y}`)
      if (t && t.mesh && t.mesh.visible) return t
    }
    return null
  }
  const dansCrop = (z, x, y) => {
    const rep = g._crop
    if (!rep) return false
    const n = 2 ** z
    if ((y + 1) / n <= rep.cy - rep.demi || y / n >= rep.cy + rep.demi) return false
    let dx = (x + 0.5) / n - rep.cx; dx -= Math.round(dx)
    return Math.abs(dx) < rep.demi + 0.5 / n
  }
  const zVoulu = (t, camPos) => {
    if (dansCrop(t.z, t.x, t.y)) return Math.max(t.z, ZOOM_SOCLE)
    let z = t.z, chord = t.chord
    const d0 = camPos.distanceTo(t.center)
    while (z < MAX_Z) {
      const dist = Math.max(d0 - chord * 0.5, PLANCHER)
      if (chord / dist > SPLIT) { z++; chord /= 2 } else break
    }
    return z
  }
  const appl = (m, x, y, z) => {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]
  }

  let msTraverse = 0, profondeur = 0
  const travOrig = g._traverse.bind(g)
  g._traverse = function (t, a, b) {
    if (profondeur === 0) { const d = performance.now(); profondeur++; try { return travOrig(t, a, b) } finally { profondeur--; msTraverse += performance.now() - d } }
    profondeur++; try { return travOrig(t, a, b) } finally { profondeur-- }
  }

  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    msTraverse = 0
    const a = performance.now()
    const out = updOrig(camera, dt)
    const msUpdate = performance.now() - a

    // ① LE NUAGE (d, clé) — les entrées SUIVIES de la file, telles que la pompe
    //    vient de les trier. Échantillonné (une image sur 12) : 200 images de
    //    file complète pèsent plus que tout le reste du relevé.
    if (g.frame % 12 === 0 && g.continu && g._matVue) {
      for (const en of g.queue) {
        if (!en.suivie) continue
        const d = g._distanceEcran ? g._distanceEcran(en.t) : null
        if (d === null || !isFinite(d)) continue
        P.nuage.push([Math.round(d * 1000) / 1000, Math.round(g._priorite(en.t) * 100) / 100, en.t.z])
        if (P.nuage.length > 20000) P.nuage.splice(0, 5000)
      }
    }

    const p = camera.position
    const R = g.radius
    const inv = camera.projectionMatrixInverse
    const mw = camera.matrixWorld
    // le rayon monde d'un point NDC
    const rayon = (nx, ny) => {
      const w1 = appl(inv.elements, nx, ny, 1)
      const w2 = appl(mw.elements, w1[0], w1[1], w1[2])
      let vx = w2[0] - p.x, vy = w2[1] - p.y, vz = w2[2] - p.z
      const nv = Math.hypot(vx, vy, vz)
      return [vx / nv, vy / nv, vz / nv]
    }
    const impact = (nx, ny) => {
      const [vx, vy, vz] = rayon(nx, ny)
      const b = p.x * vx + p.y * vy + p.z * vz, c = p.lengthSq() - R * R, disc = b * b - c
      if (disc < 0) return null
      const s = -b - Math.sqrt(disc)
      if (s < 0) return null
      const hx = p.x + vx * s, hy = p.y + vy * s, hz = p.z + vz * s
      const r = Math.hypot(hx, hy, hz)
      return { lat: Math.asin(hy / r) * R2D, lon: Math.atan2(hx, hz) * R2D, s }
    }

    // ④ zCentre — LE niveau sous le centre exact de l'écran (PF2)
    let zCentre = null
    {
      const im = impact(0, 0)
      if (im) { const t = dessineeSous(im.lat, im.lon); if (t) zCentre = t.z }
    }

    // ② la grille, séparée par le rayon de la cible
    let planete = 0, trou = 0, retard1 = 0, recul = 0
    let nCentre = 0, nPeri = 0, retardCentre = 0, retardPeri = 0, trouCentre = 0, trouPeri = 0
    let sommeZCentre = 0, sommeZPeri = 0
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const nx = ((i + 0.5) / NX) * 2 - 1, ny = 1 - ((j + 0.5) / NY) * 2
      const im = impact(nx, ny)
      if (!im) continue
      planete++
      const centre = Math.hypot(nx, ny) <= R_CIBLE
      if (centre) nCentre++; else nPeri++
      const t = dessineeSous(im.lat, im.lon)
      if (!t) {
        const est = g.uniforms?.uEstompage?.value ?? 0
        const on = g.uniforms?.uEstompageOn?.value ?? 0
        const [xz, yz] = tuileXY(im.lat, im.lon, ZOOM_SOCLE)
        if (!(on > 0.5 && est >= 1) || dansCrop(ZOOM_SOCLE, xz, yz)) { trou++; if (centre) trouCentre++; else trouPeri++ }
        continue
      }
      if (centre) sommeZCentre += t.z; else sommeZPeri += t.z
      const ret = zVoulu(t, p) - t.z
      if (ret >= 1) { retard1++; if (centre) retardCentre++; else retardPeri++ }
    }

    P.images.push({
      frame: g.frame, t: Math.round(performance.now()), phase: P.phase,
      planete, trou, trouCentre, trouPeri, retard1, retardCentre, retardPeri, recul,
      nCentre, nPeri, zCentre,
      zCentreMoy: nCentre - trouCentre ? Math.round(sommeZCentre / (nCentre - trouCentre) * 100) / 100 : null,
      zPeriMoy: nPeri - trouPeri ? Math.round(sommeZPeri / (nPeri - trouPeri) * 100) / 100 : null,
      alt: Math.round((p.length() - R) * 63710),
      msTraverse: Math.round(msTraverse * 1000) / 1000, msUpdate: Math.round(msUpdate * 1000) / 1000,
      drawn: g._drawn, visites: g._visites, cache: g.tiles.size,
      file: g.queue.length, vol: g.inFlight, credit: g._credit, refus: g._refus,
      // ③ la barrière
      barriere: g._barriereActive ? 1 : 0, barriereRefus: g._barriereRefus ?? 0,
      centreEnAttente: g._centreEnAttente ?? 0, sansProgres: Math.round(g._barriereSansProgres ?? 0),
      echeances: g._barriereEcheances ?? 0,
      horsCreneaux: g._barriereHorsCreneaux ?? 0, horsFamine: g._barriereHorsFamine ?? 0,
      horsCredit: g._barriereHorsCredit ?? 0, sansEnfant: g._barriereSansEnfant ?? 0,
      cropSeul: !!g._cropSeul, crop: !!g._crop,
    })
    if (P.images.length > 30000) P.images.splice(0, 5000)
    return out
  }
  return 'posé'
}

const quantile = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }

async function attendreCalme(page, maxMs = 30000) {
  const a = Date.now(); let precedent = null; let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => { const g = window.__exp.globe; let ready = 0; for (const t of g.tiles.values()) if (t.state === 'ready') ready++; return { ready, file: g.queue.length, vol: g.inFlight } })
    const cle = `${e.ready}/${e.file}/${e.vol}`
    if (e.file === 0 && e.vol === 0 && cle === precedent) { if (stableDepuis === null) stableDepuis = Date.now(); else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false } } else stableDepuis = null
    precedent = cle
    await dodo(150)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  let phase = 'attente'
  const reseau = {}
  const cle = (ph) => (reseau[ph] ??= { requetes: 0, octets: 0, statuts: {}, hotes: {} })
  const enCours = new Map()
  const externe = (url) => { try { const h = new URL(url).host; return (h === `localhost:${PORT}` || h === `127.0.0.1:${PORT}`) ? null : h } catch { return null } }
  cdp.on('Network.requestWillBeSent', (ev) => {
    const h = externe(ev.request.url); if (!h) return
    enCours.set(ev.requestId, phase); const c = cle(phase); c.requetes++; c.hotes[h] = (c.hotes[h] || 0) + 1
  })
  // ⚠️ **LES 404 SONT RETENUS UN PAR UN, ET C'EST LA SEULE MESURE HONNÊTE DU
  // CORRECTIF.** L'A/B naïf (drapeau levé / baissé) ne compare rien : la molette
  // est inertielle, les deux descentes ne visitent pas les mêmes tuiles, et le
  // premier essai a rendu PLUS de 404 avec le correctif qu'avec (71 contre 51 à
  // Ajaccio) — du bruit de trajectoire, pas un effet. Ce que le correctif
  // supprime est exact et se compte SUR UNE SEULE COURSE : les 404 dont un
  // ANCÊTRE a déjà rendu 404. Chacun de ceux-là est un aller-retour que la
  // mémoire des trous économise.
  const quatreCentQuatre = []
  cdp.on('Network.responseReceived', (ev) => {
    const ph = enCours.get(ev.requestId); if (ph === undefined) return
    const h = externe(ev.response.url) || '?'
    const k = `${h.split('.')[0]}:${ev.response.status}`
    const c = cle(ph); c.statuts[k] = (c.statuts[k] || 0) + 1
    if (ev.response.status === 404) {
      const m = /mapterhorn\.com\/(\d+)\/(\d+)\/(\d+)\./.exec(ev.response.url)
      if (m) quatreCentQuatre.push({ z: +m[1], x: +m[2], y: +m[3], phase: ph })
    }
  })
  cdp.on('Network.loadingFinished', (ev) => { const ph = enCours.get(ev.requestId); if (ph === undefined) return; enCours.delete(ev.requestId); cle(ph).octets += ev.encodedDataLength || 0 })
  const poserPhase = async (p) => { phase = p; await page.evaluate((p2) => { window.__cib.phase = p2 }, p) }
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)) })

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, reseauKbps: RESEAU, query: REQUETE, lieu: LIEU, barriere: BARRIERE, famine: FAMINE, departM: DEPART_M, arriveeM: ARRIVEE_M, viewport: [LARGEUR, HAUTEUR], date: new Date().toISOString() }
  await page.goto(`http://127.0.0.1:${PORT}/${REQUETE ? '?' + REQUETE : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
  journal.instrument = await page.evaluate(INSTRUMENTER)
  await page.evaluate((b) => { const g = window.__exp.globe; if ('barriereCible' in g) g.barriereCible = b }, BARRIERE)
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  journal.machine = await page.evaluate(() => ({ palier: window.__palierMachine ?? null, pixelRatio: window.devicePixelRatio, ecran: [innerWidth, innerHeight] }))
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 40000, polling: 200 }).catch(() => {})
  await dodo(1500)

  if (LIEU) {
    journal.go = await page.evaluate((l) => window.__exp.gotoCtl.go(l).then(() => true).catch((e) => 'échec ' + e.message), LIEU)
    const t0 = Date.now()
    while (Date.now() - t0 < 60000) { await dodo(500); if (await page.evaluate(() => !window.__exp.modes.busy && !window.__exp.modes.travel)) break }
    await dodo(2000)
  }

  const altitude = () => page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? null)
  const cran = (sens) => page.evaluate((s) => { const el = window.__exp.renderer.domElement; el.dispatchEvent(new WheelEvent('wheel', { deltaY: s * -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })) }, sens)
  const cranBouton = async (sens) => {
    await page.evaluate((s) => window.__exp.modes.cranZoom(s), sens)
    let prec = await altitude(); const a = Date.now()
    while (Date.now() - a < 6000) { await dodo(100); const alt = await altitude(); if (alt !== null && prec !== null && Math.abs(alt - prec) < 1e-6 * Math.max(1, alt)) return alt; prec = alt }
    return prec
  }
  await poserPhase('pose')
  const serie = []
  for (let i = 0; i < 60; i++) {
    const alt = await altitude(); if (alt === null) break
    serie.push(Math.round(alt)); const ratio = DEPART_M / alt
    if (ratio > 1.45) await cranBouton(-1); else if (ratio < 0.7) await cranBouton(+1); else break
  }
  journal.poseSerie = serie
  await dodo(1500)
  journal.calmeDepart = await attendreCalme(page, 60000)
  await dodo(500)
  journal.etatDepart = await page.evaluate(() => ({ alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  console.log(`départ : ${JSON.stringify(journal.etatDepart)} · barrière ${BARRIERE} · lieu ${LIEU || '(défaut)'}`)

  // ⚠️ LA FAMINE SE FABRIQUE EN COUPANT LE RÉSEAU DES TUILES DU CENTRE, PAS LE
  // RÉSEAU ENTIER : c'est le cas d'Adrien (« si le centre échoue ») et le seul
  // qui teste l'échéance. On interdit les tuiles au-delà d'un zoom donné, ce que
  // le parcours ne réclame QUE là où la caméra descend — le centre de l'écran.
  if (FAMINE) {
    await cdp.send('Network.setRequestInterception', { patterns: [{ urlPattern: '*' }] }).catch(() => {})
    await page.setRequestInterception(true)
    page.on('request', (r) => {
      const u = r.url()
      const m = /\/(\d+)\/(\d+)\/(\d+)\.(webp|png)/.exec(u)
      if (m && Number(m[1]) >= 11 && !u.includes(`127.0.0.1:${PORT}`)) return r.abort('failed').catch(() => {})
      return r.continue().catch(() => {})
    })
  }

  // ⚠️ **LE BRIDAGE SE POSE APRÈS LE CHARGEMENT DE LA PAGE, PAS AVANT.**
  // `Network.emulateNetworkConditions` ne sait pas exempter un hôte : posé au
  // départ, il bride AUSSI le serveur `vite` de dev, et l'application ne finit
  // jamais de démarrer (90 s de délai dépassé, mesuré). On le pose donc juste
  // avant la descente, quand la page est en place et que seules les tuiles
  // partent encore sur le vrai réseau.
  if (RESEAU > 0) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: RESEAU * 1000 / 8, uploadThroughput: RESEAU * 1000 / 8 })
    journal.bridageMs = Date.now()
  }

  await poserPhase('descente')
  const marques = { debut: await page.evaluate(() => Math.round(performance.now())) }
  for (let i = 0; i < 600; i++) {
    await cran(+1)
    await dodo(PERIODE)
    const alt = await altitude()
    if (alt !== null && alt < ARRIVEE_M) { marques.arretCran = i + 1; break }
  }
  marques.arretGeste = await page.evaluate(() => Math.round(performance.now()))
  journal.calmeFin = await attendreCalme(page, 60000)
  marques.calme = await page.evaluate(() => Math.round(performance.now()))
  await poserPhase('fin')
  journal.etatFin = await page.evaluate(() => ({ alt: window.__exp.altitudeCadrageM?.() ?? null, cache: window.__exp.globe.tiles.size }))
  journal.marques = marques

  const P = await page.evaluate(() => { clearInterval(window.__cib.echantillonneur); return JSON.parse(JSON.stringify({ images: window.__cib.images, nuage: window.__cib.nuage, creneaux: window.__cib.creneaux, rCible: window.__cib.rCible })) })
  const imgs = P.images.filter((i) => i.phase === 'descente')
  const apres = imgs.filter((i) => i.t >= marques.arretGeste)
  const stat = (xs) => ({ p50: Math.round(quantile(xs, 0.5) * 1000) / 10, p90: Math.round(quantile(xs, 0.9) * 1000) / 10, max: Math.round(Math.max(0, ...xs) * 1000) / 10, moy: Math.round(xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length) * 1000) / 10 })
  const fracC = imgs.map((i) => (i.nCentre - i.trouCentre ? i.retardCentre / (i.nCentre - i.trouCentre) : 0))
  const fracP = imgs.map((i) => (i.nPeri - i.trouPeri ? i.retardPeri / (i.nPeri - i.trouPeri) : 0))
  const fracTot = imgs.map((i) => (i.planete ? i.retard1 / i.planete : 0))

  // ④ LA PREMIÈRE IMAGE NETTE AU CENTRE — définition PF2 : après l'arrêt du
  // geste, l'instant où `zCentre` atteint sa valeur finale et n'en redescend plus
  //
  // ⚠️ **ET LE CHRONOMÈTRE PART AU DÉBUT DU GESTE, PAS À SON ARRÊT.** La
  // définition de PF2 (« après l'arrêt du geste ») était juste pour SA descente,
  // qui finissait au-dessus du crop ; ici le socle prescrit z13 au centre AVANT
  // la fin de la molette, et le chiffre tombait à **0 ms sur les deux branches**
  // — une grandeur qui ne bouge jamais ne compare rien. On mesure donc le délai
  // depuis le DÉBUT de la descente, et on garde le délai après l'arrêt à côté.
  let nettete = null, netteteApresArret = null, zFinal = null
  {
    const zs = imgs.map((i) => i.zCentre).filter((z) => z !== null)
    if (zs.length) {
      zFinal = zs[zs.length - 1]
      for (let k = imgs.length - 1; k >= 0; k--) {
        if (imgs[k].zCentre !== null && imgs[k].zCentre < zFinal) {
          const suiv = imgs[k + 1]
          if (suiv) { nettete = suiv.t - marques.debut; netteteApresArret = suiv.t - marques.arretGeste }
          break
        }
        if (k === 0) { nettete = 0; netteteApresArret = imgs[0].t - marques.arretGeste }
      }
    }
  }
  // rang d'arrivée de la tuile du centre par niveau : le premier instant où
  // `zCentre` atteint chaque niveau, en ms depuis le début de la descente
  const premierZ = {}
  for (const i of imgs) if (i.zCentre !== null && premierZ[i.zCentre] === undefined) premierZ[i.zCentre] = i.t - marques.debut

  // les 404 dont un ANCÊTRE a aussi 404 : ce sont EXACTEMENT les allers-retours
  // que la mémoire des trous supprime
  const vus = new Set()
  let descendantsDe404 = 0
  for (const q of quatreCentQuatre) {
    let ancetre = false
    for (let z = q.z - 1, x = q.x >> 1, y = q.y >> 1; z >= 0; z--, x >>= 1, y >>= 1) if (vus.has(`${z}/${x}/${y}`)) { ancetre = true; break }
    if (ancetre) descendantsDe404++
    vus.add(`${q.z}/${q.x}/${q.y}`)
  }

  const c = P.creneaux
  const resume = {
    images: imgs.length, dureeMs: imgs.length ? imgs[imgs.length - 1].t - imgs[0].t : 0,
    rCible: P.rCible,
    // ② la basse définition de périphérie
    retardTotal: stat(fracTot), retardCentre: stat(fracC), retardPeri: stat(fracP),
    trous: { max: Math.max(0, ...imgs.map((i) => i.trou)), images: imgs.filter((i) => i.trou > 0).length, peri: Math.max(0, ...imgs.map((i) => i.trouPeri)) },
    zCentreMoy: quantile(imgs.map((i) => i.zCentreMoy ?? 0), 0.5), zPeriMoy: quantile(imgs.map((i) => i.zPeriMoy ?? 0), 0.5),
    // ③ la barrière et les créneaux
    creneaux: {
      // ⚠️ LE CHIFFRE QUI JUGE : occupation moyenne des six créneaux, échantillonnée
      // toutes les 5 ms hors rAF, sur toute la vie de la page
      occupationTemps: c.n ? Math.round(c.somme / c.n / 6 * 1000) / 10 : null,
      plein: c.n ? Math.round(c.plein / c.n * 1000) / 10 : null,
      vide: c.n ? Math.round(c.vide / c.n * 1000) / 10 : null,
      echantillons: c.n,
      occupationImages: imgs.length ? Math.round(imgs.reduce((s, i) => s + i.vol, 0) / imgs.length / 6 * 1000) / 10 : null,
    },
    barriere: {
      imagesActives: imgs.filter((i) => i.barriere).length,
      partImages: imgs.length ? Math.round(imgs.filter((i) => i.barriere).length / imgs.length * 1000) / 10 : null,
      refusTotal: imgs.reduce((s, i) => s + i.barriereRefus, 0),
      refusMax: Math.max(0, ...imgs.map((i) => i.barriereRefus)),
      echeances: Math.max(0, ...imgs.map((i) => i.echeances)),
      sansProgresMax: Math.max(0, ...imgs.map((i) => i.sansProgres)),
      horsCreneaux: Math.max(0, ...imgs.map((i) => i.horsCreneaux)),
      horsFamine: Math.max(0, ...imgs.map((i) => i.horsFamine)),
      horsCredit: Math.max(0, ...imgs.map((i) => i.horsCredit)),
      sansEnfant: Math.max(0, ...imgs.map((i) => i.sansEnfant)),
    },
    // ④ le critère d'Adrien
    netteteCentreMs: nettete, netteteApresArretMs: netteteApresArret, zCentreFinal: zFinal, premierZ,
    dureeGesteMs: marques.arretGeste - marques.debut,
    // le coût
    traverse: { p50: quantile(imgs.map((i) => i.msTraverse), 0.5), p99: quantile(imgs.map((i) => i.msTraverse), 0.99) },
    update: { p50: quantile(imgs.map((i) => i.msUpdate), 0.5), p99: quantile(imgs.map((i) => i.msUpdate), 0.99) },
    drawn: { p50: quantile(imgs.map((i) => i.drawn), 0.5), max: Math.max(0, ...imgs.map((i) => i.drawn)) },
    cacheMax: Math.max(0, ...imgs.map((i) => i.cache)),
    reseau: { descente: reseau.descente ?? null, tout: Object.values(reseau).reduce((s, r) => ({ requetes: s.requetes + r.requetes, octets: s.octets + r.octets }), { requetes: 0, octets: 0 }) },
    calmeFinMs: journal.calmeFin.ms,
    trous404: { total: quatreCentQuatre.length, descendantsDe404, distincts: vus.size },
  }
  // ① la courbe : le nuage mesuré, RÉSUMÉ par tranche de 0,1 NDC, plus le
  // balayage synthétique de la loi
  const tranches = {}
  for (const [d, p] of P.nuage) { const k = Math.round(d * 10) / 10; (tranches[k] ??= []).push(p) }
  resume.courbeMesuree = Object.keys(tranches).sort((a, b) => a - b).map((k) => ({ d: Number(k), n: tranches[k].length, pMin: Math.min(...tranches[k]), pMax: Math.max(...tranches[k]), pMed: quantile(tranches[k], 0.5) }))
  resume.nuageN = P.nuage.length

  journal.resume = resume
  journal.brut = imgs
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log(`— ${ETIQ} · ${imgs.length} images (${resume.dureeMs} ms) · ${journal.etatDepart.alt | 0} → ${journal.etatFin.alt | 0} m · R_CIBLE ${resume.rCible?.toFixed(4)} —`)
  console.log(`NETTETÉ AU CENTRE : ${resume.netteteCentreMs} ms depuis le début du geste (${resume.netteteApresArretMs} ms après l'arrêt, geste ${resume.dureeGesteMs} ms) · z final ${resume.zCentreFinal} · premier z ${JSON.stringify(resume.premierZ)}`)
  console.log(`CRÉNEAUX : occupation temps ${resume.creneaux.occupationTemps} % · pleins ${resume.creneaux.plein} % · vides ${resume.creneaux.vide} % (${resume.creneaux.echantillons} éch.) · par image ${resume.creneaux.occupationImages} %`)
  console.log(`BARRIÈRE : ${resume.barriere.partImages} % des images · ${resume.barriere.refusTotal} raffinements retenus (max ${resume.barriere.refusMax}/img) · échéances ${resume.barriere.echeances} · sans progrès max ${resume.barriere.sansProgresMax} ms`)
  console.log(`  désarmée par : créneaux ${resume.barriere.horsCreneaux} img · famine ${resume.barriere.horsFamine} · crédit ${resume.barriere.horsCredit} · passée faute d'enfant absent ${resume.barriere.sansEnfant}`)
  console.log(`RETARD (% de sa population) — total moy ${resume.retardTotal.moy} · CENTRE moy ${resume.retardCentre.moy} p90 ${resume.retardCentre.p90} · PÉRIPHÉRIE moy ${resume.retardPeri.moy} p90 ${resume.retardPeri.p90}`)
  console.log(`z moyen : centre ${resume.zCentreMoy} · périphérie ${resume.zPeriMoy} · trous max ${resume.trous.max} (périphérie ${resume.trous.peri}) sur ${resume.trous.images} images`)
  console.log(`RÉSEAU descente : ${resume.reseau.descente?.requetes} req · ${((resume.reseau.descente?.octets || 0) / 1048576).toFixed(2)} Mio · statuts ${JSON.stringify(resume.reseau.descente?.statuts)}`)
  console.log(`404 MAPTERHORN : ${resume.trous404.total} au total, dont ${resume.trous404.descendantsDe404} DESCENDANTS d un 404 déjà connu — autant d allers-retours économisables`)
  console.log(`COURBE (d NDC → clé, médiane) : ${resume.courbeMesuree.map((t) => `${t.d}:${t.pMed}`).join(' ')}`)
  console.log(`_traverse p50 ${resume.traverse.p50} p99 ${resume.traverse.p99} · update p50 ${resume.update.p50} p99 ${resume.update.p99} · cache max ${resume.cacheMax} · calme ${resume.calmeFinMs} ms`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
