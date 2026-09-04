// RAMP — LES GABARITS DE LA BOUTIQUE, UN PAR UN, AVANT / APRÈS.
//
// ⚡ **C'EST LE VRAI RISQUE DU CHANTIER**, et le brief le nomme : « l'identité
// de tous les templates est d'abord une rampe de couleur » (SUR). Chaque
// gabarit est posé DEUX FOIS dans la MÊME session, sur la MÊME pose, la MÊME
// seconde :
//
//   · « après » — la rampe fixe, le défaut du jour ;
//   · « avant » — l'option de re-normalisation cochée, c'est-à-dire le dépôt
//     d'avant ce chantier, dont `.banc/RAMP-RENORM` prouve qu'il est retrouvé
//     AU BIT (mêmes `uHeightPivot`, `uHeightContrast`, sur dix crans).
//
// ⚠️ **AU ZOOM D'ARRIVÉE, LES DEUX DOIVENT ÊTRE QUASI IDENTIQUES** — c'est la
// propriété que la référence de 40 km a été choisie pour donner (elle couvre
// 98,1 % du MNT à z11). L'écart mesuré ici EST le prix du correctif sur les
// gabarits, et il doit tenir sous 2 niveaux/255.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'

const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9341')
const OUT = opt('--out', '.banc/RAMP-GABARITS')
const LAT = +opt('--lat', '46.0122')
const LON = +opt('--lon', '7.8223')
const Z = +opt('--zoom', '11')
const CRANS = +opt('--crans', '0')
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
await page.evaluate(({ lat, lon, z }) => window.__exp.modes.flyTo(lat, lon, z), { lat: LAT, lon: LON, z: Z })
await dodo(15000)
for (let c = 0; c < CRANS; c++) { await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(3500) }

// le catalogue : les quatre gabarits du dépôt + ceux de la boutique
const gabarits = await page.evaluate(async () => {
  const mod = await import('/src/templates.js')
  const liste = Object.entries(mod.TEMPLATES).map(([id, t]) => ({ id, t }))
  try {
    const d = await (await fetch('/templates/data.json')).json()
    for (const s of d.templates || []) liste.push({ id: `boutique:${s.slug}`, t: s.look || s })
  } catch { /* la boutique peut être absente en local : on le dit dans le rapport */ }
  return liste.map((x) => x.id)
})
console.log('gabarits :', gabarits.join(', '))

async function pose(id, renorm) {
  await page.evaluate((v) => window.__exp.setRampeRenormalise(v), renorm)
  await page.evaluate(async (gid) => {
    const mod = await import('/src/templates.js')
    let t = mod.TEMPLATES[gid]
    if (!t && gid.startsWith('boutique:')) {
      const d = await (await fetch('/templates/data.json')).json()
      const s = (d.templates || []).find((x) => `boutique:${x.slug}` === gid)
      t = s?.look || s
    }
    if (t) window.__exp.applyTemplate(t)
  }, id)
  await dodo(2200)
  return page.evaluate(() => {
    const u = window.__exp.terrain.mapUniforms, d = window.__exp.dem, p = window.__exp.params
    const amp = d ? d.maxM - d.minM : null
    return {
      uHP: u.uHeightPivot.value, uHC: u.uHeightContrast.value, uTint: u.uTint.value,
      pHP: p.heightPivot, pHC: p.heightContrast,
      pivotM: amp ? +(d.minM + u.uHeightPivot.value * amp).toFixed(1) : null,
      fenetreM: amp ? +(amp / u.uHeightContrast.value).toFixed(1) : null,
    }
  })
}

// ⚡ **LA COULEUR QUE LE GABARIT DONNE À UNE ALTITUDE** — la seule lecture qui
// résiste. Voir le § du même nom dans `sonde-ramp.mjs` : la scène BOUGE, donc la
// diff d'écran ne sait pas séparer la rampe d'un nuage qui passe (le témoin
// ci-dessous le prouve : il est du MÊME ordre que la mesure). Ici on rejoue la
// loi du nuanceur sur les uniformes vivants et on lit la VRAIE table de rampe.
const ALTS = [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400]
const couleurs = () => page.evaluate((alts) => {
  const e = window.__exp, d = e.dem, u = e.terrain.mapUniforms
  const img = u.uRampTex?.value?.image
  if (!d || !img?.data) return null
  const W = img.width, H = img.height
  const amp = d.maxM - d.minM
  const yMid = Math.round((H - 1) * 0.5)
  return alts.map((h) => {
    const hNorm = Math.min(1, Math.max(0, (h - d.minM) / amp))
    const t = Math.min(1, Math.max(0, 0.5 + (hNorm - u.uHeightPivot.value) * u.uHeightContrast.value))
    const i = (yMid * W + Math.min(W - 1, Math.round(t * (W - 1)))) * 4
    return { h, r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] }
  })
}, ALTS)

async function capture(nom) {
  const b64 = await page.screenshot({ type: 'png', encoding: 'base64' })
  fs.writeFileSync(`${OUT}/${nom}.png`, Buffer.from(b64, 'base64'))
  return b64
}

// diff pixel à pixel, dans un canevas 2D alimenté par les DEUX fichiers PNG
async function ecart(b64a, b64b) {
  return page.evaluate(async (a, b) => {
    const lit = async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())
    const [ia, ib] = await Promise.all([lit(a), lit(b)])
    const cv = new OffscreenCanvas(ia.width, ia.height)
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(ia, 0, 0); const da = ctx.getImageData(0, 0, ia.width, ia.height).data
    ctx.clearRect(0, 0, ia.width, ia.height)
    ctx.drawImage(ib, 0, 0); const db = ctx.getImageData(0, 0, ib.width, ib.height).data
    let max = 0, somme = 0, n = 0, touches = 0
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
      if (d > max) max = d
      if (d > 2) touches++
      somme += d; n++
    }
    return { max, moyen: +(somme / n).toFixed(3), partTouchee: +(touches / n).toFixed(4) }
  }, b64a, b64b)
}

const res = []
for (const id of gabarits) {
  const apres = await pose(id, false)
  const lutApres = await couleurs()
  const ia = await capture(`${id.replace(/[:\\/]/g, '_')}-apres`)
  // ⚡ **LE TÉMOIN, ET IL EST OBLIGATOIRE.** La scène BOUGE toute seule — nuages,
  // houle, caustiques, course du soleil. Sans un second cliché pris dans les
  // MÊMES conditions et sans rien changer, on ne sait pas si un Δ de 170/255
  // vient de la rampe ou d'un nuage qui a avancé. Le témoin donne le PLANCHER
  // DE BRUIT ; seul ce qui le dépasse est imputable au correctif.
  await dodo(2200)
  const it = await capture(`${id.replace(/[:\\/]/g, '_')}-temoin`)
  const temoin = await ecart(ia, it)
  const avant = await pose(id, true)
  const lutAvant = await couleurs()
  const ib = await capture(`${id.replace(/[:\\/]/g, '_')}-avant`)
  const e = await ecart(ia, ib)
  let dAlt = 0, dAltH = null
  if (lutAvant && lutApres) {
    for (let k = 0; k < ALTS.length; k++) {
      const a = lutAvant[k], b = lutApres[k]
      const d = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
      if (d > dAlt) { dAlt = d; dAltH = ALTS[k] }
    }
  }
  res.push({ id, avant, apres, ecart: e, temoin, dAlt, dAltH, lutAvant, lutApres })
  console.log(`${id.padEnd(24)} · Δmax ${String(e.max).padStart(3)}/255 · Δmoyen ${e.moyen} · pixels > 2 : ${(e.partTouchee * 100).toFixed(2)} %`)
  console.log(`   témoin (rien changé)   Δmax ${temoin.max}/255 · Δmoyen ${temoin.moyen} · pixels > 2 : ${(temoin.partTouchee * 100).toFixed(2)} %`)
  console.log(`   ⚡ COULEUR D'UNE ALTITUDE : Δmax ${dAlt}/255 ${dAltH == null ? '' : `(à ${dAltH} m)`}`)
  console.log(`   avant  pivotM ${avant.pivotM} m · fenetreM ${avant.fenetreM} m · uHP ${avant.uHP} uHC ${avant.uHC}`)
  console.log(`   après  pivotM ${apres.pivotM} m · fenetreM ${apres.fenetreM} m · uHP ${apres.uHP} uHC ${apres.uHC}`)
}
fs.writeFileSync(`${OUT}/gabarits.json`, JSON.stringify({ lat: LAT, lon: LON, zoom: Z, crans: CRANS, res }, null, 1))
await nav.close()
