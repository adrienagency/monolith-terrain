// Fetch GeoNames cities5000 (all populated places with population > 5000),
// tier them by population -> min_zoom, and emit a compact array to
// public/data/map/places.json for progressive label reveal on the globe.
// Public domain (GeoNames, CC BY 4.0 — https://www.geonames.org/).
// Run: npm run build:places
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { popToMinZoom } from '../src/map/place-tier.js'

const URL_ZIP = 'https://download.geonames.org/export/dump/cities5000.zip'
const TXT_NAME = 'cities5000.txt'
const OUT = new URL('../public/data/map/', import.meta.url)
const MAX_ENTRIES = 40000

const round = (n) => Math.round(n * 1e4) / 1e4

async function fetchZipText() {
  console.log(`fetching ${URL_ZIP} ...`)
  const res = await fetch(URL_ZIP)
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())

  const tmpDir = await mkdirTemp()
  const zipPath = join(tmpDir, 'cities5000.zip')
  await writeFile(zipPath, buf)
  try {
    // git-bash / unix `unzip` extracts straight to stdout with -p, no
    // intermediate files needed.
    const out = execFileSync('unzip', ['-p', zipPath, TXT_NAME], { maxBuffer: 1024 * 1024 * 512 })
    return out.toString('utf8')
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

async function mkdirTemp() {
  const dir = join(tmpdir(), `geonames-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(dir, { recursive: true })
  return dir
}

function parseRows(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!line) continue
    const cols = line.split('\t')
    if (cols.length < 15) continue
    const name = cols[1]
    const lat = Number(cols[4])
    const lon = Number(cols[5])
    const featureCode = cols[7]
    const population = Number(cols[14])
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (!(population > 0)) continue
    const capital = featureCode === 'PPLC'
    rows.push([name, round(lat), round(lon), population, capital ? 1 : 0, popToMinZoom(population, capital)])
  }
  return rows
}

async function main() {
  const text = await fetchZipText()
  let rows = parseRows(text)
  rows.sort((a, b) => b[3] - a[3])
  if (rows.length > MAX_ENTRIES) rows = rows.slice(0, MAX_ENTRIES)

  await mkdir(OUT, { recursive: true })
  await writeFile(new URL('places.json', OUT), JSON.stringify(rows))
  console.log(`wrote ${rows.length} places to public/data/map/places.json`)
}

main().catch((err) => {
  console.error('build:places failed:', err.message)
  process.exit(1)
})
