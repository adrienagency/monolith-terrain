# CN3 — LA NOTE : tout remesuré, la garde attaquée, et deux chiffres de CN2 réfutés

**Branche `crop-net-note`, arbre `C:\Dev\wt-cn3`. `git diff -- src/` est VIDE.**
Aucune ligne du produit n'a été modifiée durablement ; les seules écritures dans
`src/` ont été des **mutations d'épreuve**, appliquées puis retirées, empreinte
md5 à l'appui (§5).

⚡ **Aucun chiffre de ce rapport ne vient de CN1 ni de CN2.** Tout ce qui est
écrit ici sort de mon banc, décrit au §1. Là où mes chiffres divergent des leurs,
je le dis, et **ce sont les miens qui comptent**.

---

## 0. LE VERDICT, EN HAUT

| | |
|---|---|
| **Note** | **7 / 10** |
| **Le moteur** (`src/globe.js`, `src/main.js` hors cartouche) | ✅ **FUSIONNER** — la loi tient, la garde tient, l'emprise et le coût tiennent |
| **Le cartouche** (`src/ui/create-panel.js` + `getZoomCropServi`) | ⛔ **REFUSÉ** — mesuré à l'écran : il annonce **« net à z13 » pendant que la surface dessine du z16**. CN2 a remplacé deux niveaux de SUR-promesse par **trois niveaux de SOUS-promesse**. Ce n'est pas un correctif, c'est le même défaut avec le signe changé |

Ce qui manque pour passer à 10, précisément, est au §8. Ce n'est **pas** un
chantier : c'est une ligne de réactivité, et deux phrases à corriger dans le
message de commit.

---

## 1. MON BANC — et en quoi il diffère de celui de CN1

`scripts/sonde-cn3.mjs` (nouveau). Chrome sans tête, 1280 × 720, DPR 1, CPU ×4,
vite sur **127.0.0.1:9137**, bloc à `DEFAULT_FINE_ZOOM = 15`, quatre lieux.
Traces : `.banc/CN3/*.json`.

**Six différences avec `scripts/sonde-cn1.mjs`, et chacune a une raison :**

1. **Le PIRE texel de l'emprise, pas seulement celui du centre.** CN1 ne mesure
   que la tuile la plus fine dessinée qui contient le centre. Adrien regarde
   toute l'affiche. Je mesure **chaque tuile dessinée** et je garde le maximum,
   à côté du chiffre du centre pour rester comparable.
2. **Toutes les images depuis la pose, pas 20 au repos.** C'est LE point
   d'attaque. La sonde est armée en continu, à chaque `update`, en **quatre
   phases** : `vol` (le glissé d'altitude), `affinage` (jusqu'au calme),
   `repos`, `geste` (molette ×4 et glissé ×6). ≈ **520 images par cellule**,
   contre 20 chez CN1.
3. **Un vérificateur analytique en parallèle de la projection.** À côté du
   `mppEcran` projeté à la main, je calcule `2·d·tan(fov/2)/H`. Si les deux
   divergent de plus de 25 %, la tuile est **écartée**.
   ⚠️ **Et ça m'a évité un faux constat, le premier tirage de ce banc** : sans
   ce garde-fou, le « pire texel de l'emprise » rendait **9,04 aux Alpes à
   600 m** avec un écart analytique de **598 %** — une tuile hors cadre dont la
   projection n'a aucun sens. Avec le garde-fou, la vraie valeur est **1,32**.
   *C'est le §3 de `/threejs-optimisation`, payé une fois de plus.*
4. **Un A/B réel, pas une comparaison de rapports.** Deuxième arbre
   `C:\Dev\wt-cn3-avant` détaché sur `26f469b` (le dépôt d'avant CN2), même
   `node_modules` et même `public/data` par jonction, vite sur **9138**, **la
   même sonde**, lancée en parallèle. Les colonnes « avant » du §2 sont donc
   mesurées par MOI, pas recopiées.
5. **L'emprise en mètres, le cache, la file, le crédit, le réseau et le temps
   d'image sont lus sur la MÊME image** que la netteté.
6. **La hauteur d'écran et le pixel-ratio sont des paramètres** (`--hauteur`,
   `--dpr`) — le §4 en avait besoin.

---

## 2. LE TABLEAU REMESURÉ — pixels d'écran par texel servi

Médiane de 20 images au repos, direction horizontale, tuile du centre du crop.
`avant` = `26f469b` (port 9138) · `après` = `HEAD` (port 9137), même sonde,
même session de mesure.

| altitude | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| 20 000 m | 0,19 → **0,19** (z13) | 0,19 → **0,19** (z13) | 0,22 → **0,22** (z13) | 0,21 → **0,21** (z13) |
| 5 000 m | 0,78 → **0,78** (z13) | 0,78 → **0,78** (z13) | 0,90 → **0,90** (z13) | 0,94 → **0,94** (z13) |
| 2 000 m | 1,95 → **1,95** (z13) | 1,99 → **1,99** (z13) | 2,25 → **1,11** (z14) | 3,08 → ⛔ **3,08** (z13) |
| 900 m | 4,40 → **1,08** (z15) | 4,67 → **1,06** (z15) | 4,98 → **1,24** (z15) | 18,63 → **1,81** (z14) |
| 600 m | 6,74 → **1,62** (z15) | 7,52 → **1,58** (z15) | 7,41 → **1,87** (z15) | 48,99 → **1,20** (z15) |

**Le barème B4 (≤ 2,0) est tenu partout, sauf une cellule** : Alpes à 2 000 m.

### Les écarts avec les chiffres annoncés par CN2

| cellule | CN2 annonce | je mesure | écart |
|---|---|---|---|
| 5 000 m ×4 | 0,77 / 0,78 / 0,90 / 0,94 | **0,78 / 0,78 / 0,90 / 0,94** | ≤ 0,01 ✔ |
| 900 m après | 1,08 / 1,06 / 1,25 / 1,84 | **1,08 / 1,06 / 1,24 / 1,81** | ≤ 0,03 ✔ |
| 600 m après | 1,62 / 1,58 / 1,88 / 1,21 | **1,62 / 1,58 / 1,87 / 1,20** | ≤ 0,01 ✔ |
| 900 m **avant**, Alpes | 19,28 | **18,63** | −3,4 % |
| 600 m **avant**, Alpes | 43,52 | **48,99** | **+12,6 %** |

⚡ **Les chiffres d'APRÈS de CN2 sont justes au centième ; ses chiffres
d'AVANT ne se reproduisent pas** sur le cas dur. C'est attendu et sans
conséquence : avant correctif le texel est figé à z13, donc le rapport n'est
plus qu'une mesure de la **pose de la caméra dans le relief**, qui varie d'un
tirage à l'autre. **L'ampleur exacte du défaut d'avant n'est pas reproductible ;
sa nature l'est.** (§5 de la compétence, mot pour mot.)

⚠️ **Et le pire texel de l'emprise ne dément pas le centre** : après correctif,
max 1,10 (Beauce), 1,58 (Bretagne), 1,87 (Majorque), 1,83 (Alpes) aux altitudes
de travail. **L'affiche est nette sur ses bords autant qu'en son centre** — la
question que CN1 ne posait pas.

---

## 3. LES TROIS EXIGENCES NON NÉGOCIABLES

### ⛔ ① UNE SEULE FINESSE PAR IMAGE — **TENUE**, et j'ai frappé fort

**8 279 images relevées une par une**, quatre lieux × cinq altitudes × quatre
phases (vol, affinage, repos, gestes) — contre les 300 de CN2, toutes au repos.

**Images portant deux niveaux ou plus, dans l'emprise :**

| altitude | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| 5 000 m | 0/488 → **0/522** | 0/516 → **0/491** | 0/496 → **0/516** | 0/519 → **0/520** |
| 2 000 m | 0/489 → **0/518** | 0/520 → **0/492** | 0/490 → **0/517** | 0/517 → **0/517** |
| 900 m | 0/491 → **0/516** | 0/520 → **0/490** | 0/497 → **0/540** | 0/526 → **0/525** |
| 600 m | 0/491 → **0/497** | 0/521 → **0/492** | 0/500 → **0/529** | 0/517 → **0/519** |
| **20 000 m** | **118**/557 → **71**/586 | **118**/541 → **73**/505 | **118**/573 → **65**/549 | **118**/573 → **69**/575 |

**Deux conclusions, et la seconde corrige CN2.**

- ✅ **Aux altitudes de cadrage (5 000 → 600 m), zéro image à deux niveaux sur
  8 279** — *pendant l'affinage et pendant les gestes compris*, et
  **les promotions de palier sont bien dans l'échantillon** : le journal montre
  `servi 13→14` pendant le vol aux Alpes à 900 m, `14→15` à 600 m, `14→15`
  pendant les GESTES à 900 m. La garde tient **à l'instant même où elle est le
  plus sollicitée**.
- ⛔ **Mais « zéro image à deux niveaux » est FAUX en absolu.** À 20 000 m —
  la transition d'arrivée — il y en a **65 à 73 par poste**, jusqu'à **huit
  niveaux simultanés** (`[2,7,8,9,10,11,12,13]`). ⚡ **Et ce n'est PAS une
  régression de CN2 : c'était déjà là avant, en plus grand nombre (118, à
  l'image près sur les quatre lieux — donc déterministe). CN2 en RETIRE 40 %.**
  L'énoncé juste est : *« zéro aux altitudes de cadrage, et strictement moins
  qu'avant en transition »*. CN2 a mesuré au repos et généralisé.

### ⛔ ② L'EMPRISE NE RÉTRÉCIT PAS — **TENUE**, au mètre

Mesurée en mètres sur `_crop.demi`, à chaque image, aux cinq altitudes :

| | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| avant | 2 446 m | 2 437 m | 2 826 m | 2 553 m |
| après | **2 446 m** | **2 437 m** | **2 826 m** | **2 553 m** |

**Identique au mètre, à toutes les altitudes, plancher 2 400 m respecté.**
`params.demZoom` vaut 15 avant comme après. ✔

### ⛔ ③ LE COÛT TIENT — **TENU**, très largement

Cache au repos, plafond dur `CACHE_MAX_CONTINU = 1 700`, barème 900 :

| | Beauce | Bretagne | Majorque | Alpes |
|---|---|---|---|---|
| avant | 356 | 324 | 373 | 284 |
| après | **336** (−5,6 %) | **336** (+3,7 %) | **401** (+7,5 %) | **332** (+16,9 %) |

File **0/0** partout, `msUpdate` p99 **0,4 à 0,8 ms** à CPU ×4 avant comme après.
Réseau du poste d'arrivée (20 000 m, qui porte tout le streaming) : Alpes
49 requêtes / 10,4 Mo → **71 / 15,2 Mo**.

**Barème ≤ 900 : tenu avec 2,2× de marge dans le pire cas.** ✔

---

## 4. L'ÉCART ×16 — EXPLIQUÉ, ET LES DEUX CAMPS AVAIENT TORT

**Qui avait tort : les deux, et pas au même endroit.**

**CN1 avait raison sur le rapport, faux sur le dénominateur.** Deux niveaux de
raffinement, c'est bien ×16 **sur l'aire**. J'ai compté les tuiles réellement
dessinées dans l'emprise :

| lieu | dessinées avant | dessinées après (600 m) | rapport |
|---|---|---|---|
| Beauce | 4 | **9** | ×2,25 |
| Bretagne | 2 | **9** | ×4,5 |
| Majorque | 4 | **12** | ×3,0 |
| Alpes | 2 | **9** | ×4,5 |

**Le ×16 ne se produit jamais**, pour deux raisons mesurées :
- **l'emprise est petite et ne s'aligne pas sur la grille.** 2 437 à 2 826 m,
  soit **1 à 2 tuiles z13**. Refendre deux fois 2 tuiles ne donne pas 32 tuiles
  mais 9 : les tuiles filles hors emprise sont écartées par `_horsCropSeul`.
  Le ×16 suppose une aire découpée à l'infini ; ici c'est le bord qui domine ;
- **deux niveaux ne sont pas toujours atteints.** Aux Alpes à 900 m, un seul.

**CN2 avait raison sur l'ordre de grandeur, faux sur la précision.** Son « +4 % »
suppose que le cache est reproductible au pourcent. Il ne l'est pas : **j'ai
mesuré le MÊME code, au MÊME lieu, deux fois, à 129 et 332 tuiles** (un facteur
2,6) selon le chemin d'arrivée. Mon A/B rend **−5,6 % à +16,9 %**, médiane
≈ +5 %. Le « +4 % » est **dans mon intervalle**, mais il est publié avec une
précision que le banc ne porte pas.

⚡ **Et la vraie raison tient en une phrase, que CN2 énonce et que je confirme :**
l'emprise du crop pèse **2 à 12 tuiles sur un cache de 284 à 401**, soit **1 à
3 %**. Multiplier par 16 une chose qui vaut 1 % du total donne +15 %, pas ×16.
**CN1 a appliqué un rapport juste à la mauvaise grandeur.** C'est exactement
l'erreur que la compétence décrit au §5 : *« les objets hors champ ne coûtent pas
des appels de dessin, ils consomment les places du cache »* — le cache est
dominé par ce qu'on charge AUTOUR, et le correctif n'y touche pas.

---

## 5. LA BASCULE À 5 000 m — ⛔ **LE « 12,98 » DE CN2 EST FAUX**

CN2 écrit que le cadrage de l'affiche est sauvé de justesse parce que la loi rend
`⌈12,98⌉ = 13`, « à 0,02 de la bascule », et en tire que la loi est *« calibrée
exactement sur le cadrage d'Adrien ; c'est une propriété, pas une coïncidence »*.

**J'ai ouvert le calcul terme par terme dans l'application**
(`scripts/sonde-cn3-loi.mjs`, Majorque, altitude de cadrage 5 002 m) :

```
fov 33°   ·   distance caméra → surface déplacée : 10 001 m   ·   tuile 512 px
source mapterhorn   ·   largeur au sol 30 870 133 m   ·   plafond 16
```

| hauteur d'écran | m par pixel | **valeur BRUTE de la loi** | ⌈ ⌉ | sortie de `_zoomCropFin` |
|---|---|---|---|---|
| 360 | 16,46 | 10,839 | 11 | 13 *(borné par `ZOOM_SOCLE`)* |
| 480 | 12,34 | 11,254 | 12 | 13 |
| **720 (le barème)** | **8,23** | **11,839** | **12** | **13** |
| 1 080 | 5,49 | 12,424 | 13 | 13 |
| 1 440 | 4,11 | 12,839 | 13 | 13 |
| 2 160 | 2,74 | 13,424 | 14 | **14** |
| 4 320 | 1,37 | 14,424 | 15 | **15** |

⛔ **La valeur réelle est 11,839, pas 12,98.** L'écart à la bascule n'est pas
**0,02 niveau, c'est 1,16 niveau** — cinquante fois plus de marge. CN2 a calculé
sur le papier avec l'**altitude de cadrage** (5 000 m) là où la loi utilise la
**distance caméra → surface déplacée** (10 001 m, vue oblique) : une erreur de
facteur 2 sur la distance, donc exactement un niveau. *§2 de la compétence : ne
lisez pas la constante, mesurez ce qu'elle produit.*

**Conséquence sur la note : ce point joue EN FAVEUR du correctif.** L'affiche
d'Adrien n'est pas sur une lame de rasoir, et la crainte du brief tombe.

### Ce que la bascule fait vraiment — mesuré de bout en bout dans l'application

| fenêtre CSS | pixel-ratio | `hauteurPx` lue par `main.js` | z servi à 5 000 m |
|---|---|---|---|
| 1280 × 720 | 1 | 720 | **13** |
| 1280 × 720 | **2** | **720** | **13** |
| 1280 × 1080 | **2** | 1080 | **13** |
| 1280 × 1600 | 1 | 1600 | **13** |
| 1280 × **2160** | 1 | 2160 | ⚠️ **14** |

- ✅ **Le pixel-ratio n'atteint PAS la loi** — `main.js` lit `renderer.getSize()`
  (taille CSS), pas le tampon de dessin. Sur un écran Retina l'affiche ne change
  pas. Le choix est délibéré, commenté, et **il tient à la mesure**.
- ✅ **La latitude ne peut pas basculer non plus** : le terme est `cos(lat)`, et
  passer de Majorque à l'équateur ne vaut que **+0,375 niveau** sur les 1,16
  disponibles.
- ⚠️ **La hauteur de fenêtre, elle, bascule — vers ~1 650 CSS px.** Un écran 4K
  ou 5K à **100 % de mise à l'échelle** (DPR 1, 2 160 lignes CSS) sert
  l'affiche en **z14 au lieu de z13**. Le dépôt d'avant, lui, servait z13 quelle
  que soit la fenêtre.
  **Est-ce un défaut ?** *Du point de vue du barème*, non : z14 est plus fin, B5
  (« ne dégrade pas ») est respecté. *Du point de vue d'Adrien*, c'est une
  **dépendance nouvelle du rendu de l'affiche à la taille de la fenêtre** — deux
  machines ne donnent plus le même bloc. C'est la contrepartie assumée d'une loi
  « pixels par texel » ; **elle doit être écrite, elle ne l'est pas.** Je la
  compte comme une réserve, pas comme un défaut bloquant.

---

## 6. LA RÉSERVE AVOUÉE — vérifiée, et il y en a une SECONDE

**L'explication de CN2 est juste.** Elle annonce, aux Alpes, un mètre par pixel
de 2,148 à 2 000 m et 1,803 à 900 m — un facteur 1,19 pour un facteur 2,2
d'altitude. **Je mesure 2,157 et 1,839**, soit un facteur **1,17**. Confirmé.

Et je peux la préciser : entre 5 000 et 2 000 m (facteur 2,5), le mètre par pixel
passe de 7,088 à 2,157, soit un facteur **3,29 — PLUS que proportionnel** ; puis
il se bloque. **La caméra cesse de descendre bien avant l'altitude de cadrage.**
C'est la butée de sol qui la couche, exactement comme CN2 le dit. Une loi fondée
sur la distance sous-lit alors d'un niveau, et **aucune marge globale ne peut la
rattraper sans dégrader autre chose**.

⚠️ **Et j'en ai trouvé une SECONDE, que CN2 ne mentionne pas.** Aux Alpes à
**300 m**, la loi demande encore **z15** (`_zCropServi` = 15, mesuré) là où
z15 = 1,662 m par texel pour ~0,7 m par pixel, soit ≈ **2,4 px par texel** —
au-dessus du barème, pour la même raison. Le crop ne passe à z16 qu'à **170 m**.
Il ne s'agit donc pas d'une cellule isolée mais d'un **creux entre 2 000 m et
170 m**, dont 2 000 m est le point le plus visible.

**Du point de vue d'Adrien — pas du barème — c'est acceptable, et voici pourquoi
je le dis avec un chiffre.** Sa plainte est *« quand je zoome, l'image ne gagne
pas en détail : elle grossit »*. Avant : **18,63 à 900 m et 48,99 à 600 m**,
c'est-à-dire un texel étalé sur cinquante pixels — la plainte, littéralement.
Après : 1,81 et 1,20. Le creux résiduel plafonne à **3,08**, soit **seize fois
moins que le pire d'avant**, et il ne concerne **pas** le cadrage de l'affiche
(5 000 m, 0,94). ⚠️ **Mais il faut le dire à Adrien**, parce que c'est le seul
endroit où sa phrase reste vraie, et CN2 n'en nomme qu'une moitié.

---

## 7. LES SIX TESTS — ⛔ **DEUX D'ENTRE EUX NE MORDENT PAS**

### Ils n'ont pas été affaiblis — vérifié à l'empreinte

`test/crop-nettete-ecran.test.js` est **identique à l'octet** entre CN1 et HEAD :
`md5 = 4b71c1aaaff9fe3acf0ed3d4197d45d2` des deux côtés. Le commit CN2 ne touche
**ni `test/`, ni `package.json`**. `npm test` : **4 935 · 4 935 · 0 échec**.
`npm run audit:tests` : **266 listés · 266 sur disque, aucun écart**. ✔

### La morsure, prouvée par mutation du produit

`scripts/mutation-cn3.mjs` — édition **en binaire** (`Buffer.indexOf`, jamais de
réécriture de fins de ligne), motif refusé s'il est ambigu, restauration vérifiée
à chaque tour. **`md5(src/globe.js)` = `b71b597466e4a3e42760ae8e3a97336f`
avant ET après les sept exécutions** ; 610 738 octets ; **0 CR, 10 567 LF**
comptés en binaire (pas de fausse alerte CRLF ici).

| mutation — ce qu'elle casse | ⓪ | ① | ② | ③ | ④ | ⑤ |
|---|---|---|---|---|---|---|
| *(dépôt)* | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **`loi-morte`** — `_zoomCropFin` rend toujours `ZOOM_SOCLE` | ✔ | **✖** | **✖** | ✔ | **✖** | ✔ |
| **`palier-mort`** — `_traverse` prescrit la CIBLE au lieu du SERVI | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **`couverture-plate`** — `_cropCouvert` énumère `L` au lieu des parents | **✖** | **✖** | **✖** | ✔ | **✖** | ✔ |
| **`priorite-morte`** — le bonus `PRIORITE_CROP` retiré | ✔ | ✔ | **✖** | ✔ | **✖** | ✔ |
| **`cout-libre`** — `TUILES_CROP_MAX` → 1e9, `ZOOM_CROP_MAX_DUR` → 20 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

**Ce qui mord, et pour la bonne raison :**
- **① ② ④** rougissent sous `loi-morte` avec le message exact d'Adrien :
  `la finesse servie est FIGÉE : z13 à 20 000 m et z13 à 900 m`. ✔
- **⓪** rougit sous `couverture-plate` : `le banc est inerte, les tests suivants
  ne prouvent RIEN`. Le témoin de vivacité fonctionne. ✔
- **② et ④** rougissent aussi sous `priorite-morte` : **l'ordre de service est
  bien nécessaire**, pas décoratif — sans le bonus, le palier n'arrive pas dans
  les 60 images du banc. C'est la confirmation indépendante d'une affirmation
  de CN2 que je pouvais réfuter, et qui tient. ✔

**Ce qui NE mord pas — et c'est mon reproche technique principal :**

⛔ **③, la garde de l'exigence NON NÉGOCIABLE d'Adrien, ne rougit sous AUCUNE
mutation.** Pas même sous `palier-mort`, qui **supprime le palier atomique tout
entier** — c'est-à-dire précisément le mécanisme que CN2 a écrit pour tenir cette
exigence, et dont il dit que sans lui on rejoue le `[11, 16]` de CN1. **La suite
passe 6/6, à l'identique, avec le cœur du correctif arraché.**

⛔ **⑤, la garde de coût, ne rougit pas non plus** : avec `TUILES_CROP_MAX` à un
milliard et le plafond de source à 20, le cache reste sous 900.

**La cause est le banc, pas l'assertion.** Le banc de papier résout ses dalles en
une microtâche : après 60 images tout est prêt à tous les niveaux, donc **aucune
image mixte ne peut jamais naître**. C'est le *« test de silhouette qui passe à
vide »* du §3 de la compétence. CN1 le dit lui-même en bas de son fichier (« le
banc rend ses dalles en une microtâche »), mais **en tire la conclusion pour le
clignotement, pas pour ③** — et ③ est justement celui qui décide de tout.

⚡ **Conséquence pour la note.** L'exigence non négociable d'Adrien n'est
**pas** protégée par la suite de tests. Elle n'est protégée que par la mesure
dans l'application — celle du §3, que j'ai refaite sur **8 279 images**. Le
correctif est bon ; **le filet ne l'est pas**, et un futur agent qui casserait
`_zCropServi` en croyant simplifier verrait 4 935 · 0.

---

## 8. ⛔ CE QUI EST REFUSÉ : LE CARTOUCHE, VÉRIFIÉ À L'ÉCRAN

CN2 annonce, dans son message de commit : *« Le cartouche cesse de sur-promettre :
il annonce le niveau réellement dessiné. »*

**Relevé sur le libellé réel du panneau, Majorque, `demZoom = 15` :**

| altitude | `_zCropServi` (dessiné) | libellé À L'ÉCRAN |
|---|---|---|
| 5 002 m | 13 | `Détail (zoom) — net à z13` ✔ |
| 900 m | **15** | ⛔ `Détail (zoom) — net à z13` |
| 300 m | **16** | ⛔ `Détail (zoom) — net à z13` |

**Puis, en touchant le sélecteur de zoom pour réveiller la liaison :**

| action | `_zCropServi` | libellé |
|---|---|---|
| `demZoom` → 14 | 15 | `net à z14` — *une valeur de retard* |
| `demZoom` → 15 | 15 | `net à z15` ✔ |

**Le diagnostic est net et la portée est minuscule.** Le libellé est calculé dans
une liaison réactive dont la seule dépendance est le sélecteur de zoom
(`}, zoomSel)` dans `src/ui/create-panel.js`). `getZoomCropServi()` change
plusieurs fois par descente ; **rien ne relance la liaison**. Le cartouche est
donc figé sur la dernière valeur vue au moment où l'on a touché le sélecteur —
et il est en plus **d'un cran en retard** quand on le réveille.

⛔ **Ce n'est pas un détail cosmétique, c'est le défaut d'origine avec le signe
inversé.** CN1 avait mesuré **deux niveaux de SUR-promesse** (le cartouche disait
Z15 pendant qu'on dessinait z13). Livré, il annonce **z13 pendant qu'on dessine
z16 : trois niveaux de SOUS-promesse.** La ligne « la région n'a rien de plus
fin » ne s'affichera pratiquement jamais non plus, pour la même raison. Et le
message de commit le présente comme fait.

**Ce qui manque, précisément, pour que je passe à 10 :**
1. **Relancer la liaison du libellé à chaque image** (ou sur changement de
   `_zCropServi`), et le prouver par le relevé ci-dessus rejoué. *Portée : une
   ligne dans `src/ui/create-panel.js` ou un appel dans `majFinesseCrop`.*
2. **Corriger deux phrases du message de commit et du rapport CN2** : « zéro
   image à deux niveaux » → « zéro aux altitudes de cadrage, 65 à 73 en
   transition d'arrivée, contre 118 avant » ; et le `⌈12,98⌉` → **11,84**, avec
   la vraie marge de 1,16 niveau.
3. **Écrire la dépendance à la hauteur de fenêtre** (bascule vers ~1 650 CSS px)
   et **la seconde poche du creux** (Alpes 300 m, ≈ 2,4 px par texel).
4. *(souhaitable, hors périmètre de cette fusion)* **Un test qui morde sur ③.**
   Le banc de papier ne peut pas en produire un : il faudrait retarder la
   résolution des dalles de quelques images pour qu'un raffinement partiel
   existe. Tant que ce test n'existe pas, l'exigence d'Adrien repose sur une
   mesure manuelle dans l'application.

---

## 9. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le pire texel de l'emprise est bien pire que celui du centre — CN1 mesure
   au mauvais endroit. »** Mon premier tirage rendait **9,04 aux Alpes à 600 m**
   contre 1,20 au centre : de quoi refuser le correctif. **Faux, et c'était mon
   banc.** L'écart analytique valait **598 %** : je mesurais des tuiles hors
   cadre. Une fois exigé que la tuile soit dans le cadre et que les deux mesures
   indépendantes du mètre par pixel se rejoignent à 25 % près, le pire vaut
   **1,32**. *J'ai failli publier le faux constat que la compétence décrit.*
2. **« La garde d'une seule finesse est cassée : je vois huit niveaux dans le
   même cadre. »** Vrai à 20 000 m — **et déjà vrai avant le correctif, en plus
   grand nombre (118 → 65-73).** Sans l'A/B, j'aurais imputé à CN2 un
   comportement qu'il améliore. *C'est le piège « A/B même session » du brief,
   et il m'a servi.*
3. **« `_cropCouvert` contient un point fixe : un enfant hors champ n'est jamais
   créé, donc jamais couvert, donc le palier gèle pour toujours. »** L'ordre des
   lignes le permet — `if (!t) return false` est **avant** le test de champ,
   alors que `_prelireCrop` ne demande que les enfants dans le champ. J'ai écrit
   `scripts/sonde-cn3-gel.mjs` exprès : descente, pivot franc pour sortir un bord
   du cadre, **palier remis à zéro comme le fait toute pose neuve**, puis 25 s
   d'observation. **Quatre tirages (Alpes 170 / 300 / 600 m, Majorque 600 m) :
   aucun gel.** Le palier remonte à 15, puis à 16 à 170 m. `_horsCropSeul` écarte
   déjà les enfants du dehors, et le tronc de vision inclut la marge de relief et
   la jupe, si bien que les enfants restants restent dans le champ. **Je maintiens
   que l'ordre des lignes est fragile ; je n'ai pas de mesure pour l'accuser, donc
   je ne l'accuse pas.**
4. **« Le cache explose de +17 %, CN2 a menti avec son +4 %. »** À moitié faux :
   j'ai mesuré **le même code, au même lieu, à 129 puis 332 tuiles**. Le +17 %
   des Alpes et le −5,6 % de Beauce sortent du même bruit. Ce qui est juste, ce
   n'est pas « +4 % » ni « +17 % », c'est **« l'ordre de grandeur ne change pas,
   et le barème a 2,2× de marge »**.
5. **« 12,98 : CN2 a trouvé une propriété élégante. »** Non — **11,84**. Une
   « propriété » qui réconcilie joliment deux chiffres sans avoir été mesurée :
   la compétence en avertit explicitement (*« méfiez-vous d'une explication qui
   réconcilie deux mesures sans avoir été vérifiée »*), et c'en était une.
6. **« Une suite 6/6 verte sur des tests écrits AVANT le correctif est une
   preuve forte. »** Faux ici. `palier-mort` arrache le cœur du correctif et la
   suite reste **6/6**. La suite prouve la LOI (① ② ④ ⓪) ; elle ne prouve **rien**
   du PALIER, qui est pourtant ce qui tient l'exigence non négociable.

---

## 10. LA NOTE, DÉTAILLÉE

| ce qui est noté | note | pourquoi |
|---|---|---|
| La loi de finesse | **10/10** | tenue aux quatre lieux, chiffres reproduits au centième, 48,99 → 1,20 sur le cas dur |
| La garde « une seule finesse » | **9/10** | 0 sur 8 279 images aux altitudes de cadrage, promotions comprises ; −40 % en transition. Retiré 1 pour l'énoncé absolu, faux |
| L'emprise | **10/10** | identique au mètre, aux quatre lieux et aux cinq altitudes |
| Le coût | **10/10** | 2,2× de marge sur le barème ; le ×16 expliqué et enterré |
| Le rendu à 5 000 m | **8/10** | inchangé, et **50× plus de marge que CN2 ne croyait** ; retiré 2 pour la nouvelle dépendance à la hauteur de fenêtre, non écrite |
| La réserve avouée | **8/10** | explication vérifiée au chiffre ; retiré 2 pour la SECONDE poche (300 m) passée sous silence |
| La morsure des tests | **4/10** | ③ et ⑤ ne rougissent sous aucune mutation ; le cœur du correctif est invisible à la suite |
| Le cartouche | **0/10** | ⛔ ne fonctionne pas, mesuré à l'écran, et annoncé comme fait |
| L'honnêteté du rapport CN2 | **8/10** | la cellule qui ne passe pas est avouée sans fard — c'est rare et ça vaut cher ; retiré 2 pour trois chiffres publiés au-delà de ce que le banc porte |

### ⚡ **NOTE GLOBALE : 7 / 10**

### VERDICT

✅ **FUSIONNER `src/globe.js` et la partie moteur de `src/main.js`.** Le correctif
fait ce qu'il annonce, là où ça compte, sans rien casser de ce qui était protégé.
Les trois exigences non négociables sont tenues, chacune avec son chiffre, mesuré
par moi.

⛔ **NE PAS FUSIONNER LE CARTOUCHE EN L'ÉTAT** (`getZoomCropServi` +
`contributeTerrainSections`) : livré, il annonce z13 pendant que la surface
dessine z16. Une ligne le répare ; tant qu'elle n'est pas écrite, ce morceau
livre un mensonge à l'écran, et le message de commit le présente comme résolu.

---

## 11. LES OUTILS DE CE RAPPORT

| fichier | ce qu'il fait |
|---|---|
| `scripts/sonde-cn3.mjs` | le banc : 4 phases, ~520 images par cellule, pire texel de l'emprise, vérificateur analytique, A/B |
| `scripts/sonde-cn3-loi.mjs` | ouvre les intermédiaires de `_zoomCropFin` — c'est lui qui a rendu 11,84 |
| `scripts/sonde-cn3-bascule.mjs` | balaye `hauteurPx` de 480 à 1600 et le pixel-ratio, dans l'application |
| `scripts/sonde-cn3-gel.mjs` | cherche le point fixe du palier ; **il ne l'a pas trouvé, et c'est le résultat** |
| `scripts/mutation-cn3.mjs` | six mutations du produit, table des couleurs, restauration md5 vérifiée |

`.banc/CN3/*.json` (ignoré par git) porte les 8 279 images, image par image.

**État du dépôt à la remise :** `git diff -- src/` **vide** ·
`md5(src/globe.js) = b71b597466e4a3e42760ae8e3a97336f` ·
`npm test` **4 935 · 4 935 · 0** · `npm run audit:tests` **aucun écart**.
