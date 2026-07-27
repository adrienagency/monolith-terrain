import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS } from '../src/templates-user.js'
import {
  ATELIER_STEPS,
  STEP_KEYS,
  SIMPLE_EXCLUDED,
  LAYERS,
  clampStep,
  indexOfStep,
  downstreamKeys,
  changedKeys,
  isStepTouched,
  paletteSummary,
  skySummary,
  layersSummary,
  windSummary,
  seaSummary,
  weatherSummary,
  stepSummary,
} from '../src/ui/atelier-steps.js'

// ---- l'enchaînement lui-même ---------------------------------------------

test('l’assistant a exactement les cinq étapes demandées, dans l’ordre', () => {
  assert.deepEqual(ATELIER_STEPS.map((s) => s.id), ['template', 'palette', 'ciel', 'calques', 'meteo'])
  assert.deepEqual(ATELIER_STEPS.map((s) => s.label), ['Template', 'Palette', 'Ciel', 'Calques', 'Météo'])
})

test('clampStep borne la navigation aux deux bouts (jamais de sortie par le rail)', () => {
  assert.equal(clampStep(-3), 0)
  assert.equal(clampStep(0), 0)
  assert.equal(clampStep(2), 2)
  assert.equal(clampStep(4), 4)
  assert.equal(clampStep(9), 4)
  // une étape restaurée d'un brouillon corrompu retombe sur la première
  assert.equal(clampStep(NaN), 0)
  assert.equal(clampStep(undefined), 0)
  assert.equal(clampStep('3'), 3)
})

test('indexOfStep retrouve une étape par son id, -1 pour un inconnu', () => {
  assert.equal(indexOfStep('template'), 0)
  assert.equal(indexOfStep('meteo'), 4)
  assert.equal(indexOfStep('shaders'), -1)
})

// ---- le point qui décide de tout : l'étape 1 pré-remplit les étapes 2 à 5 --
// Un template porte le look COMPLET. Si une seule clé d'une étape aval n'était
// pas dedans, l'étape ne pourrait pas s'ouvrir sur « ce que le template a
// posé » — l'assistant redeviendrait un diaporama de réglages indépendants.

test('chaque clé des étapes 2 à 5 est portée par un template (donc pré-remplie par l’étape 1)', () => {
  const tpl = new Set(TEMPLATE_KEYS)
  for (const k of downstreamKeys()) {
    assert.ok(tpl.has(k), `${k} devrait faire partie de TEMPLATE_KEYS`)
  }
})

test('les étapes 2 à 5 ne se marchent pas dessus : aucune clé partagée', () => {
  const seen = new Map()
  for (const [step, keys] of Object.entries(STEP_KEYS)) {
    for (const k of keys) {
      assert.equal(seen.get(k), undefined, `${k} est réclamée par ${seen.get(k)} et ${step}`)
      seen.set(k, step)
    }
  }
})

test('l’étape Template ne réclame aucune clé en propre — elle les pose toutes', () => {
  assert.equal(STEP_KEYS.template, undefined)
  assert.equal(ATELIER_STEPS[0].id, 'template')
})

// ---- ce que le mode simple ÉCARTE, explicitement -------------------------

test('shaders, effets, terrain, grilles et courbes de niveau restent hors du mode simple', () => {
  const reachable = new Set(downstreamKeys())
  for (const k of SIMPLE_EXCLUDED) {
    assert.ok(!reachable.has(k), `${k} ne doit pas être réglable depuis l’assistant simple`)
  }
})

test('SIMPLE_EXCLUDED nomme de vraies clés de template (sinon la garde ne garde rien)', () => {
  const tpl = new Set(TEMPLATE_KEYS)
  for (const k of SIMPLE_EXCLUDED) assert.ok(tpl.has(k), `${k} n’existe pas dans TEMPLATE_KEYS`)
})

test('les familles écartées sont bien toutes représentées', () => {
  // une par famille citée par Adrien — le test tombe si quelqu'un vide la liste
  for (const k of ['surfaceFx', 'fx', 'terrainSurfaceMat', 'gridStep', 'contourInterval', 'bloomEnabled']) {
    assert.ok(SIMPLE_EXCLUDED.includes(k), `${k} manque à la liste des écartées`)
  }
})

// ---- « affiner », jamais « recommencer » : le diff avec le template -------

test('changedKeys ne voit rien tant que l’étape n’a pas été touchée', () => {
  const base = { rampStops: [{ p: 0, c: '#000' }], oceanMid: '#123456', bgEnv: 'sunset' }
  const look = { rampStops: [{ p: 0, c: '#000' }], oceanMid: '#123456', bgEnv: 'sunset' }
  assert.deepEqual(changedKeys('palette', look, base), [])
  assert.equal(isStepTouched('palette', look, base), false)
})

test('changedKeys compare par VALEUR — deux rampes identiques ne sont pas une modification', () => {
  // rampStops est un tableau d'objets recréé à chaque application de palette :
  // une comparaison par référence marquerait « modifié » sans que rien ne bouge
  const base = { rampStops: [{ p: 0.5, c: '#aabbcc' }] }
  const look = { rampStops: [{ p: 0.5, c: '#aabbcc' }] }
  assert.deepEqual(changedKeys('palette', look, base), [])
  look.rampStops = [{ p: 0.5, c: '#aabbcd' }]
  assert.deepEqual(changedKeys('palette', look, base), ['rampStops'])
})

test('changedKeys reste cantonné à SON étape', () => {
  const base = { rampStops: [], bgEnv: '', roadsEnabled: true }
  const look = { rampStops: [], bgEnv: 'dawn', roadsEnabled: false }
  assert.deepEqual(changedKeys('palette', look, base), [])
  assert.deepEqual(changedKeys('ciel', look, base), ['bgEnv'])
  assert.deepEqual(changedKeys('calques', look, base), ['roadsEnabled'])
  assert.equal(isStepTouched('ciel', look, base), true)
})

test('sans référence (aucun template posé), rien n’est « modifié »', () => {
  assert.deepEqual(changedKeys('ciel', { bgEnv: 'dawn' }, null), [])
  assert.equal(isStepTouched('ciel', { bgEnv: 'dawn' }, null), false)
})

test('l’étape Template ne peut pas être « modifiée » — elle est la référence', () => {
  assert.deepEqual(changedKeys('template', { bgEnv: 'x' }, { bgEnv: 'y' }), [])
  assert.equal(isStepTouched('template', { bgEnv: 'x' }, { bgEnv: 'y' }), false)
})

// ---- les résumés : ce que l'étape a posé, lisible sans l'ouvrir -----------

test('paletteSummary compte les teintes de la rampe', () => {
  assert.equal(paletteSummary({ rampStops: [1, 2, 3, 4, 5, 6, 7, 8] }), '8 teintes')
  assert.equal(paletteSummary({ rampStops: [1] }), '1 teinte')
  assert.equal(paletteSummary({}), 'Palette par défaut')
})

test('skySummary nomme le ciel posé, ou dit qu’il n’y en a pas', () => {
  const envs = [{ id: 'dawn', label: 'Aube' }, { id: 'noon', label: 'Midi' }]
  assert.equal(skySummary({ bgEnv: 'dawn' }, envs), 'Aube')
  assert.equal(skySummary({ bgEnv: '' }, envs), 'Aucun ciel')
  assert.equal(skySummary({}, envs), 'Aucun ciel')
  // un ciel enregistré dans un vieux template dont le fichier a disparu
  assert.equal(skySummary({ bgEnv: 'perdu' }, envs), 'Aucun ciel')
})

test('layersSummary liste les calques allumés, dans l’ordre du panneau', () => {
  assert.equal(layersSummary({ roadsEnabled: true, waterEnabled: true, placesEnabled: true }), 'Routes · Eau · Lieux')
  assert.equal(layersSummary({ waterEnabled: true }), 'Eau')
  assert.equal(layersSummary({}), 'Aucun calque')
  assert.equal(layersSummary({ roadsEnabled: false, waterEnabled: false }), 'Aucun calque')
})

test('LAYERS ne contient que des calques d’habillage — ni courbes ni grille', () => {
  const keys = LAYERS.map((l) => l.key)
  assert.ok(keys.includes('roadsEnabled') && keys.includes('waterEnabled') && keys.includes('placesEnabled'))
  for (const k of keys) assert.ok(!SIMPLE_EXCLUDED.includes(k))
})

test('windSummary parle en points cardinaux, et se tait quand rien ne vole', () => {
  assert.equal(windSummary({ cloudsEnabled: false, windSpeed: 1 }), 'sans vent')
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 0 }), 'air calme')
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 0.3, windDir: 0 }), 'brise vers l’est')
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 1, windDir: 90 }), 'vent soutenu vers le nord')
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 2, windDir: 180 }), 'grand vent vers l’ouest')
  // la direction est un angle : 360 revient à l'est, pas hors du tableau
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 0.3, windDir: 360 }), 'brise vers l’est')
  assert.equal(windSummary({ cloudsEnabled: true, windSpeed: 0.3, windDir: -90 }), 'brise vers le sud')
})

test('seaSummary nomme l’état de mer par la hauteur de houle', () => {
  assert.equal(seaSummary({ seaWaveH: 0 }), 'mer d’huile')
  assert.equal(seaSummary({ seaWaveH: 0.4 }), 'mer d’huile')
  assert.equal(seaSummary({ seaWaveH: 0.8 }), 'petites vagues')
  assert.equal(seaSummary({ seaWaveH: 1.4 }), 'mer formée')
  assert.equal(seaSummary({}), 'mer d’huile')
})

test('weatherSummary assemble ciel, vent et mer en une ligne lisible', () => {
  assert.equal(weatherSummary({ cloudsEnabled: true, windSpeed: 1, windDir: 90, seaWaveH: 0.8 }), 'Nuages · vent soutenu vers le nord · petites vagues')
  assert.equal(weatherSummary({ cloudsEnabled: false, seaWaveH: 1.5 }), 'Ciel dégagé · sans vent · mer formée')
  assert.equal(weatherSummary({}), 'Ciel dégagé · sans vent · mer d’huile')
})

test('stepSummary route vers le bon résumé et reste muet sur l’étape Template', () => {
  const p = { rampStops: [1, 2], bgEnv: '', roadsEnabled: true, cloudsEnabled: false, windSpeed: 1, seaWaveH: 0.5 }
  assert.equal(stepSummary('template', p, []), '')
  assert.equal(stepSummary('palette', p, []), '2 teintes')
  assert.equal(stepSummary('ciel', p, []), 'Aucun ciel')
  assert.equal(stepSummary('calques', p, []), 'Routes')
  assert.equal(stepSummary('meteo', p, []), 'Ciel dégagé · sans vent · petites vagues')
  assert.equal(stepSummary('inconnu', p, []), '')
})
