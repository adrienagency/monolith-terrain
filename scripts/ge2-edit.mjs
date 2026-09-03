// Édition BINAIRE d'un fichier — jamais en mode texte (sous Windows le mode
// texte réécrit tout le fichier en CRLF contre le .gitattributes, et deux tests
// sont tombés là-dessus sur ce chantier). Usage :
//   node scripts/ge2-edit.mjs <fichier> <ancien.txt> <nouveau.txt> [--n 1]
import fs from 'node:fs'
const [f, a, n] = process.argv.slice(2)
const N = process.argv.includes('--n') ? Number(process.argv[process.argv.indexOf('--n') + 1]) : 1
const buf = fs.readFileSync(f)
const anc = fs.readFileSync(a), nou = fs.readFileSync(n)
const s = buf.toString('latin1'), sa = anc.toString('latin1'), sn = nou.toString('latin1')
let c = 0, i = -1
while ((i = s.indexOf(sa, i + 1)) >= 0) c++
if (c !== N) { console.error(`ancien trouvé ${c} fois, ${N} attendu`); process.exit(1) }
fs.writeFileSync(f, Buffer.from(s.split(sa).join(sn), 'latin1'))
console.log(`ok : ${c} remplacement(s) dans ${f}`)
