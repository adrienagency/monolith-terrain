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
  const champ = cuireDetailField(seed, detailScale, res, size)
  cache.set(cle, champ)
  while (cache.size > MAX_ENTREES) cache.delete(cache.keys().next().value)
  return champ
}

/**
 * LA CUISSON SEULE, sans cache — Tâche FLU. C'est ce que le Worker de terrain
 * exécute (`terrain-jobs.js`, `kind: 'grain'`) : un Worker qui passerait par
 * `detailField` garderait dans SON cache un tableau qu'il vient de TRANSFÉRER,
 * c'est-à-dire un tableau détaché. Le fil principal range le résultat avec
 * `poserDetailField`. Le code est celui de `detailField`, déplacé, pas récrit.
 */
export function cuireDetailField(seed, detailScale, res, size) {
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
  return champ
}

/** Un champ cuit AILLEURS (le Worker) entre dans le cache, sous la même clé et la même éviction. */
export function poserDetailField(seed, detailScale, res, size, champ) {
  const cle = `${seed}|${detailScale}|${res}|${size}`
  if (cache.has(cle)) return false // déjà là (cuit en ligne entre-temps) : on ne remplace pas
  cache.set(cle, champ)
  while (cache.size > MAX_ENTREES) cache.delete(cache.keys().next().value)
  return true
}

/** Le champ est-il déjà en cache ? (sans le cuire) */
export function detailFieldEnCache(seed, detailScale, res, size) {
  return cache.has(`${seed}|${detailScale}|${res}|${size}`)
}

/** Vide le cache — tests uniquement. */
export function clearDetailField() {
  cache.clear()
}

// ---------------------------------------------------------------------------
// LE MÊME GRAIN, MAIS SUR L'EMPRISE 3×3 — pour qu'il soit SOLIDAIRE DU TERRAIN
// ---------------------------------------------------------------------------
// ⚠️ LE PIÈGE DU §5.4 DE L'ÉTUDE, ET IL EST BIEN RÉEL. `detailField` cuit le
// grain sur la grille de la GÉOMÉTRIE. En mode continu la géométrie ne bouge
// pas — ce sont ses altitudes qui défilent — donc le grain reste COLLÉ À
// L'ÉCRAN pendant que le relief glisse dessous. Un fin moirage immobile sur un
// paysage en mouvement : l'œil l'attrape tout de suite.
//
// La sortie est celle que l'étude nomme : cuire le grain sur l'emprise ENTIÈRE
// et l'échantillonner en coordonnées MONDE. Le champ devient alors un décor du
// terrain, pas de l'écran.
//
// ⚠️ LE BLOC CENTRAL DOIT RETOMBER SUR L'EXPRESSION EXACTE DE `detailField`.
// D'où le décalage entier `dec` et le `(jz − dec) · seg − half` : au nœud
// jz = dec + iy, l'expression se réduit littéralement à `iy · seg − half`, le
// calcul de `detailField` au bit près. Écrire `jz · seg − 3·half` donnerait la
// même valeur en mathématiques et une valeur différente en flottant, et on
// perdrait la seule chose qui permet d'affirmer qu'à décalage nul rien n'a
// changé. Un test le vérifie nœud par nœud.
//
// ⚠️ FLOAT32 ICI, ALORS QUE `detailField` EST EN FLOAT64, et c'est délibéré.
// La double précision de `detailField` sert à opposer une identité BIT À BIT au
// doute (voir plus haut). Ici il n'y a aucune identité à défendre : on
// INTERPOLE entre les nœuds, ce qui écarte de toute façon du fbm exact. Payer
// 21,3 Mo au lieu de 10,6 pour une garantie qui n'existe pas serait du gaspillage
// pur sur une machine dont le goulot est la bande passante mémoire.
//
// ⚠️ DEUX ENTRÉES, ET LA DEUXIÈME A ÉTÉ GAGNÉE AU CHRONOMÈTRE.
//
// Ce cache n'en gardait qu'UNE, au motif que « le mode continu ne monte qu'une
// emprise à la fois ». C'était vrai tant que le mode continu tenait une seule
// résolution (384 en permanence, jalon 3). Le jalon 4 en fait alterner deux sur
// LA MÊME emprise — 384 en mouvement, 768 au repos — et la prémisse tombe.
//
// MESURÉ dans le navigateur, sur l'instance VIVANTE (pas un second exemplaire
// du module rendu par un import() à la main), Chamonix z12 en 3×3 :
//
//     cuisson du champ, res 384 │ 204,0 ms │ à chaud : 0 ms
//     cuisson du champ, res 768 │ 806,5 ms │ à chaud : 0 ms
//     écriture du maillage      │  42,9 ms (384) · 46,4 ms (768)
//
// Avec une seule entrée, chaque bascule chassait l'autre résolution : le
// changement coûtait 216 ms vers le bas et **869 ms vers le haut** — une
// seconde de gel après chaque geste, alors que l'écriture du maillage
// elle-même n'en demande que 46. **93 % du coût était un recalcul évitable.**
//
// La deuxième entrée coûte le champ de res 384, soit **10,6 Mo** ((3×384+1)²
// × 2 × 4 octets), pour supprimer 806 ms par bascule.
//
// ⚠️ ET ÇA RESTE DEUX, PAS TROIS. À res 768 le champ pèse 42,5 Mo ; une
// troisième entrée (1024, que le sélecteur offre) en ajouterait 75 et ferait à
// elle seule un tiers du budget mémoire de l'application. C'est la raison
// d'être de `RES_REPOS_MAX` (fenetre-finesse.js) : le plafond du repos et la
// taille de ce cache sont le même arbitrage, vu des deux bouts.
const MAX_EMPRISE = 2
const cacheEmprise = new Map()

/**
 * Les deux octaves du grain sur toute l'emprise, entrelacées.
 * Le nœud (jx, jz) porte le grain du point monde
 * `((jx − dec)·seg − half, (jz − dec)·seg − half)`, avec `dec = res·(cote−1)/2`.
 *
 * @param {number} cote côté de l'emprise en blocs (3 pour un 3×3)
 * @returns {Float32Array} de longueur 2·(cote·res+1)² — PARTAGÉ, en lecture seule.
 */
export function detailFieldEmprise(seed, detailScale, res, size, cote) {
  const cle = `${seed}|${detailScale}|${res}|${size}|${cote}`
  const memo = cacheEmprise.get(cle)
  if (memo) {
    cacheEmprise.delete(cle) // remis en queue : c'est lui le plus récemment servi
    cacheEmprise.set(cle, memo)
    return memo
  }
  const s = new Simplex2(mulberry32(seed))
  const n = cote * res + 1
  const champ = new Float32Array(n * n * 2)
  const half = size / 2
  const seg = size / res
  const dec = (res * (cote - 1)) / 2
  for (let jz = 0; jz < n; jz++) {
    const z = (jz - dec) * seg - half
    for (let jx = 0; jx < n; jx++) {
      const x = (jx - dec) * seg - half
      const k = (jz * n + jx) * 2
      champ[k] = fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55)
      champ[k + 1] = fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
    }
  }
  cacheEmprise.set(cle, champ)
  while (cacheEmprise.size > MAX_EMPRISE) cacheEmprise.delete(cacheEmprise.keys().next().value)
  return champ
}

/** Vide le cache d'emprise — tests uniquement. */
export function clearDetailFieldEmprise() {
  cacheEmprise.clear()
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
  const champ = cuireTintField(seed, res, size)
  cacheTeinte.set(cle, champ)
  while (cacheTeinte.size > MAX_TEINTE) cacheTeinte.delete(cacheTeinte.keys().next().value)
  return champ
}

/** La cuisson seule, sans cache — même raison que `cuireDetailField` (Tâche FLU). */
export function cuireTintField(seed, res, size) {
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
  return champ
}

/** Un champ de teinte cuit ailleurs entre dans le cache — voir `poserDetailField`. */
export function poserTintField(seed, res, size, champ) {
  const cle = `${seed}|${res}|${size}`
  if (cacheTeinte.has(cle)) return false
  cacheTeinte.set(cle, champ)
  while (cacheTeinte.size > MAX_TEINTE) cacheTeinte.delete(cacheTeinte.keys().next().value)
  return true
}

export function tintFieldEnCache(seed, res, size) {
  return cacheTeinte.has(`${seed}|${res}|${size}`)
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

/**
 * Le `detailScale` qui garde le grain à la MÊME finesse relative au maillage.
 *
 * ⚠️ CE N'EST PAS UN CONFORT, C'EST LE COUPLAGE QUE CE FICHIER RÉCLAME depuis
 * qu'il existe : « pour descendre plus bas, diviser `detailScale` dans le même
 * rapport que la résolution ; le produit `res / detailScale` est ce que ce
 * critère conserve ». Le mode continu tombe à res 384 pour tenir son budget
 * d'image, et à 384 le grain d'origine vaut **0,95 maille par longueur d'onde**
 * contre un plancher de 1,9 : il n'est plus une texture, c'est du poivre et sel
 * qui scintille au moindre mouvement de caméra — et en mode continu la caméra
 * n'arrête pas de bouger. Le défaut serait donc PIRE là qu'ailleurs.
 *
 * Accordé, res 384 rend exactement les 1,901 maille/λ de res 768 : le grain a la
 * même apparence, il est simplement deux fois plus large en unités monde.
 */
export function accordeDetailScale(detailScale, resRef, res) {
  if (!(res > 0) || !(resRef > 0)) return detailScale
  // ⚠️ SORTIE SÈCHE À RÉSOLUTION ÉGALE, et ce n'est pas une optimisation : c'est
  // la garantie que le mode ORDINAIRE ne bouge pas d'un bit. `(d·res)/resRef`
  // rend 0,8000000000000002 pour d = 0,8 — assez pour invalider la clé du cache
  // du grain et faire recuire 175 ms de bruit sans que rien n'ait changé.
  if (res === resRef) return detailScale
  // ⚠️ `d · (res/resRef)` et non `(d · res)/resRef` : le rapport 384/768 vaut
  // 0,5 exactement, donc 0,8 × 0,5 = 0,4 exactement. L'autre ordre passe par
  // 307,2 et rend 0,4000000000000001.
  return detailScale * (res / resRef)
}
