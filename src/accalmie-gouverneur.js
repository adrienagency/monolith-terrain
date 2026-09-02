// L'ACCALMIE DU GOUVERNEUR — PF4, bug n° 3 : « PERFORMANCE — ESSENTIAL MODE »
// s'affiche au chargement chez Adrien.
//
// ⚡ **CE N'EST PAS LE PALIER MACHINE QUI L'AFFICHE.** `palier-machine.js`
// estime un palier de départ AVANT le premier rendu et `perf.js` l'applique en
// silence (`applyTier(startTier)`, sans bannière). La bannière ne sort que de
// `setTier`, donc du GOUVERNEUR : il a MESURÉ moins de 12 images/s pendant
// 2,5 s et a sauté droit au palier 3.
//
// Mesuré (PF4, `scripts/profil-pf4.mjs --scenario palier --cpu 4`, RTX 3080
// bridée ×4, 1280×800) : images dessinées par seconde après le premier dessin
// **10 · 5 · 2 · 1 · 5 · 6 · 3 · 11 · 1 · 22 · 28 · 48 · …** puis 40 à 58. Le
// palier tombe à 3 à la quatrième seconde, sur ces **neuf secondes de rafale
// d'arrivée** — décodage des tuiles, dalles voisines, compilation des
// nuanceurs — et il n'en remonte jamais (remonter exige 55 i/s pendant 12 s).
// Le guichet `!demBusy` ne couvre que la construction du MNT central ; la
// rafale continue bien après.
//
// LA RÈGLE : après le premier dessin et après chaque arrivée de relief, le
// gouverneur n'écoute pas pendant `ACCALMIE_ARRIVEE_MS`. Une machine vraiment
// lente l'est ENCORE après ; elle descend alors, à raison. C'est le même geste
// que `BOOT_IGNORE` (5 s après la naissance du contrôleur, bien avant le
// premier dessin) et `SETTLE_IGNORE` (2 s après un changement de palier) —
// posé, lui, sur l'instant qui compte.

export const ACCALMIE_ARRIVEE_MS = 10000

export function creerAccalmie(now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  let jusqua = -Infinity
  return {
    // une arrivée : le guichet se ferme pour `duree` ms (jamais raccourci)
    marquer(duree = ACCALMIE_ARRIVEE_MS) {
      jusqua = Math.max(jusqua, now() + duree)
    },
    // le gouverneur peut-il mesurer ?
    calme() {
      return now() >= jusqua
    },
    get jusqua() {
      return jusqua
    },
  }
}
