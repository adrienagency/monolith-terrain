# RAPPORT PB — CE QUE FONT LES AUTRES, ET CE QUI EST APPLICABLE CHEZ NOUS

Étude externe, lecture seule dans `C:\Dev\wt-merge` (`git diff` vide, aucune ligne
de `src/` touchée). Écrite après lecture de `rapport-PF1.md`, `rapport-PF2.md`,
`rapport-R37.md`, `lecons-campagne-R.md` et de la compétence
`/threejs-optimisation`.

⚠️ **Trois niveaux de preuve** sont distingués partout ci-dessous :
**[É]** documenté ou mesuré par l'éditeur · **[T]** mesuré par un tiers
identifiable · **[F]** folklore de forum, non reproduit. ⛔ Aucun chiffre n'est
inventé ; là où aucune mesure publique n'existe, il est écrit « pas de chiffre
public ».

⚠️ **L'état du code a AVANCÉ depuis PF1.** Plusieurs leviers que PF1 listait comme
« ce que Cesium fait et pas nous » ont été posés depuis par PF4 et PF2 :
le **matériau partagé** (`src/monde/materiau-tuile.js`), les **matrices figées**
(`matrixAutoUpdate = false`, `globe.js:3913`, `6727`, `7577`, `8935`,
`main.js:4876`), la **cadence de repos** (`src/cadence-repos.js`), le **décodage
en Worker** (`src/monde/decodeur-terrarium.js`), le **tri unique par pompe**
(`globe.js:8650`, hors du `while`). Les lignes du tableau ② en tiennent compte :
plusieurs techniques célèbres sont marquées **DÉJÀ FAITE**, et c'est une réponse
utile.

---

## ① L'ÉTUDE DES MÉCANISMES, PAR SYSTÈME

### 1.1 CesiumJS — le plus proche de nous, et le mieux documenté

**a) Le rendu explicite (`requestRenderMode`)** — [É] *Improving Performance with
Explicit Rendering*, blog Cesium, **2018-01-24**
(https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/), et la
doc `Scene` (https://cesium.com/learn/ion-sdk/ref-doc/Scene.html).
Depuis Cesium 1.42, `scene.requestRenderMode = true` : la scène ne dessine plus à
la cadence cible, mais **seulement** quand (i) la caméra change, (ii) le temps de
simulation avance de plus de `maximumRenderTimeChange` (0 s par défaut, à poser à
`Infinity` si rien n'est animé par le temps), (iii) terrain / imagerie / 3D Tiles
/ sources de données **finissent de charger**, (iv) une couche est ajoutée ou
retirée, (v) `scene.requestRender()` est appelé à la main.
**Chiffre éditeur** : sur un portable Intel i7 sous Chrome, CPU au repos
**25,1 % → 3,0 %**, et les images au repos tombent à **0**.
**Le piège documenté** : tout changement fait par les API Entity/Primitive
n'appelle **pas** `requestRender` tout seul ; `preRender`/`postRender` cessent de
se déclencher à cadence fixe. Un bug ouvert le confirme côté entités
(https://github.com/CesiumGS/cesium/issues/12543).

**b) La refonte terrain/imagerie (PR #7061, kring)** — [É]
https://github.com/CesiumGS/cesium/pull/7061. C'est la source la plus riche pour
nous, et elle dit quatre choses nommées :
- la priorisation par **distance** a été remplacée par des **files basse /
  moyenne / haute priorité**, qui **favorisent légèrement les tuiles proches du
  centre de l'écran** ;
- le `RequestScheduler` **ne réordonne ni n'annule plus rien pour le terrain et
  l'imagerie** — c'était coûteux (une fonction de priorité créée par tuile) et le
  résultat était moins bon que les files ;
- les **« fill tiles »** : quand la tuile fine n'est pas là, une géométrie
  **temporaire suréchantillonnée depuis l'ancêtre** est fabriquée pour couvrir le
  trou tout de suite, ce qui supprime le remplissage « de l'arrière vers
  l'avant » ;
- **chiffres éditeur** : la branche charge les scènes de test **×1,4 à ×2,3 plus
  vite** et consomme **≈ 33 % de données en moins** ; Grand Canyon horizon
  4 818 ms → 3 391 ms, Everest 5 034 ms → 3 850 ms.

**c) `RequestScheduler`** — [É]
https://cesium.com/learn/cesiumjs/ref-doc/RequestScheduler.html : borne le nombre
de requêtes actives pour que les **nouvelles** ne fassent pas la queue derrière
des périmées ; la priorité est **sans unité, la plus BASSE est la plus haute**, et
vaut d'ordinaire la distance à la caméra. Motivation écrite : un changement de
caméra rend « beaucoup de requêtes en vol redondantes ».

**d) L'erreur d'espace-écran et ses variantes** — [É] doc `Cesium3DTileset`
(https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html) :
- `maximumScreenSpaceError` : le seuil de raffinement, « rôle majeur dans
  l'équilibre performance / qualité » ;
- `dynamicScreenSpaceError` + `…Density` + `…Factor` : **relâche la SSE au loin,
  comme du brouillard** — moins de tuiles demandées à l'horizon. Activé **par
  défaut** depuis la PR https://github.com/CesiumGS/cesium/pull/11718 ;
- `skipLevelOfDetail` + `baseScreenSpaceError` (1024) +
  `skipScreenSpaceErrorFactor` (16) + `skipLevels` (1) + `loadSiblings` (false) :
  **sauter des niveaux intermédiaires** au lieu de descendre l'arbre marche par
  marche. [T] La communauté rapporte un chargement « bien plus rapide », **et un
  effet de bord** : en dézoomant, des tuiles disparaissent
  (https://community.cesium.com/t/skiplevelofdetail/14665,
  https://github.com/CesiumGS/cesium/issues/5814). Pas de chiffre public chiffré
  côté éditeur pour skipLOD ;
- `preloadSiblings` / `preloadAncestors` : préchargement pour réduire le pop-in.

**e) Le brouillard qui CULLE** — [É] *Graphics Tech in Cesium — Fog*, blog Cesium,
**2015-11-12** (https://cesium.com/blog/2015/11/12/fog/) et doc `Fog`
(https://cesium.com/learn/cesiumjs/ref-doc/Fog.html) : **le terrain entièrement
dans le brouillard est éliminé**, et le terrain partiellement dans le brouillard
est rendu à plus basse résolution (`screenSpaceErrorFactor`). Augmenter la densité
« élimine agressivement le terrain » et améliore les performances. Pas de chiffre
public.

**f) Ce que Cesium a ESSAYÉ PUIS ABANDONNÉ** — la règle sans-trou en profondeur,
signalée par `/threejs-optimisation` §1 : elle oblige à charger quatre tuiles là
où une suffit. C'est exactement ce que R37 a corrigé chez nous par le
raffinement partiel.

### 1.2 Google Earth (web)

[É] *How we're bringing Google Earth to the web*, web.dev, **mis à jour
2019-06-20** (https://web.dev/earth-webassembly/) et *Performance of WebAssembly:
a thread on threading*, blog Google Earth
(https://medium.com/google-earth/performance-of-web-assembly-a-thread-on-threading-54f62fd50cf7).
Ce qui est **documenté** :
- le moteur C++ existant tourne en **WebAssembly** ; Earth « fonctionne comme un
  énorme jeu vidéo du monde réel », **streamant, décompressant et préparant** la
  donnée en continu ;
- **le levier nommé est le multi-fil** : faire la récupération et la
  décompression **sur un fil d'arrière-plan** « améliore clairement la
  performance » et « la boucle de rendu principale s'exécute beaucoup plus vite,
  d'où une cadence moyenne supérieure » ; il repose sur `SharedArrayBuffer` ;
- **⛔ aucun chiffre de cadence n'est publié** dans ces deux articles. La phrase
  « Google Earth tient 60 i/s sur un portable à GPU intégré » qui circule dans
  nos rapports est une **observation d'Adrien**, pas une mesure d'éditeur : elle
  ne doit pas être citée comme telle.
- Le détail du LOD terrain de Google Earth (structure d'arbre, seuils, cache)
  **n'est pas public**. Pas de chiffre public.

### 1.3 MapLibre / Mapbox GL (terrain)

[T] Doc MapLibre 3D Terrain
(https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/) et analyse tierce
DeepWiki (https://deepwiki.com/maplibre/maplibre-gl-js/5.2-performance-optimization-techniques) :
le relief vient de tuiles **Terrain-RGB**, chaque tuile de carte est triangulée et
déplacée par la hauteur décodée × exagération, puis le style 2D est **drapé**
dessus. Le rendu itère les couches **dans l'ordre du style**, **lie le programme
GPU une fois par couche** et émet ses dessins ; les entités sont pré-empaquetées
en **buckets** (VBO/IBO calculés à l'avance côté Worker). `gl-stats.ts` compte les
opérations coûteuses **par image et par tuile**.
➡️ Le mécanisme transposable est **« un programme par couche, pas par objet »** —
c'est ce que PF4 a déjà fait avec le matériau partagé.

### 1.4 Les jeux et les mondes ouverts

- **Résolution dynamique.** [É] Unreal
  (https://dev.epicgames.com/documentation/unreal-engine/dynamic-resolution-in-unreal-engine) :
  le pourcentage d'écran est ajusté **d'après la charge GPU des images
  précédentes** ; un « interrupteur de panique » chute la résolution après N
  images consécutives hors budget. [É] Unity
  (https://docs.unity3d.com/6000.1/Documentation/Manual/DynamicResolution-landing.html,
  https://github.com/Unity-Technologies/DynamicResolutionSample) : les cibles de
  rendu sont allouées en pleine résolution puis **aliasées** en version réduite
  (pas de réallocation) ; **la descente est instantanée, la remontée attend
  plusieurs images de marge**. Unity ne fournit **pas** la logique de décision :
  chaque jeu écrit la sienne.
- **Occlusion culling GPU (Hi-Z, deux passes).** [T] *Experiments in GPU-based
  occlusion culling*, Interplay of Light, **2017-11-15**
  (https://interplayoflight.wordpress.com/2017/11/15/experiments-in-gpu-based-occlusion-culling/),
  et deux exposés tiers
  (https://medium.com/@mil_kru/two-pass-occlusion-culling-4100edcad501). Le
  principe : une pyramide de profondeur (chaîne de MIP min/max du Z-buffer), une
  passe de pré-profondeur avec les objets **visibles à l'image d'avant**, puis un
  calcul qui teste tous les objets contre la pyramide et remplit un dessin
  indirect.
- **Rendu piloté GPU.** [T] *Aokana: A GPU-Driven Voxel Rendering Framework for
  Open World Games*, arXiv **2505.02017** (2025,
  https://arxiv.org/html/2505.02017) : Hi-Z + visibility buffer, **×2 à ×4** sur
  les scènes haute résolution. Contexte : voxels, dessin indirect, compute — pas
  WebGL2.
- **Amortir le travail sur plusieurs images.** [É] `scheduler.yield()`, Chrome
  129 (**septembre 2024**,
  https://developer.chrome.com/blog/use-scheduler-yield) : rendre la main puis
  **reprendre là où on s'était arrêté**, sans repartir en fin de file. [É]
  web.dev *Optimize long tasks* (https://web.dev/articles/optimize-long-tasks) :
  **50 ms** est la frontière de la tâche longue. [T] React planifie par unités de
  **~33 ms** (30 i/s) et remonte si la marge le permet ;
  **[F] `isInputPending()` n'est plus recommandé** (faux négatifs, ignore
  l'animation) — folklore à ne pas reprendre.

### 1.5 Le web spécifiquement (three.js)

- **Matrices.** [T] Issue three.js **#25115** : dans une scène réelle de
  **18 000 nœuds, 41,6 % du CPU** passait dans `updateMatrixWorld()`
  (https://github.com/mrdoob/three.js/issues/25115). [T] Issue **#14360** : les
  objets `visible = false` voient quand même leur matrice mise à jour
  (https://github.com/mrdoob/three.js/issues/14360). **[F]** « +50 % de perf en
  sautant les invisibles » vient d'un message de forum, non reproduit
  (https://discourse.threejs.org/t/updatematrixworld-performance/3217).
  **Chez nous : déjà traité** (voir ②).
- **Fusion des dessins.** [É] `BatchedMesh`
  (https://threejs.org/docs/pages/BatchedMesh.html) : un grand nombre d'objets
  **de même matériau**, **géométries et transformations différentes**, en un seul
  dessin ; utilise l'extension `WEBGL_multi_draw` quand elle existe, les matrices
  vivant **dans une texture** lue par le nuanceur. ⚠️ [T] Bug connu : avec
  `_multiDraw`, `renderer.info.render` **compte faux**
  (https://github.com/mrdoob/three.js/issues/29531) — notre instrumentation en
  dépendrait.
- **WebGPU.** [T] Issue **#31055** « la performance du WebGPURenderer est bien
  inférieure à WebGL » (https://github.com/mrdoob/three.js/issues/31055) ; [F] un
  billet tiers non vérifié rapporte 20 000 cubes non instanciés à 15 i/s en
  WebGPU contre 60 en WebGL, à cause du coût de liaison des UBO par objet, et des
  correctifs en r184
  (https://altersquare.io/blog/three-js-vs-webgpu-2026-large-scale-construction-viewers).
  ⚠️ **Cette dernière source est un blog de prestataire, sans banc reproductible :
  à traiter comme folklore.**
- **Textures compressées.** [T] Don McCurdy, *Choosing texture formats for WebGL
  and WebGPU*, **2024-02-11**
  (https://www.donmccurdy.com/2024/02/11/web-texture-formats/) et [É] Khronos,
  *KTX 2.0 Launch Overview*, avril 2021 : KTX2/Basis **reste compressé jusque
  dans la VRAM** (transcodage vers BC/ASTC/ETC2), **÷4 à ÷8 sur la mémoire de
  texture**, décodage sur le GPU. ⚠️ **Lossy** — inapplicable à des hauteurs.

---

## ② LE TABLEAU D'APPLICABILITÉ — chaque ligne ancrée dans NOTRE code

| technique | ce que ça résout | applicable ici ? | pourquoi — ancré dans notre code | gain attendu | coût / risque |
|---|---|---|---|---|---|
| **Rendu à la demande complet** (`requestRenderMode`, Cesium) | tout le tick au repos | **PARTIELLEMENT — déjà fait en orbite** | `src/cadence-repos.js` (`dessinerCetteImage`) saute déjà 1 image sur 2 en orbite au repos, sur 30 si les animations sont coupées. Le fichier écrit lui-même pourquoi il s'arrête là : « en surface la mer, les nuages et la faune changent VRAIMENT à chaque image ». Reste **le crop et la surface au repos** : PF1 ③ a montré trois images consécutives **identiques au bit** quand `dtAmb = 0`, pour 13–24 ms de CPU chacune sur ×4/×6 | 13–24 ms/image → 0 dans les seules images où rien ne bouge | il faut une **liste exhaustive des sources de changement** (arrivée de tuile, `_partiels` de R37, houle, nuages, DOF, HUD) ; un oubli = écran figé. Cesium documente ce piège [É] |
| **Le contexte du crop recalculé pour une signature** | 14,1 % des échantillons V8 au crop (PF1 ⑤-2) | **OUI — et TOUJOURS OUVERT** | `src/monde/branchement-crop.js:1001` appelle `contexte()` = `contexteCrop()` (`src/main.js:6204`) **à chaque image**, pour ne fabriquer que `` `${ctx.centre.lat}|${ctx.centre.lon}|${ctx.zoom}|${ctx.tuilesParBloc}` `` (ligne 1003). Vérifié dans l'arbre aujourd'hui : rien ne mémoïse | le premier poste du `reste` (26–28 % de l'image au crop) | faible : une signature calculée sans monter tout l'habillage, ou un cache sur `(centre, zoom)`. Risque = fraîcheur, dont `main.js:14847` porte déjà l'avertissement |
| **Un matériau partagé, peu d'uniformes par tuile** (Cesium/MapLibre : un programme par couche) | `rendu.objets` 23–41 % | **DÉJÀ FAITE (PF4)** | `src/monde/materiau-tuile.js` : un seul `ShaderMaterial`, six valeurs par tuile posées dans `avantDessinTuile` (`onBeforeRender`). Mesure inscrite dans l'en-tête du fichier : `composer.render` p50 **8,6–9,7 → 4,6 ms** | déjà encaissé | — |
| **Matrices figées** (`matrixAutoUpdate = false`) | `updateMatrixWorld` 5–9 % | **DÉJÀ FAITE (PF4)** | `globe.js:3913`, `6727`, `7577`, `8935`, `main.js:4876` (`sceneGlobe.matrixAutoUpdate = false`) | déjà encaissé | — |
| **Fusion des dessins des tuiles** (`BatchedMesh` / `WEBGL_multi_draw`) | les 64–103 appels de dessin restants | **NON — inapplicable en l'état** | `BatchedMesh` suppose **un matériau et des géométries interchangeables**. Nos tuiles portent chacune leur **texture** (`uTex` posé par tuile) et R37 vient de leur donner **cinq groupes de dessin et un tableau `[partagé, invisible]`** (`globe.js` `_dessinerPartiel`, `_decouperEnQuadrants`). Il faudrait un **atlas de textures** d'abord — et l'instrumentation casserait (three.js #29531) | −20 à −80 appels, gain non chiffrable ici | très élevé : atlas + réécriture du raffinement partiel de R37 |
| **Files basse/moyenne/haute + centre de l'écran d'abord** (PR #7061) | l'ordre d'arrivée | **DÉJÀ FAITE (PF2), et mieux** | `globe.js:8650` `_priorite` = distance écran du **bord** de la tuile au centre, reclassée à chaque image ; un seul `sort` **hors** du `while`. Cesium se contente de « favoriser légèrement le centre » | déjà encaissé (PF2 : hors-tronc 18,5 → 5,5 %, 21,7 → 16,3 Mio) | — |
| **Ne plus réordonner/annuler côté ordonnanceur** (ce que Cesium a RETIRÉ) | le coût du tri | **déjà aligné** | notre pompe fait un tri par image, pas par tuile — le reproche exact de la PR #7061 | — | — |
| **Annulation des requêtes hors champ** (`AbortController`) | 24 % du temps de créneau en vol hors champ (PF2 §5) | **OUI, mais PAS par `AbortController` direct** | `globe.js:8429–8432` écrit pourquoi le `signal` est refusé : la promesse de `fetchTile` est **partagée par URL** avec le damier via `_tileMemo`. La porte est `src/monde/memo-tuiles-mnt.js` : un compteur de demandeurs par URL, abandon quand le dernier part. ⚠️ Cesium a **retiré** l'annulation pour le terrain (PR #7061) — leur remède fut la file, que nous avons déjà | ≤ 6 créneaux libérés plus tôt ; **rien sur le tick** | moyen ; et le précédent Cesium suggère un gain plus faible qu'espéré |
| **« Fill tiles » : couvrir avec l'ancêtre suréchantillonné** (PR #7061) | le pop-in / le flou de transition | **ÉQUIVALENT DÉJÀ FAIT (R37)** | `_dessinerPartiel` dessine les enfants prêts et laisse le parent sous les manquants ; `redemanderSurPlace` empêche une tuile nette de repasser en chargement. R37 : flou moyen 13 % → 3,9 %, recul 100 % → 0 % | déjà encaissé | — |
| **Brouillard qui CULLE le terrain lointain** (Cesium Fog) | l'emprise, donc l'occupation du cache | **OUI — la brique existe, le culling non** | nous avons déjà l'estompage (`src/monde/estompage-terre.js`, `globe.js:4832` `estompePlein()`), mais il **efface à l'écran** ; Cesium **supprime du parcours** ce qui est plein brouillard et **relâche la SSE** dans le brouillard partiel. Le point d'entrée est `_traverse` (le même endroit que le tronc et l'horizon de PF2) | moins de tuiles demandées et **moins de places de cache occupées** — le levier que la leçon d'ordre désigne | modéré ; à borner par un test (le repos du crop `_cropSeul` ne doit pas régresser) |
| **SSE dynamique (relâchée au loin)** | idem, en continu | **OUI, petite** | notre critère est `chord / dist > SPLIT_RATIO` (`globe.js`, `_traverse`), aveugle au fov et au viewport (PF1 ④). Un facteur croissant avec la distance est **une ligne** | 0 ms direct, mais moins d'entrées dans le cache | faible ; ⚠️ PF1 a montré qu'une **vraie** SSE chargerait PLUS sur Retina |
| **`skipLevelOfDetail`** (sauter les niveaux) | le temps jusqu'au net | **NON** | notre descente est une **rafale de molette continue** ; R37 a montré que le mal était le **recul**, pas le nombre de marches. Et l'effet de bord documenté (tuiles qui disparaissent au dézoom, Cesium #5814) frapperait `veille-repos` ⑦, où le dézoom doit rester gratuit | — | régression visuelle probable |
| **`preloadSiblings` / prélecture** | le pop-in | **DÉJÀ FAITE, ET BORNÉE (R37 ④)** | `_prelire` : descente seule, **centre seul**, crédit ≥ 400. R37 a mesuré ce que coûte la version non bornée : **+28 % de requêtes**, et **×1,85** sur un cache saturé | déjà encaissé | ⛔ ne pas élargir |
| **Décodage hors du fil principal** (Google Earth : fond de tâche ; Worker) | 3–5 ms/image en mouvement | **DÉJÀ FAITE (PF2 ⑦)** | `src/monde/decodeur-terrarium.js`, un Worker par globe, OffscreenCanvas, 0 repli sur 559 tuiles | déjà encaissé | — |
| **Maillage étalé sous budget par image (« time slicing »)** | 121 tuiles bâties dans **une** image, 315 ms (PF2 §4.8) | **OUI — la mesure existe, le code a été retiré** | `_buildMesh` est appelé depuis le `.then` de `_pump` (`globe.js:8653+`). PF2 avait écrit `processTerrainQueue` (budget 4 ms, centre d'abord) et l'a **retiré** : **25 tests dans six fichiers** supposent qu'une tuile est prête dès sa réponse | supprime les pointes ; **ne change pas la cadence moyenne** | ⚠️ le vrai coût est **25 contrats de test à réécrire**, pas le code |
| **`scheduler.yield()` / découpe des tâches longues** | tâches longues Σ 7–9 s par descente (PF2) | **NON pour la boucle de rendu** | PF2 §3 a tranché : ces tâches longues « ne sont pas le globe, ce sont les rechargements du bloc » (`poserTout` via `branchement-crop.js`). Le bon terrain serait **là**, pas dans `globe.js` — et le rendu 3D vit dans `rAF`, où `yield` n'a pas de sens | — | — |
| **Résolution dynamique par budget GPU** (Unreal/Unity) | une image bornée par le **GPU** | **NON en l'état — et c'est mesuré** | PF1 : sur RTX D3D11 le GPU vaut **0,21 à 2,71 ms**, soit 1 à 6 % de l'image, à tous les postes. Baisser la résolution ne rend rien quand le CPU borne. Nous avons déjà `src/perf.js` (`AdaptiveQuality`, 4 paliers, `pixelRatio` 1,5 / 1,0 / 0,85) et `src/viewport.js:301` (`setPixelRatio`) | **≈ 0** sur machine D3D11 ; **beaucoup** sur GPU logiciel (PF1 : 315–440 ms de fragments) et probablement sur GPU intégré | ⚠️ à ne brancher **que** sur une mesure GPU réelle, jamais sur la cadence — `perf.js` documente déjà comment un gouverneur peut être sourd des mois |
| **Occlusion culling Hi-Z / rendu piloté GPU** | le sur-dessin | **INAPPLICABLE** | technique de compute + dessin indirect ; WebGL2 n'a ni l'un ni l'autre. Et notre scène n'a **pas** de problème d'occlusion : un globe est convexe, l'horizon (déjà traité, PF2) fait le travail | — | — |
| **Imposteurs / billboards** | des milliers d'objets distants | **INAPPLICABLE** | nous n'avons pas de foule d'objets : `boats.js` et `clouds2.js` sont **déjà** en `InstancedMesh` (un dessin), et PF1 les mesure chacun < 1 ms | — | — |
| **WebGPU** | le coût CPU par objet | **NON — pas maintenant** | migrer `globe.js` (nuanceurs GLSL faits main, `ShaderMaterial`, `onBeforeRender`, `EffectComposer`) ; et la seule source qui promet un gain sur les dessins nombreux est [F] | inconnu | énorme, et une régression documentée est signalée par three.js #31055 [T] |
| **Textures compressées KTX2/Basis** | la VRAM | **NON pour les hauteurs, OUI pour la photo** | les hauteurs viennent de `CanvasTexture` RGBA8 terrarium — **lossy interdit** (le décodeur les relit). En revanche `uPhoto` (`materiau-tuile.js`, `habillerPhotoTuile`) est de l'orthophoto : elle, se compresse | ÷4 à ÷8 sur la mémoire de **cette** texture [T] | ⚠️ **0 ms sur le tick** : notre goulot n'est pas la VRAM |
| **Hauteurs en R16F au lieu de RGBA8** | la moitié de la VRAM des tuiles | **PEUT-ÊTRE** | une tuile ≈ 0,75 Mo (PF1), `CACHE_MAX_CONTINU = 1700` (`globe.js:866`) ⇒ jusqu'à ~1,3 Go | ÷2 de VRAM | 0 ms sur le tick ; à ne faire que si la VRAM devient le symptôme |
| **Router les descendants d'un 404** | 679 requêtes 404 sur 1 704 (40 %, PF2 §5) | **OUI** | Mapterhorn en mer ; chaque 404 est suivi d'un aller-retour AWS. Terrain : `src/dem-source.js` / `src/monde/flux-terrain.js` | −40 % d'allers-retours réseau sur une descente océanique | faible ; à border par un test de source |
| **L'emprise de mer du flux (`aussi`, priorité 9e8)** | les 5 % de demandes hors tronc qui restent | **OUI** | PF2 §4.7 : après ①, **toutes** les demandes hors tronc restantes viennent du flux du socle (`demanderEmprise`, `src/monde/flux-terrain.js`), à **dNdc 6** — le coin de l'écran, au-delà du bord | des places de cache rendues | faible, mais touche le socle (hors périmètre PF2 à l'époque) |

---

## ③ LE CLASSEMENT — huit pistes, gain ÷ risque, **dans l'ordre d'application**

⚡ **L'ordre est le sujet, pas le gain.** La leçon payée ici — *les objets hors
champ ne coûtent pas des appels de dessin, ils consomment les places du cache, et
c'est cela qui affame le budget* — a une conséquence directe sur ce classement :
**tout ce qui réduit L'EMPRISE passe avant tout ce qui desserre un BUDGET, une
FILE ou un CACHE.** Appliquer un correctif de budget d'abord a donné **×14 sur
les requêtes** et un détail **pire qu'avant**. Le même piège s'est reproduit à
l'échelle de R37 (`+28 %` de requêtes sans le garde-fou du centre, `×1,85` sur un
cache saturé) : ce n'est pas une anecdote ancienne, c'est un mode de défaillance
récurrent de ce code.

**Étage A — réduire ce qui ENTRE (l'emprise). À faire en premier, toujours.**

1. **Le brouillard qui culle** — Cesium Fog [É] porté dans `_traverse` :
   ce qui est plein estompage n'est plus parcouru ; ce qui est estompage partiel
   voit sa SSE relâchée. *Gain* : moins de tuiles créées, donc moins de places de
   cache, donc moins de traversée, moins de matrices, moins de réseau — le seul
   levier qui attaque plusieurs postes à la fois. *Risque* : moyen, borné par
   `veille-repos` ⑦ et `test/globe-priorite`. **Rapport gain/risque : le
   meilleur du lot, et il doit être PREMIER.**
2. **L'emprise de mer du flux (`aussi`, 9e8, dNdc 6)** — `flux-terrain.js`.
   Même étage, même raison : c'est la dernière source connue de demandes hors du
   tronc, et PF2 l'a déjà nommée et localisée. *Risque* : faible.
3. **Le routage des 404 Mapterhorn** — 40 % des requêtes d'une descente
   océanique. Ne réduit pas l'emprise mais réduit le **trafic** sans rien changer
   à ce qui est dessiné. *Risque* : faible.

**Étage B — supprimer du travail par image (sans toucher aux budgets).**

4. **`contexteCrop` mémoïsé** (`branchement-crop.js:1001` / `main.js:6204`).
   Le premier poste du `reste` au crop (**14,1 % des échantillons V8**), toujours
   ouvert dans l'arbre, correctif local, aucun effet sur ce qui entre dans le
   cache. *C'est le meilleur gain ÷ risque de tout le rapport en valeur
   absolue* — il n'est pas premier **uniquement** parce qu'il ne réduit pas
   l'emprise et que l'étage A doit être mesuré sur une base non déplacée.
5. **Le rendu à la demande, étendu au-delà de l'orbite** — `cadence-repos.js`
   couvre déjà l'orbite ; PF1 ③ montre 13–24 ms/image gaspillées au repos partout
   ailleurs. Cesium chiffre l'équivalent à **25,1 % → 3,0 % de CPU au repos**
   [É]. *Risque* : le plus élevé de l'étage — il faut énumérer **toutes** les
   sources de changement, y compris `_partiels` de R37 et l'arrivée d'une tuile
   (Cesium liste explicitement « le chargement du terrain » parmi ses
   déclencheurs). À faire **après** 1–4, sinon l'énumération devra être refaite.

**Étage C — les pointes, pas la moyenne.**

6. **Le maillage étalé sous budget** (PF2 ⑧). Mesuré : **121 tuiles / 315 ms dans
   une image**. ⚠️ Le coût réel est **25 tests à réécrire**, pas le code — et
   c'est un travail de contrat, pas de perf. Ne change **pas** la cadence
   moyenne. À instruire seulement si les p99 redeviennent le symptôme d'Adrien.
7. **L'abandon partagé** (`memo-tuiles-mnt.js`, compteur de demandeurs). 24 % du
   temps de créneau récupéré [notre mesure PF2], **0 ms sur le tick**.
   ⚠️ Cesium a **retiré** l'annulation pour le terrain et l'a remplacée par la
   file — que nous avons déjà : la prudence commande de le placer bas.

**Étage D — la machine faible, et elle seule.**

8. **La résolution dynamique pilotée par une mesure GPU réelle**
   (`EXT_disjoint_timer_query_webgl2` → `perf.js` / `viewport.js`).
   Sur D3D11 : **≈ 0** (le GPU tient dans 1–6 % de l'image). Sur GPU logiciel :
   **315–440 ms de fragments par image**, dont 85–89 % dans `PasseFond`.
   ⛔ **À ne brancher que sur une mesure GPU**, jamais sur la cadence — `perf.js`
   documente déjà en tête comment un gouverneur nourri de la mauvaise grandeur
   est resté sourd des mois. Et sur GPU faible, la vraie cible n'est pas la
   résolution : c'est **le nuanceur de tuile et celui du crop**.

---

## ④ CE QUI EST SÉDUISANT ET QU'IL NE FAUT PAS FAIRE ICI

1. **WebGPU.** La promesse (« 2–10× sur les scènes riches en appels de dessin »)
   vient d'un blog de prestataire [F], sans banc. La seule source de premier
   ordre est un ticket three.js disant l'inverse [T, #31055]. Et notre profil dit
   que le GPU **n'est pas** le goulot. Migrer `globe.js` — GLSL à la main,
   `onBeforeRender`, `EffectComposer` — pour un gain non démontré sur une grandeur
   qui n'est pas le goulot : non.
2. **`BatchedMesh` / `multi_draw` pour les tuiles.** Séduisant (« 90 dessins →
   1 »). Mais nos tuiles ont **une texture chacune**, et R37 vient de leur donner
   cinq groupes de dessin par tuile partielle : ce serait défaire le correctif qui
   a divisé le flou par 3,3. Sans atlas de textures d'abord, c'est impossible ;
   avec atlas, c'est un autre chantier. Et `renderer.info` compterait faux
   (#29531) — nous perdrions l'instrument qui mesure le reste.
3. **`skipLevelOfDetail`.** Charge « bien plus vite » [T], mais fait
   **disparaître des tuiles au dézoom** [T, Cesium #5814] — exactement le
   symptôme qu'Adrien a signalé et que R37 vient d'éteindre. On ne réintroduit
   pas un recul après l'avoir payé.
4. **Le culling par occlusion Hi-Z.** Techniquement magnifique, ×2–4 sur voxels
   [T]. Sans compute ni dessin indirect en WebGL2, et sur une scène **convexe**
   déjà coupée par l'horizon : rien à gagner.
5. **La résolution dynamique posée sur la cadence.** C'est le piège que `perf.js`
   raconte en toutes lettres : un gouverneur nourri d'un delta déjà borné ne
   pouvait pas voir 3 i/s. Une résolution dynamique branchée sur la cadence
   baisserait la qualité pour un goulot **CPU** qu'elle ne touche pas — perte
   visuelle sèche.
6. **KTX2 sur les hauteurs.** Compression **lossy** sur une donnée numérique :
   c'est le piège n° 6 de `/threejs-optimisation` (« un décodeur d'image
   *corrige* la donnée »), déjà payé ici sur le bit à 256 m.
7. **`isInputPending()`.** Encore recommandé sur beaucoup de pages ; **Google ne
   le recommande plus** (faux négatifs, aveugle à l'animation) [É, web.dev].
8. **Élargir la prélecture.** R37 ④ l'a mesurée : sans le garde-fou du centre,
   **+28 % de requêtes** ; sans celui du crédit, **×1,85** sur un cache saturé.
   Elle n'est bonne que bornée.
9. **Citer « Google Earth tient 60 i/s »** comme un chiffre d'éditeur. **Il n'en
   existe aucun** dans les publications de Google Earth : ce sont des articles
   d'architecture (Wasm, fils d'arrière-plan), sans mesure de cadence. C'est une
   observation d'Adrien — précieuse comme cible, inutilisable comme référence.

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

- **« PF1 décrit l'état d'aujourd'hui. »** Non : le matériau partagé, les
  matrices figées, le tri unique et le décodage en Worker **ont été posés
  depuis**. Quatre lignes de son tableau ④ sont devenues « déjà fait ». Vérifié
  fichier par fichier (`materiau-tuile.js`, `globe.js:3913/6727/7577/8935`,
  `globe.js:8650`, `decodeur-terrarium.js`).
- **« Le rendu à la demande n'existe pas chez nous. »** Faux : `cadence-repos.js`
  le fait déjà en orbite, avec un raisonnement écrit sur pourquoi il ne le fait
  pas ailleurs.
- **« Cesium annule ses requêtes hors champ, faisons pareil. »** La PR #7061 dit
  le contraire : ils ont **retiré** le réordonnancement et l'annulation pour le
  terrain, et les ont remplacés par des files de priorité — ce que PF2 a déjà
  écrit chez nous. La ligne « annulation » descend en conséquence dans le
  classement.
- **« `contexteCrop` a dû être corrigé depuis PF1. »** Non : `branchement-crop.js`
  ligne 1001 l'appelle toujours à chaque image pour une signature de quatre
  champs.
- **« Le brouillard de Cesium est un effet visuel. »** Il **élimine** le terrain
  plein brouillard et **relâche la SSE** dans le brouillard partiel : c'est un
  mécanisme d'emprise, pas de rendu. C'est ce qui le place en tête du classement.

---

**Rapport écrit sans toucher à `src/` ; `git diff` vide au moment de l'écriture.**
