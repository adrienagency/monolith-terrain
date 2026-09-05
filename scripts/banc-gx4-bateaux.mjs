// GX4 — LES BATEAUX DANS LA SCÈNE VIVANTE, PROUVÉS PAR PIXELS. Le banc de GX3
// (`banc-gx3-bateaux.mjs`) comptait 723 px pour 294 de témoin : la houle et
// les pilules bougent entre deux captures, la différence allumé/éteint se
// noie dans le bruit. Ici le TEMPS EST GELÉ (`performance.now` constant, le
// gel de `banc-gx3-lecture`) : témoin A/A à 0, et la différence n'est que le
// bateau. Et la position du bateau est projetée par la caméra QUI DESSINE, en
// passant par la matrice du groupe (la similitude posée par `main.js`).
// EMPLOI : node scripts/banc-gx4-bateaux.mjs [--port 10411] [--lat 43.27 --lon 5.36 --z 12]
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, dodo, SORTIE } from './banc-gx3-lib.mjs'
const B = await ouvrir()
const { page, tourner, snap, attendreRepos } = B
const lat = +opt('--lat', '43.27'), lon = +opt('--lon', '5.36'), z = +opt('--z', '12')
await page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), { lat, lon, z })
for (let i = 0; i < 20; i++) { await tourner(90); await dodo(1000) }
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
// ⚠️ PAS DE `flyTo` : il reconstruit le relief, `syncBoats` ressème (1 sur 10)
// et le bateau forcé disparaît. On cherche plutôt une GRAINE dont le bateau
// tombe au centre de l'écran (semé au bord du bloc avec la graine 1, il
// tombait à (28, 38), sous les panneaux).
const graine = await page.evaluate(async () => {
  const e = window.__exp, T = e.THREE, b = e.boats, dem = e.terrain.dem, cam = e.camGlobe || e.camera
  const seaMat = e.realWater.materials.find((m) => m.uniforms?.uWaveA); b.setSea(seaMat)
  const seaY = e.realWater.seaY, fen = e.terrain?.fenetre || { x: 0, z: 0 }
  for (let seed = 1; seed < 80; seed++) {
    await b.build({ zoom: e.params.demZoom, half: 28, cote: 1, seed, isSea: (x, zz) => e.terrain.sample(x - fen.x, zz - fen.z) < seaY, extentMeters: dem.extentMeters, terrainSize: 56, force: true })
    const bt = (b.boats || []).find((x) => x && !x.dormant); if (!bt || !b.mesh) continue
    b.group.updateWorldMatrix(true, true)
    const v = new T.Vector3(bt.x, seaY, bt.z).applyMatrix4(b.group.matrixWorld); const q = v.clone().project(cam)
    const x = (q.x * 0.5 + 0.5) * innerWidth, y = (-q.y * 0.5 + 0.5) * innerHeight
    if (x > innerWidth * 0.3 && x < innerWidth * 0.7 && y > innerHeight * 0.3 && y < innerHeight * 0.65) return { seed, x: Math.round(x), y: Math.round(y) }
  }
  return null
})
console.log('graine centrale :', JSON.stringify(graine))
// ⚠️ le banc coupe les animations (dtAmb = 0) : le fondu d'apparition du
// bateau n'avance pas, son opacité reste 0 et le fragment est rejeté. On
// laisse le temps ambiant courir 3 s, puis on le coupe à nouveau.
await page.evaluate(() => { window.__exp.params.animations = true })
for (let i = 0; i < 3; i++) { await tourner(90); await dodo(1000) }
await page.evaluate(() => { window.__exp.params.animations = false })
console.log('opacité du bateau :', await page.evaluate(() => JSON.stringify((window.__exp.boats.boats || []).map((x) => ({ op: x.opacite, dormant: x.dormant, x: +x.x.toFixed(1), z: +x.z.toFixed(1) })))))
for (let i = 0; i < 3; i++) { await tourner(90); await dodo(1000) }
await attendreRepos({ maxMs: 60000 })
// le gel du temps
await page.evaluate(() => { const reel = performance.now.bind(performance); const t = reel(); performance.now = () => t })
await tourner(3)
const etat = await page.evaluate(() => {
  const e = window.__exp, T = e.THREE, b = e.boats
  const bt = (b.boats || []).find((x) => x && !x.dormant) || b.boats?.[0]
  const cam = e.camGlobe || e.camera
  let ecran = null
  if (bt && b.mesh) {
    b.group.updateWorldMatrix(true, true)
    const v = new T.Vector3(bt.x, e.realWater?.seaY ?? 0, bt.z).applyMatrix4(b.group.matrixWorld)
    const q = v.clone().project(cam)
    ecran = { x: Math.round((q.x * 0.5 + 0.5) * innerWidth), y: Math.round((-q.y * 0.5 + 0.5) * innerHeight), devant: q.z > -1 && q.z < 1, rayon: +v.length().toFixed(4) }
  }
  const passes = e.composer.passes.map((p) => ({ type: p.constructor.name, enabled: p.enabled, scene: p.scene?.uuid?.slice(0, 8) }))
  return { nBateaux: b.boats?.length ?? 0, mesh: !!b.mesh, groupVisible: b.group.visible, parentEstSceneGlobe: b.group.parent === e.sceneGlobe, parentEstSceneBloc: b.group.parent === e.scene, sceneGlobe: e.sceneGlobe?.uuid?.slice(0, 8), passes, echelleGroupe: +b.group.scale.x.toExponential(3), ecran, mode: e.modes.mode, alt: Math.round(e.altitudeCadrageM?.() ?? -1) }
})
console.log('état :', JSON.stringify(etat))
await tourner(2); const a = await snap(); await tourner(2); const a2 = await snap()
// ⚠️ PAS `group.visible` : `boats.update()` le RÉÉCRIT à chaque image
// (`_writeMatrices`), la capture « éteinte » était allumée — 0 px de différence
// pour un bateau pourtant à l'écran. Le `mesh`, lui, n'est touché par personne.
await page.evaluate(() => { window.__exp.boats.mesh.visible = false }); await tourner(2); const b = await snap()
await page.evaluate(() => { window.__exp.boats.mesh.visible = true }); await tourner(2)
// la zone de comptage : 240 × 240 px autour du bateau projeté (les pilules du
// bas bougent même temps gelé — 2 019 px de témoin sur toute la toile)
await page.evaluate((ec) => { const z0 = window.__zone; window.__zone = () => ({ x0: ec.x - 120, y0: ec.y - 120, x1: ec.x + 120, y1: ec.y + 120 }); window.__zonePleine = z0 }, etat.ecran)
const bruit = (await page.evaluate((x, y) => window.__diff(x, y), a, a2)).pixels
const d = await page.evaluate((x, y) => window.__diff(x, y, true), a2, b)
B.ecris('gx4-bateaux', a2); if (d.surligne) B.ecris('gx4-bateaux-surligne', d.surligne)
const R = { lat, lon, z, etat, bruit, pixelsBateau: d.pixels, boite: d.boite }
console.log(`\n══ BATEAUX GX4 ══  parent=sceneGlobe:${etat.parentEstSceneGlobe}  pixels posés par le groupe=${d.pixels} (témoin A/A ${bruit})  boîte=${JSON.stringify(d.boite)}  écran attendu=${JSON.stringify(etat.ecran)}`)
fs.writeFileSync(path.join(SORTIE, 'gx4-bateaux.json'), JSON.stringify(R, null, 1))
await B.nav.close()
