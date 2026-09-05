// GX8 — POURQUOI UNE ÉTIQUETTE RESTE ALLUMÉE HORS DU SOCLE.
//
// `banc-gx8-vide.mjs` attribue PAR DIFFÉRENCE les ~91 pixels de tracé posés
// dans le vide à z13 : un seul `Sprite` du groupe GPX les porte (l'éteindre en
// retire 91 sur 91). Les objets ponctuels se cachent au lieu de se couper
// (`_ecreteFenetre` → `_dansSocle`) ; ce banc demande donc, pour CHAQUE sprite
// ponctuel, à la fois ce que le produit en pense et ce que le socle VIVANT en
// dit, et confronte le repère de crop que tient le poseur à celui du globe.
//
// AUCUN EFFET SUR LE PRODUIT : lecture seule.
// EMPLOI : node scripts/banc-gx8-etiquette.mjs [--port 10471] [--cran 2]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const CRAN = +opt('--cran', '2')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()

await page.evaluate(async () => {
  window.__crop = await import('/src/monde/crop-sphere.js')
  window.__sonde = () => {
    const e = window.__exp, c = window.__c(), g = e.globe
    const poseur = c._poseur
    const vif = g._crop ? { cx: g._crop.cx, cy: g._crop.cy, demi: g._crop.demi } : null
    const fige = poseur?.repereCrop || null
    const u = g.uniforms
    const uCentre = u?.uCropCentre ? { x: u.uCropCentre.value.x, y: u.uCropCentre.value.y } : null
    const uDemi = u?.uCropDemi ? u.uCropDemi.value : null
    const formeFigee = poseur?.formeCrop || null
    const formeVive = u?.uCropCoin ? { coin: u.uCropCoin.value, expo: u.uCropCoinN.value } : null
    // le même test que `_dansSocle`, mais contre le repère VIVANT
    const { localCrop, distanceCrop } = window.__crop
    // ⚠️ `versLatLon` N'EST PAS exposé sur le poseur (c'est un argument de
    // `creerPoseurGlobe`, pas une clé de `etat`) : une première version de ce
    // banc l'appelait sur le poseur, obtenait `undefined`, et rendait `true`
    // pour TOUT point — la colonne « vif » ne mesurait rien. On passe donc par
    // `geo.worldToLatLon`, la même fonction que le poseur reçoit.
    const { worldToLatLon } = window.__geo
    const dansSocleVif = (x, z) => {
      if (!vif) return true
      const p = worldToLatLon(e.terrain.dem, x, z)
      if (!p) return true
      const l = localCrop(p.lat, p.lon, vif)
      return distanceCrop(l.u, l.v, formeVive || undefined) <= 0
    }
    const pon = (c._ponctuels || []).map((p, i) => ({
      i,
      type: p.obj.type,
      visible: !!p.obj.visible,
      produitDit: c._dansSocle(p.x, p.z),   // ce que le produit calcule (repère FIGÉ)
      socleVivant: dansSocleVif(p.x, p.z),  // ce que le socle DESSINÉ dit
    }))
    const desaccord = pon.filter((p) => p.produitDit !== p.socleVivant)
    const fautives = pon.filter((p) => p.visible && !p.socleVivant)
    // ── et QUI est chaque enfant visible du groupe : son ancre, son sol, sa place
    const T = e.THREE, cam = window.__cam()
    const parAncre = new Map((c._ponctuels || []).map((p) => [p.obj, p]))
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const rc = new T.Raycaster(), ndc = new T.Vector2()
    const enfants = c.group.children.map((o, i) => {
      if (!o.visible) return null
      const p = parAncre.get(o)
      const q = o.getWorldPosition(new T.Vector3()).project(cam)
      const px = (q.x * 0.5 + 0.5) * innerWidth, py = (-q.y * 0.5 + 0.5) * innerHeight
      let solSousLAncre = null, ecranAncre = null
      if (p) {
        const va = c._placer(p.x, c._sol(p.x, p.z), p.z)
        const qa = va.clone().project(cam)
        ecranAncre = [Math.round((qa.x * 0.5 + 0.5) * innerWidth), Math.round((-qa.y * 0.5 + 0.5) * innerHeight)]
        ndc.set((ecranAncre[0] / innerWidth) * 2 - 1, -(ecranAncre[1] / innerHeight) * 2 + 1)
        rc.setFromCamera(ndc, cam)
        const h = rc.intersectObjects(meshes, false)
        solSousLAncre = h.length ? (h[0].object.name || h[0].object.type) : null
      }
      return {
        i, type: o.type, ro: o.renderOrder,
        ponctuel: !!p,
        ancre: p ? [+p.x.toFixed(2), +p.z.toFixed(2)] : null,
        dansSocle: p ? c._dansSocle(p.x, p.z) : null,
        dansSocleVif: p ? dansSocleVif(p.x, p.z) : null,
        ecranSprite: [Math.round(px), Math.round(py)],
        ecranAncre, solSousLAncre,
      }
    }).filter(Boolean)
    return {
      enfants,
      nPonctuels: pon.length,
      vif, fige, uCentre, uDemi, formeFigee, formeVive,
      repereIdentique: !!(vif && fige && vif.cx === fige.cx && vif.cy === fige.cy && vif.demi === fige.demi),
      centreUniformeEgalVif: !!(vif && uCentre && Math.abs(uCentre.x - vif.cx) < 1e-12 && Math.abs(uCentre.y - vif.cy) < 1e-12 && Math.abs(uDemi - vif.demi) < 1e-12),
      nDesaccord: desaccord.length,
      nVisiblesHorsSocleVivant: fautives.length,
      exemples: fautives.slice(0, 6),
    }
  }
})

console.log('studio fermé :', await B.fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
for (let k = 0; k <= CRAN; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const s = await page.evaluate(() => window.__sonde())
  console.log(`  cran ${k}`)
  console.log(`     repère de crop  — poseur (FIGÉ) ${JSON.stringify(s.fige)}`)
  console.log(`                       globe  (VIF)  ${JSON.stringify(s.vif)}`)
  console.log(`                       uniforme partagé ${JSON.stringify(s.uCentre)} demi=${s.uDemi}`)
  console.log(`                       figé == vif ? ${s.repereIdentique}   ·   uniforme == vif ? ${s.centreUniformeEgalVif}`)
  console.log(`     forme de crop   — poseur ${JSON.stringify(s.formeFigee)} · globe ${JSON.stringify(s.formeVive)}`)
  console.log(`     ponctuels ${s.nPonctuels} · désaccord produit/socle vivant ${s.nDesaccord} · VISIBLES HORS DU SOCLE VIVANT ${s.nVisiblesHorsSocleVivant}`)
  if (s.exemples.length) console.log(`     exemples : ${JSON.stringify(s.exemples)}`)
  for (const en of s.enfants) console.log(`       #${en.i} ${en.type} ro=${en.ro} ponctuel=${en.ponctuel} ancre=${JSON.stringify(en.ancre)} dansSocle=${en.dansSocle} vif=${en.dansSocleVif} sprite@${JSON.stringify(en.ecranSprite)} ancre@${JSON.stringify(en.ecranAncre)} solSousLAncre=${en.solSousLAncre}`)
}
await B.nav.close()
