// Worker de terrain — il n'a qu'un seul travail, et ce travail est PUR.
//
// Tout ce qui pourrait diverger d'une exécution en ligne vit dans
// `terrain-jobs.js`, qui est testé en node contre `analyzeDem`/`buildSeaMask`
// octet pour octet. Ce fichier n'est que la boîte aux lettres : s'il grossit,
// c'est que du calcul s'est glissé hors de la portée du test.
import { computeTerrainJob } from './terrain-jobs.js'

self.onmessage = (e) => {
  const { id, ...job } = e.data
  const r = computeTerrainJob(job)
  // les deux tableaux de résultat sont TRANSFÉRÉS (le Worker n'en a plus
  // l'usage) — contrairement au MNT de l'aller, qui est copié.
  const transfert = [r.sea.buffer]
  if (r.analysis) transfert.push(r.analysis.buffer)
  self.postMessage({ id, ...r }, transfert)
}
