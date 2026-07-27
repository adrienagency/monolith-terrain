# Bloc central — rapport de mesure et plan d'optimisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diviser par deux le temps de gel et l'empreinte mémoire du bloc central sans que sa silhouette ni sa peinture ne bougent d'un pixel.

**Architecture:** Trois gisements, dans cet ordre : (1) le travail *refait à l'identique* à chaque reconstruction — grille plate, bruit FBM, rugosité ; (2) les *formats* de texture — trois masques d'un seul bit stockés en RGBA ; (3) les *attributs* de géométrie surdimensionnés. La résolution du maillage n'est touchée qu'en dernier, et seulement si Adrien le décide, parce que c'est le seul poste qui change la silhouette.

**Tech Stack:** JS vanilla, Three.js r172, Vite, `node --test`.

## Global Constraints

- **La carte doit rester calme.** Une optimisation qui introduit un claquement de niveau de détail, un fondu visible ou une texture qui « pope » est un échec, même si elle est deux fois plus rapide.
- **Le bloc central est le HÉROS.** Toute piste qui l'adoucit est signalée comme telle dans ce document, sans enrobage. Les phases 1, 2 et 4 sont **bit-identiques à l'image** ; les phases 3 et 5 ne le sont pas et exigent une preuve à l'écran.
- **Le MNT `Float32Array` 1536² n'est pas réduit.** Il est lu par le processeur (veille des bateaux, tracé de la jupe, orographie des nuages). Le diviser échangerait de la mémoire contre de la qualité — décision d'Adrien, pas du code.
- **Aucun changement de résolution du maillage dans les phases 1 à 4.** `params.resolution` reste à 1024.
- Tests : `node --test test/<fichier>.test.js`. Tout nouveau test s'ajoute à la liste du script `test` de `package.json`.

---

# RAPPORT

## Le résultat en une phrase

**Le bloc central ne coûte pas cher parce qu'il est trop fin, il coûte cher parce qu'il refait chaque fois le même travail et qu'il range des masques d'un bit dans des textures de quatre octets.** Sur les ≈ 1 270 ms de fil principal que consomme une reconstruction, **~800 ms sont un recalcul à l'identique** ; sur les 125 Mo du bloc, **~53 Mo sont du format, pas de l'information**. La résolution 1024, elle, est bien surdimensionnée pour la vue d'ouverture — mais c'est le dernier levier à tirer, pas le premier.

---

## 1. Ce que j'ai mesuré, et comment

Toutes les mesures ci-dessous ont été exécutées par mes soins, en **Node 24 (même moteur V8 que Chrome)**, sur les modules réels du projet (`src/terrain-analysis.js`, `src/sea-mask.js`, `src/noise.js`, `three@0.172`) ou sur une reproduction fidèle de `Terrain.rebuild()`. Les MNT sont **réels** : 6×6 tuiles terrarium AWS z13, qui couvrent exactement l'emprise d'un patch Mapterhorn z12 3×3 de l'app (1536², même m/px).

Scripts conservés dans `C:\Users\adrie\AppData\Local\Temp\claude\G--My-Drive--GITHUB\ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0\scratchpad\` : `png.mjs`, `mesure-maillage.mjs`, `mesure-geo.mjs`, `mesure-plane.mjs`, `mesure-sampler.mjs`, `mesure-champs.mjs`, `mesure-analyse-reelle.mjs`.

**Ce que je n'ai PAS mesuré** est listé au §7. En particulier : **rien n'a été mesuré dans un navigateur pendant cette campagne.** Les chiffres de VRAM, de fps et de tas JS viennent du rapport damier du 2026-07-27, pas de moi.

### 1.1 Le convertisseur qui rend tous les chiffres lisibles

Sans une conversion en **pixels d'écran**, aucun de ces chiffres ne veut dire quoi que ce soit. La voici, dérivée du code :

| | valeur | source |
|---|---|---|
| vue d'ouverture | `applyIsoView(0)`, `ISO_VIEWS[0]` | `main.js:4149`, `main.js:1684` |
| distance caméra | `controls.maxDistance × 0.97` = **145,5 u** | `main.js:840`, `main.js:4163` |
| champ de vision | **33°** vertical | `public/templates/defaults/shibustart.json` (`look.fov`) |
| hauteur visible à cette distance | `2 × 145,5 × tan(16,5°)` = **86,2 u** | calcul |
| sur une fenêtre de 1080 px de haut | **0,0798 unité-monde par pixel CSS** | calcul |
| une maille du maillage 1024 | `56/1024` = 0,0547 u = **0,69 px CSS** | calcul |
| échelle verticale, Chamonix z12, exagération 2,8 | 1 m de MNT = **7,676 millièmes d'unité** | mesuré |
| **donc : 1 pixel CSS = 10,4 m de dénivelé** | | calcul |

Sur une fenêtre de 1440 px de haut, 1 px CSS = 7,8 m — les erreurs ci-dessous sont alors 1,33× plus grandes en pixels. J'utilise le cas 1080 px partout ; c'est le cas favorable, et je le dis.

**Premier constat, qui cadre tout le reste : à la vue d'ouverture, le bloc central pose 1,45 sommet par pixel CSS.** À `pixelRatio: 2` (le défaut, `main.js:291`), cela fait une maille de 1,37 pixel de rendu. Les moteurs de référence visent 4 à 5 pixels par maille (§3).

### 1.2 Où part le temps — une reconstruction du bloc central

Résolution 1024, mode Naturel (le mode d'ouverture : `shibustart.json` porte `colorMode: "natural"`), MNT 1536².

| étape | ms | remarque |
|---|---:|---|
| `new THREE.PlaneGeometry(56, 56, 1024, 1024)` + `rotateX` | **284** | **un plan plat, intégralement réécrit à la ligne suivante** |
| échantillonnage du MNT (boucle sur 1 050 625 sommets) | 194 | dont **175 ms de bruit FBM** |
| `computeVertexNormals()` | 146 | |
| couleurs de sommet | 41 | |
| `_buildSeaMask()` — flood fill + flou 1536² | 56 | |
| `_buildAnalysis()` — 4 champs, ~10 flous sur 1536² | **470** | MNT réel Chamonix ; 445 ms sur Le Var |
| `rebuildRoughness()` — 512², 6 octaves/texel | ~80 | *repris du rapport damier, non re-mesuré* |
| **total dans `terrain.js`, par reconstruction** | **≈ 1 270** | |

S'y ajoutent, non mesurés : `plinth.rebuild` (anneau de 4×1024 = 4 096 segments), `mapLayers.rebuild`, `regenerateLabels`, `regenerateHud`, `gpxLayer.rebuildAll`, `clouds.build`.

Ce bloc de 1 270 ms se rejoue **à chaque appel de `regenerateTerrain()`** (`main.js:1714`) : changement de zoom, relâchement du curseur d'exagération, curseur de détail fin, bascule Classique↔Naturel, chargement d'un template.

### 1.3 Le déchet transitoire de `PlaneGeometry` — la mesure la plus surprenante

`three/src/geometries/PlaneGeometry.js` construit ses quatre tableaux en **tableaux JS ordinaires** (`const vertices = []; vertices.push(x, -y, 0)`), puis les convertit en tableaux typés (lignes 33-36 et 73-76 du fichier).

Mesuré avec `node --expose-gc` :

```
base 7,3 Mo | juste après PlaneGeometry(56,56,1024,1024) 287,2 Mo | après ramassage 7,3 Mo
=> déchet transitoire ramassé : 279,9 Mo
```

**Chaque reconstruction du bloc central jette 280 Mo de tas JS pour fabriquer un plan plat qu'elle réécrit intégralement.** Sur un damier plein — mesuré à 1 762 Mo de pic pour une limite pratique de 2 à 4 Go dans Chrome — c'est un contributeur direct au plafond, et il n'apparaissait dans aucun relevé parce qu'il est ramassé entre deux instantanés.

### 1.4 L'alternative, chiffrée

| | res 512 | res 1024 |
|---|---:|---:|
| `new PlaneGeometry` + `rotateX` | 78 ms | **284 ms** |
| la même grille en tableaux typés, 1re fois | 3 ms | **14 ms** |
| réutilisation d'un gabarit mémorisé (recopie X/Z) | 0 ms | **2 ms** |
| échantillonnage du MNT (Y) | 3 ms | 7 ms |
| `computeVertexNormals()` | 39 ms | 146 ms |
| *normales par différences centrées* | *2 ms* | *6 ms* |
| **chemin actuel** (PlaneGeometry + échant. + normales) | 120 ms | **436 ms** |
| **chemin avec gabarit mémorisé** | 5 ms | **155 ms** |

⚠️ Les normales par différences centrées **ne donnent pas le même résultat** que `computeVertexNormals` : écart moyen **0,996°**, écart max 158° (mesuré à res 512). Elles sont donc **écartées de ce plan**. Le gain retenu est le gabarit seul : **284 → 2 ms**, bit-identique.

*Preuve de l'identité bit à bit* : `PlaneGeometry` pose `x = ix·segW − w/2`, `y = iy·segH − h/2`, `z = 0`, puis `rotateX(−π/2)` envoie `(x, y, 0)` sur `(x, 0, −y)` ; comme le code pousse `−y`, on obtient `z = iy·segH − h/2`. Les `uv` valent `(ix/gridX, 1 − iy/gridY)`. Les index sont `(a, b, d)` puis `(b, c, d)` avec `a = ix + gridX1·iy`, `b = a + gridX1`, `c = b + 1`, `d = a + 1`. Un gabarit qui reproduit exactement ces trois formules produit des tableaux identiques — la Task 1 le verrouille par un test.

### 1.5 Le bruit FBM de détail : 90 % du temps d'échantillonnage, moins d'un pixel à l'écran

`_makeDemSampler` (`terrain.js:1049-1065`) ajoute à chaque sommet `detail × fbm(3 octaves) + detail × 0,35 × fbm(2 octaves)`, soit **5 octaves de simplex par sommet**.

| résolution | avec FBM (`detail 0,02`, le défaut) | avec FBM (`detail 0,55`, préréglage « Fin ») | sans FBM |
|---|---:|---:|---:|
| 256 | 12 ms | 12 ms | 1 ms |
| 512 | 49 ms | 48 ms | 5 ms |
| **1024** | **194 ms** | 194 ms | **19 ms** |

**Le bruit coûte 90 % du temps d'échantillonnage à toutes les résolutions**, et son coût ne dépend pas de son amplitude.

Ce qu'il apporte, à `detail = 0,02` (la valeur par défaut de `main.js:136`) :

```
amplitude moyenne 0,0055 unité-monde = 0,189 px CSS
amplitude max     0,0233 unité-monde = 0,797 px CSS
```

**Sous le pixel, partout.** Et sa seconde octave a une longueur d'onde de 0,30 unité, soit 5,6 mailles à res 1024 et 2,8 mailles à res 512 — c'est-à-dire **exactement à la limite de Nyquist du maillage à 512**. C'est le seul argument technique solide en faveur de la résolution 1024 que j'aie trouvé, et il porte sur un signal de moins d'un pixel.

Le bruit ne dépend **ni du MNT, ni du zoom, ni de l'exagération, ni de la palette** — seulement de `params.seed`, `params.detailScale` et de la résolution. Il est donc mémorisable (Task 2).

### 1.6 Où part la mémoire — les 125 Mo du bloc central, décomposés

| poste | Mo | vérification |
|---|---:|---|
| **géométrie**, dont : | **68,09** | mesuré ; concorde à 0,01 Mo près avec le rapport damier |
| — `index` `Uint32Array` (6 291 456) | 24,00 | |
| — `position` `Float32Array`×3 | 12,02 | dont X et Z sont une grille constante |
| — `normal` `Float32Array`×3 | 12,02 | |
| — `color` `Float32Array`×3 | 12,02 | **trois flottants identiques par sommet** (r = g = b) |
| — `uv` `Float32Array`×2 | 8,02 | **fonction linéaire exacte de `position.xz`** |
| `uCoastMask` 2048² **RGBA** | 16,00 | le shader ne lit que `.r` (`terrain.js:495`) |
| `ImageData` du masque côtier 2048² **RGBA** (processeur) | 16,00 | tous les consommateurs ne lisent que le canal 0 |
| `uAnalysis` 1536² RGBA + mipmaps | 12,00 | **les 4 canaux sont utilisés** — légitime |
| MNT `Float32Array` 1536² | 9,00 | intouchable (décision d'Adrien) |
| `uRegionMask` 1024² **RGBA** | 4,00 | le shader ne lit que `.r` (`terrain.js:460`) |
| `uSeaMask` 1536² **R8** | 2,25 | déjà au bon format |
| rugosité 512² RGBA + son `clone()` de bump | 2,00 | deux textures GPU pour un seul tableau |
| rampe 512×64 | 0,13 | |

### 1.7 La question directe d'Adrien : « les textures sont-elles plus fines que le maillage, comme sur le damier ? »

**Non. Le déséquilibre du damier ne se reproduit pas sur le héros.** Le maillage 1024 sur 56 unités donne **18,3 sommets par unité-monde**. Face à lui :

| champ | px/unité | rapport au maillage | règle du damier (`block-grid.js:44`) |
|---|---:|---:|---|
| `uCoastMask` 2048² | 36,6 | **×2,0** | ≤ ×4 ✓ |
| `uAnalysis` 1536² | 27,4 | **×1,5** | ≤ ×4 ✓ |
| `uSeaMask` 1536² | 27,4 | **×1,5** | ≤ ×4 ✓ |
| `uRegionMask` 1024² | 18,3 | **×1,0** | ≤ ×4 ✓ |

Une voisine était à ×4 et ×5 ; le héros est à ×1 et ×2. Le levier « réduire la taille » n'existe pas ici.

Et il ne doit pas exister, parce que **sur le héros le bon étalon n'est pas le maillage, c'est l'écran** : ces champs sont lus par fragment, en coordonnées monde. À la vue d'ouverture et à `pixelRatio: 2`, l'écran offre 25,1 pixels de rendu par unité-monde. Le masque côtier en donne 36,6 (1,46 texel par pixel) et l'analyse 27,4 (1,09 texel par pixel). **Ils sont dimensionnés juste.** Les réduire adoucirait la carte — et je l'ai mesuré : diviser l'analyse par deux (1536² → 768²) écarte le champ de **3,7/255 en moyenne mais 153/255 au maximum** sur Chamonix. Le peigné des crêtes est précisément un signal de bandes fines ; c'est lui qui paierait. **À ne pas faire sur le héros.**

Le gisement du héros est donc ailleurs : **le format, pas la taille.** 53 Mo sur 125 encodent moins d'information qu'ils n'occupent d'octets.

---

## 2. Ce que coûte, en pixels, une réduction du maillage

Mesuré sur trois MNT réels. Protocole : la surface du maillage grossier est évaluée aux points de la grille fine (interpolation bilinéaire dans le quad) et comparée à l'échantillonnage direct. Le bruit FBM est exclu — il s'ajoute identiquement à toutes les résolutions.

**Chamonix / Mont-Blanc** (le défaut de l'app, altitudes 342–1 807 m, 1 px CSS = 10,4 m) :

| maillage | erreur RMS | p99 | erreur max | **RMS en px** | **max en px** | géométrie |
|---|---:|---:|---:|---:|---:|---:|
| 768 | 0,22 m | 0,67 m | 17,39 m | **0,02** | **1,67** | 38,31 Mo |
| 640 | 0,29 m | 0,92 m | 23,31 m | 0,03 | 2,24 | 26,62 Mo |
| 512 | 0,40 m | 1,30 m | 35,87 m | **0,04** | **3,45** | 17,04 Mo |
| 384 | 0,64 m | 2,19 m | 44,53 m | 0,06 | 4,28 | 9,59 Mo |
| 256 | 1,21 m | 4,39 m | 51,41 m | 0,12 | 4,94 | 4,27 Mo |

**Le Var** (32–731 m) : à 512, RMS 0,29 m = 0,03 px, max 4,00 m = **0,38 px**.
**Bassin d'Arcachon** (−6 à 91 m) : à 512, RMS 0,15 m, max 10,25 m = **0,99 px**.

### Le chiffre qui recadre le débat

**Ce que 1024 perd déjà par rapport à 2048, aujourd'hui, sur Chamonix : RMS 0,13 m, max 17,11 m — soit 1,64 px CSS.**

**Ce que 768 perdrait par rapport à 1024 : RMS 0,22 m, max 17,39 m — soit 1,67 px CSS.**

Autrement dit : **le pas 1024 → 768 coûte exactement ce qu'Adrien accepte déjà en ne prenant pas 2048.** Ce n'est pas un argument pour le faire — c'est un argument pour dire que c'est une décision de goût, pas une décision technique, et qu'elle doit être prise à l'écran devant deux captures.

Et le passage à 512 (−51 Mo de géométrie, −280 ms) coûte **3,45 px sur le seul sommet le plus aigu du massif du Mont-Blanc**, et 0,04 px en moyenne.

---

## 3. L'état de l'art — ce que font les plus grands, avec les sources

### 3.1 Le fait le plus utile : personne n'utilise une grille de 2 millions de triangles pour une seule dalle

| moteur | maillage par tuile | sommets | source |
|---|---|---:|---|
| **Mapbox GL JS** | grille régulière **128×128**, VBO **unique partagé** entre toutes les tuiles | 17 161 | `GRID_DIM = 128` dans `src/terrain/terrain.ts` |
| **MapLibre GL JS** | idem, `this.meshSize = 128` | 16 641 | `src/render/terrain.ts:151` |
| **NASA Web WorldWind** | tuiles de **32×32 cellules** | 1 089 | `Tessellator.js:85-119` (`tileWidth = 32`) |
| **CesiumJS** (quantized-mesh) | TIN adaptatif, **~1 000 à 4 200 sommets** par tuile | mesuré | tileset public `terrain.reearth.land`, décodé selon la spec |
| **ShibuMap, bloc central** | grille régulière **1024×1024** | **1 050 625** | `main.js:136` |

Budgets par frame relevés dans la littérature : CDLOD (Strugar 2010) tourne à **105 k – 446 k triangles/frame** sur des datasets de 488 × 304 km ; les geometry clipmaps de Hoppe à **≈ 460 k triangles/frame** pour les États-Unis entiers à 30 m. **Le bloc central de ShibuMap en aligne 2,1 M pour 21 km de côté.**

Le critère universel n'est jamais le nombre absolu, c'est la **taille écran du triangle** :
- Hoppe (GPU Gems 2, ch. 2) : « With a clipmap size n = 255, the triangles are approximately **5 pixels wide** in a 1024×768 window. »
- Cesium : `Globe.maximumScreenSpaceError` = **2 pixels** par défaut, injecté dans `error = (maxGeometricError × height) / (distance × sseDenominator)` (`QuadtreePrimitive.js`).
- Mapbox : une tuile de 512 px CSS portée par 128 cellules → **4 px CSS par maille**.
- **ShibuMap à la vue d'ouverture : 0,69 px CSS par maille.**

### 3.2 Le DEM est volontairement échantillonné plus grossièrement que l'image

C'est le point le plus transposable, et il est explicite dans le code de Mapbox (`src/terrain/terrain.ts:402`) :

> `// Lower tile zoom is sufficient for terrain, given the size of terrain grid.`

`getScaledDemTileSize()` renvoie `512/128 × 512 = 2048`, ce qui fait descendre la couverture DEM de `log2(2048/512) = 2 niveaux de zoom` sous le raster drapé. Sur les 262 144 échantillons d'une tuile raster-dem 512², **16 641 seulement (6,3 %) sont lus par la grille de rendu**. Et Mapbox Terrain-DEM v1 s'arrête à z14 : « Renderers will interpolate and smooth at higher zoom levels but will not increase the resolution of the data loaded by your application. »

ShibuMap fait l'inverse : maillage 1025 sommets sur un MNT 1536², soit **1,5 échantillon de MNT par sommet**. Le maillage est déjà légèrement *sous* Nyquist — c'est mesurable dans le tableau du §2 (le passage 2048 → 1024 coûte 17,11 m au maximum, ce n'est pas nul).

### 3.3 La triangulation adaptative ne vaut pas le coup ici — mesuré

MARTINI (Mapbox's Awesome Right-Triangulated Irregular Networks, Improved) est l'algorithme derrière `deck.gl/TerrainLayer` (`meshMaxError: 4.0` par défaut). Comparé à une grille régulière **à erreur mesurée égale**, sur la fixture officielle Fuji 512² :

| critère | gain de MARTINI sur une grille régulière |
|---|---|
| à **erreur maximale** égale | **3× à 9×** moins de triangles |
| à **erreur quadratique moyenne (RMSE)** égale | **1,1× à 1,8×** — quasi nul |

MARTINI concentre ses triangles sur les ruptures de pente, ce qui écrase l'erreur *maximale*. Mais l'erreur *moyenne* est dominée par la texture diffuse du relief partout ailleurs, et là une grille régulière est déjà quasi optimale. **Et un maillage adaptatif impose un VBO par bloc, là où une grille régulière permet d'en partager un seul** — c'est précisément pourquoi Mapbox et MapLibre ont choisi la grille.

Autre point relevé et non documenté ailleurs : le `meshMaxError` de MARTINI n'est pas l'erreur réelle. L'erreur verticale mesurée vaut **1,7× à 2,0× la valeur demandée**.

**Conclusion : ne pas partir sur MARTINI ni sur un TIN. La grille régulière est le bon choix ; il faut seulement la dimensionner et la partager.**

### 3.4 Comment le pop est évité — et par qui

| moteur | geomorphing ? | ce qu'il fait |
|---|---|---|
| **CesiumJS** | **NON.** « Minimize popping artifacts by morphing between terrain LODs » est un item **encore ouvert** de la roadmap (issue #526). Aucun blend inter-LOD dans `GlobeVS.glsl`. | Interdit structurellement la *régression* de détail (le traverseur ne rend jamais moins fin que la frame précédente) ; attend que les 4 enfants soient prêts ; `fill meshes` alignées sur les voisins ; **brouillard** injecté dans la formule d'erreur (`error -= fog(...) × fog.sse`, `screenSpaceErrorFactor = 2.0` — « decrease the number both of tiles rendered and of tiles requested from the server by **35 %** for horizon views ») |
| **MapLibre** | **NON.** Et, fait décisif : `tile_manager.ts:549` — `// enable fading for raster source except when using terrain which doesn't currently support fading`. **Sous terrain 3D, MapLibre désactive purement et simplement le fondu.** | substitution parent/enfant seule |
| **Mapbox GL JS** | **partiellement** : le shader reçoit `u_dem` **et** `u_dem_prev`, avec un bloc `morphing: { srcDemTile, dstDemTile }` — interpolation entre deux textures DEM plutôt qu'un saut | + `raster-fade-duration` 300 ms |
| **NASA Web WorldWind** | **NON.** Zéro occurrence de `skirt` dans `Tessellator.js` ; `alignNeighborElevations` fait du *snapping* de sommets de bord (anti-T-jonction), le changement de niveau reste discret | |
| **CDLOD** (Strugar 2010) | **OUI**, par sommet | morph du **XY** : `morphLerpK = clamp((d − mStart)/(mEnd − mStart), 0, 1)`, `mStart` = 70 % de la plage ; les sommets d'indice impair glissent d'une cellule sur leur voisin pair, et **le Z est ré-échantillonné après** — aucune donnée supplémentaire |
| **Geometry clipmaps** (Hoppe) | **OUI**, par sommet | morph du **Z** : `α = clamp((abs(p − v) − offset)/w, 0, 1)` avec `w = n/10`, puis `z' = (1−α)·z_fin + α·z_grossier`. **Et les normales sont blendées avec le même α** — sinon le pop revient par l'éclairage |

**Le piège à retenir** : les deux seules familles qui suppriment vraiment le pop (CDLOD, clipmaps) exigent que **les deux niveaux partagent leurs sommets**. Un remplacement de `PlaneGeometry` ne le permet pas. Il n'existe pas de version « légère » du geomorphing.

### 3.5 Budgets mémoire imposés

- **Cesium** : `tileCacheSize = 100` — et c'est un **nombre de tuiles, pas des mégaoctets** (plusieurs tutoriels affirment le contraire, c'est faux : la doc dit « expressed as a number of tiles »). Une LRU évince à l'arrivée de nouvelles tuiles, les tuiles rendues cette frame étant protégées. Le budget **en octets** n'existe que pour les 3D Tiles : `cacheBytes` **512 Mo** par défaut.
- **Mapbox / MapLibre** : cache dimensionné dynamiquement, `approxTilesInView × 5`. Sur un 1920×1080 en tuiles 512, cela donne **100 tuiles par source**, soit **~210 Mo de RAM pour la seule source DEM** (≈ 2,1 Mo par tuile : RGBA décodée + `Int32Array`). Aucune recommandation chiffrée officielle sur la RAM.
- **Google Earth Web** : aucun budget public. La seule déclaration touchant à la mémoire, dans le blog Chrome de 2019 : « Earth may fail to start on devices with limited amounts of memory (such as 32-bit machines). » La limite wasm32 est de **4 Go** (V8, Chrome M83+). *Le format de terrain de Google Earth n'est connu que par rétro-ingénierie* (`retroplasma/earth-reverse-engineering`) : octree, meshs adaptatifs pré-calculés par nœud, textures **CRN-DXT1** — c'est-à-dire du BC1 compressé GPU, jamais du RGBA décodé.

### 3.6 Le coût d'une texture — les chiffres, vérifiés

`taille = largeur × hauteur × 4 × 1,333` (RGBA8 + mipmaps). Une 4096² fait donc 90 Mo « quelle que soit la petitesse du fichier d'origine ».

| format | bits/texel | 2048² sans mips | vs RGBA8 |
|---|---:|---:|---:|
| RGBA8 | 32 | **16 Mio** | référence |
| R16F | 16 | 8 Mio | ÷2 |
| **R8** | **8** | **4 Mio** | **÷4** |
| BC1 / ETC2-RGB | 4 | 2 Mio | ÷8 |

Les mipmaps ajoutent bien **+33,3 %** (série 1 + ¼ + 1/16 + … = 4/3).

**La compression GPU (KTX2/Basis) n'est PAS une piste ici** : le support est fracturé — ASTC couvre 99,9 % d'Android et **2,05 % de Windows** ; S3TC/BC couvre 99,95 % de Windows et 28,6 % d'Android. Il faudrait embarquer un transcodeur pour des textures que l'app **génère elle-même à l'exécution**. Le passage en **R8** donne le même facteur 4 pour trois lignes de code.

---

## 4. Le progressif basse def → haute def : la réponse honnête

> « Est-ce qu'on ferait un préchargement basse def, avant de passer au haute def parmi les options à envisager ? »

**Pour le maillage du bloc central : non. Et je le déconseille formellement, en l'état.** Quatre raisons, dans l'ordre de solidité.

### 4.1 Sur le réseau, ça ne coûte pas moins — ça coûte plus

`loadDem` charge **9 tuiles** (3×3) au zoom demandé. Précharger le même terrain « en plus grossier » veut dire charger des tuiles d'un **autre niveau de zoom**, qui ne serviront pas au rendu final : ce sont **4 à 9 requêtes ajoutées**, pas économisées. Le progressif réseau ne fait pas gagner d'octets, il fait gagner de l'**avance**.

Et l'avance n'est pas là où on croit : le rapport damier a mesuré **220 ms pour charger un MNT** (207 ms réseau + 13 ms de décodage) contre **1 270 ms de calcul**. Le chemin critique du bloc central est le processeur, pas le réseau — dans un rapport de 1 à 6.

### 4.2 Sur le processeur, en l'état, ça coûte strictement plus cher

Reconstruire à 1024 après avoir construit à 256 :

| | ms bloquantes |
|---|---:|
| construire à 256 | 26 |
| puis reconstruire à 1024 | 665 |
| **total en deux temps** | **691** |
| en un temps, aujourd'hui | 665 |

**Un rendu progressif ajoute 26 ms ET un second gel.** Et ce second gel est le long (665 ms) : le palier basse def n'en épargne rien, puisque `rebuild()` repart de zéro (`new PlaneGeometry`, `_makeSampler`, `computeVertexNormals`).

**Après les Tasks 1 et 2 de ce plan**, le second palier tomberait à ~200 ms. Mais alors le total en un temps serait déjà de ~470 ms, et l'intérêt du progressif s'évapore avec le problème qu'il devait résoudre. **C'est l'argument décisif : les phases 1 et 2 rendent le progressif inutile, au lieu de le rendre possible.**

### 4.3 Ça claquerait, et c'est mesuré

Le passage 256 → 1024 déplace la surface de **51,41 m au maximum sur le massif du Mont-Blanc, soit 4,94 pixels CSS**, en une frame. Un déplacement de 5 px sur une ligne de crête est parfaitement visible et n'a aucun palliatif :

- un **fondu croisé** ne masque pas un saut géométrique — MapLibre l'a d'ailleurs tranché à sa façon en désactivant le fondu raster dès que le terrain 3D est actif (`tile_manager.ts:549`) ;
- un **morphing** (CDLOD, clipmaps) exige que les deux maillages partagent leurs sommets et que **les normales soient blendées avec le même facteur** (Hoppe, Listing 2-2 : sans cela le pop revient par l'éclairage). Un swap de `PlaneGeometry` ne remplit aucune des deux conditions ;
- Cesium, qui a le quadtree, les jupes et les `fill meshes`, **n'a toujours pas de geomorphing** — c'est un item ouvert de sa roadmap depuis 2013.

### 4.4 Le gain de perception existe — mais le produit l'a déjà, et mieux

Il y a un vrai argument de perception : voir *quelque chose* vaut mieux qu'attendre. Sauf que **ShibuMap couvre déjà l'attente par un voile de chargement** (`loadingEl` + `loadingStatus`, `main.js:1602-1614` et `main.js:1731`). Le progressif consisterait à **retirer ce voile plus tôt pour montrer une carte fausse qui se corrige sous les yeux**.

Pour un produit dont la règle est *la carte doit rester calme*, un voile propre suivi d'une carte juste est un meilleur progressif qu'une carte qui se réajuste. **Je recommande de garder le voile et de raccourcir l'attente**, ce qui est exactement l'objet des phases 1 à 4.

### 4.5 Là où le progressif est déjà en place — et où il faut regarder

Le produit fait **déjà** du progressif, sur les *textures* et non sur la géométrie. `fetchAndBuildDem` (`main.js:1620-1665`) pose `terrain.setCoastMask(null)` puis applique le vrai masque quand il arrive. Or ce `.then()` s'exécute **après** `await regenerateTerrain()`, qui appelle `hideLoading()`. **Structurellement, le masque côtier atterrit donc après le retrait du voile**, et son arrivée change la règle terre/mer (`uCoastMaskOn` 0 → 1, `terrain.js:493-502`) et allume un trait de côte.

⚠️ **Je n'ai pas vu ce claquement à l'écran** — c'est une lecture de code, pas une observation. Mais c'est le seul endroit du chargement où un « pop » est structurellement possible, et il mérite d'être regardé avant d'en inventer d'autres. Un fondu de `uCoastMaskOn` sur 200 ms y serait légitime : c'est un fondu de *peinture*, pas de géométrie, et il ne bouge aucun sommet.

**Verdict** : préchargement basse def du maillage → **non**. Fondu du masque côtier à son arrivée → **oui, à vérifier d'abord à l'œil**.

---

## 5. Ce qu'il ne faut PAS faire

**Ne pas commencer par la résolution du maillage.** C'est le seul poste qui touche la silhouette du héros. Il vient en dernier, et c'est une décision de goût prise devant deux captures — pas une optimisation.

**Ne pas réduire l'analyse de relief sur le héros.** 1536² → 768² rendrait 9 Mo et 340 ms, mais écarte le champ de **153/255 au maximum** sur Chamonix. Le peigné des crêtes est un signal de bandes fines ; c'est exactement lui qui disparaîtrait. Et `coarsenField` ne travaille qu'en facteurs entiers : depuis 1536 il n'y a pas de palier intermédiaire, c'est 1536 ou 768.

**Ne pas toucher au MNT.** Décision d'Adrien, déjà actée dans `block-grid.js:39-43`.

**Ne pas partir sur MARTINI, un TIN ou un quadtree.** Gain mesuré à erreur moyenne égale : 1,1× à 1,8×. Et un maillage adaptatif interdit le partage d'un VBO unique, qui est le vrai levier (Task 13).

**Ne pas viser la compression GPU des textures.** Support fracturé (ASTC 2 % sur Windows, S3TC 29 % sur Android) pour des textures générées à l'exécution. R8 donne le même facteur 4 gratuitement.

**Ne pas remplacer `computeVertexNormals` par des différences centrées** sans preuve à l'écran : écart moyen mesuré 0,996°, max 158°.

---

## 6. Récapitulatif des gains

| phase | ms de gel gagnées | Mo gagnés | identique à l'image ? |
|---|---:|---:|---|
| **1** — le travail refait à l'identique | **~540** (+ 280 Mo de déchet transitoire supprimés) | +4,2 Mo de cache | **oui, bit à bit** |
| **2** — les formats de masque | ~11 | **−27** | **oui, bit à bit** |
| **3** — les attributs de géométrie | ~40 | **−23** | non — à prouver à l'écran |
| **4** — sortir du fil principal | **~526** de gel (le calcul reste) | 0 | **oui, bit à bit** |
| **5** — le déplacement dans le shader (horizon) | ~180 | **−56 par bloc** | non — chantier |
| *(hors plan)* passer à 768 | ~250 | −30 | **non — décision d'Adrien** |

Cible réaliste après les phases 1, 2 et 4 : **1 270 ms → ~200 ms de fil principal bloqué, 125 Mo → 98 Mo, et 280 Mo de déchet transitoire par reconstruction supprimés — sans qu'un seul pixel bouge.**

---

## 7. Ce qui n'a PAS pu être mesuré

1. **Rien n'a été mesuré dans un navigateur** pendant cette campagne. Les temps sont mesurés en Node 24 (même V8 que Chrome) sur les modules réels ; les chiffres de VRAM, de fps et de tas JS proviennent du rapport damier du 2026-07-27.
2. **`rebuildRoughness` (~80 ms)** est repris du rapport damier, non re-mesuré ici.
3. **Le coût de `plinth.rebuild`, `mapLayers.rebuild`, `regenerateLabels`, `regenerateHud`, `gpxLayer.rebuildAll` et `clouds.build`** — tous appelés dans le même `setTimeout` que `terrain.rebuild` (`main.js:1720-1749`) — n'a pas été mesuré. Le total de 1 270 ms est donc un **plancher**, pas le gel complet.
4. **Le claquement du masque côtier (§4.5) est une lecture de code, pas une observation.**
5. **L'écart de normales de 158° au maximum** (§1.4) n'est pas expliqué. Il suffit à écarter la piste, il ne suffit pas à la comprendre.
6. Les MNT de mesure viennent d'**AWS terrarium (EU-DEM 25 m en Europe)**, alors que l'app sert **Mapterhorn (IGN RGE ALTI en France)**, plus riche en hautes fréquences. **Les erreurs de décimation du §2 sont donc un minorant** — le vrai MNT de production perdrait un peu plus en descendant de résolution. C'est le biais le plus important de ce rapport.
7. **L'impact visuel réel des Tasks 8, 9 et 10** n'est pas mesuré : chacune porte sa propre vérification à l'écran dans le plan.

---

# PLAN

---

## Phase 1 — Le travail refait à l'identique · ~540 ms et 280 Mo de déchet, sans qu'un pixel bouge

C'est **quarante pour cent du gel** pour la plus petite surface de code, et c'est la seule phase dont on peut promettre l'identité bit à bit. À faire avant tout le reste : les phases suivantes ne se mesureront correctement qu'une fois celle-ci passée.

### Task 1 : Gabarit de grille mémorisé par résolution

**Files:**
- Create: `src/grid-template.js`
- Modify: `src/terrain.js:1130-1197` (`rebuild`)
- Test: `test/grid-template.test.js`

**Interfaces:**
- Produces: `gridTemplate(res, size)` → `{ position: Float32Array, uv: Float32Array, index: Uint32Array, count: number }`. `position` a X et Z posés, Y à 0. Le même objet est renvoyé pour un couple `(res, size)` déjà demandé (mémoïsation) ; **l'appelant ne doit jamais écrire dedans**, il copie.
- Produces: `clearGridTemplates()` — vide le cache (tests uniquement).

⚠️ `size` est un **paramètre**, pas un import de `TERRAIN_SIZE` : `terrain.js` importera `grid-template.js`, un import en retour créerait un cycle ESM. Ce cycle marcherait *par chance* (la constante n'est lue qu'à l'appel), et c'est exactement le genre de chance qui se perd au prochain refactor.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/grid-template.test.js` :

```js
// LE GABARIT DE GRILLE EST BIT-IDENTIQUE À PlaneGeometry.
//
// `new THREE.PlaneGeometry(56, 56, 1024, 1024)` met 284 ms et jette 280 Mo de
// tas JS (tableaux JS ordinaires + push, convertis en tableaux typés à la fin)
// pour produire un plan PLAT que Terrain.rebuild réécrit intégralement à la
// ligne suivante. Seuls `uv` et `index` survivent, et X/Z ne dépendent que de
// la résolution. Le gabarit les mémorise. Ce test verrouille l'identité : si
// elle se perd, la silhouette du héros bouge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { gridTemplate, clearGridTemplates } from '../src/grid-template.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

function reference(res) {
  const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res)
  g.rotateX(-Math.PI / 2)
  return g
}

for (const res of [4, 17, 256]) {
  test(`gabarit ${res} : positions identiques à PlaneGeometry`, () => {
    const g = reference(res)
    const t = gridTemplate(res, TERRAIN_SIZE)
    const ref = g.attributes.position.array
    assert.equal(t.count, g.attributes.position.count)
    for (let i = 0; i < t.count; i++) {
      assert.equal(t.position[i * 3], ref[i * 3], `X du sommet ${i}`)
      assert.equal(t.position[i * 3 + 1], 0, `Y du sommet ${i} doit partir à 0`)
      assert.equal(t.position[i * 3 + 2], ref[i * 3 + 2], `Z du sommet ${i}`)
    }
  })

  test(`gabarit ${res} : uv identiques à PlaneGeometry`, () => {
    const ref = reference(res).attributes.uv.array
    const t = gridTemplate(res, TERRAIN_SIZE)
    for (let i = 0; i < t.count * 2; i++) assert.equal(t.uv[i], ref[i], `uv[${i}]`)
  })

  test(`gabarit ${res} : index identiques à PlaneGeometry`, () => {
    const ref = reference(res).index.array
    const t = gridTemplate(res, TERRAIN_SIZE)
    assert.equal(t.index.length, ref.length)
    for (let i = 0; i < ref.length; i++) assert.equal(t.index[i], ref[i], `index[${i}]`)
  })
}

test('le gabarit est mémorisé : deux appels rendent le MÊME objet', () => {
  clearGridTemplates()
  const a = gridTemplate(8, TERRAIN_SIZE)
  const b = gridTemplate(8, TERRAIN_SIZE)
  assert.equal(a, b)
  assert.equal(a.position, b.position)
})

test('une taille différente ne réutilise pas le gabarit', () => {
  clearGridTemplates()
  assert.notEqual(gridTemplate(8, TERRAIN_SIZE), gridTemplate(8, TERRAIN_SIZE * 2))
})

test('clearGridTemplates repart de zéro', () => {
  clearGridTemplates()
  const a = gridTemplate(8, TERRAIN_SIZE)
  clearGridTemplates()
  assert.notEqual(gridTemplate(8, TERRAIN_SIZE), a)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/grid-template.test.js`
Expected: FAIL — `Cannot find module '../src/grid-template.js'`

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/grid-template.js` :

```js
// GABARIT DE GRILLE — la partie d'un PlaneGeometry qui ne dépend QUE de la
// résolution, mémorisée une fois pour toutes.
//
// `new THREE.PlaneGeometry(56, 56, 1024, 1024)` met **284 ms** et jette
// **280 Mo de tas JS** (mesuré au `--expose-gc`) : three.js empile ses quatre
// tableaux dans des tableaux JS ordinaires (`vertices.push(x, -y, 0)`) avant de
// les convertir en tableaux typés. Or `Terrain.rebuild` réécrit ensuite TOUS
// les Y et TOUTES les normales : du plan plat, seuls `uv`, `index` et les X/Z
// survivent — et ces trois-là ne dépendent que de la résolution.
//
// ⚠️ IDENTITÉ BIT À BIT, et c'est tout l'enjeu. Les formules ci-dessous
// reproduisent exactement celles de three.js :
//   position : x = ix·segW − w/2 ; PlaneGeometry pousse (x, −y, 0) puis
//              rotateX(−π/2) envoie (x, Y, 0) sur (x, 0, −Y), d'où
//              z = iy·segH − h/2.
//   uv       : (ix/gridX, 1 − iy/gridY)
//   index    : (a, b, d) puis (b, c, d), a = ix + gridX1·iy, b = a + gridX1,
//              c = b + 1, d = a + 1
// test/grid-template.test.js verrouille les trois contre PlaneGeometry.
//
// ⚠️ LE GABARIT EST PARTAGÉ ET EN LECTURE SEULE. L'appelant COPIE `position`
// (il va y écrire les Y) et peut réutiliser `uv` et `index` tels quels tant
// qu'il ne les modifie pas.
//
// ⚠️ `size` est un PARAMÈTRE et non un import de TERRAIN_SIZE : terrain.js
// importe ce module, l'import en retour ferait un cycle ESM. Il marcherait par
// chance (la constante n'est lue qu'à l'appel) — et cette chance-là se perd au
// premier refactor.

const cache = new Map()

export function gridTemplate(res, size) {
  const cle = `${res}|${size}`
  const memo = cache.get(cle)
  if (memo) return memo
  const n = res + 1
  const count = n * n
  const position = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const index = new Uint32Array(res * res * 6)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    const v = 1 - iy / res
    for (let ix = 0; ix < n; ix++) {
      const k = iy * n + ix
      position[k * 3] = ix * seg - half
      position[k * 3 + 2] = z
      uv[k * 2] = ix / res
      uv[k * 2 + 1] = v
    }
  }
  let p = 0
  for (let iy = 0; iy < res; iy++) {
    for (let ix = 0; ix < res; ix++) {
      const a = ix + n * iy
      const b = ix + n * (iy + 1)
      const c = ix + 1 + n * (iy + 1)
      const d = ix + 1 + n * iy
      index[p++] = a; index[p++] = b; index[p++] = d
      index[p++] = b; index[p++] = c; index[p++] = d
    }
  }
  const tpl = { position, uv, index, count }
  cache.set(cle, tpl)
  return tpl
}

/** Vide le cache — tests uniquement. */
export function clearGridTemplates() {
  cache.clear()
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/grid-template.test.js`
Expected: PASS, 11 tests

- [ ] **Step 5: Brancher le gabarit dans `Terrain.rebuild`**

Dans `src/terrain.js`, ajouter l'import en tête de fichier (après `import { buildRamp2D } from './palette.js'`) :

```js
import { gridTemplate } from './grid-template.js'
```

Puis remplacer les deux premières lignes de `rebuild(params)` (`terrain.js:1130-1133`) :

```js
  rebuild(params) {
    const res = params.resolution
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res)
    geo.rotateX(-Math.PI / 2)
```

par :

```js
  rebuild(params) {
    const res = params.resolution
    // GABARIT MÉMORISÉ au lieu de `new THREE.PlaneGeometry` : 284 ms et 280 Mo
    // de déchet transitoire à res 1024, pour un plan plat intégralement réécrit
    // trois lignes plus bas. `uv` et `index` sont partagés en lecture seule ;
    // `position` est copié parce qu'on va y écrire les Y.
    // ⚠️ La copie est indispensable : deux blocs (damier) partagent le gabarit.
    const tpl = gridTemplate(res, TERRAIN_SIZE)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tpl.position), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tpl.uv), 2))
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(tpl.index), 1))
```

- [ ] **Step 6: Vérifier qu'aucun test existant ne casse**

Run: `npm test`
Expected: PASS — même nombre de tests qu'avant, aucun échec.

- [ ] **Step 7: Vérifier à l'écran que rien n'a bougé**

Lancer `npm run dev`, charger le terrain par défaut (Chamonix, z10), attendre la vue isométrique 1, prendre une capture. Comparer à une capture prise avant la Task 1 sur la même vue. **Attendu : écart RVB moyen sous 8,19/255** — le seuil de bruit établi entre deux rendus identiques (rapport damier). Vérifier en plus que le socle (`plinth`) épouse toujours exactement le bord du relief : il est bâti sur `params.resolution` (`plinth.js:363`), un décalage d'un sommet se verrait au raccord.

- [ ] **Step 8: Commit**

```bash
git add src/grid-template.js test/grid-template.test.js src/terrain.js package.json
git commit -m "perf(terrain): gabarit de grille memorise au lieu de PlaneGeometry

284 ms et 280 Mo de dechet transitoire par reconstruction du bloc central,
pour un plan plat integralement reecrit. Bit-identique, verrouille par test."
```

Ajouter `test/grid-template.test.js` à la liste du script `test` de `package.json` avant de committer.

---

### Task 2 : Mémoriser le bruit FBM de détail

**Files:**
- Create: `src/detail-noise.js`
- Modify: `src/terrain.js:1032-1066` (`_makeDemSampler`), `src/terrain.js:1130-1197` (`rebuild`)
- Test: `test/detail-noise.test.js`

**Interfaces:**
- Consumes: `gridTemplate(res, size)` de la Task 1.
- Produces: `detailField(seed, detailScale, res, size)` → `Float32Array` de `(res+1)²`, valeur `fbm3(x·s, z·s) + 0,35 · fbm2(x·s·4,1 + 31, z·s·4,1 − 17)` en chaque sommet de la grille. Mémorisé sur la clé `${seed}|${detailScale}|${res}|${size}`, une entrée gardée à la fois.
- Produces: `clearDetailField()` — vide le cache (tests uniquement).

⚠️ Même règle qu'à la Task 1 : `size` est un paramètre, pas un import de `TERRAIN_SIZE`, pour ne pas créer de cycle avec `terrain.js`.

**Contrepartie assumée : +4,2 Mo de cache à res 1024, contre 175 ms par reconstruction.** À res 1024 c'est 3,4 % de l'empreinte du bloc pour 14 % de son gel. Les phases 2 et 3 rendent 50 Mo, largement de quoi le payer.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/detail-noise.test.js` :

```js
// LE BRUIT DE DÉTAIL EST MÉMORISABLE, ET IL COÛTE 90 % DE L'ÉCHANTILLONNAGE.
//
// _makeDemSampler ajoute 5 octaves de simplex par sommet. Mesuré à res 1024 :
// 194 ms d'échantillonnage dont **175 ms de bruit**, pour une amplitude de
// 0,19 px CSS en moyenne et 0,80 px au maximum au réglage par défaut
// (detail 0,02). Or ce bruit ne dépend NI du MNT, NI du zoom, NI de
// l'exagération, NI de la palette — seulement de seed, detailScale et de la
// résolution. Il survit donc à un changement de zoom, à un coup de curseur
// d'exagération et à un changement de palette.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Simplex2, mulberry32, fbm } from '../src/noise.js'
import { detailField, clearDetailField } from '../src/detail-noise.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

function reference(seed, detailScale, res) {
  const s = new Simplex2(mulberry32(seed))
  const n = res + 1
  const out = new Float32Array(n * n)
  const half = TERRAIN_SIZE / 2
  const seg = TERRAIN_SIZE / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    for (let ix = 0; ix < n; ix++) {
      const x = ix * seg - half
      out[iy * n + ix] =
        fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        0.35 * fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
    }
  }
  return out
}

test('detailField reproduit exactement le bruit de _makeDemSampler', () => {
  clearDetailField()
  const res = 32
  const got = detailField(1, 0.8, res, TERRAIN_SIZE)
  const want = reference(1, 0.8, res)
  assert.equal(got.length, want.length)
  for (let i = 0; i < want.length; i++) assert.equal(got[i], want[i], `sommet ${i}`)
})

test('un seed différent donne un champ différent', () => {
  clearDetailField()
  const a = Float32Array.from(detailField(1, 0.8, 16, TERRAIN_SIZE))
  const b = detailField(2, 0.8, 16, TERRAIN_SIZE)
  assert.notEqual(a[5], b[5])
})

test('la mémorisation rend le MÊME tableau pour la même clé', () => {
  clearDetailField()
  assert.equal(detailField(1, 0.8, 16, TERRAIN_SIZE), detailField(1, 0.8, 16, TERRAIN_SIZE))
})

test('changer detailScale invalide le cache', () => {
  clearDetailField()
  const a = detailField(1, 0.8, 16, TERRAIN_SIZE)
  const b = detailField(1, 3, 16, TERRAIN_SIZE)
  assert.notEqual(a, b)
})

test('changer la résolution invalide le cache', () => {
  clearDetailField()
  const a = detailField(1, 0.8, 16, TERRAIN_SIZE)
  const b = detailField(1, 0.8, 32, TERRAIN_SIZE)
  assert.notEqual(a, b)
  assert.equal(b.length, 33 * 33)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/detail-noise.test.js`
Expected: FAIL — `Cannot find module '../src/detail-noise.js'`

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/detail-noise.js` :

```js
// LE GRAIN FBM DU RELIEF, CUIT UNE FOIS PAR (seed, échelle, résolution).
//
// Mesuré à res 1024 : l'échantillonnage du MNT met 194 ms, dont **175 ms rien
// que pour ce bruit** (5 octaves de simplex par sommet, 1 050 625 sommets), et
// son coût est le MÊME quelle que soit son amplitude. Au réglage par défaut
// (detail 0,02) il déplace la surface de 0,19 px CSS en moyenne.
//
// ⚠️ Ce module ne cuit QUE la forme du bruit, pas son dosage. L'amplitude
// (`detail`) et l'atténuation côtière (`landFactor`, qui dépend du MNT) restent
// appliquées à la lecture — sans quoi le cache serait invalidé par le moindre
// coup de curseur, et par chaque changement de zoom (detailForZoom).
//
// UNE SEULE ENTRÉE gardée : le champ pèse 4,2 Mo à res 1024, et l'app ne montre
// jamais deux résolutions à la fois sur le bloc central.
//
// ⚠️ `size` est un PARAMÈTRE (même raison qu'à grid-template.js) : terrain.js
// importe ce module, l'import en retour ferait un cycle ESM.
import { Simplex2, mulberry32, fbm } from './noise.js'

let memo = null // { cle, champ }

export function detailField(seed, detailScale, res, size) {
  const cle = `${seed}|${detailScale}|${res}|${size}`
  if (memo && memo.cle === cle) return memo.champ
  const s = new Simplex2(mulberry32(seed))
  const n = res + 1
  const champ = new Float32Array(n * n)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    for (let ix = 0; ix < n; ix++) {
      const x = ix * seg - half
      champ[iy * n + ix] =
        fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        0.35 * fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
    }
  }
  memo = { cle, champ }
  return champ
}

/** Vide le cache — tests uniquement. */
export function clearDetailField() {
  memo = null
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/detail-noise.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Ajouter un échantillonneur de grille dans `terrain.js`**

Ajouter l'import en tête de `src/terrain.js` :

```js
import { detailField } from './detail-noise.js'
```

Puis, juste après la fin de `_makeDemSampler` (après `terrain.js:1066`), ajouter :

```js
  // ÉCHANTILLONNEUR DE GRILLE — la même formule que _makeDemSampler, mais qui
  // lit le grain FBM dans un champ pré-cuit au lieu de le recalculer.
  //
  // ⚠️ Il ne remplace PAS `this.sample` : celui-là doit rester interrogeable en
  // TOUT point (socle, bateaux, drapage GPX, étiquettes), pas seulement sur les
  // sommets de la grille. Les deux formules sont identiques ; c'est seulement
  // le chemin du grain qui change.
  // Rend null quand il n'y a rien à mémoriser (relief procédural, ou grain nul).
  _makeGridSampler(params, res) {
    if (params.source !== 'real' || !this.dem) return null
    const dem = this.dem
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    const { size } = dem
    const detail = this.mapUniforms.uColorMode.value === 1 ? Math.min(params.detail, NATURAL_DETAIL_MAX) : params.detail
    if (!(detail > 0)) {
      // grain éteint : aucun champ à cuire, la lecture du MNT suffit
      return (i, x, z) => (sampleDem(dem, (x / TERRAIN_SIZE + 0.5) * (size - 1), (z / TERRAIN_SIZE + 0.5) * (size - 1)) - meanM) * scale
    }
    const grain = detailField(params.seed, params.detailScale, res, TERRAIN_SIZE)
    return (i, x, z) => {
      const raw = sampleDem(dem, (x / TERRAIN_SIZE + 0.5) * (size - 1), (z / TERRAIN_SIZE + 0.5) * (size - 1))
      return (raw - meanM) * scale + smoothstep(0, 90, raw) * detail * grain[i]
    }
  }
```

- [ ] **Step 6: Utiliser l'échantillonneur de grille dans la boucle de `rebuild`**

Dans `src/terrain.js`, `rebuild(params)`, remplacer :

```js
    const sample = this._makeSampler(params)
    this.sample = sample

    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
```

par :

```js
    const sample = this._makeSampler(params)
    this.sample = sample
    // le grain FBM est pré-cuit sur la grille (detail-noise.js) — 175 ms sur
    // les 194 ms d'échantillonnage à res 1024. Repli sur `sample` quand il n'y
    // a rien à mémoriser (relief procédural).
    const gridSample = this._makeGridSampler(params, res)

    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = gridSample ? gridSample(i, x, z) : sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
```

- [ ] **Step 7: Écrire le test qui prouve que les deux chemins coïncident**

Ajouter à la fin de `test/detail-noise.test.js` :

```js
test('le champ pré-cuit reproduit le grain de _makeDemSampler sommet par sommet', () => {
  clearDetailField()
  const res = 24
  const n = res + 1
  const seg = TERRAIN_SIZE / res
  const half = TERRAIN_SIZE / 2
  const seed = 1
  const detailScale = 0.8
  const detail = 0.02
  const s = new Simplex2(mulberry32(seed))
  const champ = detailField(seed, detailScale, res, TERRAIN_SIZE)
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const x = ix * seg - half
      const z = iy * seg - half
      // le grain tel que _makeDemSampler le calcule, à landFactor = 1
      const direct =
        detail * fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        detail * 0.35 * fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
      assert.equal(detail * champ[iy * n + ix], direct, `sommet (${ix},${iy})`)
    }
  }
})
```

⚠️ Ce test échouera si l'implémentation factorise `detail` différemment de `_makeDemSampler`. C'est voulu : `detail·(a + 0,35·b)` et `detail·a + detail·0,35·b` ne sont **pas** bit-identiques en virgule flottante. Si le test échoue, corriger `_makeGridSampler` pour reproduire la factorisation d'origine, **pas** corriger le test.

- [ ] **Step 8: Lancer les tests**

Run: `node --test test/detail-noise.test.js`
Expected: PASS, 6 tests

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Vérifier à l'écran**

Lancer `npm run dev`, charger Chamonix z10, capturer la vue iso 1. Comparer à la capture de référence de la Task 1. **Attendu : écart RVB moyen sous 8,19/255.** Puis bouger le curseur d'exagération deux fois et vérifier que le relief se reconstruit visiblement plus vite (c'est le chemin où le gain se voit le mieux : le champ FBM n'est cuit qu'une fois).

- [ ] **Step 10: Commit**

```bash
git add src/detail-noise.js test/detail-noise.test.js src/terrain.js package.json
git commit -m "perf(terrain): grain FBM pre-cuit sur la grille

175 ms sur les 194 ms d'echantillonnage a res 1024. Le grain ne depend ni du
MNT, ni du zoom, ni de l'exageration : il survit a un changement de zoom et a
un coup de curseur. Contrepartie assumee : 4,2 Mo de cache."
```

Ajouter `test/detail-noise.test.js` au script `test` de `package.json`.

---

### Task 3 : Ne pas recuire la rugosité quand ses paramètres n'ont pas bougé

**Files:**
- Modify: `src/terrain.js:1344-1393` (`rebuildRoughness`)
- Test: `test/roughness-memo.test.js`

**Interfaces:**
- Produces: `Terrain.prototype._roughnessKey(params)` → `string`, la signature des quatre paramètres dont la rugosité dépend.

`rebuildRoughness` est appelé à chaque `regenerateTerrain()` (`main.js:1723`) et cuit une texture 512² avec 6 octaves de simplex par texel (~80 ms). Elle ne dépend que de `params.seed`, `params.roughness`, `params.roughnessVariation` et `params.roughnessScale` — **jamais du MNT ni du zoom**.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/roughness-memo.test.js` :

```js
// LA RUGOSITÉ NE DÉPEND PAS DU RELIEF.
//
// rebuildRoughness cuit une DataTexture 512² avec 6 octaves de simplex par
// texel (~80 ms) et tourne à CHAQUE regenerateTerrain() — donc à chaque
// changement de zoom, chaque coup de curseur d'exagération, chaque bascule
// Classique↔Naturel. Or elle ne lit que quatre paramètres, dont aucun n'est le
// MNT. Ce test verrouille la signature : si un cinquième paramètre entre un
// jour dans la recette, il doit entrer dans la clé, sinon la texture se fige.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const corps = src.slice(src.indexOf('  rebuildRoughness(params) {'), src.indexOf('  updateMaterial(params) {'))

test('rebuildRoughness ne lit que les quatre paramètres de la clé', () => {
  const lus = new Set([...corps.matchAll(/params\.(\w+)/g)].map((m) => m[1]))
  // bumpScale passe par _bumpScale(params), il ne change pas la TEXTURE
  lus.delete('bumpScale')
  assert.deepEqual([...lus].sort(), ['roughness', 'roughnessScale', 'roughnessVariation', 'seed'])
})

test('_roughnessKey change avec chacun des quatre paramètres', async () => {
  const { Terrain } = await import('../src/terrain.js')
  const base = { seed: 1, roughness: 0.88, roughnessVariation: 0.14, roughnessScale: 9.5 }
  const k = Terrain.prototype._roughnessKey
  const ref = k(base)
  for (const champ of ['seed', 'roughness', 'roughnessVariation', 'roughnessScale']) {
    assert.notEqual(k({ ...base, [champ]: base[champ] + 1 }), ref, `${champ} doit changer la clé`)
  }
  assert.equal(k({ ...base, demZoom: 12 }), ref, 'le zoom ne doit PAS changer la clé')
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/roughness-memo.test.js`
Expected: FAIL — `k is not a function` sur le second test (le premier doit déjà passer).

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `src/terrain.js`, juste avant `rebuildRoughness(params) {` (ligne 1344), ajouter :

```js
  // La rugosité ne dépend QUE de ces quatre paramètres — ni du MNT, ni du zoom,
  // ni de la palette. Elle était pourtant recuite (512², 6 octaves de simplex
  // par texel, ~80 ms) à chaque regenerateTerrain().
  // ⚠️ Un cinquième paramètre qui entrerait un jour dans la recette DOIT entrer
  // ici — test/roughness-memo.test.js le vérifie en lisant le corps de la
  // méthode.
  _roughnessKey(params) {
    return `${params.seed}|${params.roughness}|${params.roughnessVariation}|${params.roughnessScale}`
  }
```

Puis, dans `rebuildRoughness(params)`, après le bloc `if (this._shareSrc) { … return }` et **avant** `const size = 512`, insérer :

```js
    // déjà cuite pour exactement ces paramètres : on garde la texture en place
    // et on se contente de rafraîchir l'échelle de bump (elle, dépend du mode)
    const cle = this._roughnessKey(params)
    if (this._roughnessFor === cle && this.material.roughnessMap) {
      this.material.bumpScale = this._bumpScale(params)
      this.material.needsUpdate = true
      return
    }
```

Et, juste avant `this._pushShared()` à la fin de la méthode, ajouter :

```js
    this._roughnessFor = cle
```

⚠️ Deux invalidations obligatoires, sinon la texture se fige :
- dans `shareTexturesFrom` et `stopSharing`, poser `this._roughnessFor = null` (le partage remplace la texture) ;
- dans le chemin qui pose un matériau de relief opaque (`terrain.js:1499`, `m.roughnessMap = null`), poser `this._roughnessFor = null`.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/roughness-memo.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Vérifier les chemins d'invalidation à l'écran**

Lancer `npm run dev`. Enchaîner : (a) changer de zoom → la rugosité doit être **identique**, la reconstruction plus rapide ; (b) bouger le curseur « Rugosité » du panneau Terrain → la texture **doit** changer ; (c) poser un matériau de relief (bois), puis revenir à la carte → la rugosité procédurale **doit** revenir. Si (c) rend un relief lisse ou noir, l'invalidation du chemin matériau manque.

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/terrain.js test/roughness-memo.test.js package.json
git commit -m "perf(terrain): ne pas recuire la rugosite quand ses parametres n'ont pas bouge

~80 ms par regenerateTerrain (512^2, 6 octaves de simplex par texel). La
rugosite ne depend ni du MNT ni du zoom : elle etait recuite pour rien a chaque
changement de zoom et a chaque coup de curseur d'exageration."
```

---

## Phase 2 — Les formats de masque · −27 Mo, sans qu'un pixel bouge

Trois masques d'un seul bit rangés dans quatre octets. Le shader ne lit que `.r` (`terrain.js:460` et `terrain.js:495`) et **tous** les consommateurs processeur n'indexent que le canal 0.

### Task 4 : Masque côtier en R8

**Files:**
- Modify: `src/coast-mask.js:122-156` (`rasterize`), `src/coast-mask.js:217`
- Test: `test/coast-mask.test.js` (fichier existant — ajouter les cas)

Cette task ne touche **que** `coast-mask.js` : le canevas continue de sortir, donc `main.js` et `block-grid.js` fonctionnent sans modification (ils font toujours leur `getImageData`). C'est la Task 5 qui les bascule.

**Interfaces:**
- Produces: `fetchCoastMask(...)` renvoie désormais `{ maskTexture, maskCanvas, maskR8: Uint8Array, source }`. `maskR8` a `size²` octets, valeur = canal rouge du canevas flouté. `maskTexture` est une `DataTexture` `RedFormat` bâtie sur ce même tableau.
- ⚠️ `maskCanvas` **reste exposé** : `region-skirt.js` (`maskSampler`) et `main.js:3485` le lisent encore. Cette task ne le retire pas.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `test/coast-mask.test.js` :

```js
// LE MASQUE CÔTIER EST UN BIT, PAS QUATRE OCTETS.
//
// 2048² en RGBA = 16,00 Mo de texture, alors que le shader ne lit que `.r`
// (terrain.js:495) et que tous les consommateurs processeur n'indexent que le
// canal 0. En R8 : 4,00 Mo. −12 Mo sur le bloc central, zéro changement à
// l'image — le canal rouge est bit pour bit le même.
import { channelR } from '../src/coast-mask.js'

test('channelR extrait le canal rouge et divise la taille par quatre', () => {
  const rgba = new Uint8ClampedArray([10, 99, 99, 255, 20, 99, 99, 255, 30, 99, 99, 255, 40, 99, 99, 255])
  const r = channelR(rgba)
  assert.equal(r.length, 4)
  assert.deepEqual([...r], [10, 20, 30, 40])
  assert.ok(r instanceof Uint8Array)
})

test('channelR sur un tableau vide rend un tableau vide', () => {
  assert.equal(channelR(new Uint8ClampedArray(0)).length, 0)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/coast-mask.test.js`
Expected: FAIL — `channelR is not a function`

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `src/coast-mask.js`, ajouter avant `function rasterize` :

```js
/**
 * Canal rouge d'un tampon RGBA → Uint8Array mono-canal.
 *
 * Le masque côtier est un champ d'UN BIT (terre/mer), adouci par un flou pour
 * que l'iso-0,5 du shader coupe net. Le garder en RGBA coûte **quatre fois** la
 * mémoire nécessaire : 16,00 Mo pour un 2048², contre 4,00 Mo en R8. Le shader
 * ne lit que `.r` (terrain.js:495) et un sampler `RedFormat` rend `(r, 0, 0, 1)`
 * — le `.r` du shader est donc bit pour bit le même.
 */
export function channelR(rgba) {
  const n = rgba.length >> 2
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = rgba[i * 4]
  return out
}
```

Puis, dans `rasterize`, remplacer le bloc de création de texture (de `const tex = new THREE.CanvasTexture(canvas)` à `return { texture: tex, canvas }`) par :

```js
  // R8 au lieu de RGBA : −12 Mo sur un 2048². Le tableau sort AUSSI, pour que
  // les consommateurs processeur lisent le même octet que la carte graphique
  // sans repasser par un getImageData (main.js en faisait un second).
  const maskR8 = channelR(bctx.getImageData(0, 0, size, size).data)
  const tex = new THREE.DataTexture(maskR8, size, size, THREE.RedFormat)
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  // le canevas ressort encore : region-skirt.js (maskSampler) le lit toujours
  return { texture: tex, canvas, maskR8 }
```

Et à la ligne 217, propager `maskR8` :

```js
    return { maskTexture: texture, maskCanvas: canvas, maskR8, source: zoom <= COAST_NE_MAX ? 'ne' : 'osm' }
```

(en déstructurant `maskR8` du retour de `rasterize` au point d'appel).

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/coast-mask.test.js`
Expected: PASS

- [ ] **Step 5: Vérifier à l'écran**

Lancer `npm run dev`, charger une côte franche : **Bassin d'Arcachon (44,66 / −1,16, z12)**. Vérifier que (a) le trait de côte est dessiné, (b) la mer s'arrête au bon endroit, (c) la houle (`ocean.js`) s'arrête au même endroit que la peinture. Puis charger **les Pays-Bas (52,3 / 4,9, z11)** et vérifier que les polders sous le niveau 0 restent **terre** — c'est le cas que le masque existe pour traiter.

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/coast-mask.js test/coast-mask.test.js
git commit -m "perf(coast-mask): masque cotier en R8 au lieu de RGBA

-12 Mo sur le bloc central (16,00 -> 4,00 Mo pour un 2048^2). Le shader ne lit
que .r : un sampler RedFormat rend (r,0,0,1), le .r est bit pour bit le meme."
```

---

### Task 5 : `ImageData` du masque côtier en mono-canal

**Files:**
- Modify: `src/main.js:1650-1656`, `src/main.js:3653`, `src/main.js:3662`, `src/main.js:3675`
- Modify: `src/terrain.js:958-980` (`setCoastMask`), `src/terrain.js:1207-1214`
- Modify: `src/sea-mask.js` (`landMaskFromImage`), `src/region-mask.js:377-388`, `src/ocean.js:721` et `src/ocean.js:1061-1069`
- Modify: `src/block-grid.js:521-526`
- Test: `test/sea-mask.test.js`, `test/region-mask.test.js` (fichiers existants)

**Interfaces:**
- Le contrat de `coastImage` change : au lieu d'un `ImageData` (`{ width, height, data: Uint8ClampedArray }` indexé `data[i*4]`), les consommateurs reçoivent `{ width, height, data: Uint8Array }` indexé `data[i]`.

**−12 Mo côté processeur.** C'est un remplacement mécanique de `data[k * 4]` par `data[k]` en cinq points, mais il touche cinq fichiers : à faire d'un bloc, et **après** la Task 4 qui produit déjà le `Uint8Array`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `test/sea-mask.test.js`, ajouter :

```js
// LE MASQUE CÔTIER CÔTÉ PROCESSEUR EST MONO-CANAL.
//
// L'ImageData 2048² RGBA du masque pesait 16,00 Mo dans le tas JS, EN PLUS des
// 16,00 Mo de texture. Aucun consommateur ne lit autre chose que le canal 0
// (region-mask.js:386, ocean.js:721, sea-mask.js landMaskFromImage). En
// Uint8Array : 4,00 Mo. −12 Mo, zéro changement à l'image.
test('landMaskFromImage lit un masque mono-canal', () => {
  const img = { width: 4, height: 4, data: new Uint8Array(16).fill(255) }
  img.data[0] = 0 // un coin en mer
  const mask = landMaskFromImage(img, 4)
  assert.equal(mask.length, 16)
  assert.equal(mask[0], 0)
  assert.equal(mask[15], 255) // ⚠️ landMaskFromImage rend 255/0, pas 1/0
})
```

Dans `test/region-mask.test.js`, ajouter :

```js
test('rasterizeMask lit un coastImage mono-canal', () => {
  // un coastImage tout blanc = tout est terre : aucun pixel bas ne doit être
  // retiré de la découpe
  const coast = { width: 8, height: 8, data: new Uint8Array(64).fill(255) }
  const dem = { size: 8, data: new Float32Array(64).fill(-5) } // tout sous 0
  const carre = [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
  const r = rasterizeMask(carre, { ...dem, zoom: 0, originTileX: 0, originTileY: 0, tilePx: 8 }, 8, coast)
  assert.ok(r.canvas || r.uniform, 'la découpe doit survivre : le trait de côte dit terre')
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test test/sea-mask.test.js test/region-mask.test.js`
Expected: FAIL — `landMaskFromImage` lit `data[i*4]` et rendra 0 partout ; le second cas retirera les pixels bas.

- [ ] **Step 3: Basculer les cinq lectures**

**1.** `src/sea-mask.js:82`, remplacer :

```js
      out[y * size + x] = data[(row + px) * 4] > 127 ? 255 : 0
```

par :

```js
      // mono-canal (Task 5) : le masque côtier n'a plus qu'un octet par pixel
      out[y * size + x] = data[row + px] > 127 ? 255 : 0
```

**2.** `src/region-mask.js:386`, remplacer :

```js
          if (coastImage && coastImage.data[(cRow + Math.min(cw - 1, ((x * cw) / size) | 0)) * 4] > 127) continue
```

par :

```js
          if (coastImage && coastImage.data[cRow + Math.min(cw - 1, ((x * cw) / size) | 0)] > 127) continue
```

**3.** `src/ocean.js:725`, remplacer :

```js
          return cd.data[(py * cd.width + px) * 4] > 127
```

par :

```js
          return cd.data[py * cd.width + px] > 127
```

**4.** `src/main.js:1650-1656`, remplacer :

```js
          const img = res.maskCanvas
            ? res.maskCanvas.getContext('2d').getImageData(0, 0, res.maskCanvas.width, res.maskCanvas.height)
            : null
```

par :

```js
          // Task 4 : coast-mask.js sort déjà le canal rouge en Uint8Array —
          // plus de second getImageData, et 12 Mo de moins dans le tas.
          const img = res.maskR8
            ? { width: res.maskCanvas.width, height: res.maskCanvas.height, data: res.maskR8 }
            : null
```

**5.** `src/block-grid.js:523-524`, remplacer :

```js
          const cv = res.maskCanvas
          const img = cv ? cv.getContext('2d').getImageData(0, 0, cv.width, cv.height) : null
```

par :

```js
          // mono-canal (Task 5) : une voisine est en NEIGHBOUR_COAST_SIZE
          // (1024²), donc 1,00 Mo au lieu de 4,00 — soit −3 Mo par dalle, −72 Mo
          // sur un damier plein. Et un getImageData de moins par dalle.
          const cv = res.maskCanvas
          const img = res.maskR8 && cv ? { width: cv.width, height: cv.height, data: res.maskR8 } : null
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `node --test test/sea-mask.test.js test/region-mask.test.js`
Expected: PASS

- [ ] **Step 5: Vérifier à l'écran, sur les trois consommateurs**

Lancer `npm run dev` :
- **Pays-Bas (52,3 / 4,9, z11)** puis « individualiser la zone » → les polders sous 0 doivent rester dans la découpe (consommateur `region-mask`).
- **Bassin d'Arcachon (44,66 / −1,16, z12)** → la houle doit s'arrêter au trait de côte (consommateur `ocean`).
- **N'importe quelle côte à z12** → aucun lac fantôme à l'intérieur des terres (consommateur `sea-mask`).

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/terrain.js src/sea-mask.js src/region-mask.js src/ocean.js src/block-grid.js test/sea-mask.test.js test/region-mask.test.js
git commit -m "perf(coast-mask): masque cotier mono-canal cote processeur

-12 Mo de tas JS sur le bloc central, et un getImageData 2048^2 de moins par
chargement. Aucun consommateur ne lisait autre chose que le canal 0."
```

---

### Task 6 : Masque de découpe de zone en R8

**Files:**
- Modify: `src/region-mask.js:400-415`
- Test: `test/region-mask.test.js`

Même geste que la Task 4, sur `uRegionMask` 1024² : **4,00 → 1,00 Mo**. Le shader ne lit que `.r` (`terrain.js:460`).

⚠️ `region-skirt.js` lit le **canevas** (`maskSampler`, `region-skirt.js:22-24`), pas la texture : le canevas doit continuer de sortir. Et `terrain.setRegionMask` extrait un `ImageData` du canevas (`terrain.js:899-904`) — le passer au `Uint8Array` fait gagner 3 Mo de plus, mais **vérifier d'abord qui lit `_regionImage`** avant de changer son indexation.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `test/region-mask.test.js` :

```js
// LA DÉCOUPE DE ZONE AUSSI EST UN BIT.
//
// 1024² RGBA = 4,00 Mo ; en R8, 1,00 Mo. Le shader ne lit que `.r`
// (terrain.js:460).
//
// ⚠️ `maskUniformity` N'EST PAS TOUCHÉE. Elle tourne AVANT le flou, sur
// l'ImageData RGBA du canevas net (region-mask.js:390), et le chemin uniforme
// sort de la fonction sans jamais créer de texture (rapport damier, T7). Seule
// la texture finale change de format. Ce test le verrouille par lecture du
// source — la rastérisation a besoin d'un `document`, indisponible en node.
import fs from 'node:fs'

test('la texture de découpe est une DataTexture RedFormat, pas une CanvasTexture', () => {
  const src = fs.readFileSync(new URL('../src/region-mask.js', import.meta.url), 'utf8')
  assert.ok(src.includes('THREE.RedFormat'), 'la texture doit être en RedFormat')
  assert.ok(!/new THREE\.CanvasTexture/.test(src), 'plus aucune CanvasTexture dans region-mask.js')
})

test('maskUniformity garde son pas de 4 : elle lit le canevas RGBA d’avant le flou', () => {
  const rgba = new Uint8ClampedArray(64).fill(255)
  assert.equal(maskUniformity(rgba), 'full')
  rgba.fill(0)
  assert.equal(maskUniformity(rgba), 'empty')
  rgba[8] = 255
  assert.equal(maskUniformity(rgba), null)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/region-mask.test.js`
Expected: FAIL sur le premier test — `region-mask.js` crée encore une `CanvasTexture`. Le second doit **déjà passer** : c'est un garde-fou, pas un objectif.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `src/region-mask.js`, ajouter l'import :

```js
import { channelR } from './coast-mask.js'
```

puis remplacer le bloc de création de texture (`region-mask.js:407-415`, de `const tex = new THREE.CanvasTexture(canvas)` jusqu'au `return`) par :

```js
  // R8 au lieu de RGBA : 4,00 → 1,00 Mo pour un 1024². Le shader ne lit que
  // `.r` (terrain.js:460) et un sampler RedFormat rend (r, 0, 0, 1).
  // ⚠️ Le canevas ressort toujours : region-skirt.js (maskSampler) le lit pour
  // tracer la jupe de découpe, et main.js:3485 le lui passe tel quel.
  const maskR8 = channelR(bctx.getImageData(0, 0, size, size).data)
  const tex = new THREE.DataTexture(maskR8, size, size, THREE.RedFormat)
  // no flip: canvas row 0 (north) must stay at v=0 because the shader builds
  // v from world +z (south) growing downward, same convention as the DEM
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return { texture: tex, canvas, maskR8, uniform: null }
```

⚠️ `terrain.setRegionMask` (`terrain.js:899-904`) lit `texture.image` en supposant que c'est un canevas (`cv.width`, `drawImage`). Avec une `DataTexture`, `texture.image` devient `{ data, width, height }` — **`drawImage` échouerait**. Faire passer le canevas explicitement : `setRegionMask(texture, canvas)` et utiliser ce second argument pour le `_regionImage`.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/region-mask.test.js`
Expected: PASS

- [ ] **Step 5: Vérifier à l'écran**

`npm run dev`, chercher « Le Var », cliquer « individualiser la zone ». Vérifier : le contour de découpe est **net** (pas escalier), la jupe de découpe suit exactement le contour, et le bord est **adouci** comme avant (le flou de 1,5 px doit survivre). Comparer à une capture prise avant la task.

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/region-mask.js test/region-mask.test.js
git commit -m "perf(region-mask): masque de decoupe en R8 au lieu de RGBA

-3 Mo par bloc (4,00 -> 1,00 Mo pour un 1024^2). Le shader ne lit que .r."
```

---

## Phase 3 — Les attributs de géométrie · −23 Mo, à prouver à l'écran

⚠️ **Cette phase n'est PAS bit-identique.** Chaque task porte sa propre preuve visuelle et doit être présentée à Adrien avant d'aller à la suivante. À faire seulement si les phases 1, 2 et 4 n'ont pas suffi.

### Task 7 : Dériver `uv` de la position dans le shader

**Files:**
- Modify: `src/terrain.js:251-828` (`onBeforeCompile`), `src/terrain.js:1130-1197` (`rebuild`)
- Test: aucun test unitaire possible (GLSL) — vérification à l'écran uniquement

**−8,02 Mo par bloc.** `uv` est une fonction **linéaire exacte** de `position.xz` : `uv = (position.x/56 + 0,5, 1 − (position.z/56 + 0,5))`. Elle n'est lue que par `roughnessMap` et `bumpMap` (et par les matériaux de relief opaques), toutes en `RepeatWrapping`.

**Risque visuel : faible mais réel.** Les `repeat` de three.js sont appliqués par `uv_vertex` via `mapTransform` ; il faut réinjecter la même transformation. Une erreur se verrait comme un décalage ou un changement d'échelle de la micro-texture — pas comme un artefact, mais Adrien le verrait.

- [ ] **Step 1: Capturer la référence**

`npm run dev`, Chamonix z10, **caméra au plus près** (`controls.minDistance = 6`) pour que la micro-texture de rugosité remplisse l'écran. Capture nommée `avant-uv.png`.

- [ ] **Step 2: Injecter le calcul de `uv` dans le vertex shader**

Dans `onBeforeCompile`, ajouter un troisième `.replace()` sur le vertex shader, avant `#include <uv_vertex>` :

```js
        .replace(
          '#include <uv_vertex>',
          `// uv DÉRIVÉ de la position : l'attribut pesait 8,02 Mo par bloc pour
// une fonction linéaire exacte de position.xz. Même formule que
// PlaneGeometry : u = ix/gridX, v = 1 − iy/gridY, avec x = ix·seg − 28 et
// z = iy·seg − 28.
vec2 uv = vec2(position.x / ${TERRAIN_SIZE.toFixed(1)} + 0.5, 0.5 - position.z / ${TERRAIN_SIZE.toFixed(1)});
#include <uv_vertex>`
        )
```

⚠️ Si three.js r172 déclare déjà `attribute vec2 uv;` dans le préambule, la redéclaration échouera à la compilation. Le cas échéant, garder l'attribut mais le remplir depuis le gabarit **partagé** (Task 1) plutôt qu'une copie : le gain devient alors « une seule copie de 8,02 Mo pour tous les blocs » au lieu de zéro, ce qui reste 8,02 Mo × 24 sur un damier plein.

- [ ] **Step 3: Retirer l'attribut de `rebuild`**

Dans `rebuild(params)`, supprimer la ligne `geo.setAttribute('uv', …)` ajoutée par la Task 1.

- [ ] **Step 4: Vérifier à l'écran**

Reprendre exactement le même cadrage qu'au Step 1. Capture `apres-uv.png`. **Attendu : écart RVB moyen sous 8,19/255.** Vérifier en plus : poser un matériau de relief **bois** (le plus lisible en tuilage) et confirmer que la densité et l'orientation des veines n'ont pas changé.

Si l'écart dépasse le seuil, **annuler la task** : 8 Mo ne valent pas un changement de tuilage sur le héros.

- [ ] **Step 5: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/terrain.js
git commit -m "perf(terrain): uv derive de la position dans le vertex shader

-8,02 Mo par bloc. uv etait une fonction lineaire exacte de position.xz."
```

---

### Task 8 : Normales en `Int16` normalisé

**Files:**
- Modify: `src/terrain.js:1130-1197` (`rebuild`)
- Test: `test/normales-int16.test.js`

**−6,01 Mo par bloc.** `computeVertexNormals` produit des `Float32`. Une normale unitaire tient sans perte visible dans du `Int16` normalisé : le pas est `1/32767 = 3,1·10⁻⁵`, soit un écart angulaire maximal de **0,0025°** — deux ordres de grandeur sous l'écart de 0,996° qui a fait écarter les différences centrées.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/normales-int16.test.js` :

```js
// LES NORMALES TIENNENT DANS DU INT16 SANS QUE ÇA SE VOIE.
//
// 12,02 Mo par bloc en Float32 ; 6,01 Mo en Int16 normalisé. Le pas de
// quantification est 1/32767 = 3,1e-5, soit 0,0025° d'écart angulaire au pire.
// Pour comparaison, remplacer computeVertexNormals par des différences
// centrées donnait 0,996° d'écart MOYEN — c'est 400 fois plus, et c'est pour
// ça que cette piste-là a été écartée et pas celle-ci.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quantizeNormals } from '../src/terrain.js'

test('quantizeNormals garde la direction à 0,01° près', () => {
  const n = 2000
  const f32 = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const b = ((i * 7) / n) * Math.PI
    const v = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]
    f32.set(v, i * 3)
  }
  const i16 = quantizeNormals(f32)
  assert.ok(i16 instanceof Int16Array)
  assert.equal(i16.length, f32.length)
  let maxDeg = 0
  for (let i = 0; i < n; i++) {
    const d =
      (i16[i * 3] / 32767) * f32[i * 3] +
      (i16[i * 3 + 1] / 32767) * f32[i * 3 + 1] +
      (i16[i * 3 + 2] / 32767) * f32[i * 3 + 2]
    const deg = (Math.acos(Math.min(1, Math.max(-1, d))) * 180) / Math.PI
    if (deg > maxDeg) maxDeg = deg
  }
  assert.ok(maxDeg < 0.01, `écart max ${maxDeg.toFixed(4)}° doit rester sous 0,01°`)
})

test('quantizeNormals sature proprement à ±1', () => {
  const i16 = quantizeNormals(new Float32Array([0, 1, 0, 0, -1, 0]))
  assert.equal(i16[1], 32767)
  assert.equal(i16[4], -32767)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/normales-int16.test.js`
Expected: FAIL — `quantizeNormals is not exported`

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `src/terrain.js`, ajouter au niveau module (près de `blackTexture`) :

```js
// Normale unitaire → Int16 normalisé. 12,02 Mo → 6,01 Mo par bloc à res 1024.
// Le pas de 1/32767 vaut 0,0025° d'écart angulaire au pire — c'est 400 fois
// moins que l'écart de 0,996° qui a fait écarter les normales par différences
// centrées, et c'est pour ça que ce compromis-ci est acceptable.
// ⚠️ −32767 et non −32768 : la conversion GL des SNORM mappe −32768 sur −1
// comme −32767, la borne symétrique évite un cas particulier de pilote.
export function quantizeNormals(f32) {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    const v = f32[i]
    out[i] = Math.max(-32767, Math.min(32767, Math.round(v * 32767)))
  }
  return out
}
```

Puis, dans `rebuild(params)`, juste après `geo.computeVertexNormals()` :

```js
    // les normales passent en Int16 normalisé : −6,01 Mo à res 1024.
    // ⚠️ `normalized: true` est indispensable — sans lui le shader lirait des
    // entiers bruts et la carte serait noire.
    const nq = quantizeNormals(geo.attributes.normal.array)
    geo.setAttribute('normal', new THREE.BufferAttribute(nq, 3, true))
```

⚠️ La boucle des couleurs lit `geo.attributes.normal.array` juste après (`terrain.js:1156`) : elle doit lire les **Float32 d'origine** (garder une référence avant la substitution), sinon les couleurs de sommet seront calculées sur des entiers bruts.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/normales-int16.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Vérifier à l'écran**

`npm run dev`, Chamonix z10, vue iso 1. Capture. **Attendu : écart RVB moyen sous 8,19/255.** Puis passer en **mode Classique** avec `slopeTint` à fond et un soleil rasant (`timeOfDay` ≈ 7) : c'est le réglage où une erreur de normale se voit le plus. Vérifier enfin que le **verre** (`transmission` > 0) et le **métal liquide** rendent normalement — ce sont les deux modes qui dépendent le plus des normales.

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/terrain.js test/normales-int16.test.js package.json
git commit -m "perf(terrain): normales en Int16 normalise

-6,01 Mo par bloc a res 1024. Ecart angulaire max 0,0025 degre, mesure."
```

---

### Task 9 : Couleurs de sommet en `Uint8` normalisé

**Files:**
- Modify: `src/terrain.js:1153-1170` (`rebuild`)
- Test: aucun — vérification à l'écran uniquement

**−9,02 Mo par bloc.** L'attribut `color` range **trois flottants identiques** par sommet (`colors[i*3] = colors[i*3+1] = colors[i*3+2] = v`).

⚠️ **RISQUE VISUEL RÉEL, à signaler tel quel.** La valeur `v` est un dégradé lisse sur toute la surface ; quantifiée à 8 bits, elle avance par pas de 1/255. Ce `v` alimente `fxShade = clamp(luma × 2,4, 0,2, 1,4)`, donc **un pas de 1/255 devient ~1 % de luminosité**. Sur un dégradé doux et une grande surface, 1 % est autour du seuil de perception : **des bandes sont possibles**. Cette task doit être présentée à Adrien avec une capture avant/après en dégradé, et **abandonnée sans discussion** s'il voit quoi que ce soit.

- [ ] **Step 1: Capturer la référence sur le pire cas**

`npm run dev`, charger le **Bassin d'Arcachon (44,66 / −1,16, z12)** — un relief presque plat, donc un `v` presque uniforme : c'est là que le banding se verrait. Vue iso 5 (vue du dessus). Capture `avant-color8.png`.

- [ ] **Step 2: Basculer l'attribut en `Uint8`**

Dans `rebuild(params)`, remplacer :

```js
    const colors = new Float32Array(count * 3)
```

par :

```js
    // 8 bits au lieu de 32 : −9,02 Mo à res 1024, pour trois valeurs IDENTIQUES
    // par sommet (r = g = b). ⚠️ Le pas de 1/255 traverse
    // `fxShade = clamp(luma·2.4, 0.2, 1.4)` et devient ~1 % de luminosité — au
    // seuil de perception sur un dégradé doux. Le pire cas est un relief plat
    // (Arcachon vu du dessus) : c'est là qu'il faut regarder.
    const colors = new Uint8Array(count * 3)
```

et, dans la boucle, remplacer `colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v` par :

```js
      const q = Math.max(0, Math.min(255, Math.round(v * 255)))
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = q
```

et l'appel `setAttribute` par :

```js
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))
```

- [ ] **Step 3: Vérifier à l'écran, sur le pire cas puis sur le héros**

Reprendre exactement le cadrage du Step 1. Capture `apres-color8.png`. **Regarder à l'œil nu, pas seulement à la différence RVB** : le banding est une structure, il peut rester sous 8,19/255 de moyenne tout en se voyant.

Puis Chamonix z10, vue iso 1, écart RVB moyen sous 8,19/255.

**Si des bandes apparaissent sur Arcachon, annuler la task et écrire l'observation dans ce plan.** L'alternative (calculer `v` dans le vertex shader depuis `position.y`, `normal.y` et `uHeightRange`) supprimerait l'attribut ET la boucle de 41 ms, mais remplacerait le grain FBM de teinte (`terrain.js:1167`, amplitude 0,05 sur `v`, soit 12 % de luminosité) par un bruit GLSL différent — un changement de matière, pas de format. C'est un autre chantier, à ouvrir avec Adrien.

- [ ] **Step 4: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/terrain.js
git commit -m "perf(terrain): couleurs de sommet en Uint8 normalise

-9,02 Mo par bloc a res 1024. Trois flottants identiques par sommet devenaient
trois octets. Banding verifie a l'ecran sur relief plat (Arcachon vu du haut)."
```

---

## Phase 4 — Sortir du fil principal · ~526 ms de gel en moins, sans qu'un pixel bouge

Le calcul reste identique — c'est **le gel** qui disparaît. `terrain-analysis.js` et `sea-mask.js` sont des **modules purs** (ni DOM, ni three.js), déjà testés en Node : ce sont les deux seuls candidats propres à un Worker dans tout ce chemin.

### Task 10 : Analyse de relief et masque de mer dans un Worker

**Files:**
- Create: `src/terrain-worker.js`
- Create: `src/terrain-jobs.js`
- Modify: `src/terrain.js:1177-1193` (`rebuild`), `src/terrain.js:1201-1266` (`_buildSeaMask`, `_buildAnalysis`)
- Test: `test/terrain-jobs.test.js`

**Interfaces:**
- Produces: `runTerrainJob({ data, size, metersPerPixel, maxSize, landMask })` → `Promise<{ analysis: Uint8Array, analysisSize: number, sea: Uint8Array, seaSize: number }>`. Le `Float32Array` du MNT est **copié**, pas transféré (le processeur principal en a besoin pour les bateaux et la jupe). Les deux `Uint8Array` de retour sont **transférés**.
- Produces: `cancelTerrainJobs()` — abandonne les résultats en vol (changement de zoom).

⚠️ **Le terrain doit rester affichable pendant le calcul.** Les placeholders existent déjà et sont neutres par construction : `neutralTexture()` (128,128,128,255 — « courbure nulle, ni creux ni bosse, aucune exposition », `terrain.js:62-70`) et `uAnalysisOn = 0`. Le relief s'affiche donc **sans le peigné**, puis le peigné arrive. **C'est un changement d'image en cours de route** — exactement ce que le §4 déconseille. Deux garde-fous obligatoires :
1. **Le voile de chargement ne se retire qu'après l'arrivée de l'analyse** (`regenerateTerrain` attend la promesse). Le gain est alors *zéro pour l'utilisateur au premier chargement* — mais l'onglet reste **réactif** (la caméra tourne, l'interface répond), au lieu de geler 526 ms.
2. En mode Classique, `_buildAnalysis` ne tourne pas du tout : rien ne change.

Si un jour on veut le gain *perçu*, c'est un fondu de `uAnalysisOn` de 0 à 1 sur 300 ms — un fondu de **peinture**, pas de géométrie. À proposer à Adrien séparément.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/terrain-jobs.test.js` :

```js
// L'ANALYSE ET LE MASQUE DE MER SORTENT DU FIL PRINCIPAL.
//
// Mesuré sur MNT réel 1536² (Chamonix, AWS terrarium z13 6×6) :
//   analyzeDem sans plafond   470 ms
//   buildSeaMask + blurMask    56 ms
// = 526 ms de fil principal bloqué à chaque chargement en mode Naturel. Ce sont
// les deux SEULS modules purs du chemin (ni DOM, ni three.js), donc les deux
// seuls candidats propres à un Worker.
//
// Ce test ne lance pas de Worker (node:test n'en a pas besoin) : il verrouille
// que le calcul déporté rend EXACTEMENT ce que rendait le calcul en ligne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeDem } from '../src/terrain-analysis.js'
import { buildSeaMask, blurMask } from '../src/sea-mask.js'
import { computeTerrainJob } from '../src/terrain-jobs.js'

function demJouet() {
  const size = 64
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = 300 * Math.sin(x / 9) * Math.cos(y / 7) - 40
  return { data, size, metersPerPixel: 13.3 }
}

test('computeTerrainJob rend exactement analyzeDem et buildSeaMask', () => {
  const dem = demJouet()
  const attenduA = analyzeDem(dem, { maxSize: 0 })
  const attenduM = blurMask(buildSeaMask(dem), 1)
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 0, landMask: null })
  assert.equal(got.analysisSize, attenduA.size)
  assert.deepEqual([...got.analysis], [...attenduA.rgba])
  assert.equal(got.seaSize, attenduM.size)
  assert.deepEqual([...got.sea], [...attenduM.mask])
})

test('computeTerrainJob respecte le plafond d\'analyse des dalles voisines', () => {
  const dem = demJouet()
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 32, landMask: null })
  assert.equal(got.analysisSize, 32)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test test/terrain-jobs.test.js`
Expected: FAIL — `Cannot find module '../src/terrain-jobs.js'`

- [ ] **Step 3: Écrire le calcul, séparé du transport**

Créer `src/terrain-jobs.js` :

```js
// LE CALCUL DÉPORTÉ, SÉPARÉ DE SON TRANSPORT.
//
// `computeTerrainJob` est PUR : c'est exactement ce que faisaient
// `_buildAnalysis` et `_buildSeaMask` en ligne, et test/terrain-jobs.test.js
// verrouille l'égalité octet pour octet. Le Worker (terrain-worker.js) ne fait
// que l'appeler ; le fil principal peut aussi l'appeler directement en repli
// (navigateur sans Worker, ou test).
//
// Mesuré sur MNT réel 1536² : 470 ms d'analyse + 56 ms de masque de mer =
// 526 ms de fil principal, à chaque chargement en mode Naturel.
import { analyzeDem } from './terrain-analysis.js'
import { buildSeaMask, blurMask } from './sea-mask.js'

export function computeTerrainJob({ data, size, metersPerPixel, maxSize = 0, landMask = null }) {
  const dem = { data, size, metersPerPixel }
  const a = analyzeDem(dem, { maxSize })
  const m = blurMask(buildSeaMask(dem, { landMask }), 1)
  return { analysis: a.rgba, analysisSize: a.size, sea: m.mask, seaSize: m.size }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test test/terrain-jobs.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Écrire le Worker et son ordonnanceur**

Créer `src/terrain-worker.js` :

```js
// Worker de terrain — il n'a qu'un seul travail, et il est pur.
import { computeTerrainJob } from './terrain-jobs.js'

self.onmessage = (e) => {
  const { id, ...job } = e.data
  const r = computeTerrainJob(job)
  self.postMessage({ id, ...r }, [r.analysis.buffer, r.sea.buffer])
}
```

Ajouter à `src/terrain-jobs.js` l'ordonnanceur côté fil principal :

```js
// ------------------------------------------------------ transport (navigateur)
// Un seul Worker, un seul travail en vol : le bloc central ne charge qu'un MNT
// à la fois, et un damier sérialise déjà ses dalles.
// ⚠️ Le MNT est COPIÉ, jamais transféré : le fil principal en a besoin pour la
// veille des bateaux, le tracé de la jupe et l'orographie des nuages.
let worker = null
let sequence = 0
const enVol = new Map()

export function runTerrainJob(job) {
  if (typeof Worker === 'undefined') return Promise.resolve(computeTerrainJob(job))
  if (!worker) {
    worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, ...r } = e.data
      const attente = enVol.get(id)
      enVol.delete(id)
      attente?.(r)
    }
  }
  const id = ++sequence
  return new Promise((resolve) => {
    enVol.set(id, resolve)
    worker.postMessage({ id, ...job, data: job.data.slice() })
  })
}

/** Abandonne les résultats en vol — changement de zoom, destruction du damier. */
export function cancelTerrainJobs() {
  enVol.clear()
}
```

- [ ] **Step 6: Brancher dans `Terrain.rebuild`**

Dans `src/terrain.js`, remplacer les appels synchrones `this._buildSeaMask()` et `this._buildAnalysis()` (`terrain.js:1187-1188`) par un appel unique qui rend une promesse, et faire de `rebuild` une méthode qui expose `this.fieldsReady` (une `Promise`). Dans `main.js:1722`, attendre cette promesse avant `hideLoading()` :

```js
      terrain.rebuild(params)
      // … le reste de regenerateTerrain, inchangé …
      terrain.fieldsReady.then(() => {
        rebuildPending = false
        hideLoading()
        resolve()
      })
```

⚠️ Conserver `_buildAnalysis` et `_buildSeaMask` comme chemins de repli synchrones : `runTerrainJob` y retombe quand `Worker` n'existe pas, et les tests existants les appellent.

⚠️ Conserver la mémoïsation `this._analysisFor === dem` (`terrain.js:1241`) **avant** de lancer le travail : sinon un `setColorMode` relancerait le Worker pour rien.

- [ ] **Step 7: Vérifier à l'écran**

`npm run dev`, Chamonix z10 en mode Naturel. Vérifier : (a) le peigné des crêtes est présent et identique à la référence de la Task 1 ; (b) **pendant le chargement, la caméra répond au glissement de souris** — c'est tout le bénéfice ; (c) le voile de chargement ne se retire qu'une fois la carte complète ; (d) changer de zoom deux fois rapidement ne laisse pas une analyse périmée s'appliquer au nouveau relief.

Vérifier aussi le **damier** : charger un GPX qui déborde, à z12, et confirmer que les dalles voisines gardent leur analyse plafonnée à `NEIGHBOUR_ANALYSIS_SIZE` (768).

- [ ] **Step 8: Lancer toute la suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/terrain-worker.js src/terrain-jobs.js test/terrain-jobs.test.js src/terrain.js src/main.js package.json
git commit -m "perf(terrain): analyse de relief et masque de mer dans un Worker

526 ms de fil principal libérés par chargement en mode Naturel (470 ms
d'analyse + 56 ms de masque, mesures sur MNT reel 1536^2). Le calcul est
identique octet pour octet, verrouille par test. Le voile de chargement
attend toujours le resultat : c'est la reactivite de l'onglet qu'on gagne,
pas une carte qui se corrige sous les yeux."
```

---

## Phase 5 — L'horizon : le modèle Mapbox

### Task 11 : Déplacer le relief dans le vertex shader depuis une texture de MNT

**Ce n'est pas une task exécutable en l'état** — c'est le chantier à ouvrir si les phases 1 à 4 ne suffisent pas, et il mérite sa propre séance de conception. Je le décris parce que c'est ce que fait l'industrie et parce que **c'est la seule voie qui rende la résolution du maillage gratuite**.

**Le principe** (Mapbox GL JS, `src/terrain/terrain.ts`) : la géométrie n'est plus déplacée par le processeur. Une **grille plate unique** est partagée par tous les blocs (`this.gridBuffer`, un seul VBO), et chaque bloc porte sa **texture de MNT** ; le vertex shader lit la hauteur et déplace le sommet.

**Ce que ça rendrait, chiffré à partir des mesures de ce rapport :**

| | aujourd'hui | après |
|---|---:|---:|
| géométrie du bloc central | 68,09 Mo | **0** (grille partagée) |
| géométrie par dalle voisine (res 256) | 4,27 Mo | **0** |
| texture de MNT par bloc (1536² R16F) | — | +4,5 Mo |
| `rebuild()` : grille + échantillonnage + normales | 436 ms | **~0** |
| changer `params.resolution` | reconstruction complète | **un uniforme** |

**Ce que ça coûterait, honnêtement :**
- Les **normales** devraient être calculées dans le shader (différences finies sur la texture de MNT) ou pré-cuites en carte de normales. Mesuré : les différences centrées s'écartent de `computeVertexNormals` de **0,996° en moyenne**. **La carte changerait d'ombrage.** C'est le blocage principal, et il est visuel, pas technique.
- Les **couleurs de sommet** partiraient au shader, avec le même problème de grain que la Task 9.
- `uHeightRange` viendrait du MNT (min/max déjà calculés dans `loadDem`).
- Les consommateurs processeur (`this.sample`, socle, bateaux, jupe, drapage GPX) ne sont **pas** concernés : ils lisent déjà le MNT directement, jamais la géométrie.
- Le **LOD deviendrait possible** — et avec lui le geomorphing CDLOD (`morphLerpK` uniforme par bloc, `frac()` dans le vertex shader, hauteur ré-échantillonnée après le morph, **aucune donnée supplémentaire**). C'est la seule architecture, parmi celles étudiées, qui permette de changer de résolution *sans claquement*.

**Recommandation : ne pas l'ouvrir avant d'avoir mesuré le résultat des phases 1 à 4.** Si l'on passe de 1 270 ms à 200 ms et de 125 Mo à 98 Mo sans qu'un pixel bouge, le besoin aura peut-être disparu.

---

## Ce qui reste ouvert, à trancher avec Adrien

1. **Le fondu du masque côtier** (§4.5). Structurellement, le masque atterrit après le retrait du voile de chargement et change la règle terre/mer. **À regarder à l'œil d'abord.** Si le claquement existe, un fondu de `uCoastMaskOn` sur 200-300 ms est légitime : c'est de la peinture, pas de la géométrie.
2. **La résolution 1024 → 768.** Mesuré : 1,67 px CSS au maximum sur le Mont-Blanc, 0,02 px en moyenne — soit exactement ce que 1024 perd déjà par rapport à 2048. Rend 29,8 Mo et ~250 ms. **Décision de goût, à prendre devant deux captures, pas dans ce plan.**
3. **La Task 9** (couleurs en 8 bits) si des bandes apparaissent sur un relief plat.
4. **Le grain FBM au-delà de la résolution 512.** Sa seconde octave a une longueur d'onde de 2,8 mailles à res 512 — sous Nyquist, donc elle scintillerait au moindre mouvement de caméra. Si la résolution baisse un jour, `detailScale` doit baisser dans le même rapport. **Ce couplage n'existe pas dans le code aujourd'hui**, et c'est un piège pour quiconque touchera au sélecteur de résolution.
