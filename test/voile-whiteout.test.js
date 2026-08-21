// LE FONDU BLANC `.whiteout` — Tâche 2 ter du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ LA CLAUSE DE SORTIE S'APPLIQUE, ET IL FAUT LE DIRE EN TÊTE ══════
//
// L'Étape 1 de la tâche demande *« aucun appel à `_whiteout` ne subsiste sur le
// chemin du zoom continu »*. **Cette assertion ne peut plus échouer** : la
// Tâche 2 bis a emporté le seul appelant qui était sur ce chemin (`_rescale`,
// la porte de `_refine` et de `_coarsen`) le 2026-08-20. Le plan avait prévu ce
// cas : *« c'est une bonne nouvelle, pas un test cassé — écris-le, garde le test
// comme garde-fou contre le retour du rideau »*. C'est ce que fait ce fichier.
//
// ⚠️ **IL RECOUVRE VOLONTAIREMENT DEUX ASSERTIONS D'`escalier-surface.test.js`.**
// On élargit, on ne remplace pas : là-bas, l'absence de rideau est un effet de
// la continuité d'altitude ; ici, elle est le SUJET. Si quelqu'un réécrit
// l'escalier un jour, ce fichier-ci reste debout.
//
// ══════════ LES TROIS SURVIVANTS — POURQUOI ILS RESTENT, MESURÉ ═════════════
//
// **Étape 3 de la tâche : « trancher les TROIS appelants restants ».** Ils sont
// tranchés, et la réponse est : **ils restent, tous les trois, et voici les
// nombres qui l'imposent.** Relevés le 2026-08-21 sur l'application vivante
// (port 5503, `?globe=crans`, La Réunion), pas déduits de la lecture.
//
//   · **`enterOrbit`** — `globe.visible` bascule **false → true** dans la même
//     image où le terrain fait l'inverse ; `camera.far` passe de **290 à
//     1 400** ; et la caméra saute de **(88,49 · 72,72 · 88,49)** — au-dessus
//     d'une dalle posée à l'origine — à **(77,24 · −36,33 · 52,56)**, un point
//     d'une SPHÈRE de rayon `R_GLOBE`. **Elle traverse le plan y = 0** : elle
//     était 72,7 unités au-dessus du sol, elle atterrit 36,3 unités sous
//     l'origine. C'est le changement de repère, en chiffres.
//   · **`_dive`** — le même échange, dans l'autre sens. `src/modes.js` le dit
//     lui-même à l'endroit exact : *« Le repère de POSITION, lui, change bel et
//     bien ; c'est l'Étape 2, la frontière globe/terrain, et elle n'est pas
//     faite. »* ⚠️ **La Tâche 1b bis N'EST PAS LIVRÉE** — le §10 du plan la
//     range encore dans les tâches à venir. `globe.setVisible(false)` et
//     `setSurfaceVisible(true)` sont intacts, l'un s'éteint quand l'autre
//     s'allume.
//   · **`_loadDive`** (le clic-plongée) — celui-ci ne change PAS de monde, et
//     c'est le seul qui aurait pu partir. Il téléporte encore au point de
//     présentation, comme `_rescale` avant la Tâche 2 bis. **Mesuré, z12 → z13 :
//     l'altitude passe de 3 622 m à 6 680 m — ×1,844, LA CAMÉRA MONTE PENDANT
//     QUE L'UTILISATEUR CLIQUE POUR DESCENDRE** ; l'altitude de cadrage fait
//     ×1,984 et la distance ×5,34 (26,7 → 142,8 unités, le point de
//     présentation fixe). ⚠️ **Et c'est un LOWER BOUND** : la mesure a appelé
//     `_loadDive` seul, sans le premier temps de `diveTo` (l'approche de 30 %),
//     qui abaisse encore l'altitude de départ.
//
// ⚠️ **POURQUOI ON NE CORRIGE PAS `_loadDive` COMME `_rescale` :** sa pose
// d'arrivée n'est pas un accident, c'est une demande d'Adrien citée dans le
// code — *« dézoomé quasiment au max de ce niveau, même axe de vue »*. La
// changer serait renverser en passant une décision d'utilisateur écrite. **Ça
// se tranche avec Adrien, pas dans cette tâche.**
//
// **Conclusion, et c'est la règle fondatrice du plan appliquée à elle-même :**
// *« ôter un rideau avant que l'attente ait disparu ne supprime pas le pop-up,
// il montre le trou qu'il cachait »*. Ici ce n'est pas une attente, c'est un
// SAUT — mais la phrase vaut mot pour mot. Le rideau du chemin de zoom est
// parti parce que son saut était parti d'abord ; les trois autres partiront
// avec la Tâche 1b bis (la frontière de rendu) et avec ce qu'Adrien tranchera
// sur le clic-plongée.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// fins de ligne normalisées : l'arbre est en CRLF sous Windows (`autocrlf`),
// et le découpage de méthode ci-dessous en dépend
const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
const SRC_MODES = lis('src/modes.js')
const SRC_CSS = lis('src/style.css')

// ⚠️ **UNE ABSENCE SE PROUVE SUR LE CODE, JAMAIS SUR LE FICHIER.** Ce dépôt
// commente ce qu'il retire, en citant le code retiré : une assertion qui lit la
// prose est satisfaite par la prose. La leçon vient de `voile-loading.test.js`,
// où elle a coûté six assertions fausses d'un coup.
const sansCommentaires = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')

// le corps d'une méthode de classe : jusqu'à l'accolade fermante à deux espaces
function corpsDe(src, entete) {
  const i = src.indexOf(entete)
  assert.ok(i > 0, `méthode introuvable : ${entete}`)
  const j = src.indexOf('\n  }\n', i)
  assert.ok(j > i, `fin de méthode introuvable : ${entete}`)
  return sansCommentaires(src.slice(i, j))
}

const CODE_MODES = sansCommentaires(SRC_MODES)
const CODE_CSS = sansCommentaires(SRC_CSS)

const ZOOM_CONTINU = [
  'async _rescale(next, verb) {',
  'async _refine() {',
  'async _coarsen() {',
]
const TRANSITIONS_DE_MODE = [
  'async enterOrbit(entryAltM = null) {',
  'async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {',
  'async _loadDive(target) {',
]

// ══════════ ① LE CHEMIN DU ZOOM CONTINU N'A PLUS DE RIDEAU ══════════════════

test('aucun appel à _whiteout ne subsiste sur le chemin du zoom continu', () => {
  // ⚠️ C'EST L'ASSERTION DE L'ÉTAPE 1, ET ELLE EST VERTE DEPUIS LA TÂCHE 2 bis.
  // Elle ne prouve donc rien de neuf : elle EMPÊCHE. C'est un cliquet, et c'est
  // exactement ce que la clause de sortie du plan demande d'en faire.
  for (const entete of ZOOM_CONTINU) {
    assert.equal(
      corpsDe(SRC_MODES, entete).includes('_whiteout'),
      false,
      `${entete} a repris un rideau blanc — le cran redevient un saut masqué`
    )
  }
})

test('le rideau du zoom ne revient pas non plus par une porte détournée', () => {
  // `_refine` et `_coarsen` ne sont que des portes : elles passent par
  // `_rescale`. Si un jour l'une d'elles chargeait elle-même, le test
  // ci-dessus tomberait juste — celui-ci garde la structure qui le rend vrai.
  for (const entete of ['async _refine() {', 'async _coarsen() {']) {
    assert.match(corpsDe(SRC_MODES, entete), /this\._rescale\(next, '/, `${entete} ne passe plus par _rescale`)
  }
})

// ══════════ ② LES TROIS SURVIVANTS, NOMMÉS ET COMPTÉS ══════════════════════

test('il reste EXACTEMENT trois appelants, et ce sont les trois transitions de mode', () => {
  // ⚠️ ON ÉLARGIT UNE LISTE, ON NE LA REMPLACE PAS. Le compte est ici pour
  // qu'un QUATRIÈME appelant ne puisse pas naître en silence — c'est comme ça
  // que `_rescale` avait acquis le sien.
  assert.equal((CODE_MODES.match(/this\._whiteout\(/g) ?? []).length, 3, 'le compte des rideaux a bougé')
  for (const entete of TRANSITIONS_DE_MODE) {
    assert.ok(
      corpsDe(SRC_MODES, entete).includes('this._whiteout('),
      `${entete} a perdu son rideau — vérifiez d'abord que ce qu'il masquait est parti (voir l'en-tête)`
    )
  }
})

test('ce que les deux premiers masquent est TOUJOURS LÀ — la frontière de rendu n’est pas faite', () => {
  // ⚠️ **C'EST LA CONDITION DE SORTIE DE CETTE TÂCHE, ÉCRITE COMME ASSERTION.**
  // Tant que ces quatre lignes existent, retirer les rideaux d'`enterOrbit` et
  // de `_dive` rend l'échange de monde visible en une image. Le jour où la
  // Tâche 1b bis les fera disparaître, CE test tombera — et ce sera le signal
  // que les deux rideaux peuvent partir, pas une régression.
  const orbite = corpsDe(SRC_MODES, 'async enterOrbit(entryAltM = null) {')
  const plongee = corpsDe(SRC_MODES, 'async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {')
  assert.match(orbite, /this\.globe\.setVisible\(true\)/)
  assert.match(orbite, /this\.hooks\.setSurfaceVisible\(false\)/)
  assert.match(plongee, /this\.globe\.setVisible\(false\)/)
  assert.match(plongee, /this\.hooks\.setSurfaceVisible\(true\)/)
})

test('ce que le troisième masque est TOUJOURS LÀ — le clic-plongée téléporte encore', () => {
  // Mesuré z12 → z13 : 3 622 m → 6 680 m, ×1,844 — la caméra MONTE pendant que
  // l'utilisateur clique pour descendre. La cause est cette ligne : une
  // distance FIXE, sans rapport avec l'altitude quittée. C'est la téléportation
  // que la Tâche 2 bis a retirée de `_rescale` et qu'elle n'a pas touchée ici.
  const clic = corpsDe(SRC_MODES, 'async _loadDive(target) {')
  assert.match(clic, /distancePresentation\(this\.hooks\.surfaceMaxDistance\(\)\)/)
  // et il n'appelle PAS la loi continue — s'il l'appelait un jour, son rideau
  // pourrait partir, et ce test dirait de le vérifier
  assert.equal(clic.includes('poseCranContinu'), false)
})

// ══════════ ③ LE RIDEAU LUI-MÊME, ET SON PRIX ══════════════════════════════

test('le rideau coûte toujours 480 + 480 ms, et le chiffre du plan reste vrai', () => {
  // Le plan facture `.whiteout` à **960 ms** (480 opaque + 480 de retour), et
  // c'est sur ce chiffre que sa suppression est arbitrée. Si quelqu'un le
  // change, l'arbitrage change avec — donc il ne se change pas en silence.
  const rideau = corpsDe(SRC_MODES, '_whiteout(swap) {')
  assert.match(rideau, /this\.whiteEl\.classList\.add\('on'\)/)
  assert.equal((rideau.match(/480/g) ?? []).length, 2, 'les deux temps de 480 ms')
  // ⚠️ ET IL EST FABRIQUÉ PAR `Modes` LUI-MÊME, hors du constructeur : c'est
  // pour ça qu'aucun `grep` de `main.js` ne pouvait le voir, et le plan s'y est
  // trompé une fois. Le repère reste écrit ici.
  assert.match(CODE_MODES, /white\.className = 'whiteout'/)
  assert.match(CODE_CSS, /\.whiteout \{/)
  assert.match(CODE_CSS, /transition: opacity 0\.46s ease;/)
})
