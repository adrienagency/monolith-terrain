// Greedy zoom-tiered place selection with a spacing pass. `rows` must be sorted
// by prominence (population) descending — the build script does this — so the
// first accepted names are the most important.
export function pickPlaces(rows, { zoom, toWorld, halfLimit, maxN, minDist }) {
  const picks = []
  for (const [name, lat, lon, pop, cap, mz] of rows) {
    if ((mz ?? 0) > zoom) continue
    const w = toWorld(lat, lon)
    if (Math.abs(w.x) > halfLimit || Math.abs(w.z) > halfLimit) continue
    if (picks.some((p) => Math.hypot(p.w.x - w.x, p.w.z - w.z) < minDist)) continue
    picks.push({ name, w, pop, cap: !!cap })
    if (picks.length >= maxN) break
  }
  return picks
}
