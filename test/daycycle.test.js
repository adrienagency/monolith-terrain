import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sunPosition, solarHourToDate, lightingFor, darkModeFor } from '../src/daycycle.js'

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
  // Bounded on BOTH sides on purpose. The upper bound is the regression that
  // was actually reported ("le soleil est beaucoup trop puissant"): a summer
  // noon used to reach 8.4, which drove lit slopes past the ACES shoulder and
  // flattened them to white.
  assert.ok(noon.sunIntensity > 2.5, `noon too dim: ${noon.sunIntensity}`)
  assert.ok(noon.sunIntensity < 4.5, `noon too hot: ${noon.sunIntensity}`)
  const night = lightingFor(1, ANNECY.lat, ANNECY.lon, JUNE)
  assert.equal(night.mode, 'night')
  assert.ok(night.sunIntensity < 0.35, `night intensity ${night.sunIntensity}`)
  assert.ok(noon.sunIntensity / night.sunIntensity > 10, 'day must still read as day against night')
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

// --- the light must never jerk -------------------------------------------------
// Reported: "il y a un bug entre 3.9h et 4.1h ou l'éclairage change de sens,
// pareil entre 20h et 20.3h". Cause: the night branch swapped the sun for a
// moon OPPOSITE it, so the azimuth flipped ~180° in one step at the nautical
// boundary (measured 230.7° → 51.8°), and the elevation jumped 35° → 2°.
// A direction test catches both at once, and any future branch boundary too.

const dirOf = (l) => {
  const az = (l.azimuth * Math.PI) / 180
  const el = (l.elevation * Math.PI) / 180
  return [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]
}
const angleBetween = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

test('the sun direction never jumps, minute by minute, all day', () => {
  for (const date of [JUNE, DEC]) {
    let prev = null
    for (let h = 0; h <= 24; h += 1 / 60) {
      const dir = dirOf(lightingFor(h, ANNECY.lat, ANNECY.lon, date))
      if (prev) {
        const jump = angleBetween(prev, dir)
        assert.ok(jump < 3, `direction jumped ${jump.toFixed(1)}° at ${h.toFixed(2)}h`)
      }
      prev = dir
    }
  }
})

test('the reported hours specifically: no reversal at 3.9-4.1h or 20-20.3h', () => {
  for (const [from, to] of [[3.7, 4.3], [19.8, 20.6]]) {
    let prev = null
    for (let h = from; h <= to; h += 1 / 120) {
      const l = lightingFor(h, ANNECY.lat, ANNECY.lon)
      const dir = dirOf(l)
      if (prev) assert.ok(angleBetween(prev, dir) < 3, `reversal at ${h.toFixed(2)}h`)
      prev = dir
    }
  }
})

test('intensity is continuous too — tightly', () => {
  // The old tolerance (0.5) was loose enough to let the real 0.22 -> 0.045
  // step through. A minute of real time cannot change the light that much.
  for (const date of [JUNE, DEC]) {
    let prev = null
    for (let h = 0; h <= 24; h += 1 / 60) {
      const i = lightingFor(h, ANNECY.lat, ANNECY.lon, date).sunIntensity
      if (prev !== null) assert.ok(Math.abs(i - prev) < 0.05, `intensity jumped ${prev.toFixed(3)} → ${i.toFixed(3)} at ${h.toFixed(2)}h`)
      prev = i
    }
  }
})

test('night still reads as night and day as day, after the smoothing', () => {
  // Continuity must not be bought by flattening the cycle into mush.
  const noon = lightingFor(12, ANNECY.lat, ANNECY.lon, JUNE)
  const deep = lightingFor(1, ANNECY.lat, ANNECY.lon, JUNE)
  assert.ok(noon.sunIntensity / deep.sunIntensity > 10)
  assert.ok(noon.elevation > 60 && deep.elevation > 0, 'the night light still comes from above ground')
})

test('dusk dims monotonically — no dip darker than deep night', () => {
  // First fix attempt faded twilight out and moonlight in over DIFFERENT
  // elevation bands, which crossed at zero: the scene went momentarily blacker
  // than midnight as the slider passed -6°. Continuity alone did not catch it.
  const deepNight = lightingFor(1, ANNECY.lat, ANNECY.lon, JUNE).sunIntensity
  for (let h = 19; h <= 23; h += 1 / 60) {
    const i = lightingFor(h, ANNECY.lat, ANNECY.lon, JUNE).sunIntensity
    assert.ok(i >= deepNight - 1e-9, `dipped to ${i.toFixed(3)} below deep night ${deepNight.toFixed(3)} at ${h.toFixed(2)}h`)
  }
})

// --- automatic dark mode ------------------------------------------------------

test('darkModeFor: day is light, deep night is dark', () => {
  assert.equal(darkModeFor(45, false), false)
  assert.equal(darkModeFor(45, true), false, 'a high sun always returns to light')
  assert.equal(darkModeFor(-20, false), true)
  assert.equal(darkModeFor(-20, true), true)
})

test('darkModeFor: hysteresis — the boundary does not flap', () => {
  // Between -3 and 0 the answer depends on where you came FROM. Without this,
  // dragging the slider across a bare threshold would toggle the theme every
  // frame, and setDarkMode rebuilds background, contours and grid each time.
  assert.equal(darkModeFor(-1.5, false), false, 'still light on the way down')
  assert.equal(darkModeFor(-1.5, true), true, 'still dark on the way up')
})

test('darkModeFor: sweeping down then up never flips more than once each way', () => {
  let dark = false, flips = 0
  for (let el = 60; el >= -30; el -= 0.1) {
    const d = darkModeFor(el, dark)
    if (d !== dark) flips++
    dark = d
  }
  for (let el = -30; el <= 60; el += 0.1) {
    const d = darkModeFor(el, dark)
    if (d !== dark) flips++
    dark = d
  }
  assert.equal(flips, 2, `expected one flip each way, got ${flips}`)
})

test('lightingFor reports the SUN elevation separately from the LIGHT elevation', () => {
  // At night the light is lifted above ground (a moon overhead) while the sun
  // is far below it. Confusing the two would make midnight test as daylight.
  const night = lightingFor(1, ANNECY.lat, ANNECY.lon, JUNE)
  assert.ok(night.elevation > 0, 'the light shines from above ground')
  assert.ok(night.sunElevation < -12, 'the sun is genuinely down')
  const noon = lightingFor(12, ANNECY.lat, ANNECY.lon, JUNE)
  assert.equal(noon.elevation, noon.sunElevation, 'by day they are the same thing')
})
