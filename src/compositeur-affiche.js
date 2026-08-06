// ═══════════════════════════════════════════════════════════════════════════
// LE COMPOSITEUR D'AFFICHE — TOUT CE QUI N'EST PAS LA CARTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Le pavage (export.js) produit LA CARTE, et rien d'autre : `exportImage` et
// `exporteAffichePavee` lisent le canevas WebGL, or le cartouche et le logo
// sont du DOM empilé PAR-DESSUS l'image (ui/affiche.js:135). L'acheteur payait
// 19 € devant une affiche titrée et signée, et recevait une carte nue.
//
// Ce module dessine par-dessus l'image pavée, en canevas 2D, les quatre choses
// qui manquaient — et il les dessine EN FRACTIONS DE LA LARGEUR DE LA FEUILLE,
// exactement comme le CSS de l'écran d'édition, qui est déjà entièrement en
// `cqw` (ui/affiche.css:146, 157, 493).
//
//   ① LE CARTOUCHE — nom du lieu, coordonnées, altitude, et le voile dégradé
//      qui les rend lisibles sur n'importe quel fond.
//   ② LE LOGO de l'acheteur, dans le coin qu'il a choisi.
//   ③ LE VIGNETTAGE ET LE GRAIN, réappliqués UNE FOIS sur l'image entière.
//      La tâche 6 les a laissés actifs faute de pouvoir les réappliquer, et le
//      pavage crie en console : un tirage lancé aujourd'hui sortirait en
//      damier (export-effets.js, catégorie `NEUTRALISER`).
//   ④ L'ATTRIBUTION. `creditFor()` existait et personne ne l'appelait sur le
//      chemin de l'affiche (export.js portait l'avertissement en rouge).
//      Vendre une image sans la mention imposée MOT POUR MOT par les sources
//      bathymétriques est une violation de licence, pas un oubli d'ornement.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LA DÉCISION D'ARCHITECTURE — ET CE N'EST PAS UNE DÉCISION TECHNIQUE
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DERNIER ÉCRAN AVANT PAIEMENT DOIT ÊTRE PRODUIT PAR CE COMPOSITEUR-LÀ,
// RÉDUIT À 1 100 PX. PAS PAR LE DOM.
//
// Le réflexe serait l'inverse : le DOM sait déjà afficher le cartouche, il est
// fluide, il se remet en page tout seul — pourquoi refaire son travail en
// canevas pour un écran de confirmation ? Parce que la question n'est pas
// « qu'est-ce qui est le plus simple à afficher », c'est « QUE VALIDE
// L'ACHETEUR ».
//
//   · Avec le DOM, il valide une MAQUETTE. Le fichier est produit ailleurs,
//     par un autre code, et l'écart entre les deux se combat indéfiniment :
//     une police qui ne tombe pas pareil, un `letter-spacing` qu'un canevas
//     n'applique pas, un dégradé qui n'a pas les mêmes arrêts. Chaque écart
//     découvert se corrige — et le suivant se découvre après un tirage payé.
//   · Avec ce compositeur, il valide LE FICHIER. Le même code, les mêmes
//     fractions, le même dégradé, la même police, à un facteur d'échelle près.
//     L'écart ne se minimise pas : IL CESSE D'EXISTER PAR CONSTRUCTION.
//
// C'est pour cela que toutes les grandeurs de ce module sont des fractions de
// la largeur de la feuille et jamais des pixels : un compositeur en pixels
// aurait fallu re-régler pour chaque taille, et « re-régler » est justement le
// mot qui ramène l'écart.
//
// LE DOM RESTE, et ce n'est pas une concession : pendant l'ÉDITION on tire
// l'image au pouce, on change de format, on tape un titre — trente rendus par
// minute, où la fluidité est ce qui compte et où un écart d'un demi-pour-cent
// sur une ligne de coordonnées n'a aucune conséquence. La règle est donc nette
// et tient en une phrase : LE DOM POUR CHOISIR, LE COMPOSITEUR POUR VALIDER ET
// POUR IMPRIMER.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI EST PUR ICI, ET POURQUOI
// ═══════════════════════════════════════════════════════════════════════════
//
// Tout le CALCUL — les fractions, la boîte de chaque élément, l'échelle du
// grain, le facteur de vignettage, le choix des mentions d'attribution — est
// écrit sans DOM ni canevas, et se teste sous node. Seul le DESSIN demande un
// contexte 2D. C'est ce qui permet au test de fidélité de comparer la mise en
// page du compositeur à celle du CSS sans ouvrir un navigateur.

import { MM_PAR_POUCE } from './print-page.js'
import { echelleGrain } from './export-effets.js'
import { creditFor, EXPORT_CREDIT } from './export.js'

// ═══════════════════════════════════════════════════════════════════════════
// ① LES FRACTIONS — LA MÊME TABLE QUE LE CSS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CES NOMBRES SONT DES `cqw`, RECOPIÉS TELS QUELS DEPUIS ui/affiche.css.
// Un `cqw` vaut 1 % de la largeur du conteneur, et il n'y a ici qu'un seul
// conteneur qui compte : la FEUILLE. `.af-cartouche` déclare bien son propre
// `container-type`, mais il est posé `left: 0; right: 0` sur la feuille — sa
// largeur EST celle de la feuille, donc les `cqw` de ses enfants et ceux de
// son propre `padding` (qui, lui, se résout sur la feuille : un conteneur ne
// s'interroge pas lui-même) mesurent la même chose. Une seule échelle.
//
// ⚠️ ET C'EST LA LARGEUR FINIE, PAS LA LARGEUR RENDUE. Le fichier d'impression
// porte 3 mm de fond perdu sur chaque bord (print-page.js) : de la matière qui
// part au massicot. Ancrer le cartouche sur le bord du fichier le poserait
// 3 mm plus bas que dessiné, et l'attribution — 1,5 % de la hauteur au-dessus
// du bord — partirait carrément à la benne. Tout ce module se repère donc sur
// le RECTANGLE FINI, celui que l'acheteur tiendra dans les mains.
//
// test/compositeur-affiche.test.js relit ui/affiche.css et exige que ces
// nombres soient ceux du CSS. Si l'un des deux dérive, il rougit.

export const CQW_CARTOUCHE = {
  /** `.af-cartouche { padding: 5.5cqw 6cqw 6cqw }` */
  padHaut: 5.5,
  padCote: 6,
  padBas: 6,
  /** `.af-cartouche { gap: 4cqw }` — entre la colonne de gauche et l'altitude */
  gap: 4,
  /** `.af-cart-lieu { font-size: 6.2cqw }` */
  lieu: 6.2,
  /** `.af-cart-sous { font-size: 2.1cqw }` */
  sous: 2.1,
  /** `.af-cart-sous { margin-top: 1.6cqw }` */
  sousMarge: 1.6,
  /** `.af-cart-alt { font-size: 2.1cqw }` */
  alt: 2.1,
}

/** `.af-logo[data-coin] { top/left/right/bottom: 6cqw }` */
export const CQW_LOGO_MARGE = 6

/**
 * Les réglages typographiques du cartouche, eux aussi lus dans le CSS.
 *
 * `interligneLieu` est le `line-height: 1` de `.af-cart-lieu` ; `letterSpacing`
 * est en `em`, comme dans le CSS, et se multiplie donc par la taille de police.
 */
export const TYPO_CARTOUCHE = {
  lieu: { poids: 500, interligne: 1, espacement: -0.03, mono: false },
  sous: { poids: 400, interligne: 1, espacement: 0.14, mono: true, majuscules: true, opacite: 0.72 },
  alt: { poids: 400, interligne: 1, espacement: 0.1, mono: true, opacite: 0.72 },
}

/**
 * Les deux familles, telles que v28.css les déclare (`--ce-font`, `--ce-mono`).
 * Recopiées et non lues à l'exécution : un canevas 2D veut une chaîne de police
 * complète, et `getComputedStyle` n'existe pas sous node — où ce module doit se
 * tester. Le test de fidélité relit v28.css et compare.
 */
export const POLICE_TITRE = "'Bricolage Grotesque', system-ui, sans-serif"
export const POLICE_MONO = "'SF Mono', ui-monospace, Consolas, monospace"

/**
 * Les encres et le voile, lus dans ui/affiche.css.
 *
 * Le voile n'est PAS une coquetterie : les coordonnées tombent parfois sur une
 * zone claire et illisible, et la carte change de valeur d'un lieu à l'autre —
 * on ne peut pas parier sur un fond. Il fait partie de l'affiche imprimée,
 * c'est pour ça qu'il est ici et pas dans un calque d'interface.
 */
export const ENCRES = {
  clair: { texte: '#1c1917', voile: [255, 255, 255], voileAlpha: 0.82 },
  sombre: { texte: '#fafaf9', voile: [12, 10, 9], voileAlpha: 0.72 },
}

/** `.af-cartouche::before { height: 240% }` — 240 % de la hauteur du cartouche. */
export const VOILE_HAUTEUR = 2.4

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE VOILE VA JUSQU'AU BORD DU FICHIER, PAS JUSQU'AU BORD DU FORMAT FINI
// ═══════════════════════════════════════════════════════════════════════════
//
// C'est le défaut le plus grave qu'un tirage réel ait montré, et il se voyait
// sur un angle : un aplat sombre, et une bande turquoise le long de deux bords.
// La mer. La carte brute, réapparue là où on croyait avoir posé un voile.
//
// La cause : le voile était peint sur le RECTANGLE FINI. Tout le reste du
// module s'y repère à raison — un cartouche, un logo, une attribution ne
// doivent JAMAIS entrer dans le fond perdu, ils y seraient coupés. Mais le
// voile n'est pas un élément posé sur l'affiche : c'est un TRAITEMENT DE
// L'IMAGE. Le pavage, lui, prolonge bien la carte dans les 3 mm de fond perdu.
// Résultat : le fond perdu montrait ce qu'il y a DESSOUS au lieu de prolonger
// ce qu'on VOIT.
//
// Conséquence à l'impression : le fond perdu existe pour absorber la dérive du
// massicot. Une dérive de quelques dixièmes de millimètre — normale — faisait
// donc apparaître une bande CLAIRE sur le bord d'une affiche sombre, c'est-à-
// dire exactement le défaut que le fond perdu est censé rendre impossible.
//
// La règle, et elle vaut pour tout ce qui viendrait s'ajouter au compositeur :
//   · CE QUI EST UN OBJET (cartouche, logo, attribution) se repère sur le
//     format fini et n'en sort jamais ;
//   · CE QUI EST UN TRAITEMENT DE L'IMAGE (le voile, le vignettage, le grain)
//     va jusqu'aux bords du FICHIER.
//
// ⚠️ ET LE DÉGRADÉ, LUI, RESTE ANCRÉ SUR LE FORMAT FINI. Étirer ses deux bouts
// jusqu'au bord du fichier aurait décalé le voile de 3 mm à l'intérieur de la
// coupe : l'acheteur aurait validé une affiche et reçu l'autre. On ÉTEND le
// rectangle peint, on ne DÉPLACE pas les arrêts — au-delà du dernier arrêt, un
// dégradé de canevas prolonge la couleur de cet arrêt, ce qui est très
// exactement « prolonger l'image finale ».

// ═══════════════════════════════════════════════════════════════════════════
// ② LE TEXTE DU CARTOUCHE — UNE SEULE SOURCE POUR LES DEUX ÉCRANS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CES DEUX FONCTIONS VIVAIENT DANS ui/affiche.js. Elles sont ici, et
// l'écran d'édition les importe : deux façons d'écrire une latitude, c'est un
// écart entre l'aperçu et le fichier qui ne se voit qu'après la vente. La
// fidélité du TEXTE est donc structurelle, elle n'a pas besoin d'un test.

/**
 * Le sous-titre du cartouche : les coordonnées, dans la forme qu'un cartographe
 * écrirait.
 */
export function coordonneesCartouche(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
  const f = (v, pos, neg) => `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`
  return `${f(lat, 'N', 'S')}  ·  ${f(lon, 'E', 'O')}`
}

/**
 * Les trois lignes du cartouche.
 *
 * @param {{titre?:string, lieu?:{nom?:string, lat?:number, lon?:number, altMax?:number|null}}} o
 * @returns {{lieu:string, sous:string, alt:string}}
 */
export function texteCartouche({ titre = '', lieu = {} } = {}) {
  return {
    lieu: titre || lieu.nom || '',
    sous: coordonneesCartouche(lieu.lat, lieu.lon),
    alt: Number.isFinite(lieu.altMax) ? `${Math.round(lieu.altMax)} m` : '',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ LE RECTANGLE FINI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Le rectangle que l'acheteur tiendra : le fichier moins le fond perdu.
 *
 * @param {{largeur:number, hauteur:number, fondPerduPx?:number}} o
 * @returns {{x:number, y:number, largeur:number, hauteur:number}}
 */
export function zoneFinie({ largeur, hauteur, fondPerduPx = 0 } = {}) {
  const W = Math.max(1, Math.round(largeur || 1))
  const H = Math.max(1, Math.round(hauteur || 1))
  // borné de sorte qu'un fond perdu absurde ne rende jamais un rectangle vide :
  // mieux vaut une affiche mal rognée qu'un cartouche de largeur nulle, qui
  // ferait diverger toutes les fractions d'un coup.
  const f = Math.max(0, Math.min(Math.round(fondPerduPx || 0), Math.floor(Math.min(W, H) / 4)))
  return { x: f, y: f, largeur: W - 2 * f, hauteur: H - 2 * f }
}

/**
 * La densité RÉELLE d'une surface de composition, en dpi.
 *
 * ⚠️ CE N'EST PAS LA DENSITÉ ANNONCÉE. L'écran de validation compose la même
 * affiche à 1 100 px : sa densité vaut quelques dizaines de dpi, pas 300. Le
 * grain s'en déduit (voir plus bas), et prendre 300 pour une vignette y
 * dessinerait des cellules de 2 px là où le papier en demande une fraction.
 *
 * @param {number} largeurPx - la largeur FINIE en pixels
 * @param {number} largeurMm - la même largeur, en millimètres
 * @returns {number|null}
 */
export function densiteEffective(largeurPx, largeurMm) {
  if (!(largeurPx > 0) || !(largeurMm > 0)) return null
  return (largeurPx * MM_PAR_POUCE) / largeurMm
}

// ═══════════════════════════════════════════════════════════════════════════
// ④ L'ÉCHELLE DU GRAIN — ÉTABLIE, PAS DEVINÉE
// ═══════════════════════════════════════════════════════════════════════════
//
// `NoiseEffect` tire un nombre aléatoire PAR PIXEL. À l'écran c'est juste : le
// pixel mesure ~0,25 mm et le grain se voit. Sur un tirage à 300 dpi le pixel
// mesure 0,085 mm — sous le pouvoir séparateur de l'œil à n'importe quelle
// distance de lecture. Le grain par pixel y serait DEUX FOIS perdu : invisible,
// et incompressible (un bruit blanc l'est par construction), donc payé en
// mégaoctets pour rien.
//
// La cellule doit donc mesurer une TAILLE PHYSIQUE. `echelleGrain`
// (export-effets.js) la donne déjà, et son argument est établi : la cellule
// vaut UN PIXEL DE `DPI_PLANCHER` — 150 dpi, soit 0,169 mm, « le premier cran
// en dessous » de ce que l'œil sépare sur une carte lue à 50 cm. À 300 dpi la
// cellule fait 2 × 2 px ; à 200 dpi, 1 × 1 ; sur l'écran de validation à
// 1 100 px, 1 × 1 aussi — c'est-à-dire exactement le grain par pixel de
// l'écran d'édition. Les deux écrans montrent le même grain SANS cas
// particulier : c'est la formule qui les réconcilie.
//
// On ne redéfinit rien ici : une seconde échelle du grain à côté de la
// première ne diverge qu'au tirage.

/**
 * Le côté d'une cellule de grain sur une surface donnée, en pixels de cette
 * surface.
 *
 * @param {{largeurFiniePx:number, largeurMm:number}} o
 * @returns {number|null}
 */
export function echelleGrainSurface({ largeurFiniePx, largeurMm } = {}) {
  const dpi = densiteEffective(largeurFiniePx, largeurMm)
  return dpi === null ? null : echelleGrain(dpi)
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ LES MENTIONS D'ATTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ OBLIGATION DE LICENCE, ET LA SEULE DE CE CHANTIER QUI SE PLAIDE DEVANT UN
// JUGE. `creditFor` (export.js) compose la ligne de base — ODbL pour
// OpenStreetMap, Licence Ouverte pour l'IGN via Mapterhorn, conditions GEBCO —
// et y ajoute les sources bathymétriques FINES qui ont creusé SOUS CETTE
// EMPRISE-LÀ, dont la formulation est imposée mot pour mot (« This data product
// was created by EMODnet… » ne se paraphrase pas). Citer EMODnet sur une carte
// du Japon serait faux ; l'omettre sur une carte de Brest serait une violation.
//
// D'où le passage par `creditsForBounds` plutôt qu'une constante : la liste
// dépend de l'emprise, elle ne peut pas être écrite d'avance.

/**
 * La ligne d'attribution à incruster.
 *
 * ⚠️ NE REND JAMAIS `null` NI UNE CHAÎNE VIDE quand le socle est connu. Un
 * calcul de crédits qui échoue ne doit pas produire une affiche SANS mention —
 * ce serait remplacer une attribution incomplète par une absence
 * d'attribution, c'est-à-dire aggraver la faute pour éviter un warning. On
 * retombe donc sur la ligne de base, qui couvre les sources toujours
 * présentes.
 *
 * @param {{bathyIndex?:object, bounds?:object, creditsForBounds?:function,
 *   base?:string}} o
 * @returns {string}
 */
export function mentionsAffiche({ bathyIndex, bounds, creditsForBounds, base = EXPORT_CREDIT } = {}) {
  if (typeof creditsForBounds !== 'function' || !bounds) return base
  try {
    const ligne = creditFor(bathyIndex, bounds, creditsForBounds)
    return ligne && String(ligne).trim() ? ligne : base
  } catch {
    return base
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE PLAN — LA MISE EN PAGE, EN PIXELS, SANS TOUCHER À UN CANEVAS
// ═══════════════════════════════════════════════════════════════════════════

const cqw = (fraction, largeurFinie) => (fraction / 100) * largeurFinie

/**
 * ⚠️ L'INTERLIGNE DE LA SOUS-LIGNE EST UN CHOIX ASSUMÉ. `.af-cart-sous`
 * n'impose pas de `line-height` : le DOM lui donne le `normal` de la police,
 * qui vaut ~1,2 mais dépend des métriques du fichier de fonte et ne se lit pas
 * sous node. Un canevas 2D, lui, n'a pas de boîte de ligne du tout. On fixe
 * donc la valeur ici, et c'est LE SEUL endroit du module où les deux moteurs
 * peuvent différer — de quelques millièmes de la hauteur de feuille, sur la
 * position verticale d'une ligne de coordonnées. Tout le reste est identique
 * par construction.
 */
export const INTERLIGNE_NORMAL = 1.2

/**
 * La boîte du cartouche et les trois lignes qu'il porte, en pixels.
 *
 * Les repères sont des LIGNES DE BASE, pas des boîtes : c'est la seule grandeur
 * qu'un canevas 2D et un moteur CSS placent de la même façon, et
 * `align-items: baseline` du flex rend l'alignement de l'altitude sur le nom du
 * lieu littéralement exact.
 *
 * @param {{fini:object, textes:object, sombre?:boolean, fichier?:object}} o
 *   `fichier` est le rectangle du FICHIER ENTIER, fond perdu compris ; seul le
 *   voile s'en sert (voir l'encadré ⚠️ au-dessus de `VOILE_HAUTEUR`). Absent,
 *   il retombe sur le rectangle fini — c'est-à-dire sur l'écran de validation,
 *   qui n'a pas de fond perdu du tout.
 * @returns {object|null} `null` si le cartouche n'a rien à dire
 */
export function planCartouche({ fini, textes, sombre = false, fichier = null } = {}) {
  if (!fini || !textes) return null
  const { lieu, sous, alt } = textes
  if (!lieu && !sous && !alt) return null
  const L = fini.largeur
  const padCote = cqw(CQW_CARTOUCHE.padCote, L)
  const padBas = cqw(CQW_CARTOUCHE.padBas, L)
  const padHaut = cqw(CQW_CARTOUCHE.padHaut, L)
  const tailleLieu = cqw(CQW_CARTOUCHE.lieu, L)
  const tailleSous = cqw(CQW_CARTOUCHE.sous, L)
  const tailleAlt = cqw(CQW_CARTOUCHE.alt, L)
  const marge = cqw(CQW_CARTOUCHE.sousMarge, L)

  // Le bas du contenu : le bord fini, moins le `padding-bottom`.
  const basContenu = fini.y + fini.hauteur - padBas
  // La sous-ligne occupe une boîte de `tailleSous * interligne` ; sa ligne de
  // base tombe au-dessus de la demi-descente. `0,5 * (interligne − 1)` est le
  // demi-plomb de la boîte, ce que CSS répartit en haut et en bas.
  const plombSous = ((INTERLIGNE_NORMAL - 1) / 2) * tailleSous
  const hauteurSous = sous ? tailleSous * INTERLIGNE_NORMAL : 0
  // ⚠️ `descente` est approchée par 0,21 em, la valeur des deux familles du
  // projet et de tout ce qui leur ressemble. Le dessin, lui, préfère les
  // métriques VRAIES quand `measureText` les donne — voir `dessinerCartouche`.
  const baseSous = sous ? basContenu - plombSous - 0.21 * tailleSous : null
  // La ligne du lieu a `line-height: 1` : sa boîte fait exactement sa taille.
  const basLieu = sous ? basContenu - hauteurSous - marge : basContenu
  const baseLieu = basLieu - 0.21 * tailleLieu
  // `align-items: baseline` : l'altitude s'aligne sur la ligne de base du lieu,
  // parce que la colonne de gauche prend la ligne de base de son PREMIER bloc.
  const baseAlt = baseLieu

  const hautContenu = basLieu - tailleLieu
  const hauteurBoite = fini.y + fini.hauteur - hautContenu + padHaut
  // Le fichier entier, fond perdu compris. Sans lui — l'écran de validation —
  // c'est le rectangle fini, et rien ne change.
  const fich = fichier || fini
  // Les deux bouts du dégradé, sur le format FINI : ce sont eux qui décident de
  // ce que l'acheteur voit, et ils ne bougent pas d'un pixel.
  const degradeBas = fini.y + fini.hauteur
  // `height: 240%` mesuré depuis le BAS de la boîte (inset: auto 0 0)
  const degradeHaut = degradeBas - hauteurBoite * VOILE_HAUTEUR
  return {
    // la boîte du cartouche : ce que `::before` mesure pour son voile
    boite: { x: fini.x, y: hautContenu - padHaut, largeur: L, hauteur: hauteurBoite },
    voile: {
      // ── LE RECTANGLE PEINT : jusqu'aux bords du FICHIER ──────────────────
      x: fich.x,
      y: degradeHaut,
      largeur: fich.largeur,
      hauteur: fich.y + fich.hauteur - degradeHaut,
      // ── LE DÉGRADÉ : ancré sur le format FINI ────────────────────────────
      degradeHaut,
      degradeBas,
      ...(sombre ? ENCRES.sombre : ENCRES.clair),
    },
    sombre: !!sombre,
    couleur: (sombre ? ENCRES.sombre : ENCRES.clair).texte,
    lieu: lieu
      ? {
          texte: lieu,
          x: fini.x + padCote,
          base: baseLieu,
          taille: tailleLieu,
          espacement: TYPO_CARTOUCHE.lieu.espacement * tailleLieu,
          poids: TYPO_CARTOUCHE.lieu.poids,
          police: POLICE_TITRE,
          opacite: 1,
          alignement: 'left',
        }
      : null,
    sous: sous
      ? {
          texte: TYPO_CARTOUCHE.sous.majuscules ? sous.toUpperCase() : sous,
          x: fini.x + padCote,
          base: baseSous,
          taille: tailleSous,
          espacement: TYPO_CARTOUCHE.sous.espacement * tailleSous,
          poids: TYPO_CARTOUCHE.sous.poids,
          police: POLICE_MONO,
          opacite: TYPO_CARTOUCHE.sous.opacite,
          alignement: 'left',
        }
      : null,
    alt: alt
      ? {
          texte: alt,
          x: fini.x + L - padCote,
          base: baseAlt,
          taille: tailleAlt,
          espacement: TYPO_CARTOUCHE.alt.espacement * tailleAlt,
          poids: TYPO_CARTOUCHE.alt.poids,
          police: POLICE_MONO,
          opacite: TYPO_CARTOUCHE.alt.opacite,
          alignement: 'right',
        }
      : null,
    // la largeur maximale de la colonne de gauche, `gap` compris : au-delà, le
    // flex aurait comprimé. On ne comprime pas, on le SAIT (voir le rapport).
    largeurGauche: L - 2 * padCote - cqw(CQW_CARTOUCHE.gap, L),
  }
}

/** Les quatre coins, tels que `.af-logo[data-coin]` les nomme. */
export const COINS_LOGO = ['hg', 'hd', 'bg', 'bd']

/**
 * La boîte du logo, en pixels.
 *
 * `taille` est la LARGEUR en `cqw` (le curseur de l'écran d'édition, 4 → 26),
 * et la hauteur en découle par le ratio de l'image : c'est `height: auto` du
 * CSS, à la lettre.
 *
 * @param {{fini:object, taille:number, coin:string, ratio:number}} o
 * @returns {{x:number,y:number,largeur:number,hauteur:number}|null}
 */
export function planLogo({ fini, taille, coin = 'hg', ratio = 1 } = {}) {
  if (!fini || !(taille > 0) || !(ratio > 0)) return null
  const L = fini.largeur
  const marge = cqw(CQW_LOGO_MARGE, L)
  const largeur = cqw(taille, L)
  const hauteur = largeur / ratio
  const c = COINS_LOGO.includes(coin) ? coin : 'hg'
  const x = c === 'hd' || c === 'bd' ? fini.x + L - marge - largeur : fini.x + marge
  const y = c === 'bg' || c === 'bd' ? fini.y + fini.hauteur - marge - hauteur : fini.y + marge
  return { x, y, largeur, hauteur, coin: c }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ L'ATTRIBUTION — LA GÉOMÉTRIE DE `stampCredit`, ET SES DEUX CORRECTIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// `stampCredit` (export.js) posait la ligne à `height * 0,009`, en bas à
// droite, blanc translucide sur ombre portée. On garde sa proportion : elle est
// juste, elle est discrète, et elle a servi. Deux choses changent, et les deux
// sont des défauts qu'un tirage aurait révélés.
//
//   ① ELLE SE REPÈRE SUR LE RECTANGLE FINI. À 1,5 % de la hauteur du bord du
//      FICHIER, la mention tombe dans les 3 mm de fond perdu — elle part au
//      massicot, et l'affiche vendue n'a plus d'attribution du tout.
//   ② SON ENCRE SUIT LE CARTOUCHE. Blanc à 72 % sur le voile blanc à 82 % du
//      cartouche, la ligne est INVISIBLE : on aurait cru l'avoir incrustée. Là
//      où le voile règne, on prend l'encre du cartouche ; sans cartouche, on
//      reprend exactement le blanc-sur-ombre de `stampCredit`, qui tient sur un
//      fond clair comme sur un fond sombre.

export const ATTRIBUTION_FRACTION_HAUTEUR = 0.009
export const ATTRIBUTION_PX_MIN = 11
export const ATTRIBUTION_PAD_EM = 1.6
export const ATTRIBUTION_OPACITE = 0.72

/**
 * @param {{fini:object, texte:string, cartouche?:boolean, sombre?:boolean}} o
 * @returns {object|null}
 */
export function planAttribution({ fini, texte, cartouche = false, sombre = false } = {}) {
  if (!fini || !texte) return null
  const taille = Math.max(ATTRIBUTION_PX_MIN, Math.round(fini.hauteur * ATTRIBUTION_FRACTION_HAUTEUR))
  const pad = Math.round(taille * ATTRIBUTION_PAD_EM)
  return {
    texte,
    x: fini.x + fini.largeur - pad,
    base: fini.y + fini.hauteur - pad,
    taille,
    alignement: 'right',
    opacite: ATTRIBUTION_OPACITE,
    // sur le voile du cartouche, l'encre du cartouche ; sinon celle d'origine
    couleur: cartouche ? (sombre ? ENCRES.sombre : ENCRES.clair).texte : '#ffffff',
    ombre: cartouche ? 0 : taille * 0.6,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑧ LE VIGNETTAGE ET LE GRAIN — RÉAPPLIQUÉS, PAS IMITÉS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ LES DEUX SE CALCULENT EN LUMIÈRE LINÉAIRE, ET CE N'EST PAS UN RAFFINEMENT.
// Sur le GPU, la chaîne d'effets travaille dans l'espace de travail linéaire de
// three et l'encodage sRVB n'a lieu qu'à la toute fin, dans la dernière passe.
// Un canevas 2D, lui, contient des octets DÉJÀ encodés en sRVB. Multiplier
// directement ces octets par le facteur de vignettage donnerait une image
// visiblement différente de celle validée à l'écran — plus claire dans les
// coins, parce que la courbe sRVB relève les valeurs basses. On décode, on
// applique, on ré-encode. Une seule constante commande ce choix, pour qu'il
// puisse se démentir en un endroit s'il se révélait faux un jour.
export const EFFETS_EN_LINEAIRE = true

/**
 * Le facteur de vignettage en un point, transcrit de `vignette.frag`
 * (postprocessing 6.36.4, technique DEFAULT — celle de `new VignetteEffect`
 * dans main.js) :
 *
 *   float d = distance(uv, center);
 *   color *= smoothstep(0.8, offset * 0.799, d * (darkness + offset));
 *
 * ⚠️ `smoothstep` EST APPELÉ AVEC SES BORNES DANS LE DÉSORDRE (0,8 puis
 * ~0,22) : la spécification GLSL laisse ce cas indéfini, mais toutes les
 * implémentations réelles évaluent la formule de clamp ci-dessous, et c'est
 * l'image que l'acheteur a validée. On transcrit ce qui S'AFFICHE, pas ce que
 * la spécification garantit.
 *
 * ⚠️ `uv` COURT DE 0 À 1 SUR LA CIBLE, sans correction d'aspect : la distance
 * est donc calculée dans un carré, pas sur le papier. Un vignettage
 * « circulaire » sur un 50 × 70 est en réalité elliptique — c'est exactement
 * ce que l'écran montre, et c'est donc exactement ce qu'il faut reproduire.
 *
 * @param {number} u @param {number} v - dans [0, 1] sur le rectangle FINI
 * @param {{darkness:number, offset:number}} o
 * @returns {number} un facteur multiplicatif dans [0, 1]
 */
export function facteurVignettage(u, v, { darkness = 0.5, offset = 0.5 } = {}) {
  const d = Math.hypot(u - 0.5, v - 0.5)
  const x = d * (darkness + offset)
  const b0 = 0.8
  const b1 = offset * 0.799
  if (b0 === b1) return x < b0 ? 1 : 0
  const t = Math.min(1, Math.max(0, (x - b0) / (b1 - b0)))
  return t * t * (3 - 2 * t)
}

/**
 * Le mélange OVERLAY de `overlay.frag`, celui que main.js donne au grain
 * (`new NoiseEffect({ blendFunction: BlendFunction.OVERLAY })`) :
 *
 *   a = 2·src·dst ; b = 1 − 2·(1 − src)·(1 − dst) ; c = dst < 0,5 ? a : b
 *   sortie = mix(dst, c, opacité)
 *
 * @param {number} fond - la couleur en place, dans [0, 1]
 * @param {number} grain - la valeur de bruit, dans [0, 1]
 * @param {number} opacite
 * @returns {number}
 */
export function melangeOverlay(fond, grain, opacite) {
  const a = 2 * grain * fond
  const b = 1 - 2 * (1 - grain) * (1 - fond)
  const c = fond < 0.5 ? a : b
  return fond + (c - fond) * opacite
}

/** sRVB → linéaire, la transformation exacte de la spécification. */
export function srgbVersLineaire(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** linéaire → sRVB. */
export function lineaireVersSrgb(c) {
  const x = c <= 0 ? 0 : c >= 1 ? 1 : c
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

/**
 * La valeur de grain d'une cellule.
 *
 * ⚠️ SANS ÉTAT ET SANS SEMENCE MUTABLE : la valeur ne dépend que des indices de
 * la cellule. Recomposer une bande deux fois — ce qui arrive dès qu'on relance
 * un tirage — redonne exactement le même grain, et une bande ne peut pas
 * hériter du générateur de la précédente. Un `Math.random()` ici aurait produit
 * une affiche différente à chaque essai, donc impossible à comparer à quoi que
 * ce soit.
 *
 * @returns {number} dans [0, 1)
 */
export function bruitCellule(i, j, graine = 0) {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(graine | 0, 0x9e3779b1)) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491) >>> 0
  h ^= h >>> 13
  return (h >>> 8) / 0x1000000
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑨ LE PLAN COMPLET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tout ce qu'il faut dessiner sur une affiche, en pixels du fichier.
 *
 * @param {object} o
 * @param {number} o.largeur @param {number} o.hauteur - le fichier ENTIER
 * @param {number} [o.fondPerduPx]
 * @param {number} [o.largeurMm] - la largeur FINIE en mm ; sans elle, pas de
 *   densité effective, donc pas de grain (on ne devine pas une échelle)
 * @param {object} [o.cartouche] - `{ actif, sombre, titre, lieu }`
 * @param {object} [o.logo] - `{ taille, coin, ratio }`
 * @param {number} [o.vignette] - `params.vignette` (darkness)
 * @param {number} [o.vignetteOffset] - `0.28` dans main.js
 * @param {number} [o.grain] - `params.grain` (l'opacité du mélange)
 * @param {string} [o.attribution] - la sortie de `mentionsAffiche`
 * @returns {object}
 */
export function planComposition({
  largeur,
  hauteur,
  fondPerduPx = 0,
  largeurMm = null,
  cartouche = null,
  logo = null,
  vignette = 0,
  vignetteOffset = 0.28,
  grain = 0,
  grainGraine = 0,
  attribution = null,
} = {}) {
  const fini = zoneFinie({ largeur, hauteur, fondPerduPx })
  // Le FICHIER, fond perdu compris. Seul le voile s'en sert : c'est un
  // traitement de l'image, pas un objet posé dessus (encadré ⚠️ § ①).
  const fichier = {
    x: 0,
    y: 0,
    largeur: Math.max(1, Math.round(largeur || 1)),
    hauteur: Math.max(1, Math.round(hauteur || 1)),
  }
  const textes = cartouche?.actif === false ? null : cartouche ? texteCartouche(cartouche) : null
  const cart = textes ? planCartouche({ fini, textes, sombre: !!cartouche.sombre, fichier }) : null
  const lg = logo ? planLogo({ fini, ...logo }) : null
  const cell = largeurMm ? echelleGrainSurface({ largeurFiniePx: fini.largeur, largeurMm }) : null
  return {
    largeur: fichier.largeur,
    hauteur: fichier.hauteur,
    fini,
    fichier,
    cartouche: cart,
    logo: lg,
    attribution: planAttribution({
      fini,
      texte: attribution,
      cartouche: !!cart,
      sombre: !!cartouche?.sombre,
    }),
    // ⚠️ ON NE RÉAPPLIQUE QUE CE QUI A ÉTÉ ÉTEINT. `planPavage` ne neutralise
    // le vignettage que s'il est allumé (export-effets.js) : le réappliquer à
    // zéro serait une invention, et le réappliquer par-dessus une image qui le
    // porte déjà le doublerait.
    vignettage: vignette > 0 ? { darkness: vignette, offset: vignetteOffset } : null,
    grain: grain > 0 && cell ? { opacite: grain, cellulePx: cell, graine: grainGraine } : null,
    densiteDpi: largeurMm ? densiteEffective(fini.largeur, largeurMm) : null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑩ LE DESSIN
// ═══════════════════════════════════════════════════════════════════════════
//
// À partir d'ici il faut un contexte 2D. Tout ce qui précède est pur, et c'est
// là que porte la preuve de fidélité.

/**
 * Attendre que les polices soient prêtes.
 *
 * ⚠️ SANS ÇA, LE PREMIER RENDU SORT EN POLICE DE REPLI. Un canevas ne
 * « rerend » pas quand une fonte arrive : il a déjà peint. Le cartouche partait
 * donc à l'impression en system-ui pendant que l'écran, lui, montrait
 * Bricolage Grotesque. `document.fonts.load` force le chargement des DEUX
 * tailles utilisées, parce que `fonts.ready` ne promet que ce qui a été
 * demandé.
 */
export async function attendrePolices(plan) {
  const f = globalThis.document?.fonts
  if (!f) return
  const demandes = []
  for (const ligne of [plan?.cartouche?.lieu, plan?.cartouche?.sous, plan?.cartouche?.alt]) {
    if (!ligne) continue
    try { demandes.push(f.load(`${ligne.poids} ${Math.round(ligne.taille)}px ${ligne.police}`, ligne.texte)) } catch { /* une fonte absente ne bloque pas un tirage */ }
  }
  try { await Promise.all(demandes) } catch { /* idem */ }
  try { await f.ready } catch { /* idem */ }
}

/**
 * Le `letter-spacing` du CSS, sur un canevas.
 *
 * ⚠️ `ctx.letterSpacing` N'EXISTE PAS PARTOUT (Safari ne l'a qu'à partir de
 * 17). Sans repli, la sous-ligne du cartouche — 0,14 em d'interlettrage sur des
 * coordonnées en capitales — sortirait 14 % trop courte, ce qui se voit à côté
 * du nom du lieu. On mesure donc glyphe par glyphe quand la propriété manque.
 *
 * @returns {boolean} vrai si le contexte sait le faire nativement
 */
export function supporteInterlettrage(ctx) {
  if (!ctx || typeof ctx.letterSpacing !== 'string') return false
  const avant = ctx.letterSpacing
  try {
    ctx.letterSpacing = '4px'
    return ctx.letterSpacing === '4px'
  } catch {
    return false
  } finally {
    // la sonde ne doit rien laisser derrière elle : le contexte est partagé
    try { ctx.letterSpacing = avant } catch { /* un contexte qui refuse n'en a pas besoin */ }
  }
}

/** La largeur d'un texte, interlettrage compris, quel que soit le moteur. */
export function largeurTexte(ctx, texte, espacement, natif) {
  if (natif || !espacement) return ctx.measureText(texte).width
  let l = 0
  for (const g of texte) l += ctx.measureText(g).width + espacement
  return l - espacement
}

/**
 * Poser une ligne du plan. `decalage` ramène les coordonnées du fichier entier
 * à celles de la toile courante — une bande, le plus souvent.
 */
export function dessinerLigne(ctx, ligne, { dx = 0, dy = 0, couleur } = {}) {
  if (!ligne?.texte) return
  const natif = supporteInterlettrage(ctx)
  ctx.save()
  ctx.font = `${ligne.poids} ${ligne.taille}px ${ligne.police}`
  if (natif) ctx.letterSpacing = `${ligne.espacement}px`
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = ligne.opacite ?? 1
  ctx.fillStyle = couleur || ligne.couleur || '#000'
  const largeur = largeurTexte(ctx, ligne.texte, ligne.espacement, natif)
  const x0 = ligne.alignement === 'right' ? ligne.x - dx - largeur : ligne.x - dx
  const y = ligne.base - dy
  if (natif) {
    // `textAlign` reste à gauche : on a déjà calculé l'origine, et un canevas
    // qui aligne lui-même ne compte pas l'interlettrage final de la même façon
    // d'un moteur à l'autre.
    ctx.textAlign = 'left'
    ctx.fillText(ligne.texte, x0, y)
  } else {
    let x = x0
    for (const g of ligne.texte) {
      ctx.fillText(g, x, y)
      x += ctx.measureText(g).width + ligne.espacement
    }
  }
  ctx.restore()
}

/**
 * Le voile dégradé du `::before`, en `createLinearGradient`.
 *
 * ⚠️ LE RECTANGLE PEINT ET LES BOUTS DU DÉGRADÉ SONT DEUX CHOSES DIFFÉRENTES,
 * et c'est ce qui règle le défaut du fond perdu. Le rectangle va jusqu'aux
 * bords du fichier ; les arrêts, eux, restent posés sur le format fini. Sous
 * `degradeBas`, un dégradé de canevas prolonge la couleur de son premier arrêt
 * — le voile à pleine opacité. Le fond perdu prolonge donc l'image FINALE, et
 * non la carte nue qu'il y a dessous.
 */
export function dessinerVoile(ctx, voile, { dx = 0, dy = 0 } = {}) {
  if (!voile) return
  const y0 = voile.y - dy
  // `degradeHaut`/`degradeBas` sont absents des plans d'avant ce correctif :
  // on retombe alors sur le rectangle, ce qui redonne l'ancien comportement.
  const gHaut = (Number.isFinite(voile.degradeHaut) ? voile.degradeHaut : voile.y) - dy
  const gBas = (Number.isFinite(voile.degradeBas) ? voile.degradeBas : voile.y + voile.hauteur) - dy
  // `linear-gradient(to top, opaque, transparent)` : l'opaque est EN BAS.
  const g = ctx.createLinearGradient(0, gBas, 0, gHaut)
  const [r, v, b] = voile.voile
  g.addColorStop(0, `rgba(${r}, ${v}, ${b}, ${voile.voileAlpha})`)
  g.addColorStop(1, `rgba(${r}, ${v}, ${b}, 0)`)
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(voile.x - dx, y0, voile.largeur, voile.hauteur)
  ctx.restore()
}

/** Le cartouche entier : le voile, puis les trois lignes. */
export function dessinerCartouche(ctx, cartouche, decalage = {}) {
  if (!cartouche) return
  dessinerVoile(ctx, cartouche.voile, decalage)
  for (const ligne of [cartouche.lieu, cartouche.sous, cartouche.alt]) {
    dessinerLigne(ctx, ligne, { ...decalage, couleur: cartouche.couleur })
  }
}

/** Le logo, à sa boîte. */
export function dessinerLogo(ctx, boite, image, { dx = 0, dy = 0 } = {}) {
  if (!boite || !image) return
  ctx.drawImage(image, boite.x - dx, boite.y - dy, boite.largeur, boite.hauteur)
}

/** La ligne d'attribution. */
export function dessinerAttribution(ctx, att, { dx = 0, dy = 0 } = {}) {
  if (!att?.texte) return
  ctx.save()
  ctx.font = `${att.taille}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textAlign = att.alignement === 'right' ? 'right' : 'left'
  ctx.textBaseline = 'bottom'
  if (att.ombre > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = att.ombre
  }
  ctx.globalAlpha = att.opacite
  ctx.fillStyle = att.couleur
  ctx.fillText(att.texte, att.x - dx, att.base - dy)
  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────
// La réapplication des effets, tranche par tranche
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ ON NE LIT JAMAIS LA BANDE ENTIÈRE D'UN COUP. Une bande d'A2 paysage fait
// 11,89 Mpx, soit 47,6 Mo d'`ImageData` — à ajouter aux 169 Mo déjà tenus par
// le pavage, sur un appareil qui refuse en silence au-delà de ~16,7 Mpx. On
// travaille donc par tranches de lignes, et le pic reste celui du pavage.

export const TRANCHE_MAX_PX = 2e6

const LUT_DECODE = new Float32Array(256)
for (let i = 0; i < 256; i++) LUT_DECODE[i] = srgbVersLineaire(i / 255)
// L'encodage se fait par table : 16 384 crans de linéaire, soit un pas plus fin
// que celui du sRVB 8 bits jusque dans les noirs. Un `Math.pow` par canal et par
// pixel coûterait des dizaines de secondes sur une affiche de 35 Mpx.
const LUT_ENCODE_N = 16384
const LUT_ENCODE = new Uint8ClampedArray(LUT_ENCODE_N)
for (let i = 0; i < LUT_ENCODE_N; i++) LUT_ENCODE[i] = Math.round(lineaireVersSrgb(i / (LUT_ENCODE_N - 1)) * 255)
const encode = (lin) => LUT_ENCODE[lin <= 0 ? 0 : lin >= 1 ? LUT_ENCODE_N - 1 : (lin * (LUT_ENCODE_N - 1)) | 0]

/**
 * Réappliquer vignettage et grain sur un bloc de pixels, EN COORDONNÉES DU
 * FICHIER ENTIER.
 *
 * ⚠️ C'EST TOUT L'ENJEU : le vignettage et le grain sont des fonctions de la
 * position dans l'AFFICHE. Une bande qui les recalculerait sur elle-même
 * reproduirait exactement le damier que le pavage a produit. On passe donc
 * l'origine de la bande, et une bande de plus ou de moins ne change rien au
 * résultat — ce qui est la définition même de « réappliqué une seule fois ».
 *
 * Fonction pure sur un tableau d'octets RVBA : testable sous node sans canevas.
 *
 * @param {Uint8ClampedArray} pixels - RVBA, `largeur * hauteur * 4`
 * @param {{largeur:number, hauteur:number, x?:number, y?:number}} bloc - `x`/`y`
 *   sont la position du bloc dans le fichier
 * @param {object} plan - la sortie de `planComposition`
 */
export function reappliquerEffetsPixels(pixels, bloc, plan) {
  const vg = plan?.vignettage
  const gr = plan?.grain
  if (!vg && !gr) return pixels
  const fini = plan.fini
  const { largeur: w, hauteur: h, x: bx = 0, y: by = 0 } = bloc
  const cell = gr?.cellulePx || 1
  for (let y = 0; y < h; y++) {
    const Y = by + y
    const v = (Y - fini.y) / fini.hauteur
    const jc = Math.floor((Y - fini.y) / cell)
    for (let x = 0; x < w; x++) {
      const X = bx + x
      const p = (y * w + x) * 4
      let r = LUT_DECODE[pixels[p]]
      let g = LUT_DECODE[pixels[p + 1]]
      let b = LUT_DECODE[pixels[p + 2]]
      // ⚠️ L'ORDRE EST CELUI DE LA CHAÎNE : grain PUIS vignettage
      // (`new EffectPass(camera, …, grain, vignette, smaa)`, main.js). Les
      // inverser assombrirait le grain des coins au lieu de l'assombrir avec
      // eux — visible, et faux.
      if (gr) {
        const n = bruitCellule(Math.floor((X - fini.x) / cell), jc, gr.graine)
        r = melangeOverlay(r, n, gr.opacite)
        g = melangeOverlay(g, n, gr.opacite)
        b = melangeOverlay(b, n, gr.opacite)
      }
      if (vg) {
        const f = facteurVignettage((X - fini.x) / fini.largeur, v, vg)
        r *= f
        g *= f
        b *= f
      }
      pixels[p] = encode(r)
      pixels[p + 1] = encode(g)
      pixels[p + 2] = encode(b)
    }
  }
  return pixels
}

/**
 * La même chose sur un contexte 2D, par tranches de lignes.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} plan
 * @param {{x?:number, y?:number, largeur:number, hauteur:number}} toile - la
 *   place de CETTE toile dans le fichier
 */
export function reappliquerEffets(ctx, plan, toile) {
  if (!plan?.vignettage && !plan?.grain) return
  const { x = 0, y = 0, largeur, hauteur } = toile
  const lignes = Math.max(1, Math.floor(TRANCHE_MAX_PX / Math.max(1, largeur)))
  for (let y0 = 0; y0 < hauteur; y0 += lignes) {
    const h = Math.min(lignes, hauteur - y0)
    const img = ctx.getImageData(0, y0, largeur, h)
    reappliquerEffetsPixels(img.data, { largeur, hauteur: h, x, y: y + y0 }, plan)
    ctx.putImageData(img, 0, y0)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑪ COMPOSER — L'ORDRE, ET POURQUOI IL EST CELUI-LÀ
// ═══════════════════════════════════════════════════════════════════════════
//
// ① les effets réappliqués — ils appartiennent à l'IMAGE, la carte les porte
// ② le voile et le cartouche — du DOM empilé PAR-DESSUS l'image à l'écran :
//    le vignettage ne l'assombrit pas, et il ne doit pas l'assombrir ici
// ③ le logo, pour la même raison
// ④ l'attribution en dernier : rien ne doit pouvoir la couvrir

/**
 * Composer une toile — l'affiche entière, ou une bande.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} plan - `planComposition(...)`
 * @param {object} [o]
 * @param {{x?:number,y?:number,largeur:number,hauteur:number}} [o.toile] - la
 *   place de cette toile dans le fichier ; par défaut, le fichier entier
 * @param {*} [o.logo] - une image déjà chargée
 */
export function composerSurToile(ctx, plan, { toile = null, logo = null } = {}) {
  const t = toile || { x: 0, y: 0, largeur: plan.largeur, hauteur: plan.hauteur }
  const dx = t.x || 0
  const dy = t.y || 0
  // ⚠️ ON NE DESSINE QUE CE QUI TRAVERSE LA TOILE, et ce n'est pas qu'une
  // économie. Un canevas rognerait de lui-même — mais il aurait d'abord composé
  // la ligne, mesuré ses glyphes et alloué son dégradé, douze fois pour une
  // affiche qui n'en a besoin qu'une. Surtout, un test peut alors EXIGER que
  // l'attribution appartienne à la bande du bas et à elle seule, au lieu de
  // constater qu'on l'a demandée partout.
  const croise = (y0, y1) => y1 > dy && y0 < dy + t.hauteur
  // ⚠️ LES EFFETS, EUX, TRAVERSENT TOUTE L'AFFICHE : pas de sélection ici.
  reappliquerEffets(ctx, plan, { ...t, x: dx, y: dy })
  const cart = plan.cartouche
  if (cart && croise(cart.voile.y, cart.voile.y + cart.voile.hauteur)) {
    dessinerCartouche(ctx, cart, { dx, dy })
  }
  if (logo && plan.logo && croise(plan.logo.y, plan.logo.y + plan.logo.hauteur)) {
    dessinerLogo(ctx, plan.logo, logo, { dx, dy })
  }
  const att = plan.attribution
  if (att && croise(att.base - att.taille * 1.3, att.base + att.taille * 0.3)) {
    dessinerAttribution(ctx, att, { dx, dy })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑫ L'ÉCRAN DE VALIDATION — 1 100 PX, LE MÊME CODE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La plus grande dimension de l'écran de validation.
 *
 * ⚠️ LE MÊME NOMBRE QUE L'APERÇU D'ÉDITION (`APERCU_MAX_PX`, ui/affiche.js) —
 * assez pour juger un cadrage et une couleur, assez petit pour rester
 * instantané. Il est redéclaré ici et non importé : ui/affiche.js importe une
 * feuille de style, donc ne se charge pas sous node, et ce module doit s'y
 * tester. Le test de fidélité vérifie que les deux valent la même chose.
 */
export const VALIDATION_MAX_PX = 1100

/**
 * La taille de l'écran de validation pour un format donné.
 *
 * ⚠️ IL MONTRE LE FORMAT FINI, PAS LE FICHIER. Le fond perdu est de la matière
 * qui part au massicot : le montrer ferait valider à l'acheteur 6 mm qu'il ne
 * verra jamais, et décalerait le vignettage de tout ce qu'on rogne. On lui
 * montre donc ce qu'il aura entre les mains — et c'est aussi ce que la
 * réduction rend exact : à cette taille, le rectangle fini EST la toile.
 *
 * @param {[number,number]} finiPx
 * @returns {{largeur:number, hauteur:number, echelle:number}}
 */
export function tailleValidation(finiPx, max = VALIDATION_MAX_PX) {
  const [W, H] = finiPx || [1, 1]
  const k = max / Math.max(1, Math.max(W, H))
  return {
    largeur: Math.max(2, Math.round(W * k)),
    hauteur: Math.max(2, Math.round(H * k)),
    echelle: k,
  }
}

/**
 * ═══════════ CE QUE L'ACHETEUR VALIDE ═══════════════════════════════════════
 *
 * Compose l'écran de validation à partir d'une image de carte DÉJÀ RENDUE au
 * format fini, vignettage et grain ÉTEINTS.
 *
 * ⚠️ « ÉTEINTS » N'EST PAS UN DÉTAIL D'APPEL, C'EST LE CONTRAT. Si l'appelant
 * rend la carte avec le vignettage allumé et que ce module le réapplique,
 * l'acheteur valide une affiche DEUX FOIS vignettée, puis reçoit un fichier qui
 * ne l'est qu'une fois. C'est-à-dire, très exactement, l'écart que tout ce
 * module existe pour supprimer. Le tirage, lui, a le même contrat : le pavage
 * neutralise, le compositeur réapplique.
 *
 * @param {object} o
 * @param {*} o.image - la carte rendue (ImageBitmap, HTMLImageElement, canvas)
 * @param {*} o.toile - un `<canvas>` à peindre, déjà à la bonne taille
 * @param {object} o.plan - `planComposition(...)` aux dimensions de la toile
 * @param {*} [o.logo]
 * @returns {Promise<void>}
 */
export async function composerValidation({ image, toile, plan, logo = null }) {
  const ctx = toile.getContext('2d', { alpha: false })
  ctx.drawImage(image, 0, 0, plan.largeur, plan.hauteur)
  await attendrePolices(plan)
  composerSurToile(ctx, plan, { logo })
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑬ LE TIRAGE — LE COMPOSITEUR S'INSÈRE DANS LE PAVAGE PAR SA TOILE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ ON NE TOUCHE PAS À L'ORCHESTRATEUR, ET CE N'EST PAS QU'UNE CONSIGNE.
// `exporteAffichePavee` a une propriété prouvée pixel par pixel — chaque pixel
// écrit une fois et une seule — et trois cents lignes de raisonnement pour la
// tenir. Y glisser un « et aussi, dessine le cartouche » remettrait cette preuve
// en jeu pour une raison qui n'a rien à voir avec le pavage.
//
// Il expose déjà exactement la couture qu'il faut : son support de composition
// est INJECTABLE (c'est ce qui rend sa preuve rejouable sous node). On lui donne
// donc la même toile, augmentée d'un passage avant l'encodage. Le pavage ne sait
// rien du cartouche, et le compositeur ne sait rien des tuiles.
//
// ⚠️ ET LA BANDE SUFFIT, SANS PERTE D'EXACTITUDE. Le vignettage et le grain sont
// des fonctions de la position dans l'AFFICHE, pas dans la bande : une bande
// connaît sa position (`bandesDuPlan` la lui donne), donc `y` suffit à les
// calculer comme s'ils étaient appliqués sur l'image entière. C'est la même
// raison qui interdisait de les laisser au pavage — là, chaque TUILE recevait
// l'effet entier — et qui les autorise ici.

/**
 * Une toile de composition qui compose l'affiche avant d'encoder chaque bande.
 *
 * @param {object} o
 * @param {object} o.plan - `planComposition(...)` aux dimensions du FICHIER
 * @param {*} [o.logo] - une image déjà chargée
 * @param {object} [o.base] - le support à envelopper ; `supportNavigateur` par
 *   défaut, injectable pour le test
 * @returns {{creerToile:function}}
 */
export function supportAffiche({ plan, logo = null, base }) {
  if (!base) throw new Error('supportAffiche : un support de base est requis')
  // La bande n'a que sa hauteur pour se situer : on tient donc le curseur nous-
  // mêmes, dans l'ordre où l'orchestrateur ouvre ses toiles — du haut vers le
  // bas, une par ligne de tuiles, jamais deux à la fois.
  let curseurY = 0
  return {
    creerToile(largeur, hauteur) {
      const y = curseurY
      curseurY += hauteur
      // ⚠️ LE CURSEUR EST UNE HYPOTHÈSE SUR L'ORCHESTRATEUR, donc on la vérifie.
      // S'il ouvrait un jour deux bandes à la fois, ou les rendait dans le
      // désordre, le cartouche atterrirait au mauvais endroit — sans rien
      // casser, et sans que personne ne s'en aperçoive avant un tirage.
      if (curseurY > plan.hauteur) {
        console.warn(
          `[ShibuMap] compositeur : les bandes couvrent ${curseurY} px pour une affiche de ${plan.hauteur} px. `
          + `Le compositeur suppose des bandes ouvertes une par une, du haut vers le bas : `
          + `le cartouche et l'attribution sont probablement mal placés.`
        )
      }
      const toile = base.creerToile(largeur, hauteur)
      const encoder = toile.encoder
      return {
        ...toile,
        poser: (...a) => toile.poser(...a),
        liberer: () => toile.liberer(),
        encoder: (format, quality) => {
          const ctx = toile.contexte2d?.()
          // Sans contexte accessible, on encode la carte nue plutôt que de
          // perdre le tirage — et on le DIT, parce qu'une affiche sans
          // attribution ne doit jamais partir en silence.
          if (!ctx) {
            console.warn(
              '[ShibuMap] compositeur : la toile de composition ne rend pas son contexte 2D, '
              + 'la bande part SANS cartouche ni attribution. Le fichier ne doit pas être vendu tel quel.'
            )
            return encoder(format, quality)
          }
          composerSurToile(ctx, plan, { toile: { x: 0, y, largeur, hauteur }, logo })
          return encoder(format, quality)
        },
      }
    },
    /** Ce que le curseur a couvert — le test s'en sert pour vérifier l'ordre. */
    hauteurCouverte: () => curseurY,
  }
}
