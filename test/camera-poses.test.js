import { test } from 'node:test'
import assert from 'node:assert/strict'
import { peakVantage } from '../src/camera-poses.js'

test('vantage sits above the peak and targets its top', () => {
  const { pos, target } = peakVantage(10, 4, 0)
  assert.ok(pos.y > 4, 'camera rises above the summit')
  assert.equal(pos.y, 4 + 5.6)
  assert.equal(target.x, 10)
  assert.equal(target.z, 0)
  assert.ok(target.y > 4 && target.y < pos.y, 'target is the summit top, below the camera')
})

test('camera stands off outward along the radial', () => {
  const { pos } = peakVantage(10, 4, 0) // due +x from center
  assert.ok(pos.x > 10, 'pulled further out in x')
  assert.equal(pos.z, 0)
  // standoff distance is exactly the radial offset
  assert.ok(Math.abs(Math.hypot(pos.x - 10, pos.z - 0) - 3.4) < 1e-9)
})

test('a peak at the exact center still gets a defined vantage', () => {
  const { pos, target } = peakVantage(0, 2, 0)
  assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.z), 'no divide-by-zero NaN')
  assert.equal(pos.y, 2 + 5.6)
  assert.equal(target.x, 0)
  assert.equal(target.z, 0)
})
