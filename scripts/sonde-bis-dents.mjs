// SONDE BIS-DENTS — les DENTS ROUGES au bord du socle, biseau éteint (Rodrigues).
// Variantes A/B dans la MÊME page, rendu dans la même tâche que composer.render :
// pour chacune, le nombre de pixels ROUGES que les parois ajoutent (parois
// visibles − parois cachées), et une capture. On retire un levier à la fois.
// EMPLOI : node scripts/sonde-bis-dents.mjs --port 10617 [--adresse "?biseau=1"] --etiquette APRES
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '10617'))
const ETIQ = opt('--etiquette', 'DENTS')
const ADRESSE = opt('--adresse', '')
const LIEU = opt('--lieu', '-19.7253, 63.3691')
const ZOOM = Number(opt('--zoom', '11'))
const ALT = Number(opt('--alt', '32849'))
const W = 1280, H = 800
const ICI = path.join(RACINE, '.banc', 'BIS', 'dents')
fs.mkdirSync(ICI, { recursive: true })
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'], defaultViewport: { width: W, height: H } })
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
await page.goto(`http://127.0.0.1:${PORT}/${ADRESSE}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(200) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
const [lat, lon] = LIEU.split(',').map(Number)
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [lat, lon, ZOOM])
await dodo(6000)
await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 120000, polling: 300 }).catch(() => {})
await dodo(3000)
const pose = async () => {
  await page.evaluate(([el, az, a]) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const d0 = cam.position.distanceTo(ct.target)
    const p = (el * Math.PI) / 180, q = (az * Math.PI) / 180
    const dir = [Math.cos(p) * Math.sin(q), Math.sin(p), Math.cos(p) * Math.cos(q)]
    let d = d0
    for (let i = 0; i < 60; i++) {
      cam.position.set(ct.target.x + d * dir[0], ct.target.y + d * dir[1], ct.target.z + d * dir[2]); cam.lookAt(ct.target); ct.update?.()
      const v = e.altitudeCadrageM(); if (!Number.isFinite(v) || v <= 0) break
      if (Math.abs(v - a) / a < 0.004) break
      d = d * (a / v)
    }
  }, [35, 45, ALT])
  await wait(10); await dodo(2500)
}
await pose(); await dodo(8000); await pose(); await wait(30)
const r = await page.evaluate(`(() => {
  const e = window.__exp, g = e.globe, mer = g._mer, par = g._parois
  if (!mer || !par) return { refus: 'pas de mer ou de parois' }
  const gl = e.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const cap = () => { for (const p of e.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0; e.composer.render(0); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a }
  const rouges = (A) => { let n = 0; for (let i = 0; i < A.length; i += 4) if (A[i] > 120 && A[i + 1] < 110 && A[i + 2] < 110 && A[i] - A[i + 1] > 40) n++; return n }
  const rougesAjoutes = () => { par.visible = true; const a = cap(); const png = e.renderer.domElement.toDataURL('image/png'); par.visible = false; const b = cap(); par.visible = true
    let n = 0; for (let i = 0; i < a.length; i += 4) { const ra = a[i] > 120 && a[i + 1] < 110 && a[i + 2] < 110 && a[i] - a[i + 1] > 40; const rb = b[i] > 120 && b[i + 1] < 110 && b[i + 2] < 110 && b[i] - b[i + 1] > 40; if (ra && !rb) n++ } return { total: rouges(a), ajoutes: n, png } }
  const out = {}
  const geo = mer.geometry, idx = geo.index, nCal = g._merEtat?.compte?.sommets || 0
  let idxCal = idx.count; for (let i = 0; i < idx.array.length; i++) if (idx.array[i] >= nCal) { idxCal = i - (i % 3); break }
  const plein = idx.count
  out.reference = rougesAjoutes()
  const side0 = par.material.side
  par.material.side = 0; par.material.needsUpdate = true; out.frontSide = rougesAjoutes(); par.material.side = side0; par.material.needsUpdate = true
  geo.setDrawRange(0, idxCal); out.sansRideau = rougesAjoutes(); geo.setDrawRange(0, plein)
  mer.visible = false; const a = cap(); const t = rouges(a); mer.visible = true; out.sansMer = { total: t, png: e.renderer.domElement.toDataURL('image/png') }
  // les parois SEULES : tuiles cachées
  const tuiles = []; for (const tl of g.tiles.values()) if (tl.mesh && tl.mesh.visible) { tuiles.push(tl.mesh); tl.mesh.visible = false }
  out.sansTuiles = rougesAjoutes(); for (const m of tuiles) m.visible = true
  out.info = { retraitJupe: g._retraitJupeCrop, retraitBase: g._retraitBaseCrop, uMerBord: [mer.material.uniforms.uMerBord.value.x, mer.material.uniforms.uMerBord.value.y], provisoire: par.userData?.provisoire, side: side0, alt: e.altitudeCadrageM() }
  return out
})()`)
if (r.refus) { console.log('REFUS', r.refus); await nav.close(); process.exit(2) }
for (const k of Object.keys(r)) {
  if (k === 'info') continue
  const { png, ...reste } = r[k]
  console.log(ETIQ, k, JSON.stringify(reste))
  if (png) fs.writeFileSync(path.join(ICI, `${ETIQ}-${k}.png`), Buffer.from(png.split(',')[1], 'base64'))
}
console.log(ETIQ, 'info', JSON.stringify(r.info))
await nav.close()
