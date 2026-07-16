import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWaterTiles, loadWaterTileManifest, hasTilesForLod, _clearCache } from '../src/map/tile-loader.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
const feat = (id, coords = [[6, 45], [6.1, 45], [6.1, 45.1], [6, 45.1], [6, 45]]) => ({
  type: 'Feature',
  properties: { id, name: 'x', subtype: 'lake', class: null },
  geometry: { type: 'Polygon', coordinates: [coords] },
})

// Installs a fake fetch that serves `routes` (key `z/x/y` -> FeatureCollection
// or null for a 404) and records every URL requested.
function fakeFetch(routes) {
  const calls = []
  global.fetch = (url) => {
    calls.push(url)
    const m = url.match(/water-tiles\/(\d+\/\d+\/\d+)\.json/)
    const key = m[1]
    const body = routes[key]
    if (body === undefined || body === null) return Promise.resolve({ ok: false })
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }
  return calls
}

test('loadWaterTiles: fetches every tile covering the bbox and merges features', async () => {
  _clearCache()
  fakeFetch({
    '2/2/1': fc([feat('a')]),
    '2/3/1': fc([feat('b')]),
  })
  // z2 tile x=2 covers lon[0,90), x=3 covers [90,180) — bbox straddles that boundary
  const result = await loadWaterTiles({ minLon: 80, maxLon: 100, minLat: 10, maxLat: 20 }, 2)
  const ids = result.features.map((f) => f.properties.id).sort()
  assert.deepEqual(ids, ['a', 'b'])
})

test('loadWaterTiles: a missing tile (404) contributes nothing, not an error', async () => {
  _clearCache()
  fakeFetch({ '2/2/1': fc([feat('a')]) }) // '2/3/1' absent -> ok:false
  const result = await loadWaterTiles({ minLon: 80, maxLon: 100, minLat: 10, maxLat: 20 }, 2)
  assert.deepEqual(result.features.map((f) => f.properties.id), ['a'])
})

test('loadWaterTiles: a rejected fetch is swallowed, never throws', async () => {
  _clearCache()
  global.fetch = () => Promise.reject(new Error('network down'))
  await assert.doesNotReject(loadWaterTiles({ minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 }, 5))
})

test('loadWaterTiles: a feature duplicated across two tiles is deduped by id', async () => {
  _clearCache()
  const shared = feat('shared')
  fakeFetch({
    '2/2/1': fc([shared, feat('a')]),
    '2/3/1': fc([shared, feat('b')]),
  })
  const result = await loadWaterTiles({ minLon: 80, maxLon: 100, minLat: 10, maxLat: 20 }, 2)
  const ids = result.features.map((f) => f.properties.id).sort()
  assert.deepEqual(ids, ['a', 'b', 'shared'])
})

test('loadWaterTiles: caches per z/x/y — a second overlapping call does not re-fetch', async () => {
  _clearCache()
  const calls = fakeFetch({ '5/16/16': fc([feat('a')]) })
  await loadWaterTiles({ minLon: -1, maxLon: 1, minLat: -1, maxLat: 1 }, 5)
  const callsAfterFirst = calls.length
  await loadWaterTiles({ minLon: -1, maxLon: 1, minLat: -1, maxLat: 1 }, 5)
  assert.equal(calls.length, callsAfterFirst, 'second call should be served from cache')
})

test('loadWaterTileManifest: fetches and caches the manifest, never throws on failure', async () => {
  _clearCache()
  global.fetch = () => Promise.resolve({ ok: false })
  assert.equal(await loadWaterTileManifest(), null)
  _clearCache()
  global.fetch = () => Promise.reject(new Error('down'))
  await assert.doesNotReject(loadWaterTileManifest())
})

test('hasTilesForLod: true only when the manifest lists a nonzero tile count for that LOD', () => {
  const manifest = { lods: [{ lod: 0, tiles: 12 }, { lod: 1, tiles: 0 }] }
  assert.equal(hasTilesForLod(manifest, 0), true)
  assert.equal(hasTilesForLod(manifest, 1), false) // present but empty
  assert.equal(hasTilesForLod(manifest, 2), false) // not present at all
  assert.equal(hasTilesForLod(null, 0), false) // missing manifest
})
