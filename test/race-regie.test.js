import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handleRace, CHAMPS_DE_REGIE, CHAMPS_PRIVES } from '../netlify/functions/race.mjs'

// LA RÈGLE : une correction ne perd aucune clé.
//
// Le PUT reconstruit le blob à partir du seul corps envoyé par le client. Tout
// champ que le SERVEUR avait posé et que le client ne renvoie pas disparaît en
// silence — pas d'erreur, pas de trace, et on ne s'en aperçoit que le jour où
// quelqu'un corrige son tracé et perd ce qui y était attaché.
//
// Ce fichier ne vérifie donc PAS « ownerId survit ». Un tel test serait vert et
// ne protégerait rien du champ suivant : il faudrait penser à l'écrire, et
// c'est précisément ce qu'on ne fait pas. Il vérifie la propriété générale, la
// seule qui vaille — aucune clé ne se perd — plus le fait que la liste des
// champs de régie soit tenue à jour depuis la source.

function fakeStore(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
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

const req = (method, { id, secret, body } = {}) => {
  const url = `https://shibumap.com/.netlify/functions/race${id ? `?id=${id}` : ''}`
  const headers = { 'x-nf-client-connection-ip': '203.0.113.7' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (secret) headers['x-shibumap-secret'] = secret
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Publie une carte et rend { id, secret, store }.
async function publier(store = fakeStore()) {
  const res = await handleRace(req('POST', { body: { gpx: GPX } }), store)
  assert.equal(res.status, 201, 'la publication doit aboutir')
  const { id, secret } = await res.json()
  return { id, secret, store }
}

test('une correction ne perd AUCUNE clé du blob', async () => {
  const { id, secret, store } = await publier()

  const avant = store.raw(id)
  const clesAvant = Object.keys(avant)

  const res = await handleRace(req('PUT', { id, secret, body: { gpx: GPX } }), store)
  assert.equal(res.status, 200)

  const apres = store.raw(id)
  const perdues = clesAvant.filter((c) => !(c in apres))

  assert.deepEqual(
    perdues,
    [],
    `une correction a perdu ${perdues.join(', ')} — ajoutez-les à CHAMPS_DE_REGIE dans race.mjs`,
  )
})

test('la règle vaut pour un champ de régie que le POST ne pose pas encore', async () => {
  // ownerId n'arrive qu'avec les comptes : aucun POST ne l'écrit aujourd'hui.
  // Il est donc invisible pour le test précédent, alors que c'est LUI qui
  // serait effacé le jour où un compte possède une carte. On le pose à la main
  // sur le blob, exactement comme la Phase 2 le fera.
  const { id, secret, store } = await publier()
  const blob = store.raw(id)
  await store.setJSON(id, { ...blob, ownerId: 'u_ABC123' })

  const res = await handleRace(req('PUT', { id, secret, body: { gpx: GPX } }), store)
  assert.equal(res.status, 200)

  assert.equal(
    store.raw(id).ownerId,
    'u_ABC123',
    'le propriétaire a été effacé par une simple correction de tracé',
  )
})

test('le témoin : sans la reconduction, la règle échoue vraiment', async () => {
  // Une règle qui ne peut pas échouer ne prouve rien. On rejoue ici ce que
  // faisait le code AVANT — recopier deux champs nommés à la main — et on
  // vérifie que le test précédent aurait bien mordu.
  const ancien = { gpx: GPX, secretHash: 'x'.repeat(64), createdAt: 'hier', ownerId: 'u_ABC123' }
  const reconstruitALaMain = {
    gpx: GPX,
    secretHash: ancien.secretHash,
    createdAt: ancien.createdAt,
    updatedAt: 'maintenant',
  }
  assert.equal(
    reconstruitALaMain.ownerId,
    undefined,
    'le témoin ne témoigne plus : la reconstruction à la main garde ownerId',
  )
})

test('le GET public ne laisse sortir aucun champ privé', async () => {
  // Un lien /r/<id> est fait pour être ouvert par des centaines de coureurs.
  // Le condensat ne doit pas sortir — sinon n'importe lequel d'entre eux peut
  // réécrire la carte — et l'identifiant de compte non plus : ce serait
  // distribuer à tous la seule chose à connaître pour se faire passer pour
  // l'organisateur ailleurs.
  const { id, store } = await publier()
  await store.setJSON(id, { ...store.raw(id), ownerId: 'u_ABC123' })

  const res = await handleRace(req('GET', { id }), store)
  assert.equal(res.status, 200)
  const { payload } = await res.json()

  for (const champ of CHAMPS_PRIVES) {
    assert.equal(champ in payload, false, `le GET public a laissé sortir ${champ}`)
  }
  assert.ok(payload.createdAt, 'la date de publication, elle, reste publique — « Mes cartes » en a besoin')
})

test('chaque champ de régie est classé public ou privé', () => {
  // Le garde-fou : un champ de régie ajouté sans décision sortirait tout seul
  // sur chaque lien déjà diffusé, en silence. Ici, il faut trancher.
  const PUBLICS_ASSUMES = ['createdAt']
  const nonClasses = CHAMPS_DE_REGIE.filter(
    (c) => !CHAMPS_PRIVES.includes(c) && !PUBLICS_ASSUMES.includes(c),
  )
  assert.deepEqual(
    nonClasses,
    [],
    `${nonClasses.join(', ')} n'est ni privé ni assumé public — tranchez avant de déployer`,
  )
})

test('CHAMPS_DE_REGIE couvre tout ce que le serveur pose sur un blob', async () => {
  // Le garde-fou d'architecture. Le POST est le seul endroit qui décide ce que
  // le serveur ajoute au corps du client ; tout champ posé là et absent de
  // CHAMPS_DE_REGIE se perdra à la première correction. On lit la source
  // plutôt que le blob, pour attraper aussi les champs qu'aucun test ne crée.
  const source = readFileSync(new URL('../netlify/functions/race.mjs', import.meta.url), 'utf8')

  // La ligne du POST : `const payload = { ...fields, <ce qu'on ajoute> }`
  const bloc = source.match(/const payload = \{ \.\.\.fields, ([^}]*)\}/)
  assert.ok(bloc, "le POST ne construit plus son payload comme attendu — ce test doit être relu, pas supprimé")

  const poses = [...bloc[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1])
  // updatedAt est réécrit à chaque correction par définition : il ne se
  // « perd » jamais, c'est le seul champ légitimement hors régie.
  const aCouvrir = poses.filter((c) => c !== 'updatedAt')

  const oublies = aCouvrir.filter((c) => !CHAMPS_DE_REGIE.includes(c))
  assert.deepEqual(
    oublies,
    [],
    `le POST pose ${oublies.join(', ')} sans que la correction les reconduise`,
  )
})
