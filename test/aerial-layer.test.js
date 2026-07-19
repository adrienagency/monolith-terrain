import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aerialCovers, aerialUnavailable, aerialUvTransform, aerialZoomFor, lonLatToMerc } from '../src/map/aerial-layer.js'
import { tilesForBBox } from '../src/map/tile-index.js'

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

// --- honest failure ---------------------------------------------------------
// Until now, asking for imagery outside the covered area did NOTHING: the
// toggle stayed on, no photo appeared, and nobody was told why. These pin the
// behaviour that replaced it — say what happened, in words, or say nothing.

test('aerialUnavailable: a covered patch reports no problem', () => {
  assert.equal(aerialUnavailable({ minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }), null)
})

test('aerialUnavailable: an uncovered patch explains itself in plain words', () => {
  const msg = aerialUnavailable({ minLon: 2.2, maxLon: 2.5, minLat: 48.8, maxLat: 48.9 }) // Paris
  assert.equal(typeof msg, 'string')
  assert.ok(msg.length > 0)
  // it must be READABLE, not a code: no ALL-CAPS FUI shouting, no identifier
  assert.ok(!/^[A-Z0-9 _-]+$/.test(msg), `"${msg}" reads as a code, not a sentence`)
  assert.ok(/\s/.test(msg), 'a message the user reads has words in it')
})

test('aerialUnavailable: the message names where imagery DOES exist', () => {
  // A dead end is unhelpful; the user needs to know the layer works somewhere.
  const msg = aerialUnavailable({ minLon: 7.7, maxLon: 7.9, minLat: 46.0, maxLat: 46.2 })
  assert.ok(/Annecy/i.test(msg), `"${msg}" should point at the covered area`)
})

test('aerialUnavailable: no patch at all is not a coverage complaint', () => {
  // Nothing loaded yet is not the same as "your area has no photos" — saying
  // the latter during boot would be a lie.
  assert.equal(aerialUnavailable(null), null)
})

// --- the texture budget is a BOUND, not a suggestion --------------------------

test('aerialZoomFor: the mosaic never exceeds the budget', () => {
  // The regression: the old version returned the first zoom to REACH the budget
  // by tile-area, which is the first zoom to overshoot it in pixels. At the
  // finest terrain scale that built a 3072 px canvas against a 2048 px cap.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 } // ~2.5 km, z15-sized
  for (const budget of [1024, 2048, 4096]) {
    const z = aerialZoomFor(patch, { budgetPx: budget })
    const tiles = tilesForBBox(patch, z)
    const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y)
    const px = Math.max(Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1) * 256
    assert.ok(px <= budget, `budget ${budget} → z${z} builds a ${px}px canvas`)
  }
})

test('aerialZoomFor: a bigger budget buys more detail, never less', () => {
  // Guards the bound from being satisfied trivially by always returning z6.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 }
  const small = aerialZoomFor(patch, { budgetPx: 1024 })
  const large = aerialZoomFor(patch, { budgetPx: 4096 })
  assert.ok(large > small, `4096 (z${large}) must beat 1024 (z${small})`)
})

test('aerialZoomFor: a device that only guarantees 2048 is respected', () => {
  // WebGL2 GUARANTEES only 2048. Asking a phone for the desktop's 4096 does not
  // render slowly — it fails outright.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 }
  const z = aerialZoomFor(patch, { budgetPx: 2048 })
  const tiles = tilesForBBox(patch, z)
  const xs = tiles.map((t) => t.x)
  assert.ok((Math.max(...xs) - Math.min(...xs) + 1) * 256 <= 2048)
})
