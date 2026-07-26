import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeFR,
  apiQueryFR,
  dropArticleFR,
  rankFR,
  geometryToParts,
  searchFR,
  contourFR,
  loadIndexFR,
  clearGeoFRCache,
} from '../src/geo-fr.js'
import { frameRegion } from '../src/region-mask.js'

// ---------------------------------------------------------------- fixtures
// Toutes réelles, capturées le 2026-07-26 et RÉDUITES (anneaux décimés) pour
// que le dépôt ne grossisse pas : geo-fr-commune-lovagny.json est la réponse
// brute de geo.api.gouv.fr (anneau 1/4), geo-fr-dept-74.json un fichier
// vendorisé au format de scripts/fetch-geo-fr.mjs (anneau 1/8), et
// geo-fr-recherche-toulon.json la réponse de recherche TELLE QUELLE — c'est
// elle qui contient le piège : l'API classe Toulonjac (755 hab) devant Toulon.
const fixture = (nom) => JSON.parse(readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8'))
const LOVAGNY = fixture('geo-fr-commune-lovagny.json')
const DEPT_74 = fixture('geo-fr-dept-74.json')
const TOULON = fixture('geo-fr-recherche-toulon.json')

// index vendorisé réduit — mêmes champs que public/geo/fr/index.json
const INDEX = {
  version: 1,
  entites: [
    { nom: 'Haute-Savoie', norm: 'haute savoie', code: '74', niveau: 'departement', centre: [6.44, 46.06] },
    { nom: 'Savoie', norm: 'savoie', code: '73', niveau: 'departement', centre: [6.43, 45.47] },
    { nom: 'Bretagne', norm: 'bretagne', code: '53', niveau: 'region', centre: [-2.83, 48.18] },
    { nom: 'Auvergne-Rhône-Alpes', norm: 'auvergne rhone alpes', code: '84', niveau: 'region', centre: [4.53, 45.35] },
    { nom: "Côtes-d'Armor", norm: 'cotes d armor', code: '22', niveau: 'departement', centre: [-2.86, 48.45] },
  ],
}

// fetch factice : une table url → réponse. Enregistre les appels pour vérifier
// la déduplication et les URL construites.
function fakeFetch(routes) {
  const calls = []
  const fn = async (url) => {
    calls.push(String(url))
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    if (key === undefined) return { ok: false, status: 404, json: async () => null }
    const v = routes[key]
    if (v instanceof Error) throw v
    return { ok: true, status: 200, json: async () => v }
  }
  fn.calls = calls
  return fn
}

const opts = (fetchImpl) => ({ fetchImpl, baseUrl: 'geo/fr/' })

// ---------------------------------------------------------------- normalisation

test('normalizeFR : accents, casse et tirets tombent sur la même clé', () => {
  assert.equal(normalizeFR('Haute-Savoie'), 'haute savoie')
  assert.equal(normalizeFR('haute savoie'), 'haute savoie')
  assert.equal(normalizeFR('HAUTE SAVOIE'), 'haute savoie')
  assert.equal(normalizeFR('  Haute   Savoie  '), 'haute savoie')
})

test('normalizeFR : apostrophes droites et typographiques valent un espace', () => {
  assert.equal(normalizeFR("Côtes-d'Armor"), 'cotes d armor')
  assert.equal(normalizeFR('Côtes-d’Armor'), 'cotes d armor')
  assert.equal(normalizeFR('cotes d armor'), 'cotes d armor')
})

test('normalizeFR : St et Ste sont dépliés en Saint et Sainte', () => {
  assert.equal(normalizeFR("St-Martin-d'Uriage"), 'saint martin d uriage')
  assert.equal(normalizeFR("Saint-Martin-d'Uriage"), 'saint martin d uriage')
  assert.equal(normalizeFR('Ste-Foy'), 'sainte foy')
  // …mais pas un mot qui COMMENCE par st : Strasbourg reste Strasbourg
  assert.equal(normalizeFR('Strasbourg'), 'strasbourg')
})

// RÉGRESSION mesurée en vrai le 2026-07-26 sur geo.api.gouv.fr.
//
// La clé de comparaison (normalizeFR) écrase l'apostrophe en espace — parfait
// pour comparer deux noms chez nous, DÉSASTREUX comme requête : l'API rend
//   nom=saint martin d uriage  → 0 résultat
//   nom=saint-martin-d'uriage  → Saint-Martin-d'Uriage
// Même chose pour « les sables d olonne » (vide) contre « les sables d'olonne »
// (Les Sables-d'Olonne). Ce qui part sur le réseau n'est donc PAS la clé : c'est
// la frappe de l'utilisateur, avec ses apostrophes, et seulement St → Saint
// déplié (l'API, elle, ne connaît pas l'abréviation).
test("apiQueryFR : l'apostrophe SURVIT — l'API ne trouve rien sans elle", () => {
  assert.equal(apiQueryFR("St-Martin-d'Uriage"), "Saint-Martin-d'Uriage")
  assert.equal(apiQueryFR('Côtes-d’Armor'), "Côtes-d'Armor") // ’ typographique → '
  assert.equal(apiQueryFR("les sables d'olonne"), "les sables d'olonne")
})

test('apiQueryFR : St et Ste dépliés, mais jamais un mot qui commence par st', () => {
  assert.equal(apiQueryFR('Ste-Foy-lès-Lyon'), 'Sainte-Foy-lès-Lyon')
  assert.equal(apiQueryFR('st etienne'), 'Saint etienne')
  assert.equal(apiQueryFR('Strasbourg'), 'Strasbourg')
  assert.equal(apiQueryFR('Brest'), 'Brest')
})

test('dropArticleFR : « Le Havre » se cherche aussi par « Havre »', () => {
  assert.equal(dropArticleFR('le havre'), 'havre')
  assert.equal(dropArticleFR('la rochelle'), 'rochelle')
  assert.equal(dropArticleFR('les sables d olonne'), 'sables d olonne')
  assert.equal(dropArticleFR('haute savoie'), 'haute savoie') // rien à retirer
})

// ---------------------------------------------------------------- classement

test('rankFR : le nom EXACT passe devant, quel que soit l’ordre de l’API', () => {
  // le piège vérifié en vrai : geo.api.gouv.fr rend Toulonjac (755 hab) avant
  // Toulon (179 000) parce que son _score favorise les noms courts.
  const bruts = TOULON.map((c) => ({
    nom: c.nom,
    code: c.code,
    niveau: 'commune',
    population: c.population,
    centre: c.centre.coordinates,
  }))
  assert.equal(bruts[0].nom, 'Toulonjac', 'la fixture doit bien contenir le mauvais ordre')
  const out = rankFR('Toulon', bruts)
  assert.equal(out[0].nom, 'Toulon')
  assert.equal(out[0].code, '83137')
})

test('rankFR : à nom identique, la population décide', () => {
  const out = rankFR('Bretagne', [
    { nom: 'Bretagne', code: '36024', niveau: 'commune', population: 125 },
    { nom: 'Bretagne', code: '90019', niveau: 'commune', population: 319 },
  ])
  assert.deepEqual(out.map((c) => c.code), ['90019', '36024'])
})

test('rankFR : à nom exact identique, l’entité la plus vaste passe devant', () => {
  // « Bretagne » : deux hameaux portent ce nom, mais on cherche la région.
  const out = rankFR('Bretagne', [
    { nom: 'Bretagne', code: '90019', niveau: 'commune', population: 319 },
    { nom: 'Bretagne', code: '53', niveau: 'region' },
  ])
  assert.equal(out[0].niveau, 'region')
  assert.equal(out[0].code, '53')
})

test('rankFR : un préfixe passe devant un simple fragment', () => {
  const out = rankFR('Toulon', [
    { nom: 'Vert-Toulon', code: '51611', niveau: 'commune', population: 281 },
    { nom: 'Toulon-sur-Arroux', code: '71542', niveau: 'commune', population: 1433 },
  ])
  assert.equal(out[0].code, '71542')
})

test('rankFR : l’article de tête ne cache pas la commune', () => {
  const out = rankFR('Havre', [
    { nom: 'Havrincourt', code: '62428', niveau: 'commune', population: 200 },
    { nom: 'Le Havre', code: '76351', niveau: 'commune', population: 166687 },
  ])
  assert.equal(out[0].code, '76351')
})

test('rankFR : ce qui ne correspond à rien disparaît', () => {
  const out = rankFR('Toulon', [{ nom: 'Annecy', code: '74010', niveau: 'commune', population: 130000 }])
  assert.deepEqual(out, [])
})

// ---------------------------------------------------------------- géométrie
// LE format de sortie : celui que frameRegion et rasterizeMask consomment déjà,
// c'est-à-dire des coordonnées de MultiPolygon — un tableau de POLYGONES, et
// chaque polygone un tableau d'anneaux dont le premier est l'extérieur.

test('geometryToParts : un Polygon devient UNE entrée, anneau extérieur en [0]', () => {
  const parts = geometryToParts({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] })
  assert.equal(parts.length, 1)
  assert.deepEqual(parts[0][0][0], [0, 0])
})

test('geometryToParts : un MultiPolygon devient PLUSIEURS entrées', () => {
  const parts = geometryToParts({
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      [[[5, 5], [6, 5], [6, 6], [5, 5]]],
    ],
  })
  assert.equal(parts.length, 2)
  assert.deepEqual(parts[1][0][0], [5, 5])
})

test('geometryToParts : les trous (enclaves) survivent, rasterizeMask sait les creuser', () => {
  const parts = geometryToParts({
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 0]],
      [[4, 4], [5, 4], [5, 5], [4, 4]],
    ],
  })
  assert.equal(parts[0].length, 2, 'anneau extérieur + trou')
})

test('geometryToParts : une géométrie sans surface rend une liste vide, jamais null', () => {
  assert.deepEqual(geometryToParts(null), [])
  assert.deepEqual(geometryToParts({ type: 'Point', coordinates: [1, 2] }), [])
  assert.deepEqual(geometryToParts({ type: 'Polygon', coordinates: [] }), [])
})

test('le format passe TEL QUEL dans frameRegion — le vrai contrat', () => {
  const parts = geometryToParts(DEPT_74.geometry)
  const f = frameRegion(parts)
  assert.ok(f, 'frameRegion doit savoir cadrer nos parts')
  // Haute-Savoie : centre vers 6,4°E / 46,05°N
  assert.ok(Math.abs(f.lon - 6.44) < 0.3, `lon ${f.lon}`)
  assert.ok(Math.abs(f.lat - 46.06) < 0.3, `lat ${f.lat}`)
  assert.ok(f.zoom >= 4 && f.zoom <= 15, `zoom ${f.zoom}`)
})

// ---------------------------------------------------------------- index vendorisé

test('loadIndexFR ne charge l’index QU’UNE FOIS, même en appels croisés', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX })
  const [a, b] = await Promise.all([loadIndexFR(opts(f)), loadIndexFR(opts(f))])
  assert.equal(a, b)
  assert.equal(f.calls.length, 1, 'requêtes en vol dédupliquées')
  await loadIndexFR(opts(f))
  assert.equal(f.calls.length, 1, 'et mémorisées ensuite')
})

test('un index en échec est évincé du cache : la tentative suivante repart', async () => {
  clearGeoFRCache()
  const casse = fakeFetch({})
  await assert.rejects(() => loadIndexFR(opts(casse)))
  const bon = fakeFetch({ 'geo/fr/index.json': INDEX })
  const idx = await loadIndexFR(opts(bon))
  assert.equal(idx.entites.length, 5)
})

// ---------------------------------------------------------------- recherche

test('searchFR : « haute savoie » rend le département 74', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': [] })
  const out = await searchFR('haute savoie', opts(f))
  assert.equal(out[0].niveau, 'departement')
  assert.equal(out[0].code, '74')
  assert.deepEqual(out[0].centre, [6.44, 46.06])
})

test('searchFR : « HAUTE-SAVOIE » et « haute savoie » donnent le même premier résultat', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': [] })
  const a = await searchFR('HAUTE-SAVOIE', opts(f))
  const b = await searchFR('haute savoie', opts(f))
  assert.equal(a[0].code, b[0].code)
})

test('searchFR : « Toulon » rend la commune de Toulon en premier, pas Toulonjac', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': TOULON })
  const out = await searchFR('Toulon', opts(f))
  assert.equal(out[0].nom, 'Toulon')
  assert.equal(out[0].code, '83137')
  assert.equal(out[0].niveau, 'commune')
  assert.equal(out[0].population, 179116)
  assert.deepEqual(out[0].centre, [5.9334, 43.1364])
})

test('searchFR : la requête commune part avec le nom DÉPLIÉ ET son apostrophe', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': [] })
  await searchFR("St-Martin-d'Uriage", opts(f))
  const req = f.calls.find((u) => u.includes('geo.api.gouv.fr'))
  assert.ok(req, 'une requête commune doit partir')
  assert.equal(decodeURIComponent(req).includes("nom=Saint-Martin-d'Uriage"), true, req)
  // et SANS contour : une recherche ne rapatrie jamais 35 000 polygones
  assert.ok(!req.includes('contour'), `la recherche ne doit pas demander de contour : ${req}`)
})

test('searchFR : deux frappes qui ne diffèrent que par la casse partagent le cache réseau', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': TOULON })
  await searchFR('Toulon', opts(f))
  await searchFR('TOULON', opts(f))
  assert.equal(f.calls.filter((u) => u.includes('geo.api.gouv.fr')).length, 1)
})

test('searchFR : l’API communes hors service ne doit pas effacer les départements', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': new Error('réseau coupé') })
  const out = await searchFR('savoie', opts(f))
  assert.ok(out.length >= 1)
  assert.equal(out[0].code, '73')
})

test('searchFR : une requête vide ne part pas sur le réseau', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX })
  assert.deepEqual(await searchFR('   ', opts(f)), [])
  assert.equal(f.calls.length, 0)
})

test('searchFR : deux recherches identiques ne tapent l’API commune qu’une fois', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/index.json': INDEX, 'geo.api.gouv.fr': TOULON })
  await Promise.all([searchFR('Toulon', opts(f)), searchFR('Toulon', opts(f))])
  const communes = f.calls.filter((u) => u.includes('geo.api.gouv.fr'))
  assert.equal(communes.length, 1)
})

// ---------------------------------------------------------------- contours

test('contourFR : une commune va chercher son contour à la demande', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo.api.gouv.fr': LOVAGNY })
  const parts = await contourFR({ nom: 'Lovagny', code: '74152', niveau: 'commune' }, opts(f))
  assert.equal(parts.length, 1)
  const box = bbox(parts)
  // Lovagny (Haute-Savoie, gorges du Fier) : 6,03–6,05°E / 45,90–45,92°N
  assert.ok(box.lonMin > 6.0 && box.lonMax < 6.07, `lon ${box.lonMin}…${box.lonMax}`)
  assert.ok(box.latMin > 45.87 && box.latMax < 45.95, `lat ${box.latMin}…${box.latMax}`)
  assert.match(f.calls[0], /communes\/74152/)
})

test('contourFR : un département lit SON fichier vendorisé, pas le fichier global', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/dept-74.json': DEPT_74 })
  const parts = await contourFR({ nom: 'Haute-Savoie', code: '74', niveau: 'departement' }, opts(f))
  assert.ok(parts.length >= 1)
  assert.equal(f.calls.length, 1)
  assert.match(f.calls[0], /geo\/fr\/dept-74\.json$/)
  assert.ok(!f.calls[0].includes('departements.json'), 'jamais le fichier global de 3,4 Mo')
})

test('contourFR : une région lit region-<code>.json', async () => {
  clearGeoFRCache()
  const f = fakeFetch({
    'geo/fr/region-53.json': { code: '53', nom: 'Bretagne', niveau: 'region', geometry: DEPT_74.geometry },
  })
  const parts = await contourFR({ nom: 'Bretagne', code: '53', niveau: 'region' }, opts(f))
  assert.ok(parts.length >= 1)
  assert.match(f.calls[0], /geo\/fr\/region-53\.json$/)
})

test('contourFR : le même contour n’est téléchargé qu’une fois', async () => {
  clearGeoFRCache()
  const f = fakeFetch({ 'geo/fr/dept-74.json': DEPT_74 })
  const cand = { nom: 'Haute-Savoie', code: '74', niveau: 'departement' }
  await Promise.all([contourFR(cand, opts(f)), contourFR(cand, opts(f))])
  await contourFR(cand, opts(f))
  assert.equal(f.calls.length, 1)
})

test('contourFR : un contour manquant rend une liste vide, l’appelant garde son bloc carré', async () => {
  clearGeoFRCache()
  const f = fakeFetch({})
  assert.deepEqual(await contourFR({ nom: 'X', code: '99', niveau: 'departement' }, opts(f)), [])
  assert.deepEqual(await contourFR(null, opts(f)), [])
})

test('contourFR : un contour raté est évincé du cache, on peut réessayer', async () => {
  clearGeoFRCache()
  const cand = { nom: 'Haute-Savoie', code: '74', niveau: 'departement' }
  assert.deepEqual(await contourFR(cand, opts(fakeFetch({}))), [])
  const bon = fakeFetch({ 'geo/fr/dept-74.json': DEPT_74 })
  assert.ok((await contourFR(cand, opts(bon))).length >= 1)
})

// emprise lon/lat d'une liste de parts
function bbox(parts) {
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity
  for (const rings of parts) {
    for (const [lon, lat] of rings[0]) {
      if (lon < lonMin) lonMin = lon
      if (lon > lonMax) lonMax = lon
      if (lat < latMin) latMin = lat
      if (lat > latMax) latMax = lat
    }
  }
  return { lonMin, lonMax, latMin, latMax }
}
