// LE GRAIN FBM DU RELIEF, CUIT UNE FOIS PAR (seed, échelle, résolution, taille).
//
// Mesuré à res 1024 : l'échantillonnage du MNT met 194 ms, dont **175 ms rien
// que pour ce bruit** (5 octaves de simplex par sommet, 1 050 625 sommets), et
// son coût est le MÊME quelle que soit son amplitude. Au réglage par défaut
// (detail 0,02) il déplace la surface de 0,19 px CSS en moyenne.
//
// ⚠️ Ce module ne cuit QUE la forme du bruit, pas son dosage. L'amplitude
// (`detail`) et l'atténuation côtière (`landFactor`, qui dépend du MNT) restent
// appliquées à la lecture — sans quoi le cache serait invalidé par le moindre
// coup de curseur de finesse, par chaque changement de zoom (detailForZoom) et
// par la bascule Classique↔Naturel (qui bride `detail`). Le champ, lui, ne
// dépend ni du MNT, ni du zoom, ni de l'exagération, ni de la palette :
// test/detail-noise.test.js le PROUVE, bit à bit, sur six combinaisons.
//
// ⚠️ DEUX VALEURS PAR SOMMET, EN DOUBLE PRÉCISION, et ce n'est pas du luxe.
// _makeDemSampler compose `detail·a + detail·0,35·b`. Cuire `a + 0,35·b` en une
// seule valeur puis multiplier par `detail` change le résultat sur 48 % des
// sommets ; cuire a et b en Float32 le change sur 100 % (mesuré). Les deux
// restent invisibles à l'œil — mais alors il n'y a plus d'identité bit à bit à
// opposer à un doute, et c'est justement la garantie qu'on est venu chercher.
// Coût assumé : 16 octets par sommet, soit 9,5 Mo à res 768 (16,8 Mo à 1024).
// (Le plan annonçait 4,2 Mo : c'était le chiffre du cache Float32 à une valeur,
//  celui qui ne tient pas l'identité.)
//
// ⚠️ DEUX ENTRÉES gardées, pas une. Le damier reconstruit ses voisins à
// res 256 (block-grid.js) entre deux reconstructions du bloc central : avec une
// entrée unique, chacun chasserait l'autre et le champ du héros serait recuit à
// chaque extension du damier. Deux entrées = héros + voisins, 10,5 Mo à res 768.
//
// ⚠️ `size` est un PARAMÈTRE (même raison qu'à grid-template.js) : terrain.js
// importe ce module, l'import en retour ferait un cycle ESM.
import { Simplex2, mulberry32, fbm } from './noise.js'

const MAX_ENTREES = 2
const cache = new Map() // clé → Float64Array, en ordre d'insertion (LRU simple)

/**
 * Les deux octaves du grain, entrelacées, à chaque sommet de la grille :
 * `champ[2i]` = fbm 3 octaves, `champ[2i+1]` = fbm 2 octaves décalé.
 * L'appelant compose `detail·champ[2i] + detail·0,35·champ[2i+1]`.
 * @returns {Float64Array} de longueur 2·(res+1)² — PARTAGÉ, en lecture seule.
 */
export function detailField(seed, detailScale, res, size) {
  const cle = `${seed}|${detailScale}|${res}|${size}`
  const memo = cache.get(cle)
  if (memo) {
    cache.delete(cle) // remis en queue : c'est lui le plus récemment servi
    cache.set(cle, memo)
    return memo
  }
  const s = new Simplex2(mulberry32(seed))
  const n = res + 1
  const champ = new Float64Array(n * n * 2)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    for (let ix = 0; ix < n; ix++) {
      const x = ix * seg - half
      const k = (iy * n + ix) * 2
      champ[k] = fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55)
      champ[k + 1] = fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
    }
  }
  cache.set(cle, champ)
  while (cache.size > MAX_ENTREES) cache.delete(cache.keys().next().value)
  return champ
}

/** Vide le cache — tests uniquement. */
export function clearDetailField() {
  cache.clear()
}

// ---------------------------------------------------------------------------
// LE COUPLAGE RÉSOLUTION ↔ FINESSE DU GRAIN
// ---------------------------------------------------------------------------
// Le grain a une taille propre, le maillage un pas : baisser la résolution sans
// baisser `detailScale` finit par demander au maillage de porter un motif plus
// fin que ses mailles. Il ne l'adoucit pas, il l'ALIASE — le grain cesse d'être
// une texture et devient du poivre et sel qui scintille dès que la caméra bouge.
//
// L'octave la plus fine est celle du second fbm à sa 2e octave :
// fréquence detailScale·4,1·2,2. Le critère ci-dessous compte combien de mailles
// couvrent une de ses longueurs d'onde.
//
// Mesuré (grille de vérité 3072, scratchpad/bloc/nyquist.mjs) — part du grain
// que le maillage PERD, et corrélation entre sommets voisins :
//
//   res 1024 → 2,53 mailles/λ | perd 11,9 % | corrélation 0,856 · texture
//   res  768 → 1,90           | perd 18,3 % | corrélation 0,782 · limite, tenu
//   res  512 → 1,27           | perd 30,1 % | corrélation 0,645 · limite basse
//   res  384 → 0,95           | perd 39,9 % | corrélation 0,533 · POIVRE ET SEL
//   res  256 → 0,63           | perd 54,4 % | corrélation 0,370 · POIVRE ET SEL
//
// ⚠️ Le plancher est posé à la valeur de 768, la dernière mesurée comme tenant.
// Pour descendre plus bas, diviser `detailScale` dans le même rapport que la
// résolution : le produit `res / detailScale` est ce que ce critère conserve.
export const GRAIN_MIN_SAMPLES = 1.9

/** Mailles par longueur d'onde de l'octave la plus fine du grain. */
export function grainSamplesPerCycle(res, detailScale, size) {
  const lambdaMin = 1 / (detailScale * 4.1 * 2.2)
  return lambdaMin / (size / res)
}
