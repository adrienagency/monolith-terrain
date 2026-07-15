// Background gradients — the scene background can be a flat colour or a soft
// gradient (linear / radial / mesh) baked to a CanvasTexture. three.js draws a
// plain (UV-mapped) background texture stretched to fill the viewport, so a
// canvas gradient reads as a full-screen backdrop. Colours A/B/C are the stops.

import * as THREE from 'three'

const S = 512

function blob(ctx, color, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  const c = new THREE.Color(color)
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
}

export function makeGradientTexture({ mode = 'linear', a = '#ffffff', b = '#cbd5e1', c = '#94a3b8', angle = 135 } = {}) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')

  if (mode === 'radial') {
    const g = ctx.createRadialGradient(S / 2, S * 0.42, S * 0.04, S / 2, S * 0.42, S * 0.78)
    g.addColorStop(0, a)
    g.addColorStop(0.58, b)
    g.addColorStop(1, c)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  } else if (mode === 'mesh') {
    // soft multi-point mesh gradient: base A, overlapping blurred blobs of B/C/A
    ctx.fillStyle = a
    ctx.fillRect(0, 0, S, S)
    blob(ctx, b, S * 0.24, S * 0.28, S * 0.62)
    blob(ctx, c, S * 0.8, S * 0.7, S * 0.62)
    blob(ctx, a, S * 0.62, S * 0.12, S * 0.5)
    blob(ctx, b, S * 0.12, S * 0.82, S * 0.45)
  } else {
    // linear at `angle` degrees across the canvas
    const rad = ((angle % 360) * Math.PI) / 180
    const dx = Math.cos(rad) * (S / 2)
    const dy = Math.sin(rad) * (S / 2)
    const g = ctx.createLinearGradient(S / 2 - dx, S / 2 - dy, S / 2 + dx, S / 2 + dy)
    g.addColorStop(0, a)
    g.addColorStop(0.5, b)
    g.addColorStop(1, c)
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
const clampF = (x) => Math.max(0, Math.min(1, x))
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

export const BG_MODES = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear gradient' },
  { value: 'radial', label: 'Radial gradient' },
  { value: 'mesh', label: 'Mesh gradient' },
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
