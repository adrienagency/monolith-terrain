// LE SENS INVERSE — REMONTER DU BLOC À L'ORBITE. Tâche R23.
//
// ══════════ LE DÉFAUT, MESURÉ AVANT D'ÊTRE ÉCRIT ════════════════════════════
//
// ⛔ **LA TRANSITION ÉTAIT À SENS UNIQUE.** Relevé au navigateur
// (`scripts/sonde-vitesse-r23.mjs`, `.banc/R23/avant.json`,
// `remontees['couchee-vers-horizon']`) : vue couchée vers l'horizon, puis dézoom
// piloté par l'API de l'appli, **1 500 images** — l'orbite n'est **jamais**
// atteinte, 2 niveaux franchis puis plus rien, la caméra collée à
// `distance = 150` contre un plafond de `150`, et le budget de niveau **figé à
// 0,68782** pour un niveau qui en vaut **0,69315**. Il manquait **0,00533**,
// définitivement. Le même geste à la pente d'arrivée atteint l'orbite en
// **349 images** et **13 niveaux** : c'est le cas le plus favorable, et c'est
// celui que les premières mesures avaient pris.
//
// ⚡ **LE MÉCANISME.** `maxDistance` borne une DISTANCE caméra → cible, alors
// que ce qu'il faut borner est une ALTITUDE. `distance = (camY − yCible) / cos φ`
// : à la butée polaire `cos(88,2°) = 0,0314` contre 0,688 à la pente d'arrivée —
// **la même altitude coûte 21,9 fois plus de distance.** Le plafond mord donc
// bien avant que le niveau soit dépensé.

import test from 'node:test'
import assert from 'node:assert/strict'
import { PAS_NIVEAU } from '../src/monde/zoom-continu.js'
import { Y_CIBLE } from '../src/loi-altitude.js'

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

async function machine({ continu = true, coarsen = true, refine = true, maxDistance = 150 } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const etat = { emprise: 1e6, charges: [], zooms: [] }
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const hooks = {
    zoomContinu: () => continu,
    empriseBlocM: () => etat.emprise,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => maxDistance,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => (refine ? { lat: 45.83, lon: 6.86, zoom: 12 } : null),
    getCoarsenTarget: () => (coarsen ? { lat: 45.83, lon: 6.86, zoom: 10 } : null),
    async loadSurface(_lat, _lon, zoom) { etat.charges.push(zoom); etat.emprise *= 2 },
    arriveeSurLeBloc: () => false,
    surLeBloc: () => false,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  return { m, camera, controls, etat }
}

// pose la caméra à la distance voulue, le long de la direction courante
function poser(camera, controls, d) {
  const dir = camera.position.clone().sub(controls.target)
  if (dir.lengthSq() < 1e-9) dir.set(0, 0.0314, 0.9995) // la butée polaire : φ = 88,2°
  camera.position.copy(controls.target).addScaledVector(dir.normalize(), d)
}

// ══════════ ① LE DÉFAUT, REJOUÉ SUR LA MACHINE RÉELLE ═══════════════════════

test('① collée au plafond, la caméra ne bouge plus d’un pouce — c’était TOUT le défaut', async () => {
  const { m, camera, controls } = await machine()
  poser(camera, controls, controls.maxDistance)
  const avant = controls.getDistance()
  m._zoomVel = -2 // vers l'extérieur
  m._applyZoom(1 / 60)
  // le déplacement RÉEL est nul : la butée a tout mangé. C'est le fait mesuré.
  assert.ok(Math.abs(controls.getDistance() - avant) < 1e-9, `la caméra a bougé de ${controls.getDistance() - avant}`)
})

test('① et pourtant le budget de niveau, lui, avance — c’est le correctif', async () => {
  const { m, camera, controls } = await machine()
  poser(camera, controls, controls.maxDistance)
  m._zoomVel = -2
  const b0 = m.zoomNiveau()
  m._applyZoom(1 / 60)
  assert.ok(m.zoomNiveau() > b0, `budget figé à ${m.zoomNiveau()}`)
  // et il avance de l'INTENTION exacte du geste : `−vel × dt`
  assert.ok(Math.abs(m.zoomNiveau() - b0 - 2 / 60) < 1e-9, `budget ${m.zoomNiveau() - b0}, intention ${2 / 60}`)
})

test('① l’élan ne meurt pas sur une butée qui va s’ouvrir', async () => {
  // ⚠️ Tuer `_zoomVel` au plafond rendrait le franchissement dépendant d'un
  // RE-défilement : c'est le cran que la Tâche M a supprimé, revenu par la
  // fenêtre. Le glissé doit courir jusqu'au franchissement.
  const { m, camera, controls } = await machine()
  poser(camera, controls, controls.maxDistance)
  m._zoomVel = -2
  m._applyZoom(1 / 60)
  assert.ok(m._zoomVel < 0, `élan tué (${m._zoomVel})`)
})

test('① le niveau finit par se franchir, et le compteur garde son reste', async () => {
  const { m, camera, controls, etat } = await machine()
  poser(camera, controls, controls.maxDistance)
  m._zoomVel = -2
  // 0,69315 de budget à 2/60 par image : 21 images suffisent
  for (let i = 0; i < 25 && etat.charges.length === 0; i++) {
    m._applyZoom(1 / 60)
    await new Promise((r) => setImmediate(r)) // `_coarsen` est asynchrone
  }
  assert.equal(etat.charges.length, 1, 'aucun niveau franchi')
  assert.equal(etat.charges[0], 10, 'le niveau franchi n’est pas le cran plus large')
  // le reste traverse : `franchissement()` ne jette rien
  assert.ok(m.zoomNiveau() >= 0 && m.zoomNiveau() < PAS_NIVEAU, `reste ${m.zoomNiveau()} hors de [0, ln2[`)
})

test('① sans cran plus large, c’est la PORTE ORBITALE qui s’ouvre — plus de cul-de-sac', async () => {
  const { m, camera, controls } = await machine({ coarsen: false })
  poser(camera, controls, controls.maxDistance)
  m._zoomVel = -2
  let orbite = 0
  m.enterOrbit = async () => { orbite++ }
  for (let i = 0; i < 25 && orbite === 0; i++) {
    m._applyZoom(1 / 60)
    await new Promise((r) => setImmediate(r))
  }
  assert.equal(orbite, 1, 'la porte orbitale ne s’est pas ouverte')
})

// ══════════ ② CE QUE LE CORRECTIF NE DOIT PAS FAIRE ═════════════════════════

test('② au zoom fin, la butée BASSE ne remplit pas le compteur — il n’y a rien à affiner', async () => {
  // ⚠️ **L'ASYMÉTRIE EST VOULUE ET ELLE EST MESURABLE.** Vers l'extérieur il y a
  // toujours un niveau (un cran plus large, ou l'orbite) ; vers l'intérieur, au
  // zoom fin, il n'y a plus rien — un compteur qui court là serait un compteur
  // qui ne se dépense jamais, et le retour deviendrait asymétrique.
  const { m, camera, controls } = await machine({ refine: false })
  poser(camera, controls, controls.minDistance)
  m._zoomVel = +2 // vers l'intérieur
  const b0 = m.zoomNiveau()
  m._applyZoom(1 / 60)
  assert.equal(m.zoomNiveau(), b0, `budget parti à ${m.zoomNiveau()} alors qu’il n’y a rien à affiner`)
})

test('② avec un niveau plus fin disponible, la butée basse compte l’intention', async () => {
  const { m, camera, controls } = await machine({ refine: true })
  poser(camera, controls, controls.minDistance)
  m._zoomVel = +2
  const b0 = m.zoomNiveau()
  m._applyZoom(1 / 60)
  assert.ok(Math.abs(m.zoomNiveau() - b0 + 2 / 60) < 1e-9, `budget ${m.zoomNiveau() - b0}`)
})

test('② hors régime continu, RIEN ne change — le chemin cranté est intact', async () => {
  const { m, camera, controls } = await machine({ continu: false })
  poser(camera, controls, controls.maxDistance)
  m._zoomVel = -2
  const b0 = m.zoomNiveau()
  m._applyZoom(1 / 60)
  assert.equal(m.zoomNiveau(), b0, 'le budget a bougé sous le régime cranté')
  assert.equal(m._zoomVel, 0, 'l’élan doit mourir à la butée, comme avant')
})

test('② loin des butées, le budget suit le DÉPLACEMENT, pas l’intention — elles sont égales', async () => {
  const { m, camera, controls, etat } = await machine()
  poser(camera, controls, 40) // bien entre 6 et 150
  m._zoomVel = -1
  const b0 = m.zoomNiveau()
  const d0 = controls.getDistance()
  m._applyZoom(1 / 60)
  assert.ok(controls.getDistance() > d0, 'la caméra doit reculer')
  assert.ok(Math.abs(m.zoomNiveau() - b0 - Math.log(controls.getDistance() / d0)) < 1e-9)
  assert.equal(etat.charges.length, 0)
})
