import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSlab } from '../src/plinth.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const HALF = TERRAIN_SIZE / 2

test('ring walks the full border, four sides', () => {
  const { ring } = computeSlab(() => 1, 7)
  assert.equal(ring.length, 640) // 160 samples × 4 sides
  // every ring point sits on a border line
  for (const p of ring) {
    const onEdge = Math.abs(Math.abs(p.x) - HALF) < 1e-9 || Math.abs(Math.abs(p.z) - HALF) < 1e-9
    assert.ok(onEdge, `ring point (${p.x},${p.z}) not on the border`)
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
