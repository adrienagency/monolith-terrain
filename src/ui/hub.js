// ACCUEIL — l'état « grand » de LA barre (idée Adrien, remplace le popup des
// trois portes). Ce n'est plus un composant à part : c'est la barre du bas,
// posée au centre de l'écran, avec ses trois portes en colonne (picto, titre,
// sous-titre) et le cartouche de recherche dessous. Cliquer une porte la fait
// COULER jusqu'à sa place en bas, puis ouvre la demande du visiteur.
//
// Ce module n'ajoute donc AUCUN bouton : il pose le voile, les mots qui
// entourent la barre (marque, question, indices), et bascule l'état. Les
// actions sont celles de la barre elle-même — un seul câblage, pas deux.

import { el } from './kit.js'

// contextes où l'accueil ne doit JAMAIS apparaître : interface masquée,
// vitrine embarquée, boutique, Race Studio, Studio, viewer d'une shibu reçue.
const BLOCKED = ['ce-noui', 'ce-embed', 'store-mode', 'studio-mode', 'atelier-mode', 'shibu-view']
const blocked = () => BLOCKED.some((c) => document.body.classList.contains(c))

export function buildHub({ bar, bottomBar, onExplore }) {
  // pas de barre (mode embed) : un accueil sans son objet n'a pas de sens
  if (!bar?.root) return { show() {}, hide() {}, toggle() {}, isOpen: () => false }

  // le voile vit SOUS les barres (z-index 56 < topbar 60) : la topbar reste
  // nette et cliquable — c'est son logo qui fait remonter la barre au centre.
  const veil = el('div', 'ce-hubveil')
  document.body.append(veil)

  // les mots vivent DANS le wrap de la barre : ils voyagent avec elle et se
  // replient (max-height) quand elle redescend — jamais display:none.
  const head = el('div', 'ce-hubhead')
  const mark = el('div', 'ce-hubmark')
  mark.innerHTML = 'ShibuMap<span>.</span>'
  head.append(mark, el('div', 'ce-hubq', 'Que voulez-vous faire ?'))

  const foot = el('div', 'ce-hubfoot')
  const drop = el('div', 'ce-hubdrop', 'ou déposez un fichier GPX n’importe où — pas de fichier ? La démo vous attend dans Parcours.')
  const esc = el('button', 'ce-hubesc', 'Échap — explorer librement')
  esc.type = 'button'
  foot.append(drop, esc)

  bar.root.prepend(head)
  bar.root.append(foot)

  const core = bar.root.querySelector('.ce-qb-core')
  const input = bottomBar?.input || null
  const askPlaceholder = 'Rechercher un lieu…'
  const barPlaceholder = input?.placeholder || ''

  const isOpen = () => document.body.classList.contains('ce-hub')

  function show() {
    if (blocked() || isOpen()) return
    if (input) input.placeholder = askPlaceholder
    bar.setHome(true)
  }
  function hide() {
    if (!isOpen()) return
    if (input) input.placeholder = barPlaceholder
    bar.setHome(false)
  }

  // Une porte cliquée : la barre DESCEND d'abord, l'action part ensuite. Le
  // clic est intercepté en CAPTURE puis rejoué à l'arrivée sur le même bouton —
  // aucune action n'est réécrite ici, c'est le câblage de la barre qui sert.
  // (Sans ce délai, Studio et Parcours passent en plein écran et masquent la
  // barre avant qu'on l'ait vue couler.)
  let replay = 0
  core?.addEventListener('click', (e) => {
    if (!isOpen()) return
    const btn = e.target.closest?.('.ce-wm-btn')
    if (!btn) return
    e.preventDefault()
    e.stopPropagation()
    // la porte choisie devient active TOUT DE SUITE : le pont de liquide et la
    // coche voyagent sous elle pendant la descente
    core.querySelectorAll('.ce-wm-btn').forEach((b) => b.classList.toggle('on', b === btn))
    hide()
    // « Explorer » est un interrupteur dans la barre ; depuis l'accueil, il ne
    // peut que OUVRIR le panneau — le rejouer alors qu'il est déjà déplié le
    // refermerait, ce qui n'a aucun sens comme réponse à la question posée.
    if (btn.dataset.mode === 'explorer' && document.body.classList.contains('ce-explore')) return
    clearTimeout(replay)
    replay = setTimeout(() => btn.click(), 340)
  }, true)

  // le champ de recherche est le VRAI champ : y entrer fait redescendre la
  // barre sans lui voler le focus
  input?.addEventListener('focus', () => hide())

  const escape = () => { hide(); onExplore?.() }
  esc.addEventListener('click', escape)
  veil.addEventListener('click', escape)
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) escape() })

  return { show, hide, isOpen, toggle: () => (isOpen() ? escape() : show()) }
}
