import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roadRank, relativeTiers, tierDepth } from '../src/map/road-tier.js'

test('roadRank: absolute importance, _link suffix strips to parent class', () => {
  assert.equal(roadRank('motorway_link'), 0)
  assert.equal(roadRank('motorway'), 0)
  assert.equal(roadRank('trunk'), 0)
  assert.equal(roadRank('primary'), 1)
  assert.equal(roadRank('secondary'), 2)
  assert.equal(roadRank('tertiary'), 3)
  assert.equal(roadRank('residential'), 4)
  assert.equal(roadRank('unclassified'), 4)
  assert.equal(roadRank('living_street'), 4)
  assert.equal(roadRank('service'), 5)
  assert.equal(roadRank('track'), 6)
  assert.equal(roadRank('footway'), 6)
  assert.equal(roadRank('unknown'), 7)
  assert.equal(roadRank(''), 7)
  assert.equal(roadRank(undefined), 7)
})

test('relativeTiers: dense renumbering of whatever ranks are present', () => {
  const tiers = relativeTiers([1, 2, 4])
  assert.deepEqual([...tiers.entries()], [[1, 0], [2, 1], [4, 2]])
})

test('relativeTiers: duplicates collapse, order of input does not matter', () => {
  const tiers = relativeTiers([4, 1, 1, 2, 4, 2])
  assert.deepEqual([...tiers.entries()], [[1, 0], [2, 1], [4, 2]])
})

test('relativeTiers: regression for the reported bug — a patch with only residential+service still gets a tier 0', () => {
  // residential -> roadRank 4, service -> roadRank 5. No motorway/primary present.
  const ranks = [roadRank('residential'), roadRank('service'), roadRank('residential')]
  const tiers = relativeTiers(ranks)
  assert.equal(tiers.get(roadRank('residential')), 0) // nationals-equivalent becomes tier 0
  assert.equal(tiers.get(roadRank('service')), 1)
  // nothing renders empty: every rank present maps to a defined tier
  for (const rank of ranks) assert.equal(Number.isInteger(tiers.get(rank)), true)
})

test('relativeTiers: empty input yields an empty map', () => {
  assert.equal(relativeTiers([]).size, 0)
})

test('tierDepth: far zoom (demZoom<=9, the 181km+ band) caps every notch, including 3', () => {
  assert.equal(tierDepth(1, 9), 1)
  assert.equal(tierDepth(2, 9), 1)
  assert.equal(tierDepth(3, 9), 2)
  assert.notEqual(tierDepth(3, 9), Infinity)
})

test('tierDepth: mid-zoom band (demZoom 10-11, the reported 46-91km bug band) stays finite for notch 3', () => {
  // this is exactly the band the bug report measured as either empty
  // (notch 1/2, before OSM_MIN_ZOOM was shared) or flooded with 43,943+
  // unrestricted OSM segments (notch 3, before tierDepth was zoom-aware).
  assert.equal(tierDepth(3, 10), 4)
  assert.equal(tierDepth(3, 11), 4)
  assert.notEqual(tierDepth(3, 10), Infinity)
  assert.notEqual(tierDepth(3, 11), Infinity)
})

test('tierDepth: close zoom (demZoom>=13) leaves notch 3 fully unrestricted — must not regress', () => {
  assert.equal(tierDepth(3, 13), Infinity)
  assert.equal(tierDepth(3, 20), Infinity)
})

test('tierDepth: notch 1/2 plateau at their historical constant depths once zoomed in', () => {
  assert.equal(tierDepth(1, 13), 2)
  assert.equal(tierDepth(2, 13), 4)
  assert.equal(tierDepth(1, 20), 2)
  assert.equal(tierDepth(2, 20), 4)
})

test('tierDepth: for a fixed notch, depth is monotonically non-decreasing as zoom increases (progressive opening)', () => {
  const zooms = [4, 8, 9, 10, 11, 12, 13, 16]
  for (const detail of [1, 2, 3]) {
    let prev = -Infinity
    for (const zoom of zooms) {
      const d = tierDepth(detail, zoom)
      assert.ok(d >= prev, `detail ${detail} zoom ${zoom}: depth ${d} regressed below previous ${prev}`)
      prev = d
    }
  }
})

test('tierDepth: at any given zoom, higher notches are never MORE restrictive than lower ones', () => {
  for (const zoom of [8, 9, 10, 11, 12, 13, 16]) {
    const d1 = tierDepth(1, zoom), d2 = tierDepth(2, zoom), d3 = tierDepth(3, zoom)
    assert.ok(d1 <= d2, `zoom ${zoom}: notch1 depth ${d1} > notch2 depth ${d2}`)
    assert.ok(d2 <= d3, `zoom ${zoom}: notch2 depth ${d2} > notch3 depth ${d3}`)
  }
})
