import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMaskBBoxPx, bboxPxToWorld, superellipseRectContour, PLATE_MARGIN } from '../src/region-plate.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`)

// RGBA buffer for a size² mask with white pixels where fill() says so
function makeMask(size, fill) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = fill(x, y) ? 255 : 0
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  return data
}

test('bbox of white pixels, empty mask is null', () => {
  const size = 64
  const data = makeMask(size, (x, y) => x >= 10 && x <= 40 && y >= 20 && y <= 25)
  assert.deepEqual(computeMaskBBoxPx(data, size), { minX: 10, minY: 20, maxX: 40, maxY: 25 })
  assert.equal(computeMaskBBoxPx(makeMask(size, () => false), size), null)
})

test('bbox ignores sub-threshold grey (blur halo)', () => {
  const size = 32
  const data = makeMask(size, (x, y) => x === 16 && y === 16)
  data[(8 * size + 8) * 4] = 100 // grey speck below the 127 threshold
  assert.deepEqual(computeMaskBBoxPx(data, size), { minX: 16, minY: 16, maxX: 16, maxY: 16 })
})

test('pixel bbox converts to world with margin proportional to the diagonal', () => {
  const size = 2048
  // full-canvas bbox with zero margin = exactly the terrain footprint
  const full = bboxPxToWorld({ minX: 0, minY: 0, maxX: size - 1, maxY: size - 1 }, size, 0)
  close(full.minX, -TERRAIN_SIZE / 2)
  close(full.maxX, TERRAIN_SIZE / 2)
  close(full.width, TERRAIN_SIZE)
  close(full.centerX, 0)
  // quarter-canvas bbox: margin grows every side by margin × diagonal
  const px = { minX: 512, minY: 512, maxX: 1535, maxY: 1535 }
  const noM = bboxPxToWorld(px, size, 0)
  const m = bboxPxToWorld(px, size, PLATE_MARGIN)
  const diag = Math.hypot(noM.width, noM.depth)
  close(m.width, noM.width + 2 * PLATE_MARGIN * diag, 1e-9)
  close(m.centerX, noM.centerX, 1e-9)
  close(m.centerZ, noM.centerZ, 1e-9)
})

test('superellipse rect contour stays inside the bbox and hits the edge midpoints', () => {
  const halfW = 10
  const halfD = 4
  const pts = superellipseRectContour(halfW, halfD, 2, 3, 16)
  let maxX = 0
  let maxZ = 0
  for (const p of pts) {
    assert.ok(Math.abs(p.x) <= halfW + 1e-9 && Math.abs(p.z) <= halfD + 1e-9, 'inside bbox')
    maxX = Math.max(maxX, Math.abs(p.x))
    maxZ = Math.max(maxZ, Math.abs(p.z))
  }
  close(maxX, halfW) // straight edges reach the full extents
  close(maxZ, halfD)
  // zero radius degenerates to the plain rectangle
  assert.equal(superellipseRectContour(halfW, halfD, 0).length, 4)
})

test('corner radius is clamped to the smaller half-extent', () => {
  const pts = superellipseRectContour(10, 1, 50, 2, 8) // absurd radius
  for (const p of pts) {
    assert.ok(Math.abs(p.x) <= 10 + 1e-9 && Math.abs(p.z) <= 1 + 1e-9)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z))
  }
})
