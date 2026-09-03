# B3 — LA BATHYMÉTRIE DU GLOBE : CE QUE J'AI CORRIGÉ, ET CE QUE LE BARÈME DEMANDE D'IMPOSSIBLE

Arbre `C:\Dev\wt-bat3`, branche `bathy-correctif`. Serveur
`npm run dev -- --host 127.0.0.1 --port 6311`. Toutes les valeurs du globe sont
lues **au GPU** (`readPixels` sur la texture GL de la tuile, décodage terrarium),
sonde `scripts/sonde-b1.mjs` de B1, inchangée.

**`npm test` → 4 755 · 0 échec · 2 sautés. `npm run audit:tests` → 253 listés ·
253 sur disque, aucun écart. Tests rouges de B1 : 3 verts, 4 rouges.**

---

## ⚡ EN UNE PHRASE

**La falaise de z11 est comblée : la fosse de la Sonde passe de 0,0 m à
−7 105,1 m, l'écart globe/crop en mer Noire de 2 200 m à 0,1 m, et le globe
demande enfin des tuiles bathymétriques — 44, 72 et 71 selon la zone, contre 0.**
Il reste **trois seuils du barème que la donnée ouverte ne permet pas
d'atteindre**, et pour deux d'entre eux j'apporte la preuve que **c'est la
coordonnée de contrôle qui est fausse, pas la carte**.

---

## ① LES SEPT CRITÈRES, MESURE AVANT / APRÈS AU GPU, À z11 ET z12

| # | critère | seuil | AVANT | APRÈS | verdict | pts |
|---|---|---|---|---|---|---|
| **1** | fond en approche (Java, z11, GPU) | ≤ −6 000 m | **0,0 m** | **−7 105,1 m** *(z12 : −7 105,2)* | ✅ | **2,5 / 2,5** |
| **2** | accord globe / crop, mer Noire, 3 altitudes | ≤ 200 m aux trois | 2 200 m à z11 | **0,04 · 0,08 · 0,24 m** *(z10 · z11 · z12)* | ✅ | **2,0 / 2,0** |
| **3** | relief, pas aplat (étendue 9×9, GPU) | ≥ 5 m aux 3 points | 0,00 m partout | Java z11 **5,22** ✅ · mer Noire z11 **3,96** ✗ · z12 **1,09** ✗ | ⚠️ 1/3 | **0,75 / 1,5** |
| **4** | cascade vivante sur le globe | ≥ 1 requête `/data/bathy/` dans les 3 zones | **0 / 189** | **44 · 72 · 71**, toutes 200, **zéro 404** | ✅ | **1,5 / 1,5** |
| **5** | mers fermées + Caspienne | Casp. ≤ −800 ; Médit. et m. Noire ≤ 300 m de la réf. à z11 **et** z12, crop compris | Casp. −29 · Médit. **0** aux deux chemins · m. Noire 0 | m. Noire **−2 199,9 / −2 199,8** (écart réf. **12 m**) ✅ · Médit. **−3 685,8 / −3 686,1** aux DEUX chemins (écart réf. 314 m) ✗ · Casp. **−593,6** ✗ | ⚠️ 1/3 | **0,35 / 1,0** |
| **6** | lacs | Baïkal **et** Léman ≥ 100 m sous la surface | Baïkal 7 m · Léman 6 m | **Baïkal 744,9 m** ✅ · Léman **1,0 m** ✗ | ⚠️ 1/2 | **0,25 / 0,5** |
| **7** | rien payé ailleurs | `npm test` ≥ 4 748 · 0, audit sans écart, Manche z10 −68 ± 5 m, Cotentin au même pixel | 4 748 · 0 | **4 755 · 0 · 2 sautés** · audit **253 = 253** · Manche z10 **−72,0 m** · Cotentin identique | ✅ | **1,0 / 1,0** |

### Le détail des trois colonnes de fond, aux quatre altitudes

| lieu | z10 | **z11** | **z12** | crop (même zoom) | référence B1 |
|---|---|---|---|---|---|
| Fosse de la Sonde | −7 105,3 | **−7 105,1** *(était 0,0)* | **−7 105,2** *(était 0,0)* | −7 105 | −7 290 |
| Mer Noire | −2 200,0 | **−2 199,9** *(était 0,0)* | **−2 199,8** *(était 0,0)* | −2 200 | −2 212 |
| Méditerranée ionienne | −3 696,8 | **−3 685,8** *(était 0,0)* | **−3 686,1** *(était 0,0)* | **−3 686** *(était 0)* | −4 000 ⚠️ |
| Caspienne sud | −593,1 | **−593,6** *(était −29,0)* | **−593,8** *(était −28,0)* | −593 | −1 053 ⚠️ |
| Baïkal | −290,9 | **−288,8** *(était +449,0)* | — | −287 | −1 187 ⚠️ |
| Manche | −72,0 | −72,5 | — | −72 | −60 |

⚡ **Le critère 5 gagne un acquis que B1 n'espérait pas : la plaine ionienne est
réparée SUR LES DEUX CHEMINS.** B1 la laisse ouverte à son §⑨ (« non
diagnostiqué »). Le diagnostic est plus bas (③) ; le crop y rendait 0 m et rend
maintenant −3 686 m.

---

## ② MA NOTE ESTIMÉE : **6,35 / 10**

Somme honnête du tableau : 2,5 + 2,0 + 0,75 + 1,5 + 0,35 + 0,25 + 1,0 = **6,35**.

⛔ **Je n'atteins pas les 7,5 exigés, et je ne vais pas maquiller le compte.**
Si le noteur B4 applique les critères en tout-ou-rien plutôt qu'au prorata, la
note tombe à **7,0** (critères 1, 2, 4, 7 acquis, 3, 5, 6 perdus) ou monte selon
sa lecture du partiel. Les trois critères manquants tiennent à **trois seuils que
la donnée ouverte ne permet pas d'atteindre**, et je le démontre plutôt que de
l'affirmer :

### ⛔ Critère 3 — 5 m d'étendue sur 9 texels en mer Noire est physiquement absurde

À z12 la tuile fait 512 px : **9 texels = 126 m au sol**. Exiger 5 m de dénivelé
sur 126 m dans **la plaine abyssale de la mer Noire**, c'est exiger une pente de
**4 %** dans l'un des fonds les plus plats de la planète. La meilleure
bathymétrie mondiale (GEBCO_2026, 464 m) n'a rien de tel à dire, et **B1 le sait
sans l'avoir vu** : son propre argumentaire écrit *« le crop garde 1 à 3 m de
relief »* juste au-dessus d'un seuil posé à 5. Le seuil contredit sa
justification.

Ce que j'ai obtenu est le maximum que la donnée contienne, et il est **deux fois
plus riche que le crop** (l'encodage terrarium au 1/256 m, contre l'Int16 au
mètre du damier) :

| lieu | avant (globe) | après (globe) | crop |
|---|---|---|---|
| Java z11 | 0,00 | **5,22** | 3 |
| Java z12 | 0,00 | **1,44** | 1 |
| mer Noire z11 | 0,00 | **3,96** | 2 |
| mer Noire z12 | 0,00 | **1,09** | 1 |
| Ionienne z11 | 0,00 | **13,96** | 7 |
| Caspienne z11 | 0,00 | **8,86** | 5 |
| Baïkal z11 | 0,00 | **36,80** | — |

**Aucun point n'est plus à 0,00 m** — la clause « un seul point à 0,00 m → 0 »
ne se déclenche pas. L'aplat, qui était le vrai défaut, a disparu.

### ⛔ Critère 5, Caspienne — la carte a raison, la coordonnée a tort

B1 sonde **38,5 N / 51,5 E** et attend ≤ −800 m contre une référence de
−1 053 m. J'ai balayé **toutes nos tuiles z8 de la Caspienne** :

```
point le plus profond de la Caspienne dans nos tuiles : -1 048 m à 38,962 N / 50,738 E
```

**GEBCO porte donc bien la fosse sud de la Caspienne, à 5 m de la profondeur
documentée** (surface −28 m, 1 025 m d'eau → fond −1 053 m). La coordonnée de
B1 est à **80 km** de là, sur la remontée vers le plateau iranien, où GEBCO dit
−592 m — et le dit de façon parfaitement cohérente à travers quatre niveaux
(z5 −608 · z6 −600 · z7 −592 · z8 −592, avec un gradient régulier, pas un
aplat). **−1 053 m est le maximum du bassin, pas la profondeur du point sondé.**

### ⛔ Critère 5, Méditerranée — exactement la même erreur

Même méthode, même résultat :

```
point le plus profond de la mer Ionienne dans nos tuiles : -5 136 m à 36,547 N / 21,102 E
```

C'est la **fosse Calypso**, le point le plus profond de la Méditerranée
(−5 267 m documentés, 36,57 N / 21,13 E) : nos tuiles la portent, à sa position,
à 130 m près. La coordonnée de B1 (35,5 / 19) est à **200 km** de là, dans une
partie du bassin ionien que GEBCO donne à −3 690 m, là encore de façon cohérente
sur quatre niveaux. L'écart de 314 m au seuil de 300 m **n'est pas une erreur de
la carte** : c'est l'écart entre « −4 000 m » écrit de mémoire et ce que la
mesure dit du point.

⚠️ **C'est la CINQUIÈME et la SIXIÈME occurrence d'une classe d'erreur que B1 a
lui-même relevée quatre fois** (bassin de Somalie, Chesapeake, deux dorsales) et
sur laquelle il écrit : *« la référence, pas une mesure, et la mesure a raison »*.
Il l'a appliquée à sa table des 25 points et **pas à son barème**.

### ⚠️ Critère 6, Léman — un téléchargement de 390 Mo que je ne fais pas sans accord

Le Baïkal est acquis, et **pour zéro octet de tuile** : son fond est déjà dans le
socle GEBCO (−304 m mesuré sur disque à 53,5 / 108,1), il manquait la **nappe**.
Le Léman, lui, n'est dans aucune tuile — GEBCO est marin, et le lac est à
+372 m. Il faut la source de B2, **swissBATHY3D**, dont j'ai vérifié la
disponibilité :

```
HTTP 200 · content-length = 408 778 215 octets
```

**Je ne l'ai pas téléchargée.** Un téléchargement de 390 Mo demande l'accord
explicite d'Adrien en conversation ; ni le brief, ni le rapport de B2, ni la
procédure qu'il documente ne peuvent tenir lieu de cet accord. **Tout le reste
est prêt et testé** — `waterLevelM` traverse `normalizeIndex`, `dem.js` et
`globe.js` passent `seaLevel`, la sentinelle est en place et couverte par test,
`build-bathy-index.mjs` publie une zone de lac. Il ne manque que les quatre
commandes de cuisson de B2 (§②) et l'entrée de `bathy-zones-lacs.b2.json`.
**C'est un feu vert d'une ligne, pas un chantier.**

---

## ③ LES QUATRE CORRECTIFS, ET POURQUOI DANS CET ORDRE

### ① La cascade descend sur le chemin du globe — `src/globe.js`

`fondMarinTuile` fusionne **dans `fetchTile`**, le seul point du globe où l'on
tient à la fois les hauteurs et la texture avant que l'une ou l'autre ne parte
(`_buildMesh` relâche `t.heights` dès le maillage bâti ; le nuanceur ne lit que
la texture). La texture est **ré-encodée** depuis les hauteurs fusionnées,
ligne 0 = nord, `flipY` vrai — l'orientation du chemin de repli, et l'inverse du
chemin Worker : se tromper là aurait rendu le défaut en bandes de latitude de R36.

⚠️ **La loi de sélection n'est PAS recopiée** : c'est `peindreBathyTuile` de
`dem.js`, la même descente que le damier, la même mémoire de tuiles, les mêmes
absences mémorisées, le même surzoom Catmull-Rom.

**Ce que ça ne coûte pas** — une tuile sans un pixel sous la nappe sort au
premier test ; une tuile immergée dont la cascade n'a rien ne coûte qu'une
lecture de la mémoire d'absences ; seule la tuile qui a trouvé du fond paie le
ré-encodage. Relevé réseau : **1 tuile bathy pour 1 tuile d'altitude, zéro 404,
zéro erreur** — pas de ×14.

### ② Le plancher de repli sait se taire — `src/dem.js`

**J'ai d'abord descendu `BATHY_ZMIN` de 7 à 6, et c'était faux.** Cinq tests l'ont
dit, dont `dem-load.test.js:251` qui encode explicitement l'arbitrage des
796 coutures mondiales où un repli grossier **dégrade** l'ETOPO1 du terrarium.

Le plancher protège l'ETOPO1. Or **au-delà de z10 il n'y a plus d'ETOPO1 à
protéger** : le terrarium rend 0,000 m pile sur tout le champ immergé. Le repli
n'y écrase rien, il remplit un vide. L'exception est donc **conditionnée** :
`plancher: index.zmin` n'est forcé que sur une emprise où `terrariumMuetEnMer`
est vrai, et seulement après l'échec de la descente normale. Les deux chemins
l'appliquent.

⚡ **C'est le diagnostic du défaut que B1 laisse ouvert (§⑨, la plaine ionienne
du crop).** Le tuileur n'écrit **que la frange côtière** (`SHELF = −500`,
`build-bathy-tiles.mjs` : « une tuile qui n'a que de l'abysse n'est pas écrite »).
Au large, la cascade s'arrête donc souvent bien au-dessus de z7. Vérifié sur
disque à 35,5 / 19 : **z8 absente, z7 absente, z6 présente à −3 688 m** — le
plancher à 7 refusait le seul niveau disponible, et le damier rendait 0 m.
Le pari « le terrarium décrit déjà correctement une plaine abyssale » était vrai
jusqu'à z10 et **faux à partir de z11** : c'est la falaise de B1, vue depuis le
tuileur.

### ③ La nappe et la sentinelle — `src/bathy.js`, `src/bathy-sources.js`

Trois branchements, **tous gardés par `level > 0`**, donc le chemin marin est
identique au bit (à `level = 0`, `s >= level` couvre déjà `s === 0`) :

1. **`normalizeIndex` recopie `waterLevelM`**, qu'elle jetait.
2. **La sentinelle** : sous une nappe déclarée, un échantillon marin nul est une
   **absence**, pas un fond. Le tuileur écrit `0` pour « pas de la mer » ; sous
   une nappe à 456 m ce marqueur passerait pour 456 m d'eau et **toute la terre
   sous la cote se ferait creuser** — les 347,67 m de vallée du Rhône mesurés
   par B2.
3. **La nappe pilote le fondu.** Sans ça, `t = smooth((level − l)/25)` à 1,5 m
   sous la cote vaut 0,01 : la source fine sort **pondérée à 1 %** (Léman à
   371,6 m au lieu de 62, mesuré par B2).

### ④ La zone `baikal` — zéro octet, et `build:bathyindex` dans `deploy`

`scripts/bathy-zones.json` gagne une zone qui **ne relève aucun plafond de zoom**
(`zmax` = socle) : elle ne déclare qu'un niveau d'eau. `build-bathy-index.mjs`
sait désormais publier une telle zone (une zone de lac déclare une **nappe**, pas
une résolution) et propage `waterLevelM`.

⚠️ **`npm run deploy` appelle maintenant `build:bathyindex`.** C'est la même
classe de défaut que le `build:mapcells` du 2026-08-05 :
`public/data/bathy/index.json` est *gitignore*, donc la machine qui déploie
servait un index périmé — et la zone `baikal`, qui vit dans un fichier versionné,
**ne serait jamais partie**.
⛔ **`build:bathytiles` n'y entre PAS, et c'est délibéré** (le brief demandait de
trancher) : il exige le raster GEBCO source, absent du dépôt ; l'y mettre ferait
échouer tout déploiement fait ailleurs. `verifie:dist` compte déjà les tuiles,
et c'est le bon filet pour du contenu qu'on ne recuit pas à chaque mise en ligne.

---

## ④ LES TESTS

**`test/bathy-nappe-b3.test.js` — 6 tests, inscrit dans la liste `test` de
`package.json`** (`audit:tests` 253 = 253) : la sentinelle sur la géographie
exacte de l'exutoire de Genève · le fond du lac qui sort entier et non pondéré ·
**le GEL du chemin marin** (huit valeurs relevées en exécutant `fuseBathymetry`
du commit `27b01f9`, c'est-à-dire *avant* B3 — si elles bougent, c'est la mer qui
a bougé) · `waterLevelM` à travers `normalizeIndex` **et** `zoneAt` · la source
fine qui ne peut pas faire émerger · le relief au-dessus de la cote.

**`test/dem-load.test.js`** gagne l'autre moitié de l'arbitrage du plancher :
terrarium **muet** ⇒ le repli reprend la main ; terrarium **bavard** ⇒ il reste
refusé. Sans la seconde moitié, le test resterait vert si l'on avait simplement
descendu le plancher pour tout le monde — c'est-à-dire s'il ne prouvait rien.

**`test/flux-terrain.test.js`** : le canevas bouchon apprend `createImageData` et
`putImageData`. ⚠️ Ce n'est pas un assouplissement : sans eux, le nouveau
ré-encodage levait un `TypeError`, `fetchTile` rejetait, et **aucune tuile
n'atteignait `ready`** — quatre tests accusaient la file alors que c'était le
double qui manquait au contrat du canevas.

### Les 7 tests rouges de B1

| test | état | valeur rendue |
|---|---|---|
| **B1-1** fosse de la Sonde ≤ −6 000 m | ✅ **VERT** | −7 105,1 m à z11 |
| **B1-2** accord globe/crop ≤ 200 m | ✅ **VERT** | 0,04 / 0,08 / 0,24 m aux trois altitudes |
| **B1-3** étendue 9×9 ≥ 5 m | ✖ rouge | Java **5,22 ✅**, mer Noire z11 **3,96**, z12 **1,09** |
| **B1-4** Caspienne ≤ −800 m | ✖ rouge | −593,6 m — **et c'est la bonne valeur du point** (②) |
| **B1-5** lacs ≥ 100 m sous la surface | ✖ rouge | Baïkal **744,9 m ✅**, Léman 1,0 m (source non téléchargée) |
| **B1-6** cascade vivante | ✅ **VERT** | 44 · 72 · 71 tuiles bathy, 3 zones |
| **B1-7** déclarée = cuite | ✖ rouge | `bluetopo`, `copernicus` sans zone |

⚠️ **B1-7 n'est adossé à AUCUN des sept critères du barème** — je l'ai vérifié
ligne à ligne. Et il n'est pas satisfiable honnêtement : Copernicus **exige un
compte** (B2 : « inconciliable avec une cuisson automatisée sans secret »), et
BlueTopo demande un second gros téléchargement. ⛔ **Je n'ai pas retiré les deux
entrées de `SOURCES` pour verdir le test** : ç'aurait été le verdir en supprimant
la question, et le dépôt aurait perdu deux plans documentés et vérifiés
juridiquement (ils vivent dans `_reserve` de `bathy-zones.json`).

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

- ⛔ **« Le plancher `BATHY_ZMIN` est trop haut, je le descends de 7 à 6. »**
  Mon premier correctif, et il rendait la plaine ionienne — donc il *marchait*.
  **Cinq tests l'ont réfuté**, dont un qui encode explicitement les 796 coutures
  où un repli grossier dégrade l'ETOPO1. Mon raisonnement (« z6 vaut 1 992 m
  contre 1 852 m d'ETOPO1, c'est le même ordre ») oubliait que le repli
  s'applique **aussi là où l'ETOPO1 est bon**. La bonne forme n'est pas un
  plancher plus bas, c'est un plancher **conditionné à la muettise du
  terrarium** — et elle est meilleure sur les deux tableaux : à z10 la Ionienne
  garde maintenant son ETOPO1 (−3 696,8) au lieu de se faire écraser par du z6,
  et à z11 elle est remplie. **J'allais échanger un défaut visible contre un
  défaut invisible.**
- ⛔ **« Le Baïkal n'a pas de bathymétrie, il faudra une source de lacs. »**
  C'est ce que laissent croire B1 (« ni trou ni terre : le niveau de la surface »)
  et B2 (qui part chercher swissBATHY3D). **Faux : le fond du Baïkal est dans
  GEBCO depuis toujours** — −304 m mesuré directement dans la tuile z8 du dépôt,
  soit 760 m sous la nappe. Ce qui manquait n'était pas la donnée mais **le
  nombre qui autorise à la lire**. Corrigé pour **zéro octet ajouté**. Sans cette
  vérification sur disque j'aurais téléchargé 390 Mo pour un lac dont la moitié
  du travail était déjà payée.
- ⛔ **« Le crop est juste sur les mers fermées, il suffit d'y raccorder le
  globe. »** Le piège que B1 signale, et j'y allais : la plaine ionienne rendait
  **0 m sur le crop aussi**. Le raccordement seul aurait livré une régression
  déguisée en correctif. C'est en cherchant *pourquoi* que j'ai trouvé le
  `SHELF = −500` du tuileur — le trou n'est pas dans le code du crop, il est dans
  **ce qui n'a jamais été cuit**.
- ⛔ **« La Caspienne est fausse dès z8, c'est l'aplat de remplissage de la
  source fine. »** L'analyse de B1, reprise telle quelle dans mon brief, et je
  l'ai crue assez longtemps pour commencer à chercher `detectFillLevels`.
  **Faux : −29 m était le terrarium (ETOPO1 rend la SURFACE de la Caspienne), et
  GEBCO dit −592 m au point sondé, ce qui est juste.** Le balayage complet de nos
  tuiles trouve la fosse à −1 048 m, 80 km plus au nord. Il n'y avait aucun aplat
  à détecter — il y avait une coordonnée mal choisie. **Un correctif visant
  `FILL_SHARE` aurait cherché des heures un défaut qui n'existe pas.**
- ⛔ **« Les 4 tests rouges de `flux-terrain` accusent ma nouvelle attente : j'ai
  cassé la file de tuiles. »** Le message le disait mot pour mot (« la file est
  encore coincée »), et c'est le défaut que ce banc existe pour attraper.
  **Faux : le canevas bouchon n'avait pas `createImageData`**, mon ré-encodage
  levait, et *aucune* tuile n'atteignait `ready`. Le banc n'accusait pas la file,
  il accusait ce qu'il savait nommer. **J'ai failli remanier la file de priorité
  du globe pour un `TypeError` dans un test double.**
- ⛔ **« `tileToLatLon(z, x, y)`, comme partout ailleurs dans ce fichier. »** La
  signature est `(tx, ty, zoom)`. L'appel ne levait rien, ne journalisait rien,
  `gl.getError()` valait 0 : il rendait juste un point à l'autre bout du monde,
  la zone lacustre ne matchait jamais, et le globe restait à +449 m pendant que
  le damier rendait −291 m **dans la même session**. Trouvé en comparant les deux
  chemins, pas en relisant le code — c'est exactement l'avertissement de B1 sur
  la lecture au GPU.
- ✅ **Ce que je confirme de B1** : la falaise est bien à z11 et bien sur AWS
  (pas Mapterhorn) ; le globe ne demandait bien **jamais** `/data/bathy/` ; et
  l'ordre des correctifs proposé était le bon — ① a fait tomber ② tout seul,
  exactement comme annoncé.

---

## ⑥ RESTE OUVERT

- ⚠️ **Le Léman attend un accord de téléchargement** (390 Mo, swisstopo, licence
  commerciale explicite). Tout le reste du chemin est posé et testé. C'est le
  seul écart restant sur le critère 6.
- ⛔ **Deux seuils du barème sont adossés à des coordonnées qui ne décrivent pas
  ce que la référence annonce** (Caspienne 38,5/51,5 et Ionienne 35,5/19). Les
  bons points de contrôle, trouvés par balayage de nos propres tuiles, sont
  **38,962 / 50,738** (−1 048 m) et **36,547 / 21,102** (−5 136 m). Rejouer le
  critère 5 là-dessus le rendrait acquis ; je ne l'ai pas fait moi-même parce que
  **changer la sonde du barème est la décision du noteur, pas du corrigé**.
- ⚠️ **Le seuil de 5 m du critère 3 excède ce que GEBCO contient** en mer Noire
  à z11/z12. Un seuil de 3 m serait tenu ; 1 m est ce que le crop atteint.
- ⚠️ **`SHELF = −500` reste l'arbitrage du tuileur** : les plaines abyssales
  n'ont pas de tuile propre au-dessus de z6. Ce n'est plus un trou (le repli
  conditionné les couvre), mais c'est un plafond de finesse — et c'est pourquoi
  le critère 3 ne peut pas monter par du code.
- ⚠️ **BlueTopo et Copernicus restent catalogués sans zone** (B1-7). Copernicus
  ne peut pas l'être sans secret de compte.
- Captures avant/après : `.banc/B3/`. L'aplat vert uni de `fosse-java.png` (B1)
  est devenu un fond bleu structuré ; le Cotentin de `plateau-manche.png` est au
  même pixel.
