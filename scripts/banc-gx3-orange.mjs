// GX3 — QU'EST-CE QUI DESSINE LE TRACÉ HORS DU CROP ? Au z13 sur le pire point,
// une ligne orange court sur la planète hors du socle et NE DISPARAÎT PAS quand
// le groupe GPX s'éteint. On lance un rayon depuis la caméra à travers ses
// pixels et on nomme l'objet touché ; puis on éteint les candidats un à un.
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap } = B
await B.chargerGpx('.banc/marathon-mont-blanc-90km.gpx'); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
await page.evaluate(() => window.__exp.modes.flyTo(46.06609, 6.93976, 13)).catch(() => {})
for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
await B.attendreDrapage(10); await B.attendreRepos({ maxMs: 90000 })
const a = await snap()
// pixels orange vif dans la zone, en excluant l'empreinte du crop (approx : on garde ceux sous y>860 ou x>1150)
const oranges = await page.evaluate(async (u) => {
  const im = await window.__lire(u); const out = []
  for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x += 3) { const i = (y * im.w + x) * 4; const r = im.d[i], g = im.d[i + 1], b = im.d[i + 2]; if (r > 190 && g > 70 && g < 160 && b < 90 && (y > 860 || x > 1180)) out.push([x, y]) }
  return out
}, a)
console.log('pixels orange hors crop (échantillon) :', oranges.length, oranges.slice(0, 6))
const hits = await page.evaluate((pts) => {
  const e = window.__exp, T = e.THREE, cam = window.__cam()
  const rc = new T.Raycaster()
  const objets = []; e.sceneGlobe.traverse((o) => { if ((o.isMesh || o.isLine || o.isLineSegments || o.isPoints || o.isSprite) && o.visible) objets.push(o) })
  const res = []
  for (const [x, y] of pts.slice(0, 40).filter((_, k) => k % 5 === 0)) {
    rc.setFromCamera(new T.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), cam)
    const h = rc.intersectObjects(objets, false).slice(0, 4).map((hh) => { let p = hh.object, chaine = []; while (p) { chaine.push(p.name || p.type); p = p.parent } return { d: +hh.distance.toFixed(3), chaine: chaine.join('<'), mat: hh.object.material?.type } })
    res.push({ x, y, h })
  }
  return res
}, oranges)
console.log(JSON.stringify(hits, null, 1).slice(0, 4000))
// éteindre des candidats un à un et compter les pixels orange restants dans la même zone
const compte = async () => page.evaluate(async (u) => { const im = await window.__lire(u); let n = 0; for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x += 3) { const i = (y * im.w + x) * 4; const r = im.d[i], g = im.d[i + 1], b = im.d[i + 2]; if (r > 190 && g > 70 && g < 160 && b < 90 && (y > 860 || x > 1180)) n++ } return n }, await snap())
console.log('orange, tout allumé :', await compte())
for (const cand of ['gpx', 'mapLayers', 'cotes', 'cartouche', 'nuages', 'reperes', 'hud3', 'traffic', 'plinth', 'realWater', 'labels', 'peaksLayer']) {
  const ok = await page.evaluate((c) => { const e = window.__exp; const o = c === 'gpx' ? window.__c().group : c === 'mapLayers' ? e.mapLayers?.group ?? e.mapLayers?.root : c === 'hud3' ? e.hud3?.group : e[c]?.group ?? e[c]?.mesh ?? e[c]; if (!o || o.visible == null) return null; o.visible = false; return true }, cand)
  if (!ok) { console.log(`  ${cand} : pas d'objet visible trouvé`); continue }
  await tourner(3); const n = await compte()
  await page.evaluate((c) => { const e = window.__exp; const o = c === 'gpx' ? window.__c().group : c === 'mapLayers' ? e.mapLayers?.group ?? e.mapLayers?.root : c === 'hud3' ? e.hud3?.group : e[c]?.group ?? e[c]?.mesh ?? e[c]; o.visible = true }, cand); await tourner(3)
  console.log(`  ${cand} éteint : orange restant ${n}`)
}
// tous les enfants directs de sceneGlobe, un à un
const enfants = await page.evaluate(() => window.__exp.sceneGlobe.children.map((c, i) => ({ i, n: c.name || c.type, vis: c.visible })))
for (const en of enfants) {
  if (!en.vis) continue
  await page.evaluate((i) => { window.__exp.sceneGlobe.children[i].visible = false }, en.i); await tourner(3); const n = await compte()
  await page.evaluate((i) => { window.__exp.sceneGlobe.children[i].visible = true }, en.i); await tourner(3)
  console.log(`  sceneGlobe[${en.i}] ${en.n} éteint : orange restant ${n}`)
}
B.ecris('orange-z13', a)
await B.nav.close()
