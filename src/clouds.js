// Sparse volumetric clouds: each cloud is a camera-facing impostor quad whose
// fragment shader RAYMARCHES a 3D fbm density field inside the cloud's
// ellipsoid — real light accumulation toward the sun, not a flat sprite.
// Deliberately discreet (a handful of small clouds, slow drift) with soft
// blob shadows hugging the relief. The map stays the hero.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { mulberry32 } from './noise.js'

const VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
uniform vec3 uCenter;
uniform vec3 uRadii;   // ellipsoid semi-axes (world units)
uniform vec3 uSunDir;
uniform float uSeed;
uniform float uTime;
uniform float uOpacity;

// value noise + fbm — cheap, procedural, no texture fetch
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.13 + vec3(11.3, 7.1, 5.7);
    a *= 0.5;
  }
  return v;
}

// density in ellipsoid-local unit space: puffy fbm carved by the shell falloff
float density(vec3 q) {
  float shell = 1.0 - smoothstep(0.35, 1.0, length(q));
  if (shell <= 0.0) return 0.0;
  vec3 p = q * 2.4 + vec3(uSeed * 13.7) + vec3(uTime * 0.02, 0.0, uTime * 0.013);
  float f = fbm(p);
  return clamp((f - 0.42) * 2.2, 0.0, 1.0) * shell;
}

void main() {
  // ray through this fragment, in ellipsoid-local unit-sphere space
  vec3 ro = (cameraPosition - uCenter) / uRadii;
  vec3 rd = normalize((vWorldPos - cameraPosition));
  vec3 rdl = normalize(rd / uRadii);

  // unit-sphere intersection
  float b = dot(ro, rdl);
  float c = dot(ro, ro) - 1.0;
  float h = b * b - c;
  if (h < 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0);
  float t1 = -b + h;
  if (t1 <= t0) discard;

  vec3 sunL = normalize(uSunDir / uRadii);
  const int STEPS = 20;
  float dt = (t1 - t0) / float(STEPS);
  float alpha = 0.0;
  float lightAcc = 0.0;

  for (int i = 0; i < STEPS; i++) {
    if (alpha > 0.98) break;
    vec3 q = ro + rdl * (t0 + (float(i) + 0.5) * dt);
    float d = density(q);
    if (d <= 0.001) continue;
    // one cheap tap toward the sun: how buried is this sample?
    float occ = density(q + sunL * 0.28) * 0.85 + density(q + sunL * 0.6) * 0.5;
    float light = exp(-occ * 1.7);
    float a = 1.0 - exp(-d * dt * 5.2);
    lightAcc += light * a * (1.0 - alpha);
    alpha += a * (1.0 - alpha);
  }
  if (alpha < 0.015) discard;

  // paper-friendly cloud color: bright sunlit white, cool-grey shadowed core
  vec3 col = mix(vec3(0.72, 0.75, 0.79), vec3(1.0), clamp(lightAcc / max(alpha, 1e-3), 0.0, 1.0));
  gl_FragColor = vec4(col, alpha * uOpacity);
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
    const half = TERRAIN_SIZE / 2 - 4
    for (let i = 0; i < params.cloudCount; i++) {
      const size = 2.4 + rng() * 2.8
      const radii = new THREE.Vector3(size, size * (0.3 + rng() * 0.14), size * (0.55 + rng() * 0.3))
      // impostor quad big enough to cover the ellipsoid from any angle
      const quad = Math.max(radii.x, radii.z) * 2.15
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(quad, quad),
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthWrite: false,
          uniforms: {
            uCenter: { value: new THREE.Vector3() },
            uRadii: { value: radii },
            uSunDir: { value: this.sunDir.clone() },
            uSeed: { value: rng() * 100 },
            uTime: { value: 0 },
            uOpacity: { value: (0.75 + rng() * 0.25) * params.cloudOpacity },
          },
        })
      )
      mesh.renderOrder = 15
      mesh.position.set((rng() * 2 - 1) * half, params.cloudAltitude + (rng() * 2 - 1) * 1.4, (rng() * 2 - 1) * half)

      // blob shadow draped just above the relief under the cloud
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(size * 2.4, size * 1.5),
        new THREE.MeshBasicMaterial({
          map: this.tex,
          color: 0x000000,
          transparent: true,
          depthWrite: false,
          opacity: 0.12 * params.cloudOpacity,
        })
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.renderOrder = 5

      this.group.add(mesh)
      this.group.add(shadow)
      this.clouds.push({ mesh, shadow, speed: 0.14 + rng() * 0.22, size })
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
        c.mesh.position.z = (Math.random() * 2 - 1) * (half - 4)
      }
      // impostor faces the camera; the raymarch volume stays world-anchored
      if (camera) c.mesh.quaternion.copy(camera.quaternion)
      c.mesh.material.uniforms.uCenter.value.copy(c.mesh.position)
      c.mesh.material.uniforms.uTime.value = this.time

      const { x, z } = c.mesh.position
      c.shadow.position.set(
        x,
        Math.abs(x) < half && Math.abs(z) < half ? this.terrain.sample(x, z) + 0.14 : 0.14,
        z
      )
      c.shadow.material.opacity = 0.12 * params.cloudOpacity
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
