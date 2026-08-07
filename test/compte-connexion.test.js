import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  creerCompte,
  courrielValide,
  codeValide,
  messageRefus,
  CLE_SESSION,
  URL_CONFIG,
} from '../src/compte.js'

// LA CONNEXION SANS MOT DE PASSE, CÔTÉ NAVIGATEUR.
//
// ⚠️ LE FAUX SUPABASE DE CE FICHIER EST HOSTILE, EXPRÈS. Même sur un REFUS il
// rend un corps JSON parfaitement formé, avec des jetons plausibles dedans. Un
// faux complaisant — corps vide sur 401 — laisse passer une implémentation qui
// ne vérifie jamais le statut : le test est vert parce que `json()` échoue
// toute seule, pas parce que le code est correct. (La leçon a déjà été payée
// une fois sur test/compte-session.test.js, le 2026-08-06.)

const CONFIG = { url: 'https://exemple.supabase.co', cle: 'sb_publishable_x' }
const COURRIEL = 'coureur@example.com'

// ── Un stockage de comédie ───────────────────────────────────────────────────
function stockage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    _carte: m,
  }
}

function stockageEnPanne() {
  return {
    get length() { return 0 },
    key: () => null,
    getItem: () => { throw new Error('SecurityError') },
    setItem: () => { throw new Error('QuotaExceededError') },
    removeItem: () => { throw new Error('SecurityError') },
  }
}

// ── Un Supabase de comédie, hostile ──────────────────────────────────────────
//
// `reponses` associe un fragment d'URL à une fonction (corps) -> [statut, objet].
function faux(reponses = {}) {
  const appels = []
  const apporter = async (url, opts = {}) => {
    let corps = null
    try { corps = opts.body ? JSON.parse(opts.body) : null } catch { corps = null }
    appels.push({ url: String(url), methode: opts.method || 'GET', entetes: opts.headers || {}, corps })

    if (String(url).includes(URL_CONFIG)) {
      const r = reponses.config ? reponses.config(corps) : [200, { ok: true, ...CONFIG }]
      return new Response(JSON.stringify(r[1]), { status: r[0], headers: { 'content-type': 'application/json' } })
    }
    for (const [fragment, fabrique] of Object.entries(reponses)) {
      if (fragment !== 'config' && String(url).includes(fragment)) {
        const r = fabrique(corps, appels)
        return new Response(JSON.stringify(r[1]), { status: r[0], headers: { 'content-type': 'application/json' } })
      }
    }
    return new Response(JSON.stringify({ msg: 'route inattendue' }), { status: 404 })
  }
  apporter.appels = appels
  apporter.vers = (fragment) => appels.filter((a) => a.url.includes(fragment))
  return apporter
}

// Le corps que Supabase rend sur un `verify` réussi.
const sessionOk = (n = 1, expiresIn = 3600) => ({
  access_token: `jeton${n}.charge.signature`,
  refresh_token: `renouvellement-${n}`,
  expires_in: expiresIn,
  expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  token_type: 'bearer',
  user: { id: '7f3c1a20-0000-4000-8000-000000000001', email: COURRIEL },
})

// ⚠️ LE REFUS HOSTILE : un corps complet, avec des jetons utilisables dedans.
const refusGarni = (statut, erreur) => [statut, { ...sessionOk(99), ...erreur }]

const horloge = (t = 1_800_000_000_000) => {
  const h = () => h.t
  h.t = t
  h.avance = (ms) => { h.t += ms }
  return h
}

// ═══════════ LES FORMES, AVANT TOUT RÉSEAU ══════════════════════════════════

test('un courriel et un code sont vérifiés de forme avant de déranger qui que ce soit', () => {
  assert.equal(courrielValide(COURRIEL), true)
  for (const mauvais of ['', 'coureur', 'coureur@', '@example.com', 'a b@example.com', 'x'.repeat(300) + '@e.com', null, 42]) {
    assert.equal(courrielValide(mauvais), false, String(mauvais))
  }
  assert.equal(codeValide('123456'), true)
  assert.equal(codeValide(' 123 456 '), true, 'les gens recopient le code avec des espaces')
  for (const mauvais of ['12345', '1234567', 'abcdef', '', null, '12345a']) {
    assert.equal(codeValide(mauvais), false, String(mauvais))
  }
})

test('un courriel invalide ne fait partir AUCUNE requête', async () => {
  const apporter = faux()
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode('pas-une-adresse')
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'courriel')
  assert.ok(r.erreur.length > 10, 'un message prêt à afficher, en français')
  assert.equal(apporter.appels.length, 0)
})

test('un code de mauvaise forme ne fait partir AUCUNE requête', async () => {
  const apporter = faux()
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.verifierCode(COURRIEL, '12')
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'code')
  assert.equal(apporter.appels.length, 0)
})

// ═══════════ LA CONFIGURATION, PARESSEUSE ═══════════════════════════════════

test('⚠️ créer le module n’appelle RIEN : l’application 3D démarre sans ça', async () => {
  const apporter = faux()
  const c = creerCompte({ apporter, stockage: stockage() })
  assert.equal(c.connecte(), false)
  assert.equal(c.courriel(), '')
  assert.equal(await c.jeton(), '')
  assert.equal(apporter.appels.length, 0, 'aucun appel au chargement du module')
})

test('la configuration n’est demandée qu’une fois, même pour dix connexions', async () => {
  const apporter = faux({ '/auth/v1/otp': () => [200, {}] })
  const c = creerCompte({ apporter, stockage: stockage() })
  await c.demanderCode(COURRIEL)
  await c.demanderCode(COURRIEL)
  await c.demanderCode(COURRIEL)
  assert.equal(apporter.vers(URL_CONFIG).length, 1)
})

test('dix demandes SIMULTANÉES ne font qu’un seul appel de configuration', async () => {
  const apporter = faux({ '/auth/v1/otp': () => [200, {}] })
  const c = creerCompte({ apporter, stockage: stockage() })
  await Promise.all(Array.from({ length: 10 }, () => c.demanderCode(COURRIEL)))
  assert.equal(apporter.vers(URL_CONFIG).length, 1)
})

test('une configuration absente donne un refus lisible, pas une exception', async () => {
  const apporter = faux({ config: () => [503, { ok: false, erreur: 'compte indisponible' }] })
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode(COURRIEL)
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'configuration')
  assert.match(r.erreur, /connexion/i)
})

test('⚠️ une configuration détournée vers un hôte non-https est refusée côté client aussi', async () => {
  // Défense en profondeur : la fonction serveur valide déjà, mais c'est ce
  // navigateur-ci qui va poster le courriel de quelqu'un à cette URL.
  const apporter = faux({ config: () => [200, { ok: true, url: 'http://ailleurs.example', cle: 'x' }] })
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode(COURRIEL)
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'configuration')
  assert.equal(apporter.vers('ailleurs.example').length, 0, 'rien ne doit partir là-bas')
})

// ═══════════ L'ENVOI DU CODE ════════════════════════════════════════════════

test('demander un code poste le courriel avec la clé du projet', async () => {
  const apporter = faux({ '/auth/v1/otp': () => [200, {}] })
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode(`  ${COURRIEL.toUpperCase()} `)
  assert.equal(r.ok, true)
  const appel = apporter.vers('/auth/v1/otp')[0]
  assert.equal(appel.url, 'https://exemple.supabase.co/auth/v1/otp')
  assert.equal(appel.methode, 'POST')
  assert.equal(appel.entetes.apikey, CONFIG.cle, 'sans apikey Supabase refuse tout')
  assert.equal(appel.corps.email, COURRIEL, 'nettoyé et en minuscules')
})

test('trop de demandes : le message dit combien de temps attendre', async () => {
  const apporter = faux({
    '/auth/v1/otp': () => [429, {
      code: 429,
      error_code: 'over_email_send_rate_limit',
      msg: 'For security purposes, you can only request this after 47 seconds.',
    }],
  })
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode(COURRIEL)
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'trop-essais')
  assert.match(r.erreur, /47/, 'le délai réel vaut mieux qu’un « réessayez plus tard »')
})

test('réseau coupé : un refus, jamais une exception', async () => {
  const apporter = async () => { throw new Error('Failed to fetch') }
  const c = creerCompte({ apporter, stockage: stockage() })
  const r = await c.demanderCode(COURRIEL)
  assert.equal(r.ok, false)
  assert.equal(r.raison, 'reseau')
})

// ═══════════ LA VÉRIFICATION DU CODE ════════════════════════════════════════

test('un code juste ouvre la session et la range', async () => {
  const rangement = stockage()
  const apporter = faux({ '/auth/v1/verify': () => [200, sessionOk(1)] })
  const c = creerCompte({ apporter, stockage: rangement, maintenant: horloge() })
  const r = await c.verifierCode(COURRIEL, '123 456')
  assert.equal(r.ok, true)
  assert.equal(r.courriel, COURRIEL)
  assert.equal(c.connecte(), true)
  assert.equal(await c.jeton(), 'jeton1.charge.signature')

  const appel = apporter.vers('/auth/v1/verify')[0]
  assert.equal(appel.url, 'https://exemple.supabase.co/auth/v1/verify')
  assert.deepEqual(appel.corps, { email: COURRIEL, token: '123456', type: 'email' })
  assert.equal(appel.entetes.apikey, CONFIG.cle)

  const range = JSON.parse(rangement.getItem(CLE_SESSION))
  assert.equal(range.jeton, 'jeton1.charge.signature')
  assert.equal(range.renouvellement, 'renouvellement-1')
})

test('⚠️ un REFUS garni de jetons plausibles n’ouvre AUCUNE session', async () => {
  // Le corps de ce refus contient un access_token et un refresh_token
  // parfaitement formés. Une implémentation qui lit le corps sans regarder le
  // statut connecterait l'utilisateur sur un code faux.
  const rangement = stockage()
  const apporter = faux({
    '/auth/v1/verify': () => refusGarni(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }),
  })
  const c = creerCompte({ apporter, stockage: rangement })
  const r = await c.verifierCode(COURRIEL, '123456')
  assert.equal(r.ok, false)
  assert.equal(c.connecte(), false)
  assert.equal(await c.jeton(), '')
  assert.equal(rangement.getItem(CLE_SESSION), null, 'rien ne doit être rangé sur un refus')
})

test('chaque refus a SON message : code faux, code expiré, trop d’essais', async () => {
  const cas = [
    [400, { error_code: 'otp_disabled', msg: 'Token has expired or is invalid' }, 'code-expire'],
    [403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 'code-expire'],
    [401, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 'code-faux'],
    [400, { msg: 'Invalid token' }, 'code-faux'],
    [429, { msg: 'Too many requests' }, 'trop-essais'],
    [500, { msg: 'Internal error' }, 'indisponible'],
  ]
  const vus = new Set()
  for (const [statut, erreur, raison] of cas) {
    const apporter = faux({ '/auth/v1/verify': () => refusGarni(statut, erreur) })
    const c = creerCompte({ apporter, stockage: stockage() })
    const r = await c.verifierCode(COURRIEL, '123456')
    assert.equal(r.ok, false, `${statut}`)
    assert.equal(r.raison, raison, `${statut} ${JSON.stringify(erreur)}`)
    assert.ok(/[a-zà-ÿ]{4}/i.test(r.erreur), 'un vrai message français')
    assert.ok(!/[A-Za-z]+ (has expired|login credentials)/.test(r.erreur), 'jamais l’anglais de Supabase à l’écran')
    vus.add(r.erreur)
  }
  assert.ok(vus.size >= 4, 'des messages DIFFÉRENTS, pas un « échec » unique')
})

test('messageRefus distingue l’envoi de la vérification', () => {
  const envoi = messageRefus(400, { msg: 'Unable to validate email address' }, 'envoi')
  assert.equal(envoi.raison, 'courriel')
  const verif = messageRefus(400, { msg: 'Invalid token' }, 'verification')
  assert.equal(verif.raison, 'code-faux')
  assert.notEqual(envoi.erreur, verif.erreur)
})

// ═══════════ LA SESSION SURVIT AU RECHARGEMENT ══════════════════════════════

test('la session relue d’un chargement précédent reconnecte sans rien redemander', async () => {
  const rangement = stockage()
  const h = horloge()
  const apporter = faux({ '/auth/v1/verify': () => [200, sessionOk(1)] })
  await creerCompte({ apporter, stockage: rangement, maintenant: h }).verifierCode(COURRIEL, '123456')

  // Rechargement de la page : un module tout neuf, le même stockage.
  const apporter2 = faux()
  const c2 = creerCompte({ apporter: apporter2, stockage: rangement, maintenant: h })
  assert.equal(c2.connecte(), true)
  assert.equal(c2.courriel(), COURRIEL)
  assert.equal(await c2.jeton(), 'jeton1.charge.signature')
  assert.equal(apporter2.appels.length, 0, 'un jeton encore valide ne se renouvelle pas')
})

test('une session illisible ou d’une version précédente ne fait pas tomber le module', async () => {
  for (const brut of ['{{', 'null', '"texte"', '{}', '{"jeton":"x"}', '{"jeton":"a.b.c","renouvellement":""}']) {
    const c = creerCompte({ apporter: faux(), stockage: stockage({ [CLE_SESSION]: brut }) })
    assert.equal(c.connecte(), false, brut)
    assert.equal(await c.jeton(), '', brut)
  }
})

test('un stockage refusé (navigation privée) n’empêche pas de se connecter', async () => {
  const apporter = faux({ '/auth/v1/verify': () => [200, sessionOk(1)] })
  const c = creerCompte({ apporter, stockage: stockageEnPanne() })
  const r = await c.verifierCode(COURRIEL, '123456')
  assert.equal(r.ok, true, 'la session vit en mémoire, elle ne survivra juste pas au rechargement')
  assert.equal(await c.jeton(), 'jeton1.charge.signature')
})

// ═══════════ LE RENOUVELLEMENT ══════════════════════════════════════════════

test('un jeton expiré est renouvelé sans que l’appelant en sache rien', async () => {
  const h = horloge()
  const rangement = stockage()
  const apporter = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => [200, sessionOk(2)],
  })
  const c = creerCompte({ apporter, stockage: rangement, maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000) // une heure : le jeton est mort

  assert.equal(await c.jeton(), 'jeton2.charge.signature')
  const appel = apporter.vers('grant_type=refresh_token')[0]
  assert.equal(appel.corps.refresh_token, 'renouvellement-1')
  assert.equal(appel.entetes.apikey, CONFIG.cle)
  // La rotation doit être rangée, sinon le prochain rechargement rejoue un
  // jeton de renouvellement déjà consommé.
  assert.equal(JSON.parse(rangement.getItem(CLE_SESSION)).renouvellement, 'renouvellement-2')
})

test('le jeton se renouvelle AVANT d’expirer, pas pendant l’appel', async () => {
  const h = horloge()
  const apporter = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => [200, sessionOk(2)],
  })
  const c = creerCompte({ apporter, stockage: stockage(), maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000 - 30_000) // il reste 30 secondes : trop peu pour un aller-retour
  assert.equal(await c.jeton(), 'jeton2.charge.signature')
})

test('⚠️ DIX appels simultanés ne déclenchent QU’UN renouvellement', async () => {
  // Sans ce verrou : dix renouvellements concurrents, dont neuf invalident le
  // premier — et l'utilisateur se retrouve déconnecté au milieu d'un export.
  const h = horloge()
  let n = 1
  const apporter = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => { n += 1; return [200, sessionOk(n)] },
  })
  const c = creerCompte({ apporter, stockage: stockage(), maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000)

  const jetons = await Promise.all(Array.from({ length: 10 }, () => c.jeton()))
  assert.equal(apporter.vers('grant_type=refresh_token').length, 1, 'un seul renouvellement')
  assert.deepEqual([...new Set(jetons)], ['jeton2.charge.signature'], 'et tout le monde repart avec le même')
})

test('après le renouvellement, le verrou est rendu : la fois suivante marche aussi', async () => {
  const h = horloge()
  let n = 1
  const apporter = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => { n += 1; return [200, sessionOk(n)] },
  })
  const c = creerCompte({ apporter, stockage: stockage(), maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000)
  assert.equal(await c.jeton(), 'jeton2.charge.signature')
  h.avance(3600_000)
  assert.equal(await c.jeton(), 'jeton3.charge.signature')
})

test('⚠️ un renouvellement REFUSÉ déconnecte au lieu de boucler', async () => {
  const h = horloge()
  const rangement = stockage()
  const apporter = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => refusGarni(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }),
  })
  const c = creerCompte({ apporter, stockage: rangement, maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000)

  assert.equal(await c.jeton(), '')
  assert.equal(c.connecte(), false)
  assert.equal(rangement.getItem(CLE_SESSION), null)
  await c.jeton()
  assert.equal(apporter.vers('grant_type=refresh_token').length, 1, 'on ne réessaie pas un jeton mort en boucle')
})

test('un renouvellement en panne réseau ne DÉCONNECTE pas : il échoue, et c’est tout', async () => {
  // Une coupure de wifi n'est pas une révocation. Effacer la session ici
  // obligerait à redemander un code par courriel à chaque tunnel.
  const h = horloge()
  const rangement = stockage()
  let coupe = false
  const base = faux({
    '/auth/v1/verify': () => [200, sessionOk(1)],
    'grant_type=refresh_token': () => [200, sessionOk(2)],
  })
  const apporter = async (url, opts) => {
    if (coupe && String(url).includes('grant_type=refresh_token')) throw new Error('Failed to fetch')
    return base(url, opts)
  }
  const c = creerCompte({ apporter, stockage: rangement, maintenant: h })
  await c.verifierCode(COURRIEL, '123456')
  h.avance(3600_000)
  coupe = true
  assert.equal(await c.jeton(), '')
  assert.equal(c.connecte(), true, 'toujours connecté, juste sans jeton utilisable à cet instant')
  coupe = false
  assert.equal(await c.jeton(), 'jeton2.charge.signature', 'le réseau revient, la session aussi')
})

test('les en-têtes prêts à poser sur une requête ShibuMap', async () => {
  const apporter = faux({ '/auth/v1/verify': () => [200, sessionOk(1)] })
  const c = creerCompte({ apporter, stockage: stockage(), maintenant: horloge() })
  assert.deepEqual(await c.entetes(), {}, 'sans compte, pas d’en-tête — et c’est le cas courant')
  await c.verifierCode(COURRIEL, '123456')
  // Exactement ce que `jetonPresente` (netlify/functions/_compte.mjs) sait lire.
  assert.deepEqual(await c.entetes(), { authorization: 'Bearer jeton1.charge.signature' })
})

// ═══════════ LA DÉCONNEXION ═════════════════════════════════════════════════

test('se déconnecter efface la session, en mémoire ET sur le disque', async () => {
  const rangement = stockage()
  const apporter = faux({ '/auth/v1/verify': () => [200, sessionOk(1)] })
  const c = creerCompte({ apporter, stockage: rangement, maintenant: horloge() })
  await c.verifierCode(COURRIEL, '123456')
  c.deconnecter()
  assert.equal(c.connecte(), false)
  assert.equal(c.courriel(), '')
  assert.equal(await c.jeton(), '')
  assert.equal(rangement.getItem(CLE_SESSION), null)
})

test('⚠️ se déconnecter emporte aussi ce qui traîne d’une session précédente', async () => {
  // Une clé d'une version antérieure du module, ou une trace laissée par le SDK
  // Supabase (`sb-…-auth-token`) : ce sont des jetons vivants. « Déconnecté »
  // doit vouloir dire qu'il n'en reste aucun.
  const rangement = stockage({
    [CLE_SESSION]: '{"jeton":"a.b.c","renouvellement":"r"}',
    'shibumap.compte.jeton': 'vieille-version',
    'sb-exemple-auth-token': '{"access_token":"fuite"}',
    'shibumap.race.secrets': '{"abc":"garder"}',
    'autre.chose': 'garder',
  })
  const session = stockage({ 'sb-exemple-auth-token': 'aussi-ici' })
  const c = creerCompte({ apporter: faux(), stockage: rangement, stockageSession: session })
  c.deconnecter()
  assert.deepEqual([...rangement._carte.keys()].sort(), ['autre.chose', 'shibumap.race.secrets'])
  assert.equal(session._carte.size, 0)
})

test('se déconnecter sur un stockage en panne ne lève pas', () => {
  const c = creerCompte({ apporter: faux(), stockage: stockageEnPanne(), stockageSession: stockageEnPanne() })
  assert.doesNotThrow(() => c.deconnecter())
  assert.equal(c.connecte(), false)
})
