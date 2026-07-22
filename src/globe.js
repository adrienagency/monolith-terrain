// MONOLITH EARTH — the orbital globe. A quadtree of curved patches streams
// the same AWS terrarium elevation tiles the terrain uses (z2 → z11) and a
// custom shader re-creates the vintage-topo recipe at planet scale:
// hypsometric ramp, bathymetric blues, contour lines, 10° graticule, paper
// noise. Refinement is hole-free: a tile only subdivides once all four
// children have their data, so the parent keeps rendering until then.
// A slowly orbiting cloud shell (globe-clouds.js) dresses the planet view.

import * as THREE from 'three'
import { R_GLOBE, MERCATOR_MAX_LAT, EARTH_RADIUS_M, tileToLatLon, latLonToSphere } from './geo.js'
import { rampColorStops } from './palette.js'
import { GlobeClouds } from './globe-clouds.js'

const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
const ROOT_Z = 2
const MAX_Z = 11
const MAX_CONCURRENT = 6
const CACHE_MAX = 420 // ready tiles kept before LRU eviction
const SPLIT_RATIO = 0.38 // tile chord / camera distance beyond which we refine
const MERGE_RATIO = SPLIT_RATIO * 0.8 // hysteresis: refined tiles only coarsen below this

// segments per patch edge — low zooms form the planet silhouette in the full
// view, so they get denser grids: a z3 tile spans 45 degrees of longitude and
// 24 segments there leaves visibly flat facets (and jagged exaggerated relief)
// on the limb
function gridFor(z) {
  if (z <= 2) return 64
  if (z <= 3) return 48
  if (z <= 5) return 32
  return 24
}

// ---------------------------------------------------------------- shader

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
attribute vec2 latlon;
void main() {
  vUv = uv;
  vLatLon = latlon;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec2 vLatLon;
uniform sampler2D uTex;
uniform sampler2D uRamp;
uniform vec3 uSunDir;
uniform vec3 uInk;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uGraticuleOpacity;
uniform float uOceanDepth;
uniform float uLandMax;

float decodeMeters(vec2 uv) {
  vec3 t = texture2D(uTex, uv).rgb * 255.0;
  return t.r * 256.0 + t.g + t.b / 256.0 - 32768.0;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float h = decodeMeters(vUv);

  // hypsometric ramp: bathymetry occupies [0, 0.35], land [0.35, 1]
  float t = h < 0.0
    ? 0.35 * (1.0 - clamp(-h / uOceanDepth, 0.0, 1.0))
    : 0.35 + 0.65 * clamp(h / uLandMax, 0.0, 1.0);
  vec3 col = texture2D(uRamp, vec2(t, 0.5)).rgb;

  // contour lines with the terrain's crowd-fade so they only appear when
  // the tile resolution can actually carry them
  float ch = h / uContourInterval;
  float dch = fwidth(ch);
  float minor = 1.0 - smoothstep(0.0, dch * 1.5, abs(fract(ch + 0.5) - 0.5));
  float ch5 = ch / 5.0;
  float major = 1.0 - smoothstep(0.0, fwidth(ch5) * 1.5, abs(fract(ch5 + 0.5) - 0.5));
  float crowd = clamp(1.0 - dch * 0.30, 0.0, 1.0);
  // MINIFICATION fade (Adrien : scintillement de la map en orbite) — the height
  // texture carries no mipmaps (they corrupt the packed metres), so when the
  // tile shrinks in the orbital/travel view the sampled height aliases and the
  // contour lines CRAWL. Fade them out as the tile minifies (texels per screen
  // pixel > ~1) so the far globe reads clean; they return in full up close.
  float texel = max(fwidth(vUv).x, fwidth(vUv).y) * 256.0;
  float minFade = clamp(1.6 - texel * 0.55, 0.0, 1.0);
  float contour = max(minor * 0.5, major) * uContourOpacity * crowd * minFade;
  contour *= h < 0.0 ? 0.35 : 1.0; // bathymetric contours read lighter
  col = mix(col, uInk, contour);

  // 10° graticule — the survey grid of the planet view
  vec2 g = vLatLon / 10.0;
  vec2 dg = fwidth(g);
  vec2 dist = abs(fract(g + 0.5) - 0.5);
  float gl = max(
    1.0 - smoothstep(0.0, dg.x * 1.4, dist.x),
    1.0 - smoothstep(0.0, dg.y * 1.4, dist.y)
  );
  col = mix(col, uInk, gl * uGraticuleOpacity);

  // soft sun shading — the map stays readable, light only models the sphere
  float diff = max(dot(normalize(vNormalW), uSunDir), 0.0);
  col *= 0.74 + 0.30 * diff;

  // faint paper grain
  col += (hash12(vUv * 941.7 + vLatLon) - 0.5) * 0.02;

  gl_FragColor = vec4(col, 1.0);
}
`

// ---------------------------------------------------------------- tile math

function tileKey(z, x, y) {
  return `${z}/${x}/${y}`
}

// terrarium PNG → { texture, heights Float32Array(256*256) }
async function fetchTile(z, x, y, signal) {
  const r = await fetch(TILE_URL(z, x, y), { signal })
  if (!r.ok) throw new Error(`tile ${z}/${x}/${y} → HTTP ${r.status}`)
  const img = await createImageBitmap(await r.blob())
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const rgba = ctx.getImageData(0, 0, 256, 256).data
  const heights = new Float32Array(256 * 256)
  for (let i = 0; i < heights.length; i++) {
    heights[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
  }
  const texture = new THREE.CanvasTexture(c)
  // NO mipmaps: terrarium packs meters into r*256 + g + b/256, and mip
  // generation rounds each channel to 8 bits independently — a half-unit
  // rounding of the r channel alone injects up to ~128 m of elevation noise
  // into every minified sample, which the contour shader turns into speckled
  // garbage all over the aerial view. Plain bilinear filtering is exact here
  // (the decode is a linear combination of the channels), so we keep it.
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return { texture, heights }
}

function sampleHeights(heights, u, v) {
  // bilinear sample, u/v in [0,1], row 0 = north. Pixel CENTERS sit at
  // (i + 0.5)/256 — the same convention the GPU uses when the fragment shader
  // reads uTex — so vertex relief and shaded texture stay registered instead
  // of sliding half a pixel apart.
  const x = Math.min(Math.max(u * 256 - 0.5, 0), 255)
  const y = Math.min(Math.max(v * 256 - 0.5, 0), 255)
  const x0 = Math.min(Math.floor(x), 254)
  const y0 = Math.min(Math.floor(y), 254)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * 256 + x0
  const a = heights[i]
  const b = heights[i + 1]
  const c = heights[i + 256]
  const d = heights[i + 257]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// ---------------------------------------------------------------- globe

export class Globe {
  constructor(params = {}) {
    this.group = new THREE.Group()
    this.group.name = 'globe'
    this.radius = R_GLOBE
    this.exaggeration = params.globeExaggeration ?? 18
    this.tiles = new Map() // key → { z,x,y, state, mesh, texture, heights, lastUsed, center, chord }
    this.queue = []
    this.inFlight = 0
    this.frame = 0
    this.enabled = false

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.5).normalize() },
      uInk: { value: new THREE.Color(params.contourColor ?? '#000000') },
      uContourInterval: { value: 500 },
      uContourOpacity: { value: 0.55 },
      uGraticuleOpacity: { value: 0.16 },
      uOceanDepth: { value: 6000 },
      uLandMax: { value: 5600 },
      uRamp: { value: null },
    }
    this.rebuildRamp(params)

    this._materialFor = (texture) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...this.uniforms,
          uTex: { value: texture },
        },
      })

    this._buildPoleCaps()
    this._buildAtmosphere()

    // orbiting cloud cover — lives inside group so globe.setVisible rules it
    this.clouds = new GlobeClouds(R_GLOBE)
    this.group.add(this.clouds.group)

    // roots load immediately so entering orbit never shows a bare sphere
    const n = 2 ** ROOT_Z
    this.roots = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = this._ensureTile(ROOT_Z, x, y)
        this.roots.push(t)
        this._request(t, 1e9)
      }
    }
  }

  // The globe ramp reuses the user's land gradient (the map's identity) and
  // extends it below sea level with vintage-chart bathymetric blues.
  rebuildRamp(params = {}) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 1
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 512, 0)
    // ocean shares the palette's sea colors so globe and surface chart agree
    grad.addColorStop(0.0, params.oceanDeep ?? '#31576b')
    grad.addColorStop(0.19, params.oceanMid ?? '#7fa8b8')
    grad.addColorStop(0.345, params.oceanShallow ?? '#dce8ec')
    // land ramp (up to 8 stops) mapped into [0.35, 1] above the ocean band
    for (const s of rampColorStops(params)) grad.addColorStop(0.35 + 0.65 * s.p, s.c)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    this.uniforms.uRamp.value?.dispose()
    this.uniforms.uRamp.value = tex
  }

  setSunDir(v) {
    this.uniforms.uSunDir.value.copy(v).normalize()
    this.clouds?.setSunDir(v)
  }

  setInk(color) {
    this.uniforms.uInk.value.set(color)
  }

  // --------------------------------------------------------------- caps & halo

  _buildPoleCaps() {
    for (const north of [true, false]) {
      const geo = new THREE.SphereGeometry(
        R_GLOBE * 1.0005,
        96,
        12,
        0,
        Math.PI * 2,
        north ? 0 : Math.PI - THREE.MathUtils.degToRad(90 - MERCATOR_MAX_LAT),
        THREE.MathUtils.degToRad(90 - MERCATOR_MAX_LAT)
      )
      const mat = new THREE.MeshBasicMaterial({ color: north ? '#dfe7ea' : '#f4f1ec' })
      const cap = new THREE.Mesh(geo, mat)
      cap.name = north ? 'cap-n' : 'cap-s'
      this.group.add(cap)
    }
  }

  _buildAtmosphere() {
    const geo = new THREE.SphereGeometry(R_GLOBE * 1.018, 96, 64)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.78), rim * 0.55);
        }`,
    })
    this.group.add(new THREE.Mesh(geo, mat))
  }

  // --------------------------------------------------------------- tiles

  _ensureTile(z, x, y) {
    const key = tileKey(z, x, y)
    let t = this.tiles.get(key)
    if (t) return t
    const nw = tileToLatLon(x, y, z)
    const se = tileToLatLon(x + 1, y + 1, z)
    const center = latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2)
    const corner = latLonToSphere(nw.lat, nw.lon)
    t = {
      key,
      z,
      x,
      y,
      state: 'empty', // empty → loading → ready | error
      mesh: null,
      texture: null,
      heights: null,
      lastUsed: 0,
      center,
      chord: corner.distanceTo(latLonToSphere(se.lat, se.lon)),
    }
    this.tiles.set(key, t)
    return t
  }

  _request(t, priority) {
    if (t.state !== 'empty') return
    t.state = 'loading'
    this.queue.push({ t, priority })
    this._pump()
  }

  _pump() {
    while (this.inFlight < MAX_CONCURRENT && this.queue.length) {
      this.queue.sort((a, b) => b.priority - a.priority)
      const { t } = this.queue.shift()
      this.inFlight++
      fetchTile(t.z, t.x, t.y)
        .then(({ texture, heights }) => {
          t.texture = texture
          t.heights = heights
          t.state = 'ready'
          this._buildMesh(t)
        })
        .catch((err) => {
          // one retry, then give up — the parent keeps covering this area
          if (!t.retried) {
            t.retried = true
            t.state = 'empty'
            this._request(t, 0)
          } else {
            t.state = 'error'
            console.warn('globe tile failed:', err.message)
          }
        })
        .finally(() => {
          this.inFlight--
          this._pump()
        })
    }
  }

  _buildMesh(t) {
    const G = gridFor(t.z)
    const nV = (G + 1) * (G + 1)
    const positions = new Float32Array(nV * 3)
    const normals = new Float32Array(nV * 3)
    const uvs = new Float32Array(nV * 2)
    const latlons = new Float32Array(nV * 2)
    const dispScale = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
    const v3 = new THREE.Vector3()

    // every vertex is projected EXACTLY onto the sphere (+ displaced along the
    // radius) — never interpolated across a flat quad
    const posAt = (u, v, out) => {
      const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
      const h = Math.max(sampleHeights(t.heights, u, v), 0) // oceans stay on the sphere
      return latLonToSphere(lat, lon, R_GLOBE + h * dispScale, out)
    }

    let k = 0
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const u = i / G
        const v = j / G
        const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
        posAt(u, v, v3)
        positions[k * 3] = v3.x
        positions[k * 3 + 1] = v3.y
        positions[k * 3 + 2] = v3.z
        uvs[k * 2] = u
        uvs[k * 2 + 1] = 1 - v // canvas row 0 = north = uv v 1 (flipY texture)
        latlons[k * 2] = lat
        latlons[k * 2 + 1] = lon
        k++
      }
    }

    // analytic normals via central differences on the displaced surface.
    // computeVertexNormals would average the skirt walls into the border
    // vertices, tilting them and drawing a dark shading seam around every
    // tile — the "grid of outlines" glitch in the aerial view.
    {
      const eps = 1 / G
      const pE = new THREE.Vector3()
      const pW = new THREE.Vector3()
      const pN = new THREE.Vector3()
      const pS = new THREE.Vector3()
      let m = 0
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const u = i / G
          const v = j / G
          posAt(u + eps, v, pE)
          posAt(u - eps, v, pW)
          posAt(u, v - eps, pN)
          posAt(u, v + eps, pS)
          // dv points south, du points east: south x east faces outward
          pS.sub(pN)
          pE.sub(pW)
          v3.crossVectors(pS, pE).normalize()
          normals[m * 3] = v3.x
          normals[m * 3 + 1] = v3.y
          normals[m * 3 + 2] = v3.z
          m++
        }
      }
    }

    const indices = []
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const a = j * (G + 1) + i
        const b = a + 1
        const c = a + (G + 1)
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    // skirt: duplicate the border ring pulled toward the planet center, hiding
    // hairline cracks between neighbouring LOD levels
    const border = []
    for (let i = 0; i <= G; i++) border.push(i) // north row
    for (let j = 1; j <= G; j++) border.push(j * (G + 1) + G) // east col
    for (let i = G - 1; i >= 0; i--) border.push(G * (G + 1) + i) // south row
    for (let j = G - 1; j >= 1; j--) border.push(j * (G + 1)) // west col

    // deep enough to swallow cross-LOD height mismatches (a few hundred
    // exaggerated meters at most), but capped — the old chord-proportional
    // drop dug multi-unit trenches on z2/z3 tiles that read as dark bands at
    // the limb
    const skirtDrop = Math.min(Math.max(t.chord * 0.012, 0.1), 0.9)
    const total = nV + border.length
    const pos2 = new Float32Array(total * 3)
    const nrm2 = new Float32Array(total * 3)
    const uv2 = new Float32Array(total * 2)
    const ll2 = new Float32Array(total * 2)
    pos2.set(positions)
    nrm2.set(normals)
    uv2.set(uvs)
    ll2.set(latlons)
    border.forEach((src, bi) => {
      const dst = nV + bi
      const inv = 1 - skirtDrop / Math.hypot(positions[src * 3], positions[src * 3 + 1], positions[src * 3 + 2])
      pos2[dst * 3] = positions[src * 3] * inv
      pos2[dst * 3 + 1] = positions[src * 3 + 1] * inv
      pos2[dst * 3 + 2] = positions[src * 3 + 2] * inv
      // skirts inherit the rim normal so the wall shades exactly like the edge
      nrm2[dst * 3] = normals[src * 3]
      nrm2[dst * 3 + 1] = normals[src * 3 + 1]
      nrm2[dst * 3 + 2] = normals[src * 3 + 2]
      uv2[dst * 2] = uvs[src * 2]
      uv2[dst * 2 + 1] = uvs[src * 2 + 1]
      ll2[dst * 2] = latlons[src * 2]
      ll2[dst * 2 + 1] = latlons[src * 2 + 1]
    })
    for (let bi = 0; bi < border.length; bi++) {
      const a = border[bi]
      const b = border[(bi + 1) % border.length]
      const a2 = nV + bi
      const b2 = nV + ((bi + 1) % border.length)
      indices.push(a, a2, b, b, a2, b2)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos2, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm2, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv2, 2))
    geo.setAttribute('latlon', new THREE.BufferAttribute(ll2, 2))
    geo.setIndex(indices)
    geo.computeBoundingSphere()

    const mesh = new THREE.Mesh(geo, this._materialFor(t.texture))
    mesh.visible = false
    mesh.name = t.key
    t.mesh = mesh
    this.group.add(mesh)
  }

  // --------------------------------------------------------------- per-frame

  // Traverse the quadtree: a tile subdivides only when all four children are
  // ready, so coverage is always complete. Returns the number of drawn tiles.
  // dt (seconds, optional — callers passing only the camera keep working)
  // drives the orbiting cloud cover.
  update(camera, dt = 0.016) {
    if (!this.enabled) return 0
    this.clouds.update(camera, dt)
    this.frame++
    const camPos = camera.position
    const camDir = camPos.clone().normalize()
    this._drawn = 0

    for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = false
    for (const root of this.roots) this._traverse(root, camPos, camDir)

    if (this.tiles.size > CACHE_MAX) this._evict()
    return this._drawn
  }

  _traverse(t, camPos, camDir) {
    // horizon cull: skip tiles fully on the far side of the planet
    const toTile = t.center.clone().normalize()
    if (toTile.dot(camDir) < -0.35 && t.z > ROOT_Z) return

    t.lastUsed = this.frame
    const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, 1)
    // hysteresis: a tile that already refined only coarsens once the ratio
    // falls well below the split point, so hovering at the threshold no
    // longer flickers between parent and children every few frames
    const ratio = t.chord / dist
    const wantSplit = t.z < MAX_Z && ratio > (t.refined ? MERGE_RATIO : SPLIT_RATIO)

    if (wantSplit) {
      const kids = this._children(t)
      for (const k of kids) {
        k.lastUsed = this.frame // protect loading/fresh children from LRU
        if (k.state === 'empty') this._request(k, ratio)
      }
      // hole-free rule: descend only when all four children can draw —
      // any error keeps the parent covering the whole quad
      if (kids.every((k) => k.state === 'ready' && k.mesh)) {
        t.refined = true
        for (const k of kids) this._traverse(k, camPos, camDir)
        return
      }
    }

    t.refined = false
    if (t.state === 'ready' && t.mesh) {
      t.mesh.visible = true
      this._drawn++
    }
  }

  _children(t) {
    return [
      this._ensureTile(t.z + 1, t.x * 2, t.y * 2),
      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2),
      this._ensureTile(t.z + 1, t.x * 2, t.y * 2 + 1),
      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2 + 1),
    ]
  }

  _evict() {
    // hard budget: least-recently-used first, sparing only tiles drawn this
    // frame — sustained exploration must not grow the cache without bound
    const candidates = [...this.tiles.values()]
      .filter((t) => t.z > ROOT_Z && t.state === 'ready' && !(t.mesh && t.mesh.visible))
      .sort((a, b) => a.lastUsed - b.lastUsed)
    const excess = this.tiles.size - CACHE_MAX
    for (let i = 0; i < Math.min(excess, candidates.length); i++) {
      const t = candidates[i]
      if (t.mesh) {
        this.group.remove(t.mesh)
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
      }
      t.texture?.dispose()
      this.tiles.delete(t.key)
    }
  }

  setVisible(v) {
    this.enabled = v
    this.group.visible = v
  }

  // relief exaggeration is baked into vertex positions — rebuild ready meshes
  setExaggeration(v) {
    this.exaggeration = v
    for (const t of this.tiles.values()) {
      if (t.state !== 'ready' || !t.mesh) continue
      this.group.remove(t.mesh)
      t.mesh.geometry.dispose()
      t.mesh.material.dispose()
      t.mesh = null
      this._buildMesh(t)
    }
  }

  dispose() {
    this.clouds.dispose()
    for (const t of this.tiles.values()) {
      if (t.mesh) {
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
      }
      t.texture?.dispose()
    }
    this.tiles.clear()
  }
}
