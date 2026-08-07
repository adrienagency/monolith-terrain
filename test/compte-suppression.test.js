// LA FONCTION DE SUPPRESSION — netlify/functions/compte-supprimer.mjs
//
// ⚠️ CE QUI EST VÉRIFIÉ ICI EST D'UN GENRE PARTICULIER : c'est la seule route
// du produit qui DÉTRUIT quelque chose d'irréversible. Les trois questions, et
// rien d'autre ne compte autant :
//   1. faut-il une session valide ? (sinon n'importe qui efface n'importe qui)
//   2. QUI est effacé ? (le porteur du jeton, et lui SEUL — jamais un
//      identifiant venu du corps de la requête)
//   3. que se passe-t-il quand la clé `service_role` n'est pas posée ?
//      (un 503 clair, pas un 500 qui ressemble à un bug ni un 200 qui ment)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleSuppression } from '../netlify/functions/compte-supprimer.mjs'

const UID = '7f3c1a20-0000-4000-8000-00000000000a'
const AUTRE = '7f3c1a20-0000-4000-8000-00000000000b'
const ENV = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }

function magasin(initial = {}) {
  const m = new Map(Object.entries(initial))
  const efface = []
  return {
    efface,
    cles: () => [...m.keys()],
    async list({ prefix } = {}) {
      return { blobs: [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) }
    },
    async delete(key) { efface.push(key); m.delete(key) },
  }
}

function requete({ methode = 'POST', jeton = 'a.b.c', corps } = {}) {
  const entetes = { 'content-type': 'application/json' }
  if (jeton) entetes.authorization = `Bearer ${jeton}`
  return new Request('https://shibumap.com/.netlify/functions/compte-supprimer', {
    method: methode,
    headers: entetes,
    ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
  })
}

/** Un `fetch` de comédie pour l'API d'administration de Supabase. */
function supabase(statut = 200) {
  const appels = []
  const f = async (url, opts = {}) => {
    appels.push({ url, methode: opts.method, entetes: opts.headers })
    return new Response(JSON.stringify({}), { status: statut })
  }
  f.appels = appels
  return f
}

const verifie = (uid) => async () => uid

// ═══════════ L'AUTORISATION ═════════════════════════════════════════════════

test('sans session, aucune suppression — et Supabase n’est même pas dérangé', async () => {
  const apporter = supabase()
  const rep = await handleSuppression(requete({ jeton: '' }), magasin(), {
    apporter, env: ENV, verifieCompte: verifie(''),
  })
  assert.equal(rep.status, 401)
  assert.equal(apporter.appels.length, 0)
})

test('une méthode autre que POST est refusée avant tout le reste', async () => {
  const apporter = supabase()
  for (const methode of ['GET', 'DELETE', 'PUT']) {
    const rep = await handleSuppression(requete({ methode }), magasin(), {
      apporter, env: ENV, verifieCompte: verifie(UID),
    })
    assert.equal(rep.status, 405, methode)
  }
  assert.equal(apporter.appels.length, 0)
})

test('un identifiant de forme aberrante ne devient pas une URL d’administration', async () => {
  const apporter = supabase()
  for (const uid of ['', 'court', 'a'.repeat(65), '../autre', 'avec espace']) {
    const rep = await handleSuppression(requete(), magasin(), {
      apporter, env: ENV, verifieCompte: verifie(uid),
    })
    assert.equal(rep.status, 401, uid)
  }
  assert.equal(apporter.appels.length, 0)
})

// ═══════════ QUI EST EFFACÉ ═════════════════════════════════════════════════

test('⚠️ c’est le porteur du JETON qui est supprimé, jamais l’identifiant du CORPS', async () => {
  const apporter = supabase()
  // La requête réclame la suppression de quelqu'un d'autre, de trois façons.
  const req = requete({ corps: { uid: AUTRE, id: AUTRE, ownerId: AUTRE } })
  const rep = await handleSuppression(req, magasin(), { apporter, env: ENV, verifieCompte: verifie(UID) })

  assert.equal(rep.status, 200)
  assert.equal(apporter.appels.length, 1)
  assert.equal(apporter.appels[0].methode, 'DELETE')
  assert.ok(apporter.appels[0].url.endsWith(`/auth/v1/admin/users/${UID}`), apporter.appels[0].url)
  assert.ok(!apporter.appels[0].url.includes(AUTRE), 'l’identifiant du corps n’a AUCUN chemin jusqu’ici')
})

test('la clé service_role part dans les deux en-têtes que l’API d’administration exige', async () => {
  const apporter = supabase()
  await handleSuppression(requete(), magasin(), { apporter, env: ENV, verifieCompte: verifie(UID) })
  const e = apporter.appels[0].entetes
  assert.equal(e.apikey, ENV.SUPABASE_SERVICE_ROLE_KEY)
  assert.equal(e.authorization, `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`)
})

// ═══════════ LA CLÉ ABSENTE ═════════════════════════════════════════════════

test('⚠️ sans SUPABASE_SERVICE_ROLE_KEY : un 503 CLAIR, et rien n’est touché', async () => {
  const apporter = supabase()
  const store = magasin({ [`owner/${UID}/abc123`]: { id: 'abc123' } })
  const rep = await handleSuppression(requete(), store, {
    apporter, env: { SUPABASE_URL: ENV.SUPABASE_URL }, verifieCompte: verifie(UID),
  })
  assert.equal(rep.status, 503)
  const corps = await rep.json()
  assert.equal(corps.ok, false)
  assert.match(corps.erreur, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.equal(apporter.appels.length, 0)
  assert.deepEqual(store.efface, [], 'rien ne doit disparaître d’un côté quand l’autre n’est pas branché')
})

test('⚠️ le 503 n’est PAS servi à un inconnu : l’autorisation passe d’abord', async () => {
  // Sinon la route dirait à n'importe quel visiteur, sans le moindre jeton,
  // quelles variables d'environnement manquent sur ce site.
  const rep = await handleSuppression(requete({ jeton: '' }), magasin(), {
    apporter: supabase(), env: {}, verifieCompte: verifie(''),
  })
  assert.equal(rep.status, 401)
})

// ═══════════ L'INDEX, APRÈS ET SANS VETO ════════════════════════════════════

test('les entrées d’index du compte disparaissent — et SEULEMENT les siennes', async () => {
  const store = magasin({
    [`owner/${UID}/abc123`]: { id: 'abc123' },
    [`owner/${UID}/def456`]: { id: 'def456' },
    [`owner/${AUTRE}/ghi789`]: { id: 'ghi789' },
    abc123: { gpx: '…' }, // la carte elle-même : elle reste EN LIGNE
  })
  const rep = await handleSuppression(requete(), store, { apporter: supabase(), env: ENV, verifieCompte: verifie(UID) })

  assert.equal(rep.status, 200)
  assert.deepEqual(store.efface.sort(), [`owner/${UID}/abc123`, `owner/${UID}/def456`])
  // ⚠️ La promesse de l'écran de confirmation : « leurs liens continuent de
  // fonctionner pour ceux qui les ont ».
  assert.ok(store.cles().includes('abc123'), 'la carte publiée ne doit PAS disparaître')
  assert.ok(store.cles().includes(`owner/${AUTRE}/ghi789`), 'l’index d’un autre compte est intouchable')
})

test('un index en panne ne fait pas échouer une suppression déjà accomplie', async () => {
  const store = {
    async list() { throw new Error('blobs down') },
    async delete() {},
  }
  const apporter = supabase()
  const rep = await handleSuppression(requete(), store, { apporter, env: ENV, verifieCompte: verifie(UID) })
  assert.equal(rep.status, 200, 'le compte est parti : le dire, plutôt que de laisser croire à un échec')
  assert.equal(apporter.appels.length, 1)
})

test('un magasin sans `delete` (version antérieure, test) ne fait rien tomber', async () => {
  const store = { async list() { return { blobs: [{ key: `owner/${UID}/abc123` }] } } }
  const rep = await handleSuppression(requete(), store, { apporter: supabase(), env: ENV, verifieCompte: verifie(UID) })
  assert.equal(rep.status, 200)
})

// ═══════════ CE QUE SUPABASE RÉPOND ═════════════════════════════════════════

test('un 404 de Supabase est le résultat demandé, pas un échec', async () => {
  // Deux clics sur « Supprimer mon compte » : le second ne doit pas afficher
  // une erreur pour un compte déjà parti.
  const store = magasin({ [`owner/${UID}/abc123`]: {} })
  const rep = await handleSuppression(requete(), store, { apporter: supabase(404), env: ENV, verifieCompte: verifie(UID) })
  assert.equal(rep.status, 200)
  assert.deepEqual(store.efface, [`owner/${UID}/abc123`], 'et le ménage a bien lieu')
})

test('un refus de Supabase remonte en 502, et l’index reste en place', async () => {
  const store = magasin({ [`owner/${UID}/abc123`]: {} })
  const rep = await handleSuppression(requete(), store, { apporter: supabase(403), env: ENV, verifieCompte: verifie(UID) })
  assert.equal(rep.status, 502)
  assert.deepEqual(store.efface, [], 'le compte est vivant : sa liste de cartes doit l’être aussi')
})

test('Supabase injoignable donne un 502, pas une exception qui traverse', async () => {
  const store = magasin({ [`owner/${UID}/abc123`]: {} })
  const apporter = async () => { throw new Error('ECONNREFUSED') }
  const rep = await handleSuppression(requete(), store, { apporter, env: ENV, verifieCompte: verifie(UID) })
  assert.equal(rep.status, 502)
  assert.deepEqual(store.efface, [])
})

test('toutes les réponses sortent en no-store — elles dépendent d’une session', async () => {
  const cas = [
    [requete({ jeton: '' }), {}, ''],
    [requete(), {}, UID],
    [requete(), ENV, UID],
  ]
  for (const [req, env, uid] of cas) {
    const rep = await handleSuppression(req, magasin(), { apporter: supabase(), env, verifieCompte: verifie(uid) })
    assert.equal(rep.headers.get('cache-control'), 'no-store', String(rep.status))
  }
})
