import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slabInside, makeInsideBlock, clipPolylineToBlock } from '../src/map/block-clip.js'

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
