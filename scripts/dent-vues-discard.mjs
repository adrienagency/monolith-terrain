// DENT — LES TROIS VUES : reference, sans le discard « terre », sans le discard
// « bord ». Une capture par variante, au cadrage d'Adrien (Rodrigues, z11).
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
const OUT = opt('--out', '.banc/DENT/discard')
const ETIQ = opt('--etiquette', '')
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
await dodo(2000)
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
await dodo(9000)
const poser = async () => {
  await page.evaluate(([a, el, az]) => {
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
  await dodo(2500)
}
await poser()
const variantes = ['reference', 'sansDiscardTerre', 'sansDiscardBord']
for (const v of variantes) {
  const ok = await page.evaluate((k) => {
    const mer = window.__exp.globe._mer
    if (!mer) return 'pas de nappe'
    if (!window.__DENT_SRC0) window.__DENT_SRC0 = mer.material.fragmentShader
    const s0 = window.__DENT_SRC0
    let s = s0
    if (k === 'sansDiscardTerre') s = s0.replace('if (profondeur <= 0.0) discard;', '//')
    if (k === 'sansDiscardBord') s = s0.replace('if (bord <= 0.0) discard;', '//')
    if (k !== 'reference' && s === s0) return 'ligne introuvable'
    mer.material.fragmentShader = s
    mer.material.needsUpdate = true
    return 'ok'
  }, v)
  await poser()
  await dodo(1500)
  await page.screenshot({ path: path.join(OUT, `${ETIQ}${v}.png`) })
  console.log(v, ok)
}
await nav.close()
