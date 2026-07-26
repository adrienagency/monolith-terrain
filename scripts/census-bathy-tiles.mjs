// RECENSEMENT : combien de tuiles bathymétriques faut-il VRAIMENT écrire ?
//
// POURQUOI. Cuire tout l'océan mondial en z7-z8 donne plus de 2 Go, ce qui ne
// se déploie pas. Mais l'apport de GEBCO n'est pas uniforme : au milieu du
// Pacifique, la plaine abyssale est plate et nos tuiles terrarium existantes
// (ETOPO1) la décrivent déjà correctement — et c'est justement là que nos
// tuiles pèsent le PLUS LOURD (72 Ko), parce qu'un fond « plat » à 5 000 m est
// couvert de bruit de sondage qui ne se compresse pas. L'apport réel est sur
// les plateaux continentaux, les talus et les côtes.
//
// Ce script balaie la grille GEBCO et compte, pour plusieurs seuils de
// profondeur, combien de tuiles contiennent de l'eau PEU PROFONDE. C'est le
// nombre de tuiles qu'on écrirait vraiment.
//
// USAGE
//   node scripts/census-bathy-tiles.mjs [--src data/gebco] [--stride 8]

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const SRC = arg('src', 'data/gebco')
// on ne lit qu'une ligne et une colonne sur STRIDE : un plateau continental
// fait des dizaines de kilomètres, il ne se cache pas entre deux pixels
const STRIDE = +arg('stride', 8)

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}

// seuils testés : « eau plus haute que -X m » — au-dessus, on écrit la tuile
const SEUILS = [-200, -500, -1000, -2000, -Infinity]
const ZOOMS = [6, 7, 8]

// pour chaque (zoom, seuil) un ensemble de clés de tuiles
const sets = {}
for (const z of ZOOMS) for (const s of SEUILS) sets[`${z}|${s}`] = new Set()
// et l'ensemble « la tuile contient de la mer », toutes profondeurs
const mer = Object.fromEntries(ZOOMS.map((z) => [z, new Set()]))

function scan(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
  const fd = fs.openSync(path.join(dir, 'grid.bin'), 'r')
  const row = Buffer.alloc(meta.width * 2)
  const dLon = (meta.east - meta.west) / meta.width
  const dLat = (meta.north - meta.south) / meta.height
  for (let j = 0; j < meta.height; j += STRIDE) {
    fs.readSync(fd, row, 0, row.length, j * row.length)
    const lat = meta.north - (j + 0.5) * dLat
    // les indices de tuile ne dépendent de la latitude qu'une fois par ligne
    const ty = Object.fromEntries(ZOOMS.map((z) => [z, Math.floor(lat2y(lat, z))]))
    for (let i = 0; i < meta.width; i += STRIDE) {
      const v = row.readInt16LE(i * 2)
      if (v === meta.noData || v >= 0) continue // terre : ne nous intéresse pas
      const lon = meta.west + (i + 0.5) * dLon
      for (const z of ZOOMS) {
        const key = (Math.floor(lon2x(lon, z)) << 12) | ty[z]
        mer[z].add(key)
        for (const s of SEUILS) if (v > s) sets[`${z}|${s}`].add(key)
      }
    }
    if (j % (STRIDE * 400) === 0) {
      process.stdout.write(`\r  ${path.basename(dir).slice(12, 40)} ${((100 * j) / meta.height).toFixed(0)} %   `)
    }
  }
  fs.closeSync(fd)
  process.stdout.write(`\r  ${path.basename(dir).slice(12, 40)} fait          \n`)
}

const dirs = fs.readdirSync(SRC).filter((d) => fs.existsSync(path.join(SRC, d, 'meta.json'))).sort()
console.log(`\nRecensement bathymétrique — ${dirs.length} pivots, 1 pixel sur ${STRIDE}\n`)
for (const d of dirs) scan(path.join(SRC, d))

// poids moyen mesuré au banc (bench-bathy-quant, barème « moyen 1/4/8 »).
// Les tuiles côtières sont plus légères que les abyssales : 30 Ko est une
// moyenne prudente pour un jeu recentré sur les plateaux.
const KO = 30
console.log('\n' + '='.repeat(72))
console.log('seuil'.padEnd(22) + ZOOMS.map((z) => `z${z}`.padStart(9)).join('') + 'total'.padStart(10) + 'poids'.padStart(11))
for (const s of SEUILS) {
  const counts = ZOOMS.map((z) => sets[`${z}|${s}`].size)
  const total = counts.reduce((a, b) => a + b, 0)
  const label = s === -Infinity ? 'toute la mer' : `eau > ${s} m`
  console.log(
    label.padEnd(22) +
    counts.map((c) => c.toLocaleString('fr-FR').padStart(9)).join('') +
    total.toLocaleString('fr-FR').padStart(10) +
    `${((total * KO) / 1024).toFixed(0)} Mo`.padStart(11)
  )
}
console.log('='.repeat(72))
console.log(`poids estimé à ${KO} Ko/tuile (barème « moyen 1/4/8 » du banc).\n`)
