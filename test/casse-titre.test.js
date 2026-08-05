import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casseDeNom } from '../src/casse-titre.js'

test('un titre tout en capitales redevient un nom propre', () => {
  assert.equal(casseDeNom('GRAND RAID REUNION 2025 - DIAGONALE DES FOUS 2025'),
               'Grand Raid Reunion 2025 - Diagonale des Fous 2025')
})

test('les petits mots restent en minuscules, SAUF en tete', () => {
  assert.equal(casseDeNom('LES 100 KM DE MILLAU'), 'Les 100 km de Millau')
  assert.equal(casseDeNom('DE BOUT EN BOUT'), 'De bout en Bout')
})

test('les sigles gardent leurs capitales', () => {
  assert.equal(casseDeNom('UTMB 2026'), 'UTMB 2026')
  assert.equal(casseDeNom('GR20 INTEGRALE'), 'GR20 Integrale')
})

test('un titre deja bien casse n est pas abime', () => {
  assert.equal(casseDeNom('Marathon du Mont-Blanc'), 'Marathon du Mont-Blanc')
})

test('cas degeneres', () => {
  assert.equal(casseDeNom(''), '')
  assert.equal(casseDeNom(null), '')
})
