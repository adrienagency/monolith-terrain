// BT-A — LE FILTRE SHELF APPLIQUE A BLUETOPO, compte sur NOS PROPRES TUILES.
//
// `scripts/build-bathy-tiles.mjs` n'ecrit une tuile que si elle voit de la
// TERRE (m >= 0) ou du PLATEAU (SHELF < m < 0, SHELF = -500 m). Une tuile dont
// tous les echantillons sont plus profonds que -500 m est ECARTEE.
//
// Faute du raster BlueTopo, on applique la MEME regle a la meilleure carte de
// profondeur qu'on ait sur le disque : nos tuiles GEBCO z8 cuites (464 m). Le
// tamis du tuileur est de 32x32 par tuile, soit un point tous les ~300 m a z12 :
// la resolution de GEBCO suffit largement a dire si une tuile z12 de 9,8 km
// touche, ou non, l'isobathe -500 m.
import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'

const RACINE = process.argv[2] || process.cwd()

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
  const f = path.join(RACINE, 'public/data/bathy', `${k}.png`)
  const v = fs.existsSync(f) ? decodePng(fs.readFileSync(f)) : null
  if (cache.size < 4000) cache.set(k, v)
  return v
}
// profondeur GEBCO cuite en (lon, lat), au niveau Z8. Rend null hors couverture
// (tuile absente) et 0 pour « pas de la mer » (le marqueur de terre du tuileur).
function profZ8(lon, lat) {
  const z = 8
  const fx = lon2x(lon, z), fy = lat2y(lat, z)
  const tx = Math.floor(fx), ty = Math.floor(fy)
  const p = tuile(z, tx, ty)
  if (!p) return null
  const cx = Math.min(p.w - 1, Math.floor((fx - tx) * p.w))
  const cy = Math.min(p.h - 1, Math.floor((fy - ty) * p.h))
  const i = (cy * p.w + cx) * p.bpp
  return p.data[i] * 256 + p.data[i + 1] + p.data[i + 2] / 256 - 32768
}

const SHELF = -500
const PROBE = 32
// la regle EXACTE de probeWorthIt, recopiee ligne pour ligne
function probeWorthIt(z, tx, ty) {
  let vue = 0
  for (let j = 0; j < PROBE; j++) {
    const lat = y2lat(ty + (j + 0.5) / PROBE, z)
    for (let i = 0; i < PROBE; i++) {
      const lon = x2lon(tx + (i + 0.5) / PROBE, z)
      const m = profZ8(lon, lat)
      if (m == null) continue
      vue++
      if (m >= 0) return { garde: true, vue }
      if (m > SHELF) return { garde: true, vue }
    }
  }
  return { garde: false, vue }
}

const BBOX = [-98, 24, -66, 45] // la zone `us-est` en reserve dans bathy-zones.json
function balayer(z, pas = 1) {
  const x0 = Math.floor(lon2x(BBOX[0], z)), x1 = Math.ceil(lon2x(BBOX[2], z)) - 1
  const y0 = Math.floor(lat2y(BBOX[3], z)), y1 = Math.ceil(lat2y(BBOX[1], z)) - 1
  let total = 0, gardees = 0, ecartees = 0, sansDonnee = 0
  for (let ty = y0; ty <= y1; ty += pas) {
    for (let tx = x0; tx <= x1; tx += pas) {
      total++
      const r = probeWorthIt(z, tx, ty)
      if (r.vue === 0) sansDonnee++
      if (r.garde) gardees++
      else ecartees++
    }
  }
  return { z, pas, total, gardees, ecartees, sansDonnee, partEcartee: ecartees / total }
}

console.log(`\nLE FILTRE SHELF (${SHELF} m) APPLIQUE A LA ZONE us-est ${BBOX.join(',')}`)
console.log('tuiles echantillonnees une sur PAS x PAS ; profondeur lue sur nos tuiles GEBCO z8\n')
for (const [z, pas] of [[9, 1], [10, 2], [11, 4], [12, 8]]) {
  const r = balayer(z, pas)
  const nTot = (Math.ceil(lon2x(BBOX[2], z)) - Math.floor(lon2x(BBOX[0], z))) * (Math.ceil(lat2y(BBOX[1], z)) - Math.floor(lat2y(BBOX[3], z)))
  console.log(`z${z}  grille complete ${nTot.toLocaleString('fr-FR')} tuiles · echantillon ${r.total} (1 sur ${pas}x${pas})` +
    `  ->  GARDEES ${r.gardees} (${(100 - r.partEcartee * 100).toFixed(1)} %)  ECARTEES ${r.ecartees} (${(r.partEcartee * 100).toFixed(1)} %)`)
}

// ── LES POINTS DU TABLEAU : chacun serait-il cuit, ou ecarte ? ──────────────
const PTS = [
  ['Chesapeake - embouchure', 37.00, -76.05],
  ['Chesapeake - bassin median', 38.20, -76.30],
  ['Plateau Virginia Beach', 36.80, -75.30],
  ['New York Bight', 40.50, -73.90],
  ['Tete canyon de l Hudson', 39.60, -72.60],
  ['Massachusetts Bay', 42.35, -70.60],
  ['Golfe du Maine', 42.90, -70.30],
  ['Georges Bank', 41.30, -67.50],
  ['Plateau louisianais', 28.80, -90.50],
  ['Golfe du Mexique - Mississippi', 27.50, -89.50],
  ['Florida Bay / Keys', 24.80, -81.30],
  ['Plateau ouest-Floride', 27.50, -83.20],
  ['Detroit de Puget', 47.60, -122.45],
  ['Baie de San Francisco', 37.82, -122.50],
  ['Cook Inlet (Alaska)', 60.50, -151.60],
  ['Lac Michigan', 43.30, -86.90],
  ['Lac Erie', 42.00, -81.50],
]
console.log('\nPOINT PAR POINT — la tuile qui le porte serait-elle ECRITE ?\n')
console.log('lieu                              GEBCO z8      z10        z11        z12')
for (const [nom, lat, lon] of PTS) {
  const d = profZ8(lon, lat)
  const etats = [10, 11, 12].map((z) => {
    const tx = Math.floor(lon2x(lon, z)), ty = Math.floor(lat2y(lat, z))
    const r = probeWorthIt(z, tx, ty)
    return r.vue === 0 ? 'PAS DE DONNEE' : r.garde ? 'ECRITE' : 'ECARTEE'
  })
  console.log(nom.padEnd(33) + String(d == null ? 'absente' : d.toFixed(0)).padStart(8) + '  ' + etats.map((e) => e.padEnd(9)).join(' '))
}

// ── LA MER, C'EST m < 0 : ce que ca fait aux Grands Lacs ────────────────────
console.log('\nLES GRANDS LACS FACE AU TUILEUR — `const raw = m == null || m >= 0 ? 0 : m`')
const LACS = [
  ['Superieur', 183, 406],
  ['Michigan', 176, 281],
  ['Huron', 176, 229],
  ['Erie', 174, 64],
  ['Ontario', 75, 244],
]
for (const [nom, nappe, fond] of LACS) {
  const alt = nappe - fond
  console.log(`  ${nom.padEnd(11)} nappe +${String(nappe).padStart(4)} m · fond le plus bas ${alt >= 0 ? '+' : ''}${alt} m  ->  ` +
    (alt >= 0 ? 'AUCUN pixel sous 0 : anySea reste FAUX, la tuile n est JAMAIS ecrite'
      : `seuls les ${(-alt)} m sous le niveau de la mer seraient ecrits ; les ${fond + alt} m du haut sont aplatis a 0`))
}

// ── OU TOMBENT LES TUILES ECARTEES ? le talus, ou l'abysse ? ────────────────
{
  const z = 12, pas = 8
  const x0 = Math.floor(lon2x(BBOX[0], z)), x1 = Math.ceil(lon2x(BBOX[2], z)) - 1
  const y0 = Math.floor(lat2y(BBOX[3], z)), y1 = Math.ceil(lat2y(BBOX[1], z)) - 1
  const bandes = { 'talus -500..-2000': 0, 'pente -2000..-3500': 0, 'abysse < -3500': 0, 'sans donnee': 0 }
  for (let ty = y0; ty <= y1; ty += pas) for (let tx = x0; tx <= x1; tx += pas) {
    const r = probeWorthIt(z, tx, ty)
    if (r.garde) continue
    if (r.vue === 0) { bandes['sans donnee']++; continue }
    const d = profZ8(x2lon(tx + 0.5, z), y2lat(ty + 0.5, z))
    if (d == null) { bandes['sans donnee']++ }
    else if (d > -2000) bandes['talus -500..-2000']++
    else if (d > -3500) bandes['pente -2000..-3500']++
    else bandes['abysse < -3500']++
  }
  console.log('\nLES TUILES z12 ECARTEES, PAR PROFONDEUR DE LEUR CENTRE')
  for (const [k, v] of Object.entries(bandes)) console.log('  ' + k.padEnd(22) + String(v).padStart(6))
}
