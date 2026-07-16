import * as THREE from 'three'

// A serif place label drawn to a transparent canvas with a contrasting HALO so
// it stays legible over any map colour. `color` is the ink; `halo` is the
// opposite tone (light halo around dark ink, and vice-versa in dark mode).
const FONT = "Rosarivo, Georgia, 'Times New Roman', serif"

export function makeLabelTexture(text, { size = 88, weight = 500, color = '#2e2820', halo = 'rgba(255,255,255,0.9)', track = 0.16 } = {}) {
  const font = `${weight} ${size}px ${FONT}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * track
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap
  const haloW = halo ? Math.max(2, size * 0.09) : 0
  const pad = halo ? size * 0.4 + haloW : size * 0.25
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.6)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = haloW
  ctx.strokeStyle = halo
  ctx.fillStyle = color
  let x = pad
  for (const ch of text) {
    if (halo) ctx.strokeText(ch, x, c.height / 2) // halo first
    ctx.fillText(ch, x, c.height / 2) // ink on top
    x += ctx.measureText(ch).width + gap
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: c.width / c.height }
}

// theme-aware ink + halo pair used by every Map label
export function labelInk(darkMode) {
  return darkMode
    ? { color: '#eae3d4', halo: 'rgba(20,22,26,0.85)' }
    : { color: '#2e2820', halo: 'rgba(252,252,250,0.9)' }
}
