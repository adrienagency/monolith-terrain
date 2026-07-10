import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLakes } from '../src/lake.js'

// synthetic DEM: rugged slope everywhere, with hand-placed flats
function makeDem(size, fill) {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = fill(x, y)
  return { data, size }
}

// rugged land: every cell differs from its neighbours by ≥3 m
const rugged = (x, y) => 100 + x * 3 + y * 5 + ((x * 7 + y * 13) % 4)

test('a flat plateau above sea level is detected as one lake at its elevation', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? 500 : rugged(x, y)))
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].elevM, 500)
  assert.equal(lakes[0].cells.length, 400) // 20×20 flat cells
})

test('flat regions at or below sea level belong to the sea block, not the lakes', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x < 32 ? -5 : rugged(x, y))) // half the map is sea floor
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('puddles under the minimum area are ignored', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x >= 5 && x < 8 && y >= 5 && y < 8 ? 300 : rugged(x, y)))
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0) // 3×3 = 9 cells < 50
})

test('two separate plateaus at different elevations come back as two lakes', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => {
    if (x >= 4 && x < 20 && y >= 4 && y < 20) return 800
    if (x >= 40 && x < 60 && y >= 40 && y < 60) return 350
    return rugged(x, y)
  })
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 2)
  const elevs = lakes.map((l) => l.elevM).sort((a, b) => a - b)
  assert.deepEqual(elevs, [350, 800])
})

test('tolerance groups near-level water cells without swallowing the shore', () => {
  const size = 64
  // lake surface ripples ±0.1 m (tile resampling) — inside the default tolerance
  const dem = makeDem(size, (x, y) =>
    x >= 10 && x < 40 && y >= 10 && y < 40 ? 420 + 0.1 * Math.sin(x + y) : rugged(x, y)
  )
  const lakes = detectLakes(dem)
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].cells.length, 900)
})

test('a contour band on a smooth slope is rejected — lakes are blobs, not strips', () => {
  const size = 64
  // gentle uniform slope: 0.3 m per cell along x → any seed's ±tol level set
  // is a thin vertical strip, large in area but never lake-shaped
  const dem = makeDem(size, (x) => 200 + x * 0.3)
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('an elongated water-flat ribbon is accepted — real lakes can be long (Annecy)', () => {
  const size = 64
  // 44×5 cells, perfectly flat at 446.7 m (a mountain ribbon lake): the old
  // thinness check killed it, the flatness rule must keep it
  const dem = makeDem(size, (x, y) => (x >= 10 && x < 54 && y >= 20 && y < 25 ? 446.5 : rugged(x, y)))
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].elevM, 446.5)
  assert.equal(lakes[0].cells.length, 44 * 5)
})

test('an elongated band WITH internal spread is still rejected as a contour band', () => {
  const size = 64
  // same ribbon footprint but tilted 0.2 m per row across its narrow side:
  // no real water surface tilts like that. The tolerance splits it into thin
  // strips with ~0.2 m spread each — not flat, not blob-shaped, all rejected
  const dem = makeDem(size, (x, y) =>
    x >= 10 && x < 54 && y >= 20 && y < 25 ? 300 + (y - 20) * 0.2 : rugged(x, y)
  )
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('a crescent lake with resampling wobble on its fringe is accepted (Leman)', () => {
  const size = 64
  // a curved lake: low bounding-box fill, and a fringe of cells wobbled by
  // tile resampling across the full flood tolerance — the spread test fails,
  // the dominant-value (mode) test must still recognise water
  const inCrescent = (x, y) => {
    const dx = x - 32
    const dy = y - 44
    const r = Math.hypot(dx, dy)
    return r > 14 && r < 22 && dy < -4 // an arc band, ~330 cells
  }
  let fringe = 0
  const dem = makeDem(size, (x, y) => {
    if (!inCrescent(x, y)) return rugged(x, y)
    // every 5th lake cell wobbles up to +-0.3 m (shoreline resampling)
    fringe++
    return fringe % 5 === 0 ? 371 + (fringe % 2 ? 0.3 : -0.3) : 371
  })
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.ok(Math.abs(lakes[0].elevM - 371) <= 0.3)
})
