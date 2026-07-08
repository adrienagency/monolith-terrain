// Color-theory palette generation for the Map Overlay panel. The rules the
// palettes obey (and the tests pin down):
//   summits    → warm hues (reds / oranges / golds)
//   lowlands   → cool hues (teals / blues) or vintage paper neutrals
//   sea        → blue most of the time, sometimes very pale — and always
//                darker the deeper it gets
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

export function generatePalette(rng = Math.random) {
  // summits: warm
  const hHigh = 12 + rng() * 48 // 12–60°
  const sHigh = 48 + rng() * 34
  const lHigh = 50 + rng() * 16

  // lowlands: cool, or vintage paper neutral one time in three
  const paperLow = rng() < 0.34
  const hLow = paperLow ? 40 + rng() * 20 : 155 + rng() * 100 // 155–255°
  const gradLow = paperLow
    ? hslToHex(hLow, 6 + rng() * 12, 90 + rng() * 6)
    : hslToHex(hLow, 16 + rng() * 26, 80 + rng() * 12)

  // mids walk the hue from low to high while staying light — the classic
  // hypsometric ramp progression
  const gradMid1 = hslToHex(mixHue(hLow, hHigh, 0.35), 22 + rng() * 26, 76 + rng() * 10)
  const gradMid2 = hslToHex(mixHue(hLow, hHigh, 0.68), 34 + rng() * 28, 64 + rng() * 12)
  const gradHigh = hslToHex(hHigh, sHigh, lHigh)

  const gradMid1Pos = 0.2 + rng() * 0.2
  const gradMid2Pos = Math.min(gradMid1Pos + 0.16 + rng() * 0.26, 0.9)

  // sea: blue most of the time, occasionally very pale; deep is always darker
  const blueSea = rng() < 0.78
  const hSea = blueSea ? 192 + rng() * 28 : 185 + rng() * 35
  const oceanShallow = hslToHex(hSea, blueSea ? 28 + rng() * 26 : 8 + rng() * 10, 84 + rng() * 9)
  const oceanDeep = hslToHex(hSea + (rng() * 14 - 7), blueSea ? 34 + rng() * 30 : 14 + rng() * 8, 20 + rng() * 16)

  const name = `${NAMES_A[Math.floor(rng() * NAMES_A.length)]} ${NAMES_B[Math.floor(rng() * NAMES_B.length)]}`

  return { gradLow, gradMid1, gradMid2, gradHigh, gradMid1Pos, gradMid2Pos, oceanShallow, oceanDeep, name }
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

// survey furniture: contour lines + grid
export function generateGridContour(rng = Math.random) {
  const inkDark = rng() < 0.7
  return {
    contourInterval: 0.06 + rng() * 0.24,
    contourOpacity: 0.4 + rng() * 0.6,
    contourColor: inkDark
      ? hslToHex(rng() * 360, 10 + rng() * 25, 8 + rng() * 16)
      : hslToHex(10 + rng() * 40, 45 + rng() * 30, 28 + rng() * 14),
    gridStep: 2 + rng() * 10,
    gridOpacity: 0.15 + rng() * 0.85,
  }
}
