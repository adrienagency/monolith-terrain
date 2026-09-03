// BASCULE AVANT / APRÈS — retire (puis remet) les 127 tuiles BlueTopo et la
// zone `chesapeake` de l'index, pour mesurer l'AVANT sur le MÊME code.
//
// ⚠️ Pourquoi pas un simple `git stash` : les tuiles sont dans `public/data/`,
// qui est *gitignore*. Un banc « avant » qui oublie de les retirer mesurerait
// l'après deux fois et rendrait « aucun changement » — le faux constat le plus
// facile de tout ce chantier.
//
//   node scripts/bascule-bt-i.mjs avant   → tuiles rangées, index sans la zone
//   node scripts/bascule-bt-i.mjs apres   → tuiles remises, index avec la zone
//   node scripts/bascule-bt-i.mjs etat

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const TUILES = 'public/data/bathy'
const REMISE = '.banc/BT-I/tuiles-bluetopo'
const AVANT = '.banc/BT-I/avant.json'
const APRES = '.banc/BT-I/apres.json'
const mode = process.argv[2]

const ajoutees = () => {
  const av = JSON.parse(fs.readFileSync(AVANT, 'utf8'))
  const ap = JSON.parse(fs.readFileSync(APRES, 'utf8'))
  return Object.keys(ap).filter((k) => !(k in av))
}

const bougeTout = (de, vers) => {
  let n = 0
  for (const rel of ajoutees()) {
    const src = path.join(de, rel)
    const dst = path.join(vers, rel)
    if (!fs.existsSync(src)) continue
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.renameSync(src, dst)
    n++
  }
  return n
}

// L'index se REGÉNÈRE plutôt qu'il ne se bricole : `build-bathy-index.mjs`
// constate les tuiles présentes. Sans tuiles BlueTopo il retire la zone tout
// seul, ce qui prouve au passage que la mécanique « on ne déclare pas, on
// constate » fonctionne.
const reconstruitIndex = () =>
  execFileSync(process.execPath, ['scripts/build-bathy-index.mjs'], { encoding: 'utf8' })

if (mode === 'avant') {
  const n = bougeTout(TUILES, REMISE)
  console.log(`${n} tuiles BlueTopo rangées dans ${REMISE}`)
  console.log(reconstruitIndex().split('\n').filter((l) => /chesapeake|zone\(s\)/.test(l)).join('\n'))
} else if (mode === 'apres') {
  const n = bougeTout(REMISE, TUILES)
  console.log(`${n} tuiles BlueTopo remises dans ${TUILES}`)
  console.log(reconstruitIndex().split('\n').filter((l) => /chesapeake|zone\(s\)/.test(l)).join('\n'))
} else {
  const dedans = ajoutees().filter((k) => fs.existsSync(path.join(TUILES, k))).length
  const rangees = ajoutees().filter((k) => fs.existsSync(path.join(REMISE, k))).length
  const idx = JSON.parse(fs.readFileSync(path.join(TUILES, 'index.json'), 'utf8'))
  console.log(`en place : ${dedans} · rangées : ${rangees}`)
  console.log(`zones de l'index : ${idx.zones.map((z) => z.id + '@z' + z.zmax).join(', ')}`)
}
