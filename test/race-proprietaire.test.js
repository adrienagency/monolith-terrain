import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handleRace, cleIndexProprietaire, cleSeauRattachement, RATTACHEMENT_CAP } from '../netlify/functions/race.mjs'
import { compteVerifie } from '../netlify/functions/_compte.mjs'

// LA PROPRIÉTÉ D'UNE CARTE, CÔTÉ SERVEUR.
//
// Le jeton d'édition (`secretMatches`) reste ce qu'il était : des organisateurs
// ont des liens et des secrets en circulation, et rien de ce fichier ne doit
// changer leur vie. Le compte s'ajoute À CÔTÉ du jeton, jamais à sa place.
//
// Trois choses se vérifient ici, et elles ne se recouvrent pas :
//   1. `autorise()` — deux chemins, jamais trois. Ni le corps de la requête ni
//      l'URL ne peuvent influencer une autorisation.
//   2. l'index `owner/<uid>/<raceId>` — DEUX ÉCRITURES NON TRANSACTIONNELLES.
//      Le blob est la vérité, l'index n'est qu'un cache reconstructible.
//   3. « Mes cartes » — la lecture qui ne doit ouvrir AUCUN payload (elle
//      brûlerait le budget d'octets de son propre auteur) et qui ne doit
//      JAMAIS finir dans un cache partagé.

// ---- l'outillage ------------------------------------------------------------

// Le magasin en mémoire de race-edit.test.js, augmenté de `list({ prefix })` —
// que la vraie API Blobs fournit — et d'un journal des accès, sans lequel on ne
// pourrait pas prouver que « Mes cartes » n'ouvre aucun payload.
function fakeStore({ indexEnPanne = false } = {}) {
  const m = new Map()
  const lus = []
  const ecrits = []
  return {
    lus,
    ecrits,
    keys: () => [...m.keys()],
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    poser: (k, v) => m.set(k, JSON.stringify(v)),
    poserBrut: (k, s) => m.set(k, s),
    effacer: (k) => m.delete(k),
    async get(key) {
      lus.push(key)
      return m.has(key) ? JSON.parse(m.get(key)) : null
    },
    async setJSON(key, value) {
      if (indexEnPanne && String(key).startsWith('owner/')) throw new Error('blobs down')
      ecrits.push(key)
      m.set(key, JSON.stringify(value))
    },
    async list({ prefix } = {}) {
      const blobs = [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key, etag: 'x' }))
      return { blobs, directories: [] }
    },
  }
}

const GPX = '<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/></trkseg></trk></gpx>'
const GPX2 = '<gpx version="1.1"><trk><trkseg><trkpt lat="46.7" lon="7.86"/><trkpt lat="46.71" lon="7.87"/><trkpt lat="46.72" lon="7.88"/></trkseg></trk></gpx>'

const ETAT = { format: 'shibumap-share', v: 1, loc: { lat: 45.92, lon: 6.87, zoom: 12 } }

const UID_A = '7f3c1a20-0000-4000-8000-00000000000a'
const UID_B = '7f3c1a20-0000-4000-8000-00000000000b'
const JETON = 'aaa.bbb.ccc'
const ENV = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' }

// UN SUPABASE DE COMÉDIE, ET IL EST HOSTILE EXPRÈS.
//
// ⚠️ Même sur un REFUS il rend un corps JSON parfaitement formé, avec un
// identifiant plausible. Un faux qui renvoie un corps vide sur 401 fait passer
// les tests pour la mauvaise raison : `json()` échoue toute seule, et retirer
// la vérification du statut ne fait alors tomber personne. Un faux complaisant
// ne teste rien — celui-ci n'accorde le refus qu'au code qui lit le statut.
function supabase(uid, statut = 200) {
  const appels = []
  const apporter = async (url, opts) => {
    appels.push({ url, entetes: opts?.headers })
    return new Response(JSON.stringify({ id: uid || UID_A, email: 'coureur@example.com' }), { status: statut })
  }
  apporter.appels = appels
  return apporter
}

// La session telle que handleRace la reçoit : la VRAIE `compteVerifie`, avec un
// Supabase de comédie derrière. Le contrôle du statut, le format du jeton et le
// filtrage de l'uid sont donc réellement exercés à chaque appel.
const session = (uid, statut = 200) => (req) => compteVerifie(req, supabase(uid, statut), ENV)
const sessionEnPanne = () => (req) => compteVerifie(req, async () => { throw new Error('ECONNREFUSED') }, ENV)
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
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function publier(store, { verifie = PERSONNE, body = { gpx: GPX, state: ETAT, raceName: '50K Interlaken 2026' }, jeton } = {}) {
  const res = await handleRace(req('POST', { body, jeton }), store, verifie)
  assert.equal(res.status, 201, 'la publication doit réussir')
  return await res.json()
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LE CAS QUI EXISTE EN PRODUCTION : une carte sans compte, à l'identique
// ═══════════════════════════════════════════════════════════════════════════

test('une carte publiée SANS compte se corrige exactement comme avant', async () => {
  // C'est le seul cas qui existe aujourd'hui, avec de vrais organisateurs et de
  // vrais liens déjà envoyés. Rien de ce chantier ne doit le toucher.
  const store = fakeStore()
  const j = await publier(store)

  assert.equal(store.raw(j.id).ownerId, undefined, 'aucun propriétaire ne doit apparaître de nulle part')
  assert.equal(store.keys().filter((k) => k.startsWith('owner/')).length, 0, 'ni index')

  const ok = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } }), store, PERSONNE)
  assert.equal(ok.status, 200, 'le jeton d’édition doit continuer d’ouvrir la porte')
  assert.equal(store.raw(j.id).gpx, GPX2)

  const refus = await handleRace(req('PUT', { id: j.id, body: { gpx: GPX } }), store, PERSONNE)
  assert.equal(refus.status, 403, 'et sans jeton, la porte reste fermée')
  assert.equal(store.raw(j.id).gpx, GPX2)
})

test('le jeton d’édition ouvre toujours une carte QUI A un propriétaire', async () => {
  // Le compte s'ajoute À CÔTÉ du jeton. Un organisateur qui a créé un compte
  // depuis un autre navigateur ne doit pas perdre le secret qu'il a gardé.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  assert.equal(store.raw(j.id).ownerId, UID_A)

  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } }), store, PERSONNE)
  assert.equal(res.status, 200, 'le jeton reste un chemin indépendant')
  assert.equal(store.raw(j.id).ownerId, UID_A, 'et il ne dépossède personne')
})

test('Supabase à terre : le compte ne prouve plus rien, le jeton continue', async () => {
  // ⚠️ Le bon sens de l'échec. Une panne d'authentification ne doit pas ouvrir
  // de portes, et elle ne doit pas non plus fermer le produit.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })

  const parCompte = await handleRace(req('PUT', { id: j.id, jeton: JETON, body: { gpx: GPX2 } }), store, sessionEnPanne())
  assert.equal(parCompte.status, 403, 'personne n’est authentifié quand Supabase ne répond pas')

  const parJeton = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX2 } }), store, sessionEnPanne())
  assert.equal(parJeton.status, 200, 'le jeton d’édition ne dépend de personne')
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. autorise() — deux chemins, jamais trois
// ═══════════════════════════════════════════════════════════════════════════

test('le propriétaire corrige sa carte SANS présenter le secret', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('PUT', { id: j.id, jeton: JETON, body: { gpx: GPX2 } }), store, session(UID_A))
  assert.equal(res.status, 200)
  assert.equal(store.raw(j.id).gpx, GPX2)
})

test('un AUTRE compte ne corrige pas la carte, même connecté', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('PUT', { id: j.id, jeton: JETON, body: { gpx: GPX2 } }), store, session(UID_B))
  assert.equal(res.status, 403)
  assert.equal(store.raw(j.id).gpx, GPX)
})

test('un compte connecté n’ouvre pas une carte SANS propriétaire', async () => {
  // Sans ce garde, `blob.ownerId === uid` avec les deux à `undefined` ferait
  // de chaque visiteur connecté le propriétaire de toutes les cartes anonymes.
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('PUT', { id: j.id, jeton: JETON, body: { gpx: GPX2 } }), store, session(UID_A))
  assert.equal(res.status, 403)
})

test('rien venant du CORPS ou de l’URL n’autorise quoi que ce soit', async () => {
  // ⚠️ « Le client dit que c'est à lui » n'est pas une preuve. Un troisième
  // chemin d'autorisation est exactement ce que ce système existe pour interdire.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })

  const parLeCorps = await handleRace(
    req('PUT', { id: j.id, body: { gpx: GPX2, ownerId: UID_A, owner: UID_A, compte: UID_A, secret: 'z'.repeat(32) } }),
    store,
    PERSONNE,
  )
  assert.equal(parLeCorps.status, 403, 'un champ du corps ne vaut pas autorisation')

  const parLUrl = await handleRace(
    req('PUT', { id: j.id, body: { gpx: GPX2 }, extra: `&ownerId=${UID_A}&uid=${UID_A}&secret=zzzz` }),
    store,
    PERSONNE,
  )
  assert.equal(parLUrl.status, 403, 'un paramètre d’URL ne vaut pas autorisation')

  assert.equal(store.raw(j.id).gpx, GPX, 'aucun de ces refus n’a écrit quoi que ce soit')
})

test('une session ne réécrit jamais le propriétaire d’une carte par un PUT', async () => {
  // Le PUT corrige un tracé ; il ne transfère pas une propriété. Le seul
  // chemin qui pose `ownerId` est la publication, ou le rattachement.
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, jeton: JETON, body: { gpx: GPX2 } }), store, session(UID_A))
  assert.equal(res.status, 200)
  assert.equal(store.raw(j.id).ownerId, undefined, 'corriger une carte anonyme ne se l’approprie pas')
})

test('il n’y a qu’UN seul point d’appel de l’autorisation', async () => {
  // On lit la source : aucun test de comportement n'attrape le jour où
  // quelqu'un ajoute un second endroit qui décide « oui, celui-là peut écrire ».
  const source = readFileSync(new URL('../netlify/functions/race.mjs', import.meta.url), 'utf8')
  const code = source.replace(/^\s*(\/\/.*|\*.*|\/\*.*)$/gm, '') // hors commentaires
  const declarations = code.match(/function\s+autorise\s*\(/g) || []
  assert.equal(declarations.length, 1, 'une seule définition, sinon la question ne se pose même plus')
  const appels = (code.match(/\bautorise\s*\(/g) || []).length - declarations.length
  assert.equal(appels, 1, `autorise() est appelée ${appels} fois — il n’en faut qu’une`)
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. La publication pose ownerId, et l'index
// ═══════════════════════════════════════════════════════════════════════════

test('une publication SANS session ne pose ni propriétaire ni index', async () => {
  const store = fakeStore()
  const j = await publier(store)
  assert.equal(store.raw(j.id).ownerId, undefined)
  assert.deepEqual(store.keys().filter((k) => k.startsWith('owner/')), [])
})

test('une publication AVEC session pose le propriétaire et son entrée d’index', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })

  assert.equal(store.raw(j.id).ownerId, UID_A)
  const cle = cleIndexProprietaire(UID_A, j.id)
  assert.equal(cle, `owner/${UID_A}/${j.id}`, 'la forme de la clé est un contrat, pas un détail')
  const entree = store.raw(cle)
  assert.ok(entree, 'l’entrée d’index doit exister')
  assert.equal(entree.id, j.id)
  assert.equal(entree.nom, '50K Interlaken 2026')
  assert.deepEqual(entree.lieu, { lat: 45.92, lon: 6.87, zoom: 12 })
  assert.match(entree.creeLe, /^\d{4}-\d{2}-\d{2}T/)
})

test('l’entrée d’index ne porte JAMAIS le payload', async () => {
  // C'est tout l'intérêt de l'index : « Mes cartes » doit se lire sans jamais
  // toucher aux mégaoctets d'une trace.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  const brut = JSON.stringify(store.raw(cleIndexProprietaire(UID_A, j.id)))
  assert.ok(!brut.includes('trkpt'), 'aucune trace dans l’index')
  assert.ok(!brut.includes('secretHash') && !brut.includes(store.raw(j.id).secretHash), 'ni le condensat')
  assert.ok(brut.length < 400, `entrée d’index obèse : ${brut.length} octets`)
})

test('la clé d’index ne peut pas se faire passer pour un identifiant de course', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  for (const k of store.keys().filter((x) => x.startsWith('owner/'))) {
    assert.ok(!/^[A-Za-z0-9]{6,16}$/.test(k), `clé ambiguë : ${k}`)
  }
  assert.ok(store.keys().includes(j.id))
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. La double écriture : le blob est la vérité, l'index un cache
// ═══════════════════════════════════════════════════════════════════════════

test('l’index s’écrit APRÈS le blob, jamais avant', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  const posBlob = store.ecrits.indexOf(j.id)
  const posIndex = store.ecrits.indexOf(cleIndexProprietaire(UID_A, j.id))
  assert.ok(posBlob >= 0 && posIndex >= 0)
  assert.ok(posIndex > posBlob, 'un index qui pointe vers un blob inexistant est pire que pas d’index')
})

test('un index qui échoue ne fait PAS échouer la publication', async () => {
  // Le mode de panne est réel et silencieux. La carte est la vérité : elle est
  // publiée, son lien marche, et l'organisateur n'apprend rien de fâcheux.
  const store = fakeStore({ indexEnPanne: true })
  const res = await handleRace(req('POST', { body: { gpx: GPX, state: ETAT, raceName: 'Sans index' }, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 201, 'la publication doit aboutir malgré l’index')
  const { id } = await res.json()
  assert.equal(store.raw(id).ownerId, UID_A, 'le blob, lui, porte bien le propriétaire')

  const lecture = await handleRace(req('GET', { id }), store, PERSONNE)
  assert.equal(lecture.status, 200, 'et le lien fonctionne')
})

test('une correction répare l’index perdu', async () => {
  // Puisque l'index n'est qu'un cache, il doit se reconstruire tout seul à la
  // prochaine occasion plutôt que d'attendre une intervention.
  const m = new Map()
  let panne = true
  const store = {
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    keys: () => [...m.keys()],
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null },
    async setJSON(k, v) {
      if (panne && String(k).startsWith('owner/')) throw new Error('blobs down')
      m.set(k, JSON.stringify(v))
    },
    async list({ prefix } = {}) {
      return { blobs: [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })), directories: [] }
    },
  }
  const res = await handleRace(req('POST', { body: { gpx: GPX, state: ETAT, raceName: 'Bientôt indexée' }, jeton: JETON }), store, session(UID_A))
  const { id, secret } = await res.json()
  assert.equal(store.raw(cleIndexProprietaire(UID_A, id)), null, 'l’index a bien manqué')

  panne = false
  const put = await handleRace(req('PUT', { id, secret, body: { gpx: GPX2, state: ETAT, raceName: 'Réparée' } }), store, PERSONNE)
  assert.equal(put.status, 200)
  assert.equal(store.raw(cleIndexProprietaire(UID_A, id))?.nom, 'Réparée', 'l’index se reconstruit à la correction suivante')
})

test('la lecture filtre les entrées mortes au lieu de tomber', async () => {
  const store = fakeStore()
  const bonne = await publier(store, { verifie: session(UID_A), jeton: JETON })

  store.poserBrut(`owner/${UID_A}/zzzzzzzzzz`, '{ceci n’est pas du JSON')
  store.poser(`owner/${UID_A}/yyyyyyyyyy`, 'une chaîne, pas un objet')
  store.poser(`owner/${UID_A}/pas!!!valide`, { id: 'pas!!!valide', nom: 'clé bricolée' })
  store.poser(`owner/${UID_A}/wwwwwwwwww`, { id: 'autrechose', nom: 'entrée qui ment sur sa clé' })

  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 200)
  const { cartes } = await res.json()
  assert.deepEqual(cartes.map((c) => c.id), [bonne.id], 'seule l’entrée exploitable survit')
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. « Mes cartes »
// ═══════════════════════════════════════════════════════════════════════════

test('« mes cartes » rend le nom, le lieu, la date et l’identifiant', async () => {
  const store = fakeStore()
  const a = await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.ok, true)
  assert.equal(out.cartes.length, 1)
  const c = out.cartes[0]
  assert.equal(c.id, a.id)
  assert.equal(c.nom, '50K Interlaken 2026')
  assert.deepEqual(c.lieu, { lat: 45.92, lon: 6.87, zoom: 12 })
  assert.match(c.creeLe, /^\d{4}-\d{2}-\d{2}T/)
})

test('« mes cartes » ne rend JAMAIS le payload', async () => {
  // ⚠️ LE PIÈGE QUI COÛTE CHER. Le budget de lecture est calibré pour « un
  // lien, mille lecteurs » ; « Mes cartes » est le profil inverse — un lecteur,
  // N cartes de plusieurs mégaoctets. Un organisateur qui ouvre sa liste de
  // 40 cartes brûlerait son propre budget.
  const store = fakeStore()
  await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  const brut = await res.text()
  assert.ok(!brut.includes('trkpt'), 'pas un octet de trace ne doit sortir d’ici')
  assert.ok(!brut.includes('gpx'))
  const { cartes } = JSON.parse(brut)
  for (const champ of ['gpx', 'logo', 'state', 'race', 'payload']) {
    assert.equal(champ in cartes[0], false, `« mes cartes » a laissé sortir ${champ}`)
  }
})

test('« mes cartes » n’OUVRE aucun payload', async () => {
  // Ne pas le rendre ne suffit pas : le lire depuis le magasin coûterait déjà
  // les octets, et c'est le budget de l'organisateur qui les paierait.
  const store = fakeStore()
  const ids = []
  for (let i = 0; i < 3; i++) {
    ids.push((await publier(store, { verifie: session(UID_A), jeton: JETON, body: { gpx: GPX, state: ETAT, raceName: `Carte ${i}` } })).id)
  }
  store.lus.length = 0

  await handleRace(req('GET', { mine: true, jeton: JETON, ip: '203.0.113.60' }), store, session(UID_A))
  for (const id of ids) {
    assert.ok(!store.lus.includes(id), `« mes cartes » a ouvert le payload ${id}`)
  }
})

test('« mes cartes » ne creuse pas le budget de lecture de son auteur', async () => {
  const store = fakeStore()
  const ip = '203.0.113.61'
  for (let i = 0; i < 20; i++) {
    await publier(store, { verifie: session(UID_A), jeton: JETON, body: { gpx: GPX, state: ETAT, raceName: `Carte ${i}` } })
  }
  const res = await handleRace(req('GET', { mine: true, jeton: JETON, ip }), store, session(UID_A))
  assert.equal(res.status, 200)
  const corps = await res.text()
  // 20 cartes tiennent dans quelques kilo-octets, pas dans 85 mégaoctets
  assert.ok(Buffer.byteLength(corps, 'utf8') < 20_000, `liste trop lourde : ${corps.length} octets`)
})

test('« mes cartes » part en no-store — le CDN ne doit JAMAIS la resservir', async () => {
  // ⚠️ SANS ATTAQUANT, SANS BRUIT, SANS TRACE : le chemin GET pose sans
  // condition `s-maxage=30`. Greffé tel quel, ce mode servirait la liste d'un
  // compte au visiteur suivant pendant trente secondes.
  const store = fakeStore()
  await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  assert.match(res.headers.get('cache-control') || '', /no-store/)
  const cdn = res.headers.get('netlify-cdn-cache-control') || ''
  assert.ok(!/s-maxage/.test(cdn), `le CDN garderait cette liste : « ${cdn} »`)
  assert.match(cdn, /no-store/, 'le dialecte du CDN a priorité : il doit dire la même chose')
})

test('« mes cartes » sans session est refusée, et ce refus non plus ne se cache', async () => {
  const store = fakeStore()
  await publier(store, { verifie: session(UID_A), jeton: JETON })

  const res = await handleRace(req('GET', { mine: true }), store, PERSONNE)
  assert.equal(res.status, 401)
  const out = await res.json()
  assert.equal(out.cartes, undefined)
  assert.match(res.headers.get('cache-control') || '', /no-store/)
  assert.ok(!/s-maxage/.test(res.headers.get('netlify-cdn-cache-control') || ''))
})

test('la liste d’un compte ne contient jamais les cartes d’un autre', async () => {
  const store = fakeStore()
  const a = await publier(store, { verifie: session(UID_A), jeton: JETON, body: { gpx: GPX, state: ETAT, raceName: 'Chez A' } })
  await publier(store, { verifie: session(UID_B), jeton: JETON, body: { gpx: GPX, state: ETAT, raceName: 'Chez B' } })
  await publier(store) // et une carte sans compte

  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  const { cartes } = await res.json()
  assert.deepEqual(cartes.map((c) => c.nom), ['Chez A'])
  assert.equal(cartes[0].id, a.id)
})

test('« mes cartes » ne laisse pas sortir ownerId par cette porte-là', async () => {
  // Il est déjà retiré du GET public ; il ne doit pas revenir par le mode liste.
  const store = fakeStore()
  await publier(store, { verifie: session(UID_A), jeton: JETON })
  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  const brut = await res.text()
  assert.ok(!brut.includes(UID_A), 'l’identifiant de compte ne doit pas voyager')
  assert.ok(!brut.includes('ownerId'))
})

test('un compte sans aucune carte reçoit une liste vide, pas une erreur', async () => {
  const store = fakeStore()
  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).cartes, [])
})

test('« mes cartes » garde le type de contenu inerte', async () => {
  const store = fakeStore()
  await publier(store, { verifie: session(UID_A), jeton: JETON })
  const res = await handleRace(req('GET', { mine: true, jeton: JETON }), store, session(UID_A))
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
})

test('le GET par identifiant, lui, garde son cache partagé', async () => {
  // Le témoin de la règle : seul ce qui dépend d'une session part en no-store.
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  const res = await handleRace(req('GET', { id: j.id }), store, PERSONNE)
  assert.match(res.headers.get('netlify-cdn-cache-control') || '', /s-maxage=\d+/)
  assert.equal((await res.json()).payload.ownerId, undefined, 'et il ne rend toujours pas le propriétaire')
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Le rattachement
// ═══════════════════════════════════════════════════════════════════════════

test('le rattachement pose le propriétaire et l’index, avec le secret', async () => {
  const store = fakeStore()
  const j = await publier(store) // publiée en anonyme, avant tout compte

  const res = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).id, j.id)
  assert.equal(store.raw(j.id).ownerId, UID_A)
  assert.equal(store.raw(cleIndexProprietaire(UID_A, j.id))?.nom, '50K Interlaken 2026')
})

test('le rattachement passe par LE MÊME secretMatches', async () => {
  const store = fakeStore()
  const j = await publier(store)

  const sans = await handleRace(req('POST', { claim: true, id: j.id, jeton: JETON }), store, session(UID_A))
  assert.equal(sans.status, 403)
  const faux = await handleRace(req('POST', { claim: true, id: j.id, secret: 'z'.repeat(32), jeton: JETON }), store, session(UID_A))
  assert.equal(faux.status, 403)
  // le secret d'une AUTRE carte ne vaut rien non plus
  const autre = await publier(store, { body: { gpx: GPX2, raceName: 'Une autre' } })
  const croise = await handleRace(req('POST', { claim: true, id: j.id, secret: autre.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(croise.status, 403)

  assert.equal(store.raw(j.id).ownerId, undefined, 'aucun de ces refus n’a rien attaché')
})

test('un blob d’avant les jetons ne se rattache pas non plus', async () => {
  // Pas de condensat, donc aucune preuve possible — et un condensat absent
  // ferme la porte, il ne l'ouvre jamais.
  const store = fakeStore()
  store.poser('legacyabcd', { gpx: GPX, raceName: 'ancienne', createdAt: '2025-01-01T00:00:00.000Z' })
  const res = await handleRace(req('POST', { claim: true, id: 'legacyabcd', secret: 'z'.repeat(32), jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 403)
  assert.equal(store.raw('legacyabcd').ownerId, undefined)
})

test('le rattachement sans session est refusé', async () => {
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret }), store, PERSONNE)
  assert.equal(res.status, 401)
  assert.equal(store.raw(j.id).ownerId, undefined)
})

test('on ne rattache pas une carte déjà attachée à quelqu’un d’autre', async () => {
  // Premier arrivé, premier propriétaire — et le second n'emporte rien, même
  // s'il détient le secret (un courriel transféré le contient en clair).
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  const res = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_B))
  assert.equal(res.status, 409)
  assert.equal(store.raw(j.id).ownerId, UID_A, 'le propriétaire en place ne bouge pas')
  assert.equal(store.raw(cleIndexProprietaire(UID_B, j.id)), null, 'et aucun index chez l’intrus')
})

test('rattacher sa propre carte une seconde fois ne casse rien', async () => {
  const store = fakeStore()
  const j = await publier(store, { verifie: session(UID_A), jeton: JETON })
  const res = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.equal(res.status, 200)
  assert.equal(store.raw(j.id).ownerId, UID_A)
})

test('on ne rattache pas un identifiant deviné', async () => {
  const store = fakeStore()
  const inconnu = await handleRace(req('POST', { claim: true, id: 'abcdefghij', secret: 'z'.repeat(32), jeton: JETON }), store, session(UID_A))
  assert.equal(inconnu.status, 404)
  const malforme = await handleRace(req('POST', { claim: true, id: 'nope!!', secret: 'z'.repeat(32), jeton: JETON }), store, session(UID_A))
  assert.equal(malforme.status, 400)
  assert.deepEqual(store.keys().filter((k) => k.startsWith('owner/')), [], 'rien ne s’est attaché')
})

test('le rattachement a SON seau — 50 cartes d’affilée passent', async () => {
  // ⚠️ Réutiliser le seau d'écriture (12 par 10 minutes) bloquerait un
  // rattachement légitime au treizième. Le stockage local du navigateur garde
  // jusqu'à 50 secrets : les 50 doivent pouvoir remonter d'un coup.
  const store = fakeStore()
  const ip = '203.0.113.70'
  const cartes = []
  for (let i = 0; i < 50; i++) cartes.push(await publier(store, { body: { gpx: GPX, state: ETAT, raceName: `Carte ${i}` } }))

  for (const [i, c] of cartes.entries()) {
    const res = await handleRace(req('POST', { claim: true, id: c.id, secret: c.secret, jeton: JETON, ip }), store, session(UID_A))
    assert.equal(res.status, 200, `le rattachement n°${i + 1} a été refusé`)
  }
  assert.ok(RATTACHEMENT_CAP > 12, 'un seau de rattachement calé sur celui de l’écriture ne sert à rien')
})

test('le seau de rattachement est distinct de celui de l’écriture', async () => {
  const store = fakeStore()
  const ip = '203.0.113.71'
  const j = await publier(store)
  await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))

  const cles = store.keys().filter((k) => k.includes(ip))
  assert.deepEqual(cles, [cleSeauRattachement(ip)], `un seau propre, or : ${cles.join(', ')}`)
  // et la publication garde ses 12 jetons intacts
  const res = await handleRace(req('POST', { body: { gpx: GPX }, ip }), store, PERSONNE)
  assert.equal(res.status, 201)
})

test('le rattachement finit par se freiner, il n’est pas libre', async () => {
  const store = fakeStore()
  const ip = '203.0.113.72'
  const j = await publier(store)
  let dernier = null
  for (let i = 0; i < RATTACHEMENT_CAP + 1; i++) {
    dernier = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON, ip }), store, session(UID_A))
  }
  assert.equal(dernier.status, 429)
})

test('la réponse d’un rattachement ne se met pas en cache', async () => {
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('POST', { claim: true, id: j.id, secret: j.secret, jeton: JETON }), store, session(UID_A))
  assert.match(res.headers.get('cache-control') || '', /no-store/)
})

test('le préalable CORS annonce l’en-tête d’authentification', async () => {
  // Sans lui, un appel depuis une autre origine avec un jeton de session serait
  // refusé par le navigateur avant même de partir.
  const store = fakeStore()
  const res = await handleRace(req('OPTIONS'), store, PERSONNE)
  assert.equal(res.status, 204)
  assert.match(res.headers.get('access-control-allow-headers') || '', /authorization/i)
  assert.match(res.headers.get('access-control-allow-headers') || '', /x-shibumap-secret/i)
})
