// Worker de terrain — il n'a que des travaux PURS.
//
// Tout ce qui pourrait diverger d'une exécution en ligne vit dans
// `terrain-jobs.js`, qui est testé en node contre `analyzeDem`/`buildSeaMask`
// octet pour octet, et contre `detectLakes` cellule pour cellule. Ce fichier
// n'est que la boîte aux lettres : s'il grossit, c'est que du calcul s'est
// glissé hors de la portée du test.
import { computeTerrainJob, computeLakeJob } from './terrain-jobs.js'

self.onmessage = (e) => {
  const { id, kind, ...job } = e.data
  // ⚠️ `kind` est RETIRÉ du travail avant de le passer au calcul : les deux
  // fonctions déstructurent leurs entrées, une clé de routage qui traînerait
  // dedans finirait par s'appeler comme un réglage.
  if (kind === 'lacs') {
    // les cellules sont TRANSFÉRÉES : le Worker n'en a plus l'usage, et c'est
    // ce qui rend le retour gratuit (1,2 ms mesurées pour 2,5 Mo).
    const { lacs, transfert } = computeLakeJob(job)
    self.postMessage({ id, lacs }, transfert)
    return
  }
  const r = computeTerrainJob(job)
  // les deux tableaux de résultat sont TRANSFÉRÉS (le Worker n'en a plus
  // l'usage) — contrairement au MNT de l'aller, qui est copié.
  // ⚠️ LES DEUX SONT FACULTATIFS : le masque de mer ne se cuit que s'il sera lu
  // (`avecMer`, voir terrain-jobs.js). Un `null.buffer` ferait JETER la boîte
  // aux lettres, et le travail entier se perdrait — sans rien à l'écran qu'un
  // relief resté en l'état.
  const transfert = []
  if (r.sea) transfert.push(r.sea.buffer)
  if (r.analysis) transfert.push(r.analysis.buffer)
  self.postMessage({ id, ...r }, transfert)
}
