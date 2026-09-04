// LE `break` DE `_tuileLaPlusFine` — Tâche FLU, poste ③.
//
// ⚠️ **LE PARCOURS COMPLET COÛTAIT 1 698 ms DE FIL PRINCIPAL À z6** (rapport
// D16-b, réserve 1 : 3,27 µs par sommet × 519 404 sommets), alors que
// `tuilesAvecHauteurs()` trie DÉJÀ du plus fin au plus grossier — la première
// tuile qui couvre le point est donc la réponse, et tout ce qui suit est du
// travail perdu.
//
// ⚠️ **ET `candidates` EST UN PARAMÈTRE PUBLIC** : rien ne garantit le tri chez un
// appelant qui fabrique sa liste lui-même (`test/crop-parois.test.js` exige même
// que « l'ordre de la liste ne fasse rien »). Le raccourci ne s'applique donc
// QU'AUX listes que `tuilesAvecHauteurs()` a triées, et il le sait par une
// étiquette posée sur le tableau (`trieeFinAbord`), jamais par supposition.
//
// Les deux tests ci-dessous MORDENT : le premier rougit si le `break` disparaît
// (une liste qui explose dès qu'on la lit au-delà de la réponse), le second
// rougit si le `break` s'applique à une liste non triée.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Globe } from '../src/globe.js'

function tuile(z, x, y, v) {
  const heights = new Float32Array(4)
  heights.fill(v)
  return { z, x, y, size: 2, heights, key: `${z}/${x}/${y}` }
}

const N13 = 2 ** 13
// un point au centre de la tuile 13/4300/4600, exprimé en lat/lon
const mx = (4300 + 0.5) / N13
const my = (4600 + 0.5) / N13
const lon = mx * 360 - 180
const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI

/** Une liste qui LÈVE dès qu'on lit un élément au-delà de `limite`. */
function listeQuiExplose(elements, limite) {
  return new Proxy(elements, {
    get(cible, prop, recv) {
      if (typeof prop === 'string' && /^\d+$/.test(prop) && Number(prop) >= limite) {
        throw new Error(`lecture de l élément ${prop} : le parcours ne s est pas arrêté`)
      }
      return Reflect.get(cible, prop, recv)
    },
  })
}

const cherche = (liste) => Globe.prototype._tuileLaPlusFine.call({ tuilesAvecHauteurs: () => [] }, lat, lon, liste)

test('_tuileLaPlusFine S ARRÊTE à la première tuile qui couvre quand la liste est triée fin→grossier', () => {
  const fine = tuile(13, 4300, 4600, 999)
  const grossiere = tuile(6, 4300 >> 7, 4600 >> 7, 111)
  const ailleurs = tuile(13, 1, 1, 5)
  // deux candidates avant la bonne (elles ne couvrent pas), puis la fine, puis
  // des tuiles qu'on n'a PAS LE DROIT de lire
  const liste = listeQuiExplose([ailleurs, ailleurs, fine, grossiere, grossiere, grossiere], 3)
  liste.trieeFinAbord = true
  const best = cherche(liste)
  assert.ok(best, 'la fine doit être trouvée')
  assert.equal(best.t, fine)
})

test('sans l étiquette de tri, la liste est parcourue EN ENTIER (la plus fine peut être à la fin)', () => {
  const fine = tuile(13, 4300, 4600, 999)
  const grossiere = tuile(6, 4300 >> 7, 4600 >> 7, 111)
  // grossière d abord : un `break` naïf rendrait la grossière
  const best = cherche([grossiere, fine])
  assert.equal(best.t, fine, 'la plus fine doit gagner même placée après une grossière')
  // et la liste triée mais NON étiquetée est lue jusqu au bout aussi
  const liste = listeQuiExplose([fine, grossiere], 1)
  assert.throws(() => cherche(liste), /ne s est pas arrêté/, 'sans étiquette, aucun raccourci')
})

test('tuilesAvecHauteurs() rend une liste ÉTIQUETÉE triée du plus fin au plus grossier', () => {
  const tiles = new Map()
  for (const t of [tuile(6, 1, 1, 0), tuile(13, 2, 2, 0), tuile(9, 3, 3, 0), { z: 14, x: 0, y: 0, heights: null }]) tiles.set(t.key ?? 'x', t)
  const liste = Globe.prototype.tuilesAvecHauteurs.call({ tiles })
  assert.deepEqual(liste.map((t) => t.z), [13, 9, 6])
  assert.equal(liste.trieeFinAbord, true)
})
