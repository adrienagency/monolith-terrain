// LECTEUR DE TRACE — le verdict de R4 en trois tableaux.
//
// 1. les SAUTS D'INCLINAISON : où l'orientation change de plus de `--seuil`
//    degrés d'une image à la suivante, et de combien.
// 2. les BASCULES DE CONTENU : où `uCropOn` et `veilleCrop.pose` changent.
// 3. le RÉSUMÉ : nombre de bascules, plus grand saut, régime de chaque bord.
//
// EMPLOI  node scripts/lit-sonde-descente.mjs <etiquette> [--seuil 1]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ICI = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '.banc', 'R4')
const A = process.argv.slice(2)
const ETIQ = A[0] ?? 'descente'
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const SEUIL = Number(opt('--seuil', '1'))

const j = JSON.parse(fs.readFileSync(path.join(ICI, `${ETIQ}.json`), 'utf8'))
const L = j.images.filter((l) => !l.err)
const t0 = L[0]?.t ?? 0
const km = (m) => (m == null ? '—' : (m / 1000).toFixed(m > 1e6 ? 0 : 1))

console.log(`# ${ETIQ} — ${L.length} images, départ ${(j.departM / 1000).toFixed(0)} km, ${j.dureeMs} ms`)
console.log(`erreurs de page : ${(j.erreurs ?? []).length}`)

console.log(`\n## 1. SAUTS D'INCLINAISON (> ${SEUIL}° d'une image à la suivante)`)
console.log('img\tt(ms)\tΔincl°\tincl av→ap\talt km\tmode\tbusy\tcropOn\tpose')
let maxSaut = 0, nSauts = 0
for (let i = 1; i < L.length; i++) {
  const d = Math.abs(L[i].incl - L[i - 1].incl)
  if (!Number.isFinite(d)) continue
  if (d > maxSaut) maxSaut = d
  if (d <= SEUIL) continue
  nSauts++
  if (nSauts <= 40) {
    console.log(`${i}\t${L[i].t - t0}\t${d.toFixed(2)}\t${L[i - 1].incl.toFixed(2)}→${L[i].incl.toFixed(2)}\t${km(L[i].alt)}\t${L[i].mode}\t${L[i].busy ? 1 : 0}\t${L[i].cropOn}\t${L[i].pose ? 1 : 0}`)
  }
}
console.log(`total : ${nSauts} sauts > ${SEUIL}°, plus grand écart image-à-image ${maxSaut.toFixed(2)}°`)

console.log('\n## 2. BASCULES DE CONTENU')
console.log('img\tt(ms)\tquoi\tvaleur\talt km\tincl°\tmode\tbusy')
let nb = 0
for (let i = 1; i < L.length; i++) {
  const a = L[i - 1], b = L[i]
  if (a.cropOn !== b.cropOn) { nb++; console.log(`${i}\t${b.t - t0}\tuCropOn\t${a.cropOn}→${b.cropOn}\t${km(b.alt)}\t${b.incl.toFixed(2)}\t${b.mode}\t${b.busy ? 1 : 0}`) }
  if (a.pose !== b.pose) { nb++; console.log(`${i}\t${b.t - t0}\tpose\t${a.pose ? 1 : 0}→${b.pose ? 1 : 0}\t${km(b.alt)}\t${b.incl.toFixed(2)}\t${b.mode}\t${b.busy ? 1 : 0}`) }
  if (a.mode !== b.mode) { nb++; console.log(`${i}\t${b.t - t0}\tmode\t${a.mode}→${b.mode}\t${km(b.alt)}\t${b.incl.toFixed(2)}\t\t${b.busy ? 1 : 0}`) }
  if (a.zoom !== b.zoom) { nb++; console.log(`${i}\t${b.t - t0}\tzoom\t${a.zoom}→${b.zoom}\t${km(b.alt)}\t${b.incl.toFixed(2)}\t${b.mode}\t${b.busy ? 1 : 0}`) }
}
console.log(`total : ${nb} bascules ; veilleCrop.bascules final = ${L[L.length - 1]?.bascules}`)

console.log('\n## 3. PROFIL (une ligne toutes les 40 images)')
console.log('img\tt(ms)\talt km\tdist\tincl°\tmode\tbusy\tcropOn\tpose\testompe\tzoom')
for (let i = 0; i < L.length; i += 40) {
  const l = L[i]
  console.log(`${i}\t${l.t - t0}\t${km(l.alt)}\t${l.dist == null ? '—' : l.dist.toFixed(0)}\t${l.incl.toFixed(2)}\t${l.mode}\t${l.busy ? 1 : 0}\t${l.cropOn}\t${l.pose ? 1 : 0}\t${l.estompe == null ? '—' : Number(l.estompe).toFixed(2)}\t${l.zoom}`)
}
