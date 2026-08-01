// L'ATLAS DE CHAMPS — les règles pures du jalon 2.
//
// Trois familles, et elles ne se recouvrent pas :
//
//  1. le MIN-pooling (`minPoolField`) — le seul sous-échantillonnage qui
//     PRÉSERVE LA CONNECTIVITÉ des zones basses, donc le seul qui puisse
//     nourrir un masque de mer topologique ;
//  2. la conversion du seuil de grand bassin (`fracBassinEmprise`) — une
//     fraction de dalle relue sur neuf dalles doit désigner la MÊME SURFACE ;
//  3. les UV d'atlas du fragment — vérifiées sur le SOURCE, parce qu'aucun
//     test node ne peut compiler ce GLSL et qu'une lecture restée en UV de
//     bloc est un défaut MUET (le champ s'affiche, il est simplement immobile
//     et trois fois trop grand).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { minPoolField, resampleField } from '../src/terrain-analysis.js'
import { buildSeaMask } from '../src/sea-mask.js'
import { fracBassinEmprise, ATLAS_ANALYSE, ATLAS_MER } from '../src/dem-emprise.js'
import { computeTerrainJob } from '../src/terrain-jobs.js'

const src = (p) => readFileSync(fileURLToPath(new URL(`../src/${p}`, import.meta.url)), 'utf8')

// ─────────────────────────────────────────────────────── 1. le MIN-pooling

test('minPoolField : cible nulle, égale ou plus grande → la source, SANS copie', () => {
  const f = Float32Array.from([1, 2, 3, 4])
  for (const cible of [0, -1, 2, 3, 99]) {
    const r = minPoolField(f, 2, cible)
    assert.equal(r.data, f, `cible ${cible} : le tableau doit être rendu tel quel`)
    assert.equal(r.size, 2)
  }
})

test('minPoolField : facteur 2 = le minimum de chaque bloc 2×2', () => {
  // 4×4 → 2×2
  const f = Float32Array.from([
    5, 9, 1, 2,
    7, 3, 8, 4,
    0, 6, 9, 9,
    2, 2, 9, 9,
  ])
  const r = minPoolField(f, 4, 2)
  assert.equal(r.size, 2)
  assert.deepEqual([...r.data], [3, 1, 0, 9])
})

test('minPoolField : un rapport non entier couvre tous les blocs qui SE RECOUVRENT', () => {
  // 3 → 2 : le bloc destination 0 couvre les sources [0, 1.5), le bloc 1 les
  // sources [1.5, 3) — la colonne 1 est donc lue par les DEUX. Un minimum qui
  // déborde ÉLARGIT les zones basses, ce qui est exactement la garantie qu'on
  // achète ; une moyenne pondérée, elle, les rétrécirait.
  const f = Float32Array.from([
    9, 1, 9,
    9, 9, 9,
    9, 9, 0,
  ])
  const r = minPoolField(f, 3, 2)
  assert.equal(r.size, 2)
  assert.deepEqual([...r.data], [1, 1, 9, 0])
})

test('minPoolField : jamais au-dessus de la moyenne — un minimum ne peut que descendre', () => {
  // relief pseudo-aléatoire déterministe, 48 → 16 (facteur entier) et 48 → 20
  // (facteur fractionnaire) : les deux chemins du code sont couverts.
  const n = 48
  const f = new Float32Array(n * n)
  let s = 12345
  for (let i = 0; i < f.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    f[i] = (s / 4294967296) * 200 - 50
  }
  for (const cible of [16, 20]) {
    const mn = minPoolField(f, n, cible)
    const moy = resampleField(f, n, cible)
    assert.equal(mn.size, moy.size)
    for (let i = 0; i < mn.data.length; i++) {
      assert.ok(mn.data[i] <= moy.data[i] + 1e-6, `texel ${i} (cible ${cible}) : ${mn.data[i]} > ${moy.data[i]}`)
    }
  }
})

test('minPoolField : les valeurs non finies sont ignorées, pas propagées', () => {
  const f = Float32Array.from([
    NaN, 4, 9, 9,
    6, 5, 9, 9,
    9, 9, NaN, NaN,
    9, 9, NaN, NaN,
  ])
  const r = minPoolField(f, 4, 2)
  assert.deepEqual([...r.data], [4, 9, 9, 0]) // bloc entièrement non fini → 0, comme coarsenField
})

test('minPoolField : accepte un Int16Array (le MNT recollé) et rend du Float32', () => {
  const f = Int16Array.from([10, -3, 40, 40, 20, 20, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40])
  const r = minPoolField(f, 4, 2)
  assert.ok(r.data instanceof Float32Array)
  assert.deepEqual([...r.data], [-3, 40, 40, 40])
})

// ─────────────────── LE PIÈGE DES CHENAUX, reproduit puis réparé ───────────
//
// C'est la raison d'être de tout ce qui précède, et elle ne se voit QUE sur un
// masque de mer : `resampleField` MOYENNE, donc un détroit large d'un pixel,
// moyenné avec ses berges, remonte au-dessus du seuil de 0,5 m. Le remplissage
// ne passe plus, la baie cesse d'être connectée au large, et — trop petite pour
// le critère de grand bassin — elle est PEINTE EN TERRE. Une vraie baie, bleue
// aujourd'hui, deviendrait verte à la seule faveur d'un sous-échantillonnage.
function relierBaieParUnChenal() {
  const n = 64
  const d = new Float32Array(n * n).fill(100) // tout en terre à +100 m
  const bas = -5
  // la haute mer : une bande contre le bord ouest, donc connectée au bord
  for (let y = 0; y < n; y++) for (let x = 0; x < 8; x++) d[y * n + x] = bas
  // la baie : 8×8 à l'intérieur, elle ne touche aucun bord
  for (let y = 20; y < 28; y++) for (let x = 20; x < 28; x++) d[y * n + x] = bas
  // LE CHENAL : UN SEUL PIXEL DE HAUT
  for (let x = 8; x < 20; x++) d[20 * n + x] = bas
  return { data: d, size: n }
}
const estMer = (m, size, y, x) => m.mask[y * size + x] === 255

test('le chenal d’un pixel : à pleine résolution la baie est de la mer', () => {
  const dem = relierBaieParUnChenal()
  const m = buildSeaMask(dem)
  assert.ok(estMer(m, dem.size, 24, 24), 'la baie doit être mer')
  assert.ok(estMer(m, dem.size, 24, 2), 'la haute mer doit être mer')
})

test('le chenal d’un pixel : la MOYENNE le sectionne et peint la baie en TERRE', () => {
  const dem = relierBaieParUnChenal()
  const r = resampleField(dem.data, dem.size, 32)
  const m = buildSeaMask({ data: r.data, size: r.size })
  assert.ok(estMer(m, r.size, 12, 2), 'la haute mer reste mer — elle touche le bord')
  assert.equal(estMer(m, r.size, 12, 12), false, 'c’est LE DÉFAUT : la baie est devenue terre')
})

test('le chenal d’un pixel : le MIN-pooling le préserve, la baie reste mer', () => {
  const dem = relierBaieParUnChenal()
  const r = minPoolField(dem.data, dem.size, 32)
  const m = buildSeaMask({ data: r.data, size: r.size })
  assert.ok(estMer(m, r.size, 12, 12), 'la baie doit rester mer')
  assert.ok(estMer(m, r.size, 12, 2), 'et la haute mer aussi')
})

test('la garantie de l’étude : une vraie mer ne peut que RESTER mer', () => {
  // le minimum ne peut qu'ÉLARGIR les zones basses : tout ce qui était bas le
  // reste, donc tout ce qui touchait le bord le touche encore.
  const dem = relierBaieParUnChenal()
  const plein = buildSeaMask(dem)
  const r = minPoolField(dem.data, dem.size, 32)
  const reduit = buildSeaMask({ data: r.data, size: r.size })
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      // un texel réduit est mer dès qu'un de ses quatre sources l'était
      let source = false
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (estMer(plein, 64, y * 2 + dy, x * 2 + dx)) source = true
      if (source) assert.ok(estMer(reduit, 32, y, x), `texel (${y},${x}) : mer perdue au sous-échantillonnage`)
    }
  }
})

// ───────────────────── 2. le seuil de grand bassin, converti

test('fracBassinEmprise : la MÊME SURFACE ABSOLUE, à la cellule près', () => {
  // Le critère de `buildSeaMask` est `round(n × frac)` avec n = cellules du
  // champ. Sur une emprise de 3×3 blocs à densité égale, n est multiplié par 9 :
  // garder 2 % rendrait le seuil neuf fois plus exigeant, et les mers fermées
  // (Caspienne, mer Morte) basculeraient en terre d'un seul coup.
  for (const cote of [1, 2, 3, 4]) {
    for (const s of [512, 1024, 2304]) {
      const n1 = s * s
      const n9 = (s * cote) * (s * cote)
      const seuil1 = Math.round(n1 * 0.02)
      const seuil9 = Math.round(n9 * fracBassinEmprise(0.02, cote))
      assert.equal(seuil9, seuil1, `côte ${cote}, champ ${s}² : ${seuil9} ≠ ${seuil1}`)
    }
  }
})

test('fracBassinEmprise : hors mode continu elle ne change RIEN', () => {
  for (const cote of [undefined, null, 0, 1, NaN]) assert.equal(fracBassinEmprise(0.02, cote), 0.02)
})

test('les deux tailles d’atlas sont des multiples du MNT recollé — le chemin PAS CHER', () => {
  // `resampleField`/`minPoolField` retombent sur la moyenne de blocs entière
  // quand le rapport est entier ; un 2 303 forcerait le chemin fractionnaire,
  // deux fois plus cher pour rien.
  const mnt = 1536 * 3 // le MNT recollé d'une emprise 3×3 en tuiles 512 px
  for (const t of [ATLAS_ANALYSE, ATLAS_MER]) {
    assert.equal(mnt % t, 0, `${mnt} n’est pas divisible par ${t}`)
    assert.ok(t < mnt, 'un atlas plus grand que sa source ne gagnerait aucun détail')
  }
})

// ────────────── 3. les UV d'atlas du fragment, lues sur le source

test('les champs du fragment sont lus en UV D’ATLAS, pas en UV de bloc', () => {
  const t = src('terrain.js')
  // L'expression d'atlas : le décalage de fenêtre ajouté, l'emprise des masques
  // au dénominateur. Hors mode continu `uFenetre` vaut (0,0) et `uMaskSpan`
  // vaut 56 = `uSlabHalf * 2` — l'image est identique au bit près.
  const atlas = /\(vWorldPos\.xz - uBlockOffset \+ uFenetre\) \/ uMaskSpan \+ 0\.5/
  for (const [nom, uv] of [
    ['uCoastMask', 'cmUv'],
    ['uSeaMask', 'smUv'],
    ['uAnalysis', 'anUv'],
  ]) {
    const ligne = t.split('\n').find((l) => l.includes(`vec2 ${uv} = `))
    assert.ok(ligne, `la ligne qui calcule ${uv} (pour ${nom}) est introuvable`)
    assert.match(ligne, atlas, `${nom} lit encore en UV de bloc : le champ resterait immobile sous le relief`)
  }
})

test('uMaskSpan et uFenetre sont NEUTRES hors mode continu', () => {
  const t = src('terrain.js')
  // `_pousseFenetre` est le seul point d'écriture ; il doit rendre 56 et (0,0)
  // quand le MNT n'est pas une emprise.
  assert.match(t, /uMaskSpan\.value = TERRAIN_SIZE \* cote/)
  assert.match(t, /const cote = this\.dem\?\.empriseCote > 1 \? this\.dem\.empriseCote : 1/)
})

// ────────────── 4. le contrat d'égalité de `computeTerrainJob`

test('computeTerrainJob : sans les options d’emprise, le résultat est INCHANGÉ', () => {
  // test/terrain-jobs.test.js verrouille déjà l'égalité octet pour octet contre
  // `analyzeDem`/`buildSeaMask` ; ce test-ci verrouille l'autre bord : les deux
  // nouveaux arguments doivent être strictement opt-in.
  const n = 64
  const data = new Float32Array(n * n)
  let s = 7
  for (let i = 0; i < data.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    data[i] = (s / 4294967296) * 300 - 100
  }
  const base = computeTerrainJob({ data, size: n, metersPerPixel: 30, seaMax: 32 })
  const explicite = computeTerrainJob({ data, size: n, metersPerPixel: 30, seaMax: 32, merMinPool: false, minBasinFrac: 0.02 })
  assert.deepEqual([...explicite.sea], [...base.sea])
  assert.deepEqual([...explicite.analysis], [...base.analysis])
  // et le MIN-pooling, lui, DOIT changer quelque chose — sinon il ne sert à rien
  const pool = computeTerrainJob({ data, size: n, metersPerPixel: 30, seaMax: 32, merMinPool: true })
  assert.notDeepEqual([...pool.sea], [...base.sea])
  assert.deepEqual([...pool.analysis], [...base.analysis], 'l’analyse de relief ne doit PAS changer : elle garde sa moyenne')
})
