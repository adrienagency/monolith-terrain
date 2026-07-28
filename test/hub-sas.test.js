import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creerSas, FONDU_MS } from '../src/ui/hub-sas.js'

// Minuteur factice : on avance le temps à la main. Aucun test n'attend, et on
// peut inspecter ce qui reste en attente — c'est ce qui prouve qu'aucune
// montée fantôme ne survit à une annulation.
function faireMinuteur() {
  let maintenant = 0
  let n = 0
  const taches = new Map()
  return {
    poser: (fn, ms) => {
      taches.set(++n, { fn, quand: maintenant + ms })
      return n
    },
    retirer: (cle) => taches.delete(cle),
    avancer(ms) {
      maintenant += ms
      for (const [cle, t] of [...taches]) {
        if (t.quand <= maintenant) {
          taches.delete(cle)
          t.fn()
        }
      }
    },
    enAttente: () => taches.size,
  }
}

// petit atelier : un sas + un compteur de montées
function atelier({ occupe = false } = {}) {
  const m = faireMinuteur()
  let montees = 0
  const sas = creerSas({ montrer: () => montees++, occupe, poser: m.poser, retirer: m.retirer })
  return { m, sas, montees: () => montees }
}

// ------------------------------------------------------- la place est libre
test('place libre : l’accueil monte tout de suite', () => {
  const a = atelier()
  a.sas.demander()
  assert.equal(a.montees(), 1)
})

// Deux demandes PENDANT L'ATTENTE ne font qu'une montée : le clic sur le logo
// de la topbar et le réveil automatique du démarrage peuvent tomber tous les
// deux avant que le chargement ne s'efface.
test('deux demandes en attente ne font qu’une seule montée', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.demander()
  a.sas.liberer()
  a.m.avancer(FONDU_MS)
  assert.equal(a.montees(), 1)
  assert.equal(a.m.enAttente(), 0)
})

// ------------------------------------------------- la place est occupée
test('carte de chargement à l’écran : l’accueil ne monte pas', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  assert.equal(a.montees(), 0)
})

test('l’accueil monte une fois la carte de chargement effacée', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.m.avancer(FONDU_MS)
  assert.equal(a.montees(), 1)
})

// LE CŒUR DU BUG : monter pendant que la carte s'efface, c'est encore deux
// titres l'un sur l'autre — en plus pâle, mais toujours là.
test('l’accueil ne monte pas PENDANT le fondu de la carte de chargement', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.m.avancer(FONDU_MS - 1)
  assert.equal(a.montees(), 0)
})

test('une carte de chargement qui revient pendant le fondu resuspend la montée', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.m.avancer(FONDU_MS - 1)
  a.sas.occuper() // un second chargement démarre (recherche, zoom…)
  a.m.avancer(10_000)
  assert.equal(a.montees(), 0)
  assert.equal(a.m.enAttente(), 0, 'aucune montée fantôme ne doit rester en attente')
  // et quand cette seconde carte s'efface, la demande tient toujours
  a.sas.liberer()
  a.m.avancer(FONDU_MS)
  assert.equal(a.montees(), 1)
})

test('rien n’est demandé : effacer la carte de chargement ne montre rien', () => {
  const a = atelier({ occupe: true })
  a.sas.liberer()
  a.m.avancer(10_000)
  assert.equal(a.montees(), 0)
})

// ---------------------------------------------------------------- annuler
test('annuler pendant l’attente : l’accueil ne montera jamais', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.annuler() // Échap, ou le visiteur clique dans la barre de recherche
  a.sas.liberer()
  a.m.avancer(10_000)
  assert.equal(a.montees(), 0)
  assert.equal(a.m.enAttente(), 0)
})

test('annuler pendant le fondu : aucun minuteur ne survit', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.liberer()
  a.sas.annuler()
  a.m.avancer(10_000)
  assert.equal(a.montees(), 0)
  assert.equal(a.m.enAttente(), 0)
})

test('après une annulation, une nouvelle demande fonctionne', () => {
  const a = atelier({ occupe: true })
  a.sas.demander()
  a.sas.annuler()
  a.sas.demander()
  a.sas.liberer()
  a.m.avancer(FONDU_MS)
  assert.equal(a.montees(), 1)
})

// ------------------------------------------------------------ états lus
test('le sas dit s’il attend et si la place est prise', () => {
  const a = atelier({ occupe: true })
  assert.equal(a.sas.enAttente(), false)
  assert.equal(a.sas.placePrise(), true)
  a.sas.demander()
  assert.equal(a.sas.enAttente(), true)
  a.sas.liberer()
  assert.equal(a.sas.placePrise(), false)
  a.m.avancer(FONDU_MS)
  assert.equal(a.sas.enAttente(), false, 'la demande est consommée par la montée')
})

test('occuper deux fois de suite ne perd pas la demande', () => {
  const a = atelier()
  a.sas.occuper()
  a.sas.demander()
  a.sas.occuper() // doublon (le loader repasse par la même classe)
  a.sas.liberer()
  a.m.avancer(FONDU_MS)
  assert.equal(a.montees(), 1)
})
