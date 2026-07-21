import { test } from 'node:test'
import assert from 'node:assert'
import { TEMPLATE_KEYS } from '../src/templates-user.js'
import { FLAGS } from '../src/flags.js'

test('la mer est persistée dans les templates/share-links', () => {
  for (const k of ['waterReal', 'waterTransparency', 'waterSunFx', 'seaWaveH', 'seaChop', 'seaSpeed', 'seaSeed', 'seaBed', 'seaEdge', 'seaEdgeFrost'])
    assert.ok(TEMPLATE_KEYS.includes(k), `clé manquante: ${k}`)
})

test('le flag water est actif', () => {
  assert.strictEqual(FLAGS.water, true)
})
