import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizePalette, isElegantPalette, buildPalettePool, pickShufflePalette,
  resampleStops, lum, SOURCE_WEIGHTS,
} from '../src/shuffle-pool.js'
import { TEMPLATES } from '../src/templates.js'
import { mulberry32 } from '../src/noise.js'

const CATALOG = JSON.parse(readFileSync(new URL('../public/templates/data.json', import.meta.url), 'utf8'))

const OK = {
  rampStops: Array.from({ length: 8 }, (_, i) => ({ c: `#${(0x101010 * (i + 2)).toString(16).padStart(6, '0')}`, p: i / 7 })),
  oceanShallow: '#bcd3e6', oceanMid: '#6cb3fe', oceanDeep: '#22406b',
}

// ------------------------------------------------------------- normalisation
test('normalizePalette rend toujours 8 arrêts, même depuis une rampe courte', () => {
  // format hérité à 4 arrêts (gradLow/Mid1/Mid2/High) → 8 arrêts interpolés
  const short = [{ c: '#000000', p: 0 }, { c: '#404040', p: 0.35 }, { c: '#a0a0a0', p: 0.7 }, { c: '#ffffff', p: 1 }]
  const p = normalizePalette({ ...OK, rampStops: short }, 'shop', 'Test')
  assert.equal(p.rampStops.length, 8)
  assert.equal(p.rampStops[0].c, '#000000')
  assert.equal(p.rampStops[7].c, '#ffffff')
  // interpolé, pas répété (ce que resampleStops corrige — applyPalette, lui,
  // répéterait le dernier arrêt 5 fois)
  assert.equal(new Set(p.rampStops.map((s) => s.c)).size, 8)
  // moins de 4 arrêts : la source n'est pas exploitable comme rampe hypsométrique
  assert.equal(normalizePalette({ ...OK, rampStops: short.slice(0, 2) }), null)
})

test('normalizePalette rejette ce qui est inexploitable', () => {
  assert.equal(normalizePalette(null), null)
  assert.equal(normalizePalette({}), null)
  assert.equal(normalizePalette({ rampStops: [{ c: '#fff', p: 0 }] }), null) // hex court + trop peu
  assert.equal(normalizePalette({ ...OK, oceanMid: 'bleu' }), null) // mers invalides
})

test('normalizePalette dérive une encre quand la source n’en a pas', () => {
  const p = normalizePalette(OK, 'shop', 'Test')
  assert.match(p.ink, /^#[0-9a-f]{6}$/)
  assert.ok(lum(p.ink) < 0.35, `encre trop claire : ${p.ink}`)
  // une encre fournie est respectée telle quelle
  assert.equal(normalizePalette({ ...OK, ink: '#0C0B7A' }).ink, '#0c0b7a')
})

test('resampleStops garde l’ordre et les bornes', () => {
  const r = resampleStops([{ c: '#ff0000', p: 1 }, { c: '#0000ff', p: 0 }], 8)
  assert.equal(r.length, 8)
  assert.equal(r[0].c, '#0000ff')
  assert.equal(r[7].c, '#ff0000')
  assert.deepEqual(r.map((s) => s.p), [0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.86, 1])
})

// ------------------------------------------------------------------ élégance
test('isElegantPalette refuse l’aplat et la mer qui s’éclaircit en profondeur', () => {
  assert.ok(isElegantPalette(normalizePalette(OK)))
  const flat = normalizePalette({ ...OK, rampStops: Array.from({ length: 8 }, (_, i) => ({ c: '#f0f0f0', p: i / 7 })) })
  assert.equal(isElegantPalette(flat), false, 'une rampe uniforme est un aplat')
  const badSea = normalizePalette({ ...OK, oceanShallow: '#22406b', oceanDeep: '#bcd3e6' })
  assert.equal(isElegantPalette(badSea), false, 'la mer doit s’assombrir avec la profondeur')
})

// -------------------------------------------------------------- vraie réserve
test('le catalogue boutique livré passe le filtre en entier', () => {
  const pool = buildPalettePool({ shop: CATALOG.palettes })
  assert.ok(CATALOG.palettes.length >= 100, `catalogue maigre : ${CATALOG.palettes.length}`)
  assert.equal(pool.length, CATALOG.palettes.length, 'des palettes de la boutique sont recalées')
  assert.ok(pool.every((p) => p.kind === 'shop' && p.rampStops.length === 8))
})

test('les 4 looks intégrés entrent aussi dans la réserve', () => {
  const pool = buildPalettePool({ builtins: Object.values(TEMPLATES) })
  assert.equal(pool.length, Object.keys(TEMPLATES).length)
  assert.ok(pool.some((p) => p.name === 'ICELAND'))
})

test('la réserve dédoublonne : réinstaller une palette déjà là n’ajoute rien', () => {
  const shop = CATALOG.palettes.slice(0, 5)
  const asUser = shop.map((e) => ({ ...e, id: `shop_${e.slug}` }))
  assert.equal(buildPalettePool({ shop, userPalettes: asUser }).length, 5)
})

test('la réserve mêle bien TOUTES les sources', () => {
  const pool = buildPalettePool({
    shop: CATALOG.palettes,
    userPalettes: [{ ...OK, name: 'MA PALETTE' }],
    userTemplates: [{ name: 'MON LOOK', look: { ...OK, rampStops: OK.rampStops.map((s, i) => ({ ...s, c: i ? s.c : '#123456' })) } }],
    builtins: Object.values(TEMPLATES),
  })
  const kinds = new Set(pool.map((p) => p.kind))
  assert.deepEqual([...kinds].sort(), ['shop', 'template', 'user'])
  assert.ok(pool.length > CATALOG.palettes.length)
})

// ------------------------------------------------------------------- tirage
test('pickShufflePalette rend TOUJOURS une palette élégante, même réserve vide', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const p = pickShufflePalette(mulberry32(seed), [])
    assert.ok(p, `graine ${seed} : rien tiré`)
    assert.ok(isElegantPalette(p), `graine ${seed} : palette non élégante (${p.name})`)
  }
})

test('avec la vraie réserve, 200 tirages restent élégants et variés', () => {
  const pool = buildPalettePool({ shop: CATALOG.palettes, builtins: Object.values(TEMPLATES) })
  const names = new Set()
  const kinds = new Set()
  for (let seed = 1; seed <= 200; seed++) {
    const p = pickShufflePalette(mulberry32(seed), pool)
    assert.ok(isElegantPalette(p), `graine ${seed} : ${p.name}`)
    names.add(p.name)
    kinds.add(p.kind)
  }
  // le reproche d'Adrien : 4 looks en boucle. On doit en voir des dizaines.
  assert.ok(names.size > 60, `variété insuffisante : ${names.size} palettes distinctes`)
  // et les sources procédurales ne doivent pas disparaître derrière la boutique
  assert.ok(kinds.has('shop') && kinds.has('earth') && kinds.has('theory'), [...kinds].join(','))
})

test('les poids de source sont tous renseignés et positifs', () => {
  for (const [k, w] of Object.entries(SOURCE_WEIGHTS)) assert.ok(w > 0, `poids ${k}`)
  assert.deepEqual(Object.keys(SOURCE_WEIGHTS).sort(), ['earth', 'shop', 'template', 'theory', 'user'])
})
