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

// task 27 §2: "je veux voir les informations des villes et villages... si il
// faut mettre un cartouche derrière le texte, on le fait" — an EXPLICITLY
// authorised background plate for when the outline halo alone isn't enough
// at close, low-camera range (measured: a village-tier label read only ~3px
// cap-height at a reference-style low/oblique camera — see the task-27
// report). `plate` (a fill colour string, or falsy to skip) draws a rounded
// rect BEHIND the halo+ink passes, baked into the SAME canvas/texture/sprite
// as the text — not a second sprite — for the same reason
// composeHeadMarkerTexture (gpx.js) bakes its badge+triangle together: two
// separately-positioned objects can drift apart, one texture structurally
// cannot. Baking it in also means the plate is depthTest:true for free
// (whatever material the caller's sprite uses), so it inherits the same
// "occluded behind a ridge" behaviour as the text — it can't become a way to
// punch a name through a mountain.
const PLATE_HEIGHT_FRAC = 0.76 // of `size` — generous around the ~0.43*size cap-height (measured)
const PLATE_MARGIN_FRAC = 0.34 // of `size`, extra half-width pad reserved on each side for the plate

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function makeLabelTexture(text, { size = 88, weight = 700, color = '#2e2820', halo = 'rgba(255,255,255,0.95)', plate = null, track = 0.12 } = {}) {
  const font = `${weight} ${size}px ${FONT}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * track
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap
  const haloR = halo ? (HALO_RADIUS_PX / 88) * size : 0
  // a plate needs its own, wider margin beyond the halo's thin ring — it's a
  // visible shape, not an anti-aliasing fringe, so it needs real breathing
  // room around the glyphs on every side
  const platePadX = plate ? size * PLATE_MARGIN_FRAC : 0
  const pad = (halo ? size * 0.4 + haloR : size * 0.25) + platePadX
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.6)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (plate) {
    // small gutter between the plate's own edge and the canvas edge (keeps
    // the rounded corners and any texture filtering off the hard border)
    const gutter = platePadX * 0.35
    const plateH = size * PLATE_HEIGHT_FRAC
    const plateY = c.height / 2 - plateH / 2
    ctx.fillStyle = plate
    roundedRectPath(ctx, gutter, plateY, c.width - gutter * 2, plateH, plateH * 0.28)
    ctx.fill()
  }
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
    // over a plate, the halo ring is redundant (the plate itself is already
    // the contrast field) and at plate-scale halo dilation reads as a muddy
    // double-edge — skip it and let the ink sit straight on the plate
    if (halo && !plate) {
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

// task 27 §2 — background plate colour for makeLabelTexture's `plate` option.
// Same base tone family as labelInk's halo (light plate behind dark ink,
// dark plate behind light ink), but its OPACITY ranks by tier instead of
// being flat. A plate is a much bigger, bolder shape than the old halo ring
// — if every tier's plate were equally opaque, a village would suddenly
// read as visually as "important" as a capital, flattening the exact
// importance ordering labelScale (size) and labelInk (ink darkness) already
// agree on. Ranking the plate too keeps all three in lockstep: the biggest,
// darkest-inked place also gets the boldest plate.
const PLATE_ALPHA = [0.92, 0.88, 0.82, 0.76, 0.7, 0.64] // tier 0 (metropolis) -> 5 (village)
export function labelPlate(darkMode, tier = 0) {
  const a = PLATE_ALPHA[Math.max(0, Math.min(PLATE_ALPHA.length - 1, tier))]
  return darkMode ? `rgba(15,17,20,${a})` : `rgba(255,255,255,${a})`
}
