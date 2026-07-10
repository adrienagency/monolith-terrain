// Region plate — the thin base the cut landform sits on in region mode, like
// the reference country-relief posters: not the full square slab, not floating
// on nothing, but a plate FITTED to the landform with a small margin.
//
//  · footprint = axis-aligned bbox of the WHITE pixels of the region mask
//    (region-mask.js canvas), expanded by a margin (default 6% of the bbox
//    diagonal), with the same superellipse rounded corners as the main slab
//  · thin prism: top at `topY` (provided by the caller — see buildRegionPlate),
//    walls dropping `height` world units, closed bottom cap
//  · material matches the plinth walls (plinth.js): matte stone in
//    params.plinthColor, DoubleSide so no angle sees through the slab
//
// Pure helpers (computeMaskBBoxPx, bboxPxToWorld, superellipseRectContour) are
// exported and unit-tested; only buildRegionPlate touches the DOM (canvas).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

export const PLATE_HEIGHT = 1.2 // world units, default plate thickness
export const PLATE_MARGIN = 0.06 // default margin, fraction of bbox diagonal

// ---------------------------------------------------------------- pure helpers

// Axis-aligned bbox of the mask's white pixels. `data` is RGBA (ImageData.data
// layout), `size` the square canvas edge. Row/col prepass keeps it O(n) with
// early-out scans. Returns { minX, minY, maxX, maxY } in pixels, or null when
// the mask is entirely black.
export function computeMaskBBoxPx(data, size, threshold = 127) {
  let minX = size
  let minY = size
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < size; y++) {
    const row = y * size
    for (let x = 0; x < size; x++) {
      if (data[(row + x) * 4] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}

// mask-pixel bbox → world XZ bbox over the DEM footprint (same mapping the
// shader uses: px 0 → -TERRAIN_SIZE/2, px size → +TERRAIN_SIZE/2), expanded by
// `margin` × the bbox diagonal on every side.
export function bboxPxToWorld(bboxPx, size, margin = PLATE_MARGIN) {
  const toW = (p) => (p / size - 0.5) * TERRAIN_SIZE
  let minX = toW(bboxPx.minX)
  let maxX = toW(bboxPx.maxX + 1)
  let minZ = toW(bboxPx.minY)
  let maxZ = toW(bboxPx.maxY + 1)
  const diag = Math.hypot(maxX - minX, maxZ - minZ)
  const m = diag * margin
  minX -= m
  maxX += m
  minZ -= m
  maxZ += m
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  }
}

// Closed clockwise contour of a rounded rectangle in the XZ plane, centered on
// the origin: straight edges plus superellipse corner fillets — the same curve
// family as the main slab clip (terrain.js) and the plinth ring (plinth.js):
// point = corner center + r·(sgn·|cos a|^(2/n), sgn·|sin a|^(2/n)).
// r is clamped to the half-extents; n = 2 gives circular arcs.
export function superellipseRectContour(halfW, halfD, r, n = 2, cornerSegments = 16) {
  const rr = Math.max(0, Math.min(r, Math.min(halfW, halfD) * 0.98))
  const pts = []
  if (rr <= 1e-6) {
    pts.push({ x: -halfW, z: -halfD }, { x: halfW, z: -halfD }, { x: halfW, z: halfD }, { x: -halfW, z: halfD })
    return pts
  }
  const iw = halfW - rr
  const id = halfD - rr
  const expo = Math.max(2, n)
  const arc = (cx, cz, a0, a1) => {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + ((a1 - a0) * i) / cornerSegments
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      pts.push({
        x: cx + Math.sign(ca) * Math.pow(Math.abs(ca), 2 / expo) * rr,
        z: cz + Math.sign(sa) * Math.pow(Math.abs(sa), 2 / expo) * rr,
      })
    }
  }
  arc(iw, -id, -Math.PI / 2, 0) // corner +x −z
  arc(iw, id, 0, Math.PI / 2) // corner +x +z
  arc(-iw, id, Math.PI / 2, Math.PI) // corner −x +z
  arc(-iw, -id, Math.PI, Math.PI * 1.5) // corner −x −z
  return pts
}

// ---------------------------------------------------------------- geometry

// prism from a convex closed contour: vertical walls topY→topY-height, flat
// top and bottom caps (triangle fans — the rounded rect is convex). Flat
// normals per face, same construction style as the plinth walls.
function prismGeometry(contour, topY, height) {
  const botY = topY - height
  const positions = []
  const normals = []
  const pushTri = (a, b, c) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(c, a)
    const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
    for (const v of [a, b, c]) {
      positions.push(v.x, v.y, v.z)
      normals.push(nm.x, nm.y, nm.z)
    }
  }
  const n = contour.length
  let cx = 0
  let cz = 0
  for (const p of contour) {
    cx += p.x
    cz += p.z
  }
  cx /= n
  cz /= n
  const cenTop = new THREE.Vector3(cx, topY, cz)
  const cenBot = new THREE.Vector3(cx, botY, cz)
  for (let i = 0; i < n; i++) {
    const p = contour[i]
    const q = contour[(i + 1) % n]
    const pTop = new THREE.Vector3(p.x, topY, p.z)
    const qTop = new THREE.Vector3(q.x, topY, q.z)
    const pBot = new THREE.Vector3(p.x, botY, p.z)
    const qBot = new THREE.Vector3(q.x, botY, q.z)
    // wall (outward-facing for a clockwise-in-XZ contour; DoubleSide anyway)
    pushTri(pTop, pBot, qTop)
    pushTri(qTop, pBot, qBot)
    // caps
    pushTri(cenTop, qTop, pTop)
    pushTri(cenBot, new THREE.Vector3(p.x, botY, p.z), new THREE.Vector3(q.x, botY, q.z))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------- public API

// Build the fitted plate under the cut landform.
//   buildRegionPlate({ maskCanvas, params, topY, height, margin })
//     → { mesh, bboxWorld } | null (mask entirely black)
//
//  · maskCanvas — the canvas returned by fetchRegionMask (maskCanvas) — white
//    pixels define the landform footprint
//  · params    — app params; reads slabCorner, slabCornerSmoothing (corner
//    styling, radius scaled to the plate's smaller side) and plinthColor
//  · topY      — WORLD y of the plate's TOP face, provided by the caller.
//    Recommended: terrain.mapUniforms.uSeaY.value - 0.02 (sea level, a hair
//    down to avoid z-fighting) — the land-clipped mask guarantees the landform
//    sits at/above sea level, so the plate top tucks just under its underside.
//  · height    — plate thickness in world units (default PLATE_HEIGHT = 1.2)
//  · margin    — default PLATE_MARGIN = 0.06 × bbox diagonal
//
// The mesh is positioned in absolute world coordinates (add to scene as-is).
// Dispose with mesh.geometry.dispose() and mesh.material.dispose() when
// replacing it (new region / region mode off).
export function buildRegionPlate({ maskCanvas, params = {}, topY = 0, height = PLATE_HEIGHT, margin = PLATE_MARGIN }) {
  const size = maskCanvas.width
  const ctx = maskCanvas.getContext('2d')
  const data = ctx.getImageData(0, 0, size, size).data
  const bboxPx = computeMaskBBoxPx(data, size)
  if (!bboxPx) return null
  const bboxWorld = bboxPxToWorld(bboxPx, size, margin)

  const halfW = bboxWorld.width / 2
  const halfD = bboxWorld.depth / 2
  // corner radius follows the slab styling but scales with the PLATE's smaller
  // side (the main slab scales it with TERRAIN_SIZE)
  const r = (params.slabCorner ?? 0) * Math.min(bboxWorld.width, bboxWorld.depth)
  const n = 2 + (params.slabCornerSmoothing ?? 0) * 4
  const contour = superellipseRectContour(halfW, halfD, r, n)

  const geo = prismGeometry(contour, 0, height)
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.plinthColor ?? '#d8d4cc'),
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'region-plate'
  mesh.position.set(bboxWorld.centerX, topY, bboxWorld.centerZ)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, bboxWorld }
}
