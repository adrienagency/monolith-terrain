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
import { pathToFileURL } from 'node:url'

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

// ─────────────────────────────────────────────────── LE PLATEAU, ET RIEN QUE LUI
// Arbitrage d'Adrien : on ne cuit QUE la frange côtière, jusqu'à l'isobathe des
// 500 m. Une tuile qui n'a que de l'abysse n'est pas écrite.
//
// Ce n'est pas une économie de bout de chandelle, c'est le contraire d'une perte :
// mesuré au banc, les tuiles LES PLUS LOURDES sont les plaines abyssales (72 Ko)
// — un fond « plat » à 5 000 m est couvert de bruit de sondage qui ne se compresse
// pas — et ce sont aussi celles où GEBCO n'apporte rien de visible, puisque nos
// tuiles terrarium décrivent déjà correctement une plaine. Recensé : 19 657 tuiles
// z6-z8 au lieu de 55 535, soit ~576 Mo au lieu de 1,6 Go.
//
// Les tuiles écartées gardent silencieusement l'ancien relief (src/dem.js traite
// l'absence comme un non-événement), donc rien ne casse au large.
const SHELF = +arg('shelf', -500)

// ─────────────────────────────────────────────────────────── QUANTIFICATION
// Le canal G du terrarium porte l'octet de poids faible de l'altitude : sur un
// fond marin il change à CHAQUE pixel et ne se compresse pas. Coder la
// profondeur par pas de N mètres rend G multiple de N et fait tomber l'entropie
// de log2(N) bits. Mesuré : -35 % de poids avec le barème ci-dessous.
//
// Le pas suit la profondeur, parce qu'un mètre n'a pas le même prix partout :
// dans un lagon à 8 m il fait toute la lecture, à 4 000 m il est invisible.
const QUANT = !flag('no-quant')
const quantStep = (d) => (d > -60 ? 1 : d > -400 ? 4 : 8)
const quantize = (d) => {
  if (!QUANT) return d
  const s = quantStep(d)
  return s <= 1 ? Math.round(d) : Math.round(d / s) * s
}

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
  // FILTRE « Up » (type 2) : chaque ligne est encodée comme sa différence avec
  // la précédente. Sur un fond marin, deux lignes voisines se ressemblent
  // énormément — mesuré : 1,4× de gain contre l'absence de filtre, gratuitement.
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

// --------------------------------------------------------------- source
// UNE source = un dossier pivot. GEBCO livre son monde en PLUSIEURS GeoTIFF
// regionaux : plutot que d'assembler une mosaique de 7,5 Go sur disque, on
// ouvre chaque pivot et on interroge le premier qui couvre le point. C'est
// aussi ce qui permettra d'empiler une source cotiere fine PAR-DESSUS une
// source mondiale — l'ordre des dossiers fait la priorite.
export function openSources(spec) {
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
    // ⚠️ LA CASCADE DOIT PASSER LA TAILLE DU PIXEL, pas seulement le point.
    // `halfLon`/`halfLat` disent à openOne().sample() sur quelle surface
    // moyenner ; un wrapper à deux arguments les avale silencieusement, rx/ry
    // tombent à 0 et tout le moyennage anti-aliasing redevient du plus proche
    // voisin — sans qu'aucun test ni aucune erreur ne le signale.
    sample: (lon, lat, halfLon = 0, halfLat = 0) => {
      for (const o of opened) {
        const v = o.sample(lon, lat, halfLon, halfLat)
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
  const at = (i, j) => {
    const buf = readRow(j)
    const v = bytes === 2 ? buf.readInt16LE(i * 2) : buf.readFloatLE(i * 4)
    return v === meta.noData || !Number.isFinite(v) ? null : v
  }
  // MOYENNE SUR LA CELLULE DE SORTIE, pas plus proche voisin. Quand un pixel de
  // tuile est plus large qu'une cellule source — c'est le cas dès z7, où le
  // pixel fait 1 223 m contre 464 m pour GEBCO — prendre un seul échantillon
  // ALIASE : on tire au hasard dans un champ plus fin. Résultat mesuré : des
  // tuiles z7 six fois plus lourdes que z8 (63 Ko contre 8,6), parce que le
  // bruit d'échantillonnage ne se compresse pas. Le moyennage corrige les deux
  // à la fois — l'image ET le poids.
  //
  // `halfLon`/`halfLat` = demi-taille du pixel de sortie, en degrés.
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
    // pas d'échantillonnage borné : au-delà de 8×8 lectures par pixel le coût
    // dépasse le gain, et la moyenne est déjà stable
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

// -------------------------------------------------------------- encodage m
// ⚠️ ARRONDI AU MÈTRE, et ce n'est pas un détail de confort. GEBCO est en
// mètres ENTIERS ; le moyennage anti-aliasing produit des fractions, et le
// canal B du terrarium code justement le 1/256 de mètre. Sans arrondi, B
// devient du bruit pur sur chaque pixel et le PNG explose — mesuré : 76 Ko par
// tuile avec fractions contre 8,6 Ko sans. Un fond marin donné à 464 m de
// résolution n'a de toute façon rien à dire sous le mètre.
function encodeTerrarium(mRaw) {
  const m = Math.round(mRaw)
  const v = Math.min(32767.99, Math.max(-32768, m)) + 32768
  const r = Math.floor(v / 256)
  const g = Math.floor(v - r * 256)
  const b = Math.round((v - r * 256 - g) * 256)
  if (b === 256) return g === 255 ? [r + 1, 0, 0] : [r, g + 1, 0]
  return [r, g, b]
}

// ------------------------------------------------------------------ pré-passe
// Rend faux seulement si le tamis ne voit QUE de l'abysse : dans ce cas la
// tuile n'a ni côte ni plateau, l'ancien relief suffit.
const PROBE = 32
// --all : cuire TOUTES les tuiles, sans pré-tri. Sert aux niveaux GROSSIERS,
// qui servent de plancher de repli au chargeur (BATHY_ZMIN dans dem.js) : un
// plancher troué laisse des rectangles plats dans la mer.
const BAKE_ALL = process.argv.includes('--all')
function probeWorthIt(src, z, tx, ty) {
  for (let j = 0; j < PROBE; j++) {
    const lat = y2lat(ty + (j + 0.5) / PROBE, z)
    for (let i = 0; i < PROBE; i++) {
      const lon = x2lon(tx + (i + 0.5) / PROBE, z)
      const m = src.sample(lon, lat)
      if (m == null) continue
      if (m >= 0) return true      // de la terre ⇒ une côte ⇒ de l'eau peu profonde
      if (m > SHELF) return true   // du plateau
    }
  }
  return false
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
  console.log(`  plateau : on n'écrit qu'une tuile touchant l'eau plus haute que ${SHELF} m`)
  console.log(`  profondeur : ${QUANT ? 'quantifiée 1 m / 4 m / 8 m selon le fond' : 'au mètre partout (--no-quant)'}`)
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
  let bytes = 0 // cumulé au fil de l'eau : rescanner le dossier serait quadratique
  const t0 = Date.now()

  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = tileRange(z)
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        // PRÉ-PASSE — la tuile mérite-t-elle qu'on l'échantillonne en entier ?
        // Sans elle on lit 65 536 points pour finir par jeter la tuile, ce qui
        // est le cas de ~70 % d'entre elles. Un tamis de 32×32 (un point tous
        // les ~3,5 km à z8) coûte 256 fois moins cher.
        //
        // On garde la tuile si elle voit du plateau OU de la TERRE : une côte
        // implique forcément de l'eau peu profonde, même si le plateau est trop
        // étroit pour tomber sous le tamis (côtes escarpées type Chili).
        if (!BAKE_ALL && !probeWorthIt(src, z, tx, ty)) {
          skipped++
          continue
        }
        const rgb = Buffer.alloc(TILE * TILE * 3)
        let anySea = false
        // la tuile ne sera gardée que si elle touche le plateau (voir SHELF)
        let anyShelf = false
        // demi-largeur d'un pixel de sortie, en degrés — c'est elle qui dit au
        // sampler sur quelle surface moyenner (voir openOne/sample)
        const halfLon = 360 / 2 ** z / TILE / 2
        for (let py = 0; py < TILE; py++) {
          const lat = y2lat(ty + (py + 0.5) / TILE, z)
          // en Mercator la hauteur d'un pixel VARIE avec la latitude : on la
          // mesure sur place plutôt que de la supposer carrée
          const halfLat = Math.abs(y2lat(ty + py / TILE, z) - y2lat(ty + (py + 1) / TILE, z)) / 2
          for (let px = 0; px < TILE; px++) {
            const lon = x2lon(tx + (px + 0.5) / TILE, z)
            const m = src.sample(lon, lat, halfLon, halfLat)
            // ⚠️ ON N'ÉCRIT QUE LA MER — et il faut le faire vraiment, pas
            // seulement le dire. La fusion (src/bathy.js) ignore TOUT pixel
            // émergé : y écrire la vraie altitude ne sert à personne et coûte
            // très cher. Mesuré sur une tuile de la mer Égée : le canal G, qui
            // porte l'octet de poids faible de l'altitude, prenait 62 Ko des
            // 83 Ko de la tuile — uniquement à cause des montagnes turques.
            // Aplatir la terre à zéro la rend constante, donc gratuite.
            const raw = m == null || m >= 0 ? 0 : m
            if (raw < 0) {
              anySea = true
              if (raw > SHELF) anyShelf = true
            }
            const v = raw < 0 ? quantize(raw) : 0
            const [R, G, B] = encodeTerrarium(v)
            const o = (py * TILE + px) * 3
            rgb[o] = R
            rgb[o + 1] = G
            rgb[o + 2] = B
          }
        }
        if (!anySea || !anyShelf) {
          skipped++
          // entièrement à terre, OU entièrement plus profonde que l'isobathe
          // retenue : dans les deux cas l'ancien relief fait déjà l'affaire
          continue
        }
        const dir = path.join(OUT, String(z), String(tx))
        fs.mkdirSync(dir, { recursive: true })
        const png = encodePng(rgb, TILE, TILE)
        fs.writeFileSync(path.join(dir, `${ty}.png`), png)
        bytes += png.length
        written++
        if (written % 250 === 0) {
          const s = (Date.now() - t0) / 1000
          const mo = bytes / 1024 / 1024
          console.log(`  z${z} · ${written.toLocaleString('fr-FR')} écrites · ${skipped.toLocaleString('fr-FR')} écartées · ${(written / s).toFixed(0)}/s · ${mo.toFixed(0)} Mo (${((bytes / written) / 1024).toFixed(1)} Ko/tuile)`)
        }
      }
    }
  }
  src.close()
  const s = (Date.now() - t0) / 1000
  const mo = bytes / 1024 / 1024
  console.log(`\n✓ ${written.toLocaleString('fr-FR')} tuiles écrites, ${skipped.toLocaleString('fr-FR')} écartées en ${s.toFixed(0)} s`)
  console.log(`  ${mo.toFixed(0)} Mo au total, ${((bytes / Math.max(written, 1)) / 1024).toFixed(1)} Ko par tuile`)
  console.log(`  → ${OUT}\n`)
}

// Le script reste un exécutable, mais devient IMPORTABLE : sans ce garde-fou,
// un test qui importe openSources() lancerait une cuisson mondiale.
// (comparaison d'URL plutôt que `import.meta.main`, qui n'existe qu'à partir
// de Node 24.2 — ce script doit rester cuisible sur la machine de quiconque)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
