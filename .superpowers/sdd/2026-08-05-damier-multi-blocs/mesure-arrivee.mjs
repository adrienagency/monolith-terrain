// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-arrivee.mjs
//
// COMBIEN COÛTE UNE SEULE ARRIVÉE DE DALLE, TOUS MOTIFS CUMULÉS ?
//
// La question léguée par les Tâches 3, 5 et 6 : `onGridChanged` part à CHAQUE
// dalle reçue et porte plusieurs motifs de reconstruction dans le MÊME tour de
// boucle synchrone — l'égalisation des hauteurs (murs), les coins de surface,
// le socle du héros, les textes. La mer en est sortie (recuit différé, Tâche 6).
// Trois tâches ont chiffré leur motif SÉPARÉMENT ; personne n'avait mesuré le
// CUMUL sur une même arrivée, c'est-à-dire le gel réellement vu à l'écran.
//
// CE QUI EST MESURÉ ICI, ET COMMENT
//   · le coût unitaire d'une reconstruction de mur : `buildSlabWalls` RÉELLE,
//     au maillage réel des voisines (NEIGHBOUR_RES = 256), sur un relief
//     analytique (aucun réseau, donc rejouable partout) ;
//   · le nombre de murs re-coulés PAR ARRIVÉE, en rejouant de vraies
//     séquences d'arrivée sur une vraie `BlockGrid` (`egaliseHauteurs` n'est
//     pas simulée : elle est appelée) ;
//   · le coût des coins de surface (`majCoinsSurface`), qui parcourt toutes
//     les cases à chaque arrivée ;
//   · le socle du héros (`plinth.rebuild` → `buildSlabWalls` au maillage du
//     HÉROS, resolution 768) et son garde : au plus 4 re-coulages sur une
//     rafale complète ;
//   · le plan d'eau : `merSuitLeDamier` reconstruit la mer quand la FORME du
//     carré change (`cleDuCarre`), et cette reconstruction commence par une
//     `PlaneGeometry` de 384² segments (ocean.js:1301). On compte ICI cette
//     seule géométrie — c'est un PLANCHER du coût de `waterRebuild`, pas son
//     total (matériau, lacs, jupe non comptés). Le recuit du champ, lui, est
//     sorti de la boucle depuis la Tâche 6 (différé de 300 ms) : il n'entre
//     pas dans ce cumul, et c'est tout l'intérêt de l'avoir sorti.
//
// CE QUI N'EST PAS MESURÉ ICI (et pourquoi) : la re-pose des textes gravés
// (`GroundInfoLayer.setCarre`) demande un canvas — chiffre repris de la
// Tâche 9, mesuré sur canvas réel : 1,8 ms, 3 re-poses pour 24 arrivées.
//
// ⚠️ LE COÛT UNITAIRE DÉPEND DE LA MACHINE. Le tableau du rapport porte la
// sienne ; ce script réimprime la sienne à chaque exécution.
import os from 'node:os'
import * as THREE from 'three'
import { BlockGrid, NEIGHBOUR_RES } from '../../../src/block-grid.js'
import { buildSlabWalls, rayonEauDansSocle } from '../../../src/plinth.js'
import { bordsExterieurs } from '../../../src/damier-bords.js'
import { cleDuCarre, geometrieDeMer } from '../../../src/damier-carre.js'
import { TERRAIN_SIZE } from '../../../src/terrain.js'

const RES_HERO = 768 // maillage du bloc central (terrain.js) — le socle du héros
const MS_TEXTES = 1.8 // Tâche 9, canvas réel : une re-pose du cartouche

// relief analytique : deux sinusoïdes croisées + une pente, pour que le
// contour du socle ne soit ni plat (cas dégénéré) ni aléatoire (rejouabilité)
function reliefDe(i, j) {
  const ph = (i * 7 + j * 13) * 0.37
  return (x, z) => 0.35 * Math.sin(x * 0.21 + ph) + 0.22 * Math.cos(z * 0.17 - ph) + (x + z) * 0.004 - 0.6 - (i * i + j * j) * 0.05
}

const scene = { add() {}, remove() {} }
const plinth = { wallMat: {}, depth: 7, aoBande: null, group: { visible: true }, baseY: -1.2 }

// ⚠️ DEUX MESURES SÉPARÉES, MULTIPLIÉES ENSUITE — et c'est délibéré. Compter
// les reconstructions sur 205 ordres d'arrivée × 2 scénarios × 2 tailles en
// BÂTISSANT chaque mur demanderait des heures (le pire cas du 5×5 en pose 300
// à lui seul, à ~10 ms pièce). Le COMPTE vient donc d'une vraie `BlockGrid`
// sans matériau de mur — `_rebuildCellWalls` sort alors immédiatement, sans
// rien changer au comptage de `egaliseHauteurs` — et le COÛT UNITAIRE d'une
// reconstruction est mesuré à part, sur la vraie `buildSlabWalls`.
function grilleNeuve({ compteSeulement = true } = {}) {
  return new BlockGrid({
    scene,
    params: { resolution: NEIGHBOUR_RES, slabCorner: 0.06, slabCornerSmoothing: 0.5 },
    getMainDem: () => null,
    getMainTerrain: () => null,
    getPlinth: () => (compteSeulement ? { ...plinth, wallMat: null } : plinth),
  })
}

// `fond` : la base propre de la cellule. Par défaut les cases lointaines
// descendent plus bas (relief plausible) ; le scénario adverse l'impose.
function celluleDe(i, j, fond = null) {
  const sample = reliefDe(i, j)
  return {
    i, j,
    terrain: { sample, setBordsDamier() {} },
    baseYPropre: fond ?? -1.2 - (i * i + j * j) * 0.05,
    planchierPose: null,
    bordsPoses: null,
    _paramsMurs: { resolution: NEIGHBOUR_RES, cornerR: 3.36, cornerExp: 2 },
  }
}

// ══════ 1. LE COÛT UNITAIRE D'UNE RECONSTRUCTION DE MUR ═══════════════════
function coutUnitaireMur(resolution, n = 12) {
  const sample = reliefDe(1, 1)
  const bords = { nord: true, est: false, sud: true, ouest: false }
  buildSlabWalls(sample, { depth: 7, resolution, cornerR: 3.36, cornerExp: 2, baseYFloor: -2, bords }) // chauffe
  const t = []
  for (let k = 0; k < n; k++) {
    const t0 = performance.now()
    buildSlabWalls(sample, { depth: 7, resolution, cornerR: 3.36, cornerExp: 2, baseYFloor: -2 - k * 0.001, bords })
    t.push(performance.now() - t0)
  }
  t.sort((a, b) => a - b)
  return t[t.length >> 1] // médiane
}

// ══════ 1 bis. LE PLANCHER DU COÛT DE `waterRebuild` : sa géométrie ═══════
function coutPlanDEau(cote, n = 5) {
  const m = geometrieDeMer({ cote, rayonEau: rayonEauDansSocle(), taille: TERRAIN_SIZE })
  new THREE.PlaneGeometry(m.large, m.large, m.seg, m.seg).dispose() // chauffe
  const t = []
  for (let k = 0; k < n; k++) {
    const t0 = performance.now()
    const g = new THREE.PlaneGeometry(m.large, m.large, m.seg, m.seg)
    g.rotateX(-Math.PI / 2)
    t.push(performance.now() - t0)
    g.dispose()
  }
  t.sort((a, b) => a - b)
  return { ms: t[n >> 1], seg: m.seg }
}

// ══════ 2. LE COÛT DE `majCoinsSurface` (toutes les cases, chaque arrivée) ══
function coutCoinsSurface(cases) {
  const posees = new Set(cases.map(([i, j]) => `${i},${j}`))
  const n = 20000
  for (let k = 0; k < 2000; k++) for (const [i, j] of cases) bordsExterieurs(i, j, posees)
  const t0 = performance.now()
  for (let k = 0; k < n; k++) for (const [i, j] of cases) bordsExterieurs(i, j, posees)
  return (performance.now() - t0) / n
}

// ══════ 3. LA RAFALE : combien de murs par arrivée, sur de vrais ordres ════
function voisinesDe(R) {
  const out = []
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i || j) out.push([i, j])
  return out
}

// une séquence d'arrivée = une permutation de l'ordre de chargement réseau.
// `adverse` : chaque arrivée bat le record de profondeur — le scénario nommé
// par la Tâche 3, celui qui produit la rafale maximale.
function rejoue(ordre, adverse = false, opts = {}) {
  const g = grilleNeuve(opts)
  const parArrivee = []
  let bordsHero = '1111'
  let recoulagesHero = 0
  let cleTextes = cleDuCarre(g.empriseVivante())
  let reposesTextes = 0
  let rang = 0
  for (const [i, j] of ordre) {
    rang++
    g.cells.set(`${i},${j}`, celluleDe(i, j, adverse ? -1.3 - rang : null))
    const murs = g.egaliseHauteurs()
    g.majCoinsSurface()
    const b = g.bordsHero()
    const cle = `${+b.nord}${+b.est}${+b.sud}${+b.ouest}`
    const hero = cle !== bordsHero
    if (hero) { bordsHero = cle; recoulagesHero++ }
    const cleC = cleDuCarre(g.empriseVivante())
    const textes = cleC !== cleTextes
    if (textes) { cleTextes = cleC; reposesTextes++ }
    parArrivee.push({ murs, hero, textes })
  }
  return { parArrivee, recoulagesHero, reposesTextes }
}

function ordres(cases, combien = 200) {
  const out = [
    [...cases],                                                     // par ligne
    [...cases].sort((a, b) => a[0] - b[0] || a[1] - b[1]),          // par colonne
    [...cases].sort((a, b) => Math.hypot(...a) - Math.hypot(...b)), // en spirale
    [...cases].reverse(),                                           // à rebours
    // le PIRE cas nommé par la Tâche 3 : la case la plus profonde arrive en
    // dernier, donc elle re-coule d'un coup tout ce qui est déjà posé
    [...cases].sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2)),
  ]
  // et des ordres réseau ordinaires, pseudo-aléatoires REPRODUCTIBLES
  let graine = 20260805
  const rnd = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648)
  for (let k = 0; k < combien; k++) {
    const a = [...cases]
    for (let m = a.length - 1; m > 0; m--) { const n = (rnd() * (m + 1)) | 0; [a[m], a[n]] = [a[n], a[m]] }
    out.push(a)
  }
  return out
}

// ══════ LE RELEVÉ ═══════════════════════════════════════════════════════════
const msMur = coutUnitaireMur(NEIGHBOUR_RES)
const msHero = coutUnitaireMur(RES_HERO)

// ⚠️ LA VÉRIFICATION QUI REND LE RACCOURCI HONNÊTE : compter sans bâtir doit
// donner EXACTEMENT le même nombre de reconstructions que bâtir pour de vrai.
// Sans elle, tout ce script mesurerait un damier qui ne re-coule rien.
{
  const ordre = voisinesDe(1)
  const sec = rejoue(ordre, true, { compteSeulement: true }).parArrivee.map((a) => a.murs)
  const vrai = rejoue(ordre, true, { compteSeulement: false }).parArrivee.map((a) => a.murs)
  if (sec.join(',') !== vrai.join(',')) {
    throw new Error(`le raccourci de comptage diverge : ${sec} vs ${vrai}`)
  }
  if (sec.reduce((s, n) => s + n, 0) === 0) throw new Error('aucune reconstruction comptée : le banc ne mesure rien')
  console.log(`CONTRÔLE : compter sans bâtir donne la même séquence que bâtir (${vrai.join('+')} murs sur un 3×3 adverse)`)
}

console.log(`MACHINE : ${os.cpus()[0]?.model?.trim()} — node ${process.version} — ${os.platform()} ${os.release()}`)
console.log(`COÛTS UNITAIRES (buildSlabWalls réelle, médiane de 12)`)
console.log(`  un mur de voisine (resolution ${NEIGHBOUR_RES}) : ${msMur.toFixed(2)} ms`)
console.log(`  le socle du héros  (resolution ${RES_HERO}) : ${msHero.toFixed(2)} ms`)
console.log(`  une re-pose des textes gravés            : ${MS_TEXTES.toFixed(2)} ms (Tâche 9, canvas réel)`)

for (const [nom, R] of [['3×3 (chemin GPX, CARRE_COTE_MAX = 3)', 1], ['5×5 (zone isolée, GRID_R = 2)', 2]]) {
  const cases = voisinesDe(R)
  const msCoins = coutCoinsSurface(cases)
  const eau = coutPlanDEau(2 * R + 1)
  console.log(`\n══ DAMIER ${nom} — ${cases.length} voisines`)
  console.log(`  majCoinsSurface() sur ${cases.length} cases : ${(msCoins * 1000).toFixed(1)} µs par arrivée`)
  console.log(`  plan d'eau (PlaneGeometry ${eau.seg}²) : ${eau.ms.toFixed(1)} ms — PLANCHER de waterRebuild`)
  for (const [scenario, adverse] of [['ordres réseau (200 tirages + 5 ordres nommés)', false],
    ['ADVERSE : chaque arrivée bat le record de profondeur', true]]) {
    let picMurs = 0
    let picMs = 0
    let picDetail = null
    let cumulMursMax = 0
    let cumulMursMin = Infinity
    let reposesMax = 0
    let heroMax = 0
    const picsParOrdre = []
    for (const ordre of ordres(cases)) {
      const { parArrivee, recoulagesHero, reposesTextes } = rejoue(ordre, adverse)
      let cumul = 0
      let picOrdre = 0
      for (const a of parArrivee) {
        cumul += a.murs
        // Le cumul SYNCHRONE d'une arrivée : murs + coins + socle du héros +
        // plan d'eau + textes. ⚠️ `merSuitLeDamier` et `cartoucheSuitLeDamier`
        // sont gardés par LA MÊME clé de carré : quand l'un part, l'autre part.
        const ms = a.murs * msMur + msCoins + (a.hero ? msHero : 0) +
          (a.textes ? eau.ms + MS_TEXTES : 0)
        picOrdre = Math.max(picOrdre, ms)
        if (ms > picMs) { picMs = ms; picDetail = { ...a, ms } }
        picMurs = Math.max(picMurs, a.murs)
      }
      picsParOrdre.push(picOrdre)
      cumulMursMax = Math.max(cumulMursMax, cumul)
      cumulMursMin = Math.min(cumulMursMin, cumul)
      reposesMax = Math.max(reposesMax, reposesTextes)
      heroMax = Math.max(heroMax, recoulagesHero)
    }
    picsParOrdre.sort((a, b) => a - b)
    const med = picsParOrdre[picsParOrdre.length >> 1]
    console.log(`  ── ${scenario}`)
    console.log(`     murs re-coulés, TOTAL sur le remplissage : ${cumulMursMin} à ${cumulMursMax}`)
    console.log(`     re-coulages du socle du héros (max)      : ${heroMax}` +
      `   re-poses des textes (max) : ${reposesMax}`)
    console.log(`     PIC de murs sur une SEULE arrivée        : ${picMurs}`)
    console.log(`     PIC de gel synchrone sur une arrivée     : ${picMs.toFixed(1)} ms` +
      ` (${picDetail.murs} murs${picDetail.hero ? ' + socle du héros' : ''}${picDetail.textes ? ' + plan d\'eau + textes' : ''})`)
    console.log(`     … ce même pic, ordre MÉDIAN              : ${med.toFixed(1)} ms`)
    console.log(`     images perdues à 60 Hz (16,7 ms)         : ` +
      `${(picMs / 16.667).toFixed(1)} au pire, ${(med / 16.667).toFixed(1)} en médian`)
  }
}
