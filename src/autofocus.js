// Pointer autofocus: march a ray from the camera through the cursor until it
// crosses the terrain surface, and focus there. Cheap — it queries the height
// sampler instead of raycasting the million-triangle mesh. Pure & testable:
// pass an origin, a normalized direction, and a `heightAt(x, z)` sampler.

// Returns the distance from `origin` to the first surface crossing along `dir`,
// or null if the ray never dips below the terrain within `maxDist`.
// `dir` must be normalized. `halfExtent` bounds the patch in x/z.
export function focusRayHit(origin, dir, heightAt, { maxDist = 400, step = 0.6, halfExtent = 28 } = {}) {
  // don't march a ray that points up and away — it can only miss
  let prevAbove = origin.y - heightAt(origin.x, origin.z)
  let t = 0
  let hit = null
  while (t < maxDist) {
    t += step
    const x = origin.x + dir.x * t
    const y = origin.y + dir.y * t
    const z = origin.z + dir.z * t
    // once well outside the patch there is no surface to hit
    if (Math.abs(x) > halfExtent + 4 || Math.abs(z) > halfExtent + 4) {
      if (t > step * 2) break
      continue
    }
    const above = y - heightAt(x, z)
    if (above <= 0 && prevAbove > 0) {
      // crossed the surface between t-step and t — bisect for a clean distance
      let lo = t - step
      let hi = t
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2
        const my = origin.y + dir.y * mid
        const mAbove = my - heightAt(origin.x + dir.x * mid, origin.z + dir.z * mid)
        if (mAbove <= 0) hi = mid
        else lo = mid
      }
      hit = hi
      break
    }
    prevAbove = above
  }
  return hit
}
