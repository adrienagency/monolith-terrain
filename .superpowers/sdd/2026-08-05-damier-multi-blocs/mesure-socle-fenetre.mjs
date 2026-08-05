// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-socle-fenetre.mjs
//
// COMBIEN COÛTE LE SOCLE PAR IMAGE PENDANT UN GLISSEMENT DE FENÊTRE CONTINUE ?
//
// La question vient de la revue finale du damier : `main.js` rappelle
// `plinth.rebuild` à CHAQUE image où la fenêtre bouge, et deux commentaires
// (`main.js`, `fenetre-elan.js`) chiffrent ce rappel à **2,2 ms**. Le même
// dépôt mesure par ailleurs `plinth.rebuild` du bloc central — même fonction,
// même maillage — à **26,2 ms** (Tâche 12). Les deux ne peuvent pas être vrais.
//
// CE QUI EST MESURÉ ICI
//   · `buildSlabWalls` RÉELLE (le cœur de `plinth.rebuild` : tout le reste de la
//     méthode est de l'affectation), sur un relief analytique — aucun réseau,
//     donc rejouable partout ;
//   · un BALAYAGE de résolutions : 128 / 256 / 384 / 768. 384 est le plafond de
//     la fenêtre en mouvement (RES_FENETRE_CONTINUE), 768 la finesse au repos —
//     c'est-à-dire exactement le gain que la revue demande de chiffrer.
//
// ⚠️ CE QUI N'EST PAS MESURÉ : le reste de `plinth.rebuild` (dispose de l'ancienne
// géométrie, trois écritures de `position.y`) et la charge GPU du téléversement
// de la géométrie neuve. Les deux s'ajoutent au chiffre ci-dessous ; il est donc
// un PLANCHER, comme l'était celui de la Tâche 12.
//
// ⚠️ LE COÛT DÉPEND DE LA MACHINE. Le script réimprime la sienne.
import os from 'node:os'
import { buildSlabWalls } from '../../../src/plinth.js'
import { TERRAIN_SIZE } from '../../../src/terrain.js'

// même relief analytique que mesure-arrivee.mjs — deux sinusoïdes croisées et
// une pente : ni plat (cas dégénéré, contour trivial) ni aléatoire (rejouable)
const relief = (x, z) => 0.35 * Math.sin(x * 0.21) + 0.22 * Math.cos(z * 0.17) + (x + z) * 0.004 - 0.6

const RES = [128, 256, 384, 768]
const CHAUFFE = 3
const TOURS = 12

console.log(`machine : ${os.cpus()[0]?.model?.trim()} · node ${process.version} · TERRAIN_SIZE=${TERRAIN_SIZE}`)
console.log('\n  res │ médiane │  min   │  max   │ sommets')
console.log('  ────┼─────────┼────────┼────────┼─────────')
const median = {}
for (const resolution of RES) {
  const t = []
  let sommets = 0
  for (let k = 0; k < CHAUFFE + TOURS; k++) {
    const t0 = performance.now()
    const { geo } = buildSlabWalls(relief, { depth: 7, resolution, cornerR: 2.8, cornerExp: 2, baseYFloor: -8 })
    const ms = performance.now() - t0
    sommets = geo.getAttribute('position').count
    geo.dispose()
    if (k >= CHAUFFE) t.push(ms)
  }
  t.sort((a, b) => a - b)
  median[resolution] = t[t.length >> 1]
  const f = (v) => v.toFixed(1).padStart(6)
  console.log(`  ${String(resolution).padStart(3)} │ ${f(median[resolution])}  │ ${f(t[0])} │ ${f(t[t.length - 1])} │ ${String(sommets).padStart(7)}`)
}

const cher = median[768]
const bonMarche = median[384]
console.log(`\nCE QUE COÛTE UNE IMAGE DE GLISSEMENT, SOCLE SEUL :`)
console.log(`  · aujourd'hui (res 768, la valeur de params.resolution) : ${cher.toFixed(1)} ms`)
console.log(`  · si le socle suivait la fenêtre (res 384, comme le relief) : ${bonMarche.toFixed(1)} ms`)
console.log(`  · gain : ${(cher - bonMarche).toFixed(1)} ms par image (−${(100 * (1 - bonMarche / cher)).toFixed(0)} %)`)
console.log(`\nÀ COMPARER AU BUDGET ÉCRIT : « 9,9 + 2,2 = 12 ms » (fenetre-elan.js).`)
console.log(`  Le vrai total d'une image de lancer vaut 9,9 (tickFenetre, mesuré navigateur) + ${cher.toFixed(1)} = ${(9.9 + cher).toFixed(1)} ms.`)
