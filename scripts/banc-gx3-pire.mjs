// GX3 — LE PIRE POINT DE DRAPAGE, VU : où il tombe à l'écran au cadrage B,
// puis en volant dessus (z13, z14) — le drapage se recalcule-t-il sur des
// hauteurs plus fines, et que reste-t-il de l'écart contre la surface rendue ?
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap, releve } = B
await B.chargerGpx('.banc/marathon-mont-blanc-90km.gpx'); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
const IDX = opt('--i', '1168,296').split(',').map(Number)
await page.evaluate(() => {
  const e = window.__exp, T = e.THREE
  window.__ecran = (i) => { const c = window.__c(), cam = window__cam_(); const s = c._worldScene[i]; const q = new T.Vector3(s.x, s.y, s.z).project(cam); return { px: Math.round((q.x * 0.5 + 0.5) * innerWidth), py: Math.round((-q.y * 0.5 + 0.5) * innerHeight), z: q.z } }
  function window__cam_() { return window.__cam() }
  // l'écart contre la surface RENDUE, pour une liste d'indices (même rayon que banc-gx3-drapage)
  window.__ecartRendu = (idx) => {
    const c = window.__c(), g = e.globe
    const { EARTH_RADIUS_M, R_GLOBE } = window.__geo
    const mParU = (EARTH_RADIUS_M / R_GLOBE) / (g.exaggeration ?? 1)
    const meshes = []; g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    const rc = new T.Raycaster(); rc.near = 0; rc.far = 30
    return idx.map((i) => { const s = new T.Vector3(c._worldScene[i].x, c._worldScene[i].y, c._worldScene[i].z); const dir = s.clone().normalize(); rc.set(dir.clone().multiplyScalar(110), dir.clone().negate()); const hits = rc.intersectObjects(meshes, false); let rMax = -1, nom = ''; for (const h of hits) { const r = h.point.length(); if (r > rMax) { rMax = r; nom = h.object.name } } return { i, ecartM: rMax < 0 ? null : +((s.length() - rMax) * mParU).toFixed(1), tuile: nom, hDess: g.hauteurDessinee(c.track.points[i].lat, c.track.points[i].lon), yM: c._poseur?.metresDe ? +c._poseur.metresDe(c.track.world[i].y).toFixed(1) : null, ele: c.track.points[i].ele, tuilesH: g.tuilesAvecHauteurs().map((t) => t.z).join(',').slice(0, 60), demZoom: e.params.demZoom } })
  }
})
const R = { etapes: [] }
async function etape(nom) {
  const r = await releve(`pire-${nom}`, { image: true })
  const pos = await page.evaluate((idx) => idx.map((i) => window.__ecran(i)), IDX)
  const ec = await page.evaluate((idx) => window.__ecartRendu(idx), IDX)
  // distance de chaque point au pixel de tracé le plus proche (masque = tracé)
  const dPx = await page.evaluate((pos) => pos.map((p) => window.__plusProche(p.px, p.py, 60)), pos)
  const alt = await page.evaluate(() => Math.round(window.__exp.altitudeCadrageM?.() ?? -1))
  R.etapes.push({ nom, alt, pixels: r.pixels, bruit: r.bruit, pos, ec, dPx })
  console.log(`  ${nom}  alt=${alt}  tracé=${r.pixels} px  ` + IDX.map((i, k) => `[i=${i} écran=(${pos[k].px},${pos[k].py}) tracé à ${dPx[k] == null ? '—' : dPx[k].toFixed(1) + ' px'} · écart rendu ${ec[k].ecartM} m (tuile ${ec[k].tuile}, hDess ${ec[k].hDess?.toFixed(0)}, ruban ${ec[k].yM}, ele ${ec[k].ele}) hauteurs ${ec[k].tuilesH} dem z${ec[k].demZoom}]`).join('  '))
}
await etape('B')
for (const z of [13, 14]) {
  const p = await page.evaluate((i) => { const t = window.__c().track.points[i]; return { lat: t.lat, lon: t.lon } }, IDX[0])
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...p, z })
  for (let i = 0; i < 6; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(10); await B.attendreRepos({ maxMs: 90000 })
  await etape(`z${z}`)
}
fs.writeFileSync(path.join(SORTIE, 'pire-point.json'), JSON.stringify(R, null, 1))
await B.nav.close()
