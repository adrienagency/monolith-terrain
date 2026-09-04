// MONOLITH EARTH — the orbital globe. A quadtree of curved patches streams
// terrarium elevation tiles (z2 → z15 ; le chemin de PRODUCTION n'y descend
// pas — son plancher de `dist` l'arrête à z11, voir `PLANCHER_DIST`) and a
// custom shader re-creates the vintage-topo recipe at planet scale:
// hypsometric ramp, bathymetric blues, contour lines, 10° graticule, paper
// noise. Refinement is hole-free: a tile only subdivides once all four
// children have their data, so the parent keeps rendering until then.
// A slowly orbiting cloud shell (globe-clouds.js) dresses the planet view.
//
// ⚠️ LA SOURCE N'EST PLUS UNE URL EN DUR, C'EST LA POLITIQUE DE `dem-source.js`
// (plan « globe continu », Tâche 4 alpha) — voir `planTuile` plus bas, et sa
// borne `SEUIL_SOURCE_FINE`.

import * as THREE from 'three'
import { R_GLOBE, MERCATOR_MAX_LAT, EARTH_RADIUS_M, tileToLatLon, latLonToSphere } from './geo.js'
import { rampColorStops } from './palette.js'
import { GlobeClouds } from './globe-clouds.js'
import { amontDemande, creerFabriqueMateriau, habillerPhotoTuile, libererMateriauTuile } from './monde/materiau-tuile.js'
import { bandeBruitAdmise, fuseBathymetry, overzoomTile, resolutionBathyM } from './bathy.js'
// ⚠️ `dem.js` N'IMPORTE PAS `globe.js` (il s'en garde explicitement, voir
// l'encart de `memo-tuiles-mnt.js`) : le sens unique est acquis, pas espéré.
import { peindreBathyTuile, indexBathy } from './dem.js'
import { zoneAt } from './bathy-sources.js'

// LE BLEU DE NUIT DE LA PLANETE — Tache R7, tour de correction. La face nuit ne
// fond plus vers le fond du decor NU (creme en theme clair, ce qui EFFACAIT la
// carte) : elle fond vers ce fond REFROIDI vers ce bleu. La quantite de
// refroidissement est un uniforme, NULLE en production. Voir setNuitPlanete.
const NUIT_FROIDE = new THREE.Color('#0e1a2b')
// LA FORME DU CROP — Tâche A, « UNE SEULE TERRE ». Module PUR : il n'apporte ni
// three ni DOM, et c'est lui qui lit `empriseSocle`, pas ce fichier.
import { repereCrop, coinNormalise, zoomCropPrescrit, tuileDansCrop, mercX, mercY } from './monde/crop-sphere.js'
// LES PAROIS ET LA BASE — Tâche B. Pur lui aussi : il ne rend que des nombres,
// c'est ce fichier-ci qui en fait une géométrie three.
import { construireSolideCrop, normalesParois, rabattementBorne, localDeAbsolu, jupesEffacees } from './monde/parois-crop.js'
import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M, COTE_CROP_UNITES, largeurCropM, pasGrilleBloc } from './monde/habillage-crop.js'
import {
  RAMPE_MONDE,
  GRADE_MONDE,
  PAS_MESURE,
  mesurerRelief,
  echelleRampe,
  plancherRampeDuCrop,
  // LE REGIME DU MONDE HORS DE LA DECOUPE — Tache R28, §⑥ de rampe-crop.js.
  // ⚠️ **DES CONSTANTES DE NUANCEUR, PAS DES UNIFORMES** : RAMPE_MONDE et
  // GRADE_MONDE sont geles et personne ne les repose. Le pourquoi chiffre est
  // au point d'injection.
  GLSL_REGIME_MONDE,
  // LE RECOLLAGE DES DEUX ECHELLES — Tache R31, §⑦ de rampe-crop.js.
  // ⚠️ **DEUX FONCTIONS PURES, PAS UNE REGLE RECOPIEE ICI** : la loi se
  // verifie sous node, et `globe.js` ne fait que poser sa valeur.
  poidsRecollage,
  // LE GRADE DU BLOC — Tache GRA, §⑨ de rampe-crop.js.
  // ⚠️ **DEUX FONCTIONS PURES, VERIFIABLES SOUS NODE** : `gradeCrop` rend le
  // pivot et la fenetre du bloc EN METRES (donc sans domaine), `gradeBlocEffectif`
  // les convertit dans le domaine VIVANT du nuanceur et y compose le curseur
  // d'Adrien. `globe.js` ne fait que poser leur valeur.
  gradeCrop,
  gradeBlocEffectif,
} from './monde/rampe-crop.js'
// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. Pur lui aussi : il ne rend que
// des nombres. ⚠️ **C'EST LUI QUI TIENT LES QUATRE NOMBRES DE RAMPE, ET PLUS
// `poserRampe`** — les mesures y sont ANCRÉES par cran d'altitude, la valeur
// posée est celle d'une courbe monotone. Sans ancre, il rend `RAMPE_MONDE` :
// la production est intouchée au bit près.
import {
  creerEchelleContinue,
  ancrerMesure,
  majEchelle,
  lireEchelle,
  oublierAncres,
} from './monde/echelle-continue.js'
// LA MER — Tâche F, « partout et dégradée avec la distance ». Pur lui aussi :
// il rend des nombres et des tampons, c'est ce fichier-ci qui en fait une
// géométrie three. ⚠️ **`ocean.js` N'EST PAS IMPORTÉ ICI, ET C'EST DÉLIBÉRÉ** :
// il tire `ocean-waves` par un ALIAS de Vite, que node ne résout pas — et
// `test/crop-rampe.test.js` charge `Globe` sous node. Les morceaux de nuanceur
// partagés arrivent donc par une importation DYNAMIQUE, dans `poserMer`.
import {
  bordDeMer,
  PORTEE_CROP,
  construireCalotte,
  richesseMer,
  distanceBascule,
  bandeDegradation,
  distanceRivage,
  RAMPE_NAUTIQUE,
  epsilonMerDuCrop,
  budgetProfondeurM,
  echelleHouleM,
  seuilTraitEauM,
  empriseCalotte,
  porteeHorizon,
  PORTEE_DEFAUT,
  construireJupeMer,
  MARGE_EAU_CROP,
  GLSL_JUPE_MER,
  // ⚠️ **TÂCHE P5 — LES DEUX ENTRÉES DU FOND MARIN QUE PERSONNE NE POSAIT.**
  // `couleursFondDuSocle` LIT la palette vivante du socle (la calotte gelait le
  // défaut de `terrain.js`) ; `profondeurMaxDuCrop` mesure le budget sur le
  // CROP et non sur la calotte (×1,658 à La Réunion). Les deux en-têtes portent
  // les relevés bruts.
  couleursFondDuSocle,
  profondeurMaxDuCrop,
} from './monde/mer-sphere.js'
// ⚠️ **LE FOV CANONIQUE, PAS UNE CONSTANTE RECOPIÉE.** Tour de correction 1 de
// la Tâche F : le défaut de `poserMer` portait `33`, une valeur qui n'existe
// nulle part ailleurs dans le dépôt. `FOV_DEG` est LA source du DÉFAUT — la
// ligne `fov: 30` des réglages de `main.js` (⚠️ **PAS `main.js:263`, qui parle du
// maillage du bloc central : citation fausse dans le commentaire même qui
// réparait une source fausse, corrigée le 2026-08-21 par la Tâche I**), et c'est
// elle qui alimente `SEUIL_BLOC_M` (32 274 m), le chiffre auquel la bascule de
// la mer se compare. ⚠️ **NOM CORRIGÉ LE 2026-09-04** : ce commentaire disait
// `SEUIL_NAISSANCE_M`, ce qui était FAUX pendant D21 ② — la naissance du crop
// valait alors le palier z7 (600 km), qui ne descend d'aucun champ de vision.
// Depuis D23 les deux valent de nouveau la même chose ; raison de plus de
// nommer celle qui porte le SENS, pas celle qui coïncide.
// ⚠️ **ET CE N'EST QU'UN DÉFAUT.** Relevé sur l'application VIVANTE le
// 2026-08-21 : `params.fov = 33`, `camera.fov = 33`, `camGlobe.fov = 33` —
// `templates-user.js` sauvegarde `'fov'`, donc un template appliqué au démarrage
// repose `params.fov`. « 33 n'existe nulle part dans le dépôt » était vrai de la
// SOURCE et faux de ce qui tourne : **l'appelant doit passer le fov vivant.**
import { FOV_DEG } from './monde/seuil-socle.js'
// L'EXAGÉRATION PARTAGÉE — Tâche E. ⚠️ **UN ÉCRIVAIN, N LECTEURS, ET LE GLOBE
// EST LE QUATORZIÈME** (`terrain.js` ×5, `ocean.js` ×2, `gpx.js` ×1,
// `main.js` ×5). ⚠️ Ce module n'importe RIEN — c'est sa seule règle, et elle est
// gardée par un test —, donc aucun cycle n'est ouvert ici.
import { lireExageration } from './monde/exageration-continue.js'
import { loiTextureMonde, GRAIN_PAR_PIXEL, METRES_PAR_DEGRE } from './monde/loi-texture-monde.js'
// LE FOND DU CROP — Tâche J bis. Pur lui aussi (il n'importe que
// `crop-sphere.js`, pur) : il ne rend que des nombres, et c'est ce fichier-ci
// qui décide QUAND les lire. Son en-tête porte les mesures qui le fondent.
import { altitudeMaillage, altitudeSonde, echantillonnerFond, cleFond } from './monde/fond-crop.js'
// LE MAILLAGE D'UNE TUILE — Tâche P11. Pur lui aussi. ⚠️ **IL PORTE LA TABLE DES
// SEGMENTS**, qui vivait ici sous le nom `gridFor` : elle a désormais DEUX
// lecteurs (`_buildMesh` qui pose les sommets, `hauteurDessinee` qui les relit),
// et une table recopiée diverge en silence.
import { segmentsTuile, interpolerMaille } from './monde/maillage-tuile.js'
// ══════ L'IMAGERIE DE LA SURFACE DU GLOBE — Tâche R16 ═══════════════════════
// Le cache par tuile de quadtree, sa sous-fenêtre d'aïeul et sa source mondiale.
// ⚠️ Le module est PUR (ni THREE, ni DOM, ni réseau) : c'est ce qui rend son
// piège n° 2 — l'entrée en vol qui ne revient jamais — testable sans navigateur.
import { PhotoMonde, urlPhotoMonde, FONDU_MER_MONDE } from './monde/photo-monde.js'
// LA MÉMOIRE DES TUILES DE MNT — Tâche R3, correction I3. ⚠️ **ELLE A
// DÉMÉNAGÉ, ELLE N'A PAS CHANGÉ** : même Map, même borne de 32 Mo, même LRU.
// Elle vit désormais dans un module PUR parce que `dem.js` en est le SECOND
// lecteur : les neuf tuiles z12 du bloc étaient téléchargées deux fois par
// chargement (2,705 Mo), une fois par chaque chemin, faute d'une mémoire commune.
import { memoTuiles, tuileMemorisee, viderMemoTuiles } from './monde/memo-tuiles-mnt.js'
import { hauteursTerrarium } from './monde/decodeur-terrarium.js'
// ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
//
// ⚠️ **CE N'EST PAS UNE COPIE DU SOCLE, C'EST LE MÊME TEXTE.** `terrain.js`
// injecte `GLSL_NATUREL` dans SON fragment et ce fichier dans LE SIEN : il n'y a
// qu'une seule écriture du peigné, de l'humidité, du pivot et du voile aérien.
// `test/crop-naturel.test.js` interdit qu'une de ces formules soit réécrite ici.
import { GLSL_NATUREL, NATUREL_MONDE, GAIN_PEIGNE_MONDE, GAIN_OMBRE_MONDE } from './monde/naturel-crop.js'
// ══════ LA COUCHE APPARENCE — Tâche P3 ══════════════════════════════
// `FX_GLSL` était déjà partagé entre `terrain.js` et les vignettes du panneau ;
// le crop en est le troisième lecteur. `GLSL_MELANGE` ferme une dette plus
// ancienne : `blLum`/`blClip`/`blSetLum` étaient écrits DEUX fois, ici et dans
// `terrain.js`, chacun avec un commentaire annonçant la divergence.
import { FX_GLSL } from './fx-glsl.js'
import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
// ══════ LA PLANÈTE N'EST PLUS NUE — règle D15, Tâche R6 ════════════════════
// L'ÉTAT DE REPOS DU MONDE, en un seul endroit. Il était écrit en dur à trois
// sites de ce fichier (la table des uniformes, `retirerHabillage`,
// `retirerRampe`), et il y valait zéro partout : c'est cette valeur que D15
// abroge. Le module porte aussi le départage — ce qui peut devenir global et ce
// qui ne le peut pas — et les trois postes où D15 se trompe.
import {
  MONDE_NU, MONDE_ECLAIRE, styleMonde,
  RELIEF_MONDE, RELIEF_MONDE_NUL, GLSL_RELIEF_MONDE,
} from './monde/planete-eclairee.js'
// ══════════ L'APPOINT ET L'OMBRAGE DES PENTES — Tâche R21 ══════════════════
//
// Six des huit réglages morts de l'inventaire (69 à 73 et 30) atterrissent ici.
// Même patron que `planete-eclairee.js` juste au-dessus : la loi et ses
// conversions d'unité chiffrées vivent dans un module PUR qui porte son propre
// texte GLSL, et ce fichier l'INJECTE. `test/lumiere-sphere.test.js` traduit ce
// texte-là et l'exécute contre les fonctions JS du module.
import {
  APPOINT_MONDE_ETEINT, PENTE_MONDE_NULLE, GLSL_LUMIERE_SPHERE, directionAppointMonde,
} from './monde/lumiere-sphere.js'
// ══════════ L'ÉCLAIRAGE DU CROP — Tâche P3 ═════════════════════════════════
//
// > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
// > tuile du globe est une COULEUR NUE. »
//
// Même patron que `naturel-crop.js` juste au-dessus : la loi vit dans un module
// PUR qui porte son propre texte GLSL, et ce fichier l'INJECTE. Il n'y a donc
// pas deux écritures de l'éclairage à garder d'accord.
import {
  GLSL_ECLAIRAGE,
  // ⚠️ **LE MORCEAU DÉTACHÉ, POUR LES PAROIS — Tâche P6.** Leur nuanceur est
  // NU : ni rampe, ni peinture, donc pas de `natLuminance`, dont
  // `GLSL_ECLAIRAGE` dépend. C'est la MÊME loi, injectée seule.
  GLSL_IRRADIANCE,
  // ⚠️ **LA NORMALE PAR FRAGMENT — Tâche P9, RÉÉCRITE PAR P10.** Même patron :
  // la loi et sa dérivation vivent dans le module PUR ; ce fichier n'en injecte
  // que le texte. ⚡ **DEUX MORCEAUX DEPUIS P10** : le repère de sol part au
  // nuanceur de SOMMETS (`latlon` y est un attribut exact), la normale reste au
  // nuanceur de fragments.
  GLSL_REPERE_SOL,
  GLSL_NORMALE_FINE,
  RECIPROQUE_PI,
  ECLAIRAGE_MONDE,
  directionSoleilLocale,
  hautLocal,
  irradianceAmbiante,
} from './monde/eclairage-crop.js'
// ══════════ LA MATIÈRE DU RELIEF — Tâche R25 ═══════════════════════════════
//
// ⛔ **L'INVENTAIRE DISAIT « LE GLOBE N'A PAS DE MATIÈRE PBR DE RELIEF », ET LA
// MESURE DIT PIRE** : les quinze matières opaques rendaient LA MÊME image (0,025
// à 0,338 d'écart entre elles, pour un plancher de bruit du banc à 0,231), parce
// que le seul effet qui traversait était `m.color = blanc` et `uTint = 0`. Le
// sélecteur était un interrupteur à deux positions. L'en-tête du module porte le
// tableau complet, les conversions d'unité avec leur facteur, et le coût mesuré
// de la transmission qui fait borner le VERRE.
import { GLSL_MATIERE, MATIERE_MONDE_ETEINTE } from './monde/matiere-crop.js'
// ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
//
// > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
// > est en PLAQUES. »
//
// Même patron encore : la loi vit une seule fois dans un module PUR, `ocean.js`
// et ce fichier injectent le MÊME texte. L'en-tête d'`ecume-mer.js` nomme les
// quatre entrées qui manquaient et donne leur mesure.
// ⚠️ **ET LA LAME D'EAU DEPUIS LA TÂCHE P6**, pour la même raison et par le même
// chemin : `corpsEau`, `opaciteEau`, `clapotNormale`, `glintTavelureMer` et
// `blanchirEcume` vivaient UNIQUEMENT dans `ocean.js`, et ce fichier n'en
// portait qu'une version tronquée — sans la tirette de transparence, sans le
// glacis de lagon, sans la nuit, et sans le moindre clapot de normale.
import {
  GLSL_ECUME, GLSL_LAME_EAU, FREQ_TAVELURE,
  ACCALMIE_NEUTRE, ETAT_MER_NEUTRE, LAME_EAU_NEUTRE, CLAPOT_NORMALE,
} from './monde/ecume-mer.js'
// ══════════ LA RÉFRACTION DE LA LAME D'EAU — Tâche R2 ══════════════════════
//
// > **Adrien, 2026-08-23 :** « on dirait qu'elle est quasiment transparente ».
//
// Même patron que l'écume et la lame d'eau : la loi vit une seule fois dans un
// module PUR, `ocean.js` et ce fichier injectent le MÊME texte. L'en-tête
// d'`eau-refraction.js` porte la mesure du repère de normale — **le facteur 16,4
// sur le Fresnel** — et l'ordre de composite qui manquait.
import { GLSL_REFRACTION, REFRACTION_NEUTRE } from './monde/eau-refraction.js'
import {
  DEM_SOURCES,
  DemSourceError,
  activeDemSource,
  fallbackToAws,
  noterTrouTuile,
  peekRegionMaxZoom,
  regionKey,
  resolveRegionMaxZoom,
  trouConnu,
} from './dem-source.js'

// ═══════════════ LES NUANCEURS DE LA MER — Tâche F ═════════════════════════
//
// ⚠️ **DEUX MORCEAUX ARRIVENT D'`ocean.js` ET NE SONT PAS RECOPIÉS ICI** : le
// spectre de Gerstner (`GERSTNER_GLSL`, lui-même venu de la bibliothèque
// `ocean-waves` partagée avec ocean-lab) et la houle de côte
// (`SHORE_SURF_GLSL`). Les recopier aurait fait deux mers qui divergent — le
// défaut que `terrain.js` documente sous le nom « deux écritures jumelles ».
//
// ⚠️ **ET `SHORE_SURF_GLSL` PORTE `1.0 / 384.0` EN DUR** : c'est la résolution
// du champ de `ocean.js` (`CHAMP_RES = 384`, `mer-emprise.js`). La calotte cuit
// donc SON champ à 384 aussi. ⚠️ **Ce littéral est un défaut latent du dépôt et
// il faut le dire** : sur une emprise 3×3, `resChamp` rend 1 152 et le pas de
// gradient de la houle de côte y est **trois fois trop grand**. Hors périmètre
// (c'est le damier), non corrigé, écrit ici pour qu'on puisse le trouver.
const MER_VERT = /* glsl */ `
attribute vec2 aCrop;      // (u, v) en demi-côtés de crop — porté par la géométrie
// LE RIDEAU D EAU — Tache P4. 0 sur la calotte et en haut du ruban, 1 tout en
// bas : c est A LA FOIS le drapeau du rideau et la profondeur relative que le
// socle appelle g. Le ruban est CONCATENE a la calotte, donc ses sommets du
// haut portent le meme aCrop et recoivent la MEME houle, au bit pres.
attribute float aJupe;
uniform float uMerBasY;    // le fond du bloc, en Y local — construireSolideCrop
uniform float uMerTemps;
uniform float uMerHoule;   // amplitude de houle, en mètres de spectre
uniform float uMerChop;
uniform float uMerVitesse;
uniform float uMerLambda;  // unités LOCALES par mètre de spectre
uniform float uMerPortee;
uniform float uMerDebut;   // début de la bande de dégradation, en unités de scène
uniform float uMerFin;     // fin de la bande : au-delà, on ne calcule PLUS RIEN
uniform sampler2D uMerChamp; // R : altitude du fond (unités locales), G : rivage
// ⚠️ UNITÉS DE SCÈNE PAR UNITÉ DE SOCLE — Tâche P4. C'est le facteur qui rend
// la profondeur du crop comparable à celle du socle, la SEULE monnaie dans
// laquelle le déclin côtier d'ocean.js a un sens. Un seul écrivain : poserMer.
uniform float uMerUnite;
// ⚠️ L ACCALMIE DE VUE, ET ELLE SERT DES DEUX COTES — Tache P5. Le fragment la
// lit deja pour l ecume (Tache P4) ; le vertex en a besoin pour la HOULE, parce
// qu ocean.js multiplie son amplitude par uViewCalm avant d appeler Gerstner.
// C est le MEME uniforme, pas un second : un seul ecrivain, majReglagesMer.
uniform float uMerCalmeVue;
__GERSTNER__
__SHORE_SURF__
${GLSL_ECUME}
varying vec2 vCrop;
varying vec2 vLocal;
varying float vProfondeur;
// ⛔ LA PROFONDEUR AVEC LE REPLI DISTANCE-AU-RIVAGE — Tache P8. vProfondeur
// est la bathymetrie NUE (elle decide de la terre, du deferlement et du declin
// cotier) ; celle-ci porte en plus le secours d ocean.js, et c est elle que le
// GLACIS DE LAGON et l alpha lisent. La mesure qui l exige est a profondeurEau
// (monde/ecume-mer.js) : le champ du crop ne porte qu un echantillon vrai tous
// les 240 m, et le glacis y etait peint sur un plateau a paliers.
varying float vProfondeurEau;
// ⚠️ CE N EST PLUS LA DISTANCE BRUTE, ET LE NOM LE DIT — Tache P4. Elle portait
// champ.g tel quel pendant que les seuils qui la lisent (0,002 / 0,03 / 0,10 /
// 0,75) sont ceux d ocean.js, cales sur vFade, c est-a-dire sur le declin
// FONDU. C etait ca, l ecume 7,7 fois trop etendue. (Aucun accent grave ni
// apostrophe dans ce bloc : template literal.)
varying float vFonduRive;
varying float vCrete;
varying vec3 vNormMer;
varying vec3 vMonde;
varying float vRichesse;
varying float vJupe;

void main() {
  vec3 p = position;
  vJupe = aJupe;
  // le BAS du rideau tient au fond du bloc et ne suit aucune vague : c est lui
  // qui soude la nappe a la levre de la paroi, laquelle plonge au fond marin.
  bool basDuRideau = aJupe > 0.5;
  if (basDuRideau) p.y = uMerBasY;
  vCrop = aCrop;
  vLocal = vec2(position.x, position.z);
  vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;
  vec2 champ = texture2D(uMerChamp, uvF).rg;
  vProfondeur = max(-champ.r, 0.0);
  // le repli d ocean.js, converti dans la monnaie de la calotte par uMerUnite
  vProfondeurEau = profondeurEauMer(vProfondeur, champ.g, uMerUnite);
  // ⚠️ LA PROFONDEUR EN UNITÉS DE SOCLE, PUIS LE DÉCLIN D'ocean.js. Les deux
  // grandeurs qu'il compare — deux fois la profondeur, et la distance au rivage
  // normalisée sur quinze unités de socle — doivent vivre dans la MÊME monnaie.
  float declin = declinRivageMer(vProfondeur / max(uMerUnite, 1e-9), champ.g);
  vFonduRive = fonduRessacMer(declin);
  vec3 monde = (modelMatrix * vec4(p, 1.0)).xyz;

  // ══════ LA MER — LA DÉGRADATION, ET ELLE ATTEINT ZÉRO ═════════════════════
  //
  // ⚠️ EN LOGARITHME DE DISTANCE : la bande est GÉOMÉTRIQUE, donc la bascule en
  // est le milieu EXACT et la transition dure le même nombre d'octaves de
  // chaque côté. C'est la loi de richesseMer (src/monde/mer-sphere.js), et
  // test/mer-sphere.test.js EXTRAIT cette expression pour la confronter à elle.
  //
  // ⚠️ ET C'EST UNE SORTIE ANTICIPÉE, PAS UNE MULTIPLICATION. ocean.js calcule
  // toute sa houle puis la multiplie par uViewCalm, qui ne descend jamais sous
  // 0,08 : le travail est fait puis mis a zero. Mesure (Etape 1) : le cout par
  // pixel de mer NE BAISSE PAS avec la distance, il MONTE. Ici, au-dela de
  // uMerFin, richesseMer vaut EXACTEMENT zero et rien n'est calcule.
  // (Aucun accent grave dans ce bloc : il vit dans un template literal JS.)
  float dMer = distance(cameraPosition, monde);
  float richesseMer = 1.0 - smoothstep(log(uMerDebut), log(uMerFin), log(max(dMer, 1e-9)));
  vRichesse = richesseMer;
  if (richesseMer <= 0.0) {
    vCrete = 0.0;
    vNormMer = vec3(0.0, 1.0, 0.0);
    vMonde = monde;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    return;
  }

  // le fondu de rivage : la houle meurt AVANT le trait d'eau, sinon un creux
  // traverse le fond et le relief sous-marin ressort en peignes (ocean.js, les
  // captures d'Ibiza et de Toulon)
  // ⚠️ SUR LE DECLIN, PAS SUR LE FONDU — ocean.js lit shoreD ici et vFade dans
  // le fragment : deux rampes sur la MEME grandeur, pas l une sur l autre.
  float fade = fonduHouleMer(declin) * richesseMer;
  vec3 nAcc = vec3(0.0);
  float crete = 0.0;
  // ⚠️ ON PASSE uMerLambda EN lenScale, ET LES COORDONNÉES TELLES QUELLES —
  // exactement comme ocean.js. La premiere ecriture divisait xz par lambda et
  // passait lenScale = 1,0 : le deplacement sortait alors en METRES DE SPECTRE
  // pendant que le critere de deferlement ci-dessous compare a une profondeur en
  // UNITES DE SCENE. Deux unites dans la meme soustraction, et rien ne l'aurait
  // dit. (Aucun accent grave dans ce bloc : template literal.)
  // ⚠️ LA HOULE PORTE L ACCALMIE DE VUE, ET C EST L EXPRESSION D ocean.js —
  // Tache P5. La-bas : oceanGerstner(xz, t, uWaveH * uViewCalm, ...) au vertex,
  // et shoreSurf recoit uWaveH BRUT. Ici uMerCalmeVue EST uViewCalm, pose par
  // majReglagesMer depuis l uniforme vivant du socle. Sans ce facteur, brancher
  // uMerHoule sur uWaveH aurait rendu une houle 2,5 fois trop haute (uWaveH = 2,
  // uViewCalm = 0,4039 releves le meme instant). ⚠️ Le NEUTRE de l accalmie vaut
  // 1 (ACCALMIE_NEUTRE), donc sans socle a lire ce facteur ne change rien.
  // (Aucun accent grave ni apostrophe dans ce bloc : template literal.)
  // ⛔ ET L AMPLITUDE ETAIT DANS LA MAUVAISE MONNAIE — Tache P6, VU A L ECRAN.
  // uMerHoule vaut ce que vaut uWaveH du socle, c est-a-dire des UNITES DE
  // SOCLE ; oceanGerstner ajoute cette amplitude aux coordonnees du maillage,
  // qui sont ici en UNITES DE SCENE. Releve le 2026-08-22 a La Reunion :
  // uMerUnite = 0,008227, donc uMerHoule = 2 valait 121,6 FOIS l amplitude du
  // socle. Le deplacement HORIZONTAL (disp.xz, que l ecretage de deferlement ne
  // borne pas) atteignait plusieurs fois la largeur du bloc : le maillage se
  // repliait sur lui-meme et la nappe rendait de grands rubans pales a bords en
  // escalier. A/B a temoin nul dans la meme page, boucle coupee : uMerHoule mis
  // a zero les fait DISPARAITRE, uMerHoule x uMerUnite aussi
  // (.banc/P6/D2-CROP-mer-sans-houle.png et D4-CROP-mer-houle-convertie.png).
  // C EST LA MEME FAUTE QUE LA TAVELURE DE P4 ET QUE LE BUDGET DE FOND DE P5 :
  // une valeur juste, branchee dans la mauvaise unite. uMerLambda, lui, etait
  // deja converti — l asymetrie est ce qui l a rendue invisible.
  vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule * uMerCalmeVue * uMerUnite, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
  float creteS = 0.0;
  vec3 surf = shoreSurf(uvF, uMerChamp, uMerTemps, uMerHoule * uMerUnite, uMerChop, uMerVitesse, uMerLambda, richesseMer, creteS);
  disp.y += surf.x;
  nAcc.x += surf.y;
  nAcc.z += surf.z;
  crete = max(crete, creteS);

  // ---- CRITÈRE DE DÉFERLEMENT, porté de ocean.js : une vague ne dépasse pas
  // 0,78 fois sa profondeur. Limite DOUCE, pas un écrêtage : cap(1 − e^(−a/cap))
  // vaut a en eau profonde et tend vers cap en eau basse.
  float cap = 0.78 * vProfondeur;
  float amp = abs(disp.y);
  float dy = sign(disp.y) * cap * (1.0 - exp(-amp / max(cap, 1e-9)));

  // ⚠️ EN COORDONNEES LOCALES, ET LA VERTICALE Y EST (0,1,0). La premiere
  // ecriture ajoutait normalize(monde), c'est-a-dire un vecteur du repere du
  // MONDE, a une position du repere LOCAL du crop : la houle poussait la
  // surface de travers, d'un angle egal a la latitude du crop.
  if (!basDuRideau) {
    p.x += disp.x;
    p.z += disp.z;
    p.y += dy;
  }

  vCrete = crete;
  vNormMer = normalize(vec3(-nAcc.x, 1.0 - nAcc.y, -nAcc.z));
  vMonde = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const MER_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMerPeu;    // le glacis clair des faibles profondeurs
uniform vec3 uMerFond;   // le bleu du large
uniform vec3 uSky;
uniform float uMerTemps;
uniform float uMerProfMax;
uniform float uMerSeuilEau;
uniform float uMerEcume;
uniform float uMerEcumeEchelle;
uniform float uMerBrillance;
uniform float uMerPortee;
uniform float uMerLambda;
uniform float uMerUnite;      // unites de scene par unite de socle — Tache P4
// ══════ LE CHAMP, LU UNE SECONDE FOIS ET A UNE AUTRE FREQUENCE — Tache R5 ══
// Le vertex le lit deja. Ce n est pas une duplication de LOI (les trois
// fonctions appelees sont les memes, injectees par GLSL_ECUME) mais un
// changement de FREQUENCE d echantillonnage, et c est tout le geste de la
// tache. Le pourquoi, avec les chiffres, est au bloc « LE TRAIT MER/TERRE » de
// main(). uMerParFragment a 0 rend l image d avant AU BIT PRES.
uniform sampler2D uMerChamp;
uniform float uMerParFragment;
// ══════ LES DEUX ACCALMIES D'ocean.js, LUES ET NON RECALCULEES — Tache P4 ══
// Elles pesent 0,4039 et 0,08 dans la page vivante du 2026-08-22 : le ressac du
// socle y est multiplie par 0,0323 quand la calotte le multipliait par 1. Un
// seul ecrivain, Ocean.setView ; la calotte prend ses valeurs. Neutre : 1.
uniform float uMerCalmeVue;
uniform float uMerCalmeSurf;
uniform float uMerGivre;   // le socle de verre du mode plat (uFrost) — 0 = pas de verre
// ══════ LA LAME D'EAU — Tache P6, la reserve n° 2 de P5 ═══════════════════
// QUATRE reglages d'ocean.js que la calotte n'avait JAMAIS recus, et aucun
// parametre ne les portait. Releves le 2026-08-22 dans la page vivante :
// uTransp = 0,57 (la lame du crop etait 1,556 fois trop opaque), uSunFx = 0,72
// (28 % de glint de trop), uDetail = 0,75 (la calotte n'avait AUCUN clapot de
// normale), uDayLight (la mer du crop ne s'eteint pas la nuit).
uniform float uMerTransp;
uniform float uMerSoleilFx;
uniform float uMerJour;
uniform float uMerDetail;
// ══════ LE SOLEIL DU BLOC, PAS CELUI DE LA PLANETE — Tache P6 ════════════
// uSunDir est repose A CHAQUE IMAGE sur camGlobe.position tournee de 42° : le
// glint de la mer du crop suivait la CAMERA. Releve le meme jour :
// uSunDir = (0,2305 -0,3687 0,9005) — SOUS l'horizon — pendant que le soleil de
// la scene pointait (0,4392 0,5629 -0,7001). uSoleilDir, lui, est deja le
// soleil du socle place dans le repere du globe (Tache P3) ; il n'est valable
// que sous uEclairageOn, et sans lui la calotte reprend la loi de planete.
uniform vec3 uSoleilDir;
uniform float uEclairageOn;
uniform float uCropCoin;
uniform float uCropCoinN;
// LE BORD DE LA MER — Tache J. (debut, fin) du fondu, en demi-cotes de crop,
// MESURES DEPUIS LA FRONTIERE DE LA DECOUPE : 0 = la frontiere. La loi vit dans
// src/monde/mer-sphere.js (bordDeMer) et ne suit QUE L'EMPRISE DU SOCLE : elle
// ne prend plus aucun parametre depuis le defaut 2 d'Adrien du 2026-09-04.
// ⚠️ uCropCoin et uCropCoinN etaient DECLARES ICI ET LUS PAR PERSONNE depuis la
// Tache F — deux uniformes morts, exactement ce que le §Q du plan traque. Ils
// portent desormais la mesure du bord, la MEME que celle de la decoupe
// (globe.js, cq / pn du nuanceur des tuiles) : pas une seconde ecriture de la
// superellipse, la meme, appliquee a une autre surface.
uniform vec2 uMerBord;
// ══════ LA RÉFRACTION EN ESPACE ÉCRAN — Tâche R2 ═════════════════════════
// uMerScene : la copie du tampon d image prise JUSTE AVANT le dessin de la
// nappe (grab pass, _mer.onBeforeRender). uMerResolution : la taille du tampon
// de dessin, en pixels. uMerRefract : la tirette uRefract du socle, LUE par
// majReglagesMer, jamais choisie ici.
uniform sampler2D uMerScene;
uniform vec2 uMerResolution;
uniform float uMerRefract;
// ⛔ LE REPERE DE LA NORMALE, ET C EST LE DEFAUT QUI FAISAIT LA MER PALE.
// vNormMer est bati sur des coordonnees LOCALES du crop : son haut est
// (0,1,0) LOCAL. Le fragment le confrontait a V = cameraPosition - vMonde, qui
// est en repere MONDE. Mesure du 2026-08-23 a La Reunion : le haut local tombe
// sur (0,7705 -0,3624 0,5243) en monde, soit 111,25 degres d ecart ; au centre
// de la nappe dot(N_local, V) valait -0,7519 quand dot(N_monde, V) vaut
// +0,5024. Ecrete a zero, le Fresnel saturait donc a son PLAFOND (0,5) au lieu
// de 0,0305 : un facteur 16,4, et un lavage de 17,5 pour cent de couleur de
// ciel sur toute la nappe au lieu de 1,07. uMerVersMonde est la rotation du
// crop, posee depuis la matrice monde de la mer.
uniform mat3 uMerVersMonde;
varying vec2 vCrop;
varying vec2 vLocal;
varying float vProfondeur;
varying float vProfondeurEau;
varying float vFonduRive;
varying float vCrete;
varying vec3 vNormMer;
varying vec3 vMonde;
varying float vRichesse;
varying float vJupe;
${GLSL_ECUME}
${GLSL_LAME_EAU}
${GLSL_JUPE_MER}
${GLSL_REFRACTION}

float bruitMer(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // ══════ LE TRAIT MER/TERRE — Tache R5 ═════════════════════════════════════
  //
  // ⛔ **LE TRAIT DU CROP ETAIT DECIDE PAR SOMMET, CELUI DU SOCLE PAR FRAGMENT.**
  // vProfondeur, vProfondeurEau et vFonduRive sont des VARYINGS : MER_VERT lit
  // le champ aux SOMMETS de la calotte et le fragment n en recoit qu une
  // interpolation lineaire. La ligne d eau du crop etait donc le zero d une
  // fonction affine par triangle — un polygone dont le cote vaut UNE MAILLE.
  // ocean.js, lui, lit uField ET le masque cotier DANS SON FRAGMENT.
  //
  // ⚡ MESURE (La Reunion -21,05 / 55,25 z12, cadrage cote, bloc appari a
  // -0,03 %, mer calmee des deux cotes, boucle gelee, A-B-A identique au
  // chiffre pres) : la maille de la nappe vaut **6,475 px** a l ecran, le texel
  // du champ **3,238 px**, le texel du champ du socle **1,08 px**. C est la
  // MAILLE qui bornait, pas le champ : elle est deux fois plus grossiere que le
  // champ qu elle echantillonne. Multiplier la resolution du champ par la
  // portee — la « route A », neuf fois la cuisson — ne pouvait donc RIEN
  // rendre tant que cette ligne-ci lisait par sommet.
  //
  // ⚠️ **CE N EST PAS UNE SECONDE ECRITURE DE LA LOI** : les trois fonctions
  // appelees ici sont celles de monde/ecume-mer.js, les MEMES que le vertex
  // appelle. Seule la FREQUENCE change.
  float profondeur = vProfondeur;
  float profondeurEau = vProfondeurEau;
  float fonduRive = vFonduRive;
  if (uMerParFragment > 0.5) {
    // ⚠️ vCrop, PAS la position deplacee : c est la coordonnee PARAMETRIQUE de
    // la calotte, celle-la meme que le vertex convertit en uvF avant que la
    // houle ne bouge le sommet. Lire la position deplacee ferait onduler le
    // trait de cote au rythme des vagues.
    vec2 uvFrag = vCrop / (2.0 * uMerPortee) + 0.5;
    vec2 champFrag = texture2D(uMerChamp, uvFrag).rg;
    profondeur = max(-champFrag.r, 0.0);
    profondeurEau = profondeurEauMer(profondeur, champFrag.g, uMerUnite);
    fonduRive = fonduRessacMer(declinRivageMer(profondeur / max(uMerUnite, 1e-9), champFrag.g));
  }
  // la TERRE ne porte jamais la mer : le fond au-dessus du niveau zéro discarde
  if (profondeur <= 0.0) discard;

  // ══════ LE RIDEAU D EAU — Tache P4 ═══════════════════════════════════════
  //
  // ⚠️ AVANT LE BORD, ET C EST OBLIGATOIRE : le ruban vit EN RETRAIT de la
  // frontiere, exactement la ou bordDeMer eteint la nappe. Le passer au test du
  // bord le ferait disparaitre entierement — ce qui est arrive au premier essai.
  // ⚠️ ET IL N A PAS D ECUME : le socle n en met pas non plus sur sa jupe.
  if (vJupe > 0.0) {
    float grain = bruitMer(vMonde.xz * 6.0 + vMonde.y * 4.0) * 0.5
                + bruitMer(vMonde.xz * 17.0 - vMonde.y * 9.0) * 0.5;
    gl_FragColor = couleurJupeMer(uMerFond, uSky, clamp(vJupe, 0.0, 1.0), uMerGivre, 1.0, grain);
    return;
  }

  // ══════ LE BORD — LA MER S ARRETE OU IL FAUT, ET ELLE SUIT L ESTOMPAGE ════
  //
  // ⚠️ AVANT TOUT LE RESTE, ET C EST UNE ECONOMIE, PAS UN STYLE : au-dela du
  // bord il n y a ni ecume, ni bruit, ni Fresnel a calculer. Meme geste que la
  // sortie anticipee de richesseMer dans le vertex.
  //
  // ⚠️ ET LA MESURE EST CELLE DE LA DECOUPE, PAS UN CARRE. Un max(|u|,|v|)
  // laisserait la mer deborder aux QUATRE COINS arrondis du crop, la ou il n y a
  // plus de bloc dessous. (Aucun accent grave dans ce bloc : template literal.)
  //
  // ⛔ ET ELLE ETAIT MUETTE A L INTERIEUR — Tache P4, et c est LA cause du
  // porte-a-faux, pas un signe inverse dans bordDeMer. Le terme cq est un
  // max(.., 0) : DEDANS il vaut zero, donc pn vaut zero et dBord se fige a
  // -uCropCoin. Releve sur la page vivante du 2026-08-22 : uCropCoin vaut ZERO.
  // dBord valait donc 0 sur TOUT l interieur du crop, et la mesure ne portait
  // que le dehors. Le fondu de la mer ne pouvait structurellement pas RENTRER :
  // il ne savait que sortir, et c est ce qu on voit passer par-dessus l arete
  // haute de la paroi. Le terme min(max(q.x, q.y), 0.0) est la distance
  // interieure de la boite arrondie (la forme close usuelle) : il vaut ZERO
  // dehors, donc le dehors reste au bit pres ce qu il etait.
  vec2 q = abs(vCrop) - (1.0 - uCropCoin);
  vec2 cq = max(q, 0.0);
  float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
  float dBord = pn - uCropCoin + min(max(q.x, q.y), 0.0); // 0 = frontiere, < 0 = DEDANS
  float bord = 1.0 - smoothstep(uMerBord.x, uMerBord.y, dBord);
  if (bord <= 0.0) discard;

  // ⛔ ICI VIVAIT UN d01 QUE PERSONNE NE LISAIT — un uniforme mort de plus, de
  // la famille que le §Q du plan traque et que uCropCoin a deja illustree.
  // le dégradé lagon vit sur les premiers 15 % du budget — une baie de 30 m est
  // un lagon, le budget couvre des colonnes de mille mètres (ocean.js)
  //
  // ⛔ ET IL LIT LA PROFONDEUR AVEC LE REPLI, LA OU ocean.js LIT LA BATHYMETRIE
  // NUE — Tache P8. C est un ECART au socle, mesure et assume : sur le crop, le
  // repli pose sur la seule alpha ne deplace RIEN (glacis 11,72 % contre 11,71 %
  // au depart, force periodique 0,24), pose sur le glacis il rend 9,69 % et
  // 0,048. LES DENTS VIVENT DANS LE GLACIS. Le pourquoi — un echantillon vrai
  // de bathymetrie tous les 240 m dans le champ du crop — est a profondeurEau
  // (monde/ecume-mer.js), avec le halo qu ocean.js redoute, declare comme risque.
  float dLagon = clamp(profondeurEau / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
  // ══════ LE CORPS DE L EAU — Tache P6 ═════════════════════════════════════
  // Il portait mix(uMerPeu, uMerFond, pow(dLagon, 0.7)) : le corps d ocean.js
  // AMPUTE de son glacis de lagon (donc de la tirette de transparence) et de sa
  // nuit. corpsEau est la loi entiere, injectee depuis monde/ecume-mer.js.
  vec3 col = corpsEau(uMerPeu, uMerFond, dLagon, poidsLagonEau(uMerTransp), uMerJour);

  vec3 V = normalize(cameraPosition - vMonde);
  // ══════ LE CLAPOT DE NORMALE — Tache P6, ET LA CALOTTE N EN AVAIT AUCUN ══
  // ocean.js : rp = xz * 6.0, ou xz est en UNITES DE SOCLE. On convertit par
  // uMerUnite, exactement comme la tavelure depuis P4 — la meme monnaie, pas
  // une seconde. C est ce terme qui fait qu une lame d eau AJOUTE de la
  // variation au lieu d en retirer (mesure de la reserve n° 2 de P5).
  vec2 rp = vLocal / max(uMerUnite, 1e-9) * ${CLAPOT_NORMALE.freq.toFixed(1)};
  float r1 = bruitMer(rp + vec2(uMerTemps * 0.9, 0.0));
  float r2 = bruitMer(rp * 1.9 - vec2(0.0, uMerTemps * 1.2));
  // ══════ DEUX REPERES, DEUX USAGES — Tache R2 ════════════════════════════
  // nLocal : le repere de la NAPPE. Sa paire horizontale xz est EXACTEMENT ce
  // que le socle appelle N.xz — chez lui le haut du monde EST celui de la mer.
  // C est elle que prend le decalage de refraction, sans aucune conversion.
  // N : la meme normale, tournee dans le MONDE. C est elle, et elle seule, qui
  // peut etre dotee avec V et L. Voir l en-tete de monde/eau-refraction.js.
  vec3 nLocal = clapotNormale(normalize(vNormMer), uMerDetail, uMerCalmeVue, r1, r2);
  vec3 N = normalize(uMerVersMonde * nLocal);
  // ══════ LE SOLEIL DU BLOC, PAS CELUI DE LA PLANETE — Tache P6 ════════════
  // uSunDir suit la CAMERA (main.js le repose par image sur camGlobe.position
  // tournee de 42°). Releve le 2026-08-22 : il pointait SOUS l horizon
  // (y = -0,3687) pendant que le soleil de la scene etait a +0,5629. Le glint de
  // la mer du crop ne venait donc pas du soleil. uSoleilDir est le meme soleil
  // que celui des tuiles depuis P3 — pas un second, LE meme uniforme.
  vec3 L = normalize(uEclairageOn > 0.5 ? uSoleilDir : uSunDir);
  float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);
  // ⚠️ APRES fres, COMME DANS ocean.js : le plancher de Fresnel en fait partie.
  float opac = opaciteEau(dLagon, uMerTransp, fres);
  // ══════ LE COMPOSITE REFRACTE — Tache R2, ET C EST L ORDRE QUI COMPTE ════
  //
  // ⛔ AVANT CETTE TACHE, LE CROP SORTAIT alpha = ... * opac. Le reflet de ciel
  // et le glint solaire etaient donc DILUES par la transparence, c est-a-dire
  // traites comme s ils venaient du FOND. ocean.js documente exactement ce
  // defaut en v44 : « les reflets sont des reflets DE SURFACE : ils s
  // appliquent APRES le composite de transparence, sinon ils sont dilues comme
  // s ils venaient du fond, le glint avait disparu (Adrien) ». On compose donc
  // ICI, dans le nuanceur, contre la copie du tampon d image, et l alpha ne
  // porte plus que la geometrie (le bord du crop, le trait d eau, l ecume).
  //
  // ⚠️ LA PENTE EST CELLE DU REPERE LOCAL — voir nLocal plus haut. Le decalage,
  // lui, est en UV D ECRAN des deux cotes : rien a convertir sur le gain.
  vec2 uvEcran = gl_FragCoord.xy / uMerResolution;
  vec2 refOff = decalageRefraction(nLocal.xz, uMerRefract, fonduRive);
  vec3 travers = texture2D(uMerScene, uvRefractee(uvEcran, refOff)).rgb;
  col = composeLameEau(travers, col, opac);
  col = mix(col, uSky, fres * 0.35);
  vec3 H = normalize(L + V);
  // ⚠️ uMerSoleilFx : la tirette « soleil sur l eau » du socle, jamais branchee.
  col += uSunColor * pow(max(dot(N, H), 0.0), uMerBrillance) * (0.5 + 1.6 * fres) * uMerSoleilFx * vRichesse;

  // ══════ L'ÉCUME — ET ELLE NE COÛTE RIEN AU-DELÀ DE LA BANDE ═══════════════
  if (vRichesse > 0.0) {
    // ⚠️ EN ESPACE DE SPECTRE, COMME DANS ocean.js — « le bruit d ecume vit en
    // espace spectre (xz / uLenScale), il suit donc la taille des vagues a tous
    // les zooms : fini les mouchetures pixel des vues larges ». La premiere
    // version l indexait sur vCrop x 90, c est-a-dire sur la PORTEE de la
    // calotte : la taille des mouchetures changeait avec l emprise.
    vec2 sm = vLocal / max(uMerLambda, 1e-9);
    float n1 = bruitMer(sm * 0.55 + vec2(uMerTemps * 0.25, -uMerTemps * 0.18));
    float n2 = n1 * bruitMer(sm * 1.35 - vec2(uMerTemps * 0.15, uMerTemps * 0.2)) * 1.6;
    // ⚠️ LA TAVELURE, ET SON ABSENCE SE VOYAIT — ocean.js l explique : « sans
    // elle, le scintillement et les moutons s alignent en rangees paralleles le
    // long de la houle dominante ». Ici elle faisait pire : la premiere version
    // n avait NI la tavelure NI le facteur d echelle d ecume d ocean.js, et la
    // cote a 7,6 km d altitude etait une masse BLANCHE trouee de bleu. Les deux
    // sont remis. (Le nom « patchy » d ocean.js vient de ce que « patch » est un
    // mot reserve du GLSL et tue la compilation.)
    // ⛔ ET ELLE ETAIT INDEXEE DANS LA MAUVAISE MONNAIE — Tache P4. ocean.js
    // ecrit vnoise(xz * 0.33) ou xz est en UNITES DE SOCLE ; cette ligne
    // divisait par uMerLambda (espace de spectre) puis remultipliait par un
    // 0.08 qui n existe nulle part chez lui. Mesure sur la page vivante : la
    // cellule de tavelure faisait 28,4 % de la largeur du bloc contre 5,41 %
    // sur le socle. CINQ FOIS UN QUART trop large — ce sont LES PLAQUES.
    float tavelure = tavelureMer(bruitMer(vLocal / max(uMerUnite, 1e-9) * ${FREQ_TAVELURE} + vec2(uMerTemps * 0.015, -uMerTemps * 0.011)));
    // ⚠️ LA MEME FONCTION QUE LE SOCLE, INJECTEE ET NON RECOPIEE. vRichesse
    // reste en facteur : c est l echelle d ECHANTILLONNAGE de la calotte (elle
    // atteint zero et fait sortir le vertex), la ou uMerCalmeVue/Surf sont les
    // deux echelles de LOOK d ocean.js. Deux echelles, deux roles, toutes deux
    // presentes — c est exactement ce qui manquait.
    float ecume = clamp(ecumeMer(vCrete, fonduRive, n1, n2, tavelure, uMerTemps,
      uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf) * vRichesse, 0.0, 1.0);
    // ⚠️ blanchirEcume PORTE LA NUIT — Tache P6. La ligne d avant ecrivait
    // vec3(0.96) NU : l ecume du crop restait blanche a minuit quand celle du
    // socle tombe a 0,14 de sa valeur.
    col = blanchirEcume(col, ecume, uMerJour);
    // ⚠️ PLUS DE opac ICI — Tache R2. Il vit desormais dans composeLameEau, et
    // l alpha ne porte que ce qui est GEOMETRIQUE : le bord du crop, le trait
    // d eau, l ecume. C est le max(shoreAA, foam * 0.85) d ocean.js, borde.
    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, profondeurEau), ecume * 0.85));
    return;
  }
  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, profondeurEau));
}
`

// La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
// `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
// fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
// IMPORTÉE, pas recopiée : une constante dupliquée diverge en silence (§1 de
// /threejs-optimisation, question 2).
const CIRCONFERENCE_MERCATOR = CIRCONFERENCE_M

/** Le tampon de travail du grab pass — un seul, comme `_v2` d'`ocean.js`. */
const _tailleDessin = new THREE.Vector2()

// LA RÉSOLUTION DU CHAMP — celui de la mer (Tâche F) et celui du fond du crop
// (Tâche J bis), qui est le MÊME champ lu deux fois.
//
// ⚠️ **384, ET CE N'EST PAS UN CHOIX DE CONFORT** : `SHORE_SURF_GLSL` porte
// `1.0 / 384.0` EN DUR pour son pas de gradient (voir `_cuireChampMer`). Une
// autre résolution déformerait la houle de côte sans que rien ne le signale.
//
// ⚠️ **ET C'EST DÉJÀ PLUS FIN QUE LA SOURCE.** 385 nœuds sur `PORTEE_CROP = 3`
// largeurs de crop font 128 nœuds en travers du bloc, quand la bathymétrie
// plafonne à `BATHY_BASE_ZMAX = 8` — soit, pour trois tuiles z12, **48 pixels de
// donnée vraie** en travers. Monter plus haut ne peindrait que de
// l'interpolation, pour quatre fois la mémoire.
const CHAMP_FOND = 384

const ROOT_Z = 2
// ⚠️ EXPORTÉ POUR QUE LE TEST LE CONFRONTE À LA SOURCE, ET NON À UN LITTÉRAL
// RECOPIÉ (`test/globe-profondeur.test.js`) : un chiffre recopié dans un test
// ne rougit pas quand la source change sous lui.
export const MAX_Z = 15
const MAX_CONCURRENT = 6
// ⚠️ 600, ET C'EST L'ENSEMBLE DE TRAVAIL MESURÉ QUI LE DIT (plan « globe
// continu », Tâche 4 sexies, Étape 2 — balayage rejoué sur ce dépôt, protocole
// A, lat 45°, 12 images jetées puis 20 relevées, stabilité exigée) :
//
//     CACHE_MAX   200 km            60 km             8 km              2 km
//       420       z10, 117 dess.    z11, 168, 27 refus  z11, 172, 28    z11, 163, 28
//       600       z10, 117          z11, **249**, 0     z11, **250**, 0 z11, **235**, 0
//       824       identique à 600   identique à 600   identique à 600   identique à 600
//     1 200       identique à 600   identique à 600   identique à 600   identique à 600
//
// **L'ensemble de travail SATURE À 532 TUILES** : 824 et 1 200 n'achètent
// strictement rien, et 600 laisse 13 % de marge. ⚠️ **ET CE QUE 600 ACHÈTE
// N'EST PAS UN NIVEAU DE ZOOM, C'EST LA COMPLÉTUDE DU NIVEAU ATTEINT** : à 420
// le zoom est déjà z11, mais 28 sous-arbres par image restent grossiers faute
// de budget et 172 tuiles couvrent l'écran là où il en faut 250.
//
// ⚠️ CETTE HAUSSE NE SE POSE QU'APRÈS L'ÉTAPE 1 (le canevas et les hauteurs
// relâchés). Avant elle, une tuile en cache coûtait ~793 Kio — 600 tuiles
// auraient fait 465 Mo sur un tas déjà mesuré à 1,7-1,9 Go. Après elle, la
// facture au cache plein DESCEND malgré les 43 % de tuiles en plus.
const CACHE_MAX = 600 // ready tiles kept before LRU eviction
// ⚠️ ET LE CHEMIN CONTINU A SON PROPRE BUDGET, PARCE QU'IL A SON PROPRE
// ENSEMBLE DE TRAVAIL (plan « globe continu », Tâche 4 quater). Une fois le
// plancher de `dist` levé et `MAX_Z` porté à 15, le globe descend de quatre
// niveaux de plus, et **chaque niveau ajoute ~185 tuiles dessinées** — le
// critère `chord / dist` fixe la taille ANGULAIRE d'une feuille, donc chaque
// niveau pose un anneau d'écran complet, pas « quatre fois plus de feuilles »
// (ce que ce plan avait écrit) ni « un anneau de 22 tuiles » (ce qu'il avait
// écrit ensuite). Balayage rejoué, protocole A, lat 45°, 17 images jetées puis
// 20 relevées :
//
//     CACHE_MAX   60 km                 8 km                    2 km
//       600       z12, 255 dess.        z12, 301, 58 refus/img  z12, 286, 59 refus
//       900       z12, 255              z13, 526, 49 refus      z13, 511, 55 refus
//     1 200       z12, 255              z14, 748, 0 refus       z14, 736, 73 refus
//     1 700       z12, 255              z14, 748, 0 refus       z15, **964**, 0 refus
//     2 400       identique à 1 700     identique à 1 700       identique à 1 700
//
// **L'ensemble de travail SATURE À 1 504 TUILES** (à 2 km, la station la plus
// basse des six nommées) : 2 400 n'achète rien de plus, et 1 700 laisse 13 % de
// marge — la même règle que la Tâche 4 sexies avait appliquée à 532.
//
// ⚠️ ET CE BUDGET N'EST PAS PARTAGÉ AVEC LA PRODUCTION, C'EST MESURÉ ET NON
// PRUDENTIEL. Posé pour TOUT LE MONDE, il fait gonfler l'ancien chemin — qui
// parcourt encore une calotte de deux tiers de planète — de 600 à 1 700 tuiles
// et de 439 à 1 264 tuiles dessinées, soit 153 Mo au lieu de 72 (mêmes sondes,
// station 8 km). L'ancien chemin n'en tirerait qu'un zoom que personne n'a
// demandé, au prix d'une facture que personne n'a arbitrée. **La production
// garde donc exactement le budget que la Tâche 4 sexies lui a mesuré.**
const CACHE_MAX_CONTINU = 1700

// ⚠️ LE PLAFOND DE LA **FILE**, ET CE N'EST PAS LE PLAFOND DE REQUÊTES
// SIMULTANÉES (plan « globe continu », Tâche 4 bis). Celui-là existe déjà et ne
// bouge pas : `MAX_CONCURRENT = 6`. Celui-ci borne `this.queue`, c'est-à-dire
// les tuiles marquées `loading` qui **attendent leur tour** — et c'est là que le
// flux se coinçait, parce que `_request` marque `loading` AVANT d'enfiler.
//
// ⚠️ MESURÉ, ET UNE VALEUR INVENTÉE A DÉJÀ ÉTÉ RÉFUTÉE ICI (ce plan avait écrit
// 512, au-dessus du budget de cache de l'époque). Banc `.banc/pano-latence.mjs`
// — panoramique de référence (90° à 4 km, 60 images), MODÈLE DE LATENCE : une
// requête se résout au bout de `octets × 8 / (débit / MAX_CONCURRENT)`, la tuile
// pesant 87,6 Kio (les 1 401 Ko des seize racines, mesurés chez AWS, voir le
// constructeur). Stabilisation jusqu'à z15, puis balayage :
//
//     débit       pic de `loading`   zoom après 5 s d'immobilité   cache
//     12   Mb/s   **558**            z7                            1 588
//      3   Mb/s   **554**            z3                            1 548
//      0,5 Mb/s   **546**            z3                            1 548
//
// ⚠️ **LE PIC NE DÉPEND PAS DU DÉBIT — 558, 554, 546 sur un facteur 24.** C'est
// la FRONTIÈRE du quadtree qui le fixe, pas le réseau : la règle sans-trou
// n'ouvre un niveau que lorsque les quatre enfants sont prêts, donc le nombre de
// tuiles demandables à une image est borné par la géométrie. Le débit ne change
// que la vitesse à laquelle la file se vide, jamais sa hauteur. L'attaque avait
// vu le même fait à une autre profondeur (« plafonne à 286 à toutes les latences
// essayées ») et en avait tiré la mauvaise conclusion.
//
// ⚠️ **ET LE NAVIGATEUR DIT LA MÊME CHOSE** : la mesure qui a déclenché cette
// tâche relevait **568 tuiles en `loading`**, caméra en mouvement en orbite,
// cache collé à 1 700. Le banc en trouve 558 — le modèle est bon.
//
// **256, et les deux bornes du protocole sont tenues** : strictement sous le pic
// mesuré le plus BAS (546, donc 47 %) et strictement sous le budget de cache
// (`CACHE_MAX_CONTINU` = 1 700, donc 15 %). ⚠️ **L'assertion échoue bien sur le
// code d'avant** — 546 à 558 tuiles en file contre 256 — ce que le §0 exige
// avant de retenir une valeur.
//
// Pourquoi 256 et pas 512 : une file de 512 à six requêtes simultanées et
// 359 ms la tuile (12 Mb/s) met **trente secondes** à se vider — elle travaille
// encore une demi-minute après que la caméra s'est arrêtée ailleurs. À 256 c'est
// quinze secondes dans le pire cas, et la purge d'obsolescence (`_purgerFile`)
// la ramène en pratique à la frontière de l'image courante.
export const PLAFOND_FILE = 256
// Plancher de `dist` dans `_traverse`, EXPRIMÉ EN MÈTRES puis converti — voir
// le long commentaire à son point d'usage. L'ancien plancher valait `1` unité
// de scène, c'est-à-dire 63 710 m, et c'est lui qui plafonnait le globe à z11.
const PLANCHER_DIST_M = 1
const PLANCHER_DIST = PLANCHER_DIST_M * (R_GLOBE / EARTH_RADIUS_M)
const SPLIT_RATIO = 0.38 // tile chord / camera distance beyond which we refine
const MERGE_RATIO = SPLIT_RATIO * 0.8 // hysteresis: refined tiles only coarsen below this
// ══════════ LE RAFFINEMENT PARTIEL ET LA PRÉLECTURE — R37 ═══════════════════
//
// **Adrien, vidéo du 2026-09-03 :** « je vois les zones déjà chargées qui
// redeviennent floues puis se remettent en haute définition à chaque niveau ».
//
// La règle sans-trou était TOUT OU RIEN : un seul enfant manquant sur quatre
// gardait le parent étiré sur tout le quadrant. Depuis R37, les enfants prêts
// se dessinent et le parent ne se dessine que SOUS les manquants (un masque par
// quadrant, porté par les groupes d'index du maillage — voir `_dessinerPartiel`).
// C'est ce que fait Cesium, qui a abandonné la règle stricte en profondeur.
//
// `PRELECTURE_RATIO` : sous ce ratio (`chord / dist`), une tuile dessinée qui
// n'a pas encore besoin de se refendre demande déjà ses enfants du champ, à
// une priorité en retrait (`PRELECTURE_RETRAIT`, soustrait à la clé de PF2) :
// ils partent après tout ce que l'image réclame vraiment, et ils sont souvent
// là quand le seuil est franchi. Mesuré au banc R37 (rapport-R37.md).
const PRELECTURE_RATIO = SPLIT_RATIO * 0.7
const PRELECTURE_RETRAIT = 10
// la clé de PF2 vaut 1000 au centre de l'écran et décroît de 250 par unité NDC
// (bord de tuile) : 850 = le bord de la tuile à moins de 0,6 NDC du centre
const PRELECTURE_CENTRE = 850
// sous ce crédit de création (place libre + récupérable), on ne prélit pas
const PRELECTURE_CREDIT_MIN = 400

// ═══════════ LA CIBLE — D22, le rayon DÉRIVÉ et la barrière ═════════════════
//
// > Adrien : « une sorte de cible. Plus la tuile est proche du centre de la
// > cible, plus elle est prioritaire. (…) charger uniquement une version low def
// > sur les tuiles non prioritaires, qui ne se chargent que quand les tuiles
// > prioritaires ont totalement terminé leur chargement. »
//
// ⚠️ **LE RAYON N'EST PAS POSÉ EN DUR, IL EST DÉRIVÉ.** La clé de PF2 mesure la
// distance du BORD de la tuile au centre de l'écran en NDC (l'écran est le carré
// [−1, 1]², d'aire 4, sa demi-diagonale vaut √2). Le disque « prioritaire » est
// celui qui couvre **la MOITIÉ des pixels** : π R² = 2, donc
//
//     R_CIBLE = √(2 / π) = 0,7979 NDC
//
// C'est le seul choix qui ne demande aucun réglage : « la moitié de l'écran »
// est une phrase, pas un nombre. Il tombe entre le disque inscrit (R = 1, tout
// le bord) et le garde-fou de la prélecture (0,6 NDC, R37) — donc la cible est
// plus large que ce que la prélecture protège déjà, et strictement à l'intérieur
// de l'écran.
const R_CIBLE = Math.sqrt(2 / Math.PI)

// ⚠️ **L'ÉCHÉANCE ANTI-FAMINE SE COMPTE EN ABSENCE DE PROGRÈS, PAS EN DURÉE.**
// Une barrière qui se lève « au bout de N ms » se lèverait sur une descente
// SAINE dès que le réseau traîne — exactement les tirages à 2 s de vol médian du
// banc PF2. Le compteur est donc remis à zéro à chaque fois que le centre AVANCE
// (une tuile prioritaire de moins en attente) : l'échéance ne tombe que sur un
// centre RÉELLEMENT bloqué — 404 de couverture, quarantaine, tuile absente.
// 1 500 ms = au-delà du p99 de vol d'une tuile sur les bancs sains (156–487 ms
// de médiane, PF2 §3), en deçà de ce qu'un œil appelle « ça ne vient jamais ».
const BARRIERE_ECHEANCE_MS = 1500

// LE TRI SPATIAL (plan « globe continu », Tâche 4) — derrière `globeContinu`.
//
// ⚠️ LE VOLUME ENGLOBANT D'UNE TUILE N'EST PAS SA CALOTTE DE SPHÈRE : le relief
// en SORT, et à l'exagération 18 il en sort énormément. Un sommet de 9 000 m
// déplacé de `R_GLOBE / EARTH_RADIUS_M × 18` monte à **2,5 unités de scène,
// soit 159 km** au-dessus de la sphère nue ; la jupe, elle, descend jusqu'à
// 0,9 unité en dessous (voir `skirtDrop` dans `_buildMesh`). Un frustum posé
// sur la sphère nue écrête donc les crêtes au bord de l'écran — et un horizon
// posé sur la sphère nue les fait disparaître au limbe.
//
// ⚠️ CE PARAMÈTRE VAUT TROIS NIVEAUX DE ZOOM, et c'est mesuré : marge 0 rend un
// zoom plus profond et un cache à moitié vide — sur un globe qui a des trous.
// La marge JUSTE coûte des niveaux ; elle ne se négocie pas contre eux.
const ALT_MAX_M = 9000 // Everest 8 849 m, arrondi au-dessus
const JUPE_MAX = 0.9 // le plafond de `skirtDrop`, en unités de scène

// ══════════ LE CACHE SOUPLE — PF2, « ce qui est hors champ ne garde pas sa place » ═══
//
// Le plafond DUR (`CACHE_MAX_CONTINU`) ne se déclenche qu'à 1 700 tuiles ; en
// dessous rien n'est jamais rendu. Mesuré (profil-pf2, scénario cache, build,
// 15 min d'usage — glissés, zooms aller-retour) : **114 → 233 → 614 tuiles
// prêtes HORS TRONC à 1, 5 et 15 min**, pour 151 dans le tronc à la fin. Les
// trois quarts du cache portaient des tuiles qu'aucun écran ne montrait — et
// chacune tient sa texture (256 Kio) en VRAM ou en RAM.
//
// C'est le `tileCacheSize` de Cesium : après chaque image, ce qui n'a pas servi
// à CETTE image est rendu au-delà d'une réserve, en LRU. La réserve garde le
// dézoom gratuit (les ancêtres sont porteuses, donc jamais candidates) et les
// voisines récentes ; l'hystérésis évite de trier le cache à chaque image pour
// trois tuiles. Réservé au chemin continu : les bancs de l'ancien chemin
// comptent leurs requêtes à budget constant (`test/globe-eviction.test.js`).
const CACHE_SOUPLE = 600 // places gardées AU-DELÀ des porteuses de l'image
const CACHE_SOUPLE_HYSTERESE = 100 // on ne taille qu'au-delà de la réserve + ceci


// UNE TUILE QUI NE REVIENDRA JAMAIS OCCUPE UNE PLACE DU BUDGET POUR TOUJOURS.
// C'est le point fixe du cache par une autre porte : `error` et `loading` ne
// sont candidates à aucun rang d'éviction, donc une requête perdue retire une
// place définitivement. 10 s à 60 Hz est large : la requête a été réessayée une
// fois entre-temps.
const IMAGES_BLOQUEE = 600

// ⚠️ ET LA QUARANTAINE EST TEMPORAIRE, JAMAIS DÉFINITIVE. Rendre une tuile en
// erreur évinçable ouvre une boucle : évincée, elle est recréée `empty` au
// parcours suivant, redemandée, échoue, et le réseau repart pour un tour. La
// quarantaine ferme cette boucle — mais une quarantaine PERPÉTUELLE perdrait la
// tuile pour toute la session sur une coupure réseau de trois secondes, et
// `test/globe-reseau.test.js` tient ce contrat noir sur blanc : « la mémoire ne
// garde aucun souvenir de l'échec qui l'en empêcherait ». Dix secondes, donc :
// assez pour tuer la boucle, assez peu pour qu'un réseau revenu soit réessayé.
const IMAGES_QUARANTAINE = 600

// ⚠️ **`gridFor` A DÉMÉNAGÉ DANS `src/monde/maillage-tuile.js` SOUS LE NOM
// `segmentsTuile` — Tâche P11.** Elle a un SECOND lecteur depuis que la paroi du
// crop suit la surface DESSINÉE et non la texture : `hauteurDessinee` doit
// connaître la grille exacte sur laquelle `_buildMesh` a posé ses sommets. La
// recopier là-bas aurait fait « deux écritures jumelles qui divergent », et la
// paroi se serait posée sur une grille que le maillage n'a pas.

// ---------------------------------------------------------------- shader

// ══════════ LES DEUX CONVERSIONS DE LA NORMALE FINE — Tâche P10 ════════════
//
// ⚠️ **ELLES SONT INJECTÉES DANS LE TEXTE GLSL, PAS RECOPIÉES À LA MAIN**, et
// elles DÉRIVENT toutes les deux de `R_GLOBE` et `EARTH_RADIUS_M` — les deux
// constantes de `geo.js` sur lesquelles `_buildMesh` pose déjà ses sommets
// (`dispScale = (R_GLOBE / EARTH_RADIUS_M) * exagération`). Un chiffre écrit en
// dur ici serait la CINQUIÈME faute de monnaie de ce chantier.
//
// ⛔ **ET CE N'EST PAS `CIRCONFERENCE_M` (40 075 016,686 m, l'équateur WGS84)**,
// que `habillage-crop.js` emploie pour convertir des demi-côtés de Mercator en
// mètres de sol RÉELS. Ici on mesure une distance SUR LA SPHÈRE DU GLOBE, et
// cette sphère-là a le rayon MOYEN `EARTH_RADIUS_M = 6 371 000` : c'est lui,
// et lui seul, qui rend la pente cohérente avec `uUnitesParMetre`. Les deux
// diffèrent de 0,11 % — invisible, et faux.
const TOUR_SPHERE_M = 2 * Math.PI * EARTH_RADIUS_M
// unités de scène par mètre de SOL — l'échelle HORIZONTALE, celle que
// l'exagération ne touche PAS (elle n'étire que le relief).
const UNITES_PAR_METRE_SOL = R_GLOBE / EARTH_RADIUS_M

const VERT = /* glsl */ `
// ⚠️ INJECTE, PAS RECOPIE — Tache P10. Le repere de sol est la DERIVEE de
// latLonToSphere ; son jumeau JS (repereSolSphere) est rejoue sous node contre
// latLonToSphere elle-meme dans test/crop-eclairage.test.js.
${GLSL_REPERE_SOL}
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
// LA DISTANCE CAMERA DU FRAGMENT — Tache K, la loi de texture ancree au monde.
//
// (Pas d'accent grave dans ce bloc : il vit dans un template literal JS et le
// terminerait — le piege que terrain.js, ocean.js et le bloc du crop
// documentent tous les trois, et qui a coute une passe de syntaxe ici meme.)
//
// ⚠️ PRISE EN ESPACE DE VUE, PAS EN ESPACE MONDE, ET C'EST LA PRECISION QUI LE
// DICTE : les sommets sont en RTC (relatifs au centre de LEUR tuile) expres pour
// ne pas payer l'ulp float32 a magnitude 100 (0,486 m, recalcule par l'etude du
// fondu de niveaux). modelViewMatrix * position rend la position dans le repere
// de la CAMERA, dont la longueur EST la distance cherchee — sans jamais
// reconstruire une coordonnee monde de grande magnitude.
//
// ⚠️ ET C'EST LA PROFONDEUR (-z de vue), PAS LA LONGUEUR DU VECTEUR. Pour une
// camera en perspective, un pixel couvre 2 z tan(fov/2) / hauteurPx d'un plan
// perpendiculaire a l'axe de vue : la grandeur exacte est la PROFONDEUR. Prendre
// length(mv.xyz) surestimerait de 1/cos(theta) sur les bords — jusqu'a +8 % au
// coin a fov 33 — et ferait varier la loi avec la position a l'ecran, ce que la
// tache existe justement pour supprimer.
//
// ⚠️ ET C'EST UN varying, PAS UN ATTRIBUT : aucun octet de geometrie en plus,
// contrairement a la cible de morphing chiffree a +23 % par l'etude.
varying float vProfCam;
// LE REPERE DE SOL EN ESPACE MONDE — Tache P10, la normale par fragment.
//
// ⛔ P9 PASSAIT LA POSITION EN ESPACE DE VUE (vVue) POUR EN PRENDRE dFdx ET
// dFdy. C'est cette derivee d'ecran qui rendait la normale sensible a la PARITE
// des quads : 10,872 octets de residu pour UN pixel de camera contre 0,030 au
// socle (notation-03 §4). Elle est partie, et vVue avec elle.
//
// ⚠️ ICI, RIEN N'EST UNE DERIVEE. latlon est un ATTRIBUT — la latitude et la
// longitude EXACTES du sommet, deja la pour le graticule et pour la decoupe —,
// donc le repere est une fonction de la POSITION. Un decalage entier de camera
// ne peut plus le changer.
//
// ⚠️ ET LA PRECISION N'EST PLUS UN SUJET : ces vecteurs sont UNITAIRES. La
// raison qui obligeait P9 a l'espace de vue (l'ulp float32 a magnitude 100 vaut
// 0,486 m) ne s'applique pas a un vecteur de longueur 1.
//
// ⚠️ DEUX VARYINGS ET PAS TROIS : le triedre est DIRECT, donc le fragment
// retrouve le nord par cross(haut, est). Un varying de vec3 coute plus cher
// qu'un produit vectoriel par fragment.
varying vec3 vEstW;
varying vec3 vHautW;
attribute vec2 latlon;
void main() {
  vUv = uv;
  vLatLon = latlon;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  // ⚠️ mat3(modelMatrix) ET PAS LE REPERE NU : le groupe du globe pourrait
  // porter une rotation un jour, et vNormalW, uSunDir et uHemiHaut vivent tous
  // dans l'espace MONDE. Poser le repere dans l'espace du MODELE ferait glisser
  // la lumiere le jour ou quelqu'un tourne le groupe, sans qu'aucune erreur ne
  // soit levee.
  vec3 estL, nordL, hautL;
  repereSolSphere(latlon.x, latlon.y, estL, nordL, hautL);
  vEstW = mat3(modelMatrix) * estL;
  vHautW = mat3(modelMatrix) * hautL;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vProfCam = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
// ══════════ LA NORMALE PAR FRAGMENT — Tache P9 ═════════════════════════════
//
// ⚠️ uNormaleFineOn VAUT ZERO PAR DEFAUT, exactement comme uCropOn, uHabOn,
// uMerRampeOn, uEclairageOn et uMppFacteur : sans poserHabillage la vue
// orbitale en production rend au bit pres ce qu'elle rendait.
//
// Ce que ce poste repare est mesure et decompose dans l'en-tete §6 de
// src/monde/eclairage-crop.js : la COULEUR du crop porte deja plus de detail
// que celle du socle (10,250 contre 8,723 en energie, lumiere coupee des deux
// cotes), et c'est son OMBRAGE qui manque en entier — parce que ses normales
// viennent d'une grille de 5 625 sommets sur le bloc contre 594 434 au socle.
varying vec3 vEstW;
varying vec3 vHautW;
uniform float uNormaleFineOn;
// unites de scene par METRE de relief : (R_GLOBE / EARTH_RADIUS_M) x exageration
uniform float uUnitesParMetre;

// ══════════ L'OMBRAGE DE RELIEF DE LA PLANETE — regle D15, Tache R6 ════════
//
// ⚠️ uReliefMondeGain VAUT ZERO PAR DEFAUT, exactement comme uCropOn, uHabOn et
// uNormaleFineOn. A zero, ombrageReliefMonde n'est meme pas appele et
// ombreRelief reste a 1.0 : colPlanete est celle du depot AU BIT PRES.
//
// L'azimut et l'elevation sont en RADIANS, deja convertis par le JS : le
// nuanceur ne fait pas de conversion d'unite, c'est la faute qui a coute quatre
// fois a ce chantier (uMerHoule 121,6x trop haute, skirtDrop 10x trop long).
// La loi, son neutre sur sol plat et sa demonstration : monde/planete-eclairee.js.
uniform float uReliefMondeGain;
uniform float uReliefMondeAz;
uniform float uReliefMondeEl;
// ⚠️ LA FRACTION DU MONDE MERCATOR QUE COUVRE UNE UNITE D'UV : 1 / 2^z, DONC
// PROPRE A LA TUILE, comme uTex et uTilePx. Elle donne les metres de sol par
// unite d'uv (le tour de la sphere x cos(latitude) x elle), c'est-a-dire la
// MONNAIE qui convertit une denivelee en metres en une PENTE. La mettre dans
// this.uniforms, partage, ferait juger toutes les tuiles sur le niveau de la
// derniere chargee -- exactement le defaut que uTilePx documente juste a cote.
uniform float uUvParMonde;
uniform sampler2D uTex;
uniform sampler2D uRamp;
uniform vec3 uSunDir;
uniform vec3 uInk;
uniform vec3 uShadowColor;
// LE PLANCHER DE NUIT — Tache R7, tour de correction. Le pourquoi et les
// valeurs sont dans monde/soleil-monde.js (plancherNuitMonde).
uniform vec3 uNuitFond;
uniform float uNuitCarte;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uGraticuleOpacity;
// ══════════ LA GRILLE DE RELEVE DU BLOC — Tache R22, options 19 et 20 ═══════
//
// ⚠️ uGridOpacity VAUT ZERO PAR DEFAUT, exactement comme uCropOn, uHabOn,
// uMerRampeOn, uEclairageOn et uMppFacteur : sans poserHabillage, le bloc de
// grille est franchi sans rien peindre et la planete est celle d'avant cette
// tache AU BIT PRES. La garde est un UNIFORME, donc les fwidth qu'elle protege
// sont legaux (tous les fragments d'un quad prennent la meme branche) — c'est la
// meme regle que le trait de cote deux cents lignes plus bas.
//
// ⚠️ DEUX LONGUEURS, ET TOUTES DEUX EN METRES DE SOL. uGridStepM est le pas
// converti depuis la tirette (pasGrilleBloc, monde/habillage-crop.js) ;
// uCropDemiM est la demi-largeur au sol du crop (largeurCropM / 2), c'est-a-dire
// ce que vaut qCrop = 1. Leur rapport est le nombre de cellules, et c'est LUI
// que le test appareille au compte du socle.
uniform float uGridStepM;   // le pas au sol de la grille, en metres
uniform float uGridOpacity; // l'opacite de la grille, 0 = eteinte
uniform vec3 uGridColor;    // l'encre de la grille — uGridColor du socle
uniform float uCropDemiM;   // la demi-largeur au sol du crop, en metres
uniform float uOceanDepth;
uniform float uLandMax;

// ══════════ LA RAMPE CALCULEE SUR LE CROP — Tache D, « UNE SEULE TERRE » ════
//
// Adrien, decision 4 : « la rampe de couleur se calcule SUR LE CROP, et les
// alentours la suivent ». La loi vit dans src/monde/rampe-crop.js et se verifie
// sous node ; ce bloc-ci en est la TRANSCRIPTION, et test/crop-rampe.test.js
// l'EXTRAIT puis l'EXECUTE au lieu d'y chercher un nom.
//
// (Pas d'accent grave dans ce bloc : il vit dans un template literal JS, il le
// terminerait — le piege que terrain.js et ocean.js documentent tous les deux.)
//
// ⚠️ CES DEUX-LA SONT PARTAGES, COMME uLandMax ET uOceanDepth, ET C'EST TOUTE
// LA MECANIQUE DE « les alentours la suivent » : ils vivent dans this.uniforms,
// que _materialFor etale dans CHAQUE materiau de tuile. Une tuile a l'autre bout
// de la planete peint donc avec l'echelle du crop. Il n'y a pas de seconde
// rampe a raccorder, donc pas de couture a dessiner : la couture ne peut pas
// naitre.
//
// ⚠️ ET LEURS VALEURS PAR DEFAUT SONT L'ECHELLE MONDIALE (RAMPE_MONDE) : sans
// poserRampe, le globe peint au bit pres comme avant la Tache D. Meme garde que
// uCropOn (Tache A) et uHabOn (Tache C).
uniform float uLandBas; // l ancre BASSE de la rampe terre, en metres
// ══════════ L'ANCRE BASSE DU RELIEF — Tache P11 ═══════════════════════════
//
// ⛔ ELLE N'EST PAS -uOceanDepth, ET LA NOTATION 03 A CHIFFRE CE QUE CA COUTE.
// L'ecriture d'avant justifiait l'egalite par « le minimum du relief du crop EST
// -uOceanDepth ». Elle ne tient que si le crop A DE LA MER : sans un seul point
// sous le niveau de la mer, echelleRampe rend le PLANCHER DE DIVISION,
// echelle-continue refuse (a raison) d'ancrer un budget de profondeur muet, et
// l'uniforme garde la valeur MONDIALE de 6 000 m. Releve le 2026-08-23, La
// Reunion cadrage interieur, page vivante, socle rallume dans la MEME page
// (.banc/P11/) : uOceanDepth = 6 000 pour un crop dont le point le plus bas est
// a 107 m. Le pivot de rampe montait donc a 0,685 au lieu de 0,41 et la rampe
// n'atteignait JAMAIS sa moitie basse — l'olive et l'ocre du socle, x3,51 et
// x2,82, que le crop remplacait par du rose.
//
// ⚠️ SA VALEUR NEUTRE EST -RAMPE_MONDE.profondeur, donc la production rend
// EXACTEMENT ce qu'elle rendait : (h - (-6000)) / (5600 - (-6000)) EST
// (h + 6000) / (5600 + 6000), au bit pres. Meme garde que uCropOn et uHabOn.
uniform float uReliefBas; // le minimum du RELIEF du crop, en metres (signe)
// ══════════ LA RAMPE NAUTIQUE — Tache F ═══════════════════════════════════
//
// ⚠️ C'EST LA PIECE QUE LA TACHE D A NOMMEE SANS LA PRENDRE. Son bilan ecrit :
// le globe peint la mer avec le BAS de sa propre table (uRamp dans [0 ; 0,35])
// pendant que le socle emploie « une rampe nautique a TROIS couleurs
// (uOceanShallow/Mid/Deep) » — et il conclut : « la reconcilier suppose de
// toucher a la mer, c'est-a-dire la Tache F ».
//
// ⚠️ ET C'EST ELLE QU'ON VOIT. Regarde cote a cote (.banc/vues/W-socle-bloc.jpg
// contre V-crop-mer-bloc.jpg) : le socle rend une mer NOIRE au large avec une
// frange TURQUOISE etroite au littoral, et cette frange n'est PAS la lame
// d'eau — c'est le FOND MARIN, vu au travers. Le globe, lui, peignait le meme
// fond en olive sombre.
//
// ⚠️ uMerRampeOn VAUT ZERO PAR DEFAUT, exactement comme uCropOn et uHabOn :
// sans poserMer, la production est intouchee au bit pres.
uniform float uMerRampeOn;
// ⚠️ LE BUDGET DU FOND N'EST PAS uOceanDepth, ET LE CONFONDRE SE VOIT. La rampe
// de la Tache D cale uOceanDepth sur la profondeur mesuree du CROP — qui vaut
// 6 000 m (la valeur MONDIALE) tant que poserRampe est refusee faute de
// couverture. Le socle, lui, prend l'amplitude de SON champ (uSeaRange). Ce
// budget-ci vient donc du champ de la calotte, ou il est mesure.
uniform float uMerFondBudgetM;
uniform vec3 uOceanShallow;
uniform vec3 uOceanMid;
uniform vec3 uOceanDeep;
uniform float uPlancherRampeM; // garde de division, en metres — voir le module
// ══════════ LE ZERO DE LA MER — Tache K bis ════════════════════════════════
// 0 : sousEau vaut h < 0, la production au bit pres. 1 : h <= 0, et le plan de
// mer cesse de peindre la premiere teinte de terre. Voir le corps du nuanceur.
uniform float uMerZeroSousEau;
// côté de la tuile en texels — 256 (AWS) ou 512 (Mapterhorn), voir planTuile
uniform float uTilePx;

// ══════════ LA LOI DE TEXTURE ANCREE AU MONDE — Tache K ═══════════════════
//
// ⚠️ uMppFacteur A 0 : RIEN NE CHANGE. Meme garde et meme raison que uCropOn,
// uHabOn et uMerRampeOn — la production (la vue orbitale du globe, en ligne sur
// shibumap.com) rend exactement ce qu'elle rendait, au bit pres, tant que
// poserLoiMonde n'a pas ete appele. C'est le patron « on elargit sans changer le
// defaut » (distanceRivage de F, aussi: null de J, le fond de J bis).
//
// La loi vit dans src/monde/loi-texture-monde.js et se verifie sous node
// (test/loi-texture-monde.test.js) ; ce bloc-ci en est la TRANSCRIPTION.
uniform float uMppFacteur;    // metres de sol par pixel d'ecran, PAR unite de distance
uniform float uResRefM;       // metres de sol par texel de la donnee de reference
uniform float uGrainParPixel; // cellules de grain par pixel d'ecran
uniform float uMetresParDegre;
varying float vProfCam;

// ══════════ LE CROP DÉCOUPÉ DANS LA SPHÈRE — Tâche A, « UNE SEULE TERRE » ═══
//
// Adrien, le 2026-08-21 : « Le crop doit se faire dans la terre arrondie. » Les
// tuiles cessent d'être dessinées entières ; elles sont coupées à la forme du
// socle. La loi vit dans src/monde/crop-sphere.js et se vérifie sous node
// (test/crop-sphere.test.js) ; ce bloc-ci en est la TRANSCRIPTION.
//
// (Pas d'accent grave dans ce bloc : il vit dans un template literal JS, il le
// terminerait — le piège que terrain.js et ocean.js documentent tous les deux,
// et il a coûté une suite entière la fois précédente.)
//
// ⚠️ uCropOn VAUT ZÉRO PAR DÉFAUT. Le nuanceur est partagé par TOUTES les
// tuiles : sans cette garde le globe se découperait de lui-même, drapeau baissé.
uniform float uCropOn;
uniform vec2 uCropCentre; // centre du crop, en mercator normalisé
uniform float uCropDemi; // demi-côté du crop, même unité
uniform float uCropCoin; // rayon d'arrondi, en FRACTION du demi-côté
uniform float uCropCoinN; // exposant de superellipse (2 = cercle, 4,4 = défaut)

// ══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tache G, decision 3 ═══════════
//
// Adrien : « la planete autour du crop se fond progressivement vers le fond a
// mesure qu'on descend, pour que le bloc se detache ». La loi vit dans
// src/monde/estompage-terre.js et se verifie sous node — ce bloc-ci n'en est
// que le point d'application.
//
// (Pas d'accent grave dans ce bloc non plus : template literal.)
//
// ⚠️ SANS CETTE TACHE, LA TACHE A N'ESTOMPE PAS LA PLANETE AUTOUR : ELLE
// L'EFFACE TOUT COURT. Releve par la Tache D a y = 900 — le discard emporte
// tout ce qui est hors du crop, a toutes les altitudes. uEstompage = 1 est
// exactement ce comportement-la ; uEstompage = 0 rend la planete ENTIERE ; et
// c'est l'ALTITUDE qui glisse entre les deux (regle R1).
//
// ⚠️ uEstompageOn VAUT ZERO PAR DEFAUT, comme uCropOn, uHabOn et uMerRampeOn.
// Ce n'est pas un doublon de uEstompage : les trois sites qui les lisent (les
// tuiles ici, l'atmosphere, les calottes) n'ont PAS la meme valeur neutre — 1
// pour les tuiles (« le crop seul », la Tache A), 0 pour les deux autres
// (« intouches »). Une seule valeur par defaut ne peut pas servir les deux.
uniform float uEstompageOn;
uniform float uEstompage; // 0 = planete entiere, 1 = le crop seul

// ══════════ L'HABILLAGE — Tache C, « le globe prend le rendu du socle » ═════
//
// Adrien, decision 6 : « je veux le meme rendu que la qualite de rendu des
// tuiles a plat qui vont donc disparaitre ». Quatre postes sont dans le
// perimetre de cette tache — courbes calees sur le local, grain, masque de
// cote, occupation du sol. La loi vit dans src/monde/habillage-crop.js et se
// verifie sous node ; ce bloc-ci en est la TRANSCRIPTION.
//
// (Pas d'accent grave dans ce bloc : il vit dans un template literal JS, il le
// terminerait — le piege que terrain.js et ocean.js documentent tous les deux.)
//
// ⚠️ uHabOn VAUT ZERO PAR DEFAUT, exactement comme uCropOn, et pour la meme
// raison : le nuanceur est PARTAGE par toutes les tuiles du globe, y compris
// celles qui ne verront jamais de crop. Sans poserHabillage, rien ne change.
uniform float uHabOn;

// ⚠️ POURQUOI CES TROIS SAMPLERS NE SONT PAS DERRIERE UN #ifdef, ALORS QUE LEURS
// JUMEAUX DE terrain.js LE SONT. Le defaut du 2026-08-03 (test/plafond-unites-
// texture.test.js) etait un DEPASSEMENT : 12 samplers du nuanceur de carte + 4
// du materiau de surface + environnement + carte d'ombre = 18, pour un plafond
// de 16, et le terrain disparaissait. Le nuanceur du globe, lui, est un
// ShaderMaterial NU : il n'a ni materiau de surface, ni environnement, ni carte
// d'ombre. Le compte y passe de DEUX (uTex, uRamp) a CINQ. Le #ifdef aurait
// coute une recompilation de chaque materiau de tuile a chaque bascule de
// couche, pour economiser une unite sur onze disponibles.
uniform sampler2D uCoastMask;
uniform float uCoastMaskOn;
uniform float uMargeCoteM; // la marge du socle (0,02 unite), CONVERTIE en metres
uniform sampler2D uSol;
uniform sampler2D uSolLut;
uniform float uSolOn;
uniform float uSolOpacite;
uniform vec2 uSolOffset;
uniform vec2 uSolScale;
uniform vec2 uSolTexel;
uniform float uGrainForceM; // amplitude du grain, en METRES de relief
uniform float uGrainEchelle;
uniform float uContourWeight; // le poids de trait du socle (uContourWeight)

// ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
//
// ⚠️ LA COULEUR AUSSI LIT LE FOND, ET SANS CA LA GEOMETRIE SEULE NE SUFFIT PAS.
// La rampe se calcule sur h = decodeMetersAA(vUv), c'est-a-dire sur le
// TERRARIUM, qui rend zero sur 51,1 % des echantillons du bloc (mesure). Or
// sousEau vaut h < 0.0 : a h == 0 exactement, la rampe prend la branche TERRE
// et sort son vert le plus bas. C'est le plateau vert uniforme de la Tache J, et
// c'est aussi la moitie verte du marbrage.
//
// ⚠️ SIXIEME SAMPLER. Le bloc ci-dessus compte CINQ liens (uTex, uRamp,
// uCoastMask, uSol, uSolLut) pour un plafond de seize : celui-ci fait six, et le
// raisonnement de ce bloc-la tient tel quel.
uniform sampler2D uFondChamp;  // R : altitude du fond du crop, en unites locales
uniform float uFondOn;
uniform float uFondPortee;     // en demi-cotes de crop — la demi-largeur du champ
uniform float uFondMetres;     // metres par unite locale : l'inverse de l'echelle
// ⚡ LA CELLULE DU CHAMP, EN DEMI-COTES DE CROP — Tache R17.
//
// C'est le pas AUQUEL le champ a ete cuit : 2 x uFondPortee demi-cotes de crop
// divises par CHAMP_FOND intervalles. Le gradient de la normale fine s'en sert
// pour deriver le fond marin A LA MAILLE DU CHAMP et non six fois plus fin — la
// demonstration chiffree est au point d'appel.
//
// ⚠️ ZERO PAR DEFAUT, ET C'EST LE DEPOT AU BIT PRES : max(1/uTilePx, 0) rend
// exactement 1/uTilePx, le pas de la Tache P12. Meme garde et meme raison que
// uFondOn, uCropOn et uMppFacteur.
uniform float uFondPasQ;

// ══════ LA COLORISATION NATURELLE DU SOCLE — Tache P2 ══════════════════════
//
// > Adrien, 2026-08-22 : « Plus aucune texture sur la terre. » · « Je voudrais
// > qu'on arrive a retrouver la texture comme elle etait avant de faire la
// > modification vers la sphere. Pour l'instant le detail est trop basique. »
//
// ⚠️ CE QUI MANQUAIT N'ETAIT PAS UN REGLAGE, C'ETAIT LE FIL. La Tache C avait
// porte l'EMBALLAGE de l'habillage (courbes, grain, cote, occupation du sol) et
// mesure qu'il ne deplace que 1,01 % des pixels ; son bilan nommait ce qui
// restait : « ce qui fait la richesse de l'image du socle, c'est le TEXTURE
// SHADING et la rampe locale ». Or terrain-analysis.js n'a AUCUNE importation :
// la texture d'analyse EXISTE deja, cuite pour le bloc, et personne ne la
// passait au globe. contexteCrop la transmet desormais, comme uCoastMask et
// uSol — meme patron, meme loi d'UV, demontree en tete de habillage-crop.js.
//
// ⚠️ SEPTIEME ET HUITIEME SAMPLERS, ET LE COMPTE EST REFAIT. Le bloc du masque
// de cote comptait CINQ liens (uTex, uRamp, uCoastMask, uSol, uSolLut) ; le fond
// du crop a fait SIX. uAnalysis et uRampCrop font HUIT, pour un plafond de
// seize. Le raisonnement de ce bloc-la (ShaderMaterial NU : ni materiau de
// surface, ni environnement, ni carte d'ombre) tient tel quel, et
// test/crop-naturel.test.js COMPTE les sampler2D de ce fragment plutot que de
// croire ce commentaire.
//
// R = peigne des cretes (0,5 = plat)   G = ombrage classique
// B = humidite topographique           A = exposition (1 = plein nord)
uniform sampler2D uAnalysis;
uniform float uAnalysisOn;
uniform float uTexShade;   // intensite du peigne
uniform float uWetK;       // poids de l'humidite sur l'axe Y du LUT
uniform float uExpoK;      // poids de l'exposition (adret / ubac)
uniform float uHemi;       // +1 hemisphere nord, -1 sud : l'ubac change de cote
uniform float uTreeLine;   // en hNorm : au-dessus, plus de vegetation
// ⚠️ LA TABLE DU SOCLE, PAS UNE SECONDE TABLE. uRamp (512 x 1) est la rampe du
// globe ; uRampCrop est LE MEME OBJET THREE que terrain.mapUniforms.uRampTex,
// c'est-a-dire le LUT 2D du socle (X = altitude, Y = humidite), cuit par
// buildRamp2D avec rampDry / rampWet / rampOklab. En rebatir un jumeau ici
// aurait redonne deux tables a garder d'accord — et c'est par ce lien que
// rampDry, rampWet et rampOklab arrivent sur la sphere SANS un seul uniforme.
uniform sampler2D uRampCrop;
uniform float uRampCropOn;
uniform float uHeightContrast; // le contraste de rampe du socle
uniform float uHeightPivot;    // son pivot, en hNorm
// ══════ LE RECOLLAGE DES DEUX ECHELLES — Tache R31 ════════════════════════
//
// ⚠️ LE POIDS DU REGIME MONDIAL DANS L'INDICE DE RAMPE DU CROP, dans [0 ; 1].
// Zero = l'echelle du bloc, celle de l'affiche ; un = celle de la planete.
// La loi et ses deux crans vivent dans monde/rampe-crop.js (poidsRecollage) ;
// ici il n'y a qu'un melange, parce que le poids est CONSTANT sur l'image et
// que le GPU n'a donc rien a evaluer soixante fois par seconde par fragment.
//
// ⚠️ ZERO PAR DEFAUT, comme uCropOn, uHabOn et uRampCropOn : sans altitude
// passee a poserRampe, le globe peint EXACTEMENT ce qu'il peignait — mix(x, y,
// 0.0) vaut x*1 + y*0. La garde est la loi elle-meme, pas seulement un drapeau.
uniform float uRecollage;
uniform float uHazeAmt;        // perspective aerienne (Imhof) — force globale
uniform float uHazeAlt;
uniform float uHazeDist;
uniform vec3 uHazeColor;

// ══════ LA PHOTO AERIENNE — Tache R9 ═══════════════════════════════════════
//
// > Adrien, 2026-08-23 : « remettre en route l'imagerie satellite ».
//
// ⛔ LE BOUTON ETAIT VISIBLE ET INERTE. ui/bars.js:491 → main.js (toggleAerial)
// → refreshAerial → aerialLayer.build → terrain.setAerial : la chaine entiere
// tournait, allait au reseau, composait la mosaique, et la posait sur le
// MAILLAGE PLAT, qui est invisible sous ?terre=unique. Le globe n'avait aucun
// uniforme pour la recevoir.
//
// ⚠️ NEUVIEME SAMPLER, ET LE COMPTE EST REFAIT ICI. Le bloc du masque de cote
// comptait CINQ liens (uTex, uRamp, uCoastMask, uSol, uSolLut) ; le fond du crop
// a fait SIX ; uAnalysis et uRampCrop ont fait HUIT. uAerial fait NEUF, et
// uPhoto (Tache R16, la photo de la SURFACE) fait DIX ; et uMatMap / uMatNormal
// (Tache R25, la matiere du relief) font DOUZE, pour un
// plafond de seize.
//
// ⚠️ ET LE PLAFOND N'EST PAS THEORIQUE : terrain.js a DEJA plante dessus (« le
// gabarit java passait de 17 a 18 unites, au-dessus des 16 que la machine offre
// — le terrain ne linkait plus et disparaissait »). Il reste QUATRE unites. La
// carte de rugosite de la matiere aurait fait treize, et elle n'est pas la —
// mais c'est parce qu'elle n'a pas de receveur (voir monde/matiere-crop.js), pas
// pour tenir le compte. Le raisonnement du bloc du masque de cote (ShaderMaterial
// NU : ni materiau de surface, ni environnement, ni carte d'ombre) tient tel
// quel, et test/crop-eclairage.test.js COMPTE les sampler2D de ce fragment
// plutot que de croire ce commentaire.
//
// ⚠️ C'EST UNE SEULE TEXTURE POUR TOUTE L'EMPRISE, PAS UNE PAR TUILE. La
// mosaique est composee une fois par aerial-layer.js sur les deux coins du champ
// charge (demBounds), puis posee sur le crop par une affine (offset / echelle) —
// exactement comme uSol. Rien ici ne connait le quadtree du globe.
//
// ⚠️ ET ELLE SE LIT EN UV DRAPE, PAS EN UV DE CHAMP CUIT — voir le bloc de
// lecture, plus bas. Confondre les deux familles retourne la photo NORD-SUD, et
// rien ne leve d'erreur.
uniform sampler2D uAerial;
uniform float uAerialOn;
uniform float uAerialOpacity;
uniform vec2 uAerialOffset;
uniform vec2 uAerialScale;
// ⚠️ LE FONDU COTIER — TOUR DE CORRECTION DE R9, ET CE N'EST PAS COSMETIQUE.
// R9 l'avait declare non portable, faute d'uSeaY / uSeaRange / vWorldPos.y dans
// ce nuanceur. La relecture a mesure l'ecart sur le socle (La Reunion z9,
// fondu 0,1 contre 0) : 72,7 % des pixels, ecart moyen 93,6/255 — et sur le
// crop, la photo couvre la mer EN PLAQUES a coutures de tuiles visibles.
//
// ⚠️ ET LA CORRESPONDANCE N'EST PAS NEUVE : elle est deja ecrite dans ce
// fichier, au bloc du fond marin. « Le socle mesure sa profondeur en unites de
// scene (uSeaY - y sur uSeaRange), le globe en METRES BRUTS (-h sur
// uMerFondBudgetM) ». Le niveau de la mer du globe est h = 0 ; le budget de
// profondeur du crop est uMerFondBudgetM, que poserMer cale sur profMaxCropM
// comme le socle cale uSeaRange sur -dem.minM. Meme substitution, meme bloc.
// Ce n'est donc PAS une seconde loi de niveau d'eau, c'est la premiere, relue.
uniform float uAerialCoastFade;

// ══════ LA PHOTO SUR LA SURFACE DU GLOBE — Tache R16 ═══════════════════════
//
// ⛔ LE CONSTAT QUI COMMANDE CE BLOC (rapport R12, §2, arithmetique verifiee) :
// la photo n'existait QUE dans le crop (uAerial, quinze lignes plus haut, sous
// dedansCrop > 0.0). Or le crop nait sous 32,3 km et meurt au-dessus de 40,3 km,
// et a 40,3 km son emprise occupe deja 1,4 x la hauteur de l'ecran a z13 et
// 1 475 x a z3. LE CROP NE PEUT DONC JAMAIS MONTRER UN CONTINENT. Il fallait un
// second chemin, sur la SURFACE, et le voici.
//
// ⚠️⚠️ **UN SEUL SAMPLER DE PLUS, PAS UN PAR TUILE — PIEGE ④ DU BRIEF.** Le
// nuanceur en etait a NEUF sur seize (test/crop-eclairage.test.js ⑤f, et
// test/plafond-unites-texture.test.js raconte le jour ou le socle a atteint 18
// et ou le terrain a disparu). uPhoto en fait DIX. Ce qui varie d'une tuile a
// l'autre n'est pas le nombre de samplers, c'est la VALEUR de celui-ci : il est
// declare dans _materialFor, exactement comme uTex et uTilePx, donc chaque tuile
// lie SA photo au moment du dessin. Douze cents tuiles, un sampler.
//
// ⚠️ uPhotoUv EST UNE SOUS-FENETRE, ET C'EST TOUT LE « GROSSIER D'ABORD ». Une
// tuile z12 lit la photo de son aieul z8 par (uv * uPhotoUv.zw + uPhotoUv.xy) :
// la couverture est immediate, en basse resolution, sans attendre son propre
// niveau. C'est le « imagery LOD lags terrain LOD » de Cesium et de Google
// Earth, et il est gratuit ici parce que le quadtree EST un arbre.
// Voir monde/photo-monde.js (sousFenetre) pour la derivation, retournement de
// l'axe Y compris — l'UV monte au nord, l'indice y de tuile monte au sud.
uniform sampler2D uPhoto;
uniform float uPhotoOn;      // par TUILE : sa photo est-elle liee ?
uniform vec4 uPhotoUv;       // par TUILE : (offsetX, offsetY, echelleX, echelleY)
uniform float uPhotoMonde;   // PARTAGE : l'opacite de la couche, 0 = eteinte
// ⚠️ ET CELUI-CI A SA PROPRE VALEUR, PAS CELLE DU CROP. uAerialCoastFade vaut
// ZERO au repos (HABILLAGE_MONDE : « c'est le "eteint" du socle ») et ne prend
// 0,1 que quand poserHabillage transmet la valeur vivante du BLOC. En orbite il
// n'y a pas de bloc — la premiere version de ce correctif s'y est laisse prendre
// et l'ocean est reste NOIR, mesure. Voir FONDU_MER_MONDE (monde/photo-monde.js).
uniform float uPhotoFonduMer; // PARTAGE : la bande de fondu cotier, en fraction

// ══════ L'ECLAIRAGE DU CROP — Tache P3 ═════════════════════════════════════
//
// ⚠️ uEclairageOn VAUT ZERO PAR DEFAUT, comme uCropOn, uHabOn, uMerRampeOn,
// uMerZeroSousEau et uMppFacteur : sans poserEclairage, la vue orbitale en
// production rend exactement ce qu'elle rendait, AU BIT PRES. Le bloc qui les
// lit est garde par un uniforme, donc par un branchement uniforme, donc les
// derivees d'ecran du reste du nuanceur restent definies.
//
// ⚠️ CE SONT DES IRRADIANCES, PAS DES COULEURS. three multiplie deja la couleur
// d'une lampe par son intensite avant de la pousser (WebGLLights) ; l'appelant
// fait le meme produit une seule fois, et le nuanceur n'a pas a savoir qu'une
// intensite existe. Toutes sont LINEAIRES.
uniform float uEclairageOn;
uniform vec3 uSoleilDir;   // le soleil de la SCENE, replace dans le repere du crop
uniform vec3 uSoleilIrr;   // sun.color x sun.intensity
uniform vec3 uHemiHaut;    // la verticale locale du crop, dans le repere du globe
// ⚠️ ET LES DEUX PORTENT AUSSI L'ENVIRONNEMENT. L'irradiance de
// scene.environment est MESUREE (src/sonde-ambiante.js) puis ramenee a un ciel
// et un sol, parce qu'elle depend de la normale — ecart-type 17,7 % releve sur
// le socle. mix(sol, ciel, 0.5 ndu + 0.5) est deja la loi de three pour une
// lampe hemispherique, et c'est l'approximation du premier ordre d'un
// environnement : les additionner evite un troisieme terme ET garde une loi.
uniform vec3 uCielIrr;     // hemi.color x hemi.intensity + ambiante zenith
uniform vec3 uSolIrr;      // hemi.groundColor x hemi.intensity + ambiante nadir
uniform vec3 uAlbedoBase;  // params.color du socle, en lineaire
uniform float uAlbedoTeinte; // mapTint — il retrouve un sens des qu'il y a une lumiere

// ══════ L'APPOINT — Tache R21, options 69 a 73 de l'inventaire ═════════════
//
// ⛔ CINQ CURSEURS VISIBLES ET INERTES : l'appoint est une seconde
// THREE.DirectionalLight de la scene du BLOC PLAT, que le crop ne voit pas.
// Mesure au banc R18 rejouee sous R21, mouvement ambiant coupe (plancher
// 0,0000) : 0,000 de moyenne et 0,000 de gradient aux deux bouts des cinq.
//
// ⚠️ C'EST UN TERME ADDITIF, PAS UNE SECONDE LOI. three accumule une seconde
// directionnelle dans le MEME irradiance avant le MEME BRDF_Lambert
// (RE_Direct) ; irradianceCrop fait deja exactement ca pour le soleil. La loi
// et ses conversions d'unite CHIFFREES vivent dans monde/lumiere-sphere.js.
//
// ⚠️ uAppointIrr VAUT (0,0,0) PAR DEFAUT, ET C'EST LA GARDE : la somme du
// nuanceur est alors inchangee terme a terme, quelle que soit uAppointDir.
// Meme patron que uReliefMondeGain = 0 et que ECLAIRAGE_MONDE.
uniform vec3 uAppointDir;  // l'appoint, replace dans le repere du globe
uniform vec3 uAppointIrr;  // fillLight.color x fillLight.intensity, LINEAIRE

// ══════ L'OMBRAGE DES PENTES — Tache R21, option 30 ════════════════════════
//
// ⛔ « AUCUN COTE GLOBE » disait l'inventaire, et naturel-crop.js l'avait
// DECLARE LAISSE : « les tuiles du globe ne portent que vNormalW, la normale de
// la SPHERE : la pente du terrain n'existe pas dans ce nuanceur ». C'etait vrai
// quand ca a ete ecrit : nMonde, la normale PAR FRAGMENT, existe depuis la
// Tache P9, et D15 l'allume partout.
//
// ⚠️ ZERO PAR DEFAUT : mix(a, b, 0) rend a au bit pres. C'est la ligne d'avant.
uniform float uSlopeTint;

// ══════ LA COUCHE APPARENCE — Tache P3 ═════════════════════════════
// ⚠️ uSurfaceFx VAUT ZERO PAR DEFAUT, comme uCropOn / uHabOn / uEclairageOn.
// Ces noms sont ceux que FX_GLSL LIT : les renommer casserait le module
// partage, et test/crop-eclairage.test.js compte ce qu'il exige.
uniform int uSurfaceFx;
uniform int uFxBlend;
uniform float uFxOpacite;
uniform float uFxScale;
uniform float uFxTime;
uniform vec3 uFxColA;
uniform vec3 uFxColB;
uniform vec3 uFxColC;
uniform float uFxP1;
uniform float uFxP2;
uniform float uFxP3;
// ⚠️ LE MOTIF EST PEINT SUR LE SOL, PAS SUR L'ECRAN NI SUR LA TUILE. terrain.js
// l'indexe sur champXZ() = vWorldPos.xz + uFenetre, et son commentaire dit
// pourquoi : indexe sur la geometrie il resterait colle a l'ecran pendant que
// le relief defile — le moirage qu'Adrien a attrape a l'oeil. Ici la meme
// grandeur est qCrop x uFxDemiBloc + uFxFenetre : l'en-tete de
// habillage-crop.js DEMONTRE x = 28 u avec uSlabHalf = 28, donc les deux
// nuanceurs echantillonnent le meme point du sol.
uniform float uFxDemiBloc;
uniform vec2 uFxFenetre;

float decodeMeters(vec2 uv) {
  vec3 t = texture2D(uTex, uv).rgb * 255.0;
  return t.r * 256.0 + t.g + t.b / 256.0 - 32768.0;
}
// SUPERSAMPLED decode (Adrien : scintillement du monde en orbite). The height
// texture carries no mipmaps (mip-averaging corrupts the packed metres), so a
// single minified sample jumps frame to frame as the camera moves — the whole
// map crawls. We DECODE five taps (each exact) across the pixel's footprint and
// average the METRES : smooth height → smooth colour AND contours, no shimmer.
// When the tile is not minified (fwidth tiny) the taps collapse to one, so
// close-up detail is untouched.
float decodeMetersAA(vec2 uv) {
  vec2 o = fwidth(uv) * 0.5;
  return (decodeMeters(uv)
        + decodeMeters(uv + vec2(o.x, o.y))
        + decodeMeters(uv + vec2(-o.x, o.y))
        + decodeMeters(uv + vec2(o.x, -o.y))
        + decodeMeters(uv + vec2(-o.x, -o.y))) * 0.2;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ══════════ CE QUI EST PORTE DU SOCLE, ET RIEN N'EST REECRIT ────────────────
//
// ⚠️ MOT POUR MOT DEPUIS terrain.js. Une seconde ecriture de ces formules
// finirait par diverger de la premiere — terrain.js porte deja cette cicatrice
// (« Deux ecritures jumelles finiraient par diverger »), et le crop et le socle
// doivent rendre LA MEME IMAGE, pas une image ressemblante.

// mnHash / mnNoise — terrain.js:459. Le bruit de valeur du grain.
float mnHash(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mnHash(i), mnHash(i+vec2(1.0,0.0)), f.x), mix(mnHash(i+vec2(0.0,1.0)), mnHash(i+vec2(1.0,1.0)), f.x), f.y); }


// ⚠️ INJECTE, PAS RECOPIE — Tache P2. Ce meme texte entre dans le fragment de
// terrain.js. C'est la seule ecriture du peigne, de l'humidite, du pivot et du
// voile aerien ; les recopier ici aurait fait exactement les « deux ecritures
// jumelles » dont terrain.js porte la cicatrice.
${GLSL_NATUREL}
// ══════ LE REGIME DE RAMPE DU MONDE — Tache R28 ═══════════════════════════
//
// ⚠️ **APRES GLSL_NATUREL, ET C'EST UNE OBLIGATION** : natRampTMonde appelle
// natRampT. Le meme argument que la ligne « APRES GLSL_NATUREL, parce que
// fxBlend mode 10 appelle natSoftLight », plus bas.
${GLSL_REGIME_MONDE}

// ⚠️ INJECTE, PAS RECOPIE — Tache P3, et il vient APRES GLSL_NATUREL parce
// qu'il APPELLE natLuminance. La loi d'eclairage n'est pas maison : c'est celle
// de three.js (BRDF_Lambert, getHemisphereLightIrradiance) et de terrain.js
// (fxShade, la valeur par sommet). test/crop-eclairage.test.js va la relire
// dans node_modules/three plutot que de croire ce commentaire.
${GLSL_ECLAIRAGE}

// ══════ LA MATIERE DU RELIEF — Tache R25, option 38 ═══════════════════════
//
// ⛔ LES DOUZE UNIFORMES SONT ICI ET PAS DANS LE MODULE, ET UNE GARDE L A
// IMPOSE. La premiere ecriture les mettait dans GLSL_MATIERE ; « ②d ter » de
// test/crop-rampe.test.js a rougi (« uniformes lus mais jamais declares »)
// parce qu elle lit le texte BRUT du fragment, ou l injection n est pas encore
// substituee. Aucun des sept autres modules injectes ne declare d uniforme : la
// convention du depot est « un module porte des FONCTIONS, globe.js porte les
// declarations ». Affaiblir la garde pour y faire entrer mon ecriture aurait
// ete le contraire du travail.
//
// ⚠️ DEUX ECHANTILLONNEURS DE PLUS, ET LE COMPTE EST TENU : le fragment des
// tuiles en avait DIX (uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp,
// uAnalysis, uRampCrop, uAerial, uPhoto), il en a DOUZE. La machine en offre 16
// au minimum — c est exactement le plafond que terrain.js a deja touche (« le
// gabarit java passait de 17 a 18 unites, le terrain ne linkait plus et
// disparaissait »). La marge est de quatre.
uniform float uMatOn;          // 0 = aucune matiere : image du depot au bit pres
uniform sampler2D uMatMap;     // l albedo de la matiere (diff.jpg)
uniform sampler2D uMatNormal;  // sa carte de normales (nor_gl.jpg)
uniform float uMatNormalOn;    // 0 = pas de carte de normales
uniform float uMatRepeat;      // repetitions par LARGEUR DE BLOC — facteur 1
uniform float uMatBump;        // l amplitude de la normale (normalScale du socle)
uniform float uMatNoiseOn;
uniform float uMatNoiseCut;
uniform float uMatNoiseSoft;
uniform float uMatNoiseScale;
uniform float uMatAboveZero;
uniform float uMatBandeM;      // la demi-bande du niveau zero, EN METRES

// ⚠️ INJECTE, PAS RECOPIE — Tache R25, et il vient APRES GLSL_ECLAIRAGE parce
// que la matiere se pose dans albedoCropMat, la variante a ombre explicite que
// le module d eclairage porte desormais (albedoCrop la DELEGUE : une ecriture).
// Les deux lignes de bruit sont celles de terrain.js au caractere pres, et les
// trois conversions d unite sont ecrites avec leur facteur dans le module.
${GLSL_MATIERE}

// ⚠️ INJECTE, PAS RECOPIE — Tache P10. Le champ de hauteur pose sur le plan
// tangent : N = normalize(haut - gEst.est - gNord.nord). Elle REMPLACE la loi
// de Mikkelsen de P9, dont les derivees d'ecran rendaient la normale sensible a
// la parite des quads. La derivation, la mesure et le pourquoi sont ecrits dans
// src/monde/eclairage-crop.js, §6 de l'en-tete.
${GLSL_NORMALE_FINE}

// ⚠️ INJECTE, PAS RECOPIE — regle D15, Tache R6. La lampe de carte et la loi
// d'ombrage neutre-sur-sol-plat vivent dans monde/planete-eclairee.js, et
// test/planete-eclairee.test.js TRADUIT ce texte-ci pour l'executer contre les
// deux fonctions JS du module. Une seconde ecriture aurait diverge.
${GLSL_RELIEF_MONDE}

// ⚠️ INJECTE, PAS RECOPIE — Tache R21. Le terme direct de l'appoint, la pente
// du sol et le brun des versants vivent dans monde/lumiere-sphere.js, avec la
// table des conversions d'unite et leur facteur chiffre.
// test/lumiere-sphere.test.js TRADUIT ce texte-ci et l'EXECUTE contre les
// fonctions JS du module — il ne le cherche pas par son nom.
${GLSL_LUMIERE_SPHERE}

// ══════ LA HAUTEUR DU BLOC, ECRITE UNE FOIS — Tache P10 ════════════════════
//
// ⚠️ DEUX APPELANTS, UNE SEULE ECRITURE. main() la compose sur un decodage
// ANTIALIASE (cinq taps) ; le gradient de la normale fine la rappelle QUATRE
// fois, sur un decodage simple, aux voisins en espace UV. Recopier la loi du
// fond marin ou celle du grain dans le gradient aurait fait deux ecritures qui
// divergent -- la cicatrice que terrain.js documente deja.
//
// ⛔ ET IL EN FAUT DEUX, PAS UNE, PARCE QUE L'ORDRE DU DEPOT PASSE ENTRE LES
// DEUX : main() lit sousEau APRES le fond marin mais AVANT le grain. Les fondre
// en une seule fonction deplacerait ce test d'un cran, et la rampe changerait de
// branche sur les fragments ou le grain fait passer h de negatif a positif.
//
// ⚠️ ET LA BORNE DU CHAMP N'EST PAS DECORATIVE : au-dela de uFondPortee
// demi-cotes, une texture en ClampToEdge prolongerait sa derniere ligne sur
// toute la planete estompee sans qu'aucune erreur ne soit levee.
// ⚠️ LES DEUX PARAMETRES S'APPELLENT qCrop ET h, COMME AU POINT D'APPEL, ET
// C'EST DELIBERE : test/fond-crop.test.js EXTRAIT ce bloc de la source pour
// l'EXECUTER contre altitudeSonde. Les renommer ne casserait pas le nuanceur —
// il casserait la seule chose qui LIT ce nuanceur.
// ⚠️ LA CONDITION EST NOMMEE, ET ELLE L'EST PARCE QU'ELLE A DEUX LECTEURS
// DEPUIS LA TACHE P12 : la hauteur (juste dessous) et le PAS du gradient de la
// normale fine, qui ne peut pas avoir la meme largeur de bande selon que le
// fragment lit le MNT ou le champ cuit. La recopier aurait fait « deux
// ecritures jumelles qui divergent », la cicatrice que terrain.js documente.
//
// ⚡ ET ELLE EST STABLE PAR LA COMPOSITION, CE QUI PERMET DE L'APPELER APRES :
// quand elle est vraie, hauteurFond rend min(champ, 0), donc h <= 0, donc elle
// reste vraie ; quand elle est fausse parce que h > 0, hauteurFond ne touche
// pas h, donc elle reste fausse. test/fond-crop.test.js le rejoue EN
// L'EXECUTANT sur le bloc extrait de cette source.
bool surLeFond(vec2 qCrop, float h) {
  return uFondOn > 0.5 && uCropOn > 0.5
      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0;
}
float hauteurFond(vec2 qCrop, float h) {
  if (surLeFond(qCrop, h)) {
    h = min(texture2D(uFondChamp, qCrop / (2.0 * uFondPortee) + 0.5).r * uFondMetres, 0.0);
  }
  return h;
}
// ⚠️ INDEXE SUR LE CROP, JAMAIS SUR vUv NI SUR L'ECRAN, et il ne mord que sur
// la TERRE (h > 0) comme le landFactor du socle : les raisons sont ecrites au
// point d'appel, dans main().
float hauteurGrain(vec2 qCrop, float h) {
  if (uGrainForceM > 0.0 && h > 0.0) {
    vec2 gp = qCrop * uGrainEchelle;
    float g1 = mnNoise(gp);
    float g2 = mnNoise(gp * 2.17 + vec2(19.3, -7.1));
    h += uGrainForceM * ((g1 - 0.5) * 2.0 + (g2 - 0.5) * 0.7);
  }
  return h;
}
// La MEME hauteur qu'au point courant, prise ailleurs. ⚠️ decodeMeters ET PAS
// decodeMetersAA : le lissage de l'AA vaut cinq taps, donc VINGT pour les
// quatre lectures du gradient ; et il est deja porte par le PAS, qui couvre une
// empreinte de pixel entiere.
float hauteurEchant(vec2 uv, vec2 q) {
  float hh = hauteurFond(q, decodeMeters(uv));
  return uHabOn > 0.5 ? hauteurGrain(q, hh) : hh;
}

// ══════ LA COUCHE APPARENCE — Tache P3, et le gabarit d'ouverture l'ALLUME ══
//
// ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
// public/templates/defaults/shibustart.json pose look.surfaceFx = 9. Releve
// dans l'application vivante : uSurfaceFx = 9, uFxOpacity = 0,44,
// uFxBlend = 2 (Multiply), uFxColA = #14161d. Mesure : socle rendu avec un
// albedo force a BLANC sous un hemisphere blanc d'irradiance 1 (le pixel
// devrait valoir 1/PI) — couche allumee 0,591 / 0,575 / 0,571, couche eteinte
// 0,997 / 0,997 / 0,997. ELLE MULTIPLIE L'ALBEDO DU SOCLE PAR 0,59.
//
// ⚠️ FX_GLSL EST DEJA UN MODULE PARTAGE (src/fx-glsl.js), et son en-tete dit
// pourquoi : fx-thumbs.js en avait fait une copie a la main, et « une copie est
// un menteur silencieux ». Le troisieme lecteur passe donc par la meme porte.
// Il ne declare aucun uniforme : il LIT uFxScale, uFxTime, uFxColA/B/C,
// uFxP1/P2/P3, que son hote doit declarer.
${FX_GLSL}
// ⚠️ APRES GLSL_NATUREL, parce que fxBlend mode 10 appelle natSoftLight.
${GLSL_MELANGE}

// solEn / lavisSol — terrain.js. ⚠️ uSol NE TRANSPORTE PAS UNE IMAGE : chaque
// octet EST un code de classe ESA WorldCover (10 arbres, 30 prairie, 80 eau).
// Entre 10 et 80 il n'y a pas 45, il n'y a RIEN — et tout, dans une chaine
// graphique, est fait pour interpoler. Les trois precautions du socle sont donc
// portees telles quelles : le +0,5 avant le floor (un octet valant 40 peut
// ressortir a 39,997 en precision moyenne), la visee du CENTRE du texel de la
// table, et la conversion sRVB vers lineaire a la main (la table est choisie a
// l'oeil donc ecrite en sRVB, et elle doit rester en NoColorSpace sous peine que
// ce soit le CODE, dans l'autre texture, qui se fasse convertir).
vec4 solEn(vec2 p) {
  float code = floor(texture2D(uSol, p).r * 255.0 + 0.5);
  vec4 e = texture2D(uSolLut, vec2((code + 0.5) / 256.0, 0.5));
  vec3 lin = mix(e.rgb / 12.92, pow((e.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), e.rgb));
  return vec4(lin, e.a);
}
// Le melange des quatre voisins se fait sur la COULEUR deja decodee, jamais sur
// le code : c'est la meme famille de defaut que le terrarium interpole, qui a
// coute +128 m la ou il fallait lire -0,5 m.
vec4 lavisSol(vec2 uv) {
  vec2 tc = uv / uSolTexel - 0.5;
  vec2 f = fract(tc);
  vec2 b = (floor(tc) + 0.5) * uSolTexel;
  vec4 c00 = solEn(b);
  vec4 c10 = solEn(b + vec2(uSolTexel.x, 0.0));
  vec4 c01 = solEn(b + vec2(0.0, uSolTexel.y));
  vec4 c11 = solEn(b + uSolTexel);
  c00.rgb *= c00.a; c10.rgb *= c10.a; c01.rgb *= c01.a; c11.rgb *= c11.a;
  vec4 s = mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
  return vec4(s.rgb / max(s.a, 1e-4), s.a);
}

void main() {
  // La couverture du crop : 1 partout ailleurs, donc la production est
  // rigoureusement intouchée (uCropOn vaut 0 et ce bloc ne s'exécute pas).
  float couvertureCrop = 1.0;

  // ⚠️ qCrop EST HISSE HORS DU BLOC DE DECOUPE, ET C'EST OBLIGATOIRE : tout
  // l'habillage se lit en coordonnees LOCALES DU CROP (masque de cote,
  // occupation du sol, grain), et ces coordonnees sont calculees par la decoupe.
  // Les recalculer plus bas aurait pose une seconde ecriture de la projection de
  // Mercator, avec son ecretage et son repli d'antimeridien — deux ecritures qui
  // divergent, la cicatrice que terrain.js documente deja.
  vec2 qCrop = vec2(0.0);

  // ⚠️ HISSE POUR LA MEME RAISON QUE qCrop, ET C'EST L'ECLAIRAGE QUI L'EXIGE
  // (Tache P3). dedans est la couverture douce de la SUPERELLIPSE du crop — la
  // silhouette du bloc, au pixel pres, celle que les parois suivent. C'est
  // exactement la frontiere ou l'eclairage doit passer de la loi de PLANETE
  // (un terminateur jour/nuit, un soleil qui suit la camera) a la loi du SOCLE
  // (un vrai soleil, un hemisphere, une ambiante).
  //
  // ⛔ ET CE N'EST PAS LE CARRE dansCrop QUE L'ANALYSE EMPLOIE. Le carre est la
  // borne de la TEXTURE d'analyse ; la silhouette du bloc est la superellipse.
  // Les confondre poserait une arete d'eclairage droite dans les coins arrondis
  // du bloc, la ou il n'y a deja plus de bloc.
  //
  // ⚠️ ZERO PAR DEFAUT : hors decoupe (uCropOn = 0) il n'y a pas de bloc, donc
  // pas de socle a imiter, donc la planete garde sa loi.
  float dedansCrop = 0.0;

  // ══════ LA DÉCOUPE, AVANT TOUT LE RESTE ══════════════════════════════════
  //
  // ⚠️ EN PREMIER, ET C'EST UNE ÉCONOMIE, PAS UN STYLE : un fragment coupé ne
  // paie ni les cinq décodages de decodeMetersAA, ni la rampe, ni les contours.
  // Le discard posé en fin de main les aurait tous payés d'avance.
  //
  // ⚠️ ET LE TEST SE FAIT EN LAT/LON, PAS EN COORDONNÉES DE SCÈNE. Les sommets
  // du globe sont en RTC (_buildMesh : positions relatives au centre de LEUR
  // tuile) — une tuile chevauche la frontière, donc position n'a pas le même
  // sens d'une tuile à l'autre. vLatLon est absolu, et il était déjà là pour le
  // graticule.
  if (uCropOn > 0.5) {
    float mx = (vLatLon.y + 180.0) / 360.0;
    // écrêtage de Mercator : sans lui un pôle rend un infini, donc un NaN, donc
    // une comparaison FAUSSE, donc un fragment GARDÉ — le contraire du but.
    float la = clamp(vLatLon.x, -85.05112878, 85.05112878) * 0.017453292519943295;
    float my = 0.5 - log(tan(0.78539816339744831 + la * 0.5)) / 6.2831853071795865;
    float du = mx - uCropCentre.x;
    du -= floor(du + 0.5); // antiméridien : le mercator x est de période 1
    vec2 q = vec2(du, my - uCropCentre.y) / uCropDemi; // local au crop, dans [-1, 1]
    qCrop = q;
    // la superellipse du socle, transcrite de terrain.js : les côtés droits
    // restent exacts (une composante est nulle), seuls les coins sont formés.
    vec2 eq = abs(q) - (1.0 - uCropCoin);
    vec2 cq = max(eq, 0.0);
    float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
    // ⛔ ET LE TERME INTERIEUR, SANS LEQUEL LE BLOC EST DU VERRE — Tache K ter.
    // pn est ECRETE A ZERO dans tout le rectangle interieur, donc d y valait la
    // CONSTANTE -uCropCoin, donc fwidth(d) y valait ZERO ; et uCropCoin vaut 0
    // en production (poserCrop a corner = 0 pour defaut, et le branchement ne
    // lui en passe pas). Le smoothstep etait alors evalue AU MILIEU EXACT de son
    // intervalle et rendait 0,5 : TOUTE LA SURFACE DU CROP etait dessinee a
    // couverture 0,5. Releve le 2026-08-22 dans l application vivante.
    // min(max(eq.x, eq.y), 0.0) vaut ZERO des qu une composante est positive,
    // c est-a-dire sur toute la frontiere, dans les coins et dans tout le
    // dehors : la loi y est celle d avant AU BIT PRES. La demonstration et le
    // pourquoi-pas-transparent sont en tete de src/monde/crop-sphere.js
    // (distanceCrop), qui est la SEULE ecriture de cette loi.
    float dInterieur = min(max(eq.x, eq.y), 0.0);

    // ══════ LA COUVERTURE DOUCE — Tâche B, Étape 5 ════════════════════════
    //
    // (Aucun accent GRAVE dans ce bloc : il vit dans un template literal JS et
    // le terminerait — le piège que terrain.js et ocean.js documentent tous les
    // deux, et que le bloc du dessus rappelle déjà.)
    //
    // ⚠️ MESURÉ, PAS JUGÉ À L OEIL : gl.getContextAttributes().antialias vaut
    // false sur ce contexte. Un discard donne une frontière BINAIRE, donc les
    // coins du crop créneleraient, et personne ne les lisserait derrière.
    //
    // On garde donc EXACTEMENT la même courbe — pn, la superellipse de
    // dansDalle, celle que les parois de parois-crop.js suivent au bit près — et
    // on remplace le verdict binaire par une COUVERTURE : la distance signée à
    // la frontière, fondue sur un pixel d écran.
    //
    // ⚠️ LA LARGEUR SE MESURE, ELLE NE SE POSE PAS. fwidth(d) rend la variation
    // de d entre deux pixels voisins : c est UN PIXEL, exprimé en unités de
    // crop. Une constante n aurait été juste qu à une seule altitude, et
    // l amplitude se dérive du dépôt : le crop naît en occupant 60 % de la
    // HAUTEUR d image (seuil-socle.js, §2) et couvre 9,7 fois cette hauteur à la
    // station 2 km (10 377 m de large contre 2 x 2 000 x tan 15° = 1 072 m de
    // sol visible, fov 30° — la ligne "fov: 30" des reglages de main.js, et NON
    // main.js:263, qui parle du maillage du bloc central ; c est de plus un
    // DEFAUT, un template peut poser 33). Soit un facteur SEIZE sur la même
    // frontière, sans compter les crops continentaux du §8.
    //
    // ⚠️ ET LE discard RESTE AU-DELÀ D UN PIXEL. Sans lui, chaque fragment de la
    // tuile paierait le mélange : on veut le fondu SUR LE BORD, pas sur tout le
    // reste de la tuile.
    float d = pn + dInterieur - uCropCoin; // > 0 = dehors, < 0 DEDANS
    float w = max(fwidth(d), 1e-12); // un pixel, en unites de crop
    float dedans = 1.0 - smoothstep(-0.5 * w, 0.5 * w, d);
    dedansCrop = dedans; // Tache P3 — la frontiere de l'eclairage, voir la declaration

    // ══════ L'ESTOMPAGE — Tache G ══════════════════════════════════════════
    //
    // ⚠️ ETEINT, CETTE LIGNE REND 1.0, DONC couvertureCrop VAUT dedans : c'est
    // la Tache A au bit pres, et smoothstep sature EXACTEMENT a 0 des que
    // d >= 0.5 w, donc le discard ci-dessous coupe le meme ensemble de
    // fragments que le « if (d > 0.5 * w) discard » qu'il remplace. Le seul
    // ecart est le fragment ou d vaut exactement 0.5 w : il etait garde avec
    // une couverture nulle, il est desormais coupe. Invisible, et moins cher.
    float estompeTuile = uEstompageOn > 0.5 ? uEstompage : 1.0;

    // HORS du crop l'opacite vaut 1 - estompage ; DEDANS elle reste 1, quelle
    // que soit l'altitude — le crop ne s'estompe jamais, c'est le sujet.
    float couvertureTuile = mix(1.0, dedans, estompeTuile);
    couvertureCrop = couvertureTuile;

    // ⚠️ LE discard RESTE, ET IL RESTE ICI. A estompage plein il economise tout
    // le corps du nuanceur sur les tuiles du dehors, exactement comme avant. En
    // cours de fondu il ne coupe plus rien : c'est le prix de dessiner la Terre
    // autour, et c'est le sujet meme de la tache.
    if (couvertureCrop <= 0.0) discard;
  }

  // ⚠️ L'APPEL EST hauteurFond, PAS LE CORPS : la MEME loi sert au gradient de
  // la normale fine, quatre fragments plus bas (Tache P10).
  float h = hauteurFond(qCrop, decodeMetersAA(vUv));
  // ⚠️ RELEVE ICI, ET PAS PLUS BAS : le grain (quelques lignes plus loin) ajoute
  // un bruit SIGNE a la hauteur, donc une butte de terre a un metre au-dessus de
  // l'eau peut en ressortir NEGATIVE. Le pas du gradient basculerait alors sur
  // la loi du fond marin en pleine terre, une tuile sur deux et sans rien dire.
  bool fondMarin = surLeFond(qCrop, h);

  // ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
  //
  // ⚠️ AVANT L'HABILLAGE, ET POUR LA MEME RAISON QUE LE GRAIN EST AVANT LA RAMPE
  // (voir le bloc suivant) : ce qui change h doit passer avant tout ce qui LIT h
  // — la rampe, les courbes de niveau, et le test sousEau qui les commande.
  //
  // ⚠️ C'EST LA TRANSCRIPTION DE altitudeSonde (src/monde/fond-crop.js), PAS UNE
  // SECONDE LOI : la mer prend min(fond, 0), la terre garde la tuile. Le CPU
  // (posAt, hauteurSurface) et le GPU lisent le meme tableau par la meme
  // formule d'uv, et test/fond-crop.test.js confronte les deux ecritures.
  //
  // ⚠️ ET LA BORNE N'EST PAS DECORATIVE. Le champ ne couvre que uFondPortee
  // demi-cotes ; au-dela, une texture en ClampToEdge prolongerait sa derniere
  // ligne sur toute la planete estompee, sans qu'aucune erreur ne soit levee.
  // C'est le meme garde que echantillonnerFond, ecrit deux fois parce que le
  // GPU ne sait pas rendre null. Le corps est hauteurFond, ci-dessus.

  // ══════ L'HABILLAGE, POSTES ③ ET ② — Tache C ═══════════════════════════════
  //
  // ⚠️ AVANT LA RAMPE ET AVANT LES COURBES, ET CE N'EST PAS UN RANGEMENT : le
  // grain modifie h, donc la rampe ET les courbes doivent le voir. C'est ce que
  // fait le socle, qui cuit son grain dans la GEOMETRIE : sa couleur et ses
  // courbes le portent parce qu'elles lisent vWorldPos.y. Pose apres, le grain
  // ne serait qu'un bruit de teinte, et les courbes resteraient lisses.
  float landness = 1.0;
  // ══════ h == 0 NE PREND PLUS LA BRANCHE TERRE — Tache K bis ══════════════
  //
  // ⚠️ uMerZeroSousEau A 0 : RIEN NE CHANGE. Meme garde et meme raison que
  // uCropOn, uHabOn, uMerRampeOn et uMppFacteur — la vue orbitale en production
  // rend exactement ce qu'elle rendait, au bit pres, tant que poserRampe n'a pas
  // recu zeroSousEau.
  //
  // ⚠️ ET LE DEFAUT REPARE EST MESURE, PAS SUPPOSE. h == 0 est la surface de la
  // mer, c'est-a-dire la valeur la PLUS FREQUENTE du globe. Avec h < 0.0 elle
  // prend la branche TERRE, donc t = 0,35 exactement, donc uRamp au texel 179 —
  // LA PREMIERE TEINTE DE TERRE. Releve dans l'application vivante, palette du
  // jour : rgb(147, 160, 116), un olive vert. Et la mer d'a cote, a h = -1 m,
  // prend la rampe NAUTIQUE (uMerRampeOn = 1) sur uOceanShallow, un bleu pale.
  // Un metre d'ecart, deux familles de couleur : c'est le grand aplat vert
  // qu'Adrien voit au nadir.
  bool sousEau = uMerZeroSousEau > 0.5 ? h <= 0.0 : h < 0.0;
  if (uHabOn > 0.5) {
    // ③ LE GRAIN. ⚠️ INDEXE SUR LE CROP, JAMAIS SUR vUv NI SUR L'ECRAN. vUv est
    // local a la TUILE : lu la, le grain se repeterait a chaque tuile — seize
    // grains au lieu d'un. Et evalue en coordonnees d'ecran il resterait COLLE
    // A L'ECRAN pendant que le relief defile, le moirage qu'Adrien a attrape a
    // l'oeil (terrain.js, etude 5.4).
    //
    // ⚠️ ET IL NE MORD QUE SUR LA TERRE (h > 0), comme le landFactor du socle :
    // sans cela le fond marin se couvrirait d'une rugosite que la bathymetrie ne
    // porte pas, et les courbes bathymetriques se mettraient a onduler.
    h = hauteurGrain(qCrop, h);
    // ② LE MASQUE DE COTE. La lecture tombe au MEME TEXEL que celle du socle —
    // la demonstration est en tete de src/monde/habillage-crop.js, et
    // test/crop-habillage.test.js la rejoue contre latLonToWorld du depot.
    //
    // ⚠️ LE MASQUE DECIDE, LA HAUTEUR NE FAIT QUE L'EMPECHER DE MENTIR. C'est le
    // correctif v42 de terrain.js : la rampe ocean se peignait sur des montagnes
    // quand le masque etait faux. Et uMargeCoteM est le 0,02 UNITE du socle
    // CONVERTI en metres — le recopier tel quel aurait donne deux centimetres.
    if (uCoastMaskOn > 0.5) {
      vec2 cmUv = qCrop * 0.5 + 0.5;
      landness = texture2D(uCoastMask, cmUv).r;
      sousEau = landness < 0.5 && h < uMargeCoteM;
    }
  }

  // hypsometric ramp: bathymetry occupies [0, 0.35], land [0.35, 1]
  // ⚠️ sousEau VAUT h < 0.0 QUAND L'HABILLAGE EST ETEINT : la production est
  // intouchee au bit pres, et une mutation qui eteint le masque doit rendre
  // exactement l'image d'avant, sinon elle ne prouve rien.
  // ⚠️ DEUX ANCRES POUR LA TERRE, PAS UNE. « La rampe s'etale sur l'AMPLITUDE
  // locale » (Etape 1 de la tache) : l'amplitude, c'est max - min. Ne caler que
  // le haut laisserait le fond de vallee d'un crop alpin a 8 % de la rampe au
  // lieu de 0. Le socle pose bien les deux (uHeightRange, terrain.js:2084).
  //
  // ⚠️ ET LE PARTAGE MER / TERRE A 0,35 NE BOUGE PAS : c'est lui qui garantit
  // qu'un littoral reste un littoral d'un crop a l'autre.
  //
  // ⚠️ AUX VALEURS PAR DEFAUT (uLandBas = 0, uPlancherRampeM = 0), ces deux
  // lignes rendent EXACTEMENT h / uLandMax et -h / uOceanDepth : max(5600-0, 0)
  // vaut 5600, max(6000, 0) vaut 6000, et h - 0.0 vaut h. La production est
  // intouchee au bit pres, et test/crop-rampe.test.js le prouve par un Object.is
  // sur 2 001 hauteurs.
  // ⚠️ hNorm EST NOMME, PAS DUPLIQUE — Tache P2. Il etait deja calcule, en
  // toutes lettres, dans la branche TERRE de float t ; la colorisation naturelle
  // en a besoin quatre fois de plus (pivot, limite des arbres, voile aerien).
  // L'ecrire une seconde fois plus bas aurait donne deux amplitudes locales a
  // garder d'accord. La branche terre le REUTILISE : 0.35 + 0.65 * hNorm est
  // l'expression du depot au bit pres, et test/crop-rampe.test.js l'evalue.
  float hNorm = clamp((h - uLandBas) / max(uLandMax - uLandBas, uPlancherRampeM), 0.0, 1.0);
  float t = sousEau
    ? 0.35 * (1.0 - clamp(-h / max(uOceanDepth, uPlancherRampeM), 0.0, 1.0))
    : 0.35 + 0.65 * hNorm;
  vec3 col = texture2D(uRamp, vec2(t, 0.5)).rgb;

  // ══════ LA TERRE PREND LA TABLE ET LA LOI DE RAMPE DU SOCLE — Tache P2 ═════
  //
  // ⚠️ CE N'EST PAS UNE SECONDE PALETTE : uRampCrop EST l'objet uRampTex du
  // socle. La table 2D porte deja rampDry, rampWet et l'interpolation Oklab du
  // mode Naturel — trois reglages qui arrivent donc sur la sphere sans un seul
  // uniforme de plus, et sans qu'aucune couleur ne soit recalculee ici.
  //
  // ⚠️ ET LES DEUX CURSEURS QUE rampe-crop.js NE LISAIT PAS SONT ICI :
  // uHeightContrast et uHeightPivot. Le gabarit d'ouverture pose 1,5 et 0,6 ;
  // « realistic » pose 5,1 et 0,53. Aux defauts (1 et 0,5) natRampT rend hNorm
  // AU BIT PRES, donc uRampCropOn a 0 n'est pas la seule garde : la loi elle-meme
  // est neutre. Le pivot ne peut jamais descendre sous le niveau de la mer, qui
  // sur le globe est h = 0, donc hNorm = (0 - uLandBas) / amplitude.
  //
  // ⚠️ LES ALENTOURS SUIVENT, exactement comme uLandBas / uLandMax (decision 4
  // d'Adrien) : ces uniformes vivent dans this.uniforms, que _materialFor etale
  // dans chaque materiau de tuile. Hors du crop l'analyse rend son neutre (voir
  // plus bas), donc la ligne mediane du LUT, donc la rampe historique.
  // ⛔ ET hNorm N'EST PAS LE MEME DES DEUX COTES — MESURE, PAS SUPPOSE.
  //
  // Le socle normalise sur uHeightRange, qui est l'amplitude COMPLETE de son
  // MNT, FOND MARIN COMPRIS (dem.minM / dem.maxM). Releve dans l'application
  // vivante, La Reunion z12 : uHeightRange couvre -2 116 a 2 626 m, donc le
  // NIVEAU DE LA MER y tombe a hNorm = 0,4466 — pas a zero. Le hNorm de la
  // Tache D, lui, part de uLandBas (le minimum de la TERRE), donc la mer y est a
  // zero : c'est le bon choix pour float t, ou la mer a son propre segment
  // [0 ; 0,35], et le MAUVAIS pour uHeightPivot et uTreeLine, qui sont des
  // reglages d'utilisateur exprimes dans l'echelle du socle.
  //
  // ⛔ CE QUE CA DONNAIT, CHIFFRE : avec pivot 0,65 et contraste 2,5 (les valeurs
  // vivantes), natRampT rendait ZERO pour TOUT ce qui est sous 1 163 m — un aplat
  // olive sur toute l'ile — la ou le socle etale deja 0 a 0,78 sur la meme
  // tranche. La limite des arbres tombait a 2 378 m au lieu de 2 247 m.
  //
  // ➡️ LA CONVERSION EST EXACTE, ET ELLE NE DEMANDE AUCUNE MESURE NEUVE : le
  // minimum du relief du crop EST -uOceanDepth (rampe-crop.js : profondeur =
  // -min(0, minM)) et son maximum uLandMax. Releve le meme jour : -2 106,8 et
  // 2 584,4 contre -2 116 et 2 626 cote socle, soit un ecart de 0,0029 sur le
  // hNorm du niveau de la mer. C'est la MEME grandeur, mesuree par deux
  // balayages de finesse differente.
  float hNormRelief = clamp((h - uReliefBas) / max(uLandMax - uReliefBas, uPlancherRampeM), 0.0, 1.0);

  vec4 anl = vec4(0.5);
  if (uAnalysisOn > 0.5) {
    // ⛔ LA BORNE N'EST PAS DECORATIVE, ET C'EST LE MEME PIEGE QUE uFondChamp.
    // La texture d'analyse est cuite pour le CROP ; en ClampToEdge, sa derniere
    // ligne se prolongerait sur toute la planete estompee et peignerait les
    // Andes avec le peigne de La Reunion, sans qu'aucune erreur ne soit levee.
    // On fond donc vers le NEUTRE (0,5) hors du crop, ce qui est exactement
    // « pas d'analyse ici » — et sans branche dependante de la donnee, dont les
    // derivees de mipmap seraient indefinies.
    float dansCrop = step(max(abs(qCrop.x), abs(qCrop.y)), 1.0);
    anl = mix(vec4(0.5), texture2D(uAnalysis, qCrop * 0.5 + 0.5), dansCrop);
  }
  if (uRampCropOn > 0.5 && !sousEau) {
    // ⚠️ hNormRelief PARTOUT DANS CE BLOC, ET JAMAIS hNorm : uHeightPivot,
    // uTreeLine et uHazeAlt sont des reglages POSES PAR L'UTILISATEUR dans
    // l'echelle du socle, et l'echelle du socle porte le fond marin. Voir la
    // demonstration chiffree juste au-dessus.
    float pivot = max(uHeightPivot, natPlancherPivot((0.0 - uReliefBas) / max(uLandMax - uReliefBas, uPlancherRampeM)));
    float rampT = natRampT(hNormRelief, pivot, uHeightContrast);
    // ══════ ⛔ LA BANDE VERTE DES COTES — Tache R28 ════════════════════════
    //
    // > Adrien, 2026-09-01 : « Pourquoi y a-t-il une zone verte tout autour des
    // > cotes ? »
    //
    // ⛔ LES QUATRE UNIFORMES DE LA LIGNE AU-DESSUS SONT MESURES SUR LE CROP ET
    // PARTAGES PAR LES 1 700 MATERIAUX DE TUILE. La planete entiere prenait donc
    // l'echelle d'une ile. RELEVE dans l'application vivante, La Reunion z12
    // (diag-r28-bande.mjs) : uReliefBas 107,5 · uLandMax 3 009,6 · pivot 0,41 ·
    // contraste 2,2 — donc natRampT SATURE A ZERO pour TOUTE terre de 0 a
    // 637,8 m, c'est-a-dire le PREMIER texel du LUT, rgb(147, 160, 115),
    // #93a074, la premiere butee de la palette : un olive vert. La bande.
    //
    // ⚡ ET LE DEPARTAGE EST dedansCrop, PAS UN SECOND SEUIL. C'est la couverture
    // douce de la superellipse que les parois, l'albedo et l'eclairage suivent
    // deja : le fondu est celui du bord du bloc, donc il n'y a aucune couture a
    // inventer. La decision 4 d'Adrien (« la rampe se calcule sur le crop, et
    // les ALENTOURS la suivent ») parle de l'emprise voisine d'une affiche —
    // jamais de la planete ; c'est ce que rampe-crop.js §⑤ ecrit deja.
    //
    // ⚠️ ON MELANGE L'INDICE, PAS LA COULEUR : les deux regimes lisent la MEME
    // table, rampT y est continu, et un seul echantillonnage suffit. Melanger
    // deux couleurs aurait coute une seconde lecture de texture par fragment.
    // ══════ ⚡ LE RECOLLAGE DES DEUX ECHELLES — Tache R31 ═══════════════
    //
    // > Adrien, 2026-09-01 : « Il doit y avoir un lien entre ce que l'on voit
    // > en crop et ce que l'on voit a grande echelle. »
    //
    // ⛔ LES COULEURS SUIVAIENT DEJA LE GABARIT — c'est L'ECHELLE D'ALTITUDE
    // qui ne suivait pas. Les deux lignes ci-dessus lisent la MEME table
    // uRampCrop ; elles n'en different que par l'INDICE. Mesure du 2026-09-01
    // (diag-r31-ecart.mjs), meme point du sol, meme table : DeltaE 18,0 au
    // rivage, 25,4 a 300 m, 38,5 a 800 m a La Reunion ; 35,8 et 52,4 a Borneo.
    // Le seuil de perception vaut 2,3. Ce n'etait donc pas un ecart de nuance.
    //
    // ⚡ ET LE MELANGE EST MONOTONE PAR CONSTRUCTION : avant ecretage les deux
    // indices sont AFFINES en h, donc leur melange l'est aussi. La courbe reste
    // croissante pour tout poids — seules sa pente et son origine changent.
    // C'est ce qui interdit une marche, et c'est pourquoi on melange l'INDICE
    // et non deux couleurs : une seule lecture de texture, aucune inversion.
    //
    // ⚠️ natRampTMonde(h) ETAIT DEJA CALCULE pour la ligne de dessous : le prix
    // de ce bloc est UN mix, c'est-a-dire deux ALU. Nomme, il n'est plus evalue
    // deux fois.
    float rampTMonde = natRampTMonde(h);
    rampT = mix(rampT, rampTMonde, uRecollage);
    rampT = mix(rampTMonde, rampT, dedansCrop);
    float wetY = natHumiditeY(anl.b, anl.a, hNormRelief, uWetK, uExpoK, uHemi, uTreeLine);
    col = texture2D(uRampCrop, vec2(rampT, wetY)).rgb;
  }

  // ══════ LE PEIGNE DES CRETES — LA DEMANDE D'ADRIEN, ET RIEN D'AUTRE ════════
  //
  // « Plus aucune texture sur la terre. » C'est CE bloc qui manquait. Le socle le
  // pose depuis terrain.js ; il vit desormais dans naturel-crop.js et les deux
  // nuanceurs l'appellent. uTexShade vaut 1 dans le gabarit d'ouverture.
  //
  // ⚠️ TERRE SEULE, comme dans le socle : la branche sous-marine de terrain.js
  // ne voit jamais ce bloc. Le poser sur le fond marin peignerait des cretes
  // dans une bathymetrie qui n'en porte pas.
  if (uAnalysisOn > 0.5 && uTexShade > 0.001 && !sousEau) {
    col = natPeigne(col, anl.r, anl.g, uTexShade);
  }

  // ══════ LA PERSPECTIVE AERIENNE (Imhof) — Tache P2 ═════════════════════════
  //
  // ⚠️ fd EST length(qCrop), ET C'EST LA MEME GRANDEUR QUE CELLE DU SOCLE, PAS
  // UNE APPROXIMATION : terrain.js divise par uSlabHalf = 28 une distance en
  // unites de scene, et l'en-tete de habillage-crop.js DEMONTRE x = 28 * u. Le
  // quotient est donc qCrop, terme a terme.
  // ══════ ⛔ ET IL NE SORT PAS DE LA DECOUPE — Tache R28 ═══════════════════
  //
  // fd est une distance au CENTRE DU CROP en demi-cotes de crop : hors de
  // l'emprise elle vaut plus de 1, donc le clamp la fige a 1 et le voile
  // s'applique A PLEINE DISTANCE sur toute la planete. retirerHabillage le dit
  // deja pour le crop MORT (« le voile ne suit pas, et ce n'est pas un oubli :
  // il peindrait un degrade centre sur un lieu qu'on a quitte ») ; le meme
  // argument vaut pour le crop VIVANT, et personne ne l'avait tire.
  //
  // ⚡ MESURE, Borneo z10, temoin nul a 0 pixel (diag-r28-fuites.mjs) : eteindre
  // uHazeAmt change 509 975 pixels, 49,80 % de l'image, d'un ecart moyen de
  // 20,54/255 — et l'ecart-type de luminance MONTE de 32,66 a 35,21. Le voile
  // ne faisait pas que teinter : il APLATISSAIT les alentours. C'est la moitie
  // de l'« aplat vert olive uniforme, sans relief » de la capture 2.
  float hazeIci = uHazeAmt * dedansCrop;
  if (uRampCropOn > 0.5 && uHazeAmt > 0.001 && !sousEau) {
    float fd = clamp(length(qCrop), 0.0, 1.0);
    float veil = natVoile(hNormRelief, fd, hazeIci, uHazeAlt, uHazeDist);
    col = natBrume(col, natLuminance(col), veil, uHazeColor, hazeIci);
  }

  // ══════ LE FOND MARIN PREND LA RAMPE NAUTIQUE DU SOCLE ════════════════════
  //
  // Transcription EXACTE de terrain.js:1019-1023 — meme exposant 0,55, meme
  // coude a 0,45, memes trois couleurs. La seule difference est l'unite : le
  // socle mesure sa profondeur en unites de scene (uSeaY - y sur uSeaRange), le
  // globe en METRES BRUTS (-h sur uOceanDepth, que poserRampe cale deja sur la
  // profondeur mesuree du crop). Le rapport est le meme, donc la couleur aussi.
  //
  // ⚠️ ET LE PLANCHER EST CELUI DE LA TACHE D, PAS UN NOUVEAU : uPlancherRampeM.
  // En poser un second aurait donne deux gardes de division qui divergent.
  if (uMerRampeOn > 0.5 && sousEau) {
    // ══════ ⛔ L'EAU GARDE LE RENDU DE L'ORBITE AU LOIN — Tache R28 ═══════
    //
    // > Adrien, 2026-09-01 : « excepte l'eau, qu'on simule au-dessus de Z10
    // > comme tu le fais avec la vue orbitale. »
    //
    // ⛔ uMerFondBudgetM EST LE BUDGET DU CROP, ET IL EST PARTAGE PAR TOUTES LES
    // TUILES. Releve a Borneo z10 : 113,3 m. Toute la planete peignait donc son
    // ocean sur 113 metres de profondeur — c'est-a-dire que TOUT ce qui depasse
    // le plateau continental saturait sur uOceanDeep, d'un seul aplat. C'est le
    // « sans bathymetrie » de la capture 2, et c'est exactement l'inverse de la
    // capture 4, ou Adrien montre l'eau qu'il veut garder.
    //
    // ⚡ MESURE, Borneo z10, temoin nul a 0 pixel : rendre a la mer le budget du
    // monde change 371 592 pixels, 36,29 % de l'image, d'un ecart moyen de
    // 24,77/255 — le plus gros ecart moyen des six postes du banc.
    //
    // ⚠️ ON MELANGE LA PROFONDEUR NORMALISEE, PAS LA COULEUR NI LE BUDGET : un
    // seul pow par fragment (il n'y en avait qu'un avant), et la couleur reste
    // lue une seule fois. Melanger le BUDGET aurait mis un mix a l'interieur
    // d'une division, donc un profil non monotone au bord du crop.
    float dMerCrop = clamp(-h / max(uMerFondBudgetM, uPlancherRampeM), 0.0, 1.0);
    float dMerMonde = clamp(-h / MONDE_PROFONDEUR, 0.0, 1.0);
    float dMer01 = pow(mix(dMerMonde, dMerCrop, dedansCrop), 0.55);
    col = dMer01 < 0.45
      ? mix(uOceanShallow, uOceanMid, dMer01 / 0.45)
      : mix(uOceanMid, uOceanDeep, (dMer01 - 0.45) / 0.55);
  }

  // ══════ POSTE ④ — L'OCCUPATION DU SOL ══════════════════════════════════════
  //
  // ⚠️ ELLE MODULE LA COULEUR, ELLE N'EN POSE PAS UNE (terrain.js) : blSetLum
  // prend la TEINTE de la classe et lui impose une LUMINANCE tiree de la rampe,
  // ce qui laisse l'ombrage, les courbes et la rampe se lire a travers.
  //
  // ⚠️ ET L'UV EST L'AUTRE, CELUI QUI RETOURNE Y. Les champs cuits (masque de
  // cote) se lisent en xz direct ; les couches en tuiles Web Mercator, elles,
  // ont leurs lignes nord vers sud — c'est uvSolDrape, et lui seul, qui retourne.
  // Confondre les deux pose la foret a l'envers, et rien ne leve d'erreur.
  if (uHabOn > 0.5 && uSolOn > 0.5 && uSolOpacite > 0.001) {
    vec2 sUv = vec2(qCrop.x * 0.5 + 0.5, 1.0 - (qCrop.y * 0.5 + 0.5));
    sUv = uSolOffset + sUv * uSolScale;
    vec4 lavis = lavisSol(sUv);
    // ⚠️ LE PLAFOND A 1 N'EST PAS DECORATIF : la tirette « Force » monte a 2, et
    // mix() au-dela de 1 EXTRAPOLE — il fabriquerait des verts fluorescents sur
    // les forets denses, exactement l'atlas scolaire qu'on refuse.
    // ══════ ⛔ ET ELLE NE SORT PAS DE LA DECOUPE — Tache R28 ═══════════════
    //
    // sUv est bati sur qCrop : hors de l'emprise il depasse [0 ; 1], et la
    // mosaique est en ClampToEdge — sa derniere ligne se prolongerait donc sur
    // toute la planete estompee, sans qu'aucune erreur ne soit levee. C'est mot
    // pour mot le piege que uFondChamp et uAnalysis documentent deja, et D15
    // range uSol parmi ce qui NE PEUT PAS devenir global pour cette raison.
    //
    // ⚠️ NON MESURE A L'ECRAN, ET C'EST DIT : le gabarit d'ouverture pose
    // solOn = 0, donc ce bloc ne s'execute pas dans l'etat livre. C'est une
    // garde de coherence D15, pas la correction d'un defaut observe.
    float k = min(1.0, lavis.a * uSolOpacite) * dedansCrop;
    if (k > 0.001) {
      col = mix(col, blSetLum(lavis.rgb, mix(blLum(col), blLum(lavis.rgb), 0.55)), k);
    }
  }

  // ══════ LE BLOC DEVIENT UN ALBEDO — Tache P3 ══════════════════════
  //
  // > L'agent noteur, 2026-08-22 : « Le socle est un materiau ECLAIRE. La tuile
  // > du globe est une COULEUR NUE. »
  //
  // ⛔ ET LA CONVERSION SE FAIT ICI, PAS A LA FIN, PARCE QUE C'EST ICI QUE
  // terrain.js LA FAIT. Sa ligne 1146 melange la peinture dans diffuseColor
  // AVANT l'apparence, le trait de cote, les courbes et le graticule : tous ces
  // postes peignent donc sur un ALBEDO. Poser le melange APRES eux — ce que la
  // premiere version de cette tache faisait — fait passer le motif de
  // l'apparence une seconde fois dans mix(fond, x, teinte), et le motif ressort
  // delave. MESURE : l'apparence assombrit l'albedo du socle a 0,58 et celui du
  // crop a 0,73 seulement, pour un motif pourtant CALE au meme endroit du sol
  // (vues P3-MOTIF-SOCLE.png et P3-MOTIF-CROP.png : memes points, meme phase).
  //
  // ⚠️ partBloc VAUT ZERO SANS ECLAIRAGE, et alors rien de tout ce qui suit ne
  // s'applique : la production est intouchee au bit pres.
  vec3 nMonde = normalize(vNormalW);
  // ⚠️ 1.0 PAR DEFAUT, ET IL N'EST ECRIT QUE SOUS DEUX GARDES (Tache R6) : la
  // planete nue multiplie donc sa couleur par un, c'est-a-dire par rien.
  float ombreRelief = 1.0;
  // ══════ ⚡ LES DEUX CANAUX DU PEIGNE DU MONDE — Tache R28 ═════════════════
  //
  // ⚠️ (0,5 ; 0,5) EST LE NEUTRE EXACT, PAS UN A-PEU-PRES : natEcartPeigne(0,5)
  // rend 0,5, et natSoftLight(c, 0,5) rend c AU BIT PRES — step(0.5, 0.5) vaut
  // 1, donc la branche prise est b + 0 x (d - b). Sans normale fine, le peigne
  // du monde ne peut donc rien peindre, et ce n'est pas une garde de plus :
  // c'est la valeur elle-meme.
  vec2 peigneMondeRG = vec2(0.5);
  // ══════ LA NORMALE PAR FRAGMENT — Tache P9 ═══════════════════════════════
  //
  // ⛔ CE QUI MANQUAIT N'ETAIT PAS DU DETAIL DE PEINTURE, C'ETAIT DE L'OMBRAGE.
  // Mesure, cadrage interieur, masques apparies a -0,155 % : lumiere coupee des
  // deux cotes, le crop rend 10,250 d'energie de detail contre 8,723 au socle —
  // sa COULEUR est deja PLUS riche. Allumes, il rend 10,972 contre 16,086 : la
  // lumiere fabrique 45,8 % du modele du socle et 6,6 % du sien.
  //
  // ⚠️ ET LA CAUSE EST ARITHMETIQUE, PAS ESTHETIQUE : vNormalW vient de
  // _buildMesh, qui pose segmentsTuile(z) = 24 quads par tuile — 5 625 sommets sur un
  // bloc de 3 x 3 tuiles, contre 594 434 au socle (releve). La texture de
  // hauteur, elle, fait 256 x 256 par tuile et le fragment la lit DEJA
  // (decodeMetersAA, quelques lignes plus haut) : la couleur voyait le relief
  // fin, la lumiere ne le voyait pas.
  //
  // ⚠️ h EST DEJA LE BON h : le fond marin (Tache J bis) et le grain (Tache C)
  // l'ont modifie au-dessus, et c'est la surface REELLE qu'on veut deriver.
  //
  // ⚠️ ET LA BASE EST LA SPHERE NUE, JAMAIS vNormalW : ce dernier PORTE deja la
  // pente de la grille, et le perturber par le gradient COMPLET de h compterait
  // deux fois la composante grossiere. vHautW EST cette sphere nue, posee par le
  // nuanceur de sommets depuis l'attribut latlon.
  //
  // ⛔ ET LE GRADIENT EST PRIS EN ESPACE TEXTURE, PLUS EN ESPACE ECRAN — Tache
  // P10. La loi de P9 lisait dFdx(h) / dFdy(h) : une difference finie sur le
  // VOISIN D'ECRAN, donc sur un voisin qui CHANGE avec la parite du quad 2 x 2.
  // Mesure du noteur (notation-03 §4, .banc/vues-notation-03/N3-mouvement) : un
  // decalage de camera d'UN pixel laissait 10,872 octets de residu contre 0,030
  // au socle, et 38,49 % des pixels de surface bougeaient de plus de 8 octets.
  // Aux decalages PAIRS, qui conservent la parite, le residu retombait a 0,800.
  if (uNormaleFineOn > 0.5) {
    // ⚠️ RE-ORTHONORMALISE : l'interpolation lineaire de deux vecteurs unitaires
    // n'en rend pas un unitaire, et sur une tuile de bas niveau (z2 couvre 90
    // degres) l'ecart n'est pas negligeable.
    vec3 haut = normalize(vHautW);
    vec3 est = vEstW - haut * dot(haut, vEstW);
    est = normalize(est);
    vec3 nord = cross(haut, est);

    // ⚠️ LA MONNAIE, ET C'EST LE POINT OU CE CHANTIER A DEJA PAYE QUATRE FOIS.
    // Une unite d'uv couvre 1 / 2^z de tour de Mercator, donc uUvParMonde x le
    // tour de la sphere x cos(latitude) METRES DE SOL. Mercator est conforme :
    // la meme longueur vaut pour u et pour v.
    float cosLat = max(cos(radians(vLatLon.x)), 1e-4);
    float metresParUv = ${TOUR_SPHERE_M} * uUvParMonde * cosLat;
    float uniteParUv = metresParUv * ${UNITES_PAR_METRE_SOL};

    // ⚠️ LE PAS NE VIENT D'AUCUNE DERIVEE D'ECRAN, SINON LA PARITE RENTRERAIT
    // PAR LA FENETRE. mppEcran = vProfCam x uMppFacteur est la grandeur de la
    // Tache K : les metres de sol par pixel, fonction de la seule DISTANCE.
    // Sans elle (uMppFacteur = 0, la production), le pas retombe au texel.
    float pasEmpreinte = uMppFacteur > 0.0
      ? vProfCam * uMppFacteur / metresParUv
      : 0.0;

    // ══════ ⛔ ET L'EMPREINTE NE S'APPLIQUE PAS AU FOND MARIN — Tache P12 ═══
    //
    // L'ARGUMENT DE P10 EST UN ARGUMENT SUR LE MNT, ET RIEN D'AUTRE : « la
    // texture de hauteur est MINIFIEE au cadrage de la notation, une difference
    // centree a un texel echantillonnerait plus fin que ce que l'ecran peut
    // porter ». Vrai — pour une hauteur lue dans le MNT.
    //
    // ⛔ SOUS L'EAU, LA HAUTEUR NE VIENT PAS DU MNT. hauteurFond l'ECRASE par le
    // champ cuit, qui porte 385 noeuds sur 2 x uFondPortee demi-cotes de crop :
    // a La Reunion z12, une maille de 213 m, soit SIX texels de MNT. Ce champ-la
    // est MAGNIFIE, pas minifie : il n'a aucun detail sous le pixel, donc il n'y
    // a rien a filtrer, et l'empreinte ne fait que perdre de la pente.
    //
    // ⚡ MESURE, EN BOUGEANT LE PAS DANS LES DEUX SENS (.banc/P12/e1-pas-mer.js
    // et e2-pas-mer-pavage.js, aller-retour a 0 canal, temoin a 218 000 -
    // 295 000 canaux), grain du fond marin en % du socle au cadrage cote :
    //   pas x2      66,5 %   pas livre  72,5 %   pas x0,5  77,7 %   un texel  85,1 %
    // et la frange cotiere en marches, part des suites de 4 px et plus :
    //   pas livre  13,61 %   un texel  9,22 %   (socle 7,00 %)
    //
    // ⚠️ ET LE PRIX EST DECLARE : le pavage rectangulaire de la nappe, que le
    // noteur mesure pour la premiere fois, DOUBLE (pic normalise 0,0685 ->
    // 0,1345 ; socle 0,0339). Ce que le pas resserre rend n'est pas du relief :
    // c'est la FACETTE de la bilineaire du champ. Le vrai correctif de ce
    // poste-la est la RESOLUTION du champ (CHAMP_FOND), et il coute neuf fois
    // remplirHauteurs — le rapport P12 le chiffre et ne le paie pas.
    //
    // ⚠️ LE RELIEF, LUI, NE BOUGE PAS D'UN PIXEL : la bascule ne prend que sur
    // les fragments dont la hauteur vient du champ. Et le scintillement que P10
    // a ferme ne revient a AUCUN pas — mesure au balayage complet, residu a
    // dx = 1 entre 0,793 et 0,841 pour un pas de x0 a x2 (socle 0,030), aucune
    // signature de parite : la loi de P10 est invariante par construction, ce
    // n'est pas son pas qui la tenait.
    // ⚠️ ET qCrop SUIT L'UV, PARCE QUE hauteurEchant LIT LES DEUX. uv.x va vers
    // l'EST (mercator x croissant) ; uv.y va vers le NORD, donc vers un mercator
    // y DECROISSANT — c'est le « 1 - v » de _buildMesh. Le signe moins est ce
    // retournement, et lui seul.
    //
    // ⚠️ IL EST CALCULE AVANT LE PAS DEPUIS LA TACHE R17 : le pas du fond marin
    // est exprime dans l'unite de qCrop (la cellule du champ), et il faut cette
    // monnaie-la pour le ramener en UV.
    float qParUv = uUvParMonde / max(uCropDemi, 1e-9);

    // ══════ ⚡ ET SOUS L'EAU, LE PAS EST CELUI DU CHAMP — Tache R17 ═════════
    //
    // ⛔ P12 A EU RAISON DE SORTIR LE FOND DE L'EMPREINTE, ET S'EST ARRETEE UN
    // CRAN TROP TOT. Son argument est le bon : « ce champ-la est MAGNIFIE, pas
    // minifie : il n'a aucun detail sous le pixel, donc il n'y a rien a
    // filtrer ». Mais elle a repose le pas sur le TEXEL DU MNT, qui n'est pas la
    // maille du champ — il en est le SIXIEME.
    //
    // ⚠️ LA CONVERSION, ECRITE, ET C'EST LA CLASSE DE DEFAUT LA PLUS FREQUENTE
    // DE CE CHANTIER : une maille de champ vaut 2 x uFondPortee / CHAMP_FOND
    // demi-cotes de crop, soit 6/384 = 0,015625 ; un texel de MNT vaut
    // qParUv / uTilePx demi-cotes, soit 0,6667/256 = 0,0026042. **Le rapport
    // vaut 6,0** — le nuanceur derivait donc une bilineaire au SIXIEME de sa
    // cellule, ce qui ne peut rendre qu'une chose : la FACETTE de la bilineaire,
    // constante a l'interieur de chaque cellule et cassee a chaque bord. C'est
    // le « fond marbre de plaques sombres » que la relecture de R5 a vu, et la
    // periodicite mesuree au banc R17 le nomme : pic a 4 px pour une cellule de
    // champ mesuree a 3,24 px, avec ses harmoniques a 6 et 10.
    //
    // ⚡ ET LE SOCLE NE FAIT PAS AUTREMENT : ses normales sont celles de
    // computeVertexNormals sur SA grille (771 sommets, 35,58 m), c'est-a-dire
    // une derivee prise A LA MAILLE, jamais a l'interieur d'une cellule. C'est
    // le meme defaut, et le meme remede, que loadBathyPatch documente deja
    // pour le socle : « agrandir une tuile z8 par drawImage se faisait en
    // bilineaire, dont la pente casse a chaque bord de cellule ».
    //
    // ⚠️ max ET NON UN CHOIX : un champ plus fin que le texel du MNT (personne
    // ne le pose aujourd'hui) doit retomber sur le texel, jamais descendre
    // au-dessous — c'est le plancher de P10, et il ne bouge pas.
    float pasChamp = uFondPasQ / max(qParUv, 1e-9);
    float pas = fondMarin
      ? max(1.0 / uTilePx, pasChamp)
      : max(1.0 / uTilePx, pasEmpreinte);
    vec2 dqU = vec2(qParUv * pas, 0.0);
    vec2 dqV = vec2(0.0, -qParUv * pas);
    // ⚠️ LES QUATRE ECHANTILLONS SONT NOMMES, PLUS SOUSTRAITS A LA VOLEE — Tache
    // R28. Ce n'est pas un rangement : le peigne du monde a besoin de leur
    // SOMME autant que de leurs differences, et les nommer est ce qui lui evite
    // de les relire. Les deux differences ci-dessous sont celles du depot,
    // terme a terme.
    float hUp = hauteurEchant(vUv + vec2(pas, 0.0), qCrop + dqU);
    float hUm = hauteurEchant(vUv - vec2(pas, 0.0), qCrop - dqU);
    float hVp = hauteurEchant(vUv + vec2(0.0, pas), qCrop + dqV);
    float hVm = hauteurEchant(vUv - vec2(0.0, pas), qCrop - dqV);
    float dhU = hUp - hUm;
    float dhV = hVp - hVm;

    // la pente de sol : une denivelee en unites de scene par une distance en
    // unites de scene. Le 2 x pas du denominateur est celui de la difference
    // CENTREE, et uUnitesParMetre porte l'exageration -- pas uniteParUv.
    float k = uUnitesParMetre / (2.0 * pas * uniteParUv);
    nMonde = normaleParGradientSol(dhU * k, dhV * k, est, nord, haut);

    // ══════ ⚡ LE PEIGNE DES CRETES, SUR TOUTE LA TERRE — Tache R28 ═════════
    //
    // > Adrien, 2026-09-01 : « Je veux que ce soit le style qui est utilise en
    // > dessous de Z10 qui habille toute la Terre. »
    //
    // ⛔ uAnalysis EST CUITE SUR L'EMPRISE DU CROP, et D15 l'exclut du global
    // pour cette raison exacte. Mais D15 nomme aussi le peigne parmi ce qui PEUT
    // le devenir : « se calcule depuis cette meme texture de hauteur ». C'est ce
    // que fait ce bloc, et il ne coute presque rien.
    //
    // ⚡ LE PRIX, COMPTE AVANT D'ETRE PAYE : la normale lit DEJA les quatre
    // voisins. Un laplacien discret demande les memes quatre plus le CENTRE,
    // soit UNE lecture de texture de plus — pas cinq. Et le centre se relit,
    // il ne se reprend pas a h : h passe par decodeMetersAA, un lissage a cinq
    // taps, alors que hauteurEchant lit decodeMeters. Prendre h aurait
    // compare un centre LISSE a des voisins BRUTS, c'est-a-dire mesure le
    // lissage plutot que le relief — un laplacien qui aurait toujours du signe.
    //
    // ⚠️ LE SIGNE : POSITIF SUR UNE CRETE. Le laplacien discret est
    // Somme(voisins) - 4 x centre, positif dans un TALWEG ; le canal du socle
    // (terrain-analysis.js, texShade) est positif sur une croupe CONVEXE. D'ou
    // 4 x centre - Somme.
    //
    // ⚠️ ET C'EST LE MEME k QUE LA PENTE : la courbure sort donc en ECART DE
    // PENTE, sans dimension — independante du niveau de tuile, de la latitude
    // et de l'exageration. Un laplacien laisse en metres aurait change de force
    // a chaque frontiere de niveau de tuile.
    float hCentre = hauteurEchant(vUv, qCrop);
    float courbure = (4.0 * hCentre - hUp - hUm - hVp - hVm) * k;
    // ⚠️ LA MEME LAMPE QUE L'OMBRAGE DE RELIEF, HISSEE — pas une seconde. Deux
    // lampes a tenir d'accord, c'est la faute que ce fichier a payee sur
    // uContourInterval.
    vec3 lampe = lampeReliefMonde(est, nord, haut, uReliefMondeAz, uReliefMondeEl);
    // ⚠️ LES DEUX CANAUX, MEME LOI : la courbure pour le peigne (canal R du
    // socle), l ecart d eclairement pour l ombrage (canal G). natPeigneMonde est
    // SCALAIRE — le traducteur du test ne connait ni vec2 ni ses constructeurs.
    float ecartOmbre = clamp(dot(nMonde, lampe), 0.0, 1.0) - clamp(dot(haut, lampe), 0.0, 1.0);
    peigneMondeRG = vec2(
      natPeigneMonde(courbure, ${GAIN_PEIGNE_MONDE.toFixed(2)}),
      natPeigneMonde(ecartOmbre, ${GAIN_OMBRE_MONDE.toFixed(2)})
    );

    // ══════ ⚡ L'OMBRAGE DE RELIEF DE LA PLANETE — regle D15, Tache R6 ══════
    //
    // ⛔ LA NORMALE FINE SEULE NE SE LIT PAS, ET C'EST MESURE EN APPARIE : elle
    // apporte de -1,7 % a +5,6 % d'ecart-type de luminance la ou D15 entier en
    // apporte de +36,5 % a +83,1 % — un rapport de dix a vingt. Le detail des
    // quatre paliers, ses planchers de bruit et le protocole sont dans
    // src/monde/planete-eclairee.js ; les traces dans traces-R6/triple-*.json.
    // ⚠️ Le « 14,053 contre 14,089 » du premier tour est RETIRE : il renvoyait a
    // un fichier inexistant et comparait deux sessions. La cause, elle, est
    // ecrite plus bas, au bloc « LE BLOC EST UN MATERIAU ECLAIRE » : la loi de
    // planete est col x (0,74 + 0,30 x diff), un rapport de 1,4:1, et uSunDir
    // suit la CAMERA — donc au nadir il eclaire de face.
    //
    // ⚠️ LA LAMPE EST DANS LE REPERE LOCAL, ET c'est le seul choix qui ait un
    // sens sur une sphere : une direction fixe en repere MONDE laisserait un
    // hemisphere entier eclaire par-dessous. est / nord / haut sont deja la,
    // orthonormalises, quatre lignes plus haut.
    //
    // ⚠️ ET LA LOI EST NEUTRE SUR SOL PLAT : 1 + gain x (n.L - haut.L) rend 1
    // quand la normale fine vaut la sphere, donc la planete ne change ni de
    // luminosite moyenne ni de teinte. Seule sa MODULATION apparait — et la
    // couture avec le bloc reste invisible.
    // ⚠️ « EXACTEMENT 1 » EST VRAI DE LA LOI, PAS D'ICI : sur sol plat
    // normaleParGradientSol rend haut / length(haut), soit haut a ~1 ulp, donc
    // le facteur s'ecarte de 1 d'environ 1e-7 x gain. Invisible sur huit bits,
    // mais ce n'est pas « au bit pres » — c'est la garde ci-dessous qui l'est.
    //
    // ⚠️ uReliefMondeGain A 0 : RIEN NE CHANGE, ombreRelief vaut 1.0 et
    // colPlanete est celle du depot au bit pres. C'est la meme garde que
    // uCropOn / uHabOn / uMerZeroSousEau, et elle est DOUBLE : sans la normale
    // fine ce bloc n'est meme pas atteint.
    if (uReliefMondeGain > 0.0) {
      // ⚠️ lampe EST CELLE DU BLOC AU-DESSUS — Tache R28. Elle y a ete hissee
      // parce que le peigne du monde la lit aussi ; la valeur est la meme, terme
      // a terme, et test/planete-eclairee.test.js execute toujours la loi.
      ombreRelief = ombrageReliefMonde(nMonde, haut, lampe, uReliefMondeGain);
    }

    // ══════ ⚡ L'OMBRAGE DES PENTES — Tache R21, option 30 ══════════════════
    //
    // ⛔ « AUCUN COTE GLOBE », disait l'inventaire, et naturel-crop.js avait
    // DECLARE ce poste laisse : « les tuiles du globe ne portent que vNormalW,
    // la normale de la SPHERE ». C'etait vrai a l'ecriture ; nMonde, la normale
    // PAR FRAGMENT, existe depuis la Tache P9 et D15 l'allume partout — c'est
    // pour ca que ce bloc est ICI, dans le seul endroit ou elle est calculee.
    //
    // ⚠️ dot(nMonde, haut) ET NON nMonde.y, ET LE CHIFFRE EST DANS LE MODULE :
    // a La Reunion (lat -21,26°) haut n'a que 0,3625 de composante Y, donc un
    // nMonde.y recopie du socle aurait declare 63,7° de pente sur un sol plat.
    // La verticale du socle est +Y parce que le bloc est plat ; sur une sphere
    // elle change a chaque fragment. Meme grandeur — un cosinus, sans
    // dimension —, facteur 1, mais pas le meme vecteur.
    //
    // ⚠️ TERRE SEULE, comme le peigne juste au-dessus et comme la branche du
    // socle : terrain.js pose ce mix dans le else de la branche TERRE.
    //
    // ⚠️ ET LE MODE EST DECIDE PAR L'APPELANT, PAS ICI. contexteCrop transmet
    // ZERO en mode Atlas (il lit uColorMode, l'uniforme meme que setColorMode
    // ecrit) : sans ca, la fenetre de ~464 ms pendant laquelle l'analyse cuit —
    // uAnalysisOn encore a 0 en mode Atlas — aurait fait clignoter le brun.
    if (uSlopeTint > 0.0 && !sousEau) {
      col = teintePente(col, penteSol(nMonde, haut), uSlopeTint);
    }
  }

  // ══════ ⚡ LE PEIGNE DU MONDE SE POSE — Tache R28 ═════════════════════════
  //
  // ⛔ ICI ET PAS PLUS HAUT, PARCE QUE LA NORMALE PAR FRAGMENT N'EXISTE QU'ICI.
  // Le peigne du CROP, lui, reste a sa place (juste apres la rampe), ou le socle
  // le pose — et il ne bouge pas d'une ligne.
  //
  // ⚠️ ET L'ORDRE EST LE MEME POUR LE MONDE, PAS SEULEMENT « ACCEPTABLE » : sur
  // un fragment HORS DECOUPE, rien entre la rampe et ce point ne touche a col.
  // Les trois postes intermediaires sont le voile aerien (desormais borne au
  // crop, quelques lignes plus haut), le fond marin (sousEau seul, et ce bloc-ci
  // est terre seule) et l'occupation du sol (bornee au crop, meme tache). La
  // couleur qui entre ici est donc, hors decoupe, celle qui sortait de la rampe
  // — le meme point du pipeline, atteint autrement.
  //
  // ⚠️ (1.0 - partAnalyse) : LA OU L'ANALYSE CUITE EXISTE, C'EST ELLE QUI PEINT.
  // Le laplacien fractionnaire du socle est meilleur que le laplacien d'ordre 2
  // d'ici, et il est deja paye. Les deux ne s'additionnent donc jamais : le crop
  // prend le sien, le monde prend celui-ci, et dedansCrop fond les deux sur la
  // silhouette du bloc — la meme frontiere que la rampe, l'albedo et les parois.
  //
  // ⚠️ TERRE SEULE ET NORMALE FINE OBLIGATOIRE : sans elle peigneMondeRG vaut
  // son neutre (0,5 ; 0,5) et natPeigne rend col au bit pres, donc la garde est
  // dans la valeur autant que dans le test.
  float partAnalyse = uAnalysisOn > 0.5 ? dedansCrop : 0.0;
  if (uNormaleFineOn > 0.5 && uTexShade > 0.001 && !sousEau) {
    col = natPeigne(col, peigneMondeRG.x, peigneMondeRG.y, uTexShade * (1.0 - partAnalyse));
  }
  // ══════ LA MATIERE DU RELIEF — Tache R25, option 38 ══════════════════════
  //
  // ⛔ QUINZE VIGNETTES RENDAIENT LA MEME IMAGE. Mesure du 2026-09-01, La
  // Reunion, pleine resolution, les dix-sept CLIQUEES une par une : chaque
  // matiere opaque s ecarte de « Aucune » de 3,29 a 3,57, et des QUATORZE
  // AUTRES de 0,025 a 0,338 — pour un plancher de bruit du banc a 0,231. Tout
  // ce qui traversait etait m.color mis a BLANC et uTint mis a ZERO : la
  // peinture hypsometrique retiree, et rien mis a la place.
  //
  // ⚡ ET LE FACTEUR QUI MANQUAIT EST UN SEUL. terrain.js ecrit
  // mix(diffuseColor.rgb, mapCol * paintShade, effTint) ou diffuseColor.rgb
  // contient DEJA material.map (three le multiplie dans map_fragment) ; ici
  // albedoCrop ecrit le meme mix avec uAlbedoBase a la place. Il ne manquait
  // que la TEXTURE. Ce n est pas une seconde loi, c est un produit.
  //
  // ⚠️ uMatOn A 0 : baseMat vaut uAlbedoBase, teinteMat vaut uAlbedoTeinte,
  // ombreMat vaut natOmbrePeinture(natLuminance(fondCrop)) et nMat vaut
  // nMonde — donc la ligne d origine AU BIT PRES, meme garde que uCropOn /
  // uHabOn / uEclairageOn / uNormaleFineOn.
  //
  // ⚠️ nMat SERT A L ECLAIRAGE, PAS A LA CARTE. La carte de normales de la
  // matiere doit modeler la LUMIERE (nduCrop, le terme soleil) ; la donner a
  // penteSol ou au peigne de cretes ferait croire au relief des bosses de
  // toile. C est pour ca qu elle est prise ICI, apres l ombrage des pentes.
  vec3 baseMat = uAlbedoBase;
  float teinteMat = uAlbedoTeinte;
  vec3 nMat = nMonde;
  float revele = 0.0;
  if (uMatOn > 0.5 && dedansCrop > 0.0) {
    vec2 uvMat = uvMatiere(qCrop);
    baseMat = uAlbedoBase * texture2D(uMatMap, uvMat).rgb;
    // ⚠️ vEstW ET NON est : est vit DANS le bloc uNormaleFineOn, il n est pas
    // en portee ici. normaleMatiere orthonormalise de toute facon sa tangente
    // sur nMonde (Gram-Schmidt), donc le varying brut suffit — et c est le SEUL
    // vecteur d est disponible quand la normale fine est eteinte.
    if (uMatNormalOn > 0.5) nMat = normaleMatiere(nMonde, vEstW, uvMat);
    // le bruit qui revele la carte dessous — champ en UNITES DE SCENE, la MEME
    // expression que la couche d apparence (facteur uFxDemiBloc = 28, sans quoi
    // les taches seraient vingt-huit fois trop grandes)
    if (uMatNoiseOn > 0.5) {
      float mn = mnNoise((qCrop * uFxDemiBloc + uFxFenetre) * uMatNoiseScale);
      revele = 1.0 - smoothstep(uMatNoiseCut - uMatNoiseSoft, uMatNoiseCut + uMatNoiseSoft, mn);
    }
    // « au-dessus du niveau zero » : sous la mer, la peinture repasse devant.
    // ⚠️ uMatBandeM EST EN METRES, et h aussi. Le socle ecrit 0,05 UNITE DE
    // SCENE ; a La Reunion, exageration 2, cela vaut 12,21 m. Recopier 0,05
    // aurait donne cinq centimetres de fondu, donc une marche franche.
    if (uMatAboveZero > 0.5) {
      revele = max(revele, 1.0 - smoothstep(-uMatBandeM, uMatBandeM, h));
    }
    teinteMat = mix(uAlbedoTeinte, 1.0, revele);
  }
  float nduCrop = dot(nMat, uHemiHaut);
  float grisCrop = natGris(hNormRelief, max(nduCrop, 0.0));
  float partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0;
  vec3 fondCrop = baseMat * grisCrop;
  if (partBloc > 0.0) {
    // ⚠️ L OMBRE DE PEINTURE EST TIREE VERS 1 LA OU LE BRUIT REVELE, comme
    // terrain.js : « la carte revelee est ramenee vers sa clarte naturelle, pas
    // ombree par l albedo de la matiere ». A revele = 0 c est natOmbrePeinture
    // du fond, donc l ancienne loi au bit pres.
    float ombreMat = mix(natOmbrePeinture(natLuminance(fondCrop)), 1.0, revele);
    col = mix(col, albedoCropMat(col, baseMat, grisCrop, teinteMat, ombreMat), partBloc);
  }

  // ══════ LA PHOTO AERIENNE — Tache R9 ══════════════════════════════════════
  //
  // ⚠️ ICI ET PAS AILLEURS, ET L'ORDRE EST LE MEME ARGUMENT QUE POUR
  // L'APPARENCE. terrain.js pose la photo APRES la peinture hypsometrique et
  // l'occupation du sol, et AVANT l'apparence, le trait de cote, les courbes et
  // le graticule : « the drawn cartography still sits on top of the photograph
  // rather than being buried by it. That ordering is most of what keeps this
  // from becoming a plain satellite viewer ». Le globe a la meme suite —
  // rampe → sol → albedo → [ICI] → apparence → cote → courbes → graticule →
  // lumiere — et test/crop-eclairage.test.js (⑤e) la verrouille.
  //
  // ⚠️ ELLE MODULE LA LUMINANCE, ELLE N'ECRASE PAS. Le facteur 0.6 + 0.8 x shade
  // est celui de terrain.js, sur la meme entree : la luminance Rec.601 de la
  // couleur DEJA peinte. C'est ce qui laisse l'ombrage et la rampe se lire A
  // TRAVERS la photo, et c'est la difference entre une carte en relief et un
  // visualiseur satellite.
  //
  // ⚠️⚠️ LE RETOURNEMENT EN Y N'EST PAS UN DETAIL, C'EST LA TACHE. La mosaique
  // aerienne est une CanvasTexture, dont flipY vaut TRUE (aerial-layer.js le dit
  // en toutes lettres : « aucune des deux couches ne l'eteint, contrairement a
  // tous les autres masques du projet qui posent tex.flipY = false »). En UV,
  // v = 0 est donc la DERNIERE ligne du canevas, celle du SUD. C'est pour ca que
  // uvSolDrape (terrain.js) finit par uv.y = 1.0 - uv.y, et pour ca que
  // aerialUvTransform mesure son offset vertical depuis le bord SUD de la
  // grille. Lire la photo en cmUv (l'UV des champs CUITS, flipY = false, comme
  // uCoastMask et uAnalysis) la poserait A L'ENVERS NORD-SUD, et aucun test de
  // cablage ne le verrait.
  //
  // ⚠️ ET CE N'EST PAS UNE LOI NEUVE : c'est uvDrapeCrop, la MEME que
  // l'occupation du sol emploie quelques dizaines de lignes plus haut (sUv), et
  // que test/crop-habillage.test.js (⑩h) evalue deja sur 441 points contre le
  // module pur. La photo aerienne et l'occupation du sol sont toutes deux des
  // mosaiques de tuiles Web Mercator drapees : meme famille, meme retournement.
  //
  // ⚠️ ET L'AFFINE PASSE APRES LE RETOURNEMENT, JAMAIS AVANT. Un retournement et
  // une affine NE COMMUTENT PAS — c'est le dossier complet d'aerialUvTransform,
  // ou l'inversion des deux valait jusqu'a 131 km sur les lumieres nocturnes.
  //
  // ⚠️ dedansCrop ET NON partBloc : la photo ne depend pas de l'eclairage. La
  // borner a partBloc l'eteindrait avec uEclairageOn, alors que c'est une couche
  // de CARTE. dedansCrop vaut zero hors decoupe, donc la planete est intouchee.
  // ══════ LA PHOTO SUR LA SURFACE DU GLOBE — Tache R16 ═══════════════════════
  //
  // ⛔ **HORS DE dedansCrop, ET C'EST TOUTE LA TACHE.** Le bloc juste en dessous
  // (uAerial, Tache R9) est enferme dans dedansCrop > 0.0, donc dans un crop qui
  // meurt au-dessus de 40,3 km : il ne pouvait pas montrer un continent, et il
  // ne le pouvait pas par arithmetique, pas par reglage. Celui-ci vit sur la
  // TUILE DE QUADTREE, donc partout ou la planete est dessinee, a toute
  // distance, et il ne charge que ce que _traverse a retenu ET dessine.
  //
  // ⚠️ (1.0 - dedansCrop) : LA SURFACE CEDE LA PLACE AU CROP. Dans l'emprise du
  // bloc, c'est l'orthophoto nationale de R9 qui doit peindre — 20 cm/px contre
  // 600 m/px. Les deux couches ne se recouvrent donc jamais, et la transition
  // suit exactement le fondu de bord du crop, qui est deja lisse.
  //
  // ⚠️ ELLE MODULE LA LUMINANCE, ELLE N'ECRASE PAS — meme facteur 0,6 + 0,8 x
  // shade que terrain.js et que le bloc R9 ci-dessous, sur la meme entree (la
  // luminance Rec.601 de la couleur DEJA peinte). C'est ce qui laisse l'ombrage
  // de relief se lire A TRAVERS la photo, et c'est la difference entre une carte
  // en relief et un visualiseur satellite.
  //
  // ⚠️ vUv ET NON qCrop : la photo est registree sur LA TUILE (uv 0..1 sur le
  // carreau Web Mercator), pas sur l'emprise du crop. uPhotoUv porte la
  // sous-fenetre de l'aieul quand la tuile est plus fine que l'imagerie
  // disponible. Le clamp garde la lecture dans le carreau : la jupe herite des
  // uv de son anneau de bord, donc elle est deja dedans, mais un demi-texel de
  // debordement se lirait sur la sous-fenetre VOISINE, pas sur du vide.
  if (uPhotoOn > 0.5 && uPhotoMonde > 0.001) {
    vec2 pUv = clamp(vUv, 0.0, 1.0) * uPhotoUv.zw + uPhotoUv.xy;
    vec3 photoSol = texture2D(uPhoto, pUv).rgb;
    float shadeP = dot(col, vec3(0.299, 0.587, 0.114));
    // ══════ LE FONDU COTIER DU MONDE — mesure du 2026-09-01 ══════════════════
    //
    // ⛔ **SANS LUI, L'OCEAN DEVIENT NOIR ET LA BATHYMETRIE DISPARAIT.** Capture
    // de l'etape 6, La Reunion a 600 km : l'ecran entier est noir. Blue Marble
    // rend l'ocean quasi noir ; multiplie par la luminance, il efface la rampe
    // nautique sur les deux tiers de la planete — c'est-a-dire l'identite meme
    // du produit. R9 avait mesure exactement la meme chose sur le crop (« 72,7 %
    // des pixels different, ecart moyen 93,6/255 »), et sa parade est celle-ci.
    //
    // ⚠️ **MEME LOI QUE LE BLOC R9 CI-DESSOUS, AVEC LE BUDGET DU MONDE.** Le
    // crop mesure sa bande sur uMerFondBudgetM (la profondeur de SON champ) ;
    // le monde n'a pas de champ, il a la rampe — donc uOceanDepth
    // (RAMPE_MONDE.profondeur). Meme smoothstep, meme sens : 1 au rivage, 0 au
    // fond. Ce n'est pas une seconde loi, c'est la premiere, relue une fois de
    // plus.
    //
    // ⚠️ ET LE PRIX EST DIT : une cuvette CONTINENTALE sous le niveau de la mer
    // perd une part de sa photo. Avec la bande livree (6 000 x 0,1 = 600 m), la
    // vallee de la Mort (-86 m) garde 93 % de la sienne et la Caspienne (-28 m)
    // 99 % ; la mer Morte (-430 m), elle, n'en garde que 13 %. Sur une imagerie
    // a 600 m/px, aucune de ces trois-la n'est un sujet — mais le chiffre est
    // ecrit plutot que decouvert.
    float pFade = 1.0;
    if (uPhotoFonduMer > 0.0) {
      float bandeMondeM = max(uOceanDepth * uPhotoFonduMer, 1e-4);
      pFade = smoothstep(-bandeMondeM, 0.0, h); // 1 au rivage → 0 au fond
    }
    col = mix(col, photoSol * (0.6 + 0.8 * shadeP), uPhotoMonde * (1.0 - dedansCrop) * pFade);
  }

  if (uAerialOn > 0.5 && uAerialOpacity > 0.001 && dedansCrop > 0.0) {
    vec2 aUv = vec2(qCrop.x * 0.5 + 0.5, 1.0 - (qCrop.y * 0.5 + 0.5));
    aUv = uAerialOffset + aUv * uAerialScale;
    vec3 aerien = texture2D(uAerial, aUv).rgb;
    float shadeA = dot(col, vec3(0.299, 0.587, 0.114));
    // ══════ LE FONDU COTIER — TOUR DE CORRECTION DE R9 ══════════════════════
    //
    // ⛔ SANS LUI, LA PHOTO COUVRE LA MER EN PLAQUES. Mesure de la relecture (La
    // Reunion z9, socle, fondu 0,1 contre 0) : 72,7 % des pixels different,
    // ecart moyen 93,6/255, max 189. Avec le fondu, la mer redevient la rampe
    // bathymetrique et les isobathes restent lisibles ; sans lui, tout vire au
    // bleu marine opaque et les isobathes s'enfoncent dedans. Sur le crop, les
    // coutures de tuiles se voient le long du rivage.
    //
    // ⚠️ TRANSCRIPTION DE terrain.js, A LA SEULE SUBSTITUTION D'UNITE QUE LE
    // BLOC DU FOND MARIN FAIT DEJA, QUARANTE LIGNES PLUS HAUT :
    //   uSeaY            → 0.0                (le niveau de la mer, en metres)
    //   uSeaY - y        → -h                 (la profondeur sous ce niveau)
    //   uSeaRange        → uMerFondBudgetM    (le budget de profondeur du crop)
    // Le socle ecrit smoothstep(uSeaY - band, uSeaY, y) ; le globe ecrit donc
    // smoothstep(-bandeM, 0.0, h). Un au rivage, zero au fond, dans les deux.
    //
    // ⚠️ ET LA GARDE EST uMerRampeOn, PAS UN SECOND uSeaY > -9000. Le socle
    // demande « ce bloc a-t-il de vraies donnees de mer » ; ici la reponse est
    // portee par poserMer, exactement comme au bloc du fond marin.
    //
    // ⛔⛔ ET IL FAUT UNE SECONDE GARDE, PARCE QUE LE NIVEAU DE LA MER DU GLOBE
    // EST ECRIT EN DUR A ZERO, ET QUE CELUI DU SOCLE NE L'EST PAS. terrain.js
    // pose uSeaY SOUS le terrain quand le bloc n'a pas de donnee sous-marine
    // (« then uSeaY simply sits below the terrain ») : son fondu rend donc 1
    // partout, par construction. Le globe, lui, mesure depuis h = 0 : dans une
    // cuvette SOUS le niveau de la mer — la vallee de la Mort a -86 m, la mer
    // Morte a -430 m, un polder a -7 m — il effacerait la photo d'une TERRE.
    //
    // ⚠️ LE TEMOIN EXISTE DEJA, ET C'EST LE BUDGET LUI-MEME. poserMer ecrit
    // Math.max(champ.profMaxCropM || champ.profMaxM, 1) — le repli « un crop
    // dont le champ n'aurait aucune eau a l'interieur rendrait sinon un budget
    // nul ». Un budget POSE AU PLANCHER veut donc dire « aucune profondeur
    // mesuree ici ». MESURE : Annecy z12, drapeau leve, uMerRampeOn = 1 et
    // uMerFondBudgetM = 1 — le crop continental prend bien le repli, et sans
    // cette garde sa bande de fondu vaudrait DIX CENTIMETRES.
    float aFade = 1.0;
    if (uAerialCoastFade > 0.0 && uMerRampeOn > 0.5 && uMerFondBudgetM > 1.0) {
      float bandeM = max(uMerFondBudgetM * uAerialCoastFade, 1e-4);
      aFade = smoothstep(-bandeM, 0.0, h); // 1 au rivage → 0 au fond
    }
    col = mix(col, aerien * (0.6 + 0.8 * shadeA), uAerialOpacity * dedansCrop * aFade);
  }

  // ══════ LA COUCHE APPARENCE — Tache P3, le gabarit d'ouverture l'ALLUME ════
  //
  // ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
  // public/templates/defaults/shibustart.json pose look.surfaceFx = 9.
  //
  // ⚠️ ICI ET PAS AILLEURS, ET L'ORDRE EST UN ARGUMENT. terrain.js la pose
  // APRES la peinture hypsometrique et l'occupation du sol, et AVANT le trait de
  // cote, les courbes et le graticule : « Materials sit BELOW the shaders, so a
  // shader shows on top of whatever the relief is wearing », et les traits de la
  // carte passent par-dessus tout. La poser apres les courbes les repeindrait ;
  // la poser avant le sol la ferait recouvrir par la foret.
  //
  // ⚠️ ET ELLE OPERE SUR L'ALBEDO, DONC AVANT L'ECLAIRAGE. C'est ce qui la rend
  // mesurable : socle albedo force a BLANC sous un hemisphere blanc d'irradiance
  // 1 — le pixel devrait valoir 1/PI ; couche allumee il vaut 0,591 / 0,575 /
  // 0,571, couche eteinte 0,997 / 0,997 / 0,997.
  //
  // ⚠️ fxShade EST LE MEME natOmbrePeinture QUE LA PEINTURE, ET SUR LA MEME
  // ENTREE : terrain.js multiplie surfaceFx par clamp(luma x 2,4 ; 0,2 ; 1,4) de
  // la luminance du FOND (params.color x la valeur par sommet). Lui donner autre
  // chose aurait fabrique une seconde loi.
  //
  // ⚠️ ELLE NE PEINT QUE LE BLOC (partBloc), ET C'EST LE MEME BORD QUE
  // L'ECLAIRAGE : la superellipse du crop. Etaler le motif du socle sur la
  // planete entiere autour aurait fait d'une matiere de bloc une matiere de
  // monde — et le socle, lui, s'arrete a son propre carre.
  if (uSurfaceFx > 0 && uFxOpacite > 0.001 && partBloc > 0.0) {
    vec2 champFx = qCrop * uFxDemiBloc + uFxFenetre;
    vec3 fxc = surfaceFx(uSurfaceFx, champFx * 0.15, uFxTime) * natOmbrePeinture(natLuminance(fondCrop));
    col = mix(col, fxBlend(col, fxc, uFxBlend), uFxOpacite * partBloc);
  }

  // ══════ POSTE ② (suite) — LE TRAIT DE COTE ═════════════════════════════════
  //
  // ⚠️ POSE AVANT LES COURBES, COMME DANS LE SOCLE. L'ordre est un argument :
  // une courbe de niveau doit passer PAR-DESSUS le trait de cote, sinon la
  // courbe zero disparait sous lui sur toute la longueur du littoral.
  //
  // ⚠️ fwidth(landness) EST LEGAL ICI parce que la garde est un UNIFORME : tous
  // les fragments d'un quad prennent la meme branche. Sous une garde qui
  // dependrait de la donnee, la derivee serait indefinie.
  if (uHabOn > 0.5 && uCoastMaskOn > 0.5) {
    float caa = max(fwidth(landness), 1e-4);
    float cote = 1.0 - smoothstep(0.0, caa * 1.5, abs(landness - 0.5));
    col = mix(col, uInk, cote * 0.55);
  }

  // contour lines with the terrain's crowd-fade so they only appear when
  // the tile resolution can actually carry them
  float ch = h / uContourInterval;
  float dch = fwidth(ch);
  // ══════ POSTE ① — LES COURBES PRENNENT LA LOI DE TRAIT DU SOCLE ═══════════
  //
  // ⚠️ TROIS CONSTANTES, ET ELLES DIFFERAIENT TOUTES LES TROIS. Le globe posait
  // 1.5 / 0.5 / 0.30, le socle pose 1.4 x uContourWeight / 0.55 / 0.22
  // (terrain.js, bloc « contour lines »). Un trait plus fin, un mineur plus
  // marque, et un evanouissement de foule plus tardif : c'est ce qui fait que
  // les courbes du socle se lisent la ou celles du globe s'effacent.
  //
  // ⚠️ ET LA VALEUR ETEINTE EST L'ANCIENNE, AU BIT PRES : uHabOn a 0 rend
  // exactement 1.5 / 0.5 / 0.30, donc la production est intouchee.
  //
  // ⚠️ L'INTERVALLE, LUI, NE SE DECIDE PAS ICI. Il arrive par uContourInterval,
  // que poserHabillage cale sur l'amplitude du crop (intervalleCourbes) : c'est
  // la ligne « echelle » du plan appliquee aux lignes. A l'ile Maurice, qui
  // culmine a 800 m, les 500 m codes en dur du globe ne tracent qu'UNE courbe.
  float poidsC = uHabOn > 0.5 ? 1.4 * uContourWeight : 1.5;
  float minorK = uHabOn > 0.5 ? 0.55 : 0.5;
  float crowdK = uHabOn > 0.5 ? 0.22 : 0.30;
  float minor = 1.0 - smoothstep(0.0, dch * poidsC, abs(fract(ch + 0.5) - 0.5));
  float ch5 = ch / 5.0;
  float major = 1.0 - smoothstep(0.0, fwidth(ch5) * poidsC, abs(fract(ch5 + 0.5) - 0.5));
  float crowd = clamp(1.0 - dch * crowdK, 0.0, 1.0);
  // MINIFICATION fade (Adrien : scintillement de la map en orbite) — the height
  // texture carries no mipmaps (they corrupt the packed metres), so when the
  // tile shrinks in the orbital/travel view the sampled height aliases and the
  // contour lines CRAWL. Fade them out as the tile minifies (texels per screen
  // pixel > ~1) so the far globe reads clean; they return in full up close.
  //
  // ══════ ET C'EST ICI QUE LA LOI QUITTE L'ESPACE-TUILE — Tache K ══════════
  //
  // ⛔ fwidth(vUv) EST LA DERIVEE D'UN UV LOCAL A LA TUILE, ET uTilePx VAUT 256
  // OU 512 SELON LA TUILE. Une tuile grossiere couvre plus de terrain pour
  // autant de texels, donc fwidth(vUv) est mecaniquement plus petit : minFade
  // peut valoir 1 d'un cote d'une frontiere de niveaux et 0 de l'autre — UNE
  // TUILE ENTIERE S'AFFICHE COMME UN CHAMP PLAT pendant que sa voisine garde ses
  // courbes. C'est l'arete droite qu'Adrien voit, et l'Etape 1 de la Tache K l'a
  // MESUREE : geler minFade change 23,5 % de l'image au nadir et 41,0 % en
  // isometrique, contre 0,05 % et 0,21 % pour crowd. C'est lui qui domine.
  //
  // ⚠️ ET DES SEPT fwidth DU NUANCEUR, C'EST LE SEUL QUI SOIT EN ESPACE-TUILE
  // DE BOUT EN BOUT : les six autres mesurent des metres, des degres ou une
  // couverture de cote, c'est-a-dire des grandeurs de MONDE par pixel d'ecran.
  // Le detail de l'audit est en tete de src/monde/loi-texture-monde.js.
  //
  // La grandeur de remplacement ne depend QUE de la distance camera : ni du
  // niveau de la tuile (donc plus d'arete), ni de l'inclinaison de la camera
  // (donc la meme loi en nadir et en isometrique — le critere de sortie).
  float mppEcran = vProfCam * uMppFacteur; // metres de sol par pixel d'ecran
  float texelTuile = max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx; // la loi du depot
  float texelMonde = mppEcran / max(uResRefM, 1e-6);
  float texel = uMppFacteur > 0.0 ? texelMonde : texelTuile;
  // ══════ ⛔ ET C'EST ICI QUE LES COURBES DU CROP MOURAIENT — Tache R19 ══════
  //
  // ⛔ **UNE GARDE JUSTE POUR LA PLANETE NUE, ET FAUSSE POUR LE BLOC.**
  // minFade eteint les courbes quand l'ecran ne resout plus la donnee. Sous le
  // crop, ce n'est pas une precaution : c'est une impossibilite de naissance.
  // Le crop MEURT au-dessus de 40,3 km, et des ~26 km la loi de monde rend deja
  // texel > 1,09 — donc minFade = 0 sur PRESQUE TOUTE la plage de vie du bloc.
  //
  // ⚠️ MESURE, PAS DEDUCTION (scripts/diag-r19-sonde.mjs : une valeur de sortie
  // FORCEE a chaque etage, relue hors composeur sur une passe brute de
  // sceneGlobe). Sur les TERRES du crop, cadrage d'ouverture :
  //   minor    12,26 / 255 en moyenne, 255 au maximum  → les bandes EXISTENT
  //   crowd   250,21 / 255                             → il ne coupe rien
  //   minFade   3,57 / 255, 43 au mieux                → ZERO
  //   contour   0,14 / 255                             → ce qui reste : rien
  // et texel y vaut 3,00 en moyenne, donc clamp(1,6 - 3,0 x 0,55) = 0.
  //
  // ⚡ **ET LE SOCLE EST LE MODELE, TERME A TERME** (terrain.js, bloc « contour
  // lines ») : meme 1.4 x uContourWeight, meme 0.55 sur le mineur, meme
  // clamp(1 - dch x 0.22) de foule — **et AUCUN minFade**. Le seul terme que le
  // globe ajoutait est celui qui eteignait tout. Le neutraliser DANS le crop,
  // c'est rendre au bloc la loi de trait du socle, et rien d'autre.
  //
  // ⚠️ **dedansCrop ET NON partBloc** : c'est une couche de CARTE, pas
  // d'eclairage — le meme argument que la photo aerienne. dedansCrop vaut ZERO
  // hors decoupe, et mix(x, 1.0, 0.0) rend x AU BIT PRES : la planete nue et la
  // vue orbitale sont intouchees. C'est de plus une COUVERTURE DOUCE, donc le
  // bord du bloc fond au lieu de poser une arete d'un pixel.
  //
  // ⚠️ **ET LE SCINTILLEMENT QUE minFade REPARE NE REVIENT PAS PAR LA** : il
  // vit dans la vue orbitale et de voyage, ou dedansCrop vaut zero. Le
  // supersampling de decodeMetersAA, lui, reste en place des deux cotes.
  float minFade = mix(clamp(1.6 - texel * 0.55, 0.0, 1.0), 1.0, dedansCrop);
  float contour = max(minor * minorK, major) * uContourOpacity * crowd * minFade;
  contour *= h < 0.0 ? 0.35 : 1.0; // bathymetric contours read lighter
  col = mix(col, uInk, contour);

  // ══════ LA GRILLE DE RELEVE DU BLOC, PORTEE SUR LA DECOUPE — Tache R22 ═════
  //
  // ⛔ **ELLE N'EXISTAIT PAS. Ce n'est pas un rebranchement, c'est une
  // ECRITURE.** Les options 19 et 20 du Studio ecrivaient uGridStep / uGridOpacity
  // sur le SOCLE, dont le maillage n'est plus dessine sous la sphere : mesure
  // avant, sur une fenetre 1:1 de 512 x 320, **0,0000 et 0,0000** — le plancher
  // de bruit lui-meme.
  //
  // ⚠️ **APRES LES COURBES ET AVANT LE GRATICULE, ET L'ORDRE EST UN ARGUMENT.**
  // C'est celui du socle (terrain.js : bloc « contour lines » puis bloc
  // « survey grid ») : le carroyage passe PAR-DESSUS les courbes, sinon un
  // relief dense l'efface par morceaux et la grille cesse d'etre une grille.
  //
  // ══════ LA CONVERSION D'UNITE, ECRITE — le defaut n° 1 de ce chantier ══════
  //
  // Le socle indexe sa grille sur champXZ(), du x/z de MONDE en unites de scene,
  // et un bloc fait span = 56 unites de large. Le crop, lui, ne connait que
  // qCrop, ses coordonnees locales dans [-1, 1]. La conversion vit dans
  // pasGrilleBloc (monde/habillage-crop.js) et vaut
  //
  //     pas_m = valeurBloc x largeurSolM / span
  //
  // soit **488,51 m par unite de scene** a La Reunion (27 356,4 m / 56), donc
  // **2 442,5 m** pour la tirette au defaut — mesure dans l'application vivante. ⚠️ **SANS EXAGERATION** : c'est une
  // longueur HORIZONTALE, contrairement a l'intervalle des courbes juste
  // au-dessus, qui en porte une (facteur 18 cote globe). Le detail et les deux
  // pieges sont dans la docstring de pasGrilleBloc.
  //
  // ⚠️ **ET LE COMPTE SE VERIFIE : largeurSolM / pas_m = span / valeurBloc**,
  // c'est-a-dire EXACTEMENT le nombre de cellules que le socle trace au meme
  // reglage — 11,2 pour gridStep = 5. C'est la « distance connue au sol » du
  // brief, exprimee en cellules ; test/grille-crop.test.js l'exige.
  //
  // ⚠️ **dedansCrop ET NON partBloc** : une grille de releve est une couche de
  // CARTE, pas d'eclairage — le meme argument que la photo aerienne et que les
  // courbes. dedansCrop vaut ZERO hors decoupe, donc la planete nue et la vue
  // orbitale gardent leur graticule et rien d'autre. C'est de plus une
  // COUVERTURE DOUCE, donc la grille fond au bord du bloc au lieu d'y poser une
  // arete d'un pixel.
  //
  // ⛔ **ET IL N'Y A PAS DE minFade ICI, C'EST DELIBERE ET C'EST LA LECON DE
  // R19.** Les courbes du crop mouraient sur ce fondu de minification : sous le
  // crop, texel valait 3,00 et clamp(1,6 - 3,00 x 0,55) rend ZERO. Le socle,
  // qui est le modele, n'a aucun fondu de ce genre sur sa grille — et l'ecrire
  // ici aurait produit une grille parfaite et invisible, mot pour mot le piege
  // que le brief de R22 signale en premier.
  if (uGridOpacity > 0.001 && uGridStepM > 0.0 && uCropDemiM > 0.0) {
    vec2 solM = qCrop * uCropDemiM; // metres de sol depuis le centre du crop
    vec2 gq = solM / uGridStepM;
    vec2 dgq = fwidth(gq);
    vec2 distG = abs(fract(gq + 0.5) - 0.5);
    // le meme trait que le socle : smoothstep(0, derivee x 1.4, distance)
    float gxC = 1.0 - smoothstep(0.0, dgq.x * 1.4, distG.x);
    float gzC = 1.0 - smoothstep(0.0, dgq.y * 1.4, distG.y);
    float grille = max(gxC, gzC) * uGridOpacity * dedansCrop;
    col = mix(col, uGridColor, grille);
  }

  // 10° graticule — the survey grid of the planet view
  vec2 g = vLatLon / 10.0;
  vec2 dg = fwidth(g);
  vec2 dist = abs(fract(g + 0.5) - 0.5);
  float gl = max(
    1.0 - smoothstep(0.0, dg.x * 1.4, dist.x),
    1.0 - smoothstep(0.0, dg.y * 1.4, dist.y)
  );
  col = mix(col, uInk, gl * uGraticuleOpacity);

  // soft sun shading — the map stays readable, light only models the sphere
  //
  // ⚠️ ombreRelief VAUT 1.0 HORS D15 (Tache R6) : cette ligne est alors celle du
  // depot au bit pres. C'est LA MULTIPLICATION QUI RHABILLE LA PLANETE, et elle
  // est ici et pas ailleurs pour trois raisons.
  //   ① APRES la rampe, les courbes et le graticule, donc l'ombrage passe SUR
  //      la carte comme une lumiere et non sous elle — c'est ce que fait le
  //      socle, dont les traits sont peints sur un albedo puis eclaires.
  //   ② SUR colPlanete SEULE : le bloc a son propre eclairage (irradianceCrop,
  //      Tache P3), et l'ombrer une seconde fois le noircirait.
  //   ③ AVANT le terminateur, qui MULTIPLIE lui aussi : l'ordre des deux ne
  //      change rien au produit, mais le lire dans cet ordre dit lequel des deux
  //      modele le RELIEF et lequel modele la SPHERE.
  float diff = max(dot(nMonde, uSunDir), 0.0);
  vec3 colPlanete = col * (0.74 + 0.30 * diff) * ombreRelief;

  // terminateur jour/nuit (demande Adrien, facon Google Earth) : la face a
  // l'ombre FOND VERS UNE COULEUR DE NUIT (uNuitFond, derivee de uShadowColor,
  // poussee par applyBackground : elle suit donc le fond ET le cycle jour/nuit)
  // — la planete s'eteint dans son propre decor, pas dans un noir generique.
  //
  // LE PLANCHER EST UN UNIFORME DEPUIS LA TACHE R7, ET C'EST UNE MESURE QUI L'A
  // EXIGE. Le 0,10 + 0,90 * day d'avant a ete ecrit quand uSunDir suivait la
  // CAMERA, c'est-a-dire quand la face nuit n'etait JAMAIS regardee de face. R7
  // la met en plein cadre : a 10 h — l'heure PAR DEFAUT du produit — en
  // tournant autour du globe, l'antisolaire devenait une sphere unie,
  // bathymetrie, rampe de relief et palette parties, pendant que la LUMINANCE
  // MOYENNE MONTAIT. uNuitCarte est la part de carte gardee en pleine nuit ;
  // le pourquoi et les valeurs sont dans monde/soleil-monde.js.
  //
  // NEUTRE AU BIT PRES EN PRODUCTION : uNuitCarte = 0.10 rend
  // 0.10 + (1.0 - 0.10) * day, et 1 - 0,1f == 0,9f en float32 ; uNuitFond y
  // vaut exactement uShadowColor. Drapeau baisse, c'est la ligne d'avant.
  float day = smoothstep(-0.22, 0.16, dot(nMonde, uSunDir));
  colPlanete = mix(uNuitFond, colPlanete, uNuitCarte + (1.0 - uNuitCarte) * day);

  // ══════ LE BLOC EST UN MATERIAU ECLAIRE, PLUS UNE COULEUR NUE — Tache P3 ══
  //
  // > L'agent noteur, 2026-08-22 : « Le socle est un materiau ECLAIRE. La tuile
  // > du globe est une COULEUR NUE. »
  //
  // ⛔ ET LES DEUX LIGNES AU-DESSUS NE SONT PAS UN ECLAIRAGE, C'EST MESURE.
  // uSunDir n'est pas le soleil de la scene : en mode surface, main.js le repose
  // A CHAQUE IMAGE sur camGlobe.position tournee de 42 degres, « pour que la
  // face visible ne soit pas dans la nuit ». Releve le 2026-08-22, La Reunion :
  // uSunDir = (0,2282 -0,3679 0,9014) pendant que le soleil de la scene pointait
  // (0,4392 0,5631 -0,7002). L'ombrage du bloc suivait donc la CAMERA, pas
  // l'heure. Et son amplitude, 0,74 a 1,04, est de toute facon un rapport de
  // 1,4:1 la ou un vrai Lambert va de 0 a 1.
  //
  // ⚠️ LA FRONTIERE EST LA SILHOUETTE DU BLOC, PAS UN CARRE. dedansCrop est la
  // couverture douce de la superellipse — celle que les parois suivent au bit
  // pres. A estompage plein (la vue du bloc) rien n'est dessine dehors, donc il
  // n'y a aucune couture a voir ; en cours de fondu, la loi change exactement la
  // ou le bloc commence, ce qui est la definition d'un bloc decoupe.
  //
  // ⚠️ ET LE TERMINATEUR NE FRANCHIT PAS CETTE FRONTIERE. Le socle n'a pas de
  // nuit : il est un objet de studio, eclaire par trois sources. Laisser le
  // fondu vers uShadowColor mordre sur le bloc l'aurait eteint vers la couleur
  // du fond selon l'angle de la CAMERA — le defaut d'au-dessus, en pire.
  //
  // ⚠️ uAlbedoTeinte EST mapTint, ET LA TACHE P2 AVAIT RAISON DE LE LAISSER.
  // Elle ecrivait « il n'y a rien contre quoi doser » : c'etait vrai d'un
  // nuanceur sans lumiere. Des qu'il y en a une, col DEVIENT un albedo, et
  // mapTint retrouve mot pour mot le sens qu'il a dans terrain.js:1137 —
  // verifie dans l'application vivante a 7,5e-5 pres sur 182 997 pixels.
  // ⚠️ ndu N'EST PAS BORNE, ET C'EST TOUT L'INTERET D'UNE LAMPE HEMISPHERIQUE :
  // sa face basse recoit la couleur du SOL. La borne ne vit que dans natGris,
  // ou un exposant fractionnaire rendrait NaN sur un negatif.
  //
  // ⚠️ col EST DEJA UN ALBEDO ICI quand partBloc > 0 (voir le bloc « LE BLOC
  // DEVIENT UN ALBEDO » plus haut) : il ne reste qu'a le multiplier par
  // l'irradiance et par 1/PI, ce que fait BRDF_Lambert dans three.
  //
  // ⚠️ ET AU PIXEL DE FRONTIERE, partBloc VAUT ENTRE 0 ET 1 : colPlanete y est
  // donc calculee sur une couleur a demi convertie. C'est UN pixel, sur une
  // silhouette de bloc, et le prix de l'alternative serait de porter DEUX
  // couleurs dans tout le nuanceur — donc de peindre deux fois l'apparence, le
  // trait de cote, les courbes et le graticule.
  // ══════ ⚡ ET L'APPOINT S'AJOUTE DANS LA MEME SOMME — Tache R21 ═══════════
  //
  // ⛔ CINQ CURSEURS ETAIENT VISIBLES ET INERTES (n° 69 a 73 de l'inventaire),
  // parce que l'appoint est une THREE.DirectionalLight de la scene du BLOC PLAT
  // et que le crop ne recoit pas des lampes mais des IRRADIANCES.
  //
  // ⚠️ UN TERME DE PLUS DANS LA SOMME, PAS UNE SECONDE LOI, ET C'EST LA MEME
  // DISCIPLINE QUE L'ENVIRONNEMENT VINGT LIGNES PLUS HAUT : three accumule une
  // seconde directionnelle dans le MEME irradiance (RE_Direct) avant le MEME
  // BRDF_Lambert. Ecrire un second produit multiplicatif a cote aurait ete la
  // faute de D13 §③.
  //
  // ⚠️ ET LES CONVERSIONS SONT ECRITES, AVEC LEUR FACTEUR : elles valent toutes
  // 1, et le §6 de monde/lumiere-sphere.js dit pourquoi chacune vaut 1 —
  // notamment que placeFill construit sa direction avec les TROIS MEMES termes
  // que placeSun, donc que directionSoleilLocale s'applique sans retouche.
  //
  // ⚠️ uAppointIrr A (0,0,0) : la somme est inchangee terme a terme, quelle que
  // soit uAppointDir. C'est la garde, et c'est l'etat de repos.
  // ⚠️ nMat ET NON nMonde — Tache R25 : c est la normale PERTURBEE par la carte
  // de la matiere qui doit recevoir le soleil et l appoint, sinon la tirette
  // « Relief de la matiere » n aurait rien a moduler. uMatOn a 0, nMat EST
  // nMonde (meme objet, meme valeur) : la somme est inchangee au bit pres.
  vec3 irrBloc = irradianceCrop(dot(nMat, uSoleilDir), nduCrop, uSoleilIrr, uCielIrr, uSolIrr)
               + irradianceAppoint(dot(nMat, uAppointDir), uAppointIrr);
  vec3 colBloc = col * irrBloc * 0.3183098861837907;
  col = mix(colPlanete, colBloc, partBloc);

  // faint paper grain
  // ⛔ LE GRAIN ETAIT INDEXE SUR vUv, DONC SUR LA TUILE. vUv va de 0 a 1 quelle
  // que soit l'etendue au sol : 941,7 cellules par tuile, donc une frequence
  // inversement proportionnelle a la taille de la tuile, donc un grain qui
  // DOUBLE de taille a chaque frontiere de niveaux. vLatLon ne compensait pas —
  // le terme 941,7 x vUv domine de plusieurs ordres de grandeur.
  //
  // ⚠️ C'EST LA MEME DISCIPLINE QUE L'HABILLAGE, QUI INDEXE DEJA SON GRAIN SUR
  // qCrop « sinon le grain se repeterait a chaque tuile ». Ici la coordonnee
  // continue est le METRE DE SOL absolu, tire de vLatLon (absolu, il etait deja
  // la pour le graticule et pour la decoupe), ramene en PIXELS D'ECRAN par
  // mppEcran. Le grain garde donc sa finesse — 941,7/256 = 3,678 cellules par
  // pixel, derive et non pose — mais son ancrage est le SOL, pas la tuile.
  //
  // ⚠️ ET IL NE RESTE PAS COLLE A L'ECRAN : tourner ou deplacer la camera ne
  // change pas la coordonnee (le sol ne bouge pas), seule la distance la remet a
  // l'echelle — exactement comme le niveau de tuile le faisait, mais sans marche.
  // Le moirage que terrain.js documente (etude 5.4) demanderait une coordonnee
  // d'ecran ; ce n'en est pas une.
  float grainX = vLatLon.y * cos(radians(vLatLon.x)) * uMetresParDegre / max(mppEcran, 1e-3) * uGrainParPixel;
  float grainY = vLatLon.x * uMetresParDegre / max(mppEcran, 1e-3) * uGrainParPixel;
  vec2 grainP = uMppFacteur > 0.0 ? vec2(grainX, grainY) : vUv * 941.7 + vLatLon;
  col += (hash12(grainP) - 0.5) * 0.02 * (0.2 + 0.8 * day);

  gl_FragColor = vec4(col, couvertureCrop);
}
`

// ══════ LE CHARGEUR D'UNE PHOTO DE TUILE — Tâche R16 ════════════════════════
//
// ⚠️ **PAS DE MIPMAPS, ET C'EST UN POSTE DE MÉMOIRE VIDÉO, PAS UN OUBLI.** Une
// texture 256² en RGBA pèse 256 × 256 × 4 = **262 144 octets = 256 Kio pile** ;
// sa chaîne de mipmaps ajoute **+33,3 %**, soit 341 Kio. Sur le plafond livré de
// 192 entrées, c'est 48,0 Mo contre 64,0 Mo — 16 Mo pour un filtrage dont le
// globe n'a presque jamais besoin : la tuile de photo est MAGNIFIÉE dès que le
// quadtree passe le niveau 8 (une z8 étirée sur seize tuiles z12), et à l'orbite
// une tuile z3 couvre une large part de l'écran. Le prix est nommé au rapport :
// près du limbe, une tuile vue en biais minifie, et là le filtrage linéaire sans
// mipmap crible. C'est un compromis mesuré, pas un défaut ignoré.
//
// ⚠️ `crossOrigin` EST OBLIGATOIRE — même raison que `map/aerial-layer.js` : sans
// le drapeau la texture est teintée et WebGL la refuse. NASA GIBS envoie bien
// `Access-Control-Allow-Origin: *` (vérifié en vol par la Tâche R12).
//
// ⚠️ `flipY` RESTE À SA VALEUR PAR DÉFAUT (vrai), et c'est ce qui accorde la
// photo avec le maillage : `_buildMesh` pose `uv.y = 1 - v` en écrivant « canvas
// row 0 = north = uv v 1 (flipY texture) ». La ligne 0 d'une tuile XYZ est son
// bord NORD. Les deux conventions se rejoignent, sans retournement à écrire.
function chargerPhotoTuile(z, x, y) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tex = new THREE.Texture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
      resolve(tex)
    }
    img.onerror = () => reject(new Error(`photo monde ${z}/${x}/${y}`))
    img.src = urlPhotoMonde(z, x, y)
  })
}

// ---------------------------------------------------------------- tile math

function tileKey(z, x, y) {
  return `${z}/${x}/${y}`
}

// Le quadrant d'un enfant dans son parent, en bit : 1 = nord-ouest, 2 = nord-est,
// 4 = sud-ouest, 8 = sud-est — le même ordre que `_children` et que la découpe
// d'index de `_decouperEnQuadrants` (R37).
function quadrantDe(k) {
  return 1 << ((k.x & 1) + ((k.y & 1) << 1))
}

// ══════════ L'IRRADIANCE D'UNE LAMPE — Tâche P3 ════════════════════════════
//
// ⚠️ **`WebGLLights` FAIT EXACTEMENT CE PRODUIT, ET IL LE FAIT UNE FOIS** :
// `uniforms.color.copy(light.color).multiplyScalar(light.intensity)` pour une
// directionnelle, `skyColor`/`groundColor` de même pour une hémisphérique. Le
// nuanceur des tuiles reçoit donc une IRRADIANCE, jamais un couple
// couleur × intensité — sans quoi il y aurait deux endroits où l'oublier.
//
// ⚠️ **ET LA CONVERSION sRVB → LINÉAIRE EST CELLE DE three, PAS UNE FORMULE
// ÉCRITE ICI.** `setStyle` la fait (ColorManagement est actif par défaut depuis
// r152), exactement comme `sun.color.set(s.sunColor)` la fait côté socle.
const _couleurTampon = /* @__PURE__ */ new THREE.Color()
function poserIrradiance(cible, couleurHex, intensite) {
  if (couleurHex == null || !Number.isFinite(intensite)) return
  _couleurTampon.setStyle(couleurHex, THREE.SRGBColorSpace)
  cible.set(_couleurTampon.r * intensite, _couleurTampon.g * intensite, _couleurTampon.b * intensite)
}

// LE GLOBE REDEMANDAIT AU RÉSEAU LA TUILE QU'IL VENAIT DE JETER.
//
// Mesuré pendant une recherche « Le Var » (vol z3→z9) : 647 requêtes AWS pour
// 245 URL uniques, terrarium/3/4/3.png demandée 19 fois. La concurrence n'y est
// pour rien — `_request` refuse déjà une tuile qui n'est pas `empty`. La
// redondance est TEMPORELLE : `_evict` supprime la tuile de `this.tiles` dès
// 420 tuiles, la caméra la retraverse deux images plus tard, `_ensureTile` la
// recrée `empty` et tout repart. Les coupables sont les ANCÊTRES BAS ZOOM :
// retraversés à chaque image (ils portent la descente jusqu'à ce que leurs
// quatre enfants sachent dessiner), mais jamais visibles une fois refendus,
// donc éligibles à l'éviction à chaque tour.
//
// ⚠️ LA BORNE N'EST PAS NÉGOCIABLE, ET C'EST LA MÉMOIRE QUI LA DICTE. Le tas JS
// est déjà mesuré à 1,7–1,9 Go pour 2 à 4 Go de limite pratique. Tout retenir
// serait le geste évident et c'est le piège : l'ensemble de travail du quadtree
// dépasse 1 500 tuiles quand on cesse d'évincer, soit 380 Mo — c'est
// précisément pour ça que CACHE_MAX existe.
//
// La taille est MESURÉE, pas devinée. À travail constant (1 200 tuiles
// demandées sur le vol du Var), le réseau en fonction de la borne :
//
//     sans mémoire  1 210 requêtes, pire tuile 27 fois
//      64 (16 Mo)     784                        8
//     128 (32 Mo)     562                        4   ← le coude
//     256 (64 Mo)     502                        2
//     512 (128 Mo)    418 = le nombre d'URL      1   ← +7 % de tas, non
//
// On s'arrête au coude : passer de 64 à 128 rachète 222 requêtes pour 16 Mo,
// de 128 à 256 seulement 60 pour 32 Mo de plus. 32 Mo, c'est exactement le
// budget que le damier s'accorde déjà pour ses MNT (src/dem.js) — 1,7 % du tas
// mesuré. Le contrat « une requête par URL » coûterait, lui, 128 Mo : hors de
// question sur ce tas-là.
// ⚠️ LE BUDGET EST EN OCTETS DEPUIS QUE LES TUILES N'ONT PLUS TOUTES LA MÊME
// TAILLE (plan « globe continu », Tâche 4 alpha, Étape 5). Il valait 128
// ENTRÉES, ce qui n'a plus de sens quand une entrée pèse 256 Kio (AWS, 256 px)
// ou 1 Mio (Mapterhorn, 512 px) selon la zone : la même borne aurait laissé le
// cache osciller entre 32 et 128 Mo sans que rien ne le dise. La VALEUR, elle,
// ne bouge pas d'un octet — 32 Mo, le coude mesuré ci-dessus — et sur un globe
// entièrement AWS le comportement est identique au bit près (128 × 256 Kio =
// exactement 32 Mo, donc exactement 128 entrées retenues).
// ⚠️ **LA BORNE ET LA MAP VIVENT MAINTENANT DANS `monde/memo-tuiles-mnt.js`**
// (Tâche R3, I3), et le paragraphe ci-dessus reste le sien : c'est la MESURE qui
// fonde les 32 Mo, et elle n'a pas bougé. Ce fichier ne fait que réexporter la
// Map sous son nom historique — `test/globe-reseau.test.js` la lit ainsi.
export const _tileMemo = memoTuiles

// ═══════════ LE JOURNAL RÉSEAU — la source de `debitObserve` (Tâche 4 bis) ════
//
// ⚠️ **IL SE POSE ICI ET NULLE PART AILLEURS**, parce qu'ici est le seul endroit
// du fichier où l'on sait qu'une requête est réellement PARTIE : `tileBitmap`
// dédoublonne par URL, et une tuile servie par `_tileMemo` arrive en zéro
// milliseconde sans avoir rien téléchargé. Chronométrer `fetchTile` compterait
// ces zéros et rendrait un débit infini — c'est le piège « le chronomètre qui
// mesure autre chose » du §3 de `/threejs-optimisation`.
//
// Une entrée par réponse REÇUE : `octets` (la taille du blob), `debut` et `fin`
// (l'horloge à l'émission et à la réception complète). ⚠️ **Les trois sont
// nécessaires** : `debitObserve` agrège en temps mural, donc il lui faut les
// bornes des intervalles et pas seulement leur durée — six transferts
// simultanés de 359 ms font 359 ms de mur, pas 2 154.
//
// Module-level et exporté, comme `_tileMemo` juste au-dessus : c'est le
// précédent du fichier, et le journal est une propriété du RÉSEAU, pas d'une
// instance de globe.
const JOURNAL_MAX = 64 // deux fenêtres de `MAX_CONCURRENT` × dix — voir flux-terrain.js

/** Les dernières réponses reçues, les plus anciennes en tête. Exporté pour les tests. */
export const _journalReseau = []

/** Le compteur monotone des réponses — un flux neuf s'en sert de repère. */
let _sequenceReseau = 0

/** Le rang de la dernière réponse journalisée. `creerFlux` le lit à sa naissance. */
export function sequenceReseau() {
  return _sequenceReseau
}

/**
 * Journalise une réponse reçue. ⚠️ **Exportée pour que le test de
 * `debitObserve` puisse poser des tailles et des durées CONNUES** au lieu de les
 * arracher à un bouchon de `fetch` — une réponse dont on ne connaît pas la
 * taille ne prouve rien d'un débit.
 */
export function noterReponse({ octets, debut, fin }) {
  if (!(octets > 0) || !Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) return
  _journalReseau.push({ octets, debut, fin, seq: ++_sequenceReseau })
  while (_journalReseau.length > JOURNAL_MAX) _journalReseau.shift()
}

/** Remise à zéro du journal — tests uniquement. */
export function _resetJournalReseau() {
  _journalReseau.length = 0
  _sequenceReseau = 0
}

// `performance.now` quand il existe (navigateur et node ≥ 16), `Date.now`
// sinon. ⚠️ Une fonction, pas une valeur capturée : le banc pose une horloge
// VIRTUELLE sur `globalThis.performance`, et une référence figée à l'import ne
// la verrait pas.
function maintenant() {
  return globalThis.performance?.now?.() ?? Date.now()
}

/** Remise à zéro de la mémoire de tuiles — tests uniquement. */
export function _resetTileMemo() {
  viderMemoTuiles()
}

// ═══════════ LA SOURCE DE RELIEF — UNE POLITIQUE, PAS UNE URL ═══════════════
//
// (Plan « globe continu », Tâche 4 alpha.) Ce fichier tapait
// `elevation-tiles-prod/terrarium` en dur et n'importait rien de
// `dem-source.js`. Le produit, lui, sert du Mapterhorn 512 px — qui agrège
// l'IGN RGE ALTI, swissALTI3D… — et ne garde AWS que comme REPLI.
//
// ⚠️ **LE DANGER N'ÉTAIT PAS DE CHOISIR LA MAUVAISE SOURCE, C'ÉTAIT DE
// REMPLACER UNE POLITIQUE PAR UNE URL.** `TILE_URL = DEM_SOURCES[actif].url`
// aurait semblé juste et aurait perdu les quatre choses qui font le travail :
// la sonde de couverture PAR ZONE, le surzoom depuis l'ancêtre, le repli AWS
// **localisé**, et la distinction entre un 404 et une panne. On aurait eu une
// seule source pour la planète entière, choisie une fois, au lieu de la
// meilleure disponible à chaque endroit. Ce sont donc les FONCTIONS de
// `dem-source.js` qui sont reprises ici, pas ses URL.
//
// ⚠️ **ET LE GLOBE NE CONSULTE CETTE POLITIQUE QU'À PARTIR DE
// `SEUIL_SOURCE_FINE` — C'EST L'ÉTAPE 3 DE LA TÂCHE, ET ELLE EST TRANCHÉE PAR
// TROIS FAITS DU DÉPÔT, PAS PAR UNE PRÉFÉRENCE :**
//
//   1. `dem-source.js` donne `baseZoom: 12` à Mapterhorn : c'est son PLANCHER
//      DE COUVERTURE. Sous z12 la sonde n'a rien à répondre, et l'en-tête du
//      module ajoute que Mapterhorn rend 404 **au-dessus de z4 en pleine mer**.
//      Or la majorité des tuiles d'un globe sont océaniques : rebrancher la
//      bande z5–z11 ouvrirait des trous sur les deux tiers de la planète pour
//      remplacer une donnée qu'AWS sert déjà correctement à ces échelles.
//   2. Le chemin de PRODUCTION plafonne à z11 — c'est `plancher = 1` dans
//      `_traverse`, mesuré par la Tâche 4 quater (`MAX_Z = 16` et treize fois
//      le budget de cache rendent toujours z11). La bande z2–z11 EST le globe
//      de production. En n'y touchant pas, l'Étape 7 (« vérifier que le globe
//      orbital reste identique ») est tenue PAR CONSTRUCTION, pas par un banc.
//   3. La sonde coûte six requêtes HEAD par zone z8, HORS `MAX_CONCURRENT`.
//      Payée sur une vue orbitale, elle renseignerait un intervalle que
//      personne ne demande. Bornée à z12+, elle n'est payée que sur les zones
//      où la caméra descend réellement — et la mémoire est PARTAGÉE avec le
//      damier (`src/dem.js`), qui a souvent déjà payé la même sonde.
//
// C'est aussi ce qui lève la contradiction que le plan signalait entre ses
// étapes 3 et 4 : elles ne s'opposaient que tant que « rebrancher » voulait
// dire « partout ».
export const SEUIL_SOURCE_FINE = DEM_SOURCES.mapterhorn.baseZoom

/**
 * Quelle source et quelle tuile pour ce nœud du quadtree — ⚠️ **SANS ATTENDRE**.
 *
 * Trois issues, exactement celles de `src/dem.js` (« un zoom → on y va, en
 * surzoomant au-delà · null → zone hors couverture → AWS POUR CE CHARGEMENT,
 * sans toucher au choix de session · panne → repli AWS pour TOUTE la
 * session »), plus une quatrième que le damier n'a pas à connaître parce qu'il
 * est asynchrone et que la pompe du globe ne l'est pas :
 *
 *   `null` rendu ici = **la zone n'est pas encore sondée**. L'appelant ne
 *   devine pas : il laisse la tuile `empty` et la redemandera à l'image
 *   suivante. Voir `_request`.
 *
 * @returns {{source: object, tile: object}|null}
 */
export function planTuile(z, x, y, source = activeDemSource()) {
  const aws = DEM_SOURCES.aws
  const surAws = { source: aws, tile: overzoomTile(z, x, y, aws.maxZoom) }
  // sous le plancher de couverture de la source fine, la question ne se pose
  // pas — et au-dessus de son plafond de sondage non plus, elle n'a plus rien.
  if (source.id === aws.id || z < SEUIL_SOURCE_FINE) return surAws
  const connu = peekRegionMaxZoom(regionKey(source.id, z, x, y))
  if (connu === undefined) return null // pas encore sondé
  if (connu === null) return surAws // hors couverture ICI — la session garde Mapterhorn
  const tile = overzoomTile(z, x, y, connu)
  // ══════ LE DESCENDANT D'UN 404 VA DROIT CHEZ AWS — CIB ═══════════════════
  // La sonde répond PAR ZONE (z8, ~150 km) ; la mer à l'intérieur d'une zone
  // couverte rend 404 tuile par tuile, et chacun de ces 404 coûtait un
  // aller-retour AVANT le vrai chargement AWS (PF2 §5 : 40 % des requêtes
  // d'une descente en dev). Une fois le trou connu, ses descendants ne
  // repassent plus par la source fine. ⚠️ **Ce n'est PAS le repli de session**
  // (`fallbackToAws`) : la tuile d'à côté, sur la terre ferme, garde Mapterhorn.
  if (trouConnu(source.id, tile.z, tile.x, tile.y, source.baseZoom)) return surAws
  return { source, tile }
}

// Une SEULE entrée par URL, promesse comprise : deux demandes qui se
// chevauchent partagent la requête au lieu d'en lancer deux.
function tileBitmap(url, octets = 256 * 256 * 4) {
  // ⚠️ **LA MÉMOIRE EST PARTAGÉE AVEC `dem.js` DEPUIS LA TÂCHE R3 (I3).** Le
  // chargeur ci-dessous n'est appelé QUE sur un manque : si le bloc du socle est
  // déjà passé par `loadDem`, ses neuf tuiles z12 ne repartent plus sur le
  // réseau. Le reste — LRU, budget, « un échec ne se mémorise pas » — est celui
  // d'avant, déplacé sans être touché.
  return tuileMemorisee(url, () => (async () => {
    const debut = maintenant()
    let r
    try {
      r = await fetch(url)
    } catch (err) {
      // réseau, DNS, CORS : c'est une PANNE de source, pas un trou de couverture
      throw new DemSourceError(`tile ${url} → ${err?.message || err}`)
    }
    if (!r.ok) {
      // ⚠️ UN 404 N'EST PAS UNE PANNE — c'est « je ne couvre pas ici ».
      // `fetchTile` le rattrape sur AWS pour CETTE tuile ; tout autre statut
      // est une panne de source, et remonte comme telle.
      const err = r.status === 404
        ? new Error(`tile ${url} → HTTP 404`)
        : new DemSourceError(`tile ${url} → HTTP ${r.status}`)
      err.status = r.status
      throw err
    }
    const blob = await r.blob()
    // ⚠️ ON JOURNALISE APRÈS `blob()`, PAS APRÈS `fetch()` : `fetch` rend dès les
    // en-têtes, le corps arrive après. Chronométrer l'en-tête mesurerait la
    // latence d'aller-retour et l'appellerait « débit ».
    noterReponse({ octets: blob?.size, debut, fin: maintenant() })
    return createImageBitmap(blob)
  })(), octets)
}

// ═══════════ LE DÉCODEUR HORS DU FIL PRINCIPAL — PF2 ═════════════════════
//
// Un seul Worker pour tout le globe (voir `src/monde/decodeur-terrarium.js`,
// qui porte la mesure : 4 ms la tuile 256², 6,5 ms la 512², sur le fil
// principal). `null` = pas encore essayé ; `false` = indisponible (pas de
// Worker, pas d'OffscreenCanvas, ou le Worker a levé) — et `fetchTile`
// décode alors sur place, comme avant, au bit près.
let _decodeur = null
function decodeurTerrarium() {
  if (_decodeur !== null) return _decodeur
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof ImageBitmap === 'undefined') return (_decodeur = false)
  try {
    const worker = new Worker(new URL('./monde/decodeur-terrarium.js', import.meta.url), { type: 'module' })
    const attentes = new Map()
    worker.onmessage = (ev) => {
      const { id, heights, image, erreur } = ev.data
      const a = attentes.get(id)
      if (!a) { image?.close?.(); return }
      attentes.delete(id)
      if (erreur) a.reject(new Error(erreur))
      else a.resolve({ heights, image })
    }
    worker.onerror = (ev) => {
      // ⚠️ REPLI DÉFINITIF, ET BRUYANT : un Worker qui lève (module introuvable,
      // OffscreenCanvas refusé) ne doit ni geler les tuiles ni se retenter à
      // chaque image. Les attentes en cours retombent sur le décodage local.
      console.warn('décodeur terrarium : repli sur le fil principal —', ev?.message || ev)
      for (const a of attentes.values()) a.reject(new Error('décodeur indisponible'))
      attentes.clear()
      _decodeur = false
    }
    _decodeur = { worker, attentes, id: 0 }
  } catch {
    _decodeur = false
  }
  return _decodeur
}

/** `null` si le décodage doit se faire ici ; sinon la promesse du Worker. */
function decoderHorsFil(img, px, tile) {
  const d = decodeurTerrarium()
  if (!d || !(img instanceof ImageBitmap)) return null
  const id = ++d.id
  return new Promise((resolve, reject) => {
    d.attentes.set(id, { resolve, reject })
    // ⚠️ CLONÉ, PAS TRANSFÉRÉ : `img` vient de `_tileMemo`, que le damier
    // partage. Transférer le bitmap le détacherait pour tous ses lecteurs.
    d.worker.postMessage({ id, bitmap: img, px, scale: tile.scale, ox: tile.ox, oy: tile.oy })
  })
}

// ═══════ LA CASCADE BATHYMÉTRIQUE SUR LE CHEMIN DU GLOBE — B3 ══════════════
//
// 🔴 LE DÉFAUT QUE CE BLOC RÉPARE, MESURÉ PAR B1 : au repos le globe et le
// damier s'accordent à 8,5 m près, parce que les tuiles AWS portent de
// l'ETOPO1 jusqu'à z10. **À z11 le terrarium cesse de décrire la mer** — quelle
// que soit sa source — et le globe n'avait RIEN pour prendre le relais :
// fosse de la Sonde, z10 → −7 067,6 m, z11 → **0,0 m**. 7 105 m d'écart avec
// le damier au même point, au même zoom, dans la même session.
//
// ⚠️ CE N'ÉTAIT PAS UN DÉFAUT DE CÂBLAGE DE `flux-terrain.js` : ce module
// importe bien `fuseBathymetry`, mais ses deux appelants sont la fenêtre bornée
// et le champ de la mer. Les textures que `_buildMesh` déplace et que le
// nuanceur colore ne passaient jamais par là — 544 tuiles d'altitude contre
// **0** tuile bathymétrique en 54 s de mode sphère.
//
// LA LOI DE SÉLECTION N'EST PAS RECOPIÉE : `peindreBathyTuile` (src/dem.js) est
// la même descente « fin → plancher » que le damier, avec la même mémoire de
// tuiles, les mêmes absences mémorisées et le même surzoom Catmull-Rom. C'est
// le §1 de `/threejs-optimisation` : deux descentes à faire coïncider, ce sont
// deux descentes qui divergent.
//
// ⚠️ CE QU'ON NE PAIE PAS, ET POURQUOI ÇA TIENT :
//   · une tuile SANS un seul pixel immergé ne coûte rien (test en sortie de
//     décodage, arrêt au premier pixel ≤ 0) — c'est la majorité des tuiles
//     continentales ;
//   · une tuile immergée dont la cascade n'a RIEN (abysse hors socle cuit) ne
//     coûte qu'une lecture de la mémoire d'absences, jamais un réseau ;
//   · seule la tuile qui a vraiment trouvé du fond paie le ré-encodage.

/**
 * Y a-t-il quoi que ce soit à creuser ? (arrêt au premier pixel sous la nappe)
 *
 * ⚠️ **LE NIVEAU EST UN PARAMÈTRE, PAS ZÉRO.** Écrit avec `<= 0` en dur, ce
 * garde-fou rendait `false` sur toute dalle du Baïkal — dont le pixel le plus
 * bas est à +449 m — et la zone lacustre restait donc lettre morte SUR LE
 * GLOBE alors qu'elle marchait déjà sur le damier. Mesuré : crop −291 m,
 * globe +449 m, au même point, dans la même session.
 */
function tuilePorteDeLaMer(heights, level) {
  for (let i = 0; i < heights.length; i++) if (heights[i] <= level) return true
  return false
}

// Le terrarium n'a-t-il RIEN à dire de la mer sur cette dalle ? C'est le cas
// au-delà de z10, où il rend 0,000 m pile sur tout le champ immergé (mesuré :
// fosse de la Sonde et mer Noire à z11 et z12, étendue 9×9 = 0,00 m).
function terrariumMuetEnMer(heights) {
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i]
    if (h < -0.002) return false // une vraie profondeur : il parle
  }
  return true
}

// La texture que le GPU tiendra, ré-encodée depuis les hauteurs FUSIONNÉES.
// ⚠️ LIGNE 0 = NORD, et `CanvasTexture` garde `flipY = true` : c'est
// exactement l'orientation du chemin de repli de `fetchTile` (et l'inverse du
// chemin Worker, qui retourne la dalle lui-même et pose `flipY = false`).
// Se tromper ici couperait le globe en bandes de latitude — défaut R36.
function textureDeHauteurs(m, px) {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d')
  const im = ctx.createImageData(px, px)
  const d = im.data
  for (let i = 0, j = 0; i < m.length; i++, j += 4) {
    // `encodeTerrarium` en ligne : l'appel et le tableau rendu coûtaient
    // 40 % du ré-encodage sur une dalle 512². La formule est la même, au bit.
    const v = Math.min(32767.99, Math.max(-32768, m[i])) + 32768
    let R = Math.floor(v / 256)
    let G = Math.floor(v - R * 256)
    let B = Math.round((v - R * 256 - G) * 256)
    if (B === 256) { B = 0; if (G === 255) { G = 0; R += 1 } else G += 1 }
    d[j] = R; d[j + 1] = G; d[j + 2] = B; d[j + 3] = 255
  }
  ctx.putImageData(im, 0, 0)
  return new THREE.CanvasTexture(c)
}

/**
 * Le fond marin de CETTE tuile, ou `null` s'il n'y a rien à en dire.
 *
 * ⚠️ **LE PLANCHER DE REPLI EST DOUBLE, ET CE N'EST PAS UN CONFORT.**
 * `BATHY_ZMIN` vaut 6 parce qu'au-delà on écraserait de l'ETOPO1 avec plus
 * grossier que lui (recensement du 2026-07-28). Mais quand le terrarium est
 * MUET — et à z11 il l'est, à 0,000 m pile sur toute la dalle — il n'y a plus
 * d'ETOPO1 à protéger : le repli grossier n'écrase rien, il remplit un vide.
 * On redescend alors jusqu'au plancher de l'index (z4). Mesuré : c'est ce qui
 * rend la plaine ionienne, dont AUCUNE tuile n'existe au-dessus de z6 (le
 * tuileur n'écrit que la frange côtière, `SHELF = −500`).
 *
 * @returns {Promise<Float32Array|null>}
 */
async function fondMarinTuile(z, x, y, heights, px) {
  if (!heights) return null
  // ⚠️ L'INDEX D'ABORD, ET C'EST L'ORDRE QUI COMPTE : la NAPPE décide de ce
  // qu'est « immergé » sur cette dalle. Le coût est nul — `indexBathy` rend une
  // promesse mémorisée pour toute la session, donc une micro-tâche.
  let index
  try { index = await indexBathy() } catch { return null }
  // ⚠️ `tileToLatLon(tx, ty, zoom)` — LA TUILE D'ABORD, LE ZOOM EN DERNIER.
  // Écrit `(z, x, y)` par analogie avec tout le reste du fichier, l'appel ne
  // levait rien, ne journalisait rien, et rendait un point à l'autre bout du
  // monde : la zone lacustre ne matchait jamais et le globe gardait +449 m
  // pendant que le damier rendait −291 m. `gl.getError()` valait 0.
  const c = tileToLatLon(x + 0.5, y + 0.5, z)
  const zoneIci = zoneAt(index, c.lat, c.lon)
  const nappe = zoneIci?.waterLevelM
  // 🔵 BT-I — la bande de fondu par zone, même raison qu'en src/dem.js.
  // Les DEUX chemins doivent la porter : sans ça le globe et le damier
  // divergeraient sur la même emprise, et c'est exactement l'écart que B3 a
  // mis une session à diagnostiquer.
  const bandeFondu = zoneIci?.blendDepthM
  const opts =
    Number.isFinite(nappe) || Number.isFinite(bandeFondu)
      ? {
          ...(Number.isFinite(nappe) ? { seaLevel: nappe + 0.5 } : {}),
          ...(Number.isFinite(bandeFondu) ? { blendDepth: bandeFondu } : {}),
        }
      : undefined
  // ⛔ BT-I — `opts ? opts.seaLevel : 0` ÉTAIT JUSTE TANT QU'`opts` NE POUVAIT
  // CONTENIR QUE LA NAPPE. Depuis qu'il peut ne porter QUE la bande de fondu,
  // il rend `undefined` sur une zone marine, `tuilePorteDeLaMer` compare tout
  // à `undefined`, la tuile est refusée, et le globe rend **0,0 m** pendant
  // que le damier rend −12 m DANS LA MÊME SESSION. Mesuré : c'est la
  // régression que j'ai introduite en câblant `blendDepthM`, et aucune erreur
  // n'est apparue nulle part. Le `?? 0` rétablit le niveau marin par défaut.
  if (!tuilePorteDeLaMer(heights, opts?.seaLevel ?? 0)) return null
  const sea = new Float32Array(px * px).fill(NaN)
  const arg = { zoom: z, tx: x, ty: y, index, dst: sea, dstStride: px, dx: 0, dy: 0, dw: px, dh: px }
  let peint = await peindreBathyTuile(arg)
  if (peint < 0 && terrariumMuetEnMer(heights)) peint = await peindreBathyTuile({ ...arg, plancher: index.zmin })
  if (peint < 0) return null
  // 🔴 PLAT — LA BANDE DE BRUIT NE VAUT QU'À ÉCHELLE COMPARABLE, ET C'EST ICI
  // QUE ÇA SE JOUE POUR LE CROP. La fenêtre continue ne relit pas le terrarium :
  // elle échantillonne CES tuiles-ci, DÉJÀ FUSIONNÉES. Mesuré en Camargue
  // (`.banc/PLAT/`) : la tuile z15 BRUTE descend à −0,27 m, 0,6 % sous zéro ; la
  // MÊME tuile sortie d'ici descend à −8,26 m, 19 à 49 % sous zéro. La bande de
  // B5 y rendait à la mer un marais IGN à +0,13 m, sur le seul avis d'EMODnet
  // z10 — 111,8 m de maille contre 1,73 m de pixel de tuile, rapport 64. À
  // l'écran : des rectangles à angles droits de la taille d'une tuile du
  // quadtree, et une tuile restée émergée au milieu. Les carrés plats et le
  // carré blanc. Voir `bandeBruitAdmise` (src/bathy.js) et son tableau de lieux.
  // ⚠️ `opts` peut être `undefined` : on ne le remplace QUE si la règle mord,
  // sinon l'appel reste celui d'avant AU BIT (nappe et bande de fondu comprises).
  const bandePlat = bandeBruitAdmise(
    resolutionBathyM(peint, c.lat),
    ((156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** z) * (256 / px)
  )
  const fondu = fuseBathymetry(heights, sea, bandePlat === 0 ? { ...(opts ?? {}), noiseBand: 0 } : opts)
  return fondu === heights ? null : fondu
}

// terrarium PNG/WebP → { texture, heights Float32Array(px*px), size }
// (pas de `signal` : la promesse est partagée entre tous les demandeurs de la
// même URL, l'abandon de l'un annulerait la tuile des autres)
//
// ⚠️ `plan` VIENT DE `planTuile` : il porte la source ET la tuile à demander,
// laquelle n'est PAS forcément (z, x, y) — au-delà du zoom que la zone couvre,
// `overzoomTile` renvoie vers l'ANCÊTRE et la sous-fenêtre à y lire.
async function fetchTile(z, x, y, plan) {
  let { source, tile } = plan
  let img
  try {
    img = await tileBitmap(source.url(tile.z, tile.x, tile.y), source.tilePx * source.tilePx * 4)
  } catch (err) {
    // ⚠️ 404 SUR LA SOURCE FINE = « pas couvert ICI », pas une panne. On prend
    // AWS POUR CETTE TUILE, et le choix de session ne bouge pas : la tuile
    // d'à côté, sur la terre ferme, continue de profiter de Mapterhorn. C'est
    // la réparation par dalle de `src/dem.js`, à l'échelle d'un nœud.
    //
    // ⚠️ ON TESTE LA CLASSE, PAS `err.status`, ET C'EST UNE MUTATION QUI L'A
    // EXIGÉ (Étape 8). Les deux marchaient — donc la classification 404/panne
    // était écrite DEUX FOIS, ici et dans `tileBitmap`. Un mutant qui rendait
    // `DemSourceError` sur un 404 survivait à toute la suite : `err.status`
    // valait toujours 404, ce branchement gagnait le premier, et l'erreur de
    // classification restait invisible. `tileBitmap` est désormais le SEUL
    // endroit qui décide ce qu'est une panne ; `err.status` ne sert plus qu'au
    // diagnostic.
    if (err instanceof DemSourceError || source.id === DEM_SOURCES.aws.id) throw err
    // ⚠️ ON NOTE LE TROU AVANT DE RATTRAPER — CIB. C'est ce qui évite le
    // SECOND aller-retour aux descendants de cette tuile (`planTuile`). On note
    // la tuile RÉELLEMENT DEMANDÉE (`tile`, qui peut être un ancêtre surzoomé),
    // pas (z, x, y) : c'est elle dont l'absence vaut pour toute sa descendance.
    noterTrouTuile(source.id, tile.z, tile.x, tile.y)
    source = DEM_SOURCES.aws
    tile = overzoomTile(z, x, y, source.maxZoom)
    img = await tileBitmap(source.url(tile.z, tile.x, tile.y), source.tilePx * source.tilePx * 4)
  }
  const px = source.tilePx
  // ══════ HORS DU FIL PRINCIPAL D'ABORD — PF2 ═══════════════════════════════
  // Le Worker rend les hauteurs ET un ImageBitmap prêt pour la texture ; s'il
  // manque ou échoue, le chemin d'en dessous décode ici, comme avant.
  let heights = null
  let texture = null
  const horsFil = decoderHorsFil(img, px, tile)
  if (horsFil) {
    try {
      const r = await horsFil
      heights = r.heights
      texture = new THREE.Texture(r.image)
      // ⛔ R36 : `flipY` est IGNORÉ quand la source est une ImageBitmap (mesuré
      // au pixel, Chrome 152 — voir `monde/decodeur-terrarium.js`). Le Worker
      // rend donc la dalle DÉJÀ retournée, et on le dit ici : la texture arrive
      // dans la même orientation que le `CanvasTexture` du chemin de repli, que
      // le navigateur honore le drapeau ou non.
      texture.flipY = false
      texture.needsUpdate = true
    } catch {
      heights = null
      texture = null
    }
  }
  if (!texture) {
    const c = document.createElement('canvas')
    c.width = c.height = px
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (tile.scale === 1) ctx.drawImage(img, 0, 0)
    else {
      // SURZOOM : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre, exactement
      // comme le damier (`src/dem.js`). Agrandir un fond lisse n'invente rien.
      const s = px / tile.scale
      ctx.drawImage(img, tile.ox * px, tile.oy * px, s, s, 0, 0, px, px)
    }
    heights = hauteursTerrarium(ctx.getImageData(0, 0, px, px).data, px)
    texture = new THREE.CanvasTexture(c)
  }
  // ══════ LA BATHYMÉTRIE ENTRE ICI, ET PAS AILLEURS — B3 ════════════════════
  // C'est le seul point du globe où l'on tient À LA FOIS les hauteurs et la
  // texture avant que l'une ou l'autre ne parte : `_buildMesh` relâche
  // `t.heights` dès le maillage bâti, et le nuanceur ne lit que la texture.
  // Fusionner plus tard voudrait dire fusionner deux fois, dans deux unités.
  const fondu = await fondMarinTuile(z, x, y, heights, px)
  if (fondu) {
    heights = fondu
    // la texture d'origine n'a jamais été téléversée : la libérer ne coûte
    // qu'un `close()` sur l'ImageBitmap du Worker, qui sinon fuirait.
    texture.image?.close?.()
    texture.dispose()
    texture = textureDeHauteurs(fondu, px)
  }
  // ⚠️ LE CANEVAS EST RELÂCHÉ DÈS QUE LE GPU L'A REÇU (plan « globe continu »,
  // Tâche 4 sexies, Étape 1). `CanvasTexture` garde son canevas vivant via
  // `texture.image` pour toute la vie de la texture : 256×256×4 = 256 Kio par
  // tuile, soit **105 Mo à 420 tuiles en cache** — une copie de ce que le GPU
  // détient déjà, que plus personne ne relit. `onUpdate` est appelé par
  // `WebGLTextures.uploadTexture` APRÈS le téléversement (three r172,
  // `three.module.js:11257`) : c'est le premier instant où le lâcher est sûr.
  //
  // ⚠️ ET CE N'EST PAS 105 Mo QUI SONT RENDUS, C'EST MOINS — MESURÉ, pas
  // déduit. three ne téléverse une texture qu'au premier DESSIN qui l'utilise,
  // et il élimine au frustum : relevé au navigateur, `?globe=continu` stabilisé
  // à 300 km rend **132 canevas sur 420 (31 %, ~33 Mo)**, et le globe de
  // production **36 sur 420 (~9 Mo)** — là, 307 tuiles sont marquées visibles
  // pour **12 appels de dessin**, tout le reste étant hors champ.
  // ⚠️ **N'EN FAITES PAS UN DÉFAUT À CORRIGER** : forcer le téléversement
  // (`renderer.initTexture`) rendrait bien les 105 Mo, mais en les déplaçant
  // dans la mémoire VIDÉO pour des tuiles que personne ne regarde. Tel quel,
  // une tuile paie soit la RAM (pas encore montrée), soit la VRAM (montrée),
  // **jamais les deux** — c'est la bonne propriété, gardez-la.
  //
  // ⚠️ ET CE LÂCHER A UN PRIX, IL EST NOMMÉ : three ne sait plus RÉENVOYER
  // cette texture après une perte de contexte WebGL — il avertit « Texture
  // marked for update but no image data found » et la tuile reste vide. La
  // contrepartie est `rechargeApresContexte()`, branchée sur
  // `webglcontextrestored` dans `src/main.js`. **Retirer l'un sans l'autre
  // laisse un globe noir après une réinitialisation de pilote.**
  texture.onUpdate = (tex) => {
    tex.image?.close?.() // un ImageBitmap (chemin Worker) se ferme explicitement
    tex.image = null // = `tex.source.data = null` : le canevas devient collectable
    tex.onUpdate = null
  }
  // NO mipmaps: terrarium packs meters into r*256 + g + b/256, and mip
  // generation rounds each channel to 8 bits independently — a half-unit
  // rounding of the r channel alone injects up to ~128 m of elevation noise
  // into every minified sample, which the contour shader turns into speckled
  // garbage all over the aerial view. Plain bilinear filtering is exact here
  // (the decode is a linear combination of the channels), so we keep it.
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  // ⚠️ `size` RESSORT AVEC LA TUILE, ET CE N'EST PAS DÉCORATIF : le globe
  // accepte désormais les DEUX tailles (256 AWS, 512 Mapterhorn) au lieu de
  // rééchantillonner. Rééchantillonner aurait coûté une seconde passe de
  // canevas par tuile pour, au choix, jeter la finesse de Mapterhorn (512 → 256)
  // ou payer quatre fois la mémoire sur des tuiles AWS qui n'ont rien de plus à
  // dire (256 → 512). Et surtout : la politique elle-même PRODUIT les deux
  // tailles dans la même session — une zone hors couverture retombe sur AWS
  // pendant que sa voisine reste sur Mapterhorn. Il n'y avait donc pas de
  // taille unique à choisir. Tout ce qui lit les hauteurs prend la taille en
  // paramètre : `sampleHeights`, `_materialFor` (uniforme `uTilePx`) et
  // `remplirHauteurs` (`src/monde/flux-terrain.js`).
  return { texture, heights, size: px }
}

/**
 * Échantillon bilinéaire d'une tuile terrarium. ⚠️ **EXPORTÉE POUR LE FLUX**
 * (`src/monde/flux-terrain.js`, `remplirHauteurs`) : la recopier là-bas ferait
 * deux conventions de demi-pixel à faire coïncider, et le §1 de
 * `/threejs-optimisation` dit exactement ce qu'il faut en penser.
 */
export function sampleHeights(heights, u, v, size = 256) {
  // bilinear sample, u/v in [0,1], row 0 = north. Pixel CENTERS sit at
  // (i + 0.5)/size — the same convention the GPU uses when the fragment shader
  // reads uTex — so vertex relief and shaded texture stay registered instead
  // of sliding half a pixel apart.
  //
  // ⚠️ `size` EST LA TAILLE DE TUILE, ET SON DÉFAUT DE 256 EST LOAD-BEARING :
  // les hauteurs factices des tests (et `_buildMesh` emprunté avec un `this`
  // qui n'est pas un globe) arrivent en 256 sans champ `size`.
  //
  // ⚠️ ET LES QUATRE BORNES CI-DESSOUS SONT DES INDEX, PAS DES OCTETS. Elles
  // valaient 255 et 254 en dur, et `grep 256` ne les voyait pas ; en 512 px
  // elles valent 511 et 510. Ce ne sont PAS de la même famille que le `255.0`
  // du nuanceur (une plage d'octet) ni que le radix 256 du terrarium — que
  // Mapterhorn partage, et qui ne bouge donc jamais.
  const max = size - 1
  const x = Math.min(Math.max(u * size - 0.5, 0), max)
  const y = Math.min(Math.max(v * size - 0.5, 0), max)
  const x0 = Math.min(Math.floor(x), size - 2)
  const y0 = Math.min(Math.floor(y), size - 2)
  const fx = x - x0
  const fy = y - y0
  // ⚠️ `i + size` ET `i + size + 1` : c'était `i + 256` et `i + 257`, soit la
  // ligne du dessous et son voisin de droite. En oublier UN SEUL donne des
  // altitudes fausses EN SILENCE — pas de ligne mixte, pas d'erreur, rien.
  const i = y0 * size + x0
  const a = heights[i]
  const b = heights[i + 1]
  const c = heights[i + size]
  const d = heights[i + size + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// ---------------------------------------------------------------- globe

/**
 * Le repère et les extrêmes de la nappe NUE d'une tuile — voir `_ensureTile`.
 * @returns {{e:THREE.Vector3,n:THREE.Vector3,u:THREE.Vector3,eMin:number,eMax:number,nMin:number,nMax:number,uMin:number,uMax:number}}
 */
export function boiteTuile(nw, se, center) {
  const u = center.clone().normalize()
  const lo = ((nw.lon + se.lon) / 2) * (Math.PI / 180)
  const e = new THREE.Vector3(Math.cos(lo), 0, -Math.sin(lo)) // l'est au centre
  const n = new THREE.Vector3().crossVectors(u, e) // haut × est = nord
  let eMin = 0, eMax = 0, nMin = 0, nMax = 0, uMin = 0, uMax = 0
  const p = new THREE.Vector3()
  const releve = (lat, lon) => {
    latLonToSphere(lat, lon, R_GLOBE, p).sub(center)
    const pe = p.dot(e), pn = p.dot(n), pu = p.dot(u)
    if (pe < eMin) eMin = pe
    if (pe > eMax) eMax = pe
    if (pn < nMin) nMin = pn
    if (pn > nMax) nMax = pn
    if (pu < uMin) uMin = pu
    if (pu > uMax) uMax = pu
  }
  const N = 4
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const lat = nw.lat + (se.lat - nw.lat) * f
    const lon = nw.lon + (se.lon - nw.lon) * f
    releve(nw.lat, lon)
    releve(se.lat, lon)
    releve(lat, nw.lon)
    releve(lat, se.lon)
  }
  return { e, n, u, eMin, eMax, nMin, nMax, uMin, uMax }
}

export class Globe {
  constructor(params = {}) {
    this.group = new THREE.Group()
    this.group.name = 'globe'
    // ══════ PF4 — LES TUILES SONT STATIQUES, ET LE GROUPE AUSSI ══════════════
    //
    // PF1 : `updateMatrixWorld` recomposait la matrice de 346 à 982 maillages
    // IMMOBILES à chaque image (5–9 % des échantillons V8). `matrixAutoUpdate =
    // false` sur une tuile ne suffit PAS : three propage `force = true` dès
    // qu'un ANCÊTRE se recompose (`updateMatrix` pose `matrixWorldNeedsUpdate`),
    // et le groupe comme la scène le faisaient chaque image. Mesuré (PF4,
    // orbite 2 000 km, CPU ×4) : tuiles seules → −0,3 ms ; tuiles + groupe +
    // scène figés → −1,3 ms (8,6 → 7,2 ms de `composer.render`). Le groupe ne
    // bouge jamais (aucune écriture de sa position dans ce fichier) ; les
    // nuages, qui orbitent, portent leur propre `matrixAutoUpdate` et se
    // recomposent seuls. Toute écriture de `mesh.position` d'une tuile, de la
    // mer ou des parois est suivie d'un `updateMatrix()` explicite.
    // Échappatoire : `?matrices=amont`.
    this._matricesAuto = amontDemande('matrices')
    if (!this._matricesAuto) { this.group.updateMatrix(); this.group.matrixAutoUpdate = false }
    // ══════ PF4 — UN MATÉRIAU POUR TOUTES LES TUILES ═════════════════════════
    // Voir monde/materiau-tuile.js. Échappatoire : `?tuiles=amont`.
    this._tuilesAmont = amontDemande('tuiles')
    this.radius = R_GLOBE
    // L'EXAGÉRATION VERTICALE — Tâche E, « UNE SEULE TERRE ».
    //
    // ⚠️ **`exagSuivie` EST UN DRAPEAU, ET SANS LUI RIEN NE CHANGE.** Le défaut
    // de production reste **18** : c'est la valeur des vues orbitales, celle qui
    // fait exister les crêtes vues de 1 600 km. Sous `?exag=continu`, le globe
    // cesse d'avoir sa propre échelle verticale et LIT le partage
    // (`majExageration` plus bas) — le socle passait le même relief à 2,8, et
    // c'est ce facteur 6,4 (§3 du plan) qui faisait « deux Terres ».
    //
    // ⚠️ `globe.js` N'IMPORTE PAS `flags.js` — même règle que `globeContinu` :
    // le lecteur du drapeau est `src/main.js`, qui ne passe ici qu'un booléen.
    this.exagSuivie = params.exagContinue ?? false
    this.exaggeration = this.exagSuivie
      ? lireExageration(params)
      : (params.globeExaggeration ?? 18)
    this.tiles = new Map() // key → { z,x,y, state, mesh, texture, heights, lastUsed, center, chord }
    this.queue = []
    this.inFlight = 0
    this.frame = 0
    this.enabled = false

    // LE TRI SPATIAL, DERRIÈRE SON DRAPEAU. ⚠️ `globe.js` n'importe pas
    // `flags.js` — délibérément : le lecteur de `FLAGS.globeContinu` est
    // `src/main.js`, qui ne passe ici qu'un booléen.
    this.continu = params.globeContinu ?? false

    // ══════════ LA PLANÈTE N'EST PLUS NUE — règle D15, Tâche R6 ═════════════
    //
    // > **Adrien, 2026-08-23** : « Non, la planète ne doit plus jamais être
    // > nue. »
    //
    // ⚠️ **CE N'EST PAS UN RÉGLAGE DE PLUS : C'EST L'ÉTAT DE REPOS DU MONDE.**
    // Les sept interrupteurs de style valaient zéro par défaut et n'étaient
    // allumés que par la chaîne du crop, donc **treize secondes d'aplat olive**
    // dans la descente qu'Adrien a filmée. Sous ce drapeau, les DEUX postes que
    // la donnée par tuile permet — le zéro de la mer et la normale par fragment
    // — deviennent le défaut. Le départage, et les trois endroits où D15 se
    // trompe, sont démontrés dans `monde/planete-eclairee.js`.
    //
    // ⚠️ `globe.js` N'IMPORTE PAS `flags.js` — même règle que `globeContinu` et
    // `exagContinue` : le lecteur du drapeau est `src/main.js`, qui ne passe
    // ici qu'un booléen.
    //
    // ⚠️ **IL EST LU AVANT `this.uniforms`, ET IL LE FAUT** : la table des
    // uniformes appelle `styleMonde(this.planeteEclairee)` deux fois.
    this.planeteEclairee = params.planeteEclairee ?? false
    // ═══════════ UN CROP EST ATTENDU — Tâche R3 ════════════════════════════
    //
    // **Adrien, 2026-08-23** : « Tu charges beaucoup trop de dalles. […] On ne
    // doit calculer que les dalles qui font partie du socle, et pas ce qui est
    // à l'extérieur du socle. »
    //
    // ⚠️ **CE DRAPEAU EXISTE PARCE QUE `_horsCropSeul` NE PEUT RIEN COUPER
    // AVANT QUE LE CROP SOIT POSÉ, ET QUE C'EST LÀ QUE TOUT SE PERD.** Relevé
    // au navigateur (La Réunion, `?terre=unique&frontiere=1&seuil=1&socle=quadtree`,
    // trois chargements, `_request` instrumenté depuis `window.__exp` —
    // `scripts/sonde-dalles.mjs`) : **114 demandes de tuiles partent AVANT que
    // `poserCrop` ait été appelé**. Le même 114 des deux côtés, mais pas la même
    // part : **114 sur 191 (59,7 %) avec `?globe=continu`** — 4 tirages,
    // `.banc/R3/avant-jalons-A2.json` — et **114 sur 159 (71,7 %) sans**, le
    // régime par défaut — 3 tirages, `.banc/R3/avant-jalons-B.json`. La dernière
    // demande sans crop tombe à l'image **3 à 12** selon le tirage, la première
    // avec crop à l'image **39 à 63**.
    // ⚠️ **CES BORNES SONT DES INTERVALLES PARCE QUE LA TRACE LE DIT.** Une
    // première version de ce commentaire écrivait « image 11 / image 41 », les
    // valeurs d'un tirage, sans qu'aucun fichier ne les porte : la sonde
    // n'enregistrait pas le numéro d'image. Elle l'enregistre.
    // Dont **les 64 tuiles z3,
    // c'est-à-dire la planète entière**, parce que la caméra est déjà à
    // l'altitude du bloc et que le quadtree, lui, ne sait pas encore qu'on ne
    // lui demandera qu'un carré de trois tuiles. Sans `?globe=continu` ces 64
    // tuiles partent TOUTES sur le réseau (63 hors du futur crop) ; avec, la
    // purge de file en absorbe 63 — mais après les avoir créées, enfilées et
    // triées.
    //
    // ⚠️ **CE N'EST PAS `_cropSeul`, ET LES DEUX NE SE REMPLACENT PAS.**
    // `_cropSeul` est un ÉTAT DE REPOS que la veille lève et baisse au fil de
    // l'altitude ; celui-ci est une PROMESSE DE NAISSANCE, posée une fois par
    // `main.js` sous `?terre=unique`, jamais retirée : « ce globe ne servira
    // qu'un crop, ne descends pas tant que tu ne sais pas où il est ».
    //
    // ⚠️ **ET IL RETIENT LA DESCENTE, PAS LE DESSIN.** Les racines z2 restent
    // parcourues et dessinées (voir `_horsCropSeul`) : la planète est là, en
    // gros, sous le voile de chargement — ce qui ne part pas, c'est la descente
    // vers un endroit qu'on n'a pas encore choisi.
    //
    // ⛔ **CE QUE ÇA COÛTE SI LE MNT NE CHARGE JAMAIS** : le crop n'est jamais
    // posé (`majSeuilSocle` sort tant que `largeurBlocM()` vaut 0), donc le
    // globe reste à z2. C'est une DÉCISION, pas un oubli : sous `?terre=unique`
    // le bloc plat est éteint pour de bon, et une planète grossière vaut mieux
    // que le téléchargement d'un hémisphère que personne n'a demandé. Hors du
    // drapeau, rien de tout cela n'existe.
    this._cropAttendu = params.cropAttendu ?? false
    // ⚠️ **ET LA RETENUE N'EST PAS LE DRAPEAU — correction C1.** `_cropAttendu`
    // décrit le RÉGIME (il arme la contre-pression pour toute la session) ;
    // `_cropDejaPose` date le moment où l'on a CESSÉ D'IGNORER où est le crop.
    // Seul le second éteint la retenue de descente, et il ne se rallume jamais :
    // voir `poserCrop` et `_retenueAvantCrop`.
    this._cropDejaPose = false
    // LA FRONTIÈRE DE RENDU — Tâche 1b bis. Posé par `main.js` quand le globe
    // passe dans sa propre scène de fond ; voir `setVisible`, qui cesse alors
    // d'être l'interrupteur. Déclaré ici pour qu'il ne naisse pas `undefined`
    // au détour d'une lecture.
    this.frontiereFond = false
    // LE CROP — Tâche A. `null` = pas de découpe, et c'est l'état de production.
    // Écrit par `poserCrop`, lu par `_traverse` (le raffinement uniforme) ; la
    // découpe elle-même se fait au fragment, par les uniformes `uCrop*`.
    this._crop = null
    // LE FOND DU BLOC — Tâche P4 pour le rideau d'eau, Tâche P7 pour la jupe des
    // tuiles. Déclaré ici pour la raison écrite trois lignes plus haut : qu'il ne
    // naisse pas `undefined` au détour d'une lecture. Écrit par `poserParoisCrop`,
    // REMIS À NUL par `retirerParoisCrop`.
    this._baseYCrop = null
    // LE RETRAIT DE LA BASE DU BLOC — Tâche P13, pour le rideau d'eau. Même
    // raison, même cycle de vie que `_baseYCrop`.
    this._retraitBaseCrop = null
    // LE PLANCHER DES JUPES — Tâche P13, le sommet du congé. Même cycle de vie.
    this._plancherJupeCrop = null
    // LE CROP SEUL — Tâche N, « LE STUDIO SUR LE GLOBE ». `false` = le parcours
    // d'avant, au bit près, et c'est l'état de production. Écrit par
    // `poserCropSeul`, lu par `_traverse` et par lui seul.
    //
    // ⚠️ **CE N'EST PAS UN DOUBLON DE `uEstompage = 1`, ET C'EST TOUTE LA
    // TÂCHE.** L'estompage plein fait mourir le FRAGMENT hors crop ; la tuile,
    // elle, est quand même chargée, maillée et soumise au GPU. Mesuré dans
    // l'application vivante le 2026-08-22 (La Réunion, `?terre=unique`, altitude
    // de bloc 12 686 m, `uEstompage = 1`) : **351 tuiles dessinées, dont 315
    // entièrement hors du crop** — 89,7 % des appels de dessin ne montrent pas
    // un pixel. Données brutes : `.banc/vues-N/AV-repos-bloc.json`.
    this._cropSeul = false
    // LES PAROIS — Tâche B. `null` = le crop est une peau flottante, et c'est
    // l'état d'après la Tâche A. Écrit par `construireParoisCrop`.
    this._parois = null
    // ══════ « AFFICHER LE SOCLE » — Tâche R22, option 48 ═════════════════════
    //
    // ⛔ **LE CURSEUR PILOTAIT UN OBJET QUI N'EST PLUS RENDU.** `params.plinth`
    // va à `plinth.setVisible` (`src/plinth.js`), c'est-à-dire au socle du BLOC
    // PLAT — lequel ne se dessine plus du tout sous la sphère (`socleAffiche()`
    // rend faux, la passe de surface est éteinte). Les parois qu'on voit à
    // l'écran viennent de `parois-crop.js`, et rien ne leur parlait.
    //
    // ⚠️ **C'EST UN ÉTAT RETENU, PAS UN `mesh.visible` POSÉ UNE FOIS**, et c'est
    // le seul montage qui tienne : `construireParoisCrop` FABRIQUE UN MESH NEUF
    // à chaque déplacement (elle balaie plus de mille points de contour). Un
    // `visible = false` posé sur l'ancien mesh serait perdu au premier
    // déplacement, et le socle reviendrait tout seul sans que personne ne
    // touche au curseur — la classe de course que la Tâche K ter a nommée.
    //
    // ⚠️ **ET ON CACHE, ON NE RETIRE PAS.** `retirerParoisCrop` remet à nul
    // `_baseYCrop`, `_retraitBaseCrop`, `_plancherJupeCrop` et
    // `_retraitJupeCrop` — quatre valeurs que le rideau d'eau (Tâche P4) et les
    // jupes de tuiles (P7, P13, P14) LISENT. Retirer les parois pour cacher un
    // socle rallongerait les jupes et poserait le rideau de mer sur un fond
    // deviné : un réglage d'affichage casserait trois géométries voisines.
    this._paroisVisibles = true
    // LA MER — Tâche F. `null` = pas de calotte, et c'est l'état de production :
    // sans `poserMer`, le globe est celui d'avant, au bit près. Même garde que
    // `uCropOn = 0` (Tâche A), `uHabOn = 0` (Tâche C) et `RAMPE_MONDE` (Tâche D).
    this._mer = null
    this._merEtat = null
    // ⚠️ **DÉCLARÉE ICI, ET PAS SEULEMENT ÉCRITE AU VOL** — Tour de correction
    // R2. La cible du grab pass naissait `undefined` : la clôture du rapport
    // annonçait `_merRefractRT: null` alors que la propriété n'existait pas
    // encore. Un champ qui n'existe pas et un champ rendu se lisent pareil
    // depuis la console, et c'est exactement ce qui a masqué la fuite.
    this._merRefractRT = null
    // le budget de cache SUIT le chemin : voir CACHE_MAX_CONTINU
    this.cacheMax = this.continu ? CACHE_MAX_CONTINU : CACHE_MAX
    this._frustum = new THREE.Frustum()
    this._matVue = new THREE.Matrix4()
    this._sphereTuile = new THREE.Sphere()
    this._angleHorizon = 0
    this._rayonCentre = 1
    this._demiEpaisseur = 0
    this._echelleProj = 1 // `projectionMatrix[5]`, posé par `_preparerTriSpatial`
    this._margeRelief = 0 // le déplacement radial maximal du relief, posé par `_preparerTriSpatial`
    this._porteuses = 0 // tuiles PORTEUSES de la couverture à la dernière image
    this._camPos = null // la caméra de la dernière image, lue par `_priorite`
    this._enParcours = false // la pompe se tait pendant `_traverse` — voir `_pump`
    this._visites = 0 // tuiles PARCOURUES à la dernière image (mesure de l'emprise)
    this._refus = 0 // raffinements REFUSÉS faute de crédit à la dernière image
    this._refusPrec = 0 // le `_refus` de l'image PRÉCÉDENTE — voir `_deciderBarriere`
    this._refusFile = 0 // requêtes REFUSÉES par PLAFOND_FILE à la dernière image
    this._purgees = 0 // entrées de file PÉRIMÉES retirées à la dernière image
    // R37 : les parents dessinés PARTIELLEMENT à cette image (masque par
    // quadrant) — leur matériau redevient le partagé à l'image suivante
    this._partiels = new Set()
    this._nPartiels = 0 // parents partiels à la dernière image (mesure)
    this._prelues = 0 // enfants PRÉLUS (demandés avant le seuil) à la dernière image
    this._materiauInvisible = null // le matériau « ne pas dessiner » des quadrants couverts
    // la prélecture ne part qu'en DESCENTE (la direction est connue) — `update`
    // compare la distance de la caméra au centre d'une image à l'autre
    this.prelecture = true
    this.prelectureRatio = PRELECTURE_RATIO // réglable, pour le banc R37
    // les deux autres leviers de R37, débrayables pour l'A/B du banc dans la
    // MÊME session (le pixel n'est comparable qu'ainsi) — levés en production
    this.raffinementPartiel = true
    this.protegerEnfants = true
    // ══════ LA BARRIÈRE D'ORDONNANCEMENT — CIB / D22 ③ ═════════════════════
    //
    // ⛔ **BAISSÉE PAR DÉFAUT, ET C'EST LA MESURE QUI L'A DÉCIDÉ, PAS UNE
    // PRUDENCE.** Le mécanisme est écrit, testé et instrumenté ; ce qu'il fait
    // au chiffre d'Adrien, mesuré en A/B entrelacé sur trois lieux :
    //   · liaison rapide, CPU ×4 — netteté au centre 36,5 → 33,3 s · 43,8 →
    //     48,7 s · 48,9 → 47,6 s, soit le bruit de la durée du geste ; retard
    //     du centre 5,6 → 5,7 · 6,2 → 6,0 · 6,3 → 6,3 % : PLAT ;
    //   · liaison bridée à 1,5 Mb/s (le régime où les six créneaux SONT le
    //     goulot, donc celui que D22 vise) — netteté 21,2 → 40,5 s et 22,0 →
    //     27,1 s, retard du centre **18,5 → 28,4 %** et 17,1 → 57,9 % : la
    //     barrière DÉGRADE le centre, exactement là où elle devait le servir.
    // L'occupation des créneaux, elle, ne tombe pas (93,2 → 92,6 %) : le
    // garde-fou anti-créneau-vide fait son travail, ce n'est pas lui le coupable.
    // La piste (NON vérifiée — voir le rapport) : un parent de périphérie retenu
    // n'engendre pas, donc `_porteuses` baisse, donc la cible du cache SOUPLE
    // (`_porteuses + CACHE_SOUPLE`) baisse, donc l'éviction mord plus — cache
    // max 580 → 543 sur la paire de Chamonix. Ce serait le §5 de
    // `/threejs-optimisation` mot pour mot : deux défauts qui n'en font qu'un,
    // et le second correctif appliqué avant le premier se lit comme une
    // régression. Tant que ce n'est pas mesuré, la barrière reste débrayée.
    this.barriereCible = false
    this._barriereActive = false // décidée en FIN d'image, lue par le parcours SUIVANT
    this._centreEnAttente = 0 // tuiles de la cible que l'image veut et n'a pas
    this._centreEnAttentePrec = Infinity // pour détecter le PROGRÈS du centre
    this._barriereSansProgres = 0 // ms écoulées sans que le centre avance
    this._barriereRefus = 0 // raffinements de périphérie retenus à la dernière image
    this._barriereEcheances = 0 // fois où l'échéance anti-famine a levé la barrière
    this._barriereHorsCreneaux = 0 // images où le centre attend mais les créneaux ne sont pas pourvus
    this._barriereHorsFamine = 0 // images où l'échéance a désarmé la barrière
    this._barriereHorsCredit = 0 // images où c'est le CRÉDIT qui bloque le centre
    this._barriereSansEnfant = 0 // parents de périphérie que la barrière a VU passer
    this._barriereImages = 0 // images pendant lesquelles la barrière a tenu
    this._descend = false
    this._rayonCamPrec = 0
    // zones z8 dont la sonde de couverture est EN VOL — voir `_sonder`
    this._sondes = new Set()
    // tuiles laissées `empty` faute de sonde à la dernière image (Tâche 4 alpha)
    this._attentesSonde = 0
    // ⚠️ LES CLÉS DONT ON GARDE LES HAUTEURS (Tâche 4 bis). `_buildMesh` relâche
    // `t.heights` dès que le maillage est bâti — 256 Kio la tuile, 435 Mo à
    // `CACHE_MAX_CONTINU`, c'est l'Étape 1 de la Tâche 4 sexies et elle ne se
    // rediscute pas. Mais `remplirHauteurs` a besoin de LIRE ces hauteurs sur la
    // seule emprise du socle : `BLOCK_TILES = 3` tuiles de côté, donc **seize
    // tuiles au pire** (4 × 4 quand l'emprise chevauche la grille), soit 4 Mo.
    // C'est le flux qui remplit cet ensemble, personne d'autre.
    //
    // ⚠️ **ET CE N'EST PAS QU'UNE GARDE DE HAUTEURS : C'EST LA RÉSERVATION DU
    // FLUX.** Les tuiles du socle ne sont demandées par PERSONNE dans
    // `_traverse` — le quadtree ne descend à `ZOOM_SOCLE` que si la caméra l'y
    // amène, et le socle, lui, doit se remplir tout de suite (décision du §3 de
    // `seuil-socle.js` : « il n'ATTEND pas »). Elles n'ont donc jamais
    // `lastUsed === frame`, et sans réservation la purge de file les jetterait à
    // l'image suivante, l'éviction juste après. Trois mécanismes la respectent :
    // `_purgerFile`, `_evictJusqua` et `_buildMesh`.
    this.gardeHauteurs = new Set()
    // clé → image du dernier abandon. Voir IMAGES_QUARANTAINE.
    this._echoue = new Map()

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.5).normalize() },
      uShadowColor: { value: new THREE.Color(params.bgColorA ?? '#dfe3ea') },
      // LE PLANCHER DE NUIT — Tache R7, tour de correction. Ces deux valeurs-ci
      // sont NEUTRES : uNuitFond suit uShadowColor tant que setNuitPlanete n'a
      // pas demande de le refroidir, et uNuitCarte = 0,10 rend l'expression
      // d'avant AU BIT PRES. C'est main.js qui les change, sous le drapeau
      // soleilHeureMonde et lui seul — la valeur vient de
      // monde/soleil-monde.js (plancherNuitMonde), qui dit pourquoi.
      uNuitFond: { value: new THREE.Color(params.bgColorA ?? '#dfe3ea') },
      uNuitCarte: { value: 0.10 },
      uInk: { value: new THREE.Color(params.contourColor ?? '#000000') },
      // ⚠️ **CES DEUX-LÀ VIENNENT DE `HABILLAGE_MONDE`, ET C'EST UN CORRECTIF DU
      // TOUR 1.** Ils sont PARTAGÉS et le bloc des courbes les lit **SANS
      // GARDE** : `uHabOn` à 0 ne les neutralise pas. `poserHabillage` les
      // écrasait et `retirerHabillage` ne les rendait pas — la planète entière
      // gardait l'intervalle du crop. Une seule écriture, lue par le
      // constructeur ET par `retirerHabillage`.
      uContourInterval: { value: HABILLAGE_MONDE.contourIntervalM },
      uContourOpacity: { value: HABILLAGE_MONDE.contourOpacite },
      uGraticuleOpacity: { value: 0.16 },
      // ══════ LA GRILLE DE RELEVÉ DU BLOC — Tâche R22, options 19 et 20 ══════
      //
      // ⚠️ **`uGridOpacity: 0` : sans `poserHabillage`, RIEN NE CHANGE** — même
      // garde et même raison que `uCropOn`, `uHabOn` et `uMerRampeOn`. Le bloc
      // de grille du nuanceur est franchi sans peindre, et le graticule lat/lon
      // de la vue orbitale — qui est une AUTRE grille, celle de la planète —
      // reste seul à l'écran, au bit près.
      //
      // ⚠️ **ET LES TROIS AUTRES SONT DÉCLARÉS ICI, PAS SEULEMENT POSÉS PAR
      // `poserHabillage`** : `uGridColor` est un `THREE.Color`, donc son porteur
      // doit exister avant le premier `.set()`, et `uGridStepM` / `uCropDemiM`
      // sont lus par la garde elle-même. C'est le patron d'`uParoiCouleur`, que
      // ce fichier documente vingt lignes plus bas pour avoir été codé en dur.
      uGridStepM: { value: HABILLAGE_MONDE.gridPasM },
      uGridOpacity: { value: HABILLAGE_MONDE.gridOpacite },
      uGridColor: { value: new THREE.Color(HABILLAGE_MONDE.gridCouleur) },
      uCropDemiM: { value: 0 },
      // LA RAMPE — Tâche D, « la rampe se calcule sur le crop ». ⚠️ **LES QUATRE
      // VALEURS VIENNENT DE `RAMPE_MONDE`, PAS DE QUATRE LITTÉRAUX** : `5600` et
      // `6000` étaient écrits ici et nulle part ailleurs ; `retirerRampe` en
      // aurait fait une seconde copie, et une constante dupliquée diverge en
      // silence (§1 de `/threejs-optimisation`, question 2).
      //
      // ⚠️ **ET CES QUATRE-LÀ SONT PARTAGÉS**, comme les cinq du crop et les
      // quatorze de l'habillage : ils vivent dans `this.uniforms`, que
      // `_materialFor` étale dans chaque matériau. C'est LA mécanique de « les
      // alentours la suivent » — il n'y a qu'une rampe, donc pas de couture.
      uOceanDepth: { value: RAMPE_MONDE.profondeur },
      uLandMax: { value: RAMPE_MONDE.terreHaut },
      uLandBas: { value: RAMPE_MONDE.terreBas },
      // ⚠️ **DÉRIVÉ DE `RAMPE_MONDE`, JAMAIS ÉCRIT EN DUR** — Tâche P11. C'est
      // la même discipline que les quatre du dessus : « une constante dupliquée
      // diverge en silence ». `terreBas − creux` vaut `−6 000`, c'est-à-dire
      // `−profondeur`, c'est-à-dire l'ancre que le nuanceur portait avant.
      uReliefBas: { value: RAMPE_MONDE.terreBas - RAMPE_MONDE.creux },
      uPlancherRampeM: { value: RAMPE_MONDE.plancherM },
      uRamp: { value: null },
      // LA RAMPE NAUTIQUE — Tâche F. ⚠️ `uMerRampeOn: 0` : sans `poserMer`, RIEN
      // NE CHANGE — même garde et même raison que `uCropOn` et `uHabOn`. Les
      // trois couleurs sont celles de `terrain.js:376-378`, au caractère près.
      uMerRampeOn: { value: 0 },
      uMerFondBudgetM: { value: RAMPE_MONDE.profondeur },
      // LE ZÉRO DE LA MER — Tâche K bis. ⚠️ **`uMerZeroSousEau: 0` : sans
      // `poserRampe({ zeroSousEau: true })`, RIEN NE CHANGE** — même garde et
      // même raison que `uCropOn`, `uHabOn`, `uMerRampeOn` et `uMppFacteur`.
      //
      // ⚡ **SAUF SOUS D15 — Tâche R6.** `styleMonde(this.planeteEclairee)` rend
      // 1 quand la planète ne doit plus être nue : le correctif du zéro devient
      // l'ÉTAT DE REPOS du monde au lieu d'un cadeau du crop. Drapeau baissé, il
      // rend 0 et cette ligne est celle du dépôt, au bit près.
      uMerZeroSousEau: { value: styleMonde(this.planeteEclairee).merZeroSousEau },
      uOceanShallow: { value: new THREE.Color(RAMPE_NAUTIQUE.peu) },
      uOceanMid: { value: new THREE.Color(RAMPE_NAUTIQUE.moyen) },
      uOceanDeep: { value: new THREE.Color(RAMPE_NAUTIQUE.fond) },
      // LE CROP — Tâche A, « UNE SEULE TERRE ». ⚠️ `uCropOn: 0` : sans
      // `poserCrop`, RIEN NE CHANGE. Ces cinq-là sont PARTAGÉS (ils vivent dans
      // `this.uniforms`, que `_materialFor` étale dans chaque matériau) : le
      // crop est une propriété du monde, pas de la tuile — contrairement à
      // `uTex` et `uTilePx`, qui sont propres à chacune.
      // LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K. ⚠️ **`uMppFacteur: 0` :
      // sans `poserLoiMonde`, RIEN NE CHANGE** — même garde et même raison que
      // `uCropOn`, `uHabOn` et `uMerRampeOn`. Ces quatre-là sont PARTAGÉS (ils
      // vivent dans `this.uniforms`, que `_materialFor` étale dans chaque
      // matériau) : la loi est une propriété du MONDE, pas de la tuile — c'est
      // le sujet même de la tâche, et la mettre par tuile la referait mentir.
      uMppFacteur: { value: 0 },
      uResRefM: { value: 1 },
      uGrainParPixel: { value: GRAIN_PAR_PIXEL },
      uMetresParDegre: { value: METRES_PAR_DEGRE },
      uCropOn: { value: 0 },
      uCropCentre: { value: new THREE.Vector2(0, 0) },
      uCropDemi: { value: 1 },
      uCropCoin: { value: 0 },
      uCropCoinN: { value: 2 },

      // L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3.
      //
      // ⚠️ `uEstompageOn: 0` : sans `poserEstompage`, RIEN NE CHANGE — même
      // garde et même raison que `uCropOn`. Ces deux-là sont PARTAGÉS au sens
      // le plus fort du chantier : ils vivent dans `this.uniforms`, que
      // `_materialFor` étale dans chaque matériau de tuile, **et les deux
      // MÊMES OBJETS sont passés à l'atmosphère et aux deux calottes**. Une
      // seule écriture couvre les trois nuanceurs — il ne peut pas y avoir de
      // désaccord entre le ciel et le sol.
      //
      // ⚠️ **ET `uEstompage` PART À 1, PAS À 0.** C'est le comportement de la
      // Tâche A — « les tuiles cessent d'être dessinées hors du crop » — et
      // c'est ce que `retirerEstompage` remet. Le zéro (la planète entière) est
      // l'état NEUF, celui qu'une descente doit quitter.
      uEstompageOn: { value: 0 },
      uEstompage: { value: 1 },

      // L'HABILLAGE — Tâche C, « le globe prend le rendu du socle ».
      //
      // ⚠️ `uHabOn: 0` : sans `poserHabillage`, RIEN NE CHANGE — même garde et
      // même raison que `uCropOn`. Ces quatorze-là sont PARTAGÉS (ils vivent
      // dans `this.uniforms`, que `_materialFor` étale dans chaque matériau) :
      // l'habillage est une propriété du CROP, pas de la tuile.
      //
      // ⚠️ **LES TROIS SAMPLERS SONT DÉCLARÉS MÊME À VIDE, ET C'EST MESURÉ, PAS
      // NÉGLIGÉ.** `test/plafond-unites-texture.test.js` raconte le jour où le
      // terrain a disparu : 18 samplers pour un plafond de 16, parce qu'un
      // `if (uSolOn > 0.5)` ne supprime pas un sampler — le compilateur ne
      // connaît la valeur d'un uniform qu'à l'exécution. Le nuanceur du globe
      // est un `ShaderMaterial` NU : ni matériau de surface, ni environnement,
      // ni carte d'ombre. Le compte y passe de **deux** (uTex, uRamp) à
      // **cinq**, sur seize. Le `#ifdef` du socle aurait coûté une
      // recompilation de chaque matériau de tuile à chaque bascule de couche.
      uHabOn: { value: 0 },
      uCoastMask: { value: null },
      uCoastMaskOn: { value: 0 },
      uMargeCoteM: { value: HABILLAGE_MONDE.margeCoteM },
      uSol: { value: null },
      uSolLut: { value: null },
      uSolOn: { value: 0 },
      uSolOpacite: { value: HABILLAGE_MONDE.solOpacite },
      uSolOffset: { value: new THREE.Vector2(0, 0) },
      uSolScale: { value: new THREE.Vector2(1, 1) },
      uSolTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
      uGrainForceM: { value: HABILLAGE_MONDE.grainForceM },
      uGrainEchelle: { value: HABILLAGE_MONDE.grainEchelle },
      uContourWeight: { value: HABILLAGE_MONDE.contourPoids },
      // ══════ LA PHOTO AERIENNE — Tâche R9 ═══════════════════════════════════
      //
      // ⚠️ **`uAerialOn: 0` : sans `poserHabillage`, RIEN NE CHANGE** — même
      // garde et même raison que `uCropOn`, `uHabOn` et `uSolOn`.
      //
      // ⚠️ **`null` AU REPOS, COMME `uCoastMask`, `uSol` ET `uAnalysis` — ET PAS
      // COMME `terrain.js`.** Le socle pose une texture noire 1×1 (« never null:
      // a null sampler fails to compile on some drivers ») parce que ses
      // samplers vivent dans un `MeshStandardMaterial` étendu ; le globe, lui,
      // porte déjà **trois** samplers d'habillage à `null` en production depuis
      // les Tâches C et P2, sur le même `ShaderMaterial`. Poser ici une
      // quatrième convention aurait fabriqué deux règles pour un seul nuanceur.
      uAerial: { value: null },
      uAerialOn: { value: 0 },
      uAerialOpacity: { value: HABILLAGE_MONDE.aerialOpacite },
      uAerialOffset: { value: new THREE.Vector2(0, 0) },
      uAerialScale: { value: new THREE.Vector2(1, 1) },
      uAerialCoastFade: { value: HABILLAGE_MONDE.aerialCoastFade },
      // ══════ LA PHOTO SUR LA SURFACE — Tâche R16 ═══════════════════════════
      //
      // ⚠️ **CELUI-CI EST PARTAGÉ, ET LUI SEUL.** L'opacité est une propriété de
      // la COUCHE, pas de la tuile : une seule écriture (`setPhotoMonde`) éteint
      // ou allume la planète entière, sans couture possible entre deux tuiles.
      // Les trois autres (`uPhoto`, `uPhotoOn`, `uPhotoUv`) vivent dans
      // `_materialFor` — voir le bloc qui les déclare.
      //
      // ⚠️ **`0` AU REPOS : sans `setPhotoMonde`, RIEN NE CHANGE** — même garde
      // et même raison que `uCropOn`, `uHabOn`, `uAerialOn` et `uMppFacteur`.
      uPhotoMonde: { value: 0 },
      // ⚠️ **CELUI-LÀ N'EST PAS NEUTRE À ZÉRO, ET C'EST VOULU** : c'est une
      // ÉCHELLE de la couche, pas un interrupteur. `uPhotoMonde` porte déjà
      // l'extinction ; un fondu à zéro ne servirait qu'à peindre l'océan en noir
      // le jour où quelqu'un allume la couche sans lire ce bloc.
      uPhotoFonduMer: { value: FONDU_MER_MONDE },
      // LA NORMALE PAR FRAGMENT — Tâche P9. ⚠️ **`uNormaleFineOn: 0` : sans
      // `poserHabillage`, RIEN ne change** — même garde et même raison que
      // `uCropOn`, `uHabOn`, `uMerRampeOn`, `uEclairageOn` et `uMppFacteur`.
      // ⚠️ **ET `uUnitesParMetre` N'A PAS DE « NEUTRE » : c'est une ÉCHELLE, pas
      // un réglage.** Elle est juste dès la construction et suit l'exagération
      // (`setExaggeration`), parce qu'une échelle fausse ne se voit pas — elle
      // rend juste des pentes fausses, et c'est exactement la faute que
      // `uMerHoule` (121,6× trop haute) et `skirtDrop` (10× trop long) ont
      // coûtée à ce chantier.
      //
      // ⚡ **SAUF SOUS D15 — Tâche R6, ET C'EST LE POSTE QUI RHABILLE LA
      // PLANÈTE.** Hors du crop, la seule lumière est
      // `col × (0.74 + 0.30 × diff)` avec `diff = dot(nMonde, uSunDir)` : tant
      // que `nMonde` est la normale des SOMMETS (24 quads par tuile), `diff` ne
      // décrit que la courbure de la sphère, et la terre est un aplat. Mesuré à
      // la sonde de descente (`.banc/R6/avant.json`) : l'écart-type de
      // luminance tombe de 28,3 en orbite à **14,2 à 33 000 m**, puis remonte à
      // **29,0 dès que le crop naît** — le style s'allumait AU SEUIL.
      uNormaleFineOn: { value: styleMonde(this.planeteEclairee).normaleFine },
      uUnitesParMetre: { value: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration },

      // L'OMBRAGE DE RELIEF DE LA PLANÈTE — règle D15, Tâche R6.
      //
      // ⚠️ **`uReliefMondeGain: 0` HORS DRAPEAU : `ombreRelief` reste à 1.0 et
      // `colPlanete` est celle du dépôt AU BIT PRÈS.** C'est une garde DOUBLE —
      // le bloc n'est même pas atteint sans `uNormaleFineOn` — et c'est
      // délibéré : ce poste multiplie la couleur de TOUTE la planète, donc son
      // neutre doit être vérifiable sans exécuter le GPU.
      //
      // ⚠️ **LES ANGLES SONT CONVERTIS ICI, EN RADIANS.** Le nuanceur ne fait
      // aucune conversion d'unité : c'est la faute qui a coûté quatre fois à ce
      // chantier (`uMerHoule` 121,6× trop haute, `skirtDrop` 10× trop long).
      uReliefMondeGain: { value: this.planeteEclairee ? RELIEF_MONDE.gain : RELIEF_MONDE_NUL },
      uReliefMondeAz: { value: (RELIEF_MONDE.azimutDeg * Math.PI) / 180 },
      uReliefMondeEl: { value: (RELIEF_MONDE.elevationDeg * Math.PI) / 180 },

      // LE FOND DU CROP — Tâche J bis.
      //
      // ⚠️ `uFondOn: 0` : sans `poserFondCrop`, RIEN NE CHANGE — même garde et
      // même raison que `uCropOn`, `uEstompageOn` et `uHabOn`. Partagés eux
      // aussi : le fond est une propriété du CROP, pas de la tuile.
      //
      // ⚠️ **`uFondMetres` PART À 1 ET NON À 0** : c'est un DIVISEUR déguisé (le
      // champ est cuit en unités locales, `brut × echelle`), et un zéro par
      // défaut rendrait un fond marin plat au niveau de la mer le jour où
      // quelqu'un allumerait `uFondOn` sans poser l'échelle.
      uFondChamp: { value: null },
      uFondOn: { value: 0 },
      uFondPortee: { value: PORTEE_CROP },
      uFondMetres: { value: 1 },
      // ⚠️ **`uFondPasQ` PART À ZÉRO, ET C'EST LE DÉPÔT AU BIT PRÈS** — Tâche
      // R17. Le nuanceur en fait `max(1 / uTilePx, 0)`, c'est-à-dire le pas de
      // P12. `_poserTextureFond` l'écrit avec la cellule réelle du champ.
      uFondPasQ: { value: 0 },

      // LA COLORISATION NATURELLE — Tâche P2.
      //
      // ⚠️ **`uAnalysisOn: 0` ET `uRampCropOn: 0` : sans `poserHabillage`, RIEN
      // NE CHANGE** — même garde et même raison que `uCropOn`, `uHabOn`,
      // `uMerRampeOn` et `uFondOn`. Le nuanceur est PARTAGÉ par toutes les
      // tuiles de la planète, y compris celles qui ne verront jamais de crop.
      //
      // ⚠️ **ET LES CURSEURS LISENT `NATUREL_MONDE`, ILS NE RECOPIENT PAS SES
      // NOMBRES.** C'est la discipline de `HABILLAGE_MONDE` et de `RAMPE_MONDE` :
      // une seule écriture, lue par le constructeur ET par `retirerHabillage`.
      // Deux littéraux jumeaux avaient déjà divergé en silence une fois sur ce
      // chantier (`uContourInterval`, réparé par la Tâche C au tour 1).
      //
      // ⚠️ **`heightContrast: 1` ET `heightPivot: 0,5` NE SONT PAS UN GOÛT** :
      // `natRampT(hNorm, 0.5, 1.0)` rend `hNorm` **au bit près**, donc la loi
      // elle-même est neutre au repos — la garde `uRampCropOn` n'est pas le seul
      // filet, et `test/crop-naturel.test.js` le prouve sur un balayage.
      uAnalysis: { value: null },
      uAnalysisOn: { value: 0 },
      // ⚡ **AU REPOS DU MONDE, PAS À ZÉRO — Tâche R28.** Même patron et même
      // raison que `uNormaleFineOn` et `uMerZeroSousEau` : sous D15 le peigne
      // des crêtes est un poste de la PLANÈTE, pas du crop. `MONDE_NU.texShade`
      // vaut `NATUREL_MONDE.texShade`, donc drapeau baissé c'est le dépôt au bit
      // près, et `test/planete-eclairee.test.js` interdit aux deux de diverger.
      uTexShade: { value: styleMonde(this.planeteEclairee).texShade },
      uWetK: { value: NATUREL_MONDE.wetK },
      uExpoK: { value: NATUREL_MONDE.expoK },
      uHemi: { value: NATUREL_MONDE.hemi },
      uTreeLine: { value: NATUREL_MONDE.treeLine },
      uRampCrop: { value: null },
      uRampCropOn: { value: 0 },
      uHeightContrast: { value: NATUREL_MONDE.heightContrast },
      uHeightPivot: { value: NATUREL_MONDE.heightPivot },
      // ⚠️ **`uRecollage: 0` : SANS ALTITUDE, RIEN NE CHANGE** — Tâche R31,
      // même discipline que `uCropOn: 0` (Tâche A), `uHabOn: 0` (Tâche C) et
      // `uRampCropOn: 0` (Tâche P2). Le nuanceur écrit `mix(rampT, rampTMonde,
      // uRecollage)`, et `mix(x, y, 0.0)` vaut `x·1 + y·0` : le chemin des
      // bancs et du réglage manuel (`poserRampe({ echelle })`, sans altitude)
      // rend donc l'image d'avant **au bit près**, et `crop-rampe.test.js` ⑧
      // l'exige sur un balayage plutôt que de le promettre.
      uRecollage: { value: 0 },
      uHazeAmt: { value: NATUREL_MONDE.hazeAmt },
      uHazeAlt: { value: NATUREL_MONDE.hazeAlt },
      uHazeDist: { value: NATUREL_MONDE.hazeDist },
      uHazeColor: { value: new THREE.Color(NATUREL_MONDE.hazeColor) },
      // ══════ L'ÉCLAIRAGE DU CROP — Tâche P3 ═══════════════════════════════
      //
      // ⚠️ **LES DÉFAUTS SONT CEUX DU MODULE, PAS DES NOMBRES RECOPIÉS ICI** —
      // même discipline que `NATUREL_MONDE` et `HABILLAGE_MONDE` : deux jeux de
      // défauts qui divergeraient, c'est un aller-retour bit-à-bit qui ment.
      uEclairageOn: { value: 0 },
      uSoleilDir: { value: new THREE.Vector3(0, 1, 0) },
      uSoleilIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.soleilIrr) },
      uHemiHaut: { value: new THREE.Vector3(0, 1, 0) },
      uCielIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.cielIrr) },
      uSolIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.solIrr) },
      // ══════ L'APPOINT ET L'OMBRAGE DES PENTES — Tâche R21 ═════════════════
      //
      // ⚠️ **LES TROIS PARTENT DE `lumiere-sphere.js`, PAS D'UN LITTÉRAL.**
      // C'est le contrat qu'`⑨i` de `test/crop-habillage.test.js` impose déjà à
      // huit autres : un défaut recopié dans le constructeur ET dans
      // `retirerHabillage` finit par diverger, et l'aller-retour bit à bit
      // devient faux sans prévenir.
      uAppointDir: { value: new THREE.Vector3().fromArray(APPOINT_MONDE_ETEINT.dir) },
      uAppointIrr: { value: new THREE.Vector3().fromArray(APPOINT_MONDE_ETEINT.irr) },
      uSlopeTint: { value: PENTE_MONDE_NULLE },
      // ══════ L'AMBIANTE PROPRE À LA PAROI — Tâche P8 ═══════════════════════
      //
      // ⛔ **DEUX AMBIANTES ET NON UNE, PARCE QUE LE SOCLE EN A DEUX.** Le
      // relief voit `scene.environment` (« the neutral room env ») ; la paroi
      // voit `wallMat.envMap` (« their own studio env map »), et `three`
      // n'applique `scene.environmentIntensity` qu'aux matériaux SANS `envMap` à
      // eux. La démonstration, les deux relevés et les deux témoins sont à
      // `environnementEffectif` (`monde/eclairage-crop.js`).
      //
      // ⚠️ **LE DÉFAUT EST CELUI DES TUILES, PAS ZÉRO.** Sans donnée de paroi,
      // `poserHabillage` y recopie `uCielIrr`/`uSolIrr` : l'image d'avant cette
      // tâche est alors rendue AU BIT PRÈS. Un zéro aurait fait une paroi noire
      // chez tout appelant qui ne connaît pas encore ces deux champs.
      uParoiCielIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.cielIrr) },
      uParoiSolIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.solIrr) },
      uAlbedoBase: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.albedoBase) },
      uAlbedoTeinte: { value: ECLAIRAGE_MONDE.albedoTeinte },
      // ══════ LA MATIÈRE DU RELIEF — Tâche R25, option 38 ═══════════════════
      //
      // ⚠️ **LES DÉFAUTS PARTENT DE `matiere-crop.js`, PAS D'UN LITTÉRAL** —
      // même contrat qu'⑨i impose à l'appoint, aux pentes et à la paroi : un
      // défaut recopié ici ET dans `retirerHabillage` finit par diverger, et
      // l'aller-retour bit à bit devient faux sans prévenir.
      //
      // ⚠️ **`null` POUR LES DEUX TEXTURES, comme `uCoastMask` / `uSol` /
      // `uAerial` / `uAnalysis`** : `three` lie alors sa texture vide, et
      // `uMatOn = 0` garantit qu'on ne l'échantillonne jamais.
      uMatOn: { value: MATIERE_MONDE_ETEINTE.on },
      uMatMap: { value: null },
      uMatNormal: { value: null },
      uMatNormalOn: { value: MATIERE_MONDE_ETEINTE.normalOn },
      uMatRepeat: { value: MATIERE_MONDE_ETEINTE.repeat },
      uMatBump: { value: MATIERE_MONDE_ETEINTE.bump },
      uMatNoiseOn: { value: MATIERE_MONDE_ETEINTE.noiseOn },
      uMatNoiseCut: { value: MATIERE_MONDE_ETEINTE.noiseCut },
      uMatNoiseSoft: { value: MATIERE_MONDE_ETEINTE.noiseSoft },
      uMatNoiseScale: { value: MATIERE_MONDE_ETEINTE.noiseScale },
      uMatAboveZero: { value: MATIERE_MONDE_ETEINTE.aboveZero },
      uMatBandeM: { value: MATIERE_MONDE_ETEINTE.bandeM },
      // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════
      uSurfaceFx: { value: APPARENCE_MONDE.surfaceFx },
      uFxBlend: { value: APPARENCE_MONDE.fxBlend },
      uFxOpacite: { value: APPARENCE_MONDE.fxOpacity },
      uFxScale: { value: APPARENCE_MONDE.fxScale },
      uFxTime: { value: APPARENCE_MONDE.fxTime },
      uFxColA: { value: new THREE.Color(APPARENCE_MONDE.fxColA) },
      uFxColB: { value: new THREE.Color(APPARENCE_MONDE.fxColB) },
      uFxColC: { value: new THREE.Color(APPARENCE_MONDE.fxColC) },
      uFxP1: { value: APPARENCE_MONDE.fxP1 },
      uFxP2: { value: APPARENCE_MONDE.fxP2 },
      uFxP3: { value: APPARENCE_MONDE.fxP3 },
      uFxDemiBloc: { value: APPARENCE_MONDE.fxDemiBloc },
      uFxFenetre: { value: new THREE.Vector2(APPARENCE_MONDE.fxFenetreX, APPARENCE_MONDE.fxFenetreY) },
      // ══════ LA COULEUR DES PAROIS DU BLOC — Tâche P3, manque n° 2 ═════════
      //
      // ⛔ **ELLE ÉTAIT CODÉE EN DUR DANS `_materiauParois`, ET C'ÉTAIT FAUX PAR
      // CONSTRUCTION.** `#d8d4cc` est le DÉFAUT de `params.plinthColor` ; la
      // paroi vivante du socle, elle, vaut ce que `plinth.setColors` a posé —
      // et `setColors` ne prend `params.plinthColor` QUE si le socle n'est ni en
      // verre ni sur un préréglage PBR. Relevé le 2026-08-22 **au même instant,
      // dans la même page** (c'est le protocole du noteur, et il compte : deux
      // chargements n'ont pas la même palette) : `params.plinthColor = #d8d4cc`,
      // `plinth.wallMat.color = c06a44` — un terracotta. Écart RGB (24, 106,
      // 136). **Le crop peignait une couleur que le socle n'utilise plus.**
      //
      // ⚠️ **ET ELLE VIT DANS `this.uniforms`, PAS DANS LE MATÉRIAU DES PAROIS,
      // POUR DEUX RAISONS QUI SE CUMULENT** : le matériau est REFAIT à chaque
      // reconstruction des parois (donc une couleur posée dessus se perdrait au
      // prochain déplacement), et la palette change sans que les parois soient
      // rebâties (`applyPalette` → `plinth.setColors`). C'est le patron de
      // `rampe2D`, qui change d'identité à chaque palette.
      uParoiCouleur: { value: new THREE.Color('#d8d4cc') },
    }
    // ⚠️ **LE FOND VIT À CÔTÉ DES UNIFORMES, PAS DEDANS** : c'est un
    // `Float32Array` de 148 225 valeurs (593 Kio) que le CPU lit — `posAt` et
    // `hauteurSurface` —, pas une texture. `null` = pas de fond, et toute la
    // chaîne le sait (voir `src/monde/fond-crop.js`).
    this._fondCrop = null
    // L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. ⚠️ **UN ÉCRIVAIN, N
    // LECTEURS**, et le repli est `RAMPE_MONDE` : tant que personne n'ancre de
    // mesure, `lireEchelle` rend l'échelle mondiale et les quatre uniformes
    // valent ce qu'ils valaient. `poserRampe` et `poserMer` ANCRENT ;
    // `majEchelleRampe` évalue la courbe et POSE. Personne d'autre n'écrit.
    this._echelleContinue = creerEchelleContinue(RAMPE_MONDE)
    // LA COLORISATION NATURELLE HORS CROP — Tâche R11. ⚠️ **`null` = LE GLOBE
    // D'AVANT, AU BIT PRÈS** : tant que personne n'appelle `poserRampeMonde`,
    // `retirerHabillage` rend `NATUREL_MONDE` comme il l'a toujours fait, et
    // `uRampCropOn` retombe à zéro. Même discipline que `uCropOn: 0` (Tâche A)
    // et `uHabOn: 0` (Tâche C).
    this._rampeMonde = null
    this._cleFondPosee = ''
    this.rebuildRamp(params)

    // ⚠️ `uTilePx` EST PROPRE À LA TUILE, comme `uTex` : deux tuiles voisines
    // peuvent venir de deux sources de tailles différentes (voir `planTuile`).
    // Le mettre dans `this.uniforms`, partagé, aurait fait juger la minification
    // de toutes les tuiles sur la taille de la dernière chargée.
    // ⚠️ PF4 : UN SEUL matériau pour toutes les tuiles (monde/materiau-tuile.js) ;
    // ce qui est propre à la tuile est posé par `onBeforeRender`. La signature
    // de `_materialFor` reste (texture, tilePx, uvParMonde) : les tests
    // l'empruntent, et `?tuiles=amont` rend l'ancien matériau par tuile. Le
    // littéral du matériau reste ici, sous `_materialFor`, avec ses uniformes
    // propres (`uTex`, `uTilePx`, `uUvParMonde`, `uPhoto*`) : c'est le texte
    // que test/photo-monde.test.js ⑦ relit.
    this._materialFor = (texture, tilePx = 256, uvParMonde = 1) => this._fabriqueMateriau.pour(texture, tilePx, uvParMonde)
    const materiauTuile = (texture, tilePx, uvParMonde) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...this.uniforms,
          uTex: { value: texture },
          uTilePx: { value: tilePx },
          // ⚠️ **PROPRE À LA TUILE POUR LA MÊME RAISON QUE `uTilePx`** : c'est
          // `1 / 2^z`, la fraction du monde Mercator qu'une unité d'`uv` couvre.
          // Partagée, elle ferait juger la pente de toutes les tuiles sur le
          // niveau de la dernière chargée. **Le défaut `1` est le niveau ZÉRO** :
          // une tuile sans niveau déclaré rend une pente 4 096 fois trop faible,
          // donc un bloc PLAT — visible, pas silencieux.
          uUvParMonde: { value: uvParMonde },
          // ══════ LA PHOTO DE LA SURFACE — Tâche R16 ═══════════════════════
          //
          // ⚠️ **PROPRES À LA TUILE, POUR LA MÊME RAISON QUE `uTex` ET
          // `uTilePx`, ET C'EST LE PIÈGE ④ DU BRIEF PRIS PAR LE BON BOUT.**
          // Le nuanceur ne gagne qu'UN sampler (neuf → dix sur seize) ; ce qui
          // varie d'une tuile à l'autre, c'est la VALEUR liée au moment du
          // dessin. Les mettre dans `this.uniforms` ferait peindre toutes les
          // tuiles avec la photo de la dernière chargée — exactement la faute
          // que le commentaire d'`uTilePx` décrit deux lignes plus haut.
          //
          // ⚠️ `uPhotoOn: 0` AU REPOS : une tuile qui n'a pas encore de photo
          // est la planète du dépôt, au bit près. `photoMonde.habiller` est le
          // SEUL écrivain, et il tourne après le tri spatial de `_traverse`.
          uPhoto: { value: null },
          uPhotoOn: { value: 0 },
          uPhotoUv: { value: new THREE.Vector4(0, 0, 1, 1) },
        },
        // LE MÉLANGE SUIT LE CROP — Tâche B, Étape 5. ⚠️ **PAS TOUJOURS VRAI, ET
        // C'EST LA PRODUCTION QU'ON PROTÈGE** : `transparent` fait passer l'objet
        // dans la liste TRIÉE du moteur, derrière les opaques. Sans crop, la
        // couverture vaut 1 partout et le mélange ne servirait qu'à changer
        // l'ordre de dessin de 750 tuiles pour rien.
        transparent: !!this._crop,
        // ⚠️ **ET LA PROFONDEUR RESTE ÉCRITE.** C'est ce qui rend le régime
        // transparent indolore ici : à l'intérieur du crop l'alpha vaut
        // exactement 1, donc le mélange est l'identité, et le tri arrière-avant
        // du moteur dessine le lointain d'abord — c'est justement l'ordre qu'il
        // faut pour que le liseré du bord se fonde sur ce qui est derrière.
        depthWrite: true,
      })

    this._fabriqueMateriau = creerFabriqueMateriau({ creer: materiauTuile, amont: this._tuilesAmont })

    this._buildPoleCaps()
    this._buildAtmosphere()

    // ══════ L'IMAGERIE DE LA SURFACE — Tâche R16 ═══════════════════════════
    //
    // ⛔ **PAS UN SECOND SYSTÈME DE TUILES.** Le cache ci-dessous ne décide RIEN
    // de spatial : `_traverse` lui passe les tuiles qu'il a retenues (horizon +
    // tronc de vue) ET dessinées, et il leur trouve une photo. Le tri spatial,
    // le niveau de détail par distance, la règle sans-trou et la purge sont ceux
    // du quadtree, au sens strict — c'est la consigne du brief, et c'est aussi
    // ce qui rend l'ensemble mesurable d'un seul endroit.
    //
    // ⚠️ **ÉTEINT AU REPOS** (`actif = false`) : sans `setPhotoMonde`, il ne part
    // pas une requête et `uPhotoMonde` reste à zéro — la planète est celle du
    // dépôt, au bit près. C'est `main.js` qui l'allume, sur le bouton d'Adrien.
    this.photoMonde = new PhotoMonde({ charger: chargerPhotoTuile })

    // orbiting cloud cover — lives inside group so globe.setVisible rules it
    this.clouds = new GlobeClouds(R_GLOBE)
    this.group.add(this.clouds.group)

    // LES 16 TUILES RACINES — DÉCLARÉES ICI, DEMANDÉES PLUS TARD.
    //
    // Elles pesaient 1 401 Ko (mesuré : 16 PNG terrarium z2 chez AWS) et
    // partaient du CONSTRUCTEUR, à priorité 1e9 — c'est-à-dire en tête de file,
    // alors que main.js appelle `globe.setVisible(false)` la ligne suivante.
    // Elles se battaient donc pour la bande passante avec les 2 231 Ko de MNT
    // dont la CARTE, elle, a besoin pour s'afficher.
    //
    // A/B mesuré (dist de production servi, Chrome avec écran, cache vidé,
    // 3 runs, 3 Mb/s) en bloquant ces 16 tuiles au niveau réseau :
    //   carte visible 16 156 ms → 12 426 ms, octets 4 511 Ko → 3 103 Ko.
    //
    // ⚠️ ON NE LES SUPPRIME PAS, ON LES DÉCALE. L'intention d'origine — « entering
    // orbit never shows a bare sphere » — reste vraie, et par DEUX chemins :
    //   1. main.js appelle `chargeRacines()` dès que le voile de chargement est
    //      retiré, donc la sphère se remplit pendant que le visiteur regarde sa
    //      carte, bien avant qu'il ne songe à dézoomer ;
    //   2. `setVisible(true)` l'appelle AUSSI (voir plus bas). C'est le filet :
    //      tout chemin qui montre le globe — dézoom à la molette, escalier de
    //      zoom, lien partagé, `?f3=1` — passe par `Modes.enterOrbit`, qui passe
    //      par `setVisible(true)`. Aucun ne peut donc trouver une sphère nue
    //      SANS avoir déclenché le chargement au même instant.
    // Les objets tuiles, eux, sont créés tout de suite : `this.roots` est lu
    // ailleurs, et un tableau vide au démarrage serait un piège pour la suite.
    const n = 2 ** ROOT_Z
    this.roots = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) this.roots.push(this._ensureTile(ROOT_Z, x, y))
    }
  }

  /**
   * Demande les 16 tuiles racines, à la priorité maximale qu'elles avaient
   * dans le constructeur. Idempotent : `_request` ignore toute tuile qui n'est
   * plus à l'état `empty`, donc on peut l'appeler autant de fois qu'on veut.
   */
  chargeRacines() {
    for (const t of this.roots) this._request(t, 1e9)
  }

  // ═══════════ LE CROP — Tâche A du plan « UNE SEULE TERRE » ═════════════════
  //
  // Adrien, le 2026-08-21, après avoir vu DEUX Terres à l'écran : « ta
  // recommandation me dit qu'il vaut mieux calculer 2 terres qu'une seule, au
  // niveau ressources ça me paraît aberrant ». Il a raison, et c'est mesuré : à
  // 2 km on dessine 964 tuiles de globe ET une fenêtre de 594 000 sommets,
  // montrant le même endroit.
  //
  // ⚠️ **CETTE MÉTHODE EST LE SEUL INTERRUPTEUR.** Tant que personne ne
  // l'appelle, `uCropOn` vaut 0 et le globe est celui d'avant, au bit près —
  // c'est ce que vérifie `test/crop-sphere.test.js`.

  /**
   * Pose le crop : les tuiles cesseront d'être dessinées hors de sa forme.
   *
   * ⚠️ **LE REPÈRE VIENT DE `crop-sphere.js`, QUI LIT `empriseSocle`.** Le globe
   * ne calcule pas l'emprise : il l'applique. Deux producteurs d'emprise, c'est
   * un socle et une découpe qui divergent d'un pixel puis d'un mètre.
   *
   * ⛔ **`half`, `corner` ET `expo` N'ONT ÉTÉ PASSÉS PAR PERSONNE DE LA TÂCHE A
   * À LA TÂCHE P6.** Le crop a donc vécu dix tâches sur `corner = 0`, `expo = 2`
   * — **un carré à angles vifs** — pendant que le socle vivait sur
   * `params.slabCorner = 0,04` (un rayon de 8 % du demi-côté) et
   * `params.slabCornerSmoothing = 0,6` (un squircle d'exposant 4,4). Relevé le
   * 2026-08-22 au même instant dans la même page : `uCropCoin = 0`,
   * `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`,
   * `uSlabHalf = 28`. La Tâche P4 l'avait même ÉCRIT en passant — « relevé sur
   * la page vivante : `uCropCoin` vaut ZERO » — sans y voir un branchement
   * absent.
   *
   * ⚠️ **LES DÉFAUTS RESTENT CEUX D'AVANT** : un appelant muet (test, banc,
   * globe de papier) obtient le carré vif, au bit près.
   *
   * @param {{centre:{lat:number,lon:number}, zoom?:number, tuilesParBloc?:number,
   *          half?:number, corner?:number, expo?:number}} arg
   */
  poserCrop({ centre, zoom, tuilesParBloc, half = 28, corner = 0, expo = 2 } = {}) {
    const rep = repereCrop({ centre, zoom, tuilesParBloc })
    // ⚠️ **UN DÉMÉNAGEMENT EFFACE LES ANCRES, UN CRAN DE ZOOM NON — Tâche K
    // bis.** Les ancres de l'échelle continue disent « à ce lieu, à ce cran
    // d'altitude, le relief vaut ceci » : les garder après un saut à l'autre
    // bout du monde peindrait la Corse avec l'amplitude de l'Himalaya. Mais les
    // EFFACER à chaque cran de zoom rouvrirait exactement le défaut que la
    // tâche ferme — la re-mesure par saut. Le test est donc géométrique : le
    // nouveau centre tombe-t-il DANS l'ancien crop, à la plus large des deux
    // demi-largeurs ? Une descente reste dedans (les deux repères sont
    // concentriques à la maille de tuile près), un `flyTo` ailleurs en sort.
    const avant = this._crop
    if (avant) {
      const marge = Math.max(avant.demi, rep.demi)
      if (Math.abs(rep.cx - avant.cx) > marge || Math.abs(rep.cy - avant.cy) > marge) {
        oublierAncres(this._echelleContinue)
      }
    }
    this._crop = rep
    // ⛔ **LA RETENUE DE DÉMARRAGE S'ÉTEINT ICI, ET C'EST UNE RÉGRESSION LIVRÉE
    // QUI L'A EXIGÉ — Tâche R3, correction C1.** La première version de
    // `cropAttendu` était un booléen à vie ; or `retirerCrop` remet `_crop` à
    // `null` sur DEUX chemins nominaux (au-dessus de `SEUIL_MORT_M`, et à toute
    // sortie du mode surface — `branchement-crop.js`, `retirer(g)`). Le globe se
    // retrouvait donc à écarter tout `z > ROOT_Z` au nom d'un crop qui n'existait
    // plus : mesuré dans l'application vivante, même `modes.enterOrbit()`,
    // **283 tuiles dessinées avant le correctif contre 16 après**, cache 1 425
    // contre 112. La planète entière ramenée à ses seize racines. Ce n'était pas
    // un cas de panne : c'est une molette.
    //
    // ⚠️ **UNE FOIS POSÉ, C'EST POSÉ POUR LA SESSION.** Ce qui justifiait la
    // retenue, c'est « on ne sait pas encore OÙ » — une ignorance qui ne revient
    // jamais : après un retrait, `_horsCropSeul` retombe sur son `false` d'avant
    // et le quadtree redescend normalement. Gardé par `test/dalles-crop.test.js`
    // ⑧ (orbite) et ⑧ bis (le compte de tuiles dessinées).
    this._cropDejaPose = true
    const u = this.uniforms
    u.uCropCentre.value.set(rep.cx, rep.cy)
    u.uCropDemi.value = rep.demi
    u.uCropCoin.value = coinNormalise(corner, half)
    u.uCropCoinN.value = Math.max(2, expo)
    u.uCropOn.value = 1
    // la couverture douce du bord ne veut rien dire sans mélange — Tâche B
    this._melangeCrop(true)
    return rep
  }

  // ═══════════ LE CROP SEUL — Tâche N, « ON NE CALCULE PAS LE DEHORS » ══════
  //
  // **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
  // s'afficher. […] On ne calcule donc pas les éléments hors crop sauf si dézoom
  // ou zoom pour faire la transition. »
  //
  // ⚠️ **« NE PAS CALCULER » EST L'EXIGENCE DURE, ET LE `discard` DE LA TÂCHE A
  // NE LA TIENT PAS.** Le nuanceur jette le fragment ; la tuile a déjà été
  // demandée, décodée, maillée, et son appel de dessin est déjà parti. Le pixel
  // meurt, le coût est payé. Ce drapeau-ci coupe en AMONT, dans `_traverse` :
  // une tuile hors de la boîte du crop n'est ni parcourue, ni demandée, ni
  // dessinée.
  //
  // ⚠️ **LE CRITÈRE EST LA BOÎTE, PAS LA FORME** — `tuileDansCrop`, la même que
  // `zoomCropPrescrit` emploie déjà pour prescrire `ZOOM_SOCLE`. Une tuile qui
  // ne touche le crop que par un coin arrondi reste donc parcourue : la forme se
  // joue au fragment, le parcours se joue à la tuile. Un test de forme ici
  // ouvrirait un trou d'une tuile dans chaque coin.
  //
  // ⚠️ **CE N'EST PAS UN ÉTAT PERMANENT — C'EST L'ÉTAT DE REPOS.** La loi de
  // l'estompage (Tâche G) n'est pas touchée : elle reste
  // `estompageTerre(altitude)` et c'est elle qui dessine les alentours PENDANT
  // un zoom. Ce que la Tâche N change, c'est QUAND elle s'applique — la veille
  // du repos (`src/monde/veille-repos.js`) décide, `branchement-crop.js`
  // relaie.

  /**
   * Le globe ne parcourt-il QUE le crop ?
   *
   * ⚠️ **SANS CROP POSÉ, LE DRAPEAU NE COUPE RIEN**, et c'est délibéré : couper
   * sur un repère absent ferait disparaître la planète entière. `_horsCropSeul`
   * teste `this._crop` avant tout.
   *
   * @param {boolean} actif
   * @returns {boolean} l'état posé
   */
  poserCropSeul(actif) {
    this._cropSeul = !!actif
    return this._cropSeul
  }

  /**
   * Cette tuile est-elle hors du crop alors qu'on ne parcourt que le crop ?
   *
   * ⚠️ **LES RACINES z2 NE SONT PAS EXEMPTÉES ICI, CONTRAIREMENT AUX DEUX TRIS
   * SPATIAUX.** Elles le sont là-bas parce qu'elles portent la couverture tant
   * que leurs enfants ne sont pas au complet — un trou au bord de l'écran. Ici
   * il n'y a pas de trou à ouvrir : hors du crop, il n'y a RIEN à montrer. Et
   * elles ne se purgent jamais (`_purgerFile`, `_evict`), donc la transition les
   * retrouve en cache sans un octet de réseau.
   */
  _horsCropSeul(z, x, y) {
    // ⚠️ **PAS ENCORE DE CROP, MAIS ON SAIT QU'IL VIENT — Tâche R3.** Sous
    // `cropAttendu`, tant que `_crop` est `null` on refuse TOUT ce qui est plus
    // fin que les racines : c'est la seule réponse qui ait un sens quand on sait
    // qu'on ne montrera qu'un carré mais pas encore lequel. Les racines, elles,
    // passent — sans elles il n'y aurait pas de planète du tout, et
    // `chargeRacines` les demande de toute façon.
    //
    // ⚠️ **ET SANS `cropAttendu`, CETTE LIGNE EST LE `return false` D'AVANT, AU
    // BIT PRÈS** : la production (pas de drapeau, pas de crop) ne voit rien.
    if (!this._crop) return this._retenueAvantCrop() && z > ROOT_Z
    if (!this._cropSeul && !this.estompePlein()) return false
    return !tuileDansCrop(z, x, y, this._crop)
  }

  /**
   * La contre-pression de file est-elle armée ? — Tâche R3.
   *
   * ⚠️ **CE N'ÉTAIT PAS UNE DÉCOUVERTE, C'ÉTAIT UN ARBITRAGE OUBLIÉ.** Le plan
   * du 2026-08-08 (`docs/superpowers/plans/2026-08-08-globe-continu.md:1554`)
   * l'avait mesuré et écrit : « 473 tuiles en chargement, file à 462, pour un
   * cache de 600. (…) C'est délibéré, mais ce n'est pas une raison de
   * l'oublier : à trancher avec Adrien. » Quinze jours plus tard, Adrien
   * signale le symptôme.
   *
   * ⛔ **ET L'ARBITRAGE N'EST PAS « ON LÈVE LES GARDES ».** `FLAGS.globeContinu`
   * vaut **`false`** : le globe ordinaire, celui de la production, tourne
   * `continu: false`. Lever les trois gardes changerait donc la PRODUCTION,
   * ce que la clôture de cette tâche interdit explicitement (« drapeau baissé,
   * la production doit être RIGOUREUSEMENT inchangée »). On ÉLARGIT donc la
   * garde au régime `terre unique` au lieu de la retirer : la contre-pression
   * couvre les deux régimes du crop, et pas une image de la production ne
   * change.
   *
   * ⚠️ **CE QUE LA MESURE DIT DES TROIS MÉCANISMES, ET C'EST INÉGAL.** Sur la
   * scène relevée (La Réunion, caméra posée sur le crop) :
   *   · `_purgerFile` **paie** : sans elle, 190 tuiles réseau au lieu de 122,
   *     dont 63 tuiles z3 entièrement hors crop ;
   *   · `PLAFOND_FILE` **ne se déclenche jamais** — `_refusFile` relevé à 0,
   *     la file ne monte pas à 256 sur cette scène ;
   *   · le rang d'éviction **n'est jamais atteint** — 175 tuiles en cache pour
   *     un budget de 1 700, `_evictJusqua` ne passe pas.
   * Les deux derniers sont donc le FILET (un panoramique rapide, un dézoom),
   * pas le gain. C'est écrit pour que personne ne leur attribue les 68 tuiles.
   */
  /**
   * La descente est-elle RETENUE, faute de savoir où sera le crop ? — R3/C1.
   *
   * ⛔ **DEUX CONDITIONS, ET LA SECONDE A ÉTÉ PAYÉE PAR UNE RÉGRESSION LIVRÉE.**
   * `cropAttendu` seul ne suffit pas : `retirerCrop` rend `_crop` à `null`
   * au-dessus de `SEUIL_MORT_M` et à chaque sortie du mode surface, si bien
   * qu'un drapeau à vie clouait le globe à ses seize racines dès qu'on montait
   * en orbite — 283 tuiles dessinées contre 16, mesuré dans l'application.
   *
   * ⚠️ **CE N'EST PAS `!this._crop`**, et l'écrire ainsi rejouerait le défaut :
   * la question n'est pas « y a-t-il un crop MAINTENANT » (non, en orbite) mais
   * « a-t-on déjà su où il était ». Une ignorance qui ne revient jamais.
   */
  _retenueAvantCrop() {
    return this._cropAttendu && !this._cropDejaPose
  }

  _contrePression() {
    return this.continu || this._cropAttendu
  }

  /**
   * L'ESTOMPAGE EST-IL PLEIN ? — Tâche M, volet ④ (« n'améliorer que la zone
   * visée »).
   *
   * ⚠️ **CE N'EST PAS UN SECOND DRAPEAU, C'EST UNE LECTURE.** À `uEstompage = 1`
   * le nuanceur de fragment rend `couvertureTuile = mix(1.0, dedans, 1.0)`,
   * c'est-à-dire `dedans` — lequel vaut **exactement 0** hors du crop, donc
   * `discard`. **Tout ce qui est dehors est déjà invisible** ; le parcourir,
   * le demander au réseau, le décoder et le mailler est du travail dont pas un
   * pixel ne sort.
   *
   * ⚠️ **CE QUE ÇA AJOUTE À LA TÂCHE N, ET POURQUOI CE N'EST PAS UN DOUBLON.**
   * `poserCropSeul` coupe **au REPOS** — c'est la consigne d'Adrien du même jour
   * (« ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
   * stabilisée »). Mais **pendant** un zoom la vue n'est pas au repos, et
   * l'estompage, lui, peut être plein depuis longtemps : c'est exactement le cas
   * d'une DESCENTE. Mesuré dans l'application vivante, descente 1 600 km → 3 km :
   * **9 456 tuiles demandées, dont 5 081 hors crop — 53,7 %**, presque toutes
   * sous estompage plein.
   *
   * ⚠️ **ET LA GARDE EST L'INVERSE DE CELLE DE LA TÂCHE N** : elle coupe MOINS
   * souvent qu'elle en altitude (l'estompage n'est plein que sous la bande) et
   * PLUS souvent en régime (elle ne demande pas le repos). Les deux se cumulent
   * par un OU, aucune ne remplace l'autre.
   *
   * ⚠️ **`uEstompageOn` D'ABORD.** Sans lui, `uEstompage` vaut **1 par défaut**
   * (voir sa déclaration) : lire la valeur seule couperait le dehors sur une
   * planète où l'estompage n'a jamais été posé — c'est-à-dire en production.
   */
  estompePlein() {
    const u = this.uniforms
    return u.uEstompageOn.value > 0.5 && u.uEstompage.value >= 1
  }

  /** Retire le crop — le globe redevient entier, parois comprises. */
  retirerCrop() {
    this._crop = null
    this.uniforms.uCropOn.value = 0
    this._melangeCrop(false)
    this.retirerParoisCrop()
    this.retirerHabillage()
    this.retirerRampe()
    this.retirerMer()
    this.retirerEstompage()
    // ⚠️ **APRÈS `_crop = null`, ET C'EST L'ORDRE QUI COMPTE** : `retirerFondCrop`
    // rebâtit les maillages, et un fond encore posé les rebâtirait AVEC le fond
    // marin — la mer resterait creusée sur un globe qui n'a plus de crop.
    this.retirerFondCrop()
  }

  // ═══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3 ══════════
  //
  // ⚠️ **CETTE MÉTHODE EST LE SEUL INTERRUPTEUR**, comme `poserCrop` l'est pour
  // la découpe. Tant que personne ne l'appelle, `uEstompageOn` vaut 0 et les
  // trois nuanceurs rendent ce qu'ils rendaient avant la Tâche G, au bit près.
  //
  // ⚠️ **LA LOI N'EST PAS ICI.** Elle vit dans `src/monde/estompage-terre.js`,
  // qui la dérive des seuils du socle et ne lit qu'une ALTITUDE (règle R1). Le
  // globe ne décide pas quand s'estomper : il applique. C'est `main.js` qui
  // porte la veille, comme pour le seuil du socle.

  /**
   * Pose l'estompage de la Terre autour du crop.
   *
   * @param {number} estompage — 0 = la planète entière, 1 = le crop seul.
   *   Écrêté : un `NaN` dans un uniforme éteint la moitié d'un GPU sans un mot.
   */
  poserEstompage(estompage) {
    const e = Number(estompage)
    const v = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0
    const u = this.uniforms
    u.uEstompage.value = v
    u.uEstompageOn.value = 1
    // ⚠️ **UN ALPHA NE VEUT RIEN DIRE SUR UN MATÉRIAU OPAQUE.** Les calottes
    // sont opaques en production ; sans cette bascule leur `1.0 - estompage`
    // serait ignoré par le moteur et un bandeau blanc resterait au pôle.
    this._melangeCalottes(true)
    // ⛔ **IL Y AVAIT ICI UN APPEL À `_majBordMer`, ET C'ÉTAIT LE DÉFAUT ②
    // D'ADRIEN (2026-09-04).** La Tâche J l'avait posé pour que la mer « suive »
    // l'estompage ; la conséquence mesurée est que la nappe s'étendait jusqu'à
    // DEUX demi-côtés hors du crop dès que l'estompage n'était pas plein —
    // c'est-à-dire à chaque geste, l'estompage n'étant plein qu'au repos.
    // ⚠️ **LA MER NE SUIT PLUS L'ESTOMPAGE : ELLE SUIT LE SOCLE**, et rien
    // d'autre (`bordDeMer`, qui ne prend plus aucun paramètre). L'estompage
    // n'écrit donc plus rien sur la mer, et le retirer d'ici est ce qui le
    // PROUVE — laisser l'appel rendrait la dépendance invisible mais vivante.
    return v
  }

  /**
   * LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K.
   *
   * Pose les quatre uniformes qui font quitter l'espace-tuile à `minFade` et au
   * grain de papier. ⚠️ **APPELÉE PAR IMAGE**, parce que le `fov` et la hauteur
   * du cadre changent en cours de session : le §0 du plan est formel, « tout ce
   * qui dérive un seuil du fov lit `camera.fov` EN DIRECT » — le code dit 30,
   * l'application vivante tourne à 33.
   *
   * ⚠️ **REND `false` ET NE TOUCHE À RIEN SI LA LOI N'EST PAS CALCULABLE.** Un
   * `NaN` posé dans `uMppFacteur` ferait basculer chaque fragment sur la branche
   * monde avec une échelle absurde — un écran noir sans un mot d'erreur.
   *
   * @param {{fovDeg:number, hauteurPx:number, lat:number}} o
   */
  poserLoiMonde({ fovDeg, hauteurPx, lat = 0 } = {}) {
    const loi = loiTextureMonde({ fovDeg, hauteurPx, lat })
    if (!loi) return false
    const u = this.uniforms
    u.uMppFacteur.value = loi.mppFacteur
    u.uResRefM.value = loi.resRefM
    u.uGrainParPixel.value = loi.grainParPixel
    u.uMetresParDegre.value = loi.metresParDegre
    return true
  }

  /**
   * Retire la loi de monde — le nuanceur reprend celle du dépôt, AU BIT PRÈS.
   * C'est ce qui garantit que la production (la vue orbitale de shibumap.com)
   * n'est pas concernée tant que `?terre=unique` n'est pas levé.
   */
  retirerLoiMonde() {
    this.uniforms.uMppFacteur.value = 0
  }

  /** Retire l'estompage — on revient au crop SEUL, le comportement de la Tâche A. */
  retirerEstompage() {
    const u = this.uniforms
    u.uEstompageOn.value = 0
    u.uEstompage.value = 1
    this._melangeCalottes(false)
    // ⛔ **PLUS D'APPEL À `_majBordMer` ICI NON PLUS** — même raison qu'à
    // `poserEstompage` : le bord de la mer ne dépend plus de l'estompage.
  }

  /** Les calottes passent (ou non) dans la liste triée du moteur. */
  _melangeCalottes(actif) {
    for (const cap of this._calottes || []) {
      if (cap.material.transparent === actif) continue
      cap.material.transparent = actif
      cap.material.needsUpdate = true
    }
  }

  // ═══════════ L'HABILLAGE — Tâche C, « le globe prend le rendu du socle » ═══
  //
  // **Décision 6 d'Adrien, mot pour mot :** « je veux le même rendu que la
  // qualité de rendu des tuiles à plat qui vont donc disparaître ».
  //
  // ⚠️ **QUATRE POSTES, ET PAS UN DE PLUS.** Le plan les nomme : courbes de
  // niveau calées sur le local, grain, masque de côte, occupation du sol. La
  // rampe est la Tâche D, la mer la Tâche F, les étiquettes ne sont pas du
  // nuanceur. **Ce qui n'est PAS porté est écrit dans le compte rendu de la
  // tâche**, pas caché ici : l'analyse de relief (peigné), la perspective
  // aérienne, les caustiques de fond, la photo aérienne, les lumières de nuit,
  // l'ombre des nuages, les effets de surface et le balayage restent au socle.
  //
  // ⚠️ **ET LE COÛT DE CE QU'ON NE PORTE PAS EST MESURÉ — TABLE CORRIGÉE AU
  // TOUR 1, DANS UNE SEULE MONNAIE.**
  //
  // ⚠️ **LA PREMIÈRE VERSION DE CE PAVÉ ANNONÇAIT « QUATORZE », ET CE CHIFFRE
  // NE TIENT PAS.** Il comparait la pente du socle à un « nuanceur du globe »
  // relevé sur un TOUT AUTRE cadrage — et deux « coût du globe » cohabitaient
  // au même 900² sans être réconciliés, d'un facteur 3,9. Une relecture
  // indépendante l'a vu. Tout est refait sur un seul banc
  // (`.banc/mesure-C5.js`), une seule préparation de scène, un seul protocole
  // écrit dans `PROTOCOLE`, et les sorties brutes sont sur le disque
  // (`.banc/C5-brut.json`, `.banc/C5-postes-brut.json`).
  //
  // **Protocole : RTX 3080 · cibles 480² et 900² hors écran · 5 tours de 25
  // images, 12 jetées · boucle rAF GELÉE · `autoClear` FORCÉ · atmosphère,
  // calottes et nuages MASQUÉS des deux côtés · fond de scène retiré ·
  // couverture PROUVÉE à 1,0.**
  //
  // **MONNAIE UNIQUE — ms par mégapixel de FRAGMENT** (pente entre les deux
  // tailles, témoin au nuanceur constant déduit sur la MÊME géométrie) :
  //
  //     habillage COMPLET du socle ........ 0,527 ms/Mpx
  //     nuanceur ENTIER du globe .......... 0,277 ms/Mpx
  //     les quatre postes de cette tâche .. 0,094 ms/Mpx
  //
  // Soit : porter tout l'habillage aurait coûté **1,9 fois le nuanceur entier du
  // globe** — pas quatorze. Les quatre postes retenus en coûtent **0,34 fois**,
  // c'est-à-dire **+34 %**, et **5,6 fois moins que le portage complet**.
  //
  // ⚠️ **ET LE COÛT DU SOCLE EST SURTOUT FIXE, PAS PAR PIXEL.** À 0,81 Mpx
  // l'habillage complet coûte **1,087 ms** dont seulement 0,427 varie avec la
  // surface : **0,660 ms sont fixes** — les douze liens de texture et les
  // uniformes, payés une fois par appel de dessin. Les quatre postes, eux,
  // coûtent 0,091 ms dont **0,015 seulement** de fixe.
  //
  // ⚠️ **ET LE TÉMOIN DU SOCLE REND UNE PENTE NÉGATIVE** (−0,035 ms/Mpx) : un
  // nuanceur à couleur constante sur 1,18 million de triangles coûte le même
  // temps à 480² et à 900². **Le plancher du socle est lié au SOMMET, pas au
  // pixel** — c'est un fait, pas du bruit qu'on écarte.
  //
  // ⚠️ **CETTE MÉTHODE EST LE SEUL INTERRUPTEUR.** Tant que personne ne
  // l'appelle, `uHabOn` vaut 0 et le globe est celui d'avant, au bit près.

  // ⚠️ **LE COÛT POSTE PAR POSTE, AU MÊME PROTOCOLE** (cible 900², donc 0,81 Mpx,
  // sur le crop de La Réunion, 172 tuiles z13 ; `.banc/C5-postes-brut.json`) :
  //
  //     globe SANS habillage .................. 0,4157 ms
  //     + courbes calées sur le local ......... 0,4291   (+0,0134)
  //     + grain ............................... 0,4905   (+0,0614)
  //     + masque de côte ...................... 0,5059   (+0,0154)
  //     + occupation du sol (tout) ............ 0,6840   (+0,1781)
  //     témoin, sans habillage, à la fin ...... 0,4209   (dérive +0,0052)
  //
  // ⚠️ **LE PLANCHER DE BRUIT VAUT 0,0297 ms, ET DEUX POSTES TOMBENT DESSOUS** —
  // les courbes (+0,0134) et le masque de côte (+0,0154). **Leur coût n'est pas
  // mesuré, il est BORNÉ** : ce banc dit qu'ils coûtent moins de 0,03 ms, il ne
  // dit pas combien.
  //
  // ⚠️ **ET L'OCCUPATION DU SOL EST BIEN LE POSTE LE PLUS CHER, PAR UN FACTEUR
  // ONZE** — huit accès de texture par fragment (`lavisSol` lit quatre voisins,
  // `solEn` en fait deux chacun). **La table livrée disait la même chose sur des
  // chiffres qui ne le permettaient pas** : le masque de côte y dépassait
  // l'occupation du sol de 0,0061 ms, très en dessous du bruit. C'est corrigé.
  //
  // ⚠️ **LE TOTAL DÉPEND DE L'ÉTAT DE LA COUCHE** : **+0,2683 ms** avec
  // l'occupation du sol allumée, **+0,0911 ms** avec elle éteinte — c'est-à-dire
  // telle qu'elle est dans l'application aujourd'hui.

  /**
   * Pose l'habillage du socle sur le crop.
   *
   * ⚠️ **LES TEXTURES NE SONT PAS RECUITES : CE SONT CELLES DU SOCLE.** Le
   * masque de côte, la mosaïque d'occupation du sol et sa table sont déjà cuits
   * sur l'emprise du bloc, et l'emprise du bloc EST celle du crop — la
   * démonstration est en tête de `src/monde/habillage-crop.js`, et
   * `test/crop-habillage.test.js` la rejoue contre `latLonToWorld` du dépôt.
   * Le globe les lit au même texel, sans rééchantillonnage : c'est le §5 du
   * plan, « le dépôt doit avoir MAIGRI ».
   *
   * @param {object} arg
   * @param {THREE.Texture|null} arg.coastMask - `terrain.mapUniforms.uCoastMask`
   * @param {THREE.Texture|null} arg.sol - la mosaïque de classes ESA WorldCover
   * @param {THREE.Texture|null} arg.solLut - sa table 256×1
   * @param {number} arg.solOpacite
   * @param {{x:number,y:number}|null} arg.solOffset
   * @param {{x:number,y:number}|null} arg.solScale
   * @param {{x:number,y:number}|null} arg.solTexel
   * @param {number|null} arg.amplitudeM - amplitude du relief du crop, en mètres
   * @param {number|null} arg.contourIntervalM - impose l'intervalle (sinon calé)
   * @param {number} arg.contourOpacity
   * @param {number} arg.contourWeight
   * @param {number} arg.grainForceM - amplitude du grain, en MÈTRES de relief
   * @param {number} arg.grainEchelle
   * @param {boolean} arg.normaleFine - la normale du bloc est-elle reconstruite
   *   AU FRAGMENT depuis la texture de hauteur ? ⚠️ **Faux = le dépôt au bit
   *   près** : la normale reste celle des sommets, c'est-à-dire d'une grille de
   *   24 quads par tuile. Voir le §6 de `monde/eclairage-crop.js` pour la
   *   décomposition qui a nommé ce manque.
   *
   * ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
   *
   * ⚠️ **ELLE ENTRE PAR L'HABILLAGE, ET PAS PAR `poserRampe` — C'EST UNE
   * DÉCISION.** `poserRampe` REFUSE quand la couverture du crop est incomplète
   * (`refus: 'couverture'`), et un refus « ne touche pas à ce qui est en place ».
   * L'analyse, elle, n'est jamais mesurée : c'est une texture déjà cuite par le
   * socle. La faire dépendre d'une mesure l'aurait rendue absente exactement
   * quand la Tâche K ter a montré qu'elle manque — pendant la course de
   * chargement. Et l'habillage est le SEUL maillon que la veille rafraîchit par
   * image dès qu'un champ change (`CHAMPS_HABILLAGE`), ce dont l'analyse a
   * besoin : elle arrive du travailleur, longtemps après la naissance du crop.
   *
   * @param {THREE.Texture|null} arg.analyse - `terrain.mapUniforms.uAnalysis`,
   *   la RGBA de `terrain-analysis.js` (R peigné, G ombrage, B humidité,
   *   A exposition). `null` = pas d'analyse, l'uniforme s'éteint.
   * @param {THREE.Texture|null} arg.rampe2D - `terrain.mapUniforms.uRampTex`,
   *   le LUT 2D du socle. ⚠️ **C'EST LE MÊME OBJET, PAS UNE COPIE** : c'est par
   *   lui que `rampDry`, `rampWet` et `rampOklab` arrivent sur la sphère.
   * @param {number} arg.texShade
   * @param {number} arg.wetK
   * @param {number} arg.expoK
   * @param {number} arg.hemi
   * @param {number} arg.treeLine
   * @param {number} arg.heightContrast
   * @param {number} arg.heightPivot
   * @param {number} arg.hazeAmt
   * @param {number} arg.hazeAlt
   * @param {number} arg.hazeDist
   * @param {string|number|null} arg.hazeColor - ⚠️ **UNE VALEUR, PAS L'OBJET
   *   `THREE.Color` DU SOCLE.** Le socle le MUTE en place (`.set(...)`), donc son
   *   identité ne bouge jamais : partagé, il aurait fait de `this.uniforms` un
   *   porteur de poignée sur l'état du bloc, et `habillageDifferent` n'aurait
   *   jamais vu la couleur changer.
   *
   * ══════════ LA PHOTO AÉRIENNE — Tâche R9 ═══════════════════════════════════
   *
   * ⚠️ **ELLE ENTRE PAR L'HABILLAGE POUR LA RAISON DE L'ANALYSE, EN PIRE** : la
   * mosaïque arrive **du réseau**, après une composition de dix-sept tuiles au
   * mieux, et l'utilisateur peut l'allumer à n'importe quel instant depuis la
   * barre de carte. Elle ne peut pas être là quand le crop naît, et rien d'autre
   * que la veille par image ne la verrait arriver.
   *
   * @param {THREE.Texture|null} arg.aerial - `terrain.mapUniforms.uAerial`,
   *   la mosaïque composée par `map/aerial-layer.js`. ⚠️ **`null` L'ÉTEINT** —
   *   même patron que `coastMask` et `sol` : l'interrupteur est l'absence de
   *   donnée, et l'appelant hérite de la garde `uAerialOn` du socle au lieu d'en
   *   écrire une seconde.
   * @param {number} arg.aerialOpacite - `uAerialOpacity` du socle, la tirette
   *   « combien de la carte survit à la photo ».
   * @param {{x:number,y:number}|null} arg.aerialOffset
   * @param {{x:number,y:number}|null} arg.aerialScale - l'affine qui pose la
   *   mosaïque sur l'emprise (`aerialUvTransform`). ⚠️ **MUTÉS EN PLACE par
   *   `terrain.setAerial` (`.set(...)`), donc absents de `CHAMPS_HABILLAGE`** —
   *   même exemption, et même raison, que `solOffset` / `solScale`.
   * @param {number} arg.aerialCoastFade - `uAerialCoastFade` du socle, la
   *   tirette « Fondu à la côte » du panneau de carte (0 = éteint). ⚠️ **ELLE
   *   EST DANS `CHAMPS_HABILLAGE`** : c'est une tirette, l'utilisateur la bouge
   *   quand il veut, et c'est un scalaire — donc surveillable par `Object.is`
   *   sans reposer l'habillage à chaque image.
   */
  poserHabillage({
    coastMask = null,
    sol = null,
    solLut = null,
    solOpacite = 1,
    solOffset = null,
    solScale = null,
    solTexel = null,
    aerial = null,
    aerialOpacite = HABILLAGE_MONDE.aerialOpacite,
    aerialOffset = null,
    aerialScale = null,
    aerialCoastFade = HABILLAGE_MONDE.aerialCoastFade,
    amplitudeM = null,
    contourIntervalM = null,
    contourOpacity = null,
    contourWeight = 0.7,
    // ══════ LA GRILLE DE RELEVÉ — Tâche R22, options 19 et 20 ═══════════════
    //
    // ⚠️ **LA TIRETTE ARRIVE EN UNITÉS DE BLOC ET REPART EN MÈTRES, ET LA
    // CONVERSION EST FAITE ICI PARCE QUE C'EST ICI QU'ON CONNAÎT LE CROP.**
    // `largeurCropM(this._crop)` est la largeur au sol de la découpe ; ni
    // `main.js` ni le nuanceur ne l'ont sous la main. C'est exactement le
    // montage de `uMargeCoteM` trente lignes plus bas — une conversion qui a
    // besoin du repère se fait là où le repère vit.
    //
    // ⚠️ **`gridSpanBloc` EST LE SPAN DU BLOC VIVANT, PAS 56 EN DUR** : en mode
    // continu le bloc couvre plusieurs emprises, et un span figé multiplierait
    // le pas par cette même emprise. Même argument, même mot, que
    // `contourIntervalM` dans `contexteCrop`.
    gridStepBloc = null,
    gridOpacite = 0,
    gridCouleur = null,
    gridSpanBloc = COTE_CROP_UNITES,
    grainForceM = 0,
    grainEchelle = 96,
    normaleFine = false,
    analyse = null,
    rampe2D = null,
    texShade = NATUREL_MONDE.texShade,
    wetK = NATUREL_MONDE.wetK,
    expoK = NATUREL_MONDE.expoK,
    hemi = NATUREL_MONDE.hemi,
    treeLine = NATUREL_MONDE.treeLine,
    heightContrast = NATUREL_MONDE.heightContrast,
    heightPivot = NATUREL_MONDE.heightPivot,
    // ══════ LE GRADE DU BLOC — Tache GRA ═════════════════════════════════════
    //
    // ⚠️ **QUATRE CHAMPS, ET LEUR ABSENCE EST UN ETAT LEGITIME, PAS UN OUBLI.**
    // Sans eux (un appelant d'avant, un banc, un test), `gradeBlocEffectif`
    // n'a ni auto de reference ni domaine de socle : il retombe sur le chemin
    // du depot et pose `heightPivot` / `heightContrast` TELS QUELS. C'est le
    // meme contrat que `soleilCouleur == null` vingt lignes plus bas — l'absence
    // de donnee EST l'interrupteur, il n'y a pas de second booleen a tenir
    // d'accord.
    //
    // ⚠️ **`pivotAutoSocle` EST L'AUTO, PAS LE VIVANT.** Les deux se confondent
    // tant qu'Adrien ne touche a rien ; leur DIFFERENCE est exactement son
    // geste, et c'est la seule chose que le bloc doit reprendre du socle.
    pivotAutoSocle = null,
    contrasteAutoSocle = null,
    // le domaine du SOCLE, EN METRES (`dem.minM`, `dem.maxM − dem.minM`) —
    // celui dans lequel son curseur est exprime.
    socleBasM = null,
    socleAmpM = null,
    hazeAmt = NATUREL_MONDE.hazeAmt,
    hazeAlt = NATUREL_MONDE.hazeAlt,
    hazeDist = NATUREL_MONDE.hazeDist,
    hazeColor = null,
    // ══════ L'ÉCLAIRAGE ET LA PAROI — Tâche P3 ═══════════════════════════════
    //
    // ⚠️ **ILS ENTRENT PAR L'HABILLAGE, ET C'EST LE SEUL ENDROIT QUI MARCHE.**
    // `construireParoisCrop` ne tourne qu'à l'arrêt (elle balaie plus de mille
    // points du contour) et `poserCrop` qu'au changement de lieu ; or le soleil
    // bouge à chaque dixième d'heure de la tirette, et la couleur des parois à
    // chaque palette. `poserHabillage`, elle, est rejouée dès qu'un des champs
    // de `CHAMPS_HABILLAGE` change — c'est la seule veille par image de la
    // chaîne. Un soleil posé à la naissance du crop serait figé sur l'heure de
    // ce moment-là, et personne ne le verrait bouger.
    //
    // ⚠️ **DOUZE CHAMPS PLATS, ET PAS UN OBJET `eclairage`.** `habillageDifferent`
    // compare par `Object.is` les champs de `CHAMPS_HABILLAGE` : un objet
    // reconstruit à chaque image différerait TOUJOURS de lui-même, et la veille
    // reposerait l'habillage entier soixante fois par seconde. C'est la remarque
    // que `CHAMPS_HABILLAGE` porte déjà pour `solOffset`/`solScale` et pour
    // `hazeColor`, appliquée AVANT de payer le défaut.
    centreLat = null,
    centreLon = null,
    soleilAzimut = null,
    soleilElevation = null,
    soleilCouleur = null,
    soleilIntensite = null,
    hemiCiel = null,
    hemiSol = null,
    hemiIntensite = null,
    ambianteCoef = null,
    ambianteIntensite = null,
    // ══════ L'APPOINT — Tâche R21, options 69 à 73 ═══════════════════════════
    //
    // ⚠️ **QUATRE CHAMPS PLATS DE PLUS, MÊME RAISON QUE LES DOUZE D'AU-DESSUS** :
    // `habillageDifferent` compare par `Object.is`, donc un objet `appoint`
    // reconstruit à chaque image reposerait l'habillage entier soixante fois par
    // seconde.
    //
    // ⛔ **ET L'INTERRUPTEUR EST, ENCORE, L'ABSENCE DE DONNÉE** : un appelant qui
    // ne passe pas `appointIntensite` laisse `uAppointIrr` à `(0, 0, 0)`,
    // c'est-à-dire l'image d'avant cette tâche AU BIT PRÈS.
    appointAzimut = null,
    appointElevation = null,
    appointCouleur = null,
    appointIntensite = null,
    // ══════ L'OMBRAGE DES PENTES — Tâche R21, option 30 ══════════════════════
    //
    // ⚠️ **LE DÉFAUT EST `PENTE_MONDE_NULLE`, PAS `params.slopeTint`.** Un poseur
    // muet ne doit pas inventer un brunissage : c'est la remarque que
    // `HABILLAGE_MONDE.aerialCoastFade` porte déjà, et le précédent qu'elle cite.
    slopeTint = PENTE_MONDE_NULLE,
    // ══════ L'AMBIANTE DE LA PAROI — Tâche P8 ════════════════════════════════
    //
    // ⚠️ **MÊME PATRON QUE PARTOUT ICI : L'INTERRUPTEUR EST L'ABSENCE DE
    // DONNÉE.** Un appelant qui ne les passe pas fait retomber la paroi sur
    // l'ambiante des tuiles, c'est-à-dire sur l'image d'avant cette tâche AU BIT
    // PRÈS. C'est ce que `test/crop-eclairage.test.js` verrouille, et c'est ce
    // qui rend la mutation « on oublie de les poser » visible en test.
    paroiAmbianteCoef = null,
    paroiAmbianteIntensite = null,
    albedoBase = null,
    albedoTeinte = null,
    // ══════ LA MATIÈRE DU RELIEF — Tâche R25, option 38 ══════════════════════
    //
    // ⚠️ **MÊME PATRON QUE PARTOUT ICI : L'INTERRUPTEUR EST L'ABSENCE DE
    // DONNÉE.** Un appelant qui ne passe pas `matMap` laisse `uMatOn` à zéro,
    // donc l'image d'avant cette tâche AU BIT PRÈS — c'est ce que
    // `test/crop-habillage.test.js` verrouille, et ce qui rend la mutation « on
    // oublie de la poser » visible en test.
    matMap = null,
    matNormal = null,
    matRepeat = null,
    matBump = null,
    matNoiseOn = null,
    matNoiseCut = null,
    matNoiseSoft = null,
    matNoiseScale = null,
    matAboveZero = null,
    matBandeM = null,
    // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
    //
    // ⚠️ **`fxTime` N'EST PAS DANS CETTE LISTE, ET C'EST DÉLIBÉRÉ** : il avance
    // À CHAQUE IMAGE (`terrain.js` : `uFxTime.value += dt * speed`). Le faire
    // entrer par ici mettrait `habillageDifferent` à vrai soixante fois par
    // seconde, donc reposerait l'habillage ENTIER — textures comprises — à
    // chaque image. Il passe par `poserTempsApparence`.
    surfaceFx = null,
    fxBlend = null,
    fxOpacity = null,
    fxScale = null,
    fxColA = null,
    fxColB = null,
    fxColC = null,
    fxP1 = null,
    fxP2 = null,
    fxP3 = null,
    fxDemiBloc = null,
    fxFenetreX = null,
    fxFenetreY = null,
    paroiCouleur = null,
  } = {}) {
    const u = this.uniforms
    u.uHabOn.value = 1

    u.uCoastMask.value = coastMask
    u.uCoastMaskOn.value = coastMask ? 1 : 0
    // ⚠️ **LA MARGE EST CONVERTIE, PAS RECOPIÉE.** Le socle écrit
    // `vWorldPos.y < uSeaY + 0.02` en UNITÉS DE SCÈNE, sur un relief déjà
    // exagéré ; le globe tient sa hauteur en MÈTRES BRUTS. Recopier « 0.02 »
    // aurait donné deux centimètres — cinquante fois trop court, donc un liseré
    // de terre sur chaque lagune. Sans crop posé, il n'y a pas d'emprise d'où la
    // tirer : la marge reste alors nulle et le masque décide seul.
    u.uMargeCoteM.value = this._crop ? margeCoteDuCrop(this._crop) : 0

    // ══════ LA MATIÈRE DU RELIEF — Tâche R25, option 38 ═════════════════════
    //
    // ⛔ **QUINZE VIGNETTES RENDAIENT LA MÊME IMAGE**, et le module porte le
    // tableau qui le prouve (0,025 à 0,338 entre elles, pour un plancher de
    // bruit de banc à 0,231). Ce qui manquait était **la texture** : le globe
    // recevait `uAlbedoBase` mis à blanc par `setMaterialMode` et `uTint` mis à
    // zéro, c'est-à-dire la peinture retirée et rien mis à la place.
    //
    // ⚠️ **ICI ET PAS DANS `if (aLumiere)`, MÊME ARGUMENT QUE LA PHOTO
    // AÉRIENNE** : une matière est une couche de CARTE. Ce sont
    // `uEclairageOn`/`partBloc` qui décident ensuite si elle est éclairée, dans
    // le nuanceur, comme pour `uAlbedoBase`.
    //
    // ⚠️ **`uMatRepeat` NE SE DÉRIVE PAS ICI** : `contexteCrop` lit
    // `material.map.repeat.x` VIVANT, qui porte déjà `preset.repeat × scale ×
    // zoomRepeat(demZoom)`. La conversion est écrite dans `tuilageMatiere` —
    // **facteur 1**, parce que les deux grandeurs sont des répétitions par
    // largeur de bloc. C'est la seule des trois conversions de cette tâche qui
    // vaille 1, et c'est pour ça qu'elle est écrite plutôt que supposée.
    u.uMatOn.value = matMap ? 1 : 0
    u.uMatMap.value = matMap || null
    u.uMatNormal.value = matNormal || null
    u.uMatNormalOn.value = matMap && matNormal ? 1 : MATIERE_MONDE_ETEINTE.normalOn
    if (Number.isFinite(matRepeat) && matRepeat > 0) u.uMatRepeat.value = matRepeat
    if (Number.isFinite(matBump)) u.uMatBump.value = matBump
    u.uMatNoiseOn.value = matNoiseOn ? 1 : MATIERE_MONDE_ETEINTE.noiseOn
    if (Number.isFinite(matNoiseCut)) u.uMatNoiseCut.value = matNoiseCut
    if (Number.isFinite(matNoiseSoft)) u.uMatNoiseSoft.value = matNoiseSoft
    if (Number.isFinite(matNoiseScale)) u.uMatNoiseScale.value = matNoiseScale
    u.uMatAboveZero.value = matAboveZero ? 1 : MATIERE_MONDE_ETEINTE.aboveZero
    // ⚠️ **EN MÈTRES, ET LA CONVERSION EST FAITE PAR L'APPELANT** — même
    // partage que `contourIntervalM` : elle a besoin de l'exagération VIVANTE et
    // de `dem.extentMeters`, que le globe n'a pas. `bandeZeroMatiereM` porte le
    // facteur (4,094 4e−3 à La Réunion, exagération 2 ⇒ **12,211 m** pour les
    // 0,05 unité de scène du socle).
    u.uMatBandeM.value = Number.isFinite(matBandeM) && matBandeM > 0 ? matBandeM : MATIERE_MONDE_ETEINTE.bandeM

    // ══════ LA GRILLE DE RELEVÉ — Tâche R22, options 19 et 20 ═══════════════
    //
    // ⚠️ **UNE SEULE LARGEUR AU SOL, LUE UNE FOIS, ET LES DEUX UNIFORMES EN
    // SORTENT.** `uCropDemiM` est ce que vaut `qCrop = 1` en mètres, et
    // `uGridStepM` est le pas converti par la même largeur : leur rapport rend
    // donc `span / gridStep` **exactement**, c'est-à-dire le compte de cellules
    // du socle. Les nourrir de deux estimations différentes de la même largeur
    // (`largeurCropM` et `dem.extentMeters` diffèrent de 0,03 %) aurait fabriqué
    // un écart invisible et permanent entre les deux Terres.
    //
    // ⛔ **ET LA GRILLE S'ÉTEINT PLUTÔT QUE DE RENDRE UN NaN.** `pasGrilleBloc`
    // rend `null` sur toute entrée absurde (pas de crop, span nul, tirette à
    // zéro) ; l'opacité suit, donc la garde du nuanceur ne s'ouvre même pas.
    const demiSolM = this._crop ? largeurCropM(this._crop) / 2 : 0
    const pasGrilleM = pasGrilleBloc({
      valeurBloc: gridStepBloc,
      largeurSolM: demiSolM * 2,
      span: gridSpanBloc,
    })
    u.uCropDemiM.value = demiSolM
    u.uGridStepM.value = pasGrilleM ?? HABILLAGE_MONDE.gridPasM
    u.uGridOpacity.value = pasGrilleM ? (Number(gridOpacite) || 0) : HABILLAGE_MONDE.gridOpacite
    u.uGridColor.value.set(gridCouleur ?? HABILLAGE_MONDE.gridCouleur)

    u.uSol.value = sol
    u.uSolLut.value = solLut
    u.uSolOn.value = sol && solLut ? 1 : 0
    u.uSolOpacite.value = solOpacite
    if (solOffset) u.uSolOffset.value.set(solOffset.x, solOffset.y)
    if (solScale) u.uSolScale.value.set(solScale.x, solScale.y)
    if (solTexel) u.uSolTexel.value.set(solTexel.x, solTexel.y)

    // ══════ LA PHOTO AÉRIENNE — Tâche R9 ═════════════════════════════════════
    //
    // ⚠️ **MÊME PATRON QUE `sol` JUSTE AU-DESSUS, JUSQU'AUX DEUX VECTEURS POSÉS
    // SOUS GARDE.** L'affine n'a pas de « neutre » utile : `(0,0)` / `(1,1)`
    // étalerait la mosaïque sur l'emprise entière, ce qui est faux dès que la
    // grille de tuiles déborde du champ — c'est-à-dire presque toujours. Un
    // appelant qui ne les passe pas garde donc l'affine précédente, exactement
    // comme pour `solOffset` / `solScale`, plutôt que d'en fabriquer une fausse.
    u.uAerial.value = aerial
    u.uAerialOn.value = aerial ? 1 : 0
    u.uAerialOpacity.value = aerialOpacite
    if (aerialOffset) u.uAerialOffset.value.set(aerialOffset.x, aerialOffset.y)
    if (aerialScale) u.uAerialScale.value.set(aerialScale.x, aerialScale.y)
    u.uAerialCoastFade.value = aerialCoastFade

    // ⚠️ **L'INTERVALLE SE CALE SUR LE RELIEF DU CROP.** Le globe posait 500 m
    // en dur, valables pour le monde entier : à l'île Maurice, qui culmine à
    // 800 m, cela ne trace qu'UNE courbe. C'est la ligne « échelle » du §3 du
    // plan, appliquée aux lignes au lieu du dégradé.
    if (contourIntervalM > 0) u.uContourInterval.value = contourIntervalM
    else if (amplitudeM > 0) u.uContourInterval.value = intervalleCourbes(amplitudeM)
    if (contourOpacity != null) u.uContourOpacity.value = contourOpacity
    u.uContourWeight.value = contourWeight

    u.uGrainForceM.value = grainForceM
    u.uGrainEchelle.value = grainEchelle

    // ══════ LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════════
    //
    // ⚠️ **ELLE ENTRE PAR L'HABILLAGE, ET C'EST LE MÊME ARGUMENT QUE
    // L'ÉCLAIRAGE (Tâche P3) :** `poserHabillage` est le SEUL maillon que la
    // veille rejoue par image (`CHAMPS_HABILLAGE`). Posée à la naissance du
    // crop, la normale fine s'éteindrait au premier changement de palette qui
    // rejoue l'habillage sans la repasser.
    //
    // ⚡ **ET SOUS D15 ELLE NE PEUT PLUS S'ÉTEINDRE — Tâche R6.** Un appelant
    // qui pose un habillage SANS `normaleFine` (une palette, un gabarit) aurait
    // sinon déshabillé la planète entière au passage, alors que le drapeau dit
    // exactement le contraire. Le `||` est donc l'état de repos du monde qui
    // remonte : il ne peut qu'ALLUMER, jamais éteindre ce que l'appelant demande.
    u.uNormaleFineOn.value = (normaleFine || this.planeteEclairee) ? 1 : 0


    // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
    //
    // ⚠️ **DEUX INTERRUPTEURS ET NON UN, PARCE QUE LES DEUX ARRIVENT SÉPARÉMENT
    // ET QUE LEUR ABSENCE NE VEUT PAS LA MÊME CHOSE.** Le LUT 2D existe TOUJOURS
    // (le socle le cuit dès la première palette, en Classique comme en Naturel :
    // en Classique il est constant en Y et sa ligne médiane EST la rampe
    // historique) ; l'analyse, elle, n'existe qu'en mode Naturel et seulement une
    // fois le travailleur revenu. Un seul interrupteur aurait donc éteint le
    // pivot et le contraste de rampe — qui, eux, valent dans les DEUX modes —
    // pendant toute l'attente de l'analyse.
    u.uAnalysis.value = analyse
    u.uAnalysisOn.value = analyse ? 1 : 0
    u.uTexShade.value = texShade
    u.uWetK.value = wetK
    u.uExpoK.value = expoK
    u.uHemi.value = hemi
    u.uTreeLine.value = treeLine
    u.uRampCrop.value = rampe2D
    u.uRampCropOn.value = rampe2D ? 1 : 0
    // ══════ ⛔ LE MEME BLOC, LA MEME COULEUR A TOUS LES ZOOMS — Tache GRA ════
    //
    // > **Adrien, 2026-09-04 :** *« Le meme bloc doit avoir la meme couleur,
    // > quel que soit le zoom. »*
    //
    // ⛔ **CES DEUX NOMBRES ARRIVENT DU SOCLE, GRADES SUR LE MNT CHARGE — DONC
    // SUR UN AUTRE RELIEF QUE CELUI QU'ILS VONT PEINDRE.** Le §⑨ de
    // `rampe-crop.js` porte la mesure et le depart entre les deux directions du
    // brief ; en une ligne : sur un bloc dont les ancres n'ont pas bouge d'un
    // octet, le pivot rendu passait de **1 519,5 m a z13 a 2 323,6 m a z9** et
    // la fenetre utile de **1 047 a 503 m**. Trois echelles de couleur pour un
    // seul relief.
    //
    // ⚡ **ET LE CURSEUR RESTE CELUI D'ADRIEN.** `gradeBlocEffectif` ne pose pas
    // le grade du bloc a la place du sien : il pose le grade du bloc DECALE DE
    // CE QUE SON CURSEUR S'ECARTE DE L'AUTO DU SOCLE, en metres pour le pivot et
    // en rapport pour la fenetre. Curseur au repos, le decalage vaut exactement
    // zero ; curseur tire, le bloc se deplace du meme nombre de metres que le
    // socle sous ses yeux.
    //
    // ⚠️ **LE DOMAINE LU EST L'UNIFORME VIVANT, PAS CELUI DE LA MESURE** :
    // `majEchelleRampe` fait glisser `[uReliefBas ; uLandMax]` par image
    // (echelle continue, Tache K bis). Lire `this._rampe` ici figerait la
    // conversion a l'instant de la mesure — le desaccord de domaines,
    // reinvente un etage plus bas.
    // ⚠️ **ON MEMORISE L'ENTREE, ET UN SEUL SITE ECRIT LES DEUX UNIFORMES.** Le
    // grade depend de DEUX sources qui n'arrivent pas ensemble : le socle (ici)
    // et le domaine du globe (`_poserUniformesRampe`, reevalue PAR IMAGE).
    // Ecrire depuis les deux endroits aurait fait deux ecrivains pour un meme
    // uniforme — le defaut que `_poserUniformesRampe` existe pour avoir
    // supprime (« il y en avait DEUX, plus un troisieme »). `_majGradeBloc` est
    // l'ecrivain ; les deux sites ne font que le rappeler.
    this._gradeSocle = {
      pivotSocle: heightPivot,
      contrasteSocle: heightContrast,
      pivotAutoSocle: pivotAutoSocle ?? null,
      contrasteAutoSocle: contrasteAutoSocle ?? null,
      socleBasM,
      socleAmpM,
    }
    this._majGradeBloc()
    u.uHazeAmt.value = hazeAmt
    u.uHazeAlt.value = hazeAlt
    u.uHazeDist.value = hazeDist
    if (hazeColor != null) u.uHazeColor.value.set(hazeColor)

    // ══════ L'ÉCLAIRAGE — Tâche P3 ═══════════════════════════════════════════
    //
    // ⚠️ **UN SEUL INTERRUPTEUR, ET IL EST L'ABSENCE DE DONNÉE.** Pas de second
    // booléen à tenir d'accord : l'appelant qui n'a pas de lumière à donner n'en
    // donne pas, et le bloc reprend la loi de planète. C'est le patron de
    // `coastMask` et de `sol`, plus haut.
    //
    // ⛔ **ET LE LIEU EN FAIT PARTIE, PARCE QUE SANS LUI IL N'Y A PAS DE
    // REPÈRE.** L'azimut et l'élévation sont exprimés dans le repère du SOCLE
    // (est / haut / nord) ; les replacer dans celui du globe demande la
    // latitude et la longitude du centre du crop. Éclairer sans elles
    // reviendrait à poser le soleil du golfe de Guinée sur La Réunion.
    const aLumiere = soleilCouleur != null && hemiCiel != null && hemiSol != null
      && Number.isFinite(centreLat) && Number.isFinite(centreLon)
      && Number.isFinite(soleilAzimut) && Number.isFinite(soleilElevation)
    u.uEclairageOn.value = aLumiere ? 1 : 0
    if (aLumiere) {
      u.uSoleilDir.value.fromArray(directionSoleilLocale(soleilAzimut, soleilElevation, centreLat, centreLon))
      u.uHemiHaut.value.fromArray(hautLocal(centreLat, centreLon))
      poserIrradiance(u.uSoleilIrr.value, soleilCouleur, soleilIntensite)
      poserIrradiance(u.uCielIrr.value, hemiCiel, hemiIntensite)
      poserIrradiance(u.uSolIrr.value, hemiSol, hemiIntensite)
      // ⚠️ **L'ENVIRONNEMENT S'AJOUTE À L'HÉMISPHÈRE, IL NE S'ÉCRIT PAS À
      // CÔTÉ.** Les deux sont des irradiances INDIRECTES que le socle accumule
      // dans le même `irradiance` avant de le passer au même `BRDF_Lambert`
      // (`lights_fragment_begin`). Les séparer en deux termes du nuanceur
      // aurait fabriqué une troisième loi pour un total identique.
      const amb = irradianceAmbiante(ambianteCoef, ambianteIntensite)
      u.uCielIrr.value.set(
        u.uCielIrr.value.x + amb.ciel[0],
        u.uCielIrr.value.y + amb.ciel[1],
        u.uCielIrr.value.z + amb.ciel[2]
      )
      u.uSolIrr.value.set(
        u.uSolIrr.value.x + amb.sol[0],
        u.uSolIrr.value.y + amb.sol[1],
        u.uSolIrr.value.z + amb.sol[2]
      )
      // ══════ ET LA PAROI PREND SON PROPRE ENVIRONNEMENT — Tâche P8 ══════════
      //
      // ⚠️ **LA LAMPE HÉMISPHÉRIQUE EST LA MÊME, L'ENVIRONNEMENT NON.** Une
      // `HemisphereLight` éclaire toute la scène ; un `envMap` posé sur un
      // matériau n'éclaire que lui. On repart donc du même hémisphère et on lui
      // ajoute l'ambiante DE LA PAROI au lieu de celle du relief.
      //
      // ⚠️ **SANS DONNÉE DE PAROI, ON RECOPIE CELLE DES TUILES** — pas zéro : le
      // défaut doit être l'image d'avant cette tâche, au bit près.
      const ambParoi = paroiAmbianteCoef != null || Number.isFinite(paroiAmbianteIntensite)
        ? irradianceAmbiante(paroiAmbianteCoef, paroiAmbianteIntensite)
        : null
      if (ambParoi) {
        poserIrradiance(u.uParoiCielIrr.value, hemiCiel, hemiIntensite)
        poserIrradiance(u.uParoiSolIrr.value, hemiSol, hemiIntensite)
        u.uParoiCielIrr.value.set(
          u.uParoiCielIrr.value.x + ambParoi.ciel[0],
          u.uParoiCielIrr.value.y + ambParoi.ciel[1],
          u.uParoiCielIrr.value.z + ambParoi.ciel[2]
        )
        u.uParoiSolIrr.value.set(
          u.uParoiSolIrr.value.x + ambParoi.sol[0],
          u.uParoiSolIrr.value.y + ambParoi.sol[1],
          u.uParoiSolIrr.value.z + ambParoi.sol[2]
        )
      } else {
        u.uParoiCielIrr.value.copy(u.uCielIrr.value)
        u.uParoiSolIrr.value.copy(u.uSolIrr.value)
      }
      if (albedoBase != null) {
        // ⚠️ **`setStyle`, PAS `set`** : `set` accepte aussi un nombre, et une
        // chaîne '#rrggbb' est ce que le contexte transporte (une chaîne se
        // compare par `Object.is`, un `THREE.Color` muté en place ne se compare
        // pas — la remarque que `CHAMPS_HABILLAGE` porte déjà pour `hazeColor`).
        // Le passage sRVB → linéaire est celui de three, pas une formule écrite ici.
        _couleurTampon.setStyle(albedoBase, THREE.SRGBColorSpace)
        u.uAlbedoBase.value.set(_couleurTampon.r, _couleurTampon.g, _couleurTampon.b)
      }
      if (Number.isFinite(albedoTeinte)) u.uAlbedoTeinte.value = albedoTeinte
      // ══════ ⚡ L'APPOINT — Tâche R21, options 69 à 73 ════════════════════
      //
      // ⛔ **IL EST DANS `if (aLumiere)`, ET C'EST OBLIGATOIRE, PAS UN
      // RANGEMENT.** `directionAppointMonde` a besoin de `centreLat`/`centreLon`
      // — les mêmes que le soleil, et pour la même raison : sans repère, poser
      // l'appoint du golfe de Guinée sur La Réunion. Le garde d'`aLumiere` les
      // a déjà vérifiés finis.
      //
      // ⚠️ **L'INTENSITÉ VIENT DE LA LAMPE, PAS DE `params`** — c'est
      // `contexteCrop` qui l'y lit, et le §6 de `lumiere-sphere.js` chiffre
      // pourquoi : `fillLightIntensity` rend **0 exactement** quand
      // l'interrupteur est éteint, et écrête à **[0 ; 4]**. `params` ne porte
      // ni l'un ni l'autre.
      const dirAppoint = Number.isFinite(appointIntensite) && appointCouleur != null
        ? directionAppointMonde(soleilAzimut, appointAzimut, appointElevation, centreLat, centreLon)
        : null
      if (dirAppoint) {
        u.uAppointDir.value.fromArray(dirAppoint)
        poserIrradiance(u.uAppointIrr.value, appointCouleur, appointIntensite)
      } else {
        u.uAppointDir.value.fromArray(APPOINT_MONDE_ETEINT.dir)
        u.uAppointIrr.value.fromArray(APPOINT_MONDE_ETEINT.irr)
      }
    }
    // ══════ L'OMBRAGE DES PENTES — Tâche R21, option 30 ══════════════════════
    //
    // ⚠️ **HORS DU `if (aLumiere)`, ET C'EST DÉLIBÉRÉ** : c'est une couche de
    // CARTE, pas une lumière. `uAnalysisOn` et `uTexShade`, ses deux voisins de
    // la colorisation, sont posés dehors eux aussi — la borner à l'éclairage
    // l'éteindrait avec `uEclairageOn`, exactement le défaut que le bloc de la
    // photo aérienne nomme (« `dedansCrop` ET NON `partBloc` »).
    //
    // ⚠️ **ÉCRÊTÉ : un `NaN` dans un uniforme éteint la moitié d'un GPU sans un
    // mot** — la remarque que `poserEstompage` porte déjà.
    u.uSlopeTint.value = Number.isFinite(slopeTint) ? Math.min(1, Math.max(0, slopeTint)) : PENTE_MONDE_NULLE

    // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
    //
    // ⚠️ **`| 0` SUR LES DEUX ENTIERS, ET CE N'EST PAS DE LA COQUETTERIE** :
    // `uSurfaceFx` et `uFxBlend` sont des `int` GLSL. Un flottant y arrive
    // tronqué ou pas du tout selon le pilote, sans qu'aucune erreur soit levée
    // — et `terrain.js` fait déjà `this.mapUniforms.uSurfaceFx.value = id | 0`.
    u.uSurfaceFx.value = Number.isFinite(surfaceFx) ? surfaceFx | 0 : APPARENCE_MONDE.surfaceFx
    u.uFxBlend.value = Number.isFinite(fxBlend) ? fxBlend | 0 : APPARENCE_MONDE.fxBlend
    u.uFxOpacite.value = Number.isFinite(fxOpacity) ? fxOpacity : APPARENCE_MONDE.fxOpacity
    if (Number.isFinite(fxScale)) u.uFxScale.value = fxScale
    if (fxColA != null) u.uFxColA.value.setStyle(fxColA, THREE.SRGBColorSpace)
    if (fxColB != null) u.uFxColB.value.setStyle(fxColB, THREE.SRGBColorSpace)
    if (fxColC != null) u.uFxColC.value.setStyle(fxColC, THREE.SRGBColorSpace)
    if (Number.isFinite(fxP1)) u.uFxP1.value = fxP1
    if (Number.isFinite(fxP2)) u.uFxP2.value = fxP2
    if (Number.isFinite(fxP3)) u.uFxP3.value = fxP3
    if (Number.isFinite(fxDemiBloc) && fxDemiBloc > 0) u.uFxDemiBloc.value = fxDemiBloc
    if (Number.isFinite(fxFenetreX) && Number.isFinite(fxFenetreY)) u.uFxFenetre.value.set(fxFenetreX, fxFenetreY)

    // ══════ LA COULEUR DES PAROIS — Tâche P3, manque n° 2 ════════════════════
    if (paroiCouleur != null) u.uParoiCouleur.value.setStyle(paroiCouleur, THREE.SRGBColorSpace)
    return u
  }

  /**
   * Retire l'habillage — le globe reprend son propre rendu, au bit près.
   *
   * ⚠️ **CETTE PROMESSE ÉTAIT FAUSSE, ET LE TOUR 1 L'A CORRIGÉE.** La version
   * livrée ne rendait que quatre uniformes sur seize. Or `uContourInterval` et
   * `uContourOpacity` sont **PARTAGÉS par toutes les tuiles** et le bloc des
   * courbes les lit **SANS GARDE** — `uHabOn` à 0 ne les neutralise pas. Après
   * `poserHabillage` puis `retirerCrop`, **la planète entière gardait
   * l'intervalle du crop** : 250 m à La Réunion au lieu de 500.
   *
   * ⚠️ **ET LES TEXTURES SONT LÂCHÉES**, pas seulement débranchées : gardées
   * dans un uniforme partagé, le masque de côte et la mosaïque d'occupation du
   * sol du crop précédent restaient joignables par le ramasse-miettes.
   * `test/crop-habillage.test.js` (⑨) exige l'aller-retour bit à bit sur les
   * SEIZE.
   */
  /**
   * Donne au globe SANS CROP la table et le cadrage de rampe du bloc — Tâche R11.
   *
   * ⚠️ **UNE SEULE ENTRÉE, LE LUT ; LE RESTE EST MESURÉ.** Le contraste et le
   * pivot ne viennent PAS de l'appelant : les valeurs du bloc sont graduées sur
   * le relief d'un crop (`relief-grade.js` → `applyAutoShade`), et les poser sur
   * la planète entière peindrait le monde avec l'échelle d'une île. C'est
   * `GRADE_MONDE` qui décide, et il est dérivé d'un balayage mondial du MNT —
   * voir le §⑤ de `rampe-crop.js`.
   *
   * ⚠️ **APPELABLE À TOUT MOMENT, ET IL APPLIQUE TOUT DE SUITE QUAND IL N'Y A
   * PAS DE CROP.** `rebuildRamp` recuit le LUT à chaque changement de palette,
   * y compris en orbite où aucun crop ne vit : sans cette application immédiate,
   * la planète garderait la table de la palette précédente jusqu'à la prochaine
   * mort de crop — un état qui traîne, exactement ce que `retirerHabillage`
   * existe pour empêcher.
   *
   * ⛔ **ON PREND LE PORTEUR (`{ value }`), PAS LA TEXTURE — ET C'EST UNE FUITE
   * ÉVITÉE, PAS UN STYLE.** `terrain.rebuildRamp` fait
   * `uRampTex.value?.dispose()` puis pose une texture NEUVE : il recuit le LUT à
   * chaque palette, à chaque `rampDry` / `rampWet`, et à chaque bascule
   * Classique ↔ Naturel — **quatre sites**. Garder la TEXTURE ici l'aurait
   * laissée pointer sur un objet libéré dès le premier de ces quatre, et le
   * globe aurait échantillonné une texture morte. Le porteur, lui, pointe
   * toujours sur la vivante : `_majRampeMonde` le relit à chaque image.
   *
   * @param {{value: THREE.Texture|null}|null} porteur `terrain.mapUniforms.uRampTex`
   *   — **l'uniforme lui-même**. `null` rend au globe sa rampe 1D d'avant, au
   *   bit près.
   */
  poserRampeMonde(porteur = null) {
    this._rampeMonde = porteur && typeof porteur === 'object' ? porteur : null
    this._majRampeMonde()
  }

  /**
   * Recolle les quatre uniformes de la loi naturelle sur l'état de repos du
   * monde — appelé par `update()`, donc à chaque image.
   *
   * ⚠️ **UNE COMPARAISON AVANT D'ÉCRIRE, ET CE N'EST PAS DE L'AVARICE** :
   * `uRampCrop` est PARTAGÉ par les 1 700 matériaux de tuile ; écrire un
   * `sampler2D` qui n'a pas changé forcerait three à repasser la liaison de
   * texture à chaque image, sur chaque matériau.
   */
  _majRampeMonde() {
    if (this._crop) return // le crop décide tant qu'il vit — `retirerHabillage` prend le relais
    const u = this.uniforms
    const lut = this._rampeMonde?.value || null
    if (u.uRampCrop.value === lut && u.uRampCropOn.value === (lut ? 1 : 0)) return
    u.uRampCrop.value = lut
    u.uRampCropOn.value = lut ? 1 : 0
    u.uHeightContrast.value = lut ? GRADE_MONDE.heightContrast : NATUREL_MONDE.heightContrast
    u.uHeightPivot.value = lut ? GRADE_MONDE.heightPivot : NATUREL_MONDE.heightPivot
  }

  retirerHabillage() {
    const u = this.uniforms
    u.uHabOn.value = 0
    u.uCoastMask.value = null
    u.uCoastMaskOn.value = 0
    u.uMargeCoteM.value = HABILLAGE_MONDE.margeCoteM
    u.uSol.value = null
    u.uSolLut.value = null
    u.uSolOn.value = 0
    u.uSolOpacite.value = HABILLAGE_MONDE.solOpacite
    u.uSolOffset.value.set(0, 0)
    u.uSolScale.value.set(1, 1)
    u.uSolTexel.value.set(1 / 2048, 1 / 2048)
    // ══════ LA PHOTO AÉRIENNE — Tâche R9 ═════════════════════════════════════
    //
    // ⚠️ **LÂCHÉE, PAS SEULEMENT DÉBRANCHÉE** — même raison que le masque de
    // côte et l'analyse : une mosaïque aérienne est un canevas de plusieurs
    // milliers de pixels de côté, retenu par un uniforme **PARTAGÉ** par tous
    // les matériaux de tuile. La garder joignable après la mort du crop, c'est
    // exactement la fuite que ce bloc répare déjà deux fois.
    //
    // ⚠️ **ET L'AFFINE REVIENT AU NEUTRE, comme `uSolOffset` / `uSolScale`** :
    // c'est l'aller-retour bit-à-bit que `test/crop-habillage.test.js` (⑨) exige
    // de l'habillage — un uniforme resté sur le cadrage d'un crop mort est un
    // état qui traîne, et ce fichier en a déjà payé un.
    u.uAerial.value = null
    u.uAerialOn.value = 0
    u.uAerialOpacity.value = HABILLAGE_MONDE.aerialOpacite
    u.uAerialOffset.value.set(0, 0)
    u.uAerialScale.value.set(1, 1)
    u.uAerialCoastFade.value = HABILLAGE_MONDE.aerialCoastFade
    u.uContourInterval.value = HABILLAGE_MONDE.contourIntervalM
    u.uContourOpacity.value = HABILLAGE_MONDE.contourOpacite
    u.uContourWeight.value = HABILLAGE_MONDE.contourPoids
    // ══════ ET LA GRILLE DE RELEVÉ S'ÉTEINT — Tâche R22 ═════════════════════
    //
    // ⚠️ **MÊME MOTIF QUE `uContourInterval` JUSTE AU-DESSUS, ET LE MÊME PIÈGE
    // ÉVITÉ.** `uGridOpacity`, `uGridStepM`, `uGridColor` et `uCropDemiM` sont
    // des uniformes **PARTAGÉS par toutes les tuiles**, et le bloc de grille les
    // lit sans consulter `uHabOn`. Sans ces quatre lignes, un `retirerCrop`
    // laisserait la planète entière porter le pas de grille du crop mort —
    // exactement le défaut que le tour 1 de la Tâche C a corrigé sur
    // l'intervalle des courbes, et qu'il aurait fallu payer une seconde fois.
    // ⚡ Le carroyage ne se verrait pas pour autant (`dedansCrop` vaut zéro hors
    // découpe) : c'est un état qui traîne, pas un pixel. **On le rend quand
    // même** — `test/crop-habillage.test.js` (⑨) exige l'aller-retour bit à bit.
    u.uGridStepM.value = HABILLAGE_MONDE.gridPasM
    u.uGridOpacity.value = HABILLAGE_MONDE.gridOpacite
    u.uGridColor.value.set(HABILLAGE_MONDE.gridCouleur)
    u.uCropDemiM.value = 0
    u.uGrainForceM.value = HABILLAGE_MONDE.grainForceM
    u.uGrainEchelle.value = HABILLAGE_MONDE.grainEchelle
    // ⚠️ **ET LA NORMALE FINE S'ÉTEINT — Tâche P9.** Sans crop il n'y a plus de
    // bloc à modeler, et `HABILLAGE_MONDE.normaleFine` vaut faux : c'est
    // l'aller-retour bit-à-bit que `test/crop-habillage.test.js` (⑨) exige.
    // ⚠️ **`uUnitesParMetre` N'EST PAS RENDU, ET C'EST DÉLIBÉRÉ** : ce n'est pas
    // un réglage d'habillage mais l'échelle verticale DU GLOBE, qui vaut pour
    // toute la planète et que `setExaggeration` tient à jour.
    //
    // ⚡ **SAUF SOUS D15 — Tâche R6, ET C'EST ICI QUE LE DÉFAUT SE REFERMAIT.**
    // `retirerHabillage` est appelé à CHAQUE MORT DU CROP, c'est-à-dire chaque
    // fois qu'on remonte au-dessus de 32 274 m. Laisser cette ligne rendre 0
    // aurait rendu la planète nue au moment précis où on la regarde — le
    // drapeau aurait été sans effet sur la moitié du chantier.
    u.uNormaleFineOn.value = this.planeteEclairee
      ? MONDE_ECLAIRE.normaleFine
      : (HABILLAGE_MONDE.normaleFine ? 1 : 0)
    // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
    //
    // ⚠️ **LES DEUX TEXTURES SONT LÂCHÉES, PAS SEULEMENT DÉBRANCHÉES** — même
    // raison que le masque de côte deux lignes plus haut : gardées dans un
    // uniforme PARTAGÉ, l'analyse et le LUT du crop précédent restaient
    // joignables par le ramasse-miettes, et l'analyse d'un MNT 1536² pèse 12 Mo
    // mipmaps comprises (`terrain.js`, `_analysisMax`).
    //
    // ⚠️ **ET LES CURSEURS SONT RENDUS AUSSI, ALORS QU'ILS SONT DÉJÀ GARDÉS.**
    // Ce n'est pas du code mort : `uHeightContrast` et `uHeightPivot` entrent
    // dans `natRampT` **sous la seule garde `uRampCropOn`**, et l'aller-retour
    // bit-à-bit que `test/crop-habillage.test.js` (⑨) exige des seize uniformes
    // de l'habillage porte sur les VALEURS, pas sur leur effet — un uniforme
    // resté au réglage d'un crop mort est un état qui traîne, et ce fichier en a
    // déjà payé un (`uContourInterval`, la planète entière à 250 m).
    u.uAnalysis.value = null
    u.uAnalysisOn.value = 0
    // ⚠️ **L'ENTREE DU GRADE DE BLOC PART AVEC L'HABILLAGE — Tache GRA**, et
    // c'est ce qui rend `_majGradeBloc` inoffensif hors du crop : sans elle il
    // ne fait rien, et les deux lignes `GRADE_MONDE` / `NATUREL_MONDE` d'en bas
    // reprennent la main sans avoir a se defendre d'un second ecrivain.
    this._gradeSocle = null
    // ⚡ **SAUF SOUS D15 — Tâche R28, et c'est ici que la moitié ④ se refermait.**
    // Ce site est appelé à CHAQUE mort de crop, donc dans la vue lointaine
    // elle-même. Rendre zéro y aurait éteint le peigne du monde au moment précis
    // où Adrien le regarde. Même patron, même raison et même ligne que
    // `uNormaleFineOn` cinquante lignes plus haut — et `MONDE_NU.texShade` VAUT
    // `NATUREL_MONDE.texShade`, un test le verrouille.
    u.uTexShade.value = styleMonde(this.planeteEclairee).texShade
    u.uWetK.value = NATUREL_MONDE.wetK
    u.uExpoK.value = NATUREL_MONDE.expoK
    u.uHemi.value = NATUREL_MONDE.hemi
    u.uTreeLine.value = NATUREL_MONDE.treeLine
    // ══════ LA LOI DU BLOC SURVIT AU CROP — Tâche R11 ═══════════════════════
    //
    // ⛔ **C'EST ICI QUE LES DEUX MONDES D'ADRIEN SE SÉPARAIENT.** `uRampCrop`
    // partait avec l'analyse, donc `uRampCropOn` retombait à zéro, donc la
    // sphère repassait à la loi LINÉAIRE `0,35 + 0,65 · hNorm` sur la rampe 1D
    // — pendant que le bloc, lui, indexait `natRampT` sur le LUT 2D. Deux lois,
    // deux tables, à un mètre d'altitude de caméra d'écart.
    //
    // ⚠️ **ET LE LUT N'EST PAS UNE TEXTURE DE CROP** : c'est `uRampTex`, la
    // table du SOCLE, que `rebuildRamp` recuit à chaque palette et que le socle
    // détient de toute façon. Le lâcher ici ne libérait rien — l'argument
    // « lâchées, pas seulement débranchées » vaut pour `uAnalysis` (12 Mo par
    // MNT 1536²), qui part toujours, et pour `uCoastMask`. Le LUT reste.
    //
    // ⚠️ **L'ANALYSE, ELLE, NE SUIT PAS — ET C'EST MESURÉ, PAS RENONCÉ.**
    // Neutralisée seule sur le bloc, l'humidité vaut **ΔE 2,89** quand les
    // bornes en valent 25,82 et la loi X 20,76 (relevé complet dans
    // `rampe-crop.js`, §⑤). Elle ne se pave pas — voir le rapport R11, Étape 3.
    // `wetY` retombe donc sur `natHumiditeY(0,5 ; 0,5 ; …) = 0,5` exactement,
    // c'est-à-dire la LIGNE MÉDIANE du LUT, c'est-à-dire la rampe historique.
    const lutMonde = this._rampeMonde?.value || null
    u.uRampCrop.value = lutMonde
    u.uRampCropOn.value = lutMonde ? 1 : 0
    u.uHeightContrast.value = lutMonde ? GRADE_MONDE.heightContrast : NATUREL_MONDE.heightContrast
    u.uHeightPivot.value = lutMonde ? GRADE_MONDE.heightPivot : NATUREL_MONDE.heightPivot
    // ⛔ **LE VOILE NE SUIT PAS, ET CE N'EST PAS UN OUBLI.** `natVoile` lit
    // `fd = length(qCrop)`, une distance au centre du CROP. Sans crop, `qCrop`
    // est la dernière emprise morte : le voile peindrait un dégradé centré sur
    // un lieu qu'on a quitté. Il reste donc à `NATUREL_MONDE.hazeAmt = 0`.
    u.uHazeAmt.value = NATUREL_MONDE.hazeAmt
    u.uHazeAlt.value = NATUREL_MONDE.hazeAlt
    u.uHazeDist.value = NATUREL_MONDE.hazeDist
    u.uHazeColor.value.set(NATUREL_MONDE.hazeColor)
    // ══════ L'ÉCLAIRAGE ET LA PAROI — Tâche P3 ═══════════════════════════════
    //
    // ⚠️ **RENDUS AUSSI, POUR LA RAISON QUE CE BLOC PORTE DÉJÀ POUR LES DIX
    // CURSEURS DU NATUREL** : l'aller-retour bit-à-bit que
    // `test/crop-habillage.test.js` exige porte sur les VALEURS, pas sur leur
    // effet. Un uniforme resté sur le soleil d'un crop mort est un état qui
    // traîne, et ce fichier en a déjà payé un (`uContourInterval`, la planète
    // entière à 250 m).
    u.uEclairageOn.value = 0
    u.uSoleilDir.value.set(0, 1, 0)
    u.uHemiHaut.value.set(0, 1, 0)
    u.uSoleilIrr.value.fromArray(ECLAIRAGE_MONDE.soleilIrr)
    u.uCielIrr.value.fromArray(ECLAIRAGE_MONDE.cielIrr)
    u.uSolIrr.value.fromArray(ECLAIRAGE_MONDE.solIrr)
    // ⚠️ **L'APPOINT ET LES PENTES AUSSI — Tâche R21**, et pour la raison que ce
    // bloc porte déjà : l'aller-retour bit à bit d'`⑨h` porte sur les VALEURS,
    // pas sur leur effet. Un appoint resté sur le soleil d'un crop mort est un
    // état qui traîne, et `uSlopeTint` est PARTAGÉ par toutes les tuiles — c'est
    // exactement la fuite d'`uContourInterval` (la planète entière à 250 m).
    u.uAppointDir.value.fromArray(APPOINT_MONDE_ETEINT.dir)
    u.uAppointIrr.value.fromArray(APPOINT_MONDE_ETEINT.irr)
    u.uSlopeTint.value = PENTE_MONDE_NULLE
    // ⚠️ **ET LA MATIÈRE AUSSI — Tâche R25**, pour la raison que ce bloc porte
    // déjà : l'aller-retour bit à bit d'⑨h porte sur les VALEURS. Une matière
    // restée posée sur un crop mort est un état qui traîne — et `uMatMap` est
    // en plus une TEXTURE retenue en mémoire vidéo pour rien.
    u.uMatOn.value = MATIERE_MONDE_ETEINTE.on
    u.uMatMap.value = null
    u.uMatNormal.value = null
    u.uMatNormalOn.value = MATIERE_MONDE_ETEINTE.normalOn
    u.uMatRepeat.value = MATIERE_MONDE_ETEINTE.repeat
    u.uMatBump.value = MATIERE_MONDE_ETEINTE.bump
    u.uMatNoiseOn.value = MATIERE_MONDE_ETEINTE.noiseOn
    u.uMatNoiseCut.value = MATIERE_MONDE_ETEINTE.noiseCut
    u.uMatNoiseSoft.value = MATIERE_MONDE_ETEINTE.noiseSoft
    u.uMatNoiseScale.value = MATIERE_MONDE_ETEINTE.noiseScale
    u.uMatAboveZero.value = MATIERE_MONDE_ETEINTE.aboveZero
    u.uMatBandeM.value = MATIERE_MONDE_ETEINTE.bandeM
    // ⚠️ **LES DEUX DE LA PAROI AUSSI — Tâche P8**, et pour la raison que ce
    // bloc porte déjà : l'aller-retour bit-à-bit porte sur les VALEURS. Une
    // paroi restée sur le studio d'un crop mort est un état qui traîne.
    u.uParoiCielIrr.value.fromArray(ECLAIRAGE_MONDE.cielIrr)
    u.uParoiSolIrr.value.fromArray(ECLAIRAGE_MONDE.solIrr)
    u.uAlbedoBase.value.fromArray(ECLAIRAGE_MONDE.albedoBase)
    u.uAlbedoTeinte.value = ECLAIRAGE_MONDE.albedoTeinte
    u.uParoiCouleur.value.set('#d8d4cc')
    u.uSurfaceFx.value = APPARENCE_MONDE.surfaceFx
    u.uFxBlend.value = APPARENCE_MONDE.fxBlend
    u.uFxOpacite.value = APPARENCE_MONDE.fxOpacity
    u.uFxScale.value = APPARENCE_MONDE.fxScale
    u.uFxTime.value = APPARENCE_MONDE.fxTime
    u.uFxColA.value.set(APPARENCE_MONDE.fxColA)
    u.uFxColB.value.set(APPARENCE_MONDE.fxColB)
    u.uFxColC.value.set(APPARENCE_MONDE.fxColC)
    u.uFxP1.value = APPARENCE_MONDE.fxP1
    u.uFxP2.value = APPARENCE_MONDE.fxP2
    u.uFxP3.value = APPARENCE_MONDE.fxP3
    u.uFxDemiBloc.value = APPARENCE_MONDE.fxDemiBloc
    u.uFxFenetre.value.set(APPARENCE_MONDE.fxFenetreX, APPARENCE_MONDE.fxFenetreY)
  }

  /**
   * L'horloge de la couche Apparence — Tâche P3.
   *
   * ⚠️ **ELLE EST À PART DE `poserHabillage`, ET C'EST UNE OBLIGATION, PAS UN
   * RANGEMENT.** `uFxTime` avance à chaque image (`terrain.js` :
   * `uFxTime.value += dt * speed`) ; passé par `CHAMPS_HABILLAGE`, il mettrait
   * `habillageDifferent` à vrai soixante fois par seconde et reposerait
   * l'habillage entier — textures comprises — à chaque image.
   *
   * ⚠️ **ET ON RECOPIE L'HORLOGE DU SOCLE PLUTÔT QUE D'EN AVANCER UNE
   * SECONDE** : deux compteurs sur deux `dt` finiraient déphasés, et le motif du
   * crop ne serait plus celui du bloc à la même seconde.
   */
  poserTempsApparence(t) {
    if (Number.isFinite(t)) this.uniforms.uFxTime.value = t
  }

  // ═══════════ LA RAMPE — Tâche D, « calculée sur le crop, suivie par les
  //             alentours » ══════════════════════════════════════════════════
  //
  // **Décision 4 d'Adrien, mot pour mot :** « La rampe se calcule SUR LE CROP,
  // et les alentours la suivent. » Couleurs stables et reproductibles pour
  // l'affiche, **aucune couture au bord**.
  //
  // ⚠️ **C'EST LE DÉFAUT QUE SES CAPTURES MONTRENT, ET IL EST CHIFFRÉ** : à
  // l'île Maurice, qui culmine à 828 m, la rampe mondiale (`uLandMax = 5600`)
  // n'utilise que **14,3 % du bas de sa rampe** — le vert — quand le socle
  // l'étale sur 100 % jusqu'aux blancs. Le chiffre est rejoué contre le dépôt
  // par `.banc/rejoue-D.mjs`, qui ÉVALUE l'expression extraite de
  // `git show 82e8b87:src/globe.js` : `t(828 m) = 0,4429`.
  //
  // ⚠️ **R1 — LA BOUCLE EST COUPÉE, ET ELLE A ÉTÉ VÉRIFIÉE AVANT D'ÉCRIRE UNE
  // LIGNE.** La rampe est une décision de RENDU : elle a le droit de LIRE le
  // relief. Ce qui est interdit, c'est qu'une décision de CADRAGE la relise —
  // R1 a mordu trois fois sur ce chantier, dont un pilote d'exagération de gain
  // mesuré 1,44, donc divergent. Les quatre sorties de cette méthode ne vont que
  // dans des uniformes de COULEUR, et `test/crop-rampe.test.js` (⑥a) échoue si
  // `seuil-socle.js`, `descente-bornee.js`, `exageration-continue.js`,
  // `veille-socle.js` ou `flux-terrain.js` se met à les lire.
  //
  // ⚠️ **ELLE NE TOURNE PAS PAR IMAGE.** Comme `construireParoisCrop`, elle
  // balaie le crop entier : décision 5 du plan précédent, « la gravure ne
  // s'écrit qu'à l'arrêt ». L'appelant décide quand.
  //
  // ⚠️ **CETTE MÉTHODE EST LE SEUL INTERRUPTEUR.** Tant que personne ne
  // l'appelle, les quatre uniformes valent `RAMPE_MONDE` et le globe est celui
  // d'avant, au bit près.

  /**
   * Calcule la rampe sur le relief du crop, et la pose pour TOUTE la planète.
   *
   * @param {object} [arg]
   * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number}} [arg.echelle]
   *   impose l'échelle au lieu de la mesurer (bancs, tests, réglage manuel)
   * @param {number} [arg.pas] finesse du balayage — voir `PAS_MESURE`
   * @param {number} [arg.couvertureMin] ⚠️ **1 par défaut, et c'est le §7 de
   *   `parois-crop.js` appliqué à la rampe** : une tuile manquante rend `null`,
   *   et prendre `null` pour zéro repeindrait tout le crop.
   * @returns {{refus:string|null, echelle:object|null, mesure:object|null}}
   */
  poserRampe({ echelle = null, pas = PAS_MESURE, couvertureMin = 1, altitudeM = null, zeroSousEau = false } = {}) {
    const u = this.uniforms
    let e = echelle
    let mesure = null
    if (!e) {
      if (!this._crop) return { refus: 'crop', echelle: null, mesure: null }
      // ⚠️ LA LISTE EST PRÉ-FILTRÉE UNE FOIS, comme pour les parois : le balayage
      // fait `pas²` points, et reparcourir `this.tiles` (jusqu'à 1 700 entrées)
      // à chacun ferait des dizaines de millions d'itérations.
      const liste = this.tuilesAvecHauteurs()
      mesure = mesurerRelief({
        repere: this._crop,
        forme: { coin: u.uCropCoin.value, expo: u.uCropCoinN.value },
        hauteur: (lat, lon) => this.hauteurSurface(lat, lon, liste),
        pas,
        couvertureMin,
      })
      // ⚠️ **LE REFUS NE TOUCHE PAS À LA RAMPE EN PLACE.** C'est ce qui le rend
      // acceptable : les couleurs précédentes restent à l'écran jusqu'à ce que
      // la donnée arrive, et l'appelant n'a rien à défaire. Même discipline que
      // le refus de couverture des parois.
      if (mesure.refus) return { refus: mesure.refus, echelle: null, mesure }
      e = echelleRampe(mesure, { plancherM: plancherRampeDuCrop(this._crop) })
    }
    // ══════ LE GRADE DU BLOC — Tache GRA ═════════════════════════════════════
    //
    // ⛔ **IL NE SE CALCULE QUE SUR UNE MESURE, ET C'EST LA GARDE DE L'AFFICHE.**
    // `poserRampe({ echelle })` — les bancs, les tests, le reglage manuel — ne
    // mesure pas : il n'y a alors ni histogramme ni grade, `_gradeBlocM` retombe
    // a `null`, et `gradeBlocEffectif` rend les valeurs du socle TELLES QUELLES.
    // Le globe de ces appelants-la est celui d'avant, au bit pres. C'est la meme
    // discipline que le zero de `uRecollage` sans altitude (R31).
    //
    // ⚠️ **ET IL EST EN METRES**, donc il survit au glissement de
    // `[uReliefBas ; uLandMax]` que `majEchelleRampe` opere par image. Le §⑨ de
    // `rampe-crop.js` dit pourquoi un `hNorm` fige ici rejouerait le defaut.
    this._gradeBlocM = mesure
      ? gradeCrop(mesure, { extentM: largeurCropM(this._crop) })
      : null
    // ⚠️ **LA MESURE SE GARDE, SANS SON HISTOGRAMME.** Les bancs de GRA lisent
    // `minM` / `maxM` / `moyenneM` / `vus` pour verifier que le bloc s'est bien
    // grade sur LE MEME relief d'un zoom a l'autre — sans quoi on ne saurait pas
    // distinguer « le grade derive » de « le relief lu derive ». Les 4 Ko de
    // l'histogramme, eux, ne servent plus une fois le grade calcule.
    this._mesureBloc = mesure
      ? { minM: mesure.minM, maxM: mesure.maxM, minTerreM: mesure.minTerreM, maxTerreM: mesure.maxTerreM, moyenneM: mesure.moyenneM, vus: mesure.vus, couverture: mesure.couverture }
      : null
    // ⚠️ **LE ZÉRO DE LA MER SUIT LA RAMPE, ET IL EST OPTIONNEL** — Tâche K
    // bis. `false` par défaut : un appelant qui ne le demande pas retrouve le
    // globe d'avant au bit près, et les bancs de la Tâche D continuent de poser
    // une échelle sans changer la couleur du plan de mer.
    if (zeroSousEau) u.uMerZeroSousEau.value = 1

    // ══════ L'ÉCHELLE CONTINUE — Tâche K bis ═══════════════════════════════
    //
    // ⚠️ **AVEC UNE ALTITUDE, LA MESURE N'EST PLUS POSÉE : ELLE EST ANCRÉE.**
    // C'est toute la tâche. Ce qui atteint les uniformes est la valeur d'une
    // courbe monotone évaluée à l'altitude de l'image, et `majEchelleRampe` la
    // réévalue par image — donc l'échelle GLISSE au lieu de sauter.
    //
    // ⚠️ **SANS ALTITUDE, LE CHEMIN EST CELUI DU DÉPÔT, AU BIT PRÈS.** Ce n'est
    // pas une politesse envers les tests : `poserRampe({ echelle })` est le
    // point d'entrée des bancs et du réglage manuel, et leur imposer un cran
    // d'altitude leur ferait mesurer autre chose que ce qu'ils demandent.
    if (Number.isFinite(altitudeM)) {
      ancrerMesure(this._echelleContinue, altitudeM, e)
      const v = majEchelle(this._echelleContinue, altitudeM)
      this._poserUniformesRampe(v, altitudeM)
      this._rampe = e
      return { refus: null, echelle: e, mesure, posee: v }
    }

    this._poserUniformesRampe(e)
    this._rampe = e
    return { refus: null, echelle: e, mesure }
  }

  /**
   * ⚠️ **LE SEUL SITE QUI ÉCRIT LES QUATRE UNIFORMES DE RAMPE.** Il y en avait
   * DEUX (`poserRampe` et `retirerRampe`), plus un troisième pour le budget du
   * fond dans `poserMer` : trois écritures qui pouvaient diverger, et deux
   * l'avaient déjà fait — c'est le relevé `uOceanDepth = 130,36 m` sous
   * 2 116,3 m de fond que la Tâche J bis a corrigé par une LISTE de lecteurs.
   *
   * ⚠️ **`fondBudget` EST BORNÉ À 1 m COMME AVANT** (`Math.max(profMaxM, 1)`,
   * ligne d'origine de `poserMer`) : ce n'est pas un plancher neuf, c'est celui
   * du dépôt, déplacé ici pour qu'il n'y en ait qu'un.
   */
  _poserUniformesRampe(e, altitudeM = null) {
    const u = this.uniforms
    u.uLandBas.value = e.terreBas
    u.uLandMax.value = e.terreHaut
    u.uOceanDepth.value = e.profondeur
    // ⚠️ **`e.creux` SE LIT SANS GARDE, ET C'EST UN CONTRAT, PAS UN OUBLI** —
    // Tâche P11. `echelleRampe` et `majEchelle` le rendent TOUS LES DEUX, sur
    // toutes leurs branches (`test/crop-rampe.test.js` ①j). Un repli ici serait
    // un repli qu'aucun appelant réel ne peut déclencher — la faute que la Tâche
    // D a retirée d'`echelleRampe`, et il masquerait un `NaN` dans un uniforme,
    // c'est-à-dire une comparaison FAUSSE dans le nuanceur.
    u.uReliefBas.value = e.terreBas - e.creux
    u.uPlancherRampeM.value = e.plancherM
    // ⚠️ **LE BUDGET DU FOND NE S'ÉCRIT QUE SI LA RAMPE NAUTIQUE EST ALLUMÉE.**
    // Éteinte, `uMerFondBudgetM` ne peint rien (le nuanceur le garde derrière
    // `uMerRampeOn > 0.5`) et `retirerMer` est le seul à devoir le rendre à
    // `RAMPE_MONDE`. L'écrire ici de toute façon ferait deux écrivains pour un
    // uniforme éteint — le genre de code mort que ce chantier a trouvé quatre
    // fois.
    if (u.uMerRampeOn.value > 0.5 && Number.isFinite(e.fondBudget)) {
      u.uMerFondBudgetM.value = Math.max(e.fondBudget, 1)
    }
    // ══════ LE RECOLLAGE — Tâche R31 ═════════════════════════════════════
    //
    // ⚠️ **ICI, ET NULLE PART AILLEURS** : c'est déjà l'écrivain unique des
    // quatre nombres de rampe, et le poids de recollage est le CINQUIÈME —
    // même famille, même cadence, même appelant. Un second écrivain aurait
    // rejoué le défaut que ce site existe pour avoir supprimé.
    //
    // ⛔ **SANS ALTITUDE, ZÉRO — ET C'EST LA GARDE DE L'AFFICHE.**
    // `poserRampe({ echelle })` (les bancs, le réglage manuel, les tests) ne
    // passe pas d'altitude : le globe rend alors l'image d'avant AU BIT PRÈS.
    u.uRecollage.value = Number.isFinite(altitudeM) ? poidsRecollage(altitudeM) : 0
    // ⚠️ **LE GRADE DU BLOC SUIT LE DOMAINE — Tache GRA.** Les quatre lignes
    // au-dessus viennent de bouger `[uReliefBas ; uLandMax]`, qui est le
    // denominateur du pivot et du contraste. Sans ce rappel, la conversion
    // resterait celle du domaine PRECEDENT : le desaccord de R31 §⑥, reinvente
    // un etage plus bas et cette fois dans le sens du temps.
    this._majGradeBloc()
  }

  /**
   * **L'ECRIVAIN UNIQUE DE `uHeightPivot` ET `uHeightContrast` SOUS CROP —
   * Tache GRA.**
   *
   * ⚠️ **IL NE FAIT RIEN SANS HABILLAGE, ET C'EST CE QUI LE REND SUR.**
   * `_gradeSocle` n'existe qu'entre `poserHabillage` et `retirerHabillage` ;
   * hors de cet intervalle, `_majRampeMonde` et `retirerHabillage` gardent la
   * main avec `GRADE_MONDE` / `NATUREL_MONDE`, exactement comme avant. Il n'y a
   * donc jamais deux ecrivains au meme instant, seulement deux regimes qui se
   * relaient — le patron de `uRampCrop` lui-meme.
   */
  _majGradeBloc() {
    const s = this._gradeSocle
    if (!s) return
    const u = this.uniforms
    const g = gradeBlocEffectif({
      gradeBloc: this._gradeBlocM || null,
      pivotSocle: s.pivotSocle,
      contrasteSocle: s.contrasteSocle,
      pivotAutoSocle: s.pivotAutoSocle,
      contrasteAutoSocle: s.contrasteAutoSocle,
      socleBasM: s.socleBasM,
      socleAmpM: s.socleAmpM,
      reliefBasM: u.uReliefBas.value,
      ampGlobeM: u.uLandMax.value - u.uReliefBas.value,
    })
    u.uHeightPivot.value = g.heightPivot
    u.uHeightContrast.value = g.heightContrast
  }

  /**
   * **L'ÉVALUATION PAR IMAGE — Tâche K bis.** Réévalue la courbe à l'altitude
   * courante et pose les uniformes. Sans ancre, elle rend `RAMPE_MONDE` et
   * n'écrit donc rien de neuf.
   *
   * ⚠️ **ELLE NE MESURE RIEN.** `poserRampe` balaie `pas²` points et ne tourne
   * qu'à l'arrêt (décision 5) ; celle-ci évalue quatre cubiques et a le droit de
   * tourner à chaque image. C'est la séparation que la tâche installe : la
   * MESURE est rare, la POSE est continue.
   *
   * ⚠️ **ET ELLE NE FAIT RIEN SANS ANCRE**, donc rien tant que `poserRampe` n'a
   * pas reçu d'altitude : la production est intouchée au bit près.
   */
  majEchelleRampe(altitudeM) {
    const partage = this._echelleContinue
    if (!partage || partage.ancres.size === 0) return null
    const v = majEchelle(partage, altitudeM)
    this._poserUniformesRampe(v, altitudeM)
    return v
  }

  /** L'échelle que le nuanceur porte en ce moment — pour les sondes et les bancs. */
  echelleRampePosee() {
    return lireEchelle(this._echelleContinue)
  }

  /** Rend la rampe MONDIALE — le globe reprend ses couleurs d'avant, au bit près. */
  retirerRampe() {
    const u = this.uniforms
    // ⚠️ **LE GRADE DU BLOC TOMBE AVEC LA RAMPE — Tache GRA**, et pour la meme
    // raison que les ancres vingt lignes plus bas : survivant a la mort du crop,
    // il ferait grader la PLANETE sur le relief d'une ile qu'on a quittee.
    // `_majRampeMonde` reprend alors la main avec `GRADE_MONDE`.
    this._gradeBlocM = null
    u.uLandBas.value = RAMPE_MONDE.terreBas
    u.uReliefBas.value = RAMPE_MONDE.terreBas - RAMPE_MONDE.creux
    u.uLandMax.value = RAMPE_MONDE.terreHaut
    u.uOceanDepth.value = RAMPE_MONDE.profondeur
    u.uPlancherRampeM.value = RAMPE_MONDE.plancherM
    // ⚠️ **LE ZÉRO DE LA MER S'ÉTEINT AVEC LA RAMPE, ET C'EST LE DÉFAUT C-3 DE
    // LA TÂCHE C APPLIQUÉ D'AVANCE** : là-bas `retirerHabillage` ne rendait que
    // quatre uniformes sur seize et la planète entière gardait l'intervalle du
    // crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles.
    //
    // ⚡ **SAUF SOUS D15 — Tâche R6.** Il ne retombe plus à zéro, il retombe à
    // l'ÉTAT DE REPOS DU MONDE : sous le drapeau, ce repos vaut 1. Même raison
    // qu'à `retirerHabillage` — ce site est appelé à chaque mort de crop.
    u.uMerZeroSousEau.value = this.planeteEclairee
      ? MONDE_ECLAIRE.merZeroSousEau
      : MONDE_NU.merZeroSousEau
    // ⚠️ **LES ANCRES TOMBENT AUSSI.** Sans cela, `majEchelleRampe` les
    // reposerait à l'image suivante et `retirerRampe` ne retirerait rien — une
    // méthode qui ment sur ce qu'elle fait. Le lieu, lui, est déjà parti : ce
    // site n'est appelé que par `retirerCrop`.
    // ⚠️ **ET LE RECOLLAGE RETOMBE AVEC ELLES — Tâche R31.** Sans cette
    // ligne, `retirerRampe` rendrait les quatre ancres du monde en laissant
    // un poids de mélange qui ne mélange plus rien : un uniforme vivant
    // au-dessus d'un état mort, exactement le défaut C-3 de la Tâche C.
    this.uniforms.uRecollage.value = 0
    oublierAncres(this._echelleContinue)
    this._rampe = null
  }

  // ═══════════ LA MER — Tâche F, décision 5 ══════════════════════════════════
  //
  // **Adrien, le 2026-08-21 :** « la mer riche est PARTOUT, DÉGRADÉE AVEC LA
  // DISTANCE », et « la mer devra aussi être recalculée ».
  //
  // La mer cesse d'être un plan à hauteur fixe cuit sur une grille plate : elle
  // devient une CALOTTE SPHÉRIQUE au niveau de la mer. La loi vit dans
  // `src/monde/mer-sphere.js`, qui est pur et testé ; ici il n'y a que du three.
  //
  // ⚠️ **UNE SEULE MAILLE, ET C'EST LE FAIT LE PLUS UTILE DE LA TÂCHE C QUI LE
  // DICTE** : « ce qui coûterait cher sur une sphère de tuiles, ce n'est pas le
  // calcul, c'est le BAGAGE DE TEXTURES, payé PAR TUILE au lieu d'une fois par
  // bloc ». La mer du socle porte **trois** liens de texture et **une copie de
  // tampon d'image** par appel de dessin (mesuré, `.banc/mesure-F.js`). Portée
  // par tuile sur les **986 tuiles** du globe à la station du socle, elle
  // coûterait **2 958 liens** et 986 copies. Portée par une calotte UNIQUE :
  // **un lien**, **zéro copie**.
  //
  // ⚠️ **ET C'EST POUR ÇA QUE LA RÉFRACTION N'EST PAS PORTÉE.** `ocean.js` copie
  // le tampon d'image à chaque dessin (`copyFramebufferToTexture` dans
  // `onBeforeRender`) pour lire le fond à travers l'eau avec un décalage de
  // Snell. Ici la lame d'eau est simplement TRANSPARENTE : le fond se lit à
  // travers par le mélange alpha, sans copie. **Ce qui se perd est le décalage
  // de réfraction**, c'est-à-dire la torsion du fond sous les vagues. Le dire
  // plutôt que de le découvrir à l'écran.

  /**
   * Pose la mer : une calotte sphérique au niveau de la mer, de la frontière du
   * crop jusqu'à l'horizon.
   *
   * ⚠️ **ASYNCHRONE, ET LA RAISON EST STRUCTURELLE** : les morceaux de nuanceur
   * partagés viennent d'`ocean.js`, qui tire `ocean-waves` par un alias de Vite
   * que node ne résout pas. Une importation statique casserait
   * `test/crop-rampe.test.js`, qui charge `Globe` sous node.
   *
   * ⚠️ **`remplir` EST LA PORTE D'ENTRÉE DE LA BATHYMÉTRIE**, et c'est l'Étape 3
   * du plan : « en réutilisant la fusion bathymétrique déjà dans le flux ».
   * L'appelant passe `(emprise, n, sortie) => remplirHauteurs(flux, {...})`, qui
   * appelle `fuseBathymetry` sur l'emprise ENTIÈRE en une fois — écart en mer
   * 615 m → 3,2 m. Sans lui on retombe sur `hauteurSurface`, qui lit **zéro**
   * partout où le terrarium n'a pas de fond marin : une mer d'un bleu uniforme.
   *
   * @param {object} [arg]
   * @param {(emprise:object, n:number, sortie:Float32Array) => number} [arg.remplir]
   * @param {number} [arg.portee] en demi-côtés de crop ; défaut : l'horizon
   * @param {number} [arg.pas] segments par côté de la calotte
   * @param {number} [arg.hauteurPx] hauteur de la fenêtre, pour la bascule
   * @param {number} [arg.fovDeg] ⚠️ défaut `FOV_DEG` — le fov par DÉFAUT de
   *   l'application (la ligne `fov: 30` des réglages de `main.js` ; **pas**
   *   `main.js:263`, qui parle du maillage du bloc central). Tour de correction
   *   1 : le défaut portait `33`, introuvable ailleurs dans le dépôt, alors que
   *   `SEUIL_BLOC_M` (`seuil-socle.js`, 32 274 m) — la valeur même à laquelle
   *   la bascule se compare — est déjà calculée à `30`. (⚠️ nom corrigé le
   *   2026-09-04, voir le §`FOV_DEG` en tête de ce fichier.)
   *   ⚠️ **MAIS UN DÉFAUT N'EST PAS CE QUI TOURNE.** Relevé le 2026-08-21 sur
   *   l'application vivante : `camGlobe.fov = 33`, posé par un template
   *   (`templates-user.js` sauvegarde `'fov'`). **L'appelant doit passer le fov
   *   VIVANT** — `main.js` le fait, voir `contexteCrop`.
   * @param {number} [arg.largeurBande] largeur de la transition, en octaves
   * @param {number} [arg.couvertureMin] ⚠️ **DÉFAUT 0 : LE DÉPÔT AU BIT PRÈS.**
   *   Au-dessus de zéro, un champ moins couvert que ça rend `refus: 'champ'`, et
   *   c'est la reprise de `branchement-crop.js` qui rejoue la mer. **Sans ce
   *   refus, la première cuisson — celle qui tombe AVANT que les tuiles de fond
   *   marin aient atterri — est aussi la dernière**, et la mer reste d'un bleu
   *   uniforme pour toujours. Mesuré à l'écran : couverture **0,7 %**.
   * @param {boolean} [arg.exigerBathy] même contrat, pour la fusion
   *   bathymétrique : `remplir` peut réussir tout en n'ayant AUCUNE nappe à
   *   fusionner (elle arrive de façon asynchrone). ⚠️ **Défaut `false` :
   *   le dépôt au bit près.**
   * @returns {Promise<object|null>}
   */
  async poserMer({
    remplir = null,
    portee = null,
    couvertureMin = 0,
    exigerBathy = false,
    pas = 192,
    hauteurPx = 900,
    fovDeg = FOV_DEG,
    largeurBande = 4,
    altitudeM = 32274,
  } = {}) {
    // ⛔ **`couleurs` ET `graine` NE SONT PLUS DES PARAMÈTRES — Tâche P6, ET
    // C'EST LE MÊME GESTE QUE P5 SUR LES QUATRE PRÉCÉDENTS.** Ils l'étaient
    // depuis la Tâche F, et **aucun appelant ne les a jamais passés** : la lame
    // d'eau du crop vivait sur `couleursEau({})` — donc sur
    // `params.lakeColor ?? '#8fc6e8'`, le DÉFAUT — et son spectre sur un tirage
    // au hasard, pendant que le socle vit sur sa palette et sur
    // `params.seaSeed`. ⚡ **Et la coïncidence a failli les cacher** : au relevé
    // du 2026-08-22 les deux couleurs étaient IDENTIQUES au caractère près,
    // parce que `params.lakeColor` valait justement le défaut du module. C'est
    // le témoin (lakeColor posé à `#c81e1e` dans la page vivante) qui a montré
    // que la calotte ne bougeait pas. Les deux arrivent désormais par
    // `majReglagesMer`, **par image, depuis les uniformes VIVANTS du socle** —
    // et le spectre par RÉFÉRENCE, parce que `setSeed`/`reseed` le remplacent
    // en cours de session sans rebâtir quoi que ce soit.
    // ⛔ **`couleursFond`, `houle`, `chop` ET `ecumeEchelle` NE SONT PLUS DES
    // PARAMÈTRES — Tâche P5.** Ils l'étaient depuis les Tâches F et M, et
    // **aucun appelant ne les a jamais passés** : le fond marin et l'état de mer
    // du crop vivaient donc sur les défauts de ce module pendant que le socle
    // vivait sur sa palette et sur les curseurs de l'utilisateur. Deux
    // écrivains pour une grandeur, dont un muet, c'est la faute que D13 §③
    // nomme ; la mer prend désormais ses six réglages et ses trois couleurs de
    // fond par `majReglagesMer`, **par image, depuis les uniformes VIVANTS du
    // socle** — le maillon que la Tâche P4 a posé pour les deux accalmies.
    // `ETAT_MER_NEUTRE` porte les valeurs d'avant, au bit près.
    const etat = ETAT_MER_NEUTRE
    const houle = etat.houle
    const chop = etat.chop
    const ecumeEchelle = etat.ecumeEchelle
    if (!this._crop) return null
    const rep = this._crop
    const exag = this.exaggeration
    const echelle = (R_GLOBE / EARTH_RADIUS_M) * exag
    // la portée : l'HORIZON GÉOMÉTRIQUE, pas une constante (§5 de
    // /threejs-optimisation — un seuil d'horizon en dur y vaut une calotte
    // jusqu'à mille fois trop large ; ici l'erreur laisserait un TROU).
    const p = Number.isFinite(portee) && portee > 0
      ? portee
      : Math.min(PORTEE_DEFAUT, Math.max(1, porteeHorizon(rep, altitudeM, EARTH_RADIUS_M)))
    // ⚠️ L'EPSILON DE COPLANARITÉ : le fond marin du globe est EXACTEMENT sur la
    // sphère (`_buildMesh` écrête à zéro), donc sans lui la mer et le fond se
    // disputent le même plan. CONVERTI, pas recopié : `0,003` unité de socle
    // vaudrait 68,3 m de marée ici.
    const epsUnites = epsilonMerDuCrop(rep, exag) * echelle

    // ─── LE CHAMP : altitude du fond et distance au rivage ───────────────────
    //
    // ⚠️ **AVANT LA CALOTTE DEPUIS LA TÂCHE J, ET PAS PAR GOÛT DE L'ORDRE** :
    // c'est lui qui peut REFUSER, et bâtir 193² sommets pour les jeter aussitôt
    // se paierait à chaque reprise — une toutes les trente images tant que le
    // fond marin n'a pas atterri.
    const champ = this._cuireChampMer({ repere: rep, portee: p, remplir, echelle })
    if (!champ) return { refus: 'champ', portee: p }
    // ⚠️ **LE REFUS N'EFFACE RIEN**, et c'est le contrat des maillons écrit dans
    // `branchement-crop.js` : « le refus ne touche pas à ce qui est en place ».
    // Une mer déjà posée survit donc à une reprise qui échoue.
    if (champ.couverture < couvertureMin || (exigerBathy && !champ.bathy)) {
      champ.texture.dispose()
      return { refus: 'champ', portee: p, couverture: champ.couverture, bathy: champ.bathy }
    }
    const cal = construireCalotte({ repere: rep, rayon: R_GLOBE, portee: p, pas, hauteur: epsUnites })

    // ══════ LE RIDEAU D'EAU, CONCATÉNÉ À LA CALOTTE — Tâche P4 ═══════════════
    //
    // ⚠️ **CONCATÉNÉ, PAS POSÉ À CÔTÉ.** Un second maillage aurait eu son propre
    // nuanceur de sommets, donc une seconde écriture du déplacement de houle —
    // et `ocean.js` dit lui-même ce que ça coûte : « si les deux divergeaient
    // d'un millimètre, un jour s'ouvrirait entre la jupe et la mer sur tout le
    // périmètre du bloc ». Ici, le haut du ruban porte le MÊME `aCrop` que la
    // nappe et traverse les MÊMES lignes : la soudure est structurelle.
    //
    // ⚠️ **SANS PAROIS, PAS DE RIDEAU** — et c'est dit dans `_merEtat.jupe`
    // plutôt que posé sur un fond deviné. `MAILLONS` met `parois` avant `mer`.
    const basY = this._baseYCrop
    const rideau = Number.isFinite(basY)
      ? construireJupeMer({
        repere: rep,
        rayon: R_GLOBE,
        forme: { coin: this.uniforms.uCropCoin.value, expo: this.uniforms.uCropCoinN.value },
        basY,
        hauteur: epsUnites,
        // ⛔ **LE BAS RENTRE PLUS QUE LE HAUT — Tâche P13.** Le motif complet
        // est à `_retraitBaseCrop` et dans l'en-tête de `construireJupeMer`.
        // ⚠️ **ON AJOUTE LA MARGE, ON NE LA REFAIT PAS** : `MARGE_EAU_CROP` est
        // `SOCLE_MARGE_EAU` en demi-côtés, la seule part commune aux deux
        // retraits. Sans parois mesurées, `undefined` rend le rideau DROIT
        // d'avant, au bit près.
        retraitBas: Number.isFinite(this._retraitBaseCrop)
          ? this._retraitBaseCrop + MARGE_EAU_CROP
          : undefined,
      })
      : null

    const nCal = cal.positions.length / 3
    const nJup = rideau ? rideau.positions.length / 3 : 0
    const positions = new Float32Array((nCal + nJup) * 3)
    const uvs = new Float32Array((nCal + nJup) * 2)
    const jupes = new Float32Array(nCal + nJup)
    positions.set(cal.positions, 0)
    uvs.set(cal.uv, 0)
    const indices = new Uint32Array(cal.indices.length + (rideau ? rideau.indices.length : 0))
    indices.set(cal.indices, 0)
    if (rideau) {
      positions.set(rideau.positions, nCal * 3)
      uvs.set(rideau.uv, nCal * 2)
      jupes.set(rideau.jupe, nCal)
      for (let i = 0; i < rideau.indices.length; i++) indices[cal.indices.length + i] = rideau.indices[i] + nCal
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aCrop', new THREE.BufferAttribute(uvs, 2))
    geo.setAttribute('aJupe', new THREE.BufferAttribute(jupes, 1))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.computeBoundingSphere()

    // ─── DEUX ÉCHELLES, ET LES CONFONDRE SE VOIT ─────────────────────────────
    //
    // `echelleH` : unités de scène par mètre de SPECTRE — l'échelle des vagues, tirée
    //   du `LEN_SCALE = 0.42` du socle et convertie par la largeur du crop.
    // `maille` : le pas de la grille. C'est LUI qui borne ce que la surface peut
    //   porter, donc lui qui fixe la bascule par la loi d'échantillonnage.
    //
    // ⚠️ **LA PREMIÈRE VERSION SERVAIT `maille` COMME ÉCHELLE DE HOULE**, ce qui
    // faisait des vagues de 8 à 16 km : la mer riche et la mer plate rendaient
    // EXACTEMENT la même image jusqu'à 12,7 km d'altitude.
    const echelleH = echelleHouleM(rep) * (R_GLOBE / EARTH_RADIUS_M)
    const maille = (2 * p * rep.demi * CIRCONFERENCE_MERCATOR * (R_GLOBE / EARTH_RADIUS_M)) / pas
    const lambda = maille
    const bascule = distanceBascule({ lambda, hauteurPx, fovDeg })
    const bande = bandeDegradation(bascule, largeurBande)

    const mod = await import('./ocean.js')
    // ⚠️ **LE NEUTRE, ET IL EST BRANCHÉ DÈS LA PREMIÈRE IMAGE.** `couleursEau({})`
    // rend le défaut du module (`params.lakeColor ?? '#8fc6e8'`) ; c'est ce que
    // voit un crop SANS mer de socle à lire, et rien d'autre.
    const cols = mod.couleursEau({})
    // ⚠️ LE SPECTRE, ET SANS LUI LA MER EST UNE NAPPE PLATE — MESURÉ. Le morceau
    // `GERSTNER_GLSL` déclare `uWaveA[16]` / `uWaveB[16]` et saute tout train
    // dont l'amplitude est nulle : à uniformes vides, `disp` et `nAcc` valent
    // zéro et la surface est un miroir. Le premier relevé de l'Étape 4 rendait
    // **zéro pixel de différence** entre la mer riche et la mer dégradée, à
    // toutes les distances, et c'est ce zéro trop propre qui l'a dénoncé.
    // ⚠️ **UN TIRAGE NEUF, ET C'EST LE NEUTRE.** `majReglagesMer` remplace ces
    // deux tableaux par CEUX DU SOCLE (par référence) dès la première image où
    // il y a une mer de socle à lire — donc le tirage ne survit qu'aux crops
    // sans socle (banc, test, mer coupée).
    const spectre = mod.seaStateToUniforms(mod.makeSeaState())
    const u = this.uniforms
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        // ⚠️ **LES TROIS PREMIERS SONT PARTAGÉS AVEC LES TUILES — Tâche P6.**
        // `uSunDir` reste le soleil de PLANÈTE (le repli quand il n'y a pas
        // d'éclairage de bloc) ; `uSoleilDir` et `uEclairageOn` sont les MÊMES
        // objets que ceux de `poserHabillage`, pas des copies : le soleil de la
        // mer et celui du relief ne peuvent donc pas diverger, et une tirette
        // d'heure les déplace ensemble sans reposer la mer.
        uSunDir: u.uSunDir,
        uSoleilDir: u.uSoleilDir,
        uEclairageOn: u.uEclairageOn,
        // ⛔ **`0xffffff` CODÉ EN DUR CONTRE `#fff7e6` VIVANT.** Posé au NEUTRE
        // ici et branché par `majReglagesMer` (`Ocean.update` recopie
        // `sun.color` par image) — même famille que `uSky`, que P4 a trouvé
        // codé en dur au même endroit du même objet.
        uSunColor: { value: new THREE.Color(0xffffff) },
        uSky: { value: new THREE.Color('#bcd8ea') },
        // ══════ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ═════════════
        //
        // ⚠️ **AU NEUTRE D'`ocean.js` À LA NAISSANCE, BRANCHÉS PAR IMAGE.**
        // `LAME_EAU_NEUTRE` porte les quatre `??` de `waterMaterial`, pas des
        // nombres choisis ici — et l'en-tête d'`ecume-mer.js` dit pourquoi
        // AUCUNE valeur ne pouvait reproduire le nuanceur d'avant : il portait
        // le `mix(0,45 ; 0,95)` **sans** la tirette et le glacis de lagon **à
        // plein régime**, deux choses qu'aucun `uTransp` ne rend ensemble.
        uMerTransp: { value: LAME_EAU_NEUTRE.transparence },
        uMerSoleilFx: { value: LAME_EAU_NEUTRE.soleilFx },
        uMerJour: { value: LAME_EAU_NEUTRE.jour },
        uMerDetail: { value: LAME_EAU_NEUTRE.detail },
        uMerTemps: { value: 0 },
        uMerHoule: { value: houle },
        uMerChop: { value: chop },
        uMerVitesse: { value: 1 },
        uMerLambda: { value: echelleH },
        uMerMaille: { value: maille },
        uMerPortee: { value: p },
        // ⚠️ **LA MÊME VALEUR QUE CELLE QUI A NORMALISÉ LE CANAL G** — elle sort
        // de `_cuireChampMer`, elle n'est pas recalculée ici (Tâche P4).
        uMerUnite: { value: champ.unite },
        // ⚠️ **LE FOND DU BLOC, PAS UNE PROFONDEUR À PART** — le rideau descend
        // jusqu'à `baseY` des parois. Sans parois, aucun sommet de rideau n'est
        // bâti et cette valeur ne sert à personne : elle vaut alors 0.
        uMerBasY: { value: Number.isFinite(basY) ? basY : 0 },
        // ⚠️ **LES DEUX ACCALMIES D'`ocean.js`, AU NEUTRE À LA NAISSANCE.**
        // `majAccalmieMer` les pose par image depuis les uniformes VIVANTS de la
        // mer du socle. Laissées au neutre, la mer est celle d'avant P4 au bit
        // près — c'est l'instrument de banc que D13 §① demande de garder.
        uMerCalmeVue: { value: ACCALMIE_NEUTRE.vue },
        uMerCalmeSurf: { value: ACCALMIE_NEUTRE.surface },
        // le givre du socle de verre — 0 = pas de verre, le neutre exact
        uMerGivre: { value: 0 },
        uMerDebut: { value: bande.debut },
        uMerFin: { value: bande.fin },
        uMerChamp: { value: champ.texture },
        // ⚠️ ASSIGNÉS APRÈS COUP, comme `_applySea` le fait : `UniformsUtils.merge`
        // clonerait les tableaux à la construction.
        uWaveA: { value: spectre.a },
        uWaveB: { value: spectre.b },
        // ⚠️ LE BUDGET, PAS LA PROFONDEUR RÉELLE — voir `budgetProfondeurM`.
        // Posé sur le maximum du champ (4 310 m), le glacis de lagon couvrait
        // tout ce qui est sous 646 m et peignait la côte en cyan pâle.
        uMerProfMax: { value: budgetProfondeurM(rep, exag) * echelle },
        // ⚠️ CONVERTI, PAS RECOPIÉ — voir `seuilTraitEauM` : `0,02` unité de socle
        // vaudrait 455 m d'eau ici, et toute la côte serait semi-transparente.
        uMerSeuilEau: { value: seuilTraitEauM(rep, exag) * echelle },
        // ══════ LE TRAIT MER/TERRE PAR FRAGMENT — Tâche R5 ═══════════════════
        // ⚠️ **POSÉ À 1, ET C'EST LA LIVRAISON, PAS UN RÉGLAGE.** Le zéro existe
        // pour que le banc rende l'image d'avant AU BIT PRÈS dans la même page
        // (`.banc/R5/`), et pour rien d'autre : aucun réglage d'interface ne le
        // touche. Les chiffres qui le justifient sont dans `MER_FRAG`.
        uMerParFragment: { value: 1 },
        uMerPeu: { value: cols.shallowT },
        uMerFond: { value: cols.deep },
        // ⛔ **PLUS DE TRANSCRIPTION DE `chopLook` ICI — Tâche P5.** Ces deux
        // lignes portaient `1.9 * chop * chop` et `240 - 130 * chop`, c'est-à-dire
        // une SECONDE écriture d'une loi qui vit dans `ocean.js` — et le panneau
        // « Effets » peut y écrire autre chose. Les deux valeurs arrivent
        // désormais par `majReglagesMer`, LUES sur `uFoam` et `uGloss` ; ce qui
        // est posé ici n'est plus que le NEUTRE, c'est-à-dire `chopLook(0,7)`,
        // la mer d'avant cette tâche au bit près.
        uMerEcume: { value: etat.ecume },
        // ⚠️ LE FACTEUR D'ÉCHELLE D'ÉCUME D'`ocean.js`. Là-bas il vaut
        // `smooth01((waveScale − 0,12)/0,2)` — relevé à **1** sur la page vivante
        // — et il éteint l'écume des vues continentales. Il arrive maintenant par
        // `majReglagesMer` ; le `0,35` du neutre était la valeur posée à la main
        // par la Tâche M, et c'est un des six écarts que P4 avait relevés.
        uMerEcumeEchelle: { value: ecumeEchelle },
        uMerBrillance: { value: etat.brillance },
        uCropCoin: u.uCropCoin,
        uCropCoinN: u.uCropCoinN,
        // ⚠️ **PROPRE À LA MER, PAS PARTAGÉ** : les deux bornes sont exprimées
        // dans la mesure de la découpe, celle du socle. Posé juste après, par
        // `_majBordMer` — un seul écrivain, et un seul appelant depuis que la
        // mer ne suit plus l'estompage (défaut ② d'Adrien, 2026-09-04).
        // ⚠️ **LE NEUTRE `(0, 1)` RESTE UN NEUTRE, PAS UN ÉTAT** : il vit le
        // temps d'une construction, `_majBordMer` l'écrase avant tout dessin.
        uMerBord: { value: new THREE.Vector2(0, 1) },
        // ══════ LA RÉFRACTION — Tâche R2 ════════════════════════════════════
        //
        // ⚠️ **`uMerScene` NAÎT NUL ET C'EST SANS DANGER** : `onBeforeRender`
        // (posé plus bas) crée la copie du tampon AVANT le tout premier dessin
        // de la nappe, exactement comme `ocean.js`. Il n'y a donc pas d'image
        // où le nuanceur lise une texture absente.
        uMerScene: { value: null },
        uMerResolution: { value: new THREE.Vector2(1, 1) },
        // ⚠️ **AU NEUTRE D'`ocean.js` À LA NAISSANCE, BRANCHÉ PAR IMAGE** —
        // même règle que les quatre autres réglages de lame d'eau.
        // `majReglagesMer` le pose depuis `uRefract` VIVANT du socle (relevé à
        // **0,34** le 2026-08-23, pas le `0,6` du défaut).
        uMerRefract: { value: REFRACTION_NEUTRE },
        // ⚠️ **LA ROTATION DU CROP, POSÉE PAR IMAGE DANS `onBeforeRender`.** Sans
        // elle, la normale de la mer est dotée avec `V` dans deux repères
        // différents — voir la mesure dans `MER_FRAG` et dans
        // `monde/eau-refraction.js`.
        uMerVersMonde: { value: new THREE.Matrix3() },
      },
      vertexShader: MER_VERT
        .replace('__GERSTNER__', mod.GERSTNER_GLSL)
        .replace('__SHORE_SURF__', mod.SHORE_SURF_GLSL),
      fragmentShader: MER_FRAG,
    })

    this.retirerMer()
    // ⚠️ LE FOND MARIN AUSSI, ET C'EST LE MEME GESTE : la mer, ce n'est pas
    // seulement la lame d'eau, c'est le fond qu'on voit au travers.
    u.uMerRampeOn.value = 1
    // ══════ LE BUDGET DU FOND ENTRE PAR LA COURBE — Tâche K bis ═════════════
    //
    // ⚠️ **C'EST LUI QUI PEINT LA MER, ET IL BOUGEAIT AUTANT QUE LES AUTRES.**
    // Relevé sur la descente de La Réunion (`.banc/vues-Kbis/AV-descente.json`) :
    // 6 000 → 6 228 → 6 028 → 6 028 → **4 415,2 m**. Sur `dMer01`, qui indexe la
    // rampe nautique, cela déplace la couleur d'une profondeur donnée de
    // **0,248** au maximum — plus que tout le reste de la mer réuni. Le laisser
    // hors de la courbe aurait laissé le turquoise d'Adrien intact.
    //
    // ⚠️ **ET IL EST ANCRÉ SOUS LA MÊME ALTITUDE QUE LA RAMPE**, pas sous une
    // seconde : `poserMer` et `poserRampe` reçoivent tous deux `altitudeM` du
    // MÊME `contexteCrop`, et deux crans qui divergeraient rouvriraient le
    // désaccord que la Tâche J bis a fermé (`LECTEURS_DU_FOND`).
    //
    // ⛔ **ET IL SE MESURE SUR LE CROP, PLUS SUR LA CALOTTE — Tâche P5.** Le
    // socle pose `uSeaRange = −dem.minM`, mesuré sur SON BLOC ; on prenait
    // `champ.profMaxM`, mesuré sur une calotte trois fois plus large.
    // **3 510,49 m contre 2 116 m** au même instant, et le segment clair de la
    // rampe passait de 19,82 % à **38,89 %** des nœuds d'eau du crop : la frange
    // pâle en doublait de largeur. ⚠️ **Le repli reste `profMaxM`** — un crop
    // dont le champ n'aurait aucune eau à l'intérieur (lagune hors frontière,
    // banc) rendrait sinon un budget nul, donc une mer d'un seul bleu.
    const budgetFond = Math.max(champ.profMaxCropM || champ.profMaxM, 1)
    ancrerMesure(this._echelleContinue, altitudeM, {
      fondBudget: budgetFond,
      plancherM: u.uPlancherRampeM.value,
    })
    const _v = majEchelle(this._echelleContinue, altitudeM)
    u.uMerFondBudgetM.value = Number.isFinite(_v?.fondBudget)
      ? Math.max(_v.fondBudget, 1)
      : budgetFond
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'crop-mer'
    mesh.frustumCulled = false // les vagues la déplacent, et elle est immense
    mesh.renderOrder = 18 // le même que la mer du socle
    // ══════ LE GRAB PASS — Tâche R2, ET C'EST LA QUESTION QUI DÉCIDAIT ══════
    //
    // **« À quel instant copier le tampon pour que la mer du crop réfracte le
    // FOND MARIN et non le ciel ou le vide ? »** La réponse est `onBeforeRender`
    // de la nappe elle-même, et elle est la MÊME que celle d'`ocean.js` — pour
    // une raison qui ne dépend d'aucune des deux passes : `three` trie les
    // objets TRANSPARENTS après les opaques, et `onBeforeRender` se déclenche
    // juste avant l'appel de dessin. Au moment où il court, le tampon lié
    // contient donc déjà les tuiles du crop, ses parois et son fond marin.
    //
    // ⚠️ **ET IL N'A PAS FALLU DE CIBLE DE RENDU À PROFONDEUR.** Le canevas de
    // la page est bien construit sans tampon de profondeur (`main.js`,
    // `depth: false`), mais la nappe n'est JAMAIS dessinée dedans : sous
    // `?terre=unique` le globe est rendu par `passeFond`, une `RenderPass` du
    // composeur, donc dans une cible de rendu — qui, elle, a sa profondeur.
    //
    // ⚠️ **`HalfFloatType`, ET LA LEÇON EST DÉJÀ PAYÉE DANS `ocean.js`** : « le
    // composer rend en HalfFloat : la copie exige le MÊME type de stockage.
    // RGBA8 depuis RGBA16F = INVALID_OPERATION silencieuse → texture NOIRE ».
    mesh.onBeforeRender = (renderer) => {
      const u2 = mat.uniforms
      // la rotation du crop, relue par image : le crop se déplace, le rendez-vous
      // entre sa normale et le monde ne doit pas se figer à la naissance.
      u2.uMerVersMonde.value.setFromMatrix4(mesh.matrixWorld)
      const taille = renderer.getDrawingBufferSize(_tailleDessin)
      if (!this._merRefractRT || this._merRefractRT.image.width !== taille.x || this._merRefractRT.image.height !== taille.y) {
        this._merRefractRT?.dispose()
        this._merRefractRT = new THREE.FramebufferTexture(taille.x, taille.y)
        this._merRefractRT.type = THREE.HalfFloatType
      }
      // ⛔ **LA LIAISON EST SORTIE DU `if`, ET C'EST UN DÉFAUT MESURÉ, PAS UNE
      // PRÉCAUTION** — Tour de correction R2. La cible de copie appartient au
      // GLOBE, les uniformes au MATÉRIAU, et `poserMer` refait un matériau neuf
      // (`uMerScene: { value: null }`) à CHAQUE repose. Quand la cible existait
      // déjà à la bonne taille, le `if` ne courait pas : le matériau neuf
      // gardait `uMerScene` à `null`, donc la réfraction du crop lisait une
      // texture absente dès la deuxième pose. `⑩n` de
      // `test/mer-sphere.test.js` exerce ce cycle (pose · image · repose ·
      // image) et rougit sur le code d'avant le tour de correction.
      //
      // ⚠️ **ET IL FAUT DIRE CE QUE CETTE LIGNE NE PROUVE PLUS** : depuis que
      // `retirerMer` REND la cible (voir plus bas), une repose la recrée de
      // toute façon, donc remettre ces deux lignes DANS le `if` ne se voit plus
      // — la mutation M14 du tour de correction **survit, et c'est déclaré**.
      // On les garde dehors quand même : la durée de vie du matériau et celle
      // de la cible sont deux affaires distinctes, et les coupler a déjà coûté
      // une réfraction morte en silence.
      u2.uMerScene.value = this._merRefractRT
      u2.uMerResolution.value.set(taille.x, taille.y)
      renderer.copyFramebufferToTexture(this._merRefractRT)
    }
    const M = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(cal.base.est[0], cal.base.est[1], cal.base.est[2]),
      new THREE.Vector3(cal.base.haut[0], cal.base.haut[1], cal.base.haut[2]),
      new THREE.Vector3(cal.base.sud[0], cal.base.sud[1], cal.base.sud[2])
    )
    M.setPosition(cal.origine[0], cal.origine[1], cal.origine[2])
    M.decompose(mesh.position, mesh.quaternion, mesh.scale)
    if (!this._matricesAuto) { mesh.updateMatrix(); mesh.matrixAutoUpdate = false } // PF4 : la mer est posée une fois
    this.group.add(mesh)
    this._mer = mesh
    this._merEtat = {
      portee: p, pas, lambda, maille, echelleH, bascule, bande, epsUnites,
      flecheMax: cal.flecheMax, compte: cal.compte,
      // ⚠️ **ON DIT SI LE RIDEAU EST LÀ.** Un `false` silencieux serait
      // exactement le genre d'absence que ce chantier met des soirées à lire.
      jupe: rideau ? { basY, ...rideau.compte } : null,
      couverture: champ.couverture, profMaxUnites: champ.profMaxUnites,
      bathy: champ.bathy,
    }
    this._majBordMer()
    return this._merEtat
  }

  /**
   * Pose le bord de la mer : **à l'emprise du socle, toujours.**
   *
   * ⚠️ **DEUX FLOTTANTS, PAS UNE RECUISSON.** La calotte se bâtit à l'arrêt
   * (385² de champ, 193² de sommets) : l'écrêtage vit dans le FRAGMENT, sur la
   * même superellipse que le `discard` des tuiles. La géométrie garde donc sa
   * portée de 3 demi-côtés — c'est sur elle que le champ est cuit — et c'est le
   * nuanceur qui n'en garde que le crop.
   *
   * ⛔ **ELLE LISAIT `uEstompage`, ET C'ÉTAIT LE DÉFAUT ② D'ADRIEN.** Elle
   * portait même le piège nommé dans le brief : `uEstompageOn` à 0 se lisait
   * « planète entière », donc « mer jusqu'au bord de la calotte » — un crop
   * parfaitement découpé sous une nappe qui ne l'était pas du tout. La mesure
   * est dans `bordDeMer`. **Un seul appelant reste : `poserMer`.**
   */
  _majBordMer() {
    if (!this._mer) return
    const b = bordDeMer()
    this._mer.material.uniforms.uMerBord.value.set(b.debut, b.fin)
  }

  /**
   * Cuit le champ de la mer : altitude du fond (R) et distance au rivage (G).
   *
   * ⚠️ **384, ET CE N'EST PAS UN CHOIX DE CONFORT** : `SHORE_SURF_GLSL` porte
   * `1.0 / 384.0` EN DUR pour son pas de gradient. Une autre résolution
   * déformerait la houle de côte sans que rien ne le signale.
   *
   * ⚠️ **LE CHANFREIN COMPLET, PAS CELUI DU SOCLE** : `distanceRivage` par
   * défaut reproduit le demi-masque incomplet d'`ocean.js`, qui sur-estime de
   * **41,4 %** dans deux quadrants sur quatre (mesuré, `test/mer-sphere.test.js`
   * ⑤a). La calotte prend `completes: true`. Le socle garde le sien AU BIT PRÈS
   * — on élargit, on ne remplace pas.
   */
  _cuireChampMer({ repere, portee, remplir, echelle }) {
    const N = CHAMP_FOND
    const emprise = empriseCalotte(repere, portee)
    const brut = new Float32Array((N + 1) * (N + 1))
    let couverture = 0
    let bathy = false
    if (typeof remplir === 'function') {
      const r = remplir(emprise, N, brut)
      couverture = r && Number.isFinite(r.remplis) ? r.remplis / brut.length : 1
      // ⚠️ **ON CROIT `remplir` QUAND IL RÉPOND, ET ON LE SUPPOSE SINON.**
      // `remplirHauteurs` rend désormais un `bathy` qui dit si la fusion a
      // RÉELLEMENT eu lieu (la nappe arrive de façon asynchrone) ; un `remplir`
      // muet — les bouchons des tests, tout appelant d'avant la Tâche J — garde
      // le `true` optimiste d'origine. **On élargit, on ne remplace pas.**
      bathy = r && typeof r.bathy === 'boolean' ? r.bathy : true
    } else {
      // ⚠️ LE REPLI, ET IL EST DÉGRADÉ — `hauteurSurface` lit les tuiles du
      // globe, qui n'ont AUCUNE bathymétrie : zéro partout en mer. La mer y sera
      // d'un bleu uniforme. On le dit par `bathy: false` plutôt que de le
      // laisser découvrir à l'écran.
      const liste = this.tuilesAvecHauteurs()
      let vus = 0
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const lat = emprise.nord + ((emprise.sud - emprise.nord) * j) / N
          const lon = emprise.ouest + ((emprise.est - emprise.ouest) * i) / N
          const h = this.hauteurSurface(lat, lon, liste)
          brut[j * (N + 1) + i] = h == null ? 0 : h
          if (h != null) vus++
        }
      }
      couverture = vus / brut.length
    }

    const cote = N + 1
    const eau = new Uint8Array(cote * cote)
    let profMaxM = 0
    for (let k = 0; k < cote * cote; k++) {
      const h = brut[k]
      eau[k] = h < 0 ? 1 : 0
      if (-h > profMaxM) profMaxM = -h
    }
    // la cellule, en unités de scène : la largeur de la calotte divisée par N
    const largeurUnites = 2 * portee * repere.demi * CIRCONFERENCE_MERCATOR * (R_GLOBE / EARTH_RADIUS_M)
    const cellule = largeurUnites / N
    // ⚠️ **L'UNITÉ DE SOCLE, ET IL N'Y EN A QU'UNE ÉCRITURE — Tâche P4.** Elle
    // servait déjà, en ligne, à normaliser le canal G ; le déclin côtier
    // d'`ocean.js` en a besoin AUSSI pour rendre la profondeur comparable à
    // cette distance. Deux écritures de ce facteur remettraient les deux
    // grandeurs dans deux monnaies, ce qui est exactement le défaut réparé.
    // ⚠️ **EN MÈTRES MERCATOR, PAS EN MÈTRES VRAIS** : `largeurCropM` porte un
    // `cos φ` que `largeurUnites` n'a pas. À La Réunion l'écart vaut 6,8 %.
    const unite = largeurUnites / (COTE_CROP_UNITES * portee)
    const dist = distanceRivage(eau, cote, cellule, { completes: true })

    // ⚠️ DEMI-FLOTTANTS ÉCRITS DIRECTEMENT, comme `_bakeField` : à 385² un
    // Float32Array intermédiaire ne servirait qu'à être converti aussitôt.
    const demi = new Uint16Array(cote * cote * 2)
    for (let k = 0; k < cote * cote; k++) {
      demi[k * 2] = THREE.DataUtils.toHalfFloat(brut[k] * echelle)
      // ⚠️ NORMALISÉE SUR 15 UNITÉS DE SOCLE, CONVERTIES — c'est le déclin
      // côtier d'`ocean.js` (`dist / 15`), et le recopier tel quel aurait donné
      // une frange de ressac quinze fois trop large sur le globe.
      demi[k * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.min(1, dist[k] / (15 * unite)))
    }
    const tex = new THREE.DataTexture(demi, cote, cote, THREE.RGFormat, THREE.HalfFloatType)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return {
      texture: tex,
      couverture,
      bathy,
      unite,
      profMaxUnites: Math.max(profMaxM * echelle, 1e-6),
      profMaxM,
      // ⚠️ **LA PROFONDEUR DU CROP, PAS CELLE DE LA CALOTTE — Tâche P5.** Le
      // socle normalise sa rampe nautique sur l'amplitude de SON BLOC
      // (`uSeaRange = −dem.minM`) ; `poserMer` prenait `profMaxM`, mesuré sur
      // une calotte trois fois plus large. **3 510,49 m contre 2 116 m** à La
      // Réunion, et la frange pâle en doublait de largeur. L'en-tête de
      // `profondeurMaxDuCrop` porte les deux relevés.
      profMaxCropM: profondeurMaxDuCrop(brut, cote, portee),
    }
  }

  // ═══════════ LE FOND DU CROP — Tâche J bis ════════════════════════════════
  //
  // **Ce que ce maillon ferme, et il a été établi PAR ÉLIMINATION, pas supposé**
  // (Tâche J, §6) : « le champ de la mer a un fond ; la SURFACE du crop n'en a
  // pas ». Les chiffres sont dans l'en-tête de `src/monde/fond-crop.js` et leurs
  // relevés bruts sur le disque (`.banc/vues-Jbis/Jbis-releves-bruts.json`) :
  // **920,7 m d'écart moyen**, **2 116,27 m au maximum**, contre **73 m** de
  // houle. Ce n'était donc pas la mer qui débordait, c'était le sol qui manquait.
  //
  // ⚠️ **CE MAILLON PASSE AVANT LES PAROIS ET LA RAMPE, ET C'EST STRUCTUREL.**
  // Les deux se posent sur `hauteurSurface` : posé après elles, le fond aurait
  // donné un bloc dont le flanc commence deux kilomètres au-dessus de sa propre
  // surface, et une rampe calée sur 130,36 m là où il y en a 2 116,3 (les deux
  // relevés). C'est pour ça que `MAILLONS` en compte SIX (`branchement-crop.js`).
  //
  // ⚠️ **ET IL CUIT SON PROPRE CHAMP, IL N'EMPRUNTE PAS CELUI DE LA MER.** La
  // mer est le DERNIER maillon et son `poserMer` est asynchrone : lui prendre
  // son champ obligerait à mémoïser un tableau dont la fraîcheur dépend de
  // l'arrivée — asynchrone, elle aussi — de la nappe bathymétrique. Deux
  // cuissons de 385² valent mieux qu'un cache dont personne ne sait dire s'il
  // est à jour. ⚠️ **Le prix est mesuré, pas supposé** : voir le §« ce que ça
  // coûte » du rapport de la tâche.

  /**
   * Cuit le fond du crop et le pose : la surface du globe porte le relief
   * sous-marin sur l'emprise de la calotte.
   *
   * ⚠️ **`remplir` EST OBLIGATOIRE ICI, ET IL N'Y A PAS DE REPLI.** Le repli de
   * `_cuireChampMer` (lire `hauteurSurface`) serait CIRCULAIRE : la sonde rend
   * déjà le fond posé. Sans `remplir`, ce maillon refuse — et refuser laisse la
   * surface du dépôt, ce qui est exactement le comportement d'avant.
   *
   * @param {object} arg
   * @param {(emprise:object, n:number, sortie:Float32Array) => object} arg.remplir
   * @param {number} [arg.portee] en demi-côtés de crop
   * @param {number} [arg.couvertureMin] au-dessous, on refuse (0 = jamais)
   * @param {boolean} [arg.exigerBathy] refuse tant que la nappe n'a pas fusionné
   * @param {number} [arg.champN] intervalles du champ — `CHAMP_FOND` par défaut.
   *   ⚠️ **IL N'EXISTE QUE POUR ÊTRE MESURÉ, ET AUCUN APPELANT DU PRODUIT NE LE
   *   POSE.** Ce que le banc R17 en a mesuré, et il ne dit pas « rien » : sur le
   *   MNT du socle sous −25 m de fond (1 248 016 nœuds, La Réunion z12), le
   *   détail perdu par un pas de **214 m** — celui du champ — vaut **1,371 m en
   *   moyenne** ; à **71 m** (soit `champN = 1152`) il vaut **0,468 m**. Monter
   *   la résolution rachète donc **0,90 m de relief moyen** dans un fond qui
   *   descend à 3 437 m, **pour ×8,96 la mémoire** (290 → 2 597 Kio de texture,
   *   579 → 5 193 Kio de champ) et un temps de pose doublé.
   *   ⛔ **Et ça ne répare PAS le défaut visible** : la grille de plaques du fond
   *   marin ne venait pas de la résolution mais du PAS DU GRADIENT — voir
   *   `uFondPasQ`. À `champN = 1152` avec l'ancien pas, la grille est seulement
   *   rendue SOUS-PIXEL au cadrage large (1,079 px) et elle revient dès qu'on
   *   approche (`.banc/R17/R17-REU-zoom3-*`).
   *   ⛔ **ET IL NE REBÂTIT PAS LES MAILLAGES À LUI SEUL** : `cleFond`
   *   (`monde/fond-crop.js`) ne porte pas la résolution du champ, donc changer
   *   `champN` sans changer le repère laisse `_cleFondPosee` inchangée. Un banc
   *   qui balaie cette valeur doit vider `_cleFondPosee` lui-même — c'est ce que
   *   `.banc/R17/r17-c-pas.js` fait, et il dit pourquoi.
   * @returns {{refus:string|null, couverture:number, bathy:boolean, profMaxM:number, rebati:number}}
   */
  poserFondCrop({ remplir = null, portee = PORTEE_CROP, couvertureMin = 0, exigerBathy = false, champN = null } = {}) {
    const vide = { refus: null, couverture: 0, bathy: false, profMaxM: 0, rebati: 0 }
    if (!this._crop) return { ...vide, refus: 'crop' }
    if (typeof remplir !== 'function') return { ...vide, refus: 'remplir' }
    const p = Number.isFinite(portee) && portee > 0 ? portee : PORTEE_CROP
    const N = Number.isFinite(champN) && champN > 0 ? Math.round(champN) : CHAMP_FOND
    const cote = N + 1
    const emprise = empriseCalotte(this._crop, p)
    const valeurs = new Float32Array(cote * cote)
    const r = remplir(emprise, N, valeurs)
    const couverture = r && Number.isFinite(r.remplis) ? r.remplis / valeurs.length : 1
    const bathy = r && typeof r.bathy === 'boolean' ? r.bathy : true
    let profMaxM = 0
    for (let k = 0; k < valeurs.length; k++) if (-valeurs[k] > profMaxM) profMaxM = -valeurs[k]
    // ⚠️ **LE MÊME REFUS QUE LA MER, ET AVEC LES MÊMES SEUILS.** Poser un fond
    // à moitié rempli creuserait des marches là où la donnée manque, et poser un
    // fond SANS bathymétrie ne ferait que recopier le zéro du terrarium — du
    // travail pour rien, et une reconstruction de cinquante maillages avec.
    if (couverture < couvertureMin || (exigerBathy && !bathy)) {
      return { refus: 'champ', couverture, bathy, profMaxM, rebati: 0 }
    }
    const fond = { valeurs, cote, repere: this._crop, portee: p, emprise, bathy, profMaxM }
    const cle = cleFond(fond)
    this._fondCrop = fond
    this._poserTextureFond(fond)
    // ⚠️ **ON NE REBÂTIT QUE SI LA SURFACE A CHANGÉ.** `poserFondCrop` est
    // rappelé à chaque cran ET à chaque reprise ; reconstruire cinquante
    // maillages pour un champ identique coûterait une planète par reprise.
    let rebati = 0
    if (cle !== this._cleFondPosee) {
      this._cleFondPosee = cle
      rebati = this._refaireMaillagesDuFond()
    }
    return { refus: null, couverture, bathy, profMaxM, rebati }
  }

  /** Rend au globe sa surface d'avant : la mer remonte sur la sphère. */
  retirerFondCrop() {
    if (!this._fondCrop) return 0
    this._fondCrop = null
    this._cleFondPosee = ''
    const u = this.uniforms
    u.uFondChamp.value?.dispose()
    u.uFondChamp.value = null
    u.uFondOn.value = 0
    u.uFondMetres.value = 1
    // ⚠️ **ET LE PAS RETOMBE À ZÉRO — Tâche R17**, pour la même raison que
    // `uFondMetres` revient à 1 : un pas laissé derrière ferait dériver le
    // gradient d'une grille de champ que plus personne ne lit. À zéro, le
    // nuanceur rend `max(1 / uTilePx, 0)`, c'est-à-dire le pas du dépôt.
    u.uFondPasQ.value = 0
    return this._refaireMaillagesDuFond()
  }

  /**
   * La texture que le FRAGMENT lit — la couleur, pas la géométrie.
   *
   * ⚠️ **UN SEUL CANAL, ET EN UNITÉS LOCALES COMME LA MER.** `_cuireChampMer`
   * écrit `brut × echelle` dans son canal R ; on écrit exactement la même chose,
   * pour que `uFondMetres` (l'inverse de l'échelle) soit la seule conversion du
   * chemin et que les deux nuanceurs lisent la même grandeur.
   *
   * ⚠️ **LA PRÉCISION EST MESURÉE, PAS SUPPOSÉE** : un demi-flottant vaut ici
   * 2^-15 près de 0,218 unité (la profondeur maximale relevée × l'échelle), soit
   * **2,8 m au sol**. La houle qui traversait le fond en faisait 73.
   */
  _poserTextureFond(fond) {
    const u = this.uniforms
    const echelle = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
    const n = fond.cote * fond.cote
    const demi = new Uint16Array(n)
    for (let k = 0; k < n; k++) demi[k] = THREE.DataUtils.toHalfFloat(fond.valeurs[k] * echelle)
    const tex = new THREE.DataTexture(demi, fond.cote, fond.cote, THREE.RedFormat, THREE.HalfFloatType)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    u.uFondChamp.value?.dispose()
    u.uFondChamp.value = tex
    u.uFondOn.value = 1
    u.uFondPortee.value = fond.portee
    u.uFondMetres.value = 1 / echelle
    // ⚡ **LA CELLULE DU CHAMP, ET ELLE EST DÉRIVÉE DE CE CHAMP-CI — Tâche R17.**
    //
    // ⚠️ **LA CONVERSION, ÉCRITE, PARCE QUE C'EST LA CLASSE DE DÉFAUT LA PLUS
    // FRÉQUENTE DE CE CHANTIER.** `qCrop` se mesure en DEMI-CÔTÉS DE CROP ; le
    // champ couvre `2 × fond.portee` demi-côtés sur `fond.cote − 1` INTERVALLES
    // (385 nœuds, 384 intervalles). Une cellule vaut donc
    // `2 × portee / (cote − 1)` demi-côtés — à `portee = 3` et
    // `CHAMP_FOND = 384`, **0,015625**, soit **214,01 m de sol** à La Réunion
    // z12 (relevé au banc R17). Le nuanceur la reconvertit en UV par `qParUv`.
    //
    // ⛔ **ELLE SE DÉRIVE DU CHAMP POSÉ, JAMAIS DES CONSTANTES.** `poserFondCrop`
    // accepte une `portee` et un `champN` : deux écritures jumelles — l'une ici,
    // l'autre depuis `PORTEE_CROP` et `CHAMP_FOND` — divergeraient au premier
    // appelant qui passe autre chose, et le gradient dériverait alors d'une
    // grille qui n'est pas celle qu'il lit. C'est la cicatrice que `terrain.js`
    // documente, et `test/fond-marin-pas.test.js` ⑤ la balaie sur les deux axes.
    u.uFondPasQ.value = (2 * fond.portee) / Math.max(1, fond.cote - 1)
  }

  /**
   * Rebâtit les maillages dont la surface dépend du fond.
   *
   * ⚠️ **SEULEMENT CEUX QUI ONT ENCORE LEURS HAUTEURS, ET C'EST UNE LIMITE
   * ASSUMÉE.** `_buildMesh` relâche `t.heights` sauf pour les clés de
   * `gardeHauteurs` — c'est-à-dire l'emprise que le flux réserve, bloc et mer
   * comprises (Tâche J, `aussi`). Une tuile hors réservation ne peut pas être
   * rebâtie sur place : il faudrait la redemander au réseau, ce que
   * `_rechargeTuiles` fait pour TOUTE la planète. Le fond ne couvre que la
   * calotte, et la calotte est réservée : le cas ne se pose pas aujourd'hui,
   * mais **il se posera si la portée du champ dépasse un jour la réservation**.
   */
  _refaireMaillagesDuFond() {
    let n = 0
    for (const t of this.tiles.values()) {
      if (t.state !== 'ready' || !t.heights || !t.mesh) continue
      this.group.remove(t.mesh)
      t.mesh.geometry.dispose()
      libererMateriauTuile(this, t.mesh) // PF4 : jamais le matériau partagé
      t.mesh = null
      this._buildMesh(t)
      n++
    }
    return n
  }

  /** Avance le temps de la mer — l'appelant décide de la cadence. */
  animerMer(dt) {
    if (!this._mer) return
    this._mer.material.uniforms.uMerTemps.value += dt
  }

  /**
   * Pose les deux accalmies d'`ocean.js` sur l'écume de la calotte — Tâche P4.
   *
   * ⚠️ **ELLE NE CALCULE RIEN, ELLE POSE.** La loi vit dans `Ocean.setView` et
   * nulle part ailleurs ; `accalmieDuSocle` (`monde/ecume-mer.js`) ne fait que
   * lire ses deux uniformes. **Relevé le 2026-08-22 dans la page vivante,
   * La Réunion z12 : `uViewCalm = 0,4039`, `uSurfCalm = 0,08`** — le ressac du
   * socle est donc multiplié par **0,0323** là où la calotte le multipliait par
   * **1**. Trente et une fois.
   *
   * ⚠️ **UN ARGUMENT ABSENT OU INCOMPLET REND LE NEUTRE**, c'est-à-dire la mer
   * d'avant cette tâche au bit près : un demi-couple (une accalmie posée,
   * l'autre pas) serait pire que pas d'accalmie du tout.
   *
   * ⚠️ **ET LE GIVRE ET LE CIEL PASSENT PAR LÀ AUSSI**, pour la même raison :
   * `poserMer` codait `uSky` en dur (`#bcd8ea` contre `#85c2eb` vivant) et le
   * rideau d'eau n'avait aucun givre alors que le socle vit à **0,56**.
   *
   * ⚠️ **ET DEPUIS LA TÂCHE P5, L'ÉTAT DE MER ET LE FOND MARIN PASSENT PAR ICI
   * AUSSI**, pour exactement la même raison, et parce qu'ils changent SANS que
   * la mer soit rebâtie : une palette, un fond de `SEABEDS`, un curseur du
   * panneau « Sea ». Re-poser la mer à chaque fois coûterait un champ de 385².
   * **Six réglages** (`etatMerDuSocle`, `monde/ecume-mer.js`) et **trois
   * couleurs** (`couleursFondDuSocle`, `monde/mer-sphere.js`) — tous LUS sur les
   * uniformes vivants du socle, aucun redérivé.
   *
   * ⚠️ **LES TROIS COULEURS DE FOND VIVENT SUR `this.uniforms`, PAS SUR LA
   * MER** : elles peignent les TUILES (la rampe nautique du fragment), pas la
   * lame d'eau. Elles restent malgré tout derrière la garde `this._mer` :
   * `retirerMer` éteint `uMerRampeOn` et remet `RAMPE_NAUTIQUE`, donc sans mer
   * ces trois-là ne peignent rien et ne doivent pas bouger.
   *
   * ⚠️ **ET DEPUIS LA TÂCHE P6, LA LAME D'EAU ELLE-MÊME PASSE PAR ICI** : ses
   * quatre réglages (`uTransp`, `uSunFx`, `uDayLight`, `uDetail`), ses deux
   * couleurs, la couleur du soleil et le SPECTRE de houle. Tous LUS sur les
   * uniformes vivants du socle, aucun redérivé — et tous par image, parce que
   * la tirette de transparence, celle d'heure et `reseed` changent SANS
   * déplacer le crop.
   *
   * @param {{vue:number, surface:number, givre?:number, ciel?:object,
   *   etat?:{houle:number,chop:number,ecume:number,ecumeEchelle:number,brillance:number,vitesse:number},
   *   fond?:{peu:object,moyen:object,fond:object},
   *   eau?:{transparence:number,soleilFx:number,jour:number,detail:number},
   *   couleurs?:{peu:object,fond:object}, soleilCouleur?:object,
   *   spectre?:{a:Array,b:Array}}|null} [reglages]
   * @returns {{vue:number, surface:number, givre:number, etat:object, fond:boolean,
   *   eau:object, couleurs:boolean, spectre:boolean}|null} ce qui a été posé
   */
  majReglagesMer(reglages = null) {
    if (!this._mer) return null
    const ok = reglages && Number.isFinite(reglages.vue) && Number.isFinite(reglages.surface)
    const a = ok ? reglages : ACCALMIE_NEUTRE
    const u = this._mer.material.uniforms
    u.uMerCalmeVue.value = a.vue
    u.uMerCalmeSurf.value = a.surface
    const givre = Number.isFinite(reglages?.givre) ? reglages.givre : 0
    u.uMerGivre.value = givre
    if (reglages?.ciel?.isColor) u.uSky.value.copy(reglages.ciel)

    // ══════ L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4 ═════════════════
    //
    // ⚠️ **TOUT OU RIEN, ET LE TOUT EST SIX.** Un état incomplet — la houle du
    // socle avec le chop du module — serait la mer de personne : c'est le
    // raisonnement du demi-couple d'accalmies, appliqué à six. `etatMerDuSocle`
    // rend déjà six nombres finis par construction, et sans socle à lire il rend
    // `ETAT_MER_NEUTRE`, c'est-à-dire ce que `poserMer` posait.
    const e = reglages?.etat
    const etat = e && [e.houle, e.chop, e.ecume, e.ecumeEchelle, e.brillance, e.vitesse].every(Number.isFinite)
      ? e
      : ETAT_MER_NEUTRE
    u.uMerHoule.value = etat.houle
    u.uMerChop.value = etat.chop
    u.uMerEcume.value = etat.ecume
    u.uMerEcumeEchelle.value = etat.ecumeEchelle
    u.uMerBrillance.value = etat.brillance
    u.uMerVitesse.value = etat.vitesse

    // ══════ LES TROIS COULEURS DU FOND — Tâche P5 ═══════════════════════════
    //
    // ⚠️ **`copy`, PAS `set`** : ce sont les objets `Color` VIVANTS du socle, et
    // les recopier plutôt que les partager est délibéré. Partager l'objet
    // ferait qu'un `retirerMer` remettant `RAMPE_NAUTIQUE` REPEINDRAIT le socle.
    const f = reglages?.fond
    const fond = !!(f?.peu?.isColor && f?.moyen?.isColor && f?.fond?.isColor)
    if (fond) {
      this.uniforms.uOceanShallow.value.copy(f.peu)
      this.uniforms.uOceanMid.value.copy(f.moyen)
      this.uniforms.uOceanDeep.value.copy(f.fond)
    }

    // ══════ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ═════════════════
    //
    // ⚠️ **TOUT OU RIEN, ET LE TOUT EST QUATRE** — même raisonnement que les six
    // de l'état de mer juste au-dessus : une transparence du socle avec un
    // clapot du module serait la mer de personne. `lameEauDuSocle` rend quatre
    // nombres finis par construction, et sans socle à lire il rend
    // `LAME_EAU_NEUTRE`, c'est-à-dire les `??` d'`ocean.js`.
    const l = reglages?.eau
    const eau = l && [l.transparence, l.soleilFx, l.jour, l.detail].every(Number.isFinite)
      ? l
      : LAME_EAU_NEUTRE
    u.uMerTransp.value = eau.transparence
    u.uMerSoleilFx.value = eau.soleilFx
    u.uMerJour.value = eau.jour
    u.uMerDetail.value = eau.detail

    // ══════ LA RÉFRACTION — Tâche R2, ET ELLE EST À PART DES QUATRE ═════════
    //
    // ⚠️ **SON NEUTRE VIT DANS `monde/eau-refraction.js`, PAS DANS LE GROUPE
    // « eau »**, parce que `ecume-mer.js` doit rester sans importation
    // (`test/ecume-mer.test.js` ③c). Elle a donc sa propre garde, de la même
    // forme : une valeur non finie rend le neutre, jamais la valeur du voisin.
    u.uMerRefract.value = Number.isFinite(reglages?.refraction)
      ? reglages.refraction
      : REFRACTION_NEUTRE

    // ══════ LES DEUX COULEURS DE LA LAME — Tâche P6 ═════════════════════════
    //
    // ⚠️ **`copy`, PAS `set`, ET POUR LA MÊME RAISON QUE LES TROIS DU FOND** :
    // ce sont les `Color` VIVANTS du socle, et partager l'objet ferait qu'un
    // `retirerMer`… ne les touche pas — mais `_applySea` du socle, si, et deux
    // matériaux qui partagent une couleur finissent par se la disputer.
    const c = reglages?.couleurs
    const couleurs = !!(c?.peu?.isColor && c?.fond?.isColor)
    if (couleurs) {
      u.uMerPeu.value.copy(c.peu)
      u.uMerFond.value.copy(c.fond)
    }
    // ⚠️ **LA COULEUR DU SOLEIL, MÊME PATRON** : `#ffffff` était codé en dur
    // dans `poserMer` contre `#fff7e6` vivant.
    if (reglages?.soleilCouleur?.isColor) u.uSunColor.value.copy(reglages.soleilCouleur)

    // ══════ LE SPECTRE DE HOULE — Tâche P6, PAR RÉFÉRENCE ═══════════════════
    //
    // ⛔ **LE CROP TIRAIT SA PROPRE MER AU HASARD.** `poserMer` faisait
    // `makeSeaState(graine || undefined)` avec une `graine` que personne n'a
    // jamais passée, pendant que le socle vit sur `makeSeaState(params.seaSeed)`
    // — relevé le 2026-08-22 : `params.seaSeed = 9879`, et le premier train de
    // houle valait `(0,230 · 0,973 · …)` côté crop contre `(0,659 · −0,753 · …)`
    // côté socle. **Deux houles de directions différentes.**
    //
    // ⚠️ **PAR RÉFÉRENCE, ET C'EST CE QUE FAIT DÉJÀ `_applySea`** : lui aussi
    // assigne `u.a` / `u.b` à TOUS ses matériaux sans les cloner. Un `graine`
    // sur `poserMer` n'aurait pas suffi — `setSeed`/`reseed` remplacent les deux
    // tableaux en cours de session sans rien rebâtir, et la calotte serait
    // restée sur l'ancienne mer.
    const sp = reglages?.spectre
    const spectre = !!(Array.isArray(sp?.a) && Array.isArray(sp?.b) && sp.a.length && sp.b.length)
    if (spectre) {
      u.uWaveA.value = sp.a
      u.uWaveB.value = sp.b
    }

    // ══════ L'ÉCHELLE DE LONGUEUR DE HOULE — Tâche P6, réserve n° 3 de P5 ═══
    //
    // ⛔ **`ECHELLE_HOULE_UNITES = 0,42` ÉTAIT ÉCRIT EN DUR** pendant que le
    // socle vit sur `LEN_SCALE × clamp(waveScale)` — relevé à `0,231`. P5 avait
    // mesuré l'écart (« le spectre du crop est 1,818 fois plus étiré ») et ne
    // l'avait pas fermé « parce que les deux vivent dans des systèmes d'unités
    // différents ». **Le système de conversion existe : c'est `uMerUnite`**, la
    // même monnaie que la tavelure (P4) et que l'amplitude de houle.
    //
    // ⚠️ **CONVERTI ICI ET NULLE PART AILLEURS** : `ocean.js` remonte des unités
    // de SOCLE, le crop est le seul à savoir ce que vaut une unité de socle chez
    // lui. Sans échelle à lire, `poserMer` garde celle du module.
    const es = reglages?.echelleSpectre
    const unite = u.uMerUnite?.value
    const echelleSpectre = Number.isFinite(es) && es > 0 && Number.isFinite(unite) && unite > 0
    if (echelleSpectre) u.uMerLambda.value = es * unite

    return { vue: a.vue, surface: a.surface, givre, etat, fond, eau, couleurs, spectre, echelleSpectre }
  }

  /** Retire la mer — le globe redevient une planète sans eau animée. */
  retirerMer() {
    // ⚠️ LA RAMPE NAUTIQUE S'ÉTEINT MÊME SANS MAILLAGE, et c'est le défaut C-3
    // de la Tâche C appliqué d'avance : là-bas `retirerHabillage` ne rendait
    // que quatre uniformes sur seize, et la planète entière gardait l'intervalle
    // de courbes du crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles :
    // le laisser allumé repeindrait tous les océans du monde.
    const u = this.uniforms
    u.uMerRampeOn.value = 0
    u.uMerFondBudgetM.value = RAMPE_MONDE.profondeur
    u.uOceanShallow.value.set(RAMPE_NAUTIQUE.peu)
    u.uOceanMid.value.set(RAMPE_NAUTIQUE.moyen)
    u.uOceanDeep.value.set(RAMPE_NAUTIQUE.fond)
    // ⛔ **LA CIBLE DE COPIE SE REND AVANT LE GARDE-FOU `!this._mer`, ET C'EST
    // UNE FUITE MESURÉE** — Tour de correction R2. La `FramebufferTexture` du
    // grab pass appartient au GLOBE, pas au maillage : elle survivait donc à
    // `retirerMer`, texture GPU comprise. Relevé par le relecteur, à chaud,
    // après un cycle lever/baisser du drapeau dans la MÊME session : 1014 × 414
    // en `HalfFloatType` encore allouée, et `renderer.info.memory.textures` qui
    // ne rendait qu'une texture sur deux. C'est borné (une seule cible,
    // réutilisée), donc ce n'est pas une croissance — mais c'est une ressource
    // que `retirerMer` doit rendre, et la ligne de clôture « drapeau baissé,
    // `_merRefractRT: null` » était FAUSSE après ce cycle.
    //
    // ⚠️ **ET ELLE EST AVANT LE `return`, DÉLIBÉRÉMENT** : le maillage peut
    // avoir déjà disparu (une repose est un `retirerMer` de plus) sans que la
    // cible, elle, ait été rendue. `⑩m` de `test/mer-sphere.test.js` mesure le
    // CYCLE, pas l'état initial — un `_merRefractRT` qui naît nul rendrait vert
    // n'importe quel test posé sur la page fraîche.
    this._merRefractRT?.dispose()
    this._merRefractRT = null
    if (!this._mer) return
    this.group.remove(this._mer)
    this._mer.geometry.dispose()
    this._mer.material.uniforms.uMerChamp.value?.dispose()
    this._mer.material.dispose()
    this._mer = null
    this._merEtat = null
  }

  // ═══════════ LES PAROIS ET LA BASE — Tâche B ═══════════════════════════════
  //
  // La Tâche A a coupé la surface ; le crop est devenu une PEAU FLOTTANTE. Ces
  // trois méthodes lui donnent son épaisseur. La loi vit dans
  // `src/monde/parois-crop.js`, qui est pur et testé (`test/crop-parois.test.js`) ;
  // ici il n'y a que du three.js.

  /**
   * La hauteur de la SURFACE au point EXACT (lat, lon), en mètres — ou `null`
   * si aucune tuile chargée ne couvre ce point.
   *
   * ⚠️ **AU POINT EXACT, ET C'EST TOUT L'ENJEU DE LA TÂCHE.** La frontière du
   * crop tombe au MILIEU des tuiles : un sommet de paroi accroché au nœud de
   * tuile le plus proche serait à une autre hauteur que la surface dessinée
   * juste à côté — un liseré, mesuré à plus de 20 m au banc du test. On
   * interpole donc bilinéairement dans la tuile la PLUS FINE qui couvre le
   * point, exactement comme `remplirHauteurs` le fait pour une grille.
   *
   * ⚠️ **LES HAUTEURS NE SURVIVENT QUE SOUS RÉSERVATION** : `_buildMesh` relâche
   * `t.heights` dès le maillage bâti, sauf pour les clés de `gardeHauteurs` —
   * que le flux (`demanderEmprise`) pose précisément sur l'emprise du socle.
   * Sans flux, cette méthode rend `null` et les parois le disent (`couverture`).
   *
   * @param {number} lat
   * @param {number} lon
   * @param {Array} [candidates] la liste pré-filtrée, pour ne pas reparcourir
   *   `this.tiles` à chacun des mille points de l'anneau
   * @returns {number|null}
   */
  hauteurSurface(lat, lon, candidates = null) {
    const best = this._tuileLaPlusFine(lat, lon, candidates)
    // ⚠️ **`null`, JAMAIS `0`** : zéro est le NIVEAU DE LA MER, et le confondre
    // avec « je ne sais pas » creuse une encoche dans la paroi (§7 de
    // `parois-crop.js`). C'est l'appelant qui décide, pas cette méthode.
    // ⚠️ **ET LE FOND DU CROP PASSE PAR ICI AUSSI — Tâche J bis.** Sans fond
    // posé, `altitudeSonde` rend la valeur BRUTE — le dépôt au bit près,
    // négatifs du terrarium compris.
    const brut = best ? sampleHeights(best.t.heights, best.tx, best.ty, best.t.size) : null
    const fond = this._fondCrop ?? null
    return altitudeSonde(brut, fond ? echantillonnerFond(fond, lat, lon) : null)
  }

  /**
   * LA HAUTEUR QUE LE GPU DESSINE — Tâche P11.
   *
   * ⛔ **CE N'EST PAS `hauteurSurface`, ET LA DIFFÉRENCE EST LE MANQUE N° 2 DE LA
   * NOTATION 03.** `hauteurSurface` rend la DONNÉE : la texture terrarium,
   * interpolée bilinéairement à ses 256 (ou 512) texels par tuile. Le GPU, lui,
   * dessine le MAILLAGE : `segmentsTuile(z)` quads, soit **vingt-cinq sommets
   * par côté à z12**. La paroi du crop se posait sur la première et se raccordait
   * à la seconde — d'où, mesuré sur les 1 020 points de l'anneau dans la page
   * vivante (`.banc/P11/M1-bord-avant.json`), un écart de **18,94 m en moyenne
   * absolue**, **±(54 ; 47) m aux percentiles 5 et 95**, **−270,6 / +202,4 m aux
   * extrêmes**, soit **|0,65| px à l'écran en moyenne et 9,8 px au pire**. Là où
   * l'anneau passe SOUS le maillage, la surface pend par-dessus l'arête haute :
   * c'est le drapé. Là où il passe AU-DESSUS, on voit du mur là où le socle
   * montre du terrain.
   *
   * ⚠️ **ELLE REPRODUIT LA LOI DE NŒUD DE `_buildMesh`, PAS UNE LOI VOISINE** :
   * `altitudeMaillage(sampleHeights(...), echantillonnerFond(...))`, aux MÊMES
   * `(u, v)` et avec le MÊME `lat/lon` par nœud. `altitudeSonde` y écrêterait
   * autrement la mer (`test/fond-crop.test.js` porte l'écart), et une paroi qui
   * suivrait `altitudeSonde` repasserait sous sa propre surface.
   *
   * ⚠️ **`null` TRAVERSE, COMME POUR `hauteurSurface`** : c'est ce qui garde le
   * refus de couverture des parois (§7 de `parois-crop.js`) exactement aussi
   * mordant qu'avant.
   */
  hauteurDessinee(lat, lon, candidates = null) {
    const best = this._tuileLaPlusFine(lat, lon, candidates)
    if (!best) return null
    const t = best.t
    const G = segmentsTuile(t.z)
    const fond = this._fondCrop ?? null
    return interpolerMaille(best.tx, best.ty, G, (i, j) => {
      const u = i / G
      const v = j / G
      // ⚠️ **LE `lat/lon` DU NŒUD, PAS CELUI DU POINT DEMANDÉ** : `_buildMesh`
      // lit le champ du fond à la position de CHAQUE sommet. Prendre le lat/lon
      // du point rendrait un fond constant sur toute la cellule — une seconde
      // loi, et elle divergerait de la première dès que le fond a du relief.
      const p = tileToLatLon(t.x + u, t.y + v, t.z)
      return altitudeMaillage(
        sampleHeights(t.heights, u, v, t.size),
        fond ? echantillonnerFond(fond, p.lat, p.lon) : null,
      )
    })
  }

  /**
   * La tuile la plus FINE qui couvre un point — **une seule écriture**.
   *
   * ⚠️ **ELLE ÉTAIT DANS `hauteurSurface`, ET LA TÂCHE P11 L'EN SORT PARCE QU'UN
   * SECOND LECTEUR EST APPARU.** Le repli d'antiméridien au modulo (ci-dessous)
   * a coûté un banc entier à la Tâche B ; le recopier dans `hauteurDessinee`
   * aurait fait deux replis à garder d'accord.
   */
  _tuileLaPlusFine(lat, lon, candidates = null) {
    const liste = candidates || this.tuilesAvecHauteurs()
    const mx = mercX(lon)
    const my = mercY(lat)
    let best = null
    for (const t of liste) {
      const n = 2 ** t.z
      // ⚠️ **LE REPLI D'ANTIMÉRIDIEN SE FAIT AU MODULO, PAS AU `round`, ET LA
      // DIFFÉRENCE EST MESURÉE** (`.banc/repli-B.mjs`, huit cas). Le mercator x
      // est de période 1, donc de période `n` en coordonnées de tuile. La forme
      // `tx -= round(tx / n) * n` replie dans `(−n/2, n/2]`, ce qui est FAUX dès
      // que `n` vaut 1 : la tuile unique d'un z0 rejette alors tout point au-delà
      // de mx = 0,5, c'est-à-dire la moitié de la planète. `ROOT_Z = 2` fait qu'on
      // ne rencontre pas ce cas aujourd'hui — raison de plus pour le corriger
      // avant qu'il ne devienne un défaut vivant. Le modulo replie dans `[0, n)`,
      // l'intervalle où la question « suis-je dans cette tuile ? » se pose, et il
      // est juste pour tout `n` **et pour un `t.x` hors bornes**.
      const tx = (((mx * n - t.x) % n) + n) % n
      const ty = my * n - t.y
      if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue
      if (!best || t.z > best.t.z) best = { t, tx, ty }
    }
    return best
  }

  /** Les tuiles dont les hauteurs sont encore là, du plus fin au plus grossier. */
  tuilesAvecHauteurs() {
    const out = []
    for (const t of this.tiles.values()) if (t.heights) out.push(t)
    out.sort((a, b) => b.z - a.z)
    return out
  }

  /**
   * Bâtit les parois et la base du crop, et les pose dans le groupe du globe.
   *
   * ⚠️ **ELLE RECONSTRUIT TOUT, ET ELLE N'EST PAS FAITE POUR TOURNER PAR IMAGE.**
   * Décision 5 du plan précédent, toujours en vigueur : « la gravure ne s'écrit
   * qu'à l'arrêt ». L'appelant décide quand.
   *
   * @param {object} [arg]
   * @param {number} [arg.profondeur] en unités de scène ; défaut :
   *   `fractionProfondeur × largeur`
   * @param {number} [arg.fractionProfondeur] la profondeur EN FRACTION de la
   *   largeur. ⛔ **Tâche P6 : `FRACTION_PROFONDEUR = 7 / 56` était GELÉE.** Sept
   *   et cinquante-six sont `params.plinthDepth` et `TERRAIN_SIZE` **à leur
   *   valeur d'usine** ; la tirette « profondeur du socle » creuse le bloc plat
   *   et ne touchait pas le bloc du crop. Relevé le 2026-08-22 :
   *   `plinth.depth = 7` — donc **concordant par coïncidence**, exactement comme
   *   les deux couleurs de la lame d'eau.
   * @param {number} [arg.baseYFloor] fond imposé, jamais plus haut
   * @param {number} [arg.fractionChanfrein] le liseré d'arête haute, EN FRACTION
   *   DE LA LARGEUR. ⚡ **C'EST UN INSTRUMENT DE BANC, PAS UN RÉGLAGE PRODUIT** :
   *   la règle D13 retire le cérémonial du « défaut au bit près » mais lui garde
   *   une vertu — *« un drapeau qui éteint un changement permet un A/B à témoin
   *   nul, et c'est ce qui a produit les meilleures preuves du chantier »*. À
   *   `0`, le bloc retrouve ses arêtes vives d'avant la Tâche P13, **dans la
   *   même page, à la même seconde** ; c'est ainsi que le liseré a été mesuré.
   * @param {number} [arg.fractionArrondi] le rayon du congé bas, même monnaie,
   *   même usage.
   * @param {number} [arg.arrondiSeg] les segments de l'arc du congé.
   * @returns {{mesh: object, couverture: number, solide: object}|null}
   */
  construireParoisCrop({
    profondeur = null,
    fractionProfondeur = undefined,
    baseYFloor = null,
    couvertureMin = 1,
    fractionChanfrein = undefined,
    fractionArrondi = undefined,
    arrondiSeg = undefined,
  } = {}) {
    if (!this._crop) return null
    // ⚠️ LA LISTE EST PRÉ-FILTRÉE UNE FOIS : l'anneau fait plus de mille points,
    // et reparcourir `this.tiles` (jusqu'à 1 700 entrées) à chacun ferait deux
    // millions d'itérations pour une géométrie qu'on ne bâtit qu'à l'arrêt.
    const liste = this.tuilesAvecHauteurs()
    // ⚠️ **ON PASSE `hauteurSurface` TELLE QUELLE, `null` COMPRIS.** L'ancienne
    // version rattrapait le `null` en `0` — le niveau de la mer — et fabriquait
    // une encoche muette. La décision et son motif sont au §7 de `parois-crop.js`.
    const solide = construireSolideCrop({
      couvertureMin,
      repere: this._crop,
      forme: {
        coin: this.uniforms.uCropCoin.value,
        expo: this.uniforms.uCropCoinN.value,
      },
      // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE, ET C'EST VOULU** : une
      // valeur écrite ici en serait une seconde, et deux défauts jumeaux
      // divergent (le `uContourInterval` de la Tâche C, réparé au tour 1).
      fractionProfondeur,
      // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE**, pour la même raison que
      // `fractionProfondeur` juste au-dessus : deux défauts jumeaux divergent.
      fractionChanfrein,
      fractionArrondi,
      arrondiSeg,
      // ⛔ **`hauteurDessinee`, PAS `hauteurSurface` — Tâche P11, ET C'EST LE
      // MANQUE N° 2 DU NOTEUR.** L'anneau haut doit se poser sur la surface que
      // le GPU DESSINE (le maillage de la tuile), pas sur la donnée qu'il n'a
      // pas (la texture, dix fois plus fine). Le §0 de `monde/maillage-tuile.js`
      // porte la mesure : 18,94 m d'écart moyen absolu le long de l'anneau, ±10
      // pixels à l'écran, dans les DEUX SENS — la paroi dépassait la surface
      // ici, la surface pendait par-dessus l'arête là.
      hauteur: (lat, lon) => this.hauteurDessinee(lat, lon, liste),
      rayon: R_GLOBE,
      echelle: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration,
      profondeur,
      baseYFloor,
      // ⚠️ **LE PLANCHER SUIT LA SURFACE — Tâche J bis, ET SANS LUI LE BLOC EST
      // FAUX.** Le §4 de `parois-crop.js` écrit pourquoi il valait zéro : « le
      // globe pose ses sommets à `Math.max(sampleHeights(...), 0)`, une paroi
      // qui suivrait la bathymétrie brute passerait SOUS la surface dessinée ».
      // C'est exactement l'inverse depuis qu'un fond est posé : c'est un
      // plancher à zéro qui ferait passer la paroi AU-DESSUS de sa propre
      // surface. Relevé à l'écran avant ce correctif : `baseY` identique au
      // millionième avec et sans fond (−0,054 132 4 unité), pour une surface
      // descendue de **2 116,3 m**. Avec, il vaut −0,147 117 — **2,718 fois plus
      // profond**, et c'est le bloc entier qui change de silhouette.
      // ⚠️ **ET IL EST FINI, PAS `-Infinity`** : `construireSolideCrop` s'en sert
      // aussi de repli, et un infini y produirait des sommets `NaN`.
      plancherMer: this._fondCrop ? -Math.max(this._fondCrop.profMaxM, 0) : 0,
    })

    // ⚠️ **LE REFUS NE TOUCHE PAS AUX PAROIS DÉJÀ POSÉES.** C'est ce qui le rend
    // acceptable : le bloc précédent reste à l'écran jusqu'à ce que la donnée
    // arrive, et l'appelant n'a rien à défaire.
    if (solide.refus) return { mesh: null, solide, couverture: solide.couverture, refus: solide.refus }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(solide.positions, 3))
    // l'occlusion de contact, cuite par sommet. ⚠️ NOM PROPRE, pas `color` : le
    // `vertexColors` de three ne déclare `attribute vec3 color` que sous son
    // propre `#define`, et ce nuanceur-ci n'a pas à en dépendre.
    geo.setAttribute('aoCrop', new THREE.BufferAttribute(solide.couleurs, 3, true))
    geo.setIndex(new THREE.BufferAttribute(solide.indices, 1))
    // ⚠️ DÉ-INDEXÉ, PUIS NORMALES DE FACE — SAUF SUR LE CONGÉ. Des normales
    // moyennées auraient lissé l'arête entre le mur et le fond, et `plinth.js`
    // explique pourquoi ce serait faux : « c'est elle qui donne au liseré
    // d'arête sa cassure nette ». Le coût est de trois sommets par triangle au
    // lieu d'un.
    //
    // ⛔ **`computeVertexNormals` NE SUFFIT PLUS DEPUIS LA TÂCHE P13**, et c'est
    // le cœur du portage du congé : la normale de FACE rendrait les trois
    // segments de l'arc comme **trois facettes**, « l'inverse exact de
    // l'intention » (`plinth.js`). `normalesParois` rend la normale de face
    // partout et la normale ANALYTIQUE sur le congé — **dans le module PUR**,
    // donc tenue par des tests qui l'EXÉCUTENT, et non par un `assert.match` sur
    // cette ligne-ci. Le test ⑬d apparie sa sortie à `computeVertexNormals` de
    // three sur tout ce qui n'est pas le congé.
    const plate = geo.toNonIndexed()
    plate.setAttribute('normal', new THREE.BufferAttribute(normalesParois(solide), 3))
    plate.computeBoundingSphere()
    geo.dispose()

    this.retirerParoisCrop()
    const mesh = new THREE.Mesh(plate, this._materiauParois())
    mesh.name = 'crop-parois'
    // le repère local du crop : (est, haut, sud) posé à l'origine du crop. C'est
    // lui qui rend le RTC gratuit et la verticale UNIQUE (§2 de parois-crop.js).
    const M = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(solide.base.est.x, solide.base.est.y, solide.base.est.z),
      new THREE.Vector3(solide.base.haut.x, solide.base.haut.y, solide.base.haut.z),
      new THREE.Vector3(solide.base.sud.x, solide.base.sud.y, solide.base.sud.z)
    )
    M.setPosition(solide.origine.x, solide.origine.y, solide.origine.z)
    M.decompose(mesh.position, mesh.quaternion, mesh.scale)
    if (!this._matricesAuto) { mesh.updateMatrix(); mesh.matrixAutoUpdate = false } // PF4 : les parois sont posées une fois
    this.group.add(mesh)
    // ⚠️ **L'ÉTAT RETENU EST APPLIQUÉ AU MESH NEUF — Tâche R22, option 48.**
    // Sans cette ligne, un socle éteint reviendrait au premier déplacement,
    // parce que ce mesh-ci vient de naître. Voir `_paroisVisibles`.
    mesh.visible = this._paroisVisibles
    this._parois = mesh
    // ⚠️ **LE FOND DU BLOC EST RETENU POUR LE RIDEAU D'EAU — Tâche P4.** Le
    // ruban de mer descend jusqu'à LUI, pas jusqu'à une profondeur à part : deux
    // fonds auraient laissé un jour ou un chevauchement sur tout le périmètre.
    // `MAILLONS` met `parois` AVANT `mer`, donc la valeur est là quand `poserMer`
    // la lit ; si les parois ont refusé, elle est nulle et le rideau n'est pas
    // bâti (dit dans `_merEtat.jupe`) plutôt que posé sur un fond deviné.
    this._baseYCrop = solide.baseY
    // ⛔ **ET LE RETRAIT DE SA BASE — Tâche P13, SANS QUOI LA MER DÉPASSE.**
    // Le rideau d'eau rentre de `chanfrein + marge` (`RETRAIT_EAU_CROP`), ce
    // qui suffisait tant que le mur était vertical de haut en bas. Le congé
    // rentre la BASE de `chanfrein + congé`, **3,9 fois plus** : mesuré à
    // l'écran avant réparation, **792 px de mer sous le bas du mur en 4
    // langues**, contre **0** dans l'état d'avant P13 rebâti à la même seconde
    // (`.banc/P13/P2-jupes-P13.json`). C'est le défaut que `plinth.js` raconte
    // sur le socle — « on voit l'eau à travers le bloc » — et sa parade est la
    // même : **une définition de « où finit le bloc », LUE et non devinée.**
    //
    // ⚠️ **EN DEMI-CÔTÉS DE CROP, LA MONNAIE DE `mer-sphere.js`** : le rideau
    // rentre en fraction du demi-côté, pas en unités de scène.
    this._retraitBaseCrop = solide.largeur > 0
      ? (solide.chanfrein + solide.arrondi) / (solide.largeur / 2)
      : 0
    // ⛔ **ET LE PLANCHER DES JUPES MONTE AU SOMMET DU CONGÉ — même cause, autre
    // conséquence.** La jupe d'une tuile pend à l'aplomb du bord de la tuile ;
    // sous le sommet du congé, la silhouette du mur RENTRE, donc la jupe
    // dépasse par le bas. Mesuré à l'écran : **82 px de tuile sous le bas du
    // mur, en 4 langues**, contre **0** avant P13 — et **0 quand on éteint les
    // jupes par `setDrawRange`**, ce qui les désigne sans les supposer
    // (`.banc/P13/P4-trainees-P13.json`). ⚠️ **C'est la même dette que le
    // rideau d'eau, et la même parade** : la jupe s'arrête là où le mur cesse
    // d'être vertical.
    this._plancherJupeCrop = solide.baseY + solide.arrondi
    // ⛔ **ET LE RETRAIT LATÉRAL DU MUR — Tâche P14, LA MOITIÉ QUE P13 N'A PAS
    // FAITE.** `_plancherJupeCrop` a corrigé la LONGUEUR de la jupe ; il ne
    // pouvait rien contre son DÉCALAGE LATÉRAL, et P13 le dit elle-même
    // (« aucun réglage de la LONGUEUR ne peut réparer un décalage LATÉRAL »).
    // Sous le chanfrein le mur est à `d = ch` **à toute hauteur** ; la jupe pend
    // à `d = 0`. **Le mur est passé derrière elle**, et le noteur compte
    // **23 traînées pâles contre 4 au socle** (`notation-05.md` §7.2).
    // ⚠️ **MÊME MONNAIE QUE `_retraitBaseCrop` ET QUE `mer-sphere.js`** : une
    // FRACTION DU DEMI-CÔTÉ, parce que c'est celle où `jupeHorsDuMur` compare —
    // les coordonnées locales du crop valent ±1 sur l'emprise.
    this._retraitJupeCrop = solide.largeur > 0 ? solide.chanfrein / (solide.largeur / 2) : 0
    // ⚠️ **ET LES JUPES DES TUILES SE RETAILLENT DESSUS — Tâche P7.** C'est ici
    // et pas dans `_buildMesh` parce que l'ordre l'impose : les parois exigent
    // des tuiles bâties (`couverture`), donc les tuiles du premier bloc sont
    // toujours plus vieilles que son fond. `_retaillerJupe` est idempotente et
    // recalcule depuis l'anneau de bord — la rappeler ne creuse rien.
    this._retaillerJupes()
    return { mesh, solide, couverture: solide.couverture, refus: null }
  }

  /**
   * « Afficher le socle » (option 48 du Studio), porté sur la découpe.
   *
   * ⚠️ **CACHE, NE RETIRE PAS** — les quatre valeurs dérivées des parois
   * (`_baseYCrop`, `_retraitBaseCrop`, `_plancherJupeCrop`, `_retraitJupeCrop`)
   * restent vraies, donc le rideau d'eau et les jupes de tuiles ne bougent pas
   * d'un pixel. Le motif est écrit au champ `_paroisVisibles`.
   *
   * @param {boolean} v
   */
  setParoisVisibles(v) {
    this._paroisVisibles = !!v
    if (this._parois) this._parois.visible = this._paroisVisibles
  }

  /** Retire les parois — le crop redevient une peau flottante. */
  retirerParoisCrop() {
    if (!this._parois) return
    this.group.remove(this._parois)
    this._parois.geometry.dispose()
    this._parois.material.dispose()
    this._parois = null
    // ⚠️ **ET LE FOND DU BLOC PART AVEC LUI — Tâche P7.** Il ne l'était pas :
    // `_baseYCrop` survivait au retrait des parois, et deux lecteurs le
    // consultent maintenant (`poserMer` pour le rideau, `_rayonPlancherCrop`
    // pour la jupe des tuiles). Sans cette ligne, une tuile bâtie APRÈS le
    // retrait du crop se serait fait tailler sa jupe sur un bloc qui n'existe
    // plus. La garde de `poserMer` (`Number.isFinite(basY)`) devient donc vraie
    // pour la même raison qu'elle a été écrite.
    this._baseYCrop = null
    this._retraitBaseCrop = null
    this._plancherJupeCrop = null
    // ⚠️ **ET LE RETRAIT LATÉRAL AUSSI — Tâche P14, même motif que les trois
    // au-dessus** : sans mur, il n'y a plus rien qui couvre une jupe, donc plus
    // rien qui autorise à la couper.
    this._retraitJupeCrop = null
    // et les jupes reprennent leur pleine longueur : sans bloc, plus de plancher
    this._retaillerJupes()
  }

  /**
   * Le rayon du fond du bloc pour la jupe d'une tuile — `0` s'il n'y a pas de
   * bloc, ou si la tuile ne le touche pas. Tâche P7.
   *
   * ⚠️ **DEUX GARDES, ET CHACUNE EMPÊCHE UNE FAUTE DIFFÉRENTE.**
   *   ① `this._parois` : sans parois posées il n'y a **pas de plancher**, et
   *      borner sur une valeur périmée raccourcirait la jupe de tout le globe.
   *   ② `tuileDansCrop` : c'est un test d'INTERSECTION D'EMPRISES, le même que
   *      celui du raffinement (`zoomCropPrescrit`). Sans lui, une tuile à
   *      l'autre bout de la planète — dont le rayon vaut lui aussi ~100 — verrait
   *      sa jupe bornée par un plancher qui n'a rien à voir avec elle.
   *
   * ⚠️ **`R_GLOBE + baseY`, ET C'EST LE RAYON DE L'ORIGINE LOCALE DU CROP** :
   * `repereLocalCrop` place cette origine à `surSphere(centre, R_GLOBE)` et
   * mesure `baseY` le long de la verticale de ce centre. L'écart entre ce rayon
   * et le PLAN du fond est la flèche du crop — chiffrée dans `rabattementBorne`.
   */
  /**
   * LE FOND DU CROP, EN UNITÉS DE GLOBE — l'accès PUBLIC à `_baseYCrop`.
   *
   * ⚠️ **`null` TANT QUE LES PAROIS NE SONT PAS POSÉES**, et l'appelant doit le
   * traiter : `retirerCrop` remet le champ à `null` sur deux chemins nominaux.
   * Le cartouche (`monde/cartouche-globe.js`) retombe alors sur la base du bloc
   * plat, ce qui est la bonne réponse — s'il n'y a pas de crop, il n'y a pas de
   * base de crop.
   *
   * ⚠️ **C'EST LE PLAN DU FOND, MESURÉ LE LONG DE LA VERTICALE DU CENTRE DU
   * CROP** (voir `repereLocalCrop`), donc exactement le repère dans lequel le
   * cartouche se pose une fois la similitude appliquée.
   */
  get baseYCrop() {
    return Number.isFinite(this._baseYCrop) ? this._baseYCrop : null
  }

  _rayonPlancherCrop(t) {
    if (!this._parois || !this._crop || !Number.isFinite(this._baseYCrop)) return 0
    if (!tuileDansCrop(t.z, t.x, t.y, this._crop)) return 0
    // ⚠️ **LE SOMMET DU CONGÉ, PAS LE FOND — Tâche P13.** Sous lui, la
    // silhouette du mur rentre et la jupe dépasse par le bas ; le motif complet
    // est à `_plancherJupeCrop`. ⚠️ **Le repli sur `_baseYCrop` n'est pas un
    // confort** : sans congé (`fractionArrondi: 0`, l'instrument de banc), les
    // deux valeurs coïncident au bit près, et la géométrie d'avant P13 est
    // exactement récupérable.
    const plancher = Number.isFinite(this._plancherJupeCrop) ? this._plancherJupeCrop : this._baseYCrop
    return R_GLOBE + plancher
  }

  /**
   * Retaille la jupe d'UNE tuile sur le plancher du bloc courant — Tâche P7.
   *
   * ⚠️ **IDEMPOTENTE, ET C'EST LA PROPRIÉTÉ QUI LA REND SÛRE.** Elle recalcule
   * chaque sommet de jupe **depuis son sommet de BORD**, jamais depuis sa
   * position courante : l'appeler deux fois, ou l'appeler après un déplacement
   * de bloc, ou l'appeler quand le bloc a disparu (le plancher rend alors `0`,
   * donc la jupe pleine) rend exactement le même tampon. Une version qui
   * rabattrait « encore un peu » à chaque passage creuserait à chaque image.
   *
   * ⛔ **ET DEPUIS LA TÂCHE P14 ELLE BORNE DANS LES DEUX SENS.** La hauteur par
   * `rabattementBorne` (P7 puis P13) ; **le côté par `jupeHorsDuMur`** — un
   * sommet de bord posé sur la frontière du crop est un sommet que le mur ne
   * couvre plus depuis qu'il est rentré de `ch`, et sa jupe **s'efface** (elle
   * se replie sur son propre sommet de bord, donc en triangles d'aire nulle).
   * ⚠️ **L'IDEMPOTENCE SURVIT** : l'effacement se calcule, lui aussi, depuis le
   * sommet de BORD, et `_retraitJupeCrop` nul rend exactement le tampon d'avant.
   *
   * @returns {boolean} vrai si une jupe a été retaillée
   */
  _retaillerJupe(t) {
    const mesh = t?.mesh
    const d = mesh?.geometry?.userData?.jupe
    if (!d) return false
    const rPlancher = this._rayonPlancherCrop(t)
    // ⚠️ **LE MÊME TRI QUE LE PLANCHER, ET IL EST OBLIGATOIRE** : `rPlancher`
    // vaut 0 hors du crop (pas de parois, ou `tuileDansCrop` faux), et une tuile
    // à l'autre bout du monde n'a pas de mur pour couvrir sa jupe. Sans cette
    // garde, les ancêtres grossiers (z2, z3) — dont la BOÎTE contient l'emprise
    // du crop, donc dont `tuileDansCrop` est vrai — perdraient leur jupe.
    const retrait = rPlancher > 0 && Number.isFinite(this._retraitJupeCrop) ? this._retraitJupeCrop : 0
    const attr = mesh.geometry.attributes.position
    const a = attr.array
    const o = mesh.position
    // ⚠️ **L'ANNEAU EST LU EN ENTIER AVANT D'ÊTRE COUPÉ**, parce que la coupe
    // est un VOISINAGE (`jupesEffacees` dilate d'un cran) et qu'un voisinage ne
    // se décide pas sommet par sommet en avançant.
    let efface = null
    if (retrait > 0) {
      const locaux = new Array(d.bord.length)
      for (let bi = 0; bi < d.bord.length; bi++) {
        const src = d.bord[bi]
        locaux[bi] = localDeAbsolu(a[src * 3] + o.x, a[src * 3 + 1] + o.y, a[src * 3 + 2] + o.z, this._crop)
      }
      efface = jupesEffacees(locaux, retrait)
    }
    for (let bi = 0; bi < d.bord.length; bi++) {
      const src = d.bord[bi]
      const dst = d.nV + bi
      if (efface && efface[bi]) {
        a[dst * 3] = a[src * 3]
        a[dst * 3 + 1] = a[src * 3 + 1]
        a[dst * 3 + 2] = a[src * 3 + 2]
        continue
      }
      const X = a[src * 3] + o.x
      const Y = a[src * 3 + 1] + o.y
      const Z = a[src * 3 + 2] + o.z
      const rayon = Math.hypot(X, Y, Z)
      const inv = 1 - rabattementBorne(d.rabattement, rayon, rPlancher) / rayon
      a[dst * 3] = X * inv - o.x
      a[dst * 3 + 1] = Y * inv - o.y
      a[dst * 3 + 2] = Z * inv - o.z
    }
    attr.needsUpdate = true
    mesh.geometry.computeBoundingSphere()
    return true
  }

  /**
   * Retaille les jupes de TOUTES les tuiles — appelée quand le fond du bloc
   * change (parois posées) ou disparaît (parois retirées).
   *
   * ⚠️ **TOUTES, PAS SEULEMENT CELLES DU CROP.** Le tri est dans
   * `_rayonPlancherCrop` (`tuileDansCrop`), et il doit l'être : une tuile qui
   * SORT de l'emprise quand le bloc se déplace doit retrouver sa jupe pleine, et
   * seule une passe qui la visite peut la lui rendre.
   */
  _retaillerJupes() {
    let n = 0
    for (const t of this.tiles.values()) if (this._retaillerJupe(t)) n++
    return n
  }

  // La matière du bloc : la recette d'éclairage des calottes polaires, mot pour
  // mot (`_buildPoleCaps`) — même terminateur, même fondu vers `uShadowColor`.
  // ⚠️ UNE SEULE RECETTE, N LECTEURS : un mur éclairé autrement que la surface
  // qu'il porte se lirait comme un objet rapporté, et c'est exactement le défaut
  // qu'`Adrien` a signalé une fois sur le congé du socle (« la base du socle est
  // traitée comme un objet séparé »).
  // ⚠️ **`DoubleSide` EST VOULU, ET IL REND UN SOLIDE RETOURNÉ VISUELLEMENT
  // IDENTIQUE — IL FAUT DONC DIRE CE QUE L'INVARIANT D'ORIENTATION GARDE COMME
  // SENS.** Avec `DoubleSide` et le retournement de la normale par
  // `gl_FrontFacing`, retourner toutes les faces ne change pas un pixel : le
  // rendu NEUTRALISE l'invariant que la mutation de `test/crop-parois.test.js`
  // défend. Les deux choix restent bons, et voici pourquoi :
  //
  //   · **`DoubleSide` est nécessaire, et c'est relevé à l'écran** : la caméra
  //     ENTRE dans le bloc pendant la descente — à 0,62 unité au-dessus du centre
  //     du crop on est déjà dans sa boîte englobante, le bloc faisant 0,23 unité
  //     de haut pour 0,216 de large à l'exagération 18. En `FrontSide`, on verrait
  //     à travers la paroi depuis l'intérieur — le défaut « on voit sous la
  //     carte » que `plinth.js` passe son fichier à éviter, et pour lequel il a
  //     pris `DoubleSide` lui aussi.
  //   · **L'invariant garde son sens parce que la surface ÉCLAIRÉE n'est pas le
  //     seul consommateur du sens de parcours.** Le socle porte
  //     `walls.castShadow = true` (`plinth.js`), et une carte d'ombre écarte
  //     couramment les faces avant ; et ce dépôt EXPORTE des fichiers
  //     d'impression (plan `2026-08-06-fichiers-impression.md`), où un maillage
  //     retourné est un défaut franc. ⚠️ **Et surtout : un audit qui accepte un
  //     solide retourné n'est pas un audit.** Ā est nulle sur un solide retourné
  //     — c'est le §1 d'`audit-solide.js` — et le volume signé est la seule chose
  //     qui l'attrape. Le désarmer parce que « ça se voit pareil aujourd'hui »
  //     reviendrait à retirer le seul instrument qui le voit.
  _materiauParois() {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uSunDir: this.uniforms.uSunDir,
        uShadowColor: this.uniforms.uShadowColor,
        // le MEME plancher de nuit que les tuiles — Tache R7, tour de correction
        uNuitFond: this.uniforms.uNuitFond,
        uNuitCarte: this.uniforms.uNuitCarte,
        // ⚠️ **PARTAGÉ, PAS PROPRE AU MATÉRIAU — Tâche P3.** Il valait
        // `new THREE.Color('#d8d4cc')`, le DÉFAUT de `params.plinthColor`,
        // pendant que la paroi vivante du socle rendait `c06a44`. Le pourquoi
        // du partage est écrit à la déclaration de `uParoiCouleur`.
        uCol: this.uniforms.uParoiCouleur,
        // ══════ LES CINQ DE L'ÉCLAIRAGE — Tâche P6 ═══════════════════════════
        //
        // ⛔ **P3 A ÉCLAIRÉ LES TUILES ET A LAISSÉ LES PAROIS SUR LE SOLEIL DE
        // LA PLANÈTE, C'EST-À-DIRE SUR LA CAMÉRA.** Elle l'écrit noir sur blanc
        // pour les tuiles — *« uSunDir n'est pas le soleil de la scène : en mode
        // surface, main.js le repose À CHAQUE IMAGE sur camGlobe.position
        // tournée de 42 degrés »* — et n'a pas refait le geste ici. Les parois
        // gardaient donc `0,74 + 0,30 × diff` **contre une direction de caméra**,
        // PLUS le terminateur jour/nuit de la planète.
        //
        // ⚡ **ET C'EST LE GRAND APLAT BEIGE DE LA RÉSERVE N° 1 DE P5.** Relevé
        // le 2026-08-22, La Réunion, au même instant dans la même page :
        // `uSunDir = (0,2305 · −0,3687 · 0,9005)` — **sous l'horizon** — pendant
        // que le soleil de la scène pointait `(0,4392 · 0,5629 · −0,7001)`, et
        // `uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil
        // laisse à `day ≈ 0` rend donc **exactement `uShadowColor`** : c'est un
        // aplat de la couleur du fond, pas une paroi éclairée.
        //
        // ⚠️ **ET LE TERMINATEUR N'A RIEN À FAIRE SUR UN BLOC** — P3 le dit déjà
        // pour les tuiles : *« Le socle n'a pas de nuit : il est un objet de
        // studio, éclairé par trois sources. »* La paroi du socle est un
        // `MeshPhysicalMaterial` rugosité 0,95, métal 0, occlusion par sommet :
        // un diffus pur. `irradianceCrop` est cette loi-là, et c'est la MÊME
        // fonction que les tuiles — pas une seconde.
        //
        // ⛔ **MAIS PAS LES MÊMES UNIFORMES D'AMBIANTE, ET P6 SE TROMPAIT SUR CE
        // POINT — Tâche P8.** La ligne au-dessus disait « les MÊMES uniformes
        // que les tuiles ». Elle a coûté la moitié du manque n° 3 du noteur :
        // **le relief et la paroi du socle ne voient PAS le même
        // environnement.** Le relief voit `scene.environment` à
        // `scene.environmentIntensity` ; la paroi voit son propre studio à
        // `envMapIntensity`, parce que `three` n'écrase l'intensité que sur les
        // matériaux SANS `envMap` à eux. La paroi du crop empruntait donc
        // l'ambiante du RELIEF, **1,54 fois plus forte à plat sur un mur
        // vertical** — d'où ses 26,63 contre 15,88. Mesures, témoins et
        // aller-retours : `environnementEffectif` (`monde/eclairage-crop.js`).
        uSoleilDir: this.uniforms.uSoleilDir,
        uHemiHaut: this.uniforms.uHemiHaut,
        uSoleilIrr: this.uniforms.uSoleilIrr,
        uCielIrr: this.uniforms.uParoiCielIrr,
        uSolIrr: this.uniforms.uParoiSolIrr,
        uEclairageOn: this.uniforms.uEclairageOn,
        // ══════ L'APPOINT — Tâche R21 bis, et il est PARTAGÉ ══════════════════
        //
        // ⚡ **LES DEUX UNIFORMES DES TUILES, PAS DEUX JUMEAUX — ET C'EST LE
        // MÊME ARGUMENT QUE P8, PRIS DANS L'AUTRE SENS.** P8 a démontré que le
        // relief et la paroi ne voient pas le même ENVIRONNEMENT, parce qu'un
        // `envMap` est posé sur UN matériau et que `three` n'écrase
        // `envMapIntensity` que sur ceux qui n'en ont pas. D'où `uParoiCielIrr`
        // et `uParoiSolIrr`, deux lignes au-dessus.
        //
        // ⛔ **L'APPOINT N'EST PAS UN ENVIRONNEMENT : C'EST UNE LAMPE.**
        // `fillLight` est une `THREE.DirectionalLight` de la scène, sans
        // `envMap` et sans ombre — elle éclaire **tous** les matériaux de la
        // scène avec la même irradiance, exactement comme `sun`. C'est pour ça
        // que `uSoleilIrr` est déjà partagé trois lignes plus haut, et l'appoint
        // se range du même côté que lui. **Lui fabriquer un `uParoiAppointIrr`
        // aurait été deux écritures d'une seule grandeur** — et la paroi aurait
        // pu diverger de la surface au premier réglage.
        uAppointDir: this.uniforms.uAppointDir,
        uAppointIrr: this.uniforms.uAppointIrr,
      },
      vertexShader: /* glsl */ `
        attribute vec3 aoCrop;
        varying vec3 vN;
        varying float vAo;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vAo = aoCrop.r;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN;
        varying float vAo;
        uniform vec3 uSunDir;
        uniform vec3 uShadowColor;
        uniform vec3 uNuitFond;
        uniform float uNuitCarte;
        uniform vec3 uCol;
        uniform vec3 uSoleilDir;
        uniform vec3 uHemiHaut;
        uniform vec3 uSoleilIrr;
        uniform vec3 uCielIrr;
        uniform vec3 uSolIrr;
        uniform float uEclairageOn;
        uniform vec3 uAppointDir;
        uniform vec3 uAppointIrr;
        ${GLSL_IRRADIANCE}
        // ⚠️ INJECTE, PAS RECOPIE — Tache R21 bis. Le meme texte que les tuiles,
        // depuis monde/lumiere-sphere.js. Deux ecritures d'irradianceAppoint
        // auraient laisse la paroi et la surface diverger en silence.
        ${GLSL_LUMIERE_SPHERE}
        void main() {
          vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          // ⚠️ SANS ECLAIRAGE, LA LOI DE PLANETE — AU BIT PRES. C'est le repli
          // exact d'avant P6, et c'est ce que rend un globe sans crop pose.
          float diff = max(dot(N, uSunDir), 0.0);
          vec3 colPlanete = uCol * (0.74 + 0.30 * diff) * vAo;
          float day = smoothstep(-0.22, 0.16, dot(N, uSunDir));
          colPlanete = mix(uNuitFond, colPlanete, uNuitCarte + (1.0 - uNuitCarte) * day);
          // L ALBEDO DE LA PAROI : sa couleur x son occlusion de contact, tout
          // comme le socle multiplie material.color par son attribut color.
          // ⚡ ET L'APPOINT S'AJOUTE DANS LA MEME SOMME QUE SUR LES TUILES —
          // Tache R21 bis. R21 avait laisse la paroi de cote (perimetre d'un
          // chantier parallele) et l'avait DIT : « un appoint fort les laisse un
          // cran plus sombres que la surface ». Mesure a l'ecran, appoint a
          // fond : la surface montait de 1,984 de moyenne pendant que la paroi
          // ne bougeait pas. Meme terme, meme fonction, meme uniforme.
          vec3 irrParoi = irradianceCrop(dot(N, uSoleilDir), dot(N, uHemiHaut), uSoleilIrr, uCielIrr, uSolIrr)
            + irradianceAppoint(dot(N, uAppointDir), uAppointIrr);
          vec3 colBloc = uCol * vAo * irrParoi * ${RECIPROQUE_PI};
          gl_FragColor = vec4(uEclairageOn > 0.5 ? colBloc : colPlanete, 1.0);
        }`,
    })
  }

  /**
   * Le mélange des tuiles suit le crop — Tâche B, Étape 5.
   *
   * ⚠️ **IL FAUT LE POSER SUR LES MATÉRIAUX DÉJÀ CRÉÉS**, pas seulement dans
   * `_materialFor` : le globe porte jusqu'à 1 700 tuiles quand `poserCrop`
   * arrive, et chacune a le sien (`uTex` et `uTilePx` sont propres à la tuile).
   */
  _melangeCrop(actif) {
    for (const t of this.tiles.values()) {
      const mm = t.mesh?.material
      const m = Array.isArray(mm) ? mm[0] : mm // R37 : un parent partiel porte un tableau
      if (!m || m.transparent === actif) continue
      m.transparent = actif
      m.depthWrite = true
      m.needsUpdate = true
    }
  }

  // The globe ramp reuses the user's land gradient (the map's identity) and
  // extends it below sea level with vintage-chart bathymetric blues.
  rebuildRamp(params = {}) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 1
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 512, 0)
    // ocean shares the palette's sea colors so globe and surface chart agree
    grad.addColorStop(0.0, params.oceanDeep ?? '#31576b')
    grad.addColorStop(0.19, params.oceanMid ?? '#7fa8b8')
    grad.addColorStop(0.345, params.oceanShallow ?? '#dce8ec')
    // land ramp (up to 8 stops) mapped into [0.35, 1] above the ocean band
    for (const s of rampColorStops(params)) grad.addColorStop(0.35 + 0.65 * s.p, s.c)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    this.uniforms.uRamp.value?.dispose()
    this.uniforms.uRamp.value = tex
  }

  setSunDir(v) {
    this.uniforms.uSunDir.value.copy(v).normalize()
    this.clouds?.setSunDir(v)
  }

  // la couleur vers laquelle la face nuit s'éteint — le FOND courant, atténué
  // par le multiplicateur jour/nuit du décor (bgDayMul) pour rester accordé
  setShadowColor(hex, mul = 1) {
    this.uniforms.uShadowColor.value.set(hex).multiplyScalar(mul)
    this._majNuitFond()
  }

  // ══════════ LE PLANCHER DE NUIT — Tâche R7, tour de correction ═══════════
  //
  // ⛔ **CE N'EST PAS UN RÉGLAGE D'APPARENCE, C'EST LE PRIX DU CORRECTIF R7.**
  // Tant que `uSunDir` suivait la caméra, la face nuit n'était jamais regardée
  // de face et ses 10 % de carte résiduelle ne se voyaient pas. Le correctif la
  // met en plein cadre : à 10 h — l'heure PAR DÉFAUT du produit — l'antisolaire
  // devenait une sphère unie. Mesuré en CHROMA, pas en luminance : la luminance
  // MONTE pendant que la carte disparaît. Valeurs et mesures dans
  // `monde/soleil-monde.js`.
  //
  // ⚠️ **`{ carte: 0.10, froid: 0, coquille: 1 }` EST L'IDENTITÉ** : c'est ce
  // que le globe porte à sa naissance, et c'est ce que `main.js` lui repose
  // drapeau baissé. Rien de tout ceci ne touche la production.
  //
  // @param {{carte:number, froid:number, coquille:number}} n
  setNuitPlanete(n) {
    if (!n) return
    this._nuitFroid = n.froid
    this.uniforms.uNuitCarte.value = n.carte
    this._majNuitFond()
    this.clouds?.setNuitCoquille(n.coquille)
  }

  // la couleur de nuit : le fond du décor, REFROIDI vers un bleu sombre plutôt
  // qu'employé nu. `froid = 0` la laisse EXACTEMENT égale à `uShadowColor`.
  _majNuitFond() {
    const f = this._nuitFroid ?? 0
    this.uniforms.uNuitFond.value.copy(this.uniforms.uShadowColor.value)
    if (f > 0) this.uniforms.uNuitFond.value.lerp(NUIT_FROIDE, f)
  }

  setInk(color) {
    this.uniforms.uInk.value.set(color)
  }

  // --------------------------------------------------------------- caps & halo

  _buildPoleCaps() {
    // ⚠️ LES MATÉRIAUX SONT GARDÉS, ET C'EST L'ESTOMPAGE QUI L'EXIGE (Tâche G) :
    // un alpha ne veut rien dire sur un matériau opaque, il faut basculer
    // `transparent` — et le rebasculer en partant. Même patron que
    // `_melangeCrop` pour les tuiles.
    this._calottes = []
    for (const north of [true, false]) {
      const geo = new THREE.SphereGeometry(
        R_GLOBE * 1.0005,
        96,
        12,
        0,
        Math.PI * 2,
        north ? 0 : Math.PI - THREE.MathUtils.degToRad(90 - MERCATOR_MAX_LAT),
        THREE.MathUtils.degToRad(90 - MERCATOR_MAX_LAT)
      )
      // les calottes suivent le même terminateur que les tuiles — un pôle
      // blanc qui brille en pleine nuit casserait toute l'illusion
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uSunDir: this.uniforms.uSunDir,
          uShadowColor: this.uniforms.uShadowColor,
          // le MEME plancher de nuit que les tuiles — Tache R7, tour de correction
          uNuitFond: this.uniforms.uNuitFond,
          uNuitCarte: this.uniforms.uNuitCarte,
          uCol: { value: new THREE.Color(north ? '#dfe7ea' : '#f4f1ec') },
          // les MÊMES objets que les tuiles — une seule écriture les couvre
          uEstompageOn: this.uniforms.uEstompageOn,
          uEstompage: this.uniforms.uEstompage,
        },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN;
          uniform vec3 uSunDir;
          uniform vec3 uShadowColor;
          uniform vec3 uNuitFond;
          uniform float uNuitCarte;
          uniform vec3 uCol;
          uniform float uEstompageOn;
          uniform float uEstompage;
          void main() {
            float diff = max(dot(normalize(vN), uSunDir), 0.0);
            vec3 col = uCol * (0.74 + 0.30 * diff);
            float day = smoothstep(-0.22, 0.16, dot(normalize(vN), uSunDir));
            // L'ESTOMPAGE — Tache G. ETEINT il vaut 0, donc l'alpha vaut 1.0 :
            // la calotte d'avant, au bit pres. Sans lui, un bandeau blanc
            // OPAQUE resterait au pole pendant que la Terre autour s'efface.
            float estompeCalotte = uEstompageOn > 0.5 ? uEstompage : 0.0;
            float voileCalotte = 1.0 - estompeCalotte;
            gl_FragColor = vec4(mix(uNuitFond, col, uNuitCarte + (1.0 - uNuitCarte) * day), voileCalotte);
          }`,
      })
      const cap = new THREE.Mesh(geo, mat)
      cap.name = north ? 'cap-n' : 'cap-s'
      this._calottes.push(cap)
      this.group.add(cap)
    }
  }

  // Atmosphère « magnifique » (refs Adrien : photos ISS) — approximation de
  // diffusion en UNE coquille BackSide additive, quatre ingrédients :
  //  1. liseré serré cyan-blanc qui épouse le limbe (la stratosphère)
  //  2. halo bleu large qui s'évanouit dans l'espace
  //  3. anneau CRÉPUSCULAIRE chaud, concentré pile au terminateur — c'est lui
  //     qui « s'illumine quand le soleil est juste à l'horizon »
  //  4. éclat avant : le soleil qui perce derrière le limbe quand la caméra
  //     le regarde à travers l'atmosphère (le sunrise de l'ISS)
  // Côté nuit, il reste un fin liseré bleu profond — jamais noir sec.
  _buildAtmosphere() {
    const geo = new THREE.SphereGeometry(R_GLOBE * 1.04, 128, 96)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uSunDir: this.uniforms.uSunDir,
        // ⚠️ LES MÊMES OBJETS QUE LES TUILES — c'est ELLE, « la grosse boule
        // laiteuse » (Tâche G) : cette coquille est à `R_GLOBE × 1,04`, soit
        // 255 km d'altitude, et la caméra est DEDANS sur toute la bande
        // d'estompage (19 → 40 km). Vue de l'intérieur, une coquille BackSide
        // additive remplit le cadre entier.
        uEstompageOn: this.uniforms.uEstompageOn,
        uEstompage: this.uniforms.uEstompage,
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        uniform vec3 uSunDir;
        uniform float uEstompageOn;
        uniform float uEstompage;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(vV);
          float ndv = abs(dot(N, V));
          float band = pow(1.0 - ndv, 6.0); // liseré stratosphère
          float halo = pow(1.0 - ndv, 2.2); // halo large
          float sunN = dot(N, uSunDir);
          float day = smoothstep(-0.30, 0.25, sunN);
          // ciel : bleu profond la nuit, bleu lumineux au jour
          vec3 sky = mix(vec3(0.05, 0.10, 0.26), vec3(0.34, 0.60, 1.0), day);
          // anneau crépusculaire : or-orangé, gaussienne étroite sur le terminateur
          float dusk = exp(-pow(sunN / 0.16, 2.0));
          vec3 col = mix(sky, vec3(1.0, 0.50, 0.20), dusk * 0.75);
          // éclat du soleil derrière le limbe (sunrise ISS)
          float fwd = pow(max(dot(-V, uSunDir), 0.0), 42.0);
          col += vec3(1.0, 0.88, 0.62) * fwd * halo * 2.6;
          float a = band * (0.50 + 0.75 * day + 0.90 * dusk)
                  + halo * (0.05 + 0.26 * day + 0.34 * dusk);
          // L'ESTOMPAGE — Tache G. ETEINT il vaut 0, donc le facteur vaut 1.0
          // et la ligne est celle d'avant, au bit pres. C'est le SEUL poste du
          // globe qui remplissait le cadre aux altitudes du socle.
          float estompeCiel = uEstompageOn > 0.5 ? uEstompage : 0.0;
          float voileCiel = 1.0 - estompeCiel;
          gl_FragColor = vec4(col * a * voileCiel, 1.0); // additif : l'alpha est dans col
        }`,
    })
    this.group.add(new THREE.Mesh(geo, mat))
  }

  // --------------------------------------------------------------- tiles

  _ensureTile(z, x, y) {
    const key = tileKey(z, x, y)
    let t = this.tiles.get(key)
    if (t) return t
    const nw = tileToLatLon(x, y, z)
    const se = tileToLatLon(x + 1, y + 1, z)
    const center = latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2)
    const corner = latLonToSphere(nw.lat, nw.lon)
    // RAYON ENGLOBANT de la nappe NUE, vérifié numériquement : les QUATRE COINS
    // sont exactement les points extrêmes du carreau (rapport max/coins = 1,000
    // sur z2→z11, 21×21 échantillons par tuile). Une demi-corde diagonale ne
    // l'est pas — elle sous-estime dès que le carreau n'est pas plat.
    const rayon = Math.max(
      center.distanceTo(corner),
      center.distanceTo(latLonToSphere(nw.lat, se.lon)),
      center.distanceTo(latLonToSphere(se.lat, nw.lon)),
      center.distanceTo(latLonToSphere(se.lat, se.lon))
    )
    // ══════ LA BOÎTE ORIENTÉE DE LA TUILE — PF2 ═══════════════════════════
    //
    // ⚠️ **LA SPHÈRE D'UN CARREAU PLAT EST GRASSE, ET ÇA SE MESURE À L'ÉCRAN.**
    // Son rayon est la demi-diagonale — dans TOUTES les directions, donc aussi
    // vers le ciel, où le carreau n'a rien. Une vue de trois quarts RASE les
    // tuiles du pourtour par-dessus : leur sphère coupe le tronc, pas leur
    // surface. Mesuré (profil-pf2, descente, sous 280 km) : **31 des 53 tuiles
    // dessinées avaient leur centre hors de l'écran** (distance NDC moyenne
    // 1,6) — parcourues, gardées porteuses, habillées de photo, pour rien.
    //
    // C'est le `OrientedBoundingBox` de Cesium (`TileBoundingRegion`) : un
    // repère (est, nord, haut) au centre de la tuile, et les extrêmes de la
    // nappe NUE sur ses trois axes, relevés sur 16 points du contour + le
    // centre (les extrêmes d'une calotte convexe sont sur son bord ; les coins
    // donnent le creux `uMin`). Le relief et la jupe s'ajoutent À L'USAGE, sur
    // l'axe haut (`_troncBoite`) : ils dépendent de l'exagération du moment.
    const boite = boiteTuile(nw, se, center)
    t = {
      key,
      z,
      x,
      y,
      boite,
      state: 'empty', // empty → loading → ready | error
      mesh: null,
      texture: null,
      heights: null,
      // taille de tuile EFFECTIVE, connue seulement une fois la source résolue
      size: 0,
      plan: null, // { source, tile } — voir `planTuile`
      lastUsed: 0,
      center,
      chord: corner.distanceTo(latLonToSphere(se.lat, se.lon)),
      rayon,
      // demi-angle au centre de la planète : la MARGE DE CORDE de l'horizon.
      // Sans elle la formule écrête au limbe et ouvre des trous — une tuile
      // dont le CENTRE passe derrière l'horizon a encore la moitié de sa
      // surface devant.
      theta: 2 * Math.asin(Math.min(rayon / (2 * R_GLOBE), 1)),
    }
    // ⚠️ UNE CLÉ EN QUARANTAINE RENAÎT DIRECTEMENT `error`, jamais `empty` : une
    // tuile évincée ne doit pas revenir d'elle-même sur le réseau. (Le tri
    // spatial seul rend les tuiles bloquées évinçables — hors de lui, la
    // question ne se pose pas et le chemin reste celui d'avant, au bit près.)
    // ⚠️ **LA QUARANTAINE SUIT LE RANG 0, ELLE N'EST PAS UN QUATRIÈME
    // MÉCANISME — Tâche R3.** Le commentaire ci-dessus le dit lui-même : « le
    // tri spatial seul rend les tuiles bloquées évinçables — hors de lui, la
    // question ne se pose pas ». En armant le rang 0 sous `cropAttendu`, la
    // question SE POSE : une `error` évincée renaîtrait `empty` et repartirait
    // aussitôt sur le réseau. Étendre la garde ici est le corollaire de
    // l'autre, pas un élargissement de périmètre.
    if (this._contrePression() && this._enQuarantaine(key)) t.state = 'error'
    this.tiles.set(key, t)
    return t
  }

  // la clé a-t-elle épuisé son réessai il y a MOINS de IMAGES_QUARANTAINE images ?
  _enQuarantaine(key) {
    const f = this._echoue.get(key)
    return f !== undefined && this.frame - f < IMAGES_QUARANTAINE
  }

  // ⚠️ `priority` ABSENTE = PRIORITÉ SUIVIE (PF2). Le parcours n'en passe plus :
  // la file la calcule (`_priorite`) et la RECALCULE à chaque image
  // (`_reclasserFile`) avec la caméra du moment. Les racines, le flux du socle
  // et le réessai passent un nombre, qui reste fixe — c'est leur contrat.
  _request(t, priority = null) {
    if (t.state !== 'empty') return
    if (this._contrePression() && this._enQuarantaine(t.key)) return
    // ⚠️ LE PLAFOND DE FILE SE TESTE **AVANT** LA MARQUE `loading`, ET C'EST TOUT
    // LE SUJET (plan « globe continu », Tâche 4 bis, correction 1). `_request`
    // marquait `loading` puis enfilait : un refus posé après la marque aurait
    // laissé la tuile `loading` SANS requête — le fantôme permanent que cette
    // tâche chasse. En testant avant, la tuile RESTE `empty`, l'état d'où
    // `_request` sait repartir. ⚠️ **Et surtout pas un état `idle` inventé** :
    // les états sont `empty | loading | ready | error`, et rien d'autre n'ouvre.
    //
    // ⚠️ ET OUI, `_traverse` LA REDEMANDERA À L'IMAGE SUIVANTE. C'est voulu :
    // c'est de la contre-pression, pas un abandon. La tuile repart dès que la
    // file redescend, sans que personne ait à tenir une liste d'attente
    // parallèle — laquelle serait une seconde file, non bornée celle-là.
    if (this._contrePression() && this.queue.length >= PLAFOND_FILE) {
      this._refusFile++
      return
    }
    // ═══ LA JONCTION : `resolveRegionMaxZoom` EST ASYNCHRONE, `_pump` NE L'EST
    // PAS (plan « globe continu », Tâche 4 alpha, Étape 4) ═══════════════════
    //
    // Trois réponses étaient possibles, et deux sont mauvaises :
    //   · **attendre** la sonde → on gèle la pompe sur un aller-retour réseau,
    //     et `_pump` cesse d'être synchrone pour tout le monde ;
    //   · **supposer AWS** → au premier passage sur chaque zone on charge la
    //     mauvaise source, et il faut ensuite recharger ce qu'on vient de
    //     poser : Mapterhorn est perdu exactement là où il sert.
    //
    // La troisième est celle-ci, et elle ne coûte AUCUN mécanisme neuf : on
    // décide avec la mémoire **synchrone** (`peekRegionMaxZoom`), et quand elle
    // n'a pas encore de réponse on laisse la tuile `empty` en lançant la sonde
    // à côté. `_traverse` la redemandera à l'image suivante — c'est mot pour
    // mot la contre-pression de `PLAFOND_FILE` juste au-dessus, et l'état
    // `empty` est exactement celui d'où `_request` sait repartir.
    //
    // ⚠️ Ce que le visiteur voit pendant ce temps : l'ANCÊTRE, qui continue de
    // dessiner. C'est la règle sans-trou du quadtree, déjà en place — rien de
    // neuf à l'écran, pas une image gelée, pas une tuile de la mauvaise source.
    // Le délai vaut UN aller-retour de six HEAD parallèles, une fois par zone
    // z8 et par session, et la mémoire est partagée avec le damier.
    const plan = planTuile(t.z, t.x, t.y)
    if (!plan) {
      this._sonder(t.z, t.x, t.y)
      this._attentesSonde++
      return
    }
    t.plan = plan
    t.state = 'loading'
    t.demandee = this.frame // l'image de DÉPART : c'est elle qui date un blocage
    const suivie = priority === null
    this.queue.push({ t, priority: suivie ? this._priorite(t) : priority, suivie })
    this._pump()
  }

  // ═══════════ LA PRIORITÉ D'UNE TUILE — PF2, « le centre de l'écran d'abord » ═══
  //
  // Adrien : « Ce qui est visible doit toujours être calculé en premier. Ce qui
  // est au centre de l'écran est la priorité. » La clé est donc la DISTANCE, en
  // écran, du BORD de la tuile au centre de l'écran : le centre projeté de la
  // tuile, moins son rayon projeté — une grande tuile qui couvre le centre vaut
  // zéro, une petite tuile au coin vaut ~1,4. Plus la valeur est haute, plus la
  // tuile part tôt (la file trie en décroissant) ; le niveau ne départage qu'à
  // égalité, le plus grossier d'abord (il couvre plus d'écran par requête).
  //
  // ⚠️ AVANT, LA PRIORITÉ ÉTAIT `chord / dist` DU PARENT, la même pour ses
  // quatre enfants, figée à l'enfilement, et la pompe partait EN PLEIN parcours
  // — les six premières requêtes d'une image étaient celles des premières
  // racines visitées. Mesuré (sonde profil-pf2, descente 2 274 km → 20 km, dev,
  // RTX 3080) : sur les 20 premières tuiles arrivées, 0 % dans le tiers central,
  // distance NDC moyenne 1,415 — le COIN de l'écran. Sur une vue de trois quarts
  // `chord / dist` favorise le premier plan, en bas de l'image, jamais le centre.
  //
  // Hors tri spatial (`continu` faux, les bancs), la clé reste `chord / dist`
  // de la tuile elle-même : aucune matrice de vue n'existe dans ce régime.
  _priorite(t) {
    if (!this.continu) {
      const p = this._camPos
      if (!p) return 0
      return t.chord / Math.max(p.distanceTo(t.center) - t.chord * 0.5, 1)
    }
    const d = this._distanceEcran(t)
    return 1000 - 1000 * (Math.min(d, 4) / 4) + (MAX_Z - t.z) * 0.1
  }

  // ══════════ LA DISTANCE ÉCRAN DU BORD DE LA TUILE AU CENTRE — CIB ══════════
  //
  // La grandeur brute derrière la clé de PF2, en NDC : centre projeté moins
  // rayon projeté, jamais négative. Une grande tuile qui COUVRE le centre vaut
  // 0 ; le coin de l'écran vaut √2 ; `Infinity` derrière la caméra.
  //
  // ⚠️ **ELLE EST EXTRAITE PARCE QUE LA BARRIÈRE SE COMPARE À UN RAYON, PAS À
  // UNE CLÉ.** `_priorite` ajoute `(MAX_Z − z) × 0,1` pour départager à égalité :
  // ce départage vaut jusqu'à 1,3 point, soit 0,0052 NDC — invisible dans un
  // tri, mais il déplacerait le bord de la cible d'une tuile grossière à l'autre
  // si on posait le seuil sur la clé. La cible est une question de GÉOMÉTRIE
  // d'écran ; le niveau n'a rien à y faire.
  _distanceEcran(t) {
    const m = this._matVue.elements
    const c = t.center
    const w = m[3] * c.x + m[7] * c.y + m[11] * c.z + m[15]
    if (!(w > 0)) return Infinity // derrière la caméra : en dernier
    const x = (m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12]) / w
    const y = (m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13]) / w
    const r = (t.rayon * this._echelleProj) / w // rayon projeté, en NDC (axe vertical)
    return Math.max(0, Math.hypot(x, y) - r)
  }

  /** La tuile est-elle DANS la cible — le disque qui couvre la moitié des pixels ? */
  _dansLaCible(t) {
    return this._distanceEcran(t) <= R_CIBLE
  }

  // Une fois par image, après le parcours : la caméra a bougé, la file suit.
  // ⚠️ Seules les entrées SUIVIES bougent — les racines (1e9), le socle (1e9 /
  // 9e8) et le réessai (0) gardent la valeur que leur appelant a posée.
  _reclasserFile() {
    for (const e of this.queue) if (e.suivie) e.priority = this._priorite(e.t)
  }

  // Lance la sonde de couverture d'une zone, sans attendre et sans la relancer.
  // ⚠️ LE GARDE-FOU N'EST PAS DÉCORATIF : `_traverse` repasse sur les mêmes
  // tuiles à chaque image. `resolveRegionMaxZoom` dédoublonne déjà le RÉSEAU
  // (`inFlight`, par clé de zone), mais pas la chaîne de promesses : sans ce
  // Set, une zone non sondée en allouerait une par tuile et par image.
  _sonder(z, x, y) {
    const source = activeDemSource()
    const cle = regionKey(source.id, z, x, y)
    if (this._sondes.has(cle)) return
    this._sondes.add(cle)
    resolveRegionMaxZoom(source, z, x, y)
      .catch((err) => {
        // ⚠️ CE CHEMIN N'EST PAS LE 404. `probeMaxZoom` ne lève que sur une
        // vraie PANNE (5xx, réseau, DNS) ; les 404 partout rendent `null`, qui
        // est une réponse et se mémorise. Une panne, elle, replie la session.
        fallbackToAws(err)
      })
      .finally(() => this._sondes.delete(cle))
  }

  // ═══════════ L'ANNULATION (Tâche 4 bis, correction 2) ═══════════════════
  //
  // Sort une tuile de la file et la rend à `empty`. Rend `true` si elle y était.
  //
  // ⚠️ **ON N'ANNULE QUE CE QUI N'EST PAS PARTI, ET C'EST UN CHOIX MESURÉ, PAS
  // UNE FACILITÉ.** Une entrée présente dans `this.queue` n'a pas encore été
  // tirée par `_pump` : aucune promesse n'existe, donc aucun `.catch` ne peut se
  // déclencher. C'est exactement ce qu'il faut, parce que le `.catch` de `_pump`
  // RÉESSAIE une fois (`t.retried`) : annuler une requête en vol relancerait
  // donc la tuile qu'on voulait abandonner. Le piège est mesuré, il est nommé
  // ici, et la seule façon de ne pas y tomber est de ne pas toucher au vol.
  //
  // ⚠️ **ET L'`AbortController` EST REFUSÉ POUR UNE SECONDE RAISON, ÉCRITE DANS
  // CE FICHIER** : `fetchTile` porte « pas de `signal` : la promesse est partagée
  // entre tous les demandeurs de la même URL, l'abandon de l'un annulerait la
  // tuile des autres ». `_tileMemo` dédoublonne par URL ; un `signal` y ferait
  // tomber la tuile d'un globe parce qu'un autre a tourné la tête.
  //
  // ⚠️ **ET LE GAIN EST DANS LA FILE, PAS DANS LE VOL** : le vol est plafonné à
  // six (`MAX_CONCURRENT`), la file montait à 558 (voir `PLAFOND_FILE`). Annuler
  // six requêtes ne rachète rien ; vider la file rachète tout.
  _annuler(t) {
    const i = this.queue.findIndex((e) => e.t === t)
    if (i < 0) return false
    this.queue.splice(i, 1)
    if (t.state === 'loading') t.state = 'empty'
    return true
  }

  // ═══════════ LA PURGE DES ENTRÉES PÉRIMÉES (Tâche 4 bis) ════════════════════
  //
  // Une fois par image, après le parcours : ce que la file contient encore et
  // que l'image courante n'a PAS demandé ne sera jamais utile — la caméra a
  // tourné. Sans cette purge, le plafond seul ne suffirait pas : la file
  // resterait pleine de la vue d'avant et refuserait la vue d'après (mesuré :
  // 546 tuiles encore `loading` cinq secondes après l'arrêt du panoramique, zoom
  // effectif retombé de z15 à z3).
  //
  // ⚠️ **LES RACINES z2 NE SE PURGENT JAMAIS.** `_traverse` ne demande que des
  // ENFANTS : une racine rendue à `empty` ne repartirait sur le réseau pour
  // personne, et toute la descente resterait bloquée derrière elle — sans
  // erreur, sans test rouge, sans rien à l'écran. C'est le rappel explicite que
  // la Tâche 4 sexies a posé sur `_rechargeTuiles`, et il vaut ici mot pour mot.
  _purgerFile() {
    if (!this._contrePression() || !this.queue.length) return 0
    const garde = []
    let n = 0
    for (const e of this.queue) {
      const t = e.t
      if (t.z <= ROOT_Z) {
        garde.push(e)
        continue
      }
      // orpheline : la tuile a été évincée pendant que son entrée attendait.
      // On la retire SANS toucher à son état — l'objet n'est plus la tuile de
      // cette clé, et la garde du maillage orphelin de `_pump` s'en charge.
      if (this.tiles.get(t.key) !== t) {
        n++
        continue
      }
      // ⚠️ RÉSERVÉE PAR LE FLUX : voir `gardeHauteurs` au constructeur. Le socle
      // n'est demandé par aucun parcours, donc son `lastUsed` ne bouge pas.
      if (t.lastUsed === this.frame || this.gardeHauteurs.has(t.key)) {
        garde.push(e)
        continue
      }
      if (t.state === 'loading') t.state = 'empty'
      n++
    }
    this.queue = garde
    this._purgees = n
    return n
  }

  // ═══════════ COMBIEN DE TUILES SONT ENCORE EN VOL ? — Tâche R26 ═══════════
  //
  // ⛔ **CETTE MÉTHODE EXISTE PARCE QUE DEUX BANCS AVAIENT ÉCRIT LA MAUVAISE
  // FORMULE, CHACUN DE SON CÔTÉ.** `scripts/sonde-lumiere-r21.mjs` et
  // `scripts/sonde-transitoire-r21bis.mjs` attendaient tous deux
  // `state === 'loading' || state === 'empty'` pour compter zéro. Cette porte
  // **n'a jamais pu se fermer** : elle expirait à ses 45 s à CHAQUE chargement,
  // sur 24 chargements de R21 et 6 de R26 — c'était un `sleep(45 s)` déguisé.
  //
  // ⚡ **ET LE MOTEUR EST SAIN — MESURÉ, R26.** Les 4 à 9 tuiles résiduelles ne
  // sont pas des requêtes qui ne reviennent jamais : ce sont des entrées de
  // cache rendues à `empty` par `demanderEmprise` (`monde/flux-terrain.js`,
  // étape 2, `g._annuler`) quand l'emprise du socle bouge, **et que plus
  // personne ne parcourt** — `_horsCropSeul` les écarte à la première ligne de
  // `_traverse`. Elles ne sont donc **demandées par personne**, ce qui est le
  // seul état d'où `_request` sait repartir si la caméra y revient. Elles sont
  // évinçables au rang 0 (`_bloquee` : `empty` + `lastUsed !== frame`), donc
  // elles ne retiennent aucune place du budget pour de bon.
  //
  // ⚠️ **LE DISCRIMINANT EST `lastUsed`, ET IL EST NÉCESSAIRE.** Une `empty`
  // touchée par le parcours de l'image courante EST en vol au sens utile : elle
  // attend une sonde de couverture (`planTuile` sans réponse), un créneau de
  // file, ou la fin d'une quarantaine, et `_traverse` la redemandera à l'image
  // suivante — l'image va donc encore changer. Une `empty` PÉRIMÉE, elle,
  // n'attend rien ni personne. Compter les deux, c'est attendre pour toujours ;
  // n'en compter aucune, c'est mesurer une scène qui bouge encore.
  //
  // ⚠️ `queue.length` et `inFlight` sont comptés EN PLUS des `loading`, et ce
  // n'est pas un double comptage gênant : la seule lecture utile est « est-ce
  // zéro ». Ils gardent la porte fermée si une entrée de file survivait à sa
  // tuile (l'orpheline de `_purgerFile`), cas où aucun `state` ne le dirait.
  //
  // @returns {number} 0 quand la planète a fini de se charger.
  tuilesEnVol() {
    let n = this.queue.length + this.inFlight
    for (const t of this.tiles.values()) {
      if (t.state === 'loading') n++
      else if (t.state === 'empty' && t.lastUsed === this.frame) n++
    }
    return n
  }

  // ══════════ REDEMANDER SANS EFFACER — R37 ═══════════════════════════════════
  //
  // **C'est LE défaut qu'Adrien filme.** Le flux du socle (`demanderEmprise`,
  // étape 3) réclame les hauteurs des tuiles de son emprise ; celles qui sont
  // prêtes mais dont `_buildMesh` a relâché les hauteurs étaient jetées
  // (maillage, texture, `state = 'empty'`) puis redemandées. Or ces tuiles sont
  // EXACTEMENT celles du centre de l'écran, à l'altitude du bloc : pendant leur
  // vol, la règle sans-trou remontait au parent (z9 sur toute l'image, mesuré
  // au banc R37 : 100 % de l'écran en recul d'un à trois niveaux, 0,5 à 4 s par
  // niveau), et le cache souple évinçait leurs descendants devenus non porteurs
  // — à retélécharger ensuite. La zone nette redevenait floue sans que
  // l'utilisateur ait bougé.
  //
  // Ici la tuile reste `ready`, son maillage reste dessiné, et une entrée de
  // file part chercher la donnée ; à l'arrivée seulement, `_pump` remplace le
  // maillage (`_jeterMaillage` puis `_buildMesh`). Rien ne change à l'écran
  // entre les deux — pas un pixel.
  //
  // ⚠️ L'entrée n'est pas « suivie » (priorité fixe, celle du flux) et la
  // tuile est dans `gardeHauteurs`, donc `_purgerFile` la garde. Si la tuile
  // n'est pas prête (ou sans maillage), c'est l'ancien chemin : `empty` puis
  // `_request` — rien à préserver.
  //
  // @returns {boolean} vrai si un rechargement est parti (ou déjà en vol)
  redemanderSurPlace(t, priority = 1e9) {
    if (t.state !== 'ready' || !t.mesh) return false
    if (t.enVolSurPlace) return true
    if (!t.plan) t.plan = planTuile(t.z, t.x, t.y)
    if (!t.plan) return false
    t.enVolSurPlace = true
    t.retried = false
    this.queue.push({ t, priority, suivie: false, surPlace: true })
    this._pump()
    return true
  }

  _jeterMaillage(t) {
    if (t.mesh) {
      this.group.remove(t.mesh)
      t.mesh.geometry.dispose()
      libererMateriauTuile(this, t.mesh)
      t.mesh = null
    }
    t.texture?.dispose()
    t.texture = null
    t._partiel = 0
    this._partiels.delete(t)
  }

  // ══════════ LA BARRIÈRE, DÉCIDÉE EN FIN D'IMAGE — CIB / D22 ③ ══════════════
  //
  // ⚠️ **ELLE SE DÉCIDE POUR L'IMAGE SUIVANTE, ET C'EST NÉCESSAIRE.** `_traverse`
  // visite les seize racines dans l'ordre du tableau, pas dans celui de l'écran :
  // un compteur consommé PENDANT le parcours qui l'alimente dépendrait de l'ordre
  // de visite — la périphérie visitée avant le centre passerait, celle visitée
  // après serait retenue, et la mesure changerait d'une racine à l'autre sans
  // que rien ne le dise. Une image de retard à 60 Hz vaut 16 ms ; l'ordre de
  // visite, lui, ne se rattrape pas.
  //
  // Trois conditions, et les deux dernières sont des garde-fous MESURÉS :
  //
  //  1. **le centre n'a pas fini** — au moins un enfant de la cible que l'image
  //     veut et n'a pas (`_centreEnAttente`) ;
  //  2. ⚠️ **les six créneaux sont pourvus** (`inFlight + queue ≥ MAX_CONCURRENT`).
  //     C'est LE risque nommé par le brief : « une barrière mal posée laisse des
  //     créneaux vides pendant que le centre finit ». Quand le centre attend sur
  //     autre chose qu'un créneau — une sonde de couverture (`planTuile` sans
  //     réponse), une quarantaine — le vol peut tomber à zéro avec la file vide ;
  //     retenir la périphérie coûterait alors du débit sans rien accélérer. La
  //     barrière ne tient donc QUE tant qu'il y a de quoi remplir les créneaux ;
  //  3. **l'échéance anti-famine** n'est pas dépassée (voir `BARRIERE_ECHEANCE_MS`) :
  //     le compteur repart à zéro dès que le centre AVANCE, donc il ne monte que
  //     sur un centre réellement bloqué. Passé le délai, la barrière tombe pour
  //     cette image — la périphérie se raffine — et se réarme dès le prochain
  //     progrès du centre.
  _deciderBarriere(dt) {
    const attente = this._centreEnAttente
    if (attente < this._centreEnAttentePrec) this._barriereSansProgres = 0 // le centre AVANCE
    else if (attente > 0) this._barriereSansProgres += Math.max(0, dt) * 1000
    else this._barriereSansProgres = 0
    this._centreEnAttentePrec = attente
    const affamee = this._barriereSansProgres >= BARRIERE_ECHEANCE_MS
    const creneauxPourvus = this.inFlight + this.queue.length >= MAX_CONCURRENT
    // ⚠️ **ET PAS QUAND C'EST LE CRÉDIT QUI BLOQUE LE CENTRE — MESURÉ, PAS
    // SUPPOSÉ.** `test/globe-eviction` ⑤ (cache saturé, caméra STRICTEMENT
    // immobile) est passé au rouge à la première version : 12 requêtes et les
    // tuiles dessinées oscillant entre 328 et 337 sur 20 images. La cause est un
    // CYCLE LIMITE, pas un réglage : à cache plein, `_credit < 4` refuse le
    // raffinement du centre, donc `_centreEnAttente` ne retombe JAMAIS à zéro,
    // donc la barrière tient pour toujours ; la périphérie retenue perd son
    // `lastUsed`, s'évince, se redemande à l'image d'après. La barrière est un
    // ordonnanceur de RÉSEAU ; quand le goulot est le cache, elle n'a rien à y
    // faire — c'est le §5 de `/threejs-optimisation` mot pour mot (« un budget à
    // zéro est le MARQUEUR du plafond, pas sa cause »).
    const active = this.continu && attente > 0 && creneauxPourvus && !affamee && !this._refusPrec
    if (affamee && this._barriereActive) this._barriereEcheances++
    // ⚠️ POURQUOI LA BARRIÈRE NE TIENT PAS — les trois refus, comptés séparément.
    // Sans eux, « 0 raffinement retenu » ne se distingue pas de « rien à retenir »,
    // et le premier tirage de la sonde rendait exactement ce chiffre-là.
    if (this.continu && attente > 0) {
      if (!creneauxPourvus) this._barriereHorsCreneaux++
      else if (affamee) this._barriereHorsFamine++
      else if (this._refusPrec) this._barriereHorsCredit++
    }
    this._barriereActive = active
    if (active) this._barriereImages++
  }

  _pump() {
    // ⚠️ PAS PENDANT LE PARCOURS (PF2). `_request` appelait la pompe à chaque
    // enfilement, donc les `MAX_CONCURRENT` créneaux d'une image partaient aux
    // PREMIÈRES tuiles visitées — l'ordre des racines, pas celui de l'écran.
    // `update()` la rappelle une fois la file complète et reclassée : les six
    // créneaux vont alors aux six meilleures priorités de l'image. C'est le
    // `RequestScheduler.update()` de Cesium, appelé en fin d'image.
    if (this._enParcours) return
    if (!this.queue.length || this.inFlight >= MAX_CONCURRENT) return
    this.queue.sort((a, b) => b.priority - a.priority)
    while (this.inFlight < MAX_CONCURRENT && this.queue.length) {
      const { t, surPlace } = this.queue.shift()
      this.inFlight++
      fetchTile(t.z, t.x, t.y, t.plan)
        .then(({ texture, heights, size }) => {
          // ⚠️ LA GARDE DU MAILLAGE ORPHELIN. Rendre les tuiles bloquées
          // évinçables veut dire qu'une `loading` peut disparaître de la Map
          // pendant que sa requête est encore en vol. Sans cette ligne, le
          // retour construirait un maillage, l'ajouterait au groupe, et plus
          // rien ne le retrouverait jamais : ni `_evict`, ni `dispose`.
          // On compare l'OBJET, pas la clé : la tuile peut avoir été recréée.
          if (this.tiles.get(t.key) !== t) {
            texture.dispose()
            return
          }
          // R37 : le rechargement SUR PLACE remplace un maillage encore dessiné
          // — l'ancien ne part qu'à l'instant où le neuf peut prendre sa place
          // ⚠️ ET LE NEUF HÉRITE DE LA VISIBILITÉ DE L'ANCIEN : la promesse se
          // résout entre `update()` et le rendu de la même image (mémoire de
          // tuiles → microtâche) ; un maillage neuf né invisible ferait un
          // trou d'une image exactement là où l'ancien dessinait.
          const visible = surPlace && !!(t.mesh && t.mesh.visible)
          if (surPlace) {
            t.enVolSurPlace = false
            this._jeterMaillage(t)
          }
          t.texture = texture
          t.heights = heights
          t.size = size
          t.state = 'ready'
          this._buildMesh(t)
          if (visible && t.mesh) t.mesh.visible = true
        })
        .catch((err) => {
          const vivante = this.tiles.get(t.key) === t
          // R37 : un rechargement sur place qui échoue laisse la tuile telle
          // qu'elle est — prête, dessinée, sans hauteurs ; le flux la
          // redemandera à la prochaine emprise, et rien ne s'efface à l'écran
          if (surPlace) {
            t.enVolSurPlace = false
            if (vivante) console.warn('globe tile (sur place) failed:', err.message)
            return
          }
          // one retry, then give up — the parent keeps covering this area
          if (!t.retried && vivante) {
            t.retried = true
            t.state = 'empty'
            t.plan = null // la source se REDEMANDE : la session a pu se replier
            this._request(t, 0)
            return
          }
          // ⚠️ LE REPLI DE SESSION SE DÉCIDE ICI, ET SEULEMENT APRÈS LE RÉESSAI.
          // Le globe tire des centaines de requêtes par image : replier toute
          // la session au premier hoquet réseau dégraderait AUSSI le damier,
          // qui partage `dem-source.js`. Une tuile qui échoue DEUX FOIS sur une
          // panne de source (pas un 404 — celui-là est déjà rattrapé par
          // `fetchTile`) est un signal, pas un bruit.
          if (err instanceof DemSourceError) fallbackToAws(err)
          t.state = 'error'
          this._echoue.set(t.key, this.frame) // quarantaine, datée
          if (vivante) console.warn('globe tile failed:', err.message)
        })
        .finally(() => {
          this.inFlight--
          this._pump()
        })
    }
  }

  // REPÈRE RELATIF AU CENTRE DE LA TUILE (relative-to-center).
  //
  // ⚠️ `pos2` — le seul tampon que le GPU lira — reçoit l'écart AU CENTRE DE LA
  // TUILE, jamais la position mondiale. Celle-ci part vivre dans
  // `mesh.position`, donc dans la matrice de l'objet, que three compose sur le
  // CPU en doubles avant de n'en envoyer que la modelView (dont la translation
  // est déjà relative à la caméra).
  //
  // Le chiffre : R_GLOBE = 100 posait les sommets à une magnitude où le pas
  // représentable du float32 vaut **0,486 m au sol**, et il ne descend JAMAIS,
  // quel que soit le zoom. Or mapterhorn sert du 0,42 m/pixel à son maximum :
  // la représentation s'épuisait exactement là où la donnée s'arrête (deck.gl
  // #7527 décrit la même casse à z17). En relatif, la magnitude tombe à la
  // taille d'une TUILE — 0,3 unité à z11 — et le pas à ~1 mm.
  //
  // ⚠️ Écrire un double dans un Float32Array l'arrondit sur-le-champ : il faut
  // donc soustraire l'origine AVANT l'écriture. D'où `positions` en DOUBLES,
  // et pas de `pos2.set(positions)` — un tampon absolu recopié n'aurait rien
  // gagné. C'est aussi pour ça que `positions` reste ABSOLU : la jupe s'y
  // appuie pour descendre vers le centre de la PLANÈTE, pas de la tuile.
  _buildMesh(t) {
    const G = segmentsTuile(t.z)
    const nV = (G + 1) * (G + 1)
    const positions = new Float64Array(nV * 3) // absolues, en doubles : voir ci-dessus
    const normals = new Float32Array(nV * 3)
    const uvs = new Float32Array(nV * 2)
    const latlons = new Float32Array(nV * 2)
    const dispScale = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
    const v3 = new THREE.Vector3()

    // every vertex is projected EXACTLY onto the sphere (+ displaced along the
    // radius) — never interpolated across a flat quad
    // ⚠️ **LE FOND DU CROP — Tâche J bis.** Sans fond posé (`this._fondCrop`
    // nul), `altitudeMaillage` EST `Math.max(h, 0)` : « oceans stay on the
    // sphere », le dépôt AU BIT PRÈS, et c'est le cas de toute la planète hors
    // crop comme de `?globe=continu` tout entier. Avec un fond, la MER prend la
    // profondeur du CHAMP — celui-là même que la mer lit —, et le désaccord de
    // **920,7 m en moyenne** se ferme (il retombe à 2,85 m, mesuré).
    // ⚠️ `?.`/`??` DEVANT `_fondCrop` : `test/globe-precision.test.js` emprunte
    // cette méthode avec un `this` qui n'est pas un globe — même raison que le
    // `?.` de `gardeHauteurs`, en bas de cette fonction.
    const fond = this._fondCrop ?? null
    const posAt = (u, v, out) => {
      const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
      const h = altitudeMaillage(
        sampleHeights(t.heights, u, v, t.size),
        fond ? echantillonnerFond(fond, lat, lon) : null,
      )
      return latLonToSphere(lat, lon, R_GLOBE + h * dispScale, out)
    }

    // L'ORIGINE DU REPÈRE : le centre de la tuile, pris SUR LA SURFACE DÉPLACÉE
    // et non sur la sphère nue. `t.center` ferait presque l'affaire, mais il
    // ignore le relief : à l'exagération 18 des vues orbitales, un sommet à
    // 8 848 m est à 2,5 unités du centre non déplacé, ce qui remonterait le pas
    // à 1,5 cm. Passer par `posAt` coûte une ligne et supprime le terme.
    const origine = posAt(0.5, 0.5, new THREE.Vector3())

    let k = 0
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const u = i / G
        const v = j / G
        const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
        posAt(u, v, v3)
        positions[k * 3] = v3.x
        positions[k * 3 + 1] = v3.y
        positions[k * 3 + 2] = v3.z
        uvs[k * 2] = u
        uvs[k * 2 + 1] = 1 - v // canvas row 0 = north = uv v 1 (flipY texture)
        latlons[k * 2] = lat
        latlons[k * 2 + 1] = lon
        k++
      }
    }

    // analytic normals via central differences on the displaced surface.
    // computeVertexNormals would average the skirt walls into the border
    // vertices, tilting them and drawing a dark shading seam around every
    // tile — the "grid of outlines" glitch in the aerial view.
    {
      const eps = 1 / G
      const pE = new THREE.Vector3()
      const pW = new THREE.Vector3()
      const pN = new THREE.Vector3()
      const pS = new THREE.Vector3()
      // ⚠️ LA FENÊTRE DOIT ÊTRE LA MÊME POUR LA POSITION ET POUR LA HAUTEUR
      // (plan « globe continu », Tâche 4 sexies, Étape 3). `posAt` mélangeait
      // deux conventions au BORD de la tuile : `tileToLatLon(t.x + u, …)` suit
      // `u` hors de [0,1] et rend la position du voisin, tandis que
      // `sampleHeights` l'ÉCRÊTE (`clamp(u × size − 0,5 ; 0 ; size − 1)`) et rend
      // la hauteur du pixel de bord. La différence centrée portait donc un
      // dénivelé lu sur une fenêtre deux fois trop courte.
      //
      // ⚠️ ET LE CHIFFRE SE DÉRIVE DU DÉPÔT, il n'a pas eu besoin d'un banc :
      // `G = segmentsTuile(z) = 24`, tuile de 256 px, donc la fenêtre vaut
      // `x(u+ε) − x(u−ε)` = **21,333 px au centre contre 10,167 px au bord**,
      // soit **47,7 %** — 407 m de pente lus sur 853 m de pente vraie. D'où un
      // liseré d'éclairage : chaque tuile s'aplatit sur son pourtour.
      //
      // Le correctif garde la fenêtre DANS la tuile pour les deux grandeurs :
      // au centre, la différence reste centrée et rien ne change ; au bord, elle
      // devient unilatérale, mais position et hauteur parcourent enfin le même
      // terrain. ⚠️ **On n'extrapole pas au-delà du bord** : la donnée du voisin
      // n'est pas là, et l'inventer ferait un relief qui n'existe nulle part.
      const dansLaTuile = (x) => Math.min(Math.max(x, 0), 1)
      let m = 0
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const u = i / G
          const v = j / G
          posAt(dansLaTuile(u + eps), v, pE)
          posAt(dansLaTuile(u - eps), v, pW)
          posAt(u, dansLaTuile(v - eps), pN)
          posAt(u, dansLaTuile(v + eps), pS)
          // dv points south, du points east: south x east faces outward
          pS.sub(pN)
          pE.sub(pW)
          v3.crossVectors(pS, pE).normalize()
          normals[m * 3] = v3.x
          normals[m * 3 + 1] = v3.y
          normals[m * 3 + 2] = v3.z
          m++
        }
      }
    }

    const indices = []
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const a = j * (G + 1) + i
        const b = a + 1
        const c = a + (G + 1)
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    // skirt: duplicate the border ring pulled toward the planet center, hiding
    // hairline cracks between neighbouring LOD levels
    const border = []
    for (let i = 0; i <= G; i++) border.push(i) // north row
    for (let j = 1; j <= G; j++) border.push(j * (G + 1) + G) // east col
    for (let i = G - 1; i >= 0; i--) border.push(G * (G + 1) + i) // south row
    for (let j = G - 1; j >= 1; j--) border.push(j * (G + 1)) // west col

    // deep enough to swallow cross-LOD height mismatches (a few hundred
    // exaggerated meters at most), but capped — the old chord-proportional
    // drop dug multi-unit trenches on z2/z3 tiles that read as dark bands at
    // the limb
    const skirtDrop = Math.min(Math.max(t.chord * 0.012, 0.1), 0.9)
    const total = nV + border.length
    const pos2 = new Float32Array(total * 3)
    const nrm2 = new Float32Array(total * 3)
    const uv2 = new Float32Array(total * 2)
    const ll2 = new Float32Array(total * 2)
    // la nappe : absolu (doubles) − origine → float32
    for (let s = 0; s < nV; s++) {
      pos2[s * 3] = positions[s * 3] - origine.x
      pos2[s * 3 + 1] = positions[s * 3 + 1] - origine.y
      pos2[s * 3 + 2] = positions[s * 3 + 2] - origine.z
    }
    nrm2.set(normals)
    uv2.set(uvs)
    ll2.set(latlons)
    border.forEach((src, bi) => {
      const dst = nV + bi
      const inv = 1 - skirtDrop / Math.hypot(positions[src * 3], positions[src * 3 + 1], positions[src * 3 + 2])
      // ⚠️ `* inv` sur l'ABSOLU (le rabattement est radial depuis le centre de
      // la planète), puis seulement ensuite le passage au repère de la tuile
      pos2[dst * 3] = positions[src * 3] * inv - origine.x
      pos2[dst * 3 + 1] = positions[src * 3 + 1] * inv - origine.y
      pos2[dst * 3 + 2] = positions[src * 3 + 2] * inv - origine.z
      // skirts inherit the rim normal so the wall shades exactly like the edge
      nrm2[dst * 3] = normals[src * 3]
      nrm2[dst * 3 + 1] = normals[src * 3 + 1]
      nrm2[dst * 3 + 2] = normals[src * 3 + 2]
      uv2[dst * 2] = uvs[src * 2]
      uv2[dst * 2 + 1] = uvs[src * 2 + 1]
      ll2[dst * 2] = latlons[src * 2]
      ll2[dst * 2 + 1] = latlons[src * 2 + 1]
    })
    for (let bi = 0; bi < border.length; bi++) {
      const a = border[bi]
      const b = border[(bi + 1) % border.length]
      const a2 = nV + bi
      const b2 = nV + ((bi + 1) % border.length)
      indices.push(a, a2, b, b, a2, b2)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos2, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm2, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv2, 2))
    geo.setAttribute('latlon', new THREE.BufferAttribute(ll2, 2))
    geo.setIndex(indices)
    geo.computeBoundingSphere()
    // ⚠️ **DE QUOI RETAILLER LA JUPE PLUS TARD — Tâche P7, ET L'ORDRE L'EXIGE.**
    // Le fond du bloc n'existe qu'une fois les parois posées, et les parois
    // exigent des tuiles bâties : quand `_buildMesh` tourne pour le premier
    // bloc, `_baseYCrop` est encore nul. Borner ICI ne toucherait donc que les
    // tuiles arrivées APRÈS, et le bloc d'ouverture garderait ses langues. On
    // garde de quoi RECALCULER la jupe depuis son anneau de bord — jamais depuis
    // sa position courante, pour que `_retaillerJupe` soit idempotente.
    geo.userData.jupe = { nV, bord: border, rabattement: skirtDrop }

    // ⚠️ **`2 ** -t.z` ET PAS `1 / (1 << t.z)`** : `t.z` monte à 22 dans les vues
    // de surface, et un décalage d'entier 32 bits y serait encore juste — mais
    // il déborderait à 31, sans un mot. La puissance flottante n'a pas de bord.
    const mesh = new THREE.Mesh(geo, this._materialFor(t.texture, t.size, 2 ** -t.z))
    // PF4 : ce qui est propre à la tuile vit sur le maillage, posé avant SON dessin
    // (monde/materiau-tuile.js) — sans effet quand chaque tuile a son matériau
    this._fabriqueMateriau?.equiper(mesh, t.texture, t.size, 2 ** -t.z)
    mesh.position.copy(origine) // la position mondiale vit ICI, plus dans les sommets
    // PF4 : une tuile ne bouge jamais — sa matrice est composée ICI, une fois
    if (!this._matricesAuto) { mesh.updateMatrix(); mesh.matrixAutoUpdate = false }
    mesh.visible = false
    mesh.name = t.key
    t.mesh = mesh
    this.group.add(mesh)
    // le bloc est peut-être DÉJÀ là (déplacement de fenêtre, tuile de remplacement)
    this._retaillerJupe(t)

    // ⚠️ LES HAUTEURS SONT RELÂCHÉES ICI, ET C'EST LEUR DERNIER LECTEUR (plan
    // « globe continu », Tâche 4 sexies, Étape 1). `t.heights` est un
    // `Float32Array(256 × 256)` = 256 Kio par tuile, soit **105 Mo à 420 tuiles
    // en cache**. Le maillage vient de le consommer en entier ; le seul autre
    // lecteur du dépôt était `setExaggeration`, qui n'avait AUCUN appelant
    // (vérifié sur tout `src/` et `test/`).
    //
    // ⚠️ CE N'EST PAS UN CACHE QU'ON JETTE : c'est un tampon de construction
    // qu'on cessait de rendre. `setExaggeration` reste utilisable — il passe
    // désormais par `_rechargeTuiles()`, qui redemande la donnée au lieu de la
    // retenir 105 Mo durant au cas où.
    //
    // ⚠️ **SAUF POUR L'EMPRISE QUE LE FLUX A NOMMÉE** (Tâche 4 bis). La Phase 2
    // rééchantillonne le socle DEPUIS ce cache : `remplirHauteurs` a besoin des
    // hauteurs, et elles n'existaient plus nulle part — c'est la contradiction
    // entre les Tâches 4 sexies et 4 bis, et elle se tranche par la PORTÉE, pas
    // par le retour en arrière. `gardeHauteurs` ne contient que les tuiles de
    // l'emprise du socle : seize au pire, 4 Mo, contre 435 Mo si on gardait tout.
    //
    // ⚠️ `?.` ET NON `.` : `test/globe-precision.test.js` EMPRUNTE cette
    // méthode (`Globe.prototype._buildMesh.call(faux, …)`) avec un `this` qui
    // n'est pas un globe — il n'a ni `gardeHauteurs` ni cache. Un point nu y
    // lève `Cannot read properties of undefined`, et ce test vérifie la
    // précision des sommets à l'échelle planétaire : il ne doit pas payer pour
    // une réservation de hauteurs.
    if (!this.gardeHauteurs?.has(t.key)) t.heights = null
  }

  // --------------------------------------------------------------- per-frame

  // Traverse the quadtree: a tile subdivides only when all four children are
  // ready, so coverage is always complete. Returns the number of drawn tiles.
  // dt (seconds, optional — callers passing only the camera keep working)
  // drives the orbiting cloud cover.
  update(camera, dt = 0.016) {
    // ══════ LA FRONTIÈRE DE RENDU — Tâche 1b bis, LE GARDE QUI MANQUAIT ════
    //
    // ⚠️ **`setVisible` ÉCRIT `enabled = v` ET DIT, EN COMMENTAIRE, QU'IL « dit le
    // MODE, pas le dessin ». C'ÉTAIT FAUX ICI, ET ÇA SE VOYAIT À L'ÉCRAN.** En
    // mode surface `main.js` appelle `globe.update(camGlobe, dtAmb)` — il l'a
    // écrit exprès, avec un commentaire qui prévient que « sans cet appel il reste
    // à ses seize racines et le raccord montre une planète floue ». Or
    // `_dive` avait posé `enabled = false`, donc l'appel sortait ICI, ligne un :
    // **il ne faisait rien du tout.**
    //
    // Mesuré au navigateur le 2026-08-21 (`?globe=crans&frontiere=1`, La Réunion
    // dézoomée à z5, altitude de cadrage 847 km) : **le cache du quadtree tenait
    // 16 tuiles — ses seules racines** ; `update()` rendait **0** ; l'écran
    // montrait une **boule blanche sans continent**. Le seul fait de lever
    // `enabled` faisait passer le cache à **52 tuiles en une image**, et la Terre
    // retrouvait Madagascar, l'Afrique et ses nuages, au même cadrage.
    //
    // ⚠️ **`frontiereFond` N'EST VRAI QUE SOUS LE DRAPEAU** (`main.js` le pose,
    // `globe.js` n'importe pas `flags.js`) : sans drapeau, ce garde est
    // exactement celui d'avant, au caractère près.
    if (!this.enabled && !this.frontiereFond) return 0
    this.clouds.update(camera, dt)
    // LA LOI DU BLOC HORS CROP — Tâche R11. ⚠️ **ICI ET PAS DANS LES QUATRE
    // SITES QUI RECUISENT LE LUT** : `terrain.rebuildRamp` est appelé depuis la
    // palette, depuis `rampDry` / `rampWet` et depuis `setColorMode`, et chacun
    // libère la texture précédente. Quatre branchements à tenir d'accord, c'est
    // la classe d'erreur que ce fichier a déjà payée trois fois ; une relecture
    // du porteur par image n'en fait qu'un, et elle sort en deux comparaisons
    // quand rien n'a changé.
    this._majRampeMonde()
    this.frame++
    const camPos = camera.position
    const camDir = camPos.clone().normalize()
    this._camPos = camPos // lu par `_priorite` (régime sans tri spatial)
    this._drawn = 0
    this._visites = 0
    this._porteuses = 0
    this._refusPrec = this._refus // CIB : lu par `_deciderBarriere`, avant la remise à zéro
    this._refus = 0
    this._refusFile = 0
    this._purgees = 0
    this._attentesSonde = 0
    if (this.continu) this._preparerTriSpatial(camera, camPos)

    // CRÉDIT DE CRÉATION de la frame. Un raffinement fait naître quatre tuiles ;
    // n'en lancer que ce qu'on pourra garder, sinon elles s'évincent l'une
    // l'autre avant d'être au complet et la frame suivante recommence (mesuré
    // caméra immobile, cache saturé : ~100 requêtes par frame, sans fin).
    // Le crédit compte la place LIBRE **plus la place RÉCUPÉRABLE** — et ce
    // second terme est indispensable : l'éviction ramenant le cache à
    // exactement CACHE_MAX, un crédit fondé sur la seule place libre resterait
    // nul à jamais et GÈLERAIT le globe (faire tourner la planète ne
    // chargerait plus rien). Est récupérable ce que le rang 1 de l'éviction
    // sait rendre : une tuile prête qui n'a porté ni dessiné à la frame d'avant.
    const prev = this.frame - 1
    let marge = 0
    // R37 : un parent dessiné partiellement à l'image d'avant reprend son
    // matériau entier ; `_traverse` remettra le masque s'il le faut encore
    for (const t of this._partiels) this._restaurerEntier(t)
    this._partiels.clear()
    this._nPartiels = 0
    this._prelues = 0
    this._barriereRefus = 0
    // ⚠️ **LA BARRIÈRE SE DÉCIDE ICI, AVANT LE PARCOURS, SUR L'ÉTAT DU VOL À CET
    // INSTANT** — et pas en fin d'image comme à ma première version. La mesure
    // qui a tranché : `test/globe-eviction` ⑤ enchaîne `update()` puis un DRAIN
    // COMPLET du réseau ; une décision prise en fin d'image lisait donc six
    // créneaux pourvus, et le parcours suivant appliquait cette barrière-là à un
    // vol déjà vide. Résultat : un cycle de période 2 (blocage, dégel, blocage),
    // 12 requêtes caméra strictement immobile. La grandeur qui compte — « y
    // a-t-il de quoi remplir les six créneaux ? » — se lit au moment où le
    // parcours décide, pas une image plus tôt.
    this._deciderBarriere(dt)
    this._centreEnAttente = 0
    {
      const r = camPos.length()
      this._descend = this._rayonCamPrec > 0 && r < this._rayonCamPrec * (1 - 1e-7)
      this._rayonCamPrec = r
    }
    for (const t of this.tiles.values()) {
      if (t.mesh) t.mesh.visible = false
      if (t.z > ROOT_Z && t.state === 'ready' && t.coverFrame !== prev && t.lastUsed !== prev) marge++
    }
    this._credit = this.cacheMax - this.tiles.size + marge

    this._enParcours = true
    for (const root of this.roots) this._traverse(root, camPos, camDir)

    // ⚠️ LA PURGE PASSE AVANT L'ÉVICTION, et l'ordre porte du sens : elle rend
    // des tuiles à `empty`, ce que l'éviction sait reprendre (rang 0), alors
    // qu'une `loading` fantôme lui échappe pendant IMAGES_BLOQUEE images.
    this._purgerFile()
    this._reclasserFile()
    // le plafond DUR, et — sur le chemin continu — le cache SOUPLE : voir
    // `CACHE_SOUPLE`. La cible ne descend jamais sous les porteuses de l'image
    // (elles ne sont candidates qu'au rang 2, de toute façon).
    // ⚠️ ET JAMAIS AU REPOS DU CROP (`_cropSeul`) : le parcours s'y réduit au
    // bloc, les porteuses tombent à quelques dizaines, et tailler alors
    // rendrait au réseau tout ce que le dézoom retrouve gratuitement — c'est le
    // contrat de la Tâche N, tenu par `test/veille-repos.test.js` ⑦ (112 tuiles
    // sur 792 rendues, mesuré au premier essai). La taille ne se paie qu'en
    // mouvement, quand le parcours dit vraiment ce qui est à l'écran.
    let plafond = this.cacheMax
    if (this.continu && !this._cropSeul) {
      const cible = this._porteuses + CACHE_SOUPLE
      if (this.tiles.size > cible + CACHE_SOUPLE_HYSTERESE) plafond = Math.min(plafond, cible)
    }
    if (this.tiles.size > plafond) this._evictJusqua(plafond)
    // ⚠️ ET LA POMPE PART EN DERNIER (PF2) : après la purge (ce qui n'est plus
    // demandé ne part pas), après le reclassement (la caméra de CETTE image
    // décide), après l'éviction (une victime `loading` est déjà sortie de la
    // file). Voir `_pump`.
    this._enParcours = false
    this._pump()
    // ══════ L'IMAGERIE, MÊME ORDRE QUE CI-DESSUS — Tâche R16 ═══════════════
    // Abandon des requêtes fantômes PUIS éviction : l'abandon rend des places
    // que l'éviction sait reprendre, alors qu'une entrée « en vol » lui
    // échapperait. C'est mot pour mot l'argument de `_purgerFile` avant
    // `_evict`, quatre lignes plus haut, et pour la même raison.
    this.photoMonde?.finImage(this.frame)
    return this._drawn
  }

  // LE TRI SPATIAL, UNE FOIS PAR IMAGE. Deux grandeurs en sortent, toutes deux
  // consommées par `_traverse` : l'angle d'horizon et le frustum de la caméra.
  //
  // ⚠️ L'HORIZON EST GÉOMÉTRIQUE, PLUS UNE CONSTANTE. `dot < −0,35` valait
  // 110,5° en dur — une calotte de deux tiers de planète, quelle que soit
  // l'altitude. Le vrai horizon d'un point à la distance D du centre est à
  // `acos(R/D)` : **2,87° à 8 km**, soit une calotte jusqu'à ×1 076 trop large.
  // On ne prend PAS `R/D` nu pour autant : un point à l'altitude `h` reste
  // visible tant que `P·camPos ≥ R²`, donc le cosinus limite est
  // `R² / ((R + marge) × D)` — c'est ce qui garde les crêtes exagérées visibles
  // par-dessus le limbe au lieu de les faire clignoter.
  //
  // ⚠️ SEUL, L'HORIZON NE DÉBLOQUE AUCUN NIVEAU DE ZOOM — mesuré. Il réduit
  // l'emprise parcourue, ce qui rend le frustum possible ; il ne se juge pas au
  // zoom atteint mais au nombre de tuiles PARCOURUES (`_visites`).
  _preparerTriSpatial(camera, camPos) {
    const R = this.radius
    // le déplacement radial maximal du relief, dans les unités de la scène —
    // même formule que `dispScale` dans `_buildMesh`
    const marge = ALT_MAX_M * (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
    this._margeRelief = marge // lu par `_troncBoite`
    const D = Math.max(camPos.length(), R * 1.0000001)
    const cos = (R * R) / ((R + marge) * D)
    this._angleHorizon = Math.acos(Math.min(Math.max(cos, -1), 1))
    // la nappe déplacée occupe la coquille [R − JUPE_MAX, R + marge] : on centre
    // la sphère englobante DEDANS plutôt que sur la sphère nue, ce qui divise
    // par deux l'épaisseur à porter (2,5 + 0,9 → 1,72 à l'exagération 18).
    this._rayonCentre = (R + (marge - JUPE_MAX) / 2) / R
    this._demiEpaisseur = (marge + JUPE_MAX) / 2

    // ⚠️ `matrixWorld` de la caméra est mise à jour par le RENDU, qui passe
    // après nous : sans ce rappel le frustum aurait une image de retard, et le
    // retard se voit — les tuiles clignoteraient au bord de l'écran.
    camera.updateMatrixWorld()
    if (!camera.projectionMatrix || !camera.matrixWorld) {
      // ⚠️ ÉCHEC BRUYANT, ET C'EST VOULU. Un repli silencieux « pas de matrice,
      // pas de frustum » rendrait le drapeau inopérant sans que rien ne rougisse
      // — exactement le défaut que cette tâche corrige.
      throw new Error('globe continu : update() exige une vraie caméra (projectionMatrix + matrixWorld)')
    }
    this._matVue.copy(camera.matrixWorld).invert().premultiply(camera.projectionMatrix)
    this._frustum.setFromProjectionMatrix(this._matVue)
    // le facteur d'échelle vertical de la projection (1 / tan(fov/2)) : c'est
    // lui qui convertit un rayon de scène en rayon d'écran dans `_priorite`
    this._echelleProj = camera.projectionMatrix.elements[5]
  }

  // ═══════════ LA TUILE EST-ELLE DANS LE CHAMP ? — PF2 ══════════════════════
  //
  // Les deux tris de `_traverse` (horizon géométrique, puis tronc de vue) —
  // ou, hors tri spatial, la calotte constante d'avant — en UNE question, posée
  // au même code par la tuile parcourue ET par les enfants qu'on s'apprête à
  // demander. Les racines sont toujours dans le champ : elles portent la
  // couverture de toute la planète.
  _dansLeChamp(t, camDir) {
    if (t.z <= ROOT_Z) return true
    if (this.continu) {
      if (this._horsHorizon(t, camDir)) return false
      // la sphère d'abord (deux produits scalaires par plan), la boîte ensuite
      // — elle ne peut qu'ÉCARTER ce que la sphère a laissé passer
      if (!this._frustum.intersectsSphere(this._sphereDe(t))) return false
      return this._troncBoite(t)
    }
    // horizon cull: skip tiles fully on the far side of the planet
    return t.center.dot(camDir) / this.radius >= -0.35
  }

  // La boîte orientée de la tuile, relief et jupe compris, contre les six
  // plans du tronc — le test séparateur classique : la boîte est dehors si,
  // pour un plan, la distance de son centre plus son rayon projeté est
  // négative. ⚠️ Le relief est radial en CHAQUE sommet, pas selon l'axe haut de
  // la tuile : sur une grande tuile il déborde aussi en est/nord, d'au plus
  // `marge × sin(theta)` — c'est le terme `mXY`, et il n'est pas décoratif.
  _troncBoite(t) {
    const b = t.boite
    if (!b) return true
    const marge = this._margeRelief
    const mXY = Math.max(marge, JUPE_MAX) * Math.sin(t.theta)
    const uHi = b.uMax + marge
    const uLo = b.uMin - JUPE_MAX
    const he = (b.eMax - b.eMin) / 2 + mXY
    const hn = (b.nMax - b.nMin) / 2 + mXY
    const hu = (uHi - uLo) / 2
    const ce = (b.eMax + b.eMin) / 2
    const cn = (b.nMax + b.nMin) / 2
    const cu = (uHi + uLo) / 2
    const e = b.e, n = b.n, u = b.u, c = t.center
    const cx = c.x + e.x * ce + n.x * cn + u.x * cu
    const cy = c.y + e.y * ce + n.y * cn + u.y * cu
    const cz = c.z + e.z * ce + n.z * cn + u.z * cu
    const plans = this._frustum.planes
    for (let i = 0; i < 6; i++) {
      const pl = plans[i]
      const nx = pl.normal.x, ny = pl.normal.y, nz = pl.normal.z
      const d = nx * cx + ny * cy + nz * cz + pl.constant
      const r = he * Math.abs(nx * e.x + ny * e.y + nz * e.z) + hn * Math.abs(nx * n.x + ny * n.y + nz * n.z) + hu * Math.abs(nx * u.x + ny * u.y + nz * u.z)
      if (d + r < 0) return false
    }
    return true
  }

  // La tuile est-elle ENTIÈREMENT derrière l'horizon ? ⚠️ `t.theta` — son
  // demi-angle au centre de la planète — n'est pas un raffinement : sans lui la
  // formule écrête au limbe, parce qu'une tuile dont le CENTRE vient de passer
  // derrière l'horizon a encore la moitié de sa surface devant.
  _horsHorizon(t, camDir) {
    const dot = t.center.dot(camDir) / this.radius
    return dot < Math.cos(this._angleHorizon + t.theta)
  }

  // La sphère englobante de la tuile, relief et jupe compris. Réutilise un seul
  // objet : `_traverse` tourne des centaines de fois par image.
  _sphereDe(t) {
    this._sphereTuile.center.copy(t.center).multiplyScalar(this._rayonCentre)
    this._sphereTuile.radius = t.rayon * this._rayonCentre + this._demiEpaisseur
    return this._sphereTuile
  }

  _traverse(t, camPos, camDir) {
    // ══════ LE CROP SEUL — Tâche N ═════════════════════════════════════════
    //
    // ⚠️ **AVANT `_visites++`, ET CE N'EST PAS UN DÉTAIL DE COMPTAGE.**
    // `_visites` est l'instrument par lequel ce dépôt mesure l'emprise
    // parcourue (Tâche 4, « il ne se juge pas au zoom atteint mais au nombre de
    // tuiles PARCOURUES »). Compter une tuile qu'on refuse de parcourir
    // rendrait la mesure aveugle à la seule chose que cette tâche change.
    //
    // ⚠️ **ET C'EST UN `return` SEC, SANS `lastUsed`.** La tuile n'est donc plus
    // porteuse : elle redevient évinçable. Ce n'est pas un oubli, mais ce n'est
    // pas non plus une éviction — au repos le cache ne DÉBORDE pas (mesuré :
    // 712 tuiles pour `cacheMax = 1 700`), donc `_evict` ne passe jamais et rien
    // n'est rendu au réseau. **C'est ce qui rend la transition gratuite** :
    // dézoomer retrouve en cache tout ce qui y était.
    if (this._horsCropSeul(t.z, t.x, t.y)) return
    this._visites++
    // ⚠️ LES RACINES z2 SONT EXEMPTÉES DES DEUX TRIS, et ce n'est pas une
    // faveur : elles portent la couverture de toute la planète, ce sont elles
    // qui dessinent tant que leurs enfants ne sont pas au complet. Les écarter
    // du parcours ouvrirait un trou à chaque bord d'écran.
    //
    // Horizon géométrique + marge de corde, puis tronc de vue. ⚠️ ET C'EST LE
    // TRONC QUI FAIT LE TRAVAIL. Sans lui, réduire la calotte ne fait que
    // déplacer le point fixe du budget : le zoom reste le même, quelle que soit
    // l'altitude. La question est posée par `_dansLeChamp`, la MÊME que celle
    // posée aux enfants avant de les demander (PF2) : deux écritures divergent.
    if (!this._dansLeChamp(t, camDir)) return

    t.lastUsed = this.frame
    this._porteuses++
    // PORTEUSE de la couverture courante. `lastUsed` ne suffit pas à distinguer
    // les deux populations que ce parcours touche : les tuiles qu'il TRAVERSE
    // (celle-ci — dessinée, ou ancêtre raffiné dont les enfants dessinent) et
    // les enfants simplement PRÉPARÉS plus bas, qui ne portent encore rien.
    // Les premières seront reparcourues à la frame suivante ; les évincer,
    // c'est les redemander au réseau immédiatement. `coverFrame` les marque.
    t.coverFrame = this.frame
    // ⚠️ LE PLANCHER DE `dist` ÉTAIT LE VRAI PLAFOND DE ZOOM DU GLOBE, ET CE
    // N'ÉTAIT PAS `MAX_Z` (plan « globe continu », Tâche 4 quater).
    //
    // Ce `1` est un plancher exprimé en UNITÉS DE SCÈNE, et `R_GLOBE = 100`
    // vaut 6 371 000 m : **une unité pèse 63 710 m, donc ce plancher valait
    // 63,7 km.** Sous cette altitude `dist` est CONSTANT : le ratio
    // `chord / dist` cesse de dépendre de l'altitude et le raffinement s'arrête
    // net, exactement à z11 — **quelle que soit la valeur de `MAX_Z`**.
    //
    // ⚠️ MESURÉ SUR CE DÉPÔT AVANT LA CORRECTION, protocole A, 8 km :
    // `MAX_Z = 16` avec `CACHE_MAX = 8 000` (treize fois le budget) rend
    // TOUJOURS z11, cache saturé à 532. Monter la constante ne produit rien —
    // c'est le §2 de `/threejs-optimisation` mot pour mot.
    //
    // Le plancher devient donc une borne en MÈTRES. Il ne sert qu'à empêcher la
    // division par zéro quand la caméra touche la nappe (et `dist` devient
    // négatif dès qu'elle entre dans la demi-corde d'une grosse tuile) : un
    // mètre suffit, et un mètre ne borne plus rien d'observable.
    //
    // ⚠️ ET LA BAISSE EST RÉSERVÉE AU CHEMIN CONTINU. Sans le tri spatial de la
    // Tâche 4 (horizon géométrique + frustum), le globe parcourt une calotte de
    // deux tiers de planète : lui ouvrir les niveaux fins ne ferait pas un
    // globe plus net, il ferait une tempête de requêtes sur un cache déjà
    // saturé — mesuré sur l'ancien chemin, 439 tuiles dessinées, 600 en cache,
    // 75 raffinements refusés par image, z6. **La production garde son
    // plancher, et la mesure ci-dessous le vérifie plutôt que de l'espérer.**
    const plancher = this.continu ? PLANCHER_DIST : 1
    const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, plancher)
    // hysteresis: a tile that already refined only coarsens once the ratio
    // falls well below the split point, so hovering at the threshold no
    // longer flickers between parent and children every few frames
    const ratio = t.chord / dist
    // ══════ LE RAFFINEMENT UNIFORME DANS LE CROP — Tâche A, Étape 4 ═════════
    //
    // ⚠️ **`chord / dist` REFEND PAR DISTANCE ; LE CROP A BESOIN D'UNE
    // RÉSOLUTION UNIFORME SUR TOUTE SON EMPRISE.** C'est une affiche : un bord
    // proche à z15 et un bord lointain à z13 se raccorderaient VISIBLEMENT au
    // milieu du bloc. On prescrit donc `ZOOM_SOCLE` partout dans l'emprise —
    // plancher ET plafond — et la distance ne décide plus que dehors.
    //
    // ⚠️ **PLAFOND COMPRIS, ET C'EST LE POINT QUI SE VOIT** : sous ce régime le
    // crop cesse de descendre à z15. C'est le zoom auquel le socle est
    // rééchantillonné aujourd'hui (`ZOOM_SOCLE = 13`), donc l'image ne perd rien
    // de ce que le produit montre — mais le globe, lui, savait faire plus fin.
    // Le coût est mesuré au compte rendu de la tâche, pas supposé.
    const zCrop = this._crop ? zoomCropPrescrit(t.z, t.x, t.y, this._crop) : 0
    let wantSplit = zCrop
      ? t.z < zCrop
      : t.z < MAX_Z && ratio > (t.refined ? MERGE_RATIO : SPLIT_RATIO)

    // ⚠️ **ON NE DESCEND PAS VERS UN ENDROIT QU'ON N'A PAS ENCORE CHOISI —
    // Tâche R3.** `cropAttendu` sans `_crop`, c'est l'intervalle de démarrage :
    // la caméra est déjà à l'altitude du bloc, donc `ratio` réclame z13, mais
    // la veille attend le MNT pour dire OÙ. Les racines restent parcourues et
    // dessinées ; seule la descente est retenue.
    //
    // ⛔ **ET C'EST ICI, PAS DANS `_children` — LE PIÈGE EST DOCUMENTÉ QUINZE
    // LIGNES PLUS BAS.** `_children` filtre déjà par `_horsCropSeul`, donc il
    // rendrait une liste VIDE ; or `[].every(…)` vaut `true`, la descente
    // « réussit » dans le vide et le `return` qui suit **saute le dessin de la
    // racine**. La planète disparaîtrait pendant les onze premières images.
    // C'est exactement le `kids.length > 0 &&` que la Tâche P14 a retiré comme
    // code mort — il l'était, et il cesse de l'être si on coupe trop bas.
    if (this._retenueAvantCrop() && !this._crop) wantSplit = false

    // ══════ LA BARRIÈRE : LA PÉRIPHÉRIE FINE ATTEND QUE LE CENTRE AIT FINI ═══
    //
    // D22 ③, mot pour mot : « tant qu'une tuile prioritaire est en vol, aucune
    // tuile de périphérie ne prend un créneau pour sa version fine ».
    //
    // ⚠️ **ET LA BARRIÈRE EST POSÉE ICI, DANS `_traverse`, PAS DANS `_pump` —
    // C'EST TOUT LE SUJET, ET LE BRIEF LE DIT AVANT LA MESURE.** Retenir dans la
    // pompe une entrée DÉJÀ ENFILÉE ne peut faire qu'une chose : laisser un
    // créneau vide pendant que le centre finit. Or « le gain de PF2 est venu de
    // vider la file, pas du vol » — annuler six requêtes ne rachète rien. Posée
    // à l'admission du raffinement, la barrière ne retient aucun créneau : elle
    // empêche la périphérie d'ENTRER dans la file, et les six créneaux vont donc
    // aux descendants du centre, que le parcours produit en abondance. Elle rend
    // au passage du CRÉDIT de cache au centre, ce qui est le levier du §5 de
    // `/threejs-optimisation` (« réduis d'abord ce qui entre »).
    //
    // ⚠️ **ET ELLE NE RETIENT QUE CE QUI COÛTE UNE REQUÊTE** (`_enfantsPresents`,
    // la même garde que l'admission par crédit juste en dessous) : si les quatre
    // enfants sont déjà en cache, descendre ne prend aucun créneau, et refuser
    // ferait REGRESSER l'écran — une périphérie déjà nette redeviendrait floue,
    // c'est-à-dire exactement le défaut que R37 vient de tuer. La barrière ne
    // peut donc jamais rendre un pixel plus grossier qu'il ne l'était : elle
    // diffère des requêtes, elle n'efface rien.
    // ⚠️ ET « pas un seul enfant en cache », pas « les quatre » : un enfant DÉJÀ
    // parti (loading, ou prêt) ne rendrait aucun créneau si on retenait son
    // parent — il a déjà pris le sien. Le retenir quand même lui ferait perdre
    // son `lastUsed`, donc sa protection contre l'éviction et la purge de file :
    // on paierait sa requête DEUX fois pour ne rien gagner. « Annuler six
    // requêtes ne rachète rien » (PF2, `_annuler`) vaut aussi pour la file.
    if (wantSplit && this._barriereRetient(t)) {
      wantSplit = false
      this._barriereRefus++
    } else if (wantSplit && this._barriereArmeeIci(t) && !this._enfantsPresents(t)) {
      // la barrière était armée, la tuile est bien en périphérie, et elle passe
      // QUAND MÊME parce qu'un de ses enfants existe déjà : c'est la mesure qui
      // sépare « rien à retenir » de « garde-fou trop serré »
      this._barriereSansEnfant++
    }

    // ADMISSION : on ne commence un raffinement que si le crédit de la frame
    // peut payer les quatre enfants qu'il fait naître. Quand ils sont déjà là,
    // descendre ne coûte rien — ni crédit ni réseau : on passe sans débiter.
    if (wantSplit && !this._enfantsPresents(t)) {
      if (this._credit < 4) {
        wantSplit = false
        this._refus++
      } else this._credit -= 4
    }

    if (wantSplit) {
      const kids = this._children(t)
      // ══════ UN ENFANT HORS CHAMP N'EST NI DEMANDÉ, NI ATTENDU — PF2 ═════
      //
      // ⚠️ **LE PARENT PASSE LE TRONC PAR SA SPHÈRE, ET CETTE SPHÈRE EST GRASSE.**
      // La sphère d'un carreau plat est 1,41 fois plus haute que le carreau
      // n'est large (rayon = demi-diagonale, dans TOUTES les directions, donc
      // aussi vers le ciel). Un tronc qui RASE une tuile par-dessus — la vue de
      // trois quarts le fait sur tout le pourtour — coupe la sphère du parent
      // sans toucher celle d'aucun enfant. Le parent « voulait » donc quatre
      // enfants qu'aucun écran ne montrerait. Mesuré (profil-pf2, glissé gauche
      // à 1 500 km, caméra du globe IMMOBILE) : **164 demandes, 99,4 % hors du
      // tronc, 94 requêtes, 7,1 Mio** pour un geste qui n'a pas déplacé la
      // planète d'un pixel ; sur une descente, 20 % des demandes.
      //
      // Chaque enfant est donc jugé par SA sphère avant d'être demandé. Et la
      // règle sans-trou ne compte plus que les enfants DANS LE CHAMP : c'est le
      // `TileSelectionResult.CULLED` de Cesium — un enfant écarté vaut « prêt »
      // pour le raffinement, puisqu'aucun pixel ne dépend de lui. Quand la
      // caméra tourne et le fait entrer dans le champ, il est `empty`, la
      // règle retombe sur le parent, qui est en cache (porteuse : il est
      // reparcouru à chaque image), et l'enfant part sur le réseau. C'est
      // exactement ce que la Tâche N fait déjà avec les enfants hors crop.
      //
      // ⚠️ `lastUsed` n'est posé QUE sur les enfants du champ : un enfant hors
      // champ resté en file est purgé à l'image suivante (`_purgerFile`), et
      // un `empty` hors champ est évinçable au rang 0 — il ne coûte rien.
      // ══════ LE RAFFINEMENT PARTIEL — R37 ══════════════════════════════════
      //
      // `masque` porte les quadrants que le parent doit encore couvrir : ceux
      // d'un enfant du champ qui n'est pas prêt. Un enfant hors champ, ou hors
      // crop (absent de `kids`), ne met rien dans le masque : aucun pixel ne
      // dépend de lui. Quand le masque est vide, c'est l'ancienne règle
      // sans-trou ; sinon les enfants prêts se dessinent et le parent ne se
      // dessine que sous le masque — jamais deux fois le même pixel, jamais
      // un pixel sans tuile.
      let masque = 0
      let prets = 0
      for (const k of kids) {
        if (!this._dansLeChamp(k, camDir)) continue
        k.lastUsed = this.frame // protect loading/fresh children from LRU
        if (k.state === 'empty') this._request(k)
        if (k.state !== 'ready' || !k.mesh) {
          masque |= quadrantDe(k)
          // CIB : « le centre a-t-il totalement fini ? » — un enfant de la cible
          // que cette image VEUT et qui n'est pas dessinable. C'est le seul
          // compteur qui arme la barrière, et il est relevé DANS le parcours,
          // au moment de la décision (le §3 de `/threejs-optimisation` : une
          // sonde posée après la fonction lit un état écrasé).
          if (this.continu && this._dansLaCible(k)) this._centreEnAttente++
        } else prets++
      }
      // ⚠️ **AU REPOS, `kids` NE CONTIENT QUE LES ENFANTS DU CROP — Tâche N**,
      // et la couverture tient toujours : ce qui manque à la couverture est
      // ce qu'on a décidé de ne pas montrer. Sans ce filtrage, un quart de
      // z11 chevauchant le bord du crop attendrait quatre enfants dont deux ne
      // seront JAMAIS demandés — le crop resterait grossier pour toujours.
      //
      // ⛔ **IL Y AVAIT ICI UN `kids.length > 0 &&`, ET C'ÉTAIT DU CODE MORT —
      // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Les quatre
      // enfants PAVENT exactement leur parent : si le parent recoupe l'emprise
      // du crop, au moins un enfant la recoupe (`tuileDansCrop` est un test
      // d'intersection sur les deux axes). Ce qui garde réellement l'absence de
      // trou est l'assertion de COUVERTURE de `test/veille-repos.test.js` ⑦ :
      // chaque point du crop est dessiné par exactement une tuile (ou un
      // quadrant de parent), avec et sans le drapeau — plus « les mêmes
      // tuiles », qu'un raffinement partiel change par construction.
      if (masque === 0) {
        t.refined = true
        for (const k of kids) this._traverse(k, camPos, camDir)
        return
      }
      // ⚠️ LE PARENT DOIT POUVOIR DESSINER pour couvrir le masque ; sinon on
      // remonte au grand-parent comme avant (il nous voit « pas prêt »).
      if (this.raffinementPartiel && prets > 0 && t.state === 'ready' && t.mesh) {
        // `refined` garde son sens d'avant — « les quatre enfants dessinent » —
        // pour que l'hystérésis de MERGE_RATIO ne change pas de seuil ici
        t.refined = false
        for (const k of kids) {
          if (k.state === 'ready' && k.mesh && !(masque & quadrantDe(k)) && this._dansLeChamp(k, camDir)) this._traverse(k, camPos, camDir)
        }
        this._dessinerPartiel(t, masque)
        return
      }
    }

    t.refined = false
    if (t.state === 'ready' && t.mesh) {
      t.mesh.visible = true
      this._drawn++
      // ══════ LA PRÉLECTURE — R37 ═══════════════════════════════════════════
      // La tuile se dessine entière et n'a pas encore à se refendre ; mais
      // si le ratio approche le seuil, ses enfants du champ partent déjà, en
      // retrait de priorité. Le crédit se paie comme pour un vrai raffinement
      // (les enfants naissent), et `lastUsed` les protège de la purge tant
      // que l'image les prélit encore.
      // ⚠️ sur le chemin CONTINU seulement : c'est lui qui a le tri spatial et la
      // clé d'écran de PF2 ; sans eux, prélire, c'est remplir le cache d'invisible
      if (this.continu && this.prelecture && this._descend && !zCrop && t.z < MAX_Z && ratio > this.prelectureRatio) this._prelire(t, camDir)
      // ══════ L'IMAGERIE — Tâche R16, ET C'EST **ICI** QUE ÇA SE JOUE ═══════
      //
      // ⚠️⚠️ **SUR LES TUILES DESSINÉES, PAS SUR LES TUILES PARCOURUES — PIÈGE ①
      // DU BRIEF, PRIS PAR LE BON BOUT.** « Réduis d'abord ce qui entre » dans le
      // cache : l'ensemble DESSINÉ est exactement la couverture de l'écran, et
      // tout ce qui est plus large (les parents raffinés, les enfants préparés)
      // consommerait des places sans jamais peindre un pixel. À l'orbite le
      // parcours visite 40 tuiles pour en dessiner 28 ; au régional, 216 pour 67.
      // Demander l'imagerie des 216 aurait triplé ce qui entre, pour rien.
      //
      // ⚠️ ET IL N'Y A PAS DE SECOND TRI SPATIAL : la tuile est ici PARCE QUE
      // l'horizon géométrique et le tronc de vue l'ont laissée passer, quarante
      // lignes plus haut. La photo hérite du tri du quadtree, elle n'en refait pas.
      this._habillerPhoto(t)
    }
  }

  // ══════════ LA PRÉLECTURE UN NIVEAU À L'AVANCE — R37 ═══════════════════════
  //
  // Les enfants du champ d'une tuile dessinée partent avant que le seuil ne
  // soit franchi. ⚠️ **RÉUTILISE LA CLÉ DE PF2** (`_priorite`), en retrait
  // fixe : la file trie en décroissant, donc `clé − PRELECTURE_RETRAIT` passe
  // après tout ce que l'image demande vraiment (une clé de PF2 vaut au plus
  // ~1,4 en écran). L'entrée n'est pas « suivie » (pas reclassée) : elle est
  // purgée dès qu'une image ne la prélit plus, et redemandée s'il le faut.
  _prelire(t, camDir) {
    // ⚠️ SEULEMENT AU CENTRE DE L'ÉCRAN : une descente va vers le centre, et
    // ce sont les bords qui sortent du champ en descendant — prélire leurs
    // enfants, c'est payer des tuiles qui ne seront jamais dessinées (mesuré :
    // +28 % de requêtes par descente sans ce garde-fou, +9 % avec).
    if (this._priorite(t) < PRELECTURE_CENTRE) return
    if (!this._enfantsPresents(t)) {
      // ⚠️ ET SEULEMENT QUAND LE CACHE A DE LA PLACE : sur un cache saturé,
      // un enfant prélu prend la place d'une tuile qu'on rechargera — mesuré
      // (`test/globe-eviction`, cache 600) : ×1,85 de requêtes par vol. Le
      // crédit compte la place libre plus la place récupérable.
      if (this._credit < PRELECTURE_CREDIT_MIN) return
      this._credit -= 4
    }
    for (const k of this._children(t)) {
      if (!this._dansLeChamp(k, camDir)) continue
      k.lastUsed = this.frame
      if (k.state === 'empty') {
        this._request(k, this._priorite(k) - PRELECTURE_RETRAIT)
        if (k.state === 'loading') this._prelues++
      }
    }
  }

  // ══════════ LE PARENT SOUS LES QUADRANTS MANQUANTS — R37 ═══════════════════
  //
  // Le maillage d'une tuile est un seul appel de dessin. Pour n'en dessiner
  // que certains quadrants sans toucher au nuanceur, l'index est réordonné une
  // fois par quadrant ([Q0][Q1][Q2][Q3][jupe]) et découpé en GROUPES ; three ne
  // dessine les groupes que si le matériau est un tableau, et il saute un
  // groupe dont le matériau est `visible = false`. Le tableau vaut donc
  // `[partagé, invisible]`, et chaque groupe pointe l'un ou l'autre.
  //
  // ⚠️ La jupe se dessine toujours avec le parent : elle est sous la surface
  // des enfants (rabattue vers le centre de la planète), invisible là où un
  // enfant couvre, et elle ferme les fentes contre les voisins ailleurs.
  // ⚠️ Le matériau redevient le partagé à l'image suivante (`update`) — aucun
  // lecteur de `mesh.material` ne voit le tableau entre deux parcours.
  _dessinerPartiel(t, masque) {
    const mesh = t.mesh
    const geo = mesh.geometry
    let q = geo.userData.quadrants
    if (!q || q.index !== geo.index) q = this._decouperEnQuadrants(geo)
    if (!q) {
      // pas de découpe possible (maillage étranger) : le parent entier, comme avant
      mesh.visible = true
      this._drawn++
      this._habillerPhoto(t)
      return
    }
    if (!this._materiauInvisible) this._materiauInvisible = new THREE.MeshBasicMaterial({ visible: false })
    const m = this._materiauEntier(mesh)
    if (!t._materiaux || t._materiaux[0] !== m) t._materiaux = [m, this._materiauInvisible]
    mesh.material = t._materiaux
    const groupes = geo.groups
    for (let i = 0; i < 4; i++) groupes[i].materialIndex = masque & (1 << i) ? 0 : 1
    if (groupes[4]) groupes[4].materialIndex = 0
    mesh.visible = true
    t._partiel = masque
    this._partiels.add(t)
    this._nPartiels++
    this._drawn++
    this._habillerPhoto(t)
  }

  _materiauEntier(mesh) {
    const m = mesh.material
    return Array.isArray(m) ? m[0] : m
  }

  _restaurerEntier(t) {
    const mesh = t.mesh
    t._partiel = 0
    if (mesh && Array.isArray(mesh.material)) mesh.material = mesh.material[0]
  }

  // Réordonne l'index d'un maillage de tuile par quadrant (uv), la jupe en
  // dernier, et pose les cinq groupes. Une fois par tuile, à la première
  // couverture partielle ; `userData.quadrants.index` dit sur quel index la
  // découpe a été faite (si quelqu'un remplace l'index, on recoupe).
  _decouperEnQuadrants(geo) {
    const index = geo.index
    const uv = geo.attributes.uv
    if (!index || !uv) return null
    const src = index.array
    const nV = geo.userData.jupe ? geo.userData.jupe.nV : Infinity
    const nT = (src.length / 3) | 0
    const classe = new Uint8Array(nT)
    const compte = [0, 0, 0, 0, 0]
    for (let i = 0; i < nT; i++) {
      const a = src[i * 3], b = src[i * 3 + 1], c = src[i * 3 + 2]
      let g
      if (a >= nV || b >= nV || c >= nV) g = 4
      else {
        const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3
        const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3
        // uv v = 1 − v de tuile : le nord (dy = 0) est en v > 0,5
        g = (u >= 0.5 ? 1 : 0) + (v < 0.5 ? 2 : 0)
      }
      classe[i] = g
      compte[g]++
    }
    const debut = [0, 0, 0, 0, 0]
    for (let g = 1; g < 5; g++) debut[g] = debut[g - 1] + compte[g - 1]
    const dst = new src.constructor(src.length)
    const curseur = debut.slice()
    for (let i = 0; i < nT; i++) {
      const g = classe[i]
      const o = curseur[g]++ * 3
      dst[o] = src[i * 3]; dst[o + 1] = src[i * 3 + 1]; dst[o + 2] = src[i * 3 + 2]
    }
    const neuf = new THREE.BufferAttribute(dst, 1)
    geo.setIndex(neuf)
    geo.clearGroups()
    for (let g = 0; g < 5; g++) geo.addGroup(debut[g] * 3, compte[g] * 3, 0)
    const q = { index: neuf, debut, compte }
    geo.userData.quadrants = q
    return q
  }

  // Lie à la tuile la meilleure photo disponible — la sienne, ou celle d'un
  // aïeul en attendant. `null` laisse la tuile hypsométrique : pas de trou, pas
  // de blanc, pas de clignotement. Voir `monde/photo-monde.js`.
  _habillerPhoto(t) {
    const pm = this.photoMonde
    if (!pm || !pm.actif) return
    // PF4 : matériau partagé → la photo vit sur le maillage (monde/materiau-tuile.js)
    habillerPhotoTuile(t.mesh, pm.pourTuile(t, this.frame))
  }

  /**
   * Allume ou éteint la photo sur la SURFACE du globe (le bouton d'Adrien).
   *
   * ⚠️ **ÉTEINDRE NE VIDE PAS LE CACHE**, et c'est la règle 4 des grands (« rien
   * n'est jeté brutalement ») : rallumer doit être instantané. La borne de
   * mémoire vidéo est portée par le plafond du cache, pas par l'extinction.
   */
  setPhotoMonde(actif, opacite = 1) {
    const pm = this.photoMonde
    if (!pm) return false
    pm.setActif(actif)
    this.uniforms.uPhotoMonde.value = actif ? opacite : 0
    if (!actif) {
      // ⚠️ ET ON DÉLIE LES TUILES : `uPhotoMonde = 0` suffirait à ne rien
      // peindre, mais les samplers resteraient liés à des textures que le cache
      // pourrait libérer. Un drapeau qui éteint le DESSIN sans délier la
      // RESSOURCE est la classe d'erreur que ce fichier a déjà payée.
      for (const t of this.tiles.values()) {
        const u = t.mesh?.material?.uniforms
        if (u?.uPhotoOn) { u.uPhotoOn.value = 0; u.uPhoto.value = null }
      }
    }
    return pm.actif
  }

  // les quatre enfants sont-ils DÉJÀ dans le cache ? (sans les créer — c'est
  // toute la différence avec `_children`, qui les fait naître)
  _enfantsPresents(t) {
    const z = t.z + 1
    const x = t.x * 2
    const y = t.y * 2
    return (
      this._enfantAcquis(z, x, y) &&
      this._enfantAcquis(z, x + 1, y) &&
      this._enfantAcquis(z, x, y + 1) &&
      this._enfantAcquis(z, x + 1, y + 1)
    )
  }

  /**
   * Cet enfant est-il DÉJÀ dans le cache — ou hors sujet ?
   *
   * ⚠️ **HORS CROP AU REPOS, IL NE COÛTERA RIEN, DONC IL NE SE PAIE PAS —
   * Tâche N.** `_children` ne le fera pas naître ; le compter dans l'admission
   * ferait débiter quatre crédits pour deux tuiles à chaque quart qui chevauche
   * le bord du crop, à chaque image. Le drapeau éteint, cette fonction est
   * exactement `this.tiles.has(...)`.
   */
  _enfantAcquis(z, x, y) {
    return this._horsCropSeul(z, x, y) || this.tiles.has(tileKey(z, x, y))
  }

  /**
   * CIB : la barrière est-elle armée ET cette tuile est-elle de la périphérie ?
   * ⚠️ Extraite parce qu'un prédicat écrit en ligne dans `_traverse` ne se teste
   * QUE de biais : la campagne de mutation a relâché `_aucunEnfant` en
   * `!_enfantsPresents` et **aucun test n'a rougi** — l'invariant du parcours
   * (« un parent de périphérie vierge n'engendre pas ») reste vrai quand on
   * retient PLUS. Ce qu'il fallait, c'est pouvoir poser la question directement.
   */
  _barriereArmeeIci(t) {
    return !!this.barriereCible && this._barriereActive && this.continu && !this._dansLaCible(t)
  }

  /** CIB : ce raffinement est-il retenu par la barrière ? */
  _barriereRetient(t) {
    return this._barriereArmeeIci(t) && this._aucunEnfant(t)
  }

  /** CIB : aucun des quatre enfants n'existe encore — le raffinement les crée TOUS. */
  _aucunEnfant(t) {
    const z = t.z + 1
    const x = t.x * 2
    const y = t.y * 2
    return (
      !this.tiles.has(tileKey(z, x, y)) &&
      !this.tiles.has(tileKey(z, x + 1, y)) &&
      !this.tiles.has(tileKey(z, x, y + 1)) &&
      !this.tiles.has(tileKey(z, x + 1, y + 1))
    )
  }

  /**
   * Les enfants à faire naître.
   *
   * ⚠️ **AU REPOS SOUS `_cropSeul`, CEUX QUI SONT HORS DU CROP NE NAISSENT
   * MÊME PAS — Tâche N.** `_ensureTile` crée l'entrée de cache et `_request`
   * part derrière : filtrer plus bas (dans `_traverse`) aurait laissé le
   * réseau et le maillage se payer quand même, c'est-à-dire exactement le
   * défaut que cette tâche répare. Le drapeau éteint, la liste est celle
   * d'avant, dans le même ordre, au bit près.
   */
  _children(t) {
    const z = t.z + 1
    const x = t.x * 2
    const y = t.y * 2
    // ⚠️ **DÉROULÉ, PAS UNE BOUCLE SUR UN TABLEAU DE PAIRES** : `_traverse`
    // tourne des centaines de fois par image, et le fichier le dit déjà pour
    // `_sphereDe` (« réutilise un seul objet »). Une allocation de quatre paires
    // par appel serait un ramasse-miettes de plus par seconde.
    const out = []
    if (!this._horsCropSeul(z, x, y)) out.push(this._ensureTile(z, x, y))
    if (!this._horsCropSeul(z, x + 1, y)) out.push(this._ensureTile(z, x + 1, y))
    if (!this._horsCropSeul(z, x, y + 1)) out.push(this._ensureTile(z, x, y + 1))
    if (!this._horsCropSeul(z, x + 1, y + 1)) out.push(this._ensureTile(z, x + 1, y + 1))
    return out
  }

  _evict() {
    this._evictJusqua(this.cacheMax)
  }

  // Budget DUR, mais des victimes CHOISIES. Le tri d'origine était le seul
  // `a.lastUsed - b.lastUsed`, et il se retournait contre le globe : `_traverse`
  // marque toutes les tuiles qu'il parcourt, ancêtres raffinés compris, or ces
  // ancêtres ont `mesh.visible === false` (seules les feuilles sont allumées).
  // Ils rejoignaient donc les candidats avec `lastUsed === this.frame`, dans un
  // groupe d'ex æquo énorme que le tri stable départageait par ordre de
  // création — c'est-à-dire les z3/z4, les plus anciennes de la Map. Le globe
  // évinçait le chemin de descente qu'il allait reparcourir à la frame d'après,
  // et n'atteignait plus les zooms profonds du tout.
  //
  // Deux rangs, donc, et le budget reste tenu parce que le second existe :
  //   1. ce qui ne porte pas la couverture courante — du plus ancien au plus
  //      récent, puis à ancienneté égale du PLUS PROFOND au moins profond : une
  //      z9 périmée ne couvre qu'un timbre-poste déjà survolé, une z4 périmée
  //      reste sur le chemin de toutes les descentes à venir.
  //   2. les porteuses elles-mêmes, de la plus profonde à la moins profonde, et
  //      seulement si le rang 1 n'a pas suffi. Sacrifier une porteuse profonde
  //      ne fait pas de trou : la règle sans-trou de `_traverse` fait remonter
  //      le parent, qui couvre le quad entier.
  //
  // ⚠️ ET UN RANG 0, AJOUTÉ PAR LA TÂCHE 4 : LES TUILES BLOQUÉES. Une `error`,
  // ou une `loading` dont la requête n'est jamais revenue, ne dessinera JAMAIS
  // et n'était candidate à AUCUN des deux rangs — elle retenait donc une place
  // du budget pour de bon. C'est le même point fixe que le crédit nul, par une
  // autre porte. ⚠️ L'ORDRE DES DEUX RANGS EXISTANTS N'EST PAS TOUCHÉ : ce rang
  // passe AVANT eux parce qu'il ne coûte rien (aucune de ces tuiles ne porte de
  // donnée ni de pixel), pas parce que le classement serait à revoir.
  // ⚠️ ET UNE TROISIÈME POPULATION, AJOUTÉE PAR LA TÂCHE 4 BIS : LES `empty`
  // PÉRIMÉES. Le plafond de file et la purge rendent des tuiles à `empty` — le
  // seul état d'où `_request` sait repartir. Mais une `empty` n'est candidate ni
  // au rang 1 ni au rang 2 (tous deux filtrent sur `ready`) : sans cette ligne,
  // chaque refus de file laisserait une entrée de cache immortelle, c'est-à-dire
  // le fantôme qu'on vient de chasser, revenu par la porte d'à côté. Elle ne
  // coûte rien à jeter : pas de maillage, pas de texture, pas de hauteurs.
  // ⚠️ « Périmée » = pas touchée par le parcours de CETTE image ; une `empty`
  // fraîche est un enfant qui vient de naître et que l'on va demander.
  _bloquee(t) {
    if (t.state === 'error') return true
    if (t.state === 'loading') return this.frame - (t.demandee ?? 0) > IMAGES_BLOQUEE
    return t.state === 'empty' && t.lastUsed !== this.frame
  }

  _evictJusqua(max) {
    const excess = this.tiles.size - max
    if (excess <= 0) return
    const porte = (t) => t.coverFrame === this.frame
    const parProfondeur = (a, b) => b.z - a.z
    // ⚠️ LES TUILES RÉSERVÉES PAR LE FLUX SORTENT DU JEU, au même titre que les
    // racines. Elles sont seize au pire sur un budget de 1 700 (moins de 1 %) et
    // ce sont les seules dont on garde les hauteurs : les évincer rendrait le
    // socle intrinsèquement irremplissable — il redemanderait à chaque image ce
    // que l'éviction lui reprend à chaque image.
    const vivantes = [...this.tiles.values()].filter((t) => t.z > ROOT_Z && !this.gardeHauteurs.has(t.key))
    const bloquees = this._contrePression()
      ? vivantes.filter((t) => this._bloquee(t)).sort((a, b) => a.lastUsed - b.lastUsed || parProfondeur(a, b))
      : []
    const candidates = vivantes.filter((t) => t.state === 'ready' && !(t.mesh && t.mesh.visible))
    // R37 : une tuile dont le PARENT est dessiné est le prochain niveau de
    // l'écran — l'évincer, c'est la retélécharger dès que le parent se refend
    // (mesuré : 181 tuiles évincées en une image quand l'écran reculait au
    // parent, puis redemandées). Elle passe APRÈS les autres non porteuses.
    const parentDessine = (t) => {
      if (!this.protegerEnfants) return false
      const p = this.tiles.get(tileKey(t.z - 1, t.x >> 1, t.y >> 1))
      return !!(p && p.mesh && p.mesh.visible)
    }
    const libres = candidates.filter((t) => !porte(t))
    const victimes = [
      ...bloquees,
      ...libres.filter((t) => !parentDessine(t)).sort((a, b) => a.lastUsed - b.lastUsed || parProfondeur(a, b)),
      ...libres.filter(parentDessine).sort((a, b) => a.lastUsed - b.lastUsed || parProfondeur(a, b)),
      ...candidates.filter(porte).sort((a, b) => parProfondeur(a, b) || a.lastUsed - b.lastUsed),
    ]
    for (let i = 0; i < Math.min(excess, victimes.length); i++) {
      const t = victimes[i]
      // ⚠️ UNE VICTIME `loading` DOIT AUSSI SORTIR DE LA FILE (Tâche 4 bis,
      // correction 3). Sans cette ligne, `_pump` finirait par tirer son entrée,
      // téléchargerait la tuile, et la garde du maillage orphelin la jetterait à
      // l'arrivée : de la bande passante dépensée pour rien, prise sur les six
      // requêtes simultanées dont le globe a réellement besoin.
      this._annuler(t)
      if (t.mesh) {
        this.group.remove(t.mesh)
        t.mesh.geometry.dispose()
        libererMateriauTuile(this, t.mesh) // PF4 : jamais le matériau partagé
      }
      t.texture?.dispose()
      this.tiles.delete(t.key)
    }
  }

  setVisible(v) {
    // LE FILET DU CHARGEMENT DIFFÉRÉ DES RACINES (voir le constructeur). Montrer
    // le globe, c'est le seul instant où une sphère nue serait visible : on
    // s'assure donc que ses racines sont demandées ICI, quoi qu'il arrive en
    // amont. Idempotent, et sans effet si main.js les a déjà lancées au retrait
    // du voile — ce qui est le cas normal.
    if (v) this.chargeRacines()
    this.enabled = v
    // ══════ LA FRONTIÈRE DE RENDU — Tâche 1b bis ══════════════════════
    //
    // ⚠️ **`setVisible` CESSE D'ÊTRE L'INTERRUPTEUR — mais SEULEMENT sous le
    // drapeau, et c'est pour ça que les appels restent dans `modes.js`.** Quand
    // le globe est dessiné dans sa propre passe de fond (`main.js`), l'éteindre
    // à l'entrée en surface reviendrait à effacer le fond de l'image : c'est
    // exactement l'échange de monde que les trois derniers fondus blancs
    // masquent. `enabled` continue de basculer — il dit le MODE, pas le dessin.
    //
    // ⚠️ **CE QUE ÇA VEUT DIRE POUR LE CLIQUET DE LA TÂCHE 2 ter :** son test
    // épingle `globe.setVisible` dans `enterOrbit` et `_dive` par le TEXTE
    // SOURCE, et ces lignes sont toujours là — en production, sans drapeau,
    // elles font toujours exactement ce qu'elles faisaient. **Le cliquet reste
    // donc vert, et c'est juste : rien n'a changé pour l'utilisateur.** Il
    // tombera le jour où le drapeau deviendra le défaut et où ces lignes
    // partiront pour de bon — ce sera ce jour-là le signal, pas aujourd'hui.
    //
    // ⚠️ **Ce drapeau est posé PAR `main.js`, pas lu depuis `flags.js`** — même
    // règle que `globeContinu` : `src/globe.js` n'importe pas `flags.js`, il ne
    // connaît qu'un booléen. Un drapeau lu ici ne protégerait rien.
    this.group.visible = this.frontiereFond ? true : v
  }

  // ═══════════ REDEMANDER PLUTÔT QUE RETENIR (Tâche 4 sexies, Étape 1) ═══════
  //
  // Rend au réseau les tuiles PRÊTES : maillage, texture et état repartent à
  // zéro, `_traverse` les redemandera à la prochaine image. C'est le prix — et
  // le seul — du relâchement du canevas et des hauteurs : ni l'un ni l'autre
  // n'est reconstructible sur place, donc tout ce qui doit refaire un maillage
  // ou réenvoyer une texture passe par ici.
  //
  // ⚠️ CE N'EST PAS AUSSI CHER QU'IL Y PARAÎT : `_tileMemo` garde les 128
  // dernières images décodées, et les racines z2 ne sont jamais touchées, donc
  // la planète ne disparaît pas — elle redevient grossière le temps du
  // rechargement. ⚠️ MAIS CE N'EST PAS GRATUIT NON PLUS, et la décision 14 du
  // plan (« l'exagération devient une courbe continue de l'altitude ») ne doit
  // PAS s'appuyer dessus image par image : à ce rythme-là il faudra déplacer le
  // relief dans le nuanceur de sommets, pas rebâtir la géométrie.
  _rechargeTuiles() {
    for (const t of this.tiles.values()) {
      if (t.state !== 'ready') continue
      if (t.mesh) {
        this.group.remove(t.mesh)
        t.mesh.geometry.dispose()
        libererMateriauTuile(this, t.mesh) // PF4 : jamais le matériau partagé
        t.mesh = null
      }
      t.texture?.dispose()
      t.texture = null
      t.heights = null
      t.size = 0
      // ⚠️ LE PLAN SE REDEMANDE AUSSI. Entre-temps la sonde a pu répondre, ou
      // la session a pu se replier sur AWS : rejouer l'ancien plan rechargerait
      // une source qui n'est plus la bonne, sans que rien ne le signale.
      t.plan = null
      t.refined = false
      t.retried = false // le rechargement n'est pas un échec : il rend son essai
      t.state = 'empty'
    }
    // ⚠️ SANS CETTE LIGNE LE GLOBE NE REVIENT JAMAIS. `_traverse` ne demande
    // que des ENFANTS : les seize racines z2 n'ont d'autre demandeur que
    // `chargeRacines`. Remises à `empty` sans lui, elles ne repartiraient sur le
    // réseau pour personne, et toute la descente resterait bloquée derrière
    // elles — sans erreur, sans test rouge, sans rien à l'écran.
    this.chargeRacines()
  }

  // relief exaggeration is baked into vertex positions — rebuild ready meshes.
  // ⚠️ Les hauteurs ne survivent plus au maillage (voir `_buildMesh`) : la
  // reconstruction passe donc par le réseau, pas par un tampon retenu.
  setExaggeration(v) {
    this.exaggeration = v
    // ⚠️ **L'ÉCHELLE DE RELIEF SUIT, ET C'EST OBLIGATOIRE — Tâche P9.** Le
    // relief est cuit dans les SOMMETS, mais la normale par fragment le dérive
    // de la texture de hauteur : elle a besoin du même facteur mètre → unité de
    // scène que `_buildMesh`. Laissée en arrière, elle rendrait des pentes
    // fausses d'un facteur `exagAvant / exagApres` — invisible à l'œil nu, et
    // c'est précisément la famille de fautes (`uMerHoule`, `skirtDrop`) que ce
    // chantier a payée quatre fois.
    this.uniforms.uUnitesParMetre.value = (R_GLOBE / EARTH_RADIUS_M) * v
    this._rechargeTuiles()
  }

  // ═══════════ LE QUATORZIÈME LECTEUR — Tâche E, « UNE SEULE TERRE » ═════════
  //
  // ⚠️ **LE GLOBE NE CALCULE PLUS SON EXAGÉRATION : IL LA LIT.** C'est la
  // décision 14 et son partage (`monde/exageration-continue.js`) — un écrivain,
  // N lecteurs. Un lecteur ne peut pas fabriquer sa propre valeur : il n'a pas
  // la courbe. Appelé par `syncExagToZoom` (`main.js`), l'unique écrivain.
  //
  // ⚠️ **ET IL NE SE RECHARGE QUE SI LA VALEUR A BOUGÉ.** `setExaggeration`
  // rend au réseau TOUTES les tuiles prêtes (le relief est cuit dans les
  // sommets, et `_buildMesh` relâche les hauteurs) : l'appeler pour une valeur
  // identique coûterait une planète entière à chaque rafraîchissement d'IHM.
  //
  // ⚠️ **CE QUE ÇA COÛTE, ET LE PLAN L'AVAIT ÉCRIT** : le commentaire de
  // `_rechargeTuiles` prévient que la décision 14 « ne doit PAS s'appuyer dessus
  // image par image ». Elle ne le fait pas — `syncExagToZoom` n'est appelé qu'au
  // CRAN, au chargement et au relâchement d'un curseur, jamais par image. Le
  // jour où la valeur devra glisser par image, il faudra déplacer le relief dans
  // le nuanceur de sommets ; ce n'est pas cette tâche.
  //
  // @returns {number} l'exagération en vigueur après l'appel
  majExageration(params) {
    if (!this.exagSuivie) return this.exaggeration
    const v = lireExageration(params)
    if (!Number.isFinite(v) || !(v > 0) || v === this.exaggeration) return this.exaggeration
    this.setExaggeration(v)
    return this.exaggeration
  }

  // ⚠️ LE CONTEXTE WebGL EST REVENU. Les textures du globe ont relâché leur
  // canevas au téléversement (voir `fetchTile`) : three n'a plus rien à
  // réenvoyer et les afficherait vides. On les redemande, ce qui est le seul
  // moyen de les repeupler — et le bon marché, puisqu'une perte de contexte
  // est rare et que `_tileMemo` évite une bonne part du réseau.
  // Branché sur `webglcontextrestored` par `src/main.js`.
  rechargeApresContexte() {
    this._rechargeTuiles()
  }

  dispose() {
    this.clouds.dispose()
    // ⚠️ LES PHOTOS SONT DES TEXTURES GPU COMME LES AUTRES — Tâche R16. Le cache
    // vit hors de `this.tiles` (plusieurs tuiles partagent une photo d'aïeul) :
    // la boucle ci-dessous ne les verrait pas.
    this.photoMonde?.vider()
    for (const t of this.tiles.values()) {
      if (t.mesh) {
        t.mesh.geometry.dispose()
        libererMateriauTuile(this, t.mesh) // PF4 : jamais le matériau partagé
      }
      t.texture?.dispose()
    }
    this.tiles.clear()
  }
}
