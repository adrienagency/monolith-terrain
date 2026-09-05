// GX3 — LE COÛT : appels de dessin, triangles, mémoire GPU (renderer.info) et
// durée d'une image (la boucle de l'application, mesurée autour de ses rappels
// rAF), tracé allumé / éteint / rallumé, au même cadrage (régime B). Requêtes
// réseau comptées par `performance.getEntriesByType('resource')`.
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner } = B
await B.chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx')); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
await page.evaluate(() => {
  const e = window.__exp
  // on mesure la durée des rappels rAF de l'application : on enveloppe la file
  const vrai = window.requestAnimationFrame
  window.__durees = []
  window.__mesure = (n) => new Promise((res) => {
    const d = []
    let reste = n
    const tour = () => {
      const t0 = performance.now()
      window.__h.tourner(1).then(() => { d.push(performance.now() - t0); if (--reste <= 0) return res(d); setTimeout(tour, 0) })
    }
    tour()
  })
  window.__info = () => { const i = e.renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length } }
  window.__reseau = () => performance.getEntriesByType('resource').length
})
const R = {}
for (const etat of ['allumé', 'éteint', 'rallumé']) {
  await page.evaluate((v) => { window.__c().group.visible = v }, etat !== 'éteint')
  await tourner(10)
  const r0 = await page.evaluate(() => window.__reseau())
  const durees = await page.evaluate(() => window.__mesure(90))
  const info = await page.evaluate(() => window.__info())
  const r1 = await page.evaluate(() => window.__reseau())
  const s = [...durees].sort((a, b) => a - b)
  R[etat] = { mediane: +med(durees).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2), ...info, requetes: r1 - r0 }
  console.log(`  ${etat.padEnd(8)} image médiane ${R[etat].mediane} ms · p95 ${R[etat].p95} · max ${R[etat].max} · appels ${info.calls} · triangles ${info.triangles} · géométries ${info.geometries} · textures ${info.textures} · requêtes +${r1 - r0}`)
}
// la géométrie du calque : octets des attributs
R.geometrie = await page.evaluate(() => { const c = window.__c(); let o = 0, n = 0; c.group.traverse((x) => { if (x.geometry) { n++; for (const a of Object.values(x.geometry.attributes)) o += a.array.byteLength; if (x.geometry.index) o += x.geometry.index.array.byteLength } }); return { objets: n, Mo: +(o / 1048576).toFixed(2), sommetsRuban: c.ruban?.geometry?.getAttribute('position')?.count } })
console.log('  géométrie du calque :', JSON.stringify(R.geometrie))
fs.writeFileSync(path.join(SORTIE, 'cout.json'), JSON.stringify(R, null, 1))
await B.nav.close()
