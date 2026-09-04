// ═══════════════════════════════════════════════════════════════════════════
// L'EMBALLAGE PDF D'UNE AFFICHE — LES BOÎTES, LES REPÈRES, LE PROFIL
// ═══════════════════════════════════════════════════════════════════════════
//
// Les tâches 6 à 8 produisent une IMAGE : la carte pavée, recollée bande par
// bande, avec son cartouche, son logo, son grain et son attribution. Ce module
// ne dessine rien de tout cela. Il fait la seule chose qui reste, et que
// personne ne voit tant qu'elle est juste : il dit à l'imprimeur CE QUE CETTE
// IMAGE EST.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'UN PRÉFLIGHT REGARDE EN PREMIER — ET DANS CET ORDRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Un fichier d'impression n'est pas jugé sur son apparence. Il est passé dans
// un contrôle automatique qui, avant même d'ouvrir l'image, lit trois
// rectangles et un dictionnaire :
//
//   ① `TrimBox`  — le FORMAT FINI, exact. C'est la ligne de coupe. Sans elle,
//      un fichier n'est pas un fichier d'impression : le prestataire ne sait
//      pas où massicoter, et il refuse (ou pire, il devine).
//   ② `BleedBox` — TrimBox + le fond perdu, 3 mm. C'est la matière qui part au
//      massicot et qui garantit qu'aucun liseré de papier nu n'apparaît si la
//      lame dérive d'un demi-millimètre.
//   ③ `MediaBox` — la feuille. Elle contient tout le reste, y compris les
//      repères s'il y en a.
//   ④ L'INTENTION DE SORTIE — quel espace de couleur ces octets décrivent.
//
// L'inclusion `MediaBox ⊇ BleedBox ⊇ TrimBox` n'est pas une élégance : un
// BleedBox qui déborde le MediaBox est une erreur de préflight bloquante, et
// c'est l'erreur qu'on fabrique en additionnant des marges au mauvais endroit.
// `verifierBoites` la refuse ici, où elle coûte une exception, plutôt que
// là-bas, où elle coûte une commande.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CE MODULE NE PROUVE PAS LA CONFORMITÉ PDF/X, ET IL NE PEUT PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// AUCUN VALIDATEUR PDF/X LIBRE N'EXISTE. veraPDF, le seul validateur ouvert
// sérieux, ne couvre que PDF/A et PDF/UA. Écrire les bons dictionnaires ne
// prouve pas qu'un préflight professionnel les acceptera — cela prouve
// seulement qu'on a écrit ce que la norme décrit.
//
// Ce qui est écrit ici est donc une INTENTION DE CONFORMITÉ, à valider dans
// Acrobat Pro (voir le rapport de la tâche 9 pour le mode d'emploi). Tant que
// ce préflight-là n'a pas tourné, la formule exacte est : « conforme sous
// réserve du préflight d'Adrien ».
//
// ⚠️ ET GHOSTSCRIPT N'EST PAS UNE SORTIE DE SECOURS. Il sait convertir en
// PDF/X, il est sous AGPL : l'utiliser dans un service en ligne fermé
// obligerait à publier ShibuMap. La question ne se pose pas.
//
// ═══════════════════════════════════════════════════════════════════════════
// MODULE PRESQUE PUR
// ═══════════════════════════════════════════════════════════════════════════
//
// Toute la GÉOMÉTRIE — les boîtes, les repères, le placement des bandes — est
// écrite sans PDF ni DOM et se teste sous node. Seule `construirePdfAffiche`
// a besoin de la bibliothèque, et elle l'importe DYNAMIQUEMENT : le calcul des
// boîtes ne doit pas coûter un mégaoctet de bundle à qui ne fabrique pas de
// PDF.

import { MM_PAR_POUCE, FOND_PERDU_MM } from './print-page.js'

// ═══════════════════════════════════════════════════════════════════════════
// ① L'UNITÉ DU PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Le point PostScript : 1/72 de pouce. C'est l'unité de l'espace utilisateur
 * d'un PDF, et la seule dans laquelle les boîtes s'écrivent.
 *
 * ⚠️ CE N'EST PAS LE POINT TYPOGRAPHIQUE DIDOT (0,376 mm) ni le point pica
 * d'imprimerie. 1 pt = 0,352 777… mm, exactement 25,4/72.
 */
export const PT_PAR_POUCE = 72

/** Millimètres → points PDF. Exact : aucun arrondi, un PDF accepte les réels. */
export function mmVersPt(mm) {
  return (Number.isFinite(mm) ? mm : 0) * (PT_PAR_POUCE / MM_PAR_POUCE)
}

/** Points PDF → millimètres, pour dire au lecteur ce qu'il regarde. */
export function ptVersMm(pt) {
  return (Number.isFinite(pt) ? pt : 0) * (MM_PAR_POUCE / PT_PAR_POUCE)
}

// ═══════════════════════════════════════════════════════════════════════════
// ② LES REPÈRES — DES TRAITS DE COUPE PAR DÉFAUT, ET C'EST UNE DÉCISION
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CETTE DÉCISION A ÉTÉ PRISE DANS L'AUTRE SENS, PUIS RETOURNÉE. Le
// raisonnement d'origine était celui-ci : les prestataires d'impression à la
// commande travaillent AUX BOÎTES — leur imposition lit le TrimBox, place le
// sujet dans un gabarit, et coupe au massicot programmé. Des repères y sont au
// mieux inutiles. D'où « aucun par défaut ».
//
// Il manquait une prémisse : NOUS NE SAVONS PAS CHEZ QUI CE FICHIER VA. Il est
// téléchargé par l'acheteur, pas déposé par nous. Il finit chez un prestataire
// à la commande, ou chez l'imprimeur du coin, ou dans un labo photo — et
// l'asymétrie des deux erreurs n'est pas discutable :
//
//   · DES REPÈRES CHEZ QUI TRAVAILLE AUX BOÎTES : ils vivent au-delà du
//     BleedBox, donc sur la matière qui part au massicot. Ils ne s'impriment
//     jamais sur l'affiche finie. Coût réel : sept millimètres de papier blanc
//     de plus sur chaque bord de la boîte support, et rien d'autre.
//   · PAS DE REPÈRES CHEZ UN IMPRIMEUR CLASSIQUE : il cale sa lame à la main.
//     Il refuse le fichier, ou — bien pire — il devine.
//
// D'où le défaut : LES REPÈRES D'ANGLE (`REPERES_DEFAUT`). Ce n'est pas pour
// autant un dogme : `reperes: REPERES_AUCUN` reste le geste d'un appelant à qui
// un prestataire impose « MediaBox = BleedBox », gabarit à l'appui.
//
// ⚠️ ET CE N'EST PAS UN RÉGLAGE D'INTERFACE, DÉLIBÉRÉMENT. L'acheteur d'une
// affiche ne sait pas ce qu'est un trait de coupe ; une case à cocher qu'il ne
// peut pas juger est pire qu'un fichier qui sert les deux mondes. Le paramètre
// vit ici, dans le module, pour le jour où un prestataire nommé demandera le
// contraire — pas dans l'écran de vente.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE DÉCALAGE, ET LE PROBLÈME DU FOND SOMBRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien s'est plaint de repères invisibles sur une affiche sombre. Ce n'est
// PAS une fatalité du sujet, et ce n'est pas une affaire de couleur de trait :
// c'est une affaire de POSITION.
//
// Un repère qui commence à moins de 3 mm du trait de coupe est posé SUR LE FOND
// PERDU — c'est-à-dire par-dessus l'image, qui déborde justement de ces 3 mm.
// Sur une carte de nuit, un trait noir sur un fond noir ne se voit pas. On
// cherche alors une couleur de repère qui « ressorte », et on n'en trouve
// aucune qui tienne sur toutes les affiches.
//
// La bonne réponse est ailleurs : LES REPÈRES NE VIVENT PAS DANS LE FOND PERDU.
// Ils vivent dans la marge de PAPIER NU au-delà, celle que le MediaBox ajoute
// et que l'image n'atteint jamais. Un décalage ≥ au fond perdu les y pose, et
// un trait noir sur du blanc se voit sur n'importe quelle affiche — la question
// de la couleur ne se pose plus.
//
// `DECALAGE_MM_MIN` est donc un plancher normatif, pas un réglage de goût :
// `planReperes` le fait respecter, quelle que soit la valeur demandée.

/** Aucun repère. La valeur par défaut, et celle des prestataires à la commande. */
export const REPERES_AUCUN = null

/**
 * Le plancher du décalage : le fond perdu. En dessous, le repère retombe sur
 * l'image (voir l'encadré ci-dessus). On ne descend jamais sous cette valeur.
 */
export const DECALAGE_MM_MIN = FOND_PERDU_MM

/** Le décalage par défaut : le fond perdu, plus 1 mm de papier franc. */
export const DECALAGE_MM_DEFAUT = FOND_PERDU_MM + 1

/** La longueur d'un trait de coupe. 5 mm : assez pour viser, assez court pour
 *  ne pas manger la feuille. */
export const LONGUEUR_MM_DEFAUT = 5

/**
 * ⚠️ L'ÉPAISSEUR MAXIMALE, 0,1 mm, N'EST PAS UNE PRÉFÉRENCE ESTHÉTIQUE. Un
 * repère est une CIBLE : il indique une ligne de coupe qui, elle, n'a pas
 * d'épaisseur. Un trait de 0,3 mm laisse à l'opérateur 0,3 mm d'interprétation,
 * qui s'ajoutent à la tolérance du massicot. Au-delà de 0,1 mm le repère cesse
 * d'être plus précis que la coupe qu'il commande.
 */
export const EPAISSEUR_MM_MAX = 0.1

/** L'épaisseur par défaut : le maximum. En dessous, certains RIP le maigrissent
 *  jusqu'à le faire disparaître à l'impression. */
export const EPAISSEUR_MM_DEFAUT = EPAISSEUR_MM_MAX

/** Les repères d'angle, aux valeurs par défaut. */
export const REPERES_COINS = {
  decalageMm: DECALAGE_MM_DEFAUT,
  longueurMm: LONGUEUR_MM_DEFAUT,
  epaisseurMm: EPAISSEUR_MM_DEFAUT,
}

/**
 * Ce qu'on produit quand personne ne dit rien : des traits de coupe.
 *
 * Gelé (`Object.freeze`) parce qu'un défaut partagé qu'un appelant modifierait
 * en place changerait la géométrie de tous les tirages suivants.
 */
export const REPERES_DEFAUT = Object.freeze({ ...REPERES_COINS })

// ═══════════════════════════════════════════════════════════════════════════
// ③ LES BOÎTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ LA MARGE DE FEUILLE N'EST PLUS UNE CONSTANTE, ET C'EST UN DÉFAUT CORRIGÉ.
 *
 * Elle valait 10 mm, tout le temps, repères ou pas. Sur un 50 × 70 cela donnait
 * une MediaBox de 520 × 720 mm — et Photoshop, qui ouvre un PDF à sa MediaBox,
 * annonçait « 520 × 720 » pour une affiche de 50 × 70. Dix millimètres de blanc
 * sur chaque bord, ne portant rien, faussant la lecture des dimensions dans
 * tout logiciel qui ouvre à la boîte support.
 *
 * La marge se DÉDUIT désormais de ce qu'elle doit porter :
 *   · SANS REPÈRE : le fond perdu, et rien de plus. MediaBox = BleedBox. Sur un
 *     50 × 70, la feuille fait 506 × 706 mm, ce qui se lit sans ambiguïté comme
 *     « 50 × 70 plus 3 mm de fond perdu ».
 *   · AVEC REPÈRES : exactement de quoi les porter — décalage + longueur, plus
 *     1 mm de respiration (un repère qui touche le bord de la feuille se fait
 *     rogner par le premier lecteur qui applique une marge d'impression).
 *
 * Aux valeurs par défaut (décalage 4, longueur 5) cela refait 10 mm : la
 * constante d'origine était BIEN DIMENSIONNÉE, elle était seulement VIDE. La
 * différence est qu'aujourd'hui chacun de ces millimètres porte un trait, et
 * qu'un appelant qui change la longueur des repères n'a rien à re-régler.
 */
export const MARGE_MEDIA_SANS_REPERES = FOND_PERDU_MM

/**
 * La marge de feuille qu'une famille de repères réclame — la boîte support
 * « juste ce qu'il faut », ni plus ni moins.
 *
 * @param {object|null} reperes
 * @param {number} [fondPerduMm] - le plancher : sans lui, BleedBox sortirait de
 *   MediaBox, l'erreur de préflight la plus facile à fabriquer
 * @returns {number} en millimètres
 */
export function margeMediaPour(reperes = REPERES_DEFAUT, fondPerduMm = FOND_PERDU_MM) {
  const fond = Math.max(0, Number.isFinite(fondPerduMm) ? fondPerduMm : FOND_PERDU_MM)
  return reperes ? Math.max(fond, besoinMargeReperes(reperes)) : fond
}

/**
 * Les trois boîtes d'une affiche, en points PDF, dans un repère dont l'origine
 * est le coin inférieur gauche de la feuille.
 *
 * Chaque boîte est `[x0, y0, x1, y1]`. Les trois sont CONCENTRIQUES par
 * construction : la marge est la même sur les quatre côtés, et le fond perdu
 * aussi. C'est ce que `verifierBoites` re-vérifie ensuite — non pas par
 * défiance envers ce calcul, mais parce que l'appelant peut fabriquer des
 * boîtes autrement et les faire passer par la même porte.
 *
 * @param {object} o
 * @param {number} o.largeurMm - le format FINI, en millimètres
 * @param {number} o.hauteurMm - idem
 * @param {number} [o.fondPerduMm] - 3 mm ; le plancher normatif de print-page.js
 * @param {number|null} [o.margeMediaMm] - la marge de feuille AU-DELÀ du fond
 *   perdu. `null` — le défaut — la fait DÉDUIRE des repères. Une valeur
 *   explicite est honorée telle quelle (plancher : le fond perdu), quitte à ce
 *   que les repères ne tiennent plus : c'est ainsi qu'on obtient
 *   « MediaBox = BleedBox » chez un prestataire qui l'impose.
 * @param {object|null} [o.reperes] - `REPERES_DEFAUT` ; `REPERES_AUCUN` pour rien
 * @returns {object}
 */
export function boitesAffiche({
  largeurMm,
  hauteurMm,
  fondPerduMm = FOND_PERDU_MM,
  margeMediaMm = null,
  reperes = REPERES_DEFAUT,
} = {}) {
  const L = Number.isFinite(largeurMm) && largeurMm > 0 ? largeurMm : 0
  const H = Number.isFinite(hauteurMm) && hauteurMm > 0 ? hauteurMm : 0
  if (!L || !H) return null
  const fond = Math.max(0, Number.isFinite(fondPerduMm) ? fondPerduMm : FOND_PERDU_MM)
  // ⚠️ UNE MARGE EXPLICITE NE SE FAIT PLUS ÉLARGIR PAR LES REPÈRES. C'était le
  // cas avant, et avec des repères par défaut cela aurait condamné la seule
  // porte de sortie : `margeMediaMm: FOND_PERDU_MM` aurait été remonté à 10 mm
  // par des repères que l'appelant n'avait pas demandés. Qui impose la feuille
  // l'obtient ; les repères qui n'y tiennent pas ne sont pas tracés, et
  // `construirePdfAffiche` le DIT.
  const marge = Number.isFinite(margeMediaMm)
    ? Math.max(fond, margeMediaMm)
    : margeMediaPour(reperes, fond)

  const feuilleMm = [L + 2 * marge, H + 2 * marge]
  const pt = (mm) => mmVersPt(mm)
  const trim = [pt(marge), pt(marge), pt(marge + L), pt(marge + H)]
  const bleed = [pt(marge - fond), pt(marge - fond), pt(marge + L + fond), pt(marge + H + fond)]
  const media = [0, 0, pt(feuilleMm[0]), pt(feuilleMm[1])]
  return {
    mediaBox: media,
    bleedBox: bleed,
    trimBox: trim,
    // les mêmes grandeurs en millimètres, pour le rapport et pour l'interface :
    // personne ne relit des points à la main.
    mm: {
      fini: [L, H],
      fondPerdu: fond,
      marge,
      feuille: feuilleMm,
      avecFondPerdu: [L + 2 * fond, H + 2 * fond],
    },
  }
}

/** Ce qu'une famille de repères réclame comme marge, en millimètres. */
export function besoinMargeReperes(reperes) {
  if (!reperes) return 0
  const dec = Math.max(DECALAGE_MM_MIN, Number.isFinite(reperes.decalageMm) ? reperes.decalageMm : DECALAGE_MM_DEFAUT)
  const lon = Math.max(0, Number.isFinite(reperes.longueurMm) ? reperes.longueurMm : LONGUEUR_MM_DEFAUT)
  // 1 mm de respiration : un repère qui touche le bord de la feuille se fait
  // rogner par le premier lecteur qui applique une marge d'impression.
  return dec + lon + 1
}

/**
 * ⚠️ L'INVARIANT DU PRÉFLIGHT : `MediaBox ⊇ BleedBox ⊇ TrimBox`.
 *
 * Une boîte qui sort de celle qui la contient est une erreur bloquante chez
 * tous les préflights, et c'est l'erreur la plus facile à fabriquer sans s'en
 * apercevoir — il suffit d'additionner une marge du mauvais côté d'un signe.
 * On la refuse ici.
 *
 * @returns {{ok:boolean, erreurs:string[]}}
 */
export function verifierBoites(boites, { toleranceP = 1e-6 } = {}) {
  const erreurs = []
  if (!boites) return { ok: false, erreurs: ['aucune boîte'] }
  const { mediaBox: m, bleedBox: b, trimBox: t } = boites
  const contient = (ext, int, nomExt, nomInt) => {
    if (!ext || !int) { erreurs.push(`${nomExt} ou ${nomInt} manquante`); return }
    if (int[0] < ext[0] - toleranceP || int[1] < ext[1] - toleranceP
      || int[2] > ext[2] + toleranceP || int[3] > ext[3] + toleranceP) {
      erreurs.push(`${nomInt} sort de ${nomExt}`)
    }
  }
  contient(m, b, 'MediaBox', 'BleedBox')
  contient(b, t, 'BleedBox', 'TrimBox')
  const nonVide = (r, nom) => {
    if (!r || !(r[2] > r[0]) || !(r[3] > r[1])) erreurs.push(`${nom} est vide ou inversée`)
  }
  nonVide(m, 'MediaBox'); nonVide(b, 'BleedBox'); nonVide(t, 'TrimBox')
  // Le centrage : les quatre écarts entre TrimBox et MediaBox doivent être
  // égaux. Un fichier décentré s'imprime, se coupe, et arrive de travers.
  if (m && t) {
    const ecarts = [t[0] - m[0], t[1] - m[1], m[2] - t[2], m[3] - t[3]]
    const max = Math.max(...ecarts)
    const min = Math.min(...ecarts)
    if (max - min > 1e-4) erreurs.push('le format fini n’est pas centré sur la feuille')
  }
  return { ok: erreurs.length === 0, erreurs }
}

/**
 * Les segments des repères d'angle, en points, prêts à être tracés.
 *
 * ⚠️ ILS NE TOUCHENT JAMAIS LE TRAIT DE COUPE. Chaque segment part à
 * `decalage` du bord fini et s'éloigne : rien n'est tracé entre le TrimBox et
 * cette distance. C'est ce vide qui les met sur du papier nu (voir l'encadré
 * ② ci-dessus) et qui règle le problème du fond sombre.
 *
 * ⚠️ ET ILS SONT DÉCOUPÉS À LA FEUILLE. Une marge trop étroite — un appelant
 * qui a imposé `margeMediaMm: FOND_PERDU_MM`, par exemple — ne produit pas des
 * traits hors MediaBox (ce qu'un préflight signale) : elle ne produit rien.
 *
 * @param {object} boites - la sortie de `boitesAffiche`
 * @param {object|null} reperes - `{decalageMm, longueurMm, epaisseurMm}`
 * @returns {{segments:Array, epaisseurPt:number, epaisseurMm:number}}
 */
export function planReperes(boites, reperes = REPERES_DEFAUT) {
  const vide = { segments: [], epaisseurPt: 0, epaisseurMm: 0 }
  if (!boites || !reperes) return vide
  const decMm = Math.max(DECALAGE_MM_MIN, Number.isFinite(reperes.decalageMm) ? reperes.decalageMm : DECALAGE_MM_DEFAUT)
  const lonMm = Math.max(0, Number.isFinite(reperes.longueurMm) ? reperes.longueurMm : LONGUEUR_MM_DEFAUT)
  // L'épaisseur est BORNÉE, pas validée : un appelant qui demande 0,5 mm reçoit
  // 0,1 mm et un repère utile, plutôt qu'une exception et pas de repère du tout.
  const epMm = Math.min(EPAISSEUR_MM_MAX, Math.max(0, Number.isFinite(reperes.epaisseurMm) ? reperes.epaisseurMm : EPAISSEUR_MM_DEFAUT))
  if (!(lonMm > 0) || !(epMm > 0)) return vide

  const dec = mmVersPt(decMm)
  const lon = mmVersPt(lonMm)
  const [mx0, my0, mx1, my1] = boites.mediaBox
  const [tx0, ty0, tx1, ty1] = boites.trimBox
  const segments = []
  // Le repère doit tenir ENTIÈREMENT dans la feuille : on ne raccourcit pas, on
  // renonce. Un demi-repère indique une coupe qu'il n'indique pas.
  const dedans = (x0, y0, x1, y1) =>
    Math.min(x0, x1) >= mx0 && Math.min(y0, y1) >= my0 && Math.max(x0, x1) <= mx1 && Math.max(y0, y1) <= my1
  const pousser = (x0, y0, x1, y1) => { if (dedans(x0, y0, x1, y1)) segments.push({ x0, y0, x1, y1 }) }

  for (const [x, sx] of [[tx0, -1], [tx1, 1]]) {
    for (const [y, sy] of [[ty0, -1], [ty1, 1]]) {
      // le trait HORIZONTAL, prolongeant la ligne de coupe haute ou basse
      pousser(x + sx * dec, y, x + sx * (dec + lon), y)
      // le trait VERTICAL, prolongeant la ligne de coupe gauche ou droite
      pousser(x, y + sy * dec, x, y + sy * (dec + lon))
    }
  }
  return { segments, epaisseurPt: mmVersPt(epMm), epaisseurMm: epMm, decalageMm: decMm, longueurMm: lonMm }
}

// ═══════════════════════════════════════════════════════════════════════════
// ④ LE PLACEMENT DES BANDES
// ═══════════════════════════════════════════════════════════════════════════
//
// L'image arrive en BANDES — c'est ce que le pavage produit, et c'est ce qui
// permet de ne jamais tenir l'affiche entière en mémoire (une A2 fait 169 Mo en
// RVBA). Le PDF les reçoit telles quelles : n objets image posés bout à bout
// dans le BleedBox, et le lecteur les recolle.
//
// ⚠️ LE CHEVAUCHEMENT N'EST PAS UNE PRÉCAUTION VAGUE. Deux images qui se
// touchent EXACTEMENT dans un PDF laissent, chez presque tous les moteurs de
// rendu, un cheveu clair sur la jointure : l'anticrénelage du bord bas de l'une
// et du bord haut de l'autre se composent, et aucun des deux ne couvre
// complètement le dernier demi-pixel. C'est la même ligne d'un pixel que
// `planTuiles` combat côté rendu, réapparue à l'étage du dessus.
//
// On donne donc à chaque bande sauf la première un peu de hauteur EN PLUS, vers
// le haut, et on les pose du haut vers le bas : la bande suivante recouvre la
// jointure de la précédente. Le bas de chaque bande reste à sa place exacte —
// donc aucune erreur ne s'accumule — et l'étirement vaut 0,02 mm sur la hauteur
// d'une bande entière, soit un dixième de pixel à 300 dpi.

/** Le chevauchement, en points. 0,06 pt = 0,021 mm ≈ un quart de pixel à 300 dpi. */
export const CHEVAUCHEMENT_PT = 0.06

/**
 * Où poser chaque bande dans le BleedBox.
 *
 * @param {object} boites - la sortie de `boitesAffiche`
 * @param {Array<{hauteurPx:number}>} bandes - du HAUT vers le BAS
 * @returns {Array<{x:number, y:number, largeur:number, hauteur:number, index:number}>}
 */
export function placerBandes(boites, bandes) {
  if (!boites || !Array.isArray(bandes) || !bandes.length) return []
  const [bx0, by0, bx1, by1] = boites.bleedBox
  const largeur = bx1 - bx0
  const hauteur = by1 - by0
  const totalPx = bandes.reduce((s, b) => s + Math.max(0, b.hauteurPx || 0), 0)
  if (!(totalPx > 0)) return []
  const places = []
  let cumulPx = 0
  for (let i = 0; i < bandes.length; i++) {
    const hPx = Math.max(0, bandes[i].hauteurPx || 0)
    // le haut de la bande, en fraction de l'image, mesuré depuis le HAUT
    const hautPt = by1 - (cumulPx / totalPx) * hauteur
    cumulPx += hPx
    const basPt = by1 - (cumulPx / totalPx) * hauteur
    const rallonge = i === 0 ? 0 : CHEVAUCHEMENT_PT
    places.push({
      index: i,
      x: bx0,
      y: basPt,
      largeur,
      hauteur: hautPt - basPt + rallonge,
    })
  }
  return places
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ L'ÉTIQUETAGE — UN sRVB SUPPOSÉ N'EST PAS UN sRVB DÉCLARÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// L'image produite par les tâches 6 à 8 n'est PAS étiquetée : un canevas
// `toBlob('image/png')` n'écrit pas de morceau `iCCP`, et `toBlob('image/jpeg')`
// n'écrit pas de marqueur APP2 ICC. Un fichier sRVB non étiqueté sera SUPPOSÉ
// sRVB par à peu près tout le monde — et c'est vrai, et ça marche, et ce n'est
// pas suffisant.
//
// Une chaîne d'impression ne repose pas sur une supposition. Le RIP du
// prestataire convertit vers son profil papier : s'il ne sait pas d'où il part,
// il applique une hypothèse de son côté, qui n'est pas forcément la nôtre, et
// personne ne peut dire après coup pourquoi les bleus sont partis. On incorpore
// donc le profil, et l'intention de sortie qui le désigne.
//
// ⚠️ LE PROFIL VIENT DE LA BIBLIOTHÈQUE, PAS D'UN FICHIER À NOUS.
// `@cantoo/pdf-lib` embarque le sRGB IEC61966-2.1 de Hewlett-Packard (3 144
// octets, librement redistribuable, celui que Ghostscript, PDFBox et Little CMS
// embarquent aussi). Le fabriquer nous-mêmes aurait produit un profil de plus à
// vérifier, et c'est précisément ce qu'aucun outil libre ne sait vérifier.

/** L'identifiant de la condition de sortie. Il décrit le profil incorporé. */
export const CONDITION_SORTIE = 'sRGB IEC61966-2.1'

/**
 * ⚠️ POURQUOI UNE INTENTION DE SORTIE **RVB** ET NON CMJN.
 *
 * Le réflexe d'impression serait de déclarer un profil presse (FOGRA, SWOP).
 * Mais nous ne convertissons PAS en CMJN : l'affiche est produite en sRVB par
 * un canevas, et une conversion faite ici — sans savoir sur quel papier, avec
 * quelle encre, chez quel prestataire — serait une conversion de MOINS BONNE
 * qualité que celle que le RIP fera avec son propre profil papier. Déclarer un
 * profil presse sans avoir converti serait par ailleurs un mensonge : le
 * préflight le verrait immédiatement (des images RVB dans un fichier à
 * intention CMJN).
 *
 * L'intention de sortie sRVB dit la vérité : « voici de l'sRVB, converti chez
 * vous ». C'est un usage prévu — le registre ICC des conditions de sortie
 * normalisées comprend des entrées sRVB pour cet emploi.
 *
 * ⚠️ SI UN PRESTATAIRE EXIGE UN JOUR DU CMJN : ce n'est pas un réglage à
 * changer ici, c'est une conversion colorimétrique à faire dans le compositeur,
 * avec un profil papier fourni par lui. Et alors seulement il faudra lire
 * l'avertissement suivant.
 *
 * ⚠️⚠️ ET CE JOUR-LÀ, ATTENTION AU JPEG CMJN. `pdf-lib` applique
 * INCONDITIONNELLEMENT un `Decode [1 0 1 0 1 0 1 0]` aux images JPEG à quatre
 * canaux (JpegEmbedder.js — c'est la convention Adobe, qui écrit les JPEG CMJN
 * inversés). Un encodeur non conforme à cette convention produirait une affiche
 * EN NÉGATIF, sans le moindre avertissement, et le défaut ne se verrait qu'au
 * tirage. Vérifier sur une épreuve avant d'encaisser quoi que ce soit.
 *
 * ⚠️ `INTENTION_RVB = true` vivait ici et n'était lue par personne : retirée le
 * 2026-09-04. L'intention de sortie reste écrite là où elle s'applique ; ce
 * bloc garde l'explication, qui elle sert.
 */
/** Le sous-type d'intention de sortie qui distingue PDF/X de PDF/A. */
export const SOUS_TYPE_PDFX = 'GTS_PDFX'

/** La version visée. Elle s'écrit dans les métadonnées XMP, pas dans l'Info. */
export const VERSION_PDFX = 'PDF/X-4'

const echapperXml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Le paquet XMP d'un PDF/X-4.
 *
 * ⚠️ `GTS_PDFXVersion` N'EST ÉCRIT QUE LÀ. PDF/X-1a et X-3 le portaient dans le
 * dictionnaire d'information ; depuis X-4 c'est le XMP qui fait foi, et c'est
 * lui qu'Acrobat lit. Le dupliquer dans l'Info n'aiderait aucun contrôle
 * moderne et donnerait deux vérités à garder d'accord.
 *
 * ⚠️ `pdf:Trapped` DOIT VALOIR `True` OU `False`, JAMAIS `Unknown`. C'est une
 * exigence explicite de PDF/X, et c'est l'oubli le plus banal : « Unknown » est
 * la valeur par défaut de beaucoup de producteurs, et elle fait échouer le
 * contrôle sur un fichier par ailleurs impeccable. Nous ne faisons pas de
 * recouvrement d'encre : `False`.
 *
 * ⚠️ ET LES CHAMPS DOIVENT ÉGALER CEUX DE L'INFO. Un `dc:title` qui ne dit pas
 * la même chose que `/Title` est signalé. `construirePdfAffiche` les écrit
 * depuis les mêmes variables, à la même seconde.
 */
export function metadonneesXmp({
  titre = '',
  auteur = '',
  producteur = '',
  outil = '',
  date = new Date(),
  versionPdfx = VERSION_PDFX,
} = {}) {
  const iso = (date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()).toISOString()
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
      <pdfxid:GTS_PDFXVersion>${echapperXml(versionPdfx)}</pdfxid:GTS_PDFXVersion>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${echapperXml(titre)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${echapperXml(auteur)}</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${echapperXml(outil)}</xmp:CreatorTool>
      <xmp:CreateDate>${iso}</xmp:CreateDate>
      <xmp:ModifyDate>${iso}</xmp:ModifyDate>
      <xmp:MetadataDate>${iso}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${echapperXml(producteur)}</pdf:Producer>
      <pdf:Trapped>False</pdf:Trapped>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE POIDS — ET POURQUOI LE PNG EST LE MAUVAIS CHOIX ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// Une affiche pèse 21 à 89 Mo en PNG, et le grain triple ce chiffre : un bruit
// blanc est incompressible par construction, c'est même sa définition. Le
// premier réflexe serait de se dire qu'un PDF n'y changera rien puisqu'il ne
// fait qu'emballer. C'est faux, et dans le mauvais sens.
//
//   · UN JPEG EST RECOPIÉ TEL QUEL. `JpegEmbedder` pose les octets du fichier
//     dans un flux `DCTDecode` sans les toucher. Le PDF pèse donc la somme des
//     JPEG, plus ~6 ko de structure et de profil. Coût de l'emballage :
//     négligeable.
//
//   · UN PNG EST DÉCODÉ PUIS RECOMPRESSÉ — ET IL GROSSIT. `PngEmbedder` extrait
//     `rgbChannel`, c'est-à-dire les pixels BRUTS, et les repasse dans un flux
//     `FlateDecode` SANS PRÉDICTEUR. Or tout le travail d'un PNG est dans ses
//     filtres de ligne (Sub, Up, Paeth) : les retirer, c'est demander à zlib de
//     compresser une image sans aucune décorrélation. Sur une carte en ton
//     continu, le flux obtenu est couramment 1,5 à 3 fois plus lourd que le PNG
//     d'origine. Un PDF de 89 Mo de PNG peut en peser 200.
//
//   · ET LA MÉMOIRE SUIT LE MÊME CHEMIN. Décoder un PNG d'A2 alloue 169 Mo de
//     RVBA d'un coup, dans le navigateur, juste après un pavage qui vient de
//     passer une demi-minute à ne JAMAIS les allouer.
//
// D'où `FORMAT_RECOMMANDE`. Ce n'est pas un arbitrage entre qualité et poids :
// c'est le seul chemin qui n'annule pas le travail du pavage.

/** Le format d'encodage des bandes destinées au PDF. */
export const FORMAT_RECOMMANDE = 'image/jpeg'

/**
 * La qualité JPEG du tirage.
 *
 * ⚠️ 0,94 ET NON 0,8. Le sujet est une carte : des traits fins, des lettres de
 * cartouche, des aplats de mer. Ce sont exactement les contenus où les artefacts
 * de bloc du JPEG se voient, et à 300 dpi on les voit à l'œil nu sur le papier
 * parce qu'un bloc de 8 px y mesure 0,68 mm. Au-dessus de 0,95 le fichier
 * regrossit vite sans gain visible ; en dessous de 0,9 le grain fait apparaître
 * du fourmillement autour des textes.
 */
export const QUALITE_JPEG_TIRAGE = 0.94

/**
 * Ce que la structure du PDF ajoute pour UNE bande : profil ICC (3 144 o), XMP
 * (~1,2 ko), catalogue, page, flux de contenu, table des références. Mesuré à
 * 6 353 o sur un 50 × 70 à une bande ; arrondi au-dessus.
 */
export const SURCOUT_STRUCTURE_OCTETS = 6500

/** Ce que chaque bande supplémentaire coûte : un objet image, une entrée de
 *  ressource, quatre lignes de flux de contenu. Mesuré à ~235 o. */
export const SURCOUT_PAR_BANDE_OCTETS = 250

/**
 * Le poids attendu d'un PDF dont les bandes sont des JPEG.
 *
 * ⚠️ NE VAUT QUE POUR LE JPEG. Pour du PNG, le poids du PDF ne se déduit PAS de
 * celui des bandes (voir l'encadré ci-dessus) : la fonction rend `null` plutôt
 * qu'un nombre faux.
 */
export function poidsPdfAttendu({ octetsBandes = 0, bandes = 1, type = FORMAT_RECOMMANDE } = {}) {
  if (type !== 'image/jpeg') return null
  const n = Math.max(1, Math.round(bandes) || 1)
  return Math.max(0, Math.round(octetsBandes)) + SURCOUT_STRUCTURE_OCTETS + (n - 1) * SURCOUT_PAR_BANDE_OCTETS
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ LE NOM DU FICHIER — CE QUI RESTE QUAND TOUT LE RESTE EST OUBLIÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Le fichier finit dans un dossier de téléchargements, puis dans une pièce
// jointe, puis chez un imprimeur qui en reçoit trente par jour. Son nom est la
// seule chose qui l'accompagne : il doit dire le lieu, le format et la densité,
// et ne contenir que ce qu'un système de fichiers, un serveur de courrier et un
// formulaire de téléversement acceptent tous les trois.
//
// ⚠️ D'OÙ L'ASCII, ET CE N'EST PAS UN RENONCEMENT ESTHÉTIQUE. « Chamonix-Mont-
// Blanc » est un nom français ordinaire ; les accents et les apostrophes
// typographiques traversent mal les en-têtes `Content-Disposition` et certains
// dépôts FTP d'imprimeurs. On translittère une fois, ici, plutôt que de
// découvrir un « Ann_cy.pdf » chez le prestataire.

const ACCENTS_HORS = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Le nom du fichier livré, sans extension imposée par l'appelant.
 *
 * @param {object} o
 * @param {string} [o.titre] - le nom imprimé sur l'affiche
 * @param {string} [o.format] - `50x70`, `a2`…
 * @param {string} [o.orientation] @param {number} [o.dpi]
 * @returns {string} par exemple `shibumap-annecy-50x70-paysage-250dpi.pdf`
 */
export function nomFichierAffiche({ titre = '', format = '', orientation = '', dpi = 0 } = {}) {
  const lisse = ACCENTS_HORS(titre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Un nom de lieu très long ne doit pas produire un nom de fichier que
    // certains systèmes tronquent au milieu d'un mot.
    .slice(0, 48)
    .replace(/-+$/g, '')
  const bouts = ['shibumap', lisse || 'affiche']
  if (format) bouts.push(ACCENTS_HORS(format).toLowerCase().replace(/[^a-z0-9]+/g, ''))
  if (orientation) bouts.push(orientation === 'portrait' ? 'portrait' : 'paysage')
  if (Number.isFinite(dpi) && dpi > 0) bouts.push(`${Math.round(dpi)}dpi`)
  return `${bouts.join('-')}.pdf`
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑧ LA CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emballer une affiche déjà rendue dans un PDF prêt pour l'impression.
 *
 * @param {object} o
 * @param {number} o.largeurMm - le format FINI
 * @param {number} o.hauteurMm - idem
 * @param {number} [o.fondPerduMm]
 * @param {number|null} [o.margeMediaMm] - `null` : déduite des repères
 * @param {object|null} [o.reperes] - `REPERES_DEFAUT` par défaut
 * @param {Array<{octets:Uint8Array, type:string, hauteurPx:number}>} o.bandes -
 *   du HAUT vers le BAS, telles que le pavage les produit. Une seule entrée est
 *   le cas nominal quand la mémoire le permet : pas de jointure du tout.
 * @param {string} [o.titre] @param {string} [o.auteur]
 * @param {string} [o.producteur] @param {string} [o.outil]
 * @param {Date} [o.date] - injectable, pour que le test soit reproductible
 * @returns {Promise<{octets:Uint8Array, boites:object, reperes:object, pages:number}>}
 */
export async function construirePdfAffiche({
  largeurMm,
  hauteurMm,
  fondPerduMm = FOND_PERDU_MM,
  margeMediaMm = null,
  reperes = REPERES_DEFAUT,
  bandes,
  titre = 'Affiche ShibuMap',
  auteur = 'ShibuMap',
  producteur = 'ShibuMap',
  outil = 'ShibuMap',
  date = new Date(),
} = {}) {
  if (!Array.isArray(bandes) || !bandes.length) throw new Error('pdf-affiche : aucune bande à emballer')
  const boites = boitesAffiche({ largeurMm, hauteurMm, fondPerduMm, margeMediaMm, reperes })
  if (!boites) throw new Error('pdf-affiche : format invalide')
  const controle = verifierBoites(boites)
  // ⚠️ ON REFUSE, ON NE CORRIGE PAS. Une boîte incohérente est une erreur de
  // l'appelant sur une grandeur physique : la « rattraper » ici produirait un
  // fichier qui s'imprime, au mauvais format, sans que personne ne l'ait su.
  if (!controle.ok) throw new Error(`pdf-affiche : boîtes incohérentes — ${controle.erreurs.join(' ; ')}`)

  // ⚠️ IMPORT DYNAMIQUE. La bibliothèque pèse plusieurs centaines de kilo-octets
  // et ne sert qu'ici : la charger au premier `import` de ce module la mettrait
  // dans le bundle de démarrage de la carte, pour un chemin que la plupart des
  // visiteurs n'empruntent jamais.
  const { PDFDocument, PDFHeader, PDFName, PDFString, PDFHexString, getDefaultSRGBProfile, rgb }
    = await import('@cantoo/pdf-lib')

  const doc = await PDFDocument.create({ updateMetadata: false })
  // PDF/X-4 se fonde sur PDF 1.6. Un en-tête 1.7 (le défaut de la bibliothèque)
  // est signalé par les contrôles stricts.
  doc.context.header = PDFHeader.forVersion(1, 6)

  const page = doc.addPage([boites.mediaBox[2], boites.mediaBox[3]])
  page.setMediaBox(boites.mediaBox[0], boites.mediaBox[1], boites.mediaBox[2] - boites.mediaBox[0], boites.mediaBox[3] - boites.mediaBox[1])
  page.setBleedBox(boites.bleedBox[0], boites.bleedBox[1], boites.bleedBox[2] - boites.bleedBox[0], boites.bleedBox[3] - boites.bleedBox[1])
  page.setTrimBox(boites.trimBox[0], boites.trimBox[1], boites.trimBox[2] - boites.trimBox[0], boites.trimBox[3] - boites.trimBox[1])
  // ⚠️ PAS D'ArtBox. PDF/X interdit qu'une page porte À LA FOIS un TrimBox et un
  // ArtBox : il faut choisir, et pour une affiche c'est le TrimBox.

  // ── les bandes ────────────────────────────────────────────────────────────
  const places = placerBandes(boites, bandes)
  let octetsImages = 0
  let pngVu = false
  for (let i = 0; i < bandes.length; i++) {
    const b = bandes[i]
    const p = places[i]
    if (!b?.octets?.length || !p) continue
    octetsImages += b.octets.length
    const png = b.type === 'image/png'
    pngVu = pngVu || png
    const img = png ? await doc.embedPng(b.octets) : await doc.embedJpg(b.octets)
    page.drawImage(img, { x: p.x, y: p.y, width: p.largeur, height: p.hauteur })
  }
  if (pngVu) {
    console.warn(
      '[ShibuMap] pdf-affiche : au moins une bande est en PNG. pdf-lib la décode entièrement en mémoire '
      + 'puis la recompresse SANS prédicteur de ligne : le PDF sera plus lourd que les PNG d’origine, '
      + `et le pic mémoire dépassera celui du pavage. Encoder les bandes en ${FORMAT_RECOMMANDE} `
      + `(qualité ${QUALITE_JPEG_TIRAGE}) — voir FORMAT_RECOMMANDE.`
    )
  }

  // ── les repères ───────────────────────────────────────────────────────────
  const rep = planReperes(boites, reperes)
  // ⚠️ DES REPÈRES DEMANDÉS QUI NE SORTENT PAS NE DOIVENT PAS DISPARAÎTRE EN
  // SILENCE. Le seul cas où cela arrive est une marge de feuille imposée trop
  // étroite — et c'est justement le cas où l'appelant croit savoir ce qu'il
  // fait. `planReperes` renonce plutôt que de tracer des demi-traits ; on le dit.
  if (reperes && !rep.segments.length) {
    console.warn(
      '[ShibuMap] pdf-affiche : des repères de coupe ont été demandés mais AUCUN n’a été tracé. '
      + `La marge de feuille vaut ${boites.mm.marge} mm, il en faudrait ${besoinMargeReperes(reperes)}. `
      + 'Laisser `margeMediaMm` à null la déduit des repères ; la fixer, c’est y renoncer.'
    )
  }
  for (const s of rep.segments) {
    page.drawLine({
      start: { x: s.x0, y: s.y0 },
      end: { x: s.x1, y: s.y1 },
      thickness: rep.epaisseurPt,
      // Noir plein. En RVB, et c'est licite : l'intention de sortie donne un
      // sens aux couleurs de périphérique, c'est exactement à quoi elle sert.
      color: rgb(0, 0, 0),
    })
  }

  // ── l'identité du fichier ─────────────────────────────────────────────────
  doc.setTitle(titre)
  doc.setAuthor(auteur)
  doc.setProducer(producteur)
  doc.setCreator(outil)
  doc.setCreationDate(date)
  doc.setModificationDate(date)
  // ⚠️ `/Trapped` EST EXIGÉ PAR PDF/X, et la bibliothèque n'a pas d'accesseur :
  // on l'écrit à la main dans le dictionnaire d'information.
  const info = doc.context.lookup(doc.context.trailerInfo.Info)
  info?.set?.(PDFName.of('Trapped'), PDFName.of('False'))

  // ⚠️ `/ID` EST EXIGÉ DANS LA BANDE-ANNONCE. Sans lui, un fichier n'a pas
  // d'identité : les outils d'imposition ne peuvent plus dire si deux versions
  // sont le même document.
  if (!doc.context.lookup(doc.context.trailerInfo.ID)) {
    const graine = new Uint8Array(16)
    const alea = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto)
    if (alea) alea(graine)
    else for (let i = 0; i < 16; i++) graine[i] = Math.floor(Math.random() * 256)
    const id = PDFHexString.fromBytes(graine)
    doc.context.trailerInfo.ID = doc.context.obj([id, id])
  }

  // ── l'intention de sortie ─────────────────────────────────────────────────
  //
  // C'est la structure que `convertToPDFA` construit pour PDF/A, dérivée vers
  // PDF/X : même flux ICC, même `DestOutputProfile`, mais un sous-type
  // `GTS_PDFX` au lieu de `GTS_PDFA1`, et les clés d'identification que PDF/X
  // réclame en plus.
  const icc = getDefaultSRGBProfile()
  const fluxIcc = doc.context.stream(icc, { N: 3 })
  const intention = doc.context.obj({
    Type: 'OutputIntent',
    S: SOUS_TYPE_PDFX,
    OutputConditionIdentifier: PDFString.of(CONDITION_SORTIE),
    OutputCondition: PDFString.of(CONDITION_SORTIE),
    // ⚠️ `Info` EST OBLIGATOIRE quand l'identifiant n'est pas celui d'une
    // condition de production normalisée du registre ICC. C'est notre cas : on
    // incorpore le profil, donc l'identifiant n'a qu'à être lisible.
    Info: PDFString.of('Profil sRGB IEC61966-2.1 incorporé ; conversion vers le profil papier à la charge de l’imprimeur.'),
    DestOutputProfile: doc.context.register(fluxIcc),
  })
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([doc.context.register(intention)]))

  // ── les métadonnées XMP ───────────────────────────────────────────────────
  //
  // ⚠️ ON N'APPELLE PAS `convertToPDFA`, ET C'EST VOLONTAIRE. Elle poserait un
  // `pdfaid` — la conformité PDF/A — que nous n'avons pas vérifiée, écraserait
  // notre intention de sortie par la sienne, et surtout prendrait la main sur
  // le paquet XMP à chaque `save()` : notre `GTS_PDFXVersion` disparaîtrait au
  // premier enregistrement. En restant en dehors, `managePDFAMetadata` reste
  // faux et le paquet qu'on écrit ici survit.
  const xmp = metadonneesXmp({ titre, auteur, producteur, outil, date })
  const fluxXmp = doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(fluxXmp))

  // ⚠️ SANS FLUX D'OBJETS, ET C'EST DÉLIBÉRÉ. Par défaut la bibliothèque range
  // le catalogue, la page et l'intention de sortie dans un `ObjStm` compressé,
  // avec une table de références en flux. C'est licite en PDF 1.6 et ça
  // économise deux kilo-octets — sur un fichier dont l'image pèse douze
  // mégaoctets, c'est-à-dire rien. En échange, cela coûte deux choses qui, elles,
  // valent quelque chose :
  //   · un fichier d'impression qui ne s'inspecte plus. Quand un prestataire
  //     dira « votre TrimBox est absent », il faut pouvoir ouvrir le PDF dans un
  //     éditeur de texte et lire la ligne, tout de suite ;
  //   · une structure moderne devant des RIP qui ne le sont pas. La table de
  //     références classique est comprise partout depuis 1993.
  const octets = await doc.save({ useObjectStreams: false, updateFieldAppearances: false })
  return {
    octets,
    boites,
    reperes: rep,
    places,
    pages: 1,
    octetsImages,
    // le surcoût réel de l'emballage, mesuré sur ce fichier-ci
    surcout: octets.length - octetsImages,
    versionPdfx: VERSION_PDFX,
    conditionSortie: CONDITION_SORTIE,
    profilOctets: icc.length,
    // ⚠️ CE CHAMP DIT LA VÉRITÉ, IL NE LA DÉCORE PAS.
    conformite: 'conforme sous réserve du préflight d’Adrien (aucun validateur PDF/X libre n’existe)',
  }
}
