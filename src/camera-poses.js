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

// ══════ UNE POSE SE VÉRIFIE À L'ENTRÉE — R35 ══════════════════════════════
//
// `flyTo(pos, target)` (main.js) prend deux `Vector3` ; son homonyme
// `modes.flyTo(lat, lon, zoom)` prend des nombres. Appelé avec les seconds,
// `Vector3.copy(nombre)` rend `NaN` en silence et la caméra ne revient jamais
// (rapport-R35.md). Une pose est un {x, y, z} FINI, rien d'autre : sinon on
// échoue ici, bruyamment, en nommant l'appel juste.
export function estPose(v) {
  return !!v && typeof v === 'object' && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}
export function exigerPose(v, nom = 'pose') {
  if (estPose(v)) return v
  const recu = typeof v === 'number' ? `le nombre ${v}` : v == null ? String(v) : typeof v
  throw new TypeError(`${nom} : une pose {x, y, z} finie est attendue, reçu ${recu} — pour un lat/lon, appeler modes.flyTo(lat, lon, zoom)`)
}
