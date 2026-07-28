// Découpe les couches Natural Earth du monde entier en cellules géographiques.
//
// POURQUOI — mesuré en production le 2026-07-28 : le chargement à froid jusqu'à
// la carte pesait 10,7 Mo / 97 requêtes / 5,7 s, dont 2,67 Mo pour places.json
// (158 474 entrées, la planète) et 935 Ko pour lakes.json, téléchargés
// INTÉGRALEMENT à chaque démarrage pour n'afficher que les entités du bloc
// courant (~27 km, quelques dizaines de lieux). L'hébergement est statique
// (Netlify, ni serveur ni base) : impossible d'interroger « les noms demandés ».
// On pré-découpe donc à la construction, et le client ne tire que les 1 à 4
// cellules qui recouvrent son emprise (voir src/map/geo-cells.js).
//
// STRATÉGIE PAR TYPE DE GÉOMÉTRIE
//   • points (places)   → chaque entrée va dans sa cellule, écrite une seule fois.
//   • lignes (rivers, coastline, roads) → la polyligne est DÉCOUPÉE aux
//     frontières de cellule ; chaque tronçon reprend le point de sortie de la
//     cellule voisine pour que le trait reste continu, sans trou visible.
//   • polygones (lakes) → recopiés ENTIERS dans chaque cellule que leur bbox
//     touche. Les découper casserait les remplissages et les trous. La copie
//     est marquée d'un `fid` stable pour que le client dédoublonne à la fusion
//     (sinon un lac frontalier serait dessiné deux fois). C'est pour ça que
//     lakes prend des cellules de 10° et pas de 2° : à 2° la recopie coûtait
//     x2,89 en octets déployés, à 10° elle coûte x1,25.
//
// SÛRETÉ — le script ne touche JAMAIS aux fichiers d'origine. Il écrit à côté,
// sous public/data/map/cells/. Tant que la bascule n'est pas prouvée, les deux
// chemins coexistent ; `--prune` (à lancer plus tard, sciemment) supprime les
// monolithes une fois la nouvelle voie validée en production.
//
// Rejouable : le dossier de chaque couche est vidé avant réécriture.
//
// Usage :  node scripts/build-map-cells.mjs            (découpe + manifeste)
//          node scripts/build-map-cells.mjs --stats    (mesure seulement, n'écrit rien)
//          node scripts/build-map-cells.mjs --prune    (supprime les monolithes — après validation)

import { mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CELL_SIZES, cellIndex, buildBits } from '../src/map/geo-cells.js'

const SRC = fileURLToPath(new URL('../public/data/map/', import.meta.url))
const OUT = path.join(SRC, 'cells')
const ARGS = new Set(process.argv.slice(2))
const STATS_ONLY = ARGS.has('--stats')
const PRUNE = ARGS.has('--prune')

const gz = (s) => gzipSync(Buffer.from(s), { level: 9 }).length
const ko = (n) => `${(n / 1024).toFixed(0)} Ko`
const mo = (n) => `${(n / 1e6).toFixed(2)} Mo`

const keyOf = (size, lat, lon) => {
  const { row, col } = cellIndex(size, lat, lon)
  return `${row}_${col}`
}

// --------------------------------------------------------------- géométrie

// Découpe une polyligne en tronçons par cellule. Chaque tronçon inclut le
// premier point de l'autre côté de la frontière (en sortie ET en entrée) :
// c'est ce recouvrement d'UN sommet qui évite le trou d'un pixel entre deux
// cellules voisines. Coût mesuré : x1,03 à x1,08 en octets pour 5°.
function splitLine(coords, size) {
  const out = new Map()
  if (!Array.isArray(coords) || coords.length < 2) return out
  const push = (k, run) => { if (!out.has(k)) out.set(k, []); out.get(k).push(run) }
  let cur = [coords[0]]
  let curK = keyOf(size, coords[0][1], coords[0][0])
  for (let i = 1; i < coords.length; i++) {
    const k = keyOf(size, coords[i][1], coords[i][0])
    if (k === curK) { cur.push(coords[i]); continue }
    cur.push(coords[i])              // le tronçon sortant va jusqu'au point d'après
    push(curK, cur)
    cur = [coords[i - 1], coords[i]] // le tronçon entrant part du point d'avant
    curK = k
  }
  if (cur.length >= 2) push(curK, cur)
  return out
}

function bboxOf(coords) {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0])
      minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1])
    } else c.forEach(walk)
  }
  walk(coords)
  return { minLon, minLat, maxLon, maxLat }
}

// --------------------------------------------------------------- découpage

function cutLayer(name, data, size) {
  const cells = new Map()
  const push = (k, v) => { if (!cells.has(k)) cells.set(k, []); cells.get(k).push(v) }

  if (Array.isArray(data)) {                       // places : [nom, lat, lon, pop, cap, minZoom]
    for (const row of data) push(keyOf(size, row[1], row[2]), row)
    // l'ordre source (population décroissante) est préservé cellule par cellule ;
    // le client retrie de toute façon après fusion (cf. mergeCells).
    return { cells, kind: 'array' }
  }

  let fid = 0
  for (const f of data.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'LineString' || g.type === 'MultiLineString') {
      const lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]
      const per = new Map()
      for (const l of lines) {
        for (const [k, runs] of splitLine(l, size)) {
          if (!per.has(k)) per.set(k, [])
          per.get(k).push(...runs)
        }
      }
      for (const [k, runs] of per) {
        push(k, {
          type: 'Feature',
          properties: f.properties,
          geometry: runs.length === 1
            ? { type: 'LineString', coordinates: runs[0] }
            : { type: 'MultiLineString', coordinates: runs },
        })
      }
    } else {                                        // polygones : copie entière + fid
      const id = fid++
      const b = bboxOf(g.coordinates)
      const marked = { type: 'Feature', properties: { ...f.properties, fid: id }, geometry: g }
      const lo = cellIndex(size, b.minLat, b.minLon)
      const hi = cellIndex(size, b.maxLat, b.maxLon)
      for (let r = lo.row; r <= hi.row; r++) {
        for (let c = lo.col; c <= hi.col; c++) push(`${r}_${c}`, marked)
      }
    }
  }
  return { cells, kind: 'fc' }
}

const payloadOf = (kind, list) => (kind === 'array' ? list : { type: 'FeatureCollection', features: list })

// --------------------------------------------------------------- exécution

async function dirBytes(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    total += e.isDirectory() ? await dirBytes(p) : (await stat(p)).size
  }
  return total
}

const layers = {}
let gzAvant = 0
let gzApres = 0
let fichiers = 0

for (const [name, size] of Object.entries(CELL_SIZES)) {
  const src = path.join(SRC, `${name}.json`)
  if (!existsSync(src)) { console.warn(`  ! ${name}.json absent — ignoré`); continue }
  const raw = await readFile(src, 'utf8')
  const data = JSON.parse(raw)
  const avant = gz(raw)
  gzAvant += avant

  const { cells, kind } = cutLayer(name, data, size)
  const dir = path.join(OUT, name)
  if (!STATS_ONLY) { await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true }) }

  let apres = 0
  let maxCell = 0
  const writes = []
  for (const [key, list] of cells) {
    const s = JSON.stringify(payloadOf(kind, list))
    const g = gz(s)
    apres += g
    maxCell = Math.max(maxCell, g)
    if (!STATS_ONLY) {
      const [row, col] = key.split('_')
      writes.push(mkdir(path.join(dir, row), { recursive: true }).then(() => writeFile(path.join(dir, row, `${col}.json`), s)))
    }
  }
  await Promise.all(writes)
  gzApres += apres
  fichiers += cells.size

  layers[name] = { size, bits: buildBits(size, [...cells.keys()]), cells: cells.size }
  console.log(
    `  ${name.padEnd(10)} ${String(size).padStart(2)}°  ${String(cells.size).padStart(5)} fichiers` +
    `   gz ${mo(avant)} → ${mo(apres)} (x${(apres / avant).toFixed(2)})   pire cellule ${ko(maxCell)}`
  )
}

if (!STATS_ONLY) {
  await mkdir(OUT, { recursive: true })
  const manifest = { version: 1, genere: new Date().toISOString().slice(0, 10), layers }
  const s = JSON.stringify(manifest)
  await writeFile(path.join(OUT, 'index.json'), s)
  console.log(`\n  manifeste  cells/index.json  ${ko(s.length)} brut → ${ko(gz(s))} gzip`)
}

console.log(`\n  TOTAL déployé (gzip)  ${mo(gzAvant)} → ${mo(gzApres)}  (x${(gzApres / gzAvant).toFixed(2)})  en ${fichiers} fichiers`)
if (!STATS_ONLY) console.log(`  sur disque : cells/ = ${mo(await dirBytes(OUT))} (les monolithes sont intacts)`)

if (PRUNE) {
  // À ne lancer qu'APRÈS validation en production : supprime les fichiers
  // monde entier, qui servent aussi de filet de repli si le manifeste manque.
  for (const name of Object.keys(CELL_SIZES)) {
    const p = path.join(SRC, `${name}.json`)
    if (existsSync(p)) { await rm(p); console.log(`  supprimé ${name}.json`) }
  }
}
