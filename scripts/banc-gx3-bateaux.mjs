// GX3 — `boats` DANS LA SCÈNE MORTE : un bateau engendré au bord d'une mer
// est-il visible en production ? On va sur une côte (Marseille, z12), on force
// le semis (`boats.build({ force: true })` — l'API du produit, la rareté 1/10
// n'est pas le sujet), on attend le modèle, puis on compte par différence les
// pixels que le groupe `boats` pose à l'écran (allumé / éteint). Témoin : la
// même mesure sous `?terre=deux`, où la scène du bloc est encore dessinée.
// EMPLOI : node scripts/banc-gx3-bateaux.mjs [--adresse terre=deux] [--lat 43.27 --lon 5.36 --z 12]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap, attendreRepos } = B
const lat = +opt('--lat', '43.27'), lon = +opt('--lon', '5.36'), z = +opt('--z', '12')
await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { lat, lon, z })
for (let i = 0; i < 20; i++) { await tourner(90); await dodo(1000) }
const etat = () => page.evaluate(() => { const e = window.__exp, b = e.boats; let parent = b.group.parent; const chaine = []; while (parent) { chaine.push(parent.name || parent.type); parent = parent.parent } return { mode: e.modes.mode, alt: Math.round(e.altitudeCadrageM?.() ?? -1), demZoom: e.params.demZoom, source: e.params.source, nBateaux: b.boats?.length ?? 0, mesh: !!b.mesh, meshVisible: b.mesh?.visible, groupVisible: b.group.visible, parent: chaine, realWater: !!e.realWater, realWaterVisible: e.realWater?.group?.visible ?? e.realWater?.mesh?.visible ?? null, seaY: e.realWater?.seaY, positions: (b.boats || []).slice(0, 3).map((x) => ({ x: +x.x?.toFixed(2), z: +x.z?.toFixed(2), asleep: x.asleep })) } })
console.log('arrivée :', JSON.stringify(await etat()))
// semis forcé, par l'API du produit (mêmes arguments que syncBoats dans main.js)
const force = await page.evaluate(async () => {
  const e = window.__exp, b = e.boats, dem = e.terrain?.dem
  if (!dem || !e.realWater) return 'pas de mer'
  const seaMat = e.realWater.materials?.find((m) => m.uniforms?.uWaveA)
  if (!seaMat) return 'pas de matériau de mer'
  b.setSea(seaMat)
  const seaY = e.realWater.seaY
  const fen = e.terrain?.fenetre || { x: 0, z: 0 }
  await b.build({ zoom: e.params.demZoom, half: 28, cote: 1, seed: 1, isSea: (x, zz) => e.terrain.sample(x - fen.x, zz - fen.z) < seaY, extentMeters: dem.extentMeters, terrainSize: 56, force: true })
  return 'ok'
})
console.log('semis forcé :', force)
for (let i = 0; i < 8; i++) { await tourner(90); await dodo(1000) }
const e2 = await etat()
console.log('après semis :', JSON.stringify(e2))
const rp = await attendreRepos({ maxMs: 60000 })
// différence bateaux allumés / éteints (témoin A/A d'abord)
await tourner(2); const a = await snap(); await tourner(2); const a2 = await snap()
await page.evaluate(() => { window.__exp.boats.group.visible = false }); await tourner(2); const b = await snap()
await page.evaluate(() => { window.__exp.boats.group.visible = true }); await tourner(2)
const bruit = (await page.evaluate((x, y) => window.__diff(x, y), a, a2)).pixels
const d = await page.evaluate((x, y) => window.__diff(x, y, true), a2, b)
B.ecris(`bateaux-${opt('--adresse', 'prod').replace(/[=&]/g, '-')}`, a2)
if (d.surligne) B.ecris(`bateaux-${opt('--adresse', 'prod').replace(/[=&]/g, '-')}-surligne`, d.surligne)
// où le bateau DEVRAIT être à l'écran : sa position de bloc, projetée par la caméra du bloc et par celle du globe
const proj = await page.evaluate(() => {
  const e = window.__exp, T = e.THREE, b = e.boats
  const out = []
  for (const bt of (b.boats || []).slice(0, 3)) {
    const v = new T.Vector3(bt.x, e.realWater?.seaY ?? 0, bt.z)
    const q1 = v.clone().project(e.camera), q2 = e.camGlobe ? v.clone().project(e.camGlobe) : null
    out.push({ bloc: [Math.round((q1.x * 0.5 + 0.5) * innerWidth), Math.round((-q1.y * 0.5 + 0.5) * innerHeight)], globeCam: q2 ? [Math.round((q2.x * 0.5 + 0.5) * innerWidth), Math.round((-q2.y * 0.5 + 0.5) * innerHeight), +q2.z.toFixed(2)] : null })
  }
  return out
})
const R = { adresse: opt('--adresse', ''), lat, lon, z, etat: e2, repos: rp, bruit, pixelsBateaux: d.pixels, boite: d.boite, projections: proj }
console.log(`\n══ BATEAUX (${opt('--adresse', 'production')}) ══  bateaux semés=${e2.nBateaux}  modèle=${e2.mesh}  parent=${e2.parent.join(' > ')}  pixels posés par le groupe=${d.pixels} (bruit ${bruit})  boîte=${JSON.stringify(d.boite)}  proj=${JSON.stringify(proj)}`)
fs.writeFileSync(path.join(SORTIE, `bateaux-${opt('--adresse', 'prod').replace(/[=&]/g, '-')}.json`), JSON.stringify(R, null, 1))
await B.nav.close()
