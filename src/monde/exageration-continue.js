// L'EXAGÉRATION VERTICALE CONTINUE — DÉCISION 14, ET SON PARTAGE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ **CE FICHIER EST UN DÉMÉNAGEMENT, PAS UNE RÉÉCRITURE.** Les §6, §7 et §8
// de `fenetre-bornee.js` (Tâche 6) vivaient là-bas ; ils vivent ici depuis la
// Tâche 6 bis, **au caractère près**, et `fenetre-bornee.js` les ré-exporte —
// ses 29 tests passent sans qu'une ligne y change.
//
// ⚠️ **ET LA RAISON N'EST PAS COSMÉTIQUE : C'EST UN CYCLE D'IMPORT.**
// `fenetre-bornee.js` importe `TERRAIN_SIZE` de `../terrain.js`. Brancher les
// douze lecteurs de l'exagération — dont **cinq sont dans `terrain.js`** —
// aurait fermé la boucle `terrain.js → fenetre-bornee.js → terrain.js`, et
// `export const COTE_MONDE = TERRAIN_SIZE` se serait évalué dans la zone morte
// de la liaison : **`ReferenceError` au chargement du module, en production
// seulement**, invisible aux tests qui importent `fenetre-bornee.js` en
// premier. **Ce fichier n'importe RIEN.** C'est sa seule règle, et elle est
// gardée par un test.
//
// ── CE QUE LA DÉCISION 14 DIT, MOT POUR MOT ────────────────────────────────
//
// Adrien, le 2026-08-20 : « **mêmes valeurs aux mêmes altitudes, interpolées
// au lieu de sauter** ». La table d'aujourd'hui est indexée par les NIVEAUX DE
// ZOOM, c'est-à-dire par la chose que le pivot supprime.
//
// ⚠️ **LES SURCHARGES D'ADRIEN DOIVENT SURVIVRE** : `localStorage` sous
// `monolith.zoomExag` (`main.js:3130-3138`). La courbe passe par les ancres
// **et** par les surcharges — `surchargesStockees` les lit, `courbeExageration`
// les prend comme ancres. Les retirer casserait un réglage qu'il utilise.
//
// ── ⚠️ LE PIÈGE QUI A FAILLI ÊTRE POSÉ ICI : LE POINT FIXE ─────────────────
//
// La première rédaction pilotait la courbe par `altitudeCadrageM()`
// (`main.js:3545`). **Elle divise par `echelleBloc()`, qui CONTIENT
// l'exagération** : `exag → altitude → zoom → exag` est alors une boucle
// fermée. Gain mesuré entre z4 et z5, où la courbe monte de 2,5 à 5 :
//
//     d(exag)/d(exag) = courbe'(z) / (ln2 · exag) ≈ 3,75 / (0,693 × 3,75) = 1,44
//
// **1,44 > 1 : la boucle DIVERGE.** C'est exactement le point fixe que le §2 de
// `/threejs-optimisation` décrit (« tout budget de la forme capacité − occupé »),
// et il ne se serait vu qu'à l'écran, en oscillation.
//
// **La parade, et elle est géométrique :** on pilote par une grandeur
// **HORIZONTALE**, que l'exagération verticale ne touche pas — la largeur de sol
// visible. `zoomCadrage` ci-dessous ne lit jamais l'exagération.

// ══════════ LES CONSTANTES, ET LEUR SOURCE ══════════════════════════════════

/** `BASE_EXAG` — `main.js:3114`. */
export const EXAG_BASE = 2.8

/** `ZOOM_EXAG_DEFAULTS` — `main.js:3129`. ⚠️ Recopié : `main.js` ne l'exporte pas. */
export const EXAG_ANCRES = { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 }

/** `ZOOM_EXAG_KEY` — `main.js:3130`. Les surcharges d'Adrien vivent là. */
export const CLE_EXAG = 'monolith.zoomExag'

/** Le zoom le plus profond que la courbe ancre. `MAX_Z` de `globe.js` vaut 15. */
export const ZOOM_EXAG_MAX = 15

/** `params.fov` — `main.js:264`, VERTICAL (le champ de three.js). */
export const FOV_DEG = 30

/**
 * La fraction de la HAUTEUR de l'image qu'un bloc occupe à l'altitude de
 * référence — `seuil-socle.js`. `SEUIL_NAISSANCE_M` en est dérivé, et c'est ce
 * qui fait que `zoomDepuisAltitude(SEUIL_NAISSANCE_M, 45°)` rend exactement
 * `ZOOM_SOCLE`.
 */
export const FRACTION_REFERENCE = 0.6

/** Mètres par pixel à l'équateur au zoom 0 — `landmarks.js`, `dem.js`. */
export const MPP_Z0 = 156543.03392

/** `BLOCK_GROUND_PX` — `landmarks.js:15`, 3 tuiles de 256. */
export const PX_BLOC = 768

const D2R = Math.PI / 180

// ══════════ 1. LA TABLE D'AUJOURD'HUI, EN ESCALIER ══════════════════════════

/**
 * La table d'exagération d'AUJOURD'HUI, surcharges comprises, en fonction en
 * escalier — celle que la courbe doit traverser.
 *
 * ⚠️ **C'est `exagForZoom` de `main.js:3138`, à la ligne près** :
 * `surcharges[z] ?? ZOOM_EXAG_DEFAULTS[z] ?? BASE_EXAG`.
 */
export function exagPalier (zoom, { surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE } = {}) {
  const z = Math.round(zoom)
  const s = surcharges?.[z]
  if (Number.isFinite(s)) return s
  const a = ancres?.[z]
  return Number.isFinite(a) ? a : base
}

// ══════════ 2. LA COURBE — FRITSCH–CARLSON, SANS DÉPASSEMENT ════════════════

/**
 * Les pentes de Fritsch–Carlson : une interpolation cubique **monotone par
 * morceaux**, donc SANS DÉPASSEMENT.
 *
 * ⚠️ **POURQUOI PAS UN `smoothstep`, ET POURQUOI PAS DU LINÉAIRE.** Le linéaire
 * passe par les ancres mais casse la PENTE à chacune : la vitesse de
 * l'exagération saute, et c'est encore un cran, plus petit. Le `smoothstep`
 * annule la pente à chaque ancre — donc il rend un escalier ADOUCI, ce qui est
 * exactement ce que la décision 14 refuse. Fritsch–Carlson est C¹, passe
 * exactement par les ancres, et ne peut pas dépasser : entre 2,5 et 5 la courbe
 * reste dans [2,5 ; 5], ce qu'un Catmull-Rom nu ne garantit pas.
 *
 * ⚠️ **EXPORTÉE POUR LA TÂCHE K bis, ET C'EST POUR NE PAS L'ÉCRIRE DEUX FOIS.**
 * `src/monde/echelle-continue.js` a besoin de la MÊME cubique monotone pour son
 * échelle de couleur ; la recopier aurait fait deux Fritsch–Carlson à maintenir,
 * dont un sans la correction d'extremum ci-dessous — celle qu'un test a
 * attrapée. ⚠️ **Ce fichier, lui, n'importe toujours RIEN** : la règle porte sur
 * ce qu'il IMPORTE, pas sur qui le lit, et le test qui la garde le vérifie bien
 * dans ce sens-là.
 */
export function pentesMonotones (ys) {
  const m = ys.length
  const d = new Array(m - 1)
  for (let i = 0; i < m - 1; i++) d[i] = ys[i + 1] - ys[i] // pas = 1 zoom
  const p = new Array(m)
  p[0] = d[0]
  p[m - 1] = d[m - 2]
  for (let i = 1; i < m - 1; i++) p[i] = (d[i - 1] + d[i]) / 2
  // ⚠️ **L'ÉTAPE QUE J'AVAIS SAUTÉE, ET LE TEST L'A ATTRAPÉE** : à un EXTREMUM
  // local, la pente doit être annulée. Sans elle la courbe montait à **5,000746
  // à z = 5,001** — au-dessus de l'ancre la plus haute, alors qu'aucune ancre ne
  // le demande. Un relief plus haut que le palier le plus haut, pour un demi-
  // millième de zoom : invisible en lecture, et c'est exactement ce que le §0
  // veut dire par « une assertion se rejoue contre le dépôt ».
  for (let i = 1; i < m - 1; i++) if (d[i - 1] * d[i] <= 0) p[i] = 0
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) { p[i] = 0; p[i + 1] = 0; continue }
    const a = p[i] / d[i]
    const b = p[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      p[i] = t * a * d[i]
      p[i + 1] = t * b * d[i]
    }
  }
  return p
}

/**
 * Fabrique la courbe d'exagération continue.
 *
 * ⚠️ **ELLE PASSE EXACTEMENT PAR LES ANCRES**, surcharges comprises : à zoom
 * ENTIER elle rend la valeur d'aujourd'hui au bit près (test). C'est la
 * décision 14 mot pour mot — « mêmes valeurs aux mêmes altitudes, interpolées
 * au lieu de sauter ».
 *
 * @param {{surcharges?:object, ancres?:object, base?:number, zoomMax?:number}} [arg]
 * @returns {(zoom:number) => number}
 */
export function courbeExageration ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, zoomMax = ZOOM_EXAG_MAX } = {}) {
  const zMax = Math.max(1, Math.floor(zoomMax))
  const ys = new Array(zMax + 1)
  for (let z = 0; z <= zMax; z++) ys[z] = exagPalier(z, { surcharges, ancres, base })
  const p = pentesMonotones(ys)
  return (zoom) => {
    const z = Number(zoom)
    if (!Number.isFinite(z)) return base
    if (z <= 0) return ys[0]
    if (z >= zMax) return ys[zMax]
    const i = Math.floor(z)
    const t = z - i
    // Hermite cubique, pas = 1
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    return h00 * ys[i] + h10 * p[i] + h01 * ys[i + 1] + h11 * p[i + 1]
  }
}

/** La courbe par défaut, sans surcharge. Mémoïsée : elle ne dépend de rien. */
const COURBE_DEFAUT = courbeExageration()

/**
 * L'exagération verticale à un zoom RÉEL (non entier).
 *
 * ⚠️ Rebâtit la courbe si des surcharges sont données — c'est un coup de calcul
 * sur 16 valeurs, à faire au CHANGEMENT DE RÉGLAGE, pas par image. Le chemin par
 * image est `creerExagerationPartagee`, qui garde sa courbe.
 */
export function exagerationContinue (zoom, options = null) {
  if (!options) return COURBE_DEFAUT(zoom)
  return courbeExageration(options)(zoom)
}

// ══════════ 3. LE PONT ALTITUDE ↔ ZOOM ══════════════════════════════════════
//
// ⚠️ **DÉRIVÉ, PAS POSÉ.** La décision 14 dit « courbe continue de
// l'ALTITUDE », et les ancres sont indexées par ZOOM. Il faut donc une règle qui
// relie les deux, et une seule existe déjà dans ce dépôt : celle dont
// `seuil-socle.js` tire ses deux seuils — l'altitude à laquelle un bloc de zoom
// `z` occupe `FRACTION_REFERENCE` de la HAUTEUR de l'image.
//
//     largeur(z, lat) = 156543,03392 · cos(lat) · 768 / 2^z      (landmarks.js:22)
//     altitude        = largeur / (2 · fraction · tan(fov/2))    (seuil-socle.js:210)
//
// ⚠️ **CE CHOIX EST VÉRIFIABLE, ET IL EST VÉRIFIÉ** :
// `zoomDepuisAltitude(SEUIL_NAISSANCE_M, {lat: 45})` rend exactement
// `ZOOM_SOCLE = 13`. Ce n'est pas une coïncidence — c'est la même équation lue
// dans l'autre sens, et le test l'exige.

/** L'altitude à laquelle un bloc de zoom `z` occupe `fraction` de l'image. */
export function altitudeDepuisZoom (zoom, { lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const largeur = (MPP_Z0 * Math.cos(lat * D2R) * PX_BLOC) / 2 ** zoom
  return largeur / (2 * fraction * Math.tan((fovDeg * D2R) / 2))
}

/** L'inverse — le zoom RÉEL (non entier) que cette altitude désigne. */
export function zoomDepuisAltitude (altitudeM, { lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const alt = Number(altitudeM)
  if (!(alt > 0)) return ZOOM_EXAG_MAX
  const largeur = alt * 2 * fraction * Math.tan((fovDeg * D2R) / 2)
  return Math.log2((MPP_Z0 * Math.cos(lat * D2R) * PX_BLOC) / largeur)
}

// ══════════ 4. LE ZOOM DE CADRAGE — LE DEUXIÈME PILOTE, ET IL A ÉCHOUÉ ══════
//
// ⚠️ **CE QUI SUIT N'EST PLUS APPELÉ PAR AUCUN CHEMIN DE PRODUCTION. ON LE GARDE
// PARCE QUE C'EST LA MESURE, ET QU'ELLE VAUT MIEUX QU'UN COMMENTAIRE.** Le §4 de
// ce fichier a été écrit comme « la parade au point fixe » ; l'écran a dit non.
// Descente Z12 → Z4 sur la Réunion, valeur lue dans le cartouche « Relief » :
// **×2,8 à tous les crans**, au lieu de 3,2 / 4 / 5 / 2,5 (le tableau vit sous
// `exagContinueActive()`, `flags.js`). Le pilote NE DIVERGEAIT PAS — il GELAIT,
// et c'est le jumeau du défaut qu'il prétendait éviter.
//
// ⚠️ **LA CAUSE A ÉTÉ TROUVÉE ET REJOUÉE** (`test/exageration-globe.test.js`,
// ②b) : la boucle ne passe pas par la SIGNATURE de `zoomCadrage` — qui, elle,
// est bien propre — mais par la CAMÉRA. Au cran, `poseCranContinu`
// (`loi-altitude.js`) repose la caméra à `camY × facteurEchelle`, et
// `facteurEchelle` vaut `2 × exagAprès / exagAvant` : **la distance d'après-cran
// PORTE l'exagération.** Rejouée à la main, la suite s'écarte de la table dès le
// premier cran (5 au lieu de 2,5) puis se fige sur `EXAG_BASE` pour les six
// derniers. **Aucune grandeur tirée de la pose d'après-cran n'est propre** — ni
// la distance, ni `camY`, ni la distance horizontale.
//
// **Le pilote qui l'a remplacé est au §4 bis.** Celui-ci reste ici comme témoin
// mesuré, et ses tests (② à ⑤b de `test/fenetre-branchee.test.js`) avec lui.

/**
 * Le zoom RÉEL que la caméra cadre, **sans jamais lire l'exagération**.
 *
 * ⚠️ **C'EST LA PARADE AU POINT FIXE DÉCRIT EN TÊTE DE FICHIER.** La grandeur
 * pilote est la LARGEUR DE SOL VISIBLE, purement horizontale ; l'exagération
 * verticale ne la touche pas, donc la boucle est ouverte.
 *
 * **La dérivation, et elle fait tomber `fov` et `span` d'eux-mêmes :**
 *
 *     largeurVisible(m) = 2 · d · tan(fov/2) · extentMeters / span
 *     zoom métrique     = log2(mpp0 · cos(lat) · 768 / largeurVisible)
 *
 * Prise telle quelle, cette valeur vaut `z − 0,432` à la pose d'arrivée du bloc
 * `z` — donc la courbe rendrait une AUTRE valeur que la table d'Adrien au repos.
 * On la recale sur la pose d'arrivée (`distanceArrivee`, `loi-altitude.js:123`)
 * en ajoutant `log2(2 · dRef · tan(fov/2) / span)` : **`tan(fov/2)` et `span`
 * s'annulent exactement**, et il reste
 *
 *     zoomCadrage = log2( mpp0 · cos(lat) · 768 · dRef / (d · extentMeters) )
 *
 * ⚠️ **CE N'EST DONC PAS UNE CONSTANTE POSÉE À L'INSTINCT** (règle 1 du §0) :
 * c'est une identité, et le test l'exige au bit près — à `d = dRef` et
 * `extentMeters = blockExtentMeters(z, lat)`, la fonction rend **exactement
 * `z`**, pour z de 3 à 15. Autrement dit : **au repos, Adrien retrouve sa
 * table ; entre deux repos, la valeur glisse au lieu de sauter.**
 *
 * @param {object} arg
 * @param {number} arg.distance distance caméra → cible, en unités monde
 * @param {number} arg.distanceReference la pose d'arrivée, en unités monde
 * @param {number} arg.extentMeters l'emprise au sol du bloc chargé, en mètres
 * @param {number} [arg.lat] latitude du centre
 * @returns {number} le zoom réel, ou `NaN` si une entrée est inutilisable
 */
export function zoomCadrage ({ distance, distanceReference, extentMeters, lat = 45 } = {}) {
  const d = Number(distance)
  const dRef = Number(distanceReference)
  const ext = Number(extentMeters)
  if (!(d > 0) || !(dRef > 0) || !(ext > 0)) return NaN
  return Math.log2((MPP_Z0 * Math.cos(lat * D2R) * PX_BLOC * dRef) / (d * ext))
}

// ══════════ 4 bis. LE CRAN ET SA FRACTION — LE PILOTE RETENU ════════════════
//
// **`zc = demZoom + f`**, et les deux termes sont choisis pour ce qu'ils ne
// peuvent PAS faire.
//
//   · **`demZoom` ne peut pas geler.** C'est le cran de l'escalier, un entier
//     d'état, posé par `pasEscalier` / `niveauDePlongee` — jamais calculé depuis
//     le terrain ni depuis l'exagération. Il change de 1 à chaque cran, donc
//     `zc` aussi : le défaut du §4 (une valeur constante sur dix crans) est
//     impossible par construction.
//   · **`f` ne peut pas diverger.** C'est `-_levelZoom / STEP_IN`
//     (`modes.js:222`), le budget de zoom DÉPENSÉ DANS LE NIVEAU, et
//     `_applyZoom` le borne déjà à `[-STEP_IN, STEP_OUT] = [-ln2, +ln2]`. Donc
//     `f ∈ [-1, +1]` **sans qu'on ajoute de garde-fou**, et `zc ∈ [z-1, z+1]`.
//
// ⚠️ **ET IL EST PROPRE, LÀ OÙ AUCUNE GRANDEUR DE CAMÉRA NE L'EST.** `_rescale`
// appelle `_resetZoom()` — donc `_levelZoom` est écrasé à zéro AVANT que
// `poseCranContinu` ne repose la caméra : le facteur d'échelle du cran, qui
// porte le rapport des exagérations, n'entre jamais dedans. `_applyZoom`, lui,
// n'ajoute que `log(newDist / dist)`, un RAPPORT du glissé de molette. La boucle
// `exag → pose → f → zc → exag` est **coupée à la source**, pas amortie.
//
// ⚠️ **LA CONTINUITÉ AU CRAN N'EST PAS GÉNÉRALE, ET LA PREMIÈRE RÉDACTION DE CE
// PARAGRAPHE L'AFFIRMAIT — À TORT.** Elle disait « exacte, pas approchée ».
// Elle ne l'est que sur **UNE des trois voies** qui déclenchent un cran. Le
// gestionnaire de molette de `modes.js` les porte toutes les trois :
//
//     atInLimit = _levelZoom <= -STEP_IN + 0.03      ← la voie du BUDGET
//              || dist <= minDistance * 1.02         ← le plancher de caméra
//              || nearGround()                       ← la garde de sol
//
//   · **Voie du BUDGET** — `f` vaut 1 à la butée, `zc = z + 1` ; le cran tombe,
//     `demZoom` devient `z + 1`, `_levelZoom` repart de zéro, `zc = z + 1`.
//     **La même valeur des deux côtés — écart mesuré NUL, tous zooms.** ⚠️ Mais
//     `atInLimit` tolère `0,03`, donc `f` peut valoir 0,9567 au lieu de 1 :
//     l'écart réel de cette voie est **≤ 1,017 %**, pas zéro.
//   · **Les deux autres voies tombent à un `_levelZoom` ARBITRAIRE**, et là le
//     saut est réel : **jusqu'à 100 % au cran z4 → z5**, où la table d'Adrien
//     double (2,5 → 5). C'est mesuré par `test/exageration-globe.test.js` ①e,
//     qui existe précisément parce que ①b est posé à l'endroit où les deux
//     formes coïncident.
//
// ⚠️ **CE N'EST PAS UNE RÉGRESSION : C'EST LA BORNE HONNÊTE DE CE PILOTE.** La
// table en escalier d'aujourd'hui saute de 100 % à ce cran-là sur TOUTES les
// voies ; ce pilote-ci l'annule sur la voie du budget et la laisse intacte sur
// les deux autres. Le supprimer partout demanderait de faire écrire
// l'exagération par la voie de déclenchement elle-même, pas par le cran.
//
// Au repos (`_levelZoom = 0`) `zc = demZoom`, donc la courbe rend **la table
// d'Adrien au bit près, surcharges comprises** — décision 14 mot pour mot.

/** `STEP_IN` / `STEP_OUT` — `modes.js:171-172`. Un niveau vaut un facteur 2. */
export const PAS_NIVEAU = Math.LN2

/**
 * Le zoom RÉEL du cran courant : `demZoom + f`.
 *
 * @param {object} arg
 * @param {number} arg.demZoom le cran de l'escalier (`params.demZoom`)
 * @param {number} [arg.zoomNiveau] `_levelZoom` de `modes.js` — NÉGATIF en zoom
 *   avant, positif en zoom arrière, nul au repos
 * @param {number} [arg.pasNiveau] la butée du niveau, `STEP_IN`
 * @returns {number} dans `[demZoom - 1, demZoom + 1]`, ou `NaN` sans cran
 */
export function zoomCran ({ demZoom, zoomNiveau = 0, pasNiveau = PAS_NIVEAU } = {}) {
  const z = Number(demZoom)
  if (!Number.isFinite(z)) return NaN
  const l = Number(zoomNiveau)
  const p = Number(pasNiveau)
  if (!Number.isFinite(l) || !(p > 0)) return z
  return z + Math.min(Math.max(-l / p, -1), 1)
}

// ══════════ 5. LA VALEUR PARTAGÉE — UN ÉCRIVAIN, N LECTEURS ═════════════════

/**
 * ⚠️ **LA MER, LE SOCLE ET LES TRACÉS GPX DOIVENT LIRE LA MÊME VALEUR AU MÊME
 * INSTANT.** C'est la famille de défauts déjà rencontrée deux fois sur ce
 * dépôt : un réglage écrit d'un côté, jamais transmis à l'autre. Aujourd'hui
 * `params.demExaggeration` est lu à DOUZE endroits (`terrain.js` ×5,
 * `ocean.js` ×2, `gpx.js`, `main.js` ×4) — douze occasions de diverger dès que
 * la valeur bouge.
 *
 * D'où cet objet : **un seul écrivain** (`majExageration`), **N lecteurs**
 * (`lireExageration`). Un lecteur ne peut pas calculer sa propre valeur : il
 * n'a pas la courbe.
 *
 * @param {{surcharges?:object, lat?:number, fovDeg?:number, fraction?:number}} [arg]
 */
export function creerExagerationPartagee ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const courbe = surcharges ? courbeExageration({ surcharges, ancres, base }) : COURBE_DEFAUT
  return {
    courbe,
    lat,
    fovDeg,
    fraction,
    // ⚠️ La valeur de DÉPART est celle du zoom du socle, pas `base` : une
    // fenêtre construite avant la première image ne doit pas naître à la
    // mauvaise échelle puis sauter.
    valeur: courbe(zoomDepuisAltitude(altitudeDepuisZoom(13, { lat, fovDeg, fraction }), { lat, fovDeg, fraction })),
    zoom: 13,
    altitudeM: null,
  }
}

/** L'unique écrivain « continu ». Appelé au rééchantillonnage, depuis l'altitude. */
export function majExageration (partage, altitudeM) {
  const z = zoomDepuisAltitude(altitudeM, partage)
  partage.zoom = z
  partage.altitudeM = Number(altitudeM)
  partage.valeur = partage.courbe(z)
  return partage.valeur
}

/**
 * L'écrivain « cadrage » : le même, piloté par la géométrie horizontale.
 * ⚠️ **Il passe par `majExageration`** — un seul chemin d'écriture, jamais deux.
 */
export function majExagerationCadrage (partage, { distance, distanceReference, extentMeters, lat = null } = {}) {
  const z = zoomCadrage({ distance, distanceReference, extentMeters, lat: lat ?? partage.lat })
  if (!Number.isFinite(z)) return partage.valeur
  return majExageration(partage, altitudeDepuisZoom(z, partage))
}

/**
 * L'écrivain « cran » — **celui que la Tâche E retient**, piloté par le cran de
 * l'escalier et la fraction de niveau dépensée. Voir le §4 bis.
 *
 * ⚠️ **IL PASSE PAR `majExageration`, COMME SON AÎNÉ** — un seul chemin
 * d'écriture, jamais deux. L'aller-retour `zoom → altitude → zoom` a été mesuré
 * avant d'être écrit : **écart maximal 8,9·10⁻¹⁶** sur `z ∈ [3 ; 15]`, donc la
 * table d'Adrien ressort au bit près (test ②b).
 */
export function majExagerationCran (partage, { demZoom, zoomNiveau = 0, pasNiveau = PAS_NIVEAU } = {}) {
  const z = zoomCran({ demZoom, zoomNiveau, pasNiveau })
  if (!Number.isFinite(z)) return partage.valeur
  return majExageration(partage, altitudeDepuisZoom(z, partage))
}

/**
 * L'écrivain « palier » — celui de la PRODUCTION, et il ne change rien.
 *
 * ⚠️ **C'est lui qui garde le chemin du bloc intact au bit près.** Drapeau
 * `globeContinu` éteint, `main.js` pose ici la valeur que `exagForZoom` rendait
 * déjà ; les douze lecteurs lisent donc exactement la même chose qu'avant, et
 * la seule différence est qu'ils la lisent **au même endroit**.
 */
export function poserExageration (partage, valeur) {
  const v = Number(valeur)
  if (!Number.isFinite(v)) return partage.valeur
  partage.valeur = v
  partage.altitudeM = null
  return v
}

/**
 * **LE SEUL LECTEUR AUTORISÉ.** Les douze sites de `terrain.js`, `ocean.js`,
 * `gpx.js` et `main.js` passent par ici, et un test échoue si l'un d'eux relit
 * `params.demExaggeration` en direct.
 *
 * ⚠️ **LE REPLI N'EST PAS UN TROU, C'EST LA COMPATIBILITÉ DES BANCS.** Des
 * dizaines de tests construisent un `params` nu, sans partage : ils doivent
 * continuer à décrire leur exagération par `demExaggeration`. Dans
 * l'application le partage existe toujours (`main.js` le pose à côté de
 * `params`), donc les douze lisent la même valeur au même instant — et c'est
 * cela que le test vérifie, pas la présence du repli.
 */
export function lireExageration (params) {
  const p = params?.exagPartage
  if (p && Number.isFinite(p.valeur)) return p.valeur
  const v = Number(params?.demExaggeration)
  return Number.isFinite(v) ? v : EXAG_BASE
}

/**
 * Les surcharges d'Adrien, lues dans `localStorage` sous `monolith.zoomExag`.
 * ⚠️ **Les retirer casserait un réglage qu'il utilise.** Rend `null` hors
 * navigateur ou si le stockage est illisible — jamais une exception.
 */
export function surchargesStockees (stockage = null) {
  try {
    const s = stockage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    if (!s) return null
    const brut = s.getItem(CLE_EXAG)
    if (!brut) return null
    const obj = JSON.parse(brut)
    if (!obj || typeof obj !== 'object') return null
    const out = {}
    let vu = false
    for (const [k, v] of Object.entries(obj)) {
      const z = Number(k)
      const val = Number(v)
      if (Number.isInteger(z) && Number.isFinite(val) && val > 0) { out[z] = val; vu = true }
    }
    return vu ? out : null
  } catch {
    return null
  }
}
