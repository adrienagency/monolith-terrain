// RELEVÉ DIRECT DE NOS PROPRES TUILES — B3.
// Ce que la cascade bathymétrique CUITE dit d'un point, lu sur le disque, sans
// navigateur. Sert à ancrer les seuils sur la donnée qu'on sert réellement
// plutôt que sur un chiffre de mémoire — c'est l'erreur (cinq fois répétée)
// qui a fait poser deux seuils du barème sur des coordonnées à 80 et 200 km
// du point qu'elles prétendaient décrire.
import fs from 'node:fs'
import zlib from 'node:zlib'

function decodePng(buf) {
  let o = 8, w = 0, h = 0, bpp = 3
  const idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bpp = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 1 }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    o += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + i] : 0
      const c = i >= bpp && y > 0 ? out[(y - 1) * stride + i - bpp] : 0
      let v = line[i]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      out[y * stride + i] = v & 0xff
    }
  }
  return { w, h, bpp, data: out }
}

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z }
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180

const cache = new Map()
function tuile(z, tx, ty) {
  const k = `${z}/${tx}/${ty}`
  if (cache.has(k)) return cache.get(k)
  const f = `public/data/bathy/${k}.png`
  const v = fs.existsSync(f) ? decodePng(fs.readFileSync(f)) : null
  cache.set(k, v)
  return v
}
const dec = (p, cx, cy) => {
  const i = (cy * p.w + cx) * p.bpp
  if (p.bpp === 4 && p.data[i + 3] === 0) return NaN
  return p.data[i] * 256 + p.data[i + 1] + p.data[i + 2] / 256 - 32768
}

// LA MÊME DESCENTE que `peindreBathyTuile` : du plafond de la zone vers le
// plancher, la première qui répond gagne.
export function lireCascade(lat, lon, zmaxZone = 14) {
  for (let z = zmaxZone; z >= 4; z--) {
    const wx = lon2x(lon, z), wy = lat2y(lat, z)
    const tx = Math.floor(wx), ty = Math.floor(wy)
    const p = tuile(z, tx, ty)
    if (!p) continue
    const px = Math.min(p.w - 1, Math.floor((wx - tx) * p.w))
    const py = Math.min(p.h - 1, Math.floor((wy - ty) * p.h))
    const m = dec(p, px, py)
    if (!Number.isFinite(m)) continue
    return { z, tuile: `${z}/${tx}/${ty}`, m }
  }
  return { z: null, m: null }
}

// LE POINT LE PLUS PROFOND d'une emprise, dans nos tuiles z8 — c'est lui qui
// dit où le seuil doit être ancré.
export function plusProfond(z, w, s, e, n) {
  let best = { m: Infinity }
  const x0 = Math.floor(lon2x(w, z)), x1 = Math.ceil(lon2x(e, z))
  const y0 = Math.floor(lat2y(n, z)), y1 = Math.ceil(lat2y(s, z))
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
    const p = tuile(z, tx, ty)
    if (!p) continue
    for (let py = 0; py < p.h; py++) for (let px = 0; px < p.w; px++) {
      const m = dec(p, px, py)
      if (!Number.isFinite(m) || m >= 0) continue
      const la = y2lat(ty + (py + 0.5) / p.h, z), lo = x2lon(tx + (px + 0.5) / p.w, z)
      if (lo < w || lo > e || la < s || la > n) continue
      if (m < best.m) best = { m, lat: +la.toFixed(3), lon: +lo.toFixed(3) }
    }
  }
  return best
}

if (process.argv[1] && process.argv[1].endsWith('releve-tuiles-b3.mjs')) {
  const PTS = [
    ['Caspienne (point de B1)', 38.5, 51.5],
    ['Caspienne (fosse sud)', 38.962, 50.738],
    ['Mediterranee (point de B1)', 35.5, 19.0],
    ['Mediterranee (fosse Calypso)', 36.547, 21.102],
    ['Fosse des Kouriles', 45.5, 152.0],
    ['Large du Cap', -35.5, 18.0],
    ['Mer Rouge (centre)', 20.0, 38.5],
    ['Lac Superieur', 47.5, -87.5],
    ['Lac Titicaca', -15.9, -69.3],
    ['Fosse de la Sonde', -10.3, 109.9],
    ['Mer Noire', 43.0, 34.0],
    ['Leman', 46.45, 6.55],
    ['Baikal', 53.5, 108.1],
  ]
  console.log('\nCE QUE NOS TUILES DISENT, POINT PAR POINT (descente fin -> plancher)\n')
  for (const [nom, lat, lon] of PTS) {
    const r = lireCascade(lat, lon)
    console.log(`  ${nom.padEnd(30)} ${String(lat).padStart(8)} / ${String(lon).padStart(8)}  ->  ${r.m == null ? 'AUCUNE TUILE' : r.m.toFixed(1).padStart(9) + ' m   (tuile ' + r.tuile + ')'}`)
  }
  console.log('\nLE POINT LE PLUS PROFOND DE CHAQUE BASSIN, dans nos tuiles z8\n')
  for (const [nom, w, s, e, n] of [
    ['Caspienne', 45, 35, 56, 48],
    ['Mer Ionienne', 15, 33, 24, 38],
    ['Fosse des Kouriles', 148, 43, 158, 50],
  ]) {
    const b = plusProfond(8, w, s, e, n)
    console.log(`  ${nom.padEnd(22)} ${b.m === Infinity ? 'rien' : b.m.toFixed(0) + ' m  a  ' + b.lat + ' / ' + b.lon}`)
  }
  console.log()
}
