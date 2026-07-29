import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS, captureLook, captureView, parseView, serializeTemplate, parseTemplate } from '../src/templates-user.js'

// ---------------------------------------------------------------- la POSE
// On stocke une direction NORMALISÉE + un facteur k relatif à maxDistance,
// jamais une position absolue : la taille du bloc change avec le zoom, donc
// une position en unités monde ne reproduirait pas le même cadrage ailleurs.
const fakeControls = (target, maxDistance) => ({ target, maxDistance })

test('captureView stores a normalised direction and a distance ratio', () => {
  const cam = { position: { x: 0, y: 30, z: 40 } }
  const v = captureView(cam, fakeControls({ x: 0, y: 0, z: 0 }, 100))
  assert.deepEqual(v.target, [0, 0, 0])
  assert.equal(Math.hypot(...v.dir).toFixed(9), '1.000000000')
  assert.equal(v.k, 0.5) // |(0,30,40)| = 50, sur maxDistance 100
})

test('captureView is scale-free — the same framing on a bigger block gives the same view', () => {
  const near = captureView({ position: { x: 6, y: 6, z: 6 } }, fakeControls({ x: 0, y: 0, z: 0 }, 20))
  const far = captureView({ position: { x: 60, y: 60, z: 60 } }, fakeControls({ x: 0, y: 0, z: 0 }, 200))
  assert.deepEqual(near.dir.map((n) => n.toFixed(6)), far.dir.map((n) => n.toFixed(6)))
  assert.ok(Math.abs(near.k - far.k) < 1e-12, `k diverge : ${near.k} vs ${far.k}`)
})

test('captureView refuses a degenerate camera instead of emitting NaN', () => {
  // caméra exactement SUR la cible : aucune direction définie
  assert.equal(captureView({ position: { x: 1, y: 2, z: 3 } }, fakeControls({ x: 1, y: 2, z: 3 }, 100)), null)
  assert.equal(captureView({ position: { x: 0, y: 1, z: 0 } }, fakeControls({ x: 0, y: 0, z: 0 }, 0)), null)
})

// Un .shibumap-template.json est un fichier fourni par l'utilisateur : il finit
// dans une position de caméra, donc une valeur non finie casserait la scène.
test('parseView rejects anything a hand-edited file could smuggle in', () => {
  assert.equal(parseView(null), null)
  assert.equal(parseView({}), null)
  assert.equal(parseView({ dir: [0, 1, 0], k: 1 }), null, 'target manquante')
  assert.equal(parseView({ dir: [0, 1], k: 1, target: [0, 0, 0] }), null, 'vecteur trop court')
  assert.equal(parseView({ dir: [0, NaN, 0], k: 1, target: [0, 0, 0] }), null)
  assert.equal(parseView({ dir: [0, 1, 0], k: 0, target: [0, 0, 0] }), null, 'k nul = caméra dans la cible')
  assert.equal(parseView({ dir: [0, 1, 0], k: -2, target: [0, 0, 0] }), null)
  assert.equal(parseView({ dir: [0, 0, 0], k: 1, target: [0, 0, 0] }), null, 'direction nulle')
  assert.equal(parseView({ dir: ['0', '1', '0'], k: 1, target: [0, 0, 0] }), null, 'chaînes refusées')
  assert.deepEqual(parseView({ dir: [0, 1, 0], k: 0.97, target: [0, -1.5, 0] }), { dir: [0, 1, 0], k: 0.97, target: [0, -1.5, 0] })
})

test('a template round-trips its view through serialize + parse', () => {
  const view = captureView({ position: { x: 62, y: 52, z: 62 } }, fakeControls({ x: 0, y: -1.5, z: 0 }, 120))
  const t = { name: 'Réunion', thumb: null, strip: ['#93a074'], shaders: false, view, look: { rampStops: [{ c: '#93a074', p: 0 }], fov: 33 } }
  const back = parseTemplate(serializeTemplate(t))
  assert.deepEqual(back.view, view)
  assert.equal(back.look.fov, 33)
})

test('a template without a view parses fine — old files keep working', () => {
  const text = JSON.stringify({ format: 'shibumap-template', version: 1, name: 'Ancien', look: { fov: 30 } })
  const back = parseTemplate(text)
  assert.equal(back.view, null)
  assert.equal(back.look.fov, 30)
})

// ------------------------------------------------------------- le LOOK
// Garde-fou contre l'oubli : chacune de ces clés pilote quelque chose de
// visible et manquait à l'appel, si bien qu'un look exporté puis réimporté
// ne rendait pas comme l'écran qu'on venait de quitter.
test('every visible parameter travels with the look', () => {
  const attendues = [
    'peaksEnabled', 'cloudTexMix', 'gpxArchColor', 'transmission',
    'demExaggeration', 'regionMode', 'dayCycleSpeed',
    'uiTint', 'uiBlur', 'uiBgOpacity',
    'sweepSpeed', 'scanColor', 'scanDuration', 'scanWidth', 'scanBlur',
    'scanDispHeight', 'scanDispFalloff',
    'camMove', 'camSpeed', 'surveyLines',
    'globeExaggeration', 'globeContourInterval', 'globeContourOpacity', 'globeGraticule',
    'gpxFollow', 'gpxFollowSpeed',
    'bokehEnabled', 'bokehScale', 'focusDistance', 'focusRange', 'fov',
  ]
  for (const k of attendues) assert.ok(TEMPLATE_KEYS.includes(k), `${k} manque à TEMPLATE_KEYS`)
})

// L'inverse compte autant : ces clés-là NUIRAIENT si elles voyageaient.
test('location, procedural terrain and machine performance never travel', () => {
  const interdites = [
    'source', 'demLat', 'demLon', 'demZoom', 'demLocation', // téléportation
    'seed', 'scale', 'octaves', 'lacunarity', 'gain', 'amplitude', 'warp', 'resolution', // terrain procédural
    'pixelRatio', 'shadowRes', // ferait ramer un portable avec le template d'une grosse machine
    'gpxVisible', 'gpxAltitude', // la trace elle-même
    'paused',
    'hazeColor', // dérivée de bgColorA, recalculée à chaque application
  ]
  for (const k of interdites) assert.ok(!TEMPLATE_KEYS.includes(k), `${k} ne doit PAS voyager`)
})

test('TEMPLATE_KEYS has no duplicates', () => {
  assert.equal(new Set(TEMPLATE_KEYS).size, TEMPLATE_KEYS.length)
})

test('captureLook deep-copies so a saved look cannot be mutated later', () => {
  const params = { rampStops: [{ c: '#fff', p: 0 }], fov: 30, demExaggeration: 2.8 }
  const look = captureLook(params)
  params.rampStops[0].c = '#000'
  params.demExaggeration = 9
  assert.equal(look.rampStops[0].c, '#fff')
  assert.equal(look.demExaggeration, 2.8)
})

// ------------------------------------------- le calque ROUTES a quitté le site
// Adrien : « très lourd, très mauvais, tu peux le supprimer. » Le calque part
// avec ses quatre clés de gabarit — mais des gabarits enregistrés chez des
// visiteurs, et des .shibumap-template.json exportés avant aujourd'hui, les
// portent encore. Même précédent que 'coastLine' : on retire les clés de la
// liste, applyUserTemplate filtre dessus, elles sont ignorées. Aucune
// migration, aucun numéro de version à changer. Ces tests ferment la porte.
const CLES_ROUTES = ['roadsEnabled', 'roadsOpacity', 'roadsDetail', 'roadColor']

test('plus aucune clé de routes ne voyage dans un gabarit', () => {
  for (const k of CLES_ROUTES) assert.ok(!TEMPLATE_KEYS.includes(k), `${k} ne doit plus voyager`)
  // et captureLook ne peut plus en émettre, même si params en traînait une
  const look = captureLook({ fov: 30, roadsEnabled: true, roadColor: '#ff0000' })
  for (const k of CLES_ROUTES) assert.ok(!(k in look), `captureLook émet encore ${k}`)
})

test('un vieux gabarit qui porte encore les clés de routes se charge, sans erreur et sans effet', () => {
  // un fichier tel qu'il a pu être exporté HIER, routes allumées et colorées
  const vieux = JSON.stringify({
    format: 'shibumap-template', version: 1, name: 'Avant',
    look: { fov: 45, darkMode: true, roadsEnabled: true, roadsOpacity: 0.42, roadsDetail: 3, roadColor: '#ff0000' },
  })
  const t = parseTemplate(vieux)
  assert.ok(t, 'le fichier doit rester lisible — pas de refus, pas de throw')
  assert.equal(t.name, 'Avant')

  // …et il n'a AUCUN effet : on rejoue ici la seule ligne de filtrage de
  // applyUserTemplate (main.js), qui n'est pas importable depuis Node.
  const params = { fov: 30, darkMode: false, roadsEnabled: false, roadColor: '' }
  for (const k of TEMPLATE_KEYS) if (k in t.look) params[k] = t.look[k]
  assert.equal(params.fov, 45, 'ce que le gabarit possède encore doit bien s’appliquer')
  assert.equal(params.darkMode, true)
  assert.equal(params.roadsEnabled, false, 'la clé morte ne doit rien rallumer')
  assert.equal(params.roadColor, '', 'la clé morte ne doit rien repeindre')
})
