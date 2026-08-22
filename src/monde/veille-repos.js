// LE REPOS DE LA VUE — Tâche N du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch, et il n'importe RIEN. Tout se
// vérifie sous node (`test/veille-repos.test.js`).
//
// ══════════ 0. LA CONSIGNE, ET CE QU'ELLE DEMANDE DE NEUF ═══════════════════
//
// **Adrien, 2026-08-22 :** « Tout ce qui est en dehors du crop ne doit pas
// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
// zoom pour faire la transition. »
//
// Trois mots portent tout le poids : **« quand la vue est stabilisée »**. Il
// faut donc un critère de repos — et un critère de repos est un SEUIL, ce qui
// est exactement la classe d'objet que ce chantier a déjà payée : le seuil du
// socle a produit **onze bascules là où il en fallait une** (`main.js`,
// « ON NE DÉCIDE PAS PENDANT UN CRAN »). Ce fichier ne devine donc aucun de ses
// deux nombres : ils sortent de traces par image relevées dans l'application
// vivante, et les traces sont sur le disque.
//
// ══════════ 1. LA GRANDEUR SURVEILLÉE — L'ALTITUDE, ET ELLE SEULE ═══════════
//
// ⚠️ **PAS LA POSITION DE LA CAMÉRA, PAS SON ORIENTATION.** La consigne nomme
// le geste : « sauf si dézoom ou zoom ». Un panoramique et une orbite ne
// demandent RIEN de plus que le crop — le bloc reste le sujet, et ce qui est
// autour reste hors sujet. Seul un changement d'ÉCHELLE fait entrer les
// alentours dans le cadre. Surveiller la position ferait réapparaître la Terre
// autour à chaque glissement de souris, c'est-à-dire le battement que l'Étape 4
// de la tâche interdit.
//
// ⚠️ **ET C'EST LA MÊME ALTITUDE QUE LES DEUX AUTRES VEILLES** — l'altitude
// géométrique de la caméra au-dessus de l'ellipsoïde, règle R1 : dans `main.js`
// c'est `altitudeCadrageM()`, l'instrument que la Tâche 1b a purgé de
// `dem.meanM` exprès. Trois automates qui décident sur la même image doivent
// décider sur le même nombre.
//
// ══════════ 2. L'ÉCART EST LOGARITHMIQUE ═══════════════════════════════════
//
// ⚠️ **`|Δ ln altitude|`, PAS `|Δ altitude|`.** Toute la descente de ce dépôt
// est GÉOMÉTRIQUE (`echelonsGeometriques`, `loi-altitude.js`), et l'estompage
// lui-même court sur le logarithme de l'altitude (`estompage-terre.js`, §3). Un
// seuil en mètres serait franchi par un frémissement à 3 000 km et jamais par un
// vrai zoom à 12 km : **un seuil par altitude, c'est-à-dire aucun seuil.**
//
// ══════════ 3. LES DEUX NOMBRES, ET D'OÙ ILS VIENNENT ══════════════════════
//
// **Relevés le 2026-08-22 dans l'application vivante** (La Réunion,
// `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, 60 Hz,
// `fov = 33` lu en direct). Données brutes : `.banc/vues-N/AV-trace-*.json`,
// dépouillement : `.banc/hysterese-N.mjs` → `.banc/vues-N/hysterese-brut.json`.
//
//   · **AU REPOS STRICT, L'ÉCART VAUT EXACTEMENT ZÉRO** : 3 216 images de suite
//     (53 s), `altitudeCadrageM()` bit pour bit identique, caméra immobile au
//     bit près. **Mais « non nul » n'est PAS un critère utilisable**, et c'est
//     la mesure qui le dit : après un geste d'orbite, la traîne d'amortissement
//     est ASYMPTOTIQUE — encore `7,7 × 10⁻¹¹` par image **603 images (10 s)
//     après la fin du geste**, en décroissance géométrique de rapport ≈ 0,970.
//     Un seuil « strictement positif » laisserait donc les alentours allumés
//     pour toujours après le moindre geste.
//   · **LE GESTE DÉLIBÉRÉ LE PLUS DOUX MESURÉ** est une molette : son écart
//     culmine à `4,67 × 10⁻⁴` par image (et `4,70 × 10⁻⁴` sur la trace
//     saccadée). ⚠️ **C'est un PLAFOND, pas un plancher** : tout seuil au-dessus
//     de `4,67 × 10⁻⁴` manque un vrai zoom en entier — vérifié, à `S = 10⁻³` la
//     trace de molette ne compte **aucune** image au-dessus du seuil.
//
// **`SEUIL_BOUGE_LOG = 10⁻⁴`** est donc pris **4,7 fois sous le pic du geste le
// plus doux**, et il capte ce geste EN ENTIER : 48 images au-dessus du seuil,
// exactement le même compte qu'à `10⁻⁵`, `10⁻⁶` ou `10⁻⁸` — la molette s'arrête
// NET, sa traîne n'est pas asymptotique. Descendre plus bas n'achète donc rien
// sur le geste et coûte sur la traîne d'orbite : à `10⁻⁴` elle repasse sous le
// seuil 140 images (2,3 s) après le geste, à `10⁻⁵` il faut 216 images (3,6 s).
//
// **`IMAGES_CALME = 30`** — le nombre d'images consécutives sous le seuil avant
// de redéclarer le repos. ⚠️ **C'EST LUI, L'HYSTÉRÉSIS**, et elle est
// ASYMÉTRIQUE À DESSEIN : on quitte le repos en UNE image (les alentours doivent
// être là dès la première image du geste, sinon la transition commence par un
// trou), on y revient en trente. Ce que la mesure dit :
//
//   · sur un geste CONTINU — molette d'un trait, orbite d'un trait — le plus
//     long palier calme À L'INTÉRIEUR du geste vaut **0 image** : aucun risque
//     de retomber au repos en plein geste, quel que soit `IMAGES_CALME` ;
//   · sur un geste SACCADÉ, les deux seuls trous mesurés valent **1 900 ms et
//     1 666 ms**. ⚠️ **CE SONT MES PROPRES ALLERS-RETOURS D'OUTIL, PAS DES
//     PAUSES HUMAINES** — trois salves de cinq crans séparées par un
//     aller-retour de pilotage. Les couvrir demanderait `IMAGES_CALME ≈ 115`,
//     donc **deux secondes de retard sur CHAQUE recrop**, ce que la consigne ne
//     demande pas. Trente images valent **0,5 s à 60 Hz** : cela couvre la pause
//     ordinaire entre deux crans de molette d'une même main.
//
// ⚠️ **RÉSERVE ASSUMÉE, ÉCRITE ICI PLUTÔT QUE DÉCOUVERTE À L'ÉCRAN** : une pause
// de plus d'une demi-seconde entre deux salves fait recropper puis rouvrir. **Ce
// n'est pas un battement, c'est un aller-retour** — le compteur `bascules` le
// distingue, et le banc de l'Étape 4 le compte au lieu de l'espérer.
//
// ⚠️ **EN IMAGES, PAS EN MILLISECONDES**, exactement comme `periodeReprise` de
// `branchement-crop.js` : le module est pur, il n'a pas d'horloge. À 30 Hz le
// délai vaut donc une seconde, et c'est le bon sens — une machine qui rame a
// besoin de plus de repos, pas de moins.

/**
 * L'écart minimal, par image, sur `|Δ ln altitude|`, au-dessus duquel on
 * déclare que la vue BOUGE. Voir le §3 : mesuré, pas posé.
 */
export const SEUIL_BOUGE_LOG = 1e-4

/**
 * Le nombre d'images consécutives sous le seuil avant de redéclarer le repos.
 * ⚠️ C'est l'hystérésis, et elle n'a qu'un sens — voir le §3.
 */
export const IMAGES_CALME = 30

/**
 * L'automate du repos, avec sa mémoire.
 *
 * ⚠️ **IL DÉMARRE AU REPOS, ET CE N'EST PAS UN DÉTAIL.** Au chargement,
 * personne n'a encore rien bougé : démarrer « en mouvement » ferait dessiner la
 * planète entière autour du crop pendant la demi-seconde qui suit l'arrivée,
 * c'est-à-dire exactement l'image qu'Adrien refuse, au moment où elle se voit le
 * plus.
 *
 * @param {object} [arg]
 * @param {number} [arg.seuilBougeLog] voir `SEUIL_BOUGE_LOG`
 * @param {number} [arg.imagesCalme] voir `IMAGES_CALME`
 */
export function creerVeilleRepos({
  seuilBougeLog = SEUIL_BOUGE_LOG,
  imagesCalme = IMAGES_CALME,
} = {}) {
  let altPrecedente = null
  let calme = 0
  let auRepos = true
  let bascules = 0
  let dernierEcart = 0

  return {
    /**
     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
     * au-dessus de l'ellipsoïde — règle R1, voir le §1.
     *
     * ⚠️ **UNE ALTITUDE NON FINIE, NULLE OU NÉGATIVE CONSERVE L'ÉTAT**, même
     * contrat que `socleVisible` et `estompageTerre` : elle ne peut pas être une
     * raison de rallumer la Terre autour. Et un logarithme de zéro ferait
     * `−Infinity`, donc un écart `Infinity`, donc un mouvement permanent —
     * l'exact contraire de ce que la panne devrait produire.
     *
     * @returns {boolean} la vue est-elle au repos ?
     */
    maj(altitudeEllipsoideM) {
      if (typeof altitudeEllipsoideM !== 'number' || !Number.isFinite(altitudeEllipsoideM) || altitudeEllipsoideM <= 0) {
        return auRepos
      }
      if (altPrecedente === null) {
        // ⚠️ **LA PREMIÈRE IMAGE N'A PAS D'ÉCART, ET ON NE LUI EN INVENTE PAS
        // UN.** Prendre `0` pour altitude précédente ferait un écart infini à
        // l'arrivée, donc un réveil garanti à chaque retour de l'orbite.
        altPrecedente = altitudeEllipsoideM
        return auRepos
      }
      const ecart = Math.abs(Math.log(altitudeEllipsoideM / altPrecedente))
      altPrecedente = altitudeEllipsoideM
      dernierEcart = ecart
      if (ecart > seuilBougeLog) {
        calme = 0
        if (auRepos) { auRepos = false; bascules++ }
        return auRepos
      }
      calme++
      if (!auRepos && calme >= imagesCalme) { auRepos = true; bascules++ }
      return auRepos
    },

    /**
     * Oublier l'altitude de référence.
     *
     * ⚠️ **APPELÉ QUAND ON QUITTE LA SURFACE, ET C'EST INDISPENSABLE.** En
     * orbite, `altitudeCadrageM()` divise un `camera.position.y` orbital par
     * l'échelle du DERNIER bloc chargé : le nombre qui en sort n'est pas une
     * altitude, c'est un résidu (`veille-socle.js`, §2). Sans oubli, la première
     * image du retour en surface comparerait une altitude à ce résidu et
     * déclarerait un mouvement énorme — les alentours s'allumeraient à chaque
     * retour d'orbite, pour rien.
     *
     * ⚠️ **IL N'OUBLIE PAS L'ÉTAT `auRepos`**, seulement la référence : le
     * retour en surface se fait sur une caméra posée, donc au repos.
     */
    oublier() {
      altPrecedente = null
      calme = 0
    },

    /** La vue est-elle au repos ? */
    get auRepos() { return auRepos },
    /** Combien d'images calmes de suite — pour les sondes et les bancs. */
    get calme() { return calme },
    /** Combien de fois le repos a basculé : c'est le compteur de battement. */
    get bascules() { return bascules },
    /** Le dernier `|Δ ln altitude|` mesuré — pour les sondes et les bancs. */
    get dernierEcart() { return dernierEcart },
  }
}
