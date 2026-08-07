import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compteVerifie, jetonPresente } from '../netlify/functions/_compte.mjs'

// C'est la fonction dont dépend tout le système de comptes : elle répond à
// « qui est cette requête ? », et sa réponse décide qui possède quelle carte.
// Elle n'accepte pour preuve qu'un jeton signé par Supabase — rien de ce que le
// navigateur raconte par ailleurs ne doit pouvoir l'influencer.

const ENV = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' }
const JETON = 'aaa.bbb.ccc'

const req = (entetes = {}) => new Request('https://shibumap.com/x', { headers: entetes })

// Un Supabase de comédie.
//
// ⚠️ IL EST HOSTILE EXPRÈS : même sur un REFUS, il rend un corps JSON
// parfaitement formé, avec un identifiant plausible. La première version de ce
// faux renvoyait un corps VIDE sur 401 — et le test passait alors sans que la
// vérification du statut existe, parce que `json()` échouait toute seule. Le
// test était vert pour la mauvaise raison : retirer le contrôle du statut ne
// le faisait pas tomber. Un faux complaisant ne teste rien.
const UID = '7f3c1a20-0000-4000-8000-000000000001'

function supabaseQuiRepond(uid = UID, statut = 200) {
  const appels = []
  const apporter = async (url, opts) => {
    appels.push({ url, entetes: opts?.headers })
    return new Response(JSON.stringify({ id: uid || UID, email: 'coureur@example.com' }), { status: statut })
  }
  apporter.appels = appels
  return apporter
}

test('un jeton valide donne l’identifiant, et RIEN d’autre', async () => {
  const apporter = supabaseQuiRepond()
  const uid = await compteVerifie(req({ authorization: `Bearer ${JETON}` }), apporter, ENV)
  assert.equal(uid, '7f3c1a20-0000-4000-8000-000000000001')
  // Le courriel change, l'identifiant jamais — et tout ce qui ne circule pas
  // est une chose de moins à protéger, exporter et effacer.
  assert.equal(typeof uid, 'string')
})

test('sans en-tête, personne n’est authentifié — et c’est NORMAL', async () => {
  // ShibuMap s'utilise sans compte : '' est le cas courant, pas une erreur.
  const apporter = supabaseQuiRepond()
  assert.equal(await compteVerifie(req(), apporter, ENV), '')
  assert.equal(apporter.appels.length, 0, 'ne pas déranger Supabase quand il n’y a rien à vérifier')
})

test('un jeton expiré ou falsifié n’authentifie personne', async () => {
  const uid = await compteVerifie(req({ authorization: `Bearer ${JETON}` }), supabaseQuiRepond('', 401), ENV)
  assert.equal(uid, '')
})

test('Supabase injoignable : on refuse, on n’invente pas', async () => {
  // ⚠️ Le bon sens de l'échec. Mieux vaut refuser une propriété que d'en
  // accorder une par erreur — et le produit continue de tourner, le jeton
  // d'édition étant un chemin indépendant.
  const enPanne = async () => { throw new Error('ECONNREFUSED') }
  assert.equal(await compteVerifie(req({ authorization: `Bearer ${JETON}` }), enPanne, ENV), '')
})

test('sans configuration, on refuse au lieu de deviner', async () => {
  const apporter = supabaseQuiRepond()
  assert.equal(await compteVerifie(req({ authorization: `Bearer ${JETON}` }), apporter, {}), '')
  assert.equal(apporter.appels.length, 0)
})

test('les deux en-têtes partent : la clé du projet ET le jeton de la personne', async () => {
  const apporter = supabaseQuiRepond()
  await compteVerifie(req({ authorization: `Bearer ${JETON}` }), apporter, ENV)
  const { url, entetes } = apporter.appels[0]
  assert.equal(url, 'https://exemple.supabase.co/auth/v1/user')
  assert.equal(entetes.authorization, `Bearer ${JETON}`)
  assert.equal(entetes.apikey, ENV.SUPABASE_ANON_KEY, 'sans apikey Supabase refuse tout')
})

test('un en-tête malformé est rejeté AVANT tout appel réseau', async () => {
  // Inutile d'envoyer n'importe quoi à Supabase parce que quelqu'un a rempli
  // l'en-tête au hasard — et un jeton géant ferait payer le trajet pour rien.
  const apporter = supabaseQuiRepond()
  for (const mauvais of [
    'Bearer pas-un-jwt',
    'Bearer aaa.bbb',
    `Bearer ${'a'.repeat(5000)}.b.c`,
    'Basic aaa.bbb.ccc',
    'aaa.bbb.ccc',
    'Bearer aaa.bbb.ccc extra',
  ]) {
    assert.equal(await compteVerifie(req({ authorization: mauvais }), apporter, ENV), '', mauvais)
  }
  assert.equal(apporter.appels.length, 0, 'aucun appel réseau ne doit partir pour ces cas')
})

test('une réponse illisible n’authentifie personne', async () => {
  const bavard = async () => new Response('<html>maintenance</html>', { status: 200 })
  assert.equal(await compteVerifie(req({ authorization: `Bearer ${JETON}` }), bavard, ENV), '')
})

test('un identifiant de forme aberrante est refusé', async () => {
  // Défense en profondeur : cet uid finit dans des clés de magasin
  // (`owner/<uid>/<id>`). Même venant de Supabase, on le borne.
  for (const id of ['', 'court', 'x'.repeat(65), 42, null, { id: 'objet' }]) {
    const apporter = async () => new Response(JSON.stringify({ id }), { status: 200 })
    assert.equal(await compteVerifie(req({ authorization: `Bearer ${JETON}` }), apporter, ENV), '', String(id))
  }
})

test('jetonPresente lit l’en-tête sans se laisser abuser par la casse', () => {
  assert.equal(jetonPresente(req({ authorization: `bearer ${JETON}` })), JETON)
  assert.equal(jetonPresente(req({ authorization: `BEARER   ${JETON}` })), JETON)
  assert.equal(jetonPresente(req()), '')
})
