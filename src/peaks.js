// Top-5 named peaks of the current patch, via the Overpass API (OSM
// natural=peak nodes, no key). Markers are DOM elements projected every
// frame; each shows the peak name and its real altitude.
// Habillage : voir la section « repères de sommet » de style.css — ils
// suivent la facture des cartouches de course, pas l'ancien FUI .hud-poi.
// ÉTEINTS par défaut (params.peaksEnabled dans main.js) : la toponymie est
// une option, pas le sujet.

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

// Séparateur de milliers À LA MAIN. `toLocaleString('fr-FR')` pose une
// ESPACE FINE INSÉCABLE (U+202F) que Bricolage Grotesque n'a pas dans sa
// casse : la fiche de survol affichait « 13520 ft » là où le cartouche, en
// mono, montrait bien « 13 520 ». L'insécable normale, elle, est partout.
const milliers = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202F\u2009]/g, '\u00A0')

// Fiche de survol, une seule pour tous les marqueurs, montrée au
// pointerenter et cachée au pointerleave. `pointer-events: none` : elle ne
// peut jamais intercepter le survol auquel elle réagit (sinon elle
// clignoterait en se disputant le pointeur avec le marqueur).
// Elle portait les classes .hud-panel/.hud-row/.accent de hud2d.js — le FUI
// de fiction de v1 — avec quatre lignes CLASS / ELEV / GRID / STATUS dont
// deux ne disaient rien (CLASS valait toujours « PEAK », STATUS toujours
// « NAMED » : du costume, pas de l'information). Il ne reste que ce qui
// n'est pas déjà sur le cartouche, dans le verre v28 (.ce-glassbox).
function buildHoverCard() {
  const card = document.createElement('div')
  card.className = 'ce-glassbox peak-card'
  card.style.display = 'none'
  card.style.pointerEvents = 'none'

  const nameEl = document.createElement('b')
  const elevEl = document.createElement('span')
  const gridEl = document.createElement('span')
  card.append(nameEl, elevEl, gridEl)

  document.body.appendChild(card)
  return { card, nameEl, elevEl, gridEl }
}

export class PeaksLayer {
  constructor({ terrain, getDem, announce, onFocus }) {
    this.terrain = terrain
    this.getDem = getDem
    this.announce = announce
    this.onFocus = onFocus // (worldVec3, name) → orbit above the summit
    this.enabled = false
    this.markers = [] // { el, tag, world, name, ele, lat, lon }
    this._v = new THREE.Vector3()
    this._gen = 0 // request generation — stale fetches discard themselves
    this._hovered = null // the marker (from this.markers) whose card is showing
    this._hc = buildHoverCard()
  }

  async setEnabled(v) {
    this.enabled = v
    if (!v) return this._clear()
    await this.refresh()
  }

  _showCard(m) {
    this._hovered = m
    this._hc.nameEl.textContent = m.name
    this._hc.elevEl.textContent = `${milliers(m.ele)} m · ${milliers(m.ele * 3.28084)} ft`
    this._hc.gridEl.textContent = `${m.lat.toFixed(4)}°, ${m.lon.toFixed(4)}°`
    this._hc.card.style.display = 'block'
  }

  _hideCard() {
    this._hovered = null
    this._hc.card.style.display = 'none'
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
        el.className = 'peak-marker'
        const dot = document.createElement('i')
        dot.className = 'peak-dot'
        const tag = document.createElement('span')
        tag.className = 'peak-cart'
        // les noms OSM ne sont pas de confiance — textContent, jamais de HTML
        const nameEl = document.createElement('b')
        nameEl.className = 'peak-name'
        // la capitale est posée en CSS (text-transform) et non ici : la fiche
        // de survol réaffiche le MÊME nom en casse d'origine
        nameEl.textContent = p.name
        const eleEl = document.createElement('i')
        eleEl.className = 'peak-alt'
        eleEl.textContent = `${milliers(ele)} m`
        tag.append(nameEl, eleEl)
        el.append(dot, tag)
        document.body.appendChild(el)
        const world = new THREE.Vector3(w.x, y, w.z)
        el.addEventListener('click', () => this.onFocus?.(world, p.name))
        const marker = { el, tag, world, name: p.name, ele, lat: p.lat, lon: p.lon }
        // fiche de survol (altitude m/ft + coordonnées) — voir buildHoverCard()
        el.addEventListener('pointerenter', () => this._showCard(marker))
        el.addEventListener('pointerleave', () => this._hideCard())
        this.markers.push(marker)
      }
      this.announce(`${this.markers.length} PEAKS PLOTTED`)
    } catch (err) {
      if (gen !== this._gen) return // superseded — the newer refresh reports
      console.warn('peaks:', err.message)
      this.announce('PEAK DATA OFFLINE')
    }
  }

  update(camera, w, h, visible) {
    let hoveredOn = false
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
      if (m === this._hovered) {
        hoveredOn = on
        if (on) {
          // la fiche se pose en bas à droite du point, bornée pour ne jamais
          // sortir du cadre. Les marges (200/90) suivent la taille de la
          // fiche : elles valaient 250/130 du temps du panneau FUI à quatre
          // lignes et laissaient désormais un trou au bord droit.
          const sx = (this._v.x * 0.5 + 0.5) * w
          const sy = (-this._v.y * 0.5 + 0.5) * h
          const px = Math.min(Math.max(sx + 14, 10), w - 200)
          const py = Math.min(sy + 8, h - 90)
          this._hc.card.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`
        }
      }
    }
    // the hovered marker itself just went off-screen/invisible — drop the card
    // rather than leave it frozen over nothing (mirrors the marker's own
    // opacity/pointer-events guard above)
    if (this._hovered && !hoveredOn) this._hideCard()
  }

  _clear() {
    this.markers.forEach((m) => m.el.remove())
    this.markers = []
    this._hideCard()
  }
}
