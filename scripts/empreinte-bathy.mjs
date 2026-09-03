// EMPREINTE DE public/data/bathy — un SHA-256 par tuile, pour prouver AU BIT
// que la cuisson BlueTopo n'a touché à rien d'autre.
//
// ⚠️ Un décompte de fichiers ne prouve RIEN : « un banc différentiel ne
// distingue pas "rien n'a changé" de "tout est cassé pareil" » (socle-bathy).
// On compare donc le CONTENU, fichier par fichier, et on nomme les trois
// classes séparément : inchangé / modifié / ajouté.
//
//   node scripts/empreinte-bathy.mjs .banc/BT-I/avant.json
//   node scripts/empreinte-bathy.mjs .banc/BT-I/apres.json --compare .banc/BT-I/avant.json

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const RACINE = 'public/data/bathy'
const sortie = process.argv[2]
const i = process.argv.indexOf('--compare')
const ref = i >= 0 ? process.argv[i + 1] : null

// ⚠️ `find public/data/bathy` rend 0 sous Git Bash : find ne suit pas les
// jonctions Windows. On descend avec fs, qui les suit.
function balaye(dir, out, base = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) balaye(p, out, rel)
    else if (e.name.endsWith('.png'))
      out[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16)
  }
  return out
}

const emp = balaye(RACINE, {})
const cles = Object.keys(emp)
console.log(`${cles.length.toLocaleString('fr-FR')} tuiles empreintées dans ${RACINE}`)
if (sortie) {
  fs.mkdirSync(path.dirname(sortie), { recursive: true })
  fs.writeFileSync(sortie, JSON.stringify(emp))
  console.log(`→ ${sortie}`)
}

if (ref) {
  const av = JSON.parse(fs.readFileSync(ref, 'utf8'))
  const ajoutees = cles.filter((k) => !(k in av))
  const supprimees = Object.keys(av).filter((k) => !(k in emp))
  const modifiees = cles.filter((k) => k in av && av[k] !== emp[k])
  const identiques = cles.filter((k) => k in av && av[k] === emp[k])
  console.log(`\n── COMPARAISON avec ${ref} ──`)
  console.log(`  avant            : ${Object.keys(av).length.toLocaleString('fr-FR')}`)
  console.log(`  IDENTIQUES AU BIT: ${identiques.length.toLocaleString('fr-FR')}`)
  console.log(`  modifiées        : ${modifiees.length}`)
  console.log(`  ajoutées         : ${ajoutees.length}`)
  console.log(`  supprimées       : ${supprimees.length}`)
  if (modifiees.length) console.log(`  ⛔ ${modifiees.slice(0, 20).join(', ')}`)
  if (supprimees.length) console.log(`  ⛔ ${supprimees.slice(0, 20).join(', ')}`)
  const parNiveau = {}
  for (const k of ajoutees) parNiveau[k.split('/')[0]] = (parNiveau[k.split('/')[0]] ?? 0) + 1
  console.log(`  ajoutées par niveau : ${JSON.stringify(parNiveau)}`)
  process.exitCode = modifiees.length || supprimees.length ? 1 : 0
}
