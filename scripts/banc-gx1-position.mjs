// BANC GX1 — LA POSITION DU TRACÉ ET SA LECTURE, CHIFFRÉES.
//
// ⛔ NE CORRIGE RIEN. Mesure, chiffre, capture.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA MÉTHODE, ET LES TROIS FAUX CONSTATS QU'ELLE A COÛTÉS
// ═══════════════════════════════════════════════════════════════════════════
// ① ⛔ **UN COMPTAGE PAR COULEUR MENT ICI.** Le premier tour comptait les
//    pixels « vermillon » (r>120, r−b>55) : il a rendu **44 102 pixels de
//    tracé sur une image qui n'en montre AUCUN** — les rampes hypsométriques
//    de ShibuMap sont roses et saumon. On mesure donc le tracé par
//    DIFFÉRENCE : image avec le tracé, image sans (`group.visible`), pixels
//    qui changent.
// ② ⛔ **ON NE RAPPELLE JAMAIS `composer.render()` SOI-MÊME.** Un rendu forcé
//    hors de la boucle rend une image globalement différente — **586 000
//    pixels sur 1 474 560, grain de film coupé** : `tick()` fait plus qu'un
//    `render()`. Les images viennent donc de la boucle de l'application,
//    capturée par une FILE (pas un no-op : plusieurs modules appellent rAF).
// ③ ⛔ **LE GRAIN DE FILM EST TIRÉ AU HASARD À CHAQUE IMAGE** : deux images
//    identiques diffèrent de ~340 000 pixels tant qu'il tourne. `grain = 0` et
//    `animations = false`. Une fois coupés, deux images consécutives au repos
//    diffèrent de **0 pixel** (mesuré, k↔k+1, k↔k+2, k↔k+4 sur 10 images) :
//    le plancher de bruit est nul, et le témoin A/A le revérifie ici.
//
// CHEMIN FIXE : boot par défaut → `loadGpxText` → repos → mesure → clic sur
// `.cb-play`. Ni lien profond `#s=`, ni `gotoCtl.go`.
//
// EMPLOI  node scripts/banc-gx1-position.mjs --gpx .banc/x.gpx --etiquette x
//         [--adresse "terre=deux"]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const ADRESSE = opt('--adresse', '')
const PORT = opt('--port', '9233')
const GPX = path.resolve(RACINE, opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
const ETIQ = opt('--etiquette', 'mb')
const SORTIE = path.resolve(RACINE, '.banc/GX1')
fs.mkdirSync(SORTIE, { recursive: true })
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE || PP).href)).default

const nav = await puppeteer.launch({
  executablePath: opt('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--window-size=1440,1024', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024 })
const erreurs = []
page.on('pageerror', (e) => { erreurs.push(String(e.message)); console.error('  [page] ' + e.message) })
await page.goto(`http://127.0.0.1:${PORT}/${ADRESSE ? '?' + ADRESSE : ''}`, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 8000)); await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 6000))

await page.evaluate(async () => {
  const e = window.__exp
  e.params.grain = 0
  e.params.animations = false
  // ⚠️ le module de géodésie du produit LUI-MÊME (Vite sert les sources en
  // développement) : la conversion mesurée est celle qui dessine, pas une copie.
  window.__geo = await import('/src/geo.js')
  const vrai = window.requestAnimationFrame.bind(window)
  let file = []
  window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
  window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  window.__c = () => e.gpxLayer.layers?.[0]?.gpx || null
  window.__lire = async (u) => { const im = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return { d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } }
  // masque des pixels du tracé + statistiques
  window.__masque = async (aUrl, bUrl) => {
    const a = await window.__lire(aUrl), b = await window.__lire(bUrl)
    const m = new Uint8Array(a.w * a.h)
    let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    for (let i = 0; i < a.d.length; i += 4) {
      const k = Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2]))
      if (k > 12) { const p = i / 4, x = p % a.w, y = (p / a.w) | 0; m[p] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    window.__dernierMasque = { m, w: a.w, h: a.h }
    return { pixels: n, boite: n ? { x0, x1, y0, y1 } : null, w: a.w, h: a.h }
  }
  // distance, en pixels, de chaque point projeté au pixel de tracé le plus proche
  window.__ecartPx = (points, rayon = 40) => {
    const M = window.__dernierMasque
    if (!M) return null
    return points.map((p) => {
      const cx = Math.round(p.px), cy = Math.round(p.py)
      let best = Infinity
      for (let r = 0; r <= rayon && best === Infinity; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = cx + dx, y = cy + dy
          if (x < 0 || y < 0 || x >= M.w || y >= M.h) continue
          if (M.m[y * M.w + x]) { const d = Math.hypot(dx, dy); if (d < best) best = d }
        }
      }
      return Number.isFinite(best) ? best : null
    })
  }
  // ── l'état, avec l'échelle prise sur la PAIRE LA PLUS ÉLOIGNÉE ────────────
  // ⚠️ premier/dernier point d'une BOUCLE sont au même endroit : l'échelle
  // calculée dessus rendait 728 m/unité au lieu de ~1 800. Piège payé ici.
  window.__etat = (n = 48) => {
    const T = e.THREE, gl = e.gpxLayer, c = window.__c(), t = c?.track, cam = e.camera
    const W = innerWidth, H = innerHeight
    const out = {
      mode: e.modes.mode, lecture: gl.isPlaying(), headT: gl.headT, revealT: c?._revealT,
      groupeVisible: c?.group.visible, groupePos: c?.group.position.toArray(),
      camPos: cam.position.toArray(), camNear: cam.near, camFar: cam.far, camFov: cam.fov,
      alt: e.altitudeCadrageM?.(), drone: !!e.drone?.active, gpxFollow: !!e.params.gpxFollow, W, H,
      ruban: c?.ruban ? { visible: c.ruban.visible, sommets: c.ruban.geometry.getAttribute('position').count, clip: c.rubanMat?.clippingPlanes?.length || 0, demiLargeur: (c.params.gpxWidth ?? 3) * 0.022 } : null,
    }
    if (!t?.world?.length) return out
    const w = t.world, pts = t.points
    const R = 6371008.8
    const hav = (a, b) => { const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180, dp = p2 - p1, dl = (b.lon - a.lon) * Math.PI / 180; return 2 * R * Math.asin(Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2)) }
    // paire la plus éloignée DANS LE MONDE (échantillonnée)
    let bi = 0, bj = 1, bd = -1
    const pas = Math.max(1, Math.floor(w.length / 60))
    for (let i = 0; i < w.length; i += pas) for (let j = i + pas; j < w.length; j += pas) {
      const d = Math.hypot(w[j].x - w[i].x, w[j].z - w[i].z)
      if (d > bd) { bd = d; bi = i; bj = j }
    }
    const mpu = bd > 0 ? hav(pts[bi], pts[bj]) / bd : null
    out.echelle = { unites: bd, metres: hav(pts[bi], pts[bj]), metresParUnite: mpu, i: bi, j: bj }
    // ── ÉCHELLE / DÉFORMATION : 40 paires au hasard, monde × mpu contre géodésie
    const err = []
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(Math.random() * w.length), j = Math.floor(Math.random() * w.length)
      const dm = Math.hypot(w[j].x - w[i].x, w[j].z - w[i].z) * mpu
      const dt = hav(pts[i], pts[j])
      if (dt > 200) err.push((dm - dt) / dt)
    }
    out.deformation = { n: err.length, moy: err.reduce((a, b) => a + b, 0) / (err.length || 1), max: err.length ? Math.max(...err.map(Math.abs)) : null }
    // ── POSITION HORIZONTALE : aller-retour par la conversion du produit ─────
    const dem = e.terrain?.dem
    const arErr = []
    if (dem && window.__geo?.worldToLatLon && window.__geo?.latLonToWorld) {
      for (let k = 0; k < 60; k++) {
        const i = Math.floor((k / 59) * (pts.length - 1))
        const wp = window.__geo.latLonToWorld(dem, pts[i].lat, pts[i].lon)
        const ll = window.__geo.worldToLatLon(dem, wp.x, wp.z)
        arErr.push(hav(pts[i], ll))
      }
    }
    out.allerRetourM = arErr.length ? { moy: arErr.reduce((a, b) => a + b, 0) / arErr.length, max: Math.max(...arErr) } : null
    // ── DRAPAGE : écart au sol, en mètres, et projection à l'écran ───────────
    const fen = e.terrain?.fenetre || { x: 0, z: 0 }
    const bloc = e.terrain?.blockFootprint?.()
    const ech = []
    let longueurEcranPx = 0
    let precedent = null
    for (let k = 0; k < n; k++) {
      const i = Math.round((k / (n - 1)) * (w.length - 1))
      const p = w[i]
      const v = new T.Vector3(p.x + c.group.position.x, p.y, p.z + c.group.position.z)
      const q = v.clone().project(cam)
      const px = (q.x * 0.5 + 0.5) * W, py = (-q.y * 0.5 + 0.5) * H
      let sol = null
      try { sol = e.terrain.sample(p.x - fen.x, p.z - fen.z) } catch { }
      const dansEcran = px >= 0 && px < W && py >= 0 && py < H && q.z > -1 && q.z < 1
      const e0 = { i, lat: pts[i].lat, lon: pts[i].lon, px, py, dansEcran, zNdc: q.z, distCam: cam.position.distanceTo(v), wy: p.y, sol, ecartSolM: sol == null || mpu == null ? null : (p.y - sol) * mpu, dansBloc: bloc ? (Math.abs(p.x) <= bloc.half && Math.abs(p.z) <= bloc.half) : null }
      if (precedent && precedent.dansEcran && dansEcran) longueurEcranPx += Math.hypot(px - precedent.px, py - precedent.py)
      precedent = e0
      ech.push(e0)
    }
    out.ech = ech
    out.echDansEcran = ech.filter((x) => x.dansEcran).length
    out.longueurEcranPx = longueurEcranPx
    // largeur du ruban À L'ÉCRAN, au point médian : mètres → pixels
    const mid = ech[Math.floor(ech.length / 2)]
    const demiLargeurU = (c.params.gpxWidth ?? 3) * 0.022
    const hauteurEcranU = 2 * Math.tan((cam.fov * Math.PI / 180) / 2) * (mid?.distCam || 1)
    out.largeurRubanPx = hauteurEcranU > 0 ? (2 * demiLargeurU) * (H / hauteurEcranU) : null
    out.pixelsAttendus = out.longueurEcranPx * (out.largeurRubanPx || 0)
    out.cumKm = t.cumKm[t.cumKm.length - 1]
    out.nbPoints = pts.length
    return out
  }
})
const tourner = (n) => page.evaluate((k) => window.__h.tourner(k), n)
const snap = async () => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })

const gpxTexte = fs.readFileSync(GPX, 'utf8')
await page.evaluate((t) => window.__exp.loadGpxText(t), gpxTexte)
for (let i = 0; i < 12; i++) { await tourner(120); await new Promise((r) => setTimeout(r, 1500)) }

// ── AU REPOS : le tracé pose-t-il des pixels, et lesquels ───────────────────
async function mesureAuRepos(nom, repeats = 6) {
  const vals = [], temoins = []
  let etat = null, boite = null
  for (let k = 0; k < repeats; k++) {
    await tourner(1)
    const a = await snap()
    await tourner(1)
    const a2 = await snap() // témoin A/A
    if (!etat) etat = await page.evaluate(() => window.__etat(48))
    await page.evaluate(() => { window.__c().group.visible = false })
    await tourner(1)
    const b = await snap()
    await page.evaluate(() => { window.__c().group.visible = true })
    await tourner(1)
    const m = await page.evaluate((x, y) => window.__masque(x, y), a2, b)
    vals.push(m.pixels); boite = m.boite
    temoins.push((await page.evaluate((x, y) => window.__masque(x, y), a, a2)).pixels)
  }
  // le dernier masque en mémoire est celui du témoin : on le refait proprement
  await tourner(1)
  const a = await snap()
  await page.evaluate(() => { window.__c().group.visible = false })
  await tourner(1)
  const b = await snap()
  await page.evaluate(() => { window.__c().group.visible = true })
  await tourner(1)
  await page.evaluate((x, y) => window.__masque(x, y), a, b)
  const ecarts = await page.evaluate((pts) => window.__ecartPx(pts), (etat.ech || []).filter((x) => x.dansEcran).map((x) => ({ px: x.px, py: x.py })))
  fs.writeFileSync(path.join(SORTIE, `${ETIQ}-${nom}.png`), Buffer.from(a.split(',')[1], 'base64'))
  return { pixels: vals, temoins, boite, etat, ecartsPx: ecarts }
}

const R = { etiquette: ETIQ, gpx: path.basename(GPX), adresse: ADRESSE, erreurs }
R.repos = await mesureAuRepos('repos')
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const e0 = R.repos.etat
console.log(`\n══ AU REPOS (${ETIQ}${ADRESSE ? ' · ' + ADRESSE : ''}) ══`)
console.log(`  pixels de tracé   : ${R.repos.pixels.join(' ')}   médiane ${med(R.repos.pixels)}`)
console.log(`  témoin A/A (bruit): ${R.repos.temoins.join(' ')}`)
console.log(`  attendus (géom.)  : ${Math.round(e0.pixelsAttendus)}   (longueur ${Math.round(e0.longueurEcranPx)} px × largeur ${e0.largeurRubanPx?.toFixed(2)} px)`)
console.log(`  échelle           : ${e0.echelle?.metresParUnite?.toFixed(1)} m/unité   déformation moy ${(100 * e0.deformation.moy).toFixed(2)} % max ${(100 * e0.deformation.max).toFixed(2)} %`)
console.log(`  aller-retour lat/lon : moy ${e0.allerRetourM?.moy.toFixed(2)} m  max ${e0.allerRetourM?.max.toFixed(2)} m`)
const dr = (e0.ech || []).filter((x) => x.ecartSolM != null).map((x) => x.ecartSolM)
console.log(`  drapage (m)       : moy ${(dr.reduce((a, b) => a + b, 0) / dr.length).toFixed(1)}  min ${Math.min(...dr).toFixed(1)}  max ${Math.max(...dr).toFixed(1)}`)
const ep = (R.repos.ecartsPx || []).filter((x) => x != null)
console.log(`  écart point→pixel : ${ep.length}/${(R.repos.ecartsPx || []).length} points retrouvés, médiane ${ep.length ? med(ep).toFixed(1) : '—'} px`)

// ── LECTURE, CAMÉRA FIGÉE : le ruban reste-t-il dessiné pendant l'animation ─
// (le suivi caméra est coupé APRÈS le clic Lecture : on isole le dévoilement)
const bouton = await page.evaluate(() => {
  const b = document.querySelector('.cb-play'); if (!b) return false
  const r = b.getBoundingClientRect()
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  return true
})
R.clic = { bouton, apres: await page.evaluate(() => ({ lecture: window.__exp.gpxLayer.isPlaying(), gpxFollow: window.__exp.params.gpxFollow })) }
console.log(`\n══ LECTURE ══  bouton=${bouton}  ${JSON.stringify(R.clic.apres)}`)

// ① lecture AVEC le suivi caméra (ce que voit Adrien) : 24 relevés
R.lectureSuivi = []
for (let k = 0; k < 24; k++) {
  await tourner(12)
  const a = await snap()
  await tourner(1)
  const a2 = await snap()
  const etat = await page.evaluate(() => window.__etat(24))
  await page.evaluate(() => { window.__c().group.visible = false })
  await tourner(1)
  const b = await snap()
  await page.evaluate(() => { window.__c().group.visible = true })
  const sig = await page.evaluate((x, y) => window.__masque(x, y), a2, b)
  const bruit = await page.evaluate((x, y) => window.__masque(x, y), a, a2)
  R.lectureSuivi.push({ k, headT: etat.headT, pixels: sig.pixels, bruit: bruit.pixels, attendus: etat.pixelsAttendus, echDansEcran: etat.echDansEcran, alt: etat.alt, lecture: etat.lecture })
  if (k % 4 === 0) console.log(`  ${String(k).padStart(2)}  headT=${etat.headT.toFixed(3)}  tracé=${String(sig.pixels).padStart(6)}  bruit=${String(bruit.pixels).padStart(6)}  attendus=${Math.round(etat.pixelsAttendus)}  alt=${Math.round(etat.alt)}`)
  if (k === 6) fs.writeFileSync(path.join(SORTIE, `${ETIQ}-lecture-suivi.png`), Buffer.from(a.split(',')[1], 'base64'))
}

// ② LECTURE, CAMÉRA FIGÉE — on coupe le suivi APRÈS le clic : la caméra ne
// bouge plus, le dévoilement continue. Le plancher de bruit redevient nul, et
// « le tracé reste-t-il dessiné pendant la lecture ? » devient une mesure et
// non une impression. 20 relevés consécutifs, minimum du brief.
await page.evaluate(() => {
  const e = window.__exp
  e.params.gpxFollow = false
  if (e.drone?.active) e.drone.stop()
  if (e.pilote?.poursuite) e.pilote.cancel()
})
await tourner(30)
R.lectureFigee = []
for (let k = 0; k < 22; k++) {
  await tourner(8)
  const a = await snap()
  await tourner(1)
  const a2 = await snap()
  const etat = await page.evaluate(() => window.__etat(24))
  await page.evaluate(() => { window.__c().group.visible = false })
  await tourner(1)
  const b = await snap()
  await page.evaluate(() => { window.__c().group.visible = true })
  const sig = await page.evaluate((x, y) => window.__masque(x, y), a2, b)
  const bruit = await page.evaluate((x, y) => window.__masque(x, y), a, a2)
  R.lectureFigee.push({ k, headT: etat.headT, pixels: sig.pixels, bruit: bruit.pixels, attendus: etat.pixelsAttendus, echDansEcran: etat.echDansEcran, lecture: etat.lecture })
  console.log(`  figée ${String(k).padStart(2)}  headT=${etat.headT.toFixed(3)}  tracé=${String(sig.pixels).padStart(6)}  bruit=${String(bruit.pixels).padStart(5)}  attendus=${Math.round(etat.pixelsAttendus)}  visibles=${etat.echDansEcran}/24`)
  if (k === 10) fs.writeFileSync(path.join(SORTIE, `${ETIQ}-lecture-figee.png`), Buffer.from(a.split(',')[1], 'base64'))
}

fs.writeFileSync(path.join(SORTIE, `${ETIQ}${ADRESSE ? '-' + ADRESSE.replace(/[=&]/g, '-') : ''}.json`), JSON.stringify(R, null, 1))
console.log(`\n→ .banc/GX1/${ETIQ}.json`)
await nav.close()
