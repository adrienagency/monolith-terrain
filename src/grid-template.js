// GABARIT DE GRILLE — la partie d'un PlaneGeometry qui ne dépend QUE de la
// résolution, mémorisée une fois pour toutes.
//
// `new THREE.PlaneGeometry(56, 56, res, res)` + `rotateX` coûte, mesuré au
// `--expose-gc` : **194 ms et 262 Mo de tas JS jetés à res 1024**, 106 ms et
// 104 Mo à res 768. Le gabarit, lui, met 17 ms à la première cuisson puis
// **1 à 2 ms** en réutilisation, et n'alloue plus rien. La raison : three.js
// empile ses quatre tableaux dans des tableaux JS ordinaires
// (`vertices.push(x, -y, 0)`) avant de les convertir en tableaux typés — le
// tableau de doubles intermédiaire pèse deux fois le résultat, et il double de
// taille à chaque agrandissement. Or `Terrain.rebuild` réécrit ensuite TOUS
// les Y, TOUTES les normales et TOUTES les couleurs : du plan plat, seuls `uv`,
// `index` et les X/Z survivent — et ces trois-là ne dépendent que de la
// résolution et de la taille du bloc.
//
// ⚠️ IDENTITÉ BIT À BIT, et c'est tout l'enjeu. Les formules ci-dessous
// reproduisent exactement celles de three.js (PlaneGeometry.js, three 0.172) :
//   position : x = ix·segW − w/2 ; PlaneGeometry pousse (x, −y, 0) puis
//              rotateX(−π/2) envoie (x, Y, 0) sur (x, ~0, −Y), d'où
//              z = iy·segH − h/2. ⚠️ Garder CET ordre d'opérations et pas une
//              forme « équivalente » comme `(ix − res/2)·seg` : en virgule
//              flottante l'algèbre ne se réarrange pas gratuitement, et c'est
//              le genre de simplification qui passe le test sur une résolution
//              et le casse sur une autre.
//   uv       : (ix/gridX, 1 − iy/gridY)
//   index    : (a, b, d) puis (b, c, d), a = ix + gridX1·iy, b = a + gridX1,
//              c = b + 1, d = a + 1
// test/grid-template.test.js verrouille les trois contre PlaneGeometry, à
// quatre résolutions dont 768 (le bloc central) et 256 (les voisins du damier).
//
// ⚠️ Le Y du gabarit part à 0, alors que celui de PlaneGeometry vaut
// 6,12e-17·(h/2 − iy·segH) — le cosinus de −π/2 n'est pas exactement nul. Cet
// écart de 1,7e-15 unité est SANS objet : `rebuild` écrit tous les Y trois
// lignes plus bas. Le test ne compare donc que X et Z, et vérifie que Y part
// à 0 franc.
//
// ⚠️ LE GABARIT EST PARTAGÉ ET EN LECTURE SEULE.
//   — `position` DOIT être copié par l'appelant : il va y écrire ses Y, et deux
//     blocs du damier à la même résolution reçoivent le MÊME objet ; sans copie
//     le second hériterait du relief du premier.
//   — `uv` et `index`, eux, ne sont écrits par personne : ils sont branchés
//     TELS QUELS dans la géométrie. C'est 32 Mo d'allocation en moins par
//     reconstruction à res 1024. Si un jour du code se met à écrire dedans
//     (un `applyMatrix4` sur les uv, un `toNonIndexed`), il faudra copier —
//     et le bug se verrait sur tous les blocs à la fois.

const cache = new Map()

/**
 * Grille plate mémorisée, bit-identique à `new PlaneGeometry(size, size, res, res)`
 * suivi de `rotateX(-Math.PI / 2)`.
 * @returns {{position: Float32Array, uv: Float32Array, index: Uint32Array|Uint16Array, count: number}}
 */
export function gridTemplate(res, size) {
  const cle = `${res}|${size}`
  const memo = cache.get(cle)
  if (memo) return memo
  const n = res + 1
  const count = n * n
  const position = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  // ⚠️ Même règle que three (`arrayNeedsUint32`) : Uint32 dès qu'un index
  // atteint 65535 (réservé au PRIMITIVE_RESTART), Uint16 en dessous. Prendre
  // Uint32 partout doublerait la mémoire d'index des petits blocs.
  const index = count - 1 >= 65535 ? new Uint32Array(res * res * 6) : new Uint16Array(res * res * 6)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    const v = 1 - iy / res
    for (let ix = 0; ix < n; ix++) {
      const k = iy * n + ix
      position[k * 3] = ix * seg - half
      position[k * 3 + 2] = z
      uv[k * 2] = ix / res
      uv[k * 2 + 1] = v
    }
  }
  let p = 0
  for (let iy = 0; iy < res; iy++) {
    for (let ix = 0; ix < res; ix++) {
      const a = ix + n * iy
      const b = ix + n * (iy + 1)
      const c = ix + 1 + n * (iy + 1)
      const d = ix + 1 + n * iy
      index[p++] = a; index[p++] = b; index[p++] = d
      index[p++] = b; index[p++] = c; index[p++] = d
    }
  }
  const tpl = { position, uv, index, count }
  cache.set(cle, tpl)
  return tpl
}

/** Vide le cache — tests uniquement. */
export function clearGridTemplates() {
  cache.clear()
}
