# Plan — LE STUDIO SUR LE GLOBE

> Successeur de `2026-08-21-terre-unique.md`, qui a livré la structure (tâches A–I).
> Ce plan-ci livre **le rendu et le studio**. Il ne recommence rien de ce qui est porté.

## §0 — Ce qui gouverne, et qui n'est pas négociable

**Le verdict d'Adrien sur l'état livré : « clairement catastrophique ».** Accepté sans
discussion. La structure tient (une seule Terre, aucune couture, zoom sans cran), **l'image
non**. Ce plan répare l'image et adapte le studio.

### Les consignes d'Adrien (2026-08-21, nuit)

- **D1 — Zéro niveau, zéro saut, ET FONDU ENTRE NIVEAUX.** Plus d'indicateur `ORB`/`Z12`,
  plus d'accrochage de caméra, plus de pause de chargement, **et les niveaux se fondent**.
- **D2 — LE BLOC GRANDIT EN CONTINU DEPUIS LA SPHÈRE.** Pas de seuil, pas d'apparition.
  ⚠️ **`seuil-socle.js` et ses deux seuils DISPARAISSENT** au profit d'une loi continue.
- **D3 — TOUTES LES OPTIONS EXISTANTES SONT CONSERVÉES ET ADAPTÉES.**
  *« shibumap est une solution complète studio de création de map »*. **Aucune option ne se
  perd en route.** Ce n'est pas une refonte esthétique : c'est une adaptation **exhaustive**,
  option par option, **vérifiée une par une**.
- **D5 — LE MODE PLAT : NE PAS Y TOUCHER.** *« ne le modifie pas, garde-le juste de côté »*.
  ⛔ **Interdiction de modifier `terrain.js`, `plinth.js`, `ocean.js` et le chemin bloc.**
  Tout ce qui est neuf vit à côté, derrière `?terre=unique`.
  ➡️ **La dépose est ANNULÉE. Le défaut de chanfrein d'`ocean.js` (+41,4 %) reste tel quel.**
- **D6 — L'EXAGÉRATION : ≈2 AU ZOOM MAXIMAL, VARIATION LIMITÉE.**
- **D7 — LES TROUS D'ABORD.** *« les maps sont clairement vides de surface »*.
  **La surface pleine passe AVANT le rendu.** Une belle rampe sur une surface vide ne vaut rien.
- **D8 — REPENSER POUR LA SPHÈRE, ne pas transposer le plat.**

### Les règles de vérification héritées — SEPT façons dont un banc a menti ici

1. **`autoClear === false`** : la cible n'est jamais nettoyée → une preuve de couverture naïve
   rend **1,0 TOUJOURS**. Payé deux fois.
2. **`getClearAlpha()` vaut 1** : compter les pixels d'alpha non nul rend **262 144 / 262 144**.
   **On CACHE l'objet et on compte ce qui CHANGE.**
3. **L'atmosphère et les nuages remplissent le cadre** — à masquer **des deux côtés**.
   ⚠️ **On ne mesure pas son propre effet avec un banc qui masque ce qu'on modifie.**
4. **Un « témoin » qui rend la mauvaise scène** : `x.scene` est le SOCLE, le globe vit dans
   `sceneGlobe`. Un écart de zéro partout, qui ressemble à une réussite.
5. **La boucle rAF laissée tournante** : −1,589 ms de dérive, des postes éteints crédités.
6. **La compilation du nuanceur dans le chrono**, et **un tour rejeté**.
7. **Une sonde lue APRÈS la fonction ment de façon plausible.**

Et : **un écart moyen n'est pas un critère perceptif** · **20 images, les 12 premières jetées**
· **un témoin nul est soit une preuve, soit un banc qui ne rend rien — dire lequel** ·
**charger la page fait partie de la clôture** (un agent a livré du code qui plantait au
démarrage **avec 3 098 tests verts**).

### ⛔ LE DÉFAUT ENDÉMIQUE : LES DÉNOMINATEURS

**Trois tâches d'affilée ont publié un rapport qui mélangeait des monnaies.** La Tâche C a
retiré **deux** chiffres-titres ; la Tâche D a retiré son « cent vingt fois » **sans le
remplacer** (trois monnaies, pas deux — et **les deux chiffres proposés par son relecteur
étaient faux aussi**) ; la Tâche F a publié un **« 986 tuiles » sans aucune source**.

**Tout chiffre remonte à une donnée brute laissée sur le disque. Un chiffre retiré vaut mieux
qu'un chiffre faux, et c'est ce qui rend un rapport crédible ici.**

### Mutations, worktrees, arbre partagé

⚠️ **Une mutation change le COMPORTEMENT, pas la CHAÎNE qu'une assertion cherche** — une
tâche a vu **12 de ses 15 mutations survivre** à une campagne refaite sémantiquement.
⚠️ **Une constante peut être du code mort sans que rien ne le signale** — trouvé **quatre fois**.
⚠️ **Campagnes dans un `git worktree` à part, retiré en partant.** **`core.autocrlf=true`** :
un `worktree add` sort des fichiers en **CRLF** alors que le blob est en **LF** → **faux
survivants**. **Quatre agents sont tombés dedans.**
⚠️ **L'arbre est partagé entre plusieurs sessions** — vérifier `git log`.

### Le fov

**Le fov canonique est `FOV_DEG = 30` (`main.js:289`)**, mais **l'application vivante tourne à
33** parce qu'un template repose `params.fov` (`templates-user.js:109` → `main.js:5363` →
`main.js:4285`). ⚠️ **Deux fautes critiques déjà payées là-dessus.**
➡️ **Tout ce qui dérive un seuil du fov lit `camera.fov`/`camGlobe.fov` EN DIRECT.**
⚠️ **Et la citation `main.js:263` est FAUSSE** (c'est le maillage du bloc) — la bonne est **`:289`**.

## §1 — Les deux études qui fondent l'ordre

- `.superpowers/sdd/2026-08-21-terre-unique/inventaire-studio.md` — **89 entrées, 34
  dépendent confirmé du plat.**
- `.superpowers/sdd/2026-08-21-terre-unique/etude-fondu-niveaux.md` — **et sa conclusion
  renverse l'ordre attendu.**

> ⛔ **LES ARÊTES DROITES NE SONT PAS UN PROBLÈME DE GÉOMÉTRIE.** Elles vivent dans le
> nuanceur de fragment : **`minFade` (`globe.js:921-928`) dépend de `fwidth(vUv) * uTilePx`,
> une mesure LOCALE À LA TUILE**, et **le grain de papier (`globe.js:955`) est indexé sur
> `vUv`**, dont la fréquence est inversement proportionnelle à la taille au sol de la tuile.
> **Une tuile entière peut s'afficher comme un champ plat pendant que sa voisine garde ses
> courbes.** ⚠️ **Le morphing géométrique ne peut structurellement rien y faire.**
>
> **Et le dépôt sait déjà faire :** l'habillage indexe son grain sur **`qCrop`, jamais `vUv`**
> (`globe.js:788-798`, commentaire explicite « le grain se répéterait à chaque tuile »).

**Recommandation retenue : la continuité de TEXTURE d'abord, le morphing ENSUITE.** Faire le
morphing en premier livrerait un geste coûteux (**+23 % de géométrie par tuile**) qui
laisserait le symptôme le plus visible intact.

## §2 — Ce qui est déjà porté : NE PAS REPLANIFIER

`crop-sphere.js` · `parois-crop.js` · `habillage-crop.js` · `rampe-crop.js` ·
`exageration-continue.js` · `mer-sphere.js` · `estompage-terre.js` · `branchement-crop.js`.

## §3 — LES TÂCHES

### ═══ ACTE I — LA SURFACE (D7 : les trous d'abord) ═══

#### Tâche J — LA SURFACE PLEINE ⚠️ EN PREMIER, CONSIGNE D'ADRIEN

**Fichiers :** `src/main.js` (`contexteCrop`), `src/monde/branchement-crop.js`, tests.
⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**

Trois trous mesurés, **un seul défaut** :

1. ⛔ **La bathymétrie n'est jamais demandée.** `contexteCrop()` (`main.js:4688-4696`) le dit
   en toutes lettres : « PAS DE BATHYMÉTRIE… la mer sera d'un bleu uniforme ». Champ couvert
   à **0,7 %**, `bathy: false`. **Brancher `remplir` sur `bathy.js`.**
2. ⛔ **Le champ n'est rempli qu'à UN SEUL zoom** — z12 sur 164 km ne couvre que **19,3 %**
   des nœuds ; **z10 en couvre 100 %** pour 25 tuiles. **Choisir le zoom depuis l'emprise.**
3. ⛔ **La mer déborde de 400 km sur un bloc de 10 km**, et **l'estompage ne la touche pas**.
   Borner la portée de la calotte sur l'emprise du crop, et **la faire suivre l'estompage**.

- [ ] Test → rouge → implémenter → mutation → **REGARDER L'ÉCRAN** → clôture.
- [ ] **Critère : plus aucun aplat gris. La mer a un fond, et elle s'arrête où il faut.**
- [ ] ⚠️ **Vérifier aussi la couverture des HAUTEURS** : `reserverHauteurs` a une marge d'une
      tuile ; **sans elle la couverture plafonne à 0,552**. Le défaut est corrigé, **le
      vérifier non régressé** fait partie de la tâche.

### Tâche J bis — LA BATHYMÉTRIE DANS LA SURFACE DU CROP ⚠️ AVANT K

**Fichiers :** `src/globe.js` (`_buildMesh`/`posAt`, le nuanceur), `src/main.js`
(`contexteCrop`), `src/monde/*`, tests.
⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**

**Le défaut, établi par élimination par la Tâche J et non supposé :**

> Au-dessus de ~20 km la mer se lit en **taches bleues et vertes**. Mer cachée → le fond du
> crop est **un plateau vert uniforme**. Houle et clapot à zéro → **le marbrage disparaît
> entièrement**. Les creux de houle (**73 m mesurés**) passent **derrière** un fond marin
> rendu **à l'altitude ZÉRO**.
>
> ➡️ **LE CHAMP DE LA MER A UN FOND ; LA SURFACE DU CROP N'EN A PAS.** C'est ce désaccord
> qu'on voit.

**Trois sorties nommées par la Tâche J, aucune mesurée :**

1. **La bathymétrie dans les tuiles du crop** — la surface porte le relief sous-marin, donc
   les deux surfaces s'accordent. ⭐ **C'est la seule qui répare la CAUSE ; les deux autres
   masquent le symptôme.** ⚠️ Prix à établir : les tuiles terrarium portent-elles des valeurs
   négatives exploitables, ou faut-il fusionner `bathy.js` dans les hauteurs du quadtree ?
   **`bathy.js` opère en lat/lon, il est donc portable — c'est le point d'entrée qui manque.**
2. **La houle coupée** au-dessus d'une altitude — supprime le marbrage sans donner de fond.
   ⚠️ **Attention : la Tâche F a mesuré `ΔE = 0` à 6,4 km et `0,10` à 12,7 km entre la mer
   riche et la mer plate — la houle ne se lit PAS aux altitudes du bloc.** Donc la couper
   haut coûterait peu. **Mais ça ne répare rien.**
3. **`depthTest: false`** sur la nappe — ⛔ **le plus dangereux** : la mer passerait devant
   tout, y compris devant la terre qui devrait la cacher.

**Ce qu'on attend :** **choisir la sortie 1 si elle est atteignable, et le DIRE si elle ne
l'est pas.** Une tâche qui rend « la cause est hors de portée pour telle raison mesurée, voici
le palliatif et son prix » vaut mieux qu'une tâche qui maquille.

- [ ] **Étape 1 — la mesure.** Les tuiles portent-elles la bathymétrie ? À quelle profondeur,
      à quel zoom, avec quelle couverture ? **Chiffres avec source, données brutes sur disque.**
- [ ] **Étape 2** — test rouge.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — mutation sémantique, worktree à part.
- [ ] **Étape 5 — REGARDER L'ÉCRAN.** ⚠️ **Le témoin est la capture
      `.banc/vues-J/J-final-17-apres-commit.png` : les taches bleues et vertes doivent
      disparaître.** Captures dans `.banc/vues-Jbis/`.
- [ ] **Étape 6** — clôture, page chargée drapeau levé ET baissé.

⚠️ **Deux constats de la Tâche J à reprendre au passage, tous deux à deux pas de ton chemin :**
- **`uCoastMaskOn` du globe vaut 0 alors que `contexteCrop` porte un masque** — constaté, pas
  creusé. Si c'est un branchement manquant, c'est peut-être une part du plateau vert uniforme.
- **`uCropCoin`/`uCropCoinN` étaient déclarés dans `MER_FRAG` et lus par PERSONNE** depuis la
  Tâche F — **cinquième constante morte du chantier.** La Tâche J vient de les réveiller ;
  vérifie qu'ils servent vraiment.

#### Tâche K — LA CONTINUITÉ DE TEXTURE ⚠️ CE QUI FERME LES ARÊTES DROITES

**Fichiers :** `src/globe.js` (nuanceur de fragment), tests.

- [ ] **Étape 1 — la mesure AVANT.** Reprendre le protocole d'élimination de la Tâche G en
      **gelant `minFade` puis le terme `vUv` du grain tour à tour**, pour savoir **laquelle
      des deux sources domine**. ⚠️ **Cette mesure n'a jamais été faite : ne pas la sauter.**
- [ ] **Étape 2 — désindexer.** `minFade` : remplacer la mesure locale
      `fwidth(vUv) * uTilePx` par une grandeur **continue** (dérivée de `vLatLon` ou d'une
      distance-caméra), **indépendante du zoom de la tuile**. Le grain de papier : l'indexer
      sur une coordonnée continue, **exactement comme l'habillage le fait déjà avec `qCrop`**.
- [ ] **Étape 3 — mutation sémantique**, worktree à part.
- [ ] **Étape 4 — REGARDER L'ÉCRAN**, même cadrage qu'avant/après, **témoin exigé**.
- [ ] **Critère : une frontière de niveau ne doit plus se lire comme une arête droite.**
      ⚠️ **Ce que cette tâche NE ferme PAS, et qu'elle ne doit pas prétendre fermer :** la
      résolution réelle de la donnée diffère par niveau (fait de la source), et **le crop
      impose un zoom prescrit uniforme, donc un saut non borné à sa frontière.**

#### Tâche L — L'EXAGÉRATION BORNÉE (D6)

**Fichiers :** `src/monde/exageration-continue.js`, `src/main.js`, tests.

- [ ] **≈2 au zoom maximal, amplitude RÉDUITE sur toute la descente.** Aujourd'hui
      `globeExaggeration = 18` et la table Z7 ×3,2 · Z6 ×4 · Z5 ×5 · Z4 ×2,5.
      ⚠️ **Mesuré (Tâche C) : à ×18 la vue au nadir est INJUGEABLE** — le relief de La Réunion
      fait 0,86 unité de haut pour 0,21 de large, **la montagne passe au-dessus de la
      caméra**. **La consigne corrige un défaut réel.**
- [ ] ⚠️ **Vérifier l'effet sur le grain et le flou de profondeur**, qui « écrasent le relief
      du crop » : une partie du défaut vient probablement de l'exagération, pas du DOF.
- [ ] **Ne PAS toucher `demExaggeration` du mode plat.**

### ═══ ACTE II — LA CONTINUITÉ (D1, D2) ═══

#### Tâche M — LA MORT DES PALIERS (D1)

**Fichiers :** `src/modes.js`, `src/escalier-zoom.js`, `src/ui/zoom-stepper.js`,
`src/loi-altitude.js`, `src/main.js`. ⛔ **Derrière `?terre=unique` uniquement — le mode plat
garde ses paliers intacts.**

À supprimer *du chemin terre unique*, tous cités par l'inventaire §④ :
`DIVE_TIERS`/`pickDiveTier` (`modes.js:62-81`) · `escalier-zoom.js` entier · l'indicateur
`ORB`/`Z{n}` (`ui/zoom-stepper.js`, câblé `main.js:5131-5141`) · `_orbitNotch` (`modes.js:779`)
· ⚠️ **`poseCranContinu()` (`loi-altitude.js:181`) — C'EST LUI L'ACCROCHAGE DE CAMÉRA**, il
repose la caméra à `camY × facteurEchelle` à chaque cran · `niveauDePlongee()`
(`loi-altitude.js:247`, **à vérifier avant retrait**).

- [ ] **Critère mesurable : une descente de l'orbite au sol ne doit contenir AUCUNE
      reposition de caméra.** Le patron existe : la Tâche 1a a mesuré un profil de descente
      et compté les sauts (**onze au départ, zéro après**).

#### Tâche N — LE BLOC QUI GRANDIT EN CONTINU (D2)

**Fichiers :** `src/monde/seuil-socle.js` (loi continue), `src/monde/branchement-crop.js`,
`src/monde/estompage-terre.js` (ses bornes en dérivent), tests.

- [ ] **Remplacer `SEUIL_NAISSANCE_M` / `SEUIL_MORT_M` par une loi continue** : en descendant,
      la découpe se creuse et les parois montent progressivement.
      ⚠️ **`ALT_ESTOMPAGE_DEBUT_M`/`_FIN_M` en dérivent et doivent suivre. La LOI de fondu,
      elle, reste bonne.**
- [ ] ⚠️ **Le fov se lit EN DIRECT.**
- [ ] **Critère : aucune apparition, aucune disparition. Le bloc naît de la sphère.**

#### Tâche O — LE MORPHING GÉOMÉTRIQUE ⚠️ APRÈS K, JAMAIS AVANT

**Fichiers :** `src/globe.js`, tests.

- [ ] **Cible auto-dérivée par décimation de la tuile elle-même** (option (b) de l'étude) —
      **aucun changement au cycle de vie des hauteurs.** ⚠️ **Prix : un micro-pop résiduel
      NON MESURÉ. Le mesurer fait partie de la tâche.**
- [ ] `uMorph` **par matériau**, comme `uTex`/`uTilePx` le sont déjà (`globe.js:1532-1543`),
      et **une boucle par image qui n'existe pas encore**.
- [ ] ⚠️ **Les normales sont un attribut FIGÉ** : décider explicitement — accepter la dérive
      d'ombrage pendant la transition, ou payer +12 o/sommet. **Écrire la décision.**
- [ ] **Budget attendu : +23 % de géométrie par tuile (+8,45 Kio), ≈5,1 Mo de RAM en
      production, AUCUN appel de dessin ajouté.** ⚠️ **Bornes calculées, pas des mesures :
      les vérifier.**
- [ ] ⚠️ **Ne PAS prétendre que le morphing débloque l'exagération continue : il ne touche
      ni `dispScale` ni `posAt`. Les deux chantiers sont indépendants.**

### ═══ ACTE III — LE STUDIO (D3 : aucune option ne se perd) ═══

Chaque tâche finit par **une vérification option par option, à l'écran**, et la liste cochée
dans son rapport. **Une option qu'on n'a pas regardée n'est pas adaptée.**

#### Tâche P1 — LES NUAGES ⚠️ LA COQUILLE VIDE
15 tirettes **sans aucun effet** sous `?terre=unique` : `Clouds2` est gaté par
`socleAffiche()` qui rend **toujours faux** (`main.js:4566-4568`), et `GlobeClouds` n'a **aucun
paramètre**. **Faire un pont, ou porter les réglages sur le globe.**

#### Tâche P2 — L'OMBRAGE ET LA RAMPE : LES CURSEURS MORTS
`colorMode` Atlas + ses 7 sous-réglages (`terrain-analysis.js` → `uAnalysis`, **jamais
transmis par `contexteCrop`**), et **les quatre curseurs que `rampe-crop.js` ne lit pas** :
`mapTint`, `heightContrast`, `heightPivot`, `slopeTint`.

#### Tâche P3 — LA MATIÈRE DES PAROIS
**50 vignettes orphelines.** Les parois n'ont **aucun système de matière**. Et **l'interrupteur
« Afficher le socle » MENT.** ⚠️ **Reprendre ici le chanfrein et l'arrondi perdus par la
Tâche B** — leur garde-fou était calibré sur une exagération de 2,8, et **D6 y ramène**.

#### Tâche P4 — LES COUCHES DRAPÉES
Occupation du sol, canopée, lumières nocturnes (**aucune trace dans `monde/`**), eau,
photo aérienne + fondu à la côte, grille, cartouche au sol. **Les données passent déjà pour
le sol ; la loi de couleur n'existe pas.**

#### Tâche P5 — LES EFFETS
Scanner (**« Elevation slice » balaie un plan Y horizontal**), SSS (effet du *Plinth*),
effets de surface animés, matières du relief (25+25).

#### Tâche P6 — LE PARCOURS, ET LE DANGER DES DALLES
⛔ **`block-grid.js` n'est gardé par AUCUN `terreUniqueBranchee`** : **des dalles plates
peuvent apparaître à travers la sphère** si une trace GPX déborde. **Garde d'abord, adaptation
ensuite.** Puis le drapage GPX et le suivi caméra.

#### Tâche P7 — LES POINTS ET LA MISE AU POINT
Sommets (⚠️ `peaks.js` utilise **`dansFenetre`, le prédicat REJETÉ** par `crop-sphere.js` :
octogone ≠ superellipse), villes, points cotés, et **`autofocus.js` qui échantillonne un DEM
plat au lieu de raycaster**.

#### Tâche P8 — LES DEUX MACHINERIES DE DÉCOUPE
« Isoler la zone » et « Sommet découpé » sont un **second système entier**, plat.
**Trancher : second type de crop, ou fusion.** ⚠️ **Rien n'indique que ce soit décidé.**

#### Tâche Q — LES DERNIERS MENSONGES
Les paliers inertes (`resolution`, `demZoom`) · **les templates qui capturent des clés mortes
sans un mot à l'utilisateur** · `veilleCrop.poserMode()` **jamais appelé** ·
**une seule source de vérité pour le fov** (un second `FOV_DEG` dort dans
`exageration-continue.js`) · les **jupes qui pendent sous le bloc** · **les citations
`main.js:263` fausses**.

## §4 — Ordre imposé

**J** (la surface) → **J bis** (la bathymetrie dans la surface) → **K** (la texture) → **L** (l'exagération) → **M** (les paliers) →
**N** (le bloc continu) → **O** (le morphing) → **P1…P8** (le studio) → **Q** (le nettoyage).

⚠️ **K AVANT O** — l'étude le démontre : le morphing seul laisserait le symptôme visible intact.
⚠️ **J EN PREMIER** — consigne d'Adrien, et une belle rampe sur une surface vide ne vaut rien.
⚠️ **L AVANT P3** — le chanfrein perdu attend une exagération raisonnable.
⚠️ **P6 tôt si une régression visible est trouvée** — les dalles à travers la sphère sont un
défaut d'affichage, pas une option manquante.

## §5 — Auto-revue

⚠️ **Le risque principal est la Tâche K.** Si la désindexation ne ferme pas les arêtes
droites, le symptôme le plus visible reste, et le morphing (coûteux) ne le fermera pas non
plus — il faudrait alors la voie C (clipmap), **c'est-à-dire un changement d'architecture de
streaming qui rouvrirait tout ce que les tâches A–I ont posé.** C'est pour ça que **l'étape 1
de K est une MESURE, pas une implémentation.**

⚠️ **Le second risque est l'ampleur de l'Acte III.** Trente-quatre options dépendent du plat.
**Si le temps manque, on livre moins d'options mieux vérifiées — jamais l'inverse**, et on dit
lesquelles restent.

⚠️ **Le troisième risque est D5.** Interdiction de toucher au mode plat : certaines
adaptations voudront modifier un fichier partagé. **Dans ce cas, on élargit sans changer le
défaut** — le patron existe (`distanceRivage` de la Tâche F, dont « le défaut par défaut
reproduit le dépôt au bit près »).

**Aucun chiffre de ce plan n'est inventé.** Ils viennent des deux études ou des bilans
mesurés, et portent leur source.
