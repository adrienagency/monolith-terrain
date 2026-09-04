// DENT — LE DÉFAUT EN MOUVEMENT. Le brief le dit : « le défaut de MER
// n'apparaissait qu'EN MOUVEMENT ». On vole vers Rodrigues et on capture SANS
// attendre la stabilisation, en lisant à chaque fois l'état du champ de la mer.
//
// ⚠️ On lit la texture du champ CORRECTEMENT : RG **demi-flottant**, stride 2.
// Un stride de 4 rend « exactement 50 % de terre » — un artefact d'indexation
// qui m'a fait perdre un tour.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
import path from 'node:path'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9433')
const LAT = Number(opt('--lat', '-19.7253')), LON = Number(opt('--lon', '63.3691'))
const ZOOM = Number(opt('--zoom', '11')), ALT = Number(opt('--alt', '32849'))
const ELEV = Number(opt('--elevation', '34')), AZIM = Number(opt('--azimut', '45'))
const N = Number(opt('--images', '25'))
const PAS = Number(opt('--pas', '1200'))
const OUT = opt('--out', '.banc/DENT/mouvement')
fs.mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(200) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(1500)

// ══════ LE CHAMP, LU AU BON PAS ══════════════════════════════════════════════
const ETAT = `(() => {
  const e = window.__exp, g = e.globe, mer = g._mer
  const et = g._merEtat || null
  const U = g.uniforms
  const base = {
    alt: e.altitudeCadrageM(), demi: U.uCropDemi.value, on: U.uCropOn.value,
    mer: !!mer, busy: !!e.modes.busy, travel: !!e.modes.travel,
    couverture: et && et.couverture, compte: et && et.compte,
  }
  if (!mer) return base
  const mu = mer.material.uniforms
  const tex = mu.uMerChamp.value, img = tex && tex.image
  base.profMax = mu.uMerProfMax ? mu.uMerProfMax.value : null
  if (img && img.data && img.data.BYTES_PER_ELEMENT === 2) {
    // demi-flottant -> flottant, sans dependre de THREE
    const demi = (h) => {
      const s = (h & 0x8000) ? -1 : 1, ex = (h >> 10) & 0x1f, f = h & 0x3ff
      if (ex === 0) return s * f * Math.pow(2, -24)
      if (ex === 31) return f ? NaN : s * Infinity
      return s * (f + 1024) * Math.pow(2, ex - 25)
    }
    const p = mu.uMerPortee.value
    let dans = 0, sec = 0, zero = 0, profMin = 0
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const u = ((i + 0.5) / img.width - 0.5) * 2 * p
        const v = ((j + 0.5) / img.height - 0.5) * 2 * p
        if (Math.abs(u) > 1 || Math.abs(v) > 1) continue
        dans++
        const r = demi(img.data[(j * img.width + i) * 2])
        if (r >= 0) sec++
        if (r === 0) zero++
        if (r < profMin) profMin = r
      }
    }
    base.champ = { cote: img.width, dansEmprise: dans, texelsSecs: sec, texelsZero: zero, partSeche: dans ? sec / dans : null, fondLePlusBas: profMin }
  }
  return base
})()`

await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
const poser = () => page.evaluate(([a, el, az]) => {
  const e = window.__exp, cam = e.camera, ct = e.controls
  ct.minDistance = 1e-4; ct.maxDistance = 1e12
  const dir = cam.position.clone().sub(ct.target).normalize()
  for (let i = 0; i < 60; i++) {
    const v = e.altitudeCadrageM(); if (!(v > 0)) break
    const d = cam.position.distanceTo(ct.target); const nd = d * (a / v); if (!(nd > 0)) break
    cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.()
    if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
  }
  const d = cam.position.distanceTo(ct.target), p = (el * Math.PI) / 180, q = (az * Math.PI) / 180
  cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(q), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(q))
  cam.lookAt(ct.target); ct.update?.()
}, [ALT, ELEV, AZIM])

const journal = []
for (let k = 0; k < N; k++) {
  await dodo(PAS)
  await poser().catch(() => {})
  const s = await page.evaluate(ETAT).catch(() => null)
  journal.push(s)
  console.log(k, JSON.stringify(s))
  await page.screenshot({ path: path.join(OUT, `m_${String(k).padStart(3, '0')}.png`) })
}
fs.writeFileSync(path.join(OUT, 'journal.json'), JSON.stringify(journal, null, 2))
await nav.close()
