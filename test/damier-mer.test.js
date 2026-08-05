// LA MER DU DAMIER — une seule mer, une seule jupe, pour tout le carré.
//
// Deux familles de tests ici, et elles ne prouvent pas la même chose :
//   · les PURES portent sur `centreDuCarre` / `empriseDeMer` (damier-carre.js),
//     importables en node ;
//   · les VERROUS DE SOURCE relisent `src/ocean.js` en texte, parce qu'il tire
//     three.js et qu'aucun test node ne peut l'importer. C'est la convention
//     déjà employée par test/mer-emprise.test.js pour FIELD_RES.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resChamp, spanChamp, CHAMP_RES } from '../src/mer-emprise.js'
import { centreDuCarre, empriseDeMer } from '../src/damier-carre.js'

const TAILLE = 56

const OCEAN = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

test('un carre 3x3 centre sur l\'origine reste centre', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 3 }, TAILLE), { x: 0, z: 0 })
})

// ⚠️ LE PIÈGE DU CARRÉ PAIR. Un 2x2 n'est PAS centré sur le bloc principal :
// son centre tombe sur la jointure. Une mer posée en (0,0) déborderait d'un
// demi-bloc d'un côté et manquerait de l'autre.
test('un carre 2x2 a son centre sur la jointure, pas sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 2 }, TAILLE), { x: -28, z: -28 })
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 2 }, TAILLE), { x: 28, z: 28 })
})

test('un carre 1x1 est centre sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 1 }, TAILLE), { x: 0, z: 0 })
})

// L'EMPRISE — on réutilise la machinerie éprouvée de la fenêtre continue
// (mer-emprise.js) plutôt que d'en inventer une seconde.
test('l\'emprise de mer suit le cote du carre', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE)
  assert.equal(e.span, spanChamp(TAILLE, 3), '168 unites de large')
  assert.equal(e.res, resChamp(3), 'champ multiplie, pas etire')
  assert.equal(e.res, CHAMP_RES * 3)
})

test('un damier 1x1 rend exactement l\'emprise d\'avant', () => {
  const e = empriseDeMer({ i0: 0, j0: 0, cote: 1 }, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES, 'aucune regression sur le bloc seul')
  assert.deepEqual(e.centre, { x: 0, z: 0 })
})

test('un carre null rend l\'emprise d\'un bloc', () => {
  const e = empriseDeMer(null, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES)
})

// LE COÛT, ET SA BORNE. Le champ est multiplicatif (resChamp), donc un 3x3
// coûte NEUF fois un bloc. C'est le chiffre déjà payé par la fenêtre continue
// (1152², 5,3 Mo) — mais il doit rester dit, pas découvert en production.
test('le champ d\'un 3x3 reste sous 6 Mo en demi-flottants', () => {
  const res = resChamp(3)
  const octets = res * res * 2 * 2 // deux canaux, demi-flottants
  assert.ok(octets < 6 * 1024 * 1024, `${(octets / 1048576).toFixed(1)} Mo, trop`)
})

// ── AJOUTS À CE QUE DEMANDAIT LE BRIEF ──────────────────────────────────────
// Le carré PAIR devait aussi voir son emprise vérifiée, pas seulement son
// centre : c'est la combinaison des deux qui pose la mer au bon endroit.
test('un carre 2x2 : emprise ET centre ensemble', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 2 }, TAILLE)
  assert.equal(e.cote, 2)
  assert.equal(e.span, 112)
  assert.equal(e.res, CHAMP_RES * 2)
  assert.deepEqual(e.centre, { x: -28, z: -28 })
})

test('un cote absent, nul ou fractionnaire retombe sur un bloc entier', () => {
  for (const carre of [{}, { cote: 0 }, { cote: -3 }, { cote: 1.4 }]) {
    const e = empriseDeMer(carre, TAILLE)
    assert.equal(e.cote, 1, `cote ${carre.cote}`)
    assert.equal(e.span, TAILLE)
  }
  // 1,6 s'arrondit à 2 (Math.round), pas à 1 : la règle est l'arrondi, pas la
  // troncature — un carré ne vaut jamais 1,6 en pratique, mais le dire évite
  // qu'un futur appelant se fie à la mauvaise moitié du comportement.
  assert.equal(empriseDeMer({ cote: 1.6 }, TAILLE).cote, 2)
})

// ── VERROUS DE SOURCE SUR ocean.js ──────────────────────────────────────────

test('rebuild accepte un carre, et null redonne le comportement d\'avant', () => {
  assert.match(OCEAN, /rebuild\(\{[^}]*carre = null/, 'la signature de rebuild ne prend pas `carre`')
})

// ⚠️ LE PIÈGE QUE CE VERROU EXISTE POUR ATTRAPER : une mer de la bonne TAILLE
// avec des vagues à la mauvaise ÉCHELLE. Le champ doit être cuit à
// `emprise.res` et lu sur `emprise.span` — jamais sur CHAMP_RES/FIELD_RES ni
// TERRAIN_SIZE en dur.
test('le champ est cuit sur l\'emprise, pas sur des constantes en dur', () => {
  const bake = OCEAN.slice(OCEAN.indexOf('_bakeField('), OCEAN.indexOf('_bakeLakeMask('))
  assert.ok(bake.length > 200, '_bakeField introuvable')
  assert.match(bake, /const n = emprise\.res/, 'la resolution du champ ne vient pas de l\'emprise')
  assert.match(bake, /const span = emprise\.span/, 'la largeur du champ ne vient pas de l\'emprise')
  assert.doesNotMatch(bake, /resChamp\(|FIELD_RES/, '_bakeField recalcule sa resolution au lieu de la lire')
})

// La segmentation est PROVISOIRE (Tâche 7 la mesurera). On verrouille sa forme
// pour qu'elle ne redevienne pas linéaire par inadvertance : à 4,57 segments
// par unité, un 3x3 rendrait 768² = 590 000 quadrilatères.
test('la segmentation du plan d\'eau est plafonnee, pas lineaire', () => {
  assert.match(OCEAN, /Math\.min\(384, 256 \* emprise\.cote\)/, 'plafond de segmentation absent')
  const seg = (cote) => Math.min(384, 256 * cote)
  assert.equal(seg(1), 256, 'un bloc seul garde EXACTEMENT sa segmentation d\'avant')
  assert.equal(seg(2), 384)
  assert.equal(seg(3), 384)
  assert.ok(seg(3) ** 2 < 200_000, 'plus de 200 000 quadrilatères pour des vagues de quelques unités')
})

// ⚠️ LE CENTRE VA DANS LA GÉOMÉTRIE, PAS DANS `mesh.position` — divergence
// assumée avec le brief, qui écrivait `mesh.position.set(centre.x, seaBase,
// centre.z)`. Les quatre shaders lisent `position.xz` COMME DES COORDONNÉES
// MONDE (`vWorld = vec3(p.x, …, p.z)`, ocean.js) : une translation portée par
// la matrice du mesh aurait déplacé le RENDU sans déplacer ce que le shader
// croit regarder — champ, masque et clip lus un demi-bloc à côté. Seule la
// HAUTEUR passe par la matrice, parce que le shader la reprend par `uWaterY`.
test('le plan d\'eau et la jupe sont posés au centre du carre, pas à l\'origine', () => {
  assert.match(OCEAN, /geo\.translate\(emprise\.centre\.x, 0, emprise\.centre\.z\)/)
  assert.match(OCEAN, /sgeo\.translate\(emprise\.centre\.x, 0, emprise\.centre\.z\)/)
  assert.match(OCEAN, /mesh\.position\.set\(0, this\._seaBase, 0\)/, 'la hauteur seule passe par la matrice')
  // … et le clip du fragment aussi : sans lui, un 2x2 serait rogné autour de
  // l'origine pendant que sa géométrie, elle, serait bien décalée.
  assert.match(OCEAN, /uniform vec2 uCentre;/)
  assert.match(OCEAN, /abs\(xzVue - uCentre\)/)
  // … et la lecture du champ, cuit AUTOUR de ce centre (voir _bakeField)
  assert.match(OCEAN, /\(xzChamp - uCentre\) \/ uSpan \+ 0\.5/)
})

// ⚠️ AJOUT AU BRIEF, ET IL EST STRUCTUREL. `terrain.sample` ne connaît que le
// MNT du bloc CENTRAL et `sampleDem` clampe hors de ses bornes : cuit avec lui
// sur 168 unités, le champ recopie la rangée de bord du bloc central sur toute
// la bande voisine. Là où ce bord est de la terre, le fragment discarde — donc
// PAS DE MER sur les huit cases, c'est-à-dire l'inverse du but de la tâche.
test('le champ du damier est cuit avec un echantillonneur qui connait les voisines', () => {
  assert.match(OCEAN, /echantillonSol = null/, 'rebuild n\'accepte pas d\'echantillonneur de damier')
  assert.match(OCEAN, /const ech = this\._echSol \|\| echChamp/, 'l\'echantillonneur du damier ne prime pas')
  assert.match(MAIN, /blockGrid\.heightAt\(/, 'main.js ne branche pas les cellules voisines sur la mer')
})

// L'AUTRE EMPREINTE. Le masque côtier suit le MNT (56 unités, ou 168 sur
// l'emprise RECOLLÉE du mode continu) — jamais le carré du damier. Lu sur le
// span du champ, il serait agrandi d'autant, et le bloc central lui-même
// verrait sa côte remplacée par le tiers central de la sienne.
test('le masque cotier se lit sur son empreinte, pas sur celle du champ', () => {
  assert.match(OCEAN, /uniform float uSpanMasque;/)
  assert.match(OCEAN, /vec2 uvMasqueCotier\(vec2 xzChamp\)/)
  // le premier `return` garde la fenêtre continue au bit près : quand les deux
  // empreintes coïncident, l'uv sort tel quel et la texture clampe au bord.
  assert.match(OCEAN, /if \(uSpanMasque >= uSpan\) return uv;/)
  assert.match(OCEAN, /const spanMasque = this\._spanMasque \?\? span/, 'la cuisson CPU lit encore le span du champ')
  // et plus aucun shader ne lit le masque avec l'uv du champ
  assert.doesNotMatch(OCEAN, /texture2D\(uCoastMask, uvF\)/)
})

// ⚠️ TROIS CHOSES SUIVENT LE MNT ET NON LE CARRÉ : l'échelle du relief, la
// bathymétrie et les lacs. `extentMeters` ne grandit PAS avec le damier —
// servir le span du champ y triplerait la houle, la profondeur du fond, et
// étirerait chaque lac du bloc central au format du damier.
test('l\'echelle du relief suit le MNT, pas le carre du damier', () => {
  assert.match(OCEAN, /const demScale = \(this\._spanDem \/ terrain\.dem\.extentMeters\)/)
  assert.match(OCEAN, /const scale = \(this\._spanDem \/ dem\.extentMeters\)/, 'les lacs suivent le carre au lieu du MNT')
  assert.match(OCEAN, /\(g \/ \(n - 1\) - 0\.5\) \* this\._spanDem/, 'la grille des lacs suit le carre au lieu du MNT')
})

// La jupe descend au plancher COMMUN du damier (Tâche 3), jamais au seul
// budget bathymétrique du bloc central — sinon le rideau d'eau s'arrête
// au-dessus du fond des autres cases et laisse voir le vide sous lui.
test('la jupe descend au plancher commun du damier', () => {
  assert.match(OCEAN, /planchier = null/, 'rebuild n\'accepte pas le plancher commun')
  assert.match(OCEAN, /Math\.min\(this\._seaBase - drop, planchier\)/, 'la jupe pourrait REMONTER')
  // … et SEULEMENT quand le damier existe : sur un bloc seul, imposer le
  // `baseY` du socle allongerait la jupe du bloc principal sans raison — une
  // régression visible, apportée par une fonctionnalité qui ne le concerne pas.
  assert.match(MAIN, /planchier: carre\.cote > 1 \? blockGrid\.planchierCommun\(\) : null/)
})

// ⚠️ DIVERGENCE ASSUMÉE AVEC LE BRIEF, qui écrivait `rayonEauDansSocle() *
// emprise.cote`. `rayonEauDansSocle()` vaut `28 − chanfrein − marge` : le
// multiplier par le côté multiplie AUSSI le retrait de 0,22 unité. Sur un 3×3
// l'eau se serait arrêtée à 83,34 au lieu de 83,78, soit 0,44 unité de socle nu
// tout autour — dans un module dont plinth.js dit qu'il tient ces nombres à six
// MILLIÈMES près. Le retrait est celui du bord EXTÉRIEUR : il n'y en a qu'un.
test('la jupe entoure le carre entier, sans multiplier la marge du socle', () => {
  assert.match(OCEAN, /const demiEau = rayonEauDansSocle\(\) \+ \(TERRAIN_SIZE \/ 2\) \* \(emprise\.cote - 1\)/)
  assert.match(OCEAN, /buildRimGeometry\(demiEau, r,/, 'la jupe ne suit pas le demi-cote du carre')
  assert.match(OCEAN, /mat\.uniforms\.uHalf\.value = demiEau/, 'la surface et la jupe divergent')
  // la règle, en clair : cote 1 rend exactement la valeur d'avant
  const HALF = 28
  const demiEau = (retrait, cote) => HALF - retrait + HALF * (cote - 1)
  assert.equal(demiEau(0.22, 1), 27.78, 'aucune regression sur le bloc seul')
  assert.equal(demiEau(0.22, 3), 83.78, 'un seul retrait, celui du bord exterieur')
  assert.notEqual(demiEau(0.22, 3), (HALF - 0.22) * 3, 'la formule du brief triple le retrait')
})

// ── VERROUS DE SOURCE SUR main.js ───────────────────────────────────────────

test('main.js lit empriseVivante, jamais carreCourant, pour la mer', () => {
  const mer = MAIN.slice(MAIN.indexOf('function carreDeMer'), MAIN.indexOf('function carreDeMer') + 2000)
  assert.ok(mer.length > 200, 'carreDeMer introuvable dans main.js')
  assert.match(mer, /blockGrid\.empriseVivante\(\)/)
  assert.doesNotMatch(mer, /carreCourant\(\)/, 'carreCourant plafonne à 3x3 : mer trop petite en zone isolée')
})

// ⚠️ LE DAMIER SE RESYNCHRONISE À CHAQUE DALLE REÇUE. Recuire un champ 1152²
// huit fois de suite gèlerait la page — 8 × (1,33 million d'échantillons + une
// distance de chanfrere en deux passes). On ne rebâtit que si le côté OU le
// centre ont changé.
test('la mer ne se rebatit pas a chaque arrivee de cellule', () => {
  assert.match(MAIN, /function merSuitLeDamier\(\)/, 'le garde-fou anti-recuisson est absent')
  const garde = MAIN.slice(MAIN.indexOf('function merSuitLeDamier'), MAIN.indexOf('function merSuitLeDamier') + 1200)
  assert.match(garde, /_merCarrePose/, 'aucune memoire de la derniere emprise posee')
  assert.match(garde, /return/, 'aucune sortie anticipee : la mer se rebatirait a chaque arrivee')
})
