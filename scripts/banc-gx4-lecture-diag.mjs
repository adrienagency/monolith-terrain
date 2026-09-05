// GX4-bis — LE BANC DE LECTURE DU NOTEUR (phase suivi), PLUS UNE SONDE PAR
// RELEVÉ : le poseur en vigueur, la signature des tuiles dessinées, les
// reconstructions survenues, l'état du voile, les objets du groupe, le centre
// du ruban projeté. Ne corrige rien : dit POURQUOI une image est vide.
// EMPLOI : node scripts/banc-gx4-lecture-diag.mjs --port 10411 [--gpx x] [--etiquette mb] [--n 40]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const N = +opt('--n', '40')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(async () => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  window.__sol = await import('/src/monde/sol-globe.js')
  const e = window.__exp
  window.__cpt = { rebuildAll: 0, rebuild: 0, recentrages: 0, journal: [] }
  const ra = e.gpxLayer.rebuildAll.bind(e.gpxLayer)
  e.gpxLayer.rebuildAll = () => { window.__cpt.rebuildAll++; window.__cpt.journal.push(['rebuildAll', Math.round(reel())]); return ra() }
  const c = window.__c()
  const rb = c.rebuild.bind(c)
  c.rebuild = () => { window.__cpt.rebuild++; const t0 = reel(); const r = rb(); window.__cpt.journal.push(['rebuild', Math.round(t0), Math.round(reel() - t0), c._poseur?.globe ? 'globe' : 'PLAT', (c._poseur?.signature || '').slice(0, 6)]); return r }
  const rc = e.modes.recentrerBloc?.bind(e.modes)
  if (rc) e.modes.recentrerBloc = (...a) => { window.__cpt.recentrages++; window.__cpt.journal.push(['recentrerBloc', Math.round(reel())]); return rc(...a) }
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
const sonde = () => page.evaluate(() => {
  const e = window.__exp, c = window.__c(), g = e.globe
  const cam = e.camGlobe
  const out = { headT: +e.gpxLayer.headT.toFixed(3), alt: Math.round(e.altitudeCadrageM?.() ?? -1), demZoom: e.params.demZoom, demLat: +e.params.demLat?.toFixed(4), demLon: +e.params.demLon?.toFixed(4) }
  out.poseur = c._poseur ? (c._poseur.globe ? 'globe' : 'PLAT') : 'aucun'
  out.sigPoseur = (c._poseur?.signature || '').slice(0, 5)
  out.sigDessinee = window.__sol.signatureDessineeCrop(g).slice(0, 5)
  out.nDessinees = window.__sol.tuilesDessineesDansSocle(g).length
  out.nReservees = g.tuilesAvecHauteurs?.().length ?? -1
  out.crop = g._crop ? { cx: +g._crop.cx.toFixed(5), cy: +g._crop.cy.toFixed(5), demi: +g._crop.demi.toFixed(6) } : null
  out.uCrop = g.uniforms?.uCropCentre ? [+g.uniforms.uCropCentre.value.x.toFixed(5), +g.uniforms.uCropCentre.value.y.toFixed(5), +g.uniforms.uCropDemi.value.toFixed(6)] : null
  out.grpVis = c.group.visible; out.parent = c.group.parent?.type
  out.enfants = c.group.children.filter((o) => o.visible).map((o) => o.type[0] + (o.name || '')).join(',').slice(0, 60)
  out.ruban = !!c.ruban; out.rubanVis = c.ruban?.visible
  if (c.ruban) {
    const bs = c.ruban.geometry.boundingSphere
    const q = bs.center.clone().project(cam)
    out.rubanCentre = { px: Math.round((q.x * 0.5 + 0.5) * innerWidth), py: Math.round((-q.y * 0.5 + 0.5) * innerHeight), z: +q.z.toFixed(3), r: +bs.radius.toFixed(2), dCam: +bs.center.distanceTo(cam.position).toFixed(2) }
    out.uProgress = c._rubanProgress?.value
    // le premier sommet du ruban : son aMerc contre le crop courant
    const am = c.ruban.geometry.attributes.aMerc
    if (am && g._crop) {
      let hors = 0, n = 0
      for (let i = 0; i < am.count; i += 50) { n++; const u = (am.getX(i) - g._crop.cx) / g._crop.demi, v = (am.getY(i) - g._crop.cy) / g._crop.demi; if (Math.max(Math.abs(u), Math.abs(v)) > 1) hors++ }
      out.aMercHors = `${hors}/${n}`
    }
  }
  const w = c.track?.world
  if (w?.length) { let bas = 0; for (const p of w) if (Math.abs(p.y) < 1e-6) bas++; out.worldPlats = bas; out.worldN = w.length }
  const v = document.querySelector('.voile, #voile, .voile-loading, .loading-veil')
  out.voile = v ? `${v.className}|${getComputedStyle(v).opacity}|${getComputedStyle(v).display}` : null
  out.camPos = [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)]
  out.camLen = +cam.position.length().toFixed(3)
  out.cpt = { ...window.__cpt, journal: undefined }
  out.journal = window.__cpt.journal.splice(0)
  return out
})
const avant = await sonde()
console.log('avant :', JSON.stringify(avant))
const clic = await clicLecture()
await tourner(12)
console.log('clic :', JSON.stringify(clic))
const R = []
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  const rp = await attendreRepos({ maxMs: 15000 })
  const s = await sonde()
  const r = await releve(`${ETIQ}-diag-lect${k}`, { image: false })
  const r2 = await releve()
  const vide = r.pixels < 30 && r2.pixels < 30
  if (vide) { const im = await releve(`${ETIQ}-diag-vide${k}`, { image: true }) }
  R.push({ k, vide, pixels: r.pixels, bis: r2.pixels, bruit: r.bruit, sonde: s })
  console.log(`  ${String(k).padStart(2)} ${vide ? 'VIDE ' : '     '} tracé=${String(r.pixels).padStart(6)}/${String(r2.pixels).padStart(6)} bruit=${r.bruit} repos=${rp.bruit} ${JSON.stringify(s)}`)
  await degeler()
}
console.log(`\n══ ${ETIQ} · diag suivi ══ vides ${R.filter((r) => r.vide).length}/${N} (k=${R.filter((r) => r.vide).map((r) => r.k).join(',')})`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-lecture-diag.json`), JSON.stringify(R, null, 1))
await B.nav.close()
