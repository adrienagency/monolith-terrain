import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANDMARKS } from '../src/landmarks.js'

test('every landmark has valid coordinates and a DEM-range zoom', () => {
  for (const [continent, places] of Object.entries(LANDMARKS)) {
    assert.ok(places.length >= 12, `${continent}: at least a dozen entries`)
    const seen = new Set()
    for (const p of places) {
      assert.ok(p.name.length >= 2, `${continent}: unnamed entry`) // K2 is a name
      assert.ok(!seen.has(p.name), `${continent}: duplicate ${p.name}`)
      seen.add(p.name)
      assert.ok(Math.abs(p.lat) <= 85, `${p.name}: lat ${p.lat} outside mercator coverage`)
      assert.ok(Math.abs(p.lon) <= 180, `${p.name}: lon ${p.lon}`)
      assert.ok(p.zoom >= 8 && p.zoom <= 14, `${p.name}: zoom ${p.zoom} outside DEM range`)
    }
  }
})

test('the six inhabited continents carry 20 landmarks each', () => {
  for (const c of ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania']) {
    assert.equal(LANDMARKS[c].length, 20, c)
  }
})

test('zoom follows feature size — islands wide, cones tight', () => {
  const get = (c, n) => LANDMARKS[c].find((p) => p.name.includes(n))
  const corsica = get('Europe', 'Corsica')
  const stromboli = get('Europe', 'Stromboli')
  assert.ok(corsica.zoom <= 10, 'a whole island frames wide')
  assert.ok(stromboli.zoom >= 13, 'a single cone frames tight')
  assert.ok(get('South America', 'Uyuni').zoom <= 10, 'a giant salt flat frames wide')
  assert.ok(get('Africa', 'Victoria Falls').zoom >= 13, 'a waterfall frames tight')
})
