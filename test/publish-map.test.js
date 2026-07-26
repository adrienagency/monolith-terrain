import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeGpx, refillBucket, clientIp } from '../netlify/functions/race.mjs'
import { sharePageHtml } from '../netlify/functions/share.mjs'
import { parseRacePayload } from '../src/share-link.js'

// Publier une carte SANS course : c'est le seul partage court et
// prévisualisable qui existe. Avant, seule une carte avec GPX publiait, et
// tout le reste tombait sur un lien #s= d'environ 2 900 caractères — coupé par
// les messageries, cassé par les clients mail, sans aucun aperçu puisqu'un
// fragment n'atteint jamais le serveur.

const BASE = { fov: 30, vignette: 0.6 }
const state = () => ({ format: 'shibumap-share', v: 1, loc: { lat: -21.26, lon: 55.74, zoom: 12 }, look: { fov: 33 } })

test('a payload with a state but no course is accepted', () => {
  const p = parseRacePayload({ gpx: null, state: state() }, BASE)
  assert.ok(p, 'une carte nue doit se restaurer')
  assert.equal(p.gpx, null)
  assert.equal(p.state.loc.zoom, 12)
})

test('a payload with neither course nor state has nothing to restore and is refused', () => {
  assert.equal(parseRacePayload({ gpx: null }, BASE), null)
  assert.equal(parseRacePayload({}, BASE), null)
  assert.equal(parseRacePayload({ gpx: null, state: 'pas un objet' }, BASE), null)
})

test('a course that IS present must still be a sane bounded string', () => {
  assert.equal(parseRacePayload({ gpx: 42, state: state() }, BASE), null, 'un nombre n’est pas un GPX')
  assert.equal(parseRacePayload({ gpx: '', state: state() }, BASE), null, 'chaîne vide')
  assert.equal(parseRacePayload({ gpx: 'x'.repeat(3_000_000), state: state() }, BASE), null, 'dépasse le plafond')
})

// Le serveur n'exige plus de GPX, mais un GPX présent doit rester du GPX.
test('looksLikeGpx still rejects a present-but-bogus track', () => {
  assert.equal(looksLikeGpx('<html><body>coucou</body></html>'), false)
  assert.equal(looksLikeGpx('<gpx><trkpt lat="1.0" lon="2.0"/></gpx>'), false, 'un seul point ne fait pas une trace')
  assert.ok(looksLikeGpx('<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/></trkseg></trk></gpx>'))
})

// ---- l'aperçu du lien -----------------------------------------------------
test('the preview card does not call a plain map a race', () => {
  const course = sharePageHtml({ id: 'abc123', raceName: 'La Grande Traversée', hasCourse: true })
  assert.match(course, /the course of La Grande Travers/)

  const carte = sharePageHtml({ id: 'abc123', raceName: 'La Réunion', hasCourse: false })
  assert.match(carte, /La R.*union, as a 3D relief map/)
  assert.ok(!/course/i.test(carte), 'aucune mention de « course » pour une carte nue')

  const nue = sharePageHtml({ id: 'abc123', raceName: '', hasCourse: false })
  assert.match(nue, /A map on ShibuMap/)
})

test('the preview still escapes a name a stranger typed, course or not', () => {
  const html = sharePageHtml({ id: 'abc123', raceName: '<script>alert(1)</script>', hasCourse: false })
  assert.ok(!html.includes('<script>alert(1)</script>'))
})

// ---- la limitation de débit ----------------------------------------------
// Elle devient nécessaire le jour où n'importe quel visiteur peut écrire :
// jusque-là il fallait avoir chargé une vraie trace, ce qui freinait de fait.
test('the bucket refills continuously, with no window edge that rearms everything at once', () => {
  const cap = 12
  const win = 600_000
  const vide = { tokens: 0, at: 1_000_000 }
  // à mi-fenêtre on a récupéré la moitié du seau, pas zéro et pas tout
  const moitie = refillBucket(vide, 1_000_000 + win / 2, cap, win)
  assert.ok(Math.abs(moitie.tokens - cap / 2) < 1e-6, `attendu ~6, obtenu ${moitie.tokens}`)
  // et jamais plus que la capacité, même après très longtemps
  assert.equal(refillBucket(vide, 1_000_000 + win * 50, cap, win).tokens, cap)
})

test('an unknown bucket starts full — a first-time visitor is never throttled', () => {
  assert.equal(refillBucket(null, 5_000, 12, 600_000).tokens, 12)
  assert.equal(refillBucket(undefined, 5_000, 12, 600_000).tokens, 12)
  assert.equal(refillBucket({ tokens: 'nawak', at: 'nawak' }, 5_000, 12, 600_000).tokens, 12)
})

test('a clock that jumps backwards cannot mint tokens', () => {
  const bucket = { tokens: 3, at: 2_000_000 }
  const back = refillBucket(bucket, 1_000_000, 12, 600_000) // « avant » le dernier passage
  assert.equal(back.tokens, 3, 'un temps négatif ne doit rien créditer')
})

test('the client IP comes from Netlify first, then the FIRST x-forwarded-for entry', () => {
  const h = (o) => ({ get: (k) => o[k] ?? null })
  assert.equal(clientIp(h({ 'x-nf-client-connection-ip': '203.0.113.7' })), '203.0.113.7')
  // le client est en tête ; les suivants sont des relais et sont falsifiables
  assert.equal(clientIp(h({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })), '203.0.113.7')
  assert.equal(clientIp(h({})), '')
})
