// Mode state machine: SURFACE (the detailed terrain patch, full effects) ⇄
// ORBITAL (the whole planet, effects powered down). Camera altitude is the
// single driver, with hysteresis so the boundary never flaps:
//   surface → orbital  when the user keeps zooming past the orbit gate
//   orbital → surface  when altitude CROSSES a dive tier from above
// Three tiers mean a Madagascar-sized view lands on real terrain (z8 patch,
// ~470 km across) instead of a long dead zoom to the 8 000 m fine gate; once
// on a coarse patch, zooming against the near stop REFINES to the next scale.
// Transitions are announced FUI-style and masked by a paper whiteout.

import * as THREE from 'three'
import { R_GLOBE, ORBITAL_M_PER_UNIT, sphereToLatLon, latLonToSphere } from './geo.js'
import { PinchTracker } from './gestes.js'
import { pasEscalier, paliersRetenus, palierDeClic } from './escalier-zoom.js'
// LA LOI D'ALTITUDE vit dans un module PUR (voir son en-tête, et la Tâche 1 du
// plan « globe continu »). Rien ne change ici : ces quatre fonctions sont
// exactement les calculs qui étaient écrits en clair ci-dessous, sortis pour
// être mesurables sous node — `Modes` appelle `document.createElement` et ce
// dépôt n'a pas de jsdom.
import {
  PENTE_ARRIVEE,
  Y_CIBLE,
  DISTANCE_MAX_SURFACE,
  DISTANCE_MIN_SURFACE,
  ALT_PLANCHER_ORBITALE_M,
  altitudeOrbitaleM,
  altitudeSortieOrbiteM,
  distanceArrivee,
  distanceMinOrbitale,
  distancePourAltitude,
  distancePresentation,
  niveauDePlongee,
  planProche,
  poseCranContinu,
} from './loi-altitude.js'
// LE ZOOM CONTINU — Tâche M, « la mort des paliers ». Module PUR lui aussi ; il
// porte la loi mesurée par Adrien (un cran = ×√2), le franchissement de niveau
// sans table, et le changement d'unités qui rend ce franchissement invisible.
// ⚠️ **`modes.js` N'IMPORTE PAS `flags.js`** : il ne connaît le régime que par le
// crochet `hooks.zoomContinu()`, comme `globe.js` ne connaît `globeContinu` que
// par son constructeur.
import {
  PAS_CRAN,
  PAS_NIVEAU,
  facteurCran,
  franchissement,
  poseApresNiveau,
  distancePourAltitudeFond,
  niveauDArrivee,
} from './monde/zoom-continu.js'

// Le pincement fabrique un faux événement de molette. _zoomGesture appelle
// preventDefault() sur plusieurs branches ; côté tactile, le vrai événement a
// déjà été traité au-dessus (c'est le pincement reconnu qui décide), donc ces
// branches n'ont plus rien à annuler.
const NOOP = () => {}

// ordered fine → coarse; zoom null = the user's fine zoom (≥ 12).
// Every stop on the way down lands on a matching real-terrain block instead of
// the globe: z7 @ 600 km, then the regional/local tiers. Corsica-sized views
// (~150 km) still get z8.
//
// ⚠️ LE PLANCHER EST z3 (Adrien : « Z1 et Z2 ne doivent pas exister »). Le
// filtre est appliqué ICI et sa règle vit dans escalier-zoom.js : la table brute
// reste lisible, et changer d'avis sur le plancher ne demande de toucher qu'à
// `ZOOM_PALIER_MIN`.
//
// ⚠️ CE PARAGRAPHE A ÉTÉ FAUX. Il annonçait que z4 et z5 avaient été RETIRÉS et
// que la porte orbitale s'ouvrait « au-dessus de 1 600 km ». Les deux ont cessé
// d'être vrais le jour où la marche z3 a été ajoutée à la table : z4 et z5 sont
// bel et bien là (16 lignes plus bas), et le palier le plus large est désormais
// z3 à 16 000 km. C'est donc à 16 000 km, et non à 1 600, que plus aucun palier
// ne correspond à l'altitude — c'est-à-dire que la porte orbitale s'ouvre.
//
// `DIVE_ALT_M` (le seuil du zoom fin) ne bouge pas — c'est DIVE_TIERS[0], et lui
// n'a jamais été concerné.
export const DIVE_TIERS = paliersRetenus([
  { altM: 8000, zoom: null },
  { altM: 25000, zoom: 11 },
  { altM: 50000, zoom: 10 },
  { altM: 100000, zoom: 9 },
  { altM: 200000, zoom: 8 },
  { altM: 600000, zoom: 7 },
  { altM: 1600000, zoom: 6 },
  { altM: 4000000, zoom: 5 },
  { altM: 8000000, zoom: 4 },
  // ⚠️ z3 EST LE PLANCHER, il lui fallait donc sa marche. La table s'arrêtait à
  // z4 : filtrée par un plancher plus bas, elle laissait z4 comme palier le plus
  // large, et le clic depuis l'orbite haute n'atteignait jamais z3. Le seuil
  // d'altitude prolonge la progression géométrique de la table (×2 par cran).
  { altM: 16000000, zoom: 3 },
])

// tier a settled zoom-in engages at `altM` meters — null above every tier
export function pickDiveTier(altM) {
  return DIVE_TIERS.find((t) => altM < t.altM) ?? null
}

// L'escalier de surface : UN palier à la fois, plafonné au zoom fin en montant,
// plancher au bloc régional z6 en descendant — au-delà c'est la porte orbitale
// qui prend le relais.
//
// Il avançait de DEUX paliers à la fois. C'était défendable tant que le relief
// fin s'arrêtait à z12 : un cran sur deux n'apportait rien de visible et chaque
// palier coûte un rechargement de DEM. Depuis Mapterhorn, chaque niveau porte
// de la vraie donnée, donc sauter un cran sur deux jetait la moitié du détail
// disponible (Adrien : « le zoom saute des étapes, il passe de 11 à 13 »).
//
// Et surtout, le pas de 2 n'était PAS symétrique : le retour se faisait aussi
// par 2 mais la montée était plafonnée au zoom fin, si bien qu'un aller-retour
// depuis un palier impair atterrissait un cran plus bas que le point de départ
// — on ne pouvait pas revenir au cadrage qu'on venait de quitter.
//
// La règle a déménagé dans escalier-zoom.js (pure, testée) ; ce nom reste parce
// que main.js et les tests l'appellent.
export const stepZoom = (zoom, dir, fine = 12) => pasEscalier(zoom, dir, fine)
const DIVE_ALT_M = DIVE_TIERS[0].altM
// ~9,4 rayons terrestres — la planète devient un petit objet dans le noir,
// façon Google Earth (Adrien : « laisse la possibilité de reculer plus ») ;
// l'ancien plafond (16 000 km, planète pleine trame) était trop court.
const MAX_ALT_M = 60000000
const MSG_MS = 3600

// ══════════ LE PLANCHER ORBITAL — RETIRÉ (Tâche 1b, Étape 3) ════════════════
//
// ⚠️ IL Y EN AVAIT DEUX, ET LE PLAN N'EN NOMMAIT QU'UN.
//   · `controls.minDistance = R_GLOBE + DIVE_ALT_M × 0,85 / ORBITAL_M_PER_UNIT`
//     dans `enterOrbit` — celui que le plan désignait ;
//   · le clamp de `orbAltTarget` à `DIVE_ALT_M × 0,9` (7 200 m), dans
//     `_zoomGesture` ET dans `_orbitNotch` — **celui qui mordait EN PREMIER**,
//     puisque 0,9 > 0,85. Retirer l'autre sans lui n'aurait rien changé.
// Tant que l'un des deux était là, la caméra ne pouvait PAS descendre en mode
// orbital : « de l'orbite au sol » était interdit par construction, pas par
// manque de code.
//
// La valeur vaut zéro et le zoom orbital est MULTIPLICATIF (`× exp(deltaY·k)`) :
// le plancher est donc asymptotique, jamais atteint, et `controls.update()`
// tient la caméra au-dessus de la sphère par `minDistance = R_GLOBE`.
const ORB_ALT_MIN = ALT_PLANCHER_ORBITALE_M / ORBITAL_M_PER_UNIT

// surface zoom is a CUSTOM inertial dolly (OrbitControls zoom is off): each
// wheel notch adds to a log-space velocity that decays slowly, so the élan
// coasts over many notches (Adrien: "au moins 20 crans"). A notch is small on
// purpose; the momentum (ZOOM_TAU) is what gives the long, smooth glide. The
// glide CLAMPS at the zone's near/far limit and never crosses a level on its
// own — a FRESH scroll while already pinned at the limit steps to the next
// level (Adrien: "le zoom s'arrête au max de la zone, on re-scroll pour passer").
const ZOOM_TAU = 1.2 // s — velocity decay time constant; big → the coast stretches far
const ZOOM_VEL_MAX = 1.3 // caps a fast burst
const ZOOM_STOP = 0.015 // velocity below which the coast is considered spent
const WHEEL_GAP_MS = 220 // a wheel event this long after the last starts a FRESH gesture

// ══════════ LE BUDGET DU NIVEAU VAUT EXACTEMENT UN CRAN — Tâche 2 bis ═══════
//
// the zone's own zoom budget (log-distance) — the glide CLAMPS here, it does not
// run to the physical near/far stop; a fresh re-scroll at the limit steps a level.
//
// ⚠️ **IL VALAIT 1,2 EN ENTRÉE ET 0,55 EN SORTIE, ET CES DEUX CHIFFRES SONT
// DEVENUS FAUX LE JOUR OÙ `_rescale` A CESSÉ DE TÉLÉPORTER.** Tant que chaque
// traversée d'étage reposait la caméra au point de présentation, le budget du
// niveau n'avait aucune conséquence géométrique : le cran effaçait tout. Depuis
// que l'altitude métrique est CONSERVÉE au cran (décision d'Adrien du
// 2026-08-20, « exactement comme Google Earth »), le budget du niveau et le pas
// de l'escalier doivent être LE MÊME NOMBRE, parce qu'un cran de zoom divise
// l'emprise du bloc par deux — soit `ln 2` de distance, et rien d'autre.
//
// ⚠️ MESURÉ, ET C'EST LE DÉFAUT v42 QUI REVIENT SI ON L'OUBLIE (Mont-Blanc,
// z5 → z15, `test/escalier-surface.test.js`) :
//   · budget 1,2 conservé  → le niveau descend ×3,32 quand le cran ne rend que
//     ×2 : la distance d'entrée s'écroule de 141 à 11,6 unités, la caméra vient
//     se coller au plancher `minDistance = 6` DÈS z8 et n'en repart plus. On
//     regarde alors de la donnée z9 (213 m le texel) depuis 4 km d'altitude,
//     avec un neuvième du bloc dans le cadre.
//   · budget `ln 2`        → la distance d'entrée se stabilise vers 77 unités,
//     le glissé va de 77 à 38, le cran la ramène à 77. Rien ne touche le
//     plancher, l'altitude est continue, et l'arrivée à z15 tombe à 418 m —
//     contre 487 m par l'ancien escalier téléporté.
//
// ⚠️ ET L'ENTRÉE ET LA SORTIE DOIVENT ÊTRE ÉGALES, sinon l'aller-retour
// CLIQUETTE. Mesuré : avec 1,2 en entrée et 0,55 en sortie, un cran de zoom
// suivi d'un cran de dézoom rend 14 326 m là où on était parti de 27 696 m —
// on revient DEUX FOIS PLUS BAS qu'avant d'avoir zoomé. À budgets égaux, le
// même aller-retour rend 26 876 m (×0,970, le résidu venant du `y = −0,3` de la
// cible). L'ancien escalier ne cliquettait pas parce que la téléportation
// remettait les deux directions au même point de présentation.
// ⛔ **ET CES DEUX-LÀ CONFONDAIENT DEUX GRANDEURS — Tâche M, D9.** Le paragraphe
// ci-dessus est juste sur UN point (le budget d'un NIVEAU DE MNT vaut `ln 2`,
// parce qu'un cran de zoom slippy divise l'emprise de la tuile par deux) et faux
// sur l'autre : il en concluait que le CRAN valait `ln 2` aussi.
//
// **Dix-neuf altitudes relevées par Adrien dans Google Earth**, 63 170 km →
// 126 km, 18 intervalles : **moyenne géométrique ×1,41256**, soit **√2 à 0,12 %
// près**. ➡️ **Un cran vaut ×√2, pas ×2.** La justification complète, l'écart-type
// et le piège de la « loi de moins en moins forte » vivent dans
// `monde/zoom-continu.js`.
//
// ⚠️ **LES DEUX NOMBRES RESTENT, MAIS SÉPARÉS** : `STEP_IN`/`STEP_OUT` sont LE
// CRAN (le geste de l'utilisateur, libre, mesuré) ; `BUDGET_NIVEAU` est le
// NIVEAU DE MNT (la grille de tuiles, pas un réglage). C'est leur confusion qui
// valait « deux fois trop ».
export const STEP_IN = PAS_CRAN // UN CRAN, ×√2 — la loi mesurée (D9)
export const STEP_OUT = PAS_CRAN // idem en dézoom — l'aller-retour doit revenir au point de départ

// LE BUDGET D'UN NIVEAU DE MNT. ⚠️ **Il n'est pas libre** : un niveau divise
// l'emprise du bloc par deux, donc `ln 2` de distance et rien d'autre. C'est lui
// que le glissé de l'ESCALIER borne (chemin plat) et lui que le franchissement
// automatique compte (chemin continu).
export const BUDGET_NIVEAU = PAS_NIVEAU

// ⚠️ « AU MOINS 20 CRANS » EST UNE CONTRAINTE D'ADRIEN, PAS UN EFFET DE BORD.
// Un défilement continu délivre `N × ZOOM_IMPULSE × ZOOM_TAU` de distance
// logarithmique : le niveau valait 1,2 / (0,05 × 1,2) = 20 crans de molette.
// Le budget ayant changé, l'impulsion est désormais DÉRIVÉE de lui pour que ce
// 20 ne bouge pas — la valeur littérale (0,05) l'aurait fait tomber à 11,5.
// ⚠️ **ET C'EST LE NIVEAU QUI LE DÉRIVE, PAS LE CRAN — Tâche M.** Le cahier des
// charges le dit : *« Le réglage porte sur le CRAN, pas sur le tour de molette :
// le nombre de crans par tour dépend de la souris. »* Dériver l'impulsion du
// cran aurait divisé la molette par deux au passage, ce que personne n'a
// demandé ; la dériver du niveau laisse la molette **au bit près** ce qu'elle
// était.
const CRANS_PAR_NIVEAU = 20
const ZOOM_IMPULSE = BUDGET_NIVEAU / (CRANS_PAR_NIVEAU * ZOOM_TAU) // ≈ 0,0289 log-dist/s par cran

// task 30 Fix A: the isometric-ish viewing angle every dive/refine arrival
// has always used (camera.position(0,18,19), looking at (0,-0.3,0)) — kept
// as a fixed DIRECTION so the new far-standoff arrival (_arrivalPose()
// below) still frames the block the same way, just from farther back.
const _ARRIVAL_DIR = new THREE.Vector3(0, PENTE_ARRIVEE.y, PENTE_ARRIVEE.z).normalize()

export class Modes {
  /**
   * hooks: {
   *   setSurfaceVisible(bool), setEffectsEnabled(bool),
   *   getSurfaceLatLon() → {lat, lon},
   *   surfaceCamAltMeters() → number,
   *   loadSurface(lat, lon, zoom?) → Promise (resolves when terrain is rebuilt),
   *   surfaceMaxDistance() → number (controls.maxDistance in surface mode),
   *   getFineZoom() → number (user's detail zoom, ≥ 12),
   *   getRefineTarget() → {lat, lon, zoom} | null (next finer scale under the
   *     current view, null when already at fine scale),
   *   getCoarsenTarget() → {lat, lon, zoom} | null (next wider scale, null
   *     once the patch is z8 — then zooming out opens the orbit gate),
   *   sampleGroundY(x, z) → number (optional; terrain height at a world XZ —
   *     used by _arrivalPose()'s clearance guard, see its own comment),
   * }
   */
  constructor({ camera, controls, globe, domElement, hooks }) {
    this.mode = 'surface'
    this.camera = camera
    this.controls = controls
    this.globe = globe
    this.hooks = hooks
    this.altM = 0 // displayed altitude (meters)
    this.orbAlt = 0 // orbital altitude in scene units (current)
    this.orbAltTarget = 0
    this.busy = false
    this.locked = false // embed « zone de test » : molette neutralisée (voir wheel)
    this.travel = null // great-circle glide tween
    this._surfCam = { near: camera.near, far: camera.far }
    this._zoomVel = 0 // surface inertial dolly velocity (log-dist units/s)
    this._zoomNdc = new THREE.Vector2() // cursor NDC of the last wheel notch
    this._zoomPivot = null // world point the coast zooms toward (last valid)
    this._lastWheelT = 0 // ms of the last wheel event — a big gap means a fresh gesture
    this._levelZoom = 0 // log-distance dépensée dans le niveau ; COMPTEUR sous le drapeau, butée sinon
    this._empriseVue = null // l'emprise du bloc à l'image précédente — voir _suivreEmprise

    this._buildDom()

    // orbital zoom is proportional to altitude (Google-Earth feel) — we take
    // over the wheel entirely while in orbit
    domElement.addEventListener('wheel', (e) => this._zoomGesture(e), { passive: false })

    // LE DOIGT emprunte le MÊME escalier que la molette. Un pincement n'est pas
    // traduit en dolly : gestes.js le convertit en crans de molette, et ils entrent
    // par _zoomGesture — donc mêmes paliers de relief, mêmes butées, même élan.
    // Rendre son pincement natif à OrbitControls (enableZoom) aurait fait
    // l'inverse : la caméra s'approche d'une géométrie qui reste grossière,
    // parce que rien ne serait jamais passé par _refine().
    this._pinch = new PinchTracker()
    const pts = (e) => [...e.touches].map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }))
    domElement.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) this._pinch.start(pts(e)) }, { passive: true })
    domElement.addEventListener(
      'touchmove',
      (e) => {
        const m = this._pinch.move(pts(e))
        if (!m) return
        // reconnu comme pincement : on empêche le navigateur d'en faire son
        // propre zoom. On ne touche à RIEN d'autre — le déplacement à deux
        // doigts appartient à OrbitControls, sur ce même élément.
        if (e.cancelable) e.preventDefault()
        this._zoomGesture({ deltaY: m.deltaY, clientX: m.clientX, clientY: m.clientY, preventDefault: NOOP })
      },
      { passive: false }
    )
    const finDuGeste = (e) => { if (e.touches.length < 2) this._pinch.end() }
    domElement.addEventListener('touchend', finDuGeste, { passive: true })
    domElement.addEventListener('touchcancel', finDuGeste, { passive: true })
  }

  // ══════════ LE RÉGIME CONTINU — Tâche M ═══════════════════════════════════
  //
  // ⚠️ **UN CROCHET, RAPPELÉ À CHAQUE LECTURE — PAS UN BOOLÉEN FIGÉ À LA
  // CONSTRUCTION.** Une tâche de ce chantier a trouvé un test faible qui passait
  // le globe PAR SA VALEUR alors que la production le passe PAR UNE FONCTION :
  // la faute était invisible sous la seule forme que la production n'emploie
  // pas. Ici la production passe une fonction, et les bancs aussi.
  _continu() {
    return this.hooks.zoomContinu?.() === true
  }

  // L'ALTITUDE QUE LA CAMÉRA DE FOND OCCUPE, EN MÈTRES — `camY × emprise / span`.
  //
  // ⚠️ **C'EST LA SEULE GRANDEUR DONT UN SAUT SE VOIT À L'ÉCRAN** sous
  // `?terre=unique` : la caméra visible est celle que la similitude de
  // `monde/frontiere-rendu.js` produit, et son facteur est HORIZONTAL. Les deux
  // autres altitudes de ce fichier (`this.altM`, `_altitudeCadrageM()`) portent
  // l'exagération verticale, donc elles ne la voient pas.
  _altitudeFondM() {
    const emprise = this.hooks.empriseBlocM?.()
    const span = this.hooks.coteBloc?.()
    if (!(emprise > 0) || !(span > 0)) return null
    return (this.camera.position.y * emprise) / span
  }

  // ══════════ LA CAMÉRA SUIT L'UNITÉ DU BLOC, IMAGE PAR IMAGE ══════════════
  //
  // ⚠️ **C'EST ICI ET PAS DANS `_rescale`, ET LA RAISON EST MESURÉE.** Le dépôt
  // reposait la caméra APRÈS le chargement ; or `main.js` documente, journal par
  // image à l'appui, que **`largeurBlocM()` est divisée par deux UNE IMAGE AVANT
  // que `_rescale` ne double `camera.position.y`**. Entre les deux, l'altitude
  // lue vaut exactement LA MOITIÉ de la vraie — c'est ce qui a produit **onze
  // bascules du seuil du socle au lieu d'une**, et sous `?terre=unique` cela
  // ferait clignoter la planète entière à chaque cran.
  //
  // En suivant l'emprise image par image, la conversion tombe sur la MÊME image
  // que le changement, **quel qu'en soit l'auteur** : cran, plongée, vol,
  // template, ou l'arrivée du MNT derrière la fenêtre (écart mesuré 6,9·10⁻⁵ à
  // z12, 3,5 % à z5 — un vrai changement d'unité, pas du bruit).
  //
  // ⚠️ **ET C'EST UNE CONVERSION D'UNITÉS, PAS UNE REPOSITION.** L'invariant est
  // `camY × emprise`, c'est-à-dire l'altitude que la caméra de FOND occupe. La
  // pente traverse inchangée : l'angle de vue de l'utilisateur est gardé.
  _suivreEmprise() {
    const emprise = this.hooks.empriseBlocM?.()
    const avant = this._empriseVue
    if (!(emprise > 0)) { this._empriseVue = null; return }
    this._empriseVue = emprise
    if (!this._continu() || this.mode !== 'surface' || !(avant > 0) || avant === emprise) return
    const c = this.controls
    const cible = c.target
    _zoomDir.copy(this.camera.position).sub(cible)
    const norme = _zoomDir.length()
    if (!(norme > 1e-6)) return
    _zoomDir.multiplyScalar(1 / norme)
    if (Math.abs(_zoomDir.y) < 1e-3) return // vue rasante : la pente ne porte plus rien
    const pose = poseApresNiveau({
      camY: this.camera.position.y,
      pente: _zoomDir.y,
      empriseAvant: avant,
      empriseApres: emprise,
      yCible: cible.y,
    })
    const borne = THREE.MathUtils.clamp(pose.distanceCible, c.minDistance, c.maxDistance)
    this.camera.position.copy(cible).addScaledVector(_zoomDir, borne)
    c.update()
  }

  // Le niveau d'arrivée, DÉDUIT de l'altitude de fond — sans table de paliers.
  _niveauDArrivee(altM) {
    const empriseAuZoom = this.hooks.empriseBlocMAuZoom
    const span = this.hooks.coteBloc?.()
    if (typeof empriseAuZoom !== 'function' || !(span > 0)) return null
    return niveauDArrivee({
      altM,
      empriseAuZoom,
      span,
      zoomMax: this.hooks.getFineZoom(),
      pente: _ARRIVAL_DIR.y,
      yCible: Y_CIBLE,
      distanceMin: DISTANCE_MIN_SURFACE,
      // ⚠️ **LA MOITIÉ DU PLAFOND, ET CE N'EST PAS UNE MARGE DE CONFORT.**
      // Un niveau s'explore de `d₀/2` (on affine) à `2 d₀` (on élargit) : sans
      // ce demi, `2 d₀` dépasserait `maxDistance` et le glissé se ferait CLIPPER
      // avant d'avoir dépensé son niveau — la butée reviendrait par la fenêtre,
      // en haut cette fois. Le 0,94 est celui de `distanceArrivee` et pour la
      // même raison écrite là-bas : rester sous la butée dure pour que
      // `controls.update()` ne re-clampe pas immédiatement.
      distanceMax: distanceArrivee(this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE) / 2,
    })
  }

  // ══════════ LE FRANCHISSEMENT AUTOMATIQUE — CE QUI TUE LE CRAN ════════════
  //
  // ⛔ **C'EST LE GESTE QUE LE DÉPÔT DEMANDAIT À L'UTILISATEUR DE FAIRE.** Le
  // glissé butait sur le budget du niveau, rendait la main, et il fallait
  // **re-défiler** pour franchir (`atInLimit` → `_refine`). Adrien : *« vire
  // absolument ton système de saut de niveau !!! »*
  //
  // Ici le budget n'est plus une butée mais un COMPTEUR : dès qu'il vaut un
  // niveau plein, on franchit, et le compteur repart de son reste. L'hystérésis
  // est celle de la troncature (`franchissement`), donc symétrique et sans
  // seuil à régler.
  _franchirSiBesoin() {
    if (!this._continu() || this.busy || this.travel || this._diveTween) return
    const { niveaux, reste } = franchissement(this._levelZoom, BUDGET_NIVEAU)
    if (niveaux === 0) return
    if (niveaux > 0) {
      // ⚠️ **ON NE DÉPENSE LE BUDGET QUE SI LE NIVEAU EXISTE.** Au zoom fin il
      // n'y a plus rien à affiner : laisser le compteur courir est CORRECT — il
      // faudra le remonter d'autant pour élargir, et l'aller-retour reste
      // symétrique. Le retrancher rendrait le retour asymétrique.
      if (!this.hooks.getRefineTarget()) return
      this._levelZoom = reste
      this._refine()
      return
    }
    if (this.hooks.getCoarsenTarget()) {
      this._levelZoom = reste
      this._coarsen()
      return
    }
    // plus de niveau plus large : la porte orbitale, et elle est SANS RIDEAU
    this._levelZoom = reste
    this.enterOrbit()
  }

  // ══════════ UN CRAN, ET UN SEUL GESTE POUR LES DEUX MONDES ════════════════
  //
  // ⛔ **`_orbitNotch` EST MORT AVEC SON 1,7.** Ce facteur n'avait aucune source :
  // il était choisi. Le cran vaut ×√2 — mesuré par Adrien sur Google Earth — et
  // c'est la MÊME loi en orbite et en surface, ce qui est la moitié de « une
  // seule caméra, de l'orbite au sol ».
  cranZoom(dir) {
    if (this.busy || this.travel || this._diveTween) return
    const f = facteurCran(dir)
    if (this.mode === 'orbital') {
      if (dir > 0) this._diveArmed = true // inward intent arms the dive, like the wheel
      this.orbAltTarget = THREE.MathUtils.clamp(
        this.orbAltTarget * f,
        ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
        MAX_ALT_M / ORBITAL_M_PER_UNIT
      )
      return
    }
    if (!this._continu()) {
      // chemin plat (sauvegarde gelée) : le bouton garde l'escalier de paliers
      if (dir > 0) this._refine()
      else if (this.hooks.getCoarsenTarget()) this._coarsen()
      else this.enterOrbit()
      return
    }
    const c = this.controls
    const dist = c.getDistance()
    const nouvelle = THREE.MathUtils.clamp(dist * f, c.minDistance, c.maxDistance)
    this._levelZoom += Math.log(Math.max(nouvelle, 1e-6) / Math.max(dist, 1e-6))
    _zoomDir.copy(this.camera.position).sub(c.target).normalize()
    this.camera.position.copy(c.target).addScaledVector(_zoomDir, nouvelle)
    c.update()
    this._franchirSiBesoin()
  }

  // UN cran de zoom, d'où qu'il vienne — molette ou pincement. `e` doit porter
  // deltaY, clientX, clientY et preventDefault().
  _zoomGesture(e) {
    // boutique/embed « zone de test » (Adrien) : le visiteur zoome et
    // dézoome LIBREMENT dans 100 % du budget de zoom du niveau (le glissé
    // inertiel se clampe tout seul, voir _applyZoom) — mais ne peut JAMAIS
    // franchir un niveau ni changer de zone : les branches refine/coarsen/
    // orbit sont neutralisées plus bas. flyTo n'est pas bridé (c'est lui
    // qui pose la zone et les vues iso).
    if (this.locked && this.mode !== 'surface') { e.preventDefault(); return }
    if (this.mode === 'surface') {
      // pendant le suivi de tête GPX, la molette pilote le STANDOFF de la
      // caméra de suivi (zoom/dézoom autour de la tête) — pas l'escalier
      if (this.hooks.followWheel?.(e.deltaY)) { e.preventDefault(); return }
      // LE CADRAGE DU DAMIER TIENT LA MOLETTE (voir vue-ensemble.js et le bloc
      // `cadreLeDamier` de main.js). Tant que le cumul de dézoom n'atteint pas
      // le seuil, le cran est avalé : le bouton caméra vient de cadrer tout le
      // damier, et un cran réflexe ne doit pas défaire ce qu'on demandait. Dès
      // que l'utilisateur insiste, le hook rend `false` APRÈS avoir remis
      // `controls.maxDistance` — sans quoi la butée lue trois lignes plus bas
      // serait celle du cadrage, pas la vraie.
      if (this.hooks.cadrageWheel?.(e.deltaY)) { e.preventDefault(); return }
      if (this._diveTween || this.busy) return
      e.preventDefault()
      const now = performance.now()
      const fresh = now - this._lastWheelT > WHEEL_GAP_MS // a new gesture, not a continuous scroll
      this._lastWheelT = now
      const dist = this.controls.getDistance()
      const inward = e.deltaY < 0
      // "at the zone limit" = the level's zoom budget is spent (or the
      // physical near stop / far stop is reached anyway)
      // ⛔ **SOUS LE DRAPEAU, LES DEUX BUTÉES N'EXISTENT PLUS — Tâche M.** Elles
      // SONT le cran qu'Adrien décrit : le glissé s'arrêtait au bout du niveau
      // et il fallait re-défiler pour franchir. Le franchissement est désormais
      // automatique (`_franchirSiBesoin`, appelé par `_applyZoom`), donc ces deux
      // branches n'ont plus rien à déclencher.
      const continu = this._continu()
      const atInLimit = !continu && (this._levelZoom <= -BUDGET_NIVEAU + 0.03 || dist <= this.controls.minDistance * 1.02 || this.hooks.nearGround?.())
      const atOutLimit = !continu && (this._levelZoom >= BUDGET_NIVEAU - 0.03 || dist >= this.controls.maxDistance * 0.98)
      // GUARD-RAIL (Adrien): the glide stops at the zone limit; a FRESH
      // re-scroll while already pinned there is what steps to the next level.
      if (fresh && inward && atInLimit) {
        if (this.locked) return // zone de test : on butte au plancher, pas de plongée
        this._resetZoom()
        this._refine()
        return
      }
      if (fresh && !inward && atOutLimit) {
        if (this.locked) return // zone de test : on butte au plafond, ni recul ni orbite
        this._resetZoom()
        if (this.hooks.getCoarsenTarget()) this._coarsen()
        else this.enterOrbit()
        return
      }
      // otherwise just feed the inertial glide — it clamps at the limit and
      // never crosses a level on its own (see _applyZoom).
      this._zoomVel = THREE.MathUtils.clamp(
        this._zoomVel + Math.sign(-e.deltaY) * ZOOM_IMPULSE,
        -ZOOM_VEL_MAX,
        ZOOM_VEL_MAX
      )
      this._zoomNdc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
      const p = this.hooks.pointUnder?.(this._zoomNdc.x, this._zoomNdc.y)
      if (p) this._zoomPivot = p // fixed pivot for the whole coast (zoom toward cursor)
      return
    }
    e.preventDefault()
    if (this.busy || this.travel) return
    if (e.deltaY < 0) this._diveArmed = true // inward intent arms the dive
    const f = Math.exp(e.deltaY * 0.0011)
    this.orbAltTarget = THREE.MathUtils.clamp(
      this.orbAltTarget * f,
      ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
      MAX_ALT_M / ORBITAL_M_PER_UNIT
    )
  }

  // ---------------------------------------------------------------- DOM

  _buildDom() {
    const alt = document.createElement('div')
    alt.className = 'altimeter'
    alt.innerHTML = '<span class="alt-mode">SURFACE</span><span class="alt-value">— m</span>'
    document.body.appendChild(alt)
    this.altEl = alt
    this.altModeEl = alt.querySelector('.alt-mode')
    this.altValueEl = alt.querySelector('.alt-value')

    const msg = document.createElement('div')
    msg.className = 'fui-msg hidden'
    document.body.appendChild(msg)
    this.msgEl = msg
    this._msgTimer = 0

    const white = document.createElement('div')
    white.className = 'whiteout'
    document.body.appendChild(white)
    this.whiteEl = white
  }

  announce(text) {
    this.msgEl.textContent = text
    this.msgEl.classList.remove('hidden')
    clearTimeout(this._msgTimer)
    this._msgTimer = setTimeout(() => this.msgEl.classList.add('hidden'), MSG_MS)
  }

  // ⛔ **LE RIDEAU EST LE SAUT LE PLUS VISIBLE DE TOUS — 480 ms d'aller, 480 ms
  // de retour, à chaque traversée.** Il n'était pas l'ornement du saut, il était
  // là parce que le saut était invisible autrement (`_rescale` le dit déjà de son
  // côté). Sous `?terre=unique` il n'y a plus qu'une Terre des deux côtés de la
  // traversée : il n'a plus rien à masquer, et Adrien : « je ne veux aucun saut ».
  _whiteout(swap) {
    if (this._continu()) return Promise.resolve().then(swap)
    return new Promise((resolve) => {
      this.whiteEl.classList.add('on')
      setTimeout(async () => {
        await swap()
        this.whiteEl.classList.remove('on')
        setTimeout(resolve, 480)
      }, 480)
    })
  }

  // ---------------------------------------------------------------- surface → orbital

  async enterOrbit(entryAltM = null) {
    if (this.mode !== 'surface' || this.busy) return
    this._resetZoom()
    // continuity: pop out at the altitude the surface view actually had, so a
    // z8 patch hands over at ~500 km and a z12 patch at ~30 km
    // ⚠️ **SOUS LE DRAPEAU, ON SORT À L'ALTITUDE EXACTE — pas 15 % au-dessus.**
    // Le `× 1,15` d'`altitudeSortieOrbiteM` existait pour repasser la porte de
    // plongée sans y retomber ; la porte est maintenant géométrique et
    // `_diveArmed` suffit à ne pas replonger. Un 15 % de recul serait un saut,
    // et c'est exactement ce qu'Adrien refuse.
    if (entryAltM == null && this._continu()) entryAltM = this._altitudeFondM()
    if (entryAltM == null) {
      // pop out just above the block's own altitude; a coarse z4 continental
      // block (~7 500 km up) hands over above the 8 000 km globe gate
      // ⚠️ RÈGLE R1 : c'est une décision de CADRAGE, elle lit donc l'altitude
      // GÉOMÉTRIQUE — celle qui ne contient ni `dem.meanM` ni l'exagération
      // verticale. `surfaceCamAltMeters()` (l'altimètre) porte les deux ; le
      // hook de cadrage, lui, n'en porte aucun. Voir main.js et le §2 du plan.
      entryAltM = altitudeSortieOrbiteM(this._altitudeCadrageM())
    }
    // an explicit altitude must respect the orbit ceiling too, or the camera
    // would sit above controls.maxDistance and snap every frame
    entryAltM = Math.min(entryAltM, MAX_ALT_M)
    this.busy = true
    this.announce('FX OFFLINE — ENTERING ORBITAL VIEW')
    const { lat, lon } = this.hooks.getSurfaceLatLon()

    await this._whiteout(() => {
      this.hooks.setSurfaceVisible(false)
      this.hooks.setEffectsEnabled(false)
      this.globe.setVisible(true)

      this._surfCam.near = this.camera.near
      this._surfCam.far = this.camera.far
      this.camera.far = 1400
      this.camera.updateProjectionMatrix()

      this.orbAlt = this.orbAltTarget = entryAltM / ORBITAL_M_PER_UNIT
      this._diveArmed = false // require an inward zoom before re-diving
      latLonToSphere(lat, lon, R_GLOBE + this.orbAlt, this.camera.position)
      this.controls.target.set(0, 0, 0)
      this._poseButees('orbital') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.controls.maxPolarAngle = Math.PI
      this.controls.enableZoom = false // wheel handled by us
      this.controls.enablePan = false
      this.camera.up.set(0, 1, 0)
      this.camera.lookAt(0, 0, 0)
      this.controls.update()
      this._empriseVue = null // on quitte l'espace du bloc : plus d'unité à suivre
      this.mode = 'orbital'
    })
    this.busy = false
  }

  // ---------------------------------------------------------------- orbital → surface

  // task 30 Fix A: "on se retrouve très souvent le nez dans la paroi quand on
  // passe au zoom inférieur" — every dive/refine arrival used to land the
  // camera at a FIXED close standoff (~26 world units: position(0,18,19)
  // against target(0,-0.3,0)) regardless of how tall the just-loaded patch's
  // OWN relief is, so a steep peak near the block centre could easily sit
  // taller than that fixed height. Land at the FAR end of
  // hooks.surfaceMaxDistance() instead — the same distance the "frame the
  // whole slab" comment on that hook already documents as safe: the block's
  // own world footprint (TERRAIN_SIZE) never changes size across zoom tiers,
  // only what it REPRESENTS does, so "farthest for this zoom" and "farthest,
  // full stop" are the same number. Same viewing angle as the old fixed
  // pose (_ARRIVAL_DIR), just farther back along it, so the framing doesn't
  // look different — only safer. A cheap terrain-clearance guard on top:
  // sample the ground height directly under the landing target and refuse
  // to land below it (+ margin) — a formality at ~94% of
  // surfaceMaxDistance() (that standoff already clears anything this app's
  // ══════════ LES BUTÉES DE LA CAMÉRA — UN SEUL SITE (Tâche 1b, Étape 3) ════
  //
  // ⚠️ `controls.minDistance` ÉTAIT ÉCRIT À QUATRE ENDROITS : `enterOrbit`,
  // `_dive`, `_loadDive` et `main.js` (la pose initiale). Deux littéraux `6` et
  // une formule qui portait la porte de plongée. Ici, un seul site, et les deux
  // valeurs viennent de `loi-altitude.js` — donc le test les voit.
  //
  // ⚠️ ELLES NE FUSIONNENT PAS, ET CE N'EST PAS UN RENONCEMENT : en surface le
  // plancher est une distance à la CIBLE sur un bloc de 56 unités ; en orbite,
  // une distance au CENTRE d'une sphère de rayon `R_GLOBE`. Une seule valeur
  // suppose un seul monde — c'est l'Étape 2, et elle n'est pas faite.
  _poseButees(mode) {
    const c = this.controls
    if (mode === 'orbital') {
      c.minDistance = distanceMinOrbitale({ rayonGlobe: R_GLOBE, metresParUnite: ORBITAL_M_PER_UNIT })
      c.maxDistance = R_GLOBE + MAX_ALT_M / ORBITAL_M_PER_UNIT
    } else {
      c.minDistance = DISTANCE_MIN_SURFACE
      c.maxDistance = this.hooks.surfaceMaxDistance()
    }
  }

  // L'ALTITUDE QUI DÉCIDE DU CADRAGE — règle R1 du plan.
  //
  // ⚠️ CE N'EST PAS `this.altM`, ET LA DIFFÉRENCE EST LA RÈGLE ELLE-MÊME.
  // `this.altM` est ce que l'ALTIMÈTRE affiche : en surface il porte
  // `dem.meanM` (dérivé du terrain chargé, donc lissé) et l'exagération
  // verticale. Les deux sont interdits à une décision de cadrage — le premier
  // par R1 textuellement, le second parce que c'est un curseur d'affichage :
  // bouger l'exagération déplacerait la porte orbitale.
  //
  // Sans le hook (banc de test, source procédurale) on retombe sur l'altimètre,
  // qui est alors la seule grandeur disponible.
  _altitudeCadrageM() {
    return this.hooks.surfaceCamAltCadrageM?.() ?? this.hooks.surfaceCamAltMeters()
  }

  // ══════════ LE NIVEAU DE LA PLONGÉE — DÉDUIT, PLUS LU DANS UNE TABLE ══════
  //
  // ⚠️ C'EST LE CŒUR DE LA TÂCHE 1b. `_dive` posait la caméra à une distance
  // FIXE (`distanceArrivee`, 141 unités) quelle que soit l'altitude quittée :
  // mesuré à la Tâche 1a, 1 600,0 km → 906,6 km d'une image à l'autre, ÷1,765.
  // C'était le dernier des onze sauts du profil de descente.
  //
  // Le geste est celui de la Tâche 2 bis, transposé : on ne pose plus la caméra
  // pour subir l'altitude qui en sort, on part de l'ALTITUDE. La plongée ayant
  // DEUX inconnues (le niveau et la distance), `niveauDePlongee` les résout
  // ensemble — le niveau le plus fin dont la distance tient sous le plafond.
  //
  // `zoomImpose` : un zoom DÉSIGNÉ par l'utilisateur (clic sur le globe, cadrage
  // GPX de `flyTo`) reste imposé. Le geste choisit un cadrage, il ne le déduit
  // pas — et sa distance est alors bornée, donc le saut peut subsister. C'est
  // assumé et écrit dans le plan.
  _niveauDePlongee(altM, zoomImpose = null) {
    const echelleAuZoom = this.hooks.echelleVerticaleAuZoom
    const zoomFin = this.hooks.getFineZoom()
    // Le geste qui DÉSIGNE garde son niveau — clic sur le globe, cadrage GPX.
    if (zoomImpose != null) return { zoom: zoomImpose, distanceCible: null }
    // ⛔ **PLUS DE TABLE SOUS LE DRAPEAU.** `DIVE_TIERS` posait NEUF paliers
    // d'altitude à la main ; ici le niveau se déduit de l'emprise, et la porte
    // orbitale devient géométrique.
    //
    // ⚠️ **ET IL PASSE AVANT LA GARDE D'`echelleVerticaleAuZoom` — TROUVÉ PAR LE
    // BANC, PAS PAR LA RELECTURE.** Cette branche-ci ne lit PAS l'échelle
    // verticale (c'est tout son objet : l'exagération n'entre plus dans la
    // traversée). La laisser sous une garde qui exige un crochet qu'elle
    // n'emploie pas la rendait muette dès qu'il manquait — et le repli était le
    // ZOOM FIN, c'est-à-dire une plongée à z15 depuis 1 600 km.
    if (this._continu()) {
      const n = this._niveauDArrivee(altM)
      if (n) return { zoom: n.zoom, distanceCible: n.distanceCible }
    }
    if (typeof echelleAuZoom !== 'function' || !(altM > 0)) {
      // pas d'échelle à lire : on retombe sur la pose d'arrivée d'avant, jamais
      // sur une distance inventée (même garde que `_rescale`).
      return { zoom: zoomFin, distanceCible: null }
    }
    return niveauDePlongee({
      altM,
      echelleAuZoom,
      zoomMax: zoomFin,
      distanceMin: DISTANCE_MIN_SURFACE,
      distanceMax: this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE,
    })
  }

  // relief produces) but a real guarantee rather than an assumption.
  _arrivalPose(lieu = null) {
    const dist = distanceArrivee(this.hooks.surfaceMaxDistance()) // stay under the hard cap so controls.update() below doesn't immediately re-clamp it
    const target = this._cibleVisee(lieu)
    const pos = _ARRIVAL_DIR.clone().multiplyScalar(dist)
    const minY = this._solSous(target) + 3 // clearance margin, world units
    if (pos.y < minY) pos.y = minY
    return { pos, target }
  }

  // LA POSE D'ARRIVÉE DE LA PLONGÉE — celle qui CONSERVE l'altitude.
  //
  // ⚠️ L'ÉCHELLE SE LIT APRÈS LE CHARGEMENT, exactement comme `_rescale` le
  // fait depuis la Tâche 2 bis. `_niveauDePlongee` a choisi le niveau sur une
  // ESTIMATION (l'emprise théorique du zoom au lat/lon demandé) ; le bloc réel
  // est calé sur la grille de tuiles et son emprise en diffère un peu. La
  // distance, elle, se calcule sur l'échelle VRAIE — sinon on rendrait un saut
  // de quelques pour cent au lieu d'un saut de ×1,765.
  //
  // Sans le hook (banc de test, source procédurale) : la pose fixe d'avant,
  // jamais une distance inventée.
  _posePlongee(arrival, altDepartM) {
    // ⛔ **LE DÉPÔT CONSERVAIT L'AUTRE ALTITUDE, ET `loi-altitude.js` LE SAVAIT** :
    // *« le CHAMP VISUEL, lui, saute encore d'un facteur exagération(z) […] C'est
    // une question, pas un oubli. »* Sous `?terre=unique` la question a une
    // réponse, parce qu'il n'y a plus deux mondes à raccorder mais un seul : de
    // l'autre côté de la traversée c'est la MÊME planète, donc c'est l'altitude
    // de FOND qui doit être continue. **Le saut valait ×2,5 à ×5 selon le palier
    // d'exagération, et il vaudrait encore ×2 sous D10.**
    if (this._continu()) {
      const d = distancePourAltitudeFond({
        altM: altDepartM,
        extentMeters: this.hooks.empriseBlocM?.(),
        span: this.hooks.coteBloc?.(),
        pente: _ARRIVAL_DIR.y,
        yCible: arrival.target.y,
      })
      if (d != null) {
        const dist = THREE.MathUtils.clamp(
          d,
          this.controls.minDistance,
          this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
        )
        const p = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
        const seuil = this._solSous(arrival.target) + 3 // même garde de dégagement
        if (p.y < seuil) p.y = seuil
        return p
      }
    }
    const echelleV = this.hooks.echelleVerticaleBloc?.() ?? null
    if (!(echelleV > 0) || !(altDepartM > 0)) return arrival.pos
    const brute = distancePourAltitude({ altM: altDepartM, echelleV, yCible: arrival.target.y })
    const dist = THREE.MathUtils.clamp(
      brute,
      this.controls.minDistance,
      this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
    )
    const pos = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
    const minY = this._solSous(arrival.target) + 3 // même garde de dégagement qu'`_arrivalPose`
    if (pos.y < minY) pos.y = minY
    return pos
  }

  // La hauteur du sol sous un point visé — `-Infinity` sans le hook, ce qui
  // neutralise les gardes de dégagement au lieu de les faire mentir.
  _solSous(target) {
    return this.hooks.sampleGroundY ? this.hooks.sampleGroundY(target.x, target.z) : -Infinity
  }

  // OÙ LA CAMÉRA VISE EN ARRIVANT — et c'est ce qui a supprimé la dérive du
  // dézoome (Adrien : « je garde mon précédent point de vision central au
  // centre du dézoome »). Le POURQUOI complet, mesures comprises, est dans
  // escalier-zoom.js sous `viseeArrivee` : en résumé, viser le centre
  // géométrique du bloc faisait relire au cran suivant un lat/lon SNAPPÉ sur la
  // grille de tuiles, et l'écart s'accumulait cran après cran.
  //
  // Sans le hook (banc de test, source procédurale) on retombe exactement sur
  // l'ancienne pose : le centre du socle.
  _cibleVisee(lieu) {
    const p = lieu && this.hooks.viseeDuLieu ? this.hooks.viseeDuLieu(lieu.lat, lieu.lon) : null
    return new THREE.Vector3(p?.x ?? 0, Y_CIBLE, p?.z ?? 0)
  }

  // `lieu` : le lat/lon VOULU. Absent, on prend celui sous la caméra — c'est le
  // cas de la plongée à la molette, qui vise le centre de l'écran. Le clic sur
  // le globe, lui, en fournit un (voir plongeDepuisGlobe).
  async _dive(tier = DIVE_TIERS[0], lieu = null, { zoomImpose = false } = {}) {
    if (this.mode !== 'orbital' || this.busy) return
    this.busy = true
    this._resetZoom()
    // ⚠️ L'ALTITUDE QUITTÉE SE LIT AVANT TOUT LE RESTE : c'est elle que la pose
    // d'arrivée doit conserver. En orbite `this.altM` EST l'altitude
    // géométrique (`orbAlt × ORBITAL_M_PER_UNIT`), donc R1 est déjà satisfaite.
    const altDepartM = this.altM
    const { zoom } = this._niveauDePlongee(altDepartM, zoomImpose ? (tier.zoom ?? this.hooks.getFineZoom()) : null)
    const { lat, lon } = lieu ?? sphereToLatLon(this.camera.position)
    this.announce(`ACQUIRING SURFACE DATA — ${lat.toFixed(4)}, ${lon.toFixed(4)} · Z${zoom}`)
    this.controls.enabled = false
    try {
      await this.hooks.loadSurface(lat, lon, zoom)
    } catch {
      this.announce('SURFACE DATA UNAVAILABLE — HOLDING ORBIT')
      this.orbAltTarget = Math.max(tier.altM * 1.6, 60000) / ORBITAL_M_PER_UNIT
      // snap back above the dive gate NOW — the damped climb takes several
      // frames, during which a lingering sub-tier altitude would re-trigger
      // _dive() every frame and hammer the tile server with doomed requests
      this.orbAlt = Math.max(this.orbAlt, (tier.altM * 1.1) / ORBITAL_M_PER_UNIT)
      this._diveArmed = false // a fresh inward zoom is needed to retry
      this.controls.enabled = true
      this.busy = false
      return
    }

    await this._whiteout(() => {
      this.globe.setVisible(false)
      this.hooks.setSurfaceVisible(true)
      this.hooks.setEffectsEnabled(true)

      this.camera.far = this._surfCam.far
      // ⚠️ `camera.up` NE BASCULE PAS, ET LE PLAN SE TROMPAIT. Rejoué contre le
      // dépôt : `enterOrbit` écrit `camera.up.set(0, 1, 0)` lui aussi. Les deux
      // modes ont toujours eu le MÊME repère vertical — la ligne était un
      // no-op, elle disparaît. (Le repère de POSITION, lui, change bel et bien ;
      // c'est l'Étape 2, la frontière globe/terrain, et elle n'est pas faite.)
      const arrival = this._arrivalPose({ lat, lon })
      this.controls.target.copy(arrival.target)
      this._poseButees('surface') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.camera.position.copy(this._posePlongee(arrival, altDepartM))
      // ⚠️ **L'EMPRISE D'ARRIVÉE EST MÉMORISÉE ICI, ET SANS ÇA LA PLONGÉE SE
      // FERAIT CONVERTIR DEUX FOIS** : `_suivreEmprise` verrait passer l'emprise
      // du bloc quitté à celle du bloc d'arrivée et rejouerait un changement
      // d'unités que `_posePlongee` vient déjà d'appliquer.
      this._empriseVue = this.hooks.empriseBlocM?.() ?? null
      // `near` DÉRIVÉ, plus restauré : c'est la même loi qu'en orbite
      // (`planProche`), appliquée à la hauteur au-dessus du sol du bloc. Elle
      // sature à NEAR_MAX = 0,5 dès 2,5 unités de dégagement — c'est-à-dire
      // toujours, à la distance d'arrivée — donc la valeur est celle que
      // `_surfCam.near` reposait, mais elle est maintenant DÉDUITE.
      this.camera.near = planProche(this.camera.position.y - this._solSous(arrival.target))
      this.camera.updateProjectionMatrix()
      this.controls.maxPolarAngle = Math.PI * 0.49
      this.controls.rotateSpeed = 1 // orbital update scales it down to ~0.015
      this.controls.enableZoom = false // surface zoom is our inertial dolly
      this.controls.enablePan = true
      this.controls.enabled = true
      this.controls.update()
      this.mode = 'surface'
    })
    this.announce('FX ONLINE — SURFACE MODE ENGAGED')
    this.busy = false
  }

  // surface → surface: reload the patch two zoom steps finer, centered on
  // what the camera is looking at — the staircase down from a z8 dive
  async _refine() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getRefineTarget()
    if (!next) return // already at fine scale
    await this._rescale(next, 'REFINING')
  }

  // surface → surface the other way: widen the map two zoom steps before
  // handing over to orbit — every stop of the zoom-out shows a real map
  async _coarsen() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getCoarsenTarget()
    if (!next) return
    await this._rescale(next, 'WIDENING')
  }

  // LE CRAN DE L'ESCALIER DE SURFACE — ET IL NE TÉLÉPORTE PLUS.
  //
  // ✅ Adrien, 2026-08-20 : « on garde bien un zoom continu, exactement comme
  // Google Earth ou Google Maps. » v48 posait la caméra au POINT DE
  // PRÉSENTATION (maxDistance·0,97, le bloc entier cadré) à chaque traversée
  // d'étage : mesuré, cela faisait REMONTER la caméra de ×1,672 à ×2,154 pendant
  // que l'utilisateur zoomait — 685 623 m rendus à l'envers sur une descente de
  // 1 600 km, et 960 ms de fondu au blanc pour que ça ne se voie pas.
  //
  // Ce qui reste de v48, et c'était sa bonne moitié : **l'angle de vue de
  // l'utilisateur est gardé** (`prevDir`).
  //
  // Ce qui la remplace : **l'altitude MÉTRIQUE est conservée de part et d'autre
  // du cran.** Elle vaut `camY / échelle du bloc`, et l'échelle change pour
  // DEUX raisons à chaque cran — l'emprise du bloc est divisée par deux ET
  // l'exagération verticale change de palier (5 à z5, 4 à z6, 3,2 à z7, 2,8
  // ensuite). ⚠️ **Ne compenser que l'emprise laisserait trois crans
  // discontinus.** On lit donc l'échelle RÉELLE du bloc des deux côtés du
  // rechargement (`hooks.echelleVerticaleBloc`) : aucune constante recopiée,
  // aucun palier à tenir à jour ici.
  //
  // ⚠️ ET IL N'Y A PLUS DE FONDU AU BLANC. Le rideau n'était pas l'ornement du
  // saut, il était là parce que le saut était invisible autrement.
  async _rescale(next, verb) {
    const continu = this._continu()
    this.busy = true
    // ⛔ **`_resetZoom()` TUAIT L'ÉLAN À CHAQUE CRAN, ET C'EST LA MOITIÉ DE LA
    // SENSATION D'ACCROCHAGE.** Le glissé repartait de zéro de l'autre côté :
    // l'utilisateur relançait la molette à chaque niveau. Sous le drapeau,
    // l'élan et le compteur de budget TRAVERSENT — c'est `_franchirSiBesoin` qui
    // a déjà retranché le niveau franchi du compteur.
    if (!continu) this._resetZoom() // the new level starts its own scroll budget
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    const camYAvant = this.camera.position.y
    const echelleAvant = this.hooks.echelleVerticaleBloc?.() ?? null
    this.announce(`${verb} — ${next.lat.toFixed(4)}, ${next.lon.toFixed(4)} · Z${next.zoom}`)
    try {
      await this.hooks.loadSurface(next.lat, next.lon, next.zoom)
    } catch {
      this.announce(`${verb} FAILED — HOLDING SCALE`)
      this.busy = false
      return
    }
    const echelleApres = this.hooks.echelleVerticaleBloc?.() ?? null
    const arrival = this._arrivalPose(next)
    this.controls.target.copy(arrival.target)
    // ⚠️ **SOUS LE DRAPEAU, LA CONVERSION D'UNITÉS EST DÉJÀ FAITE (ou le sera à
    // cette ligne), ET ELLE NE PASSE PAS PAR `poseCranContinu`.** Voir
    // `_suivreEmprise` : l'invariant y est l'altitude de FOND, donc le rapport
    // des EMPRISES, alors que `poseCranContinu` prend le rapport des échelles
    // VERTICALES — lequel porte l'exagération, et c'est LUI l'accrochage (jusqu'à
    // ×2 au cran z4 → z5 avec la table de paliers du dépôt).
    if (continu) { this._suivreEmprise(); this.busy = false; return }
    const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
    // Sans le hook (banc de test, source procédurale), il n'y a pas d'échelle à
    // comparer : on retombe sur la pose d'arrivée, qui est le comportement
    // d'avant l'escalier continu — jamais sur une distance inventée.
    const facteur = echelleAvant > 0 && echelleApres > 0 ? echelleApres / echelleAvant : null
    const dist =
      facteur && Math.abs(dir.y) > 1e-3
        ? poseCranContinu({ camY: camYAvant, pente: dir.y, facteurEchelle: facteur, yCible: arrival.target.y })
            .distanceCible
        : arrival.pos.distanceTo(arrival.target)
    const borne = THREE.MathUtils.clamp(dist, this.controls.minDistance, this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE)
    const pos = this.controls.target.clone().addScaledVector(dir, borne)
    // même garde de dégagement sol que _arrivalPose
    const groundY = this.hooks.sampleGroundY ? this.hooks.sampleGroundY(arrival.target.x, arrival.target.z) : -Infinity
    if (pos.y < groundY + 3) pos.y = groundY + 3
    this.camera.position.copy(pos)
    this.controls.update()
    this.busy = false
  }

  // ---------------------------------------------------------------- travel

  // Great-circle glide to lat/lon, ending below the dive threshold so the
  // normal engagement takes over. One code path for paste, search and GPX.
  // `zoom` pins the landing scale (GPX framing); null lands on the fine zoom.
  // Returns false when navigation is already busy (dive/transition running).
  async flyTo(lat, lon, zoom = null) {
    if (this.busy) return false
    if (this.mode === 'surface') {
      await this.enterOrbit(1200000) // pop out high enough to see the arc
    }
    const fromDir = this.camera.position.clone().normalize()
    const toDir = latLonToSphere(lat, lon, 1)
    const angle = fromDir.angleTo(toDir)
    const cruise = Math.max(this.orbAlt, Math.min((angle / Math.PI) * 14000000, 12000000) / ORBITAL_M_PER_UNIT)
    this.travel = {
      t: 0,
      duration: THREE.MathUtils.clamp(2.5 + (angle / Math.PI) * 7, 2.5, 9),
      fromDir,
      toDir,
      fromAlt: this.orbAlt,
      cruise,
      endAlt: (DIVE_ALT_M * 0.92) / ORBITAL_M_PER_UNIT,
      zoom,
    }
    this.controls.enabled = false
    return true
  }

  _updateTravel(dt) {
    const tr = this.travel
    tr.t = Math.min(1, tr.t + dt / tr.duration)
    const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - (-2 * tr.t + 2) ** 3 / 2
    const dir = tr.fromDir.clone().lerp(tr.toDir, e).normalize() // fine for < π arcs
    const up = THREE.MathUtils.smoothstep(tr.t, 0, 0.35)
    const down = THREE.MathUtils.smoothstep(tr.t, 0.55, 1)
    const alt = THREE.MathUtils.lerp(THREE.MathUtils.lerp(tr.fromAlt, tr.cruise, up), tr.endAlt, down)
    this.orbAlt = this.orbAltTarget = alt
    this.camera.position.copy(dir).multiplyScalar(R_GLOBE + alt)
    this.camera.lookAt(0, 0, 0)
    if (tr.t >= 1) {
      this.travel = null
      this.controls.enabled = true
      this.controls.update()
      // a glide lands on its pinned zoom (GPX framing) or the FINE scale,
      // explicitly (dive arming is for manual zooms only)
      this._dive(tr.zoom ? { altM: DIVE_ALT_M, zoom: tr.zoom } : DIVE_TIERS[0], null, { zoomImpose: !!tr.zoom })
    }
  }

  // ---------------------------------------------------------------- public nav
  // Explicit navigation the UI drives (vertical zoom stepper + click-to-dive).
  // All reuse the tuned staircase internals — no new zoom behaviour, just new
  // triggers besides the wheel.

  // one level FINER (toward more detail). Surface: refine centred on the view.
  // Orbital: nudge the altitude target inward and arm the dive (the settle→dive
  // logic then lands at the matching scale — same path as a wheel-in notch).
  stepFiner() {
    this.cranZoom(1)
  }

  // one level WIDER. Surface: coarsen, or open the orbit gate once past z4.
  // Orbital: nudge the altitude target outward (toward the planet).
  stepWider() {
    this.cranZoom(-1)
  }

  // ══════════ CLIQUER SUR LE GLOBE ══════════════════════════════════════════
  //
  // Adrien : « Quand je suis en orbite, cliquer me fait zoomer sur la zone sur
  // laquelle je clique, exactement à l'endroit où j'ai cliqué, qui sera au
  // centre. J'arrive en Z3. »
  //
  // ⚠️ CE N'EST PAS LA PLONGÉE DE LA MOLETTE AVEC UN AUTRE DÉCLENCHEUR. Celle-ci
  // vise `sphereToLatLon(camera.position)` — le point sous la CAMÉRA, c'est-à-dire
  // le milieu de l'écran. Elle est juste tant que le geste est un zoom : on
  // plonge là où on regarde. Elle est fausse pour un clic, où le geste DÉSIGNE :
  // cliquer l'Islande au bord du disque aurait posé le bloc au centre de
  // l'Atlantique. Le lat/lon vient donc du rayon (main.js), pas de la caméra.
  //
  // Le palier : celui de l'altitude, et le plus large qui reste quand on est
  // au-dessus de tous (voir `palierDeClic`) — c'est-à-dire z6 dès qu'on regarde
  // vraiment la planète, le « Z3 » d'Adrien.
  plongeDepuisGlobe(lat, lon) {
    if (this.busy || this.travel || this.mode !== 'orbital') return false
    // embed « zone de test » : le visiteur ne franchit aucun niveau, ni à la
    // molette ni au clic. Sans cette ligne, le clic serait devenu la porte
    // dérobée d'un verrou que _zoomGesture tient déjà.
    if (this.locked) return false
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
    this._diveArmed = false // le clic consomme l'intention ; la molette ne doit pas re-plonger derrière
    this._dive(palierDeClic(DIVE_TIERS, this.altM) ?? DIVE_TIERS[0], { lat, lon }, { zoomImpose: true })
    return true
  }

  // Click-to-dive, two beats (Adrien): first EASE IN toward the clicked point
  // by 30% of the remaining zoom distance (a "lean toward it"), THEN load the
  // finer level centred there. `target.point` is the clicked world position.
  diveTo(target) {
    if (this.busy || this.travel || this._diveTween || this.mode !== 'surface' || !target) return
    this._resetZoom() // cancel any coasting zoom; the dive owns the camera now
    const from = this.camera.position.clone()
    const fromT = this.controls.target.clone()
    const dist = from.distanceTo(fromT)
    const lean = 0.3 * Math.max(0, dist - this.controls.minDistance)
    const dir = from.clone().sub(fromT).normalize()
    const toT = target.point ? target.point.clone() : fromT.clone()
    const toPos = toT.clone().addScaledVector(dir, Math.max(this.controls.minDistance, dist - lean))
    this.controls.enabled = false // the tween owns the camera until it loads
    this._diveTween = { t: 0, dur: 0.42, from, fromT, toPos, toT, target }
  }

  // second beat: load the finer level, centred on the clicked point, landing
  // near the far end of the new level (whole block in frame) while KEEPING the
  // current view axis — "dézoomé quasiment au max de ce niveau, même axe de vue".
  async _loadDive(target) {
    if (this.busy || this.mode !== 'surface' || !target) return
    this.busy = true
    this._resetZoom()
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    this.announce(`DIVING — ${target.lat.toFixed(4)}, ${target.lon.toFixed(4)} · Z${target.zoom}`)
    try {
      await this.hooks.loadSurface(target.lat, target.lon, target.zoom)
    } catch {
      this.announce('DIVE FAILED — HOLDING SCALE')
      this.busy = false
      return
    }
    await this._whiteout(() => {
      // le point cliqué EST ce que la caméra vise — pas le centre du bloc, qui
      // en est décalé de tout ce que le calage sur la grille de tuiles a pris
      const tgt = this._cibleVisee(target)
      const dist = distancePresentation(this.hooks.surfaceMaxDistance()) // distance de la vue iso 1 (point de présentation)
      const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
      const pos = tgt.clone().addScaledVector(dir, dist)
      if (pos.y < this._solSous(tgt) + 3) pos.y = this._solSous(tgt) + 3 // same clearance guard as _arrivalPose
      this.camera.position.copy(pos)
      this.controls.target.copy(tgt)
      this._poseButees('surface') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
      this.controls.update()
    })
    this.busy = false
  }

  // one frame of the inertial surface dolly: scale the distance by the coasting
  // velocity (log-space, so a notch multiplies distance), pivoting on the point
  // under the cursor (zoom-toward-cursor), then decay the velocity. Steps the
  // staircase when the glide crosses 70% of the level's travel in its direction.
  _resetZoom() {
    this._zoomVel = 0
    this._levelZoom = 0
  }

  // LE BUDGET DE ZOOM DÉPENSÉ DANS LE NIVEAU — le pilote de l'exagération
  // continue (Tâche E, §4 bis de `monde/exageration-continue.js`).
  //
  // ⚠️ **NÉGATIF EN ZOOM AVANT**, nul au repos et à chaque cran, borné à
  // `[-STEP_IN, STEP_OUT]` par `_applyZoom`. C'est la SEULE grandeur de cette
  // classe que le repositionnement du cran ne contamine pas : `_rescale`
  // l'écrase par `_resetZoom()` AVANT d'appeler `poseCranContinu`, dont le
  // facteur d'échelle porte le rapport des exagérations. Un accesseur plutôt
  // qu'une lecture directe du champ privé, pour que le lien soit cherchable.
  zoomNiveau() {
    return this._levelZoom
  }

  _applyZoom(dt) {
    const c = this.controls
    const cam = this.camera
    const min = c.minDistance
    const max = c.maxDistance
    const dist = c.getDistance()
    let factor = Math.exp(-this._zoomVel * dt) // vel > 0 (zoom in) → factor < 1
    let newDist = THREE.MathUtils.clamp(dist * factor, min, max)
    // clamp to the level's own zoom budget: the glide stops at the zone limit
    // (Adrien) instead of running to the physical near/far stop
    let dLog = Math.log(Math.max(newDist, 1e-6) / Math.max(dist, 1e-6))
    // ⚠️ **SOUS LE DRAPEAU LE BUDGET EST UN COMPTEUR, PAS UNE BUTÉE — Tâche M.**
    // Le glissé n'est plus borné : il court, et c'est `_franchirSiBesoin` (au bas
    // de cette fonction) qui change de niveau quand le compteur vaut un niveau
    // plein. Sans le drapeau, les deux lignes d'avant, au bit près.
    if (!this._continu()) {
      if (this._levelZoom + dLog < -BUDGET_NIVEAU) { dLog = -BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
      else if (this._levelZoom + dLog > BUDGET_NIVEAU) { dLog = BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
    }
    this._levelZoom += dLog
    newDist = dist * Math.exp(dLog)
    factor = newDist / dist
    const P = this._zoomPivot
    if (P && Math.abs(factor - 1) > 1e-6) {
      // scale the scene about the pivot so that point stays put on screen
      cam.position.set(P.x + (cam.position.x - P.x) * factor, P.y + (cam.position.y - P.y) * factor, P.z + (cam.position.z - P.z) * factor)
      c.target.set(P.x + (c.target.x - P.x) * factor, P.y + (c.target.y - P.y) * factor, P.z + (c.target.z - P.z) * factor)
    } else {
      _zoomDir.copy(cam.position).sub(c.target).normalize()
      cam.position.copy(c.target).addScaledVector(_zoomDir, newDist)
    }
    c.update()
    this._zoomVel *= Math.exp(-dt / ZOOM_TAU) // the coast
    // clamp at the zone limit and spend the momentum there — the glide never
    // crosses a level; a fresh re-scroll at the limit does (see the wheel handler)
    if (newDist <= min + 1e-3 || newDist >= max - 1e-3) this._zoomVel = 0
    if (Math.abs(this._zoomVel) < ZOOM_STOP) this._zoomVel = 0 // coast spent
    // ⚠️ **APRÈS LE DÉPLACEMENT, PAS AVANT.** Le franchissement lit le compteur
    // que cette image vient d'incrémenter ; le placer plus haut le ferait décider
    // sur l'image précédente — c'est la « sonde lue APRÈS la fonction » du §0,
    // dans l'autre sens.
    this._franchirSiBesoin()
  }

  // ---------------------------------------------------------------- per-frame

  update(dt) {
    // ⚠️ **EN TÊTE, ET `main.js` LE JUSTIFIE** : `modes.update(dt)` court AVANT
    // `majSeuilSocle()` et `majCameraFond()`. Convertir ici, c'est convertir
    // avant que quiconque ne lise l'altitude de cette image — donc jamais l'image
    // à moitié d'altitude qui a produit onze bascules du seuil.
    this._suivreEmprise()
    if (this.mode === 'orbital') {
      if (this.travel) {
        this._updateTravel(dt)
      } else if (!this.busy) {
        // damped proportional zoom + altitude-scaled rotation
        this.orbAlt = THREE.MathUtils.damp(this.orbAlt, this.orbAltTarget, 6, dt)
        const dir = this.camera.position.clone().normalize()
        this.camera.position.copy(dir).multiplyScalar(R_GLOBE + this.orbAlt)
        this.controls.rotateSpeed = THREE.MathUtils.clamp((this.orbAlt / R_GLOBE) * 1.4, 0.015, 1)
        this.controls.update()
      }

      // keep the near plane tight to the ground so low passes don't clip.
      // ⚠️ MÊME LOI QU'EN SURFACE depuis la Tâche 1b : `planProche` vit dans
      // `loi-altitude.js` et les deux modes l'appellent. Elle sature à 0,5,
      // c'est-à-dire exactement la valeur que le mode surface posait en dur.
      const near = planProche(this.orbAlt)
      if (Math.abs(near - this.camera.near) > near * 0.2) {
        this.camera.near = near
        this.camera.updateProjectionMatrix()
      }

      this.altM = altitudeOrbitaleM(this.orbAlt, ORBITAL_M_PER_UNIT)
      if (!this.busy && !this.travel && this._diveArmed && this._continu()) {
        // ⛔ **PLUS DE TABLE, PLUS D'ATTENTE DE STABILISATION.** Le dépôt
        // attendait que le zoom se POSE (`settled`, à 6 % près) puis lisait le
        // palier dans `DIVE_TIERS` : deux paliers pour un seul geste. Ici la
        // porte est GÉOMÉTRIQUE — on traverse dès qu'un niveau de bloc peut
        // accueillir l'altitude sous le plafond de la caméra — et la traversée
        // conserve l'altitude de fond, donc elle ne se voit pas.
        const n = this._niveauDArrivee(this.altM)
        if (n && n.borne !== 'haut') {
          this._diveArmed = false
          this._dive({ altM: DIVE_ALT_M, zoom: n.zoom })
        }
      } else if (!this.busy && !this.travel && this._diveArmed) {
        // dive when an inward zoom SETTLES under a tier — never intercept a
        // fast zoom mid-flight; the landing scale matches where you stopped
        const settled = Math.abs(this.orbAlt - this.orbAltTarget) < this.orbAltTarget * 0.06
        if (settled) {
          // pick the tier from the TARGET altitude (where the user chose to
          // stop), not the still-damping orbAlt — settle fires up to 6% away,
          // enough to cross a tier boundary and land one scale too coarse
          // (e.g. wheel stop at 7 700 m read as 8 160 m → z11 instead of FINE)
          const tier = pickDiveTier(this.orbAltTarget * ORBITAL_M_PER_UNIT)
          if (tier) {
            this._diveArmed = false
            this._dive(tier)
          }
        }
      }
    } else {
      // surface inertial dolly — the long élan (see the wheel handler)
      // ⚠️ **SOUS LE DRAPEAU, LE GLISSÉ SURVIT AU CHARGEMENT — ET C'EST LA
      // TROISIÈME MOITIÉ DU CRAN.** `busy` gèle le zoom pendant tout le
      // `loadSurface` du franchissement : la molette ne répond plus, puis la vue
      // repart. C'est une PAUSE, et Adrien n'en veut pas. `_franchirSiBesoin` se
      // garde lui-même contre un second franchissement pendant celui-ci.
      if (!this._diveTween && (!this.busy || this._continu()) && Math.abs(this._zoomVel) > ZOOM_STOP) this._applyZoom(dt)
      // click-to-dive lean-in tween (first beat): ease 30% toward the point,
      // then load the finer level (see diveTo). ease-in-out quad.
      if (this._diveTween && !this.busy) {
        const dv = this._diveTween
        dv.t = Math.min(1, dv.t + dt / dv.dur)
        const e = dv.t < 0.5 ? 2 * dv.t * dv.t : 1 - ((-2 * dv.t + 2) ** 2) / 2
        this.camera.position.lerpVectors(dv.from, dv.toPos, e)
        this.controls.target.lerpVectors(dv.fromT, dv.toT, e)
        this.controls.update()
        if (dv.t >= 1) {
          this._diveTween = null
          this.controls.enabled = true
          this._loadDive(dv.target)
        }
      }
      this.altM = this.hooks.surfaceCamAltMeters()
    }

    this.altModeEl.textContent = this.mode === 'orbital' ? 'ORBITAL' : 'SURFACE'
    this.altValueEl.textContent =
      this.altM >= 100000
        ? `${(this.altM / 1000).toFixed(0)} km`
        : this.altM >= 10000
          ? `${(this.altM / 1000).toFixed(1)} km`
          : `${Math.max(0, Math.round(this.altM))} m`
  }
}

const _zoomDir = new THREE.Vector3()
