// LE CARRÉ COUVRANT — la clé de voûte du damier multi-blocs.
//
// Un tracé GPX ne traverse qu'un chemin de cases, et charger ce seul chemin
// laisse des trous béants entre les cases. La règle : on prend la boîte
// englobante des cases traversées, on l'étend au CARRÉ, et on charge tout.
//
// ⚠️ POURQUOI UN CARRÉ ET PAS « LES CASES ADJACENTES À AU MOINS DEUX AUTRES ».
// Compter les adjacences ne rend PAS une forme rectangulaire : un tracé en L
// garde son L, avec le creux du L pour trou. C'est le RÉSULTAT qui est voulu
// — pas de trou, forme régulière — donc c'est lui qu'on calcule.
//
// Et ce n'est pas seulement esthétique. Le carré rend EXACTES quatre choses
// qui seraient sinon des heuristiques : quelles arêtes du socle sont
// extérieures (les arrondis), l'emprise de la mer, le tracé de sa jupe, et
// de combien les textes gravés doivent s'écarter du bloc.

const CLE = (i, j) => `${i},${j}`

const entier = (v) => (Number.isFinite(v) ? Math.round(v) : null)

function litCles(cellules) {
  const out = []
  if (!cellules) return out
  for (const k of cellules) {
    if (typeof k !== 'string') continue
    const parts = k.split(',')
    if (parts.length !== 2) continue
    const i = entier(Number(parts[0]))
    const j = entier(Number(parts[1]))
    if (i === null || j === null) continue
    out.push([i, j])
  }
  return out
}

/**
 * Le plus petit carré qui contient les cases données ET le bloc central,
 * plafonné à `cotemax` de côté.
 *
 * ⚠️ LE BLOC CENTRAL EST TOUJOURS DEDANS, et ce n'est pas négociable : il
 * porte le cartouche gravé, la rampe hypsométrique que les voisines
 * empruntent (terrain.js:1521) et le zéro vertical commun (block-grid.js:518).
 * Un carré qui l'excluerait laisserait un bloc hors grille.
 *
 * @param {Iterable<string>} cellules - clés "i,j"
 * @returns {{i0:number, j0:number, cote:number}} coin bas-gauche inclus + côté
 */
export function carreCouvrant(cellules, { cotemax = 3 } = {}) {
  const cles = litCles(cellules)
  // le centre participe toujours à la boîte englobante
  let iMin = 0
  let iMax = 0
  let jMin = 0
  let jMax = 0
  for (const [i, j] of cles) {
    if (i < iMin) iMin = i
    if (i > iMax) iMax = i
    if (j < jMin) jMin = j
    if (j > jMax) jMax = j
  }
  const plafond = Math.max(1, Math.round(cotemax))
  const cote = Math.min(plafond, Math.max(iMax - iMin + 1, jMax - jMin + 1))
  return { i0: ancre(iMin, iMax, cote), j0: ancre(jMin, jMax, cote), cote }
}

// Où poser le carré sur un axe. On veut trois choses, dans cet ordre :
// contenir le zéro (le bloc central), rester au plus près de la boîte
// demandée, et être DÉTERMINISTE — un damier qui change de forme selon
// l'ordre d'itération d'un Set se rebâtirait à chaque synchro.
function ancre(min, max, cote) {
  // centrer sur la boîte, puis arrondir vers le bas (choix arbitraire mais fixe)
  let a = Math.floor((min + max - cote + 1) / 2)
  // ne jamais laisser sortir la boîte demandée QUAND ELLE TIENT dans le côté.
  //
  // ⚠️ Le garde-fou `tient` est indispensable : si la boîte NE tient PAS
  // (débordement plafonné), les deux corrections ci-dessous se contredisent
  // — l'une pousse l'ancre vers min, l'autre la repousse vers max — et sans
  // garde c'est la seconde qui l'emporte à chaque fois, ce qui recolle le
  // carré au bord max au lieu de le garder centré sur zéro. Repéré via le
  // test « un tracé qui déborde est ramené à 3x3 sans trou » : sans ce
  // garde-fou, carreCouvrant(['-2,-2','2,2']) rendait {i0:0} au lieu de
  // {i0:-1}, un carré [0,2] qui sort du 3x3 attendu.
  const tient = max - min + 1 <= cote
  if (tient) {
    if (a > min) a = min
    if (a + cote - 1 < max) a = max - cote + 1
  }
  // et toujours contenir le zéro
  if (a > 0) a = 0
  if (a + cote - 1 < 0) a = -(cote - 1)
  return a
}

/**
 * Toutes les cases du carré, **centre exclu** — le bloc central n'appartient
 * pas au damier (cf. block-grid.js:178, la boucle saute i===0 && j===0).
 */
export function cellulesDuCarre({ i0, j0, cote } = {}) {
  const out = new Set()
  const c = Math.max(0, Math.round(cote ?? 0))
  for (let dj = 0; dj < c; dj++) {
    for (let di = 0; di < c; di++) {
      const i = i0 + di
      const j = j0 + dj
      if (i === 0 && j === 0) continue
      out.add(CLE(i, j))
    }
  }
  return out
}

/**
 * Rétrécit le carré tant qu'il demande plus de voisines que la machine n'en
 * supporte (`damierMax` de palier-machine.js : 24/12/8/4 selon la puissance).
 *
 * ⚠️ ON RÉTRÉCIT LE CÔTÉ, ON NE RETIRE PAS DES CASES. Retirer des cases
 * rouvrirait exactement le trou que tout ce module existe pour boucher.
 */
export function carreSousPlafond(carre, damierMax) {
  const max = Number.isFinite(damierMax) ? damierMax : Infinity
  let c = { ...carre }
  while (c.cote > 1 && cellulesDuCarre(c).size > max) {
    const cote = c.cote - 1
    c = { i0: ancre(c.i0, c.i0 + c.cote - 1, cote), j0: ancre(c.j0, c.j0 + c.cote - 1, cote), cote }
  }
  return c
}
