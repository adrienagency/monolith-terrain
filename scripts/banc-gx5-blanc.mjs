// GX5 — QU'EST-CE QUI EST BLANC ? Une image de lecture « sans tracé » à
// **exactement 0 pixel** n'est pas un tracé caché : un tracé caché laisse des
// bribes. Zéro pile, c'est un VOILE OPAQUE par-dessus toute la toile — la
// différence allumé/éteint y est nulle par construction. On demande donc au
// navigateur, au premier relevé vide : quel élément est au-dessus du centre de
// la vue, quels éléments couvrent la toile, et ce que valent les voiles connus.
// EMPLOI : node scripts/banc-gx5-blanc.mjs [--port 10433] [--n 40]
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const N = +opt('--n', '40')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => {
  const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel()
  window.__blanc = () => {
    const out = {}
    const W = innerWidth, H = innerHeight
    // qui est au-dessus, au centre de la vue et à trois autres points ?
    out.dessus = [[W / 2, H * 0.3], [W / 2, H / 2], [W * 0.25, H * 0.4], [W * 0.75, H * 0.4]].map(([x, y]) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      const s = getComputedStyle(el)
      return `${el.tagName}.${(el.className || '').toString().slice(0, 40)}|op=${s.opacity}|bg=${s.backgroundColor}|z=${s.zIndex}`
    })
    // tout élément qui couvre plus de la moitié de la toile et n'est pas transparent
    out.couvrants = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width < W * 0.6 || r.height < H * 0.6) continue
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.02) continue
      const bg = s.backgroundColor || ''
      const transp = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent'
      if (transp && el.tagName !== 'CANVAS') continue
      out.couvrants.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)}|op=${s.opacity}|bg=${bg}|z=${s.zIndex}|${Math.round(r.width)}x${Math.round(r.height)}`)
      if (out.couvrants.length > 12) break
    }
    const e = window.__exp
    const u = e.globe?.uniforms
    out.globe = u ? { estompage: u.uEstompage?.value, estompageOn: u.uEstompageOn?.value, cropOn: u.uCropOn?.value, cropDemi: u.uCropDemi?.value } : null
    out.brume = {}
    for (const k of Object.keys(u || {})) if (/brume|haze|fog|voile|blanc/i.test(k)) out.brume[k] = u[k].value?.isColor ? u[k].value.getHexString() : u[k].value
    out.sceneFog = e.sceneGlobe?.fog ? { type: e.sceneGlobe.fog.type, near: e.sceneGlobe.fog.near, far: e.sceneGlobe.fog.far, density: e.sceneGlobe.fog.density, color: e.sceneGlobe.fog.color?.getHexString() } : null
    out.nuages = { pres: e.clouds?.material?.uniforms?.uPresence?.value ?? e.clouds?._mat?.uniforms?.uPresence?.value ?? null, vis: e.clouds?.group?.visible }
    // les objets de la scène du globe qui coupent le segment caméra → tête
    try {
      const T = e.THREE, cam = window.__cam()
      const hw = e.gpxLayer.headWorld, c = window.__c()
      if (hw) {
        const cible = c._placer(hw.x, hw.y, hw.z)
        const dir = cible.clone().sub(cam.position); const d = dir.length(); dir.normalize()
        const rc = new T.Raycaster(cam.position, dir, 0.0001, d)
        const cibles = []
        e.sceneGlobe.traverse((o) => { if (o.isMesh && o.visible && o.matrixWorld && o.geometry?.attributes?.position) cibles.push(o) })
        for (const m of cibles) m.updateWorldMatrix(true, false)
        const hits = rc.intersectObjects(cibles, false)
        out.entreCameraEtTete = hits.slice(0, 8).map((h) => `${h.object.name || h.object.type}@${h.distance.toFixed(3)}`)
        out.dTete = +d.toFixed(3)
      }
    } catch (err) { out.rayonErr = String(err).slice(0, 120) }
    return out
  }
  // éteindre les suspects un par un et recompter
  window.__suspects = () => {
    const e = window.__exp
    const L = []
    const push = (nom, obj) => { if (obj) L.push([nom, obj]) }
    push('clouds', e.clouds?.group ?? e.clouds?.mesh)
    for (const o of e.sceneGlobe.children) push(`scèneGlobe:${o.name || o.type}:${o.uuid.slice(0, 4)}`, o)
    window.__L = L
    return L.map(([n, o]) => `${n}=${o.visible}`)
  }
  // ⚠️ **ON DÉTACHE, ON N'ÉTEINT PAS.** `update()` repose `visible` à chaque
  // image (les nuages le font depuis `presenceSelonCamera`) : un objet « éteint »
  // se rallume avant la capture, et le témoin ment. Un objet RETIRÉ de la scène
  // n'est pas dessiné, quoi que `update()` écrive sur lui.
  window.__eteindre = (i) => { const [, o] = window.__L[i]; window.__memoP = o.parent; if (!o.parent) return false; o.parent.remove(o); return true }
  window.__rallumer = (i) => { const [, o] = window.__L[i]; if (window.__memoP) window.__memoP.add(o) }
})
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
console.log('clic :', JSON.stringify(await clicLecture()))
await tourner(12)
for (let k = 0; k < N; k++) {
  for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
  await geler(); await tourner(3)
  await attendreRepos({ maxMs: 15000 })
  const r = await releve(); const r2 = await releve()
  const px = Math.max(r.pixels, r2.pixels)
  console.log(`  ${String(k).padStart(2)} tracé=${px}`)
  if (px < 30 && k > 2) {
    console.log('  ══ QUI EST BLANC ══', JSON.stringify(await page.evaluate(() => window.__blanc()), null, 1))
    const L = await page.evaluate(() => window.__suspects())
    console.log('  suspects :', JSON.stringify(L))
    for (let i = 0; i < L.length; i++) {
      const on = await page.evaluate((j) => window.__eteindre(j), i)
      if (!on) continue
      const s = await releve()
      await page.evaluate((j) => window.__rallumer(j), i)
      if (s.pixels > 30) console.log(`    ⚡ ${L[i]} éteint → ${s.pixels} px de tracé réapparaissent`)
      else console.log(`    · ${L[i]} éteint → ${s.pixels} px`)
    }
    await releve('gx5-blanc', { image: true })
    break
  }
  await degeler()
}
await B.nav.close()
