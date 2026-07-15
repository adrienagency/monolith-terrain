// The block footprint, in JS, so overlay lines can be clipped to exactly what the
// terrain shows. slabInside mirrors terrain.js's slab-corner discard (superellipse).

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
