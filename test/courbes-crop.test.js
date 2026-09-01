// LES COURBES DE NIVEAU SUR LES TERRES DU CROP — Tâche R19.
//
// ══════════ LE DÉFAUT QUE CE FICHIER GRAVE ═════════════════════════════════
//
// ⛔ **LA COURBE MEURT SUR `minFade`, ET SUR RIEN D'AUTRE.** Sonde de nuanceur
// (`scripts/diag-r19-sonde.mjs` — une valeur de sortie FORCÉE à chaque étage,
// relue par `readPixels` sur une passe brute de `sceneGlobe`, hors composeur) :
//
//     étage sondé          TERRE du crop (moyenne / max, sur 255)
//     minor                12,26 / 255      ← les bandes EXISTENT
//     crowd               250,21 / 255      ← ne coupe rien (0,98)
//     minFade               3,57 /  43      ← **0,014 en moyenne, 0,17 au mieux**
//     contour               0,14 /  41      ← ce qui reste : rien
//
// La cause est arithmétique : sous le crop, la loi de monde rend
// `texel = mppEcran / uResRefM` ≈ **3,0** (mesuré : `texel × 0,2` = 153/255),
// et `clamp(1,6 − 3,0 × 0,55)` vaut **zéro**. Le crop vit sous 40,3 km ; à cette
// distance, avec `uResRefM` = la résolution du zoom 13 (17,81 m à La Réunion),
// le fondu de minification est éteint sur PRESQUE TOUTE la plage de vie du bloc.
// La garde est juste pour la planète nue — elle est fausse pour le bloc.
//
// ⚡ **ET LE SOCLE EST LE MODÈLE, TERME À TERME** (`terrain.js`, bloc
// « contour lines ») : même `1.4 × uContourWeight`, même `0.55` sur le mineur,
// même `clamp(1 − dch × 0.22)` de foule — **et AUCUN `minFade`.** Le seul terme
// que le globe ajoute est celui qui éteint tout.
//
// ⛔ **CE QUE R18 A RÉELLEMENT FAIT, ET POURQUOI IL A CONCLU DE TRAVERS.**
// `uMppFacteur = 0` ne neutralise pas `minFade` : il fait BASCULER DE BRANCHE
// (`texel = uMppFacteur > 0.0 ? texelMonde : texelTuile`). Mesuré au banc de
// R18 lui-même (condensé 256 × 160, mouvement ambiant coupé, plancher 0,0000) :
//
//     opacité 0 → 1, tel quel                       moy 0,0146 · grad 0,0278
//     opacité 0 → 1, `uMppFacteur = 0` (essai R18)  moy 0,1490 · grad 0,2468
//     opacité 0 → 1, `minFade` VRAIMENT à 1         moy 0,5113 · grad 0,7017
//
// Même son essai ramenait les courbes AU-DESSUS du seuil de lisibilité ; il n'en
// avait pris qu'une capture, jamais une mesure.
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① `minFade` NE S'APPLIQUE PLUS DANS LE CROP — l'expression est prise AU
//      TEXTE dans le GLSL, traduite et APPELÉE, aux valeurs MESURÉES à l'écran.
//   ② L'ÉTEINT EST L'ANCIEN — hors crop (`dedansCrop = 0`), l'expression rend
//      exactement `clamp(1.6 − texel × 0.55, 0, 1)`, la loi du dépôt.
//   ③ LE BORD EST UN FONDU, PAS UNE MARCHE — la couverture douce du crop porte
//      la transition, comme elle porte déjà l'éclairage.
//   ④ LA CHAÎNE DU CONTOUR, EXÉCUTÉE aux valeurs mesurées : elle sort du seuil.
//   ⑤ LA CONVERSION DE L'INTERVALLE EST ÉCRITE, ET VÉRIFIÉE CONTRE UN ORACLE
//      INDÉPENDANT — `echelleBloc` de `loi-altitude.js`, qui est la loi de
//      hauteur du socle et n'a pas été écrite pour cette tâche.
//   ⑥ LE BRANCHEMENT — `main.js` passe bien `contourIntervalM` à la chaîne.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le GPU exécute ce texte et
// que l'image porte des courbes. Seul l'écran le dit — `.banc/R19/`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  COTE_CROP_UNITES,
  PAS_CARTO,
  intervalleCourbes,
  intervalleCourbesBloc,
} from '../src/monde/habillage-crop.js'
import { echelleBloc } from '../src/loi-altitude.js'

const GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const TERRAIN = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')

// ⚠️ **PAS UN GREP DE NOM** — c'est le patron de `test/loi-texture-monde.test.js`
// (④) : on prend le TEXTE du GLSL, on le traduit mécaniquement et on l'APPELLE,
// pour qu'une mutation fasse tomber une VALEUR et non une chaîne.
function affectation(nom, source = GLOBE) {
  const i = source.indexOf(`float ${nom} = `)
  assert.ok(i >= 0, `le nuanceur doit porter « float ${nom} = »`)
  const j = source.indexOf(';', i)
  assert.ok(j > i, `« float ${nom} » sans point-virgule`)
  return source.slice(i + `float ${nom} = `.length, j)
}
function loi(expr, noms) {
  const js = expr
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bmix\s*\(/g, 'MIX(')
    .trim()
  const CLAMP = (v, a, b) => Math.min(b, Math.max(a, v))
  const MIX = (a, b, t) => a * (1 - t) + b * t
  // eslint-disable-next-line no-new-func
  const f = new Function(...noms, 'CLAMP', 'MIX', `return (${js});`)
  return (args) => f(...noms.map((n) => args[n]), CLAMP, MIX)
}

// ⚠️ **LES VALEURS SONT CELLES DE L'ÉCRAN, PAS DES VALEURS CHOISIES.**
// Relevées par `scripts/diag-r19-sonde.mjs` sur le cadrage d'ouverture
// (La Réunion, `demZoom` 12, fov 33, cadre 1280 × 800, `uResRefM` 17,81 m) :
// `texel` moyen 3,00 sur les terres du crop (min 1,78, max 3,61).
const TEXEL_MESURE = 3.0
const CROWD_MESURE = 0.98 // 250,21 / 255

test('① dans le crop, `minFade` ne coupe plus rien — au texel MESURÉ à l’écran', () => {
  const f = loi(affectation('minFade'), ['texel', 'dedansCrop'])
  assert.equal(f({ texel: TEXEL_MESURE, dedansCrop: 1 }), 1,
    'sous le crop, le fondu de minification doit être neutre')
  for (const t of [1.78, 3.0, 3.61, 12]) {
    assert.equal(f({ texel: t, dedansCrop: 1 }), 1, `texel ${t} dans le crop`)
  }
})

test('② hors crop, c’est la loi du DÉPÔT au bit près', () => {
  const f = loi(affectation('minFade'), ['texel', 'dedansCrop'])
  const depot = (texel) => Math.min(1, Math.max(0, 1.6 - texel * 0.55))
  for (const t of [0, 0.4, 1, 1.78, 2.9, 3.0, 3.61, 12]) {
    assert.ok(Object.is(f({ texel: t, dedansCrop: 0 }), depot(t)),
      `texel ${t} hors crop : ${f({ texel: t, dedansCrop: 0 })} ≠ ${depot(t)}`)
  }
})

test('③ le bord du crop est un FONDU, pas une marche', () => {
  const f = loi(affectation('minFade'), ['texel', 'dedansCrop'])
  const a = f({ texel: TEXEL_MESURE, dedansCrop: 0 })
  const b = f({ texel: TEXEL_MESURE, dedansCrop: 1 })
  let precedent = a
  for (const c of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const v = f({ texel: TEXEL_MESURE, dedansCrop: c })
    assert.ok(v >= precedent, `la couverture ${c} ne doit pas faire redescendre le fondu`)
    assert.ok(v >= a && v <= b, `la couverture ${c} doit rester entre les deux bouts`)
    precedent = v
  }
  // et c'est bien la couverture DOUCE du crop qui porte la transition, celle que
  // l'éclairage emploie déjà — pas un second prédicat binaire.
  assert.ok(/minFade[^;]*dedansCrop/s.test(GLOBE), '`minFade` doit lire `dedansCrop`')
})

test('④ la chaîne du contour sort du seuil aux valeurs mesurées', () => {
  const f = loi(affectation('contour'), ['minor', 'minorK', 'major', 'uContourOpacity', 'crowd', 'minFade'])
  // au CENTRE d'une courbe mineure : minor = 1 (mesuré : la sonde rend 255 au max)
  const v = f({ minor: 1, minorK: 0.55, major: 0, uContourOpacity: 1, crowd: CROWD_MESURE, minFade: 1 })
  assert.ok(v > 0.5, `le trait doit peser plus d'un demi-mélange d'encre, il vaut ${v}`)
  // et l'ANCIEN comportement, avec le minFade mesuré, est bien indiscernable
  const mort = f({ minor: 1, minorK: 0.55, major: 0, uContourOpacity: 1, crowd: CROWD_MESURE, minFade: 3.57 / 255 })
  assert.ok(mort < 0.01, `avec le minFade mesuré le trait valait ${mort}`)
})

test('⑤ le globe garde les TROIS constantes de trait du socle, terme à terme', () => {
  // ⚠️ L'oracle est `terrain.js` : si le socle change ses constantes, ce test
  // tombe, et c'est le but — « une seule Terre ».
  assert.ok(/minorLine\s*=\s*1\.0\s*-\s*smoothstep\(0\.0,\s*dch\s*\*\s*1\.4\s*\*\s*uContourWeight/.test(TERRAIN),
    'le socle doit poser 1.4 × uContourWeight')
  assert.ok(/max\(minorLine\s*\*\s*0\.55,\s*majorLine\)/.test(TERRAIN), 'le socle doit poser 0.55 sur le mineur')
  assert.ok(/crowd\s*=\s*clamp\(1\.0\s*-\s*dch\s*\*\s*0\.22/.test(TERRAIN), 'le socle doit poser 0.22 de foule')
  // ⛔ et le socle n'a AUCUN fondu de minification : c'est le terme en trop.
  assert.ok(!/minFade/.test(TERRAIN), 'le socle ne porte pas de `minFade`')
  const poids = affectation('poidsC')
  assert.ok(/1\.4\s*\*\s*uContourWeight/.test(poids), `le globe doit poser 1.4 × uContourWeight, il pose ${poids}`)
})

// ══════════ ⑥ LA CONVERSION DE L'INTERVALLE — LA CLASSE DE DÉFAUT N° 1 ══════
//
// La tirette « Intervalle des courbes » est en UNITÉS DE BLOC (`params.contourInterval`,
// 0,04 → 0,6) ; le globe compare des MÈTRES. Le socle divise `vWorldPos.y` par
// l'intervalle ; le globe divise `h` (mètres). Les deux `ch` sont égaux quand
//
//     intervalleM = valeurBloc / echelleBloc = valeurBloc × extentMeters / (56 × exagération)
//
// et `echelleBloc` (`loi-altitude.js`) est l'ORACLE INDÉPENDANT : c'est la loi
// de hauteur du socle, écrite avant cette tâche et lue par douze appelants.
test('⑥a l’intervalle se convertit par la loi de hauteur du socle, pas par un facteur posé', () => {
  for (const [valeurBloc, extentMeters, exageration] of [
    [0.29, 27403, 2], [0.11, 27403, 2], [0.6, 120000, 1], [0.04, 9000, 3.5],
  ]) {
    const attendu = valeurBloc / echelleBloc({ extentMeters, span: COTE_CROP_UNITES, exageration })
    const rendu = intervalleCourbesBloc({ valeurBloc, extentMeters, exageration })
    assert.ok(Math.abs(rendu - attendu) < 1e-9,
      `${valeurBloc} u → ${rendu} m, attendu ${attendu} m`)
  }
})

test('⑥b une hauteur du socle et la MÊME hauteur en mètres tombent sur la même courbe', () => {
  // c'est la seule chose que la conversion doit garantir : `ch` identique des
  // deux côtés. On l'exerce, on ne la relit pas.
  const extentMeters = 27403, exageration = 2, valeurBloc = 0.29
  const k = echelleBloc({ extentMeters, span: COTE_CROP_UNITES, exageration })
  const intervalleM = intervalleCourbesBloc({ valeurBloc, extentMeters, exageration })
  for (const hM of [0, 137, 812.5, 2584.35, -1200]) {
    const chSocle = (hM * k) / valeurBloc
    const chGlobe = hM / intervalleM
    assert.ok(Math.abs(chSocle - chGlobe) < 1e-9, `h = ${hM} m : ${chSocle} ≠ ${chGlobe}`)
  }
})

test('⑥c les entrées absurdes rendent `null`, jamais un NaN ni un zéro', () => {
  // ⛔ un intervalle nul, c'est `h / 0` dans le nuanceur — le §« écrêtage de
  // Mercator » de `globe.js` dit où mène un NaN : une comparaison FAUSSE.
  for (const args of [
    { valeurBloc: 0, extentMeters: 27403, exageration: 2 },
    { valeurBloc: 0.29, extentMeters: 0, exageration: 2 },
    { valeurBloc: 0.29, extentMeters: 27403, exageration: 0 },
    { valeurBloc: NaN, extentMeters: 27403, exageration: 2 },
    {},
  ]) {
    assert.equal(intervalleCourbesBloc(args), null, JSON.stringify(args))
  }
})

test('⑥d la calibration automatique reste le REPLI, et elle n’a pas bougé', () => {
  // `intervalleCourbes` est la loi de la Tâche C : elle reste la valeur posée
  // quand la tirette ne dit rien. Ce test est là pour qu'on ne la perde pas en
  // branchant la tirette.
  assert.equal(intervalleCourbes(4681), 250)
  assert.ok(PAS_CARTO.includes(intervalleCourbes(800)))
  assert.ok(/if \(contourIntervalM > 0\)/.test(GLOBE), '`poserHabillage` doit préférer la tirette')
  assert.ok(/else if \(amplitudeM > 0\)/.test(GLOBE), '… et retomber sur l’amplitude')
})

test('⑥e le BRANCHEMENT — `contexteCrop` porte l’intervalle converti', () => {
  // ⚠️ Aucun test de ce dépôt ne charge `main.js` : on vérifie le TEXTE, comme
  // `test/loi-texture-monde.test.js` (⑥) le fait pour `poserLoiMonde`.
  assert.ok(/contourIntervalM:/.test(MAIN), '`contexteCrop` doit passer `contourIntervalM`')
  assert.ok(/intervalleCourbesBloc/.test(MAIN), 'et il doit passer par la conversion écrite')
  assert.ok(/'contourIntervalM'/.test(readFileSync(new URL('../src/monde/branchement-crop.js', import.meta.url), 'utf8')),
    'le pont doit transporter le champ')
})
