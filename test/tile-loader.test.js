import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWaterTiles, loadWaterTileManifest, loadLakeTiles, loadLakeTileManifest, hasTilesForLod, _clearCache } from '../src/map/tile-loader.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
const feat = (id, coords = [[6, 45], [6.1, 45], [6.1, 45.1], [6, 45.1], [6, 45]]) => ({
  type: 'Feature',
  properties: { id, name: 'x', subtype: 'lake', class: null },
  geometry: { type: 'Polygon', coordinates: [coords] },
})

// Installs a fake fetch that serves `routes` (key `z/x/y` -> FeatureCollection
// or null for a 404) and records every URL requested. Matches either
// water-tiles/ or lake-tiles/ (any `<kind>-tiles/z/x/y.json` path) so the
// same helper covers both tile sets.
function fakeFetch(routes) {
  const calls = []
  global.fetch = (url) => {
    calls.push(url)
    const m = url.match(/-tiles\/(\d+\/\d+\/\d+)\.json/)
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

// --- world lake tiles (task 19): same loadTiles/loadManifest contract as
// water, own cache under public/data/lake-tiles/. Unlike water tiles this
// kind has no region gate in the client (WaterLayer decides when to reach for
// it, tile-loader.js itself is region-agnostic for every kind).
//
// Il y avait ici une troisième source, `road-tiles`, partie avec le calque
// Routes. Aucune tuile routière n'a jamais été versionnée : rien à nettoyer
// côté données, et le chargeur ne va donc plus chercher un dossier absent.

test('loadLakeTiles: fetches from lake-tiles/, not water-tiles/, and merges features', () => {
  _clearCache()
  const calls = fakeFetch({
    '2/2/1': fc([feat('l1')]),
    '2/3/1': fc([feat('l2')]),
  })
  return loadLakeTiles({ minLon: 80, maxLon: 100, minLat: 10, maxLat: 20 }, 2).then((result) => {
    const ids = result.features.map((f) => f.properties.id).sort()
    assert.deepEqual(ids, ['l1', 'l2'])
    assert.ok(calls.every((u) => /lake-tiles\//.test(u)), `expected only lake-tiles/ URLs, got ${JSON.stringify(calls)}`)
  })
})

test('loadLakeTiles keeps a separate cache from water tiles — same z/x/y key does not collide', async () => {
  _clearCache()
  const lakeFeat = feat('only-in-lakes')
  const waterFeat = feat('only-in-water')
  global.fetch = (url) => {
    if (url.includes('lake-tiles')) return Promise.resolve({ ok: true, json: () => Promise.resolve(fc([lakeFeat])) })
    if (url.includes('water-tiles')) return Promise.resolve({ ok: true, json: () => Promise.resolve(fc([waterFeat])) })
    return Promise.resolve({ ok: false })
  }
  const bbox = { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 }
  const lakeResult = await loadLakeTiles(bbox, 5)
  const waterResult = await loadWaterTiles(bbox, 5)
  assert.deepEqual(lakeResult.features.map((f) => f.properties.id), ['only-in-lakes'])
  assert.deepEqual(waterResult.features.map((f) => f.properties.id), ['only-in-water'])
})

test('loadLakeTiles: a missing tile (404) contributes nothing, not an error — most of the planet is not lake', async () => {
  _clearCache()
  fakeFetch({ '2/2/1': fc([feat('a')]) }) // '2/3/1' absent -> ok:false
  const result = await loadLakeTiles({ minLon: 80, maxLon: 100, minLat: 10, maxLat: 20 }, 2)
  assert.deepEqual(result.features.map((f) => f.properties.id), ['a'])
})

test('loadLakeTileManifest: fetches from lake-tiles/index.json, caches, never throws on failure', async () => {
  _clearCache()
  const calls = []
  global.fetch = (url) => { calls.push(url); return Promise.resolve({ ok: false }) }
  assert.equal(await loadLakeTileManifest(), null)
  assert.ok(calls[0].includes('lake-tiles/index.json'), calls[0])
  _clearCache()
  global.fetch = () => Promise.reject(new Error('down'))
  await assert.doesNotReject(loadLakeTileManifest())
})

test('hasTilesForLod: true only when the manifest lists a nonzero tile count for that LOD', () => {
  const manifest = { lods: [{ lod: 0, tiles: 12 }, { lod: 1, tiles: 0 }] }
  assert.equal(hasTilesForLod(manifest, 0), true)
  assert.equal(hasTilesForLod(manifest, 1), false) // present but empty
  assert.equal(hasTilesForLod(manifest, 2), false) // not present at all
  assert.equal(hasTilesForLod(null, 0), false) // missing manifest
})
