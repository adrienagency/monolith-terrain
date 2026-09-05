// LA POSE EXPLICITE — ce que l'utilisateur a CHOISI, la machine ne le défait pas.
//
// Module PUR : ni DOM, ni three.js. Testable en node — test/pose-explicite.test.js.
//
// ══════════ LE DÉFAUT QU'IL RÉPARE — tâche CAM, 2026-09-05 ══════════════════
//
// > **Adrien :** *« la caméra avec le toggle en bouton en bas à droite, quand je
// > clique dessus, les positions 1, 2, 3, 4 se mettent au bon endroit, puis
// > reviennent automatiquement en arrière. »*
//
// Mesuré au clic réel (Chrome sans tête, CDP, La Réunion z10) : la vue iso 1 à 4
// (oblique, 59,3° d'angle polaire, 145,5 unités de la cible) est atteinte à
// l'image 104 (1,74 s), puis **la caméra repart dans la même seconde vers le
// NADIR** : 145,5 → 74,2 unités, 59,3° → 0°. La vue 5 (du dessus) et la vue 6
// (raz du sol, dans le crop) tiennent. Deux écrivains, et ce sont les deux
// moitiés de D16 ter :
//
//   · **`redresserSiHerite` (main.js)** — « l'inclinaison HÉRITÉE hors du crop
//     est redressée » : après le vol, hors du crop, inclinée, personne ne l'a
//     inclinée à la main → balayage vers le nadir. C'est le cas des clics 2, 3, 4.
//   · **le front descendant `_etaitSurLeBloc && !surLeBloc` (modes.js)** —
//     « quitter le bloc rend la vue au nadir » : le vol lui-même sort la caméra
//     du bloc, le balayage s'arme PENDANT le vol et gagne (il écrit après le
//     tween dans la même image). C'est le clic 1, qui file droit au gros plan.
//
// Les deux lisent la même chose de travers : **une vue iso demandée au bouton
// n'est pas une inclinaison héritée du vol de présentation, c'est un CHOIX.**
// D16 ter parle de ce que la vue fait TOUTE SEULE (gestes-terre.js §3) ; elle ne
// s'applique pas APRÈS un choix explicite de pose. Le témoin ci-dessous porte ce
// choix, et les deux écrivains le consultent.
//
// ══════════ LA RÈGLE, EN TROIS PHRASES ═══════════════════════════════════════
//
//   1. Un vol explicite (bouton de caméra) POSE le témoin : `posee = true`.
//   2. Tant que le témoin est posé, la machine ne redresse pas — ni pendant le
//      vol (le front descendant), ni après (l'inclinaison « héritée »).
//   3. Le témoin tombe quand LA MACHINE reprend la pose : régime crop (la
//      bascule de trois quarts est à elle) ou orbite (`enterOrbit` pose au
//      nadir). ⚠️ **Jamais pendant le vol** : un vol qui part du crop traverse le
//      régime crop sur ses premières images, et une reprise à ce moment-là
//      rendrait le témoin avant l'arrivée — le défaut, une image plus tard.
//
// C'est exactement la vie d'`inclinaisonManuelle` (main.js), sur l'autre geste :
// une inclinaison demandée à la main tient dans tout le régime de la Terre.

export const REGIME_SURFACE = 'surface' // = REGIME.SURFACE de gestes-terre.js — répété ici pour rester pur

/** Le témoin : `posee` = l'utilisateur a choisi une pose, et rien ne l'a reprise. */
export function temoinPoseExplicite() {
  return { posee: false, reprises: 0 }
}

/** Un vol explicite part : le témoin se pose. */
export function armerPoseExplicite(temoin) {
  if (!temoin) return
  temoin.posee = true
}

/**
 * La machine reprend-elle la pose ? Appelé à chaque image avec le régime courant
 * et l'état du vol. Rend `true` si le témoin vient de tomber.
 *
 * @param {{posee:boolean, reprises:number}} temoin
 * @param {{regime: string|null, volExplicite: boolean}} o
 */
export function reprisePoseParLaMachine(temoin, { regime = null, volExplicite = false } = {}) {
  if (!temoin || !temoin.posee) return false
  if (volExplicite) return false // règle 3 : jamais pendant le vol
  if (regime === REGIME_SURFACE) return false // hors du crop, la pose tient
  temoin.posee = false
  temoin.reprises++
  return true
}

/**
 * L'INCLINAISON HÉRITÉE DOIT-ELLE ÊTRE REDRESSÉE ? — la décision de
 * `redresserSiHerite`, sortie de main.js pour être testée.
 *
 * @param {object} o
 * @param {string|null} o.regime - régime du geste ; seul `surface` (hors du crop) redresse
 * @param {boolean} o.inclinaisonManuelle - l'utilisateur a incliné à la main (gestes-terre §3)
 * @param {boolean} o.poseExplicite - le témoin ci-dessus est posé
 * @param {boolean} o.pilote - un autre pilote tient la caméra (busy, travel, fondu, dive, tween)
 * @param {boolean} o.auBloc - on est au bloc (D21 ② : `auBloc`, pas `pose`)
 * @param {number} o.polarDeg - angle polaire courant, en degrés
 * @param {number} [o.seuilDeg=1] - sous ce seuil, la vue est déjà au nadir
 */
export function doitRedresserHerite({ regime, inclinaisonManuelle = false, poseExplicite = false, pilote = false, auBloc = false, polarDeg = 0, seuilDeg = 1 } = {}) {
  if (regime !== REGIME_SURFACE) return false
  if (inclinaisonManuelle || poseExplicite) return false
  if (pilote) return false
  if (auBloc) return false
  if (!(polarDeg > seuilDeg)) return false
  return true
}

/**
 * LE RETOUR AU NADIR EN QUITTANT LE BLOC EST-IL PERMIS ? — le front descendant
 * de modes.js. Pendant un vol explicite, non : le vol possède la caméra, et
 * c'est lui qui sort du bloc, pas l'utilisateur à la molette.
 */
export function retourNadirPermis({ volExplicite = false } = {}) {
  return !volExplicite
}
