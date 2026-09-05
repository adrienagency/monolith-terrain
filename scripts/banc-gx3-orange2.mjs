// GX3 — suite : la ligne orange hors crop n'est ni dans `globe` ni dans `gpx`.
// DOM (canvas/svg superposés) ? Passes du compositeur ? On éteint chacun.
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap } = B
await B.chargerGpx('.banc/marathon-mont-blanc-90km.gpx'); await B.fermerStudio(); await B.attendreDrapage(6); await B.attendreRepos()
await page.evaluate(() => window.__exp.modes.flyTo(46.06609, 6.93976, 13)).catch(() => {})
for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
await B.attendreDrapage(10); await B.attendreRepos({ maxMs: 90000 })
const compte = async () => page.evaluate(async (u) => { const im = await window.__lire(u); let n = 0; for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x += 3) { const i = (y * im.w + x) * 4; const r = im.d[i], g = im.d[i + 1], b = im.d[i + 2]; if (r > 190 && g > 70 && g < 160 && b < 90 && (y > 860 || x > 1180)) n++ } return n }, await snap())
console.log('DOM :', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('canvas, svg')].map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: String(el.className?.baseVal ?? el.className).slice(0, 40), id: el.id, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], z: getComputedStyle(el).zIndex, op: getComputedStyle(el).opacity } }).filter((x) => x.r[2] > 100))))
console.log('passes :', JSON.stringify(await page.evaluate(() => window.__exp.composer.passes.map((p, i) => ({ i, type: p.constructor.name, enabled: p.enabled, scene: p.scene?.name || p.scene?.uuid?.slice(0, 8), cam: p.camera?.type })))))
console.log('orange, tout allumé :', await compte())
const n = await page.evaluate(() => window.__exp.composer.passes.length)
for (let i = 0; i < n; i++) {
  const etait = await page.evaluate((i) => { const p = window.__exp.composer.passes[i]; const e = p.enabled; p.enabled = false; return e }, i)
  if (!etait) { console.log(`  passe ${i} déjà éteinte`); continue }
  await tourner(3); const c = await compte()
  await page.evaluate((i) => { window.__exp.composer.passes[i].enabled = true }, i); await tourner(3)
  console.log(`  passe ${i} éteinte : orange restant ${c}`)
}
// la scène du bloc (morte ?) : ses enfants visibles
console.log('scene (bloc) enfants visibles :', JSON.stringify(await page.evaluate(() => window.__exp.scene.children.filter((c) => c.visible).map((c) => c.name || c.type))))
// et si on éteint le groupe gpx ET qu'on compte : quels pixels orange restent — capture
const a = await snap(); B.ecris('orange2-tout', a)
await page.evaluate(() => { window.__c().group.visible = false }); await tourner(3); B.ecris('orange2-sans-gpx', await snap())
await page.evaluate(() => { window.__c().group.visible = true; window.__exp.sceneGlobe.children[0].visible = false }); await tourner(3); B.ecris('orange2-sans-globe', await snap())
await B.nav.close()
