// Runtime-rendered vignettes for the Fancy surface shaders (src/fx-meta.js).
// These effects are pure procedural GLSL — rather than maintaining a folder of
// static PNGs, each effect is rendered once to a tiny offscreen WebGL canvas,
// cached as a PNG data URL, and handed back async. Adding an id to FX_META is
// enough to get a thumbnail: nothing to touch here, and no binary in the repo.
//
// The effect GLSL is IMPORTED from src/fx-glsl.js — the exact string the
// terrain material compiles. It used to be hand-copied into this file, which
// made the panel a silent liar: change an effect in terrain.js and the vignette
// would keep advertising the old one, with no test failing anywhere. One
// source, so a vignette cannot disagree with what the map actually draws.
//
// The wrapper below stays deliberately standalone — unlit, no relief geometry,
// no blend modes; a still vignette only needs the raw colour field. It only has
// to declare the uFx* uniforms FX_GLSL reads.

import * as THREE from 'three'
import { defaultFxParams } from '../fx-meta.js'
import { FX_GLSL } from '../fx-glsl.js'

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

${FX_GLSL}
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
