// LA GÉOMÉTRIE DU TRACÉ ATTERRIT-ELLE SUR LE GLOBE ? — la garde de la Tâche GX2,
// et la seule des huit qui touche **ce qui porte les pixels**.
//
// ⚠️ **POURQUOI CE FICHIER EXISTE.** L'auteur des sept tests rouges de GX1 le dit
// lui-même : ils gardent le CÂBLAGE, pas les pixels. Il l'a mesuré — un correctif
// simulé (adopter `sceneGlobe`, poser `setCamera`) les rend **tous verts en
// laissant 0 pixel à l'écran** :
//
//   > pixels de tracé : 0 0 0 …   attendus 2 019
//
// La raison est chiffrée : le ruban est cuit en coordonnées de BLOC
// (`latLonToWorld`, demi-emprise 28 unités autour de l'origine) et le crop est
// une découpe de la sphère `R_GLOBE = 100` posée à ~100 unités de l'origine.
//
//   | espace | mètres par unité |
//   |---|---|
//   | bloc  | **727,6** (Mont-Blanc), 190,0 (Camargue), 91,0 (Chamonix) |
//   | globe | **63 710,1** (`ORBITAL_M_PER_UNIT`) |
//
// ➡️ **facteur 87,56 à ce cadrage — et 335 et 700 aux deux autres : il dépend du
// zoom.** Un tracé reparenté sans similitude tombe à ≈ 6 371 km du crop.
//
// Ce test-ci EXÉCUTE donc la conversion sur de vrais sommets et vérifie qu'ils
// finissent SUR LA SPHÈRE. Un correctif de câblage seul le laisse rouge.

import test from 'node:test'
import assert from 'node:assert/strict'
import { creerPoseurGlobe, poseurPlat, poseTableauEnPlace } from '../src/monde/sol-globe.js'
import { R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'

// Un bloc de 56 unités pour 40 768 m d'emprise : 727,6 m par unité — le cadrage
// exact du Mont-Blanc mesuré au banc.
const EXTENT = 56 * 727.6
const ECHELLE_BLOC = 56 / EXTENT // unités de bloc par mètre
const MEAN_M = 1500

// un « globe » minimal : sol plat à 1 500 m, la loi de nœud n'est pas le sujet
const poseurDeTest = () => creerPoseurGlobe({
  sample: () => 0,
  hauteurM: () => MEAN_M,
  // la réciproque de la projection du calque, ici une carte plate simple
  // (46° N, 6,9° E au centre — Chamonix) : ce test garde l'ÉCHELLE et l'ESPACE,
  // pas la projection, qui a sa propre garde (aller-retour 0,00 m au banc).
  versLatLon: (x, z) => ({ lat: 45.92 - (z / 56) * 0.37, lon: 6.87 + (x / 56) * 0.53 }),
  echelleBloc: ECHELLE_BLOC,
  meanM: MEAN_M,
  exagerationGlobe: 1,
})

const rayon = (p, i) => Math.hypot(p[i], p[i + 1], p[i + 2])

test('① les sommets du ruban quittent l’espace du BLOC et tombent sur la sphère', () => {
  const poseur = poseurDeTest()
  // quatre sommets répartis dans le bloc, à la hauteur du sol (y = 0 en bloc,
  // c'est-à-dire l'altitude MOYENNE de l'emprise — le zéro du bloc n'est pas la
  // mer, voir sol-globe.js)
  const positions = [0, 0, 0, 20, 0, -18, -25, 0, 24, 12, 0, 12]
  const avant = [...positions]
  poseTableauEnPlace(positions, poseur)

  for (let i = 0; i < positions.length; i += 3) {
    const r = rayon(positions, i)
    // ⛔ un correctif qui n'aurait fait qu'adopter la scène laisserait ces
    // sommets à moins de 40 unités de l'origine — à ~6 371 km du crop.
    assert.ok(r > R_GLOBE * 0.9,
      `le sommet ${i / 3} est resté en coordonnées de bloc (rayon ${r.toFixed(2)} au lieu de ~${R_GLOBE}) : ` +
      'la similitude bloc → globe n’est pas appliquée, le tracé ne peut pas tomber sur le crop')
    // il est SUR la surface dessinée : R_GLOBE + hauteur × échelle du globe
    const attendu = R_GLOBE + MEAN_M * (R_GLOBE / EARTH_RADIUS_M)
    assert.ok(Math.abs(r - attendu) < 1e-6,
      `le sommet ${i / 3} n’est pas à la hauteur dessinée (${r} au lieu de ${attendu})`)
  }
  assert.notDeepEqual(positions, avant, 'aucun sommet n’a bougé')
})

test('② le facteur de la similitude est celui du globe, et il DÉPEND DU ZOOM', () => {
  // 87,56 au Mont-Blanc, 335 en Camargue, 700 à Chamonix : le rapport n'est pas
  // une constante, il se relit à chaque reconstruction. Un `k` écrit en dur
  // serait juste à un cadrage et faux aux deux autres.
  const k = (mParUnite) => 1 / creerPoseurGlobe({
    sample: () => 0, hauteurM: () => 0,
    versLatLon: () => ({ lat: 45.92, lon: 6.87 }),
    echelleBloc: 56 / (56 * mParUnite), meanM: 0,
  }).rapportSimilitude()
  assert.ok(Math.abs(k(727.6) - EARTH_RADIUS_M / R_GLOBE / 727.6) < 1e-9)
  assert.ok(Math.abs(k(727.6) - 87.56) < 0.05, `attendu ≈ 87,56 au Mont-Blanc, obtenu ${k(727.6).toFixed(2)}`)
  assert.ok(Math.abs(k(190.0) - 335.3) < 0.5, `attendu ≈ 335 en Camargue, obtenu ${k(190.0).toFixed(1)}`)
  assert.ok(Math.abs(k(91.0) - 700.1) < 0.5, `attendu ≈ 700 à Chamonix, obtenu ${k(91.0).toFixed(1)}`)
})

test('③ hors globe, la conversion est l’IDENTITÉ — `?terre=deux` ne bouge pas d’un flottant', () => {
  // La régression symétrique, et elle a déjà été payée une fois : la fusion des
  // passes appliquée au mauvais régime avait fait disparaître le bloc à
  // 17,80 dB de PSNR. Sous `?terre=deux` la passe de surface dessine ENCORE le
  // bloc, et la géométrie du tracé doit y rester exactement ce qu'elle était.
  const positions = [0, 1, 2, 3, 4, 5, -6, -7, -8]
  const avant = [...positions]
  poseTableauEnPlace(positions, poseurPlat(() => 0))
  assert.deepEqual(positions, avant)
  poseTableauEnPlace(positions, null)
  assert.deepEqual(positions, avant)
})
