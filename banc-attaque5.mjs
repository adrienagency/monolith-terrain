// Banc d'attaque #5 — mesure le zoom atteint, les tuiles dessinees, le cache et
// les requetes, IMAGE PAR IMAGE sur 20 images consecutives, pour trois regimes :
//   A = code du depot tel quel
//   B = A + horizon geometrique (etape 3 du plan)
//   C = B + test de frustum (etape 4 du plan)
// Bouchons repris de test/globe-reseau.test.js.
import * as THREE from 'three'
import { encodeTerrarium } from './src/bathy.js'

const RGB = encodeTerrarium(812)
const PIXELS = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  PIXELS[i * 4] = RGB[0]; PIXELS[i * 4 + 1] = RGB[1]; PIXELS[i * 4 + 2] = RGB[2]; PIXELS[i * 4 + 3] = 255
}
globalThis.document = {
  createElement() {
    return { width: 0, height: 0, getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {},
      getImageData: () => ({ data: PIXELS }), set fillStyle(v) {},
    }) }
  },
}
globalThis.createImageBitmap = async (blob) => blob
let requetes = 0
globalThis.fetch = async (url) => {
  requetes++
  await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ tuile: url }) }
}

const BASE = './src/'
const { Globe, _resetTileMemo } = await import('./src/' + 'globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('./src/' + 'geo.js')

const ORIG_TRAVERSE = Globe.prototype._traverse

// --------------------------------------------------------------- variantes
// Copie conforme de _traverse, avec les deux gardes du plan ajoutees.
function traverseAvecGardes({ horizon, frustum }) {
  return function _traverse(t, camPos, camDir) {
    const toTile = t.center.clone().normalize()
    if (t.z > 2) {
      if (horizon) {
        // horizon geometrique : cos(angle max) = R/|camPos|, moins une marge de corde
        const d = camPos.length()
        const seuil = R_GLOBE / d - t.chord / R_GLOBE
        if (toTile.dot(camDir) < seuil) return
      } else {
        if (toTile.dot(camDir) < -0.35) return
      }
      if (frustum && this._frustum) {
        SPH.center.copy(t.center)
        SPH.radius = t.chord * 0.5 + 2.5 // 2,5 u = 8 848 m x18 d'exageration
        if (!this._frustum.intersectsSphere(SPH)) return
      }
    }
    t.lastUsed = this.frame
    t.coverFrame = this.frame
    const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, 1)
    const ratio = t.chord / dist
    let wantSplit = t.z < 11 && ratio > (t.refined ? 0.38 * 0.8 : 0.38)
    if (wantSplit && !this._enfantsPresents(t)) {
      if (this._credit < 4) wantSplit = false
      else this._credit -= 4
    }
    if (wantSplit) {
      const kids = this._children(t)
      for (const k of kids) {
        k.lastUsed = this.frame
        if (k.state === 'empty') this._request(k, ratio)
      }
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
const SPH = new THREE.Sphere(new THREE.Vector3(), 1)

// ---------------------------------------------------------------- harnais
function cameraA(lat, lon, altM) {
  const alt = altM / ORBITAL_M_PER_UNIT
  const near = Math.min(Math.max(alt * 0.2, 0.01), 0.5)
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, near, 1400)
  latLonToSphere(lat, lon, R_GLOBE + alt, cam.position)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function poseFrustum(globe, cam) {
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
  globe._frustum = new THREE.Frustum().setFromProjectionMatrix(m)
}

function zmax(globe) {
  let z = 0
  for (const t of globe.tiles.values()) if (t.mesh && t.mesh.visible && t.z > z) z = t.z
  return z
}

async function calme(globe, cam, max = 400) {
  for (let i = 0; i < max; i++) {
    poseFrustum(globe, cam)
    globe.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    if (globe.inFlight === 0 && globe.queue.length === 0 && i > 30) break
  }
}

async function mesure(variante, lat, lon, altM) {
  Globe.prototype._traverse = variante === 'A' ? ORIG_TRAVERSE
    : traverseAvecGardes({ horizon: true, frustum: variante === 'C' })
  _resetTileMemo()
  const globe = new Globe({})
  globe.setVisible(true)
  const cam = cameraA(lat, lon, altM)
  requetes = 0
  await calme(globe, cam)
  // 20 images consecutives, camera strictement immobile
  const r0 = requetes
  const rel = []
  for (let i = 0; i < 20; i++) {
    poseFrustum(globe, cam)
    globe.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    rel.push({ z: zmax(globe), d: globe._drawn, c: globe.tiles.size, cr: globe._credit })
  }
  const uniq = (k) => [...new Set(rel.map((x) => x[k]))]
  globe.dispose()
  return {
    variante, altM,
    zoom: uniq('z'), dessinees: uniq('d'), cache: uniq('c'), credit: uniq('cr'),
    reqRepos: ((requetes - r0) / 20).toFixed(1),
    stable: uniq('z').length === 1 && uniq('d').length === 1,
  }
}

const LAT = 45.83, LON = 6.86 // Mont-Blanc
const ALTS = [1600000, 260000, 120000, 30000, 8000, 2200]
for (const v of ['A', 'B', 'C']) {
  for (const a of ALTS) {
    const m = await mesure(v, LAT, LON, a)
    console.log(
      `${v} alt=${(a / 1000).toString().padStart(5)}km  zmax=${JSON.stringify(m.zoom)}` +
      `  dessinees=${JSON.stringify(m.dessinees)}  cache=${JSON.stringify(m.cache)}` +
      `  credit=${JSON.stringify(m.credit)}  req/img=${m.reqRepos}  stable20=${m.stable}`
    )
  }
}
