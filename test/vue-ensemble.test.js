import { test } from 'node:test'
import assert from 'node:assert/strict'
import { poseIsometrique } from '../src/vue-ensemble.js'

test('la pose cadre TOUT le trace, avec une marge', () => {
  const pts = [{x:-10,y:0,z:-10},{x:10,y:5,z:10}]
  const p = poseIsometrique(pts, { fovDeg: 30, marge: 1.25 })
  assert.deepEqual([+p.cible.x.toFixed(3), +p.cible.z.toFixed(3)], [0, 0])
  assert.ok(p.position.y > 5, 'la camera doit etre AU-DESSUS du point haut')
  const rayon = Math.hypot(10, 10)
  assert.ok(p.distance > rayon, 'assez loin pour tout contenir')
})

test('la pose est ISOMETRIQUE : 45 deg en plan, 35,26 deg en site', () => {
  const p = poseIsometrique([{x:-1,y:0,z:-1},{x:1,y:0,z:1}], {})
  const d = { x: p.position.x - p.cible.x, y: p.position.y - p.cible.y, z: p.position.z - p.cible.z }
  assert.ok(Math.abs(Math.abs(d.x) - Math.abs(d.z)) < 1e-9, 'plan a 45 deg')
  const site = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI
  assert.ok(Math.abs(site - 35.264) < 0.01, `site ${site}, attendu 35,264`)
})

test('cas degeneres : trace vide ou a un point', () => {
  assert.equal(poseIsometrique([], {}), null)
  assert.ok(poseIsometrique([{x:0,y:0,z:0}], {}))
})
