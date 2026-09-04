// PIVOT BLUETOPO — les GeoTIFF NAD83/UTM de NOAA deviennent le format pivot
// WGS84 (`grid.bin` + `meta.json`) qu'attend DÉJÀ `scripts/build-bathy-tiles.mjs`.
//
// ⚡ C'EST LE SEUL SCRIPT NOUVEAU DE LA CHAÎNE, ET C'EST VOULU.
// Le brief demande de réutiliser plutôt que de réécrire. Le tuileur MARIN
// existant convient tel quel à BlueTopo — contrairement au cas du Léman, où
// B2 a dû écrire un second tuileur parce qu'un lac d'altitude est POSITIF de
// bout en bout et que `raw = m >= 0 ? 0 : m` le jetait intégralement.
// BlueTopo est MARIN : ses élévations sont négatives dans l'eau et NoData sur
// la terre. `build-bathy-tiles.mjs` la cuit donc sans une ligne de changement.
// Ne manquait que le pont depuis l'UTM projeté — le voici, et rien d'autre.
//
// SENS DE PROJECTION : on balaie les pixels SOURCE et on les dépose dans la
// grille de sortie (« scatter »), pas l'inverse. Deux raisons mesurées :
//  1. l'inverse UTM ne dépend, à northing constant, que de la LIGNE : les
//     termes coûteux se calculent une fois par ligne, pas par pixel ;
//  2. le dépôt MOYENNE naturellement (4 m natif vers une maille de 10 m ≈ 6
//     échantillons par cellule) — c'est l'anti-aliasing que le tuileur réclame
//     à grands cris dans openOne(), obtenu gratuitement ;
//  3. et surtout : une cellule qui ne reçoit RIEN reste NaN. Les trous de
//     BlueTopo restent donc des trous, au lieu d'être interpolés en fond
//     inventé. « Une source fine est TOUJOURS trouée » (src/bathy-sources.js).
//
// USAGE
//   node --max-old-space-size=6144 scripts/pivot-bluetopo.mjs \
//        --tiff data/bluetopo/tiff --out data/pivot-chesapeake \
//        --bbox -76.5,36.9,-75.9,37.6 --pas 10

import fs from 'node:fs'
import path from 'node:path'
import { ouvreGeoTiff } from './lit-geotiff.mjs'

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const TIFF = arg('tiff', 'data/bluetopo/tiff')
const OUT = arg('out', 'data/pivot-chesapeake')
const BBOX = (arg('bbox') || '-76.5,36.9,-75.9,37.6').split(',').map(Number)
const PAS = +arg('pas', 10) // maille visée, en mètres

// ────────────────────────────────── INVERSE UTM → WGS84 (NAD83 / GRS80)
// Formules classiques de la transverse de Mercator (Snyder / USGS 1395).
// ⚠️ NAD83 et WGS84 diffèrent de l'ordre du mètre en Amérique du Nord. À z12
// le pixel fait 30,5 m au sol : l'écart est 30 fois sous le pixel, et 4 fois
// sous la maille du pivot. On ne fait donc PAS de transformation de datum —
// et on l'écrit, plutôt que de le taire.
const A = 6378137
const F = 1 / 298.257222101
const E2 = F * (2 - F)
const EP2 = E2 / (1 - E2)
const K0 = 0.9996
const FE = 500000
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
const M0 = A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256)

// Tout ce qui ne dépend QUE du northing — calculé une fois par ligne.
function ligneUtm(northing) {
  const mu = northing / K0 / M0
  const phi1 =
    mu +
    ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * E1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu)
  const s = Math.sin(phi1)
  const c = Math.cos(phi1)
  const t = Math.tan(phi1)
  const C1 = EP2 * c * c
  const T1 = t * t
  const rad = Math.sqrt(1 - E2 * s * s)
  const N1 = A / rad
  const R1 = (A * (1 - E2)) / rad ** 3
  return { phi1, c, t, C1, T1, N1, R1 }
}

function utmVersLatLon(L, easting, lon0Deg) {
  const D = (easting - FE) / (L.N1 * K0)
  const D2 = D * D
  const { T1, C1, N1, R1, t, c, phi1 } = L
  const lat =
    phi1 -
    ((N1 * t) / R1) *
      (D2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D2 * D2) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D2 ** 3) / 720)
  const lon =
    (D -
      ((1 + 2 * T1 + C1) * D2 * D) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D2 * D2 * D) / 120) /
    c
  return [(lat * 180) / Math.PI, lon0Deg + (lon * 180) / Math.PI]
}

// ────────────────────────────────────────────────────────────────── main
function main() {
  const [W, S, E, N] = BBOX
  const latMid = (S + N) / 2
  const dLat = PAS / 111320
  const dLon = PAS / (111320 * Math.cos((latMid * Math.PI) / 180))
  const largeur = Math.round((E - W) / dLon)
  const hauteur = Math.round((N - S) / dLat)
  const cells = largeur * hauteur

  console.log(`\nPivot BlueTopo — bbox ${BBOX.join(',')}, maille ${PAS} m`)
  console.log(`  grille ${largeur} × ${hauteur} = ${cells.toLocaleString('fr-FR')} cellules`)
  console.log(`  ${((cells * 4) / 1e6).toFixed(1)} Mo de grid.bin`)

  const fichiers = fs
    .readdirSync(TIFF)
    .filter((f) => /\.tiff?$/i.test(f))
    .map((f) => path.join(TIFF, f))
  console.log(`  ${fichiers.length} GeoTIFF à fondre`)
  if (!fichiers.length) throw new Error(`aucun GeoTIFF dans ${TIFF}`)

  const somme = new Float64Array(cells)
  const compte = new Uint16Array(cells)
  const t0 = Date.now()
  let lus = 0
  let deposes = 0
  let horsBbox = 0
  const zones = new Set()

  for (const f of fichiers) {
    const t = ouvreGeoTiff(f)
    if (!t.epsg || t.epsg < 26901 || t.epsg > 26923)
      throw new Error(`${f} : EPSG ${t.epsg} inattendu (on attend NAD83/UTM nord 269xx)`)
    const zone = t.epsg - 26900
    zones.add(zone)
    const lon0 = -183 + 6 * zone // méridien central de la zone UTM
    for (let j = 0; j < t.hauteur; j++) {
      const northing = t.oy - (j + 0.5) * t.py
      const L = ligneUtm(northing)
      for (let i = 0; i < t.largeur; i++) {
        const v = t.elevation(i, j)
        if (!Number.isFinite(v)) continue
        lus++
        const [lat, lon] = utmVersLatLon(L, t.ox + (i + 0.5) * t.px, lon0)
        const gx = Math.floor((lon - W) / dLon)
        const gy = Math.floor((N - lat) / dLat)
        if (gx < 0 || gy < 0 || gx >= largeur || gy >= hauteur) {
          horsBbox++
          continue
        }
        const k = gy * largeur + gx
        somme[k] += v
        if (compte[k] < 65535) compte[k]++
        deposes++
      }
    }
    process.stderr.write(
      `  ${path.basename(f)} — ${(deposes / 1e6).toFixed(1)} M déposés, ${((Date.now() - t0) / 1000).toFixed(0)} s\r`,
    )
  }

  // moyenne, NaN là où personne n'a rien dit (= le trou reste un trou)
  const grille = new Float32Array(cells)
  let pleines = 0
  let mn = Infinity
  let mx = -Infinity
  let mnLat = 0
  let mnLon = 0
  for (let k = 0; k < cells; k++) {
    if (!compte[k]) {
      grille[k] = NaN
      continue
    }
    const v = somme[k] / compte[k]
    grille[k] = v
    pleines++
    if (v < mn) {
      mn = v
      mnLat = N - (Math.floor(k / largeur) + 0.5) * dLat
      mnLon = W + ((k % largeur) + 0.5) * dLon
    }
    if (v > mx) mx = v
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'grid.bin'), Buffer.from(grille.buffer))
  const meta = {
    width: largeur,
    height: hauteur,
    west: W,
    east: W + largeur * dLon,
    south: N - hauteur * dLat,
    north: N,
    dtype: 'float32',
    noData: NaN,
    _source: 'NOAA BlueTopo (CC0-1.0) — NAD83/UTM ' + [...zones].join(',') + ' + NAVD88',
    _pas_m: PAS,
    _tiffs: fichiers.length,
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2))

  const s = (Date.now() - t0) / 1000
  console.log(`\n\n✓ ${s.toFixed(0)} s — zones UTM ${[...zones].join(', ')}`)
  console.log(`  ${(lus / 1e6).toFixed(1)} M pixels source lus, ${horsBbox.toLocaleString('fr-FR')} hors bbox`)
  console.log(
    `  ${pleines.toLocaleString('fr-FR')} / ${cells.toLocaleString('fr-FR')} cellules remplies (${((100 * pleines) / cells).toFixed(1)} %)`,
  )
  console.log(`  fond le plus bas : ${mn.toFixed(2)} m à ${mnLat.toFixed(5)} N / ${mnLon.toFixed(5)} E`)
  console.log(`  point le plus haut : ${mx.toFixed(2)} m`)
  console.log(`  → ${OUT}\n`)
}

main()
