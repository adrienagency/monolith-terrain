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
  FORMATS_AFFICHE, geometriePage, DPI_IMPRESSION,
  CADRAGE_DEFAUT, CADRAGE_ZOOM_MIN, CADRAGE_ZOOM_CURSEUR_MAX, cadrageValide,
} from '../print-page.js'

// Le prix de lancement. Un seul endroit, pour que l'étiquette et le bouton ne
// puissent pas se contredire.
export const PRIX_AFFICHE_EUR = 19

// La plus grande dimension de l'aperçu, en pixels. Assez pour juger un cadrage
// et une couleur, assez petit pour que changer de format reste instantané.
const APERCU_MAX_PX = 1100

const ICONE_CROIX = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

/**
 * Le sous-titre du cartouche : les coordonnées, dans la forme qu'un
 * cartographe écrirait. Pur, pour être testable.
 */
export function coordonneesCartouche(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
  const f = (v, pos, neg) => `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`
  return `${f(lat, 'N', 'S')}  ·  ${f(lon, 'E', 'O')}`
}

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
 * @param {(commande) => void} [ctx.onCommander] - le pas suivant (paiement)
 */
export function ouvrirAffiche(ctx) {
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
  const grille = el('div', 'af-formats')
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
      etat.format = f.id
      appliquer({ refaireRendu: true })
    })
    boutonsFormat.set(f.id, b)
    grille.append(b)
  }
  gFormat.append(grille)

  // Orientation.
  const gOrient = el('div', 'af-groupe')
  gOrient.append(el('p', 'af-legende', 'Sens'))
  const seg = el('div', 'af-seg')
  const bPortrait = el('button', null, 'Portrait')
  const bPaysage = el('button', null, 'Paysage')
  for (const [b, v] of [[bPortrait, 'portrait'], [bPaysage, 'paysage']]) {
    b.type = 'button'
    b.addEventListener('click', () => {
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
  rassure.innerHTML = 'Le PDF arrive par mail, tout de suite. <b>Pas de compte à créer.</b><br>L’image à l’écran, elle, reste gratuite.'
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
    const geo = geometriePage({ format: etat.format, orientation: etat.orientation, dpi: DPI_IMPRESSION })
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
    cartLieu.textContent = etat.titre || lieu.nom || ''
    cartSous.textContent = coordonneesCartouche(lieu.lat, lieu.lon)
    cartAlt.textContent = Number.isFinite(lieu.altMax) ? `${Math.round(lieu.altMax)} m` : ''

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
    const geo = geometriePage({ format: etat.format, orientation: etat.orientation, dpi: DPI_IMPRESSION })
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

  cta.addEventListener('click', async (e) => {
    cta.disabled = true
    ctaTexte.textContent = 'Un instant…'
    const geo = geometriePage({ format: etat.format, orientation: etat.orientation, dpi: DPI_IMPRESSION })
    // ⚠️ RÉARMER LE BOUTON N'EST PLUS AUTOMATIQUE. Tant que le paiement n'était
    // pas branché, un `setTimeout` le rendait actif au bout de 1,2 s. Depuis
    // qu'un clic réussi part chez Stripe, ce réarmement serait FAUX : le bouton
    // redeviendrait cliquable pendant que le navigateur quitte la page, et un
    // second clic ouvrirait une seconde session de paiement. On ne réarme donc
    // que sur un ÉCHEC — c'est-à-dire quand on reste à l'écran.
    let reste = true
    try {
      // ⚠️ `altKey` n'est qu'une INTENTION, pas une autorisation : c'est le
      // geste qui déclenche la demande du code d'atelier. Le secret, lui, est
      // saisi puis vérifié CÔTÉ SERVEUR — voir netlify/functions/paiement.mjs.
      const suite = ctx.onCommander?.({ ...etat, geo, prix: PRIX_AFFICHE_EUR, atelier: !!e.altKey })
      if (suite && typeof suite.then === 'function') reste = (await suite) !== 'parti'
    } catch (err) {
      console.warn('commande :', err)
    } finally {
      if (reste) { cta.disabled = false; ctaTexte.textContent = 'Recevoir le fichier' }
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
    ctx.onFermer?.()
  }
  function surTouche(e) { if (e.key === 'Escape') partir() }
  fermer.addEventListener('click', partir)
  window.addEventListener('keydown', surTouche)

  appliquer({ refaireRendu: true })
  if (ctx.bokehActif?.()) viseur(true)
  return { fermer: partir }
}
