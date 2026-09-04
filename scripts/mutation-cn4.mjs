#!/usr/bin/env node
// MUTATION DU PRODUIT — CN4. « Une suite verte ne prouve rien » : on casse, on
// regarde la couleur, on restaure, et on vérifie l'empreinte.
//
// ⚠️ **ÉDITION EN BINAIRE** (`Buffer.indexOf`, écriture d'un Buffer) : aucune
// réécriture de fins de ligne, donc aucune fausse alerte CRLF. Le motif est
// refusé s'il apparaît zéro ou plusieurs fois. La restauration est vérifiée par
// md5 à chaque tour, y compris si le test plante.
//
//   node scripts/mutation-cn4.mjs            # toutes les mutations
//   node scripts/mutation-cn4.mjs palier-mort
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const md5 = (b) => createHash('md5').update(b).digest('hex')

// La mutation du noteur (CN3 §7), mot pour mot : `_traverse` prescrit la CIBLE
// au lieu du SERVI — le palier atomique est arraché, tout le reste reste debout.
const MUTATIONS = {
  'palier-mort': {
    fichier: 'src/globe.js',
    de: 'this._zCropServi || this._zCropEcran || ZOOM_SOCLE',
    vers: 'this._zCropCible || this._zCropEcran || ZOOM_SOCLE',
    quoi: '`_traverse` prescrit la CIBLE au lieu du SERVI — le palier atomique n’existe plus',
  },
  'couvert-permissif': {
    fichier: 'src/globe.js',
    de: '  _cropCouvert(L, camDir) {',
    vers: '  _cropCouvert(L, camDir) { return true;',
    quoi: '`_cropCouvert` dit toujours oui — le palier monte sans attendre la couverture',
  },
}

const BANCS = [
  ['crop-nettete-ecran ③ (banc immédiat, CN1)', 'test/crop-nettete-ecran.test.js'],
  ['crop-finesse-palier ⓐⓑⓒ (porte, CN4)', 'test/crop-finesse-palier.test.js'],
]

function passe(fichier) {
  try {
    execFileSync(process.execPath, ['--test', fichier], { cwd: racine, stdio: 'pipe' })
    return true
  } catch { return false }
}

const demandees = process.argv.slice(2)
const noms = demandees.length ? demandees : Object.keys(MUTATIONS)

for (const [titre, f] of BANCS) console.log(`dépôt · ${titre} : ${passe(f) ? '✔' : '✖'}`)

for (const nom of noms) {
  const m = MUTATIONS[nom]
  if (!m) { console.error(`mutation inconnue : ${nom}`); process.exitCode = 1; continue }
  const chemin = resolve(racine, m.fichier)
  const avant = readFileSync(chemin)
  const empreinte = md5(avant)
  const de = Buffer.from(m.de, 'utf8')
  let n = 0
  for (let i = avant.indexOf(de); i !== -1; i = avant.indexOf(de, i + 1)) n++
  if (n !== 1) { console.error(`⛔ ${nom} : motif trouvé ${n} fois dans ${m.fichier} — refusé`); process.exitCode = 1; continue }
  const i = avant.indexOf(de)
  const mute = Buffer.concat([avant.subarray(0, i), Buffer.from(m.vers, 'utf8'), avant.subarray(i + de.length)])
  console.log(`\n── ${nom} : ${m.quoi}`)
  try {
    writeFileSync(chemin, mute)
    for (const [titre, f] of BANCS) console.log(`   ${titre} : ${passe(f) ? '✔ (aveugle)' : '✖ (mord)'}`)
  } finally {
    writeFileSync(chemin, avant)
    const apres = md5(readFileSync(chemin))
    console.log(`   restauré · md5 ${empreinte} → ${apres} ${apres === empreinte ? '✔' : '⛔ DIVERGENT'}`)
    if (apres !== empreinte) process.exitCode = 1
  }
}
