import * as THREE from 'three'

// A place label drawn to a transparent canvas with a contrasting HALO so it
// stays legible over any map colour. `color` is the ink; `halo` is the opposite
// tone (light halo around dark ink, and vice-versa in dark mode). Uses the
// site's sans face (Rosarivo, the serif, stays reserved for map titles).
const FONT = "'Bricolage Grotesque', system-ui, sans-serif"

// Canvas silently falls back to a system face when the webfont isn't parsed yet,
// which would render every label in the wrong typeface. Warm the exact weights
// we draw with; fonts.load is a no-op once resolved, so calling it is cheap.
let _fontReady = null
export function labelFontReady() {
  if (!_fontReady) {
    _fontReady = Promise.all([
      document.fonts?.load(`700 88px ${FONT}`),
      document.fonts?.load(`800 88px ${FONT}`),
    ]).catch(() => {})
  }
  return _fontReady
}

// Outline radius, in px at this function's `size` (the canvas is drawn at 88px
// then minified to an ~8-15px on-screen cap height — see BASE_H in
// places-layer.js). Kept small and constant rather than proportional to size:
// a centred `ctx.strokeText` at this thickness straddles the glyph path, so
// half its width eats INTO the letter, thinning stems and closing counters —
// exactly what read "sale"/mushy once the halo was actually turned on. See
// the ring-of-fills technique below for how this is avoided.
const HALO_RADIUS_PX = 1.6
const HALO_STEPS = 14 // fill copies around the ring — enough to look continuous at this radius

export function makeLabelTexture(text, { size = 88, weight = 700, color = '#2e2820', halo = 'rgba(255,255,255,0.95)', track = 0.12 } = {}) {
  const font = `${weight} ${size}px ${FONT}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * track
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap
  const haloR = halo ? (HALO_RADIUS_PX / 88) * size : 0
  const pad = halo ? size * 0.4 + haloR : size * 0.25
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.6)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  // Genuine OUTER contour: instead of a centred stroke (which bleeds half its
  // width into the glyph), stamp solid halo-colour copies of each glyph in a
  // ring around its true position, then paint the ink glyph on top dead
  // centre. The ink fill always exactly recovers the crisp original
  // letterform — counters stay open, stems stay full weight — while the ring
  // copies fill in only the OUTSIDE, producing a clean dilation of the glyph
  // silhouette instead of a muddy blended edge.
  const ringOffsets = []
  if (halo) {
    for (let i = 0; i < HALO_STEPS; i++) {
      const a = (i / HALO_STEPS) * Math.PI * 2
      ringOffsets.push([Math.cos(a) * haloR, Math.sin(a) * haloR])
    }
  }
  let x = pad
  for (const ch of text) {
    if (halo) {
      ctx.fillStyle = halo
      for (const [dx, dy] of ringOffsets) ctx.fillText(ch, x + dx, c.height / 2 + dy)
    }
    ctx.fillStyle = color
    ctx.fillText(ch, x, c.height / 2) // ink on top, recovers a crisp glyph
    x += ctx.measureText(ch).width + gap
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: c.width / c.height }
}

// Tailwind slate, darkest → lightest. Index matches place-scale.js's
// placeTier() (0 = metropolis … 5 = village), so a place's name-colour
// darkness always tracks the same importance ranking that picks its size —
// one ranking, not two. Light mode reads dark-on-light (important = near-
// black slate-900); dark mode inverts the ramp so important still reads as
// the strongest contrast against a dark backdrop (light slate-50).
const SLATE_LIGHT = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'] // 900,800,700,600,500,400
const SLATE_DARK = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'] // 50,100,200,300,400,500

// theme + importance-aware ink + halo pair used by every Map label.
// `tier` is place-scale.js's placeTier() index; defaults to 0 (most
// important / darkest-or-lightest) for any caller that doesn't rank.
export function labelInk(darkMode, tier = 0) {
  const i = Math.max(0, Math.min(SLATE_LIGHT.length - 1, tier))
  return darkMode
    ? { color: SLATE_DARK[i], halo: 'rgba(15,17,20,0.92)' }
    : { color: SLATE_LIGHT[i], halo: 'rgba(255,255,255,0.95)' }
}
