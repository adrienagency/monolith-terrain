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
// La seule source d'identité du serveur. Elle interroge Supabase et rend l'uid
// d'une session vérifiée, ou '' — et '' est le cas NORMAL : ShibuMap s'utilise
// sans compte. Voir _compte.mjs pour pourquoi on ne vérifie pas le JWT ici.
import { compteVerifie } from './_compte.mjs'

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

// La forme acceptable d'un uid, reprise mot pour mot de paiement.mjs. Ce n'est
// pas de la redite décorative : cet identifiant finit dans une CLÉ DE MAGASIN
// (`owner/<uid>/<raceId>`), donc ni « / » ni « _ » — l'espace de noms des index
// et des seaux — ne doivent pouvoir y entrer. `compteVerifie` le borne déjà en
// longueur ; ici on borne le jeu de caractères, à l'endroit où la clé se
// fabrique. Défense en profondeur : le jour où Supabase émet autre chose qu'un
// UUID, on ne veut pas l'apprendre par une clé traversée.
const COMPTE_RE = /^[A-Za-z0-9-]{8,64}$/
const identifiantCompte = (v) => (typeof v === 'string' && COMPTE_RE.test(v) ? v : '')

// ⚠️ TROIS ÉTATS, PAS DEUX. `identifiantCompte` rend '' aussi bien pour un champ
// ABSENT que pour un champ ILLISIBLE, et confondre les deux fait dire au blob
// « cette carte n'a pas de propriétaire » alors qu'elle en a un qu'on ne sait
// plus lire (version antérieure du code, correction manuelle, Supabase qui
// change de format d'id). Le premier venu détenant le secret l'écrasait alors en
// silence, et le propriétaire d'origine n'avait aucun recours.
//
// « Illisible » doit FERMER la porte. Un propriétaire qu'on ne sait pas lire
// reste un propriétaire — et comme on ne sait pas davantage reconstruire sa clé
// d'index, aucun transfert PROPRE n'est possible : on refuse plutôt que
// d'écraser en laissant une entrée orpheline derrière.
//
// La chaîne vide compte comme « absent » : c'est ce qu'une publication sans
// compte laisse dans le magasin, et `autorise()` la traite déjà ainsi.
function proprietaireDuBlob(v) {
  if (v === undefined || v === null || v === '') return { present: false, uid: '' }
  return { present: true, uid: identifiantCompte(v) }
}

// ═══════════════════════════════════════════════════════════════════════════
// autorise() — LA fonction d'autorisation, et il n'y en aura jamais deux.
// ═══════════════════════════════════════════════════════════════════════════
//
//   autorise = secretMatches(en-tête, blob.secretHash)
//              || (blob.ownerId && blob.ownerId === session vérifiée)
//
// DEUX CHEMINS, JAMAIS TROIS. Rien venant du corps de la requête ou de l'URL ne
// peut influencer une autorisation : ni un champ `ownerId` recopié par le
// client, ni un paramètre de chaîne de requête. « Le client dit que c'est à
// lui » n'est pas une preuve, et un troisième chemin est exactement ce que ce
// système existe pour interdire.
//
// ⚠️ LE JETON N'EST PAS TOUCHÉ, ET LE COMPTE S'AJOUTE À CÔTÉ. Des organisateurs
// ont déjà des liens et des secrets en circulation ; ils doivent continuer de
// fonctionner exactement comme avant, y compris sur une carte qui a désormais
// un propriétaire. C'est aussi ce qui fait que le produit survit à une panne
// d'authentification : `secretMatches` ne dépend de personne.
//
// ⚠️ L'ORDRE COMPTE. Le jeton se vérifie EN PREMIER, localement, sans réseau —
// on ne dérange Supabase que pour quelqu'un qui n'a pas présenté de secret.
//
// ⚠️ `blob.ownerId &&` N'EST PAS DE LA COQUETTERIE. Sans ce garde, une carte
// anonyme (`ownerId` absent) comparée à une session absente ('' ou undefined)
// pourrait faire de n'importe quel visiteur le propriétaire de tout.
async function autorise(req, blob, verifieCompte) {
  if (secretMatches(req.headers.get(SECRET_HEADER), blob?.secretHash)) return true
  const proprietaire = identifiantCompte(blob?.ownerId)
  if (!proprietaire) return false
  return proprietaire === identifiantCompte(await verifieCompte(req))
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
      // `authorization` porte le jeton de session : sans lui dans cette liste,
      // un appel depuis une autre origine par quelqu'un de connecté serait
      // refusé par le navigateur avant même de partir.
      'access-control-allow-headers': 'content-type, x-shibumap-secret, authorization',
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

// ---- le seau du RATTACHEMENT, et pourquoi il est à part --------------------
// ⚠️ RÉUTILISER LE SEAU D'ÉCRITURE (12 par 10 minutes) BLOQUERAIT UN
// RATTACHEMENT LÉGITIME AU TREIZIÈME. Le stockage local d'un navigateur garde
// jusqu'à 50 secrets (voir share-link.js) : quelqu'un qui crée son compte après
// coup les remonte tous d'un seul geste, et ce geste ne doit pas être puni.
//
// Un rattachement ne crée rien et ne sert aucun octet — il pose un champ sur un
// blob dont l'appelant détient déjà le secret. Le frein n'est donc là que pour
// borner le travail (une lecture de blob par tentative), pas pour rationner un
// usage normal.
export const RATTACHEMENT_CAP = 120
// Préfixe distinct de `rl_` (écriture) et `rlq_` (lecture) ; il contient un
// « _ », que ID_RE interdit, donc aucune collision avec un identifiant possible.
// `normaliseIp` ramène une IPv6 à sa /64 et laisse tout le reste intact : voir
// « CE QU'UN SEAU DÉSIGNE VRAIMENT » plus bas.
export const cleSeauRattachement = (ip) => `rlr_${normaliseIp(ip).replace(/[^a-zA-Z0-9:._-]/g, '')}`.slice(0, 96)

// `prefixe` et `cap` sont paramétrés parce qu'il y a maintenant deux seaux à
// jetons de forme identique et de calibre différent. La valeur par défaut est
// celle de l'écriture : un appelant qui ne dit rien tombe sur le comportement
// d'avant, à l'octet près.
async function takeToken(store, ip, now = Date.now(), prefixe = 'rl_', cap = RATE_CAP) {
  if (!ip) return true // pas d'IP lisible : on ne bloque pas un vrai visiteur
  const key = `${prefixe}${normaliseIp(ip).replace(/[^a-zA-Z0-9:._-]/g, '')}`.slice(0, 96)
  let bucket = null
  try {
    bucket = await store.get(key, { type: 'json' })
  } catch {
    return true // le magasin est en panne : on laisse passer plutôt que de fermer le site
  }
  const next = refillBucket(bucket, now, cap, RATE_WINDOW_MS)
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
export const cleSeauLecture = (ip) => `rlq_${normaliseIp(ip).replace(/[^a-zA-Z0-9:._-]/g, '')}`.slice(0, 96)

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

// ⚠️ ET SON CONTRAIRE, POUR TOUT CE QUI DÉPEND D'UNE SESSION.
//
// Le chemin GET pose CACHE_LECTURE sans condition, et c'est parfaitement juste
// tant qu'une réponse ne dépend que de l'identifiant demandé. « Mes cartes » et
// le rattachement, eux, dépendent de QUI DEMANDE : greffés sur ce même
// gestionnaire, ils feraient resservir la liste d'un compte au visiteur suivant
// pendant trente secondes — sans attaquant, sans bruit, et sans que rien ne le
// signale. Le refus 429 le fait déjà correctement ; on en fait une constante
// plutôt qu'une ligne à ne pas oublier.
//
// Les DEUX en-têtes disent la même chose : le dialecte du CDN a priorité quand
// il est présent, donc laisser `netlify-cdn-cache-control` absent reviendrait à
// espérer que la valeur par défaut soit la bonne.
const SANS_CACHE = {
  'cache-control': 'no-store',
  'netlify-cdn-cache-control': 'no-store',
}

// ---- CE QU'UN SEAU DÉSIGNE VRAIMENT : UN ABONNÉ, PAS UNE ADRESSE -----------
//
// Les trois seaux étaient indexés sur l'IP ENTIÈRE. En IPv4 c'est juste : une
// adresse publique, un abonné. En IPv6, non — un particulier reçoit une /64,
// soit 18 milliards de milliards d'adresses, et changer d'adresse à l'intérieur
// de sa propre /64 ne coûte rien. Mesuré par la passe d'attaque : 40 adresses
// d'une même /64 = 40 seaux d'écriture, donc 480 publications au lieu de 12, et
// autant de clés permanentes créées dans le magasin au passage.
//
// ⚠️ CE QUI NE DOIT PAS BOUGER. Les seaux `rl_203.0.113.7` déjà en circulation
// gardent leur clé à l'octet près : tout ce qui n'est pas une IPv6 lisible
// ressort d'ici INCHANGÉ. Une IPv4 déguisée (`::ffff:203.0.113.7`) aussi — elle
// désigne un hôte, pas un réseau. Une IPv6 illisible également : on ne devine
// pas, on garde la clé telle quelle plutôt que de fabriquer un préfixe faux qui
// regrouperait des abonnés sans rapport sous un même seau.
const GROUPES_PREFIXE = 4 // 4 groupes de 16 bits = /64

export function normaliseIp(brut) {
  const ip = String(brut ?? '').trim().replace(/^\[/, '').replace(/](:\d+)?$/, '').split('%')[0]
  if (!ip) return ''
  if (!ip.includes(':')) return ip
  if (ip.includes('.')) return ip // ::ffff:203.0.113.7 — un hôte, pas un réseau
  if (ip.indexOf('::') !== ip.lastIndexOf('::')) return ip // deux abréviations : illisible

  const [gauche, droite] = ip.split('::')
  const g = gauche ? gauche.split(':') : []
  const d = droite === undefined ? null : droite ? droite.split(':') : []
  let groupes
  if (d === null) {
    if (g.length !== 8) return ip // forme complète attendue, sinon on ne devine pas
    groupes = g
  } else {
    if (g.length + d.length > 8) return ip
    groupes = [...g, ...Array(8 - g.length - d.length).fill('0'), ...d]
  }
  if (!groupes.every((x) => /^[0-9A-Fa-f]{1,4}$/.test(x))) return ip
  // Casse et zéros de tête normalisés : `2001:0DB8:…` et `2001:db8:…` sont la
  // MÊME /64, et deux clés pour un seul abonné rendraient le seau décoratif.
  return groupes.slice(0, GROUPES_PREFIXE).map((x) => x.replace(/^0+(?=.)/, '').toLowerCase()).join(':') + '::'
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

// ═══════════════════════════════════════════════════════════════════════════
// L'INDEX DES CARTES D'UN COMPTE — `owner/<uid>/<raceId>`
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ DOCTRINE, ET ELLE N'EST PAS NÉGOCIABLE :
//        LE BLOB EST LA VÉRITÉ. L'INDEX N'EST QU'UN CACHE RECONSTRUCTIBLE.
//
// Publier une carte qui appartient à quelqu'un, c'est DEUX ÉCRITURES, et le
// magasin n'offre aucune transaction. L'une des deux peut donc échouer seule, en
// silence. Les deux modes de panne ne se valent pas :
//   - le blob écrit, l'index manquant : la carte existe, son lien fonctionne,
//     elle n'apparaît simplement pas dans « Mes cartes ». Rattrapable, et
//     rattrapé tout seul — la correction suivante réécrit l'entrée.
//   - l'index écrit, le blob manquant : « Mes cartes » promet une carte qui
//     n'existe pas. On a menti à quelqu'un sur son propre travail.
// D'où l'ordre, qui est la seule chose qui compte ici : L'INDEX S'ÉCRIT APRÈS
// LE BLOB, JAMAIS AVANT. Et son échec ne fait jamais échouer la publication.
//
// LA LECTURE FILTRE LES ENTRÉES MORTES. Un index est un cache : il peut porter
// une entrée illisible, tronquée, ou dont la clé ne veut plus rien dire. La
// liste les saute au lieu de tomber — une carte de moins vaut mieux qu'un
// panneau vide. Elle ne peut PAS, en revanche, aller vérifier chaque blob :
// ouvrir N payloads est très exactement le piège que cet index existe pour
// éviter (voir « limitation de débit en LECTURE » — un organisateur brûlerait
// son propre budget d'octets en consultant sa liste).
//
// Le préfixe contient « / », que ID_RE interdit : aucune entrée d'index ne peut
// entrer en collision avec un identifiant de course dans le même magasin.
export const cleIndexProprietaire = (uid, raceId) => `owner/${uid}/${raceId}`

// Ce que « Mes cartes » a besoin de savoir, et RIEN DE PLUS : de quoi afficher
// une ligne et fabriquer un lien. Pas de trace, pas de logo, pas de condensat,
// pas d'identifiant de compte (il est déjà dans la clé). Une entrée pèse
// quelques centaines d'octets, contre plusieurs mégaoctets pour le payload.
function entreeIndex(raceId, payload) {
  const loc = payload?.state?.loc
  const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const lat = nombre(loc?.lat)
  const lon = nombre(loc?.lon)
  return {
    id: raceId,
    nom: typeof payload?.raceName === 'string' ? payload.raceName : '',
    // Le lieu, c'est la position du bloc chargé — la seule notion de lieu que
    // le serveur possède, l'application ne lui envoyant aucun nom de commune.
    lieu: lat !== null && lon !== null ? { lat, lon, zoom: nombre(loc?.zoom) ?? 0 } : null,
    creeLe: typeof payload?.createdAt === 'string' ? payload.createdAt : '',
    majLe: typeof payload?.updatedAt === 'string' ? payload.updatedAt : '',
  }
}

// Pose (ou rafraîchit) l'entrée d'index d'une carte. TOUJOURS après l'écriture
// du blob, et TOUJOURS sans droit de veto : un index en panne ne doit pas faire
// échouer une publication réussie.
async function noterAuJournalDuCompte(store, uid, raceId, payload) {
  if (!uid) return
  try {
    await store.setJSON(cleIndexProprietaire(uid, raceId), entreeIndex(raceId, payload))
  } catch (err) {
    console.error('[race] index de compte non écrit (la carte, elle, est sauve) :', err)
  }
}

// L'inverse, quand une carte change de mains : l'ancien propriétaire ne doit
// plus la voir dans « Mes cartes ». MÊME DOCTRINE QUE L'ÉCRITURE — l'index
// n'est qu'un cache, donc ce ménage n'a AUCUN droit de veto. Une suppression
// qui échoue laisse une ligne périmée dans un panneau, pas une carte volée : le
// blob, lui, porte déjà le nouveau propriétaire, et c'est lui la vérité.
//
// `store.delete` est optionnel à dessein : la vraie API Blobs le fournit, mais
// un magasin de test ou une version antérieure peut ne pas l'avoir, et un
// rattachement légitime ne doit pas échouer pour ça.
async function effacerDuJournalDuCompte(store, uid, raceId) {
  if (!uid) return
  try {
    await store.delete?.(cleIndexProprietaire(uid, raceId))
  } catch (err) {
    console.error('[race] index du precedent proprietaire non retiré :', err)
  }
}

// Une entrée d'index exploitable, ou null. C'est ici que se filtrent les entrées
// mortes : clé bricolée ou tronquée, contenu illisible, entrée qui ne parle pas
// de sa propre clé. On ne fait confiance ni au magasin ni au passé.
function entreeVivante(cle, prefixe, brut) {
  const raceId = String(cle).slice(prefixe.length)
  if (!ID_RE.test(raceId)) return null
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  if (brut.id !== raceId) return null
  return {
    id: raceId,
    nom: typeof brut.nom === 'string' ? brut.nom : '',
    lieu: brut.lieu && typeof brut.lieu === 'object' ? brut.lieu : null,
    creeLe: typeof brut.creeLe === 'string' ? brut.creeLe : '',
    majLe: typeof brut.majLe === 'string' ? brut.majLe : '',
  }
}

// Borne de sortie. Une liste n'est pas un vidage de base : au-delà, l'écran
// n'affiche plus rien d'utile et la réponse commence à peser.
const MAX_CARTES_LISTEES = 500

// ---- CE QU'ON FACTURE À « MES CARTES », ET POURQUOI CE N'EST PAS CE QU'ON REND
//
// ⚠️ CE COMPTE EST CONTRE-INTUITIF, ET IL LE RESTERA : la réponse de « Mes
// cartes » pèse quelques kilo-octets et on en débite plusieurs mégaoctets. Ce
// n'est pas une erreur d'unité. Le seau de lecture est libellé en octets parce
// que le GET public ne coûte QUE de la bande passante ; sur ce chemin-ci, le
// fil n'est pas ce qui coûte — un aller-retour SORTANT vers Supabase l'est.
// Celui-là consomme le quota d'AUTHENTIFICATION du projet, et saturer ce
// quota-là, c'est empêcher les vraies connexions, pas gonfler une facture.
// Facturer les octets rendus revient donc à ne rien facturer du tout : la passe
// d'attaque a mesuré 300 requêtes anonymes = 300 appels Supabase, 0 octet
// compté. On convertit ce qui coûte en octets fictifs plutôt que d'ouvrir un
// quatrième seau : un seul budget par IP reste lisible, et un abus de la liste
// doit AUSSI freiner les lectures de cartes de la même adresse — c'est la même
// machine.
//
// LE FORFAIT SE DÉBITE AVANT `verifieCompte`, et c'est tout l'objet de sa
// position : on ne paie pas un appel réseau pour quelqu'un qui n'a encore rien
// prouvé. Sa valeur est celle de la plus grosse lecture possible
// (MAX_BODY_CHARS, ≈ 4,26 Mo) — « demander la liste sans être connu coûte le
// prix d'un gros payload » se retient, et cale le plafond à ≈ 250 tentatives
// par IP et par 10 minutes. Un usage légitime en est très loin : ouvrir son
// panneau vingt-cinq fois par minute n'existe pas.
export const COUT_APPEL_LISTE = 4 * 1024 * 1024

// LE COÛT D'OPÉRATION, lui, est proportionnel au travail réellement fait :
// une entrée d'index lue = 4 Kio débités. C'est l'autre moitié du même
// problème — UNE requête HTTP déclenche jusqu'à MAX_CARTES_LISTEES + 1
// opérations de magasin, et la passe d'attaque a mesuré 60 cartes = 61
// lectures pour 9 012 octets débités, soit 7,2 MILLIONS de lectures de blobs
// autorisées par le budget d'1 Gio depuis une seule adresse. Une liste pleine
// coûte désormais 2 Mio de plus que son forfait, et la même IP tombe à
// quelques centaines de requêtes.
//
// 4 Kio parce que c'est l'ordre de grandeur d'une opération de magasin
// facturée — PAS le poids de l'entrée, qui fait quelques centaines d'octets.
// Encore une fois : ce qu'on facture n'est pas ce qu'on rend.
export const COUT_OPERATION_MAGASIN = 4 * 1024

// Le refus de lecture, extrait pour être RIGOUREUSEMENT le même des deux côtés.
// C'est lui qui traitait déjà correctement le cache — un refus vaut pour une IP
// à un instant, et une copie partagée le servirait à des innocents.
function refusLecture(seau) {
  return jsonResponse({ error: 'trop de lectures depuis cette adresse, réessayez dans un instant' }, 429, {
    'retry-after': String(delaiRecharge(seau.tokens)),
    // sans cela le navigateur cache le délai à l'appelant d'une autre origine
    'access-control-expose-headers': 'retry-after',
    ...SANS_CACHE,
  })
}

// ---- « Mes cartes » --------------------------------------------------------
//
// ⚠️ LE PIÈGE QUI COÛTE CHER, ET IL EST ENTIÈREMENT DANS CE QUE CETTE FONCTION
// NE FAIT PAS. `debiterLecture` plafonne à 1 Gio par IP et par 10 minutes, un
// chiffre dimensionné pour « un lien, mille lecteurs ». Ici le profil est
// l'inverse — un lecteur, N cartes de plusieurs mégaoctets : un organisateur qui
// ouvre sa liste de 40 cartes brûlerait 170 Mo de SON PROPRE budget, et se
// verrait refuser la lecture de ses propres liens juste après. D'où les
// métadonnées dans l'entrée d'index, et AUCUN payload ouvert ici — pas même
// pour vérifier qu'une carte existe encore.
async function mesCartes(req, store, verifieCompte) {
  // Le seau de lecture s'applique quand même : cette liste reste des octets sur
  // le fil, et elle coûte une lecture de magasin par entrée. Elle est
  // simplement, par construction, mille fois moins chère qu'un payload.
  const ip = clientIp(req.headers)
  const seau = await creditLecture(store, ip)
  if (seau && seau.tokens <= 0) return refusLecture(seau)

  // ⚠️ ON PAIE D'ABORD, ON VÉRIFIE ENSUITE. `debiterLecture` écrit un solde
  // ABSOLU calculé depuis `seau` : rappeler la fonction plus bas avec un total
  // plus grand remplace ce premier débit, il ne s'y ajoute pas. D'où l'addition
  // portée par `debit`, et non des débits successifs qui s'écraseraient.
  let debit = COUT_APPEL_LISTE
  await debiterLecture(store, ip, seau, debit)

  const uid = identifiantCompte(await verifieCompte(req))
  // ⚠️ TOUT CE QUI SORT D'ICI PART EN no-store, Y COMPRIS CE REFUS. Une réponse
  // qui dépend d'une session ne doit jamais tomber dans un cache partagé.
  if (!uid) return jsonResponse({ error: 'connexion requise' }, 401, SANS_CACHE)

  const prefixe = cleIndexProprietaire(uid, '')
  let cles
  try {
    const { blobs } = await store.list({ prefix: prefixe })
    cles = (blobs || []).map((b) => b.key).slice(0, MAX_CARTES_LISTEES)
  } catch (err) {
    console.error('race GET mine blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502, SANS_CACHE)
  }

  // ⚠️ ON FACTURE CE QUE LA LISTE VA COÛTER, PAS CE QU'ELLE VA RENDRE. Une
  // entrée illisible se saute plus bas mais a bien été LUE : le débit se calcule
  // sur les clés listées, pas sur les cartes survivantes, sinon remplir son
  // index d'entrées mortes redeviendrait gratuit.
  debit += cles.length * COUT_OPERATION_MAGASIN

  const cartes = []
  for (const cle of cles) {
    let brut = null
    try {
      brut = await store.get(cle, { type: 'json' })
    } catch {
      continue // une entrée illisible est une entrée morte, pas une panne
    }
    const vivante = entreeVivante(cle, prefixe, brut)
    if (vivante) cartes.push(vivante)
  }
  // Ordre stable et utile par défaut, la plus récente d'abord ; le tri par lieu
  // ou par date appartient à l'écran, qui a la liste entière sous la main.
  cartes.sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)))

  const corps = JSON.stringify({ ok: true, cartes })
  debit += Buffer.byteLength(corps, 'utf8')
  await debiterLecture(store, ip, seau, debit)
  return jsonResponse(corps, 200, SANS_CACHE)
}

// ---- le rattachement : POST /race?claim&id=<id> -----------------------------
//
// « J'ai publié cette carte avant d'avoir un compte, et j'ai toujours le jeton. »
// Le secret voyage dans LE MÊME en-tête et se vérifie par LE MÊME
// `secretMatches` : rattacher, c'est prouver qu'on pouvait déjà l'éditer.
//
// ⚠️ CE QU'IL PROUVE, ET CE QU'IL NE PROUVE PAS. Il prouve la possession d'un
// JETON, pas une identité. Le courriel du dépôt vitrine contient le secret en
// clair : quiconque a reçu ce message transféré peut revendiquer.
//
// ⚠️ LE DERNIER CLAIM PRÉSENTANT UN SECRET VALIDE L'EMPORTE, et l'entrée
// d'index du perdant disparaît. « Premier arrivé, premier propriétaire »
// paraissait prudent ; il punissait en réalité la victime. Qui reçoit un
// courriel transféré et crée un compte le premier possédait la carte À VIE,
// tandis que le vrai organisateur — secret en main — recevait un 409 définitif
// et ne possédait jamais sa propre carte.
//
// Or ce 409 NE PROTÉGEAIT RIEN : le détenteur du secret pouvait de toute façon
// réécrire tout le payload par un PUT. Il perdait la propriété, pas l'écriture.
// Refuser le transfert n'ôtait donc aucun pouvoir au squatteur et en ôtait un
// au légitime.
//
// La règle retenue est celle qui vaut déjà PARTOUT AILLEURS dans ce fichier :
// le secret est l'autorité suprême. Il ouvre le PUT, il ouvre `autorise()`, il
// ouvre le rattachement — et donc il reprend la propriété. Un secret fuité
// reste un problème, mais c'en est UN SEUL, et il se règle là où il se règle
// déjà : en republiant sous un nouvel id.
async function rattacher(req, store, url, verifieCompte) {
  const id = url.searchParams.get('id') || ''
  if (!ID_RE.test(id)) return jsonResponse({ error: 'bad id' }, 400, SANS_CACHE)

  // Son propre seau : voir RATTACHEMENT_CAP.
  if (!(await takeToken(store, clientIp(req.headers), Date.now(), 'rlr_', RATTACHEMENT_CAP))) {
    return jsonResponse({ error: 'trop de rattachements, réessayez dans quelques minutes' }, 429, SANS_CACHE)
  }

  let blob
  try {
    blob = await store.get(id, { type: 'json' })
  } catch (err) {
    console.error('race claim blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502, SANS_CACHE)
  }
  if (!blob) return jsonResponse({ error: 'not found' }, 404, SANS_CACHE)

  // Le jeton d'abord : inutile de déranger Supabase pour quelqu'un qui ne
  // détient pas le secret. Et un blob d'avant les jetons n'a pas de condensat —
  // `secretMatches` referme la porte, il ne l'ouvre jamais par défaut.
  if (!secretMatches(req.headers.get(SECRET_HEADER), blob.secretHash)) {
    return jsonResponse({ error: 'clé de modification invalide' }, 403, SANS_CACHE)
  }

  const uid = identifiantCompte(await verifieCompte(req))
  if (!uid) return jsonResponse({ error: 'connexion requise' }, 401, SANS_CACHE)

  // ⚠️ « ILLISIBLE » N'EST PAS « ABSENT ». Un propriétaire présent mais que
  // COMPTE_RE refuse ne peut pas être transféré proprement — sa clé d'index est
  // introuvable, donc son entrée resterait derrière lui. On refuse.
  const enPlace = proprietaireDuBlob(blob.ownerId)
  if (enPlace.present && !enPlace.uid) {
    console.error('[race] claim refusé : ownerId illisible sur', id)
    return jsonResponse({ error: 'propriétaire de cette carte illisible' }, 409, SANS_CACHE)
  }
  const dejaA = enPlace.uid

  // Le blob d'abord, l'index ensuite — toujours (voir la doctrine plus haut).
  // Rattacher une carte déjà à soi repasse par là sans dommage : c'est aussi ce
  // qui répare un index perdu.
  if (dejaA !== uid) {
    try {
      await store.setJSON(id, { ...blob, ownerId: uid })
    } catch (err) {
      console.error('race claim blobs error:', err)
      return jsonResponse({ error: 'storage unavailable' }, 502, SANS_CACHE)
    }
  }
  await noterAuJournalDuCompte(store, uid, id, blob)
  // ⚠️ ET SEULEMENT ENSUITE le ménage chez le perdant : si cette suppression
  // partait en premier et que la pose échouait, la carte ne serait plus listée
  // NULLE PART. On préfère deux lignes une seconde à zéro ligne pour toujours.
  if (dejaA && dejaA !== uid) await effacerDuJournalDuCompte(store, dejaA, id)

  return jsonResponse({ ok: true, id }, 200, SANS_CACHE)
}

// Le magasin est injecté plutôt que construit ici — la fonction Netlify le
// fournit juste en dessous, les tests un équivalent en mémoire. C'est ce qui
// rend le chemin d'écriture entier (jeton compris) vérifiable sans réseau.
//
// `verifieCompte` est injecté comme le magasin l'est, et pour la même raison :
// c'est ce qui rend le chemin d'autorisation entier vérifiable sans réseau. En
// production c'est `compteVerifie`, qui rend '' sans le moindre appel quand
// aucun jeton n'est présenté — le cas de l'immense majorité des requêtes.
export async function handleRace(req, store, verifieCompte = compteVerifie) {
  if (req.method === 'OPTIONS') return preflightResponse()

  const url = new URL(req.url)

  if (req.method === 'GET') {
    // « MES CARTES » — la seule lecture qui dépend de QUI demande, et non de
    // l'identifiant demandé. Elle est routée avant tout le reste parce qu'elle
    // n'a pas d'`id`, et elle ne partage pas les en-têtes de cache du GET
    // public : voir SANS_CACHE.
    if (url.searchParams.has('mine')) return mesCartes(req, store, verifieCompte)

    const id = url.searchParams.get('id') || ''
    if (!ID_RE.test(id)) return jsonResponse({ error: 'bad id' }, 400)

    // Le solde se consulte AVANT d'aller chercher le blob : même doctrine que
    // l'écriture, inutile de tirer 4 Mo du magasin pour quelqu'un qu'on va
    // refuser. Voir le bloc « limitation de débit en LECTURE » pour l'arbitrage.
    const ip = clientIp(req.headers)
    const seau = await creditLecture(store, ip)
    if (seau && seau.tokens <= 0) return refusLecture(seau)

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

  // LE RATTACHEMENT SE ROUTE AVANT LE SEAU D'ÉCRITURE, et c'est tout l'objet de
  // sa position ici : il a le sien (RATTACHEMENT_CAP), sans quoi remonter
  // cinquante cartes s'arrêterait à la treizième.
  if (req.method === 'POST' && url.searchParams.has('claim')) return rattacher(req, store, url, verifieCompte)

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

    // LE POINT D'APPEL UNIQUE DE L'AUTORISATION. Il n'y en avait qu'un, il n'y
    // en a toujours qu'un ; seule la fonction appelée a gagné un second chemin.
    if (!(await autorise(req, existing, verifieCompte))) {
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
    // L'index se rafraîchit ici — le nom et le lieu ont pu changer — et c'est
    // au passage ce qui RÉPARE une entrée que la publication n'avait pas réussi
    // à écrire. Un cache reconstructible se reconstruit à la première occasion.
    // ⚠️ Le propriétaire vient du BLOB, jamais de la session : corriger une
    // carte anonyme ne se l'approprie pas.
    await noterAuJournalDuCompte(store, identifiantCompte(payload.ownerId), id, payload)
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
  // La session, s'il y en a une. Consultée APRÈS la validation du corps : on ne
  // fait pas payer un aller-retour Supabase à une requête qu'on va refuser.
  // Publier sans compte reste le cas nominal, et rend '' sans appel réseau.
  const proprietaire = identifiantCompte(await verifieCompte(req))
  // `undefined` disparaît à la sérialisation : une carte sans compte sort du
  // magasin exactement comme avant, sans champ `ownerId` vide qui traînerait.
  const payload = { ...fields, secretHash: hashSecret(secret), createdAt: now, updatedAt: now, ownerId: proprietaire || undefined }
  try {
    await store.setJSON(id, payload)
  } catch (err) {
    console.error('race POST blobs error:', err)
    return jsonResponse({ error: 'storage unavailable' }, 502)
  }
  // L'INDEX EN SECOND, ET SANS DROIT DE VETO. La carte est publiée, son lien
  // est valide ; un index manquant ne coûte qu'une ligne absente d'un panneau,
  // et se rattrape à la correction suivante.
  await noterAuJournalDuCompte(store, proprietaire, id, payload)

  return jsonResponse({ ok: true, id, secret }, 201)
}

export default async (req) => handleRace(req, getStore({ name: 'race-payloads', consistency: 'strong' }))
