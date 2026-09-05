// GX6 — QUI DÉPLACE LA CAMÉRA APRÈS LE DRONE ? Le banc précédent a montré que
// `drone.updateAt` laisse la caméra bien posée (avant·tête = 0,999) et qu'au
// relevé elle est 36 unités plus loin, retournée à 176° de sa propre cible,
// sans que `followPivot` ni `controls.update` aient été appelés. Ici on piège
// les écritures de `camera.position` : dès qu'une écriture éloigne la caméra
// de la pose du drone, on garde la PILE D'APPEL. Elle nomme le coupable.
// EMPLOI : node scripts/banc-gx6-pile.mjs [--port 10441] [--gpx x]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/court-montagne-chamonix-4km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp, d = e.drone
  const P = e.camera.position
  window.__piles = []
  for (const m of ['copy', 'set', 'add', 'addScaledVector', 'lerpVectors', 'sub', 'multiplyScalar', 'applyMatrix4', 'setFromSpherical', 'addVectors', 'subVectors']) {
    if (typeof P[m] !== 'function') continue
    const o = P[m].bind(P)
    P[m] = (...a) => {
      const r = o(...a)
      if (d?.active && d._pos && P.distanceTo(d._pos) > 5 && window.__piles.length < 6) {
        window.__piles.push({ methode: m, ecart: +P.distanceTo(d._pos).toFixed(2), pile: new Error().stack.split('\n').slice(1, 7).join(' ⇠ ') })
      }
      return r
    }
  }
})
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
await page.evaluate(() => { window.__gel.t = window.__gel.reel() })
await tourner(3)
await attendreRepos({ maxMs: 15000 })
const r = await releve()
console.log(`tracé=${r.pixels}`)
const p = await page.evaluate(() => window.__piles)
for (const x of p) console.log(`  ${x.methode} → écart ${x.ecart}\n     ${x.pile}`)
await B.nav.close()
