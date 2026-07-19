// The sun, visible in the sky, following its own course.
//
// Placed along the SAME direction vector the DirectionalLight uses, so the
// disc you see and the light you get can never disagree — one is literally
// aimed by the other (see main.js placeSun).
//
// Two behaviours the brief asks for, both keyed on true solar elevation:
//   * it DROWNS in the distance near the horizon — a real low sun reddens and
//     dims through the thick air, it does not wink out at full brightness.
//   * below ground level it is simply gone. Nothing renders under the horizon.
// depthTest stays ON so a mountain in front genuinely hides it, which is what
// sells it as being out there in the world rather than pasted on the lens.

import * as THREE from 'three'

// Far enough to read as celestial, comfortably inside camera.far (220) so it
// never gets clipped away at the exact moment it matters.
const DISTANCE = 150

// Elevation band (degrees) over which the disc fades in from the horizon.
// Below 0 it is hidden outright; by ~8 deg it is at full strength.
const FADE_TOP = 8

// How visible the disc is at a given solar elevation, 0..1. Pure — exported so
// the horizon behaviour is testable without a GPU.
export function discOpacityFor(elevationDeg) {
  if (!Number.isFinite(elevationDeg) || elevationDeg <= 0) return 0
  return Math.min(1, elevationDeg / FADE_TOP)
}

// Radial glow sprite: a hot core easing out to nothing. Drawn once into a
// canvas rather than shipped as an image — it is four stops of a gradient.
function discTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  // OPAQUE warm core, not a white one. ShibuMap's default sky is near-white
  // paper, and an additive white sun over near-white paper adds nothing — it
  // was measured invisible. A solid warm disc reads on a pale sky AND on a
  // dark one, so the stops carry real colour and alpha rather than brightness.
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0.0, 'rgba(255,252,238,1)')
  g.addColorStop(0.15, 'rgba(255,233,178,1)') // the disc's own edge — solid
  g.addColorStop(0.24, 'rgba(255,203,122,0.62)') // rim falls off fast
  g.addColorStop(0.45, 'rgba(252,178,108,0.20)') // near glow
  g.addColorStop(0.72, 'rgba(246,163,104,0.06)') // far halo
  g.addColorStop(1.0, 'rgba(246,160,100,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class SunDisc {
  constructor(scene) {
    this.texture = discTexture()
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true, // a ridge in front must hide it
      blending: THREE.NormalBlending, // see discTexture: additive vanishes on a pale sky
      fog: false, // scene fog is a depth cue for the RELIEF; the sun is beyond it
      opacity: 0,
    })
    this.sprite = new THREE.Sprite(this.material)
    this.sprite.scale.setScalar(15)
    this.sprite.visible = false
    this.sprite.renderOrder = 5 // behind the map overlays, in front of the sky
    scene.add(this.sprite)
  }

  // `dir` is the light's own position vector (direction from the scene to the
  // sun); `colorHex` and `elevationDeg` come from the day cycle.
  update(dir, colorHex, elevationDeg) {
    const opacity = discOpacityFor(elevationDeg)
    this.sprite.visible = opacity > 0.001
    if (!this.sprite.visible) return
    this.material.opacity = opacity
    // Low sun reads warmer AND smaller-but-hazier; high sun is a tight white
    // point. Scaling with the fade is what makes it "drown" rather than blink.
    this.material.color.set(colorHex)
    this.sprite.scale.setScalar(13 + 9 * (1 - opacity)) // swells and hazes as it sinks
    this.sprite.position.copy(dir).setLength(DISTANCE)
  }

  setVisible(v) {
    this.sprite.visible = v && this.material.opacity > 0.001
  }

  dispose() {
    this.texture.dispose()
    this.material.dispose()
    this.sprite.removeFromParent()
  }
}
