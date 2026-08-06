// Tiny transient toast — bottom-centre, announces itself and fades on its
// own. Introduced for the Share button's "link copied" / "GPX not included"
// feedback; nothing else in the app needed a notification before, so this
// stays a single reusable element rather than a queue/stack.

import { el } from './kit.js'
// ⚠️ LA HAUTEUR DU MESSAGE SE CALCULE, ELLE N'EST PAS ÉCRITE. Voir
// src/plancher-ui.js : le message se pose au-dessus de ce qui est réellement
// amarré en bas (barre de menu seule, barre + profil de course…), et la mesure
// se fait ICI, à l'instant d'afficher — c'est le seul moment où l'on sait ce
// qu'il y a à surplomber.
import { mesurerPlancher } from '../plancher-ui.js'

let toastEl = null
let hideTimer = null

export function showToast(text, { duration = 2800 } = {}) {
  if (!toastEl) {
    toastEl = el('div', 'ce-toast')
    document.body.append(toastEl)
  }
  mesurerPlancher()
  toastEl.textContent = text
  clearTimeout(hideTimer)
  toastEl.classList.remove('show')
  void toastEl.offsetWidth // reflow — restarts the CSS transition even if a toast is already showing
  toastEl.classList.add('show')
  hideTimer = setTimeout(() => toastEl.classList.remove('show'), duration)
}

// A notice sits in the MIDDLE of the view and says something the toast can't:
// a thing you asked for cannot be delivered here. That's a different weight of
// message from "link copied", so it gets a different place on screen and a
// longer dwell — you have to be able to read a sentence, not just glimpse it.
//
// Separate element from the toast on purpose: the two can legitimately be on
// screen at once (publish a link, discover the photo layer has no coverage),
// and sharing one node would make the second silently eat the first.
let noticeEl = null
let noticeTimer = null

// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE DE LIVRAISON — LE SEUL MESSAGE DE CETTE APPLICATION QUI ATTEND
// ═══════════════════════════════════════════════════════════════════════════
//
// Le toast et la notice s'effacent tout seuls, et c'est juste : ils confirment
// ou ils refusent. Celle-ci REMET UN FICHIER PAYÉ. Elle ne peut donc ni partir
// d'elle-même — on ne fait pas disparaître au bout de neuf secondes la seule
// façon de récupérer ce qu'on vient d'acheter — ni laisser passer les clics :
// `.ce-notice` est en `pointer-events: none`, ce qui rendrait le lien mort.
//
// ⚠️ ET C'EST UN VRAI LIEN, PAS UN BOUTON QUI TÉLÉCHARGE. Un `<a download>` fait
// le travail du navigateur : clic droit « enregistrer sous », appui long sur
// mobile, glisser-déposer vers un dossier. Un `click()` programmé n'offre rien
// de tout ça, et se fait bloquer hors geste de l'utilisateur.
let livraisonEl = null

export function showLivraison({ texte, detail = '', nom = 'affiche.pdf', url, onPris } = {}) {
  if (!url) return null
  livraisonEl?.remove()
  const carte = el('div', 'ce-livraison')
  carte.setAttribute('role', 'status')
  carte.setAttribute('aria-live', 'polite')
  carte.append(el('p', 'ce-liv-titre', texte || 'Ton fichier est prêt.'))
  if (detail) carte.append(el('p', 'ce-liv-detail', detail))
  const lien = el('a', 'ce-liv-lien', 'Télécharger le PDF')
  lien.href = url
  lien.download = nom
  const fermer = el('button', 'ce-liv-fermer', 'Fermer')
  fermer.type = 'button'
  let pris = false
  lien.addEventListener('click', () => {
    if (pris) return
    pris = true
    // ⚠️ APRÈS LE CLIC, PAS AVANT. On ne retire l'exemplaire de secours qu'une
    // fois le téléchargement lancé — et la carte reste, pour un second clic.
    lien.textContent = 'Télécharger à nouveau'
    onPris?.()
  })
  fermer.addEventListener('click', () => { carte.remove(); livraisonEl = null })
  carte.append(lien, fermer)
  // Elle aussi se pose AU-DESSUS de ce qui est affiché en bas : une carte de
  // livraison à moitié cachée par la barre de menu, c'est un fichier payé qu'on
  // ne retrouve pas.
  mesurerPlancher()
  document.body.append(carte)
  livraisonEl = carte
  // ⚠️ UN REFLOW, PAS UN `requestAnimationFrame` — ET C'EST UNE CORRECTION
  // OBSERVÉE. Un rAF NE SE DÉCLENCHE PAS tant que le document n'est pas
  // composité : onglet en arrière-plan, fenêtre réduite, ou simplement masquée.
  // La carte restait alors à `opacity: 0`, c'est-à-dire invisible — et c'est
  // très exactement ce que quelqu'un fait en revenant d'un paiement dans un
  // autre onglet. `showNotice` utilise déjà ce reflow, pour la même raison.
  void carte.offsetWidth
  carte.classList.add('show')
  return carte
}

export function showNotice(text, { duration = 5200 } = {}) {
  if (!noticeEl) {
    noticeEl = el('div', 'ce-notice')
    // aria-live so a screen reader announces it: the message is the only
    // signal that a toggle the user just flipped did nothing.
    noticeEl.setAttribute('role', 'status')
    noticeEl.setAttribute('aria-live', 'polite')
    document.body.append(noticeEl)
  }
  noticeEl.textContent = text
  clearTimeout(noticeTimer)
  noticeEl.classList.remove('show')
  void noticeEl.offsetWidth // reflow — restart the transition mid-flight
  noticeEl.classList.add('show')
  noticeTimer = setTimeout(() => noticeEl.classList.remove('show'), duration)
}
