// FANCY backdrops — selectable animated "paper shader" backgrounds behind
// the floating relief block (Scan > Fancy, next to the Liquid metal toggle).
//
// Why not a DOM background behind the canvas? The renderer is created with
// alpha:false and draws through a postprocessing composer, so nothing behind
// the WebGL canvas can ever show through it. Instead we mount each shader
// into a hidden-but-live host <div>, mirror its canvas into a
// THREE.CanvasTexture, and hand that texture to scene.background — same
// pixels, routed through Three instead of CSS stacking.
//
// GOTCHA #1 — ShaderMount's `speed` is a constructor argument, not a uniform.
// `new ShaderMount(el, frag, uniforms, ctxAttrs, speed, frame, ...)`. Leaving
// it out defaults to 0, which the library treats as "static": its internal
// rAF loop never starts. Every animated entry below carries its own `speed`
// value used at mount time — do not fold it into `uniforms`.
//
// GOTCHA #2 — the *-react package (used by the Creative Center) does the
// friendly-params → u_-uniform mapping for you. This is the framework-free
// core package, so that mapping is inlined here per shader (ported from
// @paper-design/shaders-react's source, not guessed).
//
// GOTCHA #3 — a handful of shaders (grain-gradient, warp, dot-orbit,
// voronoi, metaballs, smoke-ring, god-rays, pulsing-border, paper-texture)
// read a `u_noiseTexture` uniform that the library only ships as a helper,
// `getShaderNoiseTexture()` (an embedded data-URI PNG) — call it per mount.
//
// Shaders that only make sense as an image filter (u_image REQUIRED, no
// image = blank) are intentionally excluded: heatmap, image-dithering,
// halftone-dots, halftone-cmyk, fluted-glass, gem-smoke. water,
// paper-texture and liquid-metal accept an OPTIONAL image — we simply never
// set u_image for them, which is exactly how their own presets render an
// image-free abstract look.

import * as THREE from 'three'
import {
  ShaderMount,
  getShaderColorFromString as c,
  getShaderNoiseTexture,
  meshGradientFragmentShader,
  staticMeshGradientFragmentShader,
  staticRadialGradientFragmentShader,
  grainGradientFragmentShader,
  GrainGradientShapes,
  warpFragmentShader,
  WarpPatterns,
  perlinNoiseFragmentShader,
  simplexNoiseFragmentShader,
  neuroNoiseFragmentShader,
  dotGridFragmentShader,
  DotGridShapes,
  dotOrbitFragmentShader,
  voronoiFragmentShader,
  wavesFragmentShader,
  spiralFragmentShader,
  swirlFragmentShader,
  colorPanelsFragmentShader,
  metaballsFragmentShader,
  smokeRingFragmentShader,
  godRaysFragmentShader,
  pulsingBorderFragmentShader,
  PulsingBorderAspectRatios,
  ditheringFragmentShader,
  DitheringShapes,
  DitheringTypes,
  waterFragmentShader,
  paperTextureFragmentShader,
  liquidMetalFragmentShader,
  LiquidMetalShapes,
} from '@paper-design/shaders'

// quiet, on-brand palette — muted paper tones + a whisper of the app accent.
// This sits behind the relief; it must read as atmosphere, not decoration.
const INK = '#2b2620' // v28 --ce-ink neighbourhood
const DEEP = '#17140f'
const PAPER = '#f4efe6'
const MIST = '#d8d2c4'
const STONE = '#cabfa9'
const CLAY = '#a9765a'
const SLATE = '#8a92a0'

const COVER = 2 // ShaderFitOptions.cover — full-bleed, no letterboxing
const NONE = 0 // ShaderFitOptions.none — patterns tile at their own scale

// shared sizing uniforms every shader expects (object- and pattern-sizing
// shapes both use this same uniform set, they just default `fit` differently
// upstream — we pass `fit` explicitly per entry instead of relying on that)
function sizing(fit, extra = {}) {
  return {
    u_fit: fit,
    u_rotation: 0,
    u_scale: 1,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
    ...extra,
  }
}

export const SHADERS = [
  {
    id: 'mesh-gradient',
    label: 'Mesh gradient',
    fragment: meshGradientFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colors: [PAPER, STONE, CLAY, INK].map(c),
      u_colorsCount: 4,
      u_distortion: 0.6,
      u_swirl: 0.08,
      u_grainMixer: 0,
      u_grainOverlay: 0.05,
      ...sizing(COVER),
    },
  },
  {
    id: 'static-mesh-gradient',
    label: 'Mesh static',
    fragment: staticMeshGradientFragmentShader,
    speed: 0,
    uniforms: {
      u_colors: [PAPER, STONE, CLAY, MIST].map(c),
      u_colorsCount: 4,
      u_positions: 2,
      u_waveX: 1,
      u_waveXShift: 0.6,
      u_waveY: 1,
      u_waveYShift: 0.21,
      u_mixing: 0.7,
      u_grainMixer: 0,
      u_grainOverlay: 0.04,
      ...sizing(COVER, { u_rotation: 270 }),
    },
  },
  {
    id: 'static-radial-gradient',
    label: 'Radial static',
    fragment: staticRadialGradientFragmentShader,
    speed: 0,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [STONE, PAPER, MIST].map(c),
      u_colorsCount: 3,
      u_radius: 0.9,
      u_focalDistance: 0.9,
      u_focalAngle: 0,
      u_falloff: 0.3,
      u_mixing: 0.6,
      u_distortion: 0,
      u_distortionShift: 0,
      u_distortionFreq: 12,
      u_grainMixer: 0,
      u_grainOverlay: 0.04,
      ...sizing(COVER),
    },
  },
  {
    id: 'grain-gradient',
    label: 'Grain gradient',
    fragment: grainGradientFragmentShader,
    speed: 0.12,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [STONE, CLAY, PAPER, MIST].map(c),
      u_colorsCount: 4,
      u_softness: 0.6,
      u_intensity: 0.35,
      u_noise: 0.2,
      u_shape: GrainGradientShapes.sphere,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER),
    },
  },
  {
    id: 'warp',
    label: 'Warp',
    fragment: warpFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colors: [INK, CLAY, INK, STONE].map(c),
      u_colorsCount: 4,
      u_proportion: 0.45,
      u_softness: 1,
      u_distortion: 0.15,
      u_swirl: 0.4,
      u_swirlIterations: 8,
      u_shapeScale: 0.08,
      u_shape: WarpPatterns.checks,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(NONE),
    },
  },
  {
    id: 'perlin-noise',
    label: 'Perlin noise',
    fragment: perlinNoiseFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colorBack: c(PAPER),
      u_colorFront: c(STONE),
      u_proportion: 0.35,
      u_softness: 0.4,
      u_octaveCount: 3,
      u_persistence: 0.6,
      u_lacunarity: 1.8,
      ...sizing(NONE),
    },
  },
  {
    id: 'simplex-noise',
    label: 'Simplex noise',
    fragment: simplexNoiseFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colors: [STONE, PAPER, CLAY, MIST, INK].map(c),
      u_colorsCount: 5,
      u_stepsPerColor: 3,
      u_softness: 0.3,
      ...sizing(NONE, { u_scale: 0.6 }),
    },
  },
  {
    id: 'neuro-noise',
    label: 'Neuro noise',
    fragment: neuroNoiseFragmentShader,
    speed: 0.2,
    uniforms: {
      u_colorFront: c(PAPER),
      u_colorMid: c(STONE),
      u_colorBack: c(INK),
      u_brightness: 0.06,
      u_contrast: 0.25,
      ...sizing(NONE),
    },
  },
  {
    id: 'dot-grid',
    label: 'Dot grid',
    fragment: dotGridFragmentShader,
    speed: 0, // static pattern — no time-based motion in this shader at all
    uniforms: {
      u_colorBack: c(PAPER),
      u_colorFill: c(STONE),
      u_colorStroke: c(CLAY),
      u_dotSize: 2,
      u_gapX: 34,
      u_gapY: 34,
      u_strokeWidth: 1,
      u_sizeRange: 0,
      u_opacityRange: 0,
      u_shape: DotGridShapes.circle,
      ...sizing(NONE),
    },
  },
  {
    id: 'dot-orbit',
    label: 'Dot orbit',
    fragment: dotOrbitFragmentShader,
    speed: 0.3,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [CLAY, STONE, PAPER, MIST, INK].map(c),
      u_colorsCount: 5,
      u_size: 1,
      u_sizeRange: 0.3,
      u_spreading: 1,
      u_stepsPerColor: 3,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(NONE),
    },
  },
  {
    id: 'voronoi',
    label: 'Voronoi',
    fragment: voronoiFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colors: [STONE, CLAY].map(c),
      u_colorsCount: 2,
      u_stepsPerColor: 3,
      u_colorGlow: c(PAPER),
      u_colorGap: c(INK),
      u_distortion: 0.35,
      u_gap: 0.05,
      u_glow: 0.15,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(NONE, { u_scale: 0.5 }),
    },
  },
  {
    id: 'waves',
    label: 'Waves',
    fragment: wavesFragmentShader,
    speed: 0, // static pattern — waves has no time uniform in its own shape math
    uniforms: {
      u_colorFront: c(STONE),
      u_colorBack: c(PAPER),
      u_shape: 0,
      u_frequency: 0.4,
      u_amplitude: 0.4,
      u_spacing: 1.3,
      u_proportion: 0.12,
      u_softness: 0.2,
      ...sizing(NONE, { u_scale: 0.6 }),
    },
  },
  {
    id: 'spiral',
    label: 'Spiral',
    fragment: spiralFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colorBack: c(INK),
      u_colorFront: c(STONE),
      u_density: 1,
      u_distortion: 0.1,
      u_strokeWidth: 0.4,
      u_strokeTaper: 0.2,
      u_strokeCap: 1,
      u_noiseFrequency: 0,
      u_noise: 0,
      u_softness: 0.3,
      ...sizing(NONE),
    },
  },
  {
    id: 'swirl',
    label: 'Swirl',
    fragment: swirlFragmentShader,
    speed: 0.12,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [PAPER, CLAY, INK].map(c),
      u_colorsCount: 3,
      u_bandCount: 4,
      u_twist: 0.08,
      u_center: 0.2,
      u_proportion: 0.5,
      u_softness: 0.15,
      u_noiseFrequency: 0.3,
      u_noise: 0.15,
      ...sizing(COVER),
    },
  },
  {
    id: 'color-panels',
    label: 'Color panels',
    fragment: colorPanelsFragmentShader,
    speed: 0.1,
    uniforms: {
      u_colors: [STONE, CLAY, MIST, PAPER].map(c),
      u_colorsCount: 4,
      u_colorBack: c(INK),
      u_angle1: 0,
      u_angle2: 0,
      u_length: 1,
      u_edges: false,
      u_blur: 0.1,
      u_fadeIn: 1,
      u_fadeOut: 0.3,
      u_density: 3,
      u_gradient: 0.2,
      ...sizing(COVER, { u_scale: 0.8 }),
    },
  },
  {
    id: 'metaballs',
    label: 'Metaballs',
    fragment: metaballsFragmentShader,
    speed: 0.2,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [CLAY, STONE, PAPER].map(c),
      u_colorsCount: 3,
      u_size: 0.8,
      u_count: 6,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER),
    },
  },
  {
    id: 'smoke-ring',
    label: 'Smoke ring',
    fragment: smokeRingFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: [MIST].map(c),
      u_colorsCount: 1,
      u_noiseScale: 3,
      u_thickness: 0.6,
      u_radius: 0.28,
      u_innerShape: 0.6,
      u_noiseIterations: 6,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER, { u_scale: 0.8 }),
    },
  },
  {
    id: 'god-rays',
    label: 'God rays',
    fragment: godRaysFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colorBloom: c(MIST),
      u_colorBack: c(INK),
      u_colors: ['#a9765a6e', '#cabfa9f0', PAPER, MIST].map(c),
      u_colorsCount: 4,
      u_density: 0.25,
      u_spotty: 0.2,
      u_midIntensity: 0.3,
      u_midSize: 0.2,
      u_intensity: 0.5,
      u_bloom: 0.25,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER, { u_offsetY: -0.4 }),
    },
  },
  {
    id: 'pulsing-border',
    label: 'Pulsing border',
    fragment: pulsingBorderFragmentShader,
    speed: 0.2,
    uniforms: {
      u_colorBack: c(INK),
      u_colors: ['#a9765acc', '#cabfa9cc', '#f4efe6cc'].map(c),
      u_colorsCount: 3,
      u_roundness: 0.25,
      u_thickness: 0.08,
      u_marginLeft: 0,
      u_marginRight: 0,
      u_marginTop: 0,
      u_marginBottom: 0,
      u_aspectRatio: PulsingBorderAspectRatios.auto,
      u_softness: 0.75,
      u_intensity: 0.15,
      u_bloom: 0.2,
      u_spots: 4,
      u_spotSize: 0.5,
      u_pulse: 0.15,
      u_smoke: 0.25,
      u_smokeSize: 0.5,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER, { u_scale: 0.6 }),
    },
  },
  {
    id: 'dithering',
    label: 'Dithering',
    fragment: ditheringFragmentShader,
    speed: 0.15,
    uniforms: {
      u_colorBack: c(INK),
      u_colorFront: c(STONE),
      u_shape: DitheringShapes.sphere,
      u_type: DitheringTypes['4x4'],
      u_pxSize: 2,
      ...sizing(NONE, { u_scale: 0.6 }),
    },
  },
  {
    id: 'water',
    label: 'Water',
    fragment: waterFragmentShader,
    speed: 0.15,
    uniforms: {
      // no u_image: water renders as an animated abstract texture without one
      u_colorBack: c(SLATE),
      u_colorHighlight: c(PAPER),
      u_highlights: 0.06,
      u_layering: 0.4,
      u_waves: 0.25,
      u_edges: 0.6,
      u_caustic: 0.08,
      u_size: 1,
      ...sizing(COVER, { u_scale: 0.8 }),
    },
  },
  {
    id: 'paper-texture',
    label: 'Paper texture',
    fragment: paperTextureFragmentShader,
    speed: 0, // static in its own presets too — a still, grained surface
    uniforms: {
      // no u_image: paper-texture renders its own fibre/crumple surface
      u_colorFront: c(STONE),
      u_colorBack: c(PAPER),
      u_contrast: 0.25,
      u_roughness: 0.35,
      u_fiber: 0.25,
      u_fiberSize: 0.2,
      u_crumples: 0.2,
      u_crumpleSize: 0.35,
      u_foldCount: 4,
      u_folds: 0.5,
      u_fade: 0,
      u_drops: 0.1,
      u_seed: 5.8,
      u_noiseTexture: getShaderNoiseTexture(),
      ...sizing(COVER, { u_scale: 0.6 }),
    },
  },
  {
    id: 'liquid-metal',
    label: 'Liquid metal (2D)',
    fragment: liquidMetalFragmentShader,
    speed: 0.2,
    uniforms: {
      // no u_image: renders one of the built-in abstract shapes, u_isImage:false
      u_colorBack: c(MIST),
      u_colorTint: c(PAPER),
      u_contour: 0.4,
      u_distortion: 0.05,
      u_softness: 0.15,
      u_repetition: 2,
      u_shiftRed: 0.15,
      u_shiftBlue: 0.15,
      u_angle: 70,
      u_isImage: false,
      u_shape: LiquidMetalShapes.diamond,
      ...sizing(COVER, { u_scale: 0.6 }),
    },
  },
]

const byId = new Map(SHADERS.map((s) => [s.id, s]))

// perf budget for a full-bleed background layer — modest internal resolution
// (upsampled by the GPU when displayed, same trick as a CSS background-size:
// cover on a smaller image); minPixelRatio:1 skips the library's default 2x
// supersampling since this never needs to be pixel-crisp behind the relief
const MIN_PIXEL_RATIO = 1
const MAX_PIXEL_COUNT = 1280 * 800

export class FancyBackdrop {
  constructor({ setBackground }) {
    this.setBackground = setBackground
    this.activeId = null
    this.mount = null
    this.texture = null

    // hidden-but-rendering full-screen host: must be in the DOM and sized so
    // ShaderMount's internal rAF/ResizeObserver actually run. Being occluded
    // by the opaque app canvas (alpha:false + composer) is fine — we only
    // ever read its pixels back out via CanvasTexture, never display it.
    this.host = document.createElement('div')
    this.host.setAttribute('aria-hidden', 'true')
    Object.assign(this.host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '-1',
      pointerEvents: 'none',
      overflow: 'hidden',
    })
    document.body.appendChild(this.host)
  }

  /** id: a SHADERS[].id, or null/'' to clear the backdrop. */
  set(id) {
    const next = id || null
    if (next === this.activeId) return
    this._teardown()
    this.activeId = next
    if (!next) {
      this.setBackground(null)
      return
    }
    const entry = byId.get(next)
    if (!entry) {
      this.activeId = null
      this.setBackground(null)
      return
    }
    this.mount = new ShaderMount(
      this.host,
      entry.fragment,
      entry.uniforms,
      undefined, // webGlContextAttributes — library defaults are fine
      entry.speed,
      0, // frame
      MIN_PIXEL_RATIO,
      MAX_PIXEL_COUNT
    )
    this.texture = new THREE.CanvasTexture(this.mount.canvasElement)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = false
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.setBackground(this.texture)
  }

  /** Call once per app frame; re-uploads the shader's latest pixels to the GPU. */
  update() {
    if (!this.activeId || document.hidden || !this.texture) return
    this.texture.needsUpdate = true
  }

  _teardown() {
    if (this.mount) {
      this.mount.dispose()
      this.mount = null
    }
    if (this.texture) {
      this.texture.dispose()
      this.texture = null
    }
    this.host.replaceChildren()
  }

  dispose() {
    this._teardown()
    this.host.remove()
  }
}
