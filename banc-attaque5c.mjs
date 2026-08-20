import * as THREE from 'three'
import { encodeTerrarium } from './src/bathy.js'
const RGB = encodeTerrarium(812)
const PIXELS = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) { PIXELS[i*4]=RGB[0]; PIXELS[i*4+1]=RGB[1]; PIXELS[i*4+2]=RGB[2]; PIXELS[i*4+3]=255 }
globalThis.document = { createElement() { return { width:0, height:0, getContext: () => ({
  createLinearGradient: () => ({ addColorStop(){} }), fillRect(){}, drawImage(){},
  getImageData: () => ({ data: PIXELS }), set fillStyle(v){}, }) } } }
globalThis.createImageBitmap = async (b) => b
globalThis.fetch = async (url) => { await new Promise(r=>setTimeout(r,0)); return { ok:true, status:200, blob: async()=>({tuile:url}) } }
const { Globe, _resetTileMemo } = await import('./src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('./src/geo.js')
const zmax = (g) => { let z=0; for (const t of g.tiles.values()) if (t.mesh?.visible && t.z>z) z=t.z; return z }
const ALTS = [1600000, 800000, 400000, 200000, 100000, 50000, 25000, 12000, 8000, 4000, 2000]
const LATS = [0, 30, 45.83, 60]
// PROTOCOLE « 44 RELEVES » : UN SEUL globe, promene sur 11 altitudes x 4 latitudes
_resetTileMemo()
const g = new Globe({}); g.setVisible(true)
const c = new THREE.PerspectiveCamera(30, 16/9, 0.5, 1400)
const releve = []
for (const lat of LATS) for (const alt of ALTS) {
  latLonToSphere(lat, 6.86, R_GLOBE + alt/ORBITAL_M_PER_UNIT, c.position)
  c.lookAt(0,0,0); c.updateMatrixWorld(true)
  for (let i=0;i<40;i++){ g.update(c,0.016); await new Promise(r=>setTimeout(r,0)) }
  releve.push({ lat, alt: alt/1000, z: zmax(g), d: g._drawn, cache: g.tiles.size })
}
console.log('--- globe PROMENE (44 releves, un seul globe) ---')
for (const r of releve) console.log(`   lat=${String(r.lat).padStart(5)} alt=${String(r.alt).padStart(4)}km  zmax=${r.z}  dessinees=${r.d}  cache=${r.cache}`)
console.log('   zooms distincts :', JSON.stringify([...new Set(releve.map(r=>r.z))].sort()))
g.dispose()
