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
//
// v39: the COLOUR ramps come from the shared ocean-waves lib (sunLook) — the
// same palette that drives the ocean-lab simulator, so terrain, sea, clouds
// and the demo all read the same golden dusk and blue night. The solar
// GEOMETRY (sunPosition, light placement, dark-mode Schmitt trigger) is
// untouched. Direct import of sunlook.js: pure maths, no three dependency.

import { sunLook, toHex } from './vendor/ocean-waves/sunlook.js'

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

// the sun/sky colour tables moved to the shared sunLook palette (vendor
// ocean-waves) — only the hemisphere GROUND ramp stays local
const GROUND_DAY = '#4a3a2a'
const GROUND_NIGHT = '#12141c'

// The elevation the LIGHT is placed at, given the sun's true elevation.
//
// Above the horizon it is simply the sun. Below, the light lifts smoothly to a
// high, soft "moon" instead of following the sun underground — but it lifts
// CONTINUOUSLY, and it keeps the sun's own bearing. The previous version put
// the moon at the antipode and switched to it at the nautical boundary, which
// spun the light 179 degrees in a single step ("l'éclairage change de sens",
// measured at 3.9h and 20.4h). Nothing here may branch on a threshold.
export function lightElevationFor(el) {
  if (el >= 2) return el
  const t = clamp01((2 - el) / 20) // 0 at +2 deg, 1 at -18 deg
  return 2 + t * 38
}

// hour + place → every number the light rig needs. `date` defaults to today:
// the cycle follows the real season (a December 17 h in Annecy is night; a
// June 17 h is broad day) — that's a feature, not drift.
//
// EVERY value below is a continuous function of the sun's true elevation.
// There are no mode branches any more: `mode` is reported for callers that
// want to know where they are (dark mode keys off it), but nothing in the
// numbers steps when it changes.
export function lightingFor(hour, latDeg, lonDeg, date = new Date()) {
  const when = solarHourToDate(hour, lonDeg, date)
  const sun = sunPosition(when, latDeg, lonDeg)
  const el = sun.elevation

  const day = clamp01(el / 35) // 0 at the horizon, 1 once well up
  const civil = clamp01(1 + el / 6) // 1 at the horizon, 0 at -6 deg
  const naut = clamp01(1 + (el + 6) / 6) // 1 at -6 deg, 0 at -12 deg

  // COLOURS from the shared ocean-lab palette (sunLook) — golden dusk, blue
  // night, continuous sun→moon blend. Intensities keep the curves below,
  // tuned against this scene's ACES exposure.
  const look = sunLook(el)

  // Intensity: the day arc runs down to 0.8 at the horizon, then CROSS-FADES
  // to moonlight over civil twilight — 0.8 at the horizon, 0.22 by -6 deg,
  // flat after. Fading twilight out and moonlight in on different bands (my
  // first attempt) left a dip to near-black at exactly -6 deg, darker than
  // deep night; one shared weight cannot dip.
  const sunIntensity = el > 0 ? 0.8 + 3.0 * day : 0.8 * civil + 0.22 * (1 - civil)

  const mode = el > 0 ? 'day' : el > -6 ? 'twilight' : 'night'

  return {
    mode,
    azimuth: sun.azimuth, // always the sun's own bearing — it never flips
    elevation: lightElevationFor(el), // where the LIGHT is placed
    sunElevation: el, // where the SUN actually is: the honest answer to 'is it night here'
    sunColor: toHex(look.lightChroma),
    sunIntensity,
    hemiSky: toHex(look.skyTint),
    hemiGround: mix(GROUND_NIGHT, GROUND_DAY, el > 0 ? 1 : civil),
    hemiIntensity: el > 0 ? 0.32 + 0.5 * day : 0.2 + 0.02 * naut + 0.1 * civil,
    envIntensity: el > 0 ? 0.14 + 0.26 * day : 0.09 + 0.01 * naut + 0.04 * civil,
    // facteurs partagés pour l'océan et les nuages (0 nuit → 1 jour, etc.)
    dayLight: look.dayLight,
    dusk: look.dusk,
    caustStr: look.caustStr,
  }
}

// Should the UI be in dark mode at this solar elevation?
//
// A SCHMITT TRIGGER, not a threshold: `currentlyDark` widens whichever way we
// are already going. Dragging the 24 h slider across a bare threshold would
// flip the theme back and forth on every frame, and setDarkMode is expensive
// (it rebuilds the background, the contours and the grid). The band also
// matches how dusk actually reads — it goes dark once the sun is properly
// down (-3 deg), and comes back only once it is properly up again (0 deg).
export function darkModeFor(elevationDeg, currentlyDark = false) {
  return currentlyDark ? elevationDeg < 0 : elevationDeg < -3
}
