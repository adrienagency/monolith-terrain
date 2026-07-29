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
import { setUiAdvanced } from './bars.js'
import { creerSas } from './hub-sas.js'
import { TITRE_ACCUEIL } from './accueil.js'

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
  // LA HIÉRARCHIE EST INVERSÉE depuis le 29/07 (Adrien, réf. landing Framer) :
  // la marque n'est plus le titre, c'est une PASTILLE ; le titre, c'est la
  // promesse. On arrive sur un site, pas sur un questionnaire — « Que veux-tu
  // faire ? » demandait au visiteur de trouver la réponse, « Ta carte, ton
  // design, en 2 minutes. » la lui donne. Les deux nœuds ne changent pas de
  // nom (.ce-hubmark / .ce-hubq) : c'est leur TAILLE qui change de rôle, et
  // toute la mise en forme vit dans v28.css.
  const head = el('div', 'ce-hubhead')
  const mark = el('div', 'ce-hubmark')
  mark.innerHTML = 'ShibuMap<span>.</span>'
  head.append(mark, el('h1', 'ce-hubq', TITRE_ACCUEIL))

  const foot = el('div', 'ce-hubfoot')
  const drop = el('div', 'ce-hubdrop', 'ou dépose un fichier GPX n’importe où — pas de fichier ? La démo t’attend dans Parcours.')
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

  // LA PLACE DU CENTRE EST PARTAGÉE avec la carte de chargement (#loading, posée
  // en dur dans index.html). Les deux visent le milieu de la fenêtre, et leurs
  // horloges n'ont rien en commun : l'accueil monte 900 ms après main.js, la
  // carte s'efface quand le relief est prêt. Sans arbitre, sur machine lente,
  // le visiteur recevait les DEUX en même temps — deux « ShibuMap », deux
  // sous-titres, du texte fantôme derrière les trois portes.
  // L'ARBITRAGE A CHANGÉ DE SENS DEUX FOIS le 28/07, et c'est la règle
  // d'origine qui a gagné (Adrien) : « la barre de menu ne commence à bouger
  // que dès que le loader a terminé de s'exécuter ». L'inversion intermédiaire
  // — la carte s'effaçait sous l'accueil qui montait — ne supprimait pas le
  // recouvrement, elle le raccourcissait : deux fondus qui se croisent restent
  // lisibles ensemble, et une capture d'Adrien l'a montré. Le POURQUOI complet
  // est dans hub-sas.js ; la règle y vit, pure et testée. Ici, juste le câblage.
  //
  // Le loader est cherché DANS LE DOM plutôt que passé en paramètre : il est
  // inline dans index.html, il existe avant tout module, et main.js n'a rien à
  // savoir de cette entente — c'est aussi ce que fait ui/loading-hints.js.
  const chargement = document.getElementById('loading')
  const chargementVisible = () => !!chargement && !chargement.classList.contains('hidden')

  const sas = creerSas({
    montrer: lever,
    occupe: chargementVisible(),
  })

  // ⚠️ on écoute la CLASSE, jamais `transitionend` : dans un onglet non
  // composité le navigateur gèle les transitions et l'événement n'arrive
  // jamais — le sas ne saurait plus qui occupe le centre. Même motif que le
  // fondu des phrases de chargement, et même raison.
  if (chargement) {
    new MutationObserver(() => {
      chargementVisible() ? sas.occuper() : sas.liberer()
    }).observe(chargement, { attributes: true, attributeFilter: ['class'] })
  }

  // la montée elle-même — appelée par le sas, jamais directement, car c'est lui
  // qui sait si la place est libre. Les gardes restent doublées (show ET ici) :
  // le sas doit pouvoir appeler montrer() sans connaître nos contextes bloqués.
  function lever() {
    if (blocked() || isOpen()) return
    if (input) input.placeholder = askPlaceholder
    bar.setHome(true)
  }

  function show() {
    if (blocked() || isOpen()) return
    sas.demander()
  }
  function hide() {
    // ⚠️ l'annulation vaut aussi quand l'accueil n'est PAS encore monté : une
    // demande en attente derrière un chargement remonterait sinon toute seule,
    // longtemps après qu'Adrien a appuyé sur Échap pour explorer librement.
    sas.annuler()
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
    // Franchir une porte de l'accueil ramène TOUJOURS au mode simple (Adrien).
    // L'accueil montre déjà le cœur simple — mais seulement parce que
    // `body.ce-hub` le force (elembar) : la préférence « Avancé » d'une visite
    // précédente reprenait la main dès que la barre redescendait, et on
    // répondait à « Que veux-tu faire ? » par tous les panneaux ouverts.
    // C'est fait AVANT hide(), pour que la bulle de liquide n'ait pas à morpher
    // vers la capsule avancée pour revenir aussitôt.
    setUiAdvanced(false)
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
  // ⚠️ « ou en attente », et ce n'est pas un détail : depuis que l'accueil
  // attend la fin du chargement, il n'est PAS ouvert pendant que la carte de
  // chargement est à l'écran — or c'est exactement là qu'elle promet « Echap —
  // explorer librement ». Sans ce second cas, on appuyait sur Échap, il ne se
  // passait rien, et l'accueil montait quand même deux secondes plus tard.
  // Mesuré en navigateur avant correction : montée à 3 681 ms malgré un Échap
  // à 1 240 ms.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (isOpen() || sas.enAttente())) escape()
  })

  return { show, hide, isOpen, toggle: () => (isOpen() ? escape() : show()) }
}
