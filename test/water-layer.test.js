import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterRiverwayLines, waterLevelOf } from '../src/map/water-layer.js'

// Pins the client-side waterway-kind filter added for the "on retire les
// torrents, et les cours d'eau, on ne garde que points d'eau, les lacs, les
// mares, les fleuves et les rivières" requirement. The bare
// `fetchOverpassLines(bounds, 'water')` query returns every waterway=* line
// unfiltered (see the comment above filterRiverwayLines in water-layer.js
// for why the Overpass query itself stays unfiltered); this function is the
// only thing standing between that raw feed and torrents/streams/canals
// rendering on the map.
test('filterRiverwayLines keeps only river/riverbank, drops stream/torrent/canal/ditch/drain', () => {
  const feats = [
    { coords: [[0, 0], [1, 1]], kind: 'river', name: 'La Romanche' },
    { coords: [[0, 0], [1, 1]], kind: 'riverbank', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'stream', name: 'Torrent de la Lanche' },
    { coords: [[0, 0], [1, 1]], kind: 'torrent', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'canal', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'ditch', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'drain', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'brook', name: '' },
  ]
  const kept = filterRiverwayLines(feats)
  assert.deepEqual(kept.map((f) => f.kind).sort(), ['river', 'riverbank'])
})

test('filterRiverwayLines on an all-torrent set returns empty, not a throw', () => {
  const feats = [
    { coords: [[0, 0], [1, 1]], kind: 'stream', name: '' },
    { coords: [[0, 0], [1, 1]], kind: 'ditch', name: '' },
  ]
  assert.deepEqual(filterRiverwayLines(feats), [])
})

// --- lakes are FLAT -----------------------------------------------------------
// A lake surface is a level plane. The fill used to drape every vertex at
// terrain height, so wherever the polygon overlapped rising shore (data vs DEM
// misalignment is inevitable at the waterline) the "lake" physically climbed
// the hillside — blue paint running up a mountain. waterLevelOf picks the one
// height the whole surface sits at.

test('waterLevelOf: the median, robust against a few slope-climbing verts', () => {
  // Most samples are the lake surface; a handful land on the shore slope.
  // The level must stay at the surface, not get dragged up by the outliers.
  assert.equal(waterLevelOf([2.0, 2.01, 1.99, 2.0, 2.0, 5.5, 6.2]), 2.0)
})

test('waterLevelOf: an even count interpolates its middle pair', () => {
  assert.equal(waterLevelOf([1, 2, 3, 4]), 2.5)
})

test('waterLevelOf: does not mutate its input', () => {
  const heights = [3, 1, 2]
  waterLevelOf(heights)
  assert.deepEqual(heights, [3, 1, 2], 'sorting a caller array in place is a booby trap')
})

test('waterLevelOf: degenerate inputs give something sane, never NaN', () => {
  assert.equal(waterLevelOf([7]), 7)
  assert.equal(waterLevelOf([]), 0)
})
