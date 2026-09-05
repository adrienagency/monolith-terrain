// GX4 — LE TRACÉ HORS DU SOCLE, MESURÉ AU RAYON. Le banc de GX3
// (`banc-gx3-horscrop.mjs`) projette les quatre coins du socle et compte les
// pixels de tracé hors du polygone : juste en plaine, faux en montagne — un
// ruban posé sur une crête de 3 000 m au bord d'un socle dont les coins sont à
// 1 500 m se projette HORS du polygone, à des dizaines de pixels, tout en étant
// dessiné sur une tuile du socle (le cran 0 de GX3 rend même « 100 % dehors »
// quand deux coins passent derrière la caméra). Ici, pour chaque pixel du
// masque de tracé, un rayon part de la caméra du globe et frappe le premier
// maillage visible : une tuile DU SOCLE (`tuileDansCrop`) ou une pièce du crop
// (`crop-*`) → le pixel est SUR le socle ; une tuile hors socle, ou rien → il
// est dans le vide. Même régime et même descente que GX3 (studio fermé,
// `modes.flyTo` z11 → z12 → z13). Le polygone de GX3 est compté à côté.
// EMPLOI : node scripts/banc-gx4-horscrop.mjs [--port 10411] [--gpx x] [--etiquette mb] [--crans 2]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const CRANS = +opt('--crans', '2')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()

await page.evaluate(async () => {
  const e = window.__exp, T = e.THREE
  const { demSpan } = window.__geo
  window.__crop = await import('/src/monde/crop-sphere.js')
  // le polygone de GX3, tel quel
  window.__empreinte = () => {
    const c = window.__c(), cam = window.__cam(), dem = e.terrain.dem
    const demi = demSpan(dem) / 2, W = innerWidth, H = innerHeight
    const coins = [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]]
    const poly = coins.map(([x, z]) => { const y = c._sol(x, z); const v = c._placer(x, y, z); const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H] })
    const dedans = (px, py) => { let ok = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok } return ok }
    const M = window.__dernierMasque
    let hors = 0, dans = 0
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.m[y * M.w + x]) { if (dedans(x / M.s, y / M.s)) dans++; else hors++ }
    const w = c.track.world
    let nHors = 0; for (const p of w) if (Math.abs(p.x) >= demi || Math.abs(p.z) >= demi) nHors++
    return { poly: poly.map((p) => p.map(Math.round)), dans, hors, nSommetsHors: nHors, nSommets: w.length, demi, extentM: dem.extentMeters, alt: e.altitudeCadrageM?.() }
  }
  // LE RAYON PAR PIXEL. `pas` : un pixel sur `pas` du masque (le masque compte
  // des milliers de pixels ; le rayon coûte ~0,2 ms).
  window.__rayons = (pas = 1) => {
    const g = e.globe, cam = window.__cam(), rep = g._crop
    const M = window.__dernierMasque
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const { tuileDansCrop } = window.__crop
    const dansSocle = (nom) => {
      if (/^crop-/.test(nom)) return true
      const m = nom.match(/^(\d+)\/(\d+)\/(\d+)/); if (!m || !rep) return false
      return tuileDansCrop(+m[1], +m[2], +m[3], rep)
    }
    const rc = new T.Raycaster()
    const ndc = new T.Vector2()
    let surSocle = 0, horsSocle = 0, rien = 0, testes = 0
    const exemples = []
    for (let y = 0; y < M.h; y += pas) for (let x = 0; x < M.w; x += pas) {
      if (!M.m[y * M.w + x]) continue
      testes++
      ndc.set(((x / M.s) / innerWidth) * 2 - 1, -((y / M.s) / innerHeight) * 2 + 1)
      rc.setFromCamera(ndc, cam)
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      const hits = rc.intersectObjects(cand, false)
      if (!hits.length) { rien++; if (exemples.length < 6) exemples.push({ x: Math.round(x / M.s), y: Math.round(y / M.s), hit: null }); continue }
      const h = hits[0]
      if (dansSocle(h.object.name)) surSocle++
      else { horsSocle++; if (exemples.length < 6) exemples.push({ x: Math.round(x / M.s), y: Math.round(y / M.s), hit: h.object.name }) }
    }
    return { testes, surSocle, horsSocle, rien, meshes: meshes.length, exemples }
  }
})
console.log('studio fermé :', await B.fermerStudio()); await B.attendreDrapage(6); await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
const R = { etiquette: ETIQ, centre, crans: [] }
for (let k = 0; k <= CRANS; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const r = await releve(`${ETIQ}-gx4-horscrop-z${k}`, { image: true })
  const em = await page.evaluate(() => window.__empreinte())
  const ry = await page.evaluate(() => window.__rayons(1))
  R.crans.push({ k, ...r, polygone: em, rayons: ry })
  console.log(`  cran ${k}  alt=${Math.round(em.alt)} m  emprise=${Math.round(em.extentM / 1000)} km  tracé=${r.pixels} px (bruit ${r.bruit})  sommets hors bloc ${em.nSommetsHors}/${em.nSommets}\n     polygone GX3 : DANS ${em.dans} · HORS ${em.hors}\n     RAYONS       : sur le socle ${ry.surSocle} · HORS DU SOCLE ${ry.horsSocle} · dans le vide ${ry.rien} (${ry.testes} pixels, ${ry.meshes} maillages)  ex=${JSON.stringify(ry.exemples)}`)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx4-horscrop.json`), JSON.stringify(R, null, 1))
await B.nav.close()
