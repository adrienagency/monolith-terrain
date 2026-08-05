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
  // l'apostrophe COURBE (celle qu'un correcteur de saisie substitue à la
  // droite) doit scinder de la même façon, et être rendue TELLE QUELLE —
  // on ne force pas une apostrophe sur l'autre
  assert.equal(casseDeNom('L’ULTRA-TRAIL DU MONT-BLANC'), 'L’Ultra-Trail du Mont-Blanc')
})

// ⚠️ TOUTES LES APOSTROPHES NE COUPENT PAS UN MOT. La correction ci-dessus
// traitait l'apostrophe comme un séparateur UNIVERSEL — et « aujourd'hui »,
// « quelqu'un », « presqu'île » (des mots réels, plausibles dans un nom de
// course) en ressortaient mal composés (« Aujourd'Hui », un H majuscule
// fautif) : PIRE que le bug d'origine, parce que silencieux — le mot n'a
// plus l'air suspect. La règle : on ne recommence un mot après l'apostrophe
// QUE si ce qui précède se réduit à UNE SEULE LETTRE (la définition même de
// l'élision — l', d', j', n', s', c', m', t'). Au-delà, l'apostrophe est
// INTERNE au mot, qui se compose comme un bloc.
test('l apostrophe ne recommence un mot que si l elision fait une seule lettre', () => {
  assert.equal(casseDeNom("AUJOURD'HUI"), "Aujourd'hui")
  assert.equal(casseDeNom("QUELQU'UN"), "Quelqu'un")
  assert.equal(casseDeNom("LA PRESQU'ILE SAUVAGE"), "La Presqu'ile Sauvage")
})

// ⚠️ CONSTAT DE RELECTURE (2026-08-05, 4e tour) : LE COMMENTAIRE ET LE CODE
// SE CONTREDISAIENT. Le commentaire de composerAvecElisions() définit
// l'élision comme HUIT lettres (l' d' j' n' s' c' m' t'), et la scission
// (préfixe d'une seule lettre) les traite bien génériquement — mais
// MOTS_MINEURS n'en contenait que deux (d, l). Une élision d'une autre
// lettre, placée APRÈS le premier mot du titre, gardait donc à tort sa
// majuscule (« N'Attend » restait « N'Attend » au lieu de « n'Attend »).
// Chaque cas ci-dessous est une tournure qui existe réellement en français,
// plausible comme titre ou accroche de course — pas une phrase fabriquée
// pour l'occasion :
//   - d'/l' : déjà vérifiées ailleurs (mots-titres composés), reprises ici
//     en position NON initiale, celle que le défaut visait précisément ;
//   - j' : conjonction + pronom sujet élidé ;
//   - n' : négation ;
//   - s' : pronom réfléchi élidé devant un verbe qui commence par une voyelle ;
//   - c' : présentatif « c'est » ;
//   - m'/t' : pronom complément élidé — le clou du marketing course à pied
//     (« la course qui t'attend »).
// ⚠️ ET LE MOT QUI SUIT L'ÉLISION GARDE SA MAJUSCULE, MÊME LOIN DU DÉBUT DU
// TITRE — ce n'est PAS une régression, c'est la même règle que partout
// ailleurs dans ce fichier : casserSegment() capitalise tout mot qui n'est
// ni un mot mineur ni un sigle, sans distinguer verbe, nom ou adjectif
// (« RAID », « FOUS », « ATTEND » suivent tous le même chemin). C'est déjà
// ainsi que « L'Ultra-Trail » et « d'Automne » se composent : le préfixe
// d'élision est mineur, le mot qu'il introduit ne l'est pas.
test('les huit lettres d elision sont TOUTES des mots mineurs, pas seulement d et l', () => {
  assert.equal(casseDeNom("LA TRAVERSEE D'AUTOMNE"), "La Traversee d'Automne")
  assert.equal(casseDeNom("LA COURSE DE L'AUBE"), "La Course de l'Aube")
  assert.equal(casseDeNom("ET J'IRAI LOIN"), "Et j'Irai Loin")
  assert.equal(casseDeNom("LA COURSE QUI N'ATTEND PERSONNE"), "La Course Qui n'Attend Personne")
  assert.equal(casseDeNom("LA COURSE QUI S'ELANCE"), "La Course Qui s'Elance")
  assert.equal(casseDeNom("LA COURSE C'EST MAINTENANT"), "La Course c'Est Maintenant")
  assert.equal(casseDeNom("LA COURSE QUI M'ATTEND"), "La Course Qui m'Attend")
  assert.equal(casseDeNom("LA COURSE QUI T'ATTEND"), "La Course Qui t'Attend")
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
