// LE CLIC-POUR-REPRENDRE — extrait pour être testable (relecture finale,
// 2026-08-04, BLOQUANT).
//
// ⚠️ hoverIdx (GpxLayer, gpx.js) A DEUX ÉCRIVAINS, ET C'EST LE PIÈGE. Le
// picking souris (pointerMove → setHover(i, true)) ET la tête de lecture, qui
// le RÉÉCRIT À CHAQUE IMAGE pendant qu'elle joue (_updateHead → setHover(headIdx,
// false, undefined, undefined, isPlaybackHead=true)). Un rAF s'intercale
// TOUJOURS entre le pointerdown et le pointerup d'un clic : pendant une
// lecture, hoverIdx vaut donc l'index de la TÊTE au moment du clic, quel que
// soit ce qu'il y a réellement sous le curseur. Un simple `hoverIdx >= 0`
// (l'ancienne garde, en ligne dans main.js) ne peut donc PAS distinguer « la
// souris est sur le tracé » de « la lecture tourne » — et confondait les deux
// à chaque clic pendant la lecture : le clic-pour-plonger sur le terrain était
// mort, et `seekAndResumeCourse` réinitialisait la poursuite caméra
// (pilote.lancerPoursuite()) à chaque clic, y compris un clic loin du tracé.
//
// `survolSouris` est la distinction : GpxLayer.setHover pose désormais
// `this._survolSouris = !isPlaybackHead && i >= 0` (voir gpx.js) — vrai
// UNIQUEMENT si le DERNIER écrivain de hoverIdx est un survol souris réel
// (picking 3D ou profil), jamais la tête de lecture. Ce module se contente de
// relire ce booléen : si le réintroduire un jour redevient tentant (une
// nouvelle voie d'appel à setHover, par exemple), c'est CE test-ci qui
// rougira, pas une régression silencieuse constatée au navigateur.
//
// Couvre aussi le cas Pause (item 3 de la relecture) : pause() ne remet pas
// hoverIdx à -1 (il reste à l'index de la tête, pour garder le réticule du
// profil visible sur la position quittée), mais le DERNIER écrivain reste la
// tête de lecture (isPlaybackHead=true) tant qu'aucun mouvement de souris n'a
// retraversé le canevas 3D ou le profil — donc survolSouris reste faux, et un
// clic après Pause ne relance pas la lecture par erreur.
export function doitReprendreLaLecture({ survolSouris, hoverIdx, totKm } = {}) {
  return !!survolSouris && hoverIdx >= 0 && Number.isFinite(totKm) && totKm > 0
}

// La formule elle-même (voir GpxLayer.setHover, gpx.js) — extraite en pure
// pour que le contrat entre les deux écrivains de hoverIdx soit vérifiable
// sans construire un GpxLayer complet (three.js + DOM), hors de portée des
// tests de ce dépôt (aucun jsdom).
export function survolVientDeLaSouris(isPlaybackHead, i) {
  return !isPlaybackHead && i >= 0
}
