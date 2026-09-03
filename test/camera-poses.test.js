import { test } from 'node:test'
import assert from 'node:assert/strict'
import { peakVantage } from '../src/camera-poses.js'

test('vantage sits above the peak and targets its top', () => {
  const { pos, target } = peakVantage(10, 4, 0)
  assert.ok(pos.y > 4, 'camera rises above the summit')
  assert.equal(pos.y, 4 + 5.6)
  assert.equal(target.x, 10)
  assert.equal(target.z, 0)
  assert.ok(target.y > 4 && target.y < pos.y, 'target is the summit top, below the camera')
})

test('camera stands off outward along the radial', () => {
  const { pos } = peakVantage(10, 4, 0) // due +x from center
  assert.ok(pos.x > 10, 'pulled further out in x')
  assert.equal(pos.z, 0)
  // standoff distance is exactly the radial offset
  assert.ok(Math.abs(Math.hypot(pos.x - 10, pos.z - 0) - 3.4) < 1e-9)
})

test('a peak at the exact center still gets a defined vantage', () => {
  const { pos, target } = peakVantage(0, 2, 0)
  assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.z), 'no divide-by-zero NaN')
  assert.equal(pos.y, 2 + 5.6)
  assert.equal(target.x, 0)
  assert.equal(target.z, 0)
})

// ══════════ R35 — UNE POSE SE VÉRIFIE À L'ENTRÉE, SINON LA CAMÉRA PART À NaN ═
//
// ⛔ `__exp.flyTo(-21.115, 55.536, 9)` (l'appel de PF3, deux `flyTo` homonymes :
// celui de main.js prend des Vector3, `modes.flyTo` un lat/lon) laissait la
// caméra à NaN pour toujours : `tween.p1.copy(-21.115)` lit `.x` d'un nombre.
// Reproduit au navigateur (`.banc/R35/flyto-exp-avant.json`, NaN à l'image
// 2905, `modes.altM` null). Après : TypeError immédiate, caméra intacte.
import { estPose, exigerPose } from '../src/camera-poses.js'
import fs from 'node:fs'

test('R35 ① un nombre n’est pas une pose : `exigerPose` échoue en nommant l’appel juste', () => {
  assert.throws(() => exigerPose(-21.115, 'flyTo(pos)'), (e) => e instanceof TypeError && /flyTo\(pos\)/.test(e.message) && /modes\.flyTo\(lat, lon, zoom\)/.test(e.message) && /-21\.115/.test(e.message))
  assert.throws(() => exigerPose(undefined, 'flyTo(target)'), /flyTo\(target\).*undefined/)
  assert.throws(() => exigerPose({ x: NaN, y: 0, z: 0 }), TypeError, 'une composante NaN est refusée — c’est le symptôme lui-même')
  assert.throws(() => exigerPose({ x: 1, y: 2 }), TypeError, 'il manque z')
})

test('R35 ② une vraie pose passe, inchangée — Vector3 ou {x, y, z} nu', () => {
  const p = { x: 1, y: -2.5, z: 3 }
  assert.equal(exigerPose(p), p)
  assert.equal(estPose({ x: 0, y: 0, z: 0 }), true)
  assert.equal(estPose(3), false)
  assert.equal(estPose(null), false)
})

test('R35 ③ `flyTo(pos, target)` de main.js vérifie ses deux poses AVANT de toucher au tween', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const corps = src.slice(src.indexOf('function flyTo(pos, target, opts = {}) {'))
  const fin = corps.indexOf('\n}\n')
  const f = corps.slice(0, fin)
  assert.ok(f.includes("exigerPose(pos, 'flyTo(pos)')") && f.includes("exigerPose(target, 'flyTo(target)')"), 'les deux gardes sont là')
  assert.ok(f.indexOf('exigerPose(target') < f.indexOf('tween.p0.copy('), 'et elles passent AVANT la première écriture du tween')
  assert.ok(/import \{[^}]*exigerPose[^}]*\} from '\.\/camera-poses\.js'/.test(src), 'importée de camera-poses.js')
})
