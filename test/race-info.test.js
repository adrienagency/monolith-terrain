import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeRace } from '../src/race-info.js'

test('looksLikeRace accepts real events', () => {
  assert.ok(looksLikeRace('Marathon du Mont-Blanc', 'Le marathon du Mont-Blanc est une course de montagne.'))
  assert.ok(looksLikeRace('Ultra-Trail du Mont-Blanc', "L'UTMB est une course en montagne."))
  assert.ok(looksLikeRace('Maxi-Race Annecy', 'Un trail autour du lac.'))
})

test('looksLikeRace rejects people (winners) whose bio mentions trail', () => {
  assert.equal(looksLikeRace('Kílian Jornet', 'Kílian Jornet est un coureur de trail et skieur-alpiniste espagnol.'), false)
  assert.equal(looksLikeRace('François D\'Haene', "François D'Haene, né le 6 mai 1985, est un coureur de trail français."), false)
})

test('looksLikeRace rejects generic sport articles', () => {
  assert.equal(looksLikeRace('Trail (course à pied)', 'Le trail est une discipline.'), false)
  assert.equal(looksLikeRace('Marathon', 'Le marathon est une course.'), false)
})

test('looksLikeRace rejects unrelated places', () => {
  assert.equal(looksLikeRace('Lac d\'Annecy', "Le lac d'Annecy est un lac de Haute-Savoie."), false)
  assert.equal(looksLikeRace('Mont Blanc', 'Le mont Blanc est le point culminant des Alpes.'), false)
})
