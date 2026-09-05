import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
import fs from 'node:fs'
const B = await ouvrir()
const { page, tourner, snap, ecris } = B
await page.evaluate((t) => window.__exp.loadGpxText(t), fs.readFileSync('.banc/marathon-mont-blanc-90km.gpx', 'utf8'))
await B.attendreDrapage(); await B.attendreRepos()
const lire = () => page.evaluate(() => { const e = window.__exp; return { alt: Math.round(e.altitudeCadrageM?.() ?? -1), dist: Math.round(e.distanceCadrageM?.() ?? -1), cam: window.__cam().position.toArray().map((v) => +v.toFixed(3)), fov: window.__cam().fov, W: innerWidth, H: innerHeight, canvas: (() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height, c.width, c.height] })(), veil: (() => { const v = document.querySelector('.ce-hubveil'); return v ? [getComputedStyle(v).opacity, getComputedStyle(v).pointerEvents, getComputedStyle(v).display] : null })() } })
console.log('avant fermeture', JSON.stringify(await lire())); ecris('chrono-avant-fermeture', await snap())
console.log(await B.fermerStudio()); await B.attendreRepos()
console.log('après fermeture', JSON.stringify(await lire())); ecris('chrono-apres-fermeture', await snap())
await B.nav.close()
