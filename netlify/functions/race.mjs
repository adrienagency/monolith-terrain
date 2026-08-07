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
// Et sur la LECTURE, qui est l'autre moitié du problème : un budget d'OCTETS
// par IP, distinct du seau d'écriture et bien plus généreux, parce qu'un lien
// #r=<id> est fait pour être ouvert par des centaines de coureurs dont beaucoup
// partagent une même adresse publique. Voir « limitation de débit en LECTURE ».
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

// LES CHAMPS DE RÉGIE — posés par le serveur, jamais par le client.
//
// Une correction reconstruit le blob à partir de `readWriteBody`, qui ne rend
// QUE les champs venus du client. Tout ce qui vit sur l'ancien blob et n'est
// pas repris ici DISPARAÎT, sans erreur, sans trace, à la première correction
// de tracé. `secretHash` et `createdAt` étaient recopiés à la main ; le jour
// où un troisième champ est arrivé, rien n'aurait signalé son absence.
//
// Cette liste est le seul endroit à tenir à jour, et `test/race-regie.test.js`
// vérifie la règle générale — « une correction ne perd aucune clé » — plutôt
// que la survie d'un champ nommé, qui serait verte et ne protégerait rien du
// champ suivant.
export const CHAMPS_DE_REGIE = ['secretHash', 'createdAt', 'ownerId']

// CEUX QUI NE SORTENT JAMAIS. Le GET est public et sert précisément à donner
// le payload à des inconnus — chaque champ de régie doit donc être classé ici
// ou assumé public, et `test/race-regie.test.js` refuse un champ non classé.
//
// ⚠️ `ownerId` EST PRIVÉ, et ce n'est pas de la pudeur. Un lien /r/<id> est
// fait pour être ouvert par des centaines de coureurs ; laisser sortir
// l'identifiant de compte de l'organisateur, c'est distribuer à tous la seule
// chose qu'il faut connaître pour se faire passer pour lui ailleurs.
// `createdAt`, lui, est une date de publication : elle est publique sans
// dommage, et « Mes cartes » en a besoin pour trier.
export const CHAMPS_PRIVES = ['secretHash', 'ownerId']

// Ce que l'ancien blob lègue au nouveau. Un champ absent de l'ancien reste
// absent du nouveau : on reconduit, on n'invente pas.
function regieConservee(ancien) {
  const garde = {}
  for (const champ of CHAMPS_DE_REGIE) {
    if (ancien && ancien[champ] !== undefined) garde[champ] = ancien[champ]
  }
  return garde
}

// `obj` accepte AUSSI une chaîne déjà sérialisée : la lecture doit mesurer
// exactement les octets qu'elle rend pour les débiter (voir le budget de
// lecture plus bas), et sérialiser deux fois un payload de plusieurs mégaoctets
// juste pour le peser serait absurde.
function jsonResponse(obj, status, enTetesSup = null) {
  return new Response(typeof obj === 'string' ? obj : JSON.stringify(obj), {
    status,
    headers: {
      // NEVER text/html, NEVER an image/* content-type on the way back out —
      // the body can be a stranger's GPX/logo bytes; force it inert.
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
      ...(enTetesSup || {}),
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

// ---- limitation de débit en LECTURE ----------------------------------------
// LE SEAU CI-DESSUS NE PROTÈGE QUE L'ÉCRITURE. Pendant longtemps le GET n'avait
// aucun frein : il répondait avant même d'atteindre takeToken. Or c'est LA
// LECTURE qui coûte de la bande passante — une réponse peut peser jusqu'à
// MAX_BODY_CHARS (≈ 4,26 Mo). Déposer une course au plafond ne demande qu'une
// écriture (largement sous les 12 autorisées), et il suffit ensuite de relire
// cet id en boucle pour vider l'allocation mensuelle de bande passante en
// quelques minutes depuis UNE SEULE machine : site en pause, ou facture.
//
// POURQUOI PAS LE MÊME SEAU QUE L'ÉCRITURE. Un lien #r=<id> est fait pour être
// envoyé à des centaines de coureurs, et beaucoup partagent une adresse IP
// publique (wifi de club, réseau d'entreprise, NAT d'opérateur mobile).
// 12 requêtes par 10 minutes casserait le produit dès le premier départ groupé.
//
// POURQUOI DES OCTETS ET NON DES REQUÊTES. Ce qui se paie, c'est la bande
// passante, pas l'invocation. Un plafond en requêtes assez généreux pour un NAT
// plein de coureurs (des centaines) laisserait quand même passer des centaines
// × 4,26 Mo, soit plusieurs gigaoctets. Compter les octets rend au contraire les
// deux profils très différents : une lecture normale (trace décimée à
// MAX_POINTS ≈ 200-300 ko) coûte peu et passe des milliers de fois, tandis
// qu'un payload gonflé au plafond épuise le budget en quelques centaines de
// coups. C'est aussi ce qui laisse passer gratuitement les lectures peu
// coûteuses — une carte nue, un 404 — sans les traiter à part.
//
// LE CHIFFRE. 1 Gio par tranche de 10 minutes et par IP :
//   - côté usage légitime, cela couvre ≈ 3 600 lectures d'une course typique
//     (300 ko) ou ≈ 430 lectures d'une course LOURDE (2,5 Mo : gros logo +
//     trace) depuis une seule adresse IP, cache CDN entièrement contourné. Le
//     scénario légitime le plus proche du plafond est donc un départ de masse
//     où plus de 400 appareils DISTINCTS partagent une même IP publique et
//     ouvrent le lien dans le même quart d'heure. On n'y est pas.
//   - côté abus, cela ramène une machine seule de ~80 Mo/s à 1,79 Mo/s
//     comptés ici. Et comme on débite les octets AVANT compression alors que la
//     facture porte sur le flux compressé (du GPX, c'est du texte : gzip divise
//     par 3 à 5), la ponction réelle est plutôt de l'ordre de 0,4 Mo/s. Vider
//     une allocation de quelques dizaines de gigaoctets demande alors des
//     heures au lieu de trois minutes.
// Ce n'est donc pas un mur, c'est un débit : le but est de transformer une
// purge instantanée en fuite lente et visible. Un plafond assez bas pour rendre
// l'abus impossible refuserait des coureurs, et c'est exactement ce qu'on
// refuse de faire.
//
// PREMIÈRE RAFALE : le seau démarre plein, donc un attaquant peut prendre 1 Gio
// d'un coup avant d'être freiné. Assumé — un seul Gio n'est pas ce qui met le
// site en pause, la répétition l'était.
export const LECTURE_CAP_OCTETS = 1024 * 1024 * 1024 // 1 Gio d'octets servis
export const LECTURE_FENETRE_MS = 10 * 60 * 1000 // rechargé en entier en 10 min

// Clé distincte de celle de l'écriture (`rl_`) : lire beaucoup ne doit jamais
// empêcher un organisateur de corriger sa course, ni l'inverse. Le préfixe
// contient un « _ », que ID_RE interdit — aucun seau ne peut donc entrer en
// collision avec un identifiant de course dans le même magasin.
export const cleSeauLecture = (ip) => `rlq_${String(ip).replace(/[^a-zA-Z0-9:._-]/g, '')}`.slice(0, 96)

// Solde d'octets de cette IP, ou null quand il n'y a rien à compter (pas d'IP
// lisible, magasin en panne). null veut dire « sers sans compter » : comme pour
// l'écriture, une panne du magasin ne doit pas fermer le site.
async function creditLecture(store, ip, now = Date.now()) {
  if (!ip) return null
  let seau = null
  try {
    seau = await store.get(cleSeauLecture(ip), { type: 'json' })
  } catch {
    return null
  }
  return refillBucket(seau, now, LECTURE_CAP_OCTETS, LECTURE_FENETRE_MS)
}

// Le débit a lieu APRÈS coup, sur la taille réellement servie. Conséquence
// voulue : on ne refuse jamais une requête à quelqu'un qui avait encore du
// crédit au moment de la demander — le solde peut passer sous zéro, et c'est la
// requête SUIVANTE qui est refusée. Le découvert est borné par une réponse.
async function debiterLecture(store, ip, seau, octets) {
  if (!ip || !seau) return
  try {
    await store.setJSON(cleSeauLecture(ip), { tokens: seau.tokens - octets, at: seau.at })
  } catch {}
}

// Secondes à attendre avant que le solde redevienne positif, pour Retry-After.
// Un découvert profond ne doit pas renvoyer une éternité : on borne à la
// fenêtre, au bout de laquelle le seau est de toute façon plein.
export function delaiRecharge(solde, cap = LECTURE_CAP_OCTETS, fenetreMs = LECTURE_FENETRE_MS) {
  const manque = Math.max(1, 1 - (Number.isFinite(solde) ? solde : 0))
  const ms = (manque * fenetreMs) / cap
  return Math.min(Math.round(fenetreMs / 1000), Math.max(1, Math.ceil(ms / 1000)))
}

// EN-TÊTES DE CACHE DE LA LECTURE — le complément indispensable du budget
// ci-dessus. Sans eux, chaque coureur d'un départ groupé est un appel de
// fonction et un aller-retour Blobs ; avec eux, le réseau de diffusion sert la
// rafale et l'origine ne voit qu'une requête par tranche. Le budget reste
// dimensionné COMME SI le cache n'existait pas : un cache est une optimisation,
// pas une garantie, et un attaquant peut le contourner (URL variée, en-tête de
// requête sans-cache).
//
// LA DURÉE EST LE COMPROMIS. Le PUT existe précisément pour qu'une course
// corrigée atteigne ceux qui détiennent déjà le lien ; un cache long
// remplacerait ce bug-là par le même bug côté réseau. 30 secondes parce que :
//   - c'est déjà largement assez pour absorber un départ (à 10 requêtes/s, une
//     seule atteint l'origine au lieu de 300) — allonger encore n'apporte
//     presque rien, la fusion sature vite ;
//   - c'est le pire décalage que verra un organisateur qui corrige son tracé
//     puis recharge son propre lien pour vérifier. Une demi-minute se
//     comprend ; dix minutes se vivent comme « ma correction n'a pas pris ».
// max-age=0 côté navigateur : un rechargement manuel doit TOUJOURS repartir
// chercher la version fraîche. Seul le cache partagé garde une copie.
// L'en-tête Netlify dit la même chose dans le dialecte du CDN, qui a priorité
// sur cache-control quand il est présent ; les deux doivent rester d'accord.
const CACHE_LECTURE = {
  'cache-control': 'public, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'public, s-maxage=30, must-revalidate',
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

    // Le solde se consulte AVANT d'aller chercher le blob : même doctrine que
    // l'écriture, inutile de tirer 4 Mo du magasin pour quelqu'un qu'on va
    // refuser. Voir le bloc « limitation de débit en LECTURE » pour l'arbitrage.
    const ip = clientIp(req.headers)
    const seau = await creditLecture(store, ip)
    if (seau && seau.tokens <= 0) {
      return jsonResponse({ error: 'trop de lectures depuis cette adresse, réessayez dans un instant' }, 429, {
        'retry-after': String(delaiRecharge(seau.tokens)),
        // sans cela le navigateur cache le délai à l'appelant d'une autre origine
        'access-control-expose-headers': 'retry-after',
        // un refus ne se met JAMAIS en cache : il vaut pour cette IP à cet
        // instant, et une copie partagée le servirait à des innocents
        'cache-control': 'no-store',
      })
    }

    let payload
    try {
      payload = await store.get(id, { type: 'json' })
    } catch (err) {
      console.error('race GET blobs error:', err)
      return jsonResponse({ error: 'storage unavailable' }, 502)
    }
    if (!payload) return jsonResponse({ error: 'not found' }, 404)
    // LES CHAMPS PRIVÉS NE SORTENT PAS. Ce GET est public et sert précisément
    // à donner le payload à des inconnus ; il ne doit jamais leur donner en
    // plus de quoi le réécrire, ni l'identité de son auteur.
    //
    // ⚠️ ON RETIRE PAR LISTE, PAS À LA MAIN. `const { secretHash, ...reste }`
    // ne protégeait que le champ qu'on avait pensé à nommer : tout champ de
    // régie ajouté ensuite serait sorti tout seul, en silence, sur chaque lien
    // déjà diffusé.
    const publicPayload = { ...payload }
    for (const champ of CHAMPS_PRIVES) delete publicPayload[champ]
    // Sérialisé une fois, pesé, débité, rendu : ce sont bien les octets qui
    // partent sur le fil qu'on compte, pas une estimation.
    const corps = JSON.stringify({ ok: true, payload: publicPayload })
    await debiterLecture(store, ip, seau, Buffer.byteLength(corps, 'utf8'))
    return jsonResponse(corps, 200, CACHE_LECTURE)
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
      // Tout ce que le serveur a posé et que le client ne renvoie pas — dont
      // le jeton, qui ne tourne pas : celui que l'organisateur a gardé doit
      // encore ouvrir la porte à la correction suivante.
      ...regieConservee(existing),
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
