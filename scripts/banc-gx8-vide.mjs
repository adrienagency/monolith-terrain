// GX8 — LES PIXELS DE TRACÉ QUI NE TOUCHENT AUCUN SOCLE : qui les pose ?
//
// `banc-gx8-bord.mjs` isole, au cran z13, ~96 pixels de tracé qu'aucun rayon
// ne rattache à une tuile du socle ni à une pièce `crop-*`. Il les nomme au
// rayon — et c'est FAUX : `Raycaster` de three.js ignore `object.visible`, il
// désigne donc volontiers un marqueur de village éteint. On attribue ici PAR
// DIFFÉRENCE, la seule méthode que le noteur accepte : on éteint un enfant du
// groupe GPX, on recompte, et on regarde combien des pixels visés disparaissent.
//
// AUCUN EFFET SUR LE PRODUIT : le banc rallume tout ce qu'il éteint et
// vérifie le retour au compte d'origine.
// EMPLOI : node scripts/banc-gx8-vide.mjs [--port 10471] [--cran 2]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const CRAN = +opt('--cran', '2')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()

await page.evaluate(async () => {
  const e = window.__exp, T = e.THREE
  const { demSpan } = window.__geo
  window.__crop = await import('/src/monde/crop-sphere.js')
  window.__poly = () => {
    const c = window.__c(), cam = window.__cam(), dem = e.terrain.dem
    const demi = demSpan(dem) / 2, W = innerWidth, H = innerHeight
    const coins = [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]]
    return { poly: coins.map(([x, z]) => { const y = c._sol(x, z); const v = c._placer(x, y, z); const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H] }), W, H }
  }
  window.__dedans = (poly, px, py) => { let ok = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok } return ok }
  // les pixels VISÉS : dans le masque courant, hors polygone, sans tuile derrière
  window.__cibles = () => {
    const g = e.globe, cam = window.__cam(), rep = g._crop, M = window.__dernierMasque
    const { poly } = window.__poly()
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const rc = new T.Raycaster(); const ndc = new T.Vector2()
    const cibles = []
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!M.m[y * M.w + x]) continue
      const px = x / M.s, py = y / M.s
      if (window.__dedans(poly, px, py)) continue
      ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1)
      rc.setFromCamera(ndc, cam)
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      if (rc.intersectObjects(cand, false).length) continue
      cibles.push([x, y])
    }
    window.__ciblesSet = new Set(cibles.map(([x, y]) => y * M.w + x))
    const xs = cibles.map((c) => c[0] / M.s), ys = cibles.map((c) => c[1] / M.s)
    return { n: cibles.length, boite: cibles.length ? [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))] : null }
  }
  // combien des pixels visés sont ENCORE allumés dans le masque courant
  window.__restants = () => { const M = window.__dernierMasque; let n = 0; for (const k of window.__ciblesSet) if (M.m[k]) n++; return n }
  window.__enfantsVisibles = () => window.__c().group.children.map((o, i) => ({ i, type: o.type, nom: o.name || '', vis: !!o.visible, ro: o.renderOrder })).filter((o) => o.vis)
})

console.log('studio fermé :', await B.fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + CRAN }).catch(() => {})
for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
await B.attendreDrapage(12)
await attendreRepos({ maxMs: 90000 })

const r0 = await releve(`gx8-vide-z${CRAN}`, { image: true })
const cib = await page.evaluate(() => window.__cibles())
console.log(`  cran ${CRAN} · tracé ${r0.pixels} px (bruit ${r0.bruit}) · PIXELS VISÉS (hors polygone ET sans tuile derrière) : ${cib.n}  boîte=${JSON.stringify(cib.boite)}`)
const enfants = await page.evaluate(() => window.__enfantsVisibles())
console.log(`  enfants visibles du groupe GPX : ${JSON.stringify(enfants)}`)
if (!cib.n) { await B.nav.close(); process.exit(0) }

for (const en of enfants) {
  await page.evaluate((i) => { window.__c().group.children[i].visible = false }, en.i)
  await dodo(400)
  const r = await releve(`gx8-vide-sans-${en.i}`, {})
  const rest = await page.evaluate(() => window.__restants())
  await page.evaluate((i) => { window.__c().group.children[i].visible = true }, en.i)
  await dodo(400)
  console.log(`    · éteint #${en.i} ${en.type} ${en.nom || ''} (ro ${en.ro}) → tracé ${r.pixels} px ; pixels visés restants ${rest}/${cib.n}${rest < cib.n ? '   ⬅ C EST LUI' : ''}`)
}
const rFin = await releve(`gx8-vide-restaure`, {})
console.log(`  restauré : tracé ${rFin.pixels} px (départ ${r0.pixels})`)
await B.nav.close()
