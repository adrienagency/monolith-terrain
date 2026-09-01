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

// ⚠️ « L'ÉCRAN EST DÉCOUVERT » — un fait que personne ne disait, et qui manquait.
// Le sas d'accueil couvre TOUTE la fenêtre, barre du haut comprise, jusqu'à ce
// que le visiteur le ferme. Une arrivée qui s'anime au montage de son bouton se
// joue donc SOUS le voile : mesuré au démarrage, la respiration de l'anneau du
// compte était `finished` à 7,3 s alors que le sas ne s'effaçait qu'à 8,5 s —
// personne ne l'a jamais vue. La classe est posée UNE FOIS, quand le sas tombe,
// et ne se retire jamais : rouvrir l'accueil plus tard n'est plus une première
// arrivée.
//
// ⚠️ PLUS AUCUNE FEUILLE DE STYLE NE LA LIT AUJOURD'HUI. Elle armait la
// respiration de l'anneau du compte ; Adrien a fait retirer cet anneau le
// 2026-08-08 (« c'était une mauvaise idée »), et le halo est parti avec lui.
//
// Elle est gardée quand même, et c'est une décision : « l'écran vient d'être
// découvert » est un moment réel, difficile à retrouver après coup, et le seul
// endroit d'où l'on puisse déclencher une arrivée sans la dépenser derrière un
// voile opaque. Mais elle est aujourd'hui SANS CONSOMMATEUR — qui la cherchera
// dans le CSS ne trouvera rien, et c'est normal.
const devoiler = () => document.body.classList.add('ce-devoile')

export function buildHub({ bar, bottomBar, onExplore }) {
  // pas de barre (mode embed) : un accueil sans son objet n'a pas de sens
  if (!bar?.root) { devoiler(); return { show() {}, hide() {}, toggle() {}, isOpen: () => false } }

  // le voile vit SOUS les barres (z-index 56 < topbar 60) : la topbar reste
  // nette et cliquable — c'est son logo qui fait remonter la barre au centre.
  const veil = el('div', 'ce-hubveil')
  document.body.append(veil)

  // LA CROIX DE SORTIE (Adrien : « ajoute une croix pour fermer le layout de
  // voile »). Deux sorties existaient déjà — Échap, et un clic n'importe où sur
  // le voile — mais aucune ne se VOIT : rien à l'écran ne dit qu'on peut
  // partir, et la ligne « Échap — explorer librement » est un mot, pas une
  // cible. La croix est la troisième porte, celle qu'on cherche du regard.
  //
  // ⚠️ ELLE VIT DANS LE VOILE, ET C'EST CE QUI LA REND GRATUITE. Le voile porte
  // déjà le fondu (opacity) et la bascule `pointer-events` de `body.ce-hub` :
  // la croix hérite des deux, donc elle apparaît, disparaît et cesse d'être
  // cliquable exactement en même temps que ce qu'elle ferme. Posée sur le body,
  // il aurait fallu répliquer ces trois règles — et les tenir à jour.
  //
  // ⚠️ ON NE TOUCHE PAS AU FLOU. Adrien l'a défendu explicitement (« c'est ce
  // que je veux, je ne veux pas le déflouter !!! ») : on ajoute une SORTIE, pas
  // un changement d'apparence.
  const croix = el('button', 'ce-hubclose')
  croix.type = 'button'
  croix.textContent = '✕'
  croix.setAttribute('aria-label', 'Fermer l’accueil')
  croix.setAttribute('data-tip', 'Fermer — explorer librement')
  veil.append(croix)

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
  const drop = el('div', 'ce-hubdrop', 'ou dépose un fichier GPX n’importe où')
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
    // un contexte bloqué (boutique, Studio, viewer) n'aura JAMAIS de sas :
    // l'écran y est découvert dès la première image, il faut le dire aussi.
    if (blocked()) { devoiler(); return }
    if (isOpen()) return
    sas.demander()
  }
  function hide() {
    // ⚠️ l'annulation vaut aussi quand l'accueil n'est PAS encore monté : une
    // demande en attente derrière un chargement remonterait sinon toute seule,
    // longtemps après qu'Adrien a appuyé sur Échap pour explorer librement.
    sas.annuler()
    // le voile s'en va (ou ne viendra plus) : à partir d'ici, ce qui s'anime
    // dans la barre est réellement regardé.
    devoiler()
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
  // ══════ LA MOLETTE EST UNE SORTIE, ELLE AUSSI — Tâche R29 bis ═══════════
  //
  // ⛔ **CE QUE VOIT QUELQU'UN QUI OUVRE L'APPLICATION, ET QUE PERSONNE
  // N'AVAIT MESURÉ.** Le voile porte `pointer-events: auto` (v28.css) et n'avait
  // que TROIS sorties : le clic, le focus du champ, et Échap. Or le premier
  // geste d'un visiteur sur une carte est de **défiler**. Relevé au navigateur
  // (`.banc/R30/voile.json`, trois chargements sur trois, pose stable sur
  // 400 images) : **37 crans de molette envoyés à la souris, 0 reçu** par
  // `modes._zoomGesture` ; un glissé de 160 px : rien non plus. Un CLIC, et tout
  // repart. Qui ne clique pas a une molette morte, sans limite de temps et sans
  // message.
  //
  // ⚠️ **ET LES QUATRE SONDES DE CETTE CAMPAGNE RETIRENT LE VOILE EN PREMIÈRE
  // LIGNE** — c'est pour ça que le défaut a traversé tout le chantier : aucun
  // banc n'a jamais mesuré l'application telle qu'on la reçoit.
  //
  // ⛔ **ET LA SORTIE VA SUR LA FENÊTRE, PAS SUR LE VOILE — mesuré, pas
  // supposé.** Le premier jet posait l'écouteur sur `veil` : le journal est
  // resté identique au bit, `d = 145,5` avant comme après les 32 crans. La
  // sonde donne le coupable dans son propre relevé —
  // `sousLeCurseur: "BUTTON.ce-wm-btn"` : au centre de l'écran ce n'est PAS le
  // voile qui reçoit le geste, c'est le bouton de mode du hub, qui est son
  // frère dans l'arbre et non son enfant. Un écouteur sur le voile ne voit donc
  // jamais le cran. Même portée qu'Échap, même garde, deux lignes plus bas.
  //
  // ⚠️ **PAS DE `preventDefault`, ET C'EST DÉLIBÉRÉ** : tant que le voile capte,
  // la toile ne reçoit rien (`domElement` n'est pas dans le chemin de
  // l'événement), donc il n'y a rien à empêcher — et le cran qui ouvre reste
  // consommé par l'ouverture, exactement comme le clic.
  window.addEventListener('wheel', () => {
    if (isOpen() || sas.enAttente()) escape()
  }, { capture: true, passive: true })
  // ⚠️ `stopPropagation` : la croix est DANS le voile, qui ferme déjà au clic.
  // Sans ça, un clic sur la croix déclenchait `escape()` deux fois — `hide()`
  // ressort tout seul au second passage, mais `onExplore` partait en double.
  croix.addEventListener('click', (e) => { e.stopPropagation(); escape() })
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
