import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paletteRecordFromShop, styleTemplateText, mergeShopPalettes, notOwnedStyles } from '../src/store-catalog.js'
import { parseTemplate } from '../src/templates-user.js'

const SHOP_PALETTE = {
  slug: 'toundra', name: 'Toundra', family: 'terre', price: 4,
  rampStops: [{ c: '#5d6b4e', p: 0 }, { c: '#f2f4f2', p: 1 }],
  oceanShallow: '#c4ddd7', oceanMid: '#6ea6ab', oceanDeep: '#2c5c66',
}
const SHOP_STYLE = {
  slug: 'isolated', name: 'isolated', price: 12,
  strip: ['#fafafa', '#fafaff'],
  look: { rampStops: [{ c: '#fafafa', p: 0 }, { c: '#fafaff', p: 1 }], oceanShallow: '#c8f2e4', oceanMid: '#62cfc1', oceanDeep: '#136e7d', mapTint: 0.8 },
}

test('paletteRecordFromShop shapes a user-palette record', () => {
  const r = paletteRecordFromShop(SHOP_PALETTE)
  assert.equal(r.id, 'shop_toundra')
  assert.equal(r.name, 'Toundra')
  assert.deepEqual(r.rampStops, SHOP_PALETTE.rampStops)
  assert.equal(r.oceanDeep, '#2c5c66')
})

test('styleTemplateText round-trips through parseTemplate', () => {
  const parsed = parseTemplate(styleTemplateText(SHOP_STYLE))
  assert.ok(parsed)
  assert.equal(parsed.name, 'isolated')
  assert.equal(parsed.look.mapTint, 0.8)
  assert.deepEqual(parsed.strip, ['#fafafa', '#fafaff'])
})

test('mergeShopPalettes dedupes by id and is idempotent', () => {
  const rec = paletteRecordFromShop(SHOP_PALETTE)
  const first = mergeShopPalettes([], [rec])
  assert.equal(first.added, 1)
  const second = mergeShopPalettes(first.list, [rec])
  assert.equal(second.added, 0)
  assert.equal(second.list.length, 1)
})

test('notOwnedStyles filters by name', () => {
  const owned = [{ id: 'ut_x', name: 'isolated', look: {} }]
  assert.equal(notOwnedStyles(owned, [SHOP_STYLE]).length, 0)
  assert.equal(notOwnedStyles([], [SHOP_STYLE]).length, 1)
})
