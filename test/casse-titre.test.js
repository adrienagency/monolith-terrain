import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casseDeNom } from '../src/casse-titre.js'

test('un titre tout en capitales redevient un nom propre', () => {
  assert.equal(casseDeNom('GRAND RAID REUNION 2025 - DIAGONALE DES FOUS 2025'),
               'Grand Raid Reunion 2025 - Diagonale des Fous 2025')
})

test('les petits mots restent en minuscules, SAUF en tete', () => {
  assert.equal(casseDeNom('LES 100 KM DE MILLAU'), 'Les 100 km de Millau')
})

// ⚠️ « bout » N'EST PAS UN MOT MINEUR — retiré en relecture. Il l'avait
// rejoint pour faire passer « de bout en bout » (cas de test abandonné : les
// deux exigences du plan — dernier mot jamais forcé, ET bout toujours en
// minuscule — étaient incompatibles avec un titre où bout n'est PAS en
// dernière position). Le garder en mot mineur avait un coût réel, trouvé en
// relecture : sur un toponyme comme « bout du monde », il aurait cassé
// l'harmonie avec le nom propre voisin.
test('bout est un nom commun ordinaire, pas un mot mineur', () => {
  assert.equal(casseDeNom('TRAIL DU BOUT DU MONDE'), 'Trail du Bout du Monde')
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

// ⚠️ L'APOSTROPHE EST LE MÊME PIÈGE QUE LE TIRET, sur le caractère d'à côté.
// Un segment de tête comme « L'ULTRA » ne matchait jamais le filtre
// lettres-seules (apostrophe non reconnue) et ressortait taché de
// majuscules (« L'ULTRA-Trail »). « L'Ultra-Trail », « L'Échappée Belle »
// sont des noms de course parfaitement plausibles.
test('un mot avec elision se compose SEGMENT PAR SEGMENT, comme un trait d union', () => {
  assert.equal(casseDeNom("L'ULTRA-TRAIL DU MONT-BLANC"), "L'Ultra-Trail du Mont-Blanc")
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
