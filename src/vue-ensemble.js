// Pure helper pour la pose caméra de fin de course — pas de three.js, pas de
// DOM, testable en isolation (voir test/vue-ensemble.test.js).

import { centreDuCarre } from './damier-carre.js'

// Direction isométrique vraie : azimut 45° (également écarté sur x et z) et
// site atan(1/√2) ≈ 35,264° — la projection isométrique canonique, pas une
// approximation. Précalculée une fois : x et z partagent la même composante
// horizontale par symétrie du 45°, y sort du rapport 1/√2 propre à l'iso.
const _ISO = (() => {
  const site = Math.atan(1 / Math.SQRT2)
  const horiz = Math.cos(site) * Math.SQRT1_2 // répartie à parts égales entre x et z
  return { x: horiz, y: Math.sin(site), z: horiz }
})()

// Calcule la pose (position + cible) qui cadre tout le tracé `pts` (tableau
// de {x,y,z}) vue depuis l'isométrique, avec une marge autour de la sphère
// englobante. Retourne null si le tracé est vide (rien à cadrer).
export function poseIsometrique(pts, { fovDeg = 30, marge = 1.35 } = {}) {
  if (!pts || !pts.length) return null

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }
  const cible = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 }
  const rayon = Math.max(
    1e-6, // évite une distance nulle sur un tracé réduit à un point
    Math.hypot(maxX - cible.x, maxY - cible.y, maxZ - cible.z)
  )
  const distance = (rayon * marge) / Math.tan(degToRad(fovDeg / 2))

  const position = {
    x: cible.x + _ISO.x * distance,
    y: cible.y + _ISO.y * distance,
    z: cible.z + _ISO.z * distance,
  }
  return { position, cible, distance }
}

function degToRad(deg) {
  return (deg * Math.PI) / 180
}

// ════════════════════════════════════════════════════════════════════════════
// LE BOUTON CAMÉRA FACE AU DAMIER
// ════════════════════════════════════════════════════════════════════════════
//
// Adrien : « Le bouton caméra en vue multi-cases permettra de voir toutes les
// cases à la fois en isométrique SANS PASSER AU ZOOM INFÉRIEUR. Et on reviendra
// au mode précédent si une seule case est affichée. Si dans ce mode de vue,
// l'utilisateur continue de dézoomer, alors on dézoome vraiment. »
//
// Trois comportements, trois fonctions pures — et le troisième est le piège :
// il faut distinguer « le bouton vient de cadrer » de « l'utilisateur veut
// vraiment partir ». Un simple drapeau ne le peut pas : le geste qui suit le
// clic n'a rien à dire sur l'intention. Un CUMUL de molette, si.

/**
 * Ce que le bouton caméra doit faire, selon ce que le damier a réellement posé.
 *
 * @param {{cote:number}} carre - `BlockGrid.empriseVivante()`, JAMAIS
 *   `carreCourant()` : la première dit ce qui est POSÉ (jusqu'à 5×5 en zone
 *   isolée), la seconde ce que le tracé a RÉCLAMÉ (plafonné à 3×3). Cadrer sur
 *   la seconde laisserait deux rangées de dalles hors champ en zone isolée.
 * @param {{continu?:boolean}} [etat] - `continu` = la fenêtre continue est
 *   active. ⚠️ ELLE N'A PAS DE DAMIER : son emprise 3×3 est celle du CHAMP, le
 *   socle reste UN bloc et c'est le relief qui défile dedans (voir
 *   damier-carre.js `coteGeometrique`). Reculer la caméra pour « tout voir » y
 *   cadrerait du vide autour d'un seul bloc.
 * @returns {'bloc'|'ensemble'}
 */
export function modeCameraDamier(carre, etat = {}) {
  if (etat?.continu) return 'bloc'
  const cote = Math.max(1, Math.round(Number.isFinite(carre?.cote) ? carre.cote : 1))
  return cote > 1 ? 'ensemble' : 'bloc'
}

// L'UNITÉ DU CUMUL : le CRAN DE MOLETTE NORMALISÉ.
//
// Un cran de souris vaut `deltaY` ≈ 100 px sous Chrome/macOS et 120 sous
// Windows ; un pavé tactile en émet des dizaines de 2 à 20 px. Compter des
// pixels bruts rendrait donc le seuil dépendant du navigateur ET du matériel.
// On normalise chaque événement à `min(1, |deltaY| / 100)` : un cran de souris
// vaut EXACTEMENT 1 partout (les 120 px de Windows sont écrêtés), et un
// micro-défilement de pavé vaut ce qu'il pèse.
const CRAN_MOLETTE_PX = 100

/**
 * LE SEUIL, ET POURQUOI 1,2.
 *
 * - **Ce qu'il laisse passer** : le cran unique. Juste après avoir cliqué sur
 *   le bouton, la main est encore sur la molette ; un cran réflexe (1,0) ne
 *   doit pas défaire le cadrage qu'on vient de demander. Idem pour l'inertie
 *   résiduelle d'un pavé tactile (0,02 à 0,2 par événement) ou pour la souris
 *   Windows dont le cran vaut 120 px — écrêté à 1,0, il ne sort pas non plus.
 * - **Ce qu'il arrête** : deux crans (2,0), c'est-à-dire un geste répété, donc
 *   voulu. Ou un balayage franc à deux doigts, qui dépasse 120 px cumulés bien
 *   avant la fin du geste.
 * - **Pourquoi pas plus haut** : au-delà de deux crans, l'utilisateur qui veut
 *   partir a l'impression que la molette est cassée — et la demande dit « s'il
 *   continue de dézoomer, on dézoome VRAIMENT », pas « on résiste longtemps ».
 * - **Pourquoi pas un booléen** : un booléen sortirait au premier cran, y
 *   compris celui de la main encore posée sur la molette. C'est exactement le
 *   défaut que ce seuil existe pour éviter.
 */
export const SEUIL_SORTIE_ENSEMBLE = 1.2

// Au-delà de ce silence, la molette repart de zéro. Une rotation délibérée
// enchaîne ses crans à 40–150 ms d'intervalle ; 400 ms laisse donc accumuler
// même un tour lent, mais un cran donné une seconde plus tard n'ajoute rien à
// un total périmé — sans quoi une goutte de molette toutes les dix secondes
// finirait par sortir du cadrage sans que personne l'ait voulu.
// (modes.js coupe ses gestes à 220 ms ; on est plus tolérant ici parce qu'on
// mesure une INTENTION répétée, pas la continuité d'un glissé inertiel.)
export const OUBLI_MOLETTE_MS = 400

/**
 * Faut-il sortir du cadrage et dézoomer pour de bon ?
 *
 * Hors du cadrage (`mode !== 'ensemble'`), tout dézoom est un vrai dézoom : la
 * question ne se pose même pas, et répondre `false` y gèlerait la molette de
 * l'application entière.
 *
 * @param {{mode:'bloc'|'ensemble', cumul:number}} arg
 */
export function doitVraimentDezoomer({ mode, cumul } = {}) {
  if (mode !== 'ensemble') return true
  return (Number.isFinite(cumul) ? cumul : 0) >= SEUIL_SORTIE_ENSEMBLE
}

/**
 * Le cumul de dézoom après un cran de molette.
 *
 * Pure, et exportée, parce que la JUSTIFICATION du seuil ci-dessus tient
 * entièrement dans cette normalisation : un seuil de 1,2 ne veut rien dire si
 * personne ne vérifie qu'un cran de souris vaut bien 1. Laisser ces trois
 * lignes dans `main.js` aurait mis hors de portée des tests la moitié de la
 * règle.
 *
 * @param {number} cumul - le total courant
 * @param {number} deltaY - le `deltaY` de l'événement ; seul le DÉZOOM compte
 *   (`deltaY > 0`, cf. `inward = e.deltaY < 0` dans modes.js)
 * @param {number} ecouleMs - millisecondes depuis le cran précédent
 */
export function cumuleDezoom(cumul, deltaY, ecouleMs) {
  const total = Number.isFinite(cumul) ? cumul : 0
  const base = Number.isFinite(ecouleMs) && ecouleMs > OUBLI_MOLETTE_MS ? 0 : total
  if (!Number.isFinite(deltaY) || deltaY <= 0) return base
  return base + Math.min(1, deltaY / CRAN_MOLETTE_PX)
}

/**
 * La pose isométrique qui cadre TOUT le damier — et qui rend le zoom
 * géographique INCHANGÉ.
 *
 * ⚠️ C'EST LE `zoom` RENDU TEL QUEL QUI PORTE TOUTE LA DEMANDE. Descendre d'un
 * cran d'escalier (`src/escalier-zoom.js`) ferait bien entrer le damier dans
 * l'écran, mais RECHARGERAIT les neuf dalles à une autre résolution : le relief
 * perdrait sa finesse sous les yeux de l'utilisateur, et le travail de
 * chargement déjà payé partirait à la poubelle. On recule la CAMÉRA, on ne
 * change pas la CARTE.
 *
 * ⚠️ ON CADRE LES QUATRE COINS DU CARRÉ, PAS LES POINTS DU TRACÉ. Un GPX ne
 * traverse qu'un chemin de cases (c'est toute la raison d'être de
 * `carreCouvrant`) : le cadrer laisserait dehors les cases que le carré a
 * ajoutées pour boucher les trous — c'est-à-dire précisément celles qu'Adrien
 * veut voir apparaître.
 *
 * ⚠️ LE CENTRE VIENT DE `centreDuCarre`, PAS DE (0,0). Un carré de côté PAIR
 * n'est pas centré sur le bloc principal : son centre tombe sur une jointure.
 * Viser l'origine décadrerait un 2×2 d'un demi-bloc — le même piège qui a coûté
 * deux rondes à la mer et failli casser les textes gravés.
 *
 * @param {{zoom:number, cote:number, i0?:number, j0?:number, taille?:number}} etat
 * @param {{fovDeg?:number, marge?:number}} [cadrage]
 * @returns {{cible:{x:number,y:number,z:number}, position:{x,y,z},
 *   distance:number, hauteur:number, zoom:number}}
 */
export function poseDamier({ zoom, cote, i0, j0, taille = 56 } = {}, { fovDeg = 30, marge = 1.1 } = {}) {
  const c = Math.max(1, Math.round(Number.isFinite(cote) ? cote : 1))
  const t = Number.isFinite(taille) && taille > 0 ? taille : 56
  // Sans coin donné, on suppose le carré ancré comme `damier-carre.js` l'ancre
  // sur une boîte réduite au bloc central : `floor(-(cote-1)/2)`, qui rend −1
  // pour un 2×2 (le carré s'ouvre vers le nord-ouest) et −1 pour un 3×3.
  const ai = Number.isFinite(i0) ? i0 : Math.floor(-(c - 1) / 2)
  const aj = Number.isFinite(j0) ? j0 : Math.floor(-(c - 1) / 2)
  const centre = centreDuCarre({ i0: ai, j0: aj, cote: c }, t)
  const demi = (t * c) / 2
  // les quatre coins, projetés au sol (y = 0, le plan de pose du damier) : la
  // marge se charge du relief qui dépasse au-dessus.
  const coins = [
    { x: centre.x - demi, y: 0, z: centre.z - demi },
    { x: centre.x + demi, y: 0, z: centre.z - demi },
    { x: centre.x - demi, y: 0, z: centre.z + demi },
    { x: centre.x + demi, y: 0, z: centre.z + demi },
  ]
  const p = poseIsometrique(coins, { fovDeg, marge })
  return {
    cible: { x: p.cible.x, y: p.cible.y, z: p.cible.z },
    position: p.position,
    distance: p.distance,
    hauteur: p.position.y,
    zoom, // ← INCHANGÉ. Voir l'avertissement en tête de cette fonction.
  }
}
