import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTION, boutonsSouris, versTroisJs } from '../src/boutons-camera.js'

// Le sous-ensemble de THREE.MOUSE dont le module a besoin. Le passer permet de
// tester la traduction en node sans charger three.js.
const MOUSE = { ROTATE: 0, DOLLY: 1, PAN: 2 }

// ══════════ CE QUE CE FICHIER EMPÊCHE DE REVENIR ════════════════════════════
//
// Adrien, mot pour mot, après avoir essayé le mode continu : « l'ancien
// déplacement par clic droit n'existe plus, je ne peux plus me déplacer de
// cette façon. »
//
// Le mode continu prenait le clic droit pour glisser le terrain, et le
// déplacement de caméra n'avait AUCUNE autre liaison : il disparaissait avec
// lui. Les deux premiers tests ci-dessous sont la promesse inverse, et ils
// balayent toutes les configurations plutôt qu'un cas choisi.

test('INVARIANT — le déplacement de caméra reste joignable SANS le clic droit, toujours', () => {
  for (const continu of [false, true]) {
    const b = boutonsSouris({ continu, surface: true })
    assert.equal(b.milieu, ACTION.DEPLACEMENT, `continu=${continu} : le bouton du milieu doit déplacer`)
    assert.equal(b.majGauche, ACTION.DEPLACEMENT, `continu=${continu} : Maj+gauche doit déplacer`)
  }
})

test('INVARIANT — deux liaisons, parce qu’un portable n’a pas de bouton du milieu', () => {
  // Le bouton du milieu ne vaut que pour une souris à molette : sur un pavé
  // tactile il n'existe pas, ou il faut aller le chercher dans les réglages du
  // système. Une fonction offerte à la moitié des machines n'est pas offerte.
  // Maj+gauche est le repli, et il marche partout — OrbitControls le sert déjà
  // nativement (le cas MOUSE.ROTATE bascule en PAN quand un modificateur est
  // tenu), il n'était simplement plus atteignable.
  const b = boutonsSouris({ continu: true, surface: true })
  assert.notEqual(b.milieu, b.droit, 'le repli doit être un autre bouton que celui qui glisse')
  assert.equal(b.majGauche, ACTION.DEPLACEMENT)
})

test('le bouton du milieu ne sert JAMAIS au zoom — il est mort dans cette application', () => {
  // `controls.enableZoom = false` dans tous les modes (main.js:996, modes.js:303
  // et 381) : le DOLLY par défaut d'OrbitControls sur le bouton du milieu ne
  // fait rien du tout. On ne vole donc aucun geste en le prenant, on remplit
  // une place vide. Ce test verrouille le raisonnement.
  for (const continu of [false, true]) {
    for (const surface of [false, true]) {
      assert.notEqual(boutonsSouris({ continu, surface }).milieu, 'zoom')
    }
  }
})

test('le clic droit : déplacement en mode ordinaire, glisse du terrain en mode continu', () => {
  assert.equal(boutonsSouris({ continu: false, surface: true }).droit, ACTION.DEPLACEMENT)
  assert.equal(boutonsSouris({ continu: true, surface: true }).droit, ACTION.GLISSE)
})

test('le mode ordinaire ne perd rien : gauche et droit gardent leur sens', () => {
  const b = boutonsSouris({ continu: false, surface: true })
  assert.equal(b.gauche, ACTION.ROTATION)
  assert.equal(b.droit, ACTION.DEPLACEMENT)
})

test('hors surface (globe, orbital) : aucune glisse de terrain, jamais', () => {
  // Il n'y a pas de fenêtre continue autour d'un globe. Même si la préférence
  // est allumée, le clic droit doit rendre le déplacement — sinon entrer en
  // mode globe avec le continu actif laisserait un clic droit mort.
  for (const continu of [false, true]) {
    const b = boutonsSouris({ continu, surface: false })
    assert.notEqual(b.droit, ACTION.GLISSE, `continu=${continu} : pas de glisse hors surface`)
  }
})

// ---------------------------------------------------- la traduction three.js

test('versTroisJs : la glisse laisse le bouton INERTE côté OrbitControls', () => {
  // C'est le point technique de toute la bascule. L'ancien code éteignait
  // `enablePan` À CHAQUE IMAGE pour empêcher OrbitControls de voler le clic
  // droit — mais `enablePan` gouverne AUSSI le bouton du milieu et Maj+gauche,
  // qu'il tuait donc au passage. C'était ça, la perte d'Adrien.
  // En laissant `enablePan` allumé et en rendant le seul bouton DROIT inerte,
  // les deux autres chemins survivent.
  const m = versTroisJs(boutonsSouris({ continu: true, surface: true }), MOUSE)
  assert.equal(m.RIGHT, -1, 'le clic droit doit être inerte, pas « pan désactivé »')
  assert.equal(m.MIDDLE, MOUSE.PAN)
  assert.equal(m.LEFT, MOUSE.ROTATE)
})

test('versTroisJs : en mode ordinaire, le clic droit redevient un pan natif', () => {
  const m = versTroisJs(boutonsSouris({ continu: false, surface: true }), MOUSE)
  assert.deepEqual(m, { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN })
})

test('versTroisJs : le bouton du milieu n’est JAMAIS rendu en DOLLY', () => {
  for (const continu of [false, true]) {
    for (const surface of [false, true]) {
      const m = versTroisJs(boutonsSouris({ continu, surface }), MOUSE)
      assert.notEqual(m.MIDDLE, MOUSE.DOLLY)
    }
  }
})

test('versTroisJs : Maj+gauche n’a rien à traduire — OrbitControls le sert déjà', () => {
  // Vérifié dans la source vendue (OrbitControls.js:1271-1280) : sur
  // `case MOUSE.ROTATE`, un ctrl/meta/shift tenu bascule en PAN. Laisser LEFT
  // à ROTATE suffit donc à obtenir Maj+gauche = déplacement. Toute
  // réimplémentation ici doublerait un comportement déjà juste.
  const m = versTroisJs(boutonsSouris({ continu: true, surface: true }), MOUSE)
  assert.equal(m.LEFT, MOUSE.ROTATE, 'LEFT reste ROTATE : c’est ce qui donne Maj+gauche = pan')
  assert.equal(Object.keys(m).length, 3, 'rien de plus que les trois boutons')
})
