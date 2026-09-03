#!/usr/bin/env node
// PIVOT swissBATHY3D → le format brut attendu par scripts/build-bathy-tiles.mjs
// (grid.bin + meta.json), mais en WGS84 et pour un LAC.
//
// POURQUOI UN SCRIPT À PART plutôt que d'étendre gebco-to-raw.py : swisstopo ne
// livre pas un GeoTIFF mondial mais 693 dalles ESRI ASCII de 1 km² en CHLV95
// (EPSG:2056), altitudes en LN02. Il faut donc reprojeter, et le pont Python
// n'a ni GDAL ni pyproj sur cette machine. Les formules approchées de swisstopo
// (« Formules et constantes pour le calcul de la projection suisse », ~1 m de
// justesse) suffisent très largement devant une donnée à 2 m.
//
// ⚠️ LA VALEUR SENTINELLE, ET C'EST ELLE QUI REND LA CHOSE SÛRE.
// Hors du lac, on n'écrit PAS `nodata` et surtout PAS 0 : on écrit
// `nappe + SENTINELLE`. `fuseBathymetry` lit tout échantillon marin >= niveau
// comme une ABSENCE et rend le terrarium tel quel — donc une berge, un versant
// ou une vallée en aval restent intouchés même s'ils sont plus bas que la
// nappe. Sans ça, la rive se fait creuser (mesuré : cas 2 et 3 de
// scripts/sonde-lacs-b2.mjs).
//
// USAGE
//   node scripts/pivot-swissbathy3d.mjs --src data/swissbathy3d/asc \
//        --out data/pivot-leman --nappe 372.05 --pas 5
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const SRC = arg('src', 'data/swissbathy3d/asc')
const OUT = arg('out', 'data/pivot-leman')
// Cote officielle de régulation du Léman, LN02. Source : CIPEL / OFEV.
const NAPPE = +arg('nappe', 372.05)
const PAS = +arg('pas', 5) // pas du pivot, en mètres au sol
const SENTINELLE = 1 // mètres au-dessus de la nappe, hors lac

// ── CHLV95 <-> WGS84, formules approchées swisstopo ─────────────────────────
function wgs84ToLv95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000
  const l = (lon * 3600 - 26782.5) / 10000
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3
  const N =
    1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3
  return [E, N]
}
function lv95ToWgs84(E, N) {
  const y = (E - 2600000) / 1e6
  const x = (N - 1200000) / 1e6
  const lon = ((2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3) * 100) / 36
  const lat =
    ((16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3) * 100) / 36
  return [lat, lon]
}

// ── les dalles ASCII, indexées par leur coin, chargées à la demande ─────────
// 693 dalles x 250 000 cellules feraient 350 Mo en mémoire si on les gardait
// toutes. On balaie le pivot ligne par ligne (nord -> sud) : un cache LRU de
// quelques dizaines de dalles suffit et tient dans 20 Mo.
function lireEntete(file) {
  const fd = fs.openSync(file, 'r')
  const buf = Buffer.alloc(4096)
  const n = fs.readSync(fd, buf, 0, 4096, 0)
  fs.closeSync(fd)
  const t = buf.subarray(0, n).toString('latin1')
  const g = (k) => {
    const m = t.match(new RegExp(`${k}\\s+(-?[0-9.]+)`, 'i'))
    return m ? +m[1] : null
  }
  return {
    ncols: g('ncols'),
    nrows: g('nrows'),
    xll: g('xllcorner'),
    yll: g('yllcorner'),
    cell: g('cellsize'),
    nodata: g('nodata_value'),
  }
}

function chargerDalle(file, h) {
  // Parseur numérique à la main : `split(/\s+/)` sur 2 Mo de texte alloue des
  // millions de chaînes et dominait le temps de cuisson.
  const txt = fs.readFileSync(file, 'latin1')
  const g = new Float32Array(h.ncols * h.nrows)
  let i = 0
  let k = 0
  let lignes = 0
  while (lignes < 6 && i < txt.length) {
    if (txt.charCodeAt(i) === 10) lignes++
    i++
  }
  const blanc = (c) => c === 32 || c === 10 || c === 13 || c === 9
  while (i < txt.length && k < g.length) {
    while (i < txt.length && blanc(txt.charCodeAt(i))) i++
    if (i >= txt.length) break
    let j = i
    while (j < txt.length && !blanc(txt.charCodeAt(j))) j++
    g[k++] = +txt.slice(i, j)
    i = j
  }
  return g
}

function ouvrirDalles(dir) {
  const fichiers = fs.readdirSync(dir).filter((f) => f.endsWith('.asc'))
  const dalles = fichiers.map((f) => ({ file: path.join(dir, f), h: lireEntete(path.join(dir, f)), data: null }))
  let minE = Infinity
  let maxE = -Infinity
  let minN = Infinity
  let maxN = -Infinity
  for (const d of dalles) {
    minE = Math.min(minE, d.h.xll)
    maxE = Math.max(maxE, d.h.xll + d.h.ncols * d.h.cell)
    minN = Math.min(minN, d.h.yll)
    maxN = Math.max(maxN, d.h.yll + d.h.nrows * d.h.cell)
  }
  // Grille de recherche au kilomètre : tester les 693 dalles une par une pour
  // chacun des ~80 M de points du pivot ferait 55 milliards de tests.
  const KM = 1000
  const cle = (a, b) => `${a}|${b}`
  const seau = new Map()
  for (const d of dalles) {
    const a0 = Math.floor(d.h.xll / KM)
    const a1 = Math.floor((d.h.xll + d.h.ncols * d.h.cell) / KM)
    const b0 = Math.floor(d.h.yll / KM)
    const b1 = Math.floor((d.h.yll + d.h.nrows * d.h.cell) / KM)
    for (let a = a0; a <= a1; a++)
      for (let b = b0; b <= b1; b++) {
        const k = cle(a, b)
        if (!seau.has(k)) seau.set(k, [])
        seau.get(k).push(d)
      }
  }
  const lru = []
  const charger = (d) => {
    if (d.data) return d.data
    d.data = chargerDalle(d.file, d.h)
    lru.push(d)
    if (lru.length > 48) {
      const v = lru.shift()
      if (v !== d) v.data = null
    }
    return d.data
  }
  return {
    bbox: { minE, maxE, minN, maxN },
    n: dalles.length,
    sample(E, N) {
      const l = seau.get(cle(Math.floor(E / KM), Math.floor(N / KM)))
      if (!l) return null
      for (const d of l) {
        const { h } = d
        const i = Math.floor((E - h.xll) / h.cell)
        // ASCII grid : la ligne 0 est celle du NORD
        const j = Math.floor((h.yll + h.nrows * h.cell - N) / h.cell)
        if (i < 0 || j < 0 || i >= h.ncols || j >= h.nrows) continue
        const v = charger(d)[j * h.ncols + i]
        if (v === h.nodata || !Number.isFinite(v)) continue
        return v
      }
      return null
    },
  }
}

// ── cuisson du pivot ────────────────────────────────────────────────────────
function main() {
  const src = ouvrirDalles(SRC)
  const { minE, maxE, minN, maxN } = src.bbox
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [E, N] of [
    [minE, minN],
    [minE, maxN],
    [maxE, minN],
    [maxE, maxN],
  ]) {
    const [la, lo] = lv95ToWgs84(E, N)
    west = Math.min(west, lo)
    east = Math.max(east, lo)
    south = Math.min(south, la)
    north = Math.max(north, la)
  }
  const latMid = (south + north) / 2
  const dLat = PAS / 111320
  const dLon = PAS / (111320 * Math.cos((latMid * Math.PI) / 180))
  const width = Math.ceil((east - west) / dLon)
  const height = Math.ceil((north - south) / dLat)

  console.log('\nPivot swissBATHY3D -> WGS84')
  console.log(`  ${src.n} dalles ASCII, CHLV95 ${Math.round(minE)}..${Math.round(maxE)} / ${Math.round(minN)}..${Math.round(maxN)}`)
  console.log(`  emprise  ${west.toFixed(5)} .. ${east.toFixed(5)} degE   ${south.toFixed(5)} .. ${north.toFixed(5)} degN`)
  console.log(`  nappe    ${NAPPE} m LN02 · sentinelle hors lac ${NAPPE + SENTINELLE} m`)
  console.log(`  grille   ${width} x ${height} = ${((width * height) / 1e6).toFixed(1)} M cellules · pas ${PAS} m · ${((width * height * 2) / 1024 / 1024).toFixed(0)} Mo`)

  fs.mkdirSync(OUT, { recursive: true })
  const fd = fs.openSync(path.join(OUT, 'grid.bin'), 'w')
  const ligne = Buffer.alloc(width * 2)
  let dansLac = 0
  let minAlt = Infinity
  let minLat = 0
  let minLon = 0
  const t0 = Date.now()
  for (let j = 0; j < height; j++) {
    const lat = north - (j + 0.5) * dLat
    for (let i = 0; i < width; i++) {
      const lon = west + (i + 0.5) * dLon
      const [E, N] = wgs84ToLv95(lat, lon)
      const v = src.sample(E, N)
      let m
      if (v == null || v >= NAPPE) {
        m = NAPPE + SENTINELLE // ⚠️ pas 0, pas nodata — voir l'en-tête
      } else {
        m = v
        dansLac++
        if (v < minAlt) {
          minAlt = v
          minLat = lat
          minLon = lon
        }
      }
      ligne.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(m))), i * 2)
    }
    fs.writeSync(fd, ligne)
    if (j % 500 === 0) process.stdout.write(`\r  ligne ${j}/${height}  (${((Date.now() - t0) / 1000).toFixed(0)} s)   `)
  }
  fs.closeSync(fd)

  const meta = {
    width,
    height,
    west,
    east,
    south,
    north,
    dtype: 'int16',
    // ⚠️ AUCUNE cellule ne vaut le noData : la sentinelle en tient lieu, et
    // elle est POSITIVE, donc relue par la fusion comme « rien à dire ici ».
    noData: -32768,
    _source: 'swissBATHY3D (swisstopo), 2 m, CHLV95/LN02, reprojeté WGS84',
    _nappeM: NAPPE,
    _sentinelleM: NAPPE + SENTINELLE,
    _credit: 'Federal Office of Topography swisstopo',
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2))
  const octets = fs.statSync(path.join(OUT, 'grid.bin')).size
  console.log(`\n\n✓ ${OUT}/grid.bin — ${(octets / 1024 / 1024).toFixed(1)} Mo`)
  console.log(`  ${dansLac.toLocaleString('fr-FR')} cellules DANS le lac (${((100 * dansLac) / (width * height)).toFixed(1)} %)`)
  console.log(`  point le plus bas : ${minAlt.toFixed(2)} m LN02  ->  ${(NAPPE - minAlt).toFixed(2)} m sous la nappe`)
  console.log(`  a ${minLat.toFixed(5)} degN ${minLon.toFixed(5)} degE`)
  console.log('  REFERENCE : Leman, profondeur maximale 309,7 m (CIPEL)\n')
}
main()
