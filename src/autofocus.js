// Pointer autofocus: march a ray from the camera through the cursor until it
// crosses the terrain surface, and focus there. Cheap — it queries the height
// sampler instead of raycasting the million-triangle mesh. Pure & testable:
// pass an origin, a normalized direction, and a `heightAt(x, z)` sampler.

// Returns the distance from `origin` to the first surface crossing along `dir`,
// or null if the ray never dips below the terrain within `maxDist`.
// `dir` must be normalized. `halfExtent` bounds the patch in x/z.
export function focusRayHit(origin, dir, heightAt, { maxDist = 400, step = 2, minStep = 0.15, halfExtent = 28 } = {}) {
  // don't march a ray that points up and away — it can only miss
  let prevAbove = origin.y - heightAt(origin.x, origin.z)
  let t = 0
  let hit = null
  // a straight ray meets the square patch at most once. Only give up on the
  // march AFTER it has entered the patch and left again — bailing while still
  // outside would strand focus whenever the camera sits outside the patch
  // footprint (zoomed / orbited out, |x|>halfExtent or |z|>halfExtent), which
  // is most of the orbit range.
  let entered = Math.abs(origin.x) <= halfExtent + 4 && Math.abs(origin.z) <= halfExtent + 4
  while (t < maxDist) {
    // sphere-trace: big strides while far above the surface, fine steps as we
    // close in — so a razor ridge is never stepped over, and the far march is
    // cheap. The coarse bracket is cleaned up by the bisection below.
    const stepNow = Math.min(Math.max(Math.abs(prevAbove) * 0.5, minStep), step)
    t += stepNow
    const x = origin.x + dir.x * t
    const y = origin.y + dir.y * t
    const z = origin.z + dir.z * t
    const above = y - heightAt(x, z)
    // outside the patch bounds: keep approaching until we first reach it, then
    // stop once we've passed through — there is no surface left to hit
    if (Math.abs(x) > halfExtent + 4 || Math.abs(z) > halfExtent + 4) {
      if (entered) break
      prevAbove = above
      continue
    }
    entered = true
    if (above <= 0 && prevAbove > 0) {
      // crossed the surface within the last stride — bisect for a clean distance
      let lo = t - stepNow
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
