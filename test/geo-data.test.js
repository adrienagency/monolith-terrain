import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { featureBBox, bboxOverlap, clipToPatch, filterByZoom, loadLayer, patchBounds } from '../src/map/geo-data.js'
import { spanLon } from '../src/map/tile-index.js'
import { demBounds } from '../src/map/aerial-layer.js'
import { cellsForBounds, CELL_SIZES } from '../src/map/geo-cells.js'

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

// ══════════ `patchBounds` EST LE JUMEAU DE `demBounds` — MÊME CONVENTION ════
//
// `demBounds` a été corrigé (il ne trie plus ses longitudes) ; `patchBounds` est
// resté sur `Math.min`/`Math.max`, et c'est exactement le même défaut, une porte
// plus loin. `worldToLatLon` replie l'indice de tuile dans [0, n), donc sur une
// emprise à cheval sur ±180° les neuf points d'échantillonnage ressortent aux
// DEUX bouts de l'axe : trier rend le COMPLÉMENT de l'emprise voulue.
//
// MESURÉ aux Fidji (179,97 / −16,85), avant correction : `patchBounds` rendait
// 393 à 396° de large — plus que la Terre. `cellsForBounds` renvoyait alors
// `null` (au-dessus de MAX_CELLS) pour `places`, `rivers` et `coastline`, donc
// REPLI SUR LE FICHIER MONOLITHE : la régression de 10,7 Mo que le découpage en
// cellules avait tuée, revenue en silence. Pour `lakes` (cellules de 10°) il
// demandait 36 cellules au lieu de 2.
const demFictif = ({ lon, lat, zoom, cote = 1 }) => {
  const n = 2 ** zoom
  const r = (lat * Math.PI) / 180
  const tuiles = 3 * cote // un bloc fait 3 tuiles ; une emprise 3×3 en fait 9
  return {
    size: tuiles * 512, tilePx: 512, zoom,
    originTileX: ((lon + 180) / 360) * n - tuiles / 2,
    originTileY: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - tuiles / 2,
    empriseCote: cote, extentMeters: (40075016 / n) * tuiles,
  }
}

test('patchBounds : aux Fidji, l emprise reste étroite au lieu de faire le tour du monde', () => {
  for (const cote of [1, 3]) {
    for (const zoom of [8, 12]) {
      const b = patchBounds(demFictif({ lon: 179.97, lat: -16.85, zoom, cote }))
      const largeur = spanLon(b.minLon, b.maxLon)
      assert.ok(largeur < 20, `z${zoom} ${cote}×${cote} : ${largeur.toFixed(1)}° de large`)
      // La convention : minLon EST le bord ouest, même quand il est numériquement
      // plus grand que maxLon. C'est ce que `tilesForBBox` et `cellsForBounds`
      // savent déjà lire.
      assert.ok(b.minLon > b.maxLon, "une emprise à cheval s'écrit ouest > est")
    }
  }
})

test('patchBounds : aux Fidji, on ne retombe plus sur le fichier monolithe', () => {
  const b = patchBounds(demFictif({ lon: 179.97, lat: -16.85, zoom: 12, cote: 3 }))
  for (const [nom, size] of Object.entries(CELL_SIZES)) {
    const keys = cellsForBounds(b, size)
    assert.ok(keys !== null, `${nom} : repli monolithe (cellsForBounds a rendu null)`)
    assert.ok(keys.length <= 6, `${nom} : ${keys.length} cellules demandées pour un bloc de quelques km`)
  }
})

test('patchBounds : le témoin de Chamonix est inchangé, et reste plus large que demBounds', () => {
  // La marge de 5 % + 0,01° existe pour RATISSER la donnée autour du bloc : elle
  // doit survivre à la correction, sinon les noms de village disparaissent des
  // bords. Hors enroulement, le comportement est identique à celui d'avant.
  const dem = demFictif({ lon: 6.87, lat: 45.92, zoom: 12, cote: 3 })
  const p = patchBounds(dem), d = demBounds(dem)
  assert.ok(p.minLon < d.minLon && p.maxLon > d.maxLon, 'la marge en longitude a disparu')
  assert.ok(p.minLat < d.minLat && p.maxLat > d.maxLat, 'la marge en latitude a disparu')
  assert.ok(spanLon(p.minLon, p.maxLon) > spanLon(d.minLon, d.maxLon))
  assert.ok(p.minLon < p.maxLon, 'sans enroulement, ouest < est comme toujours')
})

test('patchBounds : la marge est bien appliquée même sur une emprise enroulée', () => {
  const dem = demFictif({ lon: 179.97, lat: -16.85, zoom: 12, cote: 3 })
  const p = patchBounds(dem), d = demBounds(dem)
  // La marge se mesure sur la LARGEUR ENROULÉE, jamais sur une soustraction nue.
  assert.ok(spanLon(p.minLon, p.maxLon) > spanLon(d.minLon, d.maxLon),
    'la marge doit exister aussi à cheval sur ±180°')
  assert.ok(spanLon(p.minLon, p.maxLon) < spanLon(d.minLon, d.maxLon) * 1.5,
    'et rester une MARGE, pas un tour du monde')
})
