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
 */
export function profilDescente({
  choisirPalier,
  altDepartM = 1600000,
  altPlongeeM = null, // null → on plonge dès le départ (le cas le plus courant)
  lat = 45.8326, // Mont-Blanc — le vol de référence du §0 du plan
  zoomFin = 15, // `DEFAULT_FINE_ZOOM`, main.js:3090
  metresParUnite,
  distanceMax = DISTANCE_MAX_SURFACE,
  span,
  tuilesParBloc = TUILES_PAR_BLOC,
  exag = exagPourZoom,
  budgetNiveau, // `STEP_IN` de modes.js
  ratioMax = 1.02,
} = {}) {
  const plongee = altPlongeeM ?? altDepartM
  const pts = []
  const pousse = (p) => pts.push(p)

  const altSurface = (camY, zoom) =>
    altitudeSurfaceM({
      camY,
      extentMeters: empriseBlocM({ zoom, lat, tuilesParBloc }),
      span,
      exageration: exag(zoom),
    })

  // ── 1. le glissé orbital, continu par construction (THREE.MathUtils.damp)
  for (const a of echelonsGeometriques(altDepartM, plongee, ratioMax)) {
    pousse({ mode: 'orbital', zoom: null, altM: altitudeOrbitaleM(a / metresParUnite, metresParUnite), transition: null })
  }

  // ── 2. `_dive` — le changement de repère complet (modes.js, `_dive`)
  const palier = choisirPalier(plongee)
  let zoom = palier?.zoom ?? zoomFin
  const arrivee = poseArrivee(distanceMax)
  let pente = arrivee.pente
  let camY = arrivee.camY
  let distanceCible = arrivee.distanceCible
  pousse({ mode: 'surface', zoom, altM: altSurface(camY, zoom), transition: '_dive' })

  // ── 3. l'escalier de surface
  for (;;) {
    // le glissé inertiel du niveau : la distance à la cible est divisée par
    // `exp(budgetNiveau)` avant que la butée ne rende la main
    const dFin = distanceCible * Math.exp(-budgetNiveau)
    for (const d of echelonsGeometriques(distanceCible, dFin, ratioMax).slice(1)) {
      pousse({ mode: 'surface', zoom, altM: altSurface(Y_CIBLE + d * pente, zoom), transition: null })
    }
    if (zoom >= zoomFin) break
    // `_rescale` : téléportation au point de présentation de l'étage suivant
    zoom += 1
    const pose = posePresentation(pente, distanceMax)
    camY = pose.camY
    distanceCible = pose.distanceCible
    pente = pose.pente
    pousse({ mode: 'surface', zoom, altM: altSurface(camY, zoom), transition: '_rescale' })
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
