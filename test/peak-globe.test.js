// LES SOMMETS SOUS LE MODE SPHÈRE — Tâche R18, paquet (a).
//
// ⛔ **CE QUI EST GARDÉ ICI EST UN COMPORTEMENT, PAS UN TEXTE.** `update()` ne
// se charge pas sous node (elle touche le DOM), et une assertion sur le texte
// source ne prouve rien — ce chantier a vu une mutation survivre à 4 082 tests
// derrière exactement cette protection. La loi a donc été SORTIE de `update()`
// (`pointDuMarqueur`) pour qu'on puisse l'exécuter.
//
// ⚠️ **LE POSEUR DE PAPIER EST L'INTERFACE RÉELLE**, pas une invention du test :
// `{ globe, placer(x, z, y) }` est ce que `monde/sol-globe.js` rend, et ce que
// les rivières et les toponymes consomment déjà.

import test from 'node:test'
import assert from 'node:assert/strict'
import { pointDuMarqueur } from '../src/peaks.js'
import { creerPoseurGlobe, poseurPlat } from '../src/monde/sol-globe.js'
// ⛔ **LE RAYON SE LIT, IL NE SE RECOPIE PAS.** Écrit en dur (6 378 137), le
// test échouait de 4,8e-7 en relatif : `geo.js` ne porte pas la même convention
// de circonférence, et c'est l'écart de 32 m que ce dépôt a déjà documenté.
// Une constante recopiée est une SECONDE loi — la classe de défaut n° 1 ici.
import { EARTH_RADIUS_M } from '../src/geo.js'

const SOMMET = { x: 7, y: 3.25, z: -4 }

test('① SANS POSEUR, le point est celui d’avant, au bit près', () => {
  const p = pointDuMarqueur(SOMMET, { x: 0, z: 0 }, null)
  assert.deepEqual(p, { x: 7, y: 3.25, z: -4 })
})

test('① LE POSEUR PLAT EST L’IDENTITÉ — un poseur fourni ne change rien sur le bloc', () => {
  const plat = poseurPlat(() => 0)
  assert.equal(plat.globe, false)
  const p = pointDuMarqueur(SOMMET, { x: 0, z: 0 }, plat)
  assert.deepEqual(p, { x: 7, y: 3.25, z: -4 })
})

test('② LA FENÊTRE EST RETRANCHÉE AVANT TOUT — mode continu 3×3', () => {
  const p = pointDuMarqueur(SOMMET, { x: 2, z: -1 }, null)
  assert.deepEqual(p, { x: 5, y: 3.25, z: -3 })
  // et le poseur reçoit bien les coordonnées DÉCALÉES, pas les brutes
  const vus = []
  const espion = { globe: true, placer: (x, z, y) => { vus.push([x, z, y]); return { x: 0, y: 0, z: 0 } } }
  pointDuMarqueur(SOMMET, { x: 2, z: -1 }, espion)
  assert.deepEqual(vus, [[5, -3, 3.25]],
    'le poseur reçoit les coordonnées de CHAMP : le sommet se poserait au sol d’un autre endroit')
})

test('③ AVEC LE POSEUR DU GLOBE, le point QUITTE l’espace du bloc et atterrit sur la sphère', () => {
  // un poseur de globe VRAI, construit comme `poseurPourReconstruction` le fait :
  // sol à 1 000 m partout, emprise de 30 km, exagération 2.
  const R = 100 // rayon de scène du poseur de test
  const poseur = creerPoseurGlobe({
    sample: () => 0,
    hauteurM: () => 1000,
    versLatLon: () => ({ lat: 0, lon: 0 }),
    echelleBloc: (56 / 30000) * 2,
    meanM: 500,
    exagerationGlobe: 2,
    rayon: R,
  })
  assert.equal(poseur.globe, true)
  const p = pointDuMarqueur(SOMMET, { x: 0, z: 0 }, poseur)
  // ⚠️ **LA PREUVE N'EST PAS « c'est différent », C'EST LA NORME.** À lat 0 /
  // lon 0, le point tombe sur l'axe, à une distance du centre égale au rayon
  // plus la hauteur convertie. C'est ça, « quitter l'espace du bloc ».
  const norme = Math.hypot(p.x, p.y, p.z)
  const metres = poseur.metresDe(SOMMET.y)
  const attendu = R + metres * ((R / EARTH_RADIUS_M) * 2)
  assert.ok(Math.abs(norme - attendu) < 1e-9,
    `le sommet n’est pas posé sur la sphère : ${norme} au lieu de ${attendu}`)
  // ⛔ et il n'est PAS resté sur ses coordonnées de bloc
  assert.ok(Math.abs(p.x - SOMMET.x) > 1, 'le point est resté en coordonnées de bloc')
})

test('④ LA HAUTEUR TRAVERSE LES DEUX SENS SANS FACTEUR INVENTÉ', () => {
  // ⚠️ la classe de défaut la plus fréquente de ce chantier est la conversion
  // d'unité — SEPT occurrences. On vérifie donc l'aller-retour, pas la formule.
  const poseur = creerPoseurGlobe({
    sample: () => 0,
    hauteurM: () => 2400,
    versLatLon: (x, z) => ({ lat: x * 0.001, lon: z * 0.001 }),
    echelleBloc: (56 / 30000) * 2,
    meanM: 500,
    exagerationGlobe: 2,
    rayon: 100,
  })
  const yBloc = poseur.blocDe(2400)
  assert.ok(Math.abs(poseur.metresDe(yBloc) - 2400) < 1e-9, 'l’aller-retour mètres ↔ bloc ne boucle pas')
  // deux sommets à des hauteurs différentes tombent à des rayons différents,
  // et dans le bon ordre
  const bas = pointDuMarqueur({ x: 0, y: poseur.blocDe(500), z: 0 }, { x: 0, z: 0 }, poseur)
  const haut = pointDuMarqueur({ x: 0, y: poseur.blocDe(3000), z: 0 }, { x: 0, z: 0 }, poseur)
  assert.ok(Math.hypot(haut.x, haut.y, haut.z) > Math.hypot(bas.x, bas.y, bas.z),
    'un sommet plus haut ne sort pas plus loin du centre — le signe de la conversion est inversé')
})
