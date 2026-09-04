// PLAT — les trois champs côte à côte : terrarium brut, bathymétrie fine, fusion.
// Chaque champ est rendu en fausses couleurs (terre / mer) pour VOIR d'où
// viennent les rectangles. On sort aussi les chiffres qui décident.
//   node scripts/plat-champs.mjs --port 8231 --lieu 43.45,4.60 --zoom 17
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8231'))
const [LAT, LON] = opt('--lieu', '43.45,4.60').split(',').map(Number)
const ZOOM = Number(opt('--zoom', '17'))
const NOM = opt('--nom', 'camargue')
const ICI = path.join(RACINE, '.banc', 'PLAT', opt('--dossier', 'champs'))
fs.mkdirSync(ICI, { recursive: true })
// Page NUE, sur l'origine du serveur : on importe les modules de `src/` sans
// charger l'application. Semee ici pour qu'aucun banc ne depende d'un fichier
// de travail reste au depot.
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const APRES = A.includes('--apres')
const R = await page.evaluate(async (lat, lon, zoom, apres) => {
  const { overzoomTile, fuseBathymetry, detectNoiseFill, detectFillLevels, NOISE_BAND, bandeBruitAdmise, resolutionBathyM } = await import('/src/bathy.js')
  const { DEM_SOURCES, resolveRegionMaxZoom } = await import('/src/dem-source.js')
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const n = 2 ** zoom, latRad = lat * Math.PI / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  const src = DEM_SOURCES.mapterhorn
  const maxZoom = (await resolveRegionMaxZoom(src, zoom, cx, cy)) ?? src.maxZoom
  const TP = 512, S = 3 * TP
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d', { willReadFrequently: true })
  const index = await indexBathy()
  const sea = new Float32Array(S * S).fill(NaN)
  const zBathy = new Set()
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = cx + dx, ty = cy + dy, ox = (dx + 1) * TP, oy = (dy + 1) * TP
    const t = overzoomTile(zoom, tx, ty, maxZoom)
    const r = await fetch(src.url(t.z, t.x, t.y))
    if (r.ok) { const img = await createImageBitmap(await r.blob()); const s = TP / t.scale; g.drawImage(img, t.ox * TP, t.oy * TP, s, s, ox, oy, TP, TP) }
    zBathy.add(await peindreBathyTuile({ zoom, tx, ty, index, dst: sea, dstStride: S, dx: ox, dy: oy, dw: TP, dh: TP }))
  }
  const p = g.getImageData(0, 0, S, S).data
  const land = new Float32Array(S * S)
  for (let i = 0; i < S * S; i++) land[i] = p[i * 4 + 3] === 0 ? 0 : p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
  const bruitZero = detectNoiseFill(land, sea)
  const aplats = [...detectFillLevels(land)]
  const zPire = Math.min(...[...zBathy].filter((z) => z >= 0))
  const mppBloc = ((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TP)
  const resSource = resolutionBathyM(zPire, lat)
  const bande = bandeBruitAdmise(resSource, mppBloc)
  const fusedAvant = fuseBathymetry(land, sea, { noiseBand: NOISE_BAND })
  const fusedApres = fuseBathymetry(land, sea, { noiseBand: bande })
  const fused = apres ? fusedApres : fusedAvant
  // POURQUOI un pixel de terre finit-il en mer, APRÈS correctif ? Les trois
  // portes de `fuseBathymetry` : zéro exact, aplat de remplissage, bande de bruit.
  const NODATA_EPS = 1 / 512
  const plancher = aplats.length ? Math.min(...aplats) : NaN
  const causes = { zeroExact: 0, aplat: 0, bande: 0, dejaSousZero: 0, autre: 0 }
  for (let i = 0; i < land.length; i++) {
    if (!(fusedApres[i] < 0)) continue
    const l = land[i]
    if (l < 0) { causes.dejaSousZero++; continue }
    if (l > -NODATA_EPS && l < NODATA_EPS) causes.zeroExact++
    else if (l < 0 && l >= plancher) causes.aplat++
    else causes.autre++
  }
  // combien de pixels le correctif RENDS À LA TERRE, et combien il change ailleurs ?
  let rendusTerre = 0, changesEnMer = 0
  for (let i = 0; i < land.length; i++) {
    if (fusedAvant[i] !== fusedApres[i]) { if (fusedApres[i] >= 0 && fusedAvant[i] < 0) rendusTerre++; else changesEnMer++ }
  }
  // combien de pixels la fusion FAIT PASSER DE TERRE À MER ?
  let bascules = 0, terre = 0, mer = 0
  // ⚠️ ON SÉPARE LES BASCULES LÉGITIMES DES AUTRES. Un remplissage du terrarium
  // (|l| ≤ 1/256 ou aplat constaté) qui devient de la mer : c'est le but. Une
  // TERRE FRANCHE (l > 1/256, hors aplat) qui devient de la mer : c'est le défaut.
  const aplatsSet = new Set(aplats)
  let basculesTerreFranche = 0
  const profondeurs = []
  for (let i = 0; i < land.length; i++) {
    const l = land[i]
    if (l >= 0 && fused[i] < 0) {
      bascules++
      if (l > 1 / 256 && !aplatsSet.has(l)) { basculesTerreFranche++; if (profondeurs.length < 400000) profondeurs.push(sea[i]) }
    }
    if (fused[i] >= 0) terre++; else mer++
  }
  profondeurs.sort((a, b) => a - b)
  const q = (p) => (profondeurs.length ? +profondeurs[Math.floor(p * (profondeurs.length - 1))].toFixed(2) : null)
  // LA MARCHE : écart d'altitude moyen sur les colonnes ALIGNÉES sur la cellule
  // de la source fine, comparé aux colonnes quelconques. Un carré plat à angles
  // droits, c'est exactement une marche sur une colonne alignée.
  const zb = [...zBathy].filter((z) => z >= 0)
  const cell = zb.length ? Math.round((156543.03392 * Math.cos(latRad) / 2 ** Math.max(...zb)) / (((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TP))) : 0
  const saut = (aligne) => {
    let s = 0, k = 0, pire = 0
    for (let x = 1; x < S; x++) {
      const surGrille = cell > 1 && x % cell === 0
      if (surGrille !== aligne) continue
      for (let y = 0; y < S; y += 4) { const d = Math.abs(fused[y * S + x] - fused[y * S + x - 1]); s += d; k++; if (d > pire) pire = d }
    }
    return { moyen: k ? +(s / k).toFixed(3) : null, pire: +pire.toFixed(2), colonnes: cell > 1 ? (aligne ? Math.floor(S / cell) : S - 1 - Math.floor(S / cell)) : 0 }
  }
  // ÎLOTS DE TERRE DANS L'EAU — le « carré blanc ». Case de 32×32 entièrement
  // émergée dont les quatre voisines sont entièrement immergées.
  const P = 32, NB = Math.floor(S / P)
  const etat = new Int8Array(NB * NB) // 1 terre pleine, -1 mer pleine, 0 mixte
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    let t = 0, m = 0
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) (fused[(by * P + y) * S + bx * P + x] >= 0 ? t++ : m++)
    etat[by * NB + bx] = t === P * P ? 1 : m === P * P ? -1 : 0
  }
  let ilots = 0
  for (let by = 1; by < NB - 1; by++) for (let bx = 1; bx < NB - 1; bx++) {
    if (etat[by * NB + bx] !== 1) continue
    if (etat[(by - 1) * NB + bx] === -1 && etat[(by + 1) * NB + bx] === -1 && etat[by * NB + bx - 1] === -1 && etat[by * NB + bx + 1] === -1) ilots++
  }
  // rendu : rouge = terre, bleu = mer, vert = basculé par la fusion
  const dessine = (champ, mode) => {
    const cc = document.createElement('canvas'); cc.width = cc.height = S
    const gg = cc.getContext('2d'); const im = gg.createImageData(S, S)
    for (let i = 0; i < S * S; i++) {
      const v = champ[i]
      let r0, g0, b0
      if (!Number.isFinite(v)) { r0 = g0 = b0 = 255 }
      else if (v >= 0) { const k = Math.min(255, 128 + v * 60); r0 = k; g0 = k * 0.7; b0 = k * 0.4 }
      else { const k = Math.min(255, 60 + (-v) * 60); r0 = 0; g0 = k * 0.5; b0 = k }
      im.data[i * 4] = r0; im.data[i * 4 + 1] = g0; im.data[i * 4 + 2] = b0; im.data[i * 4 + 3] = 255
    }
    gg.putImageData(im, 0, 0)
    return cc.toDataURL('image/png')
  }
  return {
    zoom, cx, cy, maxZoom, mpp: ((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TP),
    zBathy: [...zBathy], bruitZero, NOISE_BAND, aplats,
    zPire, resSource: +resSource.toFixed(1), rapport: +(resSource / mppBloc).toFixed(1),
    bandeRetenue: bande, rendusTerre, changesEnMer, causes,
    landMin: land.reduce((a, b) => (b < a ? b : a), Infinity), landMax: land.reduce((a, b) => (b > a ? b : a), -Infinity),
    bascules, basculesTerreFranche, terre, mer, total: S * S,
    profondeurBascule: { p05: q(0.05), median: q(0.5), p95: q(0.95) },
    celluleBathyPx: cell, marcheAlignee: saut(true), marcheQuelconque: saut(false),
    ilots,
    png: { land: dessine(land), sea: dessine(sea), avant: dessine(fusedAvant), apres: dessine(fusedApres), muets: (() => {
      // MASQUE DES PIXELS MUETS DU TERRARIUM : noir = zéro exact ou aplat, blanc = mesure.
      const cc = document.createElement('canvas'); cc.width = cc.height = S
      const gg = cc.getContext('2d'); const im = gg.createImageData(S, S)
      for (let i = 0; i < S * S; i++) {
        const l = land[i]
        const muet = (l > -NODATA_EPS && l < NODATA_EPS) || (l < 0 && l >= plancher)
        const k = muet ? 0 : l < 0 ? 90 : 235
        im.data[i * 4] = k; im.data[i * 4 + 1] = k; im.data[i * 4 + 2] = k; im.data[i * 4 + 3] = 255
      }
      gg.putImageData(im, 0, 0); return cc.toDataURL('image/png')
    })() },
  }
}, LAT, LON, ZOOM, APRES)
const png = R.png; delete R.png
for (const [k, v] of Object.entries(png)) fs.writeFileSync(path.join(ICI, `${NOM}-${k}.png`), Buffer.from(v.split(',')[1], 'base64'))
fs.writeFileSync(path.join(ICI, `${NOM}.json`), JSON.stringify(R, null, 2))
console.log(JSON.stringify(R, null, 1))
await nav.close()
