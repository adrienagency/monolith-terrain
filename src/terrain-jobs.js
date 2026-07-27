// LE CALCUL DÉPORTÉ, SÉPARÉ DE SON TRANSPORT.
//
// Mesuré sur MNT réel 1536² : `analyzeDem` 387 ms + `buildSeaMask`/`blurMask`
// 81 ms. Ces ~470 ms ne DISPARAISSENT PAS en migrant dans un Worker — elles
// cessent seulement de figer l'onglet. C'est tout l'objet du module : ce n'est
// pas la durée totale qui gêne l'utilisateur, c'est le gel.
//
// `terrain-analysis.js` et `sea-mask.js` sont les deux seuls modules PURS du
// chemin de reconstruction (ni DOM, ni three.js) : les deux seuls candidats
// propres à un Worker. `computeTerrainJob` est donc exactement ce que faisaient
// `_buildAnalysis` et `_buildSeaMask` en ligne, et test/terrain-jobs.test.js
// verrouille l'égalité OCTET POUR OCTET sur quatre familles de relief. Un seul
// flottant qui diverge est un bug, pas un arrondi : ces champs peignent les
// crêtes du bloc central.
import { analyzeDem, resampleField } from './terrain-analysis.js'
import { buildSeaMask, blurMask } from './sea-mask.js'

/**
 * Le calcul, nu. Appelé par le Worker, et directement par le fil principal en
 * repli (navigateur sans Worker, contexte contraint, test node).
 *
 * ⚠️ `withAnalysis: false` sert au ré-calcul du masque de mer seul, quand le
 * trait de côte vectoriel arrive après coup (`setCoastMask`) : la landMask ne
 * change QUE la mer, recuire les ~10 flous de l'analyse coûterait 387 ms pour
 * un résultat identique.
 *
 * ⚠️ `seaMax` PLAFONNE le masque de mer, et il est arrivé APRÈS `maxSize` parce
 * qu'on l'avait oublié : block-grid.js proclamait « aucun champ ne dépasse
 * quatre fois la densité du maillage qui le porte » alors que le masque de mer
 * se calculait toujours sur le MNT PLEIN — 1536² sur une voisine maillée à 256,
 * soit 6,00×, et 2,25 Mo par dalle (54 Mo sur un damier plein). Le shader lit ce
 * champ en UV MONDE : sa taille lui est indifférente, exactement comme
 * l'analyse.
 *
 * ⚠️ ET LA landMask DOIT ARRIVER À LA TAILLE DU MASQUE, pas à celle du MNT :
 * `buildSeaMask` l'indexe cellule pour cellule. C'est terrain.js qui la
 * rasterise (`_landMaskFor`), donc c'est lui qui applique le même plafond —
 * un tableau à la mauvaise taille rendrait des polders au hasard, pas une
 * erreur bruyante.
 *
 * CONTRAT : sans `seaMax`, résultat bit-à-bit identique à avant.
 */
export function computeTerrainJob({ data, size, metersPerPixel, maxSize = 0, seaMax = 0, landMask = null, withAnalysis = true }) {
  const dem = { data, size, metersPerPixel }
  const a = withAnalysis ? analyzeDem(dem, { maxSize }) : null
  // (buildSeaMask est topologique : il ne lit ni metersPerPixel ni aucune
  // longueur en mètres — son seuil est en mètres d'ALTITUDE et son critère de
  // bassin est une FRACTION de la dalle. Le plafond ne dérègle donc rien.)
  const mer = resampleField(data, size, seaMax)
  const m = blurMask(buildSeaMask({ data: mer.data, size: mer.size }, { landMask }), 1)
  return { analysis: a ? a.rgba : null, analysisSize: a ? a.size : 0, sea: m.mask, seaSize: m.size }
}

// --------------------------------------------------------------- péremption
//
// LE PIÈGE EST L'INVALIDATION TROP LARGE, pas l'inverse. Un compteur global
// incrémenté à chaque `rebuild()` périmerait des résultats ENCORE JUSTES : un
// coup de curseur d'exagération, un changement de résolution du maillage ou de
// palette rappellent `rebuild()` sans toucher aux altitudes. Or l'analyse et le
// masque de mer ne dépendent QUE de trois choses — le MNT, la landMask du trait
// de côte, et le plafond de taille des dalles voisines. La clé ne porte donc
// que celles-là, et rien d'autre.
//
// Symétriquement, une invalidation trop laxiste laisserait le peigné d'un
// massif se poser sur le relief d'ailleurs. Les deux bords sont testés.
//
// ⚠️ ET LES DEUX CHAMPS N'ONT PAS LES MÊMES DÉPENDANCES. Le masque de mer
// dépend de la landMask, l'analyse de relief n'en dépend PAS (elle ne lit que
// les altitudes). Les confondre coûtait cher, et ça s'est vu à l'écran : sur
// une dalle voisine, le trait de côte arrive ~300 ms après le lancement, donc
// AVANT la fin de l'analyse — une clé commune périmait alors une analyse
// parfaitement juste, et la dalle restait sans peigné à côté d'un centre
// peigné. D'où la comparaison PARTIELLE ci-dessous : `jobStillValid` ne
// compare que les champs présents dans la clé qu'on lui donne, et chaque champ
// du résultat est jugé sur SA clé.

/**
 * @param {{dem?:object, landMask?:object|null, maxSize?:number, seaMax?:number}|null} lance
 *   clé au lancement — les champs ABSENTS ne sont pas comparés.
 * @param {typeof lance} actuel clé au moment de l'arrivée.
 */
export function jobStillValid(lance, actuel) {
  if (!lance || !actuel) return false
  for (const champ of ['dem', 'landMask', 'maxSize', 'seaMax']) {
    if (champ in lance && lance[champ] !== actuel[champ]) return false
  }
  return true
}

// ------------------------------------------------------------ dédoublonnage
//
// LE MÊME CALCUL, POSTÉ DEUX FOIS, À TROIS LIGNES D'INTERVALLE.
//
// La naissance d'une dalle voisine enchaîne `terrain.rebuild()` — qui lance les
// champs — puis `_applyLook` → `setColorMode`, qui les relance parce qu'il
// regarde `uAnalysisOn` : l'uniforme ne passera à 1 qu'à l'ARRIVÉE du premier
// travail, donc il vaut encore 0 et le test « l'analyse manque » dit vrai alors
// qu'elle est en route. Mesuré sur 8 dalles : 24 travaux postés au Worker dont
// 16 avec analyse, 226,5 Mo de MNT recopiés par postMessage. Après : 16 travaux
// dont 8 avec analyse, 151,3 Mo — 8 analyses complètes de trop en moins
// (~390 ms chacune) et 75 Mo de copies épargnées. Sur un damier plein, 24
// analyses inutiles et ~9 s de travailleur.
//
// ⚠️ CE PRÉDICAT NE DOIT PAS ÊTRE UNE ÉGALITÉ DE CLÉS, et c'est tout son sel :
// un travail « mer seule » EN VOL ne couvre PAS une demande qui réclame
// l'analyse (le trait de côte arrive pendant la construction, et sa relance
// n'emporte que la mer). L'inverse, oui : un travail complet couvre une demande
// de mer seule. D'où la comparaison asymétrique sur `analyse`.
//
// ⚠️ Et rien ici ne doit empêcher un RECALCUL LÉGITIME : dès qu'une des entrées
// change — le MNT (zoom, autre lieu), la landMask, un plafond — la clé diffère
// et le travail repart. Les deux bords sont testés.

/**
 * Le travail encore EN VOL rend-il inutile celui qu'on s'apprête à poster ?
 * @param {{dem:object, landMask:object|null, maxSize:number, seaMax:number, analyse:boolean}|null} enVol
 * @param {typeof enVol} neuf
 */
export function jobCouvertParEnVol(enVol, neuf) {
  if (!enVol || !neuf) return false
  for (const champ of ['dem', 'landMask', 'maxSize', 'seaMax']) {
    if (enVol[champ] !== neuf[champ]) return false
  }
  return !neuf.analyse || !!enVol.analyse
}

/**
 * Lance un travail et ne pose son résultat que s'il est encore d'actualité.
 *
 * ⚠️ `current()` est relu AU MOMENT DE L'ARRIVÉE, pas au lancement : c'est
 * précisément la fenêtre pendant laquelle l'utilisateur zoome ou change de lieu.
 *
 * ⚠️ `key` ne porte ici que ce qui périme TOUT le résultat — en pratique le
 * MNT. Le tri fin champ par champ revient à `apply`, qui reçoit la clé du
 * moment : lui seul sait de quoi chaque champ dépend (voir jobStillValid).
 *
 * ⚠️ La promesse rendue se résout TOUJOURS, y compris sur abandon ou sur panne
 * du Worker : le voile de chargement l'attend, une promesse qui pend laisserait
 * l'application voilée pour toujours — pire que le gel qu'on supprime.
 */
export function scheduleTerrainJob({ key, job, current, apply, run = runTerrainJob }) {
  return Promise.resolve()
    .then(() => run(job))
    .then((r) => {
      if (!r) return null // travail abandonné (cancelTerrainJobs)
      const actuel = current()
      if (!jobStillValid(key, actuel)) return null // périmé : l'utilisateur est ailleurs
      apply(r, actuel)
      return r
    })
    .catch((err) => {
      console.warn('[terrain-jobs] travail perdu', err)
      return null
    })
}

// ---------------------------------------------------------- transport (navigateur)
//
// UN SEUL Worker pour toute l'application. Le bloc central ne charge qu'un MNT à
// la fois ; le damier sérialise déjà ses dalles, et les faire attendre l'une
// derrière l'autre hors du fil principal ne coûte rien à personne.
//
// ⚠️ LE MNT N'EST NI TRANSFÉRÉ NI RECOPIÉ À LA MAIN. `postMessage` en fait déjà
// une copie structurée ; le `.slice()` qu'on serait tenté d'écrire doublerait la
// facture (9 Mo par dalle). Et le transférer DÉTACHERAIT le tableau côté fil
// principal, qui en a besoin pendant tout le calcul pour la veille des bateaux,
// le tracé de la jupe et l'orographie des nuages.
let worker = null
let workerHS = false // hors service : construction impossible, ou mort en vol
let sequence = 0
const enVol = new Map()

function acheminer(id, r) {
  const attente = enVol.get(id)
  if (!attente) return // déjà abandonné par cancelTerrainJobs
  enVol.delete(id)
  attente.resolve(r)
}

function obtenirWorker() {
  if (workerHS || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    // ⚠️ La forme `new URL(..., import.meta.url)` + `type: 'module'` est celle
    // que Vite reconnaît statiquement : c'est elle qui fait émettre un chunk de
    // worker au build de production. Une URL construite dynamiquement marcherait
    // en dev (les modules sont servis tels quels) et casserait en prod.
    worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' })
  } catch (err) {
    // vieux navigateur, CSP, `file://` : on ne réessaie plus, on calcule ici.
    console.warn('[terrain-jobs] Worker indisponible, repli sur le fil principal', err)
    workerHS = true
    worker = null
    return null
  }
  worker.onmessage = (e) => acheminer(e.data.id, e.data)
  worker.onerror = (err) => {
    // le Worker est mort en cours de route : on le déclare hors service et on
    // REJOUE les travaux en vol sur le fil principal. Un relief sans analyse
    // serait pire qu'un relief lent.
    console.warn('[terrain-jobs] Worker en panne, repli sur le fil principal', err)
    workerHS = true
    worker = null
    const restants = [...enVol.values()]
    enVol.clear()
    for (const { resolve, job } of restants) {
      try {
        resolve(computeTerrainJob(job))
      } catch {
        resolve(null)
      }
    }
  }
  return worker
}

export function runTerrainJob(job) {
  const w = obtenirWorker()
  if (!w) return Promise.resolve().then(() => computeTerrainJob(job))
  const id = ++sequence
  return new Promise((resolve) => {
    enVol.set(id, { resolve, job })
    w.postMessage({ id, ...job })
  })
}

/**
 * Abandonne les résultats en vol — changement de zoom, destruction du damier.
 *
 * ⚠️ Les promesses en attente sont RÉSOLUES À NULL, pas laissées en plan :
 * `scheduleTerrainJob` les relaie au voile de chargement.
 */
export function cancelTerrainJobs() {
  const restants = [...enVol.values()]
  enVol.clear()
  for (const { resolve } of restants) resolve(null)
}

/**
 * Remet le transport à neuf — TESTS UNIQUEMENT.
 *
 * ⚠️ `workerHS` est volontairement COLLANT en production : une fois qu'on sait
 * que le Worker ne démarre pas, le reconstruire à chaque reconstruction du bloc
 * central ne ferait que repayer l'échec. C'est donc aussi ce qu'un test doit
 * pouvoir défaire pour ne pas contaminer le suivant.
 */
export function resetTerrainTransport() {
  cancelTerrainJobs()
  worker?.terminate?.()
  worker = null
  workerHS = false
}
