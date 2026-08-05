// ═══════════ COMPOSER LES DEUX DÉCALAGES DE L'AFFICHE ═══════════════════════
//
// ⚠️ `camera.setViewOffset` N'EST PAS CUMULATIF. C'est un setteur : il écrase
// les six nombres précédents (three, PerspectiveCamera.js — `this.view.offsetX
// = x`, pas `+=`). Or l'affiche a DEUX raisons de s'en servir :
//
//   1. LE CADRAGE DE L'ACHETEUR — ce qu'il compose au pouce et à la molette sur
//      sa feuille. `cadrerAffiche` (main.js) l'exprime en fraction d'image, sur
//      un cadre VIRTUEL de 10 000 de large.
//   2. LE PAVAGE DU TIRAGE — `cadrageTuile` (print-page.js) décrit la fenêtre
//      d'une tuile dans l'image pleine, en PIXELS RÉELS.
//
// Les deux appelés à la suite, le second gagne. Et ce défaut-là ne casse rien
// de visible : il livre simplement une AUTRE affiche que celle validée —
// correctement pavée, correctement imprimée, recentrée en silence. Pas une
// exception, pas une ligne en console, la découverte se fait sur le papier.
//
// D'où ce module : on compose AVANT, et on n'appelle QU'UNE FOIS.
//
// ═══ POURQUOI CE N'EST PAS UNE ADDITION NAÏVE ══════════════════════════════
//
// 10 000 d'un côté, 8 268 px de l'autre : additionner les `offsetX` bruts
// n'aurait aucun sens. Ce qui se compose, ce sont les FRACTIONS — et c'est tout
// ce que three regarde :
//
//     gauche += offsetX · largeur / fullWidth
//     haut   -= offsetY · hauteur / fullHeight
//     largeur *= width / fullWidth      hauteur *= height / fullHeight
//
// Seuls comptent donc offsetX/fullWidth, offsetY/fullHeight, width/fullWidth,
// height/fullHeight. En fractions :
//
//   acheteur : (x/2, y/2, 1, 1)     — le 10 000 se simplifie, il ne survit pas
//   tuile    : (tx/Wp, ty/Hp, tw/Wp, th/Hp)
//
// Décaler puis découper, c'est additionner les décalages et garder la taille de
// la tuile. En prenant l'image pleine (Wp, Hp) comme cadre commun :
//
//     offsetX = x · Wp/2 + tx      width  = tw
//     offsetY = y · Hp/2 + ty      height = th
//
// C'est bien une addition, mais APRÈS remise à l'échelle du cadre virtuel.
//
// ═══ UNE PRÉCISION SUR LA FORMULE DU PLAN ══════════════════════════════════
//
// Le plan de la tâche donnait `offsetX = x·Wt/2` et `width = Wt`, sans terme de
// tuile en x. C'est juste — mais SEULEMENT pour un pavage en bandes pleine
// largeur. `planTuiles` produit un vrai damier (3 colonnes × 2 lignes pour un
// 70 × 50 à 300 dpi sous 4 096 px) : oublier `tx` et `tw` recollerait chaque
// ligne à partir de trois fois la même colonne. La forme ci-dessus est la
// forme générale ; elle retombe sur celle du plan quand tx = 0 et tw = Wp.

// Un nombre, ou son défaut : un cadrage venu d'un lien de partage ou d'un
// réglage à moitié écrit ne doit pas semer un NaN dans la matrice de
// projection — three ne s'en plaindrait pas, il rendrait un écran noir.
const nombre = (v, defaut = 0) => (Number.isFinite(v) ? v : defaut)

// ═══ LE PIÈGE QUE PERSONNE N'ATTEND : setViewOffset ÉCRASE camera.aspect ════
//
// three, PerspectiveCamera.setViewOffset, toute première ligne :
//
//     this.aspect = fullWidth / fullHeight;
//
// Le cadre de référence n'est donc PAS neutre : son propre rapport devient
// l'aspect de la caméra, par-dessus celui qu'on venait de poser. `cadrerAffiche`
// passait `10000 × Math.round(10000/aspect)` — un cadre dont le rapport n'est
// celui de l'affiche qu'à l'arrondi près. Pour un 70 × 50 à 300 dpi, l'aspect
// effectif devenait 1,399972 au lieu de 1,399932 : 0,003 % d'étirement, un quart
// de pixel sur 8 268, invisible mais gratuit.
//
// On ne l'arrondit donc plus. `fullHeight` n'a aucune raison d'être entier —
// three ne fait qu'en diviser — et sans arrondi le rapport du cadre redevient
// EXACTEMENT l'aspect demandé. Avec une tuile, la question ne se pose même pas :
// le cadre commun est l'image pleine en pixels, dont le rapport EST l'aspect de
// l'affiche.
//
// Le cadre virtuel du cadrage seul. Sa valeur n'a aucune importance
// géométrique (les fractions se simplifient) ; c'est celle qu'utilisait
// `cadrerAffiche`, gardée par continuité.
export const CADRE_VIRTUEL = 10000

/**
 * Le jeu d'arguments UNIQUE de `camera.setViewOffset` pour une affiche.
 *
 * @param {{x:number, y:number, aspect:number}} acheteur - le cadrage validé :
 *   deux décalages en fraction de DEMI-image (la convention de `cadrageValide`,
 *   print-page.js), et l'aspect de l'affiche. Le zoom ne passe pas par ici : il
 *   vit dans `camera.zoom`, qui resserre le champ sans bouger la fenêtre.
 * @param {?{fullWidth:number, fullHeight:number, offsetX:number, offsetY:number,
 *   width:number, height:number}} tuile - la sortie de `cadrageTuile`
 *   (print-page.js), ou `null` pour un rendu plein cadre — l'aperçu à l'écran.
 * @returns {?{fullWidth:number, fullHeight:number, offsetX:number, offsetY:number,
 *   width:number, height:number}} `null` quand il n'y a rien à décaler du tout :
 *   l'appelant fait alors `clearViewOffset()`, exactement comme avant.
 */
export function composeDecalage(acheteur = {}, tuile = null) {
  const x = nombre(acheteur.x)
  const y = nombre(acheteur.y)

  // ── Sans pavage : le cadrage seul, sur le cadre virtuel d'origine ────────
  if (!tuile) {
    if (x === 0 && y === 0) return null
    const aspect = nombre(acheteur.aspect, 1)
    const W = CADRE_VIRTUEL
    // PAS d'arrondi (voir plus haut) : le rapport de ce cadre devient l'aspect
    // de la caméra. Un aspect nul, négatif ou infini rendrait une hauteur
    // inutilisable ; la fenêtre d'export peut en produire un le temps d'un
    // redimensionnement.
    const H = aspect > 0 && Number.isFinite(aspect) ? W / aspect : W
    return { fullWidth: W, fullHeight: H, offsetX: (x * W) / 2, offsetY: (y * H) / 2, width: W, height: H }
  }

  // ── Avec pavage : l'image pleine devient le cadre commun ─────────────────
  const Wp = nombre(tuile.fullWidth, 1)
  const Hp = nombre(tuile.fullHeight, 1)
  const tx = nombre(tuile.offsetX)
  const ty = nombre(tuile.offsetY)
  const tw = nombre(tuile.width, Wp)
  const th = nombre(tuile.height, Hp)

  // Une tuile unique qui couvre toute l'affiche, sans cadrage : c'est
  // l'identité. On rend `null` plutôt qu'un décalage nul, pour que l'appelant
  // retombe sur `clearViewOffset()` — le chemin d'avant, inchangé.
  if (x === 0 && y === 0 && tx === 0 && ty === 0 && tw === Wp && th === Hp) return null

  return {
    fullWidth: Wp,
    fullHeight: Hp,
    offsetX: (x * Wp) / 2 + tx,
    offsetY: (y * Hp) / 2 + ty,
    width: tw,
    height: th,
  }
}
