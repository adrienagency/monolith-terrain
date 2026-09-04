// BT-N — LA DONNÉE SOURCE ELLE-MÊME : lecture directe des GeoTIFF BlueTopo
// (NAD83/UTM, 4-16 m) aux points du barème, AVANT tout pivot et tout tuilage.
// Sert à trancher BT-2 / BT-4 / BT-1 : la grandeur nommée existe-t-elle dans le levé ?
//   node scripts/mesure-source-bt-n.mjs [--tiff <dossiers séparés par ,>]
import fs from 'node:fs'; import path from 'node:path'
import { ouvreGeoTiff } from './lit-geotiff.mjs'
const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DOSS = arg('tiff', 'C:/Dev/wt-bt2/data/bluetopo/tiff,C:/Dev/wt-bt2/data/bluetopo/regions/virginia,C:/Dev/wt-bt2/data/bluetopo/regions/ny-bight,C:/Dev/wt-bt2/data/bluetopo/regions/georges,C:/Dev/wt-bt2/data/bluetopo/regions/louisiane,C:/Dev/wt-bt2/data/bluetopo/regions/floride-o,C:/Dev/wt-bt2/data/bluetopo/regions/chesa-median').split(',')
// UTM direct (GRS80), Snyder 1395
const A = 6378137, F = 1 / 298.257222101, E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = 0.9996
function versUtm(lat, lon, zone) {
  const p = lat * Math.PI / 180, l0 = (-183 + 6 * zone) * Math.PI / 180, l = lon * Math.PI / 180
  const N = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = EP2 * Math.cos(p) ** 2, Aa = (l - l0) * Math.cos(p)
  const M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * p - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * p) + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * p) - (35 * E2 ** 3 / 3072) * Math.sin(6 * p))
  const E = 500000 + K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120)
  const Nn = K0 * (M + N * Math.tan(p) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720))
  return [E, Nn]
}
const POINTS = [
  ['BT-2/BT-1 Chesapeake embouchure', 37.00, -76.05],
  ['BT-2 New York Bight', 40.50, -73.90],
  ['BT-4 Virginia Beach', 36.80, -75.30],
  ['BT-4 Georges Bank', 41.30, -67.50],
  ['BT-4 Plateau louisianais', 28.80, -90.50],
  ['BT-4 Plateau ouest-Floride (Tampa)', 27.50, -83.20],
  ['hors barème Chesapeake bassin médian', 38.20, -76.30],
]
const fichiers = DOSS.flatMap((d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.tiff?$/i.test(f)).map((f) => path.join(d, f)) : [])
console.log(fichiers.length + ' GeoTIFF candidats')
// index des emprises (ouverture = lecture complète : on ne garde que les bornes)
const emprises = []
for (const f of fichiers) { const t = ouvreGeoTiff(f); emprises.push({ f, epsg: t.epsg, ox: t.ox, oy: t.oy, px: t.px, py: t.py, w: t.largeur, h: t.hauteur }) }
const mSol = (lat, z, px) => 156543.03392 * Math.cos(lat * Math.PI / 180) / (2 ** z * (px / 256))
function stats(vals) { const v = vals.filter(Number.isFinite); if (!v.length) return null; let mn = Infinity, mx = -Infinity, s = 0; for (const x of v) { if (x < mn) mn = x; if (x > mx) mx = x; s += x } return { n: v.length, min: mn, max: mx, moy: s / v.length, etendue: mx - mn } }
for (const [nom, lat, lon] of POINTS) {
  const cand = emprises.filter((e) => { const z = e.epsg - 26900; const [E, N] = versUtm(lat, lon, z); return E >= e.ox && E < e.ox + e.w * e.px && N <= e.oy && N > e.oy - e.h * e.py })
  console.log('\n■ ' + nom + '  (' + lat + ' / ' + lon + ')')
  if (!cand.length) { console.log('   AUCUNE dalle BlueTopo ne contient ce point sur le disque'); continue }
  for (const e of cand) {
    const t = ouvreGeoTiff(e.f); const zone = t.epsg - 26900; const [E, N] = versUtm(lat, lon, zone)
    const i0 = (E - t.ox) / t.px, j0 = (t.oy - N) / t.py
    const v0 = t.elevation(Math.floor(i0), Math.floor(j0))
    console.log('   dalle ' + path.basename(e.f) + '  résolution ' + t.px + ' m  pixel(' + Math.floor(i0) + ',' + Math.floor(j0) + ') = ' + (Number.isFinite(v0) ? v0.toFixed(3) : 'NaN') + ' m')
    // empreinte moyenne d'UN texel de globe (512 px) à z11 et z13 centrée sur le point
    const emp = {}
    for (const z of [11, 12, 13]) {
      const s = mSol(lat, z, 512); const r = s / 2
      const vals = []
      for (let jj = Math.floor(j0 - r / t.py); jj <= Math.ceil(j0 + r / t.py); jj++) for (let ii = Math.floor(i0 - r / t.px); ii <= Math.ceil(i0 + r / t.px); ii++) vals.push(t.elevation(ii, jj))
      emp[z] = stats(vals)
    }
    console.log('   empreinte 1 texel : z11 ' + (emp[11] ? emp[11].moy.toFixed(3) + ' m (' + emp[11].n + ' px)' : 'NaN') + ' · z13 ' + (emp[13] ? emp[13].moy.toFixed(3) + ' m (' + emp[13].n + ' px)' : 'NaN') + '  → |Δ z11→z13| = ' + (emp[11] && emp[13] ? Math.abs(emp[13].moy - emp[11].moy).toFixed(3) : '?') + ' m   [BT-2 veut ≥ 1,00]')
    // fenêtre 9×9 de texels de globe (512 px) à z12 et z13 : chaque texel = moyenne des pixels source qu'il couvre
    const fen = {}
    for (const z of [11, 12, 13]) {
      const s = mSol(lat, z, 512)
      const tex = []
      for (let dy = -4; dy <= 4; dy++) { const ligne = []; for (let dx = -4; dx <= 4; dx++) {
        const cE = E + dx * s, cN = N - dy * s
        const vals = []
        for (let jj = Math.floor((t.oy - cN - s / 2) / t.py); jj < (t.oy - cN + s / 2) / t.py; jj++) for (let ii = Math.floor((cE - s / 2 - t.ox) / t.px); ii < (cE + s / 2 - t.ox) / t.px; ii++) vals.push(t.elevation(ii, jj))
        const st = stats(vals); ligne.push(st ? st.moy : NaN) } tex.push(ligne) }
      const flat = tex.flat(); const st = stats(flat)
      let e = 0, c = 0; for (let y = 0; y < 9; y++) for (let x = 1; x < 9; x++) { const a = tex[y][x], b = tex[y][x - 1]; if (Number.isFinite(a) && Number.isFinite(b)) { e += Math.abs(a - b); c++ } }
      fen[z] = st ? { ...st, peigne: c ? e / c : NaN, penteKm: c ? (e / c) / s * 1000 : NaN, texel: s, nTex: c } : null
    }
    for (const z of [11, 12, 13]) if (fen[z]) console.log('   9×9 texels z' + z + ' (texel ' + fen[z].texel.toFixed(2) + ' m) : moy ' + fen[z].moy.toFixed(3) + ' · étendue ' + fen[z].etendue.toFixed(3) + ' m · pente ' + fen[z].penteKm.toFixed(3) + ' m/km')
    if (fen[12] && fen[13]) console.log('   rapport d étendue z12→z13 = ' + (fen[13].etendue / fen[12].etendue).toFixed(3) + '   [BT-1 veut ≥ 0,70 ; interpolation pure = 0,500]')
    // et une vraie « pente régionale » : régression sur 1 km autour du point, pour dire si le fond porte du relief à cette échelle
    const R = 500; const vals = []; const xs = [], ys = [], zs = []
    for (let jj = Math.floor(j0 - R / t.py); jj <= j0 + R / t.py; jj += 4) for (let ii = Math.floor(i0 - R / t.px); ii <= i0 + R / t.px; ii += 4) { const v = t.elevation(ii, jj); if (Number.isFinite(v)) { xs.push((ii - i0) * t.px); ys.push((jj - j0) * t.py); zs.push(v) } }
    const st1 = stats(zs)
    if (st1) console.log('   fenêtre 1 km × 1 km au natif : ' + st1.n + ' px, min ' + st1.min.toFixed(2) + ' · max ' + st1.max.toFixed(2) + ' · étendue ' + st1.etendue.toFixed(2) + ' m')
  }
}
