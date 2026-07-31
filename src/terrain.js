import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, ridged, smoothstep, lerp } from './noise.js'
import { sampleDem } from './dem.js'
import { buildRamp2D } from './palette.js'
import { gridTemplate } from './grid-template.js'
import { gridNormals } from './grid-normals.js'
import { detailField, detailFieldEmprise, accordeDetailScale, tintField } from './detail-noise.js'
import { analyseMemoLire, analyseMemoEcrire } from './dem-memo.js'
import { landMaskFromField, BASSIN_FRAC_DEFAUT } from './sea-mask.js'
import { ATLAS_ANALYSE, ATLAS_MER, fracBassinEmprise } from './dem-emprise.js'
// les huit demi-plans de la fenêtre, purs et testés — voir src/fenetre-clip.js
// ⚠️ ALIASÉ : la méthode `Terrain.plansFenetre()` rend des `THREE.Plane`, la
// fonction pure rend des descriptions. Le même nom pour les deux se lit comme
// une récursion qui n'existe pas.
import { plansFenetre as demiPlansFenetre } from './fenetre-clip.js'
// L'analyse de relief et le masque de mer ne sont plus calcules ici : ils
// partent dans un Worker (terrain-jobs.js). ~470 ms de fil principal fige par
// reconstruction, sur MNT 1536². Le calcul est identique octet pour octet.
import { scheduleTerrainJob, jobStillValid, jobCouvertParEnVol } from './terrain-jobs.js'
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
// `Terrain._resFenetre` pour la mesure qui l'impose.
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
      uSlabCornerN: { value: 2 }, // cercle, comme le clip de la mer (v42)
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
// --- Appearance blend modes (Figma / W3C compositing set) — b = backdrop map,
// s = the shader colour. Separable ops are channel-wise; the last four are the
// non-separable HSL modes. ---
float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
  if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
  if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
  return clamp(c, 0.0, 1.0); }
vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
float blSat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 blSetSat(vec3 c, float s) { float mn = min(min(c.r, c.g), c.b), mx = max(max(c.r, c.g), c.b);
  return mx > mn ? (c - mn) / (mx - mn) * s : vec3(0.0); }
vec3 blHard(vec3 b, vec3 s) { return mix(b + s - b * s - (1.0 - 2.0 * s) * b, b * 2.0 * s, step(s, vec3(0.5))); }
vec3 fxBlend(vec3 b, vec3 s, int m) {
  if (m == 1) return min(b, s);                                  // Darken
  if (m == 2) return b * s;                                      // Multiply
  if (m == 3) return max(vec3(0.0), b + s - 1.0);                // Plus darker (linear burn)
  if (m == 4) return 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-4)); // Colour burn
  if (m == 5) return max(b, s);                                  // Lighten
  if (m == 6) return b + s - b * s;                              // Screen
  if (m == 7) return min(vec3(1.0), b + s);                      // Plus lighter (linear dodge)
  if (m == 8) return min(vec3(1.0), b / max(1.0 - s, 1e-4));     // Colour dodge
  if (m == 9) return blHard(s, b);                               // Overlay (hard-light swapped)
  if (m == 10) { vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3(0.25), b));
    return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(vec3(0.5), s)); } // Soft light
  if (m == 11) return blHard(b, s);                              // Hard light
  if (m == 12) return abs(b - s);                                // Difference
  if (m == 13) return b + s - 2.0 * b * s;                       // Exclusion
  if (m == 14) return blSetLum(blSetSat(s, blSat(b)), blLum(b)); // Hue
  if (m == 15) return blSetLum(blSetSat(b, blSat(s)), blLum(b)); // Saturation
  if (m == 16) return blSetLum(s, blLum(b));                     // Colour
  if (m == 17) return blSetLum(b, blLum(s));                     // Luminosity
  return s;                                                      // Normal
}`
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
    vec2 cq = max(abs(vWorldPos.xz - uBlockOffset) - vec2(uSlabHalf - uSlabCorner), 0.0);
    // superellipse boundary |x|^n + |y|^n = r^n (n=2 circle, higher = squircle);
    // straight edges stay exact (one component is 0), only corners are shaped
    float pn = pow(pow(cq.x, uSlabCornerN) + pow(cq.y, uSlabCornerN), 1.0 / uSlabCornerN);
    if (pn > uSlabCorner) discard;
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
  bool underwater = uCoastMaskOn > 0.5
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
      vec2 cw = vWorldPos.xz + 0.9 * vec2(sin(vWorldPos.z * 0.11 + uCausT * 0.07), cos(vWorldPos.x * 0.13 - uCausT * 0.05));
      float cc1 = seaCaustic(cw * 0.55 + vec2(uCausT * 0.05, 0.0), uCausT * 0.8);
      float cc2 = seaCaustic(cw * 0.23 - vec2(0.0, uCausT * 0.03), uCausT * 0.5);
      float cnet = clamp(cc1 * 1.2 + cc2 * 0.5, 0.0, 1.5);
      float cfil = smoothstep(0.5, 1.1, cnet);
      // rayons de lumière : bandes larges et lentes qui traversent le fond
      float crays = mix(0.72, 1.0, 0.5 + 0.5 * sin(dot(vWorldPos.xz, vec2(0.33, 0.21)) + uCausT * 0.2));
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
    float pivotFloor = uSeaY > -9000.0
      ? clamp((uSeaY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 0.95) + 0.02
      : 0.0;
    float pivot = max(uHeightPivot, pivotFloor);
    float rampT = clamp(0.5 + (hNorm - pivot) * uHeightContrast, 0.0, 1.0);
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
      // et les névés prendraient des verts de prairie
      float veg = 1.0 - smoothstep(uTreeLine, uTreeLine + 0.18, hNorm);
      float wet = (anl.b - 0.5) * 2.0;  // > 0 = creux qui collecte l'eau
      float expo = (anl.a - 0.5) * 2.0; // > 0 = versant tourné au nord
      // uHemi : au NORD de l'équateur l'ubac (face nord) est la face à l'ombre,
      // donc la fraîche et l'humide. Au sud tout s'inverse.
      // GAIN 1.62, et ce n'est pas une constante de confort. Les canaux B et A
      // sortent d'encodeTextureShade, dont le soft-clip place le 95e centile à
      // 0.808 — soit 0.616 une fois ramené en ±1. Le facteur 0.5 qui se trouvait
      // ici rabotait encore de moitié : au réglage 1 on ne balayait que 31 % du
      // LUT. Mesuré sur une carte réelle, la couleur ne bougeait alors que de
      // 3 unités de RVB sur 255 — les tirettes semblaient mortes. 1/0.616 fait
      // qu'au réglage 1 une anomalie au 95e centile atteint le bord de la rampe.
      // ×3 SUR DEMANDE D'ADRIEN, par-dessus la compensation de 1.62 : à 1.62 le
      // réglage 1 amenait tout juste le 95e centile au bord du LUT, ce qui est
      // « juste » au sens statistique mais trop sage à l'écran. 4.86 fait mordre
      // les tirettes dès le milieu de leur course ; les extrêmes saturent, et
      // c'est assumé — un fond de vallon doit être franchement plus vert.
      wetY = clamp(0.5 + 4.86 * veg * (wet * uWetK + expo * uHemi * uExpoK), 0.0, 1.0);
    }
    mapCol = texture2D(uRampTex, vec2(rampT, wetY)).rgb;
    if (uColorMode == 1) {
      if (uAnalysisOn > 0.5 && uTexShade > 0.001) {
        // SOFT LIGHT, jamais une multiplication : multiplier (ou mixer vers le
        // blanc) tire la couleur vers le gris et DÉSATURE — on gagne du modelé
        // et on perd la palette. Le soft light du W3C éclaircit/assombrit en
        // gardant la chroma. fxBlend(b, s, 10) EST ce soft light, déjà défini
        // plus haut pour les shaders de surface : on le réutilise tel quel.
        // ×3 sur le PEIGNÉ, lui aussi (demande d'Adrien). On ne peut pas monter
        // le mix au-delà de 1 : on écarte donc le signal de son neutre AVANT le
        // soft light. C'est le contraste du peigné qui triple, pas son dosage —
        // la palette reste intacte, seule l'amplitude du modelé change.
        float comb = clamp(0.5 + (anl.r - 0.5) * 3.0, 0.0, 1.0);
        mapCol = mix(mapCol, fxBlend(mapCol, vec3(comb), 10), uTexShade);
        // l'ombrage classique par-dessus, au tiers : au dézoom les bandes fines
        // du peigné tombent sous la taille du pixel et se moyennent en gris,
        // c'est lui qui garde alors le massif lisible
        float hs = clamp(0.5 + (anl.g - 0.5) * 3.0, 0.0, 1.0);
        mapCol = mix(mapCol, fxBlend(mapCol, vec3(hs), 10), uTexShade * 0.35);
      }
      // --- PERSPECTIVE AÉRIENNE (Imhof) — entièrement en fragment, zéro tap.
      if (uHazeAmt > 0.001) {
        // 1. DISTANCE : le lointain se voile.
        float fd = clamp(length(vWorldPos.xz - uBlockOffset) / max(uSlabHalf, 1e-3), 0.0, 1.0);
        // 2. ALTITUDE (Hoehenmodulation) : les basses terres se voilent MÊME
        // proches. C'est cette composante-là, pas la distance, qui donne le
        // bleu-gris des plaines sur les planches de référence — l'air épais du
        // fond de vallée est devant elles quelle que soit la distance.
        float fa = 1.0 - smoothstep(0.0, max(uHazeAlt, 1e-3), hNorm);
        float veil = clamp(uHazeAmt * (0.6 * fa + uHazeDist * fd), 0.0, 0.9);
        // DÉSATURER D'ABORD, virer vers la brume ensuite : l'air diffuse la
        // lumière, il ne repeint pas le sol en bleu. Un mix direct vers
        // uHazeColor donne une carte teintée, pas une carte lointaine.
        float lum = dot(mapCol, vec3(0.2126, 0.7152, 0.0722));
        mapCol = mix(mapCol, vec3(lum), veil * 0.65);
        mapCol = mix(mapCol, uHazeColor, veil);
        // CONTREPARTIE INDISSOCIABLE : sans elle le voile aplatit toute la
        // carte. On remonte le contraste là où le voile est nul — donc sur les
        // sommets, qui reprennent le mordant que les plaines viennent de perdre.
        float lift = (1.0 - veil) * uHazeAmt * 0.35;
        mapCol = clamp((mapCol - 0.5) * (1.0 + lift) + 0.5, 0.0, 1.0);
      }
    } else {
      mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
    }
  }
  float fxShade = clamp(luma * 2.4, 0.2, 1.4);
  // material noise reveal: where the noise is below the (soft) cut, push the tint
  // back toward 1 so the map paint shows through the relief material — a diffuse,
  // holeless dissolve that lets you see the layer underneath. The revealed map is
  // lifted back toward its natural brightness (not shaded by the material albedo)
  // so it reads as the real map/shader colour, never a muddy hole.
  float effTint = uTint;
  float paintShade = fxShade;
  if (uMatNoiseOn > 0.5) {
    float mn = mnNoise(vWorldPos.xz * uMatNoiseScale);
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

  // Optional aerial photo, applied HERE on purpose: over the hypsometric paint
  // but UNDER the contours, grid and labels below — so the drawn cartography
  // still sits on top of the photograph rather than being buried by it. That
  // ordering is most of what keeps this from becoming a plain satellite viewer.
  if (uAerialOn > 0.5) {
    vec2 aUv = (vWorldPos.xz - uBlockOffset) / (uSlabHalf * 2.0) + 0.5;
    aUv.y = 1.0 - aUv.y; // texture rows run north->south, world +Z runs south->north
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
    diffuseColor.rgb = mix(diffuseColor.rgb, aerial * (0.6 + 0.8 * shade), uAerialOpacity * aFade);
  }

  // Fancy surface shader paints OVER the final surface — the hypsometric map OR
  // a relief material (wood/carbon/...). Materials sit BELOW the shaders, so a
  // shader shows on top of whatever the relief is wearing. Off (0) = untouched.
  if (uSurfaceFx > 0) {
    vec3 fxc = surfaceFx(uSurfaceFx, vWorldPos.xz * 0.15, uFxTime) * fxShade;
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
  vec2 g = vWorldPos.xz / uGridStep;
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
  vec2 fp = vWorldPos.xz * 0.55;
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
    this.rebuild(params)
    this.rebuildRoughness(params)
  }

  setDem(dem) {
    this.dem = dem
  }

  // PARTAGE DES TEXTURES QUI SONT LES MÊMES PARTOUT — rampe hypsométrique,
  // rugosité et bump. Sur un damier plein, les 24 dalles cuisaient 24 copies
  // OCTET POUR OCTET identiques : le seed de rugosité est `params.seed + 777`,
  // commun à tous les blocs, et la rampe ne dépend que de la palette. 2,13 Mo
  // et 80 ms de calcul par dalle, pour rien.
  //
  // ⚠️ L'EMPRUNT DOIT SE RÉPARER TOUT SEUL, et c'est là que ça se joue : la
  // source DISPOSE son ancienne texture à chaque recuisson (changement de
  // palette, régénération du relief). Un emprunteur qui garderait la référence
  // pointerait sur une texture morte — relief noir. D'où l'ensemble
  // `_shareTo` : c'est la SOURCE qui repousse la nouvelle texture à ses
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
  // the block footprint for overlay clipping (slab superellipse + region cutout)
  blockFootprint() {
    const u = this.mapUniforms
    const regionOn = u.uRegionOn.value > 0.5
    return {
      half: u.uSlabHalf.value,
      corner: regionOn ? 0 : u.uSlabCorner.value,
      cornerN: u.uSlabCornerN.value,
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
  plansFenetre() {
    const fp = this.empriseFootprint()
    if (!fp) return null
    const u = this.mapUniforms
    const half = u.uSlabHalf.value
    const corner = u.uRegionOn.value > 0.5 ? 0 : u.uSlabCorner.value
    const cle = `${half}:${corner}`
    if (this._plansCle !== cle) {
      this._plansCle = cle
      this._plans = demiPlansFenetre(half, corner).map(
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
      this._coastLand = null // cache landMask (dépend de dem.size) — invalidé
      // ⚠️ withAnalysis: false — la landMask ne change QUE la mer. Recuire les
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
  _resFenetre(params) {
    return this.dem?.empriseCote > 1 ? Math.min(params.resolution, RES_FENETRE_CONTINUE) : params.resolution
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
    return accordeDetailScale(params.detailScale, params.resolution, this._resFenetre(params))
  }

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    const span = this._span()
    const fen = this.fenetre // lu par référence : le drag le bouge sans refaire le sampler
    // demExaggeration is the per-zoom value chosen in the UI (coarse blocks big)
    const scale = (span / dem.extentMeters) * params.demExaggeration
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
    const detail = this.mapUniforms.uColorMode.value === 1 ? Math.min(params.detail, NATURAL_DETAIL_MAX) : params.detail

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
    const scale = (span / dem.extentMeters) * params.demExaggeration
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
    const scale = (span / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    const { size } = dem
    const detail = this.mapUniforms.uColorMode.value === 1 ? Math.min(params.detail, NATURAL_DETAIL_MAX) : params.detail
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
  _ecrireRelief(geo, params, res, sample, gridSample) {
    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = gridSample ? gridSample(i, x, z) : sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
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
      const scale = (this._span() / this.dem.extentMeters) * params.demExaggeration
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
    const nAtt = geo.attributes.normal
    const normals = gridNormals(arr, res, TERRAIN_SIZE, nAtt?.array)
    if (nAtt) nAtt.needsUpdate = true
    else geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

    // vertex tint: height-graded value + slope darkening + grain jitter
    // Le grain est PRÉ-CUIT sur la grille (detail-noise.js, `tintField`) : deux
    // octaves de simplex par sommet, 65 ms de gel par reconstruction à res 768,
    // pour un motif qui ne dépend que de (graine, résolution) — il survit donc
    // au changement de zoom, au curseur d'exagération et à la palette.
    // Bit-identique, verrouillé par test/detail-noise.test.js.
    const tint = tintField(params.seed + 101, res, TERRAIN_SIZE)
    const cAtt = geo.attributes.color
    const colors = cAtt ? cAtt.array : new Float32Array(count * 3)
    const span = Math.max(1e-5, maxH - minH)
    for (let i = 0; i < count; i++) {
      const h = arr[i * 3 + 1]
      const ny = normals[i * 3 + 1]
      const hn = (h - minH) / span
      let v = lerp(0.62, 0.95, Math.pow(hn, 0.85))
      v *= lerp(0.78, 1.0, Math.pow(Math.max(0, ny), 0.6))
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
    const geo = this.mesh.geometry
    if (!geo?.attributes?.position) return false
    const res = this._resFenetre(params)
    // Le sampler est refait à chaque pas — il capture `params` (exagération,
    // détail, mode couleur), qui peuvent avoir changé entre deux images. Il ne
    // capture PAS le décalage : `fenetre` est lu par référence.
    const sample = this._makeSampler(params)
    this.sample = sample
    const { minH, maxH } = this._ecrireRelief(geo, params, res, sample, this._makeGridSampler(params, res))
    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    // le masque côtier doit défiler AVEC le relief qu'il classe terre ou mer
    this._pousseFenetre()
    // ⚠️ Pas de `geo.computeBoundingSphere()` : la sphère englobante ne sert
    // qu'au frustum culling, le maillage garde son emprise XZ, et seule sa
    // hauteur bouge. La recalculer coûterait un parcours complet de plus par
    // image pour un test que le maillage passe de toute façon (il est sous la
    // caméra). Si un jour un sommet disparaît en bord d'écran, c'est ici.
    return true
  }

  rebuild(params) {
    const res = this._resFenetre(params)
    // GABARIT MÉMORISÉ au lieu de `new THREE.PlaneGeometry` : celui-ci mettait
    // 194 ms et jetait 262 Mo de tas JS à res 1024 (106 ms et 104 Mo à res 768)
    // pour fabriquer un plan PLAT que les lignes suivantes réécrivent
    // intégralement (Y, normales, couleurs). Sur une reconstruction complète du
    // bloc, mesurée en navigateur au Mont-Blanc à res 1024 : 853 → 770 ms.
    // Bit-identique, verrouillé par test/grid-template.test.js.
    // ⚠️ `position` est COPIÉ (on va y écrire les Y, et le gabarit est partagé
    // entre blocs) ; `uv` et `index` sont branchés TELS QUELS parce que personne
    // ne les écrit — voir l'avertissement en tête de grid-template.js.
    const tpl = gridTemplate(res, TERRAIN_SIZE)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tpl.position), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(tpl.uv, 2))
    geo.setIndex(new THREE.BufferAttribute(tpl.index, 1))

    const sample = this._makeSampler(params)
    this.sample = sample
    // le grain FBM est pré-cuit sur la grille (detail-noise.js) — mesuré en
    // navigateur au Mont-Blanc à res 1024 : 770 → 600 ms de reconstruction, et
    // il survit à un changement de zoom,
    // à un coup de curseur d'exagération et à une bascule de palette. Repli sur
    // `sample` quand il n'y a rien à mémoriser (relief procédural).
    const gridSample = this._makeGridSampler(params, res)

    const { minH, maxH } = this._ecrireRelief(geo, params, res, sample, gridSample)

    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    this._pousseFenetre()

    // georeferenced sea level (elevation 0) — ALWAYS active in real mode so every
    // template gets a clear shoreline and consistent bathymetry, even where the
    // patch has no sub-sea data (then uSeaY simply sits below the terrain).
    if (params.source === 'real' && this.dem) {
      const demScale = (this._span() / this.dem.extentMeters) * params.demExaggeration
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

    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
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
  // (emprise en tuiles 256 px, zooms grossiers) rend 1 536. La landMask est
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
  // consommateurs doivent tomber d'accord au pixel près — la landMask ci-dessous
  // et le travail posté au Worker.
  _seaSize(dem) {
    const max = this._seaMax(dem)
    return max > 0 && dem.size > max ? max : dem.size
  }

  // landMask depuis le masque côtier (si reçu) : rééchantillonné à la grille
  // du MASQUE DE MER et mis en cache — recalculé seulement si l'image ou cette
  // taille change.
  // ⚠️ L'IDENTITÉ de ce tableau sert de clé de péremption (voir _buildFields) :
  // le remplacer par un tableau neuf au même contenu périmerait pour rien un
  // calcul encore juste.
  // ⚠️ ET LA TAILLE EST CELLE DU MASQUE DE MER, PAS CELLE DU MNT. buildSeaMask
  // indexe la landMask cellule pour cellule : la caler sur le MNT pendant que le
  // masque est plafonné rendrait des polders décalés — un défaut MUET, pas une
  // erreur. (landMaskFromField rééchantillonne depuis le masque côtier 1024²,
  // il ne perd donc rien à cuire directement à la bonne taille.)
  _landMaskFor(dem) {
    if (!this._coastImage) return null
    const taille = this._seaSize(dem)
    if (!this._coastLand || this._coastLand.img !== this._coastImage || this._coastLand.size !== taille)
      this._coastLand = { img: this._coastImage, size: taille, mask: landMaskFromField(this._coastImage, taille) }
    return this._coastLand.mask
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
  // ⚠️ PÉREMPTION : la clé ne porte QUE le MNT, la landMask et les deux plafonds
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
    // ⚠️ Le coût reste réel : ~1 s de cuisson au chargement. Deux atténuations,
    // et elles sont dans l'architecture, pas dans l'espoir — le calcul est en
    // Worker (aucun gel) et il ne se fait QU'UNE FOIS. Le voile de chargement
    // l'attend par `fieldsReady`, comme pour un bloc ordinaire.
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
    const landMask = this._landMaskFor(dem)
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
    // ⚠️ LE MÊME TRAVAIL EST DEMANDÉ DEUX FOIS À LA NAISSANCE D'UNE DALLE :
    // rebuild() lance les champs, puis setColorMode les relance parce que
    // uAnalysisOn vaut encore 0 — l'uniforme ne monte qu'à l'ARRIVÉE. On rend
    // alors la promesse EN COURS au lieu de reposter (voir jobCouvertParEnVol,
    // qui garde ouverte la porte du recalcul légitime).
    const demande = { dem, landMask, maxSize, seaMax, analyse }
    if (jobCouvertParEnVol(this._fieldsEnVol, demande)) return this.fieldsReady
    this._fieldsEnVol = demande
    this._fieldKey = { dem, landMask, maxSize, seaMax }
    // ⚠️ DEUX CLÉS, PAS UNE — et c'est un bug vu à l'écran, pas une précaution.
    // Le masque de mer dépend de la landMask ; l'analyse de relief n'en dépend
    // PAS (elle ne lit que les altitudes). Sur une dalle voisine, le trait de
    // côte arrive ~300 ms après le lancement, donc AVANT la fin de l'analyse :
    // avec une clé commune, l'arrivée du trait de côte périmait une analyse
    // parfaitement juste et la dalle restait sans peigné à côté d'un centre
    // peigné. L'invalidation trop large coûte aussi cher que la trop laxiste.
    const cleMer = { dem, landMask, seaMax }
    const cleAnalyse = { dem, maxSize }
    return (this.fieldsReady = scheduleTerrainJob({
      key: { dem }, // le MNT périme TOUT ; le reste se juge champ par champ
      job: {
        data: dem.data,
        size: dem.size,
        metersPerPixel: dem.metersPerPixel,
        maxSize,
        seaMax,
        landMask,
        withAnalysis: analyse,
        // les deux options de l'atlas — voir l'en-tête. Hors mode continu elles
        // valent `false` et `undefined`, et computeTerrainJob est alors
        // bit-à-bit ce qu'il était (test/terrain-jobs.test.js le verrouille).
        merMinPool: emprise > 0,
        minBasinFrac: emprise > 0 ? fracBassinEmprise(BASSIN_FRAC_DEFAUT, emprise) : undefined,
      },
      current: () => this._fieldKey,
      apply: (r, actuel) => {
        if (jobStillValid(cleMer, actuel)) this._applySeaMask(r.sea, r.seaSize)
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
    // landMask de la dalle qu'on détruit (9 Mo pour le premier). Le damier
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
    const rng = mulberry32(params.seed + 777)
    const s = new Simplex2(rng)
    const data = new Uint8Array(size * size * 4)
    const sc = params.roughnessScale
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
