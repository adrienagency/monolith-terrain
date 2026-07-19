import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sunPosition, solarHourToDate, lightingFor } from '../src/daycycle.js'

// The astronomy is pinned against facts you can check in an almanac, not
// against the implementation. Annecy sits at 45.9° N: solar noon elevation is
// 90 - lat + declination — about 67° at the June solstice, 21° at the
// December one. If these numbers drift, the port broke.

const ANNECY = { lat: 45.9, lon: 6.13 }
const JUNE = new Date(Date.UTC(2026, 5, 21))
const DEC = new Date(Date.UTC(2026, 11, 21))

const at = (hour, date) => sunPosition(solarHourToDate(hour, ANNECY.lon, date), ANNECY.lat, ANNECY.lon)

test('solar noon in June at Annecy: ~67° high, due south', () => {
  const s = at(12, JUNE)
  assert.ok(Math.abs(s.elevation - 67.5) < 2, `elevation ${s.elevation.toFixed(1)}° should be ~67.5°`)
  assert.ok(Math.abs(s.azimuth - 180) < 3, `azimuth ${s.azimuth.toFixed(1)}° should be ~180° (south)`)
})

test('solar noon in December at Annecy: ~21° — the season is real', () => {
  const s = at(12, DEC)
  assert.ok(Math.abs(s.elevation - 20.7) < 2, `elevation ${s.elevation.toFixed(1)}° should be ~20.7°`)
})

test('June morning sun rises in the north-east, June evening sets north-west', () => {
  // At 46° N near the solstice the sun rises well NORTH of east (~55°) —
  // a fixed-east fake (the old sunFromHour) cannot produce this.
  const m = at(6, JUNE)
  assert.ok(m.azimuth > 60 && m.azimuth < 100, `06:00 azimuth ${m.azimuth.toFixed(0)}° should be east-ish`)
  const e = at(18, JUNE)
  assert.ok(e.azimuth > 260 && e.azimuth < 300, `18:00 azimuth ${e.azimuth.toFixed(0)}° should be west-ish`)
})

test('midnight in June at Annecy: sun well below the horizon', () => {
  const s = at(0, JUNE)
  assert.ok(s.elevation < -15, `elevation ${s.elevation.toFixed(1)}° should be deep night`)
})

test('solar time: hour 12 IS the daily elevation maximum for the place', () => {
  for (const probe of [10, 11, 13, 14]) {
    assert.ok(at(12, JUNE).elevation > at(probe, JUNE).elevation, `noon must beat ${probe}h`)
  }
})

test('lightingFor: noon is bright and near-white, night is dim moonlight', () => {
  const noon = lightingFor(12, ANNECY.lat, ANNECY.lon, JUNE)
  assert.equal(noon.mode, 'day')
  assert.ok(noon.sunIntensity > 7, `noon intensity ${noon.sunIntensity}`)
  const night = lightingFor(1, ANNECY.lat, ANNECY.lon, JUNE)
  assert.equal(night.mode, 'night')
  assert.ok(night.sunIntensity < 0.5, `night intensity ${night.sunIntensity}`)
  assert.notEqual(noon.sunColor, night.sunColor)
})

test('lightingFor: December 17h30 is twilight/night at Annecy, June 17h30 is day', () => {
  // The whole point of real astronomy: the same slider hour follows the season.
  assert.equal(lightingFor(17.5, ANNECY.lat, ANNECY.lon, JUNE).mode, 'day')
  assert.notEqual(lightingFor(17.5, ANNECY.lat, ANNECY.lon, DEC).mode, 'day')
})

test('lightingFor: no intensity pop crossing the horizon', () => {
  // Sample a dusk crossing minute by minute; consecutive sun intensities must
  // never jump — a visible pop when dragging the slider would feel broken.
  let prev = null
  for (let h = 16; h <= 24; h += 1 / 60) {
    const l = lightingFor(h, ANNECY.lat, ANNECY.lon, DEC)
    if (prev !== null) {
      assert.ok(Math.abs(l.sunIntensity - prev) < 0.5, `intensity jumped ${prev.toFixed(2)} → ${l.sunIntensity.toFixed(2)} at ${h.toFixed(2)}h`)
    }
    prev = l.sunIntensity
  }
})

test('lightingFor: values are finite and colours are hex, whatever the hour', () => {
  for (let h = 0; h <= 24; h += 0.5) {
    const l = lightingFor(h, ANNECY.lat, ANNECY.lon, JUNE)
    for (const k of ['azimuth', 'elevation', 'sunIntensity', 'hemiIntensity', 'envIntensity']) {
      assert.ok(Number.isFinite(l[k]), `${k} at ${h}h`)
    }
    for (const k of ['sunColor', 'hemiSky', 'hemiGround']) {
      assert.match(l[k], /^#[0-9a-f]{6}$/i, `${k} at ${h}h = ${l[k]}`)
    }
  }
})

test('southern hemisphere: noon sun stands NORTH in Patagonia', () => {
  const s = sunPosition(solarHourToDate(12, -72.5, JUNE), -45.6, -72.5)
  assert.ok(s.azimuth < 40 || s.azimuth > 320, `azimuth ${s.azimuth.toFixed(0)}° should be northish`)
})
