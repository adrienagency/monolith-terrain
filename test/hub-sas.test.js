import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creerSas, FONDU_MS } from '../src/ui/hub-sas.js'

// LE SAS, RENDU À SA RÈGLE D'ORIGINE (28/07, Adrien) : « la barre de menu ne
// commence à bouger que dès que le loader a terminé de s'exécuter ».
//
// Ce fichier a décrit la règle inverse pendant quelques heures — l'accueil
// primait, la carte de chargement s'effaçait sous lui. Elle a échoué en
// production, et la raison mérite d'être ici plutôt que dans l'historique :
// elle ne supprimait pas le recouvrement, elle le RACCOURCISSAIT. Fondu de la
// carte 0,18 s contre montée des mots 0,24 s — les deux étaient lisibles
// ensemble par construction. Le test « jamais deux au centre » ci-dessous est
// donc le test cardinal de ce fichier : il ne porte pas sur des durées, il
// porte sur l'ordre de passage.

// petit atelier : un sas, des compteurs, et un minuteur qu'on déclenche à la
// main pour ne pas faire attendre la suite de tests.
function atelier({ occupe = false } = {}) {
  let montees = 0
  let arme = null
  let delai = 0
  const sas = creerSas({
    montrer: () => { montees++ },
    occupe,
    poser: (fn, ms) => { arme = fn; delai = ms; return 1 },
    retirer: () => { arme = null; delai = 0 },
  })
  return {
    sas,
    montees: () => montees,
    delai: () => delai,
    arme: () => !!arme,
    // le minuteur arrive à terme
    ecouler: () => { const f = arme; arme = null; if (f) f() },
  }
}

test('place libre : l’accueil monte tout de suite, sans délai inventé', () => {
  const a = atelier()
  a.sas.demander()
  assert.equal(a.montees(), 1)
  assert.equal(a.arme(), false, 'aucun minuteur quand la place est libre')
})

test('carte de chargement au centre : l’accueil ATTEND, il ne monte pas', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  assert.equal(a.montees(), 0, 'la barre ne doit pas bouger pendant le chargement')
  assert.equal(a.sas.enAttente(), true)
})

test('le chargement fini, l’accueil monte — après le fondu de la carte', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  assert.equal(a.montees(), 0, 'pas avant que le fondu soit consommé')
  assert.equal(a.delai(), FONDU_MS)
  a.ecouler()
  assert.equal(a.montees(), 1)
})

test('JAMAIS deux au centre — le cas qui a échoué en production', () => {
  const a = atelier({ occupe: true })
  // la barre veut monter pendant tout le chargement, plusieurs fois
  a.sas.demander()
  a.sas.demander()
  a.sas.demander()
  assert.equal(a.montees(), 0, 'la carte occupe encore : rien ne monte')
  // le chargement finit ; tant que le fondu court, toujours rien
  a.sas.liberer()
  assert.equal(a.montees(), 0)
  // et seulement là
  a.ecouler()
  assert.equal(a.montees(), 1, 'une seule montée, une fois la place vraiment vide')
})

test('la demande ne se dédouble pas', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.demander()
  a.sas.liberer()
  a.ecouler()
  assert.equal(a.montees(), 1)
})

test('chargement à chaud : la carte revient, la montée programmée est annulée', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer() // le premier chargement finit, le fondu court
  assert.equal(a.arme(), true)
  a.sas.occuper() // un second chargement démarre avant la fin du fondu
  assert.equal(a.arme(), false, 'le minuteur est oublié')
  a.ecouler() // même s’il partait quand même, rien ne doit monter
  assert.equal(a.montees(), 0)
  // et c’est bien la fin du SECOND chargement qui fait monter l’accueil
  a.sas.liberer()
  a.ecouler()
  assert.equal(a.montees(), 1)
})

test('Échap pendant le chargement : la demande est oubliée pour de bon', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.annuler()
  assert.equal(a.sas.enAttente(), false)
  a.sas.liberer()
  a.ecouler()
  assert.equal(a.montees(), 0, 'une demande annulée ne remonte JAMAIS plus tard')
})

test('Échap pendant le fondu : le minuteur est retiré, rien ne monte', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.sas.annuler()
  assert.equal(a.arme(), false)
  a.ecouler()
  assert.equal(a.montees(), 0)
})

test('un chargement sans aucune demande ne fait rien monter', () => {
  const a = atelier({ occupe: true })
  a.sas.liberer()
  assert.equal(a.arme(), false, 'pas de minuteur si personne n’attend')
  assert.equal(a.montees(), 0)
})

test('la place se libère puis se reprend avant la demande', () => {
  const a = atelier({ occupe: true })
  a.sas.liberer()
  assert.equal(a.sas.placePrise(), false)
  a.sas.occuper()
  assert.equal(a.sas.placePrise(), true)
  a.sas.demander()
  assert.equal(a.montees(), 0, 'la carte est de nouveau là : on attend')
})

test('rien ne monte deux fois si le minuteur part après une montée', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.ecouler()
  assert.equal(a.montees(), 1)
  a.ecouler() // un minuteur fantôme
  assert.equal(a.montees(), 1, 'la demande a été consommée')
})

test('sans carte au départ, un chargement plus tard fait bien attendre', () => {
  const a = atelier() // place libre
  a.sas.demander()
  assert.equal(a.montees(), 1)
  a.sas.occuper() // chargement à chaud, l’accueil est déjà au centre
  a.sas.demander() // il ne redemande rien d’utile
  assert.equal(a.montees(), 1, 'pas de seconde montée')
})
