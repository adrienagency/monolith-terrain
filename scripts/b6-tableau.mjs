// B6 — LE TABLEAU DU CRITÈRE : 5 lieux contrastés × 3 zooms, vraies tuiles.
//
// Rejoue `fondMarinTuile` (src/globe.js) sur la tuile de chaque lieu, à chaque
// zoom, et mesure les DEUX sens :
//   ⛔ PLAQUES  = pixels ÉMERGÉS que la fusion laisse alors que le trait de côte
//                 déclare franchement la pleine mer. Critère d'Adrien : 0.
//   ⛔ EAU      = pixels sous zéro, avant et après B6. Doit être IDENTIQUE ou
//                 supérieur : B6 ne peut que descendre, jamais remonter.
//   + le coût de fusion et le coût du second avis de côte (`merFranche`).
//
//   node scripts/b6-tableau.mjs --port 9317
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const LIEUX = JSON.parse(opt('--lieux', JSON.stringify([
  { nom: 'Rodrigues', lat: -19.7253, lon: 63.3691, zooms: [9, 11, 13] },
  { nom: 'large de Rodrigues', lat: -19.9, lon: 62.4, zooms: [9, 11, 13] },
  { nom: 'La Reunion', lat: -21.1378, lon: 55.5291, zooms: [9, 11, 13] },
  { nom: 'Camargue', lat: 43.45, lon: 4.6, zooms: [11, 13, 15] },
  { nom: 'Porquerolles', lat: 43.0, lon: 6.2, zooms: [11, 13, 15] },
  { nom: 'Bretagne', lat: 48.65, lon: -2.02, zooms: [11, 13, 15] },
  { nom: 'Moorea', lat: -17.53, lon: -149.83, zooms: [11, 13, 15] },
])))
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lieux) => {
  const { fuseBathymetry, bandeBruitAdmise, resolutionBathyM, overzoomTile } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const { vetoTerre, merFranche, videCacheVeto } = await import('/src/coast-veto.js')
  const index = await indexBathy()
  const src = DEM_SOURCES.mapterhorn
  const out = []
  for (const L of lieux) {
    for (const z of L.zooms) {
      const n = 2 ** z, latRad = (L.lat * Math.PI) / 180
      const tx = Math.floor(((L.lon + 180) / 360) * n)
      const ty = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
      const maxZoom = (await resolveRegionMaxZoom(src, z, tx, ty)) ?? src.maxZoom
      const t = overzoomTile(z, tx, ty, maxZoom)
      const r = await fetch(src.url(t.z, t.x, t.y))
      if (!r.ok) { out.push({ lieu: L.nom, z, erreur: `terrarium HTTP ${r.status}` }); continue }
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
      let sansBathy = 0
      for (const v of sea) if (!Number.isFinite(v)) sansBathy++
      const pasM = ((156543.03392 * Math.cos(latRad)) / 2 ** z) * (256 / PX)
      const bande = peint >= 0 ? bandeBruitAdmise(resolutionBathyM(peint, L.lat), pasM) : undefined
      const argCote = { u0: tx / n, u1: (tx + 1) / n, v0: ty / n, v1: (ty + 1) / n, largeur: PX, hauteur: PX, metresParCellule: pasM, zoom: z, cle: `t/${z}/${tx}/${ty}/${PX}` }
      videCacheVeto()
      let t0 = performance.now()
      const [veto, franche] = await Promise.all([vetoTerre(argCote), merFranche(argCote)])
      const msCoteFroid = performance.now() - t0
      t0 = performance.now()
      await Promise.all([vetoTerre(argCote), merFranche(argCote)])
      const msCoteChaud = performance.now() - t0
      const base = { ...(bande === 0 ? { noiseBand: 0 } : {}), ...(veto ? { terreVeto: veto } : {}) }
      const avant = fuseBathymetry(land, sea, Object.keys(base).length ? base : undefined)
      const apres = fuseBathymetry(land, sea, { ...base, ...(franche ? { merFranche: true } : {}) })
      let emAv = 0, emAp = 0, eauAv = 0, eauAp = 0, remontes = 0, bits = 0
      for (let i = 0; i < land.length; i++) {
        if (avant[i] >= 0) emAv++
        if (apres[i] >= 0) emAp++
        if (avant[i] < 0) eauAv++
        if (apres[i] < 0) eauAp++
        if (apres[i] > avant[i]) remontes++
        if (apres[i] !== avant[i]) bits++
      }
      const chrono = (fn) => { const v = []; for (let k = 0; k < 5; k++) { const a = performance.now(); fn(); v.push(performance.now() - a) } return +v.sort((x, y) => x - y)[2].toFixed(2) }
      out.push({
        lieu: L.nom, z, tuile: `${z}/${tx}/${ty}`, px: PX, zBathy: peint, secours, sansBathy,
        veto: !!veto, franche, emAv, emAp, eauAv, eauAp, remontes, bits,
        msCoteFroid: +msCoteFroid.toFixed(2), msCoteChaud: +msCoteChaud.toFixed(3),
        msSans: chrono(() => fuseBathymetry(land, sea, Object.keys(base).length ? base : undefined)),
        msAvec: chrono(() => fuseBathymetry(land, sea, { ...base, ...(franche ? { merFranche: true } : {}) })),
      })
    }
  }
  return out
}, LIEUX)

console.log('\n  lieu                  z  tuile          zB sec  sans-bathy  veto franche | ÉMERGÉS av→ap | EAU av→ap  remontés  bits changés | côte froid/chaud ms | fusion −/+ ms')
for (const r of R) {
  if (r.erreur) { console.log(`  ${r.lieu.padEnd(20)} ${r.z}  ⚠ ${r.erreur}`); continue }
  console.log(`  ${r.lieu.padEnd(20)} ${String(r.z).padStart(2)} ${r.tuile.padEnd(14)} ${String(r.zBathy).padStart(2)} ${r.secours ? ' S' : '  '} ${String(r.sansBathy).padStart(10)} ${String(r.veto).padStart(5)} ${String(r.franche).padStart(7)} | ${String(r.emAv).padStart(6)} → ${String(r.emAp).padStart(6)} | ${String(r.eauAv).padStart(6)} → ${String(r.eauAp).padStart(6)} ${String(r.remontes).padStart(9)} ${String(r.bits).padStart(13)} | ${String(r.msCoteFroid).padStart(7)} / ${String(r.msCoteChaud).padStart(6)} | ${String(r.msSans).padStart(5)} / ${r.msAvec}`)
}
const pires = R.filter((r) => r.remontes > 0)
console.log(`\n  ⛔ pixels REMONTÉS (B6 doit ne jamais remonter) : ${pires.length ? pires.map((r) => `${r.lieu} z${r.z}=${r.remontes}`).join(', ') : '0 partout'}`)
console.log(`  ⛔ eau perdue : ${R.filter((r) => r.eauAp < r.eauAv).length ? 'OUI ⚠' : '0 partout'}`)
fs.writeFileSync(path.join(ICI, 'tableau.json'), JSON.stringify(R, null, 2))
await nav.close()
