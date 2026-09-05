// GX5 — AUTOPSIE D'UNE IMAGE VIDE. Vol du noteur ; au premier relevé sous 30 px,
// on démonte : la scène qui porte le groupe, la chaîne de visibilité, les plans
// de coupe, les couches de caméra, l'état du matériau — puis DEUX substitutions
// qui tranchent : (a) le ruban repeint en rouge opaque sans test de profondeur
// (si des pixels apparaissent, le défaut est dans le MATÉRIAU), (b) le groupe
// réadopté par `sceneGlobe` (si des pixels apparaissent, il était dans la scène
// morte). Ne corrige rien : rend la main après le rapport.
// EMPLOI : node scripts/banc-gx5-autopsie.mjs [--port 10433] [--n 40]
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
  window.__autopsie = () => {
    const c = window.__c(), cam = window.__cam(), r = c.ruban
    const o = {}
    o.scene = { estSceneGlobe: c.group.parent === e.sceneGlobe, estScene: c.group.parent === e.scene, nom: c.group.parent?.name || c.group.parent?.type, uuid: c.group.parent?.uuid?.slice(0, 8) }
    let p = r, chaine = []
    while (p) { chaine.push(`${p.type}${p.name ? ':' + p.name : ''}=${p.visible}`); p = p.parent }
    o.chaineVisible = chaine.join(' < ')
    o.frustumCulled = r.frustumCulled
    o.couches = { ruban: r.layers.mask, cam: cam.layers.mask, test: r.layers.test(cam.layers) }
    const m = r.material
    o.mat = { type: m.type, visible: m.visible, opacity: m.opacity, transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite, colorWrite: m.colorWrite, blending: m.blending, side: m.side, clip: m.clippingPlanes ? m.clippingPlanes.length : null, cle: m.customProgramCacheKey?.(), progUniformes: null }
    o.rendu = { localClipping: e.renderer?.localClippingEnabled, clipGlobal: e.renderer?.clippingPlanes?.length ?? 0 }
    o.uProgress = c._rubanProgress?.value
    o.uniformesPartages = m.userData?.__u ?? null
    const bs = r.geometry.boundingSphere
    o.bs = bs ? { c: [+bs.center.x.toFixed(2), +bs.center.y.toFixed(2), +bs.center.z.toFixed(2)], r: +bs.radius.toFixed(3) } : null
    o.attributs = Object.keys(r.geometry.attributes)
    o.camPos = [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)]
    o.camNearFar = [cam.near, cam.far]
    // distance caméra → premier sommet dévoilé visible
    return o
  }
  window.__rougir = () => { const c = window.__c(); const T = e.THREE; c.__memoMat = c.ruban.material; c.ruban.material = new T.MeshBasicMaterial({ color: 0xff0000, depthTest: false, side: T.DoubleSide }) }
  window.__derougir = () => { const c = window.__c(); if (c.__memoMat) { c.ruban.material = c.__memoMat; c.__memoMat = null } }
  window.__reAdopter = () => { const c = window.__c(); e.sceneGlobe.add(c.group); return c.group.parent === e.sceneGlobe }
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
  console.log(`  ${String(k).padStart(2)} tracé=${px}`)
  if (px < 30 && k > 2) {
    console.log('  ══ AUTOPSIE ══', JSON.stringify(await page.evaluate(() => window.__autopsie()), null, 1))
    await page.evaluate(() => window.__rougir())
    const rouge = await releve('gx5-autopsie-rouge', { image: true })
    await page.evaluate(() => window.__derougir())
    console.log(`  (a) ruban repeint rouge, sans profondeur : ${rouge.pixels} px (bruit ${rouge.bruit})`)
    const ok = await page.evaluate(() => window.__reAdopter())
    const readopte = await releve()
    console.log(`  (b) groupe réadopté par sceneGlobe (${ok}) : ${readopte.pixels} px`)
    break
  }
  await degeler()
}
await B.nav.close()
