// BANC D'ESSAI : quel est le poids d'une tuile bathymétrique selon la finesse
// à laquelle on code la profondeur ?
//
// POURQUOI. La cuisson mondiale z7-z8 produisait ~42 Ko par tuile, soit plus de
// 2 Go pour le monde — indéployable. Le coupable est le canal G du terrarium
// (l'octet de poids faible de l'altitude) : sur un fond marin, la profondeur
// varie de quelques mètres d'un pixel à l'autre, donc G change à CHAQUE pixel
// et ne se compresse pas. Coder la profondeur par pas de N mètres rend G
// multiple de N : l'entropie tombe de log2(N) bits par pixel.
//
// La question à trancher est un arbitrage : combien de mètres peut-on perdre
// sans que le relief sous-marin ne se mette à marcher d'escalier ? Ce script
// mesure le poids ; l'œil tranche ensuite dans le navigateur.
//
// USAGE
//   node scripts/bench-bathy-quant.mjs [--src data/gebco]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const SRC = arg('src', 'data/gebco')
const TILE = 256

// --- géographie (identique au tuileur)
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// --- PNG (identique au tuileur : filtre Up, deflate 9)
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (b) => {
  let c = -1
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(rgb, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const stride = w * 3
  const raw = Buffer.alloc(h * (1 + stride))
  for (let y = 0; y < h; y++) {
    const o = y * (1 + stride)
    raw[o] = 2
    for (let i = 0; i < stride; i++) {
      const cur = rgb[y * stride + i]
      const up = y === 0 ? 0 : rgb[(y - 1) * stride + i]
      raw[o + 1 + i] = (cur - up) & 0xff
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- source pivot (identique au tuileur)
function openOne(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
  const fd = fs.openSync(path.join(dir, 'grid.bin'), 'r')
  const bytes = meta.dtype === 'int16' ? 2 : 4
  const row = Buffer.alloc(meta.width * bytes)
  let cached = -1
  const readRow = (j) => {
    if (j !== cached) { fs.readSync(fd, row, 0, row.length, j * row.length); cached = j }
    return row
  }
  const at = (i, j) => {
    const buf = readRow(j)
    const v = bytes === 2 ? buf.readInt16LE(i * 2) : buf.readFloatLE(i * 4)
    return v === meta.noData || !Number.isFinite(v) ? null : v
  }
  const sample = (lon, lat, halfLon = 0, halfLat = 0) => {
    if (lon < meta.west || lon > meta.east || lat < meta.south || lat > meta.north) return null
    const sx = meta.width / (meta.east - meta.west)
    const sy = meta.height / (meta.north - meta.south)
    const cx = (lon - meta.west) * sx
    const cy = (meta.north - lat) * sy
    const rx = Math.floor(halfLon * sx)
    const ry = Math.floor(halfLat * sy)
    const i0 = Math.min(meta.width - 1, Math.max(0, Math.floor(cx - rx)))
    const i1 = Math.min(meta.width - 1, Math.max(0, Math.floor(cx + rx)))
    const j0 = Math.min(meta.height - 1, Math.max(0, Math.floor(cy - ry)))
    const j1 = Math.min(meta.height - 1, Math.max(0, Math.floor(cy + ry)))
    if (i0 === i1 && j0 === j1) return at(i0, j0)
    let sum = 0
    let n = 0
    const stepI = Math.max(1, Math.ceil((i1 - i0 + 1) / 8))
    const stepJ = Math.max(1, Math.ceil((j1 - j0 + 1) / 8))
    for (let j = j0; j <= j1; j += stepJ) {
      for (let i = i0; i <= i1; i += stepI) {
        const v = at(i, j)
        if (v != null) { sum += v; n++ }
      }
    }
    return n ? sum / n : null
  }
  return { meta, sample, close: () => fs.closeSync(fd) }
}
function openSources(spec) {
  const found = []
  for (const d of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (fs.existsSync(path.join(d, 'meta.json'))) { found.push(d); continue }
    if (fs.existsSync(d)) {
      for (const sub of fs.readdirSync(d).sort()) {
        if (fs.existsSync(path.join(d, sub, 'meta.json'))) found.push(path.join(d, sub))
      }
    }
  }
  if (!found.length) { console.error(`✖ aucun pivot dans ${spec}`); process.exit(1) }
  const opened = found.map(openOne)
  return {
    sample: (lon, lat, hl, ha) => {
      for (const o of opened) { const v = o.sample(lon, lat, hl, ha); if (v != null) return v }
      return null
    },
    close: () => opened.forEach((o) => o.close()),
  }
}

const encodeTerrarium = (m) => {
  const v = Math.min(32767, Math.max(-32768, Math.round(m))) + 32768
  const r = Math.floor(v / 256)
  return [r, v - r * 256, 0]
}

// --- LES BARÈMES TESTÉS. Un barème rend le pas de quantification, en mètres,
// pour une profondeur donnée. Le principe : la précision n'a pas besoin d'être
// la même dans un lagon à 8 m et dans une plaine abyssale à 5 000 m.
const SCALES = {
  'brut (1 m partout)': () => 1,
  'doux  1/2/4': (d) => (d > -60 ? 1 : d > -400 ? 2 : 4),
  'moyen 1/4/8': (d) => (d > -60 ? 1 : d > -400 ? 4 : 8),
  'franc 1/4/16': (d) => (d > -60 ? 1 : d > -400 ? 4 : 16),
  'rude  2/8/32': (d) => (d > -60 ? 2 : d > -400 ? 8 : 32),
}
const quantize = (d, step) => (step <= 1 ? Math.round(d) : Math.round(d / step) * step)

// --- ÉCHANTILLON DE TUILES. Un seul type de fond ment : la mer Égée est un
// pire cas (côtes déchiquetées, îles), une plaine abyssale un meilleur cas.
// On mesure les deux et tout ce qu'il y a entre.
const SPOTS = [
  { nom: 'mer Égée (côtes hachées)', lon: 25.0, lat: 37.0 },
  { nom: 'golfe de Gascogne (talus)', lon: -5.0, lat: 45.5 },
  { nom: 'dorsale médio-atlantique', lon: -30.0, lat: 20.0 },
  { nom: 'plaine abyssale Pacifique', lon: -150.0, lat: 10.0 },
  { nom: 'Grande Barrière (récif)', lon: 147.0, lat: -18.0 },
  { nom: 'fjords de Norvège', lon: 6.0, lat: 61.0 },
  { nom: 'Manche (plateau peu profond)', lon: -1.0, lat: 50.0 },
  { nom: 'Antilles (arc + fosse)', lon: -61.5, lat: 15.5 },
]

function bakeTile(src, z, tx, ty, scaleFn) {
  const rgb = Buffer.alloc(TILE * TILE * 3)
  const halfLon = (x2lon(tx + 1, z) - x2lon(tx, z)) / TILE / 2
  let anySea = false
  for (let py = 0; py < TILE; py++) {
    const latT = y2lat(ty + py / TILE, z)
    const latB = y2lat(ty + (py + 1) / TILE, z)
    const lat = (latT + latB) / 2
    const halfLat = Math.abs(latT - latB) / 2
    for (let px = 0; px < TILE; px++) {
      const lon = x2lon(tx + (px + 0.5) / TILE, z)
      const m = src.sample(lon, lat, halfLon, halfLat)
      let v = m == null || m >= 0 ? 0 : m
      if (v < 0) { anySea = true; v = quantize(v, scaleFn(v)) }
      const [R, G, B] = encodeTerrarium(v)
      const o = (py * TILE + px) * 3
      rgb[o] = R
      rgb[o + 1] = G
      rgb[o + 2] = B
    }
  }
  return anySea ? encodePng(rgb, TILE, TILE).length : 0
}

function main() {
  const src = openSources(SRC)
  const names = Object.keys(SCALES)
  console.log(`\nBanc bathymétrique — ${SPOTS.length} lieux × z7 et z8 × ${names.length} barèmes\n`)

  const totals = Object.fromEntries(names.map((n) => [n, { bytes: 0, tiles: 0 }]))
  for (const z of [7, 8]) {
    for (const spot of SPOTS) {
      const tx = Math.floor(lon2x(spot.lon, z))
      const ty = Math.floor(lat2y(spot.lat, z))
      const line = [`z${z} ${spot.nom.padEnd(28)}`]
      for (const n of names) {
        const bytes = bakeTile(src, z, tx, ty, SCALES[n])
        if (bytes) { totals[n].bytes += bytes; totals[n].tiles++ }
        line.push(`${(bytes / 1024).toFixed(1).padStart(6)} Ko`)
      }
      console.log(line.join('  '))
    }
  }
  src.close()

  console.log('\n' + '='.repeat(74))
  console.log('barème'.padEnd(22) + 'moyenne/tuile'.padStart(15) + 'gain'.padStart(10) + 'monde z7+z8*'.padStart(16))
  const ref = totals[names[0]].bytes / totals[names[0]].tiles
  for (const n of names) {
    const avg = totals[n].bytes / totals[n].tiles
    // ~57 000 tuiles de mer estimées sur z7+z8 (70 % d'un monde de 16 384 +
    // 65 536 tuiles) — l'ordre de grandeur suffit pour trancher
    const monde = (avg * 57000) / 1024 / 1024 / 1024
    console.log(
      n.padEnd(22) +
      `${(avg / 1024).toFixed(1)} Ko`.padStart(15) +
      `${((1 - avg / ref) * 100).toFixed(0)} %`.padStart(10) +
      `${monde.toFixed(2)} Go`.padStart(16)
    )
  }
  console.log('='.repeat(74))
  console.log('* estimation grossière : 57 000 tuiles de mer sur z7+z8.\n')
}

main()
