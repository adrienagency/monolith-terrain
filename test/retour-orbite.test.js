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

// ══════════ ③ LE MÊME DÉFAUT SUR L'AUTRE CHEMIN — Tâche R27 ═════════════════
//
// ⛔ **R23 A CORRIGÉ `_applyZoom` (LA MOLETTE) ET A LAISSÉ `cranZoom` (LE BOUTON
// ET LE PINCEMENT).** Relevé au navigateur sous le protocole de R27
// (`.banc/R27/avant2.json`) : remontée pilotée par `cranZoom`, la caméra collée
// à `d = 150` contre un plafond de 150, **1 174 images, bloqué à z8, l'orbite
// jamais atteinte**. Exactement le §④ de R23, sur le chemin qu'elle n'avait pas
// mesuré.

test('③ au plafond, `cranZoom` vers l’extérieur compte quand même son niveau', async () => {
  const { m, camera, controls } = await machine()
  poser(camera, controls, controls.maxDistance)
  const d0 = controls.getDistance()
  const b0 = m.zoomNiveau()
  m.cranZoom(-1) // vers l'extérieur
  // le DÉPLACEMENT est nul — la butée a tout mangé, et c'est voulu
  assert.equal(controls.getDistance(), d0, 'la butée tient toujours la caméra')
  // ⚡ mais l'INTENTION est comptée : un cran vaut `ln √2`
  assert.ok(Math.abs(m.zoomNiveau() - b0 - Math.log(Math.SQRT2)) < 1e-9,
    `budget ${m.zoomNiveau() - b0} au lieu de ${Math.log(Math.SQRT2)}`)
})

test('③ bis et il finit par ouvrir la porte orbitale, au lieu de geler', async () => {
  const { m, camera, controls } = await machine({ coarsen: false })
  poser(camera, controls, controls.maxDistance)
  let orbite = 0
  m.enterOrbit = async () => { orbite++ }
  for (let i = 0; i < 3 && orbite === 0; i++) m.cranZoom(-1)
  assert.equal(orbite, 1, 'plus de niveau plus large : la porte orbitale s’ouvre')
})

test('③ ter au plancher, `cranZoom` vers l’intérieur NE compte PAS — même asymétrie', async () => {
  // au zoom fin il n'y a plus rien à affiner : laisser courir le compteur en
  // ferait un compteur qui ne se dépense jamais, et l'aller-retour deviendrait
  // asymétrique. C'est la règle de R23, reprise mot pour mot.
  const { m, camera, controls } = await machine({ refine: false })
  poser(camera, controls, controls.minDistance)
  const b0 = m.zoomNiveau()
  m.cranZoom(1)
  assert.equal(m.zoomNiveau(), b0, `budget parti à ${m.zoomNiveau()} alors qu’il n’y a rien à affiner`)
})

test('③ quater loin des butées, `cranZoom` compte le déplacement — elles sont égales', async () => {
  const { m, camera, controls } = await machine()
  poser(camera, controls, 40)
  const d0 = controls.getDistance()
  const b0 = m.zoomNiveau()
  m.cranZoom(-1)
  assert.ok(controls.getDistance() > d0, 'la caméra doit reculer')
  assert.ok(Math.abs(m.zoomNiveau() - b0 - Math.log(controls.getDistance() / d0)) < 1e-9)
})

// ══════════ ④ LE BALAYAGE NE MANGE PLUS LES NIVEAUX — Tâche R29 ═════════════
//
// ⛔ **CE QUE LE BANC A ATTRAPÉ, ET QUE LA GARDE M4 DE `zoom-continu.test.js`
// NE POUVAIT PAS VOIR.** Cette garde-là vérifie « le budget n'est pas PERDU »
// avec `PAS_NIVEAU × 1,2` au compteur — c'est-à-dire UN niveau, le seul cas où
// `_levelZoom = reste` tient la promesse. Au navigateur
// (`scripts/sonde-sortie-r29.mjs`, `.banc/R29/avant-bouton-*.json`, bouton « − »
// à un clic par image) le balayage de retour au nadir de D16 ter s'arme sur la
// mort du crop et dure **130 images (2,2 s)** : le compteur y monte à **9,01**,
// soit **treize niveaux**, `reste` vaut alors 0,0 et douze niveaux partaient à
// la poubelle. La caméra restait à `d = 149,9 / plafond 150`, l'altitude figée à
// **133 876 m** et `z` bloqué à **10**.

test('④ treize niveaux encaissés pendant le balayage se dépensent TOUS, un par un', async () => {
  const { m, etat } = await machine()
  m._fonduPose = { t: 0.3, e: 0.3, angleTotalDeg: 46.5, cible: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } }
  // ⚠️ **13,5 ET PAS 13** : à 13 pile, `13 × ln2 − 12 × ln2` retombe un ulp SOUS
  // `ln2` et la troncature rend 0 — le treizième niveau se perdrait dans le
  // `double`, pas dans le code. Le banc, lui, a relevé 9,01 (treize niveaux
  // pleins et des poussières), ce que ce demi-niveau reproduit honnêtement.
  m._levelZoom = PAS_NIVEAU * 13.5
  const budget = m._levelZoom
  m._franchirSiBesoin()
  assert.equal(etat.charges.length, 0, 'un niveau a été franchi PENDANT le balayage')
  assert.equal(m._levelZoom, budget, 'le budget a été entamé pendant le balayage')
  // le balayage finit : les niveaux partent UN PAR UN, et rien n'est jeté
  m._fonduPose = null
  for (let i = 1; i <= 13; i++) {
    m.busy = false
    m._franchirSiBesoin()
    await new Promise((r) => setTimeout(r, 0))
    assert.equal(etat.charges.length, i, `au tour ${i}, ${etat.charges.length} niveau(x) franchi(s)`)
    assert.ok(Math.abs(m._levelZoom - (budget - i * PAS_NIVEAU)) < 1e-9,
      `au tour ${i} le compteur vaut ${m._levelZoom} au lieu de ${budget - i * PAS_NIVEAU}`)
  }
  // et il ne reste rien à franchir
  m.busy = false
  m._franchirSiBesoin()
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.charges.length, 13, 'un quatorzième niveau est parti')
})

test('④ bis à UN niveau dû, le compteur rend EXACTEMENT `reste` — identité au bit', async () => {
  // ⚠️ **LE TÉMOIN DE NON-RÉGRESSION.** Le correctif ne doit rien changer au
  // cas nominal : `reste = budget − 1 × pas`, et c'est ce que retranche la
  // nouvelle ligne. On l'exige à l'égalité stricte, pas sous un seuil.
  const { m, etat } = await machine()
  m._levelZoom = PAS_NIVEAU * 1.2
  const attendu = m._levelZoom - PAS_NIVEAU
  m._franchirSiBesoin()
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.charges.length, 1, 'le niveau nominal ne se franchit plus')
  assert.equal(m._levelZoom, attendu, `compteur ${m._levelZoom} au lieu de ${attendu}`)
})

test('④ ter vers l’INTÉRIEUR aussi, un niveau par appel et le reste reste', async () => {
  const { m, etat } = await machine()
  m._levelZoom = -PAS_NIVEAU * 3
  const budget = m._levelZoom
  m._franchirSiBesoin()
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.charges.length, 1, 'aucun affinage')
  assert.ok(Math.abs(m._levelZoom - (budget + PAS_NIVEAU)) < 1e-9,
    `compteur ${m._levelZoom} au lieu de ${budget + PAS_NIVEAU}`)
})

// ══════════ ⑤ LE CRAN SURVIT AU CHARGEMENT — Tâche R29 ══════════════════════
//
// ⛔ **LE FAIT ① DU BRIEF R29 : « huit crans n'ont avancé que d'UN niveau ».**
// `cranZoom` sortait sur `busy`, alors que le glissé inertiel en est
// explicitement exempté sous le drapeau (`update()`). Un `_rescale` dure des
// centaines de millisecondes : sept clics sur huit disparaissaient.

test('⑤ pendant un chargement, huit clics comptent HUIT crans au lieu d’un', async () => {
  const { m, camera, controls } = await machine()
  poser(camera, controls, 40)
  const d0 = controls.getDistance()
  m.busy = true
  const b0 = m.zoomNiveau()
  for (let i = 0; i < 8; i++) m.cranZoom(-1)
  const attendu = 8 * Math.log(Math.SQRT2)
  assert.ok(Math.abs(m.zoomNiveau() - b0 - attendu) < 1e-9,
    `budget ${m.zoomNiveau() - b0} au lieu de ${attendu} — des clics ont été jetés`)
  // ⚠️ **ET LA CAMÉRA N'A PAS BOUGÉ** : pendant le rechargement elle appartient
  // à `_rescale`, qui pose la cible d'arrivée et convertit les unités.
  assert.equal(controls.getDistance(), d0, 'le cran a écrit la caméra pendant le chargement')
})

test('⑤ bis pendant un chargement, l’asymétrie du zoom fin tient toujours', async () => {
  const { m, camera, controls } = await machine({ refine: false })
  poser(camera, controls, 40)
  m.busy = true
  const b0 = m.zoomNiveau()
  m.cranZoom(1)
  assert.equal(m.zoomNiveau(), b0, `budget parti à ${m.zoomNiveau()} alors qu’il n’y a rien à affiner`)
})

test('⑤ ter en orbite, un chargement laisse le cran tranquille — pas de compteur', async () => {
  const { m } = await machine()
  m.mode = 'orbital'
  m.busy = true
  const alt0 = m.orbAltTarget
  const b0 = m.zoomNiveau()
  m.cranZoom(-1)
  assert.equal(m.orbAltTarget, alt0, 'l’altitude orbitale a bougé pendant un chargement')
  assert.equal(m.zoomNiveau(), b0, 'le compteur de surface a couru en orbite')
})

// ══════════ ⑥ LE COMPTEUR SE VIDE SANS NOUVEAU GESTE — Tâche R29 ════════════
//
// ⛔ **RIEN N'APPELAIT `_franchirSiBesoin` UNE FOIS LE GESTE FINI.** Il ne
// vivait que dans `_applyZoom` (tant que `_zoomVel` court) et dans `cranZoom`
// (donc au clic suivant). Un budget encaissé pendant un balayage ou un
// chargement attendait le geste SUIVANT : caméra au plafond, altitude figée.

test('⑥ une image ordinaire suffit à franchir ce que le geste a laissé', async () => {
  const { m, camera, controls, etat } = await machine()
  poser(camera, controls, 40)
  m._zoomVel = 0 // le geste est fini : `_applyZoom` ne tourne plus
  m._levelZoom = PAS_NIVEAU * 1.5
  m.update(1 / 60)
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.charges.length, 1, 'aucun niveau franchi alors que le compteur en devait un')
})

test('⑥ bis et une image ordinaire au repos ne franchit RIEN', async () => {
  const { m, camera, controls, etat } = await machine()
  poser(camera, controls, 40)
  m._zoomVel = 0
  m._levelZoom = PAS_NIVEAU * 0.5
  for (let i = 0; i < 30; i++) m.update(1 / 60)
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.charges.length, 0, 'un niveau est parti sans que le compteur soit plein')
})

test('⑥ ter l’appel par image est BIEN dans la branche de surface d’`update`', async () => {
  // ⚠️ **UNE GARDE DE SOURCE, ET ELLE EST BORNÉE AU CORPS.** `_franchirSiBesoin`
  // apparaît trois fois dans `modes.js` (`cranZoom`, `_applyZoom`, `update`) :
  // une recherche sur tout le fichier resterait verte si la troisième
  // disparaissait. On la borne donc au bloc du balayage de pose, qui est son
  // voisin immédiat et sa raison d'être — il pose `_fonduPose = null` à l'image
  // où il finit, donc le niveau part dès CETTE image.
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/modes.js', import.meta.url), 'utf8')
  const i = src.indexOf('if (pas.fini) this._fonduPose = null')
  assert.ok(i > 0, 'le bloc du balayage de pose a disparu de `update`')
  const apres = src.slice(i, i + 1800)
  assert.ok(/this\._franchirSiBesoin\(\)/.test(apres),
    '`update` ne vide plus le compteur par image — un budget encaissé pendant un balayage attendrait le geste suivant')
  assert.ok(apres.indexOf('this._franchirSiBesoin()') < apres.indexOf('surfaceCamAltMeters'),
    'l’appel par image a quitté la branche de surface')
})
