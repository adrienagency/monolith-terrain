# Terrain continu sous une fenêtre fixe — étude de faisabilité

**Date** : 2026-07-29
**Demande d'Adrien** : « quand on zoome, il n'y a plus de temps de chargement, c'est simplement la map à l'intérieur du bloc qui zoome […] comme si le socle était un masque d'écrêtage […] la zone se charge au fur et à mesure, comme sur Google Earth. C'est faisable sans tout détruire ? ou en fork ? Quelles conséquences ? »
**Nature du document** : ÉTUDE. Aucune ligne de `src/` n'a été modifiée. Les seuls fichiers écrits sont ce rapport et trois bancs de mesure jetables, hors dépôt.

---

## 0. La réponse en une page

Ce qu'Adrien décrit porte un nom et c'est un problème résolu depuis vingt ans : **geometry clipmap** (Losasso & Hoppe, SIGGRAPH 2004) pour la version « fenêtre fixe qui défile », **CDLOD** et **chunked LOD / quadtree de tuiles** pour la version « monde entier vu de loin ». Google Earth, Cesium, Mapbox, tous les moteurs de monde ouvert font l'un ou l'autre. **La technique n'est pas le problème.**

Le problème est ailleurs, et il est mesurable. **ShibuMap ne fabrique pas seulement une géométrie à partir d'un bloc : il fabrique une VUE DU MONDE à partir d'un bloc.** Quatre décisions visuelles majeures sont prises en regardant *tout le bloc et rien que le bloc* :

| ce qui est décidé | comment | où |
|---|---|---|
| le **zéro vertical** du relief | `meanM`, altitude MOYENNE du bloc | `terrain.js:1104`, `terrain.js:1251` |
| le **niveau de la dalle** du socle | `globalMin − depth`, point le PLUS BAS du bloc | `plinth.js:82` |
| **où est la mer** | remplissage par diffusion depuis les **bords du bloc**, plus un rattrapage « grand bassin » à **2 % de la surface du bloc** | `sea-mask.js:22-66` |
| la **rampe de couleurs et l'ombrage** | quantiles p08/p50/p92 de l'**histogramme d'altitude du bloc** | `relief-grade.js:117`, `main.js:2225` |

À quoi s'ajoutent deux normalisations plus discrètes mais du même genre : l'encodage du peigné des crêtes (`robustScale`, 95ᵉ centile sur **toute la fenêtre**, `terrain-analysis.js:152`) et la hiérarchie des routes (`relativeTiers`, rangs **relatifs à ce qui est présent dans le bloc**, `roads-layer.js`).

**Conséquence, mesurée dans ce rapport** (§3.3) : la même cuvette fermée, sur le même terrain, au même zoom, est peinte **en bleu quand elle touche le bord du socle et en vert 100 px plus loin**. Ce n'est pas un bug : c'est la règle produit qui fait que ShibuMap ne peint pas des lacs fantômes. Mais dans un terrain qui défile, cette règle **change d'avis en continu**.

Donc :

> **Faisable ? Oui. Sans tout détruire ? Oui — mais pas en une passe, et pas en fork.**
> Le chantier n'est pas « remplacer la géométrie ». C'est **débrancher quatre statistiques globales de leur bloc et les rattacher au monde**. C'est un travail de fond, largement testable en isolation, et — voilà la bonne nouvelle — **le dépôt en a déjà fait un tiers sans le savoir**, dans `block-grid.js`.

Ma recommandation est le **scénario A+** (§5) : trois chantiers incrémentaux qui, pris ensemble, donnent 80 % de ce qu'Adrien demande sans jamais mettre le moteur actuel en danger, et qui sont **exactement les préalables** d'un vrai clipmap si on décide un jour d'y aller. Et un essai d'une journée (§6) qui tranche avant d'engager quoi que ce soit.

---

## 1. L'état de l'art, vérifié

### 1.1 Les deux familles, expliquées

**Geometry clipmap** (Losasso & Hoppe, SIGGRAPH 2004 ; version GPU : Asirvatham & Hoppe, *GPU Gems 2*, chapitre 2).

L'idée est belle et simple. On empile des grilles carrées **de taille identique en nombre de sommets** (typiquement 255×255), mais **d'espacement doublant** : le niveau 0 a des mailles de 10 m, le niveau 1 de 20 m, le niveau 2 de 40 m… Toutes sont **centrées sur le point de vue**. Vu d'en haut, ça fait des anneaux carrés emboîtés — d'où le nom : c'est le pendant géométrique du *texture clipmap* de SGI.

Les deux propriétés qui comptent ici :

- **La mise à jour torique.** Chaque niveau est stocké dans une texture d'altitude qu'on adresse *modulo* sa taille. Le papier est explicite : *« with toroidal access, we do not need to copy the old data when shifting a level. Instead, we simply fill the newly exposed "L-shaped" region. »* Bouger d'un pas coûte une bande, pas 255×255. C'est *le* mécanisme qui rend le déplacement continu gratuit — et c'est exactement ce qu'Adrien décrit quand il dit « du terrain qui est à gauche va se déplacer pour entrer dans le bloc ».
- **Le morphing par sommet.** Aux frontières entre deux anneaux, l'altitude du sommet fin est mélangée vers l'altitude du sommet grossier : `α = clamp((|p − v| − offset)/w, 0, 1)`, `z' = (1−α)·z_fin + α·z_grossier`, avec une largeur de transition `w = n/10` déterminée expérimentalement. Le passage d'un niveau à l'autre est donc **continu**, pas un saut. ⚠️ Hoppe insiste sur un point que le dépôt a déjà relevé : **les normales doivent être mélangées avec le même α**, sinon le claquement revient par l'éclairage.
- **Le budget de mise à jour, et sa conséquence heureuse.** C'est le détail le plus utile pour ShibuMap et il est souvent oublié. Hoppe met à jour **du grossier vers le fin** et s'arrête net quand le nombre d'échantillons mis à jour dépasse `n²`. Les niveaux fins non servis voient leur zone active rognée jusqu'à devenir vide — le terrain proche perd son détail fin quand on va vite. Le papier en tire cette phrase, qui répond par avance à l'inquiétude du §3.2 de ce rapport : *« An interesting consequence is that rendering load actually decreases as the viewer moves faster. »* **Un clipmap ne bégaie pas quand on drague vite : il devient flou, puis se rattrape à l'arrêt.** C'est exactement le comportement de Google Earth qu'Adrien décrit.

**Les chiffres du papier de 2004** : L = 11 niveaux de n = 255, **120 images/s et 59 millions de triangles/s** sur un Pentium 4 à 3 GHz avec une Radeon 9800XT, triangles de 3 pixels à l'écran. Le jeu « États-Unis entiers », 216 000 × 93 600 échantillons à 30 m, tient en **355 Mo compressés** (contre 40,4 Go bruts).

**Et le chiffre qui décide de tout le §3.2 de ce rapport.** La Table 1 du papier décompose les 21 à 26 ms que coûte la mise à jour d'un niveau 255² complet, tout en CPU. Un poste écrase les autres : **le calcul de la carte de normales, 11 ms — plus de la moitié du budget.** Puis vint la version GPU (Asirvatham & Hoppe, *GPU Gems 2* ch. 2, 2005), qui déplace ce calcul dans un *pixel shader* écrivant vers la texture elle-même. Table 2-2 :

| étape de la mise à jour d'un niveau 255² | CPU (2004) | **GPU (2005)** |
|---|---:|---:|
| ré-échantillonnage | 3 ms | **1,0 ms** |
| synthèse | 3 ms | **0 ms** |
| **carte de normales** | **11 ms** | **0,6 ms** |
| décompression | 8 ms | 8 ms (reste CPU) |

> **Facteur 18 sur le poste le plus lourd, simplement en le calculant dans un fragment shader vers une cible de rendu.** C'est la preuve chiffrée que la « sortie 1 » du §3.2 — passer l'analyse de relief sur GPU — n'est pas un pari : c'est le chemin que la littérature a pris il y a vingt ans, pour exactement la même raison.

Débits de la version GPU, fenêtre 1024×768 sur une GeForce 6800 GT : **130 images/s, 60 M triangles/s**, avec le *vertex texture fetch* comme goulot. ⚠️ Point de compatibilité vérifié : WebGL1 ne garantissait aucune unité de texture au vertex shader ; **WebGL2 en garantit 16**. Le clipmap repose entièrement là-dessus, et ShibuMap est en WebGL2.

**Quadtree de tuiles / chunked LOD** (Ulrich, 2002 ; CDLOD, Strugar, 2010 ; c'est la famille de Cesium et de Mapbox).

Ici, on découpe le monde en tuiles hiérarchiques. Chaque tuile porte une **erreur géométrique** en mètres. À l'affichage, on convertit cette erreur en **erreur écran** (`screen space error`) et on subdivise tant qu'elle dépasse un seuil — 2 pixels chez Cesium par défaut (`Globe.maximumScreenSpaceError`). C'est un critère de **distance à la caméra**, pas de position dans une fenêtre.

### 1.2 Lequel convient à une fenêtre de taille fixe ?

**Le clipmap, sans hésitation** — et c'est précisément parce que le socle de ShibuMap est de taille fixe.

Le quadtree résout un problème que ShibuMap n'a pas : *afficher un terrain qui va de l'horizon à mes pieds, avec un rapport de distance de 1 à 10 000*. Sa complexité (traversée d'arbre, jupes de raccord, erreur écran, fissures en T entre niveaux voisins) sert cette perspective-là. Le socle de ShibuMap est un **objet posé sur une table**, vu à distance à peu près constante (`controls.maxDistance × 0.97`, doc du 2026-07-27 §1.1) : le rapport entre le plus proche et le plus lointain pixel visible est de l'ordre de 2, pas de 10 000.

Le clipmap, lui, résout exactement le problème d'Adrien : **une fenêtre de dimensions fixes, centrée sur un point qui bouge, remplie de niveaux de détail concentriques.** Et la mise à jour torique est *la* réponse au « il n'y a plus de temps de chargement quand je drague ».

**La critique que CDLOD adresse au clipmap, et pourquoi elle ne concerne pas ShibuMap.** Strugar (2010) la formule ainsi : le clipmap choisit son niveau de détail sur la distance **au sol en deux dimensions**, en ignorant l'altitude de la caméra — donc, quand on est très haut, le terrain juste sous soi reste inutilement fin, et inversement. CDLOD raisonne en distance **3D réelle**. La critique est juste, et elle est décisive pour un simulateur de vol. **Elle ne l'est pas pour ShibuMap** : la caméra du socle reste à une distance à peu près constante (`controls.maxDistance × 0.97`), et le rapport entre le pixel le plus proche et le plus lointain est de l'ordre de 2. Le défaut que CDLOD corrige ne se manifeste pas ici.

⚠️ **Le successeur académique** (Benyoub & Dupuy, *Concurrent Binary Trees*, HPG 2024, arXiv 2407.02215 — moins de 0,2 ms sur console) **repose sur des compute shaders. WebGL2 n'en a pas** : dans three.js ils n'existent que par `WebGPURenderer`. Hors de portée de r172 sans migrer vers WebGPU. À noter et à oublier.

Le point d'entente entre les deux familles : **la grille régulière gagne dans les deux cas.** Mapbox utilise 128×128 (`GRID_DIM`), MapLibre 128 (`meshSize`), NASA WorldWind 32×32, et le dépôt a mesuré (doc du 2026-07-27 §3.3) que MARTINI — la triangulation adaptative — ne rend que **1,1× à 1,8× de triangles à erreur moyenne égale**, tout en interdisant le partage d'un VBO unique. **Ne pas partir sur un TIN.**

### 1.3 Ce qui existe en JavaScript — inventaire vérifié, et une bonne surprise

**Réutiliser vaut mieux que réécrire, et il y a plus à réutiliser que je ne le croyais.**

#### La bonne surprise : `3DTilesRendererJS`

| | |
|---|---|
| dépôt | `NASA-AMMOS/3DTilesRendererJS` — 2 405 étoiles |
| dernier envoi | **2026-07-28 (hier)** |
| licence | **Apache-2.0** |
| dépendance de pair | **`three >= 0.167` — donc r172 est compatible** |
| paquet npm | `3d-tiles-renderer` 0.5.0, avec **exports par sous-chemins** (`/core`, `/three`, `/three/plugins`) donc élagable |

C'est du **three.js vanilla natif** — le mode d'emploi principal, pas un greffon React :

```js
const tilesRenderer = new TilesRenderer('./tileset.json')
tilesRenderer.setCamera(camera)
scene.add(tilesRenderer.group)   // …puis tilesRenderer.update() dans la boucle
```

Et il embarque un **`QuantizedMeshPlugin`** natif (lit le `layer.json`, décode les tuiles quantized-mesh, gère `skirtLength`, `smoothSkirtNormals`, `generateNormals`), plus une collection de greffons directement pertinents : `TileCompressionPlugin`, `TileFlatteningPlugin`, `UnloadTilesPlugin`, `LoadRegionPlugin`, `TilesFadePlugin`, `TextureOverlayPlugin`.

**C'est la seule bibliothèque de tout l'inventaire qui combine three.js vanilla + LOD hiérarchique + streaming réseau + maintenance quotidienne.** Je m'étais avancé en écrivant qu'il n'existait rien de réutilisable : c'était faux, et c'est corrigé ici.
⚠️ Sa contrepartie : c'est un **quadtree de tuiles**, pas un clipmap. Il donne le streaming et le LOD, pas le défilement torique. Et il lui faut une **source de tuiles quantized-mesh** — donc soit Cesium ion (payant, voir plus bas), soit une cuisson maison.

#### Les briques algorithmiques pures

| module | licence | poids | utilisable en vanilla ? |
|---|---|---:|---|
| `@mapbox/martini` | ISC | **17,9 Ko**, zéro dépendance | oui — mais §1.2 dit de ne pas y aller |
| `delatin` (port JS de `hmm`) | ISC | 24,5 Ko | oui — alternative à MARTINI, pas successeur ; les deux ont été modernisés **le même jour** (2025-07-15) |
| `@loaders.gl/terrain` | MIT | 402 Ko | oui, « framework-independent ». **Décode terrarium ET quantized-mesh.** |

#### Ce qu'il faut écarter, et pourquoi

- **CesiumJS** (Apache-2.0, 4,81 Mo minifié / 1,30 Mo gzippé) : c'est **un moteur de globe entier**. `new Cesium.Viewer(...)` crée son propre canvas et son propre contexte WebGL. Le seul patron d'intégration que Cesium documente lui-même est **deux canvas superposés à caméras synchronisées**. Pour ShibuMap, dont tout le rendu est écrit contre three.js, ce n'est pas une bibliothèque : c'est un remplacement de moteur.
- **three-geo** (1 394 étoiles) : ⚠️ **three.js est bundlé en r138 dans son `dist`, sans dépendance de pair** → risque de double instance de `THREE` avec r172. Et surtout : **aucun LOD, aucun streaming** — la résolution est figée au chargement par un paramètre `zoom`. C'est le modèle « un bloc figé », donc exactement ce que ShibuMap fait déjà.
- **THREE.Terrain** (884 étoiles, relancé le 2026-05-26, MIT) : c'est un **générateur procédural** (bruit, diamond-square, érosion). Pas de LOD, pas de streaming. Et son port v3 annonce r175+.
- **three-landscape** : dépendances de pair `@react-three/fiber` et `react` → inutilisable en vanilla sans réécriture. À lire pour ses shaders de splatting, rien de plus.

#### Le clipmap three.js : il n'existe pas. C'est confirmé.

| dépôt | étoiles | dernier envoi | licence | nature |
|---|---:|---|---|---|
| `felixpalmer/lod-terrain` | 472 | **2018** | MIT | la référence historique, **abandonnée depuis 8 ans** |
| `tschie/geo-clipmap` | 22 | 2021 | MIT | **une démo**, pas une bibliothèque (three r134, Vite 2) |
| `J-Zeitler/geometry-clipmaps` | 23 | 2023 | MIT | expérimental, en réalité du CDLOD |
| `@certe/atmos-clipmap-terrain` | — | 2026 | **GPL-3.0** | ⚠️ dépend d'un moteur maison, **pas three.js**. À écarter. |

**Aucun paquet npm de clipmap pour three.js.** Si on va sur le scénario B, c'est du code à écrire. L'ordre de grandeur communément cité est « moins de 1 000 lignes, mais la génération du maillage est un calvaire à faire correctement » — snapper la position de chaque anneau à un multiple de sa résolution sous peine de scintillement, et snapper le maillage de couture à la résolution du niveau **extérieur**.

#### Et une nouvelle qui change le coût du scénario B

**three.js r172 fournit déjà la primitive de mise à jour torique :**

```js
renderer.copyTextureToTexture( src, dst, srcRegion, dstPosition, srcLevel, dstLevel )
```

Elle se résout en `texSubImage2D` avec le paramétrage `UNPACK_ROW_LENGTH` / `UNPACK_SKIP_PIXELS` / `UNPACK_SKIP_ROWS` pour extraire la sous-région source. **La bande en L d'un clipmap se met à jour en 2 à 4 appels par niveau et par image, sans jamais toucher au WebGL brut.** Exemple officiel : `webgl_materials_texture_partialupdate`.

C'est important : le morceau que je pensais le plus périlleux du scénario B — l'indexation torique de textures — est **déjà outillé** dans la version de three.js qu'utilise ShibuMap.

### 1.4 Le fait le plus utile de tout l'état de l'art

| moteur | maillage par tuile | sommets |
|---|---|---:|
| Mapbox GL JS / MapLibre | grille 128×128, **VBO unique partagé** | 16 641 |
| NASA WorldWind | 32×32 | 1 089 |
| CesiumJS | TIN adaptatif | 1 000 – 4 200 |
| **ShibuMap, bloc central** | grille **768×768** (`main.js:165`) | **591 361** |

Budgets relevés dans la littérature : geometry clipmaps de Hoppe à **≈ 460 000 triangles par image pour les États-Unis entiers à 30 m** ; CDLOD à 105 k – 446 k triangles/image sur 488 × 304 km.

**ShibuMap aligne 1,18 million de triangles pour un carré de 21 km de côté.**

C'est le chiffre qui recadre tout le débat, et il va dans le sens d'Adrien : **un clipmap correctement dimensionné coûterait MOINS cher en géométrie que le bloc actuel, pas plus.** Le clipmap de Hoppe aligne **≈ 460 000 triangles par image pour les États-Unis entiers à 30 m** ; ShibuMap en met **2,6 fois plus** pour un carré de 21 km.

---

## 2. L'audit du code — le cœur du rapport

La question n'est pas « la technique existe-t-elle » (oui), mais **combien de choses supposent aujourd'hui qu'un bloc = un chargement figé**. Voici le recensement, fichier par fichier.

### 2.0 Le geste central, tel qu'il est aujourd'hui

Zoomer, dans ShibuMap, c'est `modes.diveTo()` → `_loadDive()` (`modes.js:495-540`) :

1. la caméra plonge vers le point cliqué (0,42 s) ;
2. `loadSurface(lat, lon, zoom)` → `fetchAndBuildDem()` (`main.js:1698`) ;
3. un **voile blanc** (`_whiteout`) masque la substitution ;
4. **le point cliqué devient le nouveau centre du bloc**, la caméra est reposée à la vue iso 1.

Donc, aujourd'hui : zoomer **re-centre** le bloc, **recharge tout**, et **couvre la coupure d'un voile**. C'est un geste propre. Ce n'est pas un zoom continu.

Et `regenerateTerrain()` (`main.js:1822-1876`) est la liste exhaustive de ce qui doit être refait pour chaque nouveau bloc — **quatorze reconstructions** dans un même `setTimeout` :

```
terrain.rebuild · terrain.rebuildRoughness · plinth.rebuild · refreshMatTiling
realWater.rebuild · mapLayers.rebuild · refreshAerial · refreshOsmCredit
regenerateLabels · regenerateHud · gpxLayer.rebuildAll · drone.retarget
clouds.build · peaksLayer.refresh
```

**Chacune de ces quatorze lignes est un candidat de l'audit.** Elles ont toutes en commun la même hypothèse implicite : *elles sont appelées rarement, et ce qu'elles produisent vaut jusqu'au prochain bloc*.

---

### 2.1 `src/dem.js` — `loadDem` : **le plus facile à convertir**

**Ce qu'il suppose aujourd'hui.** Un appel = 3×3 tuiles peintes dans un canevas de 1536², fusionnées avec la bathymétrie, décodées en un `Float32Array`, rendues avec une géoréférence (`originTileX/Y`, `metersPerPixel`, `extentMeters`) et **quatre statistiques du bloc** : `minM`, `maxM`, `meanM`, et l'histogramme.

**Ce qu'il deviendrait.** Presque rien à jeter. `loadDem` est **déjà** un assembleur de tuiles alignées sur la grille slippy, et il accepte **déjà** un `originTile` explicite (paramètre ajouté pour le damier, `dem.js:137-139`) : « le damier charge les blocs voisins alignés sur la grille de tuiles du bloc central […] zéro couture entre blocs ». C'est littéralement le contrat d'un clipmap.

Il porte même déjà les deux mémoires qu'un système en flux exige (`dem.js:52-115`) : dédoublonnage des requêtes en vol, et LRU de 32 tuiles bathy. La campagne du damier a mesuré **6 405 requêtes pour 260 URL uniques**, dont **une seule tuile bathy demandée 2 070 fois** — précisément le régime d'un système qui défile.

**Le seul vrai travail** : rendre l'écriture **partielle**. Aujourd'hui `loadDem` fabrique un canevas neuf. Un clipmap veut « écris-moi cette bande-ci dans le tampon torique que je te donne ». C'est une signature à changer, pas un algorithme.

**Chiffre.** `loadDem` mesuré à **81,6 ms** sur un bloc (222 ms avant le correctif de ce week-end). Pour situer : c'est **17 % des 476 ms** que coûtent les champs dérivés du même bloc (§2.4). **Le chargement des tuiles n'est pas le problème. Il ne l'a jamais été.**

---

### 2.2 `src/terrain.js` — `TERRAIN_SIZE`, la géométrie, et **le zéro vertical**

**`TERRAIN_SIZE = 56`** (`terrain.js:48`) est l'unité du monde entier : le socle, les flancs, la découpe superellipse (`uSlabHalf`), la conversion lat/lon ↔ XZ (`geo.js`), le pas du damier (`i · TERRAIN_SIZE`), l'échelle des étiquettes, le clip des tracés. **Dans un clipmap, `TERRAIN_SIZE` reste et devient même le fondement du système** : c'est la fenêtre. Bonne nouvelle.

**La géométrie** (`terrain.js:1180-1190`) est déjà une grille régulière construite depuis un **gabarit mémorisé par résolution** (`grid-template.js`, Task 1 du plan du 2026-07-27 : `new PlaneGeometry` 284 ms → recopie du gabarit 2 ms, et 280 Mo de déchet transitoire supprimés). **Une grille régulière partagée est exactement ce qu'un clipmap veut.** Deuxième bonne nouvelle.

**Mais.** L'altitude de chaque sommet est calculée ainsi (`terrain.js:1104`) :

```js
(sampleDem(dem, …) - meanM) * scale
```

**`meanM` est l'altitude MOYENNE DU BLOC**, et elle sert de **zéro vertical**. Et le niveau de la mer en dépend directement (`terrain.js:1251`) :

```js
uSeaY = (0 - dem.meanM) * demScale + seaEps
```

Dans un terrain qui défile, `meanM` dérive en continu. **Le relief entier glisserait verticalement pendant qu'on drague, et le plan de mer avec lui.**

**Ce qu'il deviendrait.** Un zéro **fixé une fois** — soit 0 m absolu, soit la moyenne au moment de l'entrée dans la zone, gelée ensuite. **Et le dépôt sait déjà faire** : `block-grid.js:510-515` porte le commentaire « CONTINUITÉ VERTICALE : le sampler élève en (raw − meanM)·scale — chaque bloc doit partager la référence meanM du bloc CENTRAL, sinon les [blocs voisins se décalent] », et le code fait `{ ...nDem, meanM: main.meanM }`. **Le correctif existe, il est écrit, il est testé. Il faut l'étendre du damier au temps.**

---

### 2.3 `src/bathy.js` — la fusion terre/mer

**Ce qu'il suppose.** `fuseBathymetry(data, seaData)` ne peut que **creuser** la mer : la terre et le trait de côte restent ceux du terrarium (`dem.js:296-298` et le commentaire de la session polders). C'est la règle absolue d'Adrien : **la terre ne bouge jamais.**

**Ce qu'il deviendrait : rien.** C'est une opération **locale, pixel par pixel**, sans aucune statistique globale. Elle survit telle quelle à un traitement par bandes. `smoothSeaFloor` est un flou de rayon ≤ 24 px : il demande une **marge de 24 px** de part et d'autre d'une bande, rien de plus.

**C'est le seul module majeur du chemin dont je peux dire qu'il ne coûte rien.**

---

### 2.4 `coast-mask.js`, `sea-mask.js`, `region-mask.js`, `terrain-analysis` — **le vrai coût du chantier**

Adrien avait raison de les désigner. Voici les mesures.

#### Ce que ça coûte (banc Node 24, même V8 que Chrome, modules réels du dépôt)

| taille du MNT | `analyzeDem` (4 champs, ~10 flous) | masque de mer + flou | **`computeTerrainJob` complet** |
|---:|---:|---:|---:|
| 1536² | 384 ms | 55 ms | **476 ms** |
| 1024² | 239 ms | 26 ms | **264 ms** |
| 768² | 97,5 ms | 12,8 ms | **102 ms** |
| 512² | 43,2 ms | 6,4 ms | **47,9 ms** |
| 256² | 11,0 ms | 1,4 ms | **11,9 ms** |
| 128² | 4,2 ms | 0,4 ms | **4,5 ms** |

Le coût est **rigoureusement linéaire en nombre de pixels** : **164 nanosecondes par pixel de MNT**, constant sur toute la plage. C'est le chiffre à retenir.

**Traduisons-le en budget par image.** À 60 images/s on dispose de 16,7 ms ; à 30 images/s, de 33 ms. Sur un travailleur (`terrain-jobs.js` en pose déjà un), on ne gèle pas l'onglet, mais on ne dispose pas de plus de cœurs pour autant.

> **16,7 ms de calcul = 102 000 pixels de MNT.** Sur un MNT de 1536 de large, cela fait **66 colonnes par image**. À 60 im/s, c'est 4 000 colonnes par seconde — soit **2,6 largeurs de bloc par seconde**. En apparence, c'est confortable.

**Sauf que ce budget est faux, et le banc suivant dit pourquoi.**

#### Le biais de bord : mesuré

`analyzeDem` est une pile d'environ dix flous par boîte, jusqu'au **rayon 64**, avec **répétition de la valeur du bord** (`terrain-analysis.js`, `finiteCopy` + flous glissants). Un flou à bord répété **ne donne pas le même résultat selon l'endroit où est le bord**.

J'ai découpé deux fenêtres de 1024² dans un même monde de 2048², décalées de 128 px, et comparé le canal R (le peigné des crêtes) **dans la zone commune** :

| distance au bord de la fenêtre | écart moyen | écart max |
|---:|---:|---:|
| 0 – 8 px | **16,77 / 255** | 71 |
| 8 – 32 px | 7,91 / 255 | 45 |
| 32 – 64 px | 2,01 / 255 | 13 |
| 64 – 128 px | 1,83 / 255 | 3 |
| 128 – 256 px | 1,67 / 255 | 3 |
| 256 – 512 px | 1,74 / 255 | 3 |

**Deux enseignements, et le second est le plus important.**

1. **Le biais de bord s'éteint à 64 pixels.** Il faut donc calculer l'analyse sur une bande **élargie de 64 px de chaque côté** pour en obtenir une bande juste. Une bande utile de largeur `w` coûte `(w + 128)` colonnes. Pour `w = 66` (le budget de 16,7 ms ci-dessus), on paie 194 colonnes pour en publier 66 : **le rendement tombe à 34 %**. Le budget réel devient **22 colonnes utiles par image**, soit **0,9 largeur de bloc par seconde à 60 im/s**. Draguer vite épuiserait le budget.

2. **Le plancher n'est pas zéro : il est à ~1,7 / 255 partout, loin de tout bord.** Ce n'est pas du bruit de bord — c'est une **normalisation globale**. `encodeTextureShade(T, robustScale(T), k)` (`terrain-analysis.js:466`) divise tout le champ par le **95ᵉ centile de la fenêtre entière** (`robustScale`, ligne 152). **Le même massif reçoit un peigné différent selon ce qu'il y a d'autre dans le cadre.** Dans un terrain qui défile, le contraste du relief respirerait légèrement en permanence.

#### Le masque de mer : la mesure qui tranche

`buildSeaMask` (`sea-mask.js:22-66`) est **topologique**, et sa topologie est **celle du socle** :

> « la vraie mer est la zone sous 0 m **CONNECTÉE AU BORD** [de la fenêtre] », plus un rattrapage pour les grands bassins fermés (Caspienne, mer Morte) au-delà de `minBasinFrac` = **2 % de la surface de la fenêtre**.

Les deux critères se mesurent sur le socle. Pas sur le monde. J'ai posé dans un monde plat à 500 m une cuvette fermée, sans exutoire, et j'ai fait glisser la fenêtre (socle 768², seuil 2 % = 11 796 cellules) :

**Cuvette de 9 503 cellules — 1,6 % du socle, donc SOUS le seuil :**

| position de la fenêtre | verdict |
|---|---|
| la cuvette **entre par le bord** du socle | **MER — bleue** |
| on a dragué de **100 px** | **>>> TERRE — verte <<<** |
| on a dragué de 180 px | **>>> TERRE — verte <<<** |

**Cuvette de 17 671 cellules — 3,0 % du socle, donc AU-DESSUS du seuil :** mer dans les trois cas.

> **Le même plan d'eau, le même terrain, le même zoom. On drague de 100 pixels et le lac devient une prairie.**

Ce n'est pas un bug : c'est la règle qui empêche ShibuMap de peindre des lacs fantômes au dézoom, et elle est bonne. Mais elle est **définie par rapport au cadre**, et un cadre qui défile change la réponse en permanence.

**Ce qu'il deviendrait.** La topologie doit être décidée **sur le monde, pas sur la fenêtre**. Concrètement : le remplissage par diffusion doit partir d'une zone **plus large que le socle** (une marge d'au moins une demi-largeur de bloc), et le seuil des 2 % doit devenir une **surface absolue en km²**, pas une fraction du cadre. C'est une modification de **deux constantes et d'une marge** — mais c'est un changement de **comportement produit**, donc une décision d'Adrien, pas du code. ⚠️ Et il faut noter honnêtement que la marge coûte : un remplissage sur 1,5× la largeur du socle, c'est **2,25× le nombre de cellules**.

#### `coast-mask.js` et `region-mask.js` : la même famille, moins grave

- `coast-mask.js` rasterise Natural Earth (z4–z8) ou la grille côtière OSM (z9–z15) **sur l'emprise exacte du bloc**, dans une texture `MASK_SIZE = 2048`. Il mémoïse déjà par tuile z6 (`gridCache`), donc il est **déjà à moitié en flux**. Un clipmap le rendrait torique comme le MNT. **Ce module est le plus prêt des quatre.**
- `region-mask.js` (« isoler le Var ») rasterise un polygone administratif Nominatim sur l'emprise du bloc, avec un filtre `filterFarParts` qui **écarte les parties hors écran** (les DOM-TOM disparaissent) — encore une décision prise depuis le cadre. ⚠️ Et une contrainte réseau dure : **une requête Nominatim par changement de vue, maximum 1/s** (politique d'usage citée en tête du fichier). **Un terrain qui défile ne peut pas re-géocoder en continu.** Le mode isolé devrait **geler son polygone** pendant le déplacement — ce qui est de toute façon la bonne sémantique : « le Var » ne change pas quand je bouge.

#### Le récapitulatif de cette section

| module | statistique globale au bloc ? | marge nécessaire | verdict |
|---|---|---:|---|
| `bathy.js` (fusion, lissage) | non | 24 px | **survit tel quel** |
| `coast-mask.js` | non (déjà mémoïsé par tuile) | ~0 | **presque prêt** |
| `terrain-analysis.js` | **oui** — `robustScale`, 95ᵉ centile de la fenêtre | **64 px** | à débrancher |
| `sea-mask.js` | **oui** — bords du cadre + 2 % du cadre | **~½ bloc** | **à repenser (produit)** |
| `region-mask.js` | **oui** — `filterFarParts` + 1 req/s | — | à geler pendant le déplacement |

---

### 2.5 `src/plinth.js` — **le socle qui respire**

Adrien l'a anticipé, et il a raison. Voici le code exact (`plinth.js:20-82`) :

```js
export function computeSlab(sample, depth, samples = 256, …) {
  …
  return { ring, borderMin, globalMin, baseY: globalMin - depth }
}
```

`globalMin` est le point le plus bas trouvé **sur tout le patch** (anneau de bord à 256 échantillons par côté + balayage intérieur 12×12). `baseY = globalMin − depth`. Et de `baseY` dépendent, en cascade (`plinth.js:363-373`) :

- la position de la dalle du socle ;
- le sol opaque de studio, à `baseY − 0,02` ;
- la flaque de verre coloré, à `baseY + 0,05` ;
- le liseré, à `baseY × 0,015 − 0,02` ;
- les **UV des flancs**, calculés en `(y − baseY) / UVSCALE` — donc **la texture des flancs glisserait** aussi.

**Dans un terrain qui défile, `globalMin` change à chaque nouvelle bande de terrain qui entre.** Il suffit qu'un fond de vallée un peu plus profond entre par la gauche pour que **tout le socle descende** — dalle, sol, flaque, liseré, et le placage des flancs avec.

**C'est la conséquence produit la plus visible du chantier, et je la dis franchement : le socle ne serait plus un objet posé, il deviendrait un objet qui pompe.**

Les trois sorties possibles, par ordre de préférence :

1. **Geler `baseY` à l'entrée dans une zone** et ne le recalculer qu'aux changements de zoom. Le socle redevient stable ; la contrepartie est qu'un terrain plus profond que prévu **percerait la dalle**. `buildSlabWalls` accepte déjà un `baseYFloor` (`plinth.js:87-93`) exactement pour ce genre de garantie — le damier s'en sert déjà pour partager le fond du bloc central. **Le mécanisme est là.**
2. **Fixer `baseY` sur une altitude absolue** dépendant du zoom (par exemple « 500 m sous le niveau de la mer à ce zoom »). Silhouette parfaitement stable, épaisseur du socle variable selon les régions.
3. **Laisser respirer, avec amortissement.** Je le déconseille : la règle produit de ShibuMap est *la carte doit rester calme*.

⚠️ **Et il faut redire la règle d'Adrien telle qu'elle est écrite** : « le point le plus bas de la zone découpée touche la dalle ». **Cette règle est incompatible avec un terrain qui défile**, au sens strict. Elle doit être reformulée — « le point le plus bas *de la zone au moment de son cadrage* » — ou abandonnée. **C'est une décision de produit, pas d'ingénierie.**

---

### 2.6 `src/block-grid.js` — **l'embryon de la solution. Je tranche : à garder.**

Adrien demandait si le damier 5×5 est l'embryon de la solution ou ce qu'elle remplace. **C'est l'embryon, et de loin.** Voici pourquoi, textuellement.

Le fichier s'annonce lui-même comme tel (`block-grid.js:7-10`) :

> « C'est aussi la **FONDATION du futur système de blocs plus large** (demande Adrien) : un damier générique, borné à 5×5, où chaque cellule (i,j) couvre le monde [i·56±28, j·56±28] et charge son DEM **aligné sur la grille de tuiles du bloc central (zéro couture)**. »

Et il a **déjà résolu quatre des problèmes que pose un clipmap**, chacun mesuré et testé :

1. **La continuité verticale entre blocs** — `{ ...nDem, meanM: main.meanM }` (ligne 515). C'est exactement le correctif dont §2.2 a besoin.
2. **La continuité du fond de socle** — `baseYFloor` partagé, « sans jamais percer le relief d'une voisine plus profonde ».
3. **La couture nulle** — l'alignement sur la grille de tuiles via `originTile`, que `loadDem` accepte déjà.
4. **Le budget mémoire, chiffré et verrouillé par un test** — la règle « aucune TEXTURE ne dépasse quatre fois la densité du maillage qui la porte » (`test/damier-memoire.test.js`). Mesures citées dans le fichier : **79 Mo par dalle et 1 824 Mo de tas JS pour 23 voisines** avant correction, contre 2 à 4 Go de limite pratique dans Chrome ; et un solde de **719,3 → 701,3 Mo** après la passe des plafonds. **C'est exactement la comptabilité qu'un système en flux doit tenir.**

Il porte aussi la géométrie de sélection dont un clipmap a besoin : `cellsForParts` (quelles dalles une zone isolée touche : test segment/rectangle Liang–Barsky **plus** test d'appartenance du centre, parce qu'« un long côté droit saute par-dessus une dalle entière ») et `cellsForTrack`.

**Ce qui lui manque pour être un clipmap** — et c'est court :

| manque | ampleur |
|---|---|
| les voisines sont **maillées à 256** en dur (`NEIGHBOUR_RES`), pas en anneaux d'espacement doublant | moyen |
| pas de **mise à jour torique** : une dalle naît et meurt, elle ne défile pas | **c'est le gros morceau** |
| pas de **morphing** entre niveaux : les voisines sont au même zoom que le centre | gros, si on veut le zoom continu |
| les voisines n'ont **ni socle, ni mer animée, ni étiquettes, ni aérien** (périmètre v1 assumé) | c'est un choix, pas une dette |
| plafonné à **5×5** (`GRID_R = 2`), et à 24 / 12 / 8 / 4 dalles selon le palier machine | paramétrable |

**Verdict : le damier n'est pas à remplacer. C'est la moitié inférieure du clipmap, déjà écrite, déjà mesurée, déjà testée. Le chantier consiste à lui ajouter le défilement et les niveaux — pas à le jeter.**

---

### 2.7 Les calques — tous en coordonnées de bloc, et deux surprises

| calque | ce qu'il suppose | ce qu'il deviendrait |
|---|---|---|
| `map/places-layer.js` | `loadLayer('places')` charge **tout le fichier** (6,5 Mo), puis `clipToPatch` filtre sur la bbox du bloc, puis `pickPlaces` sélectionne | tuilage ; la sélection doit devenir **incrémentale** (entrées/sorties), pas un re-tri complet |
| `map/roads-layer.js` | idem, `roads.json` = **13,2 Mo**. ⚠️ Et `relativeTiers` : « les rangs sont **RELATIFS à ce qui est présent dans ce patch** » — « une vallée sans autoroute rend quand même ses nationales au poids le plus lourd » | **normalisation globale au bloc, comme `robustScale`.** Dans un terrain qui défile, **l'épaisseur des routes changerait quand une autoroute entre dans le cadre.** À débrancher, ou à assumer. |
| `map/water-layer.js` + `map/tile-loader.js` + `map/tile-index.js` | ⚠️ **C'est déjà un système de tuiles en flux, avec LOD, manifeste, cache et repli.** `LOD_LEVELS` mappe `demZoom` → zoom de tuile ; `hasTilesForLod` décide. **Mais il ne couvre que `REGION = { lon 5,0–8,0 ; lat 44,5–47,0 }`** — Annecy, Chamonix, Léman, Bourget, Genève. | **Le modèle à généraliser.** Ce module est la preuve que l'équipe sait faire du flux tuilé dans ce dépôt. |
| `map/block-clip.js` | découpe les tracés et polygones **au contour du socle**, en JS, au moment de construire la géométrie (Sutherland–Hodgman + triangulation par triangle) | dans un terrain qui défile, **ce découpage devrait se refaire à chaque image**. C'est le candidat naturel à un passage en **plans d'écrêtage GPU** (`THREE.Plane` / `clippingPlanes`) — la superellipse du socle est déjà dans le shader (`uSlabHalf`, `uSlabCorner`) |
| `peaks.js` | `fetchTopPeaks(dem)` interroge la bbox du bloc et **jette tout ce qui sort de ±TERRAIN_SIZE/2** (ligne 223) | entrée/sortie continues ; requête réseau à débrancher du défilement |
| `gpx-layers.js` / `gpx.js` | `gpxLayer.rebuildAll()` **redrape chaque trace sur le nouveau relief** à chaque reconstruction ; et le **rail de la caméra de suivi est cuit** contre le terrain (`drone.retarget`) | le redrapage doit devenir incrémental, ou le rail doit redevenir réactif |
| `race-labels.js`, `labels.js`, `hud3d.js` | reconstruits en bloc par `regenerateLabels()` / `regenerateHud()` | placement incrémental |

**La surprise n°1** : `tile-loader.js` prouve que le dépôt sait déjà faire du flux tuilé, avec manifeste et LOD. Ce n'est pas un terrain vierge.

**La surprise n°2** : `relativeTiers` est une **cinquième** statistique globale au bloc, à côté de `meanM`, `globalMin`, `robustScale` et `gradeForDem`. Elles se ressemblent toutes, et elles ont toutes la même origine : *ShibuMap est un producteur d'images, pas un visualiseur de données*. Il **cadre** son sujet. Un terrain continu lui retire ce cadrage.

---

### 2.8 `modes.js`, `templates-user.js`, `export.js`, `share-link.js` — **la reproductibilité**

C'est le point qu'Adrien a formulé exactement comme il faut : **« un lien partagé doit encore montrer la même chose. »**

Aujourd'hui, un partage tient en trois nombres (`share-link.js:75`) :

```js
loc: { lat: params.demLat, lon: params.demLon, zoom: params.demZoom }
```

Et à la relecture (ligne 138) : `zoom = Math.round(clamp(loc.zoom, 2, 18))` — **un entier**. Même chose pour les gabarits (`templates-user.js:114`) : « `source/demLat/demLon/demZoom/demLocation` — LA LOCALISATION ».

**Trois nombres suffisent parce que le zoom est discret et le cadrage déterministe.** Dans un terrain continu, le zoom devient un **réel** et le cadrage un **état** (où en est le défilement, quels niveaux sont chargés, quel `baseY` a été gelé, quel `meanM` sert de zéro).

**Ce qu'il faut faire, et ce n'est pas grave** : `loc` doit porter un **zoom fractionnaire** et les **références gelées** (`baseY`, `meanM`, éventuellement la graine du cadrage). Le format est versionné et validé (`share-link.js:123-158` : « untrusted decoded object → … or null »), il accepte donc une extension propre. ⚠️ **Mais les liens déjà partagés doivent continuer à s'ouvrir** — la validation actuelle rejette tout ce qui n'a pas `lat`/`lon`/`zoom` numériques, donc l'ajout de champs optionnels est compatible. **À vérifier, pas à supposer.**

Pour **`export.js` / `export-recorder.js`** : l'export rend hors écran à une autre taille (`applySize`). Dans un terrain qui défile, un export **doit figer le défilement** le temps du rendu, sinon deux images consécutives ne montrent pas le même monde. C'est une contrainte simple mais absolue, et elle vaut aussi pour l'usine à vidéos (`docs/…/2026-07-27-usine-a-videos.md`).

Pour **`modes.js`** (globe ↔ surface) : la plongée orbitale est le seul endroit où un rechargement complet reste **légitime et souhaitable** — on change de continent, il n'y a rien à faire défiler. Le `_whiteout` doit rester là. **Ce qui doit disparaître, c'est le voile au zoom de proximité**, pas celui de l'atterrissage.

---

## 3. Les conséquences, classées

### 3.1 Ce qu'on gagne

| gain | chiffre |
|---|---|
| **Le zoom sans attente** | aujourd'hui : `loadDem` 81,6 ms + `computeTerrainJob` 476 ms (au MNT 1536²) + les treize autres reconstructions de `regenerateTerrain`, le tout derrière un voile. Le plan du 2026-07-27 visait **~200 ms de fil principal bloqué** ; en clipmap, la cible est **0 ms de gel** et un raffinement qui arrive en quelques images. |
| **Le déplacement continu** | aujourd'hui, draguer au-delà du bloc ne montre rien (sauf damier GPX). En clipmap, le monde est infini. |
| **Une mémoire bornée ET prévisible** | c'est le gain le plus sous-estimé. Aujourd'hui le tas JS va de **125 Mo** (bloc seul) à **1 762 Mo de pic** (damier plein) — un facteur 14 selon ce que fait l'utilisateur, pour une limite pratique de 2 à 4 Go dans Chrome. **Un clipmap a une empreinte CONSTANTE par construction** : N niveaux × une texture de taille fixe. C'est le seul modèle qui rend la mémoire *calculable à l'avance*. |
| **Moins de triangles** | 1,18 M aujourd'hui pour 21 km ; ~325 k pour un clipmap 5 niveaux à 255². **Facteur 3,6 en moins.** |

### 3.2 Ce qu'on perd, ou qui change

| perte | gravité | réversible ? |
|---|---|---|
| **Le socle respire** (§2.5) | **majeure — c'est la silhouette du produit** | oui, en gelant `baseY` (le mécanisme `baseYFloor` existe) |
| **La règle « le point le plus bas touche la dalle »** | **doit être reformulée ou abandonnée** | non — c'est une décision produit |
| **La mer change d'avis** (§2.4) — un lac devient prairie en draguant de 100 px | **majeure et visible** | oui, en passant le seuil des 2 % en km² absolus et en élargissant le remplissage. Coût : ×2,25 de cellules. |
| **Le contraste du relief respire** (`robustScale`) | mineure mais permanente | oui, en gelant le 95ᵉ centile |
| **L'épaisseur des routes change** (`relativeTiers`) | mineure | oui, même remède |
| **La rampe de couleurs se recadre** (`gradeForDem` sur l'histogramme du bloc) | moyenne | oui, en gelant le grade |
| **Le mode « isoler le Var »** | moyenne — 1 req Nominatim/s, `filterFarParts` cadre depuis l'écran | oui, en gelant le polygone pendant le défilement |
| **La reproductibilité d'un gabarit et d'un partage** | moyenne | oui, en versionnant `loc` (§2.8) |
| **L'analyse de relief en budget par image** | **c'est la contrainte dure** | voir ci-dessous |

#### La contrainte dure, dite précisément

L'analyse de relief coûte **164 ns par pixel de MNT**, mesuré. Elle gelait le fil principal ~390 ms en 1536² avant d'être déportée dans un travailleur (`terrain-jobs.js`) ; **le travailleur supprime le gel, pas le calcul**. En streaming, ce calcul devient un budget par image, et le biais de bord mesuré à §2.4 impose une **marge de 64 px**, ce qui plafonne le rendement à **22 colonnes utiles par image à 60 im/s** — moins d'une largeur de bloc par seconde.

**Trois sorties, et il faut en choisir une avant d'écrire la première ligne :**

1. **Le passer sur GPU. C'est la voie propre, et la littérature l'a déjà chiffrée.** L'analyse est une pile de flous par boîte de rayons doublants — c'est structurellement une **pyramide**, donc ça se transpose sur une chaîne de mipmaps et des passes de fragment vers des cibles de rendu.
   **Le précédent exact** : Hoppe calculait sa carte de normales en CPU pour **11 ms** par niveau 255² (Table 1, 2004) ; la version GPU la calcule dans un *pixel shader* écrivant vers la texture pour **0,6 ms** (Table 2-2, *GPU Gems 2* 2005). **Facteur 18**, sur le poste qui pesait plus de la moitié du budget de mise à jour. C'est le même geste, sur le même genre de champ dérivé.
   ⚠️ **Mais ce n'est pas un portage, c'est une réécriture** : les flous CPU utilisent des sommes glissantes (O(1) par pixel quel que soit le rayon), technique qui n'existe pas telle quelle en fragment shader — il faut passer par la pyramide de mipmaps. Et le test `test/terrain-jobs.test.js` **verrouille l'égalité octet pour octet** de ces champs sur quatre familles de relief : une version GPU ne le passera pas, il faudra le remplacer par un test de tolérance. **C'est la plus chère des trois sorties, et c'est la seule qui tienne à long terme.**
   ⚠️ Un détail de terrain qui vaut de l'or et qu'on n'invente pas : **échantillonner la carte de normales dans le *fragment* shader, pas dans le vertex shader.** Géométrie strictement identique, détail visuel bien supérieur.
2. **Baisser la résolution de l'analyse pendant le mouvement**, la remonter au repos. Le mécanisme existe déjà : `analyseMax` vaut 1024 au palier 2 et 768 au palier 3 (`palier-machine.js`), et `resampleField` sait rendre la taille exacte. **C'est la voie la moins chère et elle est déjà à moitié construite.**
3. **Découper le monde en dalles d'analyse pré-calculées à marge**, mises en cache. On revient à un quadtree — donc à ce que fait Cesium, avec sa complexité.

### 3.3 Le coût en octets — le chiffre est contre-intuitif

Mesuré sur le `dist` du dépôt :

```
dist total                        968 Mo
  dont dist/data (tuiles)         944 Mo   ← servi À LA DEMANDE, tuile par tuile
  dont l'application elle-même     25 Mo   ← servi à chaque visite
```

**Les 968 Mo ne sont pas un coût par visite. C'est une empreinte de déploiement.** Netlify facture la **bande passante servie**, pas la taille du site.

Détail des jeux de tuiles :

| jeu | fichiers | poids total | moyenne par tuile |
|---|---:|---:|---:|
| `bathy` | 21 557 | 348 Mo | **16,9 Ko** |
| `coast-z6` | 2 361 | 315 Mo | **136 Ko** |
| `lake-tiles` | 2 256 | 177 Mo | **80 Ko** |
| `water-tiles` | 488 | 76 Mo | **159 Ko** |
| `map/*.json` (monolithique) | 5 | **41,6 Mo** | coastline 8,8 · roads 13,2 · rivers 10,0 · places 6,5 · lakes 3,0 |

**Et voici le fait décisif** (`dem-source.js:34,48`) :

```js
url: (z,x,y) => `https://tiles.mapterhorn.com/${z}/${x}/${y}.webp`
url: (z,x,y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
```

> **Les tuiles d'altitude ne viennent PAS de Netlify.** Elles viennent de Mapterhorn et du bucket public AWS. **Quel que soit le volume de MNT qu'un clipmap ferait défiler, il coûte zéro crédit Netlify.**

Donc, la réponse à la question d'Adrien :

**Un terrain continu multirésolution DIMINUERAIT la bande passante Netlify par visite. Voici pourquoi.**

Ce que Netlify sert aujourd'hui à chaque visite « fraîche » :
- l'application : **25 Mo** (inchangé) ;
- `places.json` : **6,5 Mo en entier**, parce que `placesEnabled: true` par défaut (`main.js:505`) et que `loadLayer` télécharge le fichier complet avant de filtrer sur la bbox du bloc (`geo-data.js:8`, `clipToPatch`) ;
- si l'utilisateur allume les routes (`roadsEnabled: false` par défaut) : **13,2 Mo en entier**, parce qu'il n'existe **pas** de `public/data/road-tiles/` — le chemin tuilé de `roads-layer.js` retombe sur le fichier monolithique ;
- les rivières : **10,0 Mo en entier** ;
- plus les tuiles bathy et côte réellement touchées.

**Le passage en flux tuilé est le contraire d'un surcoût : c'est le remède au gaspillage actuel.** Aujourd'hui on télécharge 6,5 Mo de villes du monde entier pour en afficher trente autour d'Annecy. Le tuilage sert **ce qu'on regarde**. Le module `map/tile-loader.js` fait déjà exactement ça pour l'eau — sur une région de 3° × 2,5°.

⚠️ **La réserve honnête** : un terrain continu fait *parcourir plus de monde* à l'utilisateur, donc plus de tuiles au total sur une longue session. Le gain net dépend du comportement, et **je ne peux pas le chiffrer sans mesurer une vraie session**. Ce que je peux affirmer : **le poste le plus gros et le plus certain (les 30 Mo de JSON monolithiques) disparaît, et le poste qui grossit (le MNT) n'est pas facturé.**

#### Ce que pèse vraiment une tuile d'altitude — mesuré aujourd'hui sur le bucket AWS

Le repli d'altitude de ShibuMap (`elevation-tiles-prod`) a été sondé directement pendant cette étude :

| ce qui a été mesuré | valeur |
|---|---|
| tuile terrarium moyenne à z12 (10 tuiles consécutives) | **92 260 octets** (min 61 459, max 136 037) |
| tuile d'océan pur à z8 | 135 885 octets — **plus lourde qu'une tuile alpine** |
| une vue plein écran 1920×1080, **un seul niveau**, tuiles 256 px | 40 à 54 tuiles → **3,7 à 5,0 Mo** |
| **la fraction sub-métrique (canal bleu) d'une tuile z12** | **65 762 o, soit 58 % du fichier** |
| la même donnée ré-encodée en PNG 16 bits (précision 1 m) | **26 369 o — 4,3 fois plus léger** |

> **Plus de la moitié d'une tuile terrarium est du bruit sub-métrique que PNG ne peut pas comprimer, et qui ne sert strictement à rien sur une carte stylisée.**

Trois conséquences pour ShibuMap :

1. **Le socle préchargé garde un avantage réel** qu'il ne faut pas balayer : un aller-retour, une décompression, zéro logique de cache. Un socle 1024² en PNG 16 bits pèserait de l'ordre de **300 à 400 Ko** — soit **dix fois moins qu'une seule vue plein écran en tuiles terrarium**. Le problème n'a jamais été le poids du bloc : c'est le **rechargement intégral à chaque zoom**.
2. **Si un jour ShibuMap cuit son propre relief**, le PNG 16 bits divise la facture par 4,3. Ordre de grandeur vérifié pour la France métropolitaine : **z6→z12 ≈ 38 000 tuiles, ~1 Go en PNG 16 bits** (hébergeable) ; z13 ferait exploser à ~4 Go.
3. ⚠️ **Le bucket AWS est vivant mais figé.** Sondé aujourd'hui : HTTP 200 sur `terrarium/`, `normal/`, `skadi/`, `v2/…`, avec `Access-Control-Allow-Origin: *` — utilisable sans clé ni proxy. **Mais `Last-Modified` remonte à 2017 et il n'y a aucun engagement de service.** ShibuMap ne s'en sert qu'en repli (la source primaire est Mapterhorn), donc l'exposition est limitée — mais c'est à savoir.
   Bonus repéré au passage : le préfixe **`/normal/`** sert des **normales pré-calculées** (PNG RGBA 256², ~64 Ko/tuile). C'est la technique n° 4 du streaming — *ne rien recalculer, lire ce qui a été cuit* — disponible gratuitement. Le format quantized-mesh fait pareil (normales oct-encodées en extension, plus un masque d'eau). **Si un jour ShibuMap cuit ses propres tuiles, y cuire aussi ses champs dérivés est la sortie la moins chère du §3.2.**

#### Et si on passait par Cesium ion — le chiffre qui ferme la porte

| palier | prix | streaming inclus |
|---|---|---|
| Community | gratuit | 15 Go/mois — ⚠️ **« personal and non-commercial use »** |
| Commercial | **149 $/mois** | 150 Go/mois |

À ~4 Mo la vue plein écran, 15 Go/mois font **~3 750 vues**. Et le palier gratuit est explicitement non commercial — **incompatible avec le back-office payant en préparation** (`docs/…/2026-07-26-comptes-paiements-dons.md`). Si le scénario B passe par `3DTilesRendererJS`, **il faut cuire ses propres tuiles**, pas les acheter.

### 3.4 Les machines faibles — un clipmap coûte MOINS

C'est net, et dans le bon sens :

| poste | bloc figé aujourd'hui | clipmap |
|---|---|---|
| **triangles** | 1,18 M (768²) pour 21 km | ~325 k (5 niveaux à 255²) |
| **mémoire** | 125 Mo (bloc) → 1 762 Mo (damier plein) | **constante par construction** |
| **pic de calcul** | 476 ms de champs dérivés d'un coup, à chaque changement de bloc | étalé en budget par image |
| **déchet transitoire** | 280 Mo par reconstruction (supprimés par le gabarit mémorisé, Task 1) | nul |

L'iMac 2015 à 3 images/s est au **palier 2 « ALLÉGÉ »** : occlusion ambiante coupée, ombres statiques, densité 1, budget 3,2 Mpx, damier plafonné à 8 dalles, et `analyseMax: 1024` avec le commentaire « l'analyse de relief bloque le fil principal ~390 ms en 1536² ». **Une machine à 3 im/s dispose de 333 ms par image** — le budget de calcul par image y est donc *large*, pas serré. Ce sont les **pics** qui la tuent, pas le régime permanent. **Un clipmap remplace des pics par un régime permanent : c'est précisément ce qu'il faut à ces machines.**

⚠️ **Le seul risque réel pour elles** : le nombre de **draw calls** et le nombre de **textures actives**. Le clipmap doit garder un VBO unique partagé entre les anneaux (le modèle Mapbox), pas un maillage par niveau. Et le système de paliers doit pouvoir **réduire le nombre de niveaux** comme il réduit déjà `damierMax` (24 / 12 / 8 / 4). **La table des paliers est déjà le bon endroit pour ce levier.**

---

## 4. « Sans tout détruire, ou en fork ? » — je tranche

**Ni l'un ni l'autre tel que posé. Ni refonte du cœur en une passe, ni fork. Un chantier incrémental, dans le dépôt, en trois temps, dont chaque temps a de la valeur tout seul.**

### Scénario A — Incrémental : ce qu'on obtient sans rien refondre

**C'est le scénario à instruire en premier, et voici pourquoi : trois de ses quatre briques existent déjà.**

**A1. Débrancher les cinq statistiques globales du bloc.**
Geler `meanM`, `baseY`, `robustScale`, `gradeForDem` et `relativeTiers` à l'entrée dans une zone, au lieu de les recalculer à chaque bloc. **Effort : faible.** Le patron existe (`block-grid.js:515` le fait déjà pour `meanM`). **Valeur immédiate, sans aucun clipmap** : les blocs voisins du damier cesseraient de « respirer » les uns par rapport aux autres, et un changement de zoom ne recadrerait plus les couleurs. **C'est un gain de calme visuel, tout de suite.**

**A2. Précharger le niveau suivant pendant qu'on regarde.**
`modes.js` connaît déjà la cible de la plongée (`stepZoom`, `pickDiveTier`, `userFineZoom`). Rien n'empêche de lancer `loadDem` du niveau suivant **pendant que la caméra est au repos**. Coût : 81,6 ms de réseau, déjà payés, mais **avant** le clic au lieu d'après. **Effort : faible. Gain : le zoom paraît instantané dans le cas courant.**
⚠️ **Attention** : le plan du 2026-07-27 §4 déconseille formellement le préchargement *basse définition puis reconstruction* (« ça coûte 26 ms ET un second gel », « le passage 256→1024 déplace la surface de 4,94 pixels CSS en une image »). **Ce que je propose ici est différent** : précharger le **même niveau de détail** que celui qu'on va afficher, en avance. Pas de second gel, pas de claquement — juste de l'avance.

**A3. Généraliser le flux tuilé aux calques monolithiques.**
`tile-loader.js` + `tile-index.js` savent déjà le faire. Il manque `road-tiles`, et il faudrait sortir `places` et `rivers` de leur JSON unique. **Effort : moyen** (c'est un script de cuisson, `scripts/build-*tiles.mjs`, dont le modèle existe). **Gain : jusqu'à 30 Mo de bande passante Netlify par visite fraîche, aujourd'hui, sans toucher au terrain.**

**A4. Étendre le damier à un défilement de proximité.**
Autoriser le damier hors mode GPX, et **recentrer la grille** quand on drague au-delà d'une demi-cellule — sans clipmap, sans anneaux, sans morphing : juste « la dalle qui sort meurt, celle qui entre naît ». **Effort : moyen.** **C'est déjà 60 % de ce qu'Adrien décrit** — « le terrain qui est à gauche se déplace pour entrer dans le bloc, celui qui était à droite disparaît » — au grain de la dalle plutôt qu'au grain du pixel.

**A1 + A2 + A3 + A4 = « scénario A+ », et c'est ma recommandation.**

### Scénario B — Refonte du cœur derrière un drapeau

Un vrai clipmap : anneaux emboîtés, mise à jour torique du MNT et des masques, morphing par sommet avec normales mélangées, analyse de relief sur GPU.

**Effort : lourd.** Ce n'est pas la géométrie qui coûte (~1 000 lignes, et three.js r172 fournit déjà `copyTextureToTexture` pour la mise à jour torique — §1.3) : ce sont les cinq débranchements de A1 (obligatoires), la réécriture GPU de l'analyse (§3.2, avec le test octet-pour-octet à remplacer), le nouveau contrat de `loadDem` en écriture partielle, le clip GPU des calques, la version du format de partage, et **la remise à plat de la règle du socle.**

**Et B se décline en deux.** B1 : un **clipmap maison** — c'est le seul chemin qui donne littéralement le geste qu'Adrien décrit, et il n'existe aucun paquet npm (§1.3). B2 : greffer **`3DTilesRendererJS`** (Apache-2.0, three ≥ 0.167, maintenu quotidiennement) et accepter un **quadtree de tuiles** plutôt qu'un clipmap — on gagne le streaming et le LOD écrits par d'autres, on perd le défilement torique, et il faut cuire ses propres tuiles quantized-mesh (Cesium ion étant non commercial en gratuit, §3.3). **B2 mérite d'être évalué avant B1**, ne serait-ce que pour savoir ce qu'on refuse.

**Le drapeau est indispensable** — le dépôt a déjà `src/flags.js` — et il doit rester en place longtemps, parce que les deux moteurs devront **coexister à l'écran** pour être comparés.

⚠️ **La difficulté de B n'est pas technique, elle est de gouvernance** : 1 302 tests verrouillent le comportement actuel, et une partie d'entre eux verrouille précisément les statistiques globales que A1 débranche. **Ils devront être relus un par un.** C'est un travail lent, ingrat, et non compressible.

### Scénario C — Fork

**Je le déconseille, et le précédent est dans le projet.**

« EARTH ELEMENTS » a été forké et n'a jamais été poussé. C'est le résultat normal : un fork d'un moteur de rendu produit deux moteurs dont un seul reçoit les corrections. Or ShibuMap est **en production sur shibumap.com, avec une campagne de communication en cours**. Pendant les mois d'un fork, les correctifs (côtes, bathymétrie, nuages, paliers machine, accueil) continueraient d'arriver sur la branche vivante et **il faudrait les reporter à la main** — ou perdre le fork.

Et l'argument décisif : **il n'y a rien dans le clipmap qui exige un fork.** Le drapeau du scénario B donne la même isolation sans la divergence.

**Le seul cas où C se défend** : si Adrien décide de remplacer three.js par CesiumJS. Là ce n'est plus un fork de ShibuMap, c'est un autre produit.

---

## 5. Ma recommandation

**Faire A+, dans cet ordre, et ne décider de B qu'après l'avoir fait.**

1. **A1 — débrancher les cinq statistiques globales.** Effort faible, valeur immédiate même sans clipmap, et c'est le **préalable obligatoire** de B. Si un jour B se fait, A1 aura été fait de toute façon. **Aucun risque de travail perdu.**
2. **A3 — tuiler les calques monolithiques.** Effort moyen, gain de bande passante certain et chiffré, indépendant de tout le reste. **Le seul chantier qui rapporte de l'argent Netlify tout de suite.**
3. **A2 — précharger le niveau suivant.** Effort faible, gain perçu fort sur le geste qui gêne Adrien.
4. **A4 — le damier qui se recentre.** À faire en dernier, parce que c'est lui qui dira si le grain de la dalle suffit ou si le grain du pixel est nécessaire. **C'est la mesure qui décide de B.**

**Pourquoi pas B tout de suite ?** Parce qu'il y a une hypothèse non vérifiée au cœur de la demande d'Adrien : **que la gêne vienne de la granularité du chargement**. Il se peut que la gêne vienne surtout du **voile** et du **recentrage brutal** — deux choses que A2 et A4 corrigent pour un dixième du coût de B. **On ne saura qu'en essayant.**

---

## 6. Ce qu'Adrien peut essayer en une journée

Trois essais, du moins cher au plus cher. **Le premier suffit peut-être.**

### Essai 1 — Une heure, zéro code : est-ce le chargement, ou le voile ?

Dans la console du site en production, mesurer le temps réel entre le clic de plongée et l'image finale, en décomposant : `diveTo` (0,42 s de tween, **fixe et volontaire**), `loadDem` (81,6 ms), `regenerateTerrain`, `_whiteout`.

**Le chiffre qui tranche** : si le tween de 0,42 s + le voile représentent plus de la moitié du temps perçu, **alors le problème n'est pas le chargement du terrain**, et un clipmap ne le résoudrait pas. Il faudrait raccourcir le geste, pas refaire le moteur.

### Essai 2 — Une demi-journée, jetable, hors dépôt : le socle respire-t-il vraiment de façon visible ?

Sur une copie jetable, remplacer les quatre statistiques globales par des constantes gelées (`meanM = 0`, `baseY` fixe, `robustScale` fixe, `gradeForDem` figé), puis **draguer d'un bloc à l'autre au même zoom** et comparer deux captures.

**Le chiffre qui tranche** : de combien d'unités-monde le socle monte-t-il et descend-il en traversant un massif ? Si c'est sous 0,5 unité, on peut laisser respirer. Si c'est 3 ou 4, il faut geler — et alors A1 devient prioritaire **quel que soit le sort du clipmap**.

### Essai 3 — Une journée, jetable, hors dépôt : le prototype qui décide de B

Une page three.js **nue**, sans ShibuMap : un clipmap de 4 anneaux à 255², alimenté par `loadDem` importé tel quel du dépôt, avec mise à jour torique et morphing. **Pas de socle, pas de mer, pas de masques, pas de calques.** Juste le terrain qui défile.

Deux points de départ pour ne pas partir de zéro : `tschie/geo-clipmap` (MIT, three r134 — une démo à relire, pas une bibliothèque) et `felixpalmer/lod-terrain` (MIT, 472 étoiles, abandonné en 2018). Et la primitive de mise à jour torique est **déjà dans r172** : `renderer.copyTextureToTexture(src, dst, srcRegion, dstPosition)` (§1.3).

**Les trois chiffres qui tranchent** :

| mesure | seuil de décision |
|---|---|
| **images par seconde en défilement continu**, sur l'iMac 2015 | si < 20 im/s sur un terrain nu, **B est mort** — ShibuMap y ajouterait la mer, les nuages, le socle et les étiquettes |
| **millisecondes par bande** de mise à jour torique | si > 8 ms, le budget de §3.2 ne tient pas et l'analyse GPU devient obligatoire, pas optionnelle |
| **mémoire en régime permanent après 2 minutes de défilement** | si elle dérive au lieu de plafonner, l'indexation torique est fausse |

⚠️ **À faire hors du dépôt, dans un dossier jetable.** Un prototype qui entre dans `src/` n'en ressort jamais.

---

## 7. Ce qui n'a PAS été mesuré, et que je ne peux pas affirmer

1. **Rien n'a été mesuré dans un navigateur pendant cette étude.** Les temps de §2.4 viennent de Node 24 (même V8 que Chrome) sur les modules réels du dépôt. Les chiffres de VRAM, d'images/s et de tas JS sont **repris** des rapports du 2026-07-27.
2. **Les MNT des bancs sont synthétiques.** Le coût des flous par sommes glissantes ne dépend pas du contenu (c'est du O(1) par pixel), donc les temps sont valides ; mais le **biais de bord** de §2.4 et les **verdicts du masque de mer** de §3.3 ont été obtenus sur des reliefs fabriqués. Ils démontrent que le mécanisme existe et donnent son ordre de grandeur — **pas la valeur exacte qu'aurait Chamonix.**
3. **Le gain net de bande passante n'est pas chiffré** — seulement ses deux composantes (§3.3). Il faudrait enregistrer une vraie session.
4. **Rien de l'état de l'art de §1 n'a été exécuté.** Les chiffres de Hoppe, Strugar et Cesium sont **cités de leurs papiers et de leur code source**, pas reproduits. Les poids de tuiles AWS, les en-têtes CORS et les tarifs Cesium ion de §3.3 ont, eux, été **sondés en direct le 2026-07-29**. Restent **non vérifiés** : les tarifs MapTiler, les conditions de licence détaillées de Mapbox Terrain-DEM v1, le statut exact de `HeightmapTessellator` dans Cesium 1.143, et la compatibilité réelle de `3DTilesRendererJS` avec r172 **en pratique** — sa dépendance de pair dit `>= 0.167`, ce qui est une promesse, pas un essai.
5. **Le coût d'une réécriture GPU de `analyzeDem` n'est pas estimé.** Je sais qu'elle est structurellement possible (pyramide de flous doublants → mipmaps), que le précédent de Hoppe donne un facteur 18 sur un champ comparable, et qu'elle casse le test octet-pour-octet. Je ne sais pas combien de jours elle coûte.
6. **Je n'ai pas vérifié que l'ajout de champs à `loc` n'invalide pas les liens existants.** La lecture du code de validation (`share-link.js:123-158`) dit que oui ; ce n'est pas un test.
7. **`export-recorder.js` et l'usine à vidéos n'ont été lus que superficiellement.** Je sais qu'un défilement doit être figé pendant un rendu ; je n'ai pas vérifié comment le figer.

---

## Annexe — Les bancs de mesure

Trois scripts Node jetables, **hors dépôt**, dans le bac à sable de la session. Ils **importent** les modules de `C:\Dev\monolith-terrain\src\` en lecture seule et n'écrivent rien.

- `bench-clipmap.mjs` — coût de `analyzeDem`, `buildSeaMask` et `computeTerrainJob` de 128² à 1536². → le chiffre des **164 ns/pixel**.
- `bench-fenetre.mjs` — deux fenêtres de 1024² décalées de 128 px dans un même monde de 2048², comparaison du canal R dans la zone commune. → le **biais de bord de 64 px** et le **plancher de 1,7/255** qui révèle `robustScale`.
- `bench-mer.mjs` — une cuvette fermée, une fenêtre qu'on fait glisser. → **le lac qui devient prairie en 100 pixels.**
