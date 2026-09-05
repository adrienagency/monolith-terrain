// GX6 — LES PIXELS « HORS SOCLE » DU BANC DU NOTEUR SONT-ILS VRAIMENT DEHORS ?
//
// Le banc de GX3 (`banc-gx3-horscrop.mjs`) projette les QUATRE COINS du bloc et
// compte les pixels de tracé hors de ce QUADRILATÈRE. Sur une sphère, le bord
// du socle n'est pas un segment : c'est un ARC. La corde passe sous l'arc, et
// tout ce qui est dessiné entre les deux est compté dehors alors qu'il est sur
// le socle. Ce banc ne discute pas : il CROISE les deux mesures, pixel par
// pixel, sur le MÊME masque —
//   · dedans/dehors du polygone de GX3 ;
//   · un rayon de la caméra du globe : premier maillage frappé, tuile DU SOCLE
//     (`tuileDansCrop`), tuile hors socle, ou rien ;
//   · pour ceux qui ne frappent rien, un second rayon décalé d'un demi-pixel
//     vers l'intérieur : un pixel de SILHOUETTE (le rayon passe à côté du bord
//     du maillage) redevient un pixel du socle, un vrai pixel du vide non.
// Sortie : le tableau croisé. « HORS polygone ET sur le socle » est la mesure
// de l'erreur du polygone ; « hors socle par rayon » est le vrai débordement.
// EMPLOI : node scripts/banc-gx6-bord.mjs [--port 10441] [--etiquette mb] [--crans 2]
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
  window.__croise = () => {
    const c = window.__c(), cam = window.__cam(), dem = e.terrain.dem, g = e.globe, rep = g._crop
    const demi = demSpan(dem) / 2, W = innerWidth, H = innerHeight
    const coins = [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]]
    const poly = coins.map(([x, z]) => { const y = c._sol(x, z); const v = c._placer(x, y, z); const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H] })
    const dedansPoly = (px, py) => { let ok = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok } return ok }
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const { tuileDansCrop } = window.__crop
    const dansSocle = (nom) => { if (/^crop-/.test(nom)) return true; const m = nom.match(/^(\d+)\/(\d+)\/(\d+)/); if (!m || !rep) return false; return tuileDansCrop(+m[1], +m[2], +m[3], rep) }
    const rc = new T.Raycaster(), ndc = new T.Vector2()
    // le centre de l'écran sert de « vers l'intérieur » pour le second rayon
    const tir = (px, py) => {
      ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1)
      rc.setFromCamera(ndc, cam)
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      const h = rc.intersectObjects(cand, false)
      return h.length ? h[0].object.name : null
    }
    const M = window.__dernierMasque
    const t = { dansPoly_socle: 0, dansPoly_hors: 0, dansPoly_rien: 0, horsPoly_socle: 0, horsPoly_hors: 0, horsPoly_rien: 0 }
    let rienRattrapes = 0
    const exHorsSocle = [], exRien = []
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!M.m[y * M.w + x]) continue
      const px = x / M.s, py = y / M.s
      const dp = dedansPoly(px, py)
      let nom = tir(px, py)
      let cat
      if (nom == null) {
        // pixel de silhouette ? on retire d'un demi-pixel vers le centre
        const dx = W / 2 - px, dy = H / 2 - py, d = Math.hypot(dx, dy) || 1
        const n2 = tir(px + 0.5 * dx / d, py + 0.5 * dy / d)
        if (n2 != null && dansSocle(n2)) { cat = 'socle'; rienRattrapes++ } else { cat = 'rien'; if (exRien.length < 8) exRien.push({ x: Math.round(px), y: Math.round(py) }) }
      } else cat = dansSocle(nom) ? 'socle' : 'hors'
      if (cat === 'hors' && exHorsSocle.length < 8) exHorsSocle.push({ x: Math.round(px), y: Math.round(py), hit: nom })
      t[(dp ? 'dansPoly_' : 'horsPoly_') + cat]++
    }
    return { poly: poly.map((p) => p.map(Math.round)), ...t, rienRattrapes, exHorsSocle, exRien, extentM: dem.extentMeters, alt: e.altitudeCadrageM?.() }
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
  const r = await releve(`${ETIQ}-gx6-bord-z${k}`, { image: true })
  const c = await page.evaluate(() => window.__croise())
  R.crans.push({ k, ...r, ...c })
  const horsPoly = c.horsPoly_socle + c.horsPoly_hors + c.horsPoly_rien
  console.log(`  cran ${k}  alt=${Math.round(c.alt)} m  emprise=${Math.round(c.extentM / 1000)} km  tracé=${r.pixels} px (bruit ${r.bruit})`)
  console.log(`     polygone GX3 : HORS ${horsPoly} px`)
  console.log(`     dont, au RAYON : sur le socle ${c.horsPoly_socle} · hors socle ${c.horsPoly_hors} · dans le vide ${c.horsPoly_rien}`)
  console.log(`     total au rayon : socle ${c.dansPoly_socle + c.horsPoly_socle} · HORS SOCLE ${c.dansPoly_hors + c.horsPoly_hors} · vide ${c.dansPoly_rien + c.horsPoly_rien} (dont ${c.rienRattrapes} pixels de silhouette rattrapés à un demi-pixel)`)
  if (c.exHorsSocle.length) console.log(`     ex. hors socle : ${JSON.stringify(c.exHorsSocle)}`)
  if (c.exRien.length) console.log(`     ex. vide : ${JSON.stringify(c.exRien)}`)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx6-bord.json`), JSON.stringify(R, null, 1))
await B.nav.close()
