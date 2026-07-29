import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TITRE_ACCUEIL,
  PORTES_ACCUEIL,
  porteEnAccueil,
  actionBouton,
  LIBELLE_ACTION,
} from '../src/ui/accueil.js'

// ------------------------------------------------------------------ LE TITRE
// La hiérarchie s'inverse (réf. Framer d'Adrien) : la marque devient une
// pastille, la promesse devient le titre. Le libellé est figé ici parce qu'il
// est LE message d'accueil du site — le changer se fait en un endroit.
test('le titre d’accueil est la promesse, pas une question', () => {
  assert.equal(TITRE_ACCUEIL, 'Ta carte, ton design, en 2 minutes.')
})

test('le titre d’accueil tutoie — règle du site', () => {
  assert.ok(/\bTa\b|\bton\b|\btu\b/.test(TITRE_ACCUEIL))
  assert.ok(!/\bVotre\b|\bvotre\b|\bvous\b/.test(TITRE_ACCUEIL))
})

// ------------------------------------------------------------------ LES PORTES
// Explorer quitte l'accueil : la barre de recherche juste en dessous fait déjà
// le travail (Adrien). Il REVIENT dans la barre du bas — donc c'est bien une
// règle d'accueil, pas une suppression.
test('l’accueil ne montre que Studio et Parcours', () => {
  assert.deepEqual(PORTES_ACCUEIL, ['studio', 'parcours'])
})

test('Explorer n’est pas une porte d’accueil', () => {
  assert.equal(porteEnAccueil('explorer'), false)
  assert.equal(porteEnAccueil('studio'), true)
  assert.equal(porteEnAccueil('parcours'), true)
})

test('un mode inconnu n’ouvre pas de porte d’accueil', () => {
  assert.equal(porteEnAccueil('atelier'), false)
  assert.equal(porteEnAccueil(''), false)
  assert.equal(porteEnAccueil(undefined), false)
})

// ------------------------------------------- LE BOUTON DE LA BARRE DE RECHERCHE
// Le MÊME bouton porte deux visages : « GPX » dans la barre du bas, « Aller »
// en accueil. Un seul bouton, donc une seule géométrie liquide.
test('recherche endormie : le bouton reste l’import GPX', () => {
  assert.equal(actionBouton({ accueil: false, saisie: '', champActif: false }), 'gpx')
})

test('un lieu tapé fait TOUJOURS partir la recherche, accueil ou pas', () => {
  assert.equal(actionBouton({ accueil: true, saisie: 'Annecy' }), 'aller')
  assert.equal(actionBouton({ accueil: false, saisie: 'Annecy' }), 'aller')
  assert.equal(actionBouton({ accueil: false, saisie: '45.9, 6.87', champActif: true }), 'aller')
})

// « quand le champ est vide, il ne doit pas rester actif à ne rien faire »
// (Adrien) : il devient un raccourci vers le champ.
test('en accueil, un champ vide renvoie au champ au lieu de ne rien faire', () => {
  assert.equal(actionBouton({ accueil: true, saisie: '' }), 'focus')
  assert.equal(actionBouton({ accueil: true, saisie: '   ' }), 'focus')
  assert.equal(actionBouton({ accueil: true, saisie: '\n\t ' }), 'focus')
})

// ⚠️ LE PIÈGE MESURÉ : entrer dans le champ fait redescendre l'accueil. Si le
// bouton ne lisait que `body.ce-hub`, il redeviendrait « GPX » pile au moment
// où le visiteur s'apprête à taper son lieu — et son clic ouvrirait un
// sélecteur de fichiers.
test('le champ éveillé garde le bouton sur la recherche, même accueil fermé', () => {
  assert.equal(actionBouton({ accueil: false, saisie: '', champActif: true }), 'focus')
})

test('champ rendu, champ vidé : le bouton redevient GPX', () => {
  assert.equal(actionBouton({ accueil: false, saisie: 'Annecy', champActif: true }), 'aller')
  assert.equal(actionBouton({ accueil: false, saisie: '', champActif: false }), 'gpx')
})

test('l’action se décide sans argument comme hors accueil', () => {
  assert.equal(actionBouton(), 'gpx')
  assert.equal(actionBouton({}), 'gpx')
})

test('chaque action a son libellé, et « aller » et « focus » portent le même', () => {
  assert.equal(LIBELLE_ACTION.gpx, 'GPX')
  assert.equal(LIBELLE_ACTION.aller, 'Aller')
  assert.equal(LIBELLE_ACTION.focus, 'Aller')
})
