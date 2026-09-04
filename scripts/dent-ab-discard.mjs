// DENT — QUEL `discard` MANGE LA NAPPE ? A/B par RETRAIT DE LIGNE, dans la
// MÊME image et la même page. On clone le matériau de la mer, on retire UNE
// ligne de son fragment, on recompile, on remesure la silhouette au GPU.
//
// ⛔ Pas de lien profond, pas de `gotoCtl.go` : `modes.flyTo(lat, lon, zoom)`
// rend le `uCropDemi` de la vidéo (7,32e-4 = z11) au bit près.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'
import path from 'node:path'
const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9433')
const LAT = Number(opt('--lat', '-19.7253'))
const LON = Number(opt('--lon', '63.3691'))
const ZOOM = Number(opt('--zoom', '11'))
const ALT = Number(opt('--alt', '32849'))
const ELEV = Number(opt('--elevation', '34'))
const AZIM = Number(opt('--azimut', '45'))
const OUT = opt('--out', '.banc/DENT')
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

const res = await page.evaluate(() => {
  const e = window.__exp, g = e.globe, mer = g._mer
  if (!mer) return { refus: 'pas de nappe' }
  const gl = e.renderer.getContext()
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const rendre = () => { if (e.composer) e.composer.render(); else e.renderer.render(e.scene, e.camera) }
  const lire = () => { const b = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b }
  const silhouette = () => {
    mer.visible = true; rendre(); const A = lire()
    mer.visible = false; rendre(); const B = lire()
    mer.visible = true; rendre()
    const m = new Uint8Array(w * h); let n = 0
    for (let i = 0; i < w * h; i++) {
      const d = Math.abs(A[i * 4] - B[i * 4]) + Math.abs(A[i * 4 + 1] - B[i * 4 + 1]) + Math.abs(A[i * 4 + 2] - B[i * 4 + 2])
      if (d > 12) { m[i] = 1; n++ }
    }
    return { n, m }
  }
  const src0 = mer.material.fragmentShader
  const poser = (s) => { mer.material.fragmentShader = s; mer.material.needsUpdate = true; rendre(); rendre() }
  const variantes = {
    reference: src0,
    sansDiscardTerre: src0.replace('if (profondeur <= 0.0) discard;', '// A/B DENT : discard terre retire'),
    sansDiscardBord: src0.replace('if (bord <= 0.0) discard;', '// A/B DENT : discard bord retire'),
  }
  const out = {}
  const masques = {}
  for (const [k, s] of Object.entries(variantes)) {
    if (k !== 'reference' && s === src0) { out[k] = { refus: 'ligne introuvable' }; continue }
    poser(s)
    const r = silhouette()
    out[k] = { pixels: r.n }
    masques[k] = r.m
    window.__DENT_VARIANTE = k
  }
  poser(src0)
  // ce que CHAQUE discard retire, en pixels, par rapport a la reference
  const ref = masques.reference
  for (const k of ['sansDiscardTerre', 'sansDiscardBord']) {
    const m = masques[k]; if (!m) continue
    let gagnes = 0
    for (let i = 0; i < ref.length; i++) if (m[i] && !ref[i]) gagnes++
    out[k].pixelsRendus = gagnes
  }
  // le CHAMP lui-meme : combien de texels declarent « terre » (r >= 0) dans
  // l emprise |u| <= 1 ?  ⚠️ on relit la TEXTURE SOURCE, pas l ecran.
  const U = mer.material.uniforms
  const tex = U.uMerChamp.value
  let champ = null
  const img = tex && tex.image
  if (img && img.data) {
    const N = Math.round(Math.sqrt(img.data.length / 4))
    const p = U.uMerPortee.value
    let dans = 0, terre = 0, zeroExact = 0
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const u = ((i + 0.5) / img.width - 0.5) * 2 * p
        const v = ((j + 0.5) / img.height - 0.5) * 2 * p
        if (Math.abs(u) > 1 || Math.abs(v) > 1) continue
        dans++
        const r = img.data[(j * img.width + i) * 4]
        if (r >= 0) terre++
        if (r === 0) zeroExact++
      }
    }
    champ = { largeur: img.width, hauteur: img.height, N, texelsDansEmprise: dans, texelsTerre: terre, texelsZeroExact: zeroExact, partTerre: dans ? terre / dans : null }
  }
  return { largeur: w, hauteur: h, variantes: out, champ, altitude: e.altitudeCadrageM(), uCropDemi: g.uniforms.uCropDemi.value }
})
console.log(JSON.stringify(res, null, 2))
fs.writeFileSync(path.join(OUT, 'ab-discard.json'), JSON.stringify(res, null, 2))
await nav.close()
