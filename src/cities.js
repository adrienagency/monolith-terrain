// PRINCIPAL CITIES on the map — a quiet layer of real place names, draped
// flat on the terrain like printed cartography (same spirit as labels.js).
// Data: Natural Earth 10m populated places (public domain), pre-filtered to
// population ≥ 200k plus every national capital (public/data/cities.json,
// ~73 KB, lazy-fetched on first use — never part of the JS bundle).
// Toggleable via params.cityLabels (Map style section).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld } from './geo.js'

const HALF = TERRAIN_SIZE / 2

let dataPromise = null
function loadData() {
  dataPromise ??= fetch('data/cities.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
  return dataPromise
}

// small-caps city name on a transparent canvas — a lighter cousin of the
// labels.js typography (sans the letter-spacing loop: city names are short)
function cityTexture(text, { size = 88, color = '#2e2820', capital = false }) {
  const font = `${capital ? '700' : '500'} ${size}px Georgia, 'Times New Roman', serif`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * 0.16
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap
  const pad = size * 0.4
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.5)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  let x = pad
  for (const ch of text) {
    ctx.fillText(ch, x, c.height / 2)
    x += ctx.measureText(ch).width + gap
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: c.width / c.height }
}

export class CityLabels {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'cities'
    scene.add(this.group)
    this.meshes = []
    this._surfaceVisible = true
    this._buildId = 0
  }

  _clear() {
    for (const m of this.meshes) {
      m.geometry.dispose()
      m.material.map?.dispose()
      m.material.dispose()
      this.group.remove(m)
    }
    this.meshes = []
  }

  // (re)populate for the current zone — async (first call fetches the data),
  // guarded by a build id so a stale fetch can never label the wrong zone
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.cityLabels || !dem || params.source !== 'real') return
    const all = await loadData()
    if (id !== this._buildId || dem !== terrain.dem) return // zone moved on

    // pick the biggest cities inside the patch, with a spacing pass so two
    // metropolises of one conurbation don't stack their names
    const zoom = params.demZoom ?? 8
    const maxN = zoom >= 10 ? 26 : zoom >= 8 ? 18 : 12
    const minDist = TERRAIN_SIZE * (zoom >= 10 ? 0.05 : 0.085)
    const picks = []
    for (const [name, lat, lon, pop, cap] of all) {
      const w = latLonToWorld(dem, lat, lon)
      if (Math.abs(w.x) > HALF * 0.96 || Math.abs(w.z) > HALF * 0.96) continue
      if (picks.some((p) => Math.hypot(p.w.x - w.x, p.w.z - w.z) < minDist)) continue
      picks.push({ name, w, pop, cap })
      if (picks.length >= maxN) break
    }
    if (!picks.length) return

    const ink = params.darkMode ? '#e8e2d4' : '#2e2820'
    const dotGeo = new THREE.CircleGeometry(0.075, 12)
    dotGeo.rotateX(-Math.PI / 2)
    for (const p of picks) {
      const y = (terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0) + 0.06
      // marker dot at the city itself
      const dot = new THREE.Mesh(
        dotGeo.clone(),
        new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.85, depthWrite: false })
      )
      dot.position.set(p.w.x, y, p.w.z)
      dot.renderOrder = 3
      this.group.add(dot)
      this.meshes.push(dot)
      // name draped just north of the dot; capitals read a touch larger
      const { tex, aspect } = cityTexture(p.name.toUpperCase(), { color: ink, capital: !!p.cap })
      const w = Math.min(6, (p.cap ? 0.34 : 0.3) * p.name.length + 0.9)
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w / aspect),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false })
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(p.w.x, y + 0.02, p.w.z - 0.28 - (w / aspect) * 0.5)
      mesh.renderOrder = 3
      this.group.add(mesh)
      this.meshes.push(mesh)
    }
    this.group.visible = this._surfaceVisible
  }

  setVisible(v) {
    this._surfaceVisible = v
    this.group.visible = v
  }

  dispose() {
    this._clear()
  }
}
