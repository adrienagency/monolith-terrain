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

// ---- luminance du fond & bascule auto clair/sombre -------------------------
// Un fond sombre rend le cartouche noir sur noir : on mesure la luminance
// RELATIVE (WCAG, sRGB linéarisé) du fond effectif et on bascule le dark mode
// avec HYSTÉRÉSIS (zone morte 0.32..0.45) pour ne pas clignoter autour du seuil.
const lumOf = (hex) => {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function bgLuminance(params = {}) {
  const m = params.bgMode || 'solid'
  if (m === 'solid') return lumOf(isHex(params.bgColorA) ? params.bgColorA : '#e9eef4')
  if (m === 'mesh') return lumOf(pointsBase(normalizeBgPoints(params)))
  // dégradé : moyenne pondérée par la longueur des segments (stops virtuels
  // aux extrémités — le premier/dernier stop peint aussi jusqu'au bord)
  const st = normalizeBgStops(params)
  const ext = [{ p: 0, c: st[0].c }, ...st, { p: 100, c: st[st.length - 1].c }]
  let acc = 0
  for (let i = 0; i < ext.length - 1; i++) {
    acc += ((ext[i + 1].p - ext[i].p) / 100) * (lumOf(ext[i].c) + lumOf(ext[i + 1].c)) / 2
  }
  return acc
}
// cible du mode : true = passer sombre, false = passer clair, null = garder
export function autoDarkTarget(lum) {
  if (lum == null) return null
  if (lum < 0.32) return true
  if (lum > 0.45) return false
  return null
}

// HSL à la main en sRGB — THREE.Color (color management) travaille en
// linéaire et décalerait clartés/moyennes à la conversion.
function hexToHsl(hex) {
  const [r, g, b] = hexRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s, l }
}
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const hx = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hx(r1)}${hx(g1)}${hx(b1)}`
}

// Couleur de socle harmonisée au fond — teinte du milieu de gamme, saturation
// contenue (un socle reste un meuble, pas un aplat), clarté qui SUIT la
// luminance du fond (fond sombre → socle sombre). Ne touche jamais la matière.
export function derivePlinthColor(model, lum = 0.7) {
  const { h, s } = hexToHsl(model.b)
  return hslToHex(h, Math.min(0.35, s * 0.5), clampF(0.22 + lum * 0.6))
}

// Teintes du LISERÉ MÉTAL de la barre liquide (recette adrienagency.com :
// conic ivoire vif / accent / ivoire doux qui tourne) — dérivées de la
// PALETTE de la carte pour que le métal change avec elle : reflet clair
// presque blanc teinté du milieu de gamme, reflet coloré plus soutenu.
export function deriveMetalTints(params = {}) {
  const stops = Array.isArray(params.rampStops) ? params.rampStops : []
  const mid = stops[Math.floor((stops.length - 1) / 2)]?.c
  const { h, s } = hexToHsl(/^#[0-9a-fA-F]{6}$/.test(mid || '') ? mid : '#b9c4d2')
  return {
    bright: hslToHex(h, Math.min(0.3, s * 0.45), 0.93), // l'« ivoire » teinté
    tint: hslToHex(h, Math.max(0.25, Math.min(0.7, s * 1.1)), 0.55), // le reflet coloré
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
