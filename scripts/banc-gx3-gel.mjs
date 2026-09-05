// GX3 — LE GEL DU TEMPS : peut-on figer l'application (drone, tête, houle) en
// figeant `performance.now`, tout en continuant de rendre ? Témoin A/A = 0 attendu.
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap } = B
await B.chargerGpx('.banc/marathon-mont-blanc-90km.gpx'); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
await page.evaluate(() => { const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel() })
console.log('clic', JSON.stringify(await B.clicLecture()))
for (let i = 0; i < 6; i++) { await tourner(90); await dodo(800) }
const lire = () => page.evaluate(() => { const e = window.__exp; return { headT: +e.gpxLayer.headT.toFixed(4), drone: !!e.drone?.active, lecture: e.gpxLayer.isPlaying(), cam: window.__cam().position.toArray().map((v) => +v.toFixed(4)) } })
console.log('en vol', JSON.stringify(await lire()))
await page.evaluate(() => { window.__gel.t = window.__gel.reel() })
await tourner(3); const a = await snap(); const e1 = await lire(); await tourner(3); const a2 = await snap(); const e2 = await lire()
const bruit = (await page.evaluate((x, y) => window.__diff(x, y), a, a2)).pixels
console.log('gelé', JSON.stringify(e1), JSON.stringify(e2), 'témoin A/A =', bruit)
await page.evaluate(() => { window.__c().group.visible = false }); await tourner(3); const b = await snap(); await page.evaluate(() => { window.__c().group.visible = true }); await tourner(3)
const d = await page.evaluate((x, y, s) => window.__diff(x, y, s), a2, b, true)
console.log('tracé pendant le vol gelé =', d.pixels, 'px'); B.ecris('gel-vol', a2); B.ecris('gel-vol-surligne', d.surligne)
await page.evaluate(() => { window.__gel.t = null })
for (let i = 0; i < 3; i++) { await tourner(60); await dodo(500) }
console.log('dégelé', JSON.stringify(await lire()))
await B.nav.close()
