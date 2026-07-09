// Water as GLASS — two kinds:
//  · the SEA: a transparent slab of physical glass filling everything below
//    sea level (elevation 0). Real PBR transmission shows the bathymetry
//    through it, the environment reflects off its polished top, and islands
//    pierce the surface. Clipped to the slab's superellipse footprint.
//  · ALTITUDE LAKES: real lakes sit perfectly FLAT in the DEM, so connected
//    flat regions above sea level are detected by flood fill and each gets a
//    thin glass sheet at its own elevation (mountain lakes, reservoirs…).
// Shared controls: colour, blur (frosted ↔ clear) and clarity (how far light
// travels before the water tint absorbs it — shallow reads clear, deep tinted).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

// ---------------------------------------------------------- lake detection
// Find connected near-flat regions above sea level in the raw DEM (meters).
// Water surfaces are EXACTLY flat in the source data (sub-meter after tile
// resampling), while a loose tolerance on a smooth slope grows "contour
// bands" — connected strips along a level set that are not water at all. So:
// tight tolerance + a compactness check (lakes are blobs, bands are strips).
// Pure — unit-tested.
export function detectLakes(dem, { tolM = 0.35, minCells = null, minFill = 0.25 } = {}) {
  if (!dem || !dem.data) return []
  const { data, size } = dem
  const min = minCells ?? Math.max(30, Math.round((size / 256) ** 2 * 25))
  const visited = new Uint8Array(size * size)
  const lakes = []
  const stack = new Int32Array(size * size)
  for (let start = 0; start < size * size; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const h0 = data[start]
    if (h0 <= 1) continue // the sea block owns everything at/below 0
    // quick reject: flood only from cells whose right/down neighbours are level
    let top = 0
    stack[top++] = start
    const cells = []
    let minX = size,
      maxX = -1,
      minY = size,
      maxY = -1
    while (top > 0) {
      const i = stack[--top]
      cells.push(i)
      const x = i % size
      const y = (i / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      // 4-neighbourhood, same water surface = same elevation within tolerance
      if (x > 0 && !visited[i - 1] && Math.abs(data[i - 1] - h0) <= tolM) (visited[i - 1] = 1), (stack[top++] = i - 1)
      if (x < size - 1 && !visited[i + 1] && Math.abs(data[i + 1] - h0) <= tolM) (visited[i + 1] = 1), (stack[top++] = i + 1)
      if (y > 0 && !visited[i - size] && Math.abs(data[i - size] - h0) <= tolM)
        (visited[i - size] = 1), (stack[top++] = i - size)
      if (y < size - 1 && !visited[i + size] && Math.abs(data[i + size] - h0) <= tolM)
        (visited[i + size] = 1), (stack[top++] = i + size)
    }
    if (cells.length < min) continue
    // shape checks — lakes are blobs, contour bands along slopes are strips:
    // · a snaking band covers only a sliver of its bounding box (fill)
    // · a straight band fills its box but is far thinner than a blob of the
    //   same area, whose narrow side ≈ √area (thinness)
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const fill = cells.length / (w * h)
    const thin = Math.min(w, h) < 0.4 * Math.sqrt(cells.length)
    if (fill >= minFill && !thin) lakes.push({ cells, elevM: h0, size })
  }
  return lakes
}

function glassMaterial(params) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.lakeColor ?? '#8fc6e8'),
    transmission: 1, // full glass — see straight through
    roughness: params.lakeRoughness ?? 0.08, // = the blur of the glass
    metalness: 0,
    ior: 1.33, // water
    envMapIntensity: 1.1, // the environment reflects in the surface
    // depth absorption: light travelling through the volume takes the water
    // tint — shallow water reads clear, deep water saturates (the "clarity")
    attenuationColor: new THREE.Color(params.lakeColor ?? '#8fc6e8'),
    attenuationDistance: params.lakeClarity ?? 12,
    depthWrite: false,
  })
}

// what the polished surface mirrors — 'studio' is the scene's default room
// light; the gradients are tiny equirect skies (auto-PMREMed by the renderer)
export const REFLECTION_TYPES = ['studio', 'sky', 'sunset', 'mirror', 'none']

function gradientSky(top, horizon, bottom) {
  const w = 64
  const h = 32
  const data = new Uint8Array(w * h * 4)
  const cTop = new THREE.Color(top)
  const cHor = new THREE.Color(horizon)
  const cBot = new THREE.Color(bottom)
  const c = new THREE.Color()
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1) // 0 = zenith … 1 = nadir on the equirect
    if (t < 0.5) c.lerpColors(cTop, cHor, t * 2)
    else c.lerpColors(cHor, cBot, (t - 0.5) * 2)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      data[o] = Math.round(c.r * 255)
      data[o + 1] = Math.round(c.g * 255)
      data[o + 2] = Math.round(c.b * 255)
      data[o + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export class Lake {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'lake'
    scene.add(this.group)

    // sea block and altitude sheets need different `thickness` (a material
    // property in three), so they get separate materials
    this.seaMat = glassMaterial(params)
    this.lakeMat = glassMaterial(params)
    this.lakeMat.thickness = 0.6

    // clip the sea block to the slab's superellipse footprint, like the terrain
    const half = TERRAIN_SIZE / 2
    const r = (params.slabCorner ?? 0) * TERRAIN_SIZE
    const n = 2 + (params.slabCornerSmoothing ?? 0) * 4
    this.seaMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vLakeWorld;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  {
    vec2 cq = max(abs(vLakeWorld.xz) - vec2(${(half - r).toFixed(3)}), 0.0);
    float pn = pow(pow(cq.x, ${n.toFixed(2)}) + pow(cq.y, ${n.toFixed(2)}), 1.0 / ${n.toFixed(2)});
    if (pn > ${r.toFixed(3)}) discard;
  }`
        )
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vLakeWorld;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLakeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    }

    // real-size geometry, never a scaled unit box: three multiplies `thickness`
    // by the mesh's model scale for the refraction/absorption ray, so a box
    // scaled ~120× in x/z gets a kilometric light path and tints to black
    this.sea = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.seaMat)
    this.sea.renderOrder = 3
    this.sea.visible = false
    this.group.add(this.sea)

    this.lakeMeshes = []
    this.updateMaterial(params) // normalize ior/reflections to the params
  }

  // rebuild everything for the current zone: the sea block up to elevation 0,
  // and one glass sheet per detected altitude lake
  rebuild({ seaY, baseY, dem, params }) {
    // --- sea block
    if (!params.lakeEnabled || seaY < -9000 || seaY <= baseY + 0.1) {
      this.sea.visible = false
    } else {
      const bottom = baseY + 0.05
      const top = seaY - 0.015 // a hair under the coastline so the shore stays crisp
      this.sea.geometry.dispose()
      this.sea.geometry = new THREE.BoxGeometry(TERRAIN_SIZE * 0.998, top - bottom, TERRAIN_SIZE * 0.998)
      this.sea.position.set(0, (top + bottom) / 2, 0)
      // absorption path length — capped: the seabed's own depth-graded ramp
      // already paints deep vs shallow, and a full-box path powers the tint
      // to black on deep-ocean zones
      this.seaMat.thickness = Math.min(4, Math.max(0.5, top - bottom))
      this.sea.visible = true
    }

    // --- altitude lakes
    for (const m of this.lakeMeshes) {
      m.geometry.dispose()
      this.group.remove(m)
    }
    this.lakeMeshes = []
    if (!params.lakeEnabled || !params.lakesAltitude || !dem) return

    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const lakes = detectLakes(dem)
    for (const lake of lakes) {
      const { cells, elevM, size } = lake
      const cell = TERRAIN_SIZE / size
      // one flat quad per DEM cell, merged into a single sheet at the lake's
      // elevation — raised past the fine-detail grain so it stays underwater
      const y = (elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6
      const pos = new Float32Array(cells.length * 18)
      let o = 0
      for (const i of cells) {
        const cx = ((i % size) / size - 0.5) * TERRAIN_SIZE
        const cz = (((i / size) | 0) / size - 0.5) * TERRAIN_SIZE
        const x0 = cx,
          x1 = cx + cell,
          z0 = cz,
          z1 = cz + cell
        pos.set([x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0], o)
        o += 18
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const normals = new Float32Array(pos.length)
      for (let k = 1; k < normals.length; k += 3) normals[k] = 1
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, this.lakeMat)
      mesh.renderOrder = 3
      this.group.add(mesh)
      this.lakeMeshes.push(mesh)
    }
  }

  updateMaterial(params) {
    const rough = params.lakeRoughness ?? 0.08
    // near-clear glass must NOT distort what's underneath: ior 1 sends the
    // transmission ray straight through (zero bend, tint/absorption intact),
    // and the water ior only fades back in with the frosted look
    const bend = Math.min(1, Math.max(0, (rough - 0.02) / 0.13))
    const refl = this._reflection(params.lakeReflection ?? 'studio')
    for (const mat of [this.seaMat, this.lakeMat]) {
      mat.color.set(params.lakeColor ?? '#8fc6e8')
      mat.attenuationColor.set(params.lakeColor ?? '#8fc6e8')
      mat.roughness = rough
      mat.attenuationDistance = params.lakeClarity ?? 30
      mat.ior = 1 + 0.33 * bend
      mat.envMap = refl.map // null falls back to scene.environment
      mat.envMapIntensity = refl.intensity
    }
  }

  // reflection presets — gradient skies are built once and cached
  _reflection(type) {
    if (!this._skies) this._skies = {}
    const sky = (key, top, hor, bot) => (this._skies[key] ??= gradientSky(top, hor, bot))
    switch (type) {
      case 'sky':
        return { map: sky('sky', '#7db8e8', '#dceefb', '#f5fafe'), intensity: 1.4 }
      case 'sunset':
        return { map: sky('sunset', '#31406e', '#ff9e5e', '#ffd9a0'), intensity: 1.5 }
      case 'mirror': // the studio room, pushed hard — chrome-like water
        return { map: null, intensity: 2.6 }
      case 'none':
        return { map: null, intensity: 0 }
      default: // 'studio' — the scene's room light
        return { map: null, intensity: 1.1 }
    }
  }

  setVisible(v) {
    this.group.visible = v
  }
}
