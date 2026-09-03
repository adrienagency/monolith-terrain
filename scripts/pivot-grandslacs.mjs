// PIVOT GRANDS LACS — les GeoTIFF « lld » de NOAA NCEI deviennent le pivot
// WGS84 (`grid.bin` + `meta.json`) que lisent DÉJÀ `build-bathy-tiles.mjs` et
// `build-lake-tiles.mjs`.
//
// ⚡ CE QUI REND CE PONT TRIVIAL, et pourquoi il ne ressemble pas à celui de
// BlueTopo : ces grilles sont DÉJÀ en géographiques (GCS_North_American_1983,
// 3″ ≈ 90 m), non compressées, une bande float32, une ligne par bande TIFF.
// Il n'y a donc ni reprojection, ni décompression, ni rééchantillonnage — on
// recopie des lignes et on décale d'une constante. C'est le contraire du cas
// BlueTopo (UTM projeté, deflate, trois bandes entrelacées).
//
// ⚠️ LE DÉCALAGE, ET CE QU'IL SIGNIFIE. « lld » = *low water datum* : la grille
// donne la profondeur SOUS le plan d'eau de référence du lac, pas une altitude.
// Le pivot écrit `nappe + lld`, c'est-à-dire l'ALTITUDE ABSOLUE du fond, parce
// que c'est ce que `build-lake-tiles.mjs` attend et ce que le terrarium encode.
// La nappe par défaut est relevée sur `api.opentopodata.org/v1/ned10m` (USGS
// 10 m) aux points de contrôle : Érié 173,80 m, Michigan 176,91 m.
//
// ⛔ CE PIVOT NE DOIT PAS PASSER PAR LE TUILEUR MARIN. Le lac Érié va de +173,8
// (nappe) à +110 (fond) : TOUT est positif, `raw = m >= 0 ? 0 : m` aplatit
// chaque pixel, et la cuisson rend ZÉRO TUILE SANS UNE ERREUR. C'est le défaut
// que BT-I a rendu bruyant (garde-fou en tête de `main()` du tuileur marin) ;
// l'outil correct est `build-lake-tiles.mjs`, qui porte la SENTINELLE.
//
//   node scripts/pivot-grandslacs.mjs --tif data/ncei-grandslacs/erie_lld/erie_lld.tif \
//        --out data/pivot-erie --nappe 173.80

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}

const TIF = arg('tif')
const OUT = arg('out')
const NAPPE = +arg('nappe', 0)
if (!TIF || !OUT) throw new Error('usage : --tif <fichier.tif> --out <dossier> --nappe <cote>')

// ── lecture TIFF « bandes non compressées », le seul cas que NCEI écrit ici ──
const b = fs.readFileSync(TIF)
const le = b.toString('ascii', 0, 2) === 'II'
if (!le || b.readUInt16LE(2) !== 42) throw new Error(`${TIF} : pas du TIFF classique little-endian`)
const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8 }
const tags = new Map()
{
  const ifd = b.readUInt32LE(4)
  const n = b.readUInt16LE(ifd)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    const tag = b.readUInt16LE(e)
    const typ = b.readUInt16LE(e + 2)
    const cnt = b.readUInt32LE(e + 4)
    const t = SZ[typ] ?? 1
    const pos = t * cnt <= 4 ? e + 8 : b.readUInt32LE(e + 8)
    const v = []
    if (typ === 2) v.push(b.toString('ascii', pos, pos + cnt).replace(/\0+$/, ''))
    else for (let k = 0; k < cnt; k++) {
      const o = pos + k * t
      v.push(typ === 3 ? b.readUInt16LE(o) : typ === 4 ? b.readUInt32LE(o) : typ === 12 ? b.readDoubleLE(o) : b[o])
    }
    tags.set(tag, v)
  }
}
const un = (t) => tags.get(t)?.[0]
if (un(259) !== 1) throw new Error(`${TIF} : compression ${un(259)}, attendu 1 (aucune)`)
if (un(277) !== 1 || un(258) !== 32 || un(339) !== 3)
  throw new Error(`${TIF} : attendu une bande float32, vu spp=${un(277)} bits=${un(258)} fmt=${un(339)}`)
const W = un(256)
const H = un(257)
const strips = tags.get(273)
const parBande = un(278)
const nodata = Number(String(un(42113) ?? '-9999'))
const echelle = tags.get(33550)
const ancre = tags.get(33922)
const dLon = echelle[0]
const dLat = echelle[1]
const ouest = ancre[3]
const nord = ancre[4]

console.log(`\nPivot Grands Lacs — ${path.basename(TIF)}`)
console.log(`  ${W} × ${H} float32, ${strips.length} bandes de ${parBande} ligne(s), NoData ${nodata}`)
console.log(`  pas ${dLon}° ≈ ${(dLon * 111320).toFixed(0)} m · nappe ${NAPPE} m`)

const grille = new Float32Array(W * H)
let pleines = 0
let mn = Infinity
let mnLat = 0
let mnLon = 0
for (let s = 0; s < strips.length; s++) {
  const y0 = s * parBande
  for (let r = 0; r < parBande && y0 + r < H; r++) {
    const j = y0 + r
    const base = strips[s] + r * W * 4
    for (let i = 0; i < W; i++) {
      const v = b.readFloatLE(base + i * 4)
      // ⚠️ le NoData est un NOMBRE ici (−9999), pas un NaN comme chez BlueTopo :
      // une comparaison d'égalité est donc obligatoire, et `Number.isFinite`
      // seul laisserait passer −9999 comme un fond de 9 999 m.
      if (v === nodata || !Number.isFinite(v)) {
        grille[j * W + i] = NaN
        continue
      }
      const abs = NAPPE + v
      grille[j * W + i] = abs
      pleines++
      if (abs < mn) {
        mn = abs
        mnLat = nord - (j + 0.5) * dLat
        mnLon = ouest + (i + 0.5) * dLon
      }
    }
  }
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'grid.bin'), Buffer.from(grille.buffer))
fs.writeFileSync(
  path.join(OUT, 'meta.json'),
  JSON.stringify(
    {
      width: W,
      height: H,
      west: ouest,
      east: ouest + W * dLon,
      south: nord - H * dLat,
      north: nord,
      dtype: 'float32',
      noData: NaN,
      _source: 'NOAA NCEI Great Lakes bathymetry (lld, 3″) — domaine public fédéral américain',
      _nappe: NAPPE,
    },
    null,
    2,
  ),
)
console.log(`  ${pleines.toLocaleString('fr-FR')} / ${(W * H).toLocaleString('fr-FR')} cellules pleines`)
console.log(`  fond le plus bas : ${mn.toFixed(2)} m (soit ${(NAPPE - mn).toFixed(1)} m sous la nappe) à ${mnLat.toFixed(4)} N / ${mnLon.toFixed(4)} E`)
console.log(`  → ${OUT}\n`)
