// LE RAFFINEMENT PARTIEL, LE RECHARGEMENT SUR PLACE, LES ENFANTS PROTÉGÉS, LA
// PRÉLECTURE — R37, « le flou de zoom ».
//
// **Adrien, vidéo du 2026-09-03 :** « je vois les zones déjà chargées qui
// redeviennent floues puis se remettent en haute définition à chaque niveau ».
//
// Ce que ces tests mordent, et que rien d'autre ne mordait :
//   ① `_decouperEnQuadrants` : l'index d'une tuile bâtie se réordonne par
//      quadrant (uv), la jupe en dernier, sans perdre ni doubler un triangle ;
//   ② à MI-CHARGEMENT, les enfants prêts se dessinent et le parent ne se
//      dessine que SOUS les manquants — masque ↔ groupes ↔ matériau ; et le
//      matériau redevient le partagé à l'image suivante ;
//   ③ la COUVERTURE : sur un vrai quadtree, chaque point du champ est dessiné
//      par exactement UNE tuile (ou un quadrant de parent), à mi-chargement ;
//   ④ `redemanderSurPlace` : une tuile prête que le flux redemande ne cesse
//      JAMAIS d'être dessinée — le maillage n'est remplacé qu'à l'arrivée ; et
//      `demanderEmprise` (étape 3) passe par là quand le globe sait faire ;
//   ⑤ l'éviction ne prend une tuile dont le PARENT est dessiné qu'après toutes
//      les autres non porteuses ;
//   ⑥ la prélecture ne part qu'en DESCENTE, pour les enfants du champ, à une
//      priorité en retrait de la clé de PF2.
//
// ⚠️ **SUR UN VRAI QUADTREE, PAS SUR UNE MAQUETTE** (harnais de
// `test/veille-repos.test.js` ⑦) : un DOM bouché, un réseau qui COMPTE et
// qu'on peut RETENIR, une caméra complète.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)
const dalles = new Map()
function dalleDe(cote) {
  let d = dalles.get(cote)
  if (!d) {
    d = new Uint8ClampedArray(cote * cote * 4)
    for (let i = 0; i < cote * cote; i++) { d[i * 4] = ER; d[i * 4 + 1] = EG; d[i * 4 + 2] = EB; d[i * 4 + 3] = 255 }
    dalles.set(cote, d)
  }
  return d
}
class FauxCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) { return { data: dalleDe(w) } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FauxCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// le réseau : compte, et peut RETENIR ses réponses (porte)
const urls = new Set()
const retenues = [] // { url, resoudre }
let porte = false
function servir() {
  urls.clear()
  retenues.length = 0
  porte = false
  globalThis.fetch = async (url) => {
    urls.add(url)
    if (porte) await new Promise((r) => retenues.push({ url, resoudre: r }))
    else await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}
const lacher = () => { const r = retenues.splice(0); porte = false; for (const e of r) e.resoudre() }

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
const { _resetDemSource } = await import('../src/dem-source.js')
const { creerFlux, demanderEmprise } = await import('../src/monde/flux-terrain.js')

const LAT = -21.115
const LON = 55.53
const FOV = 30

function poserCamera(camera, rayon) {
  latLonToSphere(LAT, LON, rayon, camera.position)
  camera.near = Math.min(Math.max((rayon - R_GLOBE) * 0.2, 0.01), 0.5)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}
async function calme(globe, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}
const tour = () => new Promise((r) => setTimeout(r, 0))

// un globe descendu à `rayons` (le dernier est la pose de mesure)
async function globeDescendu(rayons = [140, 120, 108, 103, 101.5, 100.6, 100.3, 100.2], { prelecture = true } = {}) {
  servir()
  _resetTileMemo()
  _resetDemSource()
  const globe = new Globe({ globeContinu: true })
  globe.prelecture = prelecture
  globe.setVisible(true)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  for (const r of rayons) {
    poserCamera(camera, r)
    for (let k = 0; k < 6; k++) { globe.update(camera, 0.016); await calme(globe) }
  }
  return { globe, camera }
}

// la tuile DESSINÉE (ou le quadrant de parent dessiné) sous un lat/lon — et
// combien de tuiles y dessinent : la couverture doit valoir exactement un
const R2D = 180 / Math.PI
function tuileXY(lat, lon, z) {
  const n = 2 ** z
  const la = lat / R2D
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)]
}
export function couvrent(globe, lat, lon) {
  const out = []
  for (let z = 2; z <= 15; z++) {
    const [x, y] = tuileXY(lat, lon, z)
    const t = globe.tiles.get(`${z}/${x}/${y}`)
    if (!t || !t.mesh || !t.mesh.visible) continue
    if (t._partiel) {
      // le parent ne dessine que les quadrants du masque : lequel porte le point ?
      const [cx, cy] = tuileXY(lat, lon, z + 1)
      const bit = 1 << ((cx & 1) + ((cy & 1) << 1))
      if (!(t._partiel & bit)) continue
    }
    out.push(t)
  }
  return out
}
function latLonDe(z, x, y) {
  const n = 2 ** z
  return { lon: (x / n) * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * R2D }
}
// la couverture du CHAMP : une grille de points dans l'emprise des tuiles
// dessinées, chaque point dessiné exactement une fois
function couvertureDuChamp(globe, camera) {
  const camDir = camera.position.clone().normalize()
  let points = 0, trous = 0, doubles = 0
  for (const t of globe.tiles.values()) {
    if (!t.mesh || !t.mesh.visible || !globe._dansLeChamp(t, camDir)) continue
    // 4 × 4 points dans la tuile, à l'intérieur (pas sur les arêtes)
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const nw = latLonDe(t.z, t.x + (i + 0.5) / 4, t.y + (j + 0.5) / 4)
      const n = couvrent(globe, nw.lat, nw.lon).length
      points++
      if (n === 0) trous++
      else if (n > 1) doubles++
    }
  }
  return { points, trous, doubles }
}

// ═══════════════════════════════════════ ① la découpe par quadrant ═══════════

test('① `_decouperEnQuadrants` : chaque triangle va dans le quadrant de son centroïde uv, la jupe en dernier, rien de perdu', async () => {
  const { globe } = await globeDescendu([140, 120, 108])
  const t = [...globe.tiles.values()].find((t) => t.z >= 4 && t.mesh)
  assert.ok(t, 'aucune tuile bâtie')
  const geo = t.mesh.geometry
  const avant = new Set()
  for (let i = 0; i < geo.index.count; i += 3) avant.add([geo.index.array[i], geo.index.array[i + 1], geo.index.array[i + 2]].sort((a, b) => a - b).join('/'))
  const nV = geo.userData.jupe.nV
  const q = globe._decouperEnQuadrants(geo)
  assert.equal(geo.groups.length, 5)
  assert.equal(q.compte.reduce((s, v) => s + v, 0) * 3, geo.index.count, 'des triangles se sont perdus ou doublés')
  const uv = geo.attributes.uv
  const apres = new Set()
  for (let g = 0; g < 5; g++) {
    const gr = geo.groups[g]
    assert.equal(gr.start, q.debut[g] * 3)
    assert.equal(gr.count, q.compte[g] * 3)
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const a = geo.index.array[i], b = geo.index.array[i + 1], c = geo.index.array[i + 2]
      apres.add([a, b, c].sort((x, y) => x - y).join('/'))
      const jupe = a >= nV || b >= nV || c >= nV
      if (g === 4) { assert.ok(jupe, `un triangle de surface dans le groupe jupe (${i})`); continue }
      assert.ok(!jupe, `un triangle de jupe dans le quadrant ${g}`)
      const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3
      const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3
      const attendu = (u >= 0.5 ? 1 : 0) + (v < 0.5 ? 2 : 0)
      assert.equal(attendu, g, `triangle (${u.toFixed(2)}, ${v.toFixed(2)}) classé dans le quadrant ${g}`)
    }
    assert.ok(gr.count > 0, `quadrant ${g} vide`)
  }
  assert.deepEqual([...apres].sort(), [...avant].sort(), 'l’ensemble des triangles a changé')
  assert.equal(geo.userData.quadrants.index, geo.index)
  globe.dispose()
})

// ═══════════════════════════════ ② à mi-chargement : le parent SOUS le manquant

test('② MI-CHARGEMENT : les trois enfants prêts se dessinent, le parent seulement sous le quatrième — et le matériau redevient entier à l’image suivante', async () => {
  const { globe, camera } = await globeDescendu()
  const camPos = camera.position
  const camDir = camPos.clone().normalize()
  // un parent raffiné dont les quatre enfants sont prêts et dans le champ
  let cible = null
  for (const t of globe.tiles.values()) {
    if (!t.refined || t.state !== 'ready' || !t.mesh) continue
    const kids = globe._children(t)
    // des enfants FEUILLES (dessinés eux-mêmes), pour que « sous l'enfant » soit l'enfant
    if (kids.length === 4 && kids.every((k) => k.state === 'ready' && k.mesh && k.mesh.visible && globe._dansLeChamp(k, camDir))) { cible = { t, kids }; break }
  }
  assert.ok(cible, 'le harnais ne produit aucun parent aux quatre enfants prêts dans le champ')
  const { t, kids } = cible
  const manquant = kids[2]
  const bit = 1 << ((manquant.x & 1) + ((manquant.y & 1) << 1))
  // le quatrième repart en chargement — l'instant exact du défaut d'Adrien
  manquant.state = 'loading'
  const meshManquant = manquant.mesh
  manquant.mesh = null
  globe.update(camera, 0.016)
  for (const k of kids) if (k !== manquant) assert.ok(k.mesh.visible || k.refined, `l’enfant prêt ${k.key} n’est pas dessiné`)
  assert.equal(t.mesh.visible, true, 'le parent ne se dessine pas sous le manquant')
  assert.equal(t._partiel, bit, 'le masque du parent n’est pas le quadrant du manquant')
  assert.equal(t.refined, false, '`refined` garde son sens d’avant : les quatre enfants dessinent')
  assert.ok(Array.isArray(t.mesh.material), 'le parent partiel doit porter un tableau de matériaux')
  assert.equal(t.mesh.material[1].visible, false)
  const groupes = t.mesh.geometry.groups
  const dessines = groupes.slice(0, 4).map((g) => g.materialIndex === 0)
  assert.deepEqual(dessines.map((d) => (d ? 1 : 0)), [0, 1, 2, 3].map((i) => (bit & (1 << i) ? 1 : 0)), 'les groupes ne suivent pas le masque')
  assert.equal(groupes[4].materialIndex, 0, 'la jupe se dessine avec le parent')
  assert.ok(globe._nPartiels >= 1)
  // et personne ne dessine deux fois : sous les trois enfants prêts, le parent est masqué
  for (const k of kids) {
    if (k === manquant) continue
    const c = latLonDe(k.z, k.x + 0.5, k.y + 0.5)
    const qui = couvrent(globe, c.lat, c.lon)
    assert.equal(qui.length, 1, `sous ${k.key} : ${qui.map((q) => q.key).join(', ')}`)
    assert.ok(qui[0].z >= k.z, `sous ${k.key}, c'est ${qui[0].key} qui dessine`)
  }
  const c = latLonDe(manquant.z, manquant.x + 0.5, manquant.y + 0.5)
  assert.deepEqual(couvrent(globe, c.lat, c.lon).map((q) => q.key), [t.key], 'sous le manquant, c’est le parent et lui seul')
  // le quatrième revient : plus de partiel, matériau entier
  manquant.state = 'ready'
  manquant.mesh = meshManquant
  globe.update(camera, 0.016)
  assert.equal(t.mesh.visible, false)
  assert.equal(t._partiel, 0)
  assert.ok(!Array.isArray(t.mesh.material), 'le matériau n’est pas redevenu le partagé')
  assert.equal(t.refined, true)
  // ⚠️ le levier débrayé rend l'ancienne règle — c'est l'A/B du banc
  manquant.state = 'loading'; manquant.mesh = null
  globe.raffinementPartiel = false
  globe.update(camera, 0.016)
  assert.equal(t.mesh.visible, true)
  assert.equal(t._partiel, 0)
  for (const k of kids) if (k !== manquant) assert.ok(!k.mesh.visible && !k.refined, 'sans le levier, un enfant prêt se dessine encore')
  manquant.state = 'ready'; manquant.mesh = meshManquant
  globe.dispose()
})

// ═══════════════════════════════ ③ la couverture, à mi-chargement, sur un vrai réseau

test('③ COUVERTURE : pendant un chargement retenu, chaque point du champ est dessiné par exactement une tuile — zéro trou, zéro doublon', async () => {
  const { globe, camera } = await globeDescendu([140, 120, 108, 103, 101.5])
  const c0 = couvertureDuChamp(globe, camera)
  assert.ok(c0.points > 200, `le banc ne couvre que ${c0.points} points`)
  assert.equal(c0.trous, 0); assert.equal(c0.doubles, 0)
  // on descend d'un cran en RETENANT le réseau : les enfants arrivent un par un
  porte = true
  poserCamera(camera, 100.6)
  let partielsVus = 0
  let pire = { trous: 0, doubles: 0 }
  for (let k = 0; k < 40; k++) {
    globe.update(camera, 0.016)
    const c = couvertureDuChamp(globe, camera)
    pire = { trous: Math.max(pire.trous, c.trous), doubles: Math.max(pire.doubles, c.doubles) }
    partielsVus = Math.max(partielsVus, globe._nPartiels)
    // une réponse à la fois
    const e = retenues.shift()
    if (e) e.resoudre()
    await tour(); await tour()
  }
  lacher()
  await calme(globe)
  assert.ok(partielsVus > 0, 'le banc n’a produit aucun parent partiel : rien n’est mesuré')
  assert.equal(pire.trous, 0, `${pire.trous} trou(s) pendant le chargement`)
  assert.equal(pire.doubles, 0, `${pire.doubles} point(s) dessinés deux fois pendant le chargement`)
  globe.dispose()
})

// ═══════════════════════════════ ④ le rechargement sur place

test('④ `redemanderSurPlace` : la tuile reste dessinée pendant tout le vol, le maillage n’est remplacé qu’à l’arrivée', async () => {
  const { globe, camera } = await globeDescendu([140, 120, 108, 103])
  const t = [...globe.tiles.values()].find((t) => t.state === 'ready' && t.mesh && t.mesh.visible && t.z > 2)
  assert.ok(t)
  const ancien = t.mesh
  _resetTileMemo() // sinon la mémoire de tuiles répond sans réseau, et la porte ne retient rien
  porte = true
  globe.gardeHauteurs = new Set([t.key])
  t.heights = null
  assert.equal(globe.redemanderSurPlace(t, 1e9), true)
  assert.equal(t.state, 'ready')
  assert.equal(t.mesh, ancien, 'le maillage a été jeté avant l’arrivée')
  assert.equal(globe.redemanderSurPlace(t, 1e9), true, 'un second appel en vol doit être idempotent')
  assert.equal(globe.queue.filter((e) => e.t === t).length + globe.inFlight, 1, 'deux requêtes pour la même tuile')
  for (let k = 0; k < 5; k++) {
    globe.update(camera, 0.016)
    assert.equal(t.mesh, ancien)
    assert.equal(t.mesh.visible, true, `image ${k} : la tuile a cessé d’être dessinée pendant le vol`)
    await tour()
  }
  lacher()
  await calme(globe)
  assert.equal(t.state, 'ready')
  assert.ok(t.mesh && t.mesh !== ancien, 'le maillage n’a pas été remplacé à l’arrivée')
  assert.ok(t.heights, 'les hauteurs réservées ne sont pas gardées')
  assert.equal(t.mesh.visible, true, 'le maillage neuf est né invisible : un trou d’une image')
  assert.equal(t.enVolSurPlace, false)
  assert.equal(ancien.parent, null, 'l’ancien maillage est resté dans le groupe')
  globe.update(camera, 0.016)
  assert.equal(t.mesh.visible, true)
  // une tuile qui n'est pas prête suit l'ancien chemin
  const vide = [...globe.tiles.values()].find((t) => t.state !== 'ready' || !t.mesh) || { state: 'empty', mesh: null }
  assert.equal(globe.redemanderSurPlace(vide, 1e9), false)
  globe.dispose()
})

test('④ bis `demanderEmprise` (étape 3) passe par le rechargement sur place : plus un seul maillage jeté pour des hauteurs', async () => {
  const { globe, camera } = await globeDescendu([140, 120, 108, 103, 101.5])
  const flux = creerFlux({ globe })
  const dessinees = [...globe.tiles.values()].filter((t) => t.mesh && t.mesh.visible && t.z >= 8)
  assert.ok(dessinees.length > 0)
  const z = dessinees[0].z
  const t = dessinees[0]
  const nw = latLonDe(t.z, t.x, t.y), se = latLonDe(t.z, t.x + 1, t.y + 1)
  const emprise = { ouest: nw.lon, est: se.lon, sud: Math.min(nw.lat, se.lat), nord: Math.max(nw.lat, se.lat) }
  const maillages = new Map(dessinees.map((t) => [t.key, t.mesh]))
  _resetTileMemo()
  porte = true
  urls.clear()
  demanderEmprise(flux, { emprise, zoom: z })
  assert.ok(globe.gardeHauteurs.has(t.key), 'la tuile n’est pas réservée par le flux')
  // pendant le vol, rien n'a été jeté ni rendu à `empty`
  globe.update(camera, 0.016)
  for (const [key, mesh] of maillages) {
    const tt = globe.tiles.get(key)
    if (!globe.gardeHauteurs.has(key)) continue
    assert.equal(tt.state, 'ready', `${key} rendue à ${tt.state} par le flux`)
    assert.equal(tt.mesh, mesh, `${key} : maillage jeté avant l’arrivée`)
    assert.equal(tt.mesh.visible, true)
  }
  assert.ok([...globe.tiles.values()].some((t) => t.enVolSurPlace), 'aucun rechargement sur place n’est parti')
  lacher()
  await calme(globe)
  assert.ok(t.heights, 'le flux n’a pas obtenu ses hauteurs')
  // un globe de papier sans la méthode suit l'ancien chemin — le test de
  // flux-terrain le garde ; ici on vérifie seulement que le chemin est CHOISI
  globe.dispose()
})

// ═══════════════════════════════ ⑤ l'éviction protège les enfants d'un parent dessiné

test('⑤ ÉVICTION : une tuile dont le parent est dessiné ne part qu’après toutes les autres non porteuses', () => {
  const g = Object.create(Globe.prototype)
  g.tiles = new Map()
  g.gardeHauteurs = new Set()
  g.group = { remove() {} }
  g.queue = []
  g.frame = 10
  g.continu = true
  g._cropAttendu = false
  g._echoue = new Map()
  g.protegerEnfants = true
  g._partiels = new Set()
  const faire = (z, x, y, { visible = false, lastUsed = 5 } = {}) => {
    const t = { key: `${z}/${x}/${y}`, z, x, y, state: 'ready', lastUsed, coverFrame: visible ? 10 : 0, mesh: { visible, geometry: { dispose() {} }, material: {} }, texture: null }
    g.tiles.set(t.key, t)
    return t
  }
  for (let i = 0; i < 16; i++) faire(2, i % 4, (i / 4) | 0)
  const parent = faire(6, 10, 10, { visible: true })
  const enfants = [[20, 20], [21, 20], [20, 21], [21, 21]].map(([x, y]) => faire(7, x, y, { lastUsed: 9 })) // récents, non porteurs
  const autres = []
  for (let i = 0; i < 6; i++) autres.push(faire(7, 40 + i, 40, { lastUsed: 9 })) // aussi récents, parent NON dessiné
  g._evictJusqua(g.tiles.size - 6)
  for (const k of enfants) assert.ok(g.tiles.has(k.key), `${k.key} évincée alors que son parent est dessiné`)
  for (const a of autres) assert.ok(!g.tiles.has(a.key), `${a.key} gardée alors que ${enfants[0].key} aurait dû passer après`)
  // et le plafond DUR reste atteignable : au-delà des autres, les enfants partent
  g._evictJusqua(g.tiles.size - 2)
  assert.equal(enfants.filter((k) => g.tiles.has(k.key)).length, 2)
  // débrayé : l'ancien ordre (ancienneté, puis profondeur)
  const g2 = Object.create(Globe.prototype)
  Object.assign(g2, { tiles: new Map(), gardeHauteurs: new Set(), group: { remove() {} }, queue: [], frame: 10, continu: true, _cropAttendu: false, _echoue: new Map(), protegerEnfants: false, _partiels: new Set() })
  g2.tiles.set('6/10/10', { key: '6/10/10', z: 6, x: 10, y: 10, state: 'ready', lastUsed: 10, coverFrame: 10, mesh: { visible: true, geometry: { dispose() {} }, material: {} } })
  g2.tiles.set('7/20/20', { key: '7/20/20', z: 7, x: 20, y: 20, state: 'ready', lastUsed: 3, coverFrame: 0, mesh: { visible: false, geometry: { dispose() {} }, material: {} } })
  g2.tiles.set('7/40/40', { key: '7/40/40', z: 7, x: 40, y: 40, state: 'ready', lastUsed: 9, coverFrame: 0, mesh: { visible: false, geometry: { dispose() {} }, material: {} } })
  g2._evictJusqua(2)
  assert.ok(!g2.tiles.has('7/20/20'), 'sans le levier, la plus ancienne part la première')
})

// ═══════════════════════════════ ⑥ la prélecture

test('⑥ PRÉLECTURE : en descente seulement, les enfants du champ d’une tuile proche du seuil partent en retrait de la clé de PF2', async () => {
  const { globe, camera } = await globeDescendu([140, 120, 108, 103], { prelecture: false })
  globe.prelecture = true
  // une pose où des tuiles dessinées sont entre PRELECTURE_RATIO et SPLIT_RATIO
  const trouverPose = () => {
    const camDir = camera.position.clone().normalize()
    for (const t of globe.tiles.values()) {
      if (!t.mesh || !t.mesh.visible || t.refined) continue
      const dist = camera.position.distanceTo(t.center) - t.chord * 0.5
      const ratio = t.chord / Math.max(dist, 1e-6)
      if (!(ratio > 0.38 * 0.7 && ratio <= 0.38)) continue
      if (globe._priorite(t) < 850) continue // la prélecture ne part qu'au centre de l'écran
      // avec au moins un enfant dans le champ (au bord de l'écran, la boîte d'un enfant peut être dehors)
      if (globe._children(t).some((k) => globe._dansLeChamp(k, camDir))) return t
    }
    return null
  }
  // même caméra, image de plus : PAS de descente → aucune prélecture
  urls.clear()
  globe.update(camera, 0.016)
  await calme(globe)
  assert.equal(globe._descend, false)
  assert.equal(globe._prelues, 0, 'une prélecture est partie sans descente')
  // on descend un peu : la direction est connue
  poserCamera(camera, 102.6)
  urls.clear()
  globe.update(camera, 0.016)
  assert.equal(globe._descend, true)
  const t = trouverPose()
  assert.ok(t, 'aucune tuile dessinée n’est entre le ratio de prélecture et le seuil')
  const camDir = camera.position.clone().normalize()
  const kids = globe._children(t).filter((k) => globe._dansLeChamp(k, camDir))
  assert.ok(kids.length > 0, 'aucun enfant dans le champ')
  for (const k of kids) assert.ok(k.state === 'loading' || k.state === 'ready', `l’enfant ${k.key} (${k.state}) n’a pas été prélu`)
  assert.ok(globe._prelues > 0, `_prelues = ${globe._prelues} (${[...globe.tiles.values()].filter((k) => k.state === 'loading').length} en chargement)`)
  // la priorité : en retrait de la clé de PF2, donc DERRIÈRE toute demande suivie
  const prelues = globe.queue.filter((e) => !e.suivie && e.priority < 1e8)
  const suivies = globe.queue.filter((e) => e.suivie)
  if (prelues.length && suivies.length) {
    assert.ok(Math.max(...prelues.map((e) => e.priority)) < Math.min(...suivies.map((e) => e.priority)), 'une prélecture passe devant une demande de l’image')
  }
  await calme(globe)
  // en REMONTANT, rien ne part
  poserCamera(camera, 103.5)
  urls.clear()
  globe.update(camera, 0.016)
  assert.equal(globe._descend, false)
  assert.equal(globe._prelues, 0, 'une prélecture est partie en remontant')
  // débrayée
  poserCamera(camera, 102.2)
  globe.prelecture = false
  globe.update(camera, 0.016)
  assert.equal(globe._prelues, 0)
  globe.dispose()
})
