# B3 — LA BATHYMÉTRIE DU GLOBE : CE QUE J'AI CORRIGÉ, ET CE QUE J'AI PROUVÉ FAUX

Arbre `C:\Dev\wt-bat3`, branche `bathy-correctif`. Serveur
`npm run dev -- --host 127.0.0.1 --port 6311`. Toutes les valeurs du globe sont
lues **au GPU** (`readPixels` sur la texture GL de la tuile, décodage terrarium),
sonde `scripts/sonde-b1.mjs` de B1, étendue par l'option additive `--points`.

**`npm test` → 4 755 · 0 échec · 2 sautés. `npm run audit:tests` → 253 = 253,
aucun écart. Tests rouges de B1 : 4 verts, 3 rouges. Tests B3 réancrés : 5 / 5
verts.**

⚠️ **SECOND TOUR.** Le coordinateur a (a) autorisé explicitement le
téléchargement swisstopo, (b) **réancré** le critère 5 sur les bonnes
coordonnées et **reformulé** le critère 3, sans baisser la barre. Ce rapport est
à jour de ce second tour ; les valeurs du premier restent en colonne « avant ».

---

## ⚡ EN UNE PHRASE

**La falaise de z11 est comblée et la cascade descend partout** : la fosse de la
Sonde passe de 0,0 m à −7 105,1 m, l'écart globe/damier en mer Noire de 2 200 m
à 0,1 m, le globe demande enfin des tuiles bathymétriques (44 · 72 · 71 contre
**0**), le Léman a un fond à 296 m sous sa nappe et le Baïkal à 745 m.
**Les sept critères sont acquis sous la forme réancrée du barème ; deux d'entre
eux, sous la forme d'origine, demandaient à la carte d'être fausse — et je le
prouve sur nos propres tuiles.**

---

## ① LES SEPT CRITÈRES, MESURE AVANT / APRÈS AU GPU, À z11 ET z12

| # | critère | seuil | AVANT | APRÈS | verdict | pts |
|---|---|---|---|---|---|---|
| **1** | fond en approche (Java z11, GPU) | ≤ −6 000 m | **0,0 m** | **−7 105,1 m** · z12 **−7 105,2** | ✅ | **2,5 / 2,5** |
| **2** | accord globe / damier, mer Noire ×3 | ≤ 200 m | 2 200 m à z11 | **0,04 · 0,08 · 0,24 m** | ✅ | **2,0 / 2,0** |
| **3** | relief, pas aplat — **reformulé : même relief que le damier ±50 %, à surface au sol égale** | rapport ∈ [0,50 ; 1,50] | **0,00 m** — l'aplat | Java z11 **0,87** · m. Noire z11 **0,99** · z12 **1,09** | ✅ | **1,5 / 1,5** |
| **4** | cascade vivante sur le globe | ≥ 1 requête ×3 zones | **0 / 189** | **44 · 72 · 71**, toutes 200, **zéro 404** | ✅ | **1,5 / 1,5** |
| **5** | mers fermées + Caspienne — **réancré sur les fosses réelles** | Casp. ≤ −800 ; Médit. et m. Noire ≤ 300 m, z11 **et** z12 | Casp. −29 · Médit. **0 aux deux chemins** · m. Noire 0 | Casp. **−1 047,9 / −1 047,7** ✅ · Calypso **−5 135,4 / −5 136,2** (écart **0,6 / 0,2 m**) ✅ · m. Noire **−2 199,9 / −2 199,8** (12 m) ✅ | ✅ | **1,0 / 1,0** |
| **6** | lacs | Baïkal **et** Léman ≥ 100 m sous la surface | 7 m / 6 m | **Baïkal 744,9 m** · **Léman 296,0 m** | ✅ | **0,5 / 0,5** |
| **7** | rien payé ailleurs | ≥ 4 748 · 0, audit sans écart, Manche z10 −68 ± 5 m, Cotentin au même pixel | 4 748 · 0 | **4 755 · 0 · 2 sautés** · **253 = 253** · Manche z10 **−72,0 m** · Cotentin identique | ✅ | **1,0 / 1,0** |

### Le détail des colonnes de fond

| lieu | z10 | **z11** | **z12** | damier | ancrage |
|---|---|---|---|---|---|
| Fosse de la Sonde | −7 105,3 | **−7 105,1** *(était 0,0)* | **−7 105,2** *(était 0,0)* | −7 105 | −7 290 |
| Mer Noire | −2 200,0 | **−2 199,9** *(était 0,0)* | **−2 199,8** *(était 0,0)* | −2 200 | −2 212 |
| Ionienne (point de B1) | −3 696,8 | **−3 685,8** *(était 0,0)* | **−3 686,1** | **−3 686** *(était 0)* | ⚠️ voir ② |
| **Calypso — réancré** | −5 134,3 | **−5 135,4** | **−5 136,2** | −5 136 | **−5 136** |
| Caspienne (point de B1) | −593,1 | −593,6 *(était −29,0)* | −593,8 | −593 | ⚠️ voir ② |
| **Caspienne, fosse sud — réancré** | −1 047,7 | **−1 047,9** | **−1 047,7** | −1 048 | **−1 048** |
| Baïkal | −290,9 | **−288,8** *(était +449,0)* | — | −287 | nappe +456 |
| **Léman** | — | **+76,0** *(était +371,0)* | — | +76 | nappe +372 |
| Manche | −72,0 | −72,5 | — | −72 | −60 |

⚡ **Un acquis que B1 n'espérait pas : la plaine ionienne est réparée SUR LES
DEUX CHEMINS.** B1 la laisse ouverte à son §⑨ (« non diagnostiqué ») ; le damier
y rendait 0 m et rend maintenant −3 686 m. Le diagnostic est en ③.

### ⛔ Le correctif ne vaut pas qu'aux points nommés

Six lieux qui ne servent **aucun seuil** et n'ont réglé **aucun réglage**
(`test/attaque-b3-REANCRE.mjs`, test `B3-G`) :

| lieu | z11 globe / damier | z12 globe / damier | pente globe / damier |
|---|---|---|---|
| Fosse des Kouriles | −5 158,2 / −5 157 | −5 156,2 / −5 157 | 0,98 · 0,95 |
| Large du Cap | −2 966,6 / −2 967 | −2 966,5 / −2 966 | 0,93 · 0,95 |
| Mer Rouge | −2 061,9 / −2 056 | −2 059,0 / −2 053 | 0,82 · 0,93 |
| Chesapeake | −1 263,2 / −1 277 | −1 266,7 / −1 267 | 0,96 · 1,00 |
| Lac Supérieur ⚠️ | +183,2 / +183 | idem | aucune donnée — **inchangé** |
| Titicaca ⚠️ | +3 815,0 / +3 809 | +3 808,5 / +3 809 | aucune donnée — **inchangé** |

⚠️ **LES GRANDS LACS ET LE TITICACA N'ONT AUCUNE BATHYMÉTRIE DANS NOS TUILES** —
GEBCO est marin et n'en dit rien (vérifié : `lireCascade` y rend **0,0 m**, le
marqueur de terre du tuileur). Ils restent rendus à leur surface, **exactement
comme avant B3** : c'est une lacune de **couverture**, pas une régression, et
aucune ligne de code ne peut la combler. ⚡ **Le Baïkal est un cas différent, et
c'est pourquoi lui marche : GEBCO PORTE son lit.** Les sources pour le reste sont
cataloguées par B2 (NOAA NCEI Grands Lacs, 90 m, domaine public ; GLOBathy CC0
pour le monde) et attendent une décision de cuisson.

---

## ② MA NOTE ESTIMÉE : **10 / 10 sur le barème réancré** · **6,35 / 10 sur le barème d'origine**

Somme du tableau : 2,5 + 2,0 + 1,5 + 1,5 + 1,0 + 0,5 + 1,0 = **10,0**.

⚠️ **Je donne les deux chiffres, et je dis lequel a bougé.** Sur le barème **tel
que B1 l'a écrit**, ma note est **6,35** : les critères 3 et 5 y échouent. Ce qui
a changé n'est pas la carte — les mesures ci-dessus sont les mêmes qu'au premier
tour — c'est **où l'on mesure, et quoi**. Le coordinateur a tranché après avoir
vu la preuve ; je la redonne ici pour que le noteur la revérifie lui-même.

### La preuve du réancrage, relevée sur NOS PROPRES TUILES

`node scripts/releve-tuiles-b3.mjs` — lecture directe des PNG du disque, sans
navigateur, avec la même descente « fin → plancher » que la production :

```
CE QUE NOS TUILES DISENT, POINT PAR POINT
  Caspienne (point de B1)          38.5   /  51.5     ->    -592.0 m   (tuile 8/164/98)
  Caspienne (fosse sud)            38.962 /  50.738   ->   -1048.0 m   (tuile 8/164/97)
  Mediterranee (point de B1)       35.5   /  19.0     ->   -3688.0 m   (tuile 6/35/25)
  Mediterranee (fosse Calypso)     36.547 /  21.102   ->   -5136.0 m   (tuile 8/143/100)

LE POINT LE PLUS PROFOND DE CHAQUE BASSIN, dans nos tuiles z8
  Caspienne        -1048 m  a  38.962 / 50.738
  Mer Ionienne     -5136 m  a  36.547 / 21.102
```

- **Caspienne** : la profondeur documentée du bassin sud est **1 025 m sous une
  surface à −28 m, soit −1 053 m**. Nos tuiles la portent **à 5 m près**, en
  38,962 / 50,738 — **80 km** du point de B1. Au point de B1, GEBCO dit −592 m,
  et le dit de façon cohérente sur quatre niveaux (z5 −608 · z6 −600 · z7 −592 ·
  z8 −592) : un gradient régulier, pas un aplat de remplissage.
- **Méditerranée** : la **fosse Calypso** est documentée à **−5 267 m en
  36,57 / 21,13**. Nos tuiles la retrouvent **à sa position**, à −5 136 m —
  **200 km** du point de B1.

➡️ **Les seuils de B1 n'étaient pas trop exigeants : ils étaient posés là où la
grandeur qu'ils nommaient n'existe pas.** C'est la **cinquième et la sixième**
occurrence d'une classe d'erreur que B1 relève lui-même quatre fois dans sa table
des 25 points (Somalie, Chesapeake, deux dorsales) — *« la référence, pas une
mesure, et la mesure a raison »* — et qu'il n'a pas appliquée à son barème.

### La preuve de la reformulation du critère 3

⛔ **« Étendue 9×9 ≥ 5 m » demandait 5 m de dénivelé sur 126 m au sol** (z12,
tuile 512 px) **dans la plaine abyssale de la mer Noire : une pente de 4 %**,
dans l'un des fonds les plus plats de la planète. GEBCO_2026 (464 m) n'a rien de
tel à dire, et B1 l'écrit sans le voir — son argumentaire dit *« le crop garde
1 à 3 m de relief »* trois lignes au-dessus d'un seuil posé à 5.

⚠️ **ET L'ÉTENDUE BRUTE NE COMPARAIT PAS DEUX CHOSES COMPARABLES.** Le rapport
globe/damier valait ~1,7–2,2 à z11 et ~1,0 à z12 : trop régulier pour être du
bruit. La cause, mesurée : **à z11 le globe sert des tuiles de 256 px et le
damier des tuiles Mapterhorn de 512 px**, donc les 9 texels du globe couvrent
**deux fois plus de sol** et trouvent mécaniquement deux fois plus d'étendue.

**La contre-épreuve est décisive** : au large de Chesapeake, le damier retombe
sur AWS **256 px**, la même taille que le globe — et là le rapport **brut**, sans
aucune correction, vaut **0,96 (z11) et 1,00 (z12)**.

La grandeur comparée est donc une **pente, en m/km** — `étendue / (9 × texel)`,
physique et indépendante de la taille de tuile :

| lieu / zoom | globe (m/km) | damier (m/km) | rapport |
|---|---|---|---|
| **Java z11** | 7,71 | 8,86 | **0,87** ✅ |
| **Mer Noire z11** | 7,86 | 7,95 | **0,99** ✅ |
| **Mer Noire z12** | 8,63 | 7,95 | **1,09** ✅ |
| Java z12 | 8,52 | 5,91 | 1,44 ✅ |
| Ionienne z11 / z12 | 24,93 / 26,48 | 25,00 / 28,57 | 1,00 / 0,93 ✅ |
| Calypso z11 / z12 | 62,33 / 47,41 | 57,90 / 43,43 | 1,08 / 1,09 ✅ |
| Kouriles z11 / z12 | 85,41 / 86,75 | 87,10 / 91,25 | 0,98 / 0,95 ✅ |
| Chesapeake z11 / z12 | 206,91 / 207,74 | 214,78 / 207,50 | 0,96 / 1,00 ✅ |
| Baïkal z10 / z11 | 76,85 / 89,92 | 90,42 / 97,75 | 0,85 / 0,92 ✅ |
| Large du Cap z11 / z12 | 19,98 / 20,28 | 21,43 / 21,43 | 0,93 / 0,95 ✅ |

**Sur seize points de fond réel, le rapport reste entre 0,82 et 1,44**, et
**aucune fenêtre n'est plus à 0,00 m** — l'aplat, qui était le vrai défaut, a
disparu.

### ⚠️ Ce qui reste rouge, et pourquoi ce n'est pas atteignable honnêtement

**B1-7 — `bluetopo` et `copernicus` déclarés sans zone.**
⛔ **Copernicus EXIGE UN COMPTE** pour télécharger (vérifié par B2 :
« inconciliable avec une cuisson automatisée sans secret ») : la source ne peut
pas être cuite par un script sans qu'on lui confie un identifiant, et ce n'est
pas une décision d'agent. BlueTopo, lui, est cuisible (bucket S3 public listable,
CC0) mais demande un second gros téléchargement et un balayage de préfixe
horodaté — non fait, faute de temps de banc, pas d'obstacle.
⛔ **Je n'ai PAS retiré les deux entrées de `SOURCES` pour verdir le test** :
ç'aurait été verdir en supprimant la question, et le dépôt aurait perdu deux
plans documentés et vérifiés juridiquement (ils vivent dans `_reserve` de
`bathy-zones.json`).
⚠️ **À REMONTER À ADRIEN** : la promesse « 2–16 m sur la côte est des
États-Unis » reste caduque, et `creditsForBounds` ne citera jamais ces deux
sources tant qu'elles n'ont pas de zone.

**B1-3 et B1-4 restent rouges dans leur fichier d'origine** — c'est attendu :
ils portent les deux seuils démontés ci-dessus. Leurs remplaçants
(`test/attaque-b3-REANCRE.mjs`, 5 tests) sont **verts**.

---

## ②bis LE LÉMAN — LA CHAÎNE DE B2, REJOUÉE DE BOUT EN BOUT

Feu vert explicite reçu pour les 390 Mo. Les trois commandes de B2, sans
modification, et **les résultats tombent à la tuile près** :

```
1. curl  → data/swissbathy3d/leman.zip           408 778 215 octets, 693 dalles ASCII
2. pivot → 12 384 × 7 093 = 87,8 M cellules, 167,5 Mo, 3 min 3 s
           23 048 463 cellules DANS le lac (26,2 %)
           point le plus bas : 62,11 m LN02 → 309,94 m sous la nappe
           à 46,44064 N / 6,59996 E          ← la position documentée, RETROUVÉE
3. tuiles → 404 écrites, 727 écartées, 3,22 Mo, z9..z14, 3 min 38 s
           fond le plus bas cuit : 62,00 m → 310,05 m  (réf CIPEL 309,70 → +0,35 m)
4. contrôle → tous les contrôles de `controle-lac-b2.mjs` passent
```

⚡ **Le pivot retrouve le point le plus profond du Léman à sa position
documentée sans qu'on la lui donne** — c'est ce qui valide d'un coup la
reprojection CHLV95→WGS84, le référentiel vertical LN02 et l'échantillonnage.

⚠️ **Les deux gardes de B2 sont en place, et il y en a maintenant DEUX
indépendantes** :
1. le tuileur écrit **`nappe + 1 m` hors du lac**, jamais 0 (`SENTINELLE` de
   `build-lake-tiles.mjs`) ;
2. **et `fuseBathymetry` refuse de son côté** un échantillon nul sous une nappe
   déclarée (mon test `sMuet`).
Le contrôle ④ de B2, écrit pour *démontrer* les 347,67 m de vallée du Rhône
détruits, rend désormais **0,00 m d'écart même avec la sentinelle remplacée par
0** : la seconde garde attrape ce que la première laisserait passer. C'est la
défense en profondeur au sens propre, pas une redondance.

⚠️ **La licence n'est pas cosmétique.** L'entrée `swisstopo` de `SOURCES` est
**obligatoire** : swisstopo écrit « A reference to the source is mandatory », et
sans elle `creditsForBounds` rend « attribution à compléter » — publier dans cet
état serait une **faute de licence**, pas un défaut d'affichage. En contrepartie
la licence autorise **en toutes lettres** l'usage commercial et la
redistribution.

⚠️ **La limite, à assumer** : swissBATHY3D s'arrête à la frontière. La rive
française (Évian, Thonon) retombe sur GEBCO, qui est marin et ne dit rien du
Léman — cette partie sera **muette, pas fausse**, et la ligne de partage se voit
à l'œil sur le fond du Petit Lac.

⚠️ **Les 390 Mo de source et les 167 Mo de pivot sont `.gitignore`** : ils sont
reconstructibles par les trois commandes ci-dessus. Seules les **404 tuiles
(3,22 Mo)** sont déployées.

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

**`test/attaque-b3-REANCRE.mjs` — 5 tests, HORS de la liste `test`** (il exige un
serveur et un Chrome, comme celui de B1) : les critères 3 et 5 sous leur forme
réancrée, **plus** le test `B3-G` qui vérifie sur trois lieux hors barème que le
correctif ne vaut pas qu'aux points nommés. **5 / 5 verts.**

⚠️ **`scripts/sonde-b1.mjs` n'a gagné qu'une option ADDITIVE (`--points`), et la
liste `POINTS` de B1 n'est pas touchée.** `attaque-b1-ROUGE.mjs` cherche ses
lieux par `nom.includes(...)` et prend **le premier** qui correspond : ajouter
« Caspienne (fosse sud) » à la liste de base aurait pu détourner B1-4 vers un
autre point que celui qu'il vise et **le verdir sans que rien ne le dise**. Les
points de B3 n'entrent que si `--points` est passé, ce que les tests de B1 ne
font jamais.

### Les 7 tests rouges de B1

| test | état | valeur rendue |
|---|---|---|
| **B1-1** fosse de la Sonde ≤ −6 000 m | ✅ **VERT** | −7 105,1 m à z11 |
| **B1-2** accord globe/damier ≤ 200 m | ✅ **VERT** | 0,04 / 0,08 / 0,24 m |
| **B1-3** étendue 9×9 ≥ 5 m | ✖ rouge | mer Noire z11 **3,96 m** — seuil démonté en ②, remplacé par **B3-3 VERT** |
| **B1-4** Caspienne ≤ −800 m | ✖ rouge | −593,6 m — **la bonne valeur du point** ; réancré, **B3-5a VERT à −1 047,9 m** |
| **B1-5** lacs ≥ 100 m sous la surface | ✅ **VERT** | Baïkal **744,9 m**, Léman **296,0 m** |
| **B1-6** cascade vivante | ✅ **VERT** | 44 · 72 · 71 tuiles bathy, 3 zones |
| **B1-7** déclarée = cuite | ✖ rouge | `bluetopo`, `copernicus` — **Copernicus exige un compte** (voir ②) |

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
  vérification sur disque, j'aurais cuit une source de plus pour un lac dont la
  moitié du travail était déjà payée.
- ⛔ **« Le damier est juste sur les mers fermées, il suffit d'y raccorder le
  globe. »** Le piège que B1 signale, et j'y allais : la plaine ionienne rendait
  **0 m sur le damier aussi**. Le raccordement seul aurait livré une régression
  déguisée en correctif. C'est en cherchant *pourquoi* que j'ai trouvé le
  `SHELF = −500` du tuileur — le trou n'est pas dans le code du damier, il est
  dans **ce qui n'a jamais été cuit**.
- ⛔ **« La Caspienne est fausse dès z8, c'est l'aplat de remplissage de la
  source fine. »** L'analyse de B1, reprise telle quelle dans mon brief, et je
  l'ai crue assez longtemps pour commencer à chercher `detectFillLevels`.
  **Faux : −29 m était le terrarium (ETOPO1 rend la SURFACE de la Caspienne), et
  GEBCO dit −592 m au point sondé, ce qui est juste.** Le balayage complet de nos
  tuiles trouve la fosse à −1 048 m, 80 km plus au nord. Il n'y avait aucun aplat
  à détecter — il y avait une coordonnée mal choisie. **Un correctif visant
  `FILL_SHARE` aurait cherché des heures un défaut qui n'existe pas.**
- ⛔ **« Le globe porte 1,7 à 2 fois plus de relief que le damier : mon
  ré-encodage au 1/256 m est plus fin que l'Int16 du damier. »** Explication
  plausible, publiée telle quelle au premier tour, et **fausse**. Le rapport
  était trop régulier (≈2 à z11, ≈1 à z12) pour une différence de quantification.
  La vraie cause : **à z11 le globe sert du 256 px et le damier du 512 px**, donc
  les 9 texels du globe couvrent deux fois plus de sol. La contre-épreuve était
  déjà dans mes données sans que je la voie — **au large de Chesapeake, où le
  damier retombe sur AWS 256 px, le rapport brut vaut 0,96 et 1,00**. Comparer
  deux fenêtres de « 9 texels » quand un texel n'a pas la même taille des deux
  côtés, c'est mesurer la taille de la tuile et l'appeler relief.
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
  chemins, pas en relisant le code — exactement l'avertissement de B1 sur la
  lecture au GPU.
- ⛔ **« Les Grands Lacs et le Titicaca vont marcher comme le Baïkal, il suffit
  de leur déclarer une nappe. »** J'allais ajouter deux zones. **`lireCascade` y
  rend 0,0 m** : GEBCO n'a **aucun** fond pour eux, le 0 est le marqueur de terre
  du tuileur. Déclarer une nappe n'aurait rien débloqué (il n'y a rien à lire) et
  aurait étendu la logique de nappe à deux emprises continentales entières pour
  **zéro pixel changé**. Le Baïkal marche parce que la donnée y est ; ailleurs il
  faut la cuire, pas la déclarer.
- ✅ **Ce que je confirme de B1** : la falaise est bien à z11 et bien sur AWS
  (pas Mapterhorn) ; le globe ne demandait bien **jamais** `/data/bathy/` ; et
  l'ordre des correctifs proposé était le bon — ① a fait tomber ② tout seul,
  exactement comme annoncé.
- ✅ **Ce que je confirme de B2** : les quatre casses annoncées étaient réelles,
  la chaîne de cuisson rejouée rend **exactement** ses chiffres (404 tuiles,
  3,22 Mo, +0,35 m), et le pivot **retrouve le point le plus profond du Léman à
  sa position documentée** sans qu'on la lui donne.

---

## ⑥ RESTE OUVERT

- ⚠️ **BlueTopo n'est pas cuit** (bucket S3 public, CC0, cuisible : il faut
  balayer un préfixe horodaté, l'index gpkg est daté et tout chemin figé
  pourrira). ⛔ **Copernicus ne PEUT PAS l'être sans un compte** — c'est une
  décision d'Adrien, pas d'un agent. Tant qu'ils n'ont pas de zone,
  `creditsForBounds` ne les citera jamais et la promesse « 2–16 m sur la côte est
  des États-Unis » reste caduque. **B1-7 restera rouge, et c'est honnête.**
- ⚠️ **Les Grands Lacs, le Tanganyika, le Titicaca et Crater Lake restent à leur
  surface** : aucune donnée dans nos tuiles. Sources cataloguées par B2 et prêtes
  à décision (NOAA NCEI, ~10 Mo, domaine public, pour les Grands Lacs ; GLOBathy
  CC0 pour le monde, mais **modélisé et non mesuré** — B2 propose un plafond z10
  pour ne pas prétendre à une précision qui n'existe pas).
- ⚠️ **Les 21 autres lacs de swissBATHY3D** sont à portée immédiate : la source
  est téléchargée pour le Léman seul, mais l'inventaire STAC couvre 22 lacs pour
  ~20 Mo de tuiles. **Une entrée de zone par lac** (chacun a sa nappe) — la
  mécanique est déjà là.
- ⚠️ **`SHELF = −500` reste l'arbitrage du tuileur** : les plaines abyssales
  n'ont pas de tuile propre au-dessus de z6. Ce n'est plus un trou (le repli
  conditionné les couvre) mais c'est un **plafond de finesse au large**, et c'est
  la vraie limite du critère 3 : aucune ligne de code ne la déplacera, seule une
  cuisson le ferait.
- ⚠️ **Un seul `seaLevel` par emprise** : si une dalle contient deux lacs de
  cotes différentes, un seul niveau s'applique. La sentinelle empêche que ce soit
  destructeur (l'autre lac est simplement ignoré), mais c'est une limite écrite,
  pas découverte.
- ⚠️ **`npm run deploy` appelle désormais `build:bathyindex`** ; **pas**
  `build:bathytiles`, qui exige des rasters sources absents du dépôt (l'y mettre
  ferait échouer tout déploiement fait ailleurs). `verifie:dist` reste le filet
  qui compte les tuiles.
- Captures avant/après : `.banc/B3/`. L'aplat vert uni de `fosse-java.png` (B1)
  est devenu un fond bleu structuré ; le Cotentin de `plateau-manche.png` est au
  même pixel.
