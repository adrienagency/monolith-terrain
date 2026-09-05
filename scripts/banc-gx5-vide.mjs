// GX5 — POURQUOI UNE IMAGE DE LECTURE EST-ELLE VIDE ? Même vol que le banc du
// noteur (clic souris, temps gelé au relevé), mais à chaque relevé à moins de
// 30 px on interroge la scène : combien de sommets DÉVOILÉS sont dans le champ,
// combien sont devant la caméra, combien sont cachés par le relief — et ce que
// donne le même relevé avec le ruban entièrement dévoilé (uProgress = 1).
// EMPLOI : node scripts/banc-gx5-vide.mjs [--port 10433] [--gpx x] [--n 40]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const N = +opt('--n', '40')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(async () => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp, T = e.THREE
  window.__sol = await import('/src/monde/sol-globe.js')
  window.__cpt = { rebuildAll: 0 }
  const ra = e.gpxLayer.rebuildAll.bind(e.gpxLayer)
  e.gpxLayer.rebuildAll = () => { window.__cpt.rebuildAll++; return ra() }
  // combien de sommets dévoilés sont visibles ? (champ, devant, non occultés)
  window.__diagVide = () => {
    const c = window.__c(), cam = window.__cam(), g = e.globe
    const w = c.track.world, cum = c.track.cumKm
    const t = c._revealT ?? 1
    const total = cum[cum.length - 1]
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const rc = new T.Raycaster()
    let devoiles = 0, devant = 0, dansEcran = 0, vus = 0, caches = 0
    const v = new T.Vector3()
    for (let i = 0; i < w.length; i++) {
      if (cum[i] / total > t) continue
      devoiles++
      const s = c._placer(w[i].x, w[i].y, w[i].z)
      v.copy(s).project(cam)
      if (!(v.z > -1 && v.z < 1)) continue
      devant++
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight
      if (px < 0 || py < 0 || px > innerWidth || py > innerHeight) continue
      dansEcran++
      if (dansEcran > 400) continue // le rayon coûte
      const dir = s.clone().sub(cam.position); const d = dir.length(); dir.normalize()
      rc.set(cam.position, dir); rc.far = d - 0.0002
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      if (rc.intersectObjects(cand, false).length) caches++; else vus++
    }
    return { devoiles, devant, dansEcran, vus, caches, t: +t.toFixed(3), uProgress: c._rubanProgress?.value, rubanVis: c.ruban?.visible, grpVis: c.group.visible, sillageVis: c.sillage?.visible, rebuildAll: window.__cpt.rebuildAll }
  }
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
const R = []
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve()
  const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  let d = null, plein = null
  if (px < 30) {
    d = await page.evaluate(() => window.__diagVide())
    // et avec le ruban ENTIÈREMENT dévoilé : y a-t-il quelque chose à voir ?
    await page.evaluate(() => { window.__memo = window.__c()._rubanProgress.value; window.__c()._rubanProgress.value = 1 })
    const rp = await releve()
    await page.evaluate(() => { window.__c()._rubanProgress.value = window.__memo })
    plein = rp.pixels
    await releve(`${ETIQ}-vide${k}`, { image: true })
  }
  R.push({ k, px, d, plein })
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)}${px < 30 ? `  VIDE  diag=${JSON.stringify(d)}  dévoilé à 100 % → ${plein} px` : ''}`)
  await degeler()
}
console.log(`\n══ vides ${R.filter((r) => r.px < 30).length}/${N} (k=${R.filter((r) => r.px < 30).map((r) => r.k).join(',')})`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx5-vide.json`), JSON.stringify(R, null, 1))
await B.nav.close()
