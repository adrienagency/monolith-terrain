import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleRace } from '../netlify/functions/race.mjs'
import { RACE_SECRET_HEADER, RACE_ENDPOINT, rememberRaceSecret, recallRaceSecret, updateRace } from '../src/share-link.js'

// Un lien publié doit rester LE MÊME quand le parcours change. Sans cela,
// republier fabrique un second identifiant et les inscrits qui ont reçu le
// premier continuent de voir l'ancienne version — le GPX de référence du
// projet porte lui-même « Due to Path Damage Beatenberg », un tracé modifié
// en cours d'année. D'où un jeton d'édition, sans compte : le POST rend un
// secret, le PUT le redemande dans un en-tête.
//
// Le secret n'est JAMAIS stocké en clair : le blob ne garde qu'un sha256, et
// le GET est public — il ne doit rien rendre qui permette d'éditer.

// Magasin Blobs en mémoire : la seule surface utilisée par la fonction est
// get(key, {type:'json'}) / setJSON(key, value). On sérialise vraiment pour
// qu'un test ne puisse pas voir une référence partagée là où la production
// verrait un aller-retour JSON.
function fakeStore() {
  const m = new Map()
  return {
    keys: () => [...m.keys()],
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    async get(key) {
      return m.has(key) ? JSON.parse(m.get(key)) : null
    },
    async setJSON(key, value) {
      m.set(key, JSON.stringify(value))
    },
  }
}

const GPX = '<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/></trkseg></trk></gpx>'
const GPX2 = '<gpx version="1.1"><trk><trkseg><trkpt lat="46.7" lon="7.86"/><trkpt lat="46.71" lon="7.87"/><trkpt lat="46.72" lon="7.88"/></trkseg></trk></gpx>'

const req = (method, { id, secret, body } = {}) => {
  const url = `https://shibumap.com/.netlify/functions/race${id ? `?id=${id}` : ''}`
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (secret) headers['x-shibumap-secret'] = secret
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function publish(store, body = { gpx: GPX, raceName: '50K Interlaken 2026' }) {
  const res = await handleRace(req('POST', { body }), store)
  assert.equal(res.status, 201, 'la publication doit réussir')
  return await res.json()
}

// ---- le secret à la publication -------------------------------------------

test('POST hands back an edit secret alongside the id', async () => {
  const store = fakeStore()
  const j = await publish(store)
  assert.equal(j.ok, true)
  assert.match(j.id, /^[A-Za-z0-9]{10}$/)
  assert.equal(typeof j.secret, 'string')
  // plus long que l'id : c'est lui qui doit résister à une recherche exhaustive
  assert.ok(j.secret.length > j.id.length, `secret trop court : ${j.secret.length}`)
  assert.match(j.secret, /^[A-Za-z0-9]{16,}$/)
  assert.notEqual(j.secret, j.id)
})

test('two publications never share a secret', async () => {
  const store = fakeStore()
  const a = await publish(store)
  const b = await publish(store)
  assert.notEqual(a.secret, b.secret)
  assert.notEqual(a.id, b.id)
})

test('the blob keeps a hash, never the secret itself', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const blob = store.raw(j.id)
  const serialise = JSON.stringify(blob)
  assert.ok(!serialise.includes(j.secret), 'le secret en clair ne doit jamais toucher le disque')
  assert.match(blob.secretHash, /^[0-9a-f]{64}$/, 'un sha256 en hexadécimal')
})

// ---- le GET public ne doit rien laisser fuiter ------------------------------

test('GET returns the payload but never anything that lets you edit it', async () => {
  const store = fakeStore()
  const j = await publish(store)

  const res = await handleRace(req('GET', { id: j.id }), store)
  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.ok, true)
  assert.equal(out.payload.gpx, GPX, 'le GET rend bien la course')

  assert.equal(out.payload.secretHash, undefined, 'le condensat ne sort pas')
  assert.equal(out.payload.secret, undefined)
  // ceinture et bretelles : aucune trace du condensat où que ce soit dans la
  // réponse, quel que soit le nom du champ sous lequel il aurait pu remonter
  const hash = store.raw(j.id).secretHash
  assert.ok(!JSON.stringify(out).includes(hash), 'le condensat ne doit apparaître nulle part')
  assert.ok(!JSON.stringify(out).includes(j.secret))
})

test('GET keeps forcing an inert content type', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const res = await handleRace(req('GET', { id: j.id }), store)
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
})

// ---- le PUT : ce qu'il refuse ----------------------------------------------

test('PUT without a secret is refused', async () => {
  const store = fakeStore()
  const j = await publish(store)

  const res = await handleRace(req('PUT', { id: j.id, body: { gpx: GPX2 } }), store)
  assert.equal(res.status, 403)
  // et le blob n'a pas bougé
  assert.equal(store.raw(j.id).gpx, GPX)
})

test('PUT with the wrong secret is refused', async () => {
  const store = fakeStore()
  const j = await publish(store)

  const res = await handleRace(req('PUT', { id: j.id, secret: 'x'.repeat(j.secret.length), body: { gpx: GPX2 } }), store)
  assert.equal(res.status, 403)
  assert.equal(store.raw(j.id).gpx, GPX)
})

test('the secret of one race cannot edit another', async () => {
  const store = fakeStore()
  const a = await publish(store)
  const b = await publish(store, { gpx: GPX2, raceName: 'Une autre' })

  const res = await handleRace(req('PUT', { id: a.id, secret: b.secret, body: { gpx: GPX2 } }), store)
  assert.equal(res.status, 403)
  assert.equal(store.raw(a.id).gpx, GPX)
})

test('PUT on an id that was never published is a 404, not a rewrite', async () => {
  const store = fakeStore()
  const res = await handleRace(req('PUT', { id: 'abcdefghij', secret: 'z'.repeat(32), body: { gpx: GPX2 } }), store)
  assert.equal(res.status, 404)
  assert.equal(store.keys().length, 0, 'un PUT ne crée jamais un blob')
})

test('PUT on a malformed id never reaches the store', async () => {
  const store = fakeStore()
  const res = await handleRace(req('PUT', { id: 'nope!!', secret: 'z'.repeat(32), body: { gpx: GPX2 } }), store)
  assert.equal(res.status, 400)
})

// Un blob publié AVANT l'existence des jetons n'a aucun condensat : il n'y a
// alors aucun moyen de prouver qu'on en est l'auteur, et surtout un secret
// absent ne doit pas valoir laissez-passer.
test('a legacy blob with no stored hash cannot be edited by anyone', async () => {
  const store = fakeStore()
  await store.setJSON('legacyabcd', { gpx: GPX, logo: null, state: null, race: null, raceName: 'ancienne', createdAt: '2025-01-01T00:00:00.000Z' })

  const sans = await handleRace(req('PUT', { id: 'legacyabcd', body: { gpx: GPX2 } }), store)
  assert.equal(sans.status, 403)
  const avec = await handleRace(req('PUT', { id: 'legacyabcd', secret: 'z'.repeat(32), body: { gpx: GPX2 } }), store)
  assert.equal(avec.status, 403)
  assert.equal(store.raw('legacyabcd').gpx, GPX)
})

// ---- le PUT : ce qu'il accepte ---------------------------------------------

test('PUT with the right secret rewrites the blob under the SAME id', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const createdAt = store.raw(j.id).createdAt

  const res = await handleRace(
    req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2, raceName: '50K Interlaken 2026 — parcours modifié' } }),
    store,
  )
  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.ok, true)
  assert.equal(out.id, j.id, 'le lien diffusé ne doit pas changer')

  const blob = store.raw(j.id)
  assert.equal(blob.gpx, GPX2)
  assert.equal(blob.raceName, '50K Interlaken 2026 — parcours modifié')
  assert.equal(blob.createdAt, createdAt, 'la date de création survit à une correction')
  assert.match(blob.updatedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('a rewrite does not hand out a new secret, and the old one still works', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const hash = store.raw(j.id).secretHash

  const first = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } }), store)
  const out = await first.json()
  assert.equal(out.secret, undefined, 'le PUT ne rejoue pas le secret dans sa réponse')
  assert.equal(store.raw(j.id).secretHash, hash, 'le condensat reste celui de la publication')

  // toujours modifiable une deuxième fois avec le même jeton
  const second = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX, raceName: 'retour en arrière' } }), store)
  assert.equal(second.status, 200)
  assert.equal(store.raw(j.id).gpx, GPX)
})

test('a rewritten blob is still served without its hash', async () => {
  const store = fakeStore()
  const j = await publish(store)
  await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } }), store)

  const res = await handleRace(req('GET', { id: j.id }), store)
  const out = await res.json()
  assert.equal(out.payload.gpx, GPX2)
  assert.equal(out.payload.secretHash, undefined)
  assert.match(out.payload.updatedAt, /^\d{4}-\d{2}-\d{2}T/, 'le GET rend bien la date de mise à jour')
})

// Une carte nue (sans course) se publie ; elle doit aussi se corriger.
test('a map with no course can be rewritten too', async () => {
  const store = fakeStore()
  const j = await publish(store, { state: { format: 'shibumap-share', v: 1 }, raceName: 'La Réunion' })
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { state: { format: 'shibumap-share', v: 1, loc: { lat: 1, lon: 2, zoom: 8 } } } }), store)
  assert.equal(res.status, 200)
  assert.equal(store.raw(j.id).state.loc.zoom, 8)
})

// ---- le PUT passe par LA MÊME porte que le POST -----------------------------
// Mêmes plafonds, mêmes validations : un champ qui ne peut pas entrer par le
// POST ne doit pas pouvoir entrer par la porte de service.

test('PUT rejects a present-but-bogus course, exactly like POST', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: '<html><body>coucou</body></html>' } }), store)
  assert.equal(res.status, 422)
  assert.equal(store.raw(j.id).gpx, GPX, 'rien n’a été écrit')
})

test('PUT enforces the same ceiling on the course as POST', async () => {
  const store = fakeStore()
  const j = await publish(store)
  // 2 000 001 caractères : au-dessus de MAX_GPX_CHARS mais sous le plafond du
  // corps entier, donc c'est bien la mesure du CHAMP décodé qui doit trancher
  const trop = `<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/>${'<!-- '.padEnd(2_000_001, 'x')}</trkseg></trk></gpx>`
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: trop } }), store)
  assert.equal(res.status, 422)
  assert.equal(store.raw(j.id).gpx, GPX)
})

test('PUT enforces the same ceilings on state, race and name as POST', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const call = (body) => handleRace(req('PUT', { id: j.id, secret: j.secret, body }), store)

  assert.equal((await call({ gpx: GPX, state: { pad: 'x'.repeat(60_001) } })).status, 422, 'state hors plafond')
  assert.equal((await call({ gpx: GPX, race: { pad: 'x'.repeat(200_001) } })).status, 422, 'race hors plafond')
  assert.equal((await call({ gpx: GPX, raceName: 'x'.repeat(201) })).status, 422, 'nom hors plafond')
  assert.equal((await call({ gpx: GPX, state: 'pas un objet' })).status, 422)
  assert.equal((await call({ gpx: GPX, raceName: 42 })).status, 422)
  assert.equal(store.raw(j.id).gpx, GPX, 'aucun de ces refus n’a écrit quoi que ce soit')
})

test('PUT rejects an oversized body before parsing it', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: 'x'.repeat(4_264_193) }), store)
  assert.equal(res.status, 413)
})

test('PUT rejects a logo that is not an allowlisted data URL, exactly like POST', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX, logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } }), store)
  assert.equal(res.status, 422, 'un SVG reste refusé — il s’exécute')
  assert.equal(store.raw(j.id).logo, null)
})

test('PUT is rate limited per IP, exactly like POST', async () => {
  const store = fakeStore()
  const j = await publish(store)
  const ip = '203.0.113.42'
  const one = () => {
    const r = req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } })
    r.headers.set('x-nf-client-connection-ip', ip)
    return handleRace(r, store)
  }
  let last = null
  // le seau vaut 12 jetons ; la 13e écriture d'affilée doit tomber
  for (let i = 0; i < 13; i++) last = await one()
  assert.equal(last.status, 429)
})

// ---- les autres méthodes ---------------------------------------------------

test('an unsupported method is still refused', async () => {
  const store = fakeStore()
  const res = await handleRace(req('DELETE', { id: 'abcdefghij' }), store)
  assert.equal(res.status, 405)
})

// ---- côté client : garder le jeton, puis s'en servir ------------------------
// Un secret rendu une seule fois et jamais conservé revient exactement à ne
// pas pouvoir modifier. Le stockage local est le minimum : c'est le seul
// endroit, sans compte, où le navigateur qui a publié peut le retrouver.

function fakeStorage(initial = null) {
  const m = new Map(initial ? Object.entries(initial) : [])
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
  }
}

const angryStorage = () => ({
  getItem() { throw new Error('SecurityError') },
  setItem() { throw new Error('QuotaExceededError') },
  removeItem() { throw new Error('SecurityError') },
})

test('a published secret is written down and found again', () => {
  const s = fakeStorage()
  assert.equal(rememberRaceSecret('abcdefghij', 'S'.repeat(32), s), true)
  assert.equal(recallRaceSecret('abcdefghij', s), 'S'.repeat(32))
})

test('an id never published has no secret', () => {
  const s = fakeStorage()
  rememberRaceSecret('abcdefghij', 'S'.repeat(32), s)
  assert.equal(recallRaceSecret('zzzzzzzzzz', s), null)
  assert.equal(recallRaceSecret('', s), null)
  assert.equal(recallRaceSecret(null, s), null)
})

test('garbage is never written down as if it were a key', () => {
  const s = fakeStorage()
  assert.equal(rememberRaceSecret('', 'S'.repeat(32), s), false)
  assert.equal(rememberRaceSecret('abcdefghij', '', s), false)
  assert.equal(rememberRaceSecret('abcdefghij', 42, s), false)
  assert.equal(rememberRaceSecret('id avec espaces', 'S'.repeat(32), s), false)
  assert.equal(s.map.size, 0)
})

// Safari en navigation privée, quota plein, stockage désactivé : le partage
// doit continuer de marcher, seule la modification ultérieure est perdue.
test('a storage that throws never takes the publication down with it', () => {
  const s = angryStorage()
  assert.equal(rememberRaceSecret('abcdefghij', 'S'.repeat(32), s), false)
  assert.equal(recallRaceSecret('abcdefghij', s), null)
})

test('a corrupted store reads as empty, not as a crash', () => {
  const s = fakeStorage()
  s.setItem('shibumap.race.secrets', '{ceci n’est pas du JSON')
  assert.equal(recallRaceSecret('abcdefghij', s), null)
  // et on doit pouvoir repartir de zéro par-dessus
  assert.equal(rememberRaceSecret('abcdefghij', 'S'.repeat(32), s), true)
  assert.equal(recallRaceSecret('abcdefghij', s), 'S'.repeat(32))
})

test('the stored set stays bounded — the oldest keys fall off', () => {
  const s = fakeStorage()
  for (let i = 0; i < 80; i++) rememberRaceSecret(`race${String(i).padStart(5, '0')}`, `S${i}`.padEnd(32, 'x'), s)
  const kept = JSON.parse(s.getItem('shibumap.race.secrets'))
  assert.ok(Object.keys(kept).length <= 50, `borne dépassée : ${Object.keys(kept).length}`)
  assert.equal(recallRaceSecret('race00079', s), 'S79'.padEnd(32, 'x'), 'la plus récente survit')
  assert.equal(recallRaceSecret('race00000', s), null, 'la plus ancienne a cédé la place')
})

// ---- l'appel de mise à jour ------------------------------------------------

test('updateRace PUTs to the same id and carries the secret in a HEADER', async () => {
  let seen = null
  const fetchImpl = async (url, opts) => {
    seen = { url, opts }
    return { ok: true, status: 200, json: async () => ({ ok: true, id: 'abcdefghij' }) }
  }
  const out = await updateRace('abcdefghij', 'S'.repeat(32), { gpx: GPX2 }, fetchImpl)
  assert.equal(out.ok, true)

  assert.equal(seen.opts.method, 'PUT')
  assert.equal(seen.url, `${RACE_ENDPOINT}?id=abcdefghij`)
  assert.equal(seen.opts.headers[RACE_SECRET_HEADER], 'S'.repeat(32))
  // dans l'en-tête, PAS dans l'URL : une chaîne de requête finit en clair
  // dans les journaux d'accès et dans le Referer de la page suivante
  assert.ok(!seen.url.includes('S'.repeat(32)), 'le secret ne doit jamais voyager dans l’URL')
  assert.equal(JSON.parse(seen.opts.body).gpx, GPX2)
})

test('a refused update reports the server’s reason instead of pretending it worked', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: 'clé de modification invalide' }) })
  const out = await updateRace('abcdefghij', 'S'.repeat(32), { gpx: GPX2 }, fetchImpl)
  assert.equal(out.ok, false)
  assert.match(out.error, /403/)
  assert.match(out.error, /clé de modification/)
})

test('a network failure is an honest failure, never a silent one', async () => {
  const fetchImpl = async () => { throw new Error('Failed to fetch') }
  const out = await updateRace('abcdefghij', 'S'.repeat(32), { gpx: GPX2 }, fetchImpl)
  assert.equal(out.ok, false)
  assert.match(out.error, /Failed to fetch/)
})

test('updateRace refuses to call at all without a plausible id and secret', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({ ok: true }) } }
  assert.equal((await updateRace('', 'S'.repeat(32), {}, fetchImpl)).ok, false)
  assert.equal((await updateRace('abcdefghij', '', {}, fetchImpl)).ok, false)
  assert.equal((await updateRace('abcdefghij', null, {}, fetchImpl)).ok, false)
  assert.equal(called, false, 'aucune requête ne part sans jeton')
})
