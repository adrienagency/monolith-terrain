// The 24 h day/night cycle — REAL solar astronomy driving the scene lights.
//
// One slider (hour 0..24) replaces the whole hand-driven light rig. The sun's
// position is not an artistic guess any more: it is computed for the block's
// OWN latitude/longitude with the standard solar-position algorithm, so at
// 18 h over Annecy the light comes from where the sun actually stands over
// Annecy that evening — and a block in Patagonia gets Patagonia's sun.
//
// Open-source research (2026-07): the practical state of the art for a custom
// three.js pipeline is exactly two pieces —
//   * solar position: SunCalc (github.com/mourner/suncalc, MIT), itself the
//     Astronomy Answers / Meeus formulas. The needed ~40 lines are ported
//     below rather than adding a dependency for two functions.
//   * look: colour-temperature ramps keyed on TRUE solar elevation, with the
//     real twilight bands (civil 0..-6°, nautical -6..-12°, night below).
//     This is how the big open-world day cycles are actually built — a true
//     sun path plus tuned ramps — rather than a full spectral atmosphere.
// three.js's Sky (Preetham) remains the natural extension point if the sky
// itself should ever be rendered; the lighting here does not require it.
//
// Everything in this module is PURE (no THREE, no DOM): hour+place in,
// numbers and hex colours out. main.js owns the actual lights.

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
// Julian date helpers (SunCalc): days since J2000.0
const J1970 = 2440588
const J2000 = 2451545
const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000

const OBLIQUITY = 23.4397 * RAD // earth's axial tilt

function solarMeanAnomaly(d) { return (357.5291 + 0.98560028 * d) * RAD }
function eclipticLongitude(M) {
  // equation of centre + perihelion of the Earth
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD
  const P = 102.9372 * RAD
  return M + C + P + Math.PI
}
function declination(L) { return Math.asin(Math.sin(L) * Math.sin(OBLIQUITY)) }
function rightAscension(L) { return Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L)) }
function siderealTime(d, lw) { return (280.16 + 360.9856235 * d) * RAD - lw }

// Sun azimuth/elevation for a moment and a place. Azimuth in COMPASS degrees
// (0 = north, 90 = east, clockwise — what a map reader expects; SunCalc's own
// south-zero convention is converted at the end), elevation in degrees above
// the horizon.
export function sunPosition(date, latDeg, lonDeg) {
  const lw = -lonDeg * RAD
  const phi = latDeg * RAD
  const d = toDays(date)
  const M = solarMeanAnomaly(d)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const ra = rightAscension(L)
  const H = siderealTime(d, lw) - ra // hour angle
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  return {
    azimuth: ((az / RAD) + 180 + 360) % 360, // south-zero → compass north-zero
    elevation: elevation / RAD,
  }
}

// The Date at "solar hour H" for a longitude: hour 12 on the slider = the sun
// at its highest FOR THAT PLACE, whatever the civil timezone says. Solar time
// needs no timezone table, can't be wrong about DST, and matches what the
// slider promises — noon is noon.
export function solarHourToDate(hour, lonDeg, baseDate = new Date()) {
  const dayStartUtc = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate())
  return new Date(dayStartUtc + (hour - lonDeg / 15) * 3_600_000)
}

// --- the look ramps -----------------------------------------------------------
// Keyed on TRUE elevation so the same hour looks right in Lapland and Kenya.
// Hex lerps happen in plain RGB — fine for ramps this gentle.

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rgb2hex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (ha, hb, t) => {
  const a = hex2rgb(ha), b = hex2rgb(hb)
  return rgb2hex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)])
}

// colour temperatures (same family as the old lighting.js table)
const SUN_GOLDEN = '#ffb46b' // low sun
const SUN_WARM = '#ffdcbe'
const SUN_DAY = '#fff4ea' // high sun
const MOON = '#aebfe0'
const SKY_DAY = '#bcd4ff'
const SKY_DUSK = '#ffb08a' // civil twilight glow
const SKY_NAUT = '#2e4370'
const SKY_NIGHT = '#141d33'
const GROUND_DAY = '#4a3a2a'
const GROUND_NIGHT = '#12141c'

// hour + place → every number the light rig needs. `date` defaults to today:
// the cycle follows the real season (a December 17 h in Annecy is night; a
// June 17 h is broad day) — that's a feature, not drift.
export function lightingFor(hour, latDeg, lonDeg, date = new Date()) {
  const when = solarHourToDate(hour, lonDeg, date)
  const sun = sunPosition(when, latDeg, lonDeg)
  const el = sun.elevation

  // day strength: 0 at the horizon, 1 once the sun is 35° up
  const day = clamp01(el / 35)
  // civil twilight 0..-6°, nautical -6..-12°, full night below
  const civil = clamp01(1 + el / 6) // 1 at horizon, 0 at -6°
  const naut = clamp01(1 + (el + 6) / 6) // 1 at -6°, 0 at -12°

  if (el > 0) {
    // ----- day: warmth fades with altitude, intensity rises with it
    const warm = 1 - clamp01(el / 45)
    return {
      mode: 'day',
      azimuth: sun.azimuth,
      elevation: el,
      sunColor: mix(SUN_DAY, SUN_GOLDEN, warm),
      sunIntensity: 1.4 + 7.0 * day,
      hemiSky: mix(SKY_DUSK, SKY_DAY, clamp01(el / 12)),
      hemiGround: GROUND_DAY,
      hemiIntensity: 0.32 + 0.5 * day,
      envIntensity: 0.14 + 0.26 * day,
    }
  }
  if (el > -6) {
    // ----- civil twilight: the sun is set but the sky still carries the scene.
    // The directional light dies out here (continuous with day's 1.4 floor).
    return {
      mode: 'twilight',
      azimuth: sun.azimuth,
      elevation: 2, // grazing fill from where the sun went down
      sunColor: SUN_GOLDEN,
      sunIntensity: 1.4 * civil,
      hemiSky: mix(SKY_NAUT, SKY_DUSK, civil),
      hemiGround: mix(GROUND_NIGHT, GROUND_DAY, civil),
      hemiIntensity: 0.22 + 0.1 * civil,
      envIntensity: 0.1 + 0.04 * civil,
    }
  }
  // ----- night (nautical band eases into it): the directional light becomes
  // the MOON — GTA-style celestial swap, one light plays both bodies. A true
  // lunar ephemeris would add real drama (some nights are moonless); until
  // someone asks, a serene fixed moon opposite the sun keeps every night
  // readable, which for a map is the point.
  return {
    mode: 'night',
    azimuth: (sun.azimuth + 180) % 360,
    elevation: 35,
    sunColor: MOON,
    sunIntensity: 0.32,
    hemiSky: mix(SKY_NIGHT, SKY_NAUT, naut),
    hemiGround: GROUND_NIGHT,
    hemiIntensity: 0.2,
    envIntensity: 0.09,
  }
}
