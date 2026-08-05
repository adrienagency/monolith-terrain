// LES EFFETS DE POST-TRAITEMENT FACE AU PAVAGE D'UNE AFFICHE.
//
// Module PUR : ni DOM, ni three.js, ni WebGL, ni état. Il prend des noms de
// classes d'effets et des tailles de tuile, et rend un classement et des
// nombres. Il se teste sous node.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PROBLÈME, EN UNE PHRASE
// ═══════════════════════════════════════════════════════════════════════════
//
// Une affiche de 8 000 px de côté ne tient pas dans un tampon de rendu : on la
// peint TUILE PAR TUILE (`planTuiles`, print-page.js), et chaque tuile est une
// CIBLE DE RENDU À PART ENTIÈRE. Or les effets d'écran ne connaissent que leur
// cible : leur `uv` court de 0 à 1 sur la tuile, pas sur l'affiche, et leur
// voisinage s'arrête au bord de la tuile. Trois familles s'en suivent, et une
// seule est inoffensive.
//
//   ① PAR PIXEL — la sortie ne dépend que de la couleur du pixel courant. Le
//      pavage ne se voit pas. Rien à faire.
//   ② PAR CIBLE — la sortie dépend de la POSITION dans la cible (`uv`) ou d'un
//      temps gelé. Chaque tuile reçoit l'effet en entier : le pavage se voit,
//      et il se voit en damier.
//   ③ PAR VOISINAGE — la sortie lit les pixels alentour. Au bord d'une tuile
//      ces voisins n'existent pas : une couture apparaît. Il faut rendre chaque
//      tuile PLUS GRANDE que sa part d'affiche, puis rogner.
//
// ⚠️ ET UNE QUATRIÈME CATÉGORIE, QUI N'EST PAS UN DEGRÉ DE PLUS DE LA MÊME
// ÉCHELLE : ce qu'on SIGNALE sans le traiter. L'occlusion ambiante est éteinte
// par défaut dans les quatre paliers machine (palier-machine.js, `ssao: false`
// partout) mais s'allume à la main depuis le panneau Effets. Son rayon est en
// UNITÉS MONDE (`aoPass.configuration.aoRadius = 2.2`, main.js) : la marge de
// recouvrement qui la sauverait ne s'exprime même pas en pixels sans connaître
// la caméra. Elle est déclarée ici pour qu'on sache qu'elle existe, PAS traitée.
//
// ═══════════════════════════════════════════════════════════════════════════
// NEUTRALISER N'EST PAS CORRIGER
// ═══════════════════════════════════════════════════════════════════════════
//
// Le vignettage et le grain appartiennent à l'image que l'acheteur a validée à
// l'écran. Les éteindre pendant le pavage supprime le damier — et livre UNE
// AUTRE AFFICHE. Ce serait un second défaut, moins spectaculaire que le
// premier et bien plus difficile à nommer (« elle est plus plate qu'à
// l'écran »). Tout effet rangé dans `NEUTRALISER` porte donc une consigne de
// RÉAPPLICATION sur l'image entière, une fois les tuiles recollées ; un test
// interdit qu'elle soit vide.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE MODULE NE RENDRA JAMAIS RIEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Il ne touche ni au compositeur ni aux effets : il DIT ce qu'il faut faire.
// C'est ce qui le rend testable sous node, et c'est aussi ce qui permet au test
// d'exiger la propriété qui compte — qu'aucun effet de la chaîne de main.js
// n'échappe au classement. Un effet ajouté dans six mois n'atterrit pas dans
// une catégorie par défaut : il n'atterrit nulle part, et le test rougit.

import { DPI_PLANCHER } from './export-dpi.js'

// ═══════════ LES CATÉGORIES ════════════════════════════════════════════════

/** Ce n'est pas un effet : c'est le rendu de la scène lui-même. */
export const RENDU = 'rendu'

/** Opère par pixel. Survit au pavage tel quel. */
export const SUR = 'sur'

/** Éteindre pendant le pavage, PUIS réappliquer une fois sur l'image entière. */
export const NEUTRALISER = 'neutraliser'

/** Lit le voisinage : demande une marge de recouvrement, puis un rognage. */
export const RECOUVRIR = 'recouvrir'

/** Casserait le pavage, mais n'est pas traité ici. Déclaré pour être su. */
export const SIGNALER = 'signaler'

export const CATEGORIES = [RENDU, SUR, NEUTRALISER, RECOUVRIR, SIGNALER]

// ═══════════════════════════════════════════════════════════════════════════
// LE CLASSEMENT
// ═══════════════════════════════════════════════════════════════════════════
//
// La clé est le NOM DE CLASSE tel qu'il est construit dans main.js — c'est ce
// que le test sait dériver de la source, et donc le seul nom qui ne peut pas
// mentir. Une clé de plus dans la chaîne sans entrée ici fait rougir
// test/export-effets.test.js.

export const CLASSEMENT_EFFETS = {
  // ── Le rendu de la scène ────────────────────────────────────────────────
  RenderPass: {
    categorie: RENDU,
    raison:
      'Ce n\'est pas un effet d\'écran : c\'est le rendu de la tuile. Son cadrage est déjà traité par composeDecalage (export-cadrage.js).',
  },

  // ── ① Par pixel : rien à faire ──────────────────────────────────────────
  ExposureEffect: {
    categorie: SUR,
    raison:
      'Classe locale de main.js : outputColor = inputColor.rgb * exposure. Une multiplication, sans uv ni voisinage.',
  },
  ToneMappingEffect: {
    categorie: SUR,
    // ⚠️ SÛR SOUS CONDITION, et la condition n'est pas décorative — voir
    // `toneMappingPavable` plus bas.
    raison:
      'En ACES_FILMIC la sortie est ACESFilmicToneMapping(texel), une fonction de la seule couleur du pixel. Les passes de luminance sont bien construites mais ne tournent qu\'en mode adaptatif.',
    sousReserve: 'mode non adaptatif',
  },
  HueSaturationEffect: {
    categorie: SUR,
    raison: 'Conversion RVB → TSL du pixel courant, puis retour. Aucune lecture voisine.',
  },
  BrightnessContrastEffect: {
    categorie: SUR,
    raison: 'Affine sur la couleur du pixel courant.',
  },

  // ── ② Par cible : le damier ─────────────────────────────────────────────
  VignetteEffect: {
    categorie: NEUTRALISER,
    // node_modules/postprocessing — src/effects/glsl/vignette.frag :
    //   const vec2 center = vec2(0.5); float d = distance(uv, center);
    // `uv` court de 0 à 1 SUR LA CIBLE. Chaque tuile étant une cible, chaque
    // tuile reçoit son vignettage complet : l'affiche sort en damier de
    // rectangles assombris, avec un coin sombre au milieu de l'image.
    raison:
      'distance(uv, centre) où uv couvre la CIBLE : chaque tuile reçoit un vignettage entier, l\'affiche sort en damier.',
    reappliquer:
      'Un seul vignettage sur l\'image assemblée, avec les mêmes darkness et offset qu\'à l\'écran (VignetteEffect, main.js).',
  },
  NoiseEffect: {
    categorie: NEUTRALISER,
    // node_modules/postprocessing — src/effects/glsl/noise.frag :
    //   vec3 noise = vec3(rand(uv * (1.0 + time)));
    // Même `uv` d'une tuile à l'autre, et `time` gelé le temps de l'export :
    // le motif se répète à l'identique, tuile après tuile. Une grille de bruit.
    raison:
      'rand(uv * (1.0 + time)) : même uv par tuile et time gelé pendant l\'export, donc le MÊME motif répété — une grille.',
    reappliquer:
      'Un seul grain sur l\'image assemblée, À UNE ÉCHELLE CHOISIE (voir echelleGrain) : un grain par pixel à 300 dpi est invisible et n\'alourdit que le fichier.',
  },

  // ── ③ Par voisinage : la couture ────────────────────────────────────────
  SMAAEffect: {
    categorie: RECOUVRIR,
    raison:
      'Détection de contours à ±2 texels, puis recherche le long du contour sur 2 × pasRecherche texels. Au bord d\'une tuile ces voisins n\'existent pas : le contour reste crénelé sur une bande, et la bande se voit.',
    marge: 'margeSmaa',
  },
  DepthOfFieldEffect: {
    categorie: RECOUVRIR,
    raison:
      'Convolution bokeh sur le voisinage, plus un flou de Kawase sur le cercle de confusion. Sans recouvrement, chaque bord de tuile reprend un voisinage tronqué : le flou s\'arrête net à la couture.',
    marge: 'margeBokeh',
  },

  // ── ④ Signalé, pas traité ───────────────────────────────────────────────
  N8AOPostPass: {
    categorie: SIGNALER,
    raison:
      'Éteinte par défaut aux quatre paliers (palier-machine.js) mais activable à la main. Son rayon est en UNITÉS MONDE (aoRadius = 2.2 sur un bloc de 56) : la marge qui la sauverait ne s\'exprime pas en pixels. Sans traitement, l\'ombrage des creux se discontinue au bord de tuile.',
  },
}

/**
 * La catégorie d'un effet, ou `null` s'il n'est pas classé.
 *
 * ⚠️ `null`, PAS une catégorie par défaut. C'est tout l'objet du module : un
 * effet inconnu doit être visible, pas absorbé.
 *
 * @param {string} nom - le nom de classe tel qu'il est construit dans main.js
 * @returns {string|null}
 */
export function categorieDe(nom) {
  const e = Object.prototype.hasOwnProperty.call(CLASSEMENT_EFFETS, nom) ? CLASSEMENT_EFFETS[nom] : null
  return e ? e.categorie : null
}

/**
 * Ceux d'une liste qui ne sont pas classés. Le test s'en sert pour dire QUI
 * manque, et pas seulement qu'il en manque un.
 *
 * @param {string[]} noms
 * @returns {string[]}
 */
export function effetsNonClasses(noms = []) {
  return [...noms].filter((n) => categorieDe(n) === null)
}

/** Les noms classés dans une catégorie donnée. */
export function effetsDe(categorie) {
  return Object.keys(CLASSEMENT_EFFETS).filter((n) => CLASSEMENT_EFFETS[n].categorie === categorie)
}

// ═══════════════════════════════════════════════════════════════════════════
// LE MAPPAGE TONAL — VÉRIFIÉ, PAS SUPPOSÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// `ToneMappingEffect` construit TOUJOURS, dans son constructeur, une
// `LuminancePass` et une `AdaptiveLuminancePass` — de quoi croire qu'il lit
// l'image entière pour en tirer une luminance moyenne, ce qui rendrait chaque
// tuile différemment exposée. Il n'en est rien, et la preuve tient en trois
// lignes de la bibliothèque (postprocessing 6.36.4) :
//
//   1. `set mode(value)` finit par
//        this.adaptiveLuminancePass.enabled = value === ToneMappingMode.REINHARD2_ADAPTIVE
//   2. `update(renderer, inputBuffer, deltaTime)` est GARDÉ par ce drapeau :
//        if (this.adaptiveLuminancePass.enabled) { … }
//      En ACES les deux passes ne tournent donc jamais.
//   3. Le fragment n'échantillonne `luminanceBuffer` que sous
//      `#if TONE_MAPPING_MODE == 3` ; ACES_FILMIC vaut 6 et tombe dans la
//      branche `#else`, qui appelle `toneMapping(texel)` — soit
//      `ACESFilmicToneMapping(texel)`, une fonction de la seule couleur.
//
// Ce qui reste vrai du soupçon : les cibles de luminance sont bien ALLOUÉES,
// et `initialize` initialise la passe adaptative. C'est de la mémoire, pas une
// dépendance à l'image. Le classement `SUR` tient.
//
// ⚠️ CE QUI LE FERAIT TOMBER : passer le mode à REINHARD2_ADAPTIVE. La moyenne
// serait alors celle de la TUILE, chaque tuile s'exposerait pour son propre
// contenu, et l'affiche sortirait en damier de luminosités. D'où la fonction
// ci-dessous, et le test qui vérifie que main.js construit bien l'effet en
// ACES_FILMIC.

/** La valeur de `ToneMappingMode.REINHARD2_ADAPTIVE` dans postprocessing 6. */
export const MODE_TONAL_ADAPTATIF = 3

/**
 * Un mode de mappage tonal survit-il au pavage ?
 *
 * @param {number} mode - une valeur de `ToneMappingMode`
 * @returns {boolean} faux pour le seul mode adaptatif, qui dépend de la
 *   luminance moyenne de la CIBLE — donc de la tuile.
 */
export function toneMappingPavable(mode) {
  return mode !== MODE_TONAL_ADAPTATIF
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MARGE DE L'ANTICRÉNELAGE — UNE CONSTANTE, ELLE
// ═══════════════════════════════════════════════════════════════════════════
//
// SMAA travaille entièrement en texels de SA cible : `texelSize` vaut
// (1/largeur, 1/hauteur) de la tuile dans les trois matériaux
// (EdgeDetectionMaterial.setSize, SMAAWeightsMaterial.setSize,
// SMAAEffect — smaa.frag). Une distance de N texels de tuile EST une distance
// de N pixels d'affiche : la marge ne dépend donc pas de la taille de la tuile.
//
// Les trois termes, lus dans postprocessing 6.36.4 :
//
//   · DÉTECTION — smaa-edges.vert échantillonne jusqu'à
//       vUv4 = vUv + texelSize * vec2(-2.0, 0.0)   (et vUv5 en y)
//     soit 2 texels.
//   · RECHERCHE — smaa-weights.vert :
//       vOffset[2] = … + vec4(-2,2,-2,2) * texelSize.xxyy * MAX_SEARCH_STEPS_FLOAT
//     soit 2 × MAX_SEARCH_STEPS texels. `applyPreset` fixe
//     `orthogonalSearchSteps = 8` pour le préréglage MEDIUM, qui est celui par
//     défaut — et celui de `new SMAAEffect()` dans main.js. À quoi s'ajoute la
//     correction de `searchXLeft` & consorts :
//       offset = -(255/127) * searchLength(e, 0.0) + 3.25
//     dont la valeur absolue est majorée par 3,25 texels.
//   · MÉLANGE — smaa.frag lit `inputBuffer` en
//       blendingCoord = blendingOffset * vec4(texelSize, -texelSize) + uv.xyxy
//     avec un poids de mélange dans [0, 1] : 1 texel.

export const SMAA_PAS_RECHERCHE_MOYEN = 8
export const SMAA_TEXELS_DETECTION = 2
export const SMAA_TEXELS_CORRECTION = 3.25
export const SMAA_TEXELS_MELANGE = 1

/**
 * La marge de recouvrement de SMAA, en pixels d'affiche.
 *
 * @param {{pasRecherche?:number}} [o]
 * @returns {number} entier, arrondi au supérieur
 */
export function margeSmaa({ pasRecherche = SMAA_PAS_RECHERCHE_MOYEN } = {}) {
  const pas = Number.isFinite(pasRecherche) && pasRecherche >= 0 ? pasRecherche : SMAA_PAS_RECHERCHE_MOYEN
  return Math.ceil(2 * pas + SMAA_TEXELS_DETECTION + SMAA_TEXELS_CORRECTION + SMAA_TEXELS_MELANGE)
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MARGE DU BOKEH — ET POURQUOI CE N'EST PAS UNE CONSTANTE
// ═══════════════════════════════════════════════════════════════════════════
//
// LE PIÈGE. `main.js:2060` construit la profondeur de champ avec
// `height: 720`. Dans postprocessing, `height` est l'ancien nom de
// `resolutionY` : la résolution interne de l'effet est VERROUILLÉE à 720 px de
// haut, quelle que soit la taille de la cible. Trois de ses six cibles
// (`renderTarget`, `renderTargetNear`, `renderTargetCoCBlurred`) et les deux
// tampons du flou de Kawase vivent donc à 720 de haut — pendant que la tuile,
// elle, peut faire 2 048. Un demi-texel de ces tampons-là ne mesure pas un
// demi-pixel d'affiche : il en mesure `hauteurTuile / 720`.
//
// La marge se décompose en TROIS TERMES, dont un seul dépend de la tuile.
//
// ① LA CONVOLUTION BOKEH — constante en pixels d'affiche.
//    `convolution.bokeh.frag` :  vec2 step = texelSize * coc;  uv = step*kernel.xy + vUv
//    · `texelSize` vient de `BokehMaterial.setSize(width, height)`, et
//      `DepthOfFieldEffect.setSize` l'appelle avec la taille de BASE (celle de
//      la tuile), pas avec la résolution interne — vérifié ligne à ligne dans
//      le paquet installé. Un texel = un pixel d'affiche.
//    · `generateKernel` : r = sqrt(i)/sqrt(80) pour i < 80, donc r < 1.
//    · `coc` est la valeur du tampon de cercle de confusion (un smoothstep,
//      donc dans [0, 1]) multipliée par `scale` = `bokehScale`.
//    ⇒ au plus `bokehScale` pixels par passe. Et il y a DEUX passes enchaînées
//      (base puis fill, `bokehNearBasePass` → `bokehNearFillPass`).
//
// ② LE FLOU DE KAWASE SUR LE CERCLE DE CONFUSION — constant lui aussi.
//    `KawaseBlurPass.setSize` appelle `blurMaterial.setSize(width, height)`
//    avec la taille de base : mêmes texels que ci-dessus.
//    `convolution.kawase.vert` : dUv = (texelSize.xy*kernel + texelSize.zw)*scale,
//    et `texelSize.zw` est le demi-texel — donc un décalage de (k + 0,5) texels.
//    `kernelPresets[KernelSize.MEDIUM]` (le réglage de la profondeur de champ)
//    vaut [0, 1, 1, 2], soit quatre itérations enchaînées :
//        0,5 + 1,5 + 1,5 + 2,5 = 6 texels.
//
// ③ LE RÉ-ÉCHANTILLONNAGE À 720 — LE TERME QUI DÉPEND DE LA TUILE.
//    Chaque lecture bilinéaire enchaînée d'un tampon haut de 720 étale d'un
//    demi-texel DE CE TAMPON, soit 0,5 · hauteurTuile / 720 pixels d'affiche.
//    Sur le chemin de l'avant-plan on en compte sept : trois itérations de
//    Kawase qui relisent un tampon à 720, la copie finale du flou,
//    `bokehNearFillPass` qui relit `renderTarget`, et le mélange final qui lit
//    `nearColorBuffer`. Sept demi-texels, arrondis à HUIT par prudence — c'est
//    un décompte, et un décompte se trompe plus facilement qu'une formule.
//
// ⇒  marge(hauteurTuile) = 2·bokehScale + 6 + 4 · hauteurTuile / 720
//
// À 720 de haut la marge vaut 4 px de plus qu'à résolution nulle ; à 2 048,
// 11 px de plus ; à 8 192, 45. C'est bien une fonction de la hauteur de tuile,
// et prendre la valeur d'une taille pour une autre laisse une couture.

export const BOKEH_HAUTEUR_INTERNE = 720
export const BOKEH_PASSES_ENCHAINEES = 2
export const KAWASE_MOYEN_TEXELS = 6
/** Sept lectures bilinéaires enchaînées à 720, arrondies à huit demi-texels. */
export const BOKEH_DEMI_TEXELS_720 = 8

/**
 * La marge de recouvrement du bokeh, en pixels d'affiche.
 *
 * @param {{hauteurTuile:number, bokehScale?:number, hauteurInterne?:number}} o
 * @returns {number|null} `null` sur une hauteur de tuile inutilisable — on ne
 *   devine pas une marge, exactement comme `degradePour` ne devine pas un
 *   plafond matériel.
 */
export function margeBokeh({ hauteurTuile, bokehScale = 0, hauteurInterne = BOKEH_HAUTEUR_INTERNE } = {}) {
  if (!Number.isFinite(hauteurTuile) || hauteurTuile <= 0) return null
  // `bokehScale` à zéro éteint la convolution AU FRAGMENT (`coc == 0.0` rend le
  // pixel tel quel) : il n'y a plus de voisinage lu du tout, ni par le bokeh ni
  // par le flou de cercle de confusion, dont le résultat est multiplié par ce
  // même zéro. Marge nulle, et c'est exact, pas indulgent.
  if (!Number.isFinite(bokehScale) || bokehScale <= 0) return 0
  const h = Number.isFinite(hauteurInterne) && hauteurInterne > 0 ? hauteurInterne : BOKEH_HAUTEUR_INTERNE
  return Math.ceil(
    BOKEH_PASSES_ENCHAINEES * bokehScale + KAWASE_MOYEN_TEXELS + (BOKEH_DEMI_TEXELS_720 / 2) * (hauteurTuile / h)
  )
}

/**
 * La marge de recouvrement à appliquer à une tuile : le PLUS GRAND besoin des
 * effets allumés.
 *
 * ⚠️ LE MAXIMUM, PAS LA SOMME. Les deux effets lisent le même voisinage de la
 * même image ; une bande assez large pour le plus gourmand l'est pour l'autre.
 * Sommer gonflerait chaque tuile pour rien — et le coût d'une marge n'est pas
 * nul : elle multiplie la surface rendue, tuile après tuile.
 *
 * @param {{hauteurTuile:number, bokehActif?:boolean, bokehScale?:number,
 *   smaaActif?:boolean, pasRecherche?:number}} o
 * @returns {number|null}
 */
export function margeRecouvrement({
  hauteurTuile,
  bokehActif = false,
  bokehScale = 0,
  smaaActif = true,
  pasRecherche = SMAA_PAS_RECHERCHE_MOYEN,
} = {}) {
  if (!Number.isFinite(hauteurTuile) || hauteurTuile <= 0) return null
  let marge = 0
  if (smaaActif) marge = Math.max(marge, margeSmaa({ pasRecherche }))
  if (bokehActif) {
    const b = margeBokeh({ hauteurTuile, bokehScale })
    if (b === null) return null
    marge = Math.max(marge, b)
  }
  return marge
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ÉCHELLE DU GRAIN RÉAPPLIQUÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// `NoiseEffect` tire un nombre aléatoire PAR PIXEL. À l'écran c'est le bon
// geste : le pixel écran mesure environ 0,25 mm et le grain se voit. Sur une
// affiche à 300 dpi le pixel mesure 0,085 mm — sous le pouvoir séparateur de
// l'œil à n'importe quelle distance de lecture. Le grain par pixel y est donc
// DEUX FOIS invisible : trop fin pour être vu, et assez bruité pour ruiner la
// compression du fichier livré (un bruit blanc est incompressible par
// construction).
//
// La cellule de grain doit donc mesurer une TAILLE PHYSIQUE, pas un pixel. Le
// repère existe déjà dans ce dépôt et il est argumenté : `DPI_PLANCHER`
// (export-dpi.js) vaut 150, « le premier cran en dessous » de la limite de
// l'œil sur une carte regardée à 50 cm. Une cellule d'un pixel de 150 dpi —
// 0,169 mm — est donc le grain le plus fin qui se voie encore. On l'adopte
// comme pas de référence : à 300 dpi la cellule fait 2 × 2 pixels, à 200 dpi
// elle en fait 1.
//
// Une seule source de vérité, importée : si le plancher bouge un jour parce
// qu'on a changé d'avis sur ce que l'œil sépare, le grain suit.

export const DPI_GRAIN = DPI_PLANCHER
export const MM_PAR_POUCE_GRAIN = 25.4

/**
 * Le côté d'une cellule de grain, en pixels d'affiche.
 *
 * @param {number} dpi
 * @returns {number|null} au moins 1 — on ne peut pas tirer moins d'un pixel
 */
export function echelleGrain(dpi) {
  if (!Number.isFinite(dpi) || dpi <= 0) return null
  return Math.max(1, Math.round(dpi / DPI_GRAIN))
}

/**
 * Ce que mesure une cellule de grain sur le papier, en millimètres. Sert au
 * test à vérifier la PROPRIÉTÉ (« le grain garde une taille physique »)
 * plutôt qu'une liste de valeurs par densité.
 */
export function tailleGrainMm(dpi) {
  const n = echelleGrain(dpi)
  return n === null ? null : (n * MM_PAR_POUCE_GRAIN) / dpi
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PLAN D'UN EXPORT PAVÉ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ce qu'il faut faire des effets pour paver une affiche donnée.
 *
 * Rend une description, jamais un geste : c'est l'appelant (main.js) qui
 * éteint, rend, recolle et réapplique.
 *
 * @param {{hauteurTuile:number, dpi:number, bokehActif?:boolean,
 *   bokehScale?:number, smaaActif?:boolean, pasRecherche?:number,
 *   vignette?:number, grain?:number, occlusionActive?:boolean}} o
 * @returns {{neutraliser:string[], reappliquer:Array, recouvrementPx:number,
 *   signalements:string[]}|null}
 */
export function planPavage({
  hauteurTuile,
  dpi,
  bokehActif = false,
  bokehScale = 0,
  smaaActif = true,
  pasRecherche = SMAA_PAS_RECHERCHE_MOYEN,
  vignette = 0,
  grain = 0,
  occlusionActive = false,
} = {}) {
  const recouvrementPx = margeRecouvrement({ hauteurTuile, bokehActif, bokehScale, smaaActif, pasRecherche })
  if (recouvrementPx === null) return null

  const neutraliser = []
  const reappliquer = []

  // ⚠️ ON NE NEUTRALISE QUE CE QUI EST ALLUMÉ, et on ne promet de réappliquer
  // que ce qu'on a éteint. Un vignettage à zéro n'a rien produit à l'écran :
  // le « réappliquer » serait une invention.
  if (vignette > 0) {
    neutraliser.push('VignetteEffect')
    reappliquer.push({ effet: 'VignetteEffect', darkness: vignette })
  }
  if (grain > 0) {
    neutraliser.push('NoiseEffect')
    reappliquer.push({ effet: 'NoiseEffect', opacite: grain, echellePx: echelleGrain(dpi) })
  }

  const signalements = []
  if (occlusionActive) {
    signalements.push(
      'Occlusion ambiante allumée : son rayon est en unités monde, elle se discontinuera au bord de tuile. Non traitée par ce module.'
    )
  }

  return { neutraliser, reappliquer, recouvrementPx, signalements }
}
