import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBgStops, flipStops, stopsToCss,
  normalizeBgPoints, pointsBase, pointsToCss,
  deriveBgModel, BG_MODES, MAX_STOPS, MAX_POINTS,
  bgLuminance, autoDarkTarget, derivePlinthColor, deriveMetalTints,
} from '../src/background.js'

test('deriveMetalTints : reflet clair très lumineux, reflet coloré qui garde la teinte', () => {
  const m = deriveMetalTints({ rampStops: [{ c: '#224422' }, { c: '#3a7a3a' }, { c: '#eeeecc' }] })
  const l = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return (Math.max(...v) + Math.min(...v)) / 510
  }
  assert.ok(l(m.bright) > 0.85, `bright clair attendu, ${m.bright}`)
  assert.ok(l(m.tint) > 0.35 && l(m.tint) < 0.75, `tint médian attendu, ${m.tint}`)
  // la teinte verte du milieu de gamme survit dans le reflet coloré
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(m.tint.slice(i, i + 2), 16))
  assert.ok(g > r && g > b, `teinte verte attendue, ${m.tint}`)
})

// ------------------------------------------------------------------- stops
test('normalizeBgStops falls back to legacy A/B/C when bgStops is absent', () => {
  const st = normalizeBgStops({ bgColorA: '#ffffff', bgColorB: '#888888', bgColorC: '#000000' })
  assert.deepEqual(st, [{ p: 0, c: '#ffffff' }, { p: 50, c: '#888888' }, { p: 100, c: '#000000' }])
})

test('normalizeBgStops sanitizes untrusted input (clamp, drop, cap, sort)', () => {
  const st = normalizeBgStops({ bgStops: [
    { p: 120, c: '#ff0000' }, // clamped to 100
    { p: -5, c: '#00ff00' }, // clamped to 0
    { p: 50, c: 'javascript:alert(1)' }, // dropped: not a hex colour
    { p: 'x', c: '#0000ff' }, // dropped: bad position
    { p: 30, c: '#123456' },
  ] })
  assert.deepEqual(st.map((s) => s.p), [0, 30, 100]) // sorted, bad ones gone
  assert.ok(st.every((s) => /^#[0-9a-fA-F]{6}$/.test(s.c)))
})

test('normalizeBgStops caps the stop count and never returns fewer than 2', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ p: i * 5, c: '#112233' }))
  assert.equal(normalizeBgStops({ bgStops: many }).length, MAX_STOPS)
  // a single valid stop is not a gradient → legacy fallback kicks in
  assert.equal(normalizeBgStops({ bgStops: [{ p: 40, c: '#112233' }], bgColorA: '#ffffff' }).length >= 2, true)
})

test('flipStops mirrors positions and keeps the set sorted', () => {
  const st = flipStops([{ p: 0, c: '#aaaaaa' }, { p: 30, c: '#bbbbbb' }, { p: 100, c: '#cccccc' }])
  assert.deepEqual(st, [{ p: 0, c: '#cccccc' }, { p: 70, c: '#bbbbbb' }, { p: 100, c: '#aaaaaa' }])
})

test('stopsToCss renders linear (angle-shifted) and radial strings', () => {
  const st = [{ p: 0, c: '#ffffff' }, { p: 100, c: '#000000' }]
  assert.equal(stopsToCss(st, 'linear', 0), 'linear-gradient(90deg, #ffffff 0%, #000000 100%)')
  assert.match(stopsToCss(st, 'radial'), /^radial-gradient\(circle at 50% 42%/)
})

// ------------------------------------------------------------------ points
test('normalizeBgPoints derives the classic 4-blob recipe from stop colours', () => {
  const pts = normalizeBgPoints({ bgColorA: '#ffffff', bgColorB: '#888888', bgColorC: '#000000' })
  assert.equal(pts.length, 4)
  assert.ok(pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && p.r > 0))
  assert.equal(pts[2].c, '#ffffff') // the A-coloured blob of the historic recipe
})

test('normalizeBgPoints sanitizes coordinates, radius, colours and count', () => {
  const pts = normalizeBgPoints({ bgPoints: [
    { x: 2, y: -1, r: 9, c: '#ff0000' }, // clamped into 0..1
    { x: 0.5, y: 0.5, c: '#00ff00' }, // missing r → default 0.5
    { x: 0.1, y: 0.1, r: 0.3, c: 'red' }, // dropped: not hex
    ...Array.from({ length: 12 }, () => ({ x: 0.2, y: 0.2, r: 0.2, c: '#0000ff' })),
  ] })
  assert.equal(pts.length, MAX_POINTS)
  assert.deepEqual({ x: pts[0].x, y: pts[0].y, r: pts[0].r }, { x: 1, y: 0, r: 1 })
  assert.equal(pts[1].r, 0.5)
})

test('pointsBase averages the point colours', () => {
  const base = pointsBase([{ c: '#000000' }, { c: '#ffffff' }].map((p) => ({ x: 0, y: 0, r: 1, ...p })))
  assert.equal(base, '#808080')
})

test('pointsToCss stacks one radial-gradient layer per point', () => {
  const css = pointsToCss([{ x: 0.25, y: 0.75, r: 0.5, c: '#ff0000' }])
  assert.equal(css, 'radial-gradient(circle at 25% 75%, rgba(255,0,0,1), rgba(255,0,0,0) 50%)')
})

// ------------------------------------------------------------------ derive
test('deriveBgModel returns matching a/b/c mirror, 3 stops and 4 points', () => {
  const m = deriveBgModel({ rampStops: [{ c: '#224422' }, { c: '#88aa66' }, { c: '#eeeecc' }], oceanDeep: '#123a5a' })
  assert.equal(m.stops.length, 3)
  assert.equal(m.stops[0].c, m.a)
  assert.equal(m.stops[2].c, m.c)
  assert.equal(m.points.length, 4)
})

// -------------------------------------------------- auto-dark par contraste
test('bgLuminance: solid black ~0, solid white ~1, gradient weighted by span', () => {
  assert.ok(bgLuminance({ bgMode: 'solid', bgColorA: '#000000' }) < 0.01)
  assert.ok(bgLuminance({ bgMode: 'solid', bgColorA: '#ffffff' }) > 0.99)
  // 90 % du dégradé est noir (0..90), 10 % monte vers blanc → luminance basse
  const dark = bgLuminance({ bgMode: 'linear', bgStops: [
    { p: 0, c: '#000000' }, { p: 90, c: '#000000' }, { p: 100, c: '#ffffff' },
  ] })
  assert.ok(dark < 0.15, `attendu sombre, obtenu ${dark}`)
})

test('bgLuminance mesh uses the blended base of the points', () => {
  const lum = bgLuminance({ bgMode: 'mesh', bgPoints: [
    { x: 0.2, y: 0.2, r: 0.5, c: '#000000' },
    { x: 0.8, y: 0.8, r: 0.5, c: '#ffffff' },
  ] })
  assert.ok(lum > 0.1 && lum < 0.5) // gris moyen (moyenne sRGB #808080)
})

test('autoDarkTarget has a dead zone (hysteresis) between 0.32 and 0.45', () => {
  assert.equal(autoDarkTarget(0.1), true)
  assert.equal(autoDarkTarget(0.7), false)
  assert.equal(autoDarkTarget(0.38), null)
  assert.equal(autoDarkTarget(null), null)
})

test('derivePlinthColor follows the background luminance, never the matter', () => {
  const darkP = derivePlinthColor({ b: '#345678' }, 0.05)
  const lightP = derivePlinthColor({ b: '#345678' }, 0.9)
  const l = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return (Math.max(...v) + Math.min(...v)) / 510
  }
  assert.ok(l(darkP) < 0.35, `socle sombre attendu, ${darkP}`)
  assert.ok(l(lightP) > 0.6, `socle clair attendu, ${lightP}`)
})

test('BG_MODES are the four French labels', () => {
  assert.deepEqual(BG_MODES.map((m) => m.value), ['solid', 'linear', 'radial', 'mesh'])
  assert.ok(BG_MODES.every((m) => /^(Uni|Dégradé)/.test(m.label)))
})
