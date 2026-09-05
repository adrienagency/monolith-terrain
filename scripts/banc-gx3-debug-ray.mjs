import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page } = B
await B.chargerGpx('.banc/marathon-mont-blanc-90km.gpx'); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
const r = await page.evaluate(() => {
  const e = window.__exp, T = e.THREE, c = window.__c(), g = e.globe
  const { R_GLOBE, EARTH_RADIUS_M, latLonToSphere } = window.__geo
  const meshes = []; g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position) meshes.push(o) })
  const out = []
  for (const i of [0, 600, 1200]) {
    const s = new T.Vector3(c._worldScene[i].x, c._worldScene[i].y, c._worldScene[i].z)
    const p = c.track.points[i]
    const h = g.hauteurDessinee(p.lat, p.lon)
    const v = latLonToSphere(p.lat, p.lon, R_GLOBE + h * (R_GLOBE / EARTH_RADIUS_M) * (g.exaggeration ?? 1))
    const rc = new T.Raycaster(new T.Vector3(0, 0, 0), s.clone().normalize(), 50, 150)
    const hits = rc.intersectObjects(meshes, false).map((hh) => ({ n: hh.object.name || hh.object.type, r: +hh.point.length().toFixed(4), local: +hh.object.worldToLocal(hh.point.clone()).length().toFixed(4) }))
    out.push({ i, rRuban: +s.length().toFixed(4), rVerite: +v.length().toFixed(4), h, ele: p.ele, hits: hits.slice(0, 12), groupePos: g.group.position.toArray(), groupeScale: g.group.scale.toArray(), gpxParentPos: c.group.parent?.position?.toArray?.(), gpxPos: c.group.position.toArray() })
  }
  const gm = g.group.matrixWorld.elements.map((x) => +x.toFixed(3))
  return { out, gm, nMeshes: meshes.length }
})
console.log(JSON.stringify(r, null, 1))
await B.nav.close()
