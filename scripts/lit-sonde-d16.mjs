// LECTEUR DE TRACE D16 — il ne décide de rien, il range.
//
//   node scripts/lit-sonde-d16.mjs <etiquette> [--volet descente|remontee|clic]
//                                  [--seuil-axe 0.5] [--seuil-img 2] [--top 40]
//
// ⚠️ **LES SEUILS SONT DES ARGUMENTS, PAS DES VÉRITÉS.** Le plancher de bruit se
// lit sur la trace `temoins`, pas ici.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const ETIQ = A[0] ?? 'd16'
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const VOLET = opt('--volet', 'descente')
const SA = Number(opt('--seuil-axe', '0.5'))
const SI = Number(opt('--seuil-img', '2'))
const TOP = Number(opt('--top', '40'))

const d = JSON.parse(fs.readFileSync(path.join(RACINE, '.banc', 'D16', ETIQ + '.json'), 'utf8'))
const l = d[VOLET] ?? []
console.log(`— ${ETIQ} / ${VOLET} : ${l.length} images — GPU ${d.gpu} — erreurs de page ${(d.erreurs || []).length}`)
if (!l.length) process.exit(0)

const num = (x) => (typeof x === 'number' && isFinite(x) ? x : null)
const quant = (k) => {
  const v = l.map((x) => num(x[k])).filter((x) => x != null).sort((a, b) => a - b)
  if (!v.length) return 'n/a'
  const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))]
  return `med ${q(0.5).toPrecision(4)}  p95 ${q(0.95).toPrecision(4)}  p99 ${q(0.99).toPrecision(4)}  MAX ${v[v.length - 1].toPrecision(5)}`
}
console.log('\n① POSITION   depl (unités bloc)  ', quant('depl'))
console.log('             deplRel (sans dim.)  ', quant('deplRel'))
console.log("             depl camGlobe (rel.) ", quant('deplGRel'))
console.log('② AXE        dVisee bloc (°)      ', quant('dVisee'))
console.log('             dIncl  bloc (°)      ', quant('dIncl'))
console.log('             dVisee camGlobe (°)  ', quant('dViseeG'))
console.log('             dIncl  camGlobe (°)  ', quant('dInclG'))
console.log('③ ÉCHELLE    rapport alt. cadrage ', quant('rAlt'))
console.log('             rapport alt. de fond ', quant('rAltFond'))
console.log('             rapport emprise bloc ', quant('rEmp'))
console.log('④ CONTENU    dImg (0-255)         ', quant('dImg'))
console.log('             dLum (0-255)         ', quant('dLum'))
console.log('   rythme    dt (ms)              ', quant('dt'))

const tri = (k, seuil) => l.filter((x) => num(x[k]) != null && x[k] > seuil).sort((a, b) => b[k] - a[k]).slice(0, TOP)
const ligne = (x) => `  n${String(x.n).padStart(5)} ${String(x.marque || '').padEnd(12)} ${String(x.modeAvant + '→' + x.mode).padEnd(18)} z${x.zoom ?? '-'} alt=${x.alt == null ? '-' : Math.round(x.alt)} fond=${x.altFond == null ? '-' : Math.round(x.altFond)} dt=${x.dt}ms | axeG=${(x.dViseeG ?? 0).toFixed(3)}° inclG=${(x.inclG ?? 0).toFixed(2)}° axeB=${(x.dVisee ?? 0).toFixed(3)}° | posG=${(x.deplGRel ?? 0).toExponential(2)} | ech=${(x.rAltFond ?? 1).toFixed(4)} | img=${(x.dImg ?? 0).toFixed(2)} lum=${(x.dLum ?? 0).toFixed(2)} | crop ${x.cropAvant}→${x.crop} | ${x.passes} | +${x.dTuiles}t/${x.dReq}r`

console.log(`\n══ ② AXE — écarts de visée de la caméra QUI REND (> ${SA}°)`)
tri('dViseeG', SA).forEach((x) => console.log(ligne(x)))
console.log(`\n══ ④ CONTENU — écarts d'image (> ${SI})`)
tri('dImg', SI).forEach((x) => console.log(ligne(x)))
console.log('\n══ ③ ÉCHELLE — plus grands rapports d\'altitude de fond')
tri('rAltFond', 1.02).forEach((x) => console.log(ligne(x)))
console.log('\n══ ① POSITION — plus grands déplacements relatifs de camGlobe')
tri('deplGRel', 0.02).forEach((x) => console.log(ligne(x)))

console.log('\n══ BASCULES D\'ÉTAT (mode, crop, zoom, jeu de passes)')
for (const x of l) {
  const zPrec = l[l.indexOf(x) - 1]
  if (x.mode !== x.modeAvant || x.crop !== x.cropAvant || (zPrec && zPrec.zoom !== x.zoom) || (zPrec && zPrec.passes !== x.passes)) console.log(ligne(x))
}

console.log('\n══ PROFIL (une ligne sur 40)')
l.filter((_, i) => i % 40 === 0).forEach((x) => console.log(ligne(x)))
