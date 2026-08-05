// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-regularite.mjs
//
// CE QUE COÛTE LA RÉGULARITÉ (Tâche 12, étape 2).
//
// Le damier ne charge pas le CHEMIN du tracé : il charge le plus petit CARRÉ
// qui le contient (damier-carre.js). C'est une décision d'Adrien, prise pour le
// résultat — pas de trou, forme régulière, arêtes de socle exactes, emprise de
// mer exacte. Elle a un prix, et ce prix n'avait jamais été chiffré.
//
// LE SURCOÛT SE MESURE EN CASES CHARGÉES, et une case, c'est ce que le rapport
// du 2026-07-27 a mesuré : un MNT de 1536² (9,4 Mo de tas), plus le maillage,
// les champs et les requêtes de tuiles qui vont avec.
//
// LES TROIS FORMES DEMANDÉES par le brief sont ici des tracés SYNTHÉTIQUES, en
// coordonnées monde directes — pas des GPX réels. C'est délibéré et c'est une
// limite : un GPX réel n'ajouterait que du bruit d'échantillonnage sur la même
// géométrie, mais il dirait, lui, à quelle FRÉQUENCE chaque forme se présente.
// Ce script ne répond pas à ça (voir le rapport, « ce que je n'ai pas pu
// mesurer »).
import { TERRAIN_SIZE } from '../../../src/terrain.js'
import { carreCouvrant, cellulesDuCarre } from '../../../src/damier-carre.js'
import { GRID_R, CARRE_COTE_MAX } from '../../../src/block-grid.js'

const MO_PAR_CASE = 9.4 // MNT 1536² en tuiles 512 px (block-grid.js:218-222)

// Le corps exact de `BlockGrid.cellsForTrack` (block-grid.js:352-361), sans sa
// projection lat/lon : on lui donne directement des points MONDE, pour que la
// mesure porte sur la géométrie du tracé et pas sur la géodésie.
function casesTouchees(pointsMonde) {
  const touchees = new Set()
  for (const p of pointsMonde) {
    const i = Math.round(p.x / TERRAIN_SIZE)
    const j = Math.round(p.z / TERRAIN_SIZE)
    if (Math.abs(i) > GRID_R || Math.abs(j) > GRID_R) continue
    touchees.add(`${i},${j}`)
  }
  return touchees
}

// échantillonne une courbe paramétrée tous les ~2 unités (un GPX de course est
// bien plus dense ; au-delà de ce pas le résultat ne bouge plus)
function trace(f, n = 2000) {
  const pts = []
  for (let k = 0; k <= n; k++) pts.push(f(k / n))
  return pts
}

const T = TERRAIN_SIZE
const FORMES = [
  ['ligne droite (diagonale du damier)', trace((t) => ({ x: (t * 2 - 1) * T, z: (t * 2 - 1) * T }))],
  ['ligne droite (un axe, est-ouest)', trace((t) => ({ x: (t * 2 - 1) * T, z: 0 }))],
  ['boucle (circuit fermé, rayon 1 bloc)', trace((t) => ({ x: Math.cos(t * 2 * Math.PI) * T, z: Math.sin(t * 2 * Math.PI) * T }))],
  ['aller-retour (sortir et revenir par le même chemin)',
    trace((t) => ({ x: (t < 0.5 ? t * 2 : 2 - t * 2) * 2 * T - T, z: 0 }))],
  ['aller-retour en L (le creux du L, cas cité par damier-carre.js)',
    trace((t) => (t < 0.5 ? { x: (t * 2) * 2 * T - T, z: -T } : { x: T, z: -T + (t - 0.5) * 2 * 2 * T }))],
]

console.log(`LE COÛT DE LA RÉGULARITÉ — cases chargées par le CARRÉ contre cases TOUCHÉES par le tracé`)
console.log(`(plafond du carré : CARRE_COTE_MAX = ${CARRE_COTE_MAX} ; une case ≈ ${MO_PAR_CASE} Mo de MNT)\n`)
console.log(`forme                                                 touchées  chargées  surcoût   Mo en plus`)
let pire = 0
for (const [nom, pts] of FORMES) {
  const touchees = casesTouchees(pts)
  const carre = carreCouvrant(touchees, { cotemax: CARRE_COTE_MAX })
  const chargees = cellulesDuCarre(carre)
  // le bloc central n'est jamais « chargé » par le damier : il est déjà là.
  const utiles = new Set([...touchees].filter((k) => k !== '0,0'))
  const surcout = utiles.size ? (chargees.size - utiles.size) / utiles.size : Infinity
  pire = Math.max(pire, surcout)
  console.log(`${nom.padEnd(52)}   ${String(utiles.size).padStart(5)}     ${String(chargees.size).padStart(5)}` +
    `   ${(surcout * 100).toFixed(0).padStart(5)} %   ${((chargees.size - utiles.size) * MO_PAR_CASE).toFixed(0).padStart(6)} Mo`)
}
console.log(`\nPIRE SURCOÛT MESURÉ : ${(pire * 100).toFixed(0)} %`)
console.log(pire > 0.4
  ? `⚠️ AU-DESSUS DU SEUIL DE 40 % du brief — la mesure remonte à Adrien, la décision reste la sienne.`
  : `sous le seuil de 40 % du brief.`)

// ══════ ET LE MÊME COMPTE EN MODE ZONE ISOLÉE (5×5) ═══════════════════════
// Là le carré n'est pas plafonné à 3 : `empriseVivante()` va jusqu'au 5×5.
console.log(`\nPour mémoire, le même calcul sans le plafond de 3 (mode zone isolée, jusqu'au 5×5) :`)
for (const [nom, pts] of FORMES) {
  const touchees = casesTouchees(pts)
  const chargees = cellulesDuCarre(carreCouvrant(touchees, { cotemax: 5 }))
  const utiles = new Set([...touchees].filter((k) => k !== '0,0'))
  const surcout = utiles.size ? (chargees.size - utiles.size) / utiles.size : Infinity
  console.log(`${nom.padEnd(52)}   ${String(utiles.size).padStart(5)}     ${String(chargees.size).padStart(5)}   ${(surcout * 100).toFixed(0).padStart(5)} %`)
}
