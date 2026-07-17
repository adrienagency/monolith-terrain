import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reorderArray, layerDepth, nextLayerIndex, canAddLayer, MAX_LAYERS } from '../src/gpx-layers.js'

// ---- reorderArray (drag/drop reorder — task 22 §2) -------------------------

test('reorderArray moves an item forward, shifting the ones in between back', () => {
  assert.deepEqual(reorderArray(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'])
})

test('reorderArray moves an item backward, shifting the ones in between forward', () => {
  assert.deepEqual(reorderArray(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c'])
})

test('reorderArray is a no-op copy when from === to or indices are out of range', () => {
  const src = ['a', 'b', 'c']
  assert.deepEqual(reorderArray(src, 1, 1), src)
  assert.deepEqual(reorderArray(src, -1, 1), src)
  assert.deepEqual(reorderArray(src, 1, 9), src)
})

test('reorderArray never mutates the input array', () => {
  const src = ['a', 'b', 'c']
  const out = reorderArray(src, 0, 2)
  assert.deepEqual(src, ['a', 'b', 'c'])
  assert.notEqual(out, src)
})

// ---- layerDepth (render stacking + anti-z-fight nudge) ---------------------

test('layerDepth: top of the panel list (idx 0) gets the HIGHEST renderOffset — draws last, on top', () => {
  const d0 = layerDepth(0, 3)
  const d1 = layerDepth(1, 3)
  const d2 = layerDepth(2, 3)
  assert.ok(d0.renderOffset > d1.renderOffset)
  assert.ok(d1.renderOffset > d2.renderOffset)
  assert.equal(d2.renderOffset, 0, 'the bottom-of-list layer keeps the original (zero-offset) renderOrder')
})

test('layerDepth: yNudge separates otherwise-coincident layers (no z-fight) and also ranks top-first', () => {
  const d0 = layerDepth(0, 2)
  const d1 = layerDepth(1, 2)
  assert.ok(d0.yNudge > d1.yNudge)
  assert.equal(d1.yNudge, 0)
})

test('layerDepth is stable for a single layer (no stacking needed)', () => {
  assert.deepEqual(layerDepth(0, 1), { renderOffset: 0, yNudge: 0 })
})

// ---- nextLayerIndex (sequenced playback order — task 22 §5) ----------------

test('nextLayerIndex advances through the list in panel order', () => {
  assert.equal(nextLayerIndex(3, 0), 1)
  assert.equal(nextLayerIndex(3, 1), 2)
})

test('nextLayerIndex returns -1 once the last layer has played', () => {
  assert.equal(nextLayerIndex(3, 2), -1)
  assert.equal(nextLayerIndex(1, 0), -1)
  assert.equal(nextLayerIndex(0, 0), -1)
})

// ---- MAX_LAYERS cap (task 22 §2: "un ordre > 1 à 10 max") -------------------

test('canAddLayer allows up to MAX_LAYERS (10) and refuses beyond it', () => {
  assert.equal(MAX_LAYERS, 10)
  assert.equal(canAddLayer(9), true)
  assert.equal(canAddLayer(10), false)
  assert.equal(canAddLayer(11), false)
})
