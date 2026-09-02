// LE VOILE D'ACCUEIL — PF4, bug n° 5 : « le voile avale TOUS les gestes ».
//
// MESURÉ (PF4, `scripts/profil-pf4.mjs --scenario voile`, `.banc/PF4/voile-avant.json`,
// Chrome sans tête 1280×800) : à (200, 400) — un point quelconque à gauche de
// la barre — le geste tombe sur `DIV.ce-elemwrap`, le wrap de la barre, frère
// du voile et non son enfant. Un glissé de 160 px : voile toujours ouvert,
// caméra immobile. Un double-clic : voile toujours ouvert, rien ne bouge. Seul
// le point exact du centre tombait sur le voile. La croix, elle, fermait bien.
//
// La sortie au POINTEUR a donc la portée d'Échap et de la molette (fenêtre, en
// capture) et écarte ce qui est cliquable — portes, croix, champ de recherche.
// Le geste lui-même n'est PAS rejoué sur la toile : un clic rejoué plongerait
// sur le point cliqué (main.js, clic-plongée), ce qu'un visiteur qui ferme
// l'accueil n'a pas demandé. Le geste SUIVANT arrive à la toile.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sortieAuPointeur, INTERACTIFS } from '../src/ui/hub-sortie.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

test('① la règle : ouvert ou en attente, et hors de tout ce qui se clique → sortie', () => {
  assert.equal(sortieAuPointeur({ ouvert: true, enAttente: false, interactif: false }), true)
  assert.equal(sortieAuPointeur({ ouvert: false, enAttente: true, interactif: false }), true, 'en attente derrière le chargement : Échap y répond déjà, le pointeur aussi')
  assert.equal(sortieAuPointeur({ ouvert: false, enAttente: false, interactif: false }), false, 'accueil fermé : rien à faire')
  assert.equal(sortieAuPointeur({ ouvert: true, enAttente: false, interactif: true }), false, 'une porte, la croix, le champ : leur propre écouteur décide')
  assert.equal(sortieAuPointeur({ ouvert: true, enAttente: false, interactif: false, bouton: 2 }), false, 'clic droit : pas une sortie')
  assert.equal(sortieAuPointeur(), false)
})

test('② hub.js : la sortie au pointeur a la portée d’Échap et exclut ce qui se clique', () => {
  const hub = lire('src/ui/hub.js')
  assert.match(
    hub,
    /window\.addEventListener\(\s*['"]pointerdown['"][\s\S]{0,400}?sortieAuPointeur\([\s\S]{0,300}?escape\(\)/,
    'la sortie au pointeur doit vivre sur la fenêtre, en capture, et passer par sortieAuPointeur'
  )
  assert.match(hub, /pointerdown['"][\s\S]{0,600}?capture:\s*true/, 'en capture : le wrap de la barre arrête sinon le geste avant le voile')
  assert.match(hub, /closest\?\.\(\s*INTERACTIFS\s*\)/, 'les éléments cliquables restent à leurs propres écouteurs')
  assert.match(INTERACTIFS, /\bbutton\b/)
  assert.match(INTERACTIFS, /\binput\b/)
  assert.match(INTERACTIFS, /\.ce-qb-core\b/, 'la barre elle-même (ses portes) est exclue')
})
