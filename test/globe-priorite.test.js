// LA PRIORITÉ DU GLOBE — PF2 : « le visible d'abord, le centre de l'écran d'abord ».
//
// Adrien, 2026-09-01 : « Ce qui est visible doit toujours être calculé en
// premier. Ce qui est au centre de l'écran est la priorité. »
//
// Ce fichier verrouille les quatre correctifs de `src/globe.js` (PF2), dans
// l'ordre où ils ont été appliqués — réduire ce qui ENTRE avant de trier :
//   ① un enfant hors du champ (horizon + tronc, par SA sphère) n'est ni demandé
//     ni attendu par la règle sans-trou ;
//   ② la pompe se tait pendant le parcours et part en fin d'image, sur une
//     file complète ;
//   ③ la clé de la file est la distance ÉCRAN du bord de la tuile au centre de
//     l'écran, pas `chord / dist` du parent ;
//   ④ les priorités suivies sont RECALCULÉES à chaque image avec la caméra du
//     moment.
//
// ⚠️ Mesuré AVANT (sonde `scripts/profil-pf2.mjs`, descente 2 274 km → 20 km,
// dev, RTX 3080) : 20 premières tuiles arrivées à 1,415 de distance NDC en
// moyenne (le coin), 0 % dans le tiers central ; glissé gauche à 1 500 km :
// 164 demandes dont 99,4 % hors du tronc pour une caméra du globe immobile.
//
// Le harnais est celui de `test/globe-eviction.test.js` : un DOM de papier,
// un `fetch` qui COMPTE et dont on tient la résolution à la main — c'est la
// seule façon d'observer QUELLES requêtes partent en premier.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// ------------------------------------------------ le serveur tenu à la main
// Chaque `fetch` est noté (URL, ordre) et RETENU jusqu'à `relacher()` : on peut
// donc regarder la file sans qu'elle se vide sous nos yeux.
const parties = [] // URLs, dans l'ordre de départ
const retenues = [] // { url, r } — les réponses à libérer
let tenir = false
globalThis.fetch = async (url) => {
  parties.push(url)
  if (tenir) await new Promise((r) => retenues.push({ url, r }))
  else await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
}
const souffler = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)) }
async function relacher(n = Infinity) {
  if (n === Infinity) tenir = false // tout libérer, et ne plus rien retenir
  let k = 0
  while (retenues.length && k < n) { retenues.shift().r(); k++ }
  await souffler()
}

const { Globe, _resetTileMemo, MAX_Z } = await import('../src/globe.js')
const { latLonToSphere, latLonToTile, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')

const ROOT_Z = 2
const zxyDe = (url) => {
  const m = url.match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png/)
  return m ? { z: +m[1], x: +m[2], y: +m[3], key: `${m[1]}/${m[2]}/${m[3]}` } : null
}

// fov 30°, far 1400, near = clamp(orbAlt × 0,2) — les valeurs du dépôt (voir
// test/globe-eviction.test.js, « la caméra du harnais »)
function camera(lat, lon, altM) {
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function neuf() {
  parties.length = 0
  retenues.length = 0
  tenir = false
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id) // une seule source : pas de sonde de couverture
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  return g
}

// vide la file : tant qu'il reste des requêtes en vol ou en attente, on rend
// la main à la boucle d'événements
async function calme(g, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!g.inFlight && !g.queue.length && !g._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

// des images jusqu'à ce que plus rien ne bouge (le réseau libre entre chaque)
async function converger(g, cam, max = 40) {
  let prec = -1
  for (let i = 0; i < max; i++) {
    g.update(cam, 0.016)
    await calme(g)
    const cle = `${g.tiles.size}/${g._drawn}/${parties.length}`
    if (cle === prec) return i
    prec = cle
  }
  throw new Error(`le globe ne converge pas en ${max} images`)
}

const LAT = 45
const LON = 6.25

// ───────────────────────────────────────── ③ la clé : le centre de l'écran
test('③ `_priorite` : la tuile SOUS le centre de l écran passe avant celle du bord, à niveau égal', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 1500000)
  await calme(g)
  g.update(cam, 0.016) // pose `_matVue` et `_echelleProj`
  await calme(g)
  const z = 8
  const { x, y } = latLonToTile(LAT, LON, z)
  const centre = g._ensureTile(z, Math.floor(x), Math.floor(y))
  const bord = g._ensureTile(z, Math.floor(x) + 6, Math.floor(y))
  const loin = g._ensureTile(z, Math.floor(x) + 12, Math.floor(y))
  const pc = g._priorite(centre)
  const pb = g._priorite(bord)
  const pl = g._priorite(loin)
  assert.ok(pc > pb, `centre ${pc.toFixed(2)} doit passer avant bord ${pb.toFixed(2)}`)
  assert.ok(pb > pl, `bord ${pb.toFixed(2)} doit passer avant loin ${pl.toFixed(2)}`)
  // et sous le centre, le plus grossier d'abord : il couvre plus d'écran par requête
  const { x: x6, y: y6 } = latLonToTile(LAT, LON, 6)
  const grossiere = g._ensureTile(6, Math.floor(x6), Math.floor(y6))
  assert.ok(g._priorite(grossiere) > pc, 'à égalité de centre, la tuile z6 passe avant la z8')
  // les racines et le socle restent au-dessus de tout
  assert.ok(1e9 > g._priorite(grossiere) && 9e8 > g._priorite(grossiere), 'une priorité suivie ne doit jamais dépasser celles du socle (9e8) ni des racines (1e9)')
  g.dispose()
})

// ───────────────────────────────────────── ② la pompe part en fin d'image
test('② pendant `_traverse`, AUCUNE requête ne part ; en fin d image, les six meilleures partent', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 1500000)
  await calme(g) // les seize racines
  tenir = true
  let enParcours = false
  let partiesEnParcours = 0
  const travOrig = g._traverse.bind(g)
  let profondeur = 0
  g._traverse = function (t, p, d) {
    if (profondeur++ === 0) enParcours = true
    try { return travOrig(t, p, d) } finally { if (--profondeur === 0) enParcours = false }
  }
  const fetchOrig = globalThis.fetch
  globalThis.fetch = (url) => { if (enParcours) partiesEnParcours++; return fetchOrig(url) }
  const deja = parties.length // les seize racines sont déjà parties
  try {
    g.update(cam, 0.016)
  } finally { globalThis.fetch = fetchOrig }
  assert.equal(partiesEnParcours, 0, `${partiesEnParcours} requête(s) parties PENDANT le parcours — la pompe doit se taire jusqu à la fin de l image`)
  const salve = parties.slice(deja)
  assert.ok(salve.length > 0, 'le banc n a rien demandé : la caméra ne raffine pas')
  assert.ok(g.queue.length > 0, 'le banc ne remplit pas la file : rien à départager')
  // ce qui est parti vaut mieux que tout ce qui attend encore
  const enVol = salve.map(zxyDe).map((k) => g.tiles.get(k.key))
  const pMin = Math.min(...enVol.map((t) => g._priorite(t)))
  const pMaxFile = Math.max(...g.queue.map((e) => e.priority))
  assert.ok(pMin >= pMaxFile, `une tuile en attente (${pMaxFile.toFixed(2)}) vaut mieux qu une tuile partie (${pMin.toFixed(2)})`)
  // et la tuile sous le centre de l'écran est partie dans la première salve
  const { x, y } = latLonToTile(LAT, LON, 3)
  const nadir = `3/${Math.floor(x)}/${Math.floor(y)}`
  assert.ok(salve.some((u) => zxyDe(u)?.key === nadir), `la tuile z3 sous le centre (${nadir}) n est pas dans la première salve : ${salve.map((u) => zxyDe(u)?.key).join(' ')}`)
  await relacher()
  await calme(g)
  g.dispose()
})

// ───────────────────────────────────────── ① rien hors du champ
test('① aucune tuile hors du champ n est demandée, et la règle sans-trou n attend pas celles qui le sont', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 1500000)
  const camDir = cam.position.clone().normalize()
  await calme(g)
  const demandees = []
  const reqOrig = g._request.bind(g)
  g._request = function (t, priority) {
    const avant = t.state
    const r = reqOrig(t, priority)
    if (avant === 'empty' && t.state === 'loading') demandees.push(t)
    return r
  }
  await converger(g, cam)
  const horsChamp = demandees.filter((t) => t.z > ROOT_Z && !g._dansLeChamp(t, camDir))
  assert.ok(demandees.length > 30, `le banc n a demandé que ${demandees.length} tuiles`)
  assert.equal(horsChamp.length, 0, `${horsChamp.length} tuile(s) hors du champ demandée(s) : ${horsChamp.slice(0, 6).map((t) => t.key).join(' ')}`)
  // la règle sans-trou relâchée : un parent RAFFINÉ peut avoir un enfant hors
  // champ qui n'est pas prêt — et il en existe forcément au bord du tronc
  let relaches = 0
  let trous = 0
  for (const t of g.tiles.values()) {
    if (!t.refined) continue
    for (const k of g._children(t)) {
      if (k.state === 'ready' && k.mesh) continue
      if (g._dansLeChamp(k, camDir)) trous++ // un enfant VISIBLE non prêt sous un parent raffiné : un trou
      else relaches++
    }
  }
  assert.equal(trous, 0, `${trous} enfant(s) visible(s) non prêt(s) sous un parent raffiné — un trou à l écran`)
  assert.ok(relaches > 0, 'le banc ne rencontre aucun enfant hors champ sous un parent raffiné : la règle relâchée n est pas exercée')
  // et ce que ça achète : moins de tuiles chargées que de tuiles CRÉÉES
  let pretes = 0
  for (const t of g.tiles.values()) if (t.state === 'ready') pretes++
  assert.ok(pretes < g.tiles.size, `toutes les tuiles créées ont été chargées (${pretes}/${g.tiles.size}) : les enfants hors champ sont partis sur le réseau`)
  g.dispose()
})

// ───────────────────────────────────────── ④ la file suit la caméra
test('④ la caméra bouge : la file est RECLASSÉE, et la prochaine requête est la meilleure pour la NOUVELLE vue', async () => {
  const g = neuf()
  const camA = camera(LAT, LON, 1500000)
  await calme(g) // les racines
  tenir = true
  g.update(camA, 0.016) // la première frontière : les z3, six en vol, le reste en file
  assert.ok(g.queue.length >= 2, `le banc n a pas de file à reclasser sous A (file ${g.queue.length})`)
  // un pas de côté qui garde la MÊME frontière de quadtree, mais déplace le centre
  const camB = camera(LAT, LON + 6, 1500000)
  g.update(camB, 0.016)
  const enVolAvant = parties.length
  assert.ok(g.queue.length >= 2 && retenues.length > 0, `le banc n a pas de file à reclasser (file ${g.queue.length}, en vol ${retenues.length})`)
  // ⚠️ témoin : au moins une entrée suivie a CHANGÉ de priorité avec la caméra
  const avecA = g.queue.map((e) => e.priority)
  g._preparerTriSpatial(camA, camA.position) // ce que `_priorite` verrait avec A
  const recalcA = g.queue.map((e) => (e.suivie ? g._priorite(e.t) : e.priority))
  g._preparerTriSpatial(camB, camB.position)
  assert.ok(avecA.some((p, i) => Math.abs(p - recalcA[i]) > 1e-6), 'la file porte les priorités de la vue A : elle n a pas été reclassée pour B')
  // on libère UNE réponse : la pompe repart, et doit prendre la meilleure pour B
  await relacher(1)
  assert.equal(parties.length, enVolAvant + 1, 'une seule requête devait partir après une seule réponse')
  const partie = g.tiles.get(zxyDe(parties[parties.length - 1]).key)
  const pPartie = g._priorite(partie)
  const pReste = g.queue.length ? Math.max(...g.queue.map((e) => e.priority)) : -Infinity
  assert.ok(pPartie >= pReste, `partie à ${pPartie.toFixed(2)} alors qu une entrée vaut ${pReste.toFixed(2)} pour la vue B`)
  await relacher()
  await calme(g)
  g.dispose()
})

// ───────────────────────────────────────── le contrat des appelants fixes
test('les priorités FIXES (racines 1e9, socle, réessai 0) ne sont pas reclassées', async () => {
  const g = neuf()
  await calme(g)
  tenir = true
  const t = g._ensureTile(9, 264, 186)
  g._request(t, 9e8)
  const u = g._ensureTile(9, 265, 186)
  g._request(u) // suivie
  const cam = camera(LAT, LON, 1500000)
  g.update(cam, 0.016)
  const eT = g.queue.find((e) => e.t === t)
  const eU = g.queue.find((e) => e.t === u)
  // l'une ou l'autre a pu partir dans la salve de fin d'image : ce qui compte
  // est ce qu'en dit la file quand elle y est encore
  if (eT) assert.equal(eT.priority, 9e8, 'une priorité fixe a été reclassée')
  if (eU) assert.ok(eU.priority < 1e4, `une priorité suivie vaut ${eU.priority}`)
  assert.equal(MAX_Z, 15, 'le départage par niveau de `_priorite` suppose MAX_Z = 15 (0,1 par niveau, 1,3 au plus)')
  await relacher()
  await calme(g)
  g.dispose()
})
