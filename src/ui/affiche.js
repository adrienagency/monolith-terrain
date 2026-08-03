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
import { FORMATS_AFFICHE, geometriePage, DPI_IMPRESSION } from '../print-page.js'

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
 *   demandé et rend une URL d'image. Reçoit { largeur, hauteur }.
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
  const img = el('img')
  img.alt = ''
  const cartouche = el('div', 'af-cartouche')
  const cartGauche = el('div')
  const cartLieu = el('h2', 'af-cart-lieu')
  const cartSous = el('div', 'af-cart-sous')
  cartGauche.append(cartLieu, cartSous)
  const cartAlt = el('div', 'af-cart-alt')
  cartouche.append(cartGauche, cartAlt)
  sheet.append(img, cartouche)
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
  gCart.append(bascule, champ, basculeEncre)

  coche.addEventListener('change', () => { etat.cartouche = coche.checked; appliquer({}) })
  cocheEncre.addEventListener('change', () => { etat.cartoucheSombre = cocheEncre.checked; appliquer({}) })
  champ.addEventListener('input', () => { etat.titre = champ.value; appliquer({}) })

  corps.append(gFormat, gOrient, gCart)

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
  function appliquer({ refaireRendu = false } = {}) {
    const geo = geometriePage({ format: etat.format, orientation: etat.orientation, dpi: DPI_IMPRESSION })
    if (!geo) return

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

    if (refaireRendu) rendre(geo)
  }

  async function rendre(geo) {
    const mien = ++jeton
    sheet.classList.add('attente')
    img.classList.remove('vu')
    const [W, H] = geo.finiPx
    const k = APERCU_MAX_PX / Math.max(W, H)
    try {
      const url = await ctx.rendreApercu({
        largeur: Math.max(2, Math.round(W * k)),
        hauteur: Math.max(2, Math.round(H * k)),
      })
      // ⚠️ Un rendu plus récent a pu partir pendant celui-ci (on clique vite sur
      // les formats). Sans ce jeton, c'est l'aperçu le plus LENT qui gagne.
      if (mien !== jeton) return
      img.src = url
      img.decode?.().catch(() => {}).finally(() => {
        if (mien !== jeton) return
        sheet.classList.remove('attente')
        img.classList.add('vu')
      })
    } catch (err) {
      if (mien !== jeton) return
      sheet.classList.remove('attente')
      console.warn('aperçu d’affiche :', err)
    }
  }

  cta.addEventListener('click', () => {
    cta.disabled = true
    ctaTexte.textContent = 'Un instant…'
    const geo = geometriePage({ format: etat.format, orientation: etat.orientation, dpi: DPI_IMPRESSION })
    try {
      ctx.onCommander?.({ ...etat, geo, prix: PRIX_AFFICHE_EUR })
    } finally {
      // le paiement n'est pas encore branché : on rend la main plutôt que de
      // laisser un bouton mort à l'écran
      setTimeout(() => { cta.disabled = false; ctaTexte.textContent = 'Recevoir le fichier' }, 1200)
    }
  })

  function partir() {
    scene.classList.remove('open')
    document.body.classList.remove('af-mode')
    fermer.remove()
    setTimeout(() => scene.remove(), 340)
    window.removeEventListener('keydown', surTouche)
    ctx.onFermer?.()
  }
  function surTouche(e) { if (e.key === 'Escape') partir() }
  fermer.addEventListener('click', partir)
  window.addEventListener('keydown', surTouche)

  appliquer({ refaireRendu: true })
  return { fermer: partir }
}
