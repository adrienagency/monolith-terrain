// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  // v39: back on — the wave engine is now the shared "ocean-waves" random
  // spectrum (ocean-lab repo), with a Sea toggle in the Effects panel, OFF by
  // default (params.waterReal). The rejected v37 Beaufort system is replaced.
  water: true,

  // ESSAI DU 2026-08-01 — LE SUIVI DU TRACÉ LANCE LA POURSUITE HÉLICOPTÈRE.
  //
  // Adrien : « Quand on lance le suivi du tracé, tu peux lancer la vue d'hélico,
  // remplacer celle actuelle de suivi tout en la laissant de côté. »
  //
  // ⚠️ L'ANCIEN SUIVI N'EST PAS RETIRÉ. DroneCam (src/drone-cam.js), son pavé de
  // suivi, sa branche dans updateCameraMotion() et son bouton « Quitter le
  // suivi » restent en place, intacts et joignables. Ce drapeau ne fait que
  // choisir lequel des deux `engageGpxFollow()` engage.
  //
  // POUR REVENIR EN ARRIÈRE, UNE SEULE LIGNE : mettre `suiviHelico: false`
  // ci-dessous. Et pour comparer les deux SANS toucher au code, l'adresse gagne
  // sur la constante : `?suivi=drone` rend l'ancien rail, `?suivi=helico` force
  // le nouveau.
  suiviHelico: true,
}

// Le drapeau ci-dessus, avec l'échappatoire d'adresse. Isolé dans une fonction
// parce que `location` n'existe pas sous node : les tests importent FLAGS sans
// jamais toucher à celle-ci.
export function suiviHelicoActif() {
  const v = paramAdresse('suivi')
  if (v === 'drone') return false
  if (v === 'helico') return true
  return FLAGS.suiviHelico
}

// QUEL TRONÇON LA POURSUITE COUVRE.
//
// ⚠️ CE N'EST PAS UN RÉGLAGE ESTHÉTIQUE, C'EST UNE LIMITE D'ÉCHANTILLONNAGE.
// Le tracé d'Interlaken fait 3 h 40 ; comprimé dans un clip de 70 s, ça fait
// 190×, et à cette vitesse l'axe de visée balaie une épingle à 202 °/s — près de
// trois fois le seuil de lisibilité (75 °/s), et aucun réglage de caméra n'y
// peut quoi que ce soit. Voir `troncoReine` dans src/poursuite.js. Le défaut
// montre donc LA MONTÉE REINE, celle qui accumule le plus de D+ par kilomètre.
//
// `?troncon=tout` rend le parcours entier (complet mais illisible, c'est le
// but : le voir de ses yeux). `?troncon=0.2-0.5` prend une fraction choisie.
export function portionPoursuite() {
  const v = paramAdresse('troncon')
  if (!v) return 'reine'
  if (v === 'tout' || v === 'all') return null
  const m = /^([0-9.]+)-([0-9.]+)$/.exec(v)
  if (m) {
    const a = Math.min(Math.max(parseFloat(m[1]), 0), 1)
    const b = Math.min(Math.max(parseFloat(m[2]), 0), 1)
    if (b > a) return [a, b]
  }
  return 'reine'
}

function paramAdresse(nom) {
  if (typeof location === 'undefined' || !location.search) return null
  return new URLSearchParams(location.search).get(nom)
}
