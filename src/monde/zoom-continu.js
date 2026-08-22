// LE ZOOM CONTINU — LA LOI MESURÉE, LE FRANCHISSEMENT DE NIVEAU, ET LE
// CHANGEMENT D'UNITÉS QUI LE REND INVISIBLE.
//
// Module PUR : ni DOM, ni three.js, ni globe. Tout se vérifie sous node
// (`test/zoom-continu.test.js`). Même patron qu'`escalier-zoom.js`,
// `loi-altitude.js` et `echelle-continue.js` : la RÈGLE vit ici, la plomberie
// reste dans `modes.js` et `main.js`.
//
// ══════════ POURQUOI CE MODULE EXISTE ═══════════════════════════════════════
//
// **Adrien, 2026-08-22 :** *« Le mouvement de caméra du ciel à la terre comme
// évoqué, on supprime toutes les zones […] Je ne veux aucun saut, aucun
// rechargement de la terre. […] vire absolument ton système de saut de
// niveau !!! »*
//
// Le dépôt fait descendre la caméra par PALIERS : un budget de zoom par niveau,
// une butée au bout, un re-défilement pour franchir, et une REPOSE de caméra à
// chaque franchissement. Ce module porte les trois lois qui remplacent tout ça,
// et rien d'autre.

import { empriseBlocM } from '../loi-altitude.js'

// ══════════ 1. LA LOI DE ZOOM — MESURÉE, PAS CHOISIE (D9) ═══════════════════
//
// ⚠️ **DIX-NEUF ALTITUDES RELEVÉES PAR ADRIEN DANS GOOGLE EARTH**, de
// **63 170 km à 126 km**, soit **18 intervalles** :
//
//   | rapport global          | 501,35                                       |
//   | moyenne géométrique     | **×1,41256** = 0,49832 octave (`ln = 0,34541`)|
//   | écart-type des rapports | 0,0126 (min 1,4032 · max 1,4600)             |
//   | racine de 2             | 0,5 octave exactement (`ln = 0,34657`)       |
//   | écart                   | **0,12 %**                                   |
//
// ➡️ **UN CRAN VAUT ×√2, ET LE RAPPORT EST CONSTANT SUR TOUTE LA DESCENTE.**
//
// ⚠️ **CE N'EST PAS UNE LOI « DE MOINS EN MOINS FORTE ».** Ce qui rétrécit le
// long de la descente est l'écart en KILOMÈTRES (18 153 km au premier cran,
// **51 km au dernier**), pas le rapport. **C'est la constance qui produit la
// stabilité qu'Adrien admire** — une loi décroissante la casserait.
export const PAS_CRAN = Math.LN2 / 2

// ══════════ 1 bis. ET CE N'EST PAS LE PAS DU NIVEAU DE MNT ══════════════════
//
// ⛔ **LE DÉPÔT CONFONDAIT LES DEUX SOUS UN SEUL NOM.** `STEP_IN` de `modes.js`
// servait à la fois de budget de niveau (« jusqu'où le glissé descend avant la
// butée ») et de pas de cran. Or ce sont DEUX grandeurs différentes, et une
// seule des deux est libre :
//
//   · **le NIVEAU de MNT est ×2 par construction** — un cran de zoom slippy
//     divise l'emprise de la tuile par deux, donc `ln 2` de distance et rien
//     d'autre. Ce nombre-là n'est pas un réglage, c'est la grille de tuiles.
//   · **le CRAN est ×√2** — c'est la mesure d'Adrien ci-dessus, et elle est
//     libre.
//
// ⚠️ **Le réglage porte donc sur le CRAN, pas sur le tour de molette** : le
// nombre de crans par tour dépend de la souris, et la molette garde son
// impulsion dérivée du NIVEAU (vingt crans de molette par niveau, contrainte
// d'Adrien inchangée).
export const PAS_NIVEAU = Math.LN2

// ══════════ 1 ter. L'EXAGÉRATION UNIQUE (D10) ═══════════════════════════════
//
// **Adrien, 2026-08-22 :** *« On va faire une exagération d'altitude unique à
// ×2 sur toute la map, ça évitera les sauts et les rechargements. »*
//
// ⚠️ **C'EST CETTE CONSTANTE QUI SUPPRIME LE RECHARGEMENT DE LA PLANÈTE**, et
// non un portage du relief au GPU. `setExaggeration` (`globe.js`) rend au réseau
// TOUTES les tuiles prêtes ; tant que l'exagération changeait de palier à chaque
// cran, la descente jetait la planète entière et la retéléchargeait — **12 s et
// 21 s mesurées, aller et retour, La Réunion z12** (`paquet-E-tour1.md:47`).
// Une constante ne change jamais, donc `majExageration` ne recharge jamais.
//
// ⚠️ **LE PORTAGE GPU EST DIFFÉRÉ, PAS ABANDONNÉ.** Il redeviendrait nécessaire
// le jour où l'exagération redeviendrait un réglage vivant.
export const EXAGERATION_UNIQUE = 2

// ══════════ 2. LE FACTEUR D'UN CRAN ═════════════════════════════════════════
//
// `dir > 0` = on se rapproche (zoom avant) : la distance est DIVISÉE par √2.
// `dir < 0` = on s'éloigne : elle est multipliée par √2. Symétrique par
// construction — un aller-retour rend exactement le point de départ, ce que
// l'escalier de paliers ne savait pas faire (mesuré : 14 326 m rendus pour
// 27 696 m de départ, `modes.js`).
export function facteurCran(dir, pas = PAS_CRAN) {
  if (!Number.isFinite(pas)) return 1
  return Math.exp(-Math.sign(dir) * pas)
}

// ══════════ 3. LE FRANCHISSEMENT DE NIVEAU — UNE DIVISION, PAS UNE TABLE ════
//
// ⛔ **CE QUI DISPARAÎT ICI, ET C'EST LE CŒUR DE LA CONSIGNE.** `DIVE_TIERS`
// posait NEUF paliers d'altitude à la main (8 km, 25, 50, 100, 200, 600,
// 1 600, 4 000, 8 000, 16 000 km) et `pickDiveTier` y lisait le niveau. Il n'y a
// plus de table : le niveau se DÉDUIT du budget de zoom dépensé, par une
// division.
//
// `budget` est le zoom logarithmique dépensé DANS le niveau courant — négatif en
// zoom avant, comme `_levelZoom` de `modes.js`. On rend :
//   · `niveaux` : combien de niveaux de MNT franchir, **positif pour AFFINER**,
//     négatif pour élargir ;
//   · `reste` : ce qui reste au compteur APRÈS le franchissement.
//
// ⚠️ **L'HYSTÉRÉSIS EST GRATUITE ET SYMÉTRIQUE**, et c'est la troncature qui la
// donne : on affine à `−ln 2` et on élargit à `+ln 2`, donc il faut un facteur 2
// d'altitude pour repasser la frontière dans l'autre sens. Aucun battement
// possible, aucun seuil à régler.
export function franchissement(budget, pas = PAS_NIVEAU) {
  if (!Number.isFinite(budget) || !(pas > 0)) return { niveaux: 0, reste: Number.isFinite(budget) ? budget : 0 }
  const n = Math.trunc(budget / pas)
  return { niveaux: n === 0 ? 0 : -n, reste: budget - n * pas }
}

// ══════════ 4. LE CHANGEMENT D'UNITÉS — ET CE N'EST PAS UNE REPOSITION ══════
//
// ⚠️ **CE PARAGRAPHE EST LA TÂCHE ENTIÈRE, ALORS IL EST ÉCRIT EN ENTIER.**
//
// Sous `?terre=unique` la caméra visible n'est PAS celle qui vit dans l'espace
// du bloc : c'est la caméra de FOND (`camGlobe`), posée par une SIMILITUDE
// (`monde/frontiere-rendu.js`, `poseFond`) dont le facteur est
// `extentMeters / span`. L'altitude qu'elle occupe réellement est donc
//
//     altitudeFondM = camY × extentMeters / span            (`altitudeFondM`)
//
// et **c'est la SEULE grandeur dont un saut se voit à l'écran.**
//
// ⛔ **`poseCranContinu` (`loi-altitude.js:181`) CONSERVE L'AUTRE.** Il repose la
// caméra à `camY × (échelleAprès / échelleAvant)`, où l'échelle est
// **VERTICALE** : `(span / extentMeters) × exagération`. Le rapport vaut donc
//
//     2 × (exagération après / exagération avant)
//
// et l'altitude de fond, elle, est multipliée par `exagération après /
// exagération avant`. Avec la table de paliers du dépôt (2,5 à z4, **5 à z5**,
// 4 à z6, 3,2 à z7, 2,8 ensuite) cela fait, sur une seule descente :
//   · z4 → z5 : **×2** — la vue recule de moitié d'un coup ;
//   · z5 → z6 : ×0,8 · z6 → z7 : ×0,8 · z7 → z8 : ×0,875.
// **C'est ÇA, l'accrochage.** Il ne vient pas du fait qu'on repose la caméra —
// il faut bien la reposer, l'unité du monde vient de changer — il vient du fait
// qu'on la repose sur la MAUVAISE grandeur.
//
// ➡️ **ICI, L'INVARIANT EST `altitudeFondM`.** Le facteur ne dépend plus que des
// EMPRISES, donc plus du tout de l'exagération : la continuité survivrait même
// si D10 était un jour rapportée.
export function camYApresNiveau({ camY, empriseAvant, empriseApres }) {
  if (!Number.isFinite(camY) || !(empriseAvant > 0) || !(empriseApres > 0)) return camY
  return (camY * empriseAvant) / empriseApres
}

// La pose complète : la même chose, plus la distance à la cible qui va avec.
// `pente` est le `y` normalisé de la direction cible → caméra ; elle TRAVERSE le
// franchissement inchangée (l'angle de vue de l'utilisateur est gardé, c'était
// la bonne moitié de v48).
export function poseApresNiveau({ camY, pente, empriseAvant, empriseApres, yCible = 0 }) {
  const y = camYApresNiveau({ camY, empriseAvant, empriseApres })
  return { camY: y, distanceCible: (y - yCible) / pente, pente }
}

// ══════════ 5. LA PLONGÉE QUI NE SAUTE PAS ══════════════════════════════════
//
// ⚠️ **`_posePlongee` CONSERVAIT, LUI AUSSI, LA MAUVAISE ALTITUDE**, et
// `loi-altitude.js` le savait : *« le CHAMP VISUEL, lui, saute encore d'un
// facteur `exagération(z)` […] C'est une question, pas un oubli. »* Sous
// `?terre=unique` la question a une réponse, parce qu'il n'y a plus deux mondes
// à raccorder mais un seul : **l'altitude de fond est CONTINUE à la traversée**,
// puisque de l'autre côté c'est la même planète.
//
// `camY` qui rend exactement `altM` d'altitude de fond sur un bloc d'emprise
// `extentMeters` et de côté `span`. C'est l'inverse exact d'`altitudeFondM`.
export function camYPourAltitudeFond({ altM, extentMeters, span }) {
  if (!(altM > 0) || !(extentMeters > 0) || !(span > 0)) return null
  return (altM * span) / extentMeters
}

// La distance à la cible qui pose la caméra à cette hauteur, le long d'une
// direction de pente `pente`.
export function distancePourAltitudeFond({ altM, extentMeters, span, pente, yCible = 0 }) {
  const y = camYPourAltitudeFond({ altM, extentMeters, span })
  if (y == null || !(Math.abs(pente) > 1e-6)) return null
  return (y - yCible) / pente
}

// ══════════ 6. LE NIVEAU D'ARRIVÉE — DÉDUIT, SANS TABLE ═════════════════════
//
// Le niveau le plus FIN dont la distance tient encore sous le plafond
// d'arrivée. Même forme que `niveauDePlongee` (`loi-altitude.js`), mais sur
// l'altitude de FOND et sur l'emprise HORIZONTALE — donc sans exagération, donc
// sans les paliers qui faisaient sauter la traversée.
//
// ⚠️ **LA PORTE ORBITALE DEVIENT GÉOMÉTRIQUE.** Elle n'est plus « 16 000 km,
// écrit à la main » : c'est l'altitude au-dessus de laquelle même le bloc le
// plus large ne tient plus sous le plafond de la caméra.
// ⚠️ **`empriseAuZoom` EST INJECTÉE**, comme `choisirPalier` et `echelleAuZoom`
// l'étaient avant elle : c'est le seul terme que ce module ne peut pas calculer
// seul, parce que la latitude du bloc vit dans `main.js`. Le défaut sert aux
// bancs, jamais à la production.
export function niveauDArrivee({
  altM,
  empriseAuZoom = null,
  lat = 45,
  span,
  tuilesParBloc = 3,
  zoomMin = 3,
  zoomMax = 15,
  pente,
  yCible = 0,
  distanceMin,
  distanceMax,
} = {}) {
  if (!(altM > 0) || !(span > 0) || !(Math.abs(pente) > 1e-6)) return null
  const emprise = typeof empriseAuZoom === 'function'
    ? empriseAuZoom
    : (z) => empriseBlocM({ zoom: z, lat, tuilesParBloc })
  let choisi = null
  for (let z = zoomMin; z <= zoomMax; z++) {
    const extentMeters = emprise(z)
    if (!(extentMeters > 0)) continue
    const distanceCible = distancePourAltitudeFond({ altM, extentMeters, span, pente, yCible })
    if (distanceCible == null) continue
    if (distanceCible <= distanceMax) choisi = { zoom: z, distanceCible, extentMeters, borne: null }
  }
  if (!choisi) {
    return { zoom: zoomMin, distanceCible: distanceMax, extentMeters: emprise(zoomMin), borne: 'haut' }
  }
  if (choisi.distanceCible < distanceMin) return { ...choisi, distanceCible: distanceMin, borne: 'bas' }
  return choisi
}

// ══════════ 7. LE PROFIL DE DESCENTE — L'INSTRUMENT ═════════════════════════
//
// ⚠️ **IL NE MESURE PAS LA MÊME GRANDEUR QUE `profilDescente`
// (`loi-altitude.js`), ET C'EST TOUT L'INTÉRÊT.** Celui-là rejoue
// `altitudeSurfaceM`, que le cran CONSERVE PAR CONSTRUCTION depuis la Tâche 2
// bis : il ne peut donc plus rien voir. Celui-ci rejoue **`altitudeFondM`**,
// c'est-à-dire ce que l'écran montre — et il voit tout ce que l'autre cache.
//
// `regime: 'paliers'` rejoue le dépôt (budget de niveau borné, repose sur
// l'échelle VERTICALE avec les paliers d'exagération, plongée sur
// `altitudeSurfaceM`). `regime: 'continu'` rejoue ce que cette tâche pose.
// ⚠️ **Les deux passent par le MÊME code de parcours** : ce qui diffère est la
// loi, pas l'instrument.
export function profilDescenteFond({
  regime = 'continu',
  altDepartM = 1600000,
  lat = 45.8326,
  span = 56,
  tuilesParBloc = 3,
  zoomMin = 3,
  zoomFin = 15,
  pente,
  yCible = 0,
  distanceMin = 6,
  distanceMax = 150,
  budgetNiveau = PAS_NIVEAU,
  exag = () => EXAGERATION_UNIQUE,
  ratioMax = 1.02,
} = {}) {
  const continu = regime === 'continu'
  const emprise = (z) => empriseBlocM({ zoom: z, lat, tuilesParBloc })
  const altFond = (camY, z) => (camY * emprise(z)) / span
  const pts = []

  // ── 1. le glissé orbital : l'altitude EST la variable d'état, continu par
  // construction. Il court jusqu'à LA PORTE, c'est-à-dire l'altitude sous
  // laquelle le bloc le plus large tient enfin sous le plafond de la caméra.
  // ⚠️ **La porte est GÉOMÉTRIQUE des deux côtés** : le régime « paliers »
  // traverse au même endroit, sinon on comparerait deux trajets.
  const altPorte = (altDepartM * span) / emprise(zoomMin) > distanceMax * pente
    ? (distanceMax * pente * emprise(zoomMin)) / span
    : altDepartM
  const plongee = Math.min(altDepartM, altPorte)
  for (const a of echelons(altDepartM, plongee, ratioMax)) {
    pts.push({ mode: 'orbital', zoom: null, altM: a, transition: null })
  }

  // ── 2. LA TRAVERSÉE. Continu : le niveau et la distance se déduisent de
  // l'altitude de FOND. Paliers : le dépôt conserve `altitudeSurfaceM`, donc
  // l'altitude de fond est multipliée par l'exagération du niveau d'arrivée.
  let zoom
  let camY
  if (continu) {
    const n = niveauDArrivee({
      altM: plongee, lat, span, tuilesParBloc, zoomMin, zoomMax: zoomFin,
      pente, yCible, distanceMin, distanceMax,
    })
    zoom = n.zoom
    camY = yCible + n.distanceCible * pente
  } else {
    // le dépôt : `distancePourAltitude({ altM, echelleV })` avec
    // `echelleV = (span / emprise) × exagération`
    let choisi = null
    for (let z = zoomMin; z <= zoomFin; z++) {
      const echelleV = (span / emprise(z)) * exag(z)
      const d = (plongee * echelleV - yCible) / pente
      if (d <= distanceMax * 0.94) choisi = { zoom: z, d }
    }
    zoom = choisi?.zoom ?? zoomMin
    const d = Math.min(Math.max(choisi?.d ?? distanceMax * 0.94, distanceMin), distanceMax)
    camY = yCible + d * pente
  }
  pts.push({ mode: 'surface', zoom, altM: altFond(camY, zoom), transition: 'plongee' })

  // ── 3. la descente en surface
  let distanceCible = (camY - yCible) / pente
  for (;;) {
    const dFin = Math.max(distanceCible * Math.exp(-budgetNiveau), distanceMin)
    for (const d of echelons(distanceCible, dFin, ratioMax).slice(1)) {
      pts.push({ mode: 'surface', zoom, altM: altFond(yCible + d * pente, zoom), transition: null })
    }
    distanceCible = dFin
    camY = yCible + dFin * pente
    if (zoom >= zoomFin) break
    if (continu) {
      const pose = poseApresNiveau({ camY, pente, empriseAvant: emprise(zoom), empriseApres: emprise(zoom + 1), yCible })
      zoom += 1
      distanceCible = Math.min(Math.max(pose.distanceCible, distanceMin), distanceMax)
    } else {
      // `poseCranContinu` : le rapport des échelles VERTICALES
      const facteur = ((span / emprise(zoom + 1)) * exag(zoom + 1)) / ((span / emprise(zoom)) * exag(zoom))
      const y = camY * facteur
      zoom += 1
      distanceCible = Math.min(Math.max((y - yCible) / pente, distanceMin), distanceMax)
    }
    camY = yCible + distanceCible * pente
    pts.push({ mode: 'surface', zoom, altM: altFond(camY, zoom), transition: 'cran' })
  }
  return pts
}

// Échantillonnage géométrique de `a` vers `b`, bornes comprises, sans jamais
// dépasser `ratioMax` d'un point au suivant. (Recopie assumée d'un helper de
// `loi-altitude.js` — quatre lignes, et l'importer ferait dépendre ce module de
// la table de paliers qu'il remplace.)
function echelons(a, b, ratioMax = 1.02) {
  if (!(a > 0) || !(b > 0)) return [a]
  if (a === b) return [a]
  const total = Math.abs(Math.log(b / a))
  const n = Math.max(1, Math.ceil(total / Math.log(ratioMax)))
  const pts = []
  for (let i = 0; i <= n; i++) pts.push(a * Math.exp((Math.log(b / a) * i) / n))
  return pts
}
