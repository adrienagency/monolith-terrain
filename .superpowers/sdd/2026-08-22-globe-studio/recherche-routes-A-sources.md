# Angle A — Les sources de données routières mondiales, libres

**Date** : 2026-08-31
**Question** : quelles sources open source pour afficher les routes du monde entier dans ShibuMap ?
**Contrainte imposée en cours de recherche par Adrien** : « Les routes mettaient trop de
temps à charger, c'était vraiment trop lourd. » Le classement est donc bâti sur
**poids par emprise visible**, **latence du premier octet**, **pré-découpe** — dans cet ordre —
la licence gardant un droit de veto.

**Convention de lecture** :
✅ **VÉRIFIÉ** = chiffre relevé sur une page ouverte ou mesuré par moi le 2026-08-31, source donnée.
🔶 **SUPPOSÉ** = raisonnement ou mémoire, non sourcé. À traiter comme une hypothèse.

---

## 0. Le motif du retrait : il est écrit, et il est plus précis que le souvenir

Le dépôt garde la trace complète. Elle est dans le corps du commit `af45f66`
(2026-07-29), pas dans son titre — d'où l'impression qu'elle manquait.

> ✅ « Adrien, mot pour mot : *ce système de routes ne me convient pas, très lourd,
> très mauvais, tu peux le supprimer.* »
> — `git show af45f66`

Le commit répond lui-même à la question « la donnée ou le traitement ? » :
**les deux, et par trois chemins qui échouaient chacun pour une raison différente.**

| Chemin | Ce qui n'allait pas | Chiffre ✅ (source : commits du dépôt) |
|---|---|---|
| **Natural Earth 1:10m** (`public/data/map/roads.json`) | Un **monolithe mondial** tiré **intégralement** dès que le visiteur activait le calque, pour n'afficher que le bloc de ~27 km | **13 213 210 octets** (12,60 Mio ; 2 836 390 o gzip). Le plus gros objet servi du site. `af45f66` |
| **Tuiles Overture** (maison, `build-road-tiles.mjs`) | La seule version fine — mais **jamais déployée**, et couvrant **uniquement la boîte alpine** (lon 5–8, lat 44,5–47) | LOD0 10 tuiles / 3,7 Mo · LOD1 372 / 40,4 Mo · **LOD2 22 556 tuiles / 997 Mo** · plus grosse tuile 1,04 Mo — *pour les Alpes seules*. `8d53d27` |
| **Overpass en direct** | Usage que la doc du service classe elle-même comme inacceptable ; **déjà banni (429)** depuis une seule IP en quelques dizaines de requêtes | Une bbox z12 sur Paris renvoie **351 414 ways / 238 Mo en 200 OK** — le repli « si échec » ne se déclenche donc jamais. `8d53d27`, `2026-07-25-routes-tuiles-vectorielles.md` |

**Le détail qui compte le plus, et qui condamne une piste entière.**
La veille du retrait, le commit `f0d5b0d` (2026-07-28) a **déjà** pré-découpé les
couches en cellules, routes comprises (5° pour rivers/coastline/roads) :

> ✅ « Mesure en prod le 2026-07-28 : démarrage à froid = 10,7 Mo, 97 requêtes, 5,7 s.
> […] roads (13 Mo), rivers (9,9 Mo) et coastline (8,8 Mo) passaient par le même
> chemin dès qu'un visiteur activait le calque. »
> Résultat du découpage : 10 742 Ko → 7 103 Ko (−34 %) ; noms à l'écran en 3 Mb/s
> 23 748 ms → 16 334 ms.

**Les routes ont été découpées en cellules le 28, et supprimées le 29.** Le
pré-découpage n'a donc pas sauvé le calque. ⛔ **Conclusion à retenir : la
pré-découpe d'une donnée grossière ne suffit pas.** Ce qui restait après le
découpage, c'était un réseau Natural Earth cap scalerank 7 — trop grossier pour
être beau de près, et toujours lourd de loin — pendant que la seule donnée fine
n'existait que sur trois départements français.

Et le poids avait augmenté volontairement en cours de route : ✅ `94dfe60`,
« regenerate roads near-lossless » — **1,95 Mo / 35 333 sommets → 7,08 Mo /
230 182 sommets**, avant d'atteindre 12,6 Mo. La recherche de fidélité géométrique
brute est précisément ce qui a tué le calque.

**Ce qui est donc mort, et qu'il ne faut pas ressusciter :**
1. ⛔ Le monolithe mondial en JSON, découpé ou non.
2. ⛔ La requête en direct (Overpass), à cause de la latence *et* du volume non borné.
3. ⛔ La géométrie non simplifiée aux zooms lointains.
4. ⛔ La couverture « peau de léopard » (fin sur une région, grossier ailleurs).

---

## 1. Tableau comparatif

| Source | Licence des routes | Couverture | Forme livrée | Pré-tuilé ? | Poids monde ✅ | Octets pour une fenêtre de 27 km ✅ | Latence ✅ | Verdict |
|---|---|---|---|---|---|---|---|---|
| **OSM brut** (planet.pbf) | ODbL | mondiale | 1 fichier PBF | ❌ non | **94,50 Go** | — (il faut tout cuire) | — | Matière première, pas une source livrable |
| **Geofabrik** (extraits) | ODbL | par pays/continent | PBF, SHP | ❌ non | 🔶 non mesuré (voir §7) | — | — | Utile pour un rebuild régional, pas pour le client |
| **Overture — transportation** | **ODbL** ⚠️ | mondiale, conflée | GeoParquet sur S3/Azure | ❌ non | **96,51 Go** (160 fichiers, release 2026-08-19.0) | — (il faut tout cuire) | — | Plus lourd qu'OSM brut, **même licence**. Déjà essayé ici, déjà retiré |
| **Daylight (Meta)** | ODbL | mondiale | PBF | ❌ non | — | — | — | ⛔ **MORT** — plus aucune publication depuis décembre 2024 |
| **Protomaps — planet PMTiles** | ODbL (produced work) | mondiale, z0–15 | **1 fichier .pmtiles**, range-requests | ✅ **oui** | **137,65 Go** (build du 2026-08-30) | ~10–260 Ko au bon zoom | 486–785 ms (R2 nu, sans CDN) | Le socle technique. À servir derrière un CDN |
| **OpenFreeMap** (instance publique) | ODbL / OpenMapTiles | mondiale | tuiles MVT z0–14, HTTP direct | ✅ **oui** | téléchargeable en entier (Btrfs/MBTiles) | **10–260 Ko** au bon zoom | **78–161 ms** | Le meilleur banc d'essai. Une seule personne derrière : pas une dépendance de production |
| **VersaTiles** | ODbL | mondiale | MVT / conteneur | ✅ oui | 🔶 non mesuré | 🔶 non mesuré | 🔶 non mesuré | Alternative libre à Protomaps, moins documentée |
| **MapTiler Cloud** | commerciale | mondiale | MVT | ✅ oui | — | — | — | ⛔ CGU : cache serveur/CDN **interdit** |
| **Stadia Maps** | commerciale | mondiale | MVT | ✅ oui | — | — | — | ⛔ CGU : cache serveur **interdit** |
| **Mapbox** | commerciale | mondiale | MVT | ✅ oui | — | — | — | ⛔ un rendu three.js n'est pas un « Qualified Renderer » → facturé à la tuile |
| **Natural Earth** | domaine public | mondiale, **grossière** | GeoJSON/SHP | ❌ | 12,6 Mo (notre export) | monolithe | — | ⛔ **C'est exactement ce qui a été retiré** |

---

## 2. La licence — et elle ne disqualifie pas ce qu'on croit

### 2.1 Le fait qui surprend : Overture n'échappe pas à l'ODbL

C'est le point que la question posait, et la réponse est nette.

> ✅ Répartition officielle des licences par thème Overture :
> **ODbL** → Base, Buildings, Divisions, **Transportation**.
> **CDLA Permissive 2.0** → Places (uniquement).
> Addresses → licences mixtes par pays.
> — [docs.overturemaps.org/attribution](https://docs.overturemaps.org/attribution/)

**Les routes d'Overture sont sous ODbL, parce qu'elles dérivent d'OSM.** L'idée
répandue qu'Overture serait « OSM sous licence permissive » est fausse pour notre
thème — elle n'est vraie que pour les POI. ⛔ **Overture n'apporte donc aucun
avantage juridique sur OSM pour les routes.** Attribution exigée :
« © OpenStreetMap contributors, Overture Maps Foundation ».

### 2.2 Ce que l'ODbL fait vraiment à une application commerciale

La distinction qui commande tout est **Produced Work** vs **Derivative Database**.

- ✅ **ODbL §4.5(b)** : « Using this Database […] to create a Produced Work does not
  create a Derivative Database for purposes of Section 4.4. »
  ([Legal Structure, wiki OSM](https://wiki.openstreetmap.org/wiki/Open_Data_License/Legal_Structure))
- ✅ Une image, une vidéo, une carte imprimée, un rendu 3D sont des **Produced Works**.
  La guideline OSMF cite explicitement « .PNG, JPG, .PDF, SVG », les images raster,
  et les cartes imprimées.
  ([Produced Work — Guideline, OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline))
- ✅ Le partage à l'identique (**share-alike**) ne mord **que** sur la base dérivée,
  pas sur l'œuvre produite.

**Traduit pour ShibuMap, en une phrase :**

> ⚡ Si nous cuisons nos propres tuiles de routes, ce fichier de tuiles est une
> **base dérivée** que nous devons offrir sous ODbL, avec l'attribution
> « © OpenStreetMap contributors » visible ; **en revanche le moteur three.js,
> les shaders, les palettes, la boutique de templates, et surtout les exports HD,
> les impressions et les vidéos vendus à un client sont des Produced Works — ni
> partagés, ni ouverts, ni contaminés.**

Ce qui n'est donc **PAS** exigé, contrairement à la crainte habituelle :
- ❌ ouvrir le code de ShibuMap ;
- ❌ ouvrir les templates, palettes ou tracés GPX des utilisateurs ;
- ❌ renoncer à vendre un export, une impression, une carte de course.

Ce qui **est** exigé :
- ✅ l'attribution OSM visible sur la carte et sur les Produced Works publiés ;
- ✅ mettre à disposition le **jeu de tuiles** que nous fabriquons (un lien de
  téléchargement suffit — la publication n'a pas à être ergonomique, juste réelle).

**Nuance à ne pas manquer** : si l'on se contente d'*utiliser* des tuiles déjà
publiées par un tiers (Protomaps, OpenFreeMap) sans les modifier, on ne crée
aucune base dérivée, et il ne reste **que l'attribution**. 🔶 **SUPPOSÉ** — c'est
la lecture standard, mais l'exercice n'a pas été validé par un juriste.

**Le vrai mur juridique n'est pas l'ODbL : ce sont les CGU commerciales.**
✅ MapTiler : « It is prohibited to store, save, and/or redistribute any map content
from a server-side cache ». ✅ Stadia : « server-side caching is prohibited ».
✅ Mapbox : export print/vidéo interdit sauf droits achetés séparément. **Ce sont
ces trois clauses — pas l'ODbL — qui disqualifient une source entière** pour un
produit qui vend des exports.

---

## 3. Qualité et couverture par région

✅ **Mesuré** (2026-08-31, tuiles OpenFreeMap, poids de la seule couche
`transportation` après isolation du protobuf et regzippage) :

| Zone | z8 | z10 | z12 | z14 |
|---|---|---|---|---|
| Annecy | 12,0 Ko | 12,0 Ko | 54,8 Ko | 31,3 Ko |
| Paris | 29,4 Ko | 58,3 Ko | **90,6 Ko** | 61,1 Ko |
| Tokyo | 50,4 Ko | 51,9 Ko | **115,5 Ko** | 40,0 Ko |
| Manhattan | 28,7 Ko | 55,3 Ko | 77,7 Ko | 33,0 Ko |
| Kinshasa | 3,0 Ko | 4,6 Ko | 35,5 Ko | 7,6 Ko |
| Islande | 2,1 Ko | 6,6 Ko | 17,4 Ko | 14,8 Ko |
| Sahara (23N/10E) | 2,5 Ko *(tuile entière)* | **tuile vide, 0 octet** | **0 octet** | **0 octet** |

Lecture :
- ✅ **Le rapport de densité entre la zone la plus riche et la plus pauvre est
  d'environ 40×** (Tokyo z12 : 115 Ko ; Islande z12 : 17 Ko), et il tombe à **zéro**
  au Sahara — OSM y renvoie des tuiles littéralement vides. **C'est une bonne
  nouvelle pour le poids** : une source tuilée fait payer la densité réelle, pas
  une moyenne mondiale.
- ✅ Kinshasa passe de 4,6 Ko (z10) à 35,5 Ko (z12) : la couverture urbaine
  africaine existe et est loin d'être négligeable en 2026.
- 🔶 **SUPPOSÉ** : la hiérarchie classique de qualité OSM (Europe de l'Ouest et
  Japon excellents, Amérique du Nord très bon, Afrique rurale et Asie centrale
  lacunaires) reste vraie. Je n'ai pas trouvé d'étude de complétude à jour en 2026
  pour l'étayer, et je ne cite donc aucun pourcentage.
- ✅ **Overture n'améliore pas la couverture routière** de façon exploitable ici :
  le thème transportation est conflé **à partir d'OSM** (c'est la raison même de
  son ODbL). Ses apports réels sont ailleurs — Places (POI, licence permissive) et
  Buildings. 🔶 Pour les routes, l'écart avec OSM est marginal côté géométrie.

---

## 4. Poids par emprise visible — la mesure qui décide

✅ **Mesuré le 2026-08-31.** Somme des octets de la seule couche `transportation`,
gzippée, pour toutes les tuiles couvrant une fenêtre carrée centrée sur la zone.
« trop » = plus de 12 tuiles de côté, mesure non tentée.

| Zone | Fenêtre | z6 | z8 | z10 | z12 |
|---|---|---|---|---|---|
| Annecy | **27 km** | 138 Ko (9 t.) | 98 Ko (9 t.) | **70 Ko (9 t.)** | 257 Ko (25 t.) |
| Paris | **27 km** | 147 Ko | 108 Ko | **187 Ko (9 t.)** | ⚠️ **1 866 Ko (49 t.)** |
| Tokyo | **27 km** | 83 Ko | 144 Ko | **190 Ko (9 t.)** | ⚠️ **1 492 Ko (25 t.)** |
| Kinshasa | **27 km** | 13 Ko | 12 Ko | **10 Ko** | 391 Ko |
| Annecy | **300 km** | 138 Ko | **266 Ko (25 t.)** | trop | trop |
| Paris | **300 km** | 147 Ko | **239 Ko** | trop | trop |
| Tokyo | **300 km** | 83 Ko | **231 Ko** | trop | trop |
| Kinshasa | **300 km** | 13 Ko | **12 Ko** | trop | trop |
| Annecy | **3 000 km** | **485 Ko (81 t.)** | trop | trop | trop |
| Tokyo | **3 000 km** | **243 Ko (49 t.)** | trop | trop | trop |
| Kinshasa | **3 000 km** | **52 Ko (49 t.)** | trop | trop | trop |

⚡ **Ce tableau est la réponse à la question d'Adrien.**

1. **Au bon zoom, les routes du monde coûtent entre 10 et 270 Ko par vue.**
   À comparer aux **12,6 Mo** du monolithe retiré : **un facteur 50 à 1 000**.
2. **Le piège est identifié et il est nommé : le z12 sur une petite fenêtre.**
   Paris à 27 km en z12 = **1,87 Mo** — soit le retour exact du problème qu'on
   vient de supprimer. La même fenêtre en z10 coûte **187 Ko, dix fois moins**.
   ⛔ **La règle à graver : le zoom de tuile se choisit sur la taille de la
   fenêtre, jamais sur le zoom de la caméra.** C'est précisément la faute que
   `ROAD_LOD_LEVELS` avait commise (LOD2 = 997 Mo pour les Alpes).
3. Le globe entier (3 000 km) tient en **50 à 500 Ko** de routes en z6. Il n'y a
   aucun obstacle de poids à afficher des routes depuis l'orbite.

---

## 5. Latence — critère n°2

✅ **Mesuré le 2026-08-31**, 3 tirs par cible, depuis la machine d'Adrien :

| Cible | DNS | Connexion | **TTFB** | Total |
|---|---|---|---|---|
| Tuile OpenFreeMap z10 (169 Ko) | 7–32 ms | 23–36 ms | **78–117 ms** | 111–146 ms |
| Tuile OpenFreeMap z12 (338 Ko) | 7–9 ms | 23–25 ms | **99–103 ms** | 148–153 ms |
| Tuile OpenFreeMap z6 (432 Ko) | 9–17 ms | 24–33 ms | **89–161 ms** | 145–210 ms |
| Range-request 16 Ko sur `20260830.pmtiles` (R2 nu) | — | — | **486–785 ms** | 488–787 ms |

Trois conclusions :
1. ✅ Une tuile pré-cuite servie par CDN répond en **~100 ms**. Le goulot Overpass
   mesuré ici (**1,2 s d'attente imposée entre deux requêtes**, cause d'un
   indicateur qui tournait 38 s) est **12× pire** — et c'est un plancher, pas une
   moyenne.
2. ⚠️ **Un fichier PMTiles posé nu sur R2 répond en 0,5–0,8 s.** C'est trop lent
   pour ce produit. ⛔ **Un PMTiles sans CDN devant est une régression, pas une
   solution.** 🔶 Nuance honnête : ma mesure vise un fichier de 137 Go non chauffé
   sur un bucket public sans cache — derrière un CDN correctement configuré,
   l'écart devrait largement se combler, mais **je ne l'ai pas mesuré**.
3. ✅ Avec ~9 tuiles par vue à 100 ms en parallèle, une fenêtre de 27 km est
   complète en **bien moins d'une seconde**. C'est jouable.

---

## 6. Forme de livraison, volumes, coûts

### 6.1 Volumes mondiaux ✅ (tous mesurés le 2026-08-31)

| Jeu | Taille exacte | Source de la mesure |
|---|---|---|
| OSM `planet-latest.osm.pbf` (2026-08-27) | **94 498 915 959 o = 94,50 Go** | `HEAD planet.openstreetmap.org` |
| Overture **transportation** 2026-08-19.0 | **96,51 Go**, 160 fichiers GeoParquet, plus gros 815 Mo | listing S3 `overturemaps-us-west-2` |
| Overture, release complète 2026-08-19.0 | **611,57 Go**, 987 fichiers | idem |
| Protomaps planet PMTiles `20260830` (z0–15, toutes couches) | **137 648 630 677 o = 137,65 Go** | `HEAD build.protomaps.com` |

⚠️ **Correction d'un chiffre officiel** : la doc Protomaps annonce « roughly 120
gigabytes » ([docs.protomaps.com](https://docs.protomaps.com/basemaps/downloads)).
La mesure du jour donne **137,65 Go**, et la série grossit d'environ **10–14 Mo par
jour** (137,541 Go le 25/08 → 137,649 Go le 30/08). **La doc est périmée ; ne pas
budgéter sur 120 Go.**

🔶 **Estimation, NON MESURÉE** : un PMTiles ne contenant **que** les routes, sans
buildings ni POI ni landcover, devrait peser une fraction de ces 137 Go. La couche
`transportation` représentait 5 à 65 % d'une tuile selon le zoom dans mes mesures
— mais la moyenne pondérée par le nombre de tuiles est dominée par les z14–15 où
les buildings et POI écrasent tout (Paris z14 : `poi` 770 Ko contre
`transportation` 87 Ko). ⛔ **Je refuse de donner un chiffre en Go : il faudrait
lancer un Planetiler avec un profil « routes seules » pour le savoir.** C'est la
première mesure à faire avant toute décision d'hébergement.

### 6.2 Coûts ✅ (relevés le 2026-08-31)

| Poste | Prix officiel | Source |
|---|---|---|
| **Cloudflare R2** | **0,015 $/Go/mois** · classe A 4,50 $/M · classe B **0,36 $/M** · **egress gratuit** · 10 Go offerts | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| **Netlify** | ~**0,13 $/Go** de bande passante (20 crédits/Go) sur Pro ; ~0,20 $/Go sur Personal ; Free = plafond dur | [netlify.com/pricing](https://www.netlify.com/pricing/) |
| **AWS S3 + CloudFront** | S3 0,023 $/Go/mois · egress 0,09 $/Go · CloudFront 1 To/mois gratuit à vie, puis 0,085 $/Go | [aws.amazon.com/s3/pricing](https://aws.amazon.com/s3/pricing/), [cloudfront](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/) |
| **Backblaze B2** | 6,95 $/To/mois · **egress illimité gratuit via Cloudflare** (Bandwidth Alliance) | [backblaze.com/cloud-storage/pricing](https://www.backblaze.com/cloud-storage/pricing) |
| **Scaleway Object Storage** | 0,016 €/Go/mois multi-AZ · **75 Go d'egress gratuits/mois**, puis 0,01 €/Go · requêtes gratuites | [scaleway.com/en/pricing/storage](https://www.scaleway.com/en/pricing/storage/) |
| **Protomaps, offre commerciale** | **14 $/mois** jusqu'à 1 M tuiles/mois sur `api.protomaps.com` | [github.com/sponsors/protomaps](https://github.com/sponsors/protomaps) |
| **OpenFreeMap** | **0 $**, sans clé API, commercial autorisé, **aucun SLA** | [openfreemap.org](https://openfreemap.org/) |
| MapTiler Cloud | plancher 30 $/mois (gratuit = **non commercial**) ; On-Prem **2 500 $/an** | [maptiler.com/cloud/pricing](https://www.maptiler.com/cloud/pricing/) |
| Stadia Maps | 20 $/mois (gratuit = **non commercial**) | [stadiamaps.com/pricing](https://stadiamaps.com/pricing/) |

**Ordre de grandeur pour l'auto-hébergement** : 🔶 si le jeu « routes seules » pèse
20 Go, R2 coûte **0,30 $/mois de stockage**, egress nul, et 1 million de tuiles
servies coûte **0,36 $**. ⚡ **Le coût n'est pas un critère de décision ici : il est
négligeable dans toutes les options auto-hébergées.**

---

## 7. Ce que je n'ai pas pu vérifier

1. ⛔ **Le poids d'un PMTiles « routes seules » pour le monde.** Le chiffre décisif
   pour l'hébergement. Aucune source publique ne le donne ; il faut un run
   Planetiler avec profil restreint.
2. ⛔ **Les tailles des extraits Geofabrik.** `download.geofabrik.de` ne répond pas
   correctement aux requêtes HEAD/Range depuis cette machine (redirections vers une
   page HTML de 3 Ko) ; deux tentatives ont expiré. Aucun chiffre donné.
3. ⛔ **La latence d'un PMTiles derrière un CDN correctement configuré.** Je n'ai
   mesuré que le bucket R2 nu (486–785 ms). C'est le chiffre qui déciderait entre
   « PMTiles unique » et « tuiles éclatées en fichiers ».
4. ⛔ **VersaTiles** : ni volume, ni latence, ni tuile mesurée. Cité pour mémoire.
5. ⛔ **Le contenu du bucket `overturemaps-extras-us-west-2`** (les PMTiles prêts à
   l'emploi d'Overture) : le listing S3 ne renvoie rien d'exploitable. Overture
   déclare y publier des tilesets pour Places et Divisions — 🔶 **rien n'indique
   qu'il existe un tileset transportation prêt à l'emploi.**
6. ⛔ **Une étude de complétude OSM par pays à jour en 2026.** Rien trouvé ; d'où
   l'absence de tout pourcentage de couverture dans ce rapport.
7. ⛔ **Prix CARTO, Amazon Location ($/1000), Mapbox Atlas, Stadia On-Prem** :
   aucun tarif public. Sans objet, ces pistes étant écartées par ailleurs.
8. ⛔ **Validation juridique.** Ma lecture de l'ODbL §4.5(b)/§4.6 est celle des
   guidelines OSMF, pas celle d'un avocat. Avant d'encaisser sur des exports, la
   faire relire.

---

## 8. Recommandation classée

### 🥇 1er — Cuire nos propres tuiles « routes seules » depuis OSM, servies en statique

**Pourquoi elle gagne sur les trois critères d'Adrien :**
- ✅ **Poids** : 10–270 Ko par vue au bon zoom, contre 12,6 Mo. Et comme nous
  choisissons le contenu, on retire les buildings, POI, landcover, landuse — qui
  représentaient **jusqu'à 93 %** d'une tuile z14 dans mes mesures.
- ✅ **Latence** : ~100 ms par tuile en statique CDN, contre 1,2 s imposées par
  Overpass.
- ✅ **Pré-découpe** : c'est *la* définition de l'approche.
- ✅ **Licence** : ODbL, attribution OSM, publication du jeu de tuiles. Les exports
  vendus et le moteur restent intacts.
- ✅ **Coût** : quelques dizaines de centimes par mois sur R2.

**Ce qui la disqualifierait :**
- ⛔ Si le jeu « routes seules » mondial dépasse ~100 Go, le temps de rebuild et le
  stockage deviennent un projet en soi. **Mesure préalable obligatoire.**
- ⛔ Si Adrien refuse à nouveau la simplification par zoom. C'est le revirement de
  contrainte déjà identifié dans le plan du 2026-07-25, et jamais tranché. **Le
  refus de simplifier est ce qui a fait passer roads.json de 1,95 Mo à 12,6 Mo,
  puis à la poubelle.** Sans cet accord, la piste est morte avant de commencer.
- ⛔ Si le PMTiles unique reste à 500 ms derrière CDN : basculer alors sur des
  fichiers de tuiles éclatés, comme `water-tiles` aujourd'hui.

### 🥈 2e — Protomaps, planet PMTiles recopié chez nous

Le raccourci : pas de pipeline à écrire, le fichier existe et est reconstruit
chaque jour. ✅ 137,65 Go, z0–15, ODbL.

**Ce qui la disqualifierait :**
- ⛔ **Il embarque tout** — buildings, POI, landuse — dont nous ne voulons rien. On
  paie 137 Go et on transporte des tuiles où les routes sont minoritaires. C'est
  contradictoire avec le motif même du retrait.
- ⛔ La latence R2 nue mesurée (486–785 ms).
- ✅ Protomaps déconseille explicitement le hotlink : « copy the tileset to your own
  Cloud Storage ». Il faut donc bien assumer les 137 Go.

*Reste le meilleur plan B, et un excellent point de départ pour un prototype.*

### 🥉 3e — OpenFreeMap, en banc d'essai uniquement

✅ Gratuit, sans clé, commercial autorisé, **78–161 ms de TTFB mesurés**, schéma
OpenMapTiles dont le vocabulaire `class` est déjà compatible avec notre `roadRank`
(vérifié en son temps sur Overture, `ead856b`). C'est avec lui que j'ai produit
tous les chiffres de ce rapport, en une soirée.

**Ce qui le disqualifie comme dépendance de production :**
- ⛔ ✅ « At the moment, I don't offer SLA guarantees or personalized support. »
  Une seule personne, financée par des dons. ⛔ **Un produit qui vend des exports
  ne peut pas dépendre de ça** — c'est déjà la conclusion du plan du 2026-07-25, et
  rien n'a changé depuis.

### Écartés, et pourquoi

- ⛔ **Overture transportation** : **96,51 Go**, plus lourd qu'OSM brut, **sous la
  même ODbL**, non tuilé, et **déjà essayé dans ce dépôt — c'est la piste dont la
  couverture « boîte alpine » a coûté 997 Mo pour trois départements.** Aucun gain
  juridique, aucun gain de poids, aucun gain de latence. ⛔ **La ressusciter serait
  refaire exactement l'erreur du 29 juillet.**
- ⛔ **Daylight (Meta)** : ✅ plus aucune publication depuis décembre 2024, Meta
  ayant basculé sur Overture. Mort.
- ⛔ **Natural Earth** : c'est le fichier de 12,6 Mo qu'on vient de supprimer.
- ⛔ **Overpass en direct** : 1,2 s de goulot, 238 Mo en 200 OK, bannissement 429
  déjà subi. Usage non conforme reconnu par le dépôt lui-même.
- ⛔ **MapTiler, Stadia, Mapbox** : cache serveur/CDN interdit chez les deux
  premiers ; chez le troisième, un rendu three.js n'est pas un « Qualified
  Renderer », ce qui bascule la facturation à la tuile. Et tous trois font payer,
  ou interdisent, l'export d'images vendues — le gagne-pain de ShibuMap.

---

## 9. La prochaine mesure à faire, avant toute ligne de code

Une seule, et elle tranche tout : **lancer Planetiler sur un extrait (France, puis
Europe) avec un profil ne contenant que `transportation`, et relever le poids
total, le poids par tuile et la répartition par zoom.** Elle donne à la fois le
budget d'hébergement, le temps de rebuild, et la confirmation — ou l'infirmation —
des 10–270 Ko par vue mesurés ici sur des tuiles multi-couches.

---

### Sources

- [Attribution and Licensing — Overture](https://docs.overturemaps.org/attribution/)
- [Transportation Guide — Overture](https://docs.overturemaps.org/guides/transportation/)
- [Speeding Up Overture Tiles](https://docs.overturemaps.org/blog/2026/06/30/speeding-up-tiles/)
- [Produced Work — Guideline, OSM Foundation](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)
- [Open Data License / Legal Structure — wiki OSM](https://wiki.openstreetmap.org/wiki/Open_Data_License/Legal_Structure)
- [Licence and Legal FAQ — OSM Foundation](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)
- [Sunsetting Daylight](https://daylightmap.org/2024/05/03/sunsetting-daylight.html)
- [Basemap Downloads — Protomaps](https://docs.protomaps.com/basemaps/downloads)
- [OpenFreeMap](https://openfreemap.org/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Netlify pricing](https://www.netlify.com/pricing/) · [AWS S3](https://aws.amazon.com/s3/pricing/) · [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) · [Scaleway](https://www.scaleway.com/en/pricing/storage/)
- [MapTiler Cloud terms](https://www.maptiler.com/cloud/terms/) · [Stadia ToS](https://stadiamaps.com/terms-of-service/) · [Protomaps sponsors](https://github.com/sponsors/protomaps)
- Dépôt : commits `af45f66`, `f0d5b0d`, `8d53d27`, `ead856b`, `94dfe60` ; plan `docs/superpowers/plans/2026-07-25-routes-tuiles-vectorielles.md`
