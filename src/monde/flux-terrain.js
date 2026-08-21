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

import {
  MAX_Z,
  _journalReseau,
  sampleHeights,
  sequenceReseau,
} from '../globe.js'
import { ZOOM_SOCLE } from './seuil-socle.js'
import { MERCATOR_MAX_LAT } from '../geo.js'

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
  const z = Math.max(0, Math.min(MAX_Z, Math.floor(zoom)))
  const n = 2 ** z
  const b = boiteMerc(emprise)
  const ix0 = Math.floor(b.x0 * n)
  const ix1 = Math.max(ix0, Math.ceil(b.x1 * n) - 1)
  const iy0 = Math.max(0, Math.floor(b.y0 * n))
  const iy1 = Math.max(iy0, Math.min(n - 1, Math.ceil(b.y1 * n) - 1))
  const out = []
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      out.push({ z, x: ((x % n) + n) % n, y })
    }
  }
  return out
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
  }
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
 * @param {object} flux
 * @param {{emprise: object, zoom?: number}} arg
 */
export function demanderEmprise(flux, { emprise, zoom = ZOOM_SOCLE } = {}) {
  const g = flux.globe
  const liste = tuilesEmprise(emprise, zoom)
  const z = liste.length ? liste[0].z : Math.floor(zoom)
  const avant = flux.reclamees
  const apres = new Map()

  for (const { z: tz, x, y } of liste) {
    const t = g._ensureTile(tz, x, y)
    apres.set(t.key, t)
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
    if (t.state === 'empty') g._request(t, 1e9)
  }

  flux.reclamees = apres
  flux.demande = { zoom: z }
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
 * @param {object} flux
 * @param {{emprise: object, n: number, sortie?: Float32Array}} arg
 * @returns {{remplis: number, manquants: number, sortie: Float32Array}}
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
          out[base + i] = sampleHeights(t.heights, u, v)
          vues[base + i] = 1
        }
      }
    }
  }

  let remplis = 0
  for (let k = 0; k < total; k++) if (vues[k]) remplis++
  return { remplis, manquants: total - remplis, sortie: out }
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
