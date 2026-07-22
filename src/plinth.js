// The relief sits on a solid slab — walls drop from the terrain's border down
// to a base, a bottom cap closes it, and a wide neutral table beneath catches
// the slab's shadow. Turns the floating map into a physical object the moment
// its edges come into view (see the museum-relief references).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { PBR_BY_ID, GLASS_BY_ID } from './material-presets.js'
import { TEXTURE_BUILDERS } from './material-textures.js'

const HALF = TERRAIN_SIZE / 2
const UVSCALE = 6 // world units per texture tile on the socle walls
const INTERIOR_STEPS = 12 // coarse grid to find the global min (basin guard)

// Pure: sample the border ring and pick a base level. `samples` per side should
// match the terrain mesh resolution so the wall top sits EXACTLY on the relief
// border — a coarser ring leaves gaps you can see the underside through. baseY
// sits `depth` below the LOWEST point anywhere on the patch (not just the
// border) so a deep interior basin can never pierce the base plane. Tested.
export function computeSlab(sample, depth, samples = 256, cornerRadius = 0, cornerExp = 2) {
  const n = Math.max(8, Math.round(samples))
  const r = Math.max(0, Math.min(cornerRadius, HALF - 1))
  const expo = Math.max(2, cornerExp) // superellipse exponent (2 = circle)
  let borderMin = Infinity
  let globalMin = Infinity
  const ring = [] // clockwise from the -x/-z corner
  const edge = (x, z) => {
    const y = sample(x, z)
    if (y < borderMin) borderMin = y
    if (y < globalMin) globalMin = y
    ring.push({ x, z, y })
  }
  if (r === 0) {
    // square footprint (default): 4 sides × n samples, exactly on the mesh grid
    for (let i = 0; i < n; i++) edge(-HALF + (TERRAIN_SIZE * i) / n, -HALF)
    for (let i = 0; i < n; i++) edge(HALF, -HALF + (TERRAIN_SIZE * i) / n)
    for (let i = 0; i < n; i++) edge(HALF - (TERRAIN_SIZE * i) / n, HALF)
    for (let i = 0; i < n; i++) edge(-HALF, HALF - (TERRAIN_SIZE * i) / n)
  } else {
    // rounded-rectangle footprint: straight runs on the mesh grid spacing, with
    // a quarter-circle arc filleting each of the four salient vertical corners.
    // Traces the same clockwise perimeter so the wall builder is unchanged.
    const inner = HALF - r
    const step = TERRAIN_SIZE / n
    const straightN = Math.max(1, Math.round((inner * 2) / step))
    const arcN = Math.max(3, Math.round(n / 48))
    const line = (x0, z0, x1, z1) => {
      for (let i = 0; i < straightN; i++) {
        const t = i / straightN
        edge(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
      }
    }
    // superellipse corner: point = center + r·(sgn·|cos|^(2/n), sgn·|sin|^(2/n)).
    // n=2 reduces to a circular arc; higher n bulges toward a squircle. Matches
    // the terrain shader's p-norm clip so the map edge and wall stay aligned.
    const arc = (cx, cz, a0, a1) => {
      for (let i = 0; i < arcN; i++) {
        const a = a0 + ((a1 - a0) * i) / arcN
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const ex = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / expo) * r
        const ez = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / expo) * r
        edge(cx + ex, cz + ez)
      }
    }
    line(-inner, -HALF, inner, -HALF) //  top edge   (z=-HALF)
    arc(inner, -inner, -Math.PI / 2, 0) //  corner +x −z
    line(HALF, -inner, HALF, inner) //  right edge  (x=+HALF)
    arc(inner, inner, 0, Math.PI / 2) //  corner +x +z
    line(inner, HALF, -inner, HALF) //  bottom edge (z=+HALF)
    arc(-inner, inner, Math.PI / 2, Math.PI) //  corner −x +z
    line(-HALF, inner, -HALF, -inner) //  left edge   (x=−HALF)
    arc(-inner, -inner, Math.PI, Math.PI * 1.5) //  corner −x −z
  }
  // coarse interior sweep for the global minimum
  for (let j = 1; j < INTERIOR_STEPS; j++) {
    for (let i = 1; i < INTERIOR_STEPS; i++) {
      const y = sample(-HALF + (TERRAIN_SIZE * i) / INTERIOR_STEPS, -HALF + (TERRAIN_SIZE * j) / INTERIOR_STEPS)
      if (y < globalMin) globalMin = y
    }
  }
  return { ring, borderMin, globalMin, baseY: globalMin - depth }
}

// Build the slab wall + bottom-cap geometry for a relief `sample`. Pure and
// self-contained (extracted from Plinth.rebuild so the block-grid neighbours
// get the EXACT same socle). `baseYFloor` (optional) forces the base level no
// higher than this — the damier shares the main block's baseY for a flat grid
// bottom without ever piercing a deeper neighbour's relief.
export function buildSlabWalls(sample, { depth = 7, resolution = 256, cornerR = 0, cornerExp = 2, baseYFloor = null } = {}) {
  const slab = computeSlab(sample, depth, resolution, cornerR, cornerExp)
  const ring = slab.ring
  const baseY = baseYFloor != null ? Math.min(baseYFloor, slab.baseY) : slab.baseY
  const n = ring.length
  const positions = []
  const normals = []
  const uvs = []
  const pushTri = (a, b, c, uva, uvb, uvc) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(c, a)
    const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
    const tri = [[a, uva], [b, uvb], [c, uvc]]
    for (const [v, uv] of tri) {
      positions.push(v.x, v.y, v.z)
      normals.push(nm.x, nm.y, nm.z)
      uvs.push(uv[0], uv[1])
    }
  }
  let acc = 0
  for (let i = 0; i < n; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % n]
    const segLen = Math.hypot(q.x - p.x, q.z - p.z)
    const u0 = acc / UVSCALE
    const u1 = (acc + segLen) / UVSCALE
    acc += segLen
    const vpTop = (p.y - baseY) / UVSCALE
    const vqTop = (q.y - baseY) / UVSCALE
    const pTop = new THREE.Vector3(p.x, p.y, p.z)
    const qTop = new THREE.Vector3(q.x, q.y, q.z)
    const pBot = new THREE.Vector3(p.x, baseY, p.z)
    const qBot = new THREE.Vector3(q.x, baseY, q.z)
    pushTri(pTop, pBot, qTop, [u0, vpTop], [u0, 0], [u1, vqTop])
    pushTri(qTop, pBot, qBot, [u1, vqTop], [u0, 0], [u1, 0])
  }
  const cen = new THREE.Vector3(0, baseY, 0)
  const capUv = (x, z) => [x / UVSCALE, z / UVSCALE]
  for (let i = 0; i < n; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % n]
    pushTri(cen, new THREE.Vector3(q.x, baseY, q.z), new THREE.Vector3(p.x, baseY, p.z), capUv(0, 0), capUv(q.x, q.z), capUv(p.x, p.z))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeBoundingSphere()
  return { geo, baseY }
}

export class Plinth {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'plinth'
    scene.add(this.group)

    // slab walls + bottom: a matte stone edge, lit by the scene sun so the cut
    // face reads as thickness. DoubleSide so no viewing angle ever sees through
    // the slab into a culled back face (the "underside" bug).
    // MeshPhysicalMaterial so the same slab can be a matte stone, a polished
    // metal, OR real transmissive glass (transmission/ior/thickness) depending
    // on the preset the user gives it in the Block panel.
    this.wallMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.plinthColor ?? '#d8d4cc'),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    this.isGlass = false
    this.walls = new THREE.Mesh(new THREE.BufferGeometry(), this.wallMat)
    this.walls.castShadow = true
    this.walls.receiveShadow = true
    this.group.add(this.walls)

    // the table: a wide plane that shows ONLY the slab's cast shadow. A
    // ShadowMaterial is transparent everywhere else, so the ground reads as the
    // exact scene background color — no grey mismatch, just the shadow.
    this.baseMat = new THREE.ShadowMaterial({ opacity: 0.26 })
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 3.4, TERRAIN_SIZE * 3.4), this.baseMat)
    this.base.rotation.x = -Math.PI / 2
    this.base.receiveShadow = true
    this.group.add(this.base)

    // OPAQUE studio floor — shown ONLY when an HDRI sky is active (Adrien : « le
    // sol disparaît avec un HDRI »). With a solid/gradient backdrop the shadow
    // base above already reads as the ground (it shows the background through
    // its transparency) ; but an HDRI wraps a sky panorama all around, so without
    // this the socle floats in the sky. It's a LIT MeshStandard, so it follows
    // the day/night cycle on its own. When it's on, the shadow base is hidden so
    // the shadow isn't doubled — this ground receives it directly.
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.96, metalness: 0 })
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 3.4, TERRAIN_SIZE * 3.4), this.groundMat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.ground.visible = false
    this.group.add(this.ground)

    // glass ground-pool: light through a coloured glass casts a coloured shadow
    // on the table. three's transmission can't tint the shadow, so we paint the
    // glass colour into a rounded-rect glow (matching the block footprint) and
    // MULTIPLY it onto the ground — which reads as a coloured shadow that is
    // strong on a light table and fades on a dark one, exactly like real glass.
    this._poolCanvas = document.createElement('canvas')
    this._poolCanvas.width = this._poolCanvas.height = 256
    this._paintGlassPool('#ffffff', 0)
    this.glassPoolTex = new THREE.CanvasTexture(this._poolCanvas)
    this.glassPoolMat = new THREE.MeshBasicMaterial({
      map: this.glassPoolTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending, // coloured shadow: white table × tint = tint
    })
    this.glassPool = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 1.08, TERRAIN_SIZE * 1.08), this.glassPoolMat)
    this.glassPool.rotation.x = -Math.PI / 2
    this.glassPool.renderOrder = 1
    this.glassPool.visible = false
    this.group.add(this.glassPool)

    this.depth = params.plinthDepth ?? 7
  }

  // Paint the ground-pool: a rounded-rect glow whose centre is the glass colour
  // (lerped from white by `strength`) fading to white at the edges. Multiplied
  // onto the table it becomes a coloured shadow — strong on light, faint on dark.
  _paintGlassPool(hex, strength) {
    const s = Math.max(0, Math.min(1, strength))
    const gc = this._poolCanvas.getContext('2d')
    gc.clearRect(0, 0, 256, 256)
    gc.fillStyle = '#ffffff' // white = multiply no-op → bare table
    gc.fillRect(0, 0, 256, 256)
    if (s <= 0.001) return
    const c = new THREE.Color(hex)
    const ch = (v) => Math.round(255 * (1 - s * (1 - v)))
    gc.save()
    gc.beginPath()
    gc.roundRect(24, 24, 208, 208, 48) // rounded footprint, follows the block
    gc.clip()
    const grad = gc.createRadialGradient(128, 128, 20, 128, 128, 150)
    grad.addColorStop(0, `rgb(${ch(c.r)},${ch(c.g)},${ch(c.b)})`)
    grad.addColorStop(0.6, `rgb(${ch(0.5 + c.r * 0.5)},${ch(0.5 + c.g * 0.5)},${ch(0.5 + c.b * 0.5)})`)
    grad.addColorStop(1, '#ffffff')
    gc.fillStyle = grad
    gc.fillRect(0, 0, 256, 256)
    gc.restore()
  }

  // Apply a socle material. `finish` is 'solid' (PBR presets) or 'glass'
  // (transmissive presets). `diffusion`/`projection` are the live glass sliders
  // (frost roughness, ground-pool strength); undefined = use the preset value.
  setMaterial({ finish = 'solid', id, diffusion, projection = 0.5, glassBump = 0.6, bump = 1.3, fallbackColor = '#d8d4cc' } = {}) {
    const m = this.wallMat
    if (finish === 'glass') {
      const p = GLASS_BY_ID[id] || GLASS_BY_ID.clear
      this.isGlass = true
      this._pbrColored = false
      const diff = diffusion == null ? p.diffusion : diffusion
      // Frosted/diffuse glass driven by a micro-facet NORMAL map rather than raw
      // transmission roughness (which mip-blurs into chunky artefacts). A capped
      // roughness gives a soft blur; the frost bump does the real scattering, so
      // it reads grainy and diffuse without the visual bugs.
      const frost = TEXTURE_BUILDERS.frost()
      m.color.set('#ffffff') // clear base; the tint rides on attenuation
      m.map = null
      m.normalMap = frost.normalMap
      m.roughnessMap = frost.roughnessMap
      m.normalScale.set(glassBump, glassBump)
      m.metalness = 0
      m.roughness = Math.min(0.06 + diff * 0.34, 0.42) // capped — no chunky mip blur
      m.transmission = p.transmission
      m.ior = p.ior
      m.thickness = p.thickness
      m.attenuationColor.set(p.color)
      m.attenuationDistance = p.attenuation
      m.clearcoat = 0
      m.anisotropy = 0
      m.specularIntensity = 1
      m.transparent = true
      m.envMapIntensity = 1.4
      this._paintGlassPool(p.color, projection)
      this.glassPoolTex.needsUpdate = true
      this._poolStrength = projection
      this.glassPool.visible = this.group.visible && projection > 0.001
    } else {
      const p = PBR_BY_ID[id] || { color: fallbackColor, roughness: 0.95, metalness: 0 }
      this.isGlass = false
      // a real PBR preset owns the wall colour — the dark-mode/edge-colour reset
      // in setColors must not clobber it (only the plain default 'stone' takes it)
      this._pbrColored = !!(id && id !== 'stone')
      m.color.set(p.color)
      m.metalness = p.metalness ?? 0
      m.roughness = p.roughness ?? 0.9
      m.transmission = 0
      m.thickness = 0
      m.attenuationDistance = Infinity
      m.clearcoat = p.clearcoat ?? 0
      m.clearcoatRoughness = p.clearcoatRoughness ?? 0
      m.ior = p.ior ?? 1.5
      m.transparent = false
      m.envMapIntensity = p.envMapIntensity ?? 1
      // textured finishes (carbon, wood): albedo + normal + roughness maps; the
      // bump slider drives normalScale (exaggerated relief)
      const build = p.tex && TEXTURE_BUILDERS[p.tex]
      if (build) {
        const t = build()
        m.map = t.map ?? null
        m.normalMap = t.normalMap
        m.roughnessMap = t.roughnessMap
        const b = bump * (p.normalScale ?? 1)
        m.normalScale.set(b, b)
        m.anisotropy = p.anisotropy ?? 0
        m.anisotropyRotation = p.anisotropyRotation ?? 0
      } else {
        this._clearMaps()
        m.normalScale.set(1, 1)
        m.anisotropy = p.anisotropy ?? 0
        m.anisotropyRotation = 0
      }
      this.glassPool.visible = false
      this._poolStrength = 0
    }
    m.needsUpdate = true
  }

  _clearMaps() {
    const m = this.wallMat
    m.map = null
    m.normalMap = null
    m.roughnessMap = null
  }

  // give the socle walls their own studio env map (overrides scene.environment
  // for this material only, so metals/glass/carbon get punchy reflections while
  // the terrain keeps the neutral room env)
  setEnvMap(tex) {
    this.wallMat.envMap = tex
    this.wallMat.needsUpdate = true
  }

  // rebuild the walls to hug the current relief border; call after every
  // terrain rebuild (the heightfield changed)
  rebuild(terrain, params) {
    const sample = terrain.sample
    if (!sample) return
    this.depth = params.plinthDepth ?? this.depth

    // match the wall ring to the terrain mesh edge resolution so the top of the
    // walls lands exactly on the relief border (no gaps → no visible underside).
    // The corner radius rounds the four salient vertical edges; the terrain
    // shader clips to the SAME rounded rectangle so nothing overhangs the walls.
    // v42: meme formule que le clip de la mer (rayon clampe, cercle)
    const cornerR = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE))
    const { geo, baseY } = buildSlabWalls(sample, { depth: this.depth, resolution: params.resolution ?? 256, cornerR, cornerExp: 2 })
    this.baseY = baseY
    this.base.position.y = baseY
    this.ground.position.y = baseY - 0.02 // opaque floor just under the shadow base
    this.glassPool.position.y = baseY + 0.05 // glass colour pools just over the table
    this.walls.geometry.dispose()
    this.walls.geometry = geo
  }

  setColors(params) {
    // glass keeps its clear white base (tint rides on attenuation), and a real
    // PBR preset keeps its own colour — only the plain default socle takes the
    // edge/dark-mode colour.
    if (!this.isGlass && !this._pbrColored) this.wallMat.color.set(params.plinthColor ?? '#d8d4cc')
    // the table is a ShadowMaterial (no color — it only darkens the background
    // where the shadow lands); the dark sheet reads a touch stronger
    this.baseMat.opacity = params.darkMode ? 0.34 : 0.24
  }

  setVisible(v) {
    this.group.visible = v
    this.glassPool.visible = v && this.isGlass && (this._poolStrength ?? 0) > 0.001
  }

  // opaque floor: on with an HDRI (keeps a ground under the socle), off with a
  // solid/gradient backdrop (the shadow base already reads as the ground). When
  // it's on, hide the shadow base so the cast shadow isn't doubled.
  setGroundVisible(v) {
    this.ground.visible = !!v
    this.base.visible = !v
  }
  setGroundColor(hex) {
    if (hex) this.groundMat.color.set(hex)
  }
}
