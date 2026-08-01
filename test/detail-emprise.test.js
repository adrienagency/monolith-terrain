// LE GRAIN DOIT ÊTRE SOLIDAIRE DU TERRAIN, PAS DE L'ÉCRAN.
//
// En mode continu la géométrie ne bouge pas : ce sont ses altitudes qui
// défilent. Un grain indexé sur la grille reste donc collé à l'écran, et le
// relief glisse dessous — un moirage immobile sur un paysage en mouvement
// (étude 3×3 §5.4). `detailFieldEmprise` cuit le même grain sur l'emprise
// ENTIÈRE, pour qu'on l'échantillonne en coordonnées MONDE.
//
// Ce fichier verrouille les deux propriétés dont tout le reste dépend :
//   1. le bloc central du champ d'emprise est le champ d'aujourd'hui, au bit
//      près à la précision de stockage — donc à décalage nul, rien ne change ;
//   2. lire le champ décalé d'un bloc revient à évaluer le grain un bloc plus
//      loin — donc en défilant, le grain suit vraiment le sol.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Simplex2, mulberry32, fbm } from '../src/noise.js'
import {
  detailField,
  clearDetailField,
  detailFieldEmprise,
  clearDetailFieldEmprise,
  accordeDetailScale,
  grainSamplesPerCycle,
  GRAIN_MIN_SAMPLES,
} from '../src/detail-noise.js'

const SIZE = 56

// Le grain exact en un point du MONDE, tel que _makeDemSampler le calcule.
function grainEnMonde(seed, detailScale, x, z) {
  const s = new Simplex2(mulberry32(seed))
  return [
    fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55),
    fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5),
  ]
}

test('le champ d’emprise a la forme annoncée', () => {
  clearDetailFieldEmprise()
  const res = 8
  const cote = 3
  const c = detailFieldEmprise(1, 0.4, res, SIZE, cote)
  const n = cote * res + 1
  assert.equal(c.length, n * n * 2)
  assert.equal(c.constructor.name, 'Float32Array')
})

test('LE BLOC CENTRAL EST LE CHAMP D’AUJOURD’HUI — à décalage nul, rien ne change', () => {
  // ⚠️ LA PROPRIÉTÉ CENTRALE. Si elle tombe, entrer en mode continu changerait
  // le relief à l'instant précis où l'on entre, sans qu'on ait rien fait bouger.
  // C'est l'invariant que toute cette branche défend depuis le jalon 1.
  clearDetailField()
  clearDetailFieldEmprise()
  const res = 12
  const cote = 3
  const seed = 7
  const ds = 0.4
  const bloc = detailField(seed, ds, res, SIZE)
  const emp = detailFieldEmprise(seed, ds, res, SIZE, cote)
  const n1 = res + 1
  const n = cote * res + 1
  const dec = (res * (cote - 1)) / 2
  for (let iy = 0; iy < n1; iy++) {
    for (let ix = 0; ix < n1; ix++) {
      const a = (iy * n1 + ix) * 2
      const b = ((iy + dec) * n + ix + dec) * 2
      // Float32 contre Float64 : l'égalité se juge à la précision de stockage.
      assert.equal(Math.fround(bloc[a]), emp[b], `octave 1 en (${ix},${iy})`)
      assert.equal(Math.fround(bloc[a + 1]), emp[b + 1], `octave 2 en (${ix},${iy})`)
    }
  }
})

test('un nœud du champ porte le grain de SON point du monde', () => {
  // C'est ce qui rend le champ échantillonnable en coordonnées monde : sans
  // cette correspondance, décaler la lecture décalerait n'importe quoi.
  clearDetailFieldEmprise()
  const res = 8
  const cote = 3
  const seed = 3
  const ds = 0.4
  const emp = detailFieldEmprise(seed, ds, res, SIZE, cote)
  const n = cote * res + 1
  const dec = (res * (cote - 1)) / 2
  const seg = SIZE / res
  const half = SIZE / 2
  for (const [jx, jz] of [
    [0, 0],
    [dec, dec],
    [dec + 3, dec - 5],
    [n - 1, n - 1],
  ]) {
    const [a, b] = grainEnMonde(seed, ds, (jx - dec) * seg - half, (jz - dec) * seg - half)
    const k = (jz * n + jx) * 2
    assert.equal(emp[k], Math.fround(a), `octave 1 au nœud (${jx},${jz})`)
    assert.equal(emp[k + 1], Math.fround(b), `octave 2 au nœud (${jx},${jz})`)
  }
})

test('DÉCALER LA LECTURE D’UN BLOC = REGARDER UN BLOC PLUS LOIN', () => {
  // La preuve que le grain suit le sol : lire le champ à l'index décalé de `res`
  // nœuds rend exactement le grain du point situé un bloc (56 unités) plus loin.
  clearDetailFieldEmprise()
  const res = 8
  const cote = 3
  const seed = 5
  const ds = 0.4
  const emp = detailFieldEmprise(seed, ds, res, SIZE, cote)
  const n = cote * res + 1
  const dec = (res * (cote - 1)) / 2
  const seg = SIZE / res
  const half = SIZE / 2
  for (const [ix, iy] of [
    [0, 0],
    [4, 2],
    [res, res],
  ]) {
    // le sommet (ix, iy) de la géométrie, lu avec un décalage de +1 bloc en x
    const k = ((iy + dec) * n + ix + dec + res) * 2
    const [a] = grainEnMonde(seed, ds, ix * seg - half + SIZE, iy * seg - half)
    assert.equal(emp[k], Math.fround(a), `sommet (${ix},${iy}) décalé d’un bloc`)
  }
})

test('le champ est mémorisé, et DEUX entrées sont gardées — les deux plus récentes', () => {
  // ⚠️ C'ÉTAIT UNE SEULE ENTRÉE JUSQU'AU JALON 4, et le changement est mesuré,
  // pas esthétique. Le motif d'alors — « le mode continu ne monte qu'une emprise
  // à la fois » — est tombé le jour où la résolution est devenue adaptative :
  // 384 en mouvement, 768 au repos, sur LA MÊME emprise. Avec une seule entrée,
  // chaque bascule chassait l'autre et repayait la cuisson entière : mesuré dans
  // le navigateur à Chamonix z12, **806,5 ms pour recuire le champ de res 768**,
  // contre 46,4 ms pour écrire le maillage. La deuxième entrée coûte 10,6 Mo
  // (le champ de res 384) et supprime ces 806 ms.
  clearDetailFieldEmprise()
  const a = detailFieldEmprise(1, 0.4, 8, SIZE, 3)
  assert.equal(detailFieldEmprise(1, 0.4, 8, SIZE, 3), a, 'même clé → même objet')
  const b = detailFieldEmprise(2, 0.4, 8, SIZE, 3)
  assert.notEqual(b, a, 'graine différente → champ différent')
  assert.equal(detailFieldEmprise(1, 0.4, 8, SIZE, 3), a, 'la première entrée est ENCORE là — c’est tout l’objet du jalon 4')

  // …mais la mémoire reste BORNÉE : une troisième chasse la plus ancienne.
  // À res 768 le champ pèse 42,5 Mo ; un cache non borné mangerait le budget.
  clearDetailFieldEmprise()
  const x = detailFieldEmprise(1, 0.4, 8, SIZE, 3)
  detailFieldEmprise(2, 0.4, 8, SIZE, 3)
  detailFieldEmprise(3, 0.4, 8, SIZE, 3)
  assert.notEqual(detailFieldEmprise(1, 0.4, 8, SIZE, 3), x, 'la plus ancienne doit avoir été chassée')
})

test('l’aller-retour 384 ↔ 768 sur la MÊME emprise ne recuit jamais — le cas du jalon 4', () => {
  // Le scénario réel : on descend au geste, on remonte au repos, on redescend au
  // geste suivant. Aucune de ces bascules ne doit recalculer quoi que ce soit.
  // (Le `detailScale` suit la résolution — `accordeDetailScale` — d'où les deux
  // valeurs : c'est bien la paire du mode continu, pas deux clés inventées.)
  clearDetailFieldEmprise()
  const bas = detailFieldEmprise(7, 0.4, 4, SIZE, 3)
  const haut = detailFieldEmprise(7, 0.8, 8, SIZE, 3)
  for (let i = 0; i < 5; i++) {
    assert.equal(detailFieldEmprise(7, 0.4, 4, SIZE, 3), bas, `aller ${i} : le champ grossier doit être servi de mémoire`)
    assert.equal(detailFieldEmprise(7, 0.8, 8, SIZE, 3), haut, `retour ${i} : le champ fin doit être servi de mémoire`)
  }
})

// ── L'ACCORD DU GRAIN AVEC LA RÉSOLUTION ─────────────────────────────────────

test('accorder le detailScale conserve la finesse du grain relative au maillage', () => {
  // C'est le couplage que detail-noise.js réclame en toutes lettres depuis qu'il
  // existe. Sans lui, le mode continu (res 384) afficherait un grain à 0,95
  // maille par longueur d'onde contre un plancher de 1,9 : du poivre et sel qui
  // scintille — et en mode continu, la caméra n'arrête pas de bouger.
  const ref = grainSamplesPerCycle(768, 0.8, SIZE)
  const accorde = accordeDetailScale(0.8, 768, 384)
  assert.equal(accorde, 0.4)
  assert.ok(Math.abs(grainSamplesPerCycle(384, accorde, SIZE) - ref) < 1e-12, 'la finesse relative doit être conservée')
  assert.ok(grainSamplesPerCycle(384, accorde, SIZE) >= GRAIN_MIN_SAMPLES, 'et rester au-dessus du plancher')
})

test('sans accord, res 384 est SOUS le plancher — c’est le défaut qu’on corrige', () => {
  assert.ok(grainSamplesPerCycle(384, 0.8, SIZE) < GRAIN_MIN_SAMPLES / 1.5, 'le défaut doit bien être là avant correction')
})

test('à résolution inchangée, l’accord ne change rien', () => {
  assert.equal(accordeDetailScale(0.8, 768, 768), 0.8)
})

test('des entrées absurdes ne renvoient pas NaN', () => {
  assert.equal(accordeDetailScale(0.8, 0, 384), 0.8)
  assert.equal(accordeDetailScale(0.8, 768, 0), 0.8)
})
