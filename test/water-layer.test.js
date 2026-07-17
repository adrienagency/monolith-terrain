import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterRiverwayLines } from '../src/map/water-layer.js'

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
