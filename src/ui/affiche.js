// L'AFFICHE — la passe qu'Adrien a demandée avant tout rendu : « il faut que
// l'utilisateur voie le poster qu'il va avoir ».
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CET ÉCRAN DOIT PROUVER, ET POURQUOI CE N'EST PAS UNE FENÊTRE MODALE
// ═══════════════════════════════════════════════════════════════════════════
//
// L'objet de la page EST l'affiche. Une fenêtre modale poserait un formulaire
// par-dessus la carte et demanderait de payer sur la foi d'une vignette : c'est
// exactement le moment où l'on renonce. On prend donc tout l'écran, on met la
// feuille au centre, et l'interface se range sur un rail à droite.
//
// ⚠️ ET L'APERÇU EST UN VRAI RENDU, PAS UN RECADRAGE DE LA CAPTURE D'ÉCRAN.
// C'est le point qui justifie la passe entière : un 50 × 70 est BEAUCOUP plus
// haut que l'écran. Recadrer la vue actuelle montrerait une image que
// l'utilisateur ne recevra jamais — il découvrirait le vrai cadrage après
// avoir payé. On refait donc un rendu au format demandé, à basse résolution,
// à chaque changement de forme. Le champ HORIZONTAL est conservé : c'est le
// choix le plus prévisible, la carte ne « recule » pas quand on passe en
// portrait, elle montre plus de ciel et plus de premier plan.
//
// Le rendu d'impression (tuilé, 300 dpi) et le PDF ne vivent PAS ici : ils
// n'arrivent qu'après paiement. Voir src/print-page.js pour la géométrie.

import './affiche.css'
import { el } from './kit.js'
import {
  FORMATS_AFFICHE, geometriePage, DPI_IMPRESSION, pxPourMm,
  CADRAGE_DEFAUT, CADRAGE_ZOOM_MIN, CADRAGE_ZOOM_CURSEUR_MAX, cadrageValide,
} from '../print-page.js'
// La grille des formats que CETTE machine peut rendre. Le module ne touche à
// rien : il lit des plafonds, en déduit une limite, et `degradePour` fait le
// reste. Voir src/sonde-materielle.js.
import { dpiRetenu, ligneFormat, replierSur, grilleAffiche } from '../sonde-materielle.js'
import { PLAFOND_REFERENCE, dpiPour } from '../export-dpi.js'
// ⚠️ LE TEXTE DU CARTOUCHE VIENT DU COMPOSITEUR, IL N'EST PLUS ÉCRIT ICI. Deux
// façons de formater une latitude, c'est un écart entre l'aperçu et le fichier
// vendu qui ne se découvre qu'après la vente. Le compositeur est la source ;
// cet écran l'affiche. Voir src/compositeur-affiche.js.
import { coordonneesCartouche, texteCartouche, SIGNATURE_TEXTE } from '../compositeur-affiche.js'
// Les décisions autour du point de netteté — sans WebGL, donc testables sans
// navigateur. Ce module dit POURQUOI un point du monde ne survit pas tel quel à
// un changement de sens, et porte les mots de l'avertissement d'achat.
import {
  estSurLaFeuille, viseesDeRepli, doitAvertirAvantAchat,
  AVERTISSEMENT_NETTETE, MESSAGE_POINT_REPLACE,
} from '../affiche-nettete.js'
// La taille écrite sous la feuille et la cause d'une densité dégradée. Elles
// sont dehors pour la même raison que les décisions de netteté ci-dessus :
// elles se fabriquent à partir de nombres, donc elles se testent sous node.
import { tailleSousFeuille, noteDensite } from '../affiche-mots.js'

// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX AFFICHÉ — UNE ÉTIQUETTE, PAS UN PRIX
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE CHIFFRE NE DÉCIDE DE RIEN, et c'est important de le lire ainsi : le
// prix qui engage vit dans le catalogue SERVEUR
// (netlify/functions/_paiement-catalogue.mjs), hors de portée du navigateur.
// Celui-ci n'est que ce que l'acheteur LIT avant de cliquer. Le changer ici ne
// change pas ce qui sera facturé ; ça change ce qu'on lui a promis.
//
// C'est aussi pour ça qu'un test refuse qu'ils divergent : tenir les deux
// ensemble n'est pas une discipline à se rappeler, c'est une condition de
// `npm test`.
//
// 0 = gratuité temporaire (2026-08-06), le temps d'éprouver toute la chaîne en
// production. Pour revenir à 19 € : remettre `19` ici ET `1900` dans le
// catalogue serveur. Le texte du bouton et la phrase de réassurance, eux, se
// remettent seuls — ils sont dérivés de ce chiffre.
export const PRIX_AFFICHE_EUR = 0

/**
 * Ce qui s'écrit à gauche dans le bouton d'achat.
 *
 * ⚠️ « TÉLÉCHARGER », PAS « RECEVOIR ». Depuis que l'écran propose DEUX issues —
 * le fichier maintenant, l'impression un jour — « recevoir » ne distingue plus
 * rien : on reçoit un fichier comme on reçoit un colis. Le verbe doit dire
 * lequel des deux on vient de choisir.
 */
export const CTA_TELECHARGER = 'Télécharger le fichier'

/**
 * Ce qui s'écrit dans le bouton, à droite de `CTA_TELECHARGER`.
 *
 * ⚠️ « Gratuit » PLUTÔT QUE « 0 € ». Un bouton qui annonce « 0 € » se lit comme
 * un bug d'affichage ou comme un prix pas encore chargé — on hésite, on
 * n'ose pas cliquer, et l'essai grandeur nature ne se fait pas.
 */
export function etiquettePrix(euros = PRIX_AFFICHE_EUR) {
  return euros > 0 ? `${euros} €` : 'Gratuit'
}

/**
 * La phrase sous le bouton. Rendue en HTML (elle porte un `<b>`), et DÉRIVÉE du
 * prix pour la même raison que le libellé vendu : à 0 €, « dès le paiement
 * validé » ferait chercher une carte à quelqu'un à qui Stripe n'en demandera
 * jamais, et « pas de compte à créer » n'est plus le doute principal.
 */
export function phraseRassurance(euros = PRIX_AFFICHE_EUR) {
  // ⚠️ CETTE PHRASE A CHANGÉ PARCE QUE LA CHAÎNE A CHANGÉ. Elle promettait un
  // envoi par mail — c'était vrai tant que le fichier n'existait pas avant le
  // paiement. Il est maintenant fabriqué AVANT, mis au coffre, et rendu au
  // retour de la caisse : promettre le mail ferait attendre pour rien quelqu'un
  // qui a déjà son fichier à l'écran.
  // ⚠️ ET ELLE TIENT SUR UNE LIGNE DEPUIS LE RANGEMENT DU PANNEAU. Elle en
  // faisait trois — un `<br>` plus deux replis — dans un pied qui mangeait 37 %
  // du rail. Chaque ligne de réassurance ici est une ligne de réglage en moins
  // à l'écran ; la promesse tient en une phrase, le reste était de l'emphase.
  if (euros > 0) {
    return 'Le PDF se télécharge dès le paiement validé. <b>Pas de compte à créer.</b>'
  }
  // ⚠️ RÉÉCRITE PARCE QU'ELLE PARLAIT COMME UN CAHIER DES CHARGES (Adrien,
  // 2026-08-06 : « le texte n'est pas très français, optimise »). Ce qu'elle
  // disait, et pourquoi ça ne marchait pas :
  //   · « pendant la mise en service » — du vocabulaire d'ingénieur. Personne
  //     ne met une affiche « en service » ; celui qui lit ça cherche ce qu'il a
  //     raté.
  //   · les deux-points suivis d'une énumération — la tournure d'un formulaire,
  //     pas d'une phrase qu'on dirait à quelqu'un.
  //   · « dès le retour » — le retour DE QUOI ? Il ne sait pas encore qu'il va
  //     partir chez Stripe ; la phrase répond à une question qu'il ne s'est pas
  //     posée.
  // Ce qui la remplace dit les trois choses DANS L'ORDRE OÙ ELLES ARRIVENT :
  // c'est gratuit, on ne te demande rien, tu repars avec le fichier.
  return 'Le fichier est <b>offert</b>, sans carte bancaire. Tu récupères ton PDF juste après.'
}

// Les deux phrases qui se FABRIQUENT à partir de nombres — la taille écrite
// sous la feuille et la cause d'une densité dégradée — vivent dans un module
// sans DOM, pour la même raison que `affiche-nettete.js` : une chaîne
// construite se teste avec des VALEURS, pas avec une expression régulière
// posée sur ce fichier-ci (qui importe une feuille de style, donc ne se charge
// pas sous node). Réexportées pour les appelants ; la définition est là-bas.
export { tailleSousFeuille, noteDensite }

// La plus grande dimension de l'aperçu, en pixels. Assez pour juger un cadrage
// et une couleur, assez petit pour que changer de format reste instantané.
const APERCU_MAX_PX = 1100

/**
 * Un poids d'octets, en clair.
 *
 * ⚠️ ON L'ANNONCE, ET CE N'EST PAS UN ORNEMENT : une affiche pèse 21 à 89 Mo en
 * PNG. Quelqu'un qui reçoit ça par mail sur un forfait mobile a le droit de le
 * savoir avant de payer, pas après.
 */
export function poidsLisible(octets) {
  if (!(octets > 0)) return ''
  const mo = octets / 1e6
  return mo >= 10 ? `${Math.round(mo)} Mo` : `${mo.toFixed(1).replace('.', ',')} Mo`
}

const ICONE_CROIX = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

/**
 * Le nom d'un format tel qu'il s'écrit SOUS une pastille.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ L'UNITÉ TOMBE, ET C'EST CE QUI REMET LA GRILLE D'APLOMB
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La grille des sept formats était posée de travers, et la cause n'était ni le
 * `gap`, ni la pastille, ni la cellule sélectionnée : c'étaient LES MOTS.
 * `.af-formats` demande quatre colonnes égales (`repeat(4, 1fr)`), mais `1fr`
 * vaut `minmax(auto, 1fr)` — une colonne ne descend jamais sous la largeur
 * minimale de son contenu. Or les libellés sont en `white-space: nowrap`, et
 * « 30 × 40 cm » mesure 56 px là où « A4 » en mesure 13,5. Mesuré à l'écran
 * (rail de 344 px, grille de 276 px) : la somme des quatre minimums remplissait
 * EXACTEMENT la grille, il ne restait plus un pixel à répartir, et les colonnes
 * sortaient à 41,9 / 70,1 / 64 / 70,1 px. Les sept pastilles ne tombaient donc
 * pas sur un pas régulier — 44, puis 55, puis 54 px entre elles, avec 10 px de
 * marge à gauche contre 23 à droite.
 *
 * Pourquoi ça se voyait EN PORTRAIT et pas en paysage : en paysage la pastille
 * fait 30 px de large et remplit sa cellule, l'irrégularité passe pour de la
 * respiration. En portrait elle n'en fait que 20 à 24 et flotte au milieu — le
 * pas irrégulier devient la seule chose qu'on lise.
 *
 * Le « cm » répété quatre fois était donc du bruit qui coûtait la mise en page.
 * Il ne manque à personne : la légende dit « Format » et la ligne de vérité,
 * trois centimètres plus bas, écrit « 50 × 70 cm · 250 dpi · … ». Le libellé
 * complet reste dans l'infobulle du bouton.
 */
export function etiquetteFormat(label) {
  return String(label || '').split(' · ')[0].replace(/\s*cm$/, '')
}

// Réexporté pour les appelants historiques : la définition, elle, est dans le
// compositeur — c'est lui qui l'écrit sur le fichier vendu.
export { coordonneesCartouche }

/**
 * La ligne de vérité : ce que l'acheteur reçoit, en clair.
 *
 * ⚠️ ELLE ANNONCE LE FORMAT FINI, PAS LE FORMAT RENDU. Le fond perdu est de la
 * matière qui part au massicot ; l'annoncer gonflerait le produit de 6 mm sur
 * chaque axe et personne ne mesurerait la même chose que nous.
 */
export function ligneVerite(geo) {
  if (!geo) return []
  const [w, h] = geo.finiPx
  return [
    `${geo.largeurMm / 10} × ${geo.hauteurMm / 10} cm`,
    `${geo.dpi} dpi`,
    `${w.toLocaleString('fr-FR')} × ${h.toLocaleString('fr-FR')} px`,
    'PDF',
  ]
}

/**
 * Ouvre l'écran d'affiche.
 *
 * @param {object} ctx
 * @param {() => Promise<string>} ctx.rendreApercu - rend la scène au ratio
 *   demandé et rend une URL d'image. Reçoit { largeur, hauteur, hauteurMm,
 *   cadrage, pointNet } — `hauteurMm` est la hauteur physique du tirage, dont
 *   se déduit la densité réelle de la vignette (export-traits.js).
 * @param {() => {nom:string, lat:number, lon:number, altMax:number|null}} ctx.lieu
 * @param {() => object} [ctx.sonder] - la sonde matérielle, exécutée UNE FOIS à
 *   l'ouverture : elle alloue pour de vrai et rend `{ limitePx, grille, … }`.
 *   Voir src/sonde-materielle.js.
 * @param {(o) => Promise<string>} [ctx.rendreValidation] - l'écran de validation,
 *   produit par le COMPOSITEUR (pas par le DOM) et réduit à 1 100 px.
 * @param {(o) => Promise<object>} [ctx.rendreTirage] - le rendu pavé du fichier.
 * @param {(commande) => void} [ctx.onCommander] - le pas suivant (paiement)
 */
export function ouvrirAffiche(ctx) {
  // ═══════ CE QUE CETTE MACHINE-CI PEUT IMPRIMER ═══════════════════════════
  //
  // ⚠️ À L'OUVERTURE, PAS AU CLIC. La grille des formats en dépend : proposer un
  // 61 × 91 puis le retirer au moment de payer serait pire que ne l'avoir jamais
  // montré. La sonde alloue vraiment (une cible de tuile, un canevas de bande) —
  // c'est une image de retard, une fois, contre un tirage raté.
  //
  // Sans sonde branchée, on retombe sur la TABLE NOMINALE (`PLAFOND_REFERENCE`,
  // le plafond sous lequel aucune densité nominale ne déborde) : c'est le
  // comportement d'avant, et il ne doit pas dépendre de l'existence de ce
  // paramètre.
  const sonde = (() => {
    try {
      return ctx.sonder?.() || null
    } catch (err) {
      console.warn('[affiche] sonde matérielle :', err)
      return null
    }
  })()
  const grilleFormats = sonde?.grille?.length ? sonde.grille : grilleAffiche({ limitePx: PLAFOND_REFERENCE })

  const etat = {
    format: '50x70',
    // ⚠️ PAYSAGE PAR DÉFAUT, contre la tradition de l'affiche — et c'est la
    // première fournée d'aperçus qui a tranché. Le bloc est une composition
    // LARGE : en portrait, à champ horizontal conservé, la moitié haute de la
    // feuille est du ciel vide. Ouvrir sur le format où l'objet remplit sa page
    // évite de faire porter à l'utilisateur un mauvais premier cadrage.
    orientation: 'paysage',
    cartouche: true,
    cartoucheSombre: false,
    titre: ctx.lieu?.().nom || '',
    // ⚠️ LE CADRAGE PART DE « TOUT LE SOCLE », PAS DE LA VUE À L'ÉCRAN. Adrien :
    // « par défaut, la totalité du socle est visible sur l'affiche ». À l'écran
    // on tourne autour du bloc et on s'approche — ce qu'on regarde n'est presque
    // jamais l'objet entier. L'affiche s'ouvre sur le bloc complet ; c'est
    // ENSUITE qu'on resserre. Voir distanceCadrage dans print-page.js.
    cadrage: { ...CADRAGE_DEFAUT },
    logo: null, // { url, coin, taille }
    // ⚠️ UN POINT DU MONDE, PAS UNE DISTANCE — voir cadrerAffiche dans main.js :
    // l'affiche déplace la caméra, donc une distance mesurée à l'écran
    // désignerait un autre plan une fois l'affiche cadrée.
    pointNet: null,
    // ⚠️ ET, À CÔTÉ, L'ENDROIT DE LA FEUILLE OÙ IL A VISÉ — en fraction de
    // cadre (−1 à +1), pas en pixels. C'est ce qui manquait pour survivre à un
    // changement de sens : le point du monde ne bouge pas, mais le cadre est
    // entièrement refait, et il faut bien savoir OÙ re-viser. Voir
    // `recalerPointNet` et src/affiche-nettete.js.
    //
    // Ce couple ne traverse PAS le paiement (afficheSerialisable ne retient que
    // le point du monde) : au retour on repart donc du centre si le cadre a
    // changé, ce qui est le comportement d'un premier chargement. C'est assumé
    // — élargir le format du panier touche au tunnel de paiement.
    visee: null, // { u, v }
    // ⚠️ LA COMPOSITION RETROUVÉE APRÈS UN ALLER-RETOUR CHEZ STRIPE. Partir
    // payer est une NAVIGATION : l'application est déchargée, et sans ceci
    // l'acheteur qui renonce revient devant une affiche vierge et doit tout
    // recomposer. Voir src/paiement.js (afficheSerialisable) pour ce qui
    // traverse — le LOGO importé, lui, ne traverse pas : c'est une URL d'objet,
    // elle meurt avec le document.
    ...(ctx.etatInitial || {}),
  }

  // ⚠️ LE DÉFAUT N'EST PAS TOUJOURS JOUABLE. Sur une machine plafonnée à
  // 4 096 px, le 50 × 70 — le format d'ouverture de la boutique — sort de la
  // grille (tâche 1). S'ouvrir dessus montrerait une feuille vide et un bouton
  // qui ne peut rien produire. On replie donc AVANT le premier rendu, en gardant
  // le format plutôt que le sens quand on peut.
  {
    const repli = replierSur(grilleFormats, etat.format, etat.orientation)
    if (repli) { etat.format = repli.format; etat.orientation = repli.orientation }
  }

  /**
   * La géométrie de la page COURANTE, à la densité que cette machine tient.
   *
   * ⚠️ C'EST LA SEULE FABRIQUE DE `geo` DE CET ÉCRAN. Il en existait trois
   * appels à `DPI_IMPRESSION` en dur ; avec une densité qui peut être dégradée,
   * trois sources auraient fini par annoncer une densité et en rendre une autre.
   */
  const geoCourante = () => geometriePage({
    format: etat.format,
    orientation: etat.orientation,
    dpi: dpiRetenu(grilleFormats, etat.format, etat.orientation) ?? DPI_IMPRESSION,
  })

  document.body.classList.add('af-mode')
  const scene = el('div', 'af-scene')
  scene.setAttribute('role', 'dialog')
  scene.setAttribute('aria-modal', 'true')
  scene.setAttribute('aria-label', 'Aperçu de l’affiche')

  // ── l'estrade ─────────────────────────────────────────────────────────────
  const stage = el('div', 'af-stage')
  const wrap = el('div', 'af-sheet-wrap')
  const sheet = el('div', 'af-sheet attente')
  const img = el('img', 'af-carte')
  img.alt = ''
  const cartouche = el('div', 'af-cartouche')
  const cartGauche = el('div')
  const cartLieu = el('h2', 'af-cart-lieu')
  const cartSous = el('div', 'af-cart-sous')
  cartGauche.append(cartLieu, cartSous)
  const cartAlt = el('div', 'af-cart-alt')
  cartouche.append(cartGauche, cartAlt)
  const logoImg = el('img', 'af-logo')
  logoImg.alt = ''
  logoImg.style.display = 'none'
  // ⚠️ LA SIGNATURE EST DANS LE FICHIER VENDU, et elle est ici pour qu'on la
  // VOIE en composant. Le compositeur la pose sur le PDF ; si l'écran d'édition
  // ne la montrait pas, elle apparaîtrait pour la première fois sur l'écran de
  // validation — c'est-à-dire exactement l'écart entre l'aperçu et le fichier
  // que tout ce chantier existe pour supprimer. Son texte vient donc de là-bas,
  // il ne se recopie pas.
  const signature = el('div', 'af-signature', SIGNATURE_TEXTE)
  signature.setAttribute('aria-hidden', 'true')
  sheet.append(img, logoImg, cartouche, signature)
  // La taille, écrite là où on la cherche : sous l'objet qu'elle mesure. Elle
  // ne fait PAS partie de l'affiche — elle est hors de `.af-sheet`, donc hors
  // de tout ce qui sera imprimé. Voir `tailleSousFeuille`.
  const taille = el('p', 'af-taille')
  wrap.append(sheet, taille)
  stage.append(wrap)

  // ── le rail ───────────────────────────────────────────────────────────────
  const rail = el('aside', 'af-rail')
  const corps = el('div', 'af-rail-corps')
  corps.append(el('h1', null, 'Ton affiche'))
  corps.append(
    el(
      'p',
      'af-intro',
      'Voici exactement le fichier que tu recevras. Choisis un format : le cadrage se refait à chaque fois.'
    )
  )

  // ══════ FORMAT ET SENS SONT UNE SEULE DÉCISION ════════════════════════════
  //
  // ⚠️ ILS ÉTAIENT DEUX GROUPES, AVEC DEUX LÉGENDES, ET ÇA COÛTAIT DEUX FOIS.
  // Deux fois en pixels — une légende, son interligne et la marge d'un groupe,
  // soit une trentaine de pixels dans un rail où il en manquait deux cents.
  // Et deux fois en attention : « Format » puis « Sens » se lisent comme deux
  // questions successives, alors qu'on n'en pose qu'une, la FORME DU PAPIER.
  // Personne ne choisit un 50 × 70 sans savoir s'il le veut debout ou couché.
  //
  // Le segment se colle donc SOUS la grille de pastilles, dans le même bloc :
  // les sept formes, puis le sens qu'on leur donne. Aucun réglage n'est retiré
  // — c'est un rangement, pas une amputation.
  const gFormat = el('div', 'af-groupe')
  gFormat.append(el('p', 'af-legende', 'Format'))
  const grilleEl = el('div', 'af-formats')
  const boutonsFormat = new Map()
  // La pastille de chaque format, gardée à part : `appliquer` la redessine à
  // chaque changement de sens.
  const vignettesFormat = new Map()
  for (const f of FORMATS_AFFICHE) {
    const b = el('button', 'af-fmt')
    b.type = 'button'
    const vignette = el('i')
    const nom = el('b', null, etiquetteFormat(f.label))
    // Le libellé entier — unité comprise — reste à un survol de distance.
    b.title = f.label
    b.append(vignette, nom)
    vignettesFormat.set(f.id, vignette)
    b.addEventListener('click', () => {
      // Changer de format peut changer le sens : un 61 × 91 qui ne tient qu'en
      // portrait ne doit pas laisser le segment sur « Paysage » et rendre au
      // hasard. `replierSur` garde le format demandé et ajuste le sens.
      const repli = replierSur(grilleFormats, f.id, etat.orientation)
      if (!repli) return
      etat.format = repli.format
      etat.orientation = repli.orientation
      appliquer({ refaireRendu: true })
    })
    boutonsFormat.set(f.id, b)
    grilleEl.append(b)
  }
  gFormat.append(grilleEl)

  // ══════ LA PASTILLE MONTRE LE SENS QU'ON AURA ═════════════════════════════
  //
  // ⚠️ ELLE MONTRAIT TOUJOURS UNE AFFICHE DEBOUT. On choisissait « Paysage », le
  // segment le disait, la feuille au centre basculait — et les sept pastilles
  // continuaient d'annoncer sept formats en hauteur. Or c'est la FORME qu'on lit
  // avant le nom : une pastille qui ment sur la forme du format est pire qu'une
  // pastille générique, elle fait choisir de travers.
  //
  // ⚠️ ET LE PLUS GRAND CÔTÉ NE CHANGE PAS. Poser une seule dimension (« 26 px
  // de large ») ferait varier la hauteur de la rangée d'un sens à l'autre : la
  // grille sauterait de vingt pixels à chaque bascule, et on ne verrait plus la
  // seule chose qui compte, la proportion. On inscrit donc chaque format dans un
  // carré de côté fixe, et il occupe ce carré dans le sens qui est le sien.
  //
  // ⚠️ ET LA PROPORTION SORT DE `geometriePage`, PAS D'UN CALCUL D'ICI. C'est la
  // fonction qui donne déjà sa forme à la FEUILLE, deux lignes plus bas dans
  // `appliquer`. Retourner les millimètres à la main dans la pastille serait
  // une seconde façon de décider d'un sens : le jour où l'une des deux change,
  // la pastille annoncerait une forme et la feuille en montrerait une autre.
  const COTE_VIGNETTE = 30
  // ⚠️ ET LA RANGÉE RÉSERVE CE CARRÉ, MÊME QUAND LA PASTILLE EST COUCHÉE. Le
  // JS ne posait que la taille de la pastille : en paysage sa HAUTEUR retombait
  // à 20-24 px, et les deux rangées de la grille n'avaient plus la même hauteur
  // (mesuré : 68,3 px puis 65,9 px) — les noms de formats ne s'alignaient donc
  // pas d'une rangée à l'autre. La bande qui la contient est maintenant haute
  // de `COTE_VIGNETTE` quoi qu'il arrive, et la pastille s'y centre. La
  // constante reste ICI, en un seul exemplaire ; le CSS ne fait que la lire.
  grilleEl.style.setProperty('--af-cote-vignette', `${COTE_VIGNETTE}px`)

  /** Dessine une pastille à la proportion exacte d'un format, dans un sens donné. */
  function dessinerVignette(vignette, id, sens) {
    const g = geometriePage({ format: id, orientation: sens, fondPerduMm: 0 })
    if (!g) return
    const k = COTE_VIGNETTE / Math.max(g.largeurMm, g.hauteurMm)
    vignette.style.width = `${(g.largeurMm * k).toFixed(2)}px`
    vignette.style.height = `${(g.hauteurMm * k).toFixed(2)}px`
  }

  // ⚠️ DÉGRADER D'ABORD, CACHER ENSUITE — la décision d'Adrien, appliquée ici et
  // nulle part ailleurs. La densité, elle, a déjà été baissée par `degradePour` ;
  // ce qui suit ne retire de la grille QUE ce qui ne passe même pas au plancher
  // de 150 dpi. Un format caché est caché, pas grisé : un bouton désactivé
  // demande « pourquoi ? » sans jamais y répondre.
  for (const [id, b] of boutonsFormat) b.hidden = !ligneFormat(grilleFormats, id)?.dispo

  // Le sens, sans légende à lui : il est dans le bloc « Format », juste sous
  // les pastilles, et celles-ci montrent déjà la forme qu'il donne.
  const seg = el('div', 'af-seg af-seg-sens')
  const bPortrait = el('button', null, 'Portrait')
  const bPaysage = el('button', null, 'Paysage')
  const boutonsSens = new Map([[bPortrait, 'portrait'], [bPaysage, 'paysage']])
  for (const [b, v] of boutonsSens) {
    b.type = 'button'
    b.addEventListener('click', () => {
      // Un sens qui ne tient pas sur cette machine est caché, pas cliquable :
      // ce garde-fou est là pour le clavier, qui atteint ce qu'on a oublié.
      if (!ligneFormat(grilleFormats, etat.format)?.[v]) return
      etat.orientation = v
      appliquer({ refaireRendu: true })
    })
  }
  seg.append(bPortrait, bPaysage)
  gFormat.append(seg)

  // Le cartouche : ce qui distingue une affiche d'une capture d'écran.
  const gCart = el('div', 'af-groupe')
  gCart.append(el('p', 'af-legende', 'Légende imprimée'))
  const bascule = el('label', 'af-bascule')
  const coche = el('input')
  coche.type = 'checkbox'
  coche.checked = etat.cartouche
  bascule.append(el('span', null, 'Nom du lieu et coordonnées'), coche)
  const champ = el('input', 'af-champ')
  champ.type = 'text'
  champ.placeholder = 'Nom sur l’affiche'
  champ.setAttribute('aria-label', 'Nom imprimé sur l’affiche')
  champ.value = etat.titre
  const basculeEncre = el('label', 'af-bascule')
  const cocheEncre = el('input')
  cocheEncre.type = 'checkbox'
  // « Écrire en clair (fond sombre) » commençait par un verbe et ne disait pas
  // ce qui s'écrivait ; la case décrit maintenant l'état qu'elle donne.
  basculeEncre.append(el('span', null, 'Texte clair sur fond sombre'), cocheEncre)
  // ⚠️ LES NOMS DE VILLES SONT UN RÉGLAGE DE LA CARTE, PAS DU CARTOUCHE — et
  // c'est pour ça qu'ils ne se traitent pas comme les deux cases au-dessus.
  // Adrien : « les noms des villes sont coupés, il doit pouvoir les
  // désactiver. » Les couper sur l'affiche ne doit PAS couper la carte qu'il
  // avait composée : on flippe le vrai réglage pour que l'aperçu soit un vrai
  // rendu, et on le remet en sortant (voir `partir`).
  const basculeLieux = el('label', 'af-bascule')
  const cocheLieux = el('input')
  cocheLieux.type = 'checkbox'
  cocheLieux.checked = ctx.lieuxAffiches?.() !== false
  basculeLieux.append(el('span', null, 'Noms des villes sur la carte'), cocheLieux)
  cocheLieux.addEventListener('change', () => {
    ctx.setLieuxAffiches?.(cocheLieux.checked)
    appliquer({ refaireRendu: true })
  })
  // ⚠️ LE CARTOUCHE GARDE SES DEUX DÉCISIONS PREMIÈRES — est-ce qu'on imprime
  // une légende, et sous quel nom. L'encre et les noms de villes, eux, sont des
  // FINITIONS : on ne les touche qu'une fois la composition trouvée. Ils
  // descendent dans le repli d'en dessous.
  gCart.append(bascule, champ)

  coche.addEventListener('change', () => { etat.cartouche = coche.checked; appliquer({}) })
  cocheEncre.addEventListener('change', () => { etat.cartoucheSombre = cocheEncre.checked; appliquer({}) })
  champ.addEventListener('input', () => { etat.titre = champ.value; appliquer({}) })

  // ── Cadrage : trois curseurs, et la même chose à la main sur la feuille ────
  //
  // Les curseurs ET le geste direct, parce qu'ils ne servent pas au même
  // moment : on tire l'image du pouce pour trouver le cadrage, puis on ajuste
  // au curseur quand on sait ce qu'on cherche. Les deux écrivent le même état.
  const gCadre = el('div', 'af-groupe')
  const enTete = el('div', 'af-legende-ligne')
  enTete.append(el('p', 'af-legende', 'Cadrage'))
  const bReset = el('button', 'af-lien')
  bReset.type = 'button'
  bReset.textContent = 'Tout le socle'
  enTete.append(bReset)
  gCadre.append(enTete)

  const curseur = (label, min, max, pas, lire, ecrire) => {
    const rang = el('label', 'af-curseur')
    const nom = el('span', null, label)
    const input = el('input')
    input.type = 'range'
    input.min = min
    input.max = max
    input.step = pas
    input.addEventListener('input', () => {
      ecrire(parseFloat(input.value))
      appliquer({ refaireRendu: 'differe' })
    })
    rang.append(nom, input)
    return { rang, sync: () => { input.value = String(lire()) } }
  }
  const cZoom = curseur('Zoom', CADRAGE_ZOOM_MIN, CADRAGE_ZOOM_CURSEUR_MAX, 0.01,
    () => etat.cadrage.zoom, (v) => { etat.cadrage.zoom = v })
  const cX = curseur('Horizontal', -1.5, 1.5, 0.005,
    () => etat.cadrage.x, (v) => { etat.cadrage.x = v })
  const cY = curseur('Vertical', -1.5, 1.5, 0.005,
    () => etat.cadrage.y, (v) => { etat.cadrage.y = v })
  gCadre.append(cZoom.rang, cX.rang, cY.rang)
  bReset.addEventListener('click', () => {
    etat.cadrage = { ...CADRAGE_DEFAUT }
    appliquer({ refaireRendu: true })
  })

  // ── Logo ──────────────────────────────────────────────────────────────────
  const gLogo = el('div', 'af-groupe')
  gLogo.append(el('p', 'af-legende', 'Ton logo'))
  const fichier = el('input')
  fichier.type = 'file'
  fichier.accept = 'image/png,image/jpeg,image/svg+xml,image/webp'
  fichier.id = 'af-logo-fichier'
  fichier.className = 'af-fichier'
  const etiqFichier = el('label', 'af-depot')
  etiqFichier.setAttribute('for', 'af-logo-fichier')
  etiqFichier.textContent = 'Choisir une image…'
  const logoOutils = el('div', 'af-logo-outils')
  const segCoin = el('div', 'af-seg af-seg-4')
  const COINS = [['hg', 'Haut g.'], ['hd', 'Haut d.'], ['bg', 'Bas g.'], ['bd', 'Bas d.']]
  const boutonsCoin = new Map()
  for (const [id, lab] of COINS) {
    const b = el('button', null, lab)
    b.type = 'button'
    b.addEventListener('click', () => {
      if (!etat.logo) return
      etat.logo.coin = id
      appliquer({})
    })
    boutonsCoin.set(id, b)
    segCoin.append(b)
  }
  const cTaille = curseur('Taille', 4, 26, 0.5,
    () => etat.logo?.taille ?? 12, (v) => { if (etat.logo) etat.logo.taille = v })
  const bRetirer = el('button', 'af-lien')
  bRetirer.type = 'button'
  bRetirer.textContent = 'Retirer le logo'
  bRetirer.addEventListener('click', () => {
    if (etat.logo?.url) URL.revokeObjectURL(etat.logo.url)
    etat.logo = null
    fichier.value = ''
    appliquer({})
  })
  logoOutils.append(segCoin, cTaille.rang, bRetirer)
  fichier.addEventListener('change', () => {
    const f = fichier.files?.[0]
    if (!f) return
    if (etat.logo?.url) URL.revokeObjectURL(etat.logo.url)
    // ⚠️ Le fichier ne QUITTE PAS le navigateur. Rien n'est téléversé : le logo
    // vit dans une URL d'objet locale, et ne partira qu'avec la commande.
    etat.logo = { url: URL.createObjectURL(f), coin: 'hg', taille: 12, nom: f.name }
    appliquer({})
  })
  gLogo.append(etiqFichier, fichier, logoOutils)

  // ══════ LES FINITIONS SE REPLIENT — ET SEULEMENT ELLES ════════════════════
  //
  // ⚠️ CE N'EST PAS UN ACCORDÉON, ET LA DIFFÉRENCE N'EST PAS UNE NUANCE. La
  // position d'Adrien est arrêtée : chaque réglage se voit instantanément dans
  // l'aperçu, et découper le panneau en étapes casserait la boucle « je tourne,
  // je regarde » qui EST le produit. Un panneau replié partout obligerait à
  // ouvrir un tiroir pour voir bouger la feuille — c'est exactement ce qu'on
  // refuse.
  //
  // Ce repli-ci est le seul, et il ne contient que ce qu'on règle EN DERNIER :
  // le logo (qu'on n'a le plus souvent pas), l'encre du cartouche, les noms de
  // villes. Aucune de ces trois décisions n'est nécessaire pour juger un
  // cadrage ; les trois ensemble pesaient ≈ 180 px, c'est-à-dire une section
  // entière volée aux réglages qu'on regarde vraiment.
  //
  // ⚠️ FERMÉ PAR DÉFAUT, ET RIEN N'EST RETIRÉ. Le produit se vend sur la
  // personnalisation : les treize décisions sont toujours là, à un clic, et le
  // repli ANNONCE ce qu'il contient plutôt que de le cacher.
  const finitions = el('details', 'af-finitions')
  const resumeFinitions = el('summary', null, 'Finitions')
  finitions.append(resumeFinitions, basculeEncre, basculeLieux, gLogo)

  // ══════ LA NETTETÉ PASSE DEVANT, QUAND IL Y A DU BOKEH ════════════════════
  //
  // Adrien : « l'utilisateur peut choisir le point de son bokeh dès que le
  // visuel charge avec le bokeh activé, c'est la première chose qu'on lui
  // propose avant même le reste ». C'est juste : sur une image à faible
  // profondeur de champ, tout le reste — format, cadrage — se juge à travers
  // ce qui est net. Choisir le format d'abord reviendrait à composer les yeux
  // fermés.
  //
  // Le groupe n'existe QUE si le gabarit porte du bokeh : un réglage sans effet
  // vaut mieux absent que grisé.
  const gNet = el('div', 'af-groupe af-groupe-net')
  // ⚠️ DÉCLARÉE DEHORS, REMPLIE DEDANS. `recalerPointNet` écrit dans cette
  // ligne sans avoir à savoir si le groupe existe : sans bokeh elle n'est
  // simplement jamais posée dans le DOM, et l'écrire ne coûte rien.
  const noteNet = el('p', 'af-note')
  noteNet.setAttribute('role', 'status')
  noteNet.hidden = true
  if (ctx.bokehActif?.()) {
    const enTeteNet = el('div', 'af-legende-ligne')
    enTeteNet.append(el('p', 'af-legende', 'Point de netteté'))
    const bViser = el('button', 'af-lien')
    bViser.type = 'button'
    bViser.textContent = 'Choisir'
    enTeteNet.append(bViser)
    const aideNet = el('p', 'af-aide', 'Clique sur l’affiche pour choisir ce qui doit être net. Le reste se fond.')
    gNet.append(enTeteNet, aideNet, noteNet)
    bViser.addEventListener('click', () => { viseur(true) })
    corps.append(gNet)
  }

  corps.append(gFormat, gCadre, gCart, finitions)

  // ── le pied : la vérité, puis l'action ────────────────────────────────────
  const pied = el('div', 'af-pied')
  const verite = el('div', 'af-verite')
  // La cause d'une densité dégradée, écrite seulement quand il y en a une.
  const noteDpi = el('p', 'af-note-dpi')
  noteDpi.hidden = true
  const cta = el('button', 'af-cta')
  cta.type = 'button'
  const ctaTexte = el('span', null, CTA_TELECHARGER)
  const ctaPrix = el('span', null, etiquettePrix())
  cta.append(ctaTexte, ctaPrix)
  const rassure = el('p', 'af-rassure')
  rassure.innerHTML = phraseRassurance()

  // ══════ DEUX ISSUES, ET UNE SEULE EST OUVERTE ═════════════════════════════
  //
  // Adrien : « il faut être clair ensuite : on télécharge l'affiche prête pour
  // impression, ou on effectue l'impression directement via un presta ShibuMap.
  // Mais ça il faut griser l'option car elle n'est pas encore prête. »
  //
  // ⚠️ UNE OPTION GRISÉE DOIT DIRE POURQUOI, ET SURTOUT S'IL FAUT L'ATTENDRE.
  // « Bientôt » tout seul laisse l'acheteur devant un calcul qu'il ne peut pas
  // faire : est-ce que je télécharge maintenant, ou est-ce que je reviens dans
  // trois jours ? La phrase répond aux deux d'un coup — on n'a pas encore
  // d'imprimeur, ET le fichier d'à côté s'imprime déjà partout. Aucune date
  // n'est promise : une date manquée coûte plus cher qu'une absence de date.
  //
  // ⚠️ ET DEPUIS LE RANGEMENT DU PANNEAU, C'EST UNE LIGNE, PLUS UN ENCADRÉ. Le
  // bloc bordé pesait ≈ 90 px de pied — pour une issue FERMÉE, sous un bouton
  // qu'on ne voyait déjà pas en même temps que « Format ». On paie une porte
  // close au prix d'une section de réglages ; c'était le mauvais échange.
  // La ligne garde tout ce qui comptait — le nom, la pastille « Bientôt » — et
  // la phrase descend d'un cran, sous un `<summary>` : elle reste dans la page,
  // lisible par le clavier et par la recherche, mais elle ne prend sa place que
  // quand quelqu'un veut savoir. Personne ne perd d'information ; l'écran
  // récupère quatre-vingts pixels.
  const issue = el('details', 'af-issue')
  const issueLigne = el('summary', 'af-issue-ligne')
  issueLigne.append(
    el('span', 'af-issue-nom', 'Faire imprimer et livrer'),
    el('i', 'af-issue-tag', 'Bientôt')
  )
  issue.append(
    issueLigne,
    el(
      'p',
      'af-issue-phrase',
      'Nous cherchons encore l’imprimeur. Le fichier ci-dessus, lui, s’imprime déjà chez n’importe quel professionnel.'
    )
  )

  // ══════ L'AVERTISSEMENT AVANT D'ENCAISSER ═════════════════════════════════
  //
  // Adrien : « il faudrait un avertissement très très compréhensible si le
  // bokeh est activé : attention ! avez-vous bien vérifié où s'effectue le
  // point sur votre photo ? […] à chaque fois que l'on va passer à l'achat. »
  //
  // ⚠️ L'ÉQUILIBRE EST DANS LE NOMBRE DE GESTES, PAS DANS LA GRAVITÉ DU TON.
  // Il ne doit pas s'esquiver par mégarde ; il ne doit pas non plus punir
  // quelqu'un qui achète sa cinquième affiche. Le compromis retenu, et
  // pourquoi :
  //   ① UN SEUL CLIC de plus, toujours au même endroit. Pas de case à cocher à
  //      chercher, pas de délai, pas de mot à retaper. Pour qui sait ce qu'il
  //      fait, c'est un clic ; pour qui ne le sait pas, c'est la seule fois où
  //      on lui aura dit.
  //   ② LE PANNEAU S'OUVRE AU-DESSUS DU BOUTON, ET LE BOUTON NE BOUGE PAS.
  //      ⚠️ LE SENS EST CONTRE-INTUITIF ET IL A ÉTÉ VÉRIFIÉ À L'ÉCRAN. Le pied
  //      est le bloc FIXE d'un rail en colonne (`.af-rail-corps` est le
  //      `flex: 1`) : il est ancré en BAS, donc il grandit vers le HAUT. Posé
  //      SOUS le bouton, le panneau faisait remonter le bouton de 224 px et
  //      glissait « C'est net au bon endroit » exactement sous le curseur qui
  //      venait de cliquer — un double-clic l'aurait traversé sans que personne
  //      ne lise rien. Posé au-dessus, le bouton et la phrase de réassurance ne
  //      bougent pas d'un pixel : le second clic d'un double-clic retombe sur le
  //      bouton d'achat, qu'on désactive tant que la question est posée.
  //      L'avertissement devient inesquivable par inadvertence sans bloquer.
  //   ③ LE CLAVIER PART SUR L'OPTION PRUDENTE. On donne le focus à « Déplacer
  //      le point », pas à « Continuer » : une Entrée réflexe doit coûter un
  //      aller-retour, jamais un fichier flou.
  //   ④ AUCUNE MÉMOIRE. `doitAvertirAvantAchat` ne consulte qu'un drapeau remis
  //      à faux à la fin de chaque tentative — « à chaque fois » au sens propre.
  const garde = el('div', 'af-garde')
  garde.hidden = true
  garde.setAttribute('role', 'group')
  garde.setAttribute('aria-label', 'Vérification du point de netteté')
  const gardeTitre = el('p', 'af-garde-titre', AVERTISSEMENT_NETTETE.titre)
  const gardePhrase = el('p', 'af-garde-phrase', AVERTISSEMENT_NETTETE.phrase)
  const gardeBoutons = el('div', 'af-garde-boutons')
  const bDeplacer = el('button', 'af-garde-non', AVERTISSEMENT_NETTETE.deplacer)
  bDeplacer.type = 'button'
  const bContinuer = el('button', 'af-garde-oui', AVERTISSEMENT_NETTETE.continuer)
  bContinuer.type = 'button'
  gardeBoutons.append(bDeplacer, bContinuer)
  garde.append(gardeTitre, gardePhrase, gardeBoutons)

  // ══════ LE PIED N'A PLUS DE LÉGENDE, ET C'EST MESURÉ ══════════════════════
  //
  // Il en portait une — « Comment on t'envoie ton affiche ? » — qui annonçait
  // les deux issues. Elle était juste, et elle a coûté trop cher : le pied FIXE
  // occupait 320 px, soit 37 % du rail, et il ne restait que 452 px de zone
  // défilante pour 920 px de contrôles. « Format » et « Ton logo » ne pouvaient
  // pas coexister à l'écran.
  //
  // ⚠️ CE QUI DISPARAÎT EST LA QUESTION, PAS LA RÉPONSE. Les deux issues sont
  // toujours là, l'une sous l'autre, et la fermée porte toujours son « Bientôt »
  // en toutes lettres : un bouton plein puis une ligne à filet se lisent COMME
  // un choix, sans qu'on ait besoin de l'annoncer. Une légende qui décrit ce
  // que les deux éléments d'en dessous montrent déjà est du commentaire, et le
  // commentaire se paie en réglages qu'on ne voit plus.
  //
  // (La règle du sujet, elle, n'a pas bougé — voir les libellés du tirage, plus
  // bas : « On rend ton fichier », pas « Rendu du fichier ».)
  pied.append(verite, noteDpi, garde, cta, rassure, issue)
  rail.append(corps, pied)

  // ── la sortie ─────────────────────────────────────────────────────────────
  const fermer = el('button', 'af-fermer')
  fermer.type = 'button'
  fermer.setAttribute('aria-label', 'Revenir à la carte')
  fermer.innerHTML = ICONE_CROIX

  scene.append(stage, rail)
  document.body.append(scene, fermer)
  requestAnimationFrame(() => scene.classList.add('open'))

  // ══════ LE POINT DE NETTETÉ SUIT LE CADRE ═════════════════════════════════
  //
  // ⚠️ LA CAUSE, ÉCRITE UNE FOIS POUR TOUTES. Le point est mémorisé en
  // coordonnées DU MONDE — c'est la bonne décision, `cadrerAffiche` explique
  // pourquoi une distance d'écran ne survivrait pas au recul de la caméra. Sa
  // PROFONDEUR était donc déjà recalculée à chaque rendu, correctement. Ce que
  // personne ne recalculait, c'est s'il était encore SUR LA FEUILLE : passer en
  // portrait refait le cadre entier (`distanceCadrage` dépend de l'aspect, la
  // caméra recule, le décalage recoupe), et le point pouvait en sortir. Mise au
  // point juste, sur un sujet qu'on ne voit plus : affiche entièrement floue,
  // sans un mot.
  //
  // Corriger « en projetant le point dans le nouveau cadre » n'aurait aucun
  // sens — un point du monde ne se déplace pas parce qu'on change de papier. On
  // VÉRIFIE, et on RE-VISE quand il faut, au même endroit de la feuille.
  //
  // @param {boolean} annoncer - dire à l'utilisateur que le point a bougé ; on
  //   se tait pour la toute première visée (il n'avait rien choisi, il n'y a
  //   rien à lui apprendre) et quand c'est LUI qui vient de cliquer.
  // @returns {boolean} - le point a-t-il changé ?
  function recalerPointNet({ annoncer = true } = {}) {
    if (!ctx.bokehActif?.()) return false
    const geo = geoCourante()
    if (!geo) return false
    const aspect = geo.largeurMm / geo.hauteurMm
    const cadrage = { ...etat.cadrage }
    const avait = !!etat.pointNet
    if (avait) {
      const ndc = ctx.projeterPointNet?.({ point: etat.pointNet, aspect, cadrage })
      // Encore sur la feuille : on ne touche à rien. Re-viser ici se battrait
      // avec l'utilisateur, qui avait choisi le sommet et le veut toujours.
      if (estSurLaFeuille(ndc)) return false
    }
    // ⚠️ ON RÉUTILISE `viserPointNet`, LA VISÉE DU CLIC. Pas un second
    // calculateur de netteté : deux façons de viser finiraient par diverger, et
    // c'est le genre d'écart qui ne se découvre que sur un tirage payé.
    for (const essai of viseesDeRepli(etat.visee)) {
      const p = ctx.viserPointNet?.({ u: essai.u, v: essai.v, aspect, cadrage })
      if (!p) continue // le ciel : on descend d'un cran dans la liste
      etat.pointNet = p
      etat.visee = { u: essai.u, v: essai.v }
      if (avait && annoncer) {
        noteNet.textContent = MESSAGE_POINT_REPLACE
        noteNet.hidden = false
        // ⚠️ ET LE VISEUR SE RÉARME — c'est la demande d'Adrien, « en cliquant
        // sur la map à cette étape là on devrait pouvoir refaire le point ».
        // Le mécanisme est celui du clic ordinaire (`viserIci`), pas un
        // second ; on ne fait que le rallumer, et SEULEMENT quand le point a
        // vraiment été perdu. Le rallumer à chaque changement de format
        // volerait le premier clic de quelqu'un qui voulait recadrer.
        viseur(true)
      }
      return true
    }
    // Rien n'a été touché nulle part (une affiche de ciel pur, cadrage extrême)
    // : on garde ce qu'on avait plutôt que de tout rendre flou.
    return false
  }

  // ── l'état, poussé dans le DOM ────────────────────────────────────────────
  let jeton = 0
  let differe = null
  function appliquer({ refaireRendu = false, recaler = true } = {}) {
    const geo = geoCourante()
    if (!geo) return
    // Le cadrage se re-borne à CHAQUE passage : baisser le zoom doit ramener les
    // décalages dans la nouvelle marge, sinon l'image resterait poussée dehors.
    etat.cadrage = cadrageValide(etat.cadrage)
    cZoom.sync(); cX.sync(); cY.sync()
    // ⚠️ ON PEUT DÉPLACER MÊME À ZOOM 1. La première version éteignait les deux
    // décalages tant qu'on n'avait pas zoomé — logique pour un recadrage
    // d'image, où il n'y aurait eu que du vide à découvrir. Mais chaque aperçu
    // est un vrai rendu : décentrer le bloc est une composition, pas un bug.
    sheet.classList.add('bougeable')

    // le logo
    logoImg.style.display = etat.logo ? '' : 'none'
    logoOutils.style.display = etat.logo ? '' : 'none'
    etiqFichier.textContent = etat.logo ? etat.logo.nom : 'Choisir une image…'
    if (etat.logo) {
      if (logoImg.src !== etat.logo.url) logoImg.src = etat.logo.url
      logoImg.style.width = `${etat.logo.taille}cqw`
      logoImg.dataset.coin = etat.logo.coin
      for (const [id, b] of boutonsCoin) b.setAttribute('aria-pressed', String(id === etat.logo.coin))
      cTaille.sync()
    }

    // La signature n'a pas de réglage : elle ne suit que l'encre du cartouche,
    // parce que c'est le voile de celui-ci qui la rend lisible (ou pas).
    signature.classList.toggle('sombre', etat.cartouche && etat.cartoucheSombre)
    signature.classList.toggle('nu', !etat.cartouche)

    for (const [id, b] of boutonsFormat) b.setAttribute('aria-pressed', String(id === etat.format))
    // ⚠️ CHAQUE PASTILLE MONTRE LE SENS QU'ELLE DONNERAIT, pas celui du segment.
    // Sur une machine qui ne tient qu'une orientation d'un format, cliquer
    // dessus fait basculer le sens (`replierSur`) : annoncer « Paysage » et
    // rendre un portrait serait un mensonge de plus, pas un de moins.
    for (const [id, vignette] of vignettesFormat) {
      dessinerVignette(vignette, id, replierSur(grilleFormats, id, etat.orientation)?.orientation || etat.orientation)
    }
    bPortrait.setAttribute('aria-pressed', String(etat.orientation === 'portrait'))
    bPaysage.setAttribute('aria-pressed', String(etat.orientation === 'paysage'))
    // Un sens que le format courant ne tient pas sur cette machine disparaît —
    // même règle que les formats, et pour la même raison.
    for (const [b, v] of boutonsSens) b.hidden = !ligneFormat(grilleFormats, etat.format)?.[v]

    // La feuille prend la proportion du format ET reste dans l'estrade : sans
    // les deux plafonds, un 61 × 91 en portrait sortirait par le haut.
    sheet.style.aspectRatio = `${geo.largeurMm} / ${geo.hauteurMm}`
    sheet.style.maxWidth = '100%'
    sheet.style.maxHeight = '100%'
    sheet.style.width = geo.largeurMm >= geo.hauteurMm ? '100%' : 'auto'
    sheet.style.height = geo.hauteurMm > geo.largeurMm ? '100%' : 'auto'

    const lieu = ctx.lieu?.() || {}
    cartouche.style.display = etat.cartouche ? '' : 'none'
    cartouche.classList.toggle('sombre', etat.cartoucheSombre)
    // ⚠️ LES MÊMES TROIS CHAÎNES QUE LE FICHIER VENDU, par construction : c'est
    // le compositeur qui les fabrique, pour les deux.
    const t = texteCartouche({ titre: etat.titre, lieu })
    cartLieu.textContent = t.lieu
    cartSous.textContent = t.sous
    cartAlt.textContent = t.alt

    verite.textContent = ''
    for (const bout of ligneVerite(geo)) verite.append(el('span', null, bout))

    // La taille sous la feuille, et la cause d'une densité dégradée s'il y en a
    // une. Les deux se relisent de `geo` à chaque passage : c'est la même
    // source que la ligne de vérité, il n'y a donc pas deux façons d'annoncer
    // une taille ni deux façons d'annoncer une densité.
    taille.textContent = tailleSousFeuille(geo, etat.orientation)
    const mot = noteDensite({
      dpi: geo.dpi,
      nominal: dpiPour(etat.format, etat.orientation),
      largeurCm: geo.largeurMm / 10,
      hauteurCm: geo.hauteurMm / 10,
    })
    noteDpi.textContent = mot
    noteDpi.hidden = !mot

    if (refaireRendu === 'differe') {
      // ⚠️ UN RENDU PAR CRAN DE CURSEUR SERAIT INJOUABLE : chaque rendu redessine
      // la scène entière. On montre donc l'ancienne image TRANSFORMÉE pendant le
      // geste — approximatif mais instantané — et on refait le vrai rendu à
      // l'arrêt. C'est le même compromis que l'aperçu d'un recadrage photo.
      apercuApproche()
      clearTimeout(differe)
      // ⚠️ LE RECALAGE ATTEND L'ARRÊT, LUI AUSSI. Il tire un rayon dans le
      // relief : un par cran de molette coûterait ce qu'on vient d'économiser
      // en ne rendant pas. Il se fait donc juste avant le vrai rendu, quand le
      // cadrage a fini de bouger.
      differe = setTimeout(() => { if (recaler) recalerPointNet(); rendre(geoCourante() || geo) }, 260)
    } else if (refaireRendu) {
      clearTimeout(differe)
      // ⚠️ AVANT `rendre`, PAS APRÈS : le rendu lit `etat.pointNet`. Recaler
      // ensuite ferait afficher une image d'avance en permanence.
      if (recaler) recalerPointNet()
      rendre(geo)
    }
  }

  // La transformation CSS qui imite le cadrage, le temps du geste.
  function apercuApproche() {
    const { zoom, x, y } = etat.cadrage
    img.style.transform = `scale(${zoom}) translate(${(-x * 50) / zoom}%, ${(-y * 50) / zoom}%)`
  }

  async function rendre(geo) {
    const mien = ++jeton
    sheet.classList.add('attente')
    const [W, H] = geo.finiPx
    const k = APERCU_MAX_PX / Math.max(W, H)
    try {
      const url = await ctx.rendreApercu({
        largeur: Math.max(2, Math.round(W * k)),
        hauteur: Math.max(2, Math.round(H * k)),
        // La hauteur PHYSIQUE que cette vignette représente. Elle ne sert pas au
        // cadrage — elle donne la densité réelle de l'aperçu (quelques dizaines
        // de dpi, pas 300), donc le bon plancher d'épaisseur de trait. Voir
        // export-traits.js. `finiPx` est le format APRÈS coupe : la hauteur qui
        // lui correspond est `hauteurMm`, sans fond perdu.
        hauteurMm: geo.hauteurMm,
        cadrage: { ...etat.cadrage },
        pointNet: etat.pointNet,
      })
      // ⚠️ Un rendu plus récent a pu partir pendant celui-ci (on clique vite sur
      // les formats). Sans ce jeton, c'est l'aperçu le plus LENT qui gagne.
      if (mien !== jeton) return
      const ancienne = img.src
      img.src = url
      img.decode?.().catch(() => {}).finally(() => {
        if (mien !== jeton) return
        // le vrai rendu porte DÉJÀ le cadrage : la transformation d'attente
        // doit disparaître au même instant, sinon on l'appliquerait deux fois
        img.style.transform = ''
        sheet.classList.remove('attente')
        img.classList.add('vu')
        if (ancienne?.startsWith('blob:')) URL.revokeObjectURL(ancienne)
      })
    } catch (err) {
      if (mien !== jeton) return
      sheet.classList.remove('attente')
      console.warn('aperçu d’affiche :', err)
    }
  }

  // ── Le viseur de netteté ──────────────────────────────────────────────────
  let enVisee = false
  function viseur(on) {
    enVisee = !!on
    sheet.classList.toggle('vise', enVisee)
    gNet.classList.toggle('actif', enVisee)
  }
  function viserIci(e) {
    const r = sheet.getBoundingClientRect()
    // coordonnées normalisées de three : −1 à +1, y vers le HAUT
    const u = ((e.clientX - r.left) / r.width) * 2 - 1
    const v = -(((e.clientY - r.top) / r.height) * 2 - 1)
    const geo = geoCourante()
    const p = ctx.viserPointNet?.({ u, v, aspect: geo.largeurMm / geo.hauteurMm, cadrage: etat.cadrage })
    // Un clic dans le ciel ne remet PAS le point à zéro : on garde le précédent
    // plutôt que de rendre l'image entièrement floue sur un geste raté.
    if (p) {
      etat.pointNet = p
      // Où il a visé DANS LE CADRE : c'est ce qu'on rejouera si un changement
      // de sens fait sortir le point de la feuille.
      etat.visee = { u, v }
      noteNet.hidden = true
    }
    viseur(false)
    // ⚠️ PAS DE RECALAGE SUR SON PROPRE CLIC. Un clic dans la bande de bord
    // (`MARGE_SUR_LA_FEUILLE`) serait aussitôt jugé « hors cadre » et l'écran
    // annoncerait avoir replacé un point que l'utilisateur venait de poser
    // exactement là — un avertissement faux, donc un avertissement perdu.
    appliquer({ refaireRendu: true, recaler: false })
  }

  // ── Le geste direct : on tire l'image, on ne cherche pas un curseur ───────
  //
  // ⚠️ LE DÉPLACEMENT SE MESURE EN FRACTION DE LA FEUILLE, PAS EN PIXELS. La
  // même feuille fait 900 px de large sur un portable et 1 400 sur un écran
  // large : un pas en pixels rendrait le geste deux fois plus sensible ici que
  // là. Et il se divise par le zoom — à fort grossissement, un centimètre de
  // souris doit balayer moins d'image, pas plus.
  let prise = null
  sheet.addEventListener('pointerdown', (e) => {
    if (enVisee) { viserIci(e); return }
    prise = { id: e.pointerId, x: e.clientX, y: e.clientY, dep: { ...etat.cadrage } }
    sheet.setPointerCapture(e.pointerId)
    sheet.classList.add('tire')
  })
  sheet.addEventListener('pointermove', (e) => {
    if (!prise || e.pointerId !== prise.id) return
    const r = sheet.getBoundingClientRect()
    etat.cadrage.x = prise.dep.x - ((e.clientX - prise.x) / r.width) * 2 * etat.cadrage.zoom
    etat.cadrage.y = prise.dep.y - ((e.clientY - prise.y) / r.height) * 2 * etat.cadrage.zoom
    appliquer({ refaireRendu: 'differe' })
  })
  const lacher = (e) => {
    if (!prise || (e && e.pointerId !== prise.id)) return
    prise = null
    sheet.classList.remove('tire')
  }
  sheet.addEventListener('pointerup', lacher)
  sheet.addEventListener('pointercancel', lacher)
  sheet.addEventListener('wheel', (e) => {
    e.preventDefault()
    etat.cadrage.zoom *= e.deltaY < 0 ? 1.08 : 1 / 1.08
    appliquer({ refaireRendu: 'differe' })
  }, { passive: false })

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDRE AVANT D'ENCAISSER
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ C'EST L'ORDRE QUI SUPPRIME UNE CLASSE D'ÉCHEC ENTIÈRE. Payer puis rendre,
  // c'est accepter qu'un pilote refuse une tuile, qu'un canevas de 12 Mpx sorte
  // vide ou qu'un onglet manque de mémoire APRÈS le débit — et il ne reste alors
  // qu'un remboursement, une excuse et un acheteur perdu. Rendre puis payer, le
  // même échec ne coûte qu'un message et un bouton réarmé.
  //
  // Trois temps, et le deuxième est le seul qui dure :
  //   ① l'écran de validation (le COMPOSITEUR, réduit à 1 100 px) — quelques
  //      centaines de millisecondes, et c'est ce que l'acheteur regarde pendant
  //      que le reste se fabrique ;
  //   ② le tirage pavé, avec sa progression et son bouton d'annulation ;
  //   ③ Stripe.
  //
  // ⚠️ ET ON GARDE LE FICHIER — C'EST LE CONTRAIRE DE CE QUE FAISAIT CET ÉCRAN,
  // ET C'EST MESURÉ. La première version jetait les bandes au fil : une affiche
  // pesait 21 à 89 Mo en PNG, partir payer est une navigation, ces octets
  // mouraient de toute façon. Deux choses ont changé depuis.
  //   ① LE POIDS. Les bandes sont maintenant du JPEG (pdf-affiche.js explique
  //      pourquoi : un PNG serait décodé puis regonflé par pdf-lib), et le PDF
  //      pèse leur somme. On tient un fichier, pas une image en RVBA.
  //   ② LA DESTINATION. Ce PDF part au COFFRE avant la caisse — c'est ce qui
  //      lui fait traverser la navigation vers Stripe. Voir
  //      src/coffre-affiche.js pour l'arbitrage entre les trois voies, et
  //      `onCommander` dans main.js pour le dépôt lui-même.
  // Ce qu'on n'a toujours pas le droit de faire, c'est de tenir douze bandes ET
  // le PDF : l'emballage libère les octets des bandes dès qu'il a écrit (voir
  // `rendreTirage`).
  const voile = el('div', 'af-tirage')
  voile.setAttribute('role', 'status')
  voile.setAttribute('aria-live', 'polite')
  const tirCarte = el('div', 'af-tir-carte')
  const tirImg = el('img', 'af-tir-img')
  tirImg.alt = ''
  const tirTitre = el('h2', 'af-tir-titre', 'On fabrique ton fichier')
  const tirEtape = el('p', 'af-tir-etape', 'On vérifie ton affiche…')
  const tirJauge = el('div', 'af-tir-jauge')
  const tirBarre = el('i')
  tirJauge.append(tirBarre)
  const tirDetail = el('p', 'af-tir-detail', '')
  const tirAnnuler = el('button', 'af-lien af-tir-annuler')
  tirAnnuler.type = 'button'
  tirAnnuler.textContent = 'Annuler'
  tirCarte.append(tirImg, tirTitre, tirEtape, tirJauge, tirDetail, tirAnnuler)
  voile.append(tirCarte)
  stage.append(voile)

  // L'annulation : un seul drapeau, consulté par l'orchestrateur entre deux
  // tuiles (`annule`) et par nous entre deux étapes. Un rendu déjà lancé ne
  // s'interrompt pas au milieu d'une tuile — c'est un appel GPU synchrone — mais
  // au pire on attend une tuile, pas douze.
  let annulation = false
  let enTirage = false
  tirAnnuler.addEventListener('click', () => {
    annulation = true
    tirEtape.textContent = 'On annule…'
    tirAnnuler.disabled = true
  })

  function ouvrirVoile() {
    annulation = false
    enTirage = true
    tirAnnuler.disabled = false
    tirBarre.style.width = '0%'
    tirDetail.textContent = ''
    tirEtape.textContent = 'On vérifie ton affiche…'
    tirImg.classList.remove('vu')
    voile.classList.add('ouvert')
  }
  function fermerVoile() {
    enTirage = false
    voile.classList.remove('ouvert')
    if (tirImg.src?.startsWith('blob:')) { URL.revokeObjectURL(tirImg.src); tirImg.removeAttribute('src') }
  }

  // ── La garde de netteté : posée avant l'achat, jamais pendant ─────────────
  //
  // ⚠️ ELLE N'A AUCUNE MÉMOIRE D'UNE COMMANDE À L'AUTRE. `netteteConfirmee` ne
  // vaut que pour la tentative en cours et retombe dans le `finally` — quelle
  // que soit l'issue, y compris un départ chez Stripe suivi d'un retour.
  let netteteConfirmee = false
  // Ce qu'on rejoue si l'acheteur répond « continuer ». On garde la SUITE, pas
  // l'événement : `altKey` ne survivrait pas à l'attente d'une réponse.
  let reprendreAchat = null

  function ouvrirGarde(reprendre) {
    reprendreAchat = reprendre
    garde.hidden = false
    // Le bouton d'achat reste EXACTEMENT où il était, et devient inerte : c'est
    // ce qui rend l'avertissement inesquivable au double-clic (voir l'encadré
    // au-dessus de `garde`).
    cta.disabled = true
    bDeplacer.focus()
  }
  function fermerGarde() {
    garde.hidden = true
    reprendreAchat = null
    cta.disabled = false
  }
  bDeplacer.addEventListener('click', () => {
    fermerGarde()
    noteNet.hidden = true
    // On ARME LE VISEUR plutôt que d'expliquer une deuxième fois : le geste
    // décrit dans l'avertissement devient possible dans la seconde qui suit.
    viseur(true)
  })
  bContinuer.addEventListener('click', () => {
    const suite = reprendreAchat
    netteteConfirmee = true
    fermerGarde()
    suite?.()
  })

  cta.addEventListener('click', (e) => {
    // ⚠️ `altKey` n'est qu'une INTENTION, pas une autorisation : c'est le geste
    // qui déclenche la demande du code d'atelier. Le secret, lui, est saisi puis
    // vérifié CÔTÉ SERVEUR — voir netlify/functions/paiement.mjs. Il se lit
    // MAINTENANT : l'événement ne survivra pas aux `await` qui suivent, ni à la
    // question posée par la garde de netteté.
    lancerAchat(!!e.altKey)
  })

  async function lancerAchat(atelier) {
    if (enTirage) return
    // ── LA QUESTION, S'IL Y A DU FLOU ────────────────────────────────────────
    // Avant le voile, avant le moindre rendu : ce qui se répare ici ne coûte
    // qu'un clic, alors que la même erreur découverte sur le PDF coûte un
    // fichier refait et, un jour où le prix ne sera plus de 0 €, un
    // remboursement.
    if (doitAvertirAvantAchat({ bokehActif: !!ctx.bokehActif?.(), dejaConfirme: netteteConfirmee })) {
      ouvrirGarde(() => lancerAchat(atelier))
      return
    }
    cta.disabled = true
    ctaTexte.textContent = 'Un instant…'
    const geo = geoCourante()
    // Le fichier produit à l'étape ②, gardé pour être remis à `onCommander` —
    // qui le met au coffre avant de quitter la page. Déclaré ici parce que le
    // `finally` doit pouvoir le lâcher, quoi qu'il arrive.
    let pdfTirage = null
    // ⚠️ RÉARMER LE BOUTON N'EST PAS AUTOMATIQUE. Un clic réussi part chez
    // Stripe : le bouton redeviendrait cliquable pendant que le navigateur
    // quitte la page, et un second clic ouvrirait une seconde session de
    // paiement. On ne réarme que quand on RESTE à l'écran.
    let reste = true
    ouvrirVoile()
    try {
      if (!geo) throw new Error('format indisponible')

      // ── ① CE QU'IL VALIDE — produit par le compositeur, pas par le DOM ────
      //
      // La feuille derrière est une maquette DOM : elle sert à composer. Celle-ci
      // sort du MÊME code que le fichier, à un facteur d'échelle près. C'est la
      // décision d'architecture du chantier : l'acheteur valide le fichier, pas
      // une imitation. Voir rendreValidation dans main.js.
      if (ctx.rendreValidation) {
        const url = await ctx.rendreValidation({
          finiPx: geo.finiPx,
          largeurMm: geo.largeurMm,
          hauteurMm: geo.hauteurMm,
          cadrage: { ...etat.cadrage },
          pointNet: etat.pointNet,
          etat,
        })
        if (annulation) throw new Error('Rendu annulé')
        const ancienne = tirImg.src
        // ⚠️ ON N'ATTEND PAS `decode()`, ET C'EST UNE CORRECTION OBSERVÉE, PAS
        // UNE PRÉCAUTION. Un `await img.decode()` NE SE RÉSOUT PAS tant que le
        // document n'est pas composité : onglet en arrière-plan, fenêtre
        // réduite, ou simplement masquée. L'image était complète (1 100 × 786,
        // `complete === true`) et la promesse ne rendait jamais la main — tout
        // l'achat restait bloqué sur « On vérifie ton affiche… ». C'est
        // exactement ce que quelqu'un fait pendant qu'un tirage tourne : il va
        // voir ailleurs. L'affichage est cosmétique, il ne commande rien.
        tirImg.src = url
        tirImg.addEventListener('load', () => tirImg.classList.add('vu'), { once: true })
        if (tirImg.complete) tirImg.classList.add('vu')
        if (ancienne?.startsWith('blob:')) URL.revokeObjectURL(ancienne)
      }

      // ── ② LE FICHIER, TUILE PAR TUILE ─────────────────────────────────────
      if (ctx.rendreTirage) {
        if (annulation) throw new Error('Rendu annulé')
        tirEtape.textContent = 'On rend ton fichier…'
        const debut = (globalThis.performance || Date).now()
        const r = await ctx.rendreTirage({
          totalPx: geo.totalPx,
          hauteurFiniePx: geo.finiPx[1],
          hauteurMm: geo.hauteurMm,
          largeurMm: geo.largeurMm,
          fondPerduPx: pxPourMm(geo.fondPerduMm, geo.dpi),
          dpi: geo.dpi,
          cadrage: { ...etat.cadrage },
          pointNet: etat.pointNet,
          etat,
          onProgress: (f) => {
            const pct = Math.max(0, Math.min(100, Math.round(f * 100)))
            tirBarre.style.width = `${pct}%`
            tirDetail.textContent = `${pct} %`
          },
          annule: () => annulation,
        })
        const secondes = ((globalThis.performance || Date).now() - debut) / 1000
        tirBarre.style.width = '100%'
        // ⚠️ LE POIDS ANNONCÉ EST CELUI DU PDF, PAS LA SOMME DES BANDES. C'est
        // le fichier que l'acheteur recevra ; l'écart entre les deux ne vaut que
        // quelques kilo-octets de structure, mais annoncer une grandeur qu'on ne
        // livre pas est exactement l'habitude que ce chantier combat.
        pdfTirage = r?.pdf || null
        tirEtape.textContent = 'Ton fichier est prêt.'
        tirDetail.textContent = [
          pdfTirage ? poidsLisible(pdfTirage.octets) : '',
          pdfTirage ? 'PDF' : '',
          `${r?.plan?.tuiles?.length ?? '?'} tuiles`,
          `${secondes.toFixed(1).replace('.', ',')} s`,
        ].filter(Boolean).join(' · ')
        // ⚠️ PAS DE PDF, PAS DE VENTE. Le pavage peut avoir réussi et
        // l'emballage échouer (bibliothèque absente du bundle, boîtes
        // incohérentes) : l'acheteur paierait alors 19 € pour un fichier qui
        // n'existe pas. On échoue AVANT la caisse, où ça ne coûte qu'un message.
        if (!pdfTirage?.blob) throw new Error('le PDF n’a pas pu être fabriqué')
      }

      // ── ③ SEULEMENT MAINTENANT, LA CAISSE ─────────────────────────────────
      if (annulation) throw new Error('Rendu annulé')
      tirTitre.textContent = 'Ton fichier est prêt'
      tirEtape.textContent = 'On ouvre le paiement sécurisé…'
      tirAnnuler.hidden = true
      // ⚠️ LE PDF PART AVEC LA COMMANDE. C'est `onCommander` qui connaît
      // l'identifiant de panier — celui qui reliera le retour de Stripe à ce
      // fichier-ci — et c'est donc là, à côté de `poserPanier`, que le dépôt au
      // coffre a sa place. Le lui passer ici est ce qui fait survivre le fichier
      // à la navigation. Voir src/coffre-affiche.js.
      const suite = ctx.onCommander?.({ ...etat, geo, prix: PRIX_AFFICHE_EUR, atelier, pdf: pdfTirage })
      if (suite && typeof suite.then === 'function') reste = (await suite) !== 'parti'
    } catch (err) {
      const annule = annulation || /annul/i.test(err?.message || '')
      if (!annule) console.warn('commande :', err)
      if (!annule) {
        tirTitre.textContent = 'Le fichier n’a pas pu être produit'
        tirEtape.textContent = 'Rien n’a été débité. Essaie un format plus petit, ou réessaie.'
        tirDetail.textContent = String(err?.message || '')
        tirAnnuler.disabled = false
        tirAnnuler.textContent = 'Fermer'
        // On laisse le voile ouvert : un échec qui disparaît tout seul ne
        // s'explique jamais. Le bouton, lui, redevient « Fermer ».
        await new Promise((res) => tirAnnuler.addEventListener('click', res, { once: true }))
        tirAnnuler.textContent = 'Annuler'
      }
    } finally {
      tirAnnuler.hidden = false
      fermerVoile()
      // ⚠️ « À CHAQUE FOIS QUE L'ON VA PASSER À L'ACHAT » (Adrien) : la
      // confirmation ne vaut QUE pour la tentative qui s'achève. Un second
      // achat repose la question — le cadre a pu changer entre les deux, et
      // c'est précisément le cas qui a motivé cette passe.
      netteteConfirmee = false
      // ⚠️ ON LÂCHE LE PDF DÈS QU'ON RESTE. `reste` veut dire que la caisse ne
      // s'est pas ouverte : le fichier ne servira plus, et un second essai en
      // refabriquera un. Le garder ferait cohabiter deux affiches complètes en
      // mémoire au tirage suivant. Quand on PART, au contraire, on ne touche à
      // rien : `onCommander` vient de le déposer au coffre.
      if (reste) {
        pdfTirage = null
        cta.disabled = false
        ctaTexte.textContent = CTA_TELECHARGER
      }
    }
  }

  function partir() {
    scene.classList.remove('open')
    document.body.classList.remove('af-mode')
    fermer.remove()
    setTimeout(() => scene.remove(), 340)
    window.removeEventListener('keydown', surTouche)
    clearTimeout(differe)
    // Les URL d'objet survivent au document : sans ça, chaque ouverture de
    // l'écran laisse derrière elle le logo et le dernier aperçu.
    if (etat.logo?.url) URL.revokeObjectURL(etat.logo.url)
    if (img.src?.startsWith('blob:')) URL.revokeObjectURL(img.src)
    if (tirImg.src?.startsWith('blob:')) URL.revokeObjectURL(tirImg.src)
    ctx.onFermer?.()
  }
  // ⚠️ ÉCHAP PENDANT UN TIRAGE ANNULE LE TIRAGE, IL NE FERME PAS L'ÉCRAN. Fermer
  // laisserait l'orchestrateur peindre des tuiles dans une scène qu'on est en
  // train de rendre à la carte — et le geste réflexe pour « stop » est Échap,
  // pas la croix.
  function surTouche(e) {
    if (e.key !== 'Escape') return
    if (enTirage) { annulation = true; tirEtape.textContent = 'On annule…'; tirAnnuler.disabled = true; return }
    // ⚠️ ÉCHAP DEVANT LA GARDE DE NETTETÉ REFERME LA QUESTION, il ne quitte pas
    // l'écran — et il ne CONFIRME rien. On ne veut pas d'un avertissement qui
    // enferme, mais on ne veut pas non plus qu'un réflexe le fasse passer.
    if (!garde.hidden) { fermerGarde(); return }
    partir()
  }
  fermer.addEventListener('click', () => { if (!enTirage) partir() })
  window.addEventListener('keydown', surTouche)

  // ⚠️ LE CAS OÙ IL N'Y A RIEN À VENDRE, DIT PLUTÔT QUE CACHÉ. Si aucun format ne
  // passe — plafonds illisibles, cible refusée, canevas de bande refusé — la
  // grille est vide et le bouton ne peut rien produire. Le laisser cliquable
  // serait promettre un fichier qu'on sait ne pas pouvoir faire.
  if (!grilleFormats.some((g) => g.dispo)) {
    cta.disabled = true
    rassure.textContent = sonde?.raison
      ? `Cet appareil ne peut pas produire de fichier d’impression (${sonde.raison}). L’image à l’écran, elle, reste gratuite.`
      : 'Cet appareil ne peut pas produire de fichier d’impression. L’image à l’écran, elle, reste gratuite.'
  }

  // ⚠️ ON POSE UN PREMIER POINT AVANT LE PREMIER RENDU, ET C'EST UN DÉFAUT
  // OBSERVÉ À L'ÉCRAN, PAS UNE COQUETTERIE. Sans point mémorisé, `cadrerAffiche`
  // ne touche pas à la mise au point : l'affiche héritait de la distance de la
  // CARTE alors que la caméra venait de reculer pour cadrer le socle, et
  // l'écran s'ouvrait sur une feuille intégralement floue — la pire première
  // impression possible, et un fichier vendable en l'état si l'acheteur ne
  // cliquait nulle part. On vise donc le centre de la feuille (voir
  // `viseesDeRepli`) ; le viseur reste armé juste après, et le premier clic
  // remplace ce défaut par le choix de l'utilisateur.
  recalerPointNet({ annoncer: false })
  appliquer({ refaireRendu: true, recaler: false })
  if (ctx.bokehActif?.()) viseur(true)
  return { fermer: partir }
}
