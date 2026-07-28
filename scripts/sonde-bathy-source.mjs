#!/usr/bin/env node
// SONDE — que gagne-t-on VRAIMENT à relever le plafond de zoom bathy sur une
// zone, et le trait de côte bouge-t-il ?
//
// Deux questions, et la seconde est la seule qui puisse faire échouer le
// chantier. « La terre ne bouge jamais » est la règle absolue de src/bathy.js,
// payée par une session entière sur les polders : la source marine ne sert
// qu'à CREUSER. Une nouvelle source marine doit le prouver, pas le promettre.
//
// La sonde reproduit à l'identique ce que fait `loadBathyPatch` (src/dem.js) —
// descente du plafond vers le plancher, surzoom depuis l'ancêtre — une fois
// avec le plafond GLOBAL d'aujourd'hui (z8) et une fois avec le plafond PAR
// ZONE lu dans public/data/bathy/index.json. Puis elle passe les deux champs
// dans la VRAIE `fuseBathymetry`, contre un relief terrarium réel téléchargé
// depuis le bucket AWS.
//
// USAGE
//   node scripts/sonde-bathy-source.mjs                       # rade de Brest, z12
//   node scripts/sonde-bathy-source.mjs --lat 43.05 --lon 5.95 --zoom 12
//   node scripts/sonde-bathy-source.mjs --png _staging/sonde  # + images avant/après
//
// Ne fait partie d'aucune construction : c'est un instrument de mesure.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fuseBathymetry } from '../src/bathy.js'
import { normalizeIndex, bathyMaxZoom, BATHY_ZMIN, cascadeAt } from '../src/bathy-sources.js'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const LAT = +arg('lat', 48.35)
const LON = +arg('lon', -4.5)
const ZOOM = +arg('zoom', 12)
const TILES = arg('tiles', 'public/data/bathy')
const PNGDIR = arg('png', null)
const NOM = arg('nom', 'brest')

const TILE = 256
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180

// ------------------------------------------------------------ décodeur PNG
// Nos tuiles sont écrites par notre propre encodeur (build-bathy-tiles.mjs) :
// RVB 8 bits, filtre « Up » sur toutes les lignes. Les tuiles AWS, elles,
// viennent d'ailleurs et utilisent les cinq filtres — on les gère tous.
function decodePng(buf) {
  let o = 8
  let w = 0
  let h = 0
  let bpp = 3
  const idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bpp = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 1
    } else if (type === 'IDAT') idat.push(data)
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
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + i] = v & 0xff
    }
  }
  return { w, h, bpp, data: out }
}
const metres = (img, px, py) => {
  const i = (py * img.w + px) * img.bpp
  return img.data[i] * 256 + img.data[i + 1] + img.data[i + 2] / 256 - 32768
}

// ------------------------------------------------------------ chargement
const cache = new Map()
function localTile(z, x, y) {
  const k = `${z}/${x}/${y}`
  if (cache.has(k)) return cache.get(k)
  const p = path.join(TILES, String(z), String(x), `${y}.png`)
  const v = fs.existsSync(p) ? decodePng(fs.readFileSync(p)) : null
  cache.set(k, v)
  return v
}
async function awsTile(z, x, y) {
  const k = `aws:${z}/${x}/${y}`
  if (cache.has(k)) return cache.get(k)
  const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, {
    signal: AbortSignal.timeout(60_000),
  })
  const v = r.ok ? decodePng(Buffer.from(await r.arrayBuffer())) : null
  cache.set(k, v)
  return v
}

// Le champ de profondeur d'une tuile (z, x, y), reconstruit exactement comme
// `loadBathyPatch` : on part du plafond, on descend jusqu'au plancher, la
// première tuile qui répond gagne, et on lit la sous-fenêtre correspondante de
// l'ancêtre (c'est `overzoomTile`).
function champ(z, x, y, plafond) {
  const out = new Float32Array(TILE * TILE)
  for (let zt = Math.min(z, plafond); zt >= BATHY_ZMIN; zt--) {
    const s = 2 ** (z - zt)
    const img = localTile(zt, Math.floor(x / s), Math.floor(y / s))
    if (!img) continue
    const span = TILE / s // largeur de la sous-fenêtre, en pixels de l'ancêtre
    const ox = (x % s) * span
    const oy = (y % s) * span
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        // plus proche voisin : on mesure l'INFORMATION disponible, pas la
        // qualité du lissage (qui est le sujet de l'autre chantier)
        out[py * TILE + px] = metres(img, Math.floor(ox + (px * span) / TILE), Math.floor(oy + (py * span) / TILE))
      }
    }
    return { data: out, servi: zt }
  }
  return { data: out, servi: null }
}

// ------------------------------------------------------------- mesures
// Longueur moyenne d'un palier de valeur constante, en pixels. C'est la mesure
// honnête de la RÉSOLUTION EFFECTIVE : peu importe qu'on serve 256 px, si la
// valeur ne change que tous les 16 pixels, on décrit le fond à 16 px près.
function palier(field, seaOnly = true) {
  let plateaux = 0
  let total = 0
  for (let y = 0; y < TILE; y++) {
    let run = 1
    for (let x = 1; x < TILE; x++) {
      const a = field[y * TILE + x - 1]
      const b = field[y * TILE + x]
      if (seaOnly && (a >= 0 || b >= 0)) {
        run = 1
        continue
      }
      if (a === b) run++
      else {
        plateaux++
        total += run
        run = 1
      }
    }
  }
  return plateaux ? total / plateaux : 0
}

function toPng(field, file) {
  // rampe simple 0 → −60 m : on regarde une rade, pas un abysse
  const rgb = Buffer.alloc(TILE * TILE * 3)
  for (let i = 0; i < TILE * TILE; i++) {
    const v = field[i]
    let r, g, b
    if (v >= 0) {
      r = 40; g = 38; b = 34 // terre : neutre, elle n'est pas le sujet
    } else {
      const t = Math.min(1, -v / 60)
      r = Math.round(214 - 200 * t)
      g = Math.round(238 - 150 * t)
      b = Math.round(245 - 90 * t)
    }
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }
  const stride = TILE * 3
  const raw = Buffer.alloc(TILE * (1 + stride))
  for (let y = 0; y < TILE; y++) {
    raw[y * (1 + stride)] = 0
    rgb.copy(raw, y * (1 + stride) + 1, y * stride, (y + 1) * stride)
  }
  const crcT = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()
  const crc = (b) => {
    let c = -1
    for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const cc = Buffer.alloc(4)
    cc.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, cc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(TILE, 0)
  ihdr.writeUInt32BE(TILE, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  )
}

// ------------------------------------------------------------------ main
async function main() {
  const idxPath = path.join(TILES, 'index.json')
  const index = normalizeIndex(fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : null)
  const tx = Math.floor(lon2x(LON, ZOOM))
  const ty = Math.floor(lat2y(LAT, ZOOM))
  const plafondApres = bathyMaxZoom(index, LAT, LON)

  console.log(`\nSonde bathymétrique — ${LAT} / ${LON}, z${ZOOM}, tuile ${tx}/${ty}`)
  console.log(`  emprise ${x2lon(tx, ZOOM).toFixed(4)}..${x2lon(tx + 1, ZOOM).toFixed(4)} E · ${y2lat(ty + 1, ZOOM).toFixed(4)}..${y2lat(ty, ZOOM).toFixed(4)} N`)
  console.log(`  cascade ${cascadeAt(index, LAT, LON).map((s) => `${s.source}@z${s.zmax}`).join(' → ')}`)

  const avant = champ(ZOOM, tx, ty, 8)
  const apres = champ(ZOOM, tx, ty, plafondApres)

  // Largeur au sol d'un pixel de la tuile, à cette latitude.
  const mParPx = (40075016.686 * Math.cos((LAT * Math.PI) / 180)) / 2 ** ZOOM / TILE

  const pa = palier(avant.data)
  const pb = palier(apres.data)
  console.log(`\n  ── RÉSOLUTION EFFECTIVE ─────────────────────────────────────`)
  console.log(`  pixel de tuile à cette latitude          ${mParPx.toFixed(1)} m`)
  const ligne = (nom, c, p) =>
    console.log(
      `  ${nom.padEnd(24)} servi depuis z${String(c.servi ?? '—').padEnd(3)} palier ${p.toFixed(2)} px = ${(p * mParPx).toFixed(0)} m au sol`
    )
  ligne('AVANT (plafond global 8)', avant, pa)
  ligne(`APRÈS (plafond zone ${plafondApres})`, apres, pb)
  if (pa > 0 && pb > 0) console.log(`  gain de finesse                          ${(pa / pb).toFixed(2)}×`)

  // ── LE TEST QUI COMPTE : le trait de côte a-t-il bougé ? ────────────────
  // On fusionne les deux champs avec le MÊME relief terrarium réel, par la
  // VRAIE fuseBathymetry, et on compare les masques terre/mer.
  const aws = await awsTile(ZOOM, tx, ty)
  if (!aws) {
    console.log(`\n  ⚠ tuile terrarium AWS indisponible : test du trait de côte non joué\n`)
    return
  }
  const land = new Float32Array(TILE * TILE)
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) land[y * TILE + x] = metres(aws, x, y)

  const fa = fuseBathymetry(land, avant.data)
  const fb = fuseBathymetry(land, apres.data)
  let bouges = 0
  let bougesReels = 0
  let bougesMuets = 0
  let terre = 0
  let creuse = 0
  let ecartMax = 0
  let ecartCumul = 0
  let nMer = 0
  // ⚠️ Un ZÉRO EXACT dans le terrarium n'est PAS de la terre plate, c'est une
  // ABSENCE DE DONNÉE — c'est le premier commentaire de fuseBathymetry, et le
  // seuil vaut un demi-pas de quantification terrarium. Confondre les deux fait
  // passer pour « un rivage qui bouge » un pixel qui ne décrivait rien.
  const NODATA_EPS = 1 / 512
  const muet = (v) => v > -NODATA_EPS && v < NODATA_EPS
  for (let i = 0; i < land.length; i++) {
    const ta = fa[i] >= 0
    const tb = fb[i] >= 0
    if (ta) terre++
    if (ta !== tb) {
      bouges++
      // Le terrarium avait-il quelque chose à dire sur ce pixel ?
      if (muet(land[i])) bougesMuets++
      else bougesReels++
    }
    if (!ta && !tb) {
      nMer++
      const d = fb[i] - fa[i]
      if (d < 0) creuse++
      ecartCumul += Math.abs(d)
      if (Math.abs(d) > ecartMax) ecartMax = Math.abs(d)
    }
  }
  console.log(`\n  ── TRAIT DE CÔTE ────────────────────────────────────────────`)
  console.log(`  pixels émergés après fusion              ${terre.toLocaleString('fr-FR')} / ${land.length.toLocaleString('fr-FR')}`)
  console.log(`  pixels dont le statut terre/mer CHANGE   ${bouges}`)
  console.log(`    · dont le terrarium portait un RELIEF   ${bougesReels}  ← le seul chiffre qui peut faire échouer le chantier`)
  console.log(`    · dont le terrarium était MUET (0 exact) ${bougesMuets}  ← ne décrivait rien, la source marine tranche légitimement`)
  console.log(bougesReels === 0
    ? `  ✓ LE TRAIT DE CÔTE N'A PAS BOUGÉ D'UN PIXEL : aucun pixel porté par le relief n'a changé de camp`
    : `  ✖ ${bougesReels} pixels PORTÉS PAR LE RELIEF ont changé de camp — À INSTRUIRE AVANT TOUT`)
  console.log(`\n  ── CE QUI CHANGE, DONC, C'EST LE FOND ───────────────────────`)
  console.log(`  pixels de mer                            ${nMer.toLocaleString('fr-FR')}`)
  console.log(`  dont la source fine CREUSE davantage     ${creuse.toLocaleString('fr-FR')} (${((100 * creuse) / Math.max(nMer, 1)).toFixed(0)} %)`)
  console.log(`  écart moyen sur la mer                   ${(ecartCumul / Math.max(nMer, 1)).toFixed(2)} m`)
  console.log(`  écart maximum                            ${ecartMax.toFixed(1)} m`)

  if (PNGDIR) {
    toPng(fa, path.join(PNGDIR, `${NOM}-avant-z8.png`))
    toPng(fb, path.join(PNGDIR, `${NOM}-apres-z${plafondApres}.png`))
    console.log(`\n  images → ${PNGDIR}/${NOM}-avant-z8.png et ${NOM}-apres-z${plafondApres}.png`)
  }
  console.log()
}

main()
