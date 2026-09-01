// LES SOMMETS : SEUIL D'IMPORTANCE, ANCRAGE, ET COÛT RÉSEAU — Tâche R24.
//
// ⛔ **CE QUI EST GARDÉ ICI EST UN COMPORTEMENT.** `PeaksLayer.update()` ne se
// charge pas sous node (elle touche le DOM) ; les trois lois sont donc SORTIES
// du corps de la classe pour qu'on puisse les exécuter. Ce dépôt a déjà vu une
// mutation survivre à 4 082 tests derrière une garde par expression régulière.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  minZoomSommet, opaciteSommet, ancrageSommet, DEGAGEMENT_BLOC,
  cleEmprise, videCacheSommets, tailleCacheSommets, fetchTopPeaks,
} from '../src/peaks.js'

// ══════════ ① LE SEUIL D'IMPORTANCE ═══════════════════════════════════════
test('① UN SOMMET GAGNE SON ÉTIQUETTE PAR SON ALTITUDE, et l’ordre est monotone', () => {
  // ⚠️ Le patron est `popToMinZoom` (`map/place-tier.js`) : une bande par cran
  // d'importance, et un seuil qui DESCEND quand l'importance monte.
  const alts = [200, 500, 1000, 2000, 3000, 4500]
  const seuils = alts.map(minZoomSommet)
  for (let i = 1; i < seuils.length; i++) {
    assert.ok(seuils[i] <= seuils[i - 1],
      `${alts[i]} m exige z${seuils[i]} alors que ${alts[i - 1]} m exige z${seuils[i - 1]} — l’ordre est inversé`)
  }
  // les toits d'un continent se voient de loin, les bosses non
  assert.ok(minZoomSommet(4810) < minZoomSommet(300), 'le Mont-Blanc n’apparaît pas avant une bosse de 300 m')
})

test('① bis SANS ALTITUDE, PAS D’IMPORTANCE À FAIRE VALOIR', () => {
  // ⛔ `null`/`NaN` ne doit PAS valoir « très haut » : `Math.max` sur un NaN
  // rendrait NaN, et un `>=` sur NaN rend faux — deux façons opposées de se
  // tromper. On tranche explicitement.
  assert.equal(minZoomSommet(null), 12)
  assert.equal(minZoomSommet(undefined), 12)
  assert.equal(minZoomSommet(NaN), 12)
})

// ══════════ ② D18, RÈGLE 2 — AUCUNE APPARITION EN TOUT-OU-RIEN ════════════
test('② L’ENTRÉE EST CONTINUE : elle part de zéro et monte, jamais un claquement', () => {
  const ELE = 2600 // seuil z8
  assert.equal(minZoomSommet(ELE), 8)
  assert.equal(opaciteSommet(ELE, 6), 0, 'visible bien avant son seuil')
  assert.equal(opaciteSommet(ELE, 7), 0, 'le fondu doit valoir zéro un niveau avant')
  assert.equal(opaciteSommet(ELE, 8), 1, 'le fondu doit être plein AU seuil')
  assert.equal(opaciteSommet(ELE, 9), 1)
  // ⛔ LE POINT DE LA RÈGLE : entre les deux, une valeur STRICTEMENT entre 0 et 1.
  const mi = opaciteSommet(ELE, 7.5)
  assert.ok(mi > 0 && mi < 1, `à mi-chemin l’opacité vaut ${mi} : c’est un claquement, pas une entrée`)
  // et elle est monotone sur toute la traversée
  let prec = -1
  for (let z = 6; z <= 9; z += 0.1) {
    const o = opaciteSommet(ELE, z)
    assert.ok(o >= prec - 1e-12, `l’opacité redescend à z${z.toFixed(1)}`)
    prec = o
  }
})

test('② bis SANS ZOOM CONNU, RIEN N’EST FILTRÉ — le dépôt d’avant, au bit près', () => {
  assert.equal(opaciteSommet(1000, null), 1)
  assert.equal(opaciteSommet(1000, undefined), 1)
})

// ══════════ ③ L'ANCRAGE — LA PREUVE QU'UN REPÈRE N'EST PAS SOUS LE SOL ═════
test('③ L’ANCRE EST AU-DESSUS DES DEUX SOLS, TOUJOURS', () => {
  // ⛔ Le défaut mesuré : à La Réunion z12, sur 169 points, le sol du BLOC est
  // sous le sol DESSINÉ jusqu'à 72 m, et sur 42 points (25 %). Un repère ancré
  // sur le seul `terrain.sample` y est enterré.
  const cas = [
    [6.1862, 5.8913], // le pire point relevé : le globe dessine PLUS HAUT
    [4.2348, 4.0686],
    [3.0, 7.0], // et l'inverse : le bloc plus haut que le dessin
    [-0.1535, -0.4309],
  ]
  for (const [globe, bloc] of cas) {
    const y = ancrageSommet(globe, bloc)
    assert.ok(y >= globe, `ancre ${y} SOUS le sol dessiné ${globe}`)
    assert.ok(y >= bloc, `ancre ${y} SOUS le sol du bloc ${bloc}`)
    assert.equal(y, Math.max(globe, bloc) + DEGAGEMENT_BLOC)
  }
})

test('③ bis UN SOL MANQUANT NE FAIT PAS TOMBER L’ANCRE — `null` n’est pas zéro', () => {
  // ⛔ C'est la mise en garde de `monde/sol-globe.js` : « zéro est le niveau de
  // la mer, et le confondre avec je ne sais pas collerait la rivière à la mer au
  // milieu d'une vallée ».
  assert.equal(ancrageSommet(null, 4), 4 + DEGAGEMENT_BLOC)
  assert.equal(ancrageSommet(NaN, 4), 4 + DEGAGEMENT_BLOC)
  assert.equal(ancrageSommet(6, null), 6 + DEGAGEMENT_BLOC)
  // les deux manquants : on ne descend pas sous le dégagement plutôt que de
  // rendre −Infinity ou NaN, qui feraient disparaître le repère sans rien dire
  assert.equal(ancrageSommet(null, null), DEGAGEMENT_BLOC)
})

test('③ ter MUTATION — sans le maximum, un repère sur quatre passe SOUS le sol dessiné', () => {
  // le correctif naïf (« garder le sol du bloc ») rejoué sur les quatre points
  // relevés : deux d'entre eux enterrent le repère de plus que le dégagement ?
  // non — mais il le rapprochent du sol de la quantité mesurée, et c'est ça qui
  // se voit. On garde la mesure en dur pour que le jour où quelqu'un remet
  // `sample` seul, le test dise POURQUOI c'est faux.
  const globe = 6.1862, bloc = 5.8913
  const naif = bloc + DEGAGEMENT_BLOC
  const juste = ancrageSommet(globe, bloc)
  assert.ok(juste > naif, 'le maximum ne change rien : la loi a été neutralisée')
  const perdu = juste - naif
  assert.ok(Math.abs(perdu - (globe - bloc)) < 1e-12,
    `le naïf perd ${perdu} unité de bloc de dégagement, soit 59 % des 0,5 disponibles`)
})

// ══════════ ④ LE COÛT RÉSEAU — UNE EMPRISE, UNE REQUÊTE ═══════════════════
test('④ LA CLÉ DE CACHE ARRONDIT L’EMPRISE — deux vues identiques ne comptent qu’une fois', () => {
  const a = cleEmprise(-21.383, 55.607, -21.137, 55.871, 500)
  // un dix-millionième de degré (~1 cm) ne fait PAS une seconde requête
  const b = cleEmprise(-21.3830000001, 55.6070000001, -21.1370000001, 55.8710000001, 500)
  assert.equal(a, b, 'un bruit de flottant relance une requête Overpass entière')
  // un centième de degré (~1,1 km), si
  assert.notEqual(a, cleEmprise(-21.373, 55.607, -21.137, 55.871, 500))
  // et le budget fait partie de la clé : l'emprise 3×3 n'en demande pas autant
  assert.notEqual(a, cleEmprise(-21.383, 55.607, -21.137, 55.871, 4500))
})

test('④ bis UNE SECONDE RECONSTRUCTION DE LA MÊME VUE NE TIRE PAS UNE SECONDE REQUÊTE', async () => {
  // ⛔ D18 : « Overpass en direct. Tolérance réelle : < 100 requêtes et < 10 Mo
  // par JOUR. » Ce calque en tirait UNE PAR RECONSTRUCTION DE TERRAIN, donc une
  // par cran de zoom : une descente z12 → z17 en coûtait six.
  videCacheSommets()
  let appels = 0
  const vrai = globalThis.fetch
  globalThis.fetch = async () => {
    appels++
    return { ok: true, json: async () => ({ elements: [{ lat: 1, lon: 2, tags: { name: 'A', ele: '2000' } }] }) }
  }
  // un `dem` de papier : `demSpan` et `worldToLatLon` n'ont besoin que de ça
  const dem = { size: 1536, zoom: 12, originTileX: 2126, originTileY: 1533, extentMeters: 27000, empriseCote: 1 }
  try {
    const a = await fetchTopPeaks(dem)
    const b = await fetchTopPeaks(dem)
    assert.equal(appels, 1, `${appels} requêtes Overpass pour deux reconstructions de la MÊME emprise`)
    assert.deepEqual(a, b)
    assert.equal(tailleCacheSommets(), 1)
    // une AUTRE emprise, elle, doit bien repartir sur le réseau
    await fetchTopPeaks({ ...dem, originTileY: 1540 })
    assert.equal(appels, 2, 'une emprise différente n’a pas relancé de requête : le cache est trop large')
  } finally {
    globalThis.fetch = vrai
    videCacheSommets()
  }
})

test('④ ter L’ÉCHEC EST MÉMORISÉ AUSSI — Overpass injoignable ne doit pas boucler', () => {
  // ⚠️ Mesuré le 2026-09-01 : `overpass-api.de` rend `Connect Timeout` sur ses
  // quatre adresses depuis cette machine, et trois miroirs sur quatre répondent
  // 502. Sans mémoire de l'échec, chaque reconstruction relancerait une requête
  // qui va expirer — et le calque passerait son temps en attente.
  videCacheSommets()
  let appels = 0
  const vrai = globalThis.fetch
  globalThis.fetch = async () => { appels++; throw new Error('Failed to fetch') }
  const dem = { size: 1536, zoom: 12, originTileX: 2126, originTileY: 1533, extentMeters: 27000, empriseCote: 1 }
  const fini = Promise.allSettled([fetchTopPeaks(dem), fetchTopPeaks(dem), fetchTopPeaks(dem)])
  return fini.then((r) => {
    globalThis.fetch = vrai
    assert.equal(appels, 1, `${appels} requêtes pour trois tentatives sur la même emprise`)
    assert.ok(r.every((x) => x.status === 'rejected'), 'l’échec doit remonter, pas être avalé')
    videCacheSommets()
  })
})
