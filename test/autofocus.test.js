import { test } from 'node:test'
import assert from 'node:assert/strict'
import { focusRayHit } from '../src/autofocus.js'

const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

test('a ray straight down hits a flat surface at the camera height', () => {
  const flat = () => 0
  const hit = focusRayHit({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, flat, { halfExtent: 28 })
  assert.ok(Math.abs(hit - 10) < 0.05, `expected ~10, got ${hit}`)
})

test('an angled ray hits farther away than a vertical one', () => {
  const flat = () => 0
  const straight = focusRayHit({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, flat)
  const angled = focusRayHit({ x: 0, y: 10, z: 0 }, norm({ x: 0.6, y: -1, z: 0 }), flat)
  assert.ok(angled > straight, `angled ${angled} should exceed straight ${straight}`)
})

test('a ray pointing up and away never hits (miss → null)', () => {
  const flat = () => 0
  const hit = focusRayHit({ x: 0, y: 10, z: 0 }, norm({ x: 0.2, y: 1, z: 0 }), flat)
  assert.equal(hit, null)
})

test('the hit tracks a raised surface — closer focus over a hill', () => {
  const flatHit = focusRayHit({ x: 0, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, () => 0)
  const hillHit = focusRayHit({ x: 0, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, () => 8)
  assert.ok(hillHit < flatHit, 'a hill under the cursor pulls focus nearer')
  assert.ok(Math.abs(hillHit - 12) < 0.1, `expected ~12 (20-8), got ${hillHit}`)
})

test('a ray leaving the patch without crossing returns null', () => {
  // camera low, ray nearly horizontal over a flat floor it never reaches
  const hit = focusRayHit({ x: -28, y: 0.5, z: 0 }, norm({ x: 1, y: 0.02, z: 0 }), () => 0, { halfExtent: 28 })
  assert.equal(hit, null)
})

// ══════════ LA MISE AU POINT SUR LA TERRE AFFICHÉE — Tâche R34 (règle D20) ═══
//
// Sous la fusion des passes, ce que l'œil regarde est TOUJOURS le globe : une
// sphère de rayon R_GLOBE portant le relief dessiné. La marche se fait donc en
// espace globe, contre `rayonDessine(p)` — le rayon que le GPU dessine dans la
// direction de `p` —, et non contre le bloc plat : à z4 (bloc de 7 000 km) la
// flèche de la sphère au bord du bloc vaut ~960 km, et un rayon marché sur le
// plan posait le focus sous la courbure.
import { focusRayHitGlobe } from '../src/autofocus.js'

const sphere = () => 100
const o = (x, y, z) => ({ x, y, z })

test('globe : un rayon vers le centre depuis 200 unités touche la sphère lisse à 100', () => {
  const t = focusRayHitGlobe(o(0, 0, 200), o(0, 0, -1), sphere, { rayon: 100, coque: 0.5 })
  assert.ok(Math.abs(t - 100) < 1e-3, `attendu 100, obtenu ${t}`)
})

test('globe : la distance est ANALYTIQUE sur un rayon oblique (sphère lisse)', () => {
  const org = o(0, 0, 200)
  const d = norm({ x: 0.3, y: 0.2, z: -1 })
  const t = focusRayHitGlobe(org, d, sphere, { rayon: 100, coque: 0.5 })
  // t = −b − √(b² − (|o|² − R²))
  const b = org.z * d.z
  const attendu = -b - Math.sqrt(b * b - (200 * 200 - 100 * 100))
  assert.ok(Math.abs(t - attendu) < 1e-3, `attendu ${attendu}, obtenu ${t}`)
})

test('globe : un rayon qui passe à côté de la planète rend null (ciel)', () => {
  const t = focusRayHitGlobe(o(0, 0, 200), norm({ x: 0.8, y: 0, z: -1 }), sphere, { rayon: 100, coque: 0.5 })
  assert.equal(t, null)
})

test('globe : le relief dessiné RAPPROCHE le focus — une montagne de 1 unité touche à 99', () => {
  const t = focusRayHitGlobe(o(0, 0, 200), o(0, 0, -1), () => 101, { rayon: 100, coque: 2 })
  assert.ok(Math.abs(t - 99) < 1e-3, `attendu 99, obtenu ${t}`)
})

test('globe : la marche démarre sous la coque quand la caméra y est déjà (surface, 5 km)', () => {
  // 5 km ≈ 0,078 unité au-dessus d'une surface à 100
  const t = focusRayHitGlobe(o(0, 0, 100.078), o(0, 0, -1), sphere, { rayon: 100, coque: 0.5 })
  assert.ok(Math.abs(t - 0.078) < 1e-3, `attendu 0.078, obtenu ${t}`)
})

test('globe : une caméra SOUS la surface dessinée rend null plutôt que 0', () => {
  const t = focusRayHitGlobe(o(0, 0, 100.05), o(0, 0, -1), () => 100.5, { rayon: 100, coque: 1 })
  assert.equal(t, null)
})

test('globe : la marche ne coûte que quelques lectures du relief depuis 2 000 km', () => {
  let n = 0
  const compte = () => { n++; return 100 }
  focusRayHitGlobe(o(0, 0, 131.4), o(0, 0, -1), compte, { rayon: 100, coque: 0.5 })
  assert.ok(n < 40, `${n} lectures — le saut analytique jusqu'à la coque doit épargner le vide`)
})
