import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  headingAt,
  computeArchSpecs,
  perpOf,
  ARCH_SPAN,
  ARCH_HEIGHT,
  ARCH_POST_THICK,
  ARCH_BEAM_THICK,
} from '../src/arch.js'

test('headingAt points from the previous point to the next, normalized', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }]
  const h = headingAt(world, 1)
  assert.ok(Math.abs(h.x - 1) < 1e-9 && Math.abs(h.z) < 1e-9)
})

test('headingAt at the very start/end uses the single adjacent segment', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }]
  assert.deepEqual(headingAt(world, 0), { x: 0, z: 1 })
  assert.deepEqual(headingAt(world, 1), { x: 0, z: 1 })
})

test('headingAt falls back to +Z for a degenerate (coincident) neighbourhood', () => {
  const world = [{ x: 3, y: 0, z: 3 }, { x: 3, y: 0, z: 3 }, { x: 3, y: 0, z: 3 }]
  assert.deepEqual(headingAt(world, 1), { x: 0, z: 1 })
})

test('computeArchSpecs: point-to-point yields two independent gates', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 10, y: 0, z: 2 }]
  const specs = computeArchSpecs(world, false)
  assert.equal(specs.length, 2)
  assert.equal(specs[0].kind, 'start')
  assert.equal(specs[1].kind, 'finish')
  assert.equal(specs[0].pos, world[0])
  assert.equal(specs[1].pos, world[world.length - 1])
})

test('computeArchSpecs: a loop yields ONE gate carrying both directions', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 5 }, { x: 0, y: 0, z: 0.2 }]
  const specs = computeArchSpecs(world, true)
  assert.equal(specs.length, 1)
  assert.equal(specs[0].kind, 'loop')
  assert.ok(specs[0].outDir && specs[0].inDir)
})

test('computeArchSpecs is empty for a degenerate (<2 point) track', () => {
  assert.deepEqual(computeArchSpecs([{ x: 0, y: 0, z: 0 }], false), [])
  assert.deepEqual(computeArchSpecs(null, false), [])
})

test('perpOf rotates a heading 90 degrees (unit length preserved)', () => {
  const p = perpOf({ x: 1, z: 0 })
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.z - (-1)) < 1e-9)
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 1) < 1e-9)
})

test('arch sizing constants are positive and in a sane world-unit band', () => {
  assert.ok(ARCH_SPAN > 0.5 && ARCH_SPAN < 10)
  assert.ok(ARCH_HEIGHT > 0.5 && ARCH_HEIGHT < 10)
})

// task 24: "deux pylônes de 400x100px et une traverse de 600x100px" — a real
// truss gantry, not two thin sticks. Pins the exact ratios from the brief:
// pylon height:width = 4:1, beam length:thickness = 6:1, beam spanning the
// FULL clear width (span + one post thickness, so its ends land flush with
// each post's outer face).
test('arch pylon is a 4:1 height:width rectangle, not a thin flagpole', () => {
  assert.ok(Math.abs(ARCH_HEIGHT / ARCH_POST_THICK - 4) < 1e-9)
})

test('arch beam is a 6:1 length:thickness rectangle and spans the full gate width', () => {
  const beamLen = ARCH_SPAN + ARCH_POST_THICK // same formula buildArchMesh uses
  assert.ok(Math.abs(beamLen / ARCH_BEAM_THICK - 6) < 1e-9)
})

test('the pylon width and the beam thickness share the same module (both "100" in the reference photo)', () => {
  assert.equal(ARCH_POST_THICK, ARCH_BEAM_THICK)
})
