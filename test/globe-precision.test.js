// LE PAS DU FLOAT32, À L'ÉCHELLE DU GLOBE.
//
// `R_GLOBE = 100` (src/geo.js) pose tous les sommets du globe à une magnitude
// où **un float32 ne sait plus faire la différence entre deux points distants
// de moins d'un demi-mètre** : à |composante| ≈ 71,7 (Chamonix), le pas
// représentable vaut 7,63e-6 unité, soit **0,486 m au sol**.
//
// Deux mesures indépendantes disent que ça mord MAINTENANT :
//   • Mapterhorn sert du 0,42 m/pixel à son zoom maximal (relevé 2026-08-08,
//     z17 à Chamonix, z15 pour le repli AWS) : notre représentation s'épuise
//     exactement là où la donnée s'arrête ;
//   • le prototype du 2026-08-20 : « ça va à z13 (0,34 m d'écart pour un texel
//     de 13,3 m), mais le quantum est FIXE à 0,49 m — à z15 il vaut 15 % d'un
//     texel, et les tuiles existent jusque-là ».
// Le précédent public : deck.gl #7527, « casse à partir de z17 à cause du
// float32 », toujours ouverte.
//
// LE CORRECTIF que ces tests verrouillent : `_buildMesh` écrit des positions
// RELATIVES au centre de la tuile, et la position mondiale part vivre dans la
// matrice de l'objet (`mesh.position`). La magnitude tombe de ~100 à ~0,3, et
// le pas de 0,486 m à ~1 mm.
//
// ---------------------------------------------------------------------------
// ⚠️ DEUX PIÈGES, ET LE SECOND A FAILLI PASSER
// ---------------------------------------------------------------------------
//
// 1. LES NOMBRES DE JAVASCRIPT SONT DES DOUBLES. Un test écrit sur eux ne
//    reproduit RIEN de ce que fait le GPU : il passe toujours. D'où le
//    `Math.fround` sur toute valeur qu'on compare — et il n'est pas
//    décoratif : il tient encore si quelqu'un « corrige » le défaut en
//    passant l'attribut en Float64Array, ce que le GPU ne sait pas lire.
//
// 2. « DEUX SOMMETS DISTANTS D'UN MÈTRE DOIVENT ÊTRE DISTINCTS » NE MORD PAS.
//    Mesuré ici avant d'écrire ces tests, sur 33 345 paires réparties sur tout
//    le globe : **zéro** paire distante d'un mètre ne s'effondre sur un seul
//    et même float32, magnitude 100 comprise. La raison est arithmétique : un
//    écart de norme 1 m a forcément une composante ≥ 0,577 m, soit ≥ 1,19 pas
//    représentable, donc toujours un autre nombre. L'égalité stricte est donc
//    une assertion qui ne peut PAS échouer — elle est gardée ci-dessous pour
//    la lettre du contrat, mais elle ne prouve rien.
//    CE QUI MORD, c'est l'écart RESTITUÉ : à magnitude 100, un mètre est relu
//    entre **0,687 m et 1,458 m** selon l'endroit (même balayage). C'est ça
//    qui fait trembler un terrain — pas un sommet qui disparaît, un mètre qui
//    en vaut un et demi.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { Globe } from '../src/globe.js'
import {
  R_GLOBE,
  EARTH_RADIUS_M,
  ORBITAL_M_PER_UNIT,
  latLonToTile,
  tileToLatLon,
  latLonToSphere,
} from '../src/geo.js'
import fs from 'node:fs'
import { repereCrop } from '../src/monde/crop-sphere.js'

// ---------------------------------------------------------------- outillage

// Le pas représentable du float32 au voisinage de `valeur`, rendu en MÈTRES au
// sol. On avance d'un motif binaire : c'est la définition, pas une estimation.
const _tampon = new ArrayBuffer(4)
const _f32 = new Float32Array(_tampon)
const _u32 = new Uint32Array(_tampon)
function pasRepresentableM(valeur) {
  _f32[0] = Math.fround(Math.abs(valeur))
  const avant = _f32[0]
  _u32[0] += 1
  return (_f32[0] - avant) * ORBITAL_M_PER_UNIT
}

const EXAGERATION = 18 // la valeur de production (params.globeExaggeration)
const ALTITUDE_FIXE_M = 1000

// MNT PLAT, et c'est délibéré : deux sommets voisins partagent alors exactement
// le même rayon, l'écart mesuré est purement horizontal, et l'oracle en doubles
// se calcule sans rejouer `sampleHeights` (qui n'est pas exporté).
const HAUTEURS_PLATES = new Float32Array(256 * 256).fill(ALTITUDE_FIXE_M)

// Un MNT qui a du relief, pour la mesure du pas : ~2 400 m d'amplitude sur la
// tuile, de quoi écarter les sommets du centre autant que le fait la montagne.
const HAUTEURS_RELIEF = new Float32Array(256 * 256)
for (let j = 0; j < 256; j++) {
  for (let i = 0; i < 256; i++) {
    HAUTEURS_RELIEF[j * 256 + i] = 800 + 1200 * (Math.sin(i / 19) + Math.cos(j / 23))
  }
}

function tuileDeTest(z, lat, lon, heights = HAUTEURS_PLATES) {
  const brut = latLonToTile(lat, lon, z)
  const x = Math.floor(brut.x)
  const y = Math.floor(brut.y)
  const nw = tileToLatLon(x, y, z)
  const se = tileToLatLon(x + 1, y + 1, z)
  return {
    key: `${z}/${x}/${y}`,
    z,
    x,
    y,
    state: 'ready',
    heights,
    texture: null,
    mesh: null,
    lastUsed: 0,
    center: latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2),
    chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)),
  }
}

// On construit avec LA VRAIE MÉTHODE. Monter un `Globe` entier réclamerait le
// DOM (rampe de couleurs, calottes, atmosphère, coquille de nuages) ; `.call`
// sur un objet minimal exerce le code qu'on veut prouver, et lui seul.
function construis(t) {
  const faux = {
    exaggeration: EXAGERATION,
    group: new THREE.Group(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    // ⚠️ **LES VRAIES MÉTHODES DE JUPE — Tâche P7.** `_buildMesh` retaille sa
    // jupe sur le fond du bloc en sortant ; sans parois ni crop, le plancher
    // vaut 0 et la jupe garde sa pleine longueur. Poser ici les vraies méthodes
    // plutôt que des bouchons, c'est EXERCER ce chemin neutre au lieu de le
    // contourner — et c'est lui que ce fichier prouve « au bit près ».
    _parois: null,
    _crop: null,
    _baseYCrop: null,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
  }
  Globe.prototype._buildMesh.call(faux, t)
  return t.mesh
}

// La grille par tuile n'est pas exportée ; on la retrouve depuis le nombre de
// sommets — (G+1)² pour la nappe, 4G pour la jupe — et on VÉRIFIE le compte.
function grilleDe(mesh) {
  const total = mesh.geometry.attributes.position.count
  for (let G = 4; G <= 128; G++) if ((G + 1) ** 2 + 4 * G === total) return G
  throw new Error(`grille introuvable pour ${total} sommets`)
}

// Lecture d'un sommet TELLE QUE LE GPU LA VERRA : trois float32, rien de plus.
function sommet32(mesh, indice) {
  const a = mesh.geometry.attributes.position.array
  return [Math.fround(a[indice * 3]), Math.fround(a[indice * 3 + 1]), Math.fround(a[indice * 3 + 2])]
}

const norme = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// ------------------------------------------------------------------- tests

// z20 : la tuile fait ~26,6 m de large à la latitude de Chamonix, et la grille
// de 24 segments y pose ses sommets à **1,11 m** les uns des autres. Ce sont
// donc de VRAIS sommets du maillage, distants d'un mètre, pas une construction
// de test.
test('à z20, deux sommets voisins distants d’un mètre restent à un mètre en float32', () => {
  const t = tuileDeTest(20, 45.8326, 6.8652)
  const mesh = construis(t)
  const G = grilleDe(mesh)

  // l'oracle, en DOUBLES : le rayon est le même pour tous les sommets (MNT
  // plat), l'écart attendu est donc la corde entre deux points de la sphère
  const rayon = R_GLOBE + ALTITUDE_FIXE_M * (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
  const attendu = (u, v) => {
    const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
    const p = latLonToSphere(lat, lon, rayon)
    return [p.x, p.y, p.z]
  }

  let pireEcartM = 0
  let pireDistanceM = 0
  let effondrees = 0
  let paires = 0

  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) {
      const a = j * (G + 1) + i
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const i2 = i + di
        const j2 = j + dj
        if (i2 > G || j2 > G) continue
        const b = j2 * (G + 1) + i2
        paires++

        const pa = sommet32(mesh, a)
        const pb = sommet32(mesh, b)
        if (pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2]) effondrees++

        const relu = norme(pa, pb) * ORBITAL_M_PER_UNIT
        const vrai = norme(attendu(i / G, j / G), attendu(i2 / G, j2 / G)) * ORBITAL_M_PER_UNIT
        pireDistanceM = Math.max(pireDistanceM, vrai)
        pireEcartM = Math.max(pireEcartM, Math.abs(relu - vrai))
      }
    }
  }

  // le décor : on mesure bien des sommets à ~1 m, sinon le test parle d'autre chose
  assert.ok(paires > 1000, `${paires} paires seulement`)
  assert.ok(pireDistanceM < 2, `les sommets sont à ${pireDistanceM.toFixed(2)} m, pas à un mètre`)

  // la lettre du contrat — elle ne peut pas échouer, voir l'en-tête
  assert.equal(effondrees, 0, `${effondrees} paires confondues en float32`)

  // CE QUI MORD : le mètre doit rester un mètre. Positions absolues, la même
  // boucle rend jusqu'à ~0,46 m d'erreur ; en repère relatif, ~1e-4 m.
  assert.ok(
    pireEcartM <= 0.01,
    `un mètre est relu à ${pireEcartM.toFixed(4)} m près (limite 0,01 m) — le repère n'est pas relatif`,
  )
})

// La même chose dite en une seule grandeur, celle du plan : le PAS
// REPRÉSENTABLE là où vivent les sommets. 0,486 m en absolu, quel que soit le
// zoom — c'est bien le fond du problème : le pas ne descend jamais.
test('le pas représentable des positions vaut moins d’un centimètre, à tous les zooms fins', () => {
  for (const z of [11, 13, 15, 17, 20]) {
    const t = tuileDeTest(z, 45.8326, 6.8652, HAUTEURS_RELIEF)
    const mesh = construis(t)
    const positions = mesh.geometry.attributes.position.array

    let magnitude = 0
    for (let k = 0; k < positions.length; k++) magnitude = Math.max(magnitude, Math.abs(Math.fround(positions[k])))
    const pasM = pasRepresentableM(magnitude)

    assert.ok(
      pasM <= 0.01,
      `z${z} : magnitude ${magnitude.toFixed(4)} → pas de ${pasM.toFixed(4)} m (limite 0,01 m)`,
    )
  }
})

// ⚠️ LE MODE D'ÉCHEC DE CETTE CORRECTION : un repère relatif mal posé ne se voit
// pas de près — chaque tuile a l'air parfaite — mais décale les tuiles les unes
// par rapport aux autres, et le globe se disloque à l'échelle planétaire.
// Ce test regarde donc les positions MONDIALES (matrice de l'objet comprise) et
// exige qu'elles retombent sur la sphère.
//
// La limite dépend du zoom, et ce n'est pas un arrangement : **le repère
// relatif ne rachète que ce qui est petit devant la tuile**. Une tuile z2 fait
// un quart de planète, ses sommets restent donc à ~70 unités de son centre et
// le pas y reste celui d'avant (0,34 m mesuré) — c'est sans conséquence, aucune
// donnée n'a cette finesse à z2. À partir de z11 la tuile mesure 0,3 unité, et
// là on exige le millimètre. Le seuil large des zooms grossiers garde quand
// même sa valeur : une origine mal posée décale d'une TUILE, soit des milliers
// de kilomètres.
test('la position mondiale des sommets retombe sur la sphère, à tous les zooms', () => {
  const coins = [
    [45.8326, 6.8652], // Chamonix
    [-33.86, 151.21], // Sydney, hémisphère sud
    [64.14, -21.94], // Reykjavik
    [0, 179.99], // antiméridien
    [82, -170], // haute latitude, longitude négative
  ]
  const rayon = R_GLOBE + ALTITUDE_FIXE_M * (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION

  for (const z of [2, 6, 11, 15]) {
    for (const [lat, lon] of coins) {
      const t = tuileDeTest(z, lat, lon)
      const mesh = construis(t)
      mesh.updateMatrixWorld(true)
      const G = grilleDe(mesh)
      const p = new THREE.Vector3()

      let pireM = 0
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const k = j * (G + 1) + i
          p.fromBufferAttribute(mesh.geometry.attributes.position, k).applyMatrix4(mesh.matrixWorld)
          const ll = tileToLatLon(t.x + i / G, t.y + j / G, t.z)
          const vrai = latLonToSphere(ll.lat, ll.lon, rayon)
          pireM = Math.max(pireM, p.distanceTo(vrai) * ORBITAL_M_PER_UNIT)
        }
      }
      const limiteM = z >= 11 ? 0.001 : 1
      assert.ok(
        pireM < limiteM,
        `z${z} ${lat}/${lon} : les sommets ont bougé de ${pireM.toFixed(5)} m (limite ${limiteM} m)`,
      )
    }
  }
})

// La jupe cache les fissures entre niveaux de détail : elle doit descendre vers
// le CENTRE DE LA PLANÈTE, pas vers le centre de la tuile. C'est le second
// endroit où un repère relatif se trompe en silence.
test('la jupe descend toujours vers le centre de la planète', () => {
  const t = tuileDeTest(11, 45.8326, 6.8652)
  const mesh = construis(t)
  mesh.updateMatrixWorld(true)
  const G = grilleDe(mesh)
  const nV = (G + 1) ** 2
  const attr = mesh.geometry.attributes.position
  const p = new THREE.Vector3()

  // premier sommet de jupe : la copie du coin nord-ouest, tirée vers le bas
  p.fromBufferAttribute(attr, nV).applyMatrix4(mesh.matrixWorld)
  const rJupe = p.length()
  p.fromBufferAttribute(attr, 0).applyMatrix4(mesh.matrixWorld)
  const rBord = p.length()

  assert.ok(rJupe < rBord, `la jupe (${rJupe.toFixed(4)}) ne descend pas sous le bord (${rBord.toFixed(4)})`)
  const chute = rBord - rJupe
  assert.ok(chute > 0.09 && chute < 0.91, `chute de jupe hors bornes : ${chute.toFixed(4)}`)
})

// ══════════ LA JUPE ET LE PLANCHER DU BLOC — Tâche P7 ═══════════════════════
//
// ⛔ **LE DÉFAUT.** Le rabattement de jupe (`skirtDrop`) vit dans la monnaie du
// GLOBE — entre 0,1 et 0,9 unité de scène sur une planète de rayon 100. Le bloc
// du crop, lui, fait **0,0507 à 0,0955 unité d'épaisseur** au relevé de La
// Réunion : la jupe traversait son fond et pendait dessous. Mesuré dans la page
// vivante, cadrage intérieur de la notation-01 : **2 186 px de tuile en
// 12 langues** sous l'arête basse de la paroi, contre **0** au socle — et c'est
// au pixel et à la colonne près le relevé du noteur (`F-jupes-N02.json`).
//
// ⚠️ **L'ORDRE EST LE PIÈGE, ET C'EST LUI QUE CES TESTS GARDENT.** Les parois
// exigent des tuiles bâties, donc le fond du bloc naît APRÈS les tuiles :
// borner dans `_buildMesh` seulement n'aurait rien changé au bloc d'ouverture.

/** Un globe factice qui porte les VRAIES méthodes de jupe. */
function globeFactice(crop = null, baseY = null, parois = null, plancherJupe = undefined) {
  return {
    exaggeration: EXAGERATION,
    group: new THREE.Group(),
    tiles: new Map(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _crop: crop,
    _baseYCrop: baseY,
    // ⚠️ **Tâche P13** : le plancher des jupes est le SOMMET DU CONGÉ, pas le
    // fond du bloc. `undefined` rend le repli sur `_baseYCrop`, c'est-à-dire la
    // géométrie d'avant P13, au bit près.
    _plancherJupeCrop: plancherJupe,
    _parois: parois,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
    _retaillerJupes() { return Globe.prototype._retaillerJupes.call(this) },
    _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
  }
}

/** Le rayon mondial du sommet de jupe `bi`, et celui de son sommet de bord. */
function rayonsJupe(mesh, bi = 0) {
  mesh.updateMatrixWorld(true)
  const G = grilleDe(mesh)
  const nV = (G + 1) ** 2
  const attr = mesh.geometry.attributes.position
  const p = new THREE.Vector3()
  p.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
  const jupe = p.length()
  p.fromBufferAttribute(attr, mesh.geometry.userData.jupe.bord[bi]).applyMatrix4(mesh.matrixWorld)
  return { jupe, bord: p.length() }
}

const CENTRE_P7 = { lat: 45.8326, lon: 6.8652 }
const REPERE_P7 = repereCrop({ centre: CENTRE_P7, zoom: 11 })

test('P7 · sans bloc, la jupe garde sa longueur AU BIT PRÈS — le défaut est neutre', () => {
  const t1 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const t2 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const nu = globeFactice()
  nu._buildMesh(t1)
  // le même maillage, bâti par le chemin d'avant : rabattement plein, sans garde
  const avecCrop = globeFactice(REPERE_P7, null, null) // un crop, mais AUCUNE paroi
  avecCrop._buildMesh(t2)
  const a = t1.mesh.geometry.attributes.position.array
  const b = t2.mesh.geometry.attributes.position.array
  assert.equal(a.length, b.length)
  let differents = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differents++
  assert.equal(differents, 0, 'un crop SANS parois ne doit pas toucher un seul bit de jupe')
  const r = rayonsJupe(t1.mesh)
  const chute = r.bord - r.jupe
  assert.ok(chute > 0.09 && chute < 0.91, `chute de jupe hors bornes : ${chute.toFixed(4)}`)

  // ⚠️ **CHAQUE SOMMET DE JUPE EST SOUS LE SIEN, PAS SOUS UN AUTRE.** Sans cette
  // assertion, une PERMUTATION des sommets de jupe (`dst = nV + bi + 1`) survit :
  // elle est appliquée partout, donc tous les comptes, toutes les distances et
  // même la comparaison « avant / après » restent d accord avec eux-mêmes.
  // Trouvée par la campagne de mutation de P7 (survivante 4c).
  const mesh = t1.mesh
  mesh.updateMatrixWorld(true)
  const G = grilleDe(mesh)
  const nV = (G + 1) ** 2
  const bord = mesh.geometry.userData.jupe.bord
  const attr = mesh.geometry.attributes.position
  const A = new THREE.Vector3()
  const Bv = new THREE.Vector3()
  let pireEcart = 0
  for (let bi = 0; bi < bord.length; bi++) {
    A.fromBufferAttribute(attr, bord[bi]).applyMatrix4(mesh.matrixWorld)
    Bv.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
    // colinéaires depuis le CENTRE de la planète : le sinus de l angle entre les
    // deux rayons doit être nul.
    const sin = A.clone().cross(Bv).length() / (A.length() * Bv.length())
    if (sin > pireEcart) pireEcart = sin
  }
  assert.ok(pireEcart < 1e-6, `un sommet de jupe n est pas sous SON sommet de bord : sinus ${pireEcart}`)
})

test('P7 · avec un bloc, la jupe s ARRÊTE au plancher, et pas un pouce plus bas', () => {
  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  // ⚠️ **LE PLANCHER EST DÉRIVÉ DU BORD MESURÉ, PAS POSÉ AU HASARD — ET C EST
  // UNE LEÇON PAYÉE ICI MÊME.** Premier jet : `baseY = −0,05`. Le bord de cette
  // tuile vit à **100,2825** (1 000 m d altitude × exagération 18), le
  // rabattement plein vaut **0,1**, la marge valait donc **0,3325** : la borne
  // ne mordait PAS et le test passait au vert sans rien garder. On pose donc le
  // fond à **0,06 sous le bord**, c est-à-dire dans la plage où la loi agit.
  const nu = globeFactice()
  nu._buildMesh(t)
  const rBord = rayonsJupe(t.mesh).bord
  const MARGE = 0.06 // < le rabattement plein (0,1) : la borne doit mordre
  const baseY = rBord - R_GLOBE - MARGE
  const plancher = R_GLOBE + baseY

  const t2 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const g = globeFactice(REPERE_P7, baseY, { faux: true })
  g._buildMesh(t2)
  const mesh = t2.mesh
  const G = grilleDe(mesh)
  const nV = (G + 1) ** 2
  const bord = mesh.geometry.userData.jupe.bord
  mesh.updateMatrixWorld(true)
  const attr = mesh.geometry.attributes.position
  const pt = new THREE.Vector3()
  let sousLePlancher = 0
  let touchent = 0
  for (let bi = 0; bi < bord.length; bi++) {
    pt.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
    const r = pt.length()
    if (r < plancher - 1e-4) sousLePlancher++
    if (Math.abs(r - plancher) < 1e-4) touchent++
  }
  assert.equal(sousLePlancher, 0, `${sousLePlancher} sommets de jupe passent SOUS le fond du bloc`)
  assert.equal(touchent, bord.length, 'la jupe ne s arrête pas AU plancher : elle a été supprimée, ou pas bornée')
})

test('P7 · `_rayonPlancherCrop` a DEUX gardes, et chacune empêche une faute', () => {
  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const baseY = -0.05
  const attendu = R_GLOBE + baseY
  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(t), attendu)
  // ① sans parois posées, PAS de plancher — sinon un `_baseYCrop` périmé
  //    raccourcirait la jupe de tout le globe
  assert.equal(globeFactice(REPERE_P7, baseY, null)._rayonPlancherCrop(t), 0)
  // ② une tuile HORS de l emprise du crop garde sa jupe : son rayon vaut lui
  //    aussi ~100, elle passerait sans ce tri
  const loin = tuileDeTest(11, -33.86, 151.21) // Sydney
  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(loin), 0)
  // ③ un `baseY` non fini n est pas un zéro silencieux
  assert.equal(globeFactice(REPERE_P7, NaN, { faux: true })._rayonPlancherCrop(t), 0)
  assert.equal(globeFactice(REPERE_P7, null, { faux: true })._rayonPlancherCrop(t), 0)
})

test('P13 · le plancher de jupe est le SOMMET DU CONGÉ, et sans congé c est le fond', () => {
  // ⛔ **CE QUE CETTE LIGNE RÉPARE, MESURÉ À L'ÉCRAN.** La jupe d'une tuile pend
  // à l'aplomb du bord de la tuile ; sous le sommet du congé, la silhouette du
  // mur RENTRE, donc la jupe dépasse par le bas. Relevé avec l'instrument du
  // noteur (`bandeDuMur`) : **82 px de tuile sous le bas du mur, en 4 langues**,
  // contre **0** dans l'état d'avant P13 rebâti à la même seconde — et **0 dès
  // qu'on éteint les jupes par `setDrawRange`**, ce qui les désigne sans les
  // supposer (`.banc/P13/P4-trainees-P13.json`).
  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const baseY = -0.05
  const arrondi = 0.0026
  const g = globeFactice(REPERE_P7, baseY, { faux: true }, baseY + arrondi)
  assert.equal(g._rayonPlancherCrop(t), R_GLOBE + baseY + arrondi)
  // ⚡ **ET LE REPLI EST EXACT** : sans congé, les deux valeurs coïncident, donc
  // la géométrie d'avant P13 est récupérable au bit près.
  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true }, baseY)._rayonPlancherCrop(t),
    globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(t))
  // et un plancher non fini ne remplace pas le fond par un zéro silencieux
  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true }, NaN)._rayonPlancherCrop(t), R_GLOBE + baseY)
  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true }, null)._rayonPlancherCrop(t), R_GLOBE + baseY)
  // ⚡ ET LA JUPE EST BIEN PLUS COURTE — exécuté, pas déduit du rayon seul
  assert.ok(g._rayonPlancherCrop(t) > globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(t),
    'le plancher du congé doit être PLUS HAUT que le fond du bloc')
})

test('P7 · `_retaillerJupe` est IDEMPOTENTE, et elle rend la jupe pleine quand le bloc part', () => {
  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
  const g = globeFactice()
  g._buildMesh(t)
  const pleine = Float32Array.from(t.mesh.geometry.attributes.position.array)
  const rBord = rayonsJupe(t.mesh).bord

  // le bloc arrive APRÈS la tuile — l ordre réel, et c est TOUT le sujet
  g._crop = REPERE_P7
  g._baseYCrop = rBord - R_GLOBE - 0.06 // la borne mord — voir le test précédent
  g._parois = { faux: true }
  g.tiles.set(t.key, t)
  // ⚠️ **LE TAMPON DOIT ÊTRE DÉCLARÉ SALE, SINON LE GPU GARDE L ANCIEN.** Une
  // retaille qui écrit dans le tableau sans lever `needsUpdate` ne change RIEN à
  // l écran, et aucune comparaison de tampon ne peut le voir : `version` est le
  // seul témoin. Trouvée par la campagne de mutation de P7 (survivante 4d).
  const versionAvant = t.mesh.geometry.attributes.position.version
  assert.equal(g._retaillerJupes(), 1)
  assert.ok(t.mesh.geometry.attributes.position.version > versionAvant,
    'la retaille n a pas levé `needsUpdate` : le GPU garde la jupe d avant')
  const borne = Float32Array.from(t.mesh.geometry.attributes.position.array)
  let bouges = 0
  for (let i = 0; i < pleine.length; i++) if (pleine[i] !== borne[i]) bouges++
  assert.ok(bouges > 0, 'la retaille n a bougé AUCUN sommet : elle ne fait rien')

  // ⚠️ IDEMPOTENTE : rappelée, elle rend le MÊME tampon. Une version qui
  // rabattrait depuis la position COURANTE creuserait à chaque appel.
  g._retaillerJupes()
  g._retaillerJupes()
  const encore = t.mesh.geometry.attributes.position.array
  for (let i = 0; i < borne.length; i++) assert.equal(encore[i], borne[i], `sommet ${i} a bougé au second appel`)

  // le bloc part : la jupe reprend sa pleine longueur, AU BIT PRÈS
  g._parois = null
  g._baseYCrop = null
  g._retaillerJupes()
  const rendue = t.mesh.geometry.attributes.position.array
  for (let i = 0; i < pleine.length; i++) assert.equal(rendue[i], pleine[i], `sommet ${i} n est pas revenu`)

  // ⚠️ **UNE TUILE SANS JUPE N EST PAS UNE TUILE RETAILLÉE.** Le compte que rend
  // `_retaillerJupes` est ce qui dit combien de jupes ont bougé ; le rendre vrai
  // pour un maillage sans `userData.jupe` en ferait un compte de TUILES.
  // Trouvée par la campagne de mutation de P7 (survivante 4e).
  assert.equal(g._retaillerJupe({ mesh: null }), false)
  assert.equal(g._retaillerJupe({ mesh: { geometry: { userData: {} } } }), false)
  assert.equal(g._retaillerJupe(undefined), false)
  g.tiles.set('sans-jupe', { mesh: { geometry: { userData: {} } } })
  assert.equal(g._retaillerJupes(), 1, 'une tuile sans jupe ne doit pas être comptée')
})

test('P7 · `poserParoisCrop` retaille, `retirerParoisCrop` rend — lecture de SOURCE', () => {
  // ⚠️ Garde-fou de SOURCE, DÉCLARÉ : les quatre tests ci-dessus prouvent le
  // comportement des méthodes ; celui-ci garde les DEUX appels qui les mettent
  // sur le chemin vivant, et la remise à nul du fond du bloc — le trou par
  // lequel un `_baseYCrop` périmé revenait.
  const s = fs.readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  const corps = s.replace(/\/\/[^\n]*/g, '')
  // ⚠️ **L'ORDRE, PAS L'ADJACENCE — corrigé à la Tâche P13.** La ligne
  // `this._retraitBaseCrop = …` s'est intercalée entre les deux (le retrait de
  // la base du bloc, que le rideau d'eau lit). Une assertion qui exigeait deux
  // lignes COLLÉES aurait interdit toute écriture entre elles ; ce qu'elle
  // garde, c'est que le fond soit posé AVANT que les jupes se retaillent.
  assert.match(corps, /this\._baseYCrop = solide\.baseY[\s\S]{0,400}?this\._retaillerJupes\(\)/)
  assert.match(corps, /this\._parois = null[\s\S]{0,600}?this\._baseYCrop = null[\s\S]{0,400}?this\._retaillerJupes\(\)/)
  assert.match(corps, /geo\.userData\.jupe = \{ nV, bord: border, rabattement: skirtDrop \}/)
  assert.match(corps, /this\._retaillerJupe\(t\)/)
})
