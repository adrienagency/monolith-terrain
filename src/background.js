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

export const BG_MODES = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear gradient' },
  { value: 'radial', label: 'Radial gradient' },
  { value: 'mesh', label: 'Mesh gradient' },
]
