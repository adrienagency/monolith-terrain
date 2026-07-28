import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creerSas } from '../src/ui/hub-sas.js'

// LE SAS, PRIORITÉ INVERSÉE (28/07, Adrien). La première version faisait
// attendre l'accueil tant que la carte de chargement occupait le centre.
// Adrien a retourné la règle le jour même : l'ACCUEIL PRIME — dès que la barre
// commence à monter, c'est la carte de chargement qui s'efface, en fondu
// rapide. Le visiteur voit l'interface arriver au lieu d'attendre.
// Ces tests décrivent donc la règle inversée ; l'ancienne (l'accueil attend)
// est dans l'historique de ce fichier si un jour il faut la relire.
//
// Plus aucun minuteur ici : personne n'attend plus personne. La montée est
// immédiate, l'effacement est un ordre (le fondu lui-même est en CSS, et on
// n'écoute jamais `transitionend` — voir hub-sas.js).

// petit atelier : un sas + des compteurs pour chaque effet de bord.
// `ouvert` reflète l'état réel de l'accueil, comme isOpen() dans hub.js :
// il devient vrai à la montée, faux quand le test « referme » l'accueil.
function atelier({ occupe = false } = {}) {
  let montees = 0
  let effacements = 0
  let retours = 0
  let ouvert = false
  const sas = creerSas({
    montrer: () => { montees++; ouvert = true },
    effacer: () => effacements++,
    retablir: () => retours++,
    ouvert: () => ouvert,
    occupe,
  })
  return {
    sas,
    fermer: () => { ouvert = false; sas.annuler() }, // Échap / focus recherche
    montees: () => montees,
    effacements: () => effacements,
    retours: () => retours,
  }
}

// ------------------------------------------------------- la place est libre
test('place libre : l’accueil monte tout de suite, rien à effacer', () => {
  const a = atelier()
  a.sas.demander()
  assert.equal(a.montees(), 1)
  assert.equal(a.effacements(), 0)
})

// -------------------------------------- LE RENVERSEMENT : l'accueil prime
test('carte de chargement à l’écran : l’accueil monte ET la carte s’efface', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  assert.equal(a.montees(), 1, 'la montée n’attend plus la carte')
  assert.equal(a.effacements(), 1, 'la carte reçoit l’ordre de céder')
})

test('deux demandes pendant le chargement : un seul effacement', () => {
  // le réveil automatique (900 ms) et un clic sur le logo peuvent tomber tous
  // les deux pendant le même chargement — la carte ne cède qu'une fois.
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.demander()
  assert.equal(a.effacements(), 1)
})

test('la carte ne cède pas si le chargement est déjà fini', () => {
  const a = atelier({ occupe: true })
  a.sas.liberer() // le relief est prêt, la carte est partie d'elle-même
  a.sas.demander()
  assert.equal(a.montees(), 1)
  assert.equal(a.effacements(), 0, 'rien à effacer : la place était libre')
})

// ------------------------------- le chargement finit sans interaction
test('personne n’a rien demandé : la fin du chargement ne montre rien', () => {
  const a = atelier({ occupe: true })
  a.sas.liberer()
  assert.equal(a.montees(), 0)
  assert.equal(a.effacements(), 0)
  assert.equal(a.retours(), 0)
})

// ---------------------------------------------------- Échap / annulation
test('Échap pendant le chargement : l’accueil part, la carte REVIENT', () => {
  // la carte avait cédé pour l'accueil ; l'accueil parti, le chargement court
  // toujours — sans elle le visiteur fixerait une image figée sans un mot.
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.fermer()
  assert.equal(a.retours(), 1, 'la carte reprend le centre')
})

test('Échap après la fin du chargement : la carte ne revient pas', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer() // le relief est prêt, la carte s'est effacée pour de bon
  a.fermer()
  assert.equal(a.retours(), 0)
})

test('Échap sans chargement en cours : rien à rétablir', () => {
  const a = atelier()
  a.sas.demander()
  a.fermer()
  assert.equal(a.retours(), 0)
})

test('après un Échap, une nouvelle montée refait céder la carte', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.fermer()
  a.sas.demander() // le visiteur re-clique le logo, le chargement court encore
  assert.equal(a.montees(), 2)
  assert.equal(a.effacements(), 2)
})

// --------------------------- un chargement démarre SOUS l'accueil ouvert
test('une carte qui apparaît sous l’accueil ouvert cède immédiatement', () => {
  // chargement à chaud (recherche, zoom…) pendant que l'accueil est au
  // centre : la laisser monter remettrait deux titres l'un sur l'autre —
  // exactement le bug d'origine, dans l'autre sens.
  const a = atelier()
  a.sas.demander() // accueil ouvert, place libre
  a.sas.occuper() // un chargement démarre
  assert.equal(a.effacements(), 1)
})

test('une carte qui apparaît accueil fermé reste à l’écran', () => {
  const a = atelier()
  a.sas.occuper()
  assert.equal(a.effacements(), 0)
})

test('un doublon d’occupation sous l’accueil ouvert n’efface qu’une fois', () => {
  const a = atelier()
  a.sas.demander()
  a.sas.occuper()
  a.sas.occuper() // le loader repasse par la même classe
  assert.equal(a.effacements(), 1)
})

// ---------------------------------------------------- cycles successifs
test('chaque nouveau chargement repart d’une carte pleine', () => {
  // premier chargement : la carte cède pour l'accueil, puis finit (liberer).
  // Second chargement accueil fermé : la carte doit vivre sa vie normale.
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.fermer()
  a.sas.occuper() // second chargement, accueil fermé
  assert.equal(a.effacements(), 1, 'la carte du second chargement ne cède pas')
  a.sas.liberer()
  assert.equal(a.retours(), 0)
})

// ------------------------------------------------------------ états lus
test('le sas dit si la place est prise et si la carte a cédé', () => {
  const a = atelier({ occupe: true })
  assert.equal(a.sas.placePrise(), true)
  assert.equal(a.sas.aCede(), false)
  a.sas.demander()
  assert.equal(a.sas.aCede(), true)
  a.sas.liberer()
  assert.equal(a.sas.placePrise(), false)
  assert.equal(a.sas.aCede(), false, 'la fin du chargement remet les compteurs à zéro')
})
