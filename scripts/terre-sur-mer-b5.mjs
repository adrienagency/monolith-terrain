// B5 — COMPTE DES PIXELS « TERRE LA OU LA VERITE DIT MER », depuis un relevé
// de sonde-b5 et le trait de côte land-10m.json du dépôt (point dans polygone).
import fs from 'node:fs'
const F = process.argv[2]
const r = JSON.parse(fs.readFileSync(F, 'utf8'))
const land = JSON.parse(fs.readFileSync('public/data/land-10m.json', 'utf8'))
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
function dansAnneau(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) c = !c } return c }
function dansPoly(pt, poly) { if (!dansAnneau(pt, poly[0])) return false; for (let k = 1; k < poly.length; k++) if (dansAnneau(pt, poly[k])) return false; return true }
// pré-filtre par emprise de polygone
const polys = []
for (const f of land.features) { const g = f.geometry; const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const p of list) { let w = 1e9, e = -1e9, s = 1e9, n = -1e9; for (const [x, y] of p[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y } polys.push({ p, w, e, s, n }) } }
const estTerre = (lon, lat) => { for (const q of polys) if (lon >= q.w && lon <= q.e && lat >= q.s && lat <= q.n && dansPoly([lon, lat], q.p)) return true; return false }
const out = []
for (const v of r.vues) {
  if (!v.cls) continue
  const g = v.geo, z = v.zoom, cote = v.cote, pas = v.pas
  let terreSurMer = 0, merSurTerre = 0, zeroSurMer = 0, mer = 0, terre = 0
  for (let y = 0; y < cote; y++) for (let x = 0; x < cote; x++) {
    const px = x * pas, py = y * pas
    const lon = x2lon(g.originTileX + px / g.tilePx, z), lat = y2lat(g.originTileY + py / g.tilePx, z)
    const t = estTerre(lon, lat); const c = +v.cls[y * cote + x]
    if (t) { terre++; if (c === 0) merSurTerre++ } else { mer++; if (c !== 0) terreSurMer++; if (c === 1) zeroSurMer++ }
  }
  const l = { nom: v.nom, zoom: z, echantillons: cote * cote, veriteMer: mer, veriteTerre: terre, terreRendueSurMer: terreSurMer, dontZeroExact: zeroSurMer, merRendueSurTerre: merSurTerre }
  out.push(l)
  console.log(`${v.nom.padEnd(24)} z${z}  mer(vérité) ${String(mer).padStart(6)} · TERRE rendue sur mer ${String(terreSurMer).padStart(6)} (${(100*terreSurMer/mer).toFixed(1)} %) dont 0 exact ${String(zeroSurMer).padStart(6)} · mer rendue sur terre ${merSurTerre} / ${terre}`)
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1))
