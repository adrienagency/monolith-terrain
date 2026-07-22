// GPX layer stack (task 22) — "on va construire une possibilité de mettre
// plusieurs GPX en même temps... tu vas ranger les traces GPX sous forme de
// calques dans le tableau route, elles auront un ordre > 1 à 10 max... comme
// dans Figma". gpx.js's GpxLayer already models exactly ONE track's visuals
// + playback; this manager owns N of them — the array, its order (both
// visual stacking AND sequenced playback order — one list, one meaning),
// per-layer chrome (sport icon, name, visibility), and multi-track
// sequenced playback with a camera-handover hook.
//
// Style stays GLOBAL on purpose: width/colour/gradient/glow/markers(arches)/
// km/altitude+slope readouts apply to every layer uniformly, via the SAME
// params object every GpxLayer instance already reads from. Two reasons,
// not just one: (1) a multi-sport race (the brief's own triathlon example)
// should read as ONE coherent map style, not a patchwork of independently
// themed legs; (2) it's zero regression risk against the existing
// TEMPLATE_KEYS / share-link diff, neither of which needed to change. What
// genuinely varies per layer — order, sport icon, name, visibility — is
// exactly what this file adds.

import * as THREE from 'three'
import { GpxLayer, parseGpx } from './gpx.js'
import { getSport } from './ui/sport-icons.js'

export const MAX_LAYERS = 10

// ---------------------------------------------------------------- pure helpers

// Move the element at `from` to sit at `to`, returning a NEW array — drives
// both the panel's drag/drop reorder AND GpxLayerManager.reorder() below, so
// there is exactly one implementation of "what reordering means" to test.
export function reorderArray(arr, from, to) {
  if (!arr || from === to || from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr ? arr.slice() : []
  const out = arr.slice()
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}

// Panel-order index `idx` (0 = TOP of the layer list) among `count` layers
// -> the stacking depth gpx.js's setRenderDepth() wants: the top-of-list
// layer draws LAST (renderOffset highest → visually on top, the literal
// Figma reading of "layer order"), and each layer gets a tiny extra world-Y
// lift so two perfectly-coincident tracks (e.g. the same file loaded twice,
// see the task-22 verification) don't z-fight.
export function layerDepth(idx, count) {
  const rank = Math.max(0, count - 1 - idx)
  return { renderOffset: rank * 100, yNudge: rank * 0.02 }
}

// Which layer index (if any) plays next after `idx` finishes, in panel
// order (top of the list plays first — same order as layerDepth reads).
// -1 once the last layer in the sequence has played.
export function nextLayerIndex(count, idx) {
  return idx + 1 < count ? idx + 1 : -1
}

export function canAddLayer(count) {
  return count < MAX_LAYERS
}

let _uid = 0
const nextId = () => `gpx-layer-${++_uid}`

// ---------------------------------------------------------------- manager

export class GpxLayerManager {
  constructor({ scene, camera, terrain, params, getDem, getGrid }) {
    this.scene = scene
    this.camera = camera
    this.terrain = terrain
    this.params = params
    this.getDem = getDem
    this.getGrid = getGrid // damier de blocs voisins (block-grid.js), optionnel
    this.layers = [] // [{ id, gpx: GpxLayer, sport, name, visible }]
    this.activeIndex = -1 // focused layer — panel controls + which profile strip shows
    this.playingIndex = -1 // -1 = not sequencing

    // hooks main.js wires up — kept as plain callback slots (same shape as
    // GpxLayer's own onDone-style hooks elsewhere in this codebase) rather
    // than an event emitter, since there's exactly one subscriber (main.js).
    this.onFocusChange = null // (layer, idx) => {}
    this.onTrackStart = null // (layer, idx) => {} — fresh play() (not mid-sequence)
    this.onTrackTransition = null // (fromLayer, toLayer, idx) => {} — sequenced handover
    this.onSequenceDone = null // (lastLayer) => {}
    this.onChange = null // (layers) => {} — panel re-render hook (add/remove/reorder)

    this._transitionEl = null
    this._buildTransitionDom()
  }

  // ---------------------------------------------------------------- derived state

  get hasTrack() {
    return this.layers.some((l) => l.gpx.track)
  }
  get activeLayer() {
    return this.layers[this.activeIndex] || null
  }
  get playingLayer() {
    return this.layers[this.playingIndex] || null
  }
  // headT / world of whichever layer is DRIVING the follow-cam right now —
  // the currently-playing layer while sequencing, else the focused one (so
  // "Fly the GPX track" still has something sane to read with nothing playing)
  get headT() {
    return (this.playingLayer || this.activeLayer)?.gpx.headT ?? 0
  }
  // position monde AMORTIE de la tête de course (la sphère que l'utilisateur
  // voit) — la caméra de suivi la vise pour la garder pile au centre
  get headWorld() {
    return (this.playingLayer || this.activeLayer)?.gpx.headWorld ?? null
  }
  get currentWorld() {
    return (this.playingLayer || this.activeLayer)?.gpx.track?.world || null
  }
  get currentTrack() {
    return (this.playingLayer || this.activeLayer)?.gpx.track || null
  }
  // `track` is an alias of currentTrack — main.js's flyTrack()/follow-cam/
  // share-link code all read `gpxLayer.track` (the single-GpxLayer name);
  // keeping that exact getter name here is what lets the manager drop
  // straight into main.js's `const gpxLayer = new GpxLayerManager(...)`
  // without touching every call site that predates multi-layer support.
  get track() {
    return this.currentTrack
  }
  // the focused layer's own hover state — route-panel.js's "Name point"
  // field reads this (see setPointName() below, which routes the same way)
  get hoverIdx() {
    return this.activeLayer?.gpx.hoverIdx ?? -1
  }
  // the focused layer's race name (task 22 §7) — the Route panel's
  // race-name field both reads (this getter) and writes (setRaceName()
  // below) through the manager the same way it already does for
  // hoverIdx/setPointName, so the field always reflects whichever layer is
  // focused.
  get raceName() {
    return this.activeLayer?.gpx.raceName ?? ''
  }

  // ---------------------------------------------------------------- add / remove / reorder

  // Parses `text`, adds it as a new top-of-stack layer (cap MAX_LAYERS).
  // Returns the new layer entry, or null (cap reached / unparsable — caller
  // decides how to announce either). This is what BOTH "Load GPX…" and drag
  // & drop now do — a single GPX file is simply the first layer.
  addLayer(text, { sport = null } = {}) {
    if (!canAddLayer(this.layers.length)) return null
    const { points, name } = parseGpx(text)
    const gpx = new GpxLayer({ scene: this.scene, camera: this.camera, terrain: this.terrain, params: this.params, getDem: this.getDem, getGrid: this.getGrid })
    gpx.onCleared = () => this.onTrackCleared?.(this) // ✕ du profil → main.js resynchronise le damier
    gpx.setTrack(points, name)
    const entry = { id: nextId(), gpx, sport: sport || getSport(null).key, name, visible: true }
    this.layers.push(entry)
    this._applyDepths()
    this.focus(entry.id)
    this._syncIcons()
    this.onChange?.(this.layers)
    return entry
  }

  removeLayer(id) {
    const i = this.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    const [entry] = this.layers.splice(i, 1)
    entry.gpx.clear()
    if (this.playingIndex === i) this.playingIndex = -1
    else if (this.playingIndex > i) this.playingIndex--
    this._applyDepths()
    if (this.activeIndex >= this.layers.length) this.activeIndex = this.layers.length - 1
    if (this.activeIndex >= 0) this.focus(this.layers[this.activeIndex].id)
    else this._syncProfileVisibility()
    this.onChange?.(this.layers)
  }

  // Drag/drop reorder from the panel — `fromIndex`/`toIndex` are panel-list
  // positions (see reorderArray above). Re-applies stacking depth so render
  // order AND (once sequencing) playback order both follow the new list —
  // one list, one meaning, per the brief's own "comme dans Figma" framing.
  reorder(fromIndex, toIndex) {
    const activeId = this.activeLayer?.id
    this.layers = reorderArray(this.layers, fromIndex, toIndex)
    this._applyDepths()
    if (activeId) this.activeIndex = this.layers.findIndex((l) => l.id === activeId)
    this.onChange?.(this.layers)
  }

  _applyDepths() {
    const count = this.layers.length
    this.layers.forEach((l, idx) => {
      const { renderOffset, yNudge } = layerDepth(idx, count)
      l.gpx.setRenderDepth(renderOffset, yNudge)
    })
  }

  // ---------------------------------------------------------------- focus / chrome

  // Which layer's controls (panel) + profile strip (bottom-centre) are
  // showing. Playback moves focus itself as the sequence advances (see
  // tick()) so the visible profile always matches whichever leg is running.
  focus(id) {
    const i = this.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    this.activeIndex = i
    this._syncProfileVisibility()
    this.onFocusChange?.(this.layers[i], i)
  }

  _syncProfileVisibility() {
    this.layers.forEach((l, idx) => {
      const show = idx === this.activeIndex && l.visible && !!l.gpx.track
      l.gpx.profileEl.classList.toggle('hidden', !show)
    })
  }

  setName(id, name) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    l.name = (name || '').trim().slice(0, 40) || l.gpx.track?.name || 'Track'
    this.onChange?.(this.layers)
  }

  setLayerVisible(id, v) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    l.visible = v
    l.gpx.setVisible(v)
    this._syncProfileVisibility()
    this.onChange?.(this.layers)
  }

  setSport(id, sportKey) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    l.sport = getSport(sportKey).key
    l.customIconTex = null
    this._syncIcons()
    this.onChange?.(this.layers)
  }

  // A custom uploaded icon (task 22 §3) — `tex` is a ready THREE.Texture the
  // caller built (see sport-icons.js's rasterizeToCanvas + main.js's upload
  // wiring); this manager only stores/applies it, never fetches or decodes.
  setCustomIcon(id, tex) {
    const l = this.layers.find((x) => x.id === id)
    if (!l) return
    l.customIconTex = tex
    this._syncIcons()
    this.onChange?.(this.layers)
  }

  _syncIcons() {
    for (const l of this.layers) l.gpx.setIcon(l.customIconTex || this._defaultIconTex?.(l.sport) || null)
  }
  // main.js supplies the default-sport → texture lookup (cached, built once
  // per sport key) since it needs a live GL context this module doesn't own.
  setDefaultIconResolver(fn) {
    this._defaultIconTex = fn
    this._syncIcons()
  }

  // ---------------------------------------------------------------- global style passthrough
  // Every one of these fans out to ALL layers — see the file header for why
  // style stays global instead of per-layer.

  rebuildAll() {
    for (const l of this.layers) l.gpx.rebuild()
  }
  setVisible(v) {
    for (const l of this.layers) l.gpx.setVisible(v && l.visible)
    this._syncProfileVisibility()
  }
  onResize(w, h) {
    for (const l of this.layers) l.gpx.onResize(w, h)
  }
  pointerMove(ndc, x, y) {
    // Routed to the focused layer only — the common case (one track being
    // inspected at a time). A documented simplification, not an oversight:
    // hovering a non-focused layer's line shows no tooltip until it's
    // selected in the panel (see the task-22 report).
    this.activeLayer?.gpx.pointerMove(ndc, x, y)
  }
  setHoverClear() {
    for (const l of this.layers) l.gpx.setHover(-1, false)
  }
  setColor(v) {
    for (const l of this.layers) l.gpx.setColor(v)
  }
  setWidth(v) {
    for (const l of this.layers) l.gpx.setWidth(v)
  }
  setGradient(on, mode) {
    for (const l of this.layers) l.gpx.setGradient(on, mode)
  }
  setGlow(v) {
    for (const l of this.layers) l.gpx.setGlow(v)
  }
  setMarkers(v) {
    for (const l of this.layers) l.gpx.setMarkers(v)
  }
  setArchColor(v) {
    for (const l of this.layers) l.gpx.setArchColor(v)
  }
  setKm(v) {
    for (const l of this.layers) l.gpx.setKm(v)
  }
  setAltReadout(v) {
    for (const l of this.layers) l.gpx.setAltReadout(v)
  }
  setSlopeReadout(v) {
    for (const l of this.layers) l.gpx.setSlopeReadout(v)
  }
  setPointName(index, name) {
    this.activeLayer?.gpx.setPointName(index, name)
  }
  setRaceName(name) {
    this.activeLayer?.gpx.setRaceName(name)
    this.onChange?.(this.layers) // panel row label may read the race name too
  }

  // ---------------------------------------------------------------- sequenced playback
  // "Lorsque le tracé 1 est terminé, on a une indication qu'on change de
  // tracé, et on enchaine sur le tracé 2." — task 22 §5.

  isPlaying() {
    return this.playingIndex !== -1 && !!this.playingLayer?.gpx.isPlaying()
  }

  play() {
    if (!this.layers.length) return
    if (this.playingIndex === -1) {
      this.playingIndex = this.activeIndex >= 0 ? this.activeIndex : 0
      this.focus(this.layers[this.playingIndex].id)
    }
    const layer = this.playingLayer
    if (!layer) return
    layer.gpx.play()
    this.onTrackStart?.(layer, this.playingIndex)
  }

  pause() {
    this.playingLayer?.gpx.pause()
  }

  stop() {
    for (const l of this.layers) l.gpx.stop()
    this.playingIndex = -1
  }

  // Drives whichever layer is currently playing, and detects the "just
  // finished" edge (isPlaying() true -> false after tick(), same edge
  // gpx.js's own tick() uses to auto-pause at headT>=1) to advance the
  // sequence: show the quiet transition indicator, hand focus + play() to
  // the next layer, and fire onTrackTransition so main.js can re-seat the
  // follow camera on the NEW track's own spine (drone.start(), not a
  // continued update — see the task-22 report for the measured handover).
  tick(dt) {
    if (this.playingIndex === -1) return
    const layer = this.playingLayer
    if (!layer) {
      this.playingIndex = -1
      return
    }
    const wasPlaying = layer.gpx.isPlaying()
    layer.gpx.tick(dt)
    if (wasPlaying && !layer.gpx.isPlaying()) {
      const next = nextLayerIndex(this.layers.length, this.playingIndex)
      if (next === -1) {
        this.playingIndex = -1
        this.onSequenceDone?.(layer)
        return
      }
      const nextLayer = this.layers[next]
      this._showTransition(layer.name || layer.gpx.track?.name, nextLayer.name || nextLayer.gpx.track?.name)
      this.playingIndex = next
      this.focus(nextLayer.id)
      nextLayer.gpx.play()
      this.onTrackTransition?.(layer, nextLayer, next)
    }
  }

  // ---------------------------------------------------------------- transition DOM

  // A single quiet, editorial crossfade line — no popup, no modal, matching
  // the brief's own "une indication" (an indication, not an interruption).
  // Styled in style.css (.gpx-transition) next to gpx.js's own DOM classes.
  _buildTransitionDom() {
    const el = document.createElement('div')
    el.className = 'gpx-transition hidden'
    el.innerHTML = '<span class="gpx-transition-label"></span>'
    document.body.appendChild(el)
    this._transitionEl = el
  }
  _showTransition(fromName, toName) {
    const el = this._transitionEl
    if (!el) return
    el.querySelector('.gpx-transition-label').textContent = `${(fromName || 'LEG').toUpperCase()} COMPLETE — NEXT: ${(toName || 'LEG').toUpperCase()}`
    el.classList.remove('hidden')
    el.classList.add('show')
    clearTimeout(this._transitionTimer)
    this._transitionTimer = setTimeout(() => el.classList.remove('show'), 2200)
  }

  // ---------------------------------------------------------------- lifecycle

  clearAll() {
    for (const l of this.layers) l.gpx.clear()
    this.layers = []
    this.activeIndex = -1
    this.playingIndex = -1
    this.onChange?.(this.layers)
  }
}
