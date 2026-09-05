// GX5 — AUTOPSIE III : où sont les SOMMETS CUITS du ruban à l'écran ? On projette
// `ruban.geometry.attributes.position` (ce que le GPU dessine) avec la caméra du
// globe, et on compare au même comptage fait sur `track.world` passé par
// `_placer` (ce que la sonde croyait mesurer). La différence, s'il y en a une,
// est la mesure du décalage entre le ruban CUIT et le poseur COURANT.
// EMPLOI : node scripts/banc-gx5-autopsie3.mjs [--port 10433] [--n 40]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const N = +opt('--n', '40')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp
  window.__ou = () => {
    const c = window.__c(), cam = window.__cam(), T = e.THREE
    const g = c.ruban.geometry, p = g.attributes.position, aD = g.attributes.aDist
    const t = c._rubanProgress.value
    const v = new T.Vector3()
    let devant = 0, ecran = 0, n = 0, devoiles = 0, devoilesEcran = 0
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    const ex = []
    for (let i = 0; i < p.count; i += 7) {
      n++
      v.set(p.getX(i), p.getY(i), p.getZ(i)).project(cam)
      const dev = v.z > -1 && v.z < 1
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight
      const dansE = dev && px >= 0 && py >= 0 && px <= innerWidth && py <= innerHeight
      const rev = aD ? aD.getX(i) <= t * (g.userData?.longueur ?? 1e9) || aD.getX(i) <= t : false
      if (dev) devant++
      if (dansE) { ecran++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (ex.length < 5) ex.push([Math.round(px), Math.round(py), +v.z.toFixed(3)]) }
      if (rev) { devoiles++; if (dansE) devoilesEcran++ }
    }
    // le même comptage sur track.world passé par _placer
    let wDevant = 0, wEcran = 0
    const w = c.track.world
    for (let i = 0; i < w.length; i++) {
      const s = c._placer(w[i].x, w[i].y, w[i].z)
      v.copy(s).project(cam)
      const dev = v.z > -1 && v.z < 1
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight
      if (dev) { wDevant++; if (px >= 0 && py >= 0 && px <= innerWidth && py <= innerHeight) wEcran++ }
    }
    // écart entre le sommet CUIT et le placement COURANT du même point de tracé
    let ecartMax = 0
    const pos0 = new T.Vector3(p.getX(0), p.getY(0), p.getZ(0))
    const cur0 = c._placer(w[0].x, w[0].y, w[0].z)
    ecartMax = pos0.distanceTo(cur0)
    return { sommetsTestes: n, devant, ecran, boite: ecran ? [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)] : null, ex, wDevant, wEcran, wTotal: w.length, uProgress: t, aDistMax: aD ? aD.getX(p.count - 1) : null, ecartSommet0: +ecartMax.toFixed(4), viewport: [innerWidth, innerHeight] }
  }
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  const o = await page.evaluate(() => window.__ou())
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)}  géométrie: devant ${o.devant}/${o.sommetsTestes} écran ${o.ecran} boite=${JSON.stringify(o.boite)} · _placer(track.world): devant ${o.wDevant} écran ${o.wEcran}/${o.wTotal} · uProgress=${(+o.uProgress).toFixed(3)} aDistMax=${o.aDistMax} écartSommet0=${o.ecartSommet0}`)
  if (px < 30 && k > 2) { console.log('  ex=' + JSON.stringify(o.ex)); break }
  await degeler()
}
await B.nav.close()
