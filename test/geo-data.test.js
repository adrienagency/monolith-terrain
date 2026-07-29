import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { featureBBox, bboxOverlap, clipToPatch, filterByZoom, loadLayer } from '../src/map/geo-data.js'

const line = (coords, props = {}) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })

test('featureBBox spans a LineString', () => {
  assert.deepEqual(featureBBox(line([[0, 0], [2, 3], [-1, 1]])), [-1, 0, 2, 3])
})

test('bboxOverlap detects overlap and separation', () => {
  const bounds = { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 }
  assert.equal(bboxOverlap([1, 1, 2, 2], bounds), true)
  assert.equal(bboxOverlap([6, 6, 7, 7], bounds), false)
})

test('clipToPatch keeps overlapping features only', () => {
  const inside = line([[1, 1], [2, 2]])
  const outside = line([[10, 10], [11, 11]])
  const kept = clipToPatch([inside, outside], { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 })
  assert.equal(kept.length, 1)
  assert.equal(kept[0], inside)
})

test('filterByZoom respects min_zoom', () => {
  const a = line([[0, 0]], { min_zoom: 4 })
  const b = line([[0, 0]], { min_zoom: 9 })
  assert.deepEqual(filterByZoom([a, b], 6), [a])
})

// ---- une couche qui DISPARAÎT ne doit rien casser -------------------------
// public/data/map/roads.json est parti avec le calque Routes (12,6 Mo). Le
// jour où une autre couche s'en ira de la même façon, le chargeur doit se
// taire : un 404 vaut « couche vide », jamais une exception ni un message
// rouge dans la console. C'est ce contrat-là que ces deux tests tiennent.

test('loadLayer : une couche absente vaut une couche vide, en silence', async () => {
  const erreurs = []
  const consoleError = console.error
  const consoleWarn = console.warn
  console.error = (...a) => erreurs.push(a)
  console.warn = (...a) => erreurs.push(a)
  const fetchOrigine = global.fetch
  try {
    global.fetch = () => Promise.resolve({ ok: false, status: 404 })
    assert.equal(await loadLayer('couche-partie'), null)
    // et même quand le réseau lui-même jette
    global.fetch = () => Promise.reject(new Error('offline'))
    await assert.doesNotReject(loadLayer('autre-couche-partie'))
    assert.equal(await loadLayer('autre-couche-partie'), null)
  } finally {
    global.fetch = fetchOrigine
    console.error = consoleError
    console.warn = consoleWarn
  }
  assert.deepEqual(erreurs, [], 'le repli doit être SILENCIEUX')
})

test('plus une seule ligne de code ne réclame la couche « roads »', () => {
  // le pendant du test ci-dessus : le repli silencieux protège des oublis,
  // il ne les excuse pas. Personne ne doit plus demander un fichier parti.
  const fichiers = []
  const marcher = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) marcher(p)
      else if (e.name.endsWith('.js')) fichiers.push(p)
    }
  }
  marcher(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf8')
    assert.ok(!/loadLayer\(\s*['"]roads['"]\s*\)/.test(src), `${f} charge encore data/map/roads.json`)
    assert.ok(!/loadRoadTiles|loadRoadTileManifest/.test(src), `${f} réclame encore les tuiles routières`)
  }
})
