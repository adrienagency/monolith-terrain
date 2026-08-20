// Banc #5b — trois questions :
//  1. le « zoom de base » depend-il de la duree de stabilisation ? (reproductibilite)
//  2. l'efficacite du frustum depend-elle de la marge d'exageration ?
//  3. le panoramique lateral : trafic et pic de `loading`, avant / apres.
import * as THREE from 'three'
import { encodeTerrarium } from './src/bathy.js'

const RGB = encodeTerrarium(812)
const PIXELS = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  PIXELS[i * 4] = RGB[0]; PIXELS[i * 4 + 1] = RGB[1]; PIXELS[i * 4 + 2] = RGB[2]; PIXELS[i * 4 + 3] = 255
}
globalThis.document = { createElement() {
  return { width: 0, height: 0, getContext: () => ({
    createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {},
    getImageData: () => ({ data: PIXELS }), set fillStyle(v) {},
  }) }
} }
globalThis.createImageBitmap = async (blob) => blob
let requetes = 0
globalThis.fetch = async (url) => {
  requetes++
  await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ tuile: url }) }
}
const { Globe, _resetTileMemo } = await import('./src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('./src/geo.js')
const ORIG = Globe.prototype._traverse
const SPH = new THREE.Sphere(new THREE.Vector3(), 1)

function traverseGardes({ frustum, marge }) {
  return function _traverse(t, camPos, camDir) {
    const toTile = t.center.clone().normalize()
    if (t.z > 2) {
      const seuil = R_GLOBE / camPos.length() - t.chord / R_GLOBE
      if (toTile.dot(camDir) < seuil) return
      if (frustum && this._frustum) {
        SPH.center.copy(t.center); SPH.radius = t.chord * 0.5 + marge
        if (!this._frustum.intersectsSphere(SPH)) return
      }
    }
    t.lastUsed = this.frame; t.coverFrame = this.frame
    const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, 1)
    const ratio = t.chord / dist
    let wantSplit = t.z < 11 && ratio > (t.refined ? 0.304 : 0.38)
    if (wantSplit && !this._enfantsPresents(t)) {
      if (this._credit < 4) wantSplit = false; else this._credit -= 4
    }
    if (wantSplit) {
      const kids = this._children(t)
      for (const k of kids) { k.lastUsed = this.frame; if (k.state === 'empty') this._request(k, ratio) }
      if (kids.every((k) => k.state === 'ready' && k.mesh)) {
        t.refined = true
        for (const k of kids) this._traverse(k, camPos, camDir)
        return
      }
    }
    t.refined = false
    if (t.state === 'ready' && t.mesh) { t.mesh.visible = true; this._drawn++ }
  }
}
function cam(lat, lon, altM, cible) {
  const alt = altM / ORBITAL_M_PER_UNIT
  const near = Math.min(Math.max(alt * 0.2, 0.01), 0.5)
  const c = new THREE.PerspectiveCamera(30, 16 / 9, near, 1400)
  latLonToSphere(lat, lon, R_GLOBE + alt, c.position)
  c.lookAt(cible ?? new THREE.Vector3(0, 0, 0))
  c.updateMatrixWorld(true); c.updateProjectionMatrix()
  return c
}
const pose = (g, c) => {
  g._frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse))
}
const zmax = (g) => { let z = 0; for (const t of g.tiles.values()) if (t.mesh?.visible && t.z > z) z = t.z; return z }
const enCharge = (g) => [...g.tiles.values()].filter((t) => t.state === 'loading').length
const LAT = 45.83, LON = 6.86

// ---- 1. reproductibilite du zoom de base en fonction du nombre d'images
console.log('--- 1. « zoom de base » (code du depot) contre duree de stabilisation, alt 8 km')
for (const n of [20, 40, 80, 160, 320, 640]) {
  Globe.prototype._traverse = ORIG
  _resetTileMemo()
  const g = new Globe({}); g.setVisible(true)
  const c = cam(LAT, LON, 8000)
  for (let i = 0; i < n; i++) { g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)) }
  const zs = []
  for (let i = 0; i < 20; i++) { g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)); zs.push(zmax(g)) }
  console.log(`   ${String(n).padStart(3)} images de chauffe → zmax sur 20 images = ${JSON.stringify([...new Set(zs)])}  dessinees=${g._drawn}  cache=${g.tiles.size}`)
  g.dispose()
}

// ---- 2. sensibilite du frustum a la marge d'exageration
console.log('--- 2. frustum : effet de la marge de deplacement (18x → 2,5 u = 159 km)')
for (const marge of [0, 0.25, 1, 2.5]) {
  for (const altM of [260000, 30000, 8000]) {
    Globe.prototype._traverse = traverseGardes({ frustum: true, marge })
    _resetTileMemo()
    const g = new Globe({}); g.setVisible(true)
    const c = cam(LAT, LON, altM)
    for (let i = 0; i < 300; i++) { pose(g, c); g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)) }
    const d = [], z = []
    for (let i = 0; i < 20; i++) { pose(g, c); g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)); d.push(g._drawn); z.push(zmax(g)) }
    console.log(`   marge=${String(marge).padEnd(4)} alt=${String(altM / 1000).padStart(4)}km  zmax=${JSON.stringify([...new Set(z)])}  dessinees=${JSON.stringify([...new Set(d)])}  cache=${g.tiles.size}  credit=${g._credit}`)
    g.dispose()
  }
}

// ---- 3. panoramique lateral 90 deg a 4 km
console.log('--- 3. panoramique lateral 90° a 4 km : trafic et pic de `loading`')
for (const [nom, variante] of [['depot', ORIG], ['horizon+frustum(2,5)', traverseGardes({ frustum: true, marge: 2.5 })]]) {
  Globe.prototype._traverse = variante
  _resetTileMemo()
  const g = new Globe({}); g.setVisible(true)
  let c = cam(LAT, LON, 4000)
  for (let i = 0; i < 200; i++) { pose(g, c); g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)) }
  requetes = 0
  let pic = 0
  const IMG = 120 // 2 s a 60 Hz
  for (let i = 0; i < IMG; i++) {
    const lon = LON + (90 * i) / IMG
    c = cam(LAT, lon, 4000)
    pose(g, c); g.update(c, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    pic = Math.max(pic, enCharge(g))
  }
  const apres = requetes
  // 5 s d'immobilite
  let picRepos = 0
  for (let i = 0; i < 300; i++) { pose(g, c); g.update(c, 0.016); await new Promise((r) => setTimeout(r, 0)); picRepos = Math.max(picRepos, enCharge(g)) }
  console.log(`   ${nom.padEnd(22)} requetes=${apres}  pic loading=${pic}  loading apres 5 s=${enCharge(g)}  zmax final=${zmax(g)}  cache=${g.tiles.size}`)
  g.dispose()
}
