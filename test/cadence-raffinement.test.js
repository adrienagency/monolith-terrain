// LA CADENCE DU RAFFINEMENT — Tâche GEL : « le logiciel se fige à z7 ».
//
// Le fil principal était saturé (97–99 % à CPU ×4, `.banc/GEL/`) par des
// raffinements du socle à écart FIXE de 350 ms, chacun coûtant plus que
// l'écart sur une machine lente. La loi lie désormais l'écart au coût mesuré.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attenteRaffinement, raffinementDu, simulerCadence, RAFFINEMENT_SOCLE_MS, PART_DU_FIL } from '../src/monde/cadence-raffinement.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('① À COÛT NUL, LA LOI EST CELLE DE FLU AU BIT PRÈS (plancher 350 ms)', () => {
  assert.equal(RAFFINEMENT_SOCLE_MS, 350)
  assert.equal(attenteRaffinement(), 350)
  assert.equal(attenteRaffinement({ dernierCoutMs: 0 }), 350)
  assert.equal(attenteRaffinement({ dernierCoutMs: NaN }), 350)
  assert.equal(attenteRaffinement({ dernierCoutMs: -5 }), 350)
  // sous le plancher, le plancher gagne : 80 ms de coût → un cycle de 320 ms < 350
  assert.equal(attenteRaffinement({ dernierCoutMs: 80 }), 350)
  assert.equal(raffinementDu({ maintenant: 1000, dernierDepart: 651, dernierCoutMs: 0 }), false)
  assert.equal(raffinementDu({ maintenant: 1000, dernierDepart: 650, dernierCoutMs: 0 }), true)
})

test('② L\'ATTENTE SUIT LE COÛT : le socle ne prend jamais plus d\'un quart du fil', () => {
  assert.equal(PART_DU_FIL, 0.25)
  // l'attente se compte DEPUIS LE DÉPART (c'est ainsi que `socleRaffine` la lit),
  // donc elle contient le coût : un cycle de 1 200 ms pour 300 ms de fil pris
  assert.equal(attenteRaffinement({ dernierCoutMs: 300 }), 1200)
  assert.equal(attenteRaffinement({ dernierCoutMs: 800 }), 3200)
  assert.equal(attenteRaffinement({ dernierCoutMs: 1200 }), 4800)
  // la part est tenue pour n'importe quel coût : coût / cycle ≤ part
  for (const c of [1, 50, 117, 350, 999, 4321, 20000]) {
    const a = attenteRaffinement({ dernierCoutMs: c })
    assert.ok(c / a <= PART_DU_FIL + 1e-12, `coût ${c} : part ${c / a}`)
  }
  // une part hors (0,1) retombe sur la part du dépôt
  assert.equal(attenteRaffinement({ dernierCoutMs: 300, part: 0 }), 1200)
  assert.equal(attenteRaffinement({ dernierCoutMs: 300, part: 1 }), 1200)
  assert.equal(attenteRaffinement({ dernierCoutMs: 300, part: 0.5 }), 600)
  assert.equal(attenteRaffinement({ dernierCoutMs: 100, part: 0.5 }), 350)
})

test('③ LA MORSURE : 25 tuiles qui atterrissent, un raffinement de 300 ms — la loi de FLU sature le fil, celle-ci le rend', () => {
  // vingt-cinq arrivées étalées sur 4 s (une toutes les 160 ms) ; l'occupation
  // se lit PENDANT le chargement (6 s), pas diluée dans un long repos
  const arrivees = Array.from({ length: 25 }, (_, i) => i * 160)
  const flu = simulerCadence({ arrivees, coutMs: 300, dureeMs: 6000, loi: () => RAFFINEMENT_SOCLE_MS })
  const gel = simulerCadence({ arrivees, coutMs: 300, dureeMs: 6000 })
  // ⚠️ le mutant (l'écart fixe) est ce que le dépôt faisait : il DOIT échouer ici,
  // sinon ce test ne prouve rien — c'est la règle « prouve la morsure par mutation ».
  // 300 ms de coût pour 350 ms d'écart depuis le départ : 50 ms de fil libre par cycle.
  assert.ok(flu.occupation > 0.5, `l'écart fixe devrait saturer le fil : ${flu.occupation}`)
  assert.ok(gel.occupation <= PART_DU_FIL + 1e-9, `le socle prend ${gel.occupation} du fil, plus qu'un quart`)
  assert.ok(gel.raffinements < flu.raffinements, `${gel.raffinements} raffinements contre ${flu.raffinements}`)
  // et RIEN n'est perdu : sur 12 s, la dernière révision est servie dans les deux cas
  const gelLong = simulerCadence({ arrivees, coutMs: 300, dureeMs: 12000 })
  const fluLong = simulerCadence({ arrivees, coutMs: 300, dureeMs: 12000, loi: () => RAFFINEMENT_SOCLE_MS })
  assert.equal(gelLong.servie, gelLong.revision)
  assert.equal(fluLong.servie, fluLong.revision)
  assert.equal(gelLong.revision, 25)
})

test('④ LE PREMIER PART AU PLANCHER, LE DERNIER PART TOUJOURS', () => {
  // une seule arrivée à t = 0 : le premier raffinement part sans coût connu, au plancher
  const seul = simulerCadence({ arrivees: [0], coutMs: 1200, dureeMs: 5000 })
  assert.equal(seul.raffinements, 1)
  assert.equal(seul.servie, 1)
  // deux arrivées : la seconde tombe pendant l'attente (1 200 ms de coût → 4 800 ms
  // de cycle) et n'est PAS sautée : elle part quand l'attente est écoulée
  const deux = simulerCadence({ arrivees: [0, 100], coutMs: 1200, dureeMs: 10000 })
  assert.equal(deux.raffinements, 2)
  assert.equal(deux.servie, 2)
  // et pas avant : sur 4 000 ms, un seul est parti
  const court = simulerCadence({ arrivees: [0, 100], coutMs: 1200, dureeMs: 4000 })
  assert.equal(court.raffinements, 1)
})

test('⑤ `main.js` APPLIQUE LA LOI DANS `socleRaffine`, ET MESURE LE COÛT (nappe + socle)', () => {
  const code = sansCommentaires(lire('src/main.js'))
  const i = code.indexOf('function socleRaffine()')
  assert.ok(i > 0, '`socleRaffine` a disparu')
  const corps = code.slice(i, code.indexOf('\n}\n', i) + 3)
  assert.ok(/attenteRaffinement\(\{\s*dernierCoutMs: _socleDernierCoutMs\s*\}\)/.test(corps), 'le raffinement ne lit plus l\'attente sur le coût')
  assert.equal(/RAFFINEMENT_SOCLE_MS\b/.test(corps), false, 'l\'écart fixe est revenu dans `socleRaffine`')
  // le coût de la nappe ET celui du socle entrent dans la mesure
  assert.ok(/_socleDernierCoutMs = performance\.now\(\) - /.test(corps), 'le coût de `rafraichirFenetre` n\'est plus mesuré')
  assert.ok(/_socleDernierCoutMs \+= performance\.now\(\) - /.test(corps), 'le coût de `plinth.rebuild` n\'est plus ajouté')
  assert.ok(/from '\.\/monde\/cadence-raffinement\.js'/.test(code), 'la loi n\'est plus importée')
})
