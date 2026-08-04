// test/gpx-largeur.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { largeurRuban, RUBAN_DEMI_LARGEUR_BASE } from '../src/ruban-trace.js'

test('la largeur du ruban suit le reglage du panneau', () => {
  assert.ok(largeurRuban(0.022, 3) > largeurRuban(0.022, 1.5))
  assert.equal(largeurRuban(0.022, 3), 0.066)
})

test('largeurRuban : reglage absurde ou absent retombe sur le defaut', () => {
  assert.equal(largeurRuban(0.022, null), largeurRuban(0.022, 3))
  assert.equal(largeurRuban(0.022, 0), largeurRuban(0.022, 3))
  assert.ok(Number.isFinite(largeurRuban(0.022, NaN)))
})
