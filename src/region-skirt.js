// Region skirt — when the zone is isolated the relief is a bare cutout with no
// slab, so at the boundary you'd see straight under the (paper-thin) surface.
// This closes that: a vertical curtain that follows the mask silhouette, its top
// welded to the terrain surface height at every point along the cut and its foot
// dropped to a common base. A boundary running over a summit or through a trench
// therefore reads as a solid wall, never a see-through edge.
//
// Built by marching-squares tracing the mask's 0.5 iso-line in world space (the
// same iso the terrain shader discards on), so wall tops line up with the cut.
// Each iso-segment becomes one independent quad — no loop stitching needed. The
// mesh shares the plinth's wall material, so the socle PBR/glass finish applies
// to the isolated zone too.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

const HALF = TERRAIN_SIZE / 2

// Sample the mask's red channel at world XZ. Mirrors the terrain shader mapping
// rmUv = worldXZ / TERRAIN_SIZE + 0.5, with the mask CanvasTexture's flipY=false
// (region-mask.js) — a straight affine world→pixel map, no vertical flip.
function maskSampler(maskCanvas) {
  const size = maskCanvas.width
  const data = maskCanvas.getContext('2d').getImageData(0, 0, size, size).data
  return (x, z) => {
    const px = Math.round((x / TERRAIN_SIZE + 0.5) * size)
    const py = Math.round((z / TERRAIN_SIZE + 0.5) * size)
    if (px < 0 || py < 0 || px >= size || py >= size) return 0
    return data[(py * size + px) * 4]
  }
}

// Marching-squares iso-segments at `threshold` over a `grid`×`grid` world cell
// lattice spanning the DEM footprint. Returns [{ax,az,bx,bz}]. Winding is moot —
// each segment is extruded into a DoubleSide quad. Also returns the interior
// min terrain height so the caller can seat the base below every point.
export function traceSkirt({ maskCanvas, sample, grid = 300, threshold = 127 }) {
  const mask = maskSampler(maskCanvas)
  const step = TERRAIN_SIZE / grid
  const segs = []
  const lerp = (a, b, va, vb) => a + (b - a) * ((threshold - va) / (vb - va || 1))
  let interiorMin = Infinity
  for (let j = 0; j < grid; j++) {
    const z0 = -HALF + j * step
    const z1 = z0 + step
    for (let i = 0; i < grid; i++) {
      const x0 = -HALF + i * step
      const x1 = x0 + step
      const tl = mask(x0, z0)
      const tr = mask(x1, z0)
      const br = mask(x1, z1)
      const bl = mask(x0, z1)
      let c = 0
      if (tl >= threshold) c |= 8
      if (tr >= threshold) c |= 4
      if (br >= threshold) c |= 2
      if (bl >= threshold) c |= 1
      if (c === 0) continue
      if (c === 15) {
        // fully inside — track the lowest interior terrain point, sampled on a
        // coarse 1-in-16 stride (terrain.sample is the costly call here)
        if ((i & 3) === 0 && (j & 3) === 0) {
          const y = sample((x0 + x1) / 2, (z0 + z1) / 2)
          if (y < interiorMin) interiorMin = y
        }
        continue
      }
      const top = () => ({ x: lerp(x0, x1, tl, tr), z: z0 })
      const right = () => ({ x: x1, z: lerp(z0, z1, tr, br) })
      const bottom = () => ({ x: lerp(x0, x1, bl, br), z: z1 })
      const left = () => ({ x: x0, z: lerp(z0, z1, tl, bl) })
      const push = (a, b) => segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z })
      switch (c) {
        case 1: case 14: push(left(), bottom()); break
        case 2: case 13: push(bottom(), right()); break
        case 3: case 12: push(left(), right()); break
        case 4: case 11: push(top(), right()); break
        case 6: case 9: push(top(), bottom()); break
        case 7: case 8: push(left(), top()); break
        case 5: push(left(), top()); push(bottom(), right()); break // saddle
        case 10: push(top(), right()); push(left(), bottom()); break // saddle
      }
    }
  }
  return { segs, interiorMin: interiorMin === Infinity ? 0 : interiorMin }
}

// Build the skirt mesh. `material` is shared (the plinth wall material) so the
// socle finish carries over. `depth` seats the base below the lowest terrain.
//   buildRegionSkirt({ maskCanvas, sample, material, depth }) → { mesh } | null
export function buildRegionSkirt({ maskCanvas, sample, material, depth = 5, grid = 300 }) {
  if (!maskCanvas || !sample) return null
  const { segs, interiorMin } = traceSkirt({ maskCanvas, sample, grid })
  if (!segs.length) return null

  // top height at each boundary point = the terrain surface there; the wall foot
  // drops to a base below the lowest terrain anywhere in the zone so nothing
  // pokes out beneath it.
  let minTop = interiorMin
  for (const s of segs) {
    const ya = sample(s.ax, s.az)
    const yb = sample(s.bx, s.bz)
    s.ya = ya
    s.yb = yb
    if (ya < minTop) minTop = ya
    if (yb < minTop) minTop = yb
  }
  const baseY = minTop - depth

  const positions = []
  const normals = []
  const pushTri = (a, b, cc) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(cc, a)
    const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
    for (const v of [a, b, cc]) {
      positions.push(v.x, v.y, v.z)
      normals.push(nm.x, nm.y, nm.z)
    }
  }
  const EPS = 0.05 // lift the wall top a hair so it overlaps the surface (no seam)
  for (const s of segs) {
    const aTop = new THREE.Vector3(s.ax, s.ya + EPS, s.az)
    const bTop = new THREE.Vector3(s.bx, s.yb + EPS, s.bz)
    const aBot = new THREE.Vector3(s.ax, baseY, s.az)
    const bBot = new THREE.Vector3(s.bx, baseY, s.bz)
    pushTri(aTop, aBot, bTop)
    pushTri(bTop, aBot, bBot)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'region-skirt'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, baseY }
}
