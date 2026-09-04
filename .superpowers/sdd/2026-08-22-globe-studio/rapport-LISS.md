# RAPPORT LISS — LE PEIGNE EST PARTI, ET LES TROIS INTERDITS SONT DES PREUVES, PAS DES RELEVÉS

**Arbre** `C:\Dev\wt-liss` · branche `lissage-abysse` · serveur `127.0.0.1:9711`.
`npm test` **4 968 · 0** (4 953 + 15) · `audit:tests` **269 = 269, aucun écart**.
Bancs : `scripts/liss-png.mjs`, `liss-striage.mjs`, `liss-preuve.mjs`, `liss-vue.mjs`.
Relevés et captures : `.banc/LISS/`.

## ⚠️ LES FICHIERS QUE JE TOUCHE (pour la fusion à la main)

| fichier | où | quoi |
|---|---|---|
| `src/bathy.js` | encart 🟣 LISS + 5 constantes + `rayonAbyssePx` + **`lisseAbysse`** | **tout le correctif est là**, en module pur |
| `src/dem.js` | import l. 20 · encart 🟣 LISS · `loadBathyTile(url, z, x, y)` (l. 230-250) · l'appel l. 293 | **UN seul point de pose**, au décodage de la tuile source |
| `test/bathy-lissage-abysse-liss.test.js` | neuf | 15 tests, inscrits dans `package.json` |

⛔ **Je ne défais aucune fusion.** `git diff` ne touche ni `coast-veto.js`, ni
`fuseBathymetry`, ni `CELLULE_MAX_PX`, ni `globe.js`, ni `flux-terrain.js`, ni
les gestes (`wt-porte`), ni le tuileur (`wt-geb`).
⛔ **Rien n'a été écrit dans `public/data/bathy`** — jonction partagée. Les bancs
lisent, calculent en mémoire, et écrivent dans `.banc/LISS/`.

---

## ⓪ LA RÉPONSE COURTE

> **Le peigne est parti, et il est parti en ne touchant à RIEN au-dessus de
> −500 m.** Sur 250 tuiles abyssales réelles, le pic-à-pic bande-à-bande passe
> d'une **médiane de 13,8 m (max 86,8)** à une **médiane de 0,5 m (max 6,2)** —
> **246 sur 250 sous le critère de 5 m**.
>
> Et les trois interdits ne sont pas mesurés, ils sont **démontrés** : sur
> **1 061 tuiles**, **0** pixel au-dessus de −500 m modifié, **0** pixel émergé
> modifié, **0** pixel ayant changé de côté, et **le pixel modifié le moins
> profond de tout le relevé est à −504,00 m**.
>
> Coût : **2,7 ms par tuile, UNE FOIS** — le lissage est posé au décodage, qui
> est mémoïsé. Une tuile z8 sert 2 070 fois.

⚠️ **Et j'ai livré deux versions fausses avant celle-là**, l'une et l'autre
attrapées par la mesure et pas par le raisonnement. Voir §⑥ ; c'est le
paragraphe qui vaut le plus.

---

## ① LA DÉRIVATION DU SEUIL — ELLE EST DANS LE TUILEUR, PAS DANS MON GOÛT

Le brief interdisait de poser « le profond » en dur. La grandeur du produit qui
sépare déjà le plateau de l'abysse existe, elle est écrite, et elle est unique :

```
scripts/build-bathy-tiles.mjs:88    const SHELF = +arg('shelf', -500)
                          …:326     if (m > SHELF) return true   // du plateau
```

`probeWorthIt` **n'écrit une tuile bathy que si elle touche de l'eau plus haute
que SHELF**. Autrement dit : **−500 m est la profondeur sous laquelle le produit
a lui-même décidé qu'il n'y avait plus rien de fin à décrire.** Sous elle,
aucune tuile n'est cuite pour son propre compte, et c'est le socle GEBCO — 464 m
de maille, interpolé entre des traces de sondage — qui répond seul. C'est
exactement la définition que le brief demandait (« la profondeur sous laquelle
plus aucune source fine ne couvre »).

> **`ABYSSE_M = 500 = |SHELF|`. Le seuil du lissage EST le seuil du tuileur.**

Et c'est ce seuil, **et lui seul**, qui porte l'interdit ② : EMODnet (115 m),
BlueTopo (16 m), swisstopo (2 m), Copernicus (100 m), NCEI (93 m) décrivent la
frange côtière et le plateau — **tout ce pour quoi la bathymétrie fine a été
intégrée à grands frais vit au-dessus de −500 m, et n'est jamais lu.**

### Le rayon : une LONGUEUR AU SOL, pas un rayon en pixels

Une tuile z8 porte 575 m de maille à Rodrigues, une z4 en porte 9 210 : le même
rayon en pixels lisserait 2,9 km ici et 46 km là. Or les niveaux grossiers **n'ont
pas le défaut** — B6 a mesuré que le Catmull-Rom du surzoom leur retire déjà
l'essentiel (pic-à-pic divisé par 30 à 200 après ×32). **Le peigne vient des
tuiles servies NATIVEMENT.** Un rayon en mètres au sol s'éteint donc tout seul là
où il nuirait :

| z | maille équateur | r px | maille 60°N | r px |
|---|---|---|---|---|
| 4 | 9 784 m | **0** | 4 892 m | **0** |
| 6 | 2 446 m | **0** | 1 223 m | **0** |
| 7 | 1 223 m | **0** | 611 m | 4 |
| 8 | 611 m | 4 | 306 m | 9 |
| 10 | 153 m | 18 | 76 m | 37 |

**Sa VALEUR est dérivée du critère**, pas de l'esthétique : c'est la plus petite
qui passe sous 5 m sur les quatre tuiles abyssales de référence
(`scripts/liss-striage.mjs`, balayage complet dans le fichier).
**5 px × 575 m = 2 900 m.**

⛔ **Et un plancher de rayon à 3 px, qui est un REFUS de lisser.** En dessous, la
boîte n'est plus un passe-bas, c'est une moyenne de trois cases : mesuré sur la
tuile z6 43/35, le striage tombe de 48,0 à **14,2 m — encore trois fois le
critère** — pour **1 062 m de déplacement maximal**. Le mauvais marché, très
exactement. C'est gelé par un test de mutation.

---

## ② OÙ C'EST POSÉ, ET POURQUOI PAS AUX TROIS SITES DE FUSION

Le brief laissait trois endroits. **Aucun des trois.** C'est posé au
**décodage de la tuile source** (`loadBathyTile`, `src/dem.js`).

| endroit | prix | verdict |
|---|---|---|
| la **cuisson** | permanent, mais il faut tout recuire — et la bathymétrie sur disque est une **jonction partagée** entre une douzaine d'arbres | ⛔ interdit ici |
| la **fusion** (`fuseBathymetry`) | c'est là que `smoothSeaFloor` a déjà coûté **84 ms par bloc** et s'est fait retirer (encart de `src/dem.js`) — et il faudrait câbler **les trois sites** | ⛔ |
| le **rendu** | il faudrait porter la porte de profondeur, la moyenne pondérée et le fondu dans le nuanceur, sur un champ déjà quantifié en Int16 | ⛔ |
| ⚡ **le décodage de la tuile source** | **2,7 ms par tuile, UNE FOIS** — `loadBathyTile` est mémoïsé, et une tuile z8 sert **2 070 fois** | ✅ |

⚡ **Et c'est ce qui règle le piège n°4 du brief.** PLAT, VETO et B6 ont dû câbler
**les trois** sites de fusion à la main, et « un correctif posé à un seul site n'a
jamais tenu ici ». Ici il n'y a **qu'un** point de pose — parce que les trois
sites (`dem.js:loadBathyPatch`, `globe.js:fondMarinTuile`,
`monde/flux-terrain.js:demanderBathy`) passent **tous** par `peindreBathyTuile`,
donc par `loadBathyTile`. On agit sur la DONNÉE, pas sur le résultat de la
fusion. Vérifié : `grep loadBathyTile src/` ⇒ un appelant.

---

## ③ LE STRIAGE, CHIFFRÉ AVANT/APRÈS

### Le protocole, et les deux corrections qu'il a fallu lui faire

Le banc reprend **au mot** celui de `scripts/b6-striage.mjs` (projection sur
chaque axe, retrait d'une tendance lissée sur 9, pic-à-pic du résidu à 2 %
d'extrêmes). **Contrôle** : mes cinq premiers nombres ressortent **au centième**
de ceux du rapport B6 (25,14/85,44 · 33,94/53,41 · 47,02/96,78 · 72,27/182,88 ·
193,29/194,19), alors que je décode le PNG **moi-même en node**
(`scripts/liss-png.mjs` : inflate + défiltrage, aucun canevas, aucun Chrome).
⚡ **Le décodeur maison est donc validé contre le banc navigateur de B6**, et
toute la mesure numérique de cette session tourne sans navigateur.

⚠️ **Deux corrections, chacune après un faux constat :**

1. **La fenêtre.** Mon premier relevé prenait la tuile entière : la projection y
   portait **l'île de Rodrigues**, que le lissage ne touche pas (c'est
   l'interdit ②), et le chiffre plafonnait à 17 m **quel que soit le rayon**. On
   cherche donc la fenêtre 128² **la plus profonde dont TOUS les pixels sont
   sous −1 000 m**.
2. **La métrique.** Le résidu B6 garde un **plancher fait de la COURBURE réelle
   du fond** (un résidu à une tendance sur 9 n'est pas nul sur un fond courbe).
   J'ajoute donc le **pic-à-pic bande à bande** — l'écart d'une bande à la
   moyenne de ses deux voisines — qui est insensible à toute tendance affine et
   ne mesure **que l'alternation**. C'est elle que le peigne fait voir, et c'est
   elle que je chiffre.

### Le résultat, sur les tuiles nommées

| tuile (fond moyen de la fenêtre) | rayon retenu | **AVANT** X/Y | **APRÈS** X/Y |
|---|---|---|---|
| Rodrigues z8 173/142 (−3 059) | 5 | 8,5 / 7,9 | **0,6 / 0,9** |
| Rodrigues z8 172/142 (−3 905) | 5 | 28,8 / 36,8 | **2,0 / 4,5** |
| Rodrigues z8 171/142 (−4 067) | 5 | 42,1 / 18,7 | **1,8 / 2,3** |
| Moorea z8 21/140 (−3 649) | 4 | 21,4 / 62,6 | **1,5 / 9,5** ⚠️ |
| Porquerolles z8 132/94 (−2 641) | 6 | 3,2 / 2,4 | **0,1 / 0,1** |
| Rodrigues **z6** 43/35 (−3 451) | **0** | 48,0 / 31,7 | **48,0 / 31,7** — intacte, exprès (§①) |

### Et sur 250 tuiles abyssales tirées du disque

| | médiane | p90 | p99 | max | **au-dessus de 5 m** |
|---|---|---|---|---|---|
| **AVANT** | 13,8 m | 37,0 | 62,0 | 86,8 | **223 / 250** |
| **APRÈS** | **0,5 m** | 2,3 | 5,9 | 6,2 | **4 / 250** |

➡️ **Le critère est atteint sur 246 tuiles sur 250 et la médiane est divisée par
27.** ⚠️ **Je dis les quatre qui restent** : elles culminent à 6,2 m, et pousser
le rayon à 6 px n'en ramène que deux (max 5,4 m). Ce n'est plus du striage à ce
niveau, c'est du relief abyssal réel à deux cellules.

---

## ④ ⛔ LES TROIS INTERDITS — DÉMONTRÉS, PUIS VÉRIFIÉS SUR 1 061 TUILES

### La démonstration (c'est elle qui compte)

`lisseAbysse` est une **convolution normalisée à poids continu** : le poids d'un
pixel dans la moyenne **EST sa force de lissage**
`k = smoothstep((profondeur − 500) / 500)`, et la sortie vaut
`v + (moyenne − v)·k·wB` avec `k, wB ∈ [0,1]`.

1. ⛔ **Le trait de côte ne bouge pas d'un pixel.** Le rivage est décidé par le
   relief de référence dans `fuseBathymetry` (branche TERRE, en amont de tout),
   jamais par la source marine — leçon des polders, et je n'y touche pas. Et ici
   on ne lit **que** des pixels de source déjà sous −500 m.
2. ⛔ **Les hauts-fonds et plateaux restent nets.** `k = 0` au-dessus de −500 m
   ⇒ **la sortie est l'entrée AU BIT**, et le pixel ne contribue à aucune
   moyenne. Lagons, récifs, plateaux continentaux, EMODnet, BlueTopo, swisstopo,
   plateau de Saint-Brandon : jamais lus.
3. ⛔ **Aucun pixel ne change de côté.** Les poids sont nuls au-dessus de
   −500 m, donc `moyenne < −500` ; la sortie est le barycentre de deux valeurs
   sous −500 m, **donc sous −500 m**. Un pixel lissé ne peut pas remonter à
   zéro, **ni s'en approcher à moins de 500 mètres**.

### La vérification (`scripts/liss-preuve.mjs`, 1 061 tuiles réelles, z4 à z12)

| grandeur | mesuré |
|---|---|
| ⛔ pixels au-dessus de −500 m modifiés | **0** |
| ⛔ pixels émergés modifiés | **0** |
| ⛔ pixels ayant changé de côté (terre/mer) | **0** |
| le pixel modifié **le moins profond** de tout le relevé | **−504,00 m** |

Et sur les lieux nommés du critère, tuile par tuile — Camargue, Bretagne
(Brest), **fjord de Bergen**, Rodrigues, **Moorea + son lagon**, **plateau de
Saint-Brandon**, Porquerolles, à z8 / z10 / z12 : **0 / 0 / 0** partout.

⛔ **Les carrés plats de Camargue restent à 0**, et c'est structurel, pas
chanceux : ils sont produits par la **reclassification terre → mer** de la bande
de bruit B5, que `CELLULE_MAX_PX` et `terreVeto` bornent — trois mécanismes
auxquels je ne touche pas, et qui vivent tous **au-dessus** de −500 m, là où
`lisseAbysse` ne lit rien. La tuile z10 de Camargue est d'ailleurs **modifiée
sur 0 pixel** (relevé §②).

---

## ⑤ LA TRANSITION — MESURÉE, ET C'EST ELLE QUI M'A COÛTÉ LA SOIRÉE

### La bonne question n'est pas celle que j'ai posée d'abord

⚠️ « Quelle est la plus grosse marche latérale du champ de correction Δ ? » est
une **mauvaise** question : ce maximum tombe là où le RELIEF est le plus raide,
et il ne dit rien du seuil. La bonne question est :
**l'isobathe du seuil est-elle un endroit PARTICULIER ?**

On compare donc, sur les mêmes 1 061 tuiles, la marche latérale de Δ sur les
paires de pixels qui **traversent** l'isobathe −500 m, à celle des paires
entièrement en plein abysse :

| | première écriture (masque binaire) | livré (`k · wB`) |
|---|---|---|
| marche max de Δ **sur l'isobathe** | 2 591 m | **886 m** |
| marche max de Δ **en plein abysse** | 1 621 m | 1 621 m |
| **rapport** | **1,60** ⛔ le seuil est un endroit spécial | **0,55** ✅ le seuil est moins accidenté que l'océan libre |

➡️ **Il n'y a pas de ligne de niveau** : la correction est plus lisse à la
traversée du seuil qu'elle ne l'est n'importe où dans l'abysse. Et
`smoothstep` a une dérivée nulle aux deux bouts : la transition est **C¹ par
construction, pas par réglage**.

### La preuve à l'œil, et la contre-épreuve qui tranche

`.banc/LISS/avant/rodrigues-large.png` porte le peigne, franc, vertical et
horizontal, sur toute la mer. `.banc/LISS/apres/rodrigues-large.png` ne l'a plus,
et le plateau de Rodrigues y est **intact et net**.

⚠️ **Mais ma PREMIÈRE version « après » portait un LISERÉ EN ESCALIER** tout
autour de ce plateau. J'ai bien failli le livrer en le prenant pour « le talus
enfin révélé une fois le bruit parti ». **La contre-épreuve l'a démenti**
(`.banc/LISS/essai-seuil2000/`) : en déplaçant le SEUIL à 2 000 m, **le liseré
suit le seuil**. C'était ma transition. Voir §⑥-③.

### Le prix, dit en entier

| grandeur (200 tuiles z8, 13,1 M pixels) | mesuré |
|---|---|
| pixels modifiés | 35,8 % |
| **\|Δ\| médian** sur les pixels modifiés | **12 m** — c'est le striage, et c'est ce qu'on visait |
| \|Δ\| p90 / p99 / p99,9 | 89 m / 264 m / 467 m |
| pixels déplacés de **plus de 100 m** | **3,0 % de tous les pixels** |

⚠️ **Je ne l'enjolive pas** : 3 % des pixels bougent de plus de 100 m, et ce sont
les **flancs raides** — dorsales, monts sous-marins, pieds d'îles volcaniques.
Un lissage à 2,9 km au sol adoucit un escarpement de 2,9 km, c'est sa
définition. À 3 000-5 000 m de fond, sous une exagération de relief, c'est
l'arbitrage qu'Adrien a pris. **Ce n'est pas gratuit, et le §⑦ dit comment on
ferait mieux.**

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ **« Il suffit de réutiliser `smoothSeaFloor` avec `seaLevel: −500` :
   masque, fondu et garde de bord suivent, zéro ligne de code. »** C'était
   élégant, et c'est **ce que j'ai livré en premier**. ➡️ **RÉFUTÉ PAR LA
   MESURE.** Son masque est **binaire** (`v < level` ⇒ poids 1, sinon 0). Au
   voisinage de l'isobathe, la fenêtre ne contient qu'une poignée de pixels
   admis, tous du côté profond : la moyenne **saute** d'un pixel à l'autre.
   Mesuré sur 1 061 tuiles : **2 591 m de marche latérale**, soit **1,6 fois**
   celle de l'océan libre — un liseré le long de l'isobathe 500. **On aurait
   remplacé un artefact par un autre**, ce que le brief interdit en toutes
   lettres. D'où le **poids continu** livré.

2. ⛔ **« On borne la correction à ±100 m, et le lissage ne peut plus abîmer une
   falaise. »** ➡️ **RÉFUTÉ, ET À L'ENVERS : la borne RALLUME le striage.**
   `moyenne − v` n'est pas fait que du striage — il porte surtout la **courbure
   locale** du fond. La borne mord donc partout où le relief est marqué, et elle
   mord **irrégulièrement**, ce qui réinjecte de la haute fréquence. Mesuré, même
   tuile : sans borne **1,8/4,5 m** ; borné à 100 m **14,9/21,4 m**, trois fois
   le critère. Et le raisonnement s'étend à tout limiteur, même doux (`tanh`) :
   la dérivée de la saturation écrase le petit signal en même temps que le grand.

3. ⛔ **« Le liseré autour du plateau de Rodrigues, c'est le talus enfin visible
   une fois le bruit parti — c'est de la géographie, pas mon défaut. »**
   ➡️ **FAUX, et c'est la réfutation la plus utile de la session.** J'ai déplacé
   le SEUIL à 2 000 m et repris la même capture : **le liseré a suivi le seuil.**
   ⚡ **Sans ce contrôle je livrais l'artefact en le prenant pour de la donnée.**
   La cause : un fondu est une distance en PROFONDEUR, mais ce qui se voit est
   sa largeur au SOL — et l'isobathe 500 m n'est pas un endroit quelconque,
   **c'est le talus, l'endroit le plus raide de l'océan**. Mesuré sur 120 tuiles
   z8 : la bande −500 → −1 000 m fait **1 pixel de large en médiane**. La force
   passait de 0 à plein en **une cellule**.

4. ⛔ **« Alors on élargit le fondu à 3 000 m. »** ➡️ **Ça marche à l'œil (le
   liseré disparaît, `.banc/LISS/essai-fondu3000/`) et ÇA PERD LE CRITÈRE** :
   sur les 250 tuiles, le striage résiduel remonte de **0,5 à 2,3 m de médiane**
   et **62 tuiles sur 250 repassent au-dessus de 5 m**, parce que tout ce qui
   est entre 1 000 et 3 000 m n'est plus lissé qu'à moitié. **Élargir le fondu,
   c'est acheter la transition avec le défaut.** Refusé.
   ⚡ **CE QUI MARCHE : `force = k · wB`.** `wB` est la moyenne de boîte des
   poids — **la même porte, mais lue sur le VOISINAGE au lieu du pixel**. Elle
   monte donc sur la largeur de la fenêtre, **en espace**, quelle que soit la
   raideur du talus. Et elle était **déjà calculée** : le correctif coûte une
   multiplication. Fondu de nouveau à 500 : le liseré ne revient pas (capture)
   ET le striage retombe à 0,5 m de médiane.

5. ⛔ **« Un filtre BILATÉRAL réglerait tout : il tue le striage et préserve les
   falaises. »** C'était ma meilleure piste pour les 3 % de pixels du §⑤.
   ➡️ **RÉFUTÉ PAR LA MESURE, et pour une raison de fond.** Un bilatéral
   préserve ce qui dépasse son σ de portée — **et le striage EST un motif de
   25 à 97 m d'amplitude**, c'est-à-dire exactement l'ordre du σ qu'il faudrait.
   Mesuré sur 40 tuiles, σ de portée 30/50/80/150 m : striage résiduel médian
   **22,4 / 20,4 / 17,3 / 10,5 m** — contre **13,8 m AVANT tout traitement**.
   **Il ne fait presque rien.** Pour qu'il morde il faut σ ≫ striage, et alors
   il n'est plus préservateur d'arêtes. La piste est fermée, avec ses chiffres.

6. ⛔ **« Le striage se mesure sur la tuile entière, comme dans B6. »**
   ➡️ Sur une tuile qui porte une ÎLE, la projection porte l'île — que le
   lissage ne touche pas, exprès. Le chiffre plafonnait à 17 m quel que soit le
   rayon, et j'ai failli conclure « le lissage ne marche pas ». **Un relevé qui
   inclut la zone protégée mesure la protection, pas le correctif.**

---

## ⑦ CE QUI RESTE OUVERT, DIT HONNÊTEMENT

- **Les 3 % de pixels déplacés de plus de 100 m** (§⑤) sont le vrai prix, et il
  n'est pas nul. Le bilatéral est réfuté (§⑥-5). La piste qui reste est un
  lissage **anisotrope** — lisser le long des courbes de niveau et pas à travers
  — qui préserverait les escarpements tout en tuant l'alternation. Coût en
  O(r²) et code non trivial ; **je ne l'ai pas fait et je ne le revendique pas.**
- **Quatre tuiles sur 250 restent au-dessus de 5 m** (max 6,2 m). Ce n'est plus
  du striage à ce niveau, c'est du relief à deux cellules ; je préfère le laisser
  que d'élargir encore le rayon.
- ⛔ **LE CORRECTIF DE FOND RESTE CELUI QUE B6 A NOMMÉ, ET IL N'EST PAS À MOI :
  recuire les niveaux de plancher avec `--all`.** Le peigne a DEUX composantes :
  la lignéation de GEBCO (traitée ici) et **l'alternance de netteté entre tuiles
  voisines servies par des ancêtres de résolutions différant d'un facteur 16**
  (B6 §③ : 445 m de marche à la couture). ⚡ Mon correctif **ne touche pas** à la
  seconde, et il la rend même un peu plus visible en enlevant le bruit qui la
  masquait. C'est `wt-geb` qui tient ce bout-là.
- **Le biais de bord du flou de boîte.** La tuile source ne connaît pas ses
  voisines, son bord est répliqué : sur une pente, la moyenne y est biaisée.
  Mesuré indirectement (la marche à la couture ne bouge pas dans le relevé), mais
  **pas isolé** — je le signale plutôt que de le taire.

---

## ⑧ LES CAPTURES POUR ADRIEN

`.banc/LISS/avant/` et `.banc/LISS/apres/`, même protocole, même cadrage
(`gotoCtl.go`, molette **arrière**, 14 s d'attente de quadtree).

- **`rodrigues-large.png`** — ⚡ **la paire à regarder**, c'est le lieu de sa
  vidéo. **Avant** : le peigne, bandes verticales et horizontales sur toute la
  mer, exactement `f_018`. **Après** : la mer est lisse, le plateau de Rodrigues
  est intact et son bord est un dégradé doux — **pas de liseré**.
- **`rodrigues.png`** — le même, 9 crans, plus près.
- **`moorea-lagon.png`** — le témoin de l'interdit ② : l'île, le lagon et la
  barrière de corail sont **identiques**. ⚠️ Le cadrage des deux prises n'est pas
  au pixel près (la caméra ne se repose pas exactement au même endroit d'une
  session à l'autre) : **la preuve de l'interdit est le relevé numérique du §④,
  pas cette image** — l'image en est le témoin.
- **`bretagne.png`** — le témoin littoral.
- **`essai-seuil2000/` et `essai-fondu3000/`** — les deux essais réfutés du §⑥,
  gardés exprès : ce sont eux qui montrent que le liseré était le mien.

---

## ⑨ PIÈGES PAYÉS DANS CETTE SESSION

- ⚠️ **`find public/data/bathy` rend 0** — le brief le disait, `find
  public/data/bathy/8` rend bien 13 891. Piège évité, celui-là.
- ⚡ **« Un décodeur d'image corrige une donnée numérique. »** J'ai écrit mon
  propre décodeur PNG en node (`scripts/liss-png.mjs`, ~60 lignes : inflate +
  défiltrage). **Bénéfice inattendu** : plus de Chrome ni de Vite dans la boucle
  de mesure — 1 061 tuiles analysées en quelques secondes là où le banc de B6
  lançait un navigateur pour lire un PNG de 8 Ko. **Et il est validé** : mes
  cinq premiers nombres sont ceux de B6 **au centième**.
- ⚠️ **Un relevé qui inclut la zone qu'on protège mesure la protection.**
  Voir §⑥-6. Le chiffre était stable, propre, reproductible — et faux.
- ⚠️ **Une capture ne dit pas d'où vient ce qu'elle montre.** Le liseré du §⑥-3
  avait toutes les apparences d'un talus. **La seule chose qui a tranché est un
  contrôle où j'ai déplacé le paramètre** pour voir si le défaut suivait.
- ⚠️ **Scripts d'édition en binaire, octet relu** : `grep -c $'\r'` **= 0**
  vérifié sur `src/bathy.js`, `src/dem.js`, `package.json` et le fichier de test.
  Aucun CR introduit.
- ⛔ **Je n'ai tué aucun Chrome.** Chaque banc ferme le sien par `nav.close()` et
  **affiche son PID** avant de commencer. Aucun `taskkill`.
- ⛔ **Aucune écriture dans `public/data/bathy`** (jonction partagée) : les bancs
  écrivent dans `.banc/LISS/`.
