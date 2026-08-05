// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-diffusion.mjs
//
// Combien coûte `BlockGrid.diffuseDuCentre()` sur un damier plein ?
// La question n'est pas oiseuse : cette tournée est rappelée à CHAQUE pas de
// curseur (intervalle des courbes, opacité de la grille, poli du matériau…), et
// l'audit du 2026-08-05 mettait en garde — `restyle()`, l'autre candidat,
// rejoue `setColorMode` sur 24 dalles et recuit la table de couleurs.
//
// Reproduction fidèle : mêmes types que les vrais uniformes (THREE.Color,
// THREE.Vector2, nombres nus), même nombre de dalles, même corps de boucle que
// `_copieDuCentre` (src/block-grid.js). Seul ce qui n'est pas mesuré change :
// pas de shader, pas de GPU — c'est du coût CPU de recopie, et c'est tout ce
// que cette tournée fait.
import * as THREE from 'three'

const DALLES = 24 // damier plein 5×5 moins le bloc central

const SCALAIRES = [
  'uContourInterval', 'uContourOpacity', 'uContourWeight', 'uGridStep', 'uGridOpacity',
  'uTint', 'uHeightContrast', 'uHeightPivot', 'uSlopeTint',
  'uMatNoiseOn', 'uMatNoiseAmt', 'uMatNoiseCut', 'uMatNoiseSoft', 'uMatAboveZero',
  'uLmOn', 'uLmFlowAmt',
]
const COULEURS = ['uContourColor', 'uGridColor', 'uOceanShallow', 'uOceanMid', 'uOceanDeep']
const MATIERE = ['roughness', 'metalness', 'envMapIntensity', 'transmission', 'bumpScale']

function faitTerrain(k) {
  const u = { uHeightRange: { value: new THREE.Vector2(-0.5 + k * 0.01, 2 + k * 0.01) } }
  for (const n of SCALAIRES) u[n] = { value: 0.1 + k * 0.001 }
  for (const n of COULEURS) u[n] = { value: new THREE.Color(0.2 + k * 0.001, 0.4, 0.6) }
  const material = {}
  for (const n of MATIERE) material[n] = 0.3 + k * 0.001
  return { mapUniforms: u, material }
}

// ── le corps exact de _copieDuCentre
function copieDuCentre(t, mt) {
  if (!t || !mt || t === mt) return
  const um = t.mapUniforms, uc = mt.mapUniforms
  if (!um || !uc) return
  um.uHeightRange.value.copy(uc.uHeightRange.value)
  for (const n of COULEURS) um[n].value.copy(uc[n].value)
  for (const n of SCALAIRES) um[n].value = uc[n].value
  const mm = t.material, mc = mt.material
  if (mm && mc) for (const n of MATIERE) mm[n] = mc[n]
}

const centre = faitTerrain(0)
const dalles = Array.from({ length: DALLES }, (_, i) => faitTerrain(i + 1))

const tournee = () => { for (const d of dalles) copieDuCentre(d, centre) }

for (let i = 0; i < 20000; i++) tournee() // chauffe le JIT
const N = 200000
const t0 = performance.now()
for (let i = 0; i < N; i++) tournee()
const dt = performance.now() - t0

const parTournee = (dt / N) * 1000
console.log(`diffuseDuCentre() sur ${DALLES} dalles : ${parTournee.toFixed(2)} µs par tournée`)
console.log(`  ${(parTournee / 16666.7 * 100).toFixed(4)} % d'une image à 60 Hz`)
console.log(`  un curseur traîné à 60 Hz : ${(parTournee * 60 / 1000).toFixed(3)} ms par seconde`)
console.log(`  (${DALLES} × ${1 + COULEURS.length + SCALAIRES.length} uniformes + ${MATIERE.length} scalaires de matière`)
console.log(`   = ${DALLES * (1 + COULEURS.length + SCALAIRES.length + MATIERE.length)} recopies, aucune texture recuite, aucun programme recompilé)`)
