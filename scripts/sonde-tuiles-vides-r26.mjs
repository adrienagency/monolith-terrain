// SONDE R26 — LES TUILES QUI RESTENT `empty` : DEMANDÉES, OU DEMANDÉES PAR PERSONNE ?
//
// ⛔ **LE PIÈGE QUI VISE CETTE TÂCHE EN PLEIN : une sonde posée APRÈS la
// fonction lit un état déjà écrasé.** `_credit`, `_refus`, `_refusFile`,
// `_attentesSonde` et `_purgees` sont remis à zéro **au début** de
// `globe.update()`. Les lire depuis `page.evaluate()` après coup, c'est les lire
// à une image quelconque — et parfois à une image où le globe n'a rien fait.
//
// ➡️ **D'où le montage de cette sonde : on n'observe RIEN depuis l'extérieur.**
//   · `_request` est **enveloppée** : à chaque appel on relève l'état AVANT et
//     APRÈS, plus le delta des deux compteurs de refus, ce qui **nomme la cause
//     du refus** tuile par tuile (quarantaine / plafond de file / attente de
//     sonde de couverture) au lieu de la deviner.
//   · le recensement est fait **à la fin de `update`, dans le même appel**, donc
//     avant que `frame++` de l'image suivante ne périme `lastUsed`.
//
// ⚡ **LA QUESTION TRANCHÉE ICI** : les 4 à 9 tuiles `empty` résiduelles sont-elles
//   (a) hors champ / hors distance, donc demandées par personne — et alors c'est
//       la PORTE du banc qui est fausse ;
//   (b) demandées à chaque image et refusées — et alors c'est une fuite ;
//   (c) en échec puis redemandées en boucle — et alors c'est un cycle.
//
// Le discriminant est `lastUsed` : une tuile touchée par le parcours de l'image
// courante porte `lastUsed === frame`. Une tuile que personne ne parcourt plus
// garde le `frame` de sa dernière visite — son **âge** se lit en images.
//
// ⚠️ Le voile d'accueil `.ce-hubveil` mange TOUS les gestes : on le lève et on
// vérifie que le canevas est découvert (rétractation de `lecons-campagne-R.md`).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5711'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R26'))
const ETIQ = opt('--etiquette', 'recensement')
const VISIBLE = has('--visible')
const LARGEUR = Number(opt('--largeur', '1280'))
const HAUTEUR = Number(opt('--hauteur', '720'))
// les jalons de relevé, en secondes après l'ouverture de la porte
const JALONS = (opt('--jalons', '30,60,300,900')).split(',').map(Number)
// `--usage` fait tourner la planète entre deux jalons : une fuite se voit dans
// le temps, mais seulement si quelque chose bouge. Au repos strict, `_traverse`
// repasse sur les mêmes tuiles et rien ne peut fuir.
const USAGE = has('--usage')
const SANS_PORTE = has('--sans-porte')

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

// ═══════════════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ═══════════════════════
function INSTRUMENTER() {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  const g = e.globe
  if (window.__r26) return 'déjà posé'
  const R = {
    frames: 0,
    // tallies de `_request`, cumulées sur toute la session
    req: { appels: 0, refusEtat: 0, quarantaine: 0, file: 0, sonde: 0, accepte: 0 },
    // par clé : combien de fois cette tuile a été REFUSÉE, et pour quelle cause
    parCle: new Map(),
    dernier: null,
    // le maximum vu de chaque compteur par image (les compteurs sont remis à
    // zéro au début de `update`, donc seul un relevé DANS la boucle les voit)
    pics: { refus: 0, refusFile: 0, sonde: 0, purgees: 0, file: 0, enVol: 0 },
    cumul: { refus: 0, refusFile: 0, sonde: 0, purgees: 0 },
    // ⚠️ UN RELEVÉ SUR UNE IMAGE NE PROUVE RIEN si le système oscille (ce dépôt
    // a vu un cycle de période 4). On garde donc le min, le max et les 20
    // dernières valeurs du compte de tuiles `empty` périmées.
    perime: { min: Infinity, max: 0, serie: [] },
    // qui rend une tuile à `empty` ? les trois écrivains, comptés à la source
    versEmpty: { purge: 0, annule: 0, reessai: 0, recharge: 0, total: 0 },
    recharges: [],
    evictions: [],
    transitions: [],
    versReady: 0,
  }
  window.__r26 = R

  // ═══ LE QUATRIÈME ÉCRIVAIN, celui que le brief ne cite pas ═══
  // `_rechargeTuiles` rend à `empty` TOUTES les tuiles prêtes, puis ne redemande
  // que les seize racines (`chargeRacines`). Tout le reste compte sur
  // `_traverse` — donc tout ce que `_traverse` ne parcourt plus reste `empty`.
  const rechOrig = g._rechargeTuiles.bind(g)
  g._rechargeTuiles = function () {
    let pretes = 0, horsCrop = 0
    for (const t of g.tiles.values()) {
      if (t.state !== 'ready') continue
      pretes++
      if (t.z > 2 && g._horsCropSeul(t.z, t.x, t.y)) horsCrop++
    }
    R.versEmpty.recharge += pretes
    R.recharges.push({ frame: g.frame, pretes, horsCrop, taille: g.tiles.size, crop: !!g._crop, exag: g.exaggeration })
    return rechOrig()
  }
  const annOrig = g._annuler.bind(g)
  g._annuler = function (t) { const av = t.state; const r = annOrig(t); if (av === 'loading' && t.state === 'empty') R.versEmpty.annule++; return r }
  const evOrig = g._evictJusqua.bind(g)
  g._evictJusqua = function (max) { R.evictions.push({ frame: g.frame, taille: g.tiles.size, max }); return evOrig(max) }

  // ⛔ **LE DÉTECTEUR D'ÉCRIVAIN INCONNU.** Envelopper les trois écrivains cités
  // par le brief suppose qu'ils sont les seuls. On garde donc, en plus, l'état
  // de chaque clé d'une image à l'autre : toute transition `X → empty` est
  // comptée, même si elle vient d'un chemin que personne n'a listé.
  const avant = new Map()
  function transitions() {
    for (const t of g.tiles.values()) {
      const a = avant.get(t.key)
      if (a !== undefined && a !== 'empty' && t.state === 'empty') {
        R.versEmpty.total++
        R.versEmpty['de_' + a] = (R.versEmpty['de_' + a] || 0) + 1
        if (R.transitions.length < 40) R.transitions.push({ key: t.key, z: t.z, de: a, frame: g.frame, horsCrop: g._horsCropSeul(t.z, t.x, t.y) })
      }
      // ⚡ CE COMPTEUR-CI RÉPOND À « LA PORTE CORRIGÉE COUPE-T-ELLE TROP TÔT ? ».
      // Si une tuile devient `ready` APRÈS la fermeture de la porte, l'image
      // change encore et la porte a menti. C'est la seule façon de corriger la
      // porte sans casser le plancher de bruit que R21 a publié derrière elle.
      if (a !== undefined && a !== 'ready' && t.state === 'ready') R.versReady++
      avant.set(t.key, t.state)
    }
  }

  const reqOrig = g._request.bind(g)
  g._request = function (t, priority) {
    R.req.appels++
    if (t.state !== 'empty') { R.req.refusEtat++; return reqOrig(t, priority) }
    const f0 = g._refusFile, s0 = g._attentesSonde
    const r = reqOrig(t, priority)
    if (t.state === 'loading') { R.req.accepte++; return r }
    let cause = 'quarantaine'
    if (g._refusFile > f0) cause = 'file'
    else if (g._attentesSonde > s0) cause = 'sonde'
    R.req[cause]++
    let e2 = R.parCle.get(t.key)
    if (!e2) R.parCle.set(t.key, (e2 = { quarantaine: 0, file: 0, sonde: 0 }))
    e2[cause]++
    return r
  }

  // ⚠️ LE RECENSEMENT EST FAIT **DANS** L'APPEL, à la sortie de `update`.
  const updOrig = g.update.bind(g)
  g.update = function (camera, dt) {
    const out = updOrig(camera, dt)
    R.frames++
    const f = g.frame
    R.pics.refus = Math.max(R.pics.refus, g._refus | 0)
    R.pics.refusFile = Math.max(R.pics.refusFile, g._refusFile | 0)
    R.pics.sonde = Math.max(R.pics.sonde, g._attentesSonde | 0)
    R.pics.purgees = Math.max(R.pics.purgees, g._purgees | 0)
    R.pics.file = Math.max(R.pics.file, g.queue.length)
    R.pics.enVol = Math.max(R.pics.enVol, g.inFlight)
    R.cumul.refus += g._refus | 0
    R.cumul.refusFile += g._refusFile | 0
    R.cumul.sonde += g._attentesSonde | 0
    R.cumul.purgees += g._purgees | 0
    R.versEmpty.purge += g._purgees | 0
    transitions()
    R.dernier = recenser(camera)
    const p = R.dernier.empty.perime
    if (p < R.perime.min) R.perime.min = p
    if (p > R.perime.max) R.perime.max = p
    R.perime.serie.push(p)
    if (R.perime.serie.length > 20) R.perime.serie.shift()
    return out
  }

  function recenser(camera) {
    const f = g.frame
    const camPos = camera.position
    const camDir = camPos.clone().normalize()
    const etats = { empty: 0, loading: 0, ready: 0, error: 0 }
    const emptyFrais = [] // lastUsed === frame : le parcours vient de l'offrir
    const emptyPerime = [] // lastUsed < frame : plus personne ne la parcourt
    const loadingVieux = []
    for (const t of g.tiles.values()) {
      etats[t.state] = (etats[t.state] || 0) + 1
      if (t.state === 'empty') {
        const fiche = { key: t.key, z: t.z, age: f - t.lastUsed, jamaisDemandee: t.demandee === undefined, retried: !!t.retried }
        if (t.lastUsed === f) emptyFrais.push(fiche)
        else emptyPerime.push(fiche)
      } else if (t.state === 'loading') {
        const age = f - (t.demandee ?? 0)
        if (age > 60) loadingVieux.push({ key: t.key, z: t.z, age })
      }
    }
    // Pourquoi les périmées ne sont-elles plus parcourues ? On rejoue sur elles
    // les trois tris de `_traverse`, dans le même ordre, avec la caméra de CETTE
    // image. C'est la réponse au départage.
    const pourquoi = { horsCrop: 0, horsHorizon: 0, horsFrustum: 0, dansLeChamp: 0 }
    const echantillon = []
    for (const fiche of emptyPerime) {
      const t = g.tiles.get(fiche.key)
      let cause
      if (g._horsCropSeul(t.z, t.x, t.y)) cause = 'horsCrop'
      else if (g.continu && g._horsHorizon(t, camDir)) cause = 'horsHorizon'
      else if (g.continu && !g._frustum.intersectsSphere(g._sphereDe(t))) cause = 'horsFrustum'
      else cause = 'dansLeChamp'
      pourquoi[cause]++
      fiche.cause = cause
      const refus = R.parCle.get(fiche.key)
      fiche.refus = refus ? { ...refus } : null
      if (echantillon.length < 24) echantillon.push(fiche)
    }
    return {
      frame: f,
      taille: g.tiles.size,
      cacheMax: g.cacheMax,
      continu: !!g.continu,
      crop: !!g._crop,
      etats,
      empty: { frais: emptyFrais.length, perime: emptyPerime.length },
      pourquoi,
      echantillon,
      loadingVieux,
      file: g.queue.length,
      enVol: g.inFlight,
      // ⚠️ CE CRÉDIT EST CELUI QUI RESTE À LA FIN DU PARCOURS, pas celui du
      // début : `_credit = cacheMax − taille + marge` est recalculé à chaque
      // image et débité de 4 par raffinement admis. Le signal d'un point fixe
      // n'est PAS cette valeur mais `refus` (les raffinements refusés).
      creditRestant: g._credit,
      refus: g._refus | 0,
      refusFile: g._refusFile | 0,
      attentesSonde: g._attentesSonde | 0,
      purgees: g._purgees | 0,
      visites: g._visites | 0,
      dessinees: g._drawn | 0,
      req: { ...R.req },
      pics: { ...R.pics },
      cumul: { ...R.cumul },
      versEmpty: { ...R.versEmpty },
      versReady: R.versReady,
      recharges: R.recharges.slice(-8),
      nbRecharges: R.recharges.length,
      evictions: R.evictions.slice(-8),
      nbEvictions: R.evictions.length,
      transitions: R.transitions.slice(),
      perime: { min: R.perime.min === Infinity ? null : R.perime.min, max: R.perime.max, serie: R.perime.serie.slice() },
      frames: R.frames,
    }
  }
  return 'posé'
}

const LIRE = () => {
  const R = window.__r26
  return R ? JSON.parse(JSON.stringify(R.dernier)) : null
}

// La porte du banc, DANS LES DEUX ÉCRITURES — c'est le témoin de la tâche.
// ⚠️ Des EXPRESSIONS, pas des fonctions : `waitForFunction` évalue la chaîne.
const PORTE_ANCIENNE =
  "(() => { const t = window.__exp && window.__exp.globe && window.__exp.globe.tiles; if (!t) return false;" +
  " let n = 0; for (const v of t.values()) if (v.state === 'loading' || v.state === 'empty') n++; return n === 0 })()"
const PORTE_NEUVE =
  "(() => { const g = window.__exp && window.__exp.globe; if (!g) return false;" +
  " let n = 0; for (const v of g.tiles.values()) if (v.state === 'loading') n++;" +
  ' return n + g.queue.length + g.inFlight === 0 })()'

async function attendreImages(page, n) {
  await page.evaluate(
    (k) => new Promise((res) => { let i = 0; const t = () => (++i >= k ? res() : requestAnimationFrame(t)); requestAnimationFrame(t) }),
    n
  )
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(),
    headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  // ⚠️ `performance.getEntriesByType('resource')` PLAFONNE À 250 ENTRÉES (R24 :
  // sous-comptage de 79 %). On compte donc les requêtes par CDP, qui ne plafonne
  // pas, et on classe par hôte.
  const reseau = { total: 0, parHote: {} }
  await cdp.send('Network.enable')
  cdp.on('Network.requestWillBeSent', (ev) => {
    reseau.total++
    try {
      const h = new URL(ev.request.url).host
      reseau.parHote[h] = (reseau.parHote[h] || 0) + 1
    } catch { /* data: */ }
  })

  const journal = { etiquette: ETIQ, port: PORT, jalons: JALONS, usage: USAGE, sansPorte: SANS_PORTE, viewport: [LARGEUR, HAUTEUR], releves: [] }
  page.on('console', (m) => { if (m.type() === 'error') journal.erreurs = (journal.erreurs || []).concat([m.text().slice(0, 160)]) })

  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
  journal.instrument = await page.evaluate(INSTRUMENTER)
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  journal.msVoileParti = Date.now() - t0
  journal.voile = await page.evaluate(() => {
    document.body.classList.remove('ce-hub')
    document.querySelector('.ce-hubveil')?.remove()
    const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    return { canevas: e === window.__exp.renderer.domElement, nom: e ? e.tagName : 'null' }
  })

  // ══════════ LA PORTE, CHRONOMÉTRÉE DANS LES DEUX ÉCRITURES ══════════════
  if (!SANS_PORTE) {
    const a = Date.now()
    let expiree = false
    await page.waitForFunction(PORTE_ANCIENNE, { polling: 250, timeout: 45000 }).catch(() => { expiree = true })
    journal.porteAncienne = { ms: Date.now() - a, expiree }
    const b = Date.now()
    let expiree2 = false
    await page.waitForFunction(PORTE_NEUVE, { polling: 250, timeout: 45000 }).catch(() => { expiree2 = true })
    journal.porteNeuve = { ms: Date.now() - b, expiree: expiree2 }
  }

  const CX = Math.round(LARGEUR / 2), CY = Math.round(HAUTEUR / 2)
  const souris = (type, x, y, bouton = 'left', boutons = 1) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: bouton, buttons: boutons, clickCount: type === 'mousePressed' ? 1 : 0 })
  async function glisser(dx, dy) {
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    for (let i = 1; i <= 12; i++) {
      await souris('mouseMoved', CX + Math.round((dx * i) / 12), CY + Math.round((dy * i) / 12))
      await attendreImages(page, 2)
    }
    await souris('mouseReleased', CX + dx, CY + dy, 'left', 0)
    await attendreImages(page, 20)
  }

  const depart = Date.now()
  let precedent = 0
  for (const jalon of JALONS) {
    const cible = depart + jalon * 1000
    while (Date.now() < cible) {
      const reste = cible - Date.now()
      if (USAGE && reste > 4000) {
        // usage : on tourne, on zoome, on revient — c'est ce qui fait purger la
        // file et abandonner des raffinements, donc c'est là qu'une fuite naît.
        // ⚠️ **ENVELOPPÉ** : un premier tour a perdu son contexte d'exécution
        // au bout de 60 s (« navigation »). Une sonde qui meurt en silence à
        // mi-parcours rendrait un « ça ne grandit pas » qui ne mesure rien.
        try {
          await glisser(140, 0)
          await glisser(-90, 60)
          for (let i = 0; i < 6; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: -120, buttons: 0 }); await attendreImages(page, 2) }
          await attendreImages(page, 40)
          for (let i = 0; i < 6; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: CX, y: CY, deltaX: 0, deltaY: 120, buttons: 0 }); await attendreImages(page, 2) }
          await attendreImages(page, 40)
        } catch (err) {
          journal.incidents = (journal.incidents || []).concat([{ ms: Date.now() - depart, msg: String(err.message).slice(0, 120) }])
          await dodo(2000)
          const vivant = await page.evaluate('!!window.__r26').catch(() => false)
          if (!vivant) {
            // la page a rechargé : le recensement repart de zéro, il faut le dire
            await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 90000 })
            journal.redemarrages = (journal.redemarrages || 0) + 1
            await page.evaluate(INSTRUMENTER)
            await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
          }
        }
      } else await dodo(Math.min(reste, 1000))
    }
    const etat = await page.evaluate(LIRE)
    journal.releves.push({ jalonS: jalon, ms: Date.now() - depart, etat, reseau: { total: reseau.total, parHote: { ...reseau.parHote } } })
    const d = etat.empty.perime - precedent
    precedent = etat.empty.perime
    console.log(
      `t+${String(jalon).padStart(4)}s · cache ${etat.taille}/${etat.cacheMax} · ready ${etat.etats.ready} · empty ${etat.empty.frais}+${etat.empty.perime} (Δpérimées ${d >= 0 ? '+' : ''}${d})` +
      ` · loading ${etat.etats.loading} · error ${etat.etats.error} · refus ${etat.cumul.refus} · sonde ${etat.cumul.sonde} · file ${etat.cumul.refusFile}` +
      ` · pourquoi ${JSON.stringify(etat.pourquoi)}`
    )
  }
  journal.reseau = reseau
  const nom = path.join(SORTIE, `${ETIQ}-${USAGE ? 'usage' : 'repos'}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 2))
  console.log('→', nom)
  console.log('porte ancienne :', JSON.stringify(journal.porteAncienne), ' porte neuve :', JSON.stringify(journal.porteNeuve))
  await nav.close()
}

lancer().catch((e) => { console.error(e); process.exit(1) })
