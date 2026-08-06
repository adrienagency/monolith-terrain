// LE POINT DE NETTETÉ DE L'AFFICHE — ce qui se décide SANS la scène 3D.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Le point de netteté est mémorisé en COORDONNÉES DU MONDE ({x, y, z} sur le
// relief) — voir `cadrerAffiche` dans src/main.js, qui explique pourquoi : une
// distance mesurée à l'écran désignerait un autre plan une fois l'affiche
// cadrée, parce que l'affiche DÉPLACE la caméra.
//
// ⚠️ MAIS UN POINT DU MONDE N'A AUCUN LIEN AVEC LE CADRE. Passer de paysage à
// portrait refait le cadre entier : `distanceCadrage` dépend de l'aspect (le
// demi-champ horizontal vaut tan(fov/2)·aspect), la caméra recule, et le
// décalage de composition recoupe encore. Le point, lui, ne bouge pas — il peut
// donc se retrouver HORS DE LA FEUILLE. Sa profondeur reste recalculée
// fidèlement à chaque rendu ; simplement, plus rien de visible ne se trouve à
// cette profondeur, et l'affiche entière sort floue sans qu'aucun message ne le
// dise. C'est exactement ce qu'Adrien a constaté.
//
// Ce module ne contient donc PAS la visée (elle a besoin du relief et de la
// caméra, elle vit dans main.js) mais les trois décisions qui l'entourent :
//   ① le point est-il encore SUR LA FEUILLE ?
//   ② s'il n'y est plus, où re-viser, et dans quel ordre ?
//   ③ faut-il avertir avant d'encaisser ?
// Trois questions pures, donc trois questions testables sans WebGL.

// ═══════════════════════════════════════════════════════════════════════════
// ① EST-IL ENCORE SUR LA FEUILLE ?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La bande, en bord de feuille, où l'on considère qu'un point de netteté ne
 * sert plus à rien. 2 % de demi-cadre de chaque côté.
 *
 * ⚠️ CE N'EST PAS UNE PRÉCAUTION NUMÉRIQUE, C'EST UN JUGEMENT DE COMPOSITION.
 * Un sujet net collé au bord n'est plus le sujet de l'affiche : le regard va au
 * centre, y trouve du flou, et l'acheteur lit « ratée » avant de lire
 * « artistique ». On préfère re-viser et le lui dire.
 */
export const MARGE_SUR_LA_FEUILLE = 0.02

/**
 * Le point projeté tombe-t-il encore sur l'affiche ?
 *
 * @param {{u:number, v:number, devant?:boolean}|null} ndc - coordonnées
 *   normalisées de three (−1 à +1, y vers le haut) DANS LE CADRE DE L'AFFICHE,
 *   plus `devant` : le point est-il devant l'objectif ?
 *
 * ⚠️ `devant` N'EST PAS FACULTATIF DANS L'ESPRIT, seulement dans la signature.
 * Un point passé DERRIÈRE la caméra se projette quand même — en miroir, avec
 * des coordonnées parfaitement plausibles. Sans ce drapeau on le croirait
 * cadré, et on garderait une mise au point derrière l'objectif.
 */
export function estSurLaFeuille(ndc, marge = MARGE_SUR_LA_FEUILLE) {
  if (!ndc || ndc.devant === false) return false
  const { u, v } = ndc
  if (!Number.isFinite(u) || !Number.isFinite(v)) return false
  const limite = 1 - Math.max(0, marge)
  return Math.abs(u) <= limite && Math.abs(v) <= limite
}

// ═══════════════════════════════════════════════════════════════════════════
// ② OÙ RE-VISER ?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * L'ordre des endroits à essayer quand le point a quitté le cadre — ou quand il
 * n'y en a jamais eu.
 *
 * ⚠️ LA PREMIÈRE TENTATIVE EST L'ENDROIT DE LA FEUILLE OÙ L'UTILISATEUR AVAIT
 * VISÉ, pas le centre. Il avait mis le net au tiers droit ; après bascule, le
 * tiers droit d'un portrait est un autre lieu du monde, mais c'est la MÊME
 * intention de composition. Repartir du centre lui ferait refaire un geste
 * qu'il a déjà fait.
 *
 * Les suivantes existent parce qu'un rayon peut ne rien toucher : viser le ciel
 * ne rend rien (voir `viserPointNet`). On redescend alors vers le centre, puis
 * un peu SOUS le centre — le relief occupe le bas d'une affiche bien plus
 * souvent que le haut, qui est du ciel — puis un peu au-dessus.
 *
 * @param {{u:number, v:number}|null} visee - la fraction de cadre du dernier
 *   clic, si on la connaît
 * @returns {{u:number, v:number}[]} - à essayer dans l'ordre, sans doublon
 */
export function viseesDeRepli(visee) {
  const liste = []
  const ajoute = (u, v) => {
    if (!Number.isFinite(u) || !Number.isFinite(v)) return
    if (Math.abs(u) > 1 || Math.abs(v) > 1) return
    if (liste.some((e) => Math.abs(e.u - u) < 1e-6 && Math.abs(e.v - v) < 1e-6)) return
    liste.push({ u, v })
  }
  if (visee) ajoute(visee.u, visee.v)
  ajoute(0, 0)
  ajoute(0, -0.35)
  ajoute(0, 0.25)
  return liste
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ FAUT-IL AVERTIR AVANT D'ENCAISSER ?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adrien : « il faudrait un avertissement très très compréhensible si le bokeh
 * est activé […] Et ça, à chaque fois que l'on va passer à l'achat. »
 *
 * ⚠️ « À CHAQUE FOIS » EST PRIS AU MOT : aucune mémoire d'une commande à
 * l'autre, aucune case « ne plus me le demander ». Le risque, lui, se
 * représente entier à chaque affiche — le cadre a pu changer entre-temps, et
 * c'est justement le cas qui a motivé toute cette passe.
 *
 * @param {boolean} bokehActif - le flou est-il allumé sur CETTE carte ?
 * @param {boolean} dejaConfirme - l'utilisateur vient-il de répondre, pour
 *   CETTE tentative d'achat ? (le drapeau se remet à faux quand la tentative
 *   se termine, quelle qu'en soit l'issue)
 */
export function doitAvertirAvantAchat({ bokehActif, dejaConfirme } = {}) {
  return !!bokehActif && !dejaConfirme
}

// ═══════════════════════════════════════════════════════════════════════════
// LES MOTS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ LE TON EST LA MOITIÉ DU TRAVAIL, ET IL EST ÉCRIT ICI POUR QU'UN TEST PUISSE
// LE TENIR. Ce n'est pas un message d'erreur technique : c'est une question
// posée à quelqu'un qui va payer et qui n'a peut-être jamais entendu le mot
// « bokeh ». Trois règles, vérifiées par test :
//   ① AUCUN JARGON. Ni « bokeh », ni « profondeur de champ », ni « focus » :
//      on dit « flou » et « net », les deux mots que tout le monde a.
//   ② ON DIT CE QU'IL RISQUE, pas ce que le logiciel fait — « tu recevras un
//      tirage flou là où tu ne le voulais pas », pas « la mise au point est
//      figée sur un point du monde ».
//   ③ ON DIT CE QU'IL PEUT FAIRE, dans le même souffle et en un seul geste :
//      « clique sur l'affiche ». Un avertissement sans remède est une angoisse.
export const AVERTISSEMENT_NETTETE = {
  titre: 'Attention : sur cette affiche, une seule zone sera nette.',
  phrase:
    'Regarde l’aperçu avant de continuer — si le net n’est pas au bon endroit, '
    + 'clique sur l’affiche pour déplacer le point ; sinon tu recevras un tirage '
    + 'flou là où tu ne le voulais pas.',
  // ⚠️ LE REFUS EST À GAUCHE ET IL EST UTILE. « Annuler » renverrait l'acheteur
  // à l'écran sans rien lui apprendre ; « Déplacer le point » arme le viseur,
  // c'est-à-dire fait le geste qu'on vient de lui décrire.
  deplacer: 'Déplacer le point',
  continuer: 'C’est net au bon endroit, continuer',
}

/**
 * Ce qu'on dit quand le cadre a changé et que le point n'était plus dessus.
 *
 * ⚠️ ON ANNONCE LE REPLACEMENT PLUTÔT QUE DE LE FAIRE EN SILENCE. L'affiche
 * vient de changer toute seule ; la taire ferait croire à un bug, et surtout
 * laisserait croire que le net est resté là où on l'avait mis.
 */
export const MESSAGE_POINT_REPLACE =
  'Le cadre a changé : ton point de netteté n’était plus dessus. '
  + 'Il vient d’être replacé — clique sur l’affiche pour le mettre où tu veux.'
