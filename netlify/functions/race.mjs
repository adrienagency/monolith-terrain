// Netlify Function backing the `#r=<id>` share-link form (see
// src/share-link.js's header comment for the two-link-form design).
//
//   POST /.netlify/functions/race   { gpx, logo?, state? }  -> { ok, id, secret }
//   PUT  /.netlify/functions/race?id=<id>  + x-shibumap-secret -> { ok, id }
//   GET  /.netlify/functions/race?id=<id>                   -> { ok, payload }
//
// This is the ONLY way a GPX track (even decimated — see gpx.js's
// MAX_POINTS) makes it into a share link: it's tens to hundreds of KB, far
// past any URL budget, so it lives in Netlify Blobs instead and the link
// carries a short id.
//
// PUBLIC AND UNAUTHENTICATED BY DESIGN — the product is "paste a link", so
// there's no account to gate writes behind. That means anyone can POST here,
// which is the real abuse surface.
//
// A PUBLISHED COURSE MUST STAY EDITABLE, still without accounts. Republishing
// used to mint a second id, so an organiser who had already sent
// shibumap.com/#r=<id> to their entrants and then fixed the route ended up
// with two links — everyone holding the first one kept seeing the old
// version. Trail courses move: the project's own reference GPX carries
// `<desc>Due to Path Damage Beatenberg</desc>`. Hence the EDIT SECRET:
// POST mints one and hands it back ONCE, PUT demands it, and the id — the
// thing already in other people's hands — never changes.
//   - the secret is a longer sibling of the id (same CSPRNG, same
//     unambiguous alphabet), and is stored ONLY as a sha256. The blob never
//     holds the plaintext, so a leaked dump doesn't hand out write access.
//   - it travels in the `x-shibumap-secret` HEADER, never the URL: query
//     strings land in access logs, proxy logs and Referer headers.
//   - the comparison is timingSafeEqual over the two digests, so the endpoint
//     is not an oracle that leaks the secret one character at a time.
//   - the public GET STRIPS that hash before answering. This endpoint's whole
//     job is handing a stored payload to strangers; it must never hand out
//     the means to rewrite it.
//   - PUT goes through EXACTLY the same door as POST (takeToken, every size
//     ceiling, looksLikeGpx, the logo allowlist) — see readWriteBody below,
//     which is the single implementation both methods call. A field that
//     cannot come in through POST must not come in through the service
//     entrance.
//
// What IS enforced, on every write, no exceptions:
//   - a PER-IP RATE LIMIT (see takeToken below). It became necessary the day
//     a plain map — no GPX — became publishable too: until then only someone
//     who had loaded a real track could write here, which was a de facto
//     brake. Now any visitor can, so the brake has to be explicit.
//   - hard size ceilings on every field (checked on the DECODED string
//     length, not a trustable client-sent header)
//   - the GPX text, WHEN PRESENT, must look like GPX (bounded regex scan
//     below — the Functions runtime has no DOMParser, so this can't reuse
//     gpx.js's real parser; see looksLikeGpx()). It is optional: a map
//     without a course is a legitimate thing to share, and refusing it was
//     what forced those shares onto a 3 000-character #s= URL that messaging
//     apps mangle and crawlers never see.
//   - a logo, if present, must be a data: URL with an image mime type on the
//     allowlist
//   - every response is forced text/plain + nosniff, JSON-wrapped — this
//     endpoint's whole job is handing back attacker-controllable bytes
//     (whatever someone else POSTed) to a THIRD browser that trusts
//     shibumap.com, so it must never come back as something a browser would
//     execute or render as HTML/SVG
//
// RETENTION: stored forever, no TTL. Netlify Blobs has no built-in
// expiry — see the task report for why "store indefinitely for now, revisit
// once real usage/cost data exists" was chosen over inventing a cleanup
// script for a product that's still "on stocke sur Netlify en premier lieu,
// on scalera plus tard".
//
// Self-contained on purpose: no imports from src/ (Netlify bundles this
// function independently; keeping it dependency-free of the app's own
// source avoids any bundling surprises). looksLikeGpx / isValidLogoDataUrl
// are exported for the test suite even though nothing else in this file
// imports them internally beyond the handler.

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'

const MAX_GPX_CHARS = 2_000_000 // ~2 MB text — real headroom over an already-decimated track
const MAX_LOGO_DATA_URL_CHARS = 2_000_000 // base64 data URL, ~1.5 MB decoded image
const MAX_RACE_NAME_CHARS = 200 // share.mjs bounds it again to 120 for the title; this is the storage door
const MAX_STATE_CHARS = 60_000 // a real #s= diff is normally well under 2 KB; generous ceiling
const MAX_RACE_CHARS = 200_000 // waypoints/transports JSON (logo travels in its OWN field, never here)
const MAX_BODY_CHARS = MAX_GPX_CHARS + MAX_LOGO_DATA_URL_CHARS + MAX_STATE_CHARS + MAX_RACE_CHARS + 4_096

const ID_LEN = 10
// L'id est PUBLIC et court : il tient dans un lien qu'on dicte. Le secret,
// lui, n'est jamais lu à voix haute — il n'a que la force brute à repousser,
// d'où trois fois la longueur (≈ 185 bits sur cet alphabet).
const SECRET_LEN = 32
// no 0/O/1/l/I — avoids ids that are ambiguous when read aloud or hand-typed
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_RE = /^[A-Za-z0-9]{6,16}$/
const SECRET_RE = /^[A-Za-z0-9]{16,128}$/
const SHA256_HEX_RE = /^[0-9a-f]{64}$/

function makeToken(len) {
  const bytes = randomBytes(len)
  let out = ''
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length]
  return out
}

const makeId = () => makeToken(ID_LEN)
const makeSecret = () => makeToken(SECRET_LEN)

const hashSecret = (secret) => createHash('sha256').update(secret, 'utf8').digest('hex')

// Le secret présenté correspond-il à celui de ce blob ? Un sha256 nu suffit
// ici — contrairement à un mot de passe, ce jeton est un aléa de 185 bits
// qu'aucune liste ne devine, donc rien à ralentir par un KDF.
//
// PAS DE PASSE-DROIT : un blob publié AVANT les jetons n'a aucun condensat,
// et un condensat absent doit fermer la porte, jamais l'ouvrir.
function secretMatches(sent, storedHash) {
  if (typeof storedHash !== 'string' || !SHA256_HEX_RE.test(storedHash)) return false
  if (typeof sent !== 'string' || !SECRET_RE.test(sent)) return false
  // deux condensats : toujours 32 octets de part et d'autre, donc
  // timingSafeEqual ne peut pas lever sur des longueurs différentes — et la
  // comparaison ne devient jamais un oracle caractère par caractère
  return timingSafeEqual(Buffer.from(hashSecret(sent), 'hex'), Buffer.from(storedHash, 'hex'))
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      // NEVER text/html, NEVER an image/* content-type on the way back out —
      // the body can be a stranger's GPX/logo bytes; force it inert.
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
    },
  })
}

// Préalable CORS. UNE 204 NE PORTE PAS DE CORPS : lui en donner un fait lever
// le constructeur Response, et c'est très exactement ce que la production
// rendait — 502 « Invalid response status code 204 » sur chaque OPTIONS.
// Personne ne l'avait vu parce que l'app appelle cet endpoint sur sa propre
// origine, et qu'une requête de même origine ne déclenche jamais de préalable.
// Le PUT ajoute un en-tête sur mesure, qui doit être annoncé ici sans quoi un
// appel depuis une autre origine serait refusé par le navigateur.
function preflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': 'content-type, x-shibumap-secret',
      'access-control-max-age': '86400',
      'x-content-type-options': 'nosniff',
    },
  })
}

// Minimal, dependency-free GPX sanity check — a bounded regex scan, not a
// real XML parser (see the file header: no DOMParser here). Goal is only to
// reject "not GPX at all", not to validate schema. `text` is already
// length-capped by the caller before this runs, so the bounded quantifiers
// below are just belt-and-suspenders against a pathological match, not the
// only guard against ReDoS-scale input.
export function looksLikeGpx(text) {
  if (typeof text !== 'string' || text.length < 40 || text.length > MAX_GPX_CHARS) return false
  if (!/<gpx[\s>]/i.test(text.slice(0, 4000))) return false
  const pts = text.match(/<(?:trkpt|rtept|wpt)\b[^>]{0,300}?\blat="-?\d{1,3}(?:\.\d+)?"[^>]{0,300}?\blon="-?\d{1,3}(?:\.\d+)?"/gi)
  return !!pts && pts.length >= 2
}

const LOGO_DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/

export function isValidLogoDataUrl(dataUrl) {
  return typeof dataUrl === 'string' && dataUrl.length > 0 && dataUrl.length <= MAX_LOGO_DATA_URL_CHARS && LOGO_DATA_URL_RE.test(dataUrl)
}

// ---- limitation de débit par IP -------------------------------------------
// Seau à jetons dans Blobs. Volontairement grossier : deux requêtes vraiment
// simultanées de la MÊME adresse peuvent lire le même seau et passer toutes
// les deux (lecture-modification-écriture non atomique). C'est acceptable —
// on cherche à arrêter un script qui écrit en boucle, pas à compter juste. Un
// vrai verrou coûterait un service de plus pour un produit qui n'a pas encore
// un seul client payant.
const RATE_CAP = 12 // publications d'affilée
const RATE_WINDOW_MS = 10 * 60 * 1000 // le seau se remplit entièrement en 10 min

export function refillBucket(bucket, now, cap = RATE_CAP, windowMs = RATE_WINDOW_MS) {
  const tokens = Number.isFinite(bucket?.tokens) ? bucket.tokens : cap
  const at = Number.isFinite(bucket?.at) ? bucket.at : now
  // remplissage continu : pas de bord de fenêtre où tout se réarme d'un coup
  const gained = Math.max(0, now - at) * (cap / windowMs)
  return { tokens: Math.min(cap, tokens + gained), at: now }
}

async function takeToken(store, ip, now = Date.now()) {
  if (!ip) return true // pas d'IP lisible : on ne bloque pas un vrai visiteur
  const key = `rl_${ip.replace(/[^a-zA-Z0-9:._-]/g, '')}`.slice(0, 96)
  let bucket = null
  try {
    bucket = await store.get(key, { type: 'json' })
  } catch {
    return true // le magasin est en panne : on laisse passer plutôt que de fermer le site
  }
  const next = refillBucket(bucket, now)
  if (next.tokens < 1) return false
  next.tokens -= 1
  try {
    await store.setJSON(key, next)
  } catch {}
  return true
}

// Netlify place l'IP du client dans x-nf-client-connection-ip ; x-forwarded-for
// est un repli et sa PREMIÈRE entrée est celle du client.
export function clientIp(headers) {
  const direct = headers.get('x-nf-client-connection-ip')
  if (direct) return direct.trim()
  const fwd = headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : ''
}

// ---- la porte commune au POST et au PUT ------------------------------------
// Lecture du corps, plafonds mesurés sur la CHAÎNE DÉCODÉE (jamais un
// content-length que le client choisit), validations. UNE seule
// implémentation, appelée par les deux méthodes : une écriture qui entrerait
// par le PUT sans repasser par ici serait exactement le trou que ces
// contrôles existent pour fermer.
//
// Rend { fields } ou { error: Response } — la réponse est déjà construite
// pour que l'appelant n'ait qu'à la renvoyer, en-têtes inertes compris.
async function readWriteBody(req) {
  let raw
  try {
    raw = await req.text()
  } catch {
    return { error: jsonResponse({ error: 'unreadable body' }, 400) }
  }
  if (!raw || raw.length > MAX_BODY_CHARS) return { error: jsonResponse({ error: 'payload too large' }, 413) }

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return { error: jsonResponse({ error: 'bad json' }, 400) }
  }
  if (!body || typeof body !== 'object') return { error: jsonResponse({ error: 'bad payload' }, 400) }

  // La trace est FACULTATIVE : une carte sans course se partage aussi. Quand
  // elle est là, elle doit être valide — un GPX présent mais illisible reste
  // une erreur, on ne le laisse pas silencieusement tomber.
  let gpx = null
  if (body.gpx != null) {
    if (!looksLikeGpx(body.gpx)) return { error: jsonResponse({ error: 'invalid gpx' }, 422) }
    gpx = body.gpx
  }

  let logo = null
  if (body.logo != null) {
    const dataUrl = typeof body.logo === 'string' ? body.logo : body.logo?.dataUrl
    if (!isValidLogoDataUrl(dataUrl)) return { error: jsonResponse({ error: 'invalid logo' }, 422) }
    logo = { dataUrl }
  }

  let state = null
  if (body.state != null) {
    if (typeof body.state !== 'object') return { error: jsonResponse({ error: 'invalid state' }, 422) }
    if (JSON.stringify(body.state).length > MAX_STATE_CHARS) return { error: jsonResponse({ error: 'state too large' }, 422) }
    state = body.state
  }

  // La COURSE complète (points de passage, transports) — sans elle une shibu
  // reçue n'a aucun cartouche, « le parcours ne s'affiche pas » (Adrien).
  // Libre-forme comme `state` : le CLIENT receveur re-valide tout
  // (share-link.js parseRacePayload), ici on ne garde que le plafond.
  let race = null
  if (body.race != null) {
    if (typeof body.race !== 'object') return { error: jsonResponse({ error: 'invalid race' }, 422) }
    if (JSON.stringify(body.race).length > MAX_RACE_CHARS) return { error: jsonResponse({ error: 'race too large' }, 422) }
    race = body.race
  }

  // The race name is stored as its OWN field rather than left inside the
  // free-form `state`, because it is the one value that later gets rendered
  // into HTML for link previews (netlify/functions/share.mjs). A field that
  // leaves the JSON envelope deserves its own explicit ceiling here, at the
  // door, instead of being validated only where it happens to be used.
  let raceName = ''
  if (body.raceName != null) {
    if (typeof body.raceName !== 'string') return { error: jsonResponse({ error: 'invalid race name' }, 422) }
    if (body.raceName.length > MAX_RACE_NAME_CHARS) return { error: jsonResponse({ error: 'race name too long' }, 422) }
    raceName = body.raceName
  }

  return { fields: { gpx, logo, state, race, raceName } }
}

// En-tête, pas paramètre d'URL : une chaîne de requête finit dans les
// journaux d'accès, ceux des relais, et dans le Referer de la page suivante.
const SECRET_HEADER = 'x-shibumap-secret'

// Le magasin est injecté plutôt que construit ici — la fonction Netlify le
// fournit juste en dessous, les tests un équivalent en mémoire. C'est ce qui
// rend le chemin d'écriture entier (jeton compris) vérifiable sans réseau.
export async function handleRace(req, store) {
  if (req.method === 'OPTIONS') return preflightResponse()

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id)) return jsonResponse({ error: 'bad id' }, 400)
    let payload
    try {
      payload = await store.get(id, { type: 'json' })
    } catch (err) {
      console.error('race GET blobs error:', err)
      return jsonResponse({ error: 'storage unavailable' }, 502)
    }
    if (!payload) return jsonResponse({ error: 'not found' }, 404)
    // LE CONDENSAT NE SORT PAS. Ce GET est public et sert précisément à
    // donner le payload à des inconnus ; il ne doit jamais leur donner en
    // plus de quoi le réécrire.
    const { secretHash, ...publicPayload } = payload
    return jsonResponse({ ok: true, payload: publicPayload }, 200)
  }

  if (req.method !== 'POST' && req.method !== 'PUT') return jsonResponse({ error: 'method not allowed' }, 405)

  // AVANT de lire le corps : inutile d'ingérer 4 Mo pour les jeter ensuite
  if (!(await takeToken(store, clientIp(req.headers)))) {
    return jsonResponse({ error: 'trop de publications, réessayez dans quelques minutes' }, 429)
  }

  // Une correction : même id, donc même lien chez tous ceux qui l'ont déjà.
  // Le jeton se vérifie AVANT de lire le corps — inutile d'ingérer des
  // mégaoctets pour quelqu'un qui n'a pas le droit de les écrire.
  if (req.method === 'PUT') {
    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id)) return jsonResponse({ error: 'bad id' }, 400)

    let existing
    try {
      existing = await store.get(id, { type: 'json' })
    } catch (err) {
      console.error('race PUT blobs error:', err)
      return jsonResponse({ error: 'storage unavailable' }, 502)
    }
    // Un PUT ne CRÉE jamais : sans cela n'importe qui choisirait son propre
    // id, et donc son propre secret, sur une course pas encore publiée.
    if (!existing) return jsonResponse({ error: 'not found' }, 404)

    if (!secretMatches(req.headers.get(SECRET_HEADER), existing.secretHash)) {
      return jsonResponse({ error: 'clé de modification invalide' }, 403)
    }

    const { error, fields } = await readWriteBody(req)
    if (error) return error

    const payload = {
      ...fields,
      // le jeton ne tourne pas : celui que l'organisateur a gardé doit encore
      // ouvrir la porte à la correction suivante
      secretHash: existing.secretHash,
      createdAt: existing.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await store.setJSON(id, payload)
    } catch (err) {
      console.error('race PUT blobs error:', err)
      return jsonResponse({ error: 'storage unavailable' }, 502)
    }
    return jsonResponse({ ok: true, id }, 200)
  }

  const { error, fields } = await readWriteBody(req)
  if (error) return error

  const id = makeId()
  // Rendu UNE FOIS, ici, et nulle part ailleurs : le blob n'en garde que le
  // condensat, donc ni ce serveur ni un vidage de la base ne peut le
  // reconstituer. Au client de le conserver (voir share-link.js).
  const secret = makeSecret()
  const now = new Date().toISOString()
  const payload = { ...fields, secretHash: hashSecret(secret), createdAt: now, updatedAt: now }
  try {
    await store.setJSON(id, payload)
  } catch (err) {
    console.error('race POST blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502)
  }

  return jsonResponse({ ok: true, id, secret }, 201)
}

export default async (req) => handleRace(req, getStore({ name: 'race-payloads', consistency: 'strong' }))
