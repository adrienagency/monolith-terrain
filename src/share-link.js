// Share link — pack the current look + location + camera pose into a short,
// URL-safe fragment so pasting the link reproduces the same view elsewhere.
//
// Two link forms now exist:
//  - `#s=<diff>` — the original, zero-network, fully-inline fragment below.
//    Used whenever no GPX track is loaded: nothing to publish, nothing that
//    can ever 404 later.
//  - `#r=<id>` — used when a track IS loaded. A track (even decimated, see
//    gpx.js's MAX_POINTS) is tens to hundreds of KB and simply cannot fit in
//    a URL, so the payload (GPX text + this same diffed state, see
//    captureShareState below) is POSTed to Netlify Blobs instead (see
//    netlify/functions/race.mjs) and the link carries only the short id.
//    parseRacePayload() below is the untrusted-input gate for whatever comes
//    back from that fetch — same rigour as parseShareState, since anyone can
//    POST to that endpoint.
//
// No compression library for the `#s=` path. That payload is a DIFF against
// the app's own hard-coded defaults (BASE_TEMPLATE_LOOK, captured once at
// boot in main.js before anything mutates params) — only keys the user
// actually changed travel at all, which keeps most real links short without
// needing a real compressor. This also keeps encode/decode fully
// SYNCHRONOUS (plain JSON + base64url, no Streams API): main.js has to apply
// a restored `#s=` state before anything else reads `params`, well before
// any await could resolve, so an async decode was never an option there. The
// `#r=` path is unavoidably async (it's a network fetch) — main.js defers
// applying it until well after boot, see its "race-link restore" section.
//
// Pure/DOM-free (besides TextEncoder/TextDecoder/btoa/atob, available in
// both the browser and Node's test runner) — same contract as
// templates-user.js: capture, (de)serialize, validate. DOM wiring (the Share
// button, camera-pose capture, the publishing POST itself) lives in main.js.
//
// ONE exception, at the bottom of this file: updateRace() and the two
// helpers that keep its edit secret. They live here, next to RACE_ENDPOINT
// and the ceilings they must agree with, rather than being spelled out again
// inside main.js's UI code — the endpoint's contract belongs in one place.
// Both take their `fetch` and their `localStorage` as arguments (defaulting
// to the globals), so this file stays testable in Node with neither.

import { TEMPLATE_KEYS, captureLook } from './templates-user.js'
import { parseRace, LOGO_DATA_URL_RE } from './race-model.js'
import { COURSE_ELASTIQUE } from './fenetre-course.js'

const FORMAT = 'shibumap-share'
const VERSION = 1

// ══════════ LA POSITION DANS L'EMPRISE, ET POURQUOI LA VERSION NE BOUGE PAS ══
//
// En mode continu 3×3, `loc` ne dit plus où l'on regarde. Il dit quel BLOC est
// chargé ; à l'intérieur, la fenêtre se promène de ±56 unités monde, soit
// ±21 km à z12. Un lien qui ne porte que `loc` renvoie donc le destinataire au
// centre du bloc — jusqu'à 30 km à côté de ce que l'expéditeur avait à l'écran.
//
// ⚠️ ET `VERSION` RESTE À 1. C'est la contrainte non négociable de ce poste :
// `parseShareState` refuse tout payload dont `v` ne vaut pas exactement
// `VERSION`, donc passer à 2 ferait rendre `null` à TOUTES les cartes déjà
// publiées sur /r/<id> — elles s'ouvriraient sur la vue par défaut d'Annecy.
// Le décalage voyage donc comme un champ FACULTATIF : absent, il vaut (0,0),
// c'est-à-dire exactement le comportement d'avant, par construction et non par
// promesse.

// La course, relue de fenetre-course.js pour qu'un lien ne puisse jamais
// demander une position que le mode continu refuserait d'atteindre. ⚠️ Le
// débordement élastique n'est PAS admis : c'est un état transitoire de geste,
// pas un point de vue — un lien qui l'inscrirait rouvrirait sur une image que
// le rappel corrigerait sous les yeux du destinataire.
export const FEN_MAX = COURSE_ELASTIQUE

// ---------------------------------------------------------------- capture

// `fx` holds saved params for all ~14 surface effects, but only the one
// currently ACTIVE (params.surfaceFx) is visually relevant — so only that
// one travels, as {id, p}, instead of the whole per-effect store. This is
// the single biggest size win: fx alone is ~140 values.
function diffLook(look, base) {
  const out = {}
  for (const k of TEMPLATE_KEYS) {
    if (k === 'fx') continue
    if (JSON.stringify(look[k]) !== JSON.stringify(base[k])) out[k] = look[k]
  }
  const activeId = look.surfaceFx | 0
  if (activeId > 0 && look.fx && look.fx[activeId]) out.fxActive = { id: activeId, p: look.fx[activeId] }
  return out
}

function undiffLook(diff, base) {
  const look = { ...base }
  for (const k of TEMPLATE_KEYS) if (k !== 'fx' && k in diff) look[k] = diff[k]
  if (diff.fxActive && typeof diff.fxActive.id === 'number' && diff.fxActive.p) {
    look.surfaceFx = diff.fxActive.id
    look.fx = { ...base.fx, [diff.fxActive.id]: { ...(base.fx?.[diff.fxActive.id] || {}), ...diff.fxActive.p } }
  }
  return look
}

// params + a captured camera pose (see main.js's captureCameraPose) → the
// plain object that gets JSON'd and base64url'd. `base` is
// captureLook() of the app's pristine defaults, captured once at boot —
// see BASE_TEMPLATE_LOOK in main.js.
// `fenetre` : le décalage de lecture dans l'emprise 3×3 ({x,z}), ou null hors
// mode continu. ⚠️ IL N'EST ÉCRIT QUE S'IL EST NON NUL — un lien fabriqué en
// mode ordinaire, ou au centre de l'emprise, doit sortir OCTET POUR OCTET
// comme avant ce champ (test/share-link.test.js le verrouille).
export function captureShareState(params, cameraPose, base, fenetre = null) {
  const state = {
    format: FORMAT,
    v: VERSION,
    loc: { lat: params.demLat, lon: params.demLon, zoom: params.demZoom },
    cam: cameraPose, // { px,py,pz,tx,ty,tz } or null
    look: diffLook(captureLook(params), base),
  }
  if (fenetre && (isNum(fenetre.x) || isNum(fenetre.z)) && (fenetre.x || fenetre.z)) {
    state.fen = { x: fenetre.x || 0, z: fenetre.z || 0 }
  }
  return state
}

// ---------------------------------------------------------------- validate

const isNum = (n) => typeof n === 'number' && Number.isFinite(n)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/

// Re-validate a value against the SHAPE of the default for that key — same
// spirit as templates-user.js's THUMB_RE check: never trust what a URL says
// a param's type is. Returns undefined (→ keep the default) on anything that
// doesn't match.
function sanitizeLookValue(key, value, base) {
  const d = base[key]
  if (typeof d === 'number') return isNum(value) ? clamp(value, -1e4, 1e4) : undefined
  if (typeof d === 'boolean') return typeof value === 'boolean' ? value : undefined
  if (typeof d === 'string') return typeof value === 'string' && value.length <= 64 ? value : undefined
  if (Array.isArray(d)) {
    // the only array shape this app's look actually carries: rampStops [{c,p}, …]
    if (!Array.isArray(value)) return undefined
    const out = value
      .slice(0, 12)
      .filter((s) => s && typeof s.c === 'string' && HEX_RE.test(s.c) && isNum(s.p))
      .map((s) => ({ c: s.c, p: clamp(s.p, 0, 1) }))
    return out.length ? out : undefined
  }
  return undefined // objects (fx) go through sanitizeFxActive, not this generic path
}

function sanitizeFxActive(raw, base) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id | 0
  if (!(id > 0) || !base.fx || !base.fx[id]) return null
  const src = raw.p
  if (!src || typeof src !== 'object') return null
  const p = {}
  for (const [k, dv] of Object.entries(base.fx[id])) {
    const v = src[k]
    if (typeof dv === 'string') { if (typeof v === 'string' && HEX_RE.test(v)) p[k] = v }
    else if (typeof dv === 'number') { if (isNum(v)) p[k] = clamp(v, -1e4, 1e4) }
  }
  return { id, p }
}

// untrusted decoded object → { loc, cam, look } or null. `base` is the SAME
// captureLook-of-defaults the recipient's own boot computes — deterministic
// (same source code), so it always matches what the sender diffed against.
export function parseShareState(raw, base) {
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT || raw.v !== VERSION) return null

  const loc = raw.loc
  if (!loc || !isNum(loc.lat) || !isNum(loc.lon) || !isNum(loc.zoom)) return null
  const lat = clamp(loc.lat, -85, 85)
  // only wrap when actually out of range — modulo arithmetic on an
  // already-valid value introduces float drift (6.13 → 6.129999999999996)
  // for no reason, and a share link should round-trip an in-range
  // coordinate EXACTLY
  let lon = loc.lon
  if (lon < -180 || lon > 180) lon = (((lon + 180) % 360) + 360) % 360 - 180
  const zoom = Math.round(clamp(loc.zoom, 2, 18))

  let cam = null
  const c = raw.cam
  if (c && ['px', 'py', 'pz', 'tx', 'ty', 'tz'].every((k) => isNum(c[k]))) {
    const b = (n) => clamp(n, -500, 500)
    cam = { px: b(c.px), py: b(c.py), pz: b(c.pz), tx: b(c.tx), ty: b(c.ty), tz: b(c.tz) }
  }

  const diff = {}
  if (raw.look && typeof raw.look === 'object') {
    for (const k of TEMPLATE_KEYS) {
      if (k === 'fx' || !(k in raw.look)) continue
      const v = sanitizeLookValue(k, raw.look[k], base)
      if (v !== undefined) diff[k] = v
    }
    const fxActive = sanitizeFxActive(raw.look.fxActive, base)
    if (fxActive) diff.fxActive = fxActive
  }

  // ⚠️ TOUJOURS UN OBJET, JAMAIS `null`. L'appelant écrit `state.fen.x` sans
  // se demander de quelle époque vient le lien ; un ancien payload rend (0,0),
  // c'est-à-dire le centre du bloc — la vue exacte qu'il ouvrait déjà.
  const f = raw.fen
  const fen =
    f && isNum(f.x) && isNum(f.z)
      ? { x: clamp(f.x, -FEN_MAX, FEN_MAX), z: clamp(f.z, -FEN_MAX, FEN_MAX) }
      : { x: 0, z: 0 }

  return { loc: { lat, lon, zoom }, cam, fen, look: undiffLook(diff, base) }
}

// ---------------------------------------------------------------- base64url

function toBase64url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeShareState(state) {
  return toBase64url(JSON.stringify(state))
}
// never throws — a corrupt/garbled fragment just yields null, same as a
// bad paste anywhere else in the app
export function decodeShareState(str) {
  if (typeof str !== 'string' || !str) return null
  try {
    return JSON.parse(fromBase64url(str))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- publish (Blobs)

// Netlify Function endpoint backing the `#r=<id>` link form (see
// netlify/functions/race.mjs — POST to publish, GET ?id= to fetch).
export const RACE_ENDPOINT = '/.netlify/functions/race'

// A published race link is capped well above any real (already-decimated —
// see gpx.js's MAX_POINTS) track, but still bounded: this is the CLIENT-side
// mirror of the ceiling netlify/functions/race.mjs enforces server-side.
// Kept here, next to RACE_ENDPOINT, as the one place both main.js and the
// function's own limits are meant to agree with (the function can't import
// from src/ — see its own header comment — so the numbers are duplicated
// there, not shared by reference).
export const RACE_GPX_MAX_CHARS = 2_000_000
export const RACE_LOGO_MAX_CHARS = 2_000_000

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

// GpxLayer's `track` ({ points: [{lat,lon,ele}], name }) → a small, real,
// re-parseable GPX 1.1 document. NOT the organiser's original file
// byte-for-byte — gpx.js's parseGpx() already decimated it to MAX_POINTS
// (2400) the moment it was loaded, and this just re-serializes exactly those
// points. That decimation is the thing that makes publishing affordable at
// all: a real multi-thousand-point race GPX (hundreds of KB to ~1 MB raw)
// comes back out at a few hundred KB at most, every time, with no separate
// compression step needed.
export function trackToGpx(track) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="ShibuMap" xmlns="http://www.topografix.com/GPX/1/1">',
    `<trk><name>${escapeXml(track?.name || 'Track')}</name><trkseg>`,
  ]
  for (const p of track?.points || []) {
    if (!isNum(p.lat) || !isNum(p.lon)) continue
    const lat = p.lat.toFixed(6)
    const lon = p.lon.toFixed(6)
    if (isNum(p.ele)) lines.push(`<trkpt lat="${lat}" lon="${lon}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`)
    else lines.push(`<trkpt lat="${lat}" lon="${lon}"></trkpt>`)
  }
  lines.push('</trkseg></trk>', '</gpx>')
  return lines.join('')
}

// La règle vit dans race-model.js — le seul module que ce fichier ET le
// validateur de course partagent déjà. Deux copies de cette allowlist, c'est
// la garantie qu'un jour l'une des deux dérive.

// Untrusted decoded response from GET RACE_ENDPOINT?id=… → a safe
// { gpx, logo, state, race } or null. `state`, if present, is re-validated
// through parseShareState (same `base` contract) ; `race` (points de passage,
// transports — la course complète, sans quoi une shibu reçue n'a aucun
// cartouche) repasse par LE MÊME validateur que les fichiers .shibumap-race
// (race-model.parseRace) — a stored payload is exactly as untrusted as a
// pasted #s= fragment (anyone can POST to the publish endpoint), so it gets
// the same scrutiny before touching app state. Never throws.
export function parseRacePayload(raw, base) {
  if (!raw || typeof raw !== 'object') return null
  // La trace est FACULTATIVE : une carte sans course se publie aussi, et son
  // lien /r/<id> est le seul partage court et prévisualisable qui existe.
  // Présente, elle doit rester une chaîne bornée. Un payload SANS gpx ni state
  // n'a en revanche rien à restaurer — on le refuse plutôt que de rendre un
  // objet vide qui ferait croire à un lien valide.
  let gpx = null
  if (raw.gpx != null) {
    if (typeof raw.gpx !== 'string' || !raw.gpx || raw.gpx.length > RACE_GPX_MAX_CHARS) return null
    gpx = raw.gpx
  }
  if (!gpx && !(raw.state && typeof raw.state === 'object')) return null

  let logo = null
  const dataUrl = typeof raw.logo === 'string' ? raw.logo : raw.logo?.dataUrl
  if (typeof dataUrl === 'string' && dataUrl.length <= RACE_LOGO_MAX_CHARS && LOGO_DATA_URL_RE.test(dataUrl)) {
    logo = dataUrl
  }

  const state = raw.state && typeof raw.state === 'object' ? parseShareState(raw.state, base) : null

  let race = null
  if (raw.race && typeof raw.race === 'object') {
    const bundle = parseRace(JSON.stringify({ format: 'shibumap-race', version: 1, race: raw.race }))
    if (bundle) race = bundle.race
  }

  return { gpx, logo, state, race }
}

// ---------------------------------------------------------------- modifier une course publiée

// Le jeton d'édition rendu UNE SEULE FOIS par le POST (voir
// netlify/functions/race.mjs). Il voyage dans un EN-TÊTE et jamais dans
// l'URL : une chaîne de requête finit en clair dans les journaux d'accès, dans
// ceux des relais, et dans le Referer de la page suivante.
export const RACE_SECRET_HEADER = 'x-shibumap-secret'

// Sans compte, le navigateur qui a publié est le SEUL endroit où le jeton
// peut se retrouver. C'est le minimum : l'envoi par courriel est prévu côté
// produit, mais tant qu'il n'existe pas, un secret non conservé équivaut
// exactement à un lien non modifiable.
const RACE_SECRETS_KEY = 'shibumap.race.secrets'
// Borné : le stockage local d'un domaine tient dans quelques mégaoctets et
// n'est jamais purgé tout seul. Cinquante cartes publiées depuis le même
// navigateur, c'est déjà beaucoup plus qu'un organisateur réel.
const RACE_SECRETS_MAX = 50
const RACE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/
const RACE_SECRET_RE = /^[A-Za-z0-9]{16,128}$/

// Ne lève JAMAIS : en navigation privée Safari, avec le stockage désactivé ou
// le quota plein, `getItem` lui-même jette. Un stockage en panne doit coûter
// la modification ultérieure, pas la publication en cours.
function readRaceSecrets(storage) {
  try {
    const raw = storage?.getItem(RACE_SECRETS_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

// → true si le jeton est bien noté. false n'est pas une erreur fatale : le
// lien reste partageable, il ne sera simplement pas corrigeable depuis ce
// navigateur.
export function rememberRaceSecret(id, secret, storage = globalThis.localStorage) {
  if (typeof id !== 'string' || !RACE_ID_RE.test(id)) return false
  if (typeof secret !== 'string' || !RACE_SECRET_RE.test(secret)) return false
  const all = readRaceSecrets(storage)
  delete all[id] // réécrire un id le remet en tête de fraîcheur
  all[id] = secret
  const ids = Object.keys(all)
  for (const vieux of ids.slice(0, Math.max(0, ids.length - RACE_SECRETS_MAX))) delete all[vieux]
  try {
    storage.setItem(RACE_SECRETS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

// → le jeton, ou null (jamais une exception). null veut dire « ce navigateur
// n'est pas celui qui a publié » — pas « ce lien n'existe pas ».
export function recallRaceSecret(id, storage = globalThis.localStorage) {
  if (typeof id !== 'string' || !RACE_ID_RE.test(id)) return null
  const secret = readRaceSecrets(storage)[id]
  return typeof secret === 'string' && RACE_SECRET_RE.test(secret) ? secret : null
}

// Réécrit une course DÉJÀ publiée, sous le même id — donc sous le même lien
// que les inscrits ont déjà reçu. C'est toute la raison d'être du jeton :
// republier fabriquait un second identifiant et laissait les porteurs du
// premier sur l'ancienne version.
//
// `body` a exactement la forme du POST ({ gpx, state, raceName, race, logo })
// et repasse par les mêmes plafonds côté serveur. Ne lève jamais : rend
// { ok: true, id } ou { ok: false, error } — un échec doit être DIT, jamais
// avalé, sinon l'organisateur croit son parcours corrigé alors qu'il ne l'est
// pas.
export async function updateRace(id, secret, body, fetchImpl = globalThis.fetch) {
  if (typeof id !== 'string' || !RACE_ID_RE.test(id)) return { ok: false, error: 'identifiant invalide' }
  if (typeof secret !== 'string' || !RACE_SECRET_RE.test(secret)) return { ok: false, error: 'clé de modification absente' }
  try {
    const res = await fetchImpl(`${RACE_ENDPOINT}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', [RACE_SECRET_HEADER]: secret },
      body: JSON.stringify(body ?? {}),
    })
    if (!res.ok) {
      let msg = ''
      try { msg = JSON.parse(await res.text())?.error || '' } catch {}
      return { ok: false, error: `HTTP ${res.status}${msg ? ` — ${msg}` : ''}` }
    }
    const j = await res.json()
    if (!j?.ok) return { ok: false, error: 'réponse inattendue du serveur' }
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: err?.message || 'réseau' }
  }
}
