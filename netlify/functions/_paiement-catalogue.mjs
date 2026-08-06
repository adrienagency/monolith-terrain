// LE CATALOGUE DES CHOSES QU'ON VEND — côté SERVEUR, et c'est tout l'enjeu.
//
// ⚠️ LE PRIX NE VIENT JAMAIS DU NAVIGATEUR. C'est la faille numéro un des
// paiements web : on laisse le client poster `{ prix: 19 }`, quelqu'un poste
// `{ prix: 1 }`, et la commande part à un euro. Le navigateur n'envoie donc
// qu'un IDENTIFIANT d'article ; le prix, le libellé et la TVA vivent ici, dans
// un fichier qu'il ne peut pas atteindre.
//
// Ce module est PUR : ni réseau, ni Stripe, ni variables d'environnement. Il se
// teste sous node, et les deux fonctions le partagent.

// Les prix sont en CENTIMES : Stripe ne travaille qu'en entiers, et un prix en
// euros flottants finit toujours par produire un 18,999999999999998.

// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX DU FICHIER — LE SEUL CHIFFRE À CHANGER POUR ROUVRIR LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════
//
// 0 = GRATUITÉ TEMPORAIRE, posée le 2026-08-06. Le but n'est pas d'offrir
// l'affiche : c'est d'éprouver LA CHAÎNE ENTIÈRE en production — écran, pavage,
// coffre, caisse Stripe, webhook, page de retour, livraison du PDF — sans qu'un
// centime ne soit débité à qui que ce soit.
//
// ⚠️ CE N'EST PAS UN CONTOURNEMENT, ET C'EST TOUT L'INTÉRÊT. La session Stripe
// est réellement créée, réellement complétée, et le webhook la reçoit
// réellement. Stripe appelle ça une COMMANDE À COÛT ZÉRO (documentation
// « No-cost orders », API ≥ 2023-08-16) : un `line_item` à `unit_amount: 0` en
// `mode: 'payment'` est ACCEPTÉ, Checkout saute simplement la collecte du moyen
// de paiement, et la session ressort avec `payment_status:
// 'no_payment_required'` et AUCUN PaymentIntent.
//
// ⚠️ LE MINIMUM DE 0,50 € NE S'APPLIQUE PAS ICI. Stripe impose bien un montant
// minimal par devise (0,50 EUR), mais la documentation des devises le dit pour
// les paiements : zéro n'est pas un petit paiement, c'est l'ABSENCE de
// paiement, et Checkout la traite comme un chemin à part. Une affiche à 1 ou
// 30 centimes, elle, serait refusée.
//
// ══════════ POUR REVENIR À 19 € ═════════════════════════════════════════════
//
//   1. remettre `1900` ci-dessous ;
//   2. remettre `19` dans `PRIX_AFFICHE_EUR` (src/ui/affiche.js) — c'est
//      l'ÉTIQUETTE du bouton, pas le prix ; un test refuse qu'elles divergent,
//      donc `npm test` le dit tout de suite si on l'oublie ;
//   3. rien d'autre. Le libellé vendu, son détail, le texte du bouton et la
//      phrase de réassurance se remettent SEULS : ils sont DÉRIVÉS du prix
//      (voir `habillageAffichePdf` juste dessous), jamais recopiés.
//
// À vérifier en remontant, dans cet ordre :
//   · le webhook redevient strict TOUT SEUL — il n'accepte
//     `no_payment_required` que sur un total EXACTEMENT nul, donc une session à
//     19 € impayée reste refusée comme avant (paiement-webhook.mjs) ;
//   · la FACTURE Stripe recommence à être établie, donc à coûter ses 0,4 %
//     (~8 centimes sur 19 €) — à zéro, elle ne coûtait rien, et Stripe ne
//     l'établissait probablement même pas, faute d'encaissement ;
//   · le tunnel redemande une CARTE : la page Stripe change d'aspect entre les
//     deux régimes, ne pas conclure d'un essai gratuit que le tunnel payant est
//     éprouvé.
export const PRIX_AFFICHE_PDF_CENTIMES = 0

// ⚠️ CE LIBELLÉ NE PROMET PLUS « 300 dpi », ET C'EST UNE CORRECTION, PAS UNE
// PRUDENCE. La densité livrée dépend de DEUX choses qu'on ne connaît pas au
// moment d'écrire ce fichier :
//   · le FORMAT — la table nominale (src/export-dpi.js) plafonne déjà le
//     50 × 70 à 250 dpi et le 61 × 91 à 200, parce qu'au-delà la source elle-
//     même n'a plus l'information ;
//   · la MACHINE de l'acheteur — la sonde dégrade légitimement quand le
//     pilote est bridé (mesuré à 4 096 px : A4 300, 30 × 40 250, A3 240,
//     40 × 50 200, A2 170), plancher à 150 dpi.
// L'écran d'affiche, lui, montre le VRAI chiffre avant le paiement (voir
// `ligneVerite`, src/ui/affiche.js). Ce libellé-ci part sur la page Stripe ET
// sur la facture numérotée : y écrire un chiffre que l'acheteur n'obtient pas
// est un remboursement écrit d'avance, sur un document opposable.
//
// La fourchette annoncée doit donc ENCADRER tout ce que la chaîne peut
// rendre — plancher compris, nominale maximale comprise. Un test le vérifie
// contre `DPI_PLANCHER` et `DPI_NOMINAL` plutôt que contre une phrase.
const LIBELLE_PDF = 'Affiche ShibuMap — fichier d’impression'
const DETAIL_PDF = 'PDF prêt pour l’imprimeur — de 150 à 300 dpi selon le format et ta machine, densité exacte affichée avant le paiement'

/**
 * Le mot qui doit apparaître — et n'apparaître QUE — sur un article à 0 €.
 * C'est lui que le test interroge : il tient une PROPRIÉTÉ (prix nul ⟺ gratuité
 * annoncée), pas le chiffre du jour.
 */
export const MENTION_GRATUITE = 'offert'

/**
 * Le libellé et le détail du fichier d'impression, DÉRIVÉS DE SON PRIX.
 *
 * ⚠️ UN ARTICLE À 0 € INTITULÉ COMME UN ARTICLE PAYANT EST TROMPEUR, et ce
 * libellé ne reste pas dans le code : il part sur la page Stripe ET sur une
 * FACTURE NUMÉROTÉE, c'est-à-dire sur un document opposable. On le DÉRIVE donc
 * du prix plutôt que de le recopier — c'est la seule construction où l'on ne
 * PEUT PAS remonter le chiffre en oubliant la phrase.
 */
export function habillageAffichePdf(centimes) {
  if (centimes > 0) return { libelle: LIBELLE_PDF, detail: DETAIL_PDF }
  return {
    libelle: `${LIBELLE_PDF} (${MENTION_GRATUITE})`,
    // ⚠️ AUCUN CHIFFRE DANS CETTE PHRASE AJOUTÉE. Le test de densité relit TOUS
    // les nombres du détail pour en déduire la fourchette annoncée : y glisser
    // une année ou un pourcentage fausserait la borne haute ou basse.
    detail: `${DETAIL_PDF}. Article ${MENTION_GRATUITE} pendant la mise en service de la boutique : aucun montant n’est débité.`,
  }
}

export const ARTICLES = {
  // ── Le fichier seul ───────────────────────────────────────────────────────
  'affiche-pdf': {
    ...habillageAffichePdf(PRIX_AFFICHE_PDF_CENTIMES),
    centimes: PRIX_AFFICHE_PDF_CENTIMES,
    livrable: 'fichier',
  },
  // ── L'affiche imprimée et livrée (dropshipping) ───────────────────────────
  // Un article PAR FORMAT : le coût de production et le port n'ont rien à voir
  // entre un A4 et un 61 × 91.
  'affiche-print-30x40': { libelle: 'Affiche imprimée 30 × 40 cm', detail: 'Papier mat 200 g, livrée', centimes: 4900, livrable: 'impression', format: '30x40' },
  'affiche-print-40x50': { libelle: 'Affiche imprimée 40 × 50 cm', detail: 'Papier mat 200 g, livrée', centimes: 5900, livrable: 'impression', format: '40x50' },
  'affiche-print-50x70': { libelle: 'Affiche imprimée 50 × 70 cm', detail: 'Papier mat 200 g, livrée', centimes: 6900, livrable: 'impression', format: '50x70' },
  'affiche-print-61x91': { libelle: 'Affiche imprimée 61 × 91 cm', detail: 'Papier mat 200 g, livrée', centimes: 8900, livrable: 'impression', format: '61x91' },
}

/** Un article, ou null. Jamais d'article inventé à partir d'une entrée client. */
export function article(id) {
  return (typeof id === 'string' && Object.hasOwn(ARTICLES, id) && ARTICLES[id]) || null
}

// ══════════ LES PAYS OÙ L'ON REFUSE DE VENDRE, ET POURQUOI ══════════════════
//
// ⚠️ LE ROYAUME-UNI RÉCLAME LA TVA DÈS LA PREMIÈRE VENTE à un particulier
// britannique — pas de seuil, pas de franchise. Tant que ShibuMap n'y est pas
// immatriculé, chaque vente au RU serait une infraction. On l'exclut donc du
// paiement lui-même plutôt que de compter sur une phrase de conditions
// générales que personne ne lit.
//
// (Le reste de l'Union relève de la franchise transfrontalière — c'est le point
// que le SIE doit confirmer AVANT d'ouvrir le drapeau de commerce.)
export const PAYS_EXCLUS = ['GB']

/**
 * Les pays de facturation que Stripe doit accepter.
 * Liste blanche courte au lancement : on ouvre au fur et à mesure, il est plus
 * facile d'ajouter un pays que de rattraper une TVA non déclarée.
 */
export const PAYS_AUTORISES = [
  'FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL', 'PT', 'AT', 'IE',
  'DK', 'SE', 'FI', 'PL', 'CZ', 'CA', 'US',
].filter((p) => !PAYS_EXCLUS.includes(p))

/** Le prix affiché, pour que l'interface et la caisse ne se contredisent pas. */
export function prixEuros(id) {
  const a = article(id)
  return a ? a.centimes / 100 : null
}
