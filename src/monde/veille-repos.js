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
// ══════════ 1. LA GRANDEUR SURVEILLÉE — LA DISTANCE CAMÉRA↔CIBLE ════════════
//
// ⚠️ **PAS LA POSITION DE LA CAMÉRA, PAS SON ORIENTATION, ET PAS SON ALTITUDE
// NON PLUS.** La consigne nomme le geste : « sauf si dézoom ou zoom ». Un
// panoramique et une orbite ne demandent RIEN de plus que le crop — le bloc
// reste le sujet, et ce qui est autour reste hors sujet. Seul un changement
// d'ÉCHELLE fait entrer les alentours dans le cadre.
//
// ⛔ **CE MODULE A SURVEILLÉ L'ALTITUDE JUSQU'AU 2026-08-23, ET C'ÉTAIT LA
// MAUVAISE GRANDEUR.** L'intention ci-dessus était déjà la bonne ; c'est
// l'instrument qui la trahissait. `altitudeCadrageM()` est proportionnelle à
// `camera.position.y` — et **incliner la vue, c'est précisément faire descendre
// `camera.position.y` sans rien changer à l'échelle.** Le raisonnement qui
// tenait ici (« surveiller la position ferait réapparaître la Terre à chaque
// glissement de souris ») condamnait déjà l'altitude sans le voir : l'altitude
// EST une composante de la position.
//
// **Adrien, 2026-08-23 :** « si je modifie la hauteur de la caméra SANS
// SCROLLER et en me déplaçant, il ne faut pas que le reste de ce qui est autour
// du socle réapparaisse. Si je dézoome EN SCROLLANT, alors là tu peux faire
// réapparaître le reste. »
//
// ⚡ **LA MESURE — application vivante, `.banc/R1/mesure-R1.json`.** Un vrai
// cliquer-glisser sur le canevas (PointerEvent réels : c'est OrbitControls qui
// pilote, pas le banc), cible immobile, sous
// `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0` :
//
//   | grandeur | pic d'écart logarithmique | images au-dessus du seuil |
//   |---|---|---|
//   | altitude au-dessus de l'ellipsoïde | **3,86 × 10⁻¹** | **15 / 15** |
//   | distance caméra → cible | **4,4 × 10⁻¹⁶** | **0 / 15** |
//
// L'altitude tombe de 17 624 m à 2 861 m pendant que la distance ne bouge pas
// du seizième chiffre. `auRepos` basculait réellement de vrai à faux et la
// planète entière se rallumait autour du crop. Sur 40 poses programmées à rayon
// exactement constant, même verdict : `1,03 × 10⁻²` contre `2,2 × 10⁻¹⁶`.
//
// ⛔ **ET LE PRINCIPE QUI ÉTAIT ÉCRIT ICI EST FAUX — c'est lui, l'erreur de
// fond** : *« trois automates qui décident sur la même image doivent décider
// sur le même nombre. »* Non. Ils doivent décider sur la même IMAGE — c'est
// pour cela que `branchement-crop.js` reste le seul point d'alimentation — mais
// pas sur le même NOMBRE, parce qu'ils ne posent pas la même question.
// L'estompage et le seuil du socle demandent **à quelle distance du sol
// suis-je** : leur réponse est une altitude en mètres, et la règle R1 vaut pour
// eux. Le repos demande **l'utilisateur change-t-il d'échelle** : sa réponse est
// un rapport. Deux questions, deux grandeurs.
//
// ⚠️ **ET L'UNITÉ DE CELLE-CI EST INDIFFÉRENTE**, ce qui est la preuve qu'elle
// n'est pas une altitude : l'écart est un `|Δ ln|`, donc un rapport. Unités du
// monde ou mètres au sol donnent le même nombre à la même image. `main.js` la
// lit donc telle quelle — `camera.position.distanceTo(controls.target)` — sans
// conversion à tenir d'accord avec quoi que ce soit.
//
// ⚠️ **CE QUE LA DISTANCE FAIT MIEUX, EN PLUS DE L'ORBITE — mesuré.** Sur une
// image où l'emprise du bloc change SANS aucun geste (l'arrivée du MNT derrière
// la fenêtre bornée : `largeurBlocM()` passe de 6 835,77 à 6 835,43, cible
// immobile, `modes.busy` faux), c'est **l'altitude qui bouge** — `4,98 × 10⁻⁵`,
// parce qu'`altitudeCadrageM()` divise `camY` par une largeur qui vient de
// changer — et **la distance qui ne bouge pas du tout** : `0`. La distance est
// donc immunisée contre une classe de faux positifs que l'altitude subissait.
//
// ⚠️ **CE QUE LA DISTANCE FAIT MOINS BIEN, ET IL FAUT LE DIRE — mesuré aussi.**
// Au franchissement d'un cran, `_suivreEmprise` (`modes.js`) repose la caméra
// et `controls.target` saute : relevé **13,25 unités** de saut de cible, la
// distance passant de 72,75 à 124,59 — un écart de `0,538` là où l'altitude,
// continue par construction à cet instant, n'en fait que `0,364`. **Ce n'est
// pas un faux positif** : un cran ne survient que pendant un zoom délibéré, et
// les DEUX grandeurs franchissent le seuil à cette image. C'est un vrai positif
// plus gros, pas un réveil de plus.
//
// ══════════ 2. L'ÉCART EST LOGARITHMIQUE ═══════════════════════════════════
//
// ⚠️ **`|Δ ln d|`, PAS `|Δ d|`.** Toute la descente de ce dépôt est GÉOMÉTRIQUE
// (`echelonsGeometriques`, `loi-altitude.js`), et l'estompage lui-même court sur
// le logarithme de l'altitude (`estompage-terre.js`, §3). Un seuil en unités
// serait franchi par un frémissement en haut de l'escalier et jamais par un vrai
// zoom en bas : **un seuil par échelon, c'est-à-dire aucun seuil.**
//
// ⚠️ **ET C'EST CE §2 QUI REND L'UNITÉ INDIFFÉRENTE** (voir le §1) : un rapport
// ne connaît pas les mètres. C'est aussi pour cela que le passage de l'altitude
// à la distance n'a demandé AUCUN nouveau nombre — voir le §3.
//
// ══════════ 3. LES DEUX NOMBRES, ET D'OÙ ILS VIENNENT ══════════════════════
//
// ⚠️ **CES DEUX NOMBRES ONT ÉTÉ CALIBRÉS SUR L'ALTITUDE ; ILS SURVIVENT TELS
// QUELS AU CHANGEMENT DE GRANDEUR DU §1, ET CE N'EST PAS UNE ESPÉRANCE, C'EST
// UNE MESURE.** Le seuil a été pris sous le pic du geste le plus doux — une
// molette. Relevé le 2026-08-23 sur six crans de molette réels, cible immobile
// (`.banc/R1/mesure-R1.json`, C) : à la MÊME image, l'altitude culmine à
// `6,593 × 10⁻³` et la distance à `7,112 × 10⁻³` — **un rapport de 1,079** — et
// les deux captent EXACTEMENT les mêmes images, **54 sur 54**. Le geste qui a
// servi d'étalon rend donc le même ordre de grandeur sur l'une et sur l'autre :
// `SEUIL_BOUGE_LOG` n'avait aucune raison de bouger, et il n'a pas bougé.
//
// ⚠️ **CES PICS-LÀ NE SE COMPARENT PAS AUX `4,67 × 10⁻⁴` CI-DESSOUS** : la
// mesure du 2026-08-23 a été prise à ~25 images/s (le panneau navigateur de
// session ne compositait pas, le moteur tournait sur son repli `setTimeout`),
// contre 60 Hz pour celle du 2026-08-22. À cadence plus basse, chaque image
// avance davantage, donc chaque écart est plus grand. **Ce qui se compare, et
// c'est tout ce dont la décision avait besoin, c'est le RAPPORT des deux
// grandeurs à la MÊME image.**
//
// **Relevés le 2026-08-22 dans l'application vivante** (La Réunion,
// `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, 60 Hz,
// `fov = 33` lu en direct). Données brutes : `.banc/vues-N/AV-trace-*.json`,
// dépouillement : `.banc/hysterese-N.mjs` → `.banc/vues-N/hysterese-brut.json`.
//
//   · **AU REPOS STRICT, L'ÉCART VAUT EXACTEMENT ZÉRO** — pas mesuré dans
//     l'application vivante, ÉTABLI PAR CONSTRUCTION : deux altitudes
//     identiques donnent `ln(1) = 0`. `test/veille-repos.test.js` ③ (« au repos
//     STRICT ») rejoue ce raisonnement 3 216 fois de suite sur la MÊME constante
//     (une boucle synthétique, pas un relevé de 53 s à l'écran) — ce qui
//     prouve que la loi ne dérive pas d'elle-même sur une entrée immobile,
//     rien de plus. **Mais « non nul » n'est PAS un critère utilisable**, et
//     c'est la mesure, elle, réellement relevée dans l'application vivante qui
//     le dit : après un geste d'orbite, la traîne d'amortissement
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
 * L'écart minimal, par image, sur `|Δ ln distance|`, au-dessus duquel on
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
  let precedente = null
  let calme = 0
  let auRepos = true
  let bascules = 0
  let dernierEcart = 0

  return {
    /**
     * Une image. `distanceCible` est la distance de la caméra à
     * `controls.target` — voir le §1, qui porte la mesure qui l'a choisie
     * contre l'altitude.
     *
     * ⚠️ **SON UNITÉ EST INDIFFÉRENTE** : l'écart est un `|Δ ln|`, donc un
     * rapport (§2). Unités du monde ou mètres au sol rendent le même nombre.
     *
     * ⚠️ **UNE DISTANCE NON FINIE, NULLE OU NÉGATIVE CONSERVE L'ÉTAT** — et
     * c'est aussi ce qui arrive quand l'appelant ne la passe pas du tout. Même
     * contrat que `socleVisible` et `estompageTerre` : elle ne peut pas être une
     * raison de rallumer la Terre autour. Et un logarithme de zéro ferait
     * `−Infinity`, donc un écart `Infinity`, donc un mouvement permanent —
     * l'exact contraire de ce que la panne devrait produire.
     *
     * @returns {boolean} la vue est-elle au repos ?
     */
    maj(distanceCible) {
      if (typeof distanceCible !== 'number' || !Number.isFinite(distanceCible) || distanceCible <= 0) {
        return auRepos
      }
      if (precedente === null) {
        // ⚠️ **LA PREMIÈRE IMAGE N'A PAS D'ÉCART, ET ON NE LUI EN INVENTE PAS
        // UN.** Prendre `0` pour valeur précédente ferait un écart infini à
        // l'arrivée, donc un réveil garanti à chaque retour de l'orbite.
        precedente = distanceCible
        return auRepos
      }
      const ecart = Math.abs(Math.log(distanceCible / precedente))
      precedente = distanceCible
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
     * Oublier la distance de référence.
     *
     * ⚠️ **APPELÉ À CHAQUE CHANGEMENT DE MODE, ET C'EST INDISPENSABLE.** En
     * orbite, `controls.target` n'est plus un point au sol : la distance qui en
     * sort est un rayon orbital, d'une tout autre échelle. Sans oubli, la
     * première image du retour en surface comparerait une distance de surface à
     * ce rayon et déclarerait un mouvement énorme — les alentours s'allumeraient
     * à chaque retour d'orbite, pour rien.
     *
     * ⚠️ **ET C'EST CE QUI REND LA BASCULE DE MODE INOFFENSIVE, MESURÉ** :
     * descente complète orbite → sol, 156 écarts relevés
     * (`.banc/R1/mesure-R1.json`, F), **zéro bascule** de part et d'autre de la
     * traversée. Une seule image sur 156 passe le seuil, à `1,07 ×` sa valeur,
     * et elle vient de la CIBLE qui se pose (dégagement au sol) pendant que la
     * caméra ne bouge pas — un aller-retour de trente images, exactement la
     * réserve assumée du §3, pas un saut de régime.
     *
     * ⚠️ **IL N'OUBLIE PAS L'ÉTAT `auRepos`**, seulement la référence : le
     * retour en surface se fait sur une caméra posée, donc au repos.
     */
    oublier() {
      precedente = null
      calme = 0
    },

    /** La vue est-elle au repos ? */
    get auRepos() { return auRepos },
    /** Combien d'images calmes de suite — pour les sondes et les bancs. */
    get calme() { return calme },
    /** Combien de fois le repos a basculé : c'est le compteur de battement. */
    get bascules() { return bascules },
    /** Le dernier `|Δ ln distance|` mesuré — pour les sondes et les bancs. */
    get dernierEcart() { return dernierEcart },
  }
}
