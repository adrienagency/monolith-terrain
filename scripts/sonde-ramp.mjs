// RAMP — la loi de teinte EN MÈTRES, au fil des crans.
//
// ⚠️ On ne relève PAS `uHeightPivot` / `uHeightContrast` tels quels : ce sont
// des nombres NORMALISÉS sur `[dem.minM ; dem.maxM]`, qui bouge à chaque cran.
// Deux nombres normalisés dans deux domaines différents ne se comparent pas.
// On les remonte donc en MÈTRES — l'altitude où tombe le milieu de la rampe, et
// la largeur de la fenêtre utile — parce qu'un mètre ne dépend d'aucun domaine.
//
//     pivotM   = minM + uHeightPivot × (maxM − minM)
//     fenetreM = (maxM − minM) / uHeightContrast
//
// C'est la MÊME remontée que `gradeCrop` (src/monde/rampe-crop.js §⑨) — pas une
// seconde loi.
//
// ⛔ `readPixels` / `drawImage` rendent 0 partout dans ce dépôt (rendu par
// composer, pas de `preserveDrawingBuffer`) : la couleur est lue sur la CAPTURE
// D'ÉCRAN, seule lecture fiable du pixel ici (rapport-SUR §5).
// ⛔ `page.mouse.wheel` ne bouge rien (voile `.ce-elemwrap`) : `modes.cranZoom`.
// ⛔ `gotoCtl.go` atterrit 32× trop serré : `modes.flyTo`.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'

const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9341')
const OUT = opt('--out', '.banc/RAMP')
const LAT = +opt('--lat', '46.0122')
const LON = +opt('--lon', '7.8223')
const Z = +opt('--zoom', '11')
const CRANS = +opt('--crans', '9')
const RENORM = A.includes('--renorm')
fs.mkdirSync(OUT, { recursive: true })

const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--window-size=1280,920', '--use-angle=default'],
  defaultViewport: { width: 1280, height: 800 },
})
console.log('PID chrome', nav.process()?.pid)
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(150) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
if (RENORM) await page.evaluate(() => window.__exp.setRampeRenormalise(true))
await page.evaluate(({ lat, lon, z }) => window.__exp.modes.flyTo(lat, lon, z), { lat: LAT, lon: LON, z: Z })
await dodo(15000)

const lis = () => page.evaluate(() => {
  const e = window.__exp, d = e.dem, u = e.terrain.mapUniforms
  const n = d?.data?.length ? Math.round(Math.sqrt(d.data.length)) : null
  const amp = d ? d.maxM - d.minM : null
  return {
    min: d?.minM, max: d?.maxM, ampl: amp == null ? null : +amp.toFixed(0),
    ext: Math.round(d?.extentMeters ?? 0), n,
    mParTexel: n && d ? +(d.extentMeters / n).toFixed(2) : null,
    uTint: u.uTint.value, uHC: u.uHeightContrast.value, uHP: u.uHeightPivot.value,
    pHP: e.params?.heightPivot, pHC: e.params?.heightContrast,
    // ⚡ LA GRANDEUR QUI SE COMPARE : la loi en mètres.
    pivotM: amp == null ? null : +(d.minM + u.uHeightPivot.value * amp).toFixed(1),
    fenetreM: amp == null ? null : +(amp / Math.max(u.uHeightContrast.value, 1e-6)).toFixed(1),
    alt: Math.round(e.altitudeCadrageM?.() ?? 0),
    renorm: !!e.params?.rampeRenormalise,
  }
})

// ══════════ LE CRITÈRE : LA COULEUR D'UNE ALTITUDE DONNÉE ══════════════════
//
// ⛔ **LA MOYENNE RGB D'UNE FENÊTRE D'ÉCRAN NE MESURE PAS LA RAMPE, ET C'EST LE
// PIÈGE QUE J'AI PAYÉ ICI.** Un cran CHANGE LE CADRAGE : entre le cran 0 et le
// cran 9 la caméra passe de 3 744 m à 292 m d'altitude, donc le carré central
// ne montre plus le même sol, ni le même relief, ni la même brume. La chroma
// bougeait de 33/255 AVANT comme APRÈS — sur un correctif qui rend pourtant la
// loi rigoureusement constante. La capture reste dans le banc, comme preuve
// VISUELLE pour Adrien ; elle n'est pas le chiffre.
//
// ⚡ **LE CHIFFRE, C'EST LA COULEUR QUE LE NUANCEUR DONNE À UNE ALTITUDE.** On
// rejoue sa loi — `rampT = clamp(0,5 + (hNorm − pivot) × contraste, 0, 1)` — sur
// les uniformes VIVANTS, et on lit la vraie table de rampe (`uRampTex`). C'est
// la même transcription que `test/crop-rampe.test.js` fait du nuanceur : pas une
// seconde loi, la même.
const ALTS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800, 4200]
const couleurs = () => page.evaluate((alts) => {
  const e = window.__exp, d = e.dem, u = e.terrain.mapUniforms
  if (!d || !Number.isFinite(d.minM)) return null
  const tex = u.uRampTex?.value
  const img = tex?.image
  if (!img?.data) return null
  const W = img.width, H = img.height
  const amp = d.maxM - d.minM
  const yMid = Math.min(H - 1, Math.round((H - 1) * 0.5)) // wetY = 0.5
  return alts.map((h) => {
    const hNorm = Math.min(1, Math.max(0, (h - d.minM) / amp))
    const t = Math.min(1, Math.max(0, 0.5 + (hNorm - u.uHeightPivot.value) * u.uHeightContrast.value))
    const x = Math.min(W - 1, Math.round(t * (W - 1)))
    const i = (yMid * W + x) * 4
    return { h, t: +t.toFixed(5), r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] }
  })
}, ALTS)

// La teinte à l'écran : moyenne RGB d'une fenêtre centrale, lue sur la capture.
const CADRE = { x: 440, y: 260, w: 400, h: 280 }
async function teinte(nom) {
  const b64 = await page.screenshot({ type: 'png', encoding: 'base64' })
  fs.writeFileSync(`${OUT}/${nom}.png`, Buffer.from(b64, 'base64'))
  // ⚠️ Le PNG est décodé dans un canevas 2D À PARTIR DU FICHIER, jamais lu sur
  // le tampon WebGL : c'est la lecture que SUR a validée.
  const { r, g, b } = await page.evaluate(async (src, c) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${src}`)).blob())
    const cv = new OffscreenCanvas(c.w, c.h)
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bmp, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h)
    const d = ctx.getImageData(0, 0, c.w, c.h).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    const n = d.length / 4
    return { r: r / n, g: g / n, b: b / n }
  }, b64, CADRE)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  return { r: +r.toFixed(2), g: +g.toFixed(2), b: +b.toFixed(2), chroma: +(mx - mn).toFixed(2), sat: +(mx > 0 ? (mx - mn) / mx : 0).toFixed(4) }
}

const t = [{ cran: 0, ...(await lis()), ...(await teinte('c0')), lut: await couleurs() }]
for (let c = 1; c <= CRANS; c++) {
  await page.evaluate(() => window.__exp.modes.cranZoom(1))
  await dodo(3500)
  t.push({ cran: c, ...(await lis()), ...(await teinte(`c${c}`)), lut: await couleurs() })
}
fs.writeFileSync(`${OUT}/crans.json`, JSON.stringify(t, null, 1))
for (const x of t) {
  console.log(`cran ${x.cran} · alt ${x.alt} m · ${x.n}² sur ${x.ext} m = ${x.mParTexel} m/texel · MNT ${x.min}–${x.max} (${x.ampl} m) · pivotM ${x.pivotM} m · fenetreM ${x.fenetreM} m · uHP ${x.uHP} uHC ${x.uHC} · chroma ${x.chroma} sat ${x.sat}`)
}
const piv = t.map((x) => x.pivotM).filter(Number.isFinite)
const fen = t.map((x) => x.fenetreM).filter(Number.isFinite)
const ch = t.map((x) => x.chroma)
console.log(`\npivotM   ${Math.min(...piv)} → ${Math.max(...piv)} m  (étendue ${(Math.max(...piv) - Math.min(...piv)).toFixed(1)} m)`)
console.log(`fenetreM ${Math.min(...fen)} → ${Math.max(...fen)} m  (rapport ×${(Math.max(...fen) / Math.min(...fen)).toFixed(2)})`)
console.log(`chroma   ${Math.min(...ch)} → ${Math.max(...ch)}      (étendue ${(Math.max(...ch) - Math.min(...ch)).toFixed(2)}/255)`)
let pire = 0
for (let i = 1; i < t.length; i++) {
  const d = Math.max(Math.abs(t[i].r - t[i - 1].r), Math.abs(t[i].g - t[i - 1].g), Math.abs(t[i].b - t[i - 1].b))
  if (d > pire) pire = d
}
console.log(`écart de la MOYENNE D'ÉCRAN entre deux crans voisins : ${pire.toFixed(2)}/255  (⛔ le cadrage change, ce n'est PAS le critère)`)

// ⚡ LE CRITÈRE — la couleur d'une altitude donnée, d'un cran au suivant.
// ⚠️ **ON NE COMPARE QUE LES ALTITUDES PRÉSENTES À TOUS LES CRANS.** Le
// nuanceur écrête `hNorm` à [0 ; 1] : une altitude HORS du MNT chargé (3 800 m
// dans un bloc qui culmine à 3 260) bute sur le bout de la rampe, et l'écart
// relevé — 131/255 sur mon premier passage — ne dit rien de la loi. C'est le
// même écrêtage qu'avant le correctif, et il porte sur un relief ABSENT DE
// L'ÉCRAN. Le domaine commun aux dix crans est l'intersection des MNT.
const luts = t.filter((x) => x.lut)
const bas = Math.max(...luts.map((x) => x.min))
const haut = Math.min(...luts.map((x) => x.max))
const IDX = ALTS.map((h, k) => (h >= bas && h <= haut ? k : -1)).filter((k) => k >= 0)
console.log(`\naltitudes présentes à TOUS les crans : [${bas.toFixed(0)} ; ${haut.toFixed(0)}] m → ${IDX.map((k) => ALTS[k]).join(', ')} m`)
let pireVoisin = 0, pireVoisinH = null, pireTotal = 0, pireTotalH = null
for (const k of IDX) {
  for (let i = 1; i < luts.length; i++) {
    const a = luts[i - 1].lut[k], b = luts[i].lut[k]
    const d = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
    if (d > pireVoisin) { pireVoisin = d; pireVoisinH = `${ALTS[k]} m, crans ${luts[i - 1].cran}→${luts[i].cran}` }
  }
  const rs = luts.map((x) => x.lut[k])
  const d = Math.max(
    Math.max(...rs.map((x) => x.r)) - Math.min(...rs.map((x) => x.r)),
    Math.max(...rs.map((x) => x.g)) - Math.min(...rs.map((x) => x.g)),
    Math.max(...rs.map((x) => x.b)) - Math.min(...rs.map((x) => x.b))
  )
  if (d > pireTotal) { pireTotal = d; pireTotalH = `${ALTS[k]} m` }
}
console.log(`\n⚡ CRITÈRE — couleur d'une ALTITUDE donnée :`)
console.log(`   écart max entre deux crans VOISINS : ${pireVoisin}/255  (${pireVoisinH})`)
console.log(`   écart max sur les ${luts.length} crans      : ${pireTotal}/255  (${pireTotalH})`)
fs.writeFileSync(`${OUT}/altitudes.json`, JSON.stringify({ ALTS, communes: IDX.map((k) => ALTS[k]), bas, haut, pireVoisin, pireTotal, luts: luts.map((x) => ({ cran: x.cran, lut: x.lut })) }, null, 1))
await nav.close()
