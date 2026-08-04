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
// La règle : une pression sur Lecture qui repart DU TOUT DÉBUT (même test
// que gpx.js applique lui-même dans play() pour savoir s'il remet headT à
// 0 : `headT >= 1` — voir GpxLayerManager.lastPlayRestarted, gpx-layers.js)
// doit réarmer le suivi. Une simple REPRISE en cours de course (pause
// volontaire, suivi déjà coupé à la main par la case à cocher du panneau
// Parcours) ne le doit pas — sinon Lecture écraserait un choix que
// l'utilisateur vient de faire.
export function doitReamorcerSuivi(etat) {
  if (!etat) return false
  return !!(etat.relanceDepuisLeDebut && !etat.gpxFollow)
}
