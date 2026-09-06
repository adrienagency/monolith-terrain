// LE SAS TÉLÉPHONE SAUTÉ — Tâche 2026-09-06. Même patron que
// `biseau-socle.test.js` ⑧ : `FLAGS.gatePhone` en dur, l'échappatoire
// d'adresse au-dessus. `recherche` est la couture de test de `paramAdresse`
// (`location` n'existe pas sous node).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FLAGS, gatePhoneActif } from '../src/flags.js'

test('① le sas est éteint par défaut — Adrien : « tu peux la faire sauter pour l’instant »', () => {
  assert.equal(FLAGS.gatePhone, false)
  assert.equal(gatePhoneActif(), false)
})

test('② `?gate=1` (ou `on`) le rallume sans toucher au code', () => {
  assert.equal(gatePhoneActif('?gate=1'), true)
  assert.equal(gatePhoneActif('?gate=on'), true)
})

test('③ `?gate=0` (ou `off`) le confirme éteint', () => {
  assert.equal(gatePhoneActif('?gate=0'), false)
  assert.equal(gatePhoneActif('?gate=off'), false)
})

test('④ une valeur inconnue ou absente retombe sur le drapeau', () => {
  assert.equal(gatePhoneActif(''), false)
  assert.equal(gatePhoneActif('?autreChose=1'), false)
})

test('⑤ si le drapeau redevenait `true` un jour, `?gate=0` le couperait quand même', () => {
  const avant = FLAGS.gatePhone
  FLAGS.gatePhone = true
  try {
    assert.equal(gatePhoneActif(), true, 'sans échappatoire, le drapeau prime')
    assert.equal(gatePhoneActif('?gate=0'), false, '`?gate=0` coupe même rallumé')
  } finally {
    FLAGS.gatePhone = avant
  }
})
