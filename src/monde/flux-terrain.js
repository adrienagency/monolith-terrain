// LE FLUX DE TERRAIN — l'interface entre une EMPRISE et le quadtree du globe.
// Tâche 4 bis du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// Ce module ne charge rien lui-même : il **pilote** `src/globe.js`, qui est déjà
// la seule source de relief du plan. Il ne dessine rien non plus. Il répond à
// six questions, et à six seulement :
//
//   · quelles tuiles couvrent cette emprise, et va les demander ;
//   · lesquelles sont prêtes ;
//   · à quelle finesse l'emprise est RÉELLEMENT couverte (≠ demandée) ;
//   · comment remplir une grille de hauteurs depuis ce qui est prêt ;
//   · à quel débit le réseau répond.
//
// ══════════ 0. CE QUI EXISTAIT DÉJÀ, ET CE QU'ON EN A PRIS ══════════════════
//
// Le §1 de `/threejs-optimisation` demande de chercher l'abstraction du projet
// AVANT d'écrire. Quatre candidates ont été rejouées contre le dépôt :
//
//   · `empriseSocle` (`seuil-socle.js:329`) — **PRISE, ET C'EST LE PRODUCTEUR
//     D'`emprise` DU PLAN.** Ce module la CONSOMME, il ne la réinvente pas.
//   · `originesEmprise` (`dem-emprise.js:183`) — rejetée, et la Tâche 3 l'avait
//     déjà établi : elle cale sur des ORIGINES DE TUILE ENTIÈRES, donc elle
//     saute d'un tiers de socle d'un cadrage au suivant. C'est un cran.
//   · `enVolBorne` (`dem-emprise.js:251`) — **regardée de près, et non prise.**
//     C'est bien du plafonnement de vol, exact et éprouvé (`EMPRISE_EN_VOL_MAX
//     = 3`), mais il plafonne des CHARGEMENTS DE BLOCS DE MNT lancés en une
//     fois, pour un pic MÉMOIRE mesuré (242 → 215 Mo). Ici la population est une
//     file qui se remplit et se vide à chaque image, le vol est déjà plafonné
//     par `MAX_CONCURRENT = 6`, et ce qu'il faut borner c'est l'ATTENTE, pas le
//     vol. `enVolBorne` rendrait une promesse unique sur un lot figé : le
//     contraire de ce qu'on veut. Le plafond vit donc dans `globe.js`
//     (`PLAFOND_FILE`), là où la file vit.
//   · `MERCATOR_MAX_LAT` (`geo.js`) — **PRISE**, et non recopiée : voir la note
//     à l'import.
//   · `sampleHeights` (`globe.js`) — **PRISE**, et exportée pour l'occasion
//     plutôt que recopiée : la convention de demi-pixel (les centres de texels
//     à `(i + 0,5)/256`) est ce qui garde relief et texture en registre, et deux
//     copies de cette convention sont deux occasions de les désaccorder.
//
// ══════════ 1. CE QUE `zoomEffectif` MESURE, ET POURQUOI IL EXISTE ══════════
//
// ⚠️ **« DEMANDÉ » ET « COUVERT » SONT DEUX GRANDEURS DIFFÉRENTES, et tout le
// défaut que cette tâche corrige tenait dans leur confusion.** Le flux peut
// demander z13 et n'avoir que z9 sous les yeux ; la caméra, elle, ne voit que ce
// qui est couvert. `zoomEffectif` rend le niveau réellement disponible **au
// point le PLUS PAUVRE de l'emprise** — un minimum, pas une moyenne : une
// emprise fine partout sauf dans un coin est une emprise trouée, et c'est le
// coin qui décide.
//
// ⚠️ **IL REND `null`, ET NON `0`, QUAND RIEN NE COUVRE L'EMPRISE.** `0` est un
// vrai niveau de zoom (la planète entière en une tuile) : le rendre voudrait
// dire « couvert, très grossièrement », c'est-à-dire le contraire de la vérité.
// C'est la même règle que `debitObserve`, pour la même raison.
//
// ══════════ 2. LE DÉBIT — CE QU'IL EST, ET CE QU'IL N'EST PAS ═══════════════
//
// `debitObserve` agrège le journal réseau de `globe.js` (`_journalReseau`) :
// des réponses RÉELLEMENT reçues, avec leur taille et leurs deux bornes de
// temps. Trois choix, tous les trois contraignants :
//
//   1. ⚠️ **EN TEMPS MURAL, pas en somme de durées.** Six transferts simultanés
//      de 359 ms occupent 359 ms de mur, pas 2 154 : sommer les durées
//      diviserait le débit par six et ferait croire à un réseau six fois plus
//      lent qu'il n'est. On prend donc `Σoctets × 8 / (fin la plus tardive −
//      début le plus précoce)`.
//   2. ⚠️ **SUR UNE FENÊTRE RÉCENTE**, sinon un temps d'arrêt de trente secondes
//      au milieu du journal écraserait le débit à jamais. `FENETRE_DEBIT_MS`
//      borne l'âge des réponses retenues.
//   3. ⚠️ **`null` SUR UN FLUX NEUF, JAMAIS `0`.** Zéro se propagerait en
//      « réseau mort » dans `zoomSoutenable` (Tâche 4 ter) et clouerait la
//      descente au zoom le plus grossier alors qu'on n'a simplement **rien
//      encore mesuré**. Le manque de mesure et la mesure d'un manque sont deux
//      choses ; les confondre est un bogue silencieux.
//
// ⚠️ **ET JAMAIS `navigator.connection`** : il ment, et il n'existe pas partout.
// La règle est écrite dans la Tâche 4 ter, elle se tient ici.
//
// ══════════ 3. `remplirHauteurs` — PAR LOT, JAMAIS PAR PIXEL ════════════════
//
// ⚠️ **MESURÉ, ET C'EST POUR ÇA QUE LA SIGNATURE EST CELLE-CI.** Une version du
// plan proposait `lireHauteur(flux, {x, y, z})`, appelée une fois par sommet.
// Chronométrée par l'attaque : **+3,5 ms par reconstruction à N=256** (0,11 →
// 3,65 ms), *sans même l'interpolation bilinéaire*, sur un budget d'image déjà
// déclaré dépassé à 8,3 ms. L'interface commode aurait mangé à elle seule la
// moitié de ce qui reste.
//
// La forme retenue : **une passe par TUILE TOUCHÉE**. Pour chaque tuile prête,
// on calcule la fenêtre d'échantillons de sortie qui tombe dedans et on l'écrit
// d'un bloc. Coût total : un passage sur la grille, plus une boucle sur les
// tuiles — jamais une recherche par sommet.
//
// ⚠️ **DE LA PLUS GROSSIÈRE À LA PLUS FINE**, pour que le fin écrase le
// grossier là où les deux existent. Le tri est sur `z` croissant, et il n'est
// pas décoratif : sans lui une z9 périmée effacerait une z13 fraîche.
//
// ══════════ 4. LA BATHYMÉTRIE — Tâche 6 sexies ══════════════════════════════
//
// ⚠️ **LE QUADTREE SERT LE TERRARIUM NU, ET LA MER Y EST PLATE.** Mesuré par la
// Tâche 6 quinquies puis rejoué avec les VRAIES données le 2026-08-21
// (`.banc/rejeu-6sexies.mjs`, hors dépôt : tuiles d'altitude d'AWS, fichiers de
// `public/data/bathy/`, `loadDem` avec et sans fusion sur la même grille 768²) :
//
//   lieu                     | nœuds en mer | écart moyen | écart max | |minM|
//   La Réunion (côte ouest)  |      315 809 |     485,7 m |   1 324 m | 1 324 m
//   Nice                     |      285 580 |     615,0 m |   1 411 m | 1 411 m
//   Chamonix (témoin)        |            0 |           — |       0 m |   805 m
//
// **Sur la TERRE l'écart est de 0,00 m** — `fuseBathymetry` n'y touche pas.
// **En MER l'écart maximal vaut EXACTEMENT `|minM|`** : le terrarium rend ZÉRO
// au point le plus profond. À l'écran, une plaine pâle uniforme là où la
// production a ses canyons.
//
// **TROIS CHOIX, ET CHACUN A SA RAISON :**
//
//   1. ⚠️ **`fuseBathymetry` EST RÉUTILISÉE, PAS RÉÉCRITE**, et la descente
//      « tuile fine → plancher » l'est aussi (`peindreBathyTuile`, extraite de
//      `dem.js` pour l'occasion). C'est le §1 de `/threejs-optimisation` : une
//      seconde loi, ce serait quatre subtilités à faire coïncider — le plafond
//      par zone, le plancher `min(BATHY_ZMIN, zoom)`, la mémoire des absences,
//      et la sous-fenêtre de surzoom mesurée en pixels BATHY. Chacune a déjà
//      coûté un défaut visible à l'écran.
//   2. ⚠️ **LA FUSION SE FAIT EN UNE FOIS SUR TOUTE L'EMPRISE, JAMAIS PAR
//      TUILE.** `detectFillLevels` constate les APLATS DE REMPLISSAGE du champ
//      (Mapterhorn cale sa mer sur une constante par dalle : −0,094, −0,344,
//      −0,406, −2,781 m selon la dalle). Fusionner tuile par tuile lui donnerait
//      neuf histogrammes de neuf fois moins de sondes, sous le seuil
//      `FILL_MIN_SONDES` : les aplats ne seraient plus vus, et le liseré de bord
//      de dalle reviendrait. `dem.js` fusionne le bloc entier ; on fait pareil.
//   3. ⚠️ **LE CHARGEMENT EST ASYNCHRONE, LE REMPLISSAGE RESTE SYNCHRONE.**
//      `remplirHauteurs` est sur le chemin du raffinement par image : y mettre
//      un `await` rouvrirait exactement l'attente que la Tâche 6 septies vient
//      de fermer. La mer se charge donc à côté, et `remplirHauteurs` fusionne ce
//      qui est déjà décodé — décision 13 au pied de la lettre : la mer est plate
//      au premier instant, creusée dès que le fichier local atterrit.
//
// ⚠️ **ET C'EST POUR ÇA QUE `revisionFlux` EXISTE.** `socleRaffine` (`main.js`)
// ne redessine que lorsque le signal du flux change. S'il ne comptait que les
// tuiles d'ALTITUDE lisibles, une bathymétrie arrivée APRÈS la dernière tuile ne
// déclencherait rien : le fond marin serait chargé, fusionnable, et **jamais
// affiché**. Un défaut parfaitement muet, et le test du banc le garde.

import {
  MAX_Z,
  _journalReseau,
  sampleHeights,
  sequenceReseau,
} from '../globe.js'
import { ZOOM_SOCLE } from './seuil-socle.js'
import { MERCATOR_MAX_LAT } from '../geo.js'
// ⚠️ **CET IMPORT NE FERME AUCUN CYCLE, ET C'EST VÉRIFIÉ PLUTÔT QUE SUPPOSÉ.**
// `dem.js` n'importe que `bathy.js`, `bathy-sources.js` (→ `map/tile-index.js`),
// `dem-memo.js`, `dem-quant.js` et `dem-source.js` — aucun des six ne remonte
// vers `globe.js`, `terrain.js` ou ce module. Le piège que la Tâche 6 bis A a
// payé (un cycle qui ne casse **qu'en production**) ne se referme donc pas ici.
import { peindreBathyTuile, indexBathy } from '../dem.js'
import { fuseBathymetry } from '../bathy.js'

// ⚠️ **IMPORTÉE, PAS RECOPIÉE — et c'est la différence avec `seuil-socle.js`.**
// Là-bas la recopie se justifie : ce module-là est PUR (ni DOM, ni three, ni
// fetch) et importer `geo.js` lui ferait tirer three.js par `terrain.js`. Ici
// la question ne se pose pas : ce module importe déjà `globe.js`, qui importe
// three. Recopier une constante qu'on peut importer, c'est fabriquer une
// occasion de divergence en échange de rien.
export const MERCATOR_LAT_MAX = MERCATOR_MAX_LAT

// L'âge maximal d'une réponse retenue pour le débit. ⚠️ **CINQ SECONDES, ET
// C'EST LA MÊME DURÉE QUE L'ASSERTION DU PANORAMIQUE** (« après 90° de balayage
// puis 5 s d'immobilité ») : le débit doit décrire le réseau du geste en cours,
// pas celui d'il y a une minute. À 12 Mb/s et six requêtes simultanées de
// 359 ms, cinq secondes portent ~84 réponses — largement au-dessus du bruit.
export const FENETRE_DEBIT_MS = 5000

const D2R = Math.PI / 180

// ══════════ 4. MERCATOR NORMALISÉ — le seul repère de ce module ═════════════
//
// Tout se calcule en coordonnées de Mercator ramenées à [0, 1] : `mx` vers
// l'est, `my` vers le SUD (comme les `y` de tuile). Une tuile `(z, x, y)` occupe
// exactement `[x/2^z, (x+1)/2^z] × [y/2^z, (y+1)/2^z]`, ce qui rend
// l'intersection et l'échantillonnage triviaux et **sans trigonométrie par
// sommet**.

function mercX(lon) {
  return (lon + 180) / 360
}

function mercY(lat) {
  const la = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat)) * D2R
  return (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2
}

/**
 * L'emprise en Mercator normalisé. ⚠️ `ouest > est` signifie **franchissement de
 * l'antiméridien** (convention de `seuil-socle.js` et de `bathy-sources.js`) :
 * on rend alors `x1 > 1`, c'est-à-dire une emprise qui déborde du monde par la
 * droite. Les tuiles se comparent ensuite modulo 1, une seule fois, dans
 * `tuilesEmprise`.
 */
function boiteMerc(emprise) {
  const ouest = Number(emprise?.ouest)
  const est = Number(emprise?.est)
  const sud = Number(emprise?.sud)
  const nord = Number(emprise?.nord)
  if (![ouest, est, sud, nord].every(Number.isFinite)) {
    throw new TypeError('flux-terrain : `emprise` doit porter ouest/sud/est/nord finis')
  }
  const x0 = mercX(ouest)
  let x1 = mercX(est)
  if (x1 <= x0) x1 += 1 // antiméridien
  return { x0, x1, y0: mercY(nord), y1: mercY(sud) }
}

/**
 * Les clés de tuiles qui couvrent l'emprise à ce zoom, en ligne-major.
 *
 * ⚠️ **ET AUCUNE AUTRE** — c'est l'assertion de `demanderEmprise`. Les bornes
 * hautes sont donc EXCLUSIVES au bord : une emprise dont l'arête droite tombe
 * pile sur une frontière de tuile ne demande pas la colonne d'après. Sans ce
 * `Math.ceil(...) - 1`, un socle aligné sur la grille demanderait
 * (BLOCK_TILES + 1)² tuiles au lieu de BLOCK_TILES².
 */
export function tuilesEmprise(emprise, zoom) {
  const r = rectangleTuiles(emprise, zoom)
  const out = []
  for (let y = r.iy0; y <= r.iy1; y++) {
    for (let x = r.ix0; x <= r.ix1; x++) {
      out.push({ z: r.z, x: ((x % r.n) + r.n) % r.n, y })
    }
  }
  return out
}

/**
 * Le RECTANGLE de tuiles qui couvre l'emprise, **en indices NON repliés**.
 *
 * ⚠️ **UNE SEULE LOI, ET `tuilesEmprise` L'APPELLE AUSSI** (Tâche 6 sexies). La
 * bathymétrie a besoin du rectangle CONTIGU pour peindre une nappe d'un seul
 * tenant ; `tuilesEmprise` a besoin de la liste repliée modulo le monde. Les
 * deux se déduisent des mêmes quatre bornes, et deux copies de ce
 * `Math.ceil(...) - 1` seraient deux occasions de désaccorder la nappe de la
 * liste — au bord de l'antiméridien, en silence.
 */
function rectangleTuiles(emprise, zoom) {
  const z = Math.max(0, Math.min(MAX_Z, Math.floor(zoom)))
  const n = 2 ** z
  const b = boiteMerc(emprise)
  const ix0 = Math.floor(b.x0 * n)
  const ix1 = Math.max(ix0, Math.ceil(b.x1 * n) - 1)
  const iy0 = Math.max(0, Math.floor(b.y0 * n))
  const iy1 = Math.max(iy0, Math.min(n - 1, Math.ceil(b.y1 * n) - 1))
  return { z, n, ix0, ix1, iy0, iy1, colonnes: ix1 - ix0 + 1, lignes: iy1 - iy0 + 1 }
}

/**
 * Le zoom le plus FIN dont le rectangle de tuiles tienne dans `tuilesMax`.
 *
 * ⚠️ **LE ZOOM SE CHOISIT DEPUIS L'EMPRISE, IL NE SE POSE PAS — ET C'EST MESURÉ.**
 * La Tâche F a relevé qu'un champ de mer de 164 km rempli au zoom du BLOC (z12)
 * ne couvrait que **19,3 %** de ses nœuds, quand **z10 en couvre 100 %** pour
 * **25 tuiles**. Le zoom du bloc est juste pour le bloc ; sur une emprise dix
 * fois plus large il demande cent fois plus de tuiles, et le budget les refuse.
 *
 * ⚠️ **ET `rectangleTuiles`, PAS `tuilesEmprise`** : la seconde ÉNUMÈRE, donc un
 * essai à z12 sur 164 km construirait des milliers d'objets pour être jeté.
 *
 * @param {object} emprise `{ouest, sud, est, nord}` en degrés
 * @param {{zoomMax?:number, zoomMin?:number, tuilesMax?:number}} [opt]
 * @returns {number} un zoom entier dans `[zoomMin, zoomMax]`
 */
export function zoomPourEmprise(emprise, { zoomMax = ZOOM_SOCLE, zoomMin = 0, tuilesMax = 25 } = {}) {
  const haut = Math.max(0, Math.min(MAX_Z, Math.floor(zoomMax)))
  const bas = Math.max(0, Math.min(haut, Math.floor(zoomMin)))
  for (let z = haut; z > bas; z--) {
    const r = rectangleTuiles(emprise, z)
    if (r.colonnes * r.lignes <= tuilesMax) return z
  }
  return bas
}

/** La tuile `(z,x,y)` intersecte-t-elle la boîte Mercator ? (bord exclu) */
function intersecte(b, z, x, y) {
  const n = 2 ** z
  const ty0 = y / n
  const ty1 = (y + 1) / n
  if (ty1 <= b.y0 || ty0 >= b.y1) return false
  // en longitude, la boîte peut déborder par la droite (antiméridien) : on
  // essaie la tuile à sa place et un tour de monde plus loin
  for (const dx of [0, 1]) {
    const tx0 = x / n + dx
    const tx1 = (x + 1) / n + dx
    if (tx1 > b.x0 && tx0 < b.x1) return true
  }
  return false
}

// ══════════ 5. LA FABRIQUE ══════════════════════════════════════════════════

/**
 * Un flux neuf : **un cache vide et zéro requête**.
 *
 * ⚠️ Il ne demande RIEN à sa naissance, et c'est la première assertion de cette
 * tâche. Un flux qui chargerait à la construction se battrait pour la bande
 * passante avec la carte, exactement comme les seize racines du globe le
 * faisaient avant qu'on les décale (voir le constructeur de `globe.js`).
 *
 * @param {{globe: object}} arg
 */
export function creerFlux({ globe } = {}) {
  if (!globe || typeof globe._request !== 'function' || !(globe.tiles instanceof Map)) {
    throw new TypeError('creerFlux : il faut un `globe` (src/globe.js)')
  }
  return {
    globe,
    // le repère dans le journal réseau : ce flux n'observe QUE ce qui est
    // arrivé après sa naissance
    seqDepart: sequenceReseau(),
    // ce que la dernière `demanderEmprise` a réclamé — `zoomEffectif` s'y
    // compare, et il n'a donc pas besoin qu'on lui redonne le zoom
    demande: null,
    // clé → tuile, pour les tuiles RÉCLAMÉES à la dernière demande
    reclamees: new Map(),
    // la nappe bathymétrique de l'emprise courante — voir le §4. `null` tant
    // que personne n'a demandé : un flux neuf ne charge RIEN, la mer comprise.
    bathy: null,
    // combien de nappes ont atterri. ⚠️ C'est le SEUL fil qui ramène la mer à
    // l'écran (`revisionFlux`), et il compte des ARRIVÉES, pas des demandes.
    bathyRevision: 0,
  }
}

// ══════════ 6 bis. LE SIGNAL DE RAFFINEMENT ════════════════════════════════

/**
 * La signature de ce que le socle peut dessiner **maintenant** : le nombre de
 * tuiles réclamées lisibles, et le nombre de nappes bathymétriques atterries.
 *
 * ⚠️ **C'EST UNE BOUCLE SUR ~16 ENTRÉES, PAS UN PARCOURS DU CACHE** (des
 * centaines) : c'est le seul signal de raffinement qui ne coûte rien, et c'est
 * `main.js` (`socleRaffine`) qui le compare d'une image à l'autre.
 *
 * ⚠️ **ET IL PORTE LA MER**, sinon une bathymétrie arrivée après la dernière
 * tuile d'altitude ne redessinerait jamais rien — voir le §4.
 *
 * @returns {string} stable tant que rien n'a bougé
 */
export function revisionFlux(flux) {
  let n = 0
  for (const t of flux.reclamees.values()) if (t.state === 'ready' && t.heights) n++
  return `${n}/${flux.bathyRevision ?? 0}`
}

// ══════════ 6. DEMANDER ═════════════════════════════════════════════════════

/**
 * Demande au globe les tuiles qui couvrent `emprise` à `zoom`, **et aucune
 * autre**.
 *
 * ⚠️ **ET ANNULE CELLES QUI VIENNENT D'EN SORTIR** (correction 2 de la tâche) :
 * une tuile réclamée à l'image précédente et qui n'est plus dans l'emprise est
 * retirée de la file du globe et rendue à `empty`. C'est le geste que le
 * panoramique rend indispensable : sans lui, chaque image du balayage laisse
 * derrière elle une emprise entière de tuiles qui attendent pour rien.
 *
 * ⚠️ **UN SEUL FLUX PAR GLOBE.** `globe.gardeHauteurs` est remplacée à chaque
 * appel : deux flux sur le même globe se reprendraient leurs réservations d'un
 * appel à l'autre, et chacun verrait les hauteurs de l'autre disparaître. Ce
 * n'est pas une limite gênante — il y a un socle, donc un flux — mais elle est
 * ÉCRITE plutôt que sous-entendue.
 *
 * ══════════ `aussi` — LA SECONDE EMPRISE, ET POURQUOI ELLE ENTRE ICI ═══════
 *
 * ⚠️ **ON ÉLARGIT, ON NE REMPLACE PAS : `aussi` À `null` REPRODUIT LE DÉPÔT AU
 * BIT PRÈS**, et c'est le patron que la Tâche F a posé avec `distanceRivage`.
 *
 * ⚠️ **ET ELLE NE POUVAIT PAS ÊTRE UN SECOND APPEL.** C'est tout le §« un seul
 * flux par globe » : `gardeHauteurs` est REMPLACÉE à chaque appel, donc deux
 * appels — l'un pour le bloc, l'autre pour la mer — se reprendraient leurs
 * réservations d'une image à l'autre, et `_buildMesh` relâcherait les hauteurs
 * de celui qui vient de perdre la main. **Une seule réservation, donc un seul
 * appel qui connaît les deux emprises.** C'est aussi pour ça que les DEUX
 * appelants de `main.js` (`hauteursDeFlux` et `reserverHauteurs`) doivent passer
 * le MÊME `aussi` : un seul qui l'oublierait annulerait les tuiles de l'autre.
 *
 * ⚠️ **LA BATHYMÉTRIE SUIT LA PLUS LARGE DES DEUX**, parce qu'il n'y a qu'une
 * nappe par flux (`flux.bathy`) et que l'emprise de la mer CONTIENT celle du
 * bloc. La nappe est donc cuite au zoom de la mer : c'est plus grossier au
 * centre, et sans conséquence — `bathy-sources.js` plafonne ses sources à
 * `BATHY_BASE_ZMAX = 8`, bien au-dessous des zooms de socle.
 *
 * @param {object} flux
 * @param {{emprise: object, zoom?: number, aussi?: {emprise:object, zoom:number}|null}} arg
 */
export function demanderEmprise(flux, { emprise, zoom = ZOOM_SOCLE, aussi = null } = {}) {
  const g = flux.globe
  const liste = tuilesEmprise(emprise, zoom)
  const z = liste.length ? liste[0].z : Math.floor(zoom)
  const avant = flux.reclamees
  const apres = new Map()

  for (const { z: tz, x, y } of liste) {
    const t = g._ensureTile(tz, x, y)
    apres.set(t.key, t)
  }
  // ⚠️ **APRÈS LA PREMIÈRE, ET LA COLLISION DE CLÉS EST SANS EFFET** : une même
  // tuile réclamée par les deux emprises n'entre qu'une fois dans la `Map`.
  const secondes = new Set()
  if (aussi?.emprise) {
    for (const { z: tz, x, y } of tuilesEmprise(aussi.emprise, aussi.zoom ?? zoom)) {
      const t = g._ensureTile(tz, x, y)
      if (!apres.has(t.key)) secondes.add(t.key)
      apres.set(t.key, t)
    }
  }

  // 1. la réservation d'abord : `_buildMesh` la consulte pour GARDER les
  //    hauteurs, et une tuile bâtie avant la réservation les aurait déjà
  //    relâchées. L'ordre n'est pas cosmétique.
  g.gardeHauteurs = new Set(apres.keys())

  // 2. ce qui sort de l'emprise sort de la file
  for (const [key, t] of avant) {
    if (apres.has(key)) continue
    g._annuler(t)
  }

  // 3. ce qui entre est demandé. ⚠️ **PRIORITÉ MAXIMALE** : le socle est ce que
  //    l'utilisateur regarde, et la file est triée par priorité décroissante
  //    (`_pump`). Sans cela il attendrait derrière la frontière du quadtree,
  //    qui peut compter des centaines d'entrées.
  for (const t of apres.values()) {
    // ⚠️ LE PARCOURS NE PROTÈGE PAS CES TUILES : `_traverse` ne descend à ce
    // niveau que si la caméra l'y amène. On les marque donc à la main, comme
    // `_traverse` le fait pour les enfants qu'il prépare.
    t.lastUsed = g.frame
    if (t.state === 'ready' && !t.heights) {
      // ⚠️ PRÊTE MAIS SANS HAUTEURS : elle a été bâtie avant que le flux ne la
      // réclame, et `_buildMesh` a relâché son tampon (Tâche 4 sexies). On la
      // REDEMANDE — c'est le précédent explicite de `_rechargeTuiles` : « le
      // prix, et le seul, du relâchement du canevas et des hauteurs ». Le
      // geste est UNIQUE par tuile : au retour, la clé est réservée, donc les
      // hauteurs restent.
      //
      // ⚠️ **SANS L'EFFACER — R37.** Ces tuiles sont celles du centre de
      // l'écran : les jeter faisait remonter tout l'écran au parent le temps
      // du vol (« la zone nette redevient floue », vidéo d'Adrien). Un globe
      // qui sait recharger SUR PLACE garde le maillage dessiné jusqu'à
      // l'arrivée ; un globe de papier (tests) suit l'ancien chemin.
      if (typeof g.redemanderSurPlace === 'function' && g.redemanderSurPlace(t, secondes.has(t.key) ? 9e8 : 1e9)) continue
      if (t.mesh) {
        g.group.remove(t.mesh)
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
        t.mesh = null
      }
      t.texture?.dispose()
      t.texture = null
      t.refined = false
      t.retried = false
      t.state = 'empty'
    }
    // ⚠️ **LA SECONDE EMPRISE PASSE APRÈS, ET C'EST LA MÊME RAISON QUE LE
    // `1e9`** : le bloc est ce que l'utilisateur regarde ; le fond marin de la
    // mer lointaine ne doit pas lui passer devant dans la file.
    if (t.state === 'empty') g._request(t, secondes.has(t.key) ? 9e8 : 1e9)
  }

  flux.reclamees = apres
  // ⚠️ **LE ZOOM DEMANDÉ RESTE CELUI DU BLOC.** `zoomEffectif` s'en sert pour
  // dire ce que le SOCLE couvre : y glisser le zoom (plus grossier) de la mer
  // rendrait un socle « complet » qui ne l'est pas.
  flux.demande = { zoom: z }

  // 4. et la MER, à côté. ⚠️ **SANS `await`, ET C'EST LE POINT** : cette
  //    fonction est appelée depuis le crochet `hauteursDeFlux`, sur le chemin
  //    que la Tâche 6 septies vient de rendre instantané. La nappe se peint
  //    pendant ce temps-là ; `remplirHauteurs` fusionnera ce qui est prêt.
  //    Le rejet est absorbé ici : une bathymétrie absente est le cas NORMAL
  //    (on ne cuit pas de tuile là où il n'y a pas de mer), pas une panne.
  const pourBathy = aussi?.emprise
    ? { emprise: aussi.emprise, zoom: aussi.zoom ?? z }
    : { emprise, zoom: z }
  demanderBathy(flux, pourBathy).catch(() => {})
}

// ══════════ 6 ter. LA MER — Tâche 6 sexies ══════════════════════════════════

// ⚠️ **256 PX PAR TUILE, COMME `dem.js`.** C'est la résolution NATIVE de nos
// tuiles bathy (`BATHY_TILE_PX`), et c'est aussi l'ordre de grandeur de ce que
// le socle échantillonne par tuile : une nappe 3×3 fait 768², pour une fenêtre
// de n = 384 ou 768. Monter plus haut ne peindrait que de l'interpolation ;
// descendre plus bas rendrait au fond marin les facettes que le Catmull-Rom
// vient précisément de supprimer.
const BATHY_PX = 256

/**
 * Charge la nappe bathymétrique qui couvre `emprise`, et la garde sur le flux.
 *
 * ⚠️ **MÉMOÏSÉE PAR RECTANGLE DE TUILES** : `demanderEmprise` l'appelle à chaque
 * image du crochet, et l'emprise ne change qu'au cran. Sans cette clé, chaque
 * image relancerait neuf lectures de fichier et une allocation de 2,4 Mo.
 *
 * ⚠️ **ET ELLE N'ÉCRASE PAS LA NAPPE SUIVANTE.** Un cran pendant le vol change
 * l'emprise : la nappe partie avant peut atterrir après. Le point de contrôle
 * `flux.bathy !== etat` est le même idiome que la supersession de
 * `fetchAndBuildDem` (Tâche 6 septies), pour la même raison — **le plus LENT des
 * deux gagnerait**.
 *
 * @returns {Promise<boolean>} `true` si au moins une tuile a été peinte
 */
export function demanderBathy(flux, { emprise, zoom = ZOOM_SOCLE } = {}) {
  const r = rectangleTuiles(emprise, zoom)
  const cle = `${r.z}/${r.ix0}/${r.iy0}/${r.colonnes}x${r.lignes}`
  if (flux.bathy?.cle === cle) return flux.bathy.promesse
  const largeurPx = r.colonnes * BATHY_PX
  const hauteurPx = r.lignes * BATHY_PX
  // NaN = case non peinte, que `fuseBathymetry` ignore comme n'importe quelle
  // valeur non finie — exactement la convention de `loadBathyPatch`.
  const patch = new Float32Array(largeurPx * hauteurPx).fill(NaN)
  const etat = {
    cle, patch, largeurPx, hauteurPx,
    n: r.n, ix0: r.ix0, iy0: r.iy0, colonnes: r.colonnes, lignes: r.lignes,
    peintes: 0, prete: false, promesse: null,
  }
  flux.bathy = etat
  etat.promesse = (async () => {
    // UN SEUL aller-retour d'index pour toute la session : `indexBathy` mémorise
    // sa promesse, et un échec y rend `normalizeIndex(null)` — z8 partout,
    // c'est-à-dire le comportement d'avant les zones.
    const index = await indexBathy()
    const jobs = []
    for (let j = 0; j < r.lignes; j++) {
      for (let i = 0; i < r.colonnes; i++) {
        const ty = r.iy0 + j
        if (ty < 0 || ty >= r.n) continue
        const tx = (((r.ix0 + i) % r.n) + r.n) % r.n
        jobs.push(
          peindreBathyTuile({
            zoom: r.z, tx, ty, index,
            dst: patch, dstStride: largeurPx,
            dx: i * BATHY_PX, dy: j * BATHY_PX, dw: BATHY_PX, dh: BATHY_PX,
          }).then((zt) => { if (zt >= 0) etat.peintes++ })
        )
      }
    }
    await Promise.all(jobs)
    if (flux.bathy !== etat) return false // supersédée par un cran plus récent
    etat.prete = true
    flux.bathyRevision = (flux.bathyRevision ?? 0) + 1
    return etat.peintes > 0
  })()
  return etat.promesse
}

/**
 * Écrit la nappe échantillonnée dans `mer`, **par LOT et par LIGNE**, avec la
 * convention de demi-pixel de `sampleHeights` — les centres de texels à
 * `(i + 0,5)/taille`.
 *
 * ⚠️ **PAR LOT, JAMAIS PAR PIXEL — ET C'EST LE §3 DE CE MODULE, APPLIQUÉ À
 * LUI-MÊME.** La première version appelait une fonction `echantillonNappe(e, mx,
 * my)` par nœud, avec deux divisions et une dizaine de lectures de propriété
 * dedans. **Mesuré** (`.banc/cout-6sexies.mjs`, médiane de 20, données réelles
 * de La Réunion et Nice) : la fusion ajoutait **+4,3 à +5,8 ms à n = 384 et
 * +21,0 à +29,5 ms à n = 768**, alors que `fuseBathymetry` elle-même n'en coûte
 * que **1,3 et 4,9** (`.banc/profil-6sexies.mjs`). **Les trois quarts du coût
 * étaient dans l'interface commode, pas dans le travail** — exactement le
 * constat que le §3 avait déjà fait pour `lireHauteur(flux, {x, y, z})`.
 *
 * Ici tout est hissé hors des boucles : la position dans la nappe est AFFINE en
 * `i` et en `j`, donc elle s'incrémente au lieu de se diviser.
 *
 * ⚠️ **UN VOISIN NON PEINT RETOMBE SUR LE PLUS PROCHE, ET NE CONTAMINE PAS.**
 * Sans ce repli, un seul NaN dans les quatre coins rendrait NaN, donc une frange
 * de la largeur d'un texel **sans mer** tout autour de chaque tuile absente —
 * précisément le liseré que `detectFillLevels` a été écrit pour supprimer.
 *
 * ⚠️ **ET UN NŒUD SANS RELIEF RESTE SANS RELIEF** (`vues`). Hors couverture,
 * `out` vaut zéro — que `fuseBathymetry` lirait comme une ABSENCE DE MESURE et
 * creuserait donc jusqu'au fond. Un socle troué se peindrait en fosse abyssale
 * au lieu de rester manquant, et `manquants` continuerait de dire zéro.
 */
function ecrireNappe(e, mer, vues, b, cote, dx, dy) {
  const patch = e.patch
  const largeurPx = e.largeurPx
  const hauteurPx = e.hauteurPx
  // pixels de nappe par unité de Mercator, sur chaque axe
  const kx = (largeurPx * e.n) / e.colonnes
  const ky = (hauteurPx * e.n) / e.lignes
  const xBase = (b.x0 - e.ix0 / e.n) * kx - 0.5
  const yBase = (b.y0 - e.iy0 / e.n) * ky - 0.5
  const xPas = dx * kx
  const yPas = dy * ky
  const xMax = largeurPx - 1
  const yMax = hauteurPx - 1
  for (let j = 0; j < cote; j++) {
    const base = j * cote
    let y = yBase + j * yPas
    y = y < 0 ? 0 : y > yMax ? yMax : y
    let y0 = Math.floor(y)
    if (y0 > hauteurPx - 2) y0 = hauteurPx - 2
    if (y0 < 0) y0 = 0
    const fy = y - y0
    const ligne = y0 * largeurPx
    const ligneBas = ligne + largeurPx
    const ligneProche = (y - y0 < 0.5 ? y0 : y0 + 1) * largeurPx
    for (let i = 0; i < cote; i++) {
      if (!vues[base + i]) { mer[base + i] = NaN; continue }
      let x = xBase + i * xPas
      x = x < 0 ? 0 : x > xMax ? xMax : x
      let x0 = Math.floor(x)
      if (x0 > largeurPx - 2) x0 = largeurPx - 2
      if (x0 < 0) x0 = 0
      const fx = x - x0
      const a = patch[ligne + x0]
      const c = patch[ligne + x0 + 1]
      const d = patch[ligneBas + x0]
      const f = patch[ligneBas + x0 + 1]
      const s = a + (c - a) * fx + (d - a) * fy + (a - c - d + f) * fx * fy
      if (s === s) { mer[base + i] = s; continue }
      const proche = patch[ligneProche + (x - x0 < 0.5 ? x0 : x0 + 1)]
      mer[base + i] = proche === proche ? proche : NaN
    }
  }
}

// ══════════ 7. CE QUI EST PRÊT ══════════════════════════════════════════════

/**
 * Les tuiles `ready` qui intersectent `emprise`, tous zooms confondus.
 *
 * ⚠️ **`ready` SEULEMENT.** Une `loading`, une `empty` ou une `error` n'a rien à
 * lire : la rendre obligerait chaque appelant à refaire le tri, et un seul qui
 * l'oublierait lirait `null.heights`.
 *
 * @returns {Map<string, object>} clé → tuile
 */
export function tuilesPretes(flux, emprise) {
  const b = boiteMerc(emprise)
  const out = new Map()
  for (const t of flux.globe.tiles.values()) {
    if (t.state !== 'ready') continue
    if (!intersecte(b, t.z, t.x, t.y)) continue
    out.set(t.key, t)
  }
  return out
}

// ══════════ 8. LE ZOOM RÉELLEMENT COUVERT ═══════════════════════════════════

/**
 * Le zoom réellement COUVERT sur `emprise` — voir le §1.
 *
 * Inférieur au zoom demandé tant que la couverture est incomplète, égal ensuite.
 * `null` si rien ne couvre l'emprise.
 *
 * @returns {number|null}
 */
export function zoomEffectif(flux, emprise) {
  const demande = flux.demande?.zoom ?? ZOOM_SOCLE
  const pretes = tuilesPretes(flux, emprise)
  if (!pretes.size) return null
  // pour chaque tuile du niveau DEMANDÉ qui couvre l'emprise, le meilleur
  // niveau disponible sur elle : elle-même, ou l'ancêtre prêt le plus profond.
  let pire = Infinity
  for (const { z, x, y } of tuilesEmprise(emprise, demande)) {
    let meilleur = -1
    for (let k = z; k >= 0; k--) {
      const d = z - k
      if (pretes.has(`${k}/${x >> d}/${y >> d}`)) {
        meilleur = k
        break
      }
    }
    if (meilleur < 0) return null // un trou : l'emprise n'est couverte nulle part
    if (meilleur < pire) pire = meilleur
  }
  return Number.isFinite(pire) ? pire : null
}

// ══════════ 9. LES HAUTEURS, EN UNE PASSE ═══════════════════════════════════

/**
 * Remplit `(n+1)²` hauteurs sur `emprise`, **en une passe par tuile touchée**.
 *
 * La grille est régulière en MERCATOR (comme le socle lui-même, qui est un carré
 * de Mercator), sommet 0 au coin nord-ouest, ligne-major.
 *
 * ⚠️ **`bathy` DIT SI LA FUSION A RÉELLEMENT EU LIEU, ET C'EST UN AJOUT DE LA
 * TÂCHE J.** La nappe arrive de façon ASYNCHRONE : sans ce drapeau, un appelant
 * qui passe cette fonction à `poserMer` verrait `bathy: true` dès le premier
 * essai, c'est-à-dire **avant** que la moindre tuile de fond marin ait atterri —
 * et la mer resterait d'un bleu uniforme pour toujours, en se croyant remplie.
 * C'est l'exacte classe d'erreur que `revisionFlux` a déjà corrigée une fois
 * (« un fond marin chargé, fusionnable, et jamais affiché »).
 *
 * @param {object} flux
 * @param {{emprise: object, n: number, sortie?: Float32Array}} arg
 * @returns {{remplis: number, manquants: number, bathy: boolean, sortie: Float32Array}}
 */
export function remplirHauteurs(flux, { emprise, n, sortie } = {}) {
  const cote = Math.max(1, Math.floor(n)) + 1
  const total = cote * cote
  const out = sortie ?? new Float32Array(total)
  if (out.length < total) {
    throw new RangeError(`remplirHauteurs : sortie de ${out.length} pour ${total} hauteurs`)
  }
  const b = boiteMerc(emprise)
  const dx = (b.x1 - b.x0) / (cote - 1 || 1)
  const dy = (b.y1 - b.y0) / (cote - 1 || 1)

  const vues = new Uint8Array(total)
  // ⚠️ DU PLUS GROSSIER AU PLUS FIN : le fin écrase le grossier. Voir le §3.
  const tuiles = [...tuilesPretes(flux, emprise).values()]
    .filter((t) => t.heights)
    .sort((a, c) => a.z - c.z)

  for (const t of tuiles) {
    const nz = 2 ** t.z
    // la fenêtre d'échantillons qui tombe dans cette tuile, bornes comprises
    for (const dxMonde of [0, 1]) {
      const tx0 = t.x / nz + dxMonde
      const tx1 = (t.x + 1) / nz + dxMonde
      const ty0 = t.y / nz
      const ty1 = (t.y + 1) / nz
      const i0 = Math.max(0, Math.ceil((tx0 - b.x0) / dx))
      const i1 = Math.min(cote - 1, Math.floor((tx1 - b.x0) / dx))
      const j0 = Math.max(0, Math.ceil((ty0 - b.y0) / dy))
      const j1 = Math.min(cote - 1, Math.floor((ty1 - b.y0) / dy))
      if (i1 < i0 || j1 < j0) continue
      for (let j = j0; j <= j1; j++) {
        const v = (b.y0 + j * dy - ty0) / (ty1 - ty0)
        const base = j * cote
        for (let i = i0; i <= i1; i++) {
          const u = (b.x0 + i * dx - tx0) / (tx1 - tx0)
          // ⚠️ `t.size` EST OBLIGATOIRE ICI DEPUIS LA TÂCHE 4 ALPHA : une tuile
          // du globe fait 256 px (AWS) ou 512 px (Mapterhorn) selon la zone.
          // L'omettre retomberait sur le défaut 256 et lirait le QUART
          // nord-ouest d'une tuile fine, en silence.
          out[base + i] = sampleHeights(t.heights, u, v, t.size)
          vues[base + i] = 1
        }
      }
    }
  }

  let remplis = 0
  for (let k = 0; k < total; k++) if (vues[k]) remplis++

  // ══════════ ET LA MER PAR-DESSUS — Tâche 6 sexies, voir le §4 ═════════════
  //
  // ⚠️ **EN UNE FOIS SUR TOUTE L'EMPRISE, ET APRÈS LE RELIEF.** `fuseBathymetry`
  // constate les aplats de remplissage du champ ENTIER (`detectFillLevels`), et
  // « la fusion ne peut que CREUSER la mer : la terre et le trait de côte
  // restent ceux du terrarium ». L'appeler par tuile lui retirerait les
  // neuf dixièmes de ses sondes.
  const e = flux.bathy
  let bathy = false
  if (e?.prete && e.peintes > 0) {
    bathy = true
    const mer = merDeTravail(flux, total)
    ecrireNappe(e, mer, vues, b, cote, dx, dy)
    // `fuseBathymetry` rend un NOUVEAU tableau (elle ne mute pas ses entrées) :
    // on le recopie dans `out`, qui peut être un tampon fourni par l'appelant et
    // dont l'identité est un contrat (`sortie`, testé). ⚠️ **`subarray` BORNE LA
    // FUSION À LA GRILLE** : `remplirHauteurs` accepte une `sortie` plus longue
    // (son `RangeError` ne refuse que le trop COURT), et fusionner le tampon
    // entier écrirait dans la queue de l'appelant, en silence.
    const champ = out.length === total ? out : out.subarray(0, total)
    champ.set(fuseBathymetry(champ, mer))
  }

  return { remplis, manquants: total - remplis, bathy, sortie: out }
}

// Le tampon de travail de la mer, gardé sur le flux. ⚠️ **2,4 Mo À n = 768 :
// le réallouer à chaque raffinement serait une allocation majeure par image
// pendant les rafales de crans.** La taille de la fenêtre ne change qu'à un
// changement de résolution, donc ce tampon vit aussi longtemps que le flux.
function merDeTravail(flux, total) {
  if (flux._mer?.length !== total) flux._mer = new Float32Array(total)
  return flux._mer
}

// ══════════ 10. LE DÉBIT OBSERVÉ ════════════════════════════════════════════

/**
 * Le débit en Mb/s déduit des tailles et durées des réponses passées par ce
 * flux — voir le §2.
 *
 * ⚠️ **`null` sur un flux neuf, et NON zéro.** La Tâche 4 ter en dépend.
 *
 * @returns {number|null}
 */
export function debitObserve(flux, { fenetreMs = FENETRE_DEBIT_MS } = {}) {
  let octets = 0
  let debut = Infinity
  let fin = -Infinity
  let dernier = -Infinity
  for (const e of _journalReseau) {
    if (e.seq <= flux.seqDepart) continue
    if (e.fin > dernier) dernier = e.fin
  }
  if (dernier === -Infinity) return null
  for (const e of _journalReseau) {
    if (e.seq <= flux.seqDepart) continue
    if (dernier - e.fin > fenetreMs) continue
    octets += e.octets
    if (e.debut < debut) debut = e.debut
    if (e.fin > fin) fin = e.fin
  }
  const secondes = (fin - debut) / 1000
  if (!(octets > 0) || !(secondes > 0)) return null
  return (octets * 8) / secondes / 1e6
}
