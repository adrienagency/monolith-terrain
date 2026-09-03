#!/usr/bin/env node
// TUILEUR DE FOND DE LAC — un pivot d'altitudes devient des tuiles PNG
// terrarium, dans la même grille XYZ et le même encodage que
// scripts/build-bathy-tiles.mjs.
//
// ⛔ POURQUOI CE SCRIPT EXISTE, ET POURQUOI build-bathy-tiles.mjs NE SUFFIT PAS.
//
// Le tuileur marin porte cette ligne :
//
//     const raw = m == null || m >= 0 ? 0 : m
//
// « on n'écrit que la mer », et la terre est délibérément aplatie à zéro parce
// que la fusion l'ignore de toute façon. C'est juste EN MER. Mais un lac
// d'altitude est POSITIF de bout en bout : le Léman va de 372 m (nappe) à 62 m
// (fond). Passé dans le tuileur marin, chacun de ces pixels tombe dans
// `m >= 0` et sort à 0 ; `anySea` reste faux ; la tuile est jetée. Le tuileur
// marin ne peut PAS cuire un lac situé au-dessus du niveau de la mer — ce n'est
// pas un réglage à trouver, c'est structurel.
//
// Ce que ce script écrit à la place : l'ALTITUDE ABSOLUE du fond, et
// `nappe + 1` partout ailleurs (la SENTINELLE — voir pivot-swissbathy3d.mjs).
// La tuile reste donc lisible telle quelle par le décodeur terrarium existant.
//
// ⚠️ ET LA TUILE SEULE NE SUFFIT PAS. `fuseBathymetry` (src/bathy.js) compare
// tout au `seaLevel`, qui vaut 0 et n'est passé par personne (src/dem.js:495
// appelle `fuseBathymetry(data, seaData)` sans options). Un pixel de lac à
// +372 m tombe donc dans la branche TERRE et sort inchangé. Ces tuiles sont
// INERTES tant que le niveau par zone n'est pas câblé — c'est le travail de
// B3, décrit dans rapport-B2.md. Ce script produit la donnée, pas l'effet.
//
// USAGE
//   node scripts/build-lake-tiles.mjs --src data/pivot-leman --out data/tuiles-leman \
//        --nappe 372.05 --zmin 9 --zmax 14 [--dry]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { openSources } from './build-bathy-tiles.mjs'

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const flag = (n) => argv.includes(`--${n}`)

const SRC = arg('src', 'data/pivot-leman')
const OUT = arg('out', 'data/tuiles-leman')
const NAPPE = +arg('nappe', 372.05)
const ZMIN = +arg('zmin', 9)
const ZMAX = +arg('zmax', 14)
const DRY = flag('dry')
const TILE = 256
const SENTINELLE = NAPPE + 1

// QUANTIFICATION — ÉTEINTE PAR DÉFAUT ICI, à l'inverse du tuileur marin, et
// c'est un arbitrage MESURÉ, pas une négligence.
//
// Le barème marin (1 m / 4 m / 8 m selon la profondeur) fait gagner 35 % de
// poids sur un océan de 19 657 tuiles : là, un mètre de plus par tuile se paie
// en centaines de mégaoctets. Un lac, lui, tient en quelques mégaoctets. Mesuré
// sur le Léman entier :
//
//   quantifié   z9..z14  404 tuiles  2,09 Mo   fond lu 312,05 m  (réf 309,70)
//   au mètre    z9..z14  404 tuiles  3,25 Mo   fond lu 310,05 m  (réf 309,70)
//
// Le pas de 4 m de la tranche −60..−400 m tombe pile sur la profondeur du
// Léman et coûte 2,35 m de justesse. Payer 1,2 Mo pour les récupérer sur la
// demande « le plus juste possible » est le bon sens du marché. `--quant`
// rallume le barème marin si un lac immense change un jour l'arbitrage.
//
// Indexé sur la PROFONDEUR SOUS LA NAPPE, pas sur l'altitude : un lac de
// montagne à +1 800 m n'a pas un fond « peu profond » parce qu'il est haut.
const QUANT = flag('quant')
const quantize = (alt) => {
  if (!QUANT) return alt
  const d = alt - NAPPE // négatif : profondeur sous la nappe
  const s = d > -60 ? 1 : d > -400 ? 4 : 8
  return s <= 1 ? Math.round(alt) : NAPPE + Math.round(d / s) * s
}

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// ── PNG RVB 8 bits, filtre « Up », zlib — recopié du tuileur marin ──────────
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
function encodeTerrarium(mRaw) {
  const m = Math.round(mRaw)
  const v = Math.min(32767.99, Math.max(-32768, m)) + 32768
  const r = Math.floor(v / 256)
  const g = Math.floor(v - r * 256)
  const b = Math.round((v - r * 256 - g) * 256)
  if (b === 256) return g === 255 ? [r + 1, 0, 0] : [r, g + 1, 0]
  return [r, g, b]
}

// ── cuisson ────────────────────────────────────────────────────────────────
function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'meta.json'), 'utf8'))
  const BBOX = [meta.west, meta.south, meta.east, meta.north]
  console.log(`\nTuileur de LAC — z${ZMIN}..${ZMAX}`)
  console.log(`  pivot   ${SRC}  (${meta.width} x ${meta.height})`)
  console.log(`  emprise ${BBOX.map((v) => v.toFixed(4)).join(', ')}`)
  console.log(`  nappe   ${NAPPE} m · sentinelle ${SENTINELLE} m · quantification ${QUANT ? 'oui' : 'non'}`)

  const range = (z) => ({
    x0: Math.max(0, Math.floor(lon2x(BBOX[0], z))),
    x1: Math.min(2 ** z - 1, Math.ceil(lon2x(BBOX[2], z)) - 1),
    y0: Math.max(0, Math.floor(lat2y(BBOX[3], z))),
    y1: Math.min(2 ** z - 1, Math.ceil(lat2y(BBOX[1], z)) - 1),
  })
  let brut = 0
  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = range(z)
    brut += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  }
  console.log(`  ${brut.toLocaleString('fr-FR')} tuiles dans l'emprise avant tri`)
  if (DRY) {
    console.log("\n--dry : rien n'a été écrit.\n")
    return
  }

  const src = openSources(SRC)
  let written = 0
  let skipped = 0
  let bytes = 0
  let fondMin = Infinity
  const parZoom = []
  const t0 = Date.now()

  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = range(z)
    let wz = 0
    let bz = 0
    const halfLon = 360 / 2 ** z / TILE / 2
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        const rgb = Buffer.alloc(TILE * TILE * 3)
        let anyLac = false
        for (let py = 0; py < TILE; py++) {
          const lat = y2lat(ty + (py + 0.5) / TILE, z)
          const halfLat = Math.abs(y2lat(ty + py / TILE, z) - y2lat(ty + (py + 1) / TILE, z)) / 2
          for (let px = 0; px < TILE; px++) {
            const lon = x2lon(tx + (px + 0.5) / TILE, z)
            const m = src.sample(lon, lat, halfLon, halfLat)
            // ⚠️ HORS DU LAC ON ÉCRIT LA SENTINELLE, PAS ZÉRO. Zéro serait lu
            // par la fusion comme un fond à 0 m et creuserait la berge de
            // 372 m d'un coup. La sentinelle, elle, est au-dessus du niveau du
            // lac : la fusion la lit comme une ABSENCE et rend le terrarium.
            let alt
            if (m == null || m >= NAPPE) {
              alt = SENTINELLE
            } else {
              alt = quantize(m)
              anyLac = true
              if (m < fondMin) fondMin = m
            }
            const [R, G, B] = encodeTerrarium(alt)
            const o = (py * TILE + px) * 3
            rgb[o] = R
            rgb[o + 1] = G
            rgb[o + 2] = B
          }
        }
        if (!anyLac) {
          skipped++
          continue
        }
        const dir = path.join(OUT, String(z), String(tx))
        fs.mkdirSync(dir, { recursive: true })
        const png = encodePng(rgb, TILE, TILE)
        fs.writeFileSync(path.join(dir, `${ty}.png`), png)
        bytes += png.length
        bz += png.length
        written++
        wz++
      }
    }
    parZoom.push({ z, tuiles: wz, octets: bz })
    console.log(`  z${z} · ${wz} tuiles · ${(bz / 1024).toFixed(0)} Ko · ${wz ? (bz / wz / 1024).toFixed(1) : 0} Ko/tuile`)
  }
  src.close()

  console.log(`\n✓ ${written} tuiles écrites, ${skipped} écartées en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  console.log(`  ${(bytes / 1024 / 1024).toFixed(2)} Mo au total  →  ${OUT}`)
  console.log(`  fond le plus bas cuit : ${fondMin.toFixed(2)} m  (${(NAPPE - fondMin).toFixed(2)} m sous la nappe)`)
  fs.writeFileSync(
    path.join(OUT, 'cuisson.json'),
    JSON.stringify({ nappe: NAPPE, sentinelle: SENTINELLE, zmin: ZMIN, zmax: ZMAX, bbox: BBOX, parZoom, tuiles: written, octets: bytes }, null, 2),
  )
}
main()
