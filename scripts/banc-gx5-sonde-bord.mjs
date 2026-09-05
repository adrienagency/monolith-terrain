// GX5 — SONDE DU BORD DU SOCLE : le nuanceur du ruban a-t-il l'attribut, les
// uniformes, et coupe-t-il vraiment ? Dit, sans corriger : le nom de l'attribut
// posé, celui déclaré dans le programme compilé, la part des sommets hors socle
// selon la MÊME formule que le fragment, et le compte de pixels de ruban dont le
// rayon ne touche rien.
// EMPLOI : node scripts/banc-gx5-sonde-bord.mjs [--port 10433] [--crans 2]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const CRANS = +opt('--crans', '2')
const B = await ouvrir()
const { page, tourner, chargerGpx, attendreRepos } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
await attendreRepos()
console.log('studio fermé :', await B.fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
const centre = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
for (let k = 0; k <= CRANS; k++) {
  await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { ...centre, z: centre.z + k }).catch(() => {})
  for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(12)
  await attendreRepos({ maxMs: 90000 })
  const s = await page.evaluate(() => {
    const e = window.__exp, c = window.__c(), g = e.globe
    const out = { alt: Math.round(e.altitudeCadrageM?.() ?? -1) }
    const geo = c.ruban?.geometry
    out.attributs = geo ? Object.keys(geo.attributes) : null
    out.uCropOn = g.uniforms?.uCropOn?.value
    out.uCropDemi = g.uniforms?.uCropDemi?.value
    out.uCropCoin = g.uniforms?.uCropCoin?.value
    out.uCropCoinN = g.uniforms?.uCropCoinN?.value
    out.poseurUniformes = c._poseur?.uniformsCrop ? Object.keys(c._poseur.uniformsCrop) : null
    const m = c.rubanMat
    out.cle = m?.customProgramCacheKey?.()
    // le programme COMPILÉ : trois.js range le shader final sur le programme
    const prog = e.renderer?.info ? null : null
    out.vsAMerc = m ? /attribute vec2 aMerc/.test(m.__vs || '') : null
    // la part des sommets du ruban hors socle, formule du fragment
    if (geo?.attributes?.aMerc && g._crop) {
      const a = geo.attributes.aMerc
      const { cx, cy, demi } = g._crop
      const coin = g.uniforms.uCropCoin.value, expo = g.uniforms.uCropCoinN.value
      let hors = 0
      for (let i = 0; i < a.count; i++) {
        let du = a.getX(i) - cx; du -= Math.round(du)
        const u = du / demi, v = (a.getY(i) - cy) / demi
        const qx = Math.abs(u) - (1 - coin), qy = Math.abs(v) - (1 - coin)
        const cqx = Math.max(qx, 0), cqy = Math.max(qy, 0)
        const pn = (cqx ** expo + cqy ** expo) ** (1 / expo)
        if (pn - coin + Math.min(Math.max(qx, qy), 0) > 0) hors++
      }
      out.sommetsRubanHorsSocle = `${hors}/${a.count}`
    }
    return out
  })
  console.log(`  cran ${k} ${JSON.stringify(s)}`)
}
await B.nav.close()
