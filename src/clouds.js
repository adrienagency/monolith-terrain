// Sparse volumetric-style clouds: a handful of soft puff clusters drifting
// slowly over the patch, each throwing a gentle blob shadow that hugs the
// relief. Deliberately discreet — the map stays the hero.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { mulberry32 } from './noise.js'

function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.42)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class Clouds {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'clouds'
    scene.add(this.group)
    this.tex = puffTexture()
    this.clouds = []
    this.build(params)
  }

  build(params) {
    this._dispose()
    if (!params.cloudsEnabled) return
    const rng = mulberry32((params.seed ?? 7) * 31 + 5)
    const half = TERRAIN_SIZE / 2 - 4
    for (let i = 0; i < params.cloudCount; i++) {
      const cx = (rng() * 2 - 1) * half
      const cz = (rng() * 2 - 1) * half
      const size = 2.2 + rng() * 2.6
      const cloud = new THREE.Group()
      const nPuffs = 4 + Math.floor(rng() * 4)
      for (let p = 0; p < nPuffs; p++) {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.tex,
            transparent: true,
            depthWrite: false,
            opacity: (0.4 + rng() * 0.35) * params.cloudOpacity,
          })
        )
        sp.position.set((rng() * 2 - 1) * size * 0.7, (rng() * 2 - 1) * size * 0.14, (rng() * 2 - 1) * size * 0.42)
        const s = size * (0.55 + rng() * 0.6)
        sp.scale.set(s, s * 0.42, 1)
        sp.renderOrder = 15
        cloud.add(sp)
      }
      cloud.position.set(cx, params.cloudAltitude + (rng() * 2 - 1) * 1.4, cz)

      // blob shadow draped just above the relief under the cloud
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(size * 2.4, size * 1.5),
        new THREE.MeshBasicMaterial({
          map: this.tex,
          color: 0x000000,
          transparent: true,
          depthWrite: false,
          opacity: 0.12 * params.cloudOpacity,
        })
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.renderOrder = 5

      this.group.add(cloud)
      this.group.add(shadow)
      this.clouds.push({ cloud, shadow, speed: 0.14 + rng() * 0.22, size })
    }
  }

  update(dt, params) {
    if (!params.cloudsEnabled || !this.group.visible) return
    const half = TERRAIN_SIZE / 2
    for (const c of this.clouds) {
      c.cloud.position.x += c.speed * params.cloudDrift * dt
      if (c.cloud.position.x > half + c.size * 2) {
        c.cloud.position.x = -half - c.size * 2
        c.cloud.position.z = (Math.random() * 2 - 1) * (half - 4)
      }
      const { x, z } = c.cloud.position
      c.shadow.position.set(
        x,
        Math.abs(x) < half && Math.abs(z) < half ? this.terrain.sample(x, z) + 0.14 : 0.14,
        z
      )
      c.shadow.material.opacity = 0.12 * params.cloudOpacity
    }
  }

  // the soft puff sprites are unlit billboards — the sun direction doesn't
  // affect them, but the app calls this when the sun moves, so accept it.
  setSunDir() {}

  setVisible(v) {
    this.group.visible = v
  }

  _dispose() {
    for (const c of this.clouds) {
      c.cloud.children.forEach((sp) => sp.material.dispose())
      this.group.remove(c.cloud)
      c.shadow.geometry.dispose()
      c.shadow.material.dispose()
      this.group.remove(c.shadow)
    }
    this.clouds = []
  }
}
