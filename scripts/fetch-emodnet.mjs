#!/usr/bin/env node
// ACQUISITION EMODnet BATHYMETRY DTM 2024 → format pivot du tuileur.
//
// POURQUOI. GEBCO_2026 décrit le monde à 15″ ≈ 464 m, ce qui plafonne nos
// tuiles à z8 (498 m/px) : au-delà on ne fait qu'agrandir. EMODnet publie les
// mers européennes à 1/16 de minute d'arc = 3,75″ ≈ 115 m, soit 4× plus fin en
// linéaire et 16× en nombre de cellules. C'est la seule source qui, à la fois,
// couvre une façade entière, se télécharge sans compte, et porte une licence
// commerciale sans ambiguïté (CC BY 4.0).
//
// ⚠️ LICENCE — CC BY 4.0. L'attribution est imposée MOT POUR MOT :
//   « This data product was created by EMODnet and is owned by the EU and
//     licensed under CC BY 4.0. »
// et la métadonnée du DTM porte « DO NOT USE FOR NAVIGATION ». Ces deux
// phrases vivent dans src/bathy-sources.js (SOURCES.emodnet) et doivent
// remonter jusqu'à la ligne de crédits des exports. Ce n'est pas une option.
//   https://emodnet.ec.europa.eu/en/terms-use-emodnet-online-services-data-and-data-products
//
// ⚠️ CE QUE LE GAIN N'EST PAS. EMODnet rebouche ses trous avec GEBCO 2024,
// IBCAO 5 et GMRT. Le 16× n'est réel que là où il y a eu des levés — large
// plateau breton oui, large méditerranéen beaucoup moins. Mesurer avant de
// promettre.
//
// ACCÈS, vérifié le 2026-07-28 (ne pas supposer, tester) :
//   GetCapabilities  HTTP 200, 15,7 Ko
//   GetCoverage 1°×1°  HTTP 200, 960×960 px float32, 4,19 Mo, ~1,2 s
//   couverture emodnet__mean : lon −70,5..43 · lat 11..90 (Europe + Caraïbes)
//
// USAGE
//   node scripts/fetch-emodnet.mjs --bbox -6,41,10,52 --out data/emodnet-fr
//   node scripts/fetch-emodnet.mjs --bbox -6,41,10,52 --out data/emodnet-fr --dry
//
// REJOUABLE. L'état des dalles déjà écrites est tenu dans `<out>/.dalles.json` :
// relancer la commande reprend où elle s'était arrêtée. `--force` repart de zéro.
//
// SORTIE : le format pivot déjà lu par scripts/build-bathy-tiles.mjs —
// `grid.bin` (int16 little-endian, ligne par ligne, nord en haut) + `meta.json`.
// N'importe quelle source se ramène à ce pivot ; le tuileur n'a qu'un seul
// format d'entrée à connaître.

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

const WCS = arg('wcs', 'https://ows.emodnet-bathymetry.eu/wcs')
const COVERAGE = arg('coverage', 'emodnet__mean')
const OUT = arg('out', 'data/emodnet')
const DRY = flag('dry')
const FORCE = flag('force')
// Dalles de 1° : mesuré à 4,19 Mo et ~1,2 s pièce. Plus grand fait grossir le
// pic mémoire sans gagner de temps ; plus petit multiplie les allers-retours.
const STEP = +arg('step', 1)
// 4 en parallèle : le service est public et gratuit, on ne le mitraille pas.
const PAR = +arg('par', 4)
const [BW, BS, BE, BN] = (arg('bbox') || '-6,41,10,52').split(',').map(Number)

// Grille NATIVE d'EMODnet : 1/16 de minute d'arc = 1/960 de degré. On aligne
// le pivot dessus au lieu de choisir une résolution ronde — rééchantillonner
// une source pour faire joli, c'est perdre le gain qu'on est venu chercher.
const CELL = 1 / 960

// -------------------------------------------------------------- lecteur TIFF
// Le WCS sert un GeoTIFF float32, tuilé, non compressé (vérifié : une tuile de
// 1024×1024 pour une dalle de 960×960). Trente lignes de décodage évitent
// d'exiger GDAL ou rasterio, absents de la machine — c'est le même arbitrage
// que scripts/gebco-to-raw.py, et que l'encodeur PNG écrit à la main dans
// build-bathy-tiles.mjs.
const TYPESZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

function readTiff(buf) {
  const be = buf[0] === 0x4d // 'MM'
  const u16 = (o) => (be ? buf.readUInt16BE(o) : buf.readUInt16LE(o))
  const u32 = (o) => (be ? buf.readUInt32BE(o) : buf.readUInt32LE(o))
  const ifd = u32(4)
  const n = u16(ifd)
  const tags = {}
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    const tag = u16(e)
    const typ = u16(e + 2)
    const cnt = u32(e + 4)
    const size = (TYPESZ[typ] ?? 1) * cnt
    const at = size <= 4 ? e + 8 : u32(e + 8)
    const vals = []
    for (let k = 0; k < cnt; k++) {
      if (typ === 3) vals.push(u16(at + k * 2))
      else if (typ === 4) vals.push(u32(at + k * 4))
      else if (typ === 12) vals.push(be ? buf.readDoubleBE(at + k * 8) : buf.readDoubleLE(at + k * 8))
      else if (typ === 11) vals.push(be ? buf.readFloatBE(at + k * 4) : buf.readFloatLE(at + k * 4))
      else vals.push(buf[at + k])
    }
    tags[tag] = vals
  }
  const w = tags[256][0]
  const h = tags[257][0]
  const bits = tags[258][0]
  const comp = tags[259]?.[0] ?? 1
  const fmt = tags[339]?.[0] ?? 1
  if (bits !== 32 || fmt !== 3) throw new Error(`TIFF inattendu : ${bits} bits, format ${fmt} (float32 attendu)`)
  const grab = (o, c) => (comp === 8 ? zlib.inflateSync(buf.subarray(o, o + c)) : buf.subarray(o, o + c))
  const out = new Float32Array(w * h)
  const readF = (b, o) => (be ? b.readFloatBE(o) : b.readFloatLE(o))
  if (tags[322]) {
    const tw = tags[322][0]
    const th = tags[323][0]
    const across = Math.ceil(w / tw)
    const offs = tags[324]
    const lens = tags[325]
    for (let k = 0; k < offs.length; k++) {
      const d = grab(offs[k], lens[k])
      const y0 = Math.floor(k / across) * th
      const x0 = (k % across) * tw
      for (let y = 0; y < th && y0 + y < h; y++) {
        for (let x = 0; x < tw && x0 + x < w; x++) {
          out[(y0 + y) * w + x0 + x] = readF(d, (y * tw + x) * 4)
        }
      }
    }
  } else {
    const d = Buffer.concat(tags[273].map((o, k) => Buffer.from(grab(o, tags[279][k]))))
    for (let i = 0; i < w * h; i++) out[i] = readF(d, i * 4)
  }
  return { data: out, width: w, height: h }
}

// ------------------------------------------------------------------- réseau
async function fetchDalle(w, s, e, n, tries = 4) {
  const url =
    `${WCS}?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${COVERAGE}` +
    `&subset=Long(${w},${e})&subset=Lat(${s},${n})&format=image/tiff`
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      // Le WCS répond parfois un XML d'erreur avec un code 200 : un GeoTIFF
      // commence par 'II' ou 'MM', jamais par '<'.
      if (buf[0] !== 0x49 && buf[0] !== 0x4d) {
        throw new Error(`réponse non-TIFF : ${buf.subarray(0, 160).toString('utf8').replace(/\s+/g, ' ')}`)
      }
      return readTiff(buf)
    } catch (err) {
      if (t === tries) throw err
      // repli exponentiel : le service est mutualisé, un 500 passager est normal
      await new Promise((r) => setTimeout(r, 800 * 2 ** (t - 1)))
    }
  }
}

// ------------------------------------------------------------------ cuisson
function main() {
  // On aligne l'emprise sur la grille native : sans ça, chaque dalle tomberait
  // à un demi-pixel de sa voisine et on recollerait un raster flou.
  const west = Math.floor(BW / CELL) * CELL
  const north = Math.ceil(BN / CELL) * CELL
  const width = Math.round((Math.ceil(BE / CELL) * CELL - west) / CELL)
  const height = Math.round((north - Math.floor(BS / CELL) * CELL) / CELL)
  const east = west + width * CELL
  const south = north - height * CELL

  const dalles = []
  for (let s = Math.floor(BS / STEP) * STEP; s < BN; s += STEP) {
    for (let w = Math.floor(BW / STEP) * STEP; w < BE; w += STEP) {
      dalles.push([w, s, w + STEP, s + STEP])
    }
  }

  console.log(`\nEMODnet DTM 2024 → pivot  ·  couverture ${COVERAGE}`)
  console.log(`  emprise  ${west.toFixed(4)}..${east.toFixed(4)} E · ${south.toFixed(4)}..${north.toFixed(4)} N`)
  console.log(`  grille   ${width} × ${height} px à 1/960° (≈ 115 m) = ${((width * height * 2) / 1024 / 1024).toFixed(0)} Mo de pivot`)
  console.log(`  réseau   ${dalles.length} dalles de ${STEP}° ≈ ${((dalles.length * 4.19)).toFixed(0)} Mo téléchargés, ~${Math.ceil((dalles.length * 1.2) / PAR / 60)} min à ${PAR} en parallèle`)
  console.log(`  licence  CC BY 4.0 — l'attribution EMODnet est OBLIGATOIRE (voir src/bathy-sources.js)`)
  if (DRY) {
    console.log('\n--dry : rien n\'a été téléchargé ni écrit.\n')
    return
  }

  fs.mkdirSync(OUT, { recursive: true })
  const binPath = path.join(OUT, 'grid.bin')
  const statePath = path.join(OUT, '.dalles.json')
  const NO_DATA = -32768

  // Le pivot est alloué EN ENTIER dès le départ, rempli de noData. C'est ce qui
  // rend la reprise possible : on écrit à la position finale de chaque dalle, et
  // ce qui manque reste un trou déclaré — pas un décalage.
  if (FORCE || !fs.existsSync(binPath)) {
    console.log(`\n  allocation de ${binPath}…`)
    const fd = fs.openSync(binPath, 'w')
    const row = Buffer.alloc(width * 2)
    for (let i = 0; i < width; i++) row.writeInt16LE(NO_DATA, i * 2)
    for (let j = 0; j < height; j++) fs.writeSync(fd, row)
    fs.closeSync(fd)
    fs.writeFileSync(statePath, '[]')
  }
  const done = new Set(FORCE ? [] : JSON.parse(fs.readFileSync(statePath, 'utf8')))
  const fd = fs.openSync(binPath, 'r+')

  let ok = 0
  let vide = 0
  let mer = 0
  const t0 = Date.now()
  const reste = dalles.filter((d) => !done.has(d.join(',')))
  console.log(`  ${done.size} dalle(s) déjà en place, ${reste.length} à faire\n`)

  const worker = async (queue) => {
    for (;;) {
      const d = queue.pop()
      if (!d) return
      const [w, s, e, n] = d
      let tile
      try {
        tile = await fetchDalle(w, s, e, n)
      } catch (err) {
        // Une dalle hors couverture est le cas NORMAL (l'emprise demandée est
        // un rectangle, la donnée ne l'est pas). On la note faite : le pivot
        // garde son noData, et le tuileur retombera sur GEBCO.
        console.log(`  ✖ ${w},${s} → ${String(err.message).slice(0, 90)}`)
        done.add(d.join(','))
        vide++
        continue
      }
      // Position de la dalle DANS le pivot, en pixels.
      const x0 = Math.round((w - west) / CELL)
      const y0 = Math.round((north - (s + STEP)) / CELL)
      const row = Buffer.alloc(tile.width * 2)
      let seaHere = 0
      for (let y = 0; y < tile.height; y++) {
        const gy = y0 + y
        if (gy < 0 || gy >= height) continue
        let cut = 0
        for (let x = 0; x < tile.width; x++) {
          const v = tile.data[y * tile.width + x]
          // NaN = pas de donnée. Le pivot code l'absence par noData, que
          // build-bathy-tiles.mjs sait déjà traiter comme un non-événement.
          //
          // ⚠️ ARRONDI AU MÈTRE, comme partout dans cette chaîne : le canal B
          // du terrarium code le 1/256 de mètre, et laisser passer des
          // fractions transforme B en bruit pur — mesuré à 76 Ko par tuile
          // contre 8,6 (voir build-bathy-tiles.mjs).
          let iv = NO_DATA
          if (Number.isFinite(v)) {
            iv = Math.max(-32767, Math.min(32767, Math.round(v)))
            if (iv < 0) seaHere++
          }
          row.writeInt16LE(iv, x * 2)
          cut = x + 1
        }
        const wide = Math.min(cut, width - x0)
        if (wide > 0 && x0 < width) {
          fs.writeSync(fd, row, Math.max(0, -x0) * 2, (wide - Math.max(0, -x0)) * 2, (gy * width + Math.max(0, x0)) * 2)
        }
      }
      mer += seaHere
      done.add(d.join(','))
      ok++
      if ((ok + vide) % 10 === 0) {
        fs.writeFileSync(statePath, JSON.stringify([...done]))
        const sec = (Date.now() - t0) / 1000
        console.log(`  ${ok + vide}/${reste.length} · ${((ok + vide) / sec).toFixed(1)} dalles/s · ${(mer / 1e6).toFixed(1)} M px de mer`)
      }
    }
  }

  const queue = reste.slice().reverse()
  Promise.all(Array.from({ length: PAR }, () => worker(queue))).then(() => {
    fs.writeFileSync(statePath, JSON.stringify([...done]))
    fs.closeSync(fd)
    fs.writeFileSync(
      path.join(OUT, 'meta.json'),
      JSON.stringify(
        {
          width,
          height,
          west,
          east,
          south,
          north,
          dtype: 'int16',
          noData: NO_DATA,
          // Traçabilité : ce champ n'est lu par personne, mais il évite de
          // devoir deviner d'où sort un pivot trouvé sur un disque six mois
          // plus tard — et il porte la licence avec lui.
          source: 'emodnet',
          coverage: COVERAGE,
          resolutionM: 115,
          license: 'CC BY 4.0',
          credit:
            'This data product was created by EMODnet and is owned by the EU and licensed under CC BY 4.0.',
          notForNavigation: 'These data are not to be used for navigation.',
          fetchedAt: new Date().toISOString(),
        },
        null,
        2
      ) + '\n'
    )
    const sec = (Date.now() - t0) / 1000
    console.log(`\n✓ ${ok} dalles écrites, ${vide} sans donnée, en ${sec.toFixed(0)} s`)
    console.log(`  ${(mer / 1e6).toFixed(1)} M pixels de mer dans le pivot`)
    console.log(`  → ${OUT}`)
    console.log(`\n  Ensuite, le tuilage — la source FINE passe EN PREMIER, c'est l'ordre qui fait la priorité :`)
    console.log(`    node scripts/build-bathy-tiles.mjs --src ${OUT},data/gebco --out public/data/bathy \\`)
    console.log(`         --zmin 9 --zmax 10 --bbox ${BW},${BS},${BE},${BN}\n`)
  })
}

main()
