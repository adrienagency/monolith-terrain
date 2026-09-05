// GX3 — LE TRACÉ QUI DÉBORDE DU SOCLE. Régime A (studio ouvert, bloc entier
// en isométrie), puis deux crans de zoom : le bloc rétrécit (40 → 10 km), le
// tracé de 90 km déborde. On projette l'empreinte du socle (ses quatre coins,
// posés par le poseur du calque lui-même) et on compte les pixels de tracé
// HORS de cette empreinte : « dessiné dans le vide » se chiffre.
// EMPLOI : node scripts/banc-gx3-horscrop.mjs [--gpx x] [--etiquette mb] [--crans 2]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const CRANS = +opt('--crans', '2')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()

await page.evaluate(() => {
  const e = window.__exp, T = e.THREE
  const { demSpan } = window.__geo
  window.__empreinte = () => {
    const c = window.__c(), cam = window.__cam(), dem = e.terrain.dem
    const demi = demSpan(dem) / 2, W = innerWidth, H = innerHeight
    const coins = [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]]
    const poly = coins.map(([x, z]) => { const y = c._sol(x, z); const v = c._placer(x, y, z); const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H] })
    const dedans = (px, py) => { let ok = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok } return ok }
    const M = window.__dernierMasque
    let hors = 0, dans = 0
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.m[y * M.w + x]) { if (dedans(x / M.s, y / M.s)) dans++; else hors++ }
    // et les sommets du tracé hors bloc, côté géométrie
    const w = c.track.world
    let nHors = 0; for (const p of w) if (Math.abs(p.x) >= demi || Math.abs(p.z) >= demi) nHors++
    return { poly: poly.map((p) => p.map(Math.round)), dans, hors, nSommetsHors: nHors, nSommets: w.length, demi, extentM: dem.extentMeters, alt: e.altitudeCadrageM?.() }
  }
})
// ⚠️ Sous le studio ouvert, `cranZoom` ne change PAS l'emprise (41 km aux
// trois crans, mesuré : le cadrage du damier ne recharge pas le relief). On
// ferme donc le studio et on descend par `modes.flyTo` sur le centre du bloc :
// z11 (41 km) → z12 (20 km) → z13 (10 km), le tracé de 90 km déborde.
console.log('studio fermé :', await B.fermerStudio()); await B.attendreDrapage(6); await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
const R = { etiquette: ETIQ, centre, crans: [] }
for (let k = 0; k <= CRANS; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const r = await releve(`${ETIQ}-horscrop-z${k}`, { image: true })
  const em = await page.evaluate(() => window.__empreinte())
  R.crans.push({ k, ...r, ...em })
  console.log(`  cran ${k}  alt=${Math.round(em.alt)} m  emprise=${Math.round(em.extentM / 1000)} km  tracé=${r.pixels} px (bruit ${r.bruit})  DANS le socle ${em.dans} px · HORS ${em.hors} px (${(100 * em.hors / Math.max(1, r.pixels)).toFixed(0)} %)  sommets hors bloc ${em.nSommetsHors}/${em.nSommets}  empreinte=${JSON.stringify(em.poly)}`)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-horscrop.json`), JSON.stringify(R, null, 1))
await B.nav.close()
