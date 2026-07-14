// Lake DETECTION over the DEM — the one survivor of the old glass-water
// system (the glass sea/lakes were removed in v37; src/ocean.js renders all
// water now and feeds on this detector).
//
// Find connected near-flat regions above sea level in the raw DEM (meters).
// Water surfaces are EXACTLY flat in the source data (sub-meter after tile
// resampling), while a loose tolerance on a smooth slope grows "contour
// bands" — connected strips along a level set that are not water at all.
// The strongest water signature is the ELEVATION SPREAD inside the region:
// a real lake is flat to centimetres even when it is a long mountain ribbon
// (Annecy is 14 km by 3 km), while a contour band spans its whole ±tol range
// (~2*tolM). So: truly flat regions are accepted whatever their shape, and
// only regions with real internal spread must also look like blobs, which
// kills the bands without killing elongated lakes. Pure — unit-tested.
export function detectLakes(dem, { tolM = 0.35, minCells = null, minFill = 0.25, flatM = 0.15 } = {}) {
  if (!dem || !dem.data) return []
  const { data, size } = dem
  // area floor: scales with the grid so it stays a constant fraction of the
  // map. 12 keeps mid-size alpine lakes (Annecy is ~150 cells on a 768 grid
  // at a 330 km view) while still dropping single-cell noise flats.
  const min = minCells ?? Math.max(30, Math.round((size / 256) ** 2 * 12))
  const visited = new Uint8Array(size * size)
  const lakes = []
  const stack = new Int32Array(size * size)
  for (let start = 0; start < size * size; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const h0 = data[start]
    if (h0 <= 1) continue // the sea owns everything at/below 0
    let top = 0
    stack[top++] = start
    const cells = []
    let minX = size,
      maxX = -1,
      minY = size,
      maxY = -1
    let minH = h0,
      maxH = h0
    const histo = new Map() // 0.1 m bins — see the mode test below
    while (top > 0) {
      const i = stack[--top]
      cells.push(i)
      const x = i % size
      const y = (i / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      const v = data[i]
      if (v < minH) minH = v
      if (v > maxH) maxH = v
      const q = Math.round(v * 10)
      histo.set(q, (histo.get(q) || 0) + 1)
      // 4-neighbourhood, same water surface = same elevation within tolerance
      if (x > 0 && !visited[i - 1] && Math.abs(data[i - 1] - h0) <= tolM) (visited[i - 1] = 1), (stack[top++] = i - 1)
      if (x < size - 1 && !visited[i + 1] && Math.abs(data[i + 1] - h0) <= tolM) (visited[i + 1] = 1), (stack[top++] = i + 1)
      if (y > 0 && !visited[i - size] && Math.abs(data[i - size] - h0) <= tolM)
        (visited[i - size] = 1), (stack[top++] = i - size)
      if (y < size - 1 && !visited[i + size] && Math.abs(data[i + size] - h0) <= tolM)
        (visited[i + size] = 1), (stack[top++] = i + size)
    }
    if (cells.length < min) continue
    // acceptance — water signature first, shape second:
    // · spread ≤ flatM: the surface is water-flat, accept ANY outline
    // · mode ≥ 60%: tile resampling wobbles a big lake's shoreline cells by
    //   up to ±tol (Léman spans the full 0.7 m at 160 km views, failing the
    //   spread test), but the BULK of a real lake still lands on one exact
    //   value — >60% of cells in a single 0.1 m bin. A contour band on a
    //   slope spreads uniformly across its range and never concentrates.
    // · otherwise fall back to the blob checks: a snaking band covers only a
    //   sliver of its bounding box (fill), a straight band is far thinner
    //   than a blob of the same area, whose narrow side ≈ √area (thinness)
    let modeCount = 0
    for (const c of histo.values()) if (c > modeCount) modeCount = c
    const watery = maxH - minH <= flatM || modeCount / cells.length >= 0.6
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const fill = cells.length / (w * h)
    const thin = Math.min(w, h) < 0.4 * Math.sqrt(cells.length)
    if (watery || (fill >= minFill && !thin)) lakes.push({ cells, elevM: h0, size })
  }
  return lakes
}
