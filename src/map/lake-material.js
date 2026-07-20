// The lake surface: a graded blue that catches the sun.
//
// WHY A CUSTOM SHADER and not a stock material. The obvious candidate is
// MeshPhysicalMaterial at roughness ~0.05 — physically the right model for a
// smooth dielectric. It was rejected for two concrete reasons:
//   * its reflections come from scene.environment, which here is a
//     RoomEnvironment PMREM — an INDOOR probe. A lake mirroring a studio is
//     worse than a lake mirroring nothing.
//   * it cannot produce the graded body colour the brief asks for ("pas
//     purement bleu, des dégradés de bleu avec de légères variantes").
// What actually makes water read as water is cheap and specific: Fresnel
// (edge-on it turns to sky, face-on you see its depth) plus a tight specular
// glint from the sun. Both are a few lines, and they stay in the app's quiet
// editorial register instead of chasing photoreal waves.
//
// The geometry is unchanged: the same flat, block-clipped lake mesh (see
// water-layer.js). This is the "couche de matière par dessus" as a material,
// not a second mesh — one draw call, no z-fighting between two coincident
// coplanar surfaces, same result.

import * as THREE from 'three'

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rgb2hex = (r) => '#' + r.map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0')).join('')
const scale = (h, k) => rgb2hex(hex2rgb(h).map((v) => v * k))

// Body-colour ramp derived from the layer's own lake ink, so the gradient
// always belongs to the active palette (and to dark mode) instead of being a
// second hard-coded blue that drifts out of sync. Deep is the ink pushed
// down, shallow is it lifted toward its own light — a tonal spread, never a
// hue change, which is what keeps it reading as one body of water.
// Exported for tests.
export function lakeGradient(inkHex) {
  return {
    deep: scale(inkHex, 0.62),
    shallow: scale(inkHex, 1.38),
  }
}

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

  uniform vec3 uDeep;      // body colour, low end
  uniform vec3 uShallow;   // body colour, high end
  uniform vec3 uSky;       // what the surface turns into edge-on (Fresnel)
  uniform vec3 uSunDir;    // direction TO the sun, normalised
  uniform vec3 uSunColor;
  uniform float uSunStrength;
  uniform float uOpacity;
  uniform float uHalf;     // block half-width, for normalising world XZ

  // value noise — two octaves is all the "variante" this needs; more would
  // start to look like waves, which is not the register we're in
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    // Flat normal, by design. Perturbing it with noise to smear the highlight
    // was tried and rejected on sight: at any amplitude coarse enough to widen
    // the glint it broke the surface into a chequerboard of sequins — photoreal
    // ambitions the rest of this map does not share. The highlight is widened
    // by opening the SPECULAR LOBE instead (below), which gives one smooth
    // sheet of light and stays in the app's quiet register.
    vec3 N = vec3(0.0, 1.0, 0.0);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // --- body: a broad diagonal ramp, softened by low-frequency noise so the
    // gradient never reads as a straight mechanical wipe across the surface
    vec2 p = vWorldPos.xz / uHalf;
    float ramp = clamp((p.x + p.y) * 0.35 + 0.5, 0.0, 1.0);
    float grain = vnoise(p * 1.7) * 0.55 + vnoise(p * 4.3) * 0.25;
    float t = clamp(ramp * 0.75 + grain * 0.35, 0.0, 1.0);
    vec3 body = mix(uDeep, uShallow, t);

    // --- Fresnel: looking straight down you see the water's body; at a
    // grazing angle the surface becomes a mirror of the sky. This single term
    // is most of what distinguishes water from blue paint.
    float f = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    float fresnel = 0.02 + 0.6 * f; // F0 for water is ~0.02
    vec3 col = mix(body, uSky, fresnel);

    // --- sun glint: Blinn-Phong, deliberately tight. The sun only lights the
    // water when it is actually above the horizon (L.y > 0), so the glint dies
    // with the day instead of shining out of the ground at night.
    float above = smoothstep(0.0, 0.12, L.y);
    vec3 H = normalize(L + V);
    // Exponent chosen by measurement, not taste alone: at 220 the lobe was so
    // tight it never landed in frame (the lake's peak brightness did not move
    // at all); ~26 spreads it into a band that reads as the sun lying on the
    // water, without becoming a white blowout.
    float spec = pow(max(dot(N, H), 0.0), 26.0);
    // a second, much wider lobe: the soft sheet of brightness a water surface
    // always carries around the glint proper
    float sheen = pow(max(dot(N, H), 0.0), 5.0) * 0.10;
    // HDR on purpose: 0.85 peaked exactly AT the bloom threshold (0.85), so
    // the glint could never ignite it — measured, not a coincidence you want.
    // 3.0 pushes the core well past threshold; the HalfFloat buffer carries it
    // and bloom turns it into the actual sun-on-water flare.
    col += uSunColor * (spec * 3.0 + sheen) * uSunStrength * above;

    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }
`

// `ink` is the layer's lake colour, `sky` the hemisphere sky tint (so the
// Fresnel edge matches the hour of day), `sunDir`/`sunColor` come from the
// day cycle. polygonOffset matches the old fill material so the lake still
// wins against the other draped layers.
export function makeLakeMaterial({ ink, sky, opacity, half, sunDir, sunColor, sunStrength = 1 }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true, // the terrain must still occlude the lake
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    uniforms: {
      uDeep: { value: new THREE.Color(lakeGradient(ink).deep) },
      uShallow: { value: new THREE.Color(lakeGradient(ink).shallow) },
      uSky: { value: new THREE.Color(sky ?? '#bcd4ff') },
      uSunDir: { value: (sunDir ? sunDir.clone() : new THREE.Vector3(0, 1, 0)).normalize() },
      uSunColor: { value: new THREE.Color(sunColor ?? '#fff4ea') },
      uSunStrength: { value: sunStrength },
      uOpacity: { value: opacity },
      uHalf: { value: half },
    },
  })
}
