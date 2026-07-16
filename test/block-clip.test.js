import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slabInside, makeInsideBlock, clipPolylineToBlock, blockOutline, clipPolygonToBlock } from '../src/map/block-clip.js'

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
