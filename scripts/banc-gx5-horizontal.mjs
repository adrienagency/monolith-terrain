// GX5 — LA POSITION *HORIZONTALE*, SANS AUCUNE HAUTEUR. Le banc de position du
// noteur mesure une distance À L'ÉCRAN entre deux points posés chacun à SA
// hauteur : une différence de drapage y entre donc comme une erreur de position
// (Δr = 288 m au col 1 à z10, parce que sa vérité pose le point à
// `hauteurDessinee` — les hauteurs RÉSERVÉES — quand le ruban suit désormais le
// MAILLAGE dessiné, ce que GX3 ③ demandait). Ici on retire la hauteur de
// l'équation : chaque sommet du tracé, tel qu'il est POSÉ dans la scène, est
// reconverti en (lat, lon) et confronté au point GPX d'origine par la distance
// orthodromique. C'est la seule mesure de « position horizontale » qui ne
// dépende d'aucune loi de sol — et elle vaut à toutes les échelles.
// EMPLOI : node scripts/banc-gx5-horizontal.mjs [--port 10433] [--gpx x] [--etiquette mb] [--zooms 10,11,12,13]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, med, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const ZOOMS = opt('--zooms', '10,11,12,13').split(',').map(Number)
const B = await ouvrir()
const { page, tourner, chargerGpx, attendreRepos, fermerStudio } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const e = window.__exp
  const { sphereToLatLon, EARTH_RADIUS_M } = window.__geo
  const R = EARTH_RADIUS_M
  const D2R = Math.PI / 180
  window.__horizontal = () => {
    const c = window.__c()
    const t = c.track
    // `track.world` est en BLOC ; `_placer` l'emmène là où le GPU le dessine.
    // On ne compare QUE les angles : la hauteur ne joue aucun rôle.
    const ecarts = []
    const n = t.world.length
    for (let i = 0; i < n; i++) {
      const s = c._placer(t.world[i].x, t.world[i].y, t.world[i].z)
      const ll = sphereToLatLon(s)
      // `track.points` et `track.world` sont le MÊME tableau, rang pour rang
      // (`rebuild()` empile un `world` par point) — vérifié : 2 335 des deux.
      const p = t.points[i]
      if (!p) continue
      const dLat = (ll.lat - p.lat) * D2R
      const dLon = (ll.lon - p.lon) * D2R * Math.cos(p.lat * D2R)
      ecarts.push(Math.hypot(dLat, dLon) * R)
    }
    ecarts.sort((a, b) => a - b)
    const q = (f) => ecarts[Math.min(ecarts.length - 1, Math.floor(f * ecarts.length))]
    return {
      n: ecarts.length,
      moyM: +(ecarts.reduce((a, b) => a + b, 0) / ecarts.length).toFixed(2),
      medM: +q(0.5).toFixed(2), p95M: +q(0.95).toFixed(2), maxM: +ecarts[ecarts.length - 1].toFixed(2),
      demZoom: e.params.demZoom, alt: Math.round(e.altitudeCadrageM?.() ?? -1),
    }
  }
})
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon }))
const R = []
for (const z of ZOOMS) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z }).catch(() => {})
  for (let i = 0; i < 6; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(10)
  await attendreRepos({ maxMs: 90000 })
  const h = await page.evaluate(() => window.__horizontal())
  R.push({ z, ...h })
  console.log(`  z${z}  alt=${h.alt} m  demZoom=${h.demZoom}  écart HORIZONTAL sommet ↔ point GPX (${h.n} sommets) : moy ${h.moyM} m · méd ${h.medM} m · p95 ${h.p95M} m · max ${h.maxM} m`)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx5-horizontal.json`), JSON.stringify(R, null, 1))
await B.nav.close()
