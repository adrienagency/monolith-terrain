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
