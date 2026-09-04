// LA CONNEXION SANS MOT DE PASSE, CÔTÉ NAVIGATEUR — un code à six chiffres,
// une session qui survit au rechargement, un jeton qui se renouvelle tout seul.
//
// Ce module ne dessine RIEN et ne se branche nulle part. Il rend une API, et
// l'interface viendra par-dessus. Il ne connaît ni le DOM, ni `location`, ni
// `fetch` global obligatoire : le `fetch` et les stockages sont des ARGUMENTS.
// Même contrat que src/paiement.js et src/share-link.js — c'est ce qui permet
// de le tester entièrement sous node, alors que c'est le seul endroit de
// l'application où une erreur enferme quelqu'un dehors.
//
// ═══════════════════════════════════════════════════════════════════════════
// SANS `@supabase/supabase-js`, ET C'EST UNE DÉCISION
// ═══════════════════════════════════════════════════════════════════════════
//
// Trois points d'entrée REST suffisent à toute la connexion :
//
//   POST {url}/auth/v1/otp     { email }                        → envoie le code
//   POST {url}/auth/v1/verify  { email, token, type:'email' }    → ouvre la session
//   POST {url}/auth/v1/token?grant_type=refresh_token            → la renouvelle
//
// Tous exigent l'en-tête `apikey`. Ajouter cent kilo-octets de SDK dans une
// application 3D pour trois `fetch`, ce serait payer au chargement de CHAQUE
// visiteur — dont l'immense majorité n'ouvrira jamais de compte — le confort de
// trois lignes. Le projet a déjà tranché pareil pour Stripe (netlify/functions/
// paiement.mjs parle à l'API en `fetch` nu) : une dépendance de moins, c'est
// une dépendance de moins à tenir à jour.
//
// ⚠️ CE QU'ON REPREND À SA CHARGE, ET QU'IL FAUT DONC ÉCRIRE ICI : la
// persistance de la session, le renouvellement avant expiration, le verrou qui
// empêche dix renouvellements concurrents, et la traduction des refus. C'est
// tout, et c'est ce fichier.
//
// ═══════════════════════════════════════════════════════════════════════════
// OÙ RANGER LA SESSION — `localStorage`, ET VOICI POURQUOI
// ═══════════════════════════════════════════════════════════════════════════
//
// Le choix de manuel serait un cookie `httpOnly`, invisible du JavaScript.
// ⚠️ IL EST EXCLU PAR LE CONTRAT SERVEUR DÉJÀ ÉCRIT : `compteVerifie`
// (netlify/functions/_compte.mjs) n'accepte pour preuve qu'un en-tête
// `Authorization: Bearer …`, qu'il faut donc que ce navigateur sache POSER —
// donc LIRE. Un cookie que le script ne peut pas lire ne peut pas remplir cet
// en-tête. Le débat porte donc sur le reste :
//
//   · MÉMOIRE SEULE — le plus sûr, et invivable. Chaque rechargement (et
//     l'export d'affiche EST une navigation aller-retour chez Stripe)
//     redemanderait un code par courriel. Or Supabase plafonne l'envoi, et
//     chaque message de plus est une occasion de finir en indésirables. On
//     ferait payer un vrai coût d'usage contre un gain théorique.
//   · `sessionStorage` — meurt avec l'onglet, et ne traverse pas les onglets.
//     Même défaut, à peine atténué.
//   · `localStorage` — lisible par tout script de la page. C'est le vrai
//     reproche, et il faut le regarder en face : un script étranger qui
//     s'exécute ici lit ce jeton.
//
// On prend `localStorage`, parce que le reproche ne discrimine pas. Un script
// étranger capable de lire ce stockage y trouve DÉJÀ les jetons d'édition des
// cartes (`shibumap.race.secrets`, voir src/share-link.js), et surtout il peut
// simplement appeler ce module. À ce stade la page entière est à lui : ranger
// le jeton ailleurs déplacerait le vol d'une ligne, pas plus.
//
// Ce qu'on fait à la place, et qui compte vraiment :
//   · le périmètre rangé est MINUSCULE — jeton, renouvellement, échéance,
//     courriel. Pas d'identifiant, pas de métadonnées, rien de récupérable ;
//   · la déconnexion efface POUR DE BON, y compris les traces d'une version
//     précédente (voir `deconnecter`) ;
//   · Supabase fait TOURNER le jeton de renouvellement à chaque usage : le
//     voleur et le propriétaire ne peuvent pas s'en servir tous les deux
//     longtemps, le second des deux se retrouvant déconnecté.
//
// ⚠️ ET CE QU'IL NE FAUT PAS SE RACONTER. Une version de ce commentaire
// affirmait qu'« un vol donne une fenêtre, pas une clé permanente ». C'EST
// FAUX, et un attaquant l'a relevé : le jeton d'accès dure une heure, mais le
// jeton de RENOUVELLEMENT est rangé juste à côté et se représente
// indéfiniment. Qui vole ce stockage vole un accès durable.
//
// La rotation ci-dessus est un signal de DÉTECTION, pas une prévention — elle
// ne fait pas de ce choix un choix sûr, elle en borne les dégâts. Un
// commentaire qui rassure à tort est pire que pas de commentaire : quelqu'un
// s'y fiera pour décider d'autre chose.

export const URL_CONFIG = '/.netlify/functions/compte-config'

/** Une seule clé, et son préfixe sert aussi au ménage de la déconnexion. */
export const PREFIXE_COMPTE = 'shibumap.compte.'
export const CLE_SESSION = `${PREFIXE_COMPTE}session`

/**
 * De combien on renouvelle EN AVANCE.
 *
 * ⚠️ Sans marge, un jeton valide « encore deux secondes » part sur le réseau et
 * revient en 401 : l'appel échoue alors que la session est parfaitement bonne.
 * Une minute couvre largement un aller-retour, et une horloge locale un peu
 * fausse.
 */
export const MARGE_RENOUVELLEMENT_MS = 60_000

// Même forme et mêmes bornes que côté serveur (_compte.mjs) : un JWT, trois
// segments. On ne range pas dans le navigateur ce que le serveur refusera.
const JETON_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const JETON_MAX = 4096
const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ══════════ LES FORMES, VÉRIFIÉES AVANT TOUT RÉSEAU ═════════════════════════

export function courrielValide(brut) {
  if (typeof brut !== 'string') return false
  const c = brut.trim()
  return c.length >= 6 && c.length <= 254 && COURRIEL_RE.test(c)
}

/** Le courriel tel qu'on l'envoie : sans espaces, en minuscules. Supabase
 *  distingue la casse dans certains chemins ; l'utilisateur, jamais. */
export function normaliserCourriel(brut) {
  return typeof brut === 'string' ? brut.trim().toLowerCase() : ''
}

/** Les gens recopient « 123 456 » avec l'espace du courriel : on le tolère. */
export function normaliserCode(brut) {
  return typeof brut === 'string' || typeof brut === 'number'
    ? String(brut).replace(/\s+/g, '')
    : ''
}

export function codeValide(brut) {
  return /^\d{6}$/.test(normaliserCode(brut))
}

/** Même garde que la fonction serveur : c'est vers cette URL que part le
 *  courriel de l'utilisateur, on ne l'accepte pas de confiance. */
function urlSupabaseValide(brut) {
  if (typeof brut !== 'string' || !brut.trim() || brut.length > 200) return false
  try {
    const u = new URL(brut.trim())
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
  } catch {
    return false
  }
}

// ══════════ LES REFUS, EN FRANÇAIS ET PRÊTS À AFFICHER ══════════════════════
//
// ⚠️ SUPABASE RÉPOND EN ANGLAIS, ET SES MESSAGES NE SONT PAS DES MESSAGES
// D'INTERFACE : « Token has expired or is invalid » mélange deux causes qui
// demandent deux gestes différents (redemander un code / recompter les
// chiffres). C'est ici qu'on tranche, une fois, pour tout le monde.
//
// ═══════════════════════════════════════════════════════════════════════════
// UN CODE, UN SENS — LA RÈGLE, ET LE DÉFAUT QU'ELLE VIENT DE CORRIGER
// ═══════════════════════════════════════════════════════════════════════════
//
// Une version de cette table portait un code `courriel` émis pour DEUX choses
// différentes : une adresse mal formée (détectée ici, sans réseau) et un refus
// d'ENVOI venu de Supabase (l'adresse est bonne, le message n'est pas parti).
// Ce sont deux gestes opposés — corriger sa saisie / attendre et réessayer — et
// l'interface a bien DEUX textes pour eux (`adresse-invalide`,
// `envoi-impossible`). Un seul code pour les deux rendait le choix impossible
// depuis l'écran : quelqu'un lisait « vérifie ton adresse » alors que son
// adresse était parfaite.
//
// D'où la règle, et elle vaut pour tout code ajouté ici plus tard :
//   · un code désigne UNE cause et UN geste à faire ;
//   · le TEXTE peut nuancer (voir MSG_RESEAU / MSG_CONFIGURATION plus bas) ;
//   · l'ensemble des codes émis ici est EXACTEMENT celui de la table `REFUS`
//     de src/ui/compte.js — test/comptes-cohesion.test.js échoue si l'un des
//     deux déborde. Ajouter un code sans son texte n'est plus possible en
//     silence.
//
// À l'inverse, `injoignable` couvre trois situations (réseau coupé, Supabase en
// 5xx, comptes non configurés) et ce n'est PAS une entorse : c'est une seule
// cause du point de vue de qui regarde l'écran — le service de comptes ne
// répond pas — et un seul geste : réessayer plus tard. Le détail voyage dans le
// message, pas dans le code.

const MESSAGES = {
  'code-faux': 'Ce code ne correspond pas. Vérifie les six chiffres, ou demande-en un nouveau.',
  // Le cas AMBIGU : Supabase rend le même refus pour un code faux et un code
  // périmé (voir messageRefus). Le texte couvre donc les deux causes et propose
  // les deux gestes, plutôt que d'en affirmer une au hasard.
  'code-refuse': 'Ce code ne passe pas — il est faux, ou il a expiré. Vérifie les six chiffres du dernier message, ou demande-en un nouveau.',
  'trop-essais': 'Trop de tentatives d’affilée. Attends une minute avant d’en redemander un.',
  'adresse-invalide': 'Cette adresse ne ressemble pas à une adresse de courriel.',
  'envoi-impossible': 'Le code n’a pas pu partir. Réessaie dans un instant — ce n’est pas ton adresse qui est en cause.',
  injoignable: 'Le service de comptes ne répond pas. Réessaie dans un moment — ShibuMap s’utilise sans compte en attendant.',
}

// Deux nuances d'`injoignable`. Elles vivent HORS de `MESSAGES` exprès : ce ne
// sont pas des codes, et rien ne doit pouvoir les prendre pour tels — ni un
// écran, ni le test de cohésion.
const MSG_RESEAU = 'Impossible de joindre le service pour l’instant. Vérifie ta connexion, puis réessaie.'
const MSG_CONFIGURATION = 'La connexion aux comptes n’est pas disponible pour l’instant. ShibuMap fonctionne sans, tout est là.'

const refus = (raison, erreur) => ({ ok: false, raison, erreur: erreur || MESSAGES[raison] })

/**
 * Ce qu'il faut dire à l'écran, à partir de ce que Supabase a répondu.
 *
 * @param {number} statut  le code HTTP
 * @param {object|null} corps  le corps JSON de Supabase ({ error_code, msg, … })
 * @param {'envoi'|'verification'} etape  un 400 ne veut pas dire la même chose
 *   selon qu'on demandait un code ou qu'on en vérifiait un.
 */
export function messageRefus(statut, corps, etape = 'verification') {
  const code = String(corps?.error_code || corps?.error || '')
  const texte = String(corps?.msg || corps?.error_description || corps?.message || '')

  if (statut === 429 || /rate.?limit/i.test(code)) {
    // Supabase dit souvent combien de secondes attendre. Le répéter vaut mieux
    // qu'un « réessayez plus tard » qui pousse à marteler le bouton.
    const s = /after (\d+) second/i.exec(texte)
    return refus('trop-essais', s ? `Trop de demandes. Réessaie dans ${s[1]} secondes.` : MESSAGES['trop-essais'])
  }
  if (statut >= 500) return refus('injoignable')
  // ⚠️ UN REFUS À L'ENVOI NE PARLE JAMAIS DE L'ADRESSE. Il n'y a pas encore de
  // code, et l'adresse a DÉJÀ passé `courrielValide` avant que cette requête ne
  // parte : ce qui a échoué, c'est l'envoi. Dire « vérifie ton adresse » à
  // quelqu'un dont l'adresse est bonne l'envoie corriger ce qui marche.
  if (etape === 'envoi') return refus('envoi-impossible')

  // ⚠️ SUPABASE NE DISTINGUE PAS UN CODE FAUX D'UN CODE EXPIRÉ, et cette
  // branche a longtemps fait semblant du contraire.
  //
  // Vérifié contre le vrai service le 2026-08-08 : un code inexistant rend
  // `403 { error_code: 'otp_expired', msg: 'Token has expired or is invalid' }`
  // — le MÊME code et le MÊME message que pour un code périmé. Le test
  // `/expired/i` correspondait donc TOUJOURS, et `code-faux` était
  // inatteignable par ce chemin.
  //
  // Conséquence à l'écran : quelqu'un qui se trompe d'un chiffre — de loin le
  // cas le plus fréquent — lisait « Ce code a expiré, demande-en un nouveau »,
  // et redemandait un code dont il n'avait pas besoin. On lui faisait refaire
  // le trajet complet à cause d'une faute de frappe.
  //
  // On ne peut pas trancher ce que le service ne dit pas. On rend donc le cas
  // AMBIGU, dont le texte couvre honnêtement les deux causes et propose les
  // deux gestes. `code-faux` reste émis, lui, quand NOUS savons — un code qui
  // n'a pas six chiffres, vérifié sans réseau (voir `verifierCode`).
  return refus('code-refuse')
}

// ══════════ LA SESSION ══════════════════════════════════════════════════════

/**
 * La session à partir de ce que Supabase vient de rendre, ou `null`.
 *
 * ⚠️ ON PRÉFÈRE `expires_in` À `expires_at`. `expires_at` est une date absolue
 * calculée par l'horloge de Supabase : sur une machine dont l'horloge retarde
 * de deux heures, elle ferait croire à un jeton déjà mort (renouvellement en
 * boucle) ; en avance, à un jeton éternel (401 à chaque appel). `expires_in`
 * est une durée, donc lisible avec NOTRE horloge, la seule qu'on connaisse.
 */
function sessionDepuisReponse(corps, maintenant, courriel) {
  const jeton = String(corps?.access_token || '')
  const renouvellement = String(corps?.refresh_token || '')
  if (!jeton || jeton.length > JETON_MAX || !JETON_RE.test(jeton)) return null
  if (!renouvellement || renouvellement.length > JETON_MAX) return null

  const duree = Number(corps?.expires_in)
  const absolu = Number(corps?.expires_at)
  const expireA = Number.isFinite(duree) && duree > 0
    ? maintenant() + duree * 1000
    : Number.isFinite(absolu) && absolu > 0
      ? absolu * 1000
      : maintenant() + 3600_000 // le défaut de Supabase, faute de mieux

  return {
    jeton,
    renouvellement,
    expireA,
    courriel: normaliserCourriel(corps?.user?.email) || normaliserCourriel(courriel),
  }
}

/**
 * Ce qu'on relit du stockage, en s'en méfiant. Il n'y a pas d'attaquant distant
 * ici (même origine), mais il y a une VERSION PRÉCÉDENTE DE CE CODE, qui a pu
 * y écrire une autre forme — et un `undefined` propagé jusqu'à l'en-tête
 * `Authorization` donne un 401 incompréhensible plutôt qu'une reconnexion.
 */
function sessionRelue(brut) {
  let o
  try {
    o = JSON.parse(brut || 'null')
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const jeton = typeof o.jeton === 'string' ? o.jeton : ''
  const renouvellement = typeof o.renouvellement === 'string' ? o.renouvellement : ''
  if (!renouvellement || !JETON_RE.test(jeton) || jeton.length > JETON_MAX) return null
  return {
    jeton,
    renouvellement,
    // Une échéance absente ou absurde vaut « expiré » : on renouvellera au
    // premier usage, ce qui est toujours mieux que de poser un jeton mort.
    expireA: Number.isFinite(o.expireA) ? o.expireA : 0,
    courriel: normaliserCourriel(o.courriel),
  }
}

// ══════════ LE MODULE ═══════════════════════════════════════════════════════

/**
 * Ouvre un client de compte.
 *
 * ⚠️ UNE FABRIQUE, PAS DES FONCTIONS DE MODULE. Deux états mutables vivent ici
 * — la session courante et le renouvellement en cours — et un état de module
 * partagé serait invisible d'un test à l'autre. Le plan (Phase 4, défaut (d))
 * cite précisément ce piège : `restoredRaceId`, jamais remis à zéro, qui
 * empoisonne deux onglets. On ne le refait pas.
 *
 * L'application n'en crée qu'une, et la partage.
 *
 * @param {object} options
 * @param {Function} [options.apporter]  le `fetch` (injectable pour les tests)
 * @param {Storage}  [options.stockage]  où la session survit (localStorage)
 * @param {Storage}  [options.stockageSession]  seulement pour le ménage
 * @param {Function} [options.maintenant]  l'horloge
 * @param {string}   [options.urlConfig]  la route qui rend { url, cle }
 */
export function creerCompte({
  // ⚠️ LIÉ TARD, PAS CAPTURÉ. `apporter = globalThis.fetch` prendrait la
  // référence AU MOMENT DE LA CONSTRUCTION — c'est-à-dire au démarrage de
  // l'application, avant tout le reste. Un `fetch` installé après coup (sonde
  // d'erreurs, instrument de mesure, bouchon de vérification en console) serait
  // alors contourné en silence par le seul module dont les pannes enferment
  // quelqu'un dehors. La flèche va chercher le `fetch` du moment, à chaque appel.
  apporter = (...args) => globalThis.fetch(...args),
  stockage = globalThis.localStorage,
  stockageSession = globalThis.sessionStorage,
  maintenant = Date.now,
  urlConfig = URL_CONFIG,
} = {}) {
  // ── L'état, tout entier ────────────────────────────────────────────────────
  let session = lireStockage()
  let config = null // { url, cle } une fois obtenue
  let configEnCours = null // la promesse partagée, le temps de l'obtenir
  let renouvellementEnCours = null // ⚠️ le verrou du renouvellement unique

  function lireStockage() {
    try {
      return sessionRelue(stockage?.getItem(CLE_SESSION))
    } catch {
      // Navigation privée, stockage interdit : on démarre sans session. Ce
      // n'est pas une erreur, c'est un navigateur qui a le droit de dire non.
      return null
    }
  }

  function ecrireStockage() {
    try {
      if (session) stockage?.setItem(CLE_SESSION, JSON.stringify(session))
      else stockage?.removeItem(CLE_SESSION)
    } catch {
      // Quota, navigation privée : la session vit en mémoire, elle ne survivra
      // simplement pas au rechargement. Ça ne doit JAMAIS faire échouer une
      // connexion qui vient de réussir.
    }
  }

  /**
   * La configuration publique, demandée UNE FOIS et PARESSEUSEMENT.
   *
   * ⚠️ JAMAIS AU CHARGEMENT DE L'APPLICATION. ShibuMap démarre une scène 3D et
   * charge des tuiles de terrain ; une requête de plus au démarrage, pour un
   * service que la plupart des visiteurs n'ouvriront jamais, est une requête de
   * trop. Elle part quand quelqu'un ouvre la connexion, pas avant.
   *
   * Un échec n'est PAS mémorisé : une coupure de réseau ne doit pas condamner
   * les comptes jusqu'au prochain rechargement.
   */
  async function configuration() {
    if (config) return { ok: true, ...config }
    if (configEnCours) return configEnCours
    configEnCours = (async () => {
      let rep
      try {
        rep = await apporter(urlConfig, { headers: { accept: 'application/json' } })
      } catch {
        return refus('injoignable', MSG_RESEAU)
      }
      let corps = null
      try {
        corps = await rep.json()
      } catch {
        corps = null
      }
      if (!rep.ok || !corps?.ok) return refus('injoignable', MSG_CONFIGURATION)
      const url = String(corps.url || '').replace(/\/$/, '')
      const cle = String(corps.cle || '')
      // ⚠️ Défense en profondeur : la fonction serveur valide déjà, mais c'est
      // CE navigateur qui va poster un courriel à cette adresse.
      if (!urlSupabaseValide(url) || !cle || cle.length > 512) return refus('injoignable', MSG_CONFIGURATION)
      config = { url, cle }
      return { ok: true, url, cle }
    })().finally(() => {
      configEnCours = null
    })
    return configEnCours
  }

  /** Un appel à Supabase, avec la clé du projet. Ne lève jamais. */
  async function versSupabase(chemin, corpsEnvoye, cfg) {
    let rep
    try {
      rep = await apporter(`${cfg.url}${chemin}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: cfg.cle },
        body: JSON.stringify(corpsEnvoye),
      })
    } catch {
      return { reseau: true }
    }
    let corps = null
    try {
      corps = await rep.json()
    } catch {
      corps = null
    }
    // ⚠️ LE STATUT D'ABORD, LE CORPS ENSUITE. Un refus de Supabase porte un
    // corps JSON parfaitement formé ; certains chemins y remettent même des
    // champs de jeton. Lire le corps sans regarder `rep.ok`, c'est connecter
    // quelqu'un sur un code faux.
    return { ok: rep.ok, statut: rep.status, corps }
  }

  // ── L'envoi du code ───────────────────────────────────────────────────────
  async function demanderCode(courrielBrut) {
    const courriel = normaliserCourriel(courrielBrut)
    if (!courrielValide(courriel)) return refus('adresse-invalide')
    const cfg = await configuration()
    if (!cfg.ok) return cfg
    const r = await versSupabase('/auth/v1/otp', { email: courriel }, cfg)
    if (r.reseau) return refus('injoignable', MSG_RESEAU)
    if (!r.ok) return messageRefus(r.statut, r.corps, 'envoi')
    return { ok: true, courriel }
  }

  // ── La vérification du code ───────────────────────────────────────────────
  async function verifierCode(courrielBrut, codeBrut) {
    const courriel = normaliserCourriel(courrielBrut)
    const code = normaliserCode(codeBrut)
    if (!courrielValide(courriel)) return refus('adresse-invalide')
    // Six chiffres ou pas six chiffres : pour qui regarde l'écran, c'est le
    // MÊME refus qu'un code que Supabase rejette — « ce code ne va pas,
    // recompte-les ». Un code de plus ici serait un texte de plus à écrire pour
    // dire exactement la même chose.
    if (!codeValide(code)) return refus('code-faux')

    const cfg = await configuration()
    if (!cfg.ok) return cfg
    const r = await versSupabase('/auth/v1/verify', { email: courriel, token: code, type: 'email' }, cfg)
    if (r.reseau) return refus('injoignable', MSG_RESEAU)
    if (!r.ok) return messageRefus(r.statut, r.corps, 'verification')

    const ouverte = sessionDepuisReponse(r.corps, maintenant, courriel)
    // Un 200 sans jeton lisible n'est pas une connexion. On ne range rien.
    if (!ouverte) return refus('injoignable')
    session = ouverte
    ecrireStockage()
    return { ok: true, courriel: session.courriel }
  }

  /**
   * Le renouvellement, DERRIÈRE UN VERROU.
   *
   * ⚠️ C'EST LE CŒUR DU MODULE. Au moment où le jeton expire, il est normal que
   * plusieurs appels partent ensemble (« Mes créations », les factures, une
   * publication). Sans verrou, chacun renouvellerait de son côté : Supabase
   * fait TOURNER le jeton de renouvellement, donc le premier retour invalide
   * ceux des neuf autres, qui échouent — et la session s'effondre en pleine
   * action, sans que rien n'explique pourquoi.
   *
   * Tout le monde attend donc LA MÊME promesse, et le verrou est rendu quoi
   * qu'il arrive (`finally`), sinon un échec réseau condamnerait la session
   * jusqu'au rechargement.
   */
  function renouveler() {
    if (renouvellementEnCours) return renouvellementEnCours
    renouvellementEnCours = (async () => {
      const cfg = await configuration()
      if (!cfg.ok || !session) return ''
      const r = await versSupabase(
        '/auth/v1/token?grant_type=refresh_token',
        { refresh_token: session.renouvellement },
        cfg,
      )
      // ⚠️ UNE COUPURE RÉSEAU N'EST PAS UNE RÉVOCATION. Effacer la session ici
      // obligerait à redemander un code par courriel à chaque perte de wifi.
      // On rend '' — « pas de jeton utilisable à cet instant » — et la session
      // reste là, prête à repartir quand le réseau revient.
      if (r.reseau) return ''
      if (!r.ok) {
        // Là, en revanche, Supabase a dit non : jeton révoqué, expiré, déjà
        // consommé. Insister ne servirait qu'à boucler.
        oublier()
        return ''
      }
      const fraiche = sessionDepuisReponse(r.corps, maintenant, session.courriel)
      if (!fraiche) {
        oublier()
        return ''
      }
      session = fraiche
      // Ranger tout de suite : le jeton de renouvellement a TOURNÉ, celui du
      // stockage est déjà mort. Un rechargement d'ici là repartirait dessus.
      ecrireStockage()
      return session.jeton
    })().finally(() => {
      renouvellementEnCours = null
    })
    return renouvellementEnCours
  }

  /** Le jeton à poser sur une requête, ou '' — et '' est un cas NORMAL :
   *  ShibuMap s'utilise sans compte. */
  async function jeton() {
    if (!session) return ''
    if (session.expireA - maintenant() > MARGE_RENOUVELLEMENT_MS) return session.jeton
    return renouveler()
  }

  /** Exactement ce que `jetonPresente` (netlify/functions/_compte.mjs) sait
   *  lire — et rien quand il n'y a pas de session. */
  async function entetes() {
    const j = await jeton()
    return j ? { authorization: `Bearer ${j}` } : {}
  }

  function oublier() {
    session = null
    ecrireStockage()
  }

  /**
   * Se déconnecter — et ⚠️ EFFACER VRAIMENT.
   *
   * Pas seulement la clé courante : tout ce qui, dans ce navigateur, est un
   * jeton de compte. Une version précédente de ce module a pu ranger sous un
   * autre nom `shibumap.compte.…` ; et une page qui aurait chargé le SDK
   * Supabase laisse des `sb-<projet>-auth-token`. Ces reliques sont des jetons
   * VIVANTS : « déconnecté » doit vouloir dire qu'il n'en reste aucun.
   *
   * ⚠️ Ce ménage ne touche QUE ces deux familles de clés. `shibumap.race.…`
   * (les jetons d'édition de cartes) n'est PAS une session de compte : les
   * effacer ferait perdre à un organisateur la possibilité de corriger un
   * tracé déjà publié, définitivement — `secretHash` est un condensat, il n'y a
   * aucun chemin de retour.
   */
  function deconnecter() {
    session = null
    for (const magasin of [stockage, stockageSession]) {
      if (!magasin) continue
      try {
        const aJeter = []
        for (let i = 0; i < magasin.length; i += 1) {
          const cle = magasin.key(i)
          if (typeof cle === 'string' && (cle.startsWith(PREFIXE_COMPTE) || cle.startsWith('sb-'))) {
            aJeter.push(cle)
          }
        }
        // On collecte AVANT de supprimer : retirer une clé pendant qu'on
        // parcourt par index en fait sauter une sur deux.
        for (const cle of aJeter) magasin.removeItem(cle)
      } catch {
        // Stockage interdit : il n'y avait rien à effacer de toute façon.
      }
    }
  }

  return {
    configuration,
    demanderCode,
    verifierCode,
    jeton,
    entetes,
    deconnecter,
    connecte: () => !!session,
    courriel: () => session?.courriel || '',
  }
}
