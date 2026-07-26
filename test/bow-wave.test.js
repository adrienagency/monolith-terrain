import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepWake, wakeLength, WAKE_ZERO, WAKE_DEFAULTS } from '../src/bow-wave.js'

// Fait avancer le sillage sur une trajectoire, à pas fixe
const run = (steps, target, dt = 1 / 60, state = WAKE_ZERO) => {
  let s = state
  for (let i = 0; i < steps; i++) s = stepWake(s, typeof target === 'function' ? target(i) : target, dt)
  return s
}

test('a still pointer makes no wake', () => {
  const s = run(120, { x: 3, z: 4 })
  assert.ok(s.amp < 0.02, `au repos la puissance doit tomber, obtenu ${s.amp}`)
  // la position, elle, a bien rattrapé la cible
  assert.ok(Math.hypot(s.x - 3, s.z - 4) < 0.01)
})

test('a moving pointer raises the bow, and stopping lets it fade', () => {
  const v = WAKE_DEFAULTS.speedFull // pile la vitesse « pleine puissance »
  const enMarche = run(90, (i) => ({ x: v * i * (1 / 60), z: 0 }))
  assert.ok(enMarche.amp > 0.5, `en marche la puissance doit monter, obtenu ${enMarche.amp}`)

  // on s'arrête sur place : elle retombe, sans jamais devenir négative
  const arret = run(180, { x: enMarche.x, z: enMarche.z }, 1 / 60, enMarche)
  assert.ok(arret.amp < enMarche.amp * 0.1, `à l'arrêt elle doit s'éteindre, obtenu ${arret.amp}`)
  assert.ok(arret.amp >= 0)
})

test('the heading follows the direction of travel', () => {
  const est = run(120, (i) => ({ x: i * 0.2, z: 0 }))
  assert.ok(est.dx > 0.95, `cap vers +x attendu, obtenu dx=${est.dx}`)
  assert.ok(Math.abs(est.dz) < 0.2)

  const sud = run(120, (i) => ({ x: 0, z: i * 0.2 }))
  assert.ok(sud.dz > 0.95, `cap vers +z attendu, obtenu dz=${sud.dz}`)
})

test('the heading stays put when the pointer stops — it must not spin on noise', () => {
  const enMarche = run(120, (i) => ({ x: i * 0.2, z: 0 }))
  const arret = run(240, { x: enMarche.x, z: enMarche.z }, 1 / 60, enMarche)
  assert.ok(Math.abs(arret.dx - enMarche.dx) < 1e-6, 'le cap ne doit pas bouger au repos')
  assert.ok(Math.abs(arret.dz - enMarche.dz) < 1e-6)
})

test('the heading vector stays unit length along a turn', () => {
  // trajectoire circulaire : le pire cas pour un lissage de direction
  const s = run(300, (i) => ({ x: 5 * Math.cos(i / 25), z: 5 * Math.sin(i / 25) }))
  assert.ok(Math.abs(Math.hypot(s.dx, s.dz) - 1) < 1e-9, `cap non normalisé : ${Math.hypot(s.dx, s.dz)}`)
})

test('leaving the water fades the wake without moving it', () => {
  const enMarche = run(90, (i) => ({ x: i * 0.3, z: 0 }))
  const dehors = run(60, null, 1 / 60, enMarche)
  assert.equal(dehors.x, enMarche.x, 'le sillage reste où il était')
  assert.equal(dehors.z, enMarche.z)
  assert.ok(dehors.amp < enMarche.amp)
})

// Un onglet en arrière-plan ne reçoit aucune frame : au retour, dt vaut
// plusieurs secondes. Sans plafond, le rattrapage se ferait d'un coup et
// claquerait une vague géante au premier réveil.
test('a huge dt (backgrounded tab) cannot slam a giant wave', () => {
  const s = stepWake(WAKE_ZERO, { x: 1000, z: 1000 }, 30)
  assert.ok(s.amp <= 1, 'la puissance reste bornée')
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z))
  // le pas est plafonné, donc on n'a PAS téléporté jusqu'à la cible
  assert.ok(Math.hypot(s.x, s.z) < 1000)
})

test('degenerate inputs return the previous state instead of NaN', () => {
  assert.equal(stepWake(WAKE_ZERO, { x: 1, z: 1 }, 0), WAKE_ZERO)
  assert.equal(stepWake(WAKE_ZERO, { x: 1, z: 1 }, -1), WAKE_ZERO)
  assert.equal(stepWake(WAKE_ZERO, { x: 1, z: 1 }, NaN), WAKE_ZERO)
  const s = stepWake(WAKE_ZERO, { x: NaN, z: 2 }, 1 / 60)
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.amp), 'une cible non finie ne doit rien contaminer')
})

test('the wake scales with the block, so it reads the same at every zoom', () => {
  assert.ok(wakeLength(56) > wakeLength(10))
  assert.equal(wakeLength(56, 2), wakeLength(56) * 2)
  assert.ok(wakeLength(0) > 0, 'jamais nul : le shader divise par cette longueur')
  assert.ok(wakeLength(-5) > 0)
})
