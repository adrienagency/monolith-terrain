// SONDE DES DALLES — Tâche R3, « on ne charge que les dalles du socle ».
//
// ---------------------------------------------------------------------------
// CE QU'ELLE MESURE, ET POURQUOI ELLE EXISTE
// ---------------------------------------------------------------------------
// Le chantier « une seule Terre » avait deux budgets chiffrés — les tuiles
// DESSINÉES et les tuiles PARCOURUES (Tâche N : 351 → 36 et 688 → 60). Le
// troisième, le RÉSEAU, n'avait aucun instrument : rien dans ce dépôt ne compte
// les requêtes de tuiles caméra posée sur le crop, ni ne dit lesquelles tombent
// hors de son emprise.
//
// Cette sonde le fait, sur l'application VIVANTE (serveur de dev), par le
// protocole CDP en direct — pas de dépendance ajoutée (`WebSocket` est natif
// depuis Node 22) :
//
//   • toutes les requêtes réseau, horodatées, classées par famille d'URL ;
//   • pour les tuiles de MNT (mapterhorn / AWS terrarium), le départage
//     DEDANS / DEHORS est fait **par l'application elle-même** : la sonde
//     importe `/src/monde/crop-sphere.js` DANS LA PAGE et appelle son
//     `tuileDansCrop` avec le `globe._crop` vivant. Aucune ré-implémentation :
//     une copie du critère aurait pu diverger sans qu'on le voie.
//   • l'état de la file au repos : `queue.length`, `inFlight`, `tiles.size`,
//     `_drawn`, `_refusFile` ;
//   • deux jalons de démarrage : le voile `#loading` retiré, et la première
//     image où le globe dessine au moins une tuile AVEC un crop posé.
//
// ---------------------------------------------------------------------------
// COMMENT S'EN SERVIR
// ---------------------------------------------------------------------------
//   node scripts/sonde-dalles.mjs --port 5509 --sortie .banc/R3/avant.json \
//        --repetitions 3 --secondes 45
//
// Options :
//   --port N          port du serveur de dev (défaut 5509)
//   --requete "…"     la chaîne de requête, SANS le « ? »
//   --secondes N      durée totale d'observation par tirage (défaut 45)
//   --repos N         longueur de la fenêtre « repos », prise à la fin (défaut 15)
//   --repetitions N   nombre de tirages (défaut 3). ⚠️ **N'EN FAIS PAS UN.**
//                     Le bruit réseau de ce chantier a atteint 33 % entre deux
//                     chargements : un tirage unique n'est pas une mesure.
//   --headful         fenêtre visible → VRAI GPU. ⚠️ **C'est le défaut**, parce
//                     que le mode sans écran retombe sur SwiftShader, que
//                     `palier-machine.js` classe « logiciel » et rabat au
//                     palier 3 — un régime qui n'est PAS celui d'Adrien et qui
//                     change le damier chargé.
//   --sansecran       force le mode sans écran (plus discret, moins fidèle).
//   --chrome <chemin> ou CHROME_PATH
//
// ⚠️ **LA SONDE NE JUGE PAS, ELLE COMPTE.** Les seuils, les verdicts et les
// écarts se lisent dans le rapport de la tâche, pas ici.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

// ------------------------------------------------------------------ arguments
const A = process.argv.slice(2)
const opt = (nom, def) => {
  const i = A.indexOf(nom)
  return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : def
}
const drapeau = (nom) => A.includes(nom)

const PORT = Number(opt('--port', 5509))
const REQUETE = opt('--requete', 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0')
const SECONDES = Number(opt('--secondes', 45))
const REPOS = Number(opt('--repos', 15))
const REPETITIONS = Number(opt('--repetitions', 3))
const SORTIE = opt('--sortie', '.banc/R3/mesure.json')
const SANS_ECRAN = drapeau('--sansecran')
const DP = Number(opt('--dp', 9333))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne && fs.existsSync(donne)) return donne
  for (const c of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]) if (fs.existsSync(c)) return c
  console.error('Chrome introuvable. Passe --chrome <chemin>, ou pose CHROME_PATH.')
  process.exit(2)
}

// --------------------------------------------------------------- CDP minimal
// Protocole « aplati » (flatten) : une seule connexion, le `sessionId` route.
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.attente = new Map()
    this.ecouteurs = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== undefined) {
        const p = this.attente.get(m.id)
        if (!p) return
        this.attente.delete(m.id)
        m.error ? p.rej(new Error(`${m.error.message} (${JSON.stringify(m.error.data ?? '')})`)) : p.res(m.result)
      } else {
        for (const f of this.ecouteurs) f(m)
      }
    })
  }
  envoyer(method, params = {}, sessionId) {
    const id = ++this.id
    const msg = { id, method, params }
    if (sessionId) msg.sessionId = sessionId
    this.ws.send(JSON.stringify(msg))
    return new Promise((res, rej) => this.attente.set(id, { res, rej }))
  }
  sur(f) { this.ecouteurs.push(f) }
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

async function versionCdp(dp) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${dp}/json/version`)
      if (r.ok) return await r.json()
    } catch { /* pas encore levé */ }
    await dodo(200)
  }
  throw new Error('Chrome n a pas ouvert son port de débogage')
}

// ---------------------------------------------- ce qui tourne DANS la page
// Posé par `Page.addScriptToEvaluateOnNewDocument`, donc AVANT le moindre
// module de l'application : c'est la seule façon de dater le premier rendu.
const SCRIPT_PAGE = `
window.__r3 = { veille: null, premierDessin: null, t0: performance.now(), demandes: [] }
// ⚠️ **LA PILE DU \`fetch\` NE DIT PAS QUI A DEMANDÉ LA TUILE.** Elle s'arrête à
// \`_pump\`, la pompe de la file, appelée depuis la boucle de rendu : tout ce qui
// passe par la file du globe s'y ressemble, que ce soit \`_traverse\`,
// \`demanderEmprise\` ou \`chargeRacines\`. On instrumente donc \`_request\` LUI-MÊME,
// au moment où \`main.js\` publie \`window.__exp\` — c'est-à-dire avant
// \`bootInitialView()\` et avant la première image, donc avant toute demande.
// Le compteur \`manquees\` dit combien de tuiles ont échappé au piège : s'il
// n'est pas nul, l'attribution est incomplète et il faut le DIRE.
;(function () {
  let valeur
  Object.defineProperty(window, '__exp', {
    configurable: true,
    get() { return valeur },
    set(v) {
      valeur = v
      try {
        const g = v && v.globe
        if (g && !g.__r3Pose) {
          g.__r3Pose = true
          const vrai = g._request.bind(g)
          g._request = function (t, prio) {
            if (t && t.state === 'empty') {
              const pile = (new Error().stack || '').split('\\n').slice(2, 8)
                .map((l) => l.trim().replace(/^at /, '')).join(' < ')
              // ⚠️ **L'ÉTAT DU CROP AU MOMENT DE LA DEMANDE**, et pas à la fin :
              // \`_horsCropSeul\` sort à faux tant que \`_crop\` est \`null\`. Une
              // demande partie avant que le crop soit posé n'a JAMAIS vu la
              // garde, et le relevé final ne peut pas le raconter.
              window.__r3.demandes.push({
                z: t.z, x: t.x, y: t.y, t: performance.now(), pile, prio,
                crop: !!g._crop, seul: !!g._cropSeul, image: g.frame,
              })
            }
            return vrai(t, prio)
          }
        }
      } catch (e) { window.__r3.piege = String(e) }
    },
  })
})()
;(function () {
  function boucle() {
    try {
      if (window.__r3.veille === null) {
        const l = document.getElementById('loading')
        if (l && l.classList.contains('hidden')) window.__r3.veille = performance.now()
      }
      if (window.__r3.premierDessin === null) {
        const g = window.__exp && window.__exp.globe
        if (g && g._crop && g._drawn > 0) window.__r3.premierDessin = performance.now()
      }
    } catch (e) { /* la page n'est pas encore là */ }
    requestAnimationFrame(boucle)
  }
  requestAnimationFrame(boucle)
})()
`

// --------------------------------------------------------- familles d'URL
// ⚠️ Deux gabarits de MNT, et seulement deux (`src/dem-source.js`) :
//   https://tiles.mapterhorn.com/{z}/{x}/{y}.webp
//   https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
const RE_MAPTERHORN = /^https:\/\/tiles\.mapterhorn\.com\/(\d+)\/(\d+)\/(\d+)\.webp/
const RE_AWS = /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/(\d+)\/(\d+)\/(\d+)\.png/

function tuileDeUrl(url) {
  let m = RE_MAPTERHORN.exec(url)
  if (m) return { source: 'mapterhorn', z: +m[1], x: +m[2], y: +m[3] }
  m = RE_AWS.exec(url)
  if (m) return { source: 'aws', z: +m[1], x: +m[2], y: +m[3] }
  return null
}

// ⚠️ **LES QUATRE CHEMINS DU BRIEF, LUS DANS LA PILE.** L'ordre compte : on
// cherche la frame la plus SPÉCIFIQUE d'abord. Une requête dont aucune frame ne
// parle est rendue `inconnu` — jamais rangée d'office dans un chemin.
const CHEMINS = [
  [/demanderEmprise/, '③ demanderEmprise'],
  [/chargeRacines/, '② chargeRacines'],
  [/_traverse|_ensureChildren|_children/, '① _traverse'],
  [/_rechargeTuiles/, '⛔ _rechargeTuiles'],
  [/loadDem|fetchTerrainTile/, '④ loadDem (socle plat)'],
  [/probeMaxZoom|resolveRegionMaxZoom/, 'sondage de couverture'],
  // ⚠️ `_pump` est la POMPE, pas un chemin : une pile qui s'y arrête a perdu son
  // demandeur. On la range à part plutôt que de l'attribuer au hasard.
  [/_pump/, '… pile perdue (via _pump)'],
]
function chemin(pile = []) {
  const texte = pile.join(' ')
  for (const [re, nom] of CHEMINS) if (re.test(texte)) return nom
  return pile.length ? `inconnu(${pile[0]})` : 'inconnu(sans pile)'
}

function famille(url) {
  if (tuileDeUrl(url)) return 'mnt'
  if (/localhost|127\.0\.0\.1/.test(url)) {
    if (/\/data\/bathy\//.test(url)) return 'bathy'
    if (/\/data\/(water|lake)-tiles\//.test(url)) return 'eau'
    if (/\/data\/map\//.test(url)) return 'carto'
    if (/\/src\/|\/node_modules\/|\/@vite|\/@fs/.test(url)) return 'module'
    return 'local'
  }
  if (/tile\.openstreetmap|arcgisonline|basemaps|tiles\./.test(url)) return 'imagerie'
  return 'autre'
}

// ------------------------------------------------------------------ un tirage
async function unTirage(chrome, n) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'r3-sonde-'))
  const args = [
    `--remote-debugging-port=${DP}`,
    `--user-data-dir=${profil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=1280,800', '--mute-audio', '--hide-scrollbars',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    'about:blank',
  ]
  if (SANS_ECRAN) args.unshift('--headless=new', '--enable-unsafe-swiftshader')
  else args.unshift('--window-position=1920,80')

  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let ws
  try {
    const v = await versionCdp(DP)
    ws = new WebSocket(v.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    const cdp = new Cdp(ws)

    const { targetId } = await cdp.envoyer('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.envoyer('Target.attachToTarget', { targetId, flatten: true })

    const requetes = []
    cdp.sur((m) => {
      if (m.sessionId !== sessionId) return
      if (m.method === 'Network.requestWillBeSent') {
        // ⚠️ **LA PILE D'APPEL EST LE SEUL MOYEN D'ATTRIBUER UNE REQUÊTE À SON
        // CHEMIN.** En dev les noms ne sont pas minifiés : `demanderEmprise`,
        // `chargeRacines`, `_traverse` et `fetchAndBuildDem` s'y lisent en
        // clair. Sans elle, on compte des tuiles sans savoir QUI les demande —
        // et c'est exactement l'ambiguïté que cette tâche doit lever.
        const pile = (m.params.initiator?.stack?.callFrames ?? [])
          .slice(0, 12)
          .map((f) => `${f.functionName || '?'}@${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`)
        requetes.push({ url: m.params.request.url, t: m.params.timestamp, id: m.params.requestId, octets: 0, pile })
      } else if (m.method === 'Network.loadingFinished') {
        const r = requetes.find((q) => q.id === m.params.requestId)
        if (r) r.octets = m.params.encodedDataLength ?? 0
      }
    })

    await cdp.envoyer('Network.enable', {}, sessionId)
    await cdp.envoyer('Page.enable', {}, sessionId)
    await cdp.envoyer('Runtime.enable', {}, sessionId)
    await cdp.envoyer('Network.setCacheDisabled', { cacheDisabled: true }, sessionId)
    await cdp.envoyer('Page.addScriptToEvaluateOnNewDocument', { source: SCRIPT_PAGE }, sessionId)

    const url = `http://localhost:${PORT}/?${REQUETE}`
    const tNav = Date.now()
    await cdp.envoyer('Page.navigate', { url }, sessionId)
    await dodo(SECONDES * 1000)

    // ── l'état vivant, et le départage DEDANS/DEHORS fait PAR LA PAGE ─────────
    const listeMnt = requetes.map((r) => tuileDeUrl(r.url)).filter(Boolean).map((t) => [t.z, t.x, t.y])
    const expr = `(async () => {
      const g = window.__exp && window.__exp.globe
      const crop = g ? g._crop : null
      let dansCrop = null
      if (crop) {
        const m = await import('/src/monde/crop-sphere.js')
        dansCrop = ${JSON.stringify(listeMnt)}.map(([z,x,y]) => m.tuileDansCrop(z,x,y,crop) ? 1 : 0)
      }
      const gl = document.querySelector('canvas') && document.querySelector('canvas').getContext('webgl2')
      let renderer = null
      try {
        const d = gl && gl.getExtension('WEBGL_debug_renderer_info')
        renderer = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null
      } catch (e) {}
      return {
        crop,
        dansCrop,
        renderer,
        cropSeul: g ? !!g._cropSeul : null,
        continu: g ? !!g.continu : null,
        queue: g ? g.queue.length : null,
        inFlight: g ? g.inFlight : null,
        tiles: g ? g.tiles.size : null,
        drawn: g ? g._drawn : null,
        refusFile: g ? g._refusFile : null,
        cacheMax: g ? g.cacheMax : null,
        jalons: { veille: window.__r3.veille, premierDessin: window.__r3.premierDessin, piege: window.__r3.piege ?? null },
        demandes: window.__r3.demandes.map((d) => ({
          ...d,
          dedans: crop ? null : null,
        })),
        demandesDedans: crop ? await (async () => {
          const m = await import('/src/monde/crop-sphere.js')
          return window.__r3.demandes.map((d) => m.tuileDansCrop(d.z, d.x, d.y, crop) ? 1 : 0)
        })() : null,
        params: window.__exp ? {
          demZoom: window.__exp.params.demZoom,
          demLat: window.__exp.params.demLat,
          demLon: window.__exp.params.demLon,
          source: window.__exp.params.source,
        } : null,
        erreurs: window.__r3.erreurs ?? null,
      }
    })()`
    const rep = await cdp.envoyer('Runtime.evaluate', {
      expression: expr, awaitPromise: true, returnByValue: true,
    }, sessionId)
    const etat = rep.result?.value ?? null

    // ── mise en forme ────────────────────────────────────────────────────────
    // ⚠️ **LA FENÊTRE DE REPOS SE COMPTE DEPUIS LA NAVIGATION, PAS DEPUIS LA
    // DERNIÈRE REQUÊTE.** La première version la prenait à `dernière − REPOS` :
    // une page qui se tait à la 12ᵉ seconde voyait TOUTES ses requêtes tomber
    // « au repos », et le débit au repos valait le débit de démarrage. C'est
    // le genre de faux chiffre que ce chantier a déjà retiré vingt-six fois.
    const t0 = requetes.length ? Math.min(...requetes.map((r) => r.t)) : 0
    const debutRepos = t0 + (SECONDES - REPOS)

    let k = 0
    const mnt = []
    for (const r of requetes) {
      const t = tuileDeUrl(r.url)
      if (!t) continue
      mnt.push({ ...t, t: +(r.t - t0).toFixed(2), octets: r.octets, dedans: etat?.dansCrop ? !!etat.dansCrop[k] : null, pile: r.pile })
      k++
    }
    const familles = {}
    for (const r of requetes) familles[famille(r.url)] = (familles[famille(r.url)] ?? 0) + 1

    const mntRepos = mnt.filter((m) => m.t + t0 >= debutRepos)
    const dehors = mnt.filter((m) => m.dedans === false)
    const dehorsRepos = mntRepos.filter((m) => m.dedans === false)

    return {
      tirage: n,
      url,
      quand: new Date(tNav).toISOString(),
      renderer: etat?.renderer ?? null,
      secondes: SECONDES,
      fenetreRepos: REPOS,
      requetesTotal: requetes.length,
      familles,
      mnt: {
        total: mnt.length,
        octets: mnt.reduce((s, m) => s + m.octets, 0),
        horsCrop: dehors.length,
        partHorsCrop: mnt.length ? dehors.length / mnt.length : null,
        parZoom: mnt.reduce((a, m) => { a[m.z] = (a[m.z] ?? 0) + 1; return a }, {}),
        horsCropParZoom: dehors.reduce((a, m) => { a[m.z] = (a[m.z] ?? 0) + 1; return a }, {}),
        // qui a demandé quoi — la pile réduite à sa frame la plus parlante
        parChemin: mnt.reduce((a, m) => {
          const c = chemin(m.pile)
          a[c] = a[c] ?? { total: 0, horsCrop: 0 }
          a[c].total++
          if (m.dedans === false) a[c].horsCrop++
          return a
        }, {}),
        liste: mnt,
      },
      repos: {
        mnt: mntRepos.length,
        parSeconde: mntRepos.length / REPOS,
        horsCrop: dehorsRepos.length,
      },
      etatFile: {
        queue: etat?.queue ?? null,
        inFlight: etat?.inFlight ?? null,
        tiles: etat?.tiles ?? null,
        drawn: etat?.drawn ?? null,
        refusFile: etat?.refusFile ?? null,
        cacheMax: etat?.cacheMax ?? null,
        cropSeul: etat?.cropSeul ?? null,
        continu: etat?.continu ?? null,
        crop: etat?.crop ?? null,
      },
      // ── QUI A DEMANDÉ QUOI, vu depuis `_request` lui-même ────────────────
      demandes: (() => {
        const d = etat?.demandes ?? []
        const dedans = etat?.demandesDedans ?? null
        const par = {}
        d.forEach((q, i) => {
          const c = chemin([q.pile])
          par[c] = par[c] ?? { total: 0, horsCrop: 0, zooms: {} }
          par[c].total++
          par[c].zooms[q.z] = (par[c].zooms[q.z] ?? 0) + 1
          if (dedans && !dedans[i]) par[c].horsCrop++
          if (!q.crop) par[c].avantCrop = (par[c].avantCrop ?? 0) + 1
          if (q.crop && !q.seul) par[c].cropSansSeul = (par[c].cropSansSeul ?? 0) + 1
          // ⚠️ `demanderEmprise` sépare ses deux emprises par la PRIORITÉ, et
          // c'est le seul signal disponible ici : `1e9` = le bloc du socle,
          // `9e8` = la SECONDE emprise (la mer, `empriseZoomMer`). Sans ce
          // départage, on rangerait la nappe de mer — dehors PAR CONSTRUCTION —
          // au même compte que le socle.
          if (q.prio === 9e8) par[c].secondeEmprise = (par[c].secondeEmprise ?? 0) + 1
        })
        return {
          total: d.length,
          horsCrop: dedans ? dedans.filter((v) => !v).length : null,
          avantCrop: d.filter((q) => !q.crop).length,
          derniereImageSansCrop: Math.max(-1, ...d.filter((q) => !q.crop).map((q) => q.image)),
          premiereImageAvecCrop: Math.min(Infinity, ...d.filter((q) => q.crop).map((q) => q.image)),
          parChemin: par,
          // ⚠️ **`image` EST DANS LA LISTE, ET IL N'Y ÉTAIT PAS — correction C2.**
          // Le rapport citait « dernière demande sans crop à l'image 11, première
          // avec crop à l'image 41 » ; aucune trace du disque ne portait de numéro
          // d'image. Un chiffre qu'on ne peut pas recalculer depuis sa source
          // n'est pas une mesure.
          liste: d.map((q, i) => ({ z: q.z, x: q.x, y: q.y, prio: q.prio, crop: q.crop, image: q.image, dedans: dedans ? !!dedans[i] : null })),
        }
      })(),
      jalons: etat?.jalons ?? null,
      params: etat?.params ?? null,
    }
  } finally {
    try { ws?.close() } catch { /* déjà fermé */ }
    proc.kill()
    await dodo(1200)
    try { fs.rmSync(profil, { recursive: true, force: true }) } catch { /* verrou Windows */ }
  }
}

// --------------------------------------------------------------------- main
const chrome = trouverChrome()
const tirages = []
for (let i = 1; i <= REPETITIONS; i++) {
  process.stdout.write(`tirage ${i}/${REPETITIONS}…\n`)
  tirages.push(await unTirage(chrome, i))
  await dodo(1500)
}

// dispersion : moyenne, min, max, et l'étendue rapportée à la moyenne — c'est
// CE chiffre-là que le rapport doit citer, pas un tirage isolé.
function stat(vals) {
  const v = vals.filter((x) => Number.isFinite(x))
  if (!v.length) return null
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  const min = Math.min(...v), max = Math.max(...v)
  return { moy, min, max, etendueRel: moy ? (max - min) / moy : null, n: v.length }
}

const resume = {
  requete: REQUETE,
  secondes: SECONDES,
  fenetreRepos: REPOS,
  repetitions: REPETITIONS,
  sansEcran: SANS_ECRAN,
  renderer: tirages[0]?.renderer ?? null,
  mntTotal: stat(tirages.map((t) => t.mnt.total)),
  mntOctets: stat(tirages.map((t) => t.mnt.octets)),
  mntHorsCrop: stat(tirages.map((t) => t.mnt.horsCrop)),
  partHorsCrop: stat(tirages.map((t) => t.mnt.partHorsCrop)),
  reposParSeconde: stat(tirages.map((t) => t.repos.parSeconde)),
  reposHorsCrop: stat(tirages.map((t) => t.repos.horsCrop)),
  queue: stat(tirages.map((t) => t.etatFile.queue)),
  inFlight: stat(tirages.map((t) => t.etatFile.inFlight)),
  tiles: stat(tirages.map((t) => t.etatFile.tiles)),
  drawn: stat(tirages.map((t) => t.etatFile.drawn)),
  refusFile: stat(tirages.map((t) => t.etatFile.refusFile)),
  requetesTotal: stat(tirages.map((t) => t.requetesTotal)),
  veilleMs: stat(tirages.map((t) => t.jalons?.veille)),
  premierDessinMs: stat(tirages.map((t) => t.jalons?.premierDessin)),
}

const out = path.resolve(SORTIE)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ resume, tirages }, null, 2))
console.log(JSON.stringify(resume, null, 2))
console.log(`\n→ ${out}`)
