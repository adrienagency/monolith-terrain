// Volumetric cloud deck — ported from beatsaway/three-volumetric-clouds
// (https://github.com/beatsaway/three-volumetric-clouds, a browser-ready fork of
// FarazzShaikh/three-volumetric-clouds), itself based on Guerrilla Games'
// "Nubis, Evolved" presentation. NOTE: the upstream repos carry no explicit
// license — code is used here with attribution at the user's request.
//
// Adaptation notes (the upstream pipeline is a full-screen compositor that owns
// the frame; this app renders through a postprocessing composer, so the clouds
// are hosted on an in-scene raymarched box instead):
//  - the GPU-generated noise volume (128³ RGBA Perlin-Worley + Worley octaves)
//    and the 256² envelope texture are generated once, verbatim shaders;
//  - the density model (perlinWorley − (1 − dimensionalProfile)) and lighting
//    (Beer's law + 4-octave dual-lobe Henyey-Greenstein multiple scattering,
//    adaptive-refinement ray march) are kept intact;
//  - rays come from the box mesh fragments instead of a screen-space depth
//    reconstruction, marching is parameterised on [near,far] so the non-unit
//    box behaves exactly like upstream's unit box;
//  - the camera-relative light hack is replaced by the app's real sun direction.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

// ========== upstream GLSL (noise + helpers), kept verbatim ==========
const shaderCommon = /* glsl */ `
  #define UI0 1597334673U
  #define UI1 3812015801U
  #define UI3 uvec3(UI0, UI1, 2798796415U)
  #define UIF (1.0 / float(0xffffffffU))

  vec3 hash33(vec3 p) {
    uvec3 q = uvec3(ivec3(p)) * UI3;
    q = (q.x ^ q.y ^ q.z) * UI3;
    return -1. + 2. * vec3(q) * UIF;
  }

  float remap(float x, float a, float b, float c, float d) {
    return (((x - a) / (b - a)) * (d - c)) + c;
  }
`

const shaderPerlin = /* glsl */ `
  float perlinNoise(vec3 x, float freq) {
    vec3 p = floor(x);
    vec3 w = fract(x);
    vec3 u = w * w * w * (w * (w * 6. - 15.) + 10.);
    vec3 ga = hash33(mod(p + vec3(0., 0., 0.), freq));
    vec3 gb = hash33(mod(p + vec3(1., 0., 0.), freq));
    vec3 gc = hash33(mod(p + vec3(0., 1., 0.), freq));
    vec3 gd = hash33(mod(p + vec3(1., 1., 0.), freq));
    vec3 ge = hash33(mod(p + vec3(0., 0., 1.), freq));
    vec3 gf = hash33(mod(p + vec3(1., 0., 1.), freq));
    vec3 gg = hash33(mod(p + vec3(0., 1., 1.), freq));
    vec3 gh = hash33(mod(p + vec3(1., 1., 1.), freq));
    float va = dot(ga, w - vec3(0., 0., 0.));
    float vb = dot(gb, w - vec3(1., 0., 0.));
    float vc = dot(gc, w - vec3(0., 1., 0.));
    float vd = dot(gd, w - vec3(1., 1., 0.));
    float ve = dot(ge, w - vec3(0., 0., 1.));
    float vf = dot(gf, w - vec3(1., 0., 1.));
    float vg = dot(gg, w - vec3(0., 1., 1.));
    float vh = dot(gh, w - vec3(1., 1., 1.));
    return va +
      u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va) +
      u.x * u.y * (va - vb - vc + vd) +
      u.y * u.z * (va - vc - ve + vg) +
      u.z * u.x * (va - vb - ve + vf) +
      u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);
  }

  float perlinFbm(vec3 p, float freq, int octaves) {
    float G = exp2(-.85);
    float amp = 1.;
    float noise = 0.;
    for (int i = 0; i < octaves; ++i) {
      noise += amp * perlinNoise(p * freq, freq);
      freq *= 2.;
      amp *= G;
    }
    float result = mix(1.0, noise, 0.5);
    return abs(result * 2. - 1.);
  }
`

const shaderWorley = /* glsl */ `
  float worleyNoise(vec3 uv, float freq) {
    vec3 id = floor(uv);
    vec3 p = fract(uv);
    float minDist = 10000.;
    for (float x = -1.; x <= 1.; ++x) {
      for (float y = -1.; y <= 1.; ++y) {
        for (float z = -1.; z <= 1.; ++z) {
          vec3 offset = vec3(x, y, z);
          vec3 h = hash33(mod(id + offset, vec3(freq))) * .5 + .5;
          h += offset;
          vec3 d = p - h;
          minDist = min(minDist, dot(d, d));
        }
      }
    }
    return 1. - minDist;
  }

  float worleyFbm(vec3 p, float freq) {
    return worleyNoise(p * freq, freq) * .625 +
           worleyNoise(p * freq * 2., freq * 2.) * .25 +
           worleyNoise(p * freq * 4., freq * 4.) * .125;
  }
`

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

// 128³ RGBA: R = Perlin-Worley, GBA = Worley FBM at rising frequencies (upstream)
class TextureA3DMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: fullscreenVert,
      fragmentShader: /* glsl */ `
        uniform float uZCoord;
        uniform float uSeed;
        varying vec2 vUv;
        ${shaderCommon}
        ${shaderPerlin}
        ${shaderWorley}
        void main() {
          vec3 pos = vec3(vUv, uZCoord);
          pos += hash33(vec3(uSeed)) * 100.0;
          float baseFreq = 4.0;
          float worleyFbmA = worleyFbm(pos, baseFreq);
          float worleyFbmB = worleyFbm(pos, baseFreq * 2.0);
          float worleyFbmC = worleyFbm(pos, baseFreq * 4.0);
          float pf = perlinFbm(pos, baseFreq, 7);
          float worleyPerlin = remap(pf, 0.0, 1.0, worleyFbmA, 1.0);
          gl_FragColor = vec4(worleyPerlin, worleyFbmA, worleyFbmB, worleyFbmC);
        }
      `,
      uniforms: { uZCoord: { value: 0 }, uSeed: { value: 1 } },
    })
  }
}

// 256² envelope: min height, perlin max height, cloud type ramp (upstream)
class TextureEnvelopeMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: fullscreenVert,
      fragmentShader: /* glsl */ `
        uniform float uSeed;
        varying vec2 vUv;
        ${shaderCommon}
        ${shaderPerlin}
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          float minHeight = 0.25;
          float scaleA = 2.0;
          float seedA = hash(2.0);
          float perlinA = perlinNoise(vec3((uv + (seedA * 1000.0)) * scaleA, 0.0), scaleA);
          perlinA = remap(perlinA, -1.0, 1.0, 0.0, 1.0);
          gl_FragColor = vec4(minHeight, perlinA, 0.0, 0.0);
        }
      `,
      uniforms: { uSeed: { value: 1 } },
    })
  }
}

// generate the shared noise textures once with the app's renderer
let sharedTextures = null
function buildSharedTextures(renderer) {
  if (sharedTextures) return sharedTextures
  const textureA3D = new THREE.WebGL3DRenderTarget(128, 128, 128, {
    depthBuffer: false,
    stencilBuffer: false,
  })
  textureA3D.texture.format = THREE.RGBAFormat
  textureA3D.texture.type = THREE.UnsignedByteType
  textureA3D.texture.minFilter = THREE.LinearFilter
  textureA3D.texture.magFilter = THREE.LinearFilter
  textureA3D.texture.wrapS = textureA3D.texture.wrapT = textureA3D.texture.wrapR = THREE.RepeatWrapping
  textureA3D.texture.generateMipmaps = false

  const textureEnvelope = new THREE.WebGLRenderTarget(256, 256, {
    depthBuffer: false,
    stencilBuffer: false,
  })
  textureEnvelope.texture.format = THREE.RGBAFormat
  textureEnvelope.texture.type = THREE.UnsignedByteType
  textureEnvelope.texture.minFilter = THREE.LinearFilter
  textureEnvelope.texture.magFilter = THREE.LinearFilter
  textureEnvelope.texture.generateMipmaps = false

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null)
  const prevTarget = renderer.getRenderTarget()

  const matA = new TextureA3DMaterial()
  quad.material = matA
  for (let i = 0; i < 128; i++) {
    matA.uniforms.uZCoord.value = i / 128
    renderer.setRenderTarget(textureA3D, i)
    renderer.render(quad, quadCam)
  }

  const matE = new TextureEnvelopeMaterial()
  quad.material = matE
  renderer.setRenderTarget(textureEnvelope)
  renderer.render(quad, quadCam)

  renderer.setRenderTarget(prevTarget)
  quad.geometry.dispose()
  matA.dispose()
  matE.dispose()

  sharedTextures = { textureA3D, textureEnvelope }
  return sharedTextures
}

// ========== the in-scene cloud material (upstream density + lighting) ==========
class CloudDeckMaterial extends THREE.ShaderMaterial {
  constructor(textures) {
    super({
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp sampler3D;
        #define PI 3.14159265359
        #define MAX_STEPS 128
        #define N_LIGHT_STEPS 4

        const float darknessThreshold = 0.025;
        const float lightAbsorption = 1.0;
        const float anisotropicFactor = 0.4;
        const float phaseMix = 0.4;
        const vec3 lightColor = vec3(1.0);
        const vec3 ambientLightColor = vec3(1.0) * 0.4;

        varying vec3 vWorldPos;

        uniform sampler3D uTextureA;
        uniform sampler2D uTextureEnvelope;
        uniform vec3 uBoxMin;
        uniform vec3 uBoxMax;
        uniform float uTime;
        uniform float uDensityScale;
        uniform float uCloudSpeed;
        uniform float uLightBrightness;
        uniform float uCloudScale;
        uniform float uCoverage;    // 0 = full sheet, higher = broken cumulus field
        uniform float uLightStep;   // world-units light-march step (box-scaled)
        uniform vec3 uLightDir;     // direction the sunlight TRAVELS (sun → scene)

        struct Ray { vec3 origin; vec3 dir; };

        vec2 intersectAABB(Ray ray, vec3 boxMin, vec3 boxMax) {
          vec3 tMin = (boxMin - ray.origin) / ray.dir;
          vec3 tMax = (boxMax - ray.origin) / ray.dir;
          vec3 t1 = min(tMin, tMax);
          vec3 t2 = max(tMin, tMax);
          float tNear = max(max(t1.x, t1.y), t1.z);
          float tFar = min(min(t2.x, t2.y), t2.z);
          return vec2(tNear, tFar);
        }

        float saturate2(float v) { return clamp(v, 0.0, 1.0); }
        float remap(float x, float a, float b, float c, float d) {
          return (((x - a) / (b - a)) * (d - c)) + c;
        }

        float getDimensionalProfile(vec3 p) {
          vec4 env = texture(uTextureEnvelope, p.xz);
          float minHeight = env.r;
          float maxHeight = env.g;
          float clampedHeight = p.y * step(minHeight, p.y) * step(p.y, maxHeight);
          float height = remap(clampedHeight, minHeight, maxHeight, 0.0, 1.0);
          height = 1.0 - abs(height - 0.5) * 2.0;
          float edgeGradient = 1.0 - saturate2(length(p.xz - 0.5) * 2.0);
          return height * edgeGradient;
        }

        float getCloudDensity(vec3 wp) {
          vec3 p = (wp - uBoxMin) / (uBoxMax - uBoxMin);
          vec3 coord = p * uCloudScale;
          coord.x += uTime * uCloudSpeed;
          coord = mod(coord, 1.0);
          float perlinWorley = texture(uTextureA, coord).r;
          float dimensionalProfile = getDimensionalProfile(p);
          // coverage: a low-frequency Worley read (texture A's G channel, drifting
          // with the deck) gates the profile so the sheet breaks into separate
          // cloud masses with clear sky between — the one addition to upstream.
          // Squaring lowers the Worley's high mean so the gate actually bites.
          vec2 cuv = p.xz * 0.9;
          cuv.x += uTime * uCloudSpeed * 0.45;
          float coverage = texture(uTextureA, vec3(fract(cuv), 0.35)).g;
          coverage *= coverage;
          float gate = smoothstep(uCoverage, uCoverage + 0.22, coverage);
          return saturate2(perlinWorley - (1.0 - dimensionalProfile * gate));
        }

        float beersLaw(float density, float absorptionCoefficient) {
          return exp(-absorptionCoefficient * density);
        }

        float henyeyGreenstein(float g, float cosTheta) {
          float g2 = g * g;
          return 1.0 / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
        }

        float dualLobeHenyeyGreenstein(float g, float cosTheta, float K) {
          return mix(henyeyGreenstein(g, cosTheta), henyeyGreenstein(-g, cosTheta), K);
        }

        float multipleScattering(float depth, float g, float cosTheta, float K) {
          float attenuation = 0.5;
          float contribution = 0.5;
          float phaseAttenuation = 0.1;
          float luminance = 0.0;
          float a = 1.0;
          float b = 1.0;
          float c = 1.0;
          for (int i = 0; i < 4; i++) {
            float beer = beersLaw(depth, a);
            float phase = dualLobeHenyeyGreenstein(g * c, cosTheta, K);
            luminance += b * phase * beer;
            a *= attenuation;
            b *= contribution;
            c *= (1.0 - phaseAttenuation);
          }
          return luminance;
        }

        vec3 marchDirectionalLight(vec3 wp, vec3 lightDirection, float cosTheta) {
          float lightDensity = 0.0;
          for (int j = 1; j <= N_LIGHT_STEPS; j++) {
            vec3 lsp = wp - lightDirection * (uLightStep * float(j));
            lightDensity += saturate2(getCloudDensity(lsp)) * uDensityScale;
            if (lightDensity >= 1.0) break;
          }
          return vec3(multipleScattering(lightDensity, anisotropicFactor, cosTheta, phaseMix));
        }

        // upstream ray march, parameterised on s∈[0,1] over [near,far] so the
        // adaptive-refinement bookkeeping works for a non-unit box
        vec4 rayMarch(vec3 ro, vec3 rd, float near, float far) {
          vec3 finalColor = vec3(0.0);
          float transmittance = 1.0;
          float density = 0.0;
          vec3 lightDirection = normalize(uLightDir);
          float cosTheta = dot(rd, lightDirection);
          float stepSize = 1.0 / float(MAX_STEPS);
          float adaptiveStepSize = stepSize;
          int steps = MAX_STEPS;
          float s = 0.0;
          bool hasHit = false;
          for (int i = 0; i < 384; i++) {
            if (i >= steps) break;
            s += adaptiveStepSize;
            if (s >= 1.0) break;
            vec3 wp = ro + rd * mix(near, far, s);
            float _density = saturate2(getCloudDensity(wp));
            density += _density * uDensityScale;
            if (_density > 0.0) {
              if (!hasHit) {
                hasHit = true;
                s -= adaptiveStepSize;
                adaptiveStepSize *= 0.5;
                steps = int(1.0 / adaptiveStepSize);
                continue;
              }
              vec3 luminance = marchDirectionalLight(wp, lightDirection, cosTheta);
              finalColor += lightColor * uLightBrightness * luminance * density * transmittance;
              transmittance *= beersLaw(density, lightAbsorption);
              finalColor += ambientLightColor * density * transmittance;
            } else if (hasHit) {
              hasHit = false;
              adaptiveStepSize = stepSize;
              steps = MAX_STEPS;
            }
            if (density >= 1.0) break;
          }
          return vec4(finalColor, 1.0 - transmittance);
        }

        void main() {
          Ray ray;
          ray.origin = cameraPosition;
          ray.dir = normalize(vWorldPos - cameraPosition);
          vec2 nearFar = intersectAABB(ray, uBoxMin, uBoxMax);
          nearFar.x = max(nearFar.x, 0.0); // camera inside the box
          if (nearFar.y <= nearFar.x) discard;
          vec4 color = rayMarch(ray.origin, ray.dir, nearFar.x, nearFar.y);
          if (color.a < 0.01) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: {
        uTextureA: { value: textures.textureA3D.texture },
        uTextureEnvelope: { value: textures.textureEnvelope.texture },
        uBoxMin: { value: new THREE.Vector3() },
        uBoxMax: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uDensityScale: { value: 1.0 },
        uCloudSpeed: { value: 0.05 },
        uLightBrightness: { value: 2.0 },
        uCloudScale: { value: 2.0 },
        uCoverage: { value: 0.45 },
        uLightStep: { value: 1.0 },
        uLightDir: { value: new THREE.Vector3(-0.5, -0.7, -0.4) },
      },
      transparent: true,
      depthWrite: false,
      // the ground-contact/occlusion tradeoff matches the app's previous clouds:
      // no depth test, drawn late; rays clamp to the box so nothing leaks far
      depthTest: false,
      side: THREE.BackSide,
      // the march accumulates premultiplied radiance — blend accordingly
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })
  }
}

export class Clouds {
  constructor(scene, terrain, params, renderer) {
    this.terrain = terrain
    this.renderer = renderer
    this.group = new THREE.Group()
    this.group.name = 'clouds'
    scene.add(this.group)
    this.deck = null
    this.time = 0
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.4)
    this.build(params)
  }

  // sunlight travel direction = opposite of the direction to the sun
  setSunDir(v) {
    this.sunDir.copy(v).normalize()
    if (this.deck) this.deck.material.uniforms.uLightDir.value.copy(this.sunDir).negate()
  }

  build(params) {
    this._dispose()
    if (!params.cloudsEnabled || !this.renderer) return
    const textures = buildSharedTextures(this.renderer)

    // deck footprint = the whole map; it floats clear above the tallest relief
    const half = TERRAIN_SIZE / 2
    let maxY = 0
    if (this.terrain.sample) {
      for (let j = 0; j <= 16; j++)
        for (let i = 0; i <= 16; i++) {
          const y = this.terrain.sample(-half + (TERRAIN_SIZE * i) / 16, -half + (TERRAIN_SIZE * j) / 16)
          if (y > maxY) maxY = y
        }
    }
    const bottom = maxY + 0.8 + (params.cloudAltitude ?? 2.6) * 0.5
    // thick enough for the vertical profile to billow (flat-ish base, domed tops)
    const thickness = 7.5 + (params.cloudAltitude ?? 2.6) * 0.8

    const material = new CloudDeckMaterial(textures)
    const min = new THREE.Vector3(-half, bottom, -half)
    const max = new THREE.Vector3(half, bottom + thickness, half)
    material.uniforms.uBoxMin.value.copy(min)
    material.uniforms.uBoxMax.value.copy(max)
    // keep the light march proportional to the box like upstream's unit box
    material.uniforms.uLightStep.value = 0.02 * TERRAIN_SIZE
    material.uniforms.uLightDir.value.copy(this.sunDir).negate()

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.position.set(0, bottom + thickness / 2, 0)
    mesh.scale.set(TERRAIN_SIZE, thickness, TERRAIN_SIZE)
    mesh.renderOrder = 15
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.deck = mesh
  }

  update(dt, params) {
    if (!params.cloudsEnabled || !this.group.visible || !this.deck) return
    this.time += dt
    const u = this.deck.material.uniforms
    u.uTime.value = this.time
    u.uCloudSpeed.value = (params.cloudDrift ?? 1) * 0.03
    u.uDensityScale.value = params.cloudOpacity ?? 1
    u.uCloudScale.value = params.cloudScale ?? 2
    u.uCoverage.value = params.cloudCoverage ?? 0.45
    u.uLightBrightness.value = params.cloudBrightness ?? 2
  }

  setVisible(v) {
    this.group.visible = v
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
