import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHORTCUTS, matchShortcut } from '../src/shortcuts.js'

test('Numpad5 matches the top-down camera preset', () => {
  const m = matchShortcut({ code: 'Numpad5' })
  assert.ok(m)
  assert.equal(m.id, 'cam-top')
})

test('Ctrl+Z matches undo', () => {
  const m = matchShortcut({ code: 'KeyZ', ctrlKey: true })
  assert.ok(m)
  assert.equal(m.id, 'undo')
})

test('Ctrl+Shift+Z matches redo', () => {
  const m = matchShortcut({ code: 'KeyZ', ctrlKey: true, shiftKey: true })
  assert.ok(m)
  assert.equal(m.id, 'redo')
})

test('Ctrl+Y also matches redo', () => {
  const m = matchShortcut({ code: 'KeyY', ctrlKey: true })
  assert.ok(m)
  assert.equal(m.id, 'redo-y')
  assert.equal(m.category, 'History')
})

test('plain KeyR matches the roads layer toggle', () => {
  const m = matchShortcut({ code: 'KeyR' })
  assert.ok(m)
  assert.equal(m.id, 'layer-roads')
})

test('Ctrl+KeyR does not match — ctrl combos are reserved for history/etc', () => {
  assert.equal(matchShortcut({ code: 'KeyR', ctrlKey: true }), null)
})

test('an unknown combo returns null', () => {
  assert.equal(matchShortcut({ code: 'F13' }), null)
  assert.equal(matchShortcut({ code: 'KeyZ' }), null) // plain Z (no ctrl) is unbound
  assert.equal(matchShortcut({}), null)
})

test('metaKey (Cmd) satisfies a ctrl-combo the same as ctrlKey', () => {
  const m = matchShortcut({ code: 'KeyZ', metaKey: true })
  assert.ok(m)
  assert.equal(m.id, 'undo')
})

test('Shift+Slash matches the shortcuts-overlay toggle, plain Slash matches search', () => {
  const help = matchShortcut({ code: 'Slash', shiftKey: true })
  assert.equal(help.id, 'toggle-shortcuts')
  const search = matchShortcut({ code: 'Slash' })
  assert.equal(search.id, 'focus-search')
})

// ---- Dispositions clavier non-QWERTY (le bug d'Adrien) --------------------
// Sur un AZERTY, Z et W sont échangés : la touche MARQUÉE Z occupe la position
// physique du W QWERTY, donc `KeyboardEvent.code` vaut 'KeyW'. Un registre qui
// ne lit que `code` fait donc Ctrl+Z = rien, et Ctrl+W = annuler. Ces tests
// figent la règle : les lettres se reconnaissent au CARACTÈRE, pas à la place.

test('AZERTY : Ctrl + la touche marquée Z annule, même si code vaut KeyW', () => {
  const m = matchShortcut({ code: 'KeyW', key: 'z', ctrlKey: true })
  assert.ok(m)
  assert.equal(m.id, 'undo')
})

test('AZERTY : Ctrl+Maj + la touche marquée Z rétablit', () => {
  const m = matchShortcut({ code: 'KeyW', key: 'Z', ctrlKey: true, shiftKey: true })
  assert.ok(m)
  assert.equal(m.id, 'redo')
})

test('AZERTY : Ctrl + la touche marquée W (code KeyZ) n’annule PLUS rien', () => {
  // le contre-poison : sans lui, l'ancien registre annulait sur la mauvaise touche
  assert.equal(matchShortcut({ code: 'KeyZ', key: 'w', ctrlKey: true }), null)
})

test('AZERTY : la touche marquée W bascule l’eau, la touche marquée Z ne fait rien', () => {
  assert.equal(matchShortcut({ code: 'KeyZ', key: 'w' }).id, 'layer-water')
  assert.equal(matchShortcut({ code: 'KeyW', key: 'z' }), null)
})

test('AZERTY : « / » et « ? » se reconnaissent au caractère produit', () => {
  // sur AZERTY, « / » est Maj+« : » (code Period) et « ? » est Maj+« , » (code Comma)
  assert.equal(matchShortcut({ code: 'Period', key: '/', shiftKey: true }).id, 'focus-search')
  assert.equal(matchShortcut({ code: 'Comma', key: '?', shiftKey: true }).id, 'toggle-shortcuts')
})

test('Verr.Maj ne casse pas les lettres (key majuscule sans shiftKey)', () => {
  assert.equal(matchShortcut({ code: 'KeyR', key: 'R' }).id, 'layer-roads')
})

test('le pavé numérique reste POSITIONNEL, jamais traduit en caractère', () => {
  // « Num 5 » = vue de dessus parce qu'il est AU CENTRE du pavé : sa place est
  // le sens du raccourci, le chiffre qu'il imprime n'y change rien.
  assert.equal(matchShortcut({ code: 'Numpad5', key: '5' }).id, 'cam-top')
  assert.equal(matchShortcut({ code: 'Digit5', key: '5' }), null) // la rangée du haut n'est pas le pavé
})

test('every SHORTCUTS entry has the documented shape and a unique id', () => {
  const ids = new Set()
  for (const s of SHORTCUTS) {
    assert.equal(typeof s.id, 'string')
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`)
    ids.add(s.id)
    assert.ok(Array.isArray(s.keys) && s.keys.length > 0)
    assert.equal(typeof s.label, 'string')
    assert.equal(typeof s.category, 'string')
    assert.equal(typeof s.run, 'function')
  }
})

test('run(ctx) dispatches to the matching ctx handler', () => {
  const calls = []
  const ctx = {
    cameraPreset: (name) => calls.push(['cameraPreset', name]),
    undo: () => calls.push(['undo']),
    redo: () => calls.push(['redo']),
    toggleLayer: (id) => calls.push(['toggleLayer', id]),
  }
  matchShortcut({ code: 'Numpad0' }).run(ctx)
  matchShortcut({ code: 'KeyZ', ctrlKey: true }).run(ctx)
  matchShortcut({ code: 'KeyY', ctrlKey: true }).run(ctx)
  matchShortcut({ code: 'KeyW' }).run(ctx)
  assert.deepEqual(calls, [
    ['cameraPreset', 'home'],
    ['undo'],
    ['redo'],
    ['toggleLayer', 'water'],
  ])
})
