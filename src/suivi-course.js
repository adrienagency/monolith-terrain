// La garde d'engagement du suivi, extraite pour être testable. Elle vivait en
// ligne dans engageGpxFollow, donc personne ne pouvait vérifier qu'elle laisse
// bien repasser une SECONDE lecture — le bug qu'Adrien a vu.
export function peutEngagerLeSuivi(etat) {
  if (!etat) return false
  return !!etat.suiviDemande && !!etat.enLecture && etat.mode === 'surface'
}

// LE RÉARMEMENT DU SUIVI SUR UNE RELANCE DEPUIS LE DÉBUT.
//
// LA CAUSE MESURÉE (voir task-2-report.md, étape 1) : ce n'est PAS la garde
// ci-dessus qui est en cause — gpxLayer.isPlaying() redevient bien true et
// modes.mode reste 'surface' après un clic sur Lecture. C'est le troisième
// verrou, params.gpxFollow, qui reste bloqué à false : le "FINALE" de
// main.js (recul isométrique en fin de parcours) l'éteint DÉLIBÉRÉMENT dès
// que headT >= 0.999 sur un parcours qui a des points de passage — pour ne
// pas lutter avec le zoom-out — mais rien ne le rallume ensuite. Mesuré au
// navigateur : après une relance, playing=true (la lecture repart bien) mais
// drone=false / pilote=false / gpxFollow=false pour le reste de la session,
// quel que soit le nombre de clics sur Lecture.
//
// ⚠️ CORRECTIF DE RELECTURE (task-2 report, addenda) — `gpxFollow` À LUI SEUL
// NE SUFFIT PAS. Scénario qui cassait la première version : l'utilisateur
// clique « ✕ Quitter le suivi » (route-panel.js) PENDANT la lecture — refus
// EXPLICITE — puis laisse le parcours se terminer tout seul. gpx.js `tick()`
// auto-pause en fin de lecture SANS remettre headT à 0 (contrairement à
// `stop()`, qui le fait) : au clic Lecture suivant, la relance repart bien du
// début (headT valait 1), et l'ancienne version réarmait le suivi À TORT,
// écrasant le refus explicite de l'utilisateur. Il faut donc savoir POURQUOI
// gpxFollow est à false, pas seulement QU'IL l'est — d'où `coupeParFinale` :
// vrai seulement quand c'est le FINALE (et lui seul) qui a fait le passage
// true→false ; toute coupure explicite (bouton Quitter, case à cocher) le
// remet à false, et le réarmement ne se déclenche alors plus jamais.
//
// La règle : une pression sur Lecture qui repart DU TOUT DÉBUT (même test
// que gpx.js applique lui-même dans play() pour savoir s'il remet headT à
// 0 : `headT >= 1` — voir gpx-layers.js) réarme le suivi UNIQUEMENT si la
// coupure venait du FINALE. Une simple REPRISE en cours de course, ou une
// relance après un refus explicite, ne le doit pas — sinon Lecture
// écraserait un choix que l'utilisateur vient de faire.
export function doitReamorcerSuivi(etat) {
  if (!etat) return false
  return !!(etat.relanceDepuisLeDebut && !etat.gpxFollow && etat.coupeParFinale)
}
