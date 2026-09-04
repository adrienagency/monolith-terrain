// VETO — le trait de côte en juge, tuile par tuile, aux vrais zooms.
//
// Rejoue EXACTEMENT ce que fait `fondMarinTuile` (src/globe.js) sur la tuile
// qui couvre un lieu, à chaque zoom demandé : terrarium décodé à la main,
// bathymétrie peinte par la vraie cascade, puis TROIS fusions —
//   avant   = la fusion d'avant PLAT (bande de bruit toujours armée)
//   plat    = PLAT seul (garde d'échelle)
//   veto    = PLAT + le trait de côte
// et compte les pixels de TERRE FRANCHE rendus à la mer par chacune, plus le
// coût de cuisson du masque (à froid et au cache chaud).
//
//   node scripts/veto-tuiles.mjs --port 8531 --lieu 43.45,4.60 --nom camargue
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8531'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const NOM = opt('--nom', 'camargue')
const ZOOMS = opt('--zooms', '11,12,13,15,17').split(',').map(Number)
const ICI = path.join(RACINE, '.banc', 'VETO')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zooms) => {
  const { fuseBathymetry, bandeBruitAdmise, resolutionBathyM, NOISE_BAND } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const { overzoomTile } = await import('/src/bathy.js')
  const { vetoTerre, videCacheVeto } = await import('/src/coast-veto.js')
  const index = await indexBathy()
  const src = DEM_SOURCES.mapterhorn
  const out = []
  for (const z of zooms) {
    const n = 2 ** z, latRad = (lat * Math.PI) / 180
    const tx = Math.floor(((lon + 180) / 360) * n)
    const ty = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    const maxZoom = (await resolveRegionMaxZoom(src, z, tx, ty)) ?? src.maxZoom
    const t = overzoomTile(z, tx, ty, maxZoom)
    const r = await fetch(src.url(t.z, t.x, t.y))
    if (!r.ok) { out.push({ z, erreur: `terrarium HTTP ${r.status}` }); continue }
    const img = await createImageBitmap(await r.blob())
    const PX = src.tilePx
    const c = document.createElement('canvas'); c.width = c.height = PX
    const g = c.getContext('2d', { willReadFrequently: true })
    const s = PX / t.scale
    g.drawImage(img, t.ox * PX, t.oy * PX, s, s, 0, 0, PX, PX)
    const p = g.getImageData(0, 0, PX, PX).data
    const land = new Float32Array(PX * PX)
    for (let i = 0; i < PX * PX; i++) land[i] = p[i * 4 + 3] === 0 ? 0 : p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
    const sea = new Float32Array(PX * PX).fill(NaN)
    const peint = await peindreBathyTuile({ zoom: z, tx, ty, index, dst: sea, dstStride: PX, dx: 0, dy: 0, dw: PX, dh: PX })
    if (peint < 0) { out.push({ z, erreur: 'aucune bathy' }); continue }
    const pasM = ((156543.03392 * Math.cos(latRad)) / 2 ** z) * (256 / PX)
    const bande = bandeBruitAdmise(resolutionBathyM(peint, lat), pasM)
    // ── le masque, et son COÛT ────────────────────────────────────────────
    videCacheVeto()
    const arg = { u0: tx / n, u1: (tx + 1) / n, v0: ty / n, v1: (ty + 1) / n, largeur: PX, hauteur: PX, metresParCellule: pasM, zoom: z, cle: `t/${z}/${tx}/${ty}/${PX}` }
    let t0 = performance.now()
    const veto = await vetoTerre(arg)
    const msFroid = performance.now() - t0
    t0 = performance.now()
    await vetoTerre(arg)
    const msChaud = performance.now() - t0
    // ── les trois fusions ────────────────────────────────────────────────
    const fAvant = fuseBathymetry(land, sea, { noiseBand: NOISE_BAND })
    const fPlat = fuseBathymetry(land, sea, { noiseBand: bande })
    const fVeto = fuseBathymetry(land, sea, { noiseBand: bande, ...(veto ? { terreVeto: veto } : {}) })
    // TERRE FRANCHE = terrarium strictement positif hors bande de quantification
    // ⚠️ le .webp est LOSSY : le zéro de mer ressort à ±0,5 m des deux côtés du
    // signe. On exige donc +0,05 m au moins, pour ne pas appeler « terre » du
    // bruit d'encodage — c'est le piège que le brief nomme.
    const noyes = (f) => { let k = 0; for (let i = 0; i < land.length; i++) if (land[i] > 0.05 && f[i] < 0) k++; return k }
    // ⛔ LA VENTILATION DU RESTE — sans elle on ne sait pas si le résidu est un
    // défaut ou la mer. Un pixel de terre franche encore noyé APRÈS veto est
    // soit sous veto (⇒ BOGUE, doit valoir 0), soit dans la bande d'incertitude
    // de 30 m autour du trait (⇒ le MNT garde la main, prévu), soit dans une
    // zone que la côte vectorielle déclare franchement MER (⇒ c'est l'eau
    // réelle : Méditerranée, étangs, salins).
    let resteSousVeto = 0, resteHorsVeto = 0
    if (veto) for (let i = 0; i < land.length; i++) {
      if (!(land[i] > 0.05 && fVeto[i] < 0)) continue
      if (veto[i]) resteSousVeto++
      else resteHorsVeto++
    }
    // Et la RECTANGULARITÉ : une cellule de source entièrement noyée alors que
    // la côte la déclare terre, c'est UN CARRÉ PLAT. C'est le critère d'Adrien,
    // traduit en pixels : on balaie la grille au pas de la cellule de source.
    const cellPx = Math.max(1, Math.round(resolutionBathyM(peint, lat) / pasM))
    const carres = (f) => {
      let k = 0
      for (let by = 0; by + cellPx <= PX; by += cellPx) for (let bx = 0; bx + cellPx <= PX; bx += cellPx) {
        let terreCote = 0, noyee = 0
        for (let y = by; y < by + cellPx; y++) for (let x = bx; x < bx + cellPx; x++) {
          const i = y * PX + x
          if (veto && veto[i]) terreCote++
          if (land[i] > 0.05 && f[i] < 0) noyee++
        }
        if (noyee === cellPx * cellPx && terreCote === cellPx * cellPx) k++
      }
      return k
    }
    // ⛔ L'EAU RÉELLE — LE CRITÈRE QUI COMPTE AUTANT QUE LES CARRÉS. On compte
    // les pixels que la fusion laisse SOUS ZÉRO, avant et après veto, et on
    // sépare ceux que la côte vectorielle déclare MER (l'eau à défendre :
    // Méditerranée, étangs, salins) de ceux qu'elle déclare TERRE.
    let eauPlat = 0, eauVeto = 0, eauMerPlat = 0, eauMerVeto = 0
    for (let i = 0; i < land.length; i++) {
      if (fPlat[i] < 0) { eauPlat++; if (!veto || !veto[i]) eauMerPlat++ }
      if (fVeto[i] < 0) { eauVeto++; if (!veto || !veto[i]) eauMerVeto++ }
    }
    // le COÛT DE FUSION, avec et sans veto (médiane de 5)
    const chrono = (fn) => { const v = []; for (let k = 0; k < 5; k++) { const a = performance.now(); fn(); v.push(performance.now() - a) } return v.sort((x, y) => x - y)[2] }
    let terre = 0
    for (let i = 0; i < land.length; i++) if (land[i] > 0.05) terre++
    let vetes = 0
    if (veto) for (const v of veto) if (v) vetes++
    out.push({
      z, tx, ty, px: PX, zBathy: peint, pasM: +pasM.toFixed(3),
      resSourceM: +resolutionBathyM(peint, lat).toFixed(1),
      rapport: +(resolutionBathyM(peint, lat) / pasM).toFixed(1),
      bande, masque: veto ? 'oui' : 'null',
      partVetee: veto ? +((100 * vetes) / veto.length).toFixed(1) : null,
      terreFranche: terre,
      noyesAvant: noyes(fAvant), noyesPlat: noyes(fPlat), noyesVeto: noyes(fVeto),
      resteSousVeto, resteHorsVeto, cellPx,
      eauPlat, eauVeto, eauMerPlat, eauMerVeto,
      carresAvant: carres(fAvant), carresPlat: carres(fPlat), carresVeto: carres(fVeto),
      msVetoFroid: +msFroid.toFixed(2), msVetoChaud: +msChaud.toFixed(3),
      msFusionSansVeto: +chrono(() => fuseBathymetry(land, sea, { noiseBand: bande })).toFixed(2),
      msFusionAvecVeto: +chrono(() => fuseBathymetry(land, sea, { noiseBand: bande, ...(veto ? { terreVeto: veto } : {}) })).toFixed(2),
    })
  }
  return out
}, LAT, LON, ZOOMS)

console.log(`\n${NOM} ${LAT},${LON}`)
console.log('  z  px  eau totale plat→veto   eau EN ZONE MER plat→veto (doit etre identique)')
for (const r of R) if (!r.erreur) console.log(`  ${String(r.z).padStart(2)} ${String(r.px).padStart(4)}   ${String(r.eauPlat).padStart(7)} → ${String(r.eauVeto).padStart(7)}      ${String(r.eauMerPlat).padStart(7)} → ${String(r.eauMerVeto).padStart(7)}  ${r.eauMerPlat===r.eauMerVeto?'OK':'⚠ EAU PERDUE'}`)
console.log('  z  px  cell  carrés av/plat/veto   reste sous-veto | hors-veto')
for (const r of R) if (!r.erreur) console.log(`  ${String(r.z).padStart(2)} ${String(r.px).padStart(4)} ${String(r.cellPx).padStart(5)}   ${String(r.carresAvant).padStart(4)}/${String(r.carresPlat).padStart(4)}/${String(r.carresVeto).padStart(4)}       ${String(r.resteSousVeto).padStart(6)} | ${r.resteHorsVeto}`)
console.log('  z  px   pas m  source m  rapp  bande  masque  %veté  terreFranche  noyés av → plat → veto   veto froid/chaud ms   fusion −/+ veto ms')
for (const r of R) {
  if (r.erreur) { console.log(`  ${r.z}  ⚠ ${r.erreur}`); continue }
  console.log(`  ${String(r.z).padStart(2)} ${String(r.px).padStart(4)} ${String(r.pasM).padStart(7)} ${String(r.resSourceM).padStart(9)} ${String(r.rapport).padStart(5)} ${String(r.bande).padStart(6)} ${String(r.masque).padStart(7)} ${String(r.partVetee).padStart(6)} ${String(r.terreFranche).padStart(13)}   ${String(r.noyesAvant).padStart(7)} → ${String(r.noyesPlat).padStart(7)} → ${String(r.noyesVeto).padStart(7)}     ${String(r.msVetoFroid).padStart(7)} / ${String(r.msVetoChaud).padStart(6)}    ${String(r.msFusionSansVeto).padStart(5)} / ${r.msFusionAvecVeto}`)
}
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
