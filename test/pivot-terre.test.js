// LE PIVOT EST LE CENTRE DE LA TERRE JUSQU'AU CROP — Tâche R32 (ex-R27).
//
// ══════════ CE QUE CE FICHIER GARDAIT, ET POURQUOI IL A ÉTÉ RÉÉCRIT ════════
//
// R27 gardait ici `decalageRecentrage` — un recentrage de `controls.target`
// sur l'AXE DU BLOC, à 4 px par image — et une visée d'arrivée « sur l'axe »
// hors du crop. Les deux gravaient la même confusion d'espace : `(0, y, 0)` en
// espace bloc est le point de la surface SOUS la caméra, pas le centre de la
// Terre. Le recentrage tirait donc la vue vers un point de la surface après
// chaque geste ; la visée d'arrivée « sur l'axe » faisait sauter le point sous
// la caméra à chaque franchissement (mesuré en espace globe,
// `.banc/R32/avant.json` : 466 km à z4, 197 km à z5, 90 à 129 km à z6, 48 à
// 68 km à z7, 24 km à z8, 12 km à z9, 8,6 km à z10, et 550 km à la traversée).
//
// Le module `pivot-terre.js` est supprimé ; ce fichier garde maintenant ce qui
// vaut en espace globe : la continuité du lieu visé aux franchissements, le
// bloc qui suit la caméra, le plancher z4 de la plongée, et la molette qui vise
// le point au centre de l'écran (D19). La loi de la saisie elle-même est dans
// `test/saisie-terre.test.js` ; le mécanisme transporté par la similitude dans
// `test/pivot-globe.test.js`.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { ZOOM_PALIER_MIN } from '../src/escalier-zoom.js'

function domDePacotille() {
  const el = () => {
    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    e.appendChild = (c) => { e.enfants.push(c); return c }
    e.remove = () => {}
    e.setAttribute = () => {}
    e.addEventListener = () => {}
    e.querySelector = () => el()
    return e
  }
  globalThis.document = { createElement: () => el(), body: el(), addEventListener() {} }
  globalThis.window = globalThis.window ?? { innerWidth: 1280, innerHeight: 800 }
}

async function machine(hooksEnPlus = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const journal = { charges: [], annonces: [] }
  const hooks = {
    zoomContinu: () => true,
    empriseBlocM: () => 1e6,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    // le lieu demandé tombe à 9,42 unités de l'axe — la valeur relevée à
    // l'écran au palier z4 de la descente (`.banc/R27/avant.json`) : c'est le
    // calage du bloc sur la grille de tuiles, jusqu'à un sixième de côté
    viseeDuLieu: () => ({ x: 3.552, z: 8.724 }),
    async loadSurface(lat, lon, zoom) { journal.charges.push({ lat, lon, zoom }) },
    ...hooksEnPlus,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.announce = (t) => journal.annonces.push(t)
  m.mode = 'surface'
  camera.position.set(0, 32, 0)
  return { m, camera, controls, journal, THREE }
}

// ══════════ ① LA VISÉE D'ARRIVÉE EST LE LIEU DEMANDÉ, DES DEUX CÔTÉS DU CROP ═

test('① HORS DU CROP, la visée d’arrivée est le LIEU DEMANDÉ — plus l’axe du bloc calé sur la grille', async () => {
  // ⛔ R27 rendait (0, Y_CIBLE, 0) ici, et le point sous la caméra sautait de
  // 8,6 à 466 km à chaque franchissement (`.banc/R32/avant.json`). Le lieu
  // demandé est celui que `getRefineTarget` a lu sous la visée : le viser dans
  // le nouveau bloc, c'est ne pas bouger d'un mètre.
  const { m } = await machine({ horsDuCrop: () => true })
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 3.552)
  assert.equal(c.z, 8.724)
  assert.equal(c.y, Y_CIBLE, 'le `y` n’est pas la question : forcer 0 déplacerait l’altitude de cadrage')
})

test('① bis SUR LE CROP, la visée reste le lieu demandé — les deux côtés font la même chose', async () => {
  const { m } = await machine({ horsDuCrop: () => false })
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 3.552)
  assert.equal(c.z, 8.724)
})

test('① ter SANS LE HOOK, rien ne change — `?terre=deux` est le dépôt d’avant', async () => {
  const { m } = await machine()
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 3.552)
  assert.equal(c.z, 8.724)
  // et sans lieu du tout : le centre du socle, comme toujours
  const d = m._cibleVisee(null)
  assert.equal(d.x, 0); assert.equal(d.z, 0); assert.equal(d.y, Y_CIBLE)
})

test('① quater `_cibleVisee` ne consulte plus `horsDuCrop` — une seule visée, pas deux', () => {
  const src = fs.readFileSync(new URL('../src/modes.js', import.meta.url), 'utf8')
  const i = src.indexOf('_cibleVisee(lieu) {')
  assert.ok(i > 0)
  const corps = src.slice(i, src.indexOf('\n  }', i))
  assert.doesNotMatch(corps, /horsDuCrop/, 'la visée « sur l’axe » hors du crop est revenue : le point sous la caméra resautera aux franchissements')
})

// ══════════ ② LE BLOC SUIT LA CAMÉRA ═══════════════════════════════════════

test('② `recentrerBloc` recharge au MÊME niveau, centré sur le lieu visé, SANS annonce', async () => {
  const { m, journal } = await machine({
    horsDuCrop: () => true,
    lieuVise: () => ({ lat: 45.9, lon: 6.9 }),
    zoomCourant: () => 9,
  })
  const ok = await m.recentrerBloc()
  assert.equal(ok, true)
  assert.deepEqual(journal.charges, [{ lat: 45.9, lon: 6.9, zoom: 9 }])
  assert.deepEqual(journal.annonces, [], 'un recentrage n’est pas un événement pour l’utilisateur')
  assert.equal(m.busy, false)
})

test('② bis `recentrerBloc` refuse pendant un chargement, un vol, un balayage, hors surface, ou sans lieu', async () => {
  const cas = [
    { prepare: (m) => { m.busy = true } },
    { prepare: (m) => { m.travel = {} } },
    { prepare: (m) => { m._fonduPose = {} } },
    { prepare: (m) => { m._diveTween = {} } },
    { prepare: (m) => { m.mode = 'orbital' } },
    { hooks: { lieuVise: () => null } },
    { hooks: { zoomCourant: () => null } },
    { hooks: { zoomContinu: () => false } },
  ]
  for (const c of cas) {
    const { m, journal } = await machine({ horsDuCrop: () => true, lieuVise: () => ({ lat: 1, lon: 2 }), zoomCourant: () => 9, ...(c.hooks ?? {}) })
    c.prepare?.(m)
    assert.equal(await m.recentrerBloc(), false, JSON.stringify(Object.keys(c.hooks ?? { prepare: 1 })))
    assert.deepEqual(journal.charges, [])
  }
})

test('② ter `_rescale` annonce toujours un franchissement ordinaire', async () => {
  const { m, journal } = await machine({ horsDuCrop: () => true })
  await m._rescale({ lat: 45.83, lon: 6.86, zoom: 10 }, 'REFINING')
  assert.equal(journal.annonces.length, 1)
  assert.match(journal.annonces[0], /^REFINING — /)
})

// ══════════ ③ LE PLANCHER DE LA PLONGÉE EST z4 — trouvaille de l’attaquant R33 ═

test('③ la plongée continue ne choisit jamais un bloc plus large que z4', async () => {
  // R33 : « la molette depuis l'orbite plonge sur un bloc z3 à 11 900 km
  // malgré ZOOM_PALIER_MIN = 4 ». `niveauDArrivee` portait un `zoomMin = 3`.
  const { m } = await machine({ horsDuCrop: () => true })
  for (const altM of [11900000, 8000000, 60000000]) {
    const n = m._niveauDArrivee(altM)
    assert.ok(n, `pas de niveau à ${altM} m`)
    assert.ok(n.zoom >= ZOOM_PALIER_MIN, `à ${altM} m, niveau ${n.zoom} < ${ZOOM_PALIER_MIN}`)
  }
  // et au-dessus de ce que z4 peut cadrer, la porte reste fermée (`borne: 'haut'`)
  // — le banc donne à z4 une emprise de 256 000 km, donc il faut monter loin
  const haut = m._niveauDArrivee(1e9)
  assert.equal(haut.borne, 'haut')
  assert.equal(haut.zoom, ZOOM_PALIER_MIN)
})

// ══════════ ④ LA MOLETTE VISE LE POINT AU CENTRE DE L'ÉCRAN — D19 ══════════

test('④ un cran de molette prend son pivot au CENTRE de l’écran, où que soit le curseur', async () => {
  const visites = []
  const { m } = await machine({ horsDuCrop: () => false, pointUnder: (nx, ny) => { visites.push([nx, ny]); return { x: 1, y: 0, z: 2 } } })
  globalThis.performance = globalThis.performance ?? { now: () => Date.now() }
  m._zoomGesture({ deltaY: -100, clientX: 950, clientY: 230, preventDefault() {} })
  assert.deepEqual(visites, [[0, 0]], `le pivot a été lu en ${JSON.stringify(visites)} au lieu du centre (0, 0)`)
  assert.deepEqual({ x: m._zoomPivot.x, y: m._zoomPivot.y, z: m._zoomPivot.z }, { x: 1, y: 0, z: 2 })
})

// ══════════ ⑤ LA PORTE ORBITALE — inchangée depuis R27 ═════════════════════

test('⑤ la porte orbitale s’ouvre AU-DELÀ de z4 — demande ② d’Adrien', async () => {
  const { DIVE_TIERS } = await import('../src/modes.js')
  assert.equal(ZOOM_PALIER_MIN, 4)
  assert.equal(DIVE_TIERS.at(-1).zoom, 4, 'plus aucun bloc plus large que z4')
  let orbite = 0
  const { m } = await machine({ horsDuCrop: () => true, getCoarsenTarget: () => null, getRefineTarget: () => null })
  m.enterOrbit = async () => { orbite++ }
  m._levelZoom = 0.8 // plus d'un niveau plein vers l'extérieur
  m._franchirSiBesoin()
  assert.equal(orbite, 1, 'plus de niveau plus large : la porte orbitale')
})
