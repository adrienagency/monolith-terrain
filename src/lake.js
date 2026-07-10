// Water as GLASS — two kinds:
//  · the SEA: a transparent slab of physical glass filling everything below
//    sea level (elevation 0). Frosted-glass transmission (drei's
//    MeshTransmissionMaterial technique, vendored) shows the bathymetry
//    through it, the environment reflects off its polished top, and islands
//    pierce the surface. The slab geometry follows the plinth's superellipse
//    footprint and its top perimeter carries a small rounded bevel.
//  · ALTITUDE LAKES: real lakes sit perfectly FLAT in the DEM, so connected
//    flat regions above sea level are detected by flood fill and each gets
//    CARVED glass water at its own elevation (mountain lakes, reservoirs…):
//    a smooth Chaikin-rounded shoreline instead of the DEM pixel staircase,
//    the surface flush with the surrounding ground — the land rising around
//    it is what reads as the carve — and short buried walls capping the
//    volume. Shown whenever lakesAltitude is on, independent of the sea.
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
// bands" — connected strips along a level set that are not water at all.
// The strongest water signature is the ELEVATION SPREAD inside the region:
// a real lake is flat to centimetres even when it is a long mountain ribbon
// (Annecy is 14 km by 3 km), while a contour band spans its whole ±tol range
// (~2*tolM). So: truly flat regions are accepted whatever their shape, and
// only regions with real internal spread must also look like blobs, which
// kills the bands without killing elongated lakes. Pure — unit-tested.
export function detectLakes(dem, { tolM = 0.35, minCells = null, minFill = 0.25, flatM = 0.15 } = {}) {
  if (!dem || !dem.data) return []
  const { data, size } = dem
  // area floor: scales with the grid so it stays a constant fraction of the
  // map. 12 keeps mid-size alpine lakes (Annecy is ~150 cells on a 768 grid
  // at a 330 km view) while still dropping single-cell noise flats.
  const min = minCells ?? Math.max(30, Math.round((size / 256) ** 2 * 12))
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
    let minH = h0,
      maxH = h0
    const histo = new Map() // 0.1 m bins — see the mode test below
    while (top > 0) {
      const i = stack[--top]
      cells.push(i)
      const x = i % size
      const y = (i / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      const v = data[i]
      if (v < minH) minH = v
      if (v > maxH) maxH = v
      const q = Math.round(v * 10)
      histo.set(q, (histo.get(q) || 0) + 1)
      // 4-neighbourhood, same water surface = same elevation within tolerance
      if (x > 0 && !visited[i - 1] && Math.abs(data[i - 1] - h0) <= tolM) (visited[i - 1] = 1), (stack[top++] = i - 1)
      if (x < size - 1 && !visited[i + 1] && Math.abs(data[i + 1] - h0) <= tolM) (visited[i + 1] = 1), (stack[top++] = i + 1)
      if (y > 0 && !visited[i - size] && Math.abs(data[i - size] - h0) <= tolM)
        (visited[i - size] = 1), (stack[top++] = i - size)
      if (y < size - 1 && !visited[i + size] && Math.abs(data[i + size] - h0) <= tolM)
        (visited[i + size] = 1), (stack[top++] = i + size)
    }
    if (cells.length < min) continue
    // acceptance — water signature first, shape second:
    // · spread ≤ flatM: the surface is water-flat, accept ANY outline
    // · mode ≥ 60%: tile resampling wobbles a big lake's shoreline cells by
    //   up to ±tol (Léman spans the full 0.7 m at 160 km views, failing the
    //   spread test), but the BULK of a real lake still lands on one exact
    //   value — >60% of cells in a single 0.1 m bin. A contour band on a
    //   slope spreads uniformly across its range and never concentrates.
    // · otherwise fall back to the blob checks: a snaking band covers only a
    //   sliver of its bounding box (fill), a straight band is far thinner
    //   than a blob of the same area, whose narrow side ≈ √area (thinness)
    let modeCount = 0
    for (const c of histo.values()) if (c > modeCount) modeCount = c
    const watery = maxH - minH <= flatM || modeCount / cells.length >= 0.6
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const fill = cells.length / (w * h)
    const thin = Math.min(w, h) < 0.4 * Math.sqrt(cells.length)
    if (watery || (fill >= minFill && !thin)) lakes.push({ cells, elevM: h0, size })
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

// ---------------------------------------------------- smooth lake outlines
// The DEM cell mask is a hard pixel staircase; the lake plate wants a smooth
// shoreline. Pipeline: trace the mask's boundary edges into a closed loop,
// thin the stairs, round them with Chaikin corner-cutting, then give every
// point an outward normal for the prism builder.

// trace the OUTER boundary loop of a set of DEM cells, in world XZ, with
// positive shoelace winding. Inner loops (islands inside the lake) are
// dropped — the plate spans them and terrain tall enough simply pierces the
// glass, exactly like islands pierce the sea slab.
function traceLakeOutline(cells, size) {
  const inLake = new Set(cells)
  const C = size + 1 // corner grid pitch
  const edges = new Map() // corner -> neighbouring corners along boundary edges
  const link = (a, b) => {
    let l = edges.get(a)
    if (!l) edges.set(a, (l = []))
    l.push(b)
  }
  for (const i of cells) {
    const x = i % size
    const z = (i / size) | 0
    const c00 = z * C + x
    const c10 = c00 + 1
    const c01 = c00 + C
    const c11 = c01 + 1
    if (x === 0 || !inLake.has(i - 1)) (link(c00, c01), link(c01, c00))
    if (x === size - 1 || !inLake.has(i + 1)) (link(c10, c11), link(c11, c10))
    if (z === 0 || !inLake.has(i - size)) (link(c00, c10), link(c10, c00))
    if (z === size - 1 || !inLake.has(i + size)) (link(c01, c11), link(c11, c01))
  }
  // walk the edge graph into closed loops with a CONSISTENT TURN RULE: at
  // every corner, prefer turning the same way relative to the incoming
  // direction (turn, straight, other turn, back). At checkerboard pinches —
  // corners where two lake cells only touch diagonally and four boundary
  // edges meet — this hugs one lobe instead of dead-ending mid-walk, so
  // every traversal closes.
  const used = new Set()
  const ekey = (a, b) => (a < b ? a * C * C + b : b * C * C + a)
  const dirOf = (from, to) => {
    const d = to - from
    if (d === 1) return [1, 0]
    if (d === -1) return [-1, 0]
    if (d === C) return [0, 1]
    return [0, -1]
  }
  const loops = []
  for (const [start, nbrs] of edges) {
    for (const first of nbrs) {
      if (used.has(ekey(start, first))) continue
      const loop = [start]
      used.add(ekey(start, first))
      let prev = start
      let cur = first
      let guard = 0
      while (cur !== start && guard++ < 500000) {
        loop.push(cur)
        const [dx, dz] = dirOf(prev, cur)
        // preference: right turn, straight, left turn, back
        const prefs = [
          [dz, -dx],
          [dx, dz],
          [-dz, dx],
          [-dx, -dz],
        ]
        let nxt = -1
        for (const [px, pz] of prefs) {
          const cand = cur + px + pz * C
          const nbrsHere = edges.get(cur)
          if (nbrsHere && nbrsHere.includes(cand) && !used.has(ekey(cur, cand))) {
            nxt = cand
            break
          }
        }
        if (nxt === -1) break
        used.add(ekey(cur, nxt))
        prev = cur
        cur = nxt
      }
      if (cur === start && loop.length >= 4) loops.push(loop)
    }
  }
  if (!loops.length) return null
  const toWorld = (k) => ({ x: ((k % C) / size - 0.5) * TERRAIN_SIZE, z: (((k / C) | 0) / size - 0.5) * TERRAIN_SIZE })
  let best = null
  let bestArea = 0
  for (const loop of loops) {
    const pts = loop.map(toWorld)
    let a = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      a += p.x * q.z - q.x * p.z
    }
    if (Math.abs(a) > Math.abs(bestArea)) {
      bestArea = a
      best = pts
    }
  }
  if (bestArea < 0) best.reverse() // the builder expects positive winding
  return best
}

// classic corner-cutting: each pass replaces every edge with its 1/4 and 3/4
// points — two passes turn the cell staircase into a soft shoreline while
// staying close to the original area (convex corners shrink a hair, concave
// ones fill in)
function chaikinClosed(pts, iterations = 2) {
  let p = pts
  for (let it = 0; it < iterations; it++) {
    const out = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      out.push({ x: 0.75 * a.x + 0.25 * b.x, z: 0.75 * a.z + 0.25 * b.z })
      out.push({ x: 0.25 * a.x + 0.75 * b.x, z: 0.25 * a.z + 0.75 * b.z })
    }
    p = out
  }
  return p
}

function decimateClosed(pts, maxN) {
  if (pts.length <= maxN) return pts
  const step = pts.length / maxN
  const out = []
  for (let i = 0; i < maxN; i++) out.push(pts[Math.floor(i * step)])
  return out
}

// outward normals by central difference — right-hand perp of the tangent for
// a positive-shoelace loop
function contourNormals(pts) {
  const n = pts.length
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const tx = b.x - a.x
    const tz = b.z - a.z
    const len = Math.hypot(tx, tz) || 1
    return { x: p.x, z: p.z, nx: tz / len, nz: -tx / len }
  })
}

// ear-clipping triangulation of a simple polygon with positive shoelace
// winding, emitted wound to face +y. O(n^2), fine for shoreline budgets.
// Never leaves the interior hollow: if no textbook ear exists (numerical
// stalemates on long near-collinear shoreline runs used to leave lakes as
// empty outline rings), the most convex corner is force-clipped — for a
// simple input polygon the error is bounded by numeric noise, and a filled
// lake with a hairline overlap beats a hollow one.
function earClipUp(poly) {
  const cross = (a, b, c) => (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)
  const inTri = (p, a, b, c) =>
    (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x) >= 0 &&
    (c.x - b.x) * (p.z - b.z) - (c.z - b.z) * (p.x - b.x) >= 0 &&
    (a.x - c.x) * (p.z - c.z) - (a.z - c.z) * (p.x - c.x) >= 0
  const V = poly.map((_, i) => i)
  const idx = []
  let guard = 0
  while (V.length > 3 && guard++ < 100000) {
    let clipped = false
    let bestVi = -1
    let bestCross = 0
    for (let vi = 0; vi < V.length; vi++) {
      const i0 = V[(vi - 1 + V.length) % V.length]
      const i1 = V[vi]
      const i2 = V[(vi + 1) % V.length]
      const a = poly[i0]
      const b = poly[i1]
      const c = poly[i2]
      const cr = cross(a, b, c)
      if (cr > bestCross) {
        bestCross = cr
        bestVi = vi
      }
      if (cr <= 1e-9) continue // reflex or degenerate corner
      let ear = true
      for (const j of V) {
        if (j === i0 || j === i1 || j === i2) continue
        if (inTri(poly[j], a, b, c)) {
          ear = false
          break
        }
      }
      if (!ear) continue
      idx.push(i0, i2, i1) // reversed relative to winding = faces up
      V.splice(vi, 1)
      clipped = true
      break
    }
    if (!clipped) {
      if (bestVi === -1) break // no convex corner left at all — degenerate
      const i0 = V[(bestVi - 1 + V.length) % V.length]
      const i1 = V[bestVi]
      const i2 = V[(bestVi + 1) % V.length]
      idx.push(i0, i2, i1)
      V.splice(bestVi, 1)
    }
  }
  if (V.length === 3) idx.push(V[0], V[2], V[1])
  return idx
}

// CARVED water for one altitude lake: the glass top sits FLUSH with the
// surrounding terrain level (the DEM already holds lakes as flats at shore
// height — the water reads as recessed because the land rises around it),
// so no lift and no bevel: just short buried walls, one small inset ring
// easing the wave weight in, and an ear-clipped flat middle. If the inset
// ring's polygon self-intersects on a concave shore (detected by an
// incomplete triangulation), the fill falls back to the rim polygon itself,
// which is simple by construction — filled and rigid beats hollow.
// Groups: material 0 = top (transmission), material 1 = walls (tinted).
function lakePrismGeometry(contour, yBottom, yTop, fadeInset) {
  const M = contour.length
  const pos = []
  const nrm = []
  const wgt = []
  const put = (x, y, z, nx, ny, nz, w) => {
    pos.push(x, y, z)
    nrm.push(nx, ny, nz)
    wgt.push(w)
  }

  // walls: two rings on the exact contour, top edge flush
  for (const ring of [{ y: yBottom }, { y: yTop }])
    for (const p of contour) put(p.x, ring.y, p.z, p.nx, 0, p.nz, 0)

  const idx = []
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M
    idx.push(i, M + i, M + j, i, M + j, j)
  }
  const sideCount = idx.length

  // cap rim: same positions as the top wall ring but facing up (the wall
  // ring keeps its horizontal normals — sharing verts would fake a dome
  // edge on what must read as a dead-flat flush surface)
  const rim = pos.length / 3
  for (const p of contour) put(p.x, yTop, p.z, 0, 1, 0, 0)

  // interior fill — try the inset ring (gives the swell interior vertices),
  // validated by triangle count: a full triangulation of an M-gon has M-2
  // triangles, anything less means the inset polygon folded
  const innerPoly = contour.map((p) => ({ x: p.x - p.nx * fadeInset, z: p.z - p.nz * fadeInset }))
  const innerTris = fadeInset > 0 ? earClipUp(innerPoly) : []
  if (fadeInset > 0 && innerTris.length === (M - 2) * 3) {
    const inner = pos.length / 3
    for (const p of innerPoly) put(p.x, yTop, p.z, 0, 1, 0, 1)
    // rim -> inner ring strip (top-facing), then the ear-clipped middle
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M
      idx.push(rim + i, inner + i, inner + j, rim + i, inner + j, rim + j)
    }
    for (const t of innerTris) idx.push(inner + t)
  } else {
    // fallback: fill the rim polygon directly (simple by construction)
    for (const t of earClipUp(contour)) idx.push(rim + t)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3))
  geo.setAttribute('waveWeight', new THREE.BufferAttribute(new Float32Array(wgt), 1))
  geo.setIndex(idx)
  geo.addGroup(0, sideCount, 1) // walls → tinted side glass
  geo.addGroup(sideCount, idx.length - sideCount, 0) // top → transmission
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

  // rebuild everything for the current zone: the sea block up to elevation 0
  // (gated by lakeEnabled), and one carved glass lake per detected flat —
  // gated ONLY by lakesAltitude, so mountain lakes show even while the sea
  // glass is switched off
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
    if (!params.lakesAltitude || !dem) return

    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const lakes = detectLakes(dem)
    for (const lake of lakes) {
      const { cells, elevM, size } = lake
      // the lake's water level, raised past the fine-detail grain
      const yLake = (elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6
      // CARVED water: the glass sits flush with the surrounding ground (the
      // DEM holds lakes as flats at shore level — the land rising around is
      // what reads as the carve); a whisker of lift avoids z-fighting
      const yTop = yLake + 0.02
      const yBottom = yLake - 0.5 // buried walls cap the volume — no gap

      // pixel staircase -> smooth shoreline
      const raw = traceLakeOutline(cells, size)
      if (!raw || raw.length < 8) continue
      let pts = decimateClosed(raw, 220)
      pts = chaikinClosed(pts, 2)
      let per = 0
      let area2 = 0
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const q = pts[(i + 1) % pts.length]
        per += Math.hypot(q.x - p.x, q.z - p.z)
        area2 += p.x * q.z - q.x * p.z
      }
      // point budget follows the perimeter; the wave fade inset follows the
      // lake's mean half-width so it cannot fold across a narrow ribbon
      const budget = Math.max(48, Math.min(240, Math.round(per / 0.14)))
      const contour = contourNormals(decimateClosed(pts, budget))
      const halfWidth = Math.abs(area2) / Math.max(1e-6, per)
      const fadeInset = Math.min(0.4, halfWidth * 0.25)

      const geo = lakePrismGeometry(contour, yBottom, yTop, fadeInset)
      const mesh = new THREE.Mesh(geo, [this.lakeMat, this.seaSideMat])
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
