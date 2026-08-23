// LA PLANÈTE NE DOIT PLUS JAMAIS ÊTRE NUE — règle D15, Tâche R6.
//
// > **Adrien, 2026-08-23 :** « Non, la planète ne doit plus jamais être nue. »
//
// ══════════ CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS ═════════════════════
//
// Il ne contient AUCUNE loi de rendu. Il porte **l'état de repos du monde** :
// ce que la tuile du globe porte quand aucun crop n'est posé. Jusqu'ici cet
// état était écrit en dur à trois endroits de `globe.js` — la table des
// uniformes, `retirerHabillage` et `retirerRampe` — et il valait ZÉRO partout.
// C'est cette valeur-là que D15 abroge, et c'est pour ça qu'elle est ici :
// **trois écritures d'un même état finissent par diverger**, et ce dépôt en
// porte déjà la cicatrice (`uContourInterval`, la planète entière restée à
// 250 m après un crop mort).
//
// ══════════ ⚡ LE DÉPARTAGE, ET IL A ÉTÉ CORRIGÉ CONTRE D15 ═════════════════
//
// D15 range **quatre** postes du côté « peut devenir global ». La lecture du
// code n'en garde que **deux**, et le rapport R6 porte la démonstration :
//
//   ✅ `uMerZeroSousEau` — un test de comparaison (`h <= 0` au lieu de
//      `h < 0`). Aucune donnée, aucune texture, aucun domaine.
//
//   ✅ `uNormaleFineOn` — le gradient de hauteur par fragment. Il ne lit que
//      `uTex` (la texture de hauteur **DE LA TUILE**, 256², déjà échantillonnée
//      par la couleur), `uUvParMonde` et `uTilePx` (propres à la tuile eux
//      aussi), et `uUnitesParMetre`, qui est l'échelle verticale **du globe**.
//      Rien de cuit sur l'emprise du crop n'entre dans ce calcul.
//      ⚡ **ET C'EST LUI, ET LUI SEUL, QUI RHABILLE LA PLANÈTE** : hors crop, la
//      seule lumière est `col × (0.74 + 0.30 × diff)` avec
//      `diff = dot(nMonde, uSunDir)`. Tant que `nMonde` est la normale des
//      SOMMETS — 24 quads par tuile — `diff` ne décrit que la courbure de la
//      sphère. C'est l'aplat.
//
//   ⛔ `uTexShade` (le peigne des crêtes) — **D15 SE TROMPE.** Il écrit qu'il
//      « se calcule depuis cette même texture de hauteur ». Non : le nuanceur
//      appelle `natPeigne(col, anl.r, anl.g, uTexShade)`, et `anl` est
//      `texture2D(uAnalysis, …)`. `uAnalysis` est cuite par
//      `src/terrain-analysis.js` — un laplacien fractionnaire de Leland Brown
//      sur une **pile de sept flous jusqu'au rayon 64**, calculée hors du fil
//      principal sur le MNT **du crop**. Ce n'est pas une dérivée locale, c'est
//      un champ multi-échelle : il n'existe pas de version « par fragment ».
//      Le rendre global demanderait de cuire l'analyse **par tuile de globe**,
//      ce qui est un chantier, pas une ligne.
//
//   ⛔ `uRampCropOn` (la rampe 2D) — **D15 SE TROMPE À MOITIÉ.** `uRamp` est
//      bien global, mais `uRampCropOn` ne commande pas `uRamp` : il commande
//      `uRampCrop`, le LUT 2D du socle, ET il indexe son axe Y sur
//      `natHumiditeY(anl.b, anl.a, …)` — l'analyse, encore. Même domaine, même
//      empêchement.
//
//   ⛔ `uCropOn`, `uHabOn`, `uAnalysisOn` — `uCoastMask`, `uSol`, `uAnalysis`
//      sont **une seule texture cuite sur l'emprise du crop**. Hors de leur
//      domaine elles rendent leur bord répété : un masque de côte de La Réunion
//      étalé sur l'Atlantique.
//
//   ⛔ `uEclairageOn` — **le rendre global ne fait RIEN, et c'est arithmétique.**
//      Sa seule action est `partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0`,
//      et `dedansCrop` est initialisé à `0.0` puis n'est écrit QUE dans
//      `if (uCropOn > 0.5)`. Sans crop, `partBloc` vaut zéro quoi qu'on pose,
//      donc ni `albedoCrop`, ni `surfaceFx`, ni `irradianceCrop` ne s'exécutent.
//      ➡️ **L'« éclairage global » de D15 n'est pas cet interrupteur-là.** C'est
//      `uNormaleFineOn`, qui nourrit `diff` et le terminateur.
//
// ⚠️ **CE MODULE EST PUR** : ni DOM, ni three.js, ni `location`. Le drapeau se
// lit dans `src/flags.js`, `src/main.js` le passe en booléen au constructeur du
// globe — même discipline que `globeContinu` et `exagContinue`.

/**
 * L'état de repos HISTORIQUE de la tuile du globe : la couleur nue.
 * C'est le dépôt au bit près, et c'est ce que le drapeau baissé doit rendre.
 */
export const MONDE_NU = Object.freeze({
  merZeroSousEau: 0,
  normaleFine: 0,
})

/**
 * L'état de repos sous D15 : la planète porte son relief et son ombrage
 * PARTOUT, crop ou pas.
 */
export const MONDE_ECLAIRE = Object.freeze({
  merZeroSousEau: 1,
  normaleFine: 1,
})

/**
 * L'état de repos du monde, selon le drapeau.
 * @param {boolean} eclairee
 * @returns {{merZeroSousEau: number, normaleFine: number}}
 */
export function styleMonde(eclairee) {
  return eclairee ? MONDE_ECLAIRE : MONDE_NU
}

/**
 * LE DÉPARTAGE, SOUS FORME DE TABLE — et il est vérifié par le test.
 *
 * `true` = la donnée dont ce poste a besoin existe pour TOUTE tuile de globe.
 * `false` = elle n'existe que sur l'emprise du crop, ou l'interrupteur est sans
 * effet hors du crop. La colonne `motif` est ce que le rapport R6 démontre.
 */
export const POSTES_MONDE = Object.freeze({
  uMerZeroSousEau: Object.freeze({ global: true, motif: 'comparaison pure, aucune donnee' }),
  uNormaleFineOn: Object.freeze({ global: true, motif: 'gradient de uTex, propre a la tuile' }),
  uCropOn: Object.freeze({ global: false, motif: 'la decoupe elle-meme' }),
  uHabOn: Object.freeze({ global: false, motif: 'uCoastMask et uSol, cuits sur le crop' }),
  uAnalysisOn: Object.freeze({ global: false, motif: 'uAnalysis, cuite sur le MNT du crop' }),
  uRampCropOn: Object.freeze({ global: false, motif: 'uRampCrop indexe sur uAnalysis en Y' }),
  uEclairageOn: Object.freeze({ global: false, motif: 'sans effet : partBloc = dedansCrop = 0' }),
})

/**
 * Les postes que D15 autorise à devenir globaux, dans l'ordre de la table.
 * @returns {string[]}
 */
export function postesGlobalisables() {
  return Object.keys(POSTES_MONDE).filter((n) => POSTES_MONDE[n].global)
}

// ══════════ ⚡ L'OMBRAGE DE RELIEF DE LA PLANÈTE ════════════════════════════
//
// ⛔ **LA NORMALE FINE SEULE NE SUFFIT PAS, ET C'EST MESURÉ EN APPARIÉ.**
// ⚠️ Le premier tour de R6 justifiait ce module par « 14,053 contre 14,089,
// soit +0,26 % », en renvoyant à un fichier de banc **qui n'existait pas** et en
// comparant **deux sessions** — la faute que le rapport dénonce lui-même dix
// pages plus haut. Ce chiffre est RETIRÉ. Voici le sien, mesuré dans une SEULE
// session, sur le MÊME jeu de tuiles, grain gelé, plancher de bruit relevé à
// chaque palier (`scripts/sonde-descente-nue.mjs --triple`, traces dans
// `.superpowers/sdd/2026-08-22-globe-studio/traces-R6/triple-*.json`) — gain
// d'écart-type de luminance, normale fine SEULE puis D15 entier :
//
//     lieu par défaut, 39 902 m (plancher 0,000) :  **−1,7 %**  /  **+36,5 %**
//     bande du défaut, 39 927 m (plancher 0,292) :  **+3,7 %**  /  **+83,1 %**
//     bande du défaut, 39 854 m (plancher 0,000) :  **+3,0 %**  /  **+83,3 %**
//     bande du défaut, 59 891 m (plancher 0,000) :  **+5,6 %**  /  **+80,9 %**
//
// ➡️ La normale fine seule pèse **de −2 % à +6 %** là où D15 entier pèse **+37 %
// à +83 %** : un rapport de **dix à vingt**. Le relief est bien là — on le VOIT
// sur les vues — mais **il ne se lit pas**. La cause est arithmétique et le dépôt
// la dit déjà (`globe.js`, § « LE BLOC EST UN MATERIAU ECLAIRE ») : hors du
// crop la seule lumière est `col × (0.74 + 0.30 × diff)`, **un rapport de
// 1,4:1 là où un vrai Lambert va de 0 à 1**. Et `uSunDir` n'est pas le soleil
// de la scène : `main.js` le repose à chaque image sur la position de la caméra
// tournée de 42°, donc au nadir il éclaire de face — l'angle qui écrase le
// relief au lieu de le révéler.
//
// ➡️ **CE MODULE POSE DONC UNE LAMPE DE CARTE, ET RIEN D'AUTRE.** Azimut
// nord-ouest, 45° au-dessus de l'horizon, **DANS LE REPÈRE LOCAL DE CHAQUE
// FRAGMENT** (est / nord / haut) — c'est-à-dire la convention de l'ombrage
// cartographique depuis Imhof, et c'est le seul choix qui ait un sens sur une
// sphère : une direction fixe en repère MONDE laisserait un hémisphère entier
// éclairé par-dessous.
//
// ⚡ **ET IL EST NEUTRE SUR SOL PLAT, PAR CONSTRUCTION.** La loi n'est pas
// `k × n·L` mais `1 + gain × (n·L − haut·L)` : là où la normale fine vaut la
// sphère — c'est-à-dire partout où la tuile ne porte pas de relief, et partout
// où l'empreinte du pixel a mangé le détail — elle rend **1**. Donc la planète
// ne change ni de luminosité moyenne ni de teinte : seule sa MODULATION
// apparaît, et la couture avec le bloc reste invisible.
//
// ⚠️ **« EXACTEMENT 1 » EST VRAI DE LA LOI, PAS DU NUANCEUR — m2 de la
// relecture, et la nuance est bornée ici pour ne pas se perdre.** Sous node,
// `ombrageRelief(x, x, gain)` rend `1` au bit près, et le test ① l'exige. Dans
// le fragment, la normale fine sur sol plat vaut `normaleParGradientSol(0, 0, …)`
// = `haut / length(haut)` (`eclairage-crop.js:670-674`) : `n ≈ haut` à ~1 ulp,
// donc `n·L − haut·L ≈ 1e-7` et le facteur s'écarte de 1 d'environ `1e-7 × gain`.
// Invisible sur huit bits par canal — mais ce n'est pas « au bit près ».
// ➡️ **Ce qui rend le drapeau baissé vérifiable AU BIT PRÈS, c'est la garde
// `uReliefMondeGain > 0.0`, pas la loi** : à gain nul le bloc n'est pas exécuté
// et `ombreRelief` garde sa valeur de repos, `1.0`.

/** La lampe de carte : azimut depuis le nord vers l'est, élévation, et le gain. */
export const RELIEF_MONDE = Object.freeze({
  azimutDeg: 315,
  elevationDeg: 45,
  // ⚠️ **LE GAIN EST LE SEUL RÉGLAGE, ET SA VALEUR NEUTRE EST 0.** À 0 la loi
  // rend 1 partout, donc `colPlanete` est celle du dépôt au bit près : c'est la
  // garde du drapeau baissé, en plus de l'interrupteur.
  gain: 0.9,
})

/** Le gain de repos : zéro, donc aucun effet. C'est la production. */
export const RELIEF_MONDE_NUL = 0

/**
 * L'ombrage de relief, en facteur multiplicatif de la couleur.
 *
 * @param {number} ndu    n·L de la normale FINE, déjà borné à [0, 1]
 * @param {number} nduPlat n·L de la normale de SPHÈRE, déjà borné à [0, 1]
 * @param {number} gain
 * @returns {number} exactement 1 quand `ndu === nduPlat` ; jamais négatif
 */
export function ombrageRelief(ndu, nduPlat, gain) {
  return Math.max(0, 1 + gain * (ndu - nduPlat))
}

/**
 * La direction de la lampe dans le repère local (est, nord, haut).
 * Azimut compté depuis le NORD vers l'EST, comme une boussole.
 * @param {number} azimutDeg
 * @param {number} elevationDeg
 * @returns {{est:number, nord:number, haut:number}}
 */
export function lampeRelief(azimutDeg, elevationDeg) {
  const az = (azimutDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const ce = Math.cos(el)
  return { est: ce * Math.sin(az), nord: ce * Math.cos(az), haut: Math.sin(el) }
}

/**
 * ⚠️ **UNE SEULE ÉCRITURE DE LA LOI, ET C'EST CELLE-CI.** Le GLSL ci-dessous est
 * la transcription des deux fonctions au-dessus ; `test/planete-eclairee.test.js`
 * le TRADUIT ET L'EXÉCUTE contre elles, il ne le cherche pas par son nom — la
 * Tâche K ter a trouvé une assertion verte parce qu'elle lisait une formule dans
 * un commentaire.
 */
export const GLSL_RELIEF_MONDE = `
vec3 lampeReliefMonde(vec3 est, vec3 nord, vec3 haut, float azRad, float elRad) {
  float ce = cos(elRad);
  return normalize(est * (ce * sin(azRad)) + nord * (ce * cos(azRad)) + haut * sin(elRad));
}
float ombrageReliefMonde(vec3 n, vec3 haut, vec3 L, float gain) {
  float nduPlat = clamp(dot(haut, L), 0.0, 1.0);
  float ndu = clamp(dot(n, L), 0.0, 1.0);
  return max(0.0, 1.0 + gain * (ndu - nduPlat));
}
`
