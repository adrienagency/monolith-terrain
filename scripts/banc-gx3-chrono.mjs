// GX3 — chronologie de la caméra après le chargement d'un GPX : où se pose-t-elle ?
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner } = B
const lire = () => page.evaluate(() => { const e = window.__exp; const c = window.__c(); return { t: Math.round(performance.now() / 100) / 10, alt: Math.round(e.altitudeCadrageM?.() ?? -1), mode: e.modes.mode, busy: !!e.modes.busy, tween: !!e.tween?.active, drone: !!e.drone?.active, tour: !!e.tour?.active, pilote: !!e.pilote?.poursuite, dz: e.params.demZoom, drape: c?.track?.world?.length ?? 0, studio: !!document.querySelector('.studio-close'), cam: window.__cam().position.toArray().map((v) => +v.toFixed(2)) } })
console.log('avant', JSON.stringify(await lire()))
const fs = await import('node:fs')
await page.evaluate((t) => window.__exp.loadGpxText(t), fs.readFileSync(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'), 'utf8'))
for (let i = 0; i < 40; i++) { await tourner(60); await dodo(500); console.log(JSON.stringify(await lire())) }
if (opt('--fermer', '')) { console.log('fermeture studio', await B.fermerStudio()); for (let i = 0; i < 20; i++) { await tourner(60); await dodo(500); console.log(JSON.stringify(await lire())) } }
await B.nav.close()
