// Lake DETECTION over the DEM — the one survivor of the old glass-water
// system (the glass sea/lakes were removed in v37; src/ocean.js renders all
// water now and feeds on this detector).
//
// Find connected near-flat regions above sea level in the raw DEM (meters).
// Water surfaces are EXACTLY flat in the source data (sub-meter after tile
// resampling), while a loose tolerance on a smooth slope grows "contour
// bands" — connected strips along a level set that are not water at all.
// The strongest water signature is the ELEVATION SPREAD inside the region:
// a real lake is flat to centimetres even when it is a long mountain ribbon
// (Annecy is 14 km by 3 km), while a contour band spans its whole ±tol range
// (~2*tolM). So: truly flat regions are accepted whatever their shape, and
// only regions with real internal spread must also look like blobs, which
// kills the bands without killing elongated lakes. Pure — unit-tested.
//
// ══════════ CE QUI COÛTAIT 930 ms ET 106 Mo SUR L'EMPRISE 3×3 ══════════════
//
// Mesuré sur MNT RÉEL dumpé du navigateur (leçon des normales : un banc
// synthétique ment), emprise 3×3 = 4 608², soit 21 233 664 cellules :
//
//   Annecy 3×3      930 ms → 23 lacs
//   La Réunion 3×3  878 ms → 5 composantes retenues, et ZÉRO lac après le
//                   filtre des 3 km d'ocean.js
//
// Le remplissage lui-même (parcours des 21 M cellules, 4 voisins chacune) ne
// pèse que **316 ms**. Les 600 ms restantes étaient de la COMPTABILITÉ PAR
// COMPOSANTE, et le détecteur en trouve **12 890 333** sur cette emprise :
//
//   · un tableau JS `cells` par composante, soit 12,9 millions d'allocations
//     pour 23 lacs finalement retenus ;
//   · une `Map` d'histogramme par composante, plus un `Map.set` par cellule —
//     21 millions d'écritures dans des tables de hachage.
//
// Et 106 Mo de tampons : `Int32Array(size²)` = 85 Mo pour la pile, plus 21 Mo
// de drapeaux `visited`. C'est ça, les « 101 Mo » relevés au navigateur.
//
// 🔴 LA DÉCOUVERTE QUI REND L'HISTOGRAMME INUTILE. Depuis `dem-quant.js`,
// `dem.data` est un **Int16Array en mètres ENTIERS**. Avec `tolM = 0.35`, deux
// voisins ne se rejoignent que s'ils portent le MÊME entier : toute composante
// est donc plate à zéro près. Relevé sur les deux MNT réels : **0 composante
// sur 12,9 millions** a un écart interne non nul. `maxH - minH <= flatM` passe
// TOUJOURS, donc `watery` est vrai avant même de regarder le mode, et la
// carte, le remplissage et la finesse ne décidaient de rien.
//
// D'où les trois gestes ci-dessous, tous à RÉSULTAT STRICTEMENT IDENTIQUE
// (test « témoin d'ensemble » et les neuf cas d'origine) :
//
//   1. la file de parcours EST la liste des cellules. En largeur d'abord, les
//      indices 0..end de la file contiennent exactement la composante — plus
//      un seul tableau JS par composante. L'ensemble trouvé ne change pas : le
//      critère de voisinage ne dépend que de la graine, jamais du chemin.
//   2. l'histogramme n'est construit QUE si l'écart interne dépasse `flatM`,
//      c'est-à-dire uniquement quand le mode sert vraiment à décider. Sur MNT
//      de production : jamais. En régime flottant : sur les seules composantes
//      qui ont déjà passé le plancher d'aire, en une passe sur des cellules
//      déjà rassemblées.
//   3. la boîte englobante sort de la boucle chaude. Elle ne servait qu'aux
//      composantes retenues (23 sur 12,9 millions) : la calculer pour toutes
//      coûtait une division et quatre comparaisons par cellule, 21 M fois.
//
// La file grandit à la demande au lieu de naître à `size²` : la plus grosse
// composante mesurée fait 253 408 cellules (1 Mo), pas 21 M. 85 Mo → ~1 Mo.
//
// ⚠️ LES CELLULES D'UN LAC SONT UNE COPIE, pas une vue sur la file commune.
// Servir des vues ferait écraser le premier lac par le second, en silence, et
// l'un des deux plans d'eau se poserait sur la forme de l'autre. Le test
// « deux lacs ne partagent pas leurs cellules » tient cette règle.
//
// ══════════ 🔴 CE QUE CE DÉTECTEUR NE SAIT PLUS FAIRE (2026-08-02) ══════════
//
// La découverte ci-dessus — sur MNT quantifié, `watery` est vrai partout — n'est
// pas seulement une occasion d'optimiser : c'est le constat que **la platitude
// ne distingue plus rien**. La tolérance effective n'est plus 0,35 m mais 1 m,
// et sur toute pente douce — plaine alluviale du Rhône, plateau côtier de
// Brest — chaque mètre entier découpe une DENTELLE de plusieurs kilomètres.
// Mesuré : Brest z12, 12,7 m/cellule, 20 « plans d'eau » couvrant 3,95 % du
// bloc, larges de 29 à 50 m, sur des terres que le trait de côte déclare TERRE.
//
// CE FICHIER N'A PAS ÉTÉ CHANGÉ POUR AUTANT, et c'est délibéré : ce qu'il rend
// reste une description géométrique honnête (« voici les composantes de même
// altitude »), et ses douze cas restent justes. C'est la DÉCISION qui manquait —
// « celle-ci mérite-t-elle une surface d'eau ? ». Elle vit dans
// **src/plan-eau.js**, elle se prend sur la LARGEUR au sol (une bande de contour
// n'a pas de largeur propre, une étendue d'eau si), et onze MNT réels la tiennent
// hors ligne dans test/garde-plans-eau.test.js — dont la MÊME eau à deux
// finesses, parce qu'un seuil peut sembler invariant sans l'être.
//
// ⚠️ N'AJOUTE PAS ICI UN QUATRIÈME SEUIL D'ALTITUDE. Trois critères purement
// géométriques ont été mesurés contre ces zones (remplissage de boîte, rebord
// aval, largeur) : les deux premiers ÉCHOUENT à séparer une plaine d'un vrai lac
// de barrage. Le tableau des mesures est en tête de plan-eau.js.
export function detectLakes(dem, { tolM = 0.35, minCells = null, minFill = 0.25, flatM = 0.15 } = {}) {
  if (!dem || !dem.data) return []
  const { data, size } = dem
  const n = size * size
  // area floor: scales with the grid so it stays a constant fraction of the
  // map. 12 keeps mid-size alpine lakes (Annecy is ~150 cells on a 768 grid
  // at a 330 km view) while still dropping single-cell noise flats.
  const min = minCells ?? Math.max(30, Math.round((size / 256) ** 2 * 12))
  const visited = new Uint8Array(n)
  // file de parcours en largeur : [0, end) EST la composante courante. Elle
  // démarre petite et double au besoin — la borne théorique est `n`, la borne
  // réelle mesurée est 253 408 cellules.
  let queue = new Int32Array(Math.min(n, 1 << 14))
  const lakes = []
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const h0 = data[start]
    if (h0 <= 1) continue // the sea owns everything at/below 0
    queue[0] = start
    let end = 1
    let minH = h0,
      maxH = h0
    for (let head = 0; head < end; head++) {
      // au plus quatre empilements par cellule traitée : on garantit la place
      // avant, plutôt qu'un test sur chacun des quatre sites
      if (end + 4 > queue.length) {
        const cap = Math.min(n, Math.max(queue.length * 2, end + 4))
        if (cap > queue.length) {
          const g = new Int32Array(cap)
          g.set(queue.subarray(0, end))
          queue = g
        }
      }
      const i = queue[head]
      const x = i % size
      const v = data[i]
      if (v < minH) minH = v
      if (v > maxH) maxH = v
      // 4-neighbourhood, same water surface = same elevation within tolerance
      if (x > 0 && !visited[i - 1] && Math.abs(data[i - 1] - h0) <= tolM) (visited[i - 1] = 1), (queue[end++] = i - 1)
      if (x < size - 1 && !visited[i + 1] && Math.abs(data[i + 1] - h0) <= tolM) (visited[i + 1] = 1), (queue[end++] = i + 1)
      // `i >= size` vaut `y > 0` et `i + size < n` vaut `y < size - 1` : la
      // ligne ne sert plus qu'à ça, une division de moins par cellule
      if (i >= size && !visited[i - size] && Math.abs(data[i - size] - h0) <= tolM)
        (visited[i - size] = 1), (queue[end++] = i - size)
      if (i + size < n && !visited[i + size] && Math.abs(data[i + size] - h0) <= tolM)
        (visited[i + size] = 1), (queue[end++] = i + size)
    }
    if (end < min) continue
    // ── à partir d'ici la composante est rare (23 sur 12,9 millions à Annecy
    // 3×3) : tout ce qui suit peut se permettre une seconde passe.
    let minX = size,
      maxX = -1,
      minY = size,
      maxY = -1
    for (let k = 0; k < end; k++) {
      const i = queue[k]
      const x = i % size
      const y = (i / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    // acceptance — water signature first, shape second:
    // · spread ≤ flatM: the surface is water-flat, accept ANY outline
    // · mode ≥ 60%: tile resampling wobbles a big lake's shoreline cells by
    //   up to ±tol (Léman spans the full 0.7 m at 160 km views, failing the
    //   spread test), but the BULK of a real lake still lands on one exact
    //   value — >60% of cells in a single 0.1 m bin. A contour band on a
    //   slope spreads uniformly across its range and never concentrates.
    // · otherwise fall back to the blob checks: a snaking band covers only a
    //   sliver of its bounding box (fill), a straight band is far thinner
    //   than a blob of the same area, whose narrow side ≈ √area (thinness)
    let watery = maxH - minH <= flatM
    if (!watery) {
      // 0.1 m bins — seul cas où le mode décide, donc seul cas où on paie
      const histo = new Map()
      for (let k = 0; k < end; k++) {
        const q = Math.round(data[queue[k]] * 10)
        histo.set(q, (histo.get(q) || 0) + 1)
      }
      let modeCount = 0
      for (const c of histo.values()) if (c > modeCount) modeCount = c
      watery = modeCount / end >= 0.6
    }
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const fill = end / (w * h)
    const thin = Math.min(w, h) < 0.4 * Math.sqrt(end)
    if (watery || (fill >= minFill && !thin)) lakes.push({ cells: queue.slice(0, end), elevM: h0, size })
  }
  return lakes
}
