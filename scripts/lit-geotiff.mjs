// LECTEUR GeoTIFF MINIMAL — juste ce que BlueTopo écrit, et rien de plus.
//
// POURQUOI L'ÉCRIRE PLUTÔT QU'AJOUTER UNE DÉPENDANCE : la machine n'a ni GDAL
// ni rasterio (c'est déjà pourquoi `pivot-swissbathy3d.mjs` existe), et
// `@duckdb/node-api` + spatial sait lire du VECTEUR mais pas du raster ici.
// Le format écrit par NOAA est étroit et vérifié à l'octet sur la donnée réelle :
//
//   TIFF classique little-endian · Compression 8 (Adobe Deflate, donc zlib)
//   Predictor 1 (AUCUN — pas de prédicteur flottant à défaire)
//   SampleFormat 3 / BitsPerSample 32  → float32
//   SamplesPerPixel 3, PlanarConfig 1  → bande 1 élévation, 2 incertitude,
//                                        3 contributeur, ENTRELACÉES
//   Tuilé 512×512 · NoData « nan »
//   ModelPixelScale + ModelTiepoint · NAD83 / UTM zone <n>N + NAVD88
//
// ⚠️ Chacune de ces hypothèses est VÉRIFIÉE à l'ouverture et lève si elle est
// fausse. Un lecteur qui « suppose » sur un jeu de 8 203 fichiers finit par
// rendre des nombres plausibles et faux ; on préfère qu'il s'arrête.

import fs from 'node:fs'
import zlib from 'node:zlib'

const T = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  SamplesPerPixel: 277,
  PlanarConfig: 284,
  Predictor: 317,
  TileWidth: 322,
  TileLength: 323,
  TileOffsets: 324,
  TileByteCounts: 325,
  SampleFormat: 339,
  ModelPixelScale: 33550,
  ModelTiepoint: 33922,
  GeoKeyDirectory: 34735,
  GeoAsciiParams: 34737,
  NoData: 42113,
}
const TAILLE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

export function ouvreGeoTiff(chemin) {
  const b = fs.readFileSync(chemin)
  if (b.toString('ascii', 0, 2) !== 'II') throw new Error(`${chemin} : pas du TIFF little-endian`)
  if (b.readUInt16LE(2) !== 42) throw new Error(`${chemin} : BigTIFF non géré`)
  const ifd = b.readUInt32LE(4)
  const n = b.readUInt16LE(ifd)
  const tags = new Map()
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    const tag = b.readUInt16LE(e)
    const typ = b.readUInt16LE(e + 2)
    const cnt = b.readUInt32LE(e + 4)
    const octets = (TAILLE[typ] ?? 1) * cnt
    const pos = octets <= 4 ? e + 8 : b.readUInt32LE(e + 8)
    let v
    if (typ === 2) v = b.toString('ascii', pos, pos + cnt).replace(/\0+$/, '')
    else {
      v = []
      for (let k = 0; k < cnt; k++) {
        const o = pos + k * TAILLE[typ]
        v.push(typ === 3 ? b.readUInt16LE(o) : typ === 4 ? b.readUInt32LE(o) : typ === 12 ? b.readDoubleLE(o) : b[o])
      }
    }
    tags.set(tag, v)
  }
  const un = (t) => tags.get(t)?.[0]
  const exige = (t, attendu, quoi) => {
    const v = un(t)
    if (v !== attendu) throw new Error(`${chemin} : ${quoi} = ${v}, attendu ${attendu}`)
  }
  exige(T.Compression, 8, 'Compression (8 = Adobe Deflate)')
  exige(T.Predictor, 1, 'Predictor')
  exige(T.PlanarConfig, 1, 'PlanarConfig')
  const spp = un(T.SamplesPerPixel)
  if (!tags.get(T.SampleFormat)?.every((f) => f === 3)) throw new Error(`${chemin} : SampleFormat ≠ float`)
  if (!tags.get(T.BitsPerSample)?.every((f) => f === 32)) throw new Error(`${chemin} : BitsPerSample ≠ 32`)
  const largeur = un(T.ImageWidth)
  const hauteur = un(T.ImageLength)
  const tw = un(T.TileWidth)
  const th = un(T.TileLength)
  if (!tw || !th) throw new Error(`${chemin} : image en BANDES, pas en tuiles — non géré`)
  const offsets = tags.get(T.TileOffsets)
  const comptes = tags.get(T.TileByteCounts)
  const echelle = tags.get(T.ModelPixelScale)
  const ancre = tags.get(T.ModelTiepoint)
  if (!echelle || !ancre) throw new Error(`${chemin} : pas de géoréférencement ModelPixelScale/Tiepoint`)

  // EPSG du système projeté : GeoKeyDirectory, clé 3072 (ProjectedCSTypeGeoKey).
  const gk = tags.get(T.GeoKeyDirectory) ?? []
  let epsg = null
  for (let i = 4; i + 3 < gk.length; i += 4) if (gk[i] === 3072 && gk[i + 1] === 0) epsg = gk[i + 3]

  const tuilesX = Math.ceil(largeur / tw)
  const tuilesY = Math.ceil(hauteur / th)
  const cache = new Map()
  // Une tuile décompressée fait 512·512·3·4 = 3 Mo. On n'en garde qu'une
  // poignée : le balayage est ligne par ligne, donc on la relit très rarement.
  const MAX_CACHE = 8

  // Rend la BANDE 1 (élévation) du pixel (i, j), ou NaN si NoData/absent.
  const elevation = (i, j) => {
    if (i < 0 || j < 0 || i >= largeur || j >= hauteur) return NaN
    const ti = (i / tw) | 0
    const tj = (j / th) | 0
    const k = tj * tuilesX + ti
    let d = cache.get(k)
    if (!d) {
      const nb = comptes[k]
      if (!nb) return NaN // tuile creuse : le format autorise un compte nul
      d = new Float32Array(
        zlib.inflateSync(b.subarray(offsets[k], offsets[k] + nb)).buffer.slice(0),
      )
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
      cache.set(k, d)
    }
    const v = d[((j - tj * th) * tw + (i - ti * tw)) * spp]
    return v
  }

  return {
    chemin,
    largeur,
    hauteur,
    epsg,
    crs: tags.get(T.GeoAsciiParams) ?? '',
    // ⚠️ chaîne ASCII, pas un nombre : `un()` rendrait « n ». BlueTopo écrit
    // littéralement « nan » — le NoData est donc un NaN flottant, et c'est
    // `Number.isFinite` qui fait foi, jamais une comparaison d'égalité.
    noData: tags.get(T.NoData) ?? 'nan',
    // origine = coin HAUT-GAUCHE du pixel (0,0), dans le CRS projeté
    ox: ancre[3],
    oy: ancre[4],
    px: echelle[0],
    py: echelle[1],
    tuile: [tw, th],
    elevation,
  }
}
