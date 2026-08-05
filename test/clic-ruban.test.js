import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doitReprendreLaLecture, survolVientDeLaSouris } from '../src/clic-ruban.js'

// ------------------------------------------------------- survolVientDeLaSouris
// La formule posée dans GpxLayer.setHover : hoverIdx a deux ecrivains (le
// picking souris ET la tete de lecture qui le reecrit chaque image), et seul
// le premier doit affirmer "la souris est sur le trace".
test('un survol souris reel (picking 3D ou profil) est bien identifie comme tel', () => {
  assert.equal(survolVientDeLaSouris(false, 12), true)
})

test('la tete de lecture ne compte JAMAIS comme un survol souris, meme sur un index valide', () => {
  assert.equal(survolVientDeLaSouris(true, 12), false)
})

test('un hoverIdx efface (-1) n est jamais un survol souris, meme hors lecture', () => {
  assert.equal(survolVientDeLaSouris(false, -1), false)
})

// ------------------------------------------------------- doitReprendreLaLecture
// LE TEST DE NON-REGRESSION DE LA RELECTURE FINALE : en lecture, un clic loin
// du ruban doit PLONGER, pas reprendre la lecture. Avant le correctif, la
// garde de main.js ne lisait que `hoverIdx >= 0` — qui restait vrai en
// permanence pendant la lecture (ecrit par la tete a chaque image), donc
// CHAQUE clic pendant la lecture etait pris pour un clic "sur le ruban".
test('EN LECTURE, UN CLIC HORS DU RUBAN PLONGE (ne reprend pas la lecture)', () => {
  // etat exact pendant la lecture : hoverIdx pointe l'index de la tete
  // (donc >= 0), mais le dernier ecrivain est la tete, pas la souris —
  // survolSouris est donc faux, meme si la souris est ailleurs sur l'ecran.
  const enLecture = { survolSouris: false, hoverIdx: 37, totKm: 12.4 }
  assert.equal(doitReprendreLaLecture(enLecture), false)
})

test('en lecture, un clic REELLEMENT sur le ruban (survol souris a jour) reprend la lecture', () => {
  // la souris a suivi le pointermove APRES le dernier tick de lecture : le
  // picking 3D a reecrit hoverIdx en dernier, survolSouris repasse a vrai.
  const clicSurLeRuban = { survolSouris: true, hoverIdx: 37, totKm: 12.4 }
  assert.equal(doitReprendreLaLecture(clicSurLeRuban), true)
})

test('APRES PAUSE, un clic loin du trace ne relance pas la lecture', () => {
  // pause() ne remet pas hoverIdx a -1 (il reste a l'index de la tete, pour
  // garder le reticule visible) mais le dernier ecrivain reste la tete tant
  // qu'aucun mouvement de souris n'a retraverse le canevas : survolSouris
  // reste faux.
  const apresPauseSansSouris = { survolSouris: false, hoverIdx: 37, totKm: 12.4 }
  assert.equal(doitReprendreLaLecture(apresPauseSansSouris), false)
})

test('hors lecture, un survol souris normal du ruban reprend toujours (comportement inchange)', () => {
  const survolNormal = { survolSouris: true, hoverIdx: 0, totKm: 12.4 }
  assert.equal(doitReprendreLaLecture(survolNormal), true)
})

test('aucun index de survol (-1) : jamais de reprise, meme avec survolSouris a vrai', () => {
  assert.equal(doitReprendreLaLecture({ survolSouris: true, hoverIdx: -1, totKm: 12.4 }), false)
})

test('un trace de longueur nulle (totKm <= 0) : jamais de reprise, division par zero evitee', () => {
  assert.equal(doitReprendreLaLecture({ survolSouris: true, hoverIdx: 0, totKm: 0 }), false)
  assert.equal(doitReprendreLaLecture({ survolSouris: true, hoverIdx: 0, totKm: NaN }), false)
})

test('cas degeneres : jamais de plantage', () => {
  assert.equal(doitReprendreLaLecture(undefined), false)
  assert.equal(doitReprendreLaLecture({}), false)
})
