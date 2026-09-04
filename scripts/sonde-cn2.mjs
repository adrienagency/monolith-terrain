// SONDE CN2 — le palier du crop, image par image, sur le banc de papier.
// Sert à voir POURQUOI deux finesses coexistent : elle imprime, pour chaque
// altitude, la cible, le palier servi, et l'état de chaque tuile de l'emprise.
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) { DALLE[i * 4] = ER; DALLE[i * 4 + 1] = EG; DALLE[i * 4 + 2] = EB; DALLE[i * 4 + 3] = 255 }
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = { createElement() { const c = { width: 0, height: 0 }; c.getContext = () => (c._ctx ??= new FakeCtx()); return c } }
globalThis.createImageBitmap = async (b) => b
globalThis.fetch = async () => { await new Promise((r) => setTimeout(r, 0)); return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) } }

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')

const LAT = 39.62
const LON = 2.98
const FOV = 30

function camera(altM) {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(LAT, LON, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

for (const altM of [20000, 5000, 2000, 900, 600]) {
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 15, tuilesParBloc: 3 })
  const cam = camera(altM)
  const traces = []
  for (let i = 0; i < 60; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    const dessines = new Set()
    for (const t of g.tiles.values()) if (t.mesh?.visible && tuileDansCrop(t.z, t.x, t.y, g._crop)) dessines.add(t.z)
    traces.push(`${i}:c${g._zCropCible}/s${g._zCropServi}/[${[...dessines].sort((a, b) => a - b)}]`)
  }
  const detail = []
  for (const t of g.tiles.values()) {
    if (!tuileDansCrop(t.z, t.x, t.y, g._crop)) continue
    detail.push(`z${t.z}/${t.x}/${t.y} ${t.state}${t.mesh ? '+m' : ''}${t.mesh?.visible ? '+V' : ''}${t.refined ? ' raff' : ''}`)
  }
  console.log(`\n=== ${altM} m — ecran z${g._zCropEcran}, cible z${g._zCropCible}, servi z${g._zCropServi}, cache ${g.tiles.size}`)
  console.log('  ' + traces.join(' '))
  console.log('  emprise: ' + detail.sort().join(' | '))
}

// --- pourquoi le palier bloque : l'état des tuiles du niveau visé
{
  _resetTileMemo(); _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true }); g.setVisible(true)
  g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 15, tuilesParBloc: 3 })
  const cam = camera(900)
  for (let i = 0; i < 200; i++) { g.update(cam, 0.016); await new Promise((r) => setTimeout(r, 0)) }
  const camDir = cam.position.clone().normalize()
  console.log(`\n=== 900 m, 200 images — cible ${g._zCropCible}, servi ${g._zCropServi}, cache ${g.tiles.size}, file ${g.queue.length}`)
  for (const L of [15, 16]) {
    const out = []
    for (const t of g.tiles.values()) {
      if (t.z !== L || !tuileDansCrop(t.z, t.x, t.y, g._crop)) continue
      out.push(`${t.x}/${t.y}:${t.state}${t.mesh ? 'm' : ''}${g._dansLeChamp(t, camDir) ? '' : ' HORSCHAMP'}`)
    }
    console.log(`  z${L} (${out.length}) couvert=${g._cropCouvert(L, camDir)} : ${out.sort().join(' | ')}`)
  }
}
