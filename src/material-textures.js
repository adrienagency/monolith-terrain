// Procedural material texture maps, drawn to canvases at runtime (CanvasTexture)
// so nothing is bundled or fetched. First up: a carbon-fibre twill stack —
// albedo + normal + roughness — that gives the block a real woven surface with
// micro-relief, lit by the socle studio env for the lacquer sheen.
//
// The weave is a 2/2 twill: tows interlace over/under on a diagonal, the pattern
// that reads unmistakably as carbon. We build a height field first, then derive a
// normal map (Sobel) and a roughness map from it, and tint an albedo from the
// same field so the raised tows catch a touch more light.

import * as THREE from 'three'

const SIZE = 512

// height field of a 2/2 twill weave, seamless (tileable). Returns Float32Array.
function twillHeight() {
  const h = new Float32Array(SIZE * SIZE)
  const TOWS = 16 // tows across the tile
  const cell = SIZE / TOWS
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const fx = (x % cell) / cell // 0..1 within cell
      const fy = (y % cell) / cell
      // 2/2 twill: the diagonal band decides which yarn floats on top
      const over = ((cx + cy) & 3) < 2
      // alternate the yarn direction so warp/weft interlace like a real weave
      const horizontal = ((cx + cy) & 1) === 0
      const across = horizontal ? fy : fx
      const along = horizontal ? fx : fy
      const ridge = Math.sin(across * Math.PI) // rounded bump across the tow
      const fibers = 0.5 + 0.5 * Math.sin(along * Math.PI * 10) // fine strands along it
      const base = over ? 1.0 : 0.5
      h[y * SIZE + x] = base * (0.72 * ridge + 0.16 * ridge * fibers)
    }
  }
  return h
}

function sampleWrap(h, x, y) {
  const xi = (x + SIZE) % SIZE
  const yi = (y + SIZE) % SIZE
  return h[yi * SIZE + xi]
}

function canvasTex(paint, { srgb = false, repeat = 3 } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  paint(c.getContext('2d'))
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

let _carbon = null
// { map, normalMap, roughnessMap } — built once, cached.
export function carbonTextures() {
  if (_carbon) return _carbon
  const h = twillHeight()

  const map = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      // near-black graphite; raised tows a touch lighter with a cool sheen
      const v = h[i]
      const base = 14 + v * 26
      img.data[i * 4] = base
      img.data[i * 4 + 1] = base + 1
      img.data[i * 4 + 2] = base + 4
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, { srgb: true })

  const normalMap = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    const strength = 2.4
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = (sampleWrap(h, x - 1, y) - sampleWrap(h, x + 1, y)) * strength
        const dy = (sampleWrap(h, x, y - 1) - sampleWrap(h, x, y + 1)) * strength
        const len = Math.hypot(dx, dy, 1)
        const i = (y * SIZE + x) * 4
        img.data[i] = ((dx / len) * 0.5 + 0.5) * 255
        img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
        img.data[i + 2] = (1 / len) * 0.5 * 255 + 128
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  })

  const roughnessMap = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      // raised tows read polished; the recesses between them stay matte
      const r = 0.55 - h[i] * 0.3
      const v = Math.max(0, Math.min(255, r * 255))
      img.data[i * 4] = v
      img.data[i * 4 + 1] = v
      img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  })

  _carbon = { map, normalMap, roughnessMap }
  return _carbon
}

// texture-stack builders keyed by a preset's `tex` id
export const TEXTURE_BUILDERS = {
  carbon: carbonTextures,
}
