import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapToKm, ascentStats, layoutCartouches, serializeRace, parseRace } from '../src/race-model.js'

test('snapToKm accroche au point le plus proche et clampe', () => {
  const cum = [0, 1, 2.5, 4, 7]
  assert.equal(snapToKm(cum, 2.4), 2)
  assert.equal(snapToKm(cum, 3.4), 3)
  assert.equal(snapToKm(cum, -5), 0)
  assert.equal(snapToKm(cum, 99), 4)
})

test('ascentStats ignore les oscillations sous hystérésis', () => {
  // 0→100 (+100), bruit ±3 ignoré, 100→40 (−60)
  const eles = [0, 50, 100, 103, 100, 97, 100, 40]
  const { dplus, dminus } = ascentStats(eles, { hysteresis: 8 })
  assert.equal(dplus, 100)
  assert.equal(dminus, 60)
})

test('layoutCartouches pousse sans chevaucher, et sait se désactiver', () => {
  const items = [{ y: 10, h: 20 }, { y: 12, h: 20 }, { y: 80, h: 20 }]
  const ys = layoutCartouches(items, { avoid: true, gap: 6 })
  assert.equal(ys[0], 10)
  assert.equal(ys[1], 36) // 10+20+6
  assert.equal(ys[2], 80) // pas touché
  assert.deepEqual(layoutCartouches(items, { avoid: false }), [10, 12, 80])
})

test('serializeRace/parseRace round-trip et rejette le reste', () => {
  const bundle = { race: { name: '90km du Mont-Blanc', logo: null, waypoints: [{ km: 10, name: 'La Darbella', alt: 1210, pictos: ['ravito'], cutoff: '' }], transports: { cats: ['gare'], removed: [] } }, look: { gpxColor: '#ff4d00' }, gpxText: '<gpx></gpx>' }
  const parsed = parseRace(serializeRace(bundle))
  assert.equal(parsed.race.name, '90km du Mont-Blanc')
  assert.equal(parsed.race.waypoints[0].alt, 1210)
  assert.equal(parsed.gpxText, '<gpx></gpx>')
  // alt null ne doit JAMAIS devenir 0 (bug import projet : « 0 m » affiché)
  const nullAlt = parseRace(serializeRace({ race: { name: 'x', logo: null, waypoints: [{ km: 2, name: 'p', alt: null, pictos: [], cutoff: '' }], transports: { cats: [], removed: [] } }, look: {}, gpxText: '' }))
  assert.equal(nullAlt.race.waypoints[0].alt, null)
  assert.equal(parseRace('{"format":"nope"}'), null)
  assert.equal(parseRace('pas du json'), null)
})
