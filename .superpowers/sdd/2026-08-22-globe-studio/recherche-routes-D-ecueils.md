# Routes — angle D : LES ÉCUEILS

**Date** : 2026-08-31
**Nature** : ÉTUDE. Aucune ligne de `src/` modifiée.
**La question posée** : pas « comment fait-on », mais **« qu'est-ce qui a mal tourné chez ceux qui l'ont déjà fait — nous compris »**.

**Statut des affirmations.** Trois niveaux, marqués partout :
- **[DÉPÔT]** — lu dans `C:\Dev\wt-merge` aujourd'hui (code, message de commit, plan). Chemin et ligne cités.
- **[SOURCE]** — lu dans une page web pendant cette étude. Lien cité.
- **[RAISONNÉ]** — déduction de ma part. Signalée comme telle, jamais présentée comme un fait.

⛔ **Aucun chiffre de ce document n'est inventé.** Chaque nombre porte l'un des trois marqueurs.

---

## 0. Les cinq écueils les plus graves, en cinq lignes

1. ⛔ **L'écueil n'était pas la donnée : c'était l'interdiction de la simplifier.** La spec du 2026-07-15 posait « **full fidelity — no simplification… even if heavy** » comme contrainte **non négociable**, ce qui excluait explicitement Protomaps/OpenMapTiles et forçait Overpass. **Le poids qui a tué le calque le 2026-07-29 est l'arithmétique de ce qu'on avait exigé quatorze jours plus tôt.**
2. **Le prix de cette contrainte est un facteur ~263.** Sur la boîte alpine, mesuré : l'ossature (`motorway`+`trunk`) pèse **3,8 Mo** ; le réseau complet, sentiers et marches d'escalier compris, pèse **~1 Go**. Le second n'existait que pour que le cran de détail 3 continue à montrer les `footway`.
3. **La source en direct est interdite ET toxique** — l'Overpass public tolère **moins de 100 requêtes et moins de 10 Mo par JOUR** pour un usage régulier et renvoie nommément les usages commerciaux vers un serveur payant ; une seule requête Chamonix z12 en pesait **15 Mo**, et une bbox z12 sur Paris a rendu **351 414 ways / 238 Mo en 200 OK** — un succès, donc aucun repli.
4. **La reconstruction, pas le réseau, était le poste dominant** — « rien ne sort du bloc » (contrainte n° 2 de la même spec) impose un écrêtage CPU cuit dans la géométrie : **10⁵ à 10⁶ tests par reconstruction**, puis un `BufferGeometry` recréé et réuploadé au GPU, à chaque changement de bloc.
5. ⛔ **L'écueil esthétique n'est pas celui qu'on croyait — ce n'est pas la route, c'est l'exagération verticale.** Swisstopo, la meilleure carte en relief du monde, affiche **toutes** les routes du pays. La règle du métier est inverse : *une ligne ne casse pas un relief ; un relief trop fort fait flotter la ligne, et c'est cette ligne flottante qui est laide*. ⚡ **ShibuMap exagère ×2,8 par défaut** — c'est ce réglage qui produirait la laideur, pas le calque.

**Et la réponse, en une ligne** : Cesium projette depuis le tampon de profondeur, deck.gl drape une texture, les moteurs de jeu compositent des décalques — **on ne dessine pas les routes au sol, on les peint dessus**. ⚡ **ShibuMap a déjà ce mécanisme en production (`aerial-layer.js`) : 0 octet déployé, 1,1 à 3,4 Mo par vue**, pendant que le calque vectoriel coûtait 13,2 Mo au chargement et jusqu'à 238 Mo par vue.

---

## 1. Le motif du retrait, tel qu'il est écrit dans le dépôt

Adrien l'a redit oralement : **« trop de temps à charger, trop lourd »**. Le dépôt dit exactement la même chose, et il dit en plus **où** était le poids.

### 1.1 Le commit de retrait — `af45f66`, 2026-07-29 [DÉPÔT]

> « ce système de routes ne me convient pas, très lourd, très mauvais, tu peux le supprimer. »

Le corps du commit nomme les deux sources et pourquoi aucune ne tenait :

| poste | chiffre | [DÉPÔT] |
|---|---|---|
| `public/data/map/roads.json` (Natural Earth 1:10m, cap scalerank 7) | **13 213 210 octets** versionnés — le plus gros objet servi du site | `af45f66` |
| gzip / brotli du même | **2 836 390 octets** gzippés, ~2,8 Mo en brotli | `af45f66` |
| code retiré | **-920 lignes, +333 = -587 net** ; 4 fichiers + 6 branchements | `af45f66` |
| tuiles Overture (la seule version fine) | ne couvraient **QUE** `lon 5–8 / lat 44,5–47` (Alpes franco-suisses) | `af45f66`, `src/map/tile-index.js:15` |

**Le trou de couverture était le vrai verdict** : hors de la boîte alpine, on retombait sur le Natural Earth grossier ou sur Overpass en direct. Le commit dit que c'est **ce trou qui condamnait aussi la fenêtre continue 3×3** — neuf fois la surface, avec des routes qui n'existent qu'en Savoie.

### 1.2 Le seuil qui a bloqué la voie tuilée — 887 Mo [DÉPÔT]

`src/map/tile-index.js:69` conserve la règle, appliquée depuis à un autre calque :

> « Même critère que celui qui avait fait reculer les **887 Mo de tuiles routières** (calque parti depuis) : ça ne part pas en production. »

Et `docs/superpowers/plans/2026-07-25-routes-tuiles-vectorielles.md` chiffre la même chose autrement : « les tuiles routes maison (Overture) pèsent **~1 Go**, n'ont jamais été déployées, et le chemin de code correspondant est mort en prod ».

⚡ **Le fait le plus important de tout ce dossier** : ces 887 Mo à 1 Go ne couvraient **qu'une boîte de 3° × 2,5°**. Ce n'est pas un budget mondial dépassé de peu — c'est un budget régional déjà hors d'atteinte.

### 1.3 Le tableau de mesures qui a servi à poser `OSM_MIN_ZOOM = 12` [DÉPÔT]

Encore lisible dans l'en-tête du fichier supprimé (`git show af45f66^:src/map/roads-layer.js`, lignes 27-32), mesuré en direct contre l'API publique :

| emprise | lieu | ways | charge Overpass | verdict du fichier |
|---|---|---|---|---|
| demZoom 10 (91 km) | Chamonix | **234 594** | **286 Mo** | « unusable » |
| demZoom 11 (46 km) | Chamonix | **48 707** | **62 Mo** | « still too heavy » |
| demZoom 12 (24 km) | Chamonix | **10 752** | **15 Mo** | « sane » |
| demZoom 12 (24 km) | **Paris centre** | **351 414** | **238 Mo** | **200 OK** — le repli ne se déclenche pas |
| demZoom 13/14 | Paris | — | — | **504** |

⚠️ **Le « succès toxique » est l'écueil le plus vicieux du lot** : le filet de sécurité était « échec → `null` → repli Natural Earth ». Un 238 Mo en **200 OK** n'est pas un échec. Le repli ne partait pas, et le fil principal partait sur un `JSON.parse` de 238 Mo. Corrigé plus tard par `[maxsize:48MB]` côté serveur + `assertSaneSize()` côté client (`f638e7c`) [DÉPÔT] — mais c'est bien la forme du bug qu'il faut retenir : **un garde-fou branché sur l'échec ne voit jamais le pire cas.**

### 1.4 Le piège Overpass qui a coûté deux crans de réglage — `c1ba90a` [DÉPÔT]

Mesuré en direct sur une bbox z13 de Chamonix :

| requête | résultat | temps |
|---|---|---|
| `way["highway"]` (test de tag nu) | **4 570 ways** | **927 ms** |
| `["highway"~"^(motorway\|trunk\|…)$"]` (prédicat regex) | **504** | **6,5 s** |

**La cause** : un prédicat regex fait scanner Overpass **chaque way de la bbox** au lieu de taper l'index de tags. Le 504 renvoyait `null`, donc repli silencieux sur un Natural Earth qui ne porte rien à ce zoom → **carte vide**. Deux des trois crans de détail rendaient une carte blanche pour cette seule raison.

⚡ **La leçon transposable** : *filtrer côté serveur coûtait 7× le temps et faisait échouer la requête ; filtrer côté client était gratuit et mutualisait le cache.* Le même commit note que le passage au tag nu a **fait tomber les trois crans sur une seule entrée de cache**, les bascules passant à **12–39 ms**.

### 1.5 Le coût qui n'était PAS le réseau — la reconstruction [DÉPÔT]

`docs/superpowers/plans/2026-07-29-fenetre-continue-3x3.md:610-615` :

- `map/block-clip.js` densifie chaque polyligne à un pas de **0,6 unité-monde**, teste chaque point, et **bissecte 7 fois** à chaque franchissement de bord.
- Pour les polygones d'eau : earcut + **Sutherland–Hodgman triangle par triangle** contre un contour de **192 sommets** → **5 760 tests `slabInside` rien que pour construire la fenêtre de découpe**.
- Volume déduit des charges Overpass : **10⁵ à 10⁶ appels à `insideBlock` par reconstruction**, chacun avec deux `Math.pow`. **Estimation du plan : 10 à 100 ms par reconstruction.** ⚠️ Le plan marque lui-même ce chiffre comme **estimé, non mesuré** (§ « ce que je n'ai pas pu vérifier », ligne 779).
- Et le plan ajoute que **le clip n'est même pas le poste dominant** : derrière lui, `buildLineSegments` **recrée un `BufferGeometry` et le réuploade au GPU**.

⚡ **La sortie est déjà écrite dans le dépôt, et personne ne l'a prise** : le shader du terrain porte **déjà** le `discard` de superellipse (`terrain.js:475-479`), `terrain.blockFootprint()` l'exporte déjà vers le JS, et `slabInside` en est la transcription littérale. **Porter ce `discard` dans les matériaux de ligne via `onBeforeCompile`** = construire la géométrie **non écrêtée une seule fois** et laisser le GPU couper gratuitement à chaque image. Une dizaine de lignes de GLSL déjà écrites et déjà testées ailleurs.

### 1.6 Le voisinage réseau — mesuré pendant un vol [DÉPÔT]

`docs/superpowers/plans/2026-07-27-damier-optimisation.md:250-260` :

- Le globe a émis **1 222 requêtes AWS z3–z7 pour 501 URL uniques** — soit **721 doublons** sur un seul vol.
- Une requête Overpass a duré **43,8 s** (3 requêtes, **130 s cumulés**).
- Le document note explicitement : *« Ce n'est pas `block-grid.js`, mais ça occupe la même connexion et le même fil pendant que le damier se construit. »*

⚠️ **721 requêtes en double, c'est un défaut de déduplication, pas un défaut de débit.** C'est exactement la classe de bug que le réseau routier amplifierait, puisqu'il ajouterait un jeu de requêtes par bloc traversé pendant la descente.

---

### 1.7 ⛔ LA CAUSE RACINE, ET ELLE N'EST PAS TECHNIQUE [DÉPÔT]

Tout ce qui précède découle de **deux contraintes déclarées non négociables le 2026-07-15**, quatorze jours avant le retrait. `docs/superpowers/specs/2026-07-15-map-layers-osm-sp2-design.md:12-21`, mot pour mot :

> « Deux contraintes utilisateur sont **non négociables et pilotent toute la conception** :
> 1. **Full fidelity — no simplification.** Les routes et cours d'eau OSM sont affichés exactement tels quels, pas de Douglas–Peucker, pas de généralisation, **même si c'est lourd**. → **Cela exclut Protomaps/OpenMapTiles** (pré-généralisés par zoom). La source est **Overpass** (géométrie OSM brute).
> 2. **Nothing leaves the block.** → Toutes les lignes drapées sont **géométriquement écrêtées** au bloc. »

Et la même consigne, en français, dans l'en-tête du script de cuisson (`git show af45f66^:scripts/build-road-tiles.mjs`, ligne 88) :

> « No Douglas-Peucker: road geometry is NEVER simplified, per the standing project constraint (**« tu as interdiction de modifier les routes et les ruisseaux, même si c'est lourd »**) »

⚡ **Lisez ces deux contraintes comme des causes, pas comme des règles :**

| la contrainte | ce qu'elle a produit mécaniquement |
|---|---|
| **1. Pas de simplification, même si c'est lourd** | exclut par construction **toute** livraison en tuiles vectorielles pré-généralisées → force **Overpass en direct** → force les 15 Mo de Chamonix et les 238 Mo de Paris → puis, quand on est passé aux tuiles Overture, force les **~1 Go régionaux** |
| **2. Rien ne sort du bloc** | force un **écrêtage géométrique CPU** cuit dans la géométrie → force la reconstruction complète à chaque changement de bloc → les **10⁵ à 10⁶ tests par reconstruction**, puis le réupload GPU |

⛔ **Le poids et la lenteur pour lesquels le calque a été supprimé le 2026-07-29 sont l'arithmétique exacte de ce qui avait été exigé le 2026-07-15.** Ce n'est pas un défaut qu'on a laissé passer : c'est une spécification qui a été honorée jusqu'au bout.

⚠️ Et le plan du 2026-07-25 avait **posé la question** — §4 « La décision produit à assumer », §7.1 « À trancher avec Adrien : le revirement de contrainte » [DÉPÔT]. **Elle n'a jamais été tranchée. Quatre jours plus tard, le calque partait.**

### 1.8 Le chiffre qui met un prix sur cette contrainte [DÉPÔT]

Le script de cuisson supprimé porte l'histogramme mesuré en direct sur la boîte alpine, et les trois budgets d'octets qui en découlent :

| LOD | zoom | classes gardées | poids **de la seule boîte alpine** |
|---|---|---|---|
| **LOD0** | z8 | `motorway` + `trunk` seulement | **3,8 Mo** (plus grosse tuile ~1,0 Mo) |
| **LOD1** | z11 | + `primary`, `secondary` | **42 Mo** (plus grosse tuile ~0,9 Mo) |
| **LOD2** | z14 | **tout**, y compris `footway` / `path` / `track` / `steps` | **~1 Go** |

Et l'histogramme régional qui l'explique (segments, mesurés en direct) :

| rang | classes | segments |
|---|---|---|
| 0 | motorway, trunk | **6 203** |
| 1 | primary | 40 617 |
| 2 | secondary | 60 461 |
| 3 | tertiary | 86 861 |
| 4 | unclassified, residential, living_street | 398 518 |
| 5 | service | 445 425 |
| **6** | **track, path, footway, cycleway, bridleway, steps** | **693 401** |
| 7 | reste | 54 710 |

⚡⚡ **LE CHIFFRE DE TOUTE L'ÉTUDE : l'ossature coûte 3,8 Mo, le réseau complet coûte ~1 Go. Un facteur d'environ 263.** Le commentaire du script dit pourquoi le LOD2 existait : *« notch 3 zoomed in must keep seeing footway/steps, so the closest LOD is never filtered by class at all »*.

⛔ **Autrement dit : l'écrasante majorité du poids du calque servait à afficher les sentiers, les trottoirs et les marches d'escalier** — sur un produit dont l'objet est de vendre un relief.

---

## 2. Écueil n° 1 — le drapage d'une ligne sur un relief à LOD variable

### 2.1 Ce que Cesium a dû construire pour y arriver [SOURCE]

Cesium n'a pas résolu ce problème avec une ligne posée sur le maillage. Il a construit une primitive dédiée, `GroundPolylinePrimitive` (Cesium 1.47), qui procède **par volumes d'ombre** : pour chaque segment, un volume est généré, et **pour chaque fragment du volume la profondeur du globe est relue pour reconstruire une position de terrain en espace œil**, puis écrêtée par des plans encodés dans la batch table ([PR #6615](https://github.com/CesiumGS/cesium/pull/6615), [billet « Polylines on Terrain »](https://cesium.com/blog/2018/07/23/polylines-on-terrain/)).

**Ce que ça dit** : les gens sérieux ont conclu qu'**on ne pose pas une ligne sur un terrain à LOD variable — on la projette depuis le tampon de profondeur.** C'est un rendu en deux passes, pas un `mesh.position.y`.

⚠️ Cette primitive **exige le support de la texture de profondeur** (`WEBGL_depth_texture`) ([doc GroundPolylinePrimitive](https://cesium.com/downloads/cesiumjs/releases/1.73/Build/Documentation/GroundPolylinePrimitive.html)).

### 2.2 Les limites publiques qu'ils traînent encore [SOURCE]

- **Perte de framerate même à l'arrêt.** [Issue #9533](https://github.com/CesiumGS/cesium/issues/9533) : le rapporteur mesure des polylignes non écrêtées « à ou autour de 60 fps sur du matériel correct », et des polylignes en `clampToGround` en 3D où « on a de la chance d'atteindre deux chiffres, même totalement au repos ». Sa lecture : le clampage semble **refait à chaque image**. ⚠️ **[SOURCE, non confirmé]** — le fil ne contient aucune réponse de mainteneur validant le diagnostic.
- ⚡ **L'exagération verticale casse la primitive.** [Issue #8480](https://github.com/CesiumGS/cesium/issues/8480) : `GroundPrimitive` et `GroundPolylinePrimitive` bornent leur volume d'ombre à partir d'`approximateTerrainHeights.json`. **Dès qu'on utilise un terrain personnalisé ou une exagération verticale, ces hauteurs ne valent plus rien et la géométrie au sol est écrêtée.** La correction proposée dans l'issue demande des changements d'architecture (attributs de hauteur mis à l'échelle dans le shader, ou reconstruction de la géométrie à chaque changement de terrain).

⛔ **Ce point nous vise directement.** `src/canopee.js:20` et `src/globe.js:2745` [DÉPÔT] : ShibuMap applique une **exagération verticale ×2,8 par défaut, et elle est CONTINUE** (`flags.js:104`, « décision 14 »). **La classe de solution que Cesium a mise dix ans à stabiliser est précisément celle qui casse sous exagération.** Toute reprise d'une bibliothèque de drapage sur étagère hérite de ce défaut.

### 2.3 Le z-fighting, et pourquoi ce n'est PAS notre problème [DÉPÔT]

C'est l'écueil le plus cité sur le web — et c'est le seul du lot qui soit **déjà réglé chez nous, proprement**.

Sur les forums de jeu, la réponse dominante est le compromis : soit de la géométrie (qui « z-fight comme un problème à distance »), soit des décalques rendus dans une cible séparée avec un biais de profondeur sévère ([GameDev.net, « Roads rendering on large terrain »](https://www.gamedev.net/forums/topic/704167-roads-rendering-on-large-terrain/5414305)). Et le problème du placage géométrique y est nommé : *il faut que la géométrie de route soit « 100 % parallèle » verticalement au terrain en tout point, sinon les routes flottent ou s'enfoncent* ([GameDev.net, « Best ways to draw roads on terrain? »](https://gamedev.net/forums/topic/404520-best-ways-to-draw-roads-on-terrain/)).

**ShibuMap a déjà les deux moitiés de la réponse en production :**

| problème | remède en place | [DÉPÔT] |
|---|---|---|
| la ligne s'enfonce / flotte | **`polygonOffset` sur les matériaux de ligne**, biais en espace de tampon de profondeur — constant à l'écran, indépendant de l'échelle, et **la géométrie reste au sol** | `src/gpx.js:1173-1180`, `src/map/water-layer.js:224-225`, `src/map/lake-material.js:148` |
| une élévation constante ne peut pas marcher | **écrit noir sur blanc, avec la mesure** : 0,16 unité de rehaussement vaut **37 m** à demZoom 13, **54 m** à z11, **260 m** à z10, **1 029 m** à z8 — « une élévation constante ne peut pas être juste à toutes les échelles, donc ce n'est pas son travail » | `src/gpx.js:488-500` |
| la ligne coupe la colline en droite | **`densifyWorld()`** densifie avant l'échantillonnage de hauteur — « une ligne suit la colline entre deux sommets éloignés au lieu de la traverser » | `src/map/draped-line.js:1-16` |
| le ruban traverse le relief | pas de **0,07 unité**, choisi **plus fin que la maille de terrain la plus dense** (~0,11 pour un bloc de 56 unités en 512 segments) — la corde reste sous la flèche du relief | `src/gpx.js` (`RUBAN_PAS`) |

⚡ **Constat** : `draped-line.js` et `line-segments.js` **ont survécu au retrait des routes** et servent aujourd'hui `water-layer.js` [DÉPÔT, vérifié par grep]. **Le pipeline de drapage n'est pas à réécrire. Il tourne.** Le calque Routes n'est pas mort de la géométrie ; il est mort de la donnée.

⚠️ **Une réserve à ne pas ignorer si l'architecture change** : `polygonOffset` est réputé ne pas mordre quand un tampon de profondeur logarithmique est actif ([forum three.js #31670](https://discourse.threejs.org/t/issue-with-z-fighting-on-highlight-material-on-mesh-with-logarithmicdepthbuffer-flag-on/31670)). ⚠️ **[SOURCE, non concluant]** — le fil s'arrête sur les questions du mainteneur, sans explication confirmée. **[RAISONNÉ]** la cause probable est que la profondeur logarithmique s'écrit dans `gl_FragDepth`, ce qui court-circuite le décalage appliqué par le rastériseur. **[DÉPÔT]** ShibuMap **n'active pas** `logarithmicDepthBuffer` aujourd'hui (grep : aucune occurrence dans `src/`) — donc le remède actuel est valide, mais **il tomberait si le globe continu passait à la profondeur logarithmique.** À écrire dans les contraintes du globe.

### 2.4 Ce que la 3D ne sait toujours pas faire proprement [SOURCE]

deck.gl, qui vise exactement ce cas d'usage, marque encore son `TerrainExtension` **expérimental**, et ses deux modes disent tout du compromis ([doc TerrainExtension](https://deck.gl/docs/api-reference/extensions/terrain-extension)) :
- **`drape`** — « chaque objet est **superposé comme une texture** sur la surface du terrain. **Toute altitude et extrusion de la couche sont ignorées.** » → recommandé pour « les données plates comme les polygones et les chemins ».
- **`offset`** — translation verticale par l'élévation **au point d'ancrage** seulement. Pour les objets 3D.

⚡ **Traduction** : la bibliothèque de référence du domaine, pour draper des routes, **ne les dessine pas en géométrie — elle les peint en texture.** C'est le même verdict que le fil GameDev, et le même que Cesium par un autre chemin.

---

## 3. Écueil n° 2 — le volume, et l'endroit exact où ça casse

### 3.1 La taille du réseau routier mondial [SOURCE, mesuré aujourd'hui]

Interrogé via l'API taginfo, **données arrêtées au 2026-08-31T00:59:28Z** ([taginfo, clé `highway`](https://taginfo.openstreetmap.org/keys/highway)) :

| ce qu'on demande | nombre de **ways** |
|---|---|
| **tout `highway`** | **266 614 488** |
| `residential` | 69 800 049 |
| `service` | 65 627 966 |
| `track` | 29 935 800 |
| `tertiary` | 9 136 899 |
| `secondary` | 5 850 701 |
| `primary` | 4 094 765 |
| `trunk` | 2 010 798 |
| `motorway` | 1 371 972 |

⚡ **Le chiffre à retenir n'est pas 266 millions — c'est 3,4 millions.** Même en ne gardant que le **haut** de la hiérarchie (`motorway` + `trunk`), le monde compte **3 382 770 ways**, avant toute densification, tout drapage, tout ruban. Et un « way » n'est pas un segment : c'est une polyligne de N sommets.

**[RAISONNÉ]** Ce chiffre suffit à trancher : **il n'existe pas de version « on charge le réseau mondial » de cette fonctionnalité.** La seule question ouverte est *où* on coupe et *comment* on livre.

⚡ **Et « où on coupe » est SPÉCIFIÉ, publiquement, par le schéma officiel des tuiles vectorielles d'OpenStreetMap.org.** [Shortbread 1.0, couche `streets`](https://shortbread-tiles.org/schema/1.0/) [SOURCE] — zoom minimum par classe :

| classe | minzoom |
|---|---|
| motorway | **5** |
| trunk | **6** |
| primary | **8** |
| secondary | **9** |
| tertiary | **10** |
| residential | **12** |
| service / track / path | **13** |

⛔ **Le calque supprimé faisait exactement l'inverse : il ne servait RIEN sous z12** (`OSM_MIN_ZOOM = 12` [DÉPÔT]) **puis TOUT au-delà** (cran 3 = `Infinity`). Shortbread étale la même information sur huit niveaux de zoom. **C'est la table qui manquait, et elle est publiée.**

⚠️ Ordre de grandeur du gain : Overture recense **~328 millions de segments routiers**, dont *« residential roads dominating at roughly 128 million »* et ~24 millions de `footway` ([Overture Transportation Guide](https://docs.overturemaps.org/guides/transportation/)) [SOURCE]. Filtrer sous z12 retire donc la grande majorité du volume.

### 3.2 Le poids d'un socle mondial livré correctement [SOURCE]

Protomaps, la référence du domaine, publie ses chiffres : « **un fichier planet complet fait environ 120 gigaoctets**, en incluant les zooms 0 à 15 » ([Protomaps, Basemap Downloads](https://docs.protomaps.com/basemaps/downloads)). La même page précise que le basemap est distribué comme une **« Produced Work » ODbL, attribution OpenStreetMap requise**, et **déconseille le hotlink** vers leurs fichiers : « vous devriez copier le tileset vers votre propre stockage cloud ».

**[RAISONNÉ]** À rapprocher des 887 Mo régionaux du dépôt : notre pipeline maison était **plus lourd par unité de surface** qu'un socle mondial généraliste. Ce n'était pas un problème de volume mondial — c'était un problème de **format de livraison**.

### 3.3 Où ça casse dans le navigateur — le poste nommé [SOURCE]

⚠️ Je n'ai **pas** trouvé de post-mortem chiffré du type « à N segments, l'onglet meurt ». Ce que j'ai trouvé nomme deux postes distincts :

- **Le nombre d'objets, pas le nombre de sommets.** Sur le forum three.js, un cas à **1 000+ lignes tombant à 10 fps** est diagnostiqué immédiatement : le rapporteur créait « une géométrie et un matériau pour chacune ». Réponse de `manthrax` : *« Tu devrais utiliser 1 géométrie et 1 matériau si possible »*, avec un tampon préalloué et un `setDrawRange()` pour piloter la portion visible ([three.js discourse #67635](https://discourse.threejs.org/t/improving-the-performance-of-high-density-lines/67635)). ⚡ **Le poste est le nombre d'appels de dessin, pas la géométrie.**
- **Le coût client du vectoriel, sur les machines faibles.** Un test de première main sur un Android d'entrée de gamme de 2020 sous Firefox : MapLibre GL JS « probablement moins de 10 images par seconde, le déplacement est saccadé », tandis que le raster OSM reste « raisonnablement fluide » ([blog.kronis.dev, « Vector maps are laggy »](https://blog.kronis.dev/blog/vector-maps-are-laggy)). ⚠️ **[SOURCE, anecdotique]** — un appareil, un navigateur, pas de profil détaillé. Sa conclusion est prudente : le vectoriel gagne sur les machines costaudes, le raster sur les autres.

**[DÉPÔT]** Chez nous, le poste dominant était nommé, et ce n'était ni l'un ni l'autre : c'était **le réupload GPU après reconstruction** (`buildLineSegments` recrée un `BufferGeometry`) et **le clip CPU** qui le précède (§1.5).

### 3.4 ⚡ Le classement des postes, chiffré — et la première surprise est que le décodage ne coûte RIEN [SOURCE]

| poste | coût mesuré | verdict |
|---|---|---|
| **Décodage protobuf (MVT)** | **439 tuiles / 37,5 Mo décodées en 195 ms** avec `pbf`, soit **~0,44 ms par tuile** ([README mapbox/pbf](https://github.com/mapbox/pbf)) | ⚡ **NÉGLIGEABLE** |
| **Poids réseau d'une tuile MVT** | une tuile de basemap OSM complète à **z14 pèse 340 octets en moyenne** (max 1,7 Mo) ([Planetiler PLANET.md](https://raw.githubusercontent.com/onthegomap/planetiler/main/PLANET.md)) | ⚡ **NÉGLIGEABLE** |
| **`JSON.parse` d'un gros GeoJSON** | **~200 ms par appel** pour 200 LineStrings de ~4 500 points, sur le fil principal ; à 5 mises à jour/s *« it's impossible for the worker to catch up… The website becomes unresponsive »* ([maplibre #106](https://github.com/maplibre/maplibre-gl-js/issues/106)) | ⛔ **BLOQUANT** |
| **Tessellation ligne → ruban** | le `line_bucket.ts` de MapLibre alloue **`len × 10`** — de l'ordre de **10 sommets par point d'entrée** ; join arrondi = un triangle tous les **20°** ; sommets supplémentaires à 15 px des angles > 75° ([line_bucket.ts](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/data/bucket/line_bucket.ts)) | ⛔ **STRUCTUREL** |
| **Appels de dessin** | « several thousand draw calls, and the frame rate collapses » à quelques milliers de `Mesh` individuels ([IGC, three.js géospatial](https://www.intelligentgraphicandcode.com/development/threejs-interfaces/geospatial)) | ⛔ **FATAL si non fusionné** |
| ⚡ **Mémoire GPU non libérée** | **~7 Go avant que Safari ne tue l'onglet, après ~40 s** de pan/zoom en boucle → **~210 Mo** après correctif. **Facteur ~33.** ([mapbox-gl-js PR #12924](https://github.com/mapbox/mapbox-gl-js/pull/12924)) | ⛔ **TUE L'ONGLET** |

⚡ **Deux leçons transposables immédiatement :**

1. ⛔ **Le format de transport est le vrai coupable, pas le décodage.** `geobuf` annonce *« typically makes GeoJSON 6-8 times smaller »* et *« 2-2.5x smaller even when comparing gzipped sizes »* — exemples : 101,85 Mo JSON → **12,24 Mo** ([README geobuf](https://github.com/mapbox/geobuf)). ⚠️ **Les 12,6 Mo de Natural Earth versionnés cumulaient les trois anti-patrons : format texte, chargement intégral quel que soit le champ de vue, et zéro filtrage par zoom.**
2. ⛔ **Un cache de tuiles JS correctement borné NE BORNE PAS la mémoire GPU.** Ce sont deux comptabilités séparées, et seule la seconde tue l'onglet. **Sans `texture.dispose()` / `geometry.dispose()` explicites à l'éviction, sortir une tuile du cache ne libère rien.** ⚠️ **C'est le piège le plus dangereux d'une descente continue, et il ne se voit dans aucun profil CPU.**

⚠️ **Et l'optimisation de la tessellation ne rachète rien** : une PR de Volodymyr Agafonkin lui-même sur mapbox-gl-js réduit les allocations « ~2 times » pour un gain estimé à *« roughly 5-10% less time spent tessellating lines »*, avec ce constat en revue : *« Layout benchmarks are not affected »* ([PR #8303](https://github.com/mapbox/mapbox-gl-js/pull/8303)). **Le coût est structurel. On ne l'optimise pas, on l'évite — en peignant au lieu de dessiner.**

---

## 4. Écueil n° 3 — la source en direct

### 4.1 Ce que les mainteneurs d'OSM disent vraiment [SOURCE]

Le wiki OSM, page Overpass API ([wiki OSM](https://wiki.openstreetmap.org/wiki/Overpass_API)) :

- **La nature du service** : « une API **en lecture seule** qui sert des parties choisies des données OSM ».
- **Le seuil « petit projet »** : « Vous pouvez supposer sans risque que vous ne gênez pas les autres utilisateurs quand vous faites **moins de 10 000 requêtes par jour et téléchargez moins de 1 Go par jour**. »
- ⚡ **Le seuil « usage régulier »** : « Si vous montez quelque chose qui utilise l'Overpass API **régulièrement**, alors divisez ces nombres par 100 (**moins de 100 requêtes récupérant moins de 10 Mo de données par jour**, c'est très bien). »
- ⛔ **La phrase qui tranche pour ShibuMap** : « **L'usage commercial devrait utiliser des serveurs Overpass auto-hébergés ou payants.** »
- Sur les gros volumes : « quand vous voulez extraire des régions de la taille d'un pays avec toutes (ou presque toutes) les données dedans, **il vaut mieux utiliser les miroirs planet.osm** ».
- Sur les erreurs : « Si vous recevez un code d'erreur HTTP tel que **429 ou 406, faites une pause de 30 secondes** avant une nouvelle requête. »

⛔ **Mettre les deux bouts ensemble** : la limite d'usage régulier est **10 Mo par JOUR**. Une **seule** requête de routes à Chamonix z12 en pesait **15 Mo** [DÉPÔT]. **Un unique visiteur qui charge une carte des Alpes dépassait le quota quotidien de l'application entière.** Et ShibuMap est un produit commercial, ce que la page exclut nommément du service public.

**[DÉPÔT]** Le dépôt le savait : `docs/superpowers/plans/2026-07-25-routes-tuiles-vectorielles.md` note que « l'usage backend-style est listé comme inacceptable par Overpass, et **qu'on s'est déjà fait bannir (429) depuis une seule IP en quelques dizaines de requêtes** ».

### 4.2 Les échecs silencieux [DÉPÔT]

Le même plan, constat 4 : « **Les échecs sont silencieux partout** : 429/504/timeout → `null` → repli pauvre sans que l'utilisateur sache pourquoi sa carte est vide. »

⚠️ **C'est l'écueil de produit, pas de technique.** Un client qui achète une impression et reçoit une carte sans routes parce qu'un serveur public a renvoyé un 429 dix secondes plus tôt n'a aucun moyen de le savoir. **Sur un produit vendu, une dégradation silencieuse est un défaut de livraison.**

### 4.3 Ce que le plan de juillet avait déjà tranché sur les fournisseurs [DÉPÔT]

`docs/superpowers/plans/2026-07-25-routes-tuiles-vectorielles.md`, citations vérifiées par ses auteurs contre les CGU MapTiler :
- cache serveur/CDN **interdit**, pré-téléchargement **interdit** ;
- export vidéo limité aux réseaux sociaux < 100 k abonnés, avec attribution à l'écran ;
- impression limitée à l'A4 **interne** ;
- **rien ne couvre la vente d'un export HD ou d'une carte de course à un client** ;
- l'offre On-Prem à 2 500 $/an **interdit de servir depuis un cloud public** (donc Netlify) sans accord ;
- le plan gratuit **interdit tout usage commercial** ; plancher réel **360 $/an**.

⛔ **Le verdict de juillet, non exécuté à ce jour** : migrer, mais vers du **PMTiles auto-hébergé**, « aucune clause d'export puisque c'est nous qui hébergeons ». OpenFreeMap avait été écarté comme dépendance critique d'un produit commercial parce qu'il repose sur une seule personne.

---

## 5. ⚡ Ce que font ceux qui y arrivent — et ce que ShibuMap a déjà sous la main

C'est la question la plus utile du dossier, et les trois traditions convergent sur **la même réponse**.

### 5.1 La convergence : on ne dessine pas les routes, on les PEINT

| qui | ce qu'ils font | source |
|---|---|---|
| **deck.gl** | mode `drape` : « chaque objet est **superposé comme une texture** sur la surface du terrain » — recommandé nommément pour « les données plates comme les polygones et les **chemins** » | [TerrainExtension](https://deck.gl/docs/api-reference/extensions/terrain-extension) |
| **Cesium** | ne pose pas de géométrie : il **relit la profondeur du globe par fragment** et projette la ligne dessus (volumes d'ombre) | [PR #6615](https://github.com/CesiumGS/cesium/pull/6615) |
| **le monde du jeu** | décalques rendus dans une **cible séparée**, composités sur le terrain à la passe finale — « le principe n'est pas de faire comparer les décalques au tampon Z, mais de les cuire dans le rendu final » | [GameDev.net](https://www.gamedev.net/forums/topic/704167-roads-rendering-on-large-terrain/5414305) |

⚡ **La règle commune** : *la géométrie de ligne au sol est un piège ; le sol est une surface, on lui peint dessus.*

#### ⛔ La preuve définitive : MapLibre fait EXACTEMENT ça pour son propre terrain 3D [SOURCE]

Ce n'est pas une opinion de forum, c'est une table de correspondance dans le code de production. [`src/webgl/render_to_texture.ts` de MapLibre GL JS](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/webgl/render_to_texture.ts) :

```js
/** lookup table which layers should rendered to texture */
const LAYERS_TO_TEXTURES = {
    background: true, fill: true,
    line: true,            // ← les routes
    raster: true, hillshade: true, 'color-relief': true
};
```

Commentaire du même fichier : *« Renders RTT-eligible layers into per-tile cached textures, then drapes them onto the terrain mesh. Slots live on each Tile so their lifetime tracks the tile itself. »* Et le point décisif : **le rendu n'est pas refait à chaque image** — il y a un cache par tuile (`if (tile.getRTT(stack)) continue;`) et une invalidation par empreinte (`"sorted_tile_keys#revision"`). Le fichier explique aussi pourquoi on empile les couches avant de peindre : *« due that switching textures is relatively slow, the render layer-by-layer context is not practicable »*.

⚡ **Et les deux constantes de dimensionnement sont lisibles**, dans [`src/render/terrain.ts`](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/render/terrain.ts) :
- `qualityFactor = 2` — **la texture RTT fait deux fois la taille de la tuile**, avec ce commentaire : *« to get good results with not too much memory footprint a value of 2 should be fine »*
- `meshSize = 128` — maille de terrain 128×128

⛔ **Ce sont des chiffres de production, directement réutilisables. Le moteur de référence du web dessine ses routes dans une texture par tuile, mise en cache, drapée sur le relief. Point.**

#### ⚡ Et Cesium a écarté le raster pour une raison qui ne s'applique PAS ici [SOURCE]

Les commentaires de l'[issue #2172 « Vector Data on Terrain »](https://github.com/CesiumGS/cesium/issues/2172) — ouverte en 2014 comme une simple bibliographie de six papiers de recherche — montrent que le raster **a été envisagé et rejeté** :

> *« re-rasterizing the texture, especially if we made a sparse quadtree out of it, would be **painfully slow** »*
> *« screen-space approaches (shadow volume, decal, etc.) to be much better **for runtime editing** than texture and sub-sampling approaches »*

⛔ **Aucune de ces objections ne porte sur le coût de RENDU. Toutes portent sur le coût de MISE À JOUR** — un utilisateur qui déplace une polyligne à la souris. **Le réseau routier de ShibuMap est statique. Le seul argument que Cesium oppose au raster ne le concerne pas.**

⚠️ Et le prix que Cesium paie pour ce choix est public : **26 FPS pour 2 000 polylignes** dans leur propre démonstration ([blog Cesium](https://cesium.com/blog/2018/07/23/polylines-on-terrain/)) ; **19 lignes de latitude** passant de « moins d'une seconde » à « plus de 8 secondes » avec `clampToGround` ([fil communauté #12052](https://community.cesium.com/t/seeking-latitude-line-solution-help-slow-performance-using-clamptoground-with-polylines/12052)) ; et en juin 2026, la [feuille de route officielle](https://cesium.com/blog/2026/06/29/help-shape-vector-data-support-in-3d-tiles/) annonce encore le « terrain clamping » **« dans les mois qui viennent »** — douze ans après l'ouverture de #2172.

⚠️ Et Cesium cite d'ailleurs le raster quand il veut que la donnée suive le terrain sans coût géométrique : cesium-native embarque [`RasterizedPolygonsOverlay`](https://raw.githubusercontent.com/CesiumGS/cesium-native/main/CesiumRasterOverlays/include/CesiumRasterOverlays/RasterizedPolygonsOverlay.h) — *« A raster overlay made from rasterizing a set of CartographicPolygon objects »*.

#### Le prix à payer du raster, chiffré [SOURCE + CALCUL]

⚠️ **Ce n'est pas gratuit, et il faut le dire.** Pour une route lisible (trait de 4-5 px sur une chaussée de ~8 m), il faut de l'ordre de **1 à 2 m/px**, donc **z16-z17**. Un bloc de 40 × 40 km entièrement rastérisé à z16 ferait environ **1,1 Go en RGBA non compressé** [CALCUL de l'agent, à partir de la géométrie Web Mercator].

Et les mainteneurs de PMTiles nomment exactement cet écueil ([discussion #350](https://github.com/protomaps/PMTiles/discussions/350)) : *« storing raster basemap tiles for the world is impractical… since typical applications need to zoom to z15+ and… requires storing **billions of tiles** »*.

⛔ **Donc : le raster routier doit être produit À LA DEMANDE, par tuile, dans le quadtree LOD qui existe déjà, avec cache et invalidation — jamais comme une texture monolithique ni comme un pré-rendu mondial.** C'est précisément ce que fait MapLibre, et c'est aussi ce que fait déjà `aerial-layer.js` [DÉPÔT].

### 5.2 ⛔ ShibuMap possède DÉJÀ ce mécanisme, en production, et il est mesuré [DÉPÔT]

`src/map/aerial-layer.js` **est** un drapage raster sur le bloc de terrain. Ses chiffres, mesurés sur trois zones de référence (mont St Helens z13, Chamonix z12, La Réunion z13), budget de texture 4096 :

| ce qu'on demande | imagerie | tuiles | canevas | mémoire |
|---|---|---|---|---|
| un bloc, aujourd'hui | z15 | **144** | 3072² | **36,0 Mo** |
| neuf blocs au même cran | z15 | 1 296 | 9 × 3072² | 324,0 Mo |
| **l'emprise 3×3, au MÊME budget** | z13 | **81** | 2304² | **20,3 Mo** |

Et le fichier dit la chose la plus importante en tête (`aerial-layer.js:1-6`) :

> « Rien n'est stocké. Les tuiles sont récupérées par vue directement depuis le WMTS public de chaque pays — mesuré **1,1 à 3,4 Mo pour une vue, 0 octet déployé**. La leçon des **887 Mo de tuiles routières** (ce calque-là a fini par quitter le site) portait sur des données qu'on **héberge** ; celui-ci n'héberge rien. »

⚡ **Le contraste est le résultat central de cette étude.** Deux calques, même surface, même bloc, même produit :

| | calque Routes (mort) | calque Photo aérienne (vivant) |
|---|---|---|
| forme | **géométrie vectorielle** | **texture raster drapée** |
| octets déployés | **13,2 Mo** versionnés + **887 Mo** de tuiles jamais livrées | **0** |
| octets par vue | 15 Mo (Chamonix z12) à 238 Mo (Paris z12) | **1,1 à 3,4 Mo** |
| couverture | boîte alpine 3°×2,5° | **19 fournisseurs nationaux + repli NASA mondial** |
| coût par changement de bloc | reconstruction : clip CPU + réupload GPU | une texture |
| état | **retiré le 2026-07-29** | **en production** |

**[RAISONNÉ, mais fortement étayé]** : le calque Routes n'est pas mort parce que les routes sont impossibles. **Il est mort parce qu'il a été fait en vecteur alors que le seul calque de ce dépôt qui tient l'échelle mondiale est raster.** La conclusion de deck.gl, de Cesium et des moteurs de jeu est la même que celle du dépôt — et le dépôt l'avait déjà écrite lui-même, dans le fichier du calque qui a survécu.

### 5.3 Les autres remèdes documentés, et ce qu'ils valent ici

- **Une géométrie, un matériau, un `setDrawRange()`.** Le conseil du forum three.js pour les lignes denses ([discourse #67635](https://discourse.threejs.org/t/improving-the-performance-of-high-density-lines/67635)) : tampon préalloué, mise à jour par attribut dynamique, plage de dessin. ⚠️ Chez nous, `buildLineSegments` **recrée** un `BufferGeometry` à chaque reconstruction [DÉPÔT] — c'est exactement l'anti-patron que ce conseil vise.
- **L'écrêtage par le GPU au lieu du CPU.** §1.5 : le `discard` de superellipse existe déjà dans `terrain.js:475-479` et n'a jamais été porté sur les matériaux de ligne. **C'est le remède le moins cher du dossier** — géométrie construite une fois, coupée gratuitement à chaque image.
- **Filtrer côté client, pas côté serveur.** §1.4 : mesuré 927 ms contre 6,5 s + 504, et un seul cache au lieu de trois.
- **Livrer en statique, pas en direct.** Le verdict de juillet [DÉPÔT] : PMTiles auto-hébergé, servi par requêtes de plage, zéro backend, zéro clé, zéro quota. Protomaps chiffre le planet complet z0–z15 à **~120 Go** [SOURCE] — ce n'est pas un budget Netlify, mais un extrait par classes de routes n'en est qu'une fraction. ⚠️ **Non mesuré : la taille d'un extrait `motorway/trunk/primary/secondary` mondial.** À mesurer avant tout engagement.
- **Ne pas hotlinker la source d'un tiers.** Protomaps le déconseille explicitement pour ses propres builds [SOURCE] ; le dépôt a la même discipline pour l'imagerie (`aerial-layer.js:129-150`, 178 sondes curl, licence citée par fournisseur, **liste noire assumée**) [DÉPÔT].

### 5.4 Le piège de service qui ressemble à un succès [DÉPÔT]

Deux occurrences dans ce dépôt, même forme, deux calques différents — c'est un patron, pas un accident :

1. **Overpass** : 238 Mo en **200 OK**. Le repli branché sur l'échec ne part pas.
2. **Imagerie** : des services nationaux (swisstopo, PDOK, PNOA, Bavière, NRW, Luxembourg, Taïwan) **répondent 200 avec une tuile de remplacement HORS de leur pays**. `aerial-layer.js:136-140` : « ils ne peuvent jamais être atteints par élimination — seul un test positif de polygone/boîte peut y router, sinon des blocs étrangers rendent silencieusement leurs tuiles blanches ».

⚡ **La règle à écrire une fois pour toutes** : **un code 200 n'est pas une réponse valide.** Toute source de routes devra être gardée par un test **positif** de couverture et un plafond de taille, jamais par un `catch`.

---

## 6. Écueil n° 4 — la licence et l'attribution, pour un produit qui se vend

⚡ **La bonne nouvelle d'abord, parce qu'elle change le cadrage** : vendre une carte en relief imprimée qui montre des routes OSM **est explicitement autorisé**. Le risque n'est pas la vente. Il est ailleurs, et il est à quatre endroits.

### 6.1 Pourquoi le partage à l'identique ne mord pas sur l'objet vendu [SOURCE]

L'ODbL 1.0 sépare la **Derivative Database** (soumise au partage à l'identique) de la **Produced Work** ([texte ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)). Le §4.5(b) dit que créer une Produced Work **ne crée pas** de base dérivée : **le partage à l'identique ne contamine pas l'image, le poster ou le rendu 3D.**

La guideline officielle de l'OSMF ([Community Guidelines/Produced Work](https://osmfoundation.org/wiki/Community_Guidelines/Produced_Work_-_Guideline), adoptée le 6 juin 2014) cite nommément, parmi les Produced Works habituelles, **« a map in a physically printed work »** — exactement le produit de la boutique.

⛔ **Mais le §4.6 pose la contrepartie, et c'est elle qui a coûté cher à quelqu'un** : si la Produced Work est fabriquée **à partir d'une base dérivée** que vous avez constituée, vous devez proposer cette base, lisible par machine, gratuitement en ligne. **[RAISONNÉ]** un pipeline qui cuit des tuiles routières retravaillées, simplifiées par zoom et fusionnées à un MNT est très probablement une base dérivée.

**Le précédent qui donne la mesure de la sanction réelle** [SOURCE] : le dossier **Geolytica**, dans les [minutes du Licensing Working Group du 4 mars 2024](https://osmfoundation.org/wiki/Licensing_Working_Group/Minutes/2024-03-04), qualifié dans ces minutes de « probablement la plus grosse violation ODbL de tous les temps ». Suite donnée : un nouveau jeu « OSM-free » livré à TomTom, **amputé de 3 millions de POI**. ⚡ **La sanction n'a pas été judiciaire — elle a été commerciale : ils ont dû démonter leur produit.**

### 6.2 ⚡ La guideline qui vise exactement « routes OSM + relief non-OSM » [SOURCE]

[Horizontal Map Layers — Guideline OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Horizontal_Map_Layers_-_Guideline), adoptée le 6 juin 2014 :
- Pour un **type de feature** donné, si toute la donnée de ce type vient d'ailleurs qu'OSM, le partage à l'identique ne s'y applique pas — **même si OSM sert pour d'autres types**.
- Inversement : **mélanger OSM et non-OSM pour un même type de feature déclenche le partage à l'identique**, et les séparer en couches n'y change rien.

**[RAISONNÉ, fondé sur ce texte]** : relief (Terrarium/Copernicus/GEBCO) = un type, 100 % non-OSM, intact. Routes = un autre type, 100 % OSM, donc ODbL, mais Produced Work en sortie. **La configuration de ShibuMap est la configuration favorable** — à une condition : ne jamais compléter les routes OSM par une autre source de routes.

⛔ **Et c'est précisément ce que fait Overture.** [Guide Transportation — Overture](https://docs.overturemaps.org/guides/transportation/) : le thème `transportation` est publié **sous ODbL parce qu'il inclut OSM**, et il est **enrichi de données routières commerciales TomTom**. La [FAQ Overture](https://overturemaps.org/about/faq/) qualifie ces thèmes de **« Derivative Database » au sens de l'ODbL v1.0**. Attribution exigée : **« © OpenStreetMap contributors, Overture Maps Foundation »** ([Attribution and Licensing — Overture](https://docs.overturemaps.org/attribution/)).

⚡ **Conséquence directe pour le dépôt** : la voie Overture, celle des 887 Mo, **n'allège rien juridiquement** — elle ajoute une seconde attribution obligatoire et supprime tout argument « mes routes ne sont pas OSM ». Le choix Overture était un choix de couverture, pas un choix de licence.

### 6.3 Le seuil au-dessous duquel l'attribution n'est pas due — et pourquoi il ne nous sauve pas [SOURCE]

[Substantial — Guideline OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline), 6 juin 2014 : est insubstantiel **moins de 100 features**, ou des features couvrant une zone d'**au plus 1 000 habitants**. **[RAISONNÉ]** un bloc ShibuMap fait 2 à 80 km de côté. On est très au-delà. **Pas d'échappatoire par le seuil.**

### 6.4 ⛔ Ce que les concurrents directs se sont pris — trois cas réels [SOURCE]

Ce sont **exactement** des vendeurs de posters cartographiques :

| qui | quand | le reproche |
|---|---|---|
| **Mapiful** | 7 mai 2018, [site d'aide OSM](https://help.openstreetmap.org/questions/63372/no-attribution-required-for-sites-like-mapifulcom) | Reconnaît utiliser OSM, mais **« plutôt caché dans une FAQ »** Zendesk. Réponse de la communauté, sans ambiguïté : **non, l'attribution est requise sur le tirage lui-même.** |
| **365canvas.com** | 17 nov. 2019, [OSM-talk](https://lists.openstreetmap.org/pipermail/talk/2019-November/083570.html) — titre du message : *Website selling OpenStreetMap prints without attribution* | Le signalant affirme avoir **inséré des données-pièges dans OSM et les avoir retrouvées dans le rendu**. Il note que **la découpe en forme de cœur masque l'attribution**. |
| **Printmijnstad** (NL) | 23 janv. 2022, [OSM-talk](https://lists.openstreetmap.org/pipermail/talk/2022-January/087247.html) | Aucune attribution, ni sur le site ni sur les produits imprimés. [Réponse](https://lists.openstreetmap.org/pipermail/talk/2022-January/087249.html) : mélange d'images statiques et d'imprimé, **attribution requise dans les deux cas**. |

Et il existe un **registre public et actif** des contrevenants : [Lacking proper attribution](https://wiki.openstreetmap.org/wiki/Lacking_proper_attribution), où figurent Mapbox, MAPS.ME, Apple Maps, Snapchat, Facebook/Instagram, DuckDuckGo Maps, AllTrails, DoorDash, Windy.com, Meteoblue…

⚠️ **La sanction est réputationnelle, publique, indexée et durable.** Elle n'est pas judiciaire : **il n'existe aucune jurisprudence ODbL**, et aucune suite (retrait, mise en demeure) n'a été trouvée pour les trois vendeurs ci-dessus.

### 6.5 Ce que l'attribution doit être, mot pour mot, sur un objet vendu [SOURCE]

[Attribution Guidelines OSMF](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), adoptées par le board le 25 juin 2021 — clause **marchandise physique** :

> *« Physical merchandise with an aesthetic component using OpenStreetMap data must provide attribution on any packaging, at the point of sale, and, to the extent possible, somewhere on the item itself. »*

Avec l'URL **`openstreetmap.org/copyright` imprimée en toutes lettres**. Et l'[avis d'attribution de la communauté](https://wiki.openstreetmap.org/wiki/Community_attribution_advice) liste ce qui **ne suffit pas** : rendre l'information disponible à qui la cherche ; un lien seul sur un imprimé ; **un QR code ou un lien sans texte explicatif** ; une attribution masquée par défaut ; une attribution noyée à côté d'un visuel accrocheur.

⚡ **Traduction pour la boutique** : trois endroits — **l'emballage, la page de commande, et le tirage lui-même**. Une mention en FAQ est exactement ce qui a valu à Mapiful d'être nommé publiquement.

### 6.6 Les fournisseurs à écarter, avec les clauses [SOURCE]

**Mapbox** — [Product Terms, 1er octobre 2025](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf) :
- **§1.7.2** — droits d'impression Studio limités à **100 copies numériques statiques haute résolution, sur toute la durée de vie du compte**. Cent. Pas cent par mois.
- **§1.10** — interdiction de redistribuer, vendre, louer, sous-licencier ou transférer le contenu.
- **§2.8.1** — cache limité à 30 jours sur l'appareil de l'utilisateur final ; **interdiction explicite de servir une image statique au lieu d'appeler les API**.
- **§2.7.1** — interdiction d'utiliser les résultats de géocodage pour développer **une carte imprimée ou numérique généraliste de quelque taille que ce soit**.

⛔ **Verdict** : un bouton « Publier » et une boutique violeraient §1.7 et §1.10. **Incompatible avec le modèle, sauf contrat de print rights négocié.** ⚠️ C'est **le même verdict que le plan interne du 2026-07-25 avait rendu sur MapTiler**, pour d'autres clauses (cache CDN interdit, impression limitée à l'A4 interne, rien ne couvrant la vente d'un export) [DÉPÔT]. **Deux fournisseurs majeurs, deux fois le même mur : ce n'est pas un accident de rédaction, c'est le modèle économique du secteur.**

**Google Maps Platform** — [FAQ officielle](https://developers.google.com/maps/faq) : *« If your application generates a document, either in electronic or printed form, no data from Google Maps Platform, including images, may be included in the document. »* ⛔ **Interdiction explicite. Pas une zone grise.**

### 6.7 Overpass, tuiles OSM, Nominatim : les quotas, en clair [SOURCE]

| service | la règle qui nous concerne | source |
|---|---|---|
| **Overpass** | usage **régulier** : **moins de 100 requêtes et moins de 10 Mo par JOUR**. **« Commercial use should use self-hosted or paid Overpass servers. »** 429/406 : pause de 30 s. | [wiki OSM Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) |
| **Overpass** | découragé nommément : **« monter une app pour autre chose que des mappeurs OSM en s'appuyant sur les instances publiques comme backend »**, et « coudre des bounding boxes pour scraper le monde ». Timeout 180 s, 512 Mio par requête. | [Overpass API Commons](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) |
| **Overpass** | le plafond s'applique **après** exécution : un 429 coûte le même temps qu'un 200 | [issue #333](https://github.com/drolbr/Overpass-API/issues/333) |
| **Tuiles OSM** | **bulk downloading interdit** (tout pré-chargement de tuiles non activement consultées). Blocage **sans préavis**, et avertissement explicite : vous ne pourrez alors **plus servir vos clients payants**. Aucun SLA. | [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) |
| **Nominatim** | **1 requête/seconde maximum**, cache obligatoire côté client, géocodage systématique interdit, *« applications whose primary function is related to geocoding must run their own service »* | [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) |

⛔ **Le rapprochement qui tranche** : la limite d'usage régulier d'Overpass est **10 Mo par jour**. Une **seule** requête de routes à Chamonix z12 pesait **15 Mo** [DÉPÔT]. **Un visiteur unique dépassait le quota quotidien de l'application entière.**

### 6.8 Les cinq gestes qui éteignent ce chapitre

1. Attribution **sur le tirage**, **sur l'emballage** et **au point de vente**, avec `openstreetmap.org/copyright` en toutes lettres. Plus « © OpenStreetMap contributors, Overture Maps Foundation » si Overture est dans la chaîne.
2. Attribution **visible sans interaction** dans l'app 3D — le dépôt a déjà cette discipline pour l'imagerie (`aerial-layer.js:129` : « l'attribution est une obligation LÉGALE, pas une politesse ; elle doit être visible quand l'imagerie l'est, et partir quand elle part ») [DÉPÔT].
3. **Ni Mapbox ni Google** dans ce qui finit imprimé.
4. **Ni Overpass public ni tuiles OSM publiques** en production : extraits pré-cuits, ou instance à soi.
5. Publier un point d'accès « données » offrant la base dérivée sous ODbL — une page, et le §4.6 est éteint définitivement.

---

## 7. Ce qui reste récupérable dans l'historique — et ce qu'il vaut

Le commit de retrait le dit lui-même : « **L'HISTORIQUE, lui, garde le blob** (un `git rm` ne réécrit rien) » [DÉPÔT]. Tout est là, à un `git show af45f66^:<chemin>` près.

| fichier supprimé | lignes | ce qu'il vaut aujourd'hui |
|---|---|---|
| `src/map/road-tier.js` | 78 | ⚡ **Le plus précieux du lot, et ce n'est pas du code de rendu : c'est de la cartographie.** Voir §7.1. |
| `test/road-tier.test.js` | 126 | Les tests du précédent, dont la régression nommée « the reported bug ». |
| `scripts/build-road-tiles.mjs` | 219 | ⚡ **Le seul endroit du dépôt qui porte l'histogramme mesuré du réseau routier et les trois budgets d'octets.** Toute la §1.8 en sort. |
| `src/map/roads-layer.js` | 165 | ⚡ **Le tableau de mesures Overpass** (§1.3). Le reste est du câblage. |
| `public/data/map/roads.json` | 13,2 Mo | Sans valeur : Natural Earth 1:10m, disponible en ligne, et grossier. |

Et ce qui **n'a pas été supprimé** et fonctionne toujours [DÉPÔT, vérifié par grep] : `src/map/draped-line.js`, `src/map/line-segments.js`, `src/map/block-clip.js`, `src/map/overpass.js`, `src/map/tile-index.js`, `src/map/tile-loader.js` — le pipeline de drapage, de découpe et de tuilage est **entier**, il sert `water-layer.js`, et il est décrit comme « déjà agnostique de la source — prouvé trois fois (Natural Earth, Overpass, Overture) » par le plan du 2026-07-25.

⚡ **La conclusion d'ingénierie** : refaire les routes ne veut pas dire réécrire le calque. Ça veut dire **changer la source et la forme de livraison**, et rebrancher ~250 lignes sur ~700 conservées (chiffrage du plan de juillet).

### 7.1 ⛔ La réponse cartographique était DÉJÀ écrite — et elle a été supprimée avec le reste

`road-tier.js` ne filtre pas sur les classes OSM absolues. Il **classe ce qui est présent dans l'emprise et renumérote densément depuis 0** [DÉPÔT] :

> « au lieu de filtrer sur les classes ABSOLUES (ce qui rend une carte vide quand une emprise n'a pas d'autoroute), on classe les classes de routes réellement PRÉSENTES et on les renumérote densément depuis 0. Quelle que soit la classe la plus importante présente, elle devient le rang 0 — sur une vallée alpine sans autoroute, **les nationales deviennent le rang 0**. »

Et la profondeur affichée dépend du zoom, par une table **mesurée**, pas devinée :

| emprise | cran 1 | cran 2 | cran 3 |
|---|---|---|---|
| demZoom ≤ 9 (≥ 181 km) | 1 rang | 1 rang | 2 rangs |
| demZoom 10–11 (46–91 km) | 2 | 3 | 4 |
| demZoom 12 (24 km) | 2 | 4 | 6 |
| demZoom ≥ 13 (< 12 km) | 2 | 4 | **∞** |

Avec le style qui suit le rang, et pas la classe : `motorway 2,6 px / primary 1,8 px / secondary 1,1 px`, et une rampe d'encre Tailwind slate qui **s'inverse en mode sombre** pour garder le plus fort contraste sur la chose importante [DÉPÔT, `roads-layer.js` STYLE / ROAD_SLATE_*].

⚡ **C'est exactement ce que la cartographie de relief demande : de la sélection, une hiérarchie relative, une graisse qui suit l'importance, et un réseau qui s'éclaircit quand la vue s'élargit.** Le calque n'est pas mort de mauvais goût. **Il est mort parce que le cran 3, à zoom fin, était `∞` — et que `∞` valait 693 401 sentiers et ~1 Go.**

⛔ **Une seule ligne de cette table portait tout le poids.** Remplacer `Infinity` par une profondeur bornée aurait ramené le LOD2 dans le budget du LOD1. Personne ne l'a proposé, parce que la contrainte « full fidelity, even if heavy » l'interdisait.

---

## 8. ⚡ Écueil n° 5 — l'esthétique. Et la réponse des cartographes n'est PAS celle qu'on attendait

⛔ **La question « est-ce que les routes vont enlaidir la carte en relief ? » est mal posée, et tout le corpus consulté le dit d'une seule voix.**

### 8.1 Le fait qui démonte l'hypothèse de départ [SOURCE]

**Swisstopo — la meilleure carte en relief du monde — montre TOUTES les routes du pays.** Mot pour mot sur leur page de fabrication : *« Jeder Gipfel, jede Strasse, jedes Haus – alles wird dargestellt »* (chaque sommet, chaque route, chaque maison — tout est représenté) ([swisstopo — Kartenherstellung](https://www.swisstopo.admin.ch/de/kartenherstellung)).

Et Kenneth Field, sur la LK25 : « la densité d'information est presque incroyable », obtenue « sans recourir à davantage d'omission et de simplification », avec « l'ombrage classique inspiré d'Imhof qui apporte clarté et luminosité à la topographie » ([MapCarte 206/365](https://mapdesign.icaci.org/2014/07/mapcarte-206365-swiss-national-map-125000-1088-hauenstein-by-swisstopo-2013/)).

⚡ **Donc l'argument « les grandes cartes en relief n'ont pas de routes » est faux.** Il fallait le vérifier ; il ne tient pas.

### 8.2 La règle réelle, formulée en une phrase [SOURCE]

> **Une ligne ne casse pas un relief. Un relief mal calibré casse une ligne — et c'est cette ligne cassée qui est laide.**

C'est la convergence de soixante-dix ans :

- **Tom Patterson**, sur la production du relief des parcs nationaux : l'objectif était de faire un relief *« light enough so as to not interfere with overprinting map information, such as place names and roads »* ([Creating Web Map Shaded Relief](http://www.shadedrelief.com/web_relief)). ⚡ **Le rang visuel ne s'obtient pas en renforçant la route : il s'obtient en bridant le relief en amont.**
- **Daniel Huffman**, et c'est le diagnostic exact du symptôme redouté : quand l'exagération est trop forte, *« the vectors float atop the landscape rather than feel integrated with it »*, parce que les composants vectoriels ne reçoivent pas les ombres. Son remède : *« consider toning down the vertical exaggeration some »*. Et : le terrain *« works better as a background, where we usually don't want many distracting, rapid changes in contrast »* ([Towards Less Blender-y Relief](https://somethingaboutmaps.wordpress.com/2022/01/13/towards-less-blender-y-relief/)).

⛔⛔ **C'EST LE POINT QUI VISE SHIBUMAP DE PLEIN FOUET.** L'exagération verticale par défaut est **×2,8** et elle est **continue** [DÉPÔT, `src/canopee.js:20`, `src/globe.js:2745`, `src/flags.js:104`]. La cause probable d'une future « laideur » n'est pas le calque routier — **c'est le réglage qui fait la beauté du produit aujourd'hui.**

Et Patterson le dit à sa façon, pour la 3D : *« too much vertical exaggeration can distort terrain to the point of misrepresentation »* ; en cas de doute, prendre un peu moins plutôt qu'un peu plus, car *« for most maps, boring is better than freaky »* ([3D Terrain Maps — Vertical exaggeration](http://shadedrelief.com/3D_Terrain_Maps/3dterrainmapsver.html)).

### 8.3 Les chiffres de calibration — utilisables tels quels [SOURCE]

| réglage | valeur | source |
|---|---|---|
| Plage tonale d'un relief **autonome** | 5 % → 95 % de noir | [Value-enhanced relief](http://www.shadedrelief.com/value/value.html) |
| Plage tonale d'un relief **de style suisse, destiné à recevoir de la surcharge** | **3 % → 85 %** de noir, « imprimé avec des encres claires » | [Creating Swiss-style shaded relief](http://www.shadedrelief.com/shading/Swiss.html) |
| Opacité de la couche relief en composition | **50 à 80 %** | [Terrain Texture Shader](http://www.shadedrelief.com/texture_shading/) |
| ⚡ **Le plancher de l'IGN, mesurable** | l'estompage du **SCAN 25 v3.0 ne descend JAMAIS sous RGB 166** (dégradé 166 → 254) | [DC SCAN25 v3.0, p. 10](https://formation.ne-perdez-plus-le-nord.com/acces/wp-content/uploads/Ressources/SCAN25_v3-0.pdf) |
| Largeurs de remplissage routier IGN au 1:25 000 (rapport) | **6 : 4 : 3** (large / moyenne / étroite), avec un **casing quasi constant** ~3-5 px pendant que le remplissage fond de moitié | mesures de l'agent sur la planche 600 dpi du [DC SCAN Express](http://julienas.ipt.univ-paris8.fr/vgodard/pub/enseigne/sig/memosig/fm31/DC_SCANExpress.pdf) |

⚠️ **Le plancher RGB 166 est une donnée publiée ; l'interprétation « c'est fait pour laisser de la place aux traits » est une déduction de l'agent, pas une phrase de l'IGN.**

### 8.4 ⚡ Le rationnement de la couleur — la règle d'Imhof appliquée au réseau [SOURCE]

**Imhof**, tel que reformulé par le guide de cartographie de l'Ordnance Survey : n'utiliser des couleurs fortes et profondément saturées que *« in small areas of extremes »*, éviter de les juxtaposer sur de grandes surfaces, et réserver les tons sourds et clairs à ce qui doit rester au fond ([OS — Colour](https://docs.os.uk/more-than-maps/geographic-data-visualisation/guide-to-cartography/colour)).

**Swisstopo applique exactement ça**, et sa légende est d'une simplicité brutale ([swisstopo — Unterschied Strassen/Wege](https://www.swisstopo.admin.ch/de/unterschied-strassen-wege)) :
- **orange** : autoroutes / semi-autoroutes
- **rouge clair et jaune** : routes principales
- ⚡ **tout le reste — routes, chemins, sentiers — en NOIR**, différencié uniquement par la **forme** du trait (double filet / plein / tireté)

Leur logique déclarée : *« Orange, gelb und hellrot – bei den farbig gekennzeichneten Strassen kommt Geschwindigkeit mit ins Spiel »* — la couleur signale la vitesse, rien d'autre.

**Et la recherche a mesuré l'écart France/Suisse.** Jérémie Ory (LaSTIG), Géoconfluences 2017 : *« l'IGN utilise une combinaison de variables visuelles "couleur" et "taille" […] rendant cette information visuellement très saillante, alors que Swisstopo utilise uniquement la variable visuelle "taille" »* ; la carte IGN porte des *« couleurs vives et brillantes, délivrant de forts contrastes »*, la suisse des couleurs plus ternes formant *« un ensemble plus harmonieux »* ([Les cartes topographiques ont du style !](https://geoconfluences.ens-lyon.fr/informations-scientifiques/a-la-une/carte-a-la-une/les-carte-topo-ont-du-style)).

⛔ **Pour un produit vendu pour sa beauté, c'est le modèle suisse qu'il faut copier, pas le français.** Une seule variable visuelle sur la route : la taille.

⚡ **Et ShibuMap avait déjà écrit ça.** `roads-layer.js` [DÉPÔT] : trois graisses (`motorway 2,6 px / primary 1,8 px / secondary 1,1 px`) et une rampe d'encre **slate** — pas de rouge, pas d'orange. **Le calque supprimé était plus proche de Swisstopo que de l'IGN.** Ce n'était pas le problème.

### 8.5 Les trois pièges spécifiques à la 3D — Patterson les a tous nommés [SOURCE]

Ils n'existent pas en 2D. Section **Lines** de *Making 3D Terrain Maps* ([shadedrelief.com](http://shadedrelief.com/3D_Terrain_Maps/3dterrainmapslin.html)) — où il commence par dire que les lignes sont *« most problematic for creating visual noise »* et qu'il **les évite chaque fois qu'il le peut** :

1. ⚡ **La largeur varie avec la pente.** *« The lines vary in width depending on the steepness and orientation of slopes. »* Une route drapée s'amincit sur les pentes vues de profil. **Le remède est une largeur en espace ÉCRAN, pas en espace monde** — et `Line2`/`LineMaterial`, que ShibuMap utilise déjà, fait exactement ça [DÉPÔT]. ⚠️ Cesium a dû construire une *« approximation of constant screen-space-width »* pour la même raison ([Polylines on Terrain](https://cesium.com/blog/2018/07/23/polylines-on-terrain/)).
2. **L'occlusion.** Une route qui disparaît derrière une colline sans traitement se lit comme un défaut de rendu, pas comme une carte.
3. **La perspective de trait.** Sa solution : découper la vue en **zones de profondeur**, chacune avec un trait légèrement plus fin vers le fond. Peu coûteux, et ça vend la profondeur.

⚡ **Et la technique qu'il recommande, qui rejoint exactement la conclusion technique de la §5** : **l'embossage** — *« etch roads into the landscape »*, **avec la direction de lumière alignée sur celle du terrain**. La route cesse d'être un calque posé dessus et devient une modulation du sol. **C'est un shader, pas un pipeline de données.** Et c'est le remède direct au symptôme de Huffman (« les vecteurs flottent au-dessus du paysage »).

### 8.6 ⛔ La vraie mauvaise nouvelle, et ce n'est pas les routes

**C'est la typographie.** Tout le corpus converge :

- Patterson invente une technique de halo dédiée (flouter et éclaircir **le terrain lui-même** sous une sélection adoucie, plutôt qu'un contour vectoriel qui *« look harsh and unrefined »*) et prévient : ⚡ *« **The cure should not be worse than the disease.** »* ([Creating Elegant Type Halos](http://shadedrelief.com/type-halos/))
- **Muir Way** supprime purement et simplement le texte de ses posters de parcs : *« major landforms, roads, and trails. **No text** — we let the landscape speak for itself »* ([Yosemite](https://muir-way.com/products/yosemite-national-park-poster)).
- **East of Nowhere** l'écrit dans sa FAQ : *« In areas with heavier shading, labels may be partially obscured »* ([FAQ](https://eastofnowhere.co/pages/relief-faqs)).

⚡ **Notez ce que Muir Way garde et ce qu'il jette : il garde les routes et les sentiers, il jette le texte.** C'est l'inverse exact de l'intuition de départ.

⛔ **Si un budget doit être arbitré entre « bien intégrer les routes » et « bien intégrer les toponymes », il va aux toponymes.** C'est là que les cartes en relief vendues échouent.

⚡ **Et ShibuMap a déjà tranché dans le sens de Patterson, sans le savoir.** `src/map/places-layer.js:197` [DÉPÔT] — Adrien, le 2026-08-02 : **« on enlève, par défaut pas de halo »**, et le commentaire précise que ce n'est pas l'interrupteur qui est bloqué, c'est le halo qui est **retiré du rendu**. C'est exactement le *« the cure should not be worse than the disease »* de Patterson, arbitré à l'œil. ⚠️ **Mais le corollaire n'a pas été tiré : sans halo, la lisibilité des toponymes dépend ENTIÈREMENT de la calibration du relief sous eux** — donc du même réglage d'exagération qui fera flotter les routes. **Les deux chantiers n'en font qu'un.**

### 8.7 Ce que montrent vraiment les cartes en relief vendues [SOURCE]

Trois régimes, et **la variable discriminante n'est pas la route** :

| régime | relief | hydro | routes | texte | exemples |
|---|---|---|---|---|---|
| **objet sculptural** | ✅ | ✗ | ✗ | ✗ | [Muir Way 3D Montana](https://muir-way.com/products/montana-3d-raised-relief-map) |
| **portrait du territoire** | ✅ | ✅ | ✗ | ~ | [Muir Way Hydrological](https://muir-way.com/products/california-hydrological-3d-raised-relief-map), [Raven « Landforms & Rivers »](https://longitudemaps.com/pages/raven-maps) |
| **carte de lieu habité** | ✅ | ✅ | ✅ | ✅ ou ✗ | [Raven US](https://geomart.com/products/united-states-topographic-wall-map-by-raven-maps-37-x-58), NPS, [Muir Way parcs](https://muir-way.com/products/yosemite-national-park-poster) |

- **L'hydrographie est la couche irréductible** : elle survit dans tous les régimes. La doctrine de l'ETH Zurich explique pourquoi — le réseau hydrographique et les courbes *« serve as a framework… and must be visible during the whole shading process »* ([ETH — Relief Shading / Design](https://ikgrelief.ethz.ch/design/)). ⚡ **Et ShibuMap a gardé son calque d'eau** [DÉPÔT]. Le bon calque a survécu.
- **Le NPS retire des choses, mais pas les routes** : Patterson y écarte les **courbes de niveau**, jugées « bruit graphique ».
- Et l'observation la plus fine du corpus, d'Andy Woodruff : le style NPS montre *« what's reachable by car »* — ⚡ **la route y est le critère de sélection de tout le reste** ([White Mountains](https://andywoodruff.com/posts/2023/white-mountains-map/)).

### 8.8 Le casing : un pansement, et quelqu'un a fait marche arrière [SOURCE]

Le liseré autour du trait est la technique la plus citée ([John Nelson, *Make lines legible, and POP, with casing*](https://adventuresinmapping.com/2026/01/14/make-lines-legible-and-pop-with-casing/) : *« a visually protective wrapper around our symbol »*, qui tient *« over most any background »*).

⚠️ **Mais le National Park Service l'a abandonné en 2023.** Jake Coolidge, *Park Tiles Standard road revision* : le problème était *« la difficulté de maintenir un contraste approprié qui fonctionne à la fois en zone rurale et urbaine »* ; la solution retenue a été de passer à des *« couleurs légèrement plus sombres qui n'ont besoin de peu ou pas de casing pour ressortir »*, avec **une hiérarchie portée principalement par la LARGEUR du trait plutôt que par la variation de couleur** ([NPS Maps blog](https://www.nps.gov/maps/web/blog/park-tiles-standard-road-revision)).

⚡ **Une valeur de trait bien choisie bat un liseré ajouté.** Et « hiérarchie par la largeur, pas par la couleur » est exactement la règle suisse — et exactement ce que `road-tier.js` faisait déjà [DÉPÔT].

### 8.9 Les cinq conditions non négociables, si on remet des routes

D'après le corpus, dans l'ordre de priorité :

1. ⚡ **Brider le relief AVANT d'ajouter quoi que ce soit.** Fenêtre suisse **3–85 %** de noir plutôt que 5–95 % ; plancher de type IGN (jamais sous ~RGB 166) ; opacité de la couche relief **50–80 %** ; éclaircir les basses terres, c'est là que passent les routes.
2. ⛔ **Baisser l'exagération verticale.** ShibuMap est à **×2,8** [DÉPÔT]. C'est le réglage qui fera flotter les routes. « Boring is better than freaky. »
3. **Appliquer la perspective aérienne** — contraste fort en altitude, faible en plaine ([Jenny & Patterson, *Aerial perspective for shaded relief*, CaGIS 48(1), 2021](https://www.tandfonline.com/doi/abs/10.1080/15230406.2020.1813052)). Ce n'est pas un effet : c'est le mécanisme qui libère automatiquement du contraste là où le réseau est dense.
4. **Rationner la couleur.** Trois classes colorées au maximum, sur la fraction infime du réseau qui les mérite ; **tout le reste en trait fin monochrome**, différencié par la forme et la largeur.
5. ⚡ **Élaguer.** *« If the feature is not critical to the purpose or understanding of the map, it should be removed »* ([OS — Generalisation](https://docs.os.uk/more-than-maps/geographic-data-visualisation/guide-to-cartography/generalisation)). ⛔ **Et c'est là que l'esthétique et la technique disent EXACTEMENT la même chose : les 693 401 sentiers qui pesaient ~1 Go sont aussi ceux qui aplatissent le relief en trame grise.** Les retirer coûte un facteur 263 en octets et rend la carte plus belle. **Il n'y a pas d'arbitrage à faire.**

### 8.10 Le test à faire avant de livrer [SOURCE]

Celui d'Axis Maps : ⚡ **reculer, ou plisser les yeux jusqu'à flouter la carte.** *« If you stand back or squint to blur the map, do the important elements still stand out? »* ([Axis Maps — Visual Hierarchy](https://www.axismaps.com/guide/visual-hierarchy)). Si le relief a disparu sous une trame de traits, il y a trop de routes. Si les routes ont disparu, le relief est trop fort. Si les deux tiennent, la hiérarchie est bonne.

⚠️ **Ce que l'agent n'a PAS trouvé, et qu'il faut savoir** : aucune critique de cartographe reprochant à un poster d'avoir **enlevé** les routes ; aucune formulation canonique des « six règles d'Imhof » (si quelqu'un les cite, demander la page) ; aucune charte graphique IGN publiée en document autonome ; aucune largeur de trait IGN publiée en millimètres.

⚠️ **Et la seule polémique publique documentée sur les cartes suisses ne portait PAS sur l'esthétique** : en janvier 2014, swisstopo a retiré de la LK25 les tracés de sentiers non visibles au sol, et a distingué « tireté = trace visible » de « pointillé serré = itinéraire balisé sans trace » ([SAC, *Punkte statt Striche*](https://www.sac-cas.ch/de/die-alpen/punkte-statt-striche-25948/)). ⚡ **La seule bagarre publique sur la meilleure carte en relief du monde portait sur QUELLES LIGNES TRACER, et avec quelle signature. Personne ne s'est plaint du relief.**

---

## 9. ⚡ Les écueils de réseau et de cache — et le cas où le conseil du web est FAUX ici

Le brief demandait « les autres pièges du même genre » que le goulot Overpass. **Le dépôt en a déjà trouvé plusieurs, mesurés, sur le chemin du globe** — et l'un d'eux réfute frontalement le remède le plus recommandé sur le web.

### 9.1 ⛔ « Mets un AbortController » est le conseil n° 1 du web. Ici, il est REFUSÉ, et pour trois raisons mesurées [DÉPÔT]

`src/globe.js:6438-6459`, mot pour mot :

> ⚠️ **« ON N'ANNULE QUE CE QUI N'EST PAS PARTI, ET C'EST UN CHOIX MESURÉ, PAS UNE FACILITÉ. »**
> 1. « le `.catch` de `_pump` **RÉESSAIE** une fois (`t.retried`) : **annuler une requête en vol relancerait donc la tuile qu'on voulait abandonner**. »
> 2. « `fetchTile` porte "pas de `signal`" : **la promesse est partagée entre tous les demandeurs de la même URL**, l'abandon de l'un annulerait la tuile des autres. `_tileMemo` dédoublonne par URL ; un `signal` y ferait tomber la tuile d'un globe parce qu'un autre a tourné la tête. »
> 3. ⚡ « **ET LE GAIN EST DANS LA FILE, PAS DANS LE VOL** : le vol est plafonné à six (`MAX_CONCURRENT`), la file montait à 558. **Annuler six requêtes ne rachète rien ; vider la file rachète tout.** »

⚡ **C'est le résultat le plus contre-intuitif de toute l'étude.** Le remède standard — annuler les requêtes obsolètes — est ici **une régression**, parce que le dépôt combine trois mécanismes qui le rendent nocif : une politique de réessai, une mémoïsation par URL, et un plafond de concurrence bas. **Toute reprise des routes doit hériter de ce raisonnement, pas du conseil générique.**

⚠️ **Et l'état actuel confirme la cohérence** : `AbortController` n'apparaît que dans `src/globe.js` (grep sur tout `src/`, aujourd'hui). ⛔ **La « Phase 0 » du plan du 2026-07-25 — AbortController + timeout client sur Overpass — n'a JAMAIS été implémentée pour `overpass.js`, `tile-loader.js` ni `geo-data.js`** [DÉPÔT]. Ce qui a été livré de cette phase, c'est le garde de taille (`[maxsize:48MB]` + `assertSaneSize`, `overpass.js:32/98/199`) — le « succès toxique », pas l'annulation.

### 9.2 Le vrai levier : la file, son plafond, et pourquoi 512 aurait tourné 30 secondes [DÉPÔT]

Banc `.banc/pano-latence.mjs`, panoramique de référence (90° à 4 km, 60 images), tuile à 87,6 Kio :

| débit | pic de tuiles en `loading` | zoom après 5 s d'immobilité | cache |
|---|---|---|---|
| 12 Mb/s | **558** | z7 | 1 588 |
| 3 Mb/s | **554** | z3 | 1 548 |
| 0,5 Mb/s | **546** | z3 | 1 548 |

⚡ **« LE PIC NE DÉPEND PAS DU DÉBIT — 558, 554, 546 sur un facteur 24. »** C'est **la frontière du quadtree** qui le fixe, pas le réseau : la règle sans-trou n'ouvre un niveau que lorsque les quatre enfants sont prêts, donc le nombre de tuiles demandables à une image est borné par la géométrie. **Le débit ne change que la vitesse à laquelle la file se vide, jamais sa hauteur.**

⚠️ Et le commentaire signale qu'une analyse antérieure avait vu le même fait (« plafonne à 286 à toutes les latences essayées ») et **en avait tiré la mauvaise conclusion**.

⛔ **L'arithmétique qui explique le témoin de chargement qui tourne encore après l'arrivée**, écrite dans le fichier :

> « une file de **512** à six requêtes simultanées et **359 ms la tuile** (12 Mb/s) met **trente secondes** à se vider — **elle travaille encore une demi-minute après que la caméra s'est arrêtée ailleurs**. À 256 c'est quinze secondes dans le pire cas, et la purge d'obsolescence (`_purgerFile`) la ramène en pratique à la frontière de l'image courante. »

`PLAFOND_FILE = 256`, choisi strictement sous le pic mesuré le plus bas (546, soit 47 %) et strictement sous le budget de cache (`CACHE_MAX_CONTINU = 1 700`, soit 15 %). ⚠️ Et le commentaire note qu'**une valeur inventée a déjà été réfutée à cet endroit précis** (512, au-dessus du budget de cache de l'époque).

⚡ **Transposition aux routes** : un calque routier ajouterait **sa propre file**, à la même frontière de quadtree, sur les mêmes six connexions. **Il faut qu'il partage le plafond et la purge du globe, pas qu'il en ouvre un second.** Le rappel des notes de projet est cohérent : porter purge + éviction, **pas** un second plafond.

### 9.3 La purge d'obsolescence, et le piège qu'elle porte [DÉPÔT]

`_purgerFile()` retire, une fois par image, ce que la file contient encore et que l'image courante n'a pas demandé. Sans elle : **546 tuiles encore `loading` cinq secondes après l'arrêt du panoramique, zoom effectif retombé de z15 à z3** — la file reste pleine de la vue d'avant et **refuse la vue d'après**.

⚠️ **Le piège nommé** : « **LES RACINES z2 NE SE PURGENT JAMAIS.** `_traverse` ne demande que des ENFANTS : une racine rendue à `empty` ne repartirait sur le réseau pour personne, et **toute la descente resterait bloquée derrière elle — sans erreur, sans test rouge, sans rien à l'écran.** »

⚡ **C'est la forme générale de l'écueil de purge** : purger trop rachète tout, sauf ce que personne ne redemandera jamais.

### 9.4 La déduplication — 721 requêtes en double sur un seul vol [DÉPÔT]

`docs/superpowers/plans/2026-07-27-damier-optimisation.md:250-260` : pendant le vol vers Le Var, le globe a émis **1 222 requêtes AWS z3–z7 pour 501 URL uniques** — **721 doublons**. Sur le même chemin critique, une requête Overpass a duré **43,8 s** (3 requêtes, **130 s cumulés**), et le document note qu'elle « occupe la même connexion et le même fil pendant que le damier se construit ».

Et le dépôt a déjà réparé une variante exacte de ce bug : `b90ab0c` — **« les neuf tuiles du bloc étaient téléchargées DEUX fois »** [DÉPÔT].

⚠️ **721 doublons, c'est un défaut de déduplication, pas de débit.** Un calque routier ajouterait un jeu de requêtes par bloc traversé : **c'est la classe de bug qu'il amplifierait le plus.**

### 9.5 Le contre-exemple qui valide toute la §5 : le cache d'Overpass [DÉPÔT]

Quand le filtrage est passé côté client (`c1ba90a`), les trois crans de détail sont **tombés sur une seule entrée de cache** — et les bascules entre crans sont passées à **12–39 ms**, contre une nouvelle requête à l'API publique auparavant.

⚡ **Une seule requête large mise en cache bat trois requêtes étroites.** C'est le même principe que « une géométrie, un matériau » du forum three.js, appliqué au réseau.

### 9.6 Ce que le web ajoute, et ce qu'il n'ajoute pas [SOURCE]

⚠️ **Je n'ai pas trouvé de post-mortem chiffré du type « à N segments, l'onglet meurt ».** Ce que j'ai trouvé nomme deux postes, et aucun des deux n'est celui qui a mordu ici :

- **Le nombre d'objets.** 1 000+ lignes à 10 fps, diagnostiquées immédiatement comme « une géométrie et un matériau par ligne » ; réponse : *« Tu devrais utiliser 1 géométrie et 1 matériau si possible »*, tampon préalloué + `setDrawRange()` ([three.js discourse #67635](https://discourse.threejs.org/t/improving-the-performance-of-high-density-lines/67635)). ⚠️ **Sans objet ici** : `buildLineSegments` fusionne déjà.
- **Le coût client du vectoriel sur machines faibles.** Sur un Android d'entrée de gamme de 2020 sous Firefox, MapLibre GL JS « probablement moins de 10 images par seconde, le déplacement est saccadé », contre un raster OSM « raisonnablement fluide » ([blog.kronis.dev](https://blog.kronis.dev/blog/vector-maps-are-laggy)). ⚠️ **[SOURCE, anecdotique]** — un appareil, un navigateur, pas de profil.

⛔ **Le dépôt en sait plus que le web sur ce sujet précis.** Les postes dominants ici sont nommés et chiffrés : la **taille de la file** (§9.2), la **reconstruction + réupload GPU** (§1.5), et le **poids de la donnée non simplifiée** (§1.8). Aucun des trois n'est le poste que la littérature générale met en avant.

---

### 9.7 Ce que le web confirme sur l'annulation — et pourquoi ça ne contredit PAS la §9.1 [SOURCE]

Le cas fondateur est spectaculaire. [mapbox-gl-native #1158, « Aggressively cancel requests when zooming and panning »](https://github.com/mapbox/mapbox-gl-native/issues/1158) (2015) :

> *« it appeared that we were queueing up requests for vector tiles but failing to cancel unnecessary requests. If you allowed the app to pan and zoom to the user location, **tiles would take upwards of a minute to load**. »*

⚡ **Plus d'une minute de chargement, non pas parce que le réseau est lent, mais parce que la file est saturée d'obsolètes.** C'est exactement le symptôme du témoin de chargement qui tourne après l'arrivée — et **le remède retenu par Mapbox n'était pas d'annuler le vol, c'était de vider la file**, ce qui est précisément la conclusion mesurée de `globe.js` (§9.1, point 3).

⚠️ **Et l'annulation elle-même est un débat non tranché chez MapLibre.** La [PR #2377](https://github.com/maplibre/maplibre-gl-js/pull/2377) a introduit l'annulation lors d'un zoom traversant plusieurs niveaux, a causé une régression ([#2577](https://github.com/maplibre/maplibre-gl-js/issues/2577)) et a déclenché un échange de fond : *« the previous behavior was by design »* — les LOD intermédiaires produisent un **gain de vitesse perçue** et gardent *« a pretty intelligible map the whole time »* plutôt qu'un écran vide. Issue : une **option**, [`cancelPendingTileRequestsWhileZooming`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/), défaut `true`, qui n'annule que les tuiles *« belonging to a farther (smaller) zoom level than the current one »*.

⚡ **Le compromis de production, pour une descente continue** : **garder les parents (LOD−1) comme image d'attente, annuler agressivement tout le reste.**

### 9.8 ⛔ Le piège vicieux qui frappe exactement une descente continue — ouvert depuis 2017 [SOURCE]

[mapbox-gl-js #5482, « Don't load tiles that will be shown in a very small number of frames while animating »](https://github.com/mapbox/mapbox-gl-js/issues/5482) — **toujours ouvert**. En oscillant entre z7,5 et z8,5, certaines tuiles sont *« repeatedly requested but **never cached** »* : elles restent en état `loading`, échouent au test `hasData()`, *« the tile is aborted, never finishes loading and is never cached »*.

⛔ **Une tuile annulée à 90 % ne rentre pas en cache.** Au prochain passage au même niveau, elle repart de zéro. **Une descente qui traverse et retraverse les mêmes niveaux peut retélécharger indéfiniment les mêmes octets sans jamais rien afficher.**

⚡ **Le seul filet est le cache HTTP du navigateur** — d'où l'importance d'un `Cache-Control: public, max-age=31536000, immutable` sur des tuiles versionnées. ⚠️ **Point à vérifier dans `public/_headers`** : le commit de retrait note que `roads.json` y était « le premier cité comme le motif de la politique de cache » [DÉPÔT] ; cette politique doit être relue avant toute nouvelle source.

Le même écueil est ouvert chez les autres : OpenLayers [#2428](https://github.com/openlayers/openlayers/issues/2428) (2014, *« the tile queue fills up very quickly during zooming, with tiles for all zoom levels that lie between the start and the end of the zoom »*), [#15293](https://github.com/openlayers/openlayers/issues/15293) (nov. 2023, ouvert), Leaflet [#4623](https://github.com/Leaflet/Leaflet/issues/4623) (2016, ouvert).

### 9.9 ⚡ La recette de throttle qui a survécu en production chez deux moteurs indépendants [SOURCE]

`handlePostRender()` d'[OpenLayers `src/ol/Map.js`](https://raw.githubusercontent.com/openlayers/openlayers/main/src/ol/Map.js), lu dans le code :

```js
let maxTotalLoading = this.maxTilesLoading_;   // 16 par défaut
let maxNewLoads = maxTotalLoading;
if (animatingOrInteracting) {
  const lowOnFrameBudget = Date.now() - frameState.time > 8;
  maxTotalLoading = lowOnFrameBudget ? 0 : 8;
  maxNewLoads    = lowOnFrameBudget ? 0 : 2;
}
```

⚡ **Au repos : 16 chargements simultanés. Pendant une interaction : 8 en vol, 2 nouvelles par image. Si l'image a déjà dépassé 8 ms : ZÉRO.** Et la file écarte à la volée ce que l'image courante ne demande plus (`if (!frameState || !(tileSourceKey in frameState.wantedTiles)) return DROP;`).

MapLibre a convergé sur des valeurs voisines ([`src/util/config.ts`](https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/src/util/config.ts)) : `MAX_PARALLEL_IMAGE_REQUESTS: 16`, `MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8`, `MAX_TILE_CACHE_ZOOM_LEVELS: 5`.

⚠️ **Le dernier chiffre est le plus utile pour une descente** : le cache MapLibre est dimensionné pour couvrir **cinq niveaux de zoom d'aller-retour**. **Si l'amplitude typique d'une descente ShibuMap dépasse 5 LOD, on sort du cache et on retélécharge.** Passer de 5 à 4 niveaux a mesuré **−3,6 % de mémoire, sans impact sur les FPS** ([maplibre PR #2581](https://github.com/maplibre/maplibre-gl-js/pull/2581)).

⛔ **Et `globe.js` a déjà tiré la même conclusion à sa manière** : `PLAFOND_FILE = 256`, choisi sous le pic mesuré (546) et sous le budget de cache (1 700) [DÉPÔT]. **Les deux moteurs et notre dépôt sont d'accord : la file se borne, elle ne s'annule pas.**

### 9.10 ⛔ Le thrashing de LOD : le vrai coupable n'est presque jamais le cache [SOURCE]

Le fil le plus instructif du dossier : [cesium-dev, « Terrain Tiles Constantly Reloading When Moving Camera »](https://groups.google.com/g/cesium-dev/c/NvnW8_cNEQM/m/L6FCmkVABgAJ). Patrick Cozzi recommande les deux leviers classiques (agrandir `tileCacheSize`, augmenter `maximumScreenSpaceError`). Réponse de l'utilisateur : *« I already tried both tricks but sadly, **they only just delay the tile swapping issue** (while also degrading the quality) »*.

⚡ **La cause racine, trouvée plus loin dans le fil** : son code appelait `globe.getHeight()`, qui renvoyait `undefined` **aux frontières de tuiles**, ce qui faisait **osciller sa caméra entre altitude 0 et altitude normale**. La caméra lit la hauteur → le terrain change de LOD → la hauteur change → la caméra bouge → nouveau LOD.

⛔ **Le piège n° 1 du thrashing n'est pas dans le cache : c'est une boucle de rétroaction caméra ↔ terrain.** ⚠️ **Et ShibuMap a exactement cette architecture** : une caméra qui suit le relief pendant la descente, et un `gardeHauteurs` dans `globe.js` [DÉPÔT] qui existe précisément pour que le socle ne soit pas purgé. **À vérifier avant d'ajouter quoi que ce soit qui change le LOD sous la caméra.** Le remède n'est pas d'agrandir le cache mais de **lisser ou verrouiller la hauteur de référence pendant le mouvement**.

⚠️ Et un mainteneur Cesium nomme l'autre moitié du problème ([#6226](https://github.com/CesiumGS/cesium/issues/6226)) : *« We'll also have to deal with the issue of **request thrashing** when the maximum memory usage is nearly reached. »* **Un cache saturé est PIRE qu'un petit cache : il consomme la mémoire ET la bande passante.**

### 9.11 Le témoin de chargement qui ne s'éteint jamais — la cause est documentée [SOURCE]

⚡ **Et elle est causée par la solution du §9.7.** [maplibre-gl-js #794](https://github.com/maplibre/maplibre-gl-js/issues/794), reproduction exacte : aller en A, attendre ; aller en B ; **avant que B ait fini, revenir en A**. Diagnostic dans le fil : *« the `sourcedata` or `error` events are fired from the `SourceCache#_tileLoaded` method… However, **when `VectorTileSource#abortTile` is called, the callback is not fired**. »* Correctif : un événement dédié, [PR #927 « Fire `dataabort` event when a tile request is aborted »](https://github.com/maplibre/maplibre-gl-js/pull/927), fusionnée le 1er février 2022.

⛔ **LA RÈGLE, ET ELLE EST COURTE : toute requête de tuile a TROIS sorties terminales — succès, erreur, ANNULATION — et les trois doivent décrémenter le même compteur.** Si on n'en compte que deux, on a le bug. Un `try/finally` autour du `await fetch()` est plus sûr qu'un décrément placé dans les branches.

⚡ **Et le remède structurel** : préférer un **état interrogeable** à une **comptabilité d'événements**. MapLibre expose `areTilesLoaded()` — *« Returns a Boolean indicating whether all tiles in the viewport from all sources on the style are loaded »*. **Un événement manqué laisse le témoin allumé à jamais ; un test d'état se recale à l'image suivante.**

### 9.12 Deux pièges d'implémentation qui coûtent une journée chacun [SOURCE]

- ⚠️ **`THREE.TextureLoader` ne peut pas être annulé.** Le mainteneur d'OpenLayers, sur [#5532](https://github.com/openlayers/openlayers/issues/5532) : *« there is **no good way to abort pending requests for an Image element's `src`**. You would have to load all images using `fetch` or `XMLHttpRequest`. »* **[RAISONNÉ]** Traduction three.js : `TextureLoader` passe par `<img>`. Pour une annulation propre, il faut `fetch` + `AbortController` + `createImageBitmap`.
- ⚠️ **Les `AbortError` noient la télémétrie.** [mapbox-gl-js #10498](https://github.com/mapbox/mapbox-gl-js/issues/10498) : *« The GL JS Docs examples have **113k instances** of unhandled errors resulting from aborting a fetch request »*. **Filtrer `err.name === 'AbortError'` dès le premier jour**, ou les remontées d'erreur deviennent inexploitables.

### 9.13 Le sharding de domaine est devenu nuisible [SOURCE]

⚠️ Réflexe fréquent pour contourner la limite de 6 connexions HTTP/1.1 : répartir les tuiles sur `a.`/`b.`/`c.`. **C'est aujourd'hui contre-productif.** [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x) : *« In HTTP/2, domain sharding is no longer useful… **Domain sharding is even detrimental to performance**. »* Et OSM l'a appliqué : les alias `a|b|c` ont été supprimés — *« the old `a|b|c` aliases are no longer needed to increase browser connection concurrency »*, et *« Using a single hostname also **improves cache efficiency** »* ([operations #737](https://github.com/openstreetmap/operations/issues/737)).

⚡ **Corollaire important** : HTTP/2 supprime la limite de 6 connexions, **qui agissait comme un throttle involontaire**. C'est précisément pour ça que les moteurs ont dû **réintroduire la limite en logiciel** (16/8 chez MapLibre et OpenLayers, `maxRequests: 6` chez deck.gl). ⚠️ **Un passage à HTTP/2 sans file logicielle empire la situation au lieu de l'améliorer.**

⚠️ **[SOURCE, à revérifier]** Un tableau communautaire de priorisation HTTP/2 ([andydavies/http2-prioritization-issues](https://github.com/andydavies/http2-prioritization-issues)) classe **Netlify, CloudFront, Google Cloud CDN et Azure en échec**, Cloudflare/Fastly/Akamai en succès. **Ces données datent d'environ 2019-2020 et sont communautaires.** Elles ne doivent pas fonder une décision d'architecture sans revérification — mais l'implication de prudence tient : **ne pas compter sur la priorisation HTTP/2 pour que les tuiles utiles passent devant les obsolètes. Gérer la priorité côté client.**

---

## 10. Les paramètres de départ, tous issus de code de production vérifié

⚠️ **Ce tableau n'est pas une recommandation d'architecture — c'est un relevé.** Chaque ligne a été lue dans du code ou une spec en production. **[RAISONNÉ]** pour la colonne « pourquoi ça nous concerne ».

| paramètre | valeur | source | pourquoi ça nous concerne |
|---|---|---|---|
| Texture de routes drapée | **taille de tuile × 2** | MapLibre `qualityFactor = 2` | dimensionne le rendu-vers-texture sans exploser la mémoire |
| Maille de terrain sous la texture | **128 × 128** | MapLibre `meshSize` | à comparer aux 512 segments actuels du bloc [DÉPÔT] |
| Zoom max des tuiles produites | **z14–z15**, puis **surzoom** | spec de style MapLibre | on ne paie jamais les niveaux au-delà |
| Filtrage par classe | motorway z5 · trunk z6 · primary z8 · secondary z9 · tertiary z10 · residential z12 · service/path **z13** | Shortbread 1.0 | la table que le calque supprimé n'avait pas |
| Poids max d'une tuile | **500 Ko** (`--maximum-tile-bytes`), **200 000 entités** max | tippecanoe | ⛔ si on dépasse, **on jette des entités**, on ne charge pas plus |
| File de requêtes | **16** au repos · **8** en interaction · **2** nouvelles/image · **0** si l'image dépasse 8 ms | OpenLayers `Map.js` | à comparer à `PLAFOND_FILE = 256` et `MAX_CONCURRENT = 6` [DÉPÔT] |
| Profondeur du cache | **5 niveaux de zoom** de va-et-vient | MapLibre `MAX_TILE_CACHE_ZOOM_LEVELS` | ⚠️ une descente qui traverse plus de 5 LOD sort du cache |
| Chargement des tuiles | `fetch` + `AbortController` + `createImageBitmap`, **jamais `TextureLoader`** | OpenLayers #5532 | sinon aucune annulation possible |
| Éviction | `texture.dispose()` **et** `geometry.dispose()` explicites | mapbox PR #12924 | sinon 7 Go et l'onglet meurt |
| Comptage du témoin | **trois** sorties terminales, ou un état interrogeable | maplibre #794 / #927 | la cause exacte du témoin qui ne s'éteint pas |

⚠️ **Ce que l'agent a explicitement refusé de citer** : les « budgets de draw calls » que l'on trouve en ligne (« viser moins de 100 », « 50-200 µs par appel ») viennent de blogs **sans citation**. Vérification faite, ce sont les affirmations non sourcées de leurs auteurs. **Ne pas les présenter comme des mesures.**

---

## 11. Ce que je n'ai PAS pu vérifier

⛔ **Lisez cette section avant de citer un chiffre de ce document ailleurs.**

### 11.1 Les chiffres du dépôt qui sont ESTIMÉS, pas mesurés

- **« 10 à 100 ms par reconstruction »** (§1.5) — le plan du 2026-07-29 le marque lui-même comme dérivé des charges Overpass, non instrumenté (`2026-07-29-fenetre-continue-3x3.md:779` : « Le coût de `block-clip.js` est une estimation, pas une mesure »).
- **« 887 Mo »** contre **« ~1 Go »** — deux chiffres pour la même chose, dans deux fichiers différents (`tile-index.js:69` et le plan du 2026-07-25). Je n'ai pas retrouvé la mesure d'origine ni su lequel fait foi.
- **La répartition du temps d'attente** entre latence réseau et file du navigateur n'a jamais été décomposée (`2026-07-27-damier-optimisation.md`, liste des non-vérifiés).
- **Le poids par vue** des tuiles routières LOD2 : le script dit que le ~1 Go régional « n'est PAS ce qu'une vue télécharge » et renvoie à un « task-18 report » que je n'ai pas ouvert. **Le chiffre qui compte vraiment — les octets par vue — n'est donc pas dans ce document.**

### 11.2 Ce que je n'ai pas mesuré et qu'il faudrait mesurer avant de décider

1. ⚡ **La taille d'un extrait mondial `motorway`+`trunk`+`primary`+`secondary` en PMTiles.** C'est LE chiffre manquant. On sait que le planet complet z0–z15 fait ~120 Go [SOURCE, Protomaps] et que l'ossature alpine fait 3,8 Mo [DÉPÔT]. **On ne sait pas ce que fait l'ossature mondiale.** Rien ne doit être engagé avant cette mesure.
2. **Le coût réel d'une route rastérisée dans la texture du bloc.** On sait ce que coûte la photo aérienne (144 tuiles / 36 Mo / z15) [DÉPÔT]. On ne sait pas ce que coûterait une couche de traits raster équivalente, ni s'il existe une source raster routière **utilisable commercialement pour l'impression** — ⚠️ les tuiles OSM publiques sont exclues par leur politique d'usage [SOURCE], et je n'ai pas d'alternative vérifiée à proposer.
3. **Le nombre de segments à partir duquel ce moteur-ci décroche.** Aucun banc n'existe. Les chiffres du web (1 000 lignes → 10 fps) portent sur **une géométrie par ligne**, ce qui n'est pas l'architecture de ShibuMap (`buildLineSegments` fusionne déjà).
4. **Le comportement de `polygonOffset` si le globe passait à la profondeur logarithmique.** Symptôme rapporté sur le forum three.js, **explication non confirmée par un mainteneur**. Aujourd'hui sans objet (`logarithmicDepthBuffer` absent de `src/`) [DÉPÔT], mais à retester si l'architecture change.
5. **L'amplitude réelle en niveaux de LOD d'une descente ShibuMap typique.** MapLibre dimensionne son cache pour **5 niveaux d'aller-retour** [SOURCE]. **Si nos descentes en traversent davantage, on retélécharge — et personne ne l'a mesuré.**
6. **Si la caméra ShibuMap lit une hauteur de terrain qui change avec le LOD.** C'est la cause racine du thrashing chez Cesium (§9.10). **Non vérifié dans ce dépôt.**

### 11.2 bis — les points que la recherche web n'a PAS pu établir

- ⚠️ **Aucun post-mortem chiffré « routes vectorielles en three.js, mesurées, abandonnées » n'existe publiquement.** Les projets three.js + OSM examinés présentent leur travail **sans jamais publier de chiffres ni de limites**. ⚡ **Le silence est lui-même le retour d'expérience : ce sujet n'a pas de littérature d'ingénierie publique.**
- ⚠️ **Le fonctionnement interne de Google Earth** — sources principales en 403. Aucune affirmation.
- ⚠️ **La limite de contextes WebGL simultanés par navigateur** (~8-16) : pas de source primaire. À revérifier avant d'en faire une décision.
- ⛔ **Les « budgets de draw calls » (« viser moins de 100 », « 50-200 µs par appel ») ne viennent que de blogs sans citation.** Vérification faite : ce sont les affirmations non sourcées de leurs auteurs. **Ne pas les citer comme mesures.**
- ⚠️ **Le tableau de priorisation HTTP/2 où Netlify figure en échec** date d'environ 2019-2020 et est communautaire. Statut actuel non vérifié.
- ⚠️ **Aucun benchmark HTTP/2 contre HTTP/1.1 spécifique au service de tuiles.**

### 11.3 Les points de droit que personne ne sait trancher

- ⚠️ **Il n'existe aucune jurisprudence ODbL.** Toutes les guidelines OSMF sont des interprétations du licencieur, pas des décisions de justice.
- ⚠️ **La frontière exacte entre « transformation triviale » et « base dérivée »** pour un pipeline 3D (drapage sur MNT, tuilage, simplification) n'est traitée explicitement nulle part.
- ⛔ **Et le dépôt et l'agent de recherche ne sont pas d'accord sur ce point.** `scripts/build-road-tiles.mjs` (supprimé) affirmait [DÉPÔT] : « les tuiles produites ici sont un simple sous-ensemble / une reprojection (subtype+class+quantize seulement, aucun contenu créatif ajouté), **pas une "derivative database" au sens du copyleft** ». L'agent, lui, penche pour l'inverse. **Aucun des deux n'a de source qui tranche.** À faire arbitrer avant de rouvrir un pipeline de tuiles.
- ⚠️ **Aucune guidance OSMF sur la responsabilité d'une plateforme quand ce sont les UTILISATEURS qui publient des cartes** — or ShibuMap a un bouton « Publier ». Question ouverte.
- ⚠️ **Aucune suite documentée** aux trois signalements de vendeurs de posters (Mapiful, 365canvas, Printmijnstad). Ils ont été nommés publiquement ; ni retrait, ni mise en demeure, ni sanction n'ont été retrouvés. **Et l'état actuel de leurs mentions d'attribution n'a pas été vérifié** — le constat sur Mapiful date de 2018.

### 11.4 Les points de cartographie non trouvés

- ⚠️ **Aucune critique de cartographe reprochant à un poster d'avoir ENLEVÉ les routes.** L'argument « il en faut pour que ce soit crédible » n'a aucune source dans ce corpus.
- ⚠️ **Aucune formulation canonique des « six règles d'Imhof ».** Si quelqu'un les cite, demander la page.
- ⚠️ **Aucune charte graphique IGN publiée en document autonome**, aucune largeur de trait publiée en millimètres. Les rapports 6 : 4 : 3 viennent de **mesures de pixels sur une planche de légende à 600 dpi**, pas d'une spécification.
- ⚠️ **Le plancher RGB 166 de l'estompage SCAN 25 est une donnée publiée ; l'interprétation « c'est pour laisser de la place aux traits » est une déduction.**
- ⚠️ **Le corpus Reddit n'a pas pu être consulté** (non atteignable par l'outil).

### 11.5 Un aveu de méthode

⚠️ **Le budget de recherche web de cette session a été épuisé avant la fin** (200 requêtes) ; la fin de l'étude s'est faite par `WebFetch` direct sur des URL connues. Le sujet le moins bien couvert est le seul qui compte encore : ⛔ **l'existence d'une source raster routière libre, mondiale, et utilisable commercialement pour l'impression.** Ce qui a été trouvé disqualifie les candidats évidents — `tile.openstreetmap.org` interdit le préchargement [SOURCE], Stadia Maps interdit l'usage commercial sur son palier gratuit [SOURCE], le raster CARTO est en cours de retrait [SOURCE]. **Aucune alternative vérifiée n'est proposée ici. C'est le trou le plus important de ce document.**

**Rien de ce qui est écrit n'a été comblé par de la mémoire : ce qui manque est déclaré manquant.** ⚡ **Et aucun chiffre n'est inventé** — chacun porte son marqueur, et ceux qui ne sont que des estimations le disent (§11.1).

---

## 12. ⛔ Verdict — faut-il remettre les routes ?

**Oui. Mais pas ce calque-là, et pas sous cette contrainte-là.**

### Ce que la recherche NE dit pas

Elle ne dit **pas** que les routes sont une mauvaise idée pour ce produit. Cette hypothèse-là a été testée et elle tombe : **Swisstopo montre chaque route du pays sur la carte en relief la plus admirée du monde** [SOURCE], **Raven Maps garde les routes sur ses posters vendus** [SOURCE], **et Muir Way, qui vend des posters de parcs, garde les routes et les sentiers et jette LE TEXTE** [SOURCE]. Le calque routier de ShibuMap était déjà stylé à la suisse (graisse relative, encre slate, hiérarchie par la taille) [DÉPÔT] et personne n'a jamais reproché sa laideur — le reproche écrit, mot pour mot, était : **« très lourd »**.

### Ce que la recherche dit, et c'est plus dur

**Le calque n'a pas échoué. Il a exécuté une consigne impossible.** La spec du 2026-07-15 déclarait « non négociable » de ne jamais simplifier, « même si c'est lourd », ce qui **excluait nommément la seule famille de solutions qui tient à l'échelle mondiale** (tuiles pré-généralisées). Quatorze jours plus tard, la conséquence arithmétique de cette consigne — 13,2 Mo au chargement, jusqu'à 238 Mo par vue, ~1 Go de tuiles régionales — a été jugée inacceptable, et le calque a été supprimé. **Le plan du 2026-07-25 avait posé la question du revirement de contrainte. Elle n'a jamais été tranchée.**

⛔ **Tant que cette contrainte n'est pas explicitement levée par Adrien, il ne faut PAS recommencer.** Toute nouvelle tentative sous « full fidelity, even if heavy » reproduira le même mur, avec le même verdict. **C'est la seule décision qui compte, et elle n'est pas technique.**

### Et si elle est levée, la recherche donne le chemin

Trois faits pointent tous dans la même direction, et c'est le meilleur résultat de cette étude :

| ce que dit la **technique** | ce que dit la **cartographie** | ce que dit le **dépôt** |
|---|---|---|
| le réseau complet coûte ~263× l'ossature, et ce sont les sentiers qui pèsent | *« si un objet n'est pas critique pour la compréhension de la carte, il doit être retiré »* — et une trame de traits fins aplatit le relief | `road-tier.js` implémentait **déjà** la sélection par rang relatif et par zoom ; il suffisait de borner l'`∞` du cran 3 |
| ⚡ **MapLibre dessine ses PROPRES routes dans une texture par tuile, mise en cache, drapée sur le relief** (`LAYERS_TO_TEXTURES = { … line: true … }`) — et Cesium n'a écarté le raster que pour l'**édition à l'exécution**, qui ne nous concerne pas | Patterson recommande **d'embosser** la route dans le terrain, lumière alignée sur celle du relief | `aerial-layer.js` drape déjà une texture sur le bloc : **0 octet déployé, 1,1 à 3,4 Mo par vue** |
| les lignes doivent avoir une largeur en espace écran, pas monde | Patterson : *« the lines vary in width depending on the steepness and orientation of slopes »* | `Line2` / `LineMaterial` le font déjà, et `polygonOffset` règle déjà le z-fighting |
| ⚡ **la table de zooms par classe est PUBLIÉE** (Shortbread : motorway z5 → service/path z13) | Swisstopo : trois classes colorées, tout le reste en trait fin monochrome — hiérarchie par la TAILLE, pas la couleur | `road-tier.js` a le rang relatif et les bandes de zoom ; il lui manquait juste la table |

⚡ **Autrement dit : les trois quarts de la réponse dorment déjà dans ce dépôt, et le quart manquant est publié.** Il ne manque ni moteur, ni technique de rendu, ni idée cartographique. **Ce qui manque, c'est une source livrée en statique, mondiale, et volontairement incomplète.**

### La recommandation, en quatre phrases

1. ⛔ **Faire trancher la contrainte de fidélité par Adrien, par écrit, avant toute ligne de code.** C'est la cause racine. Le reste en découle. Sans cette décision, ne rien commencer.
2. **Mesurer une seule chose avant de s'engager** : le poids d'un extrait mondial PMTiles limité à `motorway`/`trunk`/`primary`/`secondary`, filtré selon la table Shortbread. Si ce chiffre tient dans un budget Netlify, la voie est ouverte ; sinon elle est fermée, et on le saura en une journée au lieu de deux semaines.
3. ⛔ **Ne jamais rouvrir le cran de détail 3.** Les 693 401 `footway`/`path`/`track`/`steps` de la seule boîte alpine sont à la fois **l'écrasante majorité du poids** et **la couche qui écrase le relief**. Sur un produit qui vend un relief, ils n'ont aucune raison d'exister.
4. **Et si la contrainte est levée : peindre, ne pas dessiner.** Une texture de routes par tuile, rendue une fois, mise en cache, invalidée par empreinte, drapée par le shader de terrain qui existe déjà — l'architecture de MapLibre, appliquée par le mécanisme d'`aerial-layer.js`. **C'est le seul chemin où le coût cesse de dépendre de la quantité de routes.**

⛔ **Et une dernière, qui ne concerne pas les routes** : d'après le corpus cartographique, **le vrai point de rupture d'une carte en relief vendue n'est pas le réseau routier, c'est la typographie.** Si un budget doit être arbitré, il va aux toponymes.
