// LE FOND DU CROP — Tâche J bis du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, ni état. Testable sous node
// (`test/fond-crop.test.js`).
//
// ══════════ POURQUOI CE MODULE EXISTE ══════════════════════════════════════
//
// La Tâche J a établi PAR ÉLIMINATION — mer cachée, puis houle éteinte, puis
// rallumée — que ce qu'on lit à l'écran au-dessus de ~20 km n'est pas un défaut
// de la MER mais un DÉSACCORD :
//
//   **le champ de la mer a un fond ; la surface du crop n'en a pas.**
//
// Les deux moitiés du désaccord sont mesurées, dans l'application vivante, sur
// l'emprise du crop lui-même (La Réunion, z12, `.banc/vues-Jbis/Jbis-releves-bruts.json`) :
//
//   · le CHAMP (`remplirHauteurs` + `fuseBathymetry`) descend à **−2 116,3 m**,
//     et **32,54 %** de ses 148 225 nœuds sont sous le niveau de la mer ;
//   · la SURFACE, elle, est à **zéro exact sur 90,4 %** des 3 105 sondes en eau
//     (profondeur moyenne : **0,22 m**), parce que `_buildMesh` écrête
//     (`Math.max(h, 0)`, « oceans stay on the sphere ») ;
//   · l'écart MOYEN vaut donc **920,7 m**, le maximum **2 116,27 m**, quand la
//     houle que la Tâche J accusait ne fait que **73 m**. Le désaccord est
//     **12,6 fois** l'amplitude de la houle — deux grandeurs en MÈTRES, la même
//     monnaie des deux côtés.
//
// ⚠️ **ET LES TUILES NE PORTENT PAS CE FOND** : relevées dans l'application, les
// **9 tuiles z12 du bloc** (2 359 296 échantillons) descendent à **−288,36 m**
// au plus bas — **2,95 %** de négatifs, **29,5 %** de zéros EXACTS —, soit
// **13,6 % de la profondeur** que la bathymétrie fusionnée donne SUR LA MÊME
// EMPRISE (288,36 / 2 116,3). ⚠️ **Le dénominateur est l'emprise du CROP, pas
// celle de la calotte** : sur la calotte le champ descend à 3 510,5 m, et
// rapporter 288 m à celle-là aurait donné 8,2 %, un autre chiffre pour une autre
// question. Le terrarium sert la frange côtière, pas le fond marin. C'est la
// réponse mesurée à la question de la tâche (« les tuiles terrarium portent-elles
// des valeurs négatives exploitables ? ») : **quelques-unes, et loin de suffire**.
//
// ══════════ LA SORTIE RETENUE, ET POURQUOI ELLE NE COÛTE RIEN ══════════════
//
// ⚠️ **ON NE REFUSIONNE RIEN, ON LIT LE CHAMP QUI EXISTE DÉJÀ.** `poserMer` cuit
// un champ de 385² sur l'emprise de la calotte, et ce champ EST le résultat de
// `fuseBathymetry` sur l'emprise entière (Tâche J). Fabriquer une seconde
// fusion « pour les tuiles » aurait donné deux lois à faire coïncider — le §1 de
// `/threejs-optimisation`, et le §4 de `flux-terrain.js` explique déjà pourquoi
// une fusion par TUILE serait fausse (les aplats de remplissage se constatent
// sur l'emprise entière, jamais sur un neuvième d'histogramme).
//
// ⚠️ **ET LE CHAMP EST PLUS FIN QUE LA SOURCE.** 385 nœuds sur `portee = 3`
// largeurs de crop font **128 nœuds en travers du bloc**, quand la bathymétrie
// plafonne à `BATHY_BASE_ZMAX = 8` (`bathy-sources.js`) — soit, pour un crop de
// 3 tuiles z12, `3 × 256 / 2^(12−8)` = **48 pixels de donnée vraie** en travers.
// Cuire un champ « à la résolution des tuiles » n'aurait peint que de
// l'interpolation, pour 4 fois la mémoire.
//
// ══════════ DEUX LOIS, ET ELLES DIFFÈRENT PARCE QUE LE DÉPÔT DIFFÈRE ═══════
//
// ⚠️ **`altitudeMaillage` ET `altitudeSonde` NE SE CONFONDENT PAS.** Sans fond,
// `_buildMesh` écrête à zéro (`Math.max(h, 0)`) tandis que `hauteurSurface` rend
// la valeur BRUTE, négatifs compris — c'est l'état du dépôt, et les parois
// suivent aujourd'hui la frange à −288 m pendant que la surface reste à zéro.
// Une loi unique aurait donc changé le comportement de l'un des deux côtés sans
// fond posé, et **le défaut par défaut doit reproduire le dépôt au bit près**
// (le patron de `distanceRivage`, Tâche F, et d'`aussi`, Tâche J).
// ➡️ **AVEC un fond, les deux rendent la MÊME valeur** : c'est exactement le
// désaccord qu'on est venu fermer.

import { localCrop } from './crop-sphere.js'

/**
 * L'altitude que `_buildMesh` pose sur la surface du globe, en mètres.
 *
 * ⚠️ **SANS FOND, C'EST `Math.max(h, 0)` — LE DÉPÔT AU BIT PRÈS.** Le
 * commentaire d'origine de `posAt` (« oceans stay on the sphere ») reste vrai
 * partout où aucun fond n'est posé, c'est-à-dire sur toute la planète hors crop
 * et dans `?globe=continu` tout entier.
 *
 * @param {number} hTuile la hauteur lue dans la tuile, en mètres
 * @param {number|null} hFond le fond du champ au même point, en mètres
 * @returns {number}
 */
export function altitudeMaillage(hTuile, hFond) {
  const h = Number.isFinite(hTuile) ? hTuile : 0
  if (!Number.isFinite(hFond)) return Math.max(h, 0)
  // ⚠️ LA TERRE GARDE LA TUILE, ET CE N'EST PAS UN DÉTAIL : le champ fait 385
  // nœuds sur trois largeurs de crop, la tuile 256 pixels sur une seule. Prendre
  // le champ au-dessus de zéro rendrait le relief SIX FOIS plus grossier — on ne
  // corrige que ce qui est faux, la mer.
  if (h > 0) return h
  // ⚠️ `min(hFond, 0)` ET NON `hFond` : là où la tuile dit « mer » et le champ
  // dit « terre » (un nœud de champ tombé sur la côte voisine), on ne fait pas
  // sortir une butte de l'eau — on reste au niveau de la mer, c'est-à-dire au
  // comportement du dépôt.
  return Math.min(hFond, 0)
}

/**
 * L'altitude que `globe.hauteurSurface` rend — parois, rampe, champ de repli.
 *
 * ⚠️ **`null` TRAVERSE, ET C'EST LE §7 DE `parois-crop.js`** : « `null`, jamais
 * `0` — zéro est le NIVEAU DE LA MER, et le confondre avec je ne sais pas creuse
 * une encoche dans la paroi ». Un fond posé ne rend pas la couverture meilleure.
 *
 * @param {number|null} hTuile
 * @param {number|null} hFond
 * @returns {number|null}
 */
export function altitudeSonde(hTuile, hFond) {
  if (hTuile == null || !Number.isFinite(hTuile)) return null
  if (!Number.isFinite(hFond)) return hTuile // le dépôt : la valeur brute, négatifs compris
  if (hTuile > 0) return hTuile
  return Math.min(hFond, 0)
}

/**
 * Les coordonnées de lecture du champ, pour un point LOCAL du crop.
 *
 * ⚠️ **C'EST LA FORMULE DU NUANCEUR DE LA MER, MOT POUR MOT** : `MER_VERT` lit
 * `uvF = aCrop / (2.0 * uMerPortee) + 0.5`, où `aCrop` est en demi-côtés de crop
 * comme `localCrop`. Une seconde convention ici, et le fond du CROP et le fond
 * de la MER se liraient à deux endroits différents du même tableau — le
 * désaccord reviendrait par la porte de derrière.
 *
 * ⚠️ **AUCUN RETOURNEMENT EN Y.** Le champ est écrit ligne-major depuis le coin
 * NORD-OUEST (`remplirHauteurs`), la `DataTexture` a `flipY` à faux, et `v`
 * croît vers le SUD (`crop-sphere.js`, « le mercator y croît vers le SUD »). Les
 * trois conventions coïncident ; en retourner une seule mettrait le fond marin
 * en miroir nord-sud, et c'est le genre de défaut qui ne se voit qu'à côté d'une
 * côte connue.
 *
 * @param {{u:number, v:number}} q coordonnées locales du crop (±1 = sa frontière)
 * @param {number} portee en demi-côtés de crop — la demi-largeur du champ
 * @returns {{u:number, v:number}} dans [0, 1] quand le point est dans le champ
 */
export function uvFond(q, portee) {
  const p = 2 * portee
  return { u: q.u / p + 0.5, v: q.v / p + 0.5 }
}

/**
 * Le fond, en mètres, au point (lat, lon) — `null` hors du champ.
 *
 * Interpolation BILINÉAIRE, comme `sampleHeights` et comme `remplirHauteurs` :
 * s'accrocher au nœud le plus proche rendrait un fond marin en marches, et la
 * Tâche B a déjà mesuré ce défaut-là sur les parois (plus de 20 m de liseré).
 *
 * @param {{valeurs:Float32Array, cote:number, repere:object, portee:number}|null} fond
 * @param {number} lat
 * @param {number} lon
 * @returns {number|null}
 */
export function echantillonnerFond(fond, lat, lon) {
  if (!fond || !fond.valeurs || !(fond.cote > 1) || !(fond.portee > 0)) return null
  const q = localCrop(lat, lon, fond.repere)
  // ⚠️ **LA BORNE EST STRICTE, ET SANS ELLE LE CHAMP DÉBORDE.** Une texture en
  // `ClampToEdge` — et un `Math.min` sur les indices — prolongent la dernière
  // ligne jusqu'à l'infini : le fond marin du bord de calotte se répandrait sur
  // toute la planète estompée, sans qu'aucune erreur ne soit levée.
  if (!(Math.abs(q.u) <= fond.portee) || !(Math.abs(q.v) <= fond.portee)) return null
  const { u, v } = uvFond(q, fond.portee)
  const n = fond.cote - 1
  const fx = Math.min(Math.max(u * n, 0), n)
  const fy = Math.min(Math.max(v * n, 0), n)
  const i0 = Math.min(Math.floor(fx), n - 1)
  const j0 = Math.min(Math.floor(fy), n - 1)
  const tx = fx - i0
  const ty = fy - j0
  const c = fond.cote
  const a = fond.valeurs[j0 * c + i0]
  const b = fond.valeurs[j0 * c + i0 + 1]
  const d = fond.valeurs[(j0 + 1) * c + i0]
  const e = fond.valeurs[(j0 + 1) * c + i0 + 1]
  const haut = a + (b - a) * tx
  const bas = d + (e - d) * tx
  const h = haut + (bas - haut) * ty
  return Number.isFinite(h) ? h : null
}

/**
 * La clé d'identité d'un fond : deux fonds de même clé posent la même surface.
 *
 * ⚠️ **ELLE PORTE LA BATHYMÉTRIE ET LA PROFONDEUR MAXIMALE, PAS SEULEMENT
 * L'EMPRISE.** La nappe bathymétrique arrive de façon ASYNCHRONE (Tâche J) : un
 * champ cuit avant elle et un champ cuit après ont exactement la même emprise et
 * un contenu qui diffère de deux kilomètres. Une clé sur la seule emprise
 * laisserait donc la surface plate pour toujours, en se croyant à jour — c'est
 * la classe d'erreur que `revisionFlux` a déjà corrigée une fois.
 *
 * @param {{repere:object, portee:number, bathy:boolean, profMaxM:number}} fond
 * @returns {string}
 */
export function cleFond(fond) {
  if (!fond) return ''
  const r = fond.repere || {}
  return [r.cx, r.cy, r.demi, fond.portee, fond.bathy ? 1 : 0, Math.round(fond.profMaxM || 0)].join('|')
}
