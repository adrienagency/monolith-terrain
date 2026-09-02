// L'ACCALMIE DU GOUVERNEUR — PF4, bug n° 3. Voir src/accalmie-gouverneur.js.
//
//   ① la loi : rien marqué → calme ; marqué → fermé pendant ACCALMIE_ARRIVEE_MS,
//      pas une milliseconde de moins ; deux marques ne se raccourcissent pas
//   ② le branchement de `main.js`, sur le texte : le guichet du gouverneur
//      (`canStep`) lit l'accalmie, et elle est marquée au premier dessin ET à
//      chaque fin de `loadRealTerrain`

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { creerAccalmie, ACCALMIE_ARRIVEE_MS } from '../src/accalmie-gouverneur.js'

test('① la loi de l’accalmie', () => {
  let t = 1000
  const a = creerAccalmie(() => t)
  assert.equal(a.calme(), true, 'sans arrivée, le gouverneur écoute')
  a.marquer()
  assert.equal(a.calme(), false)
  t = 1000 + ACCALMIE_ARRIVEE_MS - 1
  assert.equal(a.calme(), false, 'une milliseconde avant la fin : encore fermé')
  t = 1000 + ACCALMIE_ARRIVEE_MS
  assert.equal(a.calme(), true)
  // une seconde arrivée pendant l'accalmie la PROLONGE ; une marque plus courte ne la raccourcit pas
  t = 5000
  a.marquer()
  t = 5000 + 100
  a.marquer(50)
  assert.equal(a.jusqua, 5000 + ACCALMIE_ARRIVEE_MS)
  assert.equal(ACCALMIE_ARRIVEE_MS, 10000, 'dix secondes : la rafale d’arrivée mesurée à CPU ×4 en dure neuf')
})

test('② main.js : le guichet lit l’accalmie, marquée au premier dessin et à chaque relief', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /canStep:\s*\(\)\s*=>[^\n]*&&\s*accalmie\.calme\(\)/, 'canStep doit lire accalmie.calme()')
  assert.match(main, /programmesPrets = true;?\s*accalmie\.marquer\(\)/, 'le premier dessin doit marquer l’accalmie')
  // CHAQUE relâchement du guichet MNT (`demBusy = false` dans un `finally`)
  // marque l'accalmie : le chargement d'ouverture ET l'arrivée d'une plongée
  const relachements = [...main.matchAll(/finally \{\n\s*demBusy = false\n([^\n]*)\n/g)]
  assert.ok(relachements.length >= 2, 'deux relâchements attendus (loadRealTerrain et le crochet de plongée), trouvés : ' + relachements.length)
  for (const r of relachements) assert.match(r[1], /accalmie\.marquer\(\)/, 'un relâchement du MNT ne marque pas l’accalmie : ' + r[0])
})
