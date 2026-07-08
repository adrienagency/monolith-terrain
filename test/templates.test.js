import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATES } from '../src/templates.js'

const hexToHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === r) h = 60 * (((g - b) / d) % 6)
  else if (max === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  return { h: (h + 360) % 360, s, l }
}
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c)

test('every template is a complete, well-formed bundle', () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    for (const section of ['palette', 'style', 'grid', 'light', 'surface', 'look']) {
      assert.ok(t[section] && typeof t[section] === 'object', `${key}.${section} present`)
    }
    for (const c of [t.palette.gradLow, t.palette.gradMid1, t.palette.gradHigh, t.palette.oceanShallow, t.palette.oceanDeep, t.palette.ink]) {
      assert.ok(isHex(c), `${key}: "${c}" is a valid hex`)
    }
    // sea darkens with depth
    assert.ok(hexToHsl(t.palette.oceanShallow).l > hexToHsl(t.palette.oceanDeep).l, `${key}: sea darkens`)
  }
})

test('ICELAND reproduces the cool bathymetric plate', () => {
  const t = TEMPLATES.iceland
  // summits near-white, coast pale, sea cool blue deepening to navy
  assert.ok(hexToHsl(t.palette.gradHigh).l > 0.95, 'white peaks')
  const deep = hexToHsl(t.palette.oceanDeep)
  assert.ok(deep.h > 195 && deep.h < 240, `deep sea is blue (h=${deep.h.toFixed(0)})`)
  assert.ok(deep.l < 0.35, 'deep sea is dark navy')
  // no engraving furniture — the reference has neither contours nor grid
  assert.equal(t.grid.contourOpacity, 0)
  assert.equal(t.grid.gridOpacity, 0)
  // no warm slope tint on a blue/white world
  assert.equal(t.style.slopeTint, 0)
  // a flat plate: no volumetric clouds, no 3D slab
  assert.equal(t.look.clouds, false)
  assert.equal(t.look.plinth, false)
  // a low raking hillshade sun
  assert.ok(t.light.sunElevation <= 35, 'low sun for crisp relief')
  assert.equal(t.darkMode, false)
  // flattened toward a bathymetric plate (vertical scale pulled down)
  assert.ok(t.terrain && t.terrain.demExaggeration <= 1.1, 'relief flattened')
})
