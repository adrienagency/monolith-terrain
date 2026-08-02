import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS } from '../src/templates-user.js'
import {
  ATELIER_STEPS,
  STEP_KEYS,
  SIMPLE_EXCLUDED,
  LAYERS,
  LIST_CAP,
  capList,
  clampStep,
  indexOfStep,
  entryStep,
  zoneSummary,
  downstreamKeys,
  changedKeys,
  isStepTouched,
  discardSummary,
  frJoin,
  paletteSummary,
  skySummary,
  layersSummary,
  windSummary,
  seaSummary,
  weatherSummary,
  stepSummary,
} from '../src/ui/atelier-steps.js'

// ---- l'enchaînement lui-même ---------------------------------------------

test('l’assistant a exactement les six étapes demandées, dans l’ordre', () => {
  assert.deepEqual(ATELIER_STEPS.map((s) => s.id), ['zone', 'template', 'palette', 'ciel', 'calques', 'meteo'])
  assert.deepEqual(ATELIER_STEPS.map((s) => s.label), ['Zone', 'Template', 'Palette', 'Ciel', 'Calques', 'Météo'])
})

test('clampStep borne la navigation aux deux bouts (jamais de sortie par le rail)', () => {
  assert.equal(clampStep(-3), 0)
  assert.equal(clampStep(0), 0)
  assert.equal(clampStep(2), 2)
  assert.equal(clampStep(5), 5)
  assert.equal(clampStep(9), 5)
  // une étape restaurée d'un brouillon corrompu retombe sur la première
  assert.equal(clampStep(NaN), 0)
  assert.equal(clampStep(undefined), 0)
  assert.equal(clampStep('3'), 3)
})

test('indexOfStep retrouve une étape par son id, -1 pour un inconnu', () => {
  assert.equal(indexOfStep('zone'), 0)
  assert.equal(indexOfStep('template'), 1)
  assert.equal(indexOfStep('meteo'), 5)
  assert.equal(indexOfStep('shaders'), -1)
})

// ---- ⓪ la zone : proposer sans reprendre ---------------------------------
// Les deux moitiés de la demande d'Adrien sont contradictoires si on les lit
// mal : « laisser choisir sa zone » ET « reprendre la zone en cours ». C'est
// entryStep qui les concilie — d'où deux tests plutôt qu'un.

test('un premier visiteur ouvre SUR l’étape Zone : il n’a pas encore choisi', () => {
  assert.equal(entryStep(false), 0)
  assert.equal(ATELIER_STEPS[entryStep(false)].id, 'zone')
})

test('un visiteur qui a navigué garde sa zone et ouvre sur le Template', () => {
  assert.equal(entryStep(true), indexOfStep('template'))
  assert.equal(ATELIER_STEPS[entryStep(true)].id, 'template')
})

test('l’étape Zone reste atteignable par le rail dans les deux cas (rien n’est bloquant)', () => {
  // le rail va où il veut : entryStep ne fait que choisir la PORTE d'entrée
  assert.equal(clampStep(0), 0)
  assert.equal(indexOfStep('zone'), 0)
})

test('l’étape Zone ne réclame aucune clé de look — la zone n’est pas un habillage', () => {
  // demLat/demLon/demZoom ne sont pas des TEMPLATE_KEYS : un template ne porte
  // pas la localisation. L'étape ⓪ doit donc rester hors de STEP_KEYS, sinon
  // le test « chaque clé est portée par un template » tomberait.
  assert.equal(STEP_KEYS.zone, undefined)
  assert.deepEqual(changedKeys('zone', { demLat: 1 }, { demLat: 2 }), [])
})

test('zoneSummary nomme la zone, ou dit franchement qu’il n’y en a pas', () => {
  assert.equal(zoneSummary({ name: 'Chamonix' }), 'Chamonix')
  assert.equal(zoneSummary('La Réunion'), 'La Réunion')
  assert.equal(zoneSummary({ name: '' }), 'Aucune zone choisie')
  assert.equal(zoneSummary(null), 'Aucune zone choisie')
  assert.equal(zoneSummary({}), 'Aucune zone choisie')
})

test('« Custom » est un mot du moteur, pas un nom : on montre les coordonnées', () => {
  // demLocation vaut 'Custom' dès qu'on a volé quelque part sans nom de lieu.
  // « Votre zone : Custom » n'apprend rien à personne.
  assert.equal(zoneSummary({ name: 'Custom', lat: 45.9297, lon: 6.9294 }), '45.930, 6.929')
  assert.equal(zoneSummary({ lat: -21.26, lon: 55.74 }), '-21.260, 55.740')
  // sans coordonnées exploitables, on retombe sur l'aveu franc
  assert.equal(zoneSummary({ name: 'Custom' }), 'Aucune zone choisie')
  assert.equal(zoneSummary({ name: 'Custom', lat: NaN, lon: 3 }), 'Aucune zone choisie')
})

// ---- le débordement des listes -------------------------------------------
// « Vos templates » passait sous la ligne de flottaison, poussé par une
// bibliothèque sans fin. capList est ce qui rend la coupe visible.

test('capList laisse passer une liste qui tient, sans proposer de déplier le vide', () => {
  const petit = [1, 2, 3]
  assert.deepEqual(capList(petit), { shown: petit, hidden: 0, more: false })
  // pile-poil au plafond : rien à cacher, donc pas de « voir plus »
  const pile = Array.from({ length: LIST_CAP }, (_, i) => i)
  assert.deepEqual(capList(pile), { shown: pile, hidden: 0, more: false })
})

test('capList coupe à huit et DIT combien elle cache', () => {
  const douze = Array.from({ length: 12 }, (_, i) => i)
  const r = capList(douze)
  assert.equal(r.shown.length, LIST_CAP)
  assert.equal(r.hidden, 4)
  assert.equal(r.more, true)
  assert.deepEqual(r.shown, [0, 1, 2, 3, 4, 5, 6, 7])
})

test('capList déplié rend la liste entière et retire le bouton', () => {
  const douze = Array.from({ length: 12 }, (_, i) => i)
  assert.deepEqual(capList(douze, true), { shown: douze, hidden: 0, more: false })
})

test('capList survit à l’absence de liste et à un plafond absurde', () => {
  assert.deepEqual(capList(null), { shown: [], hidden: 0, more: false })
  assert.deepEqual(capList(undefined), { shown: [], hidden: 0, more: false })
  // un plafond nul reviendrait à tout cacher : on retombe sur le plafond normal
  assert.equal(capList([1, 2, 3, 4, 5, 6, 7, 8, 9], false, 0).shown.length, LIST_CAP)
  assert.equal(capList([1, 2, 3], false, 2).hidden, 1)
})

test('le rail a maintenant assez d’étapes pour déborder une colonne étroite', () => {
  // six pastilles « n · Libellé » ne tiennent plus sur 42vw : c'est ce qui
  // justifie le défilement latéral du rail (atelier.css)
  assert.ok(ATELIER_STEPS.length >= 6)
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
  // elle n'ouvre plus le chemin (la Zone la précède) mais reste la RÉFÉRENCE
  // des quatre étapes d'habillage qui la suivent
  assert.equal(ATELIER_STEPS[1].id, 'template')
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
  //
  // ⚠️ 'bloomEnabled' TENAIT LA FAMILLE « effets » ET A ÉTÉ REMPLACÉ PAR
  // 'liquidMetal' le 2026-08-02 : la passe de bloom a été retirée du produit
  // (Adrien : « inutile, on retire »), donc la clé n'existe plus dans
  // TEMPLATE_KEYS et le test au-dessus — « SIMPLE_EXCLUDED nomme de vraies clés
  // de template » — la refuserait. La famille, elle, doit rester gardée.
  for (const k of ['surfaceFx', 'fx', 'terrainSurfaceMat', 'gridStep', 'contourInterval', 'liquidMetal']) {
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
  const base = { rampStops: [], bgEnv: '', waterEnabled: true }
  const look = { rampStops: [], bgEnv: 'dawn', waterEnabled: false }
  assert.deepEqual(changedKeys('palette', look, base), [])
  assert.deepEqual(changedKeys('ciel', look, base), ['bgEnv'])
  assert.deepEqual(changedKeys('calques', look, base), ['waterEnabled'])
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

// ---- ③ ce qu'« Annuler » emporte, nommé ----------------------------------
// « Êtes-vous sûr ? » fait répéter le geste sans aider à décider. La bonne
// confirmation nomme la PERTE — d'où discardSummary, comparé au look
// d'ARRIVÉE et non au template : c'est la séance entière qui part.

test('rien de touché : Annuler n’a rien à emporter, donc rien à demander', () => {
  const l = { rampStops: [1], bgEnv: 'dawn', waterEnabled: true, seaWaveH: 0.8 }
  assert.deepEqual(discardSummary(l, { ...l }), [])
})

test('discardSummary nomme les étapes touchées, dans l’ordre du rail', () => {
  const entry = { rampStops: [1], bgEnv: '', waterEnabled: true, cloudsEnabled: false }
  const look = { rampStops: [1, 2], bgEnv: 'dawn', waterEnabled: true, cloudsEnabled: true }
  assert.deepEqual(discardSummary(look, entry), ['Palette', 'Ciel', 'Météo'])
})

test('discardSummary ne promet jamais de rendre la zone — Annuler ne la repose pas', () => {
  // la zone ne vit pas dans le look : l'annoncer serait promettre un retour
  // qui n'aura pas lieu
  const r = discardSummary({ rampStops: [1], demLat: 9 }, { rampStops: [2], demLat: 1 })
  assert.ok(!r.includes('Zone'))
  assert.ok(!r.includes('Template'))
  assert.deepEqual(r, ['Palette'])
})

test('sans snapshot d’arrivée, on n’invente pas une perte', () => {
  assert.deepEqual(discardSummary(null, { rampStops: [1] }), [])
  assert.deepEqual(discardSummary({ rampStops: [1] }, null), [])
})

test('frJoin énumère à la française — « et » au dernier cran, pas une virgule', () => {
  assert.equal(frJoin(['Palette', 'Ciel', 'Météo']), 'Palette, Ciel et Météo')
  assert.equal(frJoin(['Palette', 'Ciel']), 'Palette et Ciel')
  assert.equal(frJoin(['Palette']), 'Palette')
  assert.equal(frJoin([]), '')
  assert.equal(frJoin(null), '')
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
  assert.equal(layersSummary({ waterEnabled: true, placesEnabled: true, aerialEnabled: true }), 'Eau · Lieux · Photo')
  assert.equal(layersSummary({ waterEnabled: true }), 'Eau')
  assert.equal(layersSummary({}), 'Aucun calque')
  assert.equal(layersSummary({ waterEnabled: false, placesEnabled: false }), 'Aucun calque')
})

test('LAYERS ne contient que des calques d’habillage — ni courbes ni grille', () => {
  const keys = LAYERS.map((l) => l.key)
  assert.ok(keys.includes('waterEnabled') && keys.includes('placesEnabled'))
  for (const k of keys) assert.ok(!SIMPLE_EXCLUDED.includes(k))
})

// ---- ⑨ le trait de côte a quitté le site ---------------------------------
// Le liseré Natural Earth 1:10m est parti (trop grossier). Le MASQUE terre-mer
// n'a rien à voir et reste : ce test garde la première porte fermée, il ne
// dit rien du second.

test('plus aucun calque « trait de côte » à allumer', () => {
  assert.ok(!LAYERS.some((l) => l.key === 'coastLine'))
  assert.ok(!downstreamKeys().includes('coastLine'))
  assert.ok(!layersSummary({ coastLine: true }).includes('Côte'))
})

// ---- ⑩ le calque ROUTES a quitté le site ---------------------------------
// Adrien : « très lourd, très mauvais, tu peux le supprimer. » Même forme que
// le trait de côte ci-dessus : la clé survit dans de vieux gabarits, elle ne
// doit plus rien allumer ni s'annoncer nulle part.

test('plus aucun calque « routes » à allumer', () => {
  assert.ok(!LAYERS.some((l) => l.key === 'roadsEnabled'))
  for (const k of ['roadsEnabled', 'roadsOpacity', 'roadsDetail', 'roadColor']) {
    assert.ok(!downstreamKeys().includes(k), `${k} est encore réglable depuis l’assistant`)
  }
  // un vieux gabarit routes-allumées ne doit rien faire dire au résumé
  assert.equal(layersSummary({ roadsEnabled: true }), 'Aucun calque')
  assert.deepEqual(changedKeys('calques', { roadsEnabled: true }, { roadsEnabled: false }), [])
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

// ---- ⑪ la mer se débraye --------------------------------------------------

test('mer éteinte : on le dit, on ne décrit pas la houle d’une mer absente', () => {
  assert.equal(seaSummary({ seaEnabled: false, seaWaveH: 1.4 }), 'sans mer')
  assert.equal(seaSummary({ seaEnabled: false }), 'sans mer')
})

test('une mer sans interrupteur enregistré est ALLUMÉE (les looks d’avant en avaient une)', () => {
  assert.equal(seaSummary({ seaWaveH: 0.8 }), 'petites vagues')
  assert.equal(seaSummary({ seaEnabled: true, seaWaveH: 0.8 }), 'petites vagues')
  // seul le faux explicite éteint — pas un 0, pas une chaîne vide
  assert.equal(seaSummary({ seaEnabled: undefined, seaWaveH: 1.4 }), 'mer formée')
})

test('l’interrupteur de mer appartient à l’étape Météo, et à elle seule', () => {
  assert.ok(STEP_KEYS.meteo.includes('seaEnabled'))
  assert.deepEqual(changedKeys('meteo', { seaEnabled: false }, { seaEnabled: true }), ['seaEnabled'])
  assert.deepEqual(changedKeys('calques', { seaEnabled: false }, { seaEnabled: true }), [])
})

test('weatherSummary assemble ciel, vent et mer en une ligne lisible', () => {
  assert.equal(weatherSummary({ cloudsEnabled: true, windSpeed: 1, windDir: 90, seaWaveH: 0.8 }), 'Nuages · vent soutenu vers le nord · petites vagues')
  assert.equal(weatherSummary({ cloudsEnabled: false, seaWaveH: 1.5 }), 'Ciel dégagé · sans vent · mer formée')
  assert.equal(weatherSummary({}), 'Ciel dégagé · sans vent · mer d’huile')
})

test('stepSummary route vers le bon résumé et reste muet sur l’étape Template', () => {
  const p = { rampStops: [1, 2], bgEnv: '', waterEnabled: true, cloudsEnabled: false, windSpeed: 1, seaWaveH: 0.5 }
  assert.equal(stepSummary('template', p, []), '')
  assert.equal(stepSummary('palette', p, []), '2 teintes')
  assert.equal(stepSummary('ciel', p, []), 'Aucun ciel')
  assert.equal(stepSummary('calques', p, []), 'Eau')
  assert.equal(stepSummary('meteo', p, []), 'Ciel dégagé · sans vent · petites vagues')
  assert.equal(stepSummary('inconnu', p, []), '')
})
