// B6 — QUELLE PORTE LAISSE UN PIXEL ÉMERGÉ EN PLEINE MER ?
//
// `fuseBathymetry` a quatre chemins qui mettent un pixel SOUS l'eau (le zéro
// exact, l'aplat de remplissage, la bande de bruit, le pixel déjà négatif).
// Le défaut d'Adrien est le SENS INVERSE : un pixel qui RESTE émergé au milieu
// de 4 000 m de fond. Ce banc ventile, pour les tuiles nommées, chaque pixel
// émergé selon la sortie qui l'a laissé là :
//
//   TERRE      l >= 0 et pas de noData → le terrarium dit terre
//   sNaN       la bathy n'a rien peint ici
//   sMuet      sentinelle de nappe (level > 0)
//   sPositIF   la source bathy elle-même rend >= 0 (le tuileur APLATIT la terre
//              à zéro : ce 0 ne mesure rien, et `s >= level` rend `l` tel quel)
//   fondu      sorti de la branche marine mais arrondi >= 0
//
//   node scripts/b6-porte.mjs --port 9317
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const NOM = opt('--nom', 'avant')
const TUILES = JSON.parse(opt('--tuiles', JSON.stringify([
  { z: 8, x: 171, y: 142 }, { z: 8, x: 172, y: 142 },
  { z: 9, x: 344, y: 284 }, { z: 9, x: 345, y: 284 }, { z: 9, x: 347, y: 284 },
  { z: 10, x: 691, y: 569 },
])))
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (tuiles) => {
  const { fuseBathymetry, overzoomTile } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const { vetoTerre, merFranche } = await import('/src/coast-veto.js')
  const index = await indexBathy()
  const src = DEM_SOURCES.mapterhorn
  const out = []
  for (const T of tuiles) {
    const { z, x: tx, y: ty } = T
    const n = 2 ** z
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 0.5)) / n))) * 180) / Math.PI
    const maxZoom = (await resolveRegionMaxZoom(src, z, tx, ty)) ?? src.maxZoom
    const t = overzoomTile(z, tx, ty, maxZoom)
    const r = await fetch(src.url(t.z, t.x, t.y))
    if (!r.ok) { out.push({ ...T, erreur: `HTTP ${r.status}` }); continue }
    const img = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none' })
    const PX = src.tilePx
    const c = document.createElement('canvas'); c.width = c.height = PX
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, t.ox * PX, t.oy * PX, PX / t.scale, PX / t.scale, 0, 0, PX, PX)
    const p = g.getImageData(0, 0, PX, PX).data
    const land = new Float32Array(PX * PX)
    for (let i = 0; i < PX * PX; i++) land[i] = p[i * 4 + 3] === 0 ? 0 : p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
    const sea = new Float32Array(PX * PX).fill(NaN)
    const arg = { zoom: z, tx, ty, index, dst: sea, dstStride: PX, dx: 0, dy: 0, dw: PX, dh: PX }
    let peint = await peindreBathyTuile(arg)
    let secours = false
    if (peint < 0) { peint = await peindreBathyTuile({ ...arg, plancher: index.zmin }); secours = peint >= 0 }
    const pasM = ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z) * (256 / PX)
    const argCote = { u0: tx / n, u1: (tx + 1) / n, v0: ty / n, v1: (ty + 1) / n, largeur: PX, hauteur: PX, metresParCellule: pasM, zoom: z, cle: `t/${z}/${tx}/${ty}/${PX}` }
    const [veto, franche] = await Promise.all([vetoTerre(argCote), merFranche(argCote)])
    const base = { ...(veto ? { terreVeto: veto } : {}) }
    const avant = fuseBathymetry(land, sea, base)
    const apres = fuseBathymetry(land, sea, { ...base, ...(franche ? { merFranche: true } : {}) })
    const fondu = avant
    const cat = { TERRE: 0, sNaN: 0, sMuet: 0, sPositif: 0, fondu: 0 }
    let sPosMin = Infinity, sPosMax = -Infinity, exemples = []
    for (let i = 0; i < fondu.length; i++) {
      if (fondu[i] < 0) continue
      const l = land[i], s = sea[i]
      if (l >= 1 / 512) { cat.TERRE++; continue }
      if (!Number.isFinite(s)) { cat.sNaN++; continue }
      if (s >= 0) {
        cat.sPositif++
        if (s < sPosMin) sPosMin = s
        if (s > sPosMax) sPosMax = s
        if (exemples.length < 6) exemples.push({ i, l: +l.toFixed(4), s: +s.toFixed(4), o: +fondu[i].toFixed(4) })
        continue
      }
      cat.fondu++
      if (exemples.length < 6) exemples.push({ i, l: +l.toFixed(4), s: +s.toFixed(4), o: +fondu[i].toFixed(4) })
    }
    let emerges = 0, emergesApres = 0, changes = 0, eauPerdue = 0
    for (const v of fondu) if (v >= 0) emerges++
    for (const v of apres) if (v >= 0) emergesApres++
    for (let i = 0; i < apres.length; i++) {
      if (apres[i] !== avant[i]) changes++
      if (avant[i] < 0 && !(apres[i] < 0)) eauPerdue++
    }
    out.push({ ...T, px: PX, zBathy: peint, secours, veto: !!veto, franche, emerges, emergesApres, changes, eauPerdue, ...cat, sPosMin: sPosMin === Infinity ? null : +sPosMin.toFixed(3), sPosMax: sPosMax === -Infinity ? null : +sPosMax.toFixed(3), exemples })
  }
  return out
}, TUILES)

console.log('\n  tuile        zB sec  émergés | TERRE  sNaN  sMuet  s>=0  fondu | s>=0 min/max')
for (const r of R) {
  if (r.erreur) { console.log(`  ${r.z}/${r.x}/${r.y}  ⚠ ${r.erreur}`); continue }
  console.log(`  ${`${r.z}/${r.x}/${r.y}`.padEnd(12)} ${String(r.zBathy).padStart(2)} ${r.secours ? ' S' : '  '} ${String(r.veto).padStart(5)} ${String(r.franche).padStart(7)}  ${String(r.emerges).padStart(7)} → ${String(r.emergesApres).padStart(7)} ${String(r.changes).padStart(8)} ${String(r.eauPerdue).padStart(10)} | ${String(r.TERRE).padStart(5)} ${String(r.sNaN).padStart(5)} ${String(r.sMuet).padStart(6)} ${String(r.sPositif).padStart(5)} ${String(r.fondu).padStart(6)} | ${r.sPosMin} / ${r.sPosMax}`)
  if (r.exemples?.length) console.log('     ex. ' + r.exemples.map((e) => `l=${e.l} s=${e.s} → ${e.o}`).join(' · '))
}
fs.writeFileSync(path.join(ICI, `porte-${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
