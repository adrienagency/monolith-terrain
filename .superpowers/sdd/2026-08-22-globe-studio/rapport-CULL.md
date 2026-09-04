# RAPPORT CULL — NE CALCULER QUE LE SOCLE, ET BOUCHER LES COUTURES

Branche `bug-hors-crop` (arbre `C:\Dev\wt-cull`). Défauts ④ et ⑤ d'Adrien.

## 0. LES LIGNES QUE JE TOUCHE — pour la fusion à la main

| fichier | ce que je touche |
|---|---|
| `src/globe.js` | `_traverse` (la ligne `zCrop`, ~9179) · `update` (une ligne avant la boucle des racines) · **nouvelle** `_zoomCropEcran` · **nouvelle** `_effacementLateralActif` · `_retaillerJupe` (la ligne `retrait`) · `_rayonPlancherCrop` (une garde de levier) · le constructeur (six leviers débrayables) · un `import { ZOOM_SOCLE }` · une constante `TOLERANCE_BLOC` |
| `src/monde/parois-crop.js` | `jupeHorsDuMur` et `jupesEffacees` gagnent des paramètres **optionnels de banc** (défauts inchangés) · un encart dans `rabattementBorne` (aucun changement de code) |
| `package.json` | `test/crop-emprise-ecran.test.js` inscrit à la liste explicite |
| neufs | `test/crop-emprise-ecran.test.js`, `scripts/sonde-cull.mjs`, `scripts/diag-cull.mjs`, `scripts/lit-cull.mjs` |

**Rien dans le nuanceur, rien dans la caméra, rien dans la mer, rien dans le
fondu de transition.** `wt-mix` et `wt-mer` ne me croisent pas.

## 1. LE BANC

Chrome sans tête (`--headless=new`, `--use-angle=default`), 1280×720,
pixelRatio 1, `vite` de dev sur **127.0.0.1:8137**, **CPU ×4**
(`Emulation.setCPUThrottlingRate`), réseau compté au protocole CDP. Trois lieux :
**Majorque** (39,62 / 2,98 — le lieu des captures d'Adrien), **Bretagne**
(48,38 / −4,49 — une côte très découpée), **Alpes** (45,92 / 6,87 — du relief).
Geste : `modes.flyTo`, altitude posée au bouton vers 900 km, file vidée, puis
**rafale de molette (40 ms) jusqu'à 20 km**, puis **20 images consécutives au
repos**. Traces : `.banc/CULL/*.json` (ignoré par git).

**Ce que la sonde relève, DANS `update()`** (jamais après — §3 de
`/threejs-optimisation`) :

- **l'emprise** : sur tout le cache, à chaque image, les entrées dont l'emprise
  **ne recoupe pas** celle du crop — `tuileDansCrop`, **la fonction du produit,
  importée du module**, pas une recopie — séparées en *en cache*, *maillées*,
  *dessinées* ; et les tuiles **parcourues** hors emprise, comptées dans
  `_dansLeChamp`, au moment de la décision ;
- **les trous, en PIXELS** : le seul groupe du globe (tuiles + parois, tout le
  reste masqué) est rendu dans une cible hors écran **sur un fond magenta**,
  puis on remplit depuis le bord de l'image ; **le magenta qui survit au
  remplissage est du fond ENCLAVÉ par le terrain** — du ciel vu à travers la
  planète. La mesure ne dépend d'aucune couleur du terrain : le fond est posé
  par la sonde, et le critère est la **connexité au bord**, pas une teinte.
- **la netteté du crop** : grille 48 × 27 d'écran, points dont la tuile de
  `ZOOM_SOCLE` tombe dans l'emprise ; le crop est net quand tous sont dessinés
  au zoom prescrit et n'en redescendent plus.

⚠️ **DEUX FAUX ZÉROS PAYÉS AVANT LE PREMIER CHIFFRE, et ils valent d'être
écrits.** ① La première version de la mesure de trous **reparentait** le groupe
du globe dans une scène neuve : il y perdait la transformation de son parent, et
la sonde rendait « 921 600 pixels de fond », c'est-à-dire une image VIDE qu'on
aurait lue « zéro trou ». ② La seconde rendait la scène du produit — mais avec
`__exp.camera`, la caméra du BLOC, quand le globe est rendu par `camGlobe` dans
`sceneGlobe` : même image vide, même faux zéro. C'est le §3 de la compétence,
« prouver d'abord qu'on regarde quelque chose », deux fois de suite.

## 2. CE QUE J'AI TROUVÉ — les deux défauts n'en font qu'un

⚡ **L'EMPRISE DU CROP N'EST PAS LE SOCLE.** `assietteCrop` (`main.js`) déduit le
`zoom` du repère de l'emprise **RÉELLE du bloc courant**
(`zoom = log2(360 · 3 / large)`), et le bloc suit `params.demZoom`, qui traîne
cinq niveaux derrière la caméra. Relevé dans l'application
(`scripts/diag-cull.mjs`, Majorque, descente au bouton) :

| altitude caméra | `demZoom` | largeur du crop | largeur du socle |
|---|---|---|---|
| 389 km | 4 | **6 376 km** | 10,4 km |
| 292 km | 5 | 3 016 km | 10,4 km |
| 139 km | 6 | 1 464 km | 10,4 km |
| 66 km | 7 | 720 km | 10,4 km |
| 30 km | 8 | 363 km | 10,4 km |
| 15 km | 9 | 181 km | 10,4 km |

**Les deux défauts d'Adrien sont deux conséquences de cette seule grandeur :**

- **⑤** — `zoomCropPrescrit` était appelé **sans son cinquième argument**, donc
  avec son défaut `ZOOM_SOCLE = 13` : le parcours réclamait **z13 sur 6 376 km**,
  soit plus de 25 000 tuiles, pour un écran qui en montre quelques dizaines.
- **④** — l'effacement latéral des jupes (Tâche P14) efface une **bande en
  fraction du demi-côté** ; sur 6 376 km cette bande fait des dizaines de
  kilomètres et **traverse l'écran**, là où aucun mur ne couvre la couture.

## 3. LE TROU, NOMMÉ — une expérience, pas une lecture

Majorque, CPU ×4, descente 900 → 20 km, ~50 images par tirage, **un seul levier
changé à la fois**, pixels de fond ENCLAVÉS par le terrain :

| tirage | ce qui change | trous max | moyenne | composantes | parents partiels |
|---|---|---|---|---|---|
| A1 | le dépôt | **66 px** | 13,0 | 31 | 53 |
| A2 | raffinement partiel de R37 **débrayé** | 36 px | 6,6 | 30 | **0** |
| A5 | bornage en hauteur levé (`rabattementBorne`) | 58 px | 13,2 | 26 | 62 |
| A7 | dilatation d'un cran retirée | 75 px | 12,9 | 34 | 60 |
| A8 | bande d'effacement réduite au dehors | 63 px | 16,5 | 38 | 68 |
| **A6** | **effacement latéral débrayé** | **0 px** | **0** | **0** | 55 |
| A4 | jupes rendues pleines (les deux bornes) | **0 px** | 0 | 0 | 70 |

➡️ **Le trou est un défaut de JUPE : l'effacement latéral de la Tâche P14,
appliqué hors de son domaine.** Ce n'est **pas** une régression du raffinement
partiel de R37 — le débrayer laisse 36 px — mais R37 **double** le défaut
(36 → 66 px) parce qu'il multiplie les coutures entre niveaux voisins. Ce n'est
pas non plus une fissure en T ordinaire : les jupes sont là, on les efface.

**Où :** les trous vivent **au-dessus de 177 km** et tombent à zéro en dessous —
la signature exacte d'une emprise qui rétrécit. Sur la capture marquée
(`.banc/CULL/A3-png-vol.png`, les enclaves peintes en vert), ils s'alignent sur
des coutures de tuiles, en mer, par paquets de 2 à 20 px.

⛔ **ET P14 N'AVAIT PAS TORT — elle était appliquée là où elle n'avait pas
mesuré.** Son banc est le bloc (La Réunion, socle de 3 tuiles z13, ~10 km), où
le mur rentré du chanfrein laisse dépasser des langues de jupe. Le correctif ne
lui retire rien : il **rend l'effacement à son domaine**
(`_effacementLateralActif`), c'est-à-dire aux emprises de l'ordre du socle. Au
bloc, pas un bit ne change ; au-dessus, la jupe reprend son service anti-fente.

⚠️ **Et ce correctif-là ne suffit PAS à rendre zéro — voir le §7, qui dit
exactement ce que je peux signer et ce que je ne peux pas.**

## 4. L'ORDRE DES CORRECTIFS — l'emprise d'abord, et le budget jamais

Le socle du chantier le dit et le brief le répète : desserrer un budget avant
d'avoir réduit ce qui entre donne ×14 sur les requêtes. **Je n'ai pas touché au
budget** : ni `CACHE_MAX_CONTINU`, ni `PLAFOND_FILE`, ni `MAX_CONCURRENT`, ni le
crédit. Les deux correctifs réduisent **l'emprise de ce qui est calculé**, et la
mesure du §5 dit que le second correctif de budget n'a pas lieu d'être.

⚡ **La preuve que le budget n'était PAS la cause** : au départ du tirage de
référence, le cache est à **1 700 / 1 700**, `_credit` à **3**, la file à
**256** (`PLAFOND_FILE`) — les trois marqueurs de saturation ensemble, à 780 km
d'altitude, **avant même le premier cran de molette**. « Un budget à zéro est le
marqueur du plafond, pas sa cause. » Après le correctif d'emprise, le même
départ tient le cache à **499 tuiles** à la naissance du crop (Majorque), et le
cache maximum de la descente n'atteint plus le plafond sur aucun des trois lieux.

## 5. LE CRITÈRE — CPU ×4, session neuve, 3 lieux, 20 images de repos

Descente 900 km → 20 km, molette à 40 ms, **CPU ×4**, un tirage par case, paires
`avant` / `après` prises dans la même campagne. `avant` = les deux leviers
débrayés (`cropZoomEcran = false`, `jupeDomaine = false`), c'est-à-dire le dépôt.

| grandeur | Majorque avant | **après** | Bretagne avant | **après** | Alpes avant | **après** |
|---|---|---|---|---|---|---|
| **tuiles PARCOURUES par image, p50** | 1 678 | **541** | 1 371 | **381** | 2 150 | **729** |
| tuiles maillées **hors emprise du socle**, p50 — voir la lecture | 137 | 319 | 295 | 410 | 153 | 344 |
| tuiles **dessinées hors emprise**, max | 25 | **19** | 24 | **6** | 44 | **12** |
| parcourues hors emprise, p50 | 0 | 0 | 0 | 0 | 6 | **0** |
| **cache à la naissance du crop** | 1 470 | **499** | 1 367 | **931** | 1 440 | **499** |
| **cache max** (plafond dur 1 700) | 1 470 | **897** | 1 371 | 1 143 | 1 570 | **1 129** |
| **ms/image p50 / p99** | 87 / 1 374 | **71** / 1 439 | 92 / 1 283 | **89** / 1 151 | 115 / 1 194 | **51 / 737** |
| **`_traverse` p50 / p99 (ms)** | 6,3 / 20,7 | **2,9** / 22,6 | 7,4 / 14,4 | **3,0 / 9,6** | 7,9 / 41 | **3,3 / 7,9** |
| `update` p50 / p99 (ms) | 7,8 / 21,5 | **3,9** / 32,3 | 9,1 / 19,6 | **4,2 / 13,7** | 9,9 / 47 | **4,3 / 11,2** |
| parents partiels max (R37) | 68 | 15 | 67 | 17 | 63 | 16 |
| **trous en vol** — px de fond enclavé, max / moyenne | 51 / 7,4 | **0 / 0** | 44 / 8,6 | **33 / 5,9** | 27 / 3,4 | **17 / 1,3** |
| trous **au repos**, 20 images consécutives | 0 | **0** | 0 | **0** | 0 | **0** |
| requêtes par descente | 266 | 750 | 447 | **331** | 305 | 758 |
| **temps jusqu'au crop entièrement net** (ms après l'arrêt) | 0 | 23 248 | 0 | 30 248 | 0 | 33 578 |
| calme après l'arrêt (ms) | 8 770 | 51 809 | 36 240 | 45 997 | 13 716 | 44 671 |

⚠️ **La ligne « maillées hors emprise » MONTE, et ce n'est pas une régression :
c'est un changement de dénominateur.** Le « hors emprise » est mesuré contre
l'emprise du crop AU MOMENT DU RELEVÉ ; comme le correctif fait tomber le nombre
total de tuiles du crop (le cache passe de 1 470 à 499 à la naissance), les
tuiles héritées des altitudes précédentes pèsent plus lourd dans un cache plus
petit. La grandeur qui répond à Adrien sans ambiguïté est la ligne au-dessus :
**dessinées hors emprise, 25 / 24 / 44 → 19 / 6 / 12 au pire, et 0 au p50 partout
avant comme après.** Ce qui est hors du socle n'a jamais été DESSINÉ ; il était
parcouru, demandé, maillé et gardé en cache — le mot d'Adrien exactement.

### Ce qui baisse, et de combien

**Le calcul, sur les trois lieux, sans exception** : les tuiles parcourues par
image tombent de **1 678 → 541**, **1 371 → 381**, **2 150 → 729** (÷3,1 à ÷3,6) ;
`_traverse` de **6,3 → 2,9**, **7,4 → 3,0**, **7,9 → 3,3 ms** ; `update` de
**7,8 → 3,9**, **9,1 → 4,2**, **9,9 → 4,3 ms** ; les ms par image de **87 → 71**,
**92 → 89**, **115 → 51**. Le cache à la naissance du crop passe de
**1 470 / 1 367 / 1 440** à **499 / 931 / 499**, et **le cache maximum n'atteint
plus le plafond** sur aucun lieu.

### ⛔ CE QUI MONTE, ET IL FAUT LE DIRE

**Le temps jusqu'au crop entièrement net monte, de 0 à 23–34 s**, et le calme
de 9–36 s à 46–52 s. Ce n'est pas un artefact de mesure, et l'explication est la
même que le gain :

> **Avant, la descente PRÉCHARGEAIT z13 depuis 900 km.** Quand la molette
> s'arrête à 20 km, tout est déjà en cache : le crop est net « en 0 ms ». Le prix
> de ce préchargement est écrit dans la colonne d'à côté — cache à 1 470 / 1 700,
> `_credit` à 3, file à `PLAFOND_FILE`, 6 à 8 ms de parcours par image pendant
> toute la chute. Après, le crop ne demande z13 qu'en arrivant, et le paie à
> l'arrivée.

➡️ **Sur CE geste-là — une descente ininterrompue de 900 km à 20 km — le dépôt
gagne sur le temps d'arrivée.** Sur le geste d'Adrien — s'arrêter et REGARDER à
une altitude continentale — le dépôt ne finit jamais : il réclame 25 000 tuiles
pour un cache de 1 700. Les deux chiffres sont vrais ; **c'est un arbitrage de
produit, et je ne le tranche pas seul.** La marge d'un niveau (`MARGE_CROP`) est
déjà un pas dans ce sens : sans elle l'arrivée se posait à **z12** au lieu de
z13 — plus rapide, plus grossière, et personne ne l'avait demandé.

## 6. LA PART DE ⑤ QUI APPARTIENT À z7, ET CELLE QUI SURVIT À z10

`SEUIL_NAISSANCE_M` posé localement à **50 000 m** (le palier z10 de
`DIVE_TIERS`), Majorque, CPU ×4, même geste, mêmes leviers. Le seuil est relu
dans la page à chaque tirage et journalisé : `{"naissanceM":50000}`.

| grandeur | z7 avant | z7 après | **z10 avant** | **z10 après** |
|---|---|---|---|---|
| tuiles parcourues p50 | 1 678 | 541 | **780** | **627** |
| cache à la naissance | 1 470 | 499 | **719** | **673** |
| cache max | 1 470 | 897 | **1 095** | **991** |
| `_traverse` p50 (ms) | 6,3 | 2,9 | **3,0** | **2,4** |
| `update` p50 (ms) | 7,8 | 3,9 | **3,9** | **3,2** |
| ms/image p50 | 87 | 71 | **63** | **54** |
| requêtes par descente | 266 | 750 | **915** | **840** |
| trous en vol max / moyenne | 51 / 7,4 | 0 / 0 | **29 / 3,5** | **41 / 8,4** |

**Lecture — c'est la question du brief :**

- **La plus grosse part de ⑤ appartient à z7 et part toute seule avec D23** : à
  code inchangé, le seul passage de z7 à z10 fait tomber les tuiles parcourues de
  **1 678 à 780** et `_traverse` de **6,3 à 3,0 ms** — plus de la moitié du
  défaut, sans une ligne. `wt-z10` emporte l'essentiel.
- **Ce qui SURVIT à z10 est réel, et c'est mon sujet** : à z10, le correctif rend
  encore **780 → 627** tuiles parcourues (−20 %), **3,0 → 2,4 ms** de parcours
  (−20 %), **1 095 → 991** de cache et **63 → 54 ms** par image. La cause est la
  même : à 50 km, `demZoom` vaut 10, donc l'emprise fait encore **90 à 180 km**
  et z13 y était prescrit sur toute sa surface.
- ⚡ **④ ne doit RIEN au seuil** : les trous sont là à z10 comme à z7 (29 px
  contre 51). Le revert de `wt-z10` ne les touchera pas.

## 7. LES TROUS : CE QUE JE PEUX SIGNER, ET CE QUE JE NE PEUX PAS

**Établi et reproduit** : la cause est l'effacement latéral des jupes. Deux
tirages indépendants où il est débrayé (`A4`, `A6`) rendent **exactement 0
pixel** sur 51 et 50 images, avec 70 et 55 parents partiels à l'écran ; **tous**
les autres leviers laissent 27 à 75 px.

**Ce que je ne peux PAS signer** : que le correctif de DOMAINE
(`_effacementLateralActif`) les ferme. Les trois lieux donnent **0 / 33 / 17 px**
contre **51 / 44 / 27** avant — une baisse sur les trois, mais pas un zéro ; et
un second tirage du même code a rendu **31** à Majorque là où le premier rendait
**0**. **La dispersion d'un tirage à l'autre est du même ordre que l'effet.** Le
critère « 0 trou sur 20 images et 3 lieux » est donc atteint **au repos** (0
partout, avant comme après) et **PAS en vol**.

⚠️ **Et une variante a été mesurée PIRE** : surveiller la bascule du domaine à
chaque image, au lieu d'une fois par pose de crop, et retailler les jupes en
plein vol rend **31 · 57 · 30 px** contre **0 · 33 · 17**. La repasse traverse
des images. Elle est écartée, et la raison est écrite dans `poserCrop`.

➡️ **Ce qui fermerait vraiment ④, et pourquoi je ne l'ai pas expédié.** Le seul
levier qui rend zéro est « ne pas effacer du tout », et il **rouvre les langues
de jupe que P14 a fermées** (23 traînées → 9, mesurées à La Réunion). Échanger un
défaut nommé par Adrien contre un autre défaut nommé par Adrien **sans mesurer le
second** est exactement ce que ce chantier punit. La vraie réparation est plus
haut : **la surface du crop s'arrête à `q = 1` (le `discard` du nuanceur) pendant
que le mur, lui, est rentré de `chanfrein`.** Il y a donc une lèvre de terrain
qui surplombe le vide, et on choisit aujourd'hui entre la voir dépasser (la
langue) et voir à travers (le trou). Faire coïncider la frontière de découpe et
la face du mur supprime le choix. C'est le nuanceur du crop et les parois : **le
terrain de `wt-mix` et de P13/P14, pas le mien.**

## 8. LES TESTS

- `test/crop-emprise-ecran.test.js`, **5 tests**, inscrit dans la liste explicite
  de `package.json` (`npm run audit:tests` : **262 listés · 262 sur disque, aucun
  écart**) : ① le plafond d'écran balayé sur sept altitudes (pas un point : le §2
  de la compétence) ; ② **à 900 km, un crop de 6 376 km ne se fait pas mailler à
  z13**, avec la mutation DANS le test (levier débrayé → le parcours descend plus
  bas) ; ③ l'uniformité de la prescription ; ④ la borne ne fait naître ni tuile ni
  requête ; ⑤ le domaine de l'effacement latéral, sur les emprises mesurées.
- **Mutations vérifiées** : `cropZoomEcran = false` fait rougir ② et ③ ;
  `TOLERANCE_BLOC = 12` fait rougir ⑤. ① et ④ sont des gardes, pas des preuves —
  c'est dit dans le fichier.
- **`npm test` : 4 874 tests · 4 874 réussis · 0 échec** (base 4 869 + 5).


## 9. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Les trous sont une régression de R37 »** — l'hypothèse de tête du brief.
   Débrayer le raffinement partiel laisse **36 px** de trou sur 30 composantes :
   le défaut lui préexiste. R37 le double, il ne le crée pas.
2. **« C'est le bornage en hauteur des jupes (`rabattementBorne`) »** — le
   `Math.max(0, …)` replie à zéro la jupe d'un sommet déjà sous le plancher, et
   l'encart de P7 dit lui-même que c'est le cas de **168 tuiles sur 168**.
   J'avais écrit le correctif ; mesuré, il ne change **rien** (58 px contre 66,
   13,2 de moyenne contre 13,0 — dans le bruit). **Correctif retiré**, l'encart
   de la réfutation laissé dans `parois-crop.js` pour que personne ne le
   réécrive.
3. **« C'est la dilatation d'un cran de P14 »** — la retirer donne **75 px**,
   c'est-à-dire rien du tout (ou légèrement pire).
4. **« Il suffit de n'effacer que ce qui est STRICTEMENT dehors »** — la bande
   ramenée à `[1 ; 1+retrait]` rend **63 px**. Ce n'est pas la largeur de la
   bande qui compte, c'est qu'on efface **au bord d'une emprise que plus aucun
   mur ne borde**.
5. **« Le crop prescrit z13 parce que le socle est à z13 »** — non : il prescrit
   z13 parce que `zoomCropPrescrit` a un défaut de paramètre. Le socle, lui, est
   à `demZoom`, qui vaut 4 à 389 km.
6. **« On peut prescrire `rep.zoom` (la finesse du bloc) »** — première idée,
   abandonnée avant la mesure : à `demZoom = 4`, cela rendrait **z4** sur tout
   l'écran, c'est-à-dire une tuile de 2 500 km pour un écran de 600 km. Ce n'est
   pas ce que l'écran demande ; c'est l'autre extrême du même défaut.
7. **« Le repos montre les trous »** — sur les 20 images de repos, à tous les
   lieux, **zéro pixel de fond enclavé, avant comme après** : au repos le crop
   remplit l'écran de bord à bord, il n'y a pas un pixel de fond à voir. Les
   trous sont un défaut **de vol**, et c'est pour ça qu'ils sont mesurés en vol.
8. **« La suite de tests borde le défaut »** — je l'ai relue avant de corriger,
   comme le brief l'exige. Elle ne le borde pas : **elle l'ignore**. `npm test`
   rendait 4 869 · 0 **avec et sans** le correctif ⑤. Le seul verrou existant
   est `crop-parois.test.js` ⑤ (`rabattementBorne(0.1, 99.9, 100.0) === 0`), qui
   décrit bien la jupe repliée comme un contrat — mais la mesure a dédouané
   cette ligne (point 2), donc elle reste.

## 10. CE QUI RESTE

- **Le vrai fond des deux défauts n'est pas corrigé** : l'emprise du crop reste
  la fenêtre du bloc, jusqu'à 6 376 km de large. Les deux correctifs la rendent
  inoffensive (on ne maille plus à z13 dedans, on n'y efface plus les jupes),
  mais la grandeur elle-même vit dans `assietteCrop` (`main.js`) et pas chez
  moi. **Tant qu'elle vaut 6 376 km, tout ce qui la lit doit se demander si son
  réglage a été mesuré à cette échelle-là.** C'est la question à poser à chaque
  lecteur de `_crop.demi`.
- **Les langues de jupe de P14 au bloc** ne sont pas re-mesurées ici : le
  correctif ④ ne touche pas leur domaine, donc il ne peut pas les rouvrir — mais
  personne n'a rejoué leur banc depuis.
- **`jupesEffacees` et `jupeHorsDuMur`** portent maintenant des paramètres
  optionnels qui n'ont d'usage qu'au banc. Ils sont neutres par défaut.
