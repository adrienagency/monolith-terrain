// CUISSON BLUETOPO PAR ZONE — pivot puis tuiles, avec la COLONNE DE POIDS que
// le coordinateur réclame avant d'étendre : Mo par zone, et total.
//
// LES TROIS RÉGLAGES, ET POURQUOI ILS NE SONT PAS CEUX DU SOCLE
//
//  1. `--shelf -99999` — le filtre du plateau est fait pour GEBCO, dont
//     l'argument est « une tuile qui n'a que de l'abysse n'apporte rien sur le
//     terrarium ». À 464 m c'est vrai ; à 4-16 m c'est faux, et c'est ce filtre
//     qui perd le TALUS CONTINENTAL (≈ 3 650 tuiles z12 entre −500 et −2 000 m,
//     canyon du Mississippi compris). Une source fine ne se cuit pas avec lui.
//  2. `--no-quant` + `--pas-vertical 0.125` — le barème 1/4/8 m et l'arrondi au
//     mètre sont faits pour une source EN MÈTRES ENTIERS. Mesuré avant : à
//     l'embouchure de la Chesapeake l'étendue 9×9 valait 2 m à z11 et 1 m à z12,
//     soit un ou deux PAS de quantification — on mesurait l'arrondi, pas le fond.
//  3. z13 sur les zones à forte valeur, z10 ailleurs. z13 = 19 m au sol à 37° N,
//     encore 5× au-dessus du 4 m natif : on ne surzoome pas, on s'arrête avant.
//
//   node scripts/cuisson-bluetopo.mjs --regions chesapeake,ny-bight --out public/data/bathy
//   node scripts/cuisson-bluetopo.mjs --tout --dry     (la colonne de poids seule)

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const flag = (n) => argv.includes(`--${n}`)
const OUT = arg('out', 'public/data/bathy')

// ⚡ zmax 13 = « forte valeur cartographique » (arbitrage d'Adrien) ; 10 ailleurs.
export const REGIONS = {
  chesapeake: { bbox: [-76.5, 36.9, -75.9, 37.6], tiff: 'data/bluetopo/tiff', zmax: 13, pas: 10 },
  'chesa-median': { bbox: [-76.5, 38.0, -76.1, 38.4], zmax: 13, pas: 10 },
  virginia: { bbox: [-75.5, 36.6, -75.1, 37.0], zmax: 13, pas: 10 },
  'ny-bight': { bbox: [-74.1, 40.3, -73.7, 40.7], zmax: 13, pas: 10 },
  georges: { bbox: [-67.7, 41.1, -67.3, 41.5], zmax: 10, pas: 24 },
  louisiane: { bbox: [-90.7, 28.6, -90.3, 29.0], zmax: 13, pas: 10 },
  'floride-o': { bbox: [-83.4, 27.3, -83.0, 27.7], zmax: 13, pas: 12 },
}

const nom = (r) => REGIONS[r].tiff ?? `data/bluetopo/regions/${r}`
const pivotDe = (r) => `data/pivot-bt/${r}`
const noeud = (a) => execFileSync(process.execPath, a, { stdio: 'inherit', maxBuffer: 1 << 28 })

const octets = (dir) => {
  let n = 0
  let b = 0
  const rec = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) rec(p)
      else if (e.name.endsWith('.png')) {
        n++
        b += fs.statSync(p).size
      }
    }
  }
  rec(dir)
  return { n, b }
}

const choisies = flag('tout')
  ? Object.keys(REGIONS)
  : (arg('regions') || 'chesapeake').split(',').filter((r) => REGIONS[r])

const bilan = []
for (const r of choisies) {
  const { bbox, zmax, pas } = REGIONS[r]
  const src = nom(r)
  const piv = pivotDe(r)
  if (!fs.existsSync(path.join(piv, 'meta.json'))) {
    console.log(`\n══ PIVOT ${r} ══`)
    noeud([
      '--max-old-space-size=8192',
      'scripts/pivot-bluetopo.mjs',
      '--tiff', src, '--out', piv,
      '--bbox', bbox.join(','), '--pas', String(pas),
    ])
  }
  const avant = octets(OUT)
  console.log(`\n══ TUILES ${r} — z9..z${zmax} ══`)
  noeud([
    'scripts/build-bathy-tiles.mjs',
    '--src', piv, '--out', OUT,
    '--zmin', '9', '--zmax', String(zmax),
    '--bbox', bbox.join(','),
    // les trois réglages de source FINE, documentés en tête de fichier
    '--shelf', '-99999', '--no-quant', '--pas-vertical', '0.125',
    ...(flag('dry') ? ['--dry'] : []),
  ])
  const apres = octets(OUT)
  bilan.push({ zone: r, zmax, tuiles: apres.n - avant.n, ko: (apres.b - avant.b) / 1024 })
}

console.log('\n╔═══════════════ POIDS PAR ZONE — la colonne demandée ═══════════════╗')
console.log('  zone            zmax   tuiles      poids     Ko/tuile')
let T = 0
let KO = 0
for (const b of bilan) {
  T += b.tuiles
  KO += b.ko
  console.log(
    `  ${b.zone.padEnd(15)} z${String(b.zmax).padEnd(4)} ${String(b.tuiles).padStart(6)}  ${(b.ko / 1024).toFixed(2).padStart(7)} Mo  ${(b.ko / Math.max(1, b.tuiles)).toFixed(1).padStart(6)}`,
  )
}
console.log(`  ${'TOTAL'.padEnd(20)} ${String(T).padStart(6)}  ${(KO / 1024).toFixed(2).padStart(7)} Mo`)
console.log('╚════════════════════════════════════════════════════════════════════╝\n')
