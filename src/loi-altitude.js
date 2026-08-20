// LA LOI D'ALTITUDE — l'instrument de la Tâche 1 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`, Tâche 1a).
//
// Module PUR : ni DOM, ni three.js, ni `document.createElement`. Tout se
// vérifie sous node (`test/camera-continue.test.js`). Même patron
// qu'`escalier-zoom.js` et `fenetre-finesse.js` : la RÈGLE vit ici, la
// plomberie reste dans `modes.js` et `main.js`.
//
// ══════════ CE QU'ON MESURE, ET POURQUOI CE N'EST PAS `surfaceCamAltMeters` ══
//
// La grandeur est **l'altitude GÉOMÉTRIQUE au-dessus de l'ellipsoïde, en
// mètres**, et elle doit être LA MÊME des deux côtés de la bascule de mode,
// sans quoi on compare deux repères :
//
//   · mode orbital  → `orbAlt × ORBITAL_M_PER_UNIT`      (modes.js, `update`)
//   · mode surface  → `camera.position.y / échelle du bloc`
//
// ⚠️ **SANS `dem.meanM`.** `surfaceCamAltMeters()` (`main.js:3594-3599`) ajoute
// `dem.meanM` à la seconde : la quantité obtenue est **dérivée du terrain
// chargé**, donc lissée, donc interdite par la règle R1 du plan — et la
// Tâche 1c ordonne précisément de l'en sortir. L'instrument prend l'altitude
// géométrique pure : il survit à cette correction au lieu d'être à refaire.
//
// ⚠️ CE MODULE NE CHANGE AUCUN COMPORTEMENT. Il extrait, à l'identique, des
// calculs qui vivaient en clair dans `modes.js`, `main.js` et `dem.js`. Toute
// divergence numérique est un bogue, pas une amélioration.

// ══════════ 1. LES CONSTANTES, ET LEUR SOURCE ═══════════════════════════════

// `156543,03392 × 256` = la circonférence équatoriale de la projection Web
// Mercator, en mètres. Le facteur vient tel quel de `dem.js:513` ; le `256`
// est la taille de tuile de référence de cette formule.
export const CIRCONFERENCE_M = 156543.03392 * 256

// Un bloc fait TROIS tuiles de côté (`loadDem({ tilesAcross = 3 })`,
// `dem.js:226`).
export const TUILES_PAR_BLOC = 3

// `controls.maxDistance` en mode surface — `main.js:3624`
// (`surfaceMaxDistance: () => 150`), et le repli `?? 150` de `modes.js`.
export const DISTANCE_MAX_SURFACE = 150

// `controls.minDistance` en mode surface — `modes.js` la pose à 6 dans `_dive`
// et dans `_loadDive`. ⚠️ CE N'EST PAS UN DÉTAIL DE CONFORT : c'est le PLANCHER
// sur lequel l'escalier continu vient s'écraser si le budget de niveau ne vaut
// pas exactement un cran. Mesuré à la Tâche 2 bis (2026-08-20) : à budget 1,2
// inchangé, la caméra continue s'y colle dès z8 et n'en repart plus. Gardé par
// une assertion de texte source dans `test/escalier-surface.test.js`.
export const DISTANCE_MIN_SURFACE = 6

// L'angle de vue isométrique de toute arrivée : `_ARRIVAL_DIR` de `modes.js`
// vaut `new THREE.Vector3(0, 18, 19).normalize()`.
export const PENTE_ARRIVEE = { y: 18, z: 19 }

// `_arrivalPose` (`modes.js`) se pose à `surfaceMaxDistance() × 0,94` — « stay
// under the hard cap so controls.update() doesn't immediately re-clamp it ».
export const FRAC_ARRIVEE = 0.94

// `_rescale` et `_loadDive` se posent au POINT DE PRÉSENTATION :
// `surfaceMaxDistance() × 0,97`, « la distance de la vue iso 1 » (v48).
export const FRAC_PRESENTATION = 0.97

// `_cibleVisee` (`modes.js`) vise toujours `y = -0,3`.
export const Y_CIBLE = -0.3

// `enterOrbit` (`modes.js`) ressort à `surfaceCamAltMeters() × 1,15`, borné.
export const FACTEUR_SORTIE_ORBITE = 1.15
export const ALT_SORTIE_MIN_M = 15000
export const ALT_SORTIE_MAX_M = 9000000

// ⚠️ RECOPIE D'UNE TABLE QUI VIT DANS `main.js` — et elle y est INACCESSIBLE :
// `ZOOM_EXAG_DEFAULTS` (`main.js:3124`) et `BASE_EXAG` (`main.js:3114`) ne sont
// pas exportés, et aucun test ne peut charger `main.js`. La recopie est donc
// gardée par une assertion de texte source dans `test/camera-continue.test.js`,
// qui échoue si la table de `main.js` bouge sans que celle-ci suive.
//
// L'exagération verticale N'EST PAS un ornement pour cette mesure : l'échelle
// du bloc en dépend, donc l'altitude en mètres aussi.
export const EXAG_PAR_ZOOM = { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 }
export const EXAG_BASE = 2.8
export const exagPourZoom = (z) => EXAG_PAR_ZOOM[z] ?? EXAG_BASE

// ══════════ 2. LES DEUX MOITIÉS DE LA LOI ═══════════════════════════════════

// Mode orbital : l'altitude EST la variable d'état, à un facteur d'échelle près.
// `modes.js` faisait ce produit en clair dans `update()`.
export function altitudeOrbitaleM(orbAlt, metresParUnite) {
  return orbAlt * metresParUnite
}

// L'échelle verticale du bloc — `main.js:3596` et `terrain.js:2136` la posent
// mot pour mot : `(span / dem.extentMeters) × params.demExaggeration`.
export function echelleBloc({ extentMeters, span, exageration }) {
  return (span / extentMeters) * exageration
}

// Mode surface : la hauteur de caméra rendue en mètres par l'échelle du bloc.
// ⚠️ GÉOMÉTRIQUE PURE — pas de `meanM` ici, voir l'en-tête.
export function altitudeSurfaceM({ camY, extentMeters, span, exageration }) {
  return camY / echelleBloc({ extentMeters, span, exageration })
}

// L'emprise au sol d'un bloc, en mètres — `dem.js:513-524`, où la taille de
// tuile se simplifie : `metersPerPixel × sizePx` vaut
// `tilesAcross × 256 × 156543,03392 × cos(lat) / 2^zoom` quelle que soit
// `TILE_PX` (512 chez Mapterhorn, 256 chez AWS).
export function empriseBlocM({ zoom, lat, tuilesParBloc = TUILES_PAR_BLOC }) {
  return (tuilesParBloc * CIRCONFERENCE_M * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

// La sortie d'orbite, telle que `enterOrbit` la calcule quand aucune altitude
// n'est imposée.
export function altitudeSortieOrbiteM(altSurfaceM) {
  const a = altSurfaceM * FACTEUR_SORTIE_ORBITE
  return Math.min(Math.max(a, ALT_SORTIE_MIN_M), ALT_SORTIE_MAX_M)
}

// ══════════ 3. LES DEUX POSES D'ARRIVÉE ═════════════════════════════════════
//
// Elles sont la moitié visible du problème : à chaque traversée d'étage, la
// caméra ne poursuit pas son mouvement, elle est REPOSÉE.

export const distanceArrivee = (distanceMax = DISTANCE_MAX_SURFACE) => distanceMax * FRAC_ARRIVEE
export const distancePresentation = (distanceMax = DISTANCE_MAX_SURFACE) => distanceMax * FRAC_PRESENTATION

// LA PENTE DE LA DIRECTION D'ARRIVÉE — le `y` de `_ARRIVAL_DIR` normalisé.
// ⚠️ CE N'EST PAS TOUT À FAIT `poseArrivee().pente`, ET L'ÉCART EST DÉLIBÉRÉ.
// `_arrivalPose` pose une position ABSOLUE (`_ARRIVAL_DIR × dist`) alors que la
// cible est à `y = Y_CIBLE` : la direction cible→caméra n'est donc pas
// exactement `_ARRIVAL_DIR`, et sa pente vaut 0,688 94 au lieu de 0,687 747 —
// 0,17 % d'écart. La plongée continue de la Tâche 1b pose, elle, RELATIVEMENT à
// la cible (comme `_rescale` le fait déjà depuis la Tâche 2 bis), donc sa pente
// est celle de `_ARRIVAL_DIR`, exactement, et elle ne dépend plus de la
// distance. C'est ce qui permet d'INVERSER la relation altitude → distance.
export const PENTE_ARRIVEE_Y = PENTE_ARRIVEE.y / Math.hypot(PENTE_ARRIVEE.y, PENTE_ARRIVEE.z)

// `_arrivalPose` : `pos = _ARRIVAL_DIR × dist` — une position ABSOLUE, pas un
// décalage depuis la cible. La cible, elle, est à `y = Y_CIBLE`. On rend donc
// aussi la direction cible→caméra, parce que c'est ELLE que `_rescale`
// réutilise ensuite (`prevDir`).
export function poseArrivee(distanceMax = DISTANCE_MAX_SURFACE) {
  const d = distanceArrivee(distanceMax)
  const norme = Math.hypot(PENTE_ARRIVEE.y, PENTE_ARRIVEE.z)
  const camY = (d * PENTE_ARRIVEE.y) / norme
  const camZ = (d * PENTE_ARRIVEE.z) / norme
  const dy = camY - Y_CIBLE
  const distanceCible = Math.hypot(dy, camZ)
  return { camY, distanceCible, pente: dy / distanceCible }
}

// `_rescale` : `pos = target + prevDir × (maxDistance × 0,97)`, la cible restant
// à `y = Y_CIBLE`. `pente` est le `y` normalisé de `prevDir`.
export function posePresentation(pente, distanceMax = DISTANCE_MAX_SURFACE) {
  const distanceCible = distancePresentation(distanceMax)
  return { camY: Y_CIBLE + distanceCible * pente, distanceCible, pente }
}

// ══════════ 3 bis. LE CRAN CONTINU — LA POSE QUI REMPLACE LA TÉLÉPORTATION ══
//
// ✅ Décision d'Adrien du 2026-08-20 : « on garde bien un zoom continu,
// exactement comme Google Earth ou Google Maps ». La téléportation au point de
// présentation (v48, `posePresentation` ci-dessus) disparaît de `_rescale`.
//
// LE GESTE : conserver l'altitude MÉTRIQUE de part et d'autre du cran. Or
// l'altitude métrique vaut `camY / échelle du bloc`, et l'échelle change à
// CHAQUE cran pour DEUX raisons cumulées :
//   · l'emprise du bloc est divisée par deux d'un zoom au suivant ;
//   · l'exagération verticale change de palier (5 à z5, 4 à z6, 3,2 à z7,
//     2,8 ensuite — `EXAG_PAR_ZOOM`).
// ⚠️ **C'EST LE PIÈGE.** Ne prendre que l'emprise donne un facteur 2 constant
// et laisse trois crans discontinus (z5→z6, z6→z7, z7→z8). On passe donc le
// RAPPORT DES DEUX ÉCHELLES, lu sur le bloc réel des deux côtés.
//
// La moitié de v48 qui était BONNE survit : l'angle de vue de l'utilisateur est
// gardé — `pente` est le `y` normalisé de la direction cible→caméra d'avant le
// cran, et c'est le seul terme qui traverse.
//
// ⚠️ `modes.js` appelle CETTE fonction — ce n'est pas une recopie. Le test de la
// Tâche 2 bis vérifie le lien : si `_rescale` se remet à calculer sa pose
// lui-même, l'assertion tombe.
export function poseCranContinu({ camY, pente, facteurEchelle, yCible = Y_CIBLE }) {
  const camYApres = camY * facteurEchelle
  return { camY: camYApres, distanceCible: (camYApres - yCible) / pente, pente }
}

// ══════════ 3 ter. LA PLONGÉE CONTINUE — Tâche 1b ═══════════════════════════
//
// ⚠️ CE QUE CETTE SECTION SUPPRIME, ET CE QU'ELLE NE SUPPRIME PAS.
//
// `_dive` posait la caméra à une distance FIXE — `distanceArrivee(150)` = 141
// unités — quelle que soit l'altitude quittée en orbite. Mesuré à la Tâche 1a :
// 1 600,0 km → 906,6 km d'une image à l'autre (÷1,765). C'était le dernier des
// onze sauts du profil de descente.
//
// LE GESTE EST CELUI DE LA TÂCHE 2 bis, TRANSPOSÉ : au lieu de poser la caméra
// et de subir l'altitude qui en résulte, on part de l'ALTITUDE et on en déduit
// la distance. Deux inconnues au lieu d'une, parce que la plongée choisit AUSSI
// son niveau de zoom : `niveauDePlongee` les résout ensemble.
//
// ⚠️ CE QU'IL RESTE APRÈS, ET IL EST MESURÉ (voir le §6 du plan, Tâche 1b) :
// le CHAMP VISUEL, lui, saute encore d'un facteur `exagération(z)`. La raison
// est arithmétique et elle tient en une ligne : la grandeur que la Tâche 1a a
// nommée « altitude » divise `camY` par une échelle qui porte l'exagération
// VERTICALE, alors que la largeur de sol vue au travers du champ dépend de
// l'échelle HORIZONTALE, qui ne la porte pas. Conserver l'une fait varier
// l'autre de `exagération(z)`. Ce n'est PAS réparable ici : ou bien on retire
// l'exagération de l'altitude de cadrage — et les onze sauts mesurés à la
// Tâche 1a changent tous de valeur —, ou bien Adrien renonce aux paliers
// d'exagération. **C'est une question, pas un oubli.**

// La distance à la cible qui donne EXACTEMENT l'altitude `altM` sur un bloc
// d'échelle verticale `echelleV`, le long d'une direction de pente `pente`.
// C'est l'inverse de `altitudePourDistance` ci-dessous, et rien d'autre.
export function distancePourAltitude({ altM, echelleV, pente = PENTE_ARRIVEE_Y, yCible = Y_CIBLE }) {
  return (altM * echelleV - yCible) / pente
}

// … et le sens direct, celui que `profilDescente` rejoue le long du glissé.
export function altitudePourDistance({ distance, echelleV, pente = PENTE_ARRIVEE_Y, yCible = Y_CIBLE }) {
  return (yCible + distance * pente) / echelleV
}

/**
 * LE NIVEAU QUI ACCUEILLE UNE ALTITUDE SANS SAUT — et la distance qui va avec.
 *
 * `echelleAuZoom(z)` rend l'échelle verticale du bloc à ce zoom (unités de
 * scène par mètre) SANS l'avoir chargé : c'est le seul terme que ce module ne
 * peut pas calculer seul, parce que l'exagération vit dans `main.js`. Il est
 * donc INJECTÉ, comme `choisirPalier` l'était à la Tâche 1a.
 *
 * L'échelle CROÎT avec le zoom (l'emprise du bloc est divisée par deux d'un
 * cran au suivant), donc la distance croît elle aussi : on prend **le niveau le
 * plus FIN dont la distance tient encore sous le plafond d'arrivée**. C'est
 * celui qui montre le plus de détail sans reculer la caméra au-delà de sa
 * butée.
 *
 * ⚠️ DEUX BORNES, ET ELLES SONT DES SAUTS ASSUMÉS :
 *   · `borne: 'haut'` — aucun niveau ne tient : l'altitude est au-dessus du
 *     plafond du bloc le plus large. C'est la vraie porte orbitale, et elle est
 *     GÉOMÉTRIQUE (7 252 km au Mont-Blanc, 10 407 km à l'équateur) là où
 *     `DIVE_TIERS` la posait à 16 000 km à la main.
 *   · `borne: 'bas'` — le niveau le plus fin met la caméra sous le plancher.
 *     Inatteignable sur la descente de référence (la distance minimale mesurée
 *     y vaut 34,9 unités contre un plancher de 6), gardé parce qu'un zoom fin
 *     imposé par l'utilisateur peut l'atteindre.
 */
export function niveauDePlongee({
  altM,
  echelleAuZoom,
  zoomMin = 3,
  zoomMax = 15,
  pente = PENTE_ARRIVEE_Y,
  yCible = Y_CIBLE,
  distanceMin = DISTANCE_MIN_SURFACE,
  distanceMax = DISTANCE_MAX_SURFACE,
} = {}) {
  const plafond = distanceArrivee(distanceMax) // sous la butée dure, comme _arrivalPose
  let choisi = null
  for (let z = zoomMin; z <= zoomMax; z++) {
    const echelleV = echelleAuZoom(z)
    if (!(echelleV > 0)) continue
    const distanceCible = distancePourAltitude({ altM, echelleV, pente, yCible })
    if (distanceCible <= plafond) choisi = { zoom: z, distanceCible, echelleV, borne: null }
  }
  if (!choisi) {
    const echelleV = echelleAuZoom(zoomMin)
    return { zoom: zoomMin, distanceCible: plafond, echelleV, borne: 'haut' }
  }
  if (choisi.distanceCible < distanceMin) return { ...choisi, distanceCible: distanceMin, borne: 'bas' }
  return choisi
}

// ══════════ 3 quater. LES BUTÉES DE LA CAMÉRA — Tâche 1b, Étape 3 ═══════════
//
// ⚠️ `controls.minDistance` ÉTAIT ÉCRIT À QUATRE ENDROITS, avec deux valeurs
// littérales et une formule (`modes.js` ×3, `main.js` ×1). L'une des trois
// INTERDISAIT PHYSIQUEMENT « de l'orbite au sol » : en mode orbital le plancher
// valait `R_GLOBE + DIVE_ALT_M × 0,85 / ORBITAL_M_PER_UNIT`, c'est-à-dire la
// porte de plongée elle-même — la caméra ne pouvait pas descendre plus bas SANS
// changer de monde.
//
// ⚠️ ET IL Y AVAIT UN SECOND PLANCHER, QUE LE PLAN NE NOMMAIT PAS : le clamp de
// `orbAltTarget` dans `_zoomGesture` et `_orbitNotch`, à `DIVE_ALT_M × 0,9`
// (7 200 m). C'est LUI qui mord en premier — 0,9 > 0,85 — et le retirer sans
// lui n'aurait rien changé. On élargit une liste, on ne la remplace pas.
//
// Les deux valeurs qui restent ne sont pas la même grandeur et ne peuvent pas
// fusionner tant que les deux mondes sont distincts (voir l'Étape 2 du plan) :
// en surface, le plancher est une distance à la CIBLE sur un bloc de 56 unités ;
// en orbite, c'est une distance au CENTRE d'une sphère de rayon `R_GLOBE`. La
// dérivation commune est donc « rayon du sol + garde », et le seul chiffre qui
// change est le rayon du sol.
export const ALT_PLANCHER_ORBITALE_M = 0 // ⚠️ PLUS DE PORTE : la caméra descend jusqu'à la sphère

export function distanceMinOrbitale({ rayonGlobe, metresParUnite, altPlancherM = ALT_PLANCHER_ORBITALE_M }) {
  return rayonGlobe + altPlancherM / metresParUnite
}

// ══════════ 3 quinquies. LE PLAN DE COUPE PROCHE ════════════════════════════
//
// ⚠️ CE GESTE-CI ÉTAIT DÉJÀ CONTINU, ET LE PLAN LE COMPTAIT PARMI LES SAUTS.
// Rejoué contre le dépôt : `modes.js` pose `near = clamp(orbAlt × 0,2 ; 0,01 ;
// 0,5)` à chaque image en orbite, et repose `_surfCam.near = 0,5` en surface.
// Or en surface la caméra est à ~97 unités au-dessus du bloc : la MÊME formule
// y rend `clamp(19,4 ; 0,01 ; 0,5) = 0,5`, c'est-à-dire exactement la valeur
// reposée. **Les deux modes appliquaient déjà la même loi, l'un par formule et
// l'autre par constante.** Elle est écrite ici une fois, et les deux l'appellent.
export const NEAR_MIN = 0.01
export const NEAR_MAX = 0.5
export const NEAR_FRACTION = 0.2
export function planProche(hauteurAuDessusDuSol) {
  return Math.min(Math.max(hauteurAuDessusDuSol * NEAR_FRACTION, NEAR_MIN), NEAR_MAX)
}

// ══════════ 4. LE PROFIL DE DESCENTE ════════════════════════════════════════
//
// ⚠️ CE N'EST PAS UNE SIMULATION DE L'APPLICATION : c'est le REJEU de la loi
// d'altitude le long du trajet que l'escalier impose. Les segments continus
// (glissé orbital amorti, glissé inertiel de surface) sont échantillonnés assez
// finement pour qu'aucun pas ne puisse être pris pour un saut ; les traversées
// (`_dive`, `_rescale`) sont, elles, des pas d'UNE image.

// Échantillonnage géométrique de `a` vers `b`, sans jamais dépasser `ratioMax`
// d'un point au suivant. Bornes comprises.
export function echelonsGeometriques(a, b, ratioMax = 1.02) {
  if (!(a > 0) || !(b > 0)) return [a]
  const total = Math.abs(Math.log(b / a))
  const n = Math.max(1, Math.ceil(total / Math.log(ratioMax)))
  const pts = []
  for (let i = 0; i <= n; i++) pts.push(a * Math.exp((Math.log(b / a) * i) / n))
  return pts
}

/**
 * Rejoue l'altitude géométrique le long de la descente de référence.
 *
 * Le trajet, tel que `modes.js` le produit :
 *   1. glissé orbital continu de `altDepartM` à `altPlongeeM` (amorti, `update`)
 *   2. `_dive` sur le palier que `choisirPalier(altPlongeeM)` désigne
 *   3. pour chaque étage : glissé inertiel jusqu'à la butée du niveau
 *      (`budgetNiveau` = `STEP_IN` de `modes.js`), puis `_rescale` vers l'étage
 *      suivant, un cran à la fois (`escalier-zoom.js`), jusqu'à `zoomFin`.
 *
 * `paliers` et `choisirPalier` sont INJECTÉS (`DIVE_TIERS`, `pickDiveTier` de
 * `modes.js`) : le module reste pur et le test mord sur la vraie table.
 *
 * ⚠️ LE GLISSÉ DU NIVEAU EST BORNÉ PAR `distanceMin`, ET CE N'EST PAS UN
 * ORNEMENT. `_zoomGesture` déclenche `_refine` dès que
 * `dist <= minDistance × 1,02` — le plancher est donc une VRAIE fin de niveau,
 * pas une garde théorique. Sans lui, le profil raconterait une descente que la
 * caméra ne peut pas faire, et l'effondrement de la Tâche 2 bis (le défaut
 * v42) resterait invisible à l'instrument.
 *
 * `cranContinu` : `true` rejoue le cran d'aujourd'hui (altitude métrique
 * conservée, Tâche 2 bis) ; `false` rejoue la téléportation v48 au point de
 * présentation, gardée pour la MUTATION de l'Étape 6.
 *
 * `plongeeContinue` : `true` rejoue la plongée d'aujourd'hui (niveau et
 * distance DÉDUITS de l'altitude, Tâche 1b) ; `false` rejoue la pose fixe
 * d'avant — `choisirPalier` pour le niveau, `poseArrivee` pour la distance —
 * gardée pour la MUTATION de l'Étape 4. ⚠️ `choisirPalier` n'est lu QUE dans ce
 * second régime : la plongée continue n'a plus de table de paliers.
 */
export function profilDescente({
  choisirPalier,
  altDepartM = 1600000,
  altPlongeeM = null, // null → on plonge dès le départ (le cas le plus courant)
  lat = 45.8326, // Mont-Blanc — le vol de référence du §0 du plan
  zoomFin = 15, // `DEFAULT_FINE_ZOOM`, main.js:3090
  zoomMin = 3, // le plancher d'Adrien (« Z1 et Z2 ne doivent pas exister »)
  metresParUnite,
  distanceMax = DISTANCE_MAX_SURFACE,
  distanceMin = DISTANCE_MIN_SURFACE,
  span,
  tuilesParBloc = TUILES_PAR_BLOC,
  exag = exagPourZoom,
  budgetNiveau, // `STEP_IN` de modes.js
  cranContinu = true,
  plongeeContinue = true,
  ratioMax = 1.02,
} = {}) {
  const plongee = altPlongeeM ?? altDepartM
  const pts = []
  const pousse = (p) => pts.push(p)

  const echelle = (zoom) =>
    echelleBloc({ extentMeters: empriseBlocM({ zoom, lat, tuilesParBloc }), span, exageration: exag(zoom) })
  const altSurface = (camY, zoom) =>
    altitudeSurfaceM({
      camY,
      extentMeters: empriseBlocM({ zoom, lat, tuilesParBloc }),
      span,
      exageration: exag(zoom),
    })

  // ── 1. le glissé orbital, continu par construction (THREE.MathUtils.damp)
  for (const a of echelonsGeometriques(altDepartM, plongee, ratioMax)) {
    pousse({ mode: 'orbital', zoom: null, altM: altitudeOrbitaleM(a / metresParUnite, metresParUnite), transition: null, dist: null })
  }

  // ── 2. `_dive` — LA TRAVERSÉE ORBITE → SURFACE
  //
  // `plongeeContinue: true` (Tâche 1b) : le niveau ET la distance se DÉDUISENT
  // de l'altitude quittée, donc l'altitude ne bouge pas d'une image à l'autre.
  // `false` rejoue la pose fixe d'avant — c'est la mutation de l'Étape 4.
  let zoom
  let pente
  let camY
  let distanceCible
  if (plongeeContinue) {
    const niveau = niveauDePlongee({
      altM: plongee,
      echelleAuZoom: echelle,
      zoomMin,
      zoomMax: zoomFin,
      distanceMin,
      distanceMax,
    })
    zoom = niveau.zoom
    pente = PENTE_ARRIVEE_Y
    distanceCible = niveau.distanceCible
    camY = Y_CIBLE + distanceCible * pente
  } else {
    const palier = choisirPalier(plongee)
    zoom = palier?.zoom ?? zoomFin
    const arrivee = poseArrivee(distanceMax)
    pente = arrivee.pente
    camY = arrivee.camY
    distanceCible = arrivee.distanceCible
  }
  pousse({ mode: 'surface', zoom, altM: altSurface(camY, zoom), transition: '_dive', dist: distanceCible })

  // ── 3. l'escalier de surface
  for (;;) {
    // le glissé inertiel du niveau : la distance à la cible est divisée par
    // `exp(budgetNiveau)` avant que la butée ne rende la main — ou plus tôt, si
    // le plancher `minDistance` arrive le premier (voir l'en-tête)
    const dFin = Math.max(distanceCible * Math.exp(-budgetNiveau), distanceMin)
    for (const d of echelonsGeometriques(distanceCible, dFin, ratioMax).slice(1)) {
      pousse({ mode: 'surface', zoom, altM: altSurface(Y_CIBLE + d * pente, zoom), transition: null, dist: d })
    }
    distanceCible = dFin
    camY = Y_CIBLE + dFin * pente
    if (zoom >= zoomFin) break
    // `_rescale` — le cran
    const pose = cranContinu
      ? poseCranContinu({ camY, pente, facteurEchelle: echelle(zoom + 1) / echelle(zoom) })
      : posePresentation(pente, distanceMax) // la téléportation v48, pour la mutation
    zoom += 1
    distanceCible = Math.min(Math.max(pose.distanceCible, distanceMin), distanceMax)
    pente = pose.pente
    camY = Y_CIBLE + distanceCible * pente
    pousse({ mode: 'surface', zoom, altM: altSurface(camY, zoom), transition: '_rescale', dist: distanceCible })
  }

  return pts
}

// ══════════ 5. LE DÉTECTEUR DE SAUTS ════════════════════════════════════════
//
// ⚠️ IL NE LIT PAS L'ÉTIQUETTE `transition` POUR DÉCIDER : il compare deux
// altitudes consécutives. Sans quoi il ne mesurerait que ce qu'on lui a dit
// d'attendre. L'étiquette n'est reportée qu'APRÈS, pour nommer la cause.
export function sautsDuProfil(points, { facteurMin = 1.15 } = {}) {
  const sauts = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].altM
    const b = points[i].altM
    if (!(a > 0) || !(b > 0)) continue
    const facteur = Math.max(a / b, b / a)
    if (facteur <= facteurMin) continue
    sauts.push({
      index: i,
      cause: points[i].transition ?? '(non étiqueté)',
      deM: a,
      versM: b,
      ecartM: b - a,
      facteur,
      zoomAvant: points[i - 1].zoom,
      zoomApres: points[i].zoom,
      modeAvant: points[i - 1].mode,
      modeApres: points[i].mode,
    })
  }
  return sauts
}
