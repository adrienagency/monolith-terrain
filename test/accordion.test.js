import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foldOthers, openExclusive } from '../src/accordion.js'

// a fake lil-gui folder: a synchronous `_closed` flag + a close() that sets it
const makeFolders = (openIndexes = []) =>
  Array.from({ length: 5 }, (_, i) => ({
    _closed: !openIndexes.includes(i),
    close() {
      this._closed = true
    },
  }))

const openCount = (fs) => fs.filter((f) => !f._closed).length

test('openExclusive folds every other folder when one is open', () => {
  const fs = makeFolders([0, 2, 3]) // three open
  openExclusive(fs, fs[2]) // 2 was just opened
  assert.equal(openCount(fs), 1)
  assert.equal(fs[2]._closed, false, 'the opened folder stays open')
  assert.ok(fs[0]._closed && fs[3]._closed, 'the others fold')
})

test('openExclusive does nothing when the target folder is closed', () => {
  const fs = makeFolders([1, 4])
  openExclusive(fs, fs[0]) // fs[0] is closed → no-op
  assert.equal(openCount(fs), 2, 'a just-closed folder leaves the rest alone')
})

test('foldOthers never touches the exempt folder', () => {
  const fs = makeFolders([0, 1, 2, 3, 4]) // all open
  foldOthers(fs, fs[3])
  assert.equal(openCount(fs), 1)
  assert.equal(fs[3]._closed, false)
})

test('the invariant holds across a sequence of opens', () => {
  const fs = makeFolders() // all closed at start
  const open = (i) => {
    fs[i]._closed = false // lil-gui toggled it open; now enforce exclusivity
    openExclusive(fs, fs[i])
  }
  open(0)
  open(2)
  open(4)
  assert.equal(openCount(fs), 1)
  assert.equal(fs[4]._closed, false, 'only the last opened stays')
})
