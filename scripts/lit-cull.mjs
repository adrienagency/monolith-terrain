// Dépouille les relevés de `sonde-cull.mjs` en un tableau lisible.
//   node scripts/lit-cull.mjs D1-avant-majorque D2-apres-majorque …
import fs from 'node:fs'
import path from 'node:path'
const DIR = path.resolve(process.cwd(), '.banc', 'CULL')
const cols = [
  ['naissance cache', (r) => r.naissance?.cache],
  ['cache max', (r) => r.cacheMax],
  ['cache hors emprise p50/max', (r) => `${r.cacheHors?.p50} / ${r.cacheHors?.max}`],
  ['maillées hors emprise p50/max', (r) => `${r.mailleesHors?.p50} / ${r.mailleesHors?.max}`],
  ['dessinées hors emprise p50/max', (r) => `${r.dessineesHors?.p50} / ${r.dessineesHors?.max}`],
  ['parcourues hors emprise p50', (r) => r.visitesHors?.p50],
  ['parcourues p50', (r) => r.visites?.p50],
  ['ms/image p50/p99', (r) => `${r.msImage?.p50} / ${r.msImage?.p99}`],
  ['_traverse p50/p99', (r) => `${r.traverse?.p50} / ${r.traverse?.p99}`],
  ['update p50/p99', (r) => `${r.update?.p50} / ${r.update?.p99}`],
  ['crop net après l’arrêt (ms)', (r) => r.nettetéCropMs],
  ['calme fin (ms)', (r) => r.calmeFinMs],
  ['requêtes descente', (r) => r.reseau?.descente?.requetes],
  ['Mio descente', (r) => ((r.reseau?.descente?.octets || 0) / 1048576).toFixed(1)],
  ['TROUS en vol max/moy px', (r) => `${r.trousVol?.enclavesMax} / ${r.trousVol?.enclavesMoy}`],
  ['TROUS en vol composantes max', (r) => r.trousVol?.composantesMax],
  ['TROUS au repos max px', (r) => r.trous?.enclavesMax],
  ['parents partiels max', (r) => r.trousVol?.partielsMax],
]
const noms = process.argv.slice(2)
const j = noms.map((n) => JSON.parse(fs.readFileSync(path.join(DIR, n + '.json'), 'utf8')))
console.log('| grandeur | ' + noms.join(' | ') + ' |')
console.log('|---|' + noms.map(() => '---|').join(''))
for (const [nom, f] of cols) console.log(`| ${nom} | ` + j.map((x) => f(x.resume)).join(' | ') + ' |')
console.log('\nleviers : ' + j.map((x, i) => `${noms[i]} → cropZoomEcran ${x.levier}, jupe ${x.jupe}`).join(' · '))
