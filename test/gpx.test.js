import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Node has no DOMParser — a minimal GPX-shaped shim lets parseGpx's real
// logic run (selection order, decimation, NaN filtering, ele/name fallbacks).
class FakeNode {
  constructor(attrs, ele) {
    this._attrs = attrs
    this._ele = ele
  }
  getAttribute(k) {
    return this._attrs[k] ?? null
  }
  querySelector(sel) {
    return sel === 'ele' && this._ele != null ? { textContent: this._ele } : null
  }
}

class FakeDoc {
  constructor(text) {
    this.text = text
    this.invalid = !/^\s*<\??\s*[a-zA-Z?]/.test(text)
  }
  querySelectorAll(tag) {
    const out = []
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>|<${tag}\\b([^>]*)/>`, 'g')
    let m
    while ((m = re.exec(this.text))) {
      const attrStr = m[1] ?? m[3] ?? ''
      const inner = m[2] ?? ''
      const attrs = {}
      for (const a of attrStr.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
      const ele = inner.match(/<ele>([^<]*)<\/ele>/)?.[1] ?? null
      out.push(new FakeNode(attrs, ele))
    }
    return out
  }
  querySelector(sel) {
    if (sel === 'parsererror') return this.invalid ? {} : null
    if (sel.includes('name')) {
      const m = this.text.match(/<name>([^<]*)<\/name>/)
      return m ? { textContent: m[1] } : null
    }
    return null
  }
}

let parseGpx
let frameTrack
let revealVertexIndex
let stepHeadFollow
let pickKmInterval
let pickVillagesAlongTrack
let villageLeadKm
let villageOpacity
let detectLoop
let HM_APEX_V
let HEAD_MARKER_GROUND_GAP
let slopeRampColor
let THREE
before(async () => {
  globalThis.DOMParser = class {
    parseFromString(text) {
      return new FakeDoc(text)
    }
  }
  THREE = await import('three')
  ;({
    parseGpx,
    frameTrack,
    revealVertexIndex,
    stepHeadFollow,
    pickKmInterval,
    pickVillagesAlongTrack,
    villageLeadKm,
    villageOpacity,
    detectLoop,
    HM_APEX_V,
    HEAD_MARKER_GROUND_GAP,
    slopeRampColor,
  } = await import('../src/gpx.js'))
})

const wrap = (inner) => `<?xml version="1.0"?><gpx><trk><name>Test Trk</name><trkseg>${inner}</trkseg></trk></gpx>`
const pt = (lat, lon, ele) => `<trkpt lat="${lat}" lon="${lon}">${ele != null ? `<ele>${ele}</ele>` : ''}</trkpt>`

test('parses the committed fixture', async () => {
  const text = await readFile(new URL('./fixtures-montenvers.gpx', import.meta.url), 'utf8')
  const { points, name } = parseGpx(text)
  assert.equal(name, 'Montenvers Climb')
  assert.equal(points.length, 80)
  assert.ok(points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.ele)))
  assert.ok(points[0].ele < points[points.length - 1].ele, 'climbs')
})

test('decimates long tracks to the budget', () => {
  const pts = Array.from({ length: 6000 }, (_, i) => pt(45 + i * 1e-5, 6 + i * 1e-5, 1000 + i))
  const { points } = parseGpx(wrap(pts.join('')))
  assert.ok(points.length <= 2400, `${points.length} <= 2400`)
  assert.ok(points.length >= 1800, 'keeps most of the budget')
})

test('missing <ele> yields null (terrain fallback downstream)', () => {
  const { points } = parseGpx(wrap(pt(45, 6) + pt(45.001, 6.001)))
  assert.equal(points[0].ele, null)
})

test('skips malformed points, keeps valid ones', () => {
  const { points } = parseGpx(wrap(pt('abc', 6, 1) + pt(45, 6, 1) + pt(45.001, 6.001, 2)))
  assert.equal(points.length, 2)
})

test('frameTrack centers and fits a normal track', () => {
  const f = frameTrack([
    { lat: 45.92, lon: 6.87 },
    { lat: 45.93, lon: 6.92 },
  ])
  assert.ok(Math.abs(f.lat - 45.925) < 1e-9)
  assert.ok(Math.abs(f.lon - 6.895) < 1e-9)
  assert.ok(f.zoom >= 10 && f.zoom <= 14)
})

test('frameTrack stays local across the antimeridian', () => {
  const f = frameTrack([
    { lat: 52.0, lon: 179.98 },
    { lat: 52.01, lon: -179.97 }, // 0.05° apart, not 359.95°
  ])
  assert.ok(Math.abs(f.lat - 52.005) < 1e-9)
  assert.ok(Math.abs(Math.abs(f.lon) - 179.995) < 1e-9, `center near seam, got ${f.lon}`)
  assert.ok(f.zoom >= 13, `local span keeps high detail, got z${f.zoom}`)
})

test('throws on non-GPX input', () => {
  assert.throws(() => parseGpx('hello, not xml'), /not a valid GPX/)
})

test('throws when under two usable points', () => {
  assert.throws(() => parseGpx(wrap(pt(45, 6, 1))), /no track points|no usable/)
})

// ---- reveal head (task 16 §1: the triangle-vs-reveal-head bug) ------------

test('revealVertexIndex matches the exact vertex _applyReveal() cuts the line to', () => {
  assert.equal(revealVertexIndex(0, 10), 0)
  assert.equal(revealVertexIndex(1, 10), 10)
  assert.equal(revealVertexIndex(0.5, 10), 5)
  // rounds, doesn't floor/ceil — a t just past the midpoint between two
  // vertices should land on the nearer one
  assert.equal(revealVertexIndex(0.049, 10), 0)
  assert.equal(revealVertexIndex(0.051, 10), 1)
})

test('revealVertexIndex is degenerate-safe (no track / zero segments)', () => {
  assert.equal(revealVertexIndex(0.5, 0), 0)
  assert.equal(revealVertexIndex(0.5, null), 0)
})

test('stepHeadFollow snaps (not eases) on the first call — no fly-in from a stale spot', () => {
  const disp = new THREE.Vector3(999, 999, 999)
  const target = new THREE.Vector3(1, 2, 3)
  stepHeadFollow(disp, target, 14, 1 / 60, false)
  assert.ok(disp.distanceTo(target) < 1e-9)
})

test('stepHeadFollow eases toward (not through) a moving target once valid', () => {
  const disp = new THREE.Vector3(0, 0, 0)
  const target = new THREE.Vector3(10, 0, 0)
  stepHeadFollow(disp, target, 14, 1 / 60, true)
  assert.ok(disp.x > 0 && disp.x < target.x, `expected partial catch-up, got ${disp.x}`)
})

// Real Montenvers fixture (genuinely climbs — see the "parses the committed
// fixture" test above) mapped to a synthetic world track: this is exactly
// what gpx.js's rebuild() produces (world[i].y = terrain sample, which for a
// point with a real <ele> closely tracks it) — a track whose y genuinely
// rises, per the task-16 brief's own warning that a flat/synthetic <ele>
// proves nothing about "suit le dénivelé".
test('the reveal-head follow tracks real (rising) terrain elevation, with a small max lag', async () => {
  const { points } = parseGpx(await (await import('node:fs/promises')).readFile(new URL('./fixtures-montenvers.gpx', import.meta.url), 'utf8'))
  const world = points.map((p, i) => new THREE.Vector3(i * 0.15, p.ele / 100 + 0.16, Math.sin(i * 0.35) * 0.3))
  const segCount = world.length - 1

  const duration = 8 // short climb, clamp(90, max(8, totalKm*1.5)) territory
  const dt = 1 / 60
  const disp = new THREE.Vector3()
  let valid = false
  let maxDist = 0
  let headT = 0
  const ys = []
  while (headT < 1) {
    headT = Math.min(1, headT + dt / duration)
    const idx = revealVertexIndex(headT, segCount)
    const target = world[idx]
    stepHeadFollow(disp, target, 14, dt, valid)
    valid = true
    maxDist = Math.max(maxDist, disp.distanceTo(target))
    ys.push(disp.y)
  }
  // "should be ~0": far smaller than the track's own vertical span (~8.8
  // world units here) — proves the marker never drifts meaningfully from
  // the real reveal head, unlike the old separately-smoothed curve.
  assert.ok(maxDist < 1, `max triangle<->reveal-head distance ${maxDist} should stay small`)
  // rides the dénivelé: the displayed y climbs monotonically-ish alongside
  // the real (rising) elevation, never flat/averaged
  assert.ok(ys[ys.length - 1] > ys[0] + 5, `expected the marker to climb with the terrain, got ${ys[0]} -> ${ys[ys.length - 1]}`)
})

// ---- km labels (task 16 §2: dots -> discreet, length-adaptive text) ------

test('pickKmInterval targets ~5 labels, snapped to a human ladder', () => {
  assert.equal(pickKmInterval(5), 1) // a short loop still gets real labels
  assert.equal(pickKmInterval(25), 5)
  assert.equal(pickKmInterval(50), 10)
  assert.equal(pickKmInterval(100), 20)
  assert.equal(pickKmInterval(400), 100)
})

test('pickKmInterval keeps the label count in a sane band across lengths', () => {
  for (const totalKm of [3, 8, 22, 47, 83, 156, 310]) {
    const stride = pickKmInterval(totalKm)
    const count = Math.floor(totalKm / stride)
    assert.ok(count >= 1 && count <= 9, `${totalKm}km @ every ${stride}km -> ${count} labels`)
  }
})

// ---- villages along the route (task 16 §3) -------------------------------

test('pickVillagesAlongTrack keeps only places within radius and above minPop', () => {
  const world = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }]
  const cumKm = [0, 1, 2]
  const rows = [
    ['Big Town', 45, 6, 20000, false, 0], // near world[1] (via toWorld below)
    ['Tiny Hamlet', 45, 6.1, 200, false, 0], // under minPop
    ['Far City', 45, 9, 500000, true, 0], // way outside the radius
  ]
  const toWorld = (lat, lon) => ({ x: (lon - 6) * 100, z: 0 }) // Big Town -> (0,0)ish, Far City -> far +x
  const hits = pickVillagesAlongTrack(rows, { toWorld, world, cumKm, minPop: 5000, radiusWorld: 5 })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].name, 'Big Town')
})

test('pickVillagesAlongTrack dedupes closely-spaced hits, favouring the more prominent one', () => {
  const world = Array.from({ length: 21 }, (_, i) => ({ x: i, z: 0 }))
  const cumKm = world.map((_, i) => i * 0.1) // 0..2km
  const rows = [
    ['Big Village', 45, 6, 9000, false, 0], // -> x=5, km 0.5
    ['Little Hamlet', 45, 6.01, 6000, false, 0], // -> x=6, km 0.6 — within minKmSpacing of Big Village
  ]
  const toWorld = (lat, lon) => ({ x: (lon - 6) * 100 + 5, z: 0 })
  const hits = pickVillagesAlongTrack(rows, { toWorld, world, cumKm, minPop: 5000, radiusWorld: 2, minKmSpacing: 0.3 })
  assert.equal(hits.length, 1, 'the two near-duplicate hits collapse to one')
  assert.equal(hits[0].name, 'Big Village', 'the more prominent (pop-sorted-first) row wins')
})

test('pickVillagesAlongTrack sorts accepted hits by along-track km', () => {
  const world = Array.from({ length: 101 }, (_, i) => ({ x: i, z: 0 }))
  const cumKm = world.map((_, i) => i * 0.1)
  const rows = [
    ['Later Village', 45, 6, 9000, false, 0], // -> x=80
    ['Earlier Village', 45, 6, 9000, false, 0], // -> x=20 (same toWorld call order doesn't matter for the sort)
  ]
  let call = 0
  const toWorld = () => ({ x: call++ === 0 ? 80 : 20, z: 0 })
  const hits = pickVillagesAlongTrack(rows, { toWorld, world, cumKm, minPop: 5000, radiusWorld: 2 })
  assert.equal(hits.length, 2)
  assert.ok(hits[0].km < hits[1].km, 'chronological (along-track) order')
})

test('villageLeadKm scales with track length within its clamped band', () => {
  assert.equal(villageLeadKm(1), 0.1) // clamped to the 100m floor
  assert.equal(villageLeadKm(200), 1.2) // clamped to the 1.2km ceiling
  assert.ok(villageLeadKm(30) > villageLeadKm(10), 'a longer track gets a longer lead')
})

// ---- loop detection (task 22 §6: reused by arch.js for start/finish arches) --

test('detectLoop: a track ending back near its own start is a loop', () => {
  const world = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 10 },
    { x: 0.2, y: 0, z: 0.1 }, // close to start, within 1.5% of the ~30-unit drawn length
  ]
  assert.equal(detectLoop(world), true)
})

test('detectLoop: an out-and-back that ends far from its start is not a loop', () => {
  const world = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 },
  ]
  assert.equal(detectLoop(world), false)
})

test('detectLoop is degenerate-safe (empty / single-point track)', () => {
  assert.equal(detectLoop([]), false)
  assert.equal(detectLoop([{ x: 0, y: 0, z: 0 }]), false)
  assert.equal(detectLoop(null), false)
})

test('villageOpacity ramps in before the hit, peaks at it, fades out after', () => {
  const hitKm = 10
  const lead = 0.5
  const fade = 0.75
  assert.equal(villageOpacity(9, hitKm, lead, fade), 0, 'still silent well before')
  assert.ok(villageOpacity(9.7, hitKm, lead, fade) > 0 && villageOpacity(9.7, hitKm, lead, fade) < 1, 'ramping in')
  assert.ok(Math.abs(villageOpacity(10, hitKm, lead, fade) - 1) < 1e-9, 'full opacity exactly at arrival')
  assert.ok(villageOpacity(10.4, hitKm, lead, fade) > 0 && villageOpacity(10.4, hitKm, lead, fade) < 1, 'fading out after passing')
  assert.equal(villageOpacity(11, hitKm, lead, fade), 0, 'gone well after passing')
})

// ---- composed playback-head marker (task 24 §2) ----------------------------
// "Fais attention à ce que ce pointeur soit vraiment juste au dessus du sol,
// toujours" — the apex-to-ground gap must be a genuine WORLD-SPACE constant,
// never a function of camera distance. This is only true because the sprite
// pivots on its own apex (HM_APEX_V ~ 0) rather than its geometric centre —
// pin both numbers so a future change can't silently reintroduce a
// distance-scaled offset (the exact bug this task fixed).

test('HM_APEX_V pins the sprite pivot to the triangle apex (not the sprite centre)', () => {
  assert.ok(Math.abs(HM_APEX_V) < 1e-6, `expected the pivot at the apex (~0), got ${HM_APEX_V}`)
})

test('HEAD_MARKER_GROUND_GAP is a small, fixed world-unit constant', () => {
  assert.ok(HEAD_MARKER_GROUND_GAP > 0 && HEAD_MARKER_GROUND_GAP < 0.3, `gap ${HEAD_MARKER_GROUND_GAP} is not in a "small and constant" band`)
  // it's a plain number, not a function — nothing here CAN read camera
  // distance, which is the structural guarantee the brief asked for
  assert.equal(typeof HEAD_MARKER_GROUND_GAP, 'number')
})

// ---- six-stop slope ramp (task 27 §1) --------------------------------------
// "Pente faible bleu > vert > jaune > orange > rouge > noir (pente max)" —
// pin the six named stops themselves (hue-only HSL can't reach black, which
// is exactly why this ramp uses explicit RGB stops now) plus monotonic,
// smooth interpolation between them.

test('slope ramp hits blue at 0%, black at/above the domain max', () => {
  const blue = slopeRampColor(0)
  assert.ok(blue.b > blue.r && blue.b > blue.g, `expected blue at 0%, got r${blue.r.toFixed(2)} g${blue.g.toFixed(2)} b${blue.b.toFixed(2)}`)
  const black = slopeRampColor(20)
  assert.ok(black.r < 0.15 && black.g < 0.15 && black.b < 0.15, `expected near-black at the domain max, got r${black.r.toFixed(2)} g${black.g.toFixed(2)} b${black.b.toFixed(2)}`)
  // clamped, not extrapolated — a grade far past the domain max is still black
  const clamped = slopeRampColor(60)
  assert.ok(Math.abs(clamped.r - black.r) < 1e-6 && Math.abs(clamped.g - black.g) < 1e-6 && Math.abs(clamped.b - black.b) < 1e-6, 'clamps past the domain max')
})

test('slope ramp passes through green, yellow, orange, red at their stops', () => {
  const green = slopeRampColor(4)
  assert.ok(green.g > green.r && green.g > green.b, `expected green at 4%, got r${green.r.toFixed(2)} g${green.g.toFixed(2)} b${green.b.toFixed(2)}`)
  const yellow = slopeRampColor(8)
  // THREE.Color's hex constructor converts sRGB -> linear working space
  // (ColorManagement), so the green channel here reads lower than the
  // sRGB hex '#f4d30a' literal would suggest — assert against the actual
  // linear-space values, not the naive sRGB ones
  assert.ok(yellow.r > 0.8 && yellow.g > 0.5 && yellow.b < 0.2, `expected yellow at 8%, got r${yellow.r.toFixed(2)} g${yellow.g.toFixed(2)} b${yellow.b.toFixed(2)}`)
  const orange = slopeRampColor(12)
  assert.ok(orange.r > 0.8 && orange.g > 0.15 && orange.g < 0.7 && orange.b < 0.2, `expected orange at 12%, got r${orange.r.toFixed(2)} g${orange.g.toFixed(2)} b${orange.b.toFixed(2)}`)
  const red = slopeRampColor(16)
  assert.ok(red.r > 0.7 && red.g < 0.35 && red.b < 0.25, `expected red at 16%, got r${red.r.toFixed(2)} g${red.g.toFixed(2)} b${red.b.toFixed(2)}`)
})

test('slope ramp is a symmetric, monotonically smooth function of |grade| (no wraparound jumps)', () => {
  // negative and positive grades of the same magnitude land on the same
  // colour — the ramp reads "how steep", not "up vs down"
  const pos = slopeRampColor(9.4)
  const neg = slopeRampColor(-9.4)
  assert.ok(Math.abs(pos.r - neg.r) < 1e-9 && Math.abs(pos.g - neg.g) < 1e-9 && Math.abs(pos.b - neg.b) < 1e-9, 'symmetric in sign')
  // no channel ever jumps by more than one stop's worth between adjacent
  // percentage points — catches a reintroduced hue wraparound (e.g. a lerp
  // that swings through purple/magenta between blue and green)
  let prev = slopeRampColor(0)
  let maxStep = 0
  for (let g = 0.5; g <= 20; g += 0.5) {
    const c = slopeRampColor(g)
    maxStep = Math.max(maxStep, Math.abs(c.r - prev.r), Math.abs(c.g - prev.g), Math.abs(c.b - prev.b))
    prev = c
  }
  assert.ok(maxStep < 0.3, `largest single 0.5%-grade colour step was ${maxStep.toFixed(2)}, expected smooth interpolation`)
})
