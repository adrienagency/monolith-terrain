// REAL WATER (test) — a physically-flavoured ocean/lake surface that replaces
// the glass water when params.waterReal is on. Three requested behaviours:
//  · SHALLOWS are translucent — the seabed shows through, and animated sun
//    caustics ("rays through the water") play over them;
//  · DEPTHS darken and turn opaque (Beer-Lambert-ish colour ramp on depth);
//  · SEA STATE is a random 16-wave spectrum from the shared ocean-waves lib
//    (ocean-lab): two crossed systems (narrow swell + spread wind sea), deep
//    water dispersion, energy-weighted Gerstner steepness, jacobian breaking.
//    Height/choppiness/speed ride user sliders; a seed replays an exact sea.
// Depth comes from a small height+shore-distance field baked from the live
// terrain sampler at rebuild time: R = ground Y (scene units), G = distance
// to the nearest shore (normalised) — the fallback "depth" where the DEM
// carries no bathymetry (fine zooms) and for altitude lakes, whose beds are
// flat in the source data. Lakes reuse detectLakes() and get a per-lake
// coverage mask (A) + shore-distance (G) texture over their bounding box.
// Everything here is additive and disposable: turning the option off removes
// the meshes and restores the glass system untouched.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { detectLakes } from './lake.js'
// wave engine shared with ocean-lab (C:\Dev\ocean-lab) — the Vite alias
// resolves to the LIVE ocean-lab source when it's cloned next to this repo,
// to the committed src/vendor/ocean-waves copy otherwise (npm run sync:waves)
import { makeSeaState, seaStateToUniforms, GERSTNER_GLSL } from 'ocean-waves'

const FIELD_RES = 384 // height/shore field over the whole slab

// spectrum units → scene units: the sea state is authored in "spectrum
// metres" (dominant swell λ 12-24 m); at 0.12 scene units per metre the
// dominant wavelength lands at 1.4-2.9 scene units — the same band the old
// four-train Beaufort system used, tuned for the diorama read
// v39: 0.12 was "physically" scaled — the wind sea fell under the mesh grid
// (invisible: one single swell train read on screen) and the whole sea was
// too quiet. 0.42 is deliberately oversized: both crossed systems resolve,
// the sea reads COOL rather than realistic (Adrien's call).
const LEN_SCALE = 0.42
const SPEC_AMP_SUM = 1.5 // makeSeaState normalises the summed amplitude to this

// choppiness → the shading knobs the old Beaufort scale used to derive
function chopLook(c) {
  return { detail: 0.25 + 0.5 * c, foam: 0.15 + 0.25 * c, gloss: 240 - 130 * c }
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uWaveH;    // wave height (user slider), in spectrum metres
uniform float uChop;     // choppiness 0..1 (crest sharpening + breaking)
uniform float uSpeedMul; // time multiplier over the deep-water dispersion
uniform float uLenScale; // scene units per spectrum metre
uniform float uWaterY;
${GERSTNER_GLSL}
uniform sampler2D uField;   // R ground Y, G shore distance (slab-wide)
#ifdef IS_LAKE
uniform sampler2D uMask;    // A coverage, G shore distance (lake bbox)
uniform vec2 uMaskMin;
uniform vec2 uMaskSize;
#endif
varying vec3 vWorld;
varying vec3 vNorm;
varying float vCrest;
#include <fog_pars_vertex>

void main() {
  vec3 p = position; // geometry is authored in world XZ, y = 0
  vec2 xz = p.xz;

  // waves die out on the beach: fade by the local depth so a swell can never
  // wash over the coastline polygons
  vec2 uvF = xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  vec2 f = texture2D(uField, uvF).rg;
#ifdef IS_LAKE
  vec2 m = (xz - uMaskMin) / uMaskSize;
  float shoreD = texture2D(uMask, m).g;
#else
  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
#endif
  // v39: the view scaling moved into uLenScale (wavelength AND amplitude
  // together, constant steepness at every zoom — amplitude-only scaling made
  // soft shapeless mounds at wide zooms). uWaveScale is gone from the fade.
  float fade = smoothstep(0.0, 0.12, shoreD);

  // shared 16-wave random spectrum (ocean-waves lib): two crossed systems
  // (narrow swell + spread wind sea), energy-weighted Gerstner steepness,
  // breaking measured by the surface jacobian (crest ~1 = folding whitecap).
  // The shore fade rides inside: swell dies on the beach, never over land.
  vec3 nAcc;
  float crest;
  vec3 disp = oceanGerstner(xz, uTime, uWaveH, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
  p.xz += disp.xz;
  p.y += disp.y;
  vCrest = crest;
  vNorm = normalize(vec3(-nAcc.x, 1.0 - nAcc.y, -nAcc.z));
  vWorld = vec3(p.x, uWaterY + p.y, p.z);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  #ifdef USE_FOG
  vFogDepth = -mv.z;
  #endif
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform float uWaterY;
uniform float uDepthMax;
uniform float uGloss;
uniform float uDetail;
uniform float uFoam;
uniform float uCaustics;
uniform float uTransp; // user slider: 0 = milky, 1 = crystal
uniform float uSunFx;  // user slider: sun on the water, above AND below (glint + caustics)
uniform float uDayLight; // 0 nuit -> 1 jour (sunLook.dayLight) : la mer s'éteint la nuit
uniform sampler2D uField;
uniform float uHalf;     // rounded-square clip: half extent…
uniform float uCornerR;  // …and corner radius (sea only; lakes use the mask)
#ifdef IS_LAKE
uniform sampler2D uMask;
uniform vec2 uMaskMin;
uniform vec2 uMaskSize;
uniform float uLakeDepth;
#endif
varying vec3 vWorld;
varying vec3 vNorm;
varying float vCrest;
#include <fog_pars_fragment>

// small tiling value noise for ripples + foam breakup
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// sun caustics — the classic iterated-phase shimmer (Hoskins-style), cheap
// and convincing where the water is clear
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 3; n++) {
    float ft = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(ft - i.x) + sin(ft + i.y), sin(ft - i.y) + cos(ft + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + ft) / 0.6), p.y / (cos(i.y + ft) / 0.6)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 6.0), 0.0, 1.0);
}

void main() {
  vec2 xz = vWorld.xz;

#ifndef IS_LAKE
  // stay inside the slab's rounded footprint
  vec2 q = abs(xz) - vec2(uHalf - uCornerR);
  float sd = length(max(q, 0.0)) - uCornerR;
  if (sd > 0.0) discard;
#endif

  vec2 uvF = xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  vec2 f = texture2D(uField, uvF).rg;

#ifdef IS_LAKE
  vec2 m = (xz - uMaskMin) / uMaskSize;
  vec4 mask = texture2D(uMask, m);
  if (mask.a < 0.35) discard;
  float depth = mask.g * uLakeDepth;
  float shoreAA = smoothstep(0.35, 0.55, mask.a);
#else
  // real bathymetry when the tiles carry it; distance-to-shore as the stand-in
  // where the sea floor is a flat 0 m plain (fine zooms)
  float depth = max(uWaterY - f.r, f.g * 1.6);
  if (uWaterY - f.r < -0.005) discard; // land
  float shoreAA = smoothstep(0.0, 0.02, depth);
#endif
  float d01 = clamp(depth / uDepthMax, 0.0, 1.0);
  float dpow = pow(d01, 0.65);

  // ripple micro-normals on top of the Gerstner normal
  vec2 rp = xz * 6.0;
  float n1 = vnoise(rp + vec2(uTime * 0.9, 0.0));
  float n2 = vnoise(rp * 1.9 - vec2(0.0, uTime * 1.2));
  vec3 N = normalize(vNorm + uDetail * 0.6 * vec3(n1 - 0.5, 0.9, n2 - 0.5));

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);
  // ^5 not ^3: the softer curve painted flat pale "fresnel continents" in
  // rows across wave backs at F2-F3; the cap kills the same artefact on
  // steep F3 wave backs, where dot(N,V)→0 saturates any exponent
  float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);

  // depth-graded body colour: bright translucent shallows -> dark depths
  vec3 body = mix(uShallow, uDeep, dpow);
  // day/night: the water body darkens and cools at night (the daylight
  // palette painted a bright sea under a midnight sky — v39 feedback)
  body *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);

  // sun rays through the water — the star of the show. Additive-only caustics
  // vanish on pale palettes (white paper + white sun = nothing), so the rays
  // are painted with CONTRAST: the water body between filaments is pushed
  // darker, then bright sun-tinted filaments are layered on top — readable on
  // any template. A second, larger and slower layer thickens the net into
  // proper "rays". Reach extends well into mid-depths before fading.
  // scales tuned in the v37 visual loop: 2.0/0.8 read as blurry blobs (and
  // the slow layer produced a giant drifting blotch at plate scale); 4.0/1.8
  // resolve into an actual sunlight net
  float sunUp = clamp(L.y, 0.0, 1.0);
  float ca = caustic(xz * 4.0 + vec2(uTime * 0.06), uTime * 0.9);
  float ca2 = caustic(xz * 1.8 - vec2(uTime * 0.03), uTime * 0.45);
  float causNet = clamp(ca * 1.3 + ca2 * 0.45, 0.0, 1.5);
  float causReach = 1.0 - smoothstep(0.0, 0.9, d01); // still visible mid-depth
  float causMask = clamp(uCaustics * uSunFx, 0.0, 3.0) * causReach * sunUp * (0.05 + 0.95 * uDayLight);
  body = mix(body, body * 0.5, clamp(causMask, 0.0, 1.0) * (1.0 - clamp(causNet, 0.0, 1.0)) * 0.55);
  // capped: when the fast and slow layers coincide the additive burnt a
  // saturated white "splash" in the middle of the shallows
  body += uSunColor * min(causNet * causMask * 0.9, 0.85);

  // large-scale patchiness: without it the glitter and the whitecaps line up
  // in parallel rows along the dominant swell — the "repeating waves" flag
  // (named patchy: "patch" is a reserved word in GLSL and kills the compile)
  float patchy = smoothstep(0.32, 0.72, vnoise(xz * 0.33 + vec2(uTime * 0.015, -uTime * 0.011)));

  // sky reflection + sun glint (glint follows the same sun slider)
  vec3 col = mix(body, uSky, fres * 0.35);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uGloss) * (0.5 + 1.6 * fres);
  col += uSunColor * spec * uSunFx * (0.35 + 0.85 * patchy);

  // foam — shoreline wash always, whitecaps only when the wind says so.
  // Crest foam multiplies two noise octaves: single-octave thresholding made
  // rectangular "camo Tetris" patches on the crests (v37 visual loop finding)
  float foamNoise = vnoise(xz * 9.0 + vec2(uTime * 0.7, -uTime * 0.5));
  float foamNoise2 = foamNoise * vnoise(xz * 21.3 - vec2(uTime * 0.4, uTime * 0.6)) * 1.6;
  float shoreFoam = (1.0 - smoothstep(0.0, 0.10, depth)) * smoothstep(0.35, 0.75, foamNoise);
  // vCrest is the normalised breaking jacobian from the shared spectrum
  // (~1 where a crest folds) — intermittent by nature, only some waves break
  float crestFoam = uFoam * smoothstep(0.45, 0.85, vCrest) * smoothstep(0.45, 0.85, foamNoise2) * (0.25 + 0.75 * patchy);
  float foam = clamp(shoreFoam * 0.9 + crestFoam, 0.0, 1.0);
  col = mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam);

  // translucency: at uTransp 0 the water is SOLID PAINT — a pure depth-ramp
  // colour, no seabed, none of the milky coastal veil the old mix produced
  // (v38 feedback); from ~0.35 up the translucent behaviour takes over fully,
  // the slider then scaling how much of the seabed reads through.
  // v39: shallows start far clearer (0.28, was 0.62) — the opaque pale band
  // over coastal shelves clashed with the aerial imagery (Toulon screenshot);
  // the map/satellite now reads through the shallow water
  float alphaDepth = mix(0.28, 0.97, dpow);
  alphaDepth = max(alphaDepth, fres * 0.6);
  alphaDepth *= mix(1.1, 0.5, uTransp);
  float alpha = mix(1.0, clamp(alphaDepth, 0.0, 1.0), smoothstep(0.0, 0.35, uTransp));
  alpha = max(alpha, foam * 0.85);
  alpha = clamp(alpha, 0.05, 1.0) * shoreAA;

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`

// shallow leans hard into saturated lagoon turquoise and deep into navy —
// pale derivations disappeared entirely on light templates. Lerp weights
// were tuned live in the v37 visual loop (waterloop-10: coastal turquoise,
// dark open water, both surviving the templates' desaturation grade).
// The mix happens in sRGB: THREE stores colors in Linear-sRGB, where even
// 10% of a light base adds so much luminance that the "deep" navy came out
// two stops too bright and the whole sea rendered white-pastel.
function srgbMix(a, b, t) {
  const ca = new THREE.Color(a).convertLinearToSRGB()
  const cb = new THREE.Color(b).convertLinearToSRGB()
  return ca.lerp(cb, t).convertSRGBToLinear()
}
function waterColors(params) {
  const base = params.lakeColor ?? '#8fc6e8'
  return {
    shallow: srgbMix(base, '#2ac3b4', 0.55), // v39: less milky — the coastal shelf was a flat pale slab on aerial
    deep: srgbMix(base, '#0b3556', 0.9),
  }
}

function waterMaterial({ isLake, params, fieldTex }) {
  const { shallow, deep } = waterColors(params)
  const look = chopLook(params.seaChop ?? 0.7)
  const mat = new THREE.ShaderMaterial({
    name: isLake ? 'real-water-lake' : 'real-water-sea',
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    defines: isLake ? { IS_LAKE: 1 } : {},
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        // spectrum arrays are assigned AFTER creation (same clone rule as the
        // textures below) by RealWater._applySea()
        uWaveA: { value: [] },
        uWaveB: { value: [] },
        uWaveH: { value: params.seaWaveH ?? 0.8 },
        uChop: { value: params.seaChop ?? 0.7 },
        uSpeedMul: { value: (params.seaSpeed ?? 1) * 0.4 },
        uLenScale: { value: LEN_SCALE },
        uWaterY: { value: 0 },
        // textures are assigned AFTER creation: UniformsUtils.merge CLONES any
        // texture it finds, and the clone is what lands on the GPU — dispose()
        // on the original then never frees it (v37 review finding)
        uField: { value: null },
        uMask: { value: null },
        uMaskMin: { value: new THREE.Vector2() },
        uMaskSize: { value: new THREE.Vector2(1, 1) },
        uLakeDepth: { value: 1.15 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color('#fff3d6') },
        uShallow: { value: shallow },
        uDeep: { value: deep },
        uSky: { value: new THREE.Color('#cfe3f2') },
        uDepthMax: { value: 2.2 },
        uGloss: { value: look.gloss },
        uDetail: { value: look.detail },
        uFoam: { value: look.foam },
        uCaustics: { value: 2.4 },
        uDayLight: { value: 1 },
        uTransp: { value: params.waterTransparency ?? 0.4 },
        uSunFx: { value: params.waterSunFx ?? 1 },
        uHalf: { value: TERRAIN_SIZE / 2 },
        uCornerR: { value: 0.5 },
      },
    ]),
  })
  mat.uniforms.uField.value = fieldTex // post-merge assignment — no clone, dispose() works
  return mat
}

export class RealWater {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'real-water'
    scene.add(this.group)
    this.meshes = []
    this.materials = []
    this._textures = []
    this._time = 0
    this._surfaceVisible = true
  }

  // Bake the slab-wide height + shore-distance field from the live sampler.
  _bakeField(terrain, seaY) {
    const n = FIELD_RES
    const data = new Float32Array(n * n * 2)
    const water = new Uint8Array(n * n)
    for (let j = 0; j < n; j++) {
      const z = (j / (n - 1) - 0.5) * TERRAIN_SIZE
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * TERRAIN_SIZE
        const h = terrain.sample ? terrain.sample(x, z) : 0
        data[(j * n + i) * 2] = h
        water[j * n + i] = h < seaY ? 1 : 0
      }
    }
    // two-pass chamfer distance to the nearest land cell, in world units
    const cell = TERRAIN_SIZE / (n - 1)
    const INF = 1e9
    const dist = new Float32Array(n * n)
    for (let k = 0; k < n * n; k++) dist[k] = water[k] ? INF : 0
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + cell)
        if (j > 0) dist[k] = Math.min(dist[k], dist[k - n] + cell)
        if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - n - 1] + cell * 1.414)
      }
    for (let j = n - 1; j >= 0; j--)
      for (let i = n - 1; i >= 0; i--) {
        const k = j * n + i
        if (i < n - 1) dist[k] = Math.min(dist[k], dist[k + 1] + cell)
        if (j < n - 1) dist[k] = Math.min(dist[k], dist[k + n] + cell)
        if (i < n - 1 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n + 1] + cell * 1.414)
      }
    for (let k = 0; k < n * n; k++) data[k * 2 + 1] = Math.min(1, dist[k] / 2.5) // 2.5 world units = "offshore" (6 painted huge coastal halos)
    // half float: linear filtering is core WebGL2 (full float linear is an
    // optional extension); the ±20-unit height range fits half precision fine
    const half = new Uint16Array(n * n * 2)
    for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(data[k])
    const tex = new THREE.DataTexture(half, n, n, THREE.RGFormat, THREE.HalfFloatType)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }

  // Per-lake coverage (A) + shore-distance (G) mask over its dem bbox.
  _bakeLakeMask(lake) {
    const { cells, size } = lake
    let minX = size, maxX = 0, minY = size, maxY = 0
    for (const c of cells) {
      const x = c % size
      const y = (c / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const pad = 2
    minX = Math.max(0, minX - pad); maxX = Math.min(size - 1, maxX + pad)
    minY = Math.max(0, minY - pad); maxY = Math.min(size - 1, maxY + pad)
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const inside = new Uint8Array(w * h)
    for (const c of cells) {
      const x = c % size - minX
      const y = ((c / size) | 0) - minY
      inside[y * w + x] = 1
    }
    // chamfer distance to shore (in cells), normalised by the lake half-width
    const INF = 1e9
    const dist = new Float32Array(w * h)
    for (let k = 0; k < w * h; k++) dist[k] = inside[k] ? INF : 0
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i
        if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1)
        if (j > 0) dist[k] = Math.min(dist[k], dist[k - w] + 1)
      }
    for (let j = h - 1; j >= 0; j--)
      for (let i = w - 1; i >= 0; i--) {
        const k = j * w + i
        if (i < w - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1)
        if (j < h - 1) dist[k] = Math.min(dist[k], dist[k + w] + 1)
      }
    let maxD = 1
    for (let k = 0; k < w * h; k++) if (inside[k] && dist[k] < INF && dist[k] > maxD) maxD = dist[k]
    // one 3x3 box blur on the distance channel: at high uLakeDepth the raw
    // per-cell values band into visible pixel steps on big lakes
    const smooth = new Float32Array(w * h)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const jj = j + dj
            const ii = i + di
            if (jj < 0 || jj >= h || ii < 0 || ii >= w) continue
            sum += dist[jj * w + ii]
            n++
          }
        smooth[j * w + i] = sum / n
      }
    const data = new Uint8Array(w * h * 4)
    for (let k = 0; k < w * h; k++) {
      data[k * 4 + 1] = Math.round(255 * Math.min(1, smooth[k] / maxD)) // G shore distance
      data[k * 4 + 3] = inside[k] ? 255 : 0 // A coverage
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { tex, minX, minY, w, h }
  }

  _clear() {
    for (const m of this.meshes) {
      m.geometry.dispose()
      this.group.remove(m)
    }
    for (const mat of this.materials) mat.dispose()
    for (const t of this._textures) t.dispose()
    this.meshes = []
    this.materials = []
    this._textures = []
    this._seaMesh = null
  }

  // (Re)build for the current zone. Cheap no-op when the option is off.
  rebuild({ terrain, params }) {
    this._clear()
    if (!params.waterReal || params.source !== 'real' || !terrain.dem) return

    const seaY = terrain.mapUniforms.uSeaY.value
    const fieldTex = this._bakeField(terrain, seaY > -9000 ? seaY : -1e9)
    this._textures.push(fieldTex)

    const demScale = (TERRAIN_SIZE / terrain.dem.extentMeters) * params.demExaggeration
    // wave amplitude follows the VIEW SCALE: at a 20 km bay the swell reads,
    // at a 500 km continental view the same scene-unit swell would be a
    // 30 m monster — the sea (and the lakes) calm as you zoom out
    this._waveScale = Math.min(1, Math.max(0.15, demScale / 0.008))
    this._waveH = params.seaWaveH ?? 0.5

    // random sea state (shared ocean-waves spectrum) — a saved seed replays
    // the exact same sea (share-links), 0/undefined draws a fresh one
    this._sea = makeSeaState(params.seaSeed || undefined)

    // --- open sea (skip in region mode: the plate replaces the ocean there)
    if (seaY > -9000 && !params.regionMode) {
      // the surface rides ~2 m above the coastline plus the CURRENT swell
      // amplitude, so a trough can never dip through the flat marine plain
      // (the v37 "fresnel continents" were mostly this poke-through) — yet
      // the lift stays metres in real terms: a fixed scene-unit lift flooded
      // tens of metres of lowland at continental zooms (Baltic screenshot)
      this._seaBase = seaY + Math.max(2 * demScale, 0.003)
      const seaLift = this._seaLift()
      const mat = waterMaterial({ isLake: false, params, fieldTex })
      mat.uniforms.uWaterY.value = seaLift
      mat.uniforms.uLenScale.value = LEN_SCALE * this._waveScale
      // depth budget: with real bathymetry the ramp can span a deep column;
      // fine-zoom tiles have none (flat 0 m sea) — there depth is the capped
      // shore-distance proxy, and a 2.2 budget means nothing ever reads deep.
      // The test lives in SCENE units: -68 m of DEM bathy at z11 is only
      // ~0.014 scene units — metres said "deep column", the render said no.
      const bathyScene = (0 - terrain.dem.minM) * demScale
      mat.uniforms.uDepthMax.value = bathyScene > 1.0 ? 2.2 : 0.75
      const r = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE))
      mat.uniforms.uHalf.value = (TERRAIN_SIZE / 2) * 0.998
      mat.uniforms.uCornerR.value = r
      const seg = 256
      const geo = new THREE.PlaneGeometry(TERRAIN_SIZE * 0.998, TERRAIN_SIZE * 0.998, seg, seg)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, mat)
      // geometry is authored in world XZ at y=0; the mesh lifts it to sea level
      mesh.position.set(0, seaLift, 0)
      // above the draped OSM water polygons (17) so harbours read UNDER the
      // animated surface (through its transparency), below GPX markers (21+)
      mesh.renderOrder = 18
      mesh.frustumCulled = false // vertex waves move it; the slab is always on screen anyway
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
      this._seaMesh = mesh // setWaves re-seats the surface when the swell grows
    }

    // --- altitude lakes
    const dem = terrain.dem
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    for (const lake of detectLakes(dem)) {
      const { tex, minX, minY, w, h } = this._bakeLakeMask(lake)
      this._textures.push(tex)
      const yLake = (lake.elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6 + 0.025
      const toWorld = (g, n) => (g / (n - 1) - 0.5) * TERRAIN_SIZE
      const size = lake.size
      const x0 = toWorld(minX, size)
      const z0 = toWorld(minY, size)
      const x1 = toWorld(minX + w - 1, size)
      const z1 = toWorld(minY + h - 1, size)
      const mat = waterMaterial({ isLake: true, params, fieldTex })
      mat.uniforms.uWaterY.value = yLake
      mat.uniforms.uLenScale.value = LEN_SCALE * this._waveScale * 0.5
      mat.uniforms.uMask.value = tex
      mat.uniforms.uMaskMin.value.set(x0, z0)
      mat.uniforms.uMaskSize.value.set(Math.max(1e-4, x1 - x0), Math.max(1e-4, z1 - z0))
      mat.uniforms.uDepthMax.value = 0.9
      const segX = Math.max(12, Math.min(80, Math.round((x1 - x0) * 6)))
      const segZ = Math.max(12, Math.min(80, Math.round((z1 - z0) * 6)))
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ)
      geo.rotateX(-Math.PI / 2)
      geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = yLake
      mesh.renderOrder = 18 // same rule as the sea: over the draped OSM water
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
    }
    this._applySea()
    this.group.visible = this._surfaceVisible
  }

  // push the current spectrum into every material (arrays are assigned
  // post-creation: UniformsUtils.merge would clone them at build time)
  _applySea() {
    if (this._sea) {
      const u = seaStateToUniforms(this._sea)
      for (const mat of this.materials) {
        mat.uniforms.uWaveA.value = u.a
        mat.uniforms.uWaveB.value = u.b
      }
    }
    if (this._sunState) this.setSunState(this._sunState)
  }

  // day/night state from the shared sunLook palette (applyTimeOfDay pushes it)
  setSunState(s) {
    this._sunState = s
    for (const mat of this.materials) {
      mat.uniforms.uDayLight.value = s.dayLight ?? 1
      if (s.skyHex) mat.uniforms.uSky.value.set(s.skyHex)
    }
  }

  // live look change — colour, transparency and sun sliders, no rebuild needed
  setLook(params) {
    const { shallow, deep } = waterColors(params)
    for (const mat of this.materials) {
      mat.uniforms.uShallow.value.copy(shallow)
      mat.uniforms.uDeep.value.copy(deep)
      mat.uniforms.uTransp.value = params.waterTransparency ?? 0.4
      mat.uniforms.uSunFx.value = params.waterSunFx ?? 1
    }
  }

  // the sea's resting height: base + the spectrum's summed amplitude in scene
  // units, so the deepest trough still clears the flat marine plain
  _seaLift() {
    const amp = SPEC_AMP_SUM * LEN_SCALE * (this._waveScale ?? 1) * (this._waveH ?? 0.8)
    return (this._seaBase ?? 0) + amp + 0.002
  }

  _reseat() {
    if (!this._seaMesh) return
    const lift = this._seaLift()
    this._seaMesh.position.y = lift
    this._seaMesh.material.uniforms.uWaterY.value = lift
  }

  // live wave change (UI sliders) — no rebuild needed
  setWaves({ height, choppiness, speed } = {}) {
    for (const mat of this.materials) {
      if (height !== undefined) mat.uniforms.uWaveH.value = height
      if (choppiness !== undefined) {
        mat.uniforms.uChop.value = choppiness
        const l = chopLook(choppiness)
        mat.uniforms.uDetail.value = l.detail
        mat.uniforms.uFoam.value = l.foam
        mat.uniforms.uGloss.value = l.gloss
      }
      if (speed !== undefined) mat.uniforms.uSpeedMul.value = speed * 0.4
    }
    if (height !== undefined) {
      this._waveH = height
      this._reseat()
    }
  }

  // replay a given sea state (share-links) / draw a brand-new random one
  setSeed(seed) {
    this._sea = makeSeaState(seed)
    this._applySea()
    return this._sea.seed
  }

  reseed() {
    return this.setSeed((Math.random() * 2 ** 31) | 0)
  }

  update(dt, sun) {
    if (!this.meshes.length) return
    this._time += dt
    const dir = sun ? sun.position.clone().normalize() : null
    for (const mat of this.materials) {
      mat.uniforms.uTime.value = this._time
      if (dir) mat.uniforms.uSunDir.value.copy(dir)
      if (sun) mat.uniforms.uSunColor.value.copy(sun.color)
    }
  }

  setVisible(v) {
    this._surfaceVisible = v
    this.group.visible = v && this.meshes.length > 0
  }

  dispose() {
    this._clear()
  }
}
