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
