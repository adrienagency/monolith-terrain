import { el, section, refreshAll } from './kit.js'
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

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12.5 12 17l9-4.5"/><path d="M3 17.5 12 22l9-4.5"/></svg>'

export function buildCouchesPanel(ctx) {
  const panel = new Panel({
    title: 'Couches',
    icon: ICON,
    side: 'left',
    width: 288,
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

    resume.textContent = etat.budget.resume
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
      const cout = el('span', 'ce-couche-cout', `${c.cout}`)
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

      liste.append(ligne)
    }
  }

  rendre()
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
