import { test } from 'node:test'
import assert from 'node:assert/strict'
import { densifyWorld, drapeWorld } from '../src/map/draped-line.js'

test('densifyWorld subdivides long segments', () => {
  const out = densifyWorld([{ x: 0, z: 0 }, { x: 10, z: 0 }], 2) // len 10, step 2 → 5 sub-steps
  assert.equal(out.length, 6) // 5 segments + final point
  assert.deepEqual(out[0], { x: 0, z: 0 })
  assert.deepEqual(out[out.length - 1], { x: 10, z: 0 })
  assert.ok(Math.abs(out[1].x - 2) < 1e-9)
})

test('densifyWorld leaves short segments intact', () => {
  const out = densifyWorld([{ x: 0, z: 0 }, { x: 1, z: 0 }], 5)
  assert.equal(out.length, 2)
})

test('drapeWorld lifts each point to sample + offset', () => {
  const sample = (x) => x * 10
  const arr = drapeWorld([{ x: 1, z: 2 }, { x: 3, z: 4 }], sample, 0.1)
  const expected = [1, 10.1, 2, 3, 30.1, 4]
  assert.equal(arr.length, 6)
  for (let i = 0; i < expected.length; i++) {
    assert.ok(Math.abs(arr[i] - expected[i]) < 1e-6, `arr[${i}] = ${arr[i]}, expected ${expected[i]}`)
  }
})
