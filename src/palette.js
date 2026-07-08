// Color-theory palette generation for the Map Overlay panel. The rules the
// palettes obey (and the tests pin down):
//   LIGHT mode — summits warm (reds/oranges/golds), lowlands cool or paper,
//     the 0 m zone NEAR-WHITE most of the time, seas blue with a wide range
//     of tones (three stops), always darker the deeper they get.
//   DARK mode — terrain in blacks and deep browns, summits in vivid
//     opposition (fluo yellow, hot orange), seas near-black in the abyss,
//     ink flipped light so contours stay readable.
// Pure module: no DOM, no three.js — `rng` is injectable for tests.

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

// shortest-path hue interpolation, so orange→blue never detours through green
function mixHue(a, b, t) {
  let d = ((b - a + 540) % 360) - 180
  return a + d * t
}

const NAMES_A = ['ATLAS', 'DUNE', 'SIENNA', 'BASALT', 'TUNDRA', 'MESA', 'FJORD', 'CALDERA', 'STEPPE', 'KARST']
const NAMES_B = ['SURVEY', 'SHEET', 'PLATE', 'CHART', 'RELIEF', 'SECTION', 'QUAD', 'FOLIO']
const NAMES_DARK = ['NOCTURNE', 'UMBRA', 'OBSIDIAN', 'PITCH', 'EMBER', 'CINDER', 'ONYX', 'MIDNIGHT']

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function lightPalette(rng) {
  // summits: warm
  const hHigh = 12 + rng() * 48 // 12–60°
  const gradHigh = hslToHex(hHigh, 48 + rng() * 34, 50 + rng() * 16)

  // the 0 m zone reads near-white most of the time (vintage sheet paper);
  // one time in four it may take a pale cool tint instead
  const paperZero = rng() < 0.75
  const hLow = paperZero ? 40 + rng() * 20 : 155 + rng() * 100
  const gradLow = paperZero
    ? hslToHex(hLow, 3 + rng() * 8, 93 + rng() * 5)
    : hslToHex(hLow, 14 + rng() * 22, 84 + rng() * 9)

  // mids walk the hue from low to high while staying light
  const gradMid1 = hslToHex(mixHue(hLow, hHigh, 0.35), 22 + rng() * 26, 76 + rng() * 10)
  const gradMid2 = hslToHex(mixHue(hLow, hHigh, 0.68), 34 + rng() * 28, 64 + rng() * 12)

  // seas: broad family of blues (azure, teal, petrol, indigo), sometimes
  // very pale — three stops, monotonically darker with depth
  const blueSea = rng() < 0.82
  const hSea = blueSea ? 178 + rng() * 62 : 185 + rng() * 35 // 178–240°
  const sSea = blueSea ? 26 + rng() * 34 : 8 + rng() * 10
  const oceanShallow = hslToHex(hSea + (rng() * 10 - 5), sSea, 84 + rng() * 10)
  const oceanMid = hslToHex(hSea + (rng() * 16 - 8), sSea + rng() * 14, 52 + rng() * 16)
  const oceanDeep = hslToHex(hSea + (rng() * 20 - 10), blueSea ? 34 + rng() * 32 : 14 + rng() * 8, 16 + rng() * 14)

  // ink harmonized with the summit hue, always dark enough to read
  const ink = hslToHex(rng() < 0.5 ? hHigh : rng() * 360, 8 + rng() * 22, 6 + rng() * 12)

  return {
    mode: 'light',
    gradLow,
    gradMid1,
    gradMid2,
    gradHigh,
    gradMid1Pos: 0.2 + rng() * 0.2,
    oceanShallow,
    oceanMid,
    oceanDeep,
    ink,
    name: `${pick(rng, NAMES_A)} ${pick(rng, NAMES_B)}`,
  }
}

function darkPalette(rng) {
  // terrain: blacks and deep browns rising toward the vivid summit color
  const brown = rng() < 0.6
  const hBase = brown ? 16 + rng() * 22 : 210 + rng() * 40 // brown or blue-black
  const gradLow = hslToHex(hBase, brown ? 18 + rng() * 18 : 10 + rng() * 14, 6 + rng() * 6)
  const gradMid1 = hslToHex(hBase + rng() * 8, brown ? 26 + rng() * 20 : 12 + rng() * 12, 16 + rng() * 8)
  const gradMid2 = hslToHex(hBase + rng() * 10, 32 + rng() * 22, 27 + rng() * 9)

  // summits in vivid opposition: fluo yellow or hot orange
  const fluo = rng() < 0.5
  const gradHigh = fluo
    ? hslToHex(54 + rng() * 12, 88 + rng() * 12, 54 + rng() * 8) // fluo yellow
    : hslToHex(18 + rng() * 14, 92 + rng() * 8, 52 + rng() * 8) // hot orange

  // seas: dark slate blues sinking to near-black
  const hSea = 200 + rng() * 50
  const oceanShallow = hslToHex(hSea, 24 + rng() * 24, 20 + rng() * 9)
  const oceanMid = hslToHex(hSea + (rng() * 14 - 7), 28 + rng() * 24, 11 + rng() * 6)
  const oceanDeep = hslToHex(hSea + (rng() * 16 - 8), 30 + rng() * 20, 3 + rng() * 5)

  // ink flipped light so contours and grid read on the dark sheet
  const ink = hslToHex(38 + rng() * 24, 12 + rng() * 20, 82 + rng() * 12)

  return {
    mode: 'dark',
    gradLow,
    gradMid1,
    gradMid2,
    gradHigh,
    gradMid1Pos: 0.24 + rng() * 0.2,
    oceanShallow,
    oceanMid,
    oceanDeep,
    ink,
    name: `${pick(rng, NAMES_DARK)} ${pick(rng, NAMES_B)}`,
  }
}

export function generatePalette(rng = Math.random, mode = 'light') {
  const p = mode === 'dark' ? darkPalette(rng) : lightPalette(rng)
  p.gradMid2Pos = Math.min(p.gradMid1Pos + 0.16 + rng() * 0.26, 0.9)
  return p
}

// hypsometric read parameters — "everything color-adjacent but not the ramp"
export function generateStyle(rng = Math.random) {
  return {
    mapTint: 0.72 + rng() * 0.28,
    heightContrast: 2 + rng() * 10,
    heightPivot: 0.3 + rng() * 0.4,
    slopeTint: rng() * 0.8,
  }
}

// survey furniture: contour lines + grid — ink follows the current mode
export function generateGridContour(rng = Math.random, mode = 'light') {
  const dark = mode === 'dark'
  const inkDark = rng() < 0.7
  return {
    contourInterval: 0.06 + rng() * 0.24,
    // light strokes on a dark sheet read bolder — keep night contours airy
    contourOpacity: dark ? 0.3 + rng() * 0.35 : 0.4 + rng() * 0.6,
    contourColor: dark
      ? hslToHex(30 + rng() * 40, 15 + rng() * 30, 74 + rng() * 20) // light ink on dark sheet
      : inkDark
        ? hslToHex(rng() * 360, 10 + rng() * 25, 8 + rng() * 16)
        : hslToHex(10 + rng() * 40, 45 + rng() * 30, 28 + rng() * 14),
    gridStep: 2 + rng() * 10,
    gridOpacity: 0.15 + rng() * 0.85,
    gridColor: dark ? hslToHex(40 + rng() * 30, 10 + rng() * 20, 70 + rng() * 18) : hslToHex(30, 8, 12 + rng() * 10),
  }
}
