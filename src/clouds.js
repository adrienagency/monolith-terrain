// Volumetric cloud deck — original implementation (clean-room rewrite).
// A single raymarched box spans the map: cloud masses with flat-ish bases and
// billowing domed tops, broken up by a low-frequency coverage field. Lighting
// follows the published real-time techniques (Beer–Lambert extinction, a short
// sun march for self-shadowing, a dual-lobe Henyey–Greenstein phase with a
// multi-octave scattering approximation — see Schneider's "Nubis" SIGGRAPH
// talks and Hillaire's Frostbite course notes; the code here is our own).
// The deck also bakes a drifting shadow texture that the terrain shader
// multiplies in, so clouds cast believable ground shadows when the sun is high.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { TERRAIN_SIZE } from './terrain.js'

// ---------------------------------------------------------------- CPU noise
// Tileable Perlin-Worley volume baked once on the CPU (same builder we used in
// earlier iterations): inverted Worley supplies the packed cauliflower billows,
// and it dilates a Perlin FBM so the field stays connected. Channel R is the
// billow base, channel G a low-frequency Worley used as the coverage field.
const VOL = 64
let sharedVolume = null // { tex, data } — baked once, reused by every rebuild

function bakeVolume() {
  if (sharedVolume) return sharedVolume
  const perlin = new ImprovedNoise()
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0
    h = (h ^ (h >>> 13)) * 1274126177
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }
  // nearest-feature distance on a wrapped grid of freq³ cells → tileable Worley
  const worley = (px, py, pz, freq) => {
    const cx = Math.floor(px * freq)
    const cy = Math.floor(py * freq)
    const cz = Math.floor(pz * freq)
    let minD = 1e9
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ax = cx + dx,
            ay = cy + dy,
            az = cz + dz
          const wx = ((ax % freq) + freq) % freq,
            wy = ((ay % freq) + freq) % freq,
            wz = ((az % freq) + freq) % freq
          const fx = ax + hash(wx, wy, wz),
            fy = ay + hash(wy, wz, wx),
            fz = az + hash(wz, wx, wy)
          const ex = fx / freq - px,
            ey = fy / freq - py,
            ez = fz / freq - pz
          const d = ex * ex + ey * ey + ez * ez
          if (d < minD) minD = d
        }
    return Math.min(1, Math.sqrt(minD) * freq)
  }
  const invWorleyFbm = (x, y, z) =>
    (1 - worley(x, y, z, 4)) * 0.625 + (1 - worley(x, y, z, 8)) * 0.25 + (1 - worley(x, y, z, 16)) * 0.125
  // true 2D tileable Worley for the coverage field — a slice of 3D Worley only
  // grazes a couple of feature points, which starved the deck down to one bank
  const worley2 = (px, py, freq) => {
    const cx = Math.floor(px * freq)
    const cy = Math.floor(py * freq)
    let minD = 1e9
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ax = cx + dx,
          ay = cy + dy
        const wx = ((ax % freq) + freq) % freq,
          wy = ((ay % freq) + freq) % freq
        const fx = ax + hash(wx, wy, 17),
          fy = ay + hash(wy, wx, 43)
        const ex = fx / freq - px,
          ey = fy / freq - py
        const d = ex * ex + ey * ey
        if (d < minD) minD = d
      }
    return Math.min(1, Math.sqrt(minD) * freq)
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v))

  const data = new Uint8Array(VOL * VOL * VOL * 2) // RG
  let i = 0
  for (let z = 0; z < VOL; z++)
    for (let y = 0; y < VOL; y++)
      for (let x = 0; x < VOL; x++) {
        const nx = x / VOL,
          ny = y / VOL,
          nz = z / VOL
        let pf = 0,
          amp = 0.5,
          fr = 4
        for (let o = 0; o < 3; o++) {
          pf += amp * perlin.noise(nx * fr, ny * fr, nz * fr)
          fr *= 2
          amp *= 0.5
        }
        pf = pf * 0.5 + 0.5
        // remap the Perlin into [billows, 1] — a HIGH-mean field, so subtracting
        // (1 − profile) leaves real cloud bodies instead of starved wisps
        const w = clamp01(invWorleyFbm(nx, ny, nz) * 1.5)
        const pw = clamp01(w + pf * (1 - w))
        // coverage: two low frequencies of inverted 2D Worley (constant over z —
        // the shader reads one slice) → broad cloud banks with real gaps
        const coverage = clamp01((1 - worley2(nx, ny, 3)) * 0.55 + (1 - worley2(nx, ny, 5)) * 0.45)
        data[i++] = Math.round(pw * 255)
        data[i++] = Math.round(clamp01(coverage) * 255)
      }
  const tex = new THREE.Data3DTexture(data, VOL, VOL, VOL)
  tex.format = THREE.RGFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  sharedVolume = { tex, data }
  return sharedVolume
}

// CPU-side reads of the baked volume (used for the ground-shadow bake), kept in
// sync with the shader's density so the shadow matches what floats overhead
function readVolume(data, x, y, z, ch) {
  const xi = ((Math.floor(x * VOL) % VOL) + VOL) % VOL
  const yi = ((Math.floor(y * VOL) % VOL) + VOL) % VOL
  const zi = ((Math.floor(z * VOL) % VOL) + VOL) % VOL
  return data[(zi * VOL * VOL + yi * VOL + xi) * 2 + ch] / 255
}

// ---------------------------------------------------------------- shader
const DECK_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const DECK_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  #define PI 3.14159265359
  #define MARCH_STEPS 64
  #define SUN_STEPS 5

  varying vec3 vWorldPos;
  out vec4 outColor;

  uniform sampler3D uVolume;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uDrift;      // rigid drift offset, in box-normalised x
  uniform float uDensity;
  uniform float uScale;      // noise tiling across the deck
  uniform float uCoverGate;  // 0 = unbroken sheet, higher = more open sky
  uniform float uBillow;     // 0 = flat slab, 1 = tall domed tops
  uniform float uSunStep;    // world-units per sun-march step
  uniform vec3 uSunDir;      // direction the sunlight travels (sun → scene)
  uniform vec3 uSunColor;    // warm at sunset, white at noon
  uniform vec3 uAmbColor;    // sky fill
  uniform float uBrightness;

  float sat(float v) { return clamp(v, 0.0, 1.0); }

  // classic slab-method ray/box intersection
  vec2 boxSpan(vec3 ro, vec3 rd) {
    vec3 t0 = (uBoxMin - ro) / rd;
    vec3 t1 = (uBoxMax - ro) / rd;
    vec3 tsmall = min(t0, t1);
    vec3 tbig = max(t0, t1);
    return vec2(max(max(tsmall.x, tsmall.y), tsmall.z), min(min(tbig.x, tbig.y), tbig.z));
  }

  // local coverage: low-frequency cells (squared to bite), gated by the slider,
  // faded toward the deck edges so the field ends softly at the map border
  float coverAt(vec2 pxz) {
    float c = texture(uVolume, vec3((pxz + vec2(uDrift, 0.0)) * 0.9, 0.35)).g;
    float edge = 1.0 - sat((length(pxz - 0.5) - 0.28) / 0.24);
    return smoothstep(uCoverGate, uCoverGate + 0.25, c) * edge;
  }

  // density: billow noise carved by a flat-based, dome-topped vertical profile.
  // The local cloud TOP rises with coverage strength — that's the vertical
  // billowing: strong cells tower, weak cells stay shallow.
  float densityAt(vec3 wp) {
    vec3 p = (wp - uBoxMin) / (uBoxMax - uBoxMin);
    float cover = coverAt(p.xz);
    if (cover <= 0.003) return 0.0;
    float top = mix(0.28, 1.0, cover * uBillow); // domed tops follow coverage
    float base = smoothstep(0.0, 0.08, p.y);      // flat-ish underside
    float crown = 1.0 - smoothstep(top - 0.3, top, p.y);
    float profile = base * crown * cover;
    if (profile <= 0.0) return 0.0;
    vec3 coord = vec3(p.x + uDrift, p.y, p.z) * uScale;
    float billow = texture(uVolume, fract(coord)).r;
    return sat(billow - (1.0 - profile)) * uDensity;
  }

  float beer(float depth) { return exp(-depth); }

  float henyeyGreenstein(float g, float cosA) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosA, 1.5));
  }

  // published multi-octave approximation of in-cloud multiple scattering:
  // sum attenuated Beer/phase pairs so cores glow instead of going black
  float scatter(float depth, float cosA) {
    float lum = 0.0;
    float a = 1.0;
    float b = 1.0;
    float g = 0.45;
    for (int o = 0; o < 3; o++) {
      // dual HG lobes + an isotropic floor so the body stays bright white and
      // the phase only adds directionality (silver lining toward the sun)
      float phase = mix(henyeyGreenstein(g, cosA), henyeyGreenstein(-g * 0.5, cosA), 0.4) + 0.24;
      lum += b * phase * beer(depth * a);
      a *= 0.45;
      b *= 0.55;
      g *= 0.85;
    }
    return lum;
  }

  // short march toward the sun → how buried is this sample?
  float sunDepth(vec3 wp, vec3 toSun) {
    float d = 0.0;
    for (int j = 1; j <= SUN_STEPS; j++) {
      d += densityAt(wp + toSun * (uSunStep * float(j)));
      if (d >= 1.6) break;
    }
    return d;
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorldPos - cameraPosition);
    vec2 span = boxSpan(ro, rd);
    span.x = max(span.x, 0.0);
    if (span.y <= span.x) discard;

    vec3 toSun = -normalize(uSunDir);
    float cosA = dot(rd, -toSun);
    // jitter the start so 64 steps don't band
    vec3 h = fract(vec3(gl_FragCoord.xyx) * 0.1031);
    h += dot(h, h.yzx + 33.33);
    float jitter = fract((h.x + h.y) * h.z);

    float dt = (span.y - span.x) / float(MARCH_STEPS);
    float transmittance = 1.0;
    vec3 light = vec3(0.0);

    for (int i = 0; i < MARCH_STEPS; i++) {
      vec3 wp = ro + rd * (span.x + (float(i) + jitter) * dt);
      float d = densityAt(wp);
      if (d <= 0.002) continue;
      float depth = sunDepth(wp, toSun);
      vec3 sun = uSunColor * uBrightness * scatter(depth, cosA);
      vec3 col = sun + uAmbColor;
      float extinction = d * dt * 0.9;
      float stepTrans = exp(-extinction);
      light += col * (1.0 - stepTrans) * transmittance;
      transmittance *= stepTrans;
      if (transmittance < 0.02) break;
    }

    float alpha = 1.0 - transmittance;
    if (alpha < 0.01) discard;
    outColor = vec4(light, alpha);
  }
`

export class Clouds {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'clouds'
    scene.add(this.group)
    this.deck = null
    this.shadowTex = null
    this.time = 0
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.4) // direction TO the sun
    this.build(params)
  }

  setSunDir(v) {
    this.sunDir.copy(v).normalize()
    if (this.deck) this.deck.material.uniforms.uSunDir.value.copy(this.sunDir).negate()
  }

  build(params) {
    this._dispose()
    if (!params.cloudsEnabled) return
    const { tex, data } = bakeVolume()

    const half = TERRAIN_SIZE / 2
    // the deck can sit anywhere from ground level (altitude 0) to high above
    const bottom = params.cloudAltitude ?? 7
    const billow = params.cloudBillow ?? 0.6
    const thickness = 4.5 + 7 * billow

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: DECK_VERT,
      fragmentShader: DECK_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false, // same terrain-contact tradeoff as every cloud version
      side: THREE.BackSide,
      // the march accumulates premultiplied radiance
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uVolume: { value: tex },
        uBoxMin: { value: new THREE.Vector3(-half, bottom, -half) },
        uBoxMax: { value: new THREE.Vector3(half, bottom + thickness, half) },
        uDrift: { value: 0 },
        uDensity: { value: params.cloudOpacity ?? 0.85 },
        uScale: { value: params.cloudScale ?? 3 },
        uCoverGate: { value: params.cloudCoverage ?? 0.45 },
        uBillow: { value: billow },
        uSunStep: { value: thickness * 0.16 },
        uSunDir: { value: this.sunDir.clone().negate() },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbColor: { value: new THREE.Color(0.5, 0.56, 0.66).multiplyScalar(0.28) },
        uBrightness: { value: params.cloudBrightness ?? 2.5 },
      },
    })

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.position.set(0, bottom + thickness / 2, 0)
    mesh.scale.set(TERRAIN_SIZE, thickness, TERRAIN_SIZE)
    mesh.renderOrder = 15
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.deck = mesh

    this._bakeShadow(params, data)
  }

  // bake the deck's ground shadow: for each map cell, integrate the same density
  // column the shader sees (at drift 0 — the terrain offsets it as time passes)
  _bakeShadow(params, data) {
    const N = 128
    const gate = params.cloudCoverage ?? 0.45
    const billow = params.cloudBillow ?? 0.6
    const scale = params.cloudScale ?? 3
    const density = params.cloudOpacity ?? 0.85
    const px = new Uint8Array(N * N)
    const sat = (v) => Math.min(1, Math.max(0, v))
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = i / N
        const z = j / N
        // coverage (must mirror coverAt)
        const c = readVolume(data, x * 0.9, z * 0.9, 0.35, 1)
        const edge = 1 - sat((Math.hypot(x - 0.5, z - 0.5) - 0.28) / 0.24)
        const cover = sat((c - gate) / 0.25) * edge
        let acc = 0
        if (cover > 0.003) {
          const top = 0.28 + (1 - 0.28) * cover * billow
          for (let s = 0; s < 8; s++) {
            const y = (s + 0.5) / 8
            const base = sat(y / 0.08)
            const crown = 1 - sat((y - (top - 0.3)) / 0.3)
            const profile = base * crown * cover
            if (profile <= 0) continue
            const b = readVolume(data, x * scale, y * scale, z * scale, 0)
            acc += sat(b - (1 - profile)) * density
          }
        }
        px[j * N + i] = Math.round(sat(acc / 2.2) * 255)
      }
    }
    const tex = new THREE.DataTexture(px, N, N, THREE.RedFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    if (this.shadowTex) this.shadowTex.dispose()
    this.shadowTex = tex
    const mu = this.terrain.mapUniforms
    if (mu && mu.uCloudShadow) mu.uCloudShadow.value = tex
  }

  update(dt, params) {
    if (!this.deck) return
    this.time += dt
    const u = this.deck.material.uniforms
    const drift = this.time * (params.cloudDrift ?? 1) * 0.004
    u.uDrift.value = drift
    u.uDensity.value = params.cloudOpacity ?? 0.85
    u.uScale.value = params.cloudScale ?? 3
    u.uCoverGate.value = params.cloudCoverage ?? 0.45
    u.uBrightness.value = params.cloudBrightness ?? 2.5

    // the deck reacts to the sun: warm sunset light when the sun sits low, a
    // cooler dimmer ambient as it drops — like a real evening sky
    const elev = params.sunElevation ?? 30
    const warmth = 1 - Math.min(1, Math.max(0, (elev - 6) / 26))
    u.uSunColor.value.setRGB(1, 1 - 0.45 * warmth, 1 - 0.68 * warmth)
    u.uAmbColor.value.setRGB(0.5 + 0.1 * warmth, 0.56 - 0.06 * warmth, 0.66 - 0.14 * warmth)
    u.uAmbColor.value.multiplyScalar(0.28 - 0.1 * warmth)

    // ground shadows: visible when the deck is on and the sun is clearly above
    // it, drifting with the clouds and offset along the sun's slant
    const mu = this.terrain.mapUniforms
    if (mu && mu.uCloudShadowK) {
      const on = params.cloudsEnabled && this.group.visible
      const k = on ? Math.min(1, Math.max(0, (elev - 8) / 24)) * 0.42 : 0
      mu.uCloudShadowK.value = k
      if (mu.uCloudShadowOff) {
        const s = this.sunDir
        const deckMid = this.deck.position.y
        const slant = Math.max(0.25, s.y)
        mu.uCloudShadowOff.value.set(
          drift / (params.cloudScale ?? 3) - (s.x / slant) * (deckMid / TERRAIN_SIZE) * 0.5,
          -(s.z / slant) * (deckMid / TERRAIN_SIZE) * 0.5
        )
      }
    }
  }

  setVisible(v) {
    this.group.visible = v
    if (!v && this.terrain.mapUniforms?.uCloudShadowK) this.terrain.mapUniforms.uCloudShadowK.value = 0
  }

  _dispose() {
    if (this.deck) {
      this.deck.geometry.dispose()
      this.deck.material.dispose()
      this.group.remove(this.deck)
      this.deck = null
    }
  }
}
