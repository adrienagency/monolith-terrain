// GEL-2 — « LE FREEZE ARRIVE AU DOUBLE-CLIC POUR ZOOMER » (Adrien, 2026-09-05).
//
// Reproduit 6 chargements sur 8 (`scripts/sonde-gel2.mjs --lieu orbite`,
// `.banc/GEL2/orb-gauche-x1`) : des double-clics gauche depuis l'orbite, et à
// partir d'un palier (z5, z6 ou z7 selon le chargement) `busy` reste levé POUR
// TOUJOURS — la carte se dessine encore (le chien de garde CDP n'a jamais mordu,
// tâche max 204 ms), mais plus un geste ne passe. Trois maillons, trois gardes :
//
//   ① `globe._tuileLaPlusFine` : une tuile de la liste mise en cache par
//      `poseurPourReconstruction` a perdu ses hauteurs entre les deux moitiés de
//      `regenerateTerrain` (`_retenirHauteurs` les libère quand une tuile plus
//      récente atterrit). `sampleHeights(null, …)` levait « Cannot read
//      properties of null (reading '18944') » depuis `regenerateLabels`.
//   ② `regenerateTerrain` (main.js) : son corps tourne dans un `setTimeout`, une
//      exception n'y rejette rien — `resolve` n'était jamais appelé et
//      `rebuildPending` restait `true`. Il rend la main sous `finally`.
//   ③ `modes._rescale` / `_dive` / `_loadDive` / `enterOrbit` : tout ce qui suit
//      `busy = true` est sous `finally { busy = false }`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { Globe } from '../src/globe.js'
import { Modes } from '../src/modes.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lireSrc = (f) => fs.readFileSync(path.join(RACINE, 'src', f), 'utf8')

// ── ① la tuile qui a perdu ses hauteurs ──────────────────────────────────────
function tuile(z, x, y, v) {
  const heights = new Float32Array(4)
  heights.fill(v)
  return { z, x, y, size: 2, heights, key: `${z}/${x}/${y}` }
}
const N13 = 2 ** 13
const mx = (4300 + 0.5) / N13
const my = (4600 + 0.5) / N13
const lon = mx * 360 - 180
const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI
const faux = { tuilesAvecHauteurs: () => [], _fondCrop: null, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
// le LECTEUR de hauteurs : `hauteurSurface` (sans fond de crop, il rend la donnée brute)
const cherche = (liste) => Globe.prototype.hauteurSurface.call(faux, lat, lon, liste)

test('① une tuile qui couvre le point mais a PERDU ses hauteurs n est plus candidate pour un lecteur de HAUTEURS (liste triée et non triée)', () => {
  const fine = tuile(13, 4300, 4600, 999)
  const grossiere = tuile(6, 4300 >> 7, 4600 >> 7, 111)
  fine.heights = null // libérée par `_retenirHauteurs` APRÈS que la liste a été bâtie
  for (const triee of [true, false]) {
    const liste = [fine, grossiere]
    if (triee) liste.trieeFinAbord = true
    let h
    assert.doesNotThrow(() => { h = cherche(liste) }, `triée=${triee} : ne doit pas lever`)
    assert.ok(Math.abs(h - 111) < 1e-6, `triée=${triee} : la grossière (111) doit répondre, reçu ${h}`)
  }
  // et si PLUS AUCUNE tuile n'a de hauteurs, c'est `null` — jamais une levée
  assert.equal(cherche([fine]), null)
})

test('① …mais le CHOIX de tuile reste aveugle aux hauteurs sans filtre : `hauteurMaillee` lit des maillages dont les hauteurs sont relâchées (socle-plaque)', () => {
  const fine = tuile(13, 4300, 4600, 999)
  fine.heights = null
  const best = Globe.prototype._tuileLaPlusFine.call(faux, lat, lon, [fine])
  assert.ok(best && best.t === fine, 'sans `exige`, la tuile sans hauteurs est encore choisie')
  assert.equal(Globe.prototype._tuileLaPlusFine.call(faux, lat, lon, [fine], (t) => !!t.heights), null)
})

test('① hauteurDessinee sur une liste périmée rend la hauteur de la tuile suivante, et ne lève pas', () => {
  const fine = tuile(13, 4300, 4600, 999)
  const grossiere = tuile(6, 4300 >> 7, 4600 >> 7, 111)
  fine.heights = null
  const liste = [fine, grossiere]
  liste.trieeFinAbord = true
  let h
  assert.doesNotThrow(() => { h = Globe.prototype.hauteurDessinee.call(faux, lat, lon, liste) })
  assert.ok(Number.isFinite(h), `une hauteur finie attendue, reçu ${h}`)
  assert.ok(Math.abs(h - 111) < 1e-6, `la hauteur de la grossière (111) attendue, reçu ${h}`)
  // plus aucune hauteur nulle part : `null` traverse, comme l'en-tête le promet
  assert.equal(Globe.prototype.hauteurDessinee.call(faux, lat, lon, [fine]), null)
})

// ── ③ busy retombe même quand l'après-chargement lève ────────────────────────
// le constructeur de `Modes` bâtit son cartouche dans le DOM : le même stub que
// `test/retour-orbite.test.js`
function stubDom() {
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
function fabrique({ leverApres }) {
  stubDom()
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  camera.position.set(0, 20, 30)
  const controls = {
    target: new THREE.Vector3(0, 0, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  let appels = 0
  const hooks = {
    zoomContinu: () => true,
    empriseBlocM: () => 1e6,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: -4.4349, lon: 121.7735 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat: -4.4349, lon: 121.7735, zoom: 7 }),
    getCoarsenTarget: () => null,
    async loadSurface() { appels++ },
    // lue AVANT et APRÈS `loadSurface` par `_rescale` : c'est la seconde lecture
    // qui lève — exactement « une exception après l'await, hors du try/catch »
    echelleVerticaleBloc: () => { if (leverApres && appels > 0) throw new Error('après-chargement : sampleHeights(null)') ; return 1 },
    arriveeSurLeBloc: () => false,
    surLeBloc: () => false,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  m.announce = () => {} // le cartouche vit dans le DOM ; ici il n'y en a pas
  return m
}

test('③ _rescale : une levée APRÈS loadSurface rejette la promesse ET rend busy=false — la porte rouvre', async () => {
  const m = fabrique({ leverApres: true })
  assert.equal(m.busy, false)
  await assert.rejects(() => m._rescale({ lat: -4.4349, lon: 121.7735, zoom: 7 }, 'REFINING'), /après-chargement/)
  assert.equal(m.busy, false, 'busy doit retomber : c est LE gel (la carte se dessine, plus un geste ne passe)')
  // et le vol suivant est de nouveau possible
  await m._rescale({ lat: -4.4349, lon: 121.7735, zoom: 7 }, 'REFINING').catch(() => {})
  assert.equal(m.busy, false)
})

test('③ _rescale sans levée : comportement inchangé (busy retombe, la caméra est reposée)', async () => {
  const m = fabrique({ leverApres: false })
  await m._rescale({ lat: -4.4349, lon: 121.7735, zoom: 7 }, 'REFINING')
  assert.equal(m.busy, false)
})

// ── ② et ③, le contrat dans la source ────────────────────────────────────────
test('② main.js : le corps différé de regenerateTerrain est sous try/finally, et c est le finally qui rend la main', () => {
  const src = lireSrc('main.js')
  const debut = src.indexOf('function regenerateTerrain(')
  assert.ok(debut > 0)
  const corps = src.slice(debut, src.indexOf('\n}\n', debut))
  const iTry = corps.indexOf('try {')
  const iRebuild = corps.indexOf('terrain.rebuild(params)')
  const iFinally = corps.indexOf('} finally {')
  const iPending = corps.indexOf('rebuildPending = false')
  const iResolve = corps.lastIndexOf('resolve()') // le premier est le `return Promise.resolve()` du garde-fou en tête
  assert.ok(iTry > 0 && iTry < iRebuild, 'le try doit précéder terrain.rebuild')
  assert.ok(iFinally > iRebuild, 'un finally après le corps')
  assert.ok(iPending > iFinally && iResolve > iFinally, 'rebuildPending = false et resolve() vivent dans le finally')
  assert.ok(/catch \(err\)[\s\S]*console\.error/.test(corps), 'la levée est journalisée, pas avalée en silence')
})

test('③ modes.js : les quatre vols remettent busy=false sous finally', () => {
  const src = lireSrc('modes.js')
  for (const nom of ['async enterOrbit(', 'async _dive(', 'async _rescale(', 'async _loadDive(']) {
    const debut = src.indexOf(nom)
    assert.ok(debut > 0, nom)
    const corps = src.slice(debut, src.indexOf('\n  }\n', debut))
    const iBusy = corps.indexOf('this.busy = true')
    const iTry = corps.indexOf('try {', iBusy)
    const iFinally = corps.lastIndexOf('} finally {')
    assert.ok(iBusy > 0 && iTry > iBusy, `${nom} : try juste après busy = true`)
    assert.ok(iFinally > iTry, `${nom} : un finally`)
    assert.ok(/finally \{[\s\S]*this\.busy = false/.test(corps.slice(iFinally)), `${nom} : busy = false dans le finally`)
  }
})


// ── ④ l'épingle du double-clic : un budget d'images, pas une échéance murale ──
// Pendant le rechargement du palier (`busy`), `saisiePossible()` est faux et
// l'épingle ne peut RIEN faire ; une échéance MURALE s'écoulait quand même et,
// sur une machine lente, tombait avant que l'épingle ait ramené le point sous
// son pixel — le double-clic cessait de zoomer VERS LE POINT (D19).
// ⚡ Mesuré sur le seul chemin qui le montre, l'ENCHAÎNÉ (second double-clic
// 250 ms après le premier, CPU ×4 / DPR 2, Sulawesi z5, 8 contre 8 chargements) :
// dérive du point cliqué **195,54 px (7/8) à l'échéance murale, 0,00 px (8/8) au
// budget**. Sur le chemin non enchaîné, le même A/B ne montre rien (135 px des
// deux côtés) — d'où ce test, pour que le budget ne reparte pas en horloge.
test('④ main.js : l épingle du double-clic porte un budget en ms de SIMULATION, décompté par `dt`, et aucune échéance murale', () => {
  const src = lireSrc('main.js')
  const iEp = src.indexOf('function epingler(')
  assert.ok(iEp > 0)
  const corps = src.slice(iEp, src.indexOf('\n}\n', iEp))
  assert.ok(/resteMs: EPINGLE_MS/.test(corps), 'l épingle stocke un budget `resteMs`')
  assert.ok(!/performance\.now\(\)/.test(corps), 'aucune échéance murale posée à la pose de l épingle')
  const iApp = src.indexOf('function appliquerSaisieTerre(')
  assert.ok(iApp > 0)
  const app = src.slice(iApp, src.indexOf('\n}\n', iApp))
  assert.ok(/E\.resteMs -= dt \* 1000/.test(app), 'le budget se décompte avec `dt` (temps de simulation)')
  assert.ok(/E\.resteMs <= 0/.test(app), 'et c est lui qui périme l épingle')
  assert.ok(!/performance\.now\(\) > E\./.test(app), 'plus aucune comparaison à l horloge murale')
})
