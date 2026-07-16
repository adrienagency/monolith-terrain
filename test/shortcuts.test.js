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
