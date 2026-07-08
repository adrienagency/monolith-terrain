import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestSnap } from '../src/drag.js'

test('nearestSnap grabs the closest candidate within threshold', () => {
  // aligning a left edge to a panel column at x=200
  assert.equal(nearestSnap(205, [200, 640], 11), 200)
  assert.equal(nearestSnap(196, [200, 640], 11), 200)
})

test('nearestSnap leaves the value alone when nothing is close', () => {
  assert.equal(nearestSnap(400, [200, 640], 11), 400)
})

test('nearestSnap picks the nearer of two candidates', () => {
  assert.equal(nearestSnap(636, [200, 640], 11), 640)
  assert.equal(nearestSnap(340, [335, 348], 11), 335)
})

test('nearestSnap respects the threshold boundary', () => {
  assert.equal(nearestSnap(212, [200], 11), 212) // 12 px away → no snap
  assert.equal(nearestSnap(210, [200], 11), 200) // 10 px away → snaps
})
