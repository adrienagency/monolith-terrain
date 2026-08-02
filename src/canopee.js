// LA HAUTEUR DE CANOPÉE — la partie PURE : à quelle couleur parle un arbre de
// 30 m, à quel volume, et où la donnée a été cuite.
//
// Module pur : ni three.js, ni DOM, ni réseau. Il rend des adresses, des
// couleurs et des nombres, et se teste sous node. La mosaïque et la texture
// vivent à côté, dans src/map/canopee-layer.js. Même découpage que
// src/nuit.js et src/occupation-sol.js — c'est le patron de la maison.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CETTE COUCHE EST UNE COULEUR DRAPÉE, PAS DU RELIEF — ET C'EST MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Il a été annoncé une fois ici que « les forêts deviennent un volume ». C'était
// FAUX, et voici les trois chiffres qui le disent, pour que personne n'ait à
// refaire la déception :
//
//   · UN BLOC FAIT 20,8 km DE LARGE POUR 56 UNITÉS DE MONDE. Une unité vaut
//     donc 371 m. Un houppier de 40 m — ce qui est déjà une très grande forêt —
//     vaut 0,108 unité, soit 0,19 % de la largeur du bloc.
//   · L'EXAGÉRATION VERTICALE (×2,8 par défaut, BASE_EXAG dans main.js) ne
//     sauve rien : elle porte les 40 m à 0,30 unité, c'est-à-dire 0,54 % de la
//     largeur. Sur un écran de 1 400 px de large, la forêt entière mesurerait
//     SEPT PIXELS de haut.
//   · ET SURTOUT, LE MAILLAGE NE SAURAIT PAS LA PORTER. À z12 le socle est
//     maillé en 385² sur 56 unités : un pas de 0,145 unité, soit 54 m de sol.
//     Une lisière de forêt — la seule chose qui ferait une silhouette — tient
//     donc sur UN sommet. Déplacée en géométrie, elle rendrait un mur d'un
//     sommet de large : un escalier, pas un couvert forestier.
//
// La conclusion n'est pas « c'est trop petit pour être intéressant », c'est
// « ce n'est pas de la GÉOMÉTRIE ». La hauteur de canopée dit où la forêt est
// HAUTE, et c'est une information de surface : elle se peint, comme
// l'occupation du sol, et elle se lit très bien ainsi.
//
// Le seul relief qu'on s'autorise est un OMBRAGE DE LISIÈRE calculé dans le
// nuanceur à partir du gradient de la texture (voir `ombreLisiere` dans
// terrain.js). C'est de l'ombre portée sur une image, pas un déplacement de
// sommet : ça ne prétend rien.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA SOURCE — et pourquoi ce n'est pas l'autre
// ═══════════════════════════════════════════════════════════════════════════
//
// ETH Zurich, Global Canopy Height Map 10 m (2020), Lang et al., CC-BY 4.0.
// Sondée le 2026-08-02, avec les chiffres :
//
//   · META × WRI 1 m EST HORS SERVICE. Le seau `s3://dataforgood-fb-forests`
//     rend `NoSuchBucket` — le nom n'existe plus du tout. Il n'y avait donc
//     rien à peser : le candidat s'est retiré tout seul. (Et il aurait perdu :
//     à z14 un pixel d'écran couvre déjà ~9,5 m de sol, donc le mètre de Meta
//     aurait été jeté par le rééchantillonnage avant d'atteindre l'œil.)
//   · L'ETH TIENT, MAIS SANS CORS. Le fichier de 3° N45E006 pèse 407 Mo et
//     répond bien aux requêtes de plage (206 Partial Content) — mais AUCUN
//     en-tête `access-control-allow-origin` ne sort de libdrive.ethz.ch. La
//     lecture COG directe depuis le navigateur est donc impossible, exactement
//     comme pour `s3://esa-worldcover`. On cuit, comme pour l'occupation du sol.
//
// L'attribution est une OBLIGATION de licence, pas un libellé d'interface.

export const CANOPEE_ATTRIBUTION = 'ETH Global Canopy Height 2020'
export const CANOPEE_LICENCE = 'CC-BY 4.0'
export const CANOPEE_URL_SOURCE = 'https://langnico.github.io/globalcanopyheight/'

// La source est à 10 m (1/12000 de degré, soit 9,26 m à l'équateur). z14 vaut
// ~9,5 m/px : c'est exactement la donnée. Demander z15 ne rendrait pas plus de
// détail — ça demanderait des tuiles qui n'ont jamais été écrites.
export const CANOPEE_ZOOM_MAX = 14

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUE PORTE UN OCTET DE TUILE : DES MÈTRES, ET C'EST TOUT L'INVERSE DU SOL
// ═══════════════════════════════════════════════════════════════════════════
//
// L'occupation du sol transporte un CODE : entre 10 (arbres) et 80 (eau) il n'y
// a pas 45, il n'y a rien, et toute sa chaîne est bâtie pour rendre
// l'interpolation IMPOSSIBLE (plus proche voisin, pas de mips, mélange des
// couleurs et jamais des codes).
//
// Ici c'est le contraire terme à terme : un octet est une HAUTEUR EN MÈTRES.
// Entre 10 m et 12 m il y a 11 m, et 11 m est une hauteur parfaitement réelle.
// Le champ est CONTINU. Donc, et il faut le dire aussi fort que la règle
// inverse est écrite à côté :
//
//   · le filtrage LINÉAIRE est CORRECT ici, et il est même souhaitable — il
//     rend la lisière douce sans inventer quoi que ce soit ;
//   · la table de correspondance se lit AUSSI en linéaire : l'entrée 12 et
//     l'entrée 13 encadrent une couleur de 12,4 m, qui existe ;
//   · le nuanceur n'a donc PAS besoin du ballet des quatre voisins que
//     `lavisSol` exécute. Il lit un texel, il lit la table, c'est fini.
//
// ⚠️ RECOPIER LES PRÉCAUTIONS DE L'OCCUPATION DU SOL ICI SERAIT UNE FAUTE, pas
// une prudence : on se retrouverait avec des marches d'escalier d'un mètre sur
// une donnée continue, c'est-à-dire un défaut de rendu fabriqué à la main.
//
// LE ZÉRO EST LE NON-ÉVÉNEMENT. Zéro mètre de canopée, c'est « pas d'arbre »,
// et c'est aussi ce que le cuiseur écrit pour « pas de donnée » (la source note
// 255). Les deux se peignent pareil — c'est-à-dire pas du tout — et c'est
// voulu : une tuile manquante, un océan et un désert doivent rendre exactement
// la carte qu'ils rendaient sans la couche.

/**
 * ⚠️ LE PLAFOND DE VRAISEMBLANCE. Le plus grand arbre mesuré sur Terre monte à
 * 116 m. Un octet qui dit 200 ne dit donc pas une forêt : il dit un « pas de
 * donnée » que le cuiseur aurait laissé passer, ou un octet abîmé. Au-dessus de
 * ce seuil, la force tombe à zéro plutôt que de peindre la valeur la plus
 * sombre de la rampe sur tout un océan.
 *
 * Ce garde-fou est une CEINTURE : le cuiseur écrit déjà 0 pour le 255 de la
 * source (voir scripts/build-canopee.mjs). Il coûte une ligne dans la table et
 * couvre le jour où quelqu'un cuit avec une autre source.
 */
export const CANOPEE_H_ABSURDE = 120

// ═══════════════════════════════════════════════════════════════════════════
// LA DIRECTION GRAPHIQUE — une rampe qui S'ASSOMBRIT et se refroidit
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux gestes, et le second est celui qui fait lire la carte.
//
//   1. ON S'ASSOMBRIT AVEC LA HAUTEUR. Une forêt de 35 m est plus sombre qu'un
//      taillis de 5 m — c'est vrai physiquement (l'ombre s'y accumule) et c'est
//      surtout ce qui permet de LIRE la donnée sans légende : le plus foncé est
//      le plus haut, personne n'a besoin qu'on le lui explique.
//
//   2. ON SE REFROIDIT AVEC LA HAUTEUR. Les hauts couverts tirent vers un vert
//      bleuté, les bas vers une paille verdie. C'est la perspective aérienne
//      des peintres, et ici elle a un travail précis : sans elle, la rampe ne
//      serait qu'un dégradé de luminosité, et le nuanceur — qui impose déjà la
//      LUMINANCE de la carte à la couleur de la couche, exactement comme pour
//      l'occupation du sol — l'écraserait presque entièrement. La TEINTE est
//      donc ce qui survit au mélange ; il fallait qu'elle porte l'information
//      elle aussi, sinon la couche disparaissait sur les versants à l'ombre.
//
// Les couleurs restent sous 45 % de saturation, comme toute la maison : papier
// crème, courbes de niveau, Rosarivo. Le vert de légende à 100 % de saturation
// est exactement ce qu'on ne veut pas.
//
// ⚠️ LA RAMPE S'ARRÊTE À 45 m ET C'EST DÉLIBÉRÉ. Au-delà, la donnée existe mais
// elle est rare (quelques forêts primaires) : étirer la rampe jusqu'à 60 m pour
// elles écraserait toute la dynamique des 0-30 m, c'est-à-dire de 99 % du monde
// boisé. Au-dessus de 45 m, la couleur reste celle de 45 m.

/**
 * Les arrêts de la rampe : hauteur en mètres → couleur sRVB en octets.
 * Entre deux arrêts on interpole LINÉAIREMENT — la hauteur est continue, cette
 * interpolation-là est licite (relire l'en-tête si le doute revient).
 */
export const ARRETS_CANOPEE = [
  { h: 0, couleur: [178, 174, 138] },  // paille verdie — la broussaille rase
  { h: 5, couleur: [148, 154, 112] },  // taillis, jeunes plantations
  { h: 12, couleur: [112, 130, 95] },  // futaie ordinaire — le cas le plus fréquent
  { h: 22, couleur: [78, 102, 78] },   // forêt haute
  { h: 32, couleur: [54, 80, 72] },    // couvert dense, le bleu commence
  { h: 45, couleur: [38, 62, 64] },    // forêt primaire — vert bleuté profond
]

/**
 * Les arrêts de FORCE : hauteur en mètres → combien la couleur pèse (0 à 1).
 *
 * ⚠️ CE N'EST PAS UNE RAMPE DÉCORATIVE, C'EST LE SEUIL « EST-CE UNE FORÊT ».
 * La source note une hauteur partout, y compris 1 ou 2 m sur des prairies, des
 * cultures et des haies. Peindre ça à pleine force couvrirait les plaines
 * agricoles du monde entier d'un voile paille — c'est-à-dire referait, en
 * moins juste, ce que l'occupation du sol dit déjà. La force ne décolle donc
 * vraiment qu'à partir de 3 m, et n'atteint son plein qu'à la futaie.
 *
 * Elle NE retombe PAS à zéro sous 3 m par un seuil net : un seuil franc
 * dessinerait un contour dur autour de chaque bosquet, et c'est précisément
 * l'atlas scolaire qu'on refuse. Elle monte doucement.
 */
export const FORCES_CANOPEE = [
  { h: 0, force: 0 },      // rigoureusement rien : « pas d'arbre » = « pas de donnée »
  { h: 2, force: 0 },      // ⚠️ toujours rien à 2 m — voir CANOPEE_SOL_NU juste dessous
  { h: 5, force: 0.34 },
  { h: 9, force: 0.62 },
  { h: 15, force: 0.85 },
  { h: 22, force: 0.96 },
  { h: 30, force: 1 },
]

/**
 * ⚠️ JUSQU'À CETTE HAUTEUR INCLUSE, ON NE PEINT RIEN DU TOUT — et ce n'est pas
 * le même geste que « peindre faiblement ».
 *
 * La source rend 1 ou 2 m sur d'immenses surfaces qui ne sont pas des forêts :
 * champs de maïs en août, buissons, haies, bruit de modèle sur du sol nu. Une
 * rampe qui partirait de 0 m donnerait à 2 m une force de l'ordre de 0,15 —
 * presque rien à l'œil nu, mais la tirette « Force » monte à 4 : ça devient 0,6
 * sur une immense fraction des terres émergées, c'est-à-dire le voile paille
 * uniforme qu'on vient de refuser, revenu par la tirette.
 *
 * Deux mètres est donc à la fois le premier arrêt NUL de `FORCES_CANOPEE` et
 * le plancher dur ci-dessous : la rampe ne décolle qu'au-delà. Les deux disent
 * la même chose, et c'est voulu — le plancher tient même si quelqu'un retouche
 * les arrêts de la rampe sans y penser.
 */
export const CANOPEE_SOL_NU = 2

const interpole = (arrets, h, champ) => {
  if (!Number.isFinite(h)) return arrets[0][champ]
  if (h <= arrets[0].h) return arrets[0][champ]
  const dernier = arrets[arrets.length - 1]
  if (h >= dernier.h) return dernier[champ]
  for (let i = 1; i < arrets.length; i++) {
    if (h > arrets[i].h) continue
    const a = arrets[i - 1], b = arrets[i]
    const t = (h - a.h) / (b.h - a.h)
    if (champ === 'couleur') {
      return [0, 1, 2].map((k) => a.couleur[k] + (b.couleur[k] - a.couleur[k]) * t)
    }
    return a.force + (b.force - a.force) * t
  }
  return dernier[champ]
}

/** La couleur d'une hauteur, en octets [r, g, b] non arrondis. */
export function couleurCanopee(h) {
  return interpole(ARRETS_CANOPEE, h, 'couleur')
}

/**
 * La force d'une hauteur, de 0 à 1.
 *
 * Zéro sous `CANOPEE_SOL_NU` et au-dessus de `CANOPEE_H_ABSURDE` : les deux
 * bouts qui ne sont pas de la forêt.
 */
export function forceCanopee(h) {
  if (!Number.isFinite(h)) return 0
  if (h <= CANOPEE_SOL_NU) return 0
  if (h >= CANOPEE_H_ABSURDE) return 0
  return Math.max(0, Math.min(1, interpole(FORCES_CANOPEE, h, 'force')))
}

/**
 * LA TABLE DE CORRESPONDANCE, prête à devenir une texture 256×1 RGBA.
 *
 * ⚠️ L'INDEX EST LA HAUTEUR EN MÈTRES, DIRECTEMENT. Pas un rang, pas une
 * hauteur remise à l'échelle sur 0-255 : l'octet cuit dans la tuile EST le
 * nombre de mètres, et cette table se lit avec ce nombre sans conversion. Toute
 * mise à l'échelle intermédiaire (« 45 m sur 255 pour user de toute la
 * dynamique ») ajouterait un facteur à tenir accordé entre le cuiseur, la table
 * et le nuanceur — trois endroits, donc deux occasions de diverger en silence,
 * pour gagner une précision dont une couleur n'a aucun usage.
 *
 * L'ALPHA PORTE LA FORCE, comme pour l'occupation du sol : un trou de donnée
 * (0 m), un buisson et un octet absurde pèsent alors exactement zéro sans
 * qu'aucune condition n'ait à les distinguer dans le nuanceur.
 *
 * @returns {Uint8Array} 256 × 4 octets
 */
export function tableLutCanopee() {
  const lut = new Uint8Array(256 * 4)
  for (let h = 0; h < 256; h++) {
    const [r, g, b] = couleurCanopee(h)
    const o = h * 4
    lut[o] = Math.round(Math.max(0, Math.min(255, r)))
    lut[o + 1] = Math.round(Math.max(0, Math.min(255, g)))
    lut[o + 2] = Math.round(Math.max(0, Math.min(255, b)))
    lut[o + 3] = Math.round(forceCanopee(h) * 255)
  }
  return lut
}

/** L'adresse d'une tuile cuite. Grille XYZ, chemin RELATIF. */
export function urlTuileCanopee(z, x, y) {
  // ⚠️ {z}/{x}/{y} — la convention OSM, celle de nos propres tuiles cuites
  // (bathy, water-tiles, sol). La couche nocturne, elle, utilise l'ordre WMTS
  // INVERSE {z}/{y}/{x} de GIBS ; les deux fichiers se ressemblent, et recopier
  // l'un dans l'autre rend une tuile VALIDE prise ailleurs sur Terre, sans la
  // moindre erreur en console.
  //
  // Chemin relatif et pas absolu : une barre oblique en tête casse le site
  // servi sous un sous-chemin, ce que sont les aperçus de déploiement Netlify.
  return `data/canopee/${z}/${x}/${y}.png`
}

/** Le zoom de tuiles à demander, borné par la résolution native de la source. */
export function zoomCanopeeBorne(voulu) {
  if (!Number.isFinite(voulu)) return CANOPEE_ZOOM_MAX
  return Math.max(0, Math.min(CANOPEE_ZOOM_MAX, Math.floor(voulu)))
}

// ═══════════════════════════════════════════════════════════════════════════
// LA COUVERTURE — où la donnée a été cuite, et comment le dire
// ═══════════════════════════════════════════════════════════════════════════
//
// Même contrat que l'occupation du sol : le site est 100 % statique, personne ne
// peut répondre « as-tu de la canopée ici ? », donc on lit un manifeste cuit.
//
// ⚠️ ET IL FAUT LE DIRE, PAS LE TAIRE. Une tuile absente rend une mosaïque vide,
// donc une carte inchangée — mais l'interrupteur, lui, reste allumé. L'utilisateur
// lit alors « la donnée dit qu'il n'y a pas d'arbres ici », ce qui est faux.

/**
 * Remet un manifeste lu sur disque dans un état où on peut s'appuyer dessus.
 *
 * ⚠️ CHAQUE ZONE PORTE SON PROPRE PLAFOND DE ZOOM. Un plafond GLOBAL vaudrait
 * forcément 14, et une vue posée sur une zone cuite en z9 réclamerait des tuiles
 * z14 jamais écrites : mosaïque vide, interrupteur allumé, « la donnée dit qu'il
 * n'y a rien ». C'est le défaut que `normaliseIndexSol` documente déjà, et il se
 * rejoue à l'identique pour chaque couche cuite.
 */
export function normaliseIndexCanopee(doc) {
  const borne = (v, dflt) =>
    Number.isFinite(v) ? Math.max(0, Math.min(CANOPEE_ZOOM_MAX, Math.floor(v))) : dflt
  const zmaxGlobal = borne(doc?.zmax, CANOPEE_ZOOM_MAX)
  // Le plancher de cuisson global, dont héritent les zones qui n'en ont pas.
  const zminGlobal = borne(doc?.zmin, 0)
  const zones = Array.isArray(doc?.zones)
    ? doc.zones
        .filter((z) => Array.isArray(z?.bbox) && z.bbox.length === 4 && z.bbox.every(Number.isFinite))
        // ⚠️ LE `zmin` EST LU AUSSI, ET IL NE L'ÉTAIT PAS. Le manifeste
        // déclare depuis toujours « la cuisson ne descend pas sous z8 », et
        // personne ne transmettait ce nombre : à demZoom 5-6 on réclamait du
        // z6/z7 jamais écrit, tout tombait en 404, rien n'était peint, et
        // l'interrupteur restait allumé sur une carte inchangée.
        //
        // Une zone sans `zmin` propre hérite de celui de la racine — c'est ce
        // que le manifeste du socle mondial suppose déjà. Et un `zmin` ne peut
        // pas dépasser le `zmax` de sa zone : ce serait une zone vide, donc une
        // couche qui ne s'allume jamais sans dire pourquoi.
        .map((z) => {
          const zmax = borne(z?.zmax, zmaxGlobal)
          return { ...z, zmax, zmin: Math.min(borne(z?.zmin, zminGlobal), zmax) }
        })
    : []
  return { zmin: zminGlobal, zmax: zmaxGlobal, zones }
}

// ⚠️ ON RÉUTILISE `zoneSolPour` AU LIEU D'EN ÉCRIRE LA JUMELLE, et ce n'est pas
// de la paresse : cette fonction est PUREMENT GÉOMÉTRIQUE. Elle ne connaît ni
// classe, ni hauteur, ni mètre — elle prend un manifeste et une emprise, et rend
// la plus PETITE zone dont le centre de l'emprise tombe dedans. Ses deux
// décisions dures (« c'est le centre qui décide » et « la plus petite gagne, pas
// la première du fichier ») ont chacune coûté un raisonnement, sont testées, et
// n'ont aucune raison d'exister en double : deux copies d'une règle finissent
// toujours par diverger, et celle-ci diverge SANS ERREUR — elle rendrait
// seulement une finesse de tuiles différente entre deux couches sur la même vue.
export { zoneSolPour as zoneCanopeePour } from './occupation-sol.js'
