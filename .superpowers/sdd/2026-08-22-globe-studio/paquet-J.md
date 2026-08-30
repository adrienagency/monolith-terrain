de51c53 tache J : LA SURFACE PLEINE — la mer a un fond, elle s arrete au bloc, et ce qui reste faux est nomme

 docs/superpowers/plans/2026-08-22-globe-studio.md | 287 ++++++++++++++++++++++
 src/globe.js                                      |  98 +++++++-
 src/main.js                                       | 110 ++++++++-
 src/monde/flux-terrain.js                         |  87 ++++++-
 src/monde/mer-sphere.js                           |  87 +++++++
 test/fenetre-branchee.test.js                     |  13 +-
 test/flux-terrain.test.js                         | 120 +++++++++
 test/mer-sphere.test.js                           | 166 ++++++++++++-
 8 files changed, 944 insertions(+), 24 deletions(-)

diff --git a/docs/superpowers/plans/2026-08-22-globe-studio.md b/docs/superpowers/plans/2026-08-22-globe-studio.md
new file mode 100644
index 0000000..97dbf61
--- /dev/null
+++ b/docs/superpowers/plans/2026-08-22-globe-studio.md
@@ -0,0 +1,287 @@
+# Plan — LE STUDIO SUR LE GLOBE
+
+> Successeur de `2026-08-21-terre-unique.md`, qui a livré la structure (tâches A–I).
+> Ce plan-ci livre **le rendu et le studio**. Il ne recommence rien de ce qui est porté.
+
+## §0 — Ce qui gouverne, et qui n'est pas négociable
+
+**Le verdict d'Adrien sur l'état livré : « clairement catastrophique ».** Accepté sans
+discussion. La structure tient (une seule Terre, aucune couture, zoom sans cran), **l'image
+non**. Ce plan répare l'image et adapte le studio.
+
+### Les consignes d'Adrien (2026-08-21, nuit)
+
+- **D1 — Zéro niveau, zéro saut, ET FONDU ENTRE NIVEAUX.** Plus d'indicateur `ORB`/`Z12`,
+  plus d'accrochage de caméra, plus de pause de chargement, **et les niveaux se fondent**.
+- **D2 — LE BLOC GRANDIT EN CONTINU DEPUIS LA SPHÈRE.** Pas de seuil, pas d'apparition.
+  ⚠️ **`seuil-socle.js` et ses deux seuils DISPARAISSENT** au profit d'une loi continue.
+- **D3 — TOUTES LES OPTIONS EXISTANTES SONT CONSERVÉES ET ADAPTÉES.**
+  *« shibumap est une solution complète studio de création de map »*. **Aucune option ne se
+  perd en route.** Ce n'est pas une refonte esthétique : c'est une adaptation **exhaustive**,
+  option par option, **vérifiée une par une**.
+- **D5 — LE MODE PLAT : NE PAS Y TOUCHER.** *« ne le modifie pas, garde-le juste de côté »*.
+  ⛔ **Interdiction de modifier `terrain.js`, `plinth.js`, `ocean.js` et le chemin bloc.**
+  Tout ce qui est neuf vit à côté, derrière `?terre=unique`.
+  ➡️ **La dépose est ANNULÉE. Le défaut de chanfrein d'`ocean.js` (+41,4 %) reste tel quel.**
+- **D6 — L'EXAGÉRATION : ≈2 AU ZOOM MAXIMAL, VARIATION LIMITÉE.**
+- **D7 — LES TROUS D'ABORD.** *« les maps sont clairement vides de surface »*.
+  **La surface pleine passe AVANT le rendu.** Une belle rampe sur une surface vide ne vaut rien.
+- **D8 — REPENSER POUR LA SPHÈRE, ne pas transposer le plat.**
+
+### Les règles de vérification héritées — SEPT façons dont un banc a menti ici
+
+1. **`autoClear === false`** : la cible n'est jamais nettoyée → une preuve de couverture naïve
+   rend **1,0 TOUJOURS**. Payé deux fois.
+2. **`getClearAlpha()` vaut 1** : compter les pixels d'alpha non nul rend **262 144 / 262 144**.
+   **On CACHE l'objet et on compte ce qui CHANGE.**
+3. **L'atmosphère et les nuages remplissent le cadre** — à masquer **des deux côtés**.
+   ⚠️ **On ne mesure pas son propre effet avec un banc qui masque ce qu'on modifie.**
+4. **Un « témoin » qui rend la mauvaise scène** : `x.scene` est le SOCLE, le globe vit dans
+   `sceneGlobe`. Un écart de zéro partout, qui ressemble à une réussite.
+5. **La boucle rAF laissée tournante** : −1,589 ms de dérive, des postes éteints crédités.
+6. **La compilation du nuanceur dans le chrono**, et **un tour rejeté**.
+7. **Une sonde lue APRÈS la fonction ment de façon plausible.**
+
+Et : **un écart moyen n'est pas un critère perceptif** · **20 images, les 12 premières jetées**
+· **un témoin nul est soit une preuve, soit un banc qui ne rend rien — dire lequel** ·
+**charger la page fait partie de la clôture** (un agent a livré du code qui plantait au
+démarrage **avec 3 098 tests verts**).
+
+### ⛔ LE DÉFAUT ENDÉMIQUE : LES DÉNOMINATEURS
+
+**Trois tâches d'affilée ont publié un rapport qui mélangeait des monnaies.** La Tâche C a
+retiré **deux** chiffres-titres ; la Tâche D a retiré son « cent vingt fois » **sans le
+remplacer** (trois monnaies, pas deux — et **les deux chiffres proposés par son relecteur
+étaient faux aussi**) ; la Tâche F a publié un **« 986 tuiles » sans aucune source**.
+
+**Tout chiffre remonte à une donnée brute laissée sur le disque. Un chiffre retiré vaut mieux
+qu'un chiffre faux, et c'est ce qui rend un rapport crédible ici.**
+
+### Mutations, worktrees, arbre partagé
+
+⚠️ **Une mutation change le COMPORTEMENT, pas la CHAÎNE qu'une assertion cherche** — une
+tâche a vu **12 de ses 15 mutations survivre** à une campagne refaite sémantiquement.
+⚠️ **Une constante peut être du code mort sans que rien ne le signale** — trouvé **quatre fois**.
+⚠️ **Campagnes dans un `git worktree` à part, retiré en partant.** **`core.autocrlf=true`** :
+un `worktree add` sort des fichiers en **CRLF** alors que le blob est en **LF** → **faux
+survivants**. **Quatre agents sont tombés dedans.**
+⚠️ **L'arbre est partagé entre plusieurs sessions** — vérifier `git log`.
+
+### Le fov
+
+**Le fov canonique est `FOV_DEG = 30` (`main.js:289`)**, mais **l'application vivante tourne à
+33** parce qu'un template repose `params.fov` (`templates-user.js:109` → `main.js:5363` →
+`main.js:4285`). ⚠️ **Deux fautes critiques déjà payées là-dessus.**
+➡️ **Tout ce qui dérive un seuil du fov lit `camera.fov`/`camGlobe.fov` EN DIRECT.**
+⚠️ **Et la citation `main.js:263` est FAUSSE** (c'est le maillage du bloc) — la bonne est **`:289`**.
+
+## §1 — Les deux études qui fondent l'ordre
+
+- `.superpowers/sdd/2026-08-21-terre-unique/inventaire-studio.md` — **89 entrées, 34
+  dépendent confirmé du plat.**
+- `.superpowers/sdd/2026-08-21-terre-unique/etude-fondu-niveaux.md` — **et sa conclusion
+  renverse l'ordre attendu.**
+
+> ⛔ **LES ARÊTES DROITES NE SONT PAS UN PROBLÈME DE GÉOMÉTRIE.** Elles vivent dans le
+> nuanceur de fragment : **`minFade` (`globe.js:921-928`) dépend de `fwidth(vUv) * uTilePx`,
+> une mesure LOCALE À LA TUILE**, et **le grain de papier (`globe.js:955`) est indexé sur
+> `vUv`**, dont la fréquence est inversement proportionnelle à la taille au sol de la tuile.
+> **Une tuile entière peut s'afficher comme un champ plat pendant que sa voisine garde ses
+> courbes.** ⚠️ **Le morphing géométrique ne peut structurellement rien y faire.**
+>
+> **Et le dépôt sait déjà faire :** l'habillage indexe son grain sur **`qCrop`, jamais `vUv`**
+> (`globe.js:788-798`, commentaire explicite « le grain se répéterait à chaque tuile »).
+
+**Recommandation retenue : la continuité de TEXTURE d'abord, le morphing ENSUITE.** Faire le
+morphing en premier livrerait un geste coûteux (**+23 % de géométrie par tuile**) qui
+laisserait le symptôme le plus visible intact.
+
+## §2 — Ce qui est déjà porté : NE PAS REPLANIFIER
+
+`crop-sphere.js` · `parois-crop.js` · `habillage-crop.js` · `rampe-crop.js` ·
+`exageration-continue.js` · `mer-sphere.js` · `estompage-terre.js` · `branchement-crop.js`.
+
+## §3 — LES TÂCHES
+
+### ═══ ACTE I — LA SURFACE (D7 : les trous d'abord) ═══
+
+#### Tâche J — LA SURFACE PLEINE ⚠️ EN PREMIER, CONSIGNE D'ADRIEN
+
+**Fichiers :** `src/main.js` (`contexteCrop`), `src/monde/branchement-crop.js`, tests.
+⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**
+
+Trois trous mesurés, **un seul défaut** :
+
+1. ⛔ **La bathymétrie n'est jamais demandée.** `contexteCrop()` (`main.js:4688-4696`) le dit
+   en toutes lettres : « PAS DE BATHYMÉTRIE… la mer sera d'un bleu uniforme ». Champ couvert
+   à **0,7 %**, `bathy: false`. **Brancher `remplir` sur `bathy.js`.**
+2. ⛔ **Le champ n'est rempli qu'à UN SEUL zoom** — z12 sur 164 km ne couvre que **19,3 %**
+   des nœuds ; **z10 en couvre 100 %** pour 25 tuiles. **Choisir le zoom depuis l'emprise.**
+3. ⛔ **La mer déborde de 400 km sur un bloc de 10 km**, et **l'estompage ne la touche pas**.
+   Borner la portée de la calotte sur l'emprise du crop, et **la faire suivre l'estompage**.
+
+- [ ] Test → rouge → implémenter → mutation → **REGARDER L'ÉCRAN** → clôture.
+- [ ] **Critère : plus aucun aplat gris. La mer a un fond, et elle s'arrête où il faut.**
+- [ ] ⚠️ **Vérifier aussi la couverture des HAUTEURS** : `reserverHauteurs` a une marge d'une
+      tuile ; **sans elle la couverture plafonne à 0,552**. Le défaut est corrigé, **le
+      vérifier non régressé** fait partie de la tâche.
+
+#### Tâche K — LA CONTINUITÉ DE TEXTURE ⚠️ CE QUI FERME LES ARÊTES DROITES
+
+**Fichiers :** `src/globe.js` (nuanceur de fragment), tests.
+
+- [ ] **Étape 1 — la mesure AVANT.** Reprendre le protocole d'élimination de la Tâche G en
+      **gelant `minFade` puis le terme `vUv` du grain tour à tour**, pour savoir **laquelle
+      des deux sources domine**. ⚠️ **Cette mesure n'a jamais été faite : ne pas la sauter.**
+- [ ] **Étape 2 — désindexer.** `minFade` : remplacer la mesure locale
+      `fwidth(vUv) * uTilePx` par une grandeur **continue** (dérivée de `vLatLon` ou d'une
+      distance-caméra), **indépendante du zoom de la tuile**. Le grain de papier : l'indexer
+      sur une coordonnée continue, **exactement comme l'habillage le fait déjà avec `qCrop`**.
+- [ ] **Étape 3 — mutation sémantique**, worktree à part.
+- [ ] **Étape 4 — REGARDER L'ÉCRAN**, même cadrage qu'avant/après, **témoin exigé**.
+- [ ] **Critère : une frontière de niveau ne doit plus se lire comme une arête droite.**
+      ⚠️ **Ce que cette tâche NE ferme PAS, et qu'elle ne doit pas prétendre fermer :** la
+      résolution réelle de la donnée diffère par niveau (fait de la source), et **le crop
+      impose un zoom prescrit uniforme, donc un saut non borné à sa frontière.**
+
+#### Tâche L — L'EXAGÉRATION BORNÉE (D6)
+
+**Fichiers :** `src/monde/exageration-continue.js`, `src/main.js`, tests.
+
+- [ ] **≈2 au zoom maximal, amplitude RÉDUITE sur toute la descente.** Aujourd'hui
+      `globeExaggeration = 18` et la table Z7 ×3,2 · Z6 ×4 · Z5 ×5 · Z4 ×2,5.
+      ⚠️ **Mesuré (Tâche C) : à ×18 la vue au nadir est INJUGEABLE** — le relief de La Réunion
+      fait 0,86 unité de haut pour 0,21 de large, **la montagne passe au-dessus de la
+      caméra**. **La consigne corrige un défaut réel.**
+- [ ] ⚠️ **Vérifier l'effet sur le grain et le flou de profondeur**, qui « écrasent le relief
+      du crop » : une partie du défaut vient probablement de l'exagération, pas du DOF.
+- [ ] **Ne PAS toucher `demExaggeration` du mode plat.**
+
+### ═══ ACTE II — LA CONTINUITÉ (D1, D2) ═══
+
+#### Tâche M — LA MORT DES PALIERS (D1)
+
+**Fichiers :** `src/modes.js`, `src/escalier-zoom.js`, `src/ui/zoom-stepper.js`,
+`src/loi-altitude.js`, `src/main.js`. ⛔ **Derrière `?terre=unique` uniquement — le mode plat
+garde ses paliers intacts.**
+
+À supprimer *du chemin terre unique*, tous cités par l'inventaire §④ :
+`DIVE_TIERS`/`pickDiveTier` (`modes.js:62-81`) · `escalier-zoom.js` entier · l'indicateur
+`ORB`/`Z{n}` (`ui/zoom-stepper.js`, câblé `main.js:5131-5141`) · `_orbitNotch` (`modes.js:779`)
+· ⚠️ **`poseCranContinu()` (`loi-altitude.js:181`) — C'EST LUI L'ACCROCHAGE DE CAMÉRA**, il
+repose la caméra à `camY × facteurEchelle` à chaque cran · `niveauDePlongee()`
+(`loi-altitude.js:247`, **à vérifier avant retrait**).
+
+- [ ] **Critère mesurable : une descente de l'orbite au sol ne doit contenir AUCUNE
+      reposition de caméra.** Le patron existe : la Tâche 1a a mesuré un profil de descente
+      et compté les sauts (**onze au départ, zéro après**).
+
+#### Tâche N — LE BLOC QUI GRANDIT EN CONTINU (D2)
+
+**Fichiers :** `src/monde/seuil-socle.js` (loi continue), `src/monde/branchement-crop.js`,
+`src/monde/estompage-terre.js` (ses bornes en dérivent), tests.
+
+- [ ] **Remplacer `SEUIL_NAISSANCE_M` / `SEUIL_MORT_M` par une loi continue** : en descendant,
+      la découpe se creuse et les parois montent progressivement.
+      ⚠️ **`ALT_ESTOMPAGE_DEBUT_M`/`_FIN_M` en dérivent et doivent suivre. La LOI de fondu,
+      elle, reste bonne.**
+- [ ] ⚠️ **Le fov se lit EN DIRECT.**
+- [ ] **Critère : aucune apparition, aucune disparition. Le bloc naît de la sphère.**
+
+#### Tâche O — LE MORPHING GÉOMÉTRIQUE ⚠️ APRÈS K, JAMAIS AVANT
+
+**Fichiers :** `src/globe.js`, tests.
+
+- [ ] **Cible auto-dérivée par décimation de la tuile elle-même** (option (b) de l'étude) —
+      **aucun changement au cycle de vie des hauteurs.** ⚠️ **Prix : un micro-pop résiduel
+      NON MESURÉ. Le mesurer fait partie de la tâche.**
+- [ ] `uMorph` **par matériau**, comme `uTex`/`uTilePx` le sont déjà (`globe.js:1532-1543`),
+      et **une boucle par image qui n'existe pas encore**.
+- [ ] ⚠️ **Les normales sont un attribut FIGÉ** : décider explicitement — accepter la dérive
+      d'ombrage pendant la transition, ou payer +12 o/sommet. **Écrire la décision.**
+- [ ] **Budget attendu : +23 % de géométrie par tuile (+8,45 Kio), ≈5,1 Mo de RAM en
+      production, AUCUN appel de dessin ajouté.** ⚠️ **Bornes calculées, pas des mesures :
+      les vérifier.**
+- [ ] ⚠️ **Ne PAS prétendre que le morphing débloque l'exagération continue : il ne touche
+      ni `dispScale` ni `posAt`. Les deux chantiers sont indépendants.**
+
+### ═══ ACTE III — LE STUDIO (D3 : aucune option ne se perd) ═══
+
+Chaque tâche finit par **une vérification option par option, à l'écran**, et la liste cochée
+dans son rapport. **Une option qu'on n'a pas regardée n'est pas adaptée.**
+
+#### Tâche P1 — LES NUAGES ⚠️ LA COQUILLE VIDE
+15 tirettes **sans aucun effet** sous `?terre=unique` : `Clouds2` est gaté par
+`socleAffiche()` qui rend **toujours faux** (`main.js:4566-4568`), et `GlobeClouds` n'a **aucun
+paramètre**. **Faire un pont, ou porter les réglages sur le globe.**
+
+#### Tâche P2 — L'OMBRAGE ET LA RAMPE : LES CURSEURS MORTS
+`colorMode` Atlas + ses 7 sous-réglages (`terrain-analysis.js` → `uAnalysis`, **jamais
+transmis par `contexteCrop`**), et **les quatre curseurs que `rampe-crop.js` ne lit pas** :
+`mapTint`, `heightContrast`, `heightPivot`, `slopeTint`.
+
+#### Tâche P3 — LA MATIÈRE DES PAROIS
+**50 vignettes orphelines.** Les parois n'ont **aucun système de matière**. Et **l'interrupteur
+« Afficher le socle » MENT.** ⚠️ **Reprendre ici le chanfrein et l'arrondi perdus par la
+Tâche B** — leur garde-fou était calibré sur une exagération de 2,8, et **D6 y ramène**.
+
+#### Tâche P4 — LES COUCHES DRAPÉES
+Occupation du sol, canopée, lumières nocturnes (**aucune trace dans `monde/`**), eau,
+photo aérienne + fondu à la côte, grille, cartouche au sol. **Les données passent déjà pour
+le sol ; la loi de couleur n'existe pas.**
+
+#### Tâche P5 — LES EFFETS
+Scanner (**« Elevation slice » balaie un plan Y horizontal**), SSS (effet du *Plinth*),
+effets de surface animés, matières du relief (25+25).
+
+#### Tâche P6 — LE PARCOURS, ET LE DANGER DES DALLES
+⛔ **`block-grid.js` n'est gardé par AUCUN `terreUniqueBranchee`** : **des dalles plates
+peuvent apparaître à travers la sphère** si une trace GPX déborde. **Garde d'abord, adaptation
+ensuite.** Puis le drapage GPX et le suivi caméra.
+
+#### Tâche P7 — LES POINTS ET LA MISE AU POINT
+Sommets (⚠️ `peaks.js` utilise **`dansFenetre`, le prédicat REJETÉ** par `crop-sphere.js` :
+octogone ≠ superellipse), villes, points cotés, et **`autofocus.js` qui échantillonne un DEM
+plat au lieu de raycaster**.
+
+#### Tâche P8 — LES DEUX MACHINERIES DE DÉCOUPE
+« Isoler la zone » et « Sommet découpé » sont un **second système entier**, plat.
+**Trancher : second type de crop, ou fusion.** ⚠️ **Rien n'indique que ce soit décidé.**
+
+#### Tâche Q — LES DERNIERS MENSONGES
+Les paliers inertes (`resolution`, `demZoom`) · **les templates qui capturent des clés mortes
+sans un mot à l'utilisateur** · `veilleCrop.poserMode()` **jamais appelé** ·
+**une seule source de vérité pour le fov** (un second `FOV_DEG` dort dans
+`exageration-continue.js`) · les **jupes qui pendent sous le bloc** · **les citations
+`main.js:263` fausses**.
+
+## §4 — Ordre imposé
+
+**J** (la surface) → **K** (la texture) → **L** (l'exagération) → **M** (les paliers) →
+**N** (le bloc continu) → **O** (le morphing) → **P1…P8** (le studio) → **Q** (le nettoyage).
+
+⚠️ **K AVANT O** — l'étude le démontre : le morphing seul laisserait le symptôme visible intact.
+⚠️ **J EN PREMIER** — consigne d'Adrien, et une belle rampe sur une surface vide ne vaut rien.
+⚠️ **L AVANT P3** — le chanfrein perdu attend une exagération raisonnable.
+⚠️ **P6 tôt si une régression visible est trouvée** — les dalles à travers la sphère sont un
+défaut d'affichage, pas une option manquante.
+
+## §5 — Auto-revue
+
+⚠️ **Le risque principal est la Tâche K.** Si la désindexation ne ferme pas les arêtes
+droites, le symptôme le plus visible reste, et le morphing (coûteux) ne le fermera pas non
+plus — il faudrait alors la voie C (clipmap), **c'est-à-dire un changement d'architecture de
+streaming qui rouvrirait tout ce que les tâches A–I ont posé.** C'est pour ça que **l'étape 1
+de K est une MESURE, pas une implémentation.**
+
+⚠️ **Le second risque est l'ampleur de l'Acte III.** Trente-quatre options dépendent du plat.
+**Si le temps manque, on livre moins d'options mieux vérifiées — jamais l'inverse**, et on dit
+lesquelles restent.
+
+⚠️ **Le troisième risque est D5.** Interdiction de toucher au mode plat : certaines
+adaptations voudront modifier un fichier partagé. **Dans ce cas, on élargit sans changer le
+défaut** — le patron existe (`distanceRivage` de la Tâche F, dont « le défaut par défaut
+reproduit le dépôt au bit près »).
+
+**Aucun chiffre de ce plan n'est inventé.** Ils viennent des deux études ou des bilans
+mesurés, et portent leur source.
diff --git a/src/globe.js b/src/globe.js
index eb0dab3..4616fdc 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -30,20 +30,22 @@ import {
   echelleRampe,
   plancherRampeDuCrop,
 } from './monde/rampe-crop.js'
 // LA MER — Tâche F, « partout et dégradée avec la distance ». Pur lui aussi :
 // il rend des nombres et des tampons, c'est ce fichier-ci qui en fait une
 // géométrie three. ⚠️ **`ocean.js` N'EST PAS IMPORTÉ ICI, ET C'EST DÉLIBÉRÉ** :
 // il tire `ocean-waves` par un ALIAS de Vite, que node ne résout pas — et
 // `test/crop-rampe.test.js` charge `Globe` sous node. Les morceaux de nuanceur
 // partagés arrivent donc par une importation DYNAMIQUE, dans `poserMer`.
 import {
+  bordDeMer,
+  PORTEE_CROP,
   construireCalotte,
   richesseMer,
   distanceBascule,
   bandeDegradation,
   distanceRivage,
   RAMPE_NAUTIQUE,
   epsilonMerDuCrop,
   budgetProfondeurM,
   echelleHouleM,
   seuilTraitEauM,
@@ -201,20 +203,29 @@ uniform vec3 uSky;
 uniform float uMerTemps;
 uniform float uMerProfMax;
 uniform float uMerSeuilEau;
 uniform float uMerEcume;
 uniform float uMerEcumeEchelle;
 uniform float uMerBrillance;
 uniform float uMerPortee;
 uniform float uMerLambda;
 uniform float uCropCoin;
 uniform float uCropCoinN;
+// LE BORD DE LA MER — Tache J. (debut, fin) du fondu, en demi-cotes de crop,
+// MESURES DEPUIS LA FRONTIERE DE LA DECOUPE : 0 = la frontiere. La loi vit dans
+// src/monde/mer-sphere.js (bordDeMer) et SUIT L'ESTOMPAGE de la Terre autour.
+// ⚠️ uCropCoin et uCropCoinN etaient DECLARES ICI ET LUS PAR PERSONNE depuis la
+// Tache F — deux uniformes morts, exactement ce que le §Q du plan traque. Ils
+// portent desormais la mesure du bord, la MEME que celle de la decoupe
+// (globe.js, cq / pn du nuanceur des tuiles) : pas une seconde ecriture de la
+// superellipse, la meme, appliquee a une autre surface.
+uniform vec2 uMerBord;
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
 varying float vRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
 
 float bruitMer(vec2 q) {
@@ -225,20 +236,35 @@ float bruitMer(vec2 q) {
   float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
   float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
   float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
   return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
 }
 
 void main() {
   // la TERRE ne porte jamais la mer : le fond au-dessus du niveau zéro discarde
   if (vProfondeur <= 0.0) discard;
 
+  // ══════ LE BORD — LA MER S ARRETE OU IL FAUT, ET ELLE SUIT L ESTOMPAGE ════
+  //
+  // ⚠️ AVANT TOUT LE RESTE, ET C EST UNE ECONOMIE, PAS UN STYLE : au-dela du
+  // bord il n y a ni ecume, ni bruit, ni Fresnel a calculer. Meme geste que la
+  // sortie anticipee de richesseMer dans le vertex.
+  //
+  // ⚠️ ET LA MESURE EST CELLE DE LA DECOUPE, PAS UN CARRE. Un max(|u|,|v|)
+  // laisserait la mer deborder aux QUATRE COINS arrondis du crop, la ou il n y a
+  // plus de bloc dessous. (Aucun accent grave dans ce bloc : template literal.)
+  vec2 cq = max(abs(vCrop) - (1.0 - uCropCoin), 0.0);
+  float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
+  float dBord = pn - uCropCoin; // 0 = la frontiere du crop, > 0 = dehors
+  float bord = 1.0 - smoothstep(uMerBord.x, uMerBord.y, dBord);
+  if (bord <= 0.0) discard;
+
   float d01 = clamp(vProfondeur / max(uMerProfMax, 1e-9), 0.0, 1.0);
   // le dégradé lagon vit sur les premiers 15 % du budget — une baie de 30 m est
   // un lagon, le budget couvre des colonnes de mille mètres (ocean.js)
   float dLagon = clamp(vProfondeur / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
   vec3 col = mix(uMerPeu, uMerFond, pow(dLagon, 0.7));
 
   vec3 V = normalize(cameraPosition - vMonde);
   vec3 N = normalize(vNormMer);
   vec3 L = normalize(uSunDir);
   float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);
@@ -264,24 +290,24 @@ void main() {
     // sont remis. (Le nom « patchy » d ocean.js vient de ce que « patch » est un
     // mot reserve du GLSL et tue la compilation.)
     float tavelure = smoothstep(0.32, 0.72, bruitMer(vLocal * 0.33 / max(uMerLambda, 1e-9) * 0.08 + vec2(uMerTemps * 0.015, -uMerTemps * 0.011)));
     float moutons = uMerEcume * uMerEcumeEchelle * smoothstep(0.30, 0.60, vCrete) * smoothstep(0.35, 0.75, n2) * (0.5 + 0.5 * tavelure);
     float bande = 0.5 + 0.5 * sin(vRive * 14.0 - uMerTemps * 1.6 + n1 * 4.0);
     float largeurRessac = (1.0 - smoothstep(0.10, 0.75, vRive)) * smoothstep(0.002, 0.03, vRive);
     float ressac = largeurRessac * smoothstep(0.22, 0.55, n1 * 0.6 + bande * 0.4);
     float lisere = (1.0 - smoothstep(0.0, 0.02, vRive)) * smoothstep(0.25, 0.6, n1 + 0.2);
     float ecume = clamp((moutons + ressac * 1.8 + lisere * 1.1) * vRichesse, 0.0, 1.0);
     col = mix(col, vec3(0.96), ecume);
-    gl_FragColor = vec4(col, max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)), ecume * 0.85));
+    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)), ecume * 0.85));
     return;
   }
-  gl_FragColor = vec4(col, smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)));
+  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)));
 }
 `
 
 // La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
 // `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
 // fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
 // IMPORTÉE, pas recopiée : une constante dupliquée diverge en silence (§1 de
 // /threejs-optimisation, question 2).
 const CIRCONFERENCE_MERCATOR = CIRCONFERENCE_M
 
@@ -1671,29 +1697,36 @@ export class Globe {
   poserEstompage(estompage) {
     const e = Number(estompage)
     const v = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0
     const u = this.uniforms
     u.uEstompage.value = v
     u.uEstompageOn.value = 1
     // ⚠️ **UN ALPHA NE VEUT RIEN DIRE SUR UN MATÉRIAU OPAQUE.** Les calottes
     // sont opaques en production ; sans cette bascule leur `1.0 - estompage`
     // serait ignoré par le moteur et un bandeau blanc resterait au pôle.
     this._melangeCalottes(true)
+    // ⚠️ **ET LA MER SUIT, SINON ELLE FLOTTE.** Tâche J : sans cette ligne, la
+    // planète s'efface et il reste un rectangle bleu de plusieurs centaines de
+    // kilomètres au-dessus du vide — relevé à l'écran, « la mer déborde de
+    // ~400 km sur un bloc de 10 km ». C'est le SEUL appel par image du bord, et
+    // `creerVeilleEstompage` ne le déclenche que sur changement de valeur.
+    this._majBordMer()
     return v
   }
 
   /** Retire l'estompage — on revient au crop SEUL, le comportement de la Tâche A. */
   retirerEstompage() {
     const u = this.uniforms
     u.uEstompageOn.value = 0
     u.uEstompage.value = 1
     this._melangeCalottes(false)
+    this._majBordMer()
   }
 
   /** Les calottes passent (ou non) dans la liste triée du moteur. */
   _melangeCalottes(actif) {
     for (const cap of this._calottes || []) {
       if (cap.material.transparent === actif) continue
       cap.material.transparent = actif
       cap.material.needsUpdate = true
     }
   }
@@ -2026,25 +2059,37 @@ export class Globe {
    *   l'application (la ligne `fov: 30` des réglages de `main.js` ; **pas**
    *   `main.js:263`, qui parle du maillage du bloc central). Tour de correction
    *   1 : le défaut portait `33`, introuvable ailleurs dans le dépôt, alors que
    *   `SEUIL_NAISSANCE_M` (`seuil-socle.js`, 32 274 m) — la valeur même à
    *   laquelle la bascule se compare — est déjà calculée à `30`.
    *   ⚠️ **MAIS UN DÉFAUT N'EST PAS CE QUI TOURNE.** Relevé le 2026-08-21 sur
    *   l'application vivante : `camGlobe.fov = 33`, posé par un template
    *   (`templates-user.js` sauvegarde `'fov'`). **L'appelant doit passer le fov
    *   VIVANT** — `main.js` le fait, voir `contexteCrop`.
    * @param {number} [arg.largeurBande] largeur de la transition, en octaves
+   * @param {number} [arg.couvertureMin] ⚠️ **DÉFAUT 0 : LE DÉPÔT AU BIT PRÈS.**
+   *   Au-dessus de zéro, un champ moins couvert que ça rend `refus: 'champ'`, et
+   *   c'est la reprise de `branchement-crop.js` qui rejoue la mer. **Sans ce
+   *   refus, la première cuisson — celle qui tombe AVANT que les tuiles de fond
+   *   marin aient atterri — est aussi la dernière**, et la mer reste d'un bleu
+   *   uniforme pour toujours. Mesuré à l'écran : couverture **0,7 %**.
+   * @param {boolean} [arg.exigerBathy] même contrat, pour la fusion
+   *   bathymétrique : `remplir` peut réussir tout en n'ayant AUCUNE nappe à
+   *   fusionner (elle arrive de façon asynchrone). ⚠️ **Défaut `false` :
+   *   le dépôt au bit près.**
    * @returns {Promise<object|null>}
    */
   async poserMer({
     remplir = null,
     portee = null,
+    couvertureMin = 0,
+    exigerBathy = false,
     pas = 192,
     hauteurPx = 900,
     fovDeg = FOV_DEG,
     largeurBande = 4,
     altitudeM = 32274,
     couleurs = null,
     graine = 0,
     couleursFond = null,
     houle = 0.5,
     chop = 0.7,
@@ -2058,25 +2103,37 @@ export class Globe {
     // /threejs-optimisation — un seuil d'horizon en dur y vaut une calotte
     // jusqu'à mille fois trop large ; ici l'erreur laisserait un TROU).
     const p = Number.isFinite(portee) && portee > 0
       ? portee
       : Math.min(PORTEE_DEFAUT, Math.max(1, porteeHorizon(rep, altitudeM, EARTH_RADIUS_M)))
     // ⚠️ L'EPSILON DE COPLANARITÉ : le fond marin du globe est EXACTEMENT sur la
     // sphère (`_buildMesh` écrête à zéro), donc sans lui la mer et le fond se
     // disputent le même plan. CONVERTI, pas recopié : `0,003` unité de socle
     // vaudrait 68,3 m de marée ici.
     const epsUnites = epsilonMerDuCrop(rep, exag) * echelle
-    const cal = construireCalotte({ repere: rep, rayon: R_GLOBE, portee: p, pas, hauteur: epsUnites })
 
     // ─── LE CHAMP : altitude du fond et distance au rivage ───────────────────
+    //
+    // ⚠️ **AVANT LA CALOTTE DEPUIS LA TÂCHE J, ET PAS PAR GOÛT DE L'ORDRE** :
+    // c'est lui qui peut REFUSER, et bâtir 193² sommets pour les jeter aussitôt
+    // se paierait à chaque reprise — une toutes les trente images tant que le
+    // fond marin n'a pas atterri.
     const champ = this._cuireChampMer({ repere: rep, portee: p, remplir, echelle })
     if (!champ) return { refus: 'champ', portee: p }
+    // ⚠️ **LE REFUS N'EFFACE RIEN**, et c'est le contrat des maillons écrit dans
+    // `branchement-crop.js` : « le refus ne touche pas à ce qui est en place ».
+    // Une mer déjà posée survit donc à une reprise qui échoue.
+    if (champ.couverture < couvertureMin || (exigerBathy && !champ.bathy)) {
+      champ.texture.dispose()
+      return { refus: 'champ', portee: p, couverture: champ.couverture, bathy: champ.bathy }
+    }
+    const cal = construireCalotte({ repere: rep, rayon: R_GLOBE, portee: p, pas, hauteur: epsUnites })
 
     const geo = new THREE.BufferGeometry()
     geo.setAttribute('position', new THREE.BufferAttribute(cal.positions, 3))
     geo.setAttribute('aCrop', new THREE.BufferAttribute(cal.uv, 2))
     geo.setIndex(new THREE.BufferAttribute(cal.indices, 1))
     geo.computeBoundingSphere()
 
     // ─── DEUX ÉCHELLES, ET LES CONFONDRE SE VOIT ─────────────────────────────
     //
     // `echelleH` : unités de scène par mètre de SPECTRE — l'échelle des vagues, tirée
@@ -2139,20 +2196,25 @@ export class Globe {
         uMerEcume: { value: 1.9 * chop * chop },
         // ⚠️ LE FACTEUR D'ÉCHELLE D'ÉCUME D'`ocean.js`, QUI MANQUAIT. Là-bas il
         // vaut `smooth01((waveScale − 0,12)/0,2)` et il éteint l'écume des vues
         // continentales ; ici la calotte couvre déjà 164 km, donc il est posé à
         // sa valeur de vue LARGE. Sans lui, la côte vue de 7,6 km était une masse
         // blanche trouée de bleu — relevé à l'écran, `.banc/vues/M-mer-seule-cote.jpg`.
         uMerEcumeEchelle: { value: ecumeEchelle },
         uMerBrillance: { value: 240 - 130 * chop },
         uCropCoin: u.uCropCoin,
         uCropCoinN: u.uCropCoinN,
+        // ⚠️ **PROPRE À LA MER, PAS PARTAGÉ** : les deux bornes sont exprimées
+        // dans la mesure de la découpe, mais leur AMPLITUDE dépend de `portee`,
+        // qui est une grandeur de la calotte. Posé juste après, par
+        // `_majBordMer` — un seul écrivain, celui que `poserEstompage` rappelle.
+        uMerBord: { value: new THREE.Vector2(0, 1) },
       },
       vertexShader: MER_VERT
         .replace('__GERSTNER__', mod.GERSTNER_GLSL)
         .replace('__SHORE_SURF__', mod.SHORE_SURF_GLSL),
       fragmentShader: MER_FRAG,
     })
 
     this.retirerMer()
     // ⚠️ LE FOND MARIN AUSSI, ET C'EST LE MEME GESTE : la mer, ce n'est pas
     // seulement la lame d'eau, c'est le fond qu'on voit au travers.
@@ -2175,23 +2237,46 @@ export class Globe {
     M.setPosition(cal.origine[0], cal.origine[1], cal.origine[2])
     M.decompose(mesh.position, mesh.quaternion, mesh.scale)
     this.group.add(mesh)
     this._mer = mesh
     this._merEtat = {
       portee: p, pas, lambda, maille, echelleH, bascule, bande, epsUnites,
       flecheMax: cal.flecheMax, compte: cal.compte,
       couverture: champ.couverture, profMaxUnites: champ.profMaxUnites,
       bathy: champ.bathy,
     }
+    this._majBordMer()
     return this._merEtat
   }
 
+  /**
+   * Recale le bord de la mer sur l'estompage courant — Tâche J.
+   *
+   * ⚠️ **DEUX FLOTTANTS, PAS UNE RECUISSON.** La calotte se bâtit à l'arrêt ;
+   * faire varier sa `portee` avec l'estompage la reconstruirait par image
+   * (385² de champ, 193² de sommets). La géométrie reste donc à sa portée, et
+   * c'est le FONDU qui bouge.
+   *
+   * ⚠️ **ET LA VALEUR NEUTRE EST ZÉRO, COMME POUR LES CALOTTES POLAIRES.** Les
+   * trois sites qui lisent `uEstompage` n'ont pas la même : les tuiles prennent
+   * `1.0` quand l'interrupteur est éteint (le crop seul), les calottes `0.0`
+   * (la planète entière). La mer est du second groupe — sans `poserEstompage`,
+   * la planète est entière, donc la mer peut aller jusqu'au bord de la calotte.
+   */
+  _majBordMer() {
+    if (!this._mer) return
+    const u = this.uniforms
+    const estompage = u.uEstompageOn.value > 0.5 ? u.uEstompage.value : 0
+    const b = bordDeMer(estompage, this._merEtat?.portee ?? PORTEE_CROP)
+    this._mer.material.uniforms.uMerBord.value.set(b.debut, b.fin)
+  }
+
   /**
    * Cuit le champ de la mer : altitude du fond (R) et distance au rivage (G).
    *
    * ⚠️ **384, ET CE N'EST PAS UN CHOIX DE CONFORT** : `SHORE_SURF_GLSL` porte
    * `1.0 / 384.0` EN DUR pour son pas de gradient. Une autre résolution
    * déformerait la houle de côte sans que rien ne le signale.
    *
    * ⚠️ **LE CHANFREIN COMPLET, PAS CELUI DU SOCLE** : `distanceRivage` par
    * défaut reproduit le demi-masque incomplet d'`ocean.js`, qui sur-estime de
    * **41,4 %** dans deux quadrants sur quatre (mesuré, `test/mer-sphere.test.js`
@@ -2200,21 +2285,26 @@ export class Globe {
    */
   _cuireChampMer({ repere, portee, remplir, echelle }) {
     const N = 384
     const emprise = empriseCalotte(repere, portee)
     const brut = new Float32Array((N + 1) * (N + 1))
     let couverture = 0
     let bathy = false
     if (typeof remplir === 'function') {
       const r = remplir(emprise, N, brut)
       couverture = r && Number.isFinite(r.remplis) ? r.remplis / brut.length : 1
-      bathy = true
+      // ⚠️ **ON CROIT `remplir` QUAND IL RÉPOND, ET ON LE SUPPOSE SINON.**
+      // `remplirHauteurs` rend désormais un `bathy` qui dit si la fusion a
+      // RÉELLEMENT eu lieu (la nappe arrive de façon asynchrone) ; un `remplir`
+      // muet — les bouchons des tests, tout appelant d'avant la Tâche J — garde
+      // le `true` optimiste d'origine. **On élargit, on ne remplace pas.**
+      bathy = r && typeof r.bathy === 'boolean' ? r.bathy : true
     } else {
       // ⚠️ LE REPLI, ET IL EST DÉGRADÉ — `hauteurSurface` lit les tuiles du
       // globe, qui n'ont AUCUNE bathymétrie : zéro partout en mer. La mer y sera
       // d'un bleu uniforme. On le dit par `bathy: false` plutôt que de le
       // laisser découvrir à l'écran.
       const liste = this.tuilesAvecHauteurs()
       let vus = 0
       for (let j = 0; j <= N; j++) {
         for (let i = 0; i <= N; i++) {
           const lat = emprise.nord + ((emprise.sud - emprise.nord) * j) / N
diff --git a/src/main.js b/src/main.js
index d62b8cf..5ffd70c 100644
--- a/src/main.js
+++ b/src/main.js
@@ -84,21 +84,25 @@ import { BLOCK_TILES } from './landmarks.js'
 // terrain.js, et AUCUN TEST NE CHARGE `main.js` pour l'attraper.
 import { lireExageration, poserExageration, creerExagerationPartagee, majExagerationCran, surchargesStockees, courbeExageration, EXAG_BASE } from './monde/exageration-continue.js'
 // LA FENÊTRE BORNÉE — Tâche 6 ter. ⚠️ Importée ICI et pas dans `terrain.js` :
 // `fenetre-bornee.js` importe `TERRAIN_SIZE` de `terrain.js`, donc l'import
 // inverse fermerait le cycle. `main.js` est en bout de chaîne, il n'en ouvre
 // aucun. Voir `terrain.adopterFenetre`.
 import { construireFenetre, majHauteurs, recadrerFenetre } from './monde/fenetre-bornee.js'
 // ⚠️ **LE FLUX EST LE CACHE DU QUADTREE, PAS UN SECOND CHARGEUR** (Tâche 6
 // quinquies) : `creerFlux` ne demande RIEN à sa naissance, et `remplirBorne`
 // borne le remplissage au débit RÉELLEMENT observé (règle R3, Tâche 4 ter).
-import { creerFlux, zoomEffectif, demanderEmprise, debitObserve, revisionFlux } from './monde/flux-terrain.js'
+import { creerFlux, zoomEffectif, demanderEmprise, debitObserve, revisionFlux, remplirHauteurs, zoomPourEmprise } from './monde/flux-terrain.js'
+// LA MER DU CROP — Tâche J. ⚠️ **`empriseCalotte` ET `repereCrop` SONT PURS** :
+// ils ne tirent ni three.js ni le DOM, donc les importer ici n'ouvre aucun cycle.
+import { empriseCalotte, PORTEE_CROP } from './monde/mer-sphere.js'
+import { repereCrop } from './monde/crop-sphere.js'
 // `fractionSurTrace` : le pont d'indices qui remet la tête de course sous
 // l'objectif de la poursuite (voir son commentaire dans poursuite.js).
 import { fractionSurTrace } from './poursuite.js'
 import { ATLAS_COTE, EMPRISE_EN_VOL_MAX, enVolBorne, originesEmprise, recollerEmprise } from './dem-emprise.js'
 import { COURSE_ELASTIQUE, avanceFenetre, rappelElastique, poseDansLaCourse, fenetreQuiCentre } from './fenetre-course.js'
 import { dansFenetre } from './fenetre-clip.js'
 import { vitesseAuLache, pasElan } from './fenetre-elan.js'
 import { forceUrl, continuActif, etatInterrupteur } from './fenetre-reglage.js'
 import { pasFinesse, finesseInitiale, resDeFinesse, resFinesses, REPOS_S } from './fenetre-finesse.js'
 import { MapLayers } from './map/layer-manager.js'
@@ -4169,21 +4173,27 @@ if (socleQuadtreeActif()) terrain.hauteursDeFlux = (fenetre, p) => {
   // écrite.
   //
   // ⚠️ **ET R3 N'A RIEN À ÉCONOMISER ICI :** ces neuf tuiles sont EXACTEMENT
   // celles que `loadDem` télécharge pour le même bloc. Les demander au quadtree
   // ne coûte pas une requête de plus — c'est la MÊME charge, prise à l'autre
   // bout. Rogner ce chiffre ne rend pas le socle moins cher, il le rend faux.
   //
   // R3 garde donc sa moitié « descente » (Tâche 4 ter, `zoomSoutenable` sur les
   // paliers de caméra) ; ici on demande le zoom DU BLOC, et c'est
   // `remplirHauteurs` — du plus grossier au plus fin — qui porte la décision 13.
-  demanderEmprise(flux, { emprise, zoom: params.demZoom })
+  // ⚠️ **`aussi` : LES DEUX APPELANTS DOIVENT PASSER LE MÊME, ET C'EST UNE
+  // OBLIGATION, PAS UNE SYMÉTRIE.** `demanderEmprise` ANNULE les tuiles qui
+  // sortent de `flux.reclamees` : celui des deux qui oublierait la mer
+  // annulerait, à chaque image, les tuiles que l'autre vient de demander. Hors
+  // `?terre=unique`, `empriseZoomMer()` rend `null` et l'appel est celui du
+  // dépôt, au bit près.
+  demanderEmprise(flux, { emprise, zoom: params.demZoom, aussi: empriseZoomMer() })
   const borne = { zoom: params.demZoom, zoomDemande: params.demZoom, debitObserveMbs: debitObserve(flux) }
   // ⚠️ **`majHauteurs` NE RECONSTRUIT RIEN** : une passe par TUILE (jamais par
   // pixel — l'interface par pixel coûtait +3,5 ms par reconstruction), puis les
   // `y` et les normales réécrits EN PLACE. 3,5 ms à n = 384, mesuré in situ.
   majHauteurs(fenetre, flux)
   // ⚠️ **LE COMPTEUR SE RECALE ICI, ET PAS AILLEURS.** Un cran change d'emprise
   // donc de tuiles réclamées : laissé sur la valeur d'avant, le raffinement
   // pourrait retomber sur le même compte et ne jamais repartir — un socle qui
   // resterait grossier pour toujours, sans une erreur.
   _socleLisibles = tuilesLisiblesDuSocle(flux)
@@ -4679,41 +4689,93 @@ function majEstompage() {
 // remplace ne seraient pas au même endroit à l'écran.
 //
 // ⚠️ **ET LA LARGEUR SE DÉDUIT DE L'EMPRISE, PAS DE `params.demZoom`.** Le
 // `zoom` de `repereCrop` ne sert qu'à `demi = tuilesParBloc / 2 / 2^zoom` : ce
 // qu'on veut, c'est que `demi` vaille exactement la demi-largeur du bloc en
 // mercator. La déduire de l'emprise RÉELLE rend ça vrai par construction, y
 // compris pendant l'image où `params.demZoom` a déjà changé et où l'emprise
 // n'a pas suivi — le désaccord d'une image qui a valu onze bascules au seuil.
 //
 // ⚠️ **CE QUE CE CONTEXTE NE PORTE PAS, ET IL FAUT LE DIRE :**
-//   · **`remplir` pour la mer, donc PAS DE BATHYMÉTRIE.** `poserMer` remplirait
-//     son champ par `remplirHauteurs(flux, …)` sur l'emprise de la CALOTTE, qui
-//     couvre jusqu'à 256 demi-largeurs de crop. Or `demanderEmprise` REMPLACE
-//     `gardeHauteurs` à chaque appel (`flux-terrain.js`, « un seul flux par
-//     globe ») : la demander ici reprendrait au bloc ses réservations, et le
-//     socle perdrait ses hauteurs. On retombe donc sur `hauteurSurface`, qui lit
-//     les tuiles du globe — lesquelles n'ont **aucun fond marin**. **La mer sera
-//     d'un bleu uniforme**, et `poserMer` le dit lui-même par `bathy: false`.
+//   · ~~**`remplir` pour la mer, donc PAS DE BATHYMÉTRIE.**~~ ✅ **RÉPARÉ PAR LA
+//     TÂCHE J**, et il faut dire comment, parce que l'obstacle écrit ici était
+//     réel : `demanderEmprise` REMPLACE `gardeHauteurs` à chaque appel (« un seul
+//     flux par globe »), donc un SECOND appel pour la mer aurait repris au bloc
+//     ses réservations. La sortie n'est pas un second appel, c'est **une seule
+//     réservation qui connaît les deux emprises** — `demanderEmprise` a été
+//     ÉLARGIE d'un `aussi` dont le défaut (`null`) reproduit le dépôt au bit
+//     près. Et la portée de la calotte n'est plus l'horizon (256 demi-largeurs)
+//     mais `PORTEE_CROP = 3`, l'emprise 3×3 du mode plat : c'est ce qui rend
+//     l'emprise de la mer réservable.
 //   · **le grain** reste à zéro : `HABILLAGE_MONDE.grainForceM` vaut 0 et rien
 //     dans les réglages du socle ne s'y traduit en mètres de relief sans une
 //     mesure qu'on n'a pas faite.
-function contexteCrop() {
+// Le LIEU et la LARGEUR du crop, seuls — extraits de `contexteCrop` par la
+// Tâche J. ⚠️ **PARCE QUE DEUX APPELANTS EN ONT BESOIN, ET QU'UNE SECONDE
+// ÉCRITURE DIVERGERAIT** : `contexteCrop` (ce que la chaîne reçoit) et
+// `empriseZoomMer` (ce que la réservation doit couvrir) doivent tomber sur
+// EXACTEMENT le même repère, sinon la mer se remplirait à côté du bloc.
+function assietteCrop() {
   const centre = latLonOrigineBloc()
   if (!Number.isFinite(centre?.lat) || !Number.isFinite(centre?.lon)) return null
   const emprise = terrain.fenetreBornee?.emprise || empriseDuSocle()
   if (!emprise) return null
   let large = emprise.est - emprise.ouest
   if (large <= 0) large += 360 // franchissement de l'antiméridien — convention de `seuil-socle.js`
   if (!(large > 0)) return null
   const zoom = Math.log2((360 * BLOCK_TILES) / large)
   if (!Number.isFinite(zoom)) return null
+  return { centre, zoom }
+}
+
+// ══════════ LA MER DEMANDE SON PROPRE ZOOM — Tâche J, trou n° 2 ════════════
+//
+// ⚠️ **VINGT-CINQ, ET C'EST LA MESURE DE LA TÂCHE F QUI LE DIT** : sur un champ
+// de mer de 164 km, « z12 ne couvre que 19,3 % des nœuds ; **z10 en couvre
+// 100 % pour 25 tuiles** ». Le budget est donc celui-là, et le zoom s'en déduit
+// (`zoomPourEmprise`) au lieu d'être posé.
+const TUILES_MER_MAX = 25
+
+// ⚠️ **LE SEUIL DE REFUS DE LA MER, ET IL N'EST PAS À 1 COMME CELUI DES PAROIS.**
+// Les parois et la rampe échantillonnent la FRONTIÈRE du crop, où un point
+// manquant fait une encoche visible ; le champ de la mer est une texture de 385²
+// lue en interpolation linéaire, où quelques nœuds de bord manquants ne se lisent
+// pas. Ce qu'il faut interdire est le champ VIDE — celui qui a été mesuré à
+// **0,7 %** de couverture et qui rendait un aplat gris.
+const COUVERTURE_MER_MIN = 0.99
+
+/**
+ * L'emprise que la MER doit couvrir, et le zoom auquel la demander.
+ *
+ * `null` hors `?terre=unique` : la réservation retombe alors exactement sur
+ * celle du dépôt, et `demanderEmprise` reçoit `aussi: null`.
+ */
+// Le flux est-il là pour nourrir la mer ? ⚠️ **`fluxDuSocle()` FABRIQUE LE FLUX
+// AU PREMIER APPEL** et rend `null` tant que `globe` n'existe pas : sans cette
+// garde, `remplir` serait posé sur un `null` et `_cuireChampMer` compterait sa
+// couverture à **1** par son repli (`r && Number.isFinite(...) ? … : 1`),
+// c'est-à-dire un champ vide déclaré plein.
+const fluxMerPret = () => terreUniqueBranchee && !!fluxDuSocle()
+
+function empriseZoomMer() {
+  if (!terreUniqueBranchee) return null
+  const a = assietteCrop()
+  if (!a) return null
+  const rep = repereCrop({ centre: a.centre, zoom: a.zoom, tuilesParBloc: BLOCK_TILES })
+  const emprise = empriseCalotte(rep, PORTEE_CROP)
+  return { emprise, zoom: zoomPourEmprise(emprise, { zoomMax: params.demZoom, tuilesMax: TUILES_MER_MAX }) }
+}
+
+function contexteCrop() {
+  const a = assietteCrop()
+  if (!a) return null
+  const { centre, zoom } = a
 
   // ⚠️ **LES UNIFORMES SE LISENT UN PAR UN, JAMAIS EN BLOC.** `terrain.mapUniforms`
   // cédé à une variable est une poignée sur le bloc central, et
   // `test/damier-uniformes.test.js` (③) l'exige déclarée : ce qu'un porteur de
   // poignée écrit n'atteint jamais les dalles voisines. Ici on ne fait que LIRE,
   // et le plus simple est de ne pas prendre la poignée du tout.
   const cote = terrain.mapUniforms.uCoastMaskOn.value > 0.5 ? terrain.mapUniforms.uCoastMask.value : null
   const sol = terrain.mapUniforms.uSolOn.value > 0.5 ? terrain.mapUniforms.uSol.value : null
   // l'amplitude du relief du crop : elle CALE l'intervalle des courbes de niveau
   // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
@@ -4733,20 +4795,42 @@ function contexteCrop() {
       solOpacite: terrain.mapUniforms.uSolOpacite.value,
       solOffset: terrain.mapUniforms.uSolOffset.value,
       solScale: terrain.mapUniforms.uSolScale.value,
       solTexel: terrain.mapUniforms.uSolTexel.value,
       amplitudeM: amplitudeM > 0 ? amplitudeM : null,
       contourOpacity: terrain.mapUniforms.uContourOpacity.value,
       contourWeight: terrain.mapUniforms.uContourWeight.value,
     },
     mer: {
       altitudeM: altitudeCadrageM(),
+      // ══════════ LA BATHYMÉTRIE — Tâche J, trou n° 1 ═══════════════════════
+      //
+      // ⚠️ **C'EST LA PORTE D'ENTRÉE, ET ELLE ÉTAIT MURÉE.** Sans `remplir`,
+      // `_cuireChampMer` retombe sur `hauteurSurface`, qui lit les tuiles du
+      // globe — lesquelles n'ont AUCUN fond marin : **zéro partout en mer**,
+      // donc un aplat. Mesuré : champ couvert à **0,7 %**, `bathy: false`.
+      // `remplirHauteurs` appelle `fuseBathymetry` sur l'emprise ENTIÈRE en une
+      // fois, ce qui est la raison d'être de cette fonction.
+      remplir: fluxMerPret()
+        ? (empriseMer, n, sortie) => remplirHauteurs(fluxDuSocle(), { emprise: empriseMer, n, sortie })
+        : null,
+      // ⚠️ **BORNÉE SUR L'EMPRISE DU CROP, PLUS SUR L'HORIZON** — trou n° 3.
+      portee: PORTEE_CROP,
+      couvertureMin: COUVERTURE_MER_MIN,
+      // ⚠️ **TANT QUE LA NAPPE N'A PAS ATTERRI, ON REFUSE — ET PAS AU-DELÀ.**
+      // `demanderBathy` est ASYNCHRONE : la première cuisson tombe avant elle, et
+      // sans ce refus elle serait aussi la dernière (rien ne redemande une mer
+      // posée). ⚠️ **Mais une nappe VIDE est le cas NORMAL** — `flux-terrain.js`
+      // l'écrit : « on ne cuit pas de tuile là où il n'y a pas de mer ». Exiger la
+      // fusion une fois la nappe RÉGLÉE ferait boucler la reprise pour toujours
+      // à Chamonix, en recuisant un champ de 385² toutes les trente images.
+      exigerBathy: fluxMerPret() && !fluxDuSocle()?.bathy?.prete,
       // ⚠️ **LE FOV VIVANT, PAS LE DÉFAUT DU MODULE — ET C'EST UN RELEVÉ, PAS
       // UNE PRÉCAUTION.** Le 2026-08-21 sur l'application qui tourne :
       // `params.fov = 33`, `camera.fov = 33`, `camGlobe.fov = 33`, alors que le
       // défaut du code est 30 et que `FOV_DEG` vaut 30. L'écart vient des
       // TEMPLATES — `templates-user.js` sauvegarde `'fov'`, et un template
       // appliqué au démarrage repose `params.fov`. « 33 n'existe nulle part dans
       // le dépôt » était vrai de la SOURCE et faux de l'application.
       fovDeg: camGlobe?.fov ?? camera.fov,
       hauteurPx: renderer.domElement?.clientHeight || undefined,
     },
@@ -4818,21 +4902,23 @@ const veilleCrop = creerVeilleCrop({
     if (!flux || !emprise) return
     // ⚠️ **LES DEUX CONVERSIONS SONT CELLES DE `geo.js`, PAS UNE TROISIÈME.**
     // `mondeVersLatLonEmprise` interpole la longitude linéairement et la latitude
     // en MERCATOR — c'est exactement la grille de tuiles. Une marge calculée en
     // degrés de latitude serait fausse dès qu'on quitte l'équateur.
     const D = 5 / 6 // une tuile de marge sur un bloc de trois : (1,5 + 1) / 3
     const n = mondeVersLatLonEmprise(emprise, 0, -D, 1).lat
     const s = mondeVersLatLonEmprise(emprise, 0, D, 1).lat
     const o = mondeVersLatLonEmprise(emprise, -D, 0, 1).lon
     const e = mondeVersLatLonEmprise(emprise, D, 0, 1).lon
-    demanderEmprise(flux, { emprise: { ouest: o, sud: s, est: e, nord: n }, zoom: params.demZoom })
+    // ⚠️ **LE MÊME `aussi` QUE `hauteursDeFlux`** — voir là-bas : deux
+    // réservations qui ne s'accordent pas s'annulent l'une l'autre par image.
+    demanderEmprise(flux, { emprise: { ouest: o, sud: s, est: e, nord: n }, zoom: params.demZoom, aussi: empriseZoomMer() })
   },
 })
 
 modes = new Modes({
   camera,
   controls,
   globe,
   domElement: renderer.domElement,
   hooks: {
     setSurfaceVisible(v) {
diff --git a/src/monde/flux-terrain.js b/src/monde/flux-terrain.js
index d435ac7..922df62 100644
--- a/src/monde/flux-terrain.js
+++ b/src/monde/flux-terrain.js
@@ -245,20 +245,46 @@ function rectangleTuiles(emprise, zoom) {
   const z = Math.max(0, Math.min(MAX_Z, Math.floor(zoom)))
   const n = 2 ** z
   const b = boiteMerc(emprise)
   const ix0 = Math.floor(b.x0 * n)
   const ix1 = Math.max(ix0, Math.ceil(b.x1 * n) - 1)
   const iy0 = Math.max(0, Math.floor(b.y0 * n))
   const iy1 = Math.max(iy0, Math.min(n - 1, Math.ceil(b.y1 * n) - 1))
   return { z, n, ix0, ix1, iy0, iy1, colonnes: ix1 - ix0 + 1, lignes: iy1 - iy0 + 1 }
 }
 
+/**
+ * Le zoom le plus FIN dont le rectangle de tuiles tienne dans `tuilesMax`.
+ *
+ * ⚠️ **LE ZOOM SE CHOISIT DEPUIS L'EMPRISE, IL NE SE POSE PAS — ET C'EST MESURÉ.**
+ * La Tâche F a relevé qu'un champ de mer de 164 km rempli au zoom du BLOC (z12)
+ * ne couvrait que **19,3 %** de ses nœuds, quand **z10 en couvre 100 %** pour
+ * **25 tuiles**. Le zoom du bloc est juste pour le bloc ; sur une emprise dix
+ * fois plus large il demande cent fois plus de tuiles, et le budget les refuse.
+ *
+ * ⚠️ **ET `rectangleTuiles`, PAS `tuilesEmprise`** : la seconde ÉNUMÈRE, donc un
+ * essai à z12 sur 164 km construirait des milliers d'objets pour être jeté.
+ *
+ * @param {object} emprise `{ouest, sud, est, nord}` en degrés
+ * @param {{zoomMax?:number, zoomMin?:number, tuilesMax?:number}} [opt]
+ * @returns {number} un zoom entier dans `[zoomMin, zoomMax]`
+ */
+export function zoomPourEmprise(emprise, { zoomMax = ZOOM_SOCLE, zoomMin = 0, tuilesMax = 25 } = {}) {
+  const haut = Math.max(0, Math.min(MAX_Z, Math.floor(zoomMax)))
+  const bas = Math.max(0, Math.min(haut, Math.floor(zoomMin)))
+  for (let z = haut; z > bas; z--) {
+    const r = rectangleTuiles(emprise, z)
+    if (r.colonnes * r.lignes <= tuilesMax) return z
+  }
+  return bas
+}
+
 /** La tuile `(z,x,y)` intersecte-t-elle la boîte Mercator ? (bord exclu) */
 function intersecte(b, z, x, y) {
   const n = 2 ** z
   const ty0 = y / n
   const ty1 = (y + 1) / n
   if (ty1 <= b.y0 || ty0 >= b.y1) return false
   // en longitude, la boîte peut déborder par la droite (antiméridien) : on
   // essaie la tuile à sa place et un tour de monde plus loin
   for (const dx of [0, 1]) {
     const tx0 = x / n + dx
@@ -335,34 +361,64 @@ export function revisionFlux(flux) {
  * retirée de la file du globe et rendue à `empty`. C'est le geste que le
  * panoramique rend indispensable : sans lui, chaque image du balayage laisse
  * derrière elle une emprise entière de tuiles qui attendent pour rien.
  *
  * ⚠️ **UN SEUL FLUX PAR GLOBE.** `globe.gardeHauteurs` est remplacée à chaque
  * appel : deux flux sur le même globe se reprendraient leurs réservations d'un
  * appel à l'autre, et chacun verrait les hauteurs de l'autre disparaître. Ce
  * n'est pas une limite gênante — il y a un socle, donc un flux — mais elle est
  * ÉCRITE plutôt que sous-entendue.
  *
+ * ══════════ `aussi` — LA SECONDE EMPRISE, ET POURQUOI ELLE ENTRE ICI ═══════
+ *
+ * ⚠️ **ON ÉLARGIT, ON NE REMPLACE PAS : `aussi` À `null` REPRODUIT LE DÉPÔT AU
+ * BIT PRÈS**, et c'est le patron que la Tâche F a posé avec `distanceRivage`.
+ *
+ * ⚠️ **ET ELLE NE POUVAIT PAS ÊTRE UN SECOND APPEL.** C'est tout le §« un seul
+ * flux par globe » : `gardeHauteurs` est REMPLACÉE à chaque appel, donc deux
+ * appels — l'un pour le bloc, l'autre pour la mer — se reprendraient leurs
+ * réservations d'une image à l'autre, et `_buildMesh` relâcherait les hauteurs
+ * de celui qui vient de perdre la main. **Une seule réservation, donc un seul
+ * appel qui connaît les deux emprises.** C'est aussi pour ça que les DEUX
+ * appelants de `main.js` (`hauteursDeFlux` et `reserverHauteurs`) doivent passer
+ * le MÊME `aussi` : un seul qui l'oublierait annulerait les tuiles de l'autre.
+ *
+ * ⚠️ **LA BATHYMÉTRIE SUIT LA PLUS LARGE DES DEUX**, parce qu'il n'y a qu'une
+ * nappe par flux (`flux.bathy`) et que l'emprise de la mer CONTIENT celle du
+ * bloc. La nappe est donc cuite au zoom de la mer : c'est plus grossier au
+ * centre, et sans conséquence — `bathy-sources.js` plafonne ses sources à
+ * `BATHY_BASE_ZMAX = 8`, bien au-dessous des zooms de socle.
+ *
  * @param {object} flux
- * @param {{emprise: object, zoom?: number}} arg
+ * @param {{emprise: object, zoom?: number, aussi?: {emprise:object, zoom:number}|null}} arg
  */
-export function demanderEmprise(flux, { emprise, zoom = ZOOM_SOCLE } = {}) {
+export function demanderEmprise(flux, { emprise, zoom = ZOOM_SOCLE, aussi = null } = {}) {
   const g = flux.globe
   const liste = tuilesEmprise(emprise, zoom)
   const z = liste.length ? liste[0].z : Math.floor(zoom)
   const avant = flux.reclamees
   const apres = new Map()
 
   for (const { z: tz, x, y } of liste) {
     const t = g._ensureTile(tz, x, y)
     apres.set(t.key, t)
   }
+  // ⚠️ **APRÈS LA PREMIÈRE, ET LA COLLISION DE CLÉS EST SANS EFFET** : une même
+  // tuile réclamée par les deux emprises n'entre qu'une fois dans la `Map`.
+  const secondes = new Set()
+  if (aussi?.emprise) {
+    for (const { z: tz, x, y } of tuilesEmprise(aussi.emprise, aussi.zoom ?? zoom)) {
+      const t = g._ensureTile(tz, x, y)
+      if (!apres.has(t.key)) secondes.add(t.key)
+      apres.set(t.key, t)
+    }
+  }
 
   // 1. la réservation d'abord : `_buildMesh` la consulte pour GARDER les
   //    hauteurs, et une tuile bâtie avant la réservation les aurait déjà
   //    relâchées. L'ordre n'est pas cosmétique.
   g.gardeHauteurs = new Set(apres.keys())
 
   // 2. ce qui sort de l'emprise sort de la file
   for (const [key, t] of avant) {
     if (apres.has(key)) continue
     g._annuler(t)
@@ -389,33 +445,42 @@ export function demanderEmprise(flux, { emprise, zoom = ZOOM_SOCLE } = {}) {
         t.mesh.geometry.dispose()
         t.mesh.material.dispose()
         t.mesh = null
       }
       t.texture?.dispose()
       t.texture = null
       t.refined = false
       t.retried = false
       t.state = 'empty'
     }
-    if (t.state === 'empty') g._request(t, 1e9)
+    // ⚠️ **LA SECONDE EMPRISE PASSE APRÈS, ET C'EST LA MÊME RAISON QUE LE
+    // `1e9`** : le bloc est ce que l'utilisateur regarde ; le fond marin de la
+    // mer lointaine ne doit pas lui passer devant dans la file.
+    if (t.state === 'empty') g._request(t, secondes.has(t.key) ? 9e8 : 1e9)
   }
 
   flux.reclamees = apres
+  // ⚠️ **LE ZOOM DEMANDÉ RESTE CELUI DU BLOC.** `zoomEffectif` s'en sert pour
+  // dire ce que le SOCLE couvre : y glisser le zoom (plus grossier) de la mer
+  // rendrait un socle « complet » qui ne l'est pas.
   flux.demande = { zoom: z }
 
   // 4. et la MER, à côté. ⚠️ **SANS `await`, ET C'EST LE POINT** : cette
   //    fonction est appelée depuis le crochet `hauteursDeFlux`, sur le chemin
   //    que la Tâche 6 septies vient de rendre instantané. La nappe se peint
   //    pendant ce temps-là ; `remplirHauteurs` fusionnera ce qui est prêt.
   //    Le rejet est absorbé ici : une bathymétrie absente est le cas NORMAL
   //    (on ne cuit pas de tuile là où il n'y a pas de mer), pas une panne.
-  demanderBathy(flux, { emprise, zoom: z }).catch(() => {})
+  const pourBathy = aussi?.emprise
+    ? { emprise: aussi.emprise, zoom: aussi.zoom ?? z }
+    : { emprise, zoom: z }
+  demanderBathy(flux, pourBathy).catch(() => {})
 }
 
 // ══════════ 6 ter. LA MER — Tâche 6 sexies ══════════════════════════════════
 
 // ⚠️ **256 PX PAR TUILE, COMME `dem.js`.** C'est la résolution NATIVE de nos
 // tuiles bathy (`BATHY_TILE_PX`), et c'est aussi l'ordre de grandeur de ce que
 // le socle échantillonne par tuile : une nappe 3×3 fait 768², pour une fenêtre
 // de n = 384 ou 768. Monter plus haut ne peindrait que de l'interpolation ;
 // descendre plus bas rendrait au fond marin les facettes que le Catmull-Rom
 // vient précisément de supprimer.
@@ -607,23 +672,31 @@ export function zoomEffectif(flux, emprise) {
 }
 
 // ══════════ 9. LES HAUTEURS, EN UNE PASSE ═══════════════════════════════════
 
 /**
  * Remplit `(n+1)²` hauteurs sur `emprise`, **en une passe par tuile touchée**.
  *
  * La grille est régulière en MERCATOR (comme le socle lui-même, qui est un carré
  * de Mercator), sommet 0 au coin nord-ouest, ligne-major.
  *
+ * ⚠️ **`bathy` DIT SI LA FUSION A RÉELLEMENT EU LIEU, ET C'EST UN AJOUT DE LA
+ * TÂCHE J.** La nappe arrive de façon ASYNCHRONE : sans ce drapeau, un appelant
+ * qui passe cette fonction à `poserMer` verrait `bathy: true` dès le premier
+ * essai, c'est-à-dire **avant** que la moindre tuile de fond marin ait atterri —
+ * et la mer resterait d'un bleu uniforme pour toujours, en se croyant remplie.
+ * C'est l'exacte classe d'erreur que `revisionFlux` a déjà corrigée une fois
+ * (« un fond marin chargé, fusionnable, et jamais affiché »).
+ *
  * @param {object} flux
  * @param {{emprise: object, n: number, sortie?: Float32Array}} arg
- * @returns {{remplis: number, manquants: number, sortie: Float32Array}}
+ * @returns {{remplis: number, manquants: number, bathy: boolean, sortie: Float32Array}}
  */
 export function remplirHauteurs(flux, { emprise, n, sortie } = {}) {
   const cote = Math.max(1, Math.floor(n)) + 1
   const total = cote * cote
   const out = sortie ?? new Float32Array(total)
   if (out.length < total) {
     throw new RangeError(`remplirHauteurs : sortie de ${out.length} pour ${total} hauteurs`)
   }
   const b = boiteMerc(emprise)
   const dx = (b.x1 - b.x0) / (cote - 1 || 1)
@@ -668,34 +741,36 @@ export function remplirHauteurs(flux, { emprise, n, sortie } = {}) {
   for (let k = 0; k < total; k++) if (vues[k]) remplis++
 
   // ══════════ ET LA MER PAR-DESSUS — Tâche 6 sexies, voir le §4 ═════════════
   //
   // ⚠️ **EN UNE FOIS SUR TOUTE L'EMPRISE, ET APRÈS LE RELIEF.** `fuseBathymetry`
   // constate les aplats de remplissage du champ ENTIER (`detectFillLevels`), et
   // « la fusion ne peut que CREUSER la mer : la terre et le trait de côte
   // restent ceux du terrarium ». L'appeler par tuile lui retirerait les
   // neuf dixièmes de ses sondes.
   const e = flux.bathy
+  let bathy = false
   if (e?.prete && e.peintes > 0) {
+    bathy = true
     const mer = merDeTravail(flux, total)
     ecrireNappe(e, mer, vues, b, cote, dx, dy)
     // `fuseBathymetry` rend un NOUVEAU tableau (elle ne mute pas ses entrées) :
     // on le recopie dans `out`, qui peut être un tampon fourni par l'appelant et
     // dont l'identité est un contrat (`sortie`, testé). ⚠️ **`subarray` BORNE LA
     // FUSION À LA GRILLE** : `remplirHauteurs` accepte une `sortie` plus longue
     // (son `RangeError` ne refuse que le trop COURT), et fusionner le tampon
     // entier écrirait dans la queue de l'appelant, en silence.
     const champ = out.length === total ? out : out.subarray(0, total)
     champ.set(fuseBathymetry(champ, mer))
   }
 
-  return { remplis, manquants: total - remplis, sortie: out }
+  return { remplis, manquants: total - remplis, bathy, sortie: out }
 }
 
 // Le tampon de travail de la mer, gardé sur le flux. ⚠️ **2,4 Mo À n = 768 :
 // le réallouer à chaque raffinement serait une allocation majeure par image
 // pendant les rafales de crans.** La taille de la fenêtre ne change qu'à un
 // changement de résolution, donc ce tampon vit aussi longtemps que le flux.
 function merDeTravail(flux, total) {
   if (flux._mer?.length !== total) flux._mer = new Float32Array(total)
   return flux._mer
 }
diff --git a/src/monde/mer-sphere.js b/src/monde/mer-sphere.js
index 9ebd542..b7741db 100644
--- a/src/monde/mer-sphere.js
+++ b/src/monde/mer-sphere.js
@@ -622,10 +622,97 @@ export function empriseCalotte(repere, portee = PORTEE_DEFAUT) {
   const centreLon = latLonDeLocal(0, 0, repere).lon
   let ouest = centreLon - demiLonDeg
   let est = centreLon + demiLonDeg
   if (demiLonDeg >= 180) { ouest = -180; est = 180 }
   else {
     if (ouest < -180) ouest += 360
     if (est > 180) est -= 360
   }
   return { ouest, sud, est, nord }
 }
+
+// ══════════ ⑦ LE BORD DE LA MER — Tâche J ══════════════════════════════════
+//
+// ⚠️ **CE QUE CETTE SECTION RÉPARE, ET IL A ÉTÉ VU À L'ÉCRAN** : « la mer
+// déborde de ~400 km sur un bloc de 10 km, et l'estompage ne la touche pas ».
+// La calotte partait jusqu'à l'HORIZON GÉOMÉTRIQUE (`porteeHorizon`), ce qui est
+// juste tant que la planète est entière — et faux dès que l'estompage l'efface :
+// il reste alors un grand rectangle bleu flottant sur un fond vide.
+//
+// ⚠️ **LA GÉOMÉTRIE NE BOUGE PAS, C'EST LE FONDU QUI SUIT.** La calotte se cuit
+// à l'arrêt (§« la gravure ne s'écrit qu'à l'arrêt ») : faire varier `portee`
+// par image la reconstruirait — 385² de champ et 193² de sommets. Le bord vit
+// donc dans le FRAGMENT, sur la même mesure de superellipse que la découpe
+// (`globe.js`, `uCropCoin` / `uCropCoinN`), et ne coûte que deux flottants.
+
+/**
+ * La portée de la calotte, en demi-côtés de crop.
+ *
+ * ⚠️ **TROIS, ET C'EST L'EMPRISE 3×3 DU MODE PLAT, PAS UN GOÛT.** La calotte
+ * couvre `u ∈ [−portee, +portee]`, soit **`portee` largeurs de crop** : 3 est
+ * donc exactement l'emprise sur laquelle `mer-emprise.js` cuit le champ du mode
+ * continu (**168 unités = 3 × 56**, `resChamp(3)`). C'est le plus large que le
+ * mode plat considère pour sa mer, et il n'y a aucune raison que la sphère aille
+ * plus loin — sa géométrie à LUI s'arrête même à un seul bloc
+ * (`coteGeometrique`, `damier-carre.js`).
+ *
+ * ⚠️ **ELLE REMPLACE `PORTEE_DEFAUT` POUR LE CROP, ELLE NE L'ABROGE PAS.**
+ * `porteeHorizon` reste juste pour ce qu'elle calcule (une mer qui va jusqu'à
+ * l'horizon d'une planète ENTIÈRE) ; ce n'est simplement plus ce qu'on veut sous
+ * `?terre=unique`, où la planète autour s'efface.
+ */
+export const PORTEE_CROP = 3
+
+/**
+ * Le retrait de l'eau du mode plat, converti en demi-côtés de crop.
+ *
+ * ⚠️ **RECOPIÉ DE `plinth.js`, PAS RÉINVENTÉ — et recopié parce qu'il ne peut
+ * PAS être importé** : `plinth.js` tire three.js, ce module doit rester
+ * chargeable sous node. `test/mer-sphere.test.js` RELIT `src/plinth.js` sur le
+ * disque pour confronter les deux, exactement comme `mer-emprise.test.js` le
+ * fait déjà pour `CHAMP_RES` — un chiffre recopié sans garde diverge en silence.
+ *
+ * Là-bas : `rayonEauDansSocle() = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`,
+ * soit `28 − 0,16 − 0,06`. Le retrait vaut donc `0,22` unité sur un demi-côté de
+ * `COTE_CROP_UNITES / 2 = 28`.
+ */
+export const RETRAIT_EAU_CROP = (0.16 + 0.06) / (COTE_CROP_UNITES / 2)
+
+/**
+ * La part de l'anneau extérieur sur laquelle le fondu court.
+ *
+ * ⚠️ **UN CHOIX, ET IL EST DIT COMME TEL** — aucune mesure ne le fonde. La
+ * moitié : assez long pour qu'aucune arête ne se lise, assez court pour que la
+ * mer garde sa pleine richesse au contact du bloc, qui est ce qu'on regarde.
+ */
+export const FRACTION_BANDE_BORD = 0.5
+
+/**
+ * Où la mer s'éteint, en fonction de l'estompage de la Terre autour.
+ *
+ * Les deux bornes sont exprimées dans la MESURE DE LA DÉCOUPE : `0` est
+ * exactement la frontière du crop, `portee − 1` le bord de la calotte. C'est la
+ * grandeur que `globe.js` calcule déjà par fragment (`pn − uCropCoin`), donc
+ * aucune seconde écriture de la superellipse.
+ *
+ * ⚠️ **LE SENS N'EST PAS INTERCHANGEABLE.** `estompage = 0` = la planète est
+ * ENTIÈRE : la mer peut aller jusqu'au bord de la calotte, elle repose sur des
+ * océans dessinés. `estompage = 1` = il ne reste que le crop : la mer doit
+ * s'arrêter **au bloc**, sinon c'est le rectangle bleu flottant qu'Adrien a vu.
+ *
+ * ⚠️ **ET LE PLANCHER N'EST PAS ZÉRO** : à estompage plein, la mer s'éteint sur
+ * `RETRAIT_EAU_CROP`, c'est-à-dire sur la largeur exacte du chanfrein et de la
+ * marge d'eau du mode plat. Un plancher à zéro ferait une arête dure.
+ *
+ * @param {number} estompage dans [0, 1] — `estompage-terre.js`
+ * @param {number} [portee] en demi-côtés de crop
+ * @returns {{debut:number, fin:number}} en demi-côtés de crop, mesurés depuis
+ *   la frontière du crop (0 = la frontière)
+ */
+export function bordDeMer(estompage, portee = PORTEE_CROP) {
+  const brut = Number(estompage)
+  const e = Number.isFinite(brut) ? Math.min(1, Math.max(0, brut)) : 0
+  const p = Number.isFinite(portee) && portee > 1 ? portee : PORTEE_CROP
+  const fin = Math.max(RETRAIT_EAU_CROP, (p - 1) * (1 - e))
+  const bande = Math.max(RETRAIT_EAU_CROP, fin * FRACTION_BANDE_BORD)
+  return { debut: Math.max(0, fin - bande), fin }
+}
diff --git a/test/fenetre-branchee.test.js b/test/fenetre-branchee.test.js
index dadc4ff..ed7ada6 100644
--- a/test/fenetre-branchee.test.js
+++ b/test/fenetre-branchee.test.js
@@ -891,21 +891,32 @@ test('⑩g LE GRAIN FBM SURVIT AU CHEMIN DU FLUX', async () => {
 
 test('⑩h `main.js` BRANCHE LE CROCHET, ET IL PASSE PAR R3 ET PAR `majHauteurs`', () => {
   const code = sansCommentaires(lire('src/main.js'))
   assert.ok(/terrain\.hauteursDeFlux\s*=/.test(code), '`main.js` ne pose plus le crochet des hauteurs')
   assert.ok(/creerFlux\(\{\s*globe\s*\}\)/.test(code), 'le flux n\'est plus créé sur le globe')
   // ⚠️ **ON DEMANDE LE ZOOM DU BLOC, ET `remplirBorne` A ÉTÉ RETIRÉ D'ICI SUR
   // UNE MESURE**, pas sur un goût : `debitObserve` rendait **0,787 Mb/s** sur un
   // lien OISIF, donc `zoomSoutenable` rendait **z5**, donc le socle réservait
   // **UNE tuile** (`5/16/11`) au lieu des neuf de son emprise — et rien ne le
   // rattrapait tant que la caméra ne bougeait pas. Voir la note dans `main.js`.
-  assert.ok(/demanderEmprise\(flux, \{ emprise, zoom: params\.demZoom \}\)/.test(code), 'le socle ne demande plus le zoom du bloc')
+  // ⚠️ **ÉLARGI PAR LA TÂCHE J, PAS DÉPLACÉ** : `demanderEmprise` accepte une
+  // SECONDE emprise (`aussi`, celle de la mer) parce que `gardeHauteurs` est
+  // remplacée à chaque appel et que deux appels se reprendraient leurs tuiles.
+  // Le zoom du BLOC reste celui-ci, et c'est ce que cette ligne défend.
+  assert.ok(/demanderEmprise\(flux, \{ emprise, zoom: params\.demZoom[,\s}]/.test(code), 'le socle ne demande plus le zoom du bloc')
+  // ⚠️ **ET LES DEUX APPELANTS PASSENT LE MÊME `aussi`.** Celui des deux qui
+  // l'oublierait ANNULERAIT, à chaque image, les tuiles que l'autre vient de
+  // demander (`demanderEmprise` rend à `empty` ce qui sort de `reclamees`) —
+  // c'est-à-dire un fond marin qui ne se charge jamais, sans une erreur.
+  const appels = code.match(/demanderEmprise\(flux, \{[^}]*\}(?:[^)]*)\)/g) || []
+  assert.equal(appels.length, 2, `deux appelants attendus, ${appels.length} trouvés`)
+  for (const a of appels) assert.ok(/aussi: empriseZoomMer\(\)/.test(a), `appel sans \`aussi\` : ${a}`)
   assert.equal(/remplirBorne\(/.test(code), false, '`remplirBorne` est revenu sur le chemin du socle : relire la mesure avant de le remettre')
   assert.ok(/majHauteurs\(fenetre, flux\)/.test(code), '`majHauteurs` n\'est plus appelé en production')
   // ⚠️ et le recadrage passe AVANT le remplissage, sinon le socle reste collé
   // au premier lieu chargé (mesuré à l'écran sur quatre lieux).
   const iRecadre = code.indexOf('recadrerFenetre(fenetre')
   const iRemplit = code.indexOf('demanderEmprise(flux')
   assert.ok(iRecadre > 0 && iRecadre < iRemplit, 'le recadrage ne passe plus avant le remplissage')
   // ⚠️ et le raffinement existe, sinon le socle resterait grossier pour toujours
   assert.ok(/socleRaffine\(\)/.test(code), 'le raffinement n\'est plus appelé par image')
   // ⚠️ ni `terrain.js` ni `main.js` ne ferment le cycle d'import
diff --git a/test/flux-terrain.test.js b/test/flux-terrain.test.js
index 7b2c922..05d1de9 100644
--- a/test/flux-terrain.test.js
+++ b/test/flux-terrain.test.js
@@ -213,20 +213,21 @@ const globeMod = await import('../src/globe.js')
 const { Globe, PLAFOND_FILE, _resetTileMemo, _resetJournalReseau, noterReponse } = globeMod
 const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT, MERCATOR_MAX_LAT } = await import('../src/geo.js')
 const { empriseSocle, ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
 const {
   creerFlux,
   demanderEmprise,
   demanderBathy,
   tuilesPretes,
   zoomEffectif,
   remplirHauteurs,
+  zoomPourEmprise,
   revisionFlux,
   debitObserve,
   tuilesEmprise,
   MERCATOR_LAT_MAX,
 } = await import('../src/monde/flux-terrain.js')
 
 const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
 const { loadDem, _resetTileCaches } = await import('../src/dem.js')
 const { empriseBlocMNT } = await import('../src/geo.js')
 
@@ -942,10 +943,129 @@ test('panoramique à réseau rapide : le globe RETROUVE sa profondeur après le
   // le balayage périme tout : c'est le geste, pas un accident
   assert.ok(m.balayage.zmax < m.stable.zmax, 'le balayage ne périme rien : le banc ne bouge pas assez')
   assert.ok(
     m.apres.zmax >= m.stable.zmax,
     `le globe reste à z${m.apres.zmax} depuis z${m.stable.zmax} : la file est encore coincée`
   )
   assert.equal(m.zoomFlux, ZOOM_SOCLE, `zoom effectif ${m.zoomFlux} au lieu de ${ZOOM_SOCLE}`)
   assert.ok(m.apres.loading < PLAFOND_FILE, `${m.apres.loading} tuiles encore \`loading\``)
   m.g.dispose()
 })
+
+// ══════════ LE ZOOM SE CHOISIT DEPUIS L'EMPRISE — Tâche J, trou n° 2 ════════
+//
+// ⚠️ **CE QUE CETTE SECTION DÉFEND EST UN CHIFFRE MESURÉ PAR LA TÂCHE F** : sur
+// un champ de mer de 164 km, « z12 ne couvre que 19,3 % des nœuds ; z10 en
+// couvre 100 % pour 25 tuiles ». Un zoom POSÉ à la valeur du bloc ne peut pas
+// remplir une emprise dix fois plus large — c'est de là que venait l'aplat gris.
+
+test('zoomPourEmprise : le zoom le plus FIN qui tienne dans le budget, et il est MAXIMAL', async () => {
+  const emprise = empriseSocle({ centre: CENTRE })
+  for (const tuilesMax of [4, 9, 16, 25, 64]) {
+    const z = zoomPourEmprise(emprise, { zoomMax: 14, tuilesMax })
+    assert.ok(tuilesEmprise(emprise, z).length <= tuilesMax,
+      `z${z} dépasse le budget de ${tuilesMax}`)
+    // ⚠️ **LA MAXIMALITÉ EST L'ASSERTION QUI COMPTE** : rendre `zoomMin` tout
+    // de suite tiendrait toujours dans le budget et serait toujours faux. Le
+    // niveau suivant doit VRAIMENT déborder — sauf si on est déjà au plafond.
+    if (z < 14) {
+      assert.ok(tuilesEmprise(emprise, z + 1).length > tuilesMax,
+        `z${z + 1} tiendrait aussi dans ${tuilesMax} : le zoom n est pas maximal`)
+    }
+  }
+})
+
+test('zoomPourEmprise : une emprise PLUS LARGE rend un zoom PLUS GROSSIER', async () => {
+  // le sens, et il n'est pas interchangeable : une mutation qui échange les
+  // bornes de la boucle rendrait un zoom constant.
+  const etroite = empriseSocle({ centre: CENTRE })
+  const large = { ouest: -40, sud: -40, est: 40, nord: 40 }
+  const zE = zoomPourEmprise(etroite, { zoomMax: 14, tuilesMax: 25 })
+  const zL = zoomPourEmprise(large, { zoomMax: 14, tuilesMax: 25 })
+  assert.ok(zL < zE, `large z${zL} doit être plus grossier qu étroite z${zE}`)
+  // et les bornes sont respectées des deux côtés
+  assert.ok(zoomPourEmprise(large, { zoomMax: 3, tuilesMax: 1 }) <= 1)
+  assert.equal(zoomPourEmprise(etroite, { zoomMax: 6, zoomMin: 6, tuilesMax: 1 }), 6)
+  assert.ok(zoomPourEmprise(etroite, { zoomMax: 20, tuilesMax: 1e9 }) <= 15, 'jamais au-delà de MAX_Z')
+})
+
+// ══════════ LA SECONDE EMPRISE — Tâche J, `aussi` ══════════════════════════
+//
+// ⚠️ **ELLE NE POUVAIT PAS ÊTRE UN SECOND APPEL**, et c'est tout le §« un seul
+// flux par globe » : `gardeHauteurs` est REMPLACÉE à chaque appel. Ces trois
+// tests défendent les trois propriétés qui rendent l'élargissement sûr.
+
+test('`aussi: null` reproduit le dépôt : mêmes tuiles, même réservation', async () => {
+  const g = neuf()
+  const flux = creerFlux({ globe: g })
+  const emprise = empriseSocle({ centre: CENTRE })
+  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: null })
+  const attendues = tuilesEmprise(emprise, ZOOM_SOCLE)
+  assert.equal(flux.reclamees.size, attendues.length)
+  assert.equal(g.gardeHauteurs.size, attendues.length)
+  for (const { z, x, y } of attendues) assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`))
+  g.dispose()
+})
+
+test('`aussi` réserve les DEUX emprises À LA FOIS — sinon chacune reprend l autre', async () => {
+  const g = neuf()
+  const flux = creerFlux({ globe: g })
+  const emprise = empriseSocle({ centre: CENTRE })
+  // trois fois plus large, deux niveaux plus grossier : l'emprise de la mer
+  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
+  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
+  assert.ok(zMer < ZOOM_SOCLE, `le témoin n a de sens que si le zoom de la mer diffère (z${zMer})`)
+
+  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } })
+
+  const duBloc = tuilesEmprise(emprise, ZOOM_SOCLE)
+  const deLaMer = tuilesEmprise(merEmprise, zMer)
+  for (const { z, x, y } of duBloc) {
+    assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`), `le bloc a perdu ${z}/${x}/${y}`)
+  }
+  for (const { z, x, y } of deLaMer) {
+    assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`), `la mer a perdu ${z}/${x}/${y}`)
+    const t = g.tiles.get(`${z}/${x}/${y}`)
+    assert.ok(t && ['loading', 'ready'].includes(t.state), `la tuile de mer ${z}/${x}/${y} n est pas demandée`)
+  }
+  // ⚠️ **ET LE ZOOM DEMANDÉ RESTE CELUI DU BLOC** : `zoomEffectif` s'en sert
+  // pour dire ce que le SOCLE couvre, et le zoom de la mer est plus grossier.
+  assert.equal(flux.demande.zoom, ZOOM_SOCLE)
+  g.dispose()
+})
+
+test('deux appels avec le MÊME `aussi` n annulent rien — c est la garde de la reprise', async () => {
+  const g = neuf()
+  const flux = creerFlux({ globe: g })
+  const emprise = empriseSocle({ centre: CENTRE })
+  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
+  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
+  const arg = { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } }
+  demanderEmprise(flux, arg)
+  const apresUn = new Set(g.gardeHauteurs)
+  demanderEmprise(flux, arg)
+  assert.deepEqual([...g.gardeHauteurs].sort(), [...apresUn].sort(),
+    'un second appel identique doit rendre exactement la même réservation')
+
+  // ⚠️ **ET LE TÉMOIN NÉGATIF** : celui qui OUBLIE `aussi` reprend les tuiles de
+  // la mer. C'est la raison pour laquelle `main.js` doit le passer aux DEUX
+  // appelants — sans ce test, la règle serait un commentaire.
+  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
+  const perdues = tuilesEmprise(merEmprise, zMer)
+    .filter(({ z, x, y }) => !g.gardeHauteurs.has(`${z}/${x}/${y}`))
+  assert.ok(perdues.length > 0, 'un appel sans `aussi` DOIT reprendre les tuiles de la mer')
+  g.dispose()
+})
+
+test('remplirHauteurs DIT si la fusion a eu lieu — sans quoi la mer se croit remplie', async () => {
+  // ⚠️ **LE DÉFAUT MUET QUE CE DRAPEAU FERME** : la nappe arrive de façon
+  // asynchrone, et `poserMer` ne cuit son champ qu'une fois. Sans un `bathy`
+  // honnête, la première cuisson — celle d'avant la nappe — se déclarerait
+  // bathymétrique et la mer resterait d'un bleu uniforme pour toujours.
+  const g = neuf()
+  const flux = creerFlux({ globe: g })
+  const emprise = empriseSocle({ centre: CENTRE })
+  // aucune nappe demandée : `flux.bathy` est vide
+  const sansNappe = remplirHauteurs(flux, { emprise, n: 8 })
+  assert.equal(sansNappe.bathy, false, 'sans nappe, la fusion n a PAS eu lieu')
+  g.dispose()
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index 998747b..f98c935 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -48,41 +48,46 @@ import {
   PAS_DIAGONAL,
   empriseCalotte,
   BUDGET_PROFONDEUR_UNITES,
   budgetProfondeurM,
   SEUIL_TRAIT_EAU_UNITES,
   seuilTraitEauM,
   ECHELLE_HOULE_UNITES,
   echelleHouleM,
   RAMPE_NAUTIQUE,
   abscisseNautique,
+  PORTEE_CROP,
+  RETRAIT_EAU_CROP,
+  FRACTION_BANDE_BORD,
+  bordDeMer,
 } from '../src/monde/mer-sphere.js'
+import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
 // ⚠️ L'ALIAS QUE VITE POSE (`vite.config.js`), RÉSOLU SANS VITE — le patron de
 // `test/damier-mer-runtime.test.js` : la copie vendorée fait foi ici, et cinq
 // lignes suffisent. Sans ce hook, `Globe.prototype.poserMer` ne peut être
 // exercée QUE jusqu'à sa clause de refus (`await import('./ocean.js')` lève),
 // ce qui est exactement le trou du Tour de correction 1 (constat I1/F-3) :
 // ~150 lignes de corps de méthode — la dérivation de portée, la cuisson du
 // champ, la construction du maillage — n'étaient exercées par PERSONNE.
 registerHooks({
   resolve(spec, ctx, suivant) {
     if (spec === 'ocean-waves') {
       return { url: new URL('../src/vendor/ocean-waves/index.js', import.meta.url).href, shortCircuit: true }
     }
     return suivant(spec, ctx)
   },
 })
 import { Globe } from '../src/globe.js'
 import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
 import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
 import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
-import { largeurCropM, EXAG_SOCLE_NOMINALE } from '../src/monde/habillage-crop.js'
+import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 
 // La Réunion — le crop de toutes les tâches de ce chantier.
 const CENTRE = { lat: -21.115, lon: 55.536 }
 const REPERE = repereCrop({ centre: CENTRE })
 const R_TERRE_M = 6371000 // `EARTH_RADIUS_M` de src/geo.js
 const R_GLOBE = 100 // `R_GLOBE` de src/geo.js
 const DEMI_M = largeurCropM(REPERE) / 2
@@ -937,23 +942,30 @@ function globeAvecCrop(overrides = {}) {
     _merEtat: null,
     uniforms: {
       uSunDir: val({}),
       uCropCoin: val(0),
       uCropCoinN: val(2),
       uMerRampeOn: val(0),
       uMerFondBudgetM: val(6000),
       uOceanShallow: val({ set() {} }),
       uOceanMid: val({ set() {} }),
       uOceanDeep: val({ set() {} }),
+      // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
+      // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
+      uEstompageOn: val(0),
+      uEstompage: val(1),
     },
     retirerMer: Globe.prototype.retirerMer,
     _cuireChampMer: Globe.prototype._cuireChampMer,
+    _majBordMer: Globe.prototype._majBordMer,
+    _melangeCalottes() {},
+    _calottes: [],
     ...overrides,
   }
 }
 
 // un fond marin de synthèse, uniformément à −500 m : ces tests n'ont rien à
 // prouver sur la bathymétrie (§3 de la tâche, déjà couvert ailleurs),
 // seulement sur ce que `poserMer` FAIT du résultat de `remplir`.
 const remplirBouchon = (emprise, n, sortie) => {
   sortie.fill(-500)
   return { remplis: sortie.length }
@@ -1020,10 +1032,162 @@ test('⑩j retirer une mer POSÉE la fait vraiment disparaître du groupe', () =
   const g = globeAvecCrop()
   return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon }).then(() => {
     assert.equal(g.group.children.length, 1)
     Globe.prototype.retirerMer.call(g)
     assert.equal(g.group.children.length, 0)
     assert.equal(g._mer, null)
     assert.equal(g.uniforms.uMerRampeOn.value, 0)
     assert.equal(g.uniforms.uMerFondBudgetM.value, 6000)
   })
 })
+
+// ══════════ ⑪ LE BORD DE LA MER — Tâche J ═══════════════════════════════════
+//
+// ⚠️ **CE QUE CETTE SECTION DÉFEND EST UN DÉFAUT VU À L'ÉCRAN** : « la mer
+// déborde de ~400 km sur un bloc de 10 km, et l'estompage ne la touche pas ».
+// Deux choses doivent tenir ensemble : la calotte est BORNÉE sur l'emprise du
+// crop, et son extinction SUIT l'estompage de la Terre autour.
+
+test('⑪a `RETRAIT_EAU_CROP` est bien celui de `plinth.js`, relu sur le DISQUE', () => {
+  // ⚠️ **UN CHIFFRE RECOPIÉ SANS GARDE DIVERGE EN SILENCE.** `plinth.js` tire
+  // three.js et ne peut pas être importé par un module pur ; on relit donc sa
+  // source, exactement comme `mer-emprise.test.js` le fait pour `CHAMP_RES`.
+  const src = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
+  const chanfrein = Number(/export const SOCLE_CHANFREIN = ([\d.]+)/.exec(src)?.[1])
+  const marge = Number(/export const SOCLE_MARGE_EAU = ([\d.]+)/.exec(src)?.[1])
+  assert.ok(Number.isFinite(chanfrein) && Number.isFinite(marge), 'les deux constantes doivent être relues')
+  const attendu = (chanfrein + marge) / (COTE_CROP_UNITES / 2)
+  assert.ok(Math.abs(RETRAIT_EAU_CROP - attendu) < 1e-12, `${RETRAIT_EAU_CROP} contre ${attendu}`)
+})
+
+test('⑪b la mer S ARRÊTE AU BLOC quand la Terre autour est effacée', () => {
+  // estompage = 1 : il ne reste que le crop. Le fondu doit finir SUR la
+  // frontière, à la largeur du chanfrein près — c'est là que `plinth.js`
+  // arrête l'eau du mode plat (`rayonEauDansSocle`).
+  const b = bordDeMer(1)
+  assert.equal(b.debut, 0, 'le fondu commence exactement à la frontière du crop')
+  assert.ok(Math.abs(b.fin - RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin}`)
+  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : la mer d'avant la Tâche J allait à
+  // l'horizon géométrique, soit ~93 demi-côtés à l'altitude de naissance du
+  // socle. Trois ordres de grandeur.
+  assert.ok(b.fin < porteeHorizon(REPERE, 32274, R_TERRE_M) / 1000)
+})
+
+test('⑪c la mer VA JUSQU AU BORD DE LA CALOTTE quand la planète est entière', () => {
+  const b = bordDeMer(0)
+  assert.ok(Math.abs(b.fin - (PORTEE_CROP - 1)) < 1e-12, `fin ${b.fin} contre ${PORTEE_CROP - 1}`)
+  // la bande de fondu couvre la fraction annoncée de l'anneau extérieur
+  assert.ok(Math.abs(b.debut - (PORTEE_CROP - 1) * (1 - FRACTION_BANDE_BORD)) < 1e-12)
+})
+
+test('⑪d le bord est MONOTONE en estompage — c est ce qui interdit un à-coup', () => {
+  // ⚠️ **UNE MUTATION DE SIGNE SURVIT À DEUX BORNES SEULES.** On balaie.
+  let precedent = Infinity
+  for (let i = 0; i <= 40; i++) {
+    const b = bordDeMer(i / 40)
+    assert.ok(b.fin <= precedent + 1e-12, `la mer ne doit jamais S ÉTENDRE en descendant (${i})`)
+    assert.ok(b.debut >= 0 && b.debut <= b.fin, `bornes incohérentes à ${i} : ${b.debut} / ${b.fin}`)
+    precedent = b.fin
+  }
+  // et le SENS n'est pas interchangeable : effacer la Terre RÉTRÉCIT la mer
+  assert.ok(bordDeMer(1).fin < bordDeMer(0).fin)
+})
+
+test('⑪e une valeur non finie ne peut pas faire disparaître la mer', () => {
+  // même contrat que `poserEstompage` : un NaN dans un uniforme éteint la
+  // moitié d'un GPU sans un mot. Ici il retombe sur « la planète est entière ».
+  for (const mauvais of [NaN, undefined, null, 'x', {}]) {
+    assert.deepEqual(bordDeMer(mauvais), bordDeMer(0), `${String(mauvais)}`)
+  }
+  // et l'écrêtage tient des deux côtés
+  assert.deepEqual(bordDeMer(-5), bordDeMer(0))
+  assert.deepEqual(bordDeMer(12), bordDeMer(1))
+})
+
+test('⑪f `PORTEE_CROP` rend l emprise de la mer RÉSERVABLE — les trous 2 et 3 sont le même', () => {
+  // ⚠️ **C'EST LE LIEN ENTRE LES DEUX TROUS, ET IL EST ARITHMÉTIQUE.** Une
+  // calotte à l'horizon (`PORTEE_DEFAUT`) couvre une emprise qu'AUCUN budget de
+  // tuiles ne peut réserver au zoom du bloc : c'est de là que venait la
+  // couverture de 0,7 %. Bornée à `PORTEE_CROP`, elle tient dans 25 tuiles à
+  // quelques niveaux du bloc, ce qui est ce que la Tâche F avait mesuré.
+  const emprise = empriseCalotte(REPERE, PORTEE_CROP)
+  const z = zoomPourEmprise(emprise, { zoomMax: 12, tuilesMax: 25 })
+  assert.ok(z >= 9 && z <= 12, `zoom ${z} : la mer du crop doit rester dans les niveaux du bloc`)
+  // le témoin : à l'horizon, le même budget fait tomber le zoom bien plus bas
+  const large = empriseCalotte(REPERE, PORTEE_DEFAUT)
+  assert.ok(zoomPourEmprise(large, { zoomMax: 12, tuilesMax: 25 }) < z,
+    'une calotte à l horizon doit exiger un zoom PLUS GROSSIER — sinon le bornage ne sert à rien')
+})
+
+test('⑪g le nuanceur de la mer LIT vraiment le bord, et sur la mesure de la DÉCOUPE', () => {
+  // ⚠️ **PAS UN `grep` DE NOM.** On extrait le corps du fragment et on vérifie
+  // que l'alpha des DEUX sorties est multiplié par le facteur de bord — la
+  // Tâche C a payé une fois un uniforme posé et lu par personne, et cette
+  // tâche-ci vient d'en réveiller deux (`uCropCoin`, `uCropCoinN`).
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  const frag = /const MER_FRAG = \/\* glsl \*\/ `([\s\S]*?)`\n/.exec(src)?.[1]
+  assert.ok(frag, 'le fragment de la mer doit être extractible')
+  assert.ok(/uniform vec2 uMerBord;/.test(frag), 'le bord doit être déclaré')
+  // la mesure est celle de la découpe : cq / pn / uCropCoinN, comme le nuanceur
+  // des tuiles — pas un max(abs(u), abs(v))
+  assert.ok(/pow\(pow\(cq\.x, uCropCoinN\) \+ pow\(cq\.y, uCropCoinN\), 1\.0 \/ uCropCoinN\)/.test(frag),
+    'la superellipse de la découpe doit être celle du bord')
+  const sorties = frag.match(/gl_FragColor = vec4\([^;]*;/g) || []
+  assert.equal(sorties.length, 2, 'le fragment a exactement deux sorties')
+  for (const s of sorties) assert.ok(/\bbord \*/.test(s), `sortie sans bord : ${s}`)
+  // et le rejet anticipé : au-delà du bord, rien n'est calculé
+  assert.ok(/if \(bord <= 0\.0\) discard;/.test(frag))
+})
+
+test('⑪h `poserMer` POSE le bord, et `poserEstompage` le RECALE', () => {
+  const g = globeAvecCrop()
+  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
+    const u = g._mer.material.uniforms.uMerBord.value
+    // sans estompage posé, la planète est ENTIÈRE : la mer va au bord
+    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `fin ${u.y}`)
+    Globe.prototype.poserEstompage.call(g, 1)
+    assert.ok(Math.abs(u.y - RETRAIT_EAU_CROP) < 1e-9, `après estompage plein : ${u.y}`)
+    assert.equal(u.x, 0)
+    // et le retour : `retirerEstompage` rend la planète entière, donc la mer
+    Globe.prototype.retirerEstompage.call(g)
+    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `après retrait : ${u.y}`)
+  })
+})
+
+test('⑪i `poserMer` REFUSE un champ vide, et le refus N EFFACE PAS la mer en place', () => {
+  const g = globeAvecCrop()
+  const presqueVide = (emprise, n, sortie) => ({ remplis: Math.round(sortie.length * 0.007) })
+  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
+    assert.equal(g.group.children.length, 1)
+    // le champ mesuré à 0,7 % de couverture — celui de l'aplat gris
+    return Globe.prototype.poserMer.call(g, { remplir: presqueVide, portee: PORTEE_CROP, couvertureMin: 0.99 })
+  }).then((r) => {
+    assert.equal(r.refus, 'champ', 'un champ à 0,7 % doit refuser')
+    assert.ok(r.couverture < 0.01, `couverture rendue : ${r.couverture}`)
+    assert.equal(g.group.children.length, 1, 'la mer en place ne doit pas avoir bougé')
+    // ⚠️ **ET LE DÉFAUT RESTE CELUI DU DÉPÔT** : sans `couvertureMin`, le même
+    // champ presque vide POSE, exactement comme avant la Tâche J.
+    return Globe.prototype.poserMer.call(g, { remplir: presqueVide, portee: PORTEE_CROP })
+  }).then((r) => {
+    assert.equal(r.refus, undefined, 'le défaut `couvertureMin = 0` ne refuse rien')
+  })
+})
+
+test('⑪j `exigerBathy` attend la nappe, et un `remplir` MUET garde le défaut du dépôt', () => {
+  const g = globeAvecCrop()
+  const sansNappe = (emprise, n, sortie) => { sortie.fill(-500); return { remplis: sortie.length, bathy: false } }
+  return Globe.prototype.poserMer.call(g, { remplir: sansNappe, portee: PORTEE_CROP, exigerBathy: true }).then((r) => {
+    assert.equal(r.refus, 'champ')
+    assert.equal(r.bathy, false, 'le refus doit DIRE que la bathymétrie manque')
+    assert.equal(g.group.children.length, 0, 'rien ne doit être posé')
+    // le même champ sans exigence : posé, et `bathy` dit la vérité
+    return Globe.prototype.poserMer.call(g, { remplir: sansNappe, portee: PORTEE_CROP })
+  }).then((r) => {
+    assert.equal(r.bathy, false)
+    assert.equal(g.group.children.length, 1)
+    // et un `remplir` MUET — tout appelant d'avant la Tâche J — garde `true`
+    return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP, exigerBathy: true })
+  }).then((r) => {
+    assert.equal(r.refus, undefined, 'un remplir muet ne doit pas se mettre à refuser')
+    assert.equal(r.bathy, true)
+  })
+})
