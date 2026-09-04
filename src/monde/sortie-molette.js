// ══════════ LA SORTIE DU CROP À LA MOLETTE — Tâche SORTIE, D21 ① ═══════════
//
// > **Adrien, 2026-09-04 :** le clic droit reste un pan dans le crop. **Les
// > sorties du crop sont désormais DEUX** — le dézoom à la molette et le bouton
// > « map monde ».
//
// ⚡ **ET LA MOLETTE N'EN ÉTAIT PAS UNE.** Mesuré deux fois, par deux agents et
// deux dispositifs : **241 à 260 crans** (CHASSE, une lecture par image) et
// **161 à 162 crans** (SORTIE, `.banc/SORTIE/avant-sortie-*.json`). Le bouton
// monde était la seule sortie utilisable, et il n'en reste que deux.
//
// ⛔ **LA CAUSE N'EST PAS LE PAS DE MOLETTE, ET C'EST LA MOITIÉ DU CORRECTIF.**
// Relevé cran par cran (`.banc/SORTIE/avant-mortes.json`) : crans **21 à 43**,
// `d` collée à `controls.maxDistance = 150`, **altitude figée à 616 m**, pendant
// que `_levelZoom` monte de 0,01 à 0,68. Vingt-trois crans passent entièrement
// dans un compteur : `_applyZoom` clippe le déplacement au plafond mais encaisse
// l'INTENTION (R23), et le franchissement qui finit par libérer la caméra
// **CONSERVE l'altitude** — c'est sa définition. ➡️ **Contre un plafond, la
// taille du cran ne déplace personne** : grossir le pas (direction A du brief)
// ne rachète pas un mètre de ces 23 crans. Et il aurait fallu ×1,56 par cran
// pour tenir « ≤ 10 » — c'est-à-dire jeter le zoom doux de D19, noté 9,75.
//
// ➡️ **DIRECTION B : une sortie FRANCHE, armée par une INTENTION CONFIRMÉE.**
// Ce module ne porte que la confirmation ; la poussée est dans `modes.js`
// (`armerPousseeSortie`) et **la mort du crop reste prononcée par la loi de
// D21 ①** (`socleVisible`, `sortieArmee` + `SEUIL_MORT_M`). `sortieArmee` était
// déjà vraie dès le premier cran : il ne manquait que l'altitude.

/** Le nombre de crans de dézoom d'affilée qui CONFIRME l'intention de sortir.
 *  ⚠️ **TROIS, ET LE CRITÈRE D'ADRIEN DIT POURQUOI** : *« un cran de dézoom
 *  isolé ne doit PAS éjecter du crop »*. Un, c'est le tremblement de doigt ;
 *  trois, c'est un geste. Mesuré à 8 chargements : la sortie complète coûte
 *  **8 à 9 crans**, armée au 3ᵉ **8/8**. */
export const CRANS_SORTIE = 3

/** ⚠️ **ET LES TROIS CRANS DOIVENT ÊTRE UN SEUL GESTE.** Sans fenêtre, trois
 *  crans donnés à trois minutes d'intervalle — trois corrections de cadrage,
 *  chacune légitime — éjecteraient Adrien du crop. Une seconde : plus long que
 *  le `WHEEL_GAP_MS` de 220 ms de `modes.js` (qui, lui, sépare deux défilements
 *  continus), assez court pour ne pas coudre deux gestes distincts. */
export const FENETRE_SORTIE_MS = 1000

/**
 * L'automate de confirmation. Il ne connaît ni la caméra, ni le crop, ni
 * l'altitude : il compte des crans dans le temps et rend `true` **une fois**,
 * au cran qui confirme. L'appelant fait le reste — c'est la séparation qui
 * rend cette loi vérifiable sans navigateur (`main.js` n'est chargé par aucun
 * test de ce dépôt, §0 du plan).
 *
 * @param {{crans?:number, fenetreMs?:number}} [reglage]
 */
export function creerConfirmationSortie({ crans = CRANS_SORTIE, fenetreMs = FENETRE_SORTIE_MS } = {}) {
  let compte = 0
  let dernier = -Infinity
  let arme = false
  return {
    /**
     * Un cran de molette.
     * @param {number} deltaY positif = dézoom (la convention du DOM)
     * @param {number} t horodatage en ms (`performance.now()`)
     * @param {boolean} dansLeCrop hors du crop, il n'y a rien à quitter
     * @returns {boolean} vrai au cran qui CONFIRME, et à celui-là seulement
     */
    cran(deltaY, t, dansLeCrop) {
      // ⛔ **HORS DU CROP, LA MOLETTE EST INCHANGÉE.** Le critère du brief le dit
      // mot pour mot, et c'est aussi la garde qui protège D19 : rien de ce
      // module n'existe pour l'utilisateur qui n'est pas dans le crop.
      if (!dansLeCrop) { compte = 0; arme = false; return false }
      if (!(Number.isFinite(deltaY) && deltaY !== 0) || !Number.isFinite(t)) return false
      // ⚠️ **LE ZOOM AVANT REMET À ZÉRO, comme il désarme `sortieArmee`.** Une
      // seule idée — « l'utilisateur ne veut plus partir » — et un seul endroit
      // où elle s'écrit dans le geste.
      if (deltaY < 0) { compte = 0; arme = false; dernier = t; return false }
      if (t - dernier > fenetreMs) { compte = 0; arme = false }
      dernier = t
      if (arme) return false // déjà confirmé : la poussée est en route, un cran de plus ne la relance pas
      if (++compte < crans) return false
      arme = true
      return true
    },
    /** La bascule du crop (naissance ou mort) remet le compteur à zéro : une
     *  intention est consommée par la sortie, comme `sortieArmee`. */
    reinitialiser() { compte = 0; arme = false; dernier = -Infinity },
    get compte() { return compte },
    get arme() { return arme },
  }
}
