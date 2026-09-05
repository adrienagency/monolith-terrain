// GX4 — LE RE-DRAPAGE SUIT-IL LES TUILES ? Combien de fois le ruban se
// reconstruit après un `flyTo` (rafales de tuiles fines), combien ça coûte, et
// au repos l'empreinte du poseur est-elle celle des tuiles dessinées (sinon le
// ruban est drapé sur un relief qui n'est plus celui de l'écran — le
// transitoire de GX3 ②). Et le coût d'une image au repos, ruban allumé.
// EMPLOI : node scripts/banc-gx4-redrapage.mjs [--port 10411]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, dodo, SORTIE, med } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, chargerGpx, attendreRepos } = B
await chargerGpx('.banc/marathon-mont-blanc-90km.gpx')
await page.evaluate(() => {
  const e = window.__exp
  const brut = e.gpxLayer.rebuildAll
  window.__redrapages = []
  e.gpxLayer.rebuildAll = () => { const t0 = performance.now(); brut(); window.__redrapages.push(+(performance.now() - t0).toFixed(1)) }
  window.__etat = async () => {
    const { signatureDessineeCrop } = await import('/src/monde/sol-globe.js')
    const c = window.__c()
    return { redrapages: window.__redrapages.slice(), enPhase: c._poseur?.signature === signatureDessineeCrop(e.globe), refus: c._poseur?.refus, points: c._poseur?.points, demZoom: e.params.demZoom, alt: Math.round(e.altitudeCadrageM?.() ?? -1) }
  }
})
console.log('studio fermé :', await B.fermerStudio()); await B.attendreDrapage(6); await attendreRepos()
const R = { etapes: [] }
const etape = async (nom) => { const s = await page.evaluate(() => window.__etat()); R.etapes.push({ nom, ...s }); console.log(`  ${nom} : ${JSON.stringify(s)}`) }
await etape('B (repos)')
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
for (const dz of [1, 2, 3]) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + dz }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12); await attendreRepos({ maxMs: 90000 })
  await etape(`flyTo z+${dz}`)
}
// le coût d'une image au repos : ruban allumé / éteint / rallumé (comme banc-gx3-cout)
const cout = async () => {
  const t = await page.evaluate(async () => { const out = []; for (let i = 0; i < 60; i++) { const t0 = performance.now(); await window.__h.tourner(1); out.push(performance.now() - t0) } return out })
  return +med(t).toFixed(2)
}
const c1 = await cout(); await page.evaluate(() => { window.__c().group.visible = false }); await tourner(2)
const c0 = await cout(); await page.evaluate(() => { window.__c().group.visible = true }); await tourner(2)
const c2 = await cout()
R.coutMs = { allume: c1, eteint: c0, rallume: c2 }
console.log(`  coût image médian (ms) : allumé ${c1} · éteint ${c0} · rallumé ${c2}`)
fs.writeFileSync(path.join(SORTIE, 'gx4-redrapage.json'), JSON.stringify(R, null, 1))
await B.nav.close()
