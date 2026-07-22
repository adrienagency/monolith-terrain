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

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)

// The land hypsometric ramp as an ordered list of {c, p} stops. Prefers the
// rich 8-stop `rampStops` when present, else falls back to the legacy 4-stop
// grad* params. Pure — shared by the terrain and globe ramp builders.
export function rampColorStops(params) {
  if (Array.isArray(params.rampStops) && params.rampStops.length >= 2) {
    return params.rampStops
      .map((s) => ({ c: s.c, p: clamp01(s.p) }))
      .sort((a, b) => a.p - b.p)
  }
  return [
    { c: params.gradLow, p: 0 },
    { c: params.gradMid1, p: clamp01(params.gradMid1Pos ?? 0.35) },
    { c: params.gradMid2, p: clamp01(params.gradMid2Pos ?? 0.36) },
    { c: params.gradHigh, p: 1 },
  ]
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

// Monochrome presets — the relief itself, shaded by light alone, no
// hypsometric color (the museum-slab look from the references). Returns a
// full look object (palette + style + grid + plinth + mode flags) so a single
// apply switches everything.
export function monochromeLook(kind) {
  if (kind === 'dark') {
    return {
      mode: 'dark',
      darkMode: true,
      rampStops: expandToRampStops('#1b1b1b', '#292929', '#363636', '#454545', 0.35, 0.62),
      oceanShallow: '#222222',
      oceanMid: '#151515',
      oceanDeep: '#0a0a0a',
      ink: '#cccccc',
      mapTint: 0.28, // let the lit surface carry the relief, not the ramp
      heightContrast: 4,
      heightPivot: 0.5,
      slopeTint: 0.12,
      contourInterval: 0.13,
      contourOpacity: 0.32,
      contourColor: '#cfccc4',
      gridStep: 6,
      gridOpacity: 0.14,
      gridColor: '#b9b6ae',
    }
  }
  return {
    mode: 'light',
    darkMode: false,
    rampStops: expandToRampStops('#f2f2f2', '#f6f6f6', '#fafafa', '#ffffff', 0.35, 0.62),
    oceanShallow: '#ededed',
    oceanMid: '#dedede',
    oceanDeep: '#c8c8c8',
    ink: '#999999',
    mapTint: 0.22,
    heightContrast: 4,
    heightPivot: 0.5,
    slopeTint: 0.16,
    contourInterval: 0.13,
    contourOpacity: 0.34,
    contourColor: '#a8a59d',
    gridStep: 6,
    gridOpacity: 0.16,
    gridColor: '#b4b1a8',
  }
}

// linear RGB blend of two #rrggbb hexes
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const to = (v) => Math.round(v).toString(16).padStart(2, '0')
  return `#${pa.map((v, i) => to(v + (pb[i] - v) * t)).join('')}`
}

// sample the legacy 4-stop gradient (low @0, m1 @m1p, m2 @m2p, high @1) at x
function sampleFourStop(low, m1, m2, high, m1p, m2p, x) {
  const stops = [
    [0, low],
    [clamp01(m1p), m1],
    [clamp01(Math.max(m2p, m1p + 0.001)), m2],
    [1, high],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (x <= p1) return lerpHex(c0, c1, p1 === p0 ? 0 : (x - p0) / (p1 - p0))
  }
  return high
}

// expand a legacy 4-stop palette into the rich 8-stop rampStops
export function expandToRampStops(low, m1, m2, high, m1p, m2p, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1)
    return { c: sampleFourStop(low, m1, m2, high, m1p, m2p, x), p: x }
  })
}

export function generatePalette(rng = Math.random, mode = 'light') {
  const p = mode === 'dark' ? darkPalette(rng) : lightPalette(rng)
  p.gradMid2Pos = Math.min(p.gradMid1Pos + 0.16 + rng() * 0.26, 0.9)
  p.rampStops = expandToRampStops(p.gradLow, p.gradMid1, p.gradMid2, p.gradHigh, p.gradMid1Pos, p.gradMid2Pos)
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

// ---------------------------------------------------------------- earth palettes
// Générateur « poline-style » (meodai.github.io/poline) : des ANCRES de teinte
// en HSL (basse / moyenne / haute altitude) interpolées par arcs de teinte
// courts avec easing — la chroma culmine au milieu, la luminosité descend (ou
// monte vers la neige). Chaque tirage choisit un BIOME terrestre, donc les
// palettes restent dans les couleurs de notre planète (Adrien). Renvoie la
// rampe 8 arrêts + la rampe océan harmonisée + l'encre, en un clic.
function lerpHueArc(a, b, t) {
  const d = ((b - a + 540) % 360) - 180 // arc le plus court
  return (a + d * t + 360) % 360
}
const easeSmooth = (t) => t * t * (3 - 2 * t)

export const EARTH_BIOMES = ['Alpine', 'High desert', 'Volcanic', 'Arctic fjord', 'Rainforest', 'Canyon', 'Steppe', 'Lagoon atoll']
export function generateEarthPalette(rng = Math.random) {
  const R = (a, b) => a + rng() * (b - a)
  const pickB = (arr) => arr[Math.floor(rng() * arr.length)]
  // ancres [teinte, saturation %, luminosité %] : bas → milieu → haut
  const BIOMES = {
    'Alpine': { low: [R(85, 135), R(12, 26), R(80, 88)], mid: [R(26, 42), R(18, 34), R(56, 68)], high: [R(210, 230), R(3, 8), R(94, 98)] },
    'High desert': { low: [R(44, 54), R(22, 36), R(88, 93)], mid: [R(26, 36), R(38, 54), R(60, 70)], high: [R(10, 22), R(32, 48), R(28, 40)] },
    'Volcanic': { low: [R(24, 44), R(6, 14), R(82, 90)], mid: [R(8, 24), R(12, 26), R(36, 50)], high: [R(0, 16), R(8, 18), R(8, 18)] },
    'Arctic fjord': { low: [R(188, 212), R(16, 32), R(86, 92)], mid: [R(200, 224), R(22, 38), R(64, 78)], high: [R(208, 228), R(5, 12), R(95, 99)] },
    'Rainforest': { low: [R(95, 135), R(26, 42), R(68, 80)], mid: [R(85, 112), R(32, 48), R(40, 54)], high: [R(45, 62), R(14, 24), R(84, 92)] },
    'Canyon': { low: [R(38, 48), R(26, 40), R(88, 94)], mid: [R(16, 30), R(46, 62), R(52, 64)], high: [R(6, 18), R(48, 64), R(26, 36)] },
    'Steppe': { low: [R(52, 68), R(18, 30), R(84, 90)], mid: [R(38, 52), R(26, 40), R(58, 68)], high: [R(24, 36), R(20, 34), R(32, 44)] },
    'Lagoon atoll': { low: [R(160, 180), R(24, 40), R(86, 92)], mid: [R(70, 100), R(22, 36), R(58, 70)], high: [R(35, 50), R(16, 28), R(90, 96)] },
  }
  const biome = pickB(EARTH_BIOMES)
  const A = BIOMES[biome]
  const anchors = [A.low, A.mid, A.high]
  const snowCap = biome === 'Alpine' || biome === 'Arctic fjord' || rng() < 0.25
  const stops = []
  for (let i = 0; i < 8; i++) {
    const t = i / 7
    let h, s, l
    if (t <= 0.5) {
      const u = easeSmooth(t / 0.5)
      h = lerpHueArc(anchors[0][0], anchors[1][0], u)
      s = anchors[0][1] + (anchors[1][1] - anchors[0][1]) * u
      l = anchors[0][2] + (anchors[1][2] - anchors[0][2]) * u
    } else {
      const u = easeSmooth((t - 0.5) / 0.5)
      h = lerpHueArc(anchors[1][0], anchors[2][0], u)
      s = anchors[1][1] + (anchors[2][1] - anchors[1][1]) * u
      l = anchors[1][2] + (anchors[2][2] - anchors[1][2]) * u
    }
    // arc de chroma : la saturation culmine au milieu de la rampe (poline)
    s *= 0.82 + 0.36 * Math.sin(Math.PI * t)
    stops.push({ c: hslToHex(h, s, l), p: +t.toFixed(2) })
  }
  if (snowCap) stops[7] = { c: hslToHex(anchors[2][0], R(2, 6), R(95, 99)), p: 1 }
  // océan harmonisé : famille turquoise→azur, clair au rivage, profond au large
  const hSea = R(168, 208)
  const sSea = R(30, 52)
  return {
    name: `${biome.toUpperCase()} ${pick(rng, NAMES_B)}`,
    rampStops: stops,
    oceanShallow: hslToHex(hSea + R(-6, 6), sSea + R(6, 14), R(82, 90)),
    oceanMid: hslToHex(hSea + R(-8, 8), sSea + R(10, 20), R(46, 58)),
    oceanDeep: hslToHex(hSea + R(-10, 10), sSea * 0.85, R(15, 25)),
    ink: hslToHex(anchors[2][0], R(10, 20), R(8, 14)),
  }
}
