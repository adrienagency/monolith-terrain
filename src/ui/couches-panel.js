import { el, section, slider, onRefresh, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { etatCouches, NON, OUI_MAIS, desarmeUrl } from '../gardien.js'

// L'ONGLET « COUCHES » — et la vitrine du Gardien.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE PANNEAU NE DÉCIDE RIEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Il n'y a pas UNE soustraction dans ce fichier. Pas de « si le coût dépasse le
// restant », pas de comparaison de seuil, pas de calcul de jauge. Tout vient de
// `etatCouches()`, et c'est délibéré : si l'interface refaisait le calcul pour
// griser un bouton, la règle vivrait à DEUX endroits, et deux règles finissent
// toujours par diverger. Le jour où le budget change de nature, ce fichier ne
// bouge pas.
//
// Ce qu'il porte, en revanche, c'est le PASSÉ — `bloquees`, le jeu des couches
// refusées au rendu précédent. Le Gardien est pur : il ne se souvient de rien,
// c'est l'appelant qui tient la mémoire et lui la règle. Sans ce jeu, pas
// d'hystérésis : tous les interrupteurs s'éteindraient et se rallumeraient
// ensemble à chaque fois que le gouverneur descend puis remonte.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN REFUS PARLE TOUJOURS
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien, sur le mode continu : « un interrupteur qui s'allume sur une machine
// qui ne suit pas est pire qu'un interrupteur absent ». Le corollaire vaut ici :
// un interrupteur GRISÉ sans explication est pire qu'un interrupteur qui rame.
// Chaque refus affiche donc sa raison, avec ses chiffres, et — quand l'échange
// est possible — le bouton qui le réalise en un clic.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES SOUS-OPTIONS — UN DÉPLIANT, ET SEULEMENT QUAND LA COUCHE EST ALLUMÉE
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien veut ses tirettes « dans ses sous options ». Le panneau reste à
// interrupteurs seuls DANS SA LIGNE : les réglages vivent SOUS elle, et
// n'apparaissent qu'une fois la couche allumée. Trois raisons, et la troisième
// est la vraie :
//
//   · une tirette qui règle une couche éteinte ne règle rien, et invite à
//     chercher pourquoi « il ne se passe rien » ;
//   · le panneau garde sa lecture d'un coup d'œil — une colonne
//     d'interrupteurs — tant qu'on n'a rien allumé ;
//   · ET LE PANNEAU NE DÉCIDE TOUJOURS RIEN. `c.active` vient d'`etatCouches`,
//     donc du Gardien : la visibilité du dépliant SUIT l'état réel de la couche
//     au lieu de le supposer. Une couche éteinte d'office par `refreshSol`
//     (hors zone cuite) referme son dépliant sans qu'une ligne de ce fichier
//     ait à savoir que ce cas existe.
//
// ⚠️ ET LES TIRETTES NE SE RECONSTRUISENT PAS. Deux protections, parce qu'une
// seule ne suffisait pas :
//   1. le DOM de chaque dépliant est FABRIQUÉ UNE FOIS et mis en cache. Un
//      `slider()` du kit s'enregistre auprès de `refreshAll` ; le refabriquer à
//      chaque passe empilerait des abonnés morts, et surtout reposerait la
//      valeur au défaut si l'appelant lisait mal ses params ;
//   2. `rendre()` ne retouche la liste QUE si l'état a changé (voir
//      `signature`). Le battement de 3 s qui suit le gouverneur remplaçait
//      sinon la liste entière — donc la tirette — SOUS LE DOIGT qui la traîne.
//      Un `input[type=range]` déplacé dans le DOM en plein glissement perd sa
//      capture de pointeur : la valeur se fige et le curseur suit la souris
//      sans rien commander.

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12.5 12 17l9-4.5"/><path d="M3 17.5 12 22l9-4.5"/></svg>'

export function buildCouchesPanel(ctx) {
  const panel = new Panel({
    title: 'Couches',
    icon: ICON,
    side: 'left',
    // 268 comme TOUS les autres panneaux du rail (Carte, Terrain, Fonds,
    // Éléments, Effets…). Elle était à 288 : vingt pixels de plus suffisaient à
    // casser l'alignement de la colonne, et un rail dont les blocs ne sont pas
    // à la même largeur se lit comme un défaut de montage.
    width: 268,
    tip: 'Les couches optionnelles, et le budget que le Gardien leur accorde.',
    cls: 'ce-panel-couches',
  })

  const sJauge = panel.addSection(section('Le Gardien', { open: true }))
  const sListe = panel.addSection(section('Couches', { open: true }))

  // La jauge de budget
  const resume = el('div', 'ce-gardien-resume')
  const barre = el('div', 'ce-gardien-barre')
  const remplissage = el('i', 'ce-gardien-remplissage')
  barre.append(remplissage)
  const souffrance = el('div', 'ce-gardien-souffrance')
  const plein = el('div', 'ce-gardien-plein')
  sJauge.body.append(resume, barre, souffrance, plein)

  const liste = el('div', 'ce-couches-liste')
  sListe.body.append(liste)

  // LE PASSÉ, porté ici et nulle part ailleurs (voir l'en-tête).
  let bloquees = []

  // Les dépliants de sous-options, fabriqués à la demande et gardés. Voir
  // l'en-tête : une tirette du kit ne se refabrique pas à chaque passe.
  const depliants = new Map()
  function depliantPour(id) {
    if (depliants.has(id)) return depliants.get(id)
    const reglages = ctx.reglagesCouche?.(id)
    if (!reglages?.length) { depliants.set(id, null); return null }
    const boite = el('div', 'ce-couche-reglages')
    for (const r of reglages) boite.append(slider(r))
    depliants.set(id, boite)
    return boite
  }

  // L'état DESSINÉ au tour précédent. Tout ce qui change l'aspect d'une ligne
  // en fait partie ; le budget, lui, est redessiné à chaque passe (il n'a pas
  // de contrôle à préserver).
  let signature = null

  // `?gardien=0` est lu comme `?f3` l'est : il pose l'état de DÉPART, il ne
  // verrouille pas. Adrien s'était retrouvé ENFERMÉ par un paramètre d'adresse
  // qui, lui, verrouillait ; le désarmement doit rester rebasculable.
  let desarme = desarmeUrl(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('gardien') : null)

  function rendre() {
    const etat = etatCouches({
      actives: ctx.couchesActives(),
      machine: ctx.machine,
      gouverneur: ctx.gouverneur,
      bloquees,
      desarme,
    })

    // On enregistre le nouveau passé AVANT de dessiner : c'est ce jeu-là que
    // le rendu SUIVANT consultera.
    bloquees = etat.couches.filter((c) => c.verdict === NON).map((c) => c.id)

    // ═══════════════════════════════════════════════════════════════════════
    // LA JAUGE — vert vers rouge, et PAS un compte de « parts »
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Adrien : « on ne va pas écrire en parts mais on va faire une tirette qui
    // va du vert vers le rouge. Le vert : puissance ok. Le rouge : ça va
    // lagguer. »
    //
    // Il a raison, et la raison est plus profonde qu'une question de goût :
    // « 7 parts sur 12 » demande au visiteur d'apprendre une unité inventée
    // pour lui répondre à une question qu'il n'a pas posée. Ce qu'il veut
    // savoir tient en un mot — est-ce que ça va ramer ? Une couleur le dit
    // sans vocabulaire, et sans mentir sur la précision du chiffre (qui est
    // une calibration, pas une mesure).
    //
    // ⚠️ LA COULEUR EST UN AFFICHAGE, PAS UNE DÉCISION. Elle interpole sur
    // `fraction`, que le Gardien fournit ; le panneau ne décide toujours de
    // rien. Les seuils, eux, restent ceux du Gardien (`tendu`, `depassement`).
    const f = Math.min(1, Math.max(0, etat.budget.fraction))
    // 130° = vert, 0° = rouge. La courbe est en puissance 1,6 : le rouge doit
    // arriver TARD, sinon la jauge crie au danger dès la deuxième couche et
    // on cesse de la croire.
    remplissage.style.background = `hsl(${130 * (1 - Math.pow(f, 1.6))} 62% 48%)`
    resume.textContent = etat.budget.depassement > 0
      ? 'Au-delà de ce que cette machine tient'
      : etat.budget.tendu
        ? 'Ça commence à charger'
        : 'Marge confortable'
    // UNE phrase globale quand le budget bloque, plutôt que N paragraphes
    // presque identiques sous chaque ligne. Les raisons détaillées existent
    // toujours — elles se révèlent au survol de LA couche qu'on veut, ce qui
    // est le seul moment où elles apprennent quelque chose.
    const nbBloquees = etat.couches.filter((c) => c.verdict === NON && !c.active).length
    plein.textContent = nbBloquees
      ? `${nbBloquees} couche${nbBloquees > 1 ? 's' : ''} hors budget. Survolez-en une pour savoir laquelle éteindre.`
      : ''
    remplissage.style.width = `${Math.round(etat.budget.fraction * 100)}%`
    barre.classList.toggle('tendu', !!etat.budget.tendu)
    barre.classList.toggle('depasse', etat.budget.depassement > 0)
    souffrance.textContent = etat.souffrance.raison

    // ⚠️ LA GARDE QUI SAUVE LES TIRETTES. Sans elle, le battement de 3 s
    // remplace la liste sous le doigt qui glisse (voir l'en-tête).
    const sig = JSON.stringify(etat.couches.map((c) => [c.id, c.active, c.verdict, c.raison, c.aRetirer]))
    if (sig === signature) return
    signature = sig

    liste.replaceChildren()
    for (const c of etat.couches) {
      const ligne = el('div', 'ce-couche')
      ligne.classList.toggle('bloquee', c.verdict === NON && !c.active)

      const tete = el('div', 'ce-couche-tete')
      const btn = el('button', 'ce-toggle')
      btn.type = 'button'
      btn.classList.toggle('on', c.active)
      // Une couche ALLUMÉE reste toujours éteignable, même si le verdict est
      // « non » : le Gardien n'éteint jamais rien lui-même, et s'il empêchait
      // d'éteindre, une machine en difficulté n'aurait plus aucune issue.
      btn.disabled = !c.active && c.verdict === NON
      btn.addEventListener('click', () => {
        if (btn.disabled) return
        ctx.setCouche(c.id, !c.active)
        rendre()
        refreshAll()
      })

      const nom = el('span', 'ce-label', c.nom)
      // Le coût en PASTILLES et non en chiffre : même raison que la jauge —
      // le poids se voit, il ne se compte pas. Quatre pastilles pleines
      // pèsent visiblement plus que deux, sans avoir à expliquer l'unité.
      const cout = el('span', 'ce-couche-cout')
      cout.setAttribute('aria-label', `Poids ${c.cout} sur 4`)
      for (let i = 0; i < 4; i++) {
        const pip = el('i', 'ce-pip')
        pip.classList.toggle('on', i < c.cout)
        cout.append(pip)
      }
      cout.title = c.note
      tete.append(nom, cout, btn)
      ligne.append(tete)

      // La raison n'est affichée que lorsqu'elle apprend quelque chose : un
      // « oui » banal sous chaque ligne ferait un mur de texte, et le mur de
      // texte est exactement ce qui fait qu'on ne lit plus les avertissements.
      if (c.verdict === NON || c.verdict === OUI_MAIS) {
        ligne.append(el('p', 'ce-couche-raison', c.raison))
      }

      // L'échange en un clic. `aRetirer` vient du Gardien : le panneau ne
      // choisit pas quoi éteindre, il exécute.
      if (c.verdict === NON && c.aRetirer?.length) {
        const noms = c.aRetirer.map((id) => etat.couches.find((x) => x.id === id)?.nom ?? id)
        const ech = el('button', 'ce-btn ghost ce-couche-echange', `Éteindre ${noms.join(' et ')} pour allumer ${c.nom}`)
        ech.type = 'button'
        ech.addEventListener('click', () => {
          for (const id of c.aRetirer) ctx.setCouche(id, false)
          ctx.setCouche(c.id, true)
          rendre()
          refreshAll()
        })
        ligne.append(ech)
      }

      // LE DÉPLIANT DE SOUS-OPTIONS — voir l'en-tête. Il n'existe que pour les
      // couches qui en déclarent, et ne se montre que si la couche est
      // ALLUMÉE : `c.active` vient du Gardien, pas d'une supposition locale.
      //
      // ⚠️ ON L'ATTACHE TOUJOURS, ON LE MASQUE EN CSS. Le laisser DÉTACHÉ le
      // ferait élaguer du registre de `refreshAll` (kit.js élague ce qui n'est
      // plus connecté) : la tirette survivrait à l'écran mais cesserait de se
      // resynchroniser après un chargement de gabarit ou une réinitialisation.
      const boite = depliantPour(c.id)
      if (boite) {
        boite.style.display = c.active ? '' : 'none'
        ligne.append(boite)
      }

      liste.append(ligne)
    }
  }

  // ⚠️ LE PANNEAU S'ABONNE À `refreshAll`, ET CE N'EST PAS UN LUXE. Une couche
  // peut changer d'état SANS QUE PERSONNE N'AIT CLIQUÉ ICI : `refreshSol`
  // l'éteint hors zone cuite, et l'allumage automatique des lumières nocturnes
  // l'allume à la tombée de la nuit. Ces deux appelants appellent déjà
  // `refreshAll()` en disant « l'interrupteur doit bouger, sinon le panneau
  // ment » — mais rien n'écoutait, et l'interrupteur ne bougeait qu'au
  // battement suivant, jusqu'à 3 s plus tard. Mesuré : ▶ en plein jour allumait
  // bien la couche, et le panneau continuait d'afficher « éteinte ».
  //
  // La garde de signature juste au-dessus rend cet abonnement gratuit quand
  // rien n'a bougé — et surtout, elle empêche de reconstruire les tirettes.
  onRefresh(rendre, panel.root)
  // Le gouverneur descend en cours de session : la jauge doit suivre sans
  // qu'on ait à rouvrir le panneau. 3 s suffisent — le gouverneur lui-même ne
  // bouge jamais plus d'une fois par 20 s.
  const battement = setInterval(() => { if (panel.root.isConnected) rendre() }, 3000)

  return {
    panel,
    rendre,
    dispose() { clearInterval(battement) },
    // Pour un banc ou une capture : désarmer sans passer par l'adresse.
    setDesarme(v) { desarme = !!v; rendre() },
  }
}
