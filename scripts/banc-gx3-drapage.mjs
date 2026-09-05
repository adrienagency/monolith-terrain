// GX3 — LE DRAPAGE : le ruban colle-t-il à la surface RENDUE ? Pour chaque
// sommet du tracé (les 2 335 points décimés que le ruban suit), un rayon
// RADIAL (du centre de la sphère vers l'extérieur) est lancé contre les
// maillages VISIBLES du globe dans `sceneGlobe` : rayon d'intersection contre
// rayon du sommet du ruban. C'est la surface que le GPU dessine, pas une loi.
// Écart en mètres RÉELS (l'exagération est divisée), positif = le ruban flotte,
// négatif = il s'enterre. On cherche LE PIRE POINT, pas la moyenne.
//
// Et, pour comparer avec GX1/GX2 : le même écart lu contre `terrain.sample`
// (le MNT du BLOC) — c'est ce que leurs « −4,7 m / −68,2 m » mesuraient.
// EMPLOI : node scripts/banc-gx3-drapage.mjs [--gpx x] [--etiquette mb] [--regime A|B]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const REGIME = opt('--regime', 'B')
const B = await ouvrir()
const { page, tourner, chargerGpx, attendreRepos, fermerStudio } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
if (REGIME === 'B') { console.log('studio fermé :', await fermerStudio()); await B.attendreDrapage(6) }
await attendreRepos()

const res = await page.evaluate(() => {
  const e = window.__exp, T = e.THREE, c = window.__c(), g = e.globe
  const { EARTH_RADIUS_M, R_GLOBE } = window.__geo
  const exag = g.exaggeration ?? 1
  const mParU = (EARTH_RADIUS_M / R_GLOBE) / exag // mètres réels par unité de globe, en radial
  // les maillages du globe qui portent le relief : visibles, avec géométrie, hors nuages/caps
  // ⚠️ SEULEMENT LES TUILES DU GLOBE (nommées par leur clé « z/x/y ») et les
  // pièces du crop (`crop-mer`, `crop-parois`) : un premier tour prenait un
  // maillage SANS NOM à 3,9 unités au-dessus du sol (≈ 125 km, la coquille
  // d'atmosphère) pour « la surface ». Il n'y a pas de mer ici, mais on la garde
  // pour que les fonds de vallée soient comparés à ce qui est réellement dessiné.
  const meshes = []
  e.globe.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
  const nomsScene = []; e.sceneGlobe.traverse((o) => { if (o.isMesh && o.visible && nomsScene.length < 40 && !/^\d+\/\d+\/\d+/.test(o.name || '')) nomsScene.push(o.name || o.type) })
  for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
  const rc = new T.Raycaster()
  const w = c.track.world, ws = c._worldScene, pts = c.track.points
  const fen = e.terrain?.fenetre || { x: 0, z: 0 }
  const p = c._poseur
  const out = []
  let sansHit = 0
  const t0 = performance.now()
  for (let i = 0; i < ws.length; i++) {
    const s = new T.Vector3(ws[i].x, ws[i].y, ws[i].z)
    const dir = s.clone().normalize()
    // ⚠️ DU DEHORS VERS LE DEDANS. Un rayon parti du centre de la sphère frappe
    // les tuiles par leur FACE ARRIÈRE et `Raycaster` les ignore (FrontSide) :
    // un premier tour n'a touché que les parois et l'atmosphère. On part donc
    // de 110 unités et on vise le centre : le premier maillage de tuile
    // rencontré est la surface vue du ciel.
    rc.set(dir.clone().multiplyScalar(110), dir.clone().negate())
    rc.near = 0; rc.far = 30
    // candidats : les maillages dont la sphère englobante coupe le rayon
    const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
    const hits = rc.intersectObjects(cand, false)
    if (!hits.length) { sansHit++; out.push({ i, ecartM: null }); continue }
    // la surface la plus HAUTE sous le point (le rayon traverse d'abord le fond du crop, puis le relief) : on prend le hit de plus grand rayon
    let rMax = -1, nom = ''
    for (const h of hits) { const r = h.point.length(); if (r > rMax) { rMax = r; nom = h.object.name } }
    const ecartM = (s.length() - rMax) * mParU
    const yBloc = w[i].y
    let sol = null; try { sol = e.terrain.sample(w[i].x - fen.x, w[i].z - fen.z) } catch {}
    const echelleBloc = p?.echelleBloc ?? null
    const ecartBlocM = (sol != null && echelleBloc) ? (yBloc - sol) / echelleBloc : null
    out.push({ i, lat: pts[i].lat, lon: pts[i].lon, ele: pts[i].ele, ecartM: +ecartM.toFixed(2), ecartBlocM: ecartBlocM == null ? null : +ecartBlocM.toFixed(2), tuile: nom, nHits: hits.length })
  }
  const ms = performance.now() - t0
  const ok = out.filter((o) => o.ecartM != null)
  const tri = [...ok].sort((a, b) => a.ecartM - b.ecartM)
  const vals = ok.map((o) => o.ecartM)
  const bl = ok.filter((o) => o.ecartBlocM != null).map((o) => o.ecartBlocM)
  const stats = (a) => ({ n: a.length, moy: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2), min: Math.min(...a), max: Math.max(...a), p05: a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.05)], p95: a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.95)] })
  return { nomsScene, n: out.length, sansHit, ms: Math.round(ms), meshes: meshes.length, exag, mParU, dem: { zoom: e.terrain.dem.zoom, extentM: e.terrain.dem.extentMeters, meanM: e.terrain.dem.meanM }, tuilesHauteurs: g.tuilesAvecHauteurs().map((t) => t.z).join(','), lift: 0.012 / (p?.echelleBloc ?? 1),
    rendu: stats(vals), bloc: stats(bl), pires: tri.slice(0, 8), plusHauts: tri.slice(-8), sousSol: ok.filter((o) => o.ecartM < 0).length, sousSol5: ok.filter((o) => o.ecartM < -5).length, dessus50: ok.filter((o) => o.ecartM > 50).length, alt: e.altitudeCadrageM?.() }
})
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-drapage-${REGIME}.json`), JSON.stringify(res, null, 1))
await B.nav.close()
