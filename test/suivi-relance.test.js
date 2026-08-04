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
// remettre headT a 0 : `headT >= 1` — capture par gpx-layers.js) reamorce le
// suivi SI ET SEULEMENT SI c'est le FINALE qui l'a coupe (coupeParFinale).
test('le suivi se reamorce sur une relance depuis le debut (le bug d Adrien)', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: false, coupeParFinale: true }), true)
})

test('le suivi ne se reamorce PAS sur une simple reprise en cours de course', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: false, gpxFollow: false, coupeParFinale: true }), false)
})

test('rien a reamorcer si le suivi est deja actif', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: true, coupeParFinale: true }), false)
})

test('doitReamorcerSuivi : cas degeneres, jamais de plantage', () => {
  assert.equal(doitReamorcerSuivi(undefined), false)
  assert.equal(doitReamorcerSuivi({}), false)
})

// ------------------------------------------- CONSTAT 1 (relecture) ---------
// Ce que la premiere version ratait : gpxFollow=false a lui seul ne dit RIEN
// sur le POURQUOI. Scenario qui casse sans coupeParFinale : l'utilisateur
// clique « Quitter le suivi » (route-panel.js) PENDANT la lecture — refus
// EXPLICITE, gpxFollow -> false — puis laisse le parcours se terminer tout
// seul. gpx.js tick() auto-pause en fin de lecture SANS remettre headT a 0
// (contrairement a stop(), qui le fait) : au clic Lecture suivant, headT
// valait encore 1, donc relanceDepuisLeDebut=true — et l'ancienne version
// (sans coupeParFinale) reamorcait le suivi a tort, ecrasant le refus de
// l'utilisateur. Avec coupeParFinale=false (coupure explicite, pas le
// FINALE), le suivi doit rester coupe.
test('CONSTAT 1 : Quitter le suivi puis laisser le parcours finir tout seul ne doit PAS se rearmer a la relance', () => {
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: false, coupeParFinale: false }), false)
})

test('CONSTAT 1 : seul le FINALE (coupeParFinale=true) autorise le rearmement, jamais une coupure explicite', () => {
  // meme relance depuis le debut, meme gpxFollow=false — seule la CAUSE change
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: false, coupeParFinale: true }), true)
  assert.equal(doitReamorcerSuivi({ relanceDepuisLeDebut: true, gpxFollow: false, coupeParFinale: false }), false)
})
