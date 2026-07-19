import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aerialCovers, aerialUvTransform, lonLatToMerc } from '../src/map/aerial-layer.js'

test('aerialCovers: an Annecy patch is covered', () => {
  assert.equal(aerialCovers({ minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }), true)
})

test('aerialCovers: elsewhere is not — this is a single-area test layer', () => {
  assert.equal(aerialCovers({ minLon: 7.7, maxLon: 7.9, minLat: 46.0, maxLat: 46.2 }), false) // Valais
  assert.equal(aerialCovers({ minLon: 2.2, maxLon: 2.5, minLat: 48.8, maxLat: 48.9 }), false) // Paris
  assert.equal(aerialCovers(null), false)
})

test('aerialCovers: judged on the CENTRE, not on overlap', () => {
  // a huge patch whose centre sits far away must NOT count as covered just
  // because one corner clips the box — the user looks at the middle
  assert.equal(aerialCovers({ minLon: 6.4, maxLon: 12.0, minLat: 46.0, maxLat: 50.0 }), false)
})

test('lonLatToMerc: the origin and the equator land where Mercator says', () => {
  const o = lonLatToMerc(-180, 0)
  assert.ok(Math.abs(o.x - 0) < 1e-9)
  assert.ok(Math.abs(o.y - 0.5) < 1e-9, 'the equator is halfway down the world')
  const m = lonLatToMerc(0, 0)
  assert.ok(Math.abs(m.x - 0.5) < 1e-9)
})

test('aerialUvTransform: a patch filling the grid exactly maps to the full texture', () => {
  const patch = { minLon: -10, maxLon: 10, minLat: -5, maxLat: 5 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const t = aerialUvTransform(patch, { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y })
  assert.ok(Math.abs(t.offset[0]) < 1e-9 && Math.abs(t.offset[1]) < 1e-9)
  assert.ok(Math.abs(t.scale[0] - 1) < 1e-9 && Math.abs(t.scale[1] - 1) < 1e-9)
})

test('aerialUvTransform: a patch inside a bigger grid gets a real inset', () => {
  // The regression that matters: the tile grid ALWAYS overhangs the patch, and
  // stretching the whole mosaic across the block would slide the photo off the
  // terrain by up to a tile — roads landing in fields.
  const patch = { minLon: 6.0, maxLon: 6.2, minLat: 45.8, maxLat: 45.95 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const pad = (b.x - a.x) * 0.5
  const grid = { minX: a.x - pad, maxX: b.x + pad, minY: a.y - pad, maxY: b.y + pad }
  const t = aerialUvTransform(patch, grid)
  assert.ok(t.offset[0] > 0 && t.offset[0] < 1, `offset.x ${t.offset[0]} must be a real inset`)
  assert.ok(t.scale[0] > 0 && t.scale[0] < 1, `scale.x ${t.scale[0]} must shrink into the grid`)
  // and the patch must land wholly inside the texture, not run off its edge
  assert.ok(t.offset[0] + t.scale[0] <= 1 + 1e-9)
  assert.ok(t.offset[1] + t.scale[1] <= 1 + 1e-9)
})

test('aerialUvTransform: latitude is handled in mercator, not linearly', () => {
  // A tall patch far from the equator: doing this in raw lat/lon would give a
  // different (skewed) vertical scale. Guard that we did NOT do that.
  const patch = { minLon: 0, maxLon: 1, minLat: 60, maxLat: 62 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const grid = { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y }
  const t = aerialUvTransform(patch, grid)
  const naiveRatio = (patch.maxLat - patch.minLat) / (patch.maxLon - patch.minLon)
  const mercRatio = (b.y - a.y) / (b.x - a.x)
  assert.ok(Math.abs(mercRatio - naiveRatio) > 0.5, 'mercator and linear must differ here, else the test proves nothing')
  assert.ok(Math.abs(t.scale[1] - 1) < 1e-9, 'the mercator-derived transform still fills its own grid exactly')
})
