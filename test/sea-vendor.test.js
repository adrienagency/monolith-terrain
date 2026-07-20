import { test } from 'node:test'
import assert from 'node:assert'
import { makeSeaState, WAVE_COUNT, GERSTNER_GLSL } from '../src/vendor/ocean-waves/index.js'

test('le vendor ocean-waves est fonctionnel et déterministe', () => {
  const s = makeSeaState(42)
  assert.strictEqual(s.waves.length, WAVE_COUNT)
  assert.deepStrictEqual(s.waves, makeSeaState(42).waves)
  assert.ok(GERSTNER_GLSL.includes('oceanGerstner'))
})
