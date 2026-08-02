import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIVE_TIERS, pickDiveTier, stepZoom } from '../src/modes.js'

test('tiers are ordered fine → coarse with strictly rising altitudes', () => {
  assert.equal(DIVE_TIERS[0].zoom, null, 'first tier is the fine (user) zoom')
  for (let i = 1; i < DIVE_TIERS.length; i++) {
    assert.ok(DIVE_TIERS[i].altM > DIVE_TIERS[i - 1].altM)
    assert.ok(DIVE_TIERS[i].zoom < 12, 'coarse tiers use regional zooms')
  }
})

test('pickDiveTier lands each altitude on the matching scale', () => {
  assert.equal(pickDiveTier(6000), DIVE_TIERS[0]) // Everest-class → fine
  assert.equal(pickDiveTier(7999), DIVE_TIERS[0])
  assert.equal(pickDiveTier(8000).zoom, 11) // boundary goes one step coarse
  assert.equal(pickDiveTier(30000).zoom, 10)
  assert.equal(pickDiveTier(70000).zoom, 9)
  assert.equal(pickDiveTier(150000).zoom, 8) // Corsica / Madagascar-sized
  assert.equal(pickDiveTier(199999).zoom, 8)
  assert.equal(pickDiveTier(300000).zoom, 7)
  assert.equal(pickDiveTier(1000000).zoom, 6)
  // ⚠️ SEULS z1 ET z2 ONT DISPARU. Adrien : « Z1 et Z2 ne doivent pas
  // exister » — et sa capture du 2026-08-02 a tranché que sa numérotation est
  // celle de la pastille, donc le zoom slippy standard. z3 est le plancher et
  // reçoit sa marche à 16 000 km ; z4 et z5 restent des niveaux légitimes.
  assert.equal(pickDiveTier(1600000).zoom, 5)
  assert.equal(pickDiveTier(3000000).zoom, 5)
  assert.equal(pickDiveTier(9000000).zoom, 3)
  assert.equal(pickDiveTier(20000000), null, 'au-dessus de tout palier : le globe')
  assert.equal(pickDiveTier(1599999).zoom, 6)
  assert.equal(pickDiveTier(16000000), null)
})

test('the surface staircase widens one zoom level at a time down to z3', () => {
  assert.equal(stepZoom(12, -1), 11)
  assert.equal(stepZoom(10, -1), 9)
  assert.equal(stepZoom(8, -1), 7)
  assert.equal(stepZoom(7, -1), 6)
  // ⚠️ LE PLANCHER EST z3 DEPUIS LE 2026-08-02, pas z6 : Adrien a tranché sur
  // capture que sa numérotation est celle de la pastille, c'est-à-dire le zoom
  // slippy standard. Seuls z1 et z2 disparaissent.
  assert.equal(stepZoom(6, -1), 5)
  assert.equal(stepZoom(3, -1), 3) // plancher : au-delà, le globe
  assert.equal(stepZoom(2, -1), 3) // un vieux lien de partage est remonté au plancher
})

test('the staircase refines one zoom level at a time, capped at the fine scale', () => {
  assert.equal(stepZoom(6, 1), 7)
  assert.equal(stepZoom(8, 1), 9)
  assert.equal(stepZoom(10, 1), 11)
  assert.equal(stepZoom(11, 1), 12)
  assert.equal(stepZoom(12, 1), 12) // caps at the fine scale (default 12)
  assert.equal(stepZoom(12, 1, 14), 13) // user picked a finer detail zoom
  assert.equal(stepZoom(14, 1, 15), 15) // last step is capped at the fine scale
  assert.equal(stepZoom(15, 1, 15), 15)
})

// Un cran à l'aller DOIT valoir un cran au retour : avec l'ancien pas de 2,
// zoomer puis dézoomer ramenait DEUX crans en arrière — on ne pouvait pas
// revenir au cadrage qu'on venait de quitter.
test('refining then widening returns to the exact starting zoom', () => {
  for (const fine of [12, 15, 17]) {
    for (let z = 6; z < fine; z++) {
      assert.equal(stepZoom(stepZoom(z, 1, fine), -1), z, `aller-retour depuis z${z} (fin ${fine})`)
    }
  }
})
