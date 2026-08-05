import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animationsActives, reglageInitial } from '../src/animations.js'

test('le reglage de l utilisateur decide', () => {
  assert.equal(animationsActives({ reglage: true, reduitParSysteme: false }), true)
  assert.equal(animationsActives({ reglage: false, reduitParSysteme: false }), false)
})

test('UN CHOIX EXPLICITE PRIME SUR LE SYSTEME, dans les deux sens', () => {
  // quelqu'un qui a demande le mouvement reduit a son systeme mais qui rallume
  // ICI a dit ce qu'il voulait : on ne le contredit pas
  assert.equal(animationsActives({ reglage: true, reduitParSysteme: true }), true)
  assert.equal(animationsActives({ reglage: false, reduitParSysteme: false }), false)
})

test('LE SYSTEME DECIDE DU DEPART, pas de la suite', () => {
  // prefers-reduced-motion n'est pas un caprice : on demarre eteint
  assert.equal(reglageInitial(true), false)
  assert.equal(reglageInitial(false), true)
})

test('cas degeneres : jamais undefined, toujours un booleen', () => {
  assert.equal(animationsActives(undefined), true)
  assert.equal(animationsActives({}), true)
  assert.equal(typeof reglageInitial(undefined), 'boolean')
})
