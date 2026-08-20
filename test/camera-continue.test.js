// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  ⚠️ FICHIER TEMPORAIRE — IL EST DESTINÉ À DISPARAÎTRE À LA TÂCHE 1b       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
//
// Ce fichier est un TEST DE CARACTÉRISATION, pas un test de spécification. Il
// grave le comportement d'AUJOURD'HUI — *l'altitude fait des sauts* — pour que
// les Tâches 1b et 1c sachent ce qu'elles corrigent et de combien. La Tâche 1b
// pose l'assertion INVERSE (altitude monotone, dérivée seconde bornée) : les
// deux ne peuvent pas être vertes ensemble.
//
// ⚠️ SON RETRAIT, À LA TÂCHE 1b, SE FAIT EN DEUX GESTES, PAS UN :
//   1. supprimer `test/camera-continue.test.js` ;
//   2. **retirer son chemin de la ligne `test` de `package.json`** — c'est une
//      LISTE écrite à la main, pas un motif de fichiers. Oublier le second
//      geste fait sortir `npm run audit:tests` en erreur (fantôme).
//
// Le patron « un défaut gravé comme contrat » est exactement celui que la
// Tâche 4 du plan dénonce à `globe-eviction.test.js:204`. On l'assume ici parce
// que la Tâche 1a doit livrer un instrument ET clore sur `npm test` vert — mais
// on l'assume À VOIX HAUTE, avec sa date de péremption écrite dessus.
//
// Plan : docs/superpowers/plans/2026-08-08-globe-continu.md, Tâche 1a.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CIRCONFERENCE_M,
  DISTANCE_MAX_SURFACE,
  EXAG_BASE,
  EXAG_PAR_ZOOM,
  TUILES_PAR_BLOC,
  Y_CIBLE,
  altitudeOrbitaleM,
  altitudeSortieOrbiteM,
  altitudeSurfaceM,
  echelleBloc,
  echelonsGeometriques,
  empriseBlocM,
  exagPourZoom,
  poseArrivee,
  posePresentation,
  profilDescente,
  sautsDuProfil,
} from '../src/loi-altitude.js'
import { DIVE_TIERS, pickDiveTier, STEP_IN } from '../src/modes.js'
import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8')
const SRC_MAIN = lis('src/main.js')
const SRC_MODES = lis('src/modes.js')
const SRC_DEM = lis('src/dem.js')
const SRC_LOI = lis('src/loi-altitude.js')

const LAT_REF = 45.8326 // Mont-Blanc — le vol de référence du §0 du plan
const VOL = {
  choisirPalier: pickDiveTier,
  metresParUnite: ORBITAL_M_PER_UNIT,
  span: TERRAIN_SIZE,
  budgetNiveau: STEP_IN,
  lat: LAT_REF,
}

// ══════════ ① LA GRANDEUR : GÉOMÉTRIQUE, ET LA MÊME DES DEUX CÔTÉS ══════════

test("l'altitude de surface est GÉOMÉTRIQUE — elle n'ajoute pas meanM", () => {
  // C'est le point qui décide de la survie de cet instrument à la Tâche 1c :
  // `surfaceCamAltMeters` (main.js) ajoute `dem.meanM`, une quantité dérivée du
  // terrain chargé, interdite par la règle R1. La loi pure, elle, ne connaît
  // que la hauteur de caméra et l'échelle du bloc.
  // `meanM` n'apparaît dans loi-altitude.js que dans les commentaires qui
  // expliquent pourquoi il n'y est PAS : aucune ligne de code ne le lit.
  const codeLoi = SRC_LOI.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('//'))
  assert.equal(codeLoi.some((l) => l.includes('meanM')), false, 'loi-altitude.js ne doit jamais lire meanM')
  const extentMeters = 20000
  const a = altitudeSurfaceM({ camY: 10, extentMeters, span: 56, exageration: 2.8 })
  assert.equal(a, 10 / echelleBloc({ extentMeters, span: 56, exageration: 2.8 }))
  // linéaire en camY, et rien d'autre n'entre dedans
  assert.equal(altitudeSurfaceM({ camY: 20, extentMeters, span: 56, exageration: 2.8 }), 2 * a)
})

test('main.js branche bien sa loi de surface sur le module pur', () => {
  // ⚠️ Si ce lien casse, l'instrument mesure autre chose que la production.
  const i = SRC_MAIN.indexOf('surfaceCamAltMeters() {')
  assert.ok(i > 0)
  const bloc = SRC_MAIN.slice(i, i + 900)
  assert.match(bloc, /altitudeSurfaceM\(\{/, 'la moitié géométrique passe par loi-altitude.js')
  assert.match(bloc, /\+ dem\.meanM/, "le `+ meanM` est encore là — c'est la Tâche 1c qui le retire")
})

test('modes.js branche bien ses poses et sa sortie d’orbite sur le module pur', () => {
  assert.match(SRC_MODES, /import \{[\s\S]*?\} from '\.\/loi-altitude\.js'/)
  assert.match(SRC_MODES, /distanceArrivee\(this\.hooks\.surfaceMaxDistance\(\)\)/)
  assert.equal((SRC_MODES.match(/distancePresentation\(/g) ?? []).length, 2, '_rescale et _loadDive')
  assert.match(SRC_MODES, /altitudeSortieOrbiteM\(this\.hooks\.surfaceCamAltMeters\(\)\)/)
  assert.match(SRC_MODES, /this\.altM = altitudeOrbitaleM\(this\.orbAlt, ORBITAL_M_PER_UNIT\)/)
})

// ══════════ ② LES RECOPIES, ET LEURS GARDES ═════════════════════════════════
//
// Trois constantes vivent ailleurs et ne sont pas importables (`main.js` n'est
// chargé par aucun test ; `dem.js` calcule au lieu d'exporter). Elles sont
// recopiées dans `loi-altitude.js` — donc gardées ici.

test('la table d’exagération recopiée est encore celle de main.js', () => {
  assert.match(SRC_MAIN, /const ZOOM_EXAG_DEFAULTS = \{ 3: 2\.5, 4: 2\.5, 5: 5, 6: 4, 7: 3\.2 \}/)
  assert.match(SRC_MAIN, /const BASE_EXAG = 2\.8/)
  assert.deepEqual(EXAG_PAR_ZOOM, { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 })
  assert.equal(EXAG_BASE, 2.8)
  assert.equal(exagPourZoom(5), 5)
  assert.equal(exagPourZoom(12), 2.8, 'hors table → BASE_EXAG')
})

test('l’emprise du bloc reproduit exactement le calcul de dem.js', () => {
  assert.match(SRC_DEM, /const metersPerPixel = \(\(156543\.03392 \* Math\.cos\(latRad\)\) \/ 2 \*\* zoom\) \* \(256 \/ TILE_PX\)/)
  assert.match(SRC_DEM, /extentMeters: metersPerPixel \* sizePx,/)
  assert.match(SRC_DEM, /const sizePx = tilesAcross \* TILE_PX/)
  assert.match(SRC_DEM, /tilesAcross = 3/)
  assert.equal(TUILES_PAR_BLOC, 3)
  // rejoué à la main, comme dem.js le ferait, pour les deux tailles de tuile
  for (const TILE_PX of [256, 512]) {
    const mpp = ((156543.03392 * Math.cos((LAT_REF * Math.PI) / 180)) / 2 ** 11) * (256 / TILE_PX)
    const attendu = mpp * (3 * TILE_PX)
    const obtenu = empriseBlocM({ zoom: 11, lat: LAT_REF })
    assert.ok(Math.abs(obtenu - attendu) < 1e-6, `TILE_PX=${TILE_PX} : ${obtenu} ≠ ${attendu}`)
  }
  assert.ok(Math.abs(CIRCONFERENCE_M - 40075016.6835) < 1e-3, 'la circonférence Web Mercator')
})

test('la butée de distance de surface recopiée est encore celle de main.js', () => {
  assert.match(SRC_MAIN, /surfaceMaxDistance: \(\) => 150,/)
  assert.equal(DISTANCE_MAX_SURFACE, 150)
  assert.match(SRC_MAIN, /const DEFAULT_FINE_ZOOM = 15/, 'le zoom fin par défaut du profil')
})

// ══════════ ③ LES DEUX POSES ════════════════════════════════════════════════

test('les poses d’arrivée reproduisent _arrivalPose et _rescale', () => {
  const a = poseArrivee()
  // _arrivalPose : pos = _ARRIVAL_DIR × (150 × 0,94), cible à y = -0,3
  assert.ok(Math.abs(a.camY - (150 * 0.94 * 18) / Math.hypot(18, 19)) < 1e-9)
  assert.ok(Math.abs(a.camY - 96.9719953) < 1e-6, `camY d’arrivée = ${a.camY}`)
  const p = posePresentation(a.pente)
  // _rescale : pos = cible + prevDir × (150 × 0,97)
  assert.ok(Math.abs(p.distanceCible - 145.5) < 1e-9)
  assert.ok(Math.abs(p.camY - 99.9296367) < 1e-6, `camY de présentation = ${p.camY}`)
  assert.equal(Y_CIBLE, -0.3)
  // ⚠️ LE POINT DE PRÉSENTATION EST PLUS HAUT QUE LE POINT D'ARRIVÉE.
  assert.ok(p.camY > a.camY)
})

// ══════════ ④ LE DÉTECTEUR NE PEUT PAS SE TROMPER SUR UN SEGMENT CONTINU ════

test('un segment continu est échantillonné sous le seuil du détecteur', () => {
  // Sans cette garantie, le détecteur crierait au saut sur un glissé lisse et
  // le test ① serait une tautologie.
  const pts = echelonsGeometriques(1600000, 2000, 1.02)
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i - 1] / pts[i] <= 1.02 + 1e-12, `pas ${i} : ×${pts[i - 1] / pts[i]}`)
  }
  assert.equal(pts[0], 1600000)
  assert.ok(Math.abs(pts.at(-1) - 2000) < 1e-6)
  const lisse = pts.map((altM) => ({ mode: 'orbital', zoom: null, altM, transition: null }))
  assert.deepEqual(sautsDuProfil(lisse), [], 'aucun saut sur un glissé lisse')
})

test('le glissé orbital seul ne fait aucun saut', () => {
  assert.equal(altitudeOrbitaleM(2, 3), 6)
  const pts = profilDescente({ ...VOL, altDepartM: 1600000, altPlongeeM: 1600000 })
  const orbital = pts.filter((p) => p.mode === 'orbital')
  assert.equal(sautsDuProfil(orbital).length, 0)
})

// ══════════ ⑤ LA CARACTÉRISATION — CE QUI EST VRAI AUJOURD'HUI ══════════════

test("l'altitude présente au moins un saut sur une descente de 1 600 km à 2 km", () => {
  const pts = profilDescente(VOL)
  assert.ok(pts[0].altM >= 1600000, `départ ${pts[0].altM} m`)
  assert.ok(pts.at(-1).altM <= 2000, `arrivée ${pts.at(-1).altM} m`)
  const sauts = sautsDuProfil(pts)
  assert.ok(sauts.length >= 1, "aucun saut relevé — la Tâche 1b est-elle déjà passée ?")
})

test('le relevé du 2026-08-20 : onze sauts, un _dive et dix _rescale', () => {
  // ⚠️ C'est LE PLAN DE TRAVAIL des Tâches 1b et 1c. Les valeurs sont mesurées,
  // pas posées : Mont-Blanc (45,8326°), zoom fin 15, budget de niveau STEP_IN.
  const sauts = sautsDuProfil(profilDescente(VOL))
  assert.equal(sauts.length, 11)
  assert.equal(sauts.filter((s) => s.cause === '_dive').length, 1)
  assert.equal(sauts.filter((s) => s.cause === '_rescale').length, 10)
  assert.equal(
    sauts.filter((s) => s.cause === '(non étiqueté)').length,
    0,
    'tout saut relevé doit avoir une cause nommée dans modes.js'
  )

  const dive = sauts[0]
  assert.equal(dive.modeAvant, 'orbital')
  assert.equal(dive.modeApres, 'surface')
  assert.equal(dive.zoomApres, 5, 'pickDiveTier(1 600 km) → le palier z5')
  assert.ok(Math.abs(dive.deM - 1600000) < 1, `depuis ${dive.deM} m`)
  assert.ok(Math.abs(dive.versM - 906634) < 60, `vers ${dive.versM} m`) // 906,6 km
  assert.ok(Math.abs(dive.facteur - 1.765) < 0.005)

  // les dix `_rescale` FONT MONTER l'altitude alors que l'utilisateur zoome.
  const rescales = sauts.slice(1)
  for (const s of rescales) assert.ok(s.ecartM > 0, `z${s.zoomAvant}→z${s.zoomApres} devrait monter`)
  const attendus = {
    6: 2.154, // z5→z6 — l'exagération tombe de 5 à 4
    7: 2.09, // z6→z7 — 4 → 3,2
    8: 1.911, // z7→z8 — 3,2 → 2,8
    9: 1.672, // à partir d'ici l'exagération ne bouge plus : le facteur est constant
    10: 1.672,
    11: 1.672,
    12: 1.672,
    13: 1.672,
    14: 1.672,
    15: 1.672,
  }
  for (const s of rescales) {
    assert.ok(
      Math.abs(s.facteur - attendus[s.zoomApres]) < 0.005,
      `z${s.zoomAvant}→z${s.zoomApres} : ×${s.facteur.toFixed(3)} au lieu de ×${attendus[s.zoomApres]}`
    )
  }
  // et la somme des remontées, qui dit combien de mètres le zoom rend à l'envers
  const remontee = rescales.reduce((a, s) => a + s.ecartM, 0)
  assert.ok(Math.abs(remontee - 685623) < 400, `somme des remontées = ${Math.round(remontee)} m`)
})

test("l'altitude n'est PAS monotone : zoomer d'un cran fait REMONTER la caméra", () => {
  // C'est l'assertion que la Tâche 1b inversera.
  const pts = profilDescente(VOL)
  const remontees = pts.filter((p, i) => i > 0 && p.altM > pts[i - 1].altM)
  assert.ok(remontees.length > 0, 'aucune remontée — la descente serait donc déjà monotone')
  assert.equal(remontees.length, 10, 'exactement les dix `_rescale`')
})

test('la plongée orbitale non-stop a UN saut, et il est plus violent', () => {
  // Le second scénario : la molette descend sans jamais se stabiliser jusqu'au
  // plancher de `orbAltTarget` (DIVE_ALT_M × 0,9 = 7 200 m), et `pickDiveTier`
  // rend alors le palier fin — un seul `_dive`, directement au zoom fin.
  assert.equal(pickDiveTier(7200), DIVE_TIERS[0])
  const sauts = sautsDuProfil(profilDescente({ ...VOL, altPlongeeM: 7200 }))
  assert.equal(sauts.length, 1)
  assert.equal(sauts[0].cause, '_dive')
  assert.ok(Math.abs(sauts[0].deM - 7200) < 1)
  assert.ok(Math.abs(sauts[0].versM - 1581) < 2, `vers ${sauts[0].versM} m`)
  assert.ok(Math.abs(sauts[0].facteur - 4.554) < 0.005)
})

// ══════════ ⑥ enterOrbit — LE TROISIÈME SAUT, ET SES TROIS RÉGIMES ══════════

test('enterOrbit saute peu quand il calcule, énormément quand on lui dicte', () => {
  // (a) régime automatique : ×1,15 borné [15 km, 9 000 km]. Il n'est atteignable
  //     qu'à z3 (`getCoarsenTarget()` rend null au plancher de l'escalier).
  const p = poseArrivee().pente
  const dPres = posePresentation(p).distanceCible
  const altA = (camY, z) =>
    altitudeSurfaceM({ camY, extentMeters: empriseBlocM({ zoom: z, lat: LAT_REF }), span: TERRAIN_SIZE, exageration: exagPourZoom(z) })
  const z3butee = altA(Y_CIBLE + dPres * Math.exp(-STEP_IN) * p, 3)
  assert.ok(Math.abs(z3butee - 2235433) < 2000, `z3 en butée = ${Math.round(z3butee)} m`)
  assert.ok(Math.abs(altitudeSortieOrbiteM(z3butee) / z3butee - 1.15) < 1e-9)
  // les deux bornes, elles, sont des sauts francs
  assert.equal(altitudeSortieOrbiteM(400), 15000, 'plancher : 400 m au sol → 15 km d’orbite')
  assert.equal(altitudeSortieOrbiteM(50000000), 9000000)

  // (b) régime dicté : les deux autres appelants imposent une altitude.
  assert.match(SRC_MAIN, /modes\.enterOrbit\(16000000\)/, 'le bouton globe')
  assert.match(SRC_MODES, /await this\.enterOrbit\(1200000\)/, 'flyTo')
  const z15butee = altA(Y_CIBLE + dPres * Math.exp(-STEP_IN) * p, 15)
  assert.ok(Math.abs(z15butee - 487) < 2, `z15 en butée = ${Math.round(z15butee)} m`)
  assert.ok(16000000 / z15butee > 30000, `bouton globe : ×${Math.round(16000000 / z15butee)}`)
})
