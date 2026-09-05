# RAPPORT GEB — LE RASTER ÉTAIT LÀ, ET LA PRESCRIPTION DE B6 ÉTAIT INCOMPLÈTE

**Arbre** `C:\Dev\wt-geb` · branche `gebco-plancher` · serveur `127.0.0.1:9318`
(9317 était pris par un autre agent — je ne l'ai pas touché).
`npm test` **4 953 · 0** · `audit:tests` **268 = 268, aucun écart**.
Bancs : `scripts/geb-sonde.mjs` (neuf), plus `b6-marches.mjs` et `b6-vue.mjs`
réutilisés tels quels. Captures : `.banc/B6/geb-avant/`, `.banc/B6/geb-apres/`.

⛔ **RIEN N'A ÉTÉ ÉCRIT DANS LA JONCTION PARTAGÉE.** Tout a été cuit dans le
bac à sable, et j'ai mesuré en repointant **la jonction de MON arbre seulement**
(`C:\Dev\wt-geb\public\data\bathy`), puis restaurée. Vérifié après coup :
`C:\Dev\monolith-terrain\public\data\bathy` porte toujours 189 / 556 / 1 499 /
4 490 / 13 891 tuiles en z4→z8, et **0 fichier modifié après le 2026-07-27**.

---

## ⓪ LA RÉPONSE COURTE

> **① Le raster est sur le disque, complet, au bon format. Rien à télécharger.**
> `C:\Dev\monolith-terrain\data\gebco` — 8 pivots, **7 464 960 000 octets**.
>
> **② `--all` NE SUFFIT PAS.** C'est la prescription de B6, et elle est
> incomplète : le tuileur a **DEUX** gardes, pas un. `--all` neutralise la
> pré-passe `probeWorthIt`, mais la garde d'après-peinture `!anySea ||
> !anyShelf` (l. 462) jette **quand même** toute tuile dont le fond est
> entièrement sous −500 m — c'est-à-dire **exactement** les tuiles de plaine
> abyssale qu'on veut cuire. Mesuré, bbox Rodrigues, z8 :
> **`--all` seul écrit 2 tuiles sur 6 ; `--all --shelf -99999` en écrit 6 sur 6.**
>
> **③ Et z4→z6 ne suffit pas non plus** : `BATHY_ZMIN = 7` (`src/dem.js:137`)
> — le plancher que le chargeur atteint **en premier** est z7, pas z6.
>
> **④ Le critère « marche ≤ écart intérieur » n'est PAS atteignable par la
> donnée seule**, et je le chiffre plutôt que de le promettre : même avec un
> plancher z8 mondial complet, la couture reste à **1,28 ×** l'intérieur. Le
> résidu est un effet de bord du rééchantillonnage par tuile — du RENDU.

---

## ① LE RASTER — TROUVÉ, VÉRIFIÉ, LU

Ce que le tuileur attend (lu dans le code, pas supposé) : **pas un GeoTIFF**,
mais le **format pivot** de `scripts/gebco-to-raw.py` — un dossier par dalle,
contenant `grid.bin` (int16 brut, lignes du nord au sud) + `meta.json`
(`width/height/west/east/south/north/dtype/noData`). `openSources` accepte un
dossier parent et prend tout sous-dossier portant un `meta.json`.

| | |
|---|---|
| **chemin** | `C:\Dev\monolith-terrain\data\gebco` |
| **contenu** | 8 pivots `gebco_2026_n*_s*_w*_e*_geotiff/` (grille mondiale en 8 dalles de 90°×90°) |
| **poids** | 8 × `grid.bin` de **933 120 000 o** = **7 464 960 000 o** (6,95 Gio) |
| **format** | int16, 21 600 × 21 600 par dalle, noData −32768 — cohérent au bit : 21600 × 21600 × 2 = 933 120 000 |
| **daté du** | 2026-07-26 10:36 |

Et **les GeoTIFF d'origine sont là aussi** : `data/gebco-tif/` (8 × 933 Mo) et
`data/gebco_2026_geotiff.zip` (**4 241 629 269 o**). ⚡ **Au total 16,2 Go de
source GEBCO déjà sur le disque** — dont 11,4 Go (le zip + les tif) ne servent
plus à rien une fois les pivots faits.

**Preuve que le pivot se lit** (`scripts/geb-sonde.mjs`) : Rodrigues **+85 m**,
large de Rodrigues **−3 186 m**, Camargue **−45 m**, Paris **+48 m**.

⚡ **Et la sonde reproduit le diagnostic de B6 AU CHIFFRE PRÈS.** Fenêtre 9×9 à
z8 autour de Rodrigues, avec la règle exacte du tuileur :
**13 tuiles avec plateau · 68 tuiles d'abysse pur · 0 sans mer.**
Les **68 manquantes de B6 sont exactement les 68 que la garde `anyShelf`
refuse d'écrire.** La cause est établie, pas déduite.

➡️ **Aucun téléchargement n'a été fait, et aucun n'est nécessaire.**
Question de la remise de main : **sans objet**.

---

## ② CE QUE B6 A PRESCRIT, ET POURQUOI ÇA N'AURAIT PAS MARCHÉ

B6 écrit : *« recuire les niveaux de plancher avec `--all` »*, sur z4→z6.
Deux erreurs, toutes deux mesurées.

### a) `--all` ne franchit qu'une des deux gardes

```
scripts/build-bathy-tiles.mjs:422   if (!BAKE_ALL && !probeWorthIt(...))   ← --all agit ICI
scripts/build-bathy-tiles.mjs:462   if (!anySea || !anyShelf)              ← et PAS ici
```

`anyShelf` n'est vrai que si un pixel est **plus haut que `SHELF` (−500 m)**.
Une tuile de plaine abyssale a `anySea = true`, `anyShelf = false` → **écartée**,
`--all` ou non. Banc, bbox `62,-21,64.5,-18.5`, z8 :

| commande | écrites | écartées | motif d'écart |
|---|---|---|---|
| `--all` | **2 / 6** | 4 | « du fond mais TOUT sous −500 m » |
| `--all --shelf -99999` | **6 / 6** | 0 | — |

⚡ **`--shelf -99999` suffit à lui seul** : `probeWorthIt` teste `m > SHELF`, donc
il passe aussi. `--all` devient redondant — je le garde par ceinture-bretelles.

### b) z4→z6 rate le plancher qui compte

`src/dem.js:137` — **`BATHY_ZMIN = 7`**. Le chemin normal (`demanderBathy`,
la fenêtre continue) descend jusqu'à **z7** et s'arrête. Cuire z4→z6 en laissant
z7 troué ne répare **rien** sur ce chemin-là. C'est z7 qu'il faut d'abord rendre
continu ; z4→z6 ne sert que la seconde chance d'index (`fondMarinTuile`,
`loadBathyPatch`).

➡️ **La bonne cuisson est `z4 → z7`, avec `--all --shelf -99999`.**

---

## ③ LA CUISSON, FAITE ET CHIFFRÉE (hors jonction)

```
node scripts/build-bathy-tiles.mjs \
  --src C:/Dev/monolith-terrain/data/gebco --out <bac-à-sable> \
  --zmin 4 --zmax 7 --all --shelf -99999
```

| niveau | monde | **écrites** | écartées (aucune mer — terre pure) | poids | durée |
|---|---|---|---|---|---|
| z4 | 256 | **213** | 43 | | |
| z5 | 1 024 | **773** | 251 | | |
| z6 | 4 096 | **2 900** | 1 196 | | |
| **z4-z6** | 5 376 | **3 886** | 1 490 | **118 Mo** | **3 525 s (59 min)** |
| **z7** | 16 384 | **10 942** | 5 442 | **230 Mo** | **3 451 s (58 min)** |
| **TOTAL** | 21 760 | **14 828** | 6 932 | **348 Mo** | **1 h 57** |

⛔ **Les 6 932 écartées le sont TOUTES pour `!anySea`** — pas un seul pixel de
mer, c'est de la terre pure. L'écart est gratuit, et le compteur séparé de BT-I
le dit explicitement : *« 0 avec du fond mais TOUT sous −99999 m »*.

**Poids ajouté sur disque** : la production porte aujourd'hui **66 Mo** en
z4→z7 (8,1 + 19,6 + 38,3 Mo pour z4-z6, 88 Mo pour z7 — soit **154 Mo**). Le
plancher neuf pèse **348 Mo**. ➡️ **+194 Mo** en remplacement complet,
**+~250 Mo** en ajout seul (les neuves seules, les anciennes conservées).

---

## ④ ⛔ LA DÉCOUVERTE QUI N'ÉTAIT PAS AU PROGRAMME : LA PRODUCTION z4→z7 EST ALIASÉE

J'ai comparé la cuisson neuve à la production, **fichier par fichier, au bit**.
Le résultat m'a arrêté :

| | z4-z6 |
|---|---|
| identiques au bit | **3** |
| **DIFFÉRENTES** | **2 225** |
| nouvelles (absentes en prod) | 1 658 |
| en prod mais pas recuites | 16 |

Écart numérique, tuiles décodées à la main : **|Δ| moyen 0,9 à 15,7 m, max
1 072 m**. Ce n'est pas du bruit.

**Ma première hypothèse — « la production vient d'une autre source ou d'une
autre version » — est FAUSSE** : toutes les tuiles z4→z8 portent la même date
(2026-07-26), et **les tuiles z8 sortent IDENTIQUES AU BIT** (vérifié sur
`8/172/142` et `8/173/142`, prod vs neuf : `cmp` muet).

**La vraie explication, démontrée** (`scripts/…/hypo.mjs`, tuile z6/43/35,
1 369 sondes) :

```
plus-proche-voisin colle 1369 fois sur 1369
moyenné (anti-aliasing)  colle  618 fois sur 1369
```

⚡ **La production z4→z7 a été cuite AVANT le correctif d'anti-aliasing** — le
bogue que le tuileur documente lui-même l. 214-218 : *« un wrapper à deux
arguments les avale silencieusement, rx/ry tombent à 0 et tout le moyennage
anti-aliasing redevient du plus proche voisin — sans qu'aucun test ni aucune
erreur ne le signale »*. **Et z8 est identique parce qu'à z8 le moyennage est un
no-op** : `rx = floor(halfLon × sx) = floor(0,00274 × 240) = 0`, donc
`i0 === i1 && j0 === j1`, donc `at(i0,j0)` — le plus proche voisin. Le bogue
était **invisible à z8 et destructeur à z4**. C'est pour ça que personne ne l'a
vu.

**Corollaire visible sur le poids** : une tuile z4 de production pèse ~69 Ko,
la même recuite ~31 Ko. Le commentaire du tuileur l'avait prédit — *« des tuiles
z7 six fois plus lourdes que z8, parce que le bruit d'échantillonnage ne se
compresse pas »*.

### Les 16 tuiles « perdues » sont du bruit, pas de la donnée

Décodées une par une : **1 à 17 pixels de mer sur 65 536**, à −1 à −96 m, et
toutes **à l'intérieur des terres** — lacs canadiens (−92,8/50,7 ; −118,1/64,2),
Sibérie (87,2/65,4), Amazonie (−70,3/−2,8), Antarctique (171,6/−83,0),
Groenland. Ce sont des **artefacts du plus-proche-voisin** : une cellule GEBCO
sous zéro attrapée au hasard. Le moyennage les noie correctement dans la terre.
**Les perdre est un gain.**

---

## ⑤ LE TABLEAU DU CRITÈRE — MESURÉ, ET UN CRITÈRE N'EST PAS ATTEINT

`scripts/b6-marches.mjs --port 9318 --z 9,11 --lieu -19.7253,63.3691`, bande
contiguë 7×7, jonction de MON arbre repointée sur chaque variante.

⚡ **La ligne « avant » reproduit B6 au centième** (12,05 / 77,66 / 340,19 et
25,06 / 224,12 / 444,79) : le banc est le même, le socle est le même.

| variante | plancher | tuiles sans bathy (z9) | ancêtres servis | champ non peint | **\|Δ\| DEDANS** moy/p99/max | **\|Δ\| COUTURE** moy/p99/max | **couture ÷ dedans** |
|---|---|---|---|---|---|---|---|
| **AVANT** (prod) | z7 troué | **26 / 49** | 8, 7, — | **53,1 %** | 12,05 / 77,66 / 340,19 | **25,06 / 224,12 / 444,79** | **2,08 ×** |
| **AVANT**, plancher d'index | z4 troué | 0 / 49 | **8, 7, 6, 4** | 0 % | 11,48 / 68,33 / 340,19 | 19,24 / 151,50 / 444,79 | 1,68 × |
| **ADDITIF** (neuves seules ajoutées) | z7 continu | **0 / 49** | **8, 7** | **0 %** | 11,81 / 70,93 / 340,19 | 23,71 / 196,49 / 444,79 | 2,01 × |
| **COMPLET** (z4-z7 recuits) | z7 continu | **0 / 49** | **8, 7** | **0 %** | 11,69 / 69,78 / 340,19 | **23,23 / 184,17 / 384,15** | 1,99 × |
| **COMPLET + z8 rempli** (local) | z8 continu | **0 / 49** | **8** seul | **0 %** | 13,33 / 87,88 / 708,02 | **17,09 / 115,44 / 245,89** | **1,28 ×** |

| grandeur du critère | avant | atteint ? |
|---|---|---|
| **tuiles manquantes à z8 autour de Rodrigues** (68/81) | 68 | ✅ **0** — avec `--shelf -99999`, mesuré sur la bbox Rodrigues (36/36 écrites) |
| **champ non peint à z9** | 53,1 % | ✅ **0 %** |
| **facteur de résolution entre voisines** | **16 ×** (z8↔z4) | ✅ **2 ×** (z8↔z7), et **1 ×** si z8 est comblé |
| **marche p99 à la couture** | 224,12 m | ✅ **115,44 m** (−49 %) |
| **marche max à la couture** | 444,79 m | ✅ **245,89 m** (−45 %) |
| **marche ≤ écart intérieur (12 m)** | 2,08 × | ⛔ **NON — 1,28 × au mieux.** Voir ci-dessous |
| **plaques rectangulaires Rodrigues z9→z13** | 0 | ✅ **0** — l'était déjà (B6 §④) |
| **poids ajouté** | — | ✅ **+194 Mo** (remplacement) ou **+~250 Mo** (ajout) |
| **`npm test`** | — | ✅ **4 953 · 0** · `audit:tests` **268 = 268** |
| **côtes et hauts-fonds inchangés** | — | ✅ en ADDITIF : **0 bit**. En COMPLET : **2 225 tuiles changent** — voir §④ |

### ⛔ POURQUOI « marche ≤ 12 m » N'EST PAS ATTEIGNABLE PAR LA DONNÉE

Je l'ai testé plutôt que de le supposer : j'ai comblé z8 **localement** autour de
Rodrigues (36 tuiles, 2 s) pour que **toutes** les voisines soient servies au
même niveau. Résultat : ancêtre **z8 seul**, plus aucun mélange — et la couture
tombe à **1,28 ×** l'intérieur, mais **pas à 1,00 ×**.

Le résidu ne vient plus de la résolution : il vient de ce que **chaque tuile est
rééchantillonnée seule**, sans les texels de sa voisine, donc le Catmull-Rom
extrapole différemment de part et d'autre de l'arête. **C'est du rendu, pas de la
donnée** — et c'est exactement ce que B6 avait annoncé au §⑦ (*« un fondu entre
deux tuiles est un travail de RENDU »*). ⚠️ **C'est le terrain de `wt-liss`.**

⚡ Noter aussi que le « max DEDANS » **monte** de 340 à 708 m dans la dernière
ligne. Ce n'est pas une régression : c'est du **relief GEBCO réel** (un mont
sous-marin) qui devient visible à l'intérieur d'une tuile une fois qu'elle est
servie à sa vraie résolution au lieu d'un ancêtre lissé.

### Les captures

`.banc/B6/geb-avant/rodrigues.png` et `.banc/B6/geb-apres/rodrigues.png`
(protocole CHASSE, 16 crans arrière, `b6-vue.mjs`).

- **avant** : 68 tuiles en cache, **619 px émergés** en pleine mer (0,019 %),
  **0 tuile entièrement émergée**.
- **après** : 58 tuiles, **607 px** (0,017 %), **0 tuile entièrement émergée**.

⛔ **Et je le dis franchement : ces captures ne prouvent pas grand-chose.** Les
607 pixels sont les **rochers réels de Saint-Brandon** (hMax 56 à 77 m), déjà
identifiés par B6 ; le critère « plaques de terre = 0 » était **déjà atteint
avant**. Ce qui change est **dans les chiffres du tableau ci-dessus**, pas dans
un comptage de pixels beiges. ⚠️ Et le cadrage de `b6-vue --crans 16` sort à
**35 m d'altitude**, c'est-à-dire au ras du sol — le même piège de `--sens` que
B6 signale au §⑨. **Je ne revendique pas ces captures comme preuve visuelle** ;
la preuve est le passage de 4 classes d'ancêtres à 1 et de 53,1 % de champ non
peint à 0 %.

---

## ⑥ RECOMMANDATION SUR `probeWorthIt` — ET ELLE N'EST PAS OÙ ON L'ATTEND

**Question posée** : faut-il changer le tuileur pour que le trou ne se reforme
pas ?

**Réponse : `probeWorthIt` n'est PAS le coupable, et le corriger ne réparerait
rien.** Le coupable est la garde d'après-peinture `!anyShelf` (l. 462), qui jette
la tuile **même quand `--all` est passé**. `probeWorthIt` n'est qu'une
optimisation qui devine à l'avance ce que cette garde-là décidera.

➡️ **Ce que je recommande, par ordre de coût croissant :**

1. ⚡ **Le minimum, et il coûte trois lignes** : faire que **`--all` veuille dire
   `--all`**. Aujourd'hui `--all` franchit une garde sur deux, ce qui est un
   piège parfait — l'option existe, son commentaire annonce précisément le
   défaut qu'on veut réparer (*« un plancher troué laisse des rectangles plats
   dans la mer »*), et **elle ne le répare pas**. Il suffit d'écrire
   `if (!BAKE_ALL && (!anySea || !anyShelf))` à la l. 462. ⚠️ **Garder `!anySea`
   inconditionnel serait plus sûr** (une tuile sans un seul pixel de mer n'a
   rien à écrire) : donc `if (!anySea || (!BAKE_ALL && !anyShelf))`.
   **Coût : 1 ligne, 0 régression** — sur les tuiles qui passent déjà, le
   chemin est identique au bit (démontré au §④ : `--all` et
   `--all --shelf -99999` sortent les mêmes 2 tuiles **octet pour octet**).

2. **Écrire la recette dans le README de cuisson**, parce que la ligne de
   commande correcte n'est déductible d'aucun commentaire du fichier :
   `--zmin 4 --zmax 7 --all --shelf -99999`, et **z7 parce que
   `BATHY_ZMIN = 7`**. ⚠️ Le lien entre le tuileur et `dem.js:137` n'est écrit
   nulle part ; c'est ce lien manquant qui a fait prescrire z4→z6 à B6.

3. **Un test de non-régression du tuileur**, de la famille de ceux qui ont sauvé
   B6 : *« avec `--all`, une tuile d'abysse pur EST écrite »*. Sur une source
   pivot synthétique de 64×64 à −4 000 m partout, ça tient en 15 lignes et ça
   **gèle le défaut** — il repassera au rouge le jour où quelqu'un rétablira la
   garde. C'est le seul des trois qui empêche vraiment la prochaine fois.

⛔ **Ce que je NE recommande PAS** : baisser `SHELF` par défaut. Le pré-tri est
un arbitrage d'Adrien, il est justifié et chiffré dans le fichier, et il est
**bon pour z8-z14**. Ce qui est faux, c'est de l'appliquer aux **niveaux de
plancher**, où la tuile ne sert pas à montrer un plateau mais à **exister**.

---

## ⑦ ⛔ LA DÉCISION QUI N'EST PAS À MOI

Il y a **deux façons** d'installer ce plancher, et elles n'ont pas le même prix.
Je n'ai écrit ni l'une ni l'autre dans la jonction partagée.

| | **ADDITIF** — on n'ajoute que les 8 133 tuiles absentes | **COMPLET** — on remplace z4→z7 |
|---|---|---|
| tuiles existantes modifiées | **0 — au bit** | **2 225 changent, 16 disparaissent** |
| trou bouché | ✅ oui | ✅ oui |
| aliasing z4→z7 corrigé | ❌ non | ✅ oui |
| couture z9 (moy / max) | 23,71 / 444,79 | **23,23 / 384,15** |
| poids ajouté | ~250 Mo | +194 Mo (348 remplace 154) |
| risque sur la Camargue / Méditerranée | **nul** | à vérifier — ces zones sont servies par les **zones fines** (`emodnet` z10, `bluetopo` z13) de `index.json`, que je n'ai **pas** touchées, mais leur repli grossier changerait |

➡️ **Ma recommandation : ADDITIF d'abord.** Il répare le défaut qu'Adrien a
filmé (le patchwork de résolutions), il ne peut rien casser, et il laisse la
question de l'aliasing — qui est un **autre chantier, plus vaste, et qui touche
la Méditerranée réparée hier** — se décider à froid.

⚠️ **Et si un jour on veut la couture à 1,28 ×** : il faut un **z8 mondial
continu**. Ordre de grandeur, extrapolé du banc (36 tuiles en 2 s, 38,6 Ko la
tuile) : **51 645 tuiles neuves ≈ 2,0 Go**, plus la recuisson des 13 891
existantes. **C'est un multiple du poids actuel de toute la bathymétrie**, et ça
part sur le réseau. **Ça ne se décide pas dans un rapport.**

---

## ⑧ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ **« Le raster n'est pas sur les disques, B6 l'a écrit : *le raster source
   n'est pas dans l'arbre*. »** ➡️ **Vrai et trompeur.** Il n'est pas dans
   **l'arbre de travail** — il est dans le dépôt principal,
   `C:\Dev\monolith-terrain\data\gebco`, à un `ls` de distance. B6 avait raison
   pour SON arbre et a conclu trop large. **Le mot « arbre » a coûté un
   chantier entier.**

2. ⛔ **« `--all` est le correctif, B6 l'a démontré. »** ➡️ **FAUX, et c'est la
   trouvaille de ce rapport.** `--all` franchit `probeWorthIt` et bute sur
   `!anyShelf`. B6 a lu le commentaire de l'option (qui décrit exactement le bon
   défaut) et n'a pas lu la garde d'après-peinture, 145 lignes plus bas. **Un
   commentaire juste peut documenter une option qui ne fait pas ce qu'il dit.**

3. ⛔ **« z4→z6 suffit, B6 le chiffre à ≤ 5 376 tuiles. »** ➡️ **FAUX** :
   `BATHY_ZMIN = 7`. B6 a raisonné sur le plancher d'INDEX (z4), qui n'est que
   la seconde chance ; le chemin normal s'arrête à z7. Il fallait **21 760**
   tuiles, pas 5 376.

4. ⛔ **« Une recuisson des niveaux grossiers ne touchera pas les tuiles
   existantes : le tuileur est déterministe. »** ➡️ **Il l'est, mais la
   production ne vient pas du tuileur d'aujourd'hui.** 2 225 tuiles sur 2 244
   changent. J'ai d'abord cru à une autre source, puis à une autre version de
   GEBCO — les deux **réfutées par les dates identiques et par les tuiles z8
   identiques au bit**. La vraie cause est le bogue d'anti-aliasing, et c'est le
   test « plus proche voisin colle 1369/1369 » qui a tranché. ⚡ **Ma preuve de
   non-régression initiale (2 tuiles z8 identiques) était juste et sans valeur :
   z8 est le seul niveau où le bogue est un no-op. J'ai failli conclure « rien
   ne bouge » sur l'unique échantillon incapable de le montrer.**

5. ⛔ **« Les 16 tuiles que la recuisson ne reproduit pas sont une perte de
   données. »** ➡️ **Non : c'est du bruit.** 1 à 17 pixels de mer chacune, toutes
   à l'intérieur des continents. Ce sont des artefacts du plus-proche-voisin.

6. ⛔ **« Le plancher rempli fera tomber la marche sous l'écart intérieur. »**
   ➡️ **Non, et je l'ai mesuré au lieu de l'espérer.** Même avec un ancêtre
   UNIQUE (z8 partout), la couture reste à **1,28 ×**. Le reste est un effet de
   bord du rééchantillonnage par tuile — **du rendu**. Le critère du brief n'est
   pas atteignable par une cuisson, et le dire vaut mieux que de le maquiller.

7. ⛔ **« Le "max DEDANS" qui monte de 340 à 708 m est une régression. »**
   ➡️ **Non : c'est un mont sous-marin réel** qui devient visible quand la tuile
   cesse d'être servie par un ancêtre lissé. **Une mesure de rugosité qui
   augmente n'est pas toujours une dégradation.**

---

## ⑨ PIÈGES PAYÉS

- ⚠️ **`Remove-Item` sur une jonction, en PowerShell non interactif** : refusé
  avec un prompt invisible, et **s'il avait marché il aurait pu vider la cible
  partagée**. ➡️ **`cmd /c rmdir <jonction>`** ne supprime que le lien, jamais
  le contenu. Vérifié après coup : les 13 891 tuiles z8 de production étaient
  toujours là. ⚡ **C'est la manœuvre qui aurait détruit le travail de douze
  arbres, et elle tenait à un choix de commande.**
- ⚠️ **`mklink /J` répond « Local NTFS volumes are required »** quand le
  répertoire courant est sur `G:` (Drive). La cible et la source étaient
  pourtant toutes deux sur `C:`. ➡️ `New-Item -ItemType Junction` en PowerShell,
  ou `cd` sur `C:` d'abord.
- ⚠️ **Le port 9317 était pris par un autre agent.** Vite bascule tout seul sur
  9318 **en le disant dans son log, pas dans son code de retour** — un banc
  lancé sur `--port 9317` aurait mesuré l'arbre de quelqu'un d'autre.
  **J'ai relu le log avant de mesurer**, et je n'ai tué que MON serveur (par
  `Get-NetTCPConnection -LocalPort 9318`, jamais par nom de processus).
- ⚠️ **Comparer 2 244 tuiles avec `cmp` en boucle shell dépasse largement les
  2 minutes** — passé en tâche de fond plutôt que tronqué.
- ⚠️ **`import` d'un chemin Windows absolu en ESM** : `Only URLs with a scheme
  in: file, data, node` — il faut `file:///C:/...`.
- ⚠️ **La cuisson est I/O-bound et son débit varie d'un facteur 10** selon le
  niveau : 37 tuiles/min à z5 (fenêtre de moyennage 8×8, ~22 Go de relectures de
  lignes par tuile) contre 364/min à z7. **Extrapoler la durée d'un niveau
  depuis un autre donne n'importe quoi** — les deux niveaux mesurés font 58 et
  59 minutes par coïncidence, pas par régularité.

---

## ⑩ CE QUI EST LIVRÉ

- **Aucune modification de code.** Le tuileur, `dem.js`, `bathy.js` : intacts.
  La recommandation du §⑥-1 est écrite, **pas appliquée** — elle change le
  comportement d'un outil que d'autres arbres emploient.
- **`scripts/geb-sonde.mjs`** — le banc qui lit le pivot et reproduit le
  68/81 de B6.
- **`.banc/B6/geb-avant/`, `.banc/B6/geb-apres/`** — captures et relevés JSON.
- **Le plancher cuit — 14 828 tuiles, z4→z7 — mis à l'abri dans
  `C:\Dev\monolith-terrain\data\bathy-plancher-neuf\` (379 Mo sur disque).**
  ⛔ **`data/` est git-ignoré (l. 24 du `.gitignore`) et n'est PAS servi** : ce
  dossier est à côté du raster, pas dans `public/`. Rien n'est publié tant que
  personne ne le recopie dans la jonction. Les deux variantes de fusion
  (`merge-additif`, `merge-complet`) étaient dans le bac à sable de session et
  se reconstruisent en quelques minutes depuis ce dossier — la cuisson, elle,
  n'est plus à refaire (1 h 57 économisées).
- **La jonction de `wt-geb` est restaurée** sur
  `C:\Dev\monolith-terrain\public\data\bathy`, vérifié.
