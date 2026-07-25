// Background gradients — the scene background can be a flat colour, a stop
// gradient (linear / radial) or a POINT gradient (freeform blobs à la
// Illustrator), baked to a CanvasTexture. three.js draws a plain (UV-mapped)
// background texture stretched to fill the viewport, so a canvas gradient
// reads as a full-screen backdrop.
//
// Fonds v2 : les 3 couleurs A/B/C historiques deviennent des STOPS arbitraires
// [{p 0..100, c}] (2..8) pour linéaire/radial, et des POINTS [{x,y,r,c}] en
// 0..1 (1..8) pour le dégradé de points. bgColorA/B/C restent en miroir
// (premier / médian / dernier stop) pour tout ce qui en dépend encore (ombre
// du globe, brume, anciens templates).

import * as THREE from 'three'

const S = 512
export const MAX_STOPS = 8
export const MAX_POINTS = 8

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const clampF = (x) => Math.max(0, Math.min(1, x))
const clamp100 = (x) => Math.max(0, Math.min(100, x))
const isHex = (c) => typeof c === 'string' && HEX_RE.test(c)

// ---------------------------------------------------------------- stops model
// Sanitizes untrusted input (imported template JSON) : clamp positions, drop
// bad colours, cap the count, always return ≥ 2 stops sorted by position.
export function normalizeBgStops(params = {}) {
  const raw = Array.isArray(params.bgStops) ? params.bgStops : []
  let stops = raw
    .filter((s) => s && isHex(s.c) && Number.isFinite(+s.p))
    .map((s) => ({ p: Math.round(clamp100(+s.p)), c: s.c }))
    .slice(0, MAX_STOPS)
  if (stops.length < 2) {
    // legacy A/B/C (or defaults) → the classic 3-stop gradient
    const a = isHex(params.bgColorA) ? params.bgColorA : '#e9eef4'
    const b = isHex(params.bgColorB) ? params.bgColorB : '#b9c4d2'
    const c = isHex(params.bgColorC) ? params.bgColorC : '#334155'
    stops = [{ p: 0, c: a }, { p: 50, c: b }, { p: 100, c: c }]
  }
  return stops.sort((x, y) => x.p - y.p)
}

// flip a gradient end-for-end (Figma's ⇆ button)
export function flipStops(stops) {
  return stops.map((s) => ({ p: 100 - s.p, c: s.c })).sort((x, y) => x.p - y.p)
}

// CSS string for live previews (type vignettes + grapick restyle). Radial uses
// the same geometry idea as the canvas bake (light core above centre).
export function stopsToCss(stops, mode = 'linear', angle = 135) {
  const list = stops.map((s) => `${s.c} ${s.p}%`).join(', ')
  return mode === 'radial'
    ? `radial-gradient(circle at 50% 42%, ${list})`
    : `linear-gradient(${(angle + 90) % 360}deg, ${list})`
}

// --------------------------------------------------------------- points model
// Freeform point gradient: each point spreads its colour as a soft blob. Same
// sanitization contract as stops; always ≥ 1 point.
export function normalizeBgPoints(params = {}) {
  const raw = Array.isArray(params.bgPoints) ? params.bgPoints : []
  let pts = raw
    .filter((s) => s && isHex(s.c) && Number.isFinite(+s.x) && Number.isFinite(+s.y))
    .map((s) => ({ x: clampF(+s.x), y: clampF(+s.y), r: clampF(Number.isFinite(+s.r) ? +s.r : 0.5), c: s.c }))
    .slice(0, MAX_POINTS)
  if (!pts.length) {
    // classic mesh recipe positions, coloured from the stop colours
    const st = normalizeBgStops(params)
    const a = st[0].c, b = st[Math.floor((st.length - 1) / 2)].c, c = st[st.length - 1].c
    pts = [
      { x: 0.24, y: 0.28, r: 0.62, c: b },
      { x: 0.8, y: 0.7, r: 0.62, c },
      { x: 0.62, y: 0.12, r: 0.5, c: a },
      { x: 0.12, y: 0.82, r: 0.45, c: b },
    ]
  }
  return pts
}

// plain sRGB hex → [r,g,b] ints — deliberately NOT THREE.Color, whose colour
// management would convert to linear space and shift averages/blends vs CSS
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// the base colour under the blobs = average of the point colours, so isolated
// corners melt into a mix instead of showing an arbitrary flat colour
export function pointsBase(points) {
  let r = 0, g = 0, b = 0
  for (const p of points) {
    const [pr, pg, pb] = hexRgb(p.c)
    r += pr; g += pg; b += pb
  }
  const n = Math.max(1, points.length)
  const h = (v) => Math.round(v / n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// stacked radial-gradients — same look as the canvas bake, for the plane
// editor background + the type vignette
export function pointsToCss(points) {
  const layers = points.map((p) => {
    const rgb = hexRgb(p.c).join(',')
    return `radial-gradient(circle at ${Math.round(p.x * 100)}% ${Math.round(p.y * 100)}%, rgba(${rgb},1), rgba(${rgb},0) ${Math.round(p.r * 100)}%)`
  })
  return layers.join(', ')
}

// ------------------------------------------------------------- canvas bake
function blob(ctx, color, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  const rgb = hexRgb(color).join(',')
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
}

export function makeGradientTexture({ mode = 'linear', stops, points, angle = 135 } = {}) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')

  if (mode === 'mesh') {
    const pts = points && points.length ? points : normalizeBgPoints({})
    ctx.fillStyle = pointsBase(pts)
    ctx.fillRect(0, 0, S, S)
    for (const p of pts) blob(ctx, p.c, p.x * S, p.y * S, Math.max(0.02, p.r) * S)
  } else {
    const st = stops && stops.length >= 2 ? stops : normalizeBgStops({})
    let g
    if (mode === 'radial') {
      g = ctx.createRadialGradient(S / 2, S * 0.42, S * 0.04, S / 2, S * 0.42, S * 0.78)
    } else {
      const rad = ((angle % 360) * Math.PI) / 180
      const dx = Math.cos(rad) * (S / 2)
      const dy = Math.sin(rad) * (S / 2)
      g = ctx.createLinearGradient(S / 2 - dx, S / 2 - dy, S / 2 + dx, S / 2 + dy)
    }
    for (const s of st) g.addColorStop(s.p / 100, s.c)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

// Derive a harmonious 3-stop background from the current map palette (colour
// theory): the light top comes from the highest land tint (sky), the middle
// from a mid elevation, the deep bottom from the ocean — each pulled toward the
// backdrop role (lighter + a touch desaturated up top, deeper below) so the
// gradient echoes the map yet recedes behind the relief.
export function deriveBgColors(params = {}) {
  const stops = Array.isArray(params.rampStops) ? params.rampStops : []
  const n = stops.length
  const at = (i) => (stops[Math.max(0, Math.min(n - 1, i))]?.c) || '#cbd5e1'
  const top = new THREE.Color(n ? at(n - 1) : '#e9eef4')
  const mid = new THREE.Color(n ? at(Math.floor(n * 0.45)) : '#b9c4d2')
  const deep = new THREE.Color(params.oceanDeep || (n ? at(0) : '#334155'))
  const tweak = (col, dl, sMul) => {
    const h = {}
    col.getHSL(h)
    return '#' + new THREE.Color().setHSL(h.h, clampF(h.s * sMul), clampF(h.l + dl)).getHexString()
  }
  return {
    a: tweak(top, 0.16, 0.55), // airy sky
    b: tweak(mid, 0.04, 0.72),
    c: tweak(deep, -0.04, 0.85), // grounded base
  }
}

// palette → full v2 model (stops + points), used by « Couleurs auto »
export function deriveBgModel(params = {}) {
  const { a, b, c } = deriveBgColors(params)
  return {
    a, b, c,
    stops: [{ p: 0, c: a }, { p: 50, c: b }, { p: 100, c }],
    points: normalizeBgPoints({ bgColorA: a, bgColorB: b, bgColorC: c }),
  }
}

export const BG_MODES = [
  { value: 'solid', label: 'Uni' },
  { value: 'linear', label: 'Dégradé linéaire' },
  { value: 'radial', label: 'Dégradé radial' },
  { value: 'mesh', label: 'Dégradé de points' },
]

// HDRI sky environments — a real panorama used both as the scene backdrop and as
// image-based lighting (reflections on glass/metal relief). Selecting one takes
// over from the solid/gradient backdrop; clearing it restores the gradient. The
// equirect .jpg is a tonemapped CC0 sky (ambientCG); thumb is its preview.
// Structured as a list so new skies are a one-line addition.
export const ENVIRONMENTS = [
  { id: 'daysky062b', label: 'Jour clair', img: 'textures/env/daysky062b.jpg', thumb: 'textures/env/daysky062b-thumb.jpg' },
  { id: 'daysky064b', label: 'Jour voilé', img: 'textures/env/daysky064b.jpg', thumb: 'textures/env/daysky064b-thumb.jpg' },
  { id: 'eveningsky016b', label: 'Soir doré', img: 'textures/env/eveningsky016b.jpg', thumb: 'textures/env/eveningsky016b-thumb.jpg' },
  { id: 'eveningsky018a', label: 'Crépuscule', img: 'textures/env/eveningsky018a.jpg', thumb: 'textures/env/eveningsky018a-thumb.jpg' },
]
export const ENV_BY_ID = Object.fromEntries(ENVIRONMENTS.map((e) => [e.id, e]))
