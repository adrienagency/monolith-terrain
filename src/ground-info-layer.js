// The cartouche laid out on the ground around the slab: a compass rose, the
// place name, coordinates, elevation range and a short description — canvas
// textures on planes lying flat on the base, north-up like a printed map
// sheet. Rebuilt whenever a zone loads. Visible in surface mode only.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { gatherGroundInfo } from './ground-info.js'

const HALF = TERRAIN_SIZE / 2

// draw text lines onto a transparent canvas and return {canvas, w, h}
function textCanvas(lines, { font = 600, px = 44, gap = 1.35, align = 'left', color = '#222', track = 0.08 }) {
  const pad = 16
  const scratch = document.createElement('canvas').getContext('2d')
  const fam = `${font} ${px}px "SF Mono", "Fira Code", ui-monospace, monospace`
  scratch.font = fam
  const measure = (t) => scratch.measureText(t).width + t.length * px * track
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
    let x = pad
    if (align === 'center') x = c.width / 2 - measure(t) / 2
    // manual letter-spacing for the survey-plate feel
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
  _addPlane(canvas, x, z, worldW) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const worldH = (worldW * canvas.height) / canvas.width
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    )
    mesh.rotation.x = -Math.PI / 2 // lie flat, canvas-top toward -z (north)
    mesh.position.set(x, (this.getBaseY?.() ?? -8) + 0.05, z)
    mesh.renderOrder = 4
    this.group.add(mesh)
    this.meshes.push(mesh)
    return mesh
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
    const margin = HALF + 10

    // compass rose — top-right of the sheet
    this._addPlane(compassCanvas(ink), margin + 14, -margin - 2, 22)

    // title block — below the slab (south), centered. Long names shrink to the
    // fixed world width, so they never overlap the coord block below.
    const titleLines = [String(info.name || '').toUpperCase()]
    if (info.country) titleLines.push(info.country.toUpperCase())
    this._addPlane(textCanvas(titleLines, { px: 52, align: 'center', color: ink, track: 0.16 }).canvas, 0, margin + 7, 46)
    this._addPlane(
      textCanvas([info.coord, info.coordDMS].filter(Boolean), { px: 30, align: 'center', color: ink, track: 0.12 })
        .canvas,
      0,
      margin + 26,
      40
    )

    // elevation + a real scale bar — top-left
    const statLines = [info.elevation, info.scale].filter(Boolean)
    if (statLines.length) {
      this._addPlane(textCanvas(statLines, { px: 28, color: ink, track: 0.1 }).canvas, -margin - 6, -margin, 40)
    }

    // description — down the left side, wrapped
    if (info.description) this._addWrapped(info.description, -margin - 8, margin - 8, { px: 26, font: 400, max: 8 })

    // anecdote — a distinct note on the right side, marked with a ◆
    if (info.anecdote) this._addWrapped(`◆ ${info.anecdote}`, margin + 10, margin - 8, { px: 25, font: 400, max: 7 })
  }

  // wrap a paragraph to ~34 chars/line and lay it flat at (x, z)
  _addWrapped(text, x, z, { px, font, max }) {
    const ink = this.getInk?.() || '#222'
    const words = text.split(' ')
    const lines = []
    let cur = ''
    for (const w of words) {
      if ((cur + w).length > 34) {
        lines.push(cur.trim())
        cur = ''
      }
      cur += w + ' '
    }
    if (cur.trim()) lines.push(cur.trim())
    this._addPlane(textCanvas(lines.slice(0, max), { px, font, color: ink, track: 0.05 }).canvas, x, z, 42)
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
