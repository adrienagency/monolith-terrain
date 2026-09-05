// LA SIMILITUDE D'UN GROUPE, ANCRÉE EN UN POINT — extraite de `gpx.js` (GX2)
// pour servir aussi aux bateaux (GX4 ⑥).
//
// Un objet dont les enfants gardent leurs coordonnées de BLOC (une arche qui se
// peuple quand son GLB arrive, un `InstancedMesh` de bateaux dont le nuanceur
// lit `instanceMatrix[3].xz` en bloc pour la houle) ne peut pas être converti
// sommet par sommet. On pose alors sur le GROUPE : `scène = P + k·R·bloc`, avec
// `R` la rotation qui emmène les axes du bloc (X est, Y haut, Z sud) sur le
// repère local de la sphère au centre du bloc, `k = poseur.rapportSimilitude()`
// (1/87,56 au Mont-Blanc — il dépend du zoom, il n'est jamais écrit), et `P`
// calé pour que l'ANCRE tombe exactement où `placer` la met.
//
// ⚠️ **EXACTE À L'ANCRE, PLAN TANGENT AILLEURS.** À `d` de l'ancre, la sphère
// s'écarte du plan de `d² / 2R` : 31 m à 20 km, 0,8 m à 3 km. Une arche fait dix
// mètres, un bateau cinquante : l'erreur est nulle à leur échelle. Un bloc
// entier posé ainsi serait faux de 2,1 km à z8 (R24 l'a mesuré) — c'est pour
// ça que la géométrie du ruban passe par `placer` sommet par sommet et que
// cette similitude est réservée aux objets PONCTUELS.

import * as THREE from 'three'

/**
 * La rotation bloc → repère local de la sphère, au centre du bloc.
 * @returns {THREE.Quaternion|null} `null` hors globe
 */
export function quaternionRepere(poseur) {
  if (!poseur?.globe) return null
  const rep = poseur.repereLocal(1)
  if (!rep) return null
  const est = new THREE.Vector3(...rep.est)
  const sud = new THREE.Vector3(...rep.sud)
  // haut = sud × est (base directe : X × Y = Z avec X = est, Y = haut, Z = sud)
  const haut = new THREE.Vector3().crossVectors(sud, est).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(est.normalize(), haut, sud.normalize()),
  )
}

/**
 * Pose `obj` par la similitude ancrée en `ancre` (coordonnées de bloc, `y`
 * compris). Sans poseur de globe ou sans quaternion, l'objet n'est pas touché.
 *
 * @param {THREE.Object3D} obj
 * @param {object} poseur le poseur du globe (`monde/sol-globe.js`)
 * @param {THREE.Quaternion|null} q `quaternionRepere(poseur)`, calculé une fois
 * @param {{x:number, y:number, z:number}} ancre
 */
export function poserGroupeAncre(obj, poseur, q, ancre) {
  if (!poseur?.globe || !q) return obj
  const k = poseur.rapportSimilitude()
  const c = poseur.placer(ancre.x, ancre.z, ancre.y)
  const cible = new THREE.Vector3(c.x, c.y, c.z)
  const local = new THREE.Vector3(ancre.x, ancre.y, ancre.z).applyQuaternion(q).multiplyScalar(k)
  obj.quaternion.copy(q)
  obj.scale.setScalar(k)
  obj.position.copy(cible).sub(local)
  return obj
}
