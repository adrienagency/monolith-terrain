// GX5 — QUI DÉBORDE DU SOCLE ? Le banc du noteur compte des pixels de CALQUE ;
// il ne dit pas quel objet du calque les pose. Ici, à z13, on éteint les enfants
// du groupe UN PAR UN et on recompte, pour attribuer chaque pixel hors socle à
// son objet. Le rayon (caméra → premier maillage de tuile/crop) sert d'arbitre :
// « dans le vide » = le rayon ne touche rien.
// EMPLOI : node scripts/banc-gx5-qui-deborde.mjs [--port 10433] [--crans 2]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const CRANS = +opt('--crans', '2')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()
await page.evaluate(async () => {
  const e = window.__exp, T = e.THREE
  window.__crop = await import('/src/monde/crop-sphere.js')
  window.__rayons = () => {
    const g = e.globe, cam = window.__cam(), rep = g._crop
    const M = window.__dernierMasque
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const { tuileDansCrop } = window.__crop
    const dansSocle = (nom) => { if (/^crop-/.test(nom)) return true; const m = nom.match(/^(\d+)\/(\d+)\/(\d+)/); if (!m || !rep) return false; return tuileDansCrop(+m[1], +m[2], +m[3], rep) }
    const rc = new T.Raycaster(); const ndc = new T.Vector2()
    let surSocle = 0, horsSocle = 0, rien = 0, testes = 0
    const ex = []
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!M.m[y * M.w + x]) continue
      testes++
      ndc.set(((x / M.s) / innerWidth) * 2 - 1, -((y / M.s) / innerHeight) * 2 + 1)
      rc.setFromCamera(ndc, cam)
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      const hits = rc.intersectObjects(cand, false)
      if (!hits.length) { rien++; if (ex.length < 8) ex.push({ x: Math.round(x / M.s), y: Math.round(y / M.s) }); continue }
      if (dansSocle(hits[0].object.name)) surSocle++; else { horsSocle++; if (ex.length < 8) ex.push({ x: Math.round(x / M.s), y: Math.round(y / M.s), hit: hits[0].object.name }) }
    }
    return { testes, surSocle, horsSocle, rien, ex }
  }
  // le masque d'UN SEUL enfant : on l'éteint, on diffère, on le rallume
  window.__enfants = () => window.__c().group.children.map((o, i) => ({ i, type: o.type, nom: o.name || '', vis: o.visible }))
})
console.log('studio fermé :', await B.fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
for (let k = CRANS; k <= CRANS; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const r = await releve(`gx5-qui-deborde-z${k}`, { image: true })
  const ry = await page.evaluate(() => window.__rayons())
  console.log(`  cran ${k} · GROUPE ENTIER  tracé=${r.pixels} px  bruit=${r.bruit}  →  sur socle ${ry.surSocle} · hors socle ${ry.horsSocle} · DANS LE VIDE ${ry.rien}  ex=${JSON.stringify(ry.ex)}`)
  const enfants = await page.evaluate(() => window.__enfants())
  console.log('  enfants :', JSON.stringify(enfants))
  for (const en of enfants) {
    if (!en.vis) continue
    const d = await page.evaluate(async (i) => {
      const c = window.__c()
      const o = c.group.children[i]
      const snapA = null
      return { i, nom: o.name || o.type }
    }, en.i)
    // A = tout allumé ; B = cet enfant éteint
    await tourner(2); const a = await B.snap()
    await page.evaluate((i) => { window.__c().group.children[i].visible = false }, en.i)
    await tourner(2); const b = await B.snap()
    await page.evaluate((i) => { window.__c().group.children[i].visible = true }, en.i)
    await tourner(2)
    const diff = await page.evaluate((x, y) => window.__diff(x, y), a, b)
    if (diff.pixels < 5) { console.log(`    · ${d.nom} (${en.i}) : ${diff.pixels} px`); continue }
    const ry2 = await page.evaluate(() => window.__rayons())
    console.log(`    · ${d.nom} (${en.i}) : ${diff.pixels} px  →  sur socle ${ry2.surSocle} · hors socle ${ry2.horsSocle} · DANS LE VIDE ${ry2.rien}  ex=${JSON.stringify(ry2.ex.slice(0, 3))}`)
  }
}
await B.nav.close()
