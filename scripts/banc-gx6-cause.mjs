// GX6 — POURQUOI UNE IMAGE DE LECTURE N'A-T-ELLE PAS DE RUBAN ? Le banc du
// noteur en compte 5 à 7 sur 40 en vol de poursuite (Mont-Blanc). GX5 a réfuté
// le re-drapage (8/40 sans lui) et le dévoilement (uProgress = 1 → toujours 0),
// et a vu, sur UNE image, 5 650 px réapparaître en retirant les nuages. Ici on
// fait l'attribution complète, image par image, chaque reprise mesurée par
// DIFFÉRENCE comme le noteur :
//   1. nuages RETIRÉS de la scène (pas éteints : `update()` rallume) ;
//   2. `uCropOn = 0` — l'écrêtage au bord du socle est-il en cause ?
//   3. `renderOrder` du groupe GPX poussé après les transparents ;
//   4. l'état des matériaux (transparent / depthWrite / depthTest / ordre) des
//      nuages et du ruban, pour dire QUI passe après QUI.
// EMPLOI : node scripts/banc-gx6-cause.mjs [--port 10441] [--n 40] [--gpx x]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const N = +opt('--n', '40')
const ETIQ = opt('--etiquette', 'mb')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  const e = window.__exp
  const nuages = () => e.clouds?.group ?? e.clouds?.mesh ?? e.sceneGlobe.getObjectByName('ancrage-nuages') ?? null
  window.__retirerNuages = () => { const o = nuages(); if (!o?.parent) return false; window.__pN = o.parent; o.parent.remove(o); return true }
  window.__remettreNuages = () => { const o = nuages(); if (o && window.__pN) window.__pN.add(o) }
  window.__crop = (v) => { const u = e.globe?.uniforms?.uCropOn; if (!u) return null; if (v == null) return u.value; const a = u.value; u.value = v; return a }
  window.__ordre = (v) => {
    const c = window.__c(); const memo = []
    c.group.traverse((o) => { memo.push([o, o.renderOrder]); o.renderOrder = v })
    window.__memoOrdre = memo; return memo.length
  }
  window.__ordreRendu = () => { for (const [o, r] of (window.__memoOrdre || [])) o.renderOrder = r }
  window.__mat = () => {
    const out = { nuages: [], ruban: [] }
    const dis = (o) => {
      const m = o.material; if (!m) return null
      return { nom: o.name || o.type, ordre: o.renderOrder, transparent: !!m.transparent, depthWrite: !!m.depthWrite, depthTest: !!m.depthTest, opacity: m.opacity, blending: m.blending, side: m.side }
    }
    const n = nuages(); if (n) n.traverse((o) => { if (o.isMesh) out.nuages.push(dis(o)) })
    const c = window.__c(); c.group.traverse((o) => { if (o.isMesh || o.isLine || o.isLine2 || o.isMesh2) out.ruban.push(dis(o)) })
    out.grpOrdre = c.group.renderOrder
    return out
  }
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
let premier = true
const R = []
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  const ligne = { k, px, alt: r.alt }
  if (px < 30) {
    // 1. sans les nuages
    if (await page.evaluate(() => window.__retirerNuages())) {
      ligne.sansNuages = (await releve()).pixels
      await page.evaluate(() => window.__remettreNuages())
    }
    // 2. sans l'écrêtage au bord du socle
    const avant = await page.evaluate(() => window.__crop(0))
    ligne.cropAvant = avant
    ligne.sansCrop = (await releve()).pixels
    await page.evaluate((v) => window.__crop(v), avant)
    // 3. le ruban dessiné APRÈS les transparents
    await page.evaluate(() => window.__ordre(50))
    ligne.ordre50 = (await releve()).pixels
    await page.evaluate(() => window.__ordreRendu())
    if (premier) { premier = false; ligne.mat = await page.evaluate(() => window.__mat()) }
    await releve(`${ETIQ}-gx6-vide${k}`, { image: true })
  }
  R.push(ligne)
  console.log(`  ${String(k).padStart(2)} tracé=${String(px).padStart(6)} alt=${ligne.alt == null ? '—' : Math.round(ligne.alt)}${px < 30 ? `  VIDE → sansNuages=${ligne.sansNuages} · sansCrop=${ligne.sansCrop} (uCropOn était ${ligne.cropAvant}) · ordre50=${ligne.ordre50}` : ''}`)
  if (ligne.mat) console.log('  matériaux :', JSON.stringify(ligne.mat, null, 1))
  await degeler()
}
const v = R.filter((x) => x.px < 30)
console.log(`\n══ ${ETIQ} ══ vides ${v.length}/${N} (k=${v.map((x) => x.k).join(',')})`)
console.log(`   sauvés par : nuages retirés ${v.filter((x) => x.sansNuages > 30).length}/${v.length} · crop coupé ${v.filter((x) => x.sansCrop > 30).length}/${v.length} · ordre 50 ${v.filter((x) => x.ordre50 > 30).length}/${v.length}`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-gx6-cause.json`), JSON.stringify(R, null, 1))
await B.nav.close()
