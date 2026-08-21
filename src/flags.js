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

  // LE SOCLE LIT LE QUADTREE — Tâche 6 quinquies.
  //
  // ⚠️ **SON PROPRE DRAPEAU, ET C'EST UNE MESURE QUI L'A EXIGÉ — voir
  // `socleQuadtreeActif()` plus bas, qui porte les chiffres.** En deux mots : sur
  // la TERRE le quadtree et le MNT s'accordent à **1,1 à 2,4 m de moyenne**,
  // mais **EN MER l'écart vaut 642 m (Nice) à 961 m (La Réunion)**, avec un
  // maximum exactement égal à la profondeur du MNT — le quadtree lit **zéro** là
  // où le bloc a un fond marin. `src/dem.js` FUSIONNE la bathymétrie GEBCO
  // (`fuseBathymetry`, `data/bathy/`) ; `src/globe.js` ne la fusionne pas.
  //
  // Le socle des côtes est le produit : un régime qui aplatit la mer ne part pas
  // sous `?globe=continu`, qui est le drapeau qu'on demande à Adrien d'ouvrir.
  // `?socle=quadtree` pour l'essayer (il exige `?globe=continu` : sans la
  // fenêtre bornée, il n'y a pas de nappe à remplir).
  //
  // ⚠️ **CE BLOCAGE-LÀ EST LEVÉ DEPUIS LA TÂCHE 6 sexies (2026-08-21) :
  // `remplirHauteurs` FUSIONNE la bathymétrie.** Les chiffres d'après sont sous
  // `socleQuadtreeActif()`, à côté de ceux d'avant. **Le drapeau reste éteint
  // pour d'autres raisons, et elles y sont écrites** — ce n'est plus la mer.
  socleQuadtree: false,

  // LA FRONTIÈRE DE RENDU — Tâche 1b bis du plan « globe continu ».
  //
  // Le globe cesse d'être ÉTEINT quand le socle s'allume : il est dessiné dans
  // sa PROPRE passe, en fond, avec sa propre caméra placée par la similitude de
  // `src/monde/frontiere-rendu.js`. Le bloc se dessine par-dessus, sur une
  // profondeur effacée.
  //
  // ⚠️ **SON PROPRE DRAPEAU, ET IL N'EST PAS ADOSSÉ À `globeContinu` :** la
  // frontière est orthogonale au tri spatial du quadtree, et on veut pouvoir la
  // regarder tourner sous `?globe=crans` — c'est-à-dire contre le régime de
  // PRODUCTION, seul point de comparaison honnête.
  //
  // ⚠️ **OFF, ET LA RAISON EST ÉCRITE DANS LE PLAN AVANT DE L'ÊTRE ICI :** c'est
  // la seule tâche du chantier dont le plan dise qu'*elle ne peut pas être
  // livrée à l'aveugle*. `src/main.js` n'est chargé par aucun test, et l'Étape 5
  // de la tâche — **regarder tourner, avec Adrien** — n'est pas faite. Ce qui
  // est prouvé l'est par `readPixels` sur une image forcée, pas par un œil.
  //
  // ⚠️ **CE QUI RESTE VISIBLEMENT OUVERT, MESURÉ (voir `frontiere-rendu.js`) :**
  // le bloc est PLAT, la planète est ronde ; à z4 le bord du bloc surplombe la
  // sphère de **538 km**. Aux zooms où le bloc occupe l'écran (z10 et plus fin)
  // l'écart tombe sous **132 m** et ne se voit pas. **C'est un arbitrage
  // d'Adrien, pas un réglage à trouver.**
  //
  // `?frontiere=1` l'essaie, `?frontiere=0` le coupe.
  frontiereRendu: false,

  // LE SEUIL DU SOCLE — Tâche 3 du plan « globe continu », BRANCHÉE.
  //
  // Le socle cesse d'exister à tous les zooms : il naît sous
  // `SEUIL_NAISSANCE_M` (32 274 m) et meurt au-dessus de `SEUIL_MORT_M`
  // (40 343 m, l'hystérésis ×1,25) — voir `src/monde/seuil-socle.js`, dont
  // c'est la loi, et `src/monde/veille-socle.js`, qui en tient l'état.
  //
  // ⚠️ **C'EST LA DEMANDE D'ADRIEN, MOT POUR MOT** : « le crop n'apparaît que
  // lorsque la Terre que l'on zoome occupe une partie assez importante de
  // l'écran ». Il a signalé le défaut à l'écran le 2026-08-21, capture à
  // l'appui : à Z5, un socle posé devant la Terre entière.
  //
  // ⚠️ **IL EXIGE `?frontiere=1`, ET CE N'EST PAS UNE PRUDENCE DE STYLE.** Sans
  // la passe de fond (Tâche 1b bis), le globe est ÉTEINT en mode surface :
  // retirer le socle au-dessus du seuil ne montrerait pas la Terre, ça
  // montrerait le ciel vide. Le seuil n'a de sens que là où les deux mondes
  // coexistent. Même patron que `socleQuadtree`, qui exige `?globe=continu`.
  //
  // ⚠️ **CE QUE ÇA CHANGE, MESURÉ** (`.banc/rejeu-arrivee.mjs`) : l'altitude de
  // cadrage des poses d'arrivée vaut **51,3 km à z10** et **25,7 km à z11**. La
  // bascule tombe donc entre les deux, à mi-chemin des deux seuils — **aucune
  // pose d'arrivée ne les frôle**. En pratique : le socle vit à z11 et plus
  // fin ; de z10 à z4 on voit la planète. Dans un même palier il peut naître ou
  // mourir au dolly (à z10 : naissance à 88,6 unités de distance, mort à
  // 110,8), et c'est exactement le geste continu qu'Adrien décrit.
  //
  // `?seuil=1` l'essaie, `?seuil=0` le coupe.
  seuilSocle: false,
}

// LE SEUIL DU SOCLE — Tâche 3 branchée. ⚠️ **IL EXIGE LA FRONTIÈRE DE RENDU**,
// et la raison est écrite au drapeau : sans la passe de fond, au-dessus du seuil
// il n'y aurait pas la Terre derrière le socle, il n'y aurait rien.
export function seuilSocleActif() {
  if (!frontiereRenduActive()) return false
  const v = paramAdresse('seuil')
  if (v === '0' || v === 'toujours') return false
  if (v === '1' || v === 'altitude') return true
  return FLAGS.seuilSocle
}

// LA FRONTIÈRE DE RENDU — Tâche 1b bis. Même patron d'échappatoire que les
// autres ; volontairement INDÉPENDANT de `globeContinuActif()`, voir le drapeau.
export function frontiereRenduActive() {
  const v = paramAdresse('frontiere')
  if (v === '0' || v === 'crans') return false
  if (v === '1' || v === 'fond') return true
  return FLAGS.frontiereRendu
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

// LE SOCLE LIT LE QUADTREE — Tâche 6 quinquies.
//
// ⚠️ **SON PROPRE DRAPEAU, ET POUR LA MÊME RAISON QUE `exagContinue` : UNE
// MESURE.** Écart entre les hauteurs du quadtree et celles du MNT, relevé le
// 2026-08-21 sur la MÊME grille (769² nœuds, un point sur quatre), MNT chargé et
// les neuf tuiles z12 du socle prêtes :
//
//   | lieu         | terre (moy / max) | mer (moy / max)   |
//   |--------------|-------------------|-------------------|
//   | Chamonix     | **2,4 m** / 71 m  | — (pas de mer)    |
//   | Nice         | **1,1 m** / 26 m  | **642 m** / 1410 m|
//   | La Réunion   | **1,4 m** / 39 m  | **961 m** / 2116 m|
//
// ⚠️ **LE MAXIMUM EN MER EST EXACTEMENT `|dem.minM|`** (1 411 m à Nice, 2 116 m
// à La Réunion) : le quadtree rend **zéro** au point le plus profond. La cause
// est hors du fichier, et c'est le §1 de `/threejs-optimisation` mot pour mot —
// `src/dem.js` FUSIONNE la bathymétrie GEBCO (`fuseBathymetry`, tuiles
// `data/bathy/`) avant de rendre son champ ; `src/globe.js` sert le terrarium
// nu. Le cache du quadtree n'est donc PAS un substitut du MNT sur une côte.
//
// **Ce qu'il faudra pour ouvrir ce drapeau :** fusionner la bathymétrie dans le
// remplissage (`remplirHauteurs`), ou renoncer au socle côtier — et ce n'est pas
// une option.
//
// ══════════ FAIT — Tâche 6 sexies, 2026-08-21 ═══════════════════════════════
//
// ⚠️ **`remplirHauteurs` FUSIONNE MAINTENANT `fuseBathymetry`, ET L'ÉCART
// CI-DESSUS EST TOMBÉ.** Le tableau du haut reste : il dit pourquoi ce drapeau
// existe. Voici celui d'après, mesuré sur les MÊMES emprises et avec les VRAIES
// données (`.banc/accord-6sexies.mjs`, hors dépôt : tuiles d'altitude AWS des
// deux côtés, tuiles bathy de `public/data/bathy/`, grille de 769²) :
//
//   | lieu, zoom        | mer AVANT | mer APRÈS | min flux / min MNT |
//   |-------------------|-----------|-----------|--------------------|
//   | Nice z13          |         — |   1,7 m   | −1 136 / −1 136 m  |
//   | Nice z12          |   615,0 m |   3,2 m   | −1 410 / −1 411 m  |
//   | La Réunion z13    |         — |   0,9 m   |   −588 /   −588 m  |
//   | La Réunion z12    |   485,7 m |   2,1 m   | −1 323 / −1 324 m  |
//
// **Relevé DANS LE NAVIGATEUR** (`?globe=continu&socle=quadtree&f3=0`, réseau de
// cette machine, MNT **Mapterhorn 512 px des deux côtés**, La Réunion z12) :
// `fenetre.minM` = **−2 115,1 m** contre `dem.minM` = **−2 116 m**, écart moyen
// en mer **2,25 m** sur 179 195 nœuds, sur la terre **2,65 m**, et **32,5 % des
// nœuds du socle sont sous le niveau de la mer**. Au cran Z16 sur la Pointe des
// Aigrettes, le cartouche rend `ELEV −64 – −0 m · mean −57 m` — **le même, au
// mètre, que `?globe=crans` et que `?globe=continu`**.
//
// ⚠️ **CE QUI RESTE, ET CE N'EST PLUS LA MER** (voir la Tâche 6 sexies du plan) :
// le coût par image du raffinement n'est pas chronométré `render()` compris ; le
// pic mémoire des `fetchAndBuildDem` concurrents (Tâche 6 septies, jusqu'à huit
// en vol) n'est pas mesuré ; rien n'a été mesuré sur un portable ; et une
// lecture au large de Nice, obtenue après quatre `_coarsen()` enchaînés, montrait
// un socle NON convergé (écart de 37,6 m **sur la terre**, donc étranger à la
// fusion) qu'on n'a pas su reproduire.
//
// ⚠️ **ET IL EXIGE `?globe=continu`** : sans la fenêtre bornée, il n'y a pas de
// nappe rééchantillonnable à remplir. Le crochet n'est même pas posé.
export function socleQuadtreeActif() {
  if (!globeContinuActif()) return false
  const v = paramAdresse('socle')
  if (v === 'mnt' || v === '0') return false
  if (v === 'quadtree' || v === '1') return true
  return FLAGS.socleQuadtree
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
//
// ══════════ LE PILOTE EST REPRIS — Tâche E, 2026-08-21 ══════════════════════
//
// ⚠️ **LE TABLEAU DU HAUT RESTE : IL DIT POURQUOI CE DRAPEAU EXISTE.** Voici
// celui d'après, relevé **dans le navigateur** sur la MÊME descente et au même
// endroit (La Réunion, `?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`
// `&exag=continu`, neuf `_coarsen()` enchaînés, valeurs lues sur `exagPartage`
// et sur `globe.exaggeration`) :
//
//   | zoom | production | ANCIEN pilote (cadrage) | NOUVEAU pilote (cran + f) |
//   |------|------------|-------------------------|---------------------------|
//   | Z12  | ×2,8       | ×2,8                    | **×2,8**                  |
//   | Z8   | ×2,8       | ×2,8                    | **×2,8**                  |
//   | Z7   | ×3,2       | ×2,8 ✗                  | **×3,2** ✓                |
//   | Z6   | ×4         | ×2,8 ✗                  | **×4** ✓                  |
//   | Z5   | ×5         | ×2,8 ✗                  | **×5** ✓                  |
//   | Z4   | ×2,5       | ×2,8 ✗                  | **×2,5** ✓                |
//   | Z3   | ×2,5       | —                       | **×2,5**                  |
//
// **Le gel est levé, et la table d'Adrien est intégralement retrouvée.** La
// cause du gel n'était pas la signature de `zoomCadrage` — elle était propre —
// mais la CAMÉRA : `poseCranContinu` repose `camY × facteurEchelle`, et ce
// facteur porte le rapport des exagérations. Le nouveau pilote lit `_levelZoom`,
// que `_rescale` écrase à zéro AVANT ce repositionnement. Voir le §4 bis de
// `monde/exageration-continue.js` et `test/exageration-globe.test.js`.
//
// ⚠️ **CE DRAPEAU RESTE ÉTEINT, ET POUR UNE RAISON NEUVE : LE COÛT.** Il porte
// désormais AUSSI l'exagération du GLOBE (Tâche E), dont le relief est cuit dans
// les sommets : chaque changement de valeur rend au réseau toutes les tuiles
// prêtes (`setExaggeration` → `_rechargeTuiles`). **Mesuré sur cette machine, La
// Réunion z12 : 4,8 à 6,5 ms de travail synchrone (868 maillages relâchés), puis
// 12 à 21 s pour retrouver ~900 tuiles prêtes** — deux mesures, aller et retour.
// C'est le prix d'un cran, et il n'est pas payable tel quel. La sortie est
// nommée par `_rechargeTuiles` lui-même : déplacer le relief dans le nuanceur de
// sommets. **Ce n'est pas la Tâche E.**
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
