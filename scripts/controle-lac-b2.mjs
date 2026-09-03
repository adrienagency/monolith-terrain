#!/usr/bin/env node
// CONTRÔLE B2 — les tuiles de lac cuites disent-elles la vérité, et que
// deviennent-elles une fois passées dans `fuseBathymetry` telle qu'elle est ?
//
// Trois questions, trois réponses chiffrées :
//   ① la tuile PNG relue au point le plus profond du Léman colle-t-elle à la
//     référence CIPEL (309,7 m) ?
//   ② la cascade ACTUELLE (src/dem.js:495, `fuseBathymetry(data, seaData)`
//     sans options) sait-elle en faire quelque chose ? — non, et on le mesure
//   ③ le correctif proposé (un `seaLevel` par zone + la SENTINELLE hors lac)
//     rend-il la profondeur SANS déplacer la rive ni abîmer la terre ?
//
// USAGE : node scripts/controle-lac-b2.mjs [--tuiles data/tuiles-leman]
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fuseBathymetry } from '../src/bathy.js'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const TUILES = arg('tuiles', 'data/tuiles-leman')
const NAPPE = 372.05
const SENTINELLE = NAPPE + 1

// LES RÉFÉRENCES, et d'où elles viennent.
//   · profondeur maximale du Léman 309,7 m — CIPEL (Commission internationale
//     pour la protection des eaux du Léman) ; cote de la nappe 372,05 m LN02.
//   · le point le plus profond est dans le Grand Lac, entre Évian et Lausanne.
const REF = { nom: 'Léman', profondeurMax: 309.7, lat: 46.44064, lon: 6.59996 }

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}

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
const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768

let ko = 0
const dit = (ok, txt) => {
  if (!ok) ko++
  console.log(`  ${ok ? '✓' : '✖'} ${txt}`)
}

// ── ① LA TUILE CONTRE LA RÉFÉRENCE ─────────────────────────────────────────
console.log(`\n① LA TUILE CUITE CONTRE LA RÉFÉRENCE — ${REF.nom}\n`)
console.log('  z   tuile          fond lu      profondeur   écart / réf 309,70 m')
let tuileZ14 = null
for (const z of [10, 11, 12, 13, 14]) {
  const fx = lon2x(REF.lon, z)
  const fy = lat2y(REF.lat, z)
  const tx = Math.floor(fx)
  const ty = Math.floor(fy)
  const f = path.join(TUILES, String(z), String(tx), `${ty}.png`)
  if (!fs.existsSync(f)) {
    console.log(`  z${z}  ${tx}/${ty}  — absente`)
    continue
  }
  const img = decodePng(fs.readFileSync(f))
  const px = Math.min(255, Math.floor((fx - tx) * 256))
  const py = Math.min(255, Math.floor((fy - ty) * 256))
  const o = (py * img.w + px) * img.bpp
  const alt = decodeTerrarium(img.data[o], img.data[o + 1], img.data[o + 2])
  const prof = NAPPE - alt
  const ecart = prof - REF.profondeurMax
  if (z === 14) tuileZ14 = img
  console.log(
    `  z${String(z).padEnd(2)}  ${String(tx).padStart(6)}/${String(ty).padEnd(6)} ${alt.toFixed(2).padStart(8)} m ${prof.toFixed(2).padStart(11)} m ${(ecart >= 0 ? '+' : '') + ecart.toFixed(2)} m`,
  )
}
{
  // Le z14 est le niveau natif de la cuisson : c'est celui qui doit coller.
  const fx = lon2x(REF.lon, 14)
  const fy = lat2y(REF.lat, 14)
  const img = tuileZ14
  const px = Math.min(255, Math.floor((fx - Math.floor(fx)) * 256))
  const py = Math.min(255, Math.floor((fy - Math.floor(fy)) * 256))
  const o = (py * img.w + px) * img.bpp
  const prof = NAPPE - decodeTerrarium(img.data[o], img.data[o + 1], img.data[o + 2])
  dit(Math.abs(prof - REF.profondeurMax) < 2, `z14 à ${Math.abs(prof - REF.profondeurMax).toFixed(2)} m de la référence CIPEL (tolérance 2 m)`)
}

// La tuile z14 la plus profonde du jeu, pour vérifier qu'aucune valeur
// aberrante ne s'est glissée dans la cuisson.
{
  let pire = Infinity
  let sentinelles = 0
  let n = 0
  const dirs = fs.readdirSync(path.join(TUILES, '14'))
  for (const x of dirs) {
    for (const yf of fs.readdirSync(path.join(TUILES, '14', x))) {
      const img = decodePng(fs.readFileSync(path.join(TUILES, '14', x, yf)))
      for (let i = 0; i < img.w * img.h; i++) {
        const o = i * img.bpp
        const a = decodeTerrarium(img.data[o], img.data[o + 1], img.data[o + 2])
        n++
        if (a > NAPPE) sentinelles++
        else if (a < pire) pire = a
      }
    }
  }
  console.log(`\n  balayage des 272 tuiles z14 : ${n.toLocaleString('fr-FR')} pixels`)
  console.log(`    fond le plus bas    ${pire.toFixed(2)} m  →  ${(NAPPE - pire).toFixed(2)} m de profondeur`)
  console.log(`    hors lac (sentinelle) ${((100 * sentinelles) / n).toFixed(1)} %`)
  dit(NAPPE - pire < REF.profondeurMax + 3, `aucun pixel plus profond que la référence + 3 m (max ${(NAPPE - pire).toFixed(2)} m)`)
  dit(pire > 0, 'aucun pixel de lac ne passe sous le zéro marin (le Léman est un lac de montagne)')
}

// ── ② LA CASCADE ACTUELLE, TELLE QUELLE ────────────────────────────────────
// On rejoue exactement src/dem.js:495 : `fuseBathymetry(data, seaData)`.
console.log('\n② LA CASCADE ACTUELLE — fuseBathymetry(land, sea) sans options\n')
const N = 256
// ⚠️ LA SCÈNE DOIT CONTENIR DE LA TERRE PLUS BASSE QUE LA NAPPE, sinon le
// contrôle ne prouve rien. Une première version n'avait que du versant à
// 380..1 200 m : tout y est au-dessus du niveau du lac, donc tout tombait dans
// la branche TERRE de `fuseBathymetry` et le contrôle ④ passait même sans
// sentinelle. C'était un faux négatif, et il aurait fait publier « rien ne
// casse » sur le cas qui casse.
//
// La géographie réelle impose ce cas : le Rhône SORT du Léman à Genève à 371 m
// et perd 100 m en quelques kilomètres. Toute dalle qui contient l'exutoire
// contient donc de la terre franchement SOUS la cote du lac. C'est la colonne
// « aval » ci-dessous.
const scene = () => {
  const land = new Float32Array(N * N)
  const sea = new Float32Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      if (x < 154) {
        // LE LAC — le terrarium y donne la NAPPE, parfaitement plate
        land[i] = NAPPE
        sea[i] = NAPPE - 310 * Math.sin((Math.PI * x) / 154)
      } else if (x < 200) {
        // L'AVAL — vallée du Rhône, de 370 m à 280 m : SOUS la nappe
        land[i] = 370 - (x - 154) * 2
        sea[i] = SENTINELLE
      } else {
        // LE VERSANT — au-dessus de la nappe
        land[i] = 380 + (x - 200) * 12
        sea[i] = SENTINELLE
      }
    }
  }
  return { land, sea }
}
{
  const { land, sea } = scene()
  const out = fuseBathymetry(land, sea)
  const centre = out[128 * N + 77]
  console.log(`  fond au milieu du lac : ${centre.toFixed(2)} m   (la source dit ${sea[128 * N + 77].toFixed(2)} m)`)
  dit(Math.abs(centre - NAPPE) < 0.01, 'la profondeur du lac est IGNORÉE — le terrarium sort tel quel (défaut constaté)')
}

// ── ③ LE CORRECTIF PROPOSÉ ─────────────────────────────────────────────────
console.log('\n③ LE CORRECTIF — seaLevel = nappe + 0,5 m, et la SENTINELLE hors lac\n')
{
  const { land, sea } = scene()
  const out = fuseBathymetry(land, sea, { seaLevel: NAPPE + 0.5 })
  const iC = 128 * N + 77
  const visé = sea[iC]
  console.log(`  fond au milieu du lac : ${out[iC].toFixed(2)} m   visé ${visé.toFixed(2)} m`)
  dit(Math.abs(out[iC] - visé) < 1, `la profondeur passe (écart ${Math.abs(out[iC] - visé).toFixed(3)} m)`)

  // LA TERRE NE BOUGE PAS — la question qui décide de tout.
  let pireEcart = 0
  let pireX = 0
  for (let y = 0; y < N; y++) {
    for (let x = 154; x < N; x++) {
      const i = y * N + x
      const e = Math.abs(out[i] - land[i])
      if (e > pireEcart) {
        pireEcart = e
        pireX = x
      }
    }
  }
  console.log(`  terre / versant : pire écart ${pireEcart.toFixed(4)} m (colonne ${pireX}, terrarium ${land[128 * N + pireX].toFixed(1)} m)`)
  dit(pireEcart < 0.001, 'AUCUN pixel de terre n\'a bougé — le relief des tuiles existantes n\'est pas refondu')
}

// ── ④ CE QUI CASSE SI ON RETIRE LA SENTINELLE ──────────────────────────────
console.log('\n④ LA MÊME CHOSE, SENTINELLE REMPLACÉE PAR 0 (ce que fait le tuileur marin)\n')
{
  const { land, sea } = scene()
  for (let y = 0; y < N; y++) for (let x = 154; x < N; x++) sea[y * N + x] = 0
  const out = fuseBathymetry(land, sea, { seaLevel: NAPPE + 0.5 })
  let pireEcart = 0
  for (let y = 0; y < N; y++)
    for (let x = 154; x < N; x++) pireEcart = Math.max(pireEcart, Math.abs(out[y * N + x] - land[y * N + x]))
  console.log(`  terre / versant : pire écart ${pireEcart.toFixed(2)} m`)
  dit(pireEcart < 0.001, `sans sentinelle la terre reste en place (attendu : ÉCHEC, c'est la démonstration)`)
}

console.log(`\n${ko ? `⚠️  ${ko} contrôle(s) en échec — le dernier est ATTENDU (démonstration).` : 'tous les contrôles passent.'}\n`)
