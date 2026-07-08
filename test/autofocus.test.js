import { test } from 'node:test'
import assert from 'node:assert/strict'
import { focusRayHit } from '../src/autofocus.js'

const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

test('a ray straight down hits a flat surface at the camera height', () => {
  const flat = () => 0
  const hit = focusRayHit({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, flat, { halfExtent: 28 })
  assert.ok(Math.abs(hit - 10) < 0.05, `expected ~10, got ${hit}`)
})

test('an angled ray hits farther away than a vertical one', () => {
  const flat = () => 0
  const straight = focusRayHit({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, flat)
  const angled = focusRayHit({ x: 0, y: 10, z: 0 }, norm({ x: 0.6, y: -1, z: 0 }), flat)
  assert.ok(angled > straight, `angled ${angled} should exceed straight ${straight}`)
})

test('a ray pointing up and away never hits (miss → null)', () => {
  const flat = () => 0
  const hit = focusRayHit({ x: 0, y: 10, z: 0 }, norm({ x: 0.2, y: 1, z: 0 }), flat)
  assert.equal(hit, null)
})

test('the hit tracks a raised surface — closer focus over a hill', () => {
  const flatHit = focusRayHit({ x: 0, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, () => 0)
  const hillHit = focusRayHit({ x: 0, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, () => 8)
  assert.ok(hillHit < flatHit, 'a hill under the cursor pulls focus nearer')
  assert.ok(Math.abs(hillHit - 12) < 0.1, `expected ~12 (20-8), got ${hillHit}`)
})

test('a ray leaving the patch without crossing returns null', () => {
  // camera low, ray nearly horizontal over a flat floor it never reaches
  const hit = focusRayHit({ x: -28, y: 0.5, z: 0 }, norm({ x: 1, y: 0.02, z: 0 }), () => 0, { halfExtent: 28 })
  assert.equal(hit, null)
})
