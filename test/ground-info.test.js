import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCoord, toDMS, formatElevation, trimBlurb, splitBlurb, scaleBar, gatherGroundInfo, doitRafraichirCartouche, CARTOUCHE_SEUIL_FRAC } from '../src/ground-info.js'

test('formatCoord suffixes the right hemispheres', () => {
  assert.equal(formatCoord(45.8326, 6.8652), '45.8326°N  6.8652°E')
  assert.equal(formatCoord(-33.9249, 18.4241), '33.9249°S  18.4241°E')
  assert.equal(formatCoord(63.07, -151.0), '63.0700°N  151.0000°W')
})

test('toDMS converts decimal degrees to d°m′s″ with hemisphere', () => {
  assert.equal(toDMS(45.5, true), '45°30′00″N')
  assert.equal(toDMS(-0.5, false), '0°30′00″W')
})

test('formatElevation reads as a clean range with thousands separators', () => {
  assert.equal(formatElevation(1035, 3305, 2100), 'ELEV  1,035 – 3,305 m  ·  mean 2,100 m')
  assert.equal(formatElevation(-10905, -2598, -6000), 'ELEV  -10,905 – -2,598 m  ·  mean -6,000 m')
})

test('trimBlurb keeps short text whole and cuts long text at a sentence', () => {
  assert.equal(trimBlurb('A short line.'), 'A short line.')
  const long =
    'Denali is the highest mountain peak in North America. Its summit is 6,190 metres above sea level. ' +
    'It is the centerpiece of Denali National Park and Preserve and a very very long tail that keeps going on.'
  const out = trimBlurb(long, 120)
  assert.ok(out.length <= 121, 'trimmed to budget')
  assert.ok(out.endsWith('.') || out.endsWith('…'), 'ends cleanly')
})

test('splitBlurb separates a description from a distinct numeric/superlative anecdote', () => {
  const extract =
    'Denali is a mountain in Alaska. It is a national park landmark. Its summit is 6,190 metres above sea level, the highest in North America.'
  const { description, anecdote } = splitBlurb(extract)
  assert.ok(description.startsWith('Denali is a mountain'), 'description is the opening')
  assert.ok(/6,190|highest/.test(anecdote), 'anecdote is the notable fact')
  assert.notEqual(anecdote, description, 'the two are distinct')
})

test('splitBlurb degrades gracefully on empty / single-sentence text', () => {
  assert.deepEqual(splitBlurb(''), { description: '', anecdote: '' })
  const one = splitBlurb('Just one sentence here.')
  assert.equal(one.description, 'Just one sentence here.')
})

test('scaleBar picks a round segment near a quarter of the patch width', () => {
  assert.equal(scaleBar(112000), 'SCALE  0 ─── 25 ─── 50 km') // z10 ≈ 112 km across
  assert.equal(scaleBar(28000), 'SCALE  0 ─── 5 ─── 10 km') // z12 ≈ 28 km → 7 km/4 → seg 5
  assert.equal(scaleBar(0), '')
})

test('gatherGroundInfo carries scale + distinct description/anecdote', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
  try {
    const info = await gatherGroundInfo({
      lat: 1.23,
      lon: 4.56,
      dem: { minM: 0, maxM: 100, meanM: 50, extentMeters: 28000 },
      fetchAnecdote: async () => ({ title: 'X', description: 'A place.', anecdote: 'It is the tallest.' }),
    })
    assert.equal(info.scale, 'SCALE  0 ─── 5 ─── 10 km')
    assert.equal(info.description, 'A place.')
    assert.equal(info.anecdote, 'It is the tallest.')
  } finally {
    globalThis.fetch = orig
  }
})

test('gatherGroundInfo never throws and always yields coords + a name', async () => {
  // stub fetch so no network is hit; make reverse-geocode fail
  const orig = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
  try {
    const info = await gatherGroundInfo({
      lat: 63.07,
      lon: -151.0,
      dem: { minM: 200, maxM: 6190, meanM: 1500 },
      fetchAnecdote: async () => ({ title: 'Denali', description: 'Highest peak in North America.', anecdote: '' }),
    })
    assert.equal(info.coord, '63.0700°N  151.0000°W')
    assert.equal(info.elevation, 'ELEV  200 – 6,190 m  ·  mean 1,500 m')
    assert.equal(info.description, 'Highest peak in North America.')
    assert.ok(info.name.length > 0, 'a name is always present (falls back to the title)')
  } finally {
    globalThis.fetch = orig
  }
})

// ══════════ LA FRAÎCHEUR DU CARTOUCHE ══════════════════════════════════════
//
// Le cartouche ne défile PAS — c'est du mobilier de socle, et c'est voulu. Ce
// qui doit changer, c'est ce qu'il RACONTE : après un socle de défilement
// (21 km à z12), il décrit un endroit où l'on n'est plus.

const SOCLE = 56 // TERRAIN_SIZE
const seuil = SOCLE * CARTOUCHE_SEUIL_FRAC

test('rien ne se rafraîchit tant que l’image BOUGE', () => {
  // Le cartouche interroge Nominatim ET Wikipédia : deux services publics, sans
  // clé. On ne les appelle pas image par image sous le doigt.
  assert.equal(
    doitRafraichirCartouche({ derniere: { x: 0, z: 0 }, courante: { x: 999, z: 999 }, repos: false, tailleSocle: SOCLE }),
    false
  )
})

test('au repos, il faut avoir bougé d’un quart de socle', () => {
  const dit = (x, z) => doitRafraichirCartouche({ derniere: { x: 0, z: 0 }, courante: { x, z }, repos: true, tailleSocle: SOCLE })
  assert.equal(dit(0, 0), false)
  assert.equal(dit(seuil - 0.01, 0), false, 'sous le seuil on regraverait dix textures pour un texte identique')
  assert.equal(dit(seuil, 0), true)
  assert.equal(dit(-seuil, 0), true, 'les quatre directions comptent pareil')
  assert.equal(dit(0, seuil), true)
})

test('la distance est une VRAIE distance, pas la plus grande des deux', () => {
  // Une diagonale de 0,72 quart de socle sur chaque axe dépasse le seuil ; la
  // lire axe par axe l'aurait manquée, et le cartouche aurait vieilli en
  // diagonale sans jamais se rafraîchir.
  const d = seuil * 0.72
  assert.equal(doitRafraichirCartouche({ derniere: { x: 0, z: 0 }, courante: { x: d, z: d }, repos: true, tailleSocle: SOCLE }), true)
})

test('le seuil se mesure depuis le DERNIER cartouche posé, pas depuis le chargement', () => {
  // Trois glissements d'un cinquième de socle ne déclencheraient jamais rien
  // s'ils étaient comptés séparément. Ici la référence avance à chaque pose,
  // donc le cumul finit par franchir le seuil.
  let derniere = { x: 0, z: 0 }
  let x = 0
  let poses = 0
  for (let i = 0; i < 10; i++) {
    x += SOCLE / 5
    if (doitRafraichirCartouche({ derniere, courante: { x, z: 0 }, repos: true, tailleSocle: SOCLE })) {
      derniere = { x, z: 0 }
      poses++
    }
  }
  assert.ok(poses >= 3, `dix cinquièmes de socle doivent poser au moins trois fois, ils en ont posé ${poses}`)
})

test('sans cartouche déjà posé, cette règle se tait — ce n’est pas son travail', () => {
  assert.equal(doitRafraichirCartouche({ derniere: null, courante: { x: 999, z: 0 }, repos: true, tailleSocle: SOCLE }), false)
  assert.equal(doitRafraichirCartouche({ derniere: { x: 0, z: 0 }, courante: null, repos: true, tailleSocle: SOCLE }), false)
})

test('une fenêtre cassée ne déclenche pas un appel réseau', () => {
  for (const courante of [{ x: NaN, z: 0 }, { x: 0, z: undefined }, { x: Infinity, z: 0 }]) {
    assert.equal(doitRafraichirCartouche({ derniere: { x: 0, z: 0 }, courante, repos: true, tailleSocle: SOCLE }), false, JSON.stringify(courante))
  }
})

// ══════════ L'ÉTENDUE ANNONCÉE EST CELLE DE LA DALLE, PAS DE L'EMPRISE ══════

// ⚠️ `fetch` est COUPÉ, comme dans le test au-dessus. `reverseGeocode` n'est
// pas injectable et partirait vraiment sur Nominatim : une suite de tests qui
// appelle un service public est une suite qui échoue le jour où il est lent.
const sansReseau = async (fn) => {
  const orig = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
  try {
    return await fn()
  } finally {
    globalThis.fetch = orig
  }
}

test('la barre d’échelle divise par empriseCote — elle annonçait 3× trop', () =>
  sansReseau(async () => {
    // ⚠️ Ce défaut-là n'attendait même pas un défilement : dès le chargement en
    // 3×3, `dem.extentMeters` est TRIPLÉ (dem-emprise.js) et la barre le lisait
    // tel quel. Même famille d'erreur que celle corrigée dans
    // `geo.surfaceMetersPerUnit`.
    const seul = { minM: 0, maxM: 100, meanM: 50, extentMeters: 21000 }
    const emprise = { ...seul, extentMeters: 63000, empriseCote: 3 }
    const x = await gatherGroundInfo({ lat: 1.11, lon: 2.22, dem: seul, fetchAnecdote: async () => ({}) })
    const y = await gatherGroundInfo({ lat: 1.11, lon: 2.22, dem: emprise, fetchAnecdote: async () => ({}) })
    assert.equal(y.scale, x.scale, 'la même dalle au sol doit donner la même barre d’échelle')
    assert.equal(x.scale, scaleBar(21000))
  }))

test('gatherGroundInfo préfère les stats de la DALLE à celles du MNT', () =>
  sansReseau(async () => {
    const dem = { minM: 0, maxM: 4000, meanM: 1200, extentMeters: 63000, empriseCote: 3 }
    const info = await gatherGroundInfo({
      lat: 1.11, lon: 2.22, dem,
      stats: { minM: 810, maxM: 1240, meanM: 990 },
      fetchAnecdote: async () => ({}),
    })
    assert.equal(info.elevation, formatElevation(810, 1240, 990))
    assert.ok(!info.elevation.includes('4,000'), 'la plage des 21 km alentour n’a rien à faire sous une vallée')
  }))

test('sans stats, on retombe exactement sur le comportement d’avant', () =>
  sansReseau(async () => {
    const dem = { minM: 12, maxM: 900, meanM: 300, extentMeters: 21000 }
    const info = await gatherGroundInfo({ lat: 1.11, lon: 2.22, dem, fetchAnecdote: async () => ({}) })
    assert.equal(info.elevation, formatElevation(12, 900, 300))
  }))
