import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SOL_FORCE_DEFAUT, SOL_FORCE_MAX,
  NUIT_GAIN_BASE, NUIT_ASSOMBRISSEMENT_DEFAUT, NUIT_FORCE_DEFAUT, NUIT_FORCE_MAX,
  opaciteSol, fondNuit, gainNuit,
  allumageAutoNuit, MOTIF_LECTURE, MOTIF_NUIT,
} from '../src/reglages-couches.js'
import { OUI, OUI_MAIS, NON } from '../src/gardien.js'

// ═══════════════════════════════════════════════════════════════════════════
// LES CONVERSIONS TIRETTE → UNIFORME
// ═══════════════════════════════════════════════════════════════════════════
//
// Elles ont l'air triviales. Elles ne le sont pas : ce sont elles qui portent
// la promesse « double-clic = on revient au réglage d'usine », et surtout la
// garantie qu'un champ de saisie vide (parseFloat('') → NaN) ne pose pas NaN
// dans un uniforme — un NaN dans un uniforme rend le fragment NOIR, sur toute
// la carte, sans lever la moindre erreur.

test('la force du sol au défaut rend l’opacité de référence', () => {
  assert.equal(opaciteSol(SOL_FORCE_DEFAUT), SOL_FORCE_DEFAUT)
})

test('la force du sol se borne, et NaN retombe sur le défaut', () => {
  assert.equal(opaciteSol(-3), 0)
  assert.equal(opaciteSol(99), SOL_FORCE_MAX)
  assert.equal(opaciteSol(NaN), SOL_FORCE_DEFAUT)
  assert.equal(opaciteSol(undefined), SOL_FORCE_DEFAUT)
  assert.equal(opaciteSol(null), SOL_FORCE_DEFAUT)
})

test('la force du sol va AU-DELÀ de 1 — la tirette doit pouvoir pousser', () => {
  // Le défaut est déjà « ça se voit » ; la tirette sert à aller plus loin, pas
  // seulement à revenir en arrière. Une course bornée à 1 n'offrirait que le
  // recul.
  assert.ok(SOL_FORCE_MAX > SOL_FORCE_DEFAUT)
  assert.equal(opaciteSol(1.6), 1.6)
})

test('l’assombrissement nocturne s’INVERSE en fond de shader', () => {
  // La tirette dit « à quel point on éteint », le shader veut « ce qui reste ».
  // 0 % d'assombrissement = fond 1 = le sol intact ; 100 % = fond 0 = noir.
  assert.equal(fondNuit(0), 1)
  assert.equal(fondNuit(1), 0)
  // Le défaut reproduit EXACTEMENT l'ancienne constante NUIT_FOND = 0,22.
  assert.ok(Math.abs(fondNuit(NUIT_ASSOMBRISSEMENT_DEFAUT) - 0.22) < 1e-9)
})

test('l’assombrissement se borne, et NaN retombe sur le défaut', () => {
  assert.equal(fondNuit(-1), 1)
  assert.equal(fondNuit(4), 0)
  assert.ok(Math.abs(fondNuit(NaN) - 0.22) < 1e-9)
})

test('la force d’éclairage au défaut rend le gain de référence', () => {
  assert.equal(gainNuit(NUIT_FORCE_DEFAUT), NUIT_GAIN_BASE)
})

test('la force d’éclairage se borne, et NaN retombe sur le défaut', () => {
  assert.equal(gainNuit(0), 0)
  assert.equal(gainNuit(-2), 0)
  assert.equal(gainNuit(999), NUIT_GAIN_BASE * NUIT_FORCE_MAX)
  assert.equal(gainNuit(NaN), NUIT_GAIN_BASE)
})

test('la force d’éclairage est un GAIN relatif, pas un gain absolu', () => {
  // 1 = le réglage calibré sur Black Marble, 2 = deux fois plus. Un curseur
  // gradué en unités de shader (0..8) obligerait à savoir que 3,4 est « normal ».
  assert.equal(gainNuit(2), NUIT_GAIN_BASE * 2)
  assert.equal(gainNuit(0.5), NUIT_GAIN_BASE * 0.5)
})

// ═══════════════════════════════════════════════════════════════════════════
// L'ALLUMAGE AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════════════════

const base = {
  active: false,
  eteinteAlaMain: false,
  nuit: false,
  lecture: false,
  verdict: OUI,
}

test('la nuit qui tombe allume la couche', () => {
  const r = allumageAutoNuit({ ...base, nuit: true })
  assert.equal(r.allumer, true)
  assert.equal(r.motif, MOTIF_NUIT)
  assert.equal(r.refus, false)
})

test('la lecture temporelle allume la couche MÊME EN PLEIN JOUR', () => {
  // Et c'est voulu : une lecture qui démarre à 10 h passera par le crépuscule
  // dans quelques secondes. Allumer à ce moment-là, c'est avoir la mosaïque
  // prête quand la nuit arrive — `intensiteNuit` la garde invisible d'ici là.
  const r = allumageAutoNuit({ ...base, lecture: true, nuit: false })
  assert.equal(r.allumer, true)
  assert.equal(r.motif, MOTIF_LECTURE)
})

test('la lecture prime sur la nuit dans le MOTIF rendu', () => {
  const r = allumageAutoNuit({ ...base, lecture: true, nuit: true })
  assert.equal(r.motif, MOTIF_LECTURE)
})

test('en plein jour et sans lecture, rien ne s’allume', () => {
  const r = allumageAutoNuit({ ...base })
  assert.equal(r.allumer, false)
  assert.equal(r.motif, null)
  assert.equal(r.refus, false)
})

test('une couche DÉJÀ allumée ne se rallume pas', () => {
  // Sinon `setCouche` serait rappelé à chaque image de la lecture temporelle,
  // et chaque appel reconstruit la mosaïque.
  const r = allumageAutoNuit({ ...base, active: true, nuit: true, lecture: true })
  assert.equal(r.allumer, false)
  assert.equal(r.motif, null)
})

test('⚠️ ÉTEINTE À LA MAIN, LA NUIT NE LA RALLUME PAS SOUS LE DOIGT', () => {
  const r = allumageAutoNuit({ ...base, nuit: true, eteinteAlaMain: true })
  assert.equal(r.allumer, false)
  assert.equal(r.motif, null)
  assert.equal(r.refus, false) // ce n'est pas un refus du Gardien : c'est un choix
})

test('⚠️ ÉTEINTE À LA MAIN, LA LECTURE NON PLUS NE LA RALLUME PAS', () => {
  // Le cas le plus douloureux : on lance le cycle, on éteint la couche parce
  // qu'elle gêne, et le prochain crépuscule la rallume. Le veto tient donc
  // aussi contre le déclencheur de lecture.
  const r = allumageAutoNuit({ ...base, lecture: true, eteinteAlaMain: true })
  assert.equal(r.allumer, false)
})

test('le Gardien refuse : on n’allume pas, ET ON LE DIT', () => {
  const r = allumageAutoNuit({ ...base, nuit: true, verdict: NON })
  assert.equal(r.allumer, false)
  assert.equal(r.refus, true)
  assert.equal(r.motif, MOTIF_NUIT) // le motif reste, pour pouvoir écrire « la nuit tombe, mais… »
})

test('un « oui mais » du Gardien allume quand même', () => {
  // OUI_MAIS est un avertissement, pas un refus — c'est aussi ce que rend le
  // Gardien DÉSARMÉ (?gardien=0), et désarmer doit laisser passer.
  const r = allumageAutoNuit({ ...base, nuit: true, verdict: OUI_MAIS })
  assert.equal(r.allumer, true)
  assert.equal(r.refus, false)
})

test('le refus ne se déclenche pas quand aucun déclencheur n’est armé', () => {
  // Un budget plein en plein jour ne doit pas fabriquer un message d'erreur.
  const r = allumageAutoNuit({ ...base, verdict: NON })
  assert.equal(r.allumer, false)
  assert.equal(r.refus, false)
})

test('un verdict absent ne bloque pas — pas d’information, pas de refus', () => {
  // La règle de la maison (palier-machine, gardien) : refuser sur une absence
  // d'information punirait les cas dont on ne sait rien.
  const r = allumageAutoNuit({ active: false, nuit: true })
  assert.equal(r.allumer, true)
})
