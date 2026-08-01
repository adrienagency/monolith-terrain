// LA COURSE DE LA FENÊTRE DANS L'EMPRISE 3×3, ET SON BORD.
//
// Module PUR : ni DOM, ni three.js, ni état. Testable en node.
//
// ══════════ CE QUE CE MODULE DÉCIDE ═════════════════════════════════════════
//
// Une fenêtre de 56 unités (TERRAIN_SIZE) dans une emprise de 168 se déplace
// d'exactement ±56 unités — UNE largeur de socle dans chaque direction. Ce n'est
// pas un réglage : c'est (168 − 56) / 2. À z12 cela fait ±21 km, d'Annecy à
// Chamonix ; à z13, ±10 km (étude 3×3 §3.1).
//
// Adrien a tranché le comportement au bord : **BUTÉE ÉLASTIQUE**. « Le terrain
// résiste et revient — il ne s'arrête pas net et ne recharge pas. » Le
// rechargement d'une nouvelle emprise reste une porte à ne pas fermer par
// construction, d'où la forme de `avanceFenetre` : elle garde le geste BRUT à
// côté de l'affiché, et c'est ce brut qu'un futur recentrage lira pour savoir
// de combien l'utilisateur a voulu aller plus loin.
//
// ══════════ POURQUOI UNE ÉLASTIQUE ET PAS UN ARRÊT NET ══════════════════════
//
// La consigne du dépôt : « une dégradation ne doit pas se voir comme une
// panne ». Un terrain qui se fige net sous le doigt se lit comme un bug — on
// pousse plus fort, on croit que le geste n'a pas été capté. Une résistance qui
// cède un peu puis revient dit « il y a une limite » en une demi-seconde, sans
// qu'on ait à l'écrire nulle part.
//
// ══════════ LA FORME, ET POURQUOI CELLE-LÀ ══════════════════════════════════
//
// La loi du débordement est l'hyperbole d'Apple, celle des listes iOS :
//
//     d(e) = e · L / (e + L)
//
// où `e` est l'excès poussé et `L` le débordement maximal. Trois propriétés en
// découlent, et les trois comptent :
//
//  · d(0) = 0 et d'(0) = 1 — au franchissement du bord, la résistance naît de
//    ZÉRO. Une loi linéaire amortie (e · 0,5) ferait sauter la vitesse de
//    moitié pile au bord : l'œil voit un à-coup là où il n'y a pas d'obstacle.
//  · d est BORNÉE par L, quel que soit e. Un geste rapide au trackpad envoie
//    des sauts de plusieurs centaines d'unités par image ; sans plafond, la
//    fenêtre sortirait de l'emprise et on verrait le champ répété au bord (le
//    `sampleDem` clampe, il ne boucle pas — le terrain s'étirerait en traînées).
//  · d est croissante et impaire — pousser plus n'a jamais l'air de reculer, et
//    les quatre bords se comportent pareil.
//
// Le débordement maximal est fixé au HUITIÈME du socle. Assez pour que la
// résistance se voie ; assez peu pour qu'on ne montre jamais une bande vide
// large — au pire 7 unités sur 56, soit un huitième du bord de l'image.

// La course, en unités monde. (168 − 56) / 2 = 56, soit TERRAIN_SIZE.
// ⚠️ Écrite en dur ici plutôt qu'importée de terrain.js : ce module doit rester
// pur (terrain.js tire three.js). Le test verrouille l'égalité.
export const COURSE_ELASTIQUE = 56

// Débordement maximal au-delà de la butée, en unités monde.
const DEBORDEMENT_MAX = COURSE_ELASTIQUE / 8

// Constante de temps du rappel, en secondes : le temps que met le débordement à
// tomber à 1/e. 0,12 s — assez vif pour qu'on lise « ça revient » et pas « ça
// glisse », assez lent pour ne pas claquer.
// ⚠️ EXPORTÉE parce que l'élan doit converger vers CETTE loi et pas vers une
// autre : `fenetre-elan.js` amène sa vitesse sur celle du rappel avant de lui
// passer la main. Deux constantes séparées se seraient désaccordées au premier
// réglage, et le raccord redeviendrait l'à-coup qu'on vient d'enlever.
export const TAU_RAPPEL = 0.12

// En deçà de ce débordement, le rappel POSE la fenêtre sur le bord au lieu de
// continuer à s'en approcher. Une exponentielle n'atteint jamais sa cible : sans
// ce seuil, la fenêtre resterait indéfiniment à une fraction d'unité du bord et
// le socle serait reconstruit à chaque image pour un déplacement invisible.
const COLLE_AU_BORD = 1e-3

/**
 * Applique la butée élastique à une position brute, sur UN axe.
 *
 * @param {number} brut - la position voulue par le geste, sans limite
 * @param {number} course - la demi-course autorisée (unités monde)
 * @returns {number} la position à afficher
 */
export function borneElastique(brut, course) {
  const exces = Math.abs(brut) - course
  if (exces <= 0) return brut
  // e·L/(e+L) : vaut ~e quand e ≪ L, tend vers L quand e → ∞.
  const debord = (exces * DEBORDEMENT_MAX) / (exces + DEBORDEMENT_MAX)
  return Math.sign(brut) * (course + debord)
}

/**
 * Ramène une position hors course vers le bord, d'une image.
 *
 * ⚠️ L'amortissement est en `exp(−dt/τ)`, pas en `× 0,9` : sinon la butée
 * serait deux fois plus molle à 30 im/s qu'à 60, et l'iMac 2015 — la machine
 * cible — ne sentirait pas la même chose que la machine de développement.
 *
 * @param {number} v - position courante
 * @param {number} course - la demi-course autorisée
 * @param {number} dt - secondes écoulées depuis l'image précédente
 * @returns {number} la position de cette image
 */
export function rappelElastique(v, course, dt) {
  const exces = Math.abs(v) - course
  if (exces <= 0) return v
  // ⚠️ dt borné : un onglet réveillé ou un point d'arrêt rend un dt de plusieurs
  // secondes. `exp(−100)` vaut zéro, donc ça ne catapulte rien — mais on borne
  // quand même pour que la loi reste celle qu'on a testée.
  const k = Math.exp(-Math.min(dt, 0.5) / TAU_RAPPEL)
  const reste = exces * k
  if (reste < COLLE_AU_BORD) return Math.sign(v) * course
  return Math.sign(v) * (course + reste)
}

/**
 * POSE la fenêtre, sans geste et sans attendre : là où le rappel élastique
 * l'aurait laissée s'il avait eu tout le temps du monde.
 *
 * ══════════ POURQUOI UN EXPORT A BESOIN DE ÇA ═══════════════════════════════
 *
 * Le débordement élastique est un état de GESTE, pas un point de vue. Il vit
 * 0,3 s, montre jusqu'à 7 unités de bord où `sampleDem` clampe — c'est-à-dire
 * une bande de relief étiré — et le rappel est déjà en train de l'effacer.
 * Une capture 4K ou une image de clip prise là-dedans FIGE cette bande dans un
 * fichier, où plus rien ne viendra la corriger. Le défaut ne se voit pas à
 * l'écran (il a disparu avant qu'on le regarde) et se voit très bien dans le
 * fichier : la pire des combinaisons.
 *
 * ⚠️ ET C'EST EXACTEMENT LE POINT FIXE DU RAPPEL, pas « à peu près dedans ».
 * `rappelElastique(pose(v)) === pose(v)` pour tout `v` et tout `dt` : c'est ce
 * qui garantit qu'à la reprise de la boucle, après l'export, RIEN ne bouge —
 * ni saut, ni glissement résiduel. Un test de position ne suffirait pas à le
 * dire ; c'est la DÉRIVÉE qui doit être nulle, et c'est elle que le test lit.
 *
 * @param {number} v - position courante, débordement compris
 * @param {number} course - la demi-course autorisée
 * @returns {number}
 */
export function poseDansLaCourse(v, course) {
  if (!Number.isFinite(v)) return 0
  return Math.max(-course, Math.min(course, v))
}

/**
 * Le décalage de fenêtre qui pose un point du CHAMP au centre du socle affiché.
 *
 * ══════════ POURQUOI CE N'EST QU'UN BORNAGE, ET POURQUOI IL FALLAIT L'ÉCRIRE ══
 *
 * La géométrie ne bouge jamais : elle lit le champ à `position + fenetre`
 * (terrain.js, `_makeDemSampler`). Le centre du socle est la géométrie (0, 0),
 * donc ce qu'il montre est le point de champ `fenetre`. Poser la fenêtre SUR la
 * coordonnée de champ d'un lieu revient exactement à mettre ce lieu au milieu.
 * D'où un corps de deux lignes — mais la règle mérite un nom parce que c'est ce
 * nom qui porte les deux pièges ci-dessous.
 *
 * ⚠️ PREMIER PIÈGE — LA BORNE N'EST PAS FACULTATIVE. Un lieu proche du bord de
 * l'emprise ne PEUT PAS être centré : le socle sortirait du champ, `sampleDem`
 * clamperait au lieu de boucler, et on verrait des traînées de relief étiré sur
 * tout un bord. On approche au plus près, on ne casse pas la borne. C'est la
 * même course que le geste, pour que « posé » et « glissé » soient la même
 * position et que le rappel élastique n'ait rien à corriger derrière
 * (`poseDansLaCourse` est son point fixe).
 *
 * ⚠️ SECOND PIÈGE — LA CIBLE EST EN COORDONNÉES DE CHAMP, PAS DE GÉOMÉTRIE. Il
 * faut donc la calculer avec `latLonToWorld`, qui divise par `demSpan(dem)` —
 * 168 unités sur une emprise 3×3, pas 56. C'est l'erreur qui s'est déjà glissée
 * TROIS fois sur cette branche (les lieux à un tiers de leur distance, le
 * masque des sommets triplé, l'échelle du cartouche). `test/fenetre-centrage`
 * la prend de face par un aller-retour lat/lon → fenêtre → lat/lon : un
 * `TERRAIN_SIZE` à la place de `demSpan` rate le lieu et se lit en degrés.
 *
 * @param {{x:number,z:number}|null} cible - le point VISÉ, en coordonnées de champ
 * @param {number} course - la demi-course autorisée (unités monde)
 * @returns {{x:number,z:number}} le décalage à écrire dans `terrain.fenetre`
 */
export function fenetreQuiCentre(cible, course) {
  return { x: poseDansLaCourse(cible?.x, course), z: poseDansLaCourse(cible?.z, course) }
}

/**
 * Avance la fenêtre d'un geste, sur les deux axes.
 *
 * ⚠️ L'ORDRE COMPTE : on additionne le geste au BRUT, puis on borne. Borner
 * avant d'additionner perdrait le débordement à chaque image, et l'élastique
 * redeviendrait un arrêt net — le comportement qu'Adrien a précisément écarté.
 *
 * Le brut est rendu à côté de l'affiché : c'est lui que lirait un futur
 * recentrage de l'emprise pour savoir de combien l'utilisateur a voulu aller
 * au-delà. La porte reste ouverte sans qu'on ait rien à réécrire.
 *
 * @param {{x:number,z:number}} brut - position brute de l'image précédente
 * @param {{x:number,z:number}} geste - déplacement de cette image (unités monde)
 * @param {number} course - la demi-course autorisée
 * @returns {{x:number,z:number,brutX:number,brutZ:number}}
 */
export function avanceFenetre(brut, geste, course) {
  const brutX = brut.x + geste.x
  const brutZ = brut.z + geste.z
  return { x: borneElastique(brutX, course), z: borneElastique(brutZ, course), brutX, brutZ }
}
