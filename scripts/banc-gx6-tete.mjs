// GX6 — OÙ EST LA TÊTE QUAND L'IMAGE DE LECTURE EST VIDE ? Le correctif de la
// visée (GX6 ②) recale la visée quand la tête passe DERRIÈRE la caméra ; deux
// images sur quarante restent vides et la tête y est projetée très loin hors
// cadre. Ce banc dit, à ces images-là, laquelle des deux choses est vraie :
//   · la tête est derrière (produit scalaire négatif) → le recalage aurait dû
//     mordre, et on cherche pourquoi il n'a pas ;
//   · la tête est DEVANT mais hors du tronc de vue → il faut la borner au
//     CADRE, pas au demi-espace.
// Et il lit les deux caméras : le vol est piloté avec celle du BLOC, l'image
// est dessinée avec celle du GLOBE — si leurs cadres diffèrent, une tête
// « dans le cadre » côté drone peut être hors cadre à l'écran.
// EMPLOI : node scripts/banc-gx6-tete.mjs [--port 10441] [--n 24]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const N = +opt('--n', '24')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp, T = e.THREE
  const ndc = (cam, p) => {
    cam.updateMatrixWorld(true)
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    const q = p.clone().project(cam)
    return { x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(3), devant: q.z > -1 && q.z < 1 }
  }
  window.__tete = () => {
    const c = window.__c(), d = e.drone
    const hw = e.gpxLayer.headWorld
    const out = {
      droneActif: !!d?.active, headT: +e.gpxLayer.headT.toFixed(3),
      camBloc: { fov: e.camera.fov, aspect: +e.camera.aspect.toFixed(3) },
      camGlobe: e.camGlobe ? { fov: e.camGlobe.fov, aspect: +e.camGlobe.aspect.toFixed(3) } : null,
    }
    if (!hw) return out
    // côté DRONE : tout en coordonnées de BLOC
    const tb = new T.Vector3(hw.x, hw.y, hw.z)
    out.ndcBloc = ndc(e.camera, tb)
    // l'ORIENTATION RÉELLE de chaque caméra, pas celle que la visée demande :
    // si elles divergent, quelqu'un réoriente la caméra APRÈS `_aim`.
    const avant = (cam) => { const f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); const l = tb.clone().sub(cam.position); return { dot: +f.clone().normalize().dot(l.clone().normalize()).toFixed(3), up: [+cam.up.x.toFixed(2), +cam.up.y.toFixed(2), +cam.up.z.toFixed(2)], near: cam.near, far: cam.far, dist: +l.length().toFixed(2) } }
    out.avantBloc = avant(e.camera)
    // la caméra a-t-elle bougé APRÈS le drone ? et la fenêtre continue a-t-elle glissé ?
    if (d?._pos) out.posDrone = +new T.Vector3(d._pos.x, d._pos.y, d._pos.z).distanceTo(e.camera.position).toFixed(3)
    if (d) { out.memeCam = d.camera === e.camera; out.camEstGlobe = d.camera === e.camGlobe; out.posSaCam = d._pos && d.camera ? +new T.Vector3(d._pos.x, d._pos.y, d._pos.z).distanceTo(d.camera.position).toFixed(3) : null; out.memeControls = d.controls === (e.controls || null) }
    out.fen = e.terrain?.fenetre ? [+e.terrain.fenetre.x.toFixed(2), +e.terrain.fenetre.z.toFixed(2)] : null
    // l'angle entre l'orientation réelle et celle qu'un lookAt(cible) donnerait
    { const m = new T.Matrix4().lookAt(e.camera.position, d?.controls?.target ?? e.camera.position, e.camera.up); const q = new T.Quaternion().setFromRotationMatrix(m); out.angleLookAt = +(2 * Math.acos(Math.min(1, Math.abs(q.dot(e.camera.quaternion)))) * 180 / Math.PI).toFixed(1) }
    if (d) {
      out.cible = d.controls?.target ? +new T.Vector3(d.controls.target.x, d.controls.target.y, d.controls.target.z).distanceTo(d._viseDisp).toFixed(3) : null
      const pos = e.camera.position
      const look = tb.clone().sub(pos)
      const fwd = d._viseDisp ? d._viseDisp.clone().sub(pos) : null
      out.dotVisee = fwd ? +look.normalize().dot(fwd.normalize()).toFixed(3) : null
      out.distTete = +tb.distanceTo(pos).toFixed(2)
      out.distVisee = d._viseDisp ? +d._viseDisp.distanceTo(tb).toFixed(2) : null
      out.headWorldDrone = d._headWorld ? +new T.Vector3(d._headWorld.x, d._headWorld.y, d._headWorld.z).distanceTo(tb).toFixed(3) : null
    }
    // côté ÉCRAN : la tête placée sur la sphère, vue par la caméra du globe
    if (c?._placer) {
      const s = c._placer(hw.x, hw.y, hw.z)
      out.ndcGlobe = ndc(window.__cam(), s)
    }
    // combien de sommets du ruban sont dans le cadre dessiné ?
    const g = c?.ruban?.geometry?.attributes?.position
    if (g) {
      const cam = window.__cam(); cam.updateMatrixWorld(true); cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
      const v = new T.Vector3(); let dans = 0, devant = 0, n = 0
      for (let i = 0; i < g.count; i += 7) { n++; v.set(g.getX(i), g.getY(i), g.getZ(i)).project(cam); if (!(v.z > -1 && v.z < 1)) continue; devant++; if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) dans++ }
      out.ruban = `${dans}/${devant}/${n}`
    }
    return out
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
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  const t = await page.evaluate(() => window.__tete())
  R.push({ k, px, ...t })
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)}${px < 30 ? ' VIDE' : '     '} headT=${t.headT} drone=${t.droneActif} ndcBloc=${JSON.stringify(t.ndcBloc)} ndcGlobe=${JSON.stringify(t.ndcGlobe)} dotVisée=${t.dotVisee} distTête=${t.distTete} ruban=${t.ruban} avantBloc=${JSON.stringify(t.avantBloc)} cible-visée=${t.cible} posDrone-caméra=${t.posDrone} memeCam=${t.memeCam} camEstGlobe=${t.camEstGlobe} posSaCam=${t.posSaCam} angleLookAt=${t.angleLookAt}° fen=${JSON.stringify(t.fen)}`)
  await degeler()
}
console.log(`\n══ caméras ══ bloc ${JSON.stringify(R[0].camBloc)} · globe ${JSON.stringify(R[0].camGlobe)}`)
const v = R.filter((x) => x.px < 30)
console.log(`══ vides ${v.length}/${N} (k=${v.map((x) => x.k).join(',')}) · tête hors cadre à l'écran ${v.filter((x) => x.ndcGlobe && (!x.ndcGlobe.devant || Math.abs(x.ndcGlobe.x) > 1 || Math.abs(x.ndcGlobe.y) > 1)).length}`)
fs.writeFileSync(path.join(SORTIE, 'mb-gx6-tete.json'), JSON.stringify(R, null, 1))
await B.nav.close()
