// The block footprint, in JS, so overlay lines can be clipped to exactly what the
// terrain shows. slabInside mirrors terrain.js's slab-corner discard (superellipse).

import * as THREE from 'three'

export function slabInside(x, z, half, corner, cornerN) {
  if (Math.abs(x) > half || Math.abs(z) > half) return false
  if (corner <= 0) return true
  const qx = Math.max(Math.abs(x) - (half - corner), 0)
  const qz = Math.max(Math.abs(z) - (half - corner), 0)
  if (qx === 0 && qz === 0) return true
  const pn = Math.pow(Math.pow(qx, cornerN) + Math.pow(qz, cornerN), 1 / cornerN)
  return pn <= corner
}

// insideBlock predicate = slab AND (region mask when a region cutout is active)
export function makeInsideBlock({ half, corner, cornerN, regionOn, regionSample }) {
  if (regionOn && regionSample) {
    return (x, z) => slabInside(x, z, half, corner, cornerN) && regionSample(x, z) >= 0.5
  }
  return (x, z) => slabInside(x, z, half, corner, cornerN)
}

// Clip a world-space polyline to the block: densify to `step`, keep contiguous
// inside-runs, and bisect each in/out crossing so the run end sits on the edge.
export function clipPolylineToBlock(pts, insideBlock, step = 0.6, bisect = 7) {
  if (pts.length < 2) return pts.length && insideBlock(pts[0].x, pts[0].z) ? [] : []
  const dense = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.ceil(d / step))
    for (let k = 0; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
  }
  dense.push(pts[pts.length - 1])

  const boundary = (inPt, outPt) => {
    let lo = inPt, hi = outPt
    for (let i = 0; i < bisect; i++) {
      const mid = { x: (lo.x + hi.x) / 2, z: (lo.z + hi.z) / 2 }
      if (insideBlock(mid.x, mid.z)) lo = mid; else hi = mid
    }
    return lo
  }
  const runs = []
  let run = null, prev = null, prevIn = false
  for (const p of dense) {
    const inside = insideBlock(p.x, p.z)
    if (inside) {
      if (!prevIn && prev) { run = [boundary(p, prev)] }
      else if (!run) run = []
      run.push(p)
    } else if (prevIn && run) {
      run.push(boundary(prev, p))
      if (run.length >= 2) runs.push(run)
      run = null
    }
    prev = p; prevIn = inside
  }
  if (run && run.length >= 2) runs.push(run)
  return runs
}

// The slab superellipse (fp.half/corner/cornerN — region cutout NOT included,
// see makeInsideBlock) as a convex polygon, for use as a Sutherland-Hodgman
// clip window. Built by ray-marching from the origin: for each of `n` angles,
// bisect along the ray (same idea as clipPolylineToBlock's boundary()) to find
// where slabInside flips inside->outside. Every sampled point is ON the true
// boundary to within bisection precision, so the polygon is INSCRIBED in the
// real superellipse — i.e. conservative, never outside it. That's the whole
// point: clipping against this polygon can only pull geometry further inside
// the block, never let it stick out. Returned ring is closed (first === last),
// matching the GeoJSON ring convention used elsewhere in this file, and wound
// counter-clockwise in the (x,z) plane (theta increasing).
export function blockOutline(fp, n = 192, bisect = 30) {
  const { half, corner, cornerN } = fp
  const maxR = Math.SQRT2 * half + 1
  const out = []
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2
    const dx = Math.cos(theta), dz = Math.sin(theta)
    let lo = 0, hi = maxR
    for (let k = 0; k < bisect; k++) {
      const mid = (lo + hi) / 2
      if (slabInside(dx * mid, dz * mid, half, corner, cornerN)) lo = mid; else hi = mid
    }
    out.push({ x: dx * lo, z: dz * lo })
  }
  out.push({ x: out[0].x, z: out[0].z })
  return out
}

// Drop a closing duplicate vertex (ring[0] === ring[last]) if present, so
// clip math below can work with a plain open vertex loop.
function _open(ring) {
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1]
    if (a.x === b.x && a.z === b.z) return ring.slice(0, -1)
  }
  return ring
}

function _close(ring) {
  return ring.length ? [...ring, { x: ring[0].x, z: ring[0].z }] : ring
}

// Segment/segment intersection of (p1,p2) against the infinite line through
// (a,b) — used only where callers already know the segments cross.
function _intersect(p1, p2, a, b) {
  const denom = (p1.x - p2.x) * (a.z - b.z) - (p1.z - p2.z) * (a.x - b.x)
  if (Math.abs(denom) < 1e-12) return { x: p2.x, z: p2.z }
  const t = ((p1.x - a.x) * (a.z - b.z) - (p1.z - a.z) * (a.x - b.x)) / denom
  return { x: p1.x + t * (p2.x - p1.x), z: p1.z + t * (p2.z - p1.z) }
}

// Sutherland-Hodgman clip of `poly` (array of {x,z}, closed or open ring)
// against `outline` (a CONVEX closed ring, e.g. from blockOutline — this
// algorithm is only valid against a convex clip window). Returns a closed
// polygon [{x,z},...], or [] if fully clipped away or degenerate (<3 verts).
// A polygon entirely inside `outline` is returned with its original vertices
// (no vertices inserted) since every clip-edge pass is a no-op.
export function clipPolygonToBlock(poly, outline) {
  let subject = _open(poly)
  const clip = _open(outline)
  if (subject.length < 3 || clip.length < 3) return []

  for (let i = 0; i < clip.length && subject.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length]
    const edgeX = b.x - a.x, edgeZ = b.z - a.z
    const inside = (p) => edgeX * (p.z - a.z) - edgeZ * (p.x - a.x) >= 0
    const output = []
    for (let j = 0; j < subject.length; j++) {
      const curr = subject[j]
      const prev = subject[(j - 1 + subject.length) % subject.length]
      const currIn = inside(curr), prevIn = inside(prev)
      if (currIn) {
        if (!prevIn) output.push(_intersect(prev, curr, a, b))
        output.push(curr)
      } else if (prevIn) {
        output.push(_intersect(prev, curr, a, b))
      }
    }
    subject = output
  }
  return subject.length < 3 ? [] : _close(subject)
}

// Triangulate a (possibly concave, with holes) polygon and clip EACH
// resulting triangle to the block outline individually, rather than
// clipping the whole polygon first and triangulating whatever survives.
//
// Order matters: Sutherland-Hodgman (clipPolygonToBlock, above) is only
// exact when the SUBJECT is convex, same as the clip window. A concave
// subject — e.g. a river polygon that leaves the block and re-enters it —
// clipped whole can come back as a single ring that bridges two separate
// inside-runs with a straight edge hugging the clip boundary; a downstream
// triangulator then treats that ring as an ordinary simple polygon and
// happily fills the bogus bridge, painting water where the river never
// went. A single triangle is always convex, so clipping triangle-by-
// triangle AFTER triangulating the ORIGINAL polygon (holes correctly
// excluded by earcut, exactly as GeoJSON intends) can't produce that
// failure — each individual triangle clip is exact.
//
// `outer`/`holes` are arrays of {x,z} world-space points (open or closed
// GeoJSON-ring convention, either winding — one polygon "part" of a
// Polygon/MultiPolygon geometry). `outline` is a convex closed ring (e.g.
// from blockOutline()). Returns an array of small convex polygons
// ({x,z}[], closed, 3-7 verts), one per surviving clipped triangle —
// fan-triangulate each for rendering. Every point in every returned polygon
// satisfies slabInside (clipPolygonToBlock's containment guarantee, now
// applied per-triangle instead of once for the whole subject).
export function triangulateAndClip(outer, holes, outline) {
  if (!outer || outer.length < 3) return []
  const outerV2 = outer.map((p) => new THREE.Vector2(p.x, p.z))
  const holesV2 = (holes || []).filter((h) => h && h.length >= 3).map((h) => h.map((p) => new THREE.Vector2(p.x, p.z)))
  const tris = THREE.ShapeUtils.triangulateShape(outerV2, holesV2)
  if (!tris.length) return []
  // triangulateShape MUTATES outerV2 and each ring in holesV2 in place
  // (drops a trailing vertex that duplicates the first one) before indexing
  // into them concatenated in that order — build the lookup after calling
  // it, not before, or the indices point at the wrong vertices.
  const allVerts = outerV2.concat(...holesV2)
  const out = []
  for (const [ia, ib, ic] of tris) {
    const triPts = [allVerts[ia], allVerts[ib], allVerts[ic]].map((v) => ({ x: v.x, z: v.y }))
    const clipped = clipPolygonToBlock(triPts, outline)
    if (clipped.length >= 3) out.push(clipped)
  }
  return out
}
