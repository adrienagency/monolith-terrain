// Volumetric clouds — a proper raymarched cloud field. Each cloud is a
// camera-facing impostor whose fragment shader ray-marches a shared 3D Perlin
// noise volume (the technique from three.js' `webgl_volume_cloud` example),
// lit with a Beer–Lambert light march toward the sun for real self-shadowing
// and a powder term for the bright rims. Sparse, low-drifting cumulus that
// cling to the relief; some are dense and throw a strong ground shadow. The
// map stays the hero — clouds are discreet but no longer flat and cheap.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { TERRAIN_SIZE } from './terrain.js'
import { mulberry32 } from './noise.js'

// ---- shared 3D noise volume: billowy FBM Perlin baked once into a Data3DTexture
function buildNoiseTexture(size = 64) {
  const data = new Uint8Array(size * size * size)
  const perlin = new ImprovedNoise()
  let i = 0
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // FBM of Perlin; the |·| billow gives puffy cumulus rather than smoke
        let f = 0,
          amp = 0.5,
          fr = 0.09
        for (let o = 0; o < 4; o++) {
          f += amp * perlin.noise(x * fr, y * fr, z * fr)
          fr *= 2.15
          amp *= 0.5
        }
        const v = 1.0 - Math.abs(f) // billow: ridged, fuller cores
        data[i++] = Math.max(0, Math.min(255, Math.round(v * 255)))
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size)
  tex.format = THREE.RedFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vWorldPos;
out vec4 outColor;

uniform vec3 cameraPosition;
uniform vec3 uCenter;
uniform vec3 uRadii;     // ellipsoid semi-axes (world units)
uniform vec3 uSunDir;
uniform float uTime;
uniform float uOpacity;
uniform float uDensity;
uniform float uThreshold; // carve level — lower = more cloud
uniform float uGroundY;   // terrain height under the cloud (contact dissolve)
uniform sampler3D uNoise;
uniform float uFreq;      // noise frequency in cloud-local space
uniform vec3 uSeed;       // per-cloud offset → each puff is a distinct shape

// density at a world point. The noise is sampled in the cloud's OWN local space
// (q = point in unit-ellipsoid space) offset by uSeed, so each cloud is a
// coherent puff that translates rigidly and only evolves slowly via uTime —
// rather than boiling as it drifts through a world-space field.
float cloudAt(vec3 wp) {
  vec3 q = (wp - uCenter) / uRadii;
  float shell = 1.0 - smoothstep(0.5, 1.0, length(q));
  if (shell <= 0.0) return 0.0;
  vec3 uvw = q * uFreq + uSeed + vec3(uTime * 0.01, 0.0, uTime * 0.006);
  float base = texture(uNoise, uvw).r;
  float det = texture(uNoise, uvw * 3.0 + 3.3).r;
  float d = base - (1.0 - det) * 0.3; // erode edges with detail → wispier rims
  d = smoothstep(uThreshold, uThreshold + 0.55, d);
  d *= smoothstep(uGroundY - 0.3, uGroundY + 2.2, wp.y); // wispy relief contact
  return clamp(d * shell * uDensity, 0.0, 1.0);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - cameraPosition);
  // ray vs unit sphere in ellipsoid-local space
  vec3 roL = (ro - uCenter) / uRadii;
  vec3 rdL = rd / uRadii;
  float a = dot(rdL, rdL);
  float b = dot(roL, rdL);
  float c = dot(roL, roL) - 1.0;
  float h = b * b - a * c;
  if (h < 0.0) discard;
  h = sqrt(h);
  float t0 = max((-b - h) / a, 0.0);
  float t1 = (-b + h) / a;
  if (t1 <= t0) discard;

  const int STEPS = 28;
  float dt = (t1 - t0) / float(STEPS);
  vec3 sunL = normalize(uSunDir);
  float transmittance = 1.0;
  vec3 scatter = vec3(0.0);
  // dither the ray start by a screen-space hash so the fixed step count can't
  // band the thin dense cores at grazing angles
  vec3 h3 = fract(vec3(gl_FragCoord.xyx) * 0.1031);
  h3 += dot(h3, h3.yzx + 33.33);
  float jitter = fract((h3.x + h3.y) * h3.z);
  for (int i = 0; i < STEPS; i++) {
    vec3 wp = ro + rd * (t0 + (float(i) + jitter) * dt);
    float d = cloudAt(wp);
    if (d > 0.001) {
      // short light march toward the sun → Beer–Lambert self-shadowing
      float ld = 0.0;
      for (int j = 1; j <= 4; j++) ld += cloudAt(wp + sunL * (float(j) * 0.6));
      float light = exp(-ld * 0.6);
      // sunlit crown (warm white) fading to a cool shadowed underside — natural
      // cumulus shading, no inverted powder term
      vec3 col = mix(vec3(0.55, 0.6, 0.68), vec3(1.0, 0.99, 0.96), light);
      float dens = d * dt * 5.5;
      scatter += col * dens * transmittance;
      transmittance *= exp(-dens);
      if (transmittance < 0.02) break;
    }
  }
  float alpha = (1.0 - transmittance) * uOpacity;
  if (alpha < 0.01) discard;
  outColor = vec4(scatter / max(1.0 - transmittance, 1e-3), alpha);
}
`

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.42)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class Clouds {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'clouds'
    scene.add(this.group)
    this.tex = shadowTexture()
    this.noiseTex = buildNoiseTexture(64) // shared volume, baked once
    this.clouds = []
    this.time = 0
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.4)
    this.build(params)
  }

  setSunDir(v) {
    this.sunDir.copy(v).normalize()
    for (const c of this.clouds) c.mesh.material.uniforms.uSunDir.value.copy(this.sunDir)
  }

  build(params) {
    this._dispose()
    if (!params.cloudsEnabled) return
    const rng = mulberry32((params.seed ?? 7) * 31 + 5)
    this._rng = rng // respawn draws stay on the seeded stream (reproducible)
    const half = TERRAIN_SIZE / 2 - 4
    for (let i = 0; i < params.cloudCount; i++) {
      // roughly half the field is "dense": bigger, heavier-bodied puffs that read
      // as solid and throw a strong cast shadow; the rest stay lighter and wispy
      const dense = rng() < 0.5
      const size = (dense ? 4.4 : 2.8) + rng() * (dense ? 3.6 : 2.6)
      const radii = new THREE.Vector3(size, size * (0.5 + rng() * 0.28), size * (0.6 + rng() * 0.32))
      // impostor quad big enough to cover the ellipsoid silhouette from any angle
      const quad = Math.max(radii.x, radii.y, radii.z) * 2.4
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(quad, quad),
        new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthWrite: false,
          // no depth test: the ground-dissolve carries the terrain contact, so we
          // avoid the hard silhouette a depth-clipped billboard cuts into the relief
          depthTest: false,
          uniforms: {
            uCenter: { value: new THREE.Vector3() },
            uRadii: { value: radii },
            uSunDir: { value: this.sunDir.clone() },
            uTime: { value: 0 },
            uOpacity: { value: Math.min(1, (dense ? 1.0 : 0.82 + rng() * 0.16) * params.cloudOpacity) },
            uDensity: { value: dense ? 1.7 : 1.0 },
            uThreshold: { value: dense ? 0.3 : 0.42 },
            uGroundY: { value: 0 },
            uNoise: { value: this.noiseTex },
            uFreq: { value: 1.7 },
            uSeed: { value: new THREE.Vector3(rng() * 10, rng() * 10, rng() * 10) },
          },
        })
      )
      mesh.renderOrder = 15
      mesh.frustumCulled = false // the impostor is small; the volume extends past it
      // hover: how high the cloud floats above the ground under it. Kept low
      // (0.2–1.6 × the base altitude) so clouds cling to summits and the tallest
      // peaks can pierce them
      const hover = params.cloudAltitude * (0.2 + rng() * 1.4)
      mesh.position.set((rng() * 2 - 1) * half, 0, (rng() * 2 - 1) * half)

      // blob shadow draped just above the relief under the cloud. Dense clouds
      // cast a wider, markedly darker shadow so the heavy puffs read as solid.
      const shadowFactor = dense ? 0.52 : 0.3
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(size * (dense ? 3.1 : 2.5), size * (dense ? 2.2 : 1.7)),
        new THREE.MeshBasicMaterial({
          map: this.tex,
          color: 0x000000,
          transparent: true,
          depthWrite: false,
          opacity: shadowFactor * params.cloudOpacity,
        })
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.renderOrder = 5

      this.group.add(mesh)
      this.group.add(shadow)
      this.clouds.push({ mesh, shadow, speed: 0.14 + rng() * 0.22, size, hover, shadowFactor })
    }
  }

  update(dt, params, camera) {
    if (!params.cloudsEnabled || !this.group.visible) return
    this.time += dt
    const half = TERRAIN_SIZE / 2
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * params.cloudDrift * dt
      if (c.mesh.position.x > half + c.size * 2) {
        c.mesh.position.x = -half - c.size * 2
        c.mesh.position.z = (this._rng() * 2 - 1) * (half - 4)
      }
      const { x, z } = c.mesh.position
      const inside = Math.abs(x) < half && Math.abs(z) < half
      // ride the relief: sit `hover` above the ground under the cloud, so the
      // band dips over valleys and the highest summits punch through
      const groundY = inside ? this.terrain.sample(x, z) : 0
      c.mesh.position.y = groundY + c.hover

      // impostor faces the camera; the raymarch volume stays world-anchored
      if (camera) c.mesh.quaternion.copy(camera.quaternion)
      c.mesh.material.uniforms.uCenter.value.copy(c.mesh.position)
      c.mesh.material.uniforms.uTime.value = this.time
      c.mesh.material.uniforms.uGroundY.value = inside ? groundY : -9999

      // shadow offset along the sun's ground projection, so it falls away from
      // the cloud like a real cast rather than sitting straight underneath
      const sx = -this.sunDir.x
      const sz = -this.sunDir.z
      const sl = Math.hypot(sx, sz) || 1
      const off = c.hover * 0.6
      const shx = x + (sx / sl) * off
      const shz = z + (sz / sl) * off
      const shIn = Math.abs(shx) < half && Math.abs(shz) < half
      c.shadow.position.set(shx, shIn ? this.terrain.sample(shx, shz) + 0.14 : 0.14, shz)
      c.shadow.material.opacity = c.shadowFactor * params.cloudOpacity
    }
  }

  setVisible(v) {
    this.group.visible = v
  }

  _dispose() {
    for (const c of this.clouds) {
      c.mesh.geometry.dispose()
      c.mesh.material.dispose()
      this.group.remove(c.mesh)
      c.shadow.geometry.dispose()
      c.shadow.material.dispose()
      this.group.remove(c.shadow)
    }
    this.clouds = []
  }
}
