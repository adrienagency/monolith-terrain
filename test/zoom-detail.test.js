import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DETAIL_DEFAULTS, detailForZoom } from '../src/zoom-detail.js'
import { ZOOM_PALIER_MIN } from '../src/escalier-zoom.js'

test('coarse continental zooms force fine-detail to zero', () => {
  assert.equal(detailForZoom(6, {}, 0.02), 0)
  assert.equal(detailForZoom(5, {}, 0.02), 0)
  assert.equal(detailForZoom(4, {}, 0.02), 0)
})

test('z7 and finer keep the base detail', () => {
  assert.equal(detailForZoom(7, {}, 0.02), 0.02)
  assert.equal(detailForZoom(12, {}, 0.02), 0.02)
})

test('a user override in the store wins at any zoom', () => {
  assert.equal(detailForZoom(6, { 6: 0.15 }, 0.02), 0.15)
  assert.equal(detailForZoom(12, { 12: 0.3 }, 0.02), 0.3)
})

test('DETAIL_DEFAULTS zeroes the coarse tiers only', () => {
  assert.equal(DETAIL_DEFAULTS[6], 0)
  assert.equal(DETAIL_DEFAULTS[5], 0)
  assert.equal(DETAIL_DEFAULTS[7], undefined)
})

// ══════════ LE PLANCHER DOIT AVOIR SON ENTRÉE, ET LE TEST DOIT LE DIRE ══════
//
// LE DÉFAUT MESURÉ : z3 n'avait d'entrée dans AUCUNE des deux tables (ni
// DETAIL_DEFAULTS ici, ni ZOOM_EXAG_DEFAULTS dans main.js). Le moutonnement FBM
// était donc ALLUMÉ au niveau le PLUS CONTINENTAL qui existe —
// `detailForZoom(3)` rendait 0,02 contre 0 pour z4, z5 et z6 — c'est-à-dire
// exactement le « faux grésillement sur les plaines » que ces défauts existent
// pour éteindre, et à l'échelle où il est le plus visible.
//
// La cause n'est pas une faute de frappe : c'est que la table a été écrite quand
// le plancher était z4, et que DÉPLACER LE PLANCHER ne rougissait nulle part.
// D'où l'assertion ci-dessous, écrite contre `ZOOM_PALIER_MIN` et non contre le
// littéral 3 : le prochain déplacement du plancher rougira.
test('LE PLANCHER DE L ESCALIER a toujours son défaut de détail, et il vaut 0', () => {
  assert.equal(detailForZoom(ZOOM_PALIER_MIN, {}, 0.02), 0,
    `z${ZOOM_PALIER_MIN} est le plancher : le moutonnement FBM doit y être éteint comme aux autres niveaux continentaux`)
})

test('tous les niveaux continentaux, du plancher à z6, éteignent le détail', () => {
  for (let z = ZOOM_PALIER_MIN; z <= 6; z++) {
    assert.equal(detailForZoom(z, {}, 0.02), 0, `z${z} laisse passer du moutonnement`)
  }
})
