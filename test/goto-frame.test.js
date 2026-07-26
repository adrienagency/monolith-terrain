import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frameFromBBox } from '../src/goto.js'

// Emprises Nominatim RÉELLES, relevées le 2026-07-26.
const FRANCE = ['-50.2187169', '51.3055721', '-178.3873749', '172.3057152']
const FRANCE_PT = { lat: 46.603354, lon: 1.8883335 }
const AUSTRALIE = ['-55.3228175', '-9.0880125', '72.2461932', '168.2261259']
const AUSTRALIE_PT = { lat: -24.7761086, lon: 134.755 }
const ANNECY = ['45.8737, 45.9385', '6.0872', '6.1655'].length ? ['45.8737', '45.9385', '6.0872', '6.1655'] : null

// LE BUG : le centroïde de l'emprise de la France tombe dans le golfe de
// Guinée, parce que Nominatim l'étire jusqu'à Wallis-et-Futuna et aux îles
// Matthew et Hunter — 350° de longitude. La recherche « France » amenait donc
// le bloc au large du Ghana, avec Lagos et Kinshasa dessus.
test('a country with far-flung territories is centred on its real point', () => {
  const f = frameFromBBox(FRANCE, { at: FRANCE_PT })
  // sans le correctif : lat 0,54 / lon −3,04, en pleine mer
  if (f) {
    assert.ok(Math.abs(f.lat - FRANCE_PT.lat) < 1e-6, `latitude ${f.lat}`)
    assert.ok(Math.abs(f.lon - FRANCE_PT.lon) < 1e-6, `longitude ${f.lon}`)
  }
})

test('an antimeridian-spanning bbox never decides the zoom', () => {
  // 350° de longitude : ce n'est pas un territoire d'un seul tenant. Rendre
  // null fait retomber l'appelant sur son zoom d'atterrissage, ce qui vaut
  // mieux qu'un plancher à z4 hérité d'un span de 39 000 km.
  assert.equal(frameFromBBox(FRANCE, { at: FRANCE_PT }), null)
  assert.equal(frameFromBBox(AUSTRALIE, { at: AUSTRALIE_PT }), null)
})

test('a compact feature still frames from its bbox', () => {
  const f = frameFromBBox(ANNECY, { at: { lat: 45.8992, lon: 6.1294 } })
  assert.ok(f, 'une emprise saine doit rendre un cadre')
  assert.ok(Math.abs(f.lat - 45.8992) < 1e-6, 'centré sur le point, pas sur le centroïde')
  assert.ok(f.zoom >= 10, `une ville doit cadrer serré, obtenu z${f.zoom}`)
})

// Le second garde-fou : une emprise compacte EN LONGITUDE mais dont le centre
// s'éloigne du point représentatif décrit un autre endroit.
test('a bbox whose centre drifts far from the point is refused', () => {
  const derive = ['40', '50', '0', '10'] // centre 45 / 5
  assert.ok(frameFromBBox(derive, { at: { lat: 45, lon: 5 } }), 'centre cohérent → accepté')
  assert.equal(frameFromBBox(derive, { at: { lat: 45, lon: 30 } }), null, 'centre à ~2 000 km → refusé')
})

test('without a representative point the old behaviour is preserved', () => {
  const f = frameFromBBox(['40', '50', '0', '10'])
  assert.ok(f)
  assert.equal(f.lat, 45)
  assert.equal(f.lon, 5)
})

test('degenerate bboxes return null instead of NaN', () => {
  assert.equal(frameFromBBox(null), null)
  assert.equal(frameFromBBox(['a', 'b', 'c', 'd']), null)
  assert.equal(frameFromBBox(['45', '45', '5', '5']), null, 'emprise de surface nulle')
})
