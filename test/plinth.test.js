import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSlab } from '../src/plinth.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const HALF = TERRAIN_SIZE / 2

test('ring walks the full border, four sides, at the requested resolution', () => {
  const { ring } = computeSlab(() => 1, 7, 200)
  assert.equal(ring.length, 800) // 200 samples × 4 sides
  // every ring point sits on a border line
  for (const p of ring) {
    const onEdge = Math.abs(Math.abs(p.x) - HALF) < 1e-9 || Math.abs(Math.abs(p.z) - HALF) < 1e-9
    assert.ok(onEdge, `ring point (${p.x},${p.z}) not on the border`)
  }
})

test('ring resolution matches the terrain mesh so walls have no gaps', () => {
  // a coarse ring would miss relief between samples → visible underside
  assert.equal(computeSlab(() => 0, 7, 1024).ring.length, 4096)
  assert.equal(computeSlab(() => 0, 7, 8).ring.length, 32) // floor guard
})

test('ring x/z land exactly on terrain PlaneGeometry edge-vertex positions', () => {
  // PlaneGeometry(56,56,res,res) rotated to XZ puts edge vertices at
  // -HALF + i*(TERRAIN_SIZE/res). The wall ring MUST hit those same x/z or the
  // wall top won't seal against the relief border.
  const res = 1024
  const { ring } = computeSlab((x, z) => x + z, 7, res)
  const grid = new Set()
  for (let i = 0; i <= res; i++) grid.add((-HALF + (TERRAIN_SIZE * i) / res).toFixed(6))
  for (const p of ring) {
    const onX = grid.has(p.x.toFixed(6)) || Math.abs(Math.abs(p.x) - HALF) < 1e-9
    const onZ = grid.has(p.z.toFixed(6)) || Math.abs(Math.abs(p.z) - HALF) < 1e-9
    assert.ok(onX && onZ, `ring point (${p.x},${p.z}) is off the mesh edge grid`)
  }
})

test('baseY sits `depth` below a flat surface', () => {
  const { baseY, borderMin, globalMin } = computeSlab(() => 2.5, 7)
  assert.equal(borderMin, 2.5)
  assert.equal(globalMin, 2.5)
  assert.equal(baseY, 2.5 - 7)
})

test('baseY follows the GLOBAL min — a deep interior basin never pierces it', () => {
  // flat border at y=0, but a pit down to -20 in the middle
  const sample = (x, z) => (Math.hypot(x, z) < 6 ? -20 : 0)
  const { borderMin, globalMin, baseY } = computeSlab(sample, 7)
  assert.equal(borderMin, 0, 'border is flat')
  assert.ok(globalMin <= -20 + 1e-9, 'interior sweep finds the pit')
  assert.ok(baseY < -20, `base (${baseY}) sits below the basin floor`)
})

test('a corner radius fillets the four salient vertical edges (rounded footprint)', () => {
  const r = 0.08 * TERRAIN_SIZE // 8% of the block width
  const { ring } = computeSlab(() => 0, 7, 256, r)
  // every ring point sits INSIDE (or on) the square, and the sharp square
  // corners are cut away: nothing intrudes nearer to a true corner than the
  // fillet allows (the closest an arc gets is r·(√2−1))
  const minCornerDist = r * (Math.SQRT2 - 1) - 1e-6
  for (const p of ring) {
    assert.ok(Math.abs(p.x) <= HALF + 1e-6 && Math.abs(p.z) <= HALF + 1e-6, 'inside the square')
    const dc = Math.hypot(HALF - Math.abs(p.x), HALF - Math.abs(p.z))
    assert.ok(dc >= minCornerDist, `point (${p.x.toFixed(1)},${p.z.toFixed(1)}) intrudes into the cut corner`)
  }
  // the straight flats still reach the full extent on all four sides
  const reaches = (pred) => ring.some(pred)
  assert.ok(reaches((p) => Math.abs(p.z + HALF) < 1e-6), 'top flat present (z=-HALF)')
  assert.ok(reaches((p) => Math.abs(p.x - HALF) < 1e-6), 'right flat present (x=+HALF)')
  assert.ok(reaches((p) => Math.abs(p.z - HALF) < 1e-6), 'bottom flat present (z=+HALF)')
  assert.ok(reaches((p) => Math.abs(p.x + HALF) < 1e-6), 'left flat present (x=-HALF)')
  // the rounded ring stays watertight — arc points lie on the fillet circle
  const inner = HALF - r
  for (const p of ring) {
    if (Math.abs(p.x) > inner && Math.abs(p.z) > inner) {
      const d = Math.hypot(Math.abs(p.x) - inner, Math.abs(p.z) - inner)
      assert.ok(Math.abs(d - r) < 1e-6, `arc point off the fillet circle (d=${d.toFixed(3)}, r=${r})`)
    }
  }
})

test('corner smoothing shapes the fillet as a superellipse (squircle)', () => {
  const r = 0.04 * TERRAIN_SIZE // v15: half the previous radius
  const expo = 2 + 0.6 * 4 // smoothing 0.6 → exponent 4.4
  const { ring } = computeSlab(() => 0, 7, 256, r, expo)
  const inner = HALF - r
  let arcPts = 0
  for (const p of ring) {
    if (Math.abs(p.x) > inner + 1e-6 && Math.abs(p.z) > inner + 1e-6) {
      arcPts++
      const dx = Math.abs(p.x) - inner
      const dz = Math.abs(p.z) - inner
      // on the superellipse boundary: |dx|^n + |dz|^n == r^n
      const pn = Math.pow(Math.pow(dx, expo) + Math.pow(dz, expo), 1 / expo)
      assert.ok(Math.abs(pn - r) < 1e-6, `corner point off the superellipse (pn=${pn.toFixed(4)}, r=${r})`)
      // a squircle bulges FULLER than a circle: the p-norm point sits closer to
      // the true corner than the circular arc would (dist < r·(√2−1) fails here)
    }
  }
  assert.ok(arcPts > 0, 'the rounded corners produced arc points')
  // flats still reach the full extent
  assert.ok(ring.some((p) => Math.abs(p.x - HALF) < 1e-6), 'right flat still at +HALF')
})

test('zero corner radius keeps the exact square ring (backward compatible)', () => {
  const sq = computeSlab(() => 0, 7, 200)
  const sq2 = computeSlab(() => 0, 7, 200, 0)
  assert.equal(sq.ring.length, 800)
  assert.equal(sq2.ring.length, 800)
})
