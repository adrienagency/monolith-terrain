// GX3 — exploration : ce que l'état de la page contient réellement.
import { ouvrir, opt, dodo } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, fermerStudio } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé par', await fermerStudio())
const etat = await page.evaluate(() => {
  const e = window.__exp, c = window.__c()
  const dom = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 150 && r.height > 40 && getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'absolute' && r.width > 300 && r.height > 60 }).slice(0, 25).map((el) => ({ cls: el.className?.toString().slice(0, 60), r: (() => { const q = el.getBoundingClientRect(); return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)] })() }))
  const parents = []; let p = c.group; while (p) { parents.push(p.name || p.type); p = p.parent }
  const dem = e.terrain?.dem
  const globeEnfants = e.globe?.group?.children?.length
  const meshes = []
  e.sceneGlobe?.traverse?.((o) => { if (o.isMesh && meshes.length < 12) meshes.push({ n: o.name, tri: o.geometry?.index ? o.geometry.index.count / 3 : (o.geometry?.attributes?.position?.count / 3 | 0), vis: o.visible }) })
  let nMesh = 0; e.sceneGlobe?.traverse?.((o) => { if (o.isMesh && o.visible) nMesh++ })
  return {
    mode: e.modes.mode, frontiere: e.frontiereActive, terreUnique: e.terreUniqueBranchee, alt: e.altitudeCadrageM?.(), zoom: e.params.demZoom,
    dem: dem ? { zoom: dem.zoom, size: dem.size, extentMeters: dem.extentMeters, meanM: dem.meanM, empriseCote: dem.empriseCote, originTileX: dem.originTileX, originTileY: dem.originTileY } : null,
    parents, k: c._k, poseurGlobe: !!c._poseur?.globe, refus: c._poseur?.refus, points: c._poseur?.points, nPts: c.track?.points?.length, nWorld: c.track?.world?.length,
    rubanSommets: c.ruban?.geometry?.getAttribute('position')?.count, gpxWidth: e.params.gpxWidth, gpxFollow: e.params.gpxFollow, drone: !!e.drone?.active,
    exag: e.globe?.exaggeration, globeEnfants, nMesh, meshes, dom, zone: window.__zone(), cam: window.__cam().position.toArray(), fov: window.__cam().fov, near: window.__cam().near, far: window.__cam().far,
    cbPlay: !!document.querySelector('.cb-play'), gpxVisible: e.params.gpxVisible, groupVisible: c.group.visible,
    bruitAvant: null,
  }
})
console.log(JSON.stringify(etat, null, 1))
const r = await releve('explore-repos', { image: true })
console.log('relevé repos', JSON.stringify(r))
// le drapage sur TOUS les points, contre la hauteur dessinée par le globe
const drap = await page.evaluate(() => {
  const e = window.__exp, c = window.__c(), g = e.globe, dem = e.terrain.dem
  const liste = g.tuilesAvecHauteurs()
  const p = c._poseur
  const out = []
  const w = c.track.world, pts = c.track.points
  for (let i = 0; i < w.length; i++) {
    const h = g.hauteurDessinee(pts[i].lat, pts[i].lon, liste)
    const yM = p?.metresDe ? p.metresDe(w[i].y) : null
    out.push({ i, h, yM, d: (h != null && yM != null) ? yM - h : null, inside: Math.abs(w[i].x) < 28 && Math.abs(w[i].z) < 28 })
  }
  const ok = out.filter((o) => o.d != null)
  ok.sort((a, b) => a.d - b.d)
  return { n: out.length, nOk: ok.length, nNull: out.length - ok.length, nInside: out.filter((o) => o.inside).length, pires: ok.slice(0, 5), plusHauts: ok.slice(-5), moy: ok.reduce((s, o) => s + o.d, 0) / ok.length, tuiles: liste.map((t) => t.z).join(',').slice(0, 80) }
})
console.log('drapage', JSON.stringify(drap, null, 1))
await B.nav.close()
