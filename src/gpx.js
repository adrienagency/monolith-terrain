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
import { makeLabelTexture, labelInk, labelFontReady } from './map/text-label.js'
import { computeArchSpecs, buildArchMesh } from './arch.js'

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

// green (flat) -> amber (moderate) -> red (steep) by absolute grade %
function slopeRampColor(gradePct) {
  const g = Math.min(Math.abs(gradePct), 18)
  let hue
  if (g <= 4) hue = THREE.MathUtils.lerp(0.34, 0.14, g / 4) // green -> amber
  else hue = THREE.MathUtils.lerp(0.14, 0.0, Math.min((g - 4) / 10, 1)) // amber -> red
  return new THREE.Color().setHSL(hue, 0.8, 0.5)
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

// Black, downward-pointing triangle for the playback-head marker (replaces
// the old hover-cursor sphere during playback — see setHover()'s
// isPlaybackHead branch). Drawn once, sizeAttenuation:false like the labels
// above, so it stays a legible, constant screen size at any zoom.
function triangleTexture(px = 64) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.moveTo(px * 0.5, px * 0.94) // apex, pointing down
  ctx.lineTo(px * 0.06, px * 0.14)
  ctx.lineTo(px * 0.94, px * 0.14)
  ctx.closePath()
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
// same BASE_H sizing convention as GPX_LABEL_BASE_H above — smaller than a
// label since this is a pointer, not text (tuned via measurement, see report)
const HEAD_MARKER_BASE_H = 0.006

// same sizeAttenuation:false / BASE_H convention yet again (see the big
// comment on GPX_LABEL_BASE_H above — this app's #1 recurring sizing trap:
// real on-screen size = projectionMatrix[5]*scale, ~3.7x the naive
// scale/2*viewport formula at this app's 30° fov). Square aspect (the sport
// icons are 24x24), sized between the label (0.0128) and the pointer
// triangle (0.006) — big enough to read as a small glyph, not a smudge, at
// the ~14-16px measured live (see the task-22 report).
const HEAD_ICON_BASE_H = 0.011

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
// same BASE_H sizing convention as places-layer.js's own BASE_H (0.007 puts a
// normal place name at ~8.5-14px cap-height, see its big comment) — these ARE
// place names, of the same visual class, just triggered along-track instead
// of by viewport picking, so they should read at the same size.
const VILLAGE_LABEL_BASE_H = 0.007

export class GpxLayer {
  constructor({ scene, camera, terrain, params, getDem }) {
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

    // playback-head marker: black downward-pointing triangle, billboarded +
    // screen-space sized (see triangleTexture()/HEAD_MARKER_BASE_H above).
    // Positioned each frame in _updateHead() at the EXACT reveal-head vertex
    // (see revealVertexIndex()) — the same point _applyReveal() cuts the
    // real Line2 to, never a separately-smoothed curve (see the task-16 bug
    // report). _headDisp/_headDispValid are the critically-damped follow
    // state that keeps its motion from stuttering (smoothing in TIME, not
    // space — see stepHeadFollow()).
    this.headMarker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: triangleTexture(), depthTest: false, transparent: true })
    )
    this.headMarker.material.sizeAttenuation = false
    this.headMarker.scale.set(HEAD_MARKER_BASE_H, HEAD_MARKER_BASE_H, 1)
    this.headMarker.renderOrder = 23
    this.headMarker.visible = false
    this.group.add(this.headMarker)
    this._headDisp = new THREE.Vector3()
    this._headDispValid = false

    // sport-type billboard riding above the playback head (task 22 §4) —
    // same sizeAttenuation:false convention as the triangle above; empty
    // (no map) until setIcon() is called, so a layer with no icon assigned
    // costs nothing extra. Texture lifecycle is owned by the CALLER
    // (GpxLayerManager, which may share one texture across several layers
    // using the same default sport) — this class only assigns/clears the
    // material's map, never disposes it.
    this.headIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, depthTest: false, transparent: true }))
    this.headIcon.material.sizeAttenuation = false
    this.headIcon.scale.set(HEAD_ICON_BASE_H, HEAD_ICON_BASE_H, 1)
    this.headIcon.renderOrder = 24
    this.headIcon.visible = false
    this.group.add(this.headIcon)

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
    wrap.className = 'gpx-profile hidden'
    wrap.innerHTML =
      '<div class="gpx-profile-head"><span class="gpx-name">TRACK</span><span class="gpx-stats"></span><button class="gpx-close">✕</button></div><canvas width="720" height="96"></canvas>'
    document.body.appendChild(wrap)
    this.profileEl = wrap
    this.profileCanvas = wrap.querySelector('canvas')
    wrap.querySelector('.gpx-close').addEventListener('click', () => this.clear())

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
  }

  // (Re)drape the loaded track onto the current terrain patch — called after
  // every terrain rebuild so the line always matches the relief under it.
  rebuild() {
    this._disposeLine()
    const dem = this.getDem()
    if (!this.track || !dem) return

    const pts = []
    const world = []
    for (const p of this.track.points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const inside = Math.abs(w.x) < TERRAIN_SIZE / 2 && Math.abs(w.z) < TERRAIN_SIZE / 2
      // _depthOffsetY (task 22 §2): a small per-layer lift so two stacked
      // layers whose tracks coincide (e.g. the same GPX loaded twice) don't
      // z-fight — see GpxLayerManager.reorder()/setRenderDepth().
      const y = (inside ? this.terrain.sample(w.x, w.z) + 0.16 : 0.16) + this._depthOffsetY
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
  _buildVillageMarkers() {
    this._disposeVillages()
    if (!this._villageHits.length) return
    const ink = labelInk(this.params.darkMode)
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

      const { tex, aspect } = makeLabelTexture(hit.name.toUpperCase(), { color: ink.color, halo: ink.halo, weight: 700 })
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

  // Builds the start/finish 3D arch(es) for the current track (task 22 §6) —
  // called from rebuild(), gated by params.gpxMarkers (the arch REPLACES the
  // old flat ◆/▶/■ sprites — see rebuild()'s own comment on why both
  // shouldn't show). Returns true if at least one arch was actually placed,
  // false for a degenerate (<2 point) track — the caller falls back to the
  // flat sprites only in that false case, so a track never ends up with
  // neither kind of start/finish marker.
  _buildArches(world, isLoop, names, eles) {
    if (!world || world.length < 2) return false
    const specs = computeArchSpecs(world, isLoop)
    if (!specs.length) return false
    const inkInfo = labelInk(this.params.darkMode)
    for (const spec of specs) {
      const group = buildArchMesh(spec, {
        THREE,
        sampleGround: (x, z) => this.terrain.sample?.(x, z) ?? spec.pos.y,
        makeLabel: (text) => makeLabelTexture(text, { color: inkInfo.color, halo: inkInfo.halo, weight: 700 }),
        ink: this.params.darkMode ? '#e7e9ec' : '#2b2f33',
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
      group.traverse((obj) => {
        obj.geometry?.dispose?.()
        if (obj.material) {
          obj.material.map?.dispose?.()
          obj.material.dispose()
        }
      })
    }
    this._archGroups = []
  }

  _elevations() {
    const dem = this.getDem()
    const mPerUnit = dem ? surfaceMetersPerUnit(dem) / this.params.demExaggeration : 1
    return this.track.points.map((p, i) => {
      if (p.ele != null && Number.isFinite(p.ele)) return p.ele
      const w = this.track.world?.[i]
      return w && dem ? (w.y - 0.16) * mPerUnit + dem.meanM : 0
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
      this.headIcon.visible = false
      this.tipEl.classList.add('hidden')
      this._drawProfile()
      return
    }
    if (isPlaybackHead) {
      this.cursor.visible = false
    } else {
      this.headMarker.visible = false
      this.headIcon.visible = false
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

  // sport-icon billboard above the playback head (task 22 §4/§3) — texture
  // lifecycle stays with the caller (see the headIcon constructor comment).
  // Pass null to clear (a layer with no icon assigned, or while its texture
  // is still loading).
  setIcon(tex) {
    this.headIcon.material.map = tex || null
    this.headIcon.material.needsUpdate = true
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
    const camDist = this.camera.position.distanceTo(pos)
    // apex-to-ground gap scales with camera distance (same 0.02 factor as the
    // hover cursor's own distance-scaled size, just above) so the triangle
    // visually "points at" the track at any zoom instead of the gap shrinking
    // or ballooning as the camera moves.
    const off = THREE.MathUtils.clamp(camDist * 0.02, 0.3, 3)
    this.headMarker.position.set(pos.x, pos.y + off, pos.z)
    this.headMarker.visible = true

    // sport-icon billboard (task 22 §4): rides ABOVE the triangle, same
    // camera-distance-scaled gap logic so it clears the triangle's own apex
    // at any zoom instead of overlapping it up close or drifting away far out.
    if (this.headIcon.material.map) {
      this.headIcon.position.set(pos.x, pos.y + off * 2.4, pos.z)
      this.headIcon.visible = true
    } else {
      this.headIcon.visible = false
    }

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

  setKm(v) {
    this.params.gpxKm = v
    this.rebuild()
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

  clear() {
    this._disposeLine()
    this._disposeVillages()
    this.track = null
    this.cursor.visible = false
    this.headMarker.visible = false
    this.headIcon.visible = false
    this._headDispValid = false
    this._villageHits = []
    this._villageLeadKm = 0
    this._villageFadeKm = 0
    this.tipEl.classList.add('hidden')
    this.profileEl.classList.add('hidden')
    this.playing = false
    this.headT = 0
    this._revealT = 1
    this._dispAlt = null
    this._dispSlope = null
    this.headLabel?.classList.add('hidden')
  }
}
