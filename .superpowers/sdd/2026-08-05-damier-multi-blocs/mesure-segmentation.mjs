// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-segmentation.mjs
//
// COMBIEN DE SEGMENTS POUR LA MER D'UN DAMIER ? (Tâche 7)
//
// La Tâche 6 a posé `seg = min(384, 256 × côté)` en le disant PROVISOIRE et NON
// MESURÉ. Ce script relève ce qui se mesure hors navigateur, et pose le repère
// qui décide : LA DENSITÉ DU BLOC SEUL. Un bloc isolé porte 256 segments sur
// 55,888 unités — 4,581 segments par unité — et c'est cette mer-là qu'Adrien a
// validée à l'écran (« vraiment top », captures du 2026-08-05). Toute
// segmentation de damier se juge donc en pourcentage de CETTE densité : c'est
// le seul étalon dont on dispose qui ait été vu par un œil humain.
//
// CE QUI EST MESURÉ ICI
//   · quadrilatères, sommets, octets de la géométrie (attributs réels) ;
//   · le temps de construction de la `PlaneGeometry` — payé sur le fil
//     principal à chaque changement de FORME du carré (ocean.js:1301) ;
//   · la densité, et le nombre de segments par LONGUEUR D'ONDE des vagues,
//     qui décide de l'escalier de crête (critère de Nyquist).
//
// CE QUI N'EST PAS MESURÉ ICI : les images par seconde et l'escalier VU. Ils
// demandent un contexte WebGL — voir banc-mer.html, dans le même dossier.
import os from 'node:os'
import * as THREE from 'three'
import { TERRAIN_SIZE } from '../../../src/terrain.js'
import { geometrieDeMer } from '../../../src/damier-carre.js'
import { rayonEauDansSocle } from '../../../src/plinth.js'
import { resChamp } from '../../../src/mer-emprise.js'

// ══════ LES VAGUES, EN UNITÉS DE SCÈNE ═════════════════════════════════════
// ocean-waves/index.js : trois systèmes, longueurs d'onde en « mètres de
// spectre » — houle A 14 à 26, houle B 9 à 18, mer du vent 2,5 à 9.
// ocean.js:1267 : `lenSea = LEN_SCALE × clamp(waveScale, 0,55, 1)` avec
// LEN_SCALE = 0,42, soit 0,231 à 0,420 unité de scène par mètre de spectre.
// gerstner.glsl.js:21 : `k = k_spectre / lenScale`, donc λ_scène = λ_spectre ×
// lenScale. On prend le cas le PLUS EXIGEANT (lenSea minimal, zoom large) et
// le plus courant (lenSea maximal, zoom de course).
const LEN_MIN = 0.42 * 0.55
const LEN_MAX = 0.42
const ONDES = [
  ['mer du vent, la plus courte', 2.5],
  ['mer du vent, la plus longue', 9],
  ['houle B dominante', 13.5],
  ['houle A dominante', 20],
]

const mesuresDe = (cote, seg) => {
  const m = geometrieDeMer({ cote, rayonEau: rayonEauDansSocle(), taille: TERRAIN_SIZE })
  return { ...m, seg: seg ?? m.seg }
}

function construitEtMesure(large, seg, n = 5) {
  new THREE.PlaneGeometry(large, large, seg, seg).dispose() // chauffe
  const t = []
  let octets = 0
  let sommets = 0
  for (let k = 0; k < n; k++) {
    const t0 = performance.now()
    const g = new THREE.PlaneGeometry(large, large, seg, seg)
    g.rotateX(-Math.PI / 2)
    t.push(performance.now() - t0)
    if (k === n - 1) {
      sommets = g.getAttribute('position').count
      for (const nom of Object.keys(g.attributes)) octets += g.getAttribute(nom).array.byteLength
      octets += g.index.array.byteLength
    }
    g.dispose()
  }
  t.sort((a, b) => a - b)
  return { ms: t[n >> 1], octets, sommets }
}

console.log(`MACHINE : ${os.cpus()[0]?.model?.trim()} — node ${process.version} — three ${THREE.REVISION}`)
console.log(`\nÉTALON — LE BLOC SEUL, celui qu'Adrien a validé à l'écran :`)
const ref = mesuresDe(1)
const densiteRef = ref.seg / ref.large
console.log(`  côté 1 : large ${ref.large.toFixed(3)} u, seg ${ref.seg} → ${densiteRef.toFixed(3)} segment/unité`)

for (const cote of [2, 3, 5]) {
  const base = mesuresDe(cote)
  console.log(`\n══ DAMIER ${cote}×${cote} — plan d'eau de ${base.large.toFixed(3)} unités de côté` +
    `  (valeur en place : seg ${base.seg})`)
  console.log('  seg   quads       sommets     octets    construction   densité      % de l\'étalon')
  for (const seg of [256, 384, 512, 768]) {
    const { ms, octets, sommets } = construitEtMesure(base.large, seg)
    const densite = seg / base.large
    console.log(`  ${String(seg).padEnd(5)} ${String(seg * seg).padEnd(11)} ${String(sommets).padEnd(11)} ` +
      `${(octets / 1048576).toFixed(1).padStart(5)} Mo  ${ms.toFixed(1).padStart(7)} ms   ` +
      `${densite.toFixed(3).padStart(6)} s/u   ${((densite / densiteRef) * 100).toFixed(0).padStart(4)} %`)
  }
  if (cote !== 3) continue
  // ══════ L'ESCALIER DE CRÊTE : combien de segments par longueur d'onde ═════
  // Une onde a besoin de 2 échantillons pour EXISTER (Nyquist) et d'environ 6
  // pour ne pas se lire en facettes. En dessous de 2, elle ne disparaît pas
  // proprement : elle se replie (aliasing) et compose un moirage qui bouge
  // avec la caméra — le « une seule ligne de vagues » d'ocean.js:54-57.
  console.log(`\n  ESCALIER DE CRÊTE — segments par longueur d'onde sur ce ${cote}×${cote}`)
  console.log(`  (λ scène = λ spectre × lenSea ; lenSea ∈ [${LEN_MIN.toFixed(3)}, ${LEN_MAX.toFixed(2)}])`)
  const pas = (seg) => base.large / seg
  console.log(`  onde                          λ scène        ` +
    [256, 384, 512, 768].map((s) => `seg ${s}`).join('   ') + `   (bloc seul)`)
  for (const [nom, lamSpec] of ONDES) {
    for (const [etiq, len] of [['zoom large', LEN_MIN], ['zoom de course', LEN_MAX]]) {
      const lam = lamSpec * len
      const cols = [256, 384, 512, 768].map((s) => (lam / pas(s)).toFixed(1).padStart(7))
      const refCol = (lam / (ref.large / ref.seg)).toFixed(1)
      console.log(`  ${(nom + ', ' + etiq).padEnd(30)}${lam.toFixed(2).padStart(6)} u  ` +
        cols.join('  ') + `   ${refCol.padStart(7)}`)
    }
  }
  console.log(`  seuils : < 2 segments = onde repliée (moirage) ; < 6 = crête en facettes`)
}

// ══════ ÉTAPE 2 DU BRIEF : LE CHAMP ════════════════════════════════════════
console.log(`\n══ LE CHAMP DE LA MER (étape 2 du brief)`)
for (const cote of [1, 3, 5]) {
  const r = resChamp(cote)
  console.log(`  côté ${cote} : champ ${r}² = ${(r * r / 1e6).toFixed(2)} Mtexels, ` +
    `${(r * r * 4 / 1048576).toFixed(1)} Mo de texture RGBA8`)
}
console.log(`  temps de cuisson : voir mesure-cuisson.mjs (même dossier) — 1152² sans grain,`)
console.log(`  et le recuit est DIFFÉRÉ de ${300} ms depuis la Tâche 6 (ocean.js RECUIT_DIFFERE_MS).`)
