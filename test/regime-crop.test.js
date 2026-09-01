// LE RÉGIME DU CROP — PF3 : « la mer et les effets n'apparaissent qu'en mode
// crop » (Adrien, 2026-09-01).
//
// Deux choses sont gardées ici, et elles sont de nature différente :
//
//   ① **le branchement** (`branchement-crop.js`) : `surBascule` est appelé UNE
//      fois à la naissance, UNE fois à la mort, jamais à un déménagement ni sur
//      une image stable — et il lit l'état FINAL (la mer déjà posée, ou le crop
//      déjà retiré). Testé sur le globe de papier de `crop-branche.test.js`.
//   ② **l'unicité de l'écrivain** (`main.js`, `perf.js`, `effects-panel.js`) :
//      `aoPass.enabled` et l'opacité du grain n'ont qu'UN écrivain d'état, le
//      régime — et `tick()` n'en contient aucun. ⚠️ **AUCUN TEST NE CHARGE
//      `main.js`** (§0 du plan) : c'est une lecture de source, déclarée telle,
//      comme `crop-branche.test.js` ⑧h. Elle attrape le retour de
//      l'interrupteur par image, qui est exactement la faute que PF3 retire.
//   ③ **le gouverneur** (`perf.js`) : un changement de palier rappelle le
//      régime (`syncEffets`) au lieu d'écrire sur le grain.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const sansCommentaires = (s) => s.replace(/\/\/[^\n]*/g, '')

// le globe de papier de `crop-branche.test.js`, réduit à ce que ce test lit
function globeFactice() {
  const j = []
  const g = {
    _crop: null,
    journal: j,
    poserCrop(a) { j.push('crop'); g._crop = { demi: a.tuilesParBloc / 2 / 2 ** a.zoom }; return g._crop },
    poserFondCrop() { j.push('fond'); return g._crop ? { refus: null, couverture: 1, bathy: true, rebati: 1 } : { refus: 'crop' } },
    construireParoisCrop() { j.push('parois'); return g._crop ? { mesh: {}, refus: null } : null },
    poserHabillage(a) { j.push('habillage'); return a },
    poserRampe() { j.push('rampe'); return g._crop ? { refus: null, echelle: {} } : { refus: 'crop' } },
    async poserMer() { j.push('mer'); return g._crop ? { portee: 4, couverture: 1 } : null },
    retirerCrop() { j.push('retirer'); g._crop = null },
  }
  return g
}
const contexteFactice = (centre = { lat: 45.9, lon: 6.87 }, zoom = 12) => () => ({
  centre, zoom, tuilesParBloc: 3,
  habillage: { coastMask: 'm', amplitudeM: 2400 }, fond: { portee: 3 }, mer: { altitudeM: 12_000, fovDeg: 33, hauteurPx: 900 },
})

// ══════════ ① LE BRANCHEMENT ═══════════════════════════════════════════════

test('① `surBascule` : une fois à la naissance, une fois à la mort — jamais entre les deux', () => {
  const g = globeFactice()
  const appels = []
  const veille = creerVeilleCrop({
    globe: g, contexte: contexteFactice(),
    surBascule: (pose) => appels.push({ pose, veillePose: veille.pose, crop: !!g._crop, journal: [...g.journal] }),
  })
  // au-dessus du seuil : rien
  for (let i = 0; i < 50; i++) veille.maj(SEUIL_NAISSANCE_M * 1.5)
  assert.deepEqual(appels, [], 'pas de crop, pas de régime')
  // la naissance
  veille.maj(SEUIL_NAISSANCE_M * 0.9)
  assert.equal(appels.length, 1)
  assert.equal(appels[0].pose, true)
  assert.equal(appels[0].veillePose, true, 'le régime lit `veille.pose` VRAI pendant l’appel')
  assert.equal(appels[0].crop, true)
  assert.ok(appels[0].journal.includes('mer'), 'la mer est déjà posée quand le régime est relu — l’état lu est l’état final')
  // mille images stables : rien
  for (let i = 0; i < 1000; i++) veille.maj(SEUIL_NAISSANCE_M * 0.9)
  assert.equal(appels.length, 1, 'une image stable n’est pas une bascule')
  // l'hystérésis : entre naissance et mort, rien non plus
  veille.maj(SEUIL_NAISSANCE_M * 1.05)
  assert.equal(appels.length, 1)
  // la mort
  veille.maj(SEUIL_MORT_M * 1.01)
  assert.equal(appels.length, 2)
  assert.equal(appels[1].pose, false)
  assert.equal(appels[1].veillePose, false)
  assert.equal(appels[1].crop, false, 'le crop est déjà retiré quand le régime est relu')
  assert.equal(appels[1].journal.at(-1), 'retirer')
  assert.equal(veille.bascules, 2, 'et le compteur de bascules du branchement dit la même chose')
})

test('① bis un déménagement rejoue la chaîne, pas le régime', () => {
  const g = globeFactice()
  let centre = { lat: 45.9, lon: 6.87 }
  const appels = []
  const veille = creerVeilleCrop({ globe: g, contexte: () => contexteFactice(centre)(), surBascule: (p) => appels.push(p) })
  veille.maj(20_000)
  assert.deepEqual(appels, [true])
  centre = { lat: -21.1, lon: 55.5 }
  veille.maj(20_000)
  assert.equal(g.journal.filter((q) => q === 'crop').length, 2, 'la chaîne a bien été rejouée')
  assert.deepEqual(appels, [true], 'mais le régime, non : l’état du compositeur n’a pas changé')
})

test('① ter passer en orbite est une mort, et une seule', () => {
  const g = globeFactice()
  const appels = []
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), surBascule: (p) => appels.push(p) })
  veille.maj(20_000)
  veille.poserMode(false)
  assert.deepEqual(appels, [true, false])
  // en orbite, aucune altitude ne ressuscite le crop, donc aucun appel
  for (const alt of [20_000, 5_000, 1_000]) veille.maj(alt)
  assert.deepEqual(appels, [true, false])
  // et repasser en surface sans crop posé ne compte pas une mort de plus
  veille.poserMode(true)
  assert.deepEqual(appels, [true, false])
})

test('① quater sans `surBascule`, la veille se comporte exactement comme avant', () => {
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  assert.doesNotThrow(() => { veille.maj(20_000); veille.maj(SEUIL_MORT_M * 2); veille.poserMode(false) })
  assert.equal(veille.bascules, 2)
})

// ══════════ ② UN SEUL ÉCRIVAIN — lecture de SOURCE, déclarée telle ══════════

test('② `aoPass.enabled` n’a que deux écrivains dans main.js : la naissance de la passe (éteinte) et le régime', () => {
  const src = sansCommentaires(lire('src/main.js'))
  const ecritures = [...src.matchAll(/aoPass\.enabled\s*=(?!=)/g)]
  assert.equal(ecritures.length, 2, `écritures trouvées : ${ecritures.length}`)
  // la passe naît ÉTEINTE — c'est le régime qui l'allume, dans le crop
  assert.match(src, /aoPass\.enabled = false\n\}/, 'configureAoPass doit laisser la passe éteinte')
  // et le régime est la seule fonction qui la décide
  const i = src.indexOf('function poserRegimeCrop()')
  assert.ok(i > 0, 'le régime existe')
  const corps = src.slice(i, src.indexOf('\n}', i))
  assert.match(corps, /dedansCrop\(\)/, 'le régime lit LE prédicat')
  assert.match(corps, /aoPass\.enabled = aoVoulu/)
  assert.match(corps, /params\._aoTierOk !== false/, 'le palier se compose avec le mode')
  assert.match(corps, /grain\.blendMode\.opacity\.value = dedans \? params\.grain : 0/)
  assert.ok(!/dofPass|setDofEnabled/.test(corps), 'D20 : la profondeur de champ n’est PAS du ressort du régime')
})

test('② bis `tick()` ne porte plus d’interrupteur par image pour l’occlusion ni le grain', () => {
  const src = lire('src/main.js')
  const iTick = src.indexOf('\nfunction tick() {')
  assert.ok(iTick > 0)
  const tick = sansCommentaires(src.slice(iTick, src.indexOf('\n}\n', iTick)))
  assert.ok(!/aoPass\.enabled\s*=/.test(tick), 'l’occlusion ne se décide plus à chaque image')
  assert.ok(!/grain\.blendMode/.test(tick), 'le grain non plus')
  assert.ok(!/poserRegimeCrop\(\)/.test(tick), 'et le régime lui-même n’est PAS appelé par image')
})

test('② ter l’opacité du grain : les seuls écrivains sont l’initialisation, le pavage d’affiche (aller-retour) et le régime', () => {
  const src = sansCommentaires(lire('src/main.js'))
  const ecritures = [...src.matchAll(/grain\.blendMode\.opacity\.value\s*=(?!=)/g)].map((m) => m.index)
  // init (`= params.grain`), neutraliser (`= 0`), restaurer (`= oGrain`), régime
  assert.equal(ecritures.length, 4, `écritures trouvées : ${ecritures.length}`)
  assert.ok(!/grain\.blendMode/.test(sansCommentaires(lire('src/perf.js'))), 'perf.js n’écrit plus sur le grain')
  assert.ok(!/grain\.blendMode/.test(sansCommentaires(lire('src/ui/effects-panel.js'))), 'le panneau d’effets non plus')
  // et le gabarit passe par params + régime, pas par l'objet
  assert.match(src, /if \(k\.grain != null\) params\.grain = k\.grain\n/)
  assert.match(src, /if \(k\.grain != null \|\| k\.ssaoEnabled != null\) poserRegimeCrop\(\)/)
})

test('② quater la veille du crop est branchée sur le régime, et l’état initial est posé avant `tick()`', () => {
  const src = sansCommentaires(lire('src/main.js'))
  const i = src.indexOf('const veilleCrop = creerVeilleCrop({')
  const appel = src.slice(i, src.indexOf('\n})', i))
  assert.match(appel, /surBascule: \(\) => poserRegimeCrop\(\)/)
  assert.match(src, /poserRegimeCrop\(\)\ntick\(\)\n/, 'l’état initial (pas de crop → pas d’effets) est posé juste avant la première image')
  // le prédicat : `veilleCrop.pose` sous terre unique, la vue de surface sinon
  assert.match(src, /function dedansCrop\(\) \{\n  return terreUniqueBranchee \? !!veilleCrop\?\.pose : modes\?\.mode === 'surface'\n\}/)
})

test('② quinquies D20 : `setEffectsEnabled` n’éteint plus la profondeur de champ en orbite', () => {
  const src = lire('src/main.js')
  const i = src.indexOf('    setEffectsEnabled(v) {')
  assert.ok(i > 0)
  const corps = sansCommentaires(src.slice(i, src.indexOf('\n    },', i)))
  assert.ok(!/setDofEnabled/.test(corps), 'la profondeur de champ est active à tous les zooms (D20)')
  assert.match(corps, /poserRegimeCrop\(\)/)
  assert.match(corps, /sun\.castShadow = v/, 'les ombres, elles, suivent toujours le mode')
})

// ══════════ ③ LE GOUVERNEUR RAPPELLE LE RÉGIME ══════════════════════════════

test('③ un changement de palier pose `params` puis rappelle `syncEffets` — il n’écrit plus sur l’objet', async () => {
  const g = globalThis
  const sauve = { matchMedia: g.matchMedia, screen: g.screen, document: g.document, performance: g.performance }
  g.matchMedia = () => ({ matches: false })
  g.screen = { width: 2560, height: 1440 }
  g.document = { addEventListener() {} }
  g.performance = { now: () => 0 }
  try {
    const { createAdaptiveQuality } = await import('../src/perf.js')
    const params = { pixelRatio: 2, shadowMode: 'dynamic', grain: 0.26, bokehEnabled: true, bokehScale: 1 }
    const grain = { blendMode: { opacity: { value: 0.26 } } }
    let rappels = 0
    const aq = createAdaptiveQuality({
      params, grain,
      renderer: { setPixelRatio() {}, setSize() {}, getPixelRatio: () => 1, domElement: {}, getContext: () => null },
      composer: { setSize() {} },
      applyShadowMode() {},
      lake: null,
      syncEffets: () => { rappels++ },
    })
    aq.setTier(3, true)
    assert.equal(params.grain, 0, 'le palier plancher met le grain de params à 0')
    assert.equal(params._aoTierOk, false)
    assert.equal(grain.blendMode.opacity.value, 0.26, 'mais il ne touche PAS à l’objet : c’est le régime qui l’écrit')
    assert.ok(rappels >= 1, 'et le régime a été rappelé')
  } finally { Object.assign(g, sauve) }
})
