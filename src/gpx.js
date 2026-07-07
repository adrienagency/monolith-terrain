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

function textSprite(text, accent) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 80
  const ctx = c.getContext('2d')
  ctx.font = '600 44px "SF Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = accent
  ctx.fillText(text, 128, 44)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
  sp.scale.set(3.4, 1.06, 1)
  sp.renderOrder = 20
  return sp
}

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
    this.hoverIdx = -1

    // hover cursor: accent sphere pinned to the nearest track point
    this.cursor = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 14),
      new THREE.MeshBasicMaterial({ color: params.hudAccent, depthTest: false })
    )
    this.cursor.renderOrder = 21
    this.cursor.visible = false
    this.group.add(this.cursor)

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
  }

  // ---------------------------------------------------------------- data

  // Pick center + zoom so the whole track fits comfortably in the patch.
  frame(points) {
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

  setTrack(points, name) {
    const cumKm = [0]
    for (let i = 1; i < points.length; i++) cumKm.push(cumKm[i - 1] + distM(points[i - 1], points[i]) / 1000)
    this.track = { points, name, cumKm, world: null }
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
      const y = inside ? this.terrain.sample(w.x, w.z) + 0.16 : 0.16
      world.push(new THREE.Vector3(w.x, y, w.z))
      pts.push(w.x, y, w.z)
    }
    this.track.world = world

    const geo = new LineGeometry()
    geo.setPositions(pts)
    this.lineMat = new LineMaterial({
      color: new THREE.Color(this.params.hudAccent),
      linewidth: 3,
      alphaToCoverage: false,
    })
    this.lineMat.resolution.set(window.innerWidth, window.innerHeight)
    this.line = new Line2(geo, this.lineMat)
    this.line.computeLineDistances()
    this.group.add(this.line)

    const mk = (label, v) => {
      const s = textSprite(label, this.params.hudAccent)
      s.position.copy(v).add(new THREE.Vector3(0, 1.25, 0))
      this.group.add(s)
      return s
    }
    this.startSprite = mk('▶ START', world[0])
    this.endSprite = mk('■ END', world[world.length - 1])

    this.cursor.material.color.set(this.params.hudAccent)
    this.profileEl.querySelector('.gpx-name').textContent = this.track.name.toUpperCase().slice(0, 28)
    const totKm = this.track.cumKm[this.track.cumKm.length - 1]
    const eles = this._elevations()
    const gain = eles.reduce((g, e, i) => (i && e > eles[i - 1] ? g + e - eles[i - 1] : g), 0)
    this.profileEl.querySelector('.gpx-stats').textContent =
      `${totKm.toFixed(1)} KM · ↗ ${Math.round(gain)} M · ${Math.round(Math.min(...eles))}–${Math.round(Math.max(...eles))} M`
    // respect the layer's visibility — a terrain rebuild must not resurrect
    // the profile strip while the track is hidden (or while in orbit)
    this.profileEl.classList.toggle('hidden', !this.group.visible)
    this._drawProfile()
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

  setHover(i, fromScene, clientX, clientY) {
    this.hoverIdx = i
    if (i < 0 || !this.track?.world) {
      this.cursor.visible = false
      this.tipEl.classList.add('hidden')
      this._drawProfile()
      return
    }
    this.cursor.visible = true
    this.cursor.position.copy(this.track.world[i])
    const s = Math.max(0.5, this.camera.position.distanceTo(this.cursor.position) * 0.02)
    this.cursor.scale.setScalar(s)

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
  }

  setColor(color) {
    this.lineMat?.color.set(color)
    this.cursor.material.color.set(color)
  }

  setVisible(v) {
    this.group.visible = v
    if (!v) this.setHover(-1, false)
    this.profileEl.classList.toggle('hidden', !v || !this.track)
  }

  _disposeLine() {
    if (this.line) {
      this.group.remove(this.line)
      this.line.geometry.dispose()
      this.lineMat.dispose()
      this.line = null
    }
    for (const s of [this.startSprite, this.endSprite]) {
      if (s) {
        this.group.remove(s)
        s.material.map.dispose()
        s.material.dispose()
      }
    }
    this.startSprite = this.endSprite = null
  }

  clear() {
    this._disposeLine()
    this.track = null
    this.cursor.visible = false
    this.tipEl.classList.add('hidden')
    this.profileEl.classList.add('hidden')
  }
}
