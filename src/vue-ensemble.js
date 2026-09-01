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

// ⚠️ **AU-DELÀ DE QUATRE CRANS DANS UN SEUL ÉVÉNEMENT, CE N'EST PLUS UNE
// MOLETTE.** Une roue physique délivre un cran par détente : Chrome en fusionne
// deux ou trois quand on tourne vite, jamais quarante. `deltaY ≥ 400 px` dans un
// événement unique est la signature d'un lancer de pavé tactile — un geste dont
// la FORCE est l'intention, pas la répétition. Le chiffre n'est pas choisi : il
// est le premier multiple entier du cran de souris (100 px, 120 sous Windows)
// qu'aucune détente ni aucune fusion de détentes n'atteint.
const CRANS_LANCER = 4

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

// ⚠️ **LA CONSTANTE DE TEMPS DE L'OUBLI — ET CE N'EST PAS `OUBLI_MOLETTE_MS`.**
// Tâche R29 bis. Les 400 ms ci-dessus décrivent la CADENCE d'un geste délibéré ;
// employées comme constante de décroissance elles effaceraient la mémoire dix
// fois trop vite — mesuré : un balayage franc à deux doigts (40 événements de
// 4 px en 480 ms) tombait alors à **0,998** pour un seuil de 1,2, alors qu'il
// sortait avant. Les 2 000 ms ne sont pas choisies : elles sont l'intervalle où
// les QUATRE invariants écrits dans ce fichier tiennent ensemble, et chacun a
// son test dans `damier-cadre.test.js` :
//
//   · un cran SEUL ne sort pas                      → 1,000 < 1,2   (tout τ)
//   · deux crans à 60 ms sortent                    → 1,970 ≥ 1,2   (τ ≥ 0)
//   · vingt crans à 500 ms sortent (le défaut R30)  → 1,779 ≥ 1,2   (τ ≥ 311 ms)
//   · une goutte toutes les 10 s ne sort JAMAIS     → 1,007 < 1,2   (τ ≤ 5 580 ms)
//   · un balayage de 180 px à deux doigts sort      → 1,563 ≥ 1,2   (τ ≥ ~1 500 ms)
//
// La fenêtre est donc **[1 500 ; 5 580] ms** et 2 000 s'y tient avec de la marge
// des deux côtés. ⚠️ **Conséquence à connaître** : un cran toutes les 3 s finit
// par sortir (point fixe 1,287), un cran toutes les 4 s jamais (1,156). C'est la
// frontière entre « il continue de dézoomer » et « il tripote la molette », et
// elle est mesurée, pas supposée.
export const CONSTANTE_OUBLI_MS = 2000

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
  // ══════ L'OUBLI DÉCROÎT, IL NE GUILLOTINE PLUS — Tâche R29 bis ══════════
  //
  // ⛔ **`base = 0` AU-DELÀ DE 400 ms RENDAIT LA MOLETTE MORTE, SANS LIMITE DE
  // TEMPS ET SANS MESSAGE.** Un visiteur qui défile à deux crans par seconde
  // repart de zéro à chaque cran : son cumul plafonne à **1,0** pour un seuil
  // de **1,2**, et il ne sort **JAMAIS** du cadrage. Vingt crans, cent crans,
  // mille : le même 1,0. `test/damier-cadre.test.js` vérifiait qu'un cran isolé
  // ne sort pas — pas qu'une SUITE de crans isolés ne sort pas non plus.
  //
  // ⚡ **LA DÉCROISSANCE TIENT LES DEUX INTENTIONS ÉCRITES CI-DESSUS**, et
  // `CONSTANTE_OUBLI_MS` (2 000 ms) porte la mémoire au lieu d'un couperet :
  //   · « une goutte de molette toutes les dix secondes ne doit pas finir par
  //     sortir » → `exp(−10 000 / 2 000) = 0,0067` : le cumul plafonne à 1,007,
  //     donc sous 1,2, **indéfiniment** ;
  //   · « deux crans, c'est-à-dire un geste répété, donc voulu » → à 100 ms,
  //     `exp(−0,05) = 0,951`, le deuxième cran rend **1,951** et sort ;
  //   · à deux crans par seconde, `exp(−0,25) = 0,779`, le deuxième cran rend
  //     **1,779** et sort. Le geste lent finit par aboutir, ce qui est
  //     exactement la demande : *« s'il continue de dézoomer, on dézoome
  //     VRAIMENT »*, pas « on résiste éternellement ».
  const oubli = Number.isFinite(ecouleMs) && ecouleMs > 0 ? Math.exp(-ecouleMs / CONSTANTE_OUBLI_MS) : 1
  const base = total * oubli
  if (!Number.isFinite(deltaY) || deltaY <= 0) return base
  // ══════ LA FORCE D'UN LANCER COMPTE, CELLE D'UN CRAN NON ═══════════════
  //
  // ⛔ **`Math.min(1, …)` ÉCRÊTAIT AUSSI LES ÉVÉNEMENTS QUI NE PEUVENT PAS
  // ÊTRE UN CRAN.** Un balayage de pavé tactile de **4 000 px en un seul
  // événement** valait 1,0 — le même poids qu'un cran de souris — donc ne
  // sortait pas. La force du geste ne comptait pas, seule sa répétition en
  // moins de 400 ms comptait.
  //
  // ⚠️ **ET L'ÉCRÊTAGE RESTE, PARCE QU'IL PROTÈGE UN CAS RÉEL** : la souris
  // Windows dont le cran vaut 120 px, et l'inertie résiduelle d'un pavé (0,02
  // à 0,2). On garde donc le plafond à UN cran, et on ne rouvre que ce qu'aucun
  // cran physique ne peut produire — au-delà de `CRANS_LANCER` crans dans un
  // SEUL événement, ce n'est plus une molette, c'est un lancer.
  //
  // La somme est continue et monotone : 120 px → 1,0 (n'ouvre rien) ·
  // 400 px → 1,0 · 500 px → 2,0 · 4 000 px → 37,0.
  const crans = deltaY / CRAN_MOLETTE_PX
  return base + Math.min(1, crans) + Math.max(0, crans - CRANS_LANCER)
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
