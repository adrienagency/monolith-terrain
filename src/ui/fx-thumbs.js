// Runtime-rendered vignettes for the Fancy surface shaders (src/fx-meta.js).
// These effects are pure procedural GLSL (`surfaceFx()` in src/terrain.js) —
// rather than maintaining a folder of static PNGs, each effect is rendered
// once to a tiny offscreen WebGL canvas, cached as a PNG data URL, and handed
// back async. Adding an id to FX_META/FX_LIST is enough to get a thumbnail —
// nothing else to touch here.
//
// NOTE: the fragment shader below is a small, unlit, standalone mirror of the
// `surfaceFx()` switch in src/terrain.js (search "vec3 surfaceFx" there). It
// intentionally does not depend on the full terrain material (lighting, relief
// geometry, blend modes) — a still vignette only needs the raw colour field.
// If you add a new effect id to FX_META, add its case here too.

import * as THREE from 'three'
import { defaultFxParams } from '../fx-meta.js'

const SIZE = 160 // offscreen render resolution — bigger than any real vignette; CSS downsamples

const VERT = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// mirrors src/terrain.js: fxHash → fxNoise → fxFbm → fxGrad3 → fxRot → fxBayer
// → fxVoro → fxNeuro → fxThermal → surfaceFx. No lighting/blend plumbing —
// this only ever renders a flat still frame.
const FRAG = `varying vec2 vUv;
uniform int uId;
uniform float uFxTime, uFxScale, uFxP1, uFxP2, uFxP3;
uniform vec3 uFxColA, uFxColB, uFxColC;

float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 fxHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), u.x),
             mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fxFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * fxNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 fxGrad3(float t, vec3 a, vec3 b, vec3 c) { t = clamp(t, 0.0, 1.0); return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0); }
vec2 fxRot(vec2 v, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * v; }
float fxBayer(vec2 q) {
  vec2 c = floor(mod(q, 4.0)); int idx = int(c.x + c.y * 4.0);
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  float r = 0.5; for (int k = 0; k < 16; k++) { if (k == idx) r = (m[k] + 0.5) / 16.0; } return r;
}
float fxVoro(vec2 p, float t) {
  vec2 n = floor(p), f = fract(p); float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = fxHash2(n + g);
    o = 0.5 + 0.5 * sin(t + 6.2831 * o); vec2 r = g + o - f; md = min(md, dot(r, r));
  }
  return sqrt(md);
}
float fxNeuro(vec2 uv, float t) {
  vec2 sa = vec2(0.0); vec2 res = vec2(0.0); float scale = 8.0;
  for (int j = 0; j < 15; j++) {
    uv = fxRot(uv, 1.0); sa = fxRot(sa, 1.0);
    vec2 layer = uv * scale + float(j) + sa - t;
    sa += sin(layer); res += (0.5 + 0.5 * cos(layer)) / scale; scale *= 1.2;
  }
  return res.x + res.y;
}
vec3 fxThermal(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.0, 0.02, 0.12), vec3(0.35, 0.0, 0.5), smoothstep(0.0, 0.28, t));
  c = mix(c, vec3(0.86, 0.11, 0.12), smoothstep(0.22, 0.52, t));
  c = mix(c, vec3(1.0, 0.6, 0.0), smoothstep(0.48, 0.72, t));
  c = mix(c, vec3(1.0, 0.95, 0.45), smoothstep(0.68, 0.9, t));
  c = mix(c, vec3(1.0), smoothstep(0.9, 1.0, t));
  return c;
}
vec3 surfaceFx(int id, vec2 p, float t) {
  p *= uFxScale;
  if (id == 1) { float w = fxFbm(p * 0.6 + vec2(t * 0.1, -t * 0.07)); return fxGrad3(w, uFxColA, uFxColB, uFxColC); }
  if (id == 2) { float w = fxFbm(p * 0.9 + t * 0.1); float g = (fxNoise(p * 40.0) - 0.5) * uFxP1; return fxGrad3(w, uFxColA, uFxColB, uFxColC) + g; }
  if (id == 3) { float v = fxFbm(p * 0.8 + t * 0.08); float b = fxBayer(p * (4.0 + uFxP1 * 14.0)); return mix(uFxColA, uFxColB, step(b, v)); }
  if (id == 4) { float v = fxVoro(p * (0.8 + uFxP1 * 2.0), t); return mix(uFxColB, uFxColA, smoothstep(0.0, 0.04 + uFxP2 * 0.3, v)); }
  if (id == 5) { vec2 q = p; for (int i = 0; i < 3; i++) { q += 0.4 * vec2(fxFbm(q + vec2(0.0, 0.0) + t * 0.1), fxFbm(q + vec2(5.2, 1.3) - t * 0.1)); } return fxGrad3(fxFbm(q * 0.5), uFxColA, uFxColB, uFxColC); }
  if (id == 6) { float w = sin(p.x * (1.0 + uFxP1 * 5.0) + (0.5 + uFxP2 * 2.0) * sin(p.y * 1.3 + t)); return mix(uFxColA, uFxColB, smoothstep(-0.12, 0.12, w)); }
  if (id == 7) { float a = atan(p.y, p.x); float r = length(p); float w = sin(a * (2.0 + uFxP1 * 8.0) + r * 1.5 - t * 1.2); return fxGrad3(0.5 + 0.5 * w, uFxColA, uFxColB, uFxColC); }
  if (id == 8) { float a = atan(p.y, p.x); float r = length(p); float s = sin(a * (2.0 + uFxP1 * 6.0) + log(r + 1.0) * 6.0 - t * 1.5); return mix(uFxColA, uFxColB, smoothstep(0.0, 0.2, s)); }
  if (id == 9) { float m2 = 0.0; int nb = int(3.0 + uFxP1 * 9.0); for (int i = 0; i < 12; i++) { if (i >= nb) break; float fi = float(i);
      vec2 c = 1.6 * vec2(sin(t * 0.5 + fi * 1.7), cos(t * 0.4 + fi * 2.3)); m2 += (0.2 + uFxP2 * 0.4) / (0.05 + dot(p - c, p - c)); }
    return mix(uFxColA, uFxColB, smoothstep(1.0, 2.2, m2)); }
  if (id == 10) { float a = atan(p.y, p.x); float r = length(p);
    float rays = 0.5 + 0.5 * sin(a * (8.0 + uFxP1 * 34.0) + fxNoise(vec2(a * 3.0, t * 0.3)) * 4.0); float glow = exp(-r * 0.4);
    return mix(uFxColA, uFxColB, rays * glow); }
  if (id == 11) { vec2 g = fract(p * (2.0 + uFxP1 * 4.0)) - 0.5; float d = length(g); float dv = 1.0 - smoothstep(0.16 + uFxP2 * 0.1, 0.23 + uFxP2 * 0.1, d); return mix(uFxColA, uFxColB, dv); }
  if (id == 12) { float n = fxFbm(p * 0.8 + t * 0.06); return fxGrad3(n, uFxColA, uFxColB, uFxColC); }
  if (id == 13) { float n = fxNeuro(p * 0.9, t * 0.5);
    n = (1.0 + uFxP1 * 2.0) * n * n; n = pow(n, 0.7 + 6.0 * uFxP2); n = min(1.4, n);
    float blend = smoothstep(0.7, 1.4, n);
    return mix(uFxColC, mix(uFxColB, uFxColA, blend), min(n, 1.0)); }
  if (id == 14) { float h = fxFbm(p * (0.5 + uFxP3 * 1.5) + t * 0.15) * 0.65 + 0.35 * (0.5 + 0.5 * sin(t + p.x));
    vec3 th = fxThermal(h * (0.7 + uFxP1)); float band = smoothstep(0.45, 0.5, fract(h * (4.0 + uFxP2 * 24.0)));
    return mix(th, th * 0.55, band * uFxP2); }
  return vec3(0.5);
}
vec3 toSRGB(vec3 c) { return mix(1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, c * 12.92, step(c, vec3(0.0031308))); }
void main() {
  vec2 p = (vUv - 0.5) * 5.0;
  vec3 c = surfaceFx(uId, p, uFxTime);
  gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
}`

let renderer, mesh
function ensure() {
  if (renderer) return
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(SIZE, SIZE, false)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uId: { value: 0 },
      uFxTime: { value: 1.4 }, // a fixed, arbitrary-but-pleasant frame — a still vignette, not an animation
      uFxScale: { value: 1 },
      uFxP1: { value: 0.5 },
      uFxP2: { value: 0.5 },
      uFxP3: { value: 0.5 },
      uFxColA: { value: new THREE.Vector3() },
      uFxColB: { value: new THREE.Vector3() },
      uFxColC: { value: new THREE.Vector3() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  })
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  scene.add(mesh)
  renderer.__scene = scene
  renderer.__camera = camera
}

// #rrggbb → linear-space vec3 (matches THREE.Color's default sRGB-in colour
// management, which is what the terrain material's uFxCol* uniforms use)
function hexToLinear(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const s = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return [s(((n >> 16) & 255) / 255), s(((n >> 8) & 255) / 255), s((n & 255) / 255)]
}

function render(id) {
  ensure()
  const d = defaultFxParams()[id]
  const u = mesh.material.uniforms
  u.uId.value = id
  u.uFxScale.value = d.scale
  u.uFxP1.value = d.p1
  u.uFxP2.value = d.p2
  u.uFxP3.value = d.p3
  u.uFxColA.value.set(...hexToLinear(d.colA))
  u.uFxColB.value.set(...hexToLinear(d.colB))
  u.uFxColC.value.set(...hexToLinear(d.colC))
  renderer.render(renderer.__scene, renderer.__camera)
  return renderer.domElement.toDataURL('image/png')
}

const cache = new Map() // id -> data URL
const waiters = new Map() // id -> callback[]
const queue = []
let pumpScheduled = false

function schedule(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 300 })
  else setTimeout(fn, 0)
}

function pump() {
  pumpScheduled = false
  const id = queue.shift()
  if (id == null) return
  const url = render(id)
  cache.set(id, url)
  for (const cb of waiters.get(id) || []) cb(url)
  waiters.delete(id)
  if (queue.length && !pumpScheduled) { pumpScheduled = true; schedule(pump) }
}

// lazy + async: never blocks panel construction — one render per idle tick
export function requestFxThumb(id, cb) {
  if (cache.has(id)) { cb(cache.get(id)); return }
  if (!waiters.has(id)) waiters.set(id, [])
  waiters.get(id).push(cb)
  if (!queue.includes(id)) queue.push(id)
  if (!pumpScheduled) { pumpScheduled = true; schedule(pump) }
}
