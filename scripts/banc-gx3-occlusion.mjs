// GX3 — POURQUOI CHAMONIX FAIT 236 px EN PRODUCTION ET 274 SOUS ?terre=deux ?
// Même cadrage (régime A, studio ouvert), même ruban (1,4 px de large, 404–409 px
// de long à l'écran). Hypothèse : le relief CACHE une part différente du ruban.
// Mesure : pour 240 sommets du ruban, un rayon de la caméra vers le sommet ;
// s'il frappe la surface dessinée AVANT le sommet, le sommet est caché.
//   production : surface = tuiles du globe (sceneGlobe) ; ?terre=deux : le
//   maillage du bloc (`terrain.mesh`, scène du bloc).
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner } = B
await B.chargerGpx(opt('--gpx', '.banc/court-montagne-chamonix-4km.gpx')); await B.attendreRepos()
const r = await page.evaluate(() => {
  const e = window.__exp, T = e.THREE, c = window.__c(), cam = window.__cam()
  const globe = !!c._poseur?.globe
  const meshes = []
  if (globe) e.globe.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
  else { const m = e.terrain?.mesh; if (m) { m.updateWorldMatrix(true, false); meshes.push(m) } }
  const pts = c._worldScene ?? c.track.world
  const rc = new T.Raycaster()
  let caches = 0, vus = 0, horsChamp = 0
  const W = innerWidth, H = innerHeight
  const pas = Math.max(1, Math.floor(pts.length / 240))
  for (let i = 0; i < pts.length; i += pas) {
    const s = new T.Vector3(pts[i].x, pts[i].y, pts[i].z)
    const q = s.clone().project(cam)
    if (!(Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && q.z > -1 && q.z < 1)) { horsChamp++; continue }
    const dir = s.clone().sub(cam.position); const d = dir.length(); dir.normalize()
    rc.set(cam.position, dir); rc.near = 0; rc.far = d * 1.5
    const hits = rc.intersectObjects(meshes, false)
    // caché si un maillage est touché nettement avant le sommet (au-delà de la largeur du ruban)
    const marge = 0.0005 * d + (globe ? 0.0002 : 0.02)
    if (hits.length && hits[0].distance < d - marge) caches++; else vus++
  }
  return { globe, meshes: meshes.length, echantillon: vus + caches + horsChamp, vus, caches, horsChamp, partCachee: +(caches / Math.max(1, vus + caches)).toFixed(3), alt: Math.round(e.altitudeCadrageM?.() ?? -1), exagGlobe: e.globe?.exaggeration, largeurBloc: e.terrain?.dem?.extentMeters }
})
console.log(`  ${opt('--adresse', 'production')} : ${JSON.stringify(r)}`)
fs.writeFileSync(path.join(SORTIE, `occlusion-${opt('--adresse', 'prod').replace(/[=&]/g, '-')}.json`), JSON.stringify(r, null, 1))
await B.nav.close()
