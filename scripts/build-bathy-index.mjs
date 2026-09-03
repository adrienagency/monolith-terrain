#!/usr/bin/env node
// INDEX DE COUVERTURE BATHYMÉTRIQUE — quelle source couvre quoi, jusqu'à quel
// zoom. C'est le fichier qui fait vivre la règle d'Adrien : « à chaque fois
// qu'on a une map mieux définie, on l'utilise ; à défaut, on laisse la map
// GEBCO en soutien. »
//
// POURQUOI UN INDEX PLUTÔT QU'UN ESSAI À L'AVEUGLE. Le client pourrait très
// bien demander z10 partout et encaisser les 404 — la boucle de repli de
// `loadBathyPatch` les absorbe déjà. Mais ça ferait deux requêtes perdues par
// case de damier sur les 99 % du monde qui n'ont pas de source fine, sur un
// site où la bande passante Netlify se paie à la requête. Un index de quelques
// centaines d'octets, lu une fois, supprime tout ça.
//
// MÊME MOTIF que le manifeste de `scripts/build-map-cells.mjs` et de
// `src/map/geo-cells.js` : un petit fichier qui dit ce qui existe, des données
// par zone, et un repli sur le monde entier quand il ne dit rien.
//
// LE PRINCIPE : on ne DÉCLARE pas une couverture, on la CONSTATE. Le fichier
// `scripts/bathy-zones.json` dit ce qu'on a l'intention de servir ; ce script
// va compter les tuiles réellement présentes sur le disque et n'écrit que les
// zones qui en ont. Une zone déclarée mais jamais cuite est donc sans effet —
// on ne peut pas promettre au client une résolution qu'on n'a pas déployée.
//
// USAGE
//   node scripts/build-bathy-index.mjs
//   node scripts/build-bathy-index.mjs --tiles public/data/bathy --zones scripts/bathy-zones.json
//
// SORTIE : public/data/bathy/index.json, lu par src/bathy-sources.js.
// Absent ⇒ z8 partout, c'est-à-dire exactement le comportement d'avant.

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const TILES = arg('tiles', 'public/data/bathy')
const ZONES = arg('zones', 'scripts/bathy-zones.json')
const OUT = arg('out', path.join(TILES, 'index.json'))

const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// Toutes les tuiles présentes à un niveau donné, avec leur poids. On lit le
// disque plutôt que de refaire tourner le tuileur : c'est instantané, et ça
// mesure ce qui sera VRAIMENT déployé — y compris une cuisson interrompue.
function scanLevel(root, z) {
  const dir = path.join(root, String(z))
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const xs of fs.readdirSync(dir)) {
    const x = Number(xs)
    if (!Number.isInteger(x)) continue
    const sub = path.join(dir, xs)
    let files
    try {
      files = fs.readdirSync(sub)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.png')) continue
      const y = Number(f.slice(0, -4))
      if (!Number.isInteger(y)) continue
      out.push({ x, y, bytes: fs.statSync(path.join(sub, f)).size })
    }
  }
  return out
}

// Une tuile appartient-elle à la zone ? On teste son CENTRE, comme le fera
// `tileMaxZoom` côté client — les deux doivent trancher pareil, sinon une tuile
// de bord serait comptée ici et jamais demandée là-bas.
//
// ⚠️ ANTIMÉRIDIEN : une zone peut s'écrire ouest > est (les Fidji vont de 176°E
// à 178°O). Lue naïvement, elle serait vide.
const inSpan = (lon, w, e) => (w <= e ? lon >= w && lon <= e : lon >= w || lon <= e)

function main() {
  const decl = JSON.parse(fs.readFileSync(ZONES, 'utf8'))
  const base = decl.base ?? { source: 'gebco', zmax: 8 }
  const zmin = decl.zmin ?? 4

  console.log(`\nIndex de couverture bathymétrique`)
  console.log(`  socle    ${base.source} jusqu'à z${base.zmax}, plancher de repli z${zmin}`)
  console.log(`  tuiles   ${TILES}`)

  // Cache par niveau : deux zones peuvent viser le même z, on ne relit pas.
  const levels = new Map()
  const at = (z) => {
    if (!levels.has(z)) levels.set(z, scanLevel(TILES, z))
    return levels.get(z)
  }

  const zones = []
  let totalTuiles = 0
  let totalOctets = 0
  for (const d of decl.zones ?? []) {
    const [w, s, e, n] = d.bbox
    // Compte SUR TOUS les niveaux au-dessus du socle : une zone annoncée à z10
    // dont seul z9 a été cuit doit être publiée à z9, pas à z10.
    let zmaxReel = base.zmax
    let tuiles = 0
    let octets = 0
    const detail = []
    for (let z = base.zmax + 1; z <= d.zmax; z++) {
      const dedans = at(z).filter(
        (t) =>
          y2lat(t.y + 0.5, z) >= s &&
          y2lat(t.y + 0.5, z) <= n &&
          inSpan(x2lon(t.x + 0.5, z), w, e)
      )
      if (!dedans.length) {
        // ⛔ BT-I — « UN NIVEAU VIDE ARRÊTE LA MONTÉE » EST FAUX POUR UNE PETITE
        // ZONE, et ça a coûté CINQ zones cuites pour rien, EN SILENCE.
        //
        // La règle d'origine est juste tant que la zone est plus grande qu'une
        // tuile : un z9 absent y signifie « pas cuit », et publier z13 par
        // dessus mentirait au client. Mais on teste le CENTRE de la tuile, et
        // une tuile z9 fait 0,703° de large : une zone de 0,4° peut ne contenir
        // AUCUN centre de tuile z9 tout en étant intégralement couverte à
        // z10…z13. Mesuré : `virginia`, `ny-bight`, `chesa-median`, `georges`
        // et `puget` — 700 tuiles sur le disque, écartées de l'index sans un
        // mot, et la cascade serait restée au socle z8 sur les cinq.
        //
        // On ne confond donc plus « niveau non cuit » et « zone trop petite
        // pour contenir un centre » : on le CALCULE.
        const largeurTuile = 360 / 2 ** z
        // la hauteur d'une tuile en degrés varie avec la latitude (Mercator) :
        // on la mesure à la latitude de la zone, on ne la suppose pas carrée.
        const yMid = Math.floor(
          ((0.5 - Math.log(Math.tan(Math.PI / 4 + (((s + n) / 2) * Math.PI) / 360)) / (2 * Math.PI)) * 2 ** z),
        )
        const hauteurTuile = Math.abs(y2lat(yMid, z) - y2lat(yMid + 1, z))
        if (e - w >= largeurTuile && n - s >= hauteurTuile) break // vraiment pas cuit
        continue // trop petite pour garantir un centre : l'absence ne prouve rien
      }
      zmaxReel = z
      tuiles += dedans.length
      const b = dedans.reduce((a, t) => a + t.bytes, 0)
      octets += b
      detail.push(`z${z} ${dedans.length} tuiles ${(b / 1024 / 1024).toFixed(1)} Mo`)
    }
    // 🔴 B3 — UNE ZONE DE LAC NE DÉCLARE PAS UNE RÉSOLUTION, ELLE DÉCLARE UNE
    // NAPPE. Le test ci-dessous (« aucune tuile plus fine que le socle ⇒
    // ignorée ») est juste pour une source marine régionale : promettre z10
    // sans avoir cuit z10 serait mentir au client. Mais un lac dont le fond est
    // DÉJÀ dans le socle GEBCO — le Baïkal y est, mesuré sur disque : −304 m à
    // 53,5 / 108,1 — n'a aucune tuile fine à cuire, et sa zone porte pourtant
    // le seul renseignement qui rende ce fond lisible : `waterLevelM`. Sans
    // nappe, `seaLevel = 0`, la surface du lac à +456 m est classée TERRE, et le
    // fond que le socle porte déjà n'est jamais lu.
    const nappe = Number.isFinite(d.waterLevelM) ? Number(d.waterLevelM) : undefined
    if (zmaxReel <= base.zmax && nappe === undefined) {
      console.log(`  ✖ ${d.id.padEnd(10)} déclarée à z${d.zmax} mais AUCUNE tuile fine cuite → ignorée`)
      continue
    }
    totalTuiles += tuiles
    totalOctets += octets
    console.log(
      `  ✓ ${d.id.padEnd(10)} ${d.source.padEnd(11)} z${zmaxReel}${zmaxReel < d.zmax ? ` (déclarée z${d.zmax})` : ''}  ${detail.join(' · ')}`
    )
    zones.push({
      id: d.id, source: d.source, zmax: zmaxReel, bbox: d.bbox,
      ...(nappe === undefined ? {} : { waterLevelM: nappe }),
    })
  }

  const index = { version: 1, base, zmin, zones }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(index) + '\n')
  const taille = fs.statSync(OUT).size

  console.log(`\n✓ ${zones.length} zone(s) fine(s) · ${totalTuiles.toLocaleString('fr-FR')} tuiles au-dessus du socle · ${(totalOctets / 1024 / 1024).toFixed(1)} Mo`)
  console.log(`  index de ${taille} octets → ${OUT}`)
  if (!zones.length) {
    console.log(`  (index vide : le client se comportera exactement comme avant, z${base.zmax} partout)`)
  }
  console.log()
}

main()
