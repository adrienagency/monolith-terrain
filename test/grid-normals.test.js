// LES NORMALES D'UNE GRILLE RÉGULIÈRE S'ÉCRIVENT, ELLES NE SE DÉDUISENT PAS.
//
// `geo.computeVertexNormals()` pèse 81 % de la fabrication d'une dalle : 89,9 ms
// sur les 95 ms mesurées à res 768 (étude du 2026-07-29, §2.4). Il est générique
// — il parcourt les triangles indexés, fait un produit vectoriel par face,
// accumule sur trois sommets, puis normalise tout. Sur une grille régulière
// c'est du travail perdu : la normale s'écrit directement par DIFFÉRENCES
// CENTRÉES sur les quatre voisins, en O(1) par sommet, sans jamais toucher
// l'index. Mesuré : 5,10 ms au lieu de 89,87 ms — 17,6× moins cher.
//
// Ce test verrouille les trois choses qui pourraient se casser en silence :
//   1. LA CONVENTION D'ORIENTATION. `computeVertexNormals` de three sur
//      l'indexation de grid-template.js — triangles (a,b,d) puis (b,c,d) —
//      rend n = normalize(−∂h/∂x, 1, −∂h/∂z). Un signe inversé sur un seul des
//      deux axes donne un relief éclairé à l'envers, et c'est le genre de bug
//      qu'on ne voit qu'au coucher du soleil.
//   2. LES BORDS. C'est là que les schémas de différences se trompent : la
//      différence centrée n'existe pas, il faut une différence décentrée. Une
//      normale fausse au bord se voit comme une couture sur le flanc du socle.
//   3. LE RELIEF ABSENT. Un champ plat (mer, dalle sans données) doit rendre
//      (0,1,0) FRANC, pas un vecteur normalisé depuis un 0/0.
//
// ⚠️ L'écart avec `computeVertexNormals` n'est PAS nul et ne peut pas l'être :
// three moyenne des normales de FACES (pondérées par l'aire du produit
// vectoriel), la différence centrée évalue la tangente au SOMMET. Sur un plan
// et sur une rampe affine les deux coïncident exactement — c'est ce que
// vérifient les deux premiers cas. Sur un relief courbe ils diffèrent d'un
// terme du second ordre, mesuré à 0,008° en moyenne à res 768. Le test borne
// cet écart au lieu de le nier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { gridTemplate, clearGridTemplates } from '../src/grid-template.js'
import { gridNormals } from '../src/grid-normals.js'

const SIZE = 56

// Une géométrie de grille au relief `h(x, z)`, prête pour les deux méthodes.
function grille(res, h) {
  clearGridTemplates()
  const tpl = gridTemplate(res, SIZE)
  const pos = new Float32Array(tpl.position)
  for (let i = 0; i < tpl.count; i++) pos[i * 3 + 1] = h(pos[i * 3], pos[i * 3 + 2])
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

// écart angulaire en degrés entre deux tableaux de normales
function ecarts(a, b, count) {
  let somme = 0
  let pire = 0
  for (let i = 0; i < count; i++) {
    const d = Math.min(1, Math.max(-1, a[i * 3] * b[i * 3] + a[i * 3 + 1] * b[i * 3 + 1] + a[i * 3 + 2] * b[i * 3 + 2]))
    const ang = (Math.acos(d) * 180) / Math.PI
    somme += ang
    if (ang > pire) pire = ang
  }
  return { moyen: somme / count, pire }
}

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

// Sur une rampe affine, la surface EST son plan tangent : les deux méthodes
// doivent tomber sur la même normale, aux bords comme au centre. C'est le test
// qui verrouille la CONVENTION D'ORIENTATION (les deux signes, séparément).
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

  test(`rampe ${nom} : three.js est d'accord (la convention est la bonne)`, () => {
    const res = 8
    const { pos, count } = grille(res, h)
    const n = gridNormals(pos, res, SIZE)
    const ref = reference(res, h)
    const { pire } = ecarts(n, ref, count)
    // ⚠️ Le seuil n'est pas zéro : les normales de three sont stockées en
    // Float32, et `acos` est brutalement sensible près de 1 — un produit
    // scalaire à 1 − 2e-8 rend déjà 0,011°. Un signe inversé donnerait 20° ou
    // 180°, pas 0,02 : le seuil sépare sans ambiguïté.
    assert.ok(pire < 0.05, `écart maximal ${pire}° avec computeVertexNormals`)
  })
}

// Un relief courbe et bosselé : les deux méthodes ne peuvent plus coïncider
// exactement, mais l'écart doit rester sous le seuil de visibilité.
const bosses = (x, z) =>
  2.4 * Math.sin(x * 0.21) * Math.cos(z * 0.17) +
  0.9 * Math.sin(x * 0.63 + 1.1) +
  0.4 * Math.cos(z * 0.91 - 0.3) +
  0.15 * Math.sin(x * 2.7) * Math.sin(z * 3.1)

// ⚠️ `bosses` est un relief VOLONTAIREMENT plus tourmenté qu'un vrai MNT : son
// dernier terme oscille sur 2,3 unités-monde, soit 16 mailles à res 384. Les
// écarts mesurés ici sont donc un MAJORANT confortable de ce que donne du
// terrain réel (l'étude relève 0,008° de moyenne à res 768 sur Chamonix).
// Ce que le test verrouille n'est pas un chiffre choisi à la main, c'est la
// CONVERGENCE : l'écart doit se diviser par au moins 3 quand la résolution
// double. C'est la signature d'un schéma d'ordre 2 ; un schéma faux, lui, garde
// un écart constant ou le voit croître.
test('relief bosselé : l\'écart converge en O(pas²) quand la résolution double', () => {
  const mesures = []
  // ⚠️ On part de 192, pas de 96 : sous 192 le dernier terme de `bosses`
  // (2,3 unités de période) n'est pas encore résolu par la grille, et un
  // schéma n'a pas d'ordre sur un signal qu'il ne voit pas. Le régime
  // asymptotique commence à partir de ~8 mailles par oscillation.
  for (const res of [192, 384, 768]) {
    const { pos, count } = grille(res, bosses)
    const n = gridNormals(pos, res, SIZE)
    const ref = reference(res, bosses)
    mesures.push({ res, ...ecarts(n, ref, count) })
  }
  for (let k = 1; k < mesures.length; k++) {
    const r = mesures[k - 1].moyen / mesures[k].moyen
    assert.ok(
      r > 3,
      `res ${mesures[k - 1].res}→${mesures[k].res} : écart moyen ${mesures[k - 1].moyen.toFixed(4)}° → ` +
        `${mesures[k].moyen.toFixed(4)}°, rapport ${r.toFixed(2)} (attendu > 3, soit un ordre 2)`
    )
  }
  const fin = mesures[mesures.length - 1]
  assert.ok(fin.moyen < 0.2, `à res 768 l'écart moyen vaut ${fin.moyen.toFixed(4)}°`)
  assert.ok(fin.pire < 3.5, `à res 768 le pire écart vaut ${fin.pire.toFixed(4)}°`)
})

test('LES BORDS : le pire écart y est concentré, et il y reste borné', () => {
  // La différence décentrée du bord est un schéma d'ordre 1 là où l'intérieur
  // est d'ordre 2 : c'est là que l'écart se concentre, et c'est là qu'une
  // erreur se verrait — une normale fausse au bord marque une couture. On
  // vérifie donc les deux populations SÉPARÉMENT, et qu'elles sont bien dans
  // cet ordre-là (si le bord était meilleur que l'intérieur, c'est l'intérieur
  // qui serait faux).
  const res = 384
  const n1 = res + 1
  const { pos, count } = grille(res, bosses)
  const n = gridNormals(pos, res, SIZE)
  const ref = reference(res, bosses)
  let pireBord = 0
  let pireInterieur = 0
  for (let i = 0; i < count; i++) {
    const ix = i % n1
    const iy = (i / n1) | 0
    const d = Math.min(1, Math.max(-1, n[i * 3] * ref[i * 3] + n[i * 3 + 1] * ref[i * 3 + 1] + n[i * 3 + 2] * ref[i * 3 + 2]))
    const ang = (Math.acos(d) * 180) / Math.PI
    if (ix === 0 || iy === 0 || ix === res || iy === res) pireBord = Math.max(pireBord, ang)
    else pireInterieur = Math.max(pireInterieur, ang)
  }
  assert.ok(pireInterieur < 2, `intérieur : ${pireInterieur.toFixed(4)}°`)
  assert.ok(pireBord < 8, `bord : ${pireBord.toFixed(4)}°`)
  assert.ok(pireBord > pireInterieur, `le bord (${pireBord.toFixed(3)}°) devrait porter le pire écart, pas l'intérieur (${pireInterieur.toFixed(3)}°)`)
})

test('aucune normale n\'est NaN, et toutes sont unitaires', () => {
  const res = 96
  // un relief à falaises franches ET plateaux plats : le cas où un schéma naïf
  // divise par zéro ou explose
  const { pos, count } = grille(res, (x, z) => (x > 0 ? 6 : 0) + (z > 4 ? -3 : 0))
  const n = gridNormals(pos, res, SIZE)
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
