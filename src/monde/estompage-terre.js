// L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`), décision 3.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que `seuil-socle.js`,
// qui n'importe que `landmarks.js`. Tout se vérifie sous node
// (`test/estompage-terre.test.js`).
//
// ══════════ 0. CE QUE CETTE TÂCHE RÉPARE, ET POURQUOI ELLE EXISTE ═══════════
//
// Le cahier des charges tient en une phrase : « la planète autour du crop se
// fond progressivement vers le fond à mesure qu'on descend, pour que le bloc se
// détache ». Deux relevés du chantier disent pourquoi elle est indispensable, et
// pas décorative :
//
//   · **« LA TERRE AUTOUR DU CROP N'EST PAS DESSINÉE DU TOUT »** (Tâche D,
//     vérifié à `y = 900`). La Tâche A `discard` TOUT ce qui est hors du crop :
//     poser le crop ne creuse pas un trou dans la planète, il efface la planète
//     et garde le trou. Il n'y a donc pas d'alentours à estomper — il faut
//     commencer par les DESSINER.
//   · **« une grosse boule laiteuse avec un timbre-poste dessus »** (relevé à
//     l'écran après la Tâche A). ⚠️ **La cause est nommée, et elle est unique :
//     l'atmosphère et les nuages sont des matériaux SÉPARÉS, le `discard` ne les
//     touche pas.** Rejoué ici, et le suspect se réduit à UN :
//     - l'atmosphère (`globe.js`, `_buildAtmosphere`) est une coquille BackSide
//       ADDITIVE à `R_GLOBE × 1,04`. À 100 unités pour 6 371 km, cette coquille
//       est à **255 km d'altitude** : sur toute la bande d'estompage (19 → 40 km)
//       **la caméra est DEDANS**, et une coquille additive vue de l'intérieur
//       remplit le cadre entier. **C'est elle, la boule laiteuse.**
//     - les nuages (`globe-clouds.js`) s'éteignent DÉJÀ tout seuls, par la
//       distance : `smoothstep01(radius × 1,18, radius × 1,5, d)`, soit un fondu
//       entre **1 147 km et 3 186 km** d'altitude. Ils sont à zéro bien avant la
//       bande d'estompage. **On ne les touche donc pas — un facteur de plus y
//       serait du code mort, et ce chantier en a déjà trouvé quatre.** Un test
//       verrouille cette loi pour que la question se rouvre si elle change.
//     - les calottes polaires sont OPAQUES et ne se coupent pas non plus. Elles
//       n'ont « aucun effet à l'échelle du socle » tant que le crop n'est pas à
//       moins d'un horizon d'un pôle — ce qui existe. Elles suivent.
//
// ══════════ 1. RÈGLE R1 — LE PARAMÈTRE EST UNE ALTITUDE ════════════════════
//
// ⚠️ **JAMAIS UNE FRACTION D'ÉCRAN.** Une fraction d'écran rendrait le fondu
// dépendant du cadrage et de la résolution ; et surtout elle dépendrait de la
// distance au SOL, donc du terrain chargé, donc de `meanM`, qui est lissé —
// gain plus retard font un oscillateur, et le précédent Cesium est exact.
// L'entrée est l'**altitude géométrique de la caméra au-dessus de l'ellipsoïde**,
// en mètres : dans `main.js` c'est `altitudeCadrageM()`, l'instrument que la
// Tâche 1b a purgé de `dem.meanM` exprès.
//
// ⚠️ **ET LES DEUX BORNES NE SONT PAS POSÉES : ELLES SE DÉRIVENT.** Le §0 du
// plan interdit un chiffre sans sa source ; ici la source est le calcul de
// `seuil-socle.js`, donc le champ de vision par défaut (`FOV_DEG = 30`, tiré de
// la ligne `fov: 30` des réglages de `main.js` — **pas** `main.js:263`, citation
// corrigée le 2026-08-21) et la largeur du socle à `ZOOM_SOCLE`. Un test refuse toute
// altitude écrite en dur dans ce fichier.
//
// ══════════ 2. OÙ LE FONDU COMMENCE, OÙ IL FINIT ═══════════════════════════
//
// **Il commence à `SEUIL_MORT_M`** — l'altitude la plus HAUTE à laquelle le
// socle puisse encore exister (`seuil-socle.js`, §6 : l'hystérésis). Au-dessus,
// il n'y a aucun socle à détacher : estomper la planète n'aurait rien à servir.
//
// **Il finit à l'altitude où le socle occupe TOUTE la hauteur de l'image** —
// `fraction = 1`, la même trigonométrie que les deux seuils, prise à la même
// latitude d'ancrage. En dessous, ce qui reste de planète dans le cadre est
// hors des bords : le fondu n'a plus rien à retirer.
//
// Leurs valeurs d'aujourd'hui, pour mémoire et pour la relecture — elles se
// recalculent, elles ne sont pas écrites :
//
//   ALT_ESTOMPAGE_DEBUT_M = 40 342,8 m  (= SEUIL_MORT_M, 48 % de la hauteur)
//   SEUIL_NAISSANCE_M     = 32 274,3 m  (60 % — pour situer, il est ENTRE)
//   ALT_ESTOMPAGE_FIN_M   = 19 364,6 m  (100 % de la hauteur)
//
// ⚠️ **L'ORDRE EST LA PROPRIÉTÉ, PAS LES CHIFFRES.** `FIN < NAISSANCE < DÉBUT` :
// le fondu est déjà entamé quand le socle naît (à **22 %**, rejoué) et il
// s'achève après. C'est ce qui rend le mot « progressivement » vrai — le bloc se
// détache PENDANT qu'on descend, il n'apparaît pas dans un écran déjà vide.
//
// ══════════ 3. LA FORME DE LA RAMPE — LOGARITHMIQUE, ET C'EST MOTIVÉ ═══════
//
// ⚠️ **LE PARAMÈTRE COURT SUR LE LOGARITHME DE L'ALTITUDE, PAS SUR L'ALTITUDE.**
// Toute la descente de ce dépôt est GÉOMÉTRIQUE — `echelonsGeometriques`
// (`loi-altitude.js`) pose ses paliers à ratio constant, et un cran divise
// l'altitude par deux. Une rampe linéaire en mètres passerait donc vite en haut
// et lentement en bas, à vitesse de descente perçue constante. Le rapport des
// deux bornes vaut **2,083** — un peu plus d'un cran : le fondu dure à peu près
// une division par deux de l'altitude, quelle que soit l'échelle.
//
// Puis `smoothstep` : sa dérivée est nulle aux deux bouts, donc **ni la valeur
// ni la vitesse ne sautent** aux raccords. Un raccord en pente non nulle se
// verrait comme un à-coup de luminosité au moment où le fondu s'amorce.
//
// ⚠️ **PAS D'HYSTÉRÉSIS ICI, ET C'EST UN CHOIX.** `socleVisible` en a besoin
// parce que c'est un INTERRUPTEUR : sans elle, un doigt qui tremble à
// l'altitude limite fait clignoter le socle. Une rampe continue ne clignote pas
// — au pire elle respire d'un centième. En ajouter une créerait deux bandes
// d'estompage différentes selon le sens de la descente, donc une image qui ne
// dépend plus seulement d'où l'on est.

import {
  LARGEUR_SOCLE_M,
  SEUIL_MORT_M,
  altitudePourFraction,
} from './seuil-socle.js'

// ══════════ 4. LES CONSTANTES, ET LEUR SOURCE ══════════════════════════════

// La fraction de la HAUTEUR de l'image qu'occupe le socle quand le fondu est
// achevé. ⚠️ **UN, c'est-à-dire « le socle remplit l'écran »** — pas un réglage
// de goût : c'est la première fraction à laquelle la planète autour n'est plus
// dans le cadre que par les coins. Voir le §2.
export const FRACTION_ESTOMPAGE_PLEINE = 1

// Le haut de la bande. ⚠️ **C'EST LE SEUIL DE MORT DU SOCLE, PAS UN VOISIN.**
export const ALT_ESTOMPAGE_DEBUT_M = SEUIL_MORT_M

// Le bas de la bande — dérivé, comme les deux seuils, jamais posé.
export const ALT_ESTOMPAGE_FIN_M = altitudePourFraction({
  largeurM: LARGEUR_SOCLE_M,
  fraction: FRACTION_ESTOMPAGE_PLEINE,
})

// Le logarithme du rapport des deux bornes — le dénominateur de la rampe.
// Calculé UNE fois : c'est une constante du module, pas un travail par image.
const ETENDUE_LOG = Math.log(ALT_ESTOMPAGE_DEBUT_M / ALT_ESTOMPAGE_FIN_M)

// ══════════ 5. LA LOI ══════════════════════════════════════════════════════

/**
 * De combien la Terre AUTOUR du crop est effacée, à cette altitude.
 *
 * `0` = la planète est entière, atmosphère comprise — c'est le globe
 * d'aujourd'hui. `1` = il ne reste que le crop sur le fond — c'est ce que la
 * Tâche A fait déjà, en dur, à toutes les altitudes.
 *
 * ⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE**, en
 * mètres. Ni fraction d'écran, ni distance au sol, ni débit, ni zoom effectif :
 * règle R1, voir le §1.
 *
 * Une altitude non finie conserve l'état : elle ne peut pas être une raison
 * d'effacer la planète. Même contrat que `socleVisible`.
 *
 * @param {{altitudeEllipsoideM:number, estompageAvant?:number}} [etat]
 * @returns {number} dans [0, 1]
 */
export function estompageTerre({ altitudeEllipsoideM, estompageAvant = 0 } = {}) {
  if (typeof altitudeEllipsoideM !== 'number' || !Number.isFinite(altitudeEllipsoideM)) {
    return estompageAvant
  }
  if (altitudeEllipsoideM >= ALT_ESTOMPAGE_DEBUT_M) return 0
  if (altitudeEllipsoideM <= ALT_ESTOMPAGE_FIN_M) return 1
  const t = Math.log(ALT_ESTOMPAGE_DEBUT_M / altitudeEllipsoideM) / ETENDUE_LOG
  // smoothstep : dérivée nulle aux deux bouts — voir le §3
  return t * t * (3 - 2 * t)
}

// ══════════ 6. LA VEILLE — LA MÉMOIRE, ET LE ET AVEC LE MODE ═══════════════
//
// Même raison d'être que `veille-socle.js`, et le même patron : `main.js` n'est
// chargé par AUCUN test, donc l'état inter-images ne peut pas y vivre.
//
// ⚠️ **L'ORBITE FORCE ZÉRO, ELLE NE GÈLE PAS.** C'est la seule différence avec
// la veille du socle, et elle est délibérée. Là-bas, geler est correct : le
// socle n'existe pas en orbite de toute façon. Ici, geler laisserait la valeur
// de la dernière image de surface — donc **une planète effacée en orbite**, un
// écran vide. En orbite la Terre est le sujet : elle est entière.
//
// ⚠️ **ET `maj` NE DÉCIDE PAS EN ORBITE.** `altitudeCadrageM()` y divise un
// `camera.position.y` orbital par l'échelle du DERNIER bloc chargé : le nombre
// qui en sort n'est pas une altitude, c'est un résidu (voir `veille-socle.js`,
// §2). La première image de surface tranche.

/**
 * L'automate de l'estompage, avec sa mémoire.
 *
 * `appliquer` n'est appelé QUE lorsque la valeur posée change — sans cette
 * garde, un uniforme serait réécrit à chaque image pour rien.
 *
 * ⚠️ **PAS D'ÉTAT DE DÉPART À PASSER, CONTRAIREMENT À `creerVeilleSocle`, ET
 * C'EST UNE CORRECTION DE CAMPAGNE.** La première version portait un
 * `estompageAuDepart` écrêté et un `modeSurfaceAuDepart` — deux paramètres que
 * personne n'a jamais passés, donc un écrêtage que rien ne pouvait atteindre.
 * **Une mutation qui le retirait survivait**, et c'est la définition du code
 * mort que ce chantier a déjà trouvé quatre fois. La veille du socle en a
 * besoin (le socle EST posé au chargement) ; ici l'état neutre est zéro par
 * construction — la planète est entière tant que personne n'a rien demandé.
 *
 * @param {{ appliquer: (estompage:number) => void }} arg
 */
export function creerVeilleEstompage({ appliquer } = {}) {
  if (typeof appliquer !== 'function') {
    throw new TypeError('creerVeilleEstompage : `appliquer` est obligatoire — un branchement muet est un branchement absent')
  }
  // ce que l'ALTITUDE dit, indépendamment du mode
  let auSeuil = 0
  let modeSurface = true
  // ══════════ 7. LE REPOS FORCE UN — Tâche N, « LE STUDIO SUR LE GLOBE » ═════
  //
  // **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
  // s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue
  // est stabilisée. »
  //
  // ⚠️ **LA LOI N'EST PAS TOUCHÉE, ET C'EST LE POINT.** `estompageTerre` est
  // mesurée, relue et validée (Tâche G) : ses deux bornes se dérivent toujours
  // de `seuil-socle.js`, sa rampe court toujours sur le logarithme de
  // l'altitude, elle n'a toujours pas d'hystérésis. **Ce qui change est QUAND
  // elle s'applique** — l'estompage devient un état de TRANSITION, plus un état
  // de repos. Au repos la valeur posée est 1, « le crop seul » : c'est le
  // comportement que la Tâche A porte depuis toujours, et `uEstompage = 1` le
  // rend au bit près.
  //
  // ⚠️ **L'ORDRE DES TROIS PRIORITÉS N'EST PAS ARBITRAIRE** : l'orbite d'abord
  // (là-haut la Terre est le sujet, elle est ENTIÈRE — §6), le repos ensuite, la
  // loi en dernier. Un repos qui primerait sur l'orbite effacerait la planète au
  // moment précis où elle redevient le sujet — le défaut que le §6 décrit déjà.
  //
  // ⚠️ **ET CE N'EST PAS À CETTE VEILLE DE SAVOIR S'IL Y A UN CROP.** Sans crop
  // posé, forcer 1 laisserait un écran vide : la planète effacée, et rien à la
  // place. C'est `branchement-crop.js` qui ne relaie le repos que lorsque la
  // chaîne est posée — un seul point d'alimentation, comme pour `maj` et
  // `poserMode`.
  let auRepos = false
  // ce qui est réellement POSÉ à l'écran
  let pose = 0
  let applications = 0

  function poser() {
    const voulu = !modeSurface ? 0 : auRepos ? 1 : auSeuil
    if (voulu === pose) return pose
    pose = voulu
    applications++
    appliquer(voulu)
    return pose
  }

  return {
    /** Le mode de `modes.js`. ⚠️ Il PRIME : en orbite la Terre est entière. */
    poserMode(surface) {
      modeSurface = !!surface
      return poser()
    },

    /**
     * La vue est-elle au repos ? ⚠️ Au repos, le crop SEUL — voir le §7.
     *
     * ⚠️ **MÊME GARDE QUE LES DEUX AUTRES ENTRÉES** : `appliquer` n'est rappelé
     * que lorsque la valeur posée change, sinon un uniforme serait réécrit à
     * chaque image pour rien.
     *
     * @param {boolean} repos
     */
    poserRepos(repos) {
      auRepos = !!repos
      return poser()
    },

    /**
     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
     * au-dessus de l'ellipsoïde — voir le §1.
     */
    maj(altitudeEllipsoideM) {
      if (!modeSurface) return pose
      auSeuil = estompageTerre({ altitudeEllipsoideM, estompageAvant: auSeuil })
      return poser()
    },

    /** Ce qui est posé à l'écran. */
    get valeur() { return pose },
    /** Ce que l'altitude dit, mode mis à part — pour les sondes et les bancs. */
    get auSeuil() { return auSeuil },
    /** Le repos est-il relayé ? — pour les sondes et les bancs (Tâche N). */
    get auRepos() { return auRepos },
    /** Combien de fois l'estompage a été réellement réécrit. */
    get applications() { return applications },
  }
}
