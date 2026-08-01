// LES BULLES D'AIDE — l'affichage, et rien de plus.
//
// La règle (qui se montre, quand, une seule fois) vit dans ../aides.js, module
// pur testé en node. Les textes vivent dans ../aides-data.js. Ici on ne décide
// rien : on pose un rectangle, on écoute deux touches, et on écrit une clé.
//
// ══════════ LA BULLE NE DOIT PAS GÊNER LE GESTE QU'ELLE EXPLIQUE ════════════
//
// C'est la contrainte qui a dessiné tout le reste. La première aide explique
// un CLIC DROIT MAINTENU sur le terrain ; une bulle opaque posée par-dessus ce
// terrain lui volerait précisément l'endroit où on veut qu'on essaie.
//
// D'où : le calque entier est en `pointer-events: none`, et SEUL le bouton
// « J'ai compris » reprend `pointer-events: auto`. Un clic droit qui part
// n'importe où sur le corps de la bulle traverse et atteint le canevas — le
// geste reste faisable en la regardant. Il reste une zone morte : le bouton
// lui-même, quelques dizaines de pixels sur une fenêtre entière. C'est le prix
// assumé d'un bouton cliquable, et c'est le seul.
//
// Deuxième conséquence : la pose. La bulle se place BAS et CENTRÉE dans le
// cadre du terrain, jamais au milieu. Le centre de l'écran est l'endroit d'où
// part naturellement un glissement, et c'est aussi là qu'est le bloc dont on
// parle. On se met sous lui, pas dessus.
//
// ══════════ DÉGAGER LA VUE AVANT DE MONTRER ═════════════════════════════════
//
// L'interrupteur du mode continu vit dans la modale Paramètres, qui est un
// voile plein écran (z-index 235). Sans rien faire, la bulle naîtrait DERRIÈRE
// le voile : invisible, et pointant un terrain assombri. `degage()` ferme ce
// qui couvre la carte juste avant l'apparition — c'est aussi le bon geste
// d'interface, puisque le message est « va essayer, là, maintenant ».

import { el, section, button, onRefresh, refreshAll } from './kit.js'
import { doitMontrer, acquitte, cleAide, vuesDepuisCles, clesAOublier, nbMasquees } from '../aides.js'
import { AIDES } from '../aides-data.js'

// ---------------------------------------------------------------- le stockage
//
// Encapsulé ici et nulle part ailleurs : le module pur ne connaît pas
// `localStorage`, et un navigateur en navigation privée peut refuser d'écrire.
// Un refus de stockage ne doit jamais empêcher la bulle de s'afficher ni le
// bouton de répondre — au pire l'aide reviendra à la session suivante.

function clesStockees() {
  try {
    return Object.keys(localStorage)
  } catch {
    return []
  }
}

function ecrisAcquittement(id) {
  try {
    localStorage.setItem(cleAide(id), '1')
  } catch {
    /* stockage refusé : l'aide se taira pour cette session seulement */
  }
}

// ------------------------------------------------------------------- l'état
//
// `vues` est un miroir en mémoire du stockage. On le tient à jour plutôt que
// de relire `localStorage` à chaque évaluation : l'évaluation peut être
// appelée depuis un chemin chaud (une bascule qui recharge le terrain), et
// `Object.keys(localStorage)` est synchrone et proportionnel au nombre de
// gabarits enregistrés par l'utilisateur.
let vues = null
let calque = null // le conteneur inséré dans #app, créé au premier besoin
let calqueParent = null
let courante = null // { id, noeud } de la bulle affichée, ou null
let surEchap = null
let degageLaVue = null

function chargeVues() {
  if (!vues) vues = vuesDepuisCles(clesStockees())
  return vues
}

/**
 * À appeler une fois, tôt.
 *
 * @param {object} o
 * @param {HTMLElement} o.conteneur - #app : la bulle vit DANS le cadre du
 *        terrain, pas dans le body. En boutique et en Studio, `#app` n'est
 *        qu'un cadre de la page — une bulle collée au body en sortirait.
 * @param {() => void} [o.degage] - ferme ce qui couvre la carte (la modale
 *        Paramètres), appelé juste avant chaque apparition.
 */
export function initAides({ conteneur, degage } = {}) {
  calqueParent = conteneur ?? null
  degageLaVue = typeof degage === 'function' ? degage : null
  chargeVues()
}

// ⚠️ RIEN N'EST CRÉÉ TANT QU'AUCUNE AIDE NE SE DÉCLENCHE. Contrainte explicite :
// le mode ordinaire ne change pas. Pas de nœud, pas d'écouteur, pas de style
// calculé tant que `evalue()` n'a pas dit oui une première fois.
function ouvreCalque() {
  if (calque) return calque
  calque = el('div', 'ce-aide-layer')
  // Le lecteur d'écran annonce l'insertion DANS une région déjà vivante : le
  // calque est donc posé (vide) une image avant la bulle. Poser les deux d'un
  // coup n'annoncerait rien.
  calque.setAttribute('aria-live', 'polite')
  ;(calqueParent ?? document.body).append(calque)
  return calque
}

// -------------------------------------------------------------- l'apparition

function ferme({ definitif }) {
  if (!courante) return
  const { id, noeud } = courante
  courante = null
  noeud.remove()
  if (surEchap) {
    window.removeEventListener('keydown', surEchap)
    surEchap = null
  }
  // ⚠️ ÉCHAP N'EST PAS « J'AI COMPRIS ». Fermer d'un revers de touche dit
  // « pas maintenant » ; seul le bouton dit « je sais m'en servir ». L'aide
  // non acquittée reviendra à la prochaine activation, et c'est honnête : on
  // n'a pas le droit de conclure à la compréhension d'un geste de rejet.
  if (!definitif) return
  vues = acquitte(chargeVues(), id)
  ecrisAcquittement(id)
}

function montre(aide) {
  degageLaVue?.()
  ouvreCalque()

  const b = el('div', 'ce-aide')
  b.setAttribute('role', 'group')
  b.setAttribute('aria-label', aide.titre ?? 'Aide')
  if (aide.pose) b.dataset.pose = aide.pose
  if (aide.titre) b.append(el('div', 'ce-aide-titre', aide.titre))
  b.append(el('p', 'ce-aide-texte', aide.texte))
  if (aide.note) b.append(el('p', 'ce-aide-note', aide.note))

  const ok = el('button', 'ce-aide-ok', aide.action)
  ok.type = 'button'
  ok.addEventListener('click', () => ferme({ definitif: true }))
  b.append(ok)

  courante = { id: aide.id, noeud: b }
  surEchap = (e) => {
    if (e.key === 'Escape') ferme({ definitif: false })
  }
  window.addEventListener('keydown', surEchap)

  // une image d'attente : le calque doit être vivant avant l'insertion pour
  // que la région `aria-live` annonce, et la transition CSS doit partir d'un
  // état déjà peint pour ne pas être avalée.
  requestAnimationFrame(() => {
    if (courante?.noeud !== b) return // fermée avant même d'apparaître
    calque.append(b)
    requestAnimationFrame(() => b.classList.add('on'))
  })
}

/**
 * Le point d'entrée unique : « cette option vient de passer à `actif` ».
 *
 * Appelable à volonté, y compris à chaque bascule et au démarrage. C'est la
 * règle pure qui tranche ; ici on ne fait qu'obéir.
 */
export function evalue(id, actif) {
  // L'option qu'on éteint retire sa bulle : une consigne pour un mode qui
  // n'est plus allumé est une consigne fausse.
  if (!actif && courante?.id === id) ferme({ definitif: false })
  if (!doitMontrer({ id, actif, vues: chargeVues() })) return
  if (courante) return // une seule bulle à la fois, jamais d'empilement
  const aide = AIDES.find((a) => a.id === id)
  if (!aide) return
  // La cible peut ne pas exister encore (panneau replié, Studio) : dans ce cas
  // on ne montre RIEN plutôt que de poser la bulle n'importe où. Une aide mal
  // placée est pire qu'une aide absente — elle pointe le mauvais endroit.
  if (!aide.cible()) return
  montre(aide)
}

// ------------------------------------------------------- la remise à zéro
//
// Adrien doit pouvoir revoir ses propres bulles pour les juger, et un visiteur
// doit pouvoir les rappeler. Sans cette porte, le mécanisme serait à sens
// unique donc invérifiable : on ne peut pas relire une phrase qu'on a acquittée.

/** Combien d'aides sont actuellement masquées. */
export function compteMasquees() {
  return nbMasquees(clesStockees())
}

/** Efface les acquittements. Rend le nombre d'aides libérées. */
export function reinitialiseAides() {
  const cles = clesAOublier(clesStockees())
  for (const k of cles) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* rien à faire : la ligne de réglage relira le vrai compte */
    }
  }
  vues = vuesDepuisCles(clesStockees())
  return cles.length
}

/**
 * La section « Aide » des Paramètres — la porte de sortie du mécanisme.
 *
 * Elle vit ICI et pas dans camera-panel.js parce qu'elle n'appartient à aucun
 * réglage : c'est le module des aides qui expose sa propre marche arrière.
 *
 * Pas de fenêtre de confirmation, délibérément : l'action est réversible en un
 * clic (« J'ai compris ») et ne détruit rien qui ait coûté du travail. Demander
 * « es-tu sûr ? » pour cela apprendrait à cliquer « oui » sans lire, ce qui
 * coûte plus cher ailleurs. La note fait la confirmation : elle change.
 */
export function aideSection() {
  const s = section('Aide')
  const note = el('div', 'ce-note')
  const b = button('Tout réafficher', () => {
    reinitialiseAides()
    majNote()
  })
  function majNote() {
    const n = compteMasquees()
    b.disabled = n === 0
    b.style.opacity = n === 0 ? '0.4' : ''
    b.style.cursor = n === 0 ? 'not-allowed' : ''
    note.textContent =
      n === 0
        ? 'Aucune bulle masquée. Elles apparaissent d’elles-mêmes à la première activation d’une option.'
        : `${n} bulle${n > 1 ? 's' : ''} masquée${n > 1 ? 's' : ''}. Elles reviendront à la prochaine activation de leur option.`
  }
  const ligne = el('div', 'ce-row ce-row-inline')
  ligne.append(el('label', 'ce-label', 'Bulles d’aide'), b)
  const wrap = el('div')
  wrap.append(ligne, note)
  // le compte se relit à chaque ouverture des Paramètres : une aide peut avoir
  // été acquittée entre-temps sans que cette section ait bougé
  onRefresh(majNote, wrap)
  s.body.append(wrap)
  return s
}
