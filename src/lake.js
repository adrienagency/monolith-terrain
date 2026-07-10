// Water as GLASS — two kinds:
//  · the SEA: a transparent slab of physical glass filling everything below
//    sea level (elevation 0). Frosted-glass transmission (drei's
//    MeshTransmissionMaterial technique, vendored) shows the bathymetry
//    through it, the environment reflects off its polished top, and islands
//    pierce the surface. The slab geometry follows the plinth's superellipse
//    footprint and its top perimeter carries a small rounded bevel.
//  · ALTITUDE LAKES: real lakes sit perfectly FLAT in the DEM, so connected
//    flat regions above sea level are detected by flood fill and each gets a
//    thin glass sheet at its own elevation (mountain lakes, reservoirs…).
// Shared controls: colour, blur (frosted ↔ clear), clarity (how far light
// travels before the water tint absorbs it — shallow reads clear, deep
// tinted) and waves (a gentle animated swell of the glass top, pinned at the
// slab rim and every shoreline; needs lake.update(dt) ticking to drift).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
// the community-standard frosted-glass material (pmndrs drei's
// MeshTransmissionMaterial, vendored + adapted in src/vendor/ — see the
// file header there for lineage and what was changed). Key property here:
// its blur follows roughness even at ior 1, so the bathymetry under the
// glass stays geometrically undistorted while still frosting over.
import { MeshTransmissionMaterial } from './vendor/MeshTransmissionMaterial.js'

// ---------------------------------------------------------- lake detection
// Find connected near-flat regions above sea level in the raw DEM (meters).
// Water surfaces are EXACTLY flat in the source data (sub-meter after tile
// resampling), while a loose tolerance on a smooth slope grows "contour
// bands" — connected strips along a level set that are not water at all. So:
// tight tolerance + a compactness check (lakes are blobs, bands are strips).
// Pure — unit-tested.
export function detectLakes(dem, { tolM = 0.35, minCells = null, minFill = 0.25 } = {}) {
  if (!dem || !dem.data) return []
  const { data, size } = dem
  const min = minCells ?? Math.max(30, Math.round((size / 256) ** 2 * 25))
  const visited = new Uint8Array(size * size)
  const lakes = []
  const stack = new Int32Array(size * size)
  for (let start = 0; start < size * size; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const h0 = data[start]
    if (h0 <= 1) continue // the sea block owns everything at/below 0
    // quick reject: flood only from cells whose right/down neighbours are level
    let top = 0
    stack[top++] = start
    const cells = []
    let minX = size,
      maxX = -1,
      minY = size,
      maxY = -1
    while (top > 0) {
      const i = stack[--top]
      cells.push(i)
      const x = i % size
      const y = (i / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      // 4-neighbourhood, same water surface = same elevation within tolerance
      if (x > 0 && !visited[i - 1] && Math.abs(data[i - 1] - h0) <= tolM) (visited[i - 1] = 1), (stack[top++] = i - 1)
      if (x < size - 1 && !visited[i + 1] && Math.abs(data[i + 1] - h0) <= tolM) (visited[i + 1] = 1), (stack[top++] = i + 1)
      if (y > 0 && !visited[i - size] && Math.abs(data[i - size] - h0) <= tolM)
        (visited[i - size] = 1), (stack[top++] = i - size)
      if (y < size - 1 && !visited[i + size] && Math.abs(data[i + size] - h0) <= tolM)
        (visited[i + size] = 1), (stack[top++] = i + size)
    }
    if (cells.length < min) continue
    // shape checks — lakes are blobs, contour bands along slopes are strips:
    // · a snaking band covers only a sliver of its bounding box (fill)
    // · a straight band fills its box but is far thinner than a blob of the
    //   same area, whose narrow side ≈ √area (thinness)
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const fill = cells.length / (w * h)
    const thin = Math.min(w, h) < 0.4 * Math.sqrt(cells.length)
    if (fill >= minFill && !thin) lakes.push({ cells, elevM: h0, size })
  }
  return lakes
}

// A very dark lakeColor used to turn the thin altitude sheets into solid
// black slabs with hard edges (the Embalse del Ebro bug). Two terms in the
// transmission shader can each fully kill a colour channel:
//  · Beer-Lambert absorption takes -log(attenuationColor) per channel, and
//    -log(0) is an INFINITE coefficient — the channel dies over ANY path
//    length, even the 0.6 units of a sheet;
//  · the transmitted light is ALSO multiplied by the base colour
//    (transmittance = diffuseColor * volumeAttenuation(...) in three), a
//    thickness-INDEPENDENT tint — a zero channel there blacks out thin and
//    thick glass alike.
// Floor both tints so no channel is ever fully dead: blacks become dark
// glass instead of holes, while any normal colour is bit-identical.
function tintFloor(target, color, floor) {
  target.set(color)
  target.r = Math.max(floor, target.r)
  target.g = Math.max(floor, target.g)
  target.b = Math.max(floor, target.b)
  return target
}
const attenuationTint = (target, color) => tintFloor(target, color, 0.02)
const glassTint = (target, color) => tintFloor(target, color, 0.12)

function glassMaterial(params) {
  return new MeshTransmissionMaterial({
    samples: 6, // stochastic taps per pixel — drei's default, silky at 1080p
    color: glassTint(new THREE.Color(), params.lakeColor ?? '#8fc6e8'),
    transmission: 1, // full glass — see straight through
    roughness: params.lakeRoughness ?? 0.08, // = the blur of the glass
    metalness: 0,
    ior: 1, // optically neutral by default — updateMaterial drives it
    envMapIntensity: 1.1, // the environment reflects in the surface
    // depth absorption: light travelling through the volume takes the water
    // tint — shallow water reads clear, deep water saturates (the "clarity")
    attenuationColor: attenuationTint(new THREE.Color(), params.lakeColor ?? '#8fc6e8'),
    attenuationDistance: params.lakeClarity ?? 12,
    depthWrite: false,
    blurStrength: 1, // world-space cone factor of the frosted blur
    distortionScale: 0.25, // frost-warp noise frequency (only shows > 60% blur)
    temporalDistortion: 0.15, // noise drift speed IF lake.update(dt) is wired
  })
}

// ------------------------------------------------- beveled sea-slab geometry
// The sea block used to be a BoxGeometry clipped to the slab's superellipse
// by a fragment discard; now the geometry itself follows the footprint (so
// the discard is gone) and the top perimeter carries a small round-over.

// closed contour of the rounded-superellipse footprint in the XZ plane, with
// analytic outward normals: straight edges between four corner arcs of
// radius r and exponent n — the same curve the slab and the old clip used
function superellipseContour(half, r, n, cornerSegments = 16) {
  const pts = []
  const c = half - r
  const e = 2 / n
  // corner order walks the contour continuously; `rev` flips the sweep so
  // each arc starts where the previous straight edge ends
  const corners = [
    [1, 1, false],
    [-1, 1, true],
    [-1, -1, false],
    [1, -1, true],
  ]
  for (const [sx, sz, rev] of corners) {
    for (let k = 0; k <= cornerSegments; k++) {
      const t = ((rev ? cornerSegments - k : k) / cornerSegments) * (Math.PI / 2)
      const x = sx * (c + r * Math.cos(t) ** e)
      const z = sz * (c + r * Math.sin(t) ** e)
      // gradient of the superellipse — lands exactly on the straight-edge
      // normals at t = 0 and t = pi/2, so shading is seamless all around
      let nx = sx * Math.cos(t) ** (2 - e)
      let nz = sz * Math.sin(t) ** (2 - e)
      const len = Math.hypot(nx, nz) || 1
      pts.push({ x, z, nx: nx / len, nz: nz / len })
    }
  }
  return pts
}

// prism over the contour from y0 to y1 whose TOP edge is rounded over with
// radius `bevel` (quarter-circle profile, smooth analytic normals). Groups:
// material 0 = the top cap (transmission glass), material 1 = walls, bevel
// and bottom (plain tinted glass) — the round-over catching the env glint as
// a tinted rim reads like a polished slab edge. The cap is a radial GRID
// (not a fan) so the lakeWaves vertex swell has vertices to move, and every
// vertex carries a `waveWeight`: 0 on the rim/bevel/walls (the edge stays
// welded shut), easing to 1 a little way inside the footprint. The grid is
// sampled well above the swell's Nyquist rate (wavelengths ~7 world units vs
// ~1.2 radial and ~3 tangential vertex spacing) so the undulation reads
// smooth, never as crawling aliased lumps.
function beveledPrismGeometry(contour, y0, y1, bevel, bevelSegments = 4, capRings = 24) {
  const M = contour.length
  const pos = []
  const nrm = []
  const wgt = []
  const put = (x, y, z, nx, ny, nz, w) => {
    pos.push(x, y, z)
    nrm.push(nx, ny, nz)
    wgt.push(w)
    return pos.length / 3 - 1
  }

  // horizontal rings bottom→top: wall base, wall top, then the round-over
  // (inset walks inward along the contour normal as the profile turns up)
  const rings = [{ y: y0, inset: 0, nk: 1, ny: 0 }, { y: y1 - bevel, inset: 0, nk: 1, ny: 0 }]
  for (let k = 1; k <= bevelSegments; k++) {
    const phi = (k / bevelSegments) * (Math.PI / 2)
    rings.push({
      y: y1 - bevel + bevel * Math.sin(phi),
      inset: bevel * (1 - Math.cos(phi)),
      nk: Math.cos(phi), // horizontal share of the normal
      ny: Math.sin(phi), // vertical share
    })
  }
  const R = rings.length
  for (const ring of rings)
    for (const p of contour)
      put(p.x - p.nx * ring.inset, ring.y, p.z - p.nz * ring.inset, p.nx * ring.nk, ring.ny, p.nz * ring.nk, 0)

  // bottom cap ring + centre: same base positions but facing down (hard
  // edge — it sits on the plinth, never seen rounded)
  const botRing = R * M
  for (const p of contour) put(p.x, y0, p.z, 0, -1, 0, 0)
  const botCenter = put(0, y0, 0, 0, -1, 0, 0)

  // top cap: rings shrinking from the round-over rim to the centre. The
  // wave weight fades in over the outer 30% so the rim stays pinned to the
  // (rigid) bevel while the middle of the plate is free to swell.
  const rim = (R - 1) * M // ring already placed, weight 0
  const capStart = pos.length / 3
  for (let j = 1; j < capRings; j++) {
    const t = j / capRings // 0 = rim … 1 = centre
    const w = Math.min(1, t / 0.3)
    for (let i = 0; i < M; i++) {
      const rx = pos[(rim + i) * 3]
      const rz = pos[(rim + i) * 3 + 2]
      put(rx * (1 - t), y1, rz * (1 - t), 0, 1, 0, w * w * (3 - 2 * w))
    }
  }
  const topCenter = put(0, y1, 0, 0, 1, 0, 1)

  const idx = []
  // walls + round-over: quad strips between consecutive rings
  for (let a = 0; a < R - 1; a++)
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M
      idx.push(a * M + i, (a + 1) * M + i, (a + 1) * M + j, a * M + i, (a + 1) * M + j, a * M + j)
    }
  // bottom cap (fan, facing down)
  for (let i = 0; i < M; i++) idx.push(botCenter, botRing + i, botRing + ((i + 1) % M))
  const sideCount = idx.length
  // top cap (concentric strips from the rim inward, then a small centre fan)
  const capRing = (j) => (j === 0 ? rim : capStart + (j - 1) * M) // ring start index
  for (let jr = 0; jr < capRings - 1; jr++) {
    const A = capRing(jr) // outer
    const B = capRing(jr + 1) // inner
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M
      idx.push(A + i, B + i, B + j, A + i, B + j, A + j)
    }
  }
  const last = capRing(capRings - 1)
  for (let i = 0; i < M; i++) idx.push(topCenter, last + ((i + 1) % M), last + i)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3))
  geo.setAttribute('waveWeight', new THREE.BufferAttribute(new Float32Array(wgt), 1))
  geo.setIndex(idx)
  geo.addGroup(0, sideCount, 1) // walls + bevel + bottom → tinted side glass
  geo.addGroup(sideCount, idx.length - sideCount, 0) // top cap → transmission
  geo.computeBoundingSphere()
  return geo
}

// what the polished surface mirrors — 'studio' is the scene's default room
// light; the gradients are tiny equirect skies (auto-PMREMed by the renderer)
export const REFLECTION_TYPES = ['studio', 'window', 'sky', 'sunset', 'mirror', 'none']

// dim room with two bright mullioned windows — the classic product-photo
// glint: sharp pale rectangles sliding on the glass as the camera moves
function windowSky() {
  const w = 256
  const h = 128
  const data = new Uint8Array(w * h * 4)
  const put = (x, y, r, g, b) => {
    const o = (y * w + x) * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = 255
  }
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1)
    const v = Math.round(34 + 26 * Math.sin(t * Math.PI)) // dim grey room, lighter walls
    for (let x = 0; x < w; x++) put(x, y, v, v + 2, v + 6)
  }
  // window = bright panes split by mullion bars; a second dimmer one opposite
  const drawWindow = (cx, cy, ww, wh, lum) => {
    for (let y = cy - wh; y <= cy + wh; y++)
      for (let x = cx - ww; x <= cx + ww; x++) {
        if (y < 0 || y >= h || x < 0 || x >= w) continue
        const mullion = Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2
        const l = mullion ? 30 : lum
        put(x, y, l, l, Math.min(255, l + 4))
      }
  }
  drawWindow(64, 44, 22, 26, 255) // key window, high in the "room"
  drawWindow(192, 52, 16, 20, 140) // fill window, opposite side, dimmer
  const tex = new THREE.DataTexture(data, w, h)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

function gradientSky(top, horizon, bottom) {
  const w = 64
  const h = 32
  const data = new Uint8Array(w * h * 4)
  const cTop = new THREE.Color(top)
  const cHor = new THREE.Color(horizon)
  const cBot = new THREE.Color(bottom)
  const c = new THREE.Color()
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1) // 0 = zenith … 1 = nadir on the equirect
    if (t < 0.5) c.lerpColors(cTop, cHor, t * 2)
    else c.lerpColors(cHor, cBot, (t - 0.5) * 2)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      data[o] = Math.round(c.r * 255)
      data[o + 1] = Math.round(c.g * 255)
      data[o + 2] = Math.round(c.b * 255)
      data[o + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export class Lake {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'lake'
    scene.add(this.group)

    // sea block and altitude sheets need different `thickness` (a material
    // property in three), so they get separate materials — named, so any
    // shader diagnostics in the console point at the culprit
    this.seaMat = glassMaterial(params)
    this.seaMat.name = 'lake-sea-glass'
    this.lakeMat = glassMaterial(params)
    this.lakeMat.name = 'lake-sheet-glass'
    this.lakeMat.thickness = 0.6

    // the block's SIDE faces are plain tinted glass, NOT transmission: a
    // grazing view through a transmission side face refracts its sample far
    // across the buffer (dark rippled bands along the slab edge), while a
    // simple translucent pane reads as a clean water slice
    this.seaSideMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.lakeColor ?? '#8fc6e8'),
      transparent: true,
      opacity: 0.55,
      roughness: params.lakeRoughness ?? 0.08,
      metalness: 0,
      envMapIntensity: 1.1,
      depthWrite: false,
    })
    this.seaSideMat.name = 'lake-sea-side'

    // the sea geometry itself follows the slab's superellipse footprint now
    // (built in rebuild), so the old fragment-discard clip is gone. Real-size
    // geometry, never a scaled unit box: three multiplies `thickness` by the
    // mesh's model scale for the refraction/absorption ray, so a box scaled
    // ~120× in x/z gets a kilometric light path and tints to black.
    // Geometry groups: 0 = flat top cap (transmission), 1 = walls/bevel/bottom.
    this.seaMats = [this.seaMat, this.seaSideMat]
    this.sea = new THREE.Mesh(new THREE.BufferGeometry(), this.seaMats)
    this.sea.renderOrder = 3
    this.sea.visible = false
    this.group.add(this.sea)

    this.lakeMeshes = []
    this.updateMaterial(params) // normalize ior/reflections to the params
  }

  // rebuild everything for the current zone: the sea block up to elevation 0,
  // and one glass sheet per detected altitude lake
  rebuild({ seaY, baseY, dem, params }) {
    // --- sea block
    if (!params.lakeEnabled || seaY < -9000 || seaY <= baseY + 0.1) {
      this.sea.visible = false
    } else {
      const bottom = baseY + 0.05
      const top = seaY - 0.015 // a hair under the coastline so the shore stays crisp
      // footprint = the slab's rounded superellipse, a hair inside the slab
      const half = (TERRAIN_SIZE / 2) * 0.998
      const r = Math.min(half - 0.01, Math.max(0.01, (params.slabCorner ?? 0) * TERRAIN_SIZE))
      const n = 2 + (params.slabCornerSmoothing ?? 0) * 4
      // the "very slightly rounded" top edge — capped on shallow slabs so the
      // round-over never eats more than half the block's height
      const bevel = Math.min(0.2, Math.max(0.02, (top - bottom) * 0.45))
      this.sea.geometry.dispose()
      this.sea.geometry = beveledPrismGeometry(superellipseContour(half, r, n), bottom, top, bevel)
      this.sea.position.set(0, 0, 0) // geometry is built in world coordinates
      // absorption path length — capped: the seabed's own depth-graded ramp
      // already paints deep vs shallow, and a full-box path powers the tint
      // to black on deep-ocean zones
      this.seaMat.thickness = Math.min(4, Math.max(0.5, top - bottom))
      this.sea.visible = true
    }

    // --- altitude lakes
    for (const m of this.lakeMeshes) {
      m.geometry.dispose()
      this.group.remove(m)
    }
    this.lakeMeshes = []
    if (!params.lakeEnabled || !params.lakesAltitude || !dem) return

    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const lakes = detectLakes(dem)
    for (const lake of lakes) {
      const { cells, elevM, size } = lake
      const cell = TERRAIN_SIZE / size
      // one flat quad per DEM cell, merged into a single sheet at the lake's
      // elevation — raised past the fine-detail grain so it stays underwater
      const y = (elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6

      // shore fade for the lakeWaves swell: a small multi-source BFS from the
      // border cells gives each cell its distance to the shore, and the wave
      // weight eases 0 → 1 over the first three cells — the waterline stays
      // pinned so the sheet never lifts off its own coast
      const inLake = new Set(cells)
      const depth = new Map()
      let ring = []
      const neighbours = (i) => {
        const x = i % size
        return [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]
      }
      for (const i of cells)
        if (neighbours(i).some((n) => n < 0 || n >= size * size || !inLake.has(n))) {
          depth.set(i, 0)
          ring.push(i)
        }
      for (let d = 1; d <= 2 && ring.length; d++) {
        const next = []
        for (const i of ring)
          for (const n of neighbours(i))
            if (n >= 0 && n < size * size && inLake.has(n) && !depth.has(n)) {
              depth.set(n, d)
              next.push(n)
            }
        ring = next
      }

      // weights are authored at CELL CORNERS, not per cell: adjacent quads
      // share their edge corners, so coincident vertices always carry the
      // same weight and the displaced sheet stays crack-free (a per-cell
      // constant weight stepped 0, 1/3, 2/3 … between neighbours and opened
      // visible slits along every shore contour). A corner's weight is the
      // MIN over its ≤4 incident cells — anything touching the shore stays
      // pinned at 0, and the field is piecewise-linear in between.
      const cellW = (gx, gy) => {
        if (gx < 0 || gy < 0 || gx >= size || gy >= size) return 0
        const idx = gy * size + gx
        if (!inLake.has(idx)) return 0
        return depth.has(idx) ? depth.get(idx) / 3 : 1
      }
      const cornerCache = new Map()
      const cornerW = (gx, gy) => {
        const key = gy * (size + 1) + gx
        let w = cornerCache.get(key)
        if (w === undefined) {
          w = Math.min(cellW(gx - 1, gy - 1), cellW(gx, gy - 1), cellW(gx - 1, gy), cellW(gx, gy))
          cornerCache.set(key, w)
        }
        return w
      }

      const pos = new Float32Array(cells.length * 18)
      const wgt = new Float32Array(cells.length * 6)
      let o = 0
      let wo = 0
      for (const i of cells) {
        const gx = i % size
        const gz = (i / size) | 0
        const cx = (gx / size - 0.5) * TERRAIN_SIZE
        const cz = (gz / size - 0.5) * TERRAIN_SIZE
        const x0 = cx,
          x1 = cx + cell,
          z0 = cz,
          z1 = cz + cell
        pos.set([x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0], o)
        o += 18
        // same corner order as the six vertices above
        const w00 = cornerW(gx, gz)
        const w01 = cornerW(gx, gz + 1)
        const w11 = cornerW(gx + 1, gz + 1)
        const w10 = cornerW(gx + 1, gz)
        wgt.set([w00, w01, w11, w00, w11, w10], wo)
        wo += 6
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const normals = new Float32Array(pos.length)
      for (let k = 1; k < normals.length; k += 3) normals[k] = 1
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      geo.setAttribute('waveWeight', new THREE.BufferAttribute(wgt, 1))
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, this.lakeMat)
      mesh.renderOrder = 3
      this.group.add(mesh)
      this.lakeMeshes.push(mesh)
    }
  }

  updateMaterial(params) {
    const rough = params.lakeRoughness ?? 0.08
    // lakeRoughness drives THREE things inside the transmission material:
    //  · the gloss of the reflections (plain PBR roughness, top and sides)
    //  · the frosted-glass blur (mip frost + stochastic cone — both follow
    //    roughness directly, see src/vendor/MeshTransmissionMaterial.js)
    //  · above 60% only: a gentle optical thickening. Below that mark the
    //    surface under the glass must NOT distort, so ior stays at exactly 1
    //    (the refraction ray is the straight view ray — zero offset, zero
    //    chromatic spread) while blur and absorption keep working. Past 0.6
    //    a soft smoothstep eases in a touch of water ior and a slow simplex
    //    warp of the normal — heavy frost is allowed to swim a little.
    const t = Math.min(1, Math.max(0, (rough - 0.6) / 0.4))
    const over = t * t * (3 - 2 * t)
    const refl = this._reflection(params.lakeReflection ?? 'studio')
    for (const mat of [this.seaMat, this.lakeMat]) {
      glassTint(mat.color, params.lakeColor ?? '#8fc6e8')
      attenuationTint(mat.attenuationColor, params.lakeColor ?? '#8fc6e8')
      mat.roughness = rough
      mat.attenuationDistance = params.lakeClarity ?? 30
      mat.ior = 1 + 0.15 * over
      mat.distortion = 0.3 * over
      // gentle water undulation of the glass top: 0 = mirror-flat (default),
      // 1 = ±0.06 world units of travelling swell. Pinned to zero at the
      // slab rim and along every lake shore, so the bevel and coastlines
      // never crack open. Animated by the lake.update(dt) clock.
      mat.waveAmp = 0.06 * (params.lakeWaves ?? 0)
      mat.envMap = refl.map // null falls back to scene.environment
      mat.envMapIntensity = refl.intensity
    }
    this.seaSideMat.color.set(params.lakeColor ?? '#8fc6e8')
    this.seaSideMat.roughness = rough
    this.seaSideMat.envMap = refl.map
    this.seaSideMat.envMapIntensity = refl.intensity
  }

  // OPTIONAL per-frame hook — the glass renders correctly WITHOUT it, since
  // the material reads three's built-in transmission buffer (refreshed by the
  // renderer on its own; no private FBO pass). Wiring it up animates the two
  // time-driven looks: the lakeWaves swell drifts across the glass, and above
  // 60% blur the simplex frost warp swims slowly instead of being frozen.
  // Integration, if ever wanted in main.js:
  //   lake.update(dt) // once per frame, before composer.render()
  update(dt = 0.016) {
    this._time = (this._time ?? 0) + dt
    this.seaMat.time = this._time
    this.lakeMat.time = this._time
  }

  // reflection presets — gradient skies are built once and cached
  _reflection(type) {
    if (!this._skies) this._skies = {}
    const sky = (key, top, hor, bot) => (this._skies[key] ??= gradientSky(top, hor, bot))
    switch (type) {
      case 'window':
        return { map: (this._skies.window ??= windowSky()), intensity: 1.6 }
      case 'sky':
        return { map: sky('sky', '#7db8e8', '#dceefb', '#f5fafe'), intensity: 1.4 }
      case 'sunset':
        return { map: sky('sunset', '#31406e', '#ff9e5e', '#ffd9a0'), intensity: 1.5 }
      case 'mirror': // the studio room, pushed hard — chrome-like water
        return { map: null, intensity: 2.6 }
      case 'none':
        return { map: null, intensity: 0 }
      default: // 'studio' — the scene's room light
        return { map: null, intensity: 1.1 }
    }
  }

  setVisible(v) {
    this.group.visible = v
  }
}
