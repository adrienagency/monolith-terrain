// Volumetric clouds — realistic cumulus built the way the Blender geometry-nodes
// workflow does it: the base SHAPE is a lumpy CLUSTER OF BLOBS (a metaball field,
// cauliflower by construction — never a smooth egg), which is then "volumized"
// and eroded with fractal noise, and lit with a Beer–Lambert + Henyey–Greenstein
// raymarch. A handful of discrete cumulus float clearly ABOVE the relief and cast
// soft shadows on the map below.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { TERRAIN_SIZE } from './terrain.js'
import { mulberry32 } from './noise.js'

const MAX_BLOBS = 12

// ---- shared 3D noise volume: a tileable Perlin-Worley field for edge erosion.
// Inverted Worley makes the packed billows of cloud detail; it dilates a Perlin
// FBM so we keep connectedness while gaining cauliflower wisps.
function buildNoiseTexture(size = 64) {
  const data = new Uint8Array(size * size * size)
  const perlin = new ImprovedNoise()
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0
    h = (h ^ (h >>> 13)) * 1274126177
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }
  const worley = (px, py, pz, freq) => {
    const cx = Math.floor(px * freq),
      cy = Math.floor(py * freq),
      cz = Math.floor(pz * freq)
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
          const ex = ax + hash(wx, wy, wz) - px * freq,
            ey = ay + hash(wy, wz, wx) - py * freq,
            ez = az + hash(wz, wx, wy) - pz * freq
          const d = ex * ex + ey * ey + ez * ez
          if (d < minD) minD = d
        }
    return Math.min(1, Math.sqrt(minD))
  }
  const worleyFbm = (x, y, z) =>
    (1 - worley(x, y, z, 4)) * 0.625 + (1 - worley(x, y, z, 8)) * 0.25 + (1 - worley(x, y, z, 16)) * 0.125
  const remap = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)))
  let i = 0
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = x / size,
          ny = y / size,
          nz = z / size
        let pf = 0,
          amp = 0.5,
          fr = 4
        for (let o = 0; o < 3; o++) {
          pf += amp * perlin.noise(nx * fr, ny * fr, nz * fr)
          fr *= 2
          amp *= 0.5
        }
        pf = pf * 0.5 + 0.5
        const pw = remap(pf, worleyFbm(nx, ny, nz) - 1, 1)
        data[i++] = Math.max(0, Math.min(255, Math.round(pw * 255)))
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
uniform vec3 uRadii;       // bounding half-extents (world units)
uniform vec4 uBlobs[${MAX_BLOBS}]; // cluster: xyz centre (local, [-1..1]) + w radius
uniform int uBlobCount;
uniform vec3 uSunDir;      // direction TO the sun
uniform vec3 uSunCol;
uniform vec3 uAmbCol;
uniform float uTime;
uniform float uOpacity;
uniform float uDensity;
uniform float uErode;      // edge-erosion strength
uniform float uGroundY;    // relief height under the cloud (soft floor)
uniform sampler3D uNoise;
uniform float uFreq;
uniform vec3 uSeed;

const float PI = 3.14159265;

float hg(float cosA, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosA, 1.5));
}

// metaball field of the blob cluster — sum of quadratic bumps → a smooth, lumpy
// cauliflower shape (higher where blobs overlap). p is in cloud-local [-1..1].
float clusterField(vec3 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= uBlobCount) break;
    vec3 c = uBlobs[i].xyz;
    float r = uBlobs[i].w;
    float d = length(p - c) / r;
    f += max(0.0, 1.0 - d * d);
  }
  return f;
}

float fbmNoise(vec3 uvw) {
  return texture(uNoise, uvw).r * 0.65 + texture(uNoise, uvw * 2.7 + 3.1).r * 0.35;
}

// full density: cluster shape carved by noise at the edges
float cloudDensity(vec3 wp) {
  vec3 p = (wp - uCenter) / uRadii;
  float f = clusterField(p);
  if (f <= 0.02) return 0.0;
  // shape 0..1 from the metaball field (soft surface)
  float shape = smoothstep(0.3, 0.95, f);
  // erode edges with fractal noise → billows and wisps (Nubis-style)
  vec3 uvw = p * uFreq + uSeed + vec3(uTime * 0.01, 0.0, uTime * 0.006);
  float n = fbmNoise(uvw);
  float d = shape - (1.0 - n) * uErode * (1.0 - shape * 0.6);
  d = clamp(d, 0.0, 1.0);
  d *= smoothstep(uGroundY - 0.5, uGroundY + 3.0, wp.y); // soft floor if it dips low
  return d * uDensity;
}

// cheap density (cluster only) for the sun light-march
float cloudLight(vec3 wp) {
  vec3 p = (wp - uCenter) / uRadii;
  return clamp(smoothstep(0.35, 0.9, clusterField(p)) * uDensity, 0.0, 1.0);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - cameraPosition);
  // ray vs the cloud's local bounding sphere (radius 1.35 covers the cluster)
  vec3 roL = (ro - uCenter) / uRadii;
  vec3 rdL = rd / uRadii;
  float a = dot(rdL, rdL);
  float b = dot(roL, rdL);
  float c = dot(roL, roL) - 1.82; // 1.35^2
  float disc = b * b - a * c;
  if (disc < 0.0) discard;
  disc = sqrt(disc);
  float t0 = max((-b - disc) / a, 0.0);
  float t1 = (-b + disc) / a;
  if (t1 <= t0) discard;

  const int STEPS = 40;
  float dt = (t1 - t0) / float(STEPS);
  vec3 sunL = normalize(uSunDir);
  float cosT = dot(rd, sunL);
  float phase = mix(hg(cosT, 0.75), hg(cosT, -0.25), 0.4) + 0.4;

  float transmittance = 1.0;
  vec3 scatter = vec3(0.0);
  vec3 h3 = fract(vec3(gl_FragCoord.xyx) * 0.1031);
  h3 += dot(h3, h3.yzx + 33.33);
  float jitter = fract((h3.x + h3.y) * h3.z);

  for (int i = 0; i < STEPS; i++) {
    vec3 wp = ro + rd * (t0 + (float(i) + jitter) * dt);
    float d = cloudDensity(wp);
    if (d > 0.001) {
      float ld = 0.0;
      for (int j = 1; j <= 5; j++) ld += cloudLight(wp + sunL * (float(j) * 0.6));
      float beer = exp(-ld * 1.1);
      float powder = 1.0 - exp(-ld * 2.2);
      float sun = beer * mix(1.0, powder, 0.4);
      float shade = mix(0.72, 1.12, sun);
      vec3 col = uSunCol * shade * (1.0 + 0.5 * sun * phase) + uAmbCol * 0.16;
      float dens = d * dt * 3.6;
      float t = exp(-dens);
      scatter += col * (1.0 - t) * transmittance;
      transmittance *= t;
      if (transmittance < 0.02) break;
    }
  }
  float alpha = (1.0 - transmittance) * uOpacity;
  if (alpha < 0.01) discard;
  outColor = vec4(scatter, alpha);
}
`

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// build one cumulus cluster: a big flattish base blob + smaller blobs billowing
// up and out, in local [-1..1] space. Cauliflower by construction.
function makeCluster(rng) {
  const blobs = []
  // wide, low, OVERLAPPING base blobs → one flat-bottomed mass (not stacked balls)
  blobs.push([0, -0.32, 0, 0.72])
  blobs.push([-0.34, -0.3, 0.12, 0.56])
  blobs.push([0.32, -0.28, -0.14, 0.56])
  blobs.push([0.05, -0.28, 0.34, 0.5])
  // billowing turrets on top — kept CLOSE so they merge into cauliflower, biased up
  const towers = 4 + Math.floor(rng() * 3)
  for (let k = 0; k < towers; k++) {
    const ang = rng() * Math.PI * 2
    const rad = 0.1 + rng() * 0.34
    blobs.push([
      Math.cos(ang) * rad,
      0.0 + rng() * 0.55, // biased upward for the billowing top
      Math.sin(ang) * rad * 0.9,
      0.34 + rng() * 0.22,
    ])
  }
  return blobs.slice(0, MAX_BLOBS)
}

export class Clouds {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'clouds'
    scene.add(this.group)
    this.tex = shadowTexture()
    this.noiseTex = buildNoiseTexture(64)
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
    this._rng = rng
    const half = TERRAIN_SIZE / 2 - 5
    for (let i = 0; i < params.cloudCount; i++) {
      const dense = rng() < 0.5
      const size = (dense ? 3.4 : 2.4) + rng() * (dense ? 2.4 : 1.8)
      // cumulus: wider than tall, often elongated on one horizontal axis
      const ex = 0.9 + rng() * 0.7
      const ez = 0.9 + rng() * 0.7
      const radii = new THREE.Vector3(size * ex, size * (0.72 + rng() * 0.18), size * ez)
      const quad = Math.max(radii.x, radii.y, radii.z) * 2.8

      const blobs = makeCluster(rng)
      const blobVecs = []
      for (let k = 0; k < MAX_BLOBS; k++) {
        const b = blobs[k] || [0, 0, 0, 0]
        blobVecs.push(new THREE.Vector4(b[0], b[1], b[2], b[3] || 0.001))
      }

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(quad, quad),
        new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          uniforms: {
            uCenter: { value: new THREE.Vector3() },
            uRadii: { value: radii },
            uBlobs: { value: blobVecs },
            uBlobCount: { value: blobs.length },
            uSunDir: { value: this.sunDir.clone() },
            uSunCol: { value: new THREE.Color(1.0, 0.98, 0.94) },
            uAmbCol: { value: new THREE.Color(0.62, 0.68, 0.78) },
            uTime: { value: 0 },
            uOpacity: { value: Math.min(1, (dense ? 0.95 : 0.82) * params.cloudOpacity) },
            uDensity: { value: dense ? 1.5 : 1.15 },
            uErode: { value: dense ? 0.42 : 0.52 },
            uGroundY: { value: 0 },
            uNoise: { value: this.noiseTex },
            uFreq: { value: params.cloudDetail ?? 2.6 },
            uSeed: { value: new THREE.Vector3(rng() * 10, rng() * 10, rng() * 10) },
          },
        })
      )
      mesh.renderOrder = 15
      mesh.frustumCulled = false
      // FLOAT clearly above the relief — clear sky beneath (detached cumulus)
      const hover = radii.y + params.cloudAltitude * (1.4 + rng() * 1.6)
      mesh.position.set((rng() * 2 - 1) * half, 0, (rng() * 2 - 1) * half)

      const shadowFactor = dense ? 0.5 : 0.32
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(radii.x * 2.4, radii.z * 2.4),
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
      this.clouds.push({ mesh, shadow, speed: 0.12 + rng() * 0.2, size, hover, shadowFactor })
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
        c.mesh.position.z = (this._rng() * 2 - 1) * (half - 5)
      }
      const { x, z } = c.mesh.position
      const inside = Math.abs(x) < half && Math.abs(z) < half
      const groundY = inside ? this.terrain.sample(x, z) : 0
      // detached: float at a fixed high hover above the ground under it
      c.mesh.position.y = groundY + c.hover

      if (camera) c.mesh.quaternion.copy(camera.quaternion)
      const u = c.mesh.material.uniforms
      u.uCenter.value.copy(c.mesh.position)
      u.uTime.value = this.time
      u.uGroundY.value = inside ? groundY : -9999

      // cast shadow on the map, offset along the sun's ground projection
      const sx = -this.sunDir.x
      const sz = -this.sunDir.z
      const sl = Math.hypot(sx, sz) || 1
      const off = c.hover * 0.5
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
