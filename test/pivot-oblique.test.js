// PIVOT-OBLIQUE — LE FRANCHISSEMENT NE DÉPLACE PAS LA CAMÉRA (Tâche OBL)
//
// > **Adrien (D19) :** *« quand je scrolle pour zoomer ou dézoomer, je scrolle
// > vers le point visé au centre de l'écran. »*
// > **Adrien :** *« Au zoom, la terre se décale, comme visible dans la vidéo. »*
//
// Mesuré au geste avant correctif (`scripts/sonde-obl.mjs`, 45°, La Réunion) :
// 0,2 px de dérive du point du cadre DANS un niveau, **324 / 199 / 180 px au
// franchissement** z11 → z14. Après : 0,2 / 0,2 / 1,0 px. Ce fichier verrouille
// les quatre gestes du correctif, et chacun a été MUTÉ avant d'être gardé :
//   ① la similitude et sa réciproque (`similitudeBloc`) — round-trip et
//      identité avec `poseFond` ;
//   ② le transport (`transporterPose`) — image invariante quand l'emprise,
//      la moyenne et le calage changent ensemble ;
//   ③ la machine (`Modes._suivreEmprise` + `_rescale`) — avec le crochet
//      `similitudeBloc`, la position PHYSIQUE de la caméra, de la cible et du
//      pivot ne bouge pas au franchissement ; sans le crochet, le chemin
//      d'avant au bit près ;
//   ④ le bouton (`cranZoom`) — homothétie de centre le pivot, comme la molette.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { similitudeBloc, empreinteRepere, transporterPose, cranAutourDuPivot } from '../src/monde/pivot-oblique.js'
import { poseFond, repereGlobe } from '../src/monde/frontiere-rendu.js'
import { R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'
import { Y_CIBLE } from '../src/loi-altitude.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const SRC_MODES = lire('src/modes.js')
const SRC_MAIN = lire('src/main.js')

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// Un bloc z11 à La Réunion (les nombres du relevé `reunion-t45-apres8.json`),
// puis le bloc z12 qui le remplace : emprise ÷2, moyenne −727 → +426 m, calage
// sur la grille de tuiles (l'origine change de lieu).
const Z11 = { lat: -21.25, lon: 55.77, origine: [-4.3058, 4.8464], altitudeAncreM: -726.93, exageration: 2, extentMeters: 54712.25, span: 56, latOrigine: -21.2075, lonOrigine: 55.8105 }
const Z12 = { lat: -21.25, lon: 55.77, origine: [-8.6116, 9.6928], altitudeAncreM: 426.01, exageration: 2, extentMeters: 27356.13, span: 56, latOrigine: -21.2287, lonOrigine: 55.7900 }

// ═══════════════════════════════════════════════════════════════════════════
// ① LA SIMILITUDE ET SA RÉCIPROQUE
// ═══════════════════════════════════════════════════════════════════════════

test('① `similitudeBloc` : la réciproque défait la similitude, au nanomètre', () => {
  const S = similitudeBloc(Z11)
  assert.ok(S && S.k > 0)
  for (const p of [[0, 0, 0], [-4.3, 7.78, 12.92], [20, -0.3, -20], [-4.3058, 1.25, 4.8464]]) {
    const q = S.versBloc(S.versGlobe(p))
    assert.ok(dist3(p, q) < 1e-9, `round-trip : ${p} → ${q}`)
  }
})

test('① bis `similitudeBloc.versGlobe` EST la position de `poseFond` — la caméra transportée est celle qui dessine', () => {
  const S = similitudeBloc(Z11)
  const cam = [-4.3058, 7.7779, 12.9244]
  const pose = poseFond({
    lat: Z11.lat, lon: Z11.lon, origineBloc: [Z11.origine[0], 0, Z11.origine[1]],
    altitudeAncreM: Z11.altitudeAncreM, exageration: Z11.exageration,
    positionBloc: cam, quaternionBloc: [0, 0, 0, 1], extentMeters: Z11.extentMeters, span: Z11.span,
  })
  assert.ok(dist3(S.versGlobe(cam), pose.position) < 1e-9, 'la similitude de `pivot-oblique` diverge de `poseFond`')
  // ⚠️ MUTATION : une ancre sans exagération n'est pas celle de `poseFond`
  const S2 = similitudeBloc({ ...Z11, exageration: 1 })
  assert.ok(dist3(S2.versGlobe(cam), pose.position) > 1e-4, 'la mutation « exagération ignorée » devrait se voir')
  // et le rayon de l'ancre porte bien la moyenne du bloc (R15)
  assert.ok(Math.abs(S.rayon - (R_GLOBE + Z11.altitudeAncreM * (R_GLOBE / EARTH_RADIUS_M) * 2)) < 1e-12)
})

test('① ter sans échelle utilisable, `null` — jamais une planète à NaN', () => {
  assert.equal(similitudeBloc({ ...Z11, extentMeters: 0 }), null)
  assert.equal(similitudeBloc({ ...Z11, lat: NaN }), null)
  assert.equal(similitudeBloc(), null)
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LE TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

test('② `transporterPose` : l’image par la similitude est INVARIANTE quand emprise, moyenne et calage changent ensemble', () => {
  const avant = similitudeBloc(Z11)
  const apres = similitudeBloc(Z12)
  const points = { camera: [-4.3058, 5.498, 9.3], cible: [-4.3058, 1.2554, 4.8464], pivot: [-4.29, 2.916, 3.9] }
  const t = transporterPose({ simAvant: avant, simApres: apres, points })
  for (const k of Object.keys(points)) {
    assert.ok(dist3(avant.versGlobe(points[k]), apres.versGlobe(t[k])) < 1e-9, `${k} a bougé physiquement`)
  }
  // la distance caméra → cible DOUBLE en unités de bloc (l'emprise a été divisée par deux)…
  const dAvant = dist3(points.camera, points.cible)
  const dApres = dist3(t.camera, t.cible)
  assert.ok(Math.abs(dApres / dAvant - Z11.extentMeters / Z12.extentMeters) < 1e-9)
  // … et ce n'est PAS la conversion d'avant (`camY × emprise` conservé, cible à Y_CIBLE) :
  // la caméra transportée n'a ni le `y` doublé ni la cible reposée à −0,3
  assert.ok(Math.abs(t.camera[1] - 2 * points.camera[1]) > 1, 'le transport ne se réduit pas au doublement de camY')
  assert.ok(Math.abs(t.cible[1] - Y_CIBLE) > 0.5, 'la cible transportée n’est pas reposée à Y_CIBLE')
})

test('② bis un pivot absent traverse absent ; un point invalide rend `null`', () => {
  const t = transporterPose({ simAvant: similitudeBloc(Z11), simApres: similitudeBloc(Z12), points: { camera: [0, 1, 2], pivot: null, cible: [NaN, 0, 0] } })
  assert.equal(t.pivot, null)
  assert.equal(t.cible, null)
  assert.ok(Array.isArray(t.camera))
})

test('② ter `empreinteRepere` ignore l’origine et voit emprise, moyenne, exagération, calage', () => {
  const a = empreinteRepere(Z11)
  assert.equal(empreinteRepere({ ...Z11, origine: [9, 9], lat: 0, lon: 0 }), a, 'l’ancre choisie ne fait pas partie du repère')
  assert.notEqual(empreinteRepere({ ...Z11, extentMeters: Z11.extentMeters / 2 }), a)
  assert.notEqual(empreinteRepere({ ...Z11, altitudeAncreM: 0 }), a)
  assert.notEqual(empreinteRepere({ ...Z11, exageration: 1 }), a)
  assert.notEqual(empreinteRepere({ ...Z11, latOrigine: -21.2 }), a)
  assert.equal(empreinteRepere(null), '')
})

test('② quater `cranAutourDuPivot` laisse le pivot immobile : l’identité de `_applyZoom`', () => {
  const pivot = [3, 2, -4]
  const camera = [0, 8, 8]
  const cible = [0, -0.3, 0]
  const f = Math.SQRT1_2
  const h = cranAutourDuPivot({ pivot, camera, cible, facteur: f })
  // T + (C − T)·f + (1 − f)(P − T) = P + (C − P)·f
  const attendu = [0, 1, 2].map((i) => cible[i] + (camera[i] - cible[i]) * f + (1 - f) * (pivot[i] - cible[i]))
  assert.ok(dist3(h.camera, attendu) < 1e-12)
  // la direction caméra → pivot est conservée (le pivot reste sous le même pixel)
  const d0 = [0, 1, 2].map((i) => pivot[i] - camera[i])
  const d1 = [0, 1, 2].map((i) => pivot[i] - h.camera[i])
  const n0 = Math.hypot(...d0), n1 = Math.hypot(...d1)
  assert.ok(Math.abs(d0[0] / n0 - d1[0] / n1) + Math.abs(d0[1] / n0 - d1[1] / n1) + Math.abs(d0[2] / n0 - d1[2] / n1) < 1e-12)
  assert.ok(Math.abs(n1 / n0 - f) < 1e-12)
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LA MACHINE — `Modes`, avec et sans le crochet
// ═══════════════════════════════════════════════════════════════════════════

// `Modes` touche le DOM à la construction (étiquette, rideau) : le même
// document de pacotille que `pivot-molette.test.js`, rien de plus.
function domDePacotille() {
  if (globalThis.document) return
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

async function machine({ crochet = true, pivot = true } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.5, 290)
  const controls = {
    target: new THREE.Vector3(Z11.origine[0], 1.2554, Z11.origine[1]),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: Math.PI * 0.49,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  // l'état du bloc : d'abord Z11, puis Z12 après `loadSurface`
  const etat = { repere: Z11, loadSurface: 0 }
  const hooks = {
    zoomContinu: () => true,
    empriseBlocM: () => etat.repere.extentMeters,
    empriseBlocMAuZoom: () => 1,
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: -21.25, lon: 55.77 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat: -21.25, lon: 55.77, zoom: 12 }),
    getCoarsenTarget: () => null,
    async loadSurface() { etat.loadSurface++; etat.repere = Z12 },
    viseeDuLieu: () => ({ x: Z12.origine[0], z: Z12.origine[1] }),
    horsDuCrop: () => false,
    pointUnder: pivot ? () => ({ x: -4.29, y: 2.916, z: 3.9 }) : undefined,
    arriveeSurLeBloc: () => false,
    surLeBloc: () => true,
    // ⚠️ Le banc rend une similitude à ancre FIXE par repère (en production
    // l'ancre suit la cible et son lat/lon avec elle) : c'est ce qui rend
    // l'invariance vérifiable au nanomètre, sans modèle de Mercator dans le test.
    ...(crochet
      ? {
          similitudeBloc: () => ({ ...etat.repere }),
          similitudeBlocAuLieu: () => ({ ...etat.repere }),
        }
      : {}),
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  camera.position.set(Z11.origine[0], 5.498, Z11.origine[1] + 4.2426) // 45° d'inclinaison, d = 6
  m._zoomPivot = { x: -4.29, y: 2.916, z: 3.9 }
  return { m, camera, controls, etat, THREE }
}

const G = (repere, v) => similitudeBloc(repere).versGlobe([v.x, v.y, v.z])

test('③ AVEC le crochet, un franchissement ne déplace ni la caméra, ni la cible, ni le pivot — en espace GLOBE', async () => {
  const { m, camera, controls, etat } = await machine()
  m._suivreEmprise() // première lecture : mémorise le repère Z11
  const camG = G(Z11, camera.position)
  const cibG = G(Z11, controls.target)
  const pivG = G(Z11, m._zoomPivot)
  const d0 = controls.getDistance()
  await m._rescale({ lat: -21.25, lon: 55.77, zoom: 12 }, 'REFINING')
  assert.equal(etat.loadSurface, 1)
  assert.equal(m.busy, false)
  assert.ok(dist3(G(Z12, camera.position), camG) < 1e-9, `la caméra a bougé de ${dist3(G(Z12, camera.position), camG)} unité-globe`)
  assert.ok(dist3(G(Z12, controls.target), cibG) < 1e-9, 'la cible a bougé')
  assert.ok(dist3(G(Z12, m._zoomPivot), pivG) < 1e-9, 'le pivot a bougé')
  // ⚠️ MUTATION : la cible n'est PAS reposée à `Y_CIBLE` sous le crochet
  assert.ok(Math.abs(controls.target.y - Y_CIBLE) > 0.5, 'la cible est retombée à Y_CIBLE : la pose physique est perdue')
  // et la distance a doublé en unités de bloc : c'est ce qu'exige une emprise divisée par deux
  assert.ok(Math.abs(controls.getDistance() / d0 - Z11.extentMeters / Z12.extentMeters) < 1e-9)
})

test('③ bis le suiveur PAR IMAGE transporte aussi quand la MOYENNE seule change (le remplissage du flux)', async () => {
  const { m, camera, controls, etat } = await machine()
  m._suivreEmprise()
  const camG = G(Z11, camera.position)
  const y0 = camera.position.y
  const Z11b = { ...Z11, altitudeAncreM: 12.5 } // même emprise, plan `y = 0` déplacé de 739 m
  etat.repere = Z11b
  m._suivreEmprise()
  assert.ok(dist3(G(Z11b, camera.position), camG) < 1e-9, 'la caméra physique a bougé au changement de moyenne')
  assert.ok(Math.abs(camera.position.y - y0) > 1, 'la caméra n’a pas suivi le plan moyen (camY aurait dû descendre de ~1,5 u)')
  // et rien ne bouge tant que l'empreinte ne bouge pas
  const c1 = camera.position.clone()
  m._suivreEmprise()
  assert.equal(camera.position.distanceTo(c1), 0)
})

test('③ ter `suivreRepere()` est idempotent et ne fait rien hors surface / sans crochet', async () => {
  const { m, camera, etat } = await machine()
  m._suivreEmprise()
  etat.repere = Z12
  assert.equal(m.suivreRepere(), true, 'le transport à la demande doit avoir lieu')
  const c = camera.position.clone()
  assert.equal(m.suivreRepere(), false)
  assert.equal(camera.position.distanceTo(c), 0)
  const sans = await machine({ crochet: false })
  assert.equal(sans.m.suivreRepere(), false)
})

test('③ quater SANS le crochet, le chemin d’avant au bit près : `camY × emprise` conservé, cible à `Y_CIBLE`', async () => {
  const { m, camera, controls } = await machine({ crochet: false })
  m._suivreEmprise()
  const camY = camera.position.y
  await m._rescale({ lat: -21.25, lon: 55.77, zoom: 12 }, 'REFINING')
  assert.ok(Math.abs(controls.target.y - Y_CIBLE) < 1e-12, 'sans crochet la cible doit revenir à Y_CIBLE')
  assert.ok(Math.abs(camera.position.y / camY - 2) < 1e-6, 'sans crochet, camY suit le rapport des emprises')
})

test('③ quinquies le régime orbital et la plongée OUBLIENT le repère mémorisé', async () => {
  const { m, etat } = await machine()
  m._suivreEmprise()
  assert.ok(m._repereVue)
  m.mode = 'orbital'
  m._suivreEmprise()
  assert.equal(m._repereVue, null, 'hors surface, la mémoire doit tomber : un transport depuis un bloc quitté serait un saut')
  m.mode = 'surface'
  etat.repere = Z12
  // au retour, la première lecture mémorise et ne transporte pas
  assert.equal(m._transporterSiRepereChange(), false)
  assert.match(SRC_MODES, /this\._empriseVue = null \/\/ on quitte l'espace du bloc[^\n]*\n\s*this\._repereVue = null/, 'enterOrbit doit lâcher le repère avec l’emprise')
  const plongee = SRC_MODES.slice(SRC_MODES.indexOf('this._empriseVue = this.hooks.empriseBlocM?.() ?? null'))
  assert.match(plongee.slice(0, 600), /this\._repereVue = null/, '_loadDive doit repartir d’un repère vierge')
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ LE BOUTON — même pivot que la molette
// ═══════════════════════════════════════════════════════════════════════════

test('④ `cranZoom` zoome vers le point du cadre : le pivot reste sur le même rayon de vue', async () => {
  const { m, camera, controls } = await machine()
  camera.position.set(0, 20, 20)
  controls.target.set(0, Y_CIBLE, 0)
  controls.minDistance = 1
  const P = { x: 3, y: 2, z: -2 }
  m.hooks.pointUnder = () => P
  const d0 = [P.x - camera.position.x, P.y - camera.position.y, P.z - camera.position.z]
  const cibleAvant = controls.target.clone()
  m.cranZoom(1)
  const d1 = [P.x - camera.position.x, P.y - camera.position.y, P.z - camera.position.z]
  const n0 = Math.hypot(...d0), n1 = Math.hypot(...d1)
  const ecartDir = Math.abs(d0[0] / n0 - d1[0] / n1) + Math.abs(d0[1] / n0 - d1[1] / n1) + Math.abs(d0[2] / n0 - d1[2] / n1)
  assert.ok(ecartDir < 1e-9, `le pivot a quitté le rayon de vue (écart de direction ${ecartDir})`)
  assert.ok(Math.abs(n1 / n0 - Math.SQRT1_2) < 1e-9, 'un cran vaut ×√2 vers le pivot')
  // ⚠️ MUTATION : le geste d'avant (recul le long de `cible → caméra`) laisse la cible immobile
  assert.ok(controls.target.distanceTo(cibleAvant) > 0.1, 'la cible n’a pas suivi l’homothétie : le cran est redevenu radial')
})

test('④ bis hors du crop, `cranZoom` reste radial (D19, règle 2 au nadir — même prédicat que `_applyZoom`)', async () => {
  const { m, camera, controls } = await machine()
  m.hooks.horsDuCrop = () => true
  camera.position.set(0, 20, 20)
  controls.target.set(0, Y_CIBLE, 0)
  controls.minDistance = 1
  m.hooks.pointUnder = () => ({ x: 3, y: 2, z: -2 })
  m.cranZoom(1)
  assert.ok(Math.hypot(controls.target.x, controls.target.z) < 1e-12, 'hors du crop la cible ne doit pas être translatée')
  assert.match(SRC_MODES, /const P = this\.hooks\.horsDuCrop\?\.\(\) === true \? null : this\._zoomPivot\n    if \(P && Math\.abs\(nouvelle \/ dist - 1\) > 1e-9\)/, 'cranZoom doit lire le même prédicat que _applyZoom')
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ LE BRANCHEMENT — `main.js`
// ═══════════════════════════════════════════════════════════════════════════

test('⑤ `main.js` : une seule lecture de la similitude, partagée par la caméra de fond et le crochet', () => {
  assert.match(SRC_MAIN, /const sim = parametresSimilitude\(ancreXZ\.x, ancreXZ\.z\)/, 'majCameraFond doit lire parametresSimilitude')
  assert.match(SRC_MAIN, /similitudeBloc: \(x, z\) => \(params\.source === 'real' \? parametresSimilitude\(x, z\) : null\)/)
  assert.match(SRC_MAIN, /similitudeBlocAuLieu: \(lat, lon\) => \{/)
  assert.match(SRC_MAIN, /const o = mondeDuLatLon\(lat, lon\)\n\s*return o \? parametresSimilitude\(o\.x, o\.z\) : null/)
})

test('⑤ bis le pivot de zoom est lu sur la surface DESSINÉE, et les deux butées aussi', () => {
  // le pivot : la marche de la mise au point sur le globe, rendue au bloc
  assert.match(SRC_MAIN, /const dessine = pointDessineSousLaVisee\(_pickNdc\)\n\s*if \(dessine\) return dessine/)
  assert.match(SRC_MAIN, /function pointDessineSousLaVisee\(ndc\) \{[\s\S]*?focusRayHitGlobe\(focusRay\.ray\.origin, focusRay\.ray\.direction, rayonAffiche/)
  assert.match(SRC_MAIN, /const p = S\.versBloc\(\[o\.x \+ v\.x \* d, o\.y \+ v\.y \* d, o\.z \+ v\.z \* d\]\)/)
  // les butées : `solDessine`, jamais `terrain.sample` en direct
  const corps = SRC_MAIN.slice(SRC_MAIN.indexOf('const solButee = solDessine'), SRC_MAIN.indexOf('pivoterAutourDuBloc(_azAvantUpdate)'))
  assert.ok(corps.length > 0)
  assert.doesNotMatch(corps, /sol: terrain\.sample/, 'une butée relit le bloc — faux entre un recadrage et son remplissage')
  assert.equal((corps.match(/sol: solButee/g) || []).length, 2, 'les deux butées doivent lire le sol dessiné')
  const redresse = SRC_MAIN.slice(SRC_MAIN.indexOf('function redresserSurLeSol()'))
  assert.match(redresse.slice(0, redresse.indexOf('\n}\n')), /sol: solDessine/)
  // et la caméra suit le repère AVANT la lecture du sol
  // ⚠️ MUTATION (OBL-2) : `indexOf` rend −1 quand l’appel est ABSENT, et −1 < tout — la garde
  // « précède » passait avec le transport retiré. On exige d’abord la présence.
  const iTransport = SRC_MAIN.indexOf('modes.suivreRepere?.()')
  assert.ok(iTransport >= 0, 'main.js n’appelle plus modes.suivreRepere() avant les butées')
  assert.ok(iTransport < SRC_MAIN.indexOf('const solButee = solDessine'), 'le transport doit précéder les butées')
  // `solDessine` : la loi de `appliquerHauteurs`, mot pour mot
  assert.match(SRC_MAIN, /return h == null \? terrain\.sample\(x, z\) : \(h - f\.moyenneM\) \* f\.echelleVerticale/)
})

test('⑤ ter la base locale de `frontiere-rendu` est bien orthonormée directe — la transposée est l’inverse', () => {
  const { est, haut, sud } = repereGlobe(-21.25, 55.77)
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  assert.ok(Math.abs(dot(est, haut)) < 1e-12 && Math.abs(dot(haut, sud)) < 1e-12 && Math.abs(dot(est, sud)) < 1e-12)
  assert.ok(Math.abs(dot(est, est) - 1) < 1e-12 && Math.abs(dot(haut, haut) - 1) < 1e-12 && Math.abs(dot(sud, sud) - 1) < 1e-12)
})
