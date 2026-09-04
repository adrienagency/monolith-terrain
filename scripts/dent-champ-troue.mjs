// DENT — LA DÉMONSTRATION DE MÉCANISME : un TROU dans le champ (bathymétrie
// absente = 0 = « terre » pour le fragment) rend-il l'image d'Adrien ?
//
// On n'invente rien dans le rendu : on écrit des ZÉROS dans la texture du champ,
// exactement ce que `_cuireChampMer` y met quand `remplirHauteurs` n'a pas
// rempli un nœud (`brut` est un Float32Array neuf, donc zéro), et on regarde.
//   · plein      : le champ vivant, tel quel
//   · troueBlocs : zéros par blocs de `--bloc` texels au-delà d'un rayon
//   · troueGros  : le champ ré-échantillonné au pas `--bloc` (bathymétrie
//                  grossière), pour voir la QUANTIFICATION du bord
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
const BLOC = Number(opt('--bloc', '24'))
const RAYON = Number(opt('--rayon', '0.55'))
const OUT = opt('--out', '.banc/DENT/troue')
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
await poser()
await dodo(3000)

for (const mode of ['plein', 'toutZero', 'troueBlocs', 'troueGros']) {
  const r = await page.evaluate(([m, bloc, rayon]) => {
    const g = window.__exp.globe, mer = g._mer
    if (!mer) return 'pas de nappe'
    const tex = mer.material.uniforms.uMerChamp.value
    const img = tex.image
    if (!window.__DENT_CHAMP0) window.__DENT_CHAMP0 = img.data.slice()
    const src = window.__DENT_CHAMP0
    const d = img.data
    const w = img.width, h = img.height
    d.set(src)
    if (m === 'toutZero') {
      // TEMOIN DE VALIDITE DE LA SONDE : champ entierement a zero. Si la nappe
      // ne disparait pas, c'est mon ECRITURE qui n'atteint pas le GPU, pas le
      // mecanisme qui est faux.
      for (let k = 0; k < w * h; k++) d[k * 2] = 0
    } else if (m !== 'plein') {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const k = (j * w + i) * 2
          const u = (i + 0.5) / w - 0.5, v = (j + 0.5) / h - 0.5
          if (m === 'troueBlocs') {
            // ⚠️ blocs ENTIERS mis a zero : c est ce que laisse un noeud non
            // rempli — `brut` est un Float32Array neuf, donc ZERO, et zero se
            // lit « terre » au fragment (`if (profondeur <= 0.0) discard`).
            const bi = Math.floor(i / bloc), bj = Math.floor(j / bloc)
            if (Math.max(Math.abs(u), Math.abs(v)) > rayon * 0.5 && ((bi + bj) % 2 === 0)) d[k] = 0
          } else {
            // le champ RE-ECHANTILLONNE au pas `bloc` : une bathymetrie
            // grossiere, pour voir la QUANTIFICATION du bord de la nappe
            const si = Math.min(w - 1, Math.floor(i / bloc) * bloc)
            const sj = Math.min(h - 1, Math.floor(j / bloc) * bloc)
            d[k] = src[(sj * w + si) * 2]
          }
        }
      }
    }
    tex.needsUpdate = true
    return 'ok'
  }, [mode, BLOC, RAYON])
  await dodo(1500)
  await page.screenshot({ path: path.join(OUT, `${mode}.png`) })
  console.log(mode, r)
}
await nav.close()
