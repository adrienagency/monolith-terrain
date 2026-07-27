import { test } from 'node:test'
import assert from 'node:assert/strict'
import { incomingWaypoints, resolveWaypointKm } from '../src/route-entry.js'

// --------------------------------------------------------------- fabriques

// trace : n points reliés, plus les <wpt> qu'on veut poser à côté
const gpx = (pts, wpts = '') =>
  `<?xml version="1.0"?><gpx version="1.1">${wpts}<trk><name>T</name><trkseg>${pts
    .map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"><ele>10</ele></trkpt>`)
    .join('')}</trkseg></trk></gpx>`

const wpt = (la, lo, name, ele) =>
  `<wpt lat="${la}" lon="${lo}">${name != null ? `<name>${name}</name>` : ''}${ele != null ? `<ele>${ele}</ele>` : ''}</wpt>`

// une trace droite ~1 km entre chaque point (0,00899° de latitude ≈ 1 km)
const LINE = [[45, 6], [45.00899, 6], [45.01798, 6], [45.02697, 6]]
const TRACK = {
  points: LINE.map(([lat, lon]) => ({ lat, lon, ele: 100 })),
  cumKm: [0, 1, 2, 3],
}

// ------------------------------------------------- ce que porte le contenu

test('un GPX sans <wpt> porte zéro point de passage — pas « rien à faire »', () => {
  // [] et non null : c'est bien un parcours neuf, donc une remise à zéro
  assert.deepEqual(incomingWaypoints(gpx(LINE)), [])
})

test('un GPX avec des <wpt> les rend, nom et altitude compris', () => {
  const out = incomingWaypoints(gpx(LINE, wpt(45.00899, 6, 'Ravito', 812)))
  assert.equal(out.length, 1)
  assert.equal(out[0].name, 'Ravito')
  assert.equal(out[0].alt, 812)
  assert.equal(out[0].lat, 45.00899)
  assert.equal(out[0].lon, 6)
  assert.equal(out[0].km, null) // le km ne se connaît qu'une fois la trace là
})

test('un <wpt> sans nom reste un point de passage', () => {
  // l'organisateur le nommera dans le studio ; l'inventer ici serait mentir
  const out = incomingWaypoints(gpx(LINE, wpt(45.00899, 6)))
  assert.equal(out.length, 1)
  assert.equal(out[0].name, '')
})

test('des <wpt> aux coordonnées illisibles sont ignorés', () => {
  const out = incomingWaypoints(gpx(LINE, `<wpt lat="abc" lon="6"><name>X</name></wpt>` + wpt(45.009, 6, 'Bon')))
  assert.equal(out.length, 1)
  assert.equal(out[0].name, 'Bon')
})

test('un GPX de <wpt> NUS remet à zéro sans se recopier en repères', () => {
  // ces <wpt> SONT la trace (parseGpx retombe dessus) — les compter aussi comme
  // points de passage doublerait chaque borne d'un road-book
  const nus = `<gpx>${wpt(45, 6, 'A')}${wpt(45.01, 6, 'B')}</gpx>`
  assert.deepEqual(incomingWaypoints(nus), [])
})

test('un contenu sans aucun parcours ne dit RIEN — on ne touche à rien', () => {
  // le contre-test qui compte : changer de palette n'efface pas les repères
  assert.equal(incomingWaypoints('{"format":"shibumap-template","look":{"gpxColor":"#f00"}}'), null)
  assert.equal(incomingWaypoints(''), null)
  assert.equal(incomingWaypoints(null), null)
  assert.equal(incomingWaypoints('<gpx></gpx>'), null)
})

// ----------------------------------------------------------- le cas JSON

test('un projet .shibumap-race rend SES points de passage, en km', () => {
  const bundle = {
    format: 'shibumap-race',
    race: { name: 'Trail', waypoints: [{ km: 2, name: 'Col', pictos: ['eau'], cutoff: '12:00' }] },
    gpx: gpx(LINE),
  }
  const out = incomingWaypoints(bundle)
  assert.equal(out.length, 1)
  assert.equal(out[0].km, 2)
  assert.equal(out[0].name, 'Col')
  assert.deepEqual(out[0].pictos, ['eau'])
  assert.equal(out[0].cutoff, '12:00')
})

test('un projet sans points de passage remet à zéro', () => {
  assert.deepEqual(incomingWaypoints({ format: 'shibumap-race', race: { name: 'Trail', waypoints: [] }, gpx: gpx(LINE) }), [])
})

test('un projet dont la trace est vide ne dit rien', () => {
  // pas de trace = pas de nouveau parcours, même si le fichier parle de course
  assert.equal(incomingWaypoints({ format: 'shibumap-race', race: { waypoints: [{ km: 1, name: 'X' }] }, gpx: '' }), null)
})

test('le projet fait foi sur les <wpt> du GPX qu’il embarque', () => {
  // l'organisateur a réglé ses points dans le studio ; le GPX brut est la source
  const bundle = { race: { waypoints: [{ km: 1, name: 'Studio' }] }, gpx: gpx(LINE, wpt(45.009, 6, 'Montre')) }
  assert.deepEqual(incomingWaypoints(bundle).map((w) => w.name), ['Studio'])
})

test('le texte JSON et l’objet analysé disent la même chose', () => {
  const bundle = { format: 'shibumap-race', race: { waypoints: [{ km: 2, name: 'Col' }] }, gpx: gpx(LINE) }
  assert.deepEqual(incomingWaypoints(JSON.stringify(bundle)), incomingWaypoints(bundle))
})

// ------------------------------------------------- accrochage à la trace

test('un <wpt> posé sur la trace prend le km du point le plus proche', () => {
  const out = resolveWaypointKm([{ lat: 45.01798, lon: 6, name: 'Col', alt: null, km: null, pictos: [], cutoff: '' }], TRACK)
  assert.equal(out.length, 1)
  assert.equal(out[0].km, 2)
})

test('un <wpt> sans altitude hérite de celle de la trace', () => {
  const out = resolveWaypointKm([{ lat: 45.01798, lon: 6, name: 'Col', alt: null, km: null, pictos: [], cutoff: '' }], TRACK)
  assert.equal(out[0].alt, 100)
})

test('un <wpt> loin de la trace est écarté', () => {
  // un repère à 40 km n'appartient pas à ce parcours — l'accrocher au point le
  // plus proche poserait un cartouche mensonger au bord de la trace
  const out = resolveWaypointKm([{ lat: 45.4, lon: 6, name: 'Ailleurs', alt: null, km: null, pictos: [], cutoff: '' }], TRACK)
  assert.deepEqual(out, [])
})

test('les points déjà exprimés en km passent tels quels', () => {
  const out = resolveWaypointKm([{ km: 1.5, name: 'Col', alt: 900, lat: null, lon: null, pictos: [], cutoff: '' }], TRACK)
  assert.equal(out[0].km, 1.5)
  assert.equal(out[0].alt, 900)
})

test('les points ressortent triés par km', () => {
  const out = resolveWaypointKm(
    [
      { lat: 45.02697, lon: 6, name: 'Fin', alt: null, km: null, pictos: [], cutoff: '' },
      { lat: 45.00899, lon: 6, name: 'Début', alt: null, km: null, pictos: [], cutoff: '' },
    ],
    TRACK
  )
  assert.deepEqual(out.map((w) => w.name), ['Début', 'Fin'])
})

test('sans trace, l’accrochage ne lève pas et ne garde que les km', () => {
  assert.deepEqual(resolveWaypointKm([{ lat: 45, lon: 6, name: 'X', km: null, alt: null, pictos: [], cutoff: '' }], null), [])
  assert.deepEqual(resolveWaypointKm(null, TRACK), [])
})
