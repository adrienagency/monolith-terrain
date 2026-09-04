// LISS — LE STRIAGE, MESURÉ AVANT/APRÈS, ET LE RAYON DÉRIVÉ PAR LA MESURE.
//
// ⚠️ TROIS PRÉCAUTIONS, ET CHACUNE A CORRIGÉ UN FAUX CONSTAT DE CETTE SESSION :
//
//  ① ON DÉCODE LE PNG SOI-MÊME, en node (`liss-png.mjs`) — aucun canevas,
//     aucune conversion colorimétrique, aucun Chrome sans tête. Contrôle : le
//     §① rejoue le protocole de `scripts/b6-striage.mjs` À L'IDENTIQUE, et les
//     cinq nombres du rapport B6 ressortent au centième.
//  ② ON MESURE DANS UNE FENÊTRE ENTIÈREMENT ABYSSALE. Le premier relevé prenait
//     la tuile entière : les projections y portaient l'île de Rodrigues, que le
//     lissage ne touche PAS (c'est l'interdit ②), et le chiffre plafonnait à
//     17 m quel que soit le rayon. On cherche donc la fenêtre 128² la plus
//     profonde dont TOUS les pixels sont sous −1 000 m.
//  ③ ON DONNE DEUX MÉTRIQUES. Le résidu B6 (écart à une tendance lissée sur 9)
//     garde un PLANCHER fait de la courbure réelle du fond ; le « pic-à-pic
//     bande à bande » (écart d'une bande à la moyenne de ses deux voisines) ne
//     mesure que l'alternation, et c'est elle que le peigne fait voir.
//
//   node scripts/liss-striage.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tuileMetres } from './liss-png.mjs'
import { lisseAbysse, rayonAbyssePx, resolutionBathyM } from '../src/bathy.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BATHY = path.join(RACINE, 'public', 'data', 'bathy')
const ICI = path.join(RACINE, '.banc', 'LISS')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const RAYONS = opt('--rayons', 'auto,1,2,3,4,5,6,8').split(',')
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

const pp = (r) => {
  const n = r.length
  const b = Array.from(r).sort((u, v) => u - v)
  return b[Math.floor(0.99 * n)] - b[Math.floor(0.01 * n)]
}
// projections sur les deux axes d'une fenêtre carrée n×n de la tuile
function profil(m, w, x0, y0, n) {
  const col = new Float64Array(n), lig = new Float64Array(n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = m[(y0 + y) * w + (x0 + x)]; col[x] += v / n; lig[y] += v / n }
  const b6 = (a) => {
    const N = a.length, r = new Float64Array(N)
    for (let i = 0; i < N; i++) { let s = 0, k = 0; for (let j = i - 4; j <= i + 4; j++) { if (j < 0 || j >= N) continue; s += a[j]; k++ } r[i] = a[i] - s / k }
    return pp(r)
  }
  const voisin = (a) => {
    const N = a.length, r = new Float64Array(N)
    for (let i = 1; i < N - 1; i++) r[i] = a[i] - (a[i - 1] + a[i + 1]) / 2
    return pp(r.subarray(1, N - 1))
  }
  return { b6x: b6(col), b6y: b6(lig), vx: voisin(col), vy: voisin(lig) }
}
// la fenêtre n×n la plus profonde dont TOUS les pixels sont sous −1 000 m
function fenetreAbyssale(m, w, h, n) {
  let best = null
  for (let y = 0; y + n <= h; y += 8) for (let x = 0; x + n <= w; x += 8) {
    let ok = true, s = 0
    for (let j = 0; j < n && ok; j++) for (let i = 0; i < n; i++) { const v = m[(y + j) * w + x + i]; if (!(v < -1000)) { ok = false; break } s += v }
    if (ok) { const mo = s / (n * n); if (!best || mo < best.mo) best = { x, y, mo } }
  }
  return best
}

const TUILES = [
  { nom: 'Rodrigues z8 173/142', z: 8, x: 173, y: 142 },
  { nom: 'Rodrigues z8 172/142', z: 8, x: 172, y: 142 },
  { nom: 'Rodrigues z8 171/142', z: 8, x: 171, y: 142 },
  { nom: 'Moorea z8 21/140', z: 8, x: 21, y: 140 },
  { nom: 'Porquerolles z8 132/94', z: 8, x: 132, y: 94 },
  { nom: 'Rodrigues z6 43/35', z: 6, x: 43, y: 35 },
]

const N = 128
const lignes = []
console.log(`\n  PIC-À-PIC BANDE À BANDE, fenêtre ${N}² entièrement sous −1 000 m (m)\n`)
console.log(`  tuile                  r auto  fenêtre    ${RAYONS.map((r) => String(r).padStart(12)).join('')}`)
for (const t of TUILES) {
  const f = path.join(BATHY, String(t.z), String(t.x), `${t.y}.png`)
  if (!fs.existsSync(f)) { console.log(`  ${t.nom.padEnd(22)} ⚠ absente`); continue }
  const { w, h, m } = tuileMetres(f)
  const maille = resolutionBathyM(t.z, y2lat(t.y + 0.5, t.z)) * (256 / w)
  const rAuto = rayonAbyssePx(maille)
  const fen = fenetreAbyssale(m, w, h, N)
  if (!fen) { console.log(`  ${t.nom.padEnd(22)} ⚠ aucune fenêtre abyssale ${N}²`); continue }
  const rec = { ...t, mailleM: +maille.toFixed(0), rayonAuto: rAuto, fenetre: fen, pp: {} }
  const cols = []
  for (const r of RAYONS) {
    const d = Float32Array.from(m)
    lisseAbysse(d, w, r === 'auto' ? { mailleM: maille } : { radius: Number(r) })
    const p = profil(d, w, fen.x, fen.y, N)
    rec.pp[r] = { b6: [+p.b6x.toFixed(2), +p.b6y.toFixed(2)], voisin: [+p.vx.toFixed(2), +p.vy.toFixed(2)] }
    cols.push(`${p.vx.toFixed(1)}/${p.vy.toFixed(1)}`.padStart(12))
  }
  lignes.push(rec)
  console.log(`  ${t.nom.padEnd(22)} ${String(rAuto).padStart(6)}  ${String(fen.mo.toFixed(0)).padStart(7)}    ${cols.join('')}`)
}
fs.writeFileSync(path.join(ICI, 'striage.json'), JSON.stringify(lignes, null, 2))
console.log(`\n  (« auto » = le rayon que le code choisit ; les autres colonnes sont le balayage)`)
console.log(`  → ${path.join(ICI, 'striage.json')}`)
