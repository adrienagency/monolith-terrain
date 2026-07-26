import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedFleet, stepBoat, fleetAsleep, slotsForZoom, slotChance, boatScale, MIN_ZOOM, FLEET_SLOTS, SEE_CHANCE } from '../src/fleet.js'

const HALF = 28

test('nothing is placed below the 3D-element zoom floor', () => {
  for (const z of [4, 8, 10, MIN_ZOOM - 1]) {
    assert.equal(slotsForZoom(z), 0, `z${z} ne doit rien porter`)
    assert.deepEqual(seedFleet({ zoom: z, half: HALF, force: true }), [])
  }
  assert.ok(slotsForZoom(MIN_ZOOM) > 0)
})

test('the deeper the zoom, the more slots — density follows the scale', () => {
  const suite = [11, 12, 13, 14, 15].map((z) => slotsForZoom(z))
  for (let i = 1; i < suite.length; i++) assert.ok(suite[i] >= suite[i - 1], `z${i + 11} recule`)
  assert.ok(suite.at(-1) > suite[0], 'la flotte doit s’étoffer en zoomant')
  assert.ok(suite.every((n) => n <= FLEET_SLOTS))
})

// « Une chance sur dix de les voir » porte sur la présence d'AU MOINS UN
// bateau. Tirer chaque place à 1/10 en donnerait 47 % avec six places — c'est
// l'erreur que cette formule corrige.
test('one in ten means P(at least one boat) = 0.1, not P(slot) = 0.1', () => {
  for (const slots of [1, 3, 6, 12]) {
    const p = slotChance(slots)
    const aucun = Math.pow(1 - p, slots)
    assert.ok(Math.abs(aucun - (1 - SEE_CHANCE)) < 1e-9, `${slots} places : P(aucun) = ${aucun}`)
  }
  assert.ok(slotChance(6) < 0.02, 'six places → chaque place est rare')
})

test('the observed rate matches one in ten over many blocks', () => {
  let vus = 0
  const N = 4000
  for (let s = 1; s <= N; s++) if (seedFleet({ zoom: 15, half: HALF, seed: s }).length) vus++
  const taux = vus / N
  assert.ok(Math.abs(taux - SEE_CHANCE) < 0.03, `taux observé ${taux.toFixed(3)}, attendu ~0,1`)
})

test('the same block always gives the same fleet', () => {
  const a = seedFleet({ zoom: 14, half: HALF, seed: 42, force: true })
  const b = seedFleet({ zoom: 14, half: HALF, seed: 42, force: true })
  assert.deepEqual(a, b)
  const c = seedFleet({ zoom: 14, half: HALF, seed: 43, force: true })
  assert.notDeepEqual(a, c)
})

test('boats are seeded on water only when a sea test is given', () => {
  const surLaMer = (x) => x < 0 // moitié ouest navigable
  const flotte = seedFleet({ zoom: 15, half: HALF, seed: 7, isSea: surLaMer, force: true })
  assert.ok(flotte.length > 0)
  for (const b of flotte) assert.ok(surLaMer(b.x), `bateau à terre en x=${b.x}`)
})

test('a boat sails along its heading', () => {
  const b0 = { x: 0, z: 0, cap: 0, opacite: 1, dormant: false } // cap +z
  const b1 = stepBoat(b0, 1, HALF)
  assert.ok(b1.z > b0.z, 'doit avancer vers +z')
  assert.ok(Math.abs(b1.x - b0.x) < 1e-9, 'sans dériver en x')
})

test('it fades near the edge, then falls asleep past it', () => {
  let b = { x: 0, z: HALF * 0.9, cap: 0, opacite: 1, dormant: false }
  const debut = b.opacite
  for (let i = 0; i < 60; i++) b = stepBoat(b, 1 / 60, HALF)
  assert.ok(b.opacite < debut, `l’opacité doit tomber, obtenu ${b.opacite}`)
  assert.equal(b.dormant, false, 'pas encore sorti')

  for (let i = 0; i < 600; i++) b = stepBoat(b, 1 / 60, HALF)
  assert.equal(b.dormant, true, 'sorti du bloc → endormi')
  assert.equal(b.opacite, 0)
})

// Endormi = plus AUCUN calcul (Adrien). Le pas doit rendre l'objet tel quel.
test('a sleeping boat costs nothing — step returns it untouched', () => {
  const dort = { x: 99, z: 99, cap: 1, opacite: 0, dormant: true }
  assert.equal(stepBoat(dort, 1, HALF), dort, 'même référence : aucun travail')
})

test('a backgrounded tab cannot teleport the fleet across the map', () => {
  const b = stepBoat({ x: 0, z: 0, cap: 0, opacite: 1, dormant: false }, 30, HALF)
  assert.ok(Math.abs(b.z) < HALF, `dt plafonné attendu, obtenu z=${b.z}`)
  assert.ok(Number.isFinite(b.z))
})

test('degenerate dt leaves the boat alone', () => {
  const b0 = { x: 1, z: 2, cap: 0.5, opacite: 1, dormant: false }
  assert.equal(stepBoat(b0, 0, HALF), b0)
  assert.equal(stepBoat(b0, -1, HALF), b0)
  assert.equal(stepBoat(b0, NaN, HALF), b0)
})

test('fleetAsleep says when the renderer can go quiet entirely', () => {
  assert.equal(fleetAsleep([]), true)
  assert.equal(fleetAsleep(null), true)
  assert.equal(fleetAsleep([{ dormant: true }, { dormant: true }]), true)
  assert.equal(fleetAsleep([{ dormant: true }, { dormant: false }]), false)
})

// La coque garde une taille réelle plausible rapportée à l'emprise du bloc :
// un bloc qui couvre peu de terrain montre donc un bateau plus grand à l'écran.
test('hull size tracks the block footprint, exaggerated but anchored', () => {
  const large = boatScale(56, 100000) // bloc de 100 km
  const serre = boatScale(56, 10000) // bloc de 10 km
  assert.ok(serre > large * 9, 'dix fois plus serré → bateau bien plus grand')
  assert.ok(large > 0)
  assert.equal(boatScale(56, 0), 0, 'emprise nulle = pas de bateau')
  assert.equal(boatScale(0, 1000), 0)
})
