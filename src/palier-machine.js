// PALIER MACHINE — estimer ce que l'ordinateur du visiteur sait afficher,
// AVANT le premier rendu, et lui servir le bon palier tout de suite.
//
// ---------------------------------------------------------------------------
// POURQUOI CE FICHIER EXISTE : ON DÉMARRAIT TOUJOURS AU MAXIMUM
// ---------------------------------------------------------------------------
// Le gouverneur de perf.js est RÉACTIF : il attend de mesurer des images lentes
// pour dégrader. Mesuré le 28/07/2026 : une machine à 5,5 images par seconde
// mettait 47 secondes à atteindre son palier — quarante-sept secondes de
// ventilateur, pendant lesquelles le visiteur regarde une carte qui saccade,
// ou s'en va. Et sur un iMac 27" 2015 (Retina 5K, Iris Pro), le premier rendu
// demandait 5120×2880 = 14,7 millions de pixels par image. Aucun réglage
// réactif ne rattrape une première image de cette taille.
//
// LE PRINCIPE QUI CHANGE TOUT : on n'attend plus que ça rame. On lit ce que le
// navigateur sait déjà dire — le nom de la carte graphique, ses limites, la
// taille de l'écran, sa densité — et on démarre au palier correspondant. Le
// gouverneur reste, mais comme AFFINEUR : il descend si la machine souffre
// quand même, il regagne un cran si elle tient (voir plafondDeRemontee).
//
// La consigne d'Adrien tranche tous les arbitrages de ce fichier :
// « il vaut mieux de la fluidité que de la qualité ». D'où la règle interne :
// un signal ne peut qu'AGGRAVER le verdict du tableau, jamais l'adoucir.
//
// ---------------------------------------------------------------------------
// CE QUE CE MODULE NE FAIT PAS
// ---------------------------------------------------------------------------
//   • Il ne rend rien, ne touche ni à three ni au DOM : tout est pur et testé
//     sans GPU (test/palier-machine.test.js), sur le modèle de boot-gate.js.
//   • Il ne PERSISTE rien et ne voyage dans aucun gabarit. Comme pixelRatio et
//     shadowRes, ces valeurs sont propres à la machine — les faire voyager
//     ferait ramer un portable avec les réglages d'une grosse machine (voir
//     le commentaire de TEMPLATE_KEYS dans templates-user.js).
//   • Il ne gagne JAMAIS contre un réglage manuel. Il ne fait que poser les
//     valeurs de DÉPART, avant que l'interface n'existe ; dès que le visiteur
//     touche « Échelle de rendu », « Ombres » ou « Résolution des ombres », le
//     drapeau `dirty` de perf.js relâche définitivement ce levier.
//
// ---------------------------------------------------------------------------
// POURQUOI PAS DE MICRO-BANC (quelques images chronométrées au démarrage)
// ---------------------------------------------------------------------------
// Ça paraît plus honnête que de lire un nom de carte, et c'est un piège :
//   1. La PREMIÈRE image d'un contexte WebGL ne mesure pas la machine, elle
//      mesure la compilation des programmes et le réveil du pilote. Sur cette
//      application, la compilation seule dépasse largement le temps de rendu.
//   2. Pour obtenir une mesure stable il faut plusieurs dizaines d'images —
//      c'est-à-dire, sur la machine lente qui nous intéresse, plusieurs
//      SECONDES. On aurait réinventé le problème des 47 secondes.
//   3. Un banc hors écran ne ressemble pas à la scène réelle (pas d'ombres,
//      pas de post-traitement) : il mesurerait le remplissage et rien d'autre.
// Les signaux statiques coûtent moins d'une milliseconde et séparent déjà les
// classes qui comptent. La vraie mesure, c'est le gouverneur — qui tourne
// pendant que le visiteur regarde, pas pendant qu'il attend.

// ---------------------------------------------------------------------------
// LE TABLEAU CROISÉ — les réglages servis par palier
// ---------------------------------------------------------------------------
// L'INDICE EST CELUI DE perf.js, délibérément : 0 FULL, 1 BALANCED, 2 LIGHT,
// 3 ESSENTIAL. Aucune traduction entre les deux fichiers, donc aucune dérive
// possible entre le palier de départ et les paliers de correction.
//
// Deux règles gouvernent chaque case, et elles viennent de la nuit du 28/07 :
//   • UNE DÉGRADATION NE DOIT PAS SE VOIR COMME UNE PANNE. Un bloc sans
//     occlusion ambiante est beau ; un bloc au dessus plat est un bug. C'est
//     pourquoi les ombres passent par 'static' avant de disparaître, et
//     pourquoi les nuages — l'identité de la scène — ne sont jamais coupés,
//     seulement raréfiés.
//   • LA CARTE RESTE CALME. Ces valeurs sont posées AVANT le premier rendu.
//     Rien ne bascule sous les yeux du visiteur ; les changements à chaud
//     restent l'affaire du gouverneur, avec ses 20 s d'hystérésis.
//
// ---------------------------------------------------------------------------
// DEUX CASES ONT CHANGÉ POUR TOUT LE MONDE LE 28/07/2026 (demande d'Adrien)
// ---------------------------------------------------------------------------
// Elles ne dépendent plus du palier : elles valent la même chose des quatre
// lignes, parce que la demande était « par défaut », pas « sur les machines
// faibles ». Les deux restent entièrement rattrapables à la main.
//
// L'OCCLUSION AMBIANTE — `ssao: false` partout (elle valait true aux paliers 0
// et 1). C'est une passe de scène ENTIÈRE en plus, et sur une carte vue de
// haut, presque à plat, elle ne noircit que le fond des vallées : cher pour ce
// qu'elle rend. ⚠️ CE CHAMP DIT DÉSORMAIS L'ÉTAT DE DÉPART, PAS LA PERMISSION.
// perf.js garde son propre plafond (`_aoTierOk = n < 2`) et l'interrupteur
// « Ombrage des creux » du panneau Effets reste libre : qui l'allume le garde.
//
// LA CARTE D'OMBRES — `ombresRes: 1024` partout (2048 aux paliers 0 et 1).
// ⚠️ NE PAS SE TROMPER SUR CE QUE ÇA ÉCONOMISE : la résolution de la carte
// d'ombres ne retire PAS UN SEUL TRIANGLE. La passe d'ombre dessine exactement
// les mêmes objets, dans une texture quatre fois plus petite. Ce qu'on gagne
// est réel mais ailleurs : le remplissage, les deux passes de flou VSM
// (blurSamples 16) qui balayent toute la carte à chaque image en mode
// dynamique, et 16 Mo → 4 Mo de mémoire vidéo alloués AVANT la première image
// (c'était le premier gel visible du démarrage). Les triangles de la passe
// d'ombre, eux, se coupent en changeant QUI y entre — c'est ce que fait
// block-grid.js pour les dalles voisines du damier.
//
// La barre haute de pixels vit dans viewport.js, avec le reste de ce qui
// décide de la taille du tampon de dessin. On l'importe plutôt que de la
// recopier : deux plafonds qui divergent, c'est le genre d'écart qu'on ne
// découvre que sur la machine d'un visiteur.
import { PLAFOND_MPX } from './viewport.js'

export const PALIERS = [
  {
    // 0 — PLEINE QUALITÉ. Cartes dédiées et Apple Silicon sur un écran normal.
    // C'est l'état d'AVANT ce module : si un réglage change ici, c'est une
    // régression pour la majorité du trafic.
    nom: 'PLEINE QUALITÉ',
    densiteMax: 2, // = MAX_PIXEL_RATIO (viewport.js) : au-delà, gain nul, coût quadratique
    budgetMpx: 16, // laisse passer un 5K à densité 2 (14,7) sans y toucher
    ombres: 'dynamic',
    ombresRes: 1024, // 2048 avant le 28/07 — voir « LA CARTE D'OMBRES » plus haut
    ssao: false, // true avant le 28/07 — voir « L'OCCLUSION AMBIANTE » plus haut
    // PLUS de colonne `bloom` dans AUCUN palier : la passe de bloom a été
    // retirée du produit le 2026-08-02 (Adrien : « inutile, on retire »). Elle
    // valait true/true/true/false — le halo tenait jusqu'au palier plancher.
    // Une colonne qui décrit une passe qui n'existe plus est une ligne de
    // budget fantôme, et ce tableau ne sert qu'à condition d'être exact.
    dof: true,
    grain: true,
    verreMer: 6, // taps du verre de mer (MeshTransmissionMaterial)
    nuages: 0, // indice de clouds-sim.js : 0 = 4 grappes. Il MONTE quand la qualité baisse.
    damierMax: 24, // cellules voisines (5×5 moins le centre)
    analyseMax: 0, // 0 = analyse de relief à pleine taille du MNT
  },
  {
    // 1 — ÉQUILIBRÉ. Circuits intégrés récents (Iris Xe, UHD 7xx, Vega), et le
    // cas « je ne sais pas » : on n'offre pas le maximum à une carte anonyme,
    // mais on ne l'abîme pas non plus — le gouverneur peut lui rendre le cran.
    nom: 'ÉQUILIBRÉ',
    densiteMax: 1.5,
    budgetMpx: 6,
    ombres: 'dynamic', // encore dynamiques : c'est le mouvement du soleil qui fait la carte
    ombresRes: 1024, // idem palier 0 — voir « LA CARTE D'OMBRES » plus haut
    ssao: false, // idem palier 0 — voir « L'OCCLUSION AMBIANTE » plus haut
    dof: true,
    grain: true,
    verreMer: 4,
    nuages: 1,
    damierMax: 12,
    analyseMax: 0,
  },
  {
    // 2 — ALLÉGÉ. L'iMac 2015 et les vieux portables. Deux décisions se jouent
    // ici : l'occlusion ambiante part (une passe de scène ENTIÈRE en plus,
    // c'est le levier le plus cher pour ce qu'il rend), et les ombres passent
    // en 'static' — elles ne suivent plus le soleil, mais elles sont LÀ. Les
    // couper ferait croire à un relief cassé.
    nom: 'ALLÉGÉ',
    densiteMax: 1,
    budgetMpx: 3.2,
    ombres: 'static',
    ombresRes: 1024,
    ssao: false,
    dof: false,
    grain: true,
    verreMer: 2,
    nuages: 2,
    damierMax: 8,
    analyseMax: 1024, // l'analyse de relief bloque le fil principal ~390 ms en 1536²
  },
  {
    // 3 — ESSENTIEL. Rendu logiciel, téléphones, écrans démesurés sur petite
    // carte. Ici on ne négocie plus : il reste la carte, son relief, ses
    // couleurs et son ciel. C'est encore ShibuMap, en moins fin.
    nom: 'ESSENTIEL',
    densiteMax: 0.85,
    budgetMpx: 2.1,
    ombres: 'off',
    ombresRes: 1024,
    ssao: false,
    dof: false,
    grain: false,
    verreMer: 2,
    nuages: 3,
    damierMax: 4,
    analyseMax: 768,
  },
]

// Plancher de densité — c'est aussi le minimum de la tirette « Échelle de
// rendu » (camera-panel.js). En dessous, le texte des étiquettes devient
// illisible : on aurait échangé de la lenteur contre de l'illisibilité.
export const PLANCHER_DENSITE = 0.5

// ---------------------------------------------------------------------------
// LES LIGNES DU TABLEAU — classer la carte graphique par son nom
// ---------------------------------------------------------------------------
export const CLASSES_CARTE = ['logiciel', 'faible', 'moyen', 'fort', 'inconnu']

// ⚠️ L'ORDRE DE CES MOTIFS EST LA MOITIÉ DU TRAVAIL. Les noms se recouvrent :
// « Intel Iris Pro » (2015, faible) et « Intel Iris Xe » (2021, moyen)
// partagent le mot « Iris » ; « ANGLE (…SwiftShader…) » contient aussi le mot
// « Vulkan ». On teste donc du plus SPÉCIFIQUE au plus général, et on s'arrête
// au premier motif qui prend.
const MOTIFS = [
  // 1. Le rendu LOGICIEL, en tout premier : c'est le seul verdict sans appel.
  //    Le processeur dessine chaque pixel ; aucun réglage ne sauve ce cas, et
  //    il arrive vraiment (pilote sur liste noire, machine virtuelle, RDP).
  [/swiftshader|llvmpipe|softpipe|basic render|software adapter|generic renderer/i, 'logiciel'],

  // 2. Le matériel FORT, avant les motifs de fabricants : « Apple M1 » doit
  //    être vu avant qu'un motif « apple » générique ne l'attrape, et
  //    « Radeon RX » avant « Radeon » tout court (les vieux R5/R7 intégrés).
  [/\bapple m\d/i, 'fort'], // M1…M5 et leurs déclinaisons Pro/Max/Ultra
  [/\bapple a1[5-9]\b|\bapple a[2-9]\d\b/i, 'fort'], // iPhone récents (A15+)
  [/nvidia|geforce|quadro|\brtx\b|\bgtx\b|tesla/i, 'fort'],
  [/radeon (rx|pro)|\brx \d{3,4}\b|firepro/i, 'fort'],
  [/\barc\b.*graphics|intel\(r\) arc/i, 'fort'], // Intel Arc, cartes dédiées
  [/adreno.*\b(7\d\d|8\d\d)\b/i, 'fort'], // téléphones haut de gamme récents
  [/mali-g[7-9]\d/i, 'fort'],

  // 3. Le matériel FAIBLE — celui qui a motivé ce fichier. Chaque motif
  //    correspond à du matériel réellement croisé, pas à une supposition.
  [/iris\(tm\) pro|iris pro/i, 'faible'], // iMac 27" 2015 : LE cas du 28/07/2026
  // ⚠️ LE `\b` DEVANT « hd » N'EST PAS DÉCORATIF : sans lui, « UHD Graphics 770 »
  // (2021, correct) contient « HD Graphics 770 » et tombait dans la ligne des
  // circuits de 2012. Une génération entière de portables punie par deux
  // caractères manquants.
  [/\bhd graphics [2-6]\d{3}/i, 'faible'], // HD 2000→6000 : 2011-2015
  [/\bhd graphics \d{3}\b/i, 'faible'], // HD 400→630 : Skylake/Kaby Lake, 2015-2017
  // …et l'UHD 6xx (2017-2019) est le MÊME circuit rebaptisé : « UHD Graphics
  // 620 » est un HD 620 avec un U devant. Le motif « uhd » plus bas, lui, vise
  // les UHD 7xx/verte génération (2021+), qui sont autre chose. D'où ce motif
  // ici, AVANT le générique : sans lui, un portable de 2018 passait « moyen ».
  [/\buhd graphics 6\d\d\b/i, 'faible'],
  [/\bhd graphics\b(?!.*\d)/i, 'faible'], // « Intel HD Graphics » nu = très ancien
  [/gma|\bgma\b|intel\(r\) g\d\d/i, 'faible'],
  [/mali-(4\d\d|t\d+)/i, 'faible'], // Mali-400 / Mali-T : entrée de gamme
  [/adreno.*\b([3-5]\d\d)\b/i, 'faible'],
  [/powervr (sgx|series[45])/i, 'faible'],
  [/geforce (8|9)\d{2}m?\b|geforce gt \d{3}\b/i, 'faible'], // dédiées d'il y a quinze ans

  // 4. Le matériel MOYEN — intégrés récents. Ils font tourner des jeux ; les
  //    confondre avec la ligne du dessus punirait une génération entière de
  //    portables corrects.
  [/iris xe|iris\(r\) xe/i, 'moyen'],
  [/uhd graphics|intel\(r\) uhd/i, 'moyen'],
  [/vega \d|radeon graphics|radeon r[4-7]/i, 'moyen'],
  [/adreno.*\b6\d\d\b/i, 'moyen'],
  [/mali-g[1-6]\d?\b/i, 'moyen'],
  [/\bapple a\d{1,2}\b/i, 'moyen'], // A9→A14 : corrects, pas des foudres de guerre
  [/\bintel\b/i, 'moyen'], // filet Intel : un nom Intel inconnu est au mieux moyen
]

// Le nom de la carte → sa classe. Jamais d'exception, jamais de `undefined` :
// ce qu'on ne reconnaît pas est « inconnu », et « inconnu » a sa propre ligne.
export function classerCarte(nom) {
  if (typeof nom !== 'string' || !nom.trim()) return 'inconnu'
  for (const [re, classe] of MOTIFS) if (re.test(nom)) return classe
  return 'inconnu'
}

// ---------------------------------------------------------------------------
// LES COLONNES DU TABLEAU — la charge de pixels
// ---------------------------------------------------------------------------
// La carte seule ne suffit pas : le MÊME Iris Pro tient un 1366×768 et
// s'effondre sur un 5K. Ce qu'on mesure, c'est le nombre de pixels que la
// machine devrait pousser à chaque image si on la laissait faire — donc la
// taille d'écran MULTIPLIÉE par le carré de la densité.
//
// ⚠️ ON LIT `screen`, PAS `window`. La fenêtre peut être petite à l'ouverture
// et maximisée trois secondes plus tard ; l'écran, lui, ne change pas. Et le
// but est justement de ne pas avoir à redécider en cours de route (« la carte
// reste calme »).
//
// Les seuils correspondent à des machines qu'on voit vraiment :
//   0 LÉGER    ≤ 2,5 Mpx — 1080p à densité 1, et tous les vieux portables
//   1 MOYEN    ≤ 6   Mpx — 1440p à densité 1, portable Retina 14" à densité 2
//   2 LOURD    ≤ 16  Mpx — 4K à densité 1, iMac 5K à densité 2 (14,7)
//   3 ÉCRASANT   >  16 Mpx — 4K à densité 2 (33 Mpx), 6K, murs d'écrans
export const SEUILS_CHARGE = [2.5, 6, 16]

export function classerCharge(mpx) {
  if (!Number.isFinite(mpx) || mpx <= 0) return 0 // ne rien savoir ne doit pas dégrader
  for (let i = 0; i < SEUILS_CHARGE.length; i++) if (mpx <= SEUILS_CHARGE[i]) return i
  return 3
}

// ---------------------------------------------------------------------------
// LE TABLEAU CROISÉ LUI-MÊME : classe de carte × charge de pixels → palier
// ---------------------------------------------------------------------------
//
//                      LÉGER   MOYEN   LOURD   ÉCRASANT
//   logiciel             3       3       3        3
//   faible               2       2       2        3
//   moyen                1       1       2        3
//   fort                 0       0       0        1
//   inconnu              1       1       2        3
//
// Ce qu'il faut lire dedans :
//   • « logiciel » est plat : la taille de l'écran n'y change rien, c'est le
//     processeur qui dessine.
//   • « faible » est plat jusqu'à l'écrasant, et c'est VOLONTAIRE : le palier 2
//     rabat déjà la densité à 1 puis la borne à 3,2 Mpx, soit 4,6 fois moins de
//     pixels que ce que l'iMac 2015 poussait. Le descendre d'office à 3
//     l'aurait privé de ses ombres pour rien. Si 2 ne suffit pas, le gouverneur
//     le voit désormais en ~9 s (et non 47) et finit le travail.
//   • « fort » ne cède qu'à l'écrasant : même une RTX ne tient pas un 8K à
//     densité 2 à 60 images par seconde.
//   • « inconnu » est prudent, pas punitif — il vaut la ligne « moyen ». C'est
//     exactement le cas que plafondDeRemontee rattrape (voir plus bas).
export const TABLEAU = {
  logiciel: [3, 3, 3, 3],
  faible: [2, 2, 2, 3],
  moyen: [1, 1, 2, 3],
  fort: [0, 0, 0, 1],
  inconnu: [1, 1, 2, 3],
}

// ---------------------------------------------------------------------------
// LES CORRECTIFS — ce que le nom ne dit pas, les limites le disent
// ---------------------------------------------------------------------------
// Les noms mentent : marques recyclées, pilotes génériques, ANGLE qui renomme,
// navigateurs qui masquent. Les limites de la carte, elles, sont des faits.
// Chaque correctif ne peut que TIRER LE PALIER VERS LE BAS — jamais l'inverse.
// Un signal généreux (32 cœurs, 64 Go) ne rachète pas une carte faible.
function correctifs(s, raisons) {
  let plancher = 0
  const pousse = (p, pourquoi) => {
    if (p > plancher) plancher = p
    raisons.push(pourquoi)
  }

  // MAX_TEXTURE_SIZE date le circuit sans ambiguïté — et c'est la MÊME limite
  // qui fait raboter le tampon de dessin par Chrome, une dimension à la fois et
  // sans un mot (voir viewport.js). Une carte à 2048 est aussi une carte qui va
  // déformer l'image si on ne la borne pas.
  if (s.maxTexture > 0 && s.maxTexture <= 2048) pousse(3, `limite de texture ${s.maxTexture} px — circuit très ancien`)
  else if (s.maxTexture > 0 && s.maxTexture <= 4096) pousse(2, `limite de texture ${s.maxTexture} px — circuit ancien`)

  // WebGL2 GARANTIT 16 unités de texture et 224 vecteurs d'uniformes en
  // fragment. En dessous des seuils ci-dessous, on est sur une implémentation
  // au rabais (émulation, pilote de secours) quoi qu'annonce le nom.
  if (s.maxUnites > 0 && s.maxUnites < 16) pousse(2, `${s.maxUnites} unités de texture seulement`)
  if (s.maxUniformsFrag > 0 && s.maxUniformsFrag < 256) pousse(2, `${s.maxUniformsFrag} uniformes fragment seulement`)

  // Le processeur compte : la simulation des nuages, le drapage GPX et le
  // décodage des tuiles tiennent sur le fil principal. Deux cœurs, c'est une
  // machine où le rendu et le chargement se disputent le même cœur.
  if (s.coeurs > 0 && s.coeurs <= 2) pousse(2, `${s.coeurs} cœur(s) logique(s)`)
  // deviceMemory n'existe QUE sur Chrome et est arrondi à la puissance de deux
  // inférieure. Absent = on ne sait pas, et ne pas savoir ne dégrade rien.
  if (s.memoire > 0 && s.memoire <= 2) pousse(2, `${s.memoire} Go de mémoire annoncés`)

  return plancher
}

// ---------------------------------------------------------------------------
// LE VERDICT
// ---------------------------------------------------------------------------
// Pur : mêmes signaux, même réponse, testable sans navigateur.
export function estimerPalier(signaux = {}) {
  const s = normaliser(signaux)
  const raisons = []
  const carte = classerCarte(s.carte)
  const [lw, lh] = s.ecran
  const densiteEcran = Math.min(2, s.densite > 0 ? s.densite : 1)
  const mpx = (lw * lh * densiteEcran * densiteEcran) / 1e6
  const charge = classerCharge(mpx)

  const duTableau = TABLEAU[carte][charge]
  raisons.push(
    `carte « ${s.carte || 'non communiquée'} » → ${carte} ; `
    + `${lw}×${lh} à densité ${densiteEcran} = ${mpx.toFixed(1)} Mpx → charge ${['légère', 'moyenne', 'lourde', 'écrasante'][charge]}`
  )
  const plancher = correctifs(s, raisons)
  const palier = Math.max(duTableau, plancher)
  if (plancher > duTableau) raisons.push(`palier ${duTableau} du tableau enfoncé à ${palier} par les limites lues`)

  return { palier, carte, charge, mpx, densiteEcran, raisons }
}

// ---------------------------------------------------------------------------
// LES RÉGLAGES SERVIS — le palier plus le budget de pixels
// ---------------------------------------------------------------------------
// LE BUDGET EST LE DERNIER FILET, et c'est lui qui répare vraiment l'iMac.
// Le palier fixe un PLAFOND de densité (2 / 1,5 / 1 / 0,85) ; le budget fixe un
// plafond de PIXELS. Sur un écran ordinaire le budget ne mord jamais — une RTX
// en 1080p garde exactement sa densité 1, et c'est le test de non-régression
// qui compte le plus dans ce fichier. Sur un 5K il devient la contrainte
// active : 3,69 Mpx d'écran, budget 3,2 → densité 0,93, soit 4,6 fois moins de
// pixels qu'avant sans qu'aucune constante ne mentionne « 5K » nulle part.
//
// On recule la DENSITÉ, jamais une dimension : c'est la même règle que
// fitDrawingBuffer (viewport.js). Rogner un côté déforme l'image ; reculer la
// densité multiplie les deux côtés par le même facteur.
export function reglagesServis(signaux = {}) {
  const e = estimerPalier(signaux)
  const p = PALIERS[e.palier]
  const s = normaliser(signaux)
  const [lw, lh] = s.ecran
  const mpxBase = (lw * lh) / 1e6 // l'écran à densité 1

  // LA BARRE HAUTE COMMUNE (PLAFOND_MPX, viewport.js) passe avant le budget du
  // palier : elle vaut pour tout le monde, y compris la machine la plus forte.
  // Sans elle, le palier 0 promettait 16 Mpx ici pendant qu'applyRenderSize en
  // servait 3,69 — deux chiffres pour la même image, et `mpxServis` mentait.
  const budget = Math.min(p.budgetMpx, PLAFOND_MPX)
  const parBudget = mpxBase > 0 ? Math.sqrt(budget / mpxBase) : p.densiteMax
  let densite = Math.min(p.densiteMax, e.densiteEcran, parBudget)
  // ⚠️ ON ARRONDIT VERS LE BAS, pas au plus proche. Un plafond qui arrondit
  // vers le haut n'est pas un plafond : mesuré sur le MacBook M1, la densité
  // juste valait 1,575 et l'arrondi au centième la remontait à 1,58 — soit
  // 3,71 Mpx servis pour une barre à 3,69. Deux centièmes de densité ne se
  // voient pas ; une barre qu'on peut franchir ne sert à rien.
  densite = Math.max(PLANCHER_DENSITE, Math.floor(densite * 100) / 100)
  if (parBudget < Math.min(p.densiteMax, e.densiteEcran) - 1e-6) {
    e.raisons.push(`budget de ${budget} Mpx : densité ramenée à ${densite}`)
  }

  return {
    ...p,
    palier: e.palier,
    nom: p.nom,
    densite,
    mpxServis: Math.round(mpxBase * densite * densite * 100) / 100,
    carte: e.carte,
    charge: e.charge,
    raisons: e.raisons,
  }
}

// ---------------------------------------------------------------------------
// L'ACCORD AVEC LE GOUVERNEUR (perf.js)
// ---------------------------------------------------------------------------

// Le palier où la session DÉMARRE. Les règles d'appareil de perf.js restent
// souveraines : un téléphone n'atteint l'application que comme visionneuse
// d'une shibu partagée, il part au plancher quelle que soit sa carte (un
// Adreno 750 est « fort », et pourtant on ne veut pas de pleine qualité sur un
// écran de poche qui chauffe). La détection ne peut donc que RENFORCER la
// sévérité, jamais l'alléger.
export const palierDeDepart = (palierMachine, { phone = false, coarse = false } = {}) =>
  Math.max(0, Math.min(3, Math.max(Number.isFinite(palierMachine) ? palierMachine : 0, phone ? 3 : coarse ? 1 : 0)))

// Jusqu'où le gouverneur a le droit de REMONTER si la machine tient.
//
// La détection statique n'est pas une mesure : c'est une estimation. Elle peut
// être un cran trop sévère — carte masquée par Firefox ou Safari, nom
// inconnu, pilote générique. On lui laisse donc regagner exactement UN palier,
// et pas deux : deux crans au-dessus, ce serait autoriser la pleine qualité sur
// un iMac 2015, c'est-à-dire refaire la panne. La remontée garde par ailleurs
// toutes ses conditions (12 s au-dessus de 55 images/s, 20 s entre deux
// changements) — la carte reste calme.
//
// Sur un appareil tactile, aucune remontée : la règle d'appareil prime.
export const plafondDeRemontee = (palierDepart, { phone = false, coarse = false } = {}) =>
  phone || coarse ? palierDepart : Math.max(0, palierDepart - 1)

// ---------------------------------------------------------------------------
// LA CONNEXION — une AUTRE échelle, qui ne touche pas au rendu
// ---------------------------------------------------------------------------
// Adrien voulait la connexion dans l'équation. Elle y est, mais sur son propre
// axe : une fibre ne rend pas un Iris Pro plus rapide, et une 3G ne fait pas
// tomber une image de moitié. Ce que la connexion gouverne, ce sont les TUILES
// — combien on en charge, à quel zoom, et si on ose la photo aérienne.
//
// L'API n'existe ni sur Safari ni sur Firefox. Absente = on ne bride rien :
// brider à l'aveugle serait pire que le mal (même règle que glSizeLimit).
export function classerReseau(conn) {
  if (!conn) return { classe: 'rapide', aerienAuto: true, raison: 'API absente — on ne bride pas à l’aveugle' }
  // saveData est une demande EXPLICITE du visiteur, pas une mesure : elle bat
  // tout le reste, y compris une 4G parfaite.
  if (conn.saveData) return { classe: 'tres-lent', aerienAuto: false, raison: 'économiseur de données activé' }
  const t = String(conn.effectiveType || '')
  const d = Number(conn.downlink)
  if (t === 'slow-2g' || t === '2g') return { classe: 'tres-lent', aerienAuto: false, raison: `connexion ${t}` }
  if (t === '3g' || (Number.isFinite(d) && d > 0 && d < 2)) {
    return { classe: 'lent', aerienAuto: false, raison: t === '3g' ? 'connexion 3g' : `débit ${d} Mb/s` }
  }
  return { classe: 'rapide', aerienAuto: true, raison: t ? `connexion ${t}` : 'connexion non qualifiée' }
}

// ---------------------------------------------------------------------------
// LA LECTURE DES SIGNAUX — hostile par défaut
// ---------------------------------------------------------------------------
// Ce code tourne AVANT tout le reste, dans le navigateur d'un inconnu, et une
// exception ici laisserait la planète de chargement tourner pour toujours —
// exactement ce que boot-gate.js existe pour empêcher. D'où le try/catch autour
// de CHAQUE lecture : `getExtension` peut lever quand WebGL est désactivé à
// moitié, et `getParameter` sur un contexte perdu aussi.
const lire = (f, defaut = 0) => { try { const v = f(); return v == null ? defaut : v } catch { return defaut } }

export function lireSignaux({ gl = null, nav = null, win = null } = {}) {
  const n = nav || (typeof navigator === 'undefined' ? {} : navigator)
  const w = win || (typeof window === 'undefined' ? {} : window)
  const ecran = w.screen || (typeof screen === 'undefined' ? null : screen)

  let carte = ''
  let maxTexture = 0
  let maxUnites = 0
  let maxUniformsFrag = 0
  if (gl) {
    // WEBGL_debug_renderer_info donne le nom DÉMASQUÉ. Sans lui, RENDERER
    // renvoie « WebKit WebGL » ou « Mozilla » : un nom qui ne dit rien, ce qui
    // n'est pas la même chose qu'un nom absent — les deux finissent en
    // « inconnu », et c'est la bonne réponse dans les deux cas.
    const dbg = lire(() => gl.getExtension('WEBGL_debug_renderer_info'), null)
    carte = String(
      (dbg && lire(() => gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL), '')) || lire(() => gl.getParameter(gl.RENDERER), '') || ''
    )
    maxTexture = Number(lire(() => gl.getParameter(gl.MAX_TEXTURE_SIZE))) || 0
    maxUnites = Number(lire(() => gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS))) || 0
    maxUniformsFrag = Number(lire(() => gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS))) || 0
  }

  return {
    carte,
    maxTexture,
    maxUnites,
    maxUniformsFrag,
    coeurs: Number(n.hardwareConcurrency) || 0,
    memoire: Number(n.deviceMemory) || 0,
    densite: Number(w.devicePixelRatio) || 1,
    // LA FENÊTRE D'ABORD, L'ÉCRAN EN REPLI — PF4. La surface qu'on va DESSINER
    // est la fenêtre (c'est elle qu'applyRenderSize mesure et que le budget de
    // pixels peut réduire), pas le moniteur. Mesuré : dans le panneau navigateur
    // de session, `screen` rend 1920×1080 pendant que la fenêtre fait 563×419 ;
    // en Chrome sans tête, `screen` rend un fantôme de 800×600 pour une fenêtre
    // de 1280×800 — dans les deux cas le palier se décidait sur une surface qui
    // n'existe pas. Le repli sur `screen` reste : un panneau pas encore mis en
    // page rend une fenêtre à 0 (vérifié le 28/07/2026), et un écran à 0 remet
    // la charge à « légère », le palier le plus généreux — la machine qu'on
    // veut protéger repasserait en pleine qualité par un chemin silencieux.
    ecran: [
      Number(w.innerWidth) || Number(ecran?.width) || 0,
      Number(w.innerHeight) || Number(ecran?.height) || 0,
    ],
    pointeurGrossier: !!lire(() => w.matchMedia?.('(pointer: coarse)').matches, false),
    reseau: n.connection || null,
  }
}

// Valeurs par défaut communes à estimerPalier et reglagesServis : les deux
// doivent voir EXACTEMENT les mêmes nombres, sinon le palier et la densité
// racontent deux histoires différentes.
function normaliser(s = {}) {
  const e = Array.isArray(s.ecran) ? s.ecran : [0, 0]
  return {
    carte: typeof s.carte === 'string' ? s.carte : '',
    maxTexture: Number(s.maxTexture) || 0,
    maxUnites: Number(s.maxUnites) || 0,
    maxUniformsFrag: Number(s.maxUniformsFrag) || 0,
    coeurs: Number(s.coeurs) || 0,
    memoire: Number(s.memoire) || 0,
    densite: Number(s.densite) || 1,
    ecran: [Number(e[0]) || 0, Number(e[1]) || 0],
    pointeurGrossier: !!s.pointeurGrossier,
  }
}

// ---------------------------------------------------------------------------
// LA SONDE — un seul appel, mémorisé, chronométré
// ---------------------------------------------------------------------------
// boot.js la déclenche au plus tôt (il vient déjà de créer un contexte WebGL2
// pour la carte de refus — on lui redemande le sien plutôt que d'en fabriquer
// un second), main.js relit le résultat mémorisé. Deux contextes pour la même
// réponse, ce serait payer deux fois le seul coût réel de cette détection.
//
// `ms` voyage AVEC le verdict, délibérément : Adrien a demandé que le test se
// fasse « dans les millisecondes de l'ouverture ». Une promesse qui ne se
// mesure pas ne tient pas ; celle-ci s'affiche.
let _memo = null

export function sonderMachine({ gl = null, nav = null, win = null, memo = true } = {}) {
  if (memo && _memo) return _memo
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  let r
  try {
    const signaux = lireSignaux({ gl, nav, win })
    r = { ...reglagesServis(signaux), signaux, reseau: classerReseau(signaux.reseau) }
  } catch (err) {
    // Un défaut de la sonde ne doit JAMAIS empêcher l'application de démarrer.
    // Sans verdict, on retombe sur le comportement d'avant ce module : palier 0
    // et la densité de l'écran — c'est-à-dire exactement ce qui existait.
    r = { ...PALIERS[0], palier: 0, densite: 1, mpxServis: 0, carte: 'inconnu', charge: 0, raisons: [`sonde en échec : ${err?.message || err}`], signaux: null, reseau: classerReseau(null) }
  }
  r.ms = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 1000) / 1000
  if (memo) _memo = r
  return r
}

// Le verdict déjà rendu, s'il l'a été. main.js s'en sert pour l'exposer sur
// window sans risquer de déclencher une seconde sonde.
export const palierMemorise = () => _memo
