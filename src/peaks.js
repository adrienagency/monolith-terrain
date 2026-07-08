// Top-5 named peaks of the current patch, via the Overpass API (OSM
// natural=peak nodes, no key). Markers are DOM elements in the hud-poi
// family, projected every frame; each shows the peak name with its real
// altitude underneath.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { worldToLatLon, latLonToWorld } from './geo.js'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

export async function fetchTopPeaks(dem, count = 5) {
  const h = TERRAIN_SIZE / 2
  const north = worldToLatLon(dem, 0, -h).lat
  const south = worldToLatLon(dem, 0, h).lat
  const west = worldToLatLon(dem, -h, 0).lon
  const east = worldToLatLon(dem, h, 0).lon
  // 500-node budget: on a dense z8 patch (whole Alps) 150 was low enough to
  // miss the actual highest summits before the client-side sort
  const q = `[out:json][timeout:20];node["natural"="peak"]["name"](${south},${west},${north},${east});out body 500;`
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
  })
  if (!r.ok) throw new Error(`overpass → HTTP ${r.status}`)
  const json = await r.json()
  return (json.elements || [])
    .map((e) => ({
      name: e.tags?.name || '',
      ele: parseFloat(e.tags?.ele) || null,
      lat: e.lat,
      lon: e.lon,
    }))
    .filter((p) => p.name)
    .sort((a, b) => (b.ele ?? -1) - (a.ele ?? -1))
    .slice(0, count)
}

export class PeaksLayer {
  constructor({ terrain, getDem, announce, onFocus }) {
    this.terrain = terrain
    this.getDem = getDem
    this.announce = announce
    this.onFocus = onFocus // (worldVec3, name) → orbit above the summit
    this.enabled = false
    this.markers = [] // { el, world }
    this._v = new THREE.Vector3()
    this._gen = 0 // request generation — stale fetches discard themselves
  }

  async setEnabled(v) {
    this.enabled = v
    if (!v) return this._clear()
    await this.refresh()
  }

  // called on enable and after every terrain rebuild while enabled
  async refresh() {
    this._clear()
    const dem = this.getDem()
    if (!this.enabled || !dem) return
    const gen = ++this._gen // supersedes any fetch still in flight
    try {
      const peaks = await fetchTopPeaks(dem)
      if (!this.enabled || gen !== this._gen) return // toggled off / superseded
      if (!peaks.length) {
        this.announce('NO NAMED PEAKS IN THIS SECTOR')
        return
      }
      for (const p of peaks) {
        const w = latLonToWorld(dem, p.lat, p.lon)
        if (Math.abs(w.x) > TERRAIN_SIZE / 2 || Math.abs(w.z) > TERRAIN_SIZE / 2) continue
        const y = this.terrain.sample(w.x, w.z) + 0.5
        const ele = p.ele ?? Math.round(this.terrain.heightToFeet(y - 0.5) / 3.28084)
        const el = document.createElement('div')
        el.className = 'hud-poi peak-marker'
        // OSM names are untrusted — build the tag with textContent, never HTML
        const tag = document.createElement('span')
        tag.className = 'tag'
        const nameEl = document.createElement('b')
        nameEl.textContent = p.name.toUpperCase()
        const eleEl = document.createElement('i')
        eleEl.textContent = `${Math.round(ele).toLocaleString()} M`
        tag.append(nameEl, eleEl)
        el.appendChild(tag)
        document.body.appendChild(el)
        const world = new THREE.Vector3(w.x, y, w.z)
        el.style.cursor = 'pointer'
        el.addEventListener('click', () => this.onFocus?.(world, p.name))
        this.markers.push({ el, tag, world })
      }
      this.announce(`${this.markers.length} PEAKS PLOTTED`)
    } catch (err) {
      if (gen !== this._gen) return // superseded — the newer refresh reports
      console.warn('peaks:', err.message)
      this.announce('PEAK DATA OFFLINE')
    }
  }

  update(camera, w, h, visible) {
    for (const m of this.markers) {
      this._v.copy(m.world).project(camera)
      const on = visible && this._v.z < 1
      m.el.style.opacity = on ? 1 : 0
      // an off-screen marker keeps its last transform (frozen), so without this
      // its tag (pointer-events:auto) stays clickable while invisible → phantom
      // clicks focusing a peak that isn't on screen (incl. all of orbit mode)
      m.tag.style.pointerEvents = on ? 'auto' : 'none'
      if (on) {
        m.el.style.transform = `translate(${((this._v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-this._v.y * 0.5 + 0.5) * h).toFixed(1)}px)`
      }
    }
  }

  _clear() {
    this.markers.forEach((m) => m.el.remove())
    this.markers = []
  }
}
