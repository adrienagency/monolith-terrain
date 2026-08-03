// LE PLAFOND D'UNITÉS DE TEXTURE — le défaut du 2026-08-03, en tests.
//
// CE QUI S'EST PASSÉ. Adrien charge le gabarit « java », qui pose fabric062 en
// matière de surface. Le terrain disparaît : plus de relief du tout, juste les
// étiquettes flottant sur le fond. En console :
//
//   THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false
//   FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)
//
// LE COMPTE, mesuré dans le navigateur :
//   12 samplers du nuanceur de carte  (rampe, mer, côte, analyse, région, ombre
//                                      de nuages, photo, nuit, sol + sa table,
//                                      canopée + sa table)
//  + 4 du matériau de surface          (map, normalMap, roughnessMap, bumpMap)
//  + 1 environnement + 1 carte d'ombre
//  = 18, pour 16 disponibles.
//
// ⚠️ ET LE PIÈGE EST QUE LES COUCHES ÉTAIENT ÉTEINTES. Un `if (uSolOn > 0.5)`
// ne supprime pas le sampler : le compilateur ne connaît la valeur d'un uniform
// qu'à l'exécution. Une couche au repos payait donc son unité comme une couche
// allumée — et le budget du Gardien, qui compte des mégaoctets, ne voyait rien.
//
// Les deux parades, verrouillées ici :
//   1. les samplers des couches Sol et Canopée sont derrière un #ifdef, donc
//      absents du programme quand la couche est éteinte ;
//   2. une carte de normales chasse la carte de bosselage procédurale, qui
//      décrivait de toute façon le même relief de surface en double.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')

// Les samplers du nuanceur de carte qui doivent DISPARAÎTRE à la compilation
// quand leur couche est éteinte, et la garde qui les entoure.
const GATÉS = [
  ['uSol', 'SHIBU_SOL'],
  ['uSolLut', 'SHIBU_SOL'],
  ['uCanopee', 'SHIBU_CANOPEE'],
  ['uCanopeeLut', 'SHIBU_CANOPEE'],
]

// Extrait le bloc #ifdef <garde> … #endif qui contient une position donnée.
function sousGarde(texte, indice, garde) {
  const avant = texte.slice(0, indice)
  const ouvre = avant.lastIndexOf(`#ifdef ${garde}`)
  if (ouvre < 0) return false
  const ferme = avant.indexOf('#endif', ouvre)
  return ferme < 0 // aucun #endif entre l'ouverture et nous → on est dedans
}

for (const [nom, garde] of GATÉS) {
  test(`le sampler ${nom} est déclaré sous ${garde}, sinon il coûte une unité même éteint`, () => {
    const i = src.indexOf(`uniform sampler2D ${nom};`)
    assert.ok(i > 0, `déclaration de ${nom} introuvable`)
    assert.ok(sousGarde(src, i, garde), `${nom} déclaré HORS de #ifdef ${garde} : le plafond revient`)
  })

  test(`chaque lecture de ${nom} est elle aussi sous ${garde}`, () => {
    // Une lecture laissée dehors ne compilerait tout simplement plus une fois la
    // déclaration retirée — mais elle casserait en SILENCE côté build, et ne se
    // verrait qu'au premier utilisateur qui éteint la couche.
    const re = new RegExp(`texture2D\\(\\s*${nom}\\b`, 'g')
    let m
    let vues = 0
    while ((m = re.exec(src))) {
      vues++
      assert.ok(sousGarde(src, m.index, garde), `lecture de ${nom} à l'offset ${m.index} hors de #ifdef ${garde}`)
    }
    assert.ok(vues > 0, `aucune lecture de ${nom} : le test ne prouve plus rien`)
  })
}

test('les gardes ne débordent pas : autant de #ifdef que de #endif', () => {
  for (const garde of ['SHIBU_SOL', 'SHIBU_CANOPEE']) {
    const ouv = (src.match(new RegExp(`#ifdef ${garde}`, 'g')) || []).length
    assert.ok(ouv >= 3, `${garde} : ${ouv} ouverture(s), on en attend au moins 3 (uniformes, fonctions, corps)`)
  }
  // ⚠️ ON COMPTE TOUTES LES OUVERTURES, pas seulement les nôtres. La version
  // d'avant ne comptait que `#ifdef SHIBU_`, et le premier `#if NUM_DIR_LIGHTS`
  // ajouté au nuanceur (la diffusion sous-surfacique de la matière) l'a fait
  // tomber alors que rien n'était déséquilibré. Un compteur qui n'aligne pas ses
  // deux moitiés sur la même règle finit toujours par crier à tort.
  // …et SEULEMENT en début de ligne, comme le préprocesseur GLSL l'exige. Sans
  // l'ancre, le pavé d'explication qui écrit « derrière un #ifdef » en toutes
  // lettres comptait pour une ouverture, et le test criait sur de la prose.
  const ouvertures = (src.match(/^[ \t]*#if(def|ndef)?\b/gm) || []).length
  const endifs = (src.match(/^[ \t]*#endif/gm) || []).length
  assert.equal(ouvertures, endifs, `${ouvertures} ouvertures pour ${endifs} #endif : un bloc n'est pas refermé`)
})

test('allumer une couche pose son define, l’éteindre le retire — et rien d’autre ne recompile', () => {
  // _gateCouche est le seul endroit qui touche `defines`. Le test lit son
  // contrat : sortie ANTICIPÉE quand rien ne change. Sans ça, chaque
  // rafraîchissement de mosaïque (il y en a un par déplacement) relèverait
  // needsUpdate et le damier recompilerait ses programmes en plein mouvement.
  const i = src.indexOf('_gateCouche(nom, on) {')
  assert.ok(i > 0, '_gateCouche introuvable')
  const corps = src.slice(i, src.indexOf('\n  }', i))
  assert.ok(/if \(avant === !!on\) return/.test(corps), 'pas de sortie anticipée : recompilation à chaque rafraîchissement')
  assert.ok(/needsUpdate = true/.test(corps), 'sans needsUpdate, le define ne prend jamais effet')
})

test('une carte de normales chasse la carte de bosselage procédurale', () => {
  // Les deux décrivent le même relief de surface. Trois raisons de n'en garder
  // qu'une : le bruit répété quatre fois brouillait le grain de la matière
  // chargée, three applique bel et bien les deux perturbations, et c'est
  // l'unité de texture qui faisait passer java de 17 à 18.
  assert.ok(/if \(m\.normalMap\) m\.bumpMap = null/.test(src), 'le bosselage procédural survit sous la matière de surface')
  // ⚠️ DÉTACHER, PAS LIBÉRER : les dalles voisines recopient la référence.
  assert.ok(!/if \(m\.normalMap && m\.bumpMap\)[\s\S]{0,120}dispose\(\)/.test(src), 'texture libérée alors que le damier la partage')
})
