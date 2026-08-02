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
function canvasTex(paint, { srgb = false, repeat = 3, size = SIZE } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  paint(c.getContext('2d'), size)
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
  // Straight, continuous grain running along y — long parallel grain lines,
  // gently warped across x, with fine fibre streaks and a slow tonal drift. No
  // concentric growth rings (those read as repeating "planks"); this reads as an
  // endless plank of wood and tiles seamlessly.
  const h = new Float32Array(SIZE * SIZE)
  const ring = new Float32Array(SIZE * SIZE) // grain-line darkness
  const P = 8 // tileable lattice period
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * P
      const v = (y / SIZE) * P
      const warp = fbm(u * 0.5, v * 0.22, P, 3) * 1.3 // gentle waviness across the grain
      const grainPos = u * 3.2 + warp
      const lines = 0.5 + 0.5 * Math.sin(grainPos * Math.PI)
      const grainLine = Math.pow(lines, 4) // soft dark grain lines
      const fibre = fbm(u * 3.2, v * 22.0, P, 3) // fine streaks along the length
      const tone = fbm(u * 0.7, v * 0.4, P, 2) // slow tonal drift → not obviously tiling
      const i = y * SIZE + x
      ring[i] = grainLine
      h[i] = 0.5 * (1 - grainLine) + 0.32 * fibre + 0.18 * tone
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

// ================================================ MICRO-RUGOSITÉ (finitions nues)
//
// POURQUOI. Vingt-deux des vingt-cinq finitions PBR n'ont AUCUNE carte : couleur,
// rugosité, métal, et c'est tout. Sans carte de rugosité le spéculaire est
// mathématiquement uniforme sur toute la face — le signal « synthétique » numéro
// un. Ce qui sépare un granit flammé d'un granit adouci n'est pas la teinte mais
// la micro-géométrie ; les packs d'imperfections professionnels sont d'ailleurs
// vendus comme des cartes de rugosité, pas d'albédo. On casse donc la rugosité,
// PAS la couleur : le socle reste exactement aussi sobre, il cesse d'être plat.
//
// ⚠️ CE QUE LA CARTE PEUT FAIRE. three multiplie : rugosité finale =
// `material.roughness` × canal vert de la carte. Un octet ne code jamais plus de
// 1,0 : la carte ne sait donc que CREUSER. On code un multiplicateur dans
// [1 − CREUX, 1] et on relève `material.roughness` d'autant pour recentrer —
// voir `rugositeRecentree` ci-dessous.
export const MICRO_ROUGH_CREUX = 0.126 // ±6,3 % relatifs → ±0,06 autour de 0,95
const MICRO_ROUGH_SIZE = 256 // 256² suffit : le motif est basse fréquence

// Le CHAMP seul (sans canevas) pour qu'il soit mesurable hors navigateur.
// Basse fréquence volontaire : deux pixels voisins se ressemblent, sinon la
// carte scintille au loin au lieu de casser le spéculaire de près.
export function microRoughnessField(size = MICRO_ROUGH_SIZE) {
  const P = 4 // 4 lobes sur la tuile — de larges plages, pas du grain
  const f = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm((x / size) * P, (y / size) * P, P, 3)
      f[y * size + x] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  // normalisation sur le champ RÉEL : le maximum vaut exactement 1 (aucun
  // dépassement possible), le minimum exactement 1 − CREUX.
  const span = max - min || 1
  for (let i = 0; i < f.length; i++) f[i] = 1 - MICRO_ROUGH_CREUX * (1 - (f[i] - min) / span)
  return f
}

// La rugosité de base à donner au matériau pour que la carte (qui ne creuse que)
// retombe en MOYENNE sur la valeur voulue par le préréglage. Plafonnée à 1 :
// au-delà de 0,937 de rugosité voulue, three écrête et la moyenne descend un peu
// — écart invisible, et le seul prix d'une carte 8 bits.
export const rugositeRecentree = (r) => Math.min(1, r / (1 - MICRO_ROUGH_CREUX / 2))

let _micro = null
export function microRoughnessTextures() {
  if (_micro) return _micro
  const f = microRoughnessField(MICRO_ROUGH_SIZE)
  const roughnessMap = canvasTex(
    (ctx, size) => {
      const img = ctx.createImageData(size, size)
      for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, Math.round(f[i] * 255)))
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
        img.data[i * 4 + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    },
    { size: MICRO_ROUGH_SIZE, repeat: 2 },
  )
  _micro = { roughnessMap }
  return _micro
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
