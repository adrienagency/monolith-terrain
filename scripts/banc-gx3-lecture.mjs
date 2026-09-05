// GX3 — LA LECTURE, AU CLIC. Le vrai bouton « ▶ Lecture » du panneau Parcours,
// par la souris (`.cb-play` est hors écran au repos), dans le régime B (studio
// fermé). 40 relevés par différence, témoin A/A, deux relevés par image (une
// image n'est vide que si les deux le disent).
//
// --phase suivi : le geste d'Adrien tel quel — suivi caméra ALLUMÉ, la
//     poursuite vole. ⚠️ Mettre en PAUSE arrête la poursuite (`drone.stop()`,
//     main.js:2355) et la relance par l'API ne la rengage pas : un premier tour
//     mesurait une caméra plantée en plein vol, le nez dans un versant (188 px).
//     On GÈLE donc le TEMPS à la place : `performance.now` rendu constant, la
//     boucle continue de rendre mais dt = 0 — drone, tête, houle immobiles.
//     Vérifié : témoin A/A = 0, `drone.active` reste vrai, le vol reprend au dégel.
// --phase figee : suivi coupé AVANT le clic (caméra figée, E2 du barème) — ET
//     trois changements de vue au milieu : k=13 un cran de zoom, k=26 une vue
//     iso, k=33 `modes.flyTo` sur le même lieu (sortie en orbite puis retour en
//     surface — la porte `vue.socle`, deux fois).
// EMPLOI : node scripts/banc-gx3-lecture.mjs --gpx x --etiquette x --phase suivi|figee
import fs from 'node:fs'
import path from 'node:path'
import { ouvrir, opt, med, dodo, SORTIE } from './banc-gx3-lib.mjs'
const ETIQ = opt('--etiquette', 'mb')
const PHASE = opt('--phase', 'suivi')
const N = +opt('--n', '40')
const B = await ouvrir()
const { page, tourner, releve, chargerGpx, attendreRepos, fermerStudio, clicLecture } = B
await chargerGpx(opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
console.log('studio fermé :', await fermerStudio())
await B.attendreDrapage(6)
await attendreRepos()
await page.evaluate(() => { const reel = performance.now.bind(performance); window.__gel = { t: null, reel }; performance.now = () => window.__gel.t ?? reel() })
const geler = () => page.evaluate(() => { window.__gel.t = window.__gel.reel() })
const degeler = () => page.evaluate(() => { window.__gel.t = null })
const lire = () => page.evaluate(() => {
  const e = window.__exp, T = e.THREE; const c = window.__c()
  const out = { headT: e.gpxLayer.headT, lecture: e.gpxLayer.isPlaying(), follow: e.params.gpxFollow, drone: !!e.drone?.active, mode: e.modes.mode, alt: Math.round(e.altitudeCadrageM?.() ?? -1), vis: c?.group.visible, k: c?._k, parent: c?.group.parent?.type, refus: c?._poseur?.refus, demZoom: e.params.demZoom }
  // LA CAMÉRA DE SUIVI (barème 0,5 pt) : la tête de course est-elle dans le
  // tiers central de l'écran, et la caméra est-elle au-dessus du sol dessiné ?
  try {
    const cam = window.__cam(), hw = e.gpxLayer.headWorld
    if (hw && c?._placer) {
      const s = c._placer(hw.x, hw.y, hw.z); const q = s.clone().project(cam)
      const px = (q.x * 0.5 + 0.5) * innerWidth, py = (-q.y * 0.5 + 0.5) * innerHeight
      out.tete = { px: Math.round(px), py: Math.round(py), tiersCentral: px > innerWidth / 3 && px < (2 * innerWidth) / 3 && py > innerHeight / 3 && py < (2 * innerHeight) / 3, devant: q.z > -1 && q.z < 1 }
    }
    const { sphereToLatLon, R_GLOBE, EARTH_RADIUS_M } = window.__geo
    const ll = sphereToLatLon(cam.position); const h = e.globe.hauteurDessinee(ll.lat, ll.lon)
    const rSol = R_GLOBE + (h ?? 0) * (R_GLOBE / EARTH_RADIUS_M) * (e.globe.exaggeration ?? 1)
    out.camSolM = h == null ? null : Math.round((cam.position.length() - rSol) * (EARTH_RADIUS_M / R_GLOBE) / (e.globe.exaggeration ?? 1))
  } catch (err) { out.err = String(err).slice(0, 80) }
  return out
})

if (PHASE === 'figee') await page.evaluate(() => { const e = window.__exp; e.params.gpxFollow = false; if (e.drone) e.drone.active = false })
const avant = await lire()
const clic = await clicLecture()
await tourner(12)
const apres = await lire()
console.log(`clic=${JSON.stringify(clic)}\n  avant=${JSON.stringify(avant)}\n  après=${JSON.stringify(apres)}`)

const R = { etiquette: ETIQ, phase: PHASE, clic, avant, apres, releves: [], evenements: [] }
const evenement = async (k, nom, fn) => {
  await page.evaluate(() => window.__exp.gpxLayer.pause())
  await fn()
  for (let i = 0; i < 4; i++) { await tourner(90); await dodo(1000) }
  await B.attendreDrapage(6)
  const rp = await attendreRepos({ maxMs: 60000 })
  const et = await lire()
  R.evenements.push({ k, nom, repos: rp, etat: et })
  console.log(`  ── ${nom} @k=${k} : ${JSON.stringify(et)} repos=${JSON.stringify(rp)}`)
}

for (let k = 0; k < N; k++) {
  if (PHASE === 'figee' && k === 13) await evenement(k, 'cran de zoom (+1)', () => page.evaluate(() => window.__exp.modes.cranZoom?.(1)))
  if (PHASE === 'figee' && k === 26) await evenement(k, 'vue iso suivante', () => page.evaluate(() => window.__exp.applyIsoView?.((window.__exp.isoIndex ?? 0) + 1)))
  if (PHASE === 'figee' && k === 33) await evenement(k, 'orbite puis retour (modes.flyTo, même lieu)', async () => {
    const ou = await page.evaluate(() => ({ lat: window.__exp.params.demLat, lon: window.__exp.params.demLon, z: window.__exp.params.demZoom }))
    const modes = []
    const p = page.evaluate((o) => window.__exp.modes.flyTo(o.lat, o.lon, o.z), ou).catch((e) => String(e))
    for (let i = 0; i < 12; i++) { await tourner(60); await dodo(500); modes.push(await page.evaluate(() => window.__exp.modes.mode)) }
    await p
    R.evenements.push({ k, nom: 'modes traversés', modes })
    console.log(`     modes traversés : ${modes.join(' ')}`)
  })
  let rp
  if (PHASE === 'suivi') {
    // on laisse voler ~1,5 s de temps réel entre deux relevés, puis on gèle
    for (let i = 0; i < 2; i++) { await tourner(45); await dodo(300) }
    await geler(); await tourner(3)
    rp = await attendreRepos({ maxMs: 15000 })
  } else {
    await page.evaluate(() => window.__exp.gpxLayer.play()); await tourner(24)
    await page.evaluate(() => window.__exp.gpxLayer.pause()); await tourner(3)
    rp = await attendreRepos({ maxMs: 45000 })
  }
  const r = await releve(`${ETIQ}-${PHASE}-lect${k}`, { image: k % 5 === 0 || k === N - 1 })
  const r2 = await releve()
  const et = await lire()
  Object.assign(r, { k, headT: et.headT, confirme: r2.pixels, bruit2: r2.bruit, reposAvant: rp.bruit, etat: et })
  R.releves.push(r)
  console.log(`  ${String(k).padStart(2)}  headT=${et.headT.toFixed(3)}  tracé=${String(r.pixels).padStart(6)} (bis ${String(r2.pixels).padStart(6)})  bruit=${r.bruit}/${r2.bruit}  alt=${et.alt}  lecture=${et.lecture} follow=${et.follow} drone=${et.drone} vis=${et.vis} mode=${et.mode} z${et.demZoom}  tête=${et.tete ? `(${et.tete.px},${et.tete.py}) ${et.tete.tiersCentral ? 'CENTRE' : 'hors tiers'}` : '—'}  cam/sol=${et.camSolM ?? '—'} m${et.err ? ' ERR ' + et.err : ''}`)
  if (PHASE === 'suivi') await degeler()
}
const vides = R.releves.filter((r) => r.pixels < 30 && r.confirme < 30)
const heads = R.releves.map((r) => r.headT)
let monotone = true; for (let i = 1; i < heads.length; i++) if (heads[i] < heads[i - 1] - 1e-6) monotone = false
const tetes = R.releves.filter((r) => r.etat.tete)
const centre = tetes.filter((r) => r.etat.tete.tiersCentral).length
const sousSol = R.releves.filter((r) => r.etat.camSolM != null && r.etat.camSolM < 0).length
console.log(`\n══ VERDICT ${ETIQ} · ${PHASE} ══\n  images sans tracé : ${vides.length}/${N} (k=${vides.map((r) => r.k).join(',')})\n  médiane : ${med(R.releves.map((r) => Math.max(r.pixels, r.confirme)))} px · min ${Math.min(...R.releves.map((r) => Math.max(r.pixels, r.confirme)))} · bruit médian ${med(R.releves.map((r) => r.bruit))} · headT ${heads[0].toFixed(3)} → ${heads[heads.length - 1].toFixed(3)} (monotone ${monotone})\n  tête dans le tiers central : ${centre}/${tetes.length} · caméra sous le sol dessiné : ${sousSol}/${N}`)
fs.writeFileSync(path.join(SORTIE, `${ETIQ}-lecture-${PHASE}.json`), JSON.stringify(R, null, 1))
await B.nav.close()
