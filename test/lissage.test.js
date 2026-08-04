import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lisser, lisserChamps } from '../src/lissage.js'

test('lisser part de la cible sans état précédent', () => {
  assert.equal(lisser(null, 10, 0.1, 0.5), 10)
  assert.equal(lisser(undefined, 10, 0.1, 0.5), 10)
})

test('lisser sans dt ni tau renvoie la valeur brute', () => {
  assert.equal(lisser(0, 10, 0, 0.5), 10)
  assert.equal(lisser(0, 10, 0.1, 0), 10)
})

test('lisser avance vers la cible sans jamais la dépasser', () => {
  let v = 0
  for (let i = 0; i < 200; i++) v = lisser(v, 10, 1 / 60, 0.3)
  assert.ok(v > 9.9 && v <= 10)
})

test('lisser à tau constant : un pas de dt=tau franchit ~63% de l’écart', () => {
  const v = lisser(0, 10, 0.5, 0.5)
  assert.ok(Math.abs(v - 6.32) < 0.05)
})

test('lisserChamps ne touche que les clés numériques listées', () => {
  const etat = { km: 1, pente: 5, nom: 'A' }
  const cible = { km: 2, pente: 6, nom: 'B' }
  const out = lisserChamps(etat, cible, 1, 0.001, ['km', 'pente'])
  // tau minuscule face à dt=1 -> quasiment la cible
  assert.ok(Math.abs(out.km - 2) < 0.01)
  assert.ok(Math.abs(out.pente - 6) < 0.01)
  assert.equal(out.nom, 'B') // pas lissé, mais bien recopié de la cible
})

test('lisserChamps ignore une clé absente de champs même si numérique', () => {
  const out = lisserChamps({ a: 0 }, { a: 100, b: 100 }, 1, 1000, ['a'])
  assert.ok(out.a < 100) // lissé
  assert.equal(out.b, 100) // pas dans la liste -> valeur cible telle quelle
})
