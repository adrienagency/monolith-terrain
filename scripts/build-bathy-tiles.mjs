#!/usr/bin/env node
// TUILEUR BATHYMÉTRIQUE — un raster d'altitude géoréférencé (GEBCO, EMODnet,
// BlueTopo…) devient des tuiles PNG au format TERRARIUM, dans la grille XYZ
// Web Mercator. Le même encodage que les tuiles d'AWS, donc le décodeur du
// terrain n'a strictement rien à apprendre : il lit la profondeur fine comme
// il lit déjà l'altitude.
//
//   meters = R*256 + G + B/256 − 32768
//
// ENTRÉE attendue : un fichier .bin brut + un .json de géoréférencement, écrits
// par `scripts/gebco-to-raw.py` (le pont Python, parce que ni GDAL ni rasterio
// ne sont installés — voir ce script pour le pourquoi). Ce découplage a un
// avantage : n'importe quelle source se ramène au même format pivot.
//
//   { "width": 43200, "height": 21600,
//     "west": -180, "east": 180, "south": -90, "north": 90,
//     "dtype": "int16", "noData": -32768 }
//
// USAGE
//   node scripts/build-bathy-tiles.mjs --src data/gebco --out public/data/bathy \
//        --zmin 4 --zmax 8 [--bbox W,S,E,N] [--dry]
//
// Le mode --dry ne dessine rien : il compte les tuiles et annonce le poids.
// À lancer AVANT toute cuisson longue.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// ------------------------------------------------------------------ options
const argv = process.argv.slice(2)
const arg = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const flag = (name) => argv.includes(`--${name}`)

const SRC = arg('src', 'data/gebco')
const OUT = arg('out', 'public/data/bathy')
const ZMIN = +arg('zmin', 4)
const ZMAX = +arg('zmax', 8)
const DRY = flag('dry')
const BBOX = (arg('bbox') || '-180,-90,180,90').split(',').map(Number)
const TILE = 256

// ------------------------------------------------------------- géographie
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return ((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z)
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// ------------------------------------------------------------- encodage PNG
// PNG 8 bits RVB sans filtre, dégonflé par zlib. Écrire le PNG à la main évite
// d'ajouter une dépendance native (sharp/canvas) pour trois chunks.
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
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
  ihdr[8] = 8 // profondeur
  ihdr[9] = 2 // couleur RVB
  // chaque ligne est préfixée de son octet de filtre (0 = aucun)
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --------------------------------------------------------------- source
// UNE source = un dossier pivot. GEBCO livre son monde en PLUSIEURS GeoTIFF
// regionaux : plutot que d'assembler une mosaique de 7,5 Go sur disque, on
// ouvre chaque pivot et on interroge le premier qui couvre le point. C'est
// aussi ce qui permettra d'empiler une source cotiere fine PAR-DESSUS une
// source mondiale — l'ordre des dossiers fait la priorite.
function openSources(spec) {
  const dirs = spec.split(',').map((d) => d.trim()).filter(Boolean)
  const found = []
  for (const d of dirs) {
    if (fs.existsSync(path.join(d, 'meta.json'))) { found.push(d); continue }
    if (fs.existsSync(d)) {
      for (const sub of fs.readdirSync(d).sort()) {
        if (fs.existsSync(path.join(d, sub, 'meta.json'))) found.push(path.join(d, sub))
      }
    }
  }
  if (!found.length) {
    console.error(`\n✖ Aucun pivot trouvé dans : ${spec}`)
    console.error('  Fabriquez-le avant :  python scripts/gebco-to-raw.py <geotiff|dossier> data/gebco\n')
    process.exit(1)
  }
  console.log(`  ${found.length} pivot(s) : ${found.map((f) => path.basename(f)).join(', ')}`)
  const opened = found.map(openOne)
  return {
    sample: (lon, lat) => {
      for (const o of opened) {
        const v = o.sample(lon, lat)
        if (v != null) return v
      }
      return null
    },
    close: () => opened.forEach((o) => o.close()),
  }
}

function openOne(dir) {
  const metaPath = path.join(dir, 'meta.json')
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  const fd = fs.openSync(path.join(dir, 'grid.bin'), 'r')
  const bytes = meta.dtype === 'int16' ? 2 : 4
  const row = Buffer.alloc(meta.width * bytes)
  let cachedRow = -1
  // lecture PAR LIGNE avec un cache d'une ligne : une tuile balaie le raster
  // de haut en bas, donc on relit très rarement la même ligne deux fois. Charger
  // les 7 Go en mémoire n'est pas envisageable.
  const readRow = (j) => {
    if (j !== cachedRow) {
      fs.readSync(fd, row, 0, row.length, j * row.length)
      cachedRow = j
    }
    return row
  }
  const sample = (lon, lat) => {
    if (lon < meta.west || lon > meta.east || lat < meta.south || lat > meta.north) return null
    const fx = ((lon - meta.west) / (meta.east - meta.west)) * meta.width
    const fy = ((meta.north - lat) / (meta.north - meta.south)) * meta.height
    const i = Math.min(meta.width - 1, Math.max(0, Math.floor(fx)))
    const j = Math.min(meta.height - 1, Math.max(0, Math.floor(fy)))
    const buf = readRow(j)
    const v = bytes === 2 ? buf.readInt16LE(i * 2) : buf.readFloatLE(i * 4)
    return v === meta.noData || !Number.isFinite(v) ? null : v
  }
  return { meta, sample, close: () => fs.closeSync(fd) }
}

// -------------------------------------------------------------- encodage m
function encodeTerrarium(m) {
  const v = Math.min(32767.99, Math.max(-32768, m)) + 32768
  const r = Math.floor(v / 256)
  const g = Math.floor(v - r * 256)
  const b = Math.round((v - r * 256 - g) * 256)
  if (b === 256) return g === 255 ? [r + 1, 0, 0] : [r, g + 1, 0]
  return [r, g, b]
}

// ------------------------------------------------------------------ cuisson
function tileRange(z) {
  const [w, s, e, n] = BBOX
  return {
    x0: Math.max(0, Math.floor(lon2x(w, z))),
    x1: Math.min(2 ** z - 1, Math.ceil(lon2x(e, z)) - 1),
    y0: Math.max(0, Math.floor(lat2y(n, z))),
    y1: Math.min(2 ** z - 1, Math.ceil(lat2y(s, z)) - 1),
  }
}

function main() {
  console.log(`\nTuileur bathymétrique — z${ZMIN}..${ZMAX}, bbox ${BBOX.join(',')}`)
  let total = 0
  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = tileRange(z)
    total += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  }
  console.log(`  ${total.toLocaleString('fr-FR')} tuiles au maximum (les tuiles SANS mer sont écartées)`)
  console.log(`  poids si toutes étaient écrites : ~${Math.round((total * 10) / 1024)} Mo à 10 Ko/tuile`)
  if (DRY) {
    console.log('\n--dry : rien n\'a été écrit.\n')
    return
  }

  const src = openSources(SRC)
  let written = 0
  let skipped = 0
  const t0 = Date.now()

  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = tileRange(z)
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        const rgb = Buffer.alloc(TILE * TILE * 3)
        let anySea = false
        for (let py = 0; py < TILE; py++) {
          const lat = y2lat(ty + (py + 0.5) / TILE, z)
          for (let px = 0; px < TILE; px++) {
            const lon = x2lon(tx + (px + 0.5) / TILE, z)
            const m = src.sample(lon, lat)
            // ⚠️ on n'écrit QUE la mer. Sur terre, la valeur n'a aucune valeur
            // ajoutée (le terrarium est bien plus fin) et le module de fusion
            // l'ignore de toute façon — autant ne pas alourdir les PNG.
            const v = m == null ? 0 : m
            if (v < 0) anySea = true
            const [R, G, B] = encodeTerrarium(v)
            const o = (py * TILE + px) * 3
            rgb[o] = R
            rgb[o + 1] = G
            rgb[o + 2] = B
          }
        }
        if (!anySea) {
          skipped++
          continue // tuile entièrement à terre : inutile de l'écrire
        }
        const dir = path.join(OUT, String(z), String(tx))
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, `${ty}.png`), encodePng(rgb, TILE, TILE))
        written++
        if (written % 250 === 0) {
          const s = (Date.now() - t0) / 1000
          console.log(`  z${z} · ${written.toLocaleString('fr-FR')} écrites · ${skipped.toLocaleString('fr-FR')} à terre · ${(written / s).toFixed(0)}/s`)
        }
      }
    }
  }
  src.close()
  const s = (Date.now() - t0) / 1000
  console.log(`\n✓ ${written.toLocaleString('fr-FR')} tuiles écrites, ${skipped.toLocaleString('fr-FR')} écartées (aucune mer) en ${s.toFixed(0)} s`)
  console.log(`  → ${OUT}\n`)
}

main()
