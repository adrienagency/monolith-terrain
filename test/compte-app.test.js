// L'ADAPTATEUR — le pont entre `src/compte.js` (la session) et les quatre
// écrans de `src/ui/compte.js`.
//
// ⚠️ CE QUE CE FICHIER SURVEILLE EN PRIORITÉ, dans l'ordre de ce qui ferait le
// plus de dégâts :
//   1. le LIEN d'une carte, qui finit dans un `href` : il doit être FABRIQUÉ
//      ici, jamais recopié du serveur ;
//   2. le REJET plutôt que le `{ ok:false }` : les quatre écrans sont écrits
//      autour d'un `try/catch`, un refus rendu passerait pour un succès ;
//   3. l'export de données, qui n'a aucune fonction serveur et doit donc être
//      complet ou absent, jamais amputé en silence.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  creerCompteApp,
  lienDeCarte,
  lieuLisible,
  carteAffichable,
  composerExport,
  nomFichierExport,
  ORIGINE_PARTAGE,
  URL_MES_CARTES,
  URL_SUPPRESSION,
} from '../src/compte-app.js'
import { creerCompte } from '../src/compte.js'

// ── Une session de comédie, à l'état réglable ───────────────────────────────
function sessionFausse(etat = {}) {
  const s = {
    dedans: false,
    adresse: '',
    jeton: '',
    deconnexions: 0,
    reponseDemande: { ok: true },
    reponseVerif: { ok: true },
    ...etat,
  }
  return {
    _etat: s,
    connecte: () => s.dedans,
    courriel: () => s.adresse,
    jeton: async () => s.jeton,
    entetes: async () => (s.jeton ? { authorization: `Bearer ${s.jeton}` } : {}),
    deconnecter: () => { s.deconnexions += 1; s.dedans = false; s.adresse = '' },
    demanderCode: async () => s.reponseDemande,
    verifierCode: async () => {
      if (s.reponseVerif.ok) { s.dedans = true; s.adresse = 'coureur@example.com'; s.jeton = 'j.w.t' }
      return s.reponseVerif
    },
  }
}

// Un `fetch` de comédie qui note tout ce qu'on lui donne.
function apporterFaux(reponses = {}) {
  const appels = []
  const f = async (url, opts = {}) => {
    appels.push({ url, opts })
    const cle = Object.keys(reponses).find((k) => String(url).includes(k))
    const fait = cle ? reponses[cle] : null
    if (!fait) return new Response(JSON.stringify({ ok: false }), { status: 404 })
    if (typeof fait === 'function') return fait(opts)
    return fait
  }
  f.appels = appels
  return f
}

const rep = (corps, statut = 200) => new Response(JSON.stringify(corps), { status: statut })

// ═══════════ LE LIEN, FABRIQUÉ ICI ══════════════════════════════════════════

test('un lien de carte se construit autour de l’id, sur l’origine publique', () => {
  assert.equal(lienDeCarte('abc123'), `${ORIGINE_PARTAGE}/#r=abc123`)
  assert.equal(lienDeCarte('AbC123XyZ'), `${ORIGINE_PARTAGE}/#r=AbC123XyZ`)
})

test('⚠️ un id qui n’est pas un id ne donne AUCUN lien', () => {
  for (const mauvais of [
    'abc', // trop court
    'a'.repeat(17), // trop long
    'abc-123', // ID_RE n'accepte que des alphanumériques
    'abc123/../autre',
    'javascript:alert(1)',
    '../../etc/passwd',
    '',
    null,
    undefined,
    42,
    { toString: () => 'abc123' },
  ]) {
    assert.equal(lienDeCarte(mauvais), '', String(mauvais))
  }
})

test('⚠️ une `url` envoyée par le serveur est IGNORÉE, le lien est refabriqué', () => {
  // Le serveur ne rend qu'un id (voir race.mjs) — mais s'il en rendait un jour
  // davantage, ou si le magasin de blobs était pollué, cette ligne est celle
  // qui empêche un `javascript:` d'atterrir dans le `href` de « Mes cartes ».
  const c = carteAffichable({
    id: 'abc123',
    nom: 'Trail des Aravis',
    url: 'javascript:alert(document.cookie)',
    creeLe: '2026-08-01T10:00:00.000Z',
  })
  assert.equal(c.url, `${ORIGINE_PARTAGE}/#r=abc123`)
  assert.ok(!c.url.includes('javascript'))
})

test('une entrée sans id exploitable ne donne pas de ligne du tout', () => {
  assert.equal(carteAffichable({ id: 'x', nom: 'Trop court' }), null)
  assert.equal(carteAffichable(null), null)
  assert.equal(carteAffichable({ nom: 'sans id' }), null)
})

test('le nom est borné — un titre de 10 000 caractères ne descend pas dans le rail', () => {
  const c = carteAffichable({ id: 'abc123', nom: 'x'.repeat(10_000) })
  assert.equal(c.nom.length, 120)
})

// ═══════════ LE LIEU, LISIBLE ═══════════════════════════════════════════════

test('le lieu s’écrit en points cardinaux, avec la virgule française', () => {
  assert.equal(lieuLisible({ lat: 45.92, lon: 6.87 }), '45,92° N 6,87° E')
  assert.equal(lieuLisible({ lat: -33.87, lon: -70.66 }), '33,87° S 70,66° O')
})

test('un lieu absent ou aberrant ne rend rien plutôt qu’un « NaN° N »', () => {
  for (const mauvais of [null, undefined, {}, { lat: 45 }, { lat: 'x', lon: 2 }, { lat: 200, lon: 2 }, { lat: NaN, lon: 0 }]) {
    assert.equal(lieuLisible(mauvais), '', JSON.stringify(mauvais))
  }
})

// ═══════════ LES REFUS REJETTENT, ILS NE SE RENDENT PAS ═════════════════════

test('⚠️ demanderCode REJETTE en cas de refus — un `{ ok:false }` passerait pour un succès', async () => {
  const session = sessionFausse({ reponseDemande: { ok: false, raison: 'envoi-impossible', erreur: 'texte' } })
  const app = creerCompteApp({ session })
  await assert.rejects(() => app.demanderCode('a@b.fr'), (e) => e.code === 'envoi-impossible')
})

test('demanderCode résout sans rien rendre quand le code est parti', async () => {
  const app = creerCompteApp({ session: sessionFausse() })
  assert.equal(await app.demanderCode('a@b.fr'), undefined)
})

test('⚠️ verifierCode REJETTE, et le code de refus traverse TEL QUEL', async () => {
  for (const raison of ['code-faux', 'code-expire', 'trop-essais', 'injoignable']) {
    const app = creerCompteApp({ session: sessionFausse({ reponseVerif: { ok: false, raison } }) })
    await assert.rejects(() => app.verifierCode('a@b.fr', '123456'), (e) => e.code === raison, raison)
  }
})

test('un refus sans raison lisible retombe sur `injoignable`', async () => {
  const app = creerCompteApp({ session: sessionFausse({ reponseDemande: { ok: false } }) })
  await assert.rejects(() => app.demanderCode('a@b.fr'), (e) => e.code === 'injoignable')
})

// ⚠️ LE DÉFAUT D'ORIGINE, VU DEPUIS L'ÉCRAN. C'est le bout de la chaîne :
// une session RÉELLE, un vrai refus, et les deux causes qui se confondaient
// doivent arriver distinctes jusqu'au `catch` de l'écran.
test('⚠️ adresse mal formée et refus d’envoi arrivent DISTINCTS jusqu’à l’écran', async () => {
  const config = () => rep({ ok: true, url: 'https://exemple.supabase.co', cle: 'sb_publishable_x' })
  const stockage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null }
  const app = creerCompteApp({
    session: creerCompte({
      apporter: apporterFaux({
        'compte-config': config,
        '/auth/v1/otp': () => rep({ msg: 'Error sending confirmation email' }, 400),
      }),
      stockage,
    }),
  })
  const codes = []
  for (const adresse of ['pas-une-adresse', 'coureur@example.com']) {
    await app.demanderCode(adresse).catch((e) => codes.push(e.code))
  }
  assert.deepEqual(codes, ['adresse-invalide', 'envoi-impossible'])
})

// ═══════════ LA PRÉSENCE, ET QUI EN EST PRÉVENU ═════════════════════════════

test('surChangement prévient à la connexion, à la déconnexion, et rend un désabonnement', async () => {
  const session = sessionFausse()
  const app = creerCompteApp({ session })
  let vus = 0
  const stop = app.surChangement(() => { vus += 1 })

  assert.equal(app.estConnecte(), false)
  assert.equal(app.adresse(), null)

  await app.verifierCode('a@b.fr', '123456')
  assert.equal(vus, 1)
  assert.equal(app.estConnecte(), true)
  assert.equal(app.adresse(), 'coureur@example.com')

  await app.deconnecter()
  assert.equal(vus, 2)
  assert.equal(app.estConnecte(), false)
  assert.equal(app.adresse(), null)

  stop()
  await app.verifierCode('a@b.fr', '123456')
  assert.equal(vus, 2, 'désabonné veut dire désabonné')
})

test('⚠️ un écouteur qui lève n’emporte ni les autres, ni la connexion qui vient de réussir', async () => {
  const app = creerCompteApp({ session: sessionFausse() })
  let second = 0
  app.surChangement(() => { throw new Error('un panneau mal réveillé') })
  app.surChangement(() => { second += 1 })
  await app.verifierCode('a@b.fr', '123456')
  assert.equal(second, 1)
  assert.equal(app.estConnecte(), true)
})

// ═══════════ « MES CARTES » ═════════════════════════════════════════════════

const CARTES_SERVEUR = {
  ok: true,
  cartes: [
    { id: 'abc123', nom: 'Trail des Aravis', lieu: { lat: 45.92, lon: 6.87, zoom: 12 }, creeLe: '2026-08-01T10:00:00.000Z' },
    { id: 'zz', nom: 'id invalide' },
    { id: 'def456', nom: '', lieu: null, creeLe: '2026-07-02T08:00:00.000Z' },
  ],
}

test('mesCartes appelle ?mine=1 avec les en-têtes de la session, et rend des lignes prêtes', async () => {
  const apporter = apporterFaux({ 'race?mine=1': () => rep(CARTES_SERVEUR) })
  const app = creerCompteApp({ session: sessionFausse({ dedans: true, jeton: 'j.w.t' }), apporter })
  const cartes = await app.mesCartes()

  assert.equal(apporter.appels.length, 1)
  assert.equal(apporter.appels[0].url, URL_MES_CARTES)
  assert.equal(apporter.appels[0].opts.headers.authorization, 'Bearer j.w.t')

  assert.equal(cartes.length, 2, 'l’entrée à l’id invalide est sautée, pas rendue à moitié')
  assert.deepEqual(cartes[0], {
    id: 'abc123',
    nom: 'Trail des Aravis',
    lieu: '45,92° N 6,87° E',
    publieeLe: '2026-08-01T10:00:00.000Z',
    url: `${ORIGINE_PARTAGE}/#r=abc123`,
  })
  assert.equal(cartes[1].lieu, '', 'un bloc sans position ne fabrique pas de lieu')
})

test('⚠️ sans jeton utilisable, mesCartes ne fait PARTIR AUCUNE requête', async () => {
  // Le serveur débite le forfait de l'IP AVANT de vérifier la session (voir
  // COUT_APPEL_LISTE dans race.mjs) : se faire refuser ses propres lectures
  // pour avoir rechargé une page déconnectée serait absurde.
  const apporter = apporterFaux({ 'race?mine=1': () => rep(CARTES_SERVEUR) })
  const app = creerCompteApp({ session: sessionFausse(), apporter })
  assert.deepEqual(await app.mesCartes(), [])
  assert.equal(apporter.appels.length, 0)
})

test('mesCartes traduit ce qui rate : réseau, 429, corps illisible', async () => {
  const cas = [
    [() => { throw new Error('Failed to fetch') }, 'injoignable'],
    [() => rep({ error: 'trop de lectures' }, 429), 'trop-essais'],
    [() => rep({ error: 'connexion requise' }, 401), 'injoignable'],
    [() => new Response('pas du json', { status: 200 }), 'injoignable'],
    [() => rep({ ok: true }), 'injoignable'], // pas de tableau `cartes`
  ]
  for (const [fait, attendu] of cas) {
    const app = creerCompteApp({
      session: sessionFausse({ dedans: true, jeton: 'j.w.t' }),
      apporter: apporterFaux({ 'race?mine=1': fait }),
    })
    await assert.rejects(() => app.mesCartes(), (e) => e.code === attendu, attendu)
  }
})

// ═══════════ L'EXPORT, SANS SERVEUR ═════════════════════════════════════════

test('composerExport rassemble l’adresse, les cartes et les gabarits locaux', () => {
  const f = composerExport({
    adresse: 'coureur@example.com',
    cartes: [{ id: 'abc123', nom: 'Trail', lieu: 'ici', publieeLe: '2026-08-01', url: 'https://shibumap.com/#r=abc123' }],
    gabarits: [{ name: 'Mon look', look: { seaColor: '#123456' } }, { name: 'sans look' }],
    quand: '2026-08-08T09:00:00.000Z',
  })
  assert.equal(f.format, 'shibumap-mes-donnees')
  assert.equal(f.compte.adresse, 'coureur@example.com')
  assert.equal(f.cartes.length, 1)
  assert.equal(f.gabarits.length, 1, 'une entrée sans `look` n’est pas un gabarit')
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(f)))
})

test('exporterMesDonnees remet le fichier lui-même, sans toucher à aucune fonction serveur', async () => {
  const apporter = apporterFaux({ 'race?mine=1': () => rep(CARTES_SERVEUR) })
  const remis = []
  const app = creerCompteApp({
    session: sessionFausse({ dedans: true, jeton: 'j.w.t', adresse: 'coureur@example.com' }),
    apporter,
    gabarits: () => [{ name: 'Mon look', look: {} }],
    remettreFichier: (texte, nom) => remis.push({ texte, nom }),
    maintenant: () => Date.parse('2026-08-08T09:00:00.000Z'),
  })
  await app.exporterMesDonnees()

  assert.equal(remis.length, 1)
  assert.equal(remis[0].nom, 'shibumap-mes-donnees-2026-08-08.json')
  const contenu = JSON.parse(remis[0].texte)
  assert.equal(contenu.compte.adresse, 'coureur@example.com')
  assert.equal(contenu.cartes.length, 2)
  assert.equal(contenu.gabarits.length, 1)
  // La SEULE route touchée est celle de la liste — aucune fonction d'export.
  assert.deepEqual(apporter.appels.map((a) => a.url), [URL_MES_CARTES])
})

test('⚠️ si la liste ne vient pas, AUCUN fichier n’est remis — un export amputé se garde des années', async () => {
  const remis = []
  const app = creerCompteApp({
    session: sessionFausse({ dedans: true, jeton: 'j.w.t' }),
    apporter: apporterFaux({ 'race?mine=1': () => rep({ error: 'boom' }, 502) }),
    gabarits: () => [],
    remettreFichier: (t, n) => remis.push({ t, n }),
  })
  await assert.rejects(() => app.exporterMesDonnees(), (e) => e.code === 'injoignable')
  assert.equal(remis.length, 0)
})

test('exporter sans être connecté refuse au lieu de livrer un fichier vide', async () => {
  const app = creerCompteApp({ session: sessionFausse(), remettreFichier: () => assert.fail('rien ne doit partir') })
  await assert.rejects(() => app.exporterMesDonnees(), (e) => e.code === 'injoignable')
})

test('le nom du fichier reste sain même sans horloge crédible', () => {
  assert.equal(nomFichierExport(Number.NaN), 'shibumap-mes-donnees-sans-date.json')
  assert.match(nomFichierExport(Date.parse('2026-01-02T00:00:00Z')), /^shibumap-mes-donnees-2026-01-02\.json$/)
})

// ═══════════ LA SUPPRESSION ═════════════════════════════════════════════════

test('⚠️ supprimerMonCompte poste SANS CORPS — aucun identifiant ne voyage', async () => {
  const apporter = apporterFaux({ 'compte-supprimer': () => rep({ ok: true }) })
  const session = sessionFausse({ dedans: true, jeton: 'j.w.t' })
  const app = creerCompteApp({ session, apporter })
  let prevenu = 0
  app.surChangement(() => { prevenu += 1 })

  await app.supprimerMonCompte()

  const appel = apporter.appels[0]
  assert.equal(appel.url, URL_SUPPRESSION)
  assert.equal(appel.opts.method, 'POST')
  assert.equal(appel.opts.headers.authorization, 'Bearer j.w.t')
  assert.equal(appel.opts.body, undefined, 'un corps est une occasion de croire un identifiant')
  // Le compte n'existe plus : la session locale ne doit pas lui survivre.
  assert.equal(session._etat.deconnexions, 1)
  assert.equal(app.estConnecte(), false)
  assert.equal(prevenu, 1)
})

test('une suppression non configurée (503) refuse proprement, sans déconnecter', async () => {
  const session = sessionFausse({ dedans: true, jeton: 'j.w.t' })
  const app = creerCompteApp({
    session,
    apporter: apporterFaux({ 'compte-supprimer': () => rep({ ok: false, erreur: 'non configurée' }, 503) }),
  })
  await assert.rejects(() => app.supprimerMonCompte(), (e) => e.code === 'injoignable')
  assert.equal(session._etat.deconnexions, 0, 'un refus ne doit pas jeter dehors quelqu’un dont le compte existe encore')
  assert.equal(app.estConnecte(), true)
})

test('supprimer sans session ne fait partir aucune requête', async () => {
  const apporter = apporterFaux({ 'compte-supprimer': () => rep({ ok: true }) })
  const app = creerCompteApp({ session: sessionFausse(), apporter })
  await assert.rejects(() => app.supprimerMonCompte(), (e) => e.code === 'injoignable')
  assert.equal(apporter.appels.length, 0)
})
