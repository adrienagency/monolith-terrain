import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bboxIntersects, ringBBox, landPolygonsInBBox } from '../src/coast-mask.js'

test('bboxIntersects: overlap, touch, and disjoint', () => {
  const a = { west: 0, south: 0, east: 10, north: 10 }
  assert.equal(bboxIntersects(a, { west: 5, south: 5, east: 15, north: 15 }), true)
  assert.equal(bboxIntersects(a, { west: 10, south: 0, east: 20, north: 10 }), true) // edge touch
  assert.equal(bboxIntersects(a, { west: 11, south: 0, east: 20, north: 10 }), false)
  assert.equal(bboxIntersects(a, { west: 0, south: 11, east: 10, north: 20 }), false)
})

test('ringBBox spans the ring extent', () => {
  const bb = ringBBox([[2, 3], [-1, 8], [4, -2], [2, 3]])
  assert.deepEqual(bb, { west: -1, south: -2, east: 4, north: 8 })
})

test('landPolygonsInBBox keeps only polygons whose bbox meets the patch', () => {
  const features = [
    { geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }, // near origin
    { geometry: { type: 'Polygon', coordinates: [[[50, 50], [51, 50], [51, 51], [50, 51], [50, 50]]] } }, // far
    { geometry: { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]],   // near
      [[[80, 80], [81, 80], [81, 81], [80, 80]]], // far part of same feature
    ] } },
  ]
  const bbox = { west: -1, south: -1, east: 2, north: 2 }
  const kept = landPolygonsInBBox(features, bbox)
  // the near single polygon + the near part of the multipolygon = 2 rings-groups; the two far ones dropped
  assert.equal(kept.length, 2)
  assert.ok(kept.every((rings) => Array.isArray(rings) && Array.isArray(rings[0])))
})
