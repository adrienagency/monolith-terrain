# RAPPORT B2 — les sources : océan fin, et la bathymétrie des LACS

Arbre `C:\Dev\wt-bat2`, branche `bathy-sources`. Aucun fichier de `src/` modifié.

---

## LE CHIFFRE D'ABORD

**Le fond des lacs est cuisible et je l'ai cuit : 404 tuiles, 3,22 Mo, tout le
Léman de z9 à z14, fond lu à 310,05 m contre 309,70 m de référence CIPEL —
+0,35 m, soit 0,11 %.**

**Mais ces tuiles sont INERTES telles quelles**, et pas à cause des données :
`src/dem.js:495` appelle `fuseBathymetry(data, seaData)` **sans options**, donc
`seaLevel = 0`. Un pixel de Léman vaut +372 m dans le terrarium ; il tombe dans
la branche TERRE de `fuseBathymetry` et sort inchangé. Mesuré, contrôle ② :

```
fond au milieu du lac : 372.05 m   (la source dit 62.05 m)
```

**Aucun lac au-dessus du niveau de la mer ne peut être décrit par la cascade
actuelle.** Ce n'est pas un réglage à trouver, c'est structurel — et c'est aussi
la bonne nouvelle, parce que le correctif est petit et je l'ai vérifié.

---

## ① LE TABLEAU DES SOURCES DE LACS, CLASSÉ

| # | source | résolution | couverture | licence exacte | commercial + redistribution | attribution imposée | format | poids |
|---|---|---|---|---|---|---|---|---|
| **1** | **swissBATHY3D** (swisstopo) | **2 m** (Léman ; 1 m ailleurs, 3 m Constance) | 22 lacs suisses, ~2 180 km² | Conditions swisstopo « géodonnées gratuites » (OGD) | **OUI, explicitement** : « may be used, distributed and made accessible […] and also used commercially » | **`Federal Office of Topography swisstopo`** (ou `©swisstopo`) — *mandatory* | ESRI ASCII grid / XYZ, dalles 1 km², EPSG:2056 + LN02 | **390 Mo** zip source → **3,22 Mo** de tuiles pour le Léman |
| **2** | **NOAA NCEI Great Lakes** | 3″ ≈ **90 m** | 5 Grands Lacs + St. Clair (**Supérieur partiel**) | Domaine public fédéral US, non soumis au copyright | OUI, sans réserve | citer NCEI + DOI | GeoTIFF / NetCDF / ASCII / XYZ | ~10 Mo de tuiles estimées (z11) |
| **3** | **GLOBathy** | 1″ ≈ 30 m *nominal* | **mondiale**, 1 427 688 plans d'eau | **CC0 1.0** (figshare) | OUI, aucune obligation | aucune (citer par courtoisie) | 1,4 M de GeoTIFF | **16,7 Go** de rasters bruts |
| **4** | **ETOPO 2022** | 15″ ≈ 450 m | mondiale ; fonds de lac pour Grands Lacs, Caspienne, Baïkal (via GEBCO) | Domaine public US ; cellules lacustres sous conditions GEBCO | OUI | citer NCEI, DOI `10.25921/fd45-gt74` | GeoTIFF, 288 dalles 15°×15° | ~6 Go (15″) |
| **5** | **3D-LAKES** (2025) | courbes A–E + bathy dérivée | 510 530 lacs, 98,9 % du volume mondial | **CC BY 4.0** (Zenodo) | OUI avec attribution | citation de l'article | JSON / CSV, pas de GeoTIFF prêt | 2,0 Go |
| **6** | **HydroLAKES** | vecteur (contours, **pas de fond**) | 1,4 M de lacs | CC-BY 4.0 sur la fiche produit | ⚠️ **contradiction** (voir ci-dessous) | attribution HydroSHEDS | gdb / shp | 763 Mo |
| **7** | Lac Victoria (Hamilton) | 100 m | Victoria | CC BY 4.0 | OUI | citer Hamilton | GeoTIFF | petit |
| **8** | HRBS-GLWNB 2020 | ~100 m | Victoria, Albert, Edward, George | Harvard Dataverse — **étiquette à vérifier par fichier** | probable, non confirmé | — | shp / GeoTIFF / CSV | — |

### ⛔ CE QUE J'ÉCARTE, ET POURQUOI — le dépôt vend des cartes

- **Léman, variante canton de Vaud** (viageo.ch, MNT 2 m + isobathes). Conditions
  fixées par la « norme OIT/DCG 8401 » + 25 CHF de frais, **redistribution
  commerciale non confirmée**. → **ÉCARTÉ.** Inutile de toute façon : swisstopo
  couvre le même lac, au même niveau, sous une licence explicitement commerciale.
- **Baïkal, carte de Batist 2002 via GFZ Potsdam** (DOI 10.1594/GFZ.SDDB.1204).
  **Aucune licence explicite** sur la fiche. → **ÉCARTÉ** jusqu'à accord écrit.
  Repli : le Baïkal est dans GEBCO, donc dans ETOPO 2022, domaine public.
- **Tanganyika, Malawi.** **Aucune** bathymétrie grillée ouverte trouvée. Les
  cartes publiées sont dans des figures payantes ou chez des vendeurs
  commerciaux (TCarta). Les images de l'ILEC World Lake Database sont des scans
  sans licence de réutilisation. → **ÉCARTÉ.** Repli GLOBathy (CC0).
- **HydroLAKES — le piège juridique à connaître.** La fiche produit dit CC-BY
  4.0, mais la page `hydrosheds.org/terms-of-use` du **site** dit « personal,
  non-commercial use only » et exclut « any commercial use or any resale or
  redistribution ». Les deux textes coexistent. Comme on n'a besoin que du
  *fond*, pas des contours, **on n'a pas à trancher : GLOBathy est CC0 et se
  suffit.** Ne pas embarquer les polygones HydroLAKES.
- **IGN RGE ALTI, Litto3D (Shom).** Licence Ouverte Etalab 2.0, parfaites — mais
  **elles ne contiennent aucun fond de lac** : Litto3D est du littoral marin,
  RGE ALTI pose une surface d'eau plate. Aucun lac français majeur (Annecy,
  Bourget) n'a de levé officiel public. → sans objet.

---

## ② RECOMMANDATION N° 1, PRÊTE À IMPLÉMENTER

### **swissBATHY3D pour le Léman, plafond z14.**

Pourquoi elle et pas GLOBathy en premier : elle est **mesurée**, pas modélisée ;
elle est 230× plus fine que GEBCO ; sa licence autorise le commerce **en toutes
lettres** ; elle coûte 3,22 Mo ; et le Léman est la zone de contrôle naturelle du
dépôt (le calage `WATER_REGION` d'Annecy/Chamonix/Léman existe déjà).

**Pourquoi z14 et pas plus.** z14 = 6,58 m/px à 46,4°. Le natif est 2 m, donc
z15 (3,29 m) serait encore honnête et z16 (1,65 m) surzoomerait. Je m'arrête à
z14 parce que le gain visuel ne justifie pas ×4 d'octets à chaque niveau, et
parce que `overzoomTile` sait déjà agrandir au-delà. **Le plafond peut monter
plus tard sans rien casser — il ne redescend jamais.**

### L'entrée `index.json` à écrire

```json
{
  "id": "leman",
  "source": "swisstopo",
  "zmax": 14,
  "waterLevelM": 372.05,
  "bbox": [6.1267, 46.2035, 6.9328, 46.522]
}
```

Prête dans **`scripts/bathy-zones-lacs.b2.json`** (fichier séparé exprès : je ne
touche pas à `scripts/bathy-zones.json`, que B3 va éditer).

### Le crédit à ajouter à `SOURCES` (src/bathy-sources.js)

```js
swisstopo: {
  id: 'swisstopo',
  label: 'swissBATHY3D',
  resolutionM: 2,
  license: 'conditions swisstopo pour les géodonnées gratuites (OGD) — usage commercial explicitement autorisé',
  // ⚠️ « A reference to the source is mandatory » — ce n'est pas une politesse.
  credit: 'Federal Office of Topography swisstopo',
  url: 'https://www.swisstopo.admin.ch/en/height-model-swissbathy3d',
  notForNavigation: true,
},
```

**Vérifié :** sans cette entrée, `creditsForBounds` rend aujourd'hui
`Source bathymétrique « swisstopo » — attribution à compléter`. Le mécanisme
rend donc le trou visible au lieu de le taire — c'est bien conçu — mais publier
dans cet état est **une faute de licence**, pas un défaut d'affichage.

### La procédure de cuisson, de bout en bout

```bash
# 1. la source — 390 Mo, 693 dalles ASCII de 1 km², EPSG:2056 / LN02
curl -L -o data/swissbathy3d/leman.zip \
  https://data.geo.admin.ch/ch.swisstopo.swissbathy3d/swissbathy3d_lacleman/swissbathy3d_lacleman_2056_5728.esriasciigrid.zip
#    (l'inventaire des lacs disponibles :
#     https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissbathy3d/items?bbox=...)

# 2. pivot WGS84 — reprojection CHLV95→WGS84, 87,8 M cellules, 167,5 Mo, ~3 min
node scripts/pivot-swissbathy3d.mjs --src data/swissbathy3d/asc \
     --out data/pivot-leman --nappe 372.05 --pas 5

# 3. tuiles terrarium — 404 tuiles, 3,22 Mo, ~4 min
node scripts/build-lake-tiles.mjs --src data/pivot-leman \
     --out public/data/bathy --nappe 372.05 --zmin 9 --zmax 14

# 4. contrôle contre la référence CIPEL
node scripts/controle-lac-b2.mjs --tuiles public/data/bathy
```

### LE COÛT EN OCTETS, mesuré

| z | m/px à 46,4° | tuiles | poids | Ko/tuile |
|---|---|---|---|---|
| 9 | 210 | 2 | 13 Ko | 6,4 |
| 10 | 105 | 4 | 35 Ko | 8,8 |
| 11 | 53 | 12 | 97 Ko | 8,1 |
| 12 | 26 | 29 | 276 Ko | 9,5 |
| 13 | 13 | 85 | 752 Ko | 8,8 |
| 14 | 6,6 | 272 | 2 129 Ko | 7,8 |
| | | **404** | **3,22 Mo** | |

727 tuiles de l'emprise ont été **écartées** (elles ne touchent pas le lac).

**Ce que ça rapporte :** GEBCO ne dit **rien** du Léman — il est marin. On ne
passe donc pas de 464 m à 6,6 m de résolution, on passe de **rien** à 6,6 m,
sur les 580 km² du lac. Pour 3,22 Mo sur un `dist/` qui en fait 968.

**Quantification : éteinte, et c'est mesuré.** Le barème marin (1/4/8 m) fait
gagner 35 % de poids sur 19 657 tuiles d'océan. Sur un lac, il coûte la vérité
pour presque rien :

```
quantifié   404 tuiles  2,09 Mo   fond lu 312,05 m   (réf 309,70 → +2,35 m)
au mètre    404 tuiles  3,22 Mo   fond lu 310,05 m   (réf 309,70 → +0,35 m)
```

Le pas de 4 m de la tranche −60…−400 m tombe pile sur la profondeur du Léman.
1,2 Mo pour 2 m de justesse, sur une demande « le plus juste possible » : payé.

---

### ⚠️ CE QUI CASSERAIT SI ON L'AJOUTAIT NAÏVEMENT

**Quatre choses, toutes vérifiées à l'exécution** (`scripts/controle-lac-b2.mjs`).

**1. Rien ne se passerait du tout.** `src/dem.js:495` :

```js
const fused = seaData ? fuseBathymetry(data, seaData) : data
```

Pas d'options ⇒ `seaLevel = 0` ⇒ le Léman à +372 m est de la TERRE ⇒
`out[i] = l`, la source n'est même pas lue. Contrôle ② : sortie **372,05 m**
alors que la source dit 62,05 m. On aurait déployé 3,22 Mo pour zéro pixel
changé, sans aucune erreur en console.

**2. `normalizeIndex` JETTE `waterLevelM`.** Vérifié :

```
zone leman après normalizeIndex : {"id":"leman","source":"swisstopo","zmax":14,
                                   "west":6.1267,"south":46.2035,...}
waterLevelM conservé ? -> NON — PERDU
```

La liste blanche de `normalizeIndex` (src/bathy-sources.js:160-171) ne recopie
que `id / source / zmax / west / south / east / north`. Ajouter le champ à
`index.json` **sans** l'ajouter là est le piège silencieux parfait : le fichier
est correct, le code est correct, et le nombre n'arrive jamais.

**3. Le tuileur marin ne peut PAS cuire un lac d'altitude.**
`scripts/build-bathy-tiles.mjs:352` :

```js
const raw = m == null || m >= 0 ? 0 : m
```

« on n'écrit que la mer », la terre est aplatie à 0 — juste en mer, faux pour un
lac dont **tous** les pixels sont positifs (62 à 372 m). Chacun sort à 0,
`anySea` reste faux, la tuile est jetée. D'où `scripts/build-lake-tiles.mjs`.

**4. LE PLUS GRAVE — sans la SENTINELLE, on détruit la terre.**
Si les tuiles de lac écrivent `0` hors du lac (ce que fait le tuileur marin) et
qu'on relève `seaLevel` à 372,55 m, alors **toute terre située sous la cote du
lac est lue comme un fond à 0 m et se fait creuser**. La géographie l'impose : le
Rhône sort du Léman à Genève à 371 m et perd 100 m en quelques kilomètres.
Contrôle ④, sur une dalle contenant l'exutoire :

```
terre / versant : pire écart 347.67 m
```

**347 mètres de vallée effacés.** C'est exactement « refondre le relief des
tuiles existantes » — ce qu'Adrien a interdit.

**Le correctif tient en une règle de cuisson :** hors du lac, écrire
`nappe + 1 m`, jamais 0. `fuseBathymetry` lit tout échantillon marin ≥ niveau
comme une **absence** et rend le terrarium tel quel. Avec elle, contrôle ③ :

```
fond au milieu du lac : 62.05 m   visé 62.05 m   (écart 0.000 m)
terre / versant : pire écart 0.0000 m
```

**Zéro pixel de terre déplacé, sur toute la dalle, vallée en aval comprise.**

### Ce que B3 doit changer, exactement — trois endroits, aucun refondu

1. `src/bathy-sources.js` · `normalizeIndex` : recopier `waterLevelM` (nombre
   fini, sinon absent) dans l'objet zone.
2. `src/bathy-sources.js` · `SOURCES` : ajouter l'entrée `swisstopo` ci-dessus.
3. `src/dem.js` : là où la zone est déjà résolue pour le plafond de zoom,
   passer `{ seaLevel: waterLevelM + 0.5 }` à `fuseBathymetry` quand la zone en
   porte un ; sinon ne rien passer (comportement d'aujourd'hui, au bit près).

⚠️ **Le `+ 0,5`, et pas `+ 0`.** `fuseBathymetry` teste `l >= level` : à
`seaLevel = 372.05` exactement, la nappe du terrarium vaut `level` et retombe
dans la branche TERRE. Mesuré : sortie 372,05 m, lac toujours perdu.

⚠️ **Un seul `seaLevel` par emprise.** Si une dalle contient deux lacs de cotes
différentes, un seul niveau s'applique. La sentinelle empêche que ce soit
destructeur (l'autre lac est simplement ignoré), mais c'est une limite à écrire,
pas à découvrir.

---

## ③ L'ÉTAT DE LA CASCADE OCÉAN

**D'abord un fait qui prime sur le reste : `public/data/bathy/` N'EXISTE PAS dans
cet arbre.** Pas d'`index.json`, pas une tuile. La cascade est correctement
écrite, testée, documentée — et **entièrement inerte faute de données cuites**.
`normalizeIndex` étant optimiste par principe, tout retombe sur le socle GEBCO
z8. Aucune des quatre sources déclarées ne sert aujourd'hui. Cela vaut pour le
bloc plat comme pour la sphère, et c'est indépendant du défaut de câblage de
`globe.js` signalé dans le socle.

| source | déclarée | répond | version | verdict |
|---|---|---|---|---|
| **GEBCO_2026** | z8, doi `…4f68d5c7…` | **oui** | **à jour** — publié le 23/04/2026, 8ᵉ grille Seabed 2030, succède à GEBCO_2025 | ✅ URL, DOI et résolution 15″ exacts |
| **EMODnet DTM 2024** | z10, 115 m, CC BY 4.0 | **oui** | **encore la dernière** ; une **DTM 2026 est en préparation** | ⚠️ le WCS/WMS vivant est `https://ows.emodnet-bathymetry.eu/wms` (couche `emodnet:mean`) ; la route `geoviewer` rend **404** |
| **NOAA BlueTopo** | z12, CC0 | **oui** | bucket `s3://noaa-ocs-nationalbathymetry-pds` **listable sans compte**, vérifié | ⚠️ l'index gpkg est **horodaté** (`…_20260901_181619.gpkg`) : tout chemin figé pourrira, il faut balayer le préfixe |
| **Copernicus 016_001** | z?, 100 m | **oui** | produit **statique**, pas de dérive de version | ⚠️ **compte obligatoire** pour télécharger (gratuit, commercial autorisé) — inconciliable avec une cuisson automatisée sans secret |

**Deux corrections de libellé à faire dans `SOURCES`** (aucune urgence, mais ce
sont des obligations de licence recopiées mot pour mot) :
- GEBCO exige la citation *« GEBCO Bathymetric Compilation Group 2026 (2026). The
  GEBCO_2026 Grid — a continuous terrain model for oceans and land at 15
  arc-second intervals. NERC EDS British Oceanographic Data Centre NOC. »* Le
  dépôt écrit « GEBCO Compilation Group », qui n'est pas la formule imposée.
- EMODnet : la chaîne du dépôt est tronquée. Le portail impose l'URL dans le
  texte : *« …created by EMODnet (https://emodnet.ec.europa.eu/en/), and is
  owned by the EU and licensed under the Creative Commons Attribution 4.0
  International (CC BY 4.0) license. »*

### Ce qui manque et vaut la peine

- **Allen Coral Atlas — 10 m, Sentinel-2, CC BY 4.0, commercial autorisé.**
  30°N–30°S, récifs et lagons : exactement le trou que les quatre autres
  laissent. ⚠️ Deux réserves : le projet n'a plus été réédité depuis 2022, et
  **certaines emprises ont des restrictions de téléchargement** héritées de
  l'imagerie Planet Dove, qui n'est pas ouverte. À vérifier zone par zone avant
  d'embarquer quoi que ce soit.
- **AusSeabed / AusBathyTopo 250 m — grille 2026, CC BY 4.0.** Prendre la **2026**
  (1 542 jeux sources), pas la 2023/2024 bien plus liée. Séries 30 m et 100 m
  régionales en prime. Vrai gain sur GEBCO dans les eaux australiennes.
- **Seabed 2030 / GEBCO Cook Book : à écarter.** Les grilles des quatre centres
  régionaux **sont déjà fondues dans GEBCO_2026** et ne sont pas publiées
  séparément ; hors régions polaires ce sont des grilles creuses inutilisables
  seules. Le Cook Book est de la méthodologie, pas de la donnée.
- **Sentinel-2 cloudless** (noté « en tête » dans la mémoire du dépôt) : c'est
  de l'**imagerie**, pas de la bathymétrie. La note est périmée sur un autre
  point aussi — elle dit « rien de branché » pour GEBCO alors que GEBCO **est**
  déclaré, catalogué et crédité. Ce qui est vrai, c'est qu'aucune tuile n'est
  cuite.

---

## ④ LE PROTOTYPE DE CUISSON — ZONE D'ESSAI : LE LÉMAN

Livrables, tous dans `scripts/` :

- **`pivot-swissbathy3d.mjs`** — 693 dalles ESRI ASCII CHLV95/LN02 → un pivot
  WGS84 `grid.bin` + `meta.json` au format qu'attend déjà
  `build-bathy-tiles.mjs`. Reprojection par les formules approchées swisstopo
  (~1 m, largement sous les 2 m de la donnée) : ni GDAL ni pyproj sur cette
  machine, et aucune dépendance ajoutée.
- **`build-lake-tiles.mjs`** — le tuileur de lac. Même grille XYZ, même encodage
  terrarium, même encodeur PNG que le tuileur marin ; ce qui change est la
  sentinelle et l'absence d'aplatissement des positifs.
- **`controle-lac-b2.mjs`** — le banc : tuile relue contre la référence, cascade
  actuelle, correctif, et démonstration du dégât sans sentinelle.
- **`bathy-zones-lacs.b2.json`** — l'entrée de zone prête.

### Résultat, comparé à la référence

Référence : **Léman, profondeur maximale 309,7 m**, nappe **372,05 m LN02**
(CIPEL). Point le plus profond documenté : Grand Lac, entre Évian et Lausanne.

**Le pivot trouve son point le plus bas à 46,44064 °N / 6,59996 °E** — la
position documentée, retrouvée sans qu'on la lui donne. C'est ce qui valide
d'un coup la reprojection, le référentiel vertical et l'échantillonnage.

| z | tuile | fond lu | profondeur | écart / 309,70 m |
|---|---|---|---|---|
| 10 | 530/362 | 62,00 m | 310,05 m | **+0,35 m** |
| 11 | 1061/724 | 62,00 m | 310,05 m | **+0,35 m** |
| 12 | 2123/1449 | 62,00 m | 310,05 m | **+0,35 m** |
| 13 | 4246/2899 | 62,00 m | 310,05 m | **+0,35 m** |
| 14 | 8492/5799 | 62,00 m | 310,05 m | **+0,35 m** |

Balayage des **272 tuiles z14, 17 825 792 pixels** : aucune valeur aberrante,
fond le plus bas 310,05 m, 25,6 % de sentinelle (hors lac), et **aucun pixel de
lac ne passe sous le zéro marin** — ce qui doit être vrai d'un lac de montagne
et ne le serait pas si un signe s'était inversé quelque part.

⚠️ **Ce que la carte montrera et qu'il faut assumer : swissBATHY3D s'arrête à la
frontière.** La rive française du Léman (Évian, Thonon) n'y est pas et retombe
sur GEBCO, c'est-à-dire sur rien. La bbox proposée couvre le lac entier, donc la
partie française sera simplement muette, pas fausse — mais la ligne de partage
sera visible à l'œil sur le fond du Petit Lac.

---

## ⑤ ÉTAT DES TESTS

`npm run audit:tests` : **252 listés · 252 sur disque · aucun écart.**

`npm test` : **4 748 tests · 4 741 passés · 5 échecs.**

⚠️ **Les 5 échecs ne sont pas du code, et le compte de départ non plus.**
`C:\Dev\wt-bat2` **n'avait aucun `node_modules`** — contrairement à ce que
disait la consigne. Dans cet état `npm test` rendait **2 600 tests · 212
échecs** : 212 fichiers mouraient sur `Cannot find package 'three'`, sans que
ni le code ni un test soient en cause. J'ai lié `node_modules` par jonction sur
`C:\Dev\monolith-terrain\node_modules`, ce qui rétablit **4 748**. Les 5 échecs
restants sont tous dans `test/pdf-affiche.test.js` et tous
`Cannot find package '@cantoo/pdf-lib'` — une dépendance absente du clone
emprunté, sans aucun rapport avec la bathymétrie.

⛔ **J'ai RETIRÉ la jonction en partant, et c'est volontaire :** un `npm install`
ou un `npm ci` lancé dans `wt-bat2` aurait écrit à travers elle dans le
`node_modules` du clone principal `C:\Dev\monolith-terrain`. Laisser ce piège
en place pour épargner une minute à B3 n'en valait pas le risque. **Avant de
juger un test dans cet arbre, faire `npm ci`** — sinon on mesure l'absence de
`three`, pas le code.

**Aucun de mes fichiers ne touche `src/`.** Le compte de tests est donc le même
avant et après moi ; ce qui manque, c'est un `npm ci` dans cet arbre.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

**1. « Le tuileur marin existant sait déjà cuire un lac, il suffit de lui donner
un pivot. »** Faux, et je l'avais écrit avant de lire la boucle d'écriture.
`build-bathy-tiles.mjs:352` fait `raw = m == null || m >= 0 ? 0 : m` : tout
pixel positif est aplati à 0 et `anySea` reste faux. Un lac d'altitude est
positif de bout en bout — le tuileur le jette intégralement. Il a fallu un
second tuileur.

**2. « `fuseBathymetry` accepte déjà `opts.seaLevel`, donc passer la cote du lac
suffit. »** Faux deux fois. D'abord `l >= level` est **inclusif** : à
`seaLevel = 372.05` pile, la nappe du terrarium est classée TERRE et le lac
reste perdu. Ensuite, même au-dessus, le fondu `t = smooth((level − l)/blend)`
avec `blend = 25 m` donne `t ≈ 0,02` : la source fine est pondérée à ~2 % et
la sortie vaut **371,63 m** au lieu de 62. Ce qui débloque réellement, c'est que
`detectFillLevels` reconnaisse la nappe comme un **aplat** — alors `base` bascule
sur `level` et le fondu sature.

**3. « Ma première sonde le prouve. »** Non — elle mentait, et j'ai failli le
publier. Ma sonde travaillait sur des dalles **16×16**, or `detectFillLevels`
échantillonne un pixel sur 17 (`FILL_STEP`) et exige **64 sondes**
(`FILL_MIN_SONDES`) : sur 256 pixels elle n'en voyait que 15 et **ne se
déclenchait jamais**. J'en concluais « le correctif ne marche pas », ce qui était
un artefact de ma taille d'essai. Rejouée en **256×256**, la vraie taille d'une
tuile, elle rend exactement la profondeur visée. J'ai supprimé cette sonde plutôt
que de laisser traîner un script qui affiche une conclusion fausse.

**4. « Mon contrôle ④ montre que la sentinelle est facultative. »** Il montrait
surtout que ma scène d'essai était mal faite. Elle n'avait que du versant à
380–1 200 m, **tout au-dessus de la nappe**, donc tout partait dans la branche
TERRE et rien ne cassait — avec ou sans sentinelle. C'était un **faux négatif**,
et j'allais écrire « rien ne casse » sur le cas qui casse. En ajoutant l'aval du
Rhône (370 → 280 m, la géographie réelle de l'exutoire de Genève), l'écart est
passé de 0,00 m à **347,67 m de terre détruite**. La sentinelle n'est pas une
précaution, c'est la condition.

**5. « La quantification est gratuite, elle l'est en mer. »** Elle coûtait
**2,35 m** sur le Léman, parce que le pas de 4 m de la tranche −60…−400 m tombe
pile sur sa profondeur. En mer ce barème fait gagner 35 % sur 19 657 tuiles ; sur
un lac il fait gagner 1,2 Mo sur 3,2. J'ai inversé le défaut pour les lacs, avec
les deux mesures écrites à côté.

**6. « GEBCO est branché, la note mémoire est périmée. »** À moitié seulement.
GEBCO **est** bien déclaré, catalogué et crédité — la note « rien de branché »
est fausse sur ce point. Mais `public/data/bathy/` **n'existe pas dans cet
arbre** : aucune tuile, aucun `index.json`. Dans les faits, la note périmée
décrit mieux la réalité que le catalogue. La cascade océan entière est du code
sans données.
