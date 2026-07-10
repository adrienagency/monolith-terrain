// MeshTransmissionMaterial — the frosted-glass transmission material the
// three.js community reaches for (pmndrs drei / drei-vanilla), adapted for
// this project. MIT.
//
// Lineage & credits:
//   · Original shader by N8Programs (https://github.com/N8python), shipped as
//     drei's MeshTransmissionMaterial (pmndrs/drei, MIT) and ported to vanilla
//     three.js as pmndrs/drei-vanilla (MIT) — the de-facto standard for
//     smooth roughness-driven glass blur in three.js.
//   · Mipped bicubic filtering in the stock three transmission chunk is also
//     by N8 (see three's transmission_pars_fragment).
//
// What this adaptation changes and why:
//   · SAMPLER MODE ONLY — instead of rendering a private FBO every frame
//     (drei's default), we multi-sample three's own built-in transmission
//     buffer (drei's transmissionSampler mode). The renderer fills that
//     buffer automatically whenever a material has transmission > 0, so the
//     material needs NO per-frame hook, works inside any EffectComposer
//     RenderPass, and never sees itself (no feedback).
//   · BLUR DECOUPLED FROM IOR — drei blurs by jittering the shading normal,
//     but refract(-v, n, 1.0) ignores the normal entirely, so at ior 1 the
//     blur vanishes together with the distortion. Here the blur jitters the
//     refraction ray EXIT POINT inside a world-space disk that grows with
//     roughness^2 and path length (a microfacet transmission cone), and the
//     mip-lod frost keeps following roughness instead of
//     roughness*(ior*2-2). Result: ior 1.0 shows the scene behind with ZERO
//     geometric distortion yet fully frosted — exactly what a glass slab over
//     a miniature needs.
//   · Built against the stock three r172 chunks (string-patched from
//     THREE.ShaderChunk at compile time) rather than a frozen copy, so
//     attenuation, dispersion and alpha behaviour stay bit-identical to
//     MeshPhysicalMaterial when the extras are dialed to zero.
//
// Extra properties on top of MeshPhysicalMaterial:
//   samples            (ctor only) transmission taps per pixel, default 6
//   blurStrength       cone width multiplier for the stochastic blur (1)
//   distortion         simplex-noise warp of the shading normal (0 = off;
//                      only visible when ior > 1, by design)
//   distortionScale    noise frequency in world units (0.5)
//   temporalDistortion how much `time` scrolls the noise (0 = frozen)
//   time               feed a clock here (optional) to animate distortion

import * as THREE from 'three'

// noise + hash toolbox from drei's MeshTransmissionMaterial (N8Programs),
// names prefixed to avoid colliding with other shader patches
const mtmNoiseGLSL = /* glsl */ `
uniform float blurStrength;
uniform float distortion;
uniform float distortionScale;
uniform float temporalDistortion;
uniform float time;

vec3 mtmRandom3(vec3 c) {
  float j = 4096.0 * sin(dot(c, vec3(17.0, 59.4, 15.0)));
  vec3 r;
  r.z = fract(512.0 * j);
  j *= .125;
  r.x = fract(512.0 * j);
  j *= .125;
  r.y = fract(512.0 * j);
  return r - 0.5;
}

uint mtmHash(uint x) {
  x += (x << 10u);
  x ^= (x >> 6u);
  x += (x << 3u);
  x ^= (x >> 11u);
  x += (x << 15u);
  return x;
}
uint mtmHash3(uvec3 v) { return mtmHash(v.x ^ mtmHash(v.y) ^ mtmHash(v.z)); }

// uint hash to float in [0,1) via the mantissa bits
float mtmFloatConstruct(uint m) {
  m &= 0x007FFFFFu;
  m |= 0x3F800000u;
  return uintBitsToFloat(m) - 1.0;
}
float mtmRand(const in float seed) {
  return mtmFloatConstruct(mtmHash3(floatBitsToUint(vec3(gl_FragCoord.xy, seed))));
}

const float MTM_F3 = 0.3333333;
const float MTM_G3 = 0.1666667;

float mtmSnoise(vec3 p) {
  vec3 s = floor(p + dot(p, vec3(MTM_F3)));
  vec3 x = p - s + dot(s, vec3(MTM_G3));
  vec3 e = step(vec3(0.0), x - x.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 x1 = x - i1 + MTM_G3;
  vec3 x2 = x - i2 + 2.0 * MTM_G3;
  vec3 x3 = x - 1.0 + 3.0 * MTM_G3;
  vec4 w, d;
  w.x = dot(x, x);
  w.y = dot(x1, x1);
  w.z = dot(x2, x2);
  w.w = dot(x3, x3);
  w = max(0.6 - w, 0.0);
  d.x = dot(mtmRandom3(s), x);
  d.y = dot(mtmRandom3(s + i1), x1);
  d.z = dot(mtmRandom3(s + i2), x2);
  d.w = dot(mtmRandom3(s + 1.0), x3);
  w *= w;
  w *= w;
  d *= w;
  return dot(d, vec4(52.0));
}

float mtmSnoiseFractal(vec3 m) {
  return 0.5333333 * mtmSnoise(m)
       + 0.2666667 * mtmSnoise(2.0 * m)
       + 0.1333333 * mtmSnoise(4.0 * m)
       + 0.0666667 * mtmSnoise(8.0 * m);
}
`

// the multi-sample transmission loop that replaces three's single-tap
// transmission_fragment — stock behaviour preserved when the extras are 0
const mtmTransmissionFragmentGLSL = /* glsl */ `
  material.transmission = transmission;
  material.transmissionAlpha = 1.0;
  material.thickness = thickness;
  material.attenuationDistance = attenuationDistance;
  material.attenuationColor = attenuationColor;

  #ifdef USE_TRANSMISSIONMAP
    material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
  #endif
  #ifdef USE_THICKNESSMAP
    material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
  #endif

  vec3 pos = vWorldPosition;
  vec3 v = normalize( cameraPosition - pos );
  vec3 n = inverseTransformDirection( normal, viewMatrix );

  // optional frosted warp: a slow simplex bend of the shading normal,
  // world-anchored so it never swims with the camera. It only shows when
  // ior > 1 (refract ignores the normal at ior 1), which is exactly the
  // contract: zero distortion while the glass is optically neutral.
  vec3 mtmWarp = vec3( 0.0 );
  if ( distortion > 0.0 ) {
    vec3 tOff = vec3( time, -time, -time ) * temporalDistortion;
    mtmWarp = distortion * vec3(
      mtmSnoiseFractal( pos * distortionScale + tOff ),
      mtmSnoiseFractal( pos.zxy * distortionScale - tOff ),
      mtmSnoiseFractal( pos.yxz * distortionScale + tOff ) );
  }
  vec3 mtmN = normalize( n + mtmWarp );

  // stochastic transmission cone: rough glass spreads the transmitted rays,
  // so jitter the ray exit point inside a disk that grows with roughness^2
  // and the light path length, then average the taps. The centre ray stays
  // dead straight at ior 1 — blur without distortion.
  float mtmCone = roughnessFactor * roughnessFactor * blurStrength * material.thickness;
  int mtmCount = ( mtmCone < 1e-4 && distortion <= 0.0 ) ? 1 : MTM_SAMPLES;
  vec4 transmitted = vec4( 0.0 );
  for ( int i = 0; i < MTM_SAMPLES; i ++ ) {
    if ( i >= mtmCount ) break;
    float fi = float( i ) * 5.0;
    vec3 rnd = vec3( mtmRand( fi ), mtmRand( fi + 1.0 ), mtmRand( fi + 2.0 ) ) - 0.5;
    mtmExitJitter = normalize( rnd + vec3( 1e-5, 2e-5, 3e-5 ) ) * sqrt( mtmRand( fi + 3.0 ) ) * mtmCone;
    transmitted += getIBLVolumeRefraction(
      mtmN, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
      pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
      material.attenuationColor, material.attenuationDistance );
  }
  transmitted /= float( mtmCount );

  material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );

  totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
`

export class MeshTransmissionMaterial extends THREE.MeshPhysicalMaterial {
  constructor(parameters = {}) {
    const {
      samples = 6,
      blurStrength = 1,
      distortion = 0,
      distortionScale = 0.5,
      temporalDistortion = 0,
      time = 0,
      ...physical
    } = parameters
    super(physical)

    this._mtmSamples = Math.max(1, Math.round(samples))
    this.uniforms = {
      blurStrength: { value: blurStrength },
      distortion: { value: distortion },
      distortionScale: { value: distortionScale },
      temporalDistortion: { value: temporalDistortion },
      time: { value: time },
    }

    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)

      // SCOPE: everything below rewrites only THIS material's shader
      // template — the #include tokens in shader.fragmentShader, which three
      // resolves after onBeforeCompile. THREE.ShaderChunk is READ once as
      // the patch base (String.replace returns new strings; the global chunk
      // is never mutated), so every other MeshPhysicalMaterial in the scene
      // keeps compiling against the stock transmission code.
      //
      // The patch, derived from the live r172 chunk instead of a frozen copy:
      // 1. mip-lod frost follows roughness alone, not roughness*(ior*2-2),
      //    so ior 1 still blurs
      // 2. a mutable world-space jitter is added to the refraction ray exit
      //    point (set per tap by the sampling loop below)
      // 3. mip fetches are scrubbed: sprite markers and other HDR odds and
      //    ends can poison the transmission buffer mip chain (NaN or
      //    out-of-range texels that only surface at mid lods, smearing into
      //    solid blots). A bad tap falls back to the crisp lod-0 texel, and
      //    to plain white if even that is unusable.
      // ORDER MATTERS: the textureLod-to-mtmFetch swap must run BEFORE the
      // helper is inserted — otherwise the helper's own textureLod calls get
      // rewritten too and mtmFetch recurses into itself, which GLSL rejects
      // (the helper's mtm-prefixed parameter names guard this a second time).
      const pars = THREE.ShaderChunk.transmission_pars_fragment
        .replace(
          'return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );',
          'return roughness; // MTM: frost decoupled from ior'
        )
        .replaceAll(
          'vec3 refractedRayExit = position + transmissionRay;',
          'vec3 refractedRayExit = position + transmissionRay + mtmExitJitter;'
        )
        .replaceAll('textureLod( tex,', 'mtmFetch( tex,')
        .replace(
          'vec4 bicubic(',
          `bool mtmBad( const in vec4 s ) {
            return !( s.r >= 0.0 && s.g >= 0.0 && s.b >= 0.0 && s.r + s.g + s.b < 65504.0 );
          }
          vec4 mtmFetch( sampler2D mtmTex, vec2 mtmUv, float mtmLod ) {
            vec4 s = textureLod( mtmTex, mtmUv, mtmLod );
            if ( mtmBad( s ) ) {
              s = textureLod( mtmTex, mtmUv, 0.0 );
              if ( mtmBad( s ) ) s = vec4( 1.0 );
            }
            return s;
          }
          vec4 bicubic(`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n#define MTM_SAMPLES ${this._mtmSamples}\nvec3 mtmExitJitter = vec3( 0.0 );\n${mtmNoiseGLSL}`
        )
        .replace('#include <transmission_pars_fragment>', pars)
        .replace('#include <transmission_fragment>', mtmTransmissionFragmentGLSL)
    }

    // convenient property access, drei-style: material.blurStrength = 2 etc.
    for (const name of Object.keys(this.uniforms)) {
      Object.defineProperty(this, name, {
        get: () => this.uniforms[name].value,
        set: (v) => (this.uniforms[name].value = v),
      })
    }
  }

  // instances with different sample counts must not share a compiled program
  customProgramCacheKey() {
    return `mtm_${this._mtmSamples}`
  }
}
