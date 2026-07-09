import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, ridged, smoothstep, lerp } from './noise.js'
import { sampleDem } from './dem.js'
import { rampColorStops } from './palette.js'

export const TERRAIN_SIZE = 56
export const BASIN_RADIUS = 6.6 // flat excavation floor
export const BASIN_BLEND = 9.0 // where flat floor blends back into mountains
export const FLOOR_Y = -0.35

// CPU-generated terrain: multi-scale FBM + ridged multifractal + domain warping,
// with real vertex normals so PBR lighting and DOF read the actual relief.
export class Terrain {
  constructor(params) {
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.color),
      roughness: 1, // actual roughness baked into the roughness map
      metalness: 0,
      vertexColors: true,
      envMapIntensity: params.envMapIntensity,
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
      // clip the map to the slab's rounded-rectangle footprint (world XZ) so the
      // block's vertical corners read soft and nothing overhangs the plinth walls
      uSlabHalf: { value: TERRAIN_SIZE / 2 },
      uSlabCorner: { value: (params.slabCorner ?? 0) * TERRAIN_SIZE },
      // superellipse exponent for the corner: 2 = circular arc, higher = squircle
      // (iOS-style continuous corner). Shared with the plinth ring, see plinth.js
      uSlabCornerN: { value: 2 + (params.slabCornerSmoothing ?? 0) * 4 },
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
uniform float uScanDispW;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
// scan wave physically lifts the surface as it sweeps outward
if (uScanT >= 0.0) {
  float dV = length(transformed.xz);
  float RV = uScanT * 42.0;
  float bumpV = exp(-pow((dV - RV) / max(uScanDispW, 0.05), 2.0));
  transformed.y += uScanDispH * bumpV * (1.0 - smoothstep(0.6, 1.0, uScanT));
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
uniform vec3 uOceanShallow;
uniform vec3 uOceanMid;
uniform vec3 uOceanDeep;
uniform vec3 uGridColor;
uniform vec3 uContourColor;
uniform float uSlabHalf;
uniform float uSlabCorner;
uniform float uSlabCornerN;
uniform float uScanT;
uniform vec3 uScanColor;
uniform float uScanWidth;
uniform float uScanBlur;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // --- rounded-rect footprint clip: discard fragments outside the slab's
  // filleted corners so the block's vertical edges read soft (matches the
  // plinth walls). Zero radius = untouched square. SDF of a rounded box.
  if (uSlabCorner > 0.0) {
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
  bool underwater = vWorldPos.y < uSeaY;
  vec3 mapCol;
  if (underwater) {
    float d01 = pow(clamp((uSeaY - vWorldPos.y) / max(uSeaRange, 1e-4), 0.0, 1.0), 0.55);
    // three-stop nautical ramp: shallows → mid blue → abyss
    mapCol = d01 < 0.45
      ? mix(uOceanShallow, uOceanMid, d01 / 0.45)
      : mix(uOceanMid, uOceanDeep, (d01 - 0.45) / 0.55);
  } else {
    float hNorm = clamp((vWorldPos.y - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
    float rampT = clamp(0.5 + (hNorm - uHeightPivot) * uHeightContrast, 0.0, 1.0);
    mapCol = texture2D(uRampTex, vec2(rampT, 0.5)).rgb;
    mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * clamp(luma * 2.4, 0.2, 1.4), uTint);

  // --- coastline: a crisp line exactly at sea level (elevation 0), drawn in the
  // template ink so the shore is unmistakable on every look
  if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 2.5, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.9);
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

  // --- radar scan wavefront paints the surface (additive-only washes out on white terrain)
  if (uScanT >= 0.0) {
    float dScan = length(vWorldPos.xz);
    float Rs = uScanT * 42.0;
    float aaS = fwidth(dScan);
    float edgeS = abs(dScan - Rs) - uScanWidth * 0.5;
    float bandS = 1.0 - smoothstep(0.0, max(uScanBlur, aaS), edgeS);
    float fadeS = 1.0 - smoothstep(0.6, 1.0, uScanT);
    diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, clamp(bandS * fadeS, 0.0, 0.95));
  }
}`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
// radar scan ripple: an emissive wavefront expanding from the center across the relief
if (uScanT >= 0.0) {
  float d = length(vWorldPos.xz);
  float R = uScanT * 42.0;
  float edgeE = abs(d - R) - uScanWidth * 0.5;
  float band = 1.0 - smoothstep(0.0, max(uScanBlur, fwidth(d)), edgeE);
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

  // scene height → display elevation in feet (real when a DEM drives the terrain)
  heightToFeet(h) {
    return this._h2ft ? this._h2ft(h) : Math.round(4800 + h * 420)
  }

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    this._h2ft = (h) => Math.round((h / scale + meanM) * 3.28084)

    const sDetail = new Simplex2(mulberry32(params.seed))
    const { size } = dem
    const { detail, detailScale } = params

    return (x, z) => {
      const px = (x / TERRAIN_SIZE + 0.5) * (size - 1)
      const py = (z / TERRAIN_SIZE + 0.5) * (size - 1)
      let h = (sampleDem(dem, px, py) - meanM) * scale

      // optional fine grain on top of the (smoother) 30m-class data
      const fine =
        detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
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
      this.mapUniforms.uSeaY.value = (0 - this.dem.meanM) * demScale
      this.mapUniforms.uSeaRange.value = Math.max((0 - this.dem.minM) * demScale, 1e-3)
    } else {
      this.mapUniforms.uSeaY.value = -9999
    }

    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
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
  }
}
