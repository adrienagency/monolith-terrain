// GX3 — LE TRACÉ AU REPOS, dans les DEUX régimes qu'Adrien voit, puis à quatre
// échelles. Pixels par différence, témoin A/A, pixels attendus par la géométrie
// (longueur écran × largeur ruban), sommets retrouvés.
//
// Régime A : le Race Studio est OUVERT (c'est l'état d'arrivée après « Load
//            GPX… » : aperçu isométrique du bloc, toile 836 px de large).
// Régime B : le Studio est FERMÉ par sa croix (la carte plein écran).
// ⚠️ Les deux ne cadrent pas pareil (26 484 m contre ~6 900 m, mesuré) : GX1 et
// GX2 ont noté le régime A ; Adrien lit le tracé dans le B.
//
// EMPLOI : node scripts/banc-gx3-repos.mjs --gpx x --etiquette x [--adresse terre=deux]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))

await page.evaluate(() => {
  const e = window.__exp
  // ce que la géométrie prédit à l'écran : longueur projetée du tracé × largeur
  // du ruban en pixels, avec la caméra QUI DESSINE et les sommets DE LA SCÈNE.
  window.__geom = (n = 48) => {
    const T = e.THREE, c = window.__c(), cam = window.__cam(), t = c.track
    const W = innerWidth, H = innerHeight, z = window.__zone()
    const pts = c._worldScene ?? t.world
    let L = 0, prec = null, dedans = 0
    const ech = []
    for (let k = 0; k < n; k++) {
      const i = Math.round((k / (n - 1)) * (pts.length - 1))
      const v = new T.Vector3(pts[i].x, pts[i].y, pts[i].z)
      const q = v.clone().project(cam)
      const px = (q.x * 0.5 + 0.5) * W, py = (-q.y * 0.5 + 0.5) * H
      const ok = px >= z.x0 && px < z.x1 && py >= z.y0 && py < z.y1 && q.z > -1 && q.z < 1
      if (ok) dedans++
      if (prec && prec.ok && ok) L += Math.hypot(px - prec.px, py - prec.py)
      prec = { px, py, ok }
      ech.push({ i, px, py, ok, dist: cam.position.distanceTo(v) })
    }
    const mid = ech[ech.length >> 1]
    const demiU = (e.params.gpxWidth ?? 3) * 0.022 * (c._k ?? 1)
    const hU = 2 * Math.tan((cam.fov * Math.PI / 180) / 2) * mid.dist
    const largeurPx = 2 * demiU * (H / hU)
    const play = document.querySelector('.cb-play'); const pr = play?.getBoundingClientRect()
    return { longueurPx: L, largeurPx, attendus: L * largeurPx, dedans, n, ech, alt: e.altitudeCadrageM?.(), k: c._k, mode: e.modes.mode, demZoom: e.params.demZoom, extentM: e.terrain?.dem?.extentMeters, cbPlay: pr ? [Math.round(pr.x), Math.round(pr.y), Math.round(pr.width), Math.round(pr.height)] : null, zone: z }
  }
})

const R = { etiquette: ETIQ, adresse: opt('--adresse', ''), regimes: [] }
async function mesure(nom, repeats) {
  const rp = await attendreRepos()
  const vals = [], bruits = []
  let dernier = null
  for (let k = 0; k < repeats; k++) { dernier = await releve(`${ETIQ}-${nom}`, { image: k === 0 }); vals.push(dernier.pixels); bruits.push(dernier.bruit) }
  const g = await page.evaluate(() => window.__geom(48))
  const ecarts = await page.evaluate((ech) => ech.filter((x) => x.ok).map((x) => window.__plusProche(x.px, x.py, 40)), g.ech)
  const trouves = ecarts.filter((d) => d != null)
  // la médiane des relevés dont le témoin vaut 0 — un relevé au témoin non nul mesure un raffinement, pas le tracé
  const propres = vals.filter((_, i) => bruits[i] === 0)
  const c = { nom, repos: rp, pixels: vals, bruit: bruits, mediane: med(propres.length ? propres : vals), attendus: Math.round(g.attendus), longueurPx: Math.round(g.longueurPx), largeurPx: +g.largeurPx.toFixed(2), alt: Math.round(g.alt), demZoom: g.demZoom, extentM: Math.round(g.extentM), k: g.k, dedans: g.dedans, surEcran: ecarts.length, retrouves: trouves.length, medEcart: med(trouves), boite: dernier.boite, cbPlay: g.cbPlay, zone: g.zone }
  R.regimes.push(c)
  console.log(`  ${nom}  alt=${c.alt} m z${g.demZoom}  tracé=${vals.join(' ')}  méd ${c.mediane}  bruit=${bruits.join(' ')}  attendus=${c.attendus} (${c.longueurPx} px × ${c.largeurPx} px)  ratio=${(100 * c.mediane / g.attendus).toFixed(0)} %  sommets ${trouves.length}/${ecarts.length} (méd ${med(trouves)?.toFixed(1)} px)  cbPlay=${JSON.stringify(g.cbPlay)}  zone=${JSON.stringify(g.zone)}`)
}
await mesure('A-studio', 8)
console.log('fermeture du studio :', await fermerStudio())
await B.attendreDrapage(6)
await mesure('B-carte', 8)
for (let cran = 1; cran < 4; cran++) {
  await page.evaluate(() => window.__exp.modes.cranZoom?.(1))
  for (let i = 0; i < 6; i++) { await tourner(90); await dodo(1200) }
  await B.attendreDrapage(12)
  await mesure(`B-z${cran}`, 4)
}
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-repos.json`), JSON.stringify(R, null, 1))
await B.nav.close()
