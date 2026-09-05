// GX6 — QUI ORIENTE LA CAMÉRA PENDANT LA LECTURE ? Mesuré au banc précédent :
// pendant le vol de poursuite de Chamonix, `controls.target` est PILE sur la
// tête (écart 0), et pourtant la caméra regarde à **176,5° de sa propre cible**
// (produit scalaire avant·tête = −0,13) — la tête sort du cadre par le haut
// (ndc y ≈ +26) et l'image de lecture n'a pas un pixel de tracé. Ce banc pose
// des jalons DANS la boucle : après `drone.updateAt`, après `drone.followPivot`,
// après `controls.update`, et au relevé. Celui qui laisse la caméra bien
// orientée et celui qui la trouve retournée encadrent le coupable.
// EMPLOI : node scripts/banc-gx6-qui.mjs [--port 10441] [--n 3] [--gpx x]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const N = +opt('--n', '3')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/court-montagne-chamonix-4km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp, T = e.THREE, d = e.drone
  window.__j = { updateAt: 0, followPivot: 0, controlsUpdate: 0, apres: {} }
  // le produit scalaire entre l'avant de la caméra et la direction de la tête
  const dot = () => {
    const hw = e.gpxLayer.headWorld; if (!hw) return null
    const f = new T.Vector3(0, 0, -1).applyQuaternion(e.camera.quaternion)
    const l = new T.Vector3(hw.x, hw.y, hw.z).sub(e.camera.position)
    if (l.lengthSq() < 1e-9) return null
    return +f.normalize().dot(l.normalize()).toFixed(3)
  }
  const pos = () => [+e.camera.position.x.toFixed(2), +e.camera.position.y.toFixed(2), +e.camera.position.z.toFixed(2)]
  if (d) {
    const ua = d.updateAt.bind(d)
    d.updateAt = (dt, s, hw) => { const r = ua(dt, s, hw); window.__j.updateAt++; window.__j.apres.updateAt = { dot: dot(), pos: pos(), dt: +dt.toFixed(4) }; return r }
    const fp = d.followPivot.bind(d)
    d.followPivot = (s) => { const r = fp(s); window.__j.followPivot++; window.__j.apres.followPivot = { dot: dot(), pos: pos() }; return r }
  }
  const ctl = d?.controls
  if (ctl?.update) { const cu = ctl.update.bind(ctl); ctl.update = (...a) => { const r = cu(...a); window.__j.controlsUpdate++; window.__j.apres.controlsUpdate = { dot: dot(), pos: pos() }; return r } }
  window.__jalons = () => ({ ...window.__j, releve: { dot: dot(), pos: pos() }, cible: d?.controls?.target ? [+d.controls.target.x.toFixed(2), +d.controls.target.y.toFixed(2), +d.controls.target.z.toFixed(2)] : null, dronePos: d?._pos ? [+d._pos.x.toFixed(2), +d._pos.y.toFixed(2), +d._pos.z.toFixed(2)] : null, actif: !!d?.active })
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve()
  const j = await page.evaluate(() => window.__jalons())
  console.log(`  ${k} tracé=${r.pixels}  appels{updateAt:${j.updateAt}, followPivot:${j.followPivot}, controls.update:${j.controlsUpdate}}`)
  console.log(`     après updateAt      : ${JSON.stringify(j.apres.updateAt)}`)
  console.log(`     après followPivot   : ${JSON.stringify(j.apres.followPivot)}`)
  console.log(`     après controls.upd. : ${JSON.stringify(j.apres.controlsUpdate)}`)
  console.log(`     AU RELEVÉ           : ${JSON.stringify(j.releve)}  cible=${JSON.stringify(j.cible)}  _pos=${JSON.stringify(j.dronePos)}  actif=${j.actif}`)
  await degeler()
}
await B.nav.close()
