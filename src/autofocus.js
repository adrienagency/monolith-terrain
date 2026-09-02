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

// ══════ LA MISE AU POINT SUR LA TERRE AFFICHÉE — Tâche R34 (règle D20) ══════
//
// Sous la fusion des passes, ce que l'œil regarde est TOUJOURS le globe : une
// sphère de rayon `rayon` (R_GLOBE = 100) portant le relief dessiné. On marche
// donc en ESPACE GLOBE, contre `rayonDessine(p)` — le rayon que le GPU dessine
// dans la direction de `p` (sphère + hauteur dessinée × unités par mètre) —
// et non contre le bloc plat : à z4 le bloc fait 7 000 km et la flèche de la
// sphère à son bord vaut ~960 km.
//
// ⚡ **LE VIDE N'EST PAS MARCHÉ.** Depuis 15 000 km, marcher à foulée bornée
// jusqu'au sol coûterait des centaines de lectures du relief par image. On
// SAUTE analytiquement jusqu'à la coque `rayon + coque` (l'Everest exagéré),
// et on ne marche qu'à l'intérieur — une vingtaine de lectures, testé.
//
// Rend la distance du premier croisement, ou `null` : ciel (le rayon passe à
// côté de la coque), ou caméra déjà SOUS la surface dessinée (mieux vaut garder
// la mise au point précédente que la poser à zéro).
export function focusRayHitGlobe(origin, dir, rayonDessine, { rayon = 100, coque = 0.5, pas = 0.25, pasMin = 1e-4, maxIter = 400, precision = 1e-5 } = {}) {
  const ox = origin.x, oy = origin.y, oz = origin.z
  const Rc = rayon + coque
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const c0 = ox * ox + oy * oy + oz * oz
  let t
  if (c0 <= Rc * Rc) {
    t = 0 // déjà sous la coque : on marche depuis la caméra
  } else {
    const disc = b * b - (c0 - Rc * Rc)
    if (disc < 0) return null // le rayon passe à côté
    t = -b - Math.sqrt(disc)
    if (t < 0) return null // la coque est derrière la caméra
  }
  const p = { x: 0, y: 0, z: 0 }
  // hauteur au-dessus de la surface DESSINÉE, au point `t` du rayon
  const dessus = (tt) => {
    p.x = ox + dir.x * tt; p.y = oy + dir.y * tt; p.z = oz + dir.z * tt
    return Math.hypot(p.x, p.y, p.z) - rayonDessine(p)
  }
  let prev = dessus(t)
  if (prev <= 0) return null // caméra sous la surface dessinée
  let tPrev = t
  for (let i = 0; i < maxIter; i++) {
    // sphere-trace : grande foulée loin de la surface, fine en approche — puis
    // une bissection nettoie l'encadrement (même geste que focusRayHit)
    const foulee = Math.min(Math.max(prev * 0.5, pasMin), pas)
    t += foulee
    const h = dessus(t)
    if (h <= 0) {
      // ⚠️ chaque itération est une LECTURE DU RELIEF (5 à 7 µs) : on s'arrête
      // dès que l'encadrement tient dans `precision` (1e-5 unité = 0,6 m)
      let lo = tPrev, hi = t
      for (let k = 0; k < 12 && hi - lo > precision; k++) {
        const mid = (lo + hi) / 2
        if (dessus(mid) <= 0) hi = mid
        else lo = mid
      }
      return hi
    }
    // ressorti de la coque en s'ÉLOIGNANT : plus rien à croiser
    if (Math.hypot(p.x, p.y, p.z) > Rc && p.x * dir.x + p.y * dir.y + p.z * dir.z > 0) return null
    prev = h
    tPrev = t
  }
  return null
}
