// REAL WATER (test) — a physically-flavoured ocean/lake surface that replaces
// the glass water when params.waterReal is on. Three requested behaviours:
//  · SHALLOWS are translucent — the seabed shows through, and animated sun
//    caustics ("rays through the water") play over them;
//  · DEPTHS darken and turn opaque (Beer-Lambert-ish colour ramp on depth);
//  · SEA STATE follows the Beaufort wind scale F1..F12 — four Gerstner waves
//    (GPU Gems 1 ch.1, the same maths jbouny/ocean uses) whose amplitude,
//    wavelength, speed, chop, glint and whitecap foam all derive from the
//    force. F1 is oily calm, F12 is a hurricane sea.
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

const FIELD_RES = 384 // height/shore field over the whole slab

// ---------------------------------------------------------- Beaufort scale
// One wind force (1..3) → every wave/shading parameter. The scale stops at
// F3 by design: past that the sea stopped reading as a quiet diorama
// (Adrien's call) — F1 oily calm, F2 light ripples, F3 lively wavelets with
// the first scattered whitecaps.
export function beaufortParams(force) {
  const t = Math.min(1, Math.max(0, (force - 1) / 2))
  return {
    amp: 0.005 + 0.02 * Math.pow(t, 1.3), // dominant wave amplitude budget — F3 kept gentle, steep backs bred fresnel plates
    len: 1.6 + 1.6 * t, // dominant wavelength
    speed: 0.22 + 0.55 * t,
    chop: 0.15 + 0.4 * t, // Gerstner Q — a touch of crest at F3
    detail: 0.25 + 0.5 * t, // micro-normal ripple strength
    foam: 0.2 * t, // first scattered whitecaps at F3
    gloss: 240 - 130 * t,
  }
}

const VERT = /* glsl */ `
uniform float uTime;
uniform vec4 uAmp;   // per-wave amplitude
uniform vec4 uLen;   // per-wave wavelength
uniform vec4 uSpd;   // per-wave phase speed
uniform float uChop;
uniform vec2 uDirs[4];
uniform float uWaveScale;   // lakes ride smaller waves than the open sea
uniform float uWaterY;
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
  float fade = smoothstep(0.0, 0.12, shoreD) * uWaveScale;

  float dy = 0.0;
  vec2 dxz = vec2(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  for (int i = 0; i < 4; i++) {
    float a = (i == 0 ? uAmp.x : i == 1 ? uAmp.y : i == 2 ? uAmp.z : uAmp.w) * fade;
    float L = (i == 0 ? uLen.x : i == 1 ? uLen.y : i == 2 ? uLen.z : uLen.w);
    float s = (i == 0 ? uSpd.x : i == 1 ? uSpd.y : i == 2 ? uSpd.z : uSpd.w);
    vec2 d = uDirs[i];
    float k = 6.28318 / max(L, 1e-3);
    float ph = dot(d, xz) * k + uTime * s * k;
    float c = cos(ph);
    float si = sin(ph);
    dy += a * si;
    dxz += uChop * a * d * c;
    // analytic Gerstner normal accumulation
    n.x -= d.x * a * k * c;
    n.z -= d.y * a * k * c;
    crest += si * (a / max(uAmp.x, 1e-4));
  }
  p.xz += dxz;
  p.y += dy;
  vCrest = crest;
  vNorm = normalize(n);
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
  float causMask = clamp(uCaustics * uSunFx, 0.0, 3.0) * causReach * sunUp;
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
  float crestFoam = uFoam * smoothstep(0.62, 0.98, vCrest * 0.5 + 0.5) * smoothstep(0.45, 0.85, foamNoise2) * (0.25 + 0.75 * patchy);
  float foam = clamp(shoreFoam * 0.9 + crestFoam, 0.0, 1.0);
  col = mix(col, vec3(0.96), foam);

  // translucency: at uTransp 0 the water is SOLID PAINT — a pure depth-ramp
  // colour, no seabed, none of the milky coastal veil the old mix produced
  // (v38 feedback); from ~0.35 up the translucent behaviour takes over fully,
  // the slider then scaling how much of the seabed reads through
  float alphaDepth = mix(0.62, 0.97, dpow);
  alphaDepth = max(alphaDepth, fres * 0.6);
  alphaDepth *= mix(1.1, 0.5, uTransp);
  float alpha = mix(1.0, clamp(alphaDepth, 0.0, 1.0), smoothstep(0.0, 0.35, uTransp));
  alpha = max(alpha, foam * 0.85);
  alpha = clamp(alpha, 0.05, 1.0) * shoreAA;

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`

function makeWaveUniforms(force) {
  const w = beaufortParams(force)
  const amps = [0.42, 0.28, 0.18, 0.12].map((r) => r * w.amp)
  const lens = [1, 0.52, 0.28, 0.16].map((r) => r * w.len)
  const spds = lens.map((L) => w.speed * Math.sqrt(L / lens[0]))
  return { w, amps, lens, spds }
}

// four wave trains spread over a wide fan (a cross-sea): tightly-grouped
// headings made every crest line up in parallel rows across the whole map —
// the "repeating waves" the client flagged
const WAVE_HEADINGS = [0.7, 2.05, -0.55, 3.3].map((a) => new THREE.Vector2(Math.cos(a), Math.sin(a)))

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
    shallow: srgbMix(base, '#2ac3b4', 0.75),
    deep: srgbMix(base, '#0b3556', 0.9),
  }
}

function waterMaterial({ isLake, params, fieldTex }) {
  const { shallow, deep } = waterColors(params)
  const { w, amps, lens, spds } = makeWaveUniforms(Math.min(3, Math.max(1, params.waterWind ?? 2)))
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
        uAmp: { value: new THREE.Vector4(...amps) },
        uLen: { value: new THREE.Vector4(...lens) },
        uSpd: { value: new THREE.Vector4(...spds) },
        uChop: { value: w.chop },
        uDirs: { value: WAVE_HEADINGS },
        uWaveScale: { value: isLake ? 0.5 : 1 },
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
        uGloss: { value: w.gloss },
        uDetail: { value: w.detail },
        uFoam: { value: w.foam },
        uCaustics: { value: 2.4 },
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

    // --- open sea (skip in region mode: the plate replaces the ocean there)
    if (seaY > -9000 && !params.regionMode) {
      // the surface rides ~2 m above the coastline plus the CURRENT swell
      // amplitude, so a trough can never dip through the flat marine plain
      // (the v37 "fresnel continents" were mostly this poke-through) — yet
      // the lift stays metres in real terms: a fixed scene-unit lift flooded
      // tens of metres of lowland at continental zooms (Baltic screenshot)
      this._seaBase = seaY + Math.max(2 * demScale, 0.003)
      const seaLift = this._seaLift(params.waterWind ?? 2)
      const mat = waterMaterial({ isLake: false, params, fieldTex })
      mat.uniforms.uWaterY.value = seaLift
      mat.uniforms.uWaveScale.value = this._waveScale
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
      const seg = 220
      const geo = new THREE.PlaneGeometry(TERRAIN_SIZE * 0.998, TERRAIN_SIZE * 0.998, seg, seg)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, mat)
      // geometry is authored in world XZ at y=0; the mesh lifts it to sea level
      mesh.position.set(0, seaLift, 0)
      mesh.renderOrder = 4
      mesh.frustumCulled = false // vertex waves move it; the slab is always on screen anyway
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
      this._seaMesh = mesh // setWind re-seats the surface when the swell grows
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
      mat.uniforms.uWaveScale.value = 0.5 * this._waveScale
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
      mesh.renderOrder = 4
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
    }
    this.group.visible = this._surfaceVisible
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

  // the sea's resting height for a given wind: base + the swell's amplitude,
  // so the deepest trough still clears the flat marine plain
  _seaLift(force) {
    const f = Math.min(3, Math.max(1, force ?? 2))
    return (this._seaBase ?? 0) + beaufortParams(f).amp * (this._waveScale ?? 1) + 0.002
  }

  // live Beaufort change — no rebuild needed
  setWind(force) {
    const { w, amps, lens, spds } = makeWaveUniforms(Math.min(3, Math.max(1, force)))
    for (const mat of this.materials) {
      mat.uniforms.uAmp.value.set(...amps)
      mat.uniforms.uLen.value.set(...lens)
      mat.uniforms.uSpd.value.set(...spds)
      mat.uniforms.uChop.value = w.chop
      mat.uniforms.uGloss.value = w.gloss
      mat.uniforms.uDetail.value = w.detail
      mat.uniforms.uFoam.value = w.foam
    }
    if (this._seaMesh) {
      const lift = this._seaLift(force)
      this._seaMesh.position.y = lift
      this._seaMesh.material.uniforms.uWaterY.value = lift
    }
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
