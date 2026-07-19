import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aerialCovers, aerialUnavailable, aerialUvTransform, aerialZoomFor, lonLatToMerc, SUPERSEDED, providerFor, pointInPolygon, PROVIDERS } from '../src/map/aerial-layer.js'
import { tilesForBBox } from '../src/map/tile-index.js'

test('aerialCovers: an Annecy patch is covered', () => {
  assert.equal(aerialCovers({ minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }), true)
})

test('aerialCovers: covered where a provider exists, not elsewhere', () => {
  // Valais and Paris were UNcovered when this layer was Annecy-only; both are
  // served now, by different countries. Munich still is not.
  assert.equal(aerialCovers({ minLon: 7.7, maxLon: 7.9, minLat: 46.0, maxLat: 46.2 }), true) // Valais, CH
  assert.equal(aerialCovers({ minLon: 2.2, maxLon: 2.5, minLat: 48.8, maxLat: 48.9 }), true) // Paris, FR
  assert.equal(aerialCovers({ minLon: 11.5, maxLon: 11.7, minLat: 48.1, maxLat: 48.2 }), false) // Munich
  assert.equal(aerialCovers(null), false)
})

test('aerialCovers: judged on the CENTRE, not on overlap', () => {
  // a huge patch whose centre sits far away must NOT count as covered just
  // because one corner clips covered ground — the user looks at the middle
  assert.equal(aerialCovers({ minLon: 8.0, maxLon: 16.0, minLat: 47.0, maxLat: 52.0 }), false) // centre in Germany
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
  const msg = aerialUnavailable({ minLon: 11.5, maxLon: 11.7, minLat: 48.1, maxLat: 48.2 }) // Munich
  assert.equal(typeof msg, 'string')
  assert.ok(msg.length > 0)
  // it must be READABLE, not a code: no ALL-CAPS FUI shouting, no identifier
  assert.ok(!/^[A-Z0-9 _-]+$/.test(msg), `"${msg}" reads as a code, not a sentence`)
  assert.ok(/\s/.test(msg), 'a message the user reads has words in it')
})

test('aerialUnavailable: the message names where imagery DOES exist', () => {
  // A dead end is unhelpful; the user needs to know the layer works somewhere.
  const msg = aerialUnavailable({ minLon: 11.5, maxLon: 11.7, minLat: 48.1, maxLat: 48.2 })
  assert.ok(/France/i.test(msg), `"${msg}" should point at the covered area`)
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

// --- superseded is not failure ------------------------------------------------

test('SUPERSEDED is a distinct sentinel, not a falsy value', () => {
  // The bug: build() returned null BOTH when every tile failed and when a
  // newer build took over. A caller that reacts to failure by warning the user
  // and switching the layer off then fired on every ordinary race — and a race
  // is the NORMAL case, because changing scale triggers two refreshes.
  assert.ok(SUPERSEDED, 'must be truthy, or `if (!built)` swallows it again')
  assert.notEqual(SUPERSEDED, null)
  assert.equal(SUPERSEDED.superseded, true)
})

test('SUPERSEDED is frozen — callers compare identity, not shape', () => {
  assert.ok(Object.isFrozen(SUPERSEDED))
})

// --- two countries, one border ------------------------------------------------
// The reason this is not a pair of rectangles: any bbox around Switzerland also
// contains Chamonix, and any bbox around France also contains the Valais.
// Zermatt and Chamonix sit 40 km apart on opposite sides of that border and are
// both prime trail-race country.

const at = (lon, lat) => ({ minLon: lon - 0.05, maxLon: lon + 0.05, minLat: lat - 0.04, maxLat: lat + 0.04 })

test('providerFor: French places get IGN', () => {
  for (const [name, lon, lat] of [['Annecy', 6.17, 45.9], ['Chamonix', 6.87, 45.92], ['Brest', -4.49, 48.39], ['Nice', 7.27, 43.7], ['Corsica', 9.15, 42.3]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'ign', name)
  }
})

test('providerFor: Swiss places get swisstopo', () => {
  for (const [name, lon, lat] of [['Zermatt', 7.75, 46.02], ['Zurich', 8.54, 47.37], ['Geneva', 6.14, 46.2], ['Verbier', 7.23, 46.1], ['Lugano', 8.95, 46.0]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'swisstopo', name)
  }
})

test('providerFor: Chamonix and Zermatt do NOT share a provider', () => {
  // The single test that a rectangle scheme cannot pass.
  assert.notEqual(providerFor(at(6.87, 45.92)).id, providerFor(at(7.75, 46.02)).id)
})

test('providerFor: elsewhere is not covered at all', () => {
  for (const [name, lon, lat] of [['Munich', 11.58, 48.14], ['Milan', 9.19, 45.46], ['Barcelona', 2.17, 41.39], ['London', -0.13, 51.51]]) {
    assert.equal(providerFor(at(lon, lat)), null, name)
  }
})

test('providerFor: swisstopo is never reached by elimination', () => {
  // It answers 200 OUTSIDE Switzerland instead of 404ing (verified live at
  // Annecy), so a block must only reach it by a positive border test. If this
  // ever regresses, foreign blocks silently render Swiss-server blanks.
  for (const [lon, lat] of [[11.58, 48.14], [9.19, 45.46], [-0.13, 51.51], [2.35, 48.86]]) {
    assert.notEqual(providerFor(at(lon, lat))?.id, 'swisstopo')
  }
})

test('pointInPolygon: a square behaves', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]]
  assert.equal(pointInPolygon(5, 5, sq), true)
  assert.equal(pointInPolygon(15, 5, sq), false)
  assert.equal(pointInPolygon(5, 15, sq), false)
  assert.equal(pointInPolygon(-5, 5, sq), false)
})

test('aerialUnavailable: the message names BOTH countries now', () => {
  const msg = aerialUnavailable(at(11.58, 48.14))
  assert.match(msg, /France/i)
  assert.match(msg, /Switzerland/i)
})

test('every provider carries an attribution — it is a licence obligation', () => {
  for (const p of PROVIDERS) {
    assert.ok(typeof p.attribution === 'string' && p.attribution.length > 3, p.id)
    assert.equal(typeof p.url(14, 100, 100), 'string')
    assert.ok(p.url(14, 100, 100).startsWith('https://'), `${p.id} must be https`)
  }
})

test('providerFor: the French envelope still excludes its neighbours', () => {
  // FR_OUTLINE bulges over Switzerland on purpose (Switzerland matches first),
  // and this is the guard that the bulge does not reach into Italy.
  for (const [name, lon, lat] of [['Milan', 9.19, 45.46], ['Turin', 7.69, 45.07], ['Stuttgart', 9.18, 48.78]]) {
    assert.equal(providerFor(at(lon, lat)), null, name)
  }
})
