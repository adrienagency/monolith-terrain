// LE PROFIL DE VÉRIFICATION « TESTOUILLE »
//
// À quoi sert ce fichier : prouver que les cartes d'une personne lui reviennent
// quand elle se reconnecte. Toute la chaîne existe déjà — l'index
// `owner/<uid>/<id>` de netlify/functions/race.mjs, le mode `?mine=1`,
// l'adaptateur src/compte-app.js, le panneau « Mes créations » de
// src/ui/compte.js — mais rien ne l'avait jamais parcourue de bout en bout avec
// de vraies cartes appartenant à un vrai propriétaire.
//
// ═══════════════════════════════════════════════════════════════════════════
// ON SIMULE L'IDENTITÉ, JAMAIS LES DONNÉES
// ═══════════════════════════════════════════════════════════════════════════
//
// Ouvrir un vrai compte demande une vraie adresse et un vrai code reçu par
// courriel ; la clé `service_role` qui permettrait d'en fabriquer un par l'API
// n'est délibérément pas posée. La seule chose qu'on feint est donc la SESSION :
// un faux Supabase, sur la boucle locale, répond « oui, ce jeton est
// testouille » — exactement comme le vrai service le ferait.
//
// TOUT LE RESTE EST RÉEL, et c'est ce qui rend la preuve valable :
//   · les cartes sont publiées par `POST /race`, le vrai chemin, sans
//     passe-droit ni écriture directe dans le magasin ;
//   · elles sont rangées dans le vrai magasin de blobs ;
//   · leur index `owner/<uid>/<id>` est écrit par le code de production, pas
//     par ce script ;
//   · `compteVerifie` (netlify/functions/_compte.mjs) tourne SANS AUCUNE
//     modification : il interroge l'URL qu'on lui a donnée, un point c'est tout.
//
// Si la liste remonte à l'écran, c'est donc que la chaîne entière fonctionne.
// Une preuve où l'on aurait aussi feint les données ne prouverait que l'affichage.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ CE SCRIPT NE PEUT PAS TOURNER CONTRE LA PRODUCTION — TROIS VERROUS
// ═══════════════════════════════════════════════════════════════════════════
//
// C'est le genre d'outil qui finit lancé par erreur sur le vrai magasin, et il
// y sèmerait des cartes fantômes que personne ne saurait retrouver ni effacer
// (le secret d'édition n'est rendu qu'une fois). D'où trois verrous
// INDÉPENDANTS, dont aucun ne se contourne par une option de ligne de commande :
//
//   1. LISTE BLANCHE DE BOUCLE LOCALE. L'hôte visé doit être `localhost`,
//      `127.0.0.1` ou `::1`, et le protocole `http:`. C'est une liste blanche et
//      non une liste noire : interdire « shibumap.com » laisserait passer
//      l'adresse d'un déploiement de prévisualisation, une IP publique, un nom
//      d'hôte interne. Aucun drapeau ne l'élargit.
//
//   2. REFUS DANS UN ENVIRONNEMENT NETLIFY. `NETLIFY`, `CONTEXT`, `DEPLOY_URL`,
//      `URL`, `SITE_ID` : la présence d'une seule de ces variables signifie
//      qu'on tourne dans une construction ou un déploiement, et pas sur la
//      machine de quelqu'un.
//
//   3. LE VERROU QUI COMPTE VRAIMENT — L'IDENTITÉ EST ÉPROUVÉE AVANT LA
//      PREMIÈRE ÉCRITURE. Le script commence par demander `GET /race?mine=1`
//      avec le jeton de testouille. Un serveur branché sur le VRAI Supabase
//      répondra 401 : ce jeton n'y désigne personne, et il n'existe aucun moyen
//      de le lui faire accepter. Le script s'arrête alors sans avoir rien
//      publié. Autrement dit, la seule cible où ce script peut écrire est celle
//      qui reconnaît une identité que seul le faux service sait délivrer.
//      Les verrous 1 et 2 sont la ceinture ; celui-ci est la vraie serrure.
//
// ═══════════════════════════════════════════════════════════════════════════
// COMMENT S'EN SERVIR
// ═══════════════════════════════════════════════════════════════════════════
//
//   1)  node scripts/profil-testouille.mjs identite
//       → le faux service d'identité, sur http://127.0.0.1:5599 (bloquant).
//
//   2)  SUPABASE_URL=http://127.0.0.1:5599 SUPABASE_ANON_KEY=cle-de-verification \
//       npx netlify dev --offline --port 8888
//       → l'application + les fonctions, avec un magasin de blobs LOCAL.
//
//   3)  node scripts/profil-testouille.mjs semer
//       → quatre cartes basiques (sans tracé) pour testouille, à quatre lieux.
//       node scripts/profil-testouille.mjs semer --qui autrui
//       → une carte pour un AUTRE compte : elle ne doit JAMAIS apparaître dans
//         la liste de testouille.
//
//   4)  node scripts/profil-testouille.mjs session
//       → la ligne à coller dans la console du navigateur pour feindre la
//         session de testouille (c'est exactement la forme que src/compte.js
//         range dans `localStorage`, rien de plus).

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { buildPalettePool, pickShufflePalette } from '../src/shuffle-pool.js'
import { TEMPLATES } from '../src/templates.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── LES IDENTITÉS ───────────────────────────────────────────────────────────
//
// La forme est celle que `COMPTE_RE` de race.mjs exige (`[A-Za-z0-9-]{8,64}`) et
// elle a la silhouette d'un UUID, mais elle se lit en clair dans une clé de
// magasin : `owner/testouille-…/<id>`. Quand on inspecte le magasin, on voit
// tout de suite ce qui est du décor de vérification et ce qui ne l'est pas.
const UID_TESTOUILLE = 'testouille-0000-4000-8000-000000000001'
const UID_AUTRUI = 'autrui-0000-4000-8000-000000000002'

// ⚠️ LE FAUX SERVICE N'AUTHENTIFIE QUE CES DEUX-LÀ. Un stub qui rendrait
// n'importe quel `sub` serait une machine à fabriquer des propriétaires : le
// jour où quelqu'un le laisse tourner à côté d'autre chose, il vaut mieux qu'il
// ne sache dire oui qu'à deux identifiants écrits ici en toutes lettres.
const IDENTITES = new Map([
  [UID_TESTOUILLE, 'testouille@verification.invalid'],
  [UID_AUTRUI, 'autrui@verification.invalid'],
])

const PORT_IDENTITE = 5599
const BASE_DEFAUT = 'http://127.0.0.1:8888'
const CLE_PUBLIQUE = 'cle-de-verification'

// ── LE JETON ────────────────────────────────────────────────────────────────
//
// Trois segments base64url séparés par des points : la forme que `JETON_RE`
// accepte des deux côtés (src/compte.js et netlify/functions/_compte.mjs). Il
// n'est SIGNÉ PAR RIEN — et c'est sans conséquence, puisque la vérification de
// signature n'a jamais lieu ici : le serveur ne fait que présenter le jeton au
// service d'identité, qui est justement celui qu'on remplace.
const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')

export function jetonDe(uid) {
  const entete = b64url({ alg: 'none', typ: 'JWT' })
  const charge = b64url({ sub: uid, aud: 'authenticated', email: IDENTITES.get(uid) || '', iss: 'profil-testouille' })
  return `${entete}.${charge}.jeton-de-verification-sans-signature`
}

// ══════════ VERROU 1 : LA BOUCLE LOCALE, ET RIEN D'AUTRE ════════════════════

const HOTES_AUTORISES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function baseAutorisee(brut) {
  let u
  try {
    u = new URL(brut)
  } catch {
    return { ok: false, pourquoi: `« ${brut} » n'est pas une adresse lisible.` }
  }
  if (u.protocol !== 'http:') {
    return { ok: false, pourquoi: `protocole « ${u.protocol} » refusé : un serveur de vérification est en clair sur la boucle locale.` }
  }
  if (!HOTES_AUTORISES.has(u.hostname)) {
    return { ok: false, pourquoi: `hôte « ${u.hostname} » refusé : seule la boucle locale est autorisée (${[...HOTES_AUTORISES].join(', ')}).` }
  }
  return { ok: true, base: u.origin }
}

// ══════════ VERROU 2 : PAS DANS UN ENVIRONNEMENT NETLIFY ════════════════════

const VARIABLES_INTERDITES = ['NETLIFY', 'CONTEXT', 'DEPLOY_URL', 'DEPLOY_PRIME_URL', 'URL', 'SITE_ID', 'SITE_NAME']

export function environnementDeMachine(env = process.env) {
  const vues = VARIABLES_INTERDITES.filter((v) => env[v])
  return vues.length
    ? { ok: false, pourquoi: `variables d'environnement Netlify présentes (${vues.join(', ')}) : ce script ne tourne que sur une machine de développement.` }
    : { ok: true }
}

// ══════════ LE FAUX SERVICE D'IDENTITÉ ══════════════════════════════════════
//
// Il n'implémente qu'UNE route, `GET /auth/v1/user`, parce que c'est la seule
// que `compteVerifie` appelle. Sa réponse a exactement la forme que ce dernier
// exige : `aud === 'authenticated'` en strict, et un `id` de 8 à 64 caractères.
// Le reste de ce que GoTrue rendrait n'a aucun lecteur, donc n'existe pas ici.
function lireSub(jeton) {
  const parts = String(jeton).split('.')
  if (parts.length !== 3) return ''
  try {
    const charge = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof charge?.sub === 'string' ? charge.sub : ''
  } catch {
    return ''
  }
}

function servirIdentite(port) {
  const serveur = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const repondre = (statut, corps) => {
      const texte = JSON.stringify(corps)
      res.writeHead(statut, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texte) })
      res.end(texte)
    }
    if (url.pathname !== '/auth/v1/user') return repondre(404, { message: 'route inconnue' })
    // Supabase exige les DEUX en-têtes ; on refuse pareil, sinon le stub
    // validerait un chemin que la production refuserait.
    if (!req.headers.apikey) return repondre(401, { message: 'apikey manquante' })
    const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim())
    if (!m) return repondre(401, { message: 'jeton absent' })
    const sub = lireSub(m[1])
    if (!IDENTITES.has(sub)) return repondre(401, { message: 'jeton inconnu de ce service de vérification' })
    process.stdout.write(`[identite] jeton reconnu → ${sub}\n`)
    return repondre(200, { id: sub, aud: 'authenticated', email: IDENTITES.get(sub), role: 'authenticated' })
  })
  // ⚠️ SUR LA BOUCLE LOCALE UNIQUEMENT. Écouter sur 0.0.0.0 exposerait au
  // réseau local une machine qui dit « oui » à un jeton non signé.
  serveur.listen(port, '127.0.0.1', () => {
    process.stdout.write(`[identite] faux Supabase à l'écoute sur http://127.0.0.1:${port}\n`)
    process.stdout.write(`[identite] identités connues : ${[...IDENTITES.keys()].join(', ')}\n`)
  })
}

// ══════════ LES CARTES SEMÉES ═══════════════════════════════════════════════
//
// « Vraiment basiques », mot pour mot : AUCUN TRACÉ GPX. Le serveur l'accepte
// explicitement — « la trace est FACULTATIVE : une carte sans course se partage
// aussi » (readWriteBody dans race.mjs) — et c'est la carte la plus ordinaire
// qui soit : un lieu, un look, un nom.
//
// Quatre lieux réels et VOLONTAIREMENT ÉPARPILLÉS, parce que le tri « par lieu »
// du panneau doit avoir quelque chose à trier : un hémisphère sud, une latitude
// à un seul chiffre (le cas précis qui cassait l'ancien tri par chaîne), et deux
// nords bien séparés. L'ordre par lieu qui en découle n'est celui d'aucune date.
const LIEUX_TESTOUILLE = [
  { nom: 'Chamonix au petit matin', lat: 45.9237, lon: 6.8694, zoom: 12 },
  { nom: 'Landmannalaugar, Islande', lat: 63.99, lon: -19.06, zoom: 11 },
  { nom: 'Kilimandjaro, versant sud', lat: -3.0674, lon: 37.3556, zoom: 11 },
  { nom: 'Fuji-san', lat: 35.3606, lon: 138.7274, zoom: 12 },
]

// La carte de l'AUTRE compte. Son nom le dit à l'écran : si cette ligne
// apparaît un jour dans « Mes créations » de testouille, la fuite se voit sans
// avoir à lire un identifiant.
const LIEUX_AUTRUI = [{ nom: 'Cap Nord — carte d’un AUTRE compte', lat: 71.171, lon: 25.784, zoom: 10 }]

// Un générateur pseudo-aléatoire À GRAINE : le tirage reste « au hasard » au
// sens du bouton dé (c'est la réserve de src/shuffle-pool.js, la vraie), mais
// deux exécutions du script donnent les mêmes palettes — un rapport de
// vérification qui ne se rejoue pas à l'identique ne se relit pas.
function graine(n) {
  let s = n >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function reserveDePalettes() {
  let boutique = []
  try {
    const j = JSON.parse(readFileSync(path.join(RACINE, 'public/templates/data.json'), 'utf8'))
    if (Array.isArray(j?.palettes)) boutique = j.palettes
  } catch {
    // Le catalogue absent n'est pas une panne : les générateurs procéduraux de
    // palette.js suffisent à remplir la réserve, exactement comme dans
    // l'application quand le réseau ne répond pas.
  }
  return buildPalettePool({ shop: boutique, builtins: Object.values(TEMPLATES) })
}

// L'état d'une carte, dans la forme que `parseShareState` (src/share-link.js)
// sait relire — c'est elle qui rouvrira la carte chez le destinataire, et c'est
// `state.loc` que race.mjs recopie dans l'entrée d'index sous le nom `lieu`.
function etatDeCarte(lieu, palette) {
  return {
    format: 'shibumap-share',
    v: 1,
    loc: { lat: lieu.lat, lon: lieu.lon, zoom: lieu.zoom },
    cam: null,
    look: {
      rampStops: palette.rampStops,
      oceanShallow: palette.oceanShallow,
      oceanMid: palette.oceanMid,
      oceanDeep: palette.oceanDeep,
    },
  }
}

// ══════════ LES APPELS AU SERVEUR ═══════════════════════════════════════════

const routeRace = (base) => `${base}/.netlify/functions/race`

async function listerMesCartes(base, uid) {
  const rep = await fetch(`${routeRace(base)}?mine=1`, {
    headers: { authorization: `Bearer ${jetonDe(uid)}`, accept: 'application/json' },
  })
  let corps = null
  try {
    corps = await rep.json()
  } catch {}
  return { statut: rep.status, cartes: Array.isArray(corps?.cartes) ? corps.cartes : null, corps }
}

async function publier(base, uid, lieu, palette) {
  const rep = await fetch(routeRace(base), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${jetonDe(uid)}`,
    },
    // ⚠️ PAS DE `gpx`. C'est la carte basique demandée, et c'est aussi ce qui
    // vérifie au passage qu'une carte sans course s'indexe comme les autres.
    body: JSON.stringify({ raceName: lieu.nom, state: etatDeCarte(lieu, palette) }),
  })
  const corps = await rep.json().catch(() => null)
  if (rep.status !== 201 || !corps?.id) {
    throw new Error(`publication refusée (${rep.status}) : ${JSON.stringify(corps)}`)
  }
  return corps.id
}

// ══════════ LA COMMANDE « SEMER » ═══════════════════════════════════════════

async function semer({ base, uid, encore }) {
  const lieux = uid === UID_AUTRUI ? LIEUX_AUTRUI : LIEUX_TESTOUILLE

  // ── VERROU 3 : l'identité doit déjà être reconnue, AVANT toute écriture ──
  const avant = await listerMesCartes(base, uid).catch((err) => {
    throw new Error(`${base} ne répond pas (${err.message}). Le serveur de vérification est-il lancé ?`)
  })
  if (avant.statut !== 200) {
    throw new Error(
      `l'identité de vérification n'est PAS reconnue par ${base} (HTTP ${avant.statut}).\n` +
        `        C'est le troisième verrou : une cible branchée sur le vrai Supabase répond 401 ici,\n` +
        `        et le script s'arrête avant d'avoir publié quoi que ce soit.\n` +
        `        Lance « node scripts/profil-testouille.mjs identite » puis « netlify dev » avec\n` +
        `        SUPABASE_URL=http://127.0.0.1:${PORT_IDENTITE} et SUPABASE_ANON_KEY=${CLE_PUBLIQUE}.`,
    )
  }
  if (avant.cartes.length && !encore) {
    process.stdout.write(
      `Ce compte a déjà ${avant.cartes.length} carte(s). Rien n'a été semé — relance avec --encore pour en ajouter.\n`,
    )
    for (const c of avant.cartes) process.stdout.write(`  · ${c.id}  ${c.nom}\n`)
    return
  }

  const pool = reserveDePalettes()
  const rng = graine(uid === UID_AUTRUI ? 20260808 : 7301)
  process.stdout.write(`Réserve de palettes : ${pool.length} entrées (boutique + templates + générateurs).\n`)

  for (const lieu of lieux) {
    const palette = pickShufflePalette(rng, pool)
    const id = await publier(base, uid, lieu, palette)
    process.stdout.write(
      `  publiée  ${id}  « ${lieu.nom} »  ${lieu.lat}/${lieu.lon}  palette ${palette.kind}/${palette.name}\n`,
    )
  }

  const apres = await listerMesCartes(base, uid)
  process.stdout.write(`\n${apres.cartes.length} carte(s) dans l'index de ${uid} :\n`)
  for (const c of apres.cartes) {
    const l = c.lieu ? `${c.lieu.lat}, ${c.lieu.lon}` : 'sans lieu'
    process.stdout.write(`  · ${c.id}  ${c.nom}  [${l}]  ${c.creeLe}\n`)
  }
}

// ══════════ LA COMMANDE « SESSION » ═════════════════════════════════════════
//
// Ce que src/compte.js range dans `localStorage` après une connexion réussie, ni
// plus ni moins (voir `sessionRelue` : jeton, renouvellement, échéance,
// courriel). L'échéance est posée loin devant pour qu'aucun renouvellement ne
// parte — il n'y a pas de service à qui le demander.
function session(uid) {
  const valeur = {
    jeton: jetonDe(uid),
    renouvellement: 'renouvellement-de-verification',
    expireA: Date.now() + 365 * 24 * 3600 * 1000,
    courriel: IDENTITES.get(uid),
  }
  process.stdout.write(
    `localStorage.setItem('shibumap.compte.session', ${JSON.stringify(JSON.stringify(valeur))}); location.reload()\n`,
  )
}

// ══════════ L'ENTRÉE ════════════════════════════════════════════════════════

function principal(argv) {
  const commande = argv[0] || 'aide'
  const opt = (nom, defaut) => {
    const i = argv.indexOf(`--${nom}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : defaut
  }
  const qui = opt('qui', 'testouille') === 'autrui' ? UID_AUTRUI : UID_TESTOUILLE

  const machine = environnementDeMachine()
  if (!machine.ok) {
    process.stderr.write(`REFUS : ${machine.pourquoi}\n`)
    process.exitCode = 1
    return
  }

  if (commande === 'identite') return servirIdentite(Number(opt('port', PORT_IDENTITE)))
  if (commande === 'session') return session(qui)

  if (commande === 'semer') {
    const verdict = baseAutorisee(opt('base', BASE_DEFAUT))
    if (!verdict.ok) {
      process.stderr.write(`REFUS : ${verdict.pourquoi}\n`)
      process.exitCode = 1
      return
    }
    return semer({ base: verdict.base, uid: qui, encore: argv.includes('--encore') }).catch((err) => {
      process.stderr.write(`ÉCHEC : ${err.message}\n`)
      process.exitCode = 1
    })
  }

  process.stdout.write(
    [
      'Profil de vérification « testouille » — voir l’en-tête du fichier.',
      '',
      '  node scripts/profil-testouille.mjs identite [--port 5599]',
      '  node scripts/profil-testouille.mjs semer [--base http://127.0.0.1:8888] [--qui testouille|autrui] [--encore]',
      '  node scripts/profil-testouille.mjs session [--qui testouille|autrui]',
      '',
    ].join('\n'),
  )
}

// Importable sans rien lancer : les tests relisent `baseAutorisee` et
// `environnementDeMachine` sans démarrer de serveur ni publier de carte.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2))
}

export { UID_TESTOUILLE, UID_AUTRUI, PORT_IDENTITE, CLE_PUBLIQUE, LIEUX_TESTOUILLE, LIEUX_AUTRUI }
