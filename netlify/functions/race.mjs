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
// which is the real abuse surface (see the task report for the tradeoffs
// this leaves open — no rate limiting is implemented yet). What IS enforced,
// on every request, no exceptions:
//   - hard size ceilings on every field (checked on the DECODED string
//     length, not a trustable client-sent header)
//   - the GPX text must look like GPX (bounded regex scan below — the
//     Functions runtime has no DOMParser, so this can't reuse gpx.js's real
//     parser; see looksLikeGpx())
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
const MAX_STATE_CHARS = 60_000 // a real #s= diff is normally well under 2 KB; generous ceiling
const MAX_BODY_CHARS = MAX_GPX_CHARS + MAX_LOGO_DATA_URL_CHARS + MAX_STATE_CHARS + 4_096

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

  if (!looksLikeGpx(body.gpx)) return jsonResponse({ error: 'invalid gpx' }, 422)
  const gpx = body.gpx

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

  const id = makeId()
  const payload = { gpx, logo, state, createdAt: new Date().toISOString() }
  try {
    await store.setJSON(id, payload)
  } catch (err) {
    console.error('race POST blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502)
  }

  return jsonResponse({ ok: true, id }, 201)
}
