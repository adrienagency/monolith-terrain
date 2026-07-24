import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOverpassTransports, TRANSPORT_CATS, overpassTransportQuery } from '../src/transports.js'

const FIXTURE = {
  elements: [
    { type: 'node', id: 1, lat: 45.9, lon: 6.86, tags: { railway: 'station', name: 'Chamonix' } },
    { type: 'node', id: 2, lat: 45.91, lon: 6.87, tags: { amenity: 'bus_station', name: 'Gare routière' } },
    { type: 'node', id: 3, lat: 45.92, lon: 6.88, tags: { aerialway: 'station', name: 'Planpraz' } },
    { type: 'node', id: 4, lat: 45.93, lon: 6.89, tags: { amenity: 'ferry_terminal' } }, // sans nom → nom de la cat
    { type: 'node', id: 1, lat: 45.9, lon: 6.86, tags: { railway: 'station', name: 'Chamonix' } }, // doublon id
    { type: 'node', id: 5, lat: 45.94, lon: 6.9, tags: { shop: 'bakery', name: 'Pas un transport' } },
  ],
}

test('parseOverpassTransports catégorise, déduplique, nomme', () => {
  const pois = parseOverpassTransports(FIXTURE)
  assert.equal(pois.length, 4)
  const byCat = Object.fromEntries(pois.map((p) => [p.cat, p]))
  assert.equal(byCat.gare.name, 'Chamonix')
  assert.equal(byCat.bus.name, 'Gare routière')
  assert.equal(byCat.telepherique.name, 'Planpraz')
  assert.equal(byCat.bateau.name, 'Embarcadère') // fallback = label de la cat
  assert.ok(pois.every((p) => p.id.startsWith('tp_')))
})

test('overpassTransportQuery ne requête que les cats demandées', () => {
  const q = overpassTransportQuery({ s: 45, w: 6, n: 46, e: 7 }, ['gare', 'metro'])
  assert.ok(q.includes('railway'))
  assert.ok(q.includes('subway'))
  assert.ok(!q.includes('aerialway'))
})

test('TRANSPORT_CATS couvre la demande (6 catégories)', () => {
  assert.deepEqual(TRANSPORT_CATS.map((c) => c.key), ['gare', 'bus', 'telepherique', 'aeroport', 'metro', 'bateau'])
})
