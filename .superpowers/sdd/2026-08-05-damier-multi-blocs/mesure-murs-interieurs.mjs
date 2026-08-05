// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-murs-interieurs.mjs
//
// CE QUE COÛTENT LES MURS INTÉRIEURS DU DAMIER (Tâche 12, étape 3).
//
// DÉCISION D5, PRISE ET NON REMISE EN CAUSE ICI : on les GARDE. Deux cases
// voisines gardent chacune son mur, dos à dos, invisibles — les retirer
// ouvrirait un jour à la couture le jour où deux MNT divergeraient d'un
// millimètre à la jointure (sources différentes, zooms différents, arrondi de
// tuile). Cette mesure ne rouvre pas la décision : elle en donne le prix.
//
// COMMENT ON COMPTE. Les murs sont une extrusion du contour du socle
// (plinth.js) : chaque segment du contour donne ses bandes de triangles, plus
// un fond. On classe donc chaque triangle par la FACE du bloc où tombe son
// centre — et on écarte le fond par sa normale (les normales de cette
// géométrie sont stockées vers l'intérieur : le fond rend (0, +1, 0), un mur
// rend l'horizontale, cf. plinth.js:345-352). Un triangle d'ARC DE COIN
// n'appartient à aucune face : il est compté à part et n'est jamais intérieur
// (le damier ne garde que les quatre coins du CARRÉ, damier-bords.js).
import * as THREE from 'three'
import { buildSlabWalls } from '../../../src/plinth.js'
import { TERRAIN_SIZE } from '../../../src/terrain.js'
import { bordsExterieurs } from '../../../src/damier-bords.js'
import { NEIGHBOUR_RES } from '../../../src/block-grid.js'
import { cellulesDuCarre } from '../../../src/damier-carre.js'

const HALF = TERRAIN_SIZE / 2
const RES_HERO = 768 // main.js:227 — le maillage du bloc central
const CORNER_R = 0.06 * TERRAIN_SIZE // params.slabCorner par défaut

const relief = (i, j) => (x, z) => 0.3 * Math.sin(x * 0.2 + i) + 0.2 * Math.cos(z * 0.17 + j) - 0.6

// triangles d'une géométrie de murs, ventilés par face du bloc
function ventile(geo) {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const out = { nord: 0, est: 0, sud: 0, ouest: 0, coins: 0, fond: 0 }
  const seuil = HALF - CORNER_R - 0.01
  for (let t = 0; t < pos.count; t += 3) {
    let cx = 0; let cz = 0; let ny = 0
    for (let k = 0; k < 3; k++) { cx += pos.getX(t + k); cz += pos.getZ(t + k); ny += nor.getY(t + k) }
    cx /= 3; cz /= 3; ny /= 3
    if (Math.abs(ny) > 0.9) { out.fond++; continue } // le fond, pas un mur
    if (Math.abs(cx) > seuil && Math.abs(cz) > seuil) { out.coins++; continue } // arc de coin
    if (Math.abs(cx) > Math.abs(cz)) out[cx > 0 ? 'est' : 'ouest']++
    else out[cz > 0 ? 'sud' : 'nord']++
  }
  return out
}

console.log(`LES MURS INTÉRIEURS D'UN DAMIER 3×3 — décision D5 : conservés, voici leur prix\n`)

// le 3×3 complet : le bloc central plus ses huit voisines
const cases = [...cellulesDuCarre({ i0: -1, j0: -1, cote: 3 })].map((k) => k.split(',').map(Number))
const posees = new Set(cases.map(([i, j]) => `${i},${j}`))
const toutes = [[0, 0], ...cases] // le héros compte aussi : ses quatre côtés sont intérieurs

let trianglesMurs = 0
let trianglesInterieurs = 0
console.log(`case      maillage  triangles de mur   côtés intérieurs   triangles intérieurs`)
for (const [i, j] of toutes) {
  const hero = i === 0 && j === 0
  const res = hero ? RES_HERO : NEIGHBOUR_RES
  // ⚠️ `bordsExterieurs` rend VRAI pour un côté qui touche le VIDE. Le bloc
  // central ne figure jamais dans les cases posées (block-grid.js le saute),
  // d'où l'ajout explicite ci-dessous pour que ses voisines le voient.
  const vues = new Set([...posees, '0,0'])
  const b = bordsExterieurs(i, j, vues)
  const { geo } = buildSlabWalls(relief(i, j), {
    depth: 7, resolution: res, cornerR: CORNER_R, cornerExp: 2, baseYFloor: -3, bords: b,
  })
  const v = ventile(geo)
  const murs = v.nord + v.est + v.sud + v.ouest + v.coins
  const interieurs = (b.nord ? 0 : v.nord) + (b.est ? 0 : v.est) + (b.sud ? 0 : v.sud) + (b.ouest ? 0 : v.ouest)
  const nbInt = [b.nord, b.est, b.sud, b.ouest].filter((x) => !x).length
  trianglesMurs += murs
  trianglesInterieurs += interieurs
  console.log(`${(hero ? 'héros' : `${i},${j}`).padEnd(9)} ${String(res).padStart(5)}    ` +
    `${String(murs).padStart(10)}       ${nbInt} / 4          ${String(interieurs).padStart(10)}`)
  geo.dispose()
}

// LE RESTE DE LA SCÈNE, pour rapporter les murs à un total. Le relief est une
// grille régulière : 2 × résolution² triangles (terrain.js ; le chiffre du
// bloc central, 1 179 648, est celui cité par block-grid.js:632).
const relHero = 2 * RES_HERO * RES_HERO
const relVoisine = 2 * NEIGHBOUR_RES * NEIGHBOUR_RES
const trianglesRelief = relHero + 8 * relVoisine
const total = trianglesRelief + trianglesMurs

console.log(`\nRELIEF   : ${relHero.toLocaleString('fr')} (héros, ${RES_HERO}²×2) + 8 × ${relVoisine.toLocaleString('fr')} ` +
  `(voisines, ${NEIGHBOUR_RES}²×2) = ${trianglesRelief.toLocaleString('fr')}`)
console.log(`MURS     : ${trianglesMurs.toLocaleString('fr')}`)
console.log(`TOTAL    : ${total.toLocaleString('fr')} triangles pour un damier 3×3`)
console.log(`\nMURS INTÉRIEURS : ${trianglesInterieurs.toLocaleString('fr')} triangles`)
console.log(`  = ${((trianglesInterieurs / trianglesMurs) * 100).toFixed(1)} % des murs`)
console.log(`  = ${((trianglesInterieurs / total) * 100).toFixed(2)} % de TOUS les triangles du damier`)
console.log(`\nSEUIL DU BRIEF : 10 % du total. ` +
  (trianglesInterieurs / total > 0.1
    ? '⚠️ DÉPASSÉ — à écrire dans le code comme piste connue, sans l\'implémenter.'
    : 'non atteint — rien à écrire comme piste, la décision D5 ne coûte pas ce qu\'on craignait.'))
