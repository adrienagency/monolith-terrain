// SUR — A/B dans la MÊME session : on éteint un candidat à la fois et on
// capture. Pose imposée par altitude (altitudeCadrageM), comme dent-*.mjs.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9833')
const LAT = Number(opt('--lat', '46.0122'))
const LON = Number(opt('--lon', '7.8223'))
const ZOOM = Number(opt('--zoom', '11'))
const ALT = Number(opt('--alt', '18000'))
const ELEV = Number(opt('--elevation', '52'))
const AZIM = Number(opt('--azimut', '0'))
const OUT = opt('--out', '.banc/SUR-AB')
fs.mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(150) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
await dodo(14000)
await page.evaluate(async (a) => {
  const e = window.__exp, cam = e.camera, ct = e.controls
  ct.minDistance = 1e-4; ct.maxDistance = 1e12
  const dir = cam.position.clone().sub(ct.target).normalize()
  for (let i = 0; i < 60; i++) {
    const v = e.altitudeCadrageM(); if (!(v > 0)) break
    const d = cam.position.distanceTo(ct.target); const nd = d * (a / v); if (!(nd > 0)) break
    cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.()
    if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
  }
}, ALT)
await page.evaluate(([el, az]) => {
  const e = window.__exp, cam = e.camera, ct = e.controls
  const d = cam.position.distanceTo(ct.target), p = (el * Math.PI) / 180, a = (az * Math.PI) / 180
  cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(a), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(a))
  cam.lookAt(ct.target); ct.update?.()
}, [ELEV, AZIM])
await dodo(6000)

const inventaire = await page.evaluate(() => {
  const e = window.__exp
  const out = []
  e.scene.traverse((o) => {
    if (!o.visible || !o.material) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    const tex = Object.entries(m).filter(([, v]) => v && v.isTexture).map(([k, v]) => `${k}:${v.image?.width ?? '?'}x${v.image?.height ?? '?'}`)
    const uni = m.uniforms ? Object.entries(m.uniforms).filter(([, v]) => v?.value?.isTexture).map(([k, v]) => `${k}:${v.value.image?.width ?? '?'}x${v.value.image?.height ?? '?'}`) : []
    out.push({ nom: o.name || o.type, mat: m.type + (m.name ? `(${m.name})` : ''), tex: tex.concat(uni) })
  })
  return { objets: out.slice(0, 80), total: out.length, info: JSON.parse(JSON.stringify(e.renderer.info.render)), grade: e.reliefGrade, params: { colorMode: e.params.colorMode, shadeAuto: e.params.shadeAuto, mapTint: e.params.mapTint, heightContrast: e.params.heightContrast, heightPivot: e.params.heightPivot, slopeTint: e.params.slopeTint }, dem: { min: e.dem?.minM, max: e.dem?.maxM, w: e.dem?.width, ext: e.dem?.extentMeters } }
})
fs.writeFileSync(`${OUT}/inventaire.json`, JSON.stringify(inventaire, null, 1))
console.log('DEM', JSON.stringify(inventaire.dem), 'GRADE', JSON.stringify(inventaire.grade), 'PARAMS', JSON.stringify(inventaire.params))

const set = (js) => page.evaluate(js)
const cases = [
  ['A-tel-quel', '(()=>{})()'],
  ['B-uTint-0', 'window.__exp.terrain.mapUniforms.uTint.value=0'],
  ['C-uTint-1', 'window.__exp.terrain.mapUniforms.uTint.value=1'],
  ['D-uSlopeTint-0', 'window.__exp.terrain.mapUniforms.uTint.value=0.68;window.__exp.terrain.mapUniforms.uSlopeTint.value=0'],
  ['E-contraste-1', 'window.__exp.terrain.mapUniforms.uSlopeTint.value=0.55;window.__exp.terrain.mapUniforms.uHeightContrast.value=1'],
  ['F-retour', 'const u=window.__exp.terrain.mapUniforms;u.uHeightContrast.value=window.__exp.params.heightContrast'],
]
for (const [nom, js] of cases) {
  await set(js)
  await dodo(1200)
  await page.screenshot({ path: `${OUT}/${nom}.png` })
}
await nav.close()
