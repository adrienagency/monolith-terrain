// LE TUNNEL DE PAIEMENT, CÔTÉ NAVIGATEUR — l'aller, le retour, et ce qui doit
// survivre entre les deux.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE MODULE NE SAIT PAS COMBIEN COÛTE UNE AFFICHE, ET C'EST VOULU
// ═══════════════════════════════════════════════════════════════════════════
//
// Le prix, le libellé, la TVA et la liste blanche des articles vivent côté
// SERVEUR (netlify/functions/_paiement-catalogue.mjs). Le navigateur n'envoie
// qu'un IDENTIFIANT d'article. La faille numéro un des paiements web, c'est un
// client qui poste `{ prix: 1 }` — ici il n'a pas de prix à poster.
//
// Ce que ce module fait, en revanche, c'est ne pas envoyer N'IMPORTE QUOI : il
// construit l'identifiant à partir de ce que l'écran d'affiche sait vendre. La
// caisse revérifie derrière — les deux gardes ne se remplacent pas, elles se
// superposent. Un test vérifie que tout identifiant que ce fichier sait
// produire existe bel et bien dans le catalogue serveur : les deux ne peuvent
// pas diverger en silence.
//
// ═══════════════════════════════════════════════════════════════════════════
// MODULE PUR : NI DOM, NI `location`, NI `fetch` GLOBAL OBLIGATOIRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Le stockage et le `fetch` sont des ARGUMENTS (par défaut les globales). Même
// contrat que share-link.js : ce fichier se teste entièrement sous node, alors
// que c'est le seul endroit de l'application où une erreur coûte une vente.

import { CADRAGE_DEFAUT, cadrageValide, FORMAT_PAR_ID } from './print-page.js'

export const URL_CAISSE = '/.netlify/functions/paiement'
export const URL_ETAT = '/.netlify/functions/paiement-etat'

// ══════════ QUEL ARTICLE ? ══════════════════════════════════════════════════

/** Les formats d'affiche qu'on sait faire IMPRIMER (le catalogue serveur en a un par format). */
export const FORMATS_IMPRIMES = ['30x40', '40x50', '50x70', '61x91']

/**
 * L'identifiant d'article à poster à la caisse, ou `null` si l'écran demande
 * quelque chose qui ne se vend pas.
 *
 * ⚠️ `null` N'EST PAS UNE ERREUR À AVALER : c'est le cas « on ne sait pas quoi
 * facturer ». Mieux vaut ne pas ouvrir de session de paiement du tout que d'en
 * ouvrir une pour un article que la caisse refusera de toute façon.
 */
export function identifiantArticle({ livrable = 'fichier', format = '' } = {}) {
  if (livrable === 'impression') {
    return FORMATS_IMPRIMES.includes(format) ? `affiche-print-${format}` : null
  }
  // Aujourd'hui l'écran d'affiche ne vend que le fichier d'impression : c'est
  // ce que dit son bouton (« Recevoir le fichier »).
  return livrable === 'fichier' ? 'affiche-pdf' : null
}

// ══════════ LE RETOUR DE STRIPE ═════════════════════════════════════════════
//
// ⚠️ ON NE FAIT PAS CONFIANCE À `?paye=`. C'est un paramètre d'URL : il se
// tape à la main, se copie, se partage, se recharge. Il sert à SAVOIR QUOI
// DEMANDER AU SERVEUR, jamais à décider que quelqu'un a payé. La décision est
// prise par netlify/functions/paiement-etat.mjs, qui a la clé secrète.
//
// Première barrière quand même : la FORME. Un identifiant qui ne ressemble pas
// à un identifiant Stripe n'a aucune raison d'aller déranger l'API — et le
// gabarit `{CHECKOUT_SESSION_ID}` non remplacé (quelqu'un qui recopie la
// success_url du code) tombe ici, pas en 502.

/** `cs_…` de Stripe, ou `atelier_…` du contournement serveur (voir paiement.mjs). */
export const SESSION_RE = /^(cs_[A-Za-z0-9_]{8,120}|atelier_[a-z0-9]{8,40})$/

export function sessionValide(id) {
  return typeof id === 'string' && SESSION_RE.test(id)
}

/**
 * Lit la query string du retour.
 *
 * @returns {{cas: 'paye'|'annule'|'invalide'|null, session: string}}
 *   · `paye`     — identifiant de forme plausible, à faire vérifier au serveur
 *   · `annule`   — l'acheteur a fait demi-tour chez Stripe
 *   · `invalide` — `?paye=` présent mais illisible : on ne l'envoie nulle part
 *   · `null`     — visite ordinaire
 */
export function lireRetourPaiement(recherche) {
  let p
  try { p = new URLSearchParams(String(recherche || '')) } catch { return { cas: null, session: '' } }
  if (p.get('paiement') === 'annule') return { cas: 'annule', session: '' }
  if (!p.has('paye')) return { cas: null, session: '' }
  const s = p.get('paye') || ''
  return sessionValide(s) ? { cas: 'paye', session: s } : { cas: 'invalide', session: '' }
}

/**
 * Le retour À TRAITER : celui que porte l'URL, ou celui qu'un chargement
 * précédent a laissé EN SUSPENS dans le panier.
 *
 * ⚠️ SANS CETTE SECONDE SOURCE, LA LIVRAISON N'A QU'UN SEUL COUP. L'URL de
 * retour est nettoyée dès le chargement du module (et elle doit l'être : une
 * confirmation qui se rejoue depuis un signet est pire). Il ne restait donc
 * plus aucun chemin vers le fichier payé dès qu'on rechargeait la page, qu'on
 * fermait l'onglet une seconde, ou qu'on manquait le bouton « Télécharger » :
 * le PDF dormait dans le coffre jusqu'à sa purge, orphelin.
 *
 * ⚠️ ET ÇA NE CONFIRME TOUJOURS RIEN. La session relue du panier repart chez
 * `verifierPaiement` exactement comme celle de l'URL — c'est le serveur qui
 * tranche, jamais le stockage. On rejoue une DEMANDE, pas une réponse.
 *
 * L'URL a la priorité : un `?paiement=annule` frais doit pouvoir clore une
 * reprise laissée par une tentative précédente.
 */
export function retourAReprendre(recherche, panier) {
  const direct = lireRetourPaiement(recherche)
  if (direct.cas) return direct
  const s = panier?.session || ''
  return sessionValide(s) ? { cas: 'paye', session: s, reprise: true } : direct
}

/**
 * Reste-t-il quelque chose à livrer après ce retour ?
 *
 * C'est la question qui décide de la survie du panier — donc de la seule clé
 * qui ramène au fichier dans le coffre. Pure, et regroupée ici parce qu'elle
 * énonce une doctrine, pas une condition :
 *
 *   · `paye` / `livree` — on ne garde QUE si le fichier est effectivement à
 *     l'écran et pas encore pris. Une fois cliqué, il n'y a plus rien à rejouer ;
 *     et si le coffre n'a rien rendu, il n'y a rien à rejouer non plus (c'est
 *     le mail qui prend le relais).
 *   · `en-attente` — virement, prélèvement : la banque n'a pas tranché. Jeter
 *     la clé ici, c'est perdre le fichier AVANT que le paiement ne se confirme.
 *   · `indisponible` — on n'a pas pu demander. Ne rien jeter sur une panne
 *     réseau : le prochain chargement redemandera.
 *   · le reste (`expiree`, `inconnue`, `invalide`, annulation) — rien n'est dû.
 */
export function livraisonEnSuspens(etat, { fichierPret = false } = {}) {
  if (etat === 'en-attente' || etat === 'indisponible') return true
  if (etat === 'paye' || etat === 'livree') return fichierPret
  return false
}

/**
 * L'URL débarrassée des paramètres de retour, pour `history.replaceState`.
 * Laisser `?paye=…` dans la barre d'adresse, c'est laisser un lien qui rejoue
 * une confirmation à chaque rechargement — et qui part dans un signet.
 */
export function urlSansRetour(href) {
  try {
    const u = new URL(String(href))
    u.searchParams.delete('paye')
    u.searchParams.delete('paiement')
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return null
  }
}

// ══════════ LE PANIER QUI DOIT SURVIVRE À L'ALLER-RETOUR ════════════════════
//
// ⚠️ LE PIÈGE DE TOUT TUNNEL HÉBERGÉ : partir chez Stripe est une NAVIGATION.
// L'application est déchargée, le module JS repart de zéro, et l'état de
// l'affiche — format, orientation, cadrage, titre, point net — n'existe que
// dans une variable locale de `ouvrirAffiche`. Sans ce panier, l'acheteur qui
// renonce revient sur la vue d'ouverture d'Annecy et doit TOUT refaire : c'est
// un abandon de vente garanti, et il ne se voit dans aucun test unitaire.
//
// `sessionStorage` et pas `localStorage` : le panier appartient à CET onglet et
// à cette tentative d'achat. Un `localStorage` ressusciterait une composition
// vieille de trois semaines à la prochaine ouverture du site.
//
// ⚠️ CE QUI NE SURVIT PAS, ET QU'ON ASSUME : le LOGO importé. C'est une URL
// d'objet (`blob:`) créée par `URL.createObjectURL` ; elle meurt avec le
// document, et le fichier lui-même n'a jamais quitté la mémoire. Le rendre
// persistant voudrait dire recopier une image en base64 dans le stockage de
// session — quota, mémoire, et un fichier de l'utilisateur qui traîne. On le
// perd, et l'interface le dit plutôt que d'afficher un cadre vide.

export const CLE_PANIER = 'shibumap.paiement.panier'

/** Un identifiant court pour relier le retour à la composition. */
export function identifiantPanier(alea = Math.random) {
  let s = ''
  while (s.length < 12) s += Math.floor(alea() * 36 ** 6).toString(36).padStart(6, '0')
  return `p-${s.slice(0, 12)}`
}

/**
 * Ce qu'on garde de l'état de l'affiche. Liste EXPLICITE, jamais un `{...etat}` :
 * l'état porte aussi des URL d'objet et des références à la scène, qui ne
 * traversent pas `JSON.stringify` (ou qui le traversent en `{}`, ce qui est
 * pire — on croirait avoir sauvegardé).
 */
export function afficheSerialisable(etat = {}) {
  const p = etat.pointNet
  const pointNet = p && ['x', 'y', 'z'].every((k) => Number.isFinite(p[k])) ? { x: p.x, y: p.y, z: p.z } : null
  return {
    format: typeof etat.format === 'string' ? etat.format : '50x70',
    orientation: etat.orientation === 'portrait' ? 'portrait' : 'paysage',
    cartouche: etat.cartouche !== false,
    cartoucheSombre: !!etat.cartoucheSombre,
    titre: String(etat.titre || '').slice(0, 120),
    cadrage: cadrageValide(etat.cadrage),
    pointNet,
  }
}

/**
 * Le chemin inverse, en se méfiant de ce qu'on relit. Le stockage de session
 * est de même origine, donc il n'y a pas d'attaquant distant ici — mais il y a
 * une VERSION PRÉCÉDENTE DE CE CODE, qui a pu y écrire une autre forme. Une
 * validation de forme coûte dix lignes ; un `undefined` propagé jusqu'au
 * cadrage de caméra coûte un écran noir.
 */
export function afficheRestauree(brut) {
  if (!brut || typeof brut !== 'object') return null
  const a = afficheSerialisable(brut)
  if (!FORMAT_PAR_ID[a.format]) a.format = '50x70'
  return a
}

/** Écrit le panier. Ne lève JAMAIS : un stockage refusé (navigation privée,
 *  quota) ne doit pas empêcher un achat, il doit juste faire perdre le retour. */
export function poserPanier(panier, storage = globalThis.sessionStorage) {
  try {
    storage.setItem(CLE_PANIER, JSON.stringify(panier))
    return true
  } catch {
    return false
  }
}

export function lirePanier(storage = globalThis.sessionStorage) {
  try {
    const brut = JSON.parse(storage.getItem(CLE_PANIER) || 'null')
    if (!brut || typeof brut !== 'object') return null
    const affiche = afficheRestauree(brut.affiche)
    if (!affiche) return null
    return {
      id: String(brut.id || ''),
      article: String(brut.article || ''),
      // l'état de la CARTE, encodé par share-link.js — on ne le décode pas ici,
      // c'est main.js qui en a la base de comparaison (BASE_TEMPLATE_LOOK)
      carte: typeof brut.carte === 'string' ? brut.carte : '',
      // La session à revérifier au prochain chargement, quand la livraison est
      // restée en suspens (voir `armerReprise`). VALIDÉE DE FORME : on ne
      // relance pas le serveur sur une chaîne quelconque relue du stockage —
      // même garde que pour `?paye=`, et pour la même raison.
      session: sessionValide(brut.session) ? brut.session : '',
      affiche,
    }
  } catch {
    return null
  }
}

/**
 * Note dans le panier la session dont la livraison reste en suspens, pour que
 * le prochain chargement puisse la rejouer sans `?paye=` dans la barre
 * d'adresse.
 *
 * ⚠️ ÇA N'ÉCRIT PAS « C'EST PAYÉ ». Ça écrit « il reste quelque chose à
 * demander au serveur au sujet de cette session ». La différence est tout le
 * sujet de ce module : le stockage du navigateur ne décide de rien.
 */
export function armerReprise(session, storage = globalThis.sessionStorage) {
  if (!sessionValide(session)) return false
  const panier = lirePanier(storage)
  if (!panier) return false
  return poserPanier({ ...panier, session }, storage)
}

export function viderPanier(storage = globalThis.sessionStorage) {
  try { storage.removeItem(CLE_PANIER) } catch { /* rien à vider, rien à dire */ }
}

// ══════════ L'ALLER ═════════════════════════════════════════════════════════

/**
 * Ouvre une session de paiement et rend l'URL Stripe.
 *
 * Contrat de netlify/functions/paiement.mjs, relu ligne à ligne :
 *   POST { article, retour?, code? }
 *   200 → { ok: true, url, id }
 *   400 → { ok: false, erreur: 'article inconnu' | 'corps illisible' }
 *   405 → { ok: false, erreur: 'méthode' }
 *   502 → { ok: false, erreur: <message Stripe> }
 *   503 → { ok: false, erreur: 'STRIPE_SECRET_KEY absente…' }
 *
 * ⚠️ ON NE SUPPOSE PAS QUE LA RÉPONSE EST DU JSON. Une fonction non déployée
 * rend la page 404 de Netlify, en HTML : `res.json()` lèverait, et l'acheteur
 * verrait un bouton mort au lieu d'un message.
 */
export async function demanderCaisse({ article, retour = '', code = '' }, fetchImpl = globalThis.fetch) {
  if (!article) return { ok: false, erreur: 'article inconnu' }
  const envoi = { article, retour }
  // Le code d'atelier ne part que s'il y en a un — la requête ordinaire n'en
  // porte aucune trace.
  if (code) envoi.code = code
  let r
  try {
    r = await fetchImpl(URL_CAISSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envoi),
    })
  } catch {
    return { ok: false, erreur: 'réseau' }
  }
  let corps = null
  try { corps = await r.json() } catch { corps = null }
  if (!r.ok || !corps?.ok || !corps.url) {
    return { ok: false, erreur: corps?.erreur || `caisse indisponible (${r.status})` }
  }
  return { ok: true, url: String(corps.url), id: String(corps.id || '') }
}

// ══════════ LE RETOUR, VÉRIFIÉ PAR LE SERVEUR ═══════════════════════════════

/**
 * Demande au serveur ce qu'il en est vraiment de cette session.
 * Voir netlify/functions/paiement-etat.mjs pour les états possibles.
 *
 * En cas de panne (réseau, fonction absente), on rend `indisponible` — SURTOUT
 * PAS `paye` : sinon une simple coupure réseau ferait afficher une
 * confirmation à quelqu'un qui n'a rien payé.
 */
export async function verifierPaiement(session, fetchImpl = globalThis.fetch) {
  if (!sessionValide(session)) return { etat: 'inconnue' }
  let r
  try {
    r = await fetchImpl(`${URL_ETAT}?session=${encodeURIComponent(session)}`)
  } catch {
    return { etat: 'indisponible' }
  }
  let corps = null
  try { corps = await r.json() } catch { corps = null }
  if (!r.ok || !corps?.ok) return { etat: 'indisponible' }
  return {
    etat: String(corps.etat || 'inconnue'),
    article: String(corps.article || ''),
    livrable: String(corps.livrable || ''),
    livree: !!corps.livree,
    atelier: !!corps.atelier,
  }
}

/**
 * Le message à afficher pour chaque état. Pur, donc testable — et rassemblé
 * ici pour une raison : c'est la DOCTRINE du projet qui s'écrit dans ces
 * phrases, et elle doit rester relisable d'un seul coup d'œil.
 *
 * ⚠️ AUCUNE DE CES PHRASES NE PROMET UN TÉLÉCHARGEMENT TANT QU'IL N'Y A PAS DE
 * FICHIER EN MAIN. C'est la doctrine, et elle n'a pas changé : promettre un
 * fichier qui n'arrive pas coûte plus cher que d'assumer un chantier.
 *
 * `fichierPret` est le SEUL interrupteur, et il ne s'allume pas sur une
 * intention : l'appelant l'allume quand il a sorti le PDF du coffre et qu'il
 * est en train de le poser à l'écran (voir src/coffre-affiche.js et
 * `proposerLeFichier` dans main.js). Sans coffre lisible — navigation privée,
 * quota, autre machine — on retombe mot pour mot sur la phrase d'avant, qui
 * reste vraie : c'est Adrien qui envoie le fichier.
 */
export function messageRetour(etat, { fichierPret = false } = {}) {
  switch (etat) {
    case 'paye':
      return fichierPret
        ? 'Paiement reçu, merci. Ton fichier d’impression est prêt : le bouton de téléchargement est en bas de l’écran. Ta facture Stripe arrive de son côté.'
        : 'Paiement reçu, merci. Le fichier d’impression n’est pas encore produit automatiquement : Adrien te l’envoie par mail. Ta facture Stripe arrive de son côté.'
    case 'en-attente':
      return 'Paiement en cours de confirmation par la banque. Rien à refaire de ton côté : tu recevras un mail dès qu’il est validé.'
    case 'expiree':
      return 'Cette session de paiement a expiré. Ta composition est toujours là — tu peux relancer la commande.'
    case 'livree':
      return fichierPret
        ? 'Cette commande a déjà été traitée. Ton exemplaire est là : le bouton de téléchargement est en bas de l’écran.'
        : 'Cette commande a déjà été traitée — regarde tes mails, le fichier y est.'
    case 'indisponible':
      return 'Impossible de vérifier ce paiement pour l’instant. Si tu as été débité, écris à adrien@adrienagency.com : rien n’est perdu.'
    default:
      // 'inconnue' et 'invalide' : quelqu'un est arrivé ici avec un identifiant
      // que Stripe ne connaît pas. On ne confirme RIEN.
      return 'Ce lien de retour ne correspond à aucun paiement. Ta composition est intacte.'
  }
}
