import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, ridged, smoothstep, lerp } from './noise.js'
import { sampleDem } from './dem.js'
import { buildRamp2D } from './palette.js'
import { gridTemplate } from './grid-template.js'
import { gridNormals } from './grid-normals.js'
import { detailField, detailFieldEmprise, accordeDetailScale, tintField, detailFieldEnCache, tintFieldEnCache, poserDetailField, poserTintField } from './detail-noise.js'
import { extraireYNy } from './monde/teinte-relief.js'
import { analyseMemoLire, analyseMemoEcrire } from './dem-memo.js'
import { coteMondialeDepuisChamp, rayonIncertitude, BASSIN_FRAC_DEFAUT } from './sea-mask.js'
import { ATLAS_ANALYSE, ATLAS_MER, fracBassinEmprise } from './dem-emprise.js'
// les huit demi-plans de la fenêtre, purs et testés — voir src/fenetre-clip.js
// ⚠️ ALIASÉ : la méthode `Terrain.plansFenetre()` rend des `THREE.Plane`, la
// fonction pure rend des descriptions. Le même nom pour les deux se lit comme
// une récursion qui n'existe pas.
import { plansFenetre as demiPlansFenetre, exposantCoin } from './fenetre-clip.js'
import { facteursCoins } from './damier-bords.js' // module pur, aucune importation
// ⚠️ `exageration-continue.js` N'IMPORTE RIEN, et c'est ce qui rend cette ligne
// possible : passer par `fenetre-bornee.js` fermerait le cycle terrain.js →
// fenetre-bornee.js → terrain.js et jetterait un ReferenceError EN PRODUCTION.
import { lireExageration } from './monde/exageration-continue.js'
// ⚠️ **LA COLORISATION NATURELLE N'EST PLUS ÉCRITE ICI — Tâche P2.** Ses
// formules vivaient dans le corps du fragment ci-dessous, hors d'atteinte du
// nuanceur du globe : c'est LA raison pour laquelle le crop rendait « une rampe
// lisse » là où le socle rend un relief peigné. Elles sont désormais dans un
// module PUR (`monde/naturel-crop.js`, aucune importation) que les DEUX
// nuanceurs INJECTENT. Ce n'est pas un rangement : c'est ce qui fait qu'il n'y a
// **qu'une seule écriture** de la loi, et `test/crop-naturel.test.js` interdit
// qu'une seule de ces formules réapparaisse ici.
import { GLSL_NATUREL } from './monde/naturel-crop.js'
// ⚠️ **MÊME GESTE, DEUX LOIS DE PLUS — Tâche P3.** `natGris` (la valeur par
// sommet : dégradé d'altitude × assombrissement de pente) et `natOmbrePeinture`
// (le `fxShade` qui dose la peinture contre la matière) vivaient ICI, et le
// crop en a besoin dès qu'il est éclairé : ce fond presque neutre pèse **32 %**
// de l'albédo du socle, et c'est lui, avec l'environnement, qui fabrique les
// neutres que le noteur trouve **5,7 fois** trop rares sur le crop.
// `test/crop-eclairage.test.js` interdit que l'une des deux réapparaisse ici.
import { natGris, GLSL_OMBRE_PEINTURE } from './monde/eclairage-crop.js'
// ⚠️ **ET LES MODES DE MÉLANGE AUSSI — Tâche P3.** `blLum`/`blClip`/`blSetLum`
// étaient écrits ICI **et** dans `globe.js`, chacun avec un commentaire disant
// que deux écritures finiraient par diverger. Le crop doit porter la couche
// Apparence (le gabarit d'ouverture l'allume : `surfaceFx = 9`), donc il lui
// faut `fxBlend` : c'était l'occasion de fermer la dette au lieu d'en créer une
// troisième. Le texte est identique au bit près à celui qui vivait ici.
import { GLSL_MELANGE } from './monde/melange-crop.js'
// L'analyse de relief et le masque de mer ne sont plus calcules ici : ils
// partent dans un Worker (terrain-jobs.js). ~470 ms de fil principal fige par
// reconstruction, sur MNT 1536². Le calcul est identique octet pour octet.
import { scheduleTerrainJob, jobStillValid, jobCouvertParEnVol, runTeinteJob, runGrainJob } from './terrain-jobs.js'
import { TEXTURE_BUILDERS } from './material-textures.js'
import { MATERIALS } from './material-catalog.js'
import { FX_GLSL } from './fx-glsl.js' // shared with src/ui/fx-thumbs.js — see that file's header
import { MeshTransmissionMaterial } from './vendor/MeshTransmissionMaterial.js'

// full-relief opaque material modes (glass is handled separately). Derived from
// the shared material catalog so a new relief material is a single entry there —
// this map, the picker, and templates all pick it up automatically. Each preset
// drapes its texture stack over the terrain and fades the hypsometric paint.
//   dir  → real CC0 PBR set lazy-loaded from public/textures/<id>/
//   tex  → procedural CanvasTexture stack (material-textures.js)
//   flow → >0 scrolls the maps each frame (moving sand)
const OPAQUE_TERRAIN_MATS = Object.fromEntries(
  MATERIALS.filter((m) => m.kind === 'dir' || m.kind === 'tex').map((m) => [m.id, m])
)

// Tiling density scales with the DEM zoom so a relief material never reads as
// obvious repetition when the whole continent is in frame (coarse zoom) yet
// keeps its detail up close. Central helper → every material (incl. future ones)
// inherits it. z15 → full density, coarse → few large tiles.
function zoomRepeat(z = 15) {
  const f = (z - 3) / 12
  return Math.max(0.22, Math.min(1, f))
}

// dispose the previous clone and return a fresh tiled clone of `src`
function swapClone(prev, src, repeat) {
  if (prev) prev.dispose()
  if (!src) return null
  const c = src.clone()
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.repeat.set(repeat, repeat)
  c.needsUpdate = true
  return c
}

export const TERRAIN_SIZE = 56

// Plafond de résolution du maillage en mode fenêtre continue — voir
// `Terrain.resMaillage` pour la mesure qui l'impose.
export const RES_FENETRE_CONTINUE = 384

// Fancy surface-shader ids match the `surfaceFx` GLSL switch below; their
// labels, defaults and per-effect controls live in src/fx-meta.js.

// 1×1 black texture — inert placeholder for the cloud-shadow sampler
function blackTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat)
  tex.needsUpdate = true
  return tex
}

// 1×1 white texture — inert placeholder for the region-mask sampler
function whiteTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat)
  tex.needsUpdate = true
  return tex
}

// 1×1 RGBA « tout neutre » — placeholder du sampler d'analyse du relief. 128 est
// le zéro de nos quatre canaux (courbure nulle, ni creux ni bosse, aucune
// exposition) : tant qu'aucune analyse n'est cuite, la lire ne change RIEN.
function neutralTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat)
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

// Plafond du détail FBM en mode Naturel — voir _makeDemSampler.
const NATURAL_DETAIL_MAX = 0.15
// Le bump procédural, ramené à ce facteur en mode Naturel — voir _bumpScale.
const NATURAL_BUMP_K = 0.3

export const BASIN_RADIUS = 6.6 // flat excavation floor
export const BASIN_BLEND = 9.0 // where flat floor blends back into mountains
export const FLOOR_Y = -0.35

// ══════════ L'AUTORITÉ DU TRAIT DE CÔTE — UN PRÉDICAT, DEUX LECTEURS ════════
//
// Le fragment tranche `underwater` sur « le trait de côte fait-il autorité ? »,
// et il ne lit `seaMask` QUE dans l'autre branche — c'est l'unique
// échantillonnage de ce champ dans tout le nuanceur. Le CPU doit donc décider
// de le CUIRE sur exactement la même condition (voir `_buildFields`).
//
// ⚠️ POURQUOI UNE CONSTANTE ET NON DEUX ÉCRITURES JUMELLES. Le jour où elles
// divergeraient, le bloc s'afficherait SANS MER ET SANS ERREUR : le champ
// simplement jamais cuit, `uSeaMaskOn` resté à zéro, aucune exception nulle
// part, aucun nuanceur en défaut. C'est la panne la plus chère à trouver —
// celle qui ne fait pas de bruit. D'où la source unique : le GLSL du fragment
// INTERPOLE cette chaîne, `coteFaitAutorite` relit le même uniforme au même
// seuil, et il n'y a qu'une ligne à changer pour bouger les deux.
//
// ⚠️ `toFixed(1)` n'est pas cosmétique : un entier nu (« 1 ») ne compile pas
// comme flottant en GLSL, et c'est tout le nuanceur qui tomberait.
// (test/mer-cuisson.test.js verrouille les deux bouts sur le fragment ASSEMBLÉ,
// pas sur une relecture du texte source.)
const SEUIL_AUTORITE_COTE = 0.5
export const COTE_AUTORITE_GLSL = `uCoastMaskOn > ${SEUIL_AUTORITE_COTE.toFixed(1)}`
export const coteFaitAutorite = (uniformes) => (uniformes?.uCoastMaskOn?.value ?? 0) > SEUIL_AUTORITE_COTE

// CPU-generated terrain: multi-scale FBM + ridged multifractal + domain warping,
// with real vertex normals so PBR lighting and DOF read the actual relief.
export class Terrain {
  // opts.offset {x,z} : bloc VOISIN du damier (block-grid.js) — le mesh est
  // décalé dans le monde et uBlockOffset ramène clip + masques en coordonnées
  // locales au bloc. Le bloc principal garde (0,0) : comportement identique.
  // opts.analysisMax : plafond du côté de l'analyse de relief (voir _buildFields).
  // 0 = aucun plafond, c'est le bloc central, le héros.
  // opts.seaMax : le MÊME plafond, pour le masque de mer. Séparé parce que les
  // deux champs n'ont ni le même poids par pixel (RGBA + mipmaps contre R8) ni
  // la même raison d'être fin — les confondre un jour coûterait de la mer
  // crénelée pour économiser sur le peigné, ou l'inverse.
  // opts.shareFrom : le Terrain dont ce bloc EMPRUNTE rampe, rugosité et bump
  // (voir shareTexturesFrom). Posé AVANT rebuildRamp/rebuildRoughness, sinon la
  // construction cuit les deux textures pour les jeter à la ligne suivante.
  constructor(params, opts = {}) {
    this.blockOffset = { x: opts.offset?.x ?? 0, z: opts.offset?.z ?? 0 }
    // ══════════ LA FENÊTRE CONTINUE ═════════════════════════════════════════
    // Décalage, en unités monde, de ce que la géométrie LIT dans le champ. La
    // géométrie, elle, ne bouge jamais : c'est ce qui permet de ne traiter que
    // 148 225 sommets au lieu de 594 441 (étude 3×3 §3.3).
    //
    // ⚠️ À DISTINGUER de `blockOffset`, juste au-dessus, avec qui on le
    // confondra un jour. `blockOffset` déplace le MESH dans le monde (une dalle
    // voisine du damier). `fenetre` déplace la LECTURE dans le champ. L'un
    // bouge l'objet, l'autre bouge son contenu.
    //
    // À (0,0) — et c'est l'invariant de tout le jalon — le comportement est
    // rigoureusement celui d'avant : `empriseCote` vaut 1 sur un bloc ordinaire,
    // donc `_span()` rend TERRAIN_SIZE et la formule redevient l'ancienne.
    this.fenetre = { x: 0, z: 0 }
    // La finesse du maillage en mode continu, posée par main.js une fois par
    // image (fenetre-finesse.js). Zéro = « personne n'a d'avis », et on retombe
    // sur le plafond permanent du jalon 3. Voir `resMaillage`.
    this.resFenetre = 0
    this.analysisMax = opts.analysisMax ?? 0
    this.seaMax = opts.seaMax ?? 0
    if (opts.shareFrom) this.shareTexturesFrom(opts.shareFrom)
    // Physical material so the relief can turn to GLASS: `transmission` is real
    // PBR refraction (three renders the scene behind into a buffer), giving the
    // translucent-slab look — dial it with the "transmission (glass)" slider.
    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.color),
      roughness: 1, // actual roughness baked into the roughness map
      metalness: 0,
      vertexColors: true,
      envMapIntensity: params.envMapIntensity,
      transmission: params.transmission ?? 0,
      thickness: 3,
      ior: 1.45,
    })

    // topographic map overlay: hypsometric tint, contour lines and survey grid,
    // computed per-fragment in world space so they drape over the relief
    this.mapUniforms = {
      uTint: { value: params.mapTint },
      uContourInterval: { value: params.contourInterval },
      uContourOpacity: { value: params.contourOpacity },
      uContourWeight: { value: params.contourWeight ?? 0.7 }, // line thickness scale

      uGridStep: { value: params.gridStep },
      uGridOpacity: { value: params.gridOpacity },
      uHeightRange: { value: new THREE.Vector2(-0.5, 2) },
      uRampTex: { value: null },
      uHeightContrast: { value: params.heightContrast },
      uHeightPivot: { value: params.heightPivot },
      uSlopeTint: { value: params.slopeTint },
      uContourColor: { value: new THREE.Color(params.contourColor) },
      // real-world bathymetry: scene-space sea level + depth range (meters
      // mapped through the DEM scale); uSeaY = -9999 disables (procedural)
      uSeaY: { value: -9999 },
      uSeaRange: { value: 1 },
      // ocean mask (sea-mask.js): white = the real sea (connected to the map
      // edge, or a large basin). The height test is ANDed with this so isolated
      // sub-sea DEM pockets render as land valleys, not phantom lakes/inlets.
      uSeaMask: { value: (this._seaPlaceholder = whiteTexture()) },
      uSeaMaskOn: { value: 0 },
      uCoastMask: { value: (this._coastPlaceholder = whiteTexture()) },
      uCoastMaskOn: { value: 0 },
      // Fancy > Surface shader: an animated procedural pattern painted onto the
      // relief albedo (like Liquid metal treats the surface, but coloured &
      // moving). 0 = off; 1..N select an effect. Self-contained GLSL, no dep.
      uSurfaceFx: { value: 0 },
      uFxTime: { value: 0 },
      uFxScale: { value: 1 },
      uFxOpacity: { value: 1 },
      uFxColA: { value: new THREE.Color('#e9e2d3') },
      uFxColB: { value: new THREE.Color('#a9765a') },
      uFxColC: { value: new THREE.Color('#20242c') },
      uFxP1: { value: 0.5 },
      uFxP2: { value: 0.5 },
      uFxP3: { value: 0.5 },
      uFxBlend: { value: 0 }, // Appearance blend mode (Figma set), 0 = Normal
      // Liquid metal: animated molten flow (perturbs the normal so the chrome
      // reflections ripple). uLmFlowAmt 0 = still mirror.
      uLmOn: { value: 0 },
      uLmFlow: { value: 0 },
      uLmFlowAmt: { value: 0 },
      // clip the map to the slab's rounded-rectangle footprint (world XZ) so the
      // block's vertical corners read soft and nothing overhangs the plinth walls
      uSlabHalf: { value: TERRAIN_SIZE / 2 },
      // décalage monde du bloc (damier) : clip + masques passent en local
      uBlockOffset: { value: new THREE.Vector2(this.blockOffset.x, this.blockOffset.z) },
      // ══════════ MODE CONTINU : LES MASQUES DÉFILENT, LE CLIP NON ═══════════
      //
      // `uMaskSpan` est la largeur AU SOL des masques posés en texture, et
      // `uFenetre` le décalage de lecture du mode continu. Hors mode continu ils
      // valent TERRAIN_SIZE et (0,0) : l'expression d'uv redevient celle d'avant
      // au bit près, et c'est ce que verrouille le premier test de
      // test/mer-emprise.test.js.
      //
      // ⚠️ ILS NE VONT PAS SUR LE CLIP DE SOCLE. Le clip de superellipse et le
      // fondu de bord sont la FENÊTRE (les meubles) ; les masques sont le MONDE
      // (le paysage). Leur donner le même décalage ferait défiler le socle
      // lui-même — c'est-à-dire disparaître le bloc.
      uMaskSpan: { value: TERRAIN_SIZE },
      uFenetre: { value: new THREE.Vector2(0, 0) },
      // v42: MEME arrondi que la mer (rayon clampe, cercle) - l'ecart entre
      // le coin du socle et celui de l'eau se voyait (retour Adrien)
      uSlabCorner: { value: Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE)) },
      // ══════ QUELS COINS CE BLOC A LE DROIT D'ARRONDIR (damier) ═════════════
      // (ne, se, so, no), 1 = arrondi, 0 = coin vif. Posé par setBordsDamier(),
      // et (1,1,1,1) tant que personne ne parle : le bloc isolé, la fenêtre
      // continue et le mode zone isolée gardent EXACTEMENT le clip d'avant.
      // ⚠️ DES FACTEURS, PAS DES RAYONS. Le rayon nominal reste uSlabCorner, que
      // le curseur du panneau Block réécrit en direct : stocker quatre rayons
      // ici obligerait à les rafraîchir à chaque mouvement de curseur, et le
      // premier oubli figerait l'arrondi du damier sur sa valeur d'alors.
      uCoinsDamier: { value: new THREE.Vector4(1, 1, 1, 1) },
      // optional aerial-photo skin (src/map/aerial-layer.js) — off unless a
      // texture is set. uAerialOffset/Scale place the tile mosaic on the block
      // (the grid always overhangs the patch); uAerialOpacity is the dial that
      // decides how much of the product's own look survives — see the mix below.
      uAerial: { value: blackTexture() }, // never null: a null sampler fails to compile on some drivers
      uAerialOn: { value: 0 },
      uAerialOpacity: { value: 1 },
      uAerialOffset: { value: new THREE.Vector2(0, 0) },
      uAerialScale: { value: new THREE.Vector2(1, 1) },
      // v49 : la photo aérienne ne vit qu'à la côte — au large elle s'estompe
      // pour laisser place au shader de fond marin (rampe nautique + caustics).
      // Fondu par profondeur sous le niveau de la mer (proxy de distance au
      // rivage) : fraction de uSeaRange sur laquelle l'aérien passe de 1 à 0.
      // 0 = fondu désactivé (photo pleine partout, ancien comportement).
      uAerialCoastFade: { value: 0.1 },
      // LUMIÈRES NOCTURNES (onglet « Couches », dosées par le Gardien). Même
      // drapage que la photo — uvSolDrape — mais peintes en ADDITIF : ce sont
      // des lumières, pas une image. uNuitIntensite porte déjà le facteur de
      // l'heure, calculé côté JS par intensiteNuit() dans src/nuit.js ; à 0 le
      // bloc entier est sauté plutôt que de peindre du noir sur du noir.
      uNuit: { value: blackTexture() }, // jamais null : un échantillonneur nul ne compile pas sur certains pilotes
      uNuitOn: { value: 0 },
      uNuitIntensite: { value: 0 },
      uNuitOffset: { value: new THREE.Vector2(0, 0) },
      uNuitScale: { value: new THREE.Vector2(1, 1) },
      // LES DEUX TIRETTES DEMANDÉES PAR ADRIEN. C'étaient deux CONSTANTES du
      // nuanceur (NUIT_FOND = 0,22 et NUIT_GAIN = 3,4) ; leurs valeurs de
      // départ ici les reproduisent au bit près, et leurs commentaires
      // d'origine — le POURQUOI de 0,22 et de 3,4 — ont suivi dans
      // src/reglages-couches.js, avec la conversion tirette → uniforme.
      // ⚠️ uNuitFond dit CE QUI RESTE du sol, la tirette dit COMBIEN ON ÉTEINT :
      // les deux nombres sont opposés. `fondNuit` est le seul endroit où cette
      // inversion vit.
      uNuitFond: { value: 0.22 },
      uNuitGain: { value: 3.4 },
      // OCCUPATION DU SOL (onglet « Couches »). Même drapage que la photo et
      // que les lumières — uvSolDrape — mais la texture ne porte PAS une image :
      // elle porte des CODES DE CLASSE ESA WorldCover, un par octet.
      //
      // ⚠️ uSol N'EST PAS UNE COULEUR, ET RIEN DANS LE TYPE NE LE DIT. C'est
      // uSolLut, la table 256×1, qui transforme un code en teinte (RVB) et en
      // force (alpha). Voir src/map/occupation-sol-layer.js pour les quatre
      // réglages de texture qui rendent la lecture exacte — et qui, oubliés, ne
      // lèvent aucune erreur.
      uSol: { value: blackTexture() }, // code 0 partout = « pas de donnée », force nulle
      uSolLut: { value: blackTexture() },
      uSolOn: { value: 0 },
      // ⚠️ 2, LE DÉFAUT RÉEL — voir SOL_FORCE_DEFAUT dans src/reglages-couches.js.
      // À 0,5, la prairie (force 0,18 à l'époque) peignait à 9 % : Adrien ne
      // voyait « presque aucun changement sur la map ». La tirette « Force » du
      // panneau Couches écrit ici, et sa course va de 0 à 4 (SOL_FORCE_MAX),
      // exactement comme celle de la canopée.
      //
      // ⚠️ CETTE VALEUR ET CE COMMENTAIRE MENTAIENT TOUS LES DEUX depuis le
      // doublement : il était écrit « elle monte jusqu'à 2 » (c'est 4) et la
      // valeur initiale était 1 (le défaut est 2). L'écart ne se voyait pas à
      // l'écran parce que `appliqueReglagesCouches` repose l'uniforme au
      // démarrage — mais toute lecture du fichier partait faussee, et le jumeau
      // canopée, lui, dit correctement 4 : l'écart entre les deux était ce qu'il y
      // avait de plus trompeur.
      uSolOpacite: { value: 2 },
      uSolOffset: { value: new THREE.Vector2(0, 0) },
      uSolScale: { value: new THREE.Vector2(1, 1) },
      // 1 / taille de la mosaïque en texels : c'est ce qui permet au nuanceur
      // d'aller chercher les QUATRE voisins exacts pour son mélange par couleur.
      uSolTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
      // HAUTEUR DE CANOPÉE (onglet « Couches »). Même drapage que les trois
      // couches ci-dessus — uvSolDrape — et, comme l'occupation du sol, une
      // texture qui ne porte PAS une image.
      //
      // ⚠️ MAIS ELLE PORTE UN NOMBRE CONTINU, PAS UN CODE, ET TOUT EN DÉCOULE.
      // Un octet de uCanopee EST une hauteur en MÈTRES. Entre 10 et 12 il y a
      // 11, et 11 m est une hauteur réelle : le filtrage linéaire est licite ici
      // alors qu'il détruirait uSol (relire src/map/canopee-layer.js, dont
      // l'en-tête ne sert qu'à ça). C'est pour la même raison qu'il n'y a pas
      // besoin de mélanger quatre voisins à la main : le GPU le fait pour lui, et
      // il en a le droit.
      //
      // ⚠️ IL ÉTAIT ÉCRIT ICI « il n'y a pas d'uCanopeeTexel », ET C'EST FAUX.
      // L'uniforme est déclaré treize lignes plus bas, lu par `ombreLisiere`, et
      // remis à jour depuis la taille réelle de la mosaïque. Le commentaire datait
      // d'avant l'ombrage de lisière, et il désignait un uniforme VIVANT comme
      // inexistant : un nettoyage d'uniformes morts l'aurait supprimé.
      uCanopee: { value: blackTexture() }, // 0 m partout = « pas d'arbre » = force nulle
      uCanopeeLut: { value: blackTexture() },
      uCanopeeOn: { value: 0 },
      // La tirette « Force » du panneau Couches écrit ici. Défaut 2, course 0-4,
      // exactement comme l'occupation du sol — voir CANOPEE_FORCE_DEFAUT dans
      // src/reglages-couches.js.
      uCanopeeOpacite: { value: 2 },
      uCanopeeOffset: { value: new THREE.Vector2(0, 0) },
      uCanopeeScale: { value: new THREE.Vector2(1, 1) },
      // Le pas d'échantillonnage de l'OMBRAGE DE LISIÈRE, en unités d'UV de la
      // mosaïque. Il vaut un texel : voir `ombreLisiere` dans le nuanceur pour
      // ce que cet ombrage prétend (peu) et ce qu'il ne prétend pas (du volume).
      uCanopeeTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
      // drifting cloud shadows, baked by the cloud deck (clouds.js) — a black
      // placeholder keeps the sampler valid until the deck provides its map
      uCloudShadow: { value: blackTexture() },
      uCloudShadowOff: { value: new THREE.Vector2() },
      uCloudShadowK: { value: 0 },
      // teinte d'ombre de la carte (meme recette que le SSAO) — 0,0,0 = noir
      // pur, l'ancien comportement
      uCloudShadowTint: { value: new THREE.Vector3(0.3, 0.3, 0.34) },
      // superellipse exponent for the corner: 2 = circular arc, higher = squircle
      // (iOS-style continuous corner). Shared with the plinth ring, see plinth.js
      // v43 : la valeur est ENFIN relue. `slabCornerSmoothing` était exposé,
      // persisté dans les gabarits et jamais branché — l'exposant restait en dur
      // à 2 ici comme dans plinth.js. Le socle, le relief ET la mer partagent
      // maintenant `exposantCoin` : un seul coin, pas trois.
      uSlabCornerN: { value: exposantCoin(params.slabCornerSmoothing) },
      // region cutout ("individualiser la zone"): white-inside/black-outside
      // mask rendered over the DEM footprint (region-mask.js). When uRegionOn
      // the terrain is clipped to the admin boundary and the superellipse slab
      // clip is bypassed. Placeholder stays white so sampling is always valid.
      uRegionMask: { value: (this._regionPlaceholder = whiteTexture()) },
      uRegionOn: { value: 0 },
      // caustiques projetées AU FOND (sur le relief sous-marin) : intensité
      // (0 = off, piloté par waterRebuild) + temps d'animation (tick main.js)
      uSeaCausK: { value: 0 },
      uCausT: { value: 0 },
      uOceanShallow: { value: new THREE.Color(params.oceanShallow ?? '#dce8ec') },
      uOceanMid: { value: new THREE.Color(params.oceanMid ?? '#7fa8b8') },
      uOceanDeep: { value: new THREE.Color(params.oceanDeep ?? '#31576b') },
      uGridColor: { value: new THREE.Color(params.gridColor ?? '#242220') },
      uScanT: { value: -1 }, // scan progress 0..1, negative = inactive
      uScanColor: { value: new THREE.Color(params.scanColor) },
      uScanWidth: { value: params.scanWidth },
      uScanBlur: { value: params.scanBlur },
      uScanDispH: { value: params.scanDispHeight },
      uScanDispW: { value: params.scanDispFalloff },
      uScanType: { value: 0 }, // 0 radar, 1 elevation, 2 gridline, 3 sonar, 4 holo
      uScanOrigin: { value: new THREE.Vector2(0, 0) }, // scan epicenter, world XZ
      uScanMax: { value: TERRAIN_SIZE * 0.75 }, // radius that guarantees full coverage
      // material noise: a relief material can be broken up by procedural noise —
      // lifted into 3D where the noise is high, and FADED AWAY where it's low so
      // the layer underneath (the hypsometric map paint / a surface shader) shows
      // through. The transition is soft (smoothstep band), never a hard cut.
      uMatNoiseOn: { value: 0 },
      uMatNoiseAmt: { value: 0 }, // displacement height of the raised material patches
      uMatNoiseCut: { value: 0 }, // reveal threshold (higher = more of the map shows through)
      uMatNoiseSoft: { value: 0.2 }, // half-width of the smoothstep band → diffuse edges
      uMatNoiseScale: { value: 0.5 }, // patch frequency in world units
      // "Au-dessus du niveau zéro": when on, the relief material paints only
      // above sea level; below uSeaY the surface shows the hypsometric map colour.
      uMatAboveZero: { value: 0 },

      // ---------------------------------------------- COLORISATION NATURELLE
      // Ce que la rampe 1D ne peut PAS faire : elle donne forcément une couleur
      // constante le long de chaque courbe de niveau. Le mode Naturel lit
      // l'analyse du relief (src/terrain-analysis.js) et ajoute un second axe
      // (l'humidité), le rendu peigné des crêtes, et la perspective aérienne.
      //
      // uColorMode est un int lu en CHAÎNE if/else, pas un #define : le projet a
      // déjà ce patron deux fois (uScanType, uSurfaceFx), et un #define
      // forcerait une recompilation de shader de 100-300 ms à chaque bascule.
      uColorMode: { value: params.colorMode === 'natural' ? 1 : 0 }, // 0 = Classique (rendu historique)
      uAnalysis: { value: (this._analysisPlaceholder = neutralTexture()) },
      uAnalysisOn: { value: 0 },
      uTexShade: { value: params.texShade ?? 0 }, // intensité du peigné
      uWetK: { value: params.wetK ?? 0 }, // poids de l'humidité sur l'axe Y du LUT
      uExpoK: { value: params.expoK ?? 0 }, // poids de l'exposition (adret/ubac)
      uHemi: { value: 1 }, // +1 hémisphère nord, −1 sud : l'ubac change de côté
      uTreeLine: { value: params.treeLine ?? 0.62 }, // en hNorm : au-dessus, plus de végétation
      // perspective aérienne (Imhof) : DEUX composantes indépendantes, la
      // distance ET l'altitude — voir le fragment
      uHazeAmt: { value: params.hazeAmt ?? 0 },
      uHazeAlt: { value: params.hazeAlt ?? 0.5 },
      uHazeDist: { value: params.hazeDist ?? 0.5 },
      uHazeColor: { value: new THREE.Color(params.hazeColor ?? '#b9c6d6') },
      // ══════ LE DOMAINE DE RÉFÉRENCE DU MODE NATUREL — Tâche BLA ══════════
      // `hNorm` vivant → `hNorm` de référence pour la limite des arbres et le
      // voile d'altitude (rampe-fixe.js, `facteursHNormRef`). ⚠️ (1, 0) EST
      // L'IDENTITÉ AU BIT : sans référence posée, le nuanceur lit `hNorm`.
      uHNormRefA: { value: 1 },
      uHNormRefB: { value: 0 },
      // la distance du voile en mètres : `fd` × ce facteur (`facteurDistanceVoile`),
      // 1 = la grandeur d'avant, en demi-côtés de bloc
      uFdFacteur: { value: 1 },
      // ═══ DIFFUSION SOUS-SURFACIQUE — UNE PROPRIÉTÉ DE MATIÈRE, PAS UN EFFET ═
      //
      // Adrien : « on peut plutôt tester un matériau avec SSS dans la partie
      // matière du relief ». C'est le bon endroit, et pas seulement par commodité
      // d'interface : la translucidité n'est pas un réglage de rendu qu'on
      // pousse sur une scène, c'est ce qui distingue l'albâtre du plâtre. Elle
      // appartient donc au matériau, comme sa rugosité — voir le champ `sss`
      // dans material-catalog.js. Une matière qui ne la déclare pas met
      // simplement uMatSSS à zéro.
      uMatSSS: { value: 0 },
      uMatSSSTeinte: { value: new THREE.Color('#ff8a4c') },
      uMatSSSPower: { value: 4 },
    }
    this.rebuildRamp(params)
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.mapUniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
uniform float uScanT;
uniform float uScanDispH;
uniform float uScanDispW;
uniform int uScanType;
uniform vec2 uScanOrigin;
uniform float uScanMax;
uniform float uMatNoiseOn;
uniform float uMatNoiseAmt;
uniform float uMatNoiseCut;
uniform float uMatNoiseSoft;
uniform float uMatNoiseScale;
float mnHash(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mnHash(i), mnHash(i+vec2(1.0,0.0)), f.x), mix(mnHash(i+vec2(0.0,1.0)), mnHash(i+vec2(1.0,1.0)), f.x), f.y); }`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
// material noise: raise the relief material into 3D where the noise is high, and
// leave the low areas at the base height so the revealed map reads flat underneath.
// Same soft band as the fragment reveal so the geometry and the paint agree.
if (uMatNoiseOn > 0.5) {
  float mn = mnNoise(transformed.xz * uMatNoiseScale);
  float matMask = smoothstep(uMatNoiseCut - uMatNoiseSoft, uMatNoiseCut + uMatNoiseSoft, mn);
  transformed.y += uMatNoiseAmt * matMask * mn;
}
// scan wave physically lifts the surface as it sweeps outward from the scan
// origin -- only the radial scans (radar, sonar) displace geometry
if (uScanT >= 0.0 && (uScanType == 0 || uScanType == 3)) {
  float dV = distance(transformed.xz, uScanOrigin);
  // radar eases its radius (matches the fragment ring); sonar rings run linear
  float tV = (uScanType == 0) ? (1.0 - pow(1.0 - uScanT, 3.0)) : uScanT;
  float RV = tV * uScanMax;
  float bumpV = exp(-pow((dV - RV) / max(uScanDispW, 0.05), 2.0));
  float liftScaleV = (uScanType == 3) ? 0.4 : 1.0;
  transformed.y += uScanDispH * liftScaleV * bumpV * (1.0 - smoothstep(0.6, 1.0, uScanT));
}
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
uniform float uMatNoiseOn;
uniform float uMatNoiseCut;
uniform float uMatNoiseSoft;
uniform float uMatNoiseScale;
uniform float uMatAboveZero;
float mnHash(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mnHash(i), mnHash(i+vec2(1.0,0.0)), f.x), mix(mnHash(i+vec2(0.0,1.0)), mnHash(i+vec2(1.0,1.0)), f.x), f.y); }
uniform float uTint;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uContourWeight;
uniform float uGridStep;
uniform float uGridOpacity;
uniform vec2 uHeightRange;
uniform sampler2D uRampTex;
uniform float uHeightContrast;
uniform float uHeightPivot;
uniform float uSlopeTint;
uniform float uSeaY;
uniform float uSeaRange;
uniform sampler2D uSeaMask;
uniform float uSeaMaskOn;
uniform sampler2D uCoastMask;
uniform float uCoastMaskOn;
// analyse du relief empaquetée (terrain-analysis.js) :
//   R = texture shading (peigné, 0.5 = plat)   G = ombrage classique
//   B = humidité topographique (0.5 = neutre)  A = exposition (1 = plein nord)
uniform sampler2D uAnalysis;
uniform float uAnalysisOn;
uniform int uColorMode;
uniform float uTexShade;
uniform float uWetK;
uniform float uExpoK;
uniform float uHemi;
uniform float uTreeLine;
uniform float uHazeAmt;
uniform float uHazeAlt;
uniform float uHazeDist;
uniform vec3 uHazeColor;
uniform float uHNormRefA; // hNorm vivant → hNorm de référence (Tâche BLA)
uniform float uHNormRefB;
uniform float uFdFacteur; // demi-côtés de bloc → fractions de DISTANCE_VOILE_M
uniform float uSeaCausK;
uniform float uCausT;
// caustique fond marin — phase itérée (Hoskins), projetée sur le RELIEF
float seaCaustic(vec2 p, float t) {
  vec2 ii = p;
  float c = 1.0;
  for (int n = 0; n < 3; n++) {
    float ft = t * (1.0 - (3.5 / float(n + 1)));
    ii = p + vec2(cos(ft - ii.x) + sin(ft + ii.y), sin(ft - ii.y) + cos(ft + ii.x));
    c += 1.0 / length(vec2(p.x / (sin(ii.x + ft) / 0.6), p.y / (cos(ii.y + ft) / 0.6)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 6.0), 0.0, 1.0);
}
uniform vec3 uOceanShallow;
uniform vec3 uOceanMid;
uniform vec3 uOceanDeep;
uniform vec3 uGridColor;
uniform vec3 uContourColor;
uniform float uSlabHalf;
uniform float uSlabCorner;
uniform float uSlabCornerN;
uniform vec4 uCoinsDamier; // (ne, se, so, no) — voir le clip de socle plus bas
uniform float uMaskSpan; // largeur au sol des masques (56, ou 168 sur l'emprise 3×3)
uniform vec2 uFenetre;   // décalage de lecture du mode continu (0 sinon)
uniform vec2 uBlockOffset;
uniform sampler2D uRegionMask;
uniform float uRegionOn;
uniform sampler2D uCloudShadow;
uniform vec2 uCloudShadowOff;
uniform sampler2D uAerial;
uniform float uAerialOn;
uniform float uAerialOpacity;
uniform vec2 uAerialOffset;
uniform vec2 uAerialScale;
uniform float uAerialCoastFade;
uniform sampler2D uNuit;
uniform float uNuitOn;
uniform float uNuitIntensite;
uniform vec2 uNuitOffset;
uniform vec2 uNuitScale;
uniform float uNuitFond;
uniform float uNuitGain;
// ═══ POURQUOI CES QUATRE-LÀ SONT DERRIÈRE UN #ifdef, ET PAS LES AUTRES ═══════
//
// LE DÉFAUT MESURÉ (gabarit « java », 2026-08-03) : le terrain ne linkait plus.
//   FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)
// Le relief disparaissait purement et simplement — écran vide sous les
// étiquettes. Le compte : 12 samplers de ce nuanceur + map, normalMap,
// roughnessMap et bumpMap du matériau de surface + l'environnement + la carte
// d'ombre = 18. Deux de trop, et rien dans l'interface ne le disait.
//
// ⚠️ UN TEST if (uSolOn > 0.5) NE COÛTE RIEN EN CALCUL MAIS COÛTE UNE UNITÉ DE
// TEXTURE. C'est le piège : le compilateur ne peut pas éliminer un sampler dont
// l'usage dépend d'un UNIFORM — il ne connaît sa valeur qu'à l'exécution. Une
// couche éteinte payait donc son unité comme une couche allumée, et le budget du
// Gardien, qui compte des mégaoctets, ne voyait rien de tout ça.
//
// CES DEUX FAMILLES ET PAS D'AUTRES, pour une raison de fréquence : elles ne
// s'allument que sur un geste EXPLICITE d'Adrien dans l'onglet Couches. Gater de
// la même façon uAerial serait une faute — il bascule tout seul au gré des
// tuiles qui arrivent, et chaque bascule recompilerait les neuf à vingt-trois
// programmes du damier en plein déplacement.
//
// (Et pas d'accent grave dans ce pavé : il vit dans un littéral gabarit JS, où
// un seul le refermerait et casserait tout le nuanceur. Déjà payé deux fois.)
#ifdef SHIBU_SOL
uniform sampler2D uSol;
uniform sampler2D uSolLut;
#endif
uniform float uSolOn;
uniform float uSolOpacite;
uniform vec2 uSolOffset;
uniform vec2 uSolScale;
uniform vec2 uSolTexel;
#ifdef SHIBU_CANOPEE
uniform sampler2D uCanopee;
uniform sampler2D uCanopeeLut;
#endif
uniform float uCanopeeOn;
uniform float uCanopeeOpacite;
uniform vec2 uCanopeeOffset;
uniform vec2 uCanopeeScale;
uniform vec2 uCanopeeTexel;
uniform float uMatSSS;
uniform vec3 uMatSSSTeinte;
uniform float uMatSSSPower;
uniform float uCloudShadowK;
uniform vec3 uCloudShadowTint;
uniform float uScanT;
uniform vec3 uScanColor;
uniform float uScanWidth;
uniform float uScanBlur;
uniform int uScanType;
uniform vec2 uScanOrigin;
uniform float uScanMax;

// --- scan helpers (shared by every scan type) ---
// antialiased ring/band mask: 1 at distance R, feathered over width w + blur
float scanBand(float d, float R, float w, float blur) {
  return 1.0 - smoothstep(0.0, max(blur, fwidth(d)), abs(d - R) - w * 0.5);
}
// cheap stateless hash for shimmer / flicker / blocky-reveal patterns
float scanHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// --- Fancy surface shaders (self-contained, animated procedural patterns
// painted onto the relief albedo; each effect reads the shared uFx* controls
// so the UI can expose per-shader options; see the surfaceFx switch). ---
uniform int uSurfaceFx;
uniform float uFxTime;   // accumulated at the effect's speed (0 = frozen)
uniform float uFxScale;
uniform float uFxOpacity;
uniform vec3 uFxColA;    // per-effect colours (meaning depends on the effect)
uniform vec3 uFxColB;
uniform vec3 uFxColC;
uniform float uFxP1;     // per-effect scalar knobs (0..1)
uniform float uFxP2;
uniform float uFxP3;
uniform int uFxBlend;    // Appearance blend mode (see fxBlend)
uniform float uLmOn;
uniform float uLmFlow;
uniform float uLmFlowAmt;
${FX_GLSL}
// ══════════ LA COORDONNÉE DE CHAMP D'UN FRAGMENT ═══════════════════════════
//
// vWorldPos.xz est la position dans la GÉOMÉTRIE. En mode continu la
// géométrie ne bouge pas : c'est le relief qui défile dessous, par un décalage
// de LECTURE du MNT (uFenetre). Tout ce qui est peint « sur le sol » — une
// matière, un motif, une photo, une grille — doit donc s'indexer sur
// champXZ(), sinon il reste COLLÉ À L'ÉCRAN pendant que le paysage s'en va.
//
// C'est exactement le piège du grain FBM que l'étude §5.4 annonçait et que
// 646acd5 a corrigé côté géométrie ; ici c'est le même piège, côté fragment.
//
// ⚠️ CE QUI N'EST PAS PEINT SUR LE SOL NE DOIT PAS L'UTILISER : le découpage du
// socle, le fondu vers son bord, l'ombre des nuages (le ciel est la fenêtre) et
// les balayages de scan appartiennent à la FENÊTRE et restent en vWorldPos.
//
// Hors mode continu uFenetre vaut (0,0) : champXZ() EST vWorldPos.xz, au
// bit près.
vec2 champXZ() { return vWorldPos.xz + uFenetre; }

// ⚠️ NUIT_FOND ET NUIT_GAIN ONT QUITTE CE FICHIER — ce sont desormais les deux
// uniformes uNuitFond et uNuitGain, pilotes par les deux tirettes du panneau
// Couches (demande d'Adrien : « l'opacite de l'assombrissement » et « la force
// de l'eclairage »). Leurs valeurs de depart reproduisent les anciennes
// constantes au bit pres : 0,22 et 3,4.
//
// Le POURQUOI de ces deux chiffres — a zero on perd le relief ; Black Marble
// est un produit scientifique dont la dynamique est calee pour ne pas saturer
// le capteur, pas pour qu'une carte soit lisible — vit maintenant dans
// src/reglages-couches.js, a cote des conversions tirette → uniforme.

// LE DRAPAGE D'UNE MOSAÏQUE SUR LE SOL — la géométrie commune à la photo
// aérienne et aux lumières nocturnes.
//
// ⚠️ CETTE FONCTION EXISTE PARCE QUE CE CALCUL A DÉJÀ DÉRAILLÉ DEUX FOIS, et
// que les deux fois le défaut était invisible en console et parfaitement
// visible à l'œil :
//
//   1. vWorldPos.xz au lieu de champXZ() — la mosaïque reste COLLÉE À
//      L'ÉCRAN pendant que le paysage défile dessous. C'est « Vienne sur le
//      mont Fuji », signalé par Adrien : « la cartographie aérienne ne suit pas
//      le terrain ».
//   2. uSlabHalf * 2.0 au lieu de uMaskSpan — la mosaïque se rétrécit au
//      tiers de sa largeur, donc au NEUVIÈME de sa surface, et ce neuvième
//      reste collé au socle central. C'est « la carte aérienne ne se charge que
//      sur 1 carreau sur 9 ». uMaskSpan vaut 56 sur un bloc, 168 sur une
//      emprise 3×3 : les deux longueurs doivent bouger ENSEMBLE, sinon l'image
//      est étirée ×3 ou comprimée ×3 sans que rien ne paraisse cassé.
//
// Une deuxième couche drapée, c'était une deuxième occasion de rejouer les
// deux. Le calcul vit donc désormais à UN seul endroit.
//
// bordIn rend l'atténuation de bord : 1 partout HORS mode continu (tout
// fragment du socle y est par construction dans [0,1], et un fondu mangerait la
// mosaïque sur les quatre bords de CHAQUE bloc), et un fondu étroit sur le bord
// de l'emprise en mode continu, là où le débordement élastique peut mordre
// au-delà et où texture2D étirerait le texel de bord en traînées.
//
// ⚠️ CETTE FONCTION REND DES UV DÉJÀ RETOURNÉS, ET L'APPELANT APPLIQUE SON
// OFFSET/ÉCHELLE APRÈS. Un retournement et une affine NE COMMUTENT PAS : c'est
// pour ça que aerialUvTransform (map/aerial-layer.js) mesure son offset
// vertical depuis le bord SUD de la grille de tuiles, et pas depuis le nord.
// Poser l'offset dans le mauvais sens décalait la mosaïque de la différence des
// deux débords de grille — invisible sur la photo aérienne (grille alignée sur
// le bloc), jusqu'à 131 km sur les lumières nocturnes, plafonnées à z8. Le
// dossier complet est dans le commentaire d'aerialUvTransform ; ne changez
// l'un des deux qu'en changeant l'autre.
//
// ⚠️ ET PAS D'ACCENT GRAVE DANS CE COMMENTAIRE : tout ce bloc vit DANS un
// gabarit JS, où un accent grave referme la chaîne et casse le shader entier.
vec2 uvSolDrape(out float bordIn) {
  vec2 uv = (champXZ() - uBlockOffset) / uMaskSpan + 0.5;
  float cont = step(uSlabHalf * 2.0 + 1.0, uMaskSpan);
  float bande = 1.7 / uMaskSpan; // largeur CONSTANTE en unités monde, pas en fraction d'emprise
  vec2 edge = smoothstep(vec2(0.0), vec2(bande), uv) * (1.0 - smoothstep(vec2(1.0 - bande), vec2(1.0), uv));
  bordIn = mix(1.0, edge.x * edge.y, cont);
  uv.y = 1.0 - uv.y; // les lignes de texture vont nord→sud, le +Z du monde va sud→nord
  return uv;
}

// ═══════════════════════════════════════════════════════════════════════════
// L'OCCUPATION DU SOL — LIRE UNE CLASSE, PAS UNE COULEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CES DEUX FONCTIONS SONT TOUT L'ENJEU DE LA COUCHE, ET CHACUNE DES QUATRE
// PRÉCAUTIONS QU'ELLES PORTENT RÉPARE UNE FAUTE QUI NE LÈVE AUCUNE ERREUR.
//
// uSol ne transporte pas une image : chaque octet EST un code de classe ESA
// WorldCover (10 arbres, 30 prairie, 80 eau…). Entre 10 et 80 il n'y a pas 45,
// il n'y a RIEN — et pourtant tout, dans une chaîne graphique, est fait pour
// interpoler. C'est la même famille que le défaut terrarium qui a coûté cher
// ici : on interpolait l'ENCODAGE de l'altitude au lieu de l'altitude, et
// +128 m sortaient là où il fallait lire −0,5 m.

#ifdef SHIBU_SOL
// La teinte et la force d'UN point de la mosaïque, en linéaire.
vec4 solEn(vec2 p) {
  // ⚠️ LE +0,5 AVANT LE floor N'EST PAS UNE COQUETTERIE. Sur une machine qui
  // n'offre que du flottant medium, texture2D(...).r * 255 peut ressortir à
  // 39,997 pour un octet valant 40 : le floor rendrait 39, qui n'est pas une
  // classe, donc une force nulle — un trou dans la forêt, un pixel sur mille,
  // impossible à diagnostiquer autrement qu'en le sachant.
  float code = floor(texture2D(uSol, p).r * 255.0 + 0.5);
  // ⚠️ ON VISE LE CENTRE DU TEXEL : (i + 0,5) / 256. Viser i / 256 tomberait
  // pile sur la frontière entre deux entrées de la table, et le plus proche
  // voisin y bascule d'un côté ou de l'autre au gré de l'arrondi du pilote.
  vec4 e = texture2D(uSolLut, vec2((code + 0.5) / 256.0, 0.5));
  // ⚠️ LA TABLE EST EN sRGB, LE NUANCEUR EN LINÉAIRE. Les couleurs des familles
  // ont été choisies à l'œil, donc écrites en sRGB ; on ne peut pas laisser
  // three.js les convertir pour nous, puisque la texture doit rester en
  // NoColorSpace (sinon c'est le CODE, dans l'autre texture, qui se ferait
  // convertir — et là ce serait la catastrophe). On convertit donc à la main.
  // Sans ça le lavis ressort deux fois trop clair et perd toute sa teinte.
  vec3 lin = mix(e.rgb / 12.92, pow((e.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), e.rgb));
  return vec4(lin, e.a);
}

// LE MÉLANGE DES QUATRE VOISINS — la seule façon d'avoir un bord doux sans
// jamais inventer de classe.
//
// La texture est en NearestFilter (obligatoire : un LinearFilter moyennerait
// les CODES). Peint tel quel, le lavis montrerait donc les marches d'escalier
// d'un texel de 30 m agrandi à l'écran — ce qui, sur une carte calme, se lit
// comme un défaut de rendu, pas comme une donnée.
//
// La parade est classique et exacte : on convertit les QUATRE voisins en
// couleur, PUIS on mélange les couleurs. À aucun moment un code ne rencontre
// une addition.
//
// ⚠️ ET ON PRÉMULTIPLIE PAR LA FORCE. Sans ça, un texel d'eau (force zéro) qui
// touche une forêt tirerait quand même la couleur du bord vers son gris, alors
// qu'il est censé ne rien peser. Prémultiplier, mélanger, diviser : un texte
// éteint ne teinte plus son voisin.
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
#endif // SHIBU_SOL

// ═══════════════════════════════════════════════════════════════════════════
// LA HAUTEUR DE CANOPÉE — LIRE UN NOMBRE, ET DONC AVOIR LE DROIT DE L'INTERPOLER
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ REGARDEZ CE QUI N'EST PAS ÉCRIT ICI. Il n'y a pas de floor(x * 255 + 0.5),
// pas de mélange des quatre voisins, pas de prémultiplication par la force. Les
// vingt lignes que solEn et lavisSol consacrent juste au-dessus à rendre
// l'interpolation IMPOSSIBLE n'ont aucune raison d'être ici, et les recopier
// serait une faute, pas une prudence :
//
//   · uSol porte un CODE. Entre 10 (arbres) et 80 (eau) il n'y a pas 45, il n'y
//     a RIEN, et un 45 fabriqué par le filtrage peindrait une classe inexistante.
//   · uCanopee porte des MÈTRES. Entre 10 m et 12 m il y a 11 m, et 11 m est une
//     hauteur parfaitement réelle. Le GPU a le droit de la calculer, la texture
//     est donc en LinearFilter (voir src/map/canopee-layer.js), et ce filtrage
//     nous OFFRE la lisière douce que l'occupation du sol doit se payer à la
//     main.
//
// Une seule précaution survit, et c'est la seule qui ne dépendait pas de la
// nature de la donnée : la table est en sRGB et le nuanceur en linéaire.
#ifdef SHIBU_CANOPEE
vec4 canopeeEn(vec2 p) {
  // .r vaut déjà hauteur/255, filtré linéairement par le GPU. Pas d'arrondi :
  // on ne cherche pas à retrouver un octet exact, on cherche une hauteur.
  float h = texture2D(uCanopee, p).r;
  // ⚠️ ON VISE LE CENTRE DU TEXEL DE LA TABLE : (h * 255 + 0,5) / 256. Viser
  // h directement écraserait toute la rampe sur ses 255 premiers 256e et
  // décalerait chaque couleur d'un demi-mètre — invisible, et faux partout.
  vec4 e = texture2D(uCanopeeLut, vec2(h * (255.0 / 256.0) + (0.5 / 256.0), 0.5));
  // ⚠️ LA TABLE EST EN sRGB, LE NUANCEUR EN LINÉAIRE. Les couleurs de la rampe
  // ont été choisies à l'oeil, donc écrites en sRGB ; on ne peut pas laisser
  // three.js les convertir pour nous, puisque la texture doit rester en
  // NoColorSpace (sinon c'est la HAUTEUR, dans l'autre texture, qui se ferait
  // convertir — et une forêt de 40 m deviendrait une forêt de 13 m).
  vec3 lin = mix(e.rgb / 12.92, pow((e.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), e.rgb));
  return vec4(lin, e.a);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ L'OMBRAGE DE LISIÈRE — CE QUE CE N'EST PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce n'est PAS du relief, et il a été promis une fois ici que « les forêts
// deviennent un volume » : c'était faux, et les chiffres qui le disent sont en
// tête de src/canopee.js. Résumé — 40 m de houppier valent 0,19 % de la largeur
// d'un bloc, et le maillage à z12 a un pas de 54 m au sol : une lisière tient
// sur UN sommet. Déplacée en géométrie, elle rendrait un escalier.
//
// Ce qui suit est donc une OMBRE PORTÉE SUR UNE IMAGE, calculée à partir du
// gradient de la texture et de rien d'autre : aucun sommet ne bouge, aucune
// normale n'est touchée, la silhouette du terrain contre le ciel est exactement
// celle d'avant. Ça ne prétend rien de plus que ce que fait un dessinateur qui
// pose un trait gris au pied d'un massif.
//
// La règle : si le voisin du NORD-OUEST est plus HAUT que moi, je suis à son
// pied, donc à son ombre. C'est la lumière conventionnelle des cartes (venue du
// nord-ouest), et c'est délibérément la MÊME quelle que soit l'heure : elle
// n'imite pas le soleil de la scène, elle souligne un contour. Deux
// échantillons, pas quatre — une différence avant/arrière ferait un LISERÉ des
// deux côtés de la lisière, c'est-à-dire un contour de dessin animé.
//
// ⚠️ ET SON GAIN EST UNE EXAGÉRATION ASSUMÉE. Une marche de 30 m sur un texel
// vaut 30/255 = 0,118 en unité de texture. Sans gain, l'ombre la plus marquée du
// monde pèserait 12 % — invisible. Le gain de 3,2 la porte à ~0,38, soit une
// ombre franche mais qui laisse encore lire le sol dessous. C'est le chiffre
// qu'il a fallu, et il est là pour qu'on puisse le contester.
float ombreLisiere(vec2 p) {
  float h = texture2D(uCanopee, p).r;
  // ATTENTION AU SENS DE v, IL EST CONTRE-INTUITIF.
  //
  // uvSolDrape se termine par uv.y = 1.0 - uv.y. APRES ce retournement, v croit
  // vers le NORD, et non vers le sud. Reculer d'un texel sur les deux axes
  // visait donc le SUD-OUEST : l'ombre se deposait au NORD-EST, l'exact oppose
  // de la lumiere du nord-ouest que toute la carte suppose.
  //
  // Le commentaire d'origine affirmait l'inverse (v croissant vers le sud) et
  // le code le suivait fidelement. C'est le commentaire qui etait faux.
  //
  // Nord-ouest, donc : -u pour l'ouest, +v pour le nord.
  float hNO = texture2D(uCanopee, p + vec2(-uCanopeeTexel.x, uCanopeeTexel.y)).r;
  return clamp((hNO - h) * 3.2, 0.0, 1.0);
}
#endif // SHIBU_CANOPEE
${GLSL_NATUREL}
${GLSL_OMBRE_PEINTURE}
${GLSL_MELANGE}`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // --- material noise reveal is applied further down at the paint mix (it fades
  // the relief material toward the map/shader underneath — see uMatNoiseOn there)
  // --- region cutout: clip the relief to the admin-boundary mask (white
  // inside / black outside, rendered over the DEM footprint in world XZ by
  // region-mask.js) so the landform stands alone like a country cutout. The
  // mask is pre-blurred, so the 0.5 iso-line cuts a smooth boundary. When
  // active it REPLACES the superellipse slab clip below.
  if (uRegionOn > 0.5) {
    vec2 rmUv = (vWorldPos.xz - uBlockOffset) / (uSlabHalf * 2.0) + 0.5;
    if (texture2D(uRegionMask, rmUv).r < 0.5) discard;
  } else if (uSlabCorner > 0.0) {
    // --- rounded-rect footprint clip: discard fragments outside the slab's
    // filleted corners so the block's vertical edges read soft (matches the
    // plinth walls). Zero radius = untouched square. SDF of a rounded box.
    vec2 pl = vWorldPos.xz - uBlockOffset; // local au bloc (damier)
    // ══════ LE RAYON EST CHOISI PAR QUADRANT — src/damier-bords.js ══════════
    // L'abs() seul rendait ce clip symétrique sur les QUATRE côtés : chaque
    // bloc du damier gardait son propre carré arrondi, jointures comprises. À
    // l'écran : une rainure le long de chaque jointure, et un trou en étoile là
    // où quatre blocs se rejoignent. uCoinsDamier = (ne, se, so, no), 1 =
    // arrondi de plein droit, 0 = coin vif — un coin n'est arrondi que si SES
    // DEUX côtés sont extérieurs, la règle du socle mot pour mot.
    // TRANSCRIPTION LIGNE À LIGNE de rayonCoin() : quadrant par le signe, x >= 0
    // = est, z >= 0 = sud. À (1,1,1,1) mix rend son opérande tel quel et
    // l'expression redevient celle d'avant, au bit près.
    // (Pas d'accent grave dans ce bloc : il vit dans un template literal JS, il
    // le terminerait — même piège qu'ocean.js, et il coûte une suite entière.)
    float fx = step(0.0, pl.x); // 1 = est
    float fz = step(0.0, pl.y); // 1 = sud  (pl.y EST le z monde : vec2.xz)
    float rCoin = uSlabCorner * mix(
      mix(uCoinsDamier.w, uCoinsDamier.x, fx),  // nord : no | ne
      mix(uCoinsDamier.z, uCoinsDamier.y, fx),  // sud  : so | se
      fz);
    vec2 cq = max(abs(pl) - vec2(uSlabHalf - rCoin), 0.0);
    // superellipse boundary |x|^n + |y|^n = r^n (n=2 circle, higher = squircle);
    // straight edges stay exact (one component is 0), only corners are shaped
    float pn = pow(pow(cq.x, uSlabCornerN) + pow(cq.y, uSlabCornerN), 1.0 / uSlabCornerN);
    // rCoin = 0 : cq vaut zéro dans tout le carré (pn = 0, et 0.0 > 0.0 est faux)
    // et sort dès qu'on le dépasse — le coin vif, sans branchement de plus.
    if (pn > rCoin) discard;
  }

  // smooth interpolated normal (world space) — screen-space derivatives look blotchy
  vec3 wN = inverseTransformDirection(normalize(vNormal), viewMatrix);
  float slope = 1.0 - clamp(wN.y, 0.0, 1.0);
  // keep the lighting/AO shading from the base surface but let the gradient own the color
  float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));

  // --- map colour, centralised for EVERY template: below sea level (elevation 0
  // = uSeaY) it is ALWAYS the ocean bathymetry ramp; the land hypsometric ramp
  // never bleeds underwater, so displacement noise below 0 keeps the sea colour.
  // The ocean mask gates it: a sub-sea cell only paints as water where the mask
  // says REAL sea (edge-connected / big basin), killing phantom coarse-zoom lakes.
  float seaMask = 1.0;
  if (uSeaMaskOn > 0.5) {
    // UV D'ATLAS (jalon 2) — voir uCoastMask ci-dessous pour le POURQUOI.
    // Hors mode continu uFenetre vaut (0,0) et uMaskSpan vaut exactement
    // uSlabHalf * 2 : l'expression redevient celle d'avant, au bit près.
    vec2 smUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5;
    seaMask = texture2D(uSeaMask, smUv).r;
  }
  // coarse-zoom coast (z4–z8): the real Natural-Earth land/sea mask is the
  // source of truth — a cell is sea because the vector coast says so, not
  // because its (noisy, coarse) DEM height dipped below 0. Fixes flooded flat
  // coasts AND phantom inland lakes. Off (z9+ / fetch failed) → old behaviour.
  float landness = 1.0;
  if (uCoastMaskOn > 0.5) {
    // ⚠️ L'EXPRESSION D'UV D'ATLAS, PARTAGÉE PAR LES TROIS CHAMPS DU RELIEF —
    // masque côtier, masque de mer, analyse. Les trois sont cuits sur l'emprise
    // ENTIÈRE (168 unités), la géométrie n'en montre que 56, et c'est la
    // LECTURE qui se déplace : uFenetre est le décalage du mode continu,
    // uMaskSpan la largeur au sol du champ. Lu sur 56 sans décalage, un champ
    // d'emprise serait agrandi trois fois ET immobile sous le relief qui glisse.
    // Hors mode continu uFenetre = (0,0) et uMaskSpan = uSlabHalf * 2 :
    // l'image d'aujourd'hui est inchangée au bit près.
    // (test/atlas-champs.test.js verrouille les trois lignes sur le source :
    // une lecture restée en UV de bloc est un défaut MUET.)
    // ⚠️ PAS DE BACKTICK DANS CE COMMENTAIRE — le GLSL est un littéral gabarit
    // JS : un accent grave y ferme la chaîne et casse TOUT le module.
    vec2 cmUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5;
    landness = texture2D(uCoastMask, cmUv).r;
  }
  // v42: le masque cotier ne peut JAMAIS declarer sous-marine une terre
  // au-dessus du niveau de la mer - la rampe ocean (fond marin choisi) se
  // peignait sur des montagnes quand le masque etait faux (retour Adrien)
  // ⚠️ LE PRÉDICAT VIENT DE LA CONSTANTE PARTAGÉE, il n'est PAS réécrit ici :
  // la branche ELSE est la SEULE lecture de seaMask du nuanceur, et c'est elle
  // que _buildFields interroge pour décider de CUIRE le champ. Deux écritures
  // jumelles finiraient par diverger, et un bloc sans mer ne lève rien.
  // ⚠️ PAS DE BACKTICK ICI NON PLUS — voir l'avertissement quinze lignes plus
  // haut : un accent grave ferme le gabarit et casse tout le module.
  bool underwater = ${COTE_AUTORITE_GLSL}
    ? (landness < 0.5 && vWorldPos.y < uSeaY + 0.02)
    : (vWorldPos.y < uSeaY && seaMask > 0.5);
  float hNorm = clamp((vWorldPos.y - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
  vec3 mapCol;
  if (underwater) {
    float d01 = pow(clamp((uSeaY - vWorldPos.y) / max(uSeaRange, 1e-4), 0.0, 1.0), 0.55);
    // three-stop nautical ramp: shallows → mid blue → abyss
    mapCol = d01 < 0.45
      ? mix(uOceanShallow, uOceanMid, d01 / 0.45)
      : mix(uOceanMid, uOceanDeep, (d01 - 0.45) / 0.55);
    // v48 : CAUSTIQUES AU FOND (retour Adrien) — projetées sur le RELIEF
    // sous-marin, elles épousent l'élévation réelle (vWorldPos). Motif varié :
    // warp du domaine (casse la répétition) + deux échelles + longues bandes
    // de rayons qui balaient lentement. Même rendu jour et nuit (photos réf.).
    if (uSeaCausK > 0.001) {
      vec2 cwx = champXZ(); // les mailles de lumière appartiennent au FOND, pas à l'écran
      vec2 cw = cwx + 0.9 * vec2(sin(cwx.y * 0.11 + uCausT * 0.07), cos(cwx.x * 0.13 - uCausT * 0.05));
      float cc1 = seaCaustic(cw * 0.55 + vec2(uCausT * 0.05, 0.0), uCausT * 0.8);
      float cc2 = seaCaustic(cw * 0.23 - vec2(0.0, uCausT * 0.03), uCausT * 0.5);
      float cnet = clamp(cc1 * 1.2 + cc2 * 0.5, 0.0, 1.5);
      float cfil = smoothstep(0.5, 1.1, cnet);
      // rayons de lumière : bandes larges et lentes qui traversent le fond
      float crays = mix(0.72, 1.0, 0.5 + 0.5 * sin(dot(cwx, vec2(0.33, 0.21)) + uCausT * 0.2));
      // v50 : les caustiques ne vivent QUE là où la lumière atteint le fond —
      // 0 au large, plein en eau peu profonde. L'ancien plancher 0.3 laissait
      // des filaments lumineux sur le fond profond qui, vus à travers l'eau,
      // ressemblaient à de faux bancs de sable (retour Adrien). Les vagues, elles,
      // gardent exactement la même hauteur.
      float creach = smoothstep(0.0, 0.5, 1.0 - d01);
      float cglow = clamp(cfil * crays * creach * uSeaCausK, 0.0, 1.0);
      mapCol *= 1.0 - 0.2 * creach * uSeaCausK * (1.0 - cnet); // creux des mailles éteints
      mapCol = 1.0 - (1.0 - clamp(mapCol, 0.0, 1.0)) * (1.0 - cglow * 0.55); // filaments en screen
    }
  } else {
    // the pivot can never sink below sea level: with a low pivot the whole
    // coastal band rides the top of the ramp and land loses its low tints
    // ⚠️ LA LOI EST DANS src/monde/naturel-crop.js, PAS ICI — Tâche P2. Le
    // nuanceur du globe injecte le MÊME texte : deux écritures de ce pivot
    // auraient donné deux rampes de terre à faire coïncider, ce qui est
    // exactement le désaccord que le chantier « une seule Terre » ferme.
    float pivotFloor = uSeaY > -9000.0
      ? natPlancherPivot((uSeaY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4))
      : 0.0;
    float pivot = max(uHeightPivot, pivotFloor);
    float rampT = natRampT(hNorm, pivot, uHeightContrast);
    // --- SECOND AXE DU LUT : l'humidité. X reste l'altitude, Y devient
    // l'humidité topographique — deux points à la MÊME altitude, l'un au fond
    // d'un vallon, l'autre sur une croupe, cessent de recevoir la même couleur.
    // En Classique, wetY reste à 0.5 : le LUT y est constant en Y et rend
    // exactement la rampe historique.
    float wetY = 0.5;
    vec4 anl = vec4(0.5);
    if (uColorMode == 1) {
      if (uAnalysisOn > 0.5) {
        // même UV d'atlas que uSeaMask : rien à inventer côté échantillonnage
        vec2 anUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5;
        anl = texture2D(uAnalysis, anUv);
      }
      // au-dessus de la limite des arbres il n'y a plus de végétation à
      // différencier : humidité et exposition s'éteignent, sinon les pierriers
      // et les névés prendraient des verts de prairie. uHemi : au NORD de
      // l'équateur l'ubac (face nord) est la face à l'ombre, donc la fraîche et
      // l'humide ; au sud tout s'inverse.
      // ⚠️ LE GAIN 4,86 ET SA JUSTIFICATION SONT DANS naturel-crop.js
      // (GAIN_HUMIDITE) — Tâche P2. Ils y sont écrits UNE fois, et le nuanceur du
      // globe lit le même nombre par le même texte.
      // ⛔ hNorm DE RÉFÉRENCE, PAS hNorm VIVANT — Tâche BLA. uTreeLine et
      // uHazeAlt sont des réglages posés dans le domaine de RÉFÉRENCE (le
      // carré de 40 km de la rampe fixe) ; hNorm est normalisé sur
      // uHeightRange, qui s'effondre au zoom fin. Sans cette conversion, la
      // limite des arbres et le voile d'altitude se re-normalisaient sur le
      // bloc — la classe de défaut de RAMP, dans le mode Naturel. Les deux
      // coefficients sont dérivés et chiffrés dans rampe-fixe.js.
      float hNormNat = natHNormRef(hNorm, uHNormRefA, uHNormRefB);
      wetY = natHumiditeY(anl.b, anl.a, hNormNat, uWetK, uExpoK, uHemi, uTreeLine);
    }
    mapCol = texture2D(uRampTex, vec2(rampT, wetY)).rgb;
    if (uColorMode == 1) {
      // ⚠️ LE PEIGNÉ ET L'OMBRAGE VIVENT DANS naturel-crop.js (natPeigne) —
      // Tâche P2, et c'est CE bloc-là qu'Adrien voyait manquer sur la sphère :
      // « plus aucune texture sur la terre ». Le SOFT LIGHT et le ×3 sur le
      // contraste y sont justifiés ; le globe injecte la même fonction.
      if (uAnalysisOn > 0.5 && uTexShade > 0.001) {
        mapCol = natPeigne(mapCol, anl.r, anl.g, uTexShade);
      }
      // --- PERSPECTIVE AÉRIENNE (Imhof) — entièrement en fragment, zéro tap.
      // La loi (deux composantes, désaturation puis virage, et le rehaussement
      // indissociable) est dans naturel-crop.js : natVoile + natBrume.
      if (uHazeAmt > 0.001) {
        // ⚠️ fd EST EN DEMI-CÔTÉS DE BLOC, et c'est la grandeur que le globe
        // nomme length(qCrop) : l'en-tête de habillage-crop.js démontre
        // x = 28 · u avec uSlabHalf = 28. Même nombre, deux chemins.
        // ⚠️ ET EN MÈTRES — Tâche BLA : × uFdFacteur = (extentMeters / 2) /
        // DISTANCE_VOILE_M (80 km, la demi-emprise la plus large). Le quotient
        // d / uSlabHalf est sans unité, seule la BORNE change (rampe-fixe.js).
        float fd = clamp(length(vWorldPos.xz - uBlockOffset) / max(uSlabHalf, 1e-3) * uFdFacteur, 0.0, 1.0);
        // le voile d'altitude lit le domaine de RÉFÉRENCE, comme la limite des
        // arbres au-dessus — même conversion, même raison (Tâche BLA)
        float veil = natVoile(natHNormRef(hNorm, uHNormRefA, uHNormRefB), fd, uHazeAmt, uHazeAlt, uHazeDist);
        mapCol = natBrume(mapCol, natLuminance(mapCol), veil, uHazeColor, uHazeAmt);
      }
    } else {
      mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
    }
  }
  float fxShade = natOmbrePeinture(luma);
  // material noise reveal: where the noise is below the (soft) cut, push the tint
  // back toward 1 so the map paint shows through the relief material — a diffuse,
  // holeless dissolve that lets you see the layer underneath. The revealed map is
  // lifted back toward its natural brightness (not shaded by the material albedo)
  // so it reads as the real map/shader colour, never a muddy hole.
  float effTint = uTint;
  float paintShade = fxShade;
  if (uMatNoiseOn > 0.5) {
    float mn = mnNoise(champXZ() * uMatNoiseScale); // la dissolution est une matière du SOL
    float reveal = 1.0 - smoothstep(uMatNoiseCut - uMatNoiseSoft, uMatNoiseCut + uMatNoiseSoft, mn);
    effTint = mix(uTint, 1.0, reveal);
    paintShade = mix(fxShade, 1.0, reveal);
  }
  // "Au-dessus du niveau zéro": below sea level, force the map paint through
  // regardless of the material noise reveal, so the relief material only shows
  // above uSeaY.
  if (uMatAboveZero > 0.5) {
    float below = 1.0 - smoothstep(uSeaY - 0.05, uSeaY + 0.05, vWorldPos.y);
    effTint = max(effTint, below);           // below sea → show the map paint
    paintShade = mix(paintShade, 1.0, below);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * paintShade, effTint);

  // OCCUPATION DU SOL — posée ICI : au-dessus de la peinture hypsométrique,
  // mais SOUS la photo aérienne et sous les lumières nocturnes.
  //
  // L'ordre n'est pas un détail de rangement. Quand la photo est allumée, elle
  // EST l'occupation du sol, en mieux et en vrai : lui passer un lavis de
  // classes par-dessus reviendrait à repeindre une forêt qu'on voit déjà. La
  // couche se laisse donc recouvrir, sans qu'aucune condition n'ait à savoir
  // que l'autre existe.
  //
  // ⚠️ ON MODULE LA COULEUR, ON N'EN POSE PAS UNE. C'est toute la différence
  // entre cette couche et un atlas scolaire. blSetLum (le mode « Couleur » de
  // la panoplie de mélange, déjà là pour les apparences) prend la TEINTE de la
  // classe et lui impose la LUMINANCE de la carte : l'ombrage du relief, les
  // courbes de niveau et la rampe hypsométrique continuent de se lire à travers.
  //
  // La luminance, elle, est tirée à 55 % vers celle de la classe. Ni 0 ni 1, et
  // les deux bornes sont des régressions : à 0 on perdrait « la forêt est
  // sombre, le glacier est clair », qui est justement ce que la couche apporte ;
  // à 1 on écraserait le modelé sous un aplat, et on aurait fabriqué l'atlas.
  //
  // ⚠️ 0,55 ET PLUS 0,45 — c'est la moitié du correctif du 2026-08-02, l'autre
  // moitié étant les forces de src/occupation-sol.js. Ce qu'on écrase en montant
  // ce chiffre, ce n'est PAS l'ombrage : diffuseColor est ici un ALBEDO, et le
  // soleil, les ombres et le SSAO le multiplient ensuite. C'est la rampe
  // HYPSOMÉTRIQUE qui recule — et c'est précisément l'échange qu'on veut, la
  // couche disant l'occupation là où la rampe ne dit que l'altitude. Les courbes
  // de niveau, la grille et les étiquettes, elles, sont peintes PLUS BAS dans ce
  // nuanceur : elles passent par-dessus, intactes, quelle que soit la force.
#ifdef SHIBU_SOL
  if (uSolOn > 0.5 && uSolOpacite > 0.001) {
    float sIn;
    vec2 sUv = uvSolDrape(sIn); // ⚠️ les deux pièges « Vienne sur le mont Fuji » et « 1 carreau sur 9 » vivent DEDANS
    sUv = uSolOffset + sUv * uSolScale;
    vec4 lavis = lavisSol(sUv);
    // ⚠️ LE PLAFOND À 1 N'EST PAS DÉCORATIF : la tirette « Force » monte à 2, et
    // mix() au-delà de 1 EXTRAPOLE — il sortirait de la gamme par le haut et
    // fabriquerait des verts fluorescents sur les forêts denses, ce qui est
    // exactement l'atlas qu'on refuse. Au-delà de 1, pousser la tirette ne fait
    // plus qu'amener les classes FAIBLES à saturation, ce qui est ce qu'on lui
    // demande.
    float k = min(1.0, lavis.a * uSolOpacite * sIn);
    if (k > 0.001) {
      float lumFond = blLum(diffuseColor.rgb);
      vec3 peinte = blSetLum(lavis.rgb, mix(lumFond, blLum(lavis.rgb), 0.55));
      diffuseColor.rgb = mix(diffuseColor.rgb, peinte, k);
    }
  }
#endif

  // HAUTEUR DE CANOPÉE — posée JUSTE APRÈS l'occupation du sol, et l'ordre est
  // un argument, pas un rangement.
  //
  // Les deux couches parlent du même endroit du monde, et quand les deux sont
  // allumées c'est la canopée qui doit gagner : l'occupation du sol dit « il y a
  // des arbres », la canopée dit « ils font 34 mètres ». La seconde contient la
  // première et en dit plus. Elle passe donc par-dessus — sans qu'aucune
  // condition n'ait à savoir que l'autre existe, exactement comme l'occupation
  // du sol se laisse recouvrir par la photo aérienne juste en dessous.
  //
  // ⚠️ ET COMME SA VOISINE, ELLE MODULE LA COULEUR, ELLE N'EN POSE PAS UNE.
  // blSetLum prend la TEINTE de la rampe et lui impose la LUMINANCE de la carte :
  // l'ombrage du relief, les courbes de niveau et la rampe hypsométrique
  // continuent de se lire à travers. C'est toute la différence entre une carte
  // et un aplat colorié.
  //
  // La luminance est tirée à 0,60 vers celle de la rampe, un peu plus fort que
  // les 0,55 de l'occupation du sol — et pour une raison précise : ici la
  // luminance EST l'information (le plus foncé est le plus haut), alors que
  // là-bas elle ne fait qu'accompagner une classe. La brider davantage
  // reviendrait à jeter la moitié de ce que la couche a à dire.
#ifdef SHIBU_CANOPEE
  if (uCanopeeOn > 0.5 && uCanopeeOpacite > 0.001) {
    float cIn;
    vec2 cUv = uvSolDrape(cIn); // ⚠️ les deux pièges « Vienne sur le mont Fuji » et « 1 carreau sur 9 » vivent DEDANS
    cUv = uCanopeeOffset + cUv * uCanopeeScale;
    vec4 bois = canopeeEn(cUv);
    // ⚠️ LE PLAFOND À 1 N'EST PAS DÉCORATIF : la tirette « Force » monte à 4, et
    // mix() au-delà de 1 EXTRAPOLE — il sortirait de la gamme par le haut et
    // fabriquerait des verts fluorescents sur les forêts denses, c'est-à-dire
    // exactement l'atlas scolaire qu'on refuse. Au-delà de 1, pousser la tirette
    // ne fait plus qu'amener les couverts BAS à saturation, ce qui est ce qu'on
    // lui demande.
    float k = min(1.0, bois.a * uCanopeeOpacite * cIn);
    if (k > 0.001) {
      float lumFond = blLum(diffuseColor.rgb);
      vec3 peinte = blSetLum(bois.rgb, mix(lumFond, blLum(bois.rgb), 0.60));
      // L'ombre de lisière — une ombre portée sur une image, pas du volume (voir
      // ombreLisiere). Elle s'applique DANS la couleur peinte et pas après, pour
      // qu'elle disparaisse avec la couche quand on baisse la tirette : une
      // ombre qui survivrait à sa forêt serait une salissure inexplicable.
      peinte *= 1.0 - 0.45 * ombreLisiere(cUv);
      diffuseColor.rgb = mix(diffuseColor.rgb, peinte, k);
    }
  }
#endif

  // Optional aerial photo, applied HERE on purpose: over the hypsometric paint
  // but UNDER the contours, grid and labels below — so the drawn cartography
  // still sits on top of the photograph rather than being buried by it. That
  // ordering is most of what keeps this from becoming a plain satellite viewer.
  if (uAerialOn > 0.5) {
    // ⚠️ champXZ(), PAS vWorldPos.xz — signalé par Adrien : « la
    // cartographie aérienne ne suit pas le terrain ». La photo est REGISTRÉE
    // AU SOL (elle est composée sur les deux coins exacts du bloc, voir
    // aerial-layer.js:demBounds) : indexée sur la géométrie, elle restait
    // collée à l'écran et montrait les rues d'une vallée sur les crêtes de la
    // voisine — le défaut « Vienne sur le mont Fuji » que refreshAerialCore
    // évite déjà d'un bloc à l'autre, ici à l'intérieur d'un seul.
    // ⚠️ uMaskSpan ET PAS uSlabHalf * 2.0 — C'EST LA PHOTO SUR 1 CARREAU
    // SUR 9. La mosaïque est composée sur l'emprise ENTIÈRE (aerial-layer.js,
    // demBounds), qui fait 168 unités en mode continu. Diviser par 56 la
    // rétrécissait au tiers de sa largeur, donc au NEUVIÈME de sa surface, et
    // ce neuvième restait collé au socle central : c'est le défaut qu'Adrien a
    // signalé. Les deux longueurs DOIVENT bouger ensemble, sinon la photo se
    // retrouve étirée ×3 ou comprimée ×3 sans que rien ne paraisse cassé.
    // uMaskSpan vaut 56 sur un bloc et 168 sur une emprise : hors mode
    // continu l'expression est celle d'avant, au bit près.
    float aIn;
    vec2 aUv = uvSolDrape(aIn); // ⚠️ les deux pièges ci-dessus vivent DANS uvSolDrape, pas ici
    // ⚠️ IL RESTE UN BORD, MAIS C'EST CELUI DE L'EMPRISE. La photo couvre
    // maintenant tout ce qu'on peut atteindre : à course pleine (±56) le bord
    // du socle (±28) touche EXACTEMENT le bord de l'emprise (±84). Seul le
    // débordement élastique (7 unités de plus, 0,3 s) peut mordre au-delà, là
    // où texture2D étirerait le texel de bord en traînées. On garde donc le
    // fondu, mais posé sur le bon bord et à largeur constante en UNITÉS MONDE
    // (~1,7, comme avant) : le rapporter à l'emprise le rendrait trois fois
    // plus large et mangerait de la vraie photo.
    //
    // ⚠️ ET SEULEMENT EN MODE CONTINU. Hors emprise, tout fragment du socle est
    // par construction dans [0,1] : le fondu mangerait la photo sur les quatre
    // bords de CHAQUE bloc, c'est-à-dire une régression bien visible sur
    // l'image d'aujourd'hui. uMaskSpan est le seul témoin déjà transmis au
    // shader qui distingue les deux, et il ne coûte rien.
    aUv = uAerialOffset + aUv * uAerialScale; // place the mosaic (see aerialUvTransform)
    vec3 aerial = texture2D(uAerial, aUv).rgb;
    // Modulate by the paint's own luminance instead of replacing it: the
    // hillshade and hypsometric shading keep reading THROUGH the photo, so the
    // relief still sculpts and the map keeps its own light.
    float shade = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    // v49 : couper la photo au large. Sur terre (y >= uSeaY) fondu = 1 (photo
    // pleine) ; sous l'eau, la photo s'estompe sur une bande de profondeur
    // (uAerialCoastFade * uSeaRange) puis disparaît, laissant le shader de fond
    // marin — c'est lui qui porte la rampe nautique et les caustics au-delà.
    float aFade = 1.0;
    if (uAerialCoastFade > 0.0 && uSeaY > -9000.0) {
      float band = max(uSeaRange * uAerialCoastFade, 1e-4);
      aFade = smoothstep(uSeaY - band, uSeaY, vWorldPos.y); // 1 au rivage → 0 au fond
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, aerial * (0.6 + 0.8 * shade), uAerialOpacity * aFade * aIn);
  }

  // LUMIÈRES NOCTURNES — posées ICI, juste après la photo et AVANT les courbes
  // de niveau, la grille et les étiquettes. C'est le même principe d'ordre que
  // la photo : la cartographie dessinée reste au-dessus de l'imagerie, sinon on
  // fabrique un visualiseur satellite et plus une carte.
  //
  // ⚠️ ADDITIF, ET PAS UN MÉLANGE. Une ville éclairée n'est pas une couleur qui
  // REMPLACE le sol, c'est de la lumière qui S'AJOUTE. Un mix aurait éclairci
  // les campagnes noires en même temps que les villes, et le noir de Black
  // Marble aurait ASSOMBRI le relief là où il n'y a personne — l'inverse exact
  // de ce qu'on veut. L'addition laisse le vide strictement transparent.
  if (uNuitOn > 0.5 && uNuitIntensite > 0.001) {
    float nIn;
    vec2 nUv = uvSolDrape(nIn);
    nUv = uNuitOffset + nUv * uNuitScale;
    vec3 lueur = texture2D(uNuit, nUv).rgb;
    // Le seuil doux mange le halo de fond du capteur (l'atmosphère diffuse la
    // lumière bien au-delà des villes, et VIIRS l'enregistre). Sans lui, un
    // voile gris se posait sur des vallées vides — on lisait un défaut de
    // rendu, pas des lumières.
    lueur = max(vec3(0.0), lueur - 0.06) / 0.94;
    float force = uNuitIntensite * nIn;

    // ON ÉTEINT AVANT D'ALLUMER — demande d'Adrien : « baisser l'éclairage des
    // zones sans lumière pour que les zones avec lumière ressortent ».
    //
    // Le raisonnement est photographique, pas décoratif. Une ville ne brille
    // pas parce qu'elle émet beaucoup : elle brille parce que TOUT LE RESTE est
    // noir. Ajouter de la lueur sur un sol déjà clair ne fait qu'un halo pâle ;
    // creuser le noir autour lui donne son contraste. C'est le même geste qu'un
    // chef opérateur qui coupe l'ambiance avant de poser sa source.
    //
    // ⚠️ ET ON NE COMPENSE PAS. « Si je veux de la lumière, je mets de la
    // lumière d'appoint » : la couche assombrit, point. Remonter discrètement
    // une ambiance ici annulerait le contraste qu'on vient de fabriquer, et
    // volerait à Adrien un réglage qu'il tient déjà (l'éclairage d'appoint du
    // panneau Lumière).
    float lum = dot(lueur, vec3(0.299, 0.587, 0.114));
    // lum mesure la lumière PRÉSENTE : là où elle est forte, on n'assombrit
    // pas — sinon on creuserait le cœur des villes, exactement l'inverse.
    diffuseColor.rgb *= mix(1.0, mix(uNuitFond, 1.0, min(1.0, lum * 3.0)), force);
    diffuseColor.rgb += sqrt(lueur) * uNuitGain * force;
  }

  // Fancy surface shader paints OVER the final surface — the hypsometric map OR
  // a relief material (wood/carbon/...). Materials sit BELOW the shaders, so a
  // shader shows on top of whatever the relief is wearing. Off (0) = untouched.
  if (uSurfaceFx > 0) {
    // ⚠️ champXZ() ET PAS vWorldPos.xz. La matière est peinte SUR LE SOL :
    // indexée sur la géométrie, elle serait restée collée à l'écran pendant que
    // le relief défile — un moirage immobile sur un paysage en mouvement, le
    // défaut que l'œil attrape tout de suite (étude §5.4, signalé par Adrien).
    vec3 fxc = surfaceFx(uSurfaceFx, champXZ() * 0.15, uFxTime) * fxShade;
    diffuseColor.rgb = mix(diffuseColor.rgb, fxBlend(diffuseColor.rgb, fxc, uFxBlend), uFxOpacity); // Appearance
  }

  // --- coastline: a fine, discreet line at sea level (elevation 0), drawn in
  // the template ink. Kept thin so the shore reads without shouting.
  // coastline: at coarse zoom follow the mask's 0.5 contour (the real shore);
  // otherwise the sea-level (elevation 0) isoline as before.
  if (uCoastMaskOn > 0.5) {
    float caa = max(fwidth(landness), 1e-4);
    float coast = 1.0 - smoothstep(0.0, caa * 1.5, abs(landness - 0.5));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  } else if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 1.3, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  }

  // --- drifting cloud shadows, cast by the volumetric deck overhead (strength
  // rises with sun elevation — clouds only throw shadows when the sun is above)
  if (uCloudShadowK > 0.001) {
    vec2 suv = (vWorldPos.xz - uBlockOffset) / (uSlabHalf * 2.0) + 0.5;
    float cloudShade = texture2D(uCloudShadow, fract(suv + uCloudShadowOff)).r;
    // L'ombre n'écrase plus vers le NOIR (elle était violente et sale) : elle
    // multiplie par la TEINTE D'OMBRE DE LA CARTE, la même recette que le SSAO.
    // Un nuage assombrit donc la carte dans sa propre couleur, comme une ombre
    // portée réelle — jamais comme un voile gris.
    vec3 shaded = diffuseColor.rgb * uCloudShadowTint;
    diffuseColor.rgb = mix(diffuseColor.rgb, shaded, cloudShade * uCloudShadowK);
  }

  // --- contour lines: minor every interval, heavy line every 5th
  float ch = vWorldPos.y / uContourInterval;
  float dch = fwidth(ch);
  float distMinor = abs(fract(ch + 0.5) - 0.5);
  float minorLine = 1.0 - smoothstep(0.0, dch * 1.4 * uContourWeight, distMinor);
  float ch5 = ch / 5.0;
  float dch5 = fwidth(ch5);
  float distMajor = abs(fract(ch5 + 0.5) - 0.5);
  float majorLine = 1.0 - smoothstep(0.0, dch5 * 1.4 * uContourWeight, distMajor);
  // fade contours out only when they crowd below pixel size (far away / near-vertical)
  float crowd = clamp(1.0 - dch * 0.22, 0.0, 1.0);
  float contour = max(minorLine * 0.55, majorLine) * uContourOpacity * crowd;
  diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, contour);

  // --- survey grid in world x/z
  // La grille de relevé est une CARTOGRAPHIE : ses lignes marquent le sol, pas
  // l'écran. Restée en vWorldPos, elle aurait glissé sous le terrain.
  vec2 g = champXZ() / uGridStep;
  vec2 dg = fwidth(g);
  vec2 distGrid = abs(fract(g + 0.5) - 0.5);
  float gx = 1.0 - smoothstep(0.0, dg.x * 1.4, distGrid.x);
  float gz = 1.0 - smoothstep(0.0, dg.y * 1.4, distGrid.y);
  float grid = max(gx, gz) * uGridOpacity;
  diffuseColor.rgb = mix(diffuseColor.rgb, uGridColor, grid);

  // --- scan effects: 5 selectable sweep styles painted over the map
  // (mix toward uScanColor -- additive-only washes out on white terrain)
  if (uScanT >= 0.0) {
    if (uScanType == 0) {
      // 0 RADAR: eased expanding ring + inner echo ring + filled trail
      float tS = 1.0 - pow(1.0 - uScanT, 3.0);
      float dS = distance(vWorldPos.xz, uScanOrigin);
      float RS = tS * uScanMax;
      float mainS = scanBand(dS, RS, uScanWidth, uScanBlur);
      float echoS = scanBand(dS, RS * 0.82, uScanWidth * 0.6, uScanBlur) * 0.4;
      float trailS = smoothstep(RS, RS - uScanMax * 0.25, dS) * 0.10;
      float fadeS = 1.0 - smoothstep(0.6, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((mainS + echoS + trailS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 1) {
      // 1 ELEVATION SLICE: a horizontal plane rises from sea level (or the
      // terrain floor) to the summit, flashing contour lines in its wake
      float y0S = (uSeaY > -9000.0) ? uSeaY : uHeightRange.x;
      float planeYS = mix(y0S, uHeightRange.y, uScanT);
      float sliceAA = uScanWidth * 0.35 + fwidth(vWorldPos.y);
      float sliceS = 1.0 - smoothstep(0.0, sliceAA, abs(vWorldPos.y - planeYS));
      // contour flash: re-light the contour lines within 1.5 intervals below the plane
      float wakeSpanS = uContourInterval * 1.5;
      float belowS = planeYS - vWorldPos.y; // > 0 under the plane
      float wakeS = (belowS > 0.0) ? (1.0 - smoothstep(0.0, wakeSpanS, belowS)) : 0.0;
      float flashS = max(minorLine * 0.55, majorLine) * wakeS * 0.8;
      float fadeS = 1.0 - smoothstep(0.85, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((sliceS + flashS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 2) {
      // 2 GRIDLINE SWEEP: a bright vertical line marches across the slab in X,
      // shimmering per survey-grid row and re-lighting the grid behind it
      float tS = uScanT < 0.5 ? 2.0 * uScanT * uScanT : 1.0 - pow(-2.0 * uScanT + 2.0, 2.0) * 0.5;
      float lineXS = mix(-uSlabHalf, uSlabHalf, tS);
      float shimmerS = scanHash(vec2(floor(vWorldPos.z / uGridStep), floor(uScanT * 24.0)));
      float dxS = vWorldPos.x - lineXS;
      float lineS = 1.0 - smoothstep(0.0, max(uScanBlur, fwidth(vWorldPos.x)), abs(dxS) - uScanWidth * 0.5);
      lineS *= 0.7 + 0.6 * shimmerS;
      // grid-highlight trail behind the moving line (line travels -X to +X)
      float wakeS = (dxS < 0.0) ? (1.0 - smoothstep(0.0, uSlabHalf * 0.8, -dxS)) : 0.0;
      float trailS = max(gx, gz) * wakeS * 0.35;
      float fadeS = 1.0 - smoothstep(0.85, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((lineS + trailS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 3) {
      // 3 SONAR: three staggered rings, each fainter and wider, distance-attenuated
      float dS = distance(vWorldPos.xz, uScanOrigin);
      float pingS = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ti = uScanT - fi * 0.15;
        if (ti > 0.0) {
          float Ri = ti * uScanMax;
          float attenS = pow(0.55, fi) / (1.0 + dS * 0.06);
          pingS += scanBand(dS, Ri, uScanWidth * (1.0 + fi * 0.4), uScanBlur) * attenS;
        }
      }
      float fadeS = 1.0 - smoothstep(0.7, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp(pingS * fadeS, 0.0, 0.95));
    } else if (uScanType == 4) {
      // 4 HOLO: hologram materialisation -- scrolling scanlines, blocky reveal,
      // vertical grille and a global luminance flicker, all under a sine envelope
      float envS = sin(3.14159265359 * uScanT);
      float stripeS = smoothstep(0.35, 0.5, fract(vWorldPos.y * 6.0 - uScanT * 14.0)) * 0.25;
      float grilleS = smoothstep(0.4, 0.5, fract(vWorldPos.x * 4.0)) * 0.15;
      float revealS = step(scanHash(floor(vWorldPos.xz * 3.0)), uScanT * 1.6);
      float flickS = 1.0 + (scanHash(vec2(floor(uScanT * 40.0), 1.0)) - 0.5) * 0.18;
      float holoS = (0.3 + stripeS + grilleS) * revealS * envS * flickS;
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp(holoS, 0.0, 0.6));
    }
  }
}`
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
// ── DIFFUSION SOUS-SURFACIQUE DE LA MATIERE DU RELIEF ───────────────────────
//
// Le meme terme de translucidite arriere que le socle (voir Plinth._brancheSSS),
// pose ici sur le RELIEF : c'est ce qui fait qu'une crete d'albatre s'allume par
// la tranche quand le soleil passe derriere, au lieu de rester un plateau mat.
//
// ⚠️ PILOTE PAR UN UNIFORM, PAS PAR UN #define, et c'est deliberement l'inverse
// du choix fait pour les couches Sol et Canopee juste au-dessus. Un sampler
// coute une unite de texture meme eteint : il FAUT le faire disparaitre a la
// compilation. Une quinzaine d'operations, non — et les faire disparaitre
// couterait une recompilation des neuf a vingt-trois programmes du damier a
// chaque changement de matiere, ce qui est exactement le gel qu'on refuse.
#if NUM_DIR_LIGHTS > 0
if (uMatSSS > 0.001) {
  vec3 Vs = normalize(vViewPosition);
  vec3 Ns = normalize(normal);
  vec3 Ls = directionalLights[0].direction; // deja normalisee, en espace vue
  // la lumiere qui traverse ressort DEVIEE par la normale : c'est cette
  // deviation qui donne au bord mince son halo, et pas un simple ajout
  vec3 Hs = normalize(Ls + Ns * 0.35);
  float trav = pow(clamp(dot(Vs, -Hs), 0.0, 1.0), uMatSSSPower);
  // ... et seulement la ou la face est eclairee PAR DERRIERE. Sans ce facteur,
  // le versant deja au soleil doublerait sa lumiere et tout le relief
  // deviendrait laiteux, ce qui est l'inverse du geste.
  float dosS = clamp(-dot(Ns, Ls) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.directDiffuse += directionalLights[0].color * uMatSSSTeinte * (trav + 0.12) * dosS * uMatSSS;
}
#endif`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
// scan ripple: an emissive wavefront expanding from the scan origin across the
// relief -- only the radial scans (radar, sonar) glow
if (uScanT >= 0.0 && (uScanType == 0 || uScanType == 3)) {
  float d = distance(vWorldPos.xz, uScanOrigin);
  float tE = (uScanType == 0) ? (1.0 - pow(1.0 - uScanT, 3.0)) : uScanT;
  float R = tE * uScanMax;
  float band = scanBand(d, R, uScanWidth, uScanBlur);
  float fade = 1.0 - smoothstep(0.6, 1.0, uScanT);
  totalEmissiveRadiance += uScanColor * band * fade * 0.5;
}`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
// Liquid metal: a slow molten flow ripples the surface normal so the chrome
// reflections drift across the relief (uLmFlowAmt 0 = a still mirror)
if (uLmOn > 0.5 && uLmFlowAmt > 0.0) {
  vec2 fp = champXZ() * 0.55; // le flux du métal coule sur le RELIEF, pas sur l'écran
  float e = 0.12;
  float n0 = fxFbm(fp + uLmFlow);
  float nx = fxFbm(fp + vec2(e, 0.0) + uLmFlow);
  float nz = fxFbm(fp + vec2(0.0, e) + uLmFlow);
  vec3 grad = vec3(nx - n0, 0.0, nz - n0) * uLmFlowAmt * 3.0;
  normal = normalize(normal - grad);
}`
        )
    }
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
    // bloc voisin : la géométrie reste bâtie autour de l'origine (le sampler
    // est local), c'est la POSITION du mesh qui porte le décalage monde
    this.mesh.position.set(this.blockOffset.x, 0, this.blockOffset.z)
    this.dem = null // real-world heightfield, set via setDem()
    // LA FENÊTRE BORNÉE — Tâche 6 ter du plan « globe continu ». Voir
    // `adopterFenetre` : posée par main.js derrière `params.globeContinu`,
    // laissée nulle partout ailleurs, donc le chemin de production ne la voit
    // même pas.
    this.fenetreBornee = null
    this.fabriqueFenetre = null
    // ══════════ LE RECADRAGE — Tâche 6 septies ══════════════════════════════
    //
    // ⚠️ **SANS LUI, L'EMPRISE ET LA LARGEUR AU SOL DE LA FENÊTRE RESTENT CELLES
    // DU PREMIER CRAN — MESURÉ, PAS SUPPOSÉ.** `_geometrieRebuild` GARDE la
    // fenêtre tant que sa résolution est bonne : `fabriqueFenetre`, qui pose
    // l'emprise, n'est donc appelée qu'une fois. Rejeu du 2026-08-21, trois
    // crans z12 → z13 → z14 sous `?globe=continu` : `fenetre.largeurM` restait à
    // **20 451 m** pendant que le bloc en faisait 10 226 puis 5 113.
    //
    // Tant que rien ne lisait la fenêtre pour se géoréférencer, c'était muet ;
    // dès que l'échelle verticale, l'altitude de cadrage et la visée s'y lisent,
    // c'est un facteur deux par cran. Contrat : `(fenetre, params) => void`,
    // posé par `main.js` — même raison de cycle d'import que `fabriqueFenetre`.
    this.recadreFenetre = null
    // ══════════ LA FENÊTRE LIT LE QUADTREE — Tâche 6 quinquies ══════════════
    //
    // ⚠️ **UN CROCHET, PAS UN IMPORT — ET POUR LA MÊME RAISON QUE
    // `fabriqueFenetre`** : `terrain.js` ne peut importer ni `fenetre-bornee.js`
    // ni `flux-terrain.js` (celui-ci importe `globe.js`, qui importe `terrain.js`
    // — le cycle que la Tâche 6 bis A a déjà payé, et qui ne casse **qu'en
    // production**). Le crochet est posé par `main.js`, derrière
    // `params.globeContinu`.
    //
    // Contrat : `(fenetre, params) => {remplis, manquants, zoom} | null`. Il a
    // DÉJÀ écrit les `y` et les normales de la fenêtre (`majHauteurs`) quand il
    // rend un objet ; `null` veut dire « rien à lire », et le chemin du MNT
    // reprend la main sans que personne n'ait à le savoir.
    this.hauteursDeFlux = null
    // ⚠️ CE SEUL rebuild a droit au maillage de brouillon (voir `_resAmorce`) :
    // c'est l'unique appel dont on sait qu'il sera remplacé tout de suite par
    // `loadRealTerrain()`. Le drapeau retombe juste après, donc tous les rebuilds
    // suivants — y compris ceux du chemin d'échec réseau — sont à pleine
    // résolution, exactement comme avant.
    this._amorce = true
    this.rebuild(params)
    this._amorce = false
    this.rebuildRoughness(params)
  }

  setDem(dem) {
    this.dem = dem
  }

  // PARTAGE DES TEXTURES QUI SONT LES MÊMES PARTOUT — rampe hypsométrique,
  // rugosité et bump. Sur un damier plein, les 24 dalles cuisaient 24 copies
  // OCTET POUR OCTET identiques : le seed de rugosité est params.seed + 777,
  // commun à tous les blocs, et la rampe ne dépend que de la palette. 2,13 Mo
  // et 80 ms de calcul par dalle, pour rien.
  //
  // ⚠️ L'EMPRUNT DOIT SE RÉPARER TOUT SEUL, et c'est là que ça se joue : la
  // source DISPOSE son ancienne texture à chaque recuisson (changement de
  // palette, régénération du relief). Un emprunteur qui garderait la référence
  // pointerait sur une texture morte — relief noir. D'où l'ensemble
  // _shareTo : c'est la SOURCE qui repousse la nouvelle texture à ses
  // emprunteurs, au lieu de compter sur l'appelant pour resynchroniser. Deux
  // chemins de main.js (régénération du relief, nuancier du panneau Créer)
  // recuisaient d'ailleurs sans prévenir le damier.
  shareTexturesFrom(src) {
    if (!src || src === this || this._shareSrc === src) return
    this.stopSharing()
    this._shareSrc = src
    ;(src._shareTo ??= new Set()).add(this)
    this._adoptShared()
  }
  stopSharing() {
    this._shareSrc?._shareTo?.delete(this)
    this._shareSrc = null
  }
  _adoptShared() {
    const src = this._shareSrc
    if (!src || !this.mapUniforms) return // appelé depuis le constructeur, trop tôt
    this.mapUniforms.uRampTex.value = src.mapUniforms.uRampTex.value
    // un matériau de relief opaque (bois, marbre…) POSSÈDE sa rugosité, et elle
    // vient d'un cache partagé : on ne la lui reprend pas
    if (!this.materialMode || this.materialMode === 'glass') {
      this.material.roughnessMap = src.material.roughnessMap
      this.material.bumpMap = src.material.bumpMap
      this.material.needsUpdate = true
    }
  }
  _pushShared() {
    if (this._shareTo?.size) for (const t of this._shareTo) t._adoptShared()
  }

  // Region cutout ("individualiser la zone"): pass the mask texture built by
  // region-mask.js fetchRegionMask() to clip the relief to an admin boundary,
  // or null to restore the full square slab. The previous mask is disposed.
  setRegionMask(texture) {
    const prev = this.mapUniforms.uRegionMask.value
    const garde = (t) => t && t !== this._regionPlaceholder && t !== this._regionEmpty
    this._regionUniform = null
    if (texture) {
      if (prev !== texture) {
        this.mapUniforms.uRegionMask.value = texture
        if (garde(prev)) prev.dispose()
      }
      this.mapUniforms.uRegionOn.value = 1
      // capture CPU pixels so overlay lines can be clipped to the region silhouette
      const cv = texture?.image
      if (cv && cv.width) {
        const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height
        const cx = c.getContext('2d'); cx.drawImage(cv, 0, 0)
        this._regionImage = cx.getImageData(0, 0, cv.width, cv.height)
      }
    } else {
      this._regionPlaceholder ??= whiteTexture()
      this.mapUniforms.uRegionMask.value = this._regionPlaceholder
      if (garde(prev)) prev.dispose()
      this.mapUniforms.uRegionOn.value = 0
      this._regionImage = null
    }
  }

  // LA DALLE EST TOUT ENTIÈRE DANS LA ZONE (ou tout entière dehors) — voir
  // maskUniformity dans region-mask.js. Le placeholder 1×1 dit la même chose que
  // le 1024² uniforme qu'il remplace, et coûte 12 Mo de moins (texture, canevas,
  // ImageData).
  //
  // ⚠️ uRegionOn RESTE À 1. C'est lui, et pas la texture, qui éteint l'arrondi de
  // socle (uSlabCorner) et qui dit aux calques qu'on est en découpe : le mettre à
  // 0 rendrait ses coins ronds à une dalle qui doit rester carrée au milieu de la
  // zone, et rouvrirait une couture visible contre sa voisine.
  setRegionUniform(dedans) {
    const prev = this.mapUniforms.uRegionMask.value
    this._regionPlaceholder ??= whiteTexture()
    this._regionEmpty ??= blackTexture()
    this.mapUniforms.uRegionMask.value = dedans ? this._regionPlaceholder : this._regionEmpty
    if (prev && prev !== this._regionPlaceholder && prev !== this._regionEmpty) prev.dispose?.()
    this.mapUniforms.uRegionOn.value = 1
    this._regionImage = null
    this._regionUniform = dedans ? 1 : 0 // ce que regionSample doit répondre partout
  }

  // world XZ → region-mask coverage in [0,1] (1 = inside / no mask). uv = xz/T + 0.5
  regionSample(x, z) {
    if (this._regionUniform != null) return this._regionUniform // dalle pleine ou vide
    const img = this._regionImage
    if (!img) return 1
    const u = x / TERRAIN_SIZE + 0.5, v = z / TERRAIN_SIZE + 0.5
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const px = Math.min(img.width - 1, (u * img.width) | 0)
    const py = Math.min(img.height - 1, (v * img.height) | 0)
    return img.data[(py * img.width + px) * 4] / 255 // red channel
  }
  // ══════════ LES COINS QUE CE BLOC A ENCORE LE DROIT D'ARRONDIR ════════════
  //
  // Le pendant, pour la SURFACE de carte, de ce que `plinth.bordsHero` et
  // `_rebuildCellWalls` font déjà au socle. Deux arrondis indépendants sur un
  // même bloc : sans celui-ci, chaque dalle du damier gardait son propre carré
  // arrondi et laissait une rainure à chaque jointure, un trou en étoile là où
  // quatre dalles se rejoignent.
  //
  // `null` (ou les quatre côtés extérieurs) = bloc isolé : clip d'avant au bit
  // près. Le décodage est dans src/damier-bords.js, avec ses tests — c'est la
  // seule vérité, le shader n'en est qu'une transcription.
  setBordsDamier(bords) {
    const f = facteursCoins(bords)
    this._coinsDamier = f.ne && f.se && f.so && f.no ? null : f // tout à 1 = rien à dire
    this.mapUniforms.uCoinsDamier.value.set(f.ne, f.se, f.so, f.no)
  }

  // the block footprint for overlay clipping (slab superellipse + region cutout)
  blockFootprint() {
    const u = this.mapUniforms
    const regionOn = u.uRegionOn.value > 0.5
    return {
      half: u.uSlabHalf.value,
      corner: regionOn ? 0 : u.uSlabCorner.value,
      cornerN: u.uSlabCornerN.value,
      // ⚠️ LES CALQUES SUIVENT LE MÊME CLIP QUE LE RELIEF. Sans `coins`, un
      // cours d'eau qui traverse une jointure s'arrêterait court sur l'ancien
      // quart de rond pendant que le terrain, lui, va maintenant jusqu'au bord.
      coins: regionOn ? null : this._coinsDamier ?? null,
      regionOn,
      regionSample: regionOn ? (x, z) => this.regionSample(x, z) : null,
    }
  }

  // ══════════ CE À QUOI LES CALQUES SE TAILLENT EN MODE CONTINU ═════════════
  //
  // L'empreinte de CONSTRUCTION, qui couvre l'emprise entière. Les calques du
  // sol (rivières, lacs, plans d'eau) cuisent leur géométrie une fois sur les
  // 168 unités, et c'est le GPU qui coupe ensuite à la fenêtre — la découpe CPU
  // ne peut pas se refaire par image (étude 3×3 §5.2 : 10 à 100 ms).
  //
  // ⚠️ PAS D'ARRONDI ICI. Le bord de l'emprise n'est pas un bord de socle : rien
  // n'y est visible, c'est simplement là que le MNT s'arrête. Un arrondi y
  // coûterait 5 760 tests de superellipse par reconstruction (blockOutline en
  // 192 sommets) pour découper une frontière que personne ne voit.
  //
  // Rend `null` hors mode continu : l'appelant garde `blockFootprint()`.
  empriseFootprint() {
    const cote = this.dem?.empriseCote > 1 ? this.dem.empriseCote : 1
    if (cote === 1) return null
    const u = this.mapUniforms
    const regionOn = u.uRegionOn.value > 0.5
    return {
      half: u.uSlabHalf.value * cote,
      corner: 0,
      cornerN: u.uSlabCornerN.value,
      regionOn,
      regionSample: regionOn ? (x, z) => this.regionSample(x, z) : null,
    }
  }

  // Les plans de coupe qui rendent la fenêtre au GPU — `null` hors mode continu.
  //
  // ⚠️ CONSTRUITS UNE FOIS ET RÉUTILISÉS TELS QUELS. Ils ne dépendent pas du
  // décalage : en mode continu le socle reste centré sur l'origine du monde et
  // c'est la géométrie du calque qui défile dessous (son groupe porte −fenêtre).
  // Voir src/fenetre-clip.js pour l'octogone et ce qu'il approxime.
  // ⚠️ ET C'EST LE MÊME TABLEAU POUR TOUS LES MATÉRIAUX : three.js compile une
  // variante de shader par NOMBRE de plans, pas par tableau, mais partager
  // l'objet évite de recréer huit `Plane` par matériau à chaque reconstruction.
  // ⚠️ ET L'EXPOSANT DU COIN EN FAIT PARTIE — l'oublier COUPE LA MER.
  //
  // Le nuanceur dessine le coin en SUPERELLIPSE d'exposant `uSlabCornerN`
  // (2 = arc de cercle, jusqu'à 6 = squircle ; réglage `slabCornerSmoothing`,
  // 0,6 par défaut, donc 4,4). Un squircle est PLUS PLEIN qu'un cercle : sa
  // bissectrice va jusqu'à `r·2^(1/2−1/n)` au lieu de `r`. `plansFenetre` sait
  // le faire depuis le 2026-08-03 (c9b23f6) — mais on ne le lui disait pas, et
  // son troisième paramètre retombait sur 2. Les quatre plans diagonaux
  // tombaient donc à 38,670 quand le relief, lui, va jusqu'à 39,136 : le calque
  // d'eau se faisait trancher d'une CORDE DROITE de 1,8 unité dans chacun des
  // quatre coins, pendant que le socle et le relief allaient jusqu'au bord.
  // C'est le défaut « la mer se découpe sans raison, en diagonale » — il ne suit
  // aucun trait de côte parce que ce n'est pas de la donnée, c'est un plan.
  // Le manque vaut `r·(2^(1/2−1/n) − 1)`, soit 0,47 unité au réglage par défaut
  // et jusqu'à 5,8 sur un bloc très arrondi.
  //
  // ⚠️ ET IL VA DANS LA CLÉ DE MÉMOÏSATION, pas seulement dans l'appel : sans
  // lui, bouger la tirette de lissage rendrait les plans d'AVANT, et le défaut
  // ne se corrigerait qu'au prochain changement de rayon.
  plansFenetre() {
    const fp = this.empriseFootprint()
    if (!fp) return null
    const u = this.mapUniforms
    const half = u.uSlabHalf.value
    const corner = u.uRegionOn.value > 0.5 ? 0 : u.uSlabCorner.value
    const expo = u.uSlabCornerN.value
    const cle = `${half}:${corner}:${expo}`
    if (this._plansCle !== cle) {
      this._plansCle = cle
      this._plans = demiPlansFenetre(half, corner, expo).map(
        (p) => new THREE.Plane(new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]), p.constant)
      )
    }
    return this._plans
  }

  // `rebuildFields: false` — LÂCHER LE TRAIT DE CÔTE SANS RECUIRE LA MER.
  // Utile au seul appelant qui sait qu'une reconstruction complète arrive dans
  // la foulée : main.js lâche le trait de côte de la zone PRÉCÉDENTE juste
  // avant de rebâtir le relief sur un nouveau MNT, et c'est `rebuild` qui
  // lancera les champs trois lignes plus loin. Sans ce drapeau, le même masque
  // de mer partait DEUX fois au travailleur par changement de zoom — mesuré à
  // La Réunion : 9 Mo recopiés et ~45 ms de travailleur pour un résultat que
  // l'arrivée du vrai trait de côte écrasait 70 ms plus tard.
  setCoastMask(texture, coastImage, { rebuildFields = true } = {}) {
    // coast masks are owned by main.js's LRU cache — NEVER dispose here: the
    // previously active texture is usually still cached, and disposing it on a
    // swap would kill a live cache entry. The cache disposes on eviction only.
    if (texture) {
      this.mapUniforms.uCoastMask.value = texture
      this.mapUniforms.uCoastMaskOn.value = 1
    } else {
      this._coastPlaceholder ??= whiteTexture()
      this.mapUniforms.uCoastMask.value = this._coastPlaceholder
      this.mapUniforms.uCoastMaskOn.value = 0
    }
    // coastImage (champ R8 du masque, le tableau MÊME de sa DataTexture) :
    // corrige le garde-fou topologique sea-mask — un polder sous 0 m déclaré
    // TERRE par le trait de côte ne doit plus être flood-fillé en mer. Le
    // fetch du masque est async : à sa réception on RE-construit le sea mask.
    // CONTRAT : sans image, le masque de mer retombe bit-à-bit sur l'existant.
    const img = texture ? coastImage || null : null
    if (img !== this._coastImage) {
      this._coastImage = img
      this._coastLand = null // cache de la côte mondiale (dépend de dem.size) — invalidé
      // ⚠️ withAnalysis: false — la côte ne change QUE la mer. Recuire les
      // ~10 flous de l'analyse ici coûterait 387 ms pour un résultat identique.
      if (rebuildFields && this.dem?.data) this._buildFields({ withAnalysis: false })
    }
  }

  // Fancy > Surface shader: select the animated pattern (0 = off) and push its
  // per-effect params to the uniforms. Drive it with tickSurfaceFx(dt, speed).
  setSurfaceFx(id) {
    this.mapUniforms.uSurfaceFx.value = id | 0
  }
  // Aerial photo skin — pass the object AerialLayer.build() returns, or null to
  // clear. The placeholder stays bound when off (a null sampler can fail to
  // compile), so uAerialOn is what actually gates the blend, not the texture.
  setAerial(built) {
    const u = this.mapUniforms
    if (built && built.texture) {
      u.uAerial.value = built.texture
      u.uAerialOn.value = 1
      u.uAerialOffset.value.set(built.uv.offset[0], built.uv.offset[1])
      u.uAerialScale.value.set(built.uv.scale[0], built.uv.scale[1])
    } else {
      u.uAerialOn.value = 0
    }
  }
  setAerialOpacity(v) {
    this.mapUniforms.uAerialOpacity.value = v
  }
  // v49 : bande de fondu côtier de la photo aérienne (fraction de uSeaRange).
  // 0 = photo pleine partout ; >0 = elle s'estompe sous l'eau au-delà du rivage.
  setAerialCoastFade(v) {
    this.mapUniforms.uAerialCoastFade.value = v
  }
  // LUMIÈRES NOCTURNES — même contrat que setAerial() : on passe l'objet rendu
  // par NuitLayer.build(), ou null pour éteindre. La texture de remplacement
  // reste liée quand c'est éteint (un échantillonneur nul peut refuser de
  // compiler) ; c'est uNuitOn qui commande, jamais la texture.
  setNuit(built) {
    const u = this.mapUniforms
    if (built && built.texture) {
      u.uNuit.value = built.texture
      u.uNuitOn.value = 1
      u.uNuitOffset.value.set(built.uv.offset[0], built.uv.offset[1])
      u.uNuitScale.value.set(built.uv.scale[0], built.uv.scale[1])
    } else {
      u.uNuitOn.value = 0
    }
  }
  // L'intensité PORTE DÉJÀ l'heure : main.js la calcule par intensiteNuit()
  // (src/nuit.js) et la multiplie par le réglage utilisateur. À 0, le shader
  // saute le bloc entier.
  setNuitIntensite(v) {
    this.mapUniforms.uNuitIntensite.value = v
  }
  // Les deux tirettes de la couche nocturne. ⚠️ On reçoit ici des valeurs DÉJÀ
  // converties (fondNuit / gainNuit, src/reglages-couches.js) : c'est là que
  // vivent l'inversion « assombrissement → ce qui reste » et le garde-fou
  // anti-NaN. Passer la valeur brute de la tirette assombrirait à l'envers.
  setNuitFond(v) {
    this.mapUniforms.uNuitFond.value = v
  }
  setNuitGain(v) {
    this.mapUniforms.uNuitGain.value = v
  }
  // OCCUPATION DU SOL — même contrat que setAerial()/setNuit() : on passe
  // l'objet rendu par OccupationSolLayer.build(), ou null pour éteindre.
  //
  // ⚠️ IL Y A DEUX TEXTURES ICI, ET LA SECONDE EST FACILE À OUBLIER. `uSol`
  // porte les codes, `uSolLut` la table qui les traduit. Poser la première sans
  // la seconde ne casse rien de visible : la table de remplacement est noire et
  // opaque à zéro, donc la couche s'allume et ne peint RIEN. On chercherait le
  // défaut du côté des tuiles pendant longtemps.
  setSol(built) {
    const u = this.mapUniforms
    this._gateCouche('SHIBU_SOL', !!(built && built.texture && built.lut))
    if (built && built.texture && built.lut) {
      u.uSol.value = built.texture
      u.uSolLut.value = built.lut
      u.uSolOn.value = 1
      u.uSolOffset.value.set(built.uv.offset[0], built.uv.offset[1])
      u.uSolScale.value.set(built.uv.scale[0], built.uv.scale[1])
      // La taille réelle de la mosaïque, pour que le mélange des quatre voisins
      // vise les bons texels. Une valeur figée décalerait le lavis d'un demi
      // texel dès que l'emprise change de nombre de tuiles.
      const im = built.texture.image
      u.uSolTexel.value.set(1 / Math.max(1, im.width), 1 / Math.max(1, im.height))
    } else {
      u.uSolOn.value = 0
    }
  }
  setSolOpacite(v) {
    this.mapUniforms.uSolOpacite.value = v
  }

  // ════════ ALLUMER UNE COUCHE, C'EST RECOMPILER — ET C'EST LE PRIX JUSTE ═════
  //
  // Le `#define` décide si le sampler EXISTE dans le programme, donc s'il occupe
  // une unité de texture. Le changer force three à recompiler ce matériau : une
  // à deux centaines de millisecondes, payées sur le geste explicite qui allume
  // la couche — et payées UNE fois, pas à chaque image.
  //
  // ⚠️ ON SORT TÔT SI RIEN NE CHANGE. Sans ce test, chaque rafraîchissement de
  // mosaïque (il y en a un par déplacement) reposerait le même define et
  // relèverait `needsUpdate` : le damier recompilerait ses vingt-trois
  // programmes en plein déplacement, ce qui est exactement le gel qu'on refuse.
  _gateCouche(nom, on) {
    const d = this.material.defines || (this.material.defines = {})
    const avant = d[nom] === 1
    if (avant === !!on) return
    if (on) d[nom] = 1
    else delete d[nom]
    this.material.needsUpdate = true
  }
  // HAUTEUR DE CANOPÉE — même contrat que setSol() : on passe l'objet rendu par
  // CanopeeLayer.build(), ou null pour éteindre.
  //
  // ⚠️ LE MÊME PIÈGE DES DEUX TEXTURES QU'AU-DESSUS, et il ne s'annonce pas plus
  // ici que là : poser `uCanopee` sans `uCanopeeLut` laisse la table de
  // remplacement, qui est noire et d'alpha nul. La couche s'allume donc,
  // l'attribution s'affiche, et rien ne se peint — on chercherait longtemps du
  // côté des tuiles.
  setCanopee(built) {
    const u = this.mapUniforms
    this._gateCouche('SHIBU_CANOPEE', !!(built && built.texture && built.lut))
    if (built && built.texture && built.lut) {
      u.uCanopee.value = built.texture
      u.uCanopeeLut.value = built.lut
      u.uCanopeeOn.value = 1
      u.uCanopeeOffset.value.set(built.uv.offset[0], built.uv.offset[1])
      u.uCanopeeScale.value.set(built.uv.scale[0], built.uv.scale[1])
      // La taille réelle de la mosaïque, pour que l'ombre de lisière vise le
      // voisin d'UN texel et pas d'un tiers ou de trois. Une valeur figée
      // épaissirait ou effacerait l'ombre dès que l'emprise change de nombre de
      // tuiles — un défaut qui ne se voit qu'en comparant deux zooms.
      const im = built.texture.image
      u.uCanopeeTexel.value.set(1 / Math.max(1, im.width), 1 / Math.max(1, im.height))
    } else {
      u.uCanopeeOn.value = 0
    }
  }
  setCanopeeOpacite(v) {
    this.mapUniforms.uCanopeeOpacite.value = v
  }
  applyFxParams(pp) {
    const u = this.mapUniforms
    u.uFxColA.value.set(pp.colA)
    u.uFxColB.value.set(pp.colB)
    u.uFxColC.value.set(pp.colC)
    u.uFxScale.value = pp.scale
    u.uFxP1.value = pp.p1
    u.uFxP2.value = pp.p2
    u.uFxP3.value = pp.p3
    u.uFxOpacity.value = pp.opacity ?? 1 // Appearance
    u.uFxBlend.value = pp.blend | 0
  }
  tickSurfaceFx(dt, speed) {
    if (this.mapUniforms.uSurfaceFx.value > 0) this.mapUniforms.uFxTime.value += dt * speed
  }

  // scene height → display elevation in feet (real when a DEM drives the terrain)
  heightToFeet(h) {
    return this._h2ft ? this._h2ft(h) : Math.round(4800 + h * 420)
  }

  // ══════════ L'ÉTENDUE MONDE DU CHAMP ══════════════════════════════════════
  //
  // Un bloc ordinaire couvre TERRAIN_SIZE unités ; une emprise 3×3 en couvre
  // trois fois plus, pour la MÊME résolution au sol (dem-emprise.js recolle, il
  // ne rééchantillonne pas). Toutes les formules qui convertissaient `x` en
  // pixel de champ passent par ici.
  //
  // ⚠️ ET L'ÉCHELLE VERTICALE NE BOUGE PAS. `scale = span / extentMeters` : le
  // numérateur triple et le dénominateur aussi, donc le résultat est identique
  // au bit près. C'est ce qui garantit qu'entrer en mode continu ne change pas
  // d'un pouce la hauteur du relief — remplacer `TERRAIN_SIZE` par `_span()`
  // sans tripler `extentMeters` écraserait le relief au tiers de sa hauteur.
  _span() {
    return TERRAIN_SIZE * (this.dem?.empriseCote ?? 1)
  }

  // ══════════ LA RÉSOLUTION DE LA FENÊTRE CONTINUE ══════════════════════════
  //
  // MESURÉ, machine de développement, emprise 3×3, La Réunion z13 et Chamonix
  // z12, médiane sur 15 images :
  //
  //   res | sommets | un pas de fenêtre | budget de l'étude
  //   768 | 591 361 |      36,0 ms      |        6 ms   ← six fois trop
  //   384 | 148 225 |       (voir plus bas)
  //
  // L'étude proposait déjà « res 384 pendant le drag, res 768 au repos »
  // (§3.4) ; à ce jalon on prend le plus simple qui marche : 384 EN PERMANENCE
  // en mode continu. Le raffinement au repos est du jalon 4.
  //
  // ⚠️ Le plafond doit valoir pour `rebuild` ET pour `tickFenetre`. Deux
  // résolutions différentes feraient sauter la géométrie au premier geste —
  // `gridTemplate`, `tintField` et `detailField` sont tous indexés par `res`.
  // ⚠️ `resFenetre` est POSÉ PAR main.js (fenetre-finesse.js) : 384 tant que
  // l'image bouge, 768 après 0,4 s d'immobilité franche. Laissé à zéro, on
  // retrouve le comportement du jalon 3 — 384 en permanence — et le mode
  // ORDINAIRE ne passe même pas par ici.
  //
  // ⚠️ LE `Math.min` RESTE, il n'est pas redondant avec `resDeFinesse`. Cette
  // méthode est aussi appelée depuis `rebuild()`, sur un chemin (changement de
  // zone, de zoom, de palette) où main.js n'a pas encore eu son image pour
  // remettre `resFenetre` à jour. Sans le min, un utilisateur passé à 256 dans
  // les Paramètres se verrait servir du 384 le temps d'une reconstruction.
  //
  // ⚠️ ET ELLE EST PUBLIQUE DEPUIS LE 2026-08-05 (elle s'appelait `_resFenetre`).
  // `plinth.js` la lit : le socle est coulé sur le MÊME contour que le bord du
  // maillage, et deux résolutions différentes les décollent l'un de l'autre.
  // C'était le cas pendant tout glissement de fenêtre — maillage à 384, socle à
  // 768 — jusqu'à ce que la revue finale du damier le mesure.
  resMaillage(params) {
    if (!(this.dem?.empriseCote > 1)) return params.resolution
    return Math.min(params.resolution, this.resFenetre || RES_FENETRE_CONTINUE)
  }

  // ══════════ CHANGER DE RÉSOLUTION SANS RECUIRE LES CHAMPS ═════════════════
  //
  // `rebuild()` refait TOUT, champs compris : analyse de relief, masque de mer,
  // masque côtier — l'atlas de l'emprise, mesuré à 1 378 ms (étude §2.2). Or
  // AUCUN de ces champs ne dépend de la résolution du maillage : ils sont cuits
  // sur l'emprise en coordonnées monde, et le maillage ne fait que les LIRE. Les
  // refaire pour changer un nombre de triangles serait payer 1,4 s pour rien.
  //
  // Ce qui dépend de `res`, et qu'il faut donc refaire, c'est exactement trois
  // choses — celles que l'avertissement de `resMaillage` nomme depuis le jalon
  // 3 : le gabarit de grille (`gridTemplate`), le champ de grain
  // (`detailFieldEmprise`) et le champ de teinte (`tintField`).
  //
  // @returns {number} millisecondes passées, pour que l'appelant puisse le dire
  majResFenetre(params) {
    const res = this.resMaillage(params)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tpl = gridTemplate(res, TERRAIN_SIZE)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tpl.position), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(tpl.uv, 2))
    geo.setIndex(new THREE.BufferAttribute(tpl.index, 1))
    const sample = this._makeSampler(params)
    this.sample = sample
    const { minH, maxH } = this._ecrireRelief(geo, params, res, sample, this._makeGridSampler(params, res))
    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    // ⚠️ **LE DOMAINE VIENT DE BOUGER : LE RÉGLAGE DE RAMPE DOIT SUIVRE DANS LE
    // MÊME TOUR** — Tâche RAMP. `params.heightPivot` est exprimé dans un domaine
    // de RÉFÉRENCE (`src/rampe-fixe.js`) ; sans ce rendez-vous, l'image suivante
    // porterait la transposition de l'AMPLITUDE PRÉCÉDENTE. Mesuré avant de le
    // poser (`.banc/RAMP-FLASH`) : **sept** changements d'amplitude sur une
    // descente de six crans pour seulement **deux** reposes du réglage — cinq
    // images à la mauvaise loi, et c'est le voile de ~300 ms que SUR a filmé.
    this._surAmplitude?.()
    this._pousseFenetre()
    // ⚠️ L'ANCIENNE GÉOMÉTRIE EST LIBÉRÉE, et ce n'est pas facultatif ici. À la
    // différence de `rebuild()`, qu'on appelle une fois par zone, celle-ci part
    // à chaque pause : une géométrie de res 768 pèse 38,3 Mo de tampons GPU, et
    // les oublier ferait monter le tas d'autant à chaque arrêt du geste.
    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
    return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  }

  // ══════════ CUIRE LES DEUX GRAINS PENDANT QU'ON A LE DROIT D'ÊTRE LENT ═════
  //
  // ⚠️ SANS ÇA, LA PREMIÈRE BASCULE GÈLE 1,5 s. Mesuré sur l'instance vivante,
  // La Réunion z12 en 3×3, `majResFenetre` chronométrée de l'extérieur :
  //
  //     vers 384, grain déjà cuit │    18 ms  │  à cuire │   373 ms
  //     vers 768, grain déjà cuit │    73 ms  │  à cuire │ 1 516 ms
  //
  // Le gel de 1,5 s tombait 0,4 s APRÈS que la carte se soit posée, sans que
  // personne ait rien touché — la lecture la plus naturelle en est « l'onglet a
  // planté ». La cuisson est incompressible (285 ns le point, 5,31 M points à
  // res 768) ; c'est son MOMENT qui est déplaçable, et sa place est sous le
  // voile de chargement, où l'attente est annoncée.
  //
  // ⚠️ ON RÉSOUT LES MÊMES CLÉS QUE `_makeGridSampler`, PAS DES CLÉS
  // RESSEMBLANTES. Une seule composante qui diffère (l'accord de `detailScale`
  // à la résolution, surtout) et le préchauffage cuirait un champ que personne
  // ne demandera jamais : on paierait la lenteur ET le gel. D'où le passage par
  // `_detailScalePour`, la seule formule, partagée avec le sampler.
  //
  // @param {object} params
  // @param {number[]} listeRes - les résolutions du mode continu (`resFinesses`)
  // @returns {number} millisecondes passées — zéro quand tout était déjà en cache
  prechauffeFinesse(params, listeRes) {
    const cote = this.dem?.empriseCote
    if (params.source !== 'real' || !this.dem || !(cote > 1)) return 0
    if (!(this._detailEffectif(params) > 0)) return 0 // grain éteint : aucun champ à cuire
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    for (const res of listeRes) {
      if (!(res > 0)) continue
      detailFieldEmprise(params.seed, this._detailScalePour(params, res), res, TERRAIN_SIZE, cote)
    }
    return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  }

  // ══════════ LE GRAIN DOIT DESCENDRE AVEC LA RÉSOLUTION ════════════════════
  //
  // ⚠️ SANS ÇA, LE MODE CONTINU AFFICHE DU POIVRE ET SEL. `detail-noise.js`
  // mesure que le maillage perd 18,3 % du grain à res 768 et **39,9 % à res
  // 384**, où la corrélation entre sommets voisins tombe à 0,53 : le grain
  // cesse d'être une texture et devient un scintillement. Chiffré par
  // `grainSamplesPerCycle` : **0,95 maille par longueur d'onde à res 384**,
  // contre un plancher mesuré à 1,9.
  //
  // Et c'est en mode continu que ce serait le PLUS visible, parce que c'est le
  // seul mode où l'image bouge en permanence — le scintillement d'aliasing ne
  // se voit qu'en mouvement.
  //
  // Le remède est celui que `detail-noise.js` réclame en toutes lettres :
  // conserver `res / detailScale`. À res 384 le grain revient exactement aux
  // 1,901 maille/λ de res 768 ; il a la même apparence, il est simplement deux
  // fois plus large en unités monde.
  _detailScaleFenetre(params) {
    return this._detailScalePour(params, this.resMaillage(params))
  }

  // La même chose pour une résolution NOMMÉE, et non pour celle de l'instant.
  // ⚠️ UNE SEULE FORMULE. Elle sert de clé de cache au champ de grain
  // (`detailFieldEmprise`) : le préchauffage et le sampler doivent en sortir le
  // même nombre au bit près, sinon ils cuisent deux champs au lieu d'un.
  _detailScalePour(params, res) {
    return accordeDetailScale(params.detailScale, params.resolution, res)
  }

  // Le grain RÉELLEMENT appliqué. ⚠️ En mode Naturel le texture shading porte
  // déjà une micro-texture, et une vraie : le FBM y est bridé (voir
  // `_makeDemSampler`). Extrait ici parce que le préchauffage doit poser la
  // même question que le sampler — « y a-t-il un champ à cuire ? » — et qu'à
  // deux endroits la réponse finirait par diverger.
  _detailEffectif(params) {
    return this.mapUniforms.uColorMode.value === 1 ? Math.min(params.detail, NATURAL_DETAIL_MAX) : params.detail
  }

  // ══════════ LE GRAIN VA-T-IL S'AJOUTER AUX HAUTEURS DU FLUX ? — Tâche FLU ═══
  //
  // ⚠️ **LE MÊME PRÉDICAT QUE `_ecrireRelief`, EXPORTÉ POUR QU'IL N'Y EN AIT
  // QU'UN.** `main.js` (`hauteursDeFlux`) demande à `appliquerHauteurs` de NE PAS
  // écrire les normales quand `_ecrireRelief` va les refaire après le grain ;
  // si les deux se posaient la question chacun de leur côté, une divergence
  // laisserait une nappe SANS normales — un relief noir, sans une erreur.
  grainSuivra(params) {
    return this._detailEffectif(params) > 0
  }

  // ══════════ LE GRAIN CUIT D'AVANCE, HORS DU FIL — Tâche FLU, poste ④ ═════════
  //
  // ⛔ **`noise` = 1 407 ms DE FIL PRINCIPAL SUR LA DESCENTE À CPU ×4**, dans une
  // seule tâche de 1 604 ms (`terrain.rebuild`, `.banc/sonde-descente-x4.log`) :
  // c'est la cuisson du champ de grain (`detailField`) et du champ de teinte
  // (`tintField`) au premier `rebuild` d'une résolution. Ces deux champs ne
  // dépendent que de (graine, échelle, résolution, taille) — tout est connu
  // bien avant qu'on descende. On les cuit donc dans le Worker de terrain dès
  // qu'on sait qu'on va en avoir besoin (le début d'une plongée), et
  // `_ecrireRelief` les trouve en cache. S'ils n'y sont pas encore (plongée
  // plus rapide que le Worker), le chemin d'avant cuit en ligne : aucune
  // régression possible, seulement un gain manqué.
  //
  // ⚠️ **LES MÊMES CLÉS QUE `_ecrireRelief`, PAS DES CLÉS RESSEMBLANTES** — le
  // piège de `prechauffeFinesse` : `detailField(params.seed, params.detailScale,
  // res, TERRAIN_SIZE)` et `tintField(params.seed + 101, res, TERRAIN_SIZE)`.
  //
  // @returns {Promise<boolean>} vrai si quelque chose a été cuit
  prechauffeGrainHorsFil(params, res = this.resMaillage(params)) {
    if (!(res > 0)) return Promise.resolve(false)
    const seed = params.seed
    const detailScale = params.detailScale
    const seedTeinte = seed + 101
    const detailManque = this.grainSuivra(params) && !detailFieldEnCache(seed, detailScale, res, TERRAIN_SIZE)
    const teinteManque = !tintFieldEnCache(seedTeinte, res, TERRAIN_SIZE)
    if (!detailManque && !teinteManque) return Promise.resolve(false)
    const cle = `${seed}|${detailScale}|${res}|${detailManque}|${teinteManque}`
    if (this._grainEnVol === cle) return Promise.resolve(false) // déjà parti
    this._grainEnVol = cle
    return runGrainJob({ seed, detailScale, res, size: TERRAIN_SIZE, seedTeinte })
      .then((r) => {
        if (this._grainEnVol === cle) this._grainEnVol = null
        if (!r) return false
        if (detailManque && r.detail) poserDetailField(seed, detailScale, res, TERRAIN_SIZE, r.detail)
        if (teinteManque && r.teinte) poserTintField(seedTeinte, res, TERRAIN_SIZE, r.teinte)
        return true
      })
      .catch(() => { if (this._grainEnVol === cle) this._grainEnVol = null; return false })
  }

  // ══════════ LA TEINTE PAR SOMMET, UNE IMAGE PLUS TARD — Tâche FLU, poste ④ ══
  //
  // ⛔ **`natGris` = 1 118 ms DE FIL PRINCIPAL SUR LA DESCENTE À CPU ×4**, rejouée
  // à chaque tuile qui atterrit : deux `Math.pow` par sommet sur toute la nappe.
  // La couleur n'est lue que par le GPU. Sur le chemin du RAFFINEMENT (une nappe
  // déjà peinte, dont les hauteurs viennent de bouger d'un cran), elle part
  // donc dans le Worker et revient écrire l'attribut `color` en place, une
  // image ou deux plus tard — pendant lesquelles la nappe garde la teinte du
  // raffinement précédent, à quelques millièmes de la nouvelle.
  //
  // ⚠️ **PAS SUR UNE GÉOMÉTRIE NEUVE, NI SUR UN CHANGEMENT DE NIVEAU** :
  // `_ecrireRelief` ne délègue que si l'appelant le demande (`teinteDeportee`),
  // et seul `rafraichirFenetre` le demande. Un `rebuild` peint en ligne, comme
  // avant — une nappe sans couleur serait noire le temps du voyage.
  //
  // ⚠️ **UN JETON PAR ENVOI, ET LE DERNIER GAGNE** : deux raffinements en vol,
  // le premier qui revient ne doit pas recouvrir le second. Et si la géométrie
  // a été remplacée entre-temps (changement de résolution), le résultat est
  // jeté : sa taille ne serait de toute façon plus la bonne.
  _posterTeinte(geo, cAtt, { arr, normals, count, minH, maxH, params, res }) {
    const jeton = (this._teinteJeton = (this._teinteJeton || 0) + 1)
    const { y, ny } = extraireYNy(arr, normals, count)
    runTeinteJob({ y, ny, count, minH, maxH, seedTeinte: params.seed + 101, res, size: TERRAIN_SIZE })
      .then((r) => {
        if (!r?.colors) return
        if (jeton !== this._teinteJeton) return // un raffinement plus récent est parti
        if (this.mesh.geometry !== geo || geo.attributes.color !== cAtt) return // géométrie remplacée
        if (cAtt.array.length < r.colors.length) return
        cAtt.array.set(r.colors)
        cAtt.needsUpdate = true
        this._teintesDeportees = (this._teintesDeportees || 0) + 1
      })
      .catch((err) => console.warn('[teinte] travail perdu, la nappe garde sa teinte précédente', err))
  }

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    const span = this._span()
    const fen = this.fenetre // lu par référence : le drag le bouge sans refaire le sampler
    // demExaggeration is the per-zoom value chosen in the UI (coarse blocks big)
    const scale = (span / dem.extentMeters) * lireExageration(params)
    const meanM = dem.meanM
    this._h2ft = (h) => Math.round((h / scale + meanM) * 3.28084)

    const sDetail = new Simplex2(mulberry32(params.seed))
    const { size } = dem
    // ⚠️ PAS `params.detailScale` DIRECTEMENT. En mode continu le maillage tombe
    // à res 384 et le grain doit descendre avec, sans quoi il scintille — voir
    // `_detailScaleFenetre`. Hors mode continu la valeur ressort inchangée, au
    // bit près (l'accord sort sèchement à résolution égale).
    const detailScale = this._detailScaleFenetre(params)
    // ⚠️ En mode Naturel le texture shading PORTE déjà la micro-texture, et une
    // VRAIE (elle sort du DEM). Le bruit FBM de détail viendrait en superposer
    // une inventée, décorrélée du relief : les deux se brouillent et le peigné
    // s'éteint. On bride donc le détail sans toucher à params — le curseur garde
    // la valeur de l'utilisateur, qui la retrouve en repassant en Classique.
    const detail = this._detailEffectif(params)

    return (x, z) => {
      const px = ((x + fen.x) / span + 0.5) * (size - 1)
      const py = ((z + fen.z) / span + 0.5) * (size - 1)
      const raw = sampleDem(dem, px, py) // elevation in meters
      const h = (raw - meanM) * scale

      // optional fine grain on top of the (smoother) 30m-class data — but FADE it
      // out at/below sea level (elevation 0) so the displacement can never poke
      // above the waterline and paint phantom islands / stray coastlines
      const landFactor = smoothstep(0, 90, raw)
      // ⚠️ LE GRAIN S'ÉVALUE EN COORDONNÉES DU TERRAIN, `x + fen.x`, PAS EN
      // COORDONNÉES DE LA GÉOMÉTRIE. En mode continu la géométrie ne bouge pas :
      // évalué en `x` seul, le grain resterait COLLÉ À L'ÉCRAN pendant que le
      // relief glisse dessous (étude §5.4). Et ce sampler-ci n'est pas un détail
      // — c'est `terrain.sample`, celui que lisent le socle, les bateaux, le
      // drapage GPX et les étiquettes : le grain doit y être au même endroit que
      // dans la géométrie, sinon les objets posés au sol flottent.
      // Hors mode continu `fen` vaut zéro et l'expression est celle d'avant.
      const gx = x + fen.x
      const gz = z + fen.z
      const fine =
        landFactor *
        (detail * fbm(sDetail, gx * detailScale, gz * detailScale, 3, 2.3, 0.55) +
          detail * 0.35 * fbm(sDetail, gx * detailScale * 4.1 + 31, gz * detailScale * 4.1 - 17, 2, 2.2, 0.5))
      // no basin carve in real-world mode — the map runs uninterrupted
      return h + fine
    }
  }

  // ÉCHANTILLONNEUR DE CHAMP — les altitudes en coordonnées ABSOLUES de
  // l'emprise, indépendantes du décalage de fenêtre, et SANS grain FBM.
  //
  // C'est ce que consomme la simulation d'eau (`ocean.js`) pour cuire son champ
  // hauteur + distance-rivage une bonne fois sur les 168 unités de l'emprise.
  // `this.sample`, lui, ne sait répondre que « sous le point AFFICHÉ en x » : il
  // porte le décalage, donc il rendrait un champ différent à chaque pas.
  //
  // ⚠️ PAS DE GRAIN, ET C'EST GRATUIT ICI. Le grain FBM est éteint sous 90 m
  // d'altitude par `landFactor = smoothstep(0, 90, raw)` : à la ligne d'eau il
  // vaut exactement ZÉRO, et c'est la ligne d'eau que ce champ sert à trouver.
  // Le payer coûterait cinq octaves de simplex sur 1 152² = 1,33 million de
  // points, soit ~175 ns le point (mesure de detail-noise.js) — 230 ms de fil
  // principal gelé par reconstruction, pour un déplacement nul là où on regarde.
  //
  // Rend `null` hors relief réel : l'appelant garde alors son chemin d'avant.
  sampleChamp(params) {
    if (params.source !== 'real' || !this.dem) return null
    const dem = this.dem
    const span = this._span()
    const scale = (span / dem.extentMeters) * lireExageration(params)
    const meanM = dem.meanM
    const { size } = dem
    return (x, z) => (sampleDem(dem, (x / span + 0.5) * (size - 1), (z / span + 0.5) * (size - 1)) - meanM) * scale
  }

  // Pousse le décalage de fenêtre et l'emprise des masques dans les uniformes.
  // Appelé à chaque pas de défilement (deux flottants) et à chaque
  // reconstruction. Hors mode continu il écrit les valeurs neutres.
  _pousseFenetre() {
    const cote = this.dem?.empriseCote > 1 ? this.dem.empriseCote : 1
    this.mapUniforms.uMaskSpan.value = TERRAIN_SIZE * cote
    this.mapUniforms.uFenetre.value.set(this.fenetre.x, this.fenetre.z)
  }

  // ÉCHANTILLONNEUR DE GRILLE — la même formule que _makeDemSampler, mais qui
  // LIT le grain FBM dans un champ pré-cuit au lieu de le recalculer. 175 ms sur
  // les 194 ms d'échantillonnage à res 1024 : 5 octaves de simplex par sommet,
  // pour un déplacement de 0,19 px CSS en moyenne au réglage par défaut.
  //
  // ⚠️ Il ne remplace PAS `this.sample` : celui-là doit rester interrogeable en
  // TOUT point (socle, bateaux, drapage GPX, étiquettes), pas seulement sur les
  // sommets de la grille. Les deux formules sont identiques au bit près — c'est
  // seulement le chemin du grain qui change, et test/detail-noise.test.js le
  // verrouille sur six combinaisons d'exagération, de zoom et de finesse.
  //
  // ⚠️ NE PAS « SIMPLIFIER » l'expression finale : `detail·(a + 0,35·b)` n'est
  // pas bit-identique à `detail·a + detail·0,35·b` (48 % des sommets diffèrent).
  // Rend null quand il n'y a rien à mémoriser (relief procédural, ou grain nul).
  _makeGridSampler(params, res) {
    if (params.source !== 'real' || !this.dem) return null
    const dem = this.dem
    const span = this._span()
    const fen = this.fenetre
    const scale = (span / dem.extentMeters) * lireExageration(params)
    const meanM = dem.meanM
    const { size } = dem
    const detail = this._detailEffectif(params)
    if (!(detail > 0)) {
      // grain éteint (zooms continentaux, curseur à zéro) : aucun champ à cuire.
      // `landFactor · (0·a + 0·0,35·b)` vaut 0 tout rond, on peut le sauter.
      return (i, x, z) => (sampleDem(dem, ((x + fen.x) / span + 0.5) * (size - 1), ((z + fen.z) / span + 0.5) * (size - 1)) - meanM) * scale
    }
    // ══════════ MODE CONTINU : LE GRAIN EST LU EN COORDONNÉES MONDE ═════════
    //
    // Indexé sur la grille (`i`), le grain serait SOLIDAIRE DE L'ÉCRAN : en
    // défilant, le relief glisserait sous un moirage immobile (étude §5.4).
    // On lit donc dans le champ cuit sur l'EMPRISE, à l'endroit du monde où se
    // trouve vraiment ce sommet.
    //
    // ⚠️ ET LES POIDS BILINÉAIRES SONT CONSTANTS SUR TOUTE LA GRILLE. C'est ce
    // qui rend l'opération abordable : la grille est régulière et le décalage
    // est le même pour tous les sommets, donc la partie fractionnaire du
    // décalage se calcule UNE FOIS PAR IMAGE, pas 148 225 fois. Il ne reste par
    // sommet que quatre lectures et quatre multiplications-additions par octave.
    const cote = dem.empriseCote
    if (cote > 1) {
      const champ = detailFieldEmprise(params.seed, this._detailScaleFenetre(params), res, TERRAIN_SIZE, cote)
      const N = cote * res + 1
      const n1 = res + 1
      const seg = TERRAIN_SIZE / res
      const dec = (res * (cote - 1)) / 2
      // Décalage de lecture, EN NŒUDS : entier + fraction.
      const ux = dec + fen.x / seg
      const uz = dec + fen.z / seg
      // ⚠️ BORNÉ AU CHAMP. La butée élastique laisse déborder d'un huitième de
      // socle au-delà de la course, soit 48 nœuds hors de l'emprise, là où
      // `sampleDem` CLAMPE déjà le relief. Le grain doit clamper avec lui —
      // sinon on lirait à l'index négatif et le grain deviendrait NaN sur une
      // bande du bord, c'est-à-dire un relief NaN, c'est-à-dire un trou noir.
      const ix0 = Math.max(0, Math.min(N - 2, Math.floor(ux)))
      const iz0 = Math.max(0, Math.min(N - 2, Math.floor(uz)))
      const fx = Math.max(0, Math.min(1, ux - ix0))
      const fz = Math.max(0, Math.min(1, uz - iz0))
      // les quatre poids, une fois pour toutes
      const w00 = (1 - fx) * (1 - fz)
      const w10 = fx * (1 - fz)
      const w01 = (1 - fx) * fz
      const w11 = fx * fz
      // ⚠️ CE QUE COÛTE CE SAMPLER, ET CE QUI NE LE COÛTE PAS. Mesuré : un pas
      // de fenêtre passe de 9,9 à 12,1 ms, soit **+2,2 ms** pour le grain en
      // coordonnées monde. J'ai essayé de supprimer la division entière par
      // sommet (compter ix et iy dans la boucle appelante plutôt que de les
      // déduire de `i`) : **zéro gain mesurable**, 12,1 ms avant comme après,
      // sur les deux zones. Le prix n'est pas l'arithmétique, ce sont les huit
      // lectures dispersées dans un tableau de 10,6 Mo — exactement le goulot de
      // bande passante que l'étude annonce pour la machine cible. On garde donc
      // la version la plus simple : optimiser ici demanderait de changer la
      // disposition du champ, pas de compter des index.
      return (i, x, z) => {
        const raw = sampleDem(dem, ((x + fen.x) / span + 0.5) * (size - 1), ((z + fen.z) / span + 0.5) * (size - 1))
        const h = (raw - meanM) * scale
        const landFactor = smoothstep(0, 90, raw)
        const iy = (i / n1) | 0
        const ix = i - iy * n1
        // le sommet (ix, iy) de la géométrie tombe au nœud (ix + ix0, iy + iz0)
        // du champ d'emprise ; les voisins de droite et du bas sont bornés au
        // dernier nœud pour ne jamais sortir, exactement comme `sampleDem`.
        const jx = ix + ix0 < N - 1 ? ix + ix0 : N - 1
        const jz = iy + iz0 < N - 1 ? iy + iz0 : N - 1
        const jx1 = jx + 1 < N ? jx + 1 : jx
        const jz1 = jz + 1 < N ? jz + 1 : jz
        const a = jz * N * 2
        const b = jz1 * N * 2
        const g0 = champ[a + jx * 2] * w00 + champ[a + jx1 * 2] * w10 + champ[b + jx * 2] * w01 + champ[b + jx1 * 2] * w11
        const g1 =
          champ[a + jx * 2 + 1] * w00 +
          champ[a + jx1 * 2 + 1] * w10 +
          champ[b + jx * 2 + 1] * w01 +
          champ[b + jx1 * 2 + 1] * w11
        const fine = landFactor * (detail * g0 + detail * 0.35 * g1)
        return h + fine
      }
    }
    const grain = detailField(params.seed, params.detailScale, res, TERRAIN_SIZE)
    return (i, x, z) => {
      const raw = sampleDem(dem, ((x + fen.x) / span + 0.5) * (size - 1), ((z + fen.z) / span + 0.5) * (size - 1))
      const h = (raw - meanM) * scale
      const landFactor = smoothstep(0, 90, raw)
      const fine = landFactor * (detail * grain[i * 2] + detail * 0.35 * grain[i * 2 + 1])
      return h + fine
    }
  }

  // Height field sampler for the current seed — kept so other objects can query it.
  _makeSampler(params) {
    if (params.source === 'real' && this.dem) return this._makeDemSampler(params)
    this._h2ft = null // procedural: fictional elevations
    const rng = mulberry32(params.seed)
    const sWarp = new Simplex2(rng)
    const sRidge = new Simplex2(rng)
    const sBase = new Simplex2(rng)
    const sDetail = new Simplex2(rng)

    // A handful of explicit impact craters scattered outside the basin
    const craterRng = mulberry32(params.seed ^ 0x9e3779b9)
    const craters = []
    for (let i = 0; i < 7; i++) {
      const a = craterRng() * Math.PI * 2
      const d = 10.5 + craterRng() * 10
      craters.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        r: 1.6 + craterRng() * 2.8,
        depth: (0.45 + craterRng() * 0.9) * params.amplitude * 0.35,
      })
    }

    const { scale, octaves, lacunarity, gain, amplitude, warp, detail, detailScale } = params

    return (x, z) => {
      // domain warp — breaks up the "obviously noise" look
      const wx = x + warp * fbm(sWarp, x * 0.045 + 7.3, z * 0.045 + 2.1, 3, 2.1, 0.5)
      const wz = z + warp * fbm(sWarp, x * 0.045 - 4.7, z * 0.045 + 9.4, 3, 2.1, 0.5)

      // large-scale ridged mountains + mid-scale rolling base
      const m = ridged(sRidge, wx * scale, wz * scale, octaves, lacunarity, gain)
      const base = fbm(sBase, wx * scale * 2.1, wz * scale * 2.1, octaves, lacunarity, gain)
      let h = amplitude * (m * m * 1.2 + base * 0.28)

      // impact craters: bowl + raised rim
      for (const c of craters) {
        const dx = x - c.x
        const dz = z - c.z
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d < c.r * 1.6) {
          const bowl = 1 - smoothstep(0, c.r, d)
          h -= c.depth * bowl * bowl * bowl * 2.2
          const rim = Math.exp(-Math.pow((d - c.r) / (c.r * 0.28), 2))
          h += c.depth * 0.4 * rim
        }
      }

      // fine surface grain (two extra scales)
      const fine =
        detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)

      // flatten the central excavation basin
      const r = Math.sqrt(x * x + z * z)
      const t = smoothstep(BASIN_RADIUS, BASIN_BLEND, r)
      const floorH = FLOOR_Y + fine * 0.12
      return lerp(floorH, h + fine, t)
    }
  }

  // ══════════ LE CORPS DU RELIEF — Y, NORMALES, COULEURS ═══════════════════
  //
  // Extrait de `rebuild` pour une raison précise : **la fenêtre continue doit
  // rejouer EXACTEMENT ce code à chaque image.** Deux copies de cette boucle
  // divergeraient au premier réglage touché, et la dégradation se lirait comme
  // une panne — le terrain changerait de teinte ou de peigné au moment même où
  // l'on commence à le faire glisser.
  //
  // Écrit EN PLACE quand les attributs existent déjà : à res 384, ré-allouer
  // 9,6 Mo par image mettrait le ramasse-miettes dans la boucle de rendu, et
  // c'est exactement le genre de pic qui tue l'iMac 2015 (le rapport du 27
  // juillet : « ce sont les pics qui la tuent, pas le régime permanent »).
  //
  // @returns {{minH:number,maxH:number}} l'amplitude EFFECTIVEMENT écrite
  //
  // @param {object|null} [depuisFlux] le compte rendu de `_remplirDepuisFlux`
  //   quand les `y` ET les normales VIENNENT D'ÊTRE ÉCRITS par la fenêtre
  //   (Tâche 6 quinquies). ⚠️ **Dans ce cas on ne les réécrit pas** : les
  //   repasser au MNT rendrait la lecture du quadtree parfaitement inutile, et
  //   le défaut serait muet — le socle afficherait le bon relief une image sur
  //   deux, celle où la fenêtre a écrit en dernier.
  _ecrireRelief(geo, params, res, sample, gridSample, depuisFlux = null) {
    const pos = geo.attributes.position
    // ⚠️ **LA NAPPE, PAS LE TAMPON.** `gridTemplate` n'alloue QUE la nappe, donc
    // `(res+1)²` a toujours valu `pos.count` sur le chemin de production — c'est
    // le même nombre, bit pour bit, et rien ne change pour lui. La fenêtre
    // bornée, elle, porte en plus sa JUPE (anneau bas + centre de dalle) dans le
    // même tampon : la parcourir ici lèverait les parois à hauteur de terrain,
    // et `tintField` / `gridNormals`, tous deux indexés par `(res+1)²`, ne les
    // couvrent de toute façon pas. On borne donc explicitement.
    const count = (res + 1) * (res + 1)
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    if (depuisFlux) {
      // ⚠️ **LES `y` SONT DÉJÀ LÀ** — `majHauteurs` vient de les écrire depuis le
      // cache du quadtree. On ne fait que RELEVER l'amplitude, qui décide de la
      // rampe de couleurs et d'`uHeightRange`.
      //
      // ⚠️ **MAIS LE GRAIN, LUI, N'Y EST PAS — ET SANS CES LIGNES IL DISPARAÎT
      // DE L'IMAGE.** `appliquerHauteurs` écrit le relief NU : c'est le chemin du
      // MNT qui ajoutait le FBM de détail, dans `_makeGridSampler`. On le remet
      // ici, LU DANS LE MÊME CHAMP PRÉ-CUIT (`detailField`) et avec la MÊME
      // formule — `landFactor · (detail·g0 + detail·0,35·g1)` — plutôt qu'une
      // seconde loi de grain qui divergerait au premier réglage touché.
      // ⚠️ **`landFactor` SE MESURE EN MÈTRES**, sur `hauteursM`, exactement
      // comme le chemin du MNT le mesure sur `raw` : c'est ce qui éteint le grain
      // sous la ligne d'eau et empêche des îles fantômes.
      const detail = this._detailEffectif(params)
      const hM = depuisFlux.hauteursM
      // ⚠️ pas de grain sur la nappe d'attente (`vide`, Tâche FLU) : elle est plate
      const grain = !depuisFlux.vide && detail > 0 && hM ? detailField(params.seed, params.detailScale, res, TERRAIN_SIZE) : null
      if (grain) {
        for (let i = 0; i < count; i++) {
          const landFactor = smoothstep(0, 90, hM[i])
          arr[i * 3 + 1] += landFactor * (detail * grain[i * 2] + detail * 0.35 * grain[i * 2 + 1])
        }
      }
      // ⚠️ Le grain déplace les sommets : les normales de `appliquerHauteurs` ne
      // décrivent plus la surface. On note qu'il faut les refaire.
      depuisFlux.normalesAFaire = !!grain
      for (let i = 0; i < count; i++) {
        const h = arr[i * 3 + 1]
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    } else {
      for (let i = 0; i < count; i++) {
        const x = arr[i * 3]
        const z = arr[i * 3 + 2]
        const h = gridSample ? gridSample(i, x, z) : sample(x, z)
        arr[i * 3 + 1] = h
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    }
    pos.needsUpdate = true

    // ⚠️ L'AMPLITUDE EST CELLE DE L'EMPRISE, PAS DE LA FENÊTRE.
    //
    // C'est le piège n° 1 de l'étude, et il ne se voit qu'en défilant. `minH` et
    // `maxH` normalisent la teinte par sommet ET `uHeightRange`, donc la rampe
    // de couleurs. Sur une emprise 3×3, s'ils étaient recalculés sur les seuls
    // sommets VISIBLES, la même montagne changerait de couleur selon ce qui
    // l'accompagne à l'écran : on glisse vers un sommet plus haut, il entre dans
    // le cadre, et toute la vallée se repeint d'un coup.
    //
    // « Un terrain qui change de couleur en défilant » est nommément ce que la
    // consigne interdit. On prend donc les extrema du CHAMP ENTIER, convertis en
    // unités monde par la même échelle — ils ne dépendent d'aucun décalage, donc
    // la palette est rigoureusement stable pendant tout le geste.
    if (this.dem?.empriseCote > 1 && params.source === 'real') {
      const scale = (this._span() / this.dem.extentMeters) * lireExageration(params)
      minH = (this.dem.minM - this.dem.meanM) * scale
      maxH = (this.dem.maxM - this.dem.meanM) * scale
    }

    // LA SOMME DES SIX FACES, ÉCRITE EN CLAIR — pas un parcours de triangles.
    // `geo.computeVertexNormals()` pesait **81 % de la fabrication d'une
    // dalle** : mesuré in situ sur la géométrie affichée, 83,8 ms à Chamonix et
    // 120,5 ms à La Réunion, contre **4,6 et 4,4 ms — 18× et 27× moins cher**.
    // Ce n'est PAS une approximation : sur la grille régulière de gridTemplate,
    // la somme des six normales de faces a une forme fermée, et le résultat est
    // identique à three à l'arrondi Float32 près (< 0,05°), bords et coins
    // compris. Voir src/grid-normals.js pour la dérivation — et pourquoi une
    // différence centrée, qui ne voit pas le bruit de Nyquist d'un MNT, s'y
    // trompait de 3,2° en moyenne et de 119° au pire.
    // ⚠️ La grille DOIT être celle de gridTemplate — régulière, rangée en
    // `iy·(res+1) + ix`, pas de côté 56 : c'est l'hypothèse de la formule.
    // ⚠️ TERRAIN_SIZE et pas `_span()` : c'est le pas de la GÉOMÉTRIE, qui fait
    // toujours 56 unités de côté quelle que soit la taille du champ qu'elle lit.
    // ⚠️ **SOUS LE FLUX, `appliquerHauteurs` VIENT DE LES ÉCRIRE — avec CETTE
    // fonction-ci** (`grid-normals.js`, même formule fermée, même pas régulier
    // `COTE_MONDE / n`). Les recalculer rendrait exactement les mêmes nombres
    // pour 1,2 ms de plus par image à n = 384 (mesure de la Tâche 6 ter).
    const nAtt = geo.attributes.normal
    // ⚠️ **`normalesManquantes` — Tâche FLU** : `appliquerHauteurs` a pu SAUTER
    // les normales parce qu'on lui a dit que le grain suivrait (voir
    // `grainSuivra`). Si le grain n'est finalement pas venu (`grain` nul), on les
    // écrit ici quand même : une nappe sans normales est un relief noir.
    const normals = depuisFlux && nAtt && !depuisFlux.normalesAFaire && !depuisFlux.normalesManquantes
      ? nAtt.array
      : gridNormals(arr, res, TERRAIN_SIZE, nAtt?.array)
    if (nAtt) nAtt.needsUpdate = true
    else geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

    const cAtt = geo.attributes.color
    // ══════ LA TEINTE DÉPORTÉE — Tâche FLU, voir `_posterTeinte` ══════════════
    // Sur le chemin du raffinement, la nappe est déjà peinte : la nouvelle
    // teinte part dans le Worker et reviendra écrire `color` en place. Tout ce
    // qui suit — le calcul en ligne — est ce qu'elle fera là-bas, à l'octet.
    if (depuisFlux?.teinteDeportee && cAtt) {
      this._posterTeinte(geo, cAtt, { arr, normals, count, minH, maxH, params, res })
      return { minH, maxH }
    }

    // vertex tint: height-graded value + slope darkening + grain jitter
    // Le grain est PRÉ-CUIT sur la grille (detail-noise.js, `tintField`) : deux
    // octaves de simplex par sommet, 65 ms de gel par reconstruction à res 768,
    // pour un motif qui ne dépend que de (graine, résolution) — il survit donc
    // au changement de zoom, au curseur d'exagération et à la palette.
    // Bit-identique, verrouillé par test/detail-noise.test.js.
    const tint = tintField(params.seed + 101, res, TERRAIN_SIZE)
    // ⚠️ `pos.count` ET NON `count` : un attribut plus court que `position` est
    // une erreur WebGL, pas un dessin partiel. Sur le chemin de production les
    // deux valent `(res+1)²` ; sous la fenêtre bornée, `pos.count` porte la jupe
    // en plus, et ses trois valeurs restent à zéro — elle n'est pas dessinée.
    const colors = cAtt ? cAtt.array : new Float32Array(pos.count * 3)
    const span = Math.max(1e-5, maxH - minH)
    for (let i = 0; i < count; i++) {
      const h = arr[i * 3 + 1]
      const ny = normals[i * 3 + 1]
      // ⚠️ **`Math.max(0, …)` — LE MÊME IDIOME QUE LA LIGNE SUIVANTE, ET POUR LA
      // MÊME RAISON.** `Math.pow(x, 0.85)` rend **NaN** pour `x < 0`, et un NaN
      // dans l'attribut `color` ne lève rien : il peint un sommet noir ou
      // transparent selon le pilote. `hn` est dans [0, 1] tant que `minH`/`maxH`
      // sont les extrema des sommets — mais la branche `empriseCote > 1`
      // quelques lignes plus haut les REMPLACE par `dem.minM/maxM`, QUANTIFIÉS
      // au demi-mètre (`quantizeElevation`, dem.js) et qui ne connaissent pas le
      // grain FBM ajouté aux `y` : un sommet du fond de champ plus un grain
      // négatif passe alors sous `minH`.
      //
      // ⚠️ **CE COMMENTAIRE A ANNONCÉ LE CONTRAIRE PENDANT UN COMMIT, ET LA
      // CORRECTION VAUT D'ÊTRE LUE.** Il disait « le NaN n'a pas su être
      // reproduit » : c'était vrai du banc sur lequel il avait cherché, et faux
      // de la fonction. Ce qui manquait, c'est `landFactor = smoothstep(0, 90,
      // raw)` (`_makeGridSampler`) — sur `demBouchon`, le point le plus bas du
      // champ est à −1 130 m, **le grain y est donc multiplié par ZÉRO**, et le
      // sommet du fond de champ vaut exactement `minH`. Aucun banc dont le
      // minimum est sous la ligne d'eau ne peut faire descendre `hn` sous zéro.
      //
      // ⚠️ **SUR UN CHAMP ALPIN, IL Y DESCEND — MESURÉ LE 2026-08-21.** Aucun
      // point sous 90 m (toute emprise de montagne), donc `landFactor = 1`
      // PARTOUT, grain compris au minimum du champ : **421 à 433 sommets sur
      // 4 225 passent sous `minH`**, `hn` minimal −2,9·10⁻⁴, sur les DEUX
      // chemins et pour cinq graines. Sans cette borne, autant de sommets NaN.
      // Le banc est `test/fenetre-branchee.test.js`, ⑫h — et il MORD : la borne
      // retirée, il rougit sur la couleur, pas sur une lecture de la source.
      //
      // Elle reste l'identité BIT À BIT partout où `hn ≥ 0`.
      const hn = (h - minH) / span
      // ⚠️ **LA LOI EST DANS `monde/eclairage-crop.js`, ET LE CROP L'ÉVALUE EN
      // GLSL** — même patron que `natRampT` et le peigné : une écriture, deux
      // lecteurs. Le `tint[i] * 0.05` reste ici parce qu'il lit un champ de
      // bruit PRÉ-CUIT sur la grille du bloc (`detail-noise.js`), que le crop
      // n'a pas ; c'est ±0,05 sur un terme qui pèse 0,32 de l'albédo.
      let v = natGris(hn, ny)
      v += tint[i] * 0.05
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
    }
    if (cAtt) cAtt.needsUpdate = true
    else geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return { minH, maxH }
  }

  // ══════════ UN PAS DE FENÊTRE — le travail par image du mode continu ══════
  //
  // La géométrie ne bouge pas, ses ALTITUDES défilent. Rien n'est ré-alloué :
  // ni la géométrie, ni les normales, ni les couleurs, ni le gabarit.
  //
  // ⚠️ NE RECONSTRUIT AUCUN CHAMP. Ni analyse de relief, ni masque de mer, ni
  // masque côtier : le budget est de 6 ms par image et `analyzeDem` coûte
  // 164 ns par pixel, soit un carré de 191² pour tout le budget. Aucun recalcul
  // de champ n'est possible pendant le drag, à aucune résolution utile — c'est
  // la contrainte qui décide de toute l'architecture (étude §1.2).
  //
  // @returns {boolean} vrai si quelque chose a été réécrit
  tickFenetre(params) {
    if (!(this.dem?.empriseCote > 1) || params.source !== 'real') return false
    // ⚠️ **LE SEUL POINT OÙ LES DEUX MODES EXPÉRIMENTAUX SE CROISENT** :
    // `?f3=1` fait varier `resMaillage` (384 en mouvement, 768 au repos) pendant
    // que `?globe=continu` tient le maillage avec une fenêtre bâtie à un `n`
    // fixe. Écrire un relief de résolution `res` dans une grille de résolution
    // `n` lirait HORS des bornes (NaN silencieux) ou n'en peindrait qu'un
    // morceau. On refuse le pas plutôt que de rendre du faux ; `rebuild()`
    // refabriquera la fenêtre à la bonne résolution.
    if (this.fenetreBornee
      && this.mesh.geometry?.attributes?.position?.array === this.fenetreBornee.geometrie
      && this.fenetreBornee.n !== this.resMaillage(params)) return false
    const geo = this.mesh.geometry
    if (!geo?.attributes?.position) return false
    const res = this.resMaillage(params)
    // Le sampler est refait à chaque pas — il capture `params` (exagération,
    // détail, mode couleur), qui peuvent avoir changé entre deux images. Il ne
    // capture PAS le décalage : `fenetre` est lu par référence.
    const sample = this._makeSampler(params)
    this.sample = sample
    const { minH, maxH } = this._ecrireRelief(geo, params, res, sample, this._makeGridSampler(params, res))
    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    // ⚠️ **LE DOMAINE VIENT DE BOUGER : LE RÉGLAGE DE RAMPE DOIT SUIVRE DANS LE
    // MÊME TOUR** — Tâche RAMP. `params.heightPivot` est exprimé dans un domaine
    // de RÉFÉRENCE (`src/rampe-fixe.js`) ; sans ce rendez-vous, l'image suivante
    // porterait la transposition de l'AMPLITUDE PRÉCÉDENTE. Mesuré avant de le
    // poser (`.banc/RAMP-FLASH`) : **sept** changements d'amplitude sur une
    // descente de six crans pour seulement **deux** reposes du réglage — cinq
    // images à la mauvaise loi, et c'est le voile de ~300 ms que SUR a filmé.
    this._surAmplitude?.()
    // le masque côtier doit défiler AVEC le relief qu'il classe terre ou mer
    this._pousseFenetre()
    // ⚠️ Pas de `geo.computeBoundingSphere()` : la sphère englobante ne sert
    // qu'au frustum culling, le maillage garde son emprise XZ, et seule sa
    // hauteur bouge. La recalculer coûterait un parcours complet de plus par
    // image pour un test que le maillage passe de toute façon (il est sous la
    // caméra). Si un jour un sommet disparaît en bord d'écran, c'est ici.
    return true
  }

  // Résolution du relief PROCÉDURAL D'AMORÇAGE — voir `_resAmorce` plus bas.
  // 64 donne 4 225 sommets contre 1 048 576 à res 1024 : le maillage existe, il
  // est cohérent, et il ne coûte plus rien.
  static RES_AMORCE = 64

  /**
   * La résolution à écrire pour CE rebuild.
   *
   * ⚠️ LE RELIEF PROCÉDURAL DU CONSTRUCTEUR EST INTÉGRALEMENT JETÉ, ET C'EST
   * MESURÉ. `new Terrain(params)` finit par `rebuild(params)` alors que
   * `this.dem` vaut `null` : on écrit donc un relief de bruit à pleine
   * résolution que `loadRealTerrain()` remplace quelques centaines de
   * millisecondes plus tard, sans que personne ne l'ait jamais vu — il est
   * derrière le voile de chargement.
   * Chronométré autour de l'appel, build de production servi, 3 démarrages :
   * **367,9 / 373,8 / 369,2 ms**. (Une première estimation par tranches de
   * profil disait 290–340 ms ; le chronomètre dit 370.)
   *
   * On ne SUPPRIME pas ce rebuild — plusieurs choses en dépendent tout de
   * suite — on lui donne juste un maillage de brouillon :
   *   · `this.sample` est posé par `_makeSampler(params)`, qui NE DÉPEND PAS de
   *     la résolution. `plinth.rebuild`, `createLabels` et `findPois` ne lisent
   *     que lui : ils voient exactement les mêmes valeurs qu'avant.
   *   · la géométrie reste NON VIDE et bien formée, avec ses bornes ;
   *   · les uniformes (`uHeightRange`, `uSeaY`…) sont posés comme avant.
   *
   * ⚠️ DEUX GARDES, ET IL FAUT LES DEUX — chacune ferme un cas où ce relief
   * de brouillon RESTERAIT à l'écran :
   *
   *   1. `params.source === 'real'`. En mode procédural, ce relief-là EST le
   *      produit : il se construit à pleine résolution, exactement comme avant.
   *
   *   2. `this._amorce`, vrai pour le SEUL rebuild du constructeur. C'est le
   *      seul dont on sait qu'il est immédiatement suivi de `loadRealTerrain()`
   *      (main.js l'appelle sans condition quand la source est réelle). Tous
   *      les autres appels à `rebuild()` sans MNT — et il y en a : le chemin
   *      d'échec de chargement, `regenerateTerrain()` — retombent à pleine
   *      résolution. Sans cette garde, un visiteur dont le réseau lâche voyait
   *      un relief grossier au lieu du relief procédural fin d'avant : ça se
   *      lit comme une carte cassée, pas comme un repli.
   */
  _resAmorce(params) {
    const res = this.resMaillage(params)
    if (this.dem || params.source !== 'real' || !this._amorce) return res
    return Math.min(res, Terrain.RES_AMORCE)
  }

  // ══════════ LA FENÊTRE BORNÉE À LA PLACE DU BLOC — Tâche 6 ter ════════════
  //
  // ⚠️ **CE QUE ÇA SUPPRIME, ET C'EST LE BUT DE TOUT LE PLAN : LE CRAN.**
  // Aujourd'hui chaque changement de zoom passe par `rebuild()`, qui alloue une
  // `BufferGeometry` NEUVE et quatre tampons neufs. Rejoué contre le dépôt avant
  // d'écrire une ligne (`.banc/rejeu-cran.mjs`) : après un cran,
  // `geometry === geometry` faux, `position.array === position.array` faux,
  // `normal.array === normal.array` faux. **C'est ça, la seconde d'attente.**
  // Avec la fenêtre, les quatre tampons sont ceux de `construireFenetre` et ils
  // survivent au cran : `rebuild()` n'écrit plus que des `y`, des normales et
  // des couleurs, EN PLACE.
  //
  // ⚠️ **TERRAIN N'IMPORTE PAS `fenetre-bornee.js`, ET CE N'EST PAS UN DÉTAIL DE
  // STYLE.** `fenetre-bornee.js` importe `TERRAIN_SIZE` d'ici : l'import inverse
  // fermerait le cycle `terrain.js → fenetre-bornee.js → terrain.js` et jetterait
  // un `ReferenceError` **en production seulement** — c'est le piège que la
  // Tâche 6 bis A a déjà payé une fois. La fenêtre est donc POSÉE de l'extérieur
  // (main.js), et `Terrain` ne connaît d'elle que la forme de ses champs.
  //
  // ⚠️ **`rayonCoin = 0`, ET C'EST MESURÉ, PAS PRÉFÉRÉ.** La formule fermée de
  // `gridNormals` suppose un pas régulier ; les coins en superellipse de la
  // fenêtre le cassent, et l'écart de normale y monte à **63,1° au pire à
  // n = 384** (test ⑨d de `fenetre-bornee.test.js`). À coins vifs la nappe EST
  // le gabarit de `gridTemplate`, bit pour bit, et l'écart retombe à **0,022°**.
  // La forme du coin reste donc celle de `plinth.js`, exactement comme
  // aujourd'hui — et `ocean.js` n'a rien à apprendre.
  //
  // ⚠️ **SEULE LA NAPPE EST DESSINÉE.** `setDrawRange` borne le tirage aux
  // `trianglesNappe` de la fenêtre : les parois et la dalle vivent dans le même
  // tampon (c'est ce qui permettra la décision 5, la gravure à l'arrêt sur
  // `contourSocle`) mais `plinth.js` continue de fournir le socle affiché,
  // chanfrein, congé et AO de contact compris. **Le damier n'est pas touché.**
  //
  // @param {object|null} fenetre — une fenêtre de `construireFenetre`. `null`
  //   OUBLIE la fenêtre sans toucher au maillage en place : c'est le prochain
  //   `rebuild()` qui remet le gabarit, parce que lui seul sait à quelle
  //   résolution et avec quel relief.
  adopterFenetre(fenetre) {
    if (!fenetre) { this.fenetreBornee = null; return null }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(fenetre.geometrie, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(fenetre.uv, 2))
    geo.setAttribute('normal', new THREE.BufferAttribute(fenetre.normales, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(fenetre.nbSommets * 3), 3))
    geo.setIndex(new THREE.BufferAttribute(fenetre.indices, 1))
    geo.setDrawRange(0, fenetre.trianglesNappe * 3)
    this.fenetreBornee = fenetre
    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
    return geo
  }

  // La géométrie que `rebuild()` doit remplir : celle qui est déjà là quand la
  // fenêtre bornée tient le maillage à la bonne résolution, une neuve sinon.
  // ⚠️ C'est le SEUL point de décision du branchement, et il est fermé par
  // défaut : sans `params.globeContinu`, il n'existe pas.
  // ══════════ LA FENÊTRE LIT LE QUADTREE — Tâche 6 quinquies ════════════════
  //
  // ⚠️ **CE QUE ÇA SUPPRIME : L'ATTENTE.** La Tâche 6 ter a fait disparaître la
  // RECONSTRUCTION du maillage ; les hauteurs, elles, venaient encore de
  // `this.dem`, donc d'un bloc de MNT téléchargé et décodé **pour le seul
  // socle**. Ici elles viennent du cache du quadtree, qui est déjà là, déjà
  // rempli par la descente, et qui se raffine tout seul.
  //
  // ⚠️ **`remplirHauteurs` REND LE COMPTE DES MANQUANTS, ET C'EST LA DÉCISION 13
  // APPLIQUÉE AU SOCLE** : on dessine à la résolution DISPONIBLE, et on s'affine
  // ensuite. Un socle qui attendrait la couverture complète serait le rideau
  // qu'on retire, déguisé en garde de qualité.
  //
  // ⚠️ **QUATRE GARDES, ET IL LES FAUT TOUTES LES QUATRE :**
  //   1. `params.globeContinu` — sans lui ce chemin n'existe pas (production) ;
  //   2. le crochet posé par `main.js` — sous node et sur les bancs, il n'y en
  //      a pas, et le chemin du MNT reprend la main sans rien savoir ;
  //   3. `f.n === res` — écrire `(res+1)²` hauteurs dans une grille de `n`
  //      autres lirait HORS des bornes en silence (même raison qu'au
  //      `tickFenetre`) ;
  //   4. **le maillage AFFICHÉ doit être celui de la fenêtre** — sinon on
  //      remplirait une fenêtre que personne ne regarde et l'écran garderait
  //      l'ancien relief, sans une erreur.
  //
  // @returns {object|null} `{remplis, manquants, zoom}` si la fenêtre porte
  //   désormais le relief du quadtree, `null` si le MNT doit reprendre la main.
  _remplirDepuisFlux(params, geo, res) {
    if (!params?.globeContinu) return null
    if (typeof this.hauteursDeFlux !== 'function') return null
    if (this._repliProcedural) return null // réseau tombé : le relief procédural, comme avant
    const f = this.fenetreBornee
    if (!f || f.n !== res) return null
    if (geo?.attributes?.position?.array !== f.geometrie) return null
    let r = null
    try {
      r = this.hauteursDeFlux(f, params)
    } catch (e) {
      // ⚠️ **UN FLUX QUI TOMBE NE DOIT PAS EMPORTER LE RELIEF.** Le chemin du
      // MNT est encore là, entier : on y retombe, bruyamment mais sans trou.
      console.warn('[globe continu] hauteurs du quadtree indisponibles :', e?.message || e)
      return null
    }
    // ⚠️ **`remplis === 0` N'EST PAS UNE ERREUR, C'EST UN SOCLE VIDE** — aucune
    // tuile prête ne couvre encore l'emprise. Le MNT écrit alors ce qu'il a…
    //
    // ⛔ **…ET « CE QU'IL A », PENDANT UNE PLONGÉE, C'ÉTAIT LE RELIEF PROCÉDURAL :
    // 2 908 ms DE FIL PRINCIPAL À CPU ×4 POUR UN BLOC QUE PERSONNE NE VOIT** —
    // Tâche FLU. `entrerEnVol` pose `dem = null` puis reconstruit ; les tuiles
    // viennent d'être demandées dans ce même appel et aucune n'est là. La règle
    // d'avant (« plutôt du procédural qu'un pavé plat qui se lirait comme une
    // panne ») coûtait un fbm/ridged par sommet — `noise`, 1 407 ms de temps
    // propre dans le profil de PA — pour des montagnes d'ailleurs, remplacées
    // quelques centaines de millisecondes plus tard. Depuis que le globe garde
    // les hauteurs récentes (`_retenirHauteurs`), ce cas ne se présente qu'à
    // froid ; on pose alors une nappe PLATE à `HAUTEUR_ATTENTE_M`, au-dessus de
    // la ligne d'eau, que le premier raffinement recouvre. Le repli procédural
    // explicite (`rebuild(params, { repliProcedural: true })`, réseau tombé)
    // garde le chemin d'avant.
    // C'est le crochet (`main.js`, `hauteursDeFlux`) qui pose la nappe d'attente
    // et le dit (`vide: true`) : lui seul sait que le MNT est en vol, et lui
    // seul importe `appliquerHauteurs` sans fermer un cycle d'import.
    if (!r || (!(r.remplis > 0) && !r.vide)) return null
    if (r.vide) r.teinteDeportee = true // la teinte part au Worker, la nappe est plate
    // les hauteurs EN MÈTRES voyagent avec le compte rendu : `_ecrireRelief` en
    // a besoin pour éteindre le grain sous la ligne d'eau (`landFactor`).
    r.hauteursM = f.hauteursM
    return r
  }

  // ══════════ LE RAFFINEMENT — Tâche 6 quinquies, Étape 4 ══════════════════
  //
  // ⚠️ **LA DÉCISION 13 APPLIQUÉE AU SOCLE.** Le socle se dessine à la
  // résolution DISPONIBLE, puis s'affine quand les tuiles fines arrivent — et il
  // s'affine **sans reconstruire quoi que ce soit** : ni géométrie, ni tampon,
  // ni champ, ni masque. C'est `rebuild()` moins tout ce qui coûte cher.
  //
  // ⚠️ **CE QU'IL NE REFAIT PAS, ET POURQUOI :** `_buildFields()` (masque de mer,
  // analyse, côte) poste un travail de travailleur sur ~9 Mo de MNT ; le
  // relancer à chaque tuile qui atterrit remettrait exactement le gel qu'on
  // retire. Les champs sont cuits sur l'empreinte du MNT, qui ne bouge pas
  // pendant un raffinement : ils restent justes.
  //
  // @returns {object|null} le compte rendu du flux, `null` si rien n'a été lu
  rafraichirFenetre(params) {
    const geo = this.mesh.geometry
    const res = this.resMaillage(params)
    const depuisFlux = this._remplirDepuisFlux(params, geo, res)
    if (!depuisFlux) return null
    // la teinte part dans le Worker sur ce chemin-ci — et seulement celui-ci
    // (Tâche FLU, `_posterTeinte`)
    depuisFlux.teinteDeportee = true
    const { minH, maxH } = this._ecrireRelief(geo, params, res, null, null, depuisFlux)
    this.sample = this._makeFenetreSampler(this.fenetreBornee)
    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    // ⚠️ **LE DOMAINE VIENT DE BOUGER : LE RÉGLAGE DE RAMPE DOIT SUIVRE DANS LE
    // MÊME TOUR** — Tâche RAMP. `params.heightPivot` est exprimé dans un domaine
    // de RÉFÉRENCE (`src/rampe-fixe.js`) ; sans ce rendez-vous, l'image suivante
    // porterait la transposition de l'AMPLITUDE PRÉCÉDENTE. Mesuré avant de le
    // poser (`.banc/RAMP-FLASH`) : **sept** changements d'amplitude sur une
    // descente de six crans pour seulement **deux** reposes du réglage — cinq
    // images à la mauvaise loi, et c'est le voile de ~300 ms que SUR a filmé.
    this._surAmplitude?.()
    return depuisFlux
  }

  // ══════════ L'ÉCHANTILLONNEUR DE LA FENÊTRE — Tâche 6 quinquies ═══════════
  //
  // ⚠️ **IL LIT LA GÉOMÉTRIE, PAS LE MNT, ET C'EST TOUT L'INTÉRÊT.** `this.sample`
  // est ce que lisent le SOCLE (`plinth.js:computeSlab`, qui en tire ses parois),
  // les bateaux, le drapage GPX, les étiquettes et le rayon de mise au point.
  // Laissé sur `_makeDemSampler` pendant que la nappe porte le relief du
  // quadtree, il décrirait une AUTRE surface : les parois du socle ne
  // rejoindraient plus la nappe, et les objets posés au sol flotteraient.
  //
  // ⚠️ **ET IL LIT LA GÉOMÉTRIE PLUTÔT QUE `hauteursM`** : le grain FBM est
  // ajouté APRÈS `majHauteurs`, dans `_ecrireRelief`. Lire les mètres rendrait
  // une surface sans grain — c'est-à-dire, encore une fois, une seconde source
  // de vérité. Ici il n'y en a qu'une, et c'est celle qui est dessinée.
  //
  // ⚠️ Il se pose donc APRÈS `_ecrireRelief`, jamais avant.
  _makeFenetreSampler(fenetre) {
    const arr = fenetre.geometrie
    const n = fenetre.n
    const parCote = n + 1
    const demi = TERRAIN_SIZE / 2
    const pas = TERRAIN_SIZE / n
    const ech = fenetre.echelleVerticale
    const moy = fenetre.moyenneM
    this._h2ft = (h) => Math.round((h / Math.max(1e-12, ech) + moy) * 3.28084)
    return (x, z) => {
      let u = (x + demi) / pas
      let v = (z + demi) / pas
      if (!(u > 0)) u = 0
      else if (u > n) u = n
      if (!(v > 0)) v = 0
      else if (v > n) v = n
      const i0 = u < n ? u | 0 : n - 1
      const j0 = v < n ? v | 0 : n - 1
      const fx = u - i0
      const fz = v - j0
      const a = j0 * parCote + i0
      const b = a + parCote
      const y00 = arr[a * 3 + 1]
      const y10 = arr[(a + 1) * 3 + 1]
      const y01 = arr[b * 3 + 1]
      const y11 = arr[(b + 1) * 3 + 1]
      return (y00 * (1 - fx) + y10 * fx) * (1 - fz) + (y01 * (1 - fx) + y11 * fx) * fz
    }
  }

  _geometrieRebuild(params, res) {
    const f = this.fenetreBornee
    if (!params?.globeContinu) return null
    if (f && f.n === res && this.mesh.geometry?.attributes?.position?.array === f.geometrie) {
      // ⚠️ **LA FENÊTRE EST GARDÉE, MAIS PAS SON CADRAGE** — voir
      // `this.recadreFenetre`. C'est la seule ligne qui fait suivre l'emprise, la
      // largeur au sol et l'exagération au cran qu'on vient de franchir, et elle
      // ne touche **pas un seul sommet** (`recadrerFenetre`, fenetre-bornee.js).
      // Sans elle, un socle sans MNT lirait les tuiles du palier PRÉCÉDENT.
      this.recadreFenetre?.(f, params)
      return this.mesh.geometry
    }
    if (typeof this.fabriqueFenetre === 'function') {
      const neuve = this.fabriqueFenetre(res)
      if (neuve) return this.adopterFenetre(neuve)
    }
    return null
  }

  rebuild(params, { repliProcedural = false } = {}) {
    // voir `_remplirDepuisFlux` : le repli procédural ne se demande plus, il se DIT
    this._repliProcedural = repliProcedural
    const res = this._resAmorce(params)
    // GABARIT MÉMORISÉ au lieu de `new THREE.PlaneGeometry` : celui-ci mettait
    // 194 ms et jetait 262 Mo de tas JS à res 1024 (106 ms et 104 Mo à res 768)
    // pour fabriquer un plan PLAT que les lignes suivantes réécrivent
    // intégralement (Y, normales, couleurs). Sur une reconstruction complète du
    // bloc, mesurée en navigateur au Mont-Blanc à res 1024 : 853 → 770 ms.
    // Bit-identique, verrouillé par test/grid-template.test.js.
    // ⚠️ `position` est COPIÉ (on va y écrire les Y, et le gabarit est partagé
    // entre blocs) ; `uv` et `index` sont branchés TELS QUELS parce que personne
    // ne les écrit — voir l'avertissement en tête de grid-template.js.
    //
    // ⚠️ **LA FENÊTRE BORNÉE COURT-CIRCUITE TOUT CE BLOC — voir
    // `adopterFenetre`.** Quand elle tient le maillage, `geo` est CELUI QUI EST
    // DÉJÀ LÀ : aucun gabarit, aucune allocation, aucun tampon neuf. C'est le
    // cran qui disparaît. Sans `params.globeContinu`, `_geometrieRebuild` rend
    // `null` et la production ne voit pas la différence.
    let geo = this._geometrieRebuild(params, res)
    if (!geo) {
      const tpl = gridTemplate(res, TERRAIN_SIZE)
      geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tpl.position), 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(tpl.uv, 2))
      geo.setIndex(new THREE.BufferAttribute(tpl.index, 1))
    }

    const sample = this._makeSampler(params)
    this.sample = sample
    // le grain FBM est pré-cuit sur la grille (detail-noise.js) — mesuré en
    // navigateur au Mont-Blanc à res 1024 : 770 → 600 ms de reconstruction, et
    // il survit à un changement de zoom,
    // à un coup de curseur d'exagération et à une bascule de palette. Repli sur
    // `sample` quand il n'y a rien à mémoriser (relief procédural).
    const gridSample = this._makeGridSampler(params, res)

    // ⚠️ **LA LECTURE DU QUADTREE PASSE AVANT L'ÉCRITURE DU RELIEF**, et l'ordre
    // est le sujet : `majHauteurs` écrit les `y` et les normales, `_ecrireRelief`
    // n'a plus qu'à relever l'amplitude et peindre. L'inverse repasserait le MNT
    // par-dessus le quadtree — voir `_remplirDepuisFlux`.
    const depuisFlux = this._remplirDepuisFlux(params, geo, res)

    const { minH, maxH } = this._ecrireRelief(geo, params, res, sample, gridSample, depuisFlux)

    // ⚠️ **APRÈS `_ecrireRelief`, JAMAIS AVANT** — le grain vient d'y être ajouté
    // aux `y`, et c'est cette surface-là que le socle et les objets posés au sol
    // doivent lire. Voir `_makeFenetreSampler`.
    if (depuisFlux) this.sample = this._makeFenetreSampler(this.fenetreBornee)

    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    // ⚠️ **LE DOMAINE VIENT DE BOUGER : LE RÉGLAGE DE RAMPE DOIT SUIVRE DANS LE
    // MÊME TOUR** — Tâche RAMP. `params.heightPivot` est exprimé dans un domaine
    // de RÉFÉRENCE (`src/rampe-fixe.js`) ; sans ce rendez-vous, l'image suivante
    // porterait la transposition de l'AMPLITUDE PRÉCÉDENTE. Mesuré avant de le
    // poser (`.banc/RAMP-FLASH`) : **sept** changements d'amplitude sur une
    // descente de six crans pour seulement **deux** reposes du réglage — cinq
    // images à la mauvaise loi, et c'est le voile de ~300 ms que SUR a filmé.
    this._surAmplitude?.()
    this._pousseFenetre()

    // georeferenced sea level (elevation 0) — ALWAYS active in real mode so every
    // template gets a clear shoreline and consistent bathymetry, even where the
    // patch has no sub-sea data (then uSeaY simply sits below the terrain).
    // ══════════ LA LIGNE D'EAU SOUS LE FLUX — Tâche 6 quinquies ═════════════
    //
    // ⚠️ **LA MOYENNE N'EST PAS LA MÊME DES DEUX CÔTÉS, ET C'EST CE QUI DÉPLACE
    // LE TRAIT DE CÔTE.** `appliquerHauteurs` centre les `y` sur
    // `fenetre.moyenneM` — la moyenne des hauteurs LUES DANS LE QUADTREE — quand
    // le chemin du MNT les centre sur `dem.meanM`. Garder `dem.meanM` ici
    // poserait la mer à l'altitude d'un autre relevé : la côte remonterait ou
    // descendrait de l'écart des deux moyennes, en silence. On lit donc la
    // fenêtre, qui est la surface réellement dessinée.
    if (depuisFlux && this.fenetreBornee) {
      const f = this.fenetreBornee
      const demScale = f.echelleVerticale
      const seaEps = Math.max(0.6 * demScale, 0.004)
      this.mapUniforms.uSeaY.value = (0 - f.moyenneM) * demScale + seaEps
      this.mapUniforms.uSeaRange.value = Math.max((0 - f.minM) * demScale, 1e-3)
      // les champs (masque de mer, analyse, côte) restent ceux du MNT : ils sont
      // cuits sur SON empreinte, et `hauteursDeFlux` remplit exactement la même
      // (voir `empriseDuSocle` dans main.js). Sans MNT il n'y a rien à cuire.
      // ══════════ ET SANS MNT, ON LES ÉTEINT — Tâche 6 septies ══════════════
      //
      // ⚠️ **LES LAISSER ALLUMÉS SERAIT PIRE QUE DE NE PAS LES AVOIR.** Le
      // masque de mer et le champ d'analyse sont des TEXTURES lues en UV de
      // bloc : sur le palier suivant, la même UV couvre deux fois moins de sol,
      // donc le trait de côte se retrouve à mi-chemin de son vrai lieu. Le socle
      // sort donc sans masque de mer ni analyse pendant que le MNT est en vol —
      // c'est la décision 13, et c'est ce qu'il faut regarder à l'écran.
      if (this.dem) this._buildFields()
      else {
        this.mapUniforms.uSeaMaskOn.value = 0
        this.mapUniforms.uAnalysisOn.value = 0
        this._fieldKey = null
        this.fieldsReady = Promise.resolve(null)
      }
    } else if (params.source === 'real' && this.dem) {
      const demScale = (this._span() / this.dem.extentMeters) * lireExageration(params)
      // fine-zoom tiles carry NO bathymetry: their sea is a flat plain at
      // exactly 0 m, which lands exactly ON uSeaY and paints as LAND (the
      // "black grainy sea" the dark templates expose). Lift the waterline a
      // touch over half a metre so a bathymetry-less sea still reads ocean;
      // real coastlines shift by an invisible ~0.6 m.
      const seaEps = Math.max(0.6 * demScale, 0.004)
      this.mapUniforms.uSeaY.value = (0 - this.dem.meanM) * demScale + seaEps
      this.mapUniforms.uSeaRange.value = Math.max((0 - this.dem.minM) * demScale, 1e-3)
      this._buildFields()
    } else {
      this.mapUniforms.uSeaY.value = -9999
      this.mapUniforms.uSeaMaskOn.value = 0
      this.mapUniforms.uAnalysisOn.value = 0
      this._fieldKey = null
      this.fieldsReady = Promise.resolve(null)
    }

    // ⚠️ **NE JAMAIS `dispose()` LA GÉOMÉTRIE QU'ON GARDE.** Sur le chemin de la
    // fenêtre bornée, `geo` EST `this.mesh.geometry` : la séquence
    // « dispose puis réassigne » libérerait les tampons GPU vivants et rendrait
    // un bloc noir à la première image suivante — un défaut qui ne se voit qu'à
    // l'écran, jamais sous node.
    if (geo !== this.mesh.geometry) {
      this.mesh.geometry.dispose()
      this.mesh.geometry = geo
    }
  }

  // ══════════ LES DEUX PLAFONDS DE CHAMPS, EN UN SEUL ENDROIT ══════════════
  //
  // Trois régimes, et un seul point de décision pour chacun :
  //   • emprise 3×3  → l'ATLAS (dem-emprise.js), cuit une fois sur 168 unités ;
  //   • dalle voisine du damier → le plafond que block-grid.js lui impose ;
  //   • bloc central → aucun plafond, c'est le héros.
  //
  // ⚠️ Ces deux fonctions rendent un PLAFOND, `_seaSize` rend la TAILLE OBTENUE.
  // La distinction n'est pas cosmétique : `resampleField` ne grossit jamais, donc
  // un atlas de 2 304 demandé à un MNT de 2 304 rend 2 304, et à un MNT de 1 536
  // (emprise en tuiles 256 px, zooms grossiers) rend 1 536. La côte mondiale est
  // indexée CELLULE POUR CELLULE par buildSeaMask : la cuire à la taille
  // DEMANDÉE pendant que le champ sort à la taille SOURCE rendrait des polders
  // décalés — un défaut muet, pas une erreur.
  _analysisMax(dem) {
    return dem?.empriseCote > 1 ? ATLAS_ANALYSE : this.analysisMax | 0
  }

  _seaMax(dem) {
    return dem?.empriseCote > 1 ? ATLAS_MER : this.seaMax | 0
  }

  // Le côté du masque de mer de CE bloc : le MNT au centre, le plafond sur une
  // dalle voisine (voir seaMax). Une seule source de vérité, parce que deux
  // consommateurs doivent tomber d'accord au pixel près — la côte ci-dessous
  // et le travail posté au Worker.
  _seaSize(dem) {
    const max = this._seaMax(dem)
    return max > 0 && dem.size > max ? max : dem.size
  }

  // La CÔTE MONDIALE depuis le masque côtier (si reçu) : rééchantillonnée à la
  // grille du MASQUE DE MER, en trois états, et mise en cache — recalculée
  // seulement si l'image, cette taille ou le rayon d'incertitude changent.
  // ⚠️ L'IDENTITÉ de ce tableau sert de clé de péremption (voir _buildFields) :
  // le remplacer par un tableau neuf au même contenu périmerait pour rien un
  // calcul encore juste.
  // ⚠️ ET LA TAILLE EST CELLE DU MASQUE DE MER, PAS CELLE DU MNT. buildSeaMask
  // l'indexe cellule pour cellule : la caler sur le MNT pendant que le masque
  // est plafonné rendrait des polders décalés — un défaut MUET, pas une erreur.
  // (le rééchantillonnage part du masque côtier 2048², il ne perd donc rien à
  // cuire directement à la bonne taille.)
  // ⚠️ LE RAYON D'INCERTITUDE SE MESURE SUR LA GRILLE DU MASQUE, pas sur celle
  // du MNT : `_seaSize` peut plafonner, et une cellule de masque vaut alors
  // plusieurs cellules de MNT. Le calculer sur le MNT donnerait une bande neuf
  // fois trop large sur l'atlas 3×3 — muet, là encore.
  _coteMondialeFor(dem) {
    if (!this._coastImage) return null
    const taille = this._seaSize(dem)
    const metresParCellule = (dem.metersPerPixel * dem.size) / taille
    const rayon = rayonIncertitude(metresParCellule)
    const c = this._coastLand
    if (!c || c.img !== this._coastImage || c.size !== taille || c.rayon !== rayon)
      this._coastLand = {
        img: this._coastImage,
        size: taille,
        rayon,
        cote: coteMondialeDepuisChamp(this._coastImage, taille, { rayonIncertain: rayon }),
      }
    return this._coastLand.cote
  }

  // ------------------------------------------------------- CHAMPS DÉPORTÉS
  //
  // MASQUE DE MER (flood fill + flou, sea-mask.js) et ANALYSE DU RELIEF (~10
  // flous, terrain-analysis.js), calculés HORS DU FIL PRINCIPAL.
  //
  // Mesuré sur MNT réel 1536² : 387 ms d'analyse + 81 ms de masque. Ces ~470 ms
  // ne raccourcissent pas en migrant dans un Worker — elles cessent de FIGER
  // l'onglet. Ce n'est pas la durée totale qui gêne l'utilisateur, c'est le gel.
  //
  // ⚠️ CE QUE MONTRE LE RELIEF PENDANT L'ATTENTE : l'ÉTAT ANTÉRIEUR, intact.
  // Rien n'est effacé au lancement — ni la texture, ni son uniforme `…On`.
  // Effacer puis reposer ferait clignoter le peigné des crêtes et le trait de
  // côte, et la carte doit rester calme. Au tout premier chargement il n'y a
  // pas d'antérieur : ce sont les placeholders NEUTRES par construction qui
  // tiennent (uAnalysisOn = 0, uSeaMaskOn = 0), c'est-à-dire exactement ce que
  // montrait déjà l'application avant que le calcul ne se termine.
  // Et le voile de chargement de main.js attend `fieldsReady` : sur le chemin
  // visible (zoom, exagération, template) l'utilisateur ne voit jamais l'état
  // intermédiaire. Il voit le voile, puis la carte finie — comme avant.
  //
  // ⚠️ PÉREMPTION : la clé ne porte QUE le MNT, la côte et les deux plafonds
  // — les seules entrées du calcul. Une invalidation plus large (un compteur
  // bumpé à chaque rebuild) jetterait des résultats encore justes à chaque coup
  // de curseur d'exagération. Voir jobStillValid.
  _buildFields({ withAnalysis = true } = {}) {
    const dem = this.dem
    // ══════════ L'ATLAS DE CHAMPS — JALON 2 ═════════════════════════════════
    //
    // Le jalon 1 sautait ce calcul ENTIÈREMENT : sur l'emprise 3×3 (4 608² au
    // lieu de 1 536²) il y a NEUF FOIS plus de pixels, et `analyzeDem` coûte
    // 164 ns le pixel. Le terrain y était peint à la rampe d'altitude nue.
    //
    // Le jalon 2 le rallume, et il ne change PAS de machinerie pour ça — il
    // change deux plafonds et deux options. C'est tout le sens de l'atlas : les
    // champs sont cuits UNE FOIS sur les 168 unités au lieu d'être recuits à
    // chaque bloc traversé, et le shader les lit avec le décalage de fenêtre.
    //
    //   • les plafonds : ATLAS_ANALYSE / ATLAS_MER (voir _analysisMax/_seaMax)
    //   • `merMinPool` : le sous-échantillonnage du masque de mer passe de la
    //     moyenne au MINIMUM, sans quoi un détroit d'un pixel est sectionné et
    //     une baie réelle se peint en terre (terrain-analysis.js, minPoolField)
    //   • `minBasinFrac` : le seuil de grand bassin est une FRACTION du champ,
    //     donc neuf fois plus exigeant sur une emprise — converti à surface
    //     absolue constante (dem-emprise.js, fracBassinEmprise)
    //
    // ⚠️ CE QUE ÇA COÛTE, MESURÉ sur le MNT RÉEL de l'emprise (4 608² Int16
    // dumpé du navigateur — un relief synthétique mentirait sur le temps, c'est
    // la leçon des normales de cette branche). `.banc/f3-worker-cout.mjs` :
    //
    //   resampleField 4608→2304 (moyenne)      64 ms   tampons +20,3 Mo
    //   minPoolField  4608→2304 (minimum)      93 ms   tampons +20,3 Mo
    //   buildSeaMask + blurMask 2304²         113 ms   tampons +75,9 Mo
    //   analyzeDem    4608→2304               908 ms   tampons +172,1 Mo
    //   computeTerrainJob COMPLET           1 090 ms
    //
    // L'étude annonçait 1 048 ms pour cet atlas : elle tombe à 4 % près. Et son
    // pic transitoire de « ~80 Mo » pour le masque de mer est confirmé (75,9) —
    // mais elle avait raté le vrai poste, l'analyse de relief et ses 172 Mo.
    // Les deux sont dans le WORKER, transitoires, et hors du fil principal.
    //
    // ⚠️ ET NON, L'ATLAS N'EST PAS « DEUX FOIS MOINS CHER » QUE NEUF DALLES.
    // L'étude comparait un atlas 2 304² (5,3 M pixels) à neuf dalles 1 024²
    // (9,4 M pixels) : c'était moins de pixels, pas un gain d'algorithme. À
    // densité ÉGALE, mesuré ici, neuf dalles 1536→768 coûtent 1 130 ms contre
    // 1 090 — la parité, à 4 %. Le vrai gain est ailleurs, et il est double :
    // la cuisson se fait UNE FOIS pour toute la traversée du 3×3 au lieu de se
    // répéter à chaque bloc, et il n'y a qu'un champ, donc qu'un `robustScale`
    // (l'étude §4.4 : sans ça le peigné des crêtes changerait d'intensité à
    // chaque franchissement de jointure).
    //
    // Sur le fil principal, aucun gel : la plus longue tâche pendant tout le
    // chargement en mode continu vaut 220 ms à La Réunion et 180 à Chamonix
    // (PerformanceObserver 'longtask', `.banc/f3-cuisson.mjs`) — c'est le
    // décodage des MNT et la géométrie, pas les champs. Et le voile de
    // chargement attend `fieldsReady`, comme pour un bloc ordinaire : il se
    // lève sur une carte finie, jamais sur un état intermédiaire.
    const emprise = dem?.empriseCote > 1 ? dem.empriseCote : 0
    // ⚠️ Un terrain abandonné ne recuit PLUS RIEN, jamais. Sans ce garde-fou,
    // le masque côtier d'une dalle détruite — il arrive du réseau, bien après —
    // rappelait _buildFields et RESSUSCITAIT la dalle : une DataTexture posée
    // sur un mesh déjà disposé, que plus personne ne disposerait.
    if (this._fieldsOff) return (this.fieldsReady = Promise.resolve(null))
    if (!dem?.data) {
      this.mapUniforms.uSeaMaskOn.value = 0
      this.mapUniforms.uAnalysisOn.value = 0
      this._fieldKey = null
      this._fieldsEnVol = null
      return (this.fieldsReady = Promise.resolve(null))
    }
    const cote = this._coteMondialeFor(dem)
    // L'analyse ne dépend QUE des altitudes brutes : ni de l'exagération, ni de
    // la résolution du maillage, ni de la palette. On la mémorise donc sur
    // l'identité du DEM — sans ça, allumer le mode puis régénérer la recalcule
    // deux fois de suite, et c'est la passe la plus chère du chargement.
    const naturel = this.mapUniforms.uColorMode.value === 1
    if (!naturel) this.mapUniforms.uAnalysisOn.value = 0
    const demandee = withAnalysis && naturel && !(this._analysisFor === dem && this.mapUniforms.uAnalysisOn.value)
    // analysisMax / seaMax : une dalle VOISINE n'a pas le maillage qui
    // justifierait des champs à la taille du MNT (voir block-grid.js), et une
    // EMPRISE 3×3 prend la taille d'atlas. Le shader lit les deux en UV
    // d'atlas, leur taille lui est donc indifférente.
    const maxSize = this._analysisMax(dem)
    const seaMax = this._seaMax(dem)
    // ANALYSE DÉJÀ CUITE POUR CE MNT ? On la repose SANS RIEN DEMANDER au
    // travailleur. Mesuré à La Réunion sur un retour de zoom : 464 ms de
    // travailleur, et c'est le voile de chargement qui les attendait. L'analyse
    // ne dépend que des altitudes et du plafond `maxSize` — dem-memo.js range
    // le résultat SOUS le MNT qui l'a produit, il ne peut donc pas se poser sur
    // d'autres altitudes que les siennes.
    if (demandee) {
      const cuite = analyseMemoLire(dem, maxSize)
      if (cuite) this._applyAnalysis(cuite.rgba, cuite.size, dem)
    }
    // `_applyAnalysis` vient de poser `_analysisFor` et `uAnalysisOn` : la même
    // question qu'au-dessus répond maintenant « non, plus rien à cuire ».
    const analyse = demandee && !(this._analysisFor === dem && this.mapUniforms.uAnalysisOn.value)
    // ══════════ LE MASQUE DE MER NE SE CUIT QUE S'IL SERA LU ════════════════
    //
    // Sa lecture UNIQUE, dans le fragment, est la branche ELSE de
    // `COTE_AUTORITE_GLSL` : dès que le trait de côte fait autorité, le champ
    // était construit et JAMAIS ÉCHANTILLONNÉ. Or il fait autorité PARTOUT
    // entre z4 et z15 (COAST_ZOOM_MIN/MAX, coast-mask.js) — c'est-à-dire sur
    // presque tout le chemin de chargement. Mesuré sur l'atlas 3×3 : 113 ms de
    // travailleur et jusqu'à 5,3 Mo par bloc, à chaque cuisson, pour rien.
    //
    // ⚠️ ET C'EST BIEN LE MÊME PRÉDICAT QUE LE NUANCEUR, pas une copie
    // approchante : `coteFaitAutorite` et le GLSL sortent de la même constante
    // (voir son en-tête, plus haut dans ce fichier). Deux écritures jumelles
    // finiraient par diverger, et un bloc sans mer ne lève AUCUNE erreur.
    //
    // ⚠️ IL N'EST PAS MORT PARTOUT. Aux zooms fins (z16–z17, Suisse et France)
    // le masque côtier n'est pas servi, `uCoastMaskOn` vaut 0, et le masque de
    // mer redevient LA SEULE SOURCE de la mer. Il s'y cuit exactement comme
    // avant. C'est aussi vrai pendant l'ATTENTE du masque côtier, et sur un
    // fetch en échec : tant que l'autorité n'est pas là, le champ est lu.
    const mer = !coteFaitAutorite(this.mapUniforms)
    // Rien à cuire → NE RIEN POSTER. C'est le cas nominal du trait de côte qui
    // arrive (`setCoastMask` relance les champs) alors que l'analyse est déjà
    // en place : le travail posté recopiait le MNT au travailleur — 9 Mo pour
    // un bloc — pour en rapporter un champ mort.
    // ⚠️ On ne touche NI à `_fieldsEnVol` NI à `_fieldKey` : un travail encore
    // en vol reste le sien, et le périmer ici jetterait un résultat juste.
    // ⚠️ Et `fieldsReady` GARDE la promesse en cours quand il y en a une — la
    // remplacer par une promesse déjà résolue lèverait le voile de chargement
    // sur un relief inachevé.
    if (!analyse && !mer) return (this.fieldsReady ??= Promise.resolve(null))
    // ⚠️ LE MÊME TRAVAIL EST DEMANDÉ DEUX FOIS À LA NAISSANCE D'UNE DALLE :
    // rebuild() lance les champs, puis setColorMode les relance parce que
    // uAnalysisOn vaut encore 0 — l'uniforme ne monte qu'à l'ARRIVÉE. On rend
    // alors la promesse EN COURS au lieu de reposter (voir jobCouvertParEnVol,
    // qui garde ouverte la porte du recalcul légitime).
    const demande = { dem, cote, maxSize, seaMax, analyse, mer }
    if (jobCouvertParEnVol(this._fieldsEnVol, demande)) return this.fieldsReady
    this._fieldsEnVol = demande
    this._fieldKey = { dem, cote, maxSize, seaMax }
    // ⚠️ DEUX CLÉS, PAS UNE — et c'est un bug vu à l'écran, pas une précaution.
    // Le masque de mer dépend de la côte mondiale ; l'analyse de relief n'en dépend
    // PAS (elle ne lit que les altitudes). Sur une dalle voisine, le trait de
    // côte arrive ~300 ms après le lancement, donc AVANT la fin de l'analyse :
    // avec une clé commune, l'arrivée du trait de côte périmait une analyse
    // parfaitement juste et la dalle restait sans peigné à côté d'un centre
    // peigné. L'invalidation trop large coûte aussi cher que la trop laxiste.
    const cleMer = { dem, cote, seaMax }
    const cleAnalyse = { dem, maxSize }
    return (this.fieldsReady = scheduleTerrainJob({
      key: { dem }, // le MNT périme TOUT ; le reste se juge champ par champ
      job: {
        data: dem.data,
        size: dem.size,
        metersPerPixel: dem.metersPerPixel,
        maxSize,
        seaMax,
        coteMondiale: cote,
        withAnalysis: analyse,
        avecMer: mer,
        // les deux options de l'atlas — voir l'en-tête. Hors mode continu elles
        // valent `false` et `undefined`, et computeTerrainJob est alors
        // bit-à-bit ce qu'il était (test/terrain-jobs.test.js le verrouille).
        merMinPool: emprise > 0,
        minBasinFrac: emprise > 0 ? fracBassinEmprise(BASSIN_FRAC_DEFAUT, emprise) : undefined,
      },
      current: () => this._fieldKey,
      apply: (r, actuel) => {
        // `r.sea` est nul quand le champ n'a pas été demandé (voir `mer`) —
        // le même garde-fou que l'analyse juste en dessous.
        if (r.sea && jobStillValid(cleMer, actuel)) this._applySeaMask(r.sea, r.seaSize)
        if (r.analysis && jobStillValid(cleAnalyse, actuel)) {
          this._applyAnalysis(r.analysis, r.analysisSize, dem)
          // ⚠️ mémorisé APRÈS le verdict de péremption, et seulement là : une
          // analyse périmée en vol n'a rien à faire dans la mémoire. Sans effet
          // si le MNT n'est pas lui-même mémorisé (dalles du damier).
          analyseMemoEcrire(dem, maxSize, r.analysis, r.analysisSize)
        }
      },
    }).then((r) => {
      // ⚠️ LE VOL SE TERMINE ICI, ET SEULEMENT S'IL EST TOUJOURS LE NÔTRE : un
      // travail plus récent a pu prendre la place pendant celui-ci (arrivée du
      // trait de côte, changement de zoom). L'effacer sans regarder rouvrirait
      // le doublon sur le travail suivant.
      if (this._fieldsEnVol === demande) this._fieldsEnVol = null
      return r
    }))
  }

  /**
   * Abandonne les champs en vol — appelé à la destruction d'une dalle du damier.
   *
   * ⚠️ DÉFINITIF, et c'est voulu : `jobStillValid` refuse une clé nulle, donc
   * un résultat qui arrive après le dispose ne crée plus de DataTexture sur un
   * terrain mort (fuite VRAM que personne ne disposerait). `_fieldsOff` ferme
   * en plus la porte de derrière — le masque côtier revient du réseau bien
   * après et rappelait `_buildFields`, ce qui relançait tout.
   */
  cancelFields() {
    this._fieldKey = null
    this._fieldsOff = true
    // ⚠️ et on lâche la trace du travail en vol : elle RETIENT le MNT et la
    // côte mondiale de la dalle qu'on détruit (9 Mo pour le premier). Le damier
    // churn à chaque zoom — ce serait une fuite de tas par dalle détruite.
    this._fieldsEnVol = null
  }

  // Le masque de mer, posé en texture (sea-mask.js). Échantillonné en XZ monde,
  // même emprise que le masque de zone.
  _applySeaMask(mask, size) {
    // one red channel; flipY off so texel row r ↔ world +z (matches the sampler)
    const tex = new THREE.DataTexture(mask, size, size, THREE.RedFormat)
    tex.flipY = false
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    this.mapUniforms.uSeaMask.value?.dispose?.()
    this.mapUniforms.uSeaMask.value = tex
    this.mapUniforms.uSeaMaskOn.value = 1
  }

  // ANALYSE DU RELIEF (src/terrain-analysis.js) cuite dans une RGBA à la
  // résolution du DEM — même mécanique que le masque de mer, même UV monde côté
  // shader. Ne tourne qu'en mode Naturel : c'est une passe de ~10 flous sur
  // 590 k pixels, inutile de la payer quand personne ne la lit.
  _applyAnalysis(rgba, size, dem) {
    // ⚠️ La mémoïsation n'est marquée qu'ICI, à la POSE. La marquer au
    // lancement ferait passer pour cuite une analyse qu'un zoom aurait périmée
    // en vol, et le relief resterait sans peigné jusqu'au prochain changement
    // de MNT.
    this._analysisFor = dem
    const tex = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat)
    tex.flipY = false // texel row r ↔ world +z, comme le sea mask
    // ⚠️ NoColorSpace : ce sont des DONNÉES (courbure, humidité, exposition),
    // pas des couleurs. Les faire passer par la conversion sRGB tordrait toutes
    // les valeurs autour de 0,5 et le « neutre » cesserait d'être neutre.
    tex.colorSpace = THREE.NoColorSpace
    tex.magFilter = THREE.LinearFilter
    // ⚠️ Mipmaps OBLIGATOIRES : au dézoom un pixel écran couvre des dizaines de
    // texels, et un échantillonnage ponctuel d'un champ à haute fréquence
    // SCINTILLE dès que la caméra bouge. C'est le même piège que sur n'importe
    // quelle carte de détail — sauf qu'ici le champ est fait de bandes fines.
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 4 // les vues rasantes sont la règle sur ce produit
    tex.needsUpdate = true
    const prev = this.mapUniforms.uAnalysis.value
    if (prev && prev !== this._analysisPlaceholder) prev.dispose()
    this.mapUniforms.uAnalysis.value = tex
    this.mapUniforms.uAnalysisOn.value = 1
  }

  // Bascule Classique ↔ Naturel. Renvoie true si le mode a CHANGÉ : l'appelant
  // doit alors régénérer le terrain, parce que le mode borne aussi le bruit de
  // détail (géométrie, voir _makeDemSampler).
  setColorMode(mode, params = {}) {
    const on = mode === 'natural' ? 1 : 0
    const changed = this.mapUniforms.uColorMode.value !== on
    this.mapUniforms.uColorMode.value = on
    this.applyColorParams(params)
    this.rebuildRamp(params) // le LUT change d'amplitude en Y avec le mode
    // l'analyse coûte une dizaine de flous sur tout le DEM : on ne la refait
    // que quand elle manque, pas à chaque passage de restyle du damier
    if (on) { if (changed || !this.mapUniforms.uAnalysisOn.value) this._buildFields() }
    else this.mapUniforms.uAnalysisOn.value = 0
    // mapTint fait partie du préréglage Atlas (la rampe doit reprendre la main),
    // or applyColorParams ne le pousse pas : sans cette ligne il restait dans
    // params sans jamais atteindre le shader. On respecte les deux exclusions
    // qui possèdent uTint — une matière de relief l'éteint (0), le métal liquide
    // le rabat à 0.1 — et on ne touche à rien dans ces cas.
    if (!this.materialMode && !this.mapUniforms.uLmOn.value) {
      this.mapUniforms.uTint.value = params.mapTint ?? this.mapUniforms.uTint.value
    }
    if (!this.materialMode || this.materialMode === 'glass') this.material.bumpScale = this._bumpScale(params)
    return changed
  }

  // Les réglages du mode Naturel, poussés aux uniformes (sans rien recalculer).
  applyColorParams(params = {}) {
    const u = this.mapUniforms
    u.uTexShade.value = params.texShade ?? 0
    u.uWetK.value = params.wetK ?? 0
    u.uExpoK.value = params.expoK ?? 0
    u.uTreeLine.value = params.treeLine ?? 0.62
    u.uHazeAmt.value = params.hazeAmt ?? 0
    u.uHazeAlt.value = params.hazeAlt ?? 0.5
    u.uHazeDist.value = params.hazeDist ?? 0.5
    if (params.hazeColor) u.uHazeColor.value.set(params.hazeColor)
    // c'est la LATITUDE qui décide de quel côté se trouve la face à l'ombre
    const lat = this.dem?.lat ?? params.demLat
    if (Number.isFinite(lat)) u.uHemi.value = lat >= 0 ? 1 : -1
  }

  // ⚠️ Le bump procédural COMBAT le peigné : il pose une micro-texture inventée
  // par-dessus une micro-texture réelle, et les deux se brouillent. Même raison
  // que pour params.detail (voir _makeDemSampler) — on l'atténue, sans écrire
  // dans params, pour que le curseur de l'utilisateur reste le sien.
  _bumpScale(params) {
    const k = this.mapUniforms.uColorMode.value === 1 ? NATURAL_BUMP_K : 1
    return (params.bumpScale ?? 1) * k
  }

  // Cuit la rampe d'altitude en LUT 2D : X = altitude, Y = humidité (voir
  // buildRamp2D dans palette.js). En Classique on force dry = wet = 0 — le LUT
  // est alors CONSTANT en Y et sa ligne médiane reproduit la rampe historique,
  // donc aucune palette du catalogue n'a besoin d'être ré-éditée.
  rebuildRamp(params) {
    if (this._shareSrc) { this._adoptShared(); return } // dalle voisine : la rampe du centre fait foi
    const natural = this.mapUniforms.uColorMode.value === 1
    const { data, width, height } = buildRamp2D(params, {
      dry: natural ? (params.rampDry ?? 0) : 0,
      wet: natural ? (params.rampWet ?? 0) : 0,
      oklab: natural && params.rampOklab !== false,
    })
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.flipY = false // ligne 0 = le pôle SEC, en bas du LUT (v = 0)
    tex.needsUpdate = true
    this.mapUniforms.uRampTex.value?.dispose()
    this.mapUniforms.uRampTex.value = tex
    this._pushShared() // l'ancienne vient d'être disposée : les emprunteurs suivent
  }

  // Noise-driven roughness map (green channel is what three.js reads) + bump map
  // reused for micro relief that's finer than the vertex grid.
  rebuildRoughness(params) {
    // an opaque relief material (wood/fabric/carbon) OWNS the roughnessMap — and
    // for wood/fabric it's a shared cached texture. Never dispose/overwrite it on
    // a terrain regen, or the material breaks and the cached texture is destroyed.
    if (this.materialMode && this.materialMode !== 'glass') return
    if (this._shareSrc) {
      // dalle voisine : même seed, donc même bruit — on prend celui du centre
      this._adoptShared()
      this.material.bumpScale = this._bumpScale(params)
      this.material.needsUpdate = true
      return
    }
    const size = 512
    // ══════ LES PIXELS SONT MÉMORISÉS PAR RÉGLAGE — Tâche FLU ═══════════════════
    //
    // ⛔ **300 À 460 ms DE FIL PRINCIPAL À CHAQUE RECONSTRUCTION, À CPU ×4**
    // (`.banc/sonde-descente-x4.log`, `terrain.rebuildRoughness`), pour un champ
    // qui ne dépend QUE de (graine, échelle, rugosité, variation) — six octaves
    // de simplex sur 262 144 texels, recuites à chaque cran, à chaque plongée,
    // à chaque curseur d'exagération, pour rendre les mêmes octets. On garde les
    // deux derniers champs ; les textures, elles, sont refaites (elles sont
    // disposées plus bas) — une `DataTexture` sur un tampon existant ne coûte
    // rien avant son téléversement.
    const sc = params.roughnessScale
    const cle = `${params.seed}|${sc}|${params.roughness}|${params.roughnessVariation}`
    const memo = (Terrain._rugositeMemo ||= new Map())
    let data = memo.get(cle)
    if (!data) {
      const rng = mulberry32(params.seed + 777)
      const s = new Simplex2(rng)
      data = new Uint8Array(size * size * 4)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = x / size
          const v = y / size
          const n = fbm(s, u * sc, v * sc, 4, 2.2, 0.55)
          const n2 = fbm(s, u * sc * 7 + 13, v * sc * 7 - 5, 2, 2.2, 0.5)
          const rough = THREE.MathUtils.clamp(params.roughness + params.roughnessVariation * n, 0.04, 1)
          const bump = 0.5 + 0.5 * (n * 0.6 + n2 * 0.4)
          const i = (y * size + x) * 4
          data[i] = Math.round(bump * 255) // bump reads red-ish luminance
          data[i + 1] = Math.round(rough * 255) // roughness reads green
          data[i + 2] = Math.round(bump * 255)
          data[i + 3] = 255
        }
      }
      memo.set(cle, data)
      while (memo.size > 2) memo.delete(memo.keys().next().value)
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true

    const bumpTex = tex.clone()
    bumpTex.repeat.set(4, 4)
    bumpTex.needsUpdate = true

    if (this.material.roughnessMap) this.material.roughnessMap.dispose()
    if (this.material.bumpMap && this.material.bumpMap !== this.material.roughnessMap) {
      this.material.bumpMap.dispose()
    }
    this.material.roughnessMap = tex
    this.material.bumpMap = bumpTex
    this.material.bumpScale = this._bumpScale(params)
    this.material.needsUpdate = true
    this._pushShared() // les anciennes viennent d'être disposées
  }

  updateMaterial(params) {
    this.material.color.set(params.color)
    this.material.envMapIntensity = params.envMapIntensity
    this.material.bumpScale = this._bumpScale(params)
    this.material.transmission = params.transmission ?? 0
  }

  // "Liquid metal" look — chrome the raised relief so the scene environment
  // reflects off it instead of the paper map. Fully reversible: off restores
  // the current template's material (envMap / transmission / map tint) from
  // params. metalness/roughness/uTint survive a geometry rebuild, so only
  // updateMaterial() (envMap/transmission) needs re-asserting after a template
  // change — the caller does that.
  setLiquidMetal(on, params) {
    const m = this.material
    const u = this.mapUniforms
    if (on) {
      m.metalness = params.lmMetalness ?? 1
      m.roughness = params.lmRoughness ?? 0.16 // multiplies the roughness map
      m.envMapIntensity = params.lmReflection ?? 2.0
      m.transmission = 0
      u.uTint.value = 0.1 // fade the paper colour so the metal reads
      u.uLmOn.value = 1
      u.uLmFlowAmt.value = (params.lmSpeed ?? 0.4) > 0 ? 0.5 : 0 // 0 speed = still mirror
    } else {
      m.metalness = 0
      m.roughness = 1
      m.envMapIntensity = params.envMapIntensity
      m.transmission = params.transmission ?? 0
      u.uTint.value = params.mapTint
      u.uLmOn.value = 0
      u.uLmFlowAmt.value = 0
    }
    m.needsUpdate = true
  }
  tickLiquidMetal(dt, speed) {
    if (this.mapUniforms.uLmOn.value > 0.5 && speed > 0) this.mapUniforms.uLmFlow.value += dt * speed
  }

  // Turn the WHOLE relief into a material (like Liquid metal, but a full swap):
  //   'glass'          → premium transmission glass (MeshTransmissionMaterial):
  //                      the mountain becomes a refracting glass sculpture
  //   'wood'|'carbon'|'marble' → opaque textured material draped over the relief
  //                      (albedo + normal + roughness), the hypso paint faded out
  //   ''               → back to the topographic map
  setMaterialMode(id, params = {}) {
    this.materialMode = id || ''
    if (id === 'glass') {
      if (!this.glassMaterial) this._makeGlassMaterial()
      this.applyTerrainGlass(params)
      this.mapUniforms.uMatNoiseOn.value = 0
      this.mapUniforms.uMatAboveZero.value = 0
      this.mesh.material = this.glassMaterial
      return
    }
    // opaque / none: reuse the terrain's own MeshPhysicalMaterial
    this.mesh.material = this.material
    const m = this.material
    const preset = OPAQUE_TERRAIN_MATS[id]
    if (preset) {
      const scale = params.terrainMatScale ?? 1
      const rep = (preset.repeat ?? 6) * scale * zoomRepeat(params.demZoom)
      if (preset.dir) {
        // real CC0 PBR set (Poly Haven), lazy-loaded + cached; mutate repeat live
        const set = this._loadTextureSet(preset.dir)
        for (const k of ['map', 'normalMap', 'roughnessMap']) set[k]?.repeat.set(rep, rep)
        m.map = set.map
        m.normalMap = set.normalMap
        m.roughnessMap = set.roughnessMap
        this._surfSet = set
      } else {
        const t = TEXTURE_BUILDERS[preset.tex]?.()
        this._surfMap = swapClone(this._surfMap, t?.map, rep)
        this._surfNm = swapClone(this._surfNm, t?.normalMap, rep)
        this._surfRm = swapClone(this._surfRm, t?.roughnessMap, rep)
        m.map = this._surfMap || null
        m.normalMap = this._surfNm || null
        m.roughnessMap = this._surfRm || null
      }
      // ══════ UNE CARTE DE NORMALES CHASSE LA CARTE DE BOSSELAGE ═════════════
      //
      // Le bosselage procédural du terrain (rebuildRoughness) restait posé SOUS
      // la matière de surface : three applique alors les deux perturbations l'une
      // après l'autre, et un bruit répété quatre fois brouillait le grain de la
      // toile qu'on venait de charger. Deux cartes qui décrivent le même relief
      // de surface, dont une seule a été choisie.
      //
      // ⚠️ ET C'EST AUSSI UNE UNITÉ DE TEXTURE RENDUE. C'est elle qui faisait
      // passer le gabarit « java » de 17 à 18 unités, au-dessus des 16 que la
      // machine offre — le terrain ne linkait plus et disparaissait. Voir le
      // pavé sur SHIBU_SOL plus haut.
      // ⚠️ ON DÉTACHE, ON NE DISPOSE PAS. Les dalles voisines du damier
      // RECOPIENT la référence (`this.material.bumpMap = src.material.bumpMap`,
      // _pushShared) : la libérer ici servirait une texture morte à vingt-trois
      // matériaux. rebuildRoughness en refera une le jour où on revient à la
      // carte topographique.
      if (m.normalMap) m.bumpMap = null
      // La diffusion de CETTE matière — ou son extinction. ⚠️ Le `else` n'est pas
      // décoratif : les uniformes survivent au changement de matière, et sans
      // remise à zéro la roche brute héritait du halo de l'albâtre.
      const sss = preset.sss
      this.mapUniforms.uMatSSS.value = sss ? Math.max(0, sss.force ?? 0) : 0
      if (sss) {
        this.mapUniforms.uMatSSSTeinte.value.set(sss.teinte ?? '#ff9a5e')
        this.mapUniforms.uMatSSSPower.value = Math.max(1, sss.nettete ?? 3.2)
      }
      const b = (params.terrainSurfaceBump ?? 1) * (preset.normalScale ?? 1)
      m.normalScale.set(b, b)
      m.metalness = preset.metalness ?? 0
      m.roughness = preset.roughness ?? 0.8 // slider (setTerrainMatRoughness) tunes live
      m.envMapIntensity = preset.envMapIntensity ?? params.envMapIntensity ?? 1
      m.color.set('#ffffff') // let the albedo map show its true colour
      this._matPreset = preset
      this._matFlow = preset.flow ?? 0 // >0 → drifting (moving sand)
      this._matZoom = params.demZoom
      this.mapUniforms.uTint.value = 0 // drop the hypsometric paint → pure material
      this.setMatNoise(params.terrainMatNoise ?? 0) // patchy 3D + holes
      this.setMatAboveZero(params.terrainMatAboveZero)
    } else {
      // none — restore the topographic look
      this.mapUniforms.uMatSSS.value = 0 // la carte topographique ne diffuse pas
      m.map = null
      m.normalMap = null
      m.normalScale.set(1, 1)
      m.metalness = 0
      m.roughness = 1
      m.envMapIntensity = params.envMapIntensity ?? 1
      m.color.set(params.color ?? '#ffffff')
      this._matPreset = null
      this._matFlow = 0
      // detach the material's (possibly shared, cached) roughnessMap BEFORE
      // rebuildRoughness so it isn't disposed out from under the texture cache
      m.roughnessMap = null
      this.mapUniforms.uTint.value = params.mapTint ?? 1
      this.mapUniforms.uMatNoiseOn.value = 0 // no material noise on the plain map
      this.mapUniforms.uMatAboveZero.value = 0
      // restore the procedural terrain roughness/bump the relief material replaced
      this.rebuildRoughness(params)
    }
    m.needsUpdate = true
  }
  // lazy-load + cache a real PBR texture set from public/textures/<dir>/
  _loadTextureSet(dir) {
    this._texSets = this._texSets || {}
    if (this._texSets[dir]) return this._texSets[dir]
    const loader = (this._texLoader = this._texLoader || new THREE.TextureLoader())
    const mk = (file, srgb) => {
      const t = loader.load(dir + file)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = 8
      return t
    }
    const set = { map: mk('diff.jpg', true), normalMap: mk('nor_gl.jpg', false), roughnessMap: mk('rough.jpg', false) }
    this._texSets[dir] = set
    return set
  }
  // live tiling-scale knob for the opaque relief materials
  setTerrainMatScale(scale, demZoom) {
    const p = this._matPreset
    if (!p || this.materialMode === 'glass') return
    const rep = (p.repeat ?? 6) * scale * zoomRepeat(demZoom ?? this._matZoom ?? 15)
    this._matScale = scale
    for (const t of [this.material.map, this.material.normalMap, this.material.roughnessMap]) t?.repeat.set(rep, rep)
  }
  // re-tile the active material when the DEM zoom changes (regen) so the pattern
  // density tracks the view scale
  refreshMatTiling(params) {
    this._matZoom = params.demZoom
    if (this._matPreset && this.materialMode !== 'glass') this.setTerrainMatScale(params.terrainMatScale ?? 1, params.demZoom)
  }
  setTerrainMatRoughness(r) {
    if (this._matPreset && this.materialMode !== 'glass') this.material.roughness = r
  }
  // procedural noise on the relief material: 3D lift where the noise is high, and
  // a soft dissolve to the map/shader underneath where it's low. 0 = off. Only
  // meaningful for an opaque relief material.
  setMatNoise(v) {
    const on = v > 0.001 && this._matPreset && this.materialMode !== 'glass'
    this.mapUniforms.uMatNoiseOn.value = on ? 1 : 0
    this.mapUniforms.uMatNoiseAmt.value = v * 1.0 // raised-patch height
    this.mapUniforms.uMatNoiseCut.value = v * 0.55 // more strength → more map shows through
    this.mapUniforms.uMatNoiseSoft.value = 0.12 + v * 0.16 // diffuse edge, softer at higher strength
  }
  // "Au-dessus du niveau zéro": relief material only paints above sea level;
  // below uSeaY the surface falls back to the hypsometric map colour.
  setMatAboveZero(v) { this.mapUniforms.uMatAboveZero.value = v ? 1 : 0 }
  // drift the relief material's maps for "moving sand" (keeps the PBR intact —
  // it's the same textures, just scrolling). Called each frame from the loop.
  tickSurfaceMaterial(dt) {
    if (!this._matFlow || this.materialMode === 'glass') return
    const d = this._matFlow * dt
    for (const t of [this.material.map, this.material.normalMap, this.material.roughnessMap]) {
      // wrap in [0,1) so a long session never grows the offset unbounded
      if (t) { t.offset.x = (t.offset.x + d) % 1; t.offset.y = (t.offset.y + d * 0.6) % 1 }
    }
  }
  _makeGlassMaterial() {
    this.glassMaterial = new MeshTransmissionMaterial({
      samples: 8, // a few more taps so the strong default frost stays smooth
      transmission: 1,
      thickness: 8,
      roughness: 0.5, // blurry frosted glass by default
      ior: 1.45,
      metalness: 0,
      envMap: this.material.envMap || null,
      envMapIntensity: 1.4,
      attenuationColor: new THREE.Color('#bfe4ff'),
      attenuationDistance: 12,
      side: THREE.DoubleSide,
      blurStrength: 2.0, // wide transmission cone → real blur, not just a sheen
    })
  }
  // live glass knobs (frost, tint, thickness, reflection)
  applyTerrainGlass(params = {}) {
    if (!this.glassMaterial) this._makeGlassMaterial()
    const g = this.glassMaterial
    if (params.terrainGlassFrost != null) g.roughness = params.terrainGlassFrost
    if (params.terrainGlassThickness != null) g.thickness = params.terrainGlassThickness
    if (params.terrainGlassTint) g.attenuationColor.set(params.terrainGlassTint)
    if (params.terrainGlassClarity != null) g.attenuationDistance = params.terrainGlassClarity
    if (params.terrainGlassReflection != null) g.envMapIntensity = params.terrainGlassReflection
    if (!g.envMap) g.envMap = this.material.envMap || null
    g.needsUpdate = true
  }
  setSurfaceMaterialBump(b) {
    if (this.materialMode && this.materialMode !== 'glass' && this.material.normalMap) {
      this.material.normalScale.set(b, b)
    }
  }
}
