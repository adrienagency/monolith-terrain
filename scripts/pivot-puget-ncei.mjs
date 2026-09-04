// PIVOT PUGET SOUND — parce que BLUETOPO N'Y EST PAS.
//
// ⛔ LE CONSTAT QUI JUSTIFIE CE FICHIER, mesuré sur l'index vivant :
// dans la fenêtre −126…−121 / 45…50 (tout le Pacifique Nord-Ouest américain),
// le schéma de dallage BlueTopo compte 278 dalles autour du détroit de Puget
// et **ZÉRO** porte un GeoTIFF. Ce n'est pas un défaut de notre cuisson : la
// donnée n'est pas publiée. « Une source fine est TOUJOURS trouée »
// (src/bathy-sources.js) — voilà le trou, chiffré.
//
// LE REMPLAÇANT : NOAA NCEI, DEM régional « Puget Sound 1/3 arc-seconde »
// (9,26e-05° ≈ 10 m, NAVD88, WGS84 géographique, float32, _FillValue −9999).
// Domaine public fédéral américain, comme BlueTopo. Servi par THREDDS, donc on
// n'a pas à télécharger les ~560 Mo de la grille entière : OPeNDAP découpe.
//
// ⚠️ ON NE FIGE PAS LA GÉOMÉTRIE NON PLUS. Le `GeoTransform` est relu dans le
// `.das` du jeu à chaque exécution — même discipline que pour l'index BlueTopo.
//
//   node scripts/pivot-puget-ncei.mjs --out data/pivot-bt/puget --bbox -122.65,47.4,-122.25,47.8

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const JEU = arg('jeu', 'regional/puget_sound_13_navd88_2014.nc')
const BASE = `https://www.ngdc.noaa.gov/thredds/dodsC/${JEU}`
const OUT = arg('out', 'data/pivot-bt/puget')
const BBOX = (arg('bbox') || '-122.65,47.4,-122.25,47.8').split(',').map(Number)
const BANDE = +arg('bande', 300) // lignes par requête OPeNDAP

const texte = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(300_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${u}`)
  return r.text()
}

// ── la géométrie, relue et non figée ────────────────────────────────────────
const das = await texte(`${BASE}.das`)
const gt = /GeoTransform\s+"([^"]+)"/.exec(das)
if (!gt) throw new Error('GeoTransform absent du .das — le jeu a changé de forme')
const [ox, px, , oy, , py] = gt[1].trim().split(/\s+/).map(Number)
const fill = Number(/_FillValue\s+(-?[\d.eE+]+)/.exec(das)?.[1] ?? -9999)
console.log(`\nPivot Puget (NCEI) — origine ${ox} / ${oy}, pas ${px}° ≈ ${(px * 111320).toFixed(1)} m, NoData ${fill}`)

const [W, S, E, N] = BBOX
const i0 = Math.max(0, Math.floor((W - ox) / px))
const i1 = Math.floor((E - ox) / px)
const j0 = Math.max(0, Math.floor((N - oy) / py)) // py est NÉGATIF
const j1 = Math.floor((S - oy) / py)
const largeur = i1 - i0 + 1
const hauteur = j1 - j0 + 1
console.log(`  fenêtre lignes ${j0}..${j1}, colonnes ${i0}..${i1} → ${largeur} × ${hauteur}`)

const grille = new Float32Array(largeur * hauteur)
let pleines = 0
let mn = Infinity
let mnLat = 0
let mnLon = 0

for (let j = j0; j <= j1; j += BANDE) {
  const jf = Math.min(j1, j + BANDE - 1)
  const u = `${BASE}.dods?Band1%5B${j}:1:${jf}%5D%5B${i0}:1:${i1}%5D`
  const r = await fetch(u, { signal: AbortSignal.timeout(600_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status} sur la bande ${j}`)
  const buf = Buffer.from(await r.arrayBuffer())
  const k = buf.indexOf(Buffer.from('Data:\n'))
  if (k < 0) throw new Error(`réponse OPeNDAP sans section Data (bande ${j})`)
  // XDR : deux longueurs UInt32BE, puis les float32 BIG-ENDIAN du tableau.
  const d = buf.subarray(k + 6)
  const n = d.readUInt32BE(0)
  const attendu = (jf - j + 1) * largeur
  if (n !== attendu) throw new Error(`bande ${j} : ${n} valeurs, attendu ${attendu}`)
  for (let t = 0; t < n; t++) {
    const v = d.readFloatBE(8 + t * 4)
    const gj = j - j0 + Math.floor(t / largeur)
    const gi = t % largeur
    const o = gj * largeur + gi
    if (v === fill || !Number.isFinite(v)) {
      grille[o] = NaN
      continue
    }
    grille[o] = v
    pleines++
    if (v < mn) {
      mn = v
      mnLat = oy + (j0 + gj + 0.5) * py
      mnLon = ox + (i0 + gi + 0.5) * px
    }
  }
  process.stderr.write(`  lignes ${j}..${jf} — ${(pleines / 1e6).toFixed(1)} M valeurs\r`)
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'grid.bin'), Buffer.from(grille.buffer))
fs.writeFileSync(
  path.join(OUT, 'meta.json'),
  JSON.stringify(
    {
      width: largeur,
      height: hauteur,
      west: ox + i0 * px,
      east: ox + (i1 + 1) * px,
      south: oy + (j1 + 1) * py,
      north: oy + j0 * py,
      dtype: 'float32',
      noData: NaN,
      _source: 'NOAA NCEI, Puget Sound 1/3 arc-second DEM (NAVD88) — domaine public fédéral',
      _pourquoi: 'BlueTopo ne publie AUCUN GeoTIFF dans tout le Pacifique Nord-Ouest (0 / 278 dalles)',
    },
    null,
    2,
  ),
)
console.log(`\n  ${pleines.toLocaleString('fr-FR')} / ${(largeur * hauteur).toLocaleString('fr-FR')} cellules pleines`)
console.log(`  fond le plus bas : ${mn.toFixed(2)} m à ${mnLat.toFixed(4)} N / ${mnLon.toFixed(4)} E`)
console.log(`  → ${OUT}\n`)
