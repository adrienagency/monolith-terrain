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
