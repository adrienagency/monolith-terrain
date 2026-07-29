// LES GRAINS FBM DE LA GRILLE, CUITS UNE FOIS ET GARDÉS.
//
// Deux champs, deux mémoires, une seule règle : un motif qui ne dépend que de
// la GRILLE (graine, résolution, taille du bloc) n'a aucune raison d'être
// recalculé à chaque reconstruction du relief. `detailField` ci-dessous porte
// le grain de la GÉOMÉTRIE, `tintField` plus bas celui de la COULEUR.
//
// ─────────────────────────────────────────────────────────────────────────────
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
// LE GRAIN DE TEINTE, MÊME HISTOIRE — 65 ms par reconstruction
// ---------------------------------------------------------------------------
// `Terrain.rebuild` colore chaque sommet en trois termes : une valeur graduée
// par l'altitude, un assombrissement par la pente, et un grain FBM. Les deux
// premiers coûtent une poignée de multiplications ; le troisième est DEUX
// OCTAVES DE SIMPLEX PAR SOMMET, et c'est lui qui pèse — mesuré à La Réunion,
// MNT 1536², maillage 768 : 65 ms de fil principal figé sur les 168 ms de
// `terrain.rebuild`, à chaque zoom, pour recalculer un motif identique.
//
// ⚠️ ET IL NE DÉPEND QUE DE (graine, résolution, taille du bloc), exactement
// comme le gabarit de grille : ses seules entrées sont le x et le z du sommet,
// que grid-template.js pose sur une grille régulière. Ni le MNT, ni le zoom, ni
// l'exagération, ni la palette n'y entrent — c'est ce qui en fait un motif
// mémorisable, et test/detail-noise.test.js le vérifie.
//
// ⚠️ `Math.fround` N'EST PAS UN DÉTAIL. Le code d'origine lisait x et z dans
// l'attribut `position` de la géométrie, donc dans un Float32Array : il
// échantillonnait le bruit en coordonnées ARRONDIES au flottant simple. Cuire
// le champ sur les doubles `ix·seg − half` donnerait un motif très légèrement
// différent — invisible, mais alors il n'y a plus d'identité bit à bit à
// opposer à un doute, et c'est justement la garantie qu'on vient chercher.
//
// ⚠️ DOUBLE PRÉCISION, pour la même raison qu'au champ de détail. `rebuild`
// compose `v += champ[i]·0,05` avec `v` en double, avant de ranger le tout dans
// un Float32Array : cuire le champ en Float32 ferait un DOUBLE ARRONDI et
// changerait le dernier bit de la couleur sur une partie des sommets. Coût
// assumé : 8 octets par sommet, soit 4,7 Mo à res 768 et 8,4 Mo à res 1024 ;
// deux entrées gardées, héros + voisins du damier, comme au-dessus.
const MAX_TEINTE = 2
const cacheTeinte = new Map()

/**
 * Le grain FBM de la teinte par sommet, cuit sur la grille du gabarit.
 * L'appelant compose `v += champ[i] · 0,05`.
 * @param {number} seed graine DÉJÀ décalée par l'appelant (params.seed + 101).
 * @returns {Float64Array} de longueur (res+1)² — PARTAGÉ, en lecture seule.
 */
export function tintField(seed, res, size) {
  const cle = `${seed}|${res}|${size}`
  const memo = cacheTeinte.get(cle)
  if (memo) {
    cacheTeinte.delete(cle) // remis en queue : c'est lui le plus récemment servi
    cacheTeinte.set(cle, memo)
    return memo
  }
  const s = new Simplex2(mulberry32(seed))
  const n = res + 1
  const champ = new Float64Array(n * n)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = Math.fround(iy * seg - half)
    for (let ix = 0; ix < n; ix++) {
      champ[iy * n + ix] = fbm(s, Math.fround(ix * seg - half) * 1.7, z * 1.7, 2, 2.2, 0.5)
    }
  }
  cacheTeinte.set(cle, champ)
  while (cacheTeinte.size > MAX_TEINTE) cacheTeinte.delete(cacheTeinte.keys().next().value)
  return champ
}

/** Vide le cache de teinte — tests uniquement. */
export function clearTintField() {
  cacheTeinte.clear()
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
