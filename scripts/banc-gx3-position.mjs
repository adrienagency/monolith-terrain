// GX3 — LA POSITION ABSOLUE DU TRACÉ : cinq points du GPX (départ, arrivée,
// trois cols) × quatre échelles (z10 → z13 par `modes.flyTo`, centré sur le
// point). Pour chaque point, où la VÉRITÉ se projette (lat/lon posés sur la
// sphère à la hauteur DESSINÉE par le globe — `latLonToSphere`, la loi du crop
// lui-même) contre où le tracé est réellement dessiné (pixel de différence le
// plus proche), en pixels et en mètres. Dans le crop ET hors du crop.
//
// Puis LE DRAPAGE, sur tous les sommets du ruban : la hauteur du ruban contre la
// surface RENDUE (lancer de rayon radial sur les maillages du globe) — pas contre
// une loi analytique, contre les triangles que le GPU dessine.
// EMPLOI : node scripts/banc-gx3-position.mjs [--gpx x] [--etiquette mb] [--zooms 10,11,12,13]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const ZOOMS = opt('--zooms', '10,11,12,13').split(',').map(Number)
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()

// ── les cinq points, choisis sur le GPX brut (pas sur la version décimée) ────
const points = await page.evaluate(() => {
  const c = window.__c(), t = c.track
  const pts = t.points, cum = t.cumKm
  const choisis = [{ nom: 'départ', i: 0 }, { nom: 'arrivée', i: pts.length - 1 }]
  // trois cols : maxima locaux d'altitude, séparés d'au moins 12 km
  const cand = []
  for (let i = 5; i < pts.length - 5; i++) {
    let max = true
    for (let j = i - 5; j <= i + 5; j++) if (j !== i && (pts[j].ele ?? 0) >= (pts[i].ele ?? 0)) { max = false; break }
    if (max) cand.push(i)
  }
  cand.sort((a, b) => (pts[b].ele ?? 0) - (pts[a].ele ?? 0))
  const cols = []
  for (const i of cand) { if (cols.every((j) => Math.abs(cum[j] - cum[i]) > 12)) cols.push(i); if (cols.length === 3) break }
  cols.sort((a, b) => a - b)
  cols.forEach((i, n) => choisis.push({ nom: `col ${n + 1}`, i }))
  return choisis.map((p) => ({ ...p, lat: pts[p.i].lat, lon: pts[p.i].lon, ele: pts[p.i].ele, km: +cum[p.i].toFixed(1) }))
})
console.log('points :', JSON.stringify(points))

await page.evaluate(() => {
  const e = window.__exp, T = e.THREE
  const { latLonToSphere, R_GLOBE, EARTH_RADIUS_M, latLonToWorld, demSpan } = window.__geo
  window.__verite = (p) => {
    const g = e.globe, cam = window.__cam(), dem = e.terrain.dem, c = window.__c()
    const liste = g.tuilesAvecHauteurs()
    const hDess = g.hauteurDessinee(p.lat, p.lon, liste)
    const exag = g.exaggeration ?? 1
    const echelleGlobe = (R_GLOBE / EARTH_RADIUS_M) * exag
    const h = hDess ?? p.ele ?? 0
    const v = latLonToSphere(p.lat, p.lon, R_GLOBE + h * echelleGlobe)
    const q = v.clone().project(cam)
    const W = innerWidth, H = innerHeight
    const px = (q.x * 0.5 + 0.5) * W, py = (-q.y * 0.5 + 0.5) * H
    const z = window.__zone()
    const dansEcran = px >= z.x0 && px < z.x1 && py >= z.y0 && py < z.y1 && q.z > -1 && q.z < 1
    const distU = cam.position.distanceTo(v)
    // mètres par pixel à la profondeur du point : hauteur de champ à cette
    // distance (unités de globe, 63 710 m/u) divisée par la hauteur d'écran
    const mParPx = (2 * distU * Math.tan((cam.fov * Math.PI / 180) / 2) * (EARTH_RADIUS_M / R_GLOBE)) / H
    const w = latLonToWorld(dem, p.lat, p.lon)
    const demi = demSpan(dem) / 2
    const dansCrop = Math.abs(w.x) < demi && Math.abs(w.z) < demi
    // et le sommet du ruban le plus proche de ce point, dans la scène : où le PRODUIT l'a mis
    let best = null, bd = Infinity
    const ws = c._worldScene ?? []
    const pts = c.track.points
    for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i].lat - p.lat, (pts[i].lon - p.lon) * Math.cos(p.lat * Math.PI / 180)); if (d < bd) { bd = d; best = i } }
    let produit = null
    if (best != null && ws[best]) {
      const s = new T.Vector3(ws[best].x, ws[best].y, ws[best].z), qs = s.clone().project(cam)
      produit = { i: best, px: (qs.x * 0.5 + 0.5) * W, py: (-qs.y * 0.5 + 0.5) * H, rayon: s.length(), dLatLonM: bd * 111320 }
    }
    return { hDess, source: hDess != null ? 'globe' : 'gpx', px, py, dansEcran, distU, mParPx, dansCrop, rayonVerite: v.length(), produit, demZoom: e.params.demZoom, alt: e.altitudeCadrageM?.() }
  }
})

const R = { etiquette: ETIQ, points, echelles: [] }
for (const z of ZOOMS) {
  for (const p of points) {
    await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { lat: p.lat, lon: p.lon, z })
    for (let i = 0; i < 6; i++) { await tourner(90); await dodo(1000) }
    await B.attendreDrapage(10)
    const rp = await attendreRepos({ maxMs: 90000 })
    const r = await releve(`${ETIQ}-pos-z${z}-${p.nom.replace(/\s/g, '')}`, { image: true })
    const v = await page.evaluate((q) => window.__verite(q), p)
    const dPx = v.dansEcran ? await page.evaluate((x, y) => window.__plusProche(x, y, 80), v.px, v.py) : null
    const dProduitPx = v.produit ? Math.hypot(v.produit.px - v.px, v.produit.py - v.py) : null
    const ligne = { zoom: z, point: p.nom, alt: Math.round(v.alt), demZoom: v.demZoom, dansCrop: v.dansCrop, source: v.source, hDess: v.hDess, ele: p.ele, dansEcran: v.dansEcran, verite: [Math.round(v.px), Math.round(v.py)], dPx, dM: dPx == null ? null : +(dPx * v.mParPx).toFixed(1), mParPx: +v.mParPx.toFixed(2), sommetProduitPx: dProduitPx == null ? null : +dProduitPx.toFixed(1), sommetProduitM: dProduitPx == null ? null : +(dProduitPx * v.mParPx).toFixed(1), ecartLatLonM: v.produit ? +v.produit.dLatLonM.toFixed(0) : null, rayonVerite: v.rayonVerite, rayonProduit: v.produit?.rayon, pixels: r.pixels, bruit: r.bruit, repos: rp.repos }
    R.echelles.push(ligne)
    console.log(`  z${z} ${p.nom.padEnd(8)} alt=${ligne.alt} m  crop=${v.dansCrop ? 'DANS' : 'HORS'}  écran=${v.dansEcran}  vérité=(${Math.round(v.px)},${Math.round(v.py)})  tracé le + proche : ${dPx == null ? '—' : dPx.toFixed(1) + ' px = ' + ligne.dM + ' m'}  (sommet produit : ${ligne.sommetProduitPx ?? '—'} px = ${ligne.sommetProduitM ?? '—'} m, Δr=${v.produit ? ((v.produit.rayon - v.rayonVerite) * 63710 / 2).toFixed(1) : '—'} m)  pixels=${r.pixels} bruit=${r.bruit}  ${v.mParPx.toFixed(1)} m/px  h=${v.source}`)
  }
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-position.json`), JSON.stringify(R, null, 1))
await B.nav.close()
