// GX3 — la scène qui porte `boats` est-elle rendue ? Preuve par la chaîne de passes.
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner } = B
await page.evaluate(() => window.__exp.modes.flyTo(43.27, 5.36, 12)).catch(() => {})
for (let i = 0; i < 15; i++) { await tourner(90); await dodo(1000) }
console.log(JSON.stringify(await page.evaluate(() => {
  const e = window.__exp
  const passes = e.composer.passes.map((p, i) => ({ i, type: p.constructor.name, enabled: p.enabled, scene: p.scene?.uuid?.slice(0, 8) }))
  return { sceneBloc: e.scene.uuid.slice(0, 8), sceneGlobe: e.sceneGlobe.uuid.slice(0, 8), boatsParent: e.boats.group.parent?.uuid?.slice(0, 8), boatsParentEstSceneBloc: e.boats.group.parent === e.scene, passes, passeSceneBlocActive: passes.some((p) => p.scene === e.scene.uuid.slice(0, 8) && p.enabled), gpxParent: window.__exp.gpxLayer.layers[0]?.gpx.group.parent?.uuid?.slice(0, 8) ?? null, terreUnique: e.terreUniqueBranchee, mode: e.modes.mode }
})))
await B.nav.close()
