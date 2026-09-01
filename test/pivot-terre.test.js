// LE PIVOT RESTE LE CENTRE DE LA TERRE JUSQU'AU CROP — Tâche R27.
//
// ⛔ **CE QUE CE FICHIER GARDE, ET POURQUOI IL EXISTE.** R13 bis avait conclu
// « il n'y a rien à faire » et posé un test qui interdisait d'ajouter une garde
// de crop dans `pivoterAutourDuBloc`. Ce test-là reste juste : l'AZIMUT doit
// tourner autour de l'axe du bloc des deux côtés du crop. Ce que R13 bis avait
// laissé ouvert est ailleurs — **la cible n'est pas SUR cet axe** — et c'est ce
// que garde ce fichier-ci.

import test from 'node:test'
import assert from 'node:assert/strict'
import { decalageRecentrage, PAS_RECENTRAGE_RAD } from '../src/monde/pivot-terre.js'
import { SEUIL_BOUGE_LOG, creerVeilleRepos } from '../src/monde/veille-repos.js'
import { Y_CIBLE } from '../src/loi-altitude.js'

// ══════════ ① LA LOI ════════════════════════════════════════════════════════

test('① sur l’axe, il n’y a rien à corriger — et le pas le DIT', () => {
  const d = decalageRecentrage({ cibleX: 0, cibleZ: 0, distance: 30 })
  assert.deepEqual({ x: d.x, y: d.y, z: d.z }, { x: 0, y: 0, z: 0 })
  assert.equal(d.fini, true, 'la cible est sur l’axe : c’est fini, pas « à refaire »')
})

test('① bis le `y` n’est JAMAIS touché — c’est la moitié de la décision', () => {
  // Le centre de la Terre est sur la VERTICALE du centre du bloc : tout point
  // de `x = z = 0` le vise. Forcer `y` déplacerait `camera.position.y`, donc
  // `altitudeCadrageM()`, donc le seuil de naissance du crop contre lequel le
  // correctif est jugé. Voir l'en-tête de `pivot-terre.js`.
  for (const [cx, cz, dist] of [[9.42, 0, 33], [-2.9, -0.3, 45], [4.87, 6.9, 22]]) {
    assert.equal(decalageRecentrage({ cibleX: cx, cibleZ: cz, distance: dist }).y, 0)
  }
})

test('② le pas est PLAFONNÉ, et le plafond est un ANGLE VU', () => {
  // 12,898 u : le pire écart relevé sur la descente (`.banc/R27/avant.json`)
  const loin = decalageRecentrage({ cibleX: 12.898, cibleZ: 0, distance: 30 })
  assert.equal(loin.fini, false)
  assert.ok(Math.abs(Math.hypot(loin.x, loin.z) - PAS_RECENTRAGE_RAD * 30) < 1e-12,
    'le pas vaut exactement `pasRad × distance`')
  // ⚠️ ET LE PLAFOND EST UN ANGLE, PAS UNE LONGUEUR : à distance double, le pas
  // double. C'est la seule façon pour que le glissement dure le même nombre
  // d'images à 6 unités et à 150.
  const proche = decalageRecentrage({ cibleX: 12.898, cibleZ: 0, distance: 15 })
  assert.ok(Math.abs(Math.hypot(proche.x, proche.z) * 2 - Math.hypot(loin.x, loin.z)) < 1e-12)
})

test('② bis le plafond vaut « quelques pixels », et le chiffre est écrit', () => {
  // 1 350 px par radian sur le canevas du dépôt : `(H/2) / tan(fov/2)` avec
  // H = 800 et fov = 33°. Le nombre n'est pas recopié, il est RECALCULÉ ici.
  const pxParRadian = (800 / 2) / Math.tan((33 / 2) * Math.PI / 180)
  assert.ok(pxParRadian > 1340 && pxParRadian < 1360, `1 350 px/rad attendu, lu ${pxParRadian}`)
  const px = PAS_RECENTRAGE_RAD * pxParRadian
  assert.ok(px > 0 && px <= 5, `le pas doit tenir sous cinq pixels — lu ${px}`)
})

test('③ le DERNIER pas est exact : la cible atterrit sur l’axe, pas à côté', () => {
  // sans ça la correction s'approcherait géométriquement sans jamais finir, et
  // la sonde relèverait un résidu qui décroît — c'est-à-dire un défaut
  // indistinguable d'un bruit.
  let x = 0.0004, z = -0.0002
  const d = decalageRecentrage({ cibleX: x, cibleZ: z, distance: 30 })
  assert.equal(d.fini, true)
  x += d.x; z += d.z
  assert.equal(x, 0, 'EXACTEMENT zéro, pas « proche de »')
  assert.equal(z, 0)
})

test('③ bis le pas ne DÉPASSE jamais : aucune oscillation possible', () => {
  for (const reste of [0.001, 0.05, 0.09, 0.0900000001, 1, 12.898]) {
    const d = decalageRecentrage({ cibleX: reste, cibleZ: 0, distance: 30 })
    assert.ok(Math.hypot(d.x, d.z) <= reste + 1e-12, `un pas de ${Math.hypot(d.x, d.z)} pour ${reste}`)
    assert.ok(d.x <= 0, 'le pas va VERS l’axe (donc négatif ici), jamais dans l’autre sens')
  }
})

test('④ la CONVERGENCE est bornée, et elle finit sur un `fini`', () => {
  let x = 12.898, z = -7.3, n = 0
  while (n < 5000) {
    const d = decalageRecentrage({ cibleX: x, cibleZ: z, distance: 30 })
    x += d.x; z += d.z; n++
    if (d.fini) break
  }
  assert.equal(x, 0); assert.equal(z, 0)
  // 12,898/7,3 → 14,82 u de reste, pas de 0,09 u : ~165 images, soit 2,7 s à
  // 60 Hz. On borne large, ce qui compte est que ça FINISSE.
  assert.ok(n > 100 && n < 300, `${n} images pour recentrer 14,82 u à d = 30`)
})

// ══════════ ⑤ L'INVARIANCE DE LA DISTANCE — CE QUE `veille-repos` VOIT ══════

test('⑤ le pas est RIGIDE : la distance caméra→cible ne bouge pas d’un bit', () => {
  // ⛔ **C'EST LA CONTRAINTE QUI TUE LES CORRECTIFS NAÏFS.** Déplacer la seule
  // cible de 4,46 u à d = 32,34 produit |Δ ln d| ≈ 1,4e-2, soit 140 fois
  // `SEUIL_BOUGE_LOG`. Ajouté aux DEUX, le même vecteur laisse la différence
  // intacte : `(P + δ) − (T + δ) = P − T`.
  const cible = { x: 4.457, y: Y_CIBLE, z: 0.414 }
  const cam = { x: 4.457, y: 32.04, z: 0.414 + 22 }
  const dist = () => Math.hypot(cam.x - cible.x, cam.y - cible.y, cam.z - cible.z)
  const d0 = dist()
  let pire = 0
  for (let i = 0; i < 400; i++) {
    const avant = dist()
    const d = decalageRecentrage({ cibleX: cible.x, cibleZ: cible.z, distance: avant })
    cible.x += d.x; cible.z += d.z
    cam.x += d.x; cam.z += d.z
    pire = Math.max(pire, Math.abs(Math.log(dist() / avant)))
    if (d.fini) break
  }
  assert.equal(cible.x, 0); assert.equal(cible.z, 0)
  assert.equal(dist(), d0, 'la distance est invariante AU BIT, pas « sous le seuil »')
  assert.equal(pire, 0, `|Δ ln d| maximal sur tout le recentrage — lu ${pire}`)
  assert.ok(pire < SEUIL_BOUGE_LOG)
})

test('⑤ bis `veille-repos` ne bascule pas UNE fois sur un recentrage complet', () => {
  // le témoin direct : on lui donne la suite des distances, elle compte.
  const veille = creerVeilleRepos()
  const cible = { x: -9.42, z: 8.72 }
  const cam = { x: -9.42, y: 33.55, z: 8.72 + 24 }
  const dist = () => Math.hypot(cam.x - cible.x, 33.55 + 0.3, cam.z - cible.z)
  veille.maj(dist())
  const basculesAvant = veille.bascules
  for (let i = 0; i < 500; i++) {
    const d = decalageRecentrage({ cibleX: cible.x, cibleZ: cible.z, distance: dist() })
    cible.x += d.x; cible.z += d.z
    cam.x += d.x; cam.z += d.z
    veille.maj(dist())
    if (d.fini) break
  }
  assert.equal(veille.bascules, basculesAvant, 'aucune bascule : la vue n’a pas « bougé »')
  assert.equal(veille.auRepos, true)
  assert.equal(veille.dernierEcart, 0)
})

// ══════════ ⑥ L'INVARIANCE PAR ROTATION — LA LEÇON DE R23 ══════════════════

test('⑥ tourner autour du bloc ne change pas le pas — 0,25 u par tour avait coûté D16 ter', () => {
  // R23 : « un échantillonnage de cercle partant de la cible n'est pas
  // invariant (0,25 u par tour) — il aurait dépensé D16 ter ». Ici le pas ne
  // lit que des coordonnées ABSOLUES ; sa NORME ne peut donc pas dépendre de
  // l'azimut, et sa DIRECTION tourne exactement avec la cible.
  const r = 9.42, distance = 33
  const ref = Math.hypot(...(() => { const d = decalageRecentrage({ cibleX: r, cibleZ: 0, distance }); return [d.x, d.z] })())
  for (let k = 0; k < 64; k++) {
    const a = (2 * Math.PI * k) / 64
    const d = decalageRecentrage({ cibleX: r * Math.cos(a), cibleZ: r * Math.sin(a), distance })
    assert.ok(Math.abs(Math.hypot(d.x, d.z) - ref) < 1e-12, `azimut ${a} : ${Math.hypot(d.x, d.z)} ≠ ${ref}`)
    // et il pointe bien vers l'axe — écart d'angle REPLIÉ sur ]−π, π], sans
    // quoi le tour complet rendrait 2π à l'antiméridien du cercle
    let dAng = Math.atan2(d.z, d.x) - Math.atan2(-Math.sin(a), -Math.cos(a))
    while (dAng > Math.PI) dAng -= 2 * Math.PI
    while (dAng <= -Math.PI) dAng += 2 * Math.PI
    assert.ok(Math.abs(dAng) < 1e-9, `azimut ${a} : le pas pointe à ${dAng} rad de l’axe`)
  }
})

// ══════════ ⑦ LES ENTRÉES QUI NE SONT PAS DES NOMBRES ══════════════════════

test('⑦ une entrée non finie ne DÉPLACE RIEN — même contrat que `veille-repos`', () => {
  const cas = [
    { cibleX: NaN, cibleZ: 0, distance: 30 },
    { cibleX: 0.5, cibleZ: Infinity, distance: 30 },
    { cibleX: 0.5, cibleZ: 0.5, distance: NaN },
    { cibleX: 0.5, cibleZ: 0.5, distance: 0 },
    { cibleX: 0.5, cibleZ: 0.5, distance: -3 },
    { cibleX: 0.5, cibleZ: 0.5, distance: 30, pasRad: 0 },
    {},
    undefined,
  ]
  for (const c of cas) {
    const d = decalageRecentrage(c)
    assert.deepEqual({ x: d.x, y: d.y, z: d.z }, { x: 0, y: 0, z: 0 }, JSON.stringify(c))
    assert.equal(d.fini, false, 'il reste quelque chose à faire : l’image suivante réessaiera')
  }
})

// ══════════ ⑧ LA MACHINE RÉELLE — LA VISÉE D'ARRIVÉE ═══════════════════════

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
  const hooks = {
    zoomContinu: () => true,
    empriseBlocM: () => 1e6,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    // le lieu demandé tombe à 9,42 unités de l'axe — la valeur relevée à
    // l'écran au palier z4 de la descente (`.banc/R27/avant.json`)
    viseeDuLieu: () => ({ x: 3.552, z: 8.724 }),
    ...hooksEnPlus,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  return m
}

test('⑧ HORS DU CROP, la visée d’arrivée est l’axe — et le `y` reste `Y_CIBLE`', async () => {
  const m = await machine({ horsDuCrop: () => true })
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 0, 'x EXACTEMENT sur l’axe')
  assert.equal(c.z, 0)
  assert.equal(c.y, Y_CIBLE, 'le `y` n’est pas la question — voir pivot-terre.js')
})

test('⑧ bis SUR LE CROP, la visée reste le point demandé — c’est l’exception d’Adrien', async () => {
  const m = await machine({ horsDuCrop: () => false })
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 3.552)
  assert.equal(c.z, 8.724)
  assert.equal(c.y, Y_CIBLE)
})

test('⑧ ter SANS LE HOOK, rien ne change — `?terre=deux` est le dépôt d’avant', async () => {
  // ⛔ **CE TÉMOIN N'EST PAS UNE FORMALITÉ.** Le prédicat naturel aurait été
  // `!surLeBloc()` ; or sans `terre unique` il n'y a pas de crop du tout, donc
  // `surLeBloc()` rend faux POUR TOUJOURS et le mode plat hérité aurait perdu
  // sa visée d'un point. `horsDuCrop` porte les DEUX termes, et son absence
  // rend le chemin d'avant.
  const m = await machine()
  const c = m._cibleVisee({ lat: 45.83, lon: 6.86 })
  assert.equal(c.x, 3.552)
  assert.equal(c.z, 8.724)
})

test('⑧ quater la porte orbitale s’ouvre AU-DELÀ de z4 — demande ② d’Adrien', async () => {
  // ⚠️ **UN PLANCHER DE ZOOM N'EST PAS UN SEUIL D'ALTITUDE.** Ce test garde
  // l'INDICE ; l'altitude où la porte s'ouvre est déduite de la géométrie et
  // relevée au navigateur (`rapport-R27.md`).
  const { ZOOM_PALIER_MIN } = await import('../src/escalier-zoom.js')
  const { DIVE_TIERS } = await import('../src/modes.js')
  assert.equal(ZOOM_PALIER_MIN, 4)
  assert.equal(DIVE_TIERS.at(-1).zoom, 4, 'plus aucun bloc plus large que z4')
  // et la machine y va : au plancher, `getCoarsenTarget` rend `null` et c'est
  // `enterOrbit` qui prend le relais — le chemin exact de `_franchirSiBesoin`.
  let orbite = 0
  const m = await machine({ horsDuCrop: () => true, getCoarsenTarget: () => null, getRefineTarget: () => null })
  m.enterOrbit = async () => { orbite++ }
  m._levelZoom = 0.8 // plus d'un niveau plein vers l'extérieur
  m._franchirSiBesoin()
  assert.equal(orbite, 1, 'plus de niveau plus large : la porte orbitale')
})
