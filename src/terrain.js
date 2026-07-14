import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, ridged, smoothstep, lerp } from './noise.js'
import { sampleDem } from './dem.js'
import { rampColorStops } from './palette.js'
import { buildSeaMask, blurMask } from './sea-mask.js'

export const TERRAIN_SIZE = 56

// 1×1 black texture — inert placeholder for the cloud-shadow sampler
function blackTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat)
  tex.needsUpdate = true
  return tex
}

// 1×1 white texture — inert placeholder for the region-mask sampler
function whiteTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat)
  tex.needsUpdate = true
  return tex
}

export const BASIN_RADIUS = 6.6 // flat excavation floor
export const BASIN_BLEND = 9.0 // where flat floor blends back into mountains
export const FLOOR_Y = -0.35

// CPU-generated terrain: multi-scale FBM + ridged multifractal + domain warping,
// with real vertex normals so PBR lighting and DOF read the actual relief.
export class Terrain {
  constructor(params) {
    // Physical material so the relief can turn to GLASS: `transmission` is real
    // PBR refraction (three renders the scene behind into a buffer), giving the
    // translucent-slab look — dial it with the "transmission (glass)" slider.
    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.color),
      roughness: 1, // actual roughness baked into the roughness map
      metalness: 0,
      vertexColors: true,
      envMapIntensity: params.envMapIntensity,
      transmission: params.transmission ?? 0,
      thickness: 3,
      ior: 1.45,
    })

    // topographic map overlay: hypsometric tint, contour lines and survey grid,
    // computed per-fragment in world space so they drape over the relief
    this.mapUniforms = {
      uTint: { value: params.mapTint },
      uContourInterval: { value: params.contourInterval },
      uContourOpacity: { value: params.contourOpacity },
      uContourWeight: { value: params.contourWeight ?? 0.7 }, // line thickness scale

      uGridStep: { value: params.gridStep },
      uGridOpacity: { value: params.gridOpacity },
      uHeightRange: { value: new THREE.Vector2(-0.5, 2) },
      uRampTex: { value: null },
      uHeightContrast: { value: params.heightContrast },
      uHeightPivot: { value: params.heightPivot },
      uSlopeTint: { value: params.slopeTint },
      uContourColor: { value: new THREE.Color(params.contourColor) },
      // real-world bathymetry: scene-space sea level + depth range (meters
      // mapped through the DEM scale); uSeaY = -9999 disables (procedural)
      uSeaY: { value: -9999 },
      uSeaRange: { value: 1 },
      // ocean mask (sea-mask.js): white = the real sea (connected to the map
      // edge, or a large basin). The height test is ANDed with this so isolated
      // sub-sea DEM pockets render as land valleys, not phantom lakes/inlets.
      uSeaMask: { value: (this._seaPlaceholder = whiteTexture()) },
      uSeaMaskOn: { value: 0 },
      // clip the map to the slab's rounded-rectangle footprint (world XZ) so the
      // block's vertical corners read soft and nothing overhangs the plinth walls
      uSlabHalf: { value: TERRAIN_SIZE / 2 },
      uSlabCorner: { value: (params.slabCorner ?? 0) * TERRAIN_SIZE },
      // drifting cloud shadows, baked by the cloud deck (clouds.js) — a black
      // placeholder keeps the sampler valid until the deck provides its map
      uCloudShadow: { value: blackTexture() },
      uCloudShadowOff: { value: new THREE.Vector2() },
      uCloudShadowK: { value: 0 },
      // superellipse exponent for the corner: 2 = circular arc, higher = squircle
      // (iOS-style continuous corner). Shared with the plinth ring, see plinth.js
      uSlabCornerN: { value: 2 + (params.slabCornerSmoothing ?? 0) * 4 },
      // region cutout ("individualiser la zone"): white-inside/black-outside
      // mask rendered over the DEM footprint (region-mask.js). When uRegionOn
      // the terrain is clipped to the admin boundary and the superellipse slab
      // clip is bypassed. Placeholder stays white so sampling is always valid.
      uRegionMask: { value: (this._regionPlaceholder = whiteTexture()) },
      uRegionOn: { value: 0 },
      uOceanShallow: { value: new THREE.Color(params.oceanShallow ?? '#dce8ec') },
      uOceanMid: { value: new THREE.Color(params.oceanMid ?? '#7fa8b8') },
      uOceanDeep: { value: new THREE.Color(params.oceanDeep ?? '#31576b') },
      uGridColor: { value: new THREE.Color(params.gridColor ?? '#242220') },
      uScanT: { value: -1 }, // scan progress 0..1, negative = inactive
      uScanColor: { value: new THREE.Color(params.scanColor) },
      uScanWidth: { value: params.scanWidth },
      uScanBlur: { value: params.scanBlur },
      uScanDispH: { value: params.scanDispHeight },
      uScanDispW: { value: params.scanDispFalloff },
      uScanType: { value: 0 }, // 0 radar, 1 elevation, 2 gridline, 3 sonar, 4 holo
      uScanOrigin: { value: new THREE.Vector2(0, 0) }, // scan epicenter, world XZ
      uScanMax: { value: TERRAIN_SIZE * 0.75 }, // radius that guarantees full coverage
    }
    this.rebuildRamp(params)
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.mapUniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
uniform float uScanT;
uniform float uScanDispH;
uniform float uScanDispW;
uniform int uScanType;
uniform vec2 uScanOrigin;
uniform float uScanMax;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
// scan wave physically lifts the surface as it sweeps outward from the scan
// origin -- only the radial scans (radar, sonar) displace geometry
if (uScanT >= 0.0 && (uScanType == 0 || uScanType == 3)) {
  float dV = distance(transformed.xz, uScanOrigin);
  // radar eases its radius (matches the fragment ring); sonar rings run linear
  float tV = (uScanType == 0) ? (1.0 - pow(1.0 - uScanT, 3.0)) : uScanT;
  float RV = tV * uScanMax;
  float bumpV = exp(-pow((dV - RV) / max(uScanDispW, 0.05), 2.0));
  float liftScaleV = (uScanType == 3) ? 0.4 : 1.0;
  transformed.y += uScanDispH * liftScaleV * bumpV * (1.0 - smoothstep(0.6, 1.0, uScanT));
}
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
uniform float uTint;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uContourWeight;
uniform float uGridStep;
uniform float uGridOpacity;
uniform vec2 uHeightRange;
uniform sampler2D uRampTex;
uniform float uHeightContrast;
uniform float uHeightPivot;
uniform float uSlopeTint;
uniform float uSeaY;
uniform float uSeaRange;
uniform sampler2D uSeaMask;
uniform float uSeaMaskOn;
uniform vec3 uOceanShallow;
uniform vec3 uOceanMid;
uniform vec3 uOceanDeep;
uniform vec3 uGridColor;
uniform vec3 uContourColor;
uniform float uSlabHalf;
uniform float uSlabCorner;
uniform float uSlabCornerN;
uniform sampler2D uRegionMask;
uniform float uRegionOn;
uniform sampler2D uCloudShadow;
uniform vec2 uCloudShadowOff;
uniform float uCloudShadowK;
uniform float uScanT;
uniform vec3 uScanColor;
uniform float uScanWidth;
uniform float uScanBlur;
uniform int uScanType;
uniform vec2 uScanOrigin;
uniform float uScanMax;

// --- scan helpers (shared by every scan type) ---
// antialiased ring/band mask: 1 at distance R, feathered over width w + blur
float scanBand(float d, float R, float w, float blur) {
  return 1.0 - smoothstep(0.0, max(blur, fwidth(d)), abs(d - R) - w * 0.5);
}
// cheap stateless hash for shimmer / flicker / blocky-reveal patterns
float scanHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // --- region cutout: clip the relief to the admin-boundary mask (white
  // inside / black outside, rendered over the DEM footprint in world XZ by
  // region-mask.js) so the landform stands alone like a country cutout. The
  // mask is pre-blurred, so the 0.5 iso-line cuts a smooth boundary. When
  // active it REPLACES the superellipse slab clip below.
  if (uRegionOn > 0.5) {
    vec2 rmUv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    if (texture2D(uRegionMask, rmUv).r < 0.5) discard;
  } else if (uSlabCorner > 0.0) {
    // --- rounded-rect footprint clip: discard fragments outside the slab's
    // filleted corners so the block's vertical edges read soft (matches the
    // plinth walls). Zero radius = untouched square. SDF of a rounded box.
    vec2 cq = max(abs(vWorldPos.xz) - vec2(uSlabHalf - uSlabCorner), 0.0);
    // superellipse boundary |x|^n + |y|^n = r^n (n=2 circle, higher = squircle);
    // straight edges stay exact (one component is 0), only corners are shaped
    float pn = pow(pow(cq.x, uSlabCornerN) + pow(cq.y, uSlabCornerN), 1.0 / uSlabCornerN);
    if (pn > uSlabCorner) discard;
  }

  // smooth interpolated normal (world space) — screen-space derivatives look blotchy
  vec3 wN = inverseTransformDirection(normalize(vNormal), viewMatrix);
  float slope = 1.0 - clamp(wN.y, 0.0, 1.0);
  // keep the lighting/AO shading from the base surface but let the gradient own the color
  float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));

  // --- map colour, centralised for EVERY template: below sea level (elevation 0
  // = uSeaY) it is ALWAYS the ocean bathymetry ramp; the land hypsometric ramp
  // never bleeds underwater, so displacement noise below 0 keeps the sea colour.
  // The ocean mask gates it: a sub-sea cell only paints as water where the mask
  // says REAL sea (edge-connected / big basin), killing phantom coarse-zoom lakes.
  float seaMask = 1.0;
  if (uSeaMaskOn > 0.5) {
    vec2 smUv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    seaMask = texture2D(uSeaMask, smUv).r;
  }
  bool underwater = vWorldPos.y < uSeaY && seaMask > 0.5;
  float hNorm = clamp((vWorldPos.y - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
  vec3 mapCol;
  if (underwater) {
    float d01 = pow(clamp((uSeaY - vWorldPos.y) / max(uSeaRange, 1e-4), 0.0, 1.0), 0.55);
    // three-stop nautical ramp: shallows → mid blue → abyss
    mapCol = d01 < 0.45
      ? mix(uOceanShallow, uOceanMid, d01 / 0.45)
      : mix(uOceanMid, uOceanDeep, (d01 - 0.45) / 0.55);
  } else {
    // the pivot can never sink below sea level: with a low pivot the whole
    // coastal band rides the top of the ramp and land loses its low tints
    float pivotFloor = uSeaY > -9000.0
      ? clamp((uSeaY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 0.95) + 0.02
      : 0.0;
    float pivot = max(uHeightPivot, pivotFloor);
    float rampT = clamp(0.5 + (hNorm - pivot) * uHeightContrast, 0.0, 1.0);
    mapCol = texture2D(uRampTex, vec2(rampT, 0.5)).rgb;
    mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * clamp(luma * 2.4, 0.2, 1.4), uTint);

  // --- coastline: a fine, discreet line at sea level (elevation 0), drawn in
  // the template ink. Kept thin so the shore reads without shouting.
  if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 1.3, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  }

  // --- drifting cloud shadows, cast by the volumetric deck overhead (strength
  // rises with sun elevation — clouds only throw shadows when the sun is above)
  if (uCloudShadowK > 0.001) {
    vec2 suv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    float cloudShade = texture2D(uCloudShadow, fract(suv + uCloudShadowOff)).r;
    diffuseColor.rgb *= 1.0 - cloudShade * uCloudShadowK;
  }

  // --- contour lines: minor every interval, heavy line every 5th
  float ch = vWorldPos.y / uContourInterval;
  float dch = fwidth(ch);
  float distMinor = abs(fract(ch + 0.5) - 0.5);
  float minorLine = 1.0 - smoothstep(0.0, dch * 1.4 * uContourWeight, distMinor);
  float ch5 = ch / 5.0;
  float dch5 = fwidth(ch5);
  float distMajor = abs(fract(ch5 + 0.5) - 0.5);
  float majorLine = 1.0 - smoothstep(0.0, dch5 * 1.4 * uContourWeight, distMajor);
  // fade contours out only when they crowd below pixel size (far away / near-vertical)
  float crowd = clamp(1.0 - dch * 0.22, 0.0, 1.0);
  float contour = max(minorLine * 0.55, majorLine) * uContourOpacity * crowd;
  diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, contour);

  // --- survey grid in world x/z
  vec2 g = vWorldPos.xz / uGridStep;
  vec2 dg = fwidth(g);
  vec2 distGrid = abs(fract(g + 0.5) - 0.5);
  float gx = 1.0 - smoothstep(0.0, dg.x * 1.4, distGrid.x);
  float gz = 1.0 - smoothstep(0.0, dg.y * 1.4, distGrid.y);
  float grid = max(gx, gz) * uGridOpacity;
  diffuseColor.rgb = mix(diffuseColor.rgb, uGridColor, grid);

  // --- scan effects: 5 selectable sweep styles painted over the map
  // (mix toward uScanColor -- additive-only washes out on white terrain)
  if (uScanT >= 0.0) {
    if (uScanType == 0) {
      // 0 RADAR: eased expanding ring + inner echo ring + filled trail
      float tS = 1.0 - pow(1.0 - uScanT, 3.0);
      float dS = distance(vWorldPos.xz, uScanOrigin);
      float RS = tS * uScanMax;
      float mainS = scanBand(dS, RS, uScanWidth, uScanBlur);
      float echoS = scanBand(dS, RS * 0.82, uScanWidth * 0.6, uScanBlur) * 0.4;
      float trailS = smoothstep(RS, RS - uScanMax * 0.25, dS) * 0.10;
      float fadeS = 1.0 - smoothstep(0.6, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((mainS + echoS + trailS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 1) {
      // 1 ELEVATION SLICE: a horizontal plane rises from sea level (or the
      // terrain floor) to the summit, flashing contour lines in its wake
      float y0S = (uSeaY > -9000.0) ? uSeaY : uHeightRange.x;
      float planeYS = mix(y0S, uHeightRange.y, uScanT);
      float sliceAA = uScanWidth * 0.35 + fwidth(vWorldPos.y);
      float sliceS = 1.0 - smoothstep(0.0, sliceAA, abs(vWorldPos.y - planeYS));
      // contour flash: re-light the contour lines within 1.5 intervals below the plane
      float wakeSpanS = uContourInterval * 1.5;
      float belowS = planeYS - vWorldPos.y; // > 0 under the plane
      float wakeS = (belowS > 0.0) ? (1.0 - smoothstep(0.0, wakeSpanS, belowS)) : 0.0;
      float flashS = max(minorLine * 0.55, majorLine) * wakeS * 0.8;
      float fadeS = 1.0 - smoothstep(0.85, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((sliceS + flashS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 2) {
      // 2 GRIDLINE SWEEP: a bright vertical line marches across the slab in X,
      // shimmering per survey-grid row and re-lighting the grid behind it
      float tS = uScanT < 0.5 ? 2.0 * uScanT * uScanT : 1.0 - pow(-2.0 * uScanT + 2.0, 2.0) * 0.5;
      float lineXS = mix(-uSlabHalf, uSlabHalf, tS);
      float shimmerS = scanHash(vec2(floor(vWorldPos.z / uGridStep), floor(uScanT * 24.0)));
      float dxS = vWorldPos.x - lineXS;
      float lineS = 1.0 - smoothstep(0.0, max(uScanBlur, fwidth(vWorldPos.x)), abs(dxS) - uScanWidth * 0.5);
      lineS *= 0.7 + 0.6 * shimmerS;
      // grid-highlight trail behind the moving line (line travels -X to +X)
      float wakeS = (dxS < 0.0) ? (1.0 - smoothstep(0.0, uSlabHalf * 0.8, -dxS)) : 0.0;
      float trailS = max(gx, gz) * wakeS * 0.35;
      float fadeS = 1.0 - smoothstep(0.85, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp((lineS + trailS) * fadeS, 0.0, 0.95));
    } else if (uScanType == 3) {
      // 3 SONAR: three staggered rings, each fainter and wider, distance-attenuated
      float dS = distance(vWorldPos.xz, uScanOrigin);
      float pingS = 0.0;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ti = uScanT - fi * 0.15;
        if (ti > 0.0) {
          float Ri = ti * uScanMax;
          float attenS = pow(0.55, fi) / (1.0 + dS * 0.06);
          pingS += scanBand(dS, Ri, uScanWidth * (1.0 + fi * 0.4), uScanBlur) * attenS;
        }
      }
      float fadeS = 1.0 - smoothstep(0.7, 1.0, uScanT);
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp(pingS * fadeS, 0.0, 0.95));
    } else if (uScanType == 4) {
      // 4 HOLO: hologram materialisation -- scrolling scanlines, blocky reveal,
      // vertical grille and a global luminance flicker, all under a sine envelope
      float envS = sin(3.14159265359 * uScanT);
      float stripeS = smoothstep(0.35, 0.5, fract(vWorldPos.y * 6.0 - uScanT * 14.0)) * 0.25;
      float grilleS = smoothstep(0.4, 0.5, fract(vWorldPos.x * 4.0)) * 0.15;
      float revealS = step(scanHash(floor(vWorldPos.xz * 3.0)), uScanT * 1.6);
      float flickS = 1.0 + (scanHash(vec2(floor(uScanT * 40.0), 1.0)) - 0.5) * 0.18;
      float holoS = (0.3 + stripeS + grilleS) * revealS * envS * flickS;
      diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp(holoS, 0.0, 0.6));
    }
  }
}`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
// scan ripple: an emissive wavefront expanding from the scan origin across the
// relief -- only the radial scans (radar, sonar) glow
if (uScanT >= 0.0 && (uScanType == 0 || uScanType == 3)) {
  float d = distance(vWorldPos.xz, uScanOrigin);
  float tE = (uScanType == 0) ? (1.0 - pow(1.0 - uScanT, 3.0)) : uScanT;
  float R = tE * uScanMax;
  float band = scanBand(d, R, uScanWidth, uScanBlur);
  float fade = 1.0 - smoothstep(0.6, 1.0, uScanT);
  totalEmissiveRadiance += uScanColor * band * fade * 0.5;
}`
        )
    }
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
    this.dem = null // real-world heightfield, set via setDem()
    this.rebuild(params)
    this.rebuildRoughness(params)
  }

  setDem(dem) {
    this.dem = dem
  }

  // Region cutout ("individualiser la zone"): pass the mask texture built by
  // region-mask.js fetchRegionMask() to clip the relief to an admin boundary,
  // or null to restore the full square slab. The previous mask is disposed.
  setRegionMask(texture) {
    const prev = this.mapUniforms.uRegionMask.value
    if (texture) {
      if (prev !== texture) {
        this.mapUniforms.uRegionMask.value = texture
        if (prev && prev !== this._regionPlaceholder) prev.dispose()
      }
      this.mapUniforms.uRegionOn.value = 1
    } else {
      this._regionPlaceholder ??= whiteTexture()
      this.mapUniforms.uRegionMask.value = this._regionPlaceholder
      if (prev && prev !== this._regionPlaceholder) prev.dispose()
      this.mapUniforms.uRegionOn.value = 0
    }
  }

  // scene height → display elevation in feet (real when a DEM drives the terrain)
  heightToFeet(h) {
    return this._h2ft ? this._h2ft(h) : Math.round(4800 + h * 420)
  }

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    // demExaggeration is the per-zoom value chosen in the UI (coarse blocks big)
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    this._h2ft = (h) => Math.round((h / scale + meanM) * 3.28084)

    const sDetail = new Simplex2(mulberry32(params.seed))
    const { size } = dem
    const { detail, detailScale } = params

    return (x, z) => {
      const px = (x / TERRAIN_SIZE + 0.5) * (size - 1)
      const py = (z / TERRAIN_SIZE + 0.5) * (size - 1)
      const raw = sampleDem(dem, px, py) // elevation in meters
      const h = (raw - meanM) * scale

      // optional fine grain on top of the (smoother) 30m-class data — but FADE it
      // out at/below sea level (elevation 0) so the displacement can never poke
      // above the waterline and paint phantom islands / stray coastlines
      const landFactor = smoothstep(0, 90, raw)
      const fine =
        landFactor *
        (detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
          detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5))
      // no basin carve in real-world mode — the map runs uninterrupted
      return h + fine
    }
  }

  // Height field sampler for the current seed — kept so other objects can query it.
  _makeSampler(params) {
    if (params.source === 'real' && this.dem) return this._makeDemSampler(params)
    this._h2ft = null // procedural: fictional elevations
    const rng = mulberry32(params.seed)
    const sWarp = new Simplex2(rng)
    const sRidge = new Simplex2(rng)
    const sBase = new Simplex2(rng)
    const sDetail = new Simplex2(rng)

    // A handful of explicit impact craters scattered outside the basin
    const craterRng = mulberry32(params.seed ^ 0x9e3779b9)
    const craters = []
    for (let i = 0; i < 7; i++) {
      const a = craterRng() * Math.PI * 2
      const d = 10.5 + craterRng() * 10
      craters.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        r: 1.6 + craterRng() * 2.8,
        depth: (0.45 + craterRng() * 0.9) * params.amplitude * 0.35,
      })
    }

    const { scale, octaves, lacunarity, gain, amplitude, warp, detail, detailScale } = params

    return (x, z) => {
      // domain warp — breaks up the "obviously noise" look
      const wx = x + warp * fbm(sWarp, x * 0.045 + 7.3, z * 0.045 + 2.1, 3, 2.1, 0.5)
      const wz = z + warp * fbm(sWarp, x * 0.045 - 4.7, z * 0.045 + 9.4, 3, 2.1, 0.5)

      // large-scale ridged mountains + mid-scale rolling base
      const m = ridged(sRidge, wx * scale, wz * scale, octaves, lacunarity, gain)
      const base = fbm(sBase, wx * scale * 2.1, wz * scale * 2.1, octaves, lacunarity, gain)
      let h = amplitude * (m * m * 1.2 + base * 0.28)

      // impact craters: bowl + raised rim
      for (const c of craters) {
        const dx = x - c.x
        const dz = z - c.z
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d < c.r * 1.6) {
          const bowl = 1 - smoothstep(0, c.r, d)
          h -= c.depth * bowl * bowl * bowl * 2.2
          const rim = Math.exp(-Math.pow((d - c.r) / (c.r * 0.28), 2))
          h += c.depth * 0.4 * rim
        }
      }

      // fine surface grain (two extra scales)
      const fine =
        detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)

      // flatten the central excavation basin
      const r = Math.sqrt(x * x + z * z)
      const t = smoothstep(BASIN_RADIUS, BASIN_BLEND, r)
      const floorH = FLOOR_Y + fine * 0.12
      return lerp(floorH, h + fine, t)
    }
  }

  rebuild(params) {
    const res = params.resolution
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res)
    geo.rotateX(-Math.PI / 2)

    const sample = this._makeSampler(params)
    this.sample = sample

    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
    geo.computeVertexNormals()

    // vertex tint: height-graded value + slope darkening + grain jitter
    const colorRng = mulberry32(params.seed + 101)
    const sTint = new Simplex2(colorRng)
    const normals = geo.attributes.normal.array
    const colors = new Float32Array(count * 3)
    const span = Math.max(1e-5, maxH - minH)
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const h = arr[i * 3 + 1]
      const z = arr[i * 3 + 2]
      const ny = normals[i * 3 + 1]
      const hn = (h - minH) / span
      let v = lerp(0.62, 0.95, Math.pow(hn, 0.85))
      v *= lerp(0.78, 1.0, Math.pow(Math.max(0, ny), 0.6))
      v += fbm(sTint, x * 1.7, z * 1.7, 2, 2.2, 0.5) * 0.05
      const r = Math.sqrt(x * x + z * z)
      if (r < BASIN_BLEND) v = lerp(0.52, v, smoothstep(BASIN_RADIUS, BASIN_BLEND, r))
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.mapUniforms.uHeightRange.value.set(minH, maxH)

    // georeferenced sea level (elevation 0) — ALWAYS active in real mode so every
    // template gets a clear shoreline and consistent bathymetry, even where the
    // patch has no sub-sea data (then uSeaY simply sits below the terrain).
    if (params.source === 'real' && this.dem) {
      const demScale = (TERRAIN_SIZE / this.dem.extentMeters) * params.demExaggeration
      // fine-zoom tiles carry NO bathymetry: their sea is a flat plain at
      // exactly 0 m, which lands exactly ON uSeaY and paints as LAND (the
      // "black grainy sea" the dark templates expose). Lift the waterline a
      // touch over half a metre so a bathymetry-less sea still reads ocean;
      // real coastlines shift by an invisible ~0.6 m.
      const seaEps = Math.max(0.6 * demScale, 0.004)
      this.mapUniforms.uSeaY.value = (0 - this.dem.meanM) * demScale + seaEps
      this.mapUniforms.uSeaRange.value = Math.max((0 - this.dem.minM) * demScale, 1e-3)
      this._buildSeaMask()
    } else {
      this.mapUniforms.uSeaY.value = -9999
      this.mapUniforms.uSeaMaskOn.value = 0
    }

    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
  }

  // Flood-fill the real ocean from the DEM and upload it as a mask texture
  // (see sea-mask.js). Sampled in world XZ, same footprint as the region mask.
  _buildSeaMask() {
    const dem = this.dem
    if (!dem || !dem.data) {
      this.mapUniforms.uSeaMaskOn.value = 0
      return
    }
    const { mask, size } = blurMask(buildSeaMask(dem), 1)
    // one red channel; flipY off so texel row r ↔ world +z (matches the sampler)
    const tex = new THREE.DataTexture(mask, size, size, THREE.RedFormat)
    tex.flipY = false
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    this.mapUniforms.uSeaMask.value?.dispose?.()
    this.mapUniforms.uSeaMask.value = tex
    this.mapUniforms.uSeaMaskOn.value = 1
  }

  // Bake the elevation gradient (up to 8 stops) into a 1D ramp texture.
  rebuildRamp(params) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 1
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 256, 0)
    const stops = rampColorStops(params)
    for (const s of stops) grad.addColorStop(s.p, s.c)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    this.mapUniforms.uRampTex.value?.dispose()
    this.mapUniforms.uRampTex.value = tex
  }

  // Noise-driven roughness map (green channel is what three.js reads) + bump map
  // reused for micro relief that's finer than the vertex grid.
  rebuildRoughness(params) {
    const size = 512
    const rng = mulberry32(params.seed + 777)
    const s = new Simplex2(rng)
    const data = new Uint8Array(size * size * 4)
    const sc = params.roughnessScale
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size
        const v = y / size
        const n = fbm(s, u * sc, v * sc, 4, 2.2, 0.55)
        const n2 = fbm(s, u * sc * 7 + 13, v * sc * 7 - 5, 2, 2.2, 0.5)
        const rough = THREE.MathUtils.clamp(params.roughness + params.roughnessVariation * n, 0.04, 1)
        const bump = 0.5 + 0.5 * (n * 0.6 + n2 * 0.4)
        const i = (y * size + x) * 4
        data[i] = Math.round(bump * 255) // bump reads red-ish luminance
        data[i + 1] = Math.round(rough * 255) // roughness reads green
        data[i + 2] = Math.round(bump * 255)
        data[i + 3] = 255
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true

    const bumpTex = tex.clone()
    bumpTex.repeat.set(4, 4)
    bumpTex.needsUpdate = true

    if (this.material.roughnessMap) this.material.roughnessMap.dispose()
    if (this.material.bumpMap && this.material.bumpMap !== this.material.roughnessMap) {
      this.material.bumpMap.dispose()
    }
    this.material.roughnessMap = tex
    this.material.bumpMap = bumpTex
    this.material.bumpScale = params.bumpScale
    this.material.needsUpdate = true
  }

  updateMaterial(params) {
    this.material.color.set(params.color)
    this.material.envMapIntensity = params.envMapIntensity
    this.material.bumpScale = params.bumpScale
    this.material.transmission = params.transmission ?? 0
  }
}
