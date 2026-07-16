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

test('tierDepth: 1 -> 2, 2 -> 4, 3 -> unrestricted', () => {
  assert.equal(tierDepth(1), 2)
  assert.equal(tierDepth(2), 4)
  assert.equal(tierDepth(3), Infinity)
})
