// LA FRONTIÈRE DE RENDU — Tâche 1b bis du plan « globe continu ».
//
// ══════════ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════
//
// Le plan écrit de cette tâche qu'elle est **la seule dont on puisse dire avec
// un chiffre qu'elle ne peut pas être livrée à l'aveugle** : `src/main.js` n'est
// chargé par aucun test (§0), la scène ne se rend pas sous node, et le §10
// constate qu'aucune image en mouvement n'a jamais été vue.
//
// **Ce fichier ne change pas ce constat — il en réduit la surface.** Toute la
// géométrie de la frontière (le repère, la similitude, l'échelle, les plans, et
// surtout LE FACTEUR QUE LA TÂCHE DEVAIT TRANCHER) vit dans
// `src/monde/frontiere-rendu.js`, qui ne connaît ni three ni la scène. Ce qui
// reste sans filet dans `main.js`, c'est le BRANCHEMENT : deux passes, l'ordre,
// la profondeur, le fond. Celui-là s'est prouvé au navigateur, `readPixels` à
// l'appui, et le compte rendu de la tâche dit exactement ce qui l'a été.
//
// ⚠️ **LES ASSERTIONS SONT REJOUÉES CONTRE THREE**, pas contre ma propre
// arithmétique : `makeBasis` / `setFromRotationMatrix` / `multiplyQuaternions`
// servent d'oracle indépendant. Une erreur de convention dans le module
// tomberait ici, pas à l'écran.

import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import {
  repereGlobe,
  rotationVersGlobe,
  facteurEchelle,
  altitudeFondM,
  poseFond,
  plansFond,
} from '../src/monde/frontiere-rendu.js'
import { R_GLOBE, ORBITAL_M_PER_UNIT, EARTH_RADIUS_M, latLonToSphere } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { echelleBloc, altitudeSurfaceM, empriseBlocM } from '../src/loi-altitude.js'

const LIEUX = [
  { lat: 0, lon: 0 }, { lat: 0, lon: 90 }, { lat: 0, lon: -90 }, { lat: 0, lon: 179.9 },
  { lat: 45.8326, lon: 6.8652 }, // Mont-Blanc — le vol de référence du §0
  { lat: -21.115, lon: 55.536 }, // La Réunion — le lieu des mesures 6 sexies
  { lat: 89.9, lon: 12 }, { lat: -84, lon: -140 }, { lat: 60, lon: -73 },
]

const vec = (a) => new THREE.Vector3(a[0], a[1], a[2])
const quat = (a) => new THREE.Quaternion(a[0], a[1], a[2], a[3])

// ══════════ ① LE REPÈRE LOCAL EST ORTHONORMÉ ET DIRECT ══════════════════════

test('la base locale du globe est orthonormée, et (est, haut, sud) est DIRECTE', () => {
  // ⚠️ SI ELLE ÉTAIT INDIRECTE, `R` SERAIT UNE RÉFLEXION : la carte de fond
  // apparaîtrait en miroir, et rien dans le code ne le dirait.
  for (const { lat, lon } of LIEUX) {
    const { est, haut, sud } = repereGlobe(lat, lon)
    for (const [nom, v] of [['est', est], ['haut', haut], ['sud', sud]]) {
      assert.ok(Math.abs(vec(v).length() - 1) < 1e-12, `${nom} n'est pas unitaire en ${lat},${lon}`)
    }
    assert.ok(Math.abs(vec(est).dot(vec(haut))) < 1e-12, 'est · haut ≠ 0')
    assert.ok(Math.abs(vec(est).dot(vec(sud))) < 1e-12, 'est · sud ≠ 0')
    assert.ok(Math.abs(vec(haut).dot(vec(sud))) < 1e-12, 'haut · sud ≠ 0')
    // est × haut = sud : c'est LA convention du bloc (geo.js : « +x east,
    // +z south, y up »), et c'est elle qui fait que la matrice du bloc est
    // l'identité et que `R` se réduit à cette base.
    const croix = vec(est).clone().cross(vec(haut))
    assert.ok(croix.distanceTo(vec(sud)) < 1e-12, `est × haut ≠ sud en ${lat},${lon}`)
  }
})

test('le repère du BLOC est (est, haut, sud) = identité — la prémisse du module', () => {
  // Rejoué contre geo.js, pas cité de mémoire : `latLonToWorld` documente
  // « World axes: +x east, +z south, y up ». Donc est = +x, haut = +y,
  // sud = +z, et la matrice de base du bloc est l'identité.
  const M = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)
  )
  assert.deepEqual(M.elements, new THREE.Matrix4().identity().elements)
})

test('au pôle nord la rotation est l’IDENTITÉ — le bloc et le globe y partagent leur repère', () => {
  const { colonneX, colonneY, colonneZ } = rotationVersGlobe(90, 0)
  assert.ok(vec(colonneX).distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-12)
  assert.ok(vec(colonneY).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-12)
  assert.ok(vec(colonneZ).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12)
})

test('le haut de la base est bien la normale de la sphère — accordé à latLonToSphere', () => {
  for (const { lat, lon } of LIEUX) {
    const p = latLonToSphere(lat, lon, R_GLOBE).normalize()
    assert.ok(vec(repereGlobe(lat, lon).haut).distanceTo(p) < 1e-12, `haut ≠ n̂ en ${lat},${lon}`)
  }
})

// ══════════ ② LA POSE — REJOUÉE CONTRE THREE ═══════════════════════════════

test('poseFond rend EXACTEMENT ce que three calcule avec makeBasis et multiplyQuaternions', () => {
  // L'oracle indépendant : si mes quaternions faits main divergeaient d'une
  // convention, c'est ici que ça tombe — pas à l'écran.
  const extentMeters = 81800, span = TERRAIN_SIZE
  const k = facteurEchelle({ extentMeters, span })
  for (const { lat, lon } of LIEUX) {
    for (const P of [[0, 30, 0], [12.5, 7.2, -3.4], [-28, 0.5, 28]]) {
      const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0.4, 0.15, 'YXZ'))
      const { est, haut, sud } = repereGlobe(lat, lon)
      const R = new THREE.Matrix4().makeBasis(vec(est), vec(haut), vec(sud))
      const attenduPos = new THREE.Vector3(...P).multiplyScalar(k)
        .applyMatrix4(R).add(latLonToSphere(lat, lon, R_GLOBE))
      const attenduQ = new THREE.Quaternion().setFromRotationMatrix(R).multiply(qb)

      const rendu = poseFond({
        lat, lon, positionBloc: P, quaternionBloc: qb.toArray(), extentMeters, span,
      })
      assert.ok(vec(rendu.position).distanceTo(attenduPos) < 1e-9, `position en ${lat},${lon}`)
      // 1e-6 rad et pas 1e-9 : `angleTo` vaut `2·acos(|dot|)`, et `acos` près
      // de 1 est mal conditionné — deux quaternions IDENTIQUES en float64 y
      // rendent déjà ~1e-8. Le seuil mesure la convention, pas l'arrondi.
      assert.ok(quat(rendu.quaternion).angleTo(attenduQ) < 1e-6, `orientation en ${lat},${lon}`)
    }
  }
})

test('une caméra au-dessus du centre du bloc atterrit à la VERTICALE du lieu', () => {
  const extentMeters = 2618000, span = TERRAIN_SIZE
  const k = facteurEchelle({ extentMeters, span })
  for (const { lat, lon } of LIEUX) {
    const camY = 72.72 // la position mesurée par la Tâche 2 ter, à la lettre
    const { position } = poseFond({
      lat, lon, positionBloc: [0, camY, 0], quaternionBloc: [0, 0, 0, 1], extentMeters, span,
    })
    const d = vec(position).length()
    assert.ok(Math.abs(d - (R_GLOBE + k * camY)) < 1e-9, 'la distance au centre n’est pas R + k·camY')
    // et elle est bien AU-DESSUS du lieu, pas ailleurs sur la sphère
    const dessous = vec(position).clone().normalize().multiplyScalar(R_GLOBE)
    assert.ok(dessous.distanceTo(latLonToSphere(lat, lon, R_GLOBE)) < 1e-9)
  }
})

test('une caméra qui regarde le sol regarde le CENTRE de la planète', () => {
  // Le geste le plus banal de l'application : la vue au nadir. Dans le bloc
  // l'axe de visée est (0, −1, 0) ; sur le globe il doit pointer vers le centre.
  const extentMeters = 40000, span = TERRAIN_SIZE
  for (const { lat, lon } of LIEUX) {
    const { position, quaternion } = poseFond({
      lat, lon, positionBloc: [0, 40, 0], quaternionBloc: [0, 0, 0, 1], // identité = regard vers −Z
      extentMeters, span,
    })
    // three : la caméra regarde son −Z local
    const nadirBloc = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    const pose = poseFond({
      lat, lon, positionBloc: [0, 40, 0], quaternionBloc: nadirBloc.toArray(), extentMeters, span,
    })
    const visee = new THREE.Vector3(0, 0, -1).applyQuaternion(quat(pose.quaternion))
    const versCentre = vec(pose.position).clone().negate().normalize()
    assert.ok(visee.distanceTo(versCentre) < 1e-9, `nadir cassé en ${lat},${lon}`)
    // et l'horizontale du bloc reste horizontale sur le globe
    const est = new THREE.Vector3(1, 0, 0).applyQuaternion(quat(quaternion))
    assert.ok(Math.abs(est.dot(vec(position).clone().normalize())) < 1e-9, 'l’est n’est plus horizontal')
  }
})

// ══════════ ③ L'ANGLE APPARENT — L'ÉTAPE 2 DE LA TÂCHE ═════════════════════

test('la similitude CONSERVE l’angle apparent — la planète est vue comme le bloc montre son emprise', () => {
  // C'est l'énoncé de l'Étape 2 : « la réplique doit voir la planète sous le
  // MÊME angle apparent que le bloc montre son emprise ». Une similitude
  // conserve les angles ; ce test le VÉRIFIE au lieu de l'invoquer, sur le
  // demi-champ réel de l'application (fov 33°, mesuré au navigateur).
  const extentMeters = 81800, span = TERRAIN_SIZE
  const cam = [0, 26.7, 0]
  for (const { lat, lon } of LIEUX) {
    for (const bord of [[span / 2, 0, 0], [0, 0, span / 2], [-span / 2, 0, span / 2]]) {
      const angleBloc = new THREE.Vector3(...bord).sub(new THREE.Vector3(...cam))
        .angleTo(new THREE.Vector3(0, -1, 0))
      const pc = poseFond({ lat, lon, positionBloc: cam, quaternionBloc: [0, 0, 0, 1], extentMeters, span })
      const pb = poseFond({ lat, lon, positionBloc: bord, quaternionBloc: [0, 0, 0, 1], extentMeters, span })
      const bas = vec(pc.position).clone().normalize().negate()
      const angleGlobe = vec(pb.position).clone().sub(vec(pc.position)).angleTo(bas)
      assert.ok(Math.abs(angleGlobe - angleBloc) < 1e-9,
        `angle apparent modifié en ${lat},${lon} : ${angleBloc} → ${angleGlobe}`)
    }
  }
})

// ══════════ ④ LE FACTEUR QUE LA TÂCHE DEVAIT TRANCHER ══════════════════════

test('l’échelle du fond est HORIZONTALE : altitudeFondM = altitudeSurfaceM × exagération', () => {
  // ⚠️ **LE SEUL NOMBRE QUE CETTE TÂCHE TRANCHE.** L'Étape 2 du plan annonçait
  // que le facteur `exagération(z)` du « point 1 » se paierait ou se réglerait
  // ici. Il se règle : le fond prend l'échelle HORIZONTALE, parce que ce qu'il
  // doit reproduire est une largeur de sol, pas une hauteur.
  for (const exageration of [2.5, 2.8, 3.2, 4, 5]) { // la table d'Adrien, en entier
    const extentMeters = 81800, span = TERRAIN_SIZE, camY = 26.7
    const alti = altitudeSurfaceM({ camY, extentMeters, span, exageration })
    const fond = altitudeFondM({ camY, extentMeters, span })
    assert.ok(Math.abs(fond - alti * exageration) / fond < 1e-12,
      `le fond ne vaut pas ×${exageration} l’altimètre`)
    // et il vaut camY divisé par l'échelle HORIZONTALE, exagération retirée
    assert.ok(Math.abs(fond - camY / echelleBloc({ extentMeters, span, exageration: 1 })) < 1e-6)
  }
})

test('MUTATION — prendre l’altitude de l’ALTIMÈTRE rétrécit la planète d’exactement l’exagération', () => {
  // ⚠️ CE TEST EST LA MUTATION DE L'ÉTAPE 2, ARMÉE. Le régime faux est celui
  // qu'un lecteur pressé écrirait : « la caméra de fond se met à l'altitude que
  // l'altimètre affiche ». Mesuré ici : elle se met `exagération` fois trop bas,
  // donc la planète est vue `exagération` fois trop grosse — de ×2,5 à ×5.
  const extentMeters = 81800, span = TERRAIN_SIZE, camY = 26.7, exageration = 5
  const bon = facteurEchelle({ extentMeters, span })
  // le régime faux : k tiré de l'échelle VERTICALE
  const faux = extentMeters / exageration / span / ORBITAL_M_PER_UNIT
  assert.ok(Math.abs(bon / faux - exageration) < 1e-9, 'la mutation ne mord plus')
  const hBon = poseFond({ lat: 45.8326, lon: 6.8652, positionBloc: [0, camY, 0], quaternionBloc: [0, 0, 0, 1], extentMeters, span })
  assert.ok(Math.abs((vec(hBon.position).length() - R_GLOBE) - bon * camY) < 1e-9)
})

test('le facteur d’échelle est celui du plan : 68 unités à z4, 139 600 à z15 SI on redimensionnait le globe', () => {
  // ⚠️ **LE CHIFFRE QUI A DÉCIDÉ LES DEUX PASSES, REJOUÉ.** Le plan (Tâche 1b,
  // Étape 2) écarte la scène unique parce que remettre le globe à l'échelle du
  // bloc demanderait un rayon de `EARTH_RADIUS_M × span / emprise`. Ce test le
  // recalcule — c'est la justification de tout ce fichier, elle ne doit pas
  // devenir folklore.
  // ⚠️ **LA TABLE DU PLAN EST À LA LATITUDE DU MONT-BLANC, ET C'EST
  // VÉRIFIABLE :** l'emprise porte `cos(lat)`, donc z4 vaut 7 514 km à
  // l'équateur et **5 235 km à 45,8326°** — exactement le chiffre du plan.
  // Rejoué avant d'être écrit, comme le §0 l'exige.
  const LAT_PLAN = 45.8326
  assert.ok(Math.abs(empriseBlocM({ zoom: 4, lat: LAT_PLAN }) - 5235000) < 5000, 'z4 : le plan dit 5 235 km')
  assert.ok(Math.abs(empriseBlocM({ zoom: 15, lat: LAT_PLAN }) - 2556) < 20, 'z15 : le plan dit 2,56 km')
  const rayonAEchelle = (zoom, lat) => (EARTH_RADIUS_M * TERRAIN_SIZE) / empriseBlocM({ zoom, lat })
  assert.ok(Math.abs(rayonAEchelle(4, LAT_PLAN) - 68) < 1, 'z4 : le plan dit 68 unités')
  // ⚠️ **LE PLAN ÉCRIT « la dalle (56) est plus grande que la planète » ;
  // REJOUÉ CONTRE LE DÉPÔT, C'EST FAUX À LA LETTRE ET VRAI SUR LE FOND.** Le
  // rayon vaut 68 et la dalle 56, donc 68 > 56. Ce qui est vrai, et qui est ce
  // que le plan voulait dire, se mesure : **posée tangente à une sphère de rayon
  // 68, une dalle de 56 a ses BORDS EN DEHORS de la sphère** — le bloc
  // dépasserait de la silhouette de sa propre planète. On corrige l'assertion
  // en place, on ne retire pas le repère : §0, on élargit une liste.
  const rz4 = rayonAEchelle(4, LAT_PLAN)
  assert.ok(Math.hypot(rz4, TERRAIN_SIZE / 2) > rz4 + 5,
    'z4 : les bords de la dalle tangente devraient sortir de la sphère')
  const r15 = rayonAEchelle(15, LAT_PLAN)
  assert.ok(r15 > 130000 && r15 < 145000, `z15 : le plan dit ≈139 600, obtenu ${Math.round(r15)}`)
  // et la frontière, elle, ne redimensionne RIEN : k reste petit et borné
  assert.ok(facteurEchelle({ extentMeters: empriseBlocM({ zoom: 15, lat: LAT_PLAN }), span: TERRAIN_SIZE }) < 1e-3)
})

// ══════════ ⑤ LES PLANS DE LA CAMÉRA DE FOND ═══════════════════════════════

test('far contient TOUJOURS la sphère entière, et near ne clippe pas le sol', () => {
  for (const hauteurM of [500, 2200, 40000, 260000, 1600000, 7000000]) {
    const h = hauteurM / ORBITAL_M_PER_UNIT
    const { near, far } = plansFond({ position: [0, R_GLOBE + h, 0] })
    assert.ok(far >= R_GLOBE + h + R_GLOBE, `far trop court à ${hauteurM} m`)
    assert.ok(near > 0 && near <= h + 1e-9, `near dépasse la hauteur à ${hauteurM} m`)
    assert.ok(near <= 0.5, 'near dépasse le plafond de planProche')
    // ⚠️ **LE PLANCHER DE `planProche` NE PEUT PAS SERVIR ICI, ET C'EST
    // MESURÉ :** il cale `near` à **0,01 unité-globe = 637 m**, donc à 500 m
    // d'altitude la caméra de fond CLIPPERAIT le sol qu'elle survole. Le fond
    // prend donc un plancher mille fois plus bas. **Le prix est un rapport
    // far/near large — et il est sans conséquence ICI, parce que la seule
    // chose que ce tampon doit séparer, c'est l'avant de la sphère de son
    // arrière, soit 200 unités d'écart.** La profondeur du fond n'est jamais
    // composée avec celle du bloc : `main.js` efface le tampon entre les deux
    // passes.
    assert.ok(far / near < 1e6, `far/near = ${far / near} à ${hauteurM} m`)
  }
})

// ══════════ ⑥ LA CONTINUITÉ AU PASSAGE ═════════════════════════════════════

test('la pose de fond est CONTINUE en altitude — aucun saut, contrairement à enterOrbit', () => {
  // La Tâche 2 ter a mesuré le saut qu'`enterOrbit` fait aujourd'hui :
  // (88,49 · 72,72 · 88,49) → (77,24 · −36,33 · 52,56), la caméra TRAVERSE le
  // plan y = 0. La caméra de fond, elle, est une fonction continue de la pose du
  // bloc : on le vérifie en dérivant numériquement.
  const extentMeters = 2618000, span = TERRAIN_SIZE
  const lieu = { lat: 45.8326, lon: 6.8652 }
  let precedent = null, pire = 0
  for (let i = 0; i <= 400; i++) {
    const camY = 150 * Math.exp(-i / 60) // descente géométrique, 150 → 0,08
    const p = poseFond({ ...lieu, positionBloc: [8, camY, 8], quaternionBloc: [0, 0, 0, 1], extentMeters, span })
    if (precedent) pire = Math.max(pire, vec(p.position).distanceTo(vec(precedent)))
    precedent = p.position
  }
  // le plus grand pas doit rester de l'ordre du pas d'échantillonnage lui-même :
  // 150 × k × (1 − e^(−1/60)) ≈ 0,0102 unité. Une téléportation ferait des
  // dizaines d'unités.
  const k = facteurEchelle({ extentMeters, span })
  const pasTheorique = 150 * k * (1 - Math.exp(-1 / 60))
  assert.ok(pire < pasTheorique * 1.001, `saut de ${pire} pour un pas de ${pasTheorique}`)
})

// ══════════ ⑦ LA COURBURE — MESURÉE, PAS AFFIRMÉE ══════════════════════════

test('l’écart plan tangent / sphère est celui du tableau de l’en-tête, au pour-cent près', () => {
  // ⚠️ **CE N'EST PAS UN DÉFAUT DE LA FRONTIÈRE, C'EST LA PLATITUDE DU BLOC**, et
  // aucune similitude ne peut la réconcilier avec une sphère. Le tableau est
  // dans l'en-tête du module pour qu'on ne prenne pas l'horizon pour un bogue de
  // raccord. On le RE-MESURE ici, sur la vraie géométrie.
  const LAT_PLAN = 45.8326 // la latitude de la table du plan — voir le test ci-dessus
  const attendu = { 4: 538000, 8: 2100, 10: 132, 13: 2.0, 15: 0.13 }
  for (const [z, ecartM] of Object.entries(attendu)) {
    const demi = empriseBlocM({ zoom: +z, lat: LAT_PLAN }) / 2
    const mesure = (demi * demi) / (2 * EARTH_RADIUS_M)
    assert.ok(Math.abs(mesure - ecartM) / ecartM < 0.03,
      `z${z} : tableau ${ecartM} m, mesuré ${mesure.toFixed(2)} m`)
  }
  // et la même mesure DANS L'ESPACE DU GLOBE, en passant par poseFond : un
  // point du bord du bloc est au-dessus de la sphère de exactement cet écart
  const zoom = 10
  const extentMeters = empriseBlocM({ zoom, lat: LAT_PLAN })
  const p = poseFond({
    lat: LAT_PLAN, lon: 0, positionBloc: [TERRAIN_SIZE / 2, 0, 0], quaternionBloc: [0, 0, 0, 1],
    extentMeters, span: TERRAIN_SIZE,
  })
  const surplombM = (vec(p.position).length() - R_GLOBE) * ORBITAL_M_PER_UNIT
  assert.ok(Math.abs(surplombM - attendu[10]) / attendu[10] < 0.03,
    `surplomb mesuré ${surplombM.toFixed(1)} m, attendu ${attendu[10]} m`)
})

// ══════════ ⑧ L'ANCRE — TÂCHE D16, ÉTAPE 2 ═════════════════════════════════
//
// ⚠️ **CE QUI EST VÉRIFIÉ ICI EST LA CAUSE MESURÉE DE LA PIRE RUPTURE DE LA
// DESCENTE**, pas une propriété algébrique de confort. L'inventaire D16 a relevé
// **11,863° de rotation de la caméra QUI REND, en une image, au cran z3 → z4,
// alors que la caméra du bloc ne bougeait pas d'un millième** — et il a montré
// que ces degrés viennent ENTIÈREMENT de `quaternionDeBase(ancre)`, donc du
// déplacement de l'ancre, calée sur la grille de tuiles slippy.

// Une emprise carrée en MERCATOR autour d'un lieu — la forme que `terrain`
// donne à `fenetreBornee.emprise`, réduite à ce dont ces tests ont besoin.
function empriseAutour(lat, lon, largeDeg) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI
  const mY = (l) => Math.log(Math.tan(l * D2R) + 1 / Math.cos(l * D2R))
  const m = mY(lat), demi = (largeDeg * D2R) / 2
  const inv = (v) => Math.atan(Math.sinh(v)) * R2D
  return { ouest: lon - largeDeg / 2, est: lon + largeDeg / 2, nord: inv(m + demi), sud: inv(m - demi) }
}
// La réciproque de `mondeVersLatLonEmprise`, recopiée de `geo.js` : le test doit
// pouvoir dire OÙ, dans le bloc, tombe un lieu donné.
function mondeDe(emprise, lat, lon, span = TERRAIN_SIZE) {
  const D2R = Math.PI / 180
  const mY = (l) => Math.log(Math.tan(l * D2R) + 1 / Math.cos(l * D2R))
  let large = emprise.est - emprise.ouest
  if (large <= 0) large += 360
  let dLon = lon - emprise.ouest
  dLon -= Math.round((dLon - large / 2) / 360) * 360
  const mN = mY(emprise.nord), mS = mY(emprise.sud)
  return { x: (dLon / large - 0.5) * span, z: ((mY(lat) - mN) / (mS - mN) - 0.5) * span }
}

test('sans `origineBloc`, poseFond rend EXACTEMENT ce qu’elle rendait — non-régression', () => {
  const extentMeters = 81800, span = TERRAIN_SIZE
  const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0.4, 0.15, 'YXZ')).toArray()
  for (const { lat, lon } of LIEUX) {
    for (const P of [[0, 30, 0], [12.5, 7.2, -3.4], [-28, 0.5, 28]]) {
      const sans = poseFond({ lat, lon, positionBloc: P, quaternionBloc: qb, extentMeters, span })
      const zero = poseFond({ lat, lon, positionBloc: P, quaternionBloc: qb, extentMeters, span, origineBloc: [0, 0, 0] })
      assert.deepEqual(zero.position, sans.position, `position en ${lat},${lon}`)
      assert.deepEqual(zero.quaternion, sans.quaternion, `orientation en ${lat},${lon}`)
    }
  }
})

test('`origineBloc` est une TRANSLATION du repère du bloc, rien de plus', () => {
  const extentMeters = 81800, span = TERRAIN_SIZE
  const qb = [0, 0, 0, 1]
  const g = [3.5, 0, -7.25]
  for (const { lat, lon } of LIEUX) {
    const P = [12.5, 7.2, -3.4]
    const a = poseFond({ lat, lon, positionBloc: P, quaternionBloc: qb, extentMeters, span, origineBloc: g })
    const b = poseFond({
      lat, lon, quaternionBloc: qb, extentMeters, span,
      positionBloc: [P[0] - g[0], P[1] - g[1], P[2] - g[2]],
    })
    assert.ok(vec(a.position).distanceTo(vec(b.position)) < 1e-12, `translation cassée en ${lat},${lon}`)
    assert.deepEqual(a.quaternion, b.quaternion)
  }
})

// ⛔ **LE TEST QUI COMPTE : LE FRANCHISSEMENT DE NIVEAU.**
//
// On rejoue la seule chose que fait un cran de zoom : le bloc est REBÂTI, deux
// fois plus fin, ET RECALÉ SUR LA GRILLE DE TUILES — son centre part ailleurs.
// La géographie, elle, ne bouge pas : le lieu VISÉ reste le même, à la même
// altitude, sous la même orientation. **L'image ne doit donc pas bouger.**
test('un franchissement de niveau ne déplace PAS la caméra de fond — si l’ancre est le lieu visé', () => {
  const LIEU = { lat: -21.115, lon: 55.536 } // La Réunion, le lieu des mesures D16
  // repère AVANT : bloc large de 40°, centré 3,7° au nord-ouest du lieu visé
  const empriseA = empriseAutour(LIEU.lat + 3.7, LIEU.lon - 3.1, 40)
  // repère APRÈS : deux fois plus fin, ET recalé ailleurs — le saut de la grille
  const empriseB = empriseAutour(LIEU.lat - 1.9, LIEU.lon + 2.4, 20)
  const extentA = 4.4e6, extentB = extentA / 2 // l'emprise en mètres suit la largeur
  const gA = mondeDe(empriseA, LIEU.lat, LIEU.lon)
  const gB = mondeDe(empriseB, LIEU.lat, LIEU.lon)
  // la caméra : même altitude réelle, même écart au sol, exprimés dans chaque
  // repère — les unités de bloc valent deux fois moins de mètres après le cran
  const hautA = 24.3, deportA = 25.4
  const camA = [gA.x, hautA, gA.z + deportA]
  const camB = [gB.x, hautA * 2, gB.z + deportA * 2]
  const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.81, 0, 0, 'YXZ')).toArray()
  const commun = { lat: LIEU.lat, lon: LIEU.lon, quaternionBloc: qb, span: TERRAIN_SIZE }

  const avant = poseFond({ ...commun, positionBloc: camA, extentMeters: extentA, origineBloc: [gA.x, 0, gA.z] })
  const apres = poseFond({ ...commun, positionBloc: camB, extentMeters: extentB, origineBloc: [gB.x, 0, gB.z] })
  assert.ok(vec(avant.position).distanceTo(vec(apres.position)) < 1e-9,
    `la caméra de fond a bougé de ${vec(avant.position).distanceTo(vec(apres.position))} unité-globe`)
  assert.ok(quat(avant.quaternion).angleTo(quat(apres.quaternion)) < 1e-9, 'l’orientation a tourné')

  // ⚠️ **ET LE CONTRE-ESSAI, SANS LEQUEL LE TEST CI-DESSUS NE PROUVE RIEN :**
  // la MÊME géographie, ancrée au CENTRE du bloc comme le faisait le dépôt,
  // fait tourner la caméra de fond de plusieurs degrés — l'ordre de grandeur
  // des 11,863° relevés à l'écran.
  const centreA = mondeVersLatLon(empriseA)
  const centreB = mondeVersLatLon(empriseB)
  const vieuxA = poseFond({ ...commun, lat: centreA.lat, lon: centreA.lon, positionBloc: camA, extentMeters: extentA })
  const vieuxB = poseFond({ ...commun, lat: centreB.lat, lon: centreB.lon, positionBloc: camB, extentMeters: extentB })
  const tourne = (quat(vieuxA.quaternion).angleTo(quat(vieuxB.quaternion)) * 180) / Math.PI
  assert.ok(tourne > 3, `l’ancre au centre du bloc devrait tourner de plusieurs degrés, mesuré ${tourne.toFixed(3)}°`)
})

// le lat/lon du CENTRE d'une emprise — c'est-à-dire l'ancre du dépôt
function mondeVersLatLon(emprise) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI
  const mY = (l) => Math.log(Math.tan(l * D2R) + 1 / Math.cos(l * D2R))
  let large = emprise.est - emprise.ouest
  if (large <= 0) large += 360
  const mN = mY(emprise.nord), mS = mY(emprise.sud)
  return { lat: Math.atan(Math.sinh((mN + mS) / 2)) * R2D, lon: emprise.ouest + large / 2 }
}

// ══════════ ⑩ L'ALTITUDE DE LA CAMÉRA QUI REND — TÂCHE D16, ÉTAPE ① ═════
//
// ⛔ **`altitudeFondM` N'EST PAS L'ALTITUDE DE LA CAMÉRA DE FOND, ET SON NOM
// MENT.** Elle rend `camY × emprise / span` : le côté VERTICAL du triangle. La
// caméra, elle, est à `√((R + k·camY)² + k²·r²)` du centre — le déport
// horizontal `r` de la vue de trois quarts la pousse vers le haut.
//
// ⚠️ **CE N'EST PAS UNE FINESSE : `enterOrbit` REMETTAIT LA CAMÉRA À CETTE
// ALTITUDE-LÀ EN SORTANT.** Mesuré à l'écran, sur la remontée de référence :
// **33 105 716 m rendus contre 23 879 470 m annoncés — la caméra plongeait de
// 9 226 246 m en UNE image**, alors que le commentaire d'`enterOrbit` revendique
// une sortie « à l'altitude EXACTE » et a retiré un recul de 15 % pour cela.
// Le défaut est **deux fois et demie** le recul qu'il avait supprimé.
test('altitudeFondM est la JAMBE VERTICALE, pas l’altitude de la caméra de fond', () => {
  const span = TERRAIN_SIZE
  const LAT = -21.115, LON = 55.536
  // la vue de trois quarts du produit : `PENTE_ARRIVEE = { y: 18, z: 19 }`
  const pente = 18 / 19
  for (const { extentMeters, camY } of [
    { extentMeters: 4.4e6, camY: 40 }, // continental, là où la sortie d’orbite tombe
    { extentMeters: 1.1e6, camY: 40 },
    { extentMeters: 27309, camY: 40 }, // z12
  ]) {
    const deport = camY / pente // le déport horizontal de la vue de trois quarts
    const p = poseFond({
      lat: LAT, lon: LON, quaternionBloc: [0, 0, 0, 1], extentMeters, span,
      positionBloc: [0, camY, deport], origineBloc: [0, 0, 0],
    })
    const rendue = (vec(p.position).length() - R_GLOBE) * ORBITAL_M_PER_UNIT
    const jambe = altitudeFondM({ camY, extentMeters, span })
    assert.ok(rendue > jambe, 'la caméra de fond est TOUJOURS plus haut que la jambe verticale')
    const k = facteurEchelle({ extentMeters, span })
    // l’excès se calcule d’avance : c’est le théorème de Pythagore, rien d’autre
    const attendu = (Math.hypot(R_GLOBE + k * camY, k * deport) - R_GLOBE) * ORBITAL_M_PER_UNIT
    assert.ok(Math.abs(rendue - attendu) / attendu < 1e-12, 'la pose ne suit pas Pythagore')
  }
  // ⚡ **ET L’ÉCART NE DÉPEND QUE DE L’ALTITUDE** — ni de `camY`, ni de
  // l’emprise séparément : `k·camY` est l’altitude en unités de globe, et
  // `k·déport` vaut `k·camY / pente`. C’est pour ça que personne ne l’a vu tant
  // que les bancs partaient de 1 600 km : énorme en haut, nul en bas.
  const rapport = (altVerticaleM) => {
    const a = altVerticaleM / ORBITAL_M_PER_UNIT
    return ((Math.hypot(R_GLOBE + a, a / pente) - R_GLOBE) * ORBITAL_M_PER_UNIT) / altVerticaleM
  }
  // ⛔ **LE POINT DE FONCTIONNEMENT MESURÉ** : la sortie d’orbite tombait à
  // 23 879 470 m de jambe verticale, pour 33 105 716 m rendus — ×1,386.
  assert.ok(Math.abs(rapport(23879470) - 1.386) < 0.01,
    `à la sortie d’orbite l’écart doit valoir ×1,386 — mesuré ×${rapport(23879470).toFixed(4)}`)
  assert.ok(rapport(1600000) > 1.05, 'à 1 600 km l’écart dépasse encore +5 %')
  // ⚡ **ET À 30 km IL VAUT ×1,0026 — le chiffre que l’inventaire D16 avait
  // relevé À L’ÉCRAN pour le balayage de pose près du sol (« l’effet s’éteint
  // près du sol : à 30 km le même balayage rend ×1,0026 »). Deux mesures
  // indépendantes, la sienne au navigateur et celle-ci en arithmétique pure,
  // tombent sur les mêmes quatre décimales.
  assert.ok(Math.abs(rapport(30000) - 1.0026) < 0.0005,
    `à 30 km l’écart doit valoir ×1,0026 — mesuré ×${rapport(30000).toFixed(4)}`)
  // et l’écart CROÎT avec l’altitude, il ne fait pas de bosse
  for (const [bas, haut] of [[30000, 1600000], [1600000, 12000000], [12000000, 60000000]]) {
    assert.ok(rapport(haut) > rapport(bas), `l’écart devrait croître de ${bas} à ${haut} m`)
  }
})
