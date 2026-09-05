# RAPPORT CHASSE — LE CATALOGUE DES DÉFAUTS VISIBLES

> **Adrien, 2026-09-04 :** *« Il y a beaucoup trop de bugs. »* Il n'en a nommé
> aucun. Ce rapport les nomme, avec de quoi les rejouer.

**Arbre** `C:\Dev\wt-cha` · branche `chasse-bugs` · HEAD `926885f` (D23 documentée,
**code encore à z7**). `git diff -- src/` **vide**. `npm test` **4 869 · 0 échec**.
`audit:tests` **261 listés = 261 sur disque**.

**Bancs écrits** (tous nouveaux, aucun dans `src/`) :
`scripts/chasse-vol.mjs`, `chasse-molette.mjs`, `chasse-sortie.mjs`,
`chasse-voile.mjs`, `chasse-plafond.mjs`, `chasse-carres.mjs`, `chasse-ab-prod.mjs`.
Relevés et captures : `.banc/CHASSE/`.

**Protocole tenu à chaque relevé** : vol de démarrage attendu jusqu'à distance
stable ≥ 1,5 s, Échap jusqu'à ce qu'`elementFromPoint(640,400)` rende `CANVAS`
(le voile `.ce-elemwrap` a été vérifié levé à chaque fois), **20 images
consécutives** pour tout temps d'image, réseau lu par CDP (jamais
`getEntriesByType`).

---

## ⚡ LA RÉPONSE À LA QUESTION DU BRIEF : **AUCUN DÉFAUT NE DÉPEND DE Z7**

Le même vol (côte de Giens, 46 crans de descente, gestes dans le crop, 60 crans
de sortie) a été joué **deux fois dans le même arbre** : une fois tel quel
(`SEUIL_NAISSANCE_M = 600 000`), une fois avec la constante ramenée à
`SEUIL_BLOC_M` (z10) — puis la modification a été annulée
(`git checkout -- src/monde/seuil-socle.js`, `git diff -- src/` vide).

`.banc/CHASSE/z7-cpu1/` vs `.banc/CHASSE/z10-cpu1/` :

| grandeur | z7 | z10 |
|---|---|---|
| tuiles en cache, sur tout le vol | **713**, figées | **697**, figées |
| plafond de niveau atteint | z15 | z15 |
| crans pour sortir du crop | jamais en 60 | jamais en 60 |
| requêtes en échec | 12–18 | 12–18 |
| ms/image (médiane, 20 images) | 16,7 | 16,7 |
| carrés plats, escaliers, flou | identiques | identiques |

**La seule image qui diffère est celle qui suit immédiatement le `goto`** : à z10
le crop est encore mort à 244 804 m (correct), à z7 il est déjà né. Passé cette
image, les deux vols sont indiscernables.

➡️ **Ramener le crop à z10 ne corrigera aucun des défauts ci-dessous.** C'est une
bonne décision pour le coût (les chiffres de C1 tiennent), mais elle ne doit pas
être vendue comme un correctif de bugs : **elle n'en corrige aucun**.

---

## LE TABLEAU DES DÉFAUTS — classé par gêne

| # | ce qu'on voit | reproduire | z7 ? | console | gravité |
|---|---|---|---|---|---|
| 1 | **Le détail n'arrive JAMAIS.** Le badge « détail en cours… 2 niveaux de retard » reste allumé indéfiniment ; l'histogramme des tuiles est **figé au bit près** pendant que l'altitude est divisée par 5 | `goto 43.05,6.15`, puis 60 crans de molette vers l'avant. `chasse-plafond.mjs` | **non** | — | 🔴 bloquant |
| 2 | **Carrés plats et carrés blancs dans l'eau.** Les étangs et la mer sont des rectangles à angles droits alignés sur la grille de tuiles, plus un carré crème parfait au milieu de l'eau | `goto 43.45,4.60` (Camargue), 30 crans vers l'avant. `.banc/CHASSE/carres/camargue-2.png` | **non** | — | 🔴 bloquant |
| 3 | **On ne peut pas sortir du crop à la molette.** Il faut **entre 241 et 260 crans**. Les **40 premiers ne font quasiment rien** (934 → 1 230 m) | dans le crop, dézoomer à la molette et compter. `chasse-sortie.mjs` | **non** | — | 🔴 bloquant |
| 4 | **Relief en escaliers.** Le Mont-Blanc à 250 m est une pile de terrasses rectangulaires | `goto 45.83,6.86`, 46 crans. `.banc/CHASSE/z7-cpu4/relief/10-pose-basse.png` | **non** | — | 🟠 fort |
| 5 | **Le texte du cartouche sort de l'écran par la gauche.** « …s a lake, or, / salt water / …ds of the » — les premiers caractères de chaque ligne sont coupés par le bord du viewport, ainsi que les lignes `ELEV` et `SCALE` | n'importe quel `goto` ; visible à Giens **et** en Camargue | **non** | — | 🟠 fort |
| 6 | **Bloc « en lame ».** Aux Alpes vers 1 km, le bloc est une bande verticale plus étroite que l'écran, ses parois brunes traversent le champ en diagonale | `goto 45.83,6.86`, 10 crans. `.banc/CHASSE/z7-cpu4/relief/desc-10.png` | **non** | — | 🟠 fort |
| 7 | **278 requêtes vers `s3.amazonaws.com` pour une seule vue.** C'est la réparation « dalle vide » de `dem.js:425` qui part en masse — et qui rebouche avec de l'ETOPO1 (~1 km) à côté d'un sol à 1,75 m | `chasse-carres.mjs`, section `hotes` | **non** | — | 🟠 fort |
| 8 | **Premier écran après démarrage : 339 ms/image à CPU ×4** (≈ 3 im/s) le temps de bâtir le terrain | `chasse-molette.mjs --cpu 4`, relevé `00-boot` | **non** | — | 🟡 moyen |
| 9 | **12 requêtes `net::ERR_ABORTED`** vers `tiles.mapterhorn.com`, en pyramides complètes z12→z17 | toute session ; visible dans l'onglet réseau | **non** | 12 lignes rouges | 🟡 moyen (voir « réfuté ») |
| 10 | **Annuler / Rétablir désactivés au démarrage** et jamais réactivés par un simple vol | inventaire de `chasse-sortie.mjs` | **non** | — | 🟢 faible |

---

## LES CINQ PLUS GRAVES — cause établie / cause supposée

### ① Le détail n'arrive jamais (bug 1) — **cause ÉTABLIE**

`chasse-plafond.mjs`, côte de Giens, histogramme des tuiles du quadtree relevé
tous les 10 crans :

```
crans 10  alt= 885 m  tuiles=678  z=2..15  {2:16,3:60,4:44,5:96,6:128,7:96,8:60,9:44,10:24,11:49,12:34,13:2,15:25}  « 1 niveau de retard »
crans 30  alt= 457 m  tuiles=678  z=2..15  {… identique …}                                                            « 2 niveaux de retard »
crans 60  alt= 170 m  tuiles=678  z=2..15  {… identique au bit près …}                                                « 2 niveaux de retard »
```

**Pas une tuile ne change** pendant que l'altitude passe de 885 m à 170 m. Le
crop est servi par **25 tuiles z15** (et zéro tuile z14). Le zoom ne fait que les
agrandir.

La cause est écrite dans le dépôt, `src/main.js:3750-3756` :

> *« le zoom fixe l'EMPRISE du bloc (…), pas seulement la finesse (…). **Monter
> `DEFAULT_FINE_ZOOM` change la taille du bloc, pas sa netteté.** »*

`DEFAULT_FINE_ZOOM = 15`, `MAX_Z = 15` (`globe.js:759`). Le crop est **un
carré cuit une fois à z15**. Il n'a aucun chemin pour se raffiner sous la
molette.

**Le chiffre de l'écart, rejoué :** à 43° de latitude, un texel z15 en tuiles
512 px vaut **1,75 m**. À 170 m d'altitude et fov 30°, un pixel d'écran vaut
**0,114 m**. ➡️ **un texel servi couvre 15 pixels d'écran — 4 niveaux de
manque, pas 2.** L'indicateur ne ment pas, il **sous-estime**.

⚠️ **Ce qui reste une hypothèse** : que le raffinement ait un jour existé et ait
été perdu avec le crop continu. Je n'ai pas remonté l'historique ; je constate
seulement qu'aujourd'hui aucun chemin ne le rend possible.

### ② Carrés plats et carré blanc dans l'eau (bug 2) — **cause ÉTABLIE, réparation en place mais insuffisante**

`.banc/CHASSE/carres/camargue-2.png` : l'étang de Vaccarès est une collection de
rectangles et de « L » à angles droits, plus **un carré crème parfait** au milieu
de l'eau.

Le défaut est déjà décrit dans le dépôt, `src/dem.js:419-425` :

> *« LA SOURCE FINE SERT L'OCÉAN EN TUILES VIDES, AVEC UN HTTP 200. (…) la dalle
> arrive « valide » et se décode à zéro partout, ce qui donne un plateau plat au
> niveau de la mer. **Ce sont les carrés blancs signalés par Adrien, larges
> d'exactement un tiers de bloc, donc d'une tuile.** »*

La réparation existe (repli dalle par dalle sur AWS/ETOPO1) et **elle part
massivement** : `chasse-carres.mjs` compte **278 réponses de `s3.amazonaws.com`**
pour une seule vue de Camargue, contre 75 de Mapterhorn.

**Ce que la mesure ajoute :** la réparation ne suffit pas, pour deux raisons
distinctes qu'il ne faut pas confondre.
1. **Elle ne couvre pas tout** — le carré crème est toujours là, donc au moins
   une dalle vide passe le test `slotIsBlank` sans être rebouchée, **ou** son
   remplacement AWS échoue en silence.
2. **Ce qu'elle rebouche est plat par nature** : ETOPO1 fait ~1 km de maille.
   Recoller de l'ETOPO1 dans un bloc à 1,75 m/texel produit exactement le
   plateau à angles droits qu'on voit. **La réparation fabrique une partie des
   carrés plats qu'elle est censée effacer.**

⚠️ **Hypothèse, pas diagnostic** : je n'ai pas instrumenté `slotIsBlank` ni le
retour des 278 requêtes AWS. Laquelle des deux causes domine reste ouverte.

### ③ Impossible de sortir du crop à la molette (bug 3) — **cause ÉTABLIE**

`chasse-sortie.mjs`, départ à 468 m dans le crop, un cran = `deltaY 120` :

```
cran   1  cadr=  466   crop=OUI   armee=true   ← l'intention s'arme dès le 1er cran
cran  40  cadr=  616   crop=OUI
cran 100  cadr= 4 462  crop=OUI
cran 200  cadr=139 246 crop=OUI
cran 240  cadr=556 435 crop=OUI
cran 260  cadr=1 141 783 crop=non              ← mort entre 241 et 260
```

**La loi est juste** : `sortieArmee` passe à `true` au premier cran (D21 ① est
respectée), et le crop meurt bien au franchissement de `SEUIL_MORT_M`. **Le
défaut est le coût du geste.** Le pas de molette vaut ~3 % par cran ; il faut
donc ~250 crans pour couvrir les 3 décades entre 470 m et 750 000 m.

Et le pire est le début : **les 40 premiers crans ne déplacent la caméra que de
934 à 1 230 m** (×1,3). Un utilisateur qui donne dix coups de molette voit
l'image **ne pas bouger** — et conclut, comme il l'a déjà fait, que « la molette
est cassée ». Elle ne l'est pas : elle est logarithmique à pas trop fin, sur une
plage trop large.

**La sortie par le bouton, elle, marche** : le bouton globe
(`.ce-icon-btn.ce-globebtn`, 206,37) fait passer le crop de `true` à `false` en
un clic. C'est aujourd'hui **la seule sortie utilisable des trois de D21 ①**.

### ④ Relief en escaliers (bug 4) — **conséquence du ①, pas un défaut séparé**

`.banc/CHASSE/z7-cpu4/relief/10-pose-basse.png` : le Mont-Blanc à 249 m est une
pile de terrasses rectangulaires. C'est la même cause que ① — un MNT z15 (1,75 m
horizontal, quantifié en altitude) étiré 15× — mais **la quantification
verticale le rend bien plus visible en montagne qu'en plaine** : les marches
suivent les paliers d'altitude du terrarium, pas la grille de tuiles.

⚠️ **Hypothèse** : le lissage du MNT (`src/lissage.js`) ne s'applique pas, ou
s'applique avant le suréchantillonnage. Non vérifié.

### ⑤ Le texte du cartouche coupé par le bord (bug 5) — **cause SUPPOSÉE**

Reproduit à deux lieux différents (`z7-cpu1/cote/01-arrive.png` et
`carres/camargue-2.png`) : le paragraphe descriptif et les lignes `ELEV` /
`SCALE` sont posés à gauche du bloc, **hors du viewport**, et perdent leurs
premiers caractères.

**Ce qui est établi** : le texte est ancré au bloc dans la scène, pas à l'écran.
Quand le bloc est centré et large, l'ancre part sous le bord gauche.

⚠️ **Ce qui reste une hypothèse** : que ce soit un défaut plutôt qu'un cadrage
prévu pour l'export affiche (où le canevas est plus large que 1280 px). **À
trancher avec Adrien avant de corriger** — un correcteur qui recentre ce texte
peut casser l'affiche imprimée.

---

## « VU UNE FOIS, NON REPRODUIT »

- **Titre géant du cartouche débordant sur la barre de recherche.** Une seule
  image (`z7-cpu1/cote/01-arrive.png`) : « MÉTROPOLITAN FRANCE / FRANCE » rendu
  à ~5× sa taille normale, en bas de l'écran, par-dessus la barre. Les autres
  vols rendent le même titre petit et à la base du bloc. **Non rejoué.**
- **Vue Méditerranée large, crop éteint, 7 s après le `goto`.** Le premier vol
  (`chasse-vol.mjs`) a rendu `pose=false` à cet instant ; les cinq vols suivants
  rendent `pose=true`. Probablement une image prise pendant le vol d'arrivée.
  **Non rejoué.**
- **Bandeau rouge « FX ONLINE — SURFACE MODE ENGAGED ».** Capté une fois. C'est
  un message FUI volontaire (`modes.js:1203`, `announce()`), auto-masqué. **Pas
  un bug** — retenu ici seulement parce qu'il ressemble à une fuite de débogage.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« La barre du bas est cassée : ce n'est plus une capsule, c'est une grappe
   de bulles. »** ➡️ **FAUX.** A/B avec `https://shibumap.com`
   (`chasse-ab-prod.mjs`) : les **17 bulles du filtre goo ont exactement les
   mêmes rectangles, au pixel près**, en production et sur la branche. C'est le
   liquide voulu ; il paraît plus lobé sur fond clair. Les captures
   `ab-prod/prod-bas.png` et `ab-prod/branche-bas.png` sont indiscernables.

2. **« La profondeur de champ est éteinte dans le crop : D20 est violée. »**
   ➡️ **FAUX.** `bokehEnabled: false` est le **défaut d'usine**
   (`main.js:407`), c'est un interrupteur utilisateur. `poserRegimeCrop`
   (`main.js:6766`) **ne touche pas** au DoF, et son commentaire dit
   explicitement que D20 est l'exception. Seul `perf.js:259` peut le couper, au
   palier machine ≥ 2. Rien à corriger.

3. **« Le voile d'accueil reste peint sur la barre après Échap. »** ➡️ **FAUX.**
   `chasse-voile.mjs` mesure les opacités **cumulées sur toute la chaîne
   d'ancêtres** : `ce-wm-btn` = 0, `ce-hubesc` = 0, `ce-hubclose` = 0,
   `ce-hubveil` = 0. Le hub est bien éteint. Ce que je prenais pour ses restes
   étaient les `lq-blob` de la barre (point 1).

4. **« Les 12 `ERR_ABORTED` Mapterhorn sont des chargements ratés. »**
   ➡️ **PROBABLEMENT FAUX.** Elles arrivent en **pyramides complètes et
   régulières z12→z17 sur une même lignée de tuile**, deux lignées par session,
   ce qui est la signature d'une **sonde de couverture** (`getDemMaxZoom` /
   `liftFineZoomToRegion`, `MAX_FINE_ZOOM = 17`), pas d'une panne. Le terrain
   s'affiche. Je les garde au tableau en 🟡 **uniquement parce qu'elles
   remplissent la console de rouge** et qu'un correcteur les prendra pour une
   piste.

5. **« Le crop à z7 coûte 129,9 ms/image à CPU ×4. »** ➡️ **NON REPRODUIT ICI.**
   À CPU ×4, les vingt images consécutives donnent **16,7 ms de médiane** en
   régime établi, aux trois lieux. Le seul pic est **339 ms au premier écran**
   (construction du terrain). Mon banc tourne en Chrome sans tête sur un GPU peu
   sollicité : **je ne contredis pas C1, je dis que mon dispositif ne sait pas
   mesurer ce coût-là.** ⚠️ **Ne pas citer mes 16,7 ms contre les 129,9 de C1.**

---

## CLASSEMENT FINAL — gêne divisée par risque

| ordre | quoi | pourquoi d'abord | risque du correctif |
|---|---|---|---|
| **1** | **Le pas de molette** (bug 3) | Une constante. C'est le geste qu'Adrien fait le plus, et il est aujourd'hui inutilisable sur trois décades. Gain immédiat, énorme | **faible** — un facteur, borné par `test/pivot-molette.test.js` et `zoom-continu.test.js` |
| **2** | **Le carré blanc dans l'eau** (bug 2, cause ①) | Défaut déjà nommé par Adrien, déjà documenté, déjà à moitié réparé. Il reste à trouver **quelle dalle vide échappe à `slotIsBlank`** | **faible** — le chemin est isolé (`dem.js`), couvert par `test/sea-mask.test.js`, `dem-quant.test.js` |
| **3** | **Le texte du cartouche hors écran** (bug 5) | Visible sur chaque image, coût nul à l'œil | **moyen** — peut casser l'export affiche : **demander à Adrien avant** |
| **4** | **Le raffinement du crop** (bugs 1 et 4) | C'est LA cause de la moitié du catalogue, et de l'impression générale de « carte floue » | ⛔ **ÉLEVÉ** — c'est une refonte : le crop est cuit à une emprise fixe **par conception**. Ce n'est pas un correctif de bug, c'est un chantier. **Ne pas le confier à un correcteur de bugs** |
| **5** | **Les carrés plats rebouchés à l'ETOPO1** (bug 7) | Suite naturelle du 2 | **moyen** — touche au budget réseau (278 requêtes) |
| — | bugs 6, 8, 9, 10 | à laisser tant que 1 à 5 ne sont pas faits | — |

⚠️ **L'avertissement principal de ce rapport** : le chantier z10 en cours
(`C:\Dev\wt-z10`) est **justifié par son coût**, pas par les bugs. Quand il
atterrira, **les dix défauts ci-dessus seront encore là**. Il ne faut pas
attendre de lui qu'il réponde au « il y a beaucoup trop de bugs ».
