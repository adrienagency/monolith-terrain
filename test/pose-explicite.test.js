import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  REGIME_SURFACE, temoinPoseExplicite, armerPoseExplicite, reprisePoseParLaMachine, doitRedresserHerite, retourNadirPermis,
} from '../src/monde/pose-explicite.js'
import { REGIME } from '../src/monde/gestes-terre.js'

// ══════════ CE QUE CE FICHIER EMPÊCHE DE REVENIR — tâche CAM, 2026-09-05 ═══
//
// > **Adrien :** *« la caméra avec le toggle en bouton en bas à droite, quand je
// > clique dessus, les positions 1, 2, 3, 4 se mettent au bon endroit, puis
// > reviennent automatiquement en arrière. »*
//
// Mesuré au clic réel (`.banc/CAM/`, Chrome sans tête, La Réunion z10) : la vue
// iso est atteinte à l'image 104, puis la caméra repart vers le nadir dans la
// même seconde — 145,5 → 74,2 unités, 59,3° → 0°. Les nombres ci-dessous sont
// ceux de ce relevé.

// le cas INHÉRITÉ de GE2 tour 2 : hors du crop, incliné par le vol de présentation
const HERITE = { regime: REGIME.SURFACE, inclinaisonManuelle: false, poseExplicite: false, pilote: false, auBloc: false, polarDeg: 54.3 }

test('CAM ① — la vue iso choisie au bouton N’EST PAS une inclinaison héritée : D16 ter ne la redresse pas', () => {
  // l'état exact relevé après le vol : hors du crop, 59,3° d'angle polaire,
  // aucun pilote — avant le correctif, `redresserSiHerite` armait le retour au nadir
  assert.equal(doitRedresserHerite({ ...HERITE, polarDeg: 59.3, poseExplicite: true }), false)
  // et le témoin seul suffit, quelle que soit l'inclinaison
  for (const polarDeg of [1.5, 30, 59.3, 80.7]) assert.equal(doitRedresserHerite({ ...HERITE, polarDeg, poseExplicite: true }), false, `${polarDeg}°`)
})

test('CAM ② — le redressement de GE2 tour 2 TIENT sans choix explicite (D16 ter, non-régression)', () => {
  // le défaut bimodal −50°/−69° de GE2 : l'inclinaison du vol de présentation
  // restée posée hors du crop DOIT toujours être redressée
  assert.equal(doitRedresserHerite(HERITE), true)
  // …et chacune des gardes d'origine coupe encore
  assert.equal(doitRedresserHerite({ ...HERITE, regime: REGIME.CROP }), false, 'sur le crop, la machine pose')
  assert.equal(doitRedresserHerite({ ...HERITE, regime: REGIME.ORBITE }), false, 'en orbite aussi')
  assert.equal(doitRedresserHerite({ ...HERITE, regime: null }), false, 'régime hérité (pas de frontière)')
  assert.equal(doitRedresserHerite({ ...HERITE, inclinaisonManuelle: true }), false, 'inclinée à la main')
  assert.equal(doitRedresserHerite({ ...HERITE, pilote: true }), false, 'un autre pilote tient la caméra')
  assert.equal(doitRedresserHerite({ ...HERITE, auBloc: true }), false, 'au bloc (D21 ② : auBloc, pas pose)')
  assert.equal(doitRedresserHerite({ ...HERITE, polarDeg: 1 }), false, 'déjà au nadir (seuil 1°)')
  assert.equal(doitRedresserHerite({ ...HERITE, polarDeg: 1.01 }), true, 'juste au-dessus du seuil')
  assert.equal(doitRedresserHerite({ ...HERITE, polarDeg: NaN }), false, 'un angle absent ne redresse pas')
  assert.equal(REGIME_SURFACE, REGIME.SURFACE, 'le module pur répète la chaîne de gestes-terre.js — elles doivent rester égales')
})

test('CAM ③ — le témoin se pose au vol, TIENT après lui, et tombe quand la machine reprend (crop, orbite)', () => {
  const t = temoinPoseExplicite()
  assert.equal(t.posee, false)
  armerPoseExplicite(t)
  assert.equal(t.posee, true)
  // après le vol, hors du crop : la pose tient — image après image
  for (let i = 0; i < 300; i++) assert.equal(reprisePoseParLaMachine(t, { regime: REGIME.SURFACE, volExplicite: false }), false)
  assert.equal(t.posee, true, 'la vue iso 2 tient 5 s hors du crop')
  // la machine reprend : crop (bascule de trois quarts) …
  assert.equal(reprisePoseParLaMachine(t, { regime: REGIME.CROP, volExplicite: false }), true)
  assert.equal(t.posee, false)
  assert.equal(t.reprises, 1)
  // … ou orbite (enterOrbit pose au nadir)
  armerPoseExplicite(t)
  assert.equal(reprisePoseParLaMachine(t, { regime: REGIME.ORBITE, volExplicite: false }), true)
  assert.equal(t.posee, false)
  // un témoin déjà tombé ne retombe pas deux fois
  assert.equal(reprisePoseParLaMachine(t, { regime: REGIME.CROP, volExplicite: false }), false)
  assert.equal(t.reprises, 2)
  // et sans témoin, rien ne casse
  assert.equal(reprisePoseParLaMachine(null, { regime: REGIME.CROP }), false)
  armerPoseExplicite(null)
})

test('CAM ④ — PENDANT le vol, traverser le crop ne reprend PAS le témoin (le vol iso part du crop)', () => {
  // Relevé : le vol iso 1 part de 4,6 km (crop) et sort du bloc vers 40 km — ses
  // premières images sont en régime crop. Une reprise à ce moment-là rendrait le
  // témoin AVANT l'arrivée : le défaut, une image plus tard.
  const t = temoinPoseExplicite()
  armerPoseExplicite(t)
  for (const regime of [REGIME.CROP, null, REGIME.ORBITE, REGIME.SURFACE]) {
    assert.equal(reprisePoseParLaMachine(t, { regime, volExplicite: true }), false, `régime ${regime} pendant le vol`)
    assert.equal(t.posee, true)
  }
  assert.equal(t.reprises, 0)
})

test('CAM ⑤ — quitter le bloc pendant un vol demandé ne rend pas le nadir ; à la molette, si', () => {
  // le clic 1 du relevé : le balayage « quitter le bloc rend la vue au nadir »
  // s'armait pendant le vol et gagnait (il écrit après le tween dans la même
  // image) — la vue 1 filait droit au gros plan
  assert.equal(retourNadirPermis({ volExplicite: true }), false)
  // D16 ter symétrique reste entière hors d'un vol : l'utilisateur qui dézoome
  // à la molette hors du bloc retrouve le nadir
  assert.equal(retourNadirPermis({ volExplicite: false }), true)
  assert.equal(retourNadirPermis({}), true)
})

test('CAM ⑥ — le câblage de main.js passe bien par le module pur, aux trois endroits', () => {
  // Un test pur ne prouve rien si main.js ne l'appelle pas : on lit le fichier.
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(src, /flyTo\(pos, v\.target\.clone\(\), \{ orbit: true, explicite: true \}\)/, 'applyIsoView déclare le vol explicite')
  assert.match(src, /poseExplicite: temoinPose\.posee/, 'redresserSiHerite consulte le témoin')
  assert.match(src, /reprisePoseParLaMachine\(temoinPose, \{ regime, volExplicite: volExplicite\(\) \}\)/, 'la reprise est jugée chaque image, avec l’état du vol')
  assert.match(src, /if \(modes\._fonduPose && !retourNadirPermis\(\{ volExplicite: volExplicite\(\) \}\)\) modes\._fonduPose = null/, 'le front descendant est rendu pendant le vol')
  assert.match(src, /if \(modes\?\._fonduPose\) modes\._fonduPose = null/, 'flyTo explicite rend un balayage déjà armé')
})
