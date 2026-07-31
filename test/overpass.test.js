import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, parseOverpass, bboxKey, WAY_TAG, buildAreaQuery, parseOverpassAreas, assertSaneSize, OVERPASS_MAXSIZE, attendreOuAbandonner, ABANDON, fetchOverpassLines, fetchOverpassAreas, overpassEnPanne, noterPanneOverpass, oublierPanneOverpass, OVERPASS_PANNE_MS } from '../src/map/overpass.js'

const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

test('buildQuery: water uses waterway + south,west,north,east bbox', () => {
  const q = buildQuery(bbox, 'water')
  assert.match(q, /way\["waterway"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

// ---- le calque ROUTES a quitté le site -------------------------------------
// Il était le seul autre client de ce module. Sa disparition emporte
// `roadHighwayFilter()` et le cran de « détail » qui lui servait de variante de
// cache. Ce qui RESTE vrai, et qui vaut désormais pour l'eau : jamais de
// prédicat regex (mesuré sur les routes : 6,5 s et un 504, contre 927 ms pour
// le test de tag nu).

test('plus aucun `kind` routier dans ce module', () => {
  assert.equal(WAY_TAG.roads, undefined)
  assert.deepEqual(Object.keys(WAY_TAG), ['water'])
})

test('la requête reste un test de TAG NU — un prédicat regex 504 sur Overpass', () => {
  const q = buildQuery(bbox, 'water')
  assert.equal(/~/.test(q), false, 'aucun prédicat regex dans la requête')
  assert.match(q, /way\["waterway"\]/)
})

test('parseOverpass keeps ALL vertices, maps tags', () => {
  const json = { elements: [
    { type: 'way', tags: { waterway: 'river', name: 'L’Arve' }, geometry: [ { lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 } ] },
    { type: 'way', tags: { waterway: 'stream' }, geometry: [ { lat: 0, lon: 0 } ] }, // <2 pts dropped
    { type: 'node', lat: 9, lon: 9 }, // non-way ignored
  ] }
  const feats = parseOverpass(json, 'water')
  assert.equal(feats.length, 1)
  assert.deepEqual(feats[0].coords, [ [2, 1], [4, 3], [6, 5] ]) // [lon,lat], all 3 kept
  assert.equal(feats[0].kind, 'river')
  assert.equal(feats[0].name, 'L’Arve')
})

test('bboxKey rounds to 3 decimals', () => {
  assert.equal(bboxKey({ minLat: 45.80001, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }, 'water'), 'water:45.8,6.1,45.95,6.3')
})

test('bboxKey : une entrée de cache par zone+kind, sans troisième argument', () => {
  // La « variante » n'existait que pour distinguer les crans de détail des
  // routes. Un appel qui en traîne encore un ne doit pas fabriquer une clé
  // différente — sinon un même patch se refetcherait pour rien.
  assert.equal(bboxKey(bbox, 'water', 'residu'), bboxKey(bbox, 'water'))
})

test('buildAreaQuery: well-formed water-area query with south,west,north,east bbox', () => {
  const q = buildAreaQuery(bbox)
  assert.match(q, /way\["natural"="water"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /way\["waterway"="riverbank"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /relation\["natural"="water"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

test('parseOverpassAreas: closed way -> one ring', () => {
  const json = { elements: [
    { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 }, { lat: 0, lon: 0 } ] },
  ] }
  const areas = parseOverpassAreas(json)
  assert.equal(areas.length, 1)
  assert.deepEqual(areas[0].ring, [ [0, 0], [1, 0], [1, 1], [0, 1], [0, 0] ])
})

test('parseOverpassAreas: relation contributes one ring per outer member', () => {
  const json = { elements: [
    { type: 'relation', members: [
      { role: 'outer', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 } ] },
      { role: 'outer', geometry: [ { lat: 10, lon: 10 }, { lat: 10, lon: 11 }, { lat: 11, lon: 11 }, { lat: 11, lon: 10 } ] },
      { role: 'inner', geometry: [ { lat: 5, lon: 5 }, { lat: 5, lon: 6 }, { lat: 6, lon: 6 }, { lat: 6, lon: 5 } ] },
    ] },
  ] }
  const areas = parseOverpassAreas(json)
  assert.equal(areas.length, 2)
})

test('parseOverpassAreas: skips a 3-point or open way', () => {
  const openWay = { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0.5 } ] }
  const shortWay = { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 } ] }
  assert.equal(parseOverpassAreas({ elements: [ openWay ] }).length, 0)
  assert.equal(parseOverpassAreas({ elements: [ shortWay ] }).length, 0)
})

// --- payload guard -----------------------------------------------------------
// Regression guard for a measured hang risk: a z12 (24km) bbox over central
// Paris returned 351,414 ways / 238 MB with a 200 OK. Because it SUCCEEDS, the
// "null → Natural Earth" fallback never fires and the tab tries to parse 238 MB.

test('buildQuery: every query carries the maxsize memory ceiling', () => {
  // Plain substring, deliberately not a RegExp: `\[` inside a template literal
  // collapses to `[`, which builds a character CLASS — that assertion matches
  // almost any string and silently tests nothing.
  const needle = `[maxsize:${OVERPASS_MAXSIZE}]`
  for (const kind of Object.keys(WAY_TAG)) {
    assert.ok(buildQuery(bbox, kind).includes(needle), `${kind} query missing ${needle}`)
  }
  assert.ok(buildAreaQuery(bbox).includes(needle), `area query missing ${needle}`)
})

test('assertSaneSize: rejects an oversized body before it is parsed', () => {
  const res = (len) => ({ headers: { get: () => len } })
  assert.throws(() => assertSaneSize(res(String(OVERPASS_MAXSIZE + 1))), /overpass payload/)
  // the real measured Paris case
  assert.throws(() => assertSaneSize(res(String(238 * 1024 * 1024))), /overpass payload/)
})

test('assertSaneSize: lets sane and unmeasurable bodies through', () => {
  const res = (len) => ({ headers: { get: () => len } })
  assert.doesNotThrow(() => assertSaneSize(res(String(15 * 1024 * 1024)))) // Chamonix z12, measured sane
  assert.doesNotThrow(() => assertSaneSize(res(null))) // chunked: no Content-Length → maxsize is the guard
})

// ═══ LE BUDGET D'ATTENTE — la régression du 2026-07-31 ════════════════════════
//
// SYMPTÔME rapporté : « le calque d'eau ne produit RIEN à Chamonix z12 ».
// MESURE in situ (Chrome, page servie, mode ordinaire ET mode continu) : il
// produit 186 objets… au bout de 42 SECONDES. Rien n'était cassé, tout
// attendait. Quatre requêtes vers https://overpass-api.de/api/interpreter
// mouraient en ERR_CONNECTION_TIMED_OUT après 31 à 42 s chacune (l'API est
// injoignable depuis cette machine : `curl` n'établit même pas la connexion).
//
// Le `[timeout:25]` de la requête ne protège de rien ici : c'est le budget
// d'EXÉCUTION du serveur, il ne commence à courir qu'une fois la connexion
// établie. Sans connexion, on tombait sur le délai TCP du navigateur.
//
// Et pendant ce temps, les tuiles Overture — LOCALES, prêtes en moins d'une
// seconde, 256 entités sur cette emprise — attendaient derrière le
// `await Promise.all([fetchOverpassLines, fetchOverpassAreas])` du calque.
// Un enrichissement facultatif tenait en otage la donnée garantie.
//
// C'est ce silence-là que ces tests verrouillent.

test('attendreOuAbandonner : une requête qui ne répond jamais rend null dans le budget', async () => {
  const jamais = new Promise(() => {})
  const t0 = Date.now()
  const r = await attendreOuAbandonner(jamais, 40)
  assert.equal(r, ABANDON, 'passé le budget on rend la main — on ne reste pas suspendu')
  assert.ok(Date.now() - t0 < 400, `rendu en ${Date.now() - t0} ms, budget 40 ms`)
})

test('attendreOuAbandonner : une réponse dans les temps passe INTACTE', async () => {
  // Le budget ne doit jamais couper une requête saine. Mesure de référence du
  // module : la requête à tag nu répondait en 927 ms.
  const r = await attendreOuAbandonner(Promise.resolve(['ok']), 5000)
  assert.deepEqual(r, ['ok'])
})

test('attendreOuAbandonner : abandonner ne laisse pas de minuteur qui traîne', async () => {
  // Un setTimeout non annulé par requête abandonnée, c'est un rebuild qui
  // retient le processus (et, en test node, une suite qui ne rend pas la main).
  let poses = 0
  let annules = 0
  const vraiSet = globalThis.setTimeout
  const vraiClear = globalThis.clearTimeout
  globalThis.setTimeout = (...a) => { poses++; return vraiSet(...a) }
  globalThis.clearTimeout = (...a) => { annules++; return vraiClear(...a) }
  try {
    await attendreOuAbandonner(Promise.resolve(1), 5000) // règle AVANT le budget
  } finally {
    globalThis.setTimeout = vraiSet
    globalThis.clearTimeout = vraiClear
  }
  assert.equal(poses, annules, `${poses} minuteur(s) posé(s), ${annules} annulé(s)`)
})

test('fetchOverpassLines : un point d accès injoignable rend null dans le budget, pas dans 42 s', async () => {
  oublierPanneOverpass()
  let appels = 0
  const fetchImpl = () => { appels++; return new Promise(() => {}) } // ne répond JAMAIS
  const t0 = Date.now()
  const r = await fetchOverpassLines(bbox, 'water', { fetchImpl, minInterval: 0, attenteMs: 60 })
  assert.equal(r, null)
  assert.ok(Date.now() - t0 < 600, `rendu en ${Date.now() - t0} ms`)
  assert.equal(appels, 1)
  assert.ok(overpassEnPanne(), 'un budget épuisé ouvre le disjoncteur : la requête suspendue, elle, ne se rejettera qu au délai TCP (42 s mesurées)')
  oublierPanneOverpass()
})

test('fetchOverpassLines : une réponse saine et rapide N EST PAS coupée', async () => {
  oublierPanneOverpass()
  const json = { elements: [{ type: 'way', tags: { waterway: 'river', name: 'Arve' }, geometry: [{ lat: 45.9, lon: 6.8 }, { lat: 45.91, lon: 6.81 }] }] }
  const fetchImpl = async () => ({ ok: true, headers: { get: () => null }, json: async () => json })
  const r = await fetchOverpassLines({ ...bbox, minLat: 1.111 }, 'water', { fetchImpl, minInterval: 0, attenteMs: 5000 })
  assert.equal(r?.length, 1)
  assert.equal(r[0].kind, 'river')
  oublierPanneOverpass()
})

test('le disjoncteur : après un abandon, la requête suivante ne retente MÊME PAS le réseau', async () => {
  // Sur une machine qui n atteint pas Overpass (celle d Adrien, mesurée), sans
  // ce repos CHAQUE changement de zone repayait le budget d attente. Avec lui,
  // seul le premier le paie ; les suivants retombent tout de suite sur les
  // tuiles locales.
  oublierPanneOverpass()
  let appels = 0
  const fetchImpl = () => { appels++; return Promise.reject(new TypeError('Failed to fetch')) }
  const o = { fetchImpl, minInterval: 0, attenteMs: 500 }
  assert.equal(await fetchOverpassLines({ ...bbox, minLat: 2.221 }, 'water', o), null)
  assert.equal(appels, 1)
  assert.ok(overpassEnPanne(), 'un échec réseau doit ouvrir le disjoncteur')
  assert.equal(await fetchOverpassLines({ ...bbox, minLat: 3.331 }, 'water', o), null)
  assert.equal(await fetchOverpassAreas({ ...bbox, minLat: 4.441 }, o), null)
  assert.equal(appels, 1, 'le réseau ne doit plus être touché pendant le repos')
  oublierPanneOverpass()
})

test('le disjoncteur ne s ouvre PAS sur une erreur de requête (statut HTTP, charge trop grosse)', async () => {
  // Un 400 sur une bbox trop dense (maxsize) ou un 429 ponctuel ne dit RIEN de
  // l accessibilité du point d accès : couper l eau partout pendant une minute
  // pour ça serait une panne fabriquée. Seule l absence de réponse compte.
  oublierPanneOverpass()
  const fetchImpl = async () => ({ ok: false, status: 400, headers: { get: () => null } })
  assert.equal(await fetchOverpassLines({ ...bbox, minLat: 5.551 }, 'water', { fetchImpl, minInterval: 0, attenteMs: 500 }), null)
  assert.equal(overpassEnPanne(), false)
  oublierPanneOverpass()
})

test('le repos du disjoncteur est borné : il se referme tout seul', async () => {
  oublierPanneOverpass()
  const t = 1_000_000
  noterPanneOverpass(t)
  assert.equal(overpassEnPanne(t + OVERPASS_PANNE_MS - 1), true)
  assert.equal(overpassEnPanne(t + OVERPASS_PANNE_MS), false, 'passé le repos, on retente — le réseau a pu revenir')
  oublierPanneOverpass()
})

test('le disjoncteur interdit une requête NEUVE, jamais la lecture d une réponse déjà payée', async () => {
  // Une emprise dont la requête a fini par aboutir doit rendre sa donnée riche
  // même pendant le repos : on n'annule pas les requêtes, il serait absurde de
  // jeter ce qu'elles rapportent. Le cache passe donc AVANT le disjoncteur.
  oublierPanneOverpass()
  const json = { elements: [{ type: 'way', tags: { waterway: 'river' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] }] }
  const fetchImpl = async () => ({ ok: true, headers: { get: () => null }, json: async () => json })
  const zone = { ...bbox, minLat: 6.661 }
  assert.equal((await fetchOverpassLines(zone, 'water', { fetchImpl, minInterval: 0 }))?.length, 1)
  noterPanneOverpass() // le réseau tombe juste après
  assert.equal((await fetchOverpassLines(zone, 'water', { fetchImpl, minInterval: 0 }))?.length, 1, 'la réponse en cache reste lisible')
  assert.equal(await fetchOverpassLines({ ...bbox, minLat: 7.771 }, 'water', { fetchImpl, minInterval: 0 }), null, 'mais aucune requête neuve ne part')
  oublierPanneOverpass()
})
