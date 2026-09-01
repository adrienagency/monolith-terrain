# Routes — angle B : raster ou vecteur, et comment on distribue ça

Recherche du 2026-08-31. Toutes les mesures marquées **MESURÉ** ont été prises
pendant cette recherche, sur le **vrai** build planétaire Protomaps
`https://build.protomaps.com/20260830.pmtiles` lu **par requêtes HTTP par plages
d'octets** depuis cette machine (Windows, France, Node 24). Le script de mesure
est dans le bac à sable de session (`scratchpad/mvt/`), il est reproductible.
Tout ce qui n'est pas marqué MESURÉ ou VÉRIFIÉ est marqué SUPPOSÉ.

---

## En une page

**VECTEUR**, et pas parce que c'est plus élégant : parce que **le poids ne
départage pas les deux** (mesuré sur quinze configurations : match nul, une
seule case où le raster gagne vraiment), et qu'une fois le poids hors jeu, le
vecteur est le seul qui rende possible ce qu'Adrien demande — allumer et
éteindre les routes par classe selon le zoom. Ce filtre est aussi **le seul
levier de poids qui compte** : sur une fenêtre de 30 km, `highway + major_road`
coûte ~65 000 points à Paris **comme** à Tokyo, tandis que tout afficher coûte
261 000 à Paris et 412 000 à Tokyo. C'est `minor_road`, et lui seul, qui a fait
dire « trop lourd ».

**Distribution** : un fichier **PMTiles fabriqué par nous** (routes seules,
z0–12, grilles de classes par niveau), posé sur **Cloudflare R2** (palier
gratuit, egress gratuit), lu par plages d'octets. Pas de serveur, pas de clé,
pas de quota.

**Drapage** : ⛔ rien à inventer — `densifyWorld` + `drapeWorld` +
`polygonOffset` sont déjà écrits et en production dans ce dépôt, et le code
porte déjà la mesure qui condamne l'alternative naïve. Il manque deux choses :
échantillonner **le MNT source** et non le maillage rendu, et copier les **trois
conditions de re-drapage** que Cesium a publiées pour son quadtree.

**Et un point que le brief ne demandait pas mais qui tranche seul** :
⛔ **Mapbox est disqualifié par ses propres CGU** (§1.6 : *« shall not trace or
otherwise derive or extract content »*). Le seul service hébergé qui autorise
notre cas **par écrit** est **Stadia Maps**, à $20/mois. Mais fabriquer notre
fichier supprime la question entière.

---

## 0. Ce que le dépôt sait déjà, et qu'il ne faut pas redécouvrir

⚠️ **Le calque Routes a déjà existé dans ShibuMap et il a été retiré le
2026-07-29** (commit `af45f66`, « Le calque Routes quitte le site : 12,6 Mo et
588 lignes de moins »). Le motif donné par Adrien aujourd'hui — *« trop de temps
à charger, vraiment trop lourd »* — est confirmé mot pour mot par le message de
ce commit. Les causes, telles qu'écrites à l'époque **et vérifiables dans
l'historique git** :

| Cause | Chiffre du dépôt (VÉRIFIÉ, `git show af45f66`) |
|---|---|
| Le repli Natural Earth était **chargé en entier** | `public/data/map/roads.json` = **13 213 210 octets** versionnés (2 836 390 o gzippés), le plus gros objet servi du site |
| La seule source fine ne couvrait **qu'une boîte** | tuiles Overture, lon 5–8 / lat 44,5–47 seulement ; ailleurs → repli grossier ou Overpass |
| Overpass n'est pas utilisable | bbox z12 sur Paris = **351 414 ways / 238 Mo en 200 OK** (le filet « si ça échoue on retombe sur Natural Earth » ne se déclenche donc jamais) |
| Overpass est aussi lent | regex de tags mesuré à **6,5 s + un 504**, contre **927 ms** pour le test de tag nu |
| Overpass est bridé côté client | `minInterval = 1200` ms entre deux requêtes (`src/map/overpass.js`, l. 223 et 249) — **le goulot d'1,2 s** |
| Et il tombe | mesuré le 2026-07-31, Chamonix z12 : **42 s** avant que le calque produise quoi que ce soit, quatre requêtes mortes en `ERR_CONNECTION_TIMED_OUT` (31 à 42 s chacune), `curl` incapable d'établir la connexion — d'où `OVERPASS_ATTENTE_MS = 6000` et `OVERPASS_PANNE_MS = 60_000` |

**Ce qui marchait déjà, et qu'il faut garder :**

- `src/map/road-tier.js` (retiré, récupérable par `git show af45f66^:src/map/road-tier.js`) :
  `roadRank()` (8 rangs), `relativeTiers()` (renumérotation dense : dans une
  vallée sans autoroute, les nationales deviennent le rang 0 — jamais de calque
  vide) et `tierDepth(detail, zoom)` avec ses bandes de zoom. **C'est exactement
  la réponse à la question d'Adrien** (« routes activables et désactivables
  progressivement en fonction du niveau de zoom ») : elle a été écrite, testée
  (`test/road-tier.test.js`, 126 lignes) et elle marchait.
- `src/map/line-segments.js` : tous les segments de toutes les lignes d'un
  calque dans **un seul `LineSegments2` = un seul appel de dessin**.
- `src/map/draped-line.js` : `densifyWorld()` + `drapeWorld()`.
- Le patron de distribution `public/data/water-tiles/{z}/{x}/{y}.json` +
  `index.json` (manifeste), fabriqué hors ligne par DuckDB sur les Parquet
  Overture, servi en fichiers statiques par le CDN.

⛔ **Le problème n'a JAMAIS été le rendu vectoriel.** Le rendu vectoriel a été
mesuré en navigateur (commit `ead856b`) : *« roads render from 64 road-tiles
requests, zero Overpass calls, all three detail notches still produce different
vertex counts (1268 / 5749 / 43879) »*. Le problème était **la couverture** (une
boîte alpine) et **le poids du repli mondial** (12,6 Mo d'un bloc).

---

## 1. ⚡ RASTER OU VECTEUR : LA RÉPONSE EST **VECTEUR**

Et elle se tranche au poids, comme demandé. Voici les octets.

### 1.1 Le protocole de mesure

Source unique pour les deux colonnes, pour que la comparaison soit honnête : la
couche `roads` du build planétaire Protomaps du 30 août 2026.

- **Colonne vecteur** = les octets de la **seule couche `roads`** de la tuile
  MVT, isolée en parcourant le protobuf de premier niveau (`Tile.layers`, champ
  3). C'est le poids réel « des routes », pas celui de la tuile entière.
- **Colonne raster** = j'ai **rendu moi-même** ces mêmes routes en PNG 512×512
  transparent (Bresenham, traits de **1 px**, une seule couleur, **sans
  anticrénelage**), encodé avec zlib niveau 9, en RGBA et en gris+alpha.
  ⚠️ **C'est un PLANCHER, et il faut le dire fort** : un vrai calque stylé
  (3 largeurs, couleurs par classe, anticrénelage) pèserait sensiblement plus —
  l'anticrénelage seul remplit les scanlines de valeurs intermédiaires que zlib
  compresse mal. À l'inverse un encodage WebP pèserait moins. Les deux marges
  sont **non mesurées**. Autrement dit : **le raster est avantagé dans mes
  tableaux, et il ne gagne quand même pas.**

### 1.2 Une tuile, par densité — MESURÉ

Poids en Ko. `MVT roads` = brut (le transport gzippe : ×0,70 mesuré sur les
tuiles entières). `PNG` = déjà compressé.

| Lieu | z | MVT roads (brut) | MVT roads (gzip est.) | PNG RGBA 512² | PNG gris+alpha |
|---|---|---|---|---|---|
| Paris | 8 | 28,1 | ~19 | 14,3 | 12,8 |
| Paris | 10 | 60,9 | ~43 | 29,0 | 25,7 |
| Paris | 12 | **72,7** | ~51 | **35,6** | 31,4 |
| Paris | 14 | 57,2 | ~42 | 31,0 | 27,4 |
| Tokyo | 12 | **112,9** | ~73 | **42,9** | 37,6 |
| Chamonix | 12 | 9,7 | ~7,5 | 9,1 | 8,0 |
| Chamonix | 14 | 22,8 | ~17 | 17,3 | 15,3 |
| Kansas rural | 12 | **1,1** | ~0,8 | **4,3** | 3,1 |
| Kansas rural | 14 | 0,3 | ~0,3 | 1,8 | 1,2 |

**Lecture.** Le raster a un **plancher** (1,2 Ko même sur une tuile vide) et un
**plafond** (~43 Ko : une image 512² ne peut pas peser plus que ce que zlib en
fait). Le vecteur n'a **ni l'un ni l'autre** : 0,3 Ko dans le Kansas, 113 Ko à
Tokyo — **un facteur 375**. C'est l'hypothèse du coordinateur, et elle est
juste : *le raster pèse un poids connu, le vecteur pèse ce que la ville
contient.* Sur une tuile de centre-ville, le raster est **1,7 à 2,6× plus léger**
que le vecteur brut, et encore ~1,4× plus léger que le vecteur gzippé.

⛔ **Et pourtant la réponse reste vecteur.** Voici pourquoi, chiffres à l'appui.

### 1.3 ⚡ Le poids par EMPRISE VISIBLE — MESURÉ

C'est le chiffre qui décide. Fenêtre carrée centrée sur le lieu, toutes les
tuiles qui la couvrent, **couche `roads` uniquement**. Les deux colonnes sont
mesurées sur les **mêmes tuiles** : le raster est le PNG que j'ai rendu à partir
du vecteur de cette tuile-là. Échantillonnage : ≤25 tuiles réellement
téléchargées et rendues, puis extrapolées au compte total (indiqué).
La colonne vecteur donne le **brut** ; le transport gzippe, et le ratio a été
**mesuré exactement sur la couche `roads` isolée** : Paris z12 **0,683**
(74 482 → 50 858 o), Tokyo z12 **0,730**, Chamonix z12 **0,794**, Kansas z12
**0,869**, Paris z14 **0,666**, Paris z8 **0,740**. Le MVT est déjà si compact
que gzip n'en retire que 13 à 33 % — d'autant moins que la tuile est vide.
J'applique 0,70 aux fenêtres denses ; la valeur entre parenthèses est ce gzip.

#### Fenêtre de 30 km

| Lieu | tuiles z12 | **vecteur** | **raster** PNG RGBA | raster gris+α | pts de ligne |
|---|---|---|---|---|---|
| Paris | 25 | 1,04 Mo (**~0,73 gz**) | **0,71 Mo** | 0,62 Mo | 260 875 |
| Tokyo | 16 | 1,35 Mo (**~0,95 gz**) | **0,63 Mo** | 0,55 Mo | 411 639 |
| Chamonix | 25 | 0,13 Mo (**~0,09 gz**) | 0,14 Mo | 0,12 Mo | 46 598 |
| Kansas | 16 | 0,01 Mo (**~0,007 gz**) | 0,07 Mo | 0,05 Mo | 2 971 |

Et la même fenêtre servie en z14 (le niveau « net » du jeu Protomaps) :

| Lieu | tuiles z14 | vecteur | raster PNG RGBA | pts |
|---|---|---|---|---|
| Paris | **361** | 7,91 Mo (~5,54 gz) | **6,64 Mo** | 1 352 928 |
| Tokyo | **256** | 5,80 Mo (~4,06 gz) | **5,73 Mo** | 1 386 958 |
| Chamonix | **324** | 1,23 Mo (~0,86 gz) | 1,28 Mo | 296 631 |
| Kansas | **256** | 0,08 Mo (~0,06 gz) | 0,49 Mo | 5 198 |

#### Fenêtre de 300 km

| Lieu | tuiles z8 | vecteur | raster PNG RGBA | pts |
|---|---|---|---|---|
| Paris | 9 | 0,10 Mo (~0,07 gz) | 0,08 Mo | 38 369 |
| Tokyo | 9 | 0,22 Mo (~0,15 gz) | 0,11 Mo | 84 435 |
| Chamonix | 9 | 0,10 Mo (~0,07 gz) | 0,07 Mo | 38 052 |
| Kansas | 9 | 0,02 Mo (~0,014 gz) | 0,03 Mo | 5 298 |

(en z10, 100 à 144 tuiles : 1,15 à 1,40 Mo en vecteur — **c'est le mauvais
choix de zoom**, pas le mauvais format.)

#### Fenêtre de 3 000 km

| Lieu | tuiles z5 | vecteur | raster PNG RGBA | pts |
|---|---|---|---|---|
| Paris | 16 | 0,08 Mo (~0,06 gz) | 0,07 Mo | 36 594 |
| Tokyo | 9 | 0,03 Mo (~0,02 gz) | 0,03 Mo | 11 639 |
| Chamonix | 16 | 0,08 Mo (~0,06 gz) | 0,07 Mo | 36 594 |
| Kansas | 16 | 0,05 Mo (~0,04 gz) | 0,06 Mo | 20 973 |

⚡ **Le raster ne gagne QUE dans une seule case du tableau : la grande ville au
zoom moyen** (Tokyo 30 km/z12, 0,63 contre 0,95 Mo — soit 1,5×). Partout
ailleurs c'est un match nul (Paris 30 km/z12 : 0,71 contre 0,73 ; les fenêtres
de 300 et 3 000 km : à 0,01 Mo près) ou une défaite du raster (Kansas 30 km :
0,07 contre 0,007, soit **10×** ; toutes les fenêtres z14, où les 256-361 tuiles
paient chacune le plancher de l'image). **Le poids ne tranche pas.** Il faut
donc trancher sur ce que chaque format permet — et là, ce n'est plus serré.

### 1.4 Le verdict, et il ne tient pas qu'aux octets

**Sur les octets, c'est un match nul.** Le raster gagne une case sur quinze
(Tokyo à 30 km/z12, 1,5×), perd franchement en rase campagne (10×) et sur toutes
les fenêtres au zoom fin, et fait jeu égal partout ailleurs. **Aucun des deux
formats ne se disqualifie au poids.** Le poids ne tranche donc pas — et c'est
en soi le résultat le plus utile de cette recherche, parce qu'il libère la
décision pour la trancher là où l'écart est énorme.

**Ce que le raster fait perdre :**

1. ⚡ **La question posée par Adrien devient impossible.** « Des routes
   activables et désactivables progressivement en fonction du niveau de zoom » —
   dans une image, les routes sont cuites. On ne peut ni les filtrer par classe,
   ni les colorer, ni en éteindre la moitié. **Et ce filtre est justement le
   levier de poids le plus fort dont on dispose.** MESURÉ, tuile Paris z12,
   répartition des points par classe : `minor_road` 49 %, `major_road` 28 %,
   `path` 12 %, `rail` 8 %, `highway` 1 %. **Ne garder que `highway` +
   `major_road`, c'est descendre à 29 % des points** — la fenêtre de 30 km passe
   de 261 000 points à ~76 000. En z14 c'est encore plus net : `path` pèse
   **81 %** des points d'une tuile parisienne, **52 %** à Tokyo. Éteindre les
   chemins, c'est diviser la charge par cinq. Le raster ne peut pas.
2. **Le raster est prisonnier du zoom.** Un jeu raster doit être re-téléchargé
   à chaque palier (chaque niveau = 4× le nombre de tuiles). Le vecteur d'un
   niveau se sur-zoome : les 25 tuiles z12 d'une fenêtre de 30 km servent
   jusqu'à la fenêtre de 8 km sans une requête de plus.
3. **La mémoire vidéo.** 25 tuiles de 512² en RGBA = **26,2 Mo de VRAM**,
   par-dessus le MNT et la rampe hypsométrique, plus une unité de texture et un
   mélange alpha supplémentaires dans le nuanceur du terrain. Le vecteur coûte
   **un appel de dessin** (`buildLineSegments`, déjà écrit).
4. ⚠️ **La boutique de gabarits condamne le raster.** ShibuMap vend des
   palettes ; la rampe d'élévation change à chaque gabarit. Une route **cuite en
   image** a une couleur figée : elle jurera avec la moitié du catalogue, et il
   faudrait un jeu de tuiles par palette. En vecteur, la couleur est un uniform.
5. **La netteté sous caméra oblique.** ShibuMap regarde le relief en biais. Une
   texture plaquée s'étire au loin et crénelle ; une ligne large en pixels
   (`worldUnits:false`, ce que fait déjà `line-segments.js`) garde sa largeur à
   l'écran quelle que soit l'inclinaison.

### 1.5 ⛔ Le vrai danger du vecteur, et il est réel : les SOMMETS, pas les octets

Le mégaoctet n'est pas ce qui a fait dire « trop lourd » à Adrien — **c'est le
nombre de sommets.** Point de repère du dépôt : le cran de détail 3 de l'ancien
calque produisait **43 879 sommets** dans un bloc, et c'était déjà jugé trop.

MESURÉ, ce que produirait une reprise naïve en Protomaps z12 sur une fenêtre de
30 km :

| | points | contre l'ancien détail 3 |
|---|---|---|
| Paris, toutes classes | 260 875 | **× 5,9** |
| Tokyo, toutes classes | 411 639 | **× 9,4** |
| Paris, `highway`+`major_road` seuls | ~76 000 | × 1,7 |
| Chamonix, toutes classes | 46 598 | × 1,1 |

Et voici **le chiffre qui rend le calque faisable** — MESURÉ, cumul des points
par classe sur la fenêtre de 30 km en z12, les classes prises dans l'ordre
d'importance :

| classe ajoutée | Paris (cumul) | Tokyo (cumul) | Chamonix (cumul) |
|---|---|---|---|
| `highway` | 7 469 | 6 414 | 219 |
| **+ `major_road`** | **67 969** | **61 603** | **6 298** |
| + `minor_road` | 216 917 | 386 875 | 18 896 |
| + `rail` | 234 045 | 397 786 | 18 963 |
| + `path` | 258 719 | 410 908 | 46 555 |
| tout | 260 875 | 411 639 | 46 598 |

⚡ **`highway + major_road` coûte ~62 000 à 68 000 points dans une fenêtre de
30 km, que ce soit Paris ou Tokyo.** Le squelette routier a un coût **quasi
constant par unité de surface**, indépendant de la densité urbaine. C'est
`minor_road` qui explose et qui varie d'un facteur 26 entre Chamonix (12 598) et
Tokyo (325 272) — c'est **lui, et lui seul**, qui a fait dire « trop lourd ».

⚡ **Conclusion opérationnelle : le filtre par classe et par zoom n'est pas une
option de confort, c'est le mécanisme de survie du calque.** La règle qui en
découle :

- `highway` + `major_road` : **toujours**, à tous les zooms. Coût borné, ~65 k
  points, tenable partout.
- `minor_road`, `rail`, `path` : **seulement si le compte mesuré tient sous le
  plafond**, pas selon une bande de zoom écrite à la main. `road-tier.js`
  décidait par table (`ZOOM_BANDS`) ; il doit décider par **budget mesuré**,
  parce que la même fenêtre de 30 km demande 46 k points à Chamonix et 412 k à
  Tokyo. Une table de zoom ne peut pas distinguer les deux ; un compteur, si.
- Plafond proposé : **60 000 points de ligne par vue**, soit ~1,4× l'ancien cran
  de détail 3 (43 879) qu'Adrien trouvait déjà lourd — à valider au banc, mais
  c'est le bon ordre de grandeur, et il tombe exactement sur le coût du
  squelette.

⛔ **ET LE PIÈGE, qui décide de la suite : filtrer côté client sauve les
SOMMETS, pas les OCTETS.** Une tuile MVT est monolithique — on télécharge la
couche `roads` entière et on jette 74 % des points à Paris. Avec un jeu
Protomaps pris tel quel, la fenêtre parisienne de 30 km coûte **1,04 Mo de
transfert pour 68 000 points dessinés**. Pour que le filtre paie aussi au
réseau, il faut **cuire son propre jeu avec des grilles de classes par niveau** —
ce que `scripts/build-road-tiles.mjs` faisait déjà avec ses `CLASS_RANK_GATES`
(LOD0 = rang ≤ 0, LOD1 = rang ≤ 2, LOD2 = tout). C'est l'argument le plus fort
en faveur de **fabriquer notre PMTiles** plutôt que de consommer celui de
Protomaps directement.

### 1.6 L'échappatoire, si les grandes villes restent lourdes

Hybride : **vecteur pour les classes qui doivent s'allumer et s'éteindre**
(`highway`, `major_road`, `minor_road`), **raster pour le capillaire
indifférencié** (`path`, `service`) qui n'a jamais besoin d'être ni coloré, ni
filtré, ni cliqué. Ça borne le pire cas parisien au plafond du raster (~43 Ko
par tuile) tout en gardant le levier de zoom là où il sert. ⚠️ **SUPPOSÉ, non
mesuré** — et ça double la chaîne de fabrication. À ne sortir que si le plafond
de 60 000 points ne suffit pas.

---

## 2. Les formats de tuiles vectorielles — MESURÉ

Même contenu à chaque fois : la couche `roads` d'une vraie tuile, ré-encodée
dans chaque format.

| Tuile | MVT (brut) | GeoJSON complet | GeoJSON quantifié 5 déc. | Float32 nu (plancher) |
|---|---|---|---|---|
| Paris z12 (594 lignes / 13 196 pts) | **72,7 Ko** | 656,0 Ko (173,0 gz) | 323,9 Ko (**67,4** gz) | 105,4 Ko |
| Tokyo z12 (444 / 30 209) | **112,9 Ko** | 1 327,1 Ko (335,5 gz) | 682,1 Ko (**141,6** gz) | 237,7 Ko |
| Chamonix z14 (268 / 4 272) | **22,8 Ko** | 215,4 Ko (60,1 gz) | 113,1 Ko (**21,7** gz) | 34,4 Ko |

**Ce que ça dit.**

- **MVT/PBF** : ~4,5× plus léger que le GeoJSON quantifié **avant** compression,
  et encore ~25 % plus léger **après** gzip. Surtout : il se décode sans
  produire des millions de chaînes et d'objets JS intermédiaires. Coordonnées
  entières sur une grille d'extent 4096, delta-encodées en zigzag.
  ⚠️ Le MVT **découpe** les géométries au bord de la tuile (le dépôt avait
  explicitement refusé ça pour ses tuiles maison : « never clip geometry at tile
  borders »). Pour des **lignes**, la découpe est bénigne — deux moitiés
  raboutées au pixel près, et `LineSegments2` ne s'en aperçoit pas. Pour des
  polygones ça se verrait ; ici, non.
- **GeoJSON** : c'est ce que fait le dépôt aujourd'hui (`water-tiles`). Ça
  marche, `JSON.parse` est natif, zéro dépendance — mais **4,5× le poids brut**,
  et un coût mémoire/GC non négligeable sur une tuile de Tokyo. Acceptable pour
  quelques lacs, pas pour les routes du monde.
- **FlatGeobuf** : format binaire à index R-tree, conçu pour la **lecture par
  plages d'octets d'UN gros fichier par requête spatiale**, pas pour un
  découpage en tuiles. Ce n'est pas un format de tuile : pas de généralisation
  par zoom, pas de LOD. Décodeur mesuré à **52,4 Ko brut / 13,6 Ko gzip**.
  ⛔ **Mauvais outil ici** — il n'a pas de niveaux de détail, or c'est
  précisément ce qu'on cherche.
- **PMTiles** : ce n'est pas un format de *tuile*, c'est un **conteneur** de
  tuiles (MVT ou PNG). Voir §3.

**Poids des décodeurs JS — MESURÉ** (fichiers de `node_modules`, tels quels) :

| Paquet | brut | gzip |
|---|---|---|
| `@mapbox/vector-tile` | 10,1 Ko | **2,3 Ko** |
| `pbf` | 24,1 Ko | **4,5 Ko** |
| `pmtiles` (bundle `dist/pmtiles.js`) | 19,8 Ko | **7,8 Ko** |
| `flatgeobuf` (dist ESM minifié) | 52,4 Ko | 13,6 Ko |

⚡ **Un décodeur MVT complet coûte ~7 Ko gzippés.** Il n'y a **aucun moteur
cartographique** là-dedans : `vt.layers.roads.feature(i).loadGeometry()` rend des
tableaux de `{x, y}` en coordonnées de tuile, qu'on convertit en lon/lat par une
division et une projection Mercator inverse. C'est exactement ce que fait déjà
`latlonToWorldPts()` en aval. **Rien à réécrire côté rendu.**

**Coût de décodage — MESURÉ** (Node 24, même moteur V8 que Chrome ; ⚠️ le
navigateur ajoute la décompression gzip, faite par le réseau, donc hors du
thread JS) :

| Tuile | parse MVT + extraction de toute la géométrie `roads` |
|---|---|
| Paris z12 | **0,79 ms** |
| Tokyo z12 | **1,08 ms** |
| Paris z14 | 0,57 ms |
| Chamonix z12 | 0,08 ms |
| Kansas z14 | 0,01 ms |

⚡ **25 tuiles parisiennes = ~20 ms de décodage.** Le décodage n'est pas le
problème. **Le budget entier du calque est dans la latence réseau et dans le
nombre de sommets envoyés au GPU.**

---

## 3. ⚡ PMTiles et Protomaps

### 3.1 Ce que c'est, vérifié sur pièces

Un seul fichier, une pyramide de tuiles indexée, lu **par requêtes HTTP
`Range`** — pas de serveur de tuiles, juste du stockage objet.
[Docs PMTiles](https://docs.protomaps.com/pmtiles/).

MESURÉ, sur le vrai fichier planétaire du 30/08/2026 :

```
HEAD https://build.protomaps.com/20260830.pmtiles
→ 200 OK, Content-Length: 137 648 630 677      (128,2 Gio / 137,6 Go)
```

Builds des jours précédents, pour la dérive : 137 634 779 519 (29/08),
137 622 557 690 (28/08), 137 604 118 337 (27/08), 137 560 784 345 (26/08),
137 541 007 946 (25/08). ⚠️ La [doc annonce « environ 120 Go »](https://docs.protomaps.com/basemaps/downloads) ;
la valeur réelle mesurée aujourd'hui est **137,6 Go**.

En-tête lu par plage d'octets : `minZoom 0, maxZoom 15, tileType 1 (MVT),
tileCompression 2 (gzip)`. Couches : `boundaries, buildings, earth, landcover,
landuse, places, pois, roads, water`. **`roads` est une couche à part**, avec
une propriété `kind` (`highway`, `major_road`, `medium_road`, `minor_road`,
`path`, `rail`, `ferry`, `aeroway`, `other`) — donc **filtrable par classe**, ce
qui est exactement ce que demande Adrien.

### 3.2 Est-ce viable pour les routes mondiales ? **Oui, à trois conditions.**

**Condition 1 — ne pas servir le planet entier.** 137,6 Go, c'est le jeu complet
z0–15, **toutes couches**. Ce dont ShibuMap a besoin, c'est **la couche `roads`
seule, z0–12**. Ordre de grandeur : la doc Protomaps écrit que *« chaque niveau
de zoom supplémentaire double à peu près la taille du fichier »*
([source](https://docs.protomaps.com/basemaps/downloads)), donc z0–12 ≈ ⅛ de
z0–15 ≈ **17 Go**. Part de `roads` dans les octets d'une tuile, MESURÉE sur mes
20 tuiles : **10 %** aux zooms lointains (z5, z8), **24 à 43 %** aux zooms
proches (z10 à z14 ; Paris z12 37 %, Tokyo z12 43 %, Chamonix z12 24 %, Kansas
z12 36 %). Comme les niveaux profonds portent l'essentiel des octets, la part
utile est celle des zooms proches, ~35 % → **~4 à 6 Go**.
⚠️ **SUPPOSÉ** (extrapolation d'une règle documentée × une part mesurée sur
20 tuiles), à confirmer en fabriquant le fichier. Ce n'est **pas** un chiffre à
citer comme mesuré.

**Condition 2 — l'héberger là où les plages d'octets sont gratuites.**
Cloudflare R2, tarifs [VÉRIFIÉS aujourd'hui](https://developers.cloudflare.com/r2/pricing/) :
stockage **0,015 $/Go-mois**, opérations classe B (les GET/Range) **0,36 $ par
million**, **egress gratuit**, et un palier gratuit de **10 Go de stockage,
1 M d'opérations A et 10 M d'opérations B par mois**.
⚡ **Un fichier `roads` de ~4 Go tient dans le palier GRATUIT de R2, egress
compris.** À 25 tuiles par vue, 10 M de requêtes/mois = 400 000 vues de bloc
par mois avant le premier centime.
⚠️ Netlify (l'hébergeur actuel du site) : je **n'ai pas pu vérifier** ses
limites de taille de fichier ni son support des requêtes `Range` sur les assets
statiques — budget de recherche épuisé. À vérifier avant d'écarter, mais un
fichier de plusieurs Go sur un déploiement Netlify est **très improbable**.

**Condition 3 — payer la latence d'amorçage UNE fois.**
⚠️ **C'est la limite la plus sérieuse de PMTiles, et elle touche exactement le
point qui a tué la version précédente.**

MESURÉ, depuis la France vers `build.protomaps.com` (Cloudflare R2) :

| étape | temps |
|---|---|
| en-tête + répertoire racine (2 requêtes) | **488 ms** |
| première tuile (répertoire feuille + tuile) | **873 ms** |
| **total, premier octet utile, à froid** | **1 361 ms** |
| tuile suivante, répertoires en cache | **436 ms** |
| 8 tuiles en parallèle | **556 ms** |

⛔ **1,36 s pour la première route affichée** — c'est **exactement** l'ordre de
grandeur du goulot d'Overpass que le dépôt a déjà mesuré (`minInterval = 1200`
ms entre deux requêtes). **PMTiles ne résout pas le temps de chargement tout
seul, et il faut le dire avant de s'engager.**

La différence décisive avec Overpass n'est pas la latence de la première
requête, c'est **le comportement des suivantes** : Overpass impose 1,2 s
**entre** deux requêtes (sérialisées, par politesse et par quota) et pouvait
mourir à 42 s ; PMTiles sur R2 accepte **8 plages d'octets en parallèle en
556 ms**, sans quota, sans clé, sans pouvoir être coupé pour abus. C'est la même
seconde au départ, mais l'une plafonne à ~1 requête/1,2 s et l'autre passe une
vue entière d'un coup.

Ce qui ramène le premier octet utile sous la demi-seconde :

- **Précharger l'en-tête et le répertoire racine au démarrage de l'application**
  (2 requêtes, ~490 ms, pendant que le globe se charge de toute façon). Ensuite
  chaque bloc coûte **une seule vague parallèle** de plages d'octets : **556 ms
  mesurés pour 8 tuiles**, et non 25 × 436 ms.
- **Servir depuis un domaine sous CDN Cloudflare** plutôt que le bucket R2 nu :
  la deuxième visite tape le cache de bord. ⚠️ SUPPOSÉ, non mesuré.
- **Garder les tuiles cuites de la région de démonstration** (le patron
  `water-tiles` existant) pour que le premier bloc affiché ne dépende de rien.

### 3.3 Les limites de PMTiles, honnêtement

- ⚠️ **Le fichier de démonstration public `demo-bucket.protomaps.com/v4.pmtiles`
  répondait 404 aujourd'hui.** Les builds datés `build.protomaps.com/*.pmtiles`
  sont **tournants** (« rotated out after a few days ») et la doc dit
  explicitement de **ne pas faire de lien direct** : *« URLs may change »*, il
  faut **copier le jeu chez soi**. Aucune de ces URL n'est une infrastructure
  sur laquelle bâtir.
- **3 allers-retours à froid** (en-tête → répertoire → tuile), contre 1 pour des
  fichiers cuits. Voir les mesures ci-dessus.
- **Pas de mise à jour partielle** : un fichier immuable qu'on remplace en
  entier.
- **`maxZoom` 15** : au-delà, il faut sur-zoomer côté client (ce qui est de
  toute façon la bonne stratégie, cf. §1.4).
- **Licence ODbL** (Produced Work, données OSM) : attribution
  « © OpenStreetMap contributors » obligatoire. Le dépôt sait déjà faire
  (`refreshOsmCredit()` dans `main.js`, `usingOsm = true`).

---

## 4. La chaîne de fabrication

### 4.1 Ce que j'ai vérifié moi-même

**`pmtiles extract` sait découper un fichier DISTANT sans le télécharger.**
[Doc CLI, VÉRIFIÉ](https://docs.protomaps.com/pmtiles/cli) :

- *« The source archive may be local or remote. »*
- `--maxzoom` : *« Extract only a subset of zoom levels. Extracting a full
  sub-pyramid from 0 to `maxzoom` is always an efficient operation that makes
  minimal I/O or network requests to the source archive. »*
- `--bbox MIN_LON,MIN_LAT,MAX_LON,MAX_LAT` et `--region` (polygone GeoJSON).
- `--minzoom` : *« This may require many more requests. »*

⚡ **Conséquence pratique : on peut fabriquer un `planet z0–12` sans jamais
télécharger les 137,6 Go** — une extraction `--maxzoom=12` sur l'archive
distante est explicitement documentée comme peu coûteuse.
⛔ **MAIS `extract` ne sait PAS retirer une couche.** Il découpe la pyramide, il
ne re-tuile pas. Un fichier « routes seules » demande de **re-tuiler** avec
tippecanoe ou planetiler à partir des données sources (Overture ou OSM), ce que
`scripts/build-road-tiles.mjs` savait déjà faire en DuckDB sur les Parquet
Overture. **Deux chemins possibles, à arbitrer :**
1. `pmtiles extract --maxzoom=12` sur le planet Protomaps → un fichier
   toutes-couches d'environ 17 Go (SUPPOSÉ, cf. §3.2), dont on ignore les
   couches inutiles au décodage. Simple, immédiat, mais on paie les octets de
   `landuse` et `buildings` à chaque tuile — or `landuse` mesuré à **459 802
   octets** sur une seule tuile z8 de Chamonix, soit 35× la couche `roads` de
   la même tuile. ⛔ **Rédhibitoire : ce chemin télécharge en moyenne 3 à 10×
   les octets utiles.**
2. Re-tuiler nous-mêmes depuis Overture `transportation/segment`, avec les
   grilles de classes par niveau. Plus de travail, mais c'est **le seul chemin
   qui fait payer au réseau ce qu'on dessine réellement** (§1.5), et le dépôt a
   déjà le script et le savoir-faire DuckDB.

**Recommandation : chemin 2.** Le chemin 1 sert de repli de validation.

### 4.2 Temps et mémoire des outils de tuilage

**Planetiler est le seul avec de vrais bancs publiés**, et la réponse à « est-ce
faisable sur une machine ordinaire ? » est **oui, c'est mesuré**.
[README, § Benchmarks](https://github.com/onthegomap/planetiler#benchmarks) —
profil OpenMapTiles, planet entier :

| Entrée | Machine | Temps | Sortie |
|---|---|---|---|
| planet-240108 (73 Go) | c7gd.16xlarge (64 cpu / 128 Go) | **42 min** | 69 Go pmtiles |
| planet-220530 (69 Go) | c6gd.**4xlarge (16 cpu / 32 Go)** | **2 h 38** | 79 Go mbtiles |
| planet-240108 (73 Go) | c7gd.**2xlarge (8 cpu / 16 Go)** | **3 h 35** | 69 Go pmtiles |
| planet-240108 (73 Go) | im4gn.**large (2 cpu / 8 Go)** | **18 h 18** | 69 Go pmtiles |

⛔ **Le mur n'est pas la RAM, c'est le DISQUE.** Le [log de la machine
8 cpu/16 Go](https://github.com/onthegomap/planetiler/blob/main/planet-logs/v0.7.0-planet-c7gd-16gb-no-z13-building-merge.txt)
affiche `⚠️ 360G storage requested for read phase`, `389G for write phase`,
`features 212GB`. Le README exige *« at least 1GB of free SSD disk space plus
**5-10x the size of the `.osm.pbf` file** »* et *« at least **0.5x as much free
RAM** as the input `.osm.pbf` »*. **Compter ~500 Go de SSD libre.**
⚠️ Le record à 19 min n'est pas transposable : son log montre
`✓ 305G storage on /data (tmpfs)` — **un disque en RAM**, avec 145 Go de heap.

**Protomaps n'a pas de moteur maison : c'est un profil Planetiler.**
[README basemaps](https://github.com/protomaps/basemaps) : *« A Planetiler build
profile that generates `planet.pmtiles` from OpenStreetMap and Natural Earth
**in 2-3 hours on a modest computer** »*. Leur
[Makefile](https://github.com/protomaps/basemaps/blob/main/tiles/Makefile)
assume deux profils : `planet` avec `-Xmx24g --nodemap-type=sparsearray
--nodemap-storage=mmap`, et `planet-xl` avec `-Xmx384g --storage=ram`.
⚠️ La machine et la durée du **build quotidien** ne sont **pas documentées**.

**Tippecanoe : mauvais outil pour le planet.** Il lit du GeoJSON / FlatGeobuf /
CSV, pas du `.osm.pbf`. Le README de Planetiler le dit lui-même : Tippecanoe
*« is not built for filtering and processing raw OpenStreetMap planet files at
global scale »*. En revanche il **sort du PMTiles directement** depuis la
version 2.17 ([Protomaps](https://docs.protomaps.com/pmtiles/create)) —
⚡ **c'est exactement l'outil de notre chemin 2** : DuckDB extrait les segments
Overture en GeoJSON, tippecanoe en fait un PMTiles avec des `minzoom` par
classe. ⚠️ **Aucun banc officiel** ; un retour terrain de 2023 rapporte un
OOM-kill sur 64 cœurs/64 Go avec 59 M de features, mais il est antérieur aux
optimisations mémoire du fork felt.

**Tilemaker : possible, mais mal documenté et lourd.** Aucun chiffre officiel
pour le planet. Les issues du dépôt donnent, par le mainteneur lui-même :
**37 h** sur 16 threads / 144 Go de RAM avec un pic à **131 Go** et **267 Go de
store** ([#315](https://github.com/systemed/tilemaker/issues/315)) ; un échec
sur 16 cœurs / 32 Go / 500 Go de disque, réussi seulement après passage à
**650 Go** ([#703](https://github.com/systemed/tilemaker/issues/703)) ; et en
août 2026, **1 h 30** sur une machine à 360 Go de RAM
([#925](https://github.com/systemed/tilemaker/issues/925)).
⚠️ **Piège** : *« The PMTiles archives that Tilemaker produces are currently not
clustered… you should optimize the archive with `pmtiles cluster` »* — et un
PMTiles non groupé ruine exactement ce qui fait l'intérêt des plages d'octets.

**`pmtiles extract` : les chiffres réels de transfert**, tirés des issues de
`go-pmtiles` :
- Monde z0–z5 depuis un planet de 120 Go : **6 requêtes, 16 Mo, 3,3 s**
  ([#225](https://github.com/protomaps/go-pmtiles/issues/225)).
- Europe, tous zooms : `11 169 714 tiles, 123 requests` → **34 Go en ~135
  requêtes HTTP Range** ([#269](https://github.com/protomaps/go-pmtiles/issues/269)).
- `--dry-run` donne la taille avant de télécharger. `--download-threads` défaut
  4, `--overfetch` défaut 0,05.
- Le mécanisme : un bitmap Roaring sur les TileIDs de Hilbert ; couvrir
  l'Amérique du Sud coûte **4 Mo / 25 ms au zoom 15**
  ([blog Protomaps](https://protomaps.com/blog/pmtiles-compressed-bitmaps/)).

⚡ **Conclusion de la chaîne : rien de tout ça n'est hors de portée.** Le chemin
le moins cher pour ShibuMap n'est même pas un build planet — c'est
**DuckDB sur les Parquet Overture (le script existe déjà) → GeoJSON par classe →
tippecanoe → PMTiles → `pmtiles cluster` → R2**. Aucun besoin de 500 Go de
disque : on ne traite que `transportation/segment`, et seulement jusqu'à z12.

---

## 5. Les services hébergés — et la question qui en disqualifie plusieurs

⚡ **« Les CGU autorisent-elles un rendu 3D personnalisé qui n'utilise PAS leur
SDK ? »** Réponse par fournisseur, avec les clauses citées.

| Fournisseur | Renderer tiers ? | Base |
|---|---|---|
| **Mapbox** | ⛔ **NON, en pratique** | §1.5 et §1.6 interdisent de dériver/extraire ; §1.9(v) interdit d'exporter, cacher ou stocker |
| **MapTiler** | ✅ **OUI, explicitement, et tarifé** | mais §6 « Export Usage » exige un accord écrit pour toute persistance |
| **Stadia Maps** | ✅ **OUI, écrit noir sur blanc** | *« Stadia Maps will always support your rights to use any library that you choose. »* |
| **OSM `vector.openstreetmap.org`** | ✅ revendiqué comme une valeur | mais serveurs de dons, retrait d'accès discrétionnaire |
| **Protomaps / OpenFreeMap / VersaTiles** | ✅ | aucune restriction de client |
| **CARTO** | ⚠️ jamais confirmé | §15 interdit *« create derivative works from the Basemap Services »* |

### 5.1 ⛔ Mapbox est disqualifié, et ce n'est pas une question de prix

[Mapbox Product Terms (21 juillet 2026)](https://www.mapbox.com/legal/product-terms),
clauses citées mot à mot :

- **§1.6** — *« Customer shall not trace or otherwise derive or extract content,
  data and/or information from the Service Offerings »* (seule dérogation : le
  tracé d'imagerie satellite, non commercial ou pour OSM).
- **§1.5(i)** — *« shall not modify, create derived works from […] the Service
  Offerings »*.
- **§1.9(v)** — *« not export, download, cache or store Licensed Map Content »*.
- **§1.5(iv)** — interdiction d'utiliser le service pour développer ce qui
  *« competes with any Mapbox product/service »*. ⚠️ ShibuMap **est** un moteur
  de rendu cartographique.

**Nuance à connaître** : il n'y a **pas** de clause « SDK obligatoire » sur le
web. §2.8.3 dit seulement que sans « Qualified Renderer » (= Mapbox GL JS), on
est facturé à la tuile ($0,25/1 000 au premier palier au-dessus de 200 000
gratuites/mois) au lieu du map load. **Le billing autorise ; les restrictions
d'usage interdisent.** Convertir un MVT en `BufferGeometry`, c'est littéralement
« derive or extract content ». ⛔ **Ne pas bâtir dessus.**

### 5.2 ✅ Stadia Maps : le seul qui autorise le cas par écrit

[docs.stadiamaps.com/vector](https://docs.stadiamaps.com/vector/), section
« Alternative Renderers » :
> *« Stadia Maps serves tiles that conform to the MVT specification, which means
> you have the option of using any renderer that supports the MVT format, not
> just MapLibre GL JS. […] Stadia Maps will always support your rights to use
> any library that you choose. »*

Et la ligne facturée elle-même est décrite comme *« Map tiles for use in
MapLibre and other client-side vector renderers »*.

Endpoint brut : `https://tiles.stadiamaps.com/data/openmaptiles/{z}/{x}/{y}.pbf`
(schéma OpenMapTiles, couches `transportation` / `transportation_name`, z0–14).

**Prix 2026** ([stadiamaps.com/pricing](https://stadiamaps.com/pricing/)) :
Free 200 k crédits/mois **non commercial uniquement** · **Starter $20/mois pour
1 M de tuiles** · Standard $80 pour 7,5 M · Professional $250 pour 25 M. Une
tuile vectorielle = 1 crédit.

⚠️ **Contraintes à coder** : cache client **7 jours maximum**, **cache serveur
interdit**, interdiction de *« creating derivative databases by systematically
extracting […] substantial portions of data »*, et §13 — un usage **hors du
modèle « une requête par vue »** (pré-rendu de vidéos, impression) **demande une
licence à part**. ⛔ Ça touche directement les skills `shibumap-shots` et
`shibumap-isometrie`, qui rendent des vidéos hors ligne.
⚠️ Le palier gratuit est **non commercial**, et leur FAQ compte comme commercial
*« use by an organization that is for-profit »* → adrienagency = plan payant.

### 5.3 MapTiler : autorisé et tarifé, mais deux clauses gênantes

[Tarifs](https://www.maptiler.com/cloud/pricing/) : *« Alternatively, use vector
or raster tile requests with third-party SDKs of your choice »* et *« Tile API
Requests are billed for usage of MapTiler maps with third-party SDKs »*.
Free $0 (100 k requêtes API/mois, **non commercial**) · **Flex $30/mois**
(500 k) · dépassement $0,15/1 000. Auto-hébergement : On-prem Standard
**$2 500/an**, mais *« internal app only (no B2B or B2C) »* → **inadapté à une
app publique**.

⚠️ Deux clauses à ne pas ignorer : General Terms **§4.4** — *« It is expressly
prohibited to manipulate or modify map content, in the form of vectors, pixels
or underlying metadata »* (rédaction si large qu'elle engloberait n'importe
quelle triangulation GPU) ; et Cloud Special Terms **§6 « Export Usage »** —
*« it is prohibited to export map content for usage outside the Service »* sans
accord écrit.

### 5.4 Protomaps hébergé : $14/mois, et c'est tout

[protomaps.com/api](https://protomaps.com/api) : *« The Protomaps Tile API is
free for non-commercial use. For commercial use, become a GitHub Sponsor. »*
Le palier [GitHub Sponsors](https://github.com/sponsors/protomaps) « Commercial
SaaS » est à **$14/mois** pour *« up to 1 million tile requests per month. This
is a soft limit »*. URL brute utilisable sans SDK :
`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=…`, z0–15, CORS par
liste blanche de domaines.

**Et leur propre calculateur d'auto-hébergement**
([docs.protomaps.com/deploy/cost](https://docs.protomaps.com/deploy/cost)), pour
10 M de requêtes + 1 To sortant + 110 Go stockés :
**Cloudflare (R2 + Workers) $11,45/mois** contre **AWS $119,56/mois**.

### 5.5 Les gratuits, et leur fragilité réelle

- **OpenFreeMap** ([openfreemap.org](https://openfreemap.org/)) : *« completely
  free: there are no limits on the number of map views or requests […] no
  registration, no API keys »*, et *« Is commercial usage allowed? — Yes. »*
  ⚠️ Mais : *« I don't offer SLA guarantees or personalized support »*, un
  **mainteneur unique** financé par dons, et une clause qui vise nommément notre
  cas : *« If you are using **alternative clients** […] you must add the
  following attribution: OpenFreeMap © OpenMapTiles Data from OpenStreetMap. »*
  Endpoint mesuré fonctionnel : `https://tiles.openfreemap.org/planet/<build>/{z}/{x}/{y}.pbf`.
- **VersaTiles** : sans clé, sans quota affiché, financé par NLnet/NGI0, mais
  cadré *« for prototyping and small projects »*, et le jeu public est la
  variante fusionnée → **attribution ESA WorldCover en plus**.
- **OSM `vector.openstreetmap.org`** : la politique est la plus favorable en
  esprit — *« in contrast to most web mapping providers, which insist that you
  use only their supplied API »* — mais elle tranche aussi :
  ⛔ *« OpenStreetMap data is free for everyone to use. **Our tile servers are
  not.** »*, *« Bulk downloading is prohibited »*, et *« Commercial services […]
  should be especially aware that access may be withdrawn at any point »*.
  **Excellent pour prototyper, à proscrire en production.**

### 5.6 Overture, et la licence

[docs.overturemaps.org/attribution](https://docs.overturemaps.org/attribution/) :
le thème **`transportation` est en ODbL** (pas CDLA — c'est `places` qui est en
CDLA-Permissive-2.0). Donc **aucun avantage de licence** par rapport à OSM.
Accès `s3://overturemaps-us-west-2/…` **sans compte AWS** (`--no-sign-request`,
egress payé par Overture) ; la release 2026-08-19.0 pèse **71,8 Go** pour
`transportation/type=segment`. C'est la source du script du dépôt.

### 5.7 ⚡ Le vrai point de décision n'est pas le fournisseur : c'est l'ODbL

Toutes ces sources dérivent d'OSM. L'attribution est facile ; le **partage à
l'identique** structure l'architecture ([ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)) :

- **§4.5(b)** — *« Using this Database […] to create a Produced Work does not
  create a Derivative Database »*. **Rendu à la volée = Produced Work.** Seule
  obligation : l'attribution.
- **§4.4(b)** — *« Extraction or Re-utilisation of the whole or a Substantial
  part of the Contents into a new database **is** a Derivative Database »*.
- **§4.6** — si on publie un Derivative Database, il faut en offrir une copie
  lisible par machine, **gratuitement si distribuée par internet**.

⛔ **Conséquence directe pour ShibuMap** : afficher des routes à la volée est
confortable. **Mais dès qu'un gabarit vendu, un pack hors ligne ou un fichier
`.shibumap-race` embarque de la géométrie routière**, on bascule en Derivative
Database et §4.6 oblige à en offrir le jeu gratuitement. **C'est un arbitrage
produit, pas technique, et il doit être tranché avant l'implémentation.**

### 5.8 Ce que je retiens de la section

⚡ **Fabriquer notre propre PMTiles depuis Overture et l'héberger sur R2 ne
supprime pas seulement une facture : ça supprime TOUT ce chapitre.** Pas de
clause de cache à 7 jours, pas d'interdiction de dériver, pas de retrait
d'accès, pas de licence à part pour le pré-rendu vidéo — juste l'attribution
OSM, que le site affiche déjà. **Le second choix, si on veut aller vite, est
Stadia Maps à $20/mois** (le seul dont les CGU couvrent explicitement notre
cas), avec la réserve du §13 sur les vidéos pré-rendues.

---

## 6. ⚡ LE DRAPAGE SUR LE RELIEF

### 6.1 ⛔ Le dépôt a déjà résolu ce problème, et il a écrit pourquoi

`src/gpx.js`, autour de la constante `DRAPE_LIFT`, porte la mesure qui condamne
la solution naïve — **relever la ligne d'une hauteur constante** :

```
demZoom 13 (bloc de 13 km)  ->   37 m de flottement
demZoom 11 (bloc de 19 km)  ->   54 m   <- ce que l'utilisateur a photographié
demZoom 10 (bloc de 91 km)  ->  260 m
demZoom  8 (bloc de 360 km) -> 1029 m
```

Et la conclusion, dans le code : *« A constant lift cannot be right at every
scale, so it shouldn't be doing this job at all »*. `DRAPE_LIFT` est tombé à
**0,012 unité** — il ne sert plus qu'au marqueur de tête.

**La solution retenue dans le dépôt, en trois pièces :**

1. **Densifier plus fin que la maille du terrain.** `densifyWorld(points,
   maxStep)` dans `draped-line.js` ; pour le ruban, `RUBAN_PAS = 0,07` unité,
   choisi explicitement **plus fin que la maille la plus dense** (~0,11 pour un
   bloc de 56 unités en 512 segments), *« donc la corde entre deux sections
   reste toujours sous la flèche du relief »*. Sans ça, une ligne droite entre
   deux sommets éloignés traverse la colline.
2. **Échantillonner la hauteur et poser la géométrie AU SOL.**
   `drapeWorld(points, sample, offset)` → `y = sample(x, z) + offset`.
3. **Régler le combat de profondeur dans l'espace de profondeur, pas en
   mètres.** `polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits:
   -4` sur les `LineMaterial` (gpx.js l. 1081-1083 et 1177-1179), avec le
   commentaire : *« Line2 draws fat lines as instanced TRIANGLES, so
   polygonOffset applies »*. Le calque d'eau fait déjà pareil
   (`water-layer.js`, l. 65).

⚡ **Pour les routes, il n'y a rien à inventer : `densifyWorld` + `drapeWorld` +
`buildLineSegments` avec `polygonOffset`, c'est déjà écrit, déjà en production
sur les rivières et sur la trace GPX.**

⛔ **ET LE COMMENTAIRE DU DÉPÔT EST À MOITIÉ FAUX — c'est le seul endroit où la
recherche contredit le code.** Deux corrections, vérifiées :

1. **`polygonOffset` ne fonctionne QUE sur des triangles.** WebGL n'expose ni
   `POLYGON_OFFSET_LINE` ni `POLYGON_OFFSET_POINT`
   ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/polygonOffset)),
   et la [FAQ OpenGL](https://www.opengl.org/archives/resources/faq/technical/polygonoffset.htm)
   est explicite : *« The GL_POINTS, GL_LINES, GL_LINE_STRIP, and GL_LINE_LOOP
   primitives can't be offset »*. Le dépôt a raison **parce qu'il utilise
   `Line2`/`LineSegments2`**, qui sont des maillages instanciés.
   ⚠️ **Contrainte dure pour les routes : ne JAMAIS retomber sur `THREE.Line` /
   `LineBasicMaterial` « pour alléger ». Le drapage cesserait silencieusement de
   fonctionner.**
2. **Ce n'est pas « indépendant de l'échelle ».** La formule est
   `offset = m × factor + r × units`, où **`r` est la plus petite différence
   résolvable du depth buffer — dépendante de l'implémentation ET de la
   distance**, puisque la précision du z-buffer varie en 1/z. Un couple
   `(-4, -4)` réglé au niveau du bloc n'a pas la même valeur physique au niveau
   du globe. C'est précisément pour ça qu'osgEarth calcule un **DepthOffset
   variable**, borné par un min/max en mètres sur une plage de distances, et non
   une constante. ⚠️ **À vérifier au banc sur ShibuMap, qui couvre justement
   six ordres de grandeur.** Le symptôme attendu, s'il y en a un, est l'inverse
   du `DRAPE_LIFT` : des routes qui **clignotent dans le relief** à très grande
   distance, pas qui flottent.

⚠️ **Et ne PAS espérer que le depth buffer logarithmique règle ça.** Cesium
l'utilise, mais il faut écrire `gl_FragDepth`, **ce qui désactive l'early-z** ;
mesure rapportée sur une scène de terrain three.js : **65 fps → 35 fps**
([forum three.js #88495](https://discourse.threejs.org/t/beware-of-logarithmic-depth-buffer-it-can-degrade-scene-performance/88495)).
La vraie réponse à six ordres de grandeur est le **reversed-Z flottant**
([NVIDIA, Depth Precision Visualized](https://developer.nvidia.com/content/depth-precision-visualized)),
⚠️ dont le support dans three.js **n'a pas pu être confirmé pour 2026**.

### 6.2 Le seul trou restant : le relief qui change de LOD sous la ligne

C'est le point que le dépôt n'a pas encore eu à traiter pour les routes, parce
que la trace GPX est reconstruite à chaque changement de bloc.

Le problème : la ligne est échantillonnée **sur le maillage rendu**. Quand le
quadtree remplace une tuile par une plus fine, le sol bouge sous une géométrie
déjà figée → la route s'enfonce ou décolle.

Deux familles de réponses, à arbitrer :

- **Ré-échantillonner à chaque changement de LOD** (ce que fait la trace GPX,
  l. 854 : `y = this.terrain.sample(...) + DRAPE_LIFT`). Simple, correct,
  mais coûteux si on le fait sur 76 000 points à chaque bascule.
  ⚡ **Correctif clé : échantillonner sur le MNT source, pas sur le maillage
  rendu.** Le MNT ne change pas de valeur quand le maillage change de densité —
  seule la géométrie affichée change. Une route échantillonnée sur le MNT reste
  au bon endroit ; c'est le *terrain* qui s'approche d'elle en s'affinant.
  L'écart résiduel est l'erreur de tessellation, que le `polygonOffset` absorbe.
  ⚡ **Et Cesium a exactement ce problème, l'a nommé, et a publié sa recette.**
  Deux fonctions, deux mondes : `Globe.getHeight()` lit la hauteur *« from the
  **rendered terrain** »* et dépend donc du LOD affiché ; `sampleTerrainMostDetailed()`
  va chercher *« the **most detailed height** information stored in your terrain
  data, regardless the rendering / distance / zoom level »*
  ([Cesium Community](https://community.cesium.com/t/terrain-height-in-cesium/22705)).
  **Échantillonner sur le maillage rendu, c'est échantillonner sur un LOD
  transitoire — c'est la cause racine.**
  Et le re-drapage, chez Cesium, n'est pas « tout refaire à chaque bascule » :
  c'est `QuadtreePrimitive.updateHeight`, un **abonnement par sommet** qui ne
  rejoue le callback que si **(1)** la tuile a une géométrie chargée,
  **(2)** son niveau est **strictement supérieur** au niveau déjà traité pour ce
  sommet — donc **monotone, jamais de retour en arrière** — et **(3)** la
  géométrie **n'est pas issue d'un upsample du parent**, donc pas du faux détail
  ([source](https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Scene/QuadtreePrimitive.js)).
  ⚡ **Ces trois conditions sont exactement ce qui empêche le tressautement.
  C'est la recette à copier.**

- **Draper dans le nuanceur** : ne pas stocker de `y` du tout, et faire lire au
  vertex shader la même texture de hauteur que le terrain, avec le même LOD.
  La ligne suit alors le sol **par construction**. C'est le **`ClampingTechnique`**
  d'osgEarth — un depth map du terrain, lu par le vertex shader qui décale ses
  propres sommets. ⚠️ Sa limite documentée est exactement celle du §6.1 :
  *« requires densely tessellated geometry for lines »* — donc `densifyWorld`
  reste indispensable. Effet de bord connu : les bounding boxes CPU deviennent
  fausses.

### 6.3 L'état de l'art, et pourquoi je recommande de NE PAS le porter

Les autres familles, vérifiées :

- **CesiumJS `GroundPolylinePrimitive`** — ce n'est pas du ré-échantillonnage,
  c'est un **volume d'ombre par segment résolu dans le depth buffer** : le
  fragment shader lit la profondeur du globe, reconstruit la position du terrain
  en espace œil, et la clippe contre des plans encodés en attributs de sommets
  ([blog Cesium 2018](https://cesium.com/blog/2018/07/23/polylines-on-terrain/),
  [PR #6615](https://github.com/CesiumGS/cesium/pull/6615)).
  ⚡ **Sa vertu décisive : la ligne ne connaît jamais le maillage, seulement le
  depth buffer du frame courant. Un changement de LOD ne produit RIEN.**
  ⛔ Mais : exige `WEBGL_depth_texture`, ~13 attributs de sommets *« limited by
  WebGL minimums »*, **la largeur bave sur les pentes raides** (*« the line
  width is much bigger than what was set because of the slope of the terrain »*),
  géométrie **immuable** après rendu, et les seuls chiffres publiés sont
  **~26 fps** pour la vue de démonstration (NVIDIA GT 750M, 1080p).
  ⚠️ À savoir : `depthFailMaterial` **ne fonctionne pas** avec
  `clampToGround: true` — *« The feature silently fails without warning »*
  ([#8635](https://github.com/CesiumGS/cesium/issues/8635)).
- **Drapage projectif (RTT)** — osgEarth `DrapingTechnique` +
  `CascadeDrapingDecorator` (**jusqu'à 8 cascades**, 4 par défaut : du CSM
  appliqué au drapage), deck.gl `TerrainExtension` en mode `'drape'`
  (⚠️ *marqué expérimental*), et Unreal **Runtime Virtual Texture**, dont la
  doc cite explicitement *« splines that are well suited to conform to the
  terrain »*.
- **Decals écran-espace** des moteurs de jeu : on dessine une boîte, on lit le
  depth buffer, on reconstruit la position monde, on `discard` hors de la boîte.
  ⚠️ Unity précise que *« This technique does not work on particles and terrain
  details »*.
- **`THREE.DecalGeometry`** : ⛔ **mauvaise piste ici.** Elle clippe la
  géométrie du mesh source — donc elle **dépend du maillage**, il faut la
  reconstruire à chaque changement de tuile, et c'est du CPU. Faite pour des
  impacts sur des objets, pas pour des routes sur un quadtree.

⛔ **Recommandation : ne rien porter de tout ça pour l'instant.** Ces techniques
servent à draper **sans connaître la hauteur du sol**. Ici on la connaît — c'est
notre propre MNT — et l'échantillonnage direct est plus simple, moins cher, déjà
écrit et déjà en production. Il ne lui manque que **les trois conditions de
`updateHeight`** et **l'échantillonnage sur le MNT source plutôt que sur le
maillage rendu**.

⚡ **La seule qui mérite d'être gardée en réserve** est le drapage projectif —
et sous une forme que ShibuMap peut se permettre : **cuire les routes dans la
texture de chaque tuile de terrain au moment où elle est générée**. Le LOD
devient alors un non-problème par construction, il n'y a plus de z-fighting du
tout, et — contrairement au raster téléchargé du §1 — **on garde la maîtrise de
la couleur et du filtre par classe**, puisqu'on rastérise nos propres vecteurs
et qu'on peut recuire quand la palette ou le cran de détail change.
⚠️ **SUPPOSÉ, non mesuré**, et ça coûte la netteté sous caméra oblique plus la
VRAM des textures. À sortir seulement si le drapage géométrique s'avère
instable sous changement de LOD, ou si les grandes villes restent trop lourdes
malgré le plafond de sommets.

### 6.4 Ce que coûte vraiment `LineSegments2` — VÉRIFIÉ dans le source

[`LineSegmentsGeometry.js`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/lines/LineSegmentsGeometry.js) :
la géométrie de base est une `InstancedBufferGeometry` de **8 sommets / 18
indices = 6 triangles**, instanciée **une fois par segment**, avec un
`InstancedInterleavedBuffer` de stride 6 floats.

⚡ **Une instance par segment, mais UN SEUL appel de dessin par objet.** Le
piège n'est donc pas l'instanciation, c'est le **nombre d'objets** : un retour
terrain rapporte *« if the count of lines increases to 1000 and more the fps
drops to 10 »*, cause identifiée — un `geometry` + un `material` **par ligne**
([forum #67635](https://discourse.threejs.org/t/improving-the-performance-of-high-density-lines/67635)).
✅ **`buildLineSegments()` fait déjà la bonne chose** (« One `LineSegments2` =
one draw call for the layer »). Le pattern recommandé pour aller plus loin —
buffer préalloué + `DynamicDrawUsage` + `setDrawRange` — est **déjà utilisé
dans `gpx.js`** (`instanceCount`, l. 2142).
⚠️ Limite connue à garder en tête : les `InterleavedBufferAttribute`
**empêchent `mergeGeometries`**, donc on ne pourra pas fusionner plusieurs
`LineSegments2` après coup — il faut construire le lot d'un seul tenant.

---

## 7. Ce que je recommande

1. **Vecteur.** MVT, filtré par classe et par zoom, avec un **plafond de
   sommets par vue** (~60 000, à valider au banc). Pas de raster en surcouche.
2. **Distribution : UN fichier PMTiles fabriqué par nous — routes seules, z0–12,
   avec des grilles de classes par niveau** (`highway`+`major_road` aux niveaux
   lointains, `minor_road` et `path` seulement aux niveaux proches), **hébergé
   sur Cloudflare R2**, lu par plages d'octets. Estimé **~4 à 6 Go** avant
   grilles, donc nettement moins après — dans le **palier gratuit de R2**
   (10 Go de stockage, 10 M de requêtes/mois, egress gratuit).
   Zéro serveur, zéro clé d'API, zéro quota, zéro CGU au-delà de l'attribution
   OSM que le site affiche déjà (`refreshOsmCredit()`).
   **En-tête et répertoire racine préchargés au démarrage** (~490 ms mesurés,
   pendant que le globe charge de toute façon) pour que chaque bloc ne coûte
   ensuite qu'**une vague parallèle de plages d'octets** (~556 ms mesurés pour
   8 tuiles).
3. **Ressusciter `road-tier.js`** (`git show af45f66^:src/map/road-tier.js` et
   son test de 126 lignes) en remplaçant les bandes de zoom écrites à la main
   par un **budget de sommets mesuré**, et en mappant `roadRank()` sur le
   vocabulaire `kind` de Protomaps (9 valeurs, §3.1) au lieu de `highway=*`
   d'OSM. `relativeTiers()` reste tel quel : c'est lui qui garantit qu'une
   vallée sans autoroute ne rend pas un calque vide.
   ⚠️ **Et garder la région cuite en fichiers statiques** (patron `water-tiles`)
   pour le premier bloc affiché : elle ne dépend d'aucun réseau tiers.
4. **Chaîne de fabrication : DuckDB (script existant) → GeoJSON par classe →
   `tippecanoe -o roads.pmtiles` → `pmtiles cluster` → R2.** Pas besoin d'un
   build planet Planetiler (500 Go de disque) : on ne traite qu'un thème et
   qu'une profondeur de zoom.
5. **Drapage : rien de neuf à écrire, deux choses à corriger.**
   `densifyWorld` + `drapeWorld` + `polygonOffset`, en échantillonnant **le MNT
   source** et non le maillage rendu, et en copiant **les trois conditions de
   `QuadtreePrimitive.updateHeight`** de Cesium (tuile chargée / niveau
   strictement supérieur / pas d'upsample).
   ⛔ **Ne jamais retomber sur `THREE.Line`** : `polygonOffset` n'a aucun effet
   sur les primitives non triangulaires en WebGL.
6. ⛔ **Ne jamais rebrancher Overpass en direct.** Ce n'est plus une question de
   goût : 238 Mo en 200 OK sur Paris, mesuré, dans ce dépôt.
7. ⛔ **Écarter Mapbox**, et si on choisit malgré tout un service hébergé,
   prendre **Stadia Maps** ($20/mois, 1 M de tuiles, autorisation écrite du
   rendu tiers), en sachant que le pré-rendu de vidéos sort de son modèle §13.
8. ⚠️ **Trancher AVANT d'implémenter la question ODbL §4.6** : la géométrie
   routière a-t-elle vocation à être **persistée et distribuée** (gabarits
   vendus, packs hors ligne, fichiers `.shibumap-race`) ? Si oui, on publie un
   Derivative Database et il faut en offrir une copie gratuitement. Si le calque
   reste un rendu à la volée, on est en Produced Work (§4.5b) et le sujet
   disparaît.

---

## 8. Ce que je n'ai PAS pu vérifier

**Sur les chiffres que je donne :**

- **Le poids réel d'un PMTiles `roads`-seul z0–12 du planet.** Estimé à
  **~4 à 6 Go** en croisant une règle documentée (« chaque zoom double la
  taille ») et une part de couche mesurée sur 20 tuiles. **Il faut le fabriquer
  pour le savoir** — `pmtiles extract --dry-run` donne la taille avant de
  télécharger, c'est le premier test à faire.
- **Le poids d'un vrai calque raster stylé.** Mes PNG sont un plancher : 1 px,
  une couleur, pas d'anticrénelage, pas de contours. Le gain d'un encodage WebP
  n'est pas mesuré non plus. Les deux marges vont dans des sens opposés.
- **La latence depuis un domaine sous CDN Cloudflare** plutôt que le bucket R2
  nu (mes 1 361 ms à froid / 556 ms pour 8 tuiles sont mesurés sur le bucket
  nu, depuis la France).
- **Les limites de taille de fichier de Netlify** et son support des requêtes
  `Range` sur les assets statiques. Non testé.

**Sur les sources externes :**

- **Machine et durée du build quotidien Protomaps** : non documentées.
  Le seul chiffre est *« 2-3 hours on a modest computer »*, sans spécifications.
- **Aucun banc officiel pour tippecanoe**, et aucun chiffre planet officiel pour
  tilemaker (ceux cités viennent d'issues, dont trois du mainteneur, mais les
  plus détaillés datent de 2021-2022, avant la refonte mémoire v3.0).
- **Aucun benchmark planet Planetiler avec le profil Shortbread.**
- **Le support du reversed-Z dans three.js en 2026** : mentionné comme « en
  développement » en décembre 2025, non confirmé depuis.
- **L'implémentation interne du drapage de Google Earth** n'est pas publique.
- **Formats exacts (MBTiles ou PMTiles) des packages MapTiler Data**, et aucun
  tarif à la carte par pays.
- **CGU formelles d'OpenFreeMap** (la page `/terms/` sert un corps vide) et de
  **VersaTiles** (aucune page trouvée) : ni quota ni SLA publiés.
- **La portée juridique réelle** du §4.4 de MapTiler (« manipulate or modify map
  content […] vectors ») appliqué à une triangulation GPU, et du §15 de CARTO
  (« create derivative works »). Les deux demanderaient une confirmation écrite
  du fournisseur. ⚠️ **Et rien de ce document n'est un avis juridique.**
