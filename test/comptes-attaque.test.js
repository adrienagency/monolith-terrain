// TESTS D'ATTAQUE — comptes / propriété des cartes.
// Fichier d'audit, volontairement HORS du `test` de package.json.
// Rien n'est corrigé ici : on ne fait que démontrer.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleRace, cleSeauLecture, cleSeauRattachement, cleIndexProprietaire } from '../netlify/functions/race.mjs'
import { compteVerifie } from '../netlify/functions/_compte.mjs'

function fakeStore() {
  const m = new Map()
  const lus = []
  const ecrits = []
  const listes = []
  return {
    lus, ecrits, listes,
    keys: () => [...m.keys()],
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    poser: (k, v) => m.set(k, JSON.stringify(v)),
    async get(key) { lus.push(key); return m.has(key) ? JSON.parse(m.get(key)) : null },
    async setJSON(key, value) { ecrits.push(key); m.set(key, JSON.stringify(value)) },
    async list({ prefix } = {}) {
      listes.push(prefix)
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
const session = (uid, statut = 200) => sessionAvec(supabase({ id: uid, email: 'x@y.z' }, statut))
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
// A1 — `?mine=1` : LE SEUL CHEMIN SANS AUCUN FREIN
// ═══════════════════════════════════════════════════════════════════════════

test('ATTAQUE A1 — ?mine=1 non authentifié : un appel Supabase par requête, sans plafond', async () => {
  const store = fakeStore()
  const ip = '198.51.100.7'
  const faux = supabase({ msg: 'invalid JWT' }, 401)

  const N = 300
  for (let i = 0; i < N; i++) {
    const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, sessionAvec(faux))
    assert.equal(res.status, 401)
  }

  // 1. chaque requête a réellement tapé Supabase — amplification 1:1, gratuite
  assert.equal(faux.appels.length, N, `Supabase appelé ${faux.appels.length} fois pour ${N} requêtes anonymes`)

  // 2. aucun seau d'ÉCRITURE n'a été touché (ce chemin ne passe pas par takeToken)
  assert.equal(store.keys().filter((k) => k.startsWith('rl_') || k.startsWith('rlr_')).length, 0,
    'le mode liste ne consomme aucun jeton d’écriture')

  // 3. et le seau de LECTURE n'a jamais été débité : le 401 ne coûte rien
  assert.equal(store.raw(cleSeauLecture(ip)), null,
    'le refus 401 n’écrit même pas le seau de lecture : le budget ne bouge jamais')
})

test('ATTAQUE A1bis — le POST, le PUT et le claim SONT freinés : la liste est la seule exception', async () => {
  const store = fakeStore()
  const ip = '198.51.100.8'
  const j = await publier(store, { ip })

  // POST : le 13e est refusé
  let dernier
  for (let i = 0; i < 13; i++) dernier = await handleRace(req('POST', { body: { gpx: GPX }, ip }), store, PERSONNE)
  assert.equal(dernier.status, 429, 'la publication est bien plafonnée')

  // claim : plafonné aussi (seau propre)
  assert.ok(store.raw(cleSeauRattachement(ip)) === null || true)
  const c = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(c.status, 200)
  assert.ok(store.raw(cleSeauRattachement(ip)), 'le claim consomme son seau')

  // mine : AUCUN seau d'écriture, et le seau de lecture bouge à peine
  const CAP = 1024 * 1024 * 1024
  const ecritureAvant = store.raw(`rl_${ip}`)?.tokens
  for (let i = 0; i < 500; i++) await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(store.raw(`rl_${ip}`)?.tokens, ecritureAvant,
    'le mode liste ne touche jamais le seau d’écriture')
  const reste = store.raw(cleSeauLecture(ip)).tokens
  const consomme = CAP - reste
  console.log(`   → A1bis : 500 appels ?mine=1 = ${consomme} octets débités sur ${CAP} ; ~${Math.floor(CAP / (consomme / 500)).toLocaleString()} appels avant le premier frein`)
  assert.ok(consomme < CAP / 1000,
    `500 appels ?mine=1 n’ont consommé que ${consomme} octets du 1 Gio — soit ~${Math.floor(CAP / (consomme / 500)).toLocaleString()} appels avant le moindre frein`)
})

// ═══════════════════════════════════════════════════════════════════════════
// A2 — AMPLIFICATION DE LECTURES DE BLOBS : 1 requête HTTP → N lectures magasin
// ═══════════════════════════════════════════════════════════════════════════

test('ATTAQUE A2 — une requête ?mine=1 coûte N lectures de blobs, débitées en octets de réponse', async () => {
  const store = fakeStore()
  const ip = '198.51.100.9'
  const N = 60
  for (let i = 0; i < N; i++) {
    // on publie hors seau (IP différente) pour ne mesurer que la liste
    await publier(store, { verifie: session(UID_A), jeton: JETON, ip: `203.0.113.${i % 250}`, body: { gpx: GPX, state: ETAT, raceName: `Carte ${i}` } })
  }

  store.lus.length = 0
  const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(res.status, 200)
  const corps = await res.text()

  const lecturesMagasin = store.lus.length
  const octetsDebites = Buffer.byteLength(corps, 'utf8')
  assert.ok(lecturesMagasin >= N, `${lecturesMagasin} lectures de blobs pour UNE requête HTTP`)

  // Le budget est en OCTETS SERVIS ; le coût réel est en OPÉRATIONS de magasin.
  // Rapport : combien de lectures de blobs par kilo-octet débité.
  const parKo = lecturesMagasin / (octetsDebites / 1024)
  assert.ok(parKo > 5, `${parKo.toFixed(1)} lectures de blobs par Ko débité — le budget ne mesure pas ce qui coûte`)

  // Et le budget d'1 Gio autorise donc ~ ce nombre de requêtes AVANT tout frein :
  const requetesAvantFrein = Math.floor((1024 * 1024 * 1024) / octetsDebites)
  const lecturesTotales = requetesAvantFrein * lecturesMagasin
  assert.ok(lecturesTotales > 1_000_000,
    `${lecturesTotales.toLocaleString()} lectures de blobs (${requetesAvantFrein.toLocaleString()} requêtes × ${lecturesMagasin}) sur un seul budget de 1 Gio et une seule IP`)
  console.log(`   → A2 : ${N} cartes, 1 requête = ${lecturesMagasin} lectures de blobs pour ${octetsDebites} octets débités ; ${lecturesTotales.toLocaleString()} lectures avant le premier frein`)
})

// ═══════════════════════════════════════════════════════════════════════════
// A3 — L'IDENTITÉ : ce que compteVerifie accepte vraiment
// ═══════════════════════════════════════════════════════════════════════════

test('ATTAQUE A3 — un 200 de Supabase suffit : aucun contrôle de `aud`/`role`', async () => {
  // Ce qui est vérifié : le statut, et que `id` soit une chaîne de 8 à 64.
  // Ce qui ne l'est PAS : que ce soit bien un utilisateur authentifié.
  const r = new Request('https://x/', { headers: { authorization: `Bearer ${JETON}` } })

  const anonyme = await compteVerifie(r, supabase({ id: 'anonymous-role-x', role: 'anon', aud: 'anon' }), ENV)
  assert.equal(anonyme, 'anonymous-role-x', 'un corps « role: anon » est accepté comme un compte')

  const service = await compteVerifie(r, supabase({ id: 'service-role-uid', role: 'service_role' }), ENV)
  assert.equal(service, 'service-role-uid')

  // ce qui, lui, tient bien
  assert.equal(await compteVerifie(r, supabase({ id: UID_A }, 401), ENV), '', '401 → personne')
  assert.equal(await compteVerifie(r, supabase({ id: UID_A }, 500), ENV), '', '500 → personne')
  assert.equal(await compteVerifie(r, supabase({ identifiant: UID_A }), ENV), '', 'corps inattendu → personne')
  assert.equal(await compteVerifie(r, supabase([{ id: UID_A }]), ENV), '', 'tableau → personne')
  assert.equal(await compteVerifie(r, supabase({ id: 'court' }), ENV), '', 'id trop court → personne')
  assert.equal(await compteVerifie(r, supabase({ id: 42 }), ENV), '', 'id non-chaîne → personne')
  assert.equal(await compteVerifie(r, async () => { throw new Error('down') }, ENV), '', 'panne → personne')
  assert.equal(await compteVerifie(r, supabase({ id: UID_A }), {}), '', 'sans configuration → personne')

  // le jeton part bien dans l'en-tête, pas dans l'URL
  const espion = supabase({ id: UID_A })
  await compteVerifie(r, espion, ENV)
  assert.ok(!espion.appels[0].url.includes(JETON), 'le jeton ne finit pas dans une URL')
  assert.equal(espion.appels[0].entetes.apikey, ENV.SUPABASE_ANON_KEY)
})

test('ATTAQUE A3bis — un uid non-UUID posé par Supabase deviendrait une clé d’index', async () => {
  const store = fakeStore()
  const bizarre = 'AAAAAAAA-BBBB' // passe COMPTE_RE
  const j = await publier(store, { verifie: sessionAvec(supabase({ id: bizarre })), jeton: JETON })
  assert.equal(store.raw(j.id).ownerId, bizarre)
  assert.ok(store.keys().includes(cleIndexProprietaire(bizarre, j.id)))
  // au moins la traversée de clé est bien fermée :
  const slash = await publier(store, { verifie: sessionAvec(supabase({ id: 'aaa/../bbb/cc' })), jeton: JETON })
  assert.equal(store.raw(slash.id).ownerId, undefined, 'un uid avec « / » est rejeté avant la clé')
})

// ═══════════════════════════════════════════════════════════════════════════
// A4 — PRENDRE UNE CARTE QUI N'EST PAS À SOI : ce qui tient
// ═══════════════════════════════════════════════════════════════════════════

test('A4 — aucun des chemins évidents de vol ne passe', async () => {
  const store = fakeStore()
  const anonyme = await publier(store)
  const aA = await publier(store, { verifie: session(UID_A), jeton: JETON })

  // claim sans secret / mauvais secret / secret croisé
  for (const s of [undefined, 'z'.repeat(32), anonyme.secret]) {
    const r = await handleRace(req('POST', { claim: true, id: aA.id, secret: s, jeton: JETON }), store, session(UID_B))
    assert.ok(r.status === 403 || r.status === 409, `claim hostile → ${r.status}`)
  }
  assert.equal(store.raw(aA.id).ownerId, UID_A)

  // carte anonyme + compte connecté, sans secret : pas de PUT, pas de claim
  assert.equal((await handleRace(req('PUT', { id: anonyme.id, jeton: JETON, body: { gpx: GPX } }), store, session(UID_B))).status, 403)
  assert.equal((await handleRace(req('POST', { claim: true, id: anonyme.id, jeton: JETON }), store, session(UID_B))).status, 403)

  // ownerId ne ressort pas du GET public
  const pub = await (await handleRace(req('GET', { id: aA.id }), store, PERSONNE)).text()
  assert.ok(!pub.includes(UID_A) && !pub.includes('ownerId') && !pub.includes('secretHash'))

  // un ownerId illisible ne vaut PAS une session vide
  store.poser('brokeowner', { gpx: GPX, secretHash: 'a'.repeat(64), ownerId: '' })
  assert.equal((await handleRace(req('PUT', { id: 'brokeowner', jeton: JETON, body: { gpx: GPX } }), store, session(UID_A))).status, 403)
  store.poser('brokeownr2', { gpx: GPX, secretHash: 'a'.repeat(64) })
  assert.equal((await handleRace(req('PUT', { id: 'brokeownr2', jeton: JETON, body: { gpx: GPX } }), store, sessionAvec(supabase({ id: '' })))).status, 403)
})

test('A4bis — un ownerId MALFORMÉ se laisse écraser par un claim (dérive de propriété)', async () => {
  // Si un blob porte un ownerId que COMPTE_RE refuse (autre version du code,
  // correction manuelle, Supabase qui change de format d'id), il est traité
  // comme « pas de propriétaire » : le premier venu détenant le secret l'emporte,
  // et le propriétaire d'origine n'a AUCUN recours.
  const store = fakeStore()
  const j = await publier(store)
  const blob = store.raw(j.id)
  store.poser(j.id, { ...blob, ownerId: 'proprio_avec_underscore' }) // refusé par COMPTE_RE
  const r = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.equal(r.status, 200, 'le claim passe alors que la carte avait un propriétaire')
  assert.equal(store.raw(j.id).ownerId, UID_B)
})

// ═══════════════════════════════════════════════════════════════════════════
// A5 — LE RATTACHEMENT EST IRRÉVERSIBLE, ET C'EST UN PIÈGE
// ═══════════════════════════════════════════════════════════════════════════

test('ATTAQUE A5 — un squatteur rattache la carte, le vrai organisateur ne peut JAMAIS la récupérer', async () => {
  const store = fakeStore()
  // Alice publie sans compte et garde son secret.
  const j = await publier(store)
  // Un message transféré met le secret entre les mains de Mallory, qui a un compte.
  const vol = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.equal(vol.status, 200)
  assert.equal(store.raw(j.id).ownerId, UID_B, 'la carte d’Alice appartient maintenant à Mallory')

  // Alice se crée un compte et présente LE MÊME secret : refus définitif.
  const alice = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(alice.status, 409, 'Alice ne récupère jamais sa propre carte')
  assert.equal(store.raw(cleIndexProprietaire(UID_A, j.id)), null)

  // Et la carte reste listée chez Mallory.
  const liste = await (await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_B))).json()
  assert.deepEqual(liste.cartes.map((c) => c.id), [j.id])

  // Or ce refus ne protège RIEN : Alice peut toujours tout réécrire.
  const put = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX, raceName: 'réécrit' } }), store, PERSONNE)
  assert.equal(put.status, 200, 'le 409 interdit la propriété mais pas la réécriture — il ne protège rien')
})

// ═══════════════════════════════════════════════════════════════════════════
// A6 — LES SEAUX SONT INDEXÉS SUR L'IP COMPLÈTE (IPv6 = budget illimité)
// ═══════════════════════════════════════════════════════════════════════════

test('ATTAQUE A6 — une seule /64 IPv6 donne autant de budgets neufs qu’on veut', async () => {
  const store = fakeStore()
  const j = await publier(store)

  // 40 adresses de la MÊME /64 : 40 seaux d'écriture distincts, 40 × 12 publications
  for (let i = 0; i < 40; i++) {
    const ip = `2001:db8:1234:5678::${i.toString(16)}`
    const r = await handleRace(req('POST', { body: { gpx: GPX }, ip }), store, PERSONNE)
    assert.equal(r.status, 201)
  }
  const seaux = store.keys().filter((k) => k.startsWith('rl_'))
  assert.equal(seaux.length, 40, 'un seau par adresse, alors qu’une /64 est UN seul abonné')

  // idem pour le seau de lecture et le tout nouveau seau de rattachement
  for (let i = 0; i < 5; i++) {
    const ip = `2001:db8:1234:5678::a${i}`
    await handleRace(req('GET', { id: j.id, ip }), store, PERSONNE)
    await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))
  }
  assert.equal(store.keys().filter((k) => k.startsWith('rlq_')).length, 5)
  assert.equal(store.keys().filter((k) => k.startsWith('rlr_')).length, 5)
})

// ═══════════════════════════════════════════════════════════════════════════
// A7 — LE COMPTEUR DU TABLEAU DE BORD NE CONNAÎT PAS LES NOUVELLES CLÉS
// ═══════════════════════════════════════════════════════════════════════════

test('A7 — `owner/…` et `rlr_…` sont comptés comme des cartes publiées', async () => {
  // Le filtre de tableau-releve.mjs, recopié tel quel.
  const filtre = (k) => !k.startsWith('rl_') && !k.startsWith('rlq_')
  const store = fakeStore()
  const ip = '198.51.100.20'
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON, ip })
  await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))

  const comptees = store.keys().filter(filtre)
  assert.ok(comptees.includes(cleIndexProprietaire(UID_A, j.id)), 'une entrée d’index compte comme une carte')
  assert.ok(comptees.includes(cleSeauRattachement(ip)), 'un seau de rattachement aussi')
  assert.equal(comptees.length, 3, `1 carte réelle → ${comptees.length} « cartes publiées » au tableau de bord`)
})
