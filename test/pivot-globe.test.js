// LE MÉCANISME, EN ESPACE GLOBE — Tâche R32, d'après le test ⑤ de l'attaquant R33.
//
// R33 avait posé un test « rouge » qui transportait la rotation POLAIRE
// d'OrbitControls par la similitude `poseFond` et mesurait l'axe instantané
// de rotation de la caméra qui rend : **à la surface**, pas au centre de la
// Terre. Son en-tête disait : *« il restera rouge tant que la caméra qui rend
// tournera autour de la cible de bloc, et devra être réécrit contre le nouveau
// mécanisme »*. Le voici, réécrit contre le nouveau mécanisme.
//
// Hors du crop, le glissé n'est plus une rotation d'OrbitControls autour de la
// cible : c'est une TRANSLATION rigide de la caméra et de la cible dans le plan
// du bloc (`main.js`, « on attrape la Terre »), transportée par la MÊME
// similitude — ancrée sur l'aplomb de la cible. Ce que ça donne en espace
// globe se calcule ici, sans navigateur : une rotation autour du centre de la
// Terre, à altitude constante, nord en haut.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { poseFond } from '../src/monde/frontiere-rendu.js'
import { EARTH_RADIUS_M, ORBITAL_M_PER_UNIT, R_GLOBE, latLonVersMondeEmprise, mondeVersLatLonEmprise } from '../src/geo.js'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { latLonDe } from '../src/monde/saisie-terre.js'

const km = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' km'
const MAIN = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// un bloc z9 à La Réunion (emprise ≈ 219 km), la caméra au nadir à 130 km de fond
const emprise = { ouest: 54.5, est: 56.5, sud: -22.2, nord: -20.3 }
const extentMeters = 219000
function poseDuBloc({ tx, tz, camY }) {
  const cam = new THREE.PerspectiveCamera(33, 1.6, 0.1, 1000)
  cam.position.set(tx, camY, tz)
  cam.up.set(0, 1, 0)
  cam.lookAt(tx, Y_CIBLE, tz + 1e-6) // le nadir, avec l'infime décalage qu'OrbitControls (EPS) laisse
  cam.updateMatrixWorld()
  const ancre = mondeVersLatLonEmprise(emprise, tx, tz, TERRAIN_SIZE)
  const pose = poseFond({
    lat: ancre.lat, lon: ancre.lon, origineBloc: [tx, 0, tz],
    positionBloc: cam.position.toArray(), quaternionBloc: cam.quaternion.toArray(),
    extentMeters, span: TERRAIN_SIZE,
  })
  return { p: new THREE.Vector3(...pose.position), q: new THREE.Quaternion(...pose.quaternion) }
}
// la distance du centre de la Terre à l'axe hélicoïdal du déplacement rigide a → b (R33)
function distanceAxeM(a, b) {
  const dR = b.q.clone().multiply(a.q.clone().invert())
  if (dR.w < 0) { dR.x *= -1; dR.y *= -1; dR.z *= -1; dR.w *= -1 }
  const theta = 2 * Math.acos(Math.min(1, dR.w))
  const axe = new THREE.Vector3(dR.x, dR.y, dR.z).normalize()
  const t = b.p.clone().sub(a.p.clone().applyQuaternion(dR))
  const tp = t.clone().addScaledVector(axe, -t.dot(axe))
  const c = tp.clone().multiplyScalar(0.5).addScaledVector(axe.clone().cross(tp), 0.5 / Math.tan(theta / 2))
  return c.length() * ORBITAL_M_PER_UNIT
}

test('① une translation rigide caméra + cible dans le bloc, transportée par `poseFond`, tourne autour du CENTRE de la Terre (< 100 km)', () => {
  const camY = 33
  const a = poseDuBloc({ tx: 0, tz: 0, camY })
  // un glissé d'un degré de longitude vers l'est, en unités de bloc
  const A = mondeVersLatLonEmprise(emprise, 0, 0, TERRAIN_SIZE)
  const w = latLonVersMondeEmprise(emprise, A.lat, A.lon + 1, TERRAIN_SIZE)
  const b = poseDuBloc({ tx: w.x, tz: w.z, camY })
  const dist = distanceAxeM(a, b)
  assert.ok(dist < 100000, `l’axe de rotation transporté est à ${km(dist)} du centre de la Terre (rayon : ${km(EARTH_RADIUS_M)})`)
  // à altitude constante : la caméra qui rend garde son rayon
  assert.ok(Math.abs(a.p.length() - b.p.length()) * ORBITAL_M_PER_UNIT < 50, `l’altitude a changé de ${Math.abs(a.p.length() - b.p.length()) * ORBITAL_M_PER_UNIT} m`)
})

test('① bis …et le point sous la caméra SE DÉPLACE d’autant : c’est une orbite, pas un lacet', () => {
  const a = poseDuBloc({ tx: 0, tz: 0, camY: 33 })
  const A = mondeVersLatLonEmprise(emprise, 0, 0, TERRAIN_SIZE)
  const w = latLonVersMondeEmprise(emprise, A.lat, A.lon + 1, TERRAIN_SIZE)
  const b = poseDuBloc({ tx: w.x, tz: w.z, camY: 33 })
  const sa = latLonDe(a.p.toArray()), sb = latLonDe(b.p.toArray())
  assert.ok(Math.abs(sb.lon - sa.lon - 1) < 0.01, `le point sous la caméra a bougé de ${(sb.lon - sa.lon).toFixed(4)}° de longitude pour 1° demandé`)
  assert.ok(Math.abs(sb.lat - sa.lat) < 0.01)
})

test('① ter le témoin : la rotation POLAIRE d’OrbitControls autour de la cible, elle, tourne autour de la SURFACE — c’est le défaut de R33, gardé comme témoin', () => {
  const cible = new THREE.Vector3(0, Y_CIBLE, 0)
  const pose = (phiDeg) => {
    const cam = new THREE.PerspectiveCamera(33, 1.6, 0.1, 1000)
    const phi = phiDeg * Math.PI / 180, d = 33
    cam.position.set(cible.x, cible.y + d * Math.cos(phi), cible.z + d * Math.sin(phi))
    cam.up.set(0, 1, 0); cam.lookAt(cible); cam.updateMatrixWorld()
    const p = poseFond({ lat: -21.13, lon: 55.53, origineBloc: [0, 0, 0], positionBloc: cam.position.toArray(), quaternionBloc: cam.quaternion.toArray(), extentMeters, span: TERRAIN_SIZE })
    return { p: new THREE.Vector3(...p.position), q: new THREE.Quaternion(...p.quaternion) }
  }
  const dist = distanceAxeM(pose(0), pose(2))
  assert.ok(dist > EARTH_RADIUS_M * 0.9, `le témoin doit tourner autour de la surface : axe à ${km(dist)} du centre`)
})

// ══════════ ② LE BRANCHEMENT — `main.js` n'est chargé par aucun test ═════════

test('② hors du crop et en orbite, OrbitControls n’a plus le bouton : `enableRotate = !regimeSaisie()`', () => {
  assert.match(MAIN, /controls\.enableRotate = !regime\b/, 'le bouton n’est pas retiré à OrbitControls dans le régime de saisie')
  const i = MAIN.indexOf('function regimeSaisie()')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, i + 400)
  assert.match(corps, /mode === 'orbital'\) return true/, 'l’orbite doit être dans le régime')
  assert.match(corps, /horsDuCrop/, 'la surface n’y est que hors du crop')
})

test('② bis la saisie court AVANT `updateCameraMotion` dans `tick`', () => {
  const iTick = MAIN.indexOf('function tick(')
  const zone = MAIN.slice(iTick, iTick + 6000)
  const iS = zone.indexOf('appliquerSaisieTerre(dt)')
  const iU = zone.indexOf('updateCameraMotion(dt)')
  assert.ok(iS > 0 && iU > iS, 'la saisie doit précéder updateCameraMotion — sinon controls.update relit une pose d’une image en retard')
})

test('② ter la saisie a les mêmes effets de bord qu’un `start` d’OrbitControls, et le recentrage de R27 est parti', () => {
  assert.match(MAIN, /controls\.addEventListener\('start', surPriseDeCamera\)/)
  assert.match(MAIN, /controls\.addEventListener\('end', surRelacheDeCamera\)/)
  const i = MAIN.indexOf('function surPointerDownSaisie')
  assert.ok(i > 0)
  assert.match(MAIN.slice(i, i + 1500), /surPriseDeCamera\(\)/, 'la prise du bouton par la saisie ne coupe pas les vols et les plans')
  assert.doesNotMatch(MAIN, /recentrerSurLaTerre|decalageRecentrage/, 'le recentrage de R27 (vers l’axe du BLOC) est revenu')
})

test('② quater la surface hors du crop se déplace par translation RIGIDE — caméra ET cible du même vecteur', () => {
  const i = MAIN.indexOf('function deplacerSousLaCamera')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, i + 2200)
  assert.match(corps, /controls\.target\.x \+= dx/)
  assert.match(corps, /camera\.position\.x \+= dx/)
  assert.match(corps, /controls\.target\.z \+= dz/)
  assert.match(corps, /camera\.position\.z \+= dz/)
  assert.doesNotMatch(corps, /controls\.target\.y\s*[+-]?=/, 'le `y` de la cible ne bouge pas : l’altitude de cadrage non plus')
  // et en orbite, la caméra reste sur sa sphère, nord en haut
  assert.match(corps, /camera\.up\.set\(0, 1, 0\)/)
  assert.match(corps, /camera\.lookAt\(0, 0, 0\)/)
})

test('② quinquies le rayon de la sphère des contrôles est bien `R_GLOBE`', () => {
  assert.equal(R_GLOBE, 100)
})
