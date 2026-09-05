// GX5 — LE VOL DE POURSUITE, DEUX RÉGIMES. Même geste que le banc du noteur
// (clic souris sur « ▶ Lecture », temps gelé au relevé) ; à chaque relevé on
// note les pixels, l'altitude de la caméra, sa garde au sol, la projection de la
// tête et le nombre de sommets du ruban DANS L'ÉCRAN. `--sansRedrapage` coupe le
// re-drapage en vol (`gpxLayer.rebuildAll` neutralisé après le premier drapage) :
// c'est l'expérience de contrôle qui dit s'il est la cause des images vides.
// EMPLOI : node scripts/banc-gx5-vol.mjs [--port 10433] [--n 40] [--sansRedrapage] [--gpx x]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, A, dodo, SORTIE } from './banc-gx3-lib.mjs'
const N = +opt('--n', '40')
const SANS = A.includes('--sansRedrapage')
const ETIQ = opt('--etiquette', 'mb')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate((sans) => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp
  window.__cpt = { rebuildAll: 0, retarget: 0 }
  const ra = e.gpxLayer.rebuildAll.bind(e.gpxLayer)
  e.gpxLayer.rebuildAll = () => { window.__cpt.rebuildAll++; if (sans) return; return ra() }
  if (e.drone) { const rt = e.drone.retarget.bind(e.drone); e.drone.retarget = (w) => { window.__cpt.retarget++; return sans ? true : rt(w) } }
  window.__vol = () => {
    const c = window.__c(), cam = window.__cam(), T = e.THREE
    const o = { headT: +e.gpxLayer.headT.toFixed(3), alt: Math.round(e.altitudeCadrageM?.() ?? -1), drone: !!e.drone?.active, dist: +(e.drone?._distS ?? -1).toFixed(3), rebuildAll: window.__cpt.rebuildAll, retarget: window.__cpt.retarget }
    const hw = e.gpxLayer.headWorld
    if (hw && c?._placer) {
      const s = c._placer(hw.x, hw.y, hw.z); const q = s.clone().project(cam)
      o.tete = [Math.round((q.x * 0.5 + 0.5) * innerWidth), Math.round((-q.y * 0.5 + 0.5) * innerHeight)]
      o.teteDevant = q.z > -1 && q.z < 1
      o.dTete = +s.distanceTo(cam.position).toFixed(3)
    }
    const g = c.ruban?.geometry, p = g?.attributes?.position
    if (p) {
      const v = new T.Vector3(); let ecran = 0, devant = 0, n = 0
      for (let i = 0; i < p.count; i += 7) { n++; v.set(p.getX(i), p.getY(i), p.getZ(i)).project(cam); if (!(v.z > -1 && v.z < 1)) continue; devant++; const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight; if (px >= 0 && py >= 0 && px <= innerWidth && py <= innerHeight) ecran++ }
      o.rub = `${ecran}/${devant}/${n}`
    }
    try {
      const { sphereToLatLon, R_GLOBE, EARTH_RADIUS_M } = window.__geo
      const ll = sphereToLatLon(cam.position); const h = e.globe.hauteurDessinee(ll.lat, ll.lon)
      const rSol = R_GLOBE + (h ?? 0) * (R_GLOBE / EARTH_RADIUS_M) * (e.globe.exaggeration ?? 1)
      o.camSol = h == null ? null : Math.round((cam.position.length() - rSol) * (EARTH_RADIUS_M / R_GLOBE) / (e.globe.exaggeration ?? 1))
    } catch { o.camSol = null }
    return o
  }
}, SANS)
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log(`régime : ${SANS ? 'SANS re-drapage en vol' : 'produit tel quel'}`)
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
const R = []
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  const v = await page.evaluate(() => window.__vol())
  let sansNuages = null
  if (px < 30) {
    // QUI CACHE LE RUBAN ? On éteint la couverture nuageuse et on recompte : si
    // le tracé réapparaît, l'image « vide » est une image DANS LE NUAGE.
    const n = await page.evaluate(() => { const c = window.__exp.clouds; const g = c?.group ?? c?.mesh ?? null; if (!g) return null; window.__memoN = g.visible; g.visible = false; return true })
    if (n) {
      const s1 = await releve(); const s2 = await releve()
      sansNuages = Math.max(s1.pixels, s2.pixels)
      await page.evaluate(() => { const c = window.__exp.clouds; const g = c?.group ?? c?.mesh; if (g) g.visible = window.__memoN })
    }
    await releve(`${ETIQ}-vol${SANS ? '-sans' : ''}-vide${k}`, { image: true })
  }
  R.push({ k, px, sansNuages, ...v })
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)}${px < 30 ? ' VIDE' : '     '}${sansNuages == null ? '' : ` [sans nuages : ${sansNuages} px]`} headT=${v.headT} alt=${v.alt} camSol=${v.camSol} dTête=${v.dTete} tête=${JSON.stringify(v.tete)}${v.teteDevant ? '' : ' DERRIÈRE'} ruban(écran/devant/total)=${v.rub} rebuilds=${v.rebuildAll} retargets=${v.retarget}`)
  await degeler()
}
const vides = R.filter((r) => r.px < 30)
const derriere = R.filter((r) => r.teteDevant === false)
console.log(`\n══ ${ETIQ} · ${SANS ? 'sans re-drapage' : 'produit'} ══ vides ${vides.length}/${N} (k=${vides.map((r) => r.k).join(',')}) · tête derrière la caméra ${derriere.length}/${N} (k=${derriere.map((r) => r.k).join(',')}) · rebuilds ${R[R.length - 1].rebuildAll}`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx5-vol${SANS ? '-sans' : ''}.json`), JSON.stringify(R, null, 1))
await B.nav.close()
