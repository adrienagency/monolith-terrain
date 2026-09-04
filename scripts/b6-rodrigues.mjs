// B6 — LES PLAQUES DE TERRE EN PLEINE MER ET LE STRIAGE, MESURÉS À RODRIGUES.
//
// Rejoue `fondMarinTuile` (src/globe.js) tuile par tuile en plein océan, et
// compte DEUX grandeurs, séparément :
//   · PLAQUES : les pixels que la fusion laisse ÉMERGÉS (>= 0) alors que la
//     bathymétrie de référence donne un fond franc (< −200 m). C'est le défaut
//     ③+⑤ d'Adrien, traduit en pixels.
//   · STRIAGE : l'amplitude pic-à-pic entre colonnes (et lignes) voisines du
//     champ fusionné, en mètres — le peigne ④.
//
//   node scripts/b6-rodrigues.mjs --port 9317 --lieu -19.7253,63.3691 --nom rodrigues
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const [LAT, LON] = opt('--lieu', '-19.7253,63.3691').split(',').map(Number)
const NOM = opt('--nom', 'rodrigues')
const ZOOMS = opt('--zooms', '9,10,11,12,13').split(',').map(Number)
// combien de tuiles autour de la tuile centrale (0 = la seule tuile du lieu)
const RAYON = Number(opt('--rayon', '1'))
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zooms, rayon) => {
  const { fuseBathymetry, bandeBruitAdmise, resolutionBathyM, NOISE_BAND, overzoomTile } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const { vetoTerre } = await import('/src/coast-veto.js')
  const index = await indexBathy()
  const src = DEM_SOURCES.mapterhorn
  const out = []
  const latRad = (lat * Math.PI) / 180
  for (const z of zooms) {
    const n = 2 ** z
    const cx = Math.floor(((lon + 180) / 360) * n)
    const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    for (let dy = -rayon; dy <= rayon; dy++) for (let dx = -rayon; dx <= rayon; dx++) {
      const tx = cx + dx, ty = cy + dy
      const maxZoom = (await resolveRegionMaxZoom(src, z, tx, ty)) ?? src.maxZoom
      const t = overzoomTile(z, tx, ty, maxZoom)
      let r = await fetch(src.url(t.z, t.x, t.y))
      let source = 'mapterhorn'
      if (!r.ok) { out.push({ z, tx, ty, erreur: `terrarium HTTP ${r.status}` }); continue }
      const img = await createImageBitmap(await r.blob())
      const PX = src.tilePx
      const c = document.createElement('canvas'); c.width = c.height = PX
      const g = c.getContext('2d', { willReadFrequently: true })
      const s = PX / t.scale
      g.drawImage(img, t.ox * PX, t.oy * PX, s, s, 0, 0, PX, PX)
      const p = g.getImageData(0, 0, PX, PX).data
      const land = new Float32Array(PX * PX)
      for (let i = 0; i < PX * PX; i++) land[i] = p[i * 4 + 3] === 0 ? 0 : p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
      // histogramme rapide du terrarium
      let lMin = Infinity, lMax = -Infinity, lPos = 0, lZero = 0
      const hist = new Map()
      for (let i = 0; i < land.length; i++) {
        const v = land[i]
        if (v < lMin) lMin = v; if (v > lMax) lMax = v
        if (v > 0.05) lPos++
        if (v === 0) lZero++
        if (i % 17 === 0) hist.set(v, (hist.get(v) ?? 0) + 1)
      }
      let vTop = NaN, cTop = 0, nSondes = 0
      for (const [v, k] of hist) { nSondes += k; if (k > cTop) { cTop = k; vTop = v } }
      const sea = new Float32Array(PX * PX).fill(NaN)
      const arg = { zoom: z, tx, ty, index, dst: sea, dstStride: PX, dx: 0, dy: 0, dw: PX, dh: PX }
      let peint = await peindreBathyTuile(arg)
      let plancherUtilise = false
      if (peint < 0) { peint = await peindreBathyTuile({ ...arg, plancher: index.zmin }); plancherUtilise = peint >= 0 }
      if (peint < 0) { out.push({ z, tx, ty, source, erreur: 'aucune bathy', lMin, lMax, lPos, lZero }); continue }
      let sMin = Infinity, sMax = -Infinity, sNaN = 0
      for (let i = 0; i < sea.length; i++) { const v = sea[i]; if (!Number.isFinite(v)) { sNaN++; continue } if (v < sMin) sMin = v; if (v > sMax) sMax = v }
      const pasM = ((156543.03392 * Math.cos(latRad)) / 2 ** z) * (256 / PX)
      const resSrc = resolutionBathyM(peint, lat)
      const bande = bandeBruitAdmise(resSrc, pasM)
      const veto = await vetoTerre({ u0: tx / n, u1: (tx + 1) / n, v0: ty / n, v1: (ty + 1) / n, largeur: PX, hauteur: PX, metresParCellule: pasM, zoom: z, cle: `t/${z}/${tx}/${ty}/${PX}` })
      const optsFusion = bande === 0 || veto ? { ...(bande === 0 ? { noiseBand: 0 } : {}), ...(veto ? { terreVeto: veto } : {}) } : undefined
      const fondu = fuseBathymetry(land, sea, optsFusion)
      // ── ① PLAQUES : émergé alors que la bathy donne un fond franc ───────
      let plaques = 0, plaquesProfond = 0
      for (let i = 0; i < fondu.length; i++) {
        const s2 = sea[i]
        if (!Number.isFinite(s2)) continue
        if (fondu[i] >= 0 && s2 < -200) plaques++
        if (fondu[i] >= 0 && s2 < -2000) plaquesProfond++
      }
      // ── ② STRIAGE : pic-à-pic entre colonnes voisines, sur les lignes ───
      // On mesure l'écart moyen |f(x+1)-f(x)| et son p99, en mètres, sur les
      // pixels où le fond est franc (>200 m) — le striage d'Adrien.
      const dxs = [], dys = []
      for (let y = 1; y < PX - 1; y += 3) for (let x = 1; x < PX - 1; x += 3) {
        const i = y * PX + x
        if (!(fondu[i] < -200)) continue
        dxs.push(Math.abs(fondu[i + 1] - fondu[i]))
        dys.push(Math.abs(fondu[i + PX] - fondu[i]))
      }
      const q = (a, p) => { if (!a.length) return NaN; const b = a.slice().sort((u, v) => u - v); return b[Math.min(b.length - 1, Math.floor(p * b.length))] }
      out.push({
        z, tx, ty, px: PX, source, tSrc: `${t.z}/${t.x}/${t.y}`, tScale: t.scale,
        zBathy: peint, plancherUtilise, pasM: +pasM.toFixed(2), resSourceM: +resSrc.toFixed(1),
        rapport: +(resSrc / pasM).toFixed(1), bande, veto: veto ? 'oui' : 'null',
        lMin: +lMin.toFixed(3), lMax: +lMax.toFixed(3), lPos, lZero,
        vTop: +vTop.toFixed(3), partTop: +((100 * cTop) / nSondes).toFixed(1),
        sMin: +sMin.toFixed(1), sMax: +sMax.toFixed(1), sNaN,
        plaques, plaquesProfond,
        dxMoy: +(dxs.reduce((a, b) => a + b, 0) / (dxs.length || 1)).toFixed(2),
        dxP99: +q(dxs, 0.99)?.toFixed(2), dyP99: +q(dys, 0.99)?.toFixed(2),
        dxMax: +Math.max(0, ...dxs.slice(0, 200000)).toFixed(2),
      })
    }
  }
  return out
}, LAT, LON, ZOOMS, RAYON)

console.log(`\n${NOM} ${LAT},${LON}  (rayon ${RAYON})`)
console.log('   z    tx    ty  src(t)          zB pl  pas m  srcM  rapp bd veto |  terrarium min/max  >0.05  ==0  valTop%  |  bathy min/max  NaN | PLAQUES >200/>2000 | dx moy/p99  dy p99')
for (const r of R) {
  if (r.erreur) { console.log(`  ${r.z} ${r.tx} ${r.ty}  ⚠ ${r.erreur}  land ${r.lMin ?? ''}..${r.lMax ?? ''} pos=${r.lPos ?? ''} zero=${r.lZero ?? ''}`); continue }
  console.log(`  ${String(r.z).padStart(2)} ${String(r.tx).padStart(5)} ${String(r.ty).padStart(5)}  ${r.tSrc.padEnd(14)} ${String(r.zBathy).padStart(2)} ${r.plancherUtilise ? 'P' : ' '} ${String(r.pasM).padStart(6)} ${String(r.resSourceM).padStart(5)} ${String(r.rapport).padStart(5)} ${String(r.bande).padStart(3)} ${r.veto.padStart(4)} | ${String(r.lMin).padStart(9)}/${String(r.lMax).padStart(8)} ${String(r.lPos).padStart(6)} ${String(r.lZero).padStart(6)} ${String(r.vTop).padStart(7)}@${String(r.partTop).padStart(5)} | ${String(r.sMin).padStart(8)}/${String(r.sMax).padStart(7)} ${String(r.sNaN).padStart(6)} | ${String(r.plaques).padStart(7)} ${String(r.plaquesProfond).padStart(7)} | ${String(r.dxMoy).padStart(6)} ${String(r.dxP99).padStart(7)} ${String(r.dyP99).padStart(7)}`)
}
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
