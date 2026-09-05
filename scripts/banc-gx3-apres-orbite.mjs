// GX3 — APRÈS UN ALLER-RETOUR EN ORBITE PENDANT LA LECTURE : le tracé dévoilé
// est-il encore dessiné ? On compte les sommets DÉVOILÉS qui sont dans le champ
// et on les confronte aux pixels posés (le relevé lect35 de la phase figée ne
// montrait que les étiquettes : 357 px).
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, releve } = B
await B.chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx')); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
await page.evaluate(() => { const e = window.__exp; e.params.gpxFollow = false; if (e.drone) e.drone.active = false })
console.log('clic', JSON.stringify(await B.clicLecture()))
await page.evaluate(() => {
  const e = window.__exp, T = e.THREE
  window.__champ = () => {
    const c = window.__c(), cam = window.__cam(), z = window.__zone(), t = c.track
    const n = t.world.length, h = Math.floor(c.headT * (n - 1))
    let dansChamp = 0, dedans = []
    for (let i = 0; i <= h; i++) { const s = c._worldScene[i]; const q = new T.Vector3(s.x, s.y, s.z).project(cam); const px = (q.x * 0.5 + 0.5) * innerWidth, py = (-q.y * 0.5 + 0.5) * innerHeight; if (px >= z.x0 && px < z.x1 && py >= z.y0 && py < z.y1 && q.z > -1 && q.z < 1) { dansChamp++; if (dedans.length < 6 && i % 40 === 0) dedans.push([Math.round(px), Math.round(py)]) } }
    return { headT: +c.headT.toFixed(3), reveles: h + 1, dansChamp, exemples: dedans, rubanVisible: c.ruban?.visible, sillageVisible: c.sillage?.visible, lineVisible: c.line?.visible, groupVisible: c.group.visible, progress: c._rubanProgress?.value, revealT: c._revealT, mode: e.modes.mode, alt: Math.round(e.altitudeCadrageM?.() ?? -1) }
  }
})
const mesure = async (nom) => {
  const r = await releve(`apres-orbite-${nom}`, { image: true })
  const ch = await page.evaluate(() => window.__champ())
  const d = ch.exemples.length ? await page.evaluate((ex) => ex.map(([x, y]) => window.__plusProche(x, y, 40)), ch.exemples) : []
  console.log(`  ${nom.padEnd(14)} tracé=${r.pixels} px (bruit ${r.bruit})  ${JSON.stringify(ch)}  distance des sommets dévoilés au tracé : ${JSON.stringify(d)}`)
  return { nom, ...r, ...ch, d }
}
const R = []
for (let i = 0; i < 6; i++) { await tourner(90); await dodo(500) }
await page.evaluate(() => window.__exp.gpxLayer.pause()); await B.attendreRepos({ maxMs: 30000 })
R.push(await mesure('avant'))
const ou = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
const p = page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), ou).catch(() => {})
const modes = []; for (let i = 0; i < 12; i++) { await tourner(60); await dodo(500); modes.push(await page.evaluate(() => window.__exp.modes.mode)) }
await p; console.log('  modes :', modes.join(' '))
await B.attendreDrapage(8); await B.attendreRepos({ maxMs: 60000 })
R.push(await mesure('après orbite'))
// la même vue, mais le tracé ENTIER (revealT=1) : est-il là ?
await page.evaluate(() => window.__c()._applyReveal(1)); await tourner(3)
R.push(await mesure('après, entier'))
await page.evaluate(() => window.__c()._applyReveal(window.__c().headT)); await tourner(3)
// puis un cran de zoom arrière pour élargir le champ
await page.evaluate(() => window.__exp.modes.cranZoom(-1)); for (let i = 0; i < 6; i++) { await tourner(90); await dodo(1000) }
await B.attendreDrapage(8); await B.attendreRepos({ maxMs: 60000 })
R.push(await mesure('après, dézoom'))
fs.writeFileSync(path.join(SORTIE, 'apres-orbite.json'), JSON.stringify(R, null, 1))
await B.nav.close()
