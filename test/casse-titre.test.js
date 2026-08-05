import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casseDeNom } from '../src/casse-titre.js'

test('un titre tout en capitales redevient un nom propre', () => {
  assert.equal(casseDeNom('GRAND RAID REUNION 2025 - DIAGONALE DES FOUS 2025'),
               'Grand Raid Reunion 2025 - Diagonale des Fous 2025')
})

test('les petits mots restent en minuscules, SAUF en tete', () => {
  assert.equal(casseDeNom('LES 100 KM DE MILLAU'), 'Les 100 km de Millau')
  // ⚠️ SEUL LE PREMIER MOT DU TITRE EST FORCÉ EN CAPITALE — pas le dernier.
  // Capitaliser le dernier mot d'une locution est une convention anglophone
  // (title case) ; la composition française capitalise le premier mot et les
  // mots qui nomment quelque chose, rien de plus. « bout » reste en
  // minuscule aux DEUX occurrences (tranché en relecture) : dans « de bout
  // en bout », il ne nomme rien, comme les prépositions qui l'entourent.
  assert.equal(casseDeNom('DE BOUT EN BOUT'), 'De bout en bout')
})

test('les sigles gardent leurs capitales', () => {
  assert.equal(casseDeNom('UTMB 2026'), 'UTMB 2026')
  assert.equal(casseDeNom('GR20 INTEGRALE'), 'GR20 Integrale')
})

test('un titre deja bien casse n est pas abime', () => {
  assert.equal(casseDeNom('Marathon du Mont-Blanc'), 'Marathon du Mont-Blanc')
})

test('cas degeneres', () => {
  assert.equal(casseDeNom(''), '')
  assert.equal(casseDeNom(null), '')
})

// ⚠️ CONSTAT DE RELECTURE (2026-08-05) : le filtre qui décide « ce mot est-il
// entièrement en capitales ? » ignorait le trait d'union. Un mot composé
// comme « MONT-BLANC » ne matchait jamais l'ancien filtre lettres-seules —
// il tombait dans la branche « déjà composé, intact » et ressortait taché
// de majuscules (« du MONT-BLANC »). Or « Mont-Blanc » et « Ultra-Trail »
// sont parmi les motifs les plus fréquents des noms de course français.
test('un mot a trait d union se compose SEGMENT PAR SEGMENT', () => {
  assert.equal(casseDeNom('MARATHON DU MONT-BLANC'), 'Marathon du Mont-Blanc')
  assert.equal(casseDeNom('ULTRA-TRAIL DU MONT-BLANC'), 'Ultra-Trail du Mont-Blanc')
})

// ⚠️ « KM » N'EST JAMAIS CAPITALISÉ, MÊME EN BORDURE DE TITRE — parce que
// c'est une UNITÉ, pas parce qu'il occupe telle ou telle position. La
// première version le faisait dépendre de la règle de bordure (mot mineur
// + dernier mot du titre forcé en capitale) : elle rendait « TRAIL DES 100
// KM » → « Trail des 100 Km », une unité de mesure capitalisée, ce qui n'est
// jamais correct.
test('une unite de mesure reste en minuscules, meme en derniere position', () => {
  assert.equal(casseDeNom('TRAIL DES 100 KM'), 'Trail des 100 km')
})
