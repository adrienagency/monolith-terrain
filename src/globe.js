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
import { overzoomTile } from './bathy.js'
import {
  DEM_SOURCES,
  DemSourceError,
  activeDemSource,
  fallbackToAws,
  peekRegionMaxZoom,
  regionKey,
  resolveRegionMaxZoom,
} from './dem-source.js'

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

// segments per patch edge — low zooms form the planet silhouette in the full
// view, so they get denser grids: a z3 tile spans 45 degrees of longitude and
// 24 segments there leaves visibly flat facets (and jagged exaggerated relief)
// on the limb
function gridFor(z) {
  if (z <= 2) return 64
  if (z <= 3) return 48
  if (z <= 5) return 32
  return 24
}

// ---------------------------------------------------------------- shader

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
attribute vec2 latlon;
void main() {
  vUv = uv;
  vLatLon = latlon;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
uniform sampler2D uTex;
uniform sampler2D uRamp;
uniform vec3 uSunDir;
uniform vec3 uInk;
uniform vec3 uShadowColor;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uGraticuleOpacity;
uniform float uOceanDepth;
uniform float uLandMax;
// côté de la tuile en texels — 256 (AWS) ou 512 (Mapterhorn), voir planTuile
uniform float uTilePx;

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

void main() {
  float h = decodeMetersAA(vUv);

  // hypsometric ramp: bathymetry occupies [0, 0.35], land [0.35, 1]
  float t = h < 0.0
    ? 0.35 * (1.0 - clamp(-h / uOceanDepth, 0.0, 1.0))
    : 0.35 + 0.65 * clamp(h / uLandMax, 0.0, 1.0);
  vec3 col = texture2D(uRamp, vec2(t, 0.5)).rgb;

  // contour lines with the terrain's crowd-fade so they only appear when
  // the tile resolution can actually carry them
  float ch = h / uContourInterval;
  float dch = fwidth(ch);
  float minor = 1.0 - smoothstep(0.0, dch * 1.5, abs(fract(ch + 0.5) - 0.5));
  float ch5 = ch / 5.0;
  float major = 1.0 - smoothstep(0.0, fwidth(ch5) * 1.5, abs(fract(ch5 + 0.5) - 0.5));
  float crowd = clamp(1.0 - dch * 0.30, 0.0, 1.0);
  // MINIFICATION fade (Adrien : scintillement de la map en orbite) — the height
  // texture carries no mipmaps (they corrupt the packed metres), so when the
  // tile shrinks in the orbital/travel view the sampled height aliases and the
  // contour lines CRAWL. Fade them out as the tile minifies (texels per screen
  // pixel > ~1) so the far globe reads clean; they return in full up close.
  float texel = max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx;
  float minFade = clamp(1.6 - texel * 0.55, 0.0, 1.0);
  float contour = max(minor * 0.5, major) * uContourOpacity * crowd * minFade;
  contour *= h < 0.0 ? 0.35 : 1.0; // bathymetric contours read lighter
  col = mix(col, uInk, contour);

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
  float diff = max(dot(normalize(vNormalW), uSunDir), 0.0);
  col *= 0.74 + 0.30 * diff;

  // terminateur jour/nuit (demande Adrien, façon Google Earth) : la face à
  // l'ombre FOND VERS LA COULEUR DU FOND (uShadowColor — poussée par
  // applyBackground, elle suit donc le fond ET le cycle jour/nuit) — la
  // planète s'éteint dans son propre décor, pas dans un noir générique.
  // Bande de crépuscule douce, 10 % de carte résiduelle en pleine nuit.
  float day = smoothstep(-0.22, 0.16, dot(normalize(vNormalW), uSunDir));
  col = mix(uShadowColor, col, 0.10 + 0.90 * day);

  // faint paper grain
  col += (hash12(vUv * 941.7 + vLatLon) - 0.5) * 0.02 * (0.2 + 0.8 * day);

  gl_FragColor = vec4(col, 1.0);
}
`

// ---------------------------------------------------------------- tile math

function tileKey(z, x, y) {
  return `${z}/${x}/${y}`
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
const TILE_MEMO_OCTETS_MAX = 128 * 256 * 256 * 4 // 32 Mo d'ImageBitmap décodé

/** url → Promise<ImageBitmap>, LRU bornée. Exportée pour les tests. */
export const _tileMemo = new Map()
// coût de chaque entrée, en octets — même clé, même ordre que `_tileMemo`
const _tileMemoCout = new Map()
let _tileMemoOctets = 0

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
  _tileMemo.clear()
  _tileMemoCout.clear()
  _tileMemoOctets = 0
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
  return { source, tile: overzoomTile(z, x, y, connu) }
}

// Une SEULE entrée par URL, promesse comprise : deux demandes qui se
// chevauchent partagent la requête au lieu d'en lancer deux.
function tileBitmap(url, octets = 256 * 256 * 4) {
  const memo = _tileMemo.get(url)
  if (memo) {
    _tileMemo.delete(url)
    _tileMemo.set(url, memo) // ré-insertion = most-recently-used
    return memo
  }
  const p = (async () => {
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
  })()
  _tileMemo.set(url, p)
  _tileMemoCout.set(url, octets)
  _tileMemoOctets += octets
  // Un ÉCHEC ne se mémorise pas : `_pump` réessaie une fois, et une panne figée
  // priverait la session de la tuile pour de bon.
  // ⚠️ `p.then(null, …)` et pas `p.catch(…)` en tête de chaîne : cette branche
  // de surveillance ABSORBE le rejet, sinon chaque tuile en panne lèverait un
  // unhandledrejection à côté de `_pump` qui, lui, l'a bien traité.
  p.then(null, () => {
    if (_tileMemo.get(url) === p) oublieTuile(url)
  })
  // les entrées EN VOL viennent d'être insérées, elles sont donc en tête de
  // fraîcheur : la purge par la queue ne peut pas casser la déduplication
  while (_tileMemoOctets > TILE_MEMO_OCTETS_MAX && _tileMemo.size > 1) {
    oublieTuile(_tileMemo.keys().next().value)
  }
  return p
}

function oublieTuile(url) {
  if (!_tileMemo.has(url)) return
  _tileMemoOctets -= _tileMemoCout.get(url) ?? 0
  _tileMemoCout.delete(url)
  _tileMemo.delete(url)
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
    source = DEM_SOURCES.aws
    tile = overzoomTile(z, x, y, source.maxZoom)
    img = await tileBitmap(source.url(tile.z, tile.x, tile.y), source.tilePx * source.tilePx * 4)
  }
  const px = source.tilePx
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
  const rgba = ctx.getImageData(0, 0, px, px).data
  const heights = new Float32Array(px * px)
  for (let i = 0; i < heights.length; i++) {
    heights[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
  }
  const texture = new THREE.CanvasTexture(c)
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

export class Globe {
  constructor(params = {}) {
    this.group = new THREE.Group()
    this.group.name = 'globe'
    this.radius = R_GLOBE
    this.exaggeration = params.globeExaggeration ?? 18
    this.tiles = new Map() // key → { z,x,y, state, mesh, texture, heights, lastUsed, center, chord }
    this.queue = []
    this.inFlight = 0
    this.frame = 0
    this.enabled = false

    // LE TRI SPATIAL, DERRIÈRE SON DRAPEAU. ⚠️ `globe.js` n'importe pas
    // `flags.js` — délibérément : le lecteur de `FLAGS.globeContinu` est
    // `src/main.js`, qui ne passe ici qu'un booléen.
    this.continu = params.globeContinu ?? false
    // LA FRONTIÈRE DE RENDU — Tâche 1b bis. Posé par `main.js` quand le globe
    // passe dans sa propre scène de fond ; voir `setVisible`, qui cesse alors
    // d'être l'interrupteur. Déclaré ici pour qu'il ne naisse pas `undefined`
    // au détour d'une lecture.
    this.frontiereFond = false
    // le budget de cache SUIT le chemin : voir CACHE_MAX_CONTINU
    this.cacheMax = this.continu ? CACHE_MAX_CONTINU : CACHE_MAX
    this._frustum = new THREE.Frustum()
    this._matVue = new THREE.Matrix4()
    this._sphereTuile = new THREE.Sphere()
    this._angleHorizon = 0
    this._rayonCentre = 1
    this._demiEpaisseur = 0
    this._visites = 0 // tuiles PARCOURUES à la dernière image (mesure de l'emprise)
    this._refus = 0 // raffinements REFUSÉS faute de crédit à la dernière image
    this._refusFile = 0 // requêtes REFUSÉES par PLAFOND_FILE à la dernière image
    this._purgees = 0 // entrées de file PÉRIMÉES retirées à la dernière image
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
      uInk: { value: new THREE.Color(params.contourColor ?? '#000000') },
      uContourInterval: { value: 500 },
      uContourOpacity: { value: 0.55 },
      uGraticuleOpacity: { value: 0.16 },
      uOceanDepth: { value: 6000 },
      uLandMax: { value: 5600 },
      uRamp: { value: null },
    }
    this.rebuildRamp(params)

    // ⚠️ `uTilePx` EST PROPRE À LA TUILE, comme `uTex` : deux tuiles voisines
    // peuvent venir de deux sources de tailles différentes (voir `planTuile`).
    // Le mettre dans `this.uniforms`, partagé, aurait fait juger la minification
    // de toutes les tuiles sur la taille de la dernière chargée.
    this._materialFor = (texture, tilePx = 256) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...this.uniforms,
          uTex: { value: texture },
          uTilePx: { value: tilePx },
        },
      })

    this._buildPoleCaps()
    this._buildAtmosphere()

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
  }

  setInk(color) {
    this.uniforms.uInk.value.set(color)
  }

  // --------------------------------------------------------------- caps & halo

  _buildPoleCaps() {
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
          uCol: { value: new THREE.Color(north ? '#dfe7ea' : '#f4f1ec') },
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
          uniform vec3 uCol;
          void main() {
            float diff = max(dot(normalize(vN), uSunDir), 0.0);
            vec3 col = uCol * (0.74 + 0.30 * diff);
            float day = smoothstep(-0.22, 0.16, dot(normalize(vN), uSunDir));
            gl_FragColor = vec4(mix(uShadowColor, col, 0.10 + 0.90 * day), 1.0);
          }`,
      })
      const cap = new THREE.Mesh(geo, mat)
      cap.name = north ? 'cap-n' : 'cap-s'
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
      uniforms: { uSunDir: this.uniforms.uSunDir },
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
          gl_FragColor = vec4(col * a, 1.0); // additif : l'alpha est dans col
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
    t = {
      key,
      z,
      x,
      y,
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
    if (this.continu && this._enQuarantaine(key)) t.state = 'error'
    this.tiles.set(key, t)
    return t
  }

  // la clé a-t-elle épuisé son réessai il y a MOINS de IMAGES_QUARANTAINE images ?
  _enQuarantaine(key) {
    const f = this._echoue.get(key)
    return f !== undefined && this.frame - f < IMAGES_QUARANTAINE
  }

  _request(t, priority) {
    if (t.state !== 'empty') return
    if (this.continu && this._enQuarantaine(t.key)) return
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
    if (this.continu && this.queue.length >= PLAFOND_FILE) {
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
    this.queue.push({ t, priority })
    this._pump()
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
    if (!this.continu || !this.queue.length) return 0
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

  _pump() {
    while (this.inFlight < MAX_CONCURRENT && this.queue.length) {
      this.queue.sort((a, b) => b.priority - a.priority)
      const { t } = this.queue.shift()
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
          t.texture = texture
          t.heights = heights
          t.size = size
          t.state = 'ready'
          this._buildMesh(t)
        })
        .catch((err) => {
          const vivante = this.tiles.get(t.key) === t
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
    const G = gridFor(t.z)
    const nV = (G + 1) * (G + 1)
    const positions = new Float64Array(nV * 3) // absolues, en doubles : voir ci-dessus
    const normals = new Float32Array(nV * 3)
    const uvs = new Float32Array(nV * 2)
    const latlons = new Float32Array(nV * 2)
    const dispScale = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
    const v3 = new THREE.Vector3()

    // every vertex is projected EXACTLY onto the sphere (+ displaced along the
    // radius) — never interpolated across a flat quad
    const posAt = (u, v, out) => {
      const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
      const h = Math.max(sampleHeights(t.heights, u, v, t.size), 0) // oceans stay on the sphere
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
      // `G = gridFor(z) = 24`, tuile de 256 px, donc la fenêtre vaut
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

    const mesh = new THREE.Mesh(geo, this._materialFor(t.texture, t.size))
    mesh.position.copy(origine) // la position mondiale vit ICI, plus dans les sommets
    mesh.visible = false
    mesh.name = t.key
    t.mesh = mesh
    this.group.add(mesh)

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
    if (!this.enabled) return 0
    this.clouds.update(camera, dt)
    this.frame++
    const camPos = camera.position
    const camDir = camPos.clone().normalize()
    this._drawn = 0
    this._visites = 0
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
    for (const t of this.tiles.values()) {
      if (t.mesh) t.mesh.visible = false
      if (t.z > ROOT_Z && t.state === 'ready' && t.coverFrame !== prev && t.lastUsed !== prev) marge++
    }
    this._credit = this.cacheMax - this.tiles.size + marge

    for (const root of this.roots) this._traverse(root, camPos, camDir)

    // ⚠️ LA PURGE PASSE AVANT L'ÉVICTION, et l'ordre porte du sens : elle rend
    // des tuiles à `empty`, ce que l'éviction sait reprendre (rang 0), alors
    // qu'une `loading` fantôme lui échappe pendant IMAGES_BLOQUEE images.
    this._purgerFile()
    if (this.tiles.size > this.cacheMax) this._evict()
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
    this._visites++
    // ⚠️ LES RACINES z2 SONT EXEMPTÉES DES DEUX TRIS, et ce n'est pas une
    // faveur : elles portent la couverture de toute la planète, ce sont elles
    // qui dessinent tant que leurs enfants ne sont pas au complet. Les écarter
    // du parcours ouvrirait un trou à chaque bord d'écran.
    if (t.z > ROOT_Z) {
      // `t.center` est SUR la sphère de rayon `this.radius` (voir `_ensureTile`),
      // donc ce quotient est exactement le cosinus cherché — sans allocation.
      const dot = t.center.dot(camDir) / this.radius
      if (this.continu) {
        // horizon géométrique + marge de corde de la tuile
        if (this._horsHorizon(t, camDir)) return
        // ⚠️ ET C'EST CETTE LIGNE QUI FAIT LE TRAVAIL. Sans elle, réduire la
        // calotte ne fait que déplacer le point fixe du budget : le zoom reste
        // le même, quelle que soit l'altitude.
        if (!this._frustum.intersectsSphere(this._sphereDe(t))) return
      } else if (dot < -0.35) {
        // horizon cull: skip tiles fully on the far side of the planet
        return
      }
    }

    t.lastUsed = this.frame
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
    let wantSplit = t.z < MAX_Z && ratio > (t.refined ? MERGE_RATIO : SPLIT_RATIO)

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
      for (const k of kids) {
        k.lastUsed = this.frame // protect loading/fresh children from LRU
        if (k.state === 'empty') this._request(k, ratio)
      }
      // hole-free rule: descend only when all four children can draw —
      // any error keeps the parent covering the whole quad
      if (kids.every((k) => k.state === 'ready' && k.mesh)) {
        t.refined = true
        for (const k of kids) this._traverse(k, camPos, camDir)
        return
      }
    }

    t.refined = false
    if (t.state === 'ready' && t.mesh) {
      t.mesh.visible = true
      this._drawn++
    }
  }

  // les quatre enfants sont-ils DÉJÀ dans le cache ? (sans les créer — c'est
  // toute la différence avec `_children`, qui les fait naître)
  _enfantsPresents(t) {
    const z = t.z + 1
    const x = t.x * 2
    const y = t.y * 2
    return (
      this.tiles.has(tileKey(z, x, y)) &&
      this.tiles.has(tileKey(z, x + 1, y)) &&
      this.tiles.has(tileKey(z, x, y + 1)) &&
      this.tiles.has(tileKey(z, x + 1, y + 1))
    )
  }

  _children(t) {
    return [
      this._ensureTile(t.z + 1, t.x * 2, t.y * 2),
      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2),
      this._ensureTile(t.z + 1, t.x * 2, t.y * 2 + 1),
      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2 + 1),
    ]
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
    const bloquees = this.continu
      ? vivantes.filter((t) => this._bloquee(t)).sort((a, b) => a.lastUsed - b.lastUsed || parProfondeur(a, b))
      : []
    const candidates = vivantes.filter((t) => t.state === 'ready' && !(t.mesh && t.mesh.visible))
    const victimes = [
      ...bloquees,
      ...candidates.filter((t) => !porte(t)).sort((a, b) => a.lastUsed - b.lastUsed || parProfondeur(a, b)),
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
        t.mesh.material.dispose()
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
        t.mesh.material.dispose()
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
    this._rechargeTuiles()
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
    for (const t of this.tiles.values()) {
      if (t.mesh) {
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
      }
      t.texture?.dispose()
    }
    this.tiles.clear()
  }
}
