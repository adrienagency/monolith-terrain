# RAPPORT PLAT — LES CARRÉS PLATS ET LE CARRÉ BLANC DANS L'EAU

**Arbre** `C:\Dev\wt-plat` · branche `bug-carres-plats` · serveur `127.0.0.1:8231`.
`npm test` **4 879 · 0 échec** (4 869 avant + 10 nouveaux) · `audit:tests`
**262 = 262**. Bancs : `scripts/plat-champs.mjs`, `plat-vue.mjs`,
`plat-sonde.mjs`, `plat-niveaux.mjs`, `plat-dalles.mjs`. Relevés et captures :
`.banc/PLAT/`.

> ⚠️ **CE RAPPORT DIT AUSSI CE QUI N'EST PAS CORRIGÉ.** Le défaut est nommé,
> mesuré, et une partie est réparée avec ses chiffres. **La Camargue montre
> encore ses carrés à l'écran.** Le §⑥ dit pourquoi, et ce qu'il faut pour les
> finir. Ne pas lire ce rapport comme « c'est fait ».

---

## ① LE « PROBLÈME DE FOND », NOMMÉ

Adrien : *« ça n'est pas la première fois que ça arrive, il doit y avoir un
problème de fond »*. Il a raison, et le voici en une phrase :

> **Le module de fusion laisse une source GROSSIÈRE décider du trait de côte
> contre une source FINE, et rien dans le code ne compare jamais leurs
> échelles.**

Toutes les réparations empilées depuis un an — les aplats de remplissage
(La Ciotat), la bande de bruit (B5, Porquerolles), le repli AWS des dalles vides
(les Canaries) — ont la même forme : *« quand le relief de référence a l'air
muet, on donne le pixel à la source fine »*. Aucune ne vérifie que la source
dite fine est **réellement plus fine ICI**. Elle ne l'est pas toujours :

| lieu / zoom | maille de la source | pas du champ | rapport |
|---|---|---|---|
| Porquerolles z13 | EMODnet 111,8 m | 6,99 m | **16** |
| Camargue z13 | EMODnet 111,8 m | 6,94 m | **16** |
| Bretagne z15 | EMODnet 101 m | 1,58 m | **64** |
| **Camargue z17** | **EMODnet 111,8 m** | **0,433 m** | **258** |
| Porquerolles z17 | EMODnet 111,8 m | 0,434 m | **258** |
| fjord de Bergen z15 | GEBCO 302 m | 1,18 m | **518** |

Une cellule EMODnet couvre alors **256 pixels du bloc**. Elle ne peut placer un
rivage qu'à 111 m près. Quand on lui laisse la décision terre/mer, elle dessine
**exactement ce qu'Adrien voit** : des rectangles à angles droits de la taille
d'une cellule, et, là où une cellule reste au-dessus du seuil, **un carré resté
émergé au milieu de l'eau**.

C'est pour ça que ça revient : chaque correctif précédent a élargi l'autorité de
la source marine sans jamais borner son échelle.

---

## ② LA MESURE — CE QUI SE PASSE EN CAMARGUE

`scripts/plat-champs.mjs` rejoue les trois champs (terrarium brut, bathymétrie
fine, fusion) sur l'emprise réelle, avec les vraies tuiles.

**Camargue, 43,45 / 4,60, bloc z17 (0,433 m/px) :**

- **le terrarium est irréprochable** — `.banc/PLAT/avant/camargue-land.png` :
  marais IGN à **+0,09 … +2,16 m**, texturé (47 à 72 valeurs distinctes par
  tuile), une digue nette, une lagune réelle. **Aucun rectangle, aucun plateau.**
- **la fusion le détruit** — `.banc/PLAT/avant/camargue-avant.png` :
  **728 813 pixels de terre franche (31 % du bloc)** rendus à la mer, en blocs
  rectangulaires alignés sur la grille EMODnet, avec **un carré resté émergé au
  milieu**.
- **le coupable est nommé** : `detectNoiseFill` rend `true`, EMODnet réclame
  **−2,00 à −2,26 m** sur tout le champ (elle ne connaît pas le delta du Rhône),
  et la bande de bruit de B5 (`NOISE_BAND = 0,6`) déclare « absence de mesure »
  un marais à +0,13 m. Le garde `NOISE_MIN_DEPTH = 2` est franchi d'un cheveu :
  **médiane des profondeurs réclamées = −2,04 m, p95 = −2,00 m.**

Comparaison sur six lieux (`basculesTerreFranche` = pixels de terre franche,
hors aplat et hors zéro, rendus à la mer) :

| lieu | rapport | avant | après | rendus à la terre | changés dans l'autre sens |
|---|---|---|---|---|---|
| Porquerolles z13 | 16 | 302 227 | **302 227** | 0 | **0** |
| Camargue z13 | 16 | 222 608 | **222 608** | 0 | **0** |
| Bretagne z15 | 64 | 10 | 0 | 10 | 0 |
| **Camargue z17** | 258 | **728 813** | **0** | **728 813** | **0** |
| Porquerolles z17 | 258 | 16 029 | **0** | 16 029 | 0 |
| fjord Bergen z15 | 518 | 9 889 | **0** | 9 889 | 314 |
| Moorea z15 | 256 | 0 | 0 | 0 | 0 |

⛔ **Les deux lieux z13 — ceux où B5 est prouvée nécessaire — sont IDENTIQUES,
au bit.** C'est la garantie « le relief des tuiles déjà correctes reste
inchangé », mesurée et pas espérée.

---

## ③ LA VOIE CHOISIE : **C**, ET LE CHIFFRE QUI TRANCHE

Le brief proposait A (ne pas boucher), B (boucher avec une source d'échelle
voisine), C (lisser le raccord). **Aucune des trois n'était la bonne, parce que
la prémisse du brief était fausse** (voir §⑤). La question réelle n'était pas
« avec quoi boucher », c'était **« qui a le droit de décider »**.

La voie retenue est **une variante de C, et elle se dit en une ligne** :

> **RÈGLE D'ÉCHELLE.** Au-delà de `CELLULE_MAX_PX = 32` pixels de champ par
> cellule de source, la source bathymétrique perd le droit de **RECLASSER de la
> terre en mer**. Elle garde tout le reste : elle creuse la mer, applique la
> nappe et la bande de fondu **exactement comme avant, au bit**.

Le seuil vient de la mesure, pas du goût. La frontière entre le bon et le
mauvais est entre **16** (Porquerolles/Camargue z13, corrects) et **64**
(Bretagne z15, déjà 10 pixels fautifs). **32** est le milieu géométrique, avec
un facteur 2 de marge des deux côtés.

Ce n'est **pas** B : reboucher avec EMODnet là où elle est 258 fois trop
grossière ne fait que remplacer un carré ETOPO1 par un carré EMODnet. Ce n'est
pas A non plus : on ne retire rien, on **rend le pixel à la donnée la plus fine
qui existe** — le terrarium IGN à 1 m.

**Le code :** `bandeBruitAdmise(resolutionSourceM, metersPerPixel)` et
`resolutionBathyM(z, lat)` dans `src/bathy.js`, câblés aux **trois** sites de
fusion : `src/dem.js` (le damier), `src/monde/flux-terrain.js` (la fenêtre
continue), `src/globe.js:fondMarinTuile` (les tuiles du quadtree).

⚠️ **Une entrée non mesurable rend `NOISE_BAND`** : un appelant qui ne sait pas
dire son échelle garde le comportement d'avant, au bit. C'est testé.

---

## ④ LES REQUÊTES AWS — CHIFFRÉES, ET LE CONSTAT DE CHASSE **RÉFUTÉ**

CHASSE (bug 7) : *« 278 requêtes vers s3.amazonaws.com pour une seule vue. C'est
la réparation “dalle vide” de `dem.js:425` qui part en masse »*. Il le donnait
lui-même comme une hypothèse non instrumentée. **Elle est fausse.**

`scripts/plat-vue.mjs` intercepte `window.fetch` et prend la **pile d'appel**
avant tout `await`, donc dans la fonction qui lance la requête :

| | avant | après |
|---|---|---|
| réponses `s3.amazonaws.com` (vue Camargue, 30 crans) | **286** | 287 |
| requêtes AWS attribuées | **242** | 244 |
| … dont `globe.js:3392` (`tileBitmap`) | **242 — 100 %** | 244 — 100 % |
| … dont `src/dem.js` (la réparation « dalle vide ») | **0** | 0 |

**La réparation de `dem.js:425` ne lance pas 278 requêtes : elle en lance ZÉRO
sur cette vue.** Mesuré aussi bloc par bloc (`plat-dalles.mjs`) : **1 requête**
au total à z8 et à z10, **0** à z12, z13, z15. Les 242 requêtes sont le
chargement normal des tuiles de mer du globe (`planTuile` → `surAws` pour les
tuiles hors couverture Mapterhorn), c'est-à-dire le fonctionnement prévu.

➡️ **Il n'y a donc rien à optimiser là, et j'ai délibérément NE RIEN touché au
repli AWS.** Le corriger « pour le budget réseau » aurait été corriger un
chiffre qui n'existe pas, au risque du relief déjà correct.

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le défaut vient du repli ETOPO1 de `dem.js:425` : il rebouche à 1 km dans
   un bloc à 1,75 m, facteur 570. »** — c'est la thèse du brief et de CHASSE.
   ➡️ **FAUX sur la Camargue.** `slotIsBlank` ne déclenche jamais ici : les
   tuiles Mapterhorn de Camargue sont **pleines** (+0,09 … +2,16 m, 41 Ko de
   WebP). Zéro requête AWS depuis `dem.js`, zéro dalle rebouchée. Le facteur 570
   existe bel et bien — mais il vaut **258** et il vient d'**EMODnet z10 par la
   bande de bruit de B5**, pas d'ETOPO1 par AWS.

2. **« Les rectangles sont les salins de Camargue, ils sont réels. »**
   ➡️ **FAUX, et vérifié par extinction.** En coupant TOUTE la bathymétrie
   (`fondMarinTuile` neutralisée), l'eau disparaît **entièrement** du bloc —
   y compris les rectangles (`.banc/PLAT/apres/camargue-sans-bathy.png`). Et le
   masque des pixels muets du terrarium à z15
   (`.banc/PLAT/apres/cam15-muets.png`) montre les contours **organiques** du
   Vaccarès, **sans un seul angle droit**. Les rectangles sont fabriqués.

3. **« Le carré blanc est une valeur sentinelle prise pour une altitude
   (`sMuet`, `NODATA_EPS`, `bruitZero`). »** ➡️ **FAUX.** C'est plus banal et
   plus grave : c'est **une cellule EMODnet dont le terrarium local dépasse la
   bande de 0,6 m** pendant que ses quatre voisines sont dessous. Deux cellules
   voisines, un seuil, deux couleurs. Rejoué en test synthétique
   (`test/bathy-echelle-plat.test.js`, « le carré blanc dans l'eau »).

4. **« Le défaut vient du mélange des deux sources d'altitude (Mapterhorn +0,13 m
   contre AWS −1,5 m sur le même marais), recollées tuile par tuile. »**
   ➡️ **Le désaccord est RÉEL et documenté ici** (`plat-niveaux.mjs`) : au même
   point, Mapterhorn rend **+0,13 à +0,16 m à tous les niveaux z8→z17**, AWS rend
   **−2,00 / −1,46 / −2,10 m** à z8/z9/z10 puis **0,000 m pile partout** à z14 et
   z15 (dalle vide à HTTP 200). **Mais ce n'est pas la cause des carrés vus** :
   les tuiles réellement servies au crop de Camargue sont **toutes Mapterhorn**
   (mesuré, `t.size === 512` sur les 25 tuiles). Je laisse le relevé au dossier
   parce que c'est une **bombe à retardement** pour tout littoral où les deux
   sources se croisent — mais je ne l'ai pas vue exploser ici.

5. **« Corriger `src/dem.js` suffit : c'est lui qui fait le bloc. »**
   ➡️ **FAUX, et c'est le piège le plus coûteux de la session.** Après le
   correctif de `dem.js`, la Camargue à l'écran était **inchangée**. Le crop ne
   relit pas `loadDem` : il échantillonne les tuiles du quadtree, **déjà
   fusionnées par `globe.js:fondMarinTuile`**. Mesuré : tuile z15 brute = −0,27 m
   et 0,6 % sous zéro ; la **même** tuile sortie de `fondMarinTuile` = −8,26 m et
   **19 à 49 % sous zéro**. Il y a **trois** sites de fusion, pas un.

6. **« Un remplissage de mer a toujours du bruit des deux côtés du zéro : exiger
   quelques pixels négatifs distinguerait le marais du remplissage. »**
   ➡️ **RÉFUTÉ AVANT D'ÊTRE ÉCRIT**, par `test/bathy-platier-b5.test.js` : le
   relevé de Porquerolles est un remplissage **entièrement positif**
   (+0,2 … +0,5). Le garde aurait cassé B5. Non implémenté.

---

## ⑥ ⛔ CE QUI N'EST **PAS** CORRIGÉ, ET POURQUOI

**À l'écran, la Camargue montre encore ses carrés et son carré blanc**
(`.banc/PLAT/apres/camargue.png`). Le critère « carrés plats visibles = 0 »
**n'est pas atteint**. Voici exactement où ça bloque, mesuré.

Le crop est peint par `fondMarinTuile`, **tuile par tuile**. Instrumenté sur la
vue de Camargue, en comptant les pixels que chaque tuile fait passer de terre à
mer :

```
tuile z11 px256  bande=0,6   av=0       ap=65 536    basculés=65 536  /65 536   ← 100 %
tuile z12 px512  bande=0,6   av=0       ap=262 144   basculés=262 144 /262 144  ← 100 %
tuile z13 px512  bande=0,6   av=5 687   ap=43 713    basculés=38 026  /262 144
tuile z15 px512  bande=0     av=122 720 ap=129 702   basculés=6 982   /262 144  ← la règle mord
```

- **À z15 la règle d'échelle mord** (rapport 64) et le ravage tombe à 2,7 %.
- **À z11–z13 elle ne mord pas** (rapport 8 à 16) — et c'est **légitime** : à
  6,94 m par pixel, EMODnet à 111,8 m n'est « que » 16 fois plus grossière, ce
  qui est exactement le régime où B5 est prouvée nécessaire.
- Or `remplirHauteurs` mélange les niveaux (« du plus grossier au plus fin »).
  Là où une tuile z15 manque — et **CHASSE bug 1 établit que le crop ne se
  raffine jamais** — c'est une z12 **noyée à 100 %** qui remplit le trou :
  **un rectangle de la taille exacte de la tuile manquante**, avec la tuile
  voisine restée émergée à côté.

**Et à z12 aucune règle locale ne peut trancher.** La tuile est uniformément à
+0,13 m ; un remplissage de mer WebP est uniformément à +0,3 m. La texture, la
dispersion, la part dans la bande, le nombre de valeurs distinctes : j'ai testé
les quatre, **aucune ne les sépare à ce niveau**. Le seul juge disponible est
**extérieur** — et il existe déjà dans le dépôt.

### CE QUI EMPÊCHERA LA PROCHAINE FOIS

1. **La règle d'échelle, livrée ici.** Elle borne définitivement le régime
   « rapport > 32 ». Elle est testée, et elle est en un seul endroit
   (`bandeBruitAdmise`) que les trois chemins appellent.
2. **⚠️ LE VRAI VERROU, À FAIRE : brancher `src/coast-mask.js` en VETO dans
   `fuseBathymetry`.** Le trait de côte vectoriel existe, il est déjà utilisé
   par `sea-mask.js` **exactement pour ça** — c'est lui qui a sauvé les polders
   néerlandais du même raisonnement topologique. Une cellule déclarée TERRE par
   le trait de côte ne doit **jamais** pouvoir être creusée par une source
   marine, quelle que soit son échelle et quoi que dise la bande de bruit. C'est
   la seule défense qui tient à z12, et c'est un chantier — pas une constante.
3. **Un test de non-régression par lieu.** `test/bathy-echelle-plat.test.js`
   gèle les six lieux mesurés. Tout futur élargissement de l'autorité marine
   devra les repasser.

---

## ⑦ LES QUATRE LITTORAUX — AVANT / APRÈS

`plat-vue.mjs`, protocole CHASSE (vol de démarrage attendu, Échap jusqu'au
`CANVAS`, 30 crans, 8 s de repos). Captures dans `.banc/PLAT/avant/` et
`.banc/PLAT/apres/`.

| lieu | s3 av→ap | plateaux av→ap | plats émergés av→ap | minM av→ap |
|---|---|---|---|---|
| **Camargue** 43,45 / 4,60 | 286 → 287 | 1 516 → 1 557 | 135 → 141 | −3 → **−1** |
| **Bretagne** 48,65 / −2,02 | 307 → 308 | **879 → 879** | **426 → 426** | **−239 → −239** |
| **fjord de Bergen** 60,40 / 5,30 | 308 → 313 | 3 → 16 | **3 → 3** | **−142 → −142** |
| **Moorea** −17,53 / −149,83 | 320 → 333 | 8 → 0 | 8 → 0 | 39 → 1 |

⛔ **Bretagne : identique au relevé près** — c'est le témoin de non-régression le
plus important, un littoral fin et découpé où rien ne devait bouger. Le fjord ne
bouge que sur `plateaux` (métrique brute de cases 32×32 à étendue nulle, très
sensible au cadrage) ; ses deux grandeurs solides sont inchangées. Moorea a
atterri à z16 au lieu de z17 (le vol n'est pas déterministe au cran près) : la
paire n'est pas comparable, mais le bloc y est propre dans les deux cas.

---

## ⑧ CE QUI A CHANGÉ DANS LE CODE

| fichier | quoi |
|---|---|
| `src/bathy.js` | `CELLULE_MAX_PX`, `bandeBruitAdmise()`, `resolutionBathyM()`, et `detectNoiseFill` qui **éteint** la règle sur `noiseBand: 0` au lieu de la rétrécir au zéro exact |
| `src/dem.js` | `loadBathyPatch` rend `{ patch, zPire }` (le niveau bathy le plus **grossier** peint) ; `loadDem` en déduit la bande |
| `src/monde/flux-terrain.js` | `etat.zPire` suivi ; `remplirHauteurs` passe la bande à `fuseBathymetry` |
| `src/globe.js` | `fondMarinTuile` passe la bande — **le seul des trois qui compte pour ce qu'Adrien voit** |
| `test/bathy-echelle-plat.test.js` | 10 tests, inscrits dans `package.json` |

**Aucun appel sans option ne change d'un bit** : c'est le dernier test du
fichier, et c'est ce qui rend le correctif sûr pour l'affiche d'Adrien.

---

## ⑨ PIÈGES PAYÉS DANS CETTE SESSION

- ⚠️ **Un script python en mode texte a converti `src/globe.js` de LF en CRLF**,
  et **15 tests de source sont tombés d'un coup** (ceux qui cherchent
  `…\n\s*…` dans le fichier). Le brief le disait : *« scripts d'édition en
  binaire, et RELIS L'OCTET ÉCRIT »*. Ça m'a coûté une suite complète et une
  fausse alerte de régression. Réparé, revérifié à `grep -c $'\r'` = 0.
- ⚠️ **Deux bancs qui écrivent dans le même dossier sous le même nom** : les
  relevés `avant/camargue.json` de `plat-vue` ont été écrasés par
  `plat-champs`. Rejoué proprement.
- ⚠️ **`Math.min(...tableau)` sur un Float32Array de 2,3 M d'entrées** rend
  `RangeError: Maximum call stack size exceeded` — dans une `page.evaluate`, ça
  ressort comme une erreur de puppeteer sans rapport.
- ⚠️ **Chercher le défaut dans le mauvais fichier pendant trois tours.** Le
  brief nommait `dem.js`, `bathy.js`, `bathy-sources.js`, `dem-source.js` comme
  mon terrain. Le défaut visible vit dans `globe.js:fondMarinTuile`. **Le
  périmètre d'un brief n'est pas une preuve de localisation** — il faut mesurer
  quel chemin peint le pixel avant de choisir le fichier.
