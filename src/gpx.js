// GPX layer: drop a .gpx file anywhere (or use the GUI) — the map recenters
// on the track, drapes it over the relief as a fat accent-colored line, and
// gives it instruments: a hover cursor with real altitude / distance / grade,
// an interactive elevation-profile strip, and a cinematic fly-along that
// reuses the tour flight controller.

import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld, metersPerPixel, surfaceMetersPerUnit, EARTH_RADIUS_M } from './geo.js'
import { loadLayer } from './map/geo-data.js'
import { makeLabelTexture, labelPlate, labelPlateInk, labelFontReady } from './map/text-label.js'
import { computeArchSpecs, buildArchMesh, disposeArchGroup } from './arch.js'

const MAX_POINTS = 2400 // decimation budget — hover & profile stay O(small)

export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('not a valid GPX file')
  let nodes = [...doc.querySelectorAll('trkpt')]
  if (!nodes.length) nodes = [...doc.querySelectorAll('rtept')]
  if (!nodes.length) nodes = [...doc.querySelectorAll('wpt')]
  if (nodes.length < 2) throw new Error('no track points found')

  const stride = Math.max(1, Math.ceil(nodes.length / MAX_POINTS))
  const points = []
  for (let i = 0; i < nodes.length; i += stride) {
    const n = nodes[i]
    const lat = parseFloat(n.getAttribute('lat'))
    const lon = parseFloat(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleN = n.querySelector('ele')
    points.push({ lat, lon, ele: eleN ? parseFloat(eleN.textContent) : null })
  }
  if (points.length < 2) throw new Error('no usable track points')
  const name = doc.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim()
  return { points, name: name || 'TRACK' }
}

// Pick center + zoom so a whole track fits comfortably in the DEM patch.
// Pure — exported for tests.
export function frameTrack(points) {
  // unwrap longitudes relative to the first point so a track crossing the
  // antimeridian stays contiguous instead of spanning the whole planet
  const lon0 = points[0].lon
  let latMin = 90, latMax = -90, lonMin = Infinity, lonMax = -Infinity
  for (const p of points) {
    const pLon = lon0 + (((p.lon - lon0 + 540) % 360) - 180)
    latMin = Math.min(latMin, p.lat)
    latMax = Math.max(latMax, p.lat)
    lonMin = Math.min(lonMin, pLon)
    lonMax = Math.max(lonMax, pLon)
  }
  const lat = (latMin + latMax) / 2
  let lon = (lonMin + lonMax) / 2
  if (lon > 180) lon -= 360
  else if (lon < -180) lon += 360
  const widthM = Math.max(
    (lonMax - lonMin) * 111320 * Math.cos((lat * Math.PI) / 180),
    (latMax - latMin) * 110540,
    800
  )
  let zoom = 14
  while (zoom > 10 && metersPerPixel(lat, zoom) * 768 < widthM * 1.35) zoom--
  return { lat, lon, zoom }
}

// ---------------------------------------------------------------- colour ramps

// dark green -> bright red, used for the elevation ramp (the default gradient
// mode). Hue sweeps green -> amber -> orange -> red (0.33 -> 0.0) so the
// transition reads naturally; saturation and lightness both rise with it too
// — a hue-only sweep at constant tone doesn't land as "foncé" (dark) at the
// low end or "vif" (vivid/bright) at the high end, only a colour-only shift.
function elevationRampColor(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  const hue = THREE.MathUtils.lerp(0.33, 0.0, c)
  const sat = THREE.MathUtils.lerp(0.65, 0.9, c)
  const light = THREE.MathUtils.lerp(0.25, 0.55, c)
  return new THREE.Color().setHSL(hue, sat, light)
}

// six-stop grade ramp: blue (flat) -> green -> yellow -> orange -> red ->
// black (max), per the user's exact spec ("pente faible bleu > vert >
// jaune > orange > rouge > noir"). This REPLACES a 2-segment HSL hue sweep
// (green->amber->red) that was abandoned outright, not just re-tuned: a
// hue-only lerp can never reach black (black has no hue — it's zero
// lightness), and blue->green->yellow->orange->red is not a monotonic hue
// path either (blue sits at hue ~0.6, red wraps back near hue ~0.0/1.0 —
// naively lerping hue between arbitrary stops crosses through purple/magenta
// instead of the intended sequence). So this uses explicit RGB colour stops
// and lerps between the bracketing pair with THREE.Color.lerpColors, which
// interpolates in RGB space and has no wraparound to get wrong.
const SLOPE_STOPS = [
  new THREE.Color('#1e78e0'), // blue   — flat
  new THREE.Color('#2fb350'), // green
  new THREE.Color('#f4d30a'), // yellow
  new THREE.Color('#ff8c1a'), // orange
  new THREE.Color('#e3342f'), // red
  new THREE.Color('#141414'), // black  — max
]
// Grade domain, chosen from the two real fixtures (see the task report for
// the full measured distribution), not guessed:
//  - _staging/test-track.gpx (Jura gravel/road, 222km, D+4000): abs grade
//    p50 2.5%, p90 8.0%, p95 10.2%, p99 15.9%, max 33%.
//  - _staging/europaweg.gpx (Valais alpine trail, 39km, 1316->2350m,
//    D+2880): abs grade p50 10.7%, p90 37.8%, max 104% (GPS-noisy switchback
//    sections, not literal — a hiking trail's point-to-point grade spikes
//    hard on tight hairpins).
// A real road climb like the reference's Côte de Domancy averages 9.4%.
// 0-20%, in even 4-point steps, puts that squarely in the yellow/orange
// middle of the ramp (the brief's own bar: a climb must not pin one end)
// while still giving the Jura fixture a full spread (its p95 lands in
// orange, only its rare >20% kickers reach black) and letting the alpine
// trail legitimately run hot — a route that's genuinely often above 20%
// SHOULD read red/black, that's the point of colouring by what the athlete
// feels instead of by altitude.
const SLOPE_DOMAIN_MAX = 20
// exported so test/gpx.test.js can pin the ramp's actual colours/domain —
// same rationale as HM_APEX_V/HEAD_MARKER_GROUND_GAP above: a pure function,
// no DOM required, worth locking down directly rather than only indirectly
// through _trackColors.
export function slopeRampColor(gradePct) {
  const g = THREE.MathUtils.clamp(Math.abs(gradePct), 0, SLOPE_DOMAIN_MAX)
  const f = (g / SLOPE_DOMAIN_MAX) * (SLOPE_STOPS.length - 1)
  const i = Math.min(Math.floor(f), SLOPE_STOPS.length - 2)
  const out = new THREE.Color()
  return out.lerpColors(SLOPE_STOPS[i], SLOPE_STOPS[i + 1], f - i)
}

// pleasant hue sweep along the track's index (start -> end)
function progressRampColor(t) {
  const hue = (0.58 + THREE.MathUtils.lerp(0, 0.72, THREE.MathUtils.clamp(t, 0, 1))) % 1
  return new THREE.Color().setHSL(hue, 0.72, 0.55)
}

// plain-object 3D distance (not THREE.Vector3.distanceTo) so detectLoop stays
// usable from a unit test with bare {x,y,z} points, no THREE instance needed.
function dist3(a, b) {
  const dx = a.x - b.x
  const dy = (a.y ?? 0) - (b.y ?? 0)
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Is this drawn (world-space) track a loop? Same tolerance rule rebuild() has
// always used (see its own comment, preserved verbatim below) — extracted so
// arch.js (task 22 §6: one arch on a loop, two on a point-to-point route) and
// the GpxLayerManager can both reuse the EXACT same answer rebuild() draws
// from, instead of a second, driftable copy of this math.
//
// Loop detection: compare the first/last track points in WORLD units (not
// lat/lon — this is what's actually drawn) against a tolerance relative to
// the track's own drawn length, not a fixed distance. A fixed meter
// threshold would false-match a tiny out-and-back track or miss an obvious
// loop on a huge one. A closed loop rarely re-samples the exact same GPS fix
// as the start, so this must not be an exact equality check either — 1.5% of
// the total drawn length, floored at 1 world unit (roughly one GPS sample's
// worth of jitter at this scale), is generous enough to catch a real loop's
// closing gap without mistaking two merely-nearby points for the same place.
export function detectLoop(world) {
  if (!world || world.length < 2) return false
  let worldLen = 0
  for (let i = 1; i < world.length; i++) worldLen += dist3(world[i], world[i - 1])
  const loopTol = Math.max(1, worldLen * 0.015)
  return dist3(world[0], world[world.length - 1]) <= loopTol
}

// haversine meters
function distM(a, b) {
  const R = EARTH_RADIUS_M
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// ---------------------------------------------------------------- reveal head

// The SINGLE source of truth for "where is the reveal head" — the exact real
// track vertex the Line2 is currently cut to (see _applyReveal()). Both the
// geometry reveal AND the playback-head marker call this one function so
// they can never compute two different answers again (see the task-16 bug
// report: a separately-smoothed curve for the marker was exactly what made
// the triangle and the drawn line disagree).
export function revealVertexIndex(t, segCount) {
  const n = segCount || 0
  if (n <= 0) return 0
  return THREE.MathUtils.clamp(Math.round(THREE.MathUtils.clamp(t, 0, 1) * n), 0, n)
}

// One step of critically-damped exponential follow of the marker's OWN
// transform toward the true reveal-head vertex (mutates + returns `disp`).
// This is the "smoothing in TIME, not space" fix: the target itself is
// always the exact real vertex above (never a different, smoother curve) —
// any visual softness comes from how the marker's displayed position chases
// that target frame to frame, exactly like DroneCam's own posHalfLife
// critical-damping. `valid` false means "no prior position to ease from"
// (a fresh track / a restarted play()) — snap instead of easing in from a
// stale spot.
export function stepHeadFollow(disp, target, lambda, dt, valid) {
  if (!valid) {
    disp.copy(target)
  } else {
    disp.x = THREE.MathUtils.damp(disp.x, target.x, lambda, dt)
    disp.y = THREE.MathUtils.damp(disp.y, target.y, lambda, dt)
    disp.z = THREE.MathUtils.damp(disp.z, target.z, lambda, dt)
  }
  return disp
}

// lambda for stepHeadFollow — half-life ~1/14 s (THREE.MathUtils.damp's decay
// constant, not a literal half-life, but in that ballpark): fast enough that
// the displayed marker stays within a small fraction of a track-vertex
// spacing of the true head at any normal playback speed (measured — see the
// task-16 report), while still smoothing away the frame-to-frame speed/
// direction judder of uneven GPS vertex spacing.
const HEAD_FOLLOW_LAMBDA = 14

// ---------------------------------------------------------------- km labels

// A track-length-adaptive km-label interval, snapped to a human ladder
// (never "every 7km") — targets a roughly constant LABEL COUNT across track
// lengths instead of a constant spacing, so a 5km loop gets one or two
// discreet labels instead of none, and an 80km epic gets ~5 instead of 8
// crowding the line. See buildRoutePanel/rebuild()'s "km markers" section.
const KM_LADDER = [1, 2, 5, 10, 20, 50, 100]
const TARGET_KM_LABELS = 5
export function pickKmInterval(totalKm) {
  if (!(totalKm > 0)) return KM_LADDER[0]
  const raw = totalKm / TARGET_KM_LABELS
  let best = KM_LADDER[0]
  let bestDiff = Infinity
  for (const step of KM_LADDER) {
    const diff = Math.abs(step - raw)
    if (diff < bestDiff) {
      bestDiff = diff
      best = step
    }
  }
  return best
}

// ---------------------------------------------------------------- villages

// Along-track village "announcements" (task 16 §3): pick real places (rows
// from loadLayer('places'), each [name, lat, lon, pop, capital, minZoom] per
// geo-data.js) that sit within `radiusWorld` of some point on the track and
// have pop > minPop. `toWorld(lat, lon)` is injected (not `dem` directly) so
// this stays pure/testable, mirroring place-pick.js's pickPlaces() — same
// idea, different selection geometry (along-track nearest-point vs viewport
// bbox). Rows arrive prominence-sorted (population descending, per
// pickPlaces' own comment); a greedy minKmSpacing pass (same shape as
// pickPlaces' minDist) keeps two closely-spaced named places from both
// firing almost simultaneously, favouring the more prominent one.
export function pickVillagesAlongTrack(rows, { toWorld, world, cumKm, minPop = 5000, radiusWorld = 5, minKmSpacing = 0.3 } = {}) {
  const candidates = []
  for (const row of rows) {
    const [name, lat, lon, pop] = row
    if (!(pop > minPop)) continue
    const w = toWorld(lat, lon)
    let bestI = -1
    let bestD = Infinity
    for (let i = 0; i < world.length; i++) {
      const dx = world[i].x - w.x
      const dz = world[i].z - w.z
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestD = d
        bestI = i
      }
    }
    if (bestD > radiusWorld * radiusWorld || bestI < 0) continue
    candidates.push({ name, pop, idx: bestI, km: cumKm[bestI], w })
  }
  const hits = []
  for (const c of candidates) {
    if (hits.some((h) => Math.abs(h.km - c.km) < minKmSpacing)) continue
    hits.push(c)
  }
  hits.sort((a, b) => a.km - b.km)
  return hits
}

// Lead distance (km) a village announcement appears BEFORE the head reaches
// it — proportional to track length (a long track covers ground "faster" in
// km per unit of the journey, so it earns a longer heads-up), clamped to a
// sensible 100m..1.2km band so a short local loop still gets a real lead and
// a huge multi-day route doesn't announce absurdly early.
export function villageLeadKm(totalKm) {
  return THREE.MathUtils.clamp(totalKm * 0.02, 0.1, 1.2)
}

// Opacity of a village announcement at the head's current km: ramps 0->1
// over the lead-in (reaching full opacity exactly as the head arrives), then
// eases back out over `fadeKm` after passing — long enough that the name is
// still readable for a beat once the head is abreast of it, not gone the
// instant it arrives.
export function villageOpacity(km, hitKm, leadKm, fadeKm) {
  if (km < hitKm - leadKm) return 0
  if (km < hitKm) return (km - (hitKm - leadKm)) / leadKm
  if (km < hitKm + fadeKm) return 1 - (km - hitKm) / fadeKm
  return 0
}

// Screen-space label size for scale=1, in CLIP units (sizeAttenuation:false) —
// the EXACT same sizing trap as PlacesLayer.BASE_H (see places-layer.js's big
// comment above its own BASE_H): a sprite's real on-screen size is
// projectionMatrix[0/5]*scale, NOT scale/2*viewport — at this app's 30° fov
// that's a ~3.7x factor. Previously this sprite had no sizeAttenuation set at
// all (Three's default `true`), so it was sized in actual WORLD units (6.8
// world units wide) and only shrank with perspective distance — with the
// camera close to the route that's what made "START & FINISH · 25" span ~40%
// of the screen. Tuned so the label reads at the same visual size as a city
// name (places-layer.js labels land ~7.5–14px cap-height, measured live) —
// see the task-13 report for the exact px this produced.
const GPX_LABEL_BASE_H = 0.0128
const GPX_LABEL_ASPECT = 512 / 80

function textSprite(text, color, scale = 1, opacity = 1, renderOrder = 20) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 80
  const ctx = c.getContext('2d')
  ctx.font = '600 44px "SF Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, 256, 44)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity })
  )
  sp.material.sizeAttenuation = false
  sp.scale.set(GPX_LABEL_BASE_H * scale * GPX_LABEL_ASPECT, GPX_LABEL_BASE_H * scale, 1)
  sp.renderOrder = renderOrder
  return sp
}

// ---- composed playback-head marker (task 24 §2) ----------------------------
// "Un pointeur = une badge carrée arrondie portant l'icône du sport, posée
// directement SUR un triangle pointant vers le bas" — ONE sprite, ONE
// texture, baked together in a single canvas, replacing the old two
// INDEPENDENT sprites (a bare triangle + a separately-positioned icon
// billboard) that could only ever be kept aligned by two matching per-frame
// offset formulas agreeing exactly — which is exactly the kind of thing that
// silently drifts apart the moment one of the two offsets is tuned alone.
// Baking them into one texture makes drifting apart structurally impossible.
//
// Layout (canvas px, see the constants below): the triangle is drawn FIRST
// with its apex at the very last pixel row and its base overlapping UP into
// where the badge will be; the rounded-square badge is drawn SECOND on top,
// its bottom edge covering that overlap — the two shapes read as one
// continuous pin silhouette with no visible seam. The sport icon (if any) is
// recoloured to solid white (see recolorToWhite() below — the source-in
// compositing trick preserves the icon's exact alpha mask/anti-aliasing
// while discarding its original ink colour) and drawn centred in the badge.
const HM_W = 100
const HM_H = 98
const HM_BADGE = { x: 8, y: 6, w: 84, h: 84, r: 18 }
const HM_TRI = { apexX: 50, apexY: HM_H, baseY: 74, halfW: 17 } // apex sits on the LAST row on purpose (see the sprite.center note below)

// Recolours a dark-ink icon canvas to solid white, preserving its alpha mask
// exactly (anti-aliased edges included) — "source-in" draws the new fill
// only where the EXISTING (destination) pixels already had alpha, using the
// new fill's own alpha × the destination's, so the icon's silhouette survives
// untouched while its colour is replaced outright. Lets every sport icon
// (rasterized once, dark ink, for the panel row + the map) read against the
// marker's own dark badge without sport-icons.js needing a second colour pass.
function recolorToWhite(srcCanvas) {
  const c = document.createElement('canvas')
  c.width = srcCanvas.width
  c.height = srcCanvas.height
  const ctx = c.getContext('2d')
  ctx.drawImage(srcCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Builds the composed marker texture. `iconCanvas` is the RASTERIZED sport
// icon (see sport-icons.js's rasterizeToCanvas — a small square canvas, dark
// ink on transparent) or null (no icon yet / none assigned — the badge still
// draws, just empty, so the marker's silhouette never flickers in/out as
// icons load). `ink` is the badge/triangle fill colour.
export function composeHeadMarkerTexture(iconCanvas, ink = '#17191b') {
  const c = document.createElement('canvas')
  c.width = HM_W
  c.height = HM_H
  const ctx = c.getContext('2d')
  ctx.fillStyle = ink
  // triangle first — apex down, base overlapping up into the badge's own
  // footprint so the badge (drawn next) hides the seam
  ctx.beginPath()
  ctx.moveTo(HM_TRI.apexX, HM_TRI.apexY)
  ctx.lineTo(HM_TRI.apexX - HM_TRI.halfW, HM_TRI.baseY)
  ctx.lineTo(HM_TRI.apexX + HM_TRI.halfW, HM_TRI.baseY)
  ctx.closePath()
  ctx.fill()
  // badge on top — a rounded square "holding" the icon
  roundedRectPath(ctx, HM_BADGE.x, HM_BADGE.y, HM_BADGE.w, HM_BADGE.h, HM_BADGE.r)
  ctx.fill()
  if (iconCanvas) {
    const white = recolorToWhite(iconCanvas)
    const inset = HM_BADGE.w * 0.16
    ctx.drawImage(white, HM_BADGE.x + inset, HM_BADGE.y + inset, HM_BADGE.w - inset * 2, HM_BADGE.h - inset * 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
const HM_ASPECT = HM_W / HM_H
const HEAD_MARKER_INK = '#17191b' // same dark ink as the arch's default (light-mode) fill

// same sizeAttenuation:false / BASE_H sizing convention as GPX_LABEL_BASE_H
// above (this app's #1 recurring sizing trap: real on-screen size =
// projectionMatrix[5]*scale, ~3.7x the naive scale/2*viewport formula at
// this app's 30° fov) — KEPT even though the marker itself was rebuilt (task
// 24 §2), per the brief's own instruction. Tuned so the badge portion (which
// dominates the composed shape, ~86% of its own height) reads at roughly the
// old standalone icon's size (0.011) — see the task-24 report for the
// measured live px.
// How far the drawn track floats above the terrain it's draped on, in WORLD
// units. This used to be 0.16 and it read as a visible hover — the track
// hanging in the air over ridgelines instead of lying on them.
//
// The trap: a world unit is NOT a fixed real-world distance. The block is
// always TERRAIN_SIZE (56) units wide whatever it REPRESENTS, so the same
// 0.16 measured, live on a real track:
//     demZoom 13 (13 km patch) ->  37 m of float
//     demZoom 11 (19 km patch) ->  54 m   <- what the user photographed
//     demZoom 10 (91 km patch) -> 260 m
//     demZoom  8 (360 km patch) -> 1029 m
// A constant lift cannot be right at every scale, so it shouldn't be doing
// this job at all. The lift existed only to stop the line z-fighting the
// terrain surface; polygonOffset on the line materials (see LineMaterial
// below, and the water layer, which already solved this properly) does that
// in depth-buffer space instead — screen-constant, scale-independent, and it
// leaves the geometry ON the ground. What remains here is a hair of physical
// clearance for the head marker and hover cursor to sit against.
const DRAPE_LIFT = 0.012
const HEAD_MARKER_BASE_H = 0.013
// The sprite's PIVOT (THREE.Sprite.center, not just its texture) is set to
// the triangle's apex — see the constructor below — rather than the default
// centre. This is what makes the ground-clearance gap a genuine WORLD-SPACE
// constant instead of a fraction of the sprite's own (distance-dependent,
// sizeAttenuation:false) on-screen footprint: with a centred pivot, "how far
// below centre is the apex" would itself grow with camera distance (the
// footprint grows to hold its screen size constant), so ANY fixed fraction
// of it would silently balloon at range — exactly the bug the brief flags.
// Anchoring at the apex sidesteps the whole problem: `sprite.position` IS
// the apex, so a fixed world-unit gap really stays fixed. See
// HEAD_MARKER_GROUND_GAP below.
// exported (alongside HEAD_MARKER_GROUND_GAP) purely so test/gpx.test.js can
// pin these two numbers without a DOM — the rest of composeHeadMarkerTexture
// needs document.createElement('canvas') and stays DOM-only, same pattern as
// every other rasterizer in this codebase (see sport-icons.js's own comment).
export const HM_APEX_V = (HM_H - HM_TRI.apexY) / HM_H // ~0 — apex sits on the last row by construction
// Small, CONSTANT world-space clearance between the apex and
// terrain.sample() at the head — "vraiment juste au dessus du sol,
// toujours", measured (not scaled by camera distance, see the pivot note
// above) across a playback run in the task-24 report.
export const HEAD_MARKER_GROUND_GAP = 0.05

// village announcements (task 16 §3) — "plus de 5k habitants" per the brief,
// verbatim.
const VILLAGE_MIN_POP = 5000
// "à côté de la route" — 600m gives a real named place near the road some
// slack for the GeoNames point not sitting exactly on the road centreline,
// while still excluding a village merely visible in the distance across a
// valley (a few km away) that the rider never actually passes.
const VILLAGE_RADIUS_M = 600
const VILLAGE_LINE_HEIGHT = 2.4 // world units — a real vertical mark, not a leader tick
const VILLAGE_LABEL_GAP = 0.35 // above the line's top
// same BASE_H sizing convention as places-layer.js's own BASE_H (task 27 §2
// bumped it 0.007 -> 0.010, see its big comment for the measured px) — these
// ARE place names, of the same visual class, just triggered along-track
// instead of by viewport picking, so they should read at the same size. If
// anything these are the MORE important case for "je veux voir les
// informations des villes et villages qu'on traverse" — an announced
// village IS a village the route passes through, verbatim.
const VILLAGE_LABEL_BASE_H = 0.01

export class GpxLayer {
  // getGrid (optionnel) : le damier de blocs voisins (block-grid.js) — permet
  // de draper la trace sur les blocs adjacents quand elle déborde du central
  constructor({ scene, camera, terrain, params, getDem, getGrid }) {
    this.getGrid = getGrid
    this.scene = scene
    this.camera = camera
    this.terrain = terrain
    this.params = params
    this.getDem = getDem
    this.track = null // { points, name, cumKm[], world[] }
    this.group = new THREE.Group()
    this.group.name = 'gpx'
    scene.add(this.group)
    this.line = null
    this.lineMat = null
    this.glowLine = null
    this.glowMat = null
    this.hoverIdx = -1

    // progressive-reveal playback: headT is the play position (0..1, by
    // segment index) — _revealT is what's currently drawn (persists across
    // rebuild() so a mid-playback terrain rebuild doesn't snap the line back)
    this.playing = false
    this.headT = 0
    this._revealT = 1
    this.raceTicks = null // Race Studio : [{km}] — traits verticaux sur le profil
    this._segCount = 0
    this._dispAlt = null
    this._dispSlope = null

    // hover cursor: accent sphere pinned to the nearest track point (mouse
    // hover only — see setHover()'s isPlaybackHead branch)
    this.cursor = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 14),
      new THREE.MeshBasicMaterial({ color: params.hudAccent, depthTest: false })
    )
    this.cursor.renderOrder = 21
    this.cursor.visible = false
    this.group.add(this.cursor)

    // playback-head marker (task 24 §2): ONE composed sprite — a rounded
    // badge (holding the sport icon) sitting directly on a downward-pointing
    // triangle, baked into a single texture so the two parts can never drift
    // apart (see composeHeadMarkerTexture() above). Billboarded +
    // screen-space sized as usual (sizeAttenuation:false, HEAD_MARKER_BASE_H).
    // `center` is set to the triangle's APEX (not the sprite's geometric
    // centre) — see HM_APEX_V's comment — so `this.headMarker.position` IS
    // the apex, letting _updateHead() add a small, genuinely constant
    // world-space gap instead of one that scales with camera distance.
    // Positioned each frame in _updateHead() at the EXACT reveal-head vertex
    // (see revealVertexIndex()) — the same point _applyReveal() cuts the
    // real Line2 to, never a separately-smoothed curve (see the task-16 bug
    // report). _headDisp/_headDispValid are the critically-damped follow
    // state that keeps its motion from stuttering (smoothing in TIME, not
    // space — see stepHeadFollow()). No icon yet (setIcon() rebuilds the
    // texture once the sport/custom icon resolves) so the badge starts empty
    // rather than costing an extra sprite.
    this.headMarker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: composeHeadMarkerTexture(null, HEAD_MARKER_INK), depthTest: false, transparent: true })
    )
    this.headMarker.material.sizeAttenuation = false
    this.headMarker.center.set(0.5, HM_APEX_V)
    this.headMarker.scale.set(HEAD_MARKER_BASE_H * HM_ASPECT, HEAD_MARKER_BASE_H, 1)
    this.headMarker.renderOrder = 23
    this.headMarker.visible = false
    this.group.add(this.headMarker)
    this._headDisp = new THREE.Vector3()
    this._headDispValid = false
    this._headIconCanvas = null // the RAW icon canvas last passed to setIcon() — kept so a future ink/theme change could rebuild without a caller round-trip

    // multi-layer stacking (task 22 §2, "comme dans Figma") — an additive
    // renderOrder offset + a tiny world-Y nudge, set via setRenderDepth()
    // from GpxLayerManager.reorder(). Both default to zero, so a bare
    // `new GpxLayer(...)` (every pre-existing single-track call site) keeps
    // the EXACT renderOrder/height values it always had.
    this._renderOffset = 0
    this._depthOffsetY = 0

    // start/finish 3D arches (task 22 §6) — built in rebuild(), disposed in
    // _disposeArches(); see that method + arch.js for the placement math.
    this._archGroups = []

    // along-track village announcements (task 16 §3) — precomputed once per
    // rebuild() (see _buildVillages()), then just a cheap opacity lookup per
    // frame in _updateVillages(). _villageBuildId guards the async
    // loadLayer('places') fetch against a rebuild() that starts a newer one
    // before the previous fetch resolves.
    this._villageHits = []
    this._villageMarkers = []
    this._villageLeadKm = 0
    this._villageFadeKm = 0
    this._villageBuildId = 0

    this._buildDom()
    this._ray = new THREE.Raycaster()
    this._mouseWorld = new THREE.Vector2()
  }

  // ---------------------------------------------------------------- DOM

  _buildDom() {
    const tip = document.createElement('div')
    tip.className = 'gpx-tip hidden'
    document.body.appendChild(tip)
    this.tipEl = tip

    const wrap = document.createElement('div')
    // même grammaire visuelle que les panneaux (Explore…) : carte en verre
    wrap.className = 'gpx-profile ce-glassbox hidden'
    // race-name header (task 22 §7): "ce nom apparaitra au dessus du profil
    // de la course en bas" — a dedicated line ABOVE the existing (small,
    // monospace) track-name bar, editorial/Rosarivo styling (see style.css),
    // hidden by default (an unset race name shouldn't show an empty bar).
    wrap.innerHTML =
      '<div class="gpx-race-name hidden"></div><div class="gpx-profile-head"><span class="gpx-name">TRACK</span><span class="gpx-stats"></span><button class="gpx-collapse" aria-label="Replier le profil"></button><button class="gpx-close" aria-label="Fermer le parcours">✕</button></div><canvas width="720" height="96"></canvas>'
    document.body.appendChild(wrap)
    this.profileEl = wrap
    this.raceNameEl = wrap.querySelector('.gpx-race-name')
    this.profileCanvas = wrap.querySelector('canvas')
    // ✕ ferme le PARCOURS entier (trace 3D comprise) — navigation libre ensuite
    wrap.querySelector('.gpx-close').addEventListener('click', () => this.clear())
    // chevron : replie le profil sur sa seule ligne d'entête (comme les panneaux)
    wrap.querySelector('.gpx-collapse').addEventListener('click', () => wrap.classList.toggle('collapsed'))

    this.profileCanvas.addEventListener('pointermove', (e) => {
      if (!this.track) return
      const r = this.profileCanvas.getBoundingClientRect()
      const f = (e.clientX - r.left) / r.width
      const km = f * this.track.cumKm[this.track.cumKm.length - 1]
      let i = this.track.cumKm.findIndex((v) => v >= km)
      if (i < 0) i = this.track.cumKm.length - 1
      this.setHover(i, false)
    })
    this.profileCanvas.addEventListener('pointerleave', () => this.setHover(-1, false))

    // playback head label: altitude + slope readouts, tweened, floating near
    // the moving head (position:fixed DOM, same idea as gpx-tip)
    const head = document.createElement('div')
    head.className = 'gpx-head-label hidden'
    head.innerHTML = '<div class="gpx-head-alt hidden"></div><div class="gpx-head-slope hidden"></div>'
    document.body.appendChild(head)
    this.headLabel = head
    this._headAltEl = head.querySelector('.gpx-head-alt')
    this._headSlopeEl = head.querySelector('.gpx-head-slope')
  }

  // ---------------------------------------------------------------- data

  // Pick center + zoom so the whole track fits comfortably in the patch.
  frame(points) {
    return frameTrack(points)
  }

  setTrack(points, name) {
    const cumKm = [0]
    for (let i = 1; i < points.length; i++) cumKm.push(cumKm[i - 1] + distM(points[i - 1], points[i]) / 1000)
    // pointNames: optional index -> custom label map, set via setPointName();
    // a fresh track always starts with no custom names
    this.track = { points, name, cumKm, world: null, pointNames: {} }
    // race-name default = the GPX's own <name> (task 22 §7 spec: "nommer sa
    // course" — an organiser who never touches the field still sees a name,
    // not blank chrome); setRaceName() is the same call the panel's editable
    // field makes later, so overriding it just re-runs this one path.
    this.setRaceName(name)
  }

  // (Re)drape the loaded track onto the current terrain patch — called after
  // every terrain rebuild so the line always matches the relief under it.
  rebuild() {
    this._disposeLine()
    const dem = this.getDem()
    if (!this.track || !dem) return

    const pts = []
    const world = []
    const grid = this.getGrid?.()
    for (const p of this.track.points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const inside = Math.abs(w.x) < TERRAIN_SIZE / 2 && Math.abs(w.z) < TERRAIN_SIZE / 2
      // _depthOffsetY (task 22 §2): a small per-layer lift so two stacked
      // layers whose tracks coincide (e.g. the same GPX loaded twice) don't
      // z-fight — see GpxLayerManager.reorder()/setRenderDepth().
      // hors du bloc central : draper sur le bloc VOISIN du damier s'il est
      // chargé (block-grid.js) ; sinon l'ancien fallback à plat
      let y
      if (inside) y = this.terrain.sample(w.x, w.z) + DRAPE_LIFT
      else {
        const h = grid?.heightAt(w.x, w.z)
        y = (h != null ? h : 0) + DRAPE_LIFT
      }
      y += this._depthOffsetY
      world.push(new THREE.Vector3(w.x, y, w.z))
      pts.push(w.x, y, w.z)
    }
    this.track.world = world
    this._segCount = Math.max(0, world.length - 1)

    const lineColor = this.params.gpxColor || this.params.hudAccent
    const width = this.params.gpxWidth ?? 3

    const eles = this._elevations()
    const gradientOn = !!this.params.gpxGradient
    const vertexColors = gradientOn ? this._trackColors(eles) : null
    const ro = this._renderOffset

    const geo = new LineGeometry()
    geo.setPositions(pts)
    if (vertexColors) geo.setColors(vertexColors)
    this.lineMat = new LineMaterial({
      // vertex colours are multiplied by the base colour in LineMaterial's
      // shader — go white so the ramp shows true when it's driving the line
      color: new THREE.Color(gradientOn ? '#ffffff' : lineColor),
      linewidth: width,
      alphaToCoverage: false,
      vertexColors: gradientOn,
      // Depth bias instead of lifting the geometry — see DRAPE_LIFT. Line2
      // draws fat lines as instanced TRIANGLES, so polygonOffset applies to
      // them exactly as it does to the water layer's filled rings, and it
      // biases in DEPTH-BUFFER space: constant on screen, and it never moves
      // the track off the ground it's supposed to be lying on.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    this.lineMat.resolution.set(window.innerWidth, window.innerHeight)
    this.line = new Line2(geo, this.lineMat)
    this.line.computeLineDistances()
    this.line.renderOrder = 6 + ro
    this.group.add(this.line)

    // glow: a second, wider, additive, low-opacity halo behind the main line
    if (this.params.gpxGlow) {
      const glowGeo = new LineGeometry()
      glowGeo.setPositions(pts)
      if (vertexColors) glowGeo.setColors(vertexColors)
      this.glowMat = new LineMaterial({
        color: new THREE.Color(gradientOn ? '#ffffff' : lineColor),
        linewidth: width * 2.4,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: gradientOn,
        alphaToCoverage: false,
      })
      this.glowMat.resolution.set(window.innerWidth, window.innerHeight)
      this.glowLine = new Line2(glowGeo, this.glowMat)
      this.glowLine.computeLineDistances()
      this.glowLine.renderOrder = 4 + ro
      this.group.add(this.glowLine)
    }

    const names = this.track.pointNames || {}
    const mk = (label, v, scale = 1, opacity = 1) => {
      const s = textSprite(label, this.params.hudAccent, scale, opacity, 20 + ro)
      s.position.copy(v).add(new THREE.Vector3(0, scale > 0.8 ? 1.25 : 0.85, 0))
      this.group.add(s)
      return s
    }

    // start / finish — ONE toggle governs both (gpxMarkers): a route has a
    // start and an end, showing only one rarely makes sense, so this is a
    // single on/off rather than two independent switches. A 3D arch (task 22
    // §6, see _buildArches()) now REPLACES the old flat ◆/▶/■ text sprites —
    // showing both would be redundant (the brief: "don't show both") — so
    // those sprites are built ONLY as the arch's fallback when the arch
    // itself can't be placed (a degenerate 1-point track with no direction
    // to orient a gate against).
    const lastIdx = eles.length - 1
    const isLoop = detectLoop(world)
    this._disposeArches()
    const archesBuilt = this.params.gpxMarkers ? this._buildArches(world, isLoop, names, eles) : false

    if (archesBuilt) {
      this.startSprite = null
      this.endSprite = null
    } else if (isLoop && this.params.gpxMarkers) {
      // same place — one combined sprite, no separate end marker at all
      let label
      if (names[0] && names[lastIdx]) label = `◆ ${names[0]} & ${names[lastIdx]}`
      else if (names[0]) label = `◆ ${names[0]}`
      else if (names[lastIdx]) label = `◆ ${names[lastIdx]}`
      else label = `◆ START & FINISH · ${Math.round(eles[0])} M`
      this.startSprite = mk(label, world[0])
      this.endSprite = null
    } else {
      this.startSprite = this.params.gpxMarkers
        ? mk(names[0] ? `▶ ${names[0]}` : `▶ START · ${Math.round(eles[0])} M`, world[0])
        : null
      this.endSprite = this.params.gpxMarkers
        ? mk(names[lastIdx] ? `■ ${names[lastIdx]}` : `■ FINISH · ${Math.round(eles[lastIdx])} M`, world[world.length - 1])
        : null
    }

    // altitude waypoints along the way — one every ~2 km, six at most, plus
    // any custom-named point so a name set via the panel is always visible
    this.waypoints = []
    const wpKm = this.track.cumKm[this.track.cumKm.length - 1]
    const nWp = Math.min(6, Math.max(2, Math.round(wpKm / 2)))
    const wpIndices = new Set()
    for (let k = 1; k <= nWp; k++) {
      const target = (k / (nWp + 1)) * wpKm
      let i = this.track.cumKm.findIndex((v) => v >= target)
      if (i < 0) i = this.track.cumKm.length - 1
      wpIndices.add(i)
    }
    for (const idxStr of Object.keys(names)) {
      const i = parseInt(idxStr, 10)
      if (Number.isFinite(i) && i > 0 && i < lastIdx) wpIndices.add(i)
    }
    for (const i of wpIndices) {
      const label = names[i] ? `◆ ${names[i]}` : `◆ ${Math.round(eles[i])} M`
      this.waypoints.push(mk(label, world[i], 0.62, 0.85))
    }

    // km markers — a small, quiet "N KM" text every so often (no dots — see
    // the task-16 brief: the old marker dots read as "moche"/ugly). The
    // interval adapts to the track's own length via pickKmInterval() so a
    // 5km loop and an 80km epic both land around ~5 discreet labels instead
    // of one fixed spacing crowding or starving either end. Scale/opacity
    // are deliberately smaller & quieter than the waypoint diamonds above —
    // secondary to the track, not competing with it.
    this.kmMarkers = []
    if (this.params.gpxKm) {
      const totKm = this.track.cumKm[this.track.cumKm.length - 1]
      const totKmWhole = Math.floor(totKm)
      if (totKmWhole >= 1) {
        const stride = pickKmInterval(totKm)
        for (let km = stride; km <= totKmWhole; km += stride) {
          let i = this.track.cumKm.findIndex((v) => v >= km)
          if (i < 0) i = this.track.cumKm.length - 1
          const label = mk(`${km} KM`, world[i], 0.36, 0.6)
          this.kmMarkers.push(label)
        }
      }
    }

    this.cursor.material.color.set(this.params.hudAccent)
    this.profileEl.querySelector('.gpx-name').textContent = this.track.name.toUpperCase().slice(0, 28)
    const totKm = this.track.cumKm[this.track.cumKm.length - 1]
    const gain = eles.reduce((g, e, i) => (i && e > eles[i - 1] ? g + e - eles[i - 1] : g), 0)
    this.profileEl.querySelector('.gpx-stats').textContent =
      `${totKm.toFixed(1)} KM · ↗ ${Math.round(gain)} M · ${Math.round(Math.min(...eles))}–${Math.round(Math.max(...eles))} M`
    // respect the layer's visibility — a terrain rebuild must not resurrect
    // the profile strip while the track is hidden (or while in orbit)
    this.profileEl.classList.toggle('hidden', !this.group.visible)
    this._drawProfile()

    // a fresh line/casing/glow always starts fully revealed — reapply the
    // persisted reveal amount so a rebuild mid-playback (e.g. a terrain
    // rebuild) doesn't snap the drawn line back to 100%
    this._applyReveal(this._revealT)

    // along-track village announcements (task 16 §3) — dispose the previous
    // build's markers right away (their ground heights belong to the old
    // terrain/dem) and kick off the async re-pick. loadLayer('places') is
    // cached after the first call (see geo-data.js), so every rebuild after
    // the track's first load resolves near-instantly; _villageBuildId guards
    // against a rebuild() firing again before an in-flight fetch resolves.
    this._disposeVillages()
    const villageBuildId = ++this._villageBuildId
    this._buildVillages(villageBuildId, dem, world, totKm)
  }

  // Fetches places (cached after the first call), picks the along-track
  // hits once, and builds their (initially invisible) markers. Never
  // throws — a failed/late fetch just means no village announcements.
  async _buildVillages(buildId, dem, world, totKm) {
    if (!dem) return
    try {
      const [rows] = await Promise.all([loadLayer('places'), labelFontReady()])
      if (buildId !== this._villageBuildId || !this.track || !Array.isArray(rows)) return
      const radiusWorld = VILLAGE_RADIUS_M / surfaceMetersPerUnit(dem)
      this._villageHits = pickVillagesAlongTrack(rows, {
        toWorld: (lat, lon) => latLonToWorld(dem, lat, lon),
        world,
        cumKm: this.track.cumKm,
        minPop: VILLAGE_MIN_POP,
        radiusWorld,
      })
      this._villageLeadKm = villageLeadKm(totKm)
      this._villageFadeKm = this._villageLeadKm * 1.5
      this._buildVillageMarkers()
    } catch {
      this._villageHits = []
    }
  }

  // Builds one (vertical line + name label, both initially opacity 0) per
  // precomputed hit — reuses text-label.js's makeLabelTexture(), same
  // BASE_H sizing convention as a normal place name (see VILLAGE_LABEL_BASE_H
  // above). Per-frame work is just an opacity lookup in _updateVillages().
  // ink/plate both use tier 0 (the boldest step of labelInk/labelPlate's
  // ranking) — every announced village is, by construction, a name worth
  // the rider's attention right now, not one competing against neighbours
  // for screen space the way the viewport-picked Places layer's tiers do.
  _buildVillageMarkers() {
    this._disposeVillages()
    if (!this._villageHits.length) return
    // task 29: the plate deliberately runs OPPOSITE the theme (dark plate on
    // a light map, light plate on a dark map — see labelPlate), so the text
    // drawn on top of it must run opposite labelInk's normal on-map ink too,
    // via labelPlateInk, or it reads dark-on-dark / light-on-light.
    const plateInk = labelPlateInk(this.params.darkMode)
    const plate = labelPlate(this.params.darkMode)
    const accentColor = new THREE.Color(this.params.hudAccent)
    for (const hit of this._villageHits) {
      const groundY = this.terrain.sample ? this.terrain.sample(hit.w.x, hit.w.z) : 0
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(hit.w.x, groundY, hit.w.z),
        new THREE.Vector3(hit.w.x, groundY + VILLAGE_LINE_HEIGHT, hit.w.z),
      ])
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false })
      )
      line.renderOrder = 24 + this._renderOffset
      line.visible = false
      this.group.add(line)

      const { tex, aspect } = makeLabelTexture(hit.name.toUpperCase(), { color: plateInk, plate, weight: 700 })
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
      )
      label.material.sizeAttenuation = false
      label.scale.set(VILLAGE_LABEL_BASE_H * aspect, VILLAGE_LABEL_BASE_H, 1)
      label.position.set(hit.w.x, groundY + VILLAGE_LINE_HEIGHT + VILLAGE_LABEL_GAP, hit.w.z)
      label.renderOrder = 25 + this._renderOffset
      label.visible = false
      this.group.add(label)

      this._villageMarkers.push({ hit, line, label })
    }
  }

  // Per-frame (well, per _updateHead call — playback only): cheap opacity
  // lookup against the precomputed hits, no track/place re-scan (see the
  // task-16 brief: "précalcule... une fois, ne scanne pas par frame").
  _updateVillages(km) {
    if (!this._villageMarkers.length) return
    for (const m of this._villageMarkers) {
      const op = villageOpacity(km, m.hit.km, this._villageLeadKm, this._villageFadeKm)
      const visible = op > 0.002
      m.line.visible = visible
      m.label.visible = visible
      m.line.material.opacity = op
      m.label.material.opacity = op
    }
  }

  _disposeVillages() {
    for (const m of this._villageMarkers) {
      this.group.remove(m.line)
      m.line.geometry.dispose()
      m.line.material.dispose()
      this.group.remove(m.label)
      m.label.material.map?.dispose()
      m.label.material.dispose()
    }
    this._villageMarkers = []
  }

  // hides (opacity 0) every village marker without disposing them — used
  // when playback stops/hides so a paused/stopped view doesn't leave a
  // half-faded announcement hanging.
  _hideVillages() {
    for (const m of this._villageMarkers) {
      m.line.visible = false
      m.label.visible = false
      m.line.material.opacity = 0
      m.label.material.opacity = 0
    }
  }

  // ---------------------------------------------------------------- arches

  // Builds the start/finish 3D arch(es) for the current track (task 22 §6,
  // now the user's own modelled GLB — task 25) — called from rebuild(),
  // gated by params.gpxMarkers (the arch REPLACES the old flat ◆/▶/■
  // sprites — see rebuild()'s own comment on why both shouldn't show).
  // Returns true if at least one arch was actually placed, false for a
  // degenerate (<2 point) track — the caller falls back to the flat sprites
  // only in that false case, so a track never ends up with neither kind of
  // start/finish marker. buildArchMesh() itself is synchronous (returns a
  // group immediately, populates it once the GLB — loaded once, cached —
  // resolves), so this stays synchronous too.
  _buildArches(world, isLoop, names, eles) {
    if (!world || world.length < 2) return false
    const specs = computeArchSpecs(world, isLoop)
    if (!specs.length) return false
    // task 25 §4: "l'utilisateur pourra choisir la couleur de l'arche" — an
    // explicit choice (params.gpxArchColor) wins; empty (the default, same
    // sentinel convention as gpxColor) falls back to the old darkMode-driven
    // ink so an untouched arch still reads correctly in both look modes.
    const archColor = this.params.gpxArchColor || (this.params.darkMode ? '#e7e9ec' : '#2b2f33')
    for (const spec of specs) {
      const group = buildArchMesh(spec, {
        sampleGround: (x, z) => this.terrain.sample?.(x, z) ?? spec.pos.y,
        ink: archColor,
        renderOrder: 22 + this._renderOffset,
      })
      this.group.add(group)
      this._archGroups.push(group)
    }
    return true
  }

  _disposeArches() {
    for (const group of this._archGroups) {
      this.group.remove(group)
      disposeArchGroup(group)
    }
    this._archGroups = []
  }

  _elevations() {
    const dem = this.getDem()
    const mPerUnit = dem ? surfaceMetersPerUnit(dem) / this.params.demExaggeration : 1
    return this.track.points.map((p, i) => {
      if (p.ele != null && Number.isFinite(p.ele)) return p.ele
      const w = this.track.world?.[i]
      // subtract the SAME lift rebuild() added, or every derived altitude is
      // off by it — this is why DRAPE_LIFT is a named constant and not a
      // literal repeated in two places that can drift apart
      return w && dem ? (w.y - DRAPE_LIFT) * mPerUnit + dem.meanM : 0
    })
  }

  // per-vertex [r,g,b, r,g,b, ...] ramp for the gradient modes, one triple
  // per track point (parallel to the pts/world arrays built in rebuild()).
  _trackColors(eles) {
    const cumKm = this.track.cumKm
    const n = eles.length
    const eMin = Math.min(...eles)
    const eMax = Math.max(...eles)
    const eRange = Math.max(eMax - eMin, 1e-6)
    const mode = this.params.gpxGradientMode || 'elevation'
    const out = new Array(n * 3)
    for (let i = 0; i < n; i++) {
      let c
      if (mode === 'slope') {
        const j = Math.min(i + 1, n - 1)
        const k = Math.max(i - 1, 0)
        const dKm = cumKm[j] - cumKm[k]
        const grade = dKm > 0 ? ((eles[j] - eles[k]) / (dKm * 1000)) * 100 : 0
        c = slopeRampColor(grade)
      } else if (mode === 'progress') {
        c = progressRampColor(n > 1 ? i / (n - 1) : 0)
      } else {
        c = elevationRampColor((eles[i] - eMin) / eRange)
      }
      out[i * 3] = c.r
      out[i * 3 + 1] = c.g
      out[i * 3 + 2] = c.b
    }
    return out
  }

  // ---------------------------------------------------------------- profile

  _drawProfile() {
    if (!this.track?.world) return
    const cv = this.profileCanvas
    const ctx = cv.getContext('2d')
    const css = getComputedStyle(document.documentElement)
    const ink = css.getPropertyValue('--hud-ink').trim() || '#17191b'
    const accent = css.getPropertyValue('--hud-accent').trim() || '#ff4d00'
    const W = cv.width
    const H = cv.height
    ctx.clearRect(0, 0, W, H)

    const eles = this._elevations()
    // guard: a stationary track (identical points) has totKm 0 → X(i) NaN
    const totKm = Math.max(this.track.cumKm[this.track.cumKm.length - 1], 1e-6)
    const eMin = Math.min(...eles)
    const eMax = Math.max(...eles)
    const pad = 8
    const X = (i) => pad + (this.track.cumKm[i] / totKm) * (W - pad * 2)
    const Y = (e) => H - pad - ((e - eMin) / Math.max(eMax - eMin, 1)) * (H - pad * 2 - 10)

    // area fill + line
    ctx.beginPath()
    ctx.moveTo(X(0), H - pad)
    for (let i = 0; i < eles.length; i++) ctx.lineTo(X(i), Y(eles[i]))
    ctx.lineTo(X(eles.length - 1), H - pad)
    ctx.closePath()
    ctx.fillStyle = accent + '22'
    ctx.fill()
    ctx.beginPath()
    for (let i = 0; i < eles.length; i++) i ? ctx.lineTo(X(i), Y(eles[i])) : ctx.moveTo(X(i), Y(eles[i]))
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Race Studio : un trait vertical par point de passage DÉJÀ franchi par
    // la tête de course (en lecture) — tous visibles hors lecture (Adrien)
    if (this.raceTicks?.length) {
      const headKm = this.isPlaying() ? this.headT * totKm : Infinity
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      for (const t of this.raceTicks) {
        if (t.km > headKm) continue
        const x = pad + (Math.min(t.km, totKm) / totKm) * (W - pad * 2)
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(x, pad)
        ctx.lineTo(x, H - pad)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(x, pad + 2, 2, 0, Math.PI * 2)
        ctx.fillStyle = accent
        ctx.fill()
      }
    }

    // hover crosshair
    if (this.hoverIdx >= 0) {
      const i = this.hoverIdx
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(i), pad)
      ctx.lineTo(X(i), H - pad)
      ctx.stroke()
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(X(i), Y(eles[i]), 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '10px "SF Mono", ui-monospace, monospace'
      ctx.fillStyle = ink
      ctx.textAlign = X(i) > W / 2 ? 'right' : 'left'
      ctx.fillText(
        `${Math.round(eles[i])} m · km ${this.track.cumKm[i].toFixed(1)}`,
        X(i) + (X(i) > W / 2 ? -6 : 6),
        pad + 8
      )
    }
  }

  // ---------------------------------------------------------------- hover

  // nearest track point to the pointer ray (screen-space tolerance)
  pointerMove(mouseNdc, clientX, clientY) {
    // group.visible covers the "show track" toggle — line.visible alone stays
    // true when the layer is hidden, which kept the DOM tooltip alive
    if (!this.track?.world || !this.line || !this.group.visible) return
    this._ray.setFromCamera(mouseNdc, this.camera)
    const ray = this._ray.ray
    const camDist = this.camera.position.distanceTo(this.cursor.visible ? this.cursor.position : ray.origin)
    const tol = Math.max(0.4, camDist * 0.022)
    let best = -1
    let bestD = tol * tol
    for (let i = 0; i < this.track.world.length; i++) {
      const d = ray.distanceSqToPoint(this.track.world[i])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    this.setHover(best, true, clientX, clientY)
  }

  // isPlaybackHead distinguishes the two callers that share this bookkeeping
  // (hoverIdx tracking, profile crosshair, tooltip text): mouse-driven hover
  // (from the 3D scene or the profile strip) shows the accent sphere;
  // playback (from _updateHead()) shows the black triangle marker instead —
  // see the task-13 brief's "circle -> triangle" ask. The triangle's own
  // position/visibility is actually set in _updateHead() (the exact reveal-
  // head vertex, damped in time — see stepHeadFollow()); this only
  // suppresses the sphere so the two markers never show at once.
  setHover(i, fromScene, clientX, clientY, isPlaybackHead = false) {
    this.hoverIdx = i
    if (i < 0 || !this.track?.world) {
      this.cursor.visible = false
      this.headMarker.visible = false
      this.tipEl.classList.add('hidden')
      this._drawProfile()
      return
    }
    if (isPlaybackHead) {
      this.cursor.visible = false
    } else {
      this.headMarker.visible = false
      this.cursor.visible = true
      this.cursor.position.copy(this.track.world[i])
      const s = Math.max(0.5, this.camera.position.distanceTo(this.cursor.position) * 0.02)
      this.cursor.scale.setScalar(s)
    }

    const eles = this._elevations()
    const km = this.track.cumKm[i]
    const j = Math.min(i + 1, eles.length - 1)
    const dKm = this.track.cumKm[j] - this.track.cumKm[Math.max(i - 1, 0)]
    const grade = dKm > 0 ? ((eles[j] - eles[Math.max(i - 1, 0)]) / (dKm * 1000)) * 100 : 0
    const text = `ALT ${Math.round(eles[i])} M · KM ${km.toFixed(2)} · ${grade >= 0 ? '+' : ''}${grade.toFixed(1)}%`

    if (fromScene && clientX != null) {
      this.tipEl.textContent = text
      this.tipEl.style.left = `${clientX + 16}px`
      this.tipEl.style.top = `${clientY - 10}px`
      this.tipEl.classList.remove('hidden')
    } else {
      this.tipEl.classList.add('hidden')
    }
    this._drawProfile()
  }

  // ---------------------------------------------------------------- fly

  // Catmull-Rom above the track with a smoothed clearance envelope — handed
  // to the existing tour controller for the flight itself.
  buildFlightCurve(altitude) {
    const w = this.track?.world
    if (!w || w.length < 2) return null
    const stride = Math.max(1, Math.floor(w.length / 90))
    const raw = []
    for (let i = 0; i < w.length; i += stride) raw.push(w[i])
    raw.push(w[w.length - 1])

    // rolling-max envelope, then box blur — same recipe as the poi tour
    const win = 4
    const ys = raw.map((_, i) => {
      let m = -Infinity
      for (let j = Math.max(0, i - win); j <= Math.min(raw.length - 1, i + win); j++) m = Math.max(m, raw[j].y)
      return m
    })
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < ys.length; i++) {
        let s = 0
        let c = 0
        for (let j = Math.max(0, i - 3); j <= Math.min(ys.length - 1, i + 3); j++) {
          s += ys[j]
          c++
        }
        ys[i] = s / c
      }
    }

    const pts = [this.camera.position.clone()]
    for (let i = 0; i < raw.length; i++) pts.push(new THREE.Vector3(raw[i].x, ys[i] + altitude, raw[i].z))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    curve.arcLengthDivisions = 600
    curve.updateArcLengths()
    return curve
  }

  // ---------------------------------------------------------------- misc

  onResize(w, h) {
    this.lineMat?.resolution.set(w, h)
    this.glowMat?.resolution.set(w, h)
  }

  setColor(color) {
    const c = color || this.params.hudAccent
    // when the gradient ramp is driving the line, its base colour must stay
    // white (see rebuild()) — the accent swatch only applies to the solid path
    if (!this.params.gpxGradient) {
      this.lineMat?.color.set(c)
      this.glowMat?.color.set(c)
    }
    this.cursor.material.color.set(c)
  }

  setWidth(v) {
    if (this.lineMat) this.lineMat.linewidth = v
    if (this.glowMat) this.glowMat.linewidth = v * 2.4
  }

  // gradient / glow need the geometry (vertex colours) or a second line rebuilt.
  setGradient(on, mode) {
    this.params.gpxGradient = on
    if (mode) this.params.gpxGradientMode = mode
    this.rebuild()
  }

  setGlow(v) {
    this.params.gpxGlow = v
    this.rebuild()
  }

  // sport icon shown INSIDE the composed head-marker badge (task 22 §4/§3,
  // rebuilt task 24 §2). `tex` is the SOURCE icon texture (a THREE.Texture
  // whose .image is the small rasterized icon canvas — see sport-icons.js's
  // rasterizeToCanvas + main.js's caching); lifecycle of THAT source texture
  // still stays with the caller (GpxLayerManager may share/reuse one across
  // several layers). What's NEW here: this class now bakes that icon into
  // its OWN composed marker texture (see composeHeadMarkerTexture()), so
  // THIS derived texture is what GpxLayer owns and must dispose itself —
  // every call replaces it. Pass null/undefined to clear (no icon assigned,
  // or its texture is still loading) — the badge still draws, just empty.
  setIcon(tex) {
    const iconCanvas = tex?.image instanceof HTMLCanvasElement ? tex.image : null
    this._headIconCanvas = iconCanvas
    const newMap = composeHeadMarkerTexture(iconCanvas, HEAD_MARKER_INK)
    this.headMarker.material.map?.dispose()
    this.headMarker.material.map = newMap
    this.headMarker.material.needsUpdate = true
  }

  // multi-layer stacking (task 22 §2) — additive renderOrder + a small
  // world-Y nudge, applied on the NEXT rebuild(). See the constructor
  // comment on _renderOffset/_depthOffsetY for why both default to zero.
  setRenderDepth(renderOffset, yNudge = 0) {
    this._renderOffset = renderOffset || 0
    this._depthOffsetY = yNudge || 0
    if (this.track) this.rebuild()
  }

  // advances the progressive-reveal head while playing — called from the
  // main render loop each frame with a real per-frame dt.
  tick(dt) {
    if (this.playing && this.track?.world?.length > 1) {
      const totalKm = this.track.cumKm[this.track.cumKm.length - 1] || 0
      const duration = Math.min(90, Math.max(8, totalKm * 1.5))
      // the Follow-speed slider (Route panel) only scales the advance rate
      // while drone-follow is actually on — normal playback pace is
      // untouched otherwise. Because the reveal head AND the chase camera
      // (driven from this same headT, see main.js) both read this one
      // value, they can never drift apart regardless of speed.
      const speedMul = this.params.gpxFollow ? THREE.MathUtils.clamp(this.params.gpxFollowSpeed || 1, 0.1, 6) : 1
      this.headT = Math.min(1, this.headT + (dt * speedMul) / duration)
      this._applyReveal(this.headT)
      this._updateHead(dt)
      if (this.headT >= 1) this.playing = false // reached the end — auto-pause
    }
  }

  // ---------------------------------------------------------------- playback

  isPlaying() {
    return this.playing
  }

  play() {
    if (!this.track?.world || this.track.world.length < 2) return
    if (this.headT >= 1) {
      this.headT = 0
      this._headDispValid = false // restarting from the top — snap, don't ease across from the old end position
    }
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  stop() {
    this.playing = false
    this.headT = 0
    this._headDispValid = false
    this._applyReveal(1) // restore the full line
    this._hideVillages()
    this.headLabel?.classList.add('hidden')
    this.setHover(-1, false)
  }

  setAltReadout(v) {
    this.params.gpxAltReadout = v
  }

  setSlopeReadout(v) {
    this.params.gpxSlopeReadout = v
  }

  // limits how much of the line/glow Line2 draws — instanceCount is the
  // fat-line addon's per-segment draw-range knob (see LineSegmentsGeometry
  // .setPositions, which sets it to the full segment count by default).
  _applyReveal(t) {
    this._revealT = THREE.MathUtils.clamp(t, 0, 1)
    const count = revealVertexIndex(this._revealT, this._segCount)
    if (this.line) this.line.geometry.instanceCount = count
    if (this.glowLine) this.glowLine.geometry.instanceCount = count
  }

  // positions the head marker + tweened alt/slope label at the current
  // headT, and drives the profile-strip cursor to match (setHover keeps the
  // DOM tooltip suppressed since fromScene is false here).
  _updateHead(dt) {
    const world = this.track.world
    // the SAME formula _applyReveal() just cut the real Line2 to — see
    // revealVertexIndex()'s own comment. This is what fixes the task-16 bug:
    // one function, one answer, used by both the geometry and the marker.
    const headIdx = revealVertexIndex(this.headT, this._segCount)
    this.setHover(headIdx, false, undefined, undefined, true) // playback: triangle, not the hover sphere

    const eles = this._elevations()
    const cumKm = this.track.cumKm
    const j = Math.min(headIdx + 1, eles.length - 1)
    const k = Math.max(headIdx - 1, 0)
    const dKm = cumKm[j] - cumKm[k]
    const targetSlope = dKm > 0 ? ((eles[j] - eles[k]) / (dKm * 1000)) * 100 : 0
    const targetAlt = eles[headIdx]

    // ease toward the sampled value instead of snapping, so the digits
    // visibly animate as the head advances
    const lambda = 6
    this._dispAlt = this._dispAlt == null ? targetAlt : THREE.MathUtils.damp(this._dispAlt, targetAlt, lambda, dt)
    this._dispSlope =
      this._dispSlope == null ? targetSlope : THREE.MathUtils.damp(this._dispSlope, targetSlope, lambda, dt)

    // marker position: EXACTLY the real track vertex the Line2 is cut to
    // (world[headIdx] — same idx as above), critically-damped in TIME (never
    // a different, smoother curve — see stepHeadFollow()'s comment and the
    // task-16 bug report). world[headIdx].y already carries the real terrain
    // sample from rebuild() (terrain.sample(x,z) + 0.16), so riding it also
    // fixes "le triangle doit suivre le dénivelé" for free — no separate
    // elevation lookup needed.
    stepHeadFollow(this._headDisp, world[headIdx], HEAD_FOLLOW_LAMBDA, dt, this._headDispValid)
    this._headDispValid = true
    const pos = this._headDisp
    // task 24 §2: a small, CONSTANT world-space gap above the ground — NOT
    // scaled by camera distance (the old `camDist * 0.02` formula this
    // replaces is exactly the bug the brief flagged: "vraiment juste au
    // dessus du sol, toujours" means the same tiny gap at any zoom/pitch,
    // not one that balloons far from the camera). This is only possible
    // because the sprite's pivot is the triangle's own apex (see
    // HM_APEX_V/this.headMarker.center in the constructor) — position.y
    // here already carries world[headIdx].y = terrain.sample(x,z) + 0.16
    // (the line's own anti-z-fight lift, see the comment above), so the
    // apex sits ~0.16+0.05 world units above the true terrain sample —
    // small and, critically, the SAME at any zoom (see the task-24 report's
    // measured gap across a full playback run).
    this.headMarker.position.set(pos.x, pos.y + HEAD_MARKER_GROUND_GAP, pos.z)
    this.headMarker.visible = true

    const v = pos.clone().project(this.camera)
    const x = (v.x * 0.5 + 0.5) * window.innerWidth
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight
    this.headLabel.style.left = `${x + 18}px`
    this.headLabel.style.top = `${y - 10}px`

    const showAlt = !!this.params.gpxAltReadout
    const showSlope = !!this.params.gpxSlopeReadout
    this._headAltEl.textContent = `ALT ${Math.round(this._dispAlt)} M`
    this._headAltEl.classList.toggle('hidden', !showAlt)
    this._headSlopeEl.textContent = `${this._dispSlope >= 0 ? '+' : ''}${this._dispSlope.toFixed(1)}%`
    this._headSlopeEl.classList.toggle('hidden', !showSlope)
    this.headLabel.classList.toggle('hidden', !(showAlt || showSlope))

    this._updateVillages(cumKm[headIdx])
  }

  // rebuild-driven toggles — geometry (ticks/labels) is only constructed
  // when its flag is on, so each of these needs a rebuild()
  // single toggle for both markers — see the rebuild() comment above
  setMarkers(v) {
    this.params.gpxMarkers = v
    this.rebuild()
  }

  // task 25 §4 — user-choosable arch colour; '' resets to the darkMode
  // default (see _buildArches). Full rebuild, same as setGlow/setMarkers
  // above: cheapest correct way to re-run _buildArches with the new colour.
  setArchColor(v) {
    this.params.gpxArchColor = v
    this.rebuild()
  }

  setKm(v) {
    this.params.gpxKm = v
    this.rebuild()
  }

  // Race name (task 22 §7) — organiser-entered, shown above this profile
  // strip's own track-name bar. An empty name hides the line entirely
  // rather than showing blank chrome (the track-name bar below already
  // covers "no name set" — see rebuild()'s '.gpx-name' text). Stored on the
  // instance (not just painted to the DOM) so the Route panel's race-name
  // field can read back the current value when focus moves between layers
  // — see GpxLayerManager.raceName / setRaceName().
  setRaceName(name) {
    const trimmed = (name || '').trim()
    this.raceName = trimmed
    if (this.raceNameEl) {
      this.raceNameEl.textContent = trimmed
      this.raceNameEl.classList.toggle('hidden', !trimmed)
    }
  }

  // stores (or clears, when name is empty) a custom label for a track-point
  // index — shown on the waypoint/start/end sprite in place of the default
  // elevation readout; index is a plain track-point index (e.g. hoverIdx)
  setPointName(index, name) {
    if (!this.track || index == null || index < 0) return
    if (!this.track.pointNames) this.track.pointNames = {}
    const trimmed = (name || '').trim()
    if (trimmed) this.track.pointNames[index] = trimmed
    else delete this.track.pointNames[index]
    this.rebuild()
  }

  setVisible(v) {
    this.group.visible = v
    if (!v) {
      this.setHover(-1, false)
      this.pause?.()
      this.headLabel?.classList.add('hidden')
    }
    this.profileEl.classList.toggle('hidden', !v || !this.track)
  }

  _disposeLine() {
    this._disposeArches()
    this._segCount = 0
    if (this.line) {
      this.group.remove(this.line)
      this.line.geometry.dispose()
      this.lineMat.dispose()
      this.line = null
    }
    if (this.glowLine) {
      this.group.remove(this.glowLine)
      this.glowLine.geometry.dispose()
      this.glowMat.dispose()
      this.glowLine = null
      this.glowMat = null
    }
    for (const s of [this.startSprite, this.endSprite, ...(this.waypoints || [])]) {
      if (s) {
        this.group.remove(s)
        s.material.map.dispose()
        s.material.dispose()
      }
    }
    this.startSprite = this.endSprite = null
    this.waypoints = []
    for (const m of this.kmMarkers || []) {
      this.group.remove(m)
      if (m.isSprite) {
        m.material.map.dispose()
        m.material.dispose()
      }
    }
    this.kmMarkers = []
  }

  // position monde amortie de la tête (ce que l'utilisateur voit) — null tant
  // qu'aucune tête n'est active ; la caméra de suivi la vise pour la centrer
  get headWorld() {
    return this._headDispValid ? this._headDisp : null
  }

  clear() {
    this._disposeLine()
    this._disposeVillages()
    this.track = null
    this.cursor.visible = false
    this.headMarker.visible = false
    this._headDispValid = false
    this._villageHits = []
    this._villageLeadKm = 0
    this._villageFadeKm = 0
    this.tipEl.classList.add('hidden')
    this.profileEl.classList.add('hidden')
    this.playing = false
    this.headT = 0
    this._revealT = 1
    this.raceTicks = null // Race Studio : [{km}] — traits verticaux sur le profil
    this._dispAlt = null
    this._dispSlope = null
    this.headLabel?.classList.add('hidden')
    this.onCleared?.() // le damier de blocs voisins se resynchronise (main.js)
  }
}
