// QUEL BOUTON DE SOURIS FAIT QUOI — la règle, et rien d'autre.
//
// Module PUR : ni DOM, ni three.js (les constantes MOUSE lui sont PASSÉES).
// Testable en node — test/boutons-camera.test.js.
//
// ══════════ LA PERTE QU'IL RÉPARE ══════════════════════════════════════════
//
// Adrien, mot pour mot après avoir essayé le mode continu : « l'ancien
// déplacement par clic droit n'existe plus, je ne peux plus me déplacer de
// cette façon. »
//
// La cause n'était pas le partage du clic droit, c'était la MÉTHODE employée
// pour le reprendre. `f3Tick` éteignait `controls.enablePan` à chaque image
// pour empêcher OrbitControls de voler le geste — sauf que `enablePan` est un
// interrupteur GLOBAL : il gouverne le clic droit, mais aussi le bouton du
// milieu et le repli Maj+gauche. En le coupant, on ne retirait pas un bouton
// au déplacement de caméra, on retirait le déplacement de caméra tout court.
//
// La correction tient en une phrase : on ne coupe plus une CAPACITÉ, on rend
// un seul BOUTON inerte. Tout le reste du déplacement survit.
//
// ══════════ POURQUOI LE BOUTON DU MILIEU EST LIBRE — VÉRIFIÉ ════════════════
//
// `controls.enableZoom = false` partout : main.js:996 au montage, puis
// modes.js:303 (orbital) et modes.js:381 (surface), avec le commentaire
// « surface zoom is our inertial dolly ». Or le défaut d'OrbitControls met
// MOUSE.DOLLY sur le bouton du milieu, et le cas DOLLY sort immédiatement quand
// `enableZoom` est faux. Le bouton du milieu ne fait donc RIEN dans cette
// application, dans aucun mode. On ne vole aucun geste : on remplit une place
// vide.
//
// ══════════ ET LE REPLI, PARCE QU'UN PORTABLE N'A PAS DE MOLETTE ════════════
//
// Un pavé tactile n'a pas de bouton du milieu — ou il faut aller le chercher
// dans les réglages du système. Une fonction offerte à la moitié des machines
// n'est pas offerte. Il faut donc une seconde liaison qui marche partout.
//
// ⚠️ ELLE EXISTE DÉJÀ, ET C'EST LA MEILLEURE NOUVELLE DE CE FICHIER. Lu dans la
// source vendue (node_modules/three/examples/jsm/controls/OrbitControls.js,
// lignes 1271-1280) : sur `case MOUSE.ROTATE`, si ctrl/meta/shift est tenu,
// OrbitControls bascule lui-même en PAN. Maj + clic gauche déplace donc la
// caméra NATIVEMENT, sans une ligne de code — c'est `enablePan = false` qui le
// rendait injoignable, rien d'autre. On n'écrit donc aucun gestionnaire de
// modificateur : réimplémenter ce que la bibliothèque fait déjà bien serait un
// second chemin à maintenir et une occasion de divergence.
//
// Maj a été vérifié libre : shortcuts.js ne s'en sert qu'en ACCORD avec une
// autre touche (Ctrl+Maj+Z, Maj+?), jamais tenu seul pendant un glissement.

export const ACTION = Object.freeze({
  ROTATION: 'rotation',
  DEPLACEMENT: 'deplacement', // déplacement latéral de la CAMÉRA (pan)
  GLISSE: 'glisse-terrain', // déplacement de la FENÊTRE de terrain (mode continu)
  // ══════════ LE VOCABULAIRE DE GOOGLE EARTH — Tâche GE2 ═══════════════════
  SAISIE: 'saisie-terre', // on attrape la Terre (R32)
  ZOOM: 'zoom-glisse', // le glissé de zoom du clic droit (Google Earth Pro)
  INCLINAISON: 'inclinaison', // l'inclinaison et le cap MANUELS — voir gestes-terre.js §3
})

/**
 * Ce que fait chaque bouton, dans cet état de l'application.
 *
 * @param {object} o
 * @param {boolean} o.continu - le mode continu 3×3 est-il actif
 * @param {boolean} o.surface - est-on en mode surface (par opposition au globe)
 * @param {boolean} o.terre - le RÉGIME DE LA TERRE (orbite, ou surface hors du
 *   crop) : le vocabulaire de Google Earth y a la main sur les trois boutons
 * @returns {{gauche:string, milieu:string, droit:string, majGauche:string}}
 */
export function boutonsSouris({ continu = false, surface = true, terre = false } = {}) {
  // ══════════ LE RÉGIME DE LA TERRE — Tâche GE2 ════════════════════════════
  //
  // En orbite et en surface hors du crop, les trois boutons appartiennent au
  // vocabulaire de Google Earth (`monde/gestes-terre.js`), pas à OrbitControls :
  // gauche = on attrape la Terre (R32), droit = le glissé de zoom, milieu =
  // l'inclinaison MANUELLE. ⛔ **Le déplacement d'OrbitControls doit alors
  // partir de TOUS les boutons**, et pas seulement du gauche.
  //
  // ⚠️ **CE N'EST PAS UN GOÛT, C'EST UNE MESURE** (`.banc/GE2/avant-surface.json`,
  // 5 915 km hors du crop, glissé de 200 px) : le déplacement d'OrbitControls
  // laissé sur le clic droit produisait `|Δ ln(distance caméra→cible)| = 5,27e-2`,
  // soit **527 fois le seuil de `veille-repos`** — le signal même qui arme la
  // bascule de trois quarts de D16 ter. Ctrl + gauche rendait 1,88e-1 (1 880 ×),
  // Maj + gauche 1,15e-1 (1 150 ×). Trois gestes qui déclaraient un changement
  // d'échelle sans qu'aucune échelle ne change.
  if (terre) {
    return {
      gauche: ACTION.SAISIE,
      milieu: ACTION.INCLINAISON,
      majGauche: ACTION.INCLINAISON,
      droit: ACTION.ZOOM,
    }
  }
  // La glisse n'a de sens qu'en surface : il n'y a pas de fenêtre continue
  // autour d'un globe. Sans cette condition, entrer en mode globe avec la
  // préférence allumée laisserait un clic droit mort.
  const glisse = continu && surface
  return {
    gauche: ACTION.ROTATION,
    // Les DEUX liaisons constantes du déplacement. Elles ne changent jamais,
    // dans aucun mode : c'est tout l'intérêt: Adrien a été piégé une fois par
    // un clic droit qui changeait de sens, il lui faut un repère fixe.
    milieu: ACTION.DEPLACEMENT,
    majGauche: ACTION.DEPLACEMENT,
    droit: glisse ? ACTION.GLISSE : ACTION.DEPLACEMENT,
  }
}

/**
 * La même règle, dans le vocabulaire de `controls.mouseButtons`.
 *
 * `MOUSE` est passé (et non importé) pour que ce module reste testable en node.
 *
 * ⚠️ `-1` et pas `null` : c'est la valeur qu'OrbitControls emploie lui-même
 * pour « aucune action » (`default: mouseAction = -1`), et aucun `case` du
 * switch ne l'attrape. Le bouton est alors inerte pour la bibliothèque, et
 * notre propre gestionnaire de glisse en dispose seul.
 *
 * `majGauche` n'apparaît pas ici : laisser LEFT à ROTATE SUFFIT à l'obtenir,
 * OrbitControls s'en charge (voir l'en-tête).
 */
export function versTroisJs(map, MOUSE) {
  // ⛔ **DANS LE RÉGIME DE LA TERRE, LES TROIS BOUTONS SONT RENDUS INERTES POUR
  // LA BIBLIOTHÈQUE.** `-1` est la valeur qu'OrbitControls emploie lui-même pour
  // « aucune action » (`default: mouseAction = -1`), et aucun `case` de son
  // switch ne l'attrape. Le gauche n'a pas besoin d'être coupé ici — la saisie
  // le prend par `controls.enableRotate = false` (R32) —, mais le milieu et le
  // droit portaient un `PAN` qui, lui, écrivait `controls.target` sans que rien
  // ne l'ait demandé : c'est le 5,27e-2 mesuré (voir `boutonsSouris`).
  // ⛔ **LE GAUCHE AUSSI, ET C'EST UNE MESURE QUI L'A IMPOSÉ.** Première passe :
  // `LEFT: MOUSE.ROTATE` gardé, en croyant que `controls.enableRotate = false`
  // (R32) suffisait à le neutraliser. **Faux, et le banc l'a hurlé** : lu dans
  // la source vendue (`OrbitControls.js`, `case MOUSE.ROTATE`), un ctrl / meta /
  // shift tenu bascule en PAN — et ce PAN-là est gardé par `enablePan`, **pas
  // par `enableRotate`**. Maj + glissé horizontal faisait donc l'inclinaison
  // manuelle ET le déplacement d'OrbitControls en même temps :
  // `|Δ ln d| = 1,88` (18 800 × le seuil de `veille-repos`), altitude
  // 4 651 → 418 km, centre de la vue à **49 142 px**
  // (`.banc/GE2/apres-surface.json`, première passe).
  // ⚠️ Le repli que l'en-tête de ce fichier célèbre — « Maj + clic gauche déplace
  // NATIVEMENT » — est précisément ce qu'il faut couper ICI, et seulement ici :
  // dans le régime de la Terre, Ctrl et Maj portent l'inclinaison de Google
  // Earth. Hors de ce régime (le crop), la ligne suivante le rend intact.
  if (map.droit === ACTION.ZOOM) return { LEFT: -1, MIDDLE: -1, RIGHT: -1 }
  return {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.PAN,
    RIGHT: map.droit === ACTION.GLISSE ? -1 : MOUSE.PAN,
  }
}
