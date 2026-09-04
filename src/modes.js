// Mode state machine: SURFACE (the detailed terrain patch, full effects) ⇄
// ORBITAL (the whole planet, effects powered down). Camera altitude is the
// single driver, with hysteresis so the boundary never flaps:
//   surface → orbital  when the user keeps zooming past the orbit gate
//   orbital → surface  when altitude CROSSES a dive tier from above
// Three tiers mean a Madagascar-sized view lands on real terrain (z8 patch,
// ~470 km across) instead of a long dead zoom to the 8 000 m fine gate; once
// on a coarse patch, zooming against the near stop REFINES to the next scale.
// Transitions are announced FUI-style and masked by a paper whiteout.

import * as THREE from 'three'
import { R_GLOBE, ORBITAL_M_PER_UNIT, sphereToLatLon, latLonToSphere } from './geo.js'
import { PinchTracker } from './gestes.js'
import { pasEscalier, paliersRetenus, palierDeClic, ZOOM_PALIER_MIN } from './escalier-zoom.js'
import { POLAIRE_MAX_DURE } from './monde/butee-sol.js'
// LA LOI D'ALTITUDE vit dans un module PUR (voir son en-tête, et la Tâche 1 du
// plan « globe continu »). Rien ne change ici : ces quatre fonctions sont
// exactement les calculs qui étaient écrits en clair ci-dessous, sortis pour
// être mesurables sous node — `Modes` appelle `document.createElement` et ce
// dépôt n'a pas de jsdom.
import {
  PENTE_ARRIVEE,
  Y_CIBLE,
  DISTANCE_MAX_SURFACE,
  DISTANCE_MIN_SURFACE,
  ALT_PLANCHER_ORBITALE_M,
  altitudeOrbitaleM,
  altitudeSortieOrbiteM,
  distanceArrivee,
  distanceMinOrbitale,
  distancePourAltitude,
  distancePresentation,
  niveauDePlongee,
  planProche,
  poseCranContinu,
} from './loi-altitude.js'
// LE ZOOM CONTINU — Tâche M, « la mort des paliers ». Module PUR lui aussi ; il
// porte la loi mesurée par Adrien (un cran = ×√2), le franchissement de niveau
// sans table, et le changement d'unités qui rend ce franchissement invisible.
// ⚠️ **`modes.js` N'IMPORTE PAS `flags.js`** : il ne connaît le régime que par le
// crochet `hooks.zoomContinu()`, comme `globe.js` ne connaît `globeContinu` que
// par son constructeur.
import {
  PAS_CRAN,
  PAS_NIVEAU,
  facteurCran,
  franchissement,
  // ⛔ **`poseApresNiveau` N'EST PLUS IMPORTÉE ICI — Tâche R4.**
  // `poseFranchissement` l'appelle pour son compte et fait EN PLUS le
  // ré-ancrage sur la nouvelle cible. Garder les deux imports laisserait deux
  // façons d'écrire le même geste, dont une qui rouvre le saut de 10°.
  distancePourAltitudeFond,
  niveauDArrivee,
  // LA POSE — Tâche R4. Les deux lois vivent là-bas pour la même raison que les
  // précédentes : elles se vérifient sous node. Et celle du franchissement prend
  // les DEUX cibles, donc elle ne PEUT plus mélanger les repères — voir ses
  // §4 bis et §4 ter, qui portent le relevé image par image.
  poseFranchissement,
  poseFonduArrivee,
  // ⛔ **L'AVANCEMENT DU BALAYAGE EST UNE LOI, PAS TROIS LIGNES DANS `update`**
  // — Tâche R4, tour de correction. Écrite ici, elle était invérifiable : le
  // banc de `machine()` alimente un `dt` parfait de 1/60, où le plafond ne mord
  // jamais. Là-bas, elle se rejoue sur le `dt` RELEVÉ AU NAVIGATEUR.
  avancerFonduPose,
} from './monde/zoom-continu.js'

// Le pincement fabrique un faux événement de molette. _zoomGesture appelle
// preventDefault() sur plusieurs branches ; côté tactile, le vrai événement a
// déjà été traité au-dessus (c'est le pincement reconnu qui décide), donc ces
// branches n'ont plus rien à annuler.
const NOOP = () => {}

// ordered fine → coarse; zoom null = the user's fine zoom (≥ 12).
// Every stop on the way down lands on a matching real-terrain block instead of
// the globe: z7 @ 600 km, then the regional/local tiers. Corsica-sized views
// (~150 km) still get z8.
//
// ⚠️ LE PLANCHER EST z4 DEPUIS R27 (Adrien : « Il faudrait passer en mode orbite
// pour tout ce qui est supérieur à Z4 » — et « supérieur » désigne chez lui la
// vue la plus ÉLOIGNÉE). Il valait z3 depuis « Z1 et Z2 ne doivent pas
// exister ». Le filtre est appliqué ICI et sa règle vit dans escalier-zoom.js :
// la table brute reste lisible — la marche z3 ci-dessous est donc TOUJOURS
// écrite, et TOUJOURS filtrée — et changer d'avis sur le plancher ne demande de
// toucher qu'à `ZOOM_PALIER_MIN`.
//
// ⚠️ CE PARAGRAPHE A ÉTÉ FAUX DEUX FOIS. Il annonçait d'abord que z4 et z5
// avaient été RETIRÉS et que la porte orbitale s'ouvrait « au-dessus de
// 1 600 km » ; puis, la marche z3 ajoutée, que le palier le plus large était z3
// à 16 000 km. **Le palier le plus large est maintenant z4**, et sa marche de
// plongée est à 8 000 000 m.
//
// ⛔ **ET CE 8 000 000 m N'EST PAS LE SEUIL D'ORBITE.** C'est le seuil de
// PLONGÉE (orbite → surface), lu par `pickDiveTier`. La porte orbitale
// (surface → orbite) est GÉOMÉTRIQUE et prise dans l'autre sens : elle s'ouvre
// quand `getCoarsenTarget()` rend `null` et que le budget de niveau réclame un
// cran de plus. Les deux nombres ne sont pas la même grandeur ; celui de la
// porte est relevé au navigateur dans `rapport-R27.md`.
//
// `DIVE_ALT_M` (le seuil du zoom fin) ne bouge pas — c'est DIVE_TIERS[0], et lui
// n'a jamais été concerné.
export const DIVE_TIERS = paliersRetenus([
  { altM: 8000, zoom: null },
  { altM: 25000, zoom: 11 },
  { altM: 50000, zoom: 10 },
  { altM: 100000, zoom: 9 },
  { altM: 200000, zoom: 8 },
  { altM: 600000, zoom: 7 },
  { altM: 1600000, zoom: 6 },
  { altM: 4000000, zoom: 5 },
  { altM: 8000000, zoom: 4 },
  // ⚠️ CETTE MARCHE EST ÉCRITE ET FILTRÉE — R27. Elle a été ajoutée le jour où
  // z3 était le plancher (sans elle, le clic depuis l'orbite haute n'atteignait
  // jamais z3) ; depuis que le plancher vaut z4, `paliersRetenus` la retire. On
  // la garde parce que la table brute doit rester lisible et que le plancher est
  // le seul endroit où l'on décide — la retirer ferait deux sources pour une
  // seule règle. Le seuil d'altitude prolonge la progression géométrique de la
  // table (×2 par cran).
  { altM: 16000000, zoom: 3 },
])

// tier a settled zoom-in engages at `altM` meters — null above every tier
export function pickDiveTier(altM) {
  return DIVE_TIERS.find((t) => altM < t.altM) ?? null
}

// L'escalier de surface : UN palier à la fois, plafonné au zoom fin en montant,
// plancher au bloc régional z6 en descendant — au-delà c'est la porte orbitale
// qui prend le relais.
//
// Il avançait de DEUX paliers à la fois. C'était défendable tant que le relief
// fin s'arrêtait à z12 : un cran sur deux n'apportait rien de visible et chaque
// palier coûte un rechargement de DEM. Depuis Mapterhorn, chaque niveau porte
// de la vraie donnée, donc sauter un cran sur deux jetait la moitié du détail
// disponible (Adrien : « le zoom saute des étapes, il passe de 11 à 13 »).
//
// Et surtout, le pas de 2 n'était PAS symétrique : le retour se faisait aussi
// par 2 mais la montée était plafonnée au zoom fin, si bien qu'un aller-retour
// depuis un palier impair atterrissait un cran plus bas que le point de départ
// — on ne pouvait pas revenir au cadrage qu'on venait de quitter.
//
// La règle a déménagé dans escalier-zoom.js (pure, testée) ; ce nom reste parce
// que main.js et les tests l'appellent.
export const stepZoom = (zoom, dir, fine = 12) => pasEscalier(zoom, dir, fine)
const DIVE_ALT_M = DIVE_TIERS[0].altM
// ~9,4 rayons terrestres — la planète devient un petit objet dans le noir,
// façon Google Earth (Adrien : « laisse la possibilité de reculer plus ») ;
// l'ancien plafond (16 000 km, planète pleine trame) était trop court.
const MAX_ALT_M = 60000000
const MSG_MS = 3600

// ══════════ LE PLANCHER ORBITAL — RETIRÉ (Tâche 1b, Étape 3) ════════════════
//
// ⚠️ IL Y EN AVAIT DEUX, ET LE PLAN N'EN NOMMAIT QU'UN.
//   · `controls.minDistance = R_GLOBE + DIVE_ALT_M × 0,85 / ORBITAL_M_PER_UNIT`
//     dans `enterOrbit` — celui que le plan désignait ;
//   · le clamp de `orbAltTarget` à `DIVE_ALT_M × 0,9` (7 200 m), dans
//     `_zoomGesture` ET dans `_orbitNotch` — **celui qui mordait EN PREMIER**,
//     puisque 0,9 > 0,85. Retirer l'autre sans lui n'aurait rien changé.
// Tant que l'un des deux était là, la caméra ne pouvait PAS descendre en mode
// orbital : « de l'orbite au sol » était interdit par construction, pas par
// manque de code.
//
// La valeur vaut zéro et le zoom orbital est MULTIPLICATIF (`× exp(deltaY·k)`) :
// le plancher est donc asymptotique, jamais atteint, et `controls.update()`
// tient la caméra au-dessus de la sphère par `minDistance = R_GLOBE`.
const ORB_ALT_MIN = ALT_PLANCHER_ORBITALE_M / ORBITAL_M_PER_UNIT

// surface zoom is a CUSTOM inertial dolly (OrbitControls zoom is off): each
// wheel notch adds to a log-space velocity that decays slowly, so the élan
// coasts over many notches (Adrien: "au moins 20 crans"). A notch is small on
// purpose; the momentum (ZOOM_TAU) is what gives the long, smooth glide. The
// glide CLAMPS at the zone's near/far limit and never crosses a level on its
// own — a FRESH scroll while already pinned at the limit steps to the next
// level (Adrien: "le zoom s'arrête au max de la zone, on re-scroll pour passer").
const ZOOM_TAU = 1.2 // s — velocity decay time constant; big → the coast stretches far
const ZOOM_VEL_MAX = 1.3 // caps a fast burst
const ZOOM_STOP = 0.015 // velocity below which the coast is considered spent
const WHEEL_GAP_MS = 220 // a wheel event this long after the last starts a FRESH gesture
// ══════ LE CLIC EST UN GLISSÉ D'UN NIVEAU — R35 ══════════════════════════
//
// Un clic (orbite ou surface) rapproche la caméra d'UN niveau — `exp(−ln 2)`,
// le même `BUDGET_NIVEAU` que vingt crans de molette — en `DUREE_GLISSE_CLIC_S`
// secondes, en géométrique : le rapport image à image vaut au pire
// `2^(pas d'avancement)`, soit ×1,03 à 60 i/s, contre ×4,41 mesuré avant
// (`rapport-R35.md`). Google Earth fait de même sur un double-clic (D19).
const FACTEUR_CLIC = Math.exp(-PAS_NIVEAU)
const DUREE_GLISSE_CLIC_S = 0.9

// ══════════ LA DURÉE DU BALAYAGE DE POSE — Tâche R4 ═════════════════════════
//
// ⚠️ **ELLE SE DÉRIVE D'UN BUDGET PAR IMAGE, ELLE NE SE CHOISIT PAS AU GOÛT.**
// La plongée doit balayer `90° − atan(18/19) = 46,54816°` (le §4 ter de
// `monde/zoom-continu.js` porte le relevé, et cette valeur est EXACTE : c'est une
// identité géométrique, pas une concordance — l'écart au relevé du navigateur est
// à la treizième décimale). Avec la quadratique adoucie aux deux bouts, la
// vitesse de pointe vaut DEUX fois la moyenne : le plus grand pas d'une image à
// l'autre vaut donc `2 × 46,54816 / (durée × 60)` degrés à 60 Hz.
//
//   | durée | pas de pointe à 60 Hz |
//   | 0,5 s | 3,10° — encore un à-coup |
//   | 1,1 s | **1,41°** |
//   | 2,0 s | 0,78° — mais la caméra tient la main une seconde de trop |
//
// **1,1 s**, donc : c'est la plus courte qui tienne le pas de pointe sous 1,5°
// par image, l'ordre de grandeur d'un mouvement de caméra qu'on lit au lieu de
// le subir.
export const DUREE_FONDU_POSE_S = 1.1

// ══════ LE PLAFOND PAR IMAGE — Tâche R4, tour de correction ═════════════════
//
// ⛔ **LA DÉRIVATION CI-DESSUS NE VALAIT QU'À 60 Hz, ET LE PREMIER JET LE
// CACHAIT DERRIÈRE UN CALCUL RASSURANT.** Il écrivait : « le pire cas est borné
// quel que soit le débit d'images — `main.js` écrête `dt` à 0,05 s, soit 4,23° au
// pire ». **Un plafond de 4,23° ne « tient » pas un budget de 1,5°.** Et ce n'est
// pas théorique : descente rejouée par MOI en Chrome VISIBLE sur la RTX 3080
// d'Adrien (`node scripts/sonde-descente.mjs --visible 1`, trace
// `.banc/R4/r4c-gpu-avant.json`) → **pas de pointe 4,135° sur une image de 95 ms,
// et SIX pas au-dessus de 3° dans le même balayage.**
//
// ⚠️ **ET LA PRÉMISSE DU PREMIER JET ÉTAIT FAUSSE AUSSI** : « Chrome sans tête
// tourne en SwiftShader » — non. `WEBGL_debug_renderer_info`, relu par moi dans
// les deux configurations, rend la RTX 3080 des DEUX côtés
// (`.banc/R4/r4c-pilote-sanstete.json`). `--enable-unsafe-swiftshader` AUTORISE
// le repli logiciel, il ne l'impose pas. Le banc mesurait déjà le vrai GPU.
//
// ➡️ **ON BORNE DONC L'ANGLE PAR IMAGE, ET LE BALAYAGE S'ÉTIRE.** `1,5°` n'est
// pas un chiffre neuf : c'est **exactement le budget dont `DUREE_FONDU_POSE_S`
// est dérivée**, promu de vœu à invariant. La loi est `avancerFonduPose`
// (`monde/zoom-continu.js`, §4 quater) : le pas d'inclinaison vaut
// `46,54816° × Δe`, donc le plafonner est exact, pas approché.
export const PAS_POSE_MAX_DEG = 1.5

// ══════════ LE BUDGET DU NIVEAU VAUT EXACTEMENT UN CRAN — Tâche 2 bis ═══════
//
// the zone's own zoom budget (log-distance) — the glide CLAMPS here, it does not
// run to the physical near/far stop; a fresh re-scroll at the limit steps a level.
//
// ⚠️ **IL VALAIT 1,2 EN ENTRÉE ET 0,55 EN SORTIE, ET CES DEUX CHIFFRES SONT
// DEVENUS FAUX LE JOUR OÙ `_rescale` A CESSÉ DE TÉLÉPORTER.** Tant que chaque
// traversée d'étage reposait la caméra au point de présentation, le budget du
// niveau n'avait aucune conséquence géométrique : le cran effaçait tout. Depuis
// que l'altitude métrique est CONSERVÉE au cran (décision d'Adrien du
// 2026-08-20, « exactement comme Google Earth »), le budget du niveau et le pas
// de l'escalier doivent être LE MÊME NOMBRE, parce qu'un cran de zoom divise
// l'emprise du bloc par deux — soit `ln 2` de distance, et rien d'autre.
//
// ⚠️ MESURÉ, ET C'EST LE DÉFAUT v42 QUI REVIENT SI ON L'OUBLIE (Mont-Blanc,
// z5 → z15, `test/escalier-surface.test.js`) :
//   · budget 1,2 conservé  → le niveau descend ×3,32 quand le cran ne rend que
//     ×2 : la distance d'entrée s'écroule de 141 à 11,6 unités, la caméra vient
//     se coller au plancher `minDistance = 6` DÈS z8 et n'en repart plus. On
//     regarde alors de la donnée z9 (213 m le texel) depuis 4 km d'altitude,
//     avec un neuvième du bloc dans le cadre.
//   · budget `ln 2`        → la distance d'entrée se stabilise vers 77 unités,
//     le glissé va de 77 à 38, le cran la ramène à 77. Rien ne touche le
//     plancher, l'altitude est continue, et l'arrivée à z15 tombe à 418 m —
//     contre 487 m par l'ancien escalier téléporté.
//
// ⚠️ ET L'ENTRÉE ET LA SORTIE DOIVENT ÊTRE ÉGALES, sinon l'aller-retour
// CLIQUETTE. Mesuré : avec 1,2 en entrée et 0,55 en sortie, un cran de zoom
// suivi d'un cran de dézoom rend 14 326 m là où on était parti de 27 696 m —
// on revient DEUX FOIS PLUS BAS qu'avant d'avoir zoomé. À budgets égaux, le
// même aller-retour rend 26 876 m (×0,970, le résidu venant du `y = −0,3` de la
// cible). L'ancien escalier ne cliquettait pas parce que la téléportation
// remettait les deux directions au même point de présentation.
// ⛔ **ET CES DEUX-LÀ CONFONDAIENT DEUX GRANDEURS — Tâche M, D9.** Le paragraphe
// ci-dessus est juste sur UN point (le budget d'un NIVEAU DE MNT vaut `ln 2`,
// parce qu'un cran de zoom slippy divise l'emprise de la tuile par deux) et faux
// sur l'autre : il en concluait que le CRAN valait `ln 2` aussi.
//
// **Dix-neuf altitudes relevées par Adrien dans Google Earth**, 63 170 km →
// 126 km, 18 intervalles : **moyenne géométrique ×1,41256**, soit **√2 à 0,12 %
// près**. ➡️ **Un cran vaut ×√2, pas ×2.** La justification complète, l'écart-type
// et le piège de la « loi de moins en moins forte » vivent dans
// `monde/zoom-continu.js`.
//
// ⚠️ **LES DEUX NOMBRES RESTENT, MAIS SÉPARÉS** : `STEP_IN`/`STEP_OUT` sont LE
// CRAN (le geste de l'utilisateur, libre, mesuré) ; `BUDGET_NIVEAU` est le
// NIVEAU DE MNT (la grille de tuiles, pas un réglage). C'est leur confusion qui
// valait « deux fois trop ».
export const STEP_IN = PAS_CRAN // UN CRAN, ×√2 — la loi mesurée (D9)
export const STEP_OUT = PAS_CRAN // idem en dézoom — l'aller-retour doit revenir au point de départ

// LE BUDGET D'UN NIVEAU DE MNT. ⚠️ **Il n'est pas libre** : un niveau divise
// l'emprise du bloc par deux, donc `ln 2` de distance et rien d'autre. C'est lui
// que le glissé de l'ESCALIER borne (chemin plat) et lui que le franchissement
// automatique compte (chemin continu).
export const BUDGET_NIVEAU = PAS_NIVEAU

// ⚠️ « AU MOINS 20 CRANS » EST UNE CONTRAINTE D'ADRIEN, PAS UN EFFET DE BORD.
// Un défilement continu délivre `N × ZOOM_IMPULSE × ZOOM_TAU` de distance
// logarithmique : le niveau valait 1,2 / (0,05 × 1,2) = 20 crans de molette.
// Le budget ayant changé, l'impulsion est désormais DÉRIVÉE de lui pour que ce
// 20 ne bouge pas — la valeur littérale (0,05) l'aurait fait tomber à 11,5.
// ⚠️ **ET C'EST LE NIVEAU QUI LE DÉRIVE, PAS LE CRAN — Tâche M.** Le cahier des
// charges le dit : *« Le réglage porte sur le CRAN, pas sur le tour de molette :
// le nombre de crans par tour dépend de la souris. »* Dériver l'impulsion du
// cran aurait divisé la molette par deux au passage, ce que personne n'a
// demandé ; la dériver du niveau laisse la molette **au bit près** ce qu'elle
// était.
export const CRANS_PAR_NIVEAU = 20
// Le zoom d'orbite est en `exp(deltaY × k)` : `k` est exporté pour que le
// clic droit glissé et le double-clic (GE2) puissent y doser UN NIVEAU (×2) avec
// les mêmes crans qu'en surface — sinon 20 crans de 100 y feraient ×9.
export const ORB_ZOOM_LOG_PAR_DELTA = 0.0011
/** Le `deltaY` d'orbite qui vaut un cran de surface : 20 crans = ×2 des deux côtés de la traversée. */
export const ORB_CRAN_DELTA_Y = Math.log(2) / CRANS_PAR_NIVEAU / ORB_ZOOM_LOG_PAR_DELTA
const ZOOM_IMPULSE = BUDGET_NIVEAU / (CRANS_PAR_NIVEAU * ZOOM_TAU) // ≈ 0,0289 log-dist/s par cran

// ══════════ LA POUSSÉE DE SORTIE DU CROP — Tâche SORTIE, D21 ① ══════════════
//
// > **Adrien, 2026-09-04 :** les sorties du crop sont désormais DEUX — le dézoom
// > à la molette et le bouton « map monde ». La molette DOIT donc sortir.
//
// ⛔ **MESURÉ AVANT DE TOUCHER À QUOI QUE CE SOIT** (`.banc/SORTIE/avant-*.json`,
// un cran par lecture, 8 chargements) : **161 à 162 crans** pour tuer le crop
// depuis 466 m, dont **23 morts d'affilée** (crans 21 à 43 : `d` collée à
// `maxDistance = 150`, altitude figée à **616 m**, `_levelZoom` qui monte de
// 0,01 à 0,68 sans qu'un mètre soit parcouru). Ce n'est PAS le pas de molette :
// c'est le plafond `maxDistance` qui clippe le mouvement pendant que le compteur
// encaisse l'intention (R23), et le franchissement qui CONSERVE l'altitude.
//
// ➡️ **D'où la direction B du brief, et pas la A.** Grossir le pas ne rachète
// rien contre un plafond : au bout du niveau la caméra est immobile quelle que
// soit la taille du cran, et le franchissement qui la libère ne gagne pas
// d'altitude. La sortie est donc un GESTE À PART, armé par une intention
// confirmée, qui **pompe l'intention** (le seul levier que le plafond ne clippe
// pas) jusqu'à ce que la loi du crop, elle, tranche : `sortieArmee` est déjà
// vraie dès le premier cran, il ne manquait que l'altitude.
//
// ⚠️ **LE PAS DE MOLETTE N'EST PAS TOUCHÉ D'UN BIT** — `ZOOM_IMPULSE`,
// `ZOOM_TAU`, `CRANS_PAR_NIVEAU` sont ceux d'hier. D19 (noté 9,75) tient parce
// que le zoom ordinaire n'a pas changé de loi : la poussée est un second geste,
// pas un réglage du premier.
/** Le taux de pompage de l'intention, en log-distance par seconde. Un niveau
 *  (`ln 2`) toutes les 0,23 s : assez franc pour être une sortie, assez lent
 *  pour que l'escalier ait le temps de franchir (il se garde lui-même). */
export const TAUX_SORTIE_LOG_S = 6
/** ⛔ La poussée ne dure JAMAIS plus que ça, même si le crop refuse de mourir :
 *  une course qui tient la caméra sans fin serait pire que le défaut. */
export const DUREE_SORTIE_MAX_S = 6

// ══════════ PORTE — LA SORTIE NE DOIT PAS ÊTRE UNE ÉJECTION ═════════════════
//
// ⚡ **MESURÉ, 8 chargements** (`.banc/PORTE/avant-retour-8.json`, un cran par
// lecture, aller PUIS retour) : la molette **sort en 8 à 10 crans** — c'est le
// gain de SORTIE, et il tient — mais elle **rentre en 21 à 32 crans**, deux fois
// et demie à trois fois et demie plus cher. ⛔ **La porte n'est pas à sens unique
// (le crop renaît 8/8), elle est à PENTE.**
//
// **La cause n'est ni la renaissance ni son seuil** — c'est le SURVOL de la
// sortie. Le crop meurt entre **41 119 et 58 160 m**, puis la caméra continue
// jusqu'à **45 555 – 63 890 m** au repos, c'est-à-dire jusqu'à **deux fois le
// seuil de naissance** (32 274 m). Chacun de ces mètres, l'utilisateur les
// repaie au retour : `ln(63 890 / 32 274) / 0,0347` = **19,7 crans** rien que
// pour effacer un survol qu'il n'a pas demandé.
//
// ⛔ **ET LE SURVOL EST ÉCRIT EN TOUTES LETTRES : c'était `MARGE_SORTIE = 1,6`
// de `main.js`.** La poussée VISAIT `1,6 × SEUIL_MORT_M` = **64 549 m** — très
// exactement le 63 890 m relevé. SORTIE la croyait « sans effet, puisque la
// poussée est arrêtée à la mort du crop » ; la mesure dit le contraire, parce
// que le budget est en **log-DISTANCE** et que les franchissements CONSERVENT
// l'altitude : le budget ne sait pas où il en est en altitude, il ne peut donc
// pas s'arrêter au bon endroit.
//
// **Et la seconde moitié du survol est une image de trop.** L'application tourne
// ici à ~16 images/s pendant la course (`dt ≈ 0,06 s`) : un pas vaut
// `6 × 0,06 = 0,36` nat, c'est-à-dire **×1,43 d'altitude EN UNE IMAGE**. Le
// dernier pas passait donc le seuil de 43 % d'un coup. C'est ce qui explique
// l'étalement des morts relevées (41 119 → 58 160 m) : ce n'est pas du bruit,
// c'est la taille de la dernière marche.
//
// ➡️ **LA POUSSÉE S'ARRÊTE DÉSORMAIS SUR L'ALTITUDE, PAS SUR SON BUDGET — et
// elle RÉGLE SON DERNIER PAS DESSUS.** `armerPousseeSortie` prend un `reste()`,
// lu à chaque image, qui rend **ce qui manque en log-altitude** pour que le crop
// meure. Zéro ou moins : la course s'arrête. Sinon le pas de l'image est
// **écrêté à ce reste**, ce qui supprime la dernière marche sans toucher au taux.
//
// ⚠️ **ET C'EST POURQUOI CE N'EST PAS UN PLAFOND DE PAS FIXE.** Un
// `PAS_SORTIE_MAX_LOG = 0,12` a été écrit, mesuré, puis **retiré** : il borne
// bien le survol (mort à 40 366 – 41 654 m, 8/8) mais il divise le taux par
// trois quand `dt` vaut 0,06 s, et la sortie passe de 8-9 crans à **15-40**.
// ⛔ C'est la moitié du critère perdue pour racheter l'autre. Écrêter au RESTE
// donne les deux : pleine vitesse tant qu'il reste du chemin, pas d'à-coup au
// bout.

// task 30 Fix A: the isometric-ish viewing angle every dive/refine arrival
// has always used (camera.position(0,18,19), looking at (0,-0.3,0)) — kept
// as a fixed DIRECTION so the new far-standoff arrival (_arrivalPose()
// below) still frames the block the same way, just from farther back.
const _ARRIVAL_DIR = new THREE.Vector3(0, PENTE_ARRIVEE.y, PENTE_ARRIVEE.z).normalize()

export class Modes {
  /**
   * hooks: {
   *   setSurfaceVisible(bool), setEffectsEnabled(bool),
   *   getSurfaceLatLon() → {lat, lon},
   *   surfaceCamAltMeters() → number,
   *   loadSurface(lat, lon, zoom?) → Promise (resolves when terrain is rebuilt),
   *   surfaceMaxDistance() → number (controls.maxDistance in surface mode),
   *   getFineZoom() → number (user's detail zoom, ≥ 12),
   *   getRefineTarget() → {lat, lon, zoom} | null (next finer scale under the
   *     current view, null when already at fine scale),
   *   getCoarsenTarget() → {lat, lon, zoom} | null (next wider scale, null
   *     once the patch is z8 — then zooming out opens the orbit gate),
   *   sampleGroundY(x, z) → number (optional; terrain height at a world XZ —
   *     used by _arrivalPose()'s clearance guard, see its own comment),
   * }
   */
  constructor({ camera, controls, globe, domElement, hooks }) {
    this.mode = 'surface'
    this.camera = camera
    this.controls = controls
    this.globe = globe
    this.hooks = hooks
    this.altM = 0 // displayed altitude (meters)
    this.orbAlt = 0 // orbital altitude in scene units (current)
    this.orbAltTarget = 0
    this.busy = false
    this.locked = false // embed « zone de test » : molette neutralisée (voir wheel)
    this.travel = null // great-circle glide tween
    this._surfCam = { near: camera.near, far: camera.far }
    this._zoomVel = 0 // surface inertial dolly velocity (log-dist units/s)
    this._zoomNdc = new THREE.Vector2() // cursor NDC of the last wheel notch
    this._zoomPivot = null // world point the coast zooms toward (last valid)
    this._lastWheelT = 0 // ms of the last wheel event — a big gap means a fresh gesture
    this._levelZoom = 0 // log-distance dépensée dans le niveau ; COMPTEUR sous le drapeau, butée sinon
    this._sortieCourse = null // la poussée de sortie du crop — {restant, t, depart}, voir armerPousseeSortie
    this._empriseVue = null // l'emprise du bloc à l'image précédente — voir _suivreEmprise
    this._fonduPose = null // le balayage nadir → oblique — voir _armerFonduPose
    // ⚡ **LA VUE DE TROIS QUARTS ATTEND LE BLOC — D16 ter, étape 5.**
    // Vrai depuis la traversée jusqu'à l'arrivée sur le bloc : pendant tout ce
    // temps la caméra garde l'axe de l'orbite. Voir `_attendreLeBloc`.
    this._attenteTroisQuarts = false
    // ⚡ **ET LE CHEMIN INVERSE — D16 ter, symétrique.** Vrai tant que le crop
    // est posé, c'est-à-dire tant qu'on est SUR le bloc. Son front descendant
    // rend la vue au nadir : voir `_armerRetourNadir`.
    this._etaitSurLeBloc = false

    this._buildDom()

    // orbital zoom is proportional to altitude (Google-Earth feel) — we take
    // over the wheel entirely while in orbit
    domElement.addEventListener('wheel', (e) => this._zoomGesture(e), { passive: false })

    // LE DOIGT emprunte le MÊME escalier que la molette. Un pincement n'est pas
    // traduit en dolly : gestes.js le convertit en crans de molette, et ils entrent
    // par _zoomGesture — donc mêmes paliers de relief, mêmes butées, même élan.
    // Rendre son pincement natif à OrbitControls (enableZoom) aurait fait
    // l'inverse : la caméra s'approche d'une géométrie qui reste grossière,
    // parce que rien ne serait jamais passé par _refine().
    this._pinch = new PinchTracker()
    const pts = (e) => [...e.touches].map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }))
    domElement.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) this._pinch.start(pts(e)) }, { passive: true })
    domElement.addEventListener(
      'touchmove',
      (e) => {
        const m = this._pinch.move(pts(e))
        if (!m) return
        // reconnu comme pincement : on empêche le navigateur d'en faire son
        // propre zoom. On ne touche à RIEN d'autre — le déplacement à deux
        // doigts appartient à OrbitControls, sur ce même élément.
        if (e.cancelable) e.preventDefault()
        // ⚡ **D21 ① — LE PINCEMENT EST UN ZOOM, DONC UNE INTENTION.**
        // ⛔ **ET IL NE PASSE PAR AUCUN ÉVÉNEMENT `wheel` DU DOM** : il en
        // FABRIQUE un faux et le donne à `_zoomGesture` directement (c'est la
        // ligne suivante). L'écouteur `wheel` de `main.js`, où les trois autres
        // gestes de zoom arment la sortie du crop, ne le voit donc jamais —
        // sans ce crochet, un pincement d'écartement sur tablette ne pourrait
        // PLUS sortir du crop, et il ne resterait que le bouton monde.
        this.hooks.intentionZoom?.(m.deltaY)
        this._zoomGesture({ deltaY: m.deltaY, clientX: m.clientX, clientY: m.clientY, preventDefault: NOOP })
      },
      { passive: false }
    )
    const finDuGeste = (e) => { if (e.touches.length < 2) this._pinch.end() }
    domElement.addEventListener('touchend', finDuGeste, { passive: true })
    domElement.addEventListener('touchcancel', finDuGeste, { passive: true })
  }

  // ══════════ LE RÉGIME CONTINU — Tâche M ═══════════════════════════════════
  //
  // ⚠️ **UN CROCHET, RAPPELÉ À CHAQUE LECTURE — PAS UN BOOLÉEN FIGÉ À LA
  // CONSTRUCTION.** Une tâche de ce chantier a trouvé un test faible qui passait
  // le globe PAR SA VALEUR alors que la production le passe PAR UNE FONCTION :
  // la faute était invisible sous la seule forme que la production n'emploie
  // pas. Ici la production passe une fonction, et les bancs aussi.
  _continu() {
    return this.hooks.zoomContinu?.() === true
  }

  // L'ALTITUDE QUE LA CAMÉRA DE FOND OCCUPE, EN MÈTRES — `camY × emprise / span`.
  //
  // ⚠️ **C'EST LA SEULE GRANDEUR DONT UN SAUT SE VOIT À L'ÉCRAN** sous
  // `?terre=unique` : la caméra visible est celle que la similitude de
  // `monde/frontiere-rendu.js` produit, et son facteur est HORIZONTAL. Les deux
  // autres altitudes de ce fichier (`this.altM`, `_altitudeCadrageM()`) portent
  // l'exagération verticale, donc elles ne la voient pas.
  _altitudeFondM() {
    const emprise = this.hooks.empriseBlocM?.()
    const span = this.hooks.coteBloc?.()
    if (!(emprise > 0) || !(span > 0)) return null
    return (this.camera.position.y * emprise) / span
  }

  // ══════════ LA CAMÉRA SUIT L'UNITÉ DU BLOC, IMAGE PAR IMAGE ══════════════
  //
  // ⚠️ **C'EST ICI ET PAS DANS `_rescale`, ET LA RAISON EST MESURÉE.** Le dépôt
  // reposait la caméra APRÈS le chargement ; or `main.js` documente, journal par
  // image à l'appui, que **`largeurBlocM()` est divisée par deux UNE IMAGE AVANT
  // que `_rescale` ne double `camera.position.y`**. Entre les deux, l'altitude
  // lue vaut exactement LA MOITIÉ de la vraie — c'est ce qui a produit **onze
  // bascules du seuil du socle au lieu d'une**, et sous `?terre=unique` cela
  // ferait clignoter la planète entière à chaque cran.
  //
  // En suivant l'emprise image par image, la conversion tombe sur la MÊME image
  // que le changement, **quel qu'en soit l'auteur** : cran, plongée, vol,
  // template, ou l'arrivée du MNT derrière la fenêtre (écart mesuré 6,9·10⁻⁵ à
  // z12, 3,5 % à z5 — un vrai changement d'unité, pas du bruit).
  //
  // ⚠️ **ET C'EST UNE CONVERSION D'UNITÉS, PAS UNE REPOSITION.** L'invariant est
  // `camY × emprise`, c'est-à-dire l'altitude que la caméra de FOND occupe. La
  // pente traverse inchangée : l'angle de vue de l'utilisateur est gardé.
  //
  // ⛔ **ET LA PENTE NE TRAVERSAIT PAS — 10,4° DE PERDUS AU CRAN z3 → z4,
  // MESURÉS À L'ÉCRAN — Tâche R4.** La phrase ci-dessus était juste tant que la
  // CIBLE ne bougeait pas ; or `_rescale` écrit la visée du nouveau bloc AVANT
  // d'appeler ce suiveur, et la direction se relisait alors sur le couple
  // dépareillé `caméra(repère d'avant) − cible(repère d'après)`. Le relevé image
  // par image est dans le §4 bis de `monde/zoom-continu.js`.
  //
  // ➡️ **`cibleAvant` EST LA RÉPARATION, ET C'EST LE SEUL ARGUMENT.** Quand
  // l'appelant sait que la cible vient de changer de repère, il donne
  // l'ANCIENNE : la direction se lit sur le couple accordé, et la caméra se
  // repose sur la nouvelle cible le long de cette direction-là. Sans argument,
  // le comportement est celui d'avant, au caractère près — c'est le chemin par
  // image, où rien n'a bougé de repère.
  //
  // ⚠️ **AVEC `cibleAvant`, ON REPOSE MÊME À EMPRISE ÉGALE**, et ce n'est pas
  // une prudence : pendant l'`await` du chargement, le suiveur PAR IMAGE a pu
  // voir passer la nouvelle emprise et l'avoir déjà convertie. Sortir sur
  // `avant === emprise` laisserait alors la caméra ancrée sur l'ancienne cible,
  // c'est-à-dire exactement le défaut, une image plus tard.
  _suivreEmprise(cibleAvant = null) {
    const emprise = this.hooks.empriseBlocM?.()
    const avant = this._empriseVue
    if (!(emprise > 0)) { this._empriseVue = null; return }
    this._empriseVue = emprise
    if (!this._continu() || this.mode !== 'surface') return
    if (!(avant > 0) && !cibleAvant) return
    if (avant === emprise && !cibleAvant) return
    const c = this.controls
    const cible = c.target
    const pose = poseFranchissement({
      camera: this.camera.position,
      cibleAvant: cibleAvant ?? cible,
      cibleApres: cible,
      // ⚠️ **SANS EMPRISE MÉMORISÉE, ON RÉ-ANCRE SANS CONVERTIR** — Tâche R4.
      // Le ré-ancrage sur la nouvelle cible et la conversion d'unités sont deux
      // gestes distincts qui tombent au même endroit ; ignorer le second n'est
      // pas une raison de sauter le premier, sans quoi la caméra resterait
      // accrochée à une cible qui n'existe plus. `emprise / emprise = 1` :
      // l'altitude traverse à l'identique, ce qui est exactement juste ici.
      empriseAvant: avant > 0 ? avant : emprise,
      empriseApres: emprise,
      distanceMin: c.minDistance,
      distanceMax: c.maxDistance,
    })
    if (!pose) return // caméra sur la cible, ou visée rasante : rien à reposer
    this.camera.position.set(pose.x, pose.y, pose.z)
    c.update()
  }

  // Le niveau d'arrivée, DÉDUIT de l'altitude de fond — sans table de paliers.
  _niveauDArrivee(altM) {
    const empriseAuZoom = this.hooks.empriseBlocMAuZoom
    const span = this.hooks.coteBloc?.()
    if (typeof empriseAuZoom !== 'function' || !(span > 0)) return null
    return niveauDArrivee({
      altM,
      empriseAuZoom,
      span,
      // ⚠️ **LE PLANCHER EST z4, ICI AUSSI — R32.** `niveauDArrivee` porte un
      // `zoomMin = 3` par défaut, et l'attaquant R33 l'a attrapé : la molette
      // depuis l'orbite plongeait sur un bloc **z3 à 11 900 km** malgré
      // `ZOOM_PALIER_MIN = 4` (R27 : « il faudrait passer en mode orbite pour
      // tout ce qui est supérieur à Z4 »). Le plancher est unique, et c'est lui.
      zoomMin: ZOOM_PALIER_MIN,
      zoomMax: this.hooks.getFineZoom(),
      pente: _ARRIVAL_DIR.y,
      yCible: Y_CIBLE,
      distanceMin: DISTANCE_MIN_SURFACE,
      // ⚠️ **LA MOITIÉ DU PLAFOND, ET CE N'EST PAS UNE MARGE DE CONFORT.**
      // Un niveau s'explore de `d₀/2` (on affine) à `2 d₀` (on élargit) : sans
      // ce demi, `2 d₀` dépasserait `maxDistance` et le glissé se ferait CLIPPER
      // avant d'avoir dépensé son niveau — la butée reviendrait par la fenêtre,
      // en haut cette fois. Le 0,94 est celui de `distanceArrivee` et pour la
      // même raison écrite là-bas : rester sous la butée dure pour que
      // `controls.update()` ne re-clampe pas immédiatement.
      distanceMax: distanceArrivee(this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE) / 2,
    })
  }

  // ══════════ LE FRANCHISSEMENT AUTOMATIQUE — CE QUI TUE LE CRAN ════════════
  //
  // ⛔ **C'EST LE GESTE QUE LE DÉPÔT DEMANDAIT À L'UTILISATEUR DE FAIRE.** Le
  // glissé butait sur le budget du niveau, rendait la main, et il fallait
  // **re-défiler** pour franchir (`atInLimit` → `_refine`). Adrien : *« vire
  // absolument ton système de saut de niveau !!! »*
  //
  // Ici le budget n'est plus une butée mais un COMPTEUR : dès qu'il vaut un
  // niveau plein, on franchit, et le compteur repart de son reste. L'hystérésis
  // est celle de la troncature (`franchissement`), donc symétrique et sans
  // seuil à régler.
  _franchirSiBesoin() {
    // ⚠️ **ET PAS PENDANT LE BALAYAGE DE POSE — Tâche R4.** Un franchissement
    // écrit une nouvelle cible et repose la caméra ; lancé au milieu du
    // balayage, il se battrait avec lui pour la même caméra, image par image.
    // Le compteur de budget, lui, TRAVERSE : le niveau se franchit à l'image
    // suivant la fin du balayage, sans rien perdre.
    if (!this._continu() || this.busy || this.travel || this._diveTween || this._fonduPose) return
    const { niveaux } = franchissement(this._levelZoom, BUDGET_NIVEAU)
    if (niveaux === 0) return
    // ⛔ **UN NIVEAU PAR APPEL, ET LE RESTE RESTE — Tâche R29.** Les cinq lignes
    // ci-dessus promettent « le niveau se franchit à l'image suivant la fin du
    // balayage, SANS RIEN PERDRE » ; `= reste` ne tenait pas cette promesse.
    // Mesuré au navigateur sur le bouton « − » (`.banc/R29/avant-bouton-*.json`,
    // un clic par image) : le balayage de retour au nadir de D16 ter s'arme sur
    // la mort du crop et dure **130 images (2,2 s)** ; pendant ce temps le
    // compteur encaisse l'intention de chaque clic et monte à **9,01**, soit
    // **treize niveaux**. `reste` valait alors 0,0 : le premier franchissement
    // d'après le balayage en dépensait UN et **jetait les douze autres**. La
    // caméra restait collée à `d = 149,9 / plafond 150`, l'altitude figée à
    // 133 876 m, `z` bloqué à 10 — c'est le relevé du brief R29, mot pour mot.
    //
    // ⚠️ **ET C'EST IDENTIQUE AU BIT QUAND UN SEUL NIVEAU EST DÛ** : `reste`
    // vaut alors `budget − 1 × pas`, exactement ce que la ligne retranche. La
    // différence ne vit QUE dans le cas à plusieurs niveaux, c'est-à-dire le
    // défaut. `update()` rappelle `_franchirSiBesoin` à chaque image, donc le
    // niveau suivant part dès que le rechargement rend la main.
    if (niveaux > 0) {
      // ⚠️ **ON NE DÉPENSE LE BUDGET QUE SI LE NIVEAU EXISTE.** Au zoom fin il
      // n'y a plus rien à affiner : laisser le compteur courir est CORRECT — il
      // faudra le remonter d'autant pour élargir, et l'aller-retour reste
      // symétrique. Le retrancher rendrait le retour asymétrique.
      if (!this.hooks.getRefineTarget()) return
      this._levelZoom += BUDGET_NIVEAU
      this._refine()
      return
    }
    if (this.hooks.getCoarsenTarget()) {
      this._levelZoom -= BUDGET_NIVEAU
      this._coarsen()
      return
    }
    // plus de niveau plus large : la porte orbitale, et elle est SANS RIDEAU
    this._levelZoom -= BUDGET_NIVEAU
    this.enterOrbit()
  }

  // ══════════ UN CRAN, ET UN SEUL GESTE POUR LES DEUX MONDES ════════════════
  //
  // ⛔ **`_orbitNotch` EST MORT AVEC SON 1,7.** Ce facteur n'avait aucune source :
  // il était choisi. Le cran vaut ×√2 — mesuré par Adrien sur Google Earth — et
  // c'est la MÊME loi en orbite et en surface, ce qui est la moitié de « une
  // seule caméra, de l'orbite au sol ».
  cranZoom(dir) {
    if (this.travel || this._diveTween) return
    const f = facteurCran(dir)
    // ══════ LE CRAN SURVIT AU CHARGEMENT, COMME LE GLISSÉ — Tâche R29 ══════
    //
    // ⛔ **`busy` JETAIT LE CLIC, ET C'EST LE FAIT ① DU BRIEF R29.** Le glissé
    // inertiel a été explicitement exempté de `busy` sous le drapeau
    // (`update()` : « le glissé survit au chargement — et c'est la troisième
    // moitié du cran ») ; le BOUTON « − » ne l'était pas. Mesuré : huit
    // `cranZoom(-1)` d'affilée n'avancent que d'UN niveau, **sept clics sur
    // huit disparaissent** — un `_rescale` dure des centaines de millisecondes
    // et `busy` y est levé tout du long.
    //
    // ⚠️ **ON ENCAISSE L'INTENTION, ON N'ÉCRIT PAS LA CAMÉRA.** Pendant le
    // rechargement la caméra appartient à `_rescale` (il pose la cible
    // d'arrivée et convertit les unités) : lui disputer `camera.position`
    // image par image est exactement ce que la garde de `_franchirSiBesoin`
    // interdit. Le compteur, lui, TRAVERSE — c'est déjà sa règle.
    if (this.busy) {
      if (this.mode !== 'surface' || !this._continu()) return
      const intention = Math.log(f) // < 0 en zoom avant, comme `_levelZoom`
      // même asymétrie que `_applyZoom` et que la suite de cette fonction :
      // vers l'extérieur un niveau existe toujours ; vers l'intérieur, au zoom
      // fin, il n'y a plus rien à affiner et le compteur ne doit pas courir.
      if (intention > 0 || !!this.hooks.getRefineTarget?.()) this._levelZoom += intention
      return
    }
    if (this.mode === 'orbital') {
      if (dir > 0) this._diveArmed = true // inward intent arms the dive, like the wheel
      this.orbAltTarget = THREE.MathUtils.clamp(
        this.orbAltTarget * f,
        ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
        MAX_ALT_M / ORBITAL_M_PER_UNIT
      )
      return
    }
    if (!this._continu()) {
      // chemin plat (sauvegarde gelée) : le bouton garde l'escalier de paliers
      if (dir > 0) this._refine()
      else if (this.hooks.getCoarsenTarget()) this._coarsen()
      else this.enterOrbit()
      return
    }
    const c = this.controls
    const dist = c.getDistance()
    const voulue = dist * f
    const nouvelle = THREE.MathUtils.clamp(voulue, c.minDistance, c.maxDistance)
    // ══════ LE BUDGET COMPTE L'INTENTION ICI AUSSI — R27 ═══════════════════
    //
    // ⛔ **R23 A CORRIGÉ `_applyZoom` ET A LAISSÉ CE CHEMIN-CI, ET LA MESURE
    // L'ATTRAPE.** Rejoué au navigateur sous le protocole de R27
    // (`.banc/R27/avant2.json`, remontée pilotée par `cranZoom`) : la caméra se
    // colle à `d = 150 / plafond 150`, `log(nouvelle/dist)` vaut alors **zéro**,
    // le compteur de niveau gèle, `_franchirSiBesoin` ne franchit plus rien —
    // **1 174 images, bloqué à z8, l'orbite JAMAIS atteinte.** C'est le défaut
    // §④ de R23, mot pour mot, sur le chemin qu'elle n'avait pas mesuré : le
    // BOUTON et le PINCEMENT, pas la molette.
    //
    // ➡️ Même règle, même asymétrie, même justification que là-bas : vers
    // l'extérieur un niveau existe toujours (un cran plus large, ou la porte
    // orbitale) ; vers l'intérieur, au zoom fin, il n'y a plus rien à affiner et
    // laisser courir le compteur en ferait un compteur qui ne se dépense jamais.
    let dBudget = Math.log(Math.max(nouvelle, 1e-6) / Math.max(dist, 1e-6))
    if (nouvelle !== voulue) {
      const intention = Math.log(Math.max(voulue, 1e-6) / Math.max(dist, 1e-6))
      if (intention > 0 || !!this.hooks.getRefineTarget?.()) dBudget = intention
    }
    this._levelZoom += dBudget
    _zoomDir.copy(this.camera.position).sub(c.target).normalize()
    this.camera.position.copy(c.target).addScaledVector(_zoomDir, nouvelle)
    c.update()
    this._franchirSiBesoin()
  }

  // UN cran de zoom, d'où qu'il vienne — molette ou pincement. `e` doit porter
  // deltaY, clientX, clientY et preventDefault().
  _zoomGesture(e) {
    // boutique/embed « zone de test » (Adrien) : le visiteur zoome et
    // dézoome LIBREMENT dans 100 % du budget de zoom du niveau (le glissé
    // inertiel se clampe tout seul, voir _applyZoom) — mais ne peut JAMAIS
    // franchir un niveau ni changer de zone : les branches refine/coarsen/
    // orbit sont neutralisées plus bas. flyTo n'est pas bridé (c'est lui
    // qui pose la zone et les vues iso).
    if (this.locked && this.mode !== 'surface') { e.preventDefault(); return }
    if (this.mode === 'surface') {
      // pendant le suivi de tête GPX, la molette pilote le STANDOFF de la
      // caméra de suivi (zoom/dézoom autour de la tête) — pas l'escalier
      if (this.hooks.followWheel?.(e.deltaY)) { e.preventDefault(); return }
      // LE CADRAGE DU DAMIER TIENT LA MOLETTE (voir vue-ensemble.js et le bloc
      // `cadreLeDamier` de main.js). Tant que le cumul de dézoom n'atteint pas
      // le seuil, le cran est avalé : le bouton caméra vient de cadrer tout le
      // damier, et un cran réflexe ne doit pas défaire ce qu'on demandait. Dès
      // que l'utilisateur insiste, le hook rend `false` APRÈS avoir remis
      // `controls.maxDistance` — sans quoi la butée lue trois lignes plus bas
      // serait celle du cadrage, pas la vraie.
      if (this.hooks.cadrageWheel?.(e.deltaY)) { e.preventDefault(); return }
      if (this._diveTween || this.busy) return
      e.preventDefault()
      const now = performance.now()
      const fresh = now - this._lastWheelT > WHEEL_GAP_MS // a new gesture, not a continuous scroll
      this._lastWheelT = now
      const dist = this.controls.getDistance()
      const inward = e.deltaY < 0
      // "at the zone limit" = the level's zoom budget is spent (or the
      // physical near stop / far stop is reached anyway)
      // ⛔ **SOUS LE DRAPEAU, LES DEUX BUTÉES N'EXISTENT PLUS — Tâche M.** Elles
      // SONT le cran qu'Adrien décrit : le glissé s'arrêtait au bout du niveau
      // et il fallait re-défiler pour franchir. Le franchissement est désormais
      // automatique (`_franchirSiBesoin`, appelé par `_applyZoom`), donc ces deux
      // branches n'ont plus rien à déclencher.
      const continu = this._continu()
      const atInLimit = !continu && (this._levelZoom <= -BUDGET_NIVEAU + 0.03 || dist <= this.controls.minDistance * 1.02 || this.hooks.nearGround?.())
      const atOutLimit = !continu && (this._levelZoom >= BUDGET_NIVEAU - 0.03 || dist >= this.controls.maxDistance * 0.98)
      // GUARD-RAIL (Adrien): the glide stops at the zone limit; a FRESH
      // re-scroll while already pinned there is what steps to the next level.
      if (fresh && inward && atInLimit) {
        if (this.locked) return // zone de test : on butte au plancher, pas de plongée
        this._resetZoom()
        this._refine()
        return
      }
      if (fresh && !inward && atOutLimit) {
        if (this.locked) return // zone de test : on butte au plafond, ni recul ni orbite
        this._resetZoom()
        if (this.hooks.getCoarsenTarget()) this._coarsen()
        else this.enterOrbit()
        return
      }
      // otherwise just feed the inertial glide — it clamps at the limit and
      // never crosses a level on its own (see _applyZoom).
      this._zoomVel = THREE.MathUtils.clamp(
        this._zoomVel + Math.sign(-e.deltaY) * ZOOM_IMPULSE,
        -ZOOM_VEL_MAX,
        ZOOM_VEL_MAX
      )
      // ══════ LA MOLETTE ZOOME VERS LE POINT AU CENTRE DE L'ÉCRAN — D19 ═══
      //
      // > **Adrien, 2026-09-01 :** *« quand je scrolle pour zoomer ou dézoomer,
      // > je scrolle vers le point visé au centre de l'écran »*.
      //
      // ⛔ Le pivot était le point sous le CURSEUR (`e.clientX/Y`). D19 le
      // remplace par le point du cadre : la surface au milieu de l'écran, quelle
      // que soit la position de la souris — Google Earth Pro fait de même.
      // Quand la vue passe par le centre de la Terre (nadir, hors du crop),
      // c'est le zoom radial de R29 bis ; quand elle est inclinée (sur le crop),
      // c'est le point du cadre qui gagne, et il diffère de la cible dès que le
      // relief passe entre les deux. `_applyZoom` garde le prédicat hors crop.
      this._zoomNdc.set(0, 0)
      const p = this.hooks.pointUnder?.(this._zoomNdc.x, this._zoomNdc.y)
      if (p) this._zoomPivot = p // fixed pivot for the whole coast (zoom toward the frame's centre)
      return
    }
    e.preventDefault()
    if (this.busy || this.travel) return
    if (e.deltaY < 0) this._diveArmed = true // inward intent arms the dive
    const f = Math.exp(e.deltaY * ORB_ZOOM_LOG_PAR_DELTA)
    this.orbAltTarget = THREE.MathUtils.clamp(
      this.orbAltTarget * f,
      ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
      MAX_ALT_M / ORBITAL_M_PER_UNIT
    )
  }

  // ---------------------------------------------------------------- DOM

  _buildDom() {
    const alt = document.createElement('div')
    alt.className = 'altimeter'
    alt.innerHTML = '<span class="alt-mode">SURFACE</span><span class="alt-value">— m</span>'
    document.body.appendChild(alt)
    this.altEl = alt
    this.altModeEl = alt.querySelector('.alt-mode')
    this.altValueEl = alt.querySelector('.alt-value')

    const msg = document.createElement('div')
    msg.className = 'fui-msg hidden'
    document.body.appendChild(msg)
    this.msgEl = msg
    this._msgTimer = 0

    const white = document.createElement('div')
    white.className = 'whiteout'
    document.body.appendChild(white)
    this.whiteEl = white
  }

  announce(text) {
    this.msgEl.textContent = text
    this.msgEl.classList.remove('hidden')
    clearTimeout(this._msgTimer)
    this._msgTimer = setTimeout(() => this.msgEl.classList.add('hidden'), MSG_MS)
  }

  // ⛔ **LE RIDEAU EST LE SAUT LE PLUS VISIBLE DE TOUS — 480 ms d'aller, 480 ms
  // de retour, à chaque traversée.** Il n'était pas l'ornement du saut, il était
  // là parce que le saut était invisible autrement (`_rescale` le dit déjà de son
  // côté). Sous `?terre=unique` il n'y a plus qu'une Terre des deux côtés de la
  // traversée : il n'a plus rien à masquer, et Adrien : « je ne veux aucun saut ».
  _whiteout(swap) {
    if (this._continu()) return Promise.resolve().then(swap)
    return new Promise((resolve) => {
      this.whiteEl.classList.add('on')
      setTimeout(async () => {
        await swap()
        this.whiteEl.classList.remove('on')
        setTimeout(resolve, 480)
      }, 480)
    })
  }

  // ---------------------------------------------------------------- surface → orbital

  async enterOrbit(entryAltM = null) {
    if (this.mode !== 'surface' || this.busy) return
    this._resetZoom()
    // continuity: pop out at the altitude the surface view actually had, so a
    // z8 patch hands over at ~500 km and a z12 patch at ~30 km
    // ⚠️ **SOUS LE DRAPEAU, ON SORT À L'ALTITUDE EXACTE — pas 15 % au-dessus.**
    // Le `× 1,15` d'`altitudeSortieOrbiteM` existait pour repasser la porte de
    // plongée sans y retomber ; la porte est maintenant géométrique et
    // `_diveArmed` suffit à ne pas replonger. Un 15 % de recul serait un saut,
    // et c'est exactement ce qu'Adrien refuse.
    // ⚡ **L'ALTITUDE DE SORTIE EST CELLE DE LA CAMÉRA QUI REND, PAS SA JAMBE
    // VERTICALE — Tâche D16, étape ①.** `_altitudeFondM()` vaut `camY × emprise /
    // span` ; la caméra de fond, elle, est plus haut de tout le déport horizontal
    // de la vue de trois quarts. **Mesuré à la sortie d'orbite : 33 105 716 m
    // contre 23 879 470 m — la caméra PLONGEAIT de 9 226 246 m en une image**,
    // alors que le commentaire ci-dessus revendique une sortie « à l'altitude
    // EXACTE » et a supprimé un recul de 15 % pour cela.
    // ⚠️ `altitudeFondRenduM` rend `null` hors frontière de rendu : le chemin
    // d'avant reprend alors au bit près.
    if (entryAltM == null && this._continu()) {
      entryAltM = this.hooks.altitudeFondRenduM?.() ?? this._altitudeFondM()
    }
    if (entryAltM == null) {
      // pop out just above the block's own altitude; a coarse z4 continental
      // block (~7 500 km up) hands over above the 8 000 km globe gate
      // ⚠️ RÈGLE R1 : c'est une décision de CADRAGE, elle lit donc l'altitude
      // GÉOMÉTRIQUE — celle qui ne contient ni `dem.meanM` ni l'exagération
      // verticale. `surfaceCamAltMeters()` (l'altimètre) porte les deux ; le
      // hook de cadrage, lui, n'en porte aucun. Voir main.js et le §2 du plan.
      entryAltM = altitudeSortieOrbiteM(this._altitudeCadrageM())
    }
    // an explicit altitude must respect the orbit ceiling too, or the camera
    // would sit above controls.maxDistance and snap every frame
    entryAltM = Math.min(entryAltM, MAX_ALT_M)
    this.busy = true
    this.announce('FX OFFLINE — ENTERING ORBITAL VIEW')
    const { lat, lon } = this.hooks.getSurfaceLatLon()

    await this._whiteout(() => {
      this.hooks.setSurfaceVisible(false)
      this.hooks.setEffectsEnabled(false)
      this.globe.setVisible(true)

      this._surfCam.near = this.camera.near
      this._surfCam.far = this.camera.far
      this.camera.far = 1400
      this.camera.updateProjectionMatrix()

      this.orbAlt = this.orbAltTarget = entryAltM / ORBITAL_M_PER_UNIT
      this._diveArmed = false // require an inward zoom before re-diving
      latLonToSphere(lat, lon, R_GLOBE + this.orbAlt, this.camera.position)
      this.controls.target.set(0, 0, 0)
      this._poseButees('orbital') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.controls.maxPolarAngle = Math.PI
      this.controls.enableZoom = false // wheel handled by us
      this.controls.enablePan = false
      this.camera.up.set(0, 1, 0)
      this.camera.lookAt(0, 0, 0)
      this.controls.update()
      this._empriseVue = null // on quitte l'espace du bloc : plus d'unité à suivre
      // ⚠️ **L'ATTENTE DE LA VUE DE TROIS QUARTS MEURT AVEC LA SURFACE.** Sans
      // ça, un aller-retour orbite → surface → orbite la laisserait armée, et la
      // bascule tomberait au premier repos du PROCHAIN séjour, sans traversée.
      this._attenteTroisQuarts = false
      this._etaitSurLeBloc = false
      this._fonduPose = null
      this.mode = 'orbital'
    })
    this.busy = false
  }

  // ---------------------------------------------------------------- orbital → surface

  // task 30 Fix A: "on se retrouve très souvent le nez dans la paroi quand on
  // passe au zoom inférieur" — every dive/refine arrival used to land the
  // camera at a FIXED close standoff (~26 world units: position(0,18,19)
  // against target(0,-0.3,0)) regardless of how tall the just-loaded patch's
  // OWN relief is, so a steep peak near the block centre could easily sit
  // taller than that fixed height. Land at the FAR end of
  // hooks.surfaceMaxDistance() instead — the same distance the "frame the
  // whole slab" comment on that hook already documents as safe: the block's
  // own world footprint (TERRAIN_SIZE) never changes size across zoom tiers,
  // only what it REPRESENTS does, so "farthest for this zoom" and "farthest,
  // full stop" are the same number. Same viewing angle as the old fixed
  // pose (_ARRIVAL_DIR), just farther back along it, so the framing doesn't
  // look different — only safer. A cheap terrain-clearance guard on top:
  // sample the ground height directly under the landing target and refuse
  // to land below it (+ margin) — a formality at ~94% of
  // surfaceMaxDistance() (that standoff already clears anything this app's
  // ══════════ LES BUTÉES DE LA CAMÉRA — UN SEUL SITE (Tâche 1b, Étape 3) ════
  //
  // ⚠️ `controls.minDistance` ÉTAIT ÉCRIT À QUATRE ENDROITS : `enterOrbit`,
  // `_dive`, `_loadDive` et `main.js` (la pose initiale). Deux littéraux `6` et
  // une formule qui portait la porte de plongée. Ici, un seul site, et les deux
  // valeurs viennent de `loi-altitude.js` — donc le test les voit.
  //
  // ⚠️ ELLES NE FUSIONNENT PAS, ET CE N'EST PAS UN RENONCEMENT : en surface le
  // plancher est une distance à la CIBLE sur un bloc de 56 unités ; en orbite,
  // une distance au CENTRE d'une sphère de rayon `R_GLOBE`. Une seule valeur
  // suppose un seul monde — c'est l'Étape 2, et elle n'est pas faite.
  _poseButees(mode) {
    const c = this.controls
    if (mode === 'orbital') {
      c.minDistance = distanceMinOrbitale({ rayonGlobe: R_GLOBE, metresParUnite: ORBITAL_M_PER_UNIT })
      c.maxDistance = R_GLOBE + MAX_ALT_M / ORBITAL_M_PER_UNIT
    } else {
      c.minDistance = DISTANCE_MIN_SURFACE
      c.maxDistance = this.hooks.surfaceMaxDistance()
    }
  }

  // L'ALTITUDE QUI DÉCIDE DU CADRAGE — règle R1 du plan.
  //
  // ⚠️ CE N'EST PAS `this.altM`, ET LA DIFFÉRENCE EST LA RÈGLE ELLE-MÊME.
  // `this.altM` est ce que l'ALTIMÈTRE affiche : en surface il porte
  // `dem.meanM` (dérivé du terrain chargé, donc lissé) et l'exagération
  // verticale. Les deux sont interdits à une décision de cadrage — le premier
  // par R1 textuellement, le second parce que c'est un curseur d'affichage :
  // bouger l'exagération déplacerait la porte orbitale.
  //
  // Sans le hook (banc de test, source procédurale) on retombe sur l'altimètre,
  // qui est alors la seule grandeur disponible.
  _altitudeCadrageM() {
    return this.hooks.surfaceCamAltCadrageM?.() ?? this.hooks.surfaceCamAltMeters()
  }

  // ══════════ LE NIVEAU DE LA PLONGÉE — DÉDUIT, PLUS LU DANS UNE TABLE ══════
  //
  // ⚠️ C'EST LE CŒUR DE LA TÂCHE 1b. `_dive` posait la caméra à une distance
  // FIXE (`distanceArrivee`, 141 unités) quelle que soit l'altitude quittée :
  // mesuré à la Tâche 1a, 1 600,0 km → 906,6 km d'une image à l'autre, ÷1,765.
  // C'était le dernier des onze sauts du profil de descente.
  //
  // Le geste est celui de la Tâche 2 bis, transposé : on ne pose plus la caméra
  // pour subir l'altitude qui en sort, on part de l'ALTITUDE. La plongée ayant
  // DEUX inconnues (le niveau et la distance), `niveauDePlongee` les résout
  // ensemble — le niveau le plus fin dont la distance tient sous le plafond.
  //
  // `zoomImpose` : un zoom DÉSIGNÉ par l'utilisateur (clic sur le globe, cadrage
  // GPX de `flyTo`) reste imposé. Le geste choisit un cadrage, il ne le déduit
  // pas — et sa distance est alors bornée, donc le saut peut subsister. C'est
  // assumé et écrit dans le plan.
  _niveauDePlongee(altM, zoomImpose = null) {
    const echelleAuZoom = this.hooks.echelleVerticaleAuZoom
    const zoomFin = this.hooks.getFineZoom()
    // Le geste qui DÉSIGNE garde son niveau — clic sur le globe, cadrage GPX.
    if (zoomImpose != null) return { zoom: zoomImpose, distanceCible: null }
    // ⛔ **PLUS DE TABLE SOUS LE DRAPEAU.** `DIVE_TIERS` posait NEUF paliers
    // d'altitude à la main ; ici le niveau se déduit de l'emprise, et la porte
    // orbitale devient géométrique.
    //
    // ⚠️ **ET IL PASSE AVANT LA GARDE D'`echelleVerticaleAuZoom` — TROUVÉ PAR LE
    // BANC, PAS PAR LA RELECTURE.** Cette branche-ci ne lit PAS l'échelle
    // verticale (c'est tout son objet : l'exagération n'entre plus dans la
    // traversée). La laisser sous une garde qui exige un crochet qu'elle
    // n'emploie pas la rendait muette dès qu'il manquait — et le repli était le
    // ZOOM FIN, c'est-à-dire une plongée à z15 depuis 1 600 km.
    if (this._continu()) {
      const n = this._niveauDArrivee(altM)
      if (n) return { zoom: n.zoom, distanceCible: n.distanceCible }
    }
    if (typeof echelleAuZoom !== 'function' || !(altM > 0)) {
      // pas d'échelle à lire : on retombe sur la pose d'arrivée d'avant, jamais
      // sur une distance inventée (même garde que `_rescale`).
      return { zoom: zoomFin, distanceCible: null }
    }
    return niveauDePlongee({
      altM,
      echelleAuZoom,
      zoomMax: zoomFin,
      distanceMin: DISTANCE_MIN_SURFACE,
      distanceMax: this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE,
    })
  }

  // relief produces) but a real guarantee rather than an assumption.
  _arrivalPose(lieu = null) {
    const dist = distanceArrivee(this.hooks.surfaceMaxDistance()) // stay under the hard cap so controls.update() below doesn't immediately re-clamp it
    const target = this._cibleVisee(lieu)
    const pos = _ARRIVAL_DIR.clone().multiplyScalar(dist)
    const minY = this._solSous(target) + 3 // clearance margin, world units
    if (pos.y < minY) pos.y = minY
    return { pos, target }
  }

  // LA POSE D'ARRIVÉE DE LA PLONGÉE — celle qui CONSERVE l'altitude.
  //
  // ⚠️ L'ÉCHELLE SE LIT APRÈS LE CHARGEMENT, exactement comme `_rescale` le
  // fait depuis la Tâche 2 bis. `_niveauDePlongee` a choisi le niveau sur une
  // ESTIMATION (l'emprise théorique du zoom au lat/lon demandé) ; le bloc réel
  // est calé sur la grille de tuiles et son emprise en diffère un peu. La
  // distance, elle, se calcule sur l'échelle VRAIE — sinon on rendrait un saut
  // de quelques pour cent au lieu d'un saut de ×1,765.
  //
  // Sans le hook (banc de test, source procédurale) : la pose fixe d'avant,
  // jamais une distance inventée.
  _posePlongee(arrival, altDepartM) {
    // ⛔ **LE DÉPÔT CONSERVAIT L'AUTRE ALTITUDE, ET `loi-altitude.js` LE SAVAIT** :
    // *« le CHAMP VISUEL, lui, saute encore d'un facteur exagération(z) […] C'est
    // une question, pas un oubli. »* Sous `?terre=unique` la question a une
    // réponse, parce qu'il n'y a plus deux mondes à raccorder mais un seul : de
    // l'autre côté de la traversée c'est la MÊME planète, donc c'est l'altitude
    // de FOND qui doit être continue. **Le saut valait ×2,5 à ×5 selon le palier
    // d'exagération, et il vaudrait encore ×2 sous D10.**
    if (this._continu()) {
      const d = distancePourAltitudeFond({
        altM: altDepartM,
        extentMeters: this.hooks.empriseBlocM?.(),
        span: this.hooks.coteBloc?.(),
        pente: _ARRIVAL_DIR.y,
        yCible: arrival.target.y,
      })
      if (d != null) {
        const dist = THREE.MathUtils.clamp(
          d,
          this.controls.minDistance,
          this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
        )
        const p = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
        const seuil = this._solSous(arrival.target) + 3 // même garde de dégagement
        if (p.y < seuil) p.y = seuil
        return p
      }
    }
    const echelleV = this.hooks.echelleVerticaleBloc?.() ?? null
    if (!(echelleV > 0) || !(altDepartM > 0)) return arrival.pos
    const brute = distancePourAltitude({ altM: altDepartM, echelleV, yCible: arrival.target.y })
    const dist = THREE.MathUtils.clamp(
      brute,
      this.controls.minDistance,
      this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
    )
    const pos = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
    const minY = this._solSous(arrival.target) + 3 // même garde de dégagement qu'`_arrivalPose`
    if (pos.y < minY) pos.y = minY
    return pos
  }

  // La hauteur du sol sous un point visé — `-Infinity` sans le hook, ce qui
  // neutralise les gardes de dégagement au lieu de les faire mentir.
  _solSous(target) {
    return this.hooks.sampleGroundY ? this.hooks.sampleGroundY(target.x, target.z) : -Infinity
  }

  // OÙ LA CAMÉRA VISE EN ARRIVANT — et c'est ce qui a supprimé la dérive du
  // dézoome (Adrien : « je garde mon précédent point de vision central au
  // centre du dézoome »). Le POURQUOI complet, mesures comprises, est dans
  // escalier-zoom.js sous `viseeArrivee` : en résumé, viser le centre
  // géométrique du bloc faisait relire au cran suivant un lat/lon SNAPPÉ sur la
  // grille de tuiles, et l'écart s'accumulait cran après cran.
  //
  // Sans le hook (banc de test, source procédurale) on retombe exactement sur
  // l'ancienne pose : le centre du socle.
  // ══════ ET HORS DU CROP AUSSI, ON VISE LE LIEU DEMANDÉ — Tâche R32 ═════════
  //
  // ⛔ **R27 VISAIT L'AXE DU BLOC HORS DU CROP, ET LA CAMÉRA SAUTAIT À CHAQUE
  // FRANCHISSEMENT — MESURÉ EN ESPACE GLOBE** (`scripts/sonde-pivot-r32.mjs`,
  // `.banc/R32/avant.json`, descente à la molette, point sous la caméra relevé
  // sur `camGlobe` image par image) : au sortir de chaque `_rescale`, le point
  // sous la caméra saute de **466 km (z4) · 197 km (z5) · 90 à 129 km (z6) ·
  // 48 à 68 km (z7) · 24 km (z8) · 12 km (z9) · 8,6 km (z10)** en UNE image —
  // et de **550 km à la traversée orbite → surface**. C'est le calage du bloc
  // sur la grille de tuiles : `(0, ·, 0)` est le centre du bloc CALÉ, jamais le
  // lieu demandé (jusqu'à un sixième de côté, `escalier-zoom.js`). R27 le
  // faisait pour que le crop naisse centré ; il n'a mesuré que le centre du
  // bloc à l'écran (0 px après la re-pose) et l'altitude — pas le sol.
  //
  // ➡️ **LA CAMÉRA VISE LE LIEU DEMANDÉ DES DEUX CÔTÉS DU CROP.** `viseeDuLieu`
  // rend la position du lieu dans le NOUVEAU bloc ; `_suivreEmprise` repose la
  // caméra relativement à elle ; le point sous la caméra ne bouge donc pas d'un
  // mètre au franchissement — D16 (« pas de saut de position »), mesuré après
  // correctif dans `rapport-R32.md`. La cible n'est alors plus « sur l'axe »
  // du bloc hors du crop, et **ça n'a plus d'importance** : hors du crop le
  // bloc est invisible, et le glissé n'est plus une rotation autour de la
  // cible mais une saisie de la Terre (`main.js`, « on attrape la Terre »).
  //
  // ⚠️ **CE QUE ÇA COÛTE, DIT** : sur le crop, le bloc n'est centré sur la
  // visée qu'au calage près (≤ 9,33 u). La bascule de trois quarts (D16 ter)
  // et le pivot du crop (R13, l'axe du bloc) s'en accommodent par construction
  // — R13 l'a mesuré avec une cible à 21,3 u de l'axe.
  //
  // ⚠️ **LE `y` NE CHANGE PAS** : forcer `y = 0` déplacerait `camera.position.y`,
  // donc `altitudeCadrageM()`, donc le seuil de naissance du crop.
  //
  // ⚠️ **SANS LE HOOK, RIEN NE CHANGE** — banc de test, source procédurale,
  // régime hérité `?terre=deux` : la pose d'avant, au bit près.
  _cibleVisee(lieu) {
    const p = lieu && this.hooks.viseeDuLieu ? this.hooks.viseeDuLieu(lieu.lat, lieu.lon) : null
    return new THREE.Vector3(p?.x ?? 0, Y_CIBLE, p?.z ?? 0)
  }

  // ══════ LE BLOC SUIT LA CAMÉRA — Tâche R32 ════════════════════════════════
  //
  // Hors du crop, la saisie de la Terre translate caméra ET cible dans l'espace
  // du bloc (voir `main.js`). La cible peut donc s'éloigner de l'axe du bloc de
  // plus que ce que `viseeArrivee` tolère (`TERRAIN_SIZE/2 − 2 = 26 u`) : le
  // prochain franchissement la BORNERAIT, et ce serait un saut. On recharge
  // donc le bloc au même niveau, centré sur le lieu visé, dès que la cible passe
  // `SEUIL_RECENTRAGE_U` — c'est un `_rescale` ordinaire, SANS annonce, dont
  // `_suivreEmprise` garantit que la caméra ne bouge pas d'un mètre (même
  // emprise, même lieu). Mesuré dans `rapport-R32.md`.
  //
  // ⚠️ **PAS PENDANT UN GESTE** : l'appelant ne le demande qu'au repos de la
  // saisie ; pendant `busy`, `_zoomGesture` jette les crans, et un rechargement
  // sous la main serait exactement le cran que D16 supprime.
  async recentrerBloc() {
    if (this.mode !== 'surface' || this.busy || this.travel || this._diveTween || this._fonduPose) return false
    if (!this._continu()) return false
    const lieu = this.hooks.lieuVise?.()
    const zoom = this.hooks.zoomCourant?.()
    if (!lieu || !Number.isFinite(lieu.lat) || !Number.isFinite(lieu.lon) || !(zoom > 0)) return false
    // ⚠️ la signature de `_rescale` est lue par deux cliquets de source
    // (`escalier-surface`, `voile-whiteout`) : le silence est un drapeau, pas un
    // argument
    this._rechargementSilencieux = true
    try { await this._rescale({ lat: lieu.lat, lon: lieu.lon, zoom }, 'RECENTRING') } finally { this._rechargementSilencieux = false }
    return true
  }

  // `lieu` : le lat/lon VOULU. Absent, on prend celui sous la caméra — c'est le
  // cas de la plongée à la molette, qui vise le centre de l'écran. Le clic sur
  // le globe, lui, en fournit un (voir plongeDepuisGlobe).
  async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {
    if (this.mode !== 'orbital' || this.busy) return
    this.busy = true
    this._resetZoom()
    // ⚠️ L'ALTITUDE QUITTÉE SE LIT AVANT TOUT LE RESTE : c'est elle que la pose
    // d'arrivée doit conserver. En orbite `this.altM` EST l'altitude
    // géométrique (`orbAlt × ORBITAL_M_PER_UNIT`), donc R1 est déjà satisfaite.
    const altDepartM = this.altM
    const { zoom } = this._niveauDePlongee(altDepartM, zoomImpose ? (tier.zoom ?? this.hooks.getFineZoom()) : null)
    const { lat, lon } = lieu ?? sphereToLatLon(this.camera.position)
    this.announce(`ACQUIRING SURFACE DATA — ${lat.toFixed(4)}, ${lon.toFixed(4)} · Z${zoom}`)
    this.controls.enabled = false
    try {
      await this.hooks.loadSurface(lat, lon, zoom)
    } catch {
      this.announce('SURFACE DATA UNAVAILABLE — HOLDING ORBIT')
      this.orbAltTarget = Math.max(tier.altM * 1.6, 60000) / ORBITAL_M_PER_UNIT
      // snap back above the dive gate NOW — the damped climb takes several
      // frames, during which a lingering sub-tier altitude would re-trigger
      // _dive() every frame and hammer the tile server with doomed requests
      this.orbAlt = Math.max(this.orbAlt, (tier.altM * 1.1) / ORBITAL_M_PER_UNIT)
      this._diveArmed = false // a fresh inward zoom is needed to retry
      this.controls.enabled = true
      this.busy = false
      return
    }

    await this._whiteout(() => {
      this.globe.setVisible(false)
      this.hooks.setSurfaceVisible(true)
      this.hooks.setEffectsEnabled(true)

      this.camera.far = this._surfCam.far
      // ⚠️ `camera.up` NE BASCULE PAS, ET LE PLAN SE TROMPAIT. Rejoué contre le
      // dépôt : `enterOrbit` écrit `camera.up.set(0, 1, 0)` lui aussi. Les deux
      // modes ont toujours eu le MÊME repère vertical — la ligne était un
      // no-op, elle disparaît. (Le repère de POSITION, lui, change bel et bien ;
      // c'est l'Étape 2, la frontière globe/terrain, et elle n'est pas faite.)
      const arrival = this._arrivalPose({ lat, lon })
      this.controls.target.copy(arrival.target)
      this._poseButees('surface') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.camera.position.copy(this._posePlongee(arrival, altDepartM))
      // ⚠️ **L'EMPRISE D'ARRIVÉE EST MÉMORISÉE ICI, ET SANS ÇA LA PLONGÉE SE
      // FERAIT CONVERTIR DEUX FOIS** : `_suivreEmprise` verrait passer l'emprise
      // du bloc quitté à celle du bloc d'arrivée et rejouerait un changement
      // d'unités que `_posePlongee` vient déjà d'appliquer.
      this._empriseVue = this.hooks.empriseBlocM?.() ?? null
      // `near` DÉRIVÉ, plus restauré : c'est la même loi qu'en orbite
      // (`planProche`), appliquée à la hauteur au-dessus du sol du bloc. Elle
      // sature à NEAR_MAX = 0,5 dès 2,5 unités de dégagement — c'est-à-dire
      // toujours, à la distance d'arrivée — donc la valeur est celle que
      // `_surfCam.near` reposait, mais elle est maintenant DÉDUITE.
      this.camera.near = planProche(this.camera.position.y - this._solSous(arrival.target))
      this.camera.updateProjectionMatrix()
      // ⚠️ LE PLAFOND DUR — la vraie butée est posée par image dans `main.js`
      // (`polaireMaxSol`, Tâche R23) : elle dépend de la distance et du relief.
      this.controls.maxPolarAngle = POLAIRE_MAX_DURE
      // ⚠️ `rotateSpeed = 1` DES DEUX CÔTÉS depuis R23 — l'orbite ne le ramène
      // plus à 0,015 (le commentaire d'avant décrivait ce saut comme un contrat).
      this.controls.rotateSpeed = 1
      this.controls.enableZoom = false // surface zoom is our inertial dolly
      this.controls.enablePan = true
      this.controls.enabled = true
      this.controls.update()
      this.mode = 'surface'
      // ══════ LA TRAVERSÉE GARDE L'AXE DE L'ORBITE — D16 ter, étape 5 ═══════
      //
      // ⛔ **ADRIEN, APRÈS AVOIR VU R4 :** *« Je vois toujours un énorme
      // déplacement entre orbite et surface mode. **Je veux garder la vue comme
      // en orbite quand je fais la transition.** »*
      //
      // R4 avait ÉTALÉ la bascule de 46,548° sur ~1,9 s au lieu d'une image.
      // ⚠️ **Étaler n'est pas supprimer**, et c'est ce qu'il refuse. D16 ter
      // tranche : **nadir de l'orbite jusqu'au bloc, la vue de trois quarts à
      // l'arrivée sur le bloc, et là seulement.**
      //
      // La traversée ne balaie donc plus rien : elle POSE le nadir — l'axe que
      // l'orbite avait — et met la bascule EN ATTENTE.
      this._attendreLeBloc(arrival.target)
    })
    this.announce('FX ONLINE — SURFACE MODE ENGAGED')
    this.busy = false
  }

  // ══════════ LE FONDU DE POSE DE LA PLONGÉE — Tâche R4 ═══════════════════
  //
  // **Adrien, 2026-08-23 :** *« J'ai toujours le problème de déplacement de la
  // Terre quand je descends depuis l'orbite. »*
  //
  // ⛔ **LA PLONGÉE TOURNAIT LA CAMÉRA DE 46,55° EN UNE IMAGE**, mesuré au
  // navigateur (`.banc/R4/descente.mjs`, images 345 → 346, altitude 5 977 km) :
  // inclinaison au nadir local **0,000° → 46,548°**. En orbite la caméra vise
  // le centre de la planète, donc le nadir, TOUJOURS ; en surface la pose
  // d'arrivée est oblique (`PENTE_ARRIVEE = {y: 18, z: 19}` — et
  // `90° − atan(18/19) = 46,54816°`, l'écart relevé **à la treizième décimale**
  // — ce n'est pas une concordance, c'est une identité géométrique : la caméra
  // d'arrivée est posée le long de `(0, 18, 19)` depuis une cible à son aplomb).
  //
  // ⚠️ **CE N'EST PAS UN BOGUE, C'EST LE PRODUIT** : la vue de trois quarts EST
  // ShibuMap. Le défaut n'est pas la pose d'arrivée, c'est qu'on y arrive d'un
  // coup. La plongée arrive donc dans la pose que l'orbite quittait — le nadir —
  // et l'inclinaison balaie jusqu'à l'oblique. Adrien accepte la transition,
  // il refuse le claquement.
  //
  // ⚠️ **L'ALTITUDE NE BOUGE PAS D'UN MÈTRE PENDANT LE BALAYAGE**, et c'est la
  // condition pour ne pas rouvrir le défaut de la Tâche M par l'autre bout : la
  // caméra tourne à `camera.position.y` CONSTANT, or `altitudeFondM` vaut
  // `camY × emprise / span`. La loi est dans `monde/zoom-continu.js`, §4 ter.
  //
  // ⚠️ **ET `camY` SE RELIT À CHAQUE IMAGE, PAS UNE FOIS À L'ARMEMENT** : sous
  // le drapeau le glissé inertiel court pendant le fondu (`_applyZoom` ignore
  // `busy`). Figer `camY` annulerait la molette de l'utilisateur pendant une
  // seconde entière — donc rendrait la main avec un saut, ce qu'on ferme ici.
  // ══════ LA TRAVERSÉE : ON POSE LE NADIR, ET ON ATTEND — D16 ter ════════
  //
  // `_posePlongee` a rendu une pose OBLIQUE (elle calcule la bonne DISTANCE le
  // long de `_ARRIVAL_DIR`). On garde sa distance et on ramène l'axe au nadir :
  // `poseFonduArrivee` à l'avancement 0 fait exactement ça — même `camY`, rayon
  // horizontal nul. **L'altitude ne bouge donc pas d'un mètre** (même invariant
  // que R4 : la caméra tourne à `camY` constant).
  //
  // ⚠️ **ET SURTOUT : `_fonduPose` RESTE NUL.** `_franchirSiBesoin` refuse de
  // franchir un niveau tant qu'un balayage court (« pas pendant le balayage de
  // pose », plus haut). Garder un fondu armé pendant toute la descente aurait
  // **bloqué tous les crans** — la descente ne se serait jamais affinée.
  // L'attente vit donc dans son propre drapeau, qui ne bloque rien.
  _attendreLeBloc(cible) {
    this._fonduPose = null
    this._attenteTroisQuarts = false
    if (!this._continu()) return
    const direction = this.camera.position.clone().sub(cible)
    if (!(direction.lengthSq() > 1e-6)) return
    direction.normalize()
    // mêmes gardes que le balayage : une arrivée rasante ou trop basse n'a rien
    // à redresser, et le rayon horizontal y explose.
    if (!(direction.y > 1e-3)) return
    if (!(this.camera.position.y - cible.y > this.controls.minDistance * 1.05)) return
    const p = poseFonduArrivee({ cible, camY: this.camera.position.y, direction, avancement: 0 })
    if (!p) return
    this.camera.position.set(p.x, p.y, p.z)
    this.controls.target.copy(cible)
    this.controls.update()
    this._attenteTroisQuarts = true
  }

  // ══════ « ARRIVER AU BLOC », LE SEUL NOMBRE QUE D16 ter LAISSAIT OUVERT ══
  //
  // ⚠️ **TROIS CANDIDATS ÉTAIENT SUR LA TABLE, ET LE PREMIER EST CELUI QU'ADRIEN
  // REFUSE** — la naissance du crop (32 274,3 m) : c'est là que la bascule
  // tombait, en plein milieu du trajet. Le troisième, l'altitude finale, est un
  // seuil de plus : il tomberait lui aussi pendant le geste.
  //
  // ➡️ **LE SIGNAL RETENU EST `veilleCrop.repos`, ET IL N'AJOUTE AUCUN NOMBRE AU
  // DÉPÔT** : il vaut `crop posé ET vue au repos`, c'est-à-dire **le LIEU et le
  // MOMENT dans un seul booléen**, alimenté par le point unique de
  // `branchement-crop.js`. La partie « repos » est un signal de GESTE, pas de
  // seuil : `veille-repos.js` surveille `|Δ ln distance|`, calibré **4,7 fois sous
  // le pic du geste le plus doux**, avec 30 images d'hystérésis.
  //
  // ⚡ **C'est donc le plus TARD des trois** : le crop doit être né (on est sur le
  // bloc) **et** la molette doit s'être arrêtée (le geste est fini).
  // ⚠️ Et ce n'est pas surprenant, parce que ce n'est pas une altitude qu'on
  // franchit sans le vouloir : c'est l'utilisateur qui lâche la molette.
  _armerBasculeTroisQuarts() {
    this._attenteTroisQuarts = false
    // ⚠️ **L'AZIMUT EST CELUI DE L'UTILISATEUR, PAS CELUI DE `_ARRIVAL_DIR`.**
    // La bascule tombe maintenant à la FIN de la descente : entre la traversée et
    // elle, l'utilisateur a pu tourner autour du bloc. Reprendre l'azimut sud de
    // `_ARRIVAL_DIR` lui ferait faire un demi-tour à l'arrivée. On ne reprend de
    // la pose d'arrivée que son ÉLÉVATION — les 46,548° qui SONT le produit.
    const elev = Math.asin(Math.min(1, _ARRIVAL_DIR.y))
    const az = this.controls.getAzimuthalAngle?.() ?? Math.atan2(_ARRIVAL_DIR.x, _ARRIVAL_DIR.z)
    const ch = Math.cos(elev)
    const direction = new THREE.Vector3(Math.sin(az) * ch, Math.sin(elev), Math.cos(az) * ch)
    this._armerFonduPose(this.controls.target, direction)
  }

  // ══════ QUITTER LE BLOC REND LA VUE AU NADIR — D16 ter, symétrique ═════
  //
  // ⛔ **SANS ÇA, LA MOITIÉ DE LA PLAINTE D'ADRIEN RESTAIT OUVERTE.** Mesuré sur
  // la remontée : `enterOrbit` repose la caméra au nadir en UNE image, et la
  // caméra du bloc y tourne de **46,548°** — exactement la bascule de trois
  // quarts, prise par l'autre bout. La descente était devenue continue, la
  // remontée claquait toujours.
  //
  // ➡️ **LA RÈGLE EST SYMÉTRIQUE, ET C'EST LA MÊME PHRASE** : la vue de trois
  // quarts appartient au BLOC. On la prend en arrivant dessus, on la rend en le
  // quittant. Le signal est le miroir de l'arrivée : `veilleCrop.pose`, le crop
  // lui-même — un signal de LIEU, pas de geste. Il tombe vers 40 km, très
  // au-dessous des ~33 000 km où `enterOrbit` prend la main : le balayage a tout
  // le temps de finir, et la sortie d'orbite trouve la caméra déjà au nadir.
  _armerRetourNadir() {
    const cible = this.controls.target
    const direction = this.camera.position.clone().sub(cible)
    if (!(direction.lengthSq() > 1e-6)) return
    direction.normalize()
    if (direction.y > 1 - 1e-9) return // déjà au nadir : rien à rendre
    this._armerFonduPose(cible, direction, true)
  }

  _armerFonduPose(cible, directionImposee = null, versNadir = false) {
    this._fonduPose = null
    if (!this._continu()) return
    const direction = directionImposee
      ? directionImposee.clone()
      : this.camera.position.clone().sub(cible)
    if (!(direction.lengthSq() > 1e-6)) return
    direction.normalize()
    // ⚠️ **UNE ARRIVÉE DÉJÀ RASANTE N'A RIEN À BALAYER**, et le rayon horizontal
    // `dy / tan θ` y explose. Même garde, même convention que `_suivreEmprise` :
    // ne rien faire, jamais faire zéro.
    if (!(direction.y > 1e-3)) return
    // ⚠️ **ET UNE ARRIVÉE TROP BASSE NON PLUS** : à l'aplomb, la distance à la
    // cible vaut `camY − yCible` ; sous `minDistance`, `controls.update()` la
    // repousserait à chaque image et le fondu se battrait contre la butée.
    if (!(this.camera.position.y - cible.y > this.controls.minDistance * 1.05)) return
    // ⚠️ **`angleTotalDeg` SE CALCULE ICI, UNE FOIS** : c'est l'angle que le
    // balayage doit couvrir, `90° − asin(direction.y)`, et c'est lui qui convertit
    // le plafond en degrés (`PAS_POSE_MAX_DEG`) en plafond d'avancement. La
    // direction ne change plus une fois le fondu armé ; l'angle non plus.
    const angleTotalDeg = 90 - (Math.asin(Math.min(1, direction.y)) * 180) / Math.PI
    this._fonduPose = { t: 0, e: 0, angleTotalDeg, cible: cible.clone(), direction, versNadir }
    this._avancerFonduPose(0)
  }

  // Une image de fondu. `e` est l'avancement DÉJÀ adouci.
  _avancerFonduPose(e) {
    const f = this._fonduPose
    if (!f) return
    const p = poseFonduArrivee({
      cible: f.cible,
      camY: this.camera.position.y,
      direction: f.direction,
      // ⚡ **UN SEUL BALAYAGE, DEUX SENS — D16 ter.** À l'aller il va du nadir
      // vers les trois quarts ; au retour, des trois quarts vers le nadir. La
      // LOI est la même (l'élévation interpolée linéairement en `e`), le PLAFOND
      // est le même (`PAS_POSE_MAX_DEG`), et `e` court toujours de 0 à 1 : c'est
      // l'avancement passé à la loi qu'on retourne, pas la mécanique.
      avancement: f.versNadir ? 1 - e : e,
    })
    if (!p) { this._fonduPose = null; return }
    this.camera.position.set(p.x, p.y, p.z)
    this.controls.target.copy(f.cible)
    this.controls.update()
  }

  // surface → surface: reload the patch two zoom steps finer, centered on
  // what the camera is looking at — the staircase down from a z8 dive
  async _refine() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getRefineTarget()
    if (!next) return // already at fine scale
    await this._rescale(next, 'REFINING')
  }

  // surface → surface the other way: widen the map two zoom steps before
  // handing over to orbit — every stop of the zoom-out shows a real map
  async _coarsen() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getCoarsenTarget()
    if (!next) return
    await this._rescale(next, 'WIDENING')
  }

  // LE CRAN DE L'ESCALIER DE SURFACE — ET IL NE TÉLÉPORTE PLUS.
  //
  // ✅ Adrien, 2026-08-20 : « on garde bien un zoom continu, exactement comme
  // Google Earth ou Google Maps. » v48 posait la caméra au POINT DE
  // PRÉSENTATION (maxDistance·0,97, le bloc entier cadré) à chaque traversée
  // d'étage : mesuré, cela faisait REMONTER la caméra de ×1,672 à ×2,154 pendant
  // que l'utilisateur zoomait — 685 623 m rendus à l'envers sur une descente de
  // 1 600 km, et 960 ms de fondu au blanc pour que ça ne se voie pas.
  //
  // Ce qui reste de v48, et c'était sa bonne moitié : **l'angle de vue de
  // l'utilisateur est gardé** (`prevDir`).
  //
  // Ce qui la remplace : **l'altitude MÉTRIQUE est conservée de part et d'autre
  // du cran.** Elle vaut `camY / échelle du bloc`, et l'échelle change pour
  // DEUX raisons à chaque cran — l'emprise du bloc est divisée par deux ET
  // l'exagération verticale change de palier (5 à z5, 4 à z6, 3,2 à z7, 2,8
  // ensuite). ⚠️ **Ne compenser que l'emprise laisserait trois crans
  // discontinus.** On lit donc l'échelle RÉELLE du bloc des deux côtés du
  // rechargement (`hooks.echelleVerticaleBloc`) : aucune constante recopiée,
  // aucun palier à tenir à jour ici.
  //
  // ⚠️ ET IL N'Y A PLUS DE FONDU AU BLANC. Le rideau n'était pas l'ornement du
  // saut, il était là parce que le saut était invisible autrement.
  async _rescale(next, verb) {
    const continu = this._continu()
    const silencieux = this._rechargementSilencieux === true
    this.busy = true
    // ⛔ **`_resetZoom()` TUAIT L'ÉLAN À CHAQUE CRAN, ET C'EST LA MOITIÉ DE LA
    // SENSATION D'ACCROCHAGE.** Le glissé repartait de zéro de l'autre côté :
    // l'utilisateur relançait la molette à chaque niveau. Sous le drapeau,
    // l'élan et le compteur de budget TRAVERSENT — c'est `_franchirSiBesoin` qui
    // a déjà retranché le niveau franchi du compteur.
    if (!continu) this._resetZoom() // the new level starts its own scroll budget
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    const camYAvant = this.camera.position.y
    const echelleAvant = this.hooks.echelleVerticaleBloc?.() ?? null
    // ⚠️ `silencieux` : le recentrage du bloc (R32) n'est pas un événement pour
    // l'utilisateur — rien ne change à l'écran, rien à annoncer.
    if (!silencieux) this.announce(`${verb} — ${next.lat.toFixed(4)}, ${next.lon.toFixed(4)} · Z${next.zoom}`)
    try {
      await this.hooks.loadSurface(next.lat, next.lon, next.zoom)
    } catch {
      if (!silencieux) this.announce(`${verb} FAILED — HOLDING SCALE`)
      this.busy = false
      return
    }
    const echelleApres = this.hooks.echelleVerticaleBloc?.() ?? null
    const arrival = this._arrivalPose(next)
    // ⚠️ **L'ANCIENNE CIBLE SE LIT ICI, ET PAS UNE LIGNE PLUS BAS — Tâche R4.**
    // La ligne suivante la remplace par la visée du NOUVEAU bloc, exprimée dans
    // le repère du nouveau bloc : la lire après, c'est lire un repère et une
    // caméra qui ne sont plus dans le même monde. Mesuré : 10,4° de rotation au
    // cran z3 → z4, et de 1,3° à 8,1° aux six suivants.
    //
    // ⛔ **ET `prevDir` NE POUVAIT PAS SERVIR ICI** : il est lu AVANT le
    // chargement, alors que sous le drapeau le glissé inertiel continue de
    // courir pendant tout l'`await` (`_applyZoom` s'exécute même à `busy`). Sa
    // direction est celle d'il y a quelques images, pas celle de maintenant.
    const cibleAvant = continu ? this.controls.target.clone() : null
    this.controls.target.copy(arrival.target)
    // ⚠️ **SOUS LE DRAPEAU, LA CONVERSION D'UNITÉS EST DÉJÀ FAITE (ou le sera à
    // cette ligne), ET ELLE NE PASSE PAS PAR `poseCranContinu`.** Voir
    // `_suivreEmprise` : l'invariant y est l'altitude de FOND, donc le rapport
    // des EMPRISES, alors que `poseCranContinu` prend le rapport des échelles
    // VERTICALES — lequel porte l'exagération, et c'est LUI l'accrochage (jusqu'à
    // ×2 au cran z4 → z5 avec la table de paliers du dépôt).
    if (continu) { this._suivreEmprise(cibleAvant); this.busy = false; return }
    const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
    // Sans le hook (banc de test, source procédurale), il n'y a pas d'échelle à
    // comparer : on retombe sur la pose d'arrivée, qui est le comportement
    // d'avant l'escalier continu — jamais sur une distance inventée.
    const facteur = echelleAvant > 0 && echelleApres > 0 ? echelleApres / echelleAvant : null
    const dist =
      facteur && Math.abs(dir.y) > 1e-3
        ? poseCranContinu({ camY: camYAvant, pente: dir.y, facteurEchelle: facteur, yCible: arrival.target.y })
            .distanceCible
        : arrival.pos.distanceTo(arrival.target)
    const borne = THREE.MathUtils.clamp(dist, this.controls.minDistance, this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE)
    const pos = this.controls.target.clone().addScaledVector(dir, borne)
    // même garde de dégagement sol que _arrivalPose
    const groundY = this.hooks.sampleGroundY ? this.hooks.sampleGroundY(arrival.target.x, arrival.target.z) : -Infinity
    if (pos.y < groundY + 3) pos.y = groundY + 3
    this.camera.position.copy(pos)
    this.controls.update()
    this.busy = false
  }

  // ---------------------------------------------------------------- travel

  // Great-circle glide to lat/lon, ending below the dive threshold so the
  // normal engagement takes over. One code path for paste, search and GPX.
  // `zoom` pins the landing scale (GPX framing); null lands on the fine zoom.
  // Returns false when navigation is already busy (dive/transition running).
  async flyTo(lat, lon, zoom = null) {
    if (this.busy) return false
    if (this.mode === 'surface') {
      await this.enterOrbit(1200000) // pop out high enough to see the arc
    }
    const fromDir = this.camera.position.clone().normalize()
    const toDir = latLonToSphere(lat, lon, 1)
    const angle = fromDir.angleTo(toDir)
    const cruise = Math.max(this.orbAlt, Math.min((angle / Math.PI) * 14000000, 12000000) / ORBITAL_M_PER_UNIT)
    this.travel = {
      t: 0,
      duration: THREE.MathUtils.clamp(2.5 + (angle / Math.PI) * 7, 2.5, 9),
      fromDir,
      toDir,
      fromAlt: this.orbAlt,
      cruise,
      endAlt: (DIVE_ALT_M * 0.92) / ORBITAL_M_PER_UNIT,
      zoom,
    }
    this.controls.enabled = false
    return true
  }

  _updateTravel(dt) {
    const tr = this.travel
    tr.t = Math.min(1, tr.t + dt / tr.duration)
    const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - (-2 * tr.t + 2) ** 3 / 2
    const dir = tr.fromDir.clone().lerp(tr.toDir, e).normalize() // fine for < π arcs
    // ══════ LE GLISSÉ DU CLIC : PAS DE CROISIÈRE, L'ALTITUDE DESCEND — R35 ══
    //
    // Le vol de `flyTo` monte en croisière puis redescend ; le clic, lui, ne
    // fait que se RAPPROCHER (D16 : « on ne vise pas, on se rapproche »).
    // L'altitude suit une géométrique en `e` — le rapport image à image est
    // alors uniforme, et vaut `2^(Δe)` au pire, c'est-à-dire ~×1,02 à 60 i/s.
    const alt = tr.clic
      ? tr.fromAlt * (tr.endAlt / tr.fromAlt) ** e
      : THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(tr.fromAlt, tr.cruise, THREE.MathUtils.smoothstep(tr.t, 0, 0.35)),
          tr.endAlt,
          THREE.MathUtils.smoothstep(tr.t, 0.55, 1)
        )
    this.orbAlt = this.orbAltTarget = alt
    this.camera.position.copy(dir).multiplyScalar(R_GLOBE + alt)
    this.camera.lookAt(0, 0, 0)
    if (tr.t >= 1) {
      this.travel = null
      this.controls.enabled = true
      this.controls.update()
      // ⚠️ **LE CLIC N'IMPOSE AUCUN NIVEAU : IL ARME LA PORTE GÉOMÉTRIQUE**,
      // exactement comme un cran de molette vers l'intérieur. La traversée, si
      // elle a lieu, est celle de `_niveauDArrivee` — elle conserve l'altitude
      // de fond, donc elle ne se voit pas (rapport-R35.md).
      if (tr.clic) { this._diveArmed = true; return }
      // a glide lands on its pinned zoom (GPX framing) or the FINE scale,
      // explicitly (dive arming is for manual zooms only)
      this._dive(tr.zoom ? { altM: DIVE_ALT_M, zoom: tr.zoom } : DIVE_TIERS[0], null, { zoomImpose: !!tr.zoom })
    }
  }

  // ---------------------------------------------------------------- public nav
  // Explicit navigation the UI drives (vertical zoom stepper + click-to-dive).
  // All reuse the tuned staircase internals — no new zoom behaviour, just new
  // triggers besides the wheel.

  // one level FINER (toward more detail). Surface: refine centred on the view.
  // Orbital: nudge the altitude target inward and arm the dive (the settle→dive
  // logic then lands at the matching scale — same path as a wheel-in notch).
  stepFiner() {
    this.cranZoom(1)
  }

  // one level WIDER. Surface: coarsen, or open the orbit gate once past z4.
  // Orbital: nudge the altitude target outward (toward the planet).
  stepWider() {
    this.cranZoom(-1)
  }

  // ══════════ CLIQUER SUR LE GLOBE ══════════════════════════════════════════
  //
  // Adrien : « Quand je suis en orbite, cliquer me fait zoomer sur la zone sur
  // laquelle je clique, exactement à l'endroit où j'ai cliqué, qui sera au
  // centre. J'arrive en Z3. »
  //
  // ⚠️ CE N'EST PAS LA PLONGÉE DE LA MOLETTE AVEC UN AUTRE DÉCLENCHEUR. Celle-ci
  // vise `sphereToLatLon(camera.position)` — le point sous la CAMÉRA, c'est-à-dire
  // le milieu de l'écran. Elle est juste tant que le geste est un zoom : on
  // plonge là où on regarde. Elle est fausse pour un clic, où le geste DÉSIGNE :
  // cliquer l'Islande au bord du disque aurait posé le bloc au centre de
  // l'Atlantique. Le lat/lon vient donc du rayon (main.js), pas de la caméra.
  //
  // Le palier : celui de l'altitude, et le plus large qui reste quand on est
  // au-dessus de tous (voir `palierDeClic`) — c'est-à-dire z6 dès qu'on regarde
  // vraiment la planète, le « Z3 » d'Adrien.
  //
  // ══════ SOUS LE DRAPEAU, LE CLIC NE PLONGE PLUS : IL GLISSE — R35 ═════════
  //
  // ⛔ **LE CLIC SAUTAIT ×4,41 EN UNE IMAGE** (`.banc/R35/clic-avant.json`,
  // 60 000 → 13 613 km) : `_dive` avec un niveau IMPOSÉ (z4) posait la caméra
  // à `surfaceMaxDistance()` = 150 u, et 150 u sur un bloc z4 valent 13 600 km.
  // La règle R1 (conserver l'altitude) était abrogée par la butée dès que
  // l'altitude quittée la dépassait. D16 : « on ne vise pas, on se rapproche » ;
  // D19 : Google Earth zoome vers le point cliqué, progressivement.
  //
  // ➡️ Le clic est donc un GLISSÉ : la direction tourne vers le lieu cliqué
  // (le point vient sous la caméra, la Terre reste plantée — c'est la rotation
  // autour de son centre) pendant que l'altitude descend d'UN NIVEAU
  // (`FACTEUR_CLIC` = ½, le `BUDGET_NIVEAU` de la molette). À l'arrivée, la
  // porte géométrique est ARMÉE, pas forcée : `_niveauDArrivee` traverse quand
  // un bloc tient l'altitude, en la conservant. Le régime hérité (`?terre=deux`)
  // garde la plongée à palier, au bit près.
  plongeDepuisGlobe(lat, lon) {
    if (this.busy || this.travel || this.mode !== 'orbital') return false
    // embed « zone de test » : le visiteur ne franchit aucun niveau, ni à la
    // molette ni au clic. Sans cette ligne, le clic serait devenu la porte
    // dérobée d'un verrou que _zoomGesture tient déjà.
    if (this.locked) return false
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
    this._diveArmed = false // le clic consomme l'intention ; la molette ne doit pas re-plonger derrière
    if (this._continu()) {
      const fromDir = this.camera.position.clone().normalize()
      const toDir = latLonToSphere(lat, lon, 1)
      const fromAlt = this.orbAlt
      const endAlt = Math.max(fromAlt * FACTEUR_CLIC, ORB_ALT_MIN)
      this.travel = { t: 0, duration: DUREE_GLISSE_CLIC_S, fromDir, toDir, fromAlt, cruise: fromAlt, endAlt, zoom: null, clic: true }
      this.controls.enabled = false
      return true
    }
    this._dive(palierDeClic(DIVE_TIERS, this.altM) ?? DIVE_TIERS[0], { lat, lon }, { zoomImpose: true })
    return true
  }

  // Click-to-dive, two beats (Adrien): first EASE IN toward the clicked point
  // by 30% of the remaining zoom distance (a "lean toward it"), THEN load the
  // finer level centred there. `target.point` is the clicked world position.
  //
  // ══════ SOUS LE DRAPEAU : UN SEUL TEMPS, ET LE NIVEAU SUIT — R35 ═════════
  //
  // ⛔ **LES 70 % RESTANTS TOMBAIENT EN UNE IMAGE** (×1,43 par clic,
  // `.banc/R35/clic-avant.json`) : `_loadDive` reposait la caméra à
  // `distancePresentation` — une distance FIXE sur un bloc deux fois plus
  // petit. Ici le clic est le geste de la molette, cadré : la cible glisse
  // RIGIDEMENT vers le point cliqué (caméra + cible, même vecteur, `y`
  // inchangé — l'orbite de R32, la Terre plantée) pendant que la distance
  // descend d'un niveau en géométrique ; le compteur de niveau encaisse
  // l'intention image par image, et `_franchirSiBesoin` recharge le niveau fin
  // à l'arrivée par `_rescale`, dont `_suivreEmprise` garantit la continuité.
  // Rien n'est posé : ni distance, ni `_loadDive`.
  diveTo(target) {
    if (this.busy || this.travel || this._diveTween || this.mode !== 'surface' || !target) return
    const from = this.camera.position.clone()
    const fromT = this.controls.target.clone()
    const dist = from.distanceTo(fromT)
    const dir = from.clone().sub(fromT).normalize()
    if (this._continu()) {
      // l'élan de la molette s'éteint (le glissé tient la caméra) ; le COMPTEUR,
      // lui, traverse — un reste de molette n'est pas jeté, comme pour `cranZoom`
      this._zoomVel = 0
      const toT = target.point ? new THREE.Vector3(target.point.x, fromT.y, target.point.z) : fromT.clone()
      const d1 = Math.max(this.controls.minDistance, dist * FACTEUR_CLIC)
      this.controls.enabled = false
      this._diveTween = { t: 0, dur: DUREE_GLISSE_CLIC_S, fromT, toT, dir, d0: dist, d1, dPrec: dist, compteur0: this._levelZoom, target, glisse: true }
      return
    }
    this._resetZoom() // cancel any coasting zoom; the dive owns the camera now
    const lean = 0.3 * Math.max(0, dist - this.controls.minDistance)
    const toT = target.point ? target.point.clone() : fromT.clone()
    const toPos = toT.clone().addScaledVector(dir, Math.max(this.controls.minDistance, dist - lean))
    this.controls.enabled = false // the tween owns the camera until it loads
    this._diveTween = { t: 0, dur: 0.42, from, fromT, toPos, toT, target }
  }

  // Une image du glissé de clic en surface (R35). `e` est l'avancement adouci.
  _avancerGlisseClic(dv, e) {
    const c = this.controls
    c.target.lerpVectors(dv.fromT, dv.toT, e)
    const d = dv.d0 * (dv.d1 / dv.d0) ** e
    // le compteur encaisse l'INTENTION (un niveau) tant qu'un niveau existe ;
    // au zoom fin, le déplacement réel — même asymétrie que `_applyZoom`.
    // ⚠️ **POSÉ, PAS ACCUMULÉ** : la somme des pas `(eᵢ − eᵢ₋₁)` télescope à 1
    // à un epsilon près, et `franchissement` TRONQUE `budget / pas` — mesuré au
    // navigateur : un clic sur deux ratait son niveau (`.banc/R35/clic-apres-1.json`,
    // clics 5 et 7 sans REFINING). À `e = 1` le compteur vaut exactement
    // `compteur0 − PAS_NIVEAU`.
    if (this.hooks.getRefineTarget?.()) this._levelZoom = dv.compteur0 - PAS_NIVEAU * e
    else this._levelZoom += Math.log(d / dv.dPrec)
    dv.dPrec = d
    this.camera.position.copy(c.target).addScaledVector(dv.dir, d)
    const seuil = this._solSous(c.target) + 3 // même garde de dégagement qu'`_arrivalPose`
    if (this.camera.position.y < seuil) this.camera.position.y = seuil
    c.update()
  }

  // second beat: load the finer level, centred on the clicked point, landing
  // near the far end of the new level (whole block in frame) while KEEPING the
  // current view axis — "dézoomé quasiment au max de ce niveau, même axe de vue".
  async _loadDive(target) {
    if (this.busy || this.mode !== 'surface' || !target) return
    this.busy = true
    this._resetZoom()
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    this.announce(`DIVING — ${target.lat.toFixed(4)}, ${target.lon.toFixed(4)} · Z${target.zoom}`)
    try {
      await this.hooks.loadSurface(target.lat, target.lon, target.zoom)
    } catch {
      this.announce('DIVE FAILED — HOLDING SCALE')
      this.busy = false
      return
    }
    await this._whiteout(() => {
      // le point cliqué EST ce que la caméra vise — pas le centre du bloc, qui
      // en est décalé de tout ce que le calage sur la grille de tuiles a pris
      const tgt = this._cibleVisee(target)
      const dist = distancePresentation(this.hooks.surfaceMaxDistance()) // distance de la vue iso 1 (point de présentation)
      const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
      const pos = tgt.clone().addScaledVector(dir, dist)
      if (pos.y < this._solSous(tgt) + 3) pos.y = this._solSous(tgt) + 3 // same clearance guard as _arrivalPose
      this.camera.position.copy(pos)
      this.controls.target.copy(tgt)
      this._poseButees('surface') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.controls.update()
    })
    this.busy = false
  }

  // one frame of the inertial surface dolly: scale the distance by the coasting
  // velocity (log-space, so a notch multiplies distance), pivoting on the point
  // under the cursor (zoom-toward-cursor), then decay the velocity. Steps the
  // staircase when the glide crosses 70% of the level's travel in its direction.
  _resetZoom() {
    this._zoomVel = 0
    this._levelZoom = 0
  }

  // LE BUDGET DE ZOOM DÉPENSÉ DANS LE NIVEAU — le pilote de l'exagération
  // continue (Tâche E, §4 bis de `monde/exageration-continue.js`).
  //
  // ⚠️ **NÉGATIF EN ZOOM AVANT**, nul au repos et à chaque cran, borné à
  // `[-STEP_IN, STEP_OUT]` par `_applyZoom`. C'est la SEULE grandeur de cette
  // classe que le repositionnement du cran ne contamine pas : `_rescale`
  // l'écrase par `_resetZoom()` AVANT d'appeler `poseCranContinu`, dont le
  // facteur d'échelle porte le rapport des exagérations. Un accesseur plutôt
  // qu'une lecture directe du champ privé, pour que le lien soit cherchable.
  zoomNiveau() {
    return this._levelZoom
  }

  // ══════════ LA POUSSÉE DE SORTIE — Tâche SORTIE ════════════════════════════
  //
  // Une course de dézoom FRANCHE, armée par `main.js` quand le geste a confirmé
  // l'intention de sortir du crop (trois crans de dézoom d'affilée). Elle ne
  // décide de RIEN sur le crop : elle pousse l'altitude, et c'est la loi de D21
  // ① (`socleVisible`, `sortieArmee` + `SEUIL_MORT_M`) qui tranche, comme pour
  // les 161 crans qu'elle remplace. C'est aussi `main.js` qui l'arrête, à la
  // mort du crop — le seul endroit qui connaisse cette loi.
  //
  // @param {number} budgetLog log-distance à dépenser (l'appelant le dérive de
  //   l'altitude à atteindre : `ln(cible / courante)`, plus sa marge).
  // @param {() => number} [reste] ⚡ **PORTE — LE VRAI TERMINUS.** Lu à CHAQUE
  //   image ; il rend **ce qui manque en log-altitude** pour que le crop meure.
  //   `≤ 0` arrête la course ; sinon le pas de l'image y est écrêté. C'est lui
  //   qui borne le survol, pas le budget : le budget est en log-DISTANCE et les
  //   franchissements CONSERVENT l'altitude, donc il ne sait pas où il en est en
  //   altitude. Sans `reste`, le comportement est celui de SORTIE — la course va
  //   au bout de son budget, et c'est ce qui coûtait 21 à 32 crans au retour.
  armerPousseeSortie(budgetLog, reste) {
    if (this.mode !== 'surface' || !this._continu()) return false
    if (!(Number.isFinite(budgetLog) && budgetLog > 0)) return false
    if (this._sortieCourse) return false // déjà en route : on ne la relance pas
    this._sortieCourse = {
      restant: budgetLog, t: 0, depart: this.controls.getDistance(),
      reste: typeof reste === 'function' ? reste : null,
    }
    return true
  }

  // ⚠️ **ET L'EXCÈS DE COMPTEUR EST RENDU, SINON LA SORTIE CONTINUE SEULE.** Le
  // compteur survit aux images (R29 : « un niveau par appel, et le reste
  // reste ») ; laissé plein après la mort du crop, il ferait franchir des
  // niveaux tout seul jusqu'à la porte orbitale — la molette aurait alors DEUX
  // sorties en une, dont une que personne n'a demandée. L'intention de sortie
  // est consommée par la sortie, exactement comme `sortieArmee`.
  annulerPousseeSortie() {
    if (!this._sortieCourse) return false
    this._sortieCourse = null
    this._levelZoom = THREE.MathUtils.clamp(this._levelZoom, -BUDGET_NIVEAU, BUDGET_NIVEAU * 0.9)
    return true
  }

  get pousseeSortieActive() { return !!this._sortieCourse }

  // Une image de la poussée. ⚠️ **ELLE POMPE L'INTENTION, PAS LA DISTANCE** :
  // c'est la leçon des 23 crans morts. Le plafond `maxDistance` clippe le
  // déplacement — on le subit comme `_applyZoom` — mais le compteur, lui,
  // encaisse le pas voulu (R23), et c'est lui qui fait franchir les niveaux,
  // donc lui qui fait monter l'altitude.
  _avancerPousseeSortie(dt) {
    const s = this._sortieCourse
    if (!s) return
    s.t += dt
    if (s.t > DUREE_SORTIE_MAX_S || s.restant <= 0) { this.annulerPousseeSortie(); return }
    // ⚡ **PORTE — LE RESTE SE LIT AVANT LE PAS, ET IL L'ÉCRÊTE.** Le lire après
    // dépenserait toujours une image de trop — et une image vaut ici +43 %
    // d'altitude (`dt ≈ 0,06 s`) : c'est elle qui portait la mort du crop de
    // 40 343 à 58 160 m, puis l'utilisateur qui la repayait au retour.
    let plafond = Infinity
    if (s.reste) {
      const r = s.reste()
      if (!(Number.isFinite(r) && r > 0)) { this.annulerPousseeSortie(); return }
      plafond = r
    }
    const c = this.controls
    const pas = Math.min(s.restant, TAUX_SORTIE_LOG_S * dt, plafond)
    s.restant -= pas
    const dist = c.getDistance()
    const newDist = THREE.MathUtils.clamp(dist * Math.exp(pas), c.minDistance, c.maxDistance)
    this._levelZoom += pas // l'INTENTION, jamais le mouvement clippé
    if (Math.abs(newDist - dist) > 1e-9) {
      _zoomDir.copy(this.camera.position).sub(c.target).normalize()
      this.camera.position.copy(c.target).addScaledVector(_zoomDir, newDist)
      c.update()
    }
    this._franchirSiBesoin()
  }

  _applyZoom(dt) {
    const c = this.controls
    const cam = this.camera
    const min = c.minDistance
    const max = c.maxDistance
    const dist = c.getDistance()
    let factor = Math.exp(-this._zoomVel * dt) // vel > 0 (zoom in) → factor < 1
    const voulue = dist * factor // ce que le geste DEMANDE, avant toute butée
    let newDist = THREE.MathUtils.clamp(voulue, min, max)
    // clamp to the level's own zoom budget: the glide stops at the zone limit
    // (Adrien) instead of running to the physical near/far stop
    let dLog = Math.log(Math.max(newDist, 1e-6) / Math.max(dist, 1e-6))
    // ⚠️ **SOUS LE DRAPEAU LE BUDGET EST UN COMPTEUR, PAS UNE BUTÉE — Tâche M.**
    // Le glissé n'est plus borné : il court, et c'est `_franchirSiBesoin` (au bas
    // de cette fonction) qui change de niveau quand le compteur vaut un niveau
    // plein. Sans le drapeau, les deux lignes d'avant, au bit près.
    if (!this._continu()) {
      if (this._levelZoom + dLog < -BUDGET_NIVEAU) { dLog = -BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
      else if (this._levelZoom + dLog > BUDGET_NIVEAU) { dLog = BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
    }
    // ══════ LE BUDGET COMPTE L'INTENTION, PAS LE MOUVEMENT CLIPPÉ — R23 ═════
    //
    // ⛔ **LA TRANSITION ÉTAIT À SENS UNIQUE, ET C'EST MESURÉ.** Vue couchée
    // vers l'horizon puis dézoom à la molette, 1 500 images, l'API de l'appli
    // (`.banc/R23/avant.json`, `remontees['couchee-vers-horizon']`) : **l'orbite
    // n'est JAMAIS atteinte**, 2 niveaux franchis puis plus rien, la caméra
    // collée à `d = 150 / plafond 150` et le budget figé à **0,68782** — pour un
    // niveau qui en vaut **0,69315**. Il manquait **0,005**, définitivement.
    //
    // ⚡ **LE MÉCANISME, ET IL EST DE LA MÊME FAMILLE QUE `0,49π` :**
    // `maxDistance` borne une DISTANCE caméra → cible, alors que ce qu'il faut
    // borner est une ALTITUDE. Or `distance = (camY − yCible) / cos φ` : à la
    // butée polaire, `cos(88,2°) = 0,0314` contre 0,688 à la pente d'arrivée —
    // **la même altitude coûte 21,9 fois plus de distance**. Le plafond mord
    // donc bien avant que le niveau soit dépensé, `dLog` tombe à zéro, et
    // l'intention de l'utilisateur est jetée en silence.
    //
    // ➡️ **ON GARDE LA BUTÉE SUR LA CAMÉRA, ON LA RETIRE DU COMPTEUR.** Le
    // franchissement DIVISE la distance par deux (`poseApresNiveau` conserve
    // l'altitude de fond) : il fait donc lui-même la place que la butée refuse.
    // Compter l'intention, c'est laisser le niveau se franchir puis le
    // mouvement reprendre — jamais un saut, puisque la traversée conserve
    // l'altitude.
    //
    // ⚠️ **ET SEULEMENT SI UN NIVEAU PEUT L'ABSORBER.** Vers l'extérieur il y en
    // a toujours un (un cran plus large, ou la porte orbitale) ; vers
    // l'intérieur, au zoom fin, il n'y a plus rien à affiner — laisser courir le
    // compteur y serait un compteur qui ne se dépense jamais.
    let dBudget = dLog
    if (this._continu() && newDist !== voulue) {
      const intention = Math.log(Math.max(voulue, 1e-6) / Math.max(dist, 1e-6))
      if (intention > 0 || !!this.hooks.getRefineTarget?.()) dBudget = intention
    }
    this._levelZoom += dBudget
    newDist = dist * Math.exp(dLog)
    factor = newDist / dist
    // ══════ HORS DU CROP, LE ZOOM NE TRANSLATE PLUS — Tâche R29 bis ════════
    //
    // ⛔ **C'EST LA PLAINTE D'ADRIEN, ET R27 L'A PROUVÉE SUR LE SEUL CHEMIN OÙ
    // ELLE ÉTAIT DÉJÀ VRAIE.** R27 §② publie « hors du crop, l'écart à l'axe
    // vaut EXACTEMENT 0 » — mesuré avec `cranZoom`, qui repose la caméra le long
    // de `cible → caméra` et **ne touche jamais la cible**. La molette, elle,
    // passe ICI. Mesuré au geste réel (`.banc/R30/molette.json`, curseur à
    // (950, 230), rejoué sur le socle d'aujourd'hui) : **2 279 images sur 2 369
    // hors du crop — 96,2 % — ont la cible hors de l'axe**, jusqu'à
    // **13,2695 u**, et `target.y` s'écarte de `Y_CIBLE` jusqu'à **1,1728 u**.
    //
    // ⚡ **L'ALGÈBRE QUI TRANCHE, ET ELLE DIT QUE LES DEUX SONT INCOMPATIBLES.**
    // L'homothétie de centre `P` et de rapport `f` se décompose EXACTEMENT en
    //
    //     (recul pur autour de la cible)  +  (translation RIGIDE de δ)
    //     avec δ = (1 − f) · (P − T)
    //
    // — identité vérifiée : `T + (C−T)f + (1−f)(P−T) = P + (C−P)f`. Le recul pur
    // laisse la cible où elle est ; **toute la sortie d'axe EST δ, et δ est
    // AUSSI ce qui garde le point du curseur immobile à l'écran.** Retirer l'un,
    // c'est retirer l'autre : « viser toujours le centre de la Terre » et
    // « zoomer vers le curseur » sont la même quantité prise dans deux sens. Il
    // n'existe pas de réglage qui donne les deux, et un recentrage qui court
    // après le zoom ne fait que perdre la course — `decalageRecentrage` est
    // borné à `PAS_RECENTRAGE_RAD × distance`, soit ~4 px par image.
    //
    // ➡️ **ARBITRAGE, ET IL SUIT LA RÈGLE À LA LETTRE** : *« le point d'orbite
    // doit toujours viser le centre de la Terre. Il change UNIQUEMENT quand on
    // passe en mode bloc croppé. »* Hors du crop, δ est abandonné et le zoom
    // devient radial, comme celui du bouton. **Sur le crop, le zoom vers le
    // curseur est intact** — et c'est là qu'il sert, puisque c'est le régime où
    // l'on vise une vallée sur un bloc de 27 km. C'est aussi ce que fait DÉJÀ le
    // déplacement de vue hors du crop (R27, réserve n° 3 : « un `enablePan` hors
    // du crop est ramené à l'axe ») : le zoom rejoint le pan au lieu de le
    // contredire.
    //
    // ⚠️ **Le prédicat est le HOOK, pas une seconde définition du crop** :
    // `horsDuCrop` est le seul énoncé, celui de `_cibleVisee` et de
    // `recentrerSurLaTerre`. Absent — les bancs unitaires qui ne le fournissent
    // pas — on garde le pivot : une sonde qui ne déclare pas son régime ne
    // décide pas de celui-ci.
    const P = this.hooks.horsDuCrop?.() === true ? null : this._zoomPivot
    if (P && Math.abs(factor - 1) > 1e-6) {
      // scale the scene about the pivot so that point stays put on screen
      cam.position.set(P.x + (cam.position.x - P.x) * factor, P.y + (cam.position.y - P.y) * factor, P.z + (cam.position.z - P.z) * factor)
      c.target.set(P.x + (c.target.x - P.x) * factor, P.y + (c.target.y - P.y) * factor, P.z + (c.target.z - P.z) * factor)
    } else {
      _zoomDir.copy(cam.position).sub(c.target).normalize()
      cam.position.copy(c.target).addScaledVector(_zoomDir, newDist)
    }
    c.update()
    this._zoomVel *= Math.exp(-dt / ZOOM_TAU) // the coast
    // clamp at the zone limit and spend the momentum there — the glide never
    // crosses a level; a fresh re-scroll at the limit does (see the wheel handler)
    // ⚠️ **ET L'ÉLAN NE MEURT PAS SUR UNE BUTÉE QUI VA S'OUVRIR — R23.** Tuer la
    // vitesse au plafond alors que le compteur vient d'encaisser l'intention
    // rendrait le franchissement dépendant du fait que l'utilisateur RE-défile :
    // c'est le cran que la Tâche M a supprimé, revenu par la fenêtre.
    if ((newDist <= min + 1e-3 || newDist >= max - 1e-3) && dBudget === dLog) this._zoomVel = 0
    if (Math.abs(this._zoomVel) < ZOOM_STOP) this._zoomVel = 0 // coast spent
    // ⚠️ **APRÈS LE DÉPLACEMENT, PAS AVANT.** Le franchissement lit le compteur
    // que cette image vient d'incrémenter ; le placer plus haut le ferait décider
    // sur l'image précédente — c'est la « sonde lue APRÈS la fonction » du §0,
    // dans l'autre sens.
    this._franchirSiBesoin()
  }

  // ---------------------------------------------------------------- per-frame

  update(dt) {
    // ⚠️ **EN TÊTE, ET `main.js` LE JUSTIFIE** : `modes.update(dt)` court AVANT
    // `majSeuilSocle()` et `majCameraFond()`. Convertir ici, c'est convertir
    // avant que quiconque ne lise l'altitude de cette image — donc jamais l'image
    // à moitié d'altitude qui a produit onze bascules du seuil.
    this._suivreEmprise()
    if (this.mode === 'orbital') {
      if (this.travel) {
        this._updateTravel(dt)
      } else if (!this.busy) {
        // damped proportional zoom
        this.orbAlt = THREE.MathUtils.damp(this.orbAlt, this.orbAltTarget, 6, dt)
        const dir = this.camera.position.clone().normalize()
        this.camera.position.copy(dir).multiplyScalar(R_GLOBE + this.orbAlt)
        // ══════ LE GESTE EST LE MÊME PARTOUT — Tâche R23 ═══════════════════
        //
        // ⛔ **LA LOI D'AVANT ÉTAIT `clamp((orbAlt / R_GLOBE) × 1,4, 0,015, 1)`,
        // ET C'EST ELLE QUI FABRIQUAIT LE SAUT DE VITESSE.** Relevé au
        // navigateur, glissé de 100 px, écran 1280×800 (`.banc/R23/avant.json`) :
        // **0,447079 °/px** en orbite haute, **0,006716 °/px à 40 km** — et
        // **0,447079 °/px sur le bloc**, où `rotateSpeed` vaut 1. Rapport entre
        // les deux régimes : **66,5**. C'est la limite ③ de `monde/pivot-bloc.js`.
        //
        // ⚡ **CE QUI DÉCIDE : LE GESTE EST DÉJÀ LE MÊME AUX DEUX BOUTS QU'ADRIEN
        // JUGE PARFAITS.** L'orbite haute et le bloc portent le même
        // 0,447079 °/px, la même loi d'`OrbitControls` (`2π·dx/hauteur ×
        // rotateSpeed`) et le même `rotateSpeed = 1`. La loi d'altitude ne vivait
        // que DANS l'intervalle — le seul endroit où le geste n'a jamais été jugé.
        //
        // ⚠️ **ET EN RÉGIME CONTINU ELLE NE SERVAIT DÉJÀ PLUS À RIEN**, ce qui
        // est le constat qui rend le retrait sûr : la porte orbitale est
        // GÉOMÉTRIQUE (`niveauDArrivee`, `monde/zoom-continu.js`) et s'ouvre vers
        // 7 à 12 millions de mètres — franchissement mesuré à **12 332 703 m** —
        // alors que le genou de la loi tombait à `R_GLOBE / 1,4`, soit
        // **4 550 000 m**. `rotateSpeed` valait **déjà 1 sur toute la descente
        // réelle** : 1 810 images relevées, pire rapport d'une image à la
        // suivante **×1,0000**. Ce qui change ici est le régime hérité
        // (`?terre=deux`), où la plongée tombe à 8 000 m et où le ×66,67 était
        // bel et bien atteint, et les hautes latitudes, où la porte descend sous
        // le genou (voir `test/butee-sol.test.js`).
        //
        // ⚠️ **LA RÉSERVE, ET ELLE EST PUBLIÉE :** à basse altitude orbitale la
        // rotation autour du CENTRE de la Terre (« on utilise le centre de la
        // Terre comme point de rotation, excepté en mode crop », Adrien) balaie
        // beaucoup de sol — 0,447 ° de longitude par pixel. À L'ÉCRAN c'est
        // pourtant exactement le geste de l'orbite haute : le point de sol au
        // centre du cadre se déplace de `f × dθ` pixels quelle que soit
        // l'altitude, parce que le vecteur caméra → sol tourne du même angle des
        // deux côtés. Ce qui change avec l'altitude est le kilométrage, pas le
        // geste.
        this.controls.rotateSpeed = 1
        this.controls.update()
      }

      // keep the near plane tight to the ground so low passes don't clip.
      // ⚠️ MÊME LOI QU'EN SURFACE depuis la Tâche 1b : `planProche` vit dans
      // `loi-altitude.js` et les deux modes l'appellent. Elle sature à 0,5,
      // c'est-à-dire exactement la valeur que le mode surface posait en dur.
      const near = planProche(this.orbAlt)
      if (Math.abs(near - this.camera.near) > near * 0.2) {
        this.camera.near = near
        this.camera.updateProjectionMatrix()
      }

      this.altM = altitudeOrbitaleM(this.orbAlt, ORBITAL_M_PER_UNIT)
      if (!this.busy && !this.travel && this._diveArmed && this._continu()) {
        // ⛔ **PLUS DE TABLE, PLUS D'ATTENTE DE STABILISATION.** Le dépôt
        // attendait que le zoom se POSE (`settled`, à 6 % près) puis lisait le
        // palier dans `DIVE_TIERS` : deux paliers pour un seul geste. Ici la
        // porte est GÉOMÉTRIQUE — on traverse dès qu'un niveau de bloc peut
        // accueillir l'altitude sous le plafond de la caméra — et la traversée
        // conserve l'altitude de fond, donc elle ne se voit pas.
        const n = this._niveauDArrivee(this.altM)
        if (n && n.borne !== 'haut') {
          this._diveArmed = false
          this._dive({ altM: DIVE_ALT_M, zoom: n.zoom })
        }
      } else if (!this.busy && !this.travel && this._diveArmed) {
        // dive when an inward zoom SETTLES under a tier — never intercept a
        // fast zoom mid-flight; the landing scale matches where you stopped
        const settled = Math.abs(this.orbAlt - this.orbAltTarget) < this.orbAltTarget * 0.06
        if (settled) {
          // pick the tier from the TARGET altitude (where the user chose to
          // stop), not the still-damping orbAlt — settle fires up to 6% away,
          // enough to cross a tier boundary and land one scale too coarse
          // (e.g. wheel stop at 7 700 m read as 8 160 m → z11 instead of FINE)
          const tier = pickDiveTier(this.orbAltTarget * ORBITAL_M_PER_UNIT)
          if (tier) {
            this._diveArmed = false
            this._dive(tier)
          }
        }
      }
    } else {
      // surface inertial dolly — the long élan (see the wheel handler)
      // ⚠️ **SOUS LE DRAPEAU, LE GLISSÉ SURVIT AU CHARGEMENT — ET C'EST LA
      // TROISIÈME MOITIÉ DU CRAN.** `busy` gèle le zoom pendant tout le
      // `loadSurface` du franchissement : la molette ne répond plus, puis la vue
      // repart. C'est une PAUSE, et Adrien n'en veut pas. `_franchirSiBesoin` se
      // garde lui-même contre un second franchissement pendant celui-ci.
      if (!this._diveTween && (!this.busy || this._continu()) && Math.abs(this._zoomVel) > ZOOM_STOP) this._applyZoom(dt)
      // ⚠️ **APRÈS `_applyZoom`, ET SANS L'EXCLURE.** La poussée de sortie et
      // l'élan de la molette vont dans le MÊME sens (l'utilisateur dézoome) :
      // les additionner est ce que le geste dit. Elle se tait pendant le glissé
      // de clic et le voyage, qui possèdent la caméra.
      if (this._sortieCourse && !this._diveTween && !this.travel) this._avancerPousseeSortie(dt)
      // click-to-dive lean-in tween (first beat): ease 30% toward the point,
      // then load the finer level (see diveTo). ease-in-out quad.
      if (this._diveTween && !this.busy) {
        const dv = this._diveTween
        dv.t = Math.min(1, dv.t + dt / dv.dur)
        const e = dv.t < 0.5 ? 2 * dv.t * dv.t : 1 - ((-2 * dv.t + 2) ** 2) / 2
        if (dv.glisse) {
          // R35 : le glissé de clic — rien n'est posé à l'arrivée, le niveau
          // se franchit par le compteur, comme pour la molette
          this._avancerGlisseClic(dv, e)
          if (dv.t >= 1) {
            this._diveTween = null
            this.controls.enabled = true
            this._franchirSiBesoin()
          }
        } else {
          this.camera.position.lerpVectors(dv.from, dv.toPos, e)
          this.controls.target.lerpVectors(dv.fromT, dv.toT, e)
          this.controls.update()
          if (dv.t >= 1) {
            this._diveTween = null
            this.controls.enabled = true
            this._loadDive(dv.target)
          }
        }
      }
      // ══════ LE BALAYAGE DE POSE DE LA PLONGÉE — Tâche R4 ══════════════════
      //
      // ⚠️ **APRÈS `_applyZoom`, ET L'ORDRE EST LA MOITIÉ DU GESTE.** Le glissé
      // pose la DISTANCE (donc `camY`, donc l'altitude), le balayage pose
      // l'ANGLE en relisant le `camY` que le glissé vient d'écrire. Dans l'autre
      // ordre, le glissé repousserait la caméra le long de la direction
      // intermédiaire et l'angle serait celui de l'image d'avant.
      //
      // ⚠️ **LA COURBE EST CELLE DU TWEEN DE CLIC**, la même quadratique
      // adoucie aux deux bouts : deux courbes différentes pour deux mouvements
      // de caméra du même fichier seraient deux sensations à tenir d'accord.
      //
      // ⛔ **ET LE PAS D'INCLINAISON EST PLAFONNÉ, PAS SEULEMENT LE PAS DE
      // TEMPS** — Tâche R4, tour de correction. Le premier jet laissait
      // `Math.min(dtBrut, 0,05)` de `main.js` faire office de garde-fou : mesuré
      // sur la RTX 3080 d'Adrien, il laissait passer **4,135°** et **six pas
      // au-dessus de 3° par balayage**. `avancerFonduPose` borne l'ANGLE et
      // remonte `t` par la réciproque de la courbe ; le balayage s'étire au lieu
      // de sauter. Voir le §4 quater de `monde/zoom-continu.js`.
      // ══════ L'ARRIVÉE SUR LE BLOC ARME LA BASCULE — D16 ter, étape 5 ════
      //
      // ⚠️ **AVANT le bloc du balayage, et pas après** : armée ici, la bascule
      // avance dès la MÊME image. Armée après, elle resterait figée une image —
      // le défaut exact que R4 signale à l'armement de la traversée.
      // ⚠️ Et jamais pendant un chargement (`busy`) : `_rescale` écrit la cible
      // et repose la caméra, les deux se battraient pour la même caméra.
      if (this._attenteTroisQuarts && !this._fonduPose && !this.busy && this.hooks.arriveeSurLeBloc?.()) {
        this._armerBasculeTroisQuarts()
      }
      // ── et le front DESCENDANT : on quitte le bloc, on rend la vue au nadir ─
      const surLeBloc = !!this.hooks.surLeBloc?.()
      if (this._etaitSurLeBloc && !surLeBloc && !this._fonduPose && !this.busy) {
        this._armerRetourNadir()
      }
      this._etaitSurLeBloc = surLeBloc
      if (this._fonduPose) {
        const f = this._fonduPose
        const pas = avancerFonduPose({
          t: f.t,
          e: f.e,
          dt,
          duree: DUREE_FONDU_POSE_S,
          angleTotalDeg: f.angleTotalDeg,
          pasMaxDeg: PAS_POSE_MAX_DEG,
        })
        f.t = pas.t
        f.e = pas.e
        this._avancerFonduPose(pas.e)
        if (pas.fini) this._fonduPose = null
      }
      // ══════ LE COMPTEUR SE VIDE TOUT SEUL — Tâche R29 ═════════════════════
      //
      // ⛔ **RIEN N'APPELAIT `_franchirSiBesoin` QUAND LE GESTE ÉTAIT FINI.**
      // Il n'était appelé que par `_applyZoom` (donc tant que `_zoomVel` vit)
      // et par `cranZoom` (donc au clic suivant). Un budget encaissé pendant un
      // balayage ou un chargement restait donc au compteur jusqu'au geste
      // SUIVANT : la caméra collée au plafond, l'altitude figée, et
      // l'utilisateur qui ne comprend pas pourquoi le bouton ne fait rien.
      // Mesuré : `_levelZoom` à **9,01** (treize niveaux dus) sans que rien ne
      // se franchisse tant qu'aucun clic ne revenait.
      //
      // ⚠️ **ICI, ET APRÈS LE BLOC DU BALAYAGE** : le balayage vient de poser
      // `_fonduPose = null` à l'image où il finit, donc le niveau part dès
      // CETTE image — la même doctrine que l'armement de la bascule dix lignes
      // plus haut. La fonction est gardée et sort en une division quand le
      // compteur ne vaut pas un niveau plein : c'est le cas de toute image
      // ordinaire.
      this._franchirSiBesoin()
      this.altM = this.hooks.surfaceCamAltMeters()
    }

    this.altModeEl.textContent = this.mode === 'orbital' ? 'ORBITAL' : 'SURFACE'
    this.altValueEl.textContent =
      this.altM >= 100000
        ? `${(this.altM / 1000).toFixed(0)} km`
        : this.altM >= 10000
          ? `${(this.altM / 1000).toFixed(1)} km`
          : `${Math.max(0, Math.round(this.altM))} m`
  }
}

const _zoomDir = new THREE.Vector3()
