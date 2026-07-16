import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slabInside, makeInsideBlock, clipPolylineToBlock, blockOutline, clipPolygonToBlock, triangulateAndClip } from '../src/map/block-clip.js'

test('slabInside: plain square (corner 0)', () => {
  assert.equal(slabInside(0, 0, 28, 0, 2), true)
  assert.equal(slabInside(27.9, 0, 28, 0, 2), true)
  assert.equal(slabInside(28.1, 0, 28, 0, 2), false)
})

test('slabInside: rounded corner cuts the corner region', () => {
  // half 28, corner 8, n 2 → circle of r8 centered at (20,20)
  assert.equal(slabInside(20, 20, 28, 8, 2), true)   // at the corner center
  assert.equal(slabInside(27.9, 27.9, 28, 8, 2), false) // past the fillet
  assert.equal(slabInside(0, 27.9, 28, 8, 2), true)  // straight edge unaffected
})

test('makeInsideBlock composes region sampler', () => {
  const f = makeInsideBlock({ half: 28, corner: 0, cornerN: 2, regionOn: true, regionSample: (x) => (x < 0 ? 1 : 0) })
  assert.equal(f(-5, 0), true)   // inside slab AND region
  assert.equal(f(5, 0), false)   // inside slab, outside region
})

test('clipPolylineToBlock: fully inside passes as one run', () => {
  const inside = () => true
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 2, z: 0 }], inside, 1)
  assert.equal(runs.length, 1)
})

test('clipPolylineToBlock: fully outside yields no runs', () => {
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 2, z: 0 }], () => false, 1)
  assert.equal(runs.length, 0)
})

test('clipPolylineToBlock: crossing splits and lands on boundary x=10', () => {
  const inside = (x) => x <= 10
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 20, z: 0 }], inside, 1)
  assert.equal(runs.length, 1)
  const end = runs[0][runs[0].length - 1]
  assert.ok(Math.abs(end.x - 10) < 0.2, `end x ${end.x} ~ 10`)
})

// Cross product of consecutive edges, for convexity checks below.
function edgeCross(p0, p1, p2) {
  const e1x = p1.x - p0.x, e1z = p1.z - p0.z
  const e2x = p2.x - p1.x, e2z = p2.z - p1.z
  return e1x * e2z - e1z * e2x
}

test('blockOutline: points are inscribed (conservative) — every point satisfies slabInside', () => {
  const fp = { half: 28, corner: 8, cornerN: 2 }
  const outline = blockOutline(fp, 64)
  const open = outline.slice(0, -1)
  for (const p of open) assert.equal(slabInside(p.x, p.z, fp.half, fp.corner, fp.cornerN), true, `(${p.x},${p.z}) should be inside`)
})

test('blockOutline: ring is closed and convex', () => {
  const fp = { half: 28, corner: 8, cornerN: 2 }
  const outline = blockOutline(fp, 64)
  assert.equal(outline[0].x, outline[outline.length - 1].x)
  assert.equal(outline[0].z, outline[outline.length - 1].z)
  const open = outline.slice(0, -1)
  // convex ⇔ consecutive edge cross products keep one sign all the way round
  let sign = 0
  for (let i = 0; i < open.length; i++) {
    const p0 = open[(i - 1 + open.length) % open.length]
    const p1 = open[i]
    const p2 = open[(i + 1) % open.length]
    const cross = edgeCross(p0, p1, p2)
    // Points along a straight edge are collinear (cross ~ 0) up to bisection
    // float noise (~1e-8 given 30 iterations over a ~40-unit search range);
    // real corners have cross magnitudes >> this, so a generous epsilon still
    // catches an actual convexity violation.
    if (Math.abs(cross) < 1e-4) continue
    if (sign === 0) sign = Math.sign(cross)
    else assert.equal(Math.sign(cross), sign, `edge ${i} cross sign flipped — not convex`)
  }
})

test('clipPolygonToBlock: huge square gets pulled entirely inside the block — regression for the fill-overflow bug', () => {
  const fp = { half: 28, corner: 8, cornerN: 2 }
  const outline = blockOutline(fp, 128)
  const hugeSquare = [{ x: -50, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 50 }, { x: -50, z: 50 }, { x: -50, z: -50 }]
  const clipped = clipPolygonToBlock(hugeSquare, outline)
  assert.ok(clipped.length >= 3, 'clip should produce a polygon')
  for (const p of clipped) assert.equal(slabInside(p.x, p.z, fp.half, fp.corner, fp.cornerN), true, `(${p.x},${p.z}) escaped the block`)
})

test('clipPolygonToBlock: polygon entirely inside is returned unchanged', () => {
  const fp = { half: 28, corner: 0, cornerN: 2 }
  const outline = blockOutline(fp, 64)
  const small = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }, { x: -5, z: -5 }]
  const clipped = clipPolygonToBlock(small, outline)
  assert.deepEqual(clipped, small)
})

test('clipPolygonToBlock: polygon entirely outside returns []', () => {
  const fp = { half: 28, corner: 0, cornerN: 2 }
  const outline = blockOutline(fp, 64)
  const far = [{ x: 1000, z: 1000 }, { x: 1010, z: 1000 }, { x: 1010, z: 1010 }, { x: 1000, z: 1010 }, { x: 1000, z: 1000 }]
  const clipped = clipPolygonToBlock(far, outline)
  assert.deepEqual(clipped, [])
})

// --- triangulateAndClip: triangulate-first, clip-per-triangle (Defect 1 & 2) ---

// Barycentric point-in-triangle test, used to sample whether a given point
// ended up covered by any returned triangle (fan-triangulated from each
// convex polygon triangulateAndClip returns).
function pointInTriangle(p, a, b, c) {
  const d1 = (p.x - b.x) * (a.z - b.z) - (a.x - b.x) * (p.z - b.z)
  const d2 = (p.x - c.x) * (b.z - c.z) - (b.x - c.x) * (p.z - c.z)
  const d3 = (p.x - a.x) * (c.z - a.z) - (c.x - a.x) * (p.z - a.z)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

// Fan-triangulate every convex polygon triangulateAndClip returns (matching
// the rendering path in water-layer.js) into a flat list of {a,b,c} triangles.
function fanTriangles(polys) {
  const out = []
  for (const poly of polys) {
    const open = poly.length > 1 && poly[0].x === poly[poly.length - 1].x && poly[0].z === poly[poly.length - 1].z ? poly.slice(0, -1) : poly
    for (let k = 1; k < open.length - 1; k++) out.push({ a: open[0], b: open[k], c: open[k + 1] })
  }
  return out
}

function anyTriangleCovers(polys, p) {
  return fanTriangles(polys).some((t) => pointInTriangle(p, t.a, t.b, t.c))
}

test('triangulateAndClip: square with a square hole triangulates to an annulus — the hole is not covered', () => {
  const outer = [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }, { x: -10, z: -10 }]
  const hole = [{ x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 3 }, { x: -3, z: 3 }, { x: -3, z: -3 }]
  const outline = [{ x: -50, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 50 }, { x: -50, z: 50 }, { x: -50, z: -50 }] // well outside outer — no-op clip
  const polys = triangulateAndClip(outer, [hole], outline)
  assert.ok(polys.length > 0, 'should produce triangles')
  assert.equal(anyTriangleCovers(polys, { x: 0, z: 0 }), false, 'hole centre must not be covered')
  // sanity: a point in the annulus body IS covered
  assert.equal(anyTriangleCovers(polys, { x: 6, z: 0 }), true, 'annulus body should be covered')
})

test('triangulateAndClip: concave polygon straddling the block edge — no triangle exceeds the block, and the notch stays uncovered', () => {
  // A "staple"/C-shape: backbone rectangle x:[-5,15] z:[-5,5] with a
  // rectangular notch bitten out of its right side (x:[9,15] z:[-3,3]) —
  // concave, and its two prongs (top/bottom of the notch) poke straight
  // through the right edge of a half=10 block.
  const outer = [
    { x: -5, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 3 }, { x: 9, z: 3 },
    { x: 9, z: -3 }, { x: 15, z: -3 }, { x: 15, z: -5 }, { x: -5, z: -5 }, { x: -5, z: 5 },
  ]
  const fp = { half: 10, corner: 0, cornerN: 2 }
  const outline = blockOutline(fp, 128)
  const polys = triangulateAndClip(outer, [], outline)
  assert.ok(polys.length > 0, 'should produce triangles')
  const half = 10 + 1e-6
  for (const poly of polys) for (const p of poly) {
    assert.ok(Math.abs(p.x) <= half && Math.abs(p.z) <= half, `(${p.x},${p.z}) escaped the block`)
  }
  // The notch (x in (9,10), z in (-3,3)) is genuinely outside the subject —
  // it must stay uncovered even though it sits inside the block window,
  // right where a whole-polygon clip-then-triangulate would be tempted to
  // bridge across it.
  assert.equal(anyTriangleCovers(polys, { x: 9.5, z: 0 }), false, 'notch must not be covered')
  // sanity: the backbone well inside the block IS covered
  assert.equal(anyTriangleCovers(polys, { x: 0, z: 0 }), true, 'backbone should be covered')
})
