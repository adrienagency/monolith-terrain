import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCoord, toDMS, formatElevation, trimBlurb, gatherGroundInfo } from '../src/ground-info.js'

test('formatCoord suffixes the right hemispheres', () => {
  assert.equal(formatCoord(45.8326, 6.8652), '45.8326°N  6.8652°E')
  assert.equal(formatCoord(-33.9249, 18.4241), '33.9249°S  18.4241°E')
  assert.equal(formatCoord(63.07, -151.0), '63.0700°N  151.0000°W')
})

test('toDMS converts decimal degrees to d°m′s″ with hemisphere', () => {
  assert.equal(toDMS(45.5, true), '45°30′00″N')
  assert.equal(toDMS(-0.5, false), '0°30′00″W')
})

test('formatElevation reads as a clean range with thousands separators', () => {
  assert.equal(formatElevation(1035, 3305, 2100), 'ELEV  1,035 – 3,305 m  ·  mean 2,100 m')
  assert.equal(formatElevation(-10905, -2598, -6000), 'ELEV  -10,905 – -2,598 m  ·  mean -6,000 m')
})

test('trimBlurb keeps short text whole and cuts long text at a sentence', () => {
  assert.equal(trimBlurb('A short line.'), 'A short line.')
  const long =
    'Denali is the highest mountain peak in North America. Its summit is 6,190 metres above sea level. ' +
    'It is the centerpiece of Denali National Park and Preserve and a very very long tail that keeps going on.'
  const out = trimBlurb(long, 120)
  assert.ok(out.length <= 121, 'trimmed to budget')
  assert.ok(out.endsWith('.') || out.endsWith('…'), 'ends cleanly')
})

test('gatherGroundInfo never throws and always yields coords + a name', async () => {
  // stub fetch so no network is hit; make reverse-geocode fail
  const orig = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
  try {
    const info = await gatherGroundInfo({
      lat: 63.07,
      lon: -151.0,
      dem: { minM: 200, maxM: 6190, meanM: 1500 },
      fetchAnecdote: async () => ({ title: 'Denali', text: 'Highest peak in North America.' }),
    })
    assert.equal(info.coord, '63.0700°N  151.0000°W')
    assert.equal(info.elevation, 'ELEV  200 – 6,190 m  ·  mean 1,500 m')
    assert.equal(info.blurb, 'Highest peak in North America.')
    assert.ok(info.name.length > 0, 'a name is always present (falls back to the title)')
  } finally {
    globalThis.fetch = orig
  }
})
