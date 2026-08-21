// L'EXAGÉRATION UNIQUE — Tâche E du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE ═══════════════════════════════════════
//
// Le globe passait son relief à l'exagération **18** (`globe.js`,
// `params.globeExaggeration ?? 18`) pendant que le socle le passait à **2,8**
// (`BASE_EXAG`) — le facteur **6,4** du §3 du plan. La Tâche B a regardé l'écran
// et l'a chiffré : **l'objet est DEBOUT**, près de cinq fois plus haut que large.
// Cette tâche branche le globe sur le partage (`monde/exageration-continue.js`),
// dont il devient le **quatorzième lecteur**.
//
//   ① LE PILOTE — `zc = demZoom + f`, et il est BORNÉ PAR CONSTRUCTION.
//   ② IL NE REFERME AUCUNE BOUCLE — et c'est mesuré des deux côtés : le nouveau
//      pilote rejoue la table d'Adrien sur toute la descente, l'ancien s'en
//      écarte puis GÈLE à 2,8.
//   ③ LE GLOBE EST LE QUATORZIÈME LECTEUR — et il ne bouge PAS sans drapeau.
//   ④ LA MESURE DE CONTRÔLE — le rapport hauteur/largeur du bloc. **Un bloc doit
//      redevenir un bloc.**
//   ⑤ LES MUTATIONS — remettre 18 tue ④b ; retirer une surcharge tue ③c.
//
// ══════════ POURQUOI LE PILOTE EST `_levelZoom`, ET PAS LA DISTANCE ═════════
//
// ⚠️ **DEUX PILOTES ONT DÉJÀ ÉCHOUÉ, ET LE TROISIÈME A ÉTÉ REJOUÉ AVANT D'ÊTRE
// ÉCRIT.** Piloté par l'altitude de cadrage il DIVERGE (gain 1,44, test ③ de
// `fenetre-branchee.test.js`) ; piloté par la largeur de sol visible
// (`zoomCadrage`) il GÈLE à 2,8 — mesuré à l'écran, et **rejoué ici** par le
// test ②b, qui referme la boucle à la main.
//
// ⚠️ **LA CAUSE EST STRUCTURELLE, ET ELLE N'ÉPARGNE AUCUNE GRANDEUR DE LA
// CAMÉRA** : au cran, `poseCranContinu` (`loi-altitude.js`) repose la caméra à
// `camY × facteurEchelle`, et `facteurEchelle` **contient le rapport des
// exagérations**. Toute quantité tirée de la pose d'après-cran — distance,
// hauteur de caméra, distance horizontale — porte donc l'exagération et referme
// la boucle. C'est cette mesure qui a écarté `f = log2(dRef / d)`, pourtant la
// forme la plus évidente, AVANT de l'implémenter.
//
// ⚠️ **`_levelZoom` (`modes.js:222`) EST LA SEULE GRANDEUR PROPRE**, et ce n'est
// pas un choix esthétique : `_rescale` l'écrase à zéro (`_resetZoom`) à CHAQUE
// cran, et `_applyZoom` ne lui ajoute que le RAPPORT de distance du glissé
// (`log(newDist / dist)`). Le repositionnement du cran n'y entre jamais. Elle est
// de plus DÉJÀ bornée à `[-STEP_IN, STEP_OUT] = [-ln2, +ln2]` par `_applyZoom` :
// `f = -_levelZoom / ln2` vit donc dans `[-1, +1]` **sans qu'on ait à poser de
// garde-fou**, et `zc = demZoom + f` dans `[z-1, z+1]`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  zoomCran,
  majExagerationCran,
  PAS_NIVEAU,
  courbeExageration,
  exagPalier,
  creerExagerationPartagee,
  poserExageration,
  surchargesStockees,
  zoomCadrage,
  EXAG_BASE,
} from '../src/monde/exageration-continue.js'
import { distanceArrivee, empriseBlocM, DISTANCE_MAX_SURFACE } from '../src/loi-altitude.js'
import { construireSolideCrop } from '../src/monde/parois-crop.js'
import { repereCrop, coinNormalise } from '../src/monde/crop-sphere.js'
import { exposantCoin } from '../src/fenetre-clip.js'
import { Globe } from '../src/globe.js'

const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const courbe = courbeExageration()

// ══════════ ① LE PILOTE — BORNÉ PAR CONSTRUCTION ════════════════════════════

test('① au repos (`_levelZoom = 0`) le pilote rend EXACTEMENT le cran', () => {
  for (let z = 3; z <= 15; z++) {
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: 0 }), z, `z=${z}`)
  }
})

test('①b SUR LA VOIE DU BUDGET, et sur elle seule, la butée rend le cran voisin', () => {
  // ⚠️ **CET INVARIANT AVAIT ÉTÉ ÉCRIT TROP LARGE — « continuité EXACTE au
  // cran » — ET LA MESURE L'A RÉDUIT.** Le cran ne se déclenche PAS qu'à la
  // butée du budget : le gestionnaire de molette de `modes.js` porte **trois**
  // voies, et deux tombent à un `_levelZoom` ARBITRAIRE —
  //
  //     atInLimit = _levelZoom <= -STEP_IN + 0.03
  //              || dist <= minDistance * 1.02
  //              || nearGround()
  //
  // Le saut y est réel : **jusqu'à 100 % au cran z4 → z5**, et c'est ①e qui le
  // mesure. ⚠️ **Ce test-ci est posé exactement là où les deux formes
  // coïncident** — le même piège que la Tâche A avait retourné en assertion
  // (superellipse contre octogone, écart NUL à 45°) — donc il ne prouve QUE
  // l'invariant restreint, et ①e existe pour couvrir le reste.
  //
  // L'invariant restreint : à la butée exacte `_levelZoom = ∓ln2`, `zc = z ± 1`
  // des deux côtés du cran, parce que `_resetZoom()` remet `_levelZoom` à zéro
  // pendant que `demZoom` avance de 1.
  for (let z = 3; z <= 14; z++) {
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: -PAS_NIVEAU }), z + 1, `butée IN z=${z}`)
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: +PAS_NIVEAU }), z - 1, `butée OUT z=${z}`)
  }
  assert.equal(PAS_NIVEAU, Math.LN2, '`STEP_IN` de `modes.js` vaut `Math.LN2`')
})

test('①c BORNÉ PAR CONSTRUCTION — même nourri d\'absurdités', () => {
  for (const l of [-100, -1e9, 100, 1e9, 1e-300]) {
    const zc = zoomCran({ demZoom: 9, zoomNiveau: l })
    assert.ok(zc >= 8 && zc <= 10, `_levelZoom=${l} → zc=${zc}, hors de [z-1, z+1]`)
  }
  // …et il ne rend jamais NaN sur une entrée illisible : il retombe sur le cran.
  for (const l of [NaN, undefined, null, 'x']) {
    assert.equal(zoomCran({ demZoom: 9, zoomNiveau: l }), 9, `_levelZoom=${l}`)
  }
  assert.ok(Number.isNaN(zoomCran({ demZoom: NaN, zoomNiveau: 0 })), 'sans cran, il n\'y a rien à rendre')
})

test('①d `_levelZoom` est bien remis à zéro à CHAQUE cran — sinon la borne ment', () => {
  // ⚠️ **LA BORNE `[z-1, z+1]` NE TIENT QUE PARCE QUE `_rescale` APPELLE
  // `_resetZoom()`.** Sans lui, `_levelZoom` accumulerait d'un niveau à l'autre
  // et le pilote sortirait de sa fenêtre au deuxième cran. C'est une propriété
  // de `modes.js`, pas de ce module : elle se garde donc contre la source.
  const src = sansCommentaires(lire('src/modes.js'))
  const debut = src.indexOf('async _rescale(')
  assert.ok(debut > 0, '`_rescale` a disparu de `modes.js`')
  const corps = src.slice(debut, src.indexOf('\n  }', debut))
  assert.ok(/this\._resetZoom\s*\(\s*\)/.test(corps),
    '`_rescale` ne remet plus `_levelZoom` à zéro — la borne du pilote tombe')
  // ⚠️ **CETTE ASSERTION-CI A ÉTÉ ÉCRITE FAUSSE, PUIS REJOUÉE.** Cherchée sur
  // TOUT `modes.js`, `/_levelZoom = 0/` tombait sur la ligne 222 — la
  // DÉCLARATION du champ dans le constructeur — et **vider entièrement
  // `_resetZoom()` la laissait verte**, alors que c'est exactement la propriété
  // dont dépend toute la borne. On la borne donc au CORPS de `_resetZoom`.
  const rz = src.indexOf('_resetZoom() {')
  assert.ok(rz > 0, '`_resetZoom` a disparu de `modes.js`')
  const corpsRz = src.slice(rz, src.indexOf('\n  }', rz))
  assert.ok(/this\._levelZoom\s*=\s*0/.test(corpsRz),
    '`_resetZoom` n\'écrase plus `_levelZoom` — la borne du pilote tombe en silence')
  // …et la butée du niveau est bien celle qu'on recopie.
  assert.ok(/export const STEP_IN = Math\.LN2/.test(src), '`STEP_IN` a changé de valeur')
  assert.ok(/export const STEP_OUT = Math\.LN2/.test(src), '`STEP_OUT` a changé de valeur')
})

test('①e LÀ OÙ L\'INVARIANT NE TIENT PAS — le saut est MESURÉ, pas nié', () => {
  const val = (z, f) => courbe(zoomCran({ demZoom: z, zoomNiveau: -f * PAS_NIVEAU }))
  const saut = (z, f) => Math.abs(val(z + 1, 0) - val(z, f)) / val(z, f)

  // (a) LA VOIE DU BUDGET, à la butée EXACTE : écart NUL, à tous les zooms.
  let pireExact = 0
  for (let z = 3; z <= 14; z++) pireExact = Math.max(pireExact, saut(z, 1))
  assert.equal(pireExact, 0, `la butée exacte devrait être continue : ${pireExact}`)

  // (b) …MAIS `atInLimit` TOLÈRE 0,03, donc la voie du budget elle-même n'est
  //     continue qu'À 1,017 % PRÈS. Chiffre mesuré, pas posé.
  const fMin = (PAS_NIVEAU - 0.03) / PAS_NIVEAU
  let pireBudget = 0
  for (let z = 3; z <= 14; z++) pireBudget = Math.max(pireBudget, saut(z, fMin))
  assert.ok(pireBudget > 0.005 && pireBudget < 0.02,
    `tolérance du budget mesurée ${(pireBudget * 100).toFixed(3)} % — hors de la fourchette connue`)

  // (c) LES DEUX AUTRES VOIES — `nearGround()` et `minDistance` — tombent à un
  //     `f` arbitraire, et LÀ le saut est massif. **Le pire est au cran
  //     z4 → z5, où la table d'Adrien double : 2,5 → 5.**
  assert.ok(saut(4, 0) > 0.99, `z4, f=0 : saut mesuré ${(saut(4, 0) * 100).toFixed(1)} %`)
  assert.ok(saut(4, 0.5) > 0.3, `z4, f=0,5 : saut mesuré ${(saut(4, 0.5) * 100).toFixed(1)} %`)
  // …et il s'éteint en approchant de la butée : c'est bien `f` qui le porte.
  assert.ok(saut(4, 0.97) < 0.01, `z4, f=0,97 : ${(saut(4, 0.97) * 100).toFixed(2)} %`)

  // (d) LA GARDE DE SOURCE — les trois voies sont bien celles de `modes.js`. Si
  //     l'une disparaît ou s'ajoute, cet invariant doit être relu.
  const src = sansCommentaires(lire('src/modes.js'))
  const ligne = /const atInLimit = ([^\n]+)/.exec(src)
  assert.ok(ligne, '`atInLimit` a disparu — les voies de déclenchement ont changé')
  assert.equal((ligne[1].match(/\|\|/g) || []).length, 2,
    `\`atInLimit\` n'a plus trois voies : ${ligne[1]}`)
  assert.ok(/minDistance/.test(ligne[1]), '`atInLimit` ne lit plus `minDistance`')
  assert.ok(/nearGround/.test(ligne[1]), '`atInLimit` ne lit plus `nearGround`')
  assert.ok(/STEP_IN\s*\+\s*0\.03/.test(ligne[1]), 'la tolérance de 0,03 a changé — (b) est à refaire')
})

// ══════════ ② IL NE REFERME AUCUNE BOUCLE — ET C'EST MESURÉ ═════════════════

test('② le nouveau pilote ne voit ni exagération, ni échelle, ni distance', () => {
  const src = sansCommentaires(lire('src/monde/exageration-continue.js'))
  const debut = src.indexOf('export function zoomCran')
  assert.ok(debut > 0, '`zoomCran` a disparu')
  const corps = src.slice(debut, src.indexOf('\n}', debut))
  for (const interdit of [/exag/i, /echelle/i, /distance/i, /camY/]) {
    assert.equal(interdit.test(corps), false, `\`zoomCran\` lit ${interdit} — la boucle se referme`)
  }
})

test('②a bis ET LE GARDE EST POSÉ OÙ VIT LE RISQUE — `cranCourant`, dans `main.js`', () => {
  // ⚠️ **CE TEST EXISTE PARCE QUE LE GARDE ÉTAIT AU MAUVAIS ENDROIT.** `zoomCran`
  // est un module PUR : il ne peut pas lire l'exagération, il ne reçoit que ce
  // qu'on lui donne. **Le vrai risque est dans ce qu'on lui DONNE**, et ça vit
  // dans `main.js` — le seul fichier qu'aucun test ne peut charger. C'est
  // exactement le trou que le §0 du plan nomme (« aucun test de ce dépôt ne
  // charge `src/main.js` »), et il se bouche par la source.
  const src = sansCommentaires(lire('src/main.js'))
  const debut = src.indexOf('function cranCourant()')
  assert.ok(debut > 0, '`cranCourant` a disparu de `main.js`')
  const corps = src.slice(debut, src.indexOf('\n}', debut))

  // (a) il ne lit RIEN qui porte l'exagération, ni directement ni par la caméra
  for (const interdit of [/exag/i, /echelleBloc/, /altitudeCadrage/, /camera/i, /controls/, /\bdem\b/]) {
    assert.equal(interdit.test(corps), false,
      `\`cranCourant\` lit ${interdit} — c'est par là que les deux pilotes précédents ont échoué`)
  }
  // (b) …et il ne lit QUE les deux grandeurs propres.
  assert.ok(/params\.demZoom/.test(corps), '`cranCourant` ne lit plus le cran de l\'escalier')
  assert.ok(/zoomNiveau/.test(corps), '`cranCourant` ne lit plus le budget de niveau')

  // (c) LA MUTATION, rejouée sur une source SABOTÉE — sans elle (a) ne prouve
  //     rien. C'est le patron de ①d de `fenetre-branchee.test.js`.
  const sabote = 'function cranCourant() {\n  const d = camera.position.distanceTo(controls.target)\n  return { demZoom: params.demZoom, distance: d }\n}'
  const corpsSabote = sabote.slice(0, sabote.indexOf('\n}'))
  assert.ok(/camera/i.test(corpsSabote), 'le détecteur ne mord pas sur une caméra réintroduite')
})

test('②a ter `f` EST NUL À CHAQUE CRAN EN PRODUCTION — et il faut le dire', () => {
  // ⚠️ **CE N'EST PAS UN DÉFAUT CACHÉ, C'EST UNE LIMITE MESURÉE ET ASSUMÉE.**
  // La chaîne du cran est : molette → `_resetZoom()` → `_refine()` →
  // `_rescale()` → `_resetZoom()` **encore** → `loadSurface` →
  // `fetchAndBuildDem` → `syncExagToZoom`. Quand le pilote lit `_levelZoom`, il
  // vaut donc **toujours zéro**. La courbe est juste et continue, mais elle est
  // **ÉCHANTILLONNÉE AUX CRANS** : `zc = demZoom` exactement, c'est-à-dire la
  // table d'Adrien en escalier. **Le glissement de la décision 14 ne se voit pas
  // encore à l'écran**, et le faire glisser par image exige de sortir le relief
  // du maillage (voir `_rechargeTuiles`, `globe.js`).
  const src = sansCommentaires(lire('src/modes.js'))
  const debut = src.indexOf('async _rescale(')
  const corps = src.slice(debut, src.indexOf('\n  }', debut))
  const posReset = corps.indexOf('_resetZoom()')
  const posCharge = corps.indexOf('loadSurface')
  assert.ok(posReset > -1 && posCharge > -1, 'la chaîne du cran a changé de forme')
  assert.ok(posReset < posCharge,
    '`_resetZoom()` ne précède plus `loadSurface` — `f` cesserait d\'être nul au cran, et ①e devient la règle')

  // …et la conséquence, en clair : au cran, le pilote rend le palier, au bit près.
  for (let z = 3; z <= 15; z++) {
    assert.equal(zoomCran({ demZoom: z, zoomNiveau: 0 }), z)
    const partage = creerExagerationPartagee()
    assert.ok(Math.abs(majExagerationCran(partage, { demZoom: z, zoomNiveau: 0 }) - exagPalier(z)) < 1e-9)
  }
})

test('②b LA DESCENTE ENTIÈRE — le nouveau rejoue la table, l\'ancien GÈLE à 2,8', () => {
  // ⚠️ **LES DEUX MOITIÉS SONT NÉCESSAIRES.** Sans la seconde on ne saurait pas
  // que la première mesure quelque chose : le pilote de cadrage rend lui aussi
  // la bonne valeur à certains crans.

  // (a) LE NOUVEAU — `_levelZoom` remis à zéro au cran, donc `f = 0`.
  for (let z = 3; z <= 15; z++) {
    const partage = creerExagerationPartagee()
    const v = majExagerationCran(partage, { demZoom: z, zoomNiveau: 0 })
    assert.ok(Math.abs(v - exagPalier(z)) < 1e-9, `cran z${z} : ${v} au lieu de ${exagPalier(z)}`)
  }

  // (b) L'ANCIEN — la boucle refermée à la main, exactement comme `_rescale` la
  //     referme : `d ← d × 2 × (exagAprès / exagAvant)`, `facteurEchelle` de
  //     `poseCranContinu`.
  const LAT = 45
  const dRef = distanceArrivee(DISTANCE_MAX_SURFACE)
  let d = dRef
  let e = courbe(3)
  const vus = []
  for (let z = 3; z <= 12; z++) {
    const dAvant = d / 2 // l'utilisateur a dépensé le budget du niveau
    const eAvant = e
    const zc = zoomCadrage({
      distance: dAvant,
      distanceReference: dRef,
      extentMeters: empriseBlocM({ zoom: z + 1, lat: LAT }),
      lat: LAT,
    })
    e = courbe(zc)
    d = dAvant * 2 * (e / eAvant)
    vus.push(e)
  }
  // ⚠️ **LE GEL EST MESURÉ, PAS AFFIRMÉ** : les six derniers crans (z8 → z13)
  // rendent tous la MÊME valeur, et c'est `EXAG_BASE`.
  const queue = vus.slice(-6)
  assert.equal(new Set(queue.map((x) => x.toFixed(6))).size, 1, `la queue devrait être figée : ${queue}`)
  assert.ok(Math.abs(queue[0] - EXAG_BASE) < 1e-9, `figée à ${queue[0]} au lieu de ${EXAG_BASE}`)
  // …et il s'écarte de la table dès le PREMIER cran : 5 au lieu de 2,5.
  assert.ok(Math.abs(vus[0] - exagPalier(4)) > 1, `premier cran : ${vus[0]} contre ${exagPalier(4)} attendus`)
})

test('②c les surcharges d\'Adrien traversent le nouveau pilote', () => {
  const faux = { getItem: (k) => (k === 'monolith.zoomExag' ? '{"5":3.9,"13":1.4}' : null) }
  const surcharges = surchargesStockees(faux)
  assert.deepEqual(surcharges, { 5: 3.9, 13: 1.4 })
  const partage = creerExagerationPartagee({ surcharges })
  assert.ok(Math.abs(majExagerationCran(partage, { demZoom: 5, zoomNiveau: 0 }) - 3.9) < 1e-9)
  assert.ok(Math.abs(majExagerationCran(partage, { demZoom: 13, zoomNiveau: 0 }) - 1.4) < 1e-9)
  // ⚠️ **ET LE CONTRE-TEST** : sans surcharge, ces deux crans rendent 5 et 2,8.
  const nu = creerExagerationPartagee()
  assert.ok(Math.abs(majExagerationCran(nu, { demZoom: 5, zoomNiveau: 0 }) - 5) < 1e-9)
  assert.ok(Math.abs(majExagerationCran(nu, { demZoom: 13, zoomNiveau: 0 }) - EXAG_BASE) < 1e-9)
})

// ══════════ ③ LE GLOBE EST LE QUATORZIÈME LECTEUR ═══════════════════════════
//
// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE** — `rebuildRamp` appelle
// `document.createElement('canvas')` au constructeur. On emprunte donc la
// méthode avec un `this` minimal, exactement comme `test/globe-precision.test.js`
// emprunte `_buildMesh`. Ce qui est vérifié, c'est la MÉTHODE, pas le montage.

/** Le `this` minimal dont `majExageration` et `setExaggeration` ont besoin. */
function fauxGlobe({ exagSuivie, exaggeration = 18 }) {
  return {
    exagSuivie,
    exaggeration,
    tiles: new Map(),
    recharges: 0,
    chargeRacines() { this.recharges++ },
    setExaggeration: Globe.prototype.setExaggeration,
    _rechargeTuiles: Globe.prototype._rechargeTuiles,
    majExageration: Globe.prototype.majExageration,
  }
}

test('③ le globe LIT le partage — il ne calcule plus sa propre valeur', () => {
  const src = lire('src/globe.js')
  assert.ok(/import\s*\{[^}]*lireExageration[^}]*\}\s*from\s*'\.\/monde\/exageration-continue\.js'/.test(src),
    '`globe.js` n\'importe pas `lireExageration` — il n\'est pas le quatorzième lecteur')
  const partage = creerExagerationPartagee()
  const g = fauxGlobe({ exagSuivie: true })
  poserExageration(partage, 3.2)
  assert.equal(g.majExageration({ exagPartage: partage }), 3.2)
  assert.equal(g.exaggeration, 3.2)
  assert.equal(g.recharges, 1, 'la géométrie est cuite : elle doit être redemandée')
  // …et une valeur INCHANGÉE ne redemande rien.
  g.majExageration({ exagPartage: partage })
  assert.equal(g.recharges, 1, 'le globe se recharge pour rien')
})

test('③b SANS DRAPEAU, RIEN NE CHANGE — le globe reste à 18', () => {
  const partage = creerExagerationPartagee()
  poserExageration(partage, 3.2)
  const g = fauxGlobe({ exagSuivie: false })
  assert.equal(g.majExageration({ exagPartage: partage }), 18)
  assert.equal(g.exaggeration, 18, 'la production a bougé sans qu\'on ouvre un drapeau')
  assert.equal(g.recharges, 0)
  // …et le défaut du constructeur est toujours 18, écrit noir sur blanc.
  assert.ok(/params\.globeExaggeration\s*\?\?\s*18/.test(lire('src/globe.js')),
    'le défaut de production du globe a changé de valeur')
})

test('③d le CONSTRUCTEUR naît à la bonne échelle — il ne naît pas à 18 puis saute', () => {
  // ⚠️ **CE TEST EXISTE PARCE QUE LA MUTATION « REMETTRE 18 » NE TUAIT RIEN.**
  // Rejouée contre le dépôt (`.banc/mutations-E.mjs`, M1), la remise de
  // `this.exaggeration = params.globeExaggeration ?? 18` au constructeur laissait
  // **les douze tests verts** : ③ emprunte `majExageration` sur un faux globe et
  // ne passe jamais par le constructeur. Le défaut, lui, est réel — un globe né à
  // 18 rendrait au réseau ses 964 tuiles au premier `syncExagToZoom`, pour rien.
  //
  // ⚠️ **ET IL SE VÉRIFIE SUR LE TEXTE, PAS À L'EXÉCUTION** : `new Globe()` appelle
  // `rebuildRamp`, donc `document.createElement`. C'est le patron de
  // `crop-parois.test.js` et de `crop-sphere.test.js`, pour la même raison.
  const src = sansCommentaires(lire('src/globe.js'))
  const debut = src.indexOf('constructor(params = {})')
  assert.ok(debut > 0, 'le constructeur du globe a disparu')
  const ctor = src.slice(debut, debut + 1400)
  assert.ok(/this\.exagSuivie\s*=/.test(ctor), 'le constructeur ne lit plus le drapeau')
  assert.ok(/this\.exaggeration\s*=[\s\S]{0,120}lireExageration\s*\(\s*params\s*\)/.test(ctor),
    'le globe naît encore à sa propre échelle : il sautera au premier cran')
  assert.ok(/globeExaggeration\s*\?\?\s*18/.test(ctor),
    'le défaut SANS DRAPEAU a disparu du constructeur — la production changerait')
})

test('③c le globe suit les surcharges d\'Adrien, cran par cran', () => {
  const faux = { getItem: () => '{"13":1.4}' }
  const partage = creerExagerationPartagee({ surcharges: surchargesStockees(faux) })
  const g = fauxGlobe({ exagSuivie: true })
  majExagerationCran(partage, { demZoom: 13, zoomNiveau: 0 })
  assert.ok(Math.abs(g.majExageration({ exagPartage: partage }) - 1.4) < 1e-9,
    `le globe rend ${g.exaggeration} au lieu de la surcharge 1,4`)
})

// ══════════ ④ LA MESURE DE CONTRÔLE — UN BLOC DOIT REDEVENIR UN BLOC ════════
//
// Le banc est celui de la Tâche B, au caractère près : mêmes réglages produit,
// même relief de synthèse alpin, même repère. Seule l'exagération change.

const HALF = 28
const CORNER = 0.04 * 56
const EXPO = exposantCoin(0.6)
const COIN = coinNormalise(CORNER, HALF)
const RAYON = 100
const RAYON_TERRE_M = 6371000
const CENTRE = { lat: 45, lon: 6.25 }
const REPERE = repereCrop({ centre: CENTRE })
const FORME = { coin: COIN, expo: EXPO }
const relief = (lat, lon) =>
  1200 + 900 * Math.sin((lon - CENTRE.lon) * 700) + 700 * Math.cos((lat - CENTRE.lat) * 820)

/** Le rapport hauteur / largeur du solide LIVRÉ, à une exagération donnée. */
function rapportHL(exag) {
  const s = construireSolideCrop({
    repere: REPERE,
    forme: FORME,
    rayon: RAYON,
    echelle: (RAYON / RAYON_TERRE_M) * exag,
    hauteur: relief,
  })
  const hauteur = s.hautMax - s.baseY
  return { hauteur, largeur: s.largeur, rapport: hauteur / s.largeur }
}

test('④ à l\'exagération du partage, le bloc est plus LARGE que HAUT', () => {
  const apres = rapportHL(EXAG_BASE)
  assert.ok(apres.rapport < 1,
    `hauteur ${apres.hauteur.toFixed(4)} / largeur ${apres.largeur.toFixed(4)} = ${apres.rapport.toFixed(3)}`)
})

test('④b MUTATION — remettre 18 tue ④', () => {
  // ⚠️ **C'EST LE CHIFFRE DE LA TÂCHE B, REJOUÉ.** Elle avait relevé « 0,77 pour
  // 0,164 » sur ce même relief ; le solide LIVRÉ, base comprise, donne **0,8084
  // pour 0,1640, soit un rapport de 4,930**.
  const avant = rapportHL(18)
  const apres = rapportHL(EXAG_BASE)
  assert.ok(avant.rapport > 4,
    `à 18 le bloc devrait être debout : ${avant.rapport.toFixed(3)}`)

  // ⚠️ **LA LARGEUR N'EST PAS TOUT À FAIT INDÉPENDANTE DE L'EXAGÉRATION, ET
  // C'EST MESURÉ, PAS SUPPOSÉ.** L'assertion écrite d'abord ici — « la largeur
  // ne bouge pas » — a ÉCHOUÉ contre le dépôt, et sa cause est géométrique :
  // l'anneau du contour est posé sur la surface DÉPLACÉE, et le déplacement est
  // RADIAL depuis le centre de la planète. Un relief plus haut évase donc le
  // bloc. **Écart mesuré entre ×18 et ×2,8 : +0,6305 %, soit 1,027·10⁻³ unité
  // (19 cm au sol).** C'est deux ordres sous la variation de hauteur (×5,66) :
  // le rapport mesure bien la hauteur, pas la largeur — mais il fallait le
  // chiffrer pour le dire.
  const evasement = avant.largeur / apres.largeur - 1
  assert.ok(evasement > 0 && evasement < 0.01,
    `évasement mesuré ${(evasement * 100).toFixed(4)} % — hors de la fourchette connue`)
  assert.ok(Math.abs(avant.rapport / apres.rapport - avant.hauteur / apres.hauteur) < 0.05,
    'l\'évasement fausserait le rapport s\'il pesait autant que la hauteur')

  // le facteur 6,4 du §3 du plan, retrouvé sur la hauteur AU-DESSUS DE LA BASE
  // (le solide livré, lui, rend 5,656 : la profondeur de la base, elle, ne
  // dépend que de la largeur — `FRACTION_PROFONDEUR`, 7/56).
  const facteur = avant.hauteur / apres.hauteur
  assert.ok(facteur > 5.5 && facteur < 5.8, `facteur mesuré ${facteur.toFixed(3)}, attendu 5,656`)
})
