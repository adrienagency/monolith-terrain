// Netlify Function backing the `#r=<id>` share-link form (see
// src/share-link.js's header comment for the two-link-form design).
//
//   POST /.netlify/functions/race   { gpx, logo?, state? }  -> { ok, id }
//   GET  /.netlify/functions/race?id=<id>                   -> { ok, payload }
//
// This is the ONLY way a GPX track (even decimated — see gpx.js's
// MAX_POINTS) makes it into a share link: it's tens to hundreds of KB, far
// past any URL budget, so it lives in Netlify Blobs instead and the link
// carries a short id.
//
// PUBLIC AND UNAUTHENTICATED BY DESIGN — the product is "paste a link", so
// there's no account to gate writes behind. That means anyone can POST here,
// which is the real abuse surface. What IS enforced, on every request, no
// exceptions:
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

import { randomBytes } from 'node:crypto'
import { getStore } from '@netlify/blobs'

const MAX_GPX_CHARS = 2_000_000 // ~2 MB text — real headroom over an already-decimated track
const MAX_LOGO_DATA_URL_CHARS = 2_000_000 // base64 data URL, ~1.5 MB decoded image
const MAX_RACE_NAME_CHARS = 200 // share.mjs bounds it again to 120 for the title; this is the storage door
const MAX_STATE_CHARS = 60_000 // a real #s= diff is normally well under 2 KB; generous ceiling
const MAX_RACE_CHARS = 200_000 // waypoints/transports JSON (logo travels in its OWN field, never here)
const MAX_BODY_CHARS = MAX_GPX_CHARS + MAX_LOGO_DATA_URL_CHARS + MAX_STATE_CHARS + MAX_RACE_CHARS + 4_096

const ID_LEN = 10
// no 0/O/1/l/I — avoids ids that are ambiguous when read aloud or hand-typed
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_RE = /^[A-Za-z0-9]{6,16}$/

function makeId() {
  const bytes = randomBytes(ID_LEN)
  let out = ''
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length]
  return out
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

export default async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true }, 204)

  const url = new URL(req.url)
  const store = getStore({ name: 'race-payloads', consistency: 'strong' })

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
    return jsonResponse({ ok: true, payload }, 200)
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)

  // AVANT de lire le corps : inutile d'ingérer 4 Mo pour les jeter ensuite
  if (!(await takeToken(store, clientIp(req.headers)))) {
    return jsonResponse({ error: 'trop de publications, réessayez dans quelques minutes' }, 429)
  }

  let raw
  try {
    raw = await req.text()
  } catch {
    return jsonResponse({ error: 'unreadable body' }, 400)
  }
  if (!raw || raw.length > MAX_BODY_CHARS) return jsonResponse({ error: 'payload too large' }, 413)

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse({ error: 'bad json' }, 400)
  }
  if (!body || typeof body !== 'object') return jsonResponse({ error: 'bad payload' }, 400)

  // La trace est FACULTATIVE : une carte sans course se partage aussi. Quand
  // elle est là, elle doit être valide — un GPX présent mais illisible reste
  // une erreur, on ne le laisse pas silencieusement tomber.
  let gpx = null
  if (body.gpx != null) {
    if (!looksLikeGpx(body.gpx)) return jsonResponse({ error: 'invalid gpx' }, 422)
    gpx = body.gpx
  }

  let logo = null
  if (body.logo != null) {
    const dataUrl = typeof body.logo === 'string' ? body.logo : body.logo?.dataUrl
    if (!isValidLogoDataUrl(dataUrl)) return jsonResponse({ error: 'invalid logo' }, 422)
    logo = { dataUrl }
  }

  let state = null
  if (body.state != null) {
    if (typeof body.state !== 'object') return jsonResponse({ error: 'invalid state' }, 422)
    if (JSON.stringify(body.state).length > MAX_STATE_CHARS) return jsonResponse({ error: 'state too large' }, 422)
    state = body.state
  }

  // La COURSE complète (points de passage, transports) — sans elle une shibu
  // reçue n'a aucun cartouche, « le parcours ne s'affiche pas » (Adrien).
  // Libre-forme comme `state` : le CLIENT receveur re-valide tout
  // (share-link.js parseRacePayload), ici on ne garde que le plafond.
  let race = null
  if (body.race != null) {
    if (typeof body.race !== 'object') return jsonResponse({ error: 'invalid race' }, 422)
    if (JSON.stringify(body.race).length > MAX_RACE_CHARS) return jsonResponse({ error: 'race too large' }, 422)
    race = body.race
  }

  // The race name is stored as its OWN field rather than left inside the
  // free-form `state`, because it is the one value that later gets rendered
  // into HTML for link previews (netlify/functions/share.mjs). A field that
  // leaves the JSON envelope deserves its own explicit ceiling here, at the
  // door, instead of being validated only where it happens to be used.
  let raceName = ''
  if (body.raceName != null) {
    if (typeof body.raceName !== 'string') return jsonResponse({ error: 'invalid race name' }, 422)
    if (body.raceName.length > MAX_RACE_NAME_CHARS) return jsonResponse({ error: 'race name too long' }, 422)
    raceName = body.raceName
  }

  const id = makeId()
  const payload = { gpx, logo, state, race, raceName, createdAt: new Date().toISOString() }
  try {
    await store.setJSON(id, payload)
  } catch (err) {
    console.error('race POST blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502)
  }

  return jsonResponse({ ok: true, id }, 201)
}
