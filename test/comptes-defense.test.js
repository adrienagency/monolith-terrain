// LES DÉFENSES DES COMPTES — le pendant de `test/comptes-attaque.test.js`.
//
// Chaque test d'ici ferme une porte que la passe d'attaque avait trouvée
// ouverte. Ils sont écrits pour MOURIR quand on retire la défense : c'est la
// seule chose qui distingue un test qui protège d'un test qui décore.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  handleRace,
  cleSeauLecture,
  cleIndexProprietaire,
  cleSeauRattachement,
  normaliseIp,
  COUT_APPEL_LISTE,
  COUT_OPERATION_MAGASIN,
  LECTURE_CAP_OCTETS,
} from '../netlify/functions/race.mjs'
import { compteVerifie } from '../netlify/functions/_compte.mjs'

// Le magasin en mémoire, augmenté de `delete` — que la vraie API Blobs fournit
// et dont le rattachement a désormais besoin pour retirer l'index du perdant.
function fakeStore() {
  const m = new Map()
  const lus = []
  const ecrits = []
  const effaces = []
  return {
    lus,
    ecrits,
    effaces,
    keys: () => [...m.keys()],
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    poser: (k, v) => m.set(k, JSON.stringify(v)),
    async get(key) { lus.push(key); return m.has(key) ? JSON.parse(m.get(key)) : null },
    async setJSON(key, value) { ecrits.push(key); m.set(key, JSON.stringify(value)) },
    async delete(key) { effaces.push(key); m.delete(key) },
    async list({ prefix } = {}) {
      return { blobs: [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })), directories: [] }
    },
  }
}

const GPX = '<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/></trkseg></trk></gpx>'
const ETAT = { format: 'shibumap-share', v: 1, loc: { lat: 45.92, lon: 6.87, zoom: 12 } }
const UID_A = '7f3c1a20-0000-4000-8000-00000000000a'
const UID_B = '7f3c1a20-0000-4000-8000-00000000000b'
const JETON = 'aaa.bbb.ccc'
const ENV = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' }

// Un Supabase de comédie. ⚠️ Il rend `aud: 'authenticated'` parce que c'est ce
// que GoTrue rend pour un vrai utilisateur : un faux qui l'omettrait ferait
// passer les tests pour la mauvaise raison.
function supabase(corps, statut = 200) {
  const appels = []
  const apporter = async (url, opts) => {
    appels.push({ url, entetes: opts?.headers })
    return new Response(JSON.stringify(corps), { status: statut })
  }
  apporter.appels = appels
  return apporter
}
const sessionAvec = (apporter) => (req) => compteVerifie(req, apporter, ENV)
const session = (uid, statut = 200) => sessionAvec(supabase({ id: uid, aud: 'authenticated', role: 'authenticated', email: 'x@y.z' }, statut))
const PERSONNE = async () => ''

const req = (method, { id, secret, jeton, body, ip, mine, claim, extra = '' } = {}) => {
  const q = new URLSearchParams()
  if (id) q.set('id', id)
  if (mine) q.set('mine', '1')
  if (claim) q.set('claim', '')
  const url = `https://shibumap.com/.netlify/functions/race${q.toString() ? `?${q}` : ''}${extra}`
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (secret) headers['x-shibumap-secret'] = secret
  if (jeton) headers.authorization = `Bearer ${jeton}`
  if (ip) headers['x-nf-client-connection-ip'] = ip
  return new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

async function publier(store, { verifie = PERSONNE, body = { gpx: GPX, state: ETAT, raceName: 'Course' }, jeton, ip } = {}) {
  const res = await handleRace(req('POST', { body, jeton, ip }), store, verifie)
  assert.equal(res.status, 201)
  return await res.json()
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. `?mine=1` NON PROUVÉ : on paie AVANT de déranger Supabase
// ═══════════════════════════════════════════════════════════════════════════

test('un ?mine=1 anonyme débite le seau de lecture AVANT d’appeler Supabase', async () => {
  const store = fakeStore()
  const ip = '198.51.100.31'
  // Ce Supabase-là lève : s'il est appelé, le débit qui le précède doit avoir
  // eu lieu quand même. C'est la preuve de l'ORDRE, pas seulement du montant.
  const faux = supabase({ msg: 'invalid JWT' }, 401)

  const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, sessionAvec(faux))
  assert.equal(res.status, 401)
  assert.equal(faux.appels.length, 1)

  const seau = store.raw(cleSeauLecture(ip))
  assert.ok(seau, 'le refus 401 doit avoir écrit le seau de lecture')
  assert.equal(LECTURE_CAP_OCTETS - seau.tokens, COUT_APPEL_LISTE,
    'un appel non prouvé coûte exactement le forfait, ni plus ni moins')
})

test('une rafale de ?mine=1 anonymes se fait couper, et Supabase cesse d’être appelé', async () => {
  const store = fakeStore()
  const ip = '198.51.100.32'
  const faux = supabase({ msg: 'invalid JWT' }, 401)

  const N = 300
  let refus = 0
  for (let i = 0; i < N; i++) {
    const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, sessionAvec(faux))
    if (res.status === 429) refus++
  }

  // +1 : le seau se recharge en continu, donc le dernier appel peut passer sur
  // les miettes accumulées pendant la boucle. Ce n'est pas le chiffre qui
  // compte, c'est qu'il ne dépende plus du nombre de requêtes.
  const plafond = Math.ceil(LECTURE_CAP_OCTETS / COUT_APPEL_LISTE) + 1
  assert.ok(refus > 0, `${N} appels anonymes sans un seul refus : le chemin liste n’a toujours aucun frein`)
  assert.ok(faux.appels.length <= plafond,
    `Supabase appelé ${faux.appels.length} fois pour ${N} requêtes : le débit ne précède pas la vérification`)
  assert.ok(faux.appels.length < N, 'l’amplification 1:1 vers Supabase doit avoir disparu')
})

test('le refus de rafale ne se cache jamais dans un cache partagé', async () => {
  const store = fakeStore()
  const ip = '198.51.100.33'
  await store.setJSON(cleSeauLecture(ip), { tokens: -LECTURE_CAP_OCTETS, at: Date.now() })
  const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(res.status, 429)
  assert.match(res.headers.get('cache-control') || '', /no-store/)
  assert.match(res.headers.get('netlify-cdn-cache-control') || '', /no-store/)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. `?mine=1` PROUVÉ : ce qu'on facture, ce sont les OPÉRATIONS
// ═══════════════════════════════════════════════════════════════════════════

test('une liste facture un coût d’opération par entrée lue, pas seulement ses octets', async () => {
  const store = fakeStore()
  const ip = '198.51.100.34'
  const N = 12
  for (let i = 0; i < N; i++) {
    await publier(store, { verifie: session(UID_A), jeton: JETON, ip: `203.0.113.${i}`, body: { gpx: GPX, state: ETAT, raceName: `Carte ${i}` } })
  }

  const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(res.status, 200)
  const octets = Buffer.byteLength(await res.text(), 'utf8')

  // Première requête depuis cette IP : le seau part plein et `at` est figé au
  // moment de la lecture, donc le compte est EXACT — aucun rechargement ne
  // vient brouiller la mesure.
  const debite = LECTURE_CAP_OCTETS - store.raw(cleSeauLecture(ip)).tokens
  assert.equal(debite, COUT_APPEL_LISTE + N * COUT_OPERATION_MAGASIN + octets,
    'le débit doit valoir forfait + opérations + octets servis')
  assert.ok(debite > octets * 10, `${debite} octets débités pour ${octets} rendus : le coût d’opération doit dominer`)
})

test('le prix d’une liste CROÎT avec le nombre d’entrées lues', async () => {
  // Le vrai défaut n'était pas un plafond trop haut : c'était que 1 carte et
  // 500 cartes coûtaient la même chose. Deux IP neuves, deux comptes, deux
  // tailles — l'écart doit être au moins celui des opérations supplémentaires.
  const store = fakeStore()
  const cout = async (uid, combien, ip) => {
    for (let i = 0; i < combien; i++) {
      await publier(store, { verifie: session(uid), jeton: JETON, ip: `203.0.113.${i % 250}`, body: { gpx: GPX, state: ETAT, raceName: `C${i}` } })
    }
    const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(uid))
    assert.equal(res.status, 200)
    return LECTURE_CAP_OCTETS - store.raw(cleSeauLecture(ip)).tokens
  }
  const petite = await cout(UID_A, 5, '198.51.100.35')
  const grosse = await cout(UID_B, 205, '198.51.100.36')

  assert.ok(grosse - petite >= 200 * COUT_OPERATION_MAGASIN,
    `200 entrées de plus n’ont coûté que ${grosse - petite} octets : le nombre d’opérations n’est pas facturé`)
  // Et le rapport reste très éloigné des millions de lectures d'origine.
  const requetesAvantFrein = Math.floor(LECTURE_CAP_OCTETS / grosse)
  assert.ok(requetesAvantFrein * 206 < 100_000,
    `${(requetesAvantFrein * 206).toLocaleString()} lectures de magasin sur un seul budget — il en fallait des millions pour que ce soit grave`)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'IDENTITÉ : un 200 de Supabase ne suffit plus
// ═══════════════════════════════════════════════════════════════════════════

test('compteVerifie exige `aud: authenticated`, pas seulement un 200 et un id', async () => {
  const r = new Request('https://x/', { headers: { authorization: `Bearer ${JETON}` } })

  assert.equal(await compteVerifie(r, supabase({ id: 'anonymous-role-x', role: 'anon', aud: 'anon' }), ENV), '',
    'un corps « role: anon » n’est pas un compte')
  assert.equal(await compteVerifie(r, supabase({ id: 'service-role-uid', role: 'service_role' }), ENV), '',
    'ni une clé de service')
  assert.equal(await compteVerifie(r, supabase({ id: UID_A }), ENV), '',
    'un corps sans `aud` du tout n’est pas un compte non plus')
  assert.equal(await compteVerifie(r, supabase({ id: UID_A, aud: ['authenticated'] }), ENV), '',
    'un `aud` en tableau ne vaut pas la chaîne attendue')

  // et le cas nominal continue de passer
  assert.equal(await compteVerifie(r, supabase({ id: UID_A, aud: 'authenticated', role: 'authenticated' }), ENV), UID_A)
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. LE RATTACHEMENT NE PUNIT PLUS LA VICTIME
// ═══════════════════════════════════════════════════════════════════════════

test('le dernier claim présentant un secret valide l’emporte', async () => {
  const store = fakeStore()
  // Alice publie sans compte et garde son secret ; un message transféré met ce
  // secret entre les mains de Mallory, qui a un compte et rattache le premier.
  const j = await publier(store)
  const vol = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.equal(vol.status, 200)
  assert.equal(store.raw(j.id).ownerId, UID_B)

  // Alice se crée un compte et présente LE MÊME secret : elle reprend sa carte.
  const alice = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(alice.status, 200, 'le détenteur du secret doit pouvoir reprendre sa carte')
  assert.equal(store.raw(j.id).ownerId, UID_A)
})

test('l’index du perdant DISPARAÎT — sinon la carte est listée deux fois', async () => {
  const store = fakeStore()
  const j = await publier(store)
  await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.ok(store.raw(cleIndexProprietaire(UID_B, j.id)), 'Mallory avait bien son entrée')

  await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(store.raw(cleIndexProprietaire(UID_B, j.id)), null, 'l’entrée du perdant doit être retirée')
  assert.ok(store.raw(cleIndexProprietaire(UID_A, j.id)), 'et celle du gagnant posée')

  const chezMallory = await (await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_B))).json()
  assert.deepEqual(chezMallory.cartes, [], 'la carte ne doit plus figurer chez le perdant')
  const chezAlice = await (await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))).json()
  assert.deepEqual(chezAlice.cartes.map((c) => c.id), [j.id])
})

test('sans secret valide, aucun claim ne prend une carte à son propriétaire', async () => {
  // La reprise passe par LE SECRET, jamais par le fait d'être connecté.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  for (const s of [undefined, 'z'.repeat(32)]) {
    const r = await handleRace(req('POST', { claim: true, id: j.id, secret: s, jeton: JETON }), store, session(UID_B))
    assert.equal(r.status, 403, 'un claim sans preuve reste un refus')
  }
  assert.equal(store.raw(j.id).ownerId, UID_A)
  assert.equal(store.raw(cleIndexProprietaire(UID_B, j.id)), null)
})

test('un magasin sans `delete` ne fait pas échouer une reprise', async () => {
  // La suppression de l'index du perdant est un ménage, pas une condition :
  // l'index n'est qu'un cache, et son échec n'a jamais de droit de veto.
  const store = fakeStore()
  const j = await publier(store)
  await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  delete store.delete
  const alice = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(alice.status, 200)
  assert.equal(store.raw(j.id).ownerId, UID_A)
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. LES SEAUX SUIVENT LA /64, PAS L'ADRESSE
// ═══════════════════════════════════════════════════════════════════════════

test('normaliseIp ramène une IPv6 à sa /64 et ne touche à rien d’autre', () => {
  assert.equal(normaliseIp('2001:db8:1234:5678::1'), '2001:db8:1234:5678::')
  assert.equal(normaliseIp('2001:db8:1234:5678:9abc:def0:1234:5678'), '2001:db8:1234:5678::')
  assert.equal(normaliseIp('2001:0db8:1234:5678::a'), '2001:db8:1234:5678::', 'les zéros de tête ne font pas deux seaux')
  assert.equal(normaliseIp('2001:DB8:1234:5678::A'), '2001:db8:1234:5678::', 'ni la casse')
  assert.equal(normaliseIp('[2001:db8:1234:5678::1]:443'), '2001:db8:1234:5678::')
  assert.equal(normaliseIp('fe80::1%eth0'), 'fe80:0:0:0::')
  assert.equal(normaliseIp('::1'), '0:0:0:0::')

  // ⚠️ CE QUI NE DOIT PAS BOUGER : les seaux déjà en circulation.
  assert.equal(normaliseIp('203.0.113.7'), '203.0.113.7')
  assert.equal(normaliseIp('::ffff:203.0.113.7'), '::ffff:203.0.113.7', 'une IPv4 déguisée désigne UN hôte')
  assert.equal(normaliseIp(''), '')
  assert.equal(normaliseIp(undefined), '')
  assert.equal(normaliseIp('n’importe:quoi:de:pas:lisible:du:tout:vraiment:trop:long'), 'n’importe:quoi:de:pas:lisible:du:tout:vraiment:trop:long')
  assert.equal(cleSeauLecture('203.0.113.7'), 'rlq_203.0.113.7', 'la clé IPv4 reste octet pour octet celle d’avant')
  assert.equal(cleSeauRattachement('203.0.113.7'), 'rlr_203.0.113.7')
})

test('40 adresses d’une même /64 partagent UN seul seau d’écriture', async () => {
  const store = fakeStore()
  let refuse = 0
  for (let i = 0; i < 40; i++) {
    const res = await handleRace(req('POST', { body: { gpx: GPX }, ip: `2001:db8:1234:5678::${i.toString(16)}` }), store, PERSONNE)
    if (res.status === 429) refuse++
  }
  assert.equal(store.keys().filter((k) => k.startsWith('rl_')).length, 1, 'une /64 est UN abonné, donc UN seau')
  assert.equal(refuse, 28, 'les 12 premières passent, les 28 suivantes sont refusées')
})

test('les seaux de lecture et de rattachement suivent la même /64', async () => {
  const store = fakeStore()
  const j = await publier(store)
  for (let i = 0; i < 5; i++) {
    const ip = `2001:db8:4321:8765::a${i}`
    await handleRace(req('GET', { id: j.id, ip }), store, PERSONNE)
    await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))
  }
  assert.equal(store.keys().filter((k) => k.startsWith('rlq_')).length, 1)
  assert.equal(store.keys().filter((k) => k.startsWith('rlr_')).length, 1)
})

test('deux /64 différentes gardent bien deux seaux', () => {
  assert.notEqual(cleSeauLecture('2001:db8:1234:5678::1'), cleSeauLecture('2001:db8:1234:9999::1'))
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. UN ownerId ILLISIBLE RESTE UN PROPRIÉTAIRE
// ═══════════════════════════════════════════════════════════════════════════

test('un ownerId malformé ne se laisse pas écraser par un claim', async () => {
  // Un ownerId que COMPTE_RE refuse (version antérieure, correction manuelle,
  // changement de format d'id) n'est PAS « pas de propriétaire ». On ne sait
  // pas le lire, donc on ne sait pas retirer son index : on refuse, on n'écrase
  // pas en silence.
  const store = fakeStore()
  const j = await publier(store)
  store.poser(j.id, { ...store.raw(j.id), ownerId: 'proprio_avec_underscore' })

  const r = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.equal(r.status, 409, 'un propriétaire illisible ferme la porte')
  assert.equal(store.raw(j.id).ownerId, 'proprio_avec_underscore', 'et rien n’a été réécrit')
  assert.equal(store.raw(cleIndexProprietaire(UID_B, j.id)), null)
})

test('un ownerId illisible n’autorise personne à écrire non plus', async () => {
  const store = fakeStore()
  const j = await publier(store)
  store.poser(j.id, { ...store.raw(j.id), ownerId: 'proprio_avec_underscore' })
  const res = await handleRace(req('PUT', { id: j.id, jeton: JETON, body: { gpx: GPX } }), store, sessionAvec(supabase({ id: 'proprio_avec_underscore', aud: 'authenticated' })))
  assert.equal(res.status, 403)
})

test('une carte SANS propriétaire se rattache toujours normalement', async () => {
  // Le témoin de la règle : « absent » et « illisible » ne sont pas le même cas.
  const store = fakeStore()
  const j = await publier(store)
  const r = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(r.status, 200)
  assert.equal(store.raw(j.id).ownerId, UID_A)
})
