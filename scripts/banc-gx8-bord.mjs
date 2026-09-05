// GX8 — LE « 0 PX HORS SOCLE » DU NOTEUR : ce que son polygone mesure vraiment.
//
// `banc-gx3-horscrop.mjs` projette LES QUATRE COINS du socle et compte les
// pixels de tracé hors du quadrilatère obtenu. On ne le réécrit pas — on le
// recopie à l'identique (`dedans()` ci-dessous est son code, au caractère) et
// on lui pose DEUX questions qu'il ne se pose pas :
//
//   ① LE SOCLE LUI-MÊME TIENT-IL DANS SON PROPRE POLYGONE ? On échantillonne
//      la SURFACE DESSINÉE du socle (grille sur le rectangle de crop, hauteur
//      lue par `c._sol`, c'est-à-dire `hauteurMaillee` sur les tuiles allumées)
//      et on compte les points de CETTE surface qui tombent hors du polygone.
//      Un quadrilatère plat passant par quatre coins ne peut pas contenir un
//      relief de 3 000 m : si le socle déborde de son propre polygone, alors
//      « pixels hors polygone » ≠ « pixels hors socle », et le seuil « 0 » est
//      inatteignable par construction, tracé parfait compris.
//
//   ② LES PIXELS QUI RESTENT, C'EST QUOI ? Chaque pixel de tracé hors polygone
//      reçoit un rayon depuis la caméra du globe : on nomme le premier maillage
//      touché (tuile `z/x/y` du socle, pièce `crop-*`, tuile hors socle, ou
//      rien), puis, pour ceux qui ne touchent RIEN, un second rayon sur les
//      enfants du groupe GPX pour nommer la pièce du tracé qui les pose.
//
// Même régime et même descente que le noteur : studio fermé, `modes.flyTo`
// z11 → z12 → z13, huit quarts de tour, attente de drapage et de repos.
// AUCUN EFFET SUR LE PRODUIT : ce banc lit, il n'écrit pas.
// EMPLOI : node scripts/banc-gx8-bord.mjs [--port 10471] [--etiquette gx8] [--crans 2] [--grille 96]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'gx8')
const CRANS = +opt('--crans', '2')
const GRILLE = +opt('--grille', '96')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()

await page.evaluate(async () => {
  const e = window.__exp, T = e.THREE
  const { demSpan } = window.__geo
  window.__crop = await import('/src/monde/crop-sphere.js')

  // ── le polygone du noteur, recopié au caractère depuis banc-gx3-horscrop.mjs
  window.__poly = () => {
    const c = window.__c(), cam = window.__cam(), dem = e.terrain.dem
    const demi = demSpan(dem) / 2, W = innerWidth, H = innerHeight
    const coins = [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]]
    const poly = coins.map(([x, z]) => { const y = c._sol(x, z); const v = c._placer(x, y, z); const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H] })
    return { poly, demi, W, H }
  }
  window.__dedans = (poly, px, py) => { let ok = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok } return ok }

  // ── ① la SURFACE DESSINÉE du socle, échantillonnée, contre ce même polygone
  window.__socleDansSonPolygone = (N) => {
    const c = window.__c(), cam = window.__cam()
    const { poly, demi, W, H } = window.__poly()
    let aEcran = 0, dedans = 0, hors = 0, pireDx = 0
    const ex = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -demi + (2 * demi * i) / (N - 1), z = -demi + (2 * demi * j) / (N - 1)
      const y = c._sol(x, z)
      const q = c._placer(x, y, z).project(cam)
      if (q.z > 1) continue // derrière la caméra
      const px = (q.x * 0.5 + 0.5) * W, py = (-q.y * 0.5 + 0.5) * H
      if (px < 0 || px >= W || py < 0 || py >= H) continue
      aEcran++
      if (window.__dedans(poly, px, py)) dedans++
      else {
        hors++
        // de combien il rate le bord haut du polygone (le cas de la crête)
        const dy = Math.min(...poly.map((p) => py - p[1]))
        if (dy < pireDx) pireDx = dy
        if (ex.length < 6) ex.push({ px: Math.round(px), py: Math.round(py), solM: Math.round(c._solM ? c._solM(x, z) : 0) })
      }
    }
    return { N, aEcran, dedans, hors, pct: +(100 * hors / Math.max(1, aEcran)).toFixed(1), auDessusDuBordHautDe: Math.round(-pireDx), poly: poly.map((p) => p.map(Math.round)), ex }
  }

  // ── ② les pixels de tracé hors polygone, nommés au rayon
  window.__nommerHors = () => {
    const g = e.globe, c = window.__c(), cam = window.__cam(), rep = g._crop
    const M = window.__dernierMasque
    const { poly } = window.__poly()
    const meshes = []
    g.group.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position && (/^\d+\/\d+\/\d+/.test(o.name || '') || /^crop-/.test(o.name || ''))) meshes.push(o) })
    for (const m of meshes) { m.geometry.computeBoundingSphere?.(); m.updateWorldMatrix(true, false) }
    const { tuileDansCrop } = window.__crop
    const dansSocle = (nom) => { if (/^crop-/.test(nom)) return true; const m = nom.match(/^(\d+)\/(\d+)\/(\d+)/); if (!m || !rep) return false; return tuileDansCrop(+m[1], +m[2], +m[3], rep) }
    const rc = new T.Raycaster(); const ndc = new T.Vector2()
    const compte = { horsPolygone: 0, surSocle: 0, surCrop: 0, tuileHorsSocle: 0, rien: 0 }
    const parPiece = {}, tuilesHors = {}
    const exVide = []
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!M.m[y * M.w + x]) continue
      const px = x / M.s, py = y / M.s
      if (window.__dedans(poly, px, py)) continue
      compte.horsPolygone++
      ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1)
      rc.setFromCamera(ndc, cam)
      const cand = meshes.filter((m) => { const bs = m.geometry.boundingSphere; if (!bs) return true; const cw = bs.center.clone().applyMatrix4(m.matrixWorld); const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis(); return rc.ray.distanceSqToPoint(cw) <= r * r })
      const hits = rc.intersectObjects(cand, false)
      if (hits.length) {
        const nom = hits[0].object.name || ''
        if (/^crop-/.test(nom)) compte.surCrop++
        else if (dansSocle(nom)) compte.surSocle++
        else { compte.tuileHorsSocle++; tuilesHors[nom] = (tuilesHors[nom] || 0) + 1 }
        continue
      }
      compte.rien++
      // qui pose ce pixel, dans le groupe GPX ?
      const h2 = rc.intersectObjects(c.group.children, true)
      const nom2 = h2.length ? (h2[0].object.name || h2[0].object.type) : '(aucun)'
      parPiece[nom2] = (parPiece[nom2] || 0) + 1
      if (exVide.length < 8) exVide.push({ x: Math.round(px), y: Math.round(py), piece: nom2 })
    }
    return { ...compte, parPiece, tuilesHors, exVide }
  }
})

console.log('studio fermé :', await B.fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
const R = { etiquette: ETIQ, centre, crans: [] }
for (let k = 0; k <= CRANS; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const r = await releve(`${ETIQ}-bord-z${k}`, { image: true })
  const s = await page.evaluate((n) => window.__socleDansSonPolygone(n), GRILLE)
  const n = await page.evaluate(() => window.__nommerHors())
  R.crans.push({ k, pixels: r.pixels, bruit: r.bruit, socle: s, tracé: n })
  console.log(`  cran ${k}  tracé=${r.pixels} px (bruit ${r.bruit})`)
  console.log(`     ① LE SOCLE DANS SON PROPRE POLYGONE : ${s.aEcran} points de la SURFACE DESSINÉE à l'écran → dedans ${s.dedans} · HORS ${s.hors} (${s.pct} %) ; jusqu'à ${s.auDessusDuBordHautDe} px au-dessus du plus haut sommet du polygone`)
  console.log(`     ② LES PIXELS DE TRACÉ HORS POLYGONE (${n.horsPolygone}) : sur une tuile DU SOCLE ${n.surSocle} · sur une pièce crop-* ${n.surCrop} · sur une tuile HORS socle ${n.tuileHorsSocle} · ne touchant rien ${n.rien}`)
  console.log(`        pièces du tracé sur les pixels « rien » : ${JSON.stringify(n.parPiece)}`)
  if (n.tuileHorsSocle) console.log(`        ⛔ tuiles hors socle touchées : ${JSON.stringify(n.tuilesHors)}`)
  if (n.exVide.length) console.log(`        exemples : ${JSON.stringify(n.exVide.slice(0, 4))}`)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-bord.json`), JSON.stringify(R, null, 1))
await B.nav.close()
