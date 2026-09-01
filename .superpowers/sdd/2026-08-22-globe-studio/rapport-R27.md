# R27 — LE PIVOT RESTE LE CENTRE DE LA TERRE, ET L'ORBITE COMMENCE À Z4

Arbre `C:\Dev\wt-piv`, branche `pivot-terre`. Serveur `npm run dev --port 5837`
(arrêté à la fin). Instrument : `scripts/sonde-pivot-r27.mjs`, Chrome sans tête
1280 × 800, relevé **DANS la boucle** (`controls.update` enveloppé). Sorties :
`.banc/R27/avant2.json` (le dépôt d'avant, MÊME protocole) et
`.banc/R27/apres.json`.

**Les deux demandes sont faites et mesurées. R13 bis avait répondu « il n'y a
rien à faire » à la première ; c'est la chose principale que j'ai crue puis
réfutée, et c'était la thèse du dépôt.**

---

## ① CE QUI N'ALLAIT PAS, ET POURQUOI R13 bis NE POUVAIT PAS LE VOIR

> **Adrien :** *« Le point d'orbite n'est toujours pas le bon dès qu'on passe en
> mode surface. Il doit toujours viser le centre de la Terre. »*

R13 bis avait écrit, mesures à l'appui : *« les deux pivots n'en font qu'un […]
une rotation autour d'un axe vertical ne connaît pas le `y` du pivot »*, et
conclu **zéro ligne de code**. **Ce raisonnement est juste, et il ne couvre que
l'AZIMUT.** Il laissait ouvert le seul terme qui manquait :

⛔ **`controls.target` n'est pas SUR cet axe.**

Relevé dans la boucle, descente complète 60 000 km → bloc (`avant2.json`) :

| régime | `controls.target` | écart à l'axe |
|---|---|---|
| orbite | (0 · 0 · 0) | **0** |
| surface z3, sans crop | (−2,9007 · −0,3000 · −0,3047) | 2,917 u |
| surface z4→z9, sans crop | (3,5318 · −0,3000 · 8,7238) | **9,412 u** |
| pire de la session | — | **11,366 u** |

⚡ **Et le chiffre qui tranche est en pixels.** À la naissance du crop, caméra au
nadir, `d = 32,34` : le centre du bloc — l'aplomb du centre de la Terre — se
projette à **(622,5 · 212,1)** sur 1280 × 800, soit **188,7 px du centre de
l'écran, 23,6 % de sa hauteur**. La caméra tourne autour d'un point qui n'est pas
le sujet. En orbite elle tourne autour du sujet. C'est exactement l'écart
qu'Adrien décrit.

⚠️ **Le relevé du brief (−0,171 · −1,503 · −0,171) n'a PAS été reproduit.** Sur
l'adresse par défaut, `target.y` vaut **exactement `Y_CIBLE = −0,3`** à chaque
image des cinq sessions, et les `x`/`z` sont dix à cinquante fois plus grands que
0,171. Sa lecture — « ce n'est pas l'origine » — est juste ; ses trois nombres
viennent d'une autre pose.

---

## ② LE RELEVÉ DE `controls.target` SUR UNE DESCENTE COMPLÈTE

22 jalons, `busy` exclu (les images de rideau portent une pose déjà changée).

| img | altitude de cadrage | mode | zoom | crop | `controls.target` AVANT | AVANT, écart à l'axe | `controls.target` APRÈS | APRÈS |
|---|---|---|---|---|---|---|---|---|
| 0 | orbite | orbital | 12 | non | (0 · 0 · 0) | 0 | (0 · 0 · 0) | **0** |
| ~47 | 5 99./5 93. 10⁶ m | surface | 3 | non | (−2,9007 · −0,3 · −0,3047) | 2,9167 | (0 · −0,3 · 0) | **0** |
| ~51 | 4,2 · 10⁶ m | surface | 3 | non | (−2,9007 · −0,3 · −0,3047) | 2,9167 | (0 · −0,3 · 0) | **0** |
| ~70 | 2,07 · 10⁶ m | surface | 3 | non | (−2,9007 · −0,3 · −0,3047) | 2,9167 | (0 · −0,3 · 0) | **0** |
| ~72 | 2,07 · 10⁶ m | surface | 4 | non | (3,5318 · −0,3 · 8,7238) | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~81 | 1,46 · 10⁶ m | surface | 4 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~92 | 1,02 · 10⁶ m | surface | 5 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~103 | 717 048 m | surface | 5 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~113 | 504 295 m | surface | 5 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~115 | 504 295 m | surface | 6 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~134 | 248 929 m | surface | 6 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~137 | 248 929 m | surface | 7 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~146 | 175 386 m | surface | 7 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~157 | 123 383 m | surface | 8 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~168 | 86 930 m | surface | 8 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~179 | 61 152 m | surface | 8 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~182 | 61 152 m | surface | 9 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~203 | 30 308 m | surface | 9 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~207 | 30 308 m | surface | 10 | non | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| **~208** | **30 308 m** | surface | 10 | **OUI** | idem | 9,4117 | **(0 · −0,3 · 0)** | **0** |
| ~217 | 21 352 m | surface | 10 | OUI | idem | 9,4117 | (0 · −0,3 · 0) | **0** |
| ~231 | 15 020 m | surface | 11 | OUI | (−2,2697 · −0,3 · 8,1144) | 8,4258 | (−9,3333 · −0,3 · −9,3333) | 13,1993 |

**Hors du crop, l'écart à l'axe vaut EXACTEMENT 0 sur les 149 images de surface
de la descente**, contre 2,92 à 11,37 avant.

### ⚠️ Le `y` vaut `−0,3`, et ce n'est PAS l'attendu à la lettre

L'attendu ① demandait « exactement (0,0,0) ». Je rends **(0 · −0,3 · 0)**, et je
le dis explicitement parce que c'est une décision, pas un reste :

1. **Le centre de la Terre est sur la VERTICALE du centre du bloc.** *Tout* point
   de la droite `x = z = 0` le vise. Le `y` ne change rien à la visée, et
   `pivot-bloc.js` porte déjà l'algèbre qui le dit (`Ry` laisse la composante
   verticale intacte).
2. ⛔ **Forcer `y = 0` déplacerait `camera.position.y`** — le pas est rigide —,
   or `altitudeCadrageM()` vaut `camY × emprise / span`. À `camY = 32`, les 0,3
   unité de `Y_CIBLE` valent **0,94 % d'altitude** : le correctif bougerait le
   seuil de naissance du crop **contre lequel il est jugé**. On ne mesure pas une
   bascule avec un instrument qu'on vient de déplacer.
3. `Y_CIBLE` est la **réserve n° 2 de R23** (« c'est un chantier à part »). Je ne
   l'ai pas ouverte.

---

## ③ LE RETOUR DEPUIS LE CROP NE SAUTE PAS

### La bascule elle-même : zéro

| | AVANT | APRÈS |
|---|---|---|
| `globe._crop` | nu → crop, img 216→217 | nu → crop, img 207→208 |
| `controls.target` | inchangée | inchangée |
| `|Δ ln d|` | **0,00000** | **0,00000** |
| centre du bloc à l'écran | 4,5 × 10⁻¹³ px | **0,00000 px** |
| sujet au sol à l'écran | 5,1 × 10⁻¹³ px | **0,00000 px** |

### Le retour, seul à l'écran — la mesure qui compte

⚠️ **Il a fallu un protocole exprès.** Dans une remontée ordinaire le balayage de
retour au nadir de D16 ter tourne PENDANT tout le recentrage, et il change la
distance par construction (il tourne l'élévation à `camY` constant) : `|Δ ln d|`
y est dominé par lui, pas par le recentrage. On décale donc la cible
**rigidement** une fois le balayage fini, puis **plus un geste** :

| | mesuré |
|---|---|
| écart injecté | **12,7208 u** |
| images pour revenir sur l'axe | **89** (1,5 s à 60 Hz) |
| écart final | **exactement 0** |
| images où le recentrage bouge la caméra SEUL | **88** |
| **`|Δ ln d|` MAXIMAL sur ces images** | **0,00000** — contre un seuil de 1e-4 |
| saut MAXIMAL du centre du bloc | **4,076 px** |
| saut MAXIMAL du sujet au sol | **4,076 px** |
| bascules de `veille-repos` sur la période | **0** |
| `veilleRepos.dernierEcart` maximal | **0,00000** |

⛔ **Et le témoin : sous le MÊME protocole, l'avant ne revient JAMAIS.** Crop
mort à 42 918 m avec 9,686 u d'écart, **470 images sans geste, écart final
9,686 u** — inchangé au quinzième chiffre.

### Le retour dans une remontée ordinaire

| | AVANT | APRÈS |
|---|---|---|
| écart à la mort du crop | 9,686 u | 6,021 u |
| images pour revenir sur l'axe | **jamais** | **50** |
| écart final | 9,686 u | **0** |
| `|Δ ln d|` max sur le retour | 0,023066 | **0,020676** |
| saut max du centre du bloc | 35,71 px | **35,41 px** |
| pas d'inclinaison max par image | 1,50000° | 1,50000° |

Les 35 px et les 0,02 sont **le balayage de D16 ter**, pas le recentrage : ils
sont là AVANT, dans les mêmes proportions, et l'après les rend **légèrement plus
petits**.

### Pourquoi le recentrage ne peut pas être vu

`(P + δ) − (T + δ) = P − T`. Caméra et cible reçoivent le MÊME décalage : la
distance est invariante **par construction**, pas par réglage. Le test ⑤ de
`test/pivot-terre.test.js` l'exige **au bit** (`assert.equal(dist(), d0)`), pas
« sous le seuil ».

⚠️ **Et le recentrage TRAVERSE le balayage de pose au lieu de l'attendre.** Le
balayage de retour au nadir est armé exactement sur le front descendant du crop ;
avec la garde habituelle, le recentrage restait **bloqué 138 images** et
n'aboutissait que par accident, au cran suivant. On ne combat pas le balayage :
on le **translate**, sa cible comprise. `poseFonduArrivee` rend
`cible.xz + direction_h × r` à `camY` constant, donc translater `cible` translate
sa sortie du même vecteur, sans toucher `camY`, `direction` ni l'avancement —
l'inclinaison balayée est identique, et le §⑤ le vérifie.

---

## ④ LE SEUIL D'ORBITE, ET SA CONVERSION EN ALTITUDE

> **Adrien :** *« Il faudrait passer en mode orbite pour tout ce qui est
> supérieur à Z4. »*

**Lecture retenue : `ZOOM_PALIER_MIN = 4`.** Sa convention nomme « supérieur » la
vue la plus ÉLOIGNÉE, et « supérieur **à** » est strict : **z4 reste un bloc de
surface, z3 n'en est plus un.** (Le brief proposait entre parenthèses
« z0 → z4 », qui inclurait z4 et donnerait un plancher de 5 ; je tranche pour la
lecture stricte, qui garde utilisable le dernier niveau qu'il nomme. Le nombre à
changer si Adrien voulait l'autre est **un seul**, et il est isolé.)

### ⛔ Un plancher de zoom n'est PAS un seuil d'altitude

`ZOOM_PALIER_MIN` est un **indice de zoom slippy**. Trois grandeurs distinctes,
et le dépôt a payé neuf fois de les confondre :

| grandeur | valeur | ce que c'est |
|---|---|---|
| `ZOOM_PALIER_MIN` | **4** | un INDICE, sans dimension |
| emprise au sol d'un bloc z4 (La Réunion, lat −21,26) | **7 002 693 m** | la conversion honnête de l'indice — mesurée par `hooks.empriseBlocMAuZoom(4)` |
| emprise d'un bloc z3, celui qu'on retire | 14 005 386 m | un tiers de la circonférence terrestre, à plat |
| altitude de cadrage à l'ouverture de la porte | **5,59 à 7,97 × 10⁶ m** | RELEVÉE, sur trois sessions |
| `DIVE_TIERS[z4].altM` | 8 000 000 m | ⛔ **le seuil de PLONGÉE**, orbite → surface, une autre loi prise dans l'autre sens |

⚠️ **L'altitude de la porte est une PLAGE, et ce n'est pas de l'imprécision.** La
porte orbitale est **géométrique** : elle s'ouvre quand `getCoarsenTarget()` rend
`null` et que le compteur de niveau réclame un cran de plus. L'altitude où le
dernier cran tombe dépend donc d'où, dans le niveau z4, le budget s'est rempli —
un niveau court de `d₀/2` à `2 d₀`. Trois sessions : **5 590 400 m**,
**7 818 854 m**, **7 967 147 m**, toujours depuis un bloc **z4**, jamais depuis
un autre. Le zoom, lui, est exact ; l'altitude est dérivée.

⚠️ **Et la proximité entre 7,8 · 10⁶ m et les 8 · 10⁶ m de `DIVE_TIERS` est une
COÏNCIDENCE de la progression ×2 de la table.** Ce sont deux nombres différents,
produits par deux lois différentes, dans deux sens différents. Ne pas les
rapprocher.

### ⚡ Et la porte n'était pas atteignable par le bouton ni le pincement

⛔ **R23 a corrigé `_applyZoom` (la molette) et a laissé `cranZoom`.** Relevé au
navigateur sous le protocole R27 (`avant2.json`, remontée pilotée par
`cranZoom`) : caméra collée à **`d = 150` contre un plafond de 150**,
`log(nouvelle/dist)` vaut alors **zéro**, le compteur de niveau gèle,
`_franchirSiBesoin` ne franchit plus rien — **1 174 images, bloqué à z8, l'orbite
JAMAIS atteinte**. C'est le §④ de R23 mot pour mot, sur le chemin qu'elle n'avait
pas mesuré.

Même règle, même asymétrie : vers l'extérieur un niveau existe toujours (un cran
plus large, ou la porte) ; vers l'intérieur, au zoom fin, il n'y a plus rien à
affiner. Quatre tests dans `test/retour-orbite.test.js`, dont les deux témoins
d'asymétrie. Après : l'orbite est atteinte, en **z4**, dans les trois sessions.

---

## ⑤ `veille-repos` NE VOIT RIEN, ET D16 ter TIENT

### `veille-repos`

| | mesuré | contre `SEUIL_BOUGE_LOG = 1e-4` |
|---|---|---|
| `|Δ ln d|` du recentrage, **seul à l'écran**, 88 images | **0,00000** | — |
| `veilleRepos.dernierEcart` maximal sur ces images | **0,00000** | — |
| bascules de `veille-repos` sur ces 320 images | **0** | — |
| `|Δ ln d|` à la bascule du crop | **0,00000** | — |
| bascules sur toute la session | **9** (avant : **10**) | — |
| invariance de la distance, test unitaire | **égalité au bit** (`assert.equal`) | — |

**Zéro, et pas « sous le seuil ».** Ce n'est pas un réglage heureux : c'est
`(P + δ) − (T + δ) = P − T`, la même algèbre que la rotation rigide de R13, prise
par l'autre bout.

### D16 ter

| | AVANT (`avant2.json`) | APRÈS (`apres.json`) |
|---|---|---|
| inclinaison MAX **en orbite** | 1,479 × 10⁻⁶° (44 img) | **1,708 × 10⁻⁶°** (46 img) |
| inclinaison MAX **en surface SANS crop, descente** | 5,739 × 10⁻⁵° (164 img) | **5,731 × 10⁻⁵°** (149 img) |
| inclinaison **avec crop** | 46,5482° | **46,5482°** |
| première image au-dessus de **1°**, hors rideau | img 298 · **crop OUI, repos OUI** · 15 080 m | img 285 · **crop OUI, repos OUI** · 15 020 m |
| pas d'inclinaison max par image, retour au nadir | 1,50000° | 1,50000° |

**La vue de trois quarts arrive au bloc et pas avant, des deux côtés.** Le
`46,5482°` est `90° − atan(18/19)` à la quatrième décimale — l'identité
géométrique que R4 avait établie, intacte.

⚠️ **La grandeur lue est bien l'inclinaison, pas la latitude** (la faute n° 9 de
R23) : la verticale locale est le **rayon** en orbite et l'axe `y` sur la dalle,
et la sonde change de référence avec le mode.

---

## ⑥ CE QUE J'AI CRU PUIS RÉFUTÉ

**Sept choses, et la première est la thèse publiée du dépôt.**

1. ⛔ **« R13 bis a raison : la règle est déjà appliquée, il n'y a rien à
   faire. »** C'est écrit dans `rapport-R13.md` (« ÉTAPE 3 — LA RÈGLE APPLIQUÉE :
   zéro ligne de code ») et c'est **faux**. Sa preuve ne porte que sur l'AZIMUT,
   où le `y` du pivot ne compte pas — c'est exact et c'est la moitié du sujet.
   L'autre moitié est que **la cible n'est pas sur l'axe** : 9,412 u pendant
   toute la descente, 188,7 px de décentrage du sujet. ⚡ **Le test que R13 bis a
   posé pour empêcher qu'on ajoute une garde de crop dans `pivoterAutourDuBloc`
   reste juste et n'a pas été touché** : ce n'est pas là que la règle manquait.

2. ⛔ **« La cible doit devenir exactement (0,0,0). »** Forcer `y = 0` déplace
   `camera.position.y` de 0,3 unité, donc `altitudeCadrageM()` de **0,94 %**,
   donc le seuil de naissance du crop — l'instrument même contre lequel le
   correctif se juge. Réfuté par le calcul, pas par le goût. Le `y` reste
   `Y_CIBLE`.

3. ⛔ **« Il suffit de recentrer la cible dans la boucle. »** Le pire écart est
   de 11,37 u à `d = 30` : une seule image aurait fait tourner la vue de 21° et
   `|Δ ln d| ≈ 1,4 × 10⁻²`, soit **140 fois** le seuil de `veille-repos`. Le pas
   doit être rigide (caméra + cible) **et** borné en angle vu.

4. ⛔ **« Le recentrage par image suffit, `_cibleVisee` peut rester. »** Non :
   `_arrivalPose` et `_rescale` reposent la cible à CHAQUE cran, si bien que la
   descente se serait « tassée » vers le centre pendant ~2 s après chaque niveau
   franchi. Il fallait les deux : la visée d'arrivée sur l'axe **et** le
   recentrage par image, qui ne sert plus alors qu'au retour.

5. ⛔ **« Le recentrage doit s'effacer devant le balayage de pose, comme la
   correction de pivot de R13. »** Mesuré : le balayage de retour au nadir est
   armé **exactement** sur le front descendant du crop, donc cette garde bloquait
   le recentrage **138 images** — le retour d'Adrien commençait deux secondes
   trop tard et n'aboutissait que par le cran suivant. On **translate** le
   balayage au lieu de l'attendre.

6. ⛔ **« Mon protocole de retour mesure le recentrage. »** Il mesurait le
   balayage de D16 ter : `|Δ ln d| = 0,0225` et **35 px** de saut… relevés à
   l'identique **sur l'AVANT**, où il n'y a aucun recentrage (0,0231 et 35,7 px).
   Il a fallu un protocole où le recentrage est **seul à l'écran** pour obtenir
   la vraie réponse — **0,00000**. Un chiffre qui ne bouge pas entre l'avant et
   l'après ne mesure pas le correctif.

7. ⛔ **« La remontée d'avant atteint l'orbite, c'est mon changement qui la
   débloque. »** Elle ne l'atteint pas, et **ce n'est pas mon sujet qui la
   bloquait** : c'est `cranZoom`, resté sur le déplacement CLIPPÉ là où R23 a mis
   `_applyZoom` sur l'INTENTION. J'ai failli publier le déblocage comme un effet
   du pivot ; c'est un second défaut, indépendant, corrigé et testé à part.

### Et une chose que je n'ai pas eu à réfuter

Le brief nommait deux pistes déjà mortes — borner par le sommet du disque, et
échantillonner un cercle depuis la cible. **Aucune des deux n'est employée
ici** : le pas de recentrage ne lit ni le sol, ni un cercle, ni un azimut. Il ne
lit que `cible − axe` et la distance, toutes deux **absolues** — un test tourne
64 azimuts et exige l'invariance de sa norme à 10⁻¹².

---

## ⑦ RÉSERVES OUVERTES

1. ⚠️ **Sur le crop, le premier affinage repose la cible à 9,3333 u en `x` ET en
   `z`** — exactement `56/6`, le calage sur la grille de tuiles que
   `escalier-zoom.js` documente. L'écart y passe de **8,43 u (avant) à 13,20 u
   (après)**, parce que l'entrée de ce calcul est maintenant l'axe. Le crop est
   le régime qu'Adrien EXCLUT de la règle, donc R27 n'y touche pas. **À
   trancher avec lui** : si le pivot du crop doit être l'axe du bloc lui aussi,
   R13 a déjà la mesure qui le dit (68,324 px contre 0,001 px), et il n'y aurait
   alors plus d'exception du tout — c'est-à-dire plus de transition à écrire.

2. ⚠️ **Le pas mesuré à l'écran vaut 4,08 à 4,14 px pour un plafond de loi de
   4,05 px.** L'écart n'est pas une violation : le pas est calculé sur la
   distance de l'image `n` et projeté sur celle de l'image `n+1`, que le balayage
   de D16 ter rétrécit entre les deux. Isolé du balayage, il tient à
   **4,076 px**. C'est publié plutôt que lissé.

3. ⚠️ **Un déplacement de vue (`enablePan`) hors du crop est ramené à l'axe.**
   C'est la règle demandée, appliquée littéralement, et le glissement est doux
   (≤ 4 px/image) — mais je ne l'ai **pas** mesuré sous un geste de pan réel
   tenu : mes décalages sont injectés rigidement. Si Adrien veut pouvoir
   déplacer la vue au-dessus du crop, c'est ici que ça se discute, et
   `enablePan` n'est **pas** l'interrupteur à toucher (il gouverne aussi le
   bouton du milieu et Maj+gauche — la perte qu'il a déjà signalée).

4. ⚠️ **Le coût par image n'est pas chiffré.** Le recentrage est un `hypot`, deux
   multiplications et quatre additions, sans allocation, et il sort en une
   comparaison dès que la cible est sur l'axe (le cas de toute la descente). Mais
   ce n'est pas mesuré, et un « coût indiscernable de zéro » non mesuré est
   exactement ce que `lecons-campagne-R.md` §② reproche.

5. ⚠️ **L'altitude de la porte orbitale n'a que trois relevés** (5,59 / 7,82 /
   7,97 × 10⁶ m). Ils suffisent à établir que c'est une plage et non une
   constante, pas à en donner les bornes.

---

## ⑧ LES CHIFFRES DE CLÔTURE

| | valeur |
|---|---|
| `npm test` | **4 595 tests · 0 échec** (base à battre : 4 576) |
| tests ajoutés | **19** — 15 dans `test/pivot-terre.test.js` (neuf), 4 dans `test/retour-orbite.test.js` |
| tests repris parce qu'ils VERROUILLAIENT le plancher z3 | **9**, dans `test/escalier-zoom.test.js` et `test/modes.test.js` |
| `npm run audit:tests` | **238 listés · 238 sur disque · aucun écart** |
| fichier de test inscrit dans `package.json` | `pivot-terre` |
| commits | `0fe3b13` (le pivot), `bb2b74e` (la porte orbitale) |

### FICHIERS TOUCHÉS

| fichier | quoi |
|---|---|
| `src/monde/pivot-terre.js` | **neuf** — la loi : `decalageRecentrage`, `PAS_RECENTRAGE_RAD`, et les deux mesures qui les fixent |
| `src/modes.js` | `_cibleVisee` vise l'axe hors du crop · `cranZoom` compte l'INTENTION au plafond · la table de plongée et son plancher |
| `src/main.js` | le hook `horsDuCrop` · `recentrerSurLaTerre()` par image, qui traverse le balayage de pose |
| `src/escalier-zoom.js` | `ZOOM_PALIER_MIN` : 3 → **4** |
| `scripts/sonde-pivot-r27.mjs` | **neuf** — l'instrument (relevé dans la boucle, retour isolé, porte orbitale, D16 ter) |
| `test/pivot-terre.test.js` | **neuf** |
| `test/retour-orbite.test.js`, `test/escalier-zoom.test.js`, `test/modes.test.js`, `package.json` | ajouts et reprises |

⛔ **Rien touché dans le périmètre des autres agents** : ni la colorisation
(`globe.js`, rampe hypsométrique, trait de côte), ni les matières PBR, ni
`habillage-crop.js`, ni les nuages. `git diff` sur `src/` ne sort que les quatre
fichiers ci-dessus.
