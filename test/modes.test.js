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
  // ⚠️ z1 À z3 ONT DISPARU. Adrien, 2026-08-02 : « Z1 et Z2 ne doivent pas
  // exister » — sa capture a tranché que sa numérotation est celle de la
  // pastille, donc le zoom slippy standard. Puis 2026-08-31 (R27) : « passer en
  // mode orbite pour tout ce qui est supérieur à Z4 », et z3 s'en va à son
  // tour. z4 est le plancher, z5 reste un niveau légitime.
  assert.equal(pickDiveTier(1600000).zoom, 5)
  assert.equal(pickDiveTier(3000000).zoom, 5)
  assert.equal(pickDiveTier(7999999).zoom, 4, 'sous la marche z4 : le plus large bloc qui reste')
  assert.equal(pickDiveTier(9000000), null, 'au-dessus de la marche z4 : le globe')
  assert.equal(pickDiveTier(20000000), null, 'au-dessus de tout palier : le globe')
  assert.equal(pickDiveTier(1599999).zoom, 6)
  assert.equal(pickDiveTier(16000000), null)
})

test('the surface staircase widens one zoom level at a time down to z4', () => {
  assert.equal(stepZoom(12, -1), 11)
  assert.equal(stepZoom(10, -1), 9)
  assert.equal(stepZoom(8, -1), 7)
  assert.equal(stepZoom(7, -1), 6)
  // ⚠️ LE PLANCHER EST z4 DEPUIS R27 (2026-08-31). Il valait z3 depuis le
  // 2026-08-02, et z6 avant : Adrien a tranché sur capture que sa numérotation
  // est celle de la pastille, c'est-à-dire le zoom slippy standard, puis a
  // demandé l'orbite « pour tout ce qui est supérieur à Z4 ».
  assert.equal(stepZoom(6, -1), 5)
  assert.equal(stepZoom(5, -1), 4)
  assert.equal(stepZoom(4, -1), 4) // plancher : au-delà, le globe
  assert.equal(stepZoom(3, -1), 4) // un vieux lien de partage est remonté au plancher
  assert.equal(stepZoom(2, -1), 4)
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
