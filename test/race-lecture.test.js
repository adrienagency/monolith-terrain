import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  handleRace,
  refillBucket,
  delaiRecharge,
  cleSeauLecture,
  LECTURE_CAP_OCTETS,
  LECTURE_FENETRE_MS,
} from '../netlify/functions/race.mjs'

// LE GET N'AVAIT AUCUN FREIN. Le seau à jetons par IP ne servait qu'aux
// écritures — takeToken n'était appelé qu'après le retour de la branche GET.
// Or c'est la lecture qui coûte : une réponse peut peser jusqu'à ~4,26 Mo, et
// déposer une course au plafond ne demande qu'une seule écriture, largement
// sous la limite. Relire cet id en boucle depuis une machine suffisait alors à
// vider l'allocation mensuelle de bande passante en quelques minutes.
//
// La correction est un SECOND seau, propre à la lecture, compté en OCTETS et
// non en requêtes : c'est la bande passante qui se paie, et c'est aussi la
// seule unité où un partage légitime (des centaines de coureurs derrière une
// même IP publique) et un abus (le même payload tiré en boucle) ne se
// ressemblent pas. Ces tests tiennent les deux bouts : l'abus est freiné, le
// partage ne l'est jamais.

function fakeStore() {
  const m = new Map()
  const compte = { get: 0, set: 0 }
  return {
    compte,
    keys: () => [...m.keys()],
    raw: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    async get(key) {
      compte.get++
      return m.has(key) ? JSON.parse(m.get(key)) : null
    },
    async setJSON(key, value) {
      compte.set++
      m.set(key, JSON.stringify(value))
    },
  }
}

const GPX = '<gpx version="1.1"><trk><trkseg><trkpt lat="45.9" lon="6.13"/><trkpt lat="45.91" lon="6.14"/></trkseg></trk></gpx>'

// Une vraie trace, décimée par gpx.js à MAX_POINTS, pèse quelques centaines de
// ko. On en fabrique une de cette taille-là pour raisonner en octets réels.
function gpxDeTaille(octetsVises) {
  const tete = '<gpx version="1.1"><trk><trkseg>'
  const pied = '</trkseg></trk></gpx>'
  const pt = '<trkpt lat="45.912345" lon="6.134567"><ele>1234.5</ele></trkpt>'
  const n = Math.max(2, Math.ceil((octetsVises - tete.length - pied.length) / pt.length))
  return tete + pt.repeat(n) + pied
}

const req = (method, { id, secret, body, ip } = {}) => {
  const url = `https://shibumap.com/.netlify/functions/race${id ? `?id=${id}` : ''}`
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (secret) headers['x-shibumap-secret'] = secret
  if (ip) headers['x-nf-client-connection-ip'] = ip
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function publier(store, body = { gpx: GPX, raceName: 'Trail des Aravis' }) {
  const res = await handleRace(req('POST', { body }), store)
  assert.equal(res.status, 201, 'la publication doit réussir')
  return await res.json()
}

// Met le seau de LECTURE d'une IP à découvert sans avoir à servir un gigaoctet
// pour de vrai. On passe par cleSeauLecture plutôt que par une clé écrite en
// dur : si le format de clé change, ce test doit suivre, pas mentir.
//
// À découvert PROFOND, et c'est volontaire : le seau se remplit en continu, et
// à ce débit une milliseconde rend déjà ~1,8 ko. Un solde tout juste à zéro
// redevient donc positif immédiatement — c'est le comportement voulu (le frein
// est un DÉBIT, pas un mur), mais cela veut dire qu'on ne teste un refus qu'en
// partant d'un vrai découvert.
const mettreADecouvert = (store, ip) =>
  store.setJSON(cleSeauLecture(ip), { tokens: -LECTURE_CAP_OCTETS, at: Date.now() })

// ---- le trou lui-même ------------------------------------------------------

test('une lecture est désormais comptée, pas seulement une écriture', async () => {
  const store = fakeStore()
  const ip = '203.0.113.7'
  const j = await publier(store)

  await handleRace(req('GET', { id: j.id, ip }), store)
  const seau = store.raw(cleSeauLecture(ip))
  assert.ok(seau, 'un seau de lecture doit exister pour cette IP')
  assert.ok(seau.tokens < LECTURE_CAP_OCTETS, 'la lecture doit avoir débité quelque chose')
})

test('une IP à découvert reçoit un 429, plus le payload', async () => {
  const store = fakeStore()
  const ip = '203.0.113.8'
  const j = await publier(store)
  await mettreADecouvert(store, ip)

  const res = await handleRace(req('GET', { id: j.id, ip }), store)
  assert.equal(res.status, 429)
  const out = await res.json()
  assert.equal(out.payload, undefined, 'aucun octet de course ne sort d’un refus')
  assert.match(out.error, /lectures/i)
})

test('le refus dit quand réessayer, et le délai reste tenable', async () => {
  const store = fakeStore()
  const ip = '203.0.113.9'
  const j = await publier(store)
  await mettreADecouvert(store, ip)

  const res = await handleRace(req('GET', { id: j.id, ip }), store)
  const retry = res.headers.get('retry-after')
  assert.match(retry || '', /^\d+$/, 'Retry-After est un entier de secondes')
  const s = Number(retry)
  assert.ok(s >= 1 && s <= LECTURE_FENETRE_MS / 1000, `délai hors bornes : ${s}`)
  // lisible depuis une autre origine, sinon l'en-tête ne sert à rien au client
  assert.match(res.headers.get('access-control-expose-headers') || '', /retry-after/i)
})

test('un refus n’est jamais mis en cache — il vaut pour une IP, pas pour tout le monde', async () => {
  const store = fakeStore()
  const ip = '203.0.113.10'
  const j = await publier(store)
  await mettreADecouvert(store, ip)
  const res = await handleRace(req('GET', { id: j.id, ip }), store)
  assert.match(res.headers.get('cache-control') || '', /no-store/)
})

test('un refus ne va même pas chercher le blob', async () => {
  const store = fakeStore()
  const ip = '203.0.113.11'
  const j = await publier(store)
  await mettreADecouvert(store, ip)

  const avant = store.compte.get
  await handleRace(req('GET', { id: j.id, ip }), store)
  // exactement une lecture : le seau. Jamais la course, qui peut peser 4 Mo.
  assert.equal(store.compte.get - avant, 1)
})

test('le refus garde le type de contenu inerte', async () => {
  const store = fakeStore()
  const ip = '203.0.113.12'
  const j = await publier(store)
  await mettreADecouvert(store, ip)
  const res = await handleRace(req('GET', { id: j.id, ip }), store)
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
})

// ---- CONTRAINTE N°1 : un partage légitime ne doit JAMAIS être refusé --------

test('300 coureurs derrière la même IP lisent tous la course sans être refusés', async () => {
  const store = fakeStore()
  const ip = '198.51.100.4' // une seule IP publique : club, entreprise, NAT d’opérateur
  const j = await publier(store, { gpx: gpxDeTaille(300_000), raceName: 'Trail des Aravis' })

  for (let i = 0; i < 300; i++) {
    const res = await handleRace(req('GET', { id: j.id, ip }), store)
    assert.equal(res.status, 200, `le coureur n°${i + 1} a été refusé`)
  }
  // et il reste de la marge : le plafond n’est pas juste « atteint de justesse »
  const reste = store.raw(cleSeauLecture(ip)).tokens
  assert.ok(reste > LECTURE_CAP_OCTETS * 0.8, `marge trop mince : ${(reste / 1024 / 1024) | 0} Mio restants`)
})

// Garde-fou exécutable sur le CHIFFRE lui-même : si quelqu’un rabote le
// plafond un jour, ce test doit tomber avant que des coureurs ne le fassent.
test('le plafond couvre un départ de masse, même cache contourné', async () => {
  const COURSE_TYPIQUE = 300 * 1024 // trace décimée à MAX_POINTS, sans logo
  const COURSE_LOURDE = 2.5 * 1024 * 1024 // gros logo d’organisateur + trace
  assert.ok(
    LECTURE_CAP_OCTETS / COURSE_TYPIQUE >= 3000,
    'moins de 3 000 lectures d’une course typique par IP et par fenêtre : trop peu pour un départ groupé',
  )
  assert.ok(
    LECTURE_CAP_OCTETS / COURSE_LOURDE >= 400,
    'moins de 400 lectures d’une course lourde par IP : un wifi d’événement pourrait le toucher',
  )
})

test('deux adresses différentes ont deux budgets différents', async () => {
  const store = fakeStore()
  const j = await publier(store)
  await mettreADecouvert(store, '203.0.113.13')

  assert.equal((await handleRace(req('GET', { id: j.id, ip: '203.0.113.13' }), store)).status, 429)
  assert.equal((await handleRace(req('GET', { id: j.id, ip: '203.0.113.14' }), store)).status, 200,
    'le voisin n’a rien fait de mal')
})

test('sans IP lisible, on sert — on ne refuse jamais un vrai visiteur par défaut', async () => {
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('GET', { id: j.id }), store)
  assert.equal(res.status, 200)
})

test('un magasin qui tombe laisse passer la lecture au lieu de fermer le site', async () => {
  const base = fakeStore()
  const j = await publier(base)
  const fache = {
    async get(key) {
      if (key.startsWith('rlq_')) throw new Error('blobs down')
      return base.get(key)
    },
    async setJSON(key, v) {
      if (key.startsWith('rlq_')) throw new Error('blobs down')
      return base.setJSON(key, v)
    },
  }
  const res = await handleRace(req('GET', { id: j.id, ip: '203.0.113.15' }), fache)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).payload.gpx, GPX)
})

// ---- lecture et écriture ne se marchent pas dessus -------------------------

test('lire beaucoup n’empêche pas l’organisateur de corriger sa course', async () => {
  const store = fakeStore()
  const ip = '198.51.100.9'
  const j = await publier(store)
  await mettreADecouvert(store, ip) // budget de LECTURE à sec

  const res = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX, raceName: 'corrigée' }, ip }), store)
  assert.equal(res.status, 200, 'le seau de lecture ne doit pas fermer la porte de l’écriture')
})

test('un organisateur qui a épuisé ses 12 publications peut toujours lire', async () => {
  const store = fakeStore()
  const ip = '198.51.100.10'
  const j = await publier(store)
  let dernier = null
  for (let i = 0; i < 13; i++) {
    dernier = await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX }, ip }), store)
  }
  assert.equal(dernier.status, 429, 'le frein d’écriture existe toujours')
  assert.equal((await handleRace(req('GET', { id: j.id, ip }), store)).status, 200,
    'et il ne doit pas priver de lecture')
})

test('les deux seaux vivent sous des clés distinctes', async () => {
  const store = fakeStore()
  const ip = '198.51.100.11'
  const j = await publier(store)
  await handleRace(req('GET', { id: j.id, ip }), store)
  await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX }, ip }), store)

  const cles = store.keys().filter((k) => k.includes(ip))
  assert.equal(cles.length, 2, `un seau par sens, or : ${cles.join(', ')}`)
  assert.ok(cles.includes(cleSeauLecture(ip)))
  // et aucune clé de seau ne peut se faire passer pour un identifiant de course
  for (const k of cles) assert.ok(!/^[A-Za-z0-9]{6,16}$/.test(k), `clé ambiguë : ${k}`)
})

// ---- ce sont bien des OCTETS, pas des requêtes ------------------------------

test('une grosse course creuse le budget bien plus vite qu’une petite', async () => {
  const store = fakeStore()
  const petite = await publier(store, { gpx: GPX, raceName: 'carte nue' })
  const grosse = await publier(store, { gpx: gpxDeTaille(1_000_000), raceName: 'course lourde' })

  await handleRace(req('GET', { id: petite.id, ip: '198.51.100.20' }), store)
  await handleRace(req('GET', { id: grosse.id, ip: '198.51.100.21' }), store)

  const coutPetite = LECTURE_CAP_OCTETS - store.raw(cleSeauLecture('198.51.100.20')).tokens
  const coutGrosse = LECTURE_CAP_OCTETS - store.raw(cleSeauLecture('198.51.100.21')).tokens
  assert.ok(coutGrosse > coutPetite * 100, `${coutGrosse} vs ${coutPetite} : le coût doit suivre la taille`)
  assert.ok(coutGrosse >= 1_000_000, 'une réponse d’un mégaoctet doit débiter au moins un mégaoctet')
})

test('le débit compte les octets rendus, pas les caractères', async () => {
  const store = fakeStore()
  const ip = '198.51.100.22'
  // un nom en caractères non-ASCII pèse plus d'un octet par caractère
  const j = await publier(store, { gpx: GPX, raceName: 'Ǆ'.repeat(100) })
  const res = await handleRace(req('GET', { id: j.id, ip }), store)
  const corps = await res.text()
  const cout = LECTURE_CAP_OCTETS - store.raw(cleSeauLecture(ip)).tokens
  assert.equal(cout, Buffer.byteLength(corps, 'utf8'))
  assert.ok(cout > corps.length, 'les octets UTF-8 dépassent le compte de caractères ici')
})

// ---- le découvert : refuser après, jamais avant -----------------------------

test('une requête qui avait encore du crédit est servie, même si elle le dépasse', async () => {
  const store = fakeStore()
  const ip = '198.51.100.30'
  const j = await publier(store, { gpx: gpxDeTaille(500_000) })
  // un seul octet de crédit : la requête passe quand même, c'est la suivante
  // qui paie. On ne coupe pas un coureur au milieu de rien.
  await store.setJSON(cleSeauLecture(ip), { tokens: 1, at: Date.now() })

  assert.equal((await handleRace(req('GET', { id: j.id, ip }), store)).status, 200)
  assert.ok(store.raw(cleSeauLecture(ip)).tokens < 0, 'le solde peut passer sous zéro')
  assert.equal((await handleRace(req('GET', { id: j.id, ip }), store)).status, 429)
})

// ---- le seau se remplit tout seul ------------------------------------------
// handleRace lit l'horloge lui-même ; le rechargement se vérifie donc sur la
// fonction pure, avec le plafond et la fenêtre de la LECTURE.

test('le budget de lecture se recharge en entier sur la fenêtre', () => {
  const t0 = 1_800_000_000_000
  const vide = { tokens: 0, at: t0 }
  assert.equal(refillBucket(vide, t0 + LECTURE_FENETRE_MS, LECTURE_CAP_OCTETS, LECTURE_FENETRE_MS).tokens, LECTURE_CAP_OCTETS)
  // continu, pas par à-coups : la moitié du temps rend la moitié du budget
  const moitie = refillBucket(vide, t0 + LECTURE_FENETRE_MS / 2, LECTURE_CAP_OCTETS, LECTURE_FENETRE_MS)
  assert.ok(Math.abs(moitie.tokens - LECTURE_CAP_OCTETS / 2) < 1024)
  // et jamais au-dessus du plafond, même après des heures
  assert.equal(refillBucket(vide, t0 + 86_400_000, LECTURE_CAP_OCTETS, LECTURE_FENETRE_MS).tokens, LECTURE_CAP_OCTETS)
})

test('un découvert profond ne renvoie pas une éternité à attendre', () => {
  assert.equal(delaiRecharge(0), 1, 'à sec tout juste : une seconde suffit')
  assert.equal(delaiRecharge(-LECTURE_CAP_OCTETS * 10), LECTURE_FENETRE_MS / 1000,
    'borné à la fenêtre, au bout de laquelle le seau est plein de toute façon')
  const moitie = delaiRecharge(-LECTURE_CAP_OCTETS / 2)
  assert.ok(moitie >= 295 && moitie <= 305, `délai incohérent : ${moitie}`)
  assert.equal(delaiRecharge(undefined), 1, 'une valeur absurde ne rend jamais NaN')
})

// ---- le cache, qui rend la répétition gratuite pour nous --------------------

test('une lecture servie porte des en-têtes de cache partagé', async () => {
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('GET', { id: j.id, ip: '198.51.100.40' }), store)
  assert.equal(res.status, 200)
  const cc = res.headers.get('cache-control') || ''
  const cdn = res.headers.get('netlify-cdn-cache-control') || ''
  assert.match(cc, /public/)
  assert.match(cdn, /s-maxage=\d+/)
})

// UNE COURSE CORRIGÉE PAR PUT DOIT ATTEINDRE CEUX QUI ONT DÉJÀ LE LIEN — c'est
// la raison d'être du jeton d'édition. Un cache long le reproduirait côté
// réseau : on borne donc la durée partagée, et le navigateur, lui, revalide.
test('le cache reste assez court pour qu’une correction par PUT se voie vite', async () => {
  const store = fakeStore()
  const j = await publier(store)
  const res = await handleRace(req('GET', { id: j.id, ip: '198.51.100.41' }), store)
  const s = Number((res.headers.get('netlify-cdn-cache-control') || '').match(/s-maxage=(\d+)/)?.[1] ?? Infinity)
  assert.ok(s > 0 && s <= 60, `cache partagé trop long (${s}s) : une correction resterait invisible`)
  assert.match(res.headers.get('cache-control') || '', /max-age=0/,
    'le navigateur doit repartir chercher la version fraîche à chaque rechargement')
})

test('le contenu servi est toujours celui du blob, cache ou pas', async () => {
  const store = fakeStore()
  const j = await publier(store)
  await handleRace(req('PUT', { id: j.id, secret: j.secret, body: { gpx: GPX, raceName: 'parcours modifié' } }), store)
  const res = await handleRace(req('GET', { id: j.id, ip: '198.51.100.42' }), store)
  const out = await res.json()
  assert.equal(out.payload.raceName, 'parcours modifié')
  assert.equal(out.payload.secretHash, undefined, 'le condensat ne sort toujours pas')
})

// ---- rien d’autre n’a bougé -------------------------------------------------

test('un id malformé est toujours refusé avant tout accès au magasin', async () => {
  const store = fakeStore()
  const avant = store.compte.get
  const res = await handleRace(req('GET', { id: 'nope!!', ip: '198.51.100.50' }), store)
  assert.equal(res.status, 400)
  assert.equal(store.compte.get, avant, 'ni seau ni blob pour une requête qui ne veut rien dire')
})

test('un id inconnu reste un 404', async () => {
  const store = fakeStore()
  const res = await handleRace(req('GET', { id: 'abcdefghij', ip: '198.51.100.51' }), store)
  assert.equal(res.status, 404)
})
