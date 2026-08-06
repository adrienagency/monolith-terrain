// LE PLANCHER DE L'INTERFACE — un message passager se pose AU-DESSUS de ce qui
// est affiché en bas, et cette hauteur se calcule.
//
// Adrien, 2026-08-06 : « Les infos type "lien copié" doivent apparaître tout le
// temps au-dessus de l'UI affichée, ici la barre de menu — je ne parle pas de
// z-index, mais de l'axe Y. S'il y a autre chose au-dessus de la barre de menu,
// ça apparaîtra encore plus haut (ex : profil de course). »
//
// La partie mesurable de cette décision est pure : des rectangles entrent, une
// valeur de `bottom` sort. Le reste (lire le DOM, écrire la variable CSS) n'a
// rien à décider.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hauteurPlancher, SELECTEURS_PLANCHER, MARGE_NUE, ECART } from '../src/plancher-ui.js'

const lire = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')

const rect = (top, hauteur, largeur = 400) => ({ top, height: hauteur, width: largeur, bottom: top + hauteur })

test('rien en bas : le message garde sa place d’origine', () => {
  assert.equal(hauteurPlancher({ rects: [], hauteurFenetre: 900 }), MARGE_NUE)
})

test('la barre de menu seule : le message se pose juste au-dessus d’elle', () => {
  // barre de 96 px collée en bas d'une fenêtre de 900 → son haut est à 804
  const px = hauteurPlancher({ rects: [rect(804, 96)], hauteurFenetre: 900 })
  assert.equal(px, 900 - 804 + ECART)
  assert.ok(px > MARGE_NUE, 'sinon le message repasse derrière la barre')
})

test('⚠️ BARRE + PROFIL DE COURSE : LE MESSAGE MONTE ENCORE', () => {
  // C'est le cas nommé par Adrien. Le profil se pose lui-même au-dessus de la
  // barre ; le message doit se poser au-dessus du plus haut des deux, pas au
  // -dessus du dernier de la liste.
  const barre = rect(804, 96)
  const profil = rect(690, 100)
  const px = hauteurPlancher({ rects: [profil, barre], hauteurFenetre: 900 })
  assert.equal(px, 900 - 690 + ECART)
  // et l'ordre dans lequel on les mesure ne change rien
  assert.equal(hauteurPlancher({ rects: [barre, profil], hauteurFenetre: 900 }), px)
})

test('un élément masqué ne lève pas le plancher', () => {
  // Une barre cachée (boutique, viewer nu, mode sans interface) rend un
  // rectangle tout à zéro : le prendre pour argument poserait le message en
  // haut de l'écran.
  const cache = { top: 0, height: 0, width: 0, bottom: 0 }
  assert.equal(hauteurPlancher({ rects: [cache], hauteurFenetre: 900 }), MARGE_NUE)
  assert.equal(
    hauteurPlancher({ rects: [cache, rect(804, 96)], hauteurFenetre: 900 }),
    900 - 804 + ECART,
  )
})

test('⚠️ JAMAIS SOUS LA MARGE NUE — un message hors écran ne sert plus à rien', () => {
  // Une barre en cours de fermeture peut être entièrement sortie par le bas :
  // son haut est alors sous la fenêtre, et la soustraction rendrait un négatif.
  assert.equal(hauteurPlancher({ rects: [rect(940, 96)], hauteurFenetre: 900 }), MARGE_NUE)
  // et une barre qui affleure le bord bas ne descend pas le message non plus
  assert.equal(hauteurPlancher({ rects: [rect(895, 96)], hauteurFenetre: 900 }), MARGE_NUE)
})

test('⚠️ UNE SEULE SOURCE POUR CETTE HAUTEUR : ON MESURE, ON NE RECOPIE PAS', () => {
  // La barre change de taille au point de rupture tactile, le profil change de
  // hauteur quand on le replie, et sa position est DÉJÀ calculée à partir de la
  // barre (`syncGpxProfilePosition` dans main.js). Une hauteur écrite en dur
  // ici serait une seconde source, qui divergerait au premier réglage.
  const SRC = lire('src/plancher-ui.js')
  assert.match(SRC, /getBoundingClientRect\(\)/)
  assert.equal(/hauteurBarre\s*=\s*\d/.test(SRC), false)
  // les sélecteurs sont le contrat : ce qui est amarré en bas, et rien d'autre
  assert.deepEqual([...SELECTEURS_PLANCHER], ['.gpx-profile:not(.hidden)', '.ce-elemwrap', '.ce-bottombar'])
})

test('le CSS lit la mesure, et garde son ancienne valeur en repli', () => {
  // Une page qui n'a encore affiché aucun message n'a pas de variable publiée :
  // sans repli, `bottom` serait invalide et le toast retomberait en haut.
  const CSS = lire('src/style.css')
  assert.match(CSS, /\.ce-toast \{[^}]*bottom: var\(--ce-plancher-ui, 32px\);/s)
  assert.match(CSS, /\.ce-livraison \{[^}]*bottom: var\(--ce-plancher-ui, 34px\);/s)
  // et la mesure est prise à l'instant d'afficher, pas gardée en mémoire
  const TOAST = lire('src/ui/toast.js')
  assert.match(TOAST, /import \{ mesurerPlancher \} from '\.\.\/plancher-ui\.js'/)
  assert.equal(TOAST.split('mesurerPlancher()').length - 1, 2, 'le toast ET la carte de livraison')
})
