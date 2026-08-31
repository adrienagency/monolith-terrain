# Recherche — angle C : comment les grands font apparaître les routes progressivement

**Date :** 2026-08-31
**Question d'Adrien :** « Peut-on avoir des routes activables et désactivables progressivement en fonction du niveau de zoom ? »
**Motif du retrait précédent (donné par Adrien en cours de recherche) :** *« Les routes mettaient trop de temps à charger, c'était vraiment trop lourd. »* — donc **poids et temps de chargement**, ni licence, ni esthétique.

**Contrainte non négociable :** la descente de ShibuMap est **continue, sans crans**. Aucune solution ne doit réintroduire un palier visible.

**Convention de lecture :** ✅ = vérifié en lisant la source (fichier de style, code, spécification, brevet). 🟡 = rapporté par une source secondaire que je n'ai pas pu ouvrir moi-même. ❌ = non vérifié / spéculation, signalé comme tel.

---

## 0. Les quatre réponses courtes

1. **Oui, et c'est exactement le mécanisme d'allègement.** Tous les styles de référence font la même chose : ils ne chargent pas les mêmes classes de routes selon le zoom. Passer de « tout » à « autoroutes + nationales » divise le nombre d'objets par **~80** (voir §2).
2. **Le claquement s'évite par la largeur, pas par le filtre.** Deux styles de référence (OSM Carto, Positron) font apparaître chaque nouvelle classe à **une largeur sous-pixel** (0,4 à 0,5 px) et, pour Positron, **à opacité 0,5 qui monte à 1**. La classe n'apparaît jamais : elle émerge. Détail en §6.
3. **Étiquettes de routes : non.** Verdict tranché en §5. Elles coûtent le plus cher de toute la chaîne, elles sont le seul élément que MapLibre lui-même admet ne pas savoir stabiliser en zoom continu, et une carte décorative destinée à l'impression n'en a pas besoin.
4. **Il existe une classification bien plus agressive que celle des cartes 2D, et elle est utilisée par les vrais moteurs :** Natural Earth. **10 024 objets pour la planète entière** au rang le plus grossier. Chiffre compté par moi-même (§2.2).

---

## 1. La table maîtresse : classe de route × zoom d'apparition

### 1.1 Comment OpenStreetMap classe les routes

La clé est `highway=*`. La hiérarchie utilisée par tous les schémas est, du plus important au moins important :

`motorway` → `trunk` → `primary` → `secondary` → `tertiary` → `unclassified` → `residential` → `living_street` → `service` → `track` / `path` / `footway` / `cycleway` / `steps`

Chaque classe majeure a sa bretelle (`*_link`). Les schémas vectoriels regroupent ensuite : OpenMapTiles a une classe `minor` (= `living_street`, `pedestrian`, `road`), Protomaps a `highway` / `major_road` / `minor_road` / `path`, Tilezen a la même partition.

### 1.2 La table, six styles de référence, lue dans les fichiers

**Zoom de PREMIÈRE APPARITION de chaque classe.** ✅ tout ce tableau est lu dans les fichiers sources, pas de mémoire.

| Classe OSM | OSM Carto | Shortbread 1.0 | OpenMapTiles (données) | Positron (style sur OMT) | Protomaps Basemap | Tilezen |
|---|---|---|---|---|---|---|
| `motorway` | **6** | **5** | **4** | **5** | **3** ¹ | **5** |
| `trunk` | **6** | **6** | **4** | **5** | **6** | **6** |
| `primary` | **8** | **8** | **7** | **7** | **7** | **8** |
| `secondary` | **9** | **9** | **9** | **11** | **9** | **10** |
| `tertiary` | **10** | **10** | **11** | **11** | **9** | **11** |
| `unclassified` | **12** | **12** | **12** | **13** | **12** | **12** |
| `residential` | **12** | **12** | **12** | **13** | **12** | **12** |
| `living_street` | **13** | **13** | **13** | **13** | **12** | **13** |
| `service` | **14** | **13** | **13** | **15** | **13** | **13** (alley) |
| `track` | **13** | **13** | **14** | **15** | **13** | **13** |
| `cycleway` | **13** | **13** | **14** | **15** | **13** | **13** |
| `footway` | **14** | **13** | **14** | **15** | **13** | **13–15** ² |
| `path` | — ³ | **13** | **14** | **15** | **13** | **13** |
| `steps` | **14** | **13** | **14** | **15** | **13** | **13** |
| Bretelles `*_link` | 10 (bas zoom) / 13 | — | avec la classe mère | 12 | 11–14 selon la classe | 11–14 selon la classe |

¹ Protomaps applique une règle pays : aux États-Unis, `motorway`/`trunk` passent à z7, sauf le réseau `US:US` (z6) et les Interstates `US:I` (z3). C'est un aveu explicite qu'un seuil global ne convient pas partout.
² Tilezen : `footway` nommé ou vélo-désigné à ~13, `footway=sidewalk|crossing` à 15.
³ OSM Carto n'a pas de variable `@path-width` isolée dans la même série ; les chemins passent par `bridleway`/`cycleway`/`footway`.

### 1.3 Ces tables sont-elles cohérentes entre elles ?

**Oui à ±1 zoom pour les classes majeures, non pour le bas de la hiérarchie.** Le consensus est net :

- `motorway`/`trunk` : **z3 à z6** selon le style — écart de 3 zooms, c'est le plus gros désaccord et il vient de choix éditoriaux (Protomaps veut les Interstates dès z3, OSM Carto attend z6).
- `primary` : **z7–z8** — quasi-unanimité.
- `secondary` : **z9–z11**.
- `tertiary` : **z9–z11**.
- `unclassified`/`residential` : **z12–z13** — unanimité franche. **Personne ne descend en dessous de z12.**
- `service`, `track`, `path`, `footway` : **z13–z15**.

Le désaccord réel est sur `secondary`/`tertiary` (Positron les repousse à z11 alors que Shortbread les met à 9/10) et sur `service`/`path` (Positron à z15 contre z13 ailleurs). **Positron est systématiquement le plus tardif — c'est un style « clair » conçu pour être léger et discret.** C'est le style le plus proche de l'esprit de ShibuMap et c'est le plus économe. Ce n'est pas un hasard.

### 1.4 Extraits vérifiés, source par source

**Shortbread 1.0** — [shortbread-tiles.org/schema/1.0](https://shortbread-tiles.org/schema/1.0/) ✅
Le schéma publie directement la table : motorway 5+, trunk 6+, primary 8+, secondary 9+, tertiary 10+, unclassified/residential/busway 12+, living_street/service/pedestrian/track/footway/steps/path/cycleway 13+. Minzoom de la couche `streets` : 5. Tuiles jusqu'à z14, au-delà surzoom.

**Protomaps Basemap** — `tiles/src/main/java/com/protomaps/basemap/layers/Roads.java` ✅ (fichier téléchargé et lu)
```java
// Everything is ~14 at first
rule(use("pm:minzoom", 14), use("pm:minzoomName", 14), use("pm:minzoomShield", 12)),
// Freeways show up earliest
rule(with("pm:kind", "highway"), use("pm:minzoom", 3), use("pm:minzoomName", 11), use("pm:minzoomShield", 7)),
// Major roads show up early also
rule(with("pm:kind", "major_road"), with("pm:highway", "trunk"),     use("pm:minzoom", 6),  ...),
rule(with("pm:kind", "major_road"), with("pm:highway", "primary"),   use("pm:minzoom", 7),  ...),
rule(with("pm:kind", "major_road"), with("pm:highway", "secondary"), use("pm:minzoom", 9),  ...),
rule(with("pm:kind", "major_road"), with("pm:highway", "tertiary"),  use("pm:minzoom", 9),  ...),
// Minor roads and paths show up a little early
rule(with("pm:kind", "minor_road"), use("pm:minzoom", 12)),
rule(with("pm:kind", "minor_road"), with("pm:kindDetail", "service"), use("pm:minzoom", 13)),
rule(with("pm:kind", "path"), use("pm:minzoom", 12)),
```
⚡ **Noter `pm:minzoomName` : le nom d'une autoroute n'apparaît qu'à z11, celui d'une route secondaire à z12, d'une tertiaire à z13.** Le nom arrive systématiquement **8 zooms après la géométrie**. C'est un argument de plus pour §5.

**OpenMapTiles** — `layers/transportation/update_transportation_merge.sql` et `class.sql` ✅ (fichiers téléchargés et lus)
La cascade réelle, table par table :

| Table | Construite à partir de | Filtre de classe | Simplification | Filtre de longueur |
|---|---|---|---|---|
| `..._gen_z11` | `osm_highway_linestring_gen_z11` | tertiary et au-dessus | — | — |
| `..._gen_z10` | z11 | `highway NOT IN ('tertiary','tertiary_link','busway')` | `ST_Simplify(geometry, ZRes(12))` | — |
| `..._gen_z9` | z10 | aucun | `ST_Simplify(geometry, ZRes(11))` | — |
| `..._gen_z8` | z9 | `highway IN ('motorway','trunk','primary')` | `ST_Simplify(ST_LineMerge(ST_Union(geom)), ZRes(10))` | — |
| `..._gen_z7` | z8 | motorway/trunk/primary | — | — |
| `..._gen_z6` | z7 | `highway IN ('motorway','trunk')` | `ST_Simplify(geometry, ZRes(8))` | `ST_Length > 100` |
| `..._gen_z5` | z6 | motorway/trunk | `ST_Simplify(geometry, ZRes(7))` puis `ST_LineMerge(ST_Union(...))` | **`ST_Length > 500` après fusion** |
| `..._gen_z4` | z5 | motorway/trunk | `ST_Simplify(geometry, ZRes(6))` puis fusion | **`ST_Length > 1000` après fusion** |

Et pour les zooms hauts, `class.sql` ✅ :
```sql
CREATE OR REPLACE FUNCTION transportation_filter_z12(highway text, construction text) RETURNS boolean AS
  ... WHEN highway IN ('unclassified', 'residential') THEN TRUE
      WHEN highway_class(...) IN ('motorway','trunk','primary','secondary','tertiary','raceway', ... 'busway','bus_guideway') THEN TRUE
      ELSE FALSE
CREATE OR REPLACE FUNCTION transportation_filter_z13(...) AS
  ... WHEN transportation_filter_z12(highway, construction) THEN TRUE
      WHEN highway = 'service' ... THEN service NOT IN ('driveway', 'parking_aisle')
      WHEN highway_class(...) IN ('minor', 'minor_construction') THEN TRUE
```
et dans `transportation.sql` : `WHEN zoom_level >= 14 THEN TRUE` — c'est-à-dire **tout**.

⚡ **Le fait le plus important de cette table pour ShibuMap :** OMT n'utilise pas seulement la classe. Aux zooms 4-6 il applique **un filtre de longueur après fusion** (`> 100 m`, `> 500 m`, `> 1000 m`). Un tronçon d'autoroute isolé de 300 m disparaît à z5 même si sa classe est autorisée. C'est le filtre le plus efficace en rapport gain/effort, et il est indépendant de la classification.

**Positron (CARTO, style MapLibre sur données OpenMapTiles)** — `basemaps.cartocdn.com/gl/positron-gl-style/style.json` ✅ (téléchargé et parcouru)

| Couche | minzoom | filtre |
|---|---|---|
| `road_mot_case_noramp` | 5 | `class == motorway`, pas rampe |
| `road_trunk_case_noramp` | 5 | `class == trunk` |
| `road_pri_case_noramp` | 7 | `class == primary` |
| `road_sec_case_noramp` | 11 | `class in (secondary, tertiary)` |
| `road_minor_case` | 13 | `class == minor` |
| `road_service_case` | 15 | `class == service` |
| `road_path` | 15 | `class in (path, track)` |
| `roadname_major` | 13 | étiquettes |
| `roadname_pri` | 14 | étiquettes |
| `roadname_sec` | 15 | étiquettes |
| `roadname_minor` | 16 | étiquettes |

**OSM Carto** — `style/roads.mss` ✅ (téléchargé et lu)
Le style ne filtre pas par `minzoom` de couche : **il définit une largeur, et la classe existe à partir du zoom où une largeur existe.** Extrait littéral :
```
@motorway-width-z6:  0.4;   @trunk-width-z6:  0.4;
@motorway-width-z7:  0.8;   @trunk-width-z7:  0.6;
@motorway-width-z8:  1;     @trunk-width-z8:  1;     @primary-width-z8:  1;
@motorway-width-z9:  1.4;   @trunk-width-z9:  1.4;   @primary-width-z9:  1.4;  @secondary-width-z9:  1;
@motorway-width-z10: 1.9;   ...                                                @secondary-width-z10: 1.1;  @tertiary-width-z10: 0.7;
@motorway-width-z12: 3.5;   ...                                                                             @residential-width-z12: 0.5;  @unclassified-width-z12: 0.8;
@residential-width-z13: 2.5;  @living-street-width-z13: 2;  @bridleway-width-z13: 0.3;  @cycleway-width-z13: 0.7;  @track-width-z13: 0.5;
@footway-width-z14: 0.7;  @service-width-z14: 2;  @steps-width-z14: 0.7;  @pedestrian-width-z14: 3;  @road-width-z14: 2;
```
⚡ **Regarde les premières valeurs : 0,4 px. 0,5 px. 0,7 px. 0,3 px.** Toute nouvelle classe entre **sous le pixel**. C'est la réponse au claquement, écrite dans le style de référence d'OpenStreetMap.

OSM Carto sépare aussi ses sources : la couche `roads-low-zoom` interroge la table `planet_osm_roads` (la table « routes majeures » d'osm2pgsql) et n'est active que de **z6 à z9** ; à partir de z10 le style bascule sur `roads-fill` qui interroge `planet_osm_line` (toutes les lignes). ✅ (`project.mml`)
👉 **C'est précisément la solution au problème d'Adrien : deux jeux de données, pas un seul filtré à la volée.**

**Tilezen (Mapzen)** — `yaml/roads.yaml` ✅
motorway 5, trunk 6, primary 8, secondary 10, tertiary 11, unclassified 12, residential 12, living_street 13, pedestrian 13, path/track/cycleway/bridleway 13, footway sidewalk/crossing 15, service alley 13.
⚡ Deux choses notables. D'abord Tilezen utilise des **`min_zoom` fractionnaires** : les données Natural Earth entrent avec `min_zoom` 5.0 / 5.1 / 5.2 selon leur rang, ce qui étale l'apparition à l'intérieur d'un même zoom entier. Ensuite Tilezen **utilise Natural Earth pour z3–z5 puis OSM au-delà** — exactement l'architecture à deux sources que je recommande en §7.

**Mapbox Streets v8** — [docs.mapbox.com](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/) ✅ (page lue)
La documentation donne `minzoom: 3` pour la couche `road` mais **ne publie aucune table classe × zoom.** Le filtrage est fait dans le style, pas dans le tileset, et le style Mapbox Streets n'est pas librement lisible. Un seul détail de zoom est documenté : *« From zoom levels 6 through 10, `ref` values are attached to separate points rather than lines to optimize symbol placement. »* — c'est-à-dire que **même Mapbox déporte les étiquettes de route sur des points dédiés entre z6 et z10 pour que le placement tienne.** Encore un argument pour §5.

---

## 2. Le poids : combien d'objets, classe par classe

⚡ C'est la question qui a tué la version précédente. Voici les chiffres.

### 2.1 Volumes bruts OpenStreetMap (taginfo, API v4, consulté le 2026-08-31) ✅

Nombre de **ways** portant chaque valeur de `highway`, planète entière :

| Classe | Nombre de ways | Part | **Cumul si on s'arrête ici** | **% du réseau total** |
|---|---:|---:|---:|---:|
| `motorway` | 1 371 972 | 0,51 % | 1 371 972 | **0,5 %** |
| `trunk` | 2 010 798 | 0,75 % | 3 382 770 | **1,3 %** |
| `primary` | 4 094 754 | 1,54 % | 7 477 524 | **2,8 %** |
| `secondary` | 5 849 978 | 2,19 % | 13 327 502 | **5,0 %** |
| `tertiary` | 9 135 547 | 3,43 % | 22 463 049 | **8,4 %** |
| bretelles `*_link` (5 classes) | 2 663 460 | 1,00 % | 25 126 509 | **9,4 %** |
| `unclassified` | 18 523 850 | 6,95 % | 43 650 359 | **16,4 %** |
| `residential` | 69 799 737 | 26,18 % | 113 450 096 | **42,6 %** |
| `living_street` | 2 335 162 | 0,88 % | 115 785 258 | **43,4 %** |
| `service` | 65 623 965 | 24,61 % | 181 409 223 | **68,1 %** |
| `track` | 29 934 914 | 11,23 % | 211 344 137 | **79,3 %** |
| `footway` | 32 493 580 | 12,19 % | 243 837 717 | **91,5 %** |
| `path` | 16 442 495 | 6,17 % | 260 280 212 | **97,7 %** |
| `cycleway` + `steps` + `pedestrian` | 5 178 213 | 1,94 % | 265 458 425 | **99,6 %** |
| **Total réseau routier OSM** | **≈ 266 600 000** | 100 % | | |

*(Total déduit de la fraction publiée pour `residential` : 69 799 737 / 0,2618 ≈ 266,6 M. Cohérent avec la somme des lignes à 0,4 % près.)*

**Ce que dit cette table :**

- **S'arrêter à `tertiary` (le choix de tous les styles jusqu'à z11) coûte 8,4 % des objets.** C'est un facteur **12** par rapport à tout charger.
- **S'arrêter à `primary` coûte 2,8 %.** Facteur **36**.
- **S'arrêter à `trunk` coûte 1,3 %.** Facteur **79**.
- ⛔ **La falaise est entre z11 et z13.** Passer de tertiary (8,4 %) à residential (42,6 %) multiplie le volume par **5**. Ajouter `service` le remultiplie par **1,6** — et `service`, ce sont les allées de parking et les voies d'accès, invisibles et sans intérêt sur une carte en relief.
- ⚠️ **`service` seul (65,6 M) pèse plus que toutes les classes de `motorway` à `unclassified` réunies (43,7 M).**

**Réserve honnête sur ces chiffres :** ce sont des **ways OSM**, pas des segments rendus, ni des sommets. Un way peut faire 20 m ou 20 km, et les tuileurs fusionnent puis redécoupent. La densité n'est pas uniforme : une tuile z14 sur Paris ou Tokyo est 100× plus chargée qu'une tuile z14 sur le Massif central. Ces pourcentages sont un **ordre de grandeur du rapport entre classes**, ce qui est exactement ce qui était demandé — pas une prévision de taille de tuile.

### 2.2 L'alternative agressive : Natural Earth ✅ (compté par moi-même)

J'ai téléchargé `ne_10m_roads.geojson` depuis le dépôt officiel `nvkelso/natural-earth-vector` (50,5 Mo) et compté les objets.

| | Objets |
|---|---:|
| **Total, planète entière** | **56 600** |

Répartition par `scalerank` (le rang d'échelle de Natural Earth, conçu pour piloter l'affichage par zoom) :

| scalerank | Objets | **Cumul (≤ rang)** |
|---:|---:|---:|
| 3 | 10 024 | **10 024** |
| 4 | 5 707 | **15 731** |
| 5 | 4 107 | **19 838** |
| 6 | 5 771 | **25 609** |
| 7 | 8 521 | **34 130** |
| 8 | 7 106 | **41 236** |
| 9 | 13 152 | **54 388** |
| 10 | 2 212 | **56 600** |

Par type : `Major Highway` 9 752, `Secondary Highway` 9 025, `Road` 11 531, `Unknown` 25 766, `Beltway` 168, `Ferry Route` 309, `Track` 39, `Bypass` 5.

⚡ **10 024 objets pour la planète entière au rang 3.** Contre 266 600 000 pour OSM complet — un rapport de **1 à 26 600**. Et 56 600 objets pour l'intégralité du jeu, soit **moins que ce qu'OSM contient de `motorway` sur un seul grand pays**.

Ce n'est pas une curiosité : **Tilezen, un schéma vectoriel de production, utilise littéralement Natural Earth pour ses zooms 3 à 5 puis bascule sur OSM** ✅ (`yaml/roads.yaml`, bloc `&ne_min_zoom`). L'architecture à deux sources est un patron éprouvé, pas une bidouille.

Licence Natural Earth : domaine public. ✅ (politique affichée du projet — je n'ai pas relu le texte de licence intégral, à confirmer avant usage commercial, cf. §8.)

### 2.3 À quel zoom la donnée devient-elle ingérable ?

Réponse structurelle, appuyée sur trois faits vérifiés :

1. **Aucun style de référence ne descend `residential` en dessous de z12, et Positron le repousse à z13.** Six styles indépendants sont d'accord. C'est là que ça casse.
2. **OSM Carto change carrément de table SQL à z10** (`planet_osm_roads` → `planet_osm_line`). Un projet vieux de quinze ans, optimisé au maximum, a jugé qu'interroger la table complète en dessous de z10 n'était pas tenable. ✅
3. **Tippecanoe considère par défaut qu'une tuile dépassant 500 Ko compressés ou 200 000 objets est cassée** et se met à jeter des objets (`--maximum-tile-bytes` 500K, `--maximum-tile-features` 200000). ✅ C'est la borne que l'industrie s'est donnée.

❌ **Je n'ai pas pu mesurer le nombre réel d'objets par tuile z14** sur un serveur de tuiles public — cela demandait une clé d'API. Voir §8.

---

## 3. Google Maps, Google Earth, Apple Maps — le documenté, le déduit, le supposé

### 3.1 Ce qui est DOCUMENTÉ

**La classification routière publique de Google** ✅ (lue dans la référence de style de l'API Maps JavaScript) :

| Type d'entité Google | Description officielle |
|---|---|
| `road` | « selects all roads » |
| `road.highway` | « selects highways » |
| `road.highway.controlled_access` | « selects highways with controlled access » |
| `road.arterial` | « selects arterial roads » |
| `road.local` | « selects local roads » |

C'est tout. **Quatre niveaux là où OSM en a douze.** Google n'expose aucun seuil de zoom dans cette documentation. La seule mention de zoom concerne les étiquettes : *« Label text fill and stroke colors change based on the zoom level. »*

**Le brevet Apple US8928698B2, « Compression of road features in map tiles »** ✅ (lu sur Google Patents ; cessionnaire Apple Inc., déposé le 2012-12-05, publié le 2015-01-06). Extraits verbatim :

> « A class (also called classification) of a road segment pertains to the type of road, which can relate to the size of the road, where the road travels, and other factors. »

> « The classifications can form a hierarchy, where different classifications have a different level of importance. For example, road class 1 would be of greater importance than road class 6, which can impact whether a road is displayed or not at a particular zoom level. »

> **« Each class can have a cutoff of zoom level for when to display the roads of a class. »**

> « Thus, each higher level of classification can be of more importance and can continue to be displayed at a lower zoom level, while display of road segments of lower importance classifications can be stopped once the zoom level drops below a threshold. »

⚡ **C'est la confirmation, écrite par Apple, que leur système fait exactement ce que fait OSM Carto : un seuil de zoom par classe de route.** Le brevet ne publie pas les valeurs.

**Le brevet Google US8937627B1, « Seamless vector map tiles across multiple zoom levels »** ✅ (cessionnaire Google LLC, déposé le 2012-03-28, délivré le 2015-01-20). Extraits :

> « Overlaying zoom-level specific styles on each map tile will cause a visual mismatch. This is particularly true when using vector map data, where the style is often applied at the client device using zoom-level specific styles. »

> « The use of map styles across zoom levels allows the seamless display of map data when there is a mismatch of map data and styles on a display at the same time. »

> **« Style information may be interpolated from the front to the back of the perspective view. »**

⚡ **Ce brevet est directement le sujet d'Adrien.** Google a breveté, en 2012, le fait de **découpler le zoom de la donnée du zoom du style** et d'**interpoler le style** au lieu de le commuter. Et la phrase sur la « perspective view » dit qu'en vue inclinée, le style est interpolé **du premier plan vers l'arrière-plan** — parce qu'en perspective, le fond de l'image est à un zoom effectif plus bas que le premier plan.

### 3.2 Ce qui est du reverse-engineering ou du second niveau

🟡 **Google Earth choisit ses zooms par région, en continu.** L'article officiel du blog Google Earth « Tile Overlays in Google Earth: The Missing Manual » indique que *les niveaux de zoom sont calculés indépendamment pour différentes régions de l'écran, selon la distance à la caméra virtuelle et la latitude*. ⚠️ **Je n'ai pas pu ouvrir la page** (Medium renvoie 403 à mes deux tentatives) ; cette information vient de l'extrait renvoyé par le moteur de recherche. Cohérente avec ce que fait n'importe quel moteur 3D, mais **non vérifiée en première main.**

🟡 Toujours de la même source : dans Google Earth, les données vectorielles sont redessinées au nouveau zoom et restent nettes, contrairement au raster — d'où la préférence pour le vecteur en 3D.

### 3.3 Ce qui est de la SPÉCULATION — que je refuse de présenter autrement

❌ **Les seuils exacts de Google Maps et d'Apple Maps ne sont pas publics.** Aucun chiffre trouvé, aucun chiffre inventé.
❌ **Le comportement des routes de Google Earth en 3D par rapport à la 2D** : je n'ai trouvé aucune source technique. Ce qu'on peut dire sans risque : les routes de Google Earth sont **plaquées sur le terrain** et non extrudées, et la sélection paraît plus agressive qu'en 2D — mais c'est une observation d'usage, **pas une source**.
❌ **Apple Maps en 3D** : rien de public au-delà du brevet cité.

---

## 4. La généralisation — simplifier, fusionner, supprimer sous le pixel

Filtrer par classe ne suffit pas. Une autoroute à z5 a autant de sommets qu'à z14 si on ne fait rien, et ce sont les sommets qui pèsent.

### 4.1 Les trois opérations

1. **Simplification de la géométrie** — Douglas-Peucker (ou Visvalingam-Whyatt), avec une tolérance exprimée en **pixels de tuile**, donc dépendante du zoom.
2. **Fusion des tronçons** — recoller les segments contigus de même classe en une seule polyligne, pour supprimer les milliers de points de rupture qui n'existent que parce qu'OSM découpe les ways aux intersections.
3. **Suppression sous le pixel** — jeter ce qui est plus petit qu'un pixel à l'écran.

### 4.2 Tippecanoe ✅ (README lu)

| Option | Effet | Défaut |
|---|---|---|
| `-S` / `--simplification=`*scale* | *« Multiply the tolerance for line and polygon simplification by scale. The standard tolerance tries to keep the line or polygon within one tile unit of its proper location. You can probably go up to about 10 without too much visible difference. »* | 1 |
| `-av` / `--visvalingam` | *« Use Visvalingam's simplification algorithm rather than Douglas-Peucker's. »* | Douglas-Peucker |
| `-pS` / `--simplify-only-low-zooms` | Ne pas simplifier au zoom max, simplifier en dessous | off |
| `--simplification-at-maximum-zoom=`*scale* | Tolérance distincte au zoom max | — |
| `-pn` / `--no-simplification-of-shared-nodes` | *« Don't simplify away nodes at which LineStrings or Polygon rings converge, diverge, or cross. »* — ⚡ **indispensable pour un réseau routier**, sinon les intersections se déconnectent | off |
| `--drop-densest-as-needed` | *« drop whatever fraction of the features is necessary at each zoom level to make that zoom level's tiles work »* | off |
| `--coalesce-densest-as-needed` | Fusionner au lieu de jeter | off |
| `-al` / `--drop-lines` | Étendre le « dot dropping » aux lignes | off |
| `-M` / `--maximum-tile-bytes` | Taille max de tuile compressée | **500 Ko** |
| `-O` / `--maximum-tile-features` | Objets max par tuile | **200 000** |
| `-ae` / `--extend-zooms-if-still-dropping` | Ajouter des zooms tant qu'on jette | off |

⚠️ **`--no-simplification-of-shared-nodes` (`-pn`) est le réglage que les débutants ratent.** Sans lui, Douglas-Peucker déplace indépendamment les sommets de deux routes qui se croisent, et le carrefour s'ouvre visiblement. C'est exactement le genre de défaut qu'on voit sur une carte en relief imprimée en grand format.

**Réglage de départ recommandé par la doc :** `tippecanoe -zg -o out.mbtiles --drop-densest-as-needed in.geojson`.

### 4.3 Planetiler ✅ (code Protomaps lu, doc Planetiler consultée)

Planetiler expose deux réglages par objet et une passe de post-traitement par tuile.

Par objet :
```java
feature.setMinPixelSize(x)   // jeter ce qui mesure moins de x pixels
       .setPixelTolerance(y) // tolérance Douglas-Peucker, en pixels de tuile
```

Protomaps met `setMinPixelSize(0).setPixelTolerance(0)` sur les routes (il ne veut pas casser la topologie objet par objet) et fait **tout le travail dans `postProcess`** ✅ (`Roads.java`, lu) :
```java
public List<VectorTile.Feature> postProcess(int zoom, List<VectorTile.Feature> items) {
    // limit the application of LinkSimplify to where cloverleafs are unlikely to be at tile edges.
    if (zoom < 12) {
      items = linkSimplify(items, "pm:highway", "motorway",  "motorway_link");
      items = linkSimplify(items, "pm:highway", "trunk",     "trunk_link");
      items = linkSimplify(items, "pm:highway", "primary",   "primary_link");
      items = linkSimplify(items, "pm:highway", "secondary", "secondary_link");
    }
    items = FeatureMerge.mergeLineStrings(items,
      0.5, // after merging, remove lines that are still less than 0.5px long
      0.1, // simplify output linestrings using a 0.1px tolerance
      4    // remove any detail more than 4px outside the tile boundary
    );
    return items;
}
```
⚡ **Trois nombres qui valent d'être copiés : fusionner d'abord, puis jeter en dessous de 0,5 px, simplifier à 0,1 px, et couper à 4 px hors tuile.** L'ordre compte : on fusionne AVANT de mesurer, sinon on jette des morceaux d'une même route.

⚡ **`linkSimplify` en dessous de z12 : Protomaps supprime les bretelles d'échangeur et les remplace par leur route mère.** Un échangeur autoroutier, c'est 20 à 40 polylignes qui deviennent une tache illisible en dessous de z12. C'est un gain énorme et une amélioration visuelle simultanée. Pour une carte décorative, cela vaut la peine de l'appliquer bien plus haut que z12.

### 4.4 OpenMapTiles : la généralisation par SQL ✅

Déjà détaillée en §1.4. Les trois leviers, dans l'ordre d'efficacité :
1. **Filtre de classe** (le plus gros gain, §2.1)
2. **`ST_LineMerge(ST_Union(...))` puis filtre de longueur** (`>100 m` à z6, `>500 m` à z5, `>1000 m` à z4) — élimine les débris de réseau
3. **`ST_Simplify(geom, ZRes(n))`** avec une tolérance égale à la résolution du zoom cible **plus deux** (à z4 on simplifie à `ZRes(6)`, à z8 à `ZRes(10)`) — c'est-à-dire qu'ils gardent volontairement 4× plus de détail que le strict nécessaire, pour que le surzoom reste propre.

---

## 5. Les étiquettes — verdict

### 5.1 Comment MapLibre s'y prend ✅ (wiki mapbox-gl-native lu, `src/symbol/placement.ts` de MapLibre téléchargé et lu)

- **Deux formes de collision.** Les étiquettes ponctuelles sont des **rectangles** orientés écran. Les étiquettes de ligne — donc les noms de routes — sont *« a series of circles that follow the course of the underlying line geometry »*, choix fait parce que les cercles sont **stables en rotation**.
- **Un index de grille.** Pour une fenêtre de 600×600 px, *« we split the 600x600px plane into a grid of 400 (20x20) 30px-square cells »*. Chaque géométrie est insérée dans les cellules qu'elle croise ; une requête ne teste que les cellules concernées.
- **Un algorithme glouton, par ordre de priorité.** On parcourt les étiquettes par importance (`symbol-sort-key`), on calcule la boîte englobante **pour la position de caméra courante**, on regarde si elle tient dans l'espace libre. Si oui, on l'insère et on marque l'espace comme occupé ; sinon, l'étiquette est « en collision » et on passe à la suivante.
- **Le résultat pilote une opacité cible, pas une visibilité binaire.** *« The output of the collision detection algorithm is used to set the target opacity of every symbol to either 0 or 1 »*, et un `CrossTileSymbolIndex` suit la même étiquette d'un zoom à l'autre pour que le fondu soit continu. `fadeDuration` vaut **300 ms** par défaut.
- **Le terrain est pris en compte** : `Placement` reçoit un `Terrain` et interroge `terrain.getElevation(tileID, x, y)` pour placer la boîte de collision à la bonne altitude ✅.
- ⚠️ **Et voici l'aveu, écrit dans le code de MapLibre** (`placement.ts`, méthode `zoomAdjustment`) :
  > ```js
  > // When zooming out quickly, labels can overlap each other. This
  > // adjustment is used to reduce the interval between placement calculations
  > // and to reduce the fade duration when zooming out quickly. Discovering the
  > // collisions more quickly and fading them more quickly reduces the unwanted effect.
  > ```
  **En zoom continu rapide, les étiquettes se chevauchent. MapLibre ne sait pas l'empêcher ; il rend le défaut plus court.** C'est écrit par les auteurs eux-mêmes.
- Note de performance : `symbol-sort-key` — le mécanisme même de la priorité — *« comes with a heavy performance penalty as implemented »*, car il force un appel de dessin par valeur de clé de tri. 🟡 (issue MapLibre #2478, lue via extrait de recherche.)

### 5.2 Comment Mapbox s'y prend

Même moteur d'origine. Un détail supplémentaire, documenté ✅ : dans Mapbox Streets v8, *« From zoom levels 6 through 10, `ref` values are attached to separate points rather than lines to optimize symbol placement. »* Mapbox **change la géométrie même de la donnée** entre z6 et z10 pour que le placement des numéros de route soit tenable.

### 5.3 Cesium

Cesium n'a **pas** de moteur de collision d'étiquettes comparable. Il propose `disableDepthTestDistance` sur `LabelGraphics` (*« the distance from the camera at which to disable the depth test to prevent clipping against terrain »*) et un `EntityCluster` pour regrouper des entités, mais rien qui ressemble au `GridIndex` + `symbol-sort-key` de MapLibre. ✅ pour `disableDepthTestDistance` (doc Cesium lue) ; 🟡 pour l'absence de décombrement généralisé — je l'infère de la documentation et des fils de la communauté Cesium, sans avoir trouvé de déclaration explicite.

### 5.4 Google Earth

❌ Rien de public sur leur algorithme de placement d'étiquettes en 3D. Le seul élément documenté est indirect : le brevet Google US8937627B1 sur l'interpolation de style « du premier plan vers l'arrière-plan » en vue perspective, qui suggère qu'ils traitent la vue inclinée comme un gradient de zoom — ce qui vaut aussi pour les étiquettes.

### 5.5 ⚡ VERDICT : pas de noms de routes dans ShibuMap

**Je tranche : non. N'affichez pas de noms de routes.** Cinq raisons, chacune adossée à un fait vérifié ci-dessus.

1. **C'est le poste le plus coûteux de toute la chaîne.** Le décombrement est le seul travail qui doit être **refait à chaque image** quand la caméra bouge — la géométrie, elle, se charge une fois. Avec une descente continue, la caméra bouge en permanence.
2. **Personne ne sait le rendre stable en zoom continu.** MapLibre le dit dans ses propres commentaires. Le résultat visible serait des noms qui clignotent pendant la descente — exactement le type d'artefact qu'Adrien vient de faire supprimer.
3. **Les styles de référence les mettent très tard de toute façon.** Positron : noms de routes secondaires à **z15**, de routes mineures à **z16**. Protomaps : nom d'autoroute à **z11** contre géométrie à **z3** — huit zooms d'écart. Autrement dit, **sur toute la plage de descente de ShibuMap, un style professionnel n'afficherait aucun nom de route.** Ne rien afficher, c'est se conformer à la pratique, pas s'en écarter.
4. **En perspective sur relief, le problème s'aggrave.** Une étiquette de ligne suit la géométrie, donc elle épouse le terrain, donc elle se déforme, disparaît derrière une crête, et sa boîte de collision doit être recalculée avec l'élévation. MapLibre le fait, mais avec un `Terrain` plat par tuile — pas avec un bloc de relief exagéré.
5. **Une carte décorative destinée à l'impression ne veut pas de noms de routes.** Ce que le lecteur veut lire sur un mur, ce sont des noms de lieux — villes, sommets, vallées — pas « D 942 » le long d'un trait de 2 px. Les noms de routes sont un outil de navigation. ShibuMap ne sert pas à naviguer.

**Ce qui reste possible sans rien payer :** des étiquettes de lieux (villes, sommets), très peu nombreuses, dont le placement est un problème de points et non de lignes, et qu'on peut résoudre avec une priorité fixe pré-calculée plutôt qu'un décombrement par image. **C'est un problème d'un autre ordre de difficulté.**

**Et le corollaire de données :** ne pas afficher de noms permet de **ne pas transporter le champ `name`** — c'est-à-dire de supprimer l'attribut le plus lourd de la couche routière. Tippecanoe le recommande explicitement : *« If your features have a lot of attributes, use `-y` to keep only the ones you really need. »* ✅ Pour ShibuMap, la liste des attributs utiles se réduit probablement à **la classe, et rien d'autre**.

---

## 6. La transition sans palier — le point non négociable

### 6.1 Le mécanisme, dit par la spécification ✅

La spécification de style MapLibre distingue trois choses, et c'est toute la réponse :

| Mécanisme | Comportement | Verdict |
|---|---|---|
| **`minzoom` de couche** | *« The minimum zoom level for the layer. At zoom levels less than the minzoom, the layer will be hidden. »* | ⛔ **Coupure franche. C'est ça qui claque.** |
| **Propriété de *peinture* dépendant du zoom** | *« Paint property camera expressions are re-evaluated whenever the zoom level changes, even fractionally. »* | ✅ **Continu. C'est ça qu'il faut.** |
| **Propriété de *disposition* dépendant du zoom** | *« A layout property camera expression is evaluated only at integer zoom levels. It will not be re-evaluated as the zoom changes from 4.1 to 4.6 — only if it goes above 5 or below 4. »* | ⚠️ **Discret. Piège caché** (c'est là que vivent `text-size`, `line-join`, `symbol-placement`). |

⚡ **La règle, en une phrase : on ne fait jamais apparaître une classe de routes par un test booléen sur le zoom. On la fait apparaître par une valeur continue qui part de zéro.**

### 6.2 Les trois techniques, chacune constatée dans un style réel

**(a) La largeur qui croît depuis le sous-pixel.** ✅ OSM Carto
```
@motorway-width-z6:  0.4;    → 0.8 (z7) → 1 (z8) → 1.4 (z9) → 1.9 (z10) → 2.0 (z11) → 3.5 (z12)
@primary-width-z8:   1;
@secondary-width-z9: 1;
@tertiary-width-z10: 0.7;
@residential-width-z12: 0.5;
@track-width-z13:    0.5;
@bridleway-width-z13: 0.3;
```
Une ligne de 0,3 px sur un écran à 1 dpr est une teinte, pas un trait. L'œil ne voit pas « une route est apparue », il voit « le fond s'est légèrement assombri ». **C'est le mécanisme principal, et il est gratuit.**

**(b) L'opacité qui monte.** ✅ Positron, couche `road_mot_case_noramp` :
```json
"line-width":   {"stops": [[6,0.5],[7,0.7],[8,0.8],[11,3],[12,4],[13,5],[14,7],[15,9],[16,11],[17,13],[18,22]]},
"line-opacity": {"stops": [[6,0.5],[7,1]]},
"line-color":   {"stops": [[5,"#e6e6e6"],[12,"#ddd"]]}
```
et `road_pri_case_noramp` : `"line-opacity": {"stops": [[5,0.5],[7,1]]}`.
⚡ **Positron combine les deux :** l'autoroute entre à z6 à **0,5 px de large ET 50 % d'opacité**, et met un zoom entier à atteindre l'opacité pleine. Même la couleur est interpolée (`#e6e6e6` → `#ddd` entre z5 et z12). **Trois canaux continus en même temps.**

**(c) Le décalage entre les classes.** Aucun style ne fait apparaître deux classes au même zoom si ça peut être évité. Positron : trunk/motorway z5, primary z7, secondary z11, minor z13, service z15 — **jamais deux voisines**. Une apparition à la fois est une apparition qu'on ne remarque pas ; trois apparitions simultanées font un événement.

**(d) Le `min_zoom` fractionnaire.** ✅ Tilezen affecte 5.0 / 5.1 / 5.2 à trois rangs de Natural Earth. Avec une caméra continue, les objets d'un même « niveau » n'entrent donc pas ensemble mais s'échelonnent sur un dixième de zoom. Technique peu connue et directement applicable.

### 6.3 Ce que Google a breveté à ce sujet ✅

US8937627B1 (Google, 2015) : *« The use of map styles across zoom levels allows the seamless display of map data when there is a mismatch of map data and styles on a display at the same time »* et *« Style information may be interpolated from the front to the back of the perspective view. »*

Deux enseignements pour ShibuMap :
1. **Le zoom de la donnée et le zoom du style sont deux choses différentes.** On peut charger une tuile z8 et la peindre avec le style z8,7. C'est ce qui permet de ne jamais attendre.
2. **En vue inclinée, le style doit varier dans l'image**, pas seulement dans le temps — le fond de l'image est plus loin, donc à un zoom effectif plus bas. ⚠️ Cela concerne directement ShibuMap, qui regarde un bloc de relief en oblique. **Sinon le premier plan est trop maigre, ou l'horizon trop chargé.** Je n'ai pas trouvé d'implémentation open source de ce point ; c'est une piste, pas une recette.

### 6.4 Le piège spécifique à ShibuMap

⚠️ Une chose que la 2D n'a pas et que ShibuMap a : **la largeur d'un trait en 3D**. Si les routes sont dessinées comme des géométries plaquées sur le relief, leur largeur est en **mètres** et non en **pixels** — elles s'amincissent donc naturellement quand on s'éloigne, jusqu'à disparaître dans l'aliasing (scintillement), puis réapparaître. C'est un claquement d'un autre type, involontaire.

La technique du § 6.2(a) suppose une largeur **en pixels écran**, donc une ligne dont l'épaisseur est recalculée dans le shader en fonction de la distance à la caméra (ce que fait `Line2` / `LineMaterial` de three.js, et ce que fait MapLibre). ❌ Je n'ai pas vérifié comment ShibuMap dessine ses traits aujourd'hui — c'est le premier point à regarder dans le code avant d'appliquer quoi que ce soit de ce document.

---

## 7. Recommandation, si elle est utile

Elle découle des faits ci-dessus ; elle n'est pas issue d'une source.

1. **Deux sources, pas une.** Natural Earth (56 600 objets, planète entière, ~50 Mo en GeoJSON brut, bien moins en binaire) pour toute la partie haute de la descente ; OSM filtré pour le bloc de terrain final. C'est ce que fait Tilezen. Le globe entier peut porter les routes sans rien charger de dynamique.
2. **Sur OSM, s'arrêter à `tertiary`.** 8,4 % des objets. Ne jamais charger `service` (24,6 % à lui seul), ni `footway`/`path`/`track` (29,6 % à eux trois). Pour une carte en relief décorative, un chemin piéton est du bruit.
3. **Appliquer un filtre de longueur avant tout autre.** Le filtre `ST_Length > 500 m` d'OpenMapTiles est le meilleur rapport gain/effort et il n'a aucune conséquence esthétique visible sur une carte décorative.
4. **Fusionner puis simplifier, dans cet ordre**, avec les nombres de Protomaps (0,5 px / 0,1 px / 4 px), et **`--no-simplification-of-shared-nodes`** si le pipeline passe par tippecanoe.
5. **Supprimer les bretelles (`*_link`) partout**, pas seulement en dessous de z12. Un échangeur en relief est illisible.
6. **Ne transporter aucun attribut sauf la classe.**
7. **Faire apparaître chaque classe à largeur 0 et opacité 0**, montant sur au moins un zoom entier, jamais deux classes en même temps.
8. **Aucun nom de route.**

---

## 8. Ce que je N'AI PAS pu vérifier

⛔ Liste honnête. Rien de ce qui suit ne doit être traité comme acquis.

1. **Le nombre réel d'objets par tuile z12/z13/z14** sur un serveur de tuiles de production. Il aurait fallu une clé d'API MapTiler ou Mapbox. Les pourcentages du §2.1 sont des rapports entre classes calculés sur des comptages de **ways OSM**, pas des mesures de tuiles. **C'est la mesure la plus utile qui manque à ce document**, et elle est facile à obtenir : télécharger une extraction OSM d'une zone représentative pour ShibuMap et compter par classe.
2. **La taille en octets** de chaque classe, une fois encodée. Le nombre d'objets et le nombre de **sommets** ne varient pas de la même façon : une autoroute a peu d'objets mais beaucoup de sommets, une rue résidentielle l'inverse. **Le vrai coût de chargement est en sommets, pas en objets.** Je n'ai mesuré aucun compte de sommets.
3. **L'article du blog Google Earth** (« Tile Overlays in Google Earth: The Missing Manual ») — Medium m'a renvoyé 403 sur deux tentatives, y compris avec un agent navigateur. Ce que j'en rapporte vient d'extraits de moteur de recherche. 🟡
4. **Le blog Mapbox « Map Label Placement in Mapbox GL »** — 403 également. Le contenu du §5.1 vient du wiki `mapbox-gl-native` (accessible ✅) et du code MapLibre (lu ✅), pas de cet article.
5. **Le filtre de classe de la table `osm_highway_linestring_gen_z11`** d'OpenMapTiles : j'ai déduit son contenu (« tertiary et au-dessus ») du filtre de la table z10 qui en retire `tertiary`. La définition de la table elle-même est ailleurs dans le dépôt et je ne l'ai pas ouverte. Cohérent, mais déduit.
6. **Les seuils de zoom de Google Maps et d'Apple Maps.** Aucune source. Aucun chiffre proposé.
7. **Le comportement 3D des routes dans Google Earth** par rapport à la 2D. Aucune source technique trouvée.
8. **L'absence de décombrement d'étiquettes généralisé dans Cesium** — inférée, pas trouvée écrite.
9. **La licence de Natural Earth** — le projet se présente comme domaine public, mais je n'ai pas relu le texte de licence, et un usage commercial imprimé mérite cette vérification. Les données routières nord-américaines viennent d'une source tierce mentionnée sur la page de téléchargement.
10. **Les pratiques réelles des cartes en relief décoratives du commerce.** J'ai cherché ; les résultats sont des pages de vente (Etsy, WhiteClouds, Muir Way) sans doctrine cartographique. **Je n'ai trouvé aucune source sérieuse sur « quelles routes montrer sur une carte en relief décorative ».** Le §2.2 sur Natural Earth est l'argument le plus solide dont je dispose, et il est indirect : Natural Earth est un jeu de données de petite échelle, pas une doctrine de carte décorative.
11. **Comment ShibuMap dessine ses lignes aujourd'hui** (largeur en mètres ou en pixels écran). Point bloquant pour appliquer le §6.2, et vérifiable en quelques minutes dans le code.

---

## Sources

**Schémas et styles (fichiers lus)**
- [Shortbread Vector Tile Schema 1.0 — couche `streets`](https://shortbread-tiles.org/schema/1.0/)
- [Protomaps Basemap — `Roads.java`](https://github.com/protomaps/basemaps/blob/main/tiles/src/main/java/com/protomaps/basemap/layers/Roads.java)
- [OpenMapTiles — `layers/transportation/update_transportation_merge.sql`](https://github.com/openmaptiles/openmaptiles/blob/master/layers/transportation/update_transportation_merge.sql)
- [OpenMapTiles — `layers/transportation/class.sql`](https://github.com/openmaptiles/openmaptiles/blob/master/layers/transportation/class.sql)
- [OpenMapTiles — `layers/transportation/transportation.sql`](https://github.com/openmaptiles/openmaptiles/blob/master/layers/transportation/transportation.sql)
- [CARTO Positron — `style.json`](https://basemaps.cartocdn.com/gl/positron-gl-style/style.json)
- [OpenStreetMap Carto — `style/roads.mss`](https://github.com/gravitystorm/openstreetmap-carto/blob/master/style/roads.mss)
- [OpenStreetMap Carto — `project.mml`](https://github.com/gravitystorm/openstreetmap-carto/blob/master/project.mml)
- [Tilezen vector-datasource — `yaml/roads.yaml`](https://github.com/tilezen/vector-datasource/blob/master/yaml/roads.yaml)
- [Mapbox Streets v8 — référence de tileset](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/)

**Données**
- [taginfo — valeurs de la clé `highway` (ways)](https://taginfo.openstreetmap.org/keys/highway#values)
- [Natural Earth — 10m Roads](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/roads/)
- [nvkelso/natural-earth-vector — `geojson/ne_10m_roads.geojson`](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_roads.geojson)

**Outils de généralisation**
- [tippecanoe — README](https://github.com/felt/tippecanoe)
- [tippecanoe(1) — page de manuel Debian](https://manpages.debian.org/testing/tippecanoe/tippecanoe.1.en.html)
- [planetiler](https://github.com/onthegomap/planetiler)

**Rendu et étiquettes**
- [MapLibre Style Spec — Layers](https://maplibre.org/maplibre-style-spec/layers/)
- [MapLibre Style Spec — Expressions](https://maplibre.org/maplibre-style-spec/expressions/)
- [MapLibre GL JS — `src/symbol/placement.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/symbol/placement.ts)
- [mapbox-gl-native wiki — Collision Detection](https://github.com/mapbox/mapbox-gl-native/wiki/Collision-Detection)
- [MapLibre GL JS — MapOptions (`fadeDuration`)](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)
- [Cesium — `LabelGraphics`](https://cesium.com/learn/cesiumjs/ref-doc/LabelGraphics.html)

**Google et Apple**
- [Google Maps JavaScript API — Style Reference](https://developers.google.com/maps/documentation/javascript/style-reference)
- [Brevet US8937627B1 — Seamless vector map tiles across multiple zoom levels (Google)](https://patents.google.com/patent/US8937627B1/en)
- [Brevet US8928698B2 — Compression of road features in map tiles (Apple)](https://patents.google.com/patent/US8928698B2/en)
- [Google Earth — Tile Overlays in Google Earth: The Missing Manual](https://medium.com/google-earth/tile-overlays-in-google-earth-the-missing-manual-28f37cc65c80) 🟡 *page inaccessible (403), cité via extraits de recherche*
