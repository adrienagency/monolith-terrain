// L'OCCUPATION DU SOL — la partie PURE : quelles classes existent, de quelle
// couleur elles parlent, à quel volume, et où la donnée a été cuite.
//
// Module pur : ni three.js, ni DOM, ni réseau. Il rend des adresses, des
// couleurs et des nombres, et se teste sous node. La mosaïque et la texture
// vivent à côté, dans src/map/occupation-sol-layer.js. Même découpage que
// src/nuit.js — c'est le patron de la maison.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA SOURCE
// ═══════════════════════════════════════════════════════════════════════════
//
// ESA WorldCover v200 (2021), 10 m, CC-BY 4.0. Onze classes, cuites en tuiles
// PNG par `scripts/build-occupation-sol.mjs` — lisez son en-tête pour
// l'arbitrage complet (pourquoi on cuit plutôt que de lire le COG dans le
// navigateur : le seau AWS n'a AUCUN en-tête CORS, sondé).
//
// L'attribution est une OBLIGATION de licence, pas un libellé d'interface.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ UNE CLASSE N'EST PAS UN NOMBRE : ON N'INTERPOLE JAMAIS UN CODE
// ═══════════════════════════════════════════════════════════════════════════
//
// Entre 10 (arbres) et 80 (eau) il n'y a pas 45 : il n'y a rien. Toute la
// chaîne est bâtie pour rendre cette faute impossible plutôt que pour la
// surveiller :
//
//   · la tuile transporte le CODE, jamais une couleur (une couleur cuite se
//     ferait interpoler par le GPU sans que rien ne paraisse cassé, en
//     fabriquant du turquoise entre une forêt et un lac) ;
//   · la texture est échantillonnée au PLUS PROCHE VOISIN, sans mips ;
//   · et le nuanceur convertit les quatre voisins EN COULEUR **avant** de les
//     mélanger. C'est ce qui donne un bord doux sans jamais inventer de classe.
//
// C'est exactement la famille du défaut terrarium qui a coûté cher ici : on
// interpolait l'ENCODAGE de l'altitude au lieu de l'altitude, et +128 m
// sortaient là où il fallait lire −0,5 m.

export const SOL_ATTRIBUTION = 'ESA WorldCover 2021'
export const SOL_LICENCE = 'CC-BY 4.0'
export const SOL_URL_SOURCE = 'https://esa-worldcover.org'

// WorldCover est à 10 m. z14 vaut ~9,5 m/px à l'équateur : c'est exactement la
// donnée. Demander z15 ne rendrait pas plus de détail — ça demanderait des
// tuiles qui n'ont jamais été écrites.
export const SOL_ZOOM_MAX = 14

// ═══════════════════════════════════════════════════════════════════════════
// LA DIRECTION GRAPHIQUE — six familles, pas onze aplats
// ═══════════════════════════════════════════════════════════════════════════
//
// Une carte d'occupation du sol peinte à sa légende officielle est un ATLAS
// SCOLAIRE : onze couleurs franches, aucune hiérarchie, et le relief qui
// disparaît dessous. ShibuMap est l'inverse — papier crème, courbes de niveau,
// Rosarivo, palettes sourdes. La couche est donc réécrite en deux gestes :
//
//   1. ON REGROUPE. Onze classes deviennent SIX FAMILLES, parce que six est ce
//      qu'une carte topographique sait dire : le boisé, l'ouvert, le bâti, le
//      minéral, le gelé, l'humide. La donnée, elle, garde ses onze codes dans
//      la tuile : rien n'est perdu, et rediviser une famille est une ligne.
//
//   2. ON DOSE. Chaque classe porte sa propre FORCE, et c'est là que vit
//      l'argument éditorial :
//
//      · LE BOISÉ ET LE GELÉ PARLENT FORT (0,90 et 0,95). Une forêt et un
//        glacier sont des FORMES : elles ont un contour, elles racontent le
//        versant, elles méritent de se voir. Ce sont elles qui font la couche.
//
//      · L'OUVERT PARLE PLUS BAS (0,42 et 0,50). Prairies et cultures couvrent
//        l'essentiel du monde habité : les peindre à égalité avec la forêt
//        reviendrait à poser un aplat sur les trois quarts de chaque carte de
//        plaine, et à écraser la rampe hypsométrique qui, elle, dit déjà
//        quelque chose.
//
//        ⚠️ MAIS PLUS BAS N'EST PAS INAUDIBLE — ET C'EST LA CORRECTION DU
//        2026-08-02. La première version chuchotait à 0,18 et 0,24, sous une
//        opacité globale de 0,5 : la prairie peignait donc à 9 % d'un lavis
//        lui-même tiré à 45 % vers la couleur de la classe. Verdict d'Adrien :
//        « ça ne fait presque aucun changement sur la map ». L'intention était
//        juste, le NIVEAU était sous le seuil de perception — et une couche
//        qu'on n'aperçoit pas n'est pas discrète, elle est inutile. Le plancher
//        remonte donc, et le RAPPORT est ce qui a été préservé : le boisé reste
//        deux fois plus fort que l'ouvert (0,90 contre 0,42), là où il l'était
//        cinq fois. Deux voix qu'on entend valent mieux qu'une hiérarchie
//        parfaite dont une moitié est muette.
//
//      · ⚠️ L'EAU EST À ZÉRO, ET C'EST LA DÉCISION LA PLUS IMPORTANTE DU LOT.
//        ShibuMap DESSINE DÉJÀ l'eau — masque de mer, water-tiles,
//        lake-tiles — en vectoriel, avec ses caustiques et sa houle. Repeindre
//        par-dessus un raster de 10 m fabriquerait DEUX rivages à un pixel
//        l'un de l'autre, et le plus grossier gagnerait. La classe reste dans
//        la donnée (elle sert de trou propre), elle ne se peint pas.
//        La zone humide HERBACÉE (90), elle, n'est dessinée nulle part
//        ailleurs : elle garde sa voix.
//
//      · LE BÂTI RESTE EN RETRAIT (0,62). Un gris chaud désaturé qui pose
//        l'emprise d'une ville sans prétendre en montrer les rues — c'est le
//        travail de la photo aérienne, qui est une autre couche.
//
//      Et TOUT CE DOSAGE SE DÉPLACE D'UN BLOC sous la tirette « Force »
//      (src/reglages-couches.js, `opaciteSol` → `uSolOpacite`). C'est
//      délibérément une force GLOBALE et non une tirette par famille : le
//      rapport ci-dessus EST l'argument éditorial, et l'exposer famille par
//      famille inviterait à mettre la prairie à fond, c'est-à-dire à fabriquer
//      l'atlas scolaire que ces vingt lignes servent à éviter.
//
// Les couleurs, enfin, sont toutes SOUS 45 % de saturation. Ce n'est pas un
// goût, c'est une garde testée : le vert de la légende ESA officielle
// (#006400) est à 100 %, et c'est exactement ce qu'on ne veut pas.

/** Les six familles et leur teinte. Les valeurs sont en octets 0-255. */
export const FAMILLES_SOL = {
  boise: { nom: 'Boisé', couleur: [76, 92, 63] },     // vert sourd, plus SOMBRE que le fond
  ouvert: { nom: 'Ouvert', couleur: [183, 171, 132] }, // paille chaude, à peine tiède
  bati: { nom: 'Bâti', couleur: [142, 136, 128] },     // gris chaud désaturé
  mineral: { nom: 'Minéral', couleur: [196, 180, 153] }, // ocre pâle, plus CLAIR
  gele: { nom: 'Gelé', couleur: [233, 240, 246] },     // blanc bleuté, la seule couleur nette
  humide: { nom: 'Humide', couleur: [127, 140, 134] }, // gris-vert d'eau dormante
}

/**
 * Les onze classes WorldCover, dans l'ordre des codes.
 *
 * ⚠️ 95 S'INTERCALE ENTRE 90 ET 100. La mangrove ne se range pas à la fin sous
 * prétexte qu'elle a deux chiffres de plus que 90.
 */
export const CLASSES_SOL = [
  { code: 10, nom: 'Arbres', famille: 'boise', force: 0.9 },
  { code: 20, nom: 'Arbustes', famille: 'boise', force: 0.7 },
  { code: 30, nom: 'Prairie', famille: 'ouvert', force: 0.42 },
  { code: 40, nom: 'Cultures', famille: 'ouvert', force: 0.5 },
  { code: 50, nom: 'Bâti', famille: 'bati', force: 0.62 },
  { code: 60, nom: 'Sol nu', famille: 'mineral', force: 0.66 },
  { code: 70, nom: 'Neige et glace', famille: 'gele', force: 0.95 },
  { code: 80, nom: 'Eau', famille: 'humide', force: 0 }, // voir l'en-tête : décision, pas oubli
  { code: 90, nom: 'Zone humide herbacée', famille: 'humide', force: 0.55 },
  { code: 95, nom: 'Mangrove', famille: 'boise', force: 0.9 },
  { code: 100, nom: 'Mousses et lichens', famille: 'mineral', force: 0.5 },
]

export const CODES_SOL = CLASSES_SOL.map((c) => c.code)

const PAR_CODE = new Map(CLASSES_SOL.map((c) => [c.code, c]))

/**
 * La famille d'un code, ou null si le code n'est pas une classe.
 *
 * ⚠️ RIEN NE RATTRAPE UN CODE INCONNU À LA CLASSE LA PLUS PROCHE. 45 doit
 * rendre null, pas « arbres parce que c'est plus près de 10 que de 80 » : un
 * repêchage par proximité rendrait l'interpolation d'un code de classe
 * INVISIBLE au lieu de la rendre impossible.
 */
export function familleDeClasse(code) {
  return PAR_CODE.get(code)?.famille ?? null
}

/** La force d'un code, de 0 à 1. Zéro pour tout ce qui n'est pas une classe. */
export function forceDeClasse(code) {
  return PAR_CODE.get(code)?.force ?? 0
}

/** La couleur d'un code, en octets [r, g, b]. Noir pour un code inconnu. */
export function couleurDeClasse(code) {
  const f = familleDeClasse(code)
  return f ? FAMILLES_SOL[f].couleur.slice() : [0, 0, 0]
}

/**
 * LA TABLE DE CORRESPONDANCE, prête à devenir une texture 256×1 RGBA.
 *
 * ⚠️ L'INDEX EST LE CODE, PAS LE RANG DE LA CLASSE. Ranger les onze couleurs de
 * 0 à 10 et indexer par `rang / 255` compile, s'affiche, et décale toute la
 * carte d'une classe sans lever la moindre erreur. La table fait donc 256
 * entrées — la taille de l'octet lu dans la tuile — et pas onze.
 *
 * L'ALPHA PORTE LA FORCE. Un trou de donnée (code 0), une classe éteinte
 * (l'eau) et un octet corrompu pèsent alors exactement zéro, sans qu'aucune
 * condition n'ait à les distinguer dans le nuanceur.
 *
 * @param {{forces?: Record<number, number>}} [options] - forces remplacées, par code
 * @returns {Uint8Array} 256 × 4 octets
 */
export function tableLutSol({ forces = null } = {}) {
  const lut = new Uint8Array(256 * 4)
  for (const c of CLASSES_SOL) {
    const [r, g, b] = FAMILLES_SOL[c.famille].couleur
    const f = forces?.[c.code] ?? c.force
    const o = c.code * 4
    lut[o] = r
    lut[o + 1] = g
    lut[o + 2] = b
    lut[o + 3] = Math.round(Math.max(0, Math.min(1, f)) * 255)
  }
  return lut
}

/** L'adresse d'une tuile cuite. Grille XYZ, chemin RELATIF. */
export function urlTuileSol(z, x, y) {
  // ⚠️ {z}/{x}/{y} — la convention OSM, celle de nos propres tuiles cuites
  // (bathy, water-tiles). La couche nocturne, écrite la veille, utilise l'ordre
  // WMTS INVERSE {z}/{y}/{x} de GIBS ; les deux fichiers se ressemblent, et
  // recopier l'un dans l'autre rend une tuile VALIDE prise ailleurs sur Terre,
  // sans la moindre erreur en console.
  //
  // Chemin relatif et pas absolu : une barre oblique en tête casse le site
  // servi sous un sous-chemin, ce que sont les aperçus de déploiement Netlify.
  return `data/sol/${z}/${x}/${y}.png`
}

/** Le zoom de tuiles à demander, borné par la résolution native de la source. */
export function zoomSolBorne(voulu) {
  if (!Number.isFinite(voulu)) return SOL_ZOOM_MAX
  return Math.max(0, Math.min(SOL_ZOOM_MAX, Math.floor(voulu)))
}

// ═══════════════════════════════════════════════════════════════════════════
// LA COUVERTURE — où la donnée a été cuite, et comment le dire
// ═══════════════════════════════════════════════════════════════════════════
//
// Le site est 100 % statique : personne ne peut répondre « as-tu de l'occupation
// du sol ici ? ». On lit donc un manifeste cuit, exactement comme
// `src/bathy-sources.js` lit `public/data/bathy/index.json` et comme
// `src/map/geo-cells.js` lit le sien.
//
// ⚠️ ET IL FAUT LE DIRE, PAS LE TAIRE. Une tuile absente rend une mosaïque vide,
// donc une carte inchangée — mais l'interrupteur, lui, reste allumé. L'utilisateur
// lit alors « la donnée dit qu'il n'y a rien ici », ce qui est faux. C'est le
// contrat déjà écrit pour la photo aérienne (`aerialUnavailable` : « leaving the
// toggle on while nothing renders is the worst of both »).

/**
 * Remet un manifeste lu sur disque dans un état où on peut s'appuyer dessus.
 *
 * ⚠️ CHAQUE ZONE PORTE SON PROPRE PLAFOND DE ZOOM, et ce n'est pas un détail
 * depuis qu'une zone MONDIALE existe. Le socle mondial n'est cuit qu'en z8-z9,
 * là où le Mont-Blanc monte à z14 : un plafond GLOBAL vaudrait forcément 14,
 * et une vue sur le Kansas réclamerait des tuiles z14 qui n'ont jamais été
 * écrites. Elle obtiendrait une mosaïque vide, donc une carte inchangée, avec
 * l'interrupteur toujours allumé — « la donnée dit qu'il n'y a rien ici », ce
 * qui est faux. C'est précisément le défaut que main.js s'interdit ailleurs.
 *
 * Une zone sans `zmax` retombe sur le plafond global : les manifestes cuits
 * avant ce champ restent lisibles tels quels.
 */
export function normaliseIndexSol(doc) {
  const borne = (v, dflt) => (Number.isFinite(v) ? Math.max(0, Math.min(SOL_ZOOM_MAX, Math.floor(v))) : dflt)
  const zmaxGlobal = borne(doc?.zmax, SOL_ZOOM_MAX)
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
  return {
    zmin: zminGlobal,
    zmax: zmaxGlobal,
    zones,
  }
}

/**
 * La zone cuite qui sert cette emprise, ou null.
 *
 * ⚠️ C'EST LE CENTRE QUI DÉCIDE, pas l'inclusion complète. Un bloc à cheval sur
 * le bord d'une zone garde l'essentiel de sa donnée ; le refuser pour quelques
 * pixels manquants serait plus brutal que le bord vide — lequel se fond déjà de
 * lui-même, puisqu'une tuile absente vaut le code 0, donc la force zéro.
 *
 * ⚠️ ET QUAND PLUSIEURS ZONES SE RECOUVRENT, C'EST LA PLUS PETITE QUI GAGNE, pas
 * la première rencontrée. Depuis le socle mondial, TOUTE vue tombe dans au moins
 * une zone : rendre « la première » ferait dépendre la finesse affichée au
 * Mont-Blanc de l'ORDRE DES LIGNES DANS UN FICHIER JSON. Le jour où quelqu'un
 * recuit le monde, sa zone repasse en tête du tableau et le Mont-Blanc retombe
 * silencieusement de z14 à z9 — un dégât invisible en test comme en console.
 * La plus petite emprise est la plus spécifique, donc la mieux cuite.
 *
 * @param {{zones:{nom:string,bbox:number[],zmax?:number}[]}|null} index
 * @param {{minLon:number,maxLon:number,minLat:number,maxLat:number}|null} bbox
 */
export function zoneSolPour(index, bbox) {
  if (!index?.zones?.length || !bbox) return null
  const { minLon, maxLon, minLat, maxLat } = bbox
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return null
  const cLon = (minLon + maxLon) / 2
  const cLat = (minLat + maxLat) / 2
  let meilleure = null
  let plusPetite = Infinity
  for (const z of index.zones) {
    const [w, s, e, n] = z.bbox
    if (cLon < w || cLon > e || cLat < s || cLat > n) continue
    const aire = Math.abs((e - w) * (n - s))
    if (aire < plusPetite) {
      plusPetite = aire
      meilleure = z
    }
  }
  return meilleure
}
