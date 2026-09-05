// BANC GX3 — LE SOCLE COMMUN DU NOTEUR. Aucune correction, que de la mesure.
//
// Méthode (héritée des pièges payés par GX1/GX2, et revérifiée ici) :
//   · pixels de tracé comptés PAR DIFFÉRENCE (calque allumé / éteint), jamais
//     par couleur ; témoin A/A (deux captures sans rien changer) à chaque relevé ;
//   · images issues de la BOUCLE de l'application (file de rAF), grain coupé,
//     animations coupées ; deux tours avant chaque capture ;
//   · zone de comptage = la toile 3D, bandeau de course et panneaux exclus —
//     mesurée au DOM à chaque relevé, pas devinée ;
//   · aucun lien profond, aucun `gotoCtl.go` : `loadGpxText`, `modes.cranZoom`,
//     `modes.flyTo`, et le VRAI bouton `.cb-play` par `page.mouse.click`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const RACINE = fileURLToPath(new URL('..', import.meta.url))
const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
export const SORTIE = path.resolve(RACINE, '.banc/GX3')
fs.mkdirSync(SORTIE, { recursive: true })

export const A = process.argv.slice(2)
export const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
export const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null }
export const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

export async function ouvrir({ port = opt('--port', '10333'), adresse = opt('--adresse', ''), largeur = 1440, hauteur = 1024 } = {}) {
  const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE || PP).href)).default
  const nav = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--headless=new', '--hide-scrollbars', `--window-size=${largeur},${hauteur}`, '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  })
  const page = await nav.newPage()
  await page.setViewport({ width: largeur, height: hauteur })
  const erreurs = []
  page.on('pageerror', (e) => { erreurs.push(String(e.message)); console.error('  [page] ' + e.message) })
  await page.goto(`http://127.0.0.1:${port}/${adresse ? '?' + adresse : ''}`, { waitUntil: 'load', timeout: 120000 })
  await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
  await dodo(8000); await page.keyboard.press('Escape'); await dodo(6000)

  await page.evaluate(async () => {
    const e = window.__exp
    e.params.grain = 0
    e.params.animations = false
    window.__geo = await import('/src/geo.js')
    const vrai = window.requestAnimationFrame.bind(window)
    let file = []
    window.__h = { tourner: (n) => new Promise((res) => { let reste = n; const pas = () => { const lot = file; file = []; if (!lot.length) return res(false); const t = performance.now(); for (const cb of lot) cb(t); if (--reste <= 0) return res(true); vrai(pas) }; vrai(pas) }) }
    window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
    window.__c = () => e.gpxLayer.layers?.[0]?.gpx || null
    window.__lire = async (u) => { const im = await createImageBitmap(await (await fetch(u)).blob()); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0); return { c, d: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } }
    // la zone utile : la toile, moins tout élément d'interface opaque qui la
    // recouvre — bandeau de course, panneau du studio, panneaux latéraux.
    window.__zone = () => {
      const z = { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight }
      for (const el of document.querySelectorAll('.cb-bar, .cb-root, .course-bar, .gpx-profile')) {
        const r = el.getBoundingClientRect(); if (r.height > 0 && r.width > innerWidth * 0.3) z.y1 = Math.min(z.y1, r.top)
      }
      for (const el of document.querySelectorAll('.studio, .panel-left, .gpx-panel, .rs-panel')) {
        const r = el.getBoundingClientRect(); if (r.width > 200 && r.height > 200 && r.left < 40) z.x0 = Math.max(z.x0, r.right)
      }
      return z
    }
    // différence de deux captures dans la zone utile ; masque retenu pour
    // les mesures de distance point → pixel ; image surlignée sur demande.
    window.__diff = async (aUrl, bUrl, surligne = false, seuil = 12) => {
      const a = await window.__lire(aUrl), b = await window.__lire(bUrl)
      const z = window.__zone()
      const s = a.w / innerWidth
      const m = new Uint8Array(a.w * a.h)
      let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      const ctx = a.c.getContext('2d')
      const img = surligne ? ctx.getImageData(0, 0, a.w, a.h) : null
      for (let i = 0; i < a.d.length; i += 4) {
        const p = i / 4, x = p % a.w, y = (p / a.w) | 0
        if (x < z.x0 * s || x >= z.x1 * s || y < z.y0 * s || y >= z.y1 * s) continue
        const k = Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2]))
        if (k > seuil) {
          m[p] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
          if (img) { img.data[i] = 0; img.data[i + 1] = 255; img.data[i + 2] = 90; img.data[i + 3] = 255 }
        }
      }
      window.__dernierMasque = { m, w: a.w, h: a.h, s }
      let url = null
      if (img) { ctx.putImageData(img, 0, 0); url = a.c.toDataURL('image/png') }
      return { pixels: n, boite: n ? { x0, x1, y0, y1 } : null, zone: z, surligne: url }
    }
    // distance (px CSS) d'un point écran au pixel de masque le plus proche
    window.__plusProche = (px, py, rayon = 60) => {
      const M = window.__dernierMasque; if (!M) return null
      const cx = Math.round(px * M.s), cy = Math.round(py * M.s)
      for (let r = 0; r <= rayon; r++) {
        let best = Infinity
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = cx + dx, y = cy + dy
          if (x < 0 || y < 0 || x >= M.w || y >= M.h) continue
          if (M.m[y * M.w + x]) { const d = Math.hypot(dx, dy); if (d < best) best = d }
        }
        if (best < Infinity) return best / M.s
      }
      return null
    }
    window.__alt = () => e.altitudeCadrageM?.() ?? null
    // la caméra QUI DESSINE LE TRACÉ : celle du globe quand le calque est posé
    // sur la sphère (poseur globe), celle du bloc sinon (`?terre=deux`, où la
    // passe de surface dessine encore le bloc avec `camera`).
    window.__cam = () => (window.__c()?._poseur?.globe && e.camGlobe) ? e.camGlobe : e.camera
  })
  const tourner = (n) => Promise.race([
    page.evaluate((k) => window.__h.tourner(k), n),
    new Promise((r) => setTimeout(() => r('délai'), 20000)),
  ])
  const snap = async () => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64' })
  const ecris = (nom, dataUrl) => fs.writeFileSync(path.join(SORTIE, `${nom}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))

  // UN RELEVÉ : témoin A/A puis différence allumé/éteint.
  async function releve(nom = null, { image = false, seuil = 12 } = {}) {
    await tourner(2); const a = await snap()
    await tourner(2); const a2 = await snap()
    await page.evaluate(() => { window.__c().group.visible = false })
    await tourner(2); const b = await snap()
    await page.evaluate(() => { window.__c().group.visible = true })
    await tourner(2)
    const bruit = (await page.evaluate((x, y, s) => window.__diff(x, y, false, s), a, a2, seuil)).pixels
    const d = await page.evaluate((x, y, s, q) => window.__diff(x, y, s, q), a2, b, image, seuil)
    if (image && nom) { ecris(nom, a2); ecris(`${nom}-surligne`, d.surligne) }
    return { nom, pixels: d.pixels, bruit, boite: d.boite, zone: d.zone, alt: await page.evaluate(() => window.__alt()) }
  }

  async function chargerGpx(fichier) {
    const texte = fs.readFileSync(path.resolve(RACINE, fichier), 'utf8')
    await page.evaluate((t) => window.__exp.loadGpxText(t), texte)
    await attendreDrapage()
  }
  // la pose se MESURE : on attend que le drapage existe (le relief est arrivé)
  async function attendreDrapage(maxTours = 40) {
    const pret = () => page.evaluate(() => {
      const c = window.__c(); const w = c?.track?.world
      if (!w?.length) return false
      let v = 0
      for (let i = 1; i < w.length; i++) if (Math.abs(w[i].y - w[0].y) > 1e-4) v++
      return v > w.length * 0.5 && !!c._poseur
    })
    for (let i = 0; i < maxTours; i++) {
      await tourner(120); await dodo(1500)
      if (i >= 8 && await pret()) { await tourner(120); await dodo(1500); return true }
    }
    return false
  }
  // LE REPOS SE MESURE : deux captures à deux tours d'écart doivent être
  // identiques (0 pixel de différence dans la zone) — sinon la caméra vole
  // encore, ou des tuiles se raffinent, et le relevé mesurerait le mouvement.
  async function attendreRepos({ maxMs = 150000, tolerance = 0 } = {}) {
    const t0 = Date.now(); let dernier = null
    while (Date.now() - t0 < maxMs) {
      await tourner(2); const a = await snap(); await tourner(2); const b = await snap()
      dernier = (await page.evaluate((x, y) => window.__diff(x, y), a, b)).pixels
      if (dernier <= tolerance) { return { repos: true, bruit: dernier, ms: Date.now() - t0 } }
      await tourner(60); await dodo(1000)
    }
    return { repos: false, bruit: dernier, ms: Date.now() - t0 }
  }
  async function fermerStudio() {
    const r = await page.evaluate(() => {
      for (const s of ['.studio-quit', '.studio .close', '.rs-close', '.studio-close']) {
        const b = document.querySelector(s); if (b) { b.click(); return s }
      }
      return null
    })
    await tourner(60)
    return r
  }
  // le VRAI clic sur le bouton Lecture, par la souris. ⚠️ `.cb-play` (barre de
  // course) est HORS ÉCRAN au repos (y = 1155 sur 1024, mesuré) : le bouton
  // qu'Adrien voit est « ▶ Lecture » du panneau Parcours (`ui/mini-route.js`).
  async function clicLecture() {
    const r = await page.evaluate(() => {
      const cands = [...document.querySelectorAll('.ce-miniroute-actions .ce-pillbtn.accent, .cb-play')]
      for (const b of cands) { const q = b.getBoundingClientRect(); if (q.width > 0 && q.x >= 0 && q.y >= 0 && q.x + q.width <= innerWidth && q.y + q.height <= innerHeight) return { x: q.x + q.width / 2, y: q.y + q.height / 2, cls: b.className, texte: b.textContent } }
      return null
    })
    if (!r) return null
    await page.mouse.click(r.x, r.y)
    await tourner(3)
    return r
  }

  return { nav, page, erreurs, tourner, snap, ecris, releve, chargerGpx, attendreDrapage, attendreRepos, fermerStudio, clicLecture }
}
