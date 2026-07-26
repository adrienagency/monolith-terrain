import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEM_SOURCES,
  DemSourceError,
  REGION_ZOOM,
  _resetDemSource,
  activeDemSource,
  clearRegionMemo,
  demTilePx,
  fallbackToAws,
  isFallbackActive,
  peekRegionMaxZoom,
  probeMaxZoom,
  regionKey,
  resolveRegionMaxZoom,
  tileForZoomAt,
} from '../src/dem-source.js'

// Un faux serveur : `cover` dit jusqu'où chaque zone est couverte.
// - `zmaxByTile(z, x, y)` → zoom max de la zone, ou null (hors couverture)
// - `fail` → toute requête tombe en panne (réseau / 5xx)
function fakeServer({ zmax = 16, fail = false, status5xx = false } = {}) {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts?.method })
    if (fail) throw new Error('ECONNREFUSED')
    if (status5xx) return { ok: false, status: 503 }
    const z = Number(url.match(/\/(\d+)\/\d+\/\d+\./)[1])
    if (zmax == null || z > zmax) return { ok: false, status: 404 }
    return { ok: true, status: 200 }
  }
  return { fetchImpl, calls }
}

// ------------------------------------------------------------------ l'URL et la taille de tuile

test("l'URL et la taille de tuile suivent la source active", () => {
  _resetDemSource()
  const mt = activeDemSource()
  assert.equal(mt.id, 'mapterhorn')
  assert.equal(mt.tilePx, 512)
  assert.equal(mt.url(16, 33845, 23178), 'https://tiles.mapterhorn.com/16/33845/23178.webp')

  const aws = DEM_SOURCES.aws
  assert.equal(aws.tilePx, 256)
  assert.equal(aws.url(12, 2115, 1448), 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2115/1448.png')
})

test('demTilePx : 256 par défaut (DEM historiques et bouchons de test), sinon la valeur portée', () => {
  assert.equal(demTilePx(null), 256)
  assert.equal(demTilePx({ size: 768 }), 256)
  assert.equal(demTilePx({ size: 1536, tilePx: 512 }), 512)
})

// ------------------------------------------------------------------ zones

test('tileForZoomAt vise la tuile sous le CENTRE du patch, pas son coin nord-ouest', () => {
  // patch z6 dont le centre tombe au milieu de la tuile (32, 22)
  const at = tileForZoomAt(6, 32, 22)
  assert.deepEqual(at(6), { x: 32, y: 22 })
  // le descendant z8 du CENTRE est le 2e enfant sur chaque axe (0,5 × 4 = 2)
  assert.deepEqual(at(8), { x: 32 * 4 + 2, y: 22 * 4 + 2 })
  // et l'ancêtre z4 contient bien la tuile de départ
  assert.deepEqual(at(4), { x: 8, y: 5 })
})

test('la clé de zone regroupe tout un carré z8 et sépare les sources', () => {
  const k = regionKey('mapterhorn', REGION_ZOOM, 132, 90)
  // deux tuiles z16 du même carré z8 → même clé
  const a = regionKey('mapterhorn', 16, 132 * 256 + 3, 90 * 256 + 7)
  const b = regionKey('mapterhorn', 16, 132 * 256 + 200, 90 * 256 + 190)
  assert.equal(a, b)
  assert.equal(a, k)
  // une zone voisine → clé différente
  assert.notEqual(a, regionKey('mapterhorn', REGION_ZOOM, 133, 90))
  // même zone, autre source → clé différente (les couvertures n'ont rien à voir)
  assert.notEqual(a, regionKey('aws', REGION_ZOOM, 132, 90))
})

// ------------------------------------------------------------------ sondage du zoom max

test('probeMaxZoom rend le zoom le plus fin servi', async () => {
  const { fetchImpl, calls } = fakeServer({ zmax: 16 })
  const z = await probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(16, 33845, 23178), fetchImpl)
  assert.equal(z, 16)
  // sondage en HEAD uniquement, de maxZoom à baseZoom
  assert.equal(calls.length, 17 - 12 + 1)
  assert.ok(calls.every((c) => c.method === 'HEAD'))
})

test('probeMaxZoom : z17 là où la donnée descend le plus bas (Suisse)', async () => {
  const { fetchImpl } = fakeServer({ zmax: 17 })
  assert.equal(await probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(12, 2115, 1448), fetchImpl), 17)
})

test('probeMaxZoom : z12 quand seule la couche mondiale répond (Everest)', async () => {
  const { fetchImpl } = fakeServer({ zmax: 12 })
  assert.equal(await probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(12, 3077, 1795), fetchImpl), 12)
})

test('probeMaxZoom : que des 404 ⇒ zone NON couverte (null), pas une panne', async () => {
  const { fetchImpl } = fakeServer({ zmax: null })
  assert.equal(await probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(6, 20, 24), fetchImpl), null)
})

test('probeMaxZoom : panne réseau ⇒ DemSourceError', async () => {
  const { fetchImpl } = fakeServer({ fail: true })
  await assert.rejects(
    () => probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(12, 1, 1), fetchImpl),
    (e) => e instanceof DemSourceError
  )
})

test('probeMaxZoom : 5xx ⇒ DemSourceError (ce n est PAS un trou de couverture)', async () => {
  const { fetchImpl } = fakeServer({ status5xx: true })
  await assert.rejects(
    () => probeMaxZoom(DEM_SOURCES.mapterhorn, tileForZoomAt(12, 1, 1), fetchImpl),
    (e) => e instanceof DemSourceError
  )
})

// ------------------------------------------------------------------ mémorisation par zone

test('le zoom max est MÉMORISÉ par zone : une seule salve de sondage', async () => {
  _resetDemSource()
  const { fetchImpl, calls } = fakeServer({ zmax: 16 })
  const src = DEM_SOURCES.mapterhorn
  const a = await resolveRegionMaxZoom(src, 16, 33845, 23178, fetchImpl)
  const n1 = calls.length
  // un déplacement DANS la même zone z8 ne resonde pas
  const b = await resolveRegionMaxZoom(src, 16, 33845 + 40, 23178 + 40, fetchImpl)
  assert.equal(a, 16)
  assert.equal(b, 16)
  assert.equal(calls.length, n1, 'la zone déjà sondée ne doit plus toucher au réseau')
  // et la lecture synchrone (pour l'UI) répond sans requête
  assert.equal(peekRegionMaxZoom(regionKey(src.id, 16, 33845, 23178)), 16)

  // une AUTRE zone se sonde bien, elle
  await resolveRegionMaxZoom(src, 16, 33845 + 4096, 23178, fetchImpl)
  assert.ok(calls.length > n1)
})

test('deux blocs voisins chargés en même temps partagent UN seul sondage', async () => {
  _resetDemSource()
  const { fetchImpl, calls } = fakeServer({ zmax: 16 })
  const src = DEM_SOURCES.mapterhorn
  const [a, b, c] = await Promise.all([
    resolveRegionMaxZoom(src, 16, 33845, 23178, fetchImpl),
    resolveRegionMaxZoom(src, 16, 33846, 23178, fetchImpl),
    resolveRegionMaxZoom(src, 16, 33847, 23179, fetchImpl),
  ])
  assert.deepEqual([a, b, c], [16, 16, 16])
  assert.equal(calls.length, 6, 'une seule salve HEAD (17→12) pour les trois blocs')
})

test('une PANNE ne se mémorise pas : la zone reste à sonder', async () => {
  _resetDemSource()
  const src = DEM_SOURCES.mapterhorn
  const bad = fakeServer({ fail: true })
  await assert.rejects(() => resolveRegionMaxZoom(src, 16, 100, 100, bad.fetchImpl))
  assert.equal(peekRegionMaxZoom(regionKey(src.id, 16, 100, 100)), undefined)
  const good = fakeServer({ zmax: 15 })
  assert.equal(await resolveRegionMaxZoom(src, 16, 100, 100, good.fetchImpl), 15)
})

test('AWS ne se sonde pas : couverture uniforme, zéro requête', async () => {
  const { fetchImpl, calls } = fakeServer({ zmax: 16 })
  assert.equal(await resolveRegionMaxZoom(DEM_SOURCES.aws, 14, 8000, 5000, fetchImpl), 15)
  assert.equal(calls.length, 0)
})

// ------------------------------------------------------------------ le repli

test('le repli bascule sur AWS, oublie les zooms mémorisés, et est idempotent', async () => {
  _resetDemSource()
  const { fetchImpl } = fakeServer({ zmax: 16 })
  const src = DEM_SOURCES.mapterhorn
  await resolveRegionMaxZoom(src, 16, 33845, 23178, fetchImpl)
  assert.equal(peekRegionMaxZoom(regionKey(src.id, 16, 33845, 23178)), 16)
  assert.equal(isFallbackActive(), false)

  const after = fallbackToAws(new DemSourceError('5xx'))
  assert.equal(after.id, 'aws')
  assert.equal(after.tilePx, 256, 'le repli doit aussi revenir au 256 px')
  assert.equal(activeDemSource().id, 'aws')
  assert.equal(isFallbackActive(), true)
  // la mémoire décrivait la couverture de l'AUTRE source — elle doit être vide
  assert.equal(peekRegionMaxZoom(regionKey(src.id, 16, 33845, 23178)), undefined)

  // rappel : rien ne change, rien ne casse
  assert.equal(fallbackToAws(new Error('encore')).id, 'aws')
  assert.equal(activeDemSource().id, 'aws')
  _resetDemSource()
  assert.equal(activeDemSource().id, 'mapterhorn')
})

test('après repli, la source active sert bien les URL AWS en 256 px', () => {
  _resetDemSource()
  fallbackToAws(new DemSourceError('DNS'))
  const s = activeDemSource()
  assert.equal(s.tilePx, 256)
  assert.match(s.url(12, 2115, 1448), /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//)
  _resetDemSource()
  assert.match(activeDemSource().url(12, 2115, 1448), /^https:\/\/tiles\.mapterhorn\.com\//)
})

test("l'attribution Mapterhorn est portée par la source", () => {
  _resetDemSource()
  const s = activeDemSource()
  assert.equal(s.credit, '© Mapterhorn')
  assert.equal(s.creditUrl, 'https://mapterhorn.com/attribution')
})

test('clearRegionMemo vide la mémoire sans toucher à la source', async () => {
  _resetDemSource()
  const { fetchImpl } = fakeServer({ zmax: 16 })
  await resolveRegionMaxZoom(DEM_SOURCES.mapterhorn, 16, 1000, 1000, fetchImpl)
  clearRegionMemo()
  assert.equal(peekRegionMaxZoom(regionKey('mapterhorn', 16, 1000, 1000)), undefined)
  assert.equal(activeDemSource().id, 'mapterhorn')
})
