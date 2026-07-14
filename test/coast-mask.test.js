import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bboxIntersects,
  ringBBox,
  landPolygonsInBBox,
  projectPatchPx,
  lonLatToGridTile,
  gridTileRange,
} from '../src/coast-mask.js'

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

test('projectPatchPx projects longitude continuously — no antimeridian wrap that tears >180° polygons', () => {
  // a coarse z5 patch (tile count 32) like the one that exposed the bug: Afro-
  // Eurasia spans ~198° of longitude; geo.latLonToWorld's shortest-delta wrap
  // folded its far-east vertices to the opposite canvas edge, inverting the
  // evenodd fill in latitude bands (Denmark/North Sea read swapped).
  const dem = { zoom: 5, originTileX: 15, originTileY: 8, size: 768 }
  const size = 1024
  const pxAt = (lon) => projectPatchPx(dem, lon, 45, size)[0]
  // across a sweep that WOULD fold under a [-n/2, n/2] wrap, px must stay
  // strictly increasing — one continuous shape, no jump to the far side.
  const lons = [-20, 0, 60, 120, 160, 176]
  for (let i = 1; i < lons.length; i++) {
    assert.ok(pxAt(lons[i]) > pxAt(lons[i - 1]), `px must rise with lon (${lons[i - 1]}→${lons[i]})`)
  }
  // a far-east vertex projects OFF the right edge (positive), never wrapped negative
  assert.ok(pxAt(176) > size, 'far-east vertex projects off the right edge, not folded')
})

test('projectPatchPx maps north to the top of the canvas', () => {
  const dem = { zoom: 5, originTileX: 15, originTileY: 8, size: 768 }
  const yNorth = projectPatchPx(dem, 6, 60, 1024)[1]
  const ySouth = projectPatchPx(dem, 6, 40, 1024)[1]
  assert.ok(ySouth > yNorth, 'lower latitude maps further down the canvas (larger py)')
})

test('lonLatToGridTile: slippy z6 tile of a lon/lat, clamped in range', () => {
  assert.deepEqual(lonLatToGridTile(0, 0, 6), [32, 32]) // centre of the world
  assert.deepEqual(lonLatToGridTile(-180, 0, 6), [0, 32]) // west edge
  assert.deepEqual(lonLatToGridTile(179.9, 0, 6), [63, 32]) // east edge (last col)
  const [, yN] = lonLatToGridTile(0, 60, 6)
  const [, yS] = lonLatToGridTile(0, 40, 6)
  assert.ok(yN < yS, 'higher latitude → smaller tileY (further north = top)')
  assert.deepEqual(lonLatToGridTile(200, 100, 6), [63, lonLatToGridTile(0, 85.05, 6)[1]]) // clamped
})

test('gridTileRange: the z6 tiles covering a patch bbox (north = smaller y)', () => {
  const bbox = { west: 6, south: 41, east: 13, north: 44 } // central Italy patch
  const r = gridTileRange(bbox, 6)
  assert.ok(r.x0 <= r.x1 && r.y0 <= r.y1, 'ranges are ordered')
  // west/east corners define x0/x1; north/south define y0/y1
  assert.equal(r.x0, lonLatToGridTile(6, 44, 6)[0])
  assert.equal(r.x1, lonLatToGridTile(13, 41, 6)[0])
  assert.equal(r.y0, lonLatToGridTile(6, 44, 6)[1]) // north edge → smallest y
  assert.equal(r.y1, lonLatToGridTile(13, 41, 6)[1]) // south edge → largest y
})
