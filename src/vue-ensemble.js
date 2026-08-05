// Pure helper pour la pose caméra de fin de course — pas de three.js, pas de
// DOM, testable en isolation (voir test/vue-ensemble.test.js).

// Direction isométrique vraie : azimut 45° (également écarté sur x et z) et
// site atan(1/√2) ≈ 35,264° — la projection isométrique canonique, pas une
// approximation. Précalculée une fois : x et z partagent la même composante
// horizontale par symétrie du 45°, y sort du rapport 1/√2 propre à l'iso.
const _ISO = (() => {
  const site = Math.atan(1 / Math.SQRT2)
  const horiz = Math.cos(site) * Math.SQRT1_2 // répartie à parts égales entre x et z
  return { x: horiz, y: Math.sin(site), z: horiz }
})()

// Calcule la pose (position + cible) qui cadre tout le tracé `pts` (tableau
// de {x,y,z}) vue depuis l'isométrique, avec une marge autour de la sphère
// englobante. Retourne null si le tracé est vide (rien à cadrer).
export function poseIsometrique(pts, { fovDeg = 30, marge = 1.35 } = {}) {
  if (!pts || !pts.length) return null

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }
  const cible = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 }
  const rayon = Math.max(
    1e-6, // évite une distance nulle sur un tracé réduit à un point
    Math.hypot(maxX - cible.x, maxY - cible.y, maxZ - cible.z)
  )
  const distance = (rayon * marge) / Math.tan(degToRad(fovDeg / 2))

  const position = {
    x: cible.x + _ISO.x * distance,
    y: cible.y + _ISO.y * distance,
    z: cible.z + _ISO.z * distance,
  }
  return { position, cible, distance }
}

function degToRad(deg) {
  return (deg * Math.PI) / 180
}
