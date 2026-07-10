// GLOBE CLOUDS — a sparse satellite-style cloud cover for the orbital view.
// One translucent sphere shell floats ~1.5% above the terrain radius, wearing
// a procedural equirect texture baked once on the CPU: fbm noise sampled ON
// the unit sphere (so the wrap is seamless in longitude and pole-safe) with a
// latitude profile that mimics real circulation — a bright ITCZ band at the
// equator, mid-latitude storm tracks, clearer subtropical belts. The shell
// slowly rotates (its own orbit) and the shader adds a whisper of internal
// drift so the cover never reads as a rigid decal. Coverage stays around 40%,
// edges soft, whites shaded by the same sun curve the globe tiles use, so the
// vintage-map look survives intact.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

const TEX_W = 512
const TEX_H = 256
const ROT_SPEED = 0.0032 // rad/s — one lap in ~half an hour of orbit time

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN;
uniform sampler2D uTex;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uFade;

void main() {
  // primary cover drifts east very slowly; a counter-drifting second sample
  // modulates it so the interior churns instead of sliding as one sheet
  vec2 uvA = vec2(vUv.x + uTime * 0.00025, vUv.y);
  vec2 uvB = vec2(vUv.x - uTime * 0.00015 + 0.37, vUv.y);
  vec4 a = texture2D(uTex, uvA);
  vec4 b = texture2D(uTex, uvB);
  float alpha = a.a * mix(0.72, 1.0, b.a);

  // same soft sun curve as the globe tiles, so the shell belongs to the map
  float diff = max(dot(normalize(vN), uSunDir), 0.0);
  vec3 col = a.rgb * (0.74 + 0.30 * diff);

  gl_FragColor = vec4(col, alpha * 0.78 * uFade);
}
`

function smoothstep01(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
  return t * t * (3 - 2 * t)
}

// bake the equirect RGBA cloud map — called lazily (idle callback) so app
// startup never pays for it
function bakeCloudTexture() {
  const noise = new ImprovedNoise()
  const fbm = (x, y, z, oct) => {
    let amp = 0.5
    let freq = 1
    let sum = 0
    for (let o = 0; o < oct; o++) {
      sum += amp * noise.noise(x * freq, y * freq, z * freq)
      amp *= 0.5
      freq *= 2.03
    }
    return sum
  }

  const data = new Uint8Array(TEX_W * TEX_H * 4)
  for (let j = 0; j < TEX_H; j++) {
    const lat = (0.5 - (j + 0.5) / TEX_H) * Math.PI // +90° (row 0) → -90°
    const cosLat = Math.cos(lat)
    const sinLat = Math.sin(lat)
    const absDeg = Math.abs((lat * 180) / Math.PI)
    // circulation profile: ITCZ at the equator, storm tracks near 52°,
    // subtropical clear belts near 24°
    const band =
      0.3 * Math.exp((-absDeg * absDeg) / 162) +
      0.32 * Math.exp((-(absDeg - 52) * (absDeg - 52)) / 512) -
      0.3 * Math.exp((-(absDeg - 24) * (absDeg - 24)) / 200)

    for (let i = 0; i < TEX_W; i++) {
      const lon = ((i + 0.5) / TEX_W) * Math.PI * 2
      const px = cosLat * Math.sin(lon)
      const py = sinLat
      const pz = cosLat * Math.cos(lon)
      // large synoptic banks plus billowy detail, both sampled on the sphere
      // so the equirect texture wraps with no seam and no pole pinch artifacts
      const banks = fbm(px * 2.1 + 13.7, py * 2.1 + 7.3, pz * 2.1 + 5.1, 3)
      const detail = fbm(px * 6.4 + 3.1, py * 6.4 + 9.2, pz * 6.4 + 1.7, 4)
      const d = banks * 0.9 + detail * 0.6 + band * 0.5

      const alpha = smoothstep01(0.12, 0.4, d) // ~40% coverage, soft edges
      const core = smoothstep01(0.28, 0.62, d) // thick centers read brighter
      const k = (j * TEX_W + i) * 4
      const v = Math.round(206 + 44 * core)
      data[k] = v
      data[k + 1] = v
      data[k + 2] = Math.round(v * 0.985) // hint of warm ivory, fits the paper look
      data[k + 3] = Math.round(alpha * 255)
    }
  }

  const tex = new THREE.DataTexture(data, TEX_W, TEX_H, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping // shader drifts uv.x
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true // 512x256 is POT; mips are fine on plain RGBA8
  tex.needsUpdate = true
  return tex
}

export class GlobeClouds {
  constructor(radius) {
    this.radius = radius
    this.group = new THREE.Group()
    this.group.name = 'globe-clouds'

    // 1x1 transparent placeholder until the idle bake lands
    const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1, THREE.RGBAFormat)
    placeholder.needsUpdate = true
    this._placeholder = placeholder

    this.uniforms = {
      uTex: { value: placeholder },
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.5).normalize() },
      uTime: { value: 0 },
      uFade: { value: 1 },
    }

    const geo = new THREE.SphereGeometry(radius * 1.015, 96, 64)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.name = 'cloud-shell'
    this.mesh.renderOrder = 2 // after the atmosphere rim
    this.group.add(this.mesh)

    const bake = () => {
      if (this._disposed) return
      this._texture = bakeCloudTexture()
      this.uniforms.uTex.value = this._texture
      placeholder.dispose()
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(bake, { timeout: 4000 })
    else setTimeout(bake, 0)
  }

  setSunDir(v) {
    this.uniforms.uSunDir.value.copy(v).normalize()
  }

  setVisible(v) {
    this.group.visible = v
  }

  update(camera, dt = 0.016) {
    const step = Math.min(Math.max(dt, 0), 0.1) // tab-switch spikes must not teleport the cover
    this.mesh.rotation.y += ROT_SPEED * step
    this.uniforms.uTime.value += step
    // clouds are a planet-view feature — fade out as the camera dives so the
    // final approach to the surface stays crisp
    const d = camera.position.length()
    this.uniforms.uFade.value = smoothstep01(this.radius * 1.18, this.radius * 1.5, d)
  }

  dispose() {
    this._disposed = true
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this._texture?.dispose()
    this._placeholder?.dispose()
  }
}
