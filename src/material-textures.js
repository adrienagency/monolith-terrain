// Procedural material texture maps, drawn to canvases at runtime (CanvasTexture)
// so nothing is bundled or fetched. Each builder returns a stack the socle (and
// the terrain surface, via the Shaders panel) can wear:
//   { map?, normalMap, roughnessMap }
//
//   carbon — 2/2 twill weave (albedo + normal + roughness)
//   wood   — oak: long grain + growth rings (albedo + normal + roughness)
//   frost  — frosted-glass micro-facets (normal + roughness only; the glass tint
//            rides on attenuation, so no albedo)
//
// The height field is built first, then a normal map (Sobel) + roughness are
// derived from it, and an albedo is tinted from the same field.

import * as THREE from 'three'

const SIZE = 512

// ---- tiny seamless value-noise (tileable via wrapped integer lattice) -------
function hash(ix, iy, period) {
  const x = ((ix % period) + period) % period
  const y = ((iy % period) + period) % period
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}
function smooth(t) {
  return t * t * (3 - 2 * t)
}
function valueNoise(x, y, period) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash(ix, iy, period)
  const b = hash(ix + 1, iy, period)
  const c = hash(ix, iy + 1, period)
  const d = hash(ix + 1, iy + 1, period)
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
}
function fbm(x, y, period, oct = 4) {
  let v = 0
  let amp = 0.5
  let f = 1
  let p = period
  for (let i = 0; i < oct; i++) {
    v += amp * valueNoise(x * f, y * f, p)
    f *= 2
    p *= 2
    amp *= 0.5
  }
  return v
}

// ---- shared canvas / derivation helpers -------------------------------------
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
// build a normal map canvas texture from a height field (Sobel, wrapped)
function normalFromHeight(h, strength) {
  return canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
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
}

// ============================================================ CARBON (twill)
function twillHeight() {
  const h = new Float32Array(SIZE * SIZE)
  const TOWS = 16
  const cell = SIZE / TOWS
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const fx = (x % cell) / cell
      const fy = (y % cell) / cell
      const over = ((cx + cy) & 3) < 2
      const horizontal = ((cx + cy) & 1) === 0
      const across = horizontal ? fy : fx
      const along = horizontal ? fx : fy
      const ridge = Math.sin(across * Math.PI)
      const fibers = 0.5 + 0.5 * Math.sin(along * Math.PI * 10)
      h[y * SIZE + x] = (over ? 1.0 : 0.5) * (0.72 * ridge + 0.16 * ridge * fibers)
    }
  }
  return h
}
let _carbon = null
export function carbonTextures() {
  if (_carbon) return _carbon
  const h = twillHeight()
  const map = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const base = 14 + h[i] * 26
      img.data[i * 4] = base
      img.data[i * 4 + 1] = base + 1
      img.data[i * 4 + 2] = base + 4
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, { srgb: true })
  const roughnessMap = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = Math.max(0, Math.min(255, (0.55 - h[i] * 0.3) * 255))
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  })
  _carbon = { map, normalMap: normalFromHeight(h, 2.4), roughnessMap }
  return _carbon
}

// ============================================================ WOOD (oak)
function woodFields() {
  const h = new Float32Array(SIZE * SIZE)
  const ring = new Float32Array(SIZE * SIZE) // 0..1, 1 = on a dark ring line
  const P = 8 // noise lattice period (tileable)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * P
      const v = (y / SIZE) * P
      // growth rings: concentric bands warped by noise, off a distant centre
      const warp = fbm(u * 0.6, v * 0.6, P, 3) * 1.6
      const rr = Math.hypot(u - P * 1.6, (v - P * 0.5) * 0.35) + warp
      const rings = 0.5 + 0.5 * Math.sin(rr * 3.2)
      const ringLine = Math.pow(rings, 6) // sharp dark lines where rings peak
      // fine long grain running along y (streaks)
      const grain = fbm(u * 2.0, v * 14.0, P, 3)
      const i = y * SIZE + x
      ring[i] = ringLine
      h[i] = 0.6 * (1 - ringLine) + 0.4 * grain
    }
  }
  return { h, ring }
}
let _wood = null
export function woodTextures() {
  if (_wood) return _wood
  const { h, ring } = woodFields()
  // oak palette: warm mid brown, ring lines drop toward espresso
  const light = [190, 150, 96]
  const dark = [96, 66, 38]
  const map = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const t = Math.min(1, ring[i] * 0.9 + (1 - h[i]) * 0.35)
      img.data[i * 4] = light[0] + (dark[0] - light[0]) * t
      img.data[i * 4 + 1] = light[1] + (dark[1] - light[1]) * t
      img.data[i * 4 + 2] = light[2] + (dark[2] - light[2]) * t
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, { srgb: true, repeat: 2 })
  const roughnessMap = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = Math.max(0, Math.min(255, (0.5 + ring[i] * 0.35) * 255)) // ring pores rougher
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, { repeat: 2 })
  const nm = normalFromHeight(h, 2.0)
  nm.repeat.set(2, 2)
  _wood = { map, normalMap: nm, roughnessMap }
  return _wood
}

// ============================================================ FROST (glass)
function frostHeight() {
  const h = new Float32Array(SIZE * SIZE)
  const P = 24 // fine, high-frequency facets
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * P
      const v = (y / SIZE) * P
      h[y * SIZE + x] = fbm(u, v, P, 4)
    }
  }
  return h
}
let _frost = null
export function frostTextures() {
  if (_frost) return _frost
  const h = frostHeight()
  const roughnessMap = canvasTex((ctx) => {
    const img = ctx.createImageData(SIZE, SIZE)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = Math.max(0, Math.min(255, (0.35 + h[i] * 0.5) * 255))
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, { repeat: 4 })
  const nm = normalFromHeight(h, 3.0)
  nm.repeat.set(4, 4)
  _frost = { normalMap: nm, roughnessMap }
  return _frost
}

// builders keyed by id — used by the socle (a preset's `tex`) and the terrain
// surface-material picker (Shaders panel, next to Liquid metal)
export const TEXTURE_BUILDERS = {
  carbon: carbonTextures,
  wood: woodTextures,
  frost: frostTextures,
}

// list offered on the terrain surface (Shaders panel)
export const SURFACE_MATERIALS = [
  { id: 'carbon', label: 'Carbon fibre' },
  { id: 'wood', label: 'Wood (oak)' },
  { id: 'frost', label: 'Frosted glass' },
]
