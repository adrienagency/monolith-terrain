import { test } from 'node:test'
import assert from 'node:assert/strict'
import { peutEngagerLeSuivi, doitReamorcerSuivi } from '../src/suivi-course.js'

// ---------------------------------------------------------------- la garde --
// Extraction de la garde en ligne d'engageGpxFollow(). Utile pour couvrir les
// cas degeneres et documenter le contrat, MAIS NE CAPTURE PAS LA REGRESSION
// D'ADRIEN A ELLE SEULE : le module existant suffit a la faire passer, quel
// que soit l'etat reel de params.gpxFollow apres une lecture terminee. Voir
// doitReamorcerSuivi ci-dessous pour le vrai test de non-regression.
test('LE SUIVI REPART APRES UNE LECTURE TERMINEE', () => {
  // l'etat exact releve a l'etape 1 : la lecture vient d'etre relancee
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: true, mode: 'surface' }), true)
})

test('le suivi ne s engage pas sans lecture, ni hors mode surface', () => {
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: false, mode: 'surface' }), false)
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: true, mode: 'globe' }), false)
  assert.equal(peutEngagerLeSuivi({ suiviDemande: false, enLecture: true, mode: 'surface' }), false)
})

test('cas degeneres : jamais de plantage', () => {
  assert.equal(peutEngagerLeSuivi(undefined), false)
  assert.equal(peutEngagerLeSuivi({}), false)
})

// -------------------------------------------------------- le rearmement ----
// LA VRAIE CAUSE, MESUREE AU NAVIGATEUR (etape 1) : le "FINALE" de main.js
// (recul isometrique en fin de parcours) coupe params.gpxFollow des que
// headT >= 0.999 sur un parcours qui a des points de passage — et RIEN ne le
// rallume ensuite. Un simple clic sur Lecture relance bien gpxLayer (playing
// repasse a true, headT redescend a 0) mais engageGpxFollow() sort a son tout
// premier `if (!params.gpxFollow ...)` : le suivi reste coupe pour le reste
// de la session, mesure confirmee : apres relance, playing=true / drone=false
// / pilote=false / gpxFollow=false.
//
// La regle : une PRESSION EXPLICITE sur Lecture qui repart DU DEBUT (c'est le
// meme test que gpx.js applique lui-meme dans play() pour decider s'il faut
// remettre headT a 0 : `headT >= 1` — capture par GpxLayerManager en tant que
// `lastPlayRestarted`, voir gpx-layers.js) doit reamorcer le suivi. Une
// simple REPRISE en cours de course (pause volontaire, suivi deja coupe a la
// main par la case a cocher du panneau Parcours) ne le doit pas — sinon
// Lecture ecraserait un choix que l'utilisateur vient de faire.
test('le suivi se reamorce sur une relance depuis le debut (le bug d Adrien)', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: false }), true)
})

test('le suivi ne se reamorce PAS sur une simple reprise en cours de course', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: false, gpxFollow: false }), false)
})

test('rien a reamorcer si le suivi est deja actif', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: true }), false)
})

test('doitReamorcerSuivi : cas degeneres, jamais de plantage', () => {
  assert.equal(doitReamorcerSuivi(undefined), false)
  assert.equal(doitReamorcerSuivi({}), false)
})
