import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, ridged, smoothstep, lerp } from './noise.js'
import { sampleDem } from './dem.js'
import { rampColorStops } from './palette.js'
import { buildSeaMask, blurMask } from './sea-mask.js'
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

export const BASIN_RADIUS = 6.6 // flat excavation floor
export const BASIN_BLEND = 9.0 // where flat floor blends back into mountains
export const FLOOR_Y = -0.35

// CPU-generated terrain: multi-scale FBM + ridged multifractal + domain warping,
// with real vertex normals so PBR lighting and DOF read the actual relief.
export class Terrain {
  // opts.offset {x,z} : bloc VOISIN du damier (block-grid.js) — le mesh est
  // décalé dans le monde et uBlockOffset ramène clip + masques en coordonnées
  // locales au bloc. Le bloc principal garde (0,0) : comportement identique.
  constructor(params, opts = {}) {
    this.blockOffset = { x: opts.offset?.x ?? 0, z: opts.offset?.z ?? 0 }
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
    vec2 smUv = (vWorldPos.xz - uBlockOffset) / (uSlabHalf * 2.0) + 0.5;
    seaMask = texture2D(uSeaMask, smUv).r;
  }
  // coarse-zoom coast (z4–z8): the real Natural-Earth land/sea mask is the
  // source of truth — a cell is sea because the vector coast says so, not
  // because its (noisy, coarse) DEM height dipped below 0. Fixes flooded flat
  // coasts AND phantom inland lakes. Off (z9+ / fetch failed) → old behaviour.
  float landness = 1.0;
  if (uCoastMaskOn > 0.5) {
    vec2 cmUv = (vWorldPos.xz - uBlockOffset) / (uSlabHalf * 2.0) + 0.5;
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
      float creach = mix(0.3, 1.0, 1.0 - d01); // plein en eau peu profonde, plancher au large
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
    mapCol = texture2D(uRampTex, vec2(rampT, 0.5)).rgb;
    mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
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
    diffuseColor.rgb *= 1.0 - cloudShade * uCloudShadowK;
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

  // Region cutout ("individualiser la zone"): pass the mask texture built by
  // region-mask.js fetchRegionMask() to clip the relief to an admin boundary,
  // or null to restore the full square slab. The previous mask is disposed.
  setRegionMask(texture) {
    const prev = this.mapUniforms.uRegionMask.value
    if (texture) {
      if (prev !== texture) {
        this.mapUniforms.uRegionMask.value = texture
        if (prev && prev !== this._regionPlaceholder) prev.dispose()
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
      if (prev && prev !== this._regionPlaceholder) prev.dispose()
      this.mapUniforms.uRegionOn.value = 0
      this._regionImage = null
    }
  }

  // world XZ → region-mask coverage in [0,1] (1 = inside / no mask). uv = xz/T + 0.5
  regionSample(x, z) {
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

  setCoastMask(texture) {
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

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    // demExaggeration is the per-zoom value chosen in the UI (coarse blocks big)
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    this._h2ft = (h) => Math.round((h / scale + meanM) * 3.28084)

    const sDetail = new Simplex2(mulberry32(params.seed))
    const { size } = dem
    const { detail, detailScale } = params

    return (x, z) => {
      const px = (x / TERRAIN_SIZE + 0.5) * (size - 1)
      const py = (z / TERRAIN_SIZE + 0.5) * (size - 1)
      const raw = sampleDem(dem, px, py) // elevation in meters
      const h = (raw - meanM) * scale

      // optional fine grain on top of the (smoother) 30m-class data — but FADE it
      // out at/below sea level (elevation 0) so the displacement can never poke
      // above the waterline and paint phantom islands / stray coastlines
      const landFactor = smoothstep(0, 90, raw)
      const fine =
        landFactor *
        (detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
          detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5))
      // no basin carve in real-world mode — the map runs uninterrupted
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

  rebuild(params) {
    const res = params.resolution
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res)
    geo.rotateX(-Math.PI / 2)

    const sample = this._makeSampler(params)
    this.sample = sample

    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
    geo.computeVertexNormals()

    // vertex tint: height-graded value + slope darkening + grain jitter
    const colorRng = mulberry32(params.seed + 101)
    const sTint = new Simplex2(colorRng)
    const normals = geo.attributes.normal.array
    const colors = new Float32Array(count * 3)
    const span = Math.max(1e-5, maxH - minH)
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const h = arr[i * 3 + 1]
      const z = arr[i * 3 + 2]
      const ny = normals[i * 3 + 1]
      const hn = (h - minH) / span
      let v = lerp(0.62, 0.95, Math.pow(hn, 0.85))
      v *= lerp(0.78, 1.0, Math.pow(Math.max(0, ny), 0.6))
      v += fbm(sTint, x * 1.7, z * 1.7, 2, 2.2, 0.5) * 0.05
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.mapUniforms.uHeightRange.value.set(minH, maxH)

    // georeferenced sea level (elevation 0) — ALWAYS active in real mode so every
    // template gets a clear shoreline and consistent bathymetry, even where the
    // patch has no sub-sea data (then uSeaY simply sits below the terrain).
    if (params.source === 'real' && this.dem) {
      const demScale = (TERRAIN_SIZE / this.dem.extentMeters) * params.demExaggeration
      // fine-zoom tiles carry NO bathymetry: their sea is a flat plain at
      // exactly 0 m, which lands exactly ON uSeaY and paints as LAND (the
      // "black grainy sea" the dark templates expose). Lift the waterline a
      // touch over half a metre so a bathymetry-less sea still reads ocean;
      // real coastlines shift by an invisible ~0.6 m.
      const seaEps = Math.max(0.6 * demScale, 0.004)
      this.mapUniforms.uSeaY.value = (0 - this.dem.meanM) * demScale + seaEps
      this.mapUniforms.uSeaRange.value = Math.max((0 - this.dem.minM) * demScale, 1e-3)
      this._buildSeaMask()
    } else {
      this.mapUniforms.uSeaY.value = -9999
      this.mapUniforms.uSeaMaskOn.value = 0
    }

    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
  }

  // Flood-fill the real ocean from the DEM and upload it as a mask texture
  // (see sea-mask.js). Sampled in world XZ, same footprint as the region mask.
  _buildSeaMask() {
    const dem = this.dem
    if (!dem || !dem.data) {
      this.mapUniforms.uSeaMaskOn.value = 0
      return
    }
    const { mask, size } = blurMask(buildSeaMask(dem), 1)
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

  // Bake the elevation gradient (up to 8 stops) into a 1D ramp texture.
  rebuildRamp(params) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 1
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 256, 0)
    const stops = rampColorStops(params)
    for (const s of stops) grad.addColorStop(s.p, s.c)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    this.mapUniforms.uRampTex.value?.dispose()
    this.mapUniforms.uRampTex.value = tex
  }

  // Noise-driven roughness map (green channel is what three.js reads) + bump map
  // reused for micro relief that's finer than the vertex grid.
  rebuildRoughness(params) {
    // an opaque relief material (wood/fabric/carbon) OWNS the roughnessMap — and
    // for wood/fabric it's a shared cached texture. Never dispose/overwrite it on
    // a terrain regen, or the material breaks and the cached texture is destroyed.
    if (this.materialMode && this.materialMode !== 'glass') return
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
    this.material.bumpScale = params.bumpScale
    this.material.needsUpdate = true
  }

  updateMaterial(params) {
    this.material.color.set(params.color)
    this.material.envMapIntensity = params.envMapIntensity
    this.material.bumpScale = params.bumpScale
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
