import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasCourse, routeEntryFor } from '../src/route-entry.js'

// petit GPX minimal : n points de trace, rien d'autre
const gpx = (...pts) =>
  `<?xml version="1.0"?><gpx version="1.1"><trk><name>T</name><trkseg>${pts
    .map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"><ele>10</ele></trkpt>`)
    .join('')}</trkseg></trk></gpx>`

const TWO = gpx([45.9, 6.87], [45.91, 6.88])

// ---------------------------------------------------------------- la TRACE
test('deux points de trace = un parcours', () => {
  assert.equal(hasCourse(TWO), true)
})

test('un seul point n’est pas un parcours', () => {
  assert.equal(hasCourse(gpx([45.9, 6.87])), false)
})

test('des <wpt> nus ne font pas un parcours', () => {
  // des repères posés sur une carte, sans tracé qui les relie
  assert.equal(
    hasCourse('<gpx><wpt lat="45" lon="6"/><wpt lat="46" lon="7"/></gpx>'),
    false
  )
})

test('un itinéraire <rtept> compte comme une trace', () => {
  assert.equal(hasCourse('<gpx><rte><rtept lat="45" lon="6"/><rtept lat="46" lon="7"/></rte></gpx>'), true)
})

test('des coordonnées illisibles ou hors du globe ne comptent pas', () => {
  assert.equal(hasCourse('<gpx><trkpt lat="abc" lon="6"/><trkpt lat="45" lon="6"/></gpx>'), false)
  assert.equal(hasCourse('<gpx><trkpt lat="945" lon="6"/><trkpt lat="45" lon="600"/></gpx>'), false)
  assert.equal(hasCourse('<gpx><trkpt lon="6"/><trkpt lat="45"/></gpx>'), false)
})

test('un fichier vide, nul ou illisible ne porte rien', () => {
  for (const v of [null, undefined, '', '   ', 42, {}, [], '<gpx></gpx>', 'pas du xml du tout']) {
    assert.equal(hasCourse(v), false, `${JSON.stringify(v)} ne devrait porter aucune trace`)
  }
})

// ------------------------------------------------- les CONTENANTS de trace
test('un projet .shibumap-race analysé porte sa trace', () => {
  assert.equal(hasCourse({ race: { name: 'X' }, look: {}, gpxText: TWO }), true)
  assert.equal(hasCourse({ race: { name: 'X' }, look: {}, gpxText: '' }), false)
})

test('un projet .shibumap-race encore sous forme de texte porte sa trace', () => {
  assert.equal(hasCourse(JSON.stringify({ format: 'shibumap-race', version: 1, race: {}, gpx: TWO })), true)
  assert.equal(hasCourse(JSON.stringify({ format: 'shibumap-race', version: 1, race: {}, gpx: '' })), false)
})

test('un payload de lien publié porte sa trace — ou pas', () => {
  assert.equal(hasCourse({ gpx: TWO, logo: null, state: {}, race: null }), true)
  // une carte nue publiée : un état, aucune course
  assert.equal(hasCourse({ gpx: null, logo: null, state: { look: {} }, race: null }), false)
})

test('une trace déjà analysée (points en mémoire) compte', () => {
  assert.equal(hasCourse({ track: { points: [{ lat: 45, lon: 6 }, { lat: 46, lon: 7 }] } }), true)
  assert.equal(hasCourse({ points: [{ lat: 45, lon: 6 }] }), false)
  assert.equal(hasCourse({ points: [{ lat: NaN, lon: 6 }, { lat: 46, lon: 7 }] }), false)
})

// ---------------------------------------------------------- le CONTRE-TEST
// C'est le cas qui compte le plus : le style de tracé (gpxColor, gpxWidth…)
// voyage dans TOUS les gabarits, alors que la trace elle-même n'y est jamais.
// Renifler les clés « gpx* » ferait basculer sur un simple changement de look.
test('un gabarit sans trace ne porte AUCUN parcours, même bardé de clés gpx*', () => {
  const tpl = {
    format: 'shibumap-template',
    version: 1,
    name: 'Ardoise',
    look: { gpxColor: '#ff4d00', gpxWidth: 3, gpxGradient: true, gpxMarkers: true, rampStops: [] },
  }
  assert.equal(hasCourse(tpl), false)
  assert.equal(hasCourse(JSON.stringify(tpl)), false)
  assert.equal(routeEntryFor(tpl, { advanced: true }), null)
  assert.equal(routeEntryFor(tpl, { advanced: false }), null)
})

test('un gabarit qui PORTE une trace bascule quand même', () => {
  // le format ne l'interdit pas ; c'est le contenu qui décide, pas l'en-tête
  const tpl = { format: 'shibumap-template', version: 1, name: 'Course', look: {}, gpx: TWO }
  assert.equal(hasCourse(tpl), true)
  assert.equal(routeEntryFor(tpl, { advanced: true }), 'workmode-parcours')
})

// ------------------------------------------------------------ la DÉCISION
test('la bascule suit le NIVEAU de l’utilisateur, jamais le fichier', () => {
  assert.equal(routeEntryFor(TWO, { advanced: true }), 'workmode-parcours')
  assert.equal(routeEntryFor(TWO, { advanced: false }), 'race-studio')
})

test('sans trace, rien ne bascule — quel que soit le niveau', () => {
  for (const advanced of [true, false]) {
    assert.equal(routeEntryFor(gpx([45.9, 6.87]), { advanced }), null)
    assert.equal(routeEntryFor(null, { advanced }), null)
    assert.equal(routeEntryFor({ look: {} }, { advanced }), null)
  }
})

test('le niveau absent est traité comme simple — le débutant n’est jamais jeté dans les panneaux', () => {
  assert.equal(routeEntryFor(TWO), 'race-studio')
  assert.equal(routeEntryFor(TWO, {}), 'race-studio')
})
