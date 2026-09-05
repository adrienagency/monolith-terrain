// GX5 — AUTOPSIE II : le ruban est-il SOUMIS au rendu ? On compte les appels à
// `onBeforeRender` du ruban, on enregistre chaque `renderer.render(scène,
// caméra)` de l'image, et on relit la géométrie (index, drawRange, matrice du
// groupe). Au premier relevé vide, tout est imprimé.
// EMPLOI : node scripts/banc-gx5-autopsie2.mjs [--port 10433] [--n 40]
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
  window.__cptRendu = { ruban: 0, sillage: 0, rendus: [] }
  const vrai = e.renderer.render.bind(e.renderer)
  e.renderer.render = (sc, cam) => {
    window.__cptRendu.rendus.push(`${sc.name || sc.type}:${sc.uuid.slice(0, 6)}/${cam.uuid.slice(0, 6)}`)
    return vrai(sc, cam)
  }
  window.__brancher = () => {
    const c = window.__c()
    if (c.ruban) c.ruban.onBeforeRender = () => { window.__cptRendu.ruban++ }
    if (c.sillage) c.sillage.onBeforeRender = () => { window.__cptRendu.sillage++ }
  }
  window.__zero = () => { window.__cptRendu.ruban = 0; window.__cptRendu.sillage = 0; window.__cptRendu.rendus = [] }
  window.__etat = () => {
    const c = window.__c(), r = c.ruban, e2 = window.__exp
    const g = c.group
    return {
      compte: { ruban: window.__cptRendu.ruban, sillage: window.__cptRendu.sillage },
      rendus: [...new Set(window.__cptRendu.rendus)],
      camGlobe: e2.camGlobe?.uuid.slice(0, 6), camBloc: e2.camera?.uuid.slice(0, 6),
      sceneGlobe: e2.sceneGlobe?.uuid.slice(0, 6), sceneBloc: e2.scene?.uuid.slice(0, 6),
      index: r.geometry.index?.count, drawRange: { ...r.geometry.drawRange },
      groupeMat: [...g.matrixWorld.elements].map((x) => +x.toFixed(3)),
      groupePos: [g.position.x, g.position.y, g.position.z], groupeEch: g.scale.x,
      rubanMat: [...r.matrixWorld.elements].map((x) => +x.toFixed(3)),
      pos0: [r.geometry.attributes.position.getX(0), r.geometry.attributes.position.getY(0), r.geometry.attributes.position.getZ(0)],
      frustumCulled: r.frustumCulled, visible: r.visible,
    }
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
  await page.evaluate(() => { window.__brancher(); window.__zero() })
  await tourner(3)
  const etat = await page.evaluate(() => window.__etat())
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)}  rendus ruban=${etat.compte.ruban} sillage=${etat.compte.sillage}  passes=${etat.rendus.join(' ')}`)
  if (px < 30 && k > 2) { console.log('  ══ ÉTAT ══', JSON.stringify(etat, null, 1)); break }
  await degeler()
}
await B.nav.close()
