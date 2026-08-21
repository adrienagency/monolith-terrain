// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  // v39: back on — the wave engine is now the shared "ocean-waves" random
  // spectrum (ocean-lab repo), with a Sea toggle in the Effects panel, OFF by
  // default (params.waterReal). The rejected v37 Beaufort system is replaced.
  water: true,

  // FENÊTRE CONTINUE 3×3 — jalon 1, le plus petit drag qui marche.
  //
  // OFF par défaut, et ce n'est pas une précaution : à ce jalon le mode est
  // volontairement MISÉRABLE — pas d'analyse de relief, pas de masque de mer,
  // pas de trait de côte, aucun calque. Le terrain est peint à la rampe
  // d'altitude nue. Il sert à répondre à UNE question, celle du §7 de l'étude
  // 3×3 : le geste vaut-il le coup ? Rien d'autre.
  //
  // ⚠️ Il charge NEUF MNT au lieu d'un : le premier affichage est nettement
  // plus long. C'est attendu à ce jalon, pas une régression à corriger ici
  // (étude §7, signal 3).
  //
  // S'essaie par l'adresse sans rien reconstruire : `?f3=1`. Et `?f3=0` le
  // coupe, pour le jour où le défaut passera à true.
  fenetreContinue: false,

  // LE SUIVI DU TRACÉ PEUT LANCER LA POURSUITE HÉLICOPTÈRE.
  //
  // Adrien : « Quand on lance le suivi du tracé, tu peux lancer la vue d'hélico,
  // remplacer celle actuelle de suivi tout en la laissant de côté. »
  //
  // ⚠️ L'ANCIEN SUIVI N'EST PAS RETIRÉ. DroneCam (src/drone-cam.js), son pavé de
  // suivi, sa branche dans updateCameraMotion() et son bouton « Quitter le
  // suivi » restent en place, intacts et joignables. Ce drapeau ne fait que
  // choisir lequel des deux `engageGpxFollow()` engage.
  //
  // ⚠️ FALSE SUR MAIN, ET C'EST DÉLIBÉRÉ. Le code de la poursuite atterrit ici
  // pour ne plus vivre sur une branche, mais Adrien avait cadré l'échange des
  // deux vues comme un ESSAI (« on teste juste ça, ne push pas »). Le
  // comportement en ligne reste donc l'ancien rail tant qu'il n'a pas tranché.
  // `?suivi=helico` essaie le nouveau sans toucher au code ; passer cette
  // ligne à `true` le rend définitif.
  suiviHelico: false,

  // LE GLOBE CONTINU — le tri spatial du quadtree (plan « globe continu »,
  // Tâche 4). OFF par défaut, et ce n'est pas une précaution de style : les
  // trois corrections qu'il ouvre (horizon géométrique, frustum, crédit)
  // changent l'emprise parcourue par `_traverse` d'un ordre de grandeur, donc
  // le trafic et le contenu de l'écran. Elles atterrissent dans le dépôt
  // derrière ce drapeau le temps que le bloc quadtree (4 quater, 4 alpha) soit
  // complet.
  //
  // ⚠️ `src/globe.js` N'IMPORTE PAS CE FICHIER — délibérément. Le lecteur est
  // `src/main.js`, qui construit le globe et lui passe un simple booléen
  // (`params.globeContinu`). Un drapeau posé ici sans ce câblage ne
  // protégerait rien.
  //
  // S'essaie par l'adresse sans rien reconstruire : `?globe=continu`. Et
  // `?globe=crans` le coupe, pour le jour où le défaut passera à true.
  globeContinu: false,

  // L'EXAGÉRATION VERTICALE CONTINUE — décision 14, Tâche 6 bis.
  //
  // ⚠️ OFF, et **une mesure à l'écran le justifie** : voir `exagContinueActive()`
  // plus bas, qui porte le tableau des deux descentes Z12 → Z4. En deux mots :
  // la calibration actuelle supprime bien le cran (×2,0000 → ×1) mais **aplatit
  // la table d'Adrien à ×2,8 partout**, parce que le pilote est la grandeur que
  // `_rescale` conserve d'un cran à l'autre. `?exag=continu` pour la revoir.
  exagContinue: false,
}

// Le drapeau ci-dessus, avec l'échappatoire d'adresse — même patron que
// `suiviHelicoActif`. Isolé dans une fonction parce que `location` n'existe pas
// sous node.
export function globeContinuActif() {
  const v = paramAdresse('globe')
  if (v === 'crans' || v === '0') return false
  if (v === 'continu' || v === '1') return true
  return FLAGS.globeContinu
}

// L'EXAGÉRATION VERTICALE CONTINUE — décision 14, Tâche 6 bis.
//
// ⚠️ **SON PROPRE DRAPEAU, ET CE N'EST PAS DE LA PRUDENCE DE STYLE : C'EST UNE
// MESURE À L'ÉCRAN QUI L'A EXIGÉ.** Le régime continu était d'abord adossé à
// `globeContinu`. Descente Z12 → Z4 sur la Réunion, les deux chemins mesurés le
// même soir, valeur lue dans le cartouche « Relief » :
//
//   | zoom | production (`?globe=crans`) | régime continu, calibré au cadrage |
//   |------|------------------------------|------------------------------------|
//   | Z12  | ×2,8                         | ×2,8                               |
//   | Z8   | ×2,8                         | ×2,8                               |
//   | Z7   | **×3,2**                     | ×2,8                               |
//   | Z6   | **×4**                       | ×2,8                               |
//   | Z5   | **×5**                       | ×2,8                               |
//   | Z4   | **×2,5**                     | ×2,8                               |
//
// **Le cran disparaît — et la table d'Adrien avec lui.** Le pilote (la largeur
// de sol visible) est la grandeur même que `_rescale` CONSERVE d'un cran à
// l'autre depuis la Tâche 2 bis : toute exagération qui en dépend est donc
// continue **et constante**. C'est un POINT FIXE, la famille de défauts que le
// §2 de `/threejs-optimisation` décrit — il ne diverge pas, il gèle.
//
// Tant que le pilote n'est pas repris (piste écrite dans le plan : la fraction
// de trajet entre deux crans, bornée à `[z, z+1]` par construction, qui ne peut
// pas geler), `?globe=continu` garde les paliers d'aujourd'hui. `?exag=continu`
// rejoue le régime mesuré ci-dessus pour qui veut le voir de ses yeux.
export function exagContinueActive() {
  const v = paramAdresse('exag')
  if (v === 'paliers' || v === '0') return false
  if (v === 'continu' || v === '1') return true
  return FLAGS.exagContinue
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
