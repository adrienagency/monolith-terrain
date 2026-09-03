# BT-I — BLUETOPO CUIT ET BRANCHÉ : CE QUE J'AI MESURÉ, ET LES QUATRE SILENCES QUE J'AI CASSÉS

Arbre `C:\Dev\wt-bt2`, branche `bluetopo-integration`. Serveur
`npm run dev -- --host 127.0.0.1 --port 6611`. Toutes les valeurs de carte sont
lues **au GPU** (`readPixels` sur la texture GL de la tuile, décodage terrarium),
sonde `scripts/sonde-bt-a.mjs`, et **recoupées sur le disque** par
`scripts/releve-bt-i.mjs` et sur le **pivot brut** — trois lectures
indépendantes, parce qu'une seule ne distingue pas « la donnée est fausse » de
« la chaîne ne la sert pas ».

---

## ⚡ EN UNE PHRASE

**BlueTopo est cuite et branchée : 1 666 tuiles, 21,17 Mo, 10 zones, et les
21 960 tuiles préexistantes sont IDENTIQUES AU BIT** — 0 modifiée, 0 supprimée.
Mais l'intégration a surtout servi de révélateur : **quatre défauts silencieux**
séparaient la donnée de l'écran, dont un — la bande de fondu de 25 m — qui
**amputait de 55 % la profondeur de toute baie américaine**, et un autre qui
**écartait cinq zones cuites de l'index sans un mot**. Et **trois seuils du
barème demandent au fond marin d'avoir un relief que le levé NOAA à 4 m
n'a pas** : je les réfute avec la mesure de la donnée source, pas avec la mienne.

---

## ① LA RECONNAISSANCE — structure, couverture, poids

### L'index est horodaté DEUX FOIS, et personne ne l'avait vu

B2 avait relevé que le GeoPackage d'index de BlueTopo est horodaté
(`…_20260901_181619.gpkg`) et que « tout chemin figé pourrira ». **C'est vrai, et
c'est pire que ça** :

```
clé      BlueTopo/_BlueTopo_Tile_Scheme/BlueTopo_Tile_Scheme_20260903_145453.gpkg
publié   2026-09-03T19:04:41Z          ← le jour même de la reconnaissance
couche   BlueTopo_Tile_Scheme_20260903_145453   ← LE NOM DE LA COUCHE AUSSI
```

**Le nom de la couche INTERNE au GeoPackage porte le même horodatage.** Un
lecteur qui figerait `layer='BlueTopo_Tile_Scheme'` ne lèverait pas d'erreur :
**duckdb spatial TUE le processus** (exit 139, segmentation fault — mesuré). Un
`gl.getError()` propre ne prouve rien ; un code de sortie 0 non plus, et là il
n'y en avait même pas.

➡️ **`scripts/recon-bluetopo.mjs` balaie le préfixe `BlueTopo/_` à chaque
exécution**, prend le `.gpkg` le plus récent par `LastModified`, puis **relit le
nom de la couche dans le fichier**. Aucune date n'est écrite en dur nulle part.
Le seul chemin figé est le préfixe du dossier d'index.

### La structure, établie avant tout téléchargement

| | |
|---|---|
| bucket | `s3://noaa-ocs-nationalbathymetry-pds`, **public, listable sans compte** (vérifié) |
| arborescence | `BlueTopo/<ID de dalle>/BlueTopo_<ID>_<AAAAMMJJ>.tiff` + `.aux.xml` |
| format | TIFF classique LE · **Deflate (compression 8), Predictor 1** · float32 · **3 bandes entrelacées** (élévation, incertitude, contributeur) · tuilé 512×512 · NoData `nan` |
| référentiel | **NAD83 / UTM zone <n>N + NAVD88** (EPSG 269xx), lu dans la `GeoKeyDirectory` |
| licence | **CC0-1.0 écrite DANS le fichier** (tag TIFF 33432) et mention de non-navigation en tag 270 |

⚡ **L'index porte `GeoTIFF_Link`** : l'URL vivante de chaque dalle est déjà
dedans, et **un lien nul est la marque explicite d'un trou**. Je ne liste donc
pas 592 dossiers pour savoir ce qui existe — je lis la source d'autorité.

### La couverture réelle : trouée, et le trou est énorme

```
grille du schéma        12 684 dalles
publiées (GeoTIFF)       8 203              →  4 481 SANS DONNÉE, soit 35,3 %
poids total             89,17 Go            médiane 5,7 Mo · plus gros 472 Mo
```

| classe | dalles | poids | surface |
|---|---|---|---|
| 2 m | 20 | 0,13 Go | ~0 deg² |
| **4 m** | **7 431** | **43,79 Go** | 41,8 deg² |
| 8 m | 519 | 9,94 Go | 40,2 deg² |
| **16 m** | 233 | **35,31 Go** | **302,5 deg²** (le large) |

⛔ **ET LE TROU LE PLUS COÛTEUX : le détroit de Puget n'est PAS dans BlueTopo.**
278 dalles du schéma l'entourent, **0 publiée**. Élargi à tout le Pacifique
Nord-Ouest (−126…−121 / 45…50) : **0 dalle publiée sur toute la fenêtre**.
La promesse « 2-16 m sur les eaux américaines » ne couvre pas la côte ouest
nord. C'est structurel — *« une source fine est TOUJOURS trouée »* — mais
personne ne l'avait chiffré.
➡️ Remplacée par le **DEM NCEI Puget Sound 1/3″** (10,3 m, NAVD88), **même
régime juridique** (œuvre fédérale américaine, 17 U.S.C. §105), tiré par
**OPeNDAP** pour n'en prendre que la fenêtre utile au lieu des ~560 Mo.

---

## ② LE VERDICT SUR `SHELF` — non-événement ici, mais pas ailleurs, et prouvé des deux côtés

**Sur la Chesapeake, `SHELF = −500` est un strict non-événement, prouvé AU BIT :**

```
cuisson --shelf -500              127 tuiles écrites, 4 écartées
cuisson --shelf -99999 --all      127 tuiles écrites, 4 écartées
diff -r shelf-500 shelf-off       →  AUCUNE DIFFÉRENCE
```

La baie plafonne à −44,5 m : aucune tuile n'est « toute sous l'isobathe ».

⛔ **MAIS ÇA NE SE GÉNÉRALISE PAS, et je l'ai mesuré au lieu de le supposer.**
Trois dalles BlueTopo du large, téléchargées et lues bande par bande :

| dalle | résolution | min | **part sous −500 m** |
|---|---|---|---|
| BC24Q26W (large de la Californie) | 16 m | **−5 134 m** | **100 %** |
| BC26926R (large de la Caroline) | 16 m | **−4 887 m** | **100 %** |
| BC25T26L (golfe du Mexique) | 16 m | **−3 466 m** | **100 %** |

**Les 233 dalles de la classe 16 m — 35,31 Go, 302,5 deg², le talus et le large —
seraient jetées EN SILENCE par le défaut.** C'est très exactement la plaine
ionienne de B3, avant qu'on la paie une seconde fois. L'argumentaire de `SHELF`
(« une tuile qui n'a que de l'abysse n'apporte rien sur le terrarium ») est
solide **pour GEBCO à 464 m** et **faux pour une source à 16 m**.

➡️ Correctif : la cuisson des sources fines passe `--shelf -99999`
(`scripts/cuisson-bluetopo.mjs`), et surtout **le tuileur compte désormais les
deux motifs d'écart SÉPARÉMENT** :

```
✓ 127 tuiles écrites, 4 écartées
  dont 4 SANS DONNÉE de mer (écart gratuit) et 0 avec du fond mais TOUT sous -500 m
```

Confondre les deux avait déjà produit un faux constat sur ce chantier.
Un décompte qui ne distingue pas « rien à dire » de « jeté par le filtre » ne
mesure pas le filtre.

---

## ③ LES QUATRE SILENCES, mesurés puis cassés

### ⛔ ① La bande de fondu de 25 m amputait toute baie américaine de 55 %

**C'est le défaut central, et il n'était dans aucun brief.**
`fuseBathymetry` fond la source fine vers le rivage sur `BLEND_DEPTH = 25` m de
**profondeur**, en se servant de la profondeur comme **substitut de la distance
à la côte**. Le substitut est bon pour GEBCO — à 464 m, un fond de 25 m tient
dans un pixel de rivage. Il est **faux pour une source à 4 m**.

Mesuré en exécutant `fuseBathymetry` sur les valeurs de nos propres tuiles :

| fond de la source | fondu 25 m (avant) | fondu 2 m (après) |
|---|---|---|
| **−11,63 m** (embouchure de la Chesapeake) | **−5,21 m** | **−11,63 m** |
| −19,38 m (plateau louisianais) | −16,88 m | −19,38 m |
| −27,25 m (Virginia Beach) | −27,25 m | −27,25 m |
| −31 / −44,5 / −198 / −2 200 m | *inchangé* | *inchangé* |

**Le globe rendait −5,2 m ; nos tuiles portaient −11,63 m ; le levé NOAA dit
−11,54 m et GEBCO externe −10 m.** Une baie de 12 m sortait à 45 % de sa
profondeur, **à 20 km de toute côte**. Et la bande **ne fait déjà plus rien
au-delà de −27 m** : ce n'est donc pas un réglage global déguisé, c'est une
correction qui ne touche que le régime que BlueTopo est là pour décrire.

⚠️ **Et le rivage ne peut pas bouger, structurellement, pas par promesse** : la
branche TERRE (`l >= level && !noData`) est **en amont** du fondu, et
`deep = min(s, level − SEA_EPS)` interdit toujours à la source marine d'émerger.
**On raccourcit la transition SOUS l'eau, on ne déplace pas la ligne d'eau.**
Couvert par le test `BT-I-4`, qui le vérifie sur de la terre à +0,5 / +5 / +120 /
+3 000 m et sur des fonds de −0,001 à −11,63 m.

### ⛔ ② `normalizeIndex` aurait jeté `blendDepthM` — le TROISIÈME champ à ce piège

Exactement le piège de `waterLevelM` (mesuré par B2, corrigé par B3) : le
fichier juste, le code juste, et le nombre qui n'arrive jamais. `blendDepthM`
est maintenant recopié — **et seulement s'il est fini et positif**, donc une
zone sans le champ rend le comportement d'avant **au bit**. Les deux chemins le
portent (`src/dem.js` **et** `src/globe.js`) : n'en câbler qu'un ferait diverger
le globe et le damier sur la même emprise, l'écart que B3 a mis une session à
diagnostiquer.

### ⛔ ③ Cinq zones cuites, écartées de l'index sans un mot

`build-bathy-index.mjs` cassait la montée des niveaux dès qu'un niveau était
vide (« on ne saute pas un cran »). La règle est juste pour une grande zone.
Mais **il teste le CENTRE des tuiles**, et une tuile z9 fait **0,703° de large** :
une zone de 0,4° peut ne contenir **aucun centre de tuile z9** tout en étant
intégralement couverte de z10 à z13.

```
✖ chesa-median déclarée à z13 mais AUCUNE tuile fine cuite → ignorée
✖ virginia     …    ✖ ny-bight    …    ✖ georges    …    ✖ puget …
```

**700 tuiles sur le disque, cinq zones muettes, et la cascade serait restée au
socle z8 sur les cinq** — sans une erreur. Le cas « zone trop petite pour
contenir un centre » est désormais **calculé**, pas confondu avec « niveau non
cuit ».

### ⛔ ④ Le tuileur marin rendait ZÉRO TUILE, sans une erreur, sur un lac d'altitude

Signalé par l'audit BT-A, et vrai : `raw = m >= 0 ? 0 : m` n'a aucune notion de
niveau d'eau. Le **lac Érié** a sa nappe à +173,8 m et son fond à +111,2 m :
**tout est positif**, chaque pixel sort à 0, `anySea` reste faux, zéro tuile.

⚡ **Je n'ai PAS écrit un troisième tuileur.** `scripts/build-lake-tiles.mjs`
(B2) fait déjà ce travail, **sentinelle comprise**, et il est éprouvé sur le
Léman. Ce qui manquait n'était pas un correctif, c'était que le premier tuileur
**dise qu'il n'est pas le bon outil**. Il le dit maintenant, **avant** les trois
minutes de cuisson, et renvoie sur le bon script.

### ⚠️ Ce que je n'ai PAS touché, sur consigne

Le **zéro qui vaut à la fois « muet » et « 0 m »** est le chantier de **B5**
(`wt-bat3`, carrés plats du sud de la France), dans le même tuileur. Je ne l'ai
pas corrigé. **Lignes que j'ai touchées dans les fichiers partagés, pour la
fusion à la main :**

| fichier | ce que j'ai ajouté | risque de conflit |
|---|---|---|
| `scripts/build-bathy-tiles.mjs` | `PAS_V` (~l.97), une ligne dans `encodeTerrarium` (l.273), le garde-fou lac dans `main()`, deux compteurs `sansMer`/`sansPlateau` | **le garde-fou et les compteurs entourent la zone de B5** |
| `src/bathy.js` | **RIEN.** `opts.blendDepth` existait déjà ; personne ne le passait | aucun |
| `src/bathy-sources.js` | `blendDepthM` dans `normalizeIndex`, entrée `ncei` dans `SOURCES` | faible |
| `src/dem.js` | l. 534-549, `optsFusion` | faible |
| `src/globe.js` | l. 3493-3508, `opts` | faible |

---

## ④ CE QUE ÇA CHANGE — au GPU, en pente par kilomètre

**La grandeur mesurée n'est PAS l'erreur en mètres**, et l'audit BT-A a raison
sur ce point : les côtes américaines étaient déjà justes à ~6 m. Ce qui manquait
était le **détail**. Les deux grandeurs qui le disent :

- la **pente par kilomètre** — étendue de la fenêtre 9×9 ramenée au sol, donc
  indépendante de la taille de tuile (le piège à 256/512 px qui a coûté un faux
  constat à B3) ;
- le **rapport d'étendue z12→z13** — une interpolation pure vaut **exactement
  0,500**, c'est la signature d'une surface qui ne reçoit aucune donnée nouvelle.

### Sur nos propres tuiles (`node scripts/releve-bt-i.mjs`)

| lieu | z11 fond / pente | z12 fond / pente | z13 fond / pente | **rapport z12→z13** |
|---|---|---|---|---|
| **Chesapeake — embouchure** | −11,63 / 3,41 | −11,63 / 3,19 | −11,63 / **5,46** | **0,857** |
| New York Bight | −11,75 / 2,15 | −11,75 / 2,39 | −11,75 / **3,82** | **0,800** |
| Virginia Beach | −27,25 / 1,82 | −27,25 / 1,36 | −27,25 / 1,82 | 0,667 |
| Plateau ouest-Floride | −31,13 / 1,43 | −31,00 / 1,64 | −31,00 / **3,28** | **1,000** |
| Plateau louisianais | −19,38 / 0,21 | −19,38 / 0,41 | −19,38 / 0,83 | **1,000** |
| Puget Sound (NCEI) | −198,00 / 9,43 | −198,13 / **10,78** | −198,00 / 9,70 | 0,450 |

### Au GPU, avant / après, sur les points du barème

| point | AVANT (globe) | **APRÈS (globe)** | damier | externe |
|---|---|---|---|---|
| **Chesapeake — embouchure** | **−4,4 m** | **−11,6 m** à z10, z11, z12 **et** z13 | −12 | gebco2020 −10 |
| Chesapeake — bassin médian | −13 (GEBCO surzoomé) | **−13,1 m** à quatre niveaux | −13 | −13 |
| Virginia Beach | — | **−27,3 m** | −27 | −24 |
| New York Bight | — | **−11,8 m** | −12 | −10 |
| Tête du canyon de l'Hudson | — | **−75,2 / −75,4 m** | −76 | −76 |
| Georges Bank | — | **−39,7 m** | −37 | −40 |

Et la **pente par kilomètre** monte avec le zoom, ce qui est la signature d'une
carte qui **reçoit** de la donnée neuve au lieu d'en interpoler :

```
Chesapeake embouchure   z10 2,161 → z11 1,877 → z12 3,032 → z13 3,811 m/km
Chesapeake bassin médian z10 0,491 → z11 0,607 → z12 0,860 → z13 2,124 m/km
Virginia Beach           z11 1,447 → z12 1,957 → z13 5,127 m/km
New York Bight           z10 0,986 → z11 1,553 → z12 3,129 m/km
```

**Avant, ces six points n'avaient AUCUNE tuile au-delà de z8** : le rapport
d'étendue y valait la signature de l'interpolation pure, et la carte cessait
d'ajouter du détail à **488 m au sol** pour une source annoncée à 16 m —
**facteur 30**, chiffré par l'audit. Elle en ajoute maintenant jusqu'à z13,
c'est-à-dire **19 m au sol** à 37° N.

---

## ⑤ LA PREUVE QUE RIEN D'AUTRE N'A BOUGÉ — au bit, pas à l'œil

`scripts/empreinte-bathy.mjs` prend un **SHA-256 par tuile** avant et après.
Un décompte de fichiers ne prouverait rien : *« un banc différentiel ne
distingue pas "rien n'a changé" de "tout est cassé pareil" »*.

```
avant             : 21 960 tuiles
IDENTIQUES AU BIT : 21 960
modifiées         : 0
supprimées        : 0
ajoutées          : 1 666      {z9: 77, z10: 224, z11: 98, z12: 295, z13: 972}
```

**Zéro tuile modifiée, zéro supprimée.** L'Europe, la France (`fr-metro`,
895 tuiles EMODnet) et le Léman (`leman`, 392 tuiles swisstopo z9→z14) sont
**octet pour octet** ce qu'ils étaient. La zone `baikal` est intacte.

Et le **tuileur lui-même** est prouvé neutre par défaut : recuisson complète de
la Chesapeake avec le code modifié, comparée à la cuisson d'avant —
**`diff -r` vide, 127 tuiles identiques.** `--pas-vertical` vaut 1 par défaut,
et `Math.round(m / 1) * 1` **est** `Math.round(m)`.

---

## ⑥ LE POIDS — la colonne demandée

| zone | source | zmax | tuiles | **poids** | Ko/tuile |
|---|---|---|---|---|---|
| chesapeake | bluetopo 4 m | z13 | 346 | **5,02 Mo** | 14,9 |
| puget | **ncei 10 m** | z13 | 133 | **2,95 Mo** | 22,7 |
| virginia | bluetopo 8 m | z13 | 139 | **2,56 Mo** | 18,8 |
| ny-bight | bluetopo 4/8 m | z13 | 133 | **2,42 Mo** | 18,6 |
| chesa-median | bluetopo 4 m | z13 | 138 | **1,99 Mo** | 14,8 |
| floride-o | bluetopo 4/8/16 m | z13 | 121 | **1,94 Mo** | 16,4 |
| michigan | **ncei 93 m** | z10 | 145 | **1,25 Mo** | 8,8 |
| louisiane | bluetopo 4/8 m | z13 | 123 | **1,21 Mo** | 10,1 |
| erie | **ncei 93 m** | z10 | 80 | **0,28 Mo** | 3,6 |
| georges | bluetopo 16 m | z10 | 4 | **0,09 Mo** | 22,0 |
| *tuiles z9/z10 de bord, hors bbox* | | | 304 | 1,47 Mo | 4,9 |
| **TOTAL** | | | **1 666** | **21,17 Mo** | |

Pour comparaison, le Léman a coûté **3,22 Mo pour 404 tuiles z14**.

### Le coût d'une extension, chiffré et non estimé

La Chesapeake couvre **0,42 deg²** pour **4,9 Mo** de tuiles z9→z13 (et
**577 Mo** de GeoTIFF source à télécharger). D'où, par degré carré :
**z≤10 → 0,24 Mo · z≤12 → 3,33 Mo · z≤13 → 11,7 Mo**.

| étendue | surface | **poids de tuiles** | source à télécharger |
|---|---|---|---|
| **z10 sur TOUTE la couverture BlueTopo** | 384,5 deg² | **≈ 92 Mo** | 89,2 Go |
| **z12 sur le littoral (2+4+8 m)** | 82,0 deg² | **≈ 273 Mo** | 53,9 Go |
| **z13 sur le littoral** | 82,0 deg² | **≈ 959 Mo** | 53,9 Go |
| *ce que j'ai livré (10 zones ciblées)* | *~4 deg²* | **21,17 Mo** | 1,2 Go |

⛔ **Le z13 littoral entier double le `dist/`** (968 Mo aujourd'hui) sur un plan
Netlify à plafond dur. **Le ciblage n'est pas une économie, c'est la seule forme
livrable** — et c'est bien l'arbitrage d'Adrien. Au-delà, il faut un CDN.

### Déploiement

⛔ **`build:bathytiles` n'entre PAS dans `npm run deploy`**, confirmé : les
rasters sources (89 Go pour BlueTopo, 137 Mo pour les Grands Lacs) ne sont pas
dans le dépôt, et l'y mettre ferait échouer tout déploiement fait ailleurs. Les
tuiles se cuisent hors ligne et se versionnent. `build:bathyindex`, lui, y est
déjà (B3) — et il le fallait, puisque `index.json` est *gitignore* et que
**mes dix zones ne seraient jamais parties sans lui**.

---

## ⑦ CE QUE J'AI CRU, PUIS RÉFUTÉ

- ⛔ **« `creditsForBounds` est cassé : ni BlueTopo ni EMODnet ne sortent. »**
  Mon premier contrôle rendait GEBCO seul, y compris sur la Bretagne où EMODnet
  est cuit depuis des mois — j'ai cru une seconde à un défaut de fond. **Faux :
  c'est MON appel qui était faux.** `overlaps` lit
  `{minLat, maxLat, minLon, maxLon}` et je passais `{west, south, east, north}`.
  Toutes les comparaisons rendaient `undefined >= …`, donc `false`, **sans une
  erreur**. Le témoin EMODnet est ce qui m'a sauvé : une source dont je *savais*
  qu'elle marchait échouait aussi, donc le défaut était chez moi.
  **Un contrôle sans témoin connu-bon aurait publié un faux constat.**
- ⛔ **« Le tuileur marin ne sait pas cuire BlueTopo, il va falloir un troisième
  cuiseur comme B2 en a écrit un pour le Léman. »** Faux, et je l'ai vérifié
  avant d'écrire une ligne : BlueTopo est **marine**, ses élévations sont
  négatives dans l'eau et NoData sur la terre. `build-bathy-tiles.mjs` la cuit
  **sans un changement**. Le seul script neuf de la chaîne est le **pont** depuis
  l'UTM projeté. Le cas du Léman était différent parce qu'un lac d'altitude est
  positif de bout en bout — ce n'est pas le même problème, et j'allais le
  traiter comme s'il l'était.
- ⛔ **« SHELF va me coûter des tuiles sur la Chesapeake. »** C'était l'avertissement
  du brief et je l'ai pris pour un fait. **Faux : strict non-événement, prouvé au
  bit** (deux cuissons, `diff -r` vide). ⚡ Mais en cherchant à le prouver j'ai
  trouvé **où il coûte vraiment** — les 233 dalles de 16 m du large, 100 % sous
  −500 m. **Le brief avait raison sur le danger et faux sur le lieu**, et seule la
  mesure des deux côtés le disait.
- ⛔ **« Les zones sont déclarées, l'index les publie. »** Je l'ai écrit dans un
  commit avant de lire la sortie de `build-bathy-index.mjs`. **Cinq zones sur
  dix étaient silencieusement écartées**, 700 tuiles pour rien. Le message était
  à l'écran depuis le début. **Lire la sortie de son propre outil n'est pas
  facultatif** — je ne l'ai vu qu'en relisant par acquit de conscience.
- ⛔ **« Le fond ne bouge pas entre z11 et z13 : ma chaîne ne sert pas les
  tuiles fines. »** Mon relevé disque rendait **0,00 m d'écart à tous les
  points**, et j'ai passé un moment à chercher le défaut de descente.
  **Faux — et c'est le fond marin qui a raison.** Mesuré **sur le pivot BlueTopo
  brut**, avant tout tuilage :

  | point | empreinte z11 | empreinte z13 | **écart réel** |
  |---|---|---|---|
  | Chesapeake embouchure | −11,542 m (49 cellules) | −11,559 m (6) | **0,017 m** |
  | New York Bight | −11,785 m (56) | −11,742 m (6) | **0,043 m** |
  | Puget Sound | −198,192 m (63) | −198,185 m (9) | **0,007 m** |

  **Le levé NOAA à 4 m lui-même ne contient que 0,017 à 0,043 m d'écart entre
  ces deux empreintes.** Le seuil BT-2 en demande **1,000 m**, soit **23 à 60 fois
  plus que ce que le fond marin porte à cet endroit**. Ce n'est pas un défaut de
  résolution : c'est un seuil posé là où la grandeur qu'il nomme n'existe pas —
  la **septième** occurrence de cette classe sur ce chantier, après les deux que
  B3 a démontées et les deux que BT-A signale lui-même. À 3 m/km de pente,
  passer d'une empreinte de 76 m à une de 19 m ne peut déplacer la moyenne que
  d'environ 0,2 m. **Aucune carte vraie ne passe ce seuil ici.**
- ⛔ **« Le lac Érié est mal rendu : 22,5 m au lieu des 60 m documentés. »**
  C'est ce que dit BT-7, et j'allais chercher un défaut de cuisson.
  **Faux : c'est la carte qui a raison.** Le levé NCEI lui-même, lu dans le
  pivot au point exact du barème (42,00 / −81,50), donne **22,70 m sous la
  nappe** ; le globe rend **22,49 m**. **0,21 m d'écart avec la donnée
  d'autorité.** Les 64 m de profondeur maximale du lac Érié sont dans le bassin
  **oriental** — mon balayage complet du pivot les retrouve **à 42,4925 N /
  −79,9475 E, soit 62,58 m sous la nappe**, à **130 km** du point du barème.
  Même erreur, même remède qu'en ②-Caspienne chez B3 : **c'est la coordonnée
  qui est fausse, pas la carte.**
- ⛔ **« Le plateau louisianais est lissé par ma chaîne. »** Il rend 0,41 m/km à
  z12 contre les 2,00 demandés. **Faux : le levé BlueTopo à 4 m dit la même
  chose.** Le plateau au large de Terrebonne est de la vase à très faible
  gradient — l'un des fonds les plus plats du golfe. Le barème compare aux
  11,5 m/km de la Manche, qui est un plateau à courants de marée : **deux
  régimes sédimentaires différents, pas deux qualités de carte.**
- ⛔ **« Le câblage de `blendDepthM` est sans risque : c'est un champ optionnel
  de plus. »** **Je l'ai cassé, et le globe s'est tu.** `src/globe.js` portait
  `tuilePorteDeLaMer(heights, opts ? opts.seaLevel : 0)` — juste tant qu'`opts`
  ne pouvait contenir que la nappe. Dès qu'il peut ne porter **que** la bande de
  fondu, `opts.seaLevel` vaut `undefined`, toutes les comparaisons rendent
  `false`, la tuile est refusée, et **le globe rendait 0,0 m pendant que le
  damier rendait −12 m dans la même session** :

  ```
  Chesapeake z11/256  globe  0.0   damier -12      ← après mon câblage
  Chesapeake z11/256  globe -11.6  damier -12      ← après le `?? 0`
  ```

  Aucune erreur, aucune exception, aucun 404. **C'est la mesure qui l'a
  attrapé, pas la relecture** — et je venais d'écrire dans un commit que le
  correctif était sans effet de bord. Corrigé en `opts?.seaLevel ?? 0`.
- ⛔ **« Le pas vertical de 0,125 m plafonne la pente mesurée : il faut
  descendre à 1/32. »** Raisonnement séduisant — le globe rendait 0,038 m de
  peigne à Virginia Beach, soit un tiers du pas — et j'allais payer la
  recuisson. **Faux, mesuré sur trois cuissons complètes de la même zone :**

  | pas vertical | poids z12+z13 | peigne z12 | peigne z13 |
  |---|---|---|---|
  | 0,125 m | **5,01 Mo** | 0,0677 | 0,0590 |
  | 0,031 25 m | 8,64 Mo (**+72 %**) | 0,0668 | 0,0516 |
  | 0,003 906 m (1/256) | 16,16 Mo (**+223 %**) | 0,0661 | 0,0516 |

  **Le peigne ne monte pas — il baisse.** Le pas n'était donc pas le plafond :
  le peigne propre de nos tuiles vaut ~0,066 m et ne bouge plus au 1/256.
  J'aurais payé **+72 % d'octets pour zéro mètre de relief**. ⚡ Le vrai
  plafond est ailleurs et je l'ai trouvé en cherchant celui-là : **le globe sert
  des tuiles d'altitude de 512 px alors que nos tuiles bathy font 256 px par
  construction**. La fenêtre 9×9 du barème couvre donc **4,5 texels de donnée
  réelle**, les autres étant du Catmull-Rom — ce qui **divise mécaniquement le
  peigne par deux**, puis la pente est encore divisée par un texel de 512.
  C'est architectural, pas de la donnée : nos tuiles rendent **2,22 m/km** à
  z12 sur la Chesapeake là où le globe en lit 1,88.
- ✅ **Ce que je confirme de l'audit BT-A** : la carte cessait bien d'ajouter du
  détail à z8, le relevé réseau était bien un plafond d'index et non des 404, et
  **le tuileur rendait bien zéro tuile en silence sur un lac d'altitude** — les
  trois constats sont exacts et les trois sont corrigés.
- ✅ **Ce que je confirme de B2** : l'index gpkg est bien horodaté et « tout
  chemin figé pourrira » — c'est même vrai deux fois.

---

## ⑧ LE BARÈME BT-A, TEST PAR TEST

`npm run dev -- --host 127.0.0.1 --port 6611` puis
`BTA_PORT=6611 node --test test/attaque-bt-ROUGE.mjs`.

| # | ce qu'il demande | verdict | la mesure |
|---|---|---|---|
| **BT-1** | étendue z12→z13 ≥ 0,70 | **0,687** — manque de 2 % | sur **nos tuiles** le rapport vaut **0,857** et sur le **pivot brut 0,714** : la donnée passe la barre, la cascade la perd (voir ci-dessous) |
| **BT-2** | fond bougé de ≥ 1,00 m entre z11 et z13 | **réfuté** | le **levé NOAA lui-même** ne bouge que de **0,017 à 0,043 m** entre ces deux empreintes |
| **BT-3** | baie ≥ 9 m de fond à z11 et z12 | ✅ **acquis** | **−11,6 m** aux deux niveaux (était −4,4) |
| **BT-4** | 4 plateaux ≥ 2 m/km à z12 | **2 sur 4** | Georges Bank ✅ · ouest-Floride ✅ · Virginia Beach **1,957** · Louisiane **0,755** — voir la réfutation |
| **BT-5** | tuiles bathy sous z8 à Chesapeake **et** Puget | ✅ **acquis** | et Puget n'a **aucune** dalle BlueTopo : c'est NCEI qui le couvre |
| **BT-6** | une zone `bluetopo` à zmax ≥ 12 | ✅ **acquis** | **sept** zones bluetopo à z13 (une à z10) |
| **BT-7** | Grands Lacs ≥ 30 m sous la nappe | **réfuté** | le levé NCEI dit **22,70 m** au point du barème, le globe **22,49 m** — 0,21 m d'écart |
| **BT-8** | ⛔ **éliminatoire** — 5 témoins hors USA à ±5 m | ✅ **acquis** | et prouvé plus fort : **21 960 tuiles identiques AU BIT** |

### ⚠️ BT-1 : le seuil est posé SUR la valeur du fond, à 2 % près

Quatre lectures indépendantes du même rapport, au même point :

| lecture | rapport z12→z13 |
|---|---|
| **pivot BlueTopo brut** (4 m, avant tout tuilage) | **0,714** |
| nos tuiles à 256 px | 0,857 |
| **nos tuiles recuites à 512 px** | **0,667** |
| **le globe, au GPU** | **0,687** |

**Le seuil de 0,70 tombe au milieu de cet intervalle.** Ce n'est pas 2 % de
résolution qui manquent : c'est que le rapport d'étendue de ce fond **vaut à peu
près 0,70**, et que sa valeur mesurée dépend de la fenêtre choisie autant que du
fond. Le repère du barème est solide — une interpolation pure vaut exactement
0,500, et nous en sommes loin, à 0,687 — mais **la marge entre « pas de donnée
nouvelle » (0,500) et le seuil (0,700) est plus étroite que la dispersion de la
grandeur elle-même**.

### ⚠️ BT-4 : deux échecs, et ce ne sont PAS le même défaut

J'ai mesuré la pente **dans le levé brut**, sur la fenêtre exacte du barème
(9 texels de 512 px à z12), avant tout tuilage :

| plateau | **pente du levé NOAA** | pente lue au globe | verdict |
|---|---|---|---|
| Chesapeake embouchure | 3,297 m/km | 3,032 | — |
| ouest-Floride | 3,382 m/km | ✅ passe | |
| **Virginia Beach** | **2,973 m/km** | **1,957** | ⛔ **la chaîne perd 34 % de pente réelle** |
| **Plateau louisianais** | **0,608 m/km** | 0,755 | **le seuil dépasse le fond** |

**Deux diagnostics opposés sous un seul test.**
Le **plateau louisianais** — vase du large de Terrebonne, l'un des fonds les
plus plats du golfe — **ne contient que 0,608 m/km dans le levé à 4 m** :
demander 2 m/km, c'est demander à la carte d'inventer trois fois le relief
mesuré. Le barème le compare aux 11,5 m/km de la Manche, qui est un plateau à
courants de marée : **deux régimes sédimentaires, pas deux qualités de carte.**
**Virginia Beach, au contraire, EST un vrai manque de la chaîne** : le levé y
porte 2,973 m/km et le globe n'en lit que 1,957. La cause est celle décrite
ci-dessous — la fenêtre du globe est en 512 px sur un contenu bathy de 256 px,
et le Catmull-Rom entre deux texels réels **divise le peigne par deux**.

⛔ **Et j'ai essayé de gagner les 2 %, puis j'ai renoncé sur la mesure.**
`BATHY_TILE_PX` n'est pas figé côté client (`src/dem.js:191` lit
`img.width || BATHY_TILE_PX`), donc cuire les niveaux fins en 512 px pour qu'ils
aient la taille de la tuile d'altitude qu'ils habillent semblait rendre à la
fenêtre ses neuf texels réels. **Cuisson complète faite, et le rapport BAISSE à
0,667** pour 12,3 Mo au lieu de 5,0. La raison est géométrique : à 512 px, neuf
texels couvrent **deux fois moins de sol** — la fenêtre z12 en 512 **est** la
fenêtre z13 en 256 (0,75 m d'étendue et 3,87 m/km des deux côtés, au chiffre
près). On ne densifie pas la mesure, **on la rétrécit**. J'aurais déployé
+150 % d'octets pour perdre 2 points de rapport.

⚡ **L'arbitrage complet, puisque les deux critères tirent en sens contraire :**
cuire en 512 px **rendrait** à BT-4 la pente que la chaîne perd (Virginia Beach
remonterait vers ses 2,973 m/km réels) et **coûterait** à BT-1 (0,687 → 0,667).
Mais **BT-4 échoue de toute façon sur le plateau louisianais**, dont le levé ne
porte que 0,608 m/km : le 512 px ne fait donc gagner **aucun** des deux tests,
et en coûte 150 % d'octets. **J'ai gardé 256.** La décision est écrite ici avec
ses deux chiffres pour qu'elle soit rejugeable, pas pour qu'elle soit crue.

## ⑨ RESTE OUVERT

- ⛔ **LE PLUS IMPORTANT : la cascade perd un tiers de la pente réelle sur une
  tuile de 512 px.** Chiffré à Virginia Beach : le levé porte **2,973 m/km**, le
  globe en lit **1,957** (−34 %). La cause est nommée et reproductible — le
  contenu bathy est en 256 px, la fenêtre de mesure en 512, et le Catmull-Rom
  entre deux texels réels divise le peigne par deux. **Ce n'est pas propre à
  BlueTopo** : ça vaut pour EMODnet et pour GEBCO surzoomée, donc pour toute la
  carte. Les deux issues possibles (cuire en 512, ou interpoler la bathy autrement
  que par Catmull-Rom avant la fusion) sont chiffrées ci-dessus ; **aucune n'est
  gratuite et je n'ai pas tranché.**
- ⚠️ **`copernicus` reste sans zone** : elle exige un compte (B3 l'a établi),
  ce n'est pas une décision d'agent. `bluetopo` en a maintenant **sept**, `ncei`
  **trois**.
- ⚠️ **Le talus continental n'est toujours pas cuit** (≈ 3 650 tuiles z12 entre
  −500 et −2 000 m d'après l'audit). Le correctif est prêt — `--shelf -99999`
  est passé par `cuisson-bluetopo.mjs` — mais les dalles de 16 m pèsent 35,31 Go
  à télécharger pour une zone que peu de visiteurs regarderont. **C'est une
  décision de budget, pas de code.**
- ⚠️ **`blendDepthM` vaut 2 m sur les huit zones marines fines, et c'est un
  chiffre choisi, pas mesuré.** Il est sans effet au-delà de −27 m et rend le
  fond entier en deçà ; entre les deux, je n'ai pas cherché l'optimum. Une valeur
  liée à la **résolution de la source** serait plus juste qu'une constante par
  zone.
- ⚠️ **Les 4 481 dalles sans GeoTIFF (35,3 %) ne sont pas cartographiées.**
  Je sais que Puget est vide ; je n'ai pas établi la carte des autres trous.
- ⚠️ **Les GeoTIFF sources (1,2 Go), les pivots et les grilles NCEI sont
  `.gitignore`** et reconstructibles : `recon-bluetopo.mjs` → `pivot-bluetopo.mjs`
  → `cuisson-bluetopo.mjs`. Seules les **1 666 tuiles (21,17 Mo)** sont déployées.
