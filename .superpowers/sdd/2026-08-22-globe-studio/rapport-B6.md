# RAPPORT B6 — LE STRIAGE ET LES PLAQUES DE PLEINE MER : MESURÉS, ET DEUX SUR TROIS SONT DE LA DONNÉE

**Arbre** `C:\Dev\wt-b6` · branche `bathy-portes` · serveur `127.0.0.1:9317`.
`npm test` **4 942 · 0** (4 929 + 13) · `audit:tests` **266 = 266, aucun écart**.
Bancs : `scripts/b6-rodrigues.mjs`, `b6-ancetres.mjs`, `b6-striage.mjs`,
`b6-marches.mjs`, `b6-porte.mjs`, `b6-flux.mjs`, `b6-tableau.mjs`, `b6-vue.mjs`.
Relevés et captures : `.banc/B6/`.

## ⚠️ LES LIGNES QUE JE TOUCHE (pour la fusion à la main)

| fichier | où | quoi |
|---|---|---|
| `src/coast-veto.js` | cache + `vetoTerre` + `calculeVeto` | le cache porte `{masque, franche}` ; **`vetoTerre` garde son contrat AU BIT** (`Uint8Array\|null`) ; nouvel export **`merFranche`** |
| `src/bathy.js` | encart 🔴 B6, puis **deux lignes** dans `fuseBathymetry` | `out[i] = merFranche && noData ? level − SEA_EPS : l`, aux deux sorties émergeantes |
| `src/globe.js` | import l. 20 · `fondMarinTuile` (l. 3700-3722) | `merFranche` lu sur la même promesse, ajouté à `optsFusion` |
| `src/dem.js` | import l. 25 · `loadDem` (l. 557-582) | idem |
| `src/monde/flux-terrain.js` | import l. 158 · `demanderBathy` · `remplirHauteurs` | idem, **plus le garde `remplis === total`** |
| `test/bathy-mer-franche-b6.test.js` | neuf | 13 tests, inscrits dans `package.json` |

⛔ **Je ne défais aucune fusion.** `git diff` ne touche ni `mer-sphere.js`
(`wt-dent`), ni les gestes (`wt-porte`), ni le reste de `globe.js` (`wt-cn3`).

---

## ⓪ LA RÉPONSE COURTE, PARCE QU'ELLE EST INCONFORTABLE

> **Les deux défauts qu'Adrien a filmés ne sont pas des bogues de fusion. Ce sont
> les DEUX FACES D'UN MÊME TROU DANS LA DONNÉE : le tuileur bathymétrique
> n'écrit pas les tuiles de plaine abyssale, et le terrarium n'a rien à mettre à
> la place.**
>
> **Le striage est la lignéation propre de GEBCO** — 25 à 97 m de pic-à-pic dans
> le fichier BRUT, contre 1 m de pas d'encodage. Le rééchantillonnage ne
> l'ajoute pas : **il l'atténue**.
>
> **Les « plaques rectangulaires » ne sont pas de la terre émergée** (mesuré :
> 0 pixel émergé sur les 262 144 de chaque tuile de pleine mer). Ce sont des
> tuiles voisines servies par des ancêtres bathymétriques de **quatre niveaux
> différents** — 576 m, 1 151 m, 2 302 et **9 210 m de cellule** — avec des fonds
> moyens qui diffèrent de **1 458 m** d'une classe à l'autre, et une **marche de
> 445 m au maximum** sur l'arête de tuile.

J'ai quand même trouvé et fermé **une vraie porte de code**, la seule du module
qui puisse FABRIQUER de la terre. ⚠️ **Et je dis tout de suite qu'elle ne change
rien à l'image d'Adrien** : sur les 21 tuiles du tableau du critère, elle modifie
**0 bit**, parce que le trait de côte refuse (correctement) de parler là où il y
a vraiment des îles. Le §⑤ explique pourquoi je la livre quand même.

---

## ① LES QUATRE PORTES — ET LA CINQUIÈME, QUI EST LA SORTIE

PLAT et VETO ont énuméré les **quatre** chemins qui mettent un pixel **sous**
l'eau. Le défaut de Rodrigues est le **sens inverse**, et il n'a que **deux
sorties**, qui sont la même règle écrite deux fois :

| # | porte | sens | qui l'a fermée | ce qu'elle produit à Rodrigues, chiffré |
|---|---|---|---|---|
| ① | **zéro exact** du terrarium (`NODATA_EPS`) | vers la MER | ⛔ personne, **délibérément** (VETO §②) | c'est par elle que la mer de Rodrigues EXISTE : le terrarium y est à 0,000 pile sur **262 144 px / 262 144** |
| ② | **aplat de remplissage** (`detectFillLevels`) | vers la MER | ⛔ personne, délibérément | **0** — aucun aplat constaté en pleine mer (le champ immergé du terrarium n'a qu'UNE valeur, 0, et elle est déjà prise par ① ) |
| ③ | **bande de bruit B5** (`NOISE_BAND`) | vers la MER | **PLAT** (échelle) + **VETO** (côte) | **0** — `bandeBruitAdmise` ne s'arme pas ici (rapport 4 à 16, mesuré § ②), et VID l'avait déjà démontré |
| ④ | **pixel déjà négatif** | vers la MER | ⛔ personne, délibérément | **0** — le terrarium n'a aucun pixel négatif sur ces tuiles |
| ⑤ | **`s >= level` et `!isFinite(s)`** → `out[i] = l` | **vers la TERRE** | **B6, ici** | **257 px** sur la tuile z8 171/142 · **53,1 % du champ** au chemin sans seconde chance |

⚡ **La cinquième n'est pas « une porte de plus », c'est la SORTIE** : c'est le
seul endroit de `fuseBathymetry` où un pixel peut ressortir **émergé** après que
la source marine a été lue. Les quatre autres ne peuvent que noyer ; celle-là
seule peut fabriquer de la terre. C'est donc la seule qui puisse expliquer une
plaque BEIGE sur 4 000 m de fond — et c'est ce que j'ai instruit.

**Le mécanisme, mesuré** (`scripts/b6-porte.mjs`, tuile bathy z8 171/142, au
large de Rodrigues, fichier **PNG SANS PERTE**) :

```
tuile brute décodée   673 valeurs distinctes · pas de quantification 1,00 m
                      min −4 640,00 m · MAX 0,00 m EXACTEMENT · 79 pixels à 0
le même champ après resampleCatmullRom (256 → 512)   MAX +6,18 m
⇒ 257 pixels franchissent `s >= level` et ressortent à 0 m = TERRE
```

**Le positif n'est pas dans la donnée.** C'est le **dépassement du cubique**
autour de la sentinelle de terre du tuileur (qui aplatit la terre à 0 pile).
Puis `s >= level` rend `l` — et `l`, en pleine mer, est le **zéro muet** du
terrarium. **Deux absences, et le code rendait celle qui veut dire TERRE.**

**La règle B6, en une ligne :**

> Quand le terrarium est muet (`noData`) **et** que la source fine est muette
> (`s >= level`, ou pas peinte du tout) **et** que le trait de côte a été
> consulté et ne déclare **aucune** terre, le pixel n'est pas de la terre : il
> prend `level − SEA_EPS`.

⛔ **Le juge est celui de VETO, pris dans l'autre sens.** VETO retire à la mer le
droit de prendre de la terre ; B6 retire à l'absence le droit d'en fabriquer.
⛔ **Et on n'invente pas de profondeur** : jamais le fond voisin — ce serait la
voie B que PLAT a écartée. On rend de l'eau, la moins profonde possible.
⚠️ `merFranche` absent, faux, ou d'un type inattendu ⇒ **comportement d'avant, AU
BIT** ; c'est testé sur `undefined`, `false`, `0`, `null`, `'oui'` et `1`.

---

## ② LE STRIAGE — TRAITÉ À PART, ET C'EST LA DONNÉE

Le brief demandait de mesurer le striage **séparément** et de vérifier s'il n'est
pas « le bruit d'encodage amplifié ». **Ce n'est ni l'un ni l'autre : c'est la
lignéation propre de GEBCO, et elle est dans le fichier avant qu'on y touche.**

Protocole (`scripts/b6-striage.mjs`) : on décode la tuile SOI-MÊME
(`colorSpaceConversion: 'none'`), on projette le champ sur chaque axe (moyenne
des 256 colonnes, moyenne des 256 lignes), on retire une tendance lissée sur 9,
et on prend le **pic-à-pic du résidu** en écartant 2 % d'extrêmes. Une bande
régulière survit à la moyenne de 256 lignes ; un relief réel, non.

| tuile | valeurs | **pas d'encodage** | min/max | **BRUT pic-à-pic X / Y** | après ×4 | après ×32 |
|---|---|---|---|---|---|---|
| z8 173/142 (Rodrigues) | 537 | **1,00 m** | −3 592 / 0 | **25,14 / 85,44 m** | 19,8 / 59,8 | 0,15 / 0,11 |
| z8 172/142 | 645 | **1,00 m** | −4 480 / −10 | **33,94 / 53,41 m** | 15,13 / 38,14 | 0,96 / 2,09 |
| z8 171/142 | 673 | **1,00 m** | −4 640 / 0 | **47,02 / 96,78 m** | 37,35 / 15,31 | 2,58 / 0,35 |
| z6 43/35 | 735 | **1,00 m** | −5 544 / 0 | **72,27 / 182,88 m** | 21,35 / 26,19 | 3,49 / 2,04 |
| z4 10/8 | 768 | **1,00 m** | −6 112 / 0 | **193,29 / 194,19 m** | 18,32 / 15,69 | 0,94 / 0,89 |

**Trois lectures, et elles tranchent :**

1. ⛔ **Le pas d'encodage vaut 1,00 m et les tuiles bathy sont du PNG SANS
   PERTE** (`data/bathy/…/….png`, pas du `.webp`). Le piège « ±0,5 m des deux
   côtés du zéro » du brief vaut pour le **terrarium**, pas pour la bathymétrie.
   **Le striage est donc 25 à 97 fois le bruit d'encodage.** Le critère
   « amplitude sous le bruit d'encodage » n'est PAS atteignable en le
   « corrigeant » : il faudrait effacer la donnée.
2. ⛔ **Le rééchantillonnage ne le fabrique pas — il l'ATTÉNUE.** Le
   Catmull-Rom est un passe-bas : à ×4 le pic-à-pic tombe déjà, à ×32 il est
   divisé par 30 à 200. **Ma première hypothèse était l'inverse, et elle est
   réfutée** (§⑥).
3. ⚡ **Et c'est ça qui explique le PEIGNE.** Le striage n'est pas uniforme : il
   vaut 25–97 m sur une tuile servie nativement en z8, et **0,3 à 2,6 m** sur une
   tuile servie par un ancêtre z4. Comme les tuiles voisines ne sont pas servies
   au même niveau (§③), **la texture du fond change brutalement à chaque arête de
   tuile** — c'est ça, la grille qu'on croit voir. Nous ne dessinons aucune
   grille : nous alternons deux régimes de netteté sur une grille.

➡️ **Verdict striage : PAS un bogue de rendu, pas un bogue d'encodage. Sa
visibilité, elle, est un effet du trou de données du §③.**

---

## ③ LES PLAQUES — CE N'EST PAS DE LA TERRE, C'EST UN PATCHWORK DE RÉSOLUTIONS

### Le fait qui commande tout : **le plancher bathymétrique est TROUÉ**

Le tuileur écarte volontairement les tuiles qui n'ont que de l'abysse
(`scripts/build-bathy-tiles.mjs`, garde `SHELF = −500`), au motif écrit noir sur
blanc dans le fichier : *« Les tuiles écartées gardent silencieusement l'ancien
relief […] donc rien ne casse au large. »*

⛔ **CE MOTIF N'EST PLUS VRAI, ET C'EST LA CAUSE RACINE.** Mesuré
(`scripts/b6-rodrigues.mjs`) : sur **chacune** des 27 tuiles terrarium
Mapterhorn examinées autour de Rodrigues à z9/z10/z11, le champ vaut
**0,000 m PILE sur 262 144 pixels sur 262 144**. Il n'y a **pas** d'ancien
relief au large. Il n'y a rien.

Et le dépôt l'avait prévu, à la ligne 316 du tuileur :
> *« un plancher troué laisse des rectangles plats dans la mer »*

Le plancher n'a jamais été cuit avec `--all`, qui existe pour exactement ça :

| niveau | tuiles présentes | monde |
|---|---|---|
| z4 | **189** | 256 |
| z5 | **556** | 1 024 |
| z6 | **1 499** | 4 096 |
| z7 | **4 490** | 16 384 |
| z8 | **13 891** | 65 536 |

Autour de Rodrigues, fenêtre de 9×9 tuiles : **68 manquantes sur 81 à z8 et à
z7**, 52/81 à z6, 7/25 à z5.

### Ce que la descente en fait, tuile par tuile

`peindreBathyTuile` descend « fin → plancher » et **la première tuile qui répond
gagne**. Chaque tuile décide donc SEULE. Sur 169 tuiles à z9 autour de Rodrigues
(`scripts/b6-ancetres.mjs`) :

| plancher | tuiles SANS bathymétrie | ancêtres réellement servis |
|---|---|---|
| **normal** (`BATHY_ZMIN = 7`) | **113 / 169 (67 %)** | z8, z7 |
| **d'index** (terrarium muet) | **0 / 169** | **z8=32 · z7=24 · z6=64 · z4=49** |

| ancêtre servi | cellule au sol | tuiles | **fond moyen** | étendue |
|---|---|---|---|---|
| z8 | **576 m** | 32 | −2 464 m | −4 003 … −214 |
| z7 | **1 151 m** | 24 | **−3 922 m** | −4 299 … −3 231 |
| z6 | **2 302 m** | 64 | **−3 218 m** | −3 863 … −2 535 |
| z4 | **9 210 m** | 49 | −3 860 m | −4 596 … −2 767 |

**Quatre résolutions côte à côte, facteur 16 entre les extrêmes, et jusqu'à
1 458 m d'écart de fond moyen entre deux classes voisines.**

### La marche à la couture — le chiffre de la « plaque »

`scripts/b6-marches.mjs` peint une bande contiguë de 7×7 tuiles, puis compare
l'écart |Δ| entre deux colonnes voisines **à l'intérieur** d'une tuile et **à la
couture** :

| z | mode | tuiles sans bathy | ancêtres | champ non peint | **\|Δ\| DEDANS** moy/p99/max | **\|Δ\| À LA COUTURE** moy/p99/max |
|---|---|---|---|---|---|---|
| 9 | normal | **26/49** | 8,7,— | **53,1 %** | 12,05 / 77,66 / 340,19 | **25,06 / 224,12 / 444,79** |
| 9 | index | 0/49 | 8,7,6 | 0 % | 11,48 / 68,33 / 340,19 | **19,24 / 151,50 / 444,79** |
| 10 | normal | 14/49 | 8,7,— | 28,6 % | 5,45 / 37,06 / 177,57 | 8,63 / 78,65 / 245,04 |
| 11 | normal | 7/49 | 8,— | 14,3 % | 2,41 / 17,69 / 64,66 | **6,10 / 90,21 / 246,35** |

➡️ **La couture vaut 2,1 fois l'intérieur en moyenne, 2,9 fois au p99, et monte
à 445 m de marche.** Une falaise de 445 m sur une arête parfaitement
rectiligne, au milieu de 4 000 m de fond : **c'est la plaque à arête rectiligne
d'Adrien**, et elle est faite de profondeur, pas de terre.

### Et la preuve que ce n'est PAS de la terre

`scripts/b6-tableau.mjs`, tuiles réelles, fusion réelle :

- **large de Rodrigues, z9, z11, z13 : ÉMERGÉS = 0, EAU = 262 144 / 262 144.**
  Pas un pixel de terre. Le trait de côte y déclare franchement la pleine mer.
- **`scripts/b6-vue.mjs`** (l'application, protocole CHASSE, molette arrière) :
  sur 3,6 Mpx de tuiles « en pleine mer », **607 pixels émergés (0,017 %)** — et
  ils portent une altitude terrarium de **56 à 77 m**. Ce sont des **rochers
  réels** (Cargados Carajos / Saint-Brandon), pas des plaques.

⛔ **Le critère « plaques de terre en pleine mer, Rodrigues z9→z13 = 0 » est donc
ATTEINT — et il l'était déjà avant mon correctif.** Ce qu'Adrien voit s'appelle
autrement.

---

## ④ LE TABLEAU DU CRITÈRE — 7 lieux × 3 zooms

`scripts/b6-tableau.mjs`, tuiles réelles, index réel, trait de côte réel.
« émergés » = pixels ≥ 0 dans la tuile fusionnée ; « eau » = pixels < 0.

| lieu | z | tuile | ancêtre bathy | veto | **mer franche** | émergés av→ap | eau av→ap | **remontés** | **bits changés** |
|---|---|---|---|---|---|---|---|---|---|
| Rodrigues | 9 | 9/346/284 | z8 | oui | non | 5 832 → 5 832 | 256 312 → 256 312 | **0** | **0** |
| Rodrigues | 11 | 11/1384/1138 | z8 | oui | non | 67 425 → 67 425 | 194 719 → 194 719 | **0** | **0** |
| Rodrigues | 13 | 13/5537/4553 | z8 | oui | non | 53 709 → 53 709 | 208 435 → 208 435 | **0** | **0** |
| **large de Rodrigues** | 9 | 9/344/284 | z8 | non | **OUI** | **0 → 0** | 262 144 → 262 144 | **0** | **0** |
| **large de Rodrigues** | 11 | 11/1378/1139 | z8 | non | **OUI** | **0 → 0** | 262 144 → 262 144 | **0** | **0** |
| **large de Rodrigues** | 13 | 13/5515/4558 | z8 | non | **OUI** | **0 → 0** | 262 144 → 262 144 | **0** | **0** |
| La Réunion | 9 / 11 / 13 | — | z8 | oui | non | 61 158 / 262 011 / 262 144 — inchangés | 200 986 / 133 / 0 | **0** | **0** |
| Camargue | 11 / 13 / 15 | — | z10 | oui | non | 189 501 / 230 374 / 260 419 — inchangés | 72 643 / 31 770 / 1 725 | **0** | **0** |
| Porquerolles | 11 / 13 / 15 | — | z10 | oui | non | 24 246 / 130 712 / 261 982 — inchangés | 237 898 / 131 432 / 162 | **0** | **0** |
| Bretagne | 11 / 13 / 15 | — | z10 | oui | non | 185 632 / 235 695 / 186 255 — inchangés | 76 512 / 26 449 / 75 889 | **0** | **0** |
| Moorea | 11 / 13 / 15 | — | z8 | oui | non | 114 112 / 262 144 / 262 144 — inchangés | 148 032 / 0 / 0 | **0** | **0** |

⛔ **Pixels REMONTÉS : 0 partout. Eau perdue : 0 partout.**
⛔ **L'eau réelle reste en eau** : Camargue, Porquerolles, Bretagne, Moorea,
La Réunion — **identiques à l'unité, aux trois zooms**. C'est la garantie que
VETO avait posée et que je n'ai pas entamée.
⛔ **La terre réelle reste terre** : Rodrigues, La Réunion, Bretagne — **au bit**.

**Et la vérité gênante, qui est dans la dernière colonne : mon correctif change
0 bit sur les 21 tuiles.** Là où il y a des pixels émergés, la côte voit des îles
et s'abstient (par construction) ; là où la côte dit « pleine mer », il n'y avait
déjà rien à corriger. Voir §⑤.

### Le coût, chiffré

| poste | mesuré |
|---|---|
| `merFranche` **à froid**, tuile côtière | 3,4 à **13,2 ms** — et c'est le **MÊME** `fetch` que `vetoTerre`, sur la **même promesse mémoïsée** : le second avis coûte **0** |
| `merFranche` **à froid**, tuile de pleine mer | **0,1 à 0,2 ms** (aucun polygone à charger) |
| `merFranche` / `vetoTerre` **au cache chaud** | **0,000 à 0,1 ms** |
| `fuseBathymetry` sans → avec `merFranche` | 0,8–3,5 ms → 0,8–4,8 ms, soit **l'épaisseur du bruit de mesure** (une comparaison de booléen hissée hors boucle, un test de plus sur une branche déjà prise) |

**Coût de cuisson d'une tuile : inchangé.** Le second avis est une deuxième
lecture d'un objet déjà calculé — pas un second calcul, pas une seconde requête.
**Verdict : acceptable**, et c'est mesuré, pas espéré.

---

## ⑤ ⛔ CE QUE JE LIVRE ALORS QUE ÇA NE CHANGE RIEN À L'IMAGE — ET POURQUOI

Je pourrais retirer le correctif : il vaut 0 bit sur la scène d'Adrien. Je le
garde, et voici les trois raisons, dans l'ordre :

1. **La porte est RÉELLE et elle est la seule qui fabrique de la terre.** 257
   pixels mesurés sur une seule tuile, par un mécanisme entièrement démontré
   (max de la source = 0,00 m exactement, max après cubique = +6,18 m). Elle
   tirera un jour sur un banc submergé qu'OSM ne connaît pas — et ce jour-là,
   sans ce garde, on repartira de zéro.
2. **Elle est verrouillée par deux tests de MUTATION.** `MUTATION — sans
   merFranche, une double absence sort ÉMERGÉE` et `MUTATION — un DÉPASSEMENT DU
   CUBIQUE sort émergé` **gèlent le défaut** : ils passeront au rouge le jour où
   quelqu'un croira l'avoir corrigé ailleurs. C'est ce que VETO avait fait pour
   son propre défaut, et c'est ce qui a de la valeur ici.
3. **Le garde a fait son travail sous mes yeux**, et c'est la meilleure preuve
   que la règle est bien bornée : sur la tuile z8 171/142, le trait de côte
   déclare de la terre (Saint-Brandon EST un archipel émergé) → `merFranche`
   rend **faux** → les 257 pixels sont **laissés intacts**. Une règle qui aurait
   noyé un archipel réel aurait été la faute symétrique de celle que VETO a
   évitée sur le Vaccarès.

⚠️ **Et un garde que le banc m'a imposé, que je signale parce qu'il est le plus
subtil du correctif** : dans `remplirHauteurs`, `merFranche` n'est passé que si
`remplis === total`. Sans lui, un **TROU du quadtree** (nœud jamais écrit, donc
`out = 0`, donc `noData` pour la fusion) était pris pour de la pleine mer et
rendu à l'eau : **429 nœuds noyés**, attrapés d'un coup par
`test/flux-terrain.test.js` « un TROU du relief ne devient PAS une fosse ». Au
pixel, l'absence de RELIEF et l'absence de MESURE sont indiscernables ; le seul
discriminant sûr est global, et c'est la couverture.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ **« Le striage en peigne est fabriqué par `resampleCatmullRom` :
   agrandir une source z4 32 fois produit des bandes. »** — c'est la piste que
   le brief donnait en tête. ➡️ **FAUX, ET À L'ENVERS.** Mesuré sur les mêmes
   tuiles : le pic-à-pic passe de **47,02 / 96,78 m** dans le fichier brut à
   **2,58 / 0,35 m** après un agrandissement ×32. Le Catmull-Rom est un
   passe-bas ; il **efface** le striage. Le striage est dans GEBCO.

2. ⛔ **« Le striage est le bruit d'encodage du `.webp` lossy amplifié par
   l'exagération du relief » (l'hypothèse que le brief donnait comme
   possiblement gagnante).** ➡️ **FAUX, et sur un détail qui change tout : les
   tuiles bathy ne sont PAS du webp.** Ce sont des **PNG sans perte**
   (`src/dem.js:50`, `BATHY_URL`), de pas 1,00 m. Le webp lossy, c'est le
   **terrarium**. J'ai perdu un aller-retour à chercher `.webp` dans
   `public/data/bathy` avant de lire le code — et le premier banc a planté sur
   `InvalidStateError` faute d'avoir vérifié l'extension.

3. ⛔ **« Les plaques rectangulaires sont des tuiles ENTIÈREMENT rendues à la
   terre : `fondMarinTuile` rend `null` quand la bathy manque, et le terrarium
   nu vaut 0 partout, donc toute la tuile passe en terre. »** C'était ma
   meilleure piste, et elle est **mécaniquement juste mais factuellement
   fausse** : la seconde chance du terrarium muet
   (`peindreBathyTuile({plancher: index.zmin})`) rattrape **169 tuiles sur
   169**. Mesuré : **0 tuile sans bathymétrie** au plancher d'index, contre
   **113 sur 169** au plancher normal. Le globe est couvert ; c'est le chemin
   qui n'a pas la seconde chance qui serait exposé.

4. ⛔ **« Le chemin du flux (`demanderBathy`, fenêtre continue) n'a JAMAIS reçu
   la seconde chance du terrarium muet, contrairement à `loadBathyPatch` et
   `fondMarinTuile` : c'est LUI qui peint le crop d'Adrien, donc c'est lui le
   coupable. »** C'est vrai de la lecture du code — `flux-terrain.js:568`
   n'a pas de repli — et **c'est faux du défaut** : mesuré
   (`scripts/b6-flux.mjs`) sur l'emprise réelle du crop, à Rodrigues comme à
   La Réunion, en Bretagne, en Camargue, à Porquerolles et à Moorea :
   **zoom 11, 15 à 24 tuiles, 15 à 24 peintes, 0,0 % de champ non peint.**
   Le crop est petit, il tombe sur les tuiles du plateau de l'île, qui existent.
   **Je n'ai donc PAS ajouté ce repli** : il aurait été une modification non
   motivée par une mesure, sur le chemin d'image, contre l'arbitrage des 796
   coutures. ⚠️ **Mais le trou est réel et je le signale** : il suffit d'une
   emprise plus large pour l'ouvrir (à z9, 53,1 % du champ y resterait non
   peint).

5. ⛔ **« Il y a des plaques de TERRE en pleine mer, il suffit de les
   compter. »** ➡️ Compté : **607 pixels sur 3 604 480 (0,017 %)**, et ils
   portent **56 à 77 m** d'altitude terrarium — des rochers réels. Mon propre
   critère « en pleine mer = le trait de côte ne déclare aucune terre » les
   classait à tort, parce que la grille OSM z6 érodée de 30 m ne voit pas un
   rocher de 60 m de large. **Un critère automatique n'est pas un juge :
   il fallait regarder les altitudes.**

6. ⛔ **« Les barres beiges de `f_003` sont ces pixels-là. »** ➡️ **Non
   tranché, et je le dis.** Les barres d'Adrien sont longues, fines et à bout
   franc ; les 257 pixels de la tuile 171/142 forment une frange autour d'un
   haut-fond de 79 pixels, ce qui est le bon ORDRE mais pas la bonne FORME. Je
   n'ai pas reproduit les barres dans mes propres captures (`.banc/B6/avant/`,
   même cadrage que `f_018`). Elles sont à gauche du socle dans ses images,
   c'est-à-dire dans la zone que `wt-dent` instruit. **Je ne les revendique
   pas.**

7. ⛔ **« Le `--all` du tuileur est une option d'optimisation. »** ➡️ **Non :
   c'est le correctif de fond, il existe déjà, et il n'a jamais été employé sur
   les niveaux grossiers.** Voir §⑦.

---

## ⑦ CE QUI RESTE OUVERT, ET CE QUI L'EMPÊCHERA LA PROCHAINE FOIS

### ⛔ LE CORRECTIF DE FOND N'EST PAS DU CODE, C'EST UNE CUISSON

Le striage visible et les plaques ont **la même cause unique** : le plancher
bathymétrique est troué en plaine abyssale, donc deux tuiles voisines sont
servies par des ancêtres de résolutions qui diffèrent d'un facteur 16.

Le dépôt porte déjà l'outil et l'avertissement :

```
scripts/build-bathy-tiles.mjs:316
// --all : cuire TOUTES les tuiles, sans pré-tri. Sert aux niveaux GROSSIERS,
// qui servent de plancher de repli au chargeur (BATHY_ZMIN dans dem.js) : un
// plancher troué laisse des rectangles plats dans la mer.
```

➡️ **À faire, et ce n'est pas moi qui peux le faire ici** : recuire les niveaux
de plancher **avec `--all`**. Le raster source (`data/gebco`, le `.bin` + `.json`
écrits par `scripts/gebco-to-raw.py`) **n'est pas dans l'arbre**, donc la cuisson
n'est pas lançable depuis cette branche. L'ordre de grandeur, lui, est connu du
tuileur lui-même : le pré-tri fait passer z6–z8 de **55 535 à 19 657 tuiles**,
soit **~1,6 Go au lieu de 576 Mo**. ⚡ **Recuire `--all` sur z4→z6 seulement
suffirait** : ce sont les niveaux de repli, ils pèsent **4 096 + 1 024 + 256 =
5 376 tuiles au maximum**, et cela rendrait le plancher **continu**, donc la
couture **uniforme**. C'est la seule action qui supprime à la fois la marche de
445 m et l'alternance de netteté du peigne.

### CE QUI RESTE OUVERT, DIT HONNÊTEMENT

- **La marche à la couture (445 m) subsiste**, et je ne l'ai pas atténuée. Un
  fondu entre deux tuiles servies à des résolutions différentes est un travail
  de RENDU, pas de fusion ; le faire dans `fuseBathymetry` demanderait une
  opération spatiale dans une boucle par pixel, et surtout de connaître les
  voisins — ce que ce module pur ne connaît pas, par construction. **Je préfère
  le dire que le bricoler.**
- **Le striage de GEBCO restera visible** tant que l'exagération du relief le
  multipliera. Ce n'est pas un défaut à corriger dans le code ; c'est un
  arbitrage de rendu (exagération plus douce en mer profonde), et il n'est pas
  à moi.
- **`demanderBathy` (flux-terrain) n'a toujours pas la seconde chance du
  terrarium muet.** Mesuré inoffensif sur les six emprises de crop testées
  (0,0 % non peint), mesuré dangereux sur une emprise large (53,1 % à z9). Je
  laisse le constat plutôt que le correctif, faute d'un défaut reproduit.

### CE QUI EMPÊCHERA LA PROCHAINE FOIS

1. **La règle B6, livrée ici**, avec ses **deux tests de mutation** qui gèlent le
   défaut et ses **onze gardes** qui interdisent qu'elle s'élargisse.
2. **`merFranche` comme information positive.** `vetoTerre` rendait `null` dans
   trois cas qu'il ne distinguait pas — « aucune terre ici », « hors du monde »,
   « panne réseau ». Le premier est un renseignement, les deux autres une
   abstention. Les confondre, c'est ce qui rendait la pleine mer impossible à
   invoquer sans danger. **Désormais elle est nommée, et elle est fausse par
   défaut.**
3. **Le garde `remplis === total`**, et la leçon qu'il porte : *au pixel,
   l'absence de relief et l'absence de mesure sont indiscernables.*

---

## ⑧ LES CAPTURES POUR ADRIEN

`.banc/B6/avant/` et `.banc/B6/apres/`, cadrage de sa vidéo (Rodrigues,
`gotoCtl.go`, 9 puis 16 crans de molette **arrière**, protocole CHASSE).

- **`avant/rodrigues.png`** — le peigne, franc, quasi superposable à `f_018`.
  **Le défaut est reproduit sur cette branche.**
- **`avant/rodrigues-globe.png`** — ⚡ **la capture la plus lisible du dossier** :
  on y voit la grande **plaque pâle à arête verticale nette** au centre-gauche
  (une zone servie par un ancêtre grossier, donc lisse et plus claire) collée à
  une zone rayée (servie en z8, donc nette et striée). **C'est la plaque
  rectangulaire d'Adrien, et elle est faite de profondeur, pas de terre.**
- **`apres/rodrigues.png`, `apres/rodrigues-globe.png`** — ⛔ **identiques**, et
  c'est attendu : 0 bit changé (§④). Je les fournis pour que la
  non-régression soit visible autant que mesurée.
- **`apres/reunion.png`, `apres/camargue.png`, `apres/bretagne.png`** — les
  témoins. La Réunion : **2 pixels** émergés en zone déclarée mer, à +0,047 m.
  Camargue : **1**. Rien n'a bougé.

---

## ⑨ PIÈGES PAYÉS DANS CETTE SESSION

- ⚠️ **`find public/data/bathy` rend 0** (jonction Windows) — le brief le
  disait, et `find public/data/bathy/8` rend bien **13 891**. Mais le piège utile
  était ailleurs : **compter les fichiers ne dit rien tant qu'on ne les compare
  pas au monde.** 13 891 sur 65 536 tuiles z8, c'est **21 %** — et c'est ce
  rapport-là, pas le compte, qui est le diagnostic.
- ⚠️ **L'extension.** Deux bancs plantés sur `InvalidStateError: The source
  image could not be decoded` parce que j'avais écrit `.webp` : les tuiles bathy
  sont des **`.png`**. Et Vite répond **HTTP 200 `text/html`** sur un chemin
  absent, donc `r.ok` ne protège de rien — il faut **vérifier le
  `content-type`**, sinon on décode la page d'accueil.
- ⚠️ **`--sens`.** `deltaY: −120` **zoome**. La vidéo d'Adrien est une molette
  **arrière**. Mon premier relevé « 0 plaque » a été pris à **112 m
  d'altitude**, c'est-à-dire au ras du sol, sur une scène qui n'a rien à voir.
  **Un relevé au mauvais cadrage ressemble exactement à un relevé propre.**
- ⚠️ **`Float32Array` et les doubles.** Trois tests justes rendus rouges par
  `assert.equal(v, -0.05)` : la sortie vaut `−0,05000000074505806`.
  `Math.fround` partout.
- ⚠️ **Le garde qui manquait, trouvé par un test existant et pas par moi.**
  429 nœuds noyés à la première écriture, attrapés par « un TROU du relief ne
  devient PAS une fosse ». ⚡ **Ce test valait plus que mon raisonnement** —
  c'est l'argument le plus concret pour en écrire de la même famille.
- ⚠️ **Scripts d'édition en binaire** (`python`, `open(...,'rb')` /
  `'wb'`), et `grep -c $'\r'` **= 0** vérifié sur `src/bathy.js`,
  `src/globe.js`, `src/dem.js`, `src/monde/flux-terrain.js`,
  `src/coast-veto.js`, `package.json`. Aucun CR introduit.
