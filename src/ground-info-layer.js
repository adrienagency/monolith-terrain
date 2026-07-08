// The cartouche laid out on the ground around the slab: a compass rose, the
// place name, coordinates, elevation range and a short description — canvas
// textures on planes lying flat on the base, north-up like a printed map
// sheet. Rebuilt whenever a zone loads. Visible in surface mode only.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { gatherGroundInfo } from './ground-info.js'

const HALF = TERRAIN_SIZE / 2
const GAP = 6 // clear safety ring: no text ever touches the slab edge

// the two cartouche typefaces (loaded from Google Fonts in index.html)
const TITLE_FONT = 'Rosarivo, Georgia, serif'
const BODY_FONT = '"Bricolage Grotesque", "Helvetica Neue", sans-serif'

// #rrggbb → rgba() at the given opacity
function inkRGBA(hex, a) {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// draw text lines onto a transparent canvas. `align`: left | center | right
// (right/left flush the text toward the slab). Returns {canvas, w, h}.
function textCanvas(lines, { family = BODY_FONT, weight = 400, px = 40, gap = 1.4, align = 'left', color = '#222', track = 0.04 }) {
  const pad = 18
  const scratch = document.createElement('canvas').getContext('2d')
  const fam = `${weight} ${px}px ${family}`
  scratch.font = fam
  const measure = (t) => scratch.measureText(t).width + Math.max(0, t.length - 1) * px * track
  const wText = Math.max(1, ...lines.map(measure))
  const lineH = px * gap
  const c = document.createElement('canvas')
  c.width = Math.ceil(wText + pad * 2)
  c.height = Math.ceil(lineH * lines.length + pad * 2)
  const ctx = c.getContext('2d')
  ctx.font = fam
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  lines.forEach((t, i) => {
    const w = measure(t)
    let x = pad // left: flush left
    if (align === 'center') x = c.width / 2 - w / 2
    else if (align === 'right') x = c.width - pad - w // right: flush toward the slab
    let cx = x
    for (const ch of t) {
      ctx.fillText(ch, cx, pad + i * lineH)
      cx += ctx.measureText(ch).width + px * track
    }
  })
  return { canvas: c, w: c.width, h: c.height }
}

function compassCanvas(color) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const cx = S / 2
  const r = S * 0.4
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cx, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cx, r * 0.82, 0, Math.PI * 2)
  ctx.globalAlpha = 0.5
  ctx.stroke()
  ctx.globalAlpha = 1
  // ticks
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180
    const long = a % 90 === 0
    const r0 = r * (long ? 0.82 : 0.9)
    ctx.globalAlpha = long ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(rad) * r0, cx + Math.sin(rad) * r0)
    ctx.lineTo(cx + Math.cos(rad) * r, cx + Math.sin(rad) * r)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // north star (a slim compass needle)
  ctx.beginPath()
  ctx.moveTo(cx, cx - r * 0.7)
  ctx.lineTo(cx - r * 0.12, cx)
  ctx.lineTo(cx, cx + r * 0.5)
  ctx.lineTo(cx + r * 0.12, cx)
  ctx.closePath()
  ctx.stroke()
  // cardinals
  ctx.font = '600 30px "SF Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const put = (t, ang) => {
    const rad = (ang * Math.PI) / 180
    ctx.fillText(t, cx + Math.cos(rad) * r * 1.02, cx + Math.sin(rad) * r * 1.02)
  }
  put('N', -90)
  put('E', 0)
  put('S', 90)
  put('W', 180)
  return c
}

export class GroundInfoLayer {
  constructor({ scene, getBaseY, getInk }) {
    this.getBaseY = getBaseY
    this.getInk = getInk
    this.group = new THREE.Group()
    this.group.name = 'ground-info'
    scene.add(this.group)
    this.meshes = []
    this.reqId = 0
    this.lastInfo = null
    this.enabled = true
  }

  // flat plane carrying a canvas, sized so 1 world unit ≈ `scale` canvas px,
  // laid north-up on the base and placed at (x, z)
  _addPlaneAt(canvas, x, z, worldW, worldH) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    )
    mesh.rotation.x = -Math.PI / 2 // lie flat, canvas-top toward -z (north)
    mesh.position.set(x, (this.getBaseY?.() ?? -8) + 0.05, z)
    mesh.renderOrder = 4
    this.group.add(mesh)
    this.meshes.push(mesh)
  }

  // Place a block flush to the slab on `side`, its inner edge at the safety
  // margin (HALF + GAP) so nothing ever touches the slab. `near` is the block's
  // leading edge along the run of that side. Returns the trailing edge so blocks
  // stack. Text alignment matches the side: left→right-flush, right→left-flush,
  // top/bottom→centered — computed in the caller's textCanvas align.
  _place(canvas, side, near, worldW) {
    const worldH = (worldW * canvas.height) / canvas.width
    const m = HALF + GAP
    let x = 0
    let z = 0
    if (side === 'left') {
      x = -m - worldW / 2
      z = near + worldH / 2
    } else if (side === 'right') {
      x = m + worldW / 2
      z = near + worldH / 2
    } else if (side === 'bottom') {
      z = near + worldH / 2
    } else {
      // top
      z = near - worldH / 2
    }
    this._addPlaneAt(canvas, x, z, worldW, worldH)
    return side === 'top' ? near - worldH : near + worldH
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

  // lay out an info payload on the ground (called after a fetch resolves, or
  // when the ink/mode changes — see rerender)
  render(info) {
    this._clear()
    this.lastInfo = info
    if (!info || !this.enabled) return
    const ink = this.getInk?.() || '#222'
    const title = inkRGBA(ink, 0.8) // titles at 80% opacity
    const body = inkRGBA(ink, 0.6) // body text at 60%
    const m = HALF + GAP

    // TITLE + coords — below the slab (south), centered
    const titleLines = [String(info.name || '').toUpperCase()]
    if (info.country) titleLines.push(info.country.toUpperCase())
    let z = this._place(
      // Rosarivo ships a single (400) weight — draw at 400 for a true face
      // rather than a synthesized faux-bold; the px54 size carries the title
      textCanvas(titleLines, { family: TITLE_FONT, weight: 400, px: 54, align: 'center', color: title, track: 0.03 }).canvas,
      'bottom',
      m,
      50
    )
    this._place(
      textCanvas([info.coord, info.coordDMS].filter(Boolean), {
        family: BODY_FONT,
        weight: 500,
        px: 24, // secondary text 20% smaller than before (30 → 24)
        align: 'center',
        color: body,
        track: 0.08,
      }).canvas,
      'bottom',
      z + 1.5,
      40
    )

    // ELEVATION + scale — upper-left, right-flush toward the slab
    const statLines = [info.elevation, info.scale].filter(Boolean)
    if (statLines.length) {
      this._place(
        textCanvas(statLines, { family: BODY_FONT, weight: 500, px: 22, align: 'right', color: body, track: 0.06 }).canvas,
        'left',
        -m - 4,
        38
      )
    }

    // DESCRIPTION — lower-left, right-flush
    if (info.description) this._placeWrapped(info.description, 'left', 6, body, { weight: 400, px: 21 })

    // ANECDOTE — right side, left-flush, marked with a ◆
    if (info.anecdote) this._placeWrapped(`◆ ${info.anecdote}`, 'right', -m - 4, body, { weight: 400, px: 20 })

    // COMPASS ROSE — north-east corner
    const rose = compassCanvas(inkRGBA(ink, 0.72))
    this._addPlaneAt(rose, m + 12, -m - 12, 24, 24)
  }

  // wrap a paragraph and place it flush on `side`
  _placeWrapped(text, side, near, color, { weight, px }) {
    const words = text.split(' ')
    const lines = []
    let cur = ''
    for (const w of words) {
      if (cur && (cur + w).length > 32) {
        lines.push(cur.trim())
        cur = ''
      }
      cur += w + ' '
    }
    if (cur.trim()) lines.push(cur.trim())
    const align = side === 'right' ? 'left' : side === 'left' ? 'right' : 'center'
    this._place(
      textCanvas(lines.slice(0, 8), { family: BODY_FONT, weight, px, align, color, track: 0.02 }).canvas,
      side,
      near,
      40
    )
  }

  // re-lay the current info (e.g. after a dark-mode toggle changes the ink)
  rerender() {
    if (this.lastInfo) this.render(this.lastInfo)
  }

  // fetch info for a zone and lay it out when it resolves; stale requests are
  // dropped so a fast succession of zone loads never crosses wires
  async load(lat, lon, dem) {
    const id = ++this.reqId
    try {
      // ensure the cartouche fonts are ready before drawing to canvas, else the
      // first render falls back to a system face (fonts.load is a no-op once
      // cached, and rejects are swallowed so an offline load still draws)
      await Promise.allSettled([
        document.fonts?.load('400 40px Rosarivo'),
        document.fonts?.load('500 30px "Bricolage Grotesque"'),
      ])
      const info = await gatherGroundInfo({ lat, lon, dem })
      if (id !== this.reqId) return // superseded
      this.render(info)
    } catch {
      /* gatherGroundInfo never throws, but stay defensive */
    }
  }

  setVisible(v) {
    this.group.visible = v
  }
}
