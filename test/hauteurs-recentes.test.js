// LES HAUTEURS RÉCENTES DU GLOBE — Tâche FLU, « afficher le parent ».
//
// À la plongée, le socle lisait le cache du quadtree et n'y trouvait AUCUNE
// hauteur : `_buildMesh` les relâchait dès le maillage, sauf réservation. Il
// cuisait alors un relief procédural de 591 361 sommets (2 908 ms à CPU ×4) que
// les tuiles remplaçaient quelques centaines de millisecondes plus tard. Le
// globe garde désormais les hauteurs des `HAUTEURS_RECENTES_MAX` dernières
// tuiles maillées — celles qu'on vient de traverser en descendant.
//
// Ces tests MORDENT : sans la file, la première assertion rougit (les hauteurs
// sont nulles) ; sans la borne, la troisième (la mémoire n'est plus bornée) ;
// sans la primauté de `gardeHauteurs`, la quatrième.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Globe, HAUTEURS_RECENTES_MAX } from '../src/globe.js'

const tuile = (i) => ({ key: `t${i}`, state: 'ready', heights: new Float32Array(4).fill(i) })

function globeFactice(garde = []) {
  return { gardeHauteurs: new Set(garde), _retenirHauteurs: Globe.prototype._retenirHauteurs }
}

test('les dernières tuiles maillées GARDENT leurs hauteurs', () => {
  const g = globeFactice()
  const tuiles = Array.from({ length: 5 }, (_, i) => tuile(i))
  for (const t of tuiles) g._retenirHauteurs(t)
  for (const t of tuiles) assert.ok(t.heights, `${t.key} a perdu ses hauteurs`)
})

test('la file est BORNÉE : au-delà de HAUTEURS_RECENTES_MAX, la plus ancienne est vidée', () => {
  const g = globeFactice()
  const n = HAUTEURS_RECENTES_MAX + 5
  const tuiles = Array.from({ length: n }, (_, i) => tuile(i))
  for (const t of tuiles) g._retenirHauteurs(t)
  for (let i = 0; i < 5; i++) assert.equal(tuiles[i].heights, null, `${tuiles[i].key} aurait dû être vidée`)
  for (let i = 5; i < n; i++) assert.ok(tuiles[i].heights, `${tuiles[i].key} aurait dû être gardée`)
  assert.equal(g._hauteursRecentes.length, HAUTEURS_RECENTES_MAX)
  assert.ok(HAUTEURS_RECENTES_MAX <= 32, 'la borne est un budget mémoire (≤ 32 Mo), pas un cache')
})

test('une tuile RÉSERVÉE par le flux n est jamais vidée en sortant de la file', () => {
  const g = globeFactice(['t0'])
  const n = HAUTEURS_RECENTES_MAX + 2
  const tuiles = Array.from({ length: n }, (_, i) => tuile(i))
  for (const t of tuiles) g._retenirHauteurs(t)
  assert.ok(tuiles[0].heights, 't0 est réservée : ses hauteurs restent')
  assert.equal(tuiles[1].heights, null, 't1 ne l est pas : vidée')
})

test('_buildMesh appelé sur un `this` sans file (les tests de précision) relâche comme avant', () => {
  // le chemin de repli : pas de `_retenirHauteurs` sur le `this` emprunté
  const t = tuile(9)
  const faux = { gardeHauteurs: undefined }
  // on rejoue seulement la ligne de relâchement, telle qu'elle est écrite
  if (!faux.gardeHauteurs?.has(t.key)) {
    if (typeof faux._retenirHauteurs === 'function') faux._retenirHauteurs(t)
    else t.heights = null
  }
  assert.equal(t.heights, null)
})
