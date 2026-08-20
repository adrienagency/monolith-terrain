// LA CAMÉRA CONTINUE — Tâche 1b du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE FICHIER A CHANGÉ DE NATURE LE 2026-08-20 ═════════════════════
//
// Il est né à la Tâche 1a comme **test de CARACTÉRISATION** : il gravait
// l'altitude qui SAUTE, pour que les tâches suivantes sachent ce qu'elles
// corrigeaient et de combien. Son en-tête portait sa date de péremption — « il
// est destiné à disparaître à la Tâche 1b ».
//
// ⚠️ IL NE DISPARAÎT PAS : IL S'INVERSE, ET C'EST PLUS SÛR QUE DE LE SUPPRIMER.
// Le plan demandait de le retirer parce que deux tests contradictoires verts
// sont pires qu'aucun. Le danger était l'assertion « il reste un saut », pas le
// fichier : elle est devenue « il n'en reste aucun » (section ⑤), et **le
// relevé d'origine est conservé, REJOUABLE, contre la loi d'AVANT** — c'est lui
// qui prouve que la nouvelle assertion n'est pas une tautologie. Supprimer le
// fichier aurait emporté cette preuve avec le défaut. Le plan le dit lui-même à
// l'Étape 1 de la Tâche 1b : « ne le supprimez pas sans le remplacer par cette
// preuve-là ».
//
// Il n'y a donc plus rien de temporaire ici, et le fichier reste dans la ligne
// `test` de `package.json` (`npm run audit:tests` sans écart).
//
// ══════════ CE QU'IL GARDE ══════════════════════════════════════════════════
//
//   ① la GRANDEUR — l'altitude géométrique, la même des deux côtés du mode ;
//   ② les RECOPIES et leurs gardes de texte source ;
//   ③ les POSES ;
//   ④ le DÉTECTEUR, qui ne peut pas confondre un glissé avec un saut ;
//   ⑤ **LA CONTINUITÉ** — l'assertion de la Tâche 1b, et sa mutation ;
//   ⑥ `enterOrbit` et ses trois régimes ;
//   ⑦ le LIEN AVEC LE CODE — sans quoi la loi serait juste et le code faux.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CIRCONFERENCE_M,
  DISTANCE_MAX_SURFACE,
  DISTANCE_MIN_SURFACE,
  ALT_PLANCHER_ORBITALE_M,
  EXAG_BASE,
  EXAG_PAR_ZOOM,
  NEAR_MAX,
  PENTE_ARRIVEE_Y,
  TUILES_PAR_BLOC,
  Y_CIBLE,
  altitudeOrbitaleM,
  altitudeSortieOrbiteM,
  altitudeSurfaceM,
  distanceMinOrbitale,
  distancePourAltitude,
  echelleBloc,
  echelonsGeometriques,
  empriseBlocM,
  exagPourZoom,
  niveauDePlongee,
  planProche,
  poseArrivee,
  posePresentation,
  profilDescente,
  sautsDuProfil,
} from '../src/loi-altitude.js'
import { DIVE_TIERS, pickDiveTier, STEP_IN } from '../src/modes.js'
import { ORBITAL_M_PER_UNIT, R_GLOBE } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ FINS DE LIGNE NORMALISÉES — ce dépôt vit sous Windows avec `autocrlf` et un
// fichier fraîchement extrait arrive en CRLF (voir test/escalier-surface.test.js).
const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
const SRC_MAIN = lis('src/main.js')
const SRC_MODES = lis('src/modes.js')
const SRC_DEM = lis('src/dem.js')
const SRC_GLOBE = lis('src/globe.js')
const SRC_LOI = lis('src/loi-altitude.js')

const LAT_REF = 45.8326 // Mont-Blanc — le vol de référence du §0 du plan
const VOL = {
  choisirPalier: pickDiveTier,
  metresParUnite: ORBITAL_M_PER_UNIT,
  span: TERRAIN_SIZE,
  budgetNiveau: STEP_IN,
  lat: LAT_REF,
}

// LA LOI D'AVANT LES TÂCHES 2 bis ET 1b, rejouable telle quelle : c'est elle
// qui porte les onze sauts relevés à la Tâche 1a, et c'est elle qui rend les
// assertions de continuité non tautologiques.
const AVANT = { ...VOL, budgetNiveau: 1.2, cranContinu: false, plongeeContinue: false }

const echelleRef = (z) =>
  echelleBloc({ extentMeters: empriseBlocM({ zoom: z, lat: LAT_REF }), span: TERRAIN_SIZE, exageration: exagPourZoom(z) })

// Le corps d'une fonction ou d'une méthode, de son en-tête à l'accolade
// fermante de son niveau d'indentation.
function corpsDe(src, entete, indent = '  ') {
  const i = src.indexOf(entete)
  assert.ok(i > 0, `introuvable : ${entete}`)
  const j = src.indexOf(`\n${indent}}\n`, i)
  assert.ok(j > i, `fin introuvable : ${entete}`)
  return src.slice(i, j)
}

// ══════════ ① LA GRANDEUR : GÉOMÉTRIQUE, ET LA MÊME DES DEUX CÔTÉS ══════════

test("l'altitude de surface est GÉOMÉTRIQUE — elle n'ajoute pas meanM", () => {
  // `meanM` n'apparaît dans loi-altitude.js que dans les commentaires qui
  // expliquent pourquoi il n'y est PAS : aucune ligne de code ne le lit.
  const codeLoi = SRC_LOI.split('\n').filter((l) => !l.trimStart().startsWith('//'))
  assert.equal(codeLoi.some((l) => l.includes('meanM')), false, 'loi-altitude.js ne doit jamais lire meanM')
  const extentMeters = 20000
  const a = altitudeSurfaceM({ camY: 10, extentMeters, span: 56, exageration: 2.8 })
  assert.equal(a, 10 / echelleBloc({ extentMeters, span: 56, exageration: 2.8 }))
  assert.equal(altitudeSurfaceM({ camY: 20, extentMeters, span: 56, exageration: 2.8 }), 2 * a)
})

test('main.js sépare l’altitude qui DÉCIDE de celle qui S’AFFICHE — règle R1', () => {
  // ⚠️ C'EST L'ÉTAPE R1 DE LA TÂCHE 1b, ET ELLE A INVERSÉ CE TEST. Il exigeait
  // que `+ dem.meanM` soit ENCORE là (« c'est la Tâche 1c qui le retire »).
  // Il exige maintenant qu'il ait quitté le chemin de CADRAGE — et qu'il soit
  // resté sur celui de l'AFFICHAGE, où R1 ne parle pas et où le retirer aurait
  // fait lire une hauteur au-dessus du bloc au lieu du niveau de la mer.
  const cadrage = corpsDe(SRC_MAIN, 'function altitudeCadrageM() {', '')
  assert.match(cadrage, /altitudeSurfaceM\(\{/, 'la loi pure, et rien d’autre')
  assert.equal(cadrage.includes('meanM'), false, 'l’altitude de CADRAGE ne doit plus lire meanM')
  // …et le hook que `modes.js` appelle est bien celui-là
  assert.match(SRC_MAIN, /surfaceCamAltCadrageM: altitudeCadrageM,/)
  // l'altimètre, lui, garde son niveau de la mer
  const affiche = corpsDe(SRC_MAIN, '    surfaceCamAltMeters() {', '    ')
  assert.match(affiche, /altitudeCadrageM\(\) \+ \(params\.source === 'real' && dem \? dem\.meanM : 0\)/)
  // et c'est bien le hook de CADRAGE que la porte orbitale interroge
  assert.match(SRC_MODES, /altitudeSortieOrbiteM\(this\._altitudeCadrageM\(\)\)/)
  assert.match(SRC_MODES, /surfaceCamAltCadrageM\?\.\(\) \?\? this\.hooks\.surfaceCamAltMeters\(\)/)
})

test('modes.js branche bien ses poses et sa sortie d’orbite sur le module pur', () => {
  assert.match(SRC_MODES, /import \{[\s\S]*?\} from '\.\/loi-altitude\.js'/)
  assert.match(SRC_MODES, /distanceArrivee\(this\.hooks\.surfaceMaxDistance\(\)\)/)
  // ⚠️ IL Y EN AVAIT DEUX — `_rescale` et `_loadDive`. La Tâche 2 bis a retiré
  // celui de `_rescale`. Le second, `_loadDive` (le clic-plongée), appartient à
  // la Tâche 1c Étape 2.
  assert.equal((SRC_MODES.match(/distancePresentation\(/g) ?? []).length, 1, '_loadDive seul')
  assert.match(SRC_MODES, /poseCranContinu\(\{/, 'le cran continu de la Tâche 2 bis')
  assert.match(SRC_MODES, /this\.altM = altitudeOrbitaleM\(this\.orbAlt, ORBITAL_M_PER_UNIT\)/)
})

// ══════════ ② LES RECOPIES, ET LEURS GARDES ═════════════════════════════════

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

// ══════════ ③ LES POSES ═════════════════════════════════════════════════════

test('les poses d’arrivée reproduisent _arrivalPose et _rescale', () => {
  const a = poseArrivee()
  assert.ok(Math.abs(a.camY - (150 * 0.94 * 18) / Math.hypot(18, 19)) < 1e-9)
  assert.ok(Math.abs(a.camY - 96.9719953) < 1e-6, `camY d’arrivée = ${a.camY}`)
  const p = posePresentation(a.pente)
  assert.ok(Math.abs(p.distanceCible - 145.5) < 1e-9)
  assert.ok(Math.abs(p.camY - 99.9296367) < 1e-6, `camY de présentation = ${p.camY}`)
  assert.equal(Y_CIBLE, -0.3)
  assert.ok(p.camY > a.camY, 'le point de présentation est plus haut que le point d’arrivée')
})

test('la pente de plongée est celle d’_ARRIVAL_DIR, et elle NE dépend plus de la distance', () => {
  // ⚠️ C'EST CE QUI REND LA RELATION ALTITUDE → DISTANCE INVERSIBLE. La pose
  // absolue d'`_arrivalPose` donnait une pente qui dépendait de la distance
  // (0,688 94) ; la pose RELATIVE à la cible donne celle d'`_ARRIVAL_DIR`
  // (0,687 745), constante. L'écart vaut 0,17 % et il est écrit, pas subi.
  assert.ok(Math.abs(PENTE_ARRIVEE_Y - 18 / Math.hypot(18, 19)) < 1e-15)
  assert.ok(Math.abs(PENTE_ARRIVEE_Y - 0.6877446) < 1e-7, `pente = ${PENTE_ARRIVEE_Y}`)
  assert.ok(Math.abs(PENTE_ARRIVEE_Y / poseArrivee().pente - 1) < 0.002)
  // l'aller-retour altitude → distance → altitude est exact
  const echelleV = echelleRef(9)
  const d = distancePourAltitude({ altM: 42000, echelleV })
  assert.ok(Math.abs((Y_CIBLE + d * PENTE_ARRIVEE_Y) / echelleV - 42000) < 1e-6)
})

test('niveauDePlongee prend le niveau le plus FIN qui tient sous le plafond', () => {
  // Les plafonds mesurés au Mont-Blanc (distance d'arrivée 141 unités) :
  //   z3 7 230 km · z4 3 615 km · z5 904 km · … · z15 1 576 m
  // ⚠️ LA PROGRESSION N'EST PAS ×2 PARTOUT, et c'est l'exagération qui la
  // casse : z4 → z5 vaut ×4 (exagération 2,5 → 5), z5 → z6 vaut ×1,6.
  const plafond = (z) => (Y_CIBLE + 141 * PENTE_ARRIVEE_Y) / echelleRef(z)
  assert.ok(Math.abs(plafond(4) - 3615172) < 2000, `z4 : ${Math.round(plafond(4))} m`)
  assert.ok(Math.abs(plafond(5) - 903793) < 1000, `z5 : ${Math.round(plafond(5))} m`)
  assert.ok(Math.abs(plafond(4) / plafond(5) - 4) < 0.01, 'le trou z4 → z5 vaut ×4, pas ×2')

  const n = niveauDePlongee({ altM: 1600000, echelleAuZoom: echelleRef, zoomMax: 15 })
  assert.equal(n.zoom, 4, 'z5 ne peut pas héberger 1 600 km : son plafond est à 904 km')
  assert.equal(n.borne, null)
  assert.ok(Math.abs(n.distanceCible - 62.6468) < 1e-3, `distance = ${n.distanceCible}`)
  // et l'altitude ainsi posée est EXACTEMENT celle qu'on avait en orbite
  assert.ok(Math.abs((Y_CIBLE + n.distanceCible * PENTE_ARRIVEE_Y) / echelleRef(4) - 1600000) < 1)

  // les deux bornes, et elles sont des sauts ASSUMÉS
  const haut = niveauDePlongee({ altM: 20000000, echelleAuZoom: echelleRef, zoomMax: 15 })
  assert.equal(haut.borne, 'haut')
  assert.equal(haut.zoom, 3, 'le plancher d’Adrien')
  const bas = niveauDePlongee({ altM: 1, echelleAuZoom: echelleRef, zoomMax: 15 })
  assert.equal(bas.borne, 'bas')
  assert.equal(bas.distanceCible, DISTANCE_MIN_SURFACE)
})

// ══════════ ④ LE DÉTECTEUR NE PEUT PAS SE TROMPER SUR UN SEGMENT CONTINU ════

test('un segment continu est échantillonné sous le seuil du détecteur', () => {
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
  assert.equal(sautsDuProfil(pts.filter((p) => p.mode === 'orbital')).length, 0)
})

// ══════════ ⑤ LA CONTINUITÉ — L'ASSERTION DE LA TÂCHE 1b ════════════════════
//
// ⚠️ ELLE PORTE SUR LA CONTINUITÉ, PAS SUR LA MONOTONIE, ET LE PLAN L'A CORRIGÉ
// LUI-MÊME. La monotonie était DÉJÀ vraie après la Tâche 2 bis : le seul saut
// restant, `_dive`, DESCENDAIT (÷1,765). Une assertion de monotonie aurait été
// verte avant d'être écrite.
//
// Le seuil n'est pas un réglage : c'est le PAS D'ÉCHANTILLONNAGE du profil
// (`ratioMax = 1,02`). En dessous, on ne pourrait plus distinguer un saut d'un
// point de glissé ; au-dessus, on laisserait passer de vrais sauts. On assère
// donc exactement à la limite : **aucun pas du profil n'est plus gros que le
// pas d'échantillonnage.**

// ⚠️ 1,02 EST LE PAS LUI-MÊME, et `echelonsGeometriques` peut l'atteindre à
// 1e-5 près (mesuré : ×1,019 990 9 sur le glissé orbital). Le seuil est donc
// posé juste AU-DESSUS, pas juste en dessous — sinon il compterait chaque point
// du glissé comme un saut, ce qui est exactement l'erreur que la première
// rédaction de ce test a commise.
const SEUIL_CONTINU = 1.0201

test('LA DESCENTE DE RÉFÉRENCE EST CONTINUE — plus aucun saut, de 1 600 km à 363 m', () => {
  const pts = profilDescente(VOL)
  assert.ok(pts[0].altM >= 1600000, `départ ${pts[0].altM} m`)
  assert.ok(pts.at(-1).altM <= 2000, `arrivée ${pts.at(-1).altM} m`)
  assert.deepEqual(sautsDuProfil(pts, { facteurMin: SEUIL_CONTINU }), [], 'un saut subsiste')
  // le pas le plus gros du profil entier, mesuré : ×1,019 715 — le pas
  // d'échantillonnage lui-même, à 0,03 % près.
  let pire = 1
  for (let i = 1; i < pts.length; i++) {
    pire = Math.max(pire, pts[i].altM / pts[i - 1].altM, pts[i - 1].altM / pts[i].altM)
  }
  assert.ok(pire <= 1.02 + 1e-9, `le pas le plus gros vaut ×${pire.toFixed(6)}`)
  // la plongée pose la caméra à l'altitude EXACTE qu'elle avait en orbite
  const dive = pts.find((p) => p.transition === '_dive')
  assert.equal(dive.zoom, 4, 'niveau DÉDUIT de l’altitude, plus lu dans DIVE_TIERS (qui disait z5)')
  assert.ok(Math.abs(dive.altM - 1600000) < 1, `la plongée arrive à ${dive.altM} m`)
  assert.ok(Math.abs(pts.at(-1).altM - 363.1) < 1, `arrivée z15 à ${pts.at(-1).altM.toFixed(1)} m`)
})

test('LA DÉRIVÉE SECONDE EST BORNÉE — par le pas d’échantillonnage, rien de plus', () => {
  // La forme forte de la continuité : le profil n'a pas seulement des pas
  // bornés, sa COURBURE l'est aussi. Sur un glissé géométrique parfait la
  // dérivée seconde du log de l'altitude est nulle ; elle ne remonte qu'aux
  // jonctions glissé ↔ cran, et y vaut au plus un pas d'échantillonnage.
  const courbureMax = (pts) => {
    const L = pts.map((p) => Math.log(p.altM))
    let m = 0
    for (let i = 2; i < L.length; i++) m = Math.max(m, Math.abs(L[i] - 2 * L[i - 1] + L[i - 2]))
    return m
  }
  const c = courbureMax(profilDescente(VOL))
  assert.ok(c <= Math.log(1.02) + 1e-12, `courbure maximale ${c.toFixed(6)} > log(1,02) = ${Math.log(1.02).toFixed(6)}`)
  assert.ok(Math.abs(c - 0.019523) < 1e-5, `mesurée le 2026-08-20 : 0,019 523 (obtenu ${c.toFixed(6)})`)
  // ⚠️ ET LA PREUVE QUE CE N'EST PAS UNE TAUTOLOGIE : la loi d'avant vaut 40 fois plus.
  const avant = courbureMax(profilDescente(AVANT))
  assert.ok(avant > 40 * c, `la loi d’avant : courbure ${avant.toFixed(3)}, soit ×${(avant / c).toFixed(0)}`)
})

test('MUTATION — rendre à la plongée sa pose fixe ramène le saut de ÷1,765', () => {
  // ⚠️ Étape 4 du plan. `plongeeContinue: false` rejoue EXACTEMENT ce que
  // `_dive` faisait avant cette tâche : le niveau lu dans `DIVE_TIERS`
  // (`pickDiveTier`) et la distance fixe de `poseArrivee` (150 × 0,94).
  const sauts = sautsDuProfil(profilDescente({ ...VOL, plongeeContinue: false }), { facteurMin: SEUIL_CONTINU })
  const dive = sauts.filter((s) => s.cause === '_dive')
  assert.equal(dive.length, 1, 'la mutation ne mord pas — le test de continuité ne prouverait rien')
  const d = dive[0]
  assert.equal(d.modeAvant, 'orbital')
  assert.equal(d.modeApres, 'surface')
  assert.equal(d.zoomApres, 5, 'pickDiveTier(1 600 km) → le palier z5')
  assert.ok(Math.abs(d.deM - 1600000) < 1, `depuis ${d.deM} m`)
  assert.ok(Math.abs(d.versM - 906598) < 60, `vers ${d.versM} m`) // 906,6 km
  assert.ok(Math.abs(d.facteur - 1.765) < 0.005)
  assert.ok(d.ecartM < 0, 'le saut d’avant DESCENDAIT — d’où la reformulation sur la continuité')
})

test('la plongée orbitale non-stop est continue elle aussi', () => {
  // Le second scénario de la Tâche 1a : la molette descend sans se stabiliser.
  // ⚠️ SON PLANCHER A DISPARU AVEC LA TÂCHE 1b (voir ORB_ALT_MIN dans modes.js) ;
  // 7 200 m reste le point de mesure historique, il n'est plus une butée.
  const pts = profilDescente({ ...VOL, altPlongeeM: 7200 })
  assert.deepEqual(sautsDuProfil(pts, { facteurMin: SEUIL_CONTINU }), [])
  const dive = pts.find((p) => p.transition === '_dive')
  assert.equal(dive.zoom, 12, 'le niveau qui héberge 7 200 m (plafond z12 = 12 609 m)')
  assert.ok(Math.abs(dive.altM - 7200) < 1)
  // Avant la Tâche 1b : un seul saut, mais le plus violent de tous — ÷4,554,
  // parce que `pickDiveTier(7 200)` rendait directement le palier fin.
  const avant = sautsDuProfil(profilDescente({ ...VOL, altPlongeeM: 7200, plongeeContinue: false }))
  assert.equal(avant.length, 1)
  assert.equal(pickDiveTier(7200), DIVE_TIERS[0])
  assert.ok(Math.abs(avant[0].facteur - 4.554) < 0.005)
})

test('LE RELEVÉ DU 2026-08-20 reste rejouable — onze sauts, un _dive et dix _rescale', () => {
  // ⚠️ C'ÉTAIT LE PLAN DE TRAVAIL DES TÂCHES 1b ET 1c, et c'est maintenant la
  // seule trace EXÉCUTABLE de ce qui a été corrigé. On élargit une liste, on ne
  // la remplace pas (§0 du plan) : le relevé se rejoue contre la loi d'AVANT —
  // téléportation du cran (`cranContinu: false`), budget de niveau 1,2, et pose
  // de plongée fixe (`plongeeContinue: false`).
  const sauts = sautsDuProfil(profilDescente(AVANT))
  assert.equal(sauts.length, 11)
  assert.equal(sauts.filter((s) => s.cause === '_dive').length, 1)
  assert.equal(sauts.filter((s) => s.cause === '_rescale').length, 10)
  assert.equal(sauts.filter((s) => s.cause === '(non étiqueté)').length, 0)
  const attendus = { 6: 2.154, 7: 2.09, 8: 1.911, 9: 1.672, 10: 1.672, 11: 1.672, 12: 1.672, 13: 1.672, 14: 1.672, 15: 1.672 }
  for (const s of sauts.slice(1)) {
    assert.ok(s.ecartM > 0, `z${s.zoomAvant}→z${s.zoomApres} devrait MONTER pendant qu’on zoome`)
    assert.ok(
      Math.abs(s.facteur - attendus[s.zoomApres]) < 0.005,
      `z${s.zoomAvant}→z${s.zoomApres} : ×${s.facteur.toFixed(3)} au lieu de ×${attendus[s.zoomApres]}`
    )
  }
  const remontee = sauts.slice(1).reduce((a, s) => a + s.ecartM, 0)
  assert.ok(Math.abs(remontee - 685623) < 400, `somme des remontées = ${Math.round(remontee)} m`)
})

test('CE QUI SAUTE ENCORE, ET POURQUOI : le cran z4 → z5 de l’exagération', () => {
  // ⚠️ ASSERTION DE BORNE, PAS DE CARACTÉRISATION : elle ne grave pas un défaut,
  // elle dit **où il peut encore y en avoir un et nulle part ailleurs**. Si
  // quelqu'un le corrige, elle rougit et il la met à jour ; si quelqu'un en
  // introduit un ailleurs, elle rougit aussi. C'est ce qu'on lui demande.
  //
  // LA CAUSE, DÉRIVÉE : un cran divise l'emprise du bloc par deux, donc rend
  // ×2 de distance — sauf de z4 à z5, où l'exagération saute de 2,5 à 5 et où
  // le cran rend ×4. Le glissé n'ayant dépensé que ×2 (`STEP_IN = ln 2`), la
  // distance d'après vaut le DOUBLE de celle d'avant le niveau et dépasse la
  // butée de 150 unités dès qu'on entre dans z4 au-dessus de 75.
  // → Le remède n'est pas ici : c'est `STEP_IN = ln(facteur d'échelle du cran)`
  //   au lieu de `ln 2` (territoire de la Tâche 2 bis), ou une exagération
  //   constante — et celle-là est une décision d'Adrien, pas de code.
  const cas = [
    { lat: 64 },
    { altDepartM: 7000000 },
    { altDepartM: 3000000 },
    { lat: 0 },
    { lat: -45.8326 },
    { altDepartM: 200000 },
    { altPlongeeM: 7200 },
    {},
  ]
  let vus = 0
  for (const cfg of cas) {
    for (const s of sautsDuProfil(profilDescente({ ...VOL, ...cfg }), { facteurMin: SEUIL_CONTINU })) {
      vus++
      assert.equal(s.cause, '_rescale', `saut inattendu (${s.cause}) sur ${JSON.stringify(cfg)}`)
      assert.equal(s.zoomApres, 5, `saut hors du cran d’exagération sur ${JSON.stringify(cfg)}`)
    }
  }
  assert.ok(vus >= 3, `la borne ne serait pas vérifiable si elle n’était jamais atteinte (vus : ${vus})`)
  // le vol de référence du §0, lui, n'en rencontre aucun
  assert.deepEqual(sautsDuProfil(profilDescente(VOL), { facteurMin: SEUIL_CONTINU }), [])
})

// ══════════ ⑥ enterOrbit — LE TROISIÈME SAUT, ET SES TROIS RÉGIMES ══════════

test('enterOrbit saute peu quand il calcule, énormément quand on lui dicte', () => {
  // (a) régime automatique : ×1,15 borné [15 km, 9 000 km].
  const buteeDe = (zoomFin, altDepartM) => profilDescente({ ...VOL, altDepartM, zoomFin }).at(-1).altM
  const z3butee = buteeDe(3, 10000000) // au-dessus du plafond de z3 : la plongée est bornée
  assert.ok(Math.abs(z3butee - 3603954) < 3000, `z3 en butée = ${Math.round(z3butee)} m`)
  assert.ok(Math.abs(altitudeSortieOrbiteM(z3butee) / z3butee - 1.15) < 1e-9)
  assert.equal(altitudeSortieOrbiteM(400), 15000, 'plancher : 400 m au sol → 15 km d’orbite')
  assert.equal(altitudeSortieOrbiteM(50000000), 9000000)

  // (b) régime dicté : les deux autres appelants imposent une altitude.
  assert.match(SRC_MAIN, /modes\.enterOrbit\(16000000\)/, 'le bouton globe')
  assert.match(SRC_MODES, /await this\.enterOrbit\(1200000\)/, 'flyTo')
  const z15butee = buteeDe(15, 1600000)
  assert.ok(Math.abs(z15butee - 363) < 3, `z15 en butée = ${Math.round(z15butee)} m`) // 418 m avant la Tâche 1b
  assert.ok(16000000 / z15butee > 30000, `bouton globe : ×${Math.round(16000000 / z15butee)}`)
})

// ══════════ ⑦ LE LIEN AVEC LE CODE ══════════════════════════════════════════
//
// La loi peut être juste et le code faux : ces assertions-là sont ce qui rend
// les mutations de l'Étape 4 mortelles.

test('_dive APPELLE la loi de plongée — il ne la recopie pas', () => {
  const corps = corpsDe(SRC_MODES, '  async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {')
  // l'altitude quittée est lue AVANT tout le reste, et c'est `this.altM`, qui
  // en orbite EST l'altitude géométrique
  assert.match(corps, /const altDepartM = this\.altM/)
  assert.match(corps, /this\._niveauDePlongee\(altDepartM,/)
  assert.match(corps, /this\._posePlongee\(arrival, altDepartM\)/)
  assert.ok(
    corps.indexOf('const altDepartM') < corps.indexOf('await this.hooks.loadSurface'),
    'l’altitude de départ doit être lue AVANT le chargement'
  )
  // la loi elle-même vit dans le module pur
  assert.match(corpsDe(SRC_MODES, '  _niveauDePlongee(altM, zoomImpose = null) {'), /return niveauDePlongee\(\{/)
  const pose = corpsDe(SRC_MODES, '  _posePlongee(arrival, altDepartM) {')
  assert.match(pose, /this\.hooks\.echelleVerticaleBloc\?\.\(\)/, 'l’échelle RÉELLE, lue après le chargement')
  assert.match(pose, /distancePourAltitude\(\{ altM: altDepartM, echelleV/)
  // ⚠️ ET LA POSE FIXE A DISPARU DE `_dive` : c'est elle que la mutation remet.
  assert.equal(corps.includes('this.camera.position.copy(arrival.pos)'), false, 'la pose fixe est revenue dans _dive')
  // main.js fournit l'échelle d'un niveau NON CHARGÉ — sans quoi le niveau ne
  // pourrait pas être choisi
  assert.match(SRC_MAIN, /echelleVerticaleAuZoom\(zoom, lat = params\.demLat\) \{/)
  assert.match(SRC_MAIN, /extentMeters: empriseBlocM\(\{ zoom, lat \}\),/)
})

test('camera.up NE BASCULE PAS — le plan se trompait, et la ligne est partie', () => {
  // ⚠️ ASSERTION REJOUÉE CONTRE LE DÉPÔT AVANT D'ÊTRE ÉCRITE (§0). Le plan
  // comptait `camera.up.set(0, 1, 0)` parmi les sept gestes de `_dive` — « le
  // repère bascule du géocentrique au local ». Or `enterOrbit` écrivait la MÊME
  // ligne : les deux modes ont toujours partagé le même repère vertical, et le
  // geste était un no-op. Il ne reste donc qu'une occurrence dans modes.js,
  // celle d'`enterOrbit`.
  const codeModes = SRC_MODES.split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
  assert.equal((codeModes.match(/camera\.up\.set\(0, 1, 0\)/g) ?? []).length, 1, 'une seule, dans enterOrbit')
  assert.equal(corpsDe(SRC_MODES, '  async enterOrbit(entryAltM = null) {').includes('camera.up.set(0, 1, 0)'), true)
})

test('UN SEUL SITE écrit minDistance, et le plancher orbital est parti', () => {
  // ⚠️ ILS ÉTAIENT QUATRE : `enterOrbit`, `_dive`, `_loadDive` et `main.js`.
  const butees = corpsDe(SRC_MODES, '  _poseButees(mode) {')
  assert.match(butees, /c\.minDistance = distanceMinOrbitale\(\{ rayonGlobe: R_GLOBE, metresParUnite: ORBITAL_M_PER_UNIT \}\)/)
  assert.match(butees, /c\.minDistance = DISTANCE_MIN_SURFACE/)
  // aucune écriture de minDistance ailleurs dans modes.js
  const ecritures = SRC_MODES.split('\n').filter((l) => /^\s*(this\.controls|c)\.minDistance\s*=/.test(l))
  assert.equal(ecritures.length, 2, `écritures de minDistance hors _poseButees : ${ecritures.join(' | ')}`)
  assert.equal((SRC_MODES.match(/this\._poseButees\(/g) ?? []).length, 3, 'les trois appelants')
  // le quatrième site — main.js — ne recopie plus la valeur non plus
  assert.match(SRC_MAIN, /controls\.minDistance = DISTANCE_MIN_SURFACE/)
  assert.equal(SRC_MAIN.includes('controls.minDistance = 6'), false)

  // ⚠️ LE PLANCHER ORBITAL, ET IL Y EN AVAIT DEUX.
  assert.equal(ALT_PLANCHER_ORBITALE_M, 0)
  assert.equal(distanceMinOrbitale({ rayonGlobe: R_GLOBE, metresParUnite: ORBITAL_M_PER_UNIT }), R_GLOBE)
  assert.equal(SRC_MODES.includes('DIVE_ALT_M * 0.85'), false, 'le plancher que le plan nommait')
  assert.equal(SRC_MODES.includes('(DIVE_ALT_M * 0.9)'), false, 'le SECOND plancher, que le plan ne nommait pas')
  assert.match(SRC_MODES, /const ORB_ALT_MIN = ALT_PLANCHER_ORBITALE_M \/ ORBITAL_M_PER_UNIT/)
  assert.equal((SRC_MODES.match(/^\s+ORB_ALT_MIN,/gm) ?? []).length, 2, '_zoomGesture ET _orbitNotch')
})

test('le plan de coupe proche est UNE loi, appelée par les deux modes', () => {
  assert.equal(planProche(96.97), NEAR_MAX, 'en surface la loi SATURE — d’où la constante 0,5 d’avant')
  assert.ok(Math.abs(planProche(7200 / ORBITAL_M_PER_UNIT) - 0.0226024) < 1e-6, 'et elle mord en orbite basse')
  assert.match(SRC_MODES, /const near = planProche\(this\.orbAlt\)/, 'le mode orbital')
  assert.match(SRC_MODES, /planProche\(this\.camera\.position\.y - this\._solSous\(arrival\.target\)\)/, 'le mode surface')
  // ⚠️ ET CE N'EST PLUS UNE RESTAURATION : `_surfCam.near` n'est plus reposé.
  // main.js documente le défaut que cela entraînait (le cadrage du damier
  // desserrait `near` à ≈122, `enterOrbit` le photographiait, et le retour de
  // plongée tranchait la moitié proche de la carte). Une valeur DÉDUITE ne peut
  // pas transporter l'emprunt d'un autre.
  assert.equal(SRC_MODES.includes('this.camera.near = this._surfCam.near'), false)
})

test('LE TROISIÈME APPELANT DE chargeRacines EST POSÉ — le piège silencieux', () => {
  // ⚠️ `globe.chargeRacines()` n'avait que DEUX appelants et les deux sont
  // condamnés : `hideLoading` (Tâche 2) et `globe.setVisible(true)` (la
  // frontière globe/terrain, Étape 2). Les deux partis, les seize tuiles
  // racines ne seraient plus jamais demandées — sans erreur et sans test rouge.
  // Le plan exige que le troisième soit posé AVANT le retrait de l'un des deux,
  // et qu'il soit exigé ICI.
  assert.match(SRC_GLOBE, /if \(v\) this\.chargeRacines\(\)/, 'le filet de setVisible (Étape 2)')
  assert.match(SRC_MAIN, /function assureRacinesGlobe\(\) \{/)
  assert.match(SRC_MAIN, /setTimeout\(assureRacinesGlobe, DELAI_FILET_RACINES_MS\)/)
  assert.match(SRC_MAIN, /const DELAI_FILET_RACINES_MS = 20000/)
  // …et il est HORS de `hideLoading`, sinon il partirait avec lui
  const voile = corpsDe(SRC_MAIN, 'function hideLoading() {', '')
  assert.equal(voile.includes('setTimeout(assureRacinesGlobe'), false, 'le filet mourrait avec le voile')
  assert.match(voile, /assureRacinesGlobe\(\)/, 'le voile reste le chemin normal — c’est le plus rapide')
  // il est idempotent : sans quoi le filet doublerait les 1 401 Ko
  assert.match(SRC_MAIN, /if \(racinesGlobeDemandees\) return/)
})
