import test from 'node:test'
import assert from 'node:assert/strict'
import { PALIERS } from '../src/palier-machine.js'
import { VOISINES_3X3, machinePorteContinu, forceUrl, continuActif, etatInterrupteur } from '../src/fenetre-reglage.js'

// ══════════ LE SEUIL EST CELUI DE LA TABLE, PAS UN CHIFFRE À CÔTÉ ═══════════
//
// Ce test-ci est le plus important du fichier : il verrouille l'affirmation de
// l'étude (§6) selon laquelle la table des paliers dit DÉJÀ qui porte un 3×3.
// Si quelqu'un remonte ou descend un `damierMax`, c'est ici qu'il l'apprend.

test('la table des paliers tranche déjà : ALLÉGÉ porte les 8 voisines, ESSENTIEL non', () => {
  assert.equal(VOISINES_3X3, 8)
  assert.equal(PALIERS[2].nom, 'ALLÉGÉ')
  assert.equal(PALIERS[2].damierMax, 8, 'le palier de l’iMac 2015 porte exactement les 8 voisines d’un 3×3')
  assert.equal(PALIERS[3].nom, 'ESSENTIEL')
  assert.equal(PALIERS[3].damierMax, 4, 'le palier du dessous ne porte qu’une croix')
})

test('machinePorteContinu : les paliers 0 à 2 portent le mode, le palier 3 le refuse', () => {
  for (const i of [0, 1, 2]) {
    assert.equal(machinePorteContinu(PALIERS[i]).porte, true, `palier ${i} devrait porter`)
  }
  assert.equal(machinePorteContinu(PALIERS[3]).porte, false)
})

test('machinePorteContinu : le refus porte TOUJOURS une raison lisible et chiffrée', () => {
  const r = machinePorteContinu(PALIERS[3])
  assert.equal(r.porte, false)
  assert.match(r.raison, /ESSENTIEL/)
  assert.match(r.raison, /4/)
  assert.match(r.raison, /8/)
  // et l'acceptation aussi : l'interrupteur affiche la raison dans les deux sens
  assert.ok(machinePorteContinu(PALIERS[2]).raison.length > 0)
})

test('machinePorteContinu : une sonde muette ne retire rien — on ne refuse pas sur une absence', () => {
  // Même règle que palier-machine.js, où une sonde en échec retombe sur le
  // palier 0 : punir les machines dont on ne sait rien punirait surtout les
  // plus récentes, celles dont le nom de carte n'est pas encore dans MOTIFS.
  for (const muet of [null, undefined, {}, { nom: 'X' }, { damierMax: NaN }]) {
    assert.equal(machinePorteContinu(muet).porte, true, `${JSON.stringify(muet)} ne doit pas refuser`)
  }
})

// ══════════ L'ADRESSE ════════════════════════════════════════════════════════

test('forceUrl : « 1 » et « 0 » forcent, tout le reste est une absence', () => {
  assert.equal(forceUrl('1'), true)
  assert.equal(forceUrl('0'), false)
  for (const rien of [null, undefined, '', 'oui', 'true', '2', 'f3', ' 1']) {
    assert.equal(forceUrl(rien), null, `« ${rien} » ne doit rien forcer`)
  }
})

// ══════════ L'ÉTAT EFFECTIF ══════════════════════════════════════════════════

test('continuActif : sans rien, c’est le défaut de FLAGS qui parle', () => {
  assert.equal(continuActif({ defaut: false, machine: PALIERS[0] }), false)
  assert.equal(continuActif({ defaut: true, machine: PALIERS[0] }), true)
})

test('continuActif : la préférence l’emporte sur le défaut, dans les deux sens', () => {
  assert.equal(continuActif({ prefere: true, defaut: false, machine: PALIERS[0] }), true)
  assert.equal(continuActif({ prefere: false, defaut: true, machine: PALIERS[0] }), false)
})

test('continuActif : la machine refuse même quand la préférence dit oui', () => {
  assert.equal(continuActif({ prefere: true, defaut: true, machine: PALIERS[3] }), false)
})

test('continuActif : ?f3=1 FORCE, refus machine compris — les bancs en dépendent', () => {
  // On mesure un mode continu sur une machine faible EXPRÈS, pour savoir de
  // combien il n'y tient pas. Un garde-fou qu'on ne peut pas désarmer empêche
  // de mesurer sa propre nécessité.
  assert.equal(continuActif({ force: true, prefere: false, defaut: false, machine: PALIERS[3] }), true)
})

test('continuActif : ?f3=0 coupe, même quand tout le reste dit oui', () => {
  assert.equal(continuActif({ force: false, prefere: true, defaut: true, machine: PALIERS[0] }), false)
})

test('continuActif : appelé à vide, ne lève pas et rend false', () => {
  assert.equal(continuActif(), false)
  assert.equal(continuActif({}), false)
})

// ══════════ CE QUE L'INTERRUPTEUR MONTRE ═════════════════════════════════════

test('etatInterrupteur : sur machine faible il est ÉTEINT, BLOQUÉ, et il dit pourquoi', () => {
  const e = etatInterrupteur({ prefere: true, defaut: true, machine: PALIERS[3] })
  assert.equal(e.coche, false, 'il ne doit pas s’allumer sur une machine qui ne suit pas')
  assert.equal(e.bloque, true)
  assert.match(e.note, /ESSENTIEL/)
})

// ══════════ L'ADRESSE POSE L'ÉTAT INITIAL, ELLE NE VERROUILLE PAS ═══════════
//
// Ce test-ci remplace son contraire, et le POURQUOI compte : la première
// version bloquait l'interrupteur dès que `?f3` était présent, « parce que les
// bancs en dépendent ». Adrien ouvre le serveur par une adresse qui porte
// `?f3=1` — il se retrouvait ENFERMÉ dans le mode, sans porte de sortie dans
// l'interface. Or ce dont un banc a besoin, c'est de DÉMARRER dans le bon mode,
// pas d'interdire le changement : `continuActif` continue donc d'obéir à
// l'adresse (test plus haut), mais l'interrupteur reste libre, et main.js
// oublie la force dès qu'on y touche.
test('etatInterrupteur : l’adresse pose l’état initial mais ne bloque pas le contrôle', () => {
  const on = etatInterrupteur({ force: true, prefere: false, machine: PALIERS[0] })
  assert.equal(on.coche, true, 'l’adresse dit ce qui est allumé')
  assert.equal(on.bloque, false, 'et on doit pouvoir l’éteindre depuis les Paramètres')
  assert.equal(on.note, '', 'plus de mention de verrou : il n’y a plus de verrou')
  const off = etatInterrupteur({ force: false, prefere: true, machine: PALIERS[0] })
  assert.equal(off.coche, false)
  assert.equal(off.bloque, false)
  assert.equal(off.note, '')
})

test('etatInterrupteur : ?f3=1 sur machine faible n’enferme pas non plus', () => {
  // Le cas qui piégeait le plus : l'adresse passe outre le refus machine (c'est
  // fait exprès, pour mesurer), et l'ancien code bloquait alors DEUX fois.
  // Sortir du mode doit rester possible — sinon un banc sur machine modeste
  // laissait l'utilisateur coincé jusqu'à ce qu'il édite l'adresse.
  const e = etatInterrupteur({ force: true, prefere: false, machine: PALIERS[3] })
  assert.equal(e.coche, true)
  assert.equal(e.bloque, false)
})

test('etatInterrupteur : sur machine capable il est libre et sans note', () => {
  const e = etatInterrupteur({ prefere: true, defaut: false, machine: PALIERS[2] })
  assert.deepEqual(e, { coche: true, bloque: false, note: '' })
})

test('etatInterrupteur : jamais touché, il montre le défaut de FLAGS', () => {
  assert.equal(etatInterrupteur({ prefere: null, defaut: true, machine: PALIERS[1] }).coche, true)
  assert.equal(etatInterrupteur({ prefere: null, defaut: false, machine: PALIERS[1] }).coche, false)
})

test('etatInterrupteur : ce qu’il montre coché est exactement ce que continuActif rend', () => {
  // Un interrupteur qui montre autre chose que l'état réel est un mensonge —
  // et c'est un mensonge facile à écrire, puisque ce sont deux fonctions.
  for (const force of [null, true, false]) {
    for (const prefere of [null, true, false]) {
      for (const defaut of [true, false]) {
        for (const machine of PALIERS) {
          const args = { force, prefere, defaut, machine }
          assert.equal(etatInterrupteur(args).coche, continuActif(args), JSON.stringify({ force, prefere, defaut, palier: machine.nom }))
        }
      }
    }
  }
})
