// LE SEUIL DU SOCLE — quand il naît, quand il meurt, et sur quelle emprise.
// Tâche 3 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que la largeur du
// socle, à `landmarks.js`, qui n'importe rien lui-même. Tout se vérifie sous
// node (`test/seuil-socle.test.js`).
//
// ⚠️ CE MODULE EST LE PRODUCTEUR D'`emprise`, que les Tâches 4 bis, 6 et 7
// consomment. Le manque a été signalé quatre fois avant d'être posé.
//
// ══════════ 0. CE QUI EXISTAIT DÉJÀ, ET POURQUOI ÇA NE SUFFISAIT PAS ════════
//
// Le §1 de `/threejs-optimisation` demande de chercher l'abstraction du projet
// AVANT d'écrire. Trois candidates ont été rejouées contre le dépôt :
//
//   · `originesEmprise` (`dem-emprise.js:183`) rend NEUF ORIGINES DE TUILE
//     ENTIÈRES autour d'un bloc central. C'est un calage sur la grille : de
//     deux cadrages voisins, l'emprise saute d'un TIERS DE SOCLE d'un coup.
//     ⚠️ **C'est un cran, c'est-à-dire exactement ce que ce pivot supprime.**
//     Elle reste juste pour ce qu'elle fait — monter un 3×3 de blocs cuits —
//     et elle est inutilisable ici.
//   · `rectFenetre` (`dem-emprise.js:424`) travaille en PIXELS DE MNT à
//     l'intérieur d'un champ déjà chargé, pas en degrés. C'est le consommateur
//     d'une emprise, pas son producteur.
//   · `patchLatLonBBox` (`coast-mask.js:81`) rend bien `{west, south, east,
//     north}` en degrés — mais **d'un `dem` DÉJÀ CHARGÉ**, donc d'une origine
//     de tuile entière, donc calée elle aussi. Et elle tire three.js.
//
// Ce qui EST réutilisé : `blockExtentMeters` / `BLOCK_TILES` de `landmarks.js`,
// « la seule source de la largeur du socle », et un test verrouille l'emprise
// rendue ici contre `latLonToTile` / `tileToLatLon` de `geo.js`, la source de
// vérité du géoréférencement du dépôt. La recopie de ces deux conversions suit
// le précédent explicite de `dem-emprise.js:428` — « RECOPIÉE VOLONTAIREMENT
// plutôt qu'importée : ce module doit rester pur (terrain.js tire three.js) »,
// verrouillée par test.
//
// ══════════ 1. LE ZOOM DU SOCLE — TRANCHÉ ICI, PARCE QUE PERSONNE NE L'AVAIT
//
// ⚠️ TANT QUE CETTE QUESTION EST OUVERTE, AUCUN SEUIL D'ALTITUDE N'EXISTE : la
// largeur du socle varie d'un facteur HUIT entre z13 et z16, et le seuil lui
// est proportionnel. Exécuté à 45° de latitude (`blockExtentMeters`, vérifié) :
//
//   z11 = 41 510 m · z12 = 20 755 m · z13 = 10 377 m
//   z14 =  5 189 m · z15 =  2 594 m · z16 =  1 297 m
//
// ⚠️ Et « un socle de 3,56 km » ne correspond à AUCUN de ces zooms : c'est le
// fantôme que le plan a réfuté, et dont six de ses chiffres descendaient.
//
// **ZOOM_SOCLE = 13, et la raison est la règle R3, pas le goût.**
//
// R3 mesure qu'à froid le zoom effectif plafonne à **z11 sur 12 Mb/s** et
// **z9 sur 4 Mb/s**, et elle pose son propre chiffre de disqualification :
// **48 texels sur la largeur du socle** — « ce n'est plus le flou accepté par
// la décision 13, c'est une autre carte ». Rejoué (`metersPerPixel`, 45°) :
//
//   | socle | rempli à z11 (12 Mb/s) | rempli à z9 (4 Mb/s) |
//   | z13   | **192 texels** — flou  | 48 texels — refusé   |
//   | z15   | **48 texels** — refusé | 12 texels — refusé   |
//
// **Un socle z15 tombe EXACTEMENT sur le chiffre que R3 disqualifie, et il y
// tombe dès 12 Mb/s** — c'est-à-dire sur un réseau ordinaire, pas sur un cas
// dégradé. z13 est le zoom le plus fin dont la dégradation au plafond mesuré
// reste du flou. C'est la seule des trois règles qui tranche entre les zooms.
//
// Deux vérifications d'encadrement, toutes deux au dépôt :
//   · `globe.js` porte `MAX_Z = 15` (Tâche 4 quater). Le socle est
//     RÉÉCHANTILLONNÉ depuis le cache du quadtree (décision d'architecture du
//     §4) : un socle AU plafond n'aurait aucune marge, z13 en garde deux.
//   · `DEFAULT_FINE_ZOOM = 15` (`main.js:3095`) est le zoom du bloc
//     d'AUJOURD'HUI. ⚠️ **Ce n'est pas un argument contre** : le bloc actuel est
//     CUIT à son zoom, la fenêtre bornée est RÉÉCHANTILLONNÉE — la finesse ne
//     vient plus de l'emprise mais du niveau que le quadtree a atteint dessus.
//     Le socle z13 est plus large, pas plus grossier.
//
// ══════════ 2. LE SEUIL — 60 % DE LA HAUTEUR DE L'IMAGE ═════════════════════
//
// Demande d'Adrien : « le crop n'apparaît que lorsque la Terre que l'on zoome
// occupe une partie assez importante de l'écran ». Traduit en fraction d'image,
// et le plan vise **60 %**.
//
// ⚠️ **60 % DE LA HAUTEUR, ET LINÉAIREMENT.** Deux facteurs se cachent là :
//   · le champ de vision de three.js **EST VERTICAL** (`PerspectiveCamera.fov`),
//     et la ligne `fov: 30` des réglages de `main.js` le pose à **30°**
//     (⚠️ **PAS** `main.js:263` : citation fausse, corrigée le 2026-08-21).
//     Prendre la largeur déplacerait le
//     seuil du rapport d'aspect — **1,7 en 16/9** ;
//   · 60 % LINÉAIRE n'est pas 60 % SURFACIQUE. Si l'on avait voulu dire
//     « 60 % des pixels », la fraction linéaire vaudrait √0,6 = 0,775, soit
//     **1,29 fois plus**, et l'altitude 1,29 fois moins. **On prend le
//     linéaire**, parce que c'est la grandeur qu'un œil juge — un objet qui
//     « fait la moitié de l'écran » en fait la moitié en HAUTEUR.
//     Pour mémoire : un socle carré occupant 60 % de la hauteur couvre 20 % de
//     la SURFACE d'une image 16/9 (0,6² / (16/9)).
//
// ⚠️ **LA CIRCULARITÉ EST LEVÉE AVANT LE CALCUL, ET C'EST LA CONDITION DU
// SENS.** Si l'emprise suivait le cadrage, la fraction d'écran serait constante
// par construction et ne pourrait pas servir de seuil. Le calcul se fait donc à
// **LARGEUR DE SOCLE FIXE** — celle de `ZOOM_SOCLE`, tranchée ci-dessus. La
// décision 3 (« le socle suit le cadrage en continu ») porte sur la POSITION de
// l'emprise, pas sur sa largeur, qui reste celle de `ZOOM_SOCLE`.
//
// ⚠️ **PUIS ON NE GARDE QUE L'ALTITUDE** — règle R1. La fraction d'écran
// dépend de la distance au SOL, donc du terrain chargé, donc de `meanM`, qui
// est lissé : gain plus retard font un oscillateur, et le précédent Cesium est
// exact. L'entrée de `socleVisible` est l'**altitude géométrique au-dessus de
// l'ellipsoïde**, celle que `src/loi-altitude.js` porte sans `meanM`.
//
// LA CONVENTION GÉOMÉTRIQUE, ÉCRITE POUR QU'ON PUISSE LA CONTREDIRE : la
// hauteur de sol vue vaut `2 · altitude · tan(fov/2)`, c'est-à-dire la visée au
// NADIR. La caméra d'arrivée est oblique (pente 18/19, `loi-altitude.js`), ce
// qui étire le sol le long de l'axe de profondeur et raccourcit le socle à
// l'image. **La fraction réelle est donc un peu SOUS les 60 %, et le socle naît
// un peu plus tard qu'annoncé.** Non mesuré à l'écran — aucun test ne rend une
// image. C'est la première chose à vérifier quand Adrien regardera.
//
// ⚠️ **LA LATITUDE N'EST PAS DANS LA SIGNATURE, ET C'EST UN CHOIX.** Le socle
// est un carré de MERCATOR : sa largeur au sol varie en `cos(lat)`. Les deux
// seuils sont ancrés à **45°**, la latitude de référence du plan. Conséquence
// exacte, à seuil constant : le socle occupe **85 % de la hauteur à
// l'équateur** et **42 % à 60° de latitude** au lieu de 60 %. La rendre
// variable est une ligne de code — mais la signature qu'attendent les Tâches
// 4 bis, 6 et 7 est `{ altitudeEllipsoideM, visibleAvant }`, et un seuil qui
// bouge avec le lieu est une grandeur de plus à faire coïncider entre modules.
// **À rouvrir si l'écart se voit ; il n'a pas été mesuré à l'écran.**
//
// ══════════ 3. LE LIEN ENTRE R1 ET R3 — CE QUE LE PLAN NE TRANCHAIT NULLE PART
//
// Le socle **naît sur une altitude** (R1) mais **se remplit à un zoom** que le
// réseau borne (R3). Le plan pose la question au §9 et n'y répond pas. Elle est
// tranchée ici, et la réponse est **le socle naît quand même, à la résolution
// disponible** :
//
//   · **Il n'ATTEND pas.** Attendre, c'est un voile de chargement sans le
//     voile : l'utilisateur descend et rien n'arrive. C'est le pop-up qu'Adrien
//     veut voir disparaître, déguisé en absence.
//   · **Le seuil NE SE DÉCALE PAS.** Le zoom soutenable se déduit du débit
//     OBSERVÉ, qui se dégrade quand le socle demande ses tuiles : un seuil qui
//     en dépendrait fermerait la boucle « socle → trafic → débit → seuil →
//     socle ». ⚠️ **C'est mot pour mot l'oscillateur que R1 interdit**, avec le
//     retard en plus. La règle R1 ne parle pas que de `meanM` : elle parle de
//     toute grandeur dérivée de ce qui est chargé, et `zoomEffectif` en est une.
//   · **Ce qui varie, c'est le REMPLISSAGE, jamais l'EMPRISE.** `empriseSocle`
//     rend toujours la même largeur géographique à `ZOOM_SOCLE` ; l'appelant
//     demande au flux de la remplir à `min(ZOOM_SOCLE, zoomSoutenable(...))`.
//     Un socle dont l'emprise rétrécirait avec la bande passante changerait de
//     TAILLE À L'ÉCRAN quand le réseau tousse — c'est le cran, revenu par la
//     porte du réseau.
//   · Ce que l'utilisateur voit alors est déjà tranché par Adrien (§9,
//     2026-08-20) : **un indicateur discret**, pas un voile.
//
// ⚠️ **ET LE SOCLE NAÎT DE TOUTE FAÇON UN CRAN GROSSIER, RÉSEAU PARFAIT
// COMPRIS.** Dérivé des constantes de `globe.js` (`SPLIT_RATIO = 0,38`,
// `dist = |cam − centre| − corde/2`, corde = diagonale de tuile) : à l'altitude
// de naissance, le rapport de la tuile `ZOOM_SOCLE` vaut 0,164 et celui de
// `ZOOM_SOCLE − 1` vaut **0,357 — 6 % sous le seuil de division**. Le quadtree
// dessine donc `ZOOM_SOCLE − 1` à la naissance, et atteint `ZOOM_SOCLE` à
// **94,9 % de l'altitude de naissance** (30,6 km pour 32,3 km). Le calcul est
// invariant d'échelle : il ne dépend PAS du zoom choisi, seulement du couple
// (fraction d'écran, `SPLIT_RATIO`). **Cinq pour cent de descente entre les
// deux : c'est un fondu, pas un cran** — et c'est ce qui rend la décision 4
// (« le socle complet apparaît d'un coup ») tenable. ⚠️ **Dérivé, PAS mesuré à
// l'exécution** : aucun test ne fait tourner le quadtree.

import { blockExtentMeters, BLOCK_TILES } from '../landmarks.js'

// ══════════ 4. LES CONSTANTES, ET LEUR SOURCE ═══════════════════════════════

// Le zoom auquel le socle se pose — arbitrage du §1 ci-dessus.
export const ZOOM_SOCLE = 13

// La latitude d'ancrage des deux seuils — celle du plan, « exécuté à 45° ».
export const LAT_REFERENCE = 45

// `params.fov` — la ligne `fov: 30` des réglages de `main.js` (⚠️ **pas**
// `main.js:263`, qui parle du maillage du bloc central ; citation corrigée le
// 2026-08-21). ⚠️ VERTICAL : c'est le champ de three.js.
//
// ⚠️ **C'EST UN DÉFAUT, PAS UNE CONSTANTE DE L'APPLICATION.** Relevé le
// 2026-08-21 dans la console, session réelle : `params.fov = 33`,
// `camera.fov = 33`, `camGlobe.fov = 33` — `templates-user.js` sauvegarde
// `'fov'`, donc un template appliqué au démarrage repose `params.fov`. Les deux
// seuils ci-dessous sont donc dérivés à 30° pendant que la caméra en fait 33.
// **Conséquence exacte, calculée et non supposée :** à `SEUIL_BLOC_M` (⚠️ nom
// corrigé le 2026-09-04 : sous D21 ce commentaire citait `SEUIL_NAISSANCE_M`,
// qui valait alors un palier de 600 km sans aucun rapport avec le fov), un
// socle vu à 33° occupe `0,6 × tan(15°)/tan(16,5°)` = **54,3 % de la hauteur**
// au lieu de 60 %. C'est le MÊME sens que l'obliquité de la caméra d'arrivée et
// que la latitude (les deux écrits plus haut) : **les trois écarts vont dans la
// même direction — le socle est plus petit à l'écran qu'annoncé quand il naît.**
// Non corrigé ici : un seuil qui suivrait le fov en vol serait une grandeur de
// plus à faire coïncider entre modules, et la signature qu'attendent les Tâches
// 4 bis, 6 et 7 est `{ altitudeEllipsoideM, visibleAvant }`. **À rouvrir avec
// les deux autres, quand Adrien regardera.**
export const FOV_DEG = 30

// La demande d'Adrien, traduite : « une partie assez importante de l'écran ».
// ⚠️ LINÉAIRE, SUR LA HAUTEUR. Voir le §2.
export const FRACTION_NAISSANCE = 0.6

// L'hystérésis, au même rapport que `globe.js:79` : `MERGE_RATIO =
// SPLIT_RATIO × 0,8`. Même grandeur (une taille angulaire relative), même
// patron, éprouvé sur ce dépôt. Le socle meurt donc quand il ne couvre plus que
// `0,6 × 0,8 = 48 %` de la hauteur, soit `1 / 0,8 = 1,25` fois plus haut qu'il
// n'est né.
export const RAPPORT_HYSTERESIS = 0.8

// La limite de couverture de Web Mercator — `geo.js:11`, `MERCATOR_MAX_LAT`.
export const MERCATOR_LAT_MAX = 85.05112878

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// ══════════ 5. LA TRIGONOMÉTRIE DU CHAMP, DANS LES DEUX SENS ════════════════

// La hauteur de sol embrassée par l'image, au nadir : `2 · h · tan(fov/2)`.
function hauteurVueM(altitudeM, fovDeg) {
  return 2 * altitudeM * Math.tan((fovDeg * D2R) / 2)
}

/**
 * La fraction de la HAUTEUR de l'image qu'occupe un objet large de `largeurM`,
 * vu depuis `altitudeM`. C'est la grandeur qu'Adrien décrit ; elle ne sert
 * QU'À dériver les seuils, jamais à décider en vol — règle R1.
 */
export function fractionEcran({ largeurM, altitudeM, fovDeg = FOV_DEG }) {
  return largeurM / hauteurVueM(altitudeM, fovDeg)
}

/** L'inverse : l'altitude à laquelle un objet large de `largeurM` occupe `fraction`. */
export function altitudePourFraction({ largeurM, fraction, fovDeg = FOV_DEG }) {
  return largeurM / (2 * fraction * Math.tan((fovDeg * D2R) / 2))
}

// ══════════ 6. LES DEUX SEUILS — DÉRIVÉS, JAMAIS POSÉS ══════════════════════
//
// ⚠️ Ils ne sont pas écrits en chiffres, ET C'EST DÉLIBÉRÉ. Le §0 du plan
// interdit un chiffre sans sa source ; ici la source EST le calcul. Si
// `blockExtentMeters` change, si le champ de vision change, si le zoom du socle
// change, les seuils suivent — au lieu de mentir en silence.
//
// Leurs valeurs d'aujourd'hui, pour mémoire et pour la relecture :
//
//   LARGEUR_SOCLE_M    =  10 377,4 m   (z13 à 45°)
//   SEUIL_BLOC_M       =  32 274,3 m   (60 % de la hauteur — ARRIVÉE AU BLOC)
//   SEUIL_BLOC_MORT_M  =  40 342,8 m   (48 % de la hauteur, ×1,25)
//   SEUIL_NAISSANCE_M  =  32 274,3 m   (D23 : la MÊME VALEUR, un AUTRE SENS)
//   SEUIL_MORT_M       =  40 342,8 m   (idem — ET une intention, D21 ① reste)
//
// ⚠️ **QUATRE CONSTANTES, DEUX VALEURS, ET C'EST VOULU (D23).** Les deux paires
// coïncident aujourd'hui ; elles ne portent pas le même sens (géométrie du crop
// et régime de gestes d'un côté, arrivée au bloc et estompage de l'autre). Voir
// le §6 bis.
//
// ⚠️ Pour situer : le plan avait d'abord écrit **120 km et 180 km**. À 120 km,
// ce socle-ci occupe **16,1 %** de la hauteur de l'image — et le socle fantôme
// de 3,56 km n'en occupait que 5,5 %. Les deux seuils d'origine étaient donc
// trop hauts d'un facteur ~3,7, et non d'un facteur dix-huit comme le disait la
// réfutation, qui reposait elle-même sur la largeur fantôme.

export const LARGEUR_SOCLE_M = blockExtentMeters(ZOOM_SOCLE, LAT_REFERENCE)

// ══════════ 6 bis. D23 — LE CROP REVIENT À Z10, MAIS LES TROIS GRANDEURS
//                  RESTENT SÉPARÉES ═══════════════════════════════════════════
//
// > **Adrien, 2026-09-04 (D23) :** *« Il y a beaucoup trop de bugs, on va
// > laisser un crop à partir de Z10 uniquement. Annule le crop à Z7. »*
//
// ⛔ **D21 ② est ABROGÉ** : la naissance du crop n'est plus le palier z7 (600 km)
// mais de nouveau la fraction d'écran de 60 %, `SEUIL_BLOC_M` = 32 274,3 m.
// La mesure qui l'a fait abroger (C1) : à 600 km le crop coûtait **495 → 1 700
// tuiles** — 1 700 étant exactement `CACHE_MAX_CONTINU` — et **19,9 → 129,9 ms
// par image à CPU ×4**, sans que z8 ni z9 rachètent rien.
//
// ⚡ **CE QUI SURVIT À L'ABROGATION, ET C'EST L'ESSENTIEL** : la séparation
// ci-dessous. Elle a été faite POUR z7 mais elle vaut INDÉPENDAMMENT de lui.
//
// ⚠️ **CE PARAGRAPHE SÉPARE TROIS GRANDEURS QUE CE FICHIER APPELAIT
// `SEUIL_NAISSANCE_M` À LUI TOUT SEUL.** Jusqu'à D21, la même altitude
// (32 274,3 m) décidait de :
//   ① la naissance de la GÉOMÉTRIE du crop (`branchement-crop.js:897`) ;
//   ② l'arrivée « au bloc » de D16 ter, donc **la bascule de trois quarts**
//      (`main.js` → `arriveeSurLeBloc` → `modes.js:1996`) ;
//   ③ le haut du fondu d'estompage de la planète (`estompage-terre.js:115`,
//      via `SEUIL_MORT_M`).
//
// **Ce que déplacer ① tout seul faisait aux deux autres, mesuré par C1 :**
//   · déplacer ② inclinait la caméra **à 600 km** — la vue de trois quarts
//     arrivait en vue continentale, ce que D16 ter interdit mot pour mot
//     (« pas avant ») ; relevé `tiltDeg = 48,77°` à 650 km ;
//   · déplacer ③ effaçait la planète **depuis 750 km** : à 100 km le fondu
//     rendait **0,576** au lieu de **0** — la Terre à moitié gommée en vue
//     régionale, sur un seuil que personne n'a demandé de bouger ;
//   · et ① portait une QUATRIÈME chose que personne n'avait vue : le **régime
//     de gestes** (`horsDuCrop`). Sur `pose`, OrbitControls reprenait les trois
//     boutons entre 600 km et 32 km — `{LEFT:0, MIDDLE:2, RIGHT:2}` relevé —
//     donc D19 amputé de **568 km** et le clic droit redevenu un PAN, c'est-à-
//     dire **la deuxième sortie du crop d'Adrien disparue**.
//
// ➡️ **D23 ramène ① à la valeur de ②, PAS à la constante de ②.** Les deux paires
// coïncident de nouveau en valeur, et c'est précisément pour ça qu'il serait
// tentant — et faux — de les refusionner : la prochaine fois qu'un seuil bouge,
// le défaut ci-dessus reviendrait entier. ⛔ **Elles restent quatre.**

/**
 * **L'ARRIVÉE AU BLOC** — l'altitude à laquelle le socle occupe
 * `FRACTION_NAISSANCE` de la hauteur de l'image. **32 274,3 m.**
 *
 * ⚠️ **C'EST LE SEUIL D'AVANT D21, AU BIT PRÈS**, et il ne s'est jamais déplacé :
 * ni D21 ni D23 ne bougent la bascule de trois quarts ou l'estompage. C'est
 * aussi cette valeur dont `zoomDepuisAltitude(…, {lat: 45})` rend exactement
 * `ZOOM_SOCLE` (`exageration-continue.js` §3, verrouillé par test) — le lien
 * que le brief C1 demande de ne pas casser en silence. Il ne l'est pas : il
 * change simplement de nom du côté de ce fichier.
 */
export const SEUIL_BLOC_M = altitudePourFraction({
  largeurM: LARGEUR_SOCLE_M,
  fraction: FRACTION_NAISSANCE,
})

/**
 * L'hystérésis de l'arrivée au bloc — **40 342,8 m**, le seuil de mort d'avant
 * D21. C'est le haut du fondu d'estompage (`ALT_ESTOMPAGE_DEBUT_M`), et
 * l'estompage reste accroché ICI, pas à `SEUIL_MORT_M` : les deux valent la même
 * chose depuis D23, mais seul celui-ci dit « le socle remplit l'écran ».
 */
export const SEUIL_BLOC_MORT_M = altitudePourFraction({
  largeurM: LARGEUR_SOCLE_M,
  fraction: FRACTION_NAISSANCE * RAPPORT_HYSTERESIS,
})

/**
 * **LE PALIER DE PLONGÉE z7**, en mètres — `DIVE_TIERS` de `modes.js`,
 * l'entrée `{ altM: 600000, zoom: 7 }`.
 *
 * ⛔ **D23 : PLUS AUCUN SEUIL N'EN DESCEND.** Il a porté `SEUIL_NAISSANCE_M`
 * entre D21 et D23 ; la mesure de C1 (495 → 1 700 tuiles, 19,9 → 129,9 ms à
 * CPU ×4) a fait abroger D21 ②. La constante reste exportée et **verrouillée
 * par test contre `DIVE_TIERS`** — c'est le seul lien pur du dépôt vers cette
 * table, et le rendre muet ferait disparaître la garde avec lui.
 *
 * ⚠️ **RECOPIÉ, PAS IMPORTÉ.** Ce module est PUR ; `modes.js` tire three.js.
 * Le précédent est explicite dans ce fichier même (les deux conversions de
 * `geo.js`, §8, « recopiées volontairement plutôt qu'importées »).
 */
export const ALT_PALIER_Z7_M = 600_000

/**
 * **LA NAISSANCE DU CROP — D23.** Retour à la paire z10 : la même altitude que
 * `SEUIL_BLOC_M`, **32 274,3 m**, la fraction d'écran de 60 %.
 *
 * ⚠️ **ET POURTANT ELLE RESTE UNE CONSTANTE À PART, C'EST LE CŒUR DE D23.**
 * Elle vaut aujourd'hui la même chose que `SEUIL_BLOC_M`, mais elle ne dit pas
 * la même chose : celle-ci décide de la **géométrie du crop** et du **régime de
 * gestes** (`horsDuCrop`, donc D19 au clic droit) ; `SEUIL_BLOC_M` décide de
 * l'**arrivée au bloc** (D16 ter : la bascule de trois quarts et son miroir, le
 * retour au nadir) et de l'**estompage**. ⛔ **On ne les refusionne pas.**
 * Les avoir confondues coûtait, au seul changement de valeur, une amputation de
 * D19 sur 568 km et la disparition de la deuxième sortie du crop (C1, réfutation
 * n° 5). C'est la classe de défaut revenue dix fois sur ce chantier : plusieurs
 * sens portés par une seule grandeur.
 */
export const SEUIL_NAISSANCE_M = SEUIL_BLOC_M

/**
 * **LA MORT DU CROP** — D23 : la paire z10, donc **40 342,8 m**, la même valeur
 * que `SEUIL_BLOC_MORT_M` (hystérésis `1 / 0,8 = ×1,25`). Constante à part pour
 * la même raison que ci-dessus.
 *
 * ⚠️ **ET DEPUIS D21 ①, LA FRANCHIR NE SUFFIT PLUS — D23 garde D21 ① entière.**
 * La mort demande EN PLUS une INTENTION de sortie — voir `sortieArmee` au §7.
 * Sans elle, l'inclinaison, le cap et les boutons de caméra peuvent monter aussi
 * haut qu'ils veulent : le crop reste.
 */
export const SEUIL_MORT_M = SEUIL_BLOC_MORT_M

// ══════════ 7. LA BASCULE ═══════════════════════════════════════════════════

/**
 * Le socle est-il visible à cette image ?
 *
 * ⚠️ **L'ENTRÉE EST UNE ALTITUDE DE CAMÉRA AU-DESSUS DE L'ELLIPSOÏDE**, en
 * mètres — celle que `src/loi-altitude.js` porte, SANS `meanM`. Ni fraction
 * d'écran, ni distance au sol, ni débit, ni zoom effectif : règle R1.
 *
 * ⚠️ **`visibleAvant` N'EST PAS UN CONFORT : c'est l'hystérésis.** La fonction
 * est un automate à deux états, pas un prédicat. Sans l'état d'avant, les deux
 * seuils n'ont aucun moyen de s'appliquer et la bascule redevient un seul
 * seuil — donc un clignotant, dès qu'un doigt tremble à l'altitude limite.
 *
 * Une altitude non finie conserve l'état : elle ne peut pas être une raison de
 * faire apparaître ou disparaître le socle.
 *
 * ⚡ **`sortieArmee` — D21 ①, ET C'EST LA SEULE NOUVEAUTÉ DE LA LOI.**
 *
 * > *« Je voudrais que lorsqu'on passe en mode crop, on ne puisse plus revenir
 * > en mode non crop uniquement par l'altitude. »*
 *
 * Le crop ne meurt QUE si un geste de dézoom explicite l'a armé. Tant qu'il
 * vaut `false`, franchir `SEUIL_MORT_M` ne fait rien : l'inclinaison, le cap,
 * les boutons de caméra, le redressement automatique, le vol de présentation et
 * le recalage peuvent faire monter l'altitude autant qu'ils veulent.
 *
 * ⚠️ **IL NE PORTE QUE SUR LA MORT, JAMAIS SUR LA NAISSANCE** — D21 le dit
 * expressément (« la naissance, elle, garde son seuil »). Un `sortieArmee`
 * faux ne peut donc pas empêcher le crop de naître, et un `sortieArmee` vrai
 * ne peut pas le faire naître plus haut.
 *
 * ⚠️ **SON DÉFAUT EST `true`, ET C'EST DÉLIBÉRÉ.** Cette fonction reste la loi
 * PURE des deux seuils : sans argument, elle décrit l'automate d'altitude nu,
 * celui que `test/seuil-socle.test.js` verrouille depuis la Tâche 3. C'est
 * l'APPELANT (`veille-socle.js`, `branchement-crop.js`) qui porte l'intention,
 * parce que c'est lui qui a la mémoire — exactement comme `visibleAvant`.
 *
 * @param {{altitudeEllipsoideM:number, visibleAvant?:boolean, sortieArmee?:boolean}} [etat]
 * @returns {boolean}
 */
export function socleVisible({ altitudeEllipsoideM, visibleAvant = false, sortieArmee = true } = {}) {
  const dedans = !!visibleAvant
  if (typeof altitudeEllipsoideM !== 'number' || !Number.isFinite(altitudeEllipsoideM)) return dedans
  if (dedans) return sortieArmee ? altitudeEllipsoideM < SEUIL_MORT_M : true
  return altitudeEllipsoideM <= SEUIL_NAISSANCE_M
}

/**
 * **L'ARRIVÉE AU BLOC** — le MÊME automate à deux seuils, mais sur
 * `SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M`, et **sans intention** : c'est un fait
 * géométrique (« le socle remplit 60 % de la hauteur »), pas un geste.
 *
 * ⚠️ **C'EST LE DÉPARTAGE DEMANDÉ PAR D21 ② / le brief C1 § « départage ».**
 * `veilleCrop.repos` — donc `arriveeSurLeBloc`, donc la bascule de trois quarts
 * de D16 ter — se lisait sur la naissance du crop. Depuis que la naissance
 * monte à 600 km, la lire là inclinerait la caméra en vue continentale. Elle se
 * lit désormais ici.
 *
 * @param {{altitudeEllipsoideM:number, auBlocAvant?:boolean}} [etat]
 * @returns {boolean}
 */
export function auBloc({ altitudeEllipsoideM, auBlocAvant = false } = {}) {
  const dedans = !!auBlocAvant
  if (typeof altitudeEllipsoideM !== 'number' || !Number.isFinite(altitudeEllipsoideM)) return dedans
  return dedans ? altitudeEllipsoideM < SEUIL_BLOC_MORT_M : altitudeEllipsoideM <= SEUIL_BLOC_M
}

// ══════════ 8. L'EMPRISE ════════════════════════════════════════════════════
//
// ⚠️ **CONTINUE, PAS CALÉE SUR LA GRILLE DE TUILES.** C'est le pivot lui-même :
// « un Google Maps like, pas des crans ». Une emprise calée sur des origines
// entières (ce que fait `originesEmprise`) sauterait d'un TIERS DE SOCLE d'un
// cadrage au suivant. Un test rejoue 400 déplacements d'un cent-millième de
// degré et exige que l'emprise suive au même pas.
//
// Conventions, celles que la Tâche 6 exige :
//   · degrés ; `ouest > est` signifie **franchissement de l'antiméridien** —
//     c'est légal, et `bathy-sources.js:119` porte déjà cette convention ;
//   · latitudes **écrêtées** à `MERCATOR_LAT_MAX` — le prototype y était
//     « silencieusement faux mais fermé » ;
//   · quand `BLOCK_TILES` tuiles font le tour du monde (zoom 0 et 1), il n'y a
//     plus rien à contraindre en longitude : `-180 … 180`, la convention de
//     `bathy-sources.js:268` et de `blockFitMeters`.

// Les deux conversions de `geo.js`, recopiées et VERROUILLÉES PAR TEST — voir
// le §0. Elles diffèrent des originales sur un seul point, délibéré : la
// latitude d'entrée est écrêtée avant projection, sans quoi un pôle rendrait
// un infini.
function tuileX(lon, zoom) {
  return ((lon + 180) / 360) * 2 ** zoom
}

function tuileY(lat, zoom) {
  const la = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat)) * D2R
  return ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * 2 ** zoom
}

function latDeTuile(ty, zoom) {
  const n = 2 ** zoom
  const borne = Math.max(0, Math.min(n, ty))
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * borne) / n))) * R2D
  return Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat))
}

// Ramène une longitude dans [-180, 180[.
function enroulerLon(lon) {
  return (((lon + 180) % 360) + 360) % 360 - 180
}

/**
 * L'emprise géographique du socle, centrée sur `centre`.
 *
 * ⚠️ **C'EST LE PRODUCTEUR D'`emprise` DU PLAN.** Les Tâches 4 bis
 * (`demanderEmprise`, `tuilesPretes`, `remplirHauteurs`), 6 (`construireFenetre`)
 * et 7 (`empriseADerive`) la consomment toutes.
 *
 * ⚠️ **LE `zoom` FIXE LA LARGEUR, PAS LA FINESSE.** Le défaut `ZOOM_SOCLE` est
 * la largeur sur laquelle les deux seuils ont été dérivés : la changer en vol
 * ferait changer le socle de taille à l'écran. La finesse, elle, est le niveau
 * que le quadtree a réellement atteint sur cette emprise — c'est
 * `zoomEffectif`, et il vit dans le flux, pas ici (voir le §3).
 *
 * @param {{centre:{lat:number, lon:number}, zoom?:number, tuilesParBloc?:number}} arg
 * @returns {{ouest:number, sud:number, est:number, nord:number}} en degrés
 */
export function empriseSocle({ centre, zoom = ZOOM_SOCLE, tuilesParBloc = BLOCK_TILES } = {}) {
  const lat = Number(centre?.lat)
  const lon = Number(centre?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError('empriseSocle : `centre` doit porter des `lat` et `lon` finis')
  }
  const n = 2 ** zoom
  const demi = tuilesParBloc / 2
  const ty = tuileY(lat, zoom)
  const nord = latDeTuile(ty - demi, zoom)
  const sud = latDeTuile(ty + demi, zoom)

  // le bloc fait le tour du monde : plus rien à contraindre en longitude
  if (tuilesParBloc >= n) return { ouest: -180, sud, est: 180, nord }

  const largeurDeg = (tuilesParBloc / n) * 360
  const ouest = enroulerLon(((tuileX(lon, zoom) - demi) / n) * 360 - 180)
  // ⚠️ `est` se DÉDUIT d'`ouest`, il ne se réenroule pas séparément : sinon une
  // arête tombant pile sur 180° rendrait -180 et signalerait un franchissement
  // de l'antiméridien qui n'existe pas.
  let est = ouest + largeurDeg
  if (est > 180) est -= 360
  return { ouest, sud, est, nord }
}
