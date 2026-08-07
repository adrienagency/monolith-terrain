import { test } from 'node:test'
import assert from 'node:assert/strict'
import configHandler, { configPublique, urlSupabaseValide } from '../netlify/functions/compte-config.mjs'

// La seule chose que cette fonction a le droit de dire au navigateur : l'URL du
// projet Supabase et sa clé publique. Deux valeurs, pas trois — et surtout pas
// « tout ce qui traîne dans l'environnement ».

const ENV = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' }

const req = (methode = 'GET') => new Request('https://shibumap.com/.netlify/functions/compte-config', { method: methode })

test('la configuration publique se réduit à l’URL et à la clé', () => {
  const c = configPublique(ENV)
  assert.equal(c.ok, true)
  assert.equal(c.url, ENV.SUPABASE_URL)
  assert.equal(c.cle, ENV.SUPABASE_ANON_KEY)
})

test('⚠️ RIEN d’autre ne sort, même si l’environnement en déborde', async () => {
  // Le vrai environnement Netlify porte STRIPE_SECRET_KEY, les jetons de
  // déploiement et le secret du webhook. Une fonction qui parcourrait
  // `process.env` les publierait tous, d'un coup, sans que rien ne le signale.
  const pollue = {
    ...ENV,
    STRIPE_SECRET_KEY: 'sk_live_JAMAIS',
    STRIPE_WEBHOOK_SECRET: 'whsec_JAMAIS',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_JAMAIS',
    NETLIFY_AUTH_TOKEN: 'nfp_JAMAIS',
  }
  const rep = await configHandler(req(), {}, pollue)
  const texte = await rep.text()
  assert.equal(Object.keys(JSON.parse(texte)).sort().join(','), 'cle,ok,url')
  for (const secret of ['sk_live_JAMAIS', 'whsec_JAMAIS', 'service_role_JAMAIS', 'nfp_JAMAIS']) {
    assert.ok(!texte.includes(secret), `${secret} n’a rien à faire dans la réponse`)
  }
})

test('sans configuration, on le DIT — on n’invente pas une URL vide', async () => {
  const rep = await configHandler(req(), {}, {})
  assert.equal(rep.status, 503)
  assert.equal((await rep.json()).ok, false)
})

test('⚠️ une URL qui n’est pas https est refusée AVANT de partir au navigateur', async () => {
  // Cette URL est celle vers laquelle le navigateur POSTERA le courriel de
  // l'utilisateur. Une variable mal remplie — ou changée par erreur — ne doit
  // pas pouvoir détourner ce courriel vers un hôte quelconque, en clair.
  for (const mauvaise of [
    'http://exemple.supabase.co',
    'https://user:motdepasse@exemple.supabase.co',
    'https://exemple.supabase.co/?fuite=1',
    'javascript:alert(1)',
    'exemple.supabase.co',
    '  ',
    'https://' + 'x'.repeat(600) + '.co',
  ]) {
    assert.equal(urlSupabaseValide(mauvaise), false, mauvaise)
    const rep = await configHandler(req(), {}, { ...ENV, SUPABASE_URL: mauvaise })
    assert.equal(rep.status, 503, mauvaise)
  }
  assert.equal(urlSupabaseValide('https://exemple.supabase.co'), true)
  assert.equal(urlSupabaseValide('https://exemple.supabase.co/'), true)
})

test('une clé absurde est refusée aussi', async () => {
  for (const cle of ['', '   ', 'x'.repeat(5000)]) {
    const rep = await configHandler(req(), {}, { ...ENV, SUPABASE_ANON_KEY: cle })
    assert.equal(rep.status, 503, JSON.stringify(cle).slice(0, 20))
  }
})

test('seul le GET répond', async () => {
  for (const m of ['POST', 'PUT', 'DELETE']) {
    const rep = await configHandler(req(m), {}, ENV)
    assert.equal(rep.status, 405, m)
  }
})

test('la réponse ne se met pas en cache', async () => {
  // Ces deux valeurs sont publiques, mais elles tournent le jour où la clé est
  // révoquée. Un cache de trente secondes vaut mieux que rien pour la charge —
  // et ne vaut rien du tout face à une révocation.
  const rep = await configHandler(req(), {}, ENV)
  assert.match(rep.headers.get('cache-control') || '', /no-store/)
  assert.match(rep.headers.get('content-type') || '', /application\/json/)
})
