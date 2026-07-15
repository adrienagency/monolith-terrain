// Turn a lat/lon polyline into terrain-hugging world geometry. Long segments are
// densified before height sampling so a line follows the hill between two far
// vertices instead of cutting straight through it.

export function densifyWorld(points, maxStep) {
  if (points.length < 2) return points.slice()
  const out = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.ceil(d / maxStep))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
  }
  out.push(points[points.length - 1])
  return out
}

export function drapeWorld(points, sample, offset) {
  const arr = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    arr[i * 3] = p.x
    arr[i * 3 + 1] = sample(p.x, p.z) + offset
    arr[i * 3 + 2] = p.z
  }
  return arr
}

// project a GeoJSON [lon,lat] ring to terrain world XZ via the loaded DEM
export function latlonToWorldPts(coords, dem, latLonToWorld) {
  return coords.map(([lon, lat]) => { const w = latLonToWorld(dem, lat, lon); return { x: w.x, z: w.z } })
}
