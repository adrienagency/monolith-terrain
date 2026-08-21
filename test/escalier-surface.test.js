// L'ESCALIER DE SURFACE — Tâche 2 bis du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ═════════════════════════════════════════
//
// Deux choses, et elles sont indissociables :
//
//   (a) **un changement de cran en mode surface ne pose AUCUN `_whiteout`** —
//       le fondu au blanc de 480 + 480 ms qui masquait la traversée d'étage ;
//   (b) **l'altitude géométrique est CONTINUE au passage du cran** — décision
//       d'Adrien du 2026-08-20 : « on garde bien un zoom continu, exactement
//       comme Google Earth ou Google Maps ».
//
// ⚠️ ET UN TROISIÈME GARDE-FOU, QUI N'EST PAS UN LUXE. La téléportation retirée
// ici (v48) avait elle-même REMPLACÉ une continuité d'altitude v42, retirée
// pour une raison qui n'est écrite nulle part — ni dans le code, ni dans le
// plan. Le §9 du plan le dit : « si le défaut de v42 reparaît, il sera visible
// à ces assertions ». Les tests ⑤ et ⑥ ci-dessous sont cette visibilité, et ce
// qu'ils surveillent a été MESURÉ, pas supposé (voir leurs commentaires).
//
// ══════════ ÉTAPE 0 — LA FORME DU TEST, TRANCHÉE ════════════════════════════
//
// **L'INSTRUMENT DE LA TÂCHE 1a**, plus des assertions de texte source pour le
// lier au code. `Modes` appelle `document.createElement` et ce dépôt n'a pas de
// jsdom (`grep -c jsdom package.json` → 0) : aucun test ne peut l'instancier.
// La loi vit donc dans `src/loi-altitude.js`, module pur, et `modes.js`
// l'APPELLE — `poseCranContinu` n'est pas une recopie. Les assertions ② et ④
// vérifient ce lien : c'est par elles que la mutation des Étapes 4 et 6 tue.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DISTANCE_MAX_SURFACE,
  DISTANCE_MIN_SURFACE,
  Y_CIBLE,
  echelleBloc,
  empriseBlocM,
  exagPourZoom,
  poseArrivee,
  poseCranContinu,
  profilDescente,
  sautsDuProfil,
} from '../src/loi-altitude.js'
import { pickDiveTier, STEP_IN, STEP_OUT } from '../src/modes.js'
import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ LES FINS DE LIGNE SONT NORMALISÉES, ET CE N'EST PAS UNE COQUETTERIE : ce
// dépôt vit sous Windows avec `autocrlf`, si bien qu'un fichier fraîchement
// extrait par git arrive en CRLF alors que l'arbre de travail est en LF. Sans
// cette normalisation, le découpage de méthode ci-dessous échoue selon qui a
// touché le fichier en dernier — c'est arrivé pendant l'écriture de ce test.
const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
const SRC_MODES = lis('src/modes.js')
const SRC_MAIN = lis('src/main.js')

const LAT_REF = 45.8326 // Mont-Blanc — le vol de référence du §0 du plan
const VOL = {
  choisirPalier: pickDiveTier,
  metresParUnite: ORBITAL_M_PER_UNIT,
  span: TERRAIN_SIZE,
  budgetNiveau: STEP_IN,
  lat: LAT_REF,
}

// Le corps d'une méthode de classe : de son en-tête jusqu'à l'accolade fermante
// à deux espaces d'indentation. Assez pour dire « ce que CETTE méthode fait »
// sans confondre avec ses voisines — c'est tout ce qu'on lui demande.
function corpsDe(src, entete) {
  const i = src.indexOf(entete)
  assert.ok(i > 0, `méthode introuvable : ${entete}`)
  const j = src.indexOf('\n  }\n', i)
  assert.ok(j > i, `fin de méthode introuvable : ${entete}`)
  return src.slice(i, j)
}

const CORPS_RESCALE = corpsDe(SRC_MODES, 'async _rescale(next, verb) {')
const surface = (pts) => pts.filter((p) => p.mode === 'surface')

// ══════════ ① LE RIDEAU — ET LUI SEUL (Étapes 1 à 4) ════════════════════════

test('un changement de cran en mode surface ne pose aucun _whiteout', () => {
  // `_refine` et `_coarsen` sont les deux portes du cran ; toutes deux passent
  // par `_rescale`. Aucune des trois ne doit poser de rideau.
  assert.equal(CORPS_RESCALE.includes('_whiteout'), false, '_rescale pose encore un rideau blanc')
  assert.equal(corpsDe(SRC_MODES, 'async _refine() {').includes('_whiteout'), false)
  assert.equal(corpsDe(SRC_MODES, 'async _coarsen() {').includes('_whiteout'), false)
})

test('les TROIS autres appelants de _whiteout sont intacts — ils sont à la Tâche 2 ter', () => {
  // ⚠️ ON ÉLARGIT UNE LISTE, ON NE LA REMPLACE PAS (§0 du plan). Le plan
  // nomme QUATRE appelants ; la Tâche 2 bis n'en emporte qu'un. Si ce test
  // tombe à cause d'un appelant en moins, c'est que quelqu'un a fait la
  // Tâche 2 ter en passant — pas que ce fichier a tort.
  assert.equal((SRC_MODES.match(/this\._whiteout\(/g) ?? []).length, 3, 'exactement trois appelants restants')
  for (const entete of ['async enterOrbit(entryAltM = null) {', 'async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {', 'async _loadDive(target) {']) {
    assert.ok(corpsDe(SRC_MODES, entete).includes('this._whiteout('), `${entete} devrait encore poser son rideau`)
  }
  // et le rideau lui-même existe toujours : c'est la Tâche 2 ter qui le retire
  assert.match(SRC_MODES, /_whiteout\(swap\) \{/)
})

// ══════════ ② L'ALTITUDE CONTINUE — LE LIEN AVEC LE CODE (Étapes 5 et 6) ════

test('_rescale conserve l’altitude métrique au lieu de téléporter', () => {
  // ⚠️ C'EST CETTE ASSERTION QUE LA MUTATION DE L'ÉTAPE 6 TUE : remettre la
  // téléportation v48, c'est remettre `distancePresentation` dans `_rescale`.
  assert.equal(CORPS_RESCALE.includes('distancePresentation'), false, 'la téléportation v48 est revenue')
  assert.match(CORPS_RESCALE, /poseCranContinu\(\{/, '_rescale doit APPELER la loi, pas la recopier')
  // l'échelle du bloc est lue des DEUX côtés du rechargement — c'est elle qui
  // porte à la fois l'emprise divisée par deux et le changement d'exagération
  assert.match(CORPS_RESCALE, /echelleAvant = this\.hooks\.echelleVerticaleBloc/)
  assert.match(CORPS_RESCALE, /echelleApres = this\.hooks\.echelleVerticaleBloc/)
  assert.ok(
    CORPS_RESCALE.indexOf('echelleAvant') < CORPS_RESCALE.indexOf('await this.hooks.loadSurface'),
    "l'échelle d'AVANT doit être lue avant le rechargement"
  )
  assert.ok(
    CORPS_RESCALE.indexOf('echelleApres') > CORPS_RESCALE.indexOf('await this.hooks.loadSurface'),
    "l'échelle d'APRÈS doit être lue après le rechargement"
  )
  // la moitié de v48 qui était BONNE : l'angle de vue de l'utilisateur survit
  assert.match(CORPS_RESCALE, /const prevDir = this\.camera\.position\.clone\(\)\.sub\(this\.controls\.target\)/)
  assert.match(CORPS_RESCALE, /prevDir\.lengthSq\(\) > 1e-6 \? prevDir\.normalize\(\)/)
})

test('main.js expose l’échelle verticale du bloc, et elle porte l’exagération', () => {
  const i = SRC_MAIN.indexOf('echelleVerticaleBloc() {')
  assert.ok(i > 0, 'le hook echelleVerticaleBloc a disparu de main.js')
  const bloc = SRC_MAIN.slice(i, i + 400)
  assert.match(bloc, /echelleBloc\(\{/, 'il passe par la loi pure')
  // ⚠️ **LE MOTIF A CHANGÉ, PAS LA PROPRIÉTÉ** (Tâche 6 septies) — et c'est le §3
  // de `/threejs-optimisation`, « la suite verte verrouille le défaut » : cette
  // ligne épinglait `dem.extentMeters`, c'est-à-dire l'obligation d'avoir
  // TÉLÉCHARGÉ un MNT avant de connaître l'échelle du bloc. Elle passe désormais
  // par `largeurBlocM()`, qui lit la largeur de la fenêtre bornée quand elle
  // existe et **retombe sur `dem.extentMeters` sinon** — les deux rendent le MÊME
  // chiffre quand le MNT est là (égalité stricte, `fenetre-branchee.test.js` ⑪c).
  // Ce que ce test garde est intact : l'emprise RÉELLE du bloc, pas une constante.
  assert.match(bloc, /extentMeters: largeur\b/, "l'emprise RÉELLE du bloc")
  assert.match(SRC_MAIN, /function largeurBlocM/, "la largeur du bloc a perdu son écrivain unique")
  // ⚠️ **LE MOTIF A CHANGÉ, PAS LA PROPRIÉTÉ** (Tâche 6 bis). L'exagération est
  // toujours passée au hook ; elle vient désormais du PARTAGE unique
  // (`lireExageration`) au lieu d'une des douze lectures directes de
  // `params.demExaggeration` — et `test/fenetre-branchee.test.js` échoue si une
  // seule d'entre elles revient. Ce que ce test garde est intact : sans
  // exagération ici, trois crans restent discontinus.
  assert.match(bloc, /exageration: lireExageration\(params\)/, "⚠️ l'exagération, sinon trois crans restent discontinus")
})

// ══════════ ③ L'ALTITUDE CONTINUE — LA MESURE (Étapes 1, 2 et 6) ════════════

test('sautsDuProfil ne relève plus AUCUN saut de cause _rescale', () => {
  const sauts = sautsDuProfil(profilDescente(VOL))
  assert.deepEqual(sauts.filter((s) => s.cause === '_rescale'), [], 'un cran saute encore')
  // ⚠️ CETTE ASSERTION A ÉTÉ CORRIGÉE EN PLACE PAR LA TÂCHE 1b, ET LE SENS DE
  // LA CORRECTION COMPTE. Elle disait « il en reste UN, `_dive`, et il n'est
  // pas à cette tâche » : la Tâche 1b l'a emporté à son tour en déduisant le
  // niveau ET la distance de la plongée de l'altitude quittée. Il n'en reste
  // donc plus aucun sur la descente de référence. Le détail, la mutation et la
  // borne d'exagération qui subsiste vivent dans test/camera-continue.test.js.
  assert.deepEqual(sauts, [], `sauts restants : ${sauts.map((s) => s.cause).join(', ')}`)
})

test('zoomer ne fait plus JAMAIS remonter la caméra', () => {
  // Le signe était le sujet, pas l'amplitude : les dix `_rescale` faisaient
  // MONTER la caméra de 685 623 m au total pendant que l'utilisateur zoomait.
  const pts = surface(profilDescente(VOL))
  const remontees = pts.filter((p, i) => i > 0 && p.altM > pts[i - 1].altM * 1.001)
  assert.deepEqual(remontees, [], 'la descente doit être monotone en mode surface')
  // Départ et arrivée, mesurés le 2026-08-20 : 1 600 km → 363,1 m au Mont-Blanc.
  // ⚠️ C'ÉTAIT 418 m AVANT LA TÂCHE 1b, et l'écart n'est pas un réglage : la
  // plongée entre désormais dans le niveau z4 à 62,6 unités (l'altitude qu'elle
  // avait en orbite) au lieu du niveau z5 à 141 — un étage de plus, donc une
  // butée basse plus basse.
  const tout = profilDescente(VOL)
  assert.ok(tout[0].altM >= 1600000)
  assert.ok(Math.abs(tout.at(-1).altM - 363.1) < 3, `arrivée à ${tout.at(-1).altM.toFixed(1)} m`)
})

test('MUTATION — remettre la téléportation v48 ramène les sauts', () => {
  // ⚠️ Étape 6 du plan. `cranContinu: false` rejoue EXACTEMENT la pose que
  // `_rescale` posait avant cette tâche (`posePresentation`, maxDistance·0,97).
  const pts = profilDescente({ ...VOL, cranContinu: false })
  const rescales = sautsDuProfil(pts).filter((s) => s.cause === '_rescale')
  assert.ok(rescales.length > 0, 'la mutation ne mord pas — le test ③ ne prouverait rien')
  const surf = surface(pts)
  const remontees = surf.filter((p, i) => i > 0 && p.altM > surf[i - 1].altM * 1.001)
  // ⚠️ ONZE, ET NON DIX, DEPUIS LA TÂCHE 1b : la plongée entre un étage plus
  // haut (z4 au lieu de z5), il y a donc un cran de plus à remonter.
  assert.equal(remontees.length, 11, 'les onze crans de la descente de référence remontent')
})

// ══════════ ④ LE GARDE-FOU v42 — LE BUDGET DU NIVEAU VAUT UN CRAN ═══════════
//
// ⚠️ LA PARTIE QUI N'ÉTAIT ÉCRITE NULLE PART, ET QUI EST PROBABLEMENT LA RAISON
// DU RETRAIT DE v42. Conserver l'altitude au cran ne suffit pas : encore
// faut-il que le niveau ne descende pas PLUS qu'un cran ne rend. Un cran divise
// l'emprise du bloc par deux — ×2 de distance, soit `ln 2`. Le budget valait
// 1,2 (×3,32) : la caméra perdait ×1,66 de recul à chaque étage et venait se
// coller au plancher `minDistance`.

test('le budget du niveau vaut exactement un cran, dans les deux sens', () => {
  assert.equal(STEP_IN, Math.LN2)
  assert.equal(STEP_OUT, Math.LN2, "sinon l'aller-retour cliquette — voir le test ⑥")
  assert.match(SRC_MODES, /export const STEP_IN = Math\.LN2/)
  assert.match(SRC_MODES, /export const STEP_OUT = Math\.LN2/)
  // « au moins 20 crans » (Adrien) est désormais DÉRIVÉ du budget, pas posé à
  // côté de lui : un défilement continu délivre N × IMPULSE × TAU.
  assert.match(SRC_MODES, /const CRANS_PAR_NIVEAU = 20/)
  assert.match(SRC_MODES, /const ZOOM_IMPULSE = STEP_IN \/ \(CRANS_PAR_NIVEAU \* ZOOM_TAU\)/)
})

test('la caméra ne vient JAMAIS se coller au plancher de distance', () => {
  // Mesuré le 2026-08-20 : la distance de scène reste dans [31,32 ; 123,99]
  // unités, plancher `minDistance` = 6. Le rapport au plancher ne descend pas
  // sous ×5.
  //
  // ⚠️ DEUX CHIFFRES ONT CHANGÉ AVEC LA TÂCHE 1b, ET CE N'EST PAS UN RÉGLAGE DE
  // TOLÉRANCE. La plongée entre maintenant dans z4 à 62,6 unités (l'altitude
  // qu'elle avait en orbite) au lieu de z5 à 141 : le premier glissé descend
  // donc à 31,3 et non à 70,6, et le cran z4 → z5 — le seul qui vaille ×4, à
  // cause de l'exagération — remonte à 124. La marge au plancher est passée de
  // ×6,3 à ×5,2, et c'est le point le plus serré de toute la descente.
  //
  // ⚠️ ET LA RECOPIE LITTÉRALE A DISPARU : `modes.js` n'écrit plus `6`, il
  // écrit `DISTANCE_MIN_SURFACE`, en UN SEUL site (`_poseButees`). Les quatre
  // écritures de `minDistance` sont vérifiées dans test/camera-continue.test.js.
  assert.match(SRC_MODES, /c\.minDistance = DISTANCE_MIN_SURFACE/, 'le site unique de la Tâche 1b')
  assert.equal(SRC_MODES.includes('this.controls.minDistance = 6'), false, 'la recopie littérale est revenue')
  assert.equal(DISTANCE_MIN_SURFACE, 6)
  const pts = surface(profilDescente(VOL))
  const dmin = Math.min(...pts.map((p) => p.dist))
  const dmax = Math.max(...pts.map((p) => p.dist))
  assert.ok(dmin > DISTANCE_MIN_SURFACE * 5, `distance minimale ${dmin.toFixed(2)} — trop près du plancher`)
  assert.ok(Math.abs(dmin - 31.32) < 0.1, `distance minimale mesurée = ${dmin.toFixed(2)}`)
  assert.ok(dmax <= DISTANCE_MAX_SURFACE, `distance maximale ${dmax.toFixed(2)} au-dessus de la butée`)
})

test("la distance d'entrée d'étage ne DÉRIVE pas d'un cran au suivant", () => {
  // C'est la forme observable du défaut : ce n'est pas un saut d'altitude, donc
  // le test ③ ne le voit pas. C'est le CADRAGE qui s'effondre — le bloc sort du
  // champ étage après étage jusqu'à ce qu'on n'en voie plus qu'un neuvième.
  const entrees = profilDescente(VOL)
    .filter((p) => p.transition === '_rescale')
    .map((p) => p.dist)
  // ⚠️ ONZE DEPUIS LA TÂCHE 1b : la plongée entre à z4, pas à z5.
  assert.equal(entrees.length, 11, 'onze crans du z4 de la plongée au z15 fin')
  // les trois premiers portent le changement d'exagération (2,5 → 5 → 4 → 3,2
  // → 2,8) et se resserrent ; à partir de z9 le régime est stable à 0,7 % près
  // par cran
  const stables = entrees.slice(4)
  for (let i = 1; i < stables.length; i++) {
    const f = stables[i] / stables[i - 1]
    assert.ok(f > 0.99 && f < 1.01, `l'entrée d'étage dérive de ×${f.toFixed(4)} au cran ${i + 4}`)
  }
  assert.ok(stables.at(-1) > 60, `dernière entrée d'étage à ${stables.at(-1).toFixed(1)} unités`)
})

test('MUTATION — rendre au niveau son budget de 1,2 écrase la caméra sur le plancher', () => {
  // ⚠️ LE DÉFAUT v42, REJOUÉ. Sans cette assertion, le budget pourrait être
  // remis à 1,2 sans qu'aucun test ne bronche : l'altitude resterait continue
  // au cran (test ③ vert) et le cadrage s'effondrerait en silence.
  const pts = surface(profilDescente({ ...VOL, budgetNiveau: 1.2 }))
  const dmin = Math.min(...pts.map((p) => p.dist))
  assert.equal(dmin, DISTANCE_MIN_SURFACE, 'la caméra devrait toucher le plancher')
  const entrees = profilDescente({ ...VOL, budgetNiveau: 1.2 })
    .filter((p) => p.transition === '_rescale')
    .map((p) => p.dist)
  assert.ok(entrees[0] > 60 && entrees.at(-1) < 12, `entrées d'étage : ${entrees[0].toFixed(1)} → ${entrees.at(-1).toFixed(1)}`)
  // et l'arrivée : 62 m au-dessus du sol sur un bloc de 2,5 km de côté
  assert.ok(Math.abs(pts.at(-1).altM - 62.5) < 1, `arrivée à ${pts.at(-1).altM.toFixed(1)} m`)
})

// ══════════ ⑤ L'ALLER-RETOUR — CE QUE STEP_OUT DÉCIDE ═══════════════════════

const echelle = (z) => echelleBloc({ extentMeters: empriseBlocM({ zoom: z, lat: LAT_REF }), span: TERRAIN_SIZE, exageration: exagPourZoom(z) })

// Un cran de zoom suivi d'un cran de dézoom, à budgets donnés. Rend le rapport
// d'altitude entre l'arrivée et le départ : 1 = on est revenu où on était.
function allerRetour(z, d0, budgetIn, budgetOut) {
  const pente = poseArrivee().pente
  const alt = (d) => (Y_CIBLE + d * pente) / echelle(z)
  const alt0 = alt(d0)
  let d = Math.max(d0 * Math.exp(-budgetIn), DISTANCE_MIN_SURFACE)
  d = poseCranContinu({ camY: Y_CIBLE + d * pente, pente, facteurEchelle: echelle(z + 1) / echelle(z) }).distanceCible
  d = Math.min(d * Math.exp(budgetOut), DISTANCE_MAX_SURFACE)
  d = poseCranContinu({ camY: Y_CIBLE + d * pente, pente, facteurEchelle: echelle(z) / echelle(z + 1) }).distanceCible
  return alt(d) / alt0
}

test('un cran de zoom puis un cran de dézoom ramènent où on était', () => {
  const r = allerRetour(10, 77.5, STEP_IN, STEP_OUT)
  assert.ok(Math.abs(r - 1) < 0.05, `l'aller-retour rend ×${r.toFixed(3)}`)
  assert.ok(Math.abs(r - 0.97) < 0.005, `mesuré ×0,970 — le résidu vient du y = ${Y_CIBLE} de la cible`)
})

test('MUTATION — un STEP_OUT plus court que STEP_IN fait CLIQUETER l’aller-retour', () => {
  // ⚠️ Mesuré : avec les anciens 1,2 / 0,55, un cran in + un cran out rendent
  // 14 326 m là où on était parti de 27 696 m. On revient DEUX FOIS PLUS BAS
  // qu'avant d'avoir zoomé, et rien ne le signale — l'ancien escalier n'en
  // souffrait pas parce que la téléportation remettait les deux directions au
  // même point de présentation.
  const r = allerRetour(10, 77.5, 1.2, 0.55)
  assert.ok(Math.abs(r - 0.517) < 0.005, `l'aller-retour asymétrique rend ×${r.toFixed(3)}`)
})
