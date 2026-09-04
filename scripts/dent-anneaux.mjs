// DENT — LE BORD DE LA NAPPE CONTRE L'ARÊTE DU SOCLE, ANNEAU CONTRE ANNEAU.
//
// La boîte englobante ne dit pas de quel côté ni de combien. Ici on compare les
// DEUX contours, sommet par sommet, dans le repère MONDE puis à l'ÉCRAN :
//   · l'anneau de la calotte : |u| = emprise ou |v| = emprise dans `aCrop`
//   · l'anneau HAUT des parois : les sommets les plus hauts de `_parois`
// ⚠️ La nappe est rendue par `camGlobe` (passe de fond), PAS par `e.camera` :
// projeter avec la caméra du bloc a déjà coûté un rapport entier (MER2 §7.4).
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
const OUT = opt('--out', '.banc/DENT'), ETIQ = opt('--etiquette', 'anneaux')
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
await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [LAT, LON, ZOOM])
await dodo(9000)
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
await dodo(4000)

const r = await page.evaluate(() => {
  const e = window.__exp, g = e.globe, mer = g._mer, par = g._parois
  if (!mer || !par) return { refus: 'mer ou parois absentes' }
  const et = g._merEtat || {}
  const nCal = et.compte?.sommets || 0
  const n = et.compte?.pas, E = et.compte?.emprise
  const aC = mer.geometry.getAttribute('aCrop'), pM = mer.geometry.getAttribute('position')
  const mm = mer.matrixWorld.elements, mp = par.matrixWorld.elements
  const app = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
  // ── l'anneau de la calotte
  const idx = (i, j) => j * (n + 1) + i
  const bordCal = []
  for (let i = 0; i <= n; i++) { bordCal.push(idx(i, 0), idx(i, n)) }
  for (let j = 1; j < n; j++) { bordCal.push(idx(0, j), idx(n, j)) }
  const cal = bordCal.map((k) => app(mm, pM.getX(k), pM.getY(k), pM.getZ(k)))
  // ── l'anneau HAUT des parois : le quantile superieur en Y local
  const pP = par.geometry.getAttribute('position')
  let yMax = -Infinity
  for (let k = 0; k < pP.count; k++) if (pP.getY(k) > yMax) yMax = pP.getY(k)
  let yMin = Infinity
  for (let k = 0; k < pP.count; k++) if (pP.getY(k) < yMin) yMin = pP.getY(k)
  // ⚠️ 1 % de la hauteur du solide, pas 1e-4 : l'anneau haut suit le RELIEF
  // (Tache P11, 18,94 m d'ecart moyen le long de l'anneau), un seuil serre n'en
  // ramassait que 9 points sur 1 020.
  // ⚠️ **PAS UN SEUIL EN Y : LE SOMMET LE PLUS HAUT DE CHAQUE COLONNE.**
  // L'anneau haut suit le RELIEF (Tache P11, 18,94 m d'ecart le long de
  // l'anneau) : un seuil global n'en ramasse que les points les plus eleves,
  // c'est-a-dire un anneau BIAISE (60 points sur 1 020, rayon presque constant
  // — j'ai failli en conclure que le socle etait rond).
  const seuil = yMax - 0.5 * (yMax - yMin)
  const haut = []
  for (let k = 0; k < pP.count; k++) if (pP.getY(k) >= seuil) haut.push(app(mp, pP.getX(k), pP.getY(k), pP.getZ(k)))
  // ⚠️ **TROIS ESPACES DE COORDONNEES, ET LE MONDE N'EST PAS L'UN D'EUX.**
  // Le bloc est a (84 ; −33 ; 42) sur une sphere de rayon 100 : « la distance
  // horizontale » n'est PAS hypot(x, z), c'est la composante perpendiculaire a
  // la VERTICALE LOCALE, qui vaut ici normalize(centre − centre du globe).
  // Sans ca, l'anneau de la calotte rend un rayon min de 0,0014 pour un rayon
  // max de 0,889 — un anneau qui passerait par son propre centre.
  const gm = g.group.matrixWorld.elements
  const gc = [gm[12], gm[13], gm[14]]
  let cx = 0, cy = 0, cz = 0
  for (const p of cal) { cx += p[0]; cy += p[1]; cz += p[2] }
  cx /= cal.length; cy /= cal.length; cz /= cal.length
  const vx = cx - gc[0], vy = cy - gc[1], vz = cz - gc[2]
  const vl = Math.hypot(vx, vy, vz) || 1
  const up = [vx / vl, vy / vl, vz / vl]
  const decompose = (p) => {
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz
    const h = dx * up[0] + dy * up[1] + dz * up[2]
    const rx = dx - h * up[0], ry = dy - h * up[1], rz = dz - h * up[2]
    return { r: Math.hypot(rx, ry, rz), h }
  }
  const stat = (pts) => {
    let mn = Infinity, mx = -Infinity, s = 0
    for (const p of pts) { const d = decompose(p).r; if (d < mn) mn = d; if (d > mx) mx = d; s += d }
    return { rayonMin: mn, rayonMax: mx, rayonMoyen: s / pts.length, points: pts.length }
  }
  const yDe = (pts) => { let mn = Infinity, mx = -Infinity, s = 0; for (const p of pts) { const h = decompose(p).h; if (h < mn) mn = h; if (h > mx) mx = h; s += h } return { min: mn, max: mx, moyen: s / pts.length } }
  // ── LE PROFIL RADIAL PAR SECTEUR : « de combien, et de quel cote »
  const est = [1, 0, 0]
  // une base orthonormee du plan horizontal local
  let e1 = [1 - up[0] * up[0], -up[0] * up[1], -up[0] * up[2]]
  let e1l = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map((x) => x / e1l)
  const e2 = [up[1] * e1[2] - up[2] * e1[1], up[2] * e1[0] - up[0] * e1[2], up[0] * e1[1] - up[1] * e1[0]]
  const SEC = 72
  const secteur = (p) => {
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz
    const h = dx * up[0] + dy * up[1] + dz * up[2]
    const rx = dx - h * up[0], ry = dy - h * up[1], rz = dz - h * up[2]
    const a = Math.atan2(rx * e2[0] + ry * e2[1] + rz * e2[2], rx * e1[0] + ry * e1[1] + rz * e1[2])
    return { s: Math.min(SEC - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * SEC)), r: Math.hypot(rx, ry, rz) }
  }
  const profil = (pts) => { const o = new Array(SEC).fill(0); for (const p of pts) { const { s, r } = secteur(p); if (r > o[s]) o[s] = r } return o }
  const pc = profil(cal), pa = profil(haut)
  const ecarts = []
  for (let k = 0; k < SEC; k++) if (pc[k] > 0 && pa[k] > 0) ecarts.push((pa[k] - pc[k]) / pa[k])
  ecarts.sort((a, b) => a - b)
  const manque = { min: ecarts[0], median: ecarts[Math.floor(ecarts.length / 2)], max: ecarts[ecarts.length - 1], secteurs: ecarts.length }
  return {
    profilCalotte: pc, profilArete: pa, manqueRelatif: manque,
    calotte: { ...stat(cal), y: yDe(cal) },
    areteHaute: { ...stat(haut), y: yDe(haut) },
    nCal, pas: n, emprise: E,
    ecartRayonMoyen: stat(cal).rayonMoyen - stat(haut).rayonMoyen,
    ecartYMoyen: yDe(cal).moyen - yDe(haut).moyen,
    parDemiEstime: stat(haut).rayonMoyen,
    altitude: e.altitudeCadrageM(), uCropDemi: g.uniforms.uCropDemi.value,
  }
})
console.log(JSON.stringify(r, null, 2))
fs.writeFileSync(path.join(OUT, `${ETIQ}.json`), JSON.stringify(r, null, 2))
await nav.close()
