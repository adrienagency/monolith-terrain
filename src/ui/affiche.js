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
import { PLAFOND_REFERENCE } from '../export-dpi.js'
// ⚠️ LE TEXTE DU CARTOUCHE VIENT DU COMPOSITEUR, IL N'EST PLUS ÉCRIT ICI. Deux
// façons de formater une latitude, c'est un écart entre l'aperçu et le fichier
// vendu qui ne se découvre qu'après la vente. Le compositeur est la source ;
// cet écran l'affiche. Voir src/compositeur-affiche.js.
import { coordonneesCartouche, texteCartouche } from '../compositeur-affiche.js'

// Le prix de lancement. Un seul endroit, pour que l'étiquette et le bouton ne
// puissent pas se contredire.
export const PRIX_AFFICHE_EUR = 19

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
  sheet.append(img, logoImg, cartouche)
  wrap.append(sheet)
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

  // Les formats, dessinés à leur vraie proportion.
  const gFormat = el('div', 'af-groupe')
  gFormat.append(el('p', 'af-legende', 'Format'))
  const grilleEl = el('div', 'af-formats')
  const boutonsFormat = new Map()
  for (const f of FORMATS_AFFICHE) {
    const b = el('button', 'af-fmt')
    b.type = 'button'
    const vignette = el('i')
    // la pastille porte le RATIO du format : on reconnaît la forme avant de
    // lire son nom, et c'est ce qui fait de ce choix autre chose qu'une liste
    vignette.style.aspectRatio = `${f.mm[0]} / ${f.mm[1]}`
    const nom = el('b', null, f.label.split(' · ')[0])
    b.append(vignette, nom)
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
  // ⚠️ DÉGRADER D'ABORD, CACHER ENSUITE — la décision d'Adrien, appliquée ici et
  // nulle part ailleurs. La densité, elle, a déjà été baissée par `degradePour` ;
  // ce qui suit ne retire de la grille QUE ce qui ne passe même pas au plancher
  // de 150 dpi. Un format caché est caché, pas grisé : un bouton désactivé
  // demande « pourquoi ? » sans jamais y répondre.
  for (const [id, b] of boutonsFormat) b.hidden = !ligneFormat(grilleFormats, id)?.dispo

  // Orientation.
  const gOrient = el('div', 'af-groupe')
  gOrient.append(el('p', 'af-legende', 'Sens'))
  const seg = el('div', 'af-seg')
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
  gOrient.append(seg)

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
  basculeEncre.append(el('span', null, 'Écrire en clair (fond sombre)'), cocheEncre)
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
  gCart.append(bascule, champ, basculeEncre, basculeLieux)

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
  if (ctx.bokehActif?.()) {
    const enTeteNet = el('div', 'af-legende-ligne')
    enTeteNet.append(el('p', 'af-legende', 'Point de netteté'))
    const bViser = el('button', 'af-lien')
    bViser.type = 'button'
    bViser.textContent = 'Choisir'
    enTeteNet.append(bViser)
    const aideNet = el('p', 'af-aide', 'Clique sur l’affiche pour choisir ce qui doit être net. Le reste se fond.')
    gNet.append(enTeteNet, aideNet)
    bViser.addEventListener('click', () => { viseur(true) })
    corps.append(gNet)
  }

  corps.append(gFormat, gOrient, gCadre, gCart, gLogo)

  // ── le pied : la vérité, puis l'action ────────────────────────────────────
  const pied = el('div', 'af-pied')
  const verite = el('div', 'af-verite')
  const cta = el('button', 'af-cta')
  cta.type = 'button'
  const ctaTexte = el('span', null, 'Recevoir le fichier')
  const ctaPrix = el('span', null, `${PRIX_AFFICHE_EUR} €`)
  cta.append(ctaTexte, ctaPrix)
  const rassure = el('p', 'af-rassure')
  // ⚠️ CETTE PHRASE A CHANGÉ PARCE QUE LA CHAÎNE A CHANGÉ. Elle promettait un
  // envoi par mail — c'était vrai tant que le fichier n'existait pas avant le
  // paiement. Il est maintenant fabriqué AVANT, mis au coffre, et rendu au
  // retour de la caisse : promettre le mail ferait attendre pour rien quelqu'un
  // qui a déjà son fichier à l'écran.
  rassure.innerHTML = 'Le PDF se télécharge dès le paiement validé. <b>Pas de compte à créer.</b><br>L’image à l’écran, elle, reste gratuite.'
  pied.append(verite, cta, rassure)
  rail.append(corps, pied)

  // ── la sortie ─────────────────────────────────────────────────────────────
  const fermer = el('button', 'af-fermer')
  fermer.type = 'button'
  fermer.setAttribute('aria-label', 'Revenir à la carte')
  fermer.innerHTML = ICONE_CROIX

  scene.append(stage, rail)
  document.body.append(scene, fermer)
  requestAnimationFrame(() => scene.classList.add('open'))

  // ── l'état, poussé dans le DOM ────────────────────────────────────────────
  let jeton = 0
  let differe = null
  function appliquer({ refaireRendu = false } = {}) {
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

    for (const [id, b] of boutonsFormat) b.setAttribute('aria-pressed', String(id === etat.format))
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

    if (refaireRendu === 'differe') {
      // ⚠️ UN RENDU PAR CRAN DE CURSEUR SERAIT INJOUABLE : chaque rendu redessine
      // la scène entière. On montre donc l'ancienne image TRANSFORMÉE pendant le
      // geste — approximatif mais instantané — et on refait le vrai rendu à
      // l'arrêt. C'est le même compromis que l'aperçu d'un recadrage photo.
      apercuApproche()
      clearTimeout(differe)
      differe = setTimeout(() => rendre(geo), 260)
    } else if (refaireRendu) {
      clearTimeout(differe)
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
    if (p) etat.pointNet = p
    viseur(false)
    appliquer({ refaireRendu: true })
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
  const tirEtape = el('p', 'af-tir-etape', 'Vérification de ton affiche…')
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
    tirEtape.textContent = 'Annulation…'
    tirAnnuler.disabled = true
  })

  function ouvrirVoile() {
    annulation = false
    enTirage = true
    tirAnnuler.disabled = false
    tirBarre.style.width = '0%'
    tirDetail.textContent = ''
    tirEtape.textContent = 'Vérification de ton affiche…'
    tirImg.classList.remove('vu')
    voile.classList.add('ouvert')
  }
  function fermerVoile() {
    enTirage = false
    voile.classList.remove('ouvert')
    if (tirImg.src?.startsWith('blob:')) { URL.revokeObjectURL(tirImg.src); tirImg.removeAttribute('src') }
  }

  cta.addEventListener('click', async (e) => {
    if (enTirage) return
    // ⚠️ `altKey` n'est qu'une INTENTION, pas une autorisation : c'est le geste
    // qui déclenche la demande du code d'atelier. Le secret, lui, est saisi puis
    // vérifié CÔTÉ SERVEUR — voir netlify/functions/paiement.mjs. Il se lit
    // MAINTENANT : l'événement ne survivra pas aux `await` qui suivent.
    const atelier = !!e.altKey
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
        // l'achat restait bloqué sur « Vérification de ton affiche… ». C'est
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
        tirEtape.textContent = 'Rendu du fichier…'
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
      tirTitre.textContent = 'Fichier prêt'
      tirEtape.textContent = 'Ouverture du paiement sécurisé…'
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
      // ⚠️ ON LÂCHE LE PDF DÈS QU'ON RESTE. `reste` veut dire que la caisse ne
      // s'est pas ouverte : le fichier ne servira plus, et un second essai en
      // refabriquera un. Le garder ferait cohabiter deux affiches complètes en
      // mémoire au tirage suivant. Quand on PART, au contraire, on ne touche à
      // rien : `onCommander` vient de le déposer au coffre.
      if (reste) {
        pdfTirage = null
        cta.disabled = false
        ctaTexte.textContent = 'Recevoir le fichier'
      }
    }
  })

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
    if (enTirage) { annulation = true; tirEtape.textContent = 'Annulation…'; tirAnnuler.disabled = true; return }
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

  appliquer({ refaireRendu: true })
  if (ctx.bokehActif?.()) viseur(true)
  return { fermer: partir }
}
