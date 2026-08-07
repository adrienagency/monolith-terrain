// ═══════════════════════════════════════════════════════════════════════════
// L'ADAPTATEUR DU COMPTE — le seul endroit où la session et les écrans se
// parlent
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux moitiés ont été écrites séparément et ne se connaissaient pas :
//   · `src/compte.js` — la SESSION. Il rend des objets `{ ok:false, raison,
//     erreur }`, ne lève jamais, ne connaît ni le DOM ni les cartes.
//   · `src/ui/compte.js` — les QUATRE ÉCRANS. Ils attendent des promesses qui
//     REJETTENT `{ code }`, une liste de cartes déjà prête à afficher, et deux
//     méthodes (export, suppression) que la session n'a jamais eues.
//
// Ce fichier est le pont, et il est le SEUL. Le contrat qu'il remplit est écrit
// en tête de src/ui/compte.js, mot pour mot :
//
//   estConnecte() · adresse() · surChangement(fn) → désabonnement
//   deconnecter() · demanderCode(adresse) · verifierCode(adresse, code)
//   mesCartes() · exporterMesDonnees() · supprimerMonCompte()
//
// ───────────────────────────────────────────────────────────────────────────
// ⚠️ POURQUOI ÇA REJETTE AU LIEU DE RENDRE { ok:false }
// ───────────────────────────────────────────────────────────────────────────
//
// Les quatre écrans sont déjà écrits, et tous les quatre disent la même chose :
// `try { await compte.demanderCode(a) } catch (e) { err.textContent =
// messageRefus(e) }`. Un `{ ok:false }` rendu au lieu d'être levé passerait
// dans la branche du SUCCÈS : l'écran du code s'ouvrirait sur un envoi qui n'a
// jamais eu lieu, sans un mot. C'est le contrat de l'interface, pas une
// préférence de style — la traduction se fait ici, une fois.
//
// ───────────────────────────────────────────────────────────────────────────
// ⚠️ LE LIEN D'UNE CARTE SE FABRIQUE ICI, JAMAIS AU SERVEUR
// ───────────────────────────────────────────────────────────────────────────
//
// `race?mine=1` ne rend qu'un `id`, et c'est délibéré : un attaquant l'a
// relevé. Une chaîne d'URL venue du réseau qu'on poserait telle quelle dans le
// `href` d'un `<a>` — et « Mes cartes » en pose une par ligne — accepterait un
// `javascript:` ou un `data:` glissé dans un magasin de blobs. On ne recopie
// donc RIEN : l'id passe par `ID_RE` (le miroir exact de celui de race.mjs) et
// le lien est CONSTRUIT autour. Un id qui ne passe pas ne donne pas de ligne.
//
// ───────────────────────────────────────────────────────────────────────────
// LES CODES DE REFUS
// ───────────────────────────────────────────────────────────────────────────
//
// Ce module ne traduit pas les codes de `src/compte.js` : il les LAISSE PASSER.
// C'est possible depuis que les deux tables sont alignées (voir le commentaire
// « un code, un sens » de src/compte.js), et test/comptes-cohesion.test.js
// échoue si l'une des deux dérive. Les codes que ce fichier émet en propre —
// `injoignable`, `trop-essais` — sont soumis au MÊME test.

import { creerCompte } from './compte.js'
import { loadUserTemplates } from './templates-user.js'

// ── Les routes, et la seule origine à laquelle un lien public a un sens ──────

/** « Mes cartes » : l'index du compte, jamais les payloads (voir race.mjs). */
export const URL_MES_CARTES = '/.netlify/functions/race?mine=1'
export const URL_SUPPRESSION = '/.netlify/functions/compte-supprimer'

/**
 * ⚠️ L'ORIGINE EST EN DUR, et ce n'est pas un oubli. Un lien de « Mes cartes »
 * est fait pour être COPIÉ et envoyé à trois cents coureurs : construit sur
 * `location.origin`, il vaudrait `http://localhost:5173/#r=…` en développement
 * et `https://un-deploy-preview--….netlify.app/#r=…` sur une prévisualisation
 * — deux adresses parfaitement mortes une fois collées dans un message.
 */
export const ORIGINE_PARTAGE = 'https://shibumap.com'

// Le miroir de `ID_RE` de netlify/functions/race.mjs. La fonction ne peut pas
// importer depuis src/ (voir son en-tête), donc la règle est écrite deux fois
// plutôt que partagée — et c'est ici la SEULE forme d'id qui aura le droit
// d'entrer dans un `href`.
const ID_RE = /^[A-Za-z0-9]{6,16}$/

// Le même plafond que MAX_CARTES_LISTEES côté serveur. Il n'y a pas de raison
// que la réponse déborde ; s'il arrivait qu'elle déborde, ce n'est pas l'écran
// qui doit l'apprendre en dessinant dix mille lignes.
const MAX_CARTES = 500

// ══════════ CE QUI EST PUR, ET DONC TESTABLE SANS RIEN ══════════════════════

/** Le lien public d'une carte, ou '' si l'id n'est pas un id. */
export function lienDeCarte(id) {
  return typeof id === 'string' && ID_RE.test(id) ? `${ORIGINE_PARTAGE}/#r=${id}` : ''
}

/**
 * Le lieu, tel qu'on le lit dans une ligne.
 *
 * Le serveur ne connaît pas de nom de commune — il n'a que la position du bloc
 * chargé (voir `entreeIndex` dans race.mjs). On rend donc des coordonnées, mais
 * écrites comme on les lit : deux décimales (≈ 1 km, la précision d'un « où
 * c'était »), virgule décimale française, et les points cardinaux plutôt qu'un
 * signe moins que personne ne décode.
 */
export function lieuLisible(lieu) {
  const nombre = (v) => typeof v === 'number' && Number.isFinite(v)
  if (!lieu || typeof lieu !== 'object' || !nombre(lieu.lat) || !nombre(lieu.lon)) return ''
  if (Math.abs(lieu.lat) > 90 || Math.abs(lieu.lon) > 180) return ''
  const ecrit = (v, positif, negatif) =>
    `${Math.abs(v).toFixed(2).replace('.', ',')}° ${v >= 0 ? positif : negatif}`
  return `${ecrit(lieu.lat, 'N', 'S')} ${ecrit(lieu.lon, 'E', 'O')}`
}

/**
 * Une entrée d'index du serveur → une ligne affichable, ou `null`.
 *
 * ⚠️ AUCUN CHAMP N'EST RECOPIÉ SANS ÊTRE REGARDÉ. `nom` finit dans un nœud
 * texte (donc inoffensif, mais borné quand même), `lieu` est REFABRIQUÉ à
 * partir de deux nombres, et `url` est refabriquée à partir du seul id — un
 * champ `url` que le serveur enverrait est purement et simplement ignoré.
 */
export function carteAffichable(brut) {
  const id = typeof brut?.id === 'string' ? brut.id : ''
  const url = lienDeCarte(id)
  if (!url) return null
  return {
    id,
    nom: typeof brut?.nom === 'string' ? brut.nom.slice(0, 120) : '',
    lieu: lieuLisible(brut?.lieu),
    // `creeLe` est une chaîne ISO ; l'écran accepte l'ISO comme les
    // millisecondes (voir `quand()` dans src/ui/compte.js).
    publieeLe: typeof brut?.creeLe === 'string' ? brut.creeLe : '',
    url,
  }
}

/**
 * LE FICHIER D'EXPORT, composé de ce qu'on a déjà.
 *
 * ⚠️ AUCUNE FONCTION SERVEUR N'EST NÉCESSAIRE, et c'est le point : tout ce
 * qu'un compte ShibuMap contient tient dans trois choses déjà sous la main —
 * l'adresse (dans la session), les cartes (l'index, qu'on vient de lire pour
 * le panneau), les gabarits (le `localStorage` de cette machine). Écrire une
 * route pour recomposer côté serveur ce qui est déjà côté navigateur, ce serait
 * une fonction de plus à tenir, à limiter en débit et à authentifier, pour
 * strictement zéro information supplémentaire.
 */
export function composerExport({ adresse = '', cartes = [], gabarits = [], quand = '' } = {}) {
  return {
    format: 'shibumap-mes-donnees',
    v: 1,
    exporteLe: quand,
    compte: { adresse },
    cartes: (Array.isArray(cartes) ? cartes : []).map((c) => ({
      id: c?.id ?? '',
      nom: c?.nom ?? '',
      lieu: c?.lieu ?? '',
      publieeLe: c?.publieeLe ?? '',
      url: c?.url ?? '',
    })),
    // Les gabarits partent TELS QUELS : c'est ce qui rend le fichier
    // ré-importable par la bibliothèque, et un export qu'on ne peut pas relire
    // n'est pas un export, c'est une capture d'écran en JSON.
    gabarits: Array.isArray(gabarits) ? gabarits.filter((g) => g && g.look) : [],
  }
}

/** Le nom du fichier : daté, et sans un caractère qui fâche un système. */
export function nomFichierExport(instant) {
  const d = new Date(instant)
  const jour = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : 'sans-date'
  return `shibumap-mes-donnees-${jour}.json`
}

// ══════════ LE REFUS, EN UNE SEULE FORME ════════════════════════════════════
//
// Une `Error` porteuse d'un `.code`, plutôt qu'un objet nu : les écrans ne
// lisent que `e?.code` (les deux conviennent), mais une `Error` laisse une pile
// dans la console quand ça part de travers en production, et ne déclenche pas
// les gardes « throw non-Error » des outils. `message` reste le texte français
// que src/compte.js avait déjà rédigé, quand il y en a un.
class RefusCompte extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'RefusCompte'
    this.code = code
  }
}

const refus = (code, message) => new RefusCompte(code, message)

/** Le refus de `src/compte.js` → celui des écrans. Le code passe TEL QUEL. */
const refusDe = (r) => refus(r?.raison || 'injoignable', r?.erreur || '')

// ══════════ LE TÉLÉCHARGEMENT, PAR DÉFAUT ═══════════════════════════════════
//
// Injectable comme tout le reste : c'est la seule ligne de ce fichier qui
// touche le DOM, et la sortir permet de tester l'export entier sous node.
function telechargerJSON(texte, nom) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  // révoquer tout de suite couperait le téléchargement sous Safari
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ══════════ L'ADAPTATEUR ════════════════════════════════════════════════════

/**
 * @param {object} options
 * @param {object}   [options.session]   le client de src/compte.js
 * @param {Function} [options.apporter]  le `fetch` (injectable pour les tests)
 * @param {Function} [options.gabarits]  d'où viennent les gabarits locaux
 * @param {Function} [options.remettreFichier] (texte, nom) → le fichier arrive
 * @param {Function} [options.maintenant]  l'horloge
 */
export function creerCompteApp({
  session = creerCompte(),
  apporter = (...args) => globalThis.fetch(...args),
  urlMesCartes = URL_MES_CARTES,
  urlSuppression = URL_SUPPRESSION,
  gabarits = loadUserTemplates,
  remettreFichier = telechargerJSON,
  maintenant = Date.now,
} = {}) {
  // ── Qui écoute les changements de session ─────────────────────────────────
  //
  // `src/compte.js` ne prévient personne : il ne connaît pas ses appelants,
  // c'est même sa règle. L'abonnement vit donc ici, et il est déclenché aux
  // DEUX seuls moments où la présence change par une décision de
  // l'utilisateur : une connexion réussie, une déconnexion.
  //
  // ⚠️ CE QU'IL NE COUVRE PAS, ET QUI EST ASSUMÉ : une session qui MEURT toute
  // seule (jeton de renouvellement révoqué côté Supabase) ne déclenche rien —
  // il n'y a aucun événement à écouter pour ça. L'écran s'en aperçoit au
  // prochain geste, qui refuse. Le panneau « Mes cartes » resterait affiché et
  // vide entre-temps ; c'est exactement ce qu'il montre déjà à quelqu'un qui
  // n'a rien publié, donc rien de trompeur.
  const ecouteurs = new Set()
  function prevenir() {
    // une copie : un écouteur a le droit de se désabonner en étant appelé
    for (const fn of [...ecouteurs]) {
      try {
        fn()
      } catch (err) {
        // ⚠️ un écran qui casse ne doit pas emporter les autres, ni la
        // connexion qui vient de réussir
        console.error('[compte] un écouteur a levé :', err)
      }
    }
  }

  function surChangement(fn) {
    if (typeof fn !== 'function') return () => {}
    ecouteurs.add(fn)
    return () => ecouteurs.delete(fn)
  }

  // ── La connexion ──────────────────────────────────────────────────────────

  async function demanderCode(adresse) {
    const r = await session.demanderCode(adresse)
    if (!r?.ok) throw refusDe(r)
  }

  async function verifierCode(adresse, code) {
    const r = await session.verifierCode(adresse, code)
    if (!r?.ok) throw refusDe(r)
    prevenir()
  }

  async function deconnecter() {
    session.deconnecter()
    prevenir()
  }

  // ── « Mes cartes » ────────────────────────────────────────────────────────

  async function mesCartes() {
    const entetes = await session.entetes()
    // Pas de jeton utilisable : pas de liste, et surtout PAS D'APPEL. Le
    // serveur répondrait 401 après avoir débité le forfait de l'IP (voir
    // COUT_APPEL_LISTE dans race.mjs) — se faire refuser sa propre lecture
    // parce qu'on a rechargé une page déconnectée serait absurde.
    if (!entetes.authorization) return []

    let rep
    try {
      rep = await apporter(urlMesCartes, { headers: { ...entetes, accept: 'application/json' } })
    } catch {
      throw refus('injoignable')
    }
    if (rep.status === 429) throw refus('trop-essais')
    let corps = null
    try {
      corps = await rep.json()
    } catch {
      corps = null
    }
    // Le statut d'abord, le corps ensuite — la même règle que src/compte.js.
    if (!rep.ok || !corps?.ok || !Array.isArray(corps.cartes)) throw refus('injoignable')
    return corps.cartes.slice(0, MAX_CARTES).map(carteAffichable).filter(Boolean)
  }

  // ── L'export de mes données ───────────────────────────────────────────────

  async function exporterMesDonnees() {
    if (!session.connecte()) throw refus('injoignable')
    // ⚠️ SI LA LISTE NE VIENT PAS, L'EXPORT N'A PAS LIEU. Livrer un fichier
    // « mes données » amputé de toutes les cartes, sans le dire, c'est pire que
    // ne rien livrer : personne ne relit un export pour vérifier qu'il est
    // complet. Un refus se réessaie ; un fichier faux se garde des années.
    const cartes = await mesCartes()
    const donnees = composerExport({
      adresse: session.courriel(),
      cartes,
      gabarits: gabarits(),
      quand: new Date(maintenant()).toISOString(),
    })
    remettreFichier(JSON.stringify(donnees, null, 2), nomFichierExport(maintenant()))
  }

  // ── La suppression ────────────────────────────────────────────────────────

  async function supprimerMonCompte() {
    const entetes = await session.entetes()
    if (!entetes.authorization) throw refus('injoignable')
    let rep
    try {
      // ⚠️ AUCUN CORPS. La fonction serveur ne supprime que le compte de
      // l'appelant, celui que son propre jeton désigne : lui envoyer un
      // identifiant serait lui offrir une occasion de le lire un jour.
      rep = await apporter(urlSuppression, {
        method: 'POST',
        headers: { ...entetes, accept: 'application/json' },
      })
    } catch {
      throw refus('injoignable')
    }
    if (rep.status === 429) throw refus('trop-essais')
    if (!rep.ok) throw refus('injoignable')
    // Le compte n'existe plus : la session locale ne doit pas lui survivre une
    // seconde de plus, ni son jeton rester dans ce navigateur.
    session.deconnecter()
    prevenir()
  }

  return {
    estConnecte: () => session.connecte(),
    // `null` et pas '' : le contrat de l'interface le demande, et `null` se
    // distingue à l'œil d'une adresse vide qu'on aurait oublié de remplir.
    adresse: () => session.courriel() || null,
    surChangement,
    deconnecter,
    demanderCode,
    verifierCode,
    mesCartes,
    exporterMesDonnees,
    supprimerMonCompte,
  }
}
