// Pure camera-pose helpers — no three.js, no DOM, so they're unit-testable.

// Vantage for framing a summit: the camera orbits just ABOVE the peak, pulled
// slightly outward along the radial from the patch center, looking down at the
// peak's top. Returns plain {pos:{x,y,z}, target:{x,y,z}}.
export function peakVantage(x, h, z, { rise = 5.6, standoff = 3.4 } = {}) {
  let dx = x
  let dz = z
  const len = Math.hypot(dx, dz)
  if (len < 1e-2) {
    dx = 0
    dz = 1 // a peak at the exact center still gets a defined vantage
  } else {
    dx /= len
    dz /= len
  }
  return {
    pos: { x: x + dx * standoff, y: h + rise, z: z + dz * standoff },
    target: { x, y: h + 0.3, z },
  }
}
