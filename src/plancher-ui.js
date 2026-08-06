// LE PLANCHER DE L'INTERFACE — À QUELLE HAUTEUR UN MESSAGE PASSAGER SE POSE.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE N'EST PAS UNE CONSTANTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien : « Les infos type "lien copié" doivent apparaître tout le temps
// au-dessus de l'UI affichée, ici la barre de menu — je ne parle pas de
// z-index, mais de l'axe Y. S'il y a autre chose au-dessus de la barre de menu,
// ça apparaîtra encore plus haut (ex : profil de course). »
//
// Le message vivait à `bottom: 32px`, c'est-à-dire DERRIÈRE la barre du bas dès
// que celle-ci existe. Un z-index l'aurait fait passer par-dessus — donc posé
// SUR la barre, à recouvrir des boutons. Ce qu'il faut, c'est le poser AU-DESSUS
// au sens géométrique : sa position verticale se déduit de ce qui est déjà
// affiché en bas.
//
// ⚠️ ET ON MESURE LES ÉLÉMENTS RENDUS, ON NE RECOPIE AUCUNE HAUTEUR. La barre
// change de taille au point de rupture tactile (v28.css), le profil de course
// change de hauteur quand on le replie, et sa propre position est DÉJÀ calculée
// à partir de la barre (`syncGpxProfilePosition` dans main.js, qui publie
// `--gpx-profile-bottom`). Recopier une de ces hauteurs ici en ferait une
// seconde source, qui divergerait au premier réglage. On lit donc le rectangle
// que le navigateur a réellement produit : il porte déjà toutes ces décisions.
//
// ⚠️ ET LA MESURE SE FAIT AU MOMENT D'AFFICHER, PAS À L'AVANCE. Un message
// passager est justement l'instant où l'on sait exactement ce qui est à l'écran
// : pas d'observateur à brancher, pas d'état à tenir à jour, pas de fuite.

/**
 * Ce qui est amarré EN BAS de l'écran, du plus haut au plus bas.
 *
 * ⚠️ CETTE LISTE EST LE CONTRAT : n'y entre que ce qui est collé au bas de la
 * fenêtre. Le profil de course d'abord — c'est lui qui monte le plancher quand
 * un parcours est chargé —, puis la barre liquide (capsule des modes +
 * cartouche du bas, un seul bloc depuis leur fusion), puis la barre de
 * recherche seule pour les écrans où la rangée liquide n'existe pas.
 */
export const SELECTEURS_PLANCHER = Object.freeze([
  '.gpx-profile:not(.hidden)',
  '.ce-elemwrap',
  '.ce-bottombar',
])

/** Rien en bas (boutique, viewer nu, mode sans interface) : la place d'origine. */
export const MARGE_NUE = 32

/**
 * L'air laissé entre le message et ce qu'il surplombe.
 *
 * La même valeur que celle qui sépare le profil de course de la barre
 * (`syncGpxProfilePosition`) : trois objets empilés au-dessus du même bord
 * doivent respirer pareil, sinon la pile se lit comme un empilement raté.
 */
export const ECART = 14

/**
 * À quelle distance du bas de la fenêtre poser un message passager.
 *
 * @param {object} o
 * @param {Array<{top:number,width:number,height:number}>} o.rects - les
 *   rectangles des éléments amarrés en bas, tels que rendus. Un rectangle de
 *   largeur ou de hauteur nulle est un élément masqué : il ne compte pas.
 * @param {number} o.hauteurFenetre
 * @param {number} [o.margeNue] - la position quand rien n'est affiché en bas
 * @param {number} [o.ecart]
 * @returns {number} la valeur de `bottom`, en pixels
 */
export function hauteurPlancher({ rects = [], hauteurFenetre = 0, margeNue = MARGE_NUE, ecart = ECART } = {}) {
  let haut = Infinity
  for (const r of rects) {
    if (!r || !(r.width > 0) || !(r.height > 0)) continue
    // Un élément entièrement sorti par le bas (transition de fermeture) ou
    // remonté hors de la fenêtre ne surplombe rien : il ne lève pas le plancher.
    if (!(r.top < hauteurFenetre)) continue
    if (r.top < haut) haut = r.top
  }
  if (!Number.isFinite(haut)) return margeNue
  // ⚠️ JAMAIS SOUS LA MARGE NUE. Une barre qui déborderait par le bas rendrait
  // une valeur négative, et le message sortirait de l'écran par le bas — le seul
  // endroit où il ne sert plus à rien.
  return Math.max(margeNue, Math.round(hauteurFenetre - haut + ecart))
}

/**
 * Mesure l'interface du bas et publie le plancher pour le CSS.
 *
 * `--ce-plancher-ui` est lu par `.ce-toast` et `.ce-livraison` (style.css), qui
 * gardent leur ancienne valeur en repli : une feuille chargée avant le premier
 * message doit rester juste.
 *
 * @returns {number} la valeur publiée, en pixels
 */
export function mesurerPlancher(doc = document, fenetre = window) {
  const rects = []
  for (const sel of SELECTEURS_PLANCHER) {
    const n = doc.querySelector(sel)
    if (n) rects.push(n.getBoundingClientRect())
  }
  const px = hauteurPlancher({ rects, hauteurFenetre: fenetre.innerHeight })
  doc.documentElement.style.setProperty('--ce-plancher-ui', `${px}px`)
  return px
}
