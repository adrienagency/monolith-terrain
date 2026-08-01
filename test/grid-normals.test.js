// LES NORMALES D'UNE GRILLE RÉGULIÈRE S'ÉCRIVENT, ELLES NE S'APPROXIMENT PAS.
//
// `geo.computeVertexNormals()` pèse 81 % de la fabrication d'une dalle : 89,9 ms
// sur les 95 ms mesurées à res 768. Il est GÉNÉRIQUE — il parcourt les triangles
// indexés, fait un produit vectoriel par face, accumule sur trois sommets, puis
// normalise. Sur la grille régulière de grid-template.js, cette somme de six
// faces a une FORME FERMÉE : on peut l'écrire en O(1) par sommet sans jamais
// toucher l'index. Mesuré in situ : 4,5 ms au lieu de 84 à 120 ms.
//
// ⚠️ UNE APPROXIMATION NE SUFFIT PAS, et c'est l'histoire de ce fichier. La
// première version calculait la normale par DIFFÉRENCES CENTRÉES — la tangente
// évaluée au sommet. Sur du relief synthétique lisse elle donnait 0,008°
// d'écart ; **sur du MNT réel elle donnait 1,6° en moyenne à Chamonix, 3,2° à
// La Réunion, et jusqu'à 119° au pire** (banc `f3-verif.mjs`, 2026-07-29). La
// raison : un MNT porte du bruit à la fréquence de Nyquist du maillage — une
// alternance d'un pixel sur deux. La différence centrée ne le VOIT PAS (elle
// lit hW et hE, jamais h0), là où la somme des faces le voit intégralement.
//
// Ce que ce fichier verrouille désormais :
//   1. L'ÉQUIVALENCE, pas une borne. La forme fermée doit rendre EXACTEMENT ce
//      que rend three, à l'arrondi Float32 près, y compris sur du bruit de
//      Nyquist — le cas qui a cassé la première version.
//   2. LES BORDS. Six faces à l'intérieur, trois ou une au coin : le compte des
//      faces existantes fait partie de la formule. Une normale fausse au bord
//      marque une couture sur le flanc du socle.
//   3. LE RELIEF ABSENT. Un champ plat (mer, dalle sans données) doit rendre
//      (0,1,0) FRANC, jamais un 0/0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { gridTemplate, clearGridTemplates } from '../src/grid-template.js'
import { gridNormals } from '../src/grid-normals.js'

const SIZE = 56

// Une géométrie de grille au relief `h(x, z)`, prête pour les deux méthodes.
// ⚠️ `h` reçoit AUSSI (ix, iy) : les reliefs qui imitent le bruit d'un MNT
// s'expriment en indices de maille, pas en unités-monde.
function grille(res, h) {
  clearGridTemplates()
  const tpl = gridTemplate(res, SIZE)
  const pos = new Float32Array(tpl.position)
  const n = res + 1
  for (let i = 0; i < tpl.count; i++) pos[i * 3 + 1] = h(pos[i * 3], pos[i * 3 + 2], i % n, (i / n) | 0)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(new THREE.BufferAttribute(tpl.index, 1))
  return { geo, pos, count: tpl.count }
}

function reference(res, h) {
  const { geo } = grille(res, h)
  geo.computeVertexNormals()
  return geo.attributes.normal.array
}

// Écart angulaire en degrés, séparé en INTÉRIEUR et BORD : les deux populations
// n'ont pas le même nombre de faces, et une erreur de bord ne doit pas se
// diluer dans les 591 000 sommets de l'intérieur.
function ecarts(a, b, res) {
  const n = res + 1
  const r = { moyen: 0, pire: 0, pireBord: 0, pireInterieur: 0, ouPire: -1 }
  for (let i = 0; i < n * n; i++) {
    const d = Math.min(1, Math.max(-1, a[i * 3] * b[i * 3] + a[i * 3 + 1] * b[i * 3 + 1] + a[i * 3 + 2] * b[i * 3 + 2]))
    const ang = (Math.acos(d) * 180) / Math.PI
    r.moyen += ang
    if (ang > r.pire) {
      r.pire = ang
      r.ouPire = i
    }
    const ix = i % n
    const iy = (i / n) | 0
    if (ix === 0 || iy === 0 || ix === res || iy === res) r.pireBord = Math.max(r.pireBord, ang)
    else r.pireInterieur = Math.max(r.pireInterieur, ang)
  }
  r.moyen /= n * n
  return r
}

// ⚠️ LE SEUIL N'EST PAS ZÉRO, et il ne peut pas l'être : three range ses
// normales en Float32, nous aussi, et `acos` est brutalement sensible près de
// 1 — un produit scalaire à 1 − 2e-8 rend déjà 0,011°. 0,05° est donc le
// plancher du bruit d'arrondi, pas une tolérance de modèle. Un signe inversé
// donnerait 20° ou 180° ; la différence centrée donnait 119°.
const ARRONDI_F32 = 0.05

test('un champ plat rend (0,1,0) FRANC, pas un 0/0 normalisé', () => {
  const { pos, count } = grille(32, () => 0)
  const n = gridNormals(pos, 32, SIZE)
  for (let i = 0; i < count; i++) {
    // ⚠️ `Math.abs` et non `assert.equal(…, 0)` : `-0 * 1` vaut `-0`, et
    // `assert.strict` distingue −0 de +0 là où le GPU ne les distingue pas.
    assert.equal(Math.abs(n[i * 3]), 0, `nx du sommet ${i}`)
    assert.equal(n[i * 3 + 1], 1, `ny du sommet ${i}`)
    assert.equal(Math.abs(n[i * 3 + 2]), 0, `nz du sommet ${i}`)
  }
})

test('un champ plat NON NUL (une mer à −3) rend aussi (0,1,0)', () => {
  const { pos, count } = grille(16, () => -3)
  const n = gridNormals(pos, 16, SIZE)
  for (let i = 0; i < count; i++) assert.equal(n[i * 3 + 1], 1)
})

// Sur une rampe affine, la surface EST son plan tangent : la normale a une
// valeur analytique, aux bords comme au centre. C'est le test qui verrouille la
// CONVENTION D'ORIENTATION (les deux signes, séparément) — un signe inversé sur
// un seul axe donne un relief éclairé à l'envers, et ça ne se voit qu'au
// coucher du soleil.
for (const [nom, h, attendu] of [
  ['montante en X', (x) => 0.37 * x, [-0.37, 1, 0]],
  ['descendante en X', (x) => -0.21 * x, [0.21, 1, 0]],
  ['montante en Z', (_x, z) => 0.53 * z, [0, 1, -0.53]],
  ['descendante en Z', (_x, z) => -0.14 * z, [0, 1, 0.14]],
  ['oblique', (x, z) => 0.29 * x - 0.11 * z, [-0.29, 1, 0.11]],
]) {
  test(`rampe ${nom} : normale analytique exacte, bords compris`, () => {
    const res = 24
    const { pos, count } = grille(res, h)
    const n = gridNormals(pos, res, SIZE)
    const l = Math.hypot(...attendu)
    const cible = attendu.map((v) => v / l)
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++)
        assert.ok(
          Math.abs(n[i * 3 + k] - cible[k]) < 1e-6,
          `sommet ${i} (ix=${i % (res + 1)}, iy=${(i / (res + 1)) | 0}) composante ${k} : ${n[i * 3 + k]} au lieu de ${cible[k]}`
        )
    }
  })
}

// ═══ LES TROIS RELIEFS QUI SÉPARENT UNE FORME FERMÉE D'UNE APPROXIMATION ═══
//
// Un relief courbe et lisse : n'importe quel schéma d'ordre 2 le passe. C'est
// exactement pour ça qu'il ne prouve rien tout seul.
const bosses = (x, z) =>
  2.4 * Math.sin(x * 0.21) * Math.cos(z * 0.17) +
  0.9 * Math.sin(x * 0.63 + 1.1) +
  0.4 * Math.cos(z * 0.91 - 0.3) +
  0.15 * Math.sin(x * 2.7) * Math.sin(z * 3.1)

// ⚠️ LE RELIEF QUI A CASSÉ LA PREMIÈRE VERSION. Un damier d'une maille de
// période : le signal exactement à la fréquence de Nyquist du maillage. La
// différence centrée lit hW et hE — qui sont ÉGAUX sur un damier — et conclut à
// un terrain plat. La somme des faces, elle, voit une surface en tôle ondulée.
// C'est ce que porte un vrai MNT : quantification en mètres, rééchantillonnage,
// bruit de capteur.
const nyquist = (_x, _z, ix, iy) => (((ix + iy) & 1) === 0 ? 0.9 : -0.9)

// Un MNT plausible : du relief lisse PLUS du bruit d'un pixel, comme en sort un
// SRTM quantifié. C'est le cas de production.
const mntBruite = (x, z, ix, iy) => {
  let g = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453
  g -= Math.floor(g)
  return bosses(x, z) + (g - 0.5) * 0.6
}

for (const [nom, h, resolutions] of [
  ['courbe et lisse', bosses, [96, 192, 384]],
  ['damier de Nyquist (le bruit qu\'aucune différence centrée ne voit)', nyquist, [64, 192, 385]],
  ['MNT bruité (relief lisse + bruit d\'un pixel)', mntBruite, [96, 192, 384]],
]) {
  test(`relief ${nom} : IDENTIQUE à computeVertexNormals`, () => {
    for (const res of resolutions) {
      const { pos } = grille(res, h)
      const n = gridNormals(pos, res, SIZE)
      const ref = reference(res, h)
      const e = ecarts(n, ref, res)
      assert.ok(
        e.pire < ARRONDI_F32,
        `res ${res} : pire écart ${e.pire.toFixed(4)}° au sommet ${e.ouPire} ` +
          `(moyen ${e.moyen.toFixed(5)}°, intérieur ${e.pireInterieur.toFixed(4)}°, bord ${e.pireBord.toFixed(4)}°)`
      )
    }
  })
}

test('LES BORDS ne sont plus un cas dégradé : même exactitude qu\'au centre', () => {
  // Avec les différences centrées, le bord portait un schéma d'ordre 1 et
  // concentrait tout l'écart. Avec la forme fermée il n'y a PLUS de cas
  // particulier : seulement moins de faces à sommer. Le test l'exige — le bord
  // ne doit pas être plus mauvais que l'arrondi Float32, comme le centre.
  const res = 384
  const { pos } = grille(res, mntBruite)
  const n = gridNormals(pos, res, SIZE)
  const ref = reference(res, mntBruite)
  const e = ecarts(n, ref, res)
  assert.ok(e.pireInterieur < ARRONDI_F32, `intérieur : ${e.pireInterieur.toFixed(4)}°`)
  assert.ok(e.pireBord < ARRONDI_F32, `bord : ${e.pireBord.toFixed(4)}°`)
})

test('LES QUATRE COINS : une face, trois faces — le compte doit être juste', () => {
  // Le coin (0,0) ne touche qu'UNE face, les coins (res,0) et (0,res) en
  // touchent trois, le coin (res,res) une seule. C'est le point le plus facile
  // à écrire de travers, et le plus invisible : quatre sommets sur 591 361.
  const res = 32
  const n1 = res + 1
  const { pos } = grille(res, mntBruite)
  const n = gridNormals(pos, res, SIZE)
  const ref = reference(res, mntBruite)
  for (const [ix, iy] of [
    [0, 0],
    [res, 0],
    [0, res],
    [res, res],
  ]) {
    const i = iy * n1 + ix
    const d = Math.min(1, Math.max(-1, n[i * 3] * ref[i * 3] + n[i * 3 + 1] * ref[i * 3 + 1] + n[i * 3 + 2] * ref[i * 3 + 2]))
    const ang = (Math.acos(d) * 180) / Math.PI
    assert.ok(ang < ARRONDI_F32, `coin (${ix},${iy}) : ${ang.toFixed(4)}° d'écart`)
  }
})

test('une falaise franche : identique aussi là où le gradient explose', () => {
  const res = 96
  // marche verticale ET plateaux plats : le cas où un schéma naïf divise par
  // zéro, et où le produit scalaire de deux normales presque horizontales perd
  // ses chiffres significatifs.
  const marche = (x, z) => (x > 0 ? 6 : 0) + (z > 4 ? -3 : 0)
  const { pos, count } = grille(res, marche)
  const n = gridNormals(pos, res, SIZE)
  const ref = reference(res, marche)
  const e = ecarts(n, ref, res)
  assert.ok(e.pire < ARRONDI_F32, `pire écart ${e.pire.toFixed(4)}°`)
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2])
    assert.ok(Number.isFinite(l), `sommet ${i} : longueur ${l}`)
    assert.ok(Math.abs(l - 1) < 1e-5, `sommet ${i} : longueur ${l}`)
    assert.ok(n[i * 3 + 1] > 0, `sommet ${i} : ny = ${n[i * 3 + 1]} — une normale de terrain pointe vers le haut`)
  }
})

test('le tableau de sortie peut être fourni (zéro allocation par image)', () => {
  const res = 16
  const { pos, count } = grille(res, bosses)
  const cible = new Float32Array(count * 3)
  const n = gridNormals(pos, res, SIZE, cible)
  assert.equal(n, cible, 'gridNormals doit écrire DANS le tableau fourni')
  const frais = gridNormals(pos, res, SIZE)
  for (let i = 0; i < count * 3; i++) assert.equal(cible[i], frais[i])
})

test('res impaire et segment non représentable en binaire', () => {
  // 17 : le cas qui piège une réécriture « équivalente » du pas de grille.
  const res = 17
  const { pos, count } = grille(res, (x) => 0.42 * x)
  const n = gridNormals(pos, res, SIZE)
  const l = Math.hypot(0.42, 1)
  for (let i = 0; i < count; i++) {
    assert.ok(Math.abs(n[i * 3] - -0.42 / l) < 1e-6, `sommet ${i}`)
    assert.ok(Math.abs(n[i * 3 + 1] - 1 / l) < 1e-6, `sommet ${i}`)
  }
})

test('res = 1 : quatre sommets, deux triangles, aucun intérieur', () => {
  // Le cas limite où la boucle d'intérieur ne tourne pas une seule fois.
  const res = 1
  const { pos, count } = grille(res, (x, z) => 0.3 * x + 0.2 * z)
  const n = gridNormals(pos, res, SIZE)
  const ref = reference(res, (x, z) => 0.3 * x + 0.2 * z)
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(n[i * 3 + k] - ref[i * 3 + k]) < 1e-5, `sommet ${i} composante ${k}`)
})
