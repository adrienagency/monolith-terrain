# R23 — LES SAUTS DE CAMÉRA QUI RESTAIENT

Arbre `C:\Dev\wt-vit`, branche `vitesse-camera`. Serveur `npm run dev --port 5811`
(arrêté à la fin). Instrument : `scripts/sonde-vitesse-r23.mjs`, Chrome sans
tête 1280×800, sorties dans `.banc/R23/avant.json` et `.banc/R23/apres.json`.

**Le brief annonçait deux défauts. Il y en avait trois, le coordinateur en a
signalé le troisième en cours de route, et le premier n'était pas là où le brief
le croyait.** Les trois sont corrigés et mesurés.

---

## ① LE GESTE DE ROTATION — LES DEUX TABLES DE °/px

Glissé de **100 px**, bouton TENU du début à la fin (le globe tourne seul à
~2 °/s après 3 s : témoin `spin 4,5 s` = **2,834°** de visée, témoin nul bouton
tenu = **0,0000859°**, soit un rapport de 33 000 entre les deux — la précaution
est indispensable et elle est prouvée).

### AVANT (`.banc/R23/avant.json`)

| régime | `rotateSpeed` | **°/px mesuré** |
|---|---|---|
| orbite, 60 000 km | 1 | **0,447079** |
| orbite, 20 000 km | 1 | 0,447753 |
| orbite, 10 000 km | 1 | 0,447754 |
| orbite, 3 000 km | 0,659237 | 0,295406 |
| orbite, 1 000 km | 0,219746 | 0,0986888 |
| orbite, 300 km | 0,0659237 | 0,0296217 |
| orbite, 100 km | 0,0219746 | 0,00986896 |
| orbite, 40 km | **0,015** | **0,00672104** |
| **le bloc** | **1** | **0,447079** |

Neuf altitudes, deux régimes. Rapport entre les deux bouts : **×66,5**.

### APRÈS

| régime | `rotateSpeed` | **°/px mesuré** |
|---|---|---|
| orbite, 60 000 km | 1 | **0,447079** |
| orbite, 20 000 km | 1 | 0,447753 |
| orbite, 10 000 km | 1 | 0,447754 |
| orbite, 3 000 km | 1 | 0,447754 |
| orbite, 1 000 km | 1 | 0,447754 |
| orbite, 300 km | 1 | 0,447754 |
| orbite, 100 km | 1 | 0,447733 |
| orbite, 40 km | 1 | 0,447754 |
| **le bloc** | **1** | **0,447079** |

Écart total sur les neuf lignes : **0,447079 → 0,447754**, soit **0,15 %**, et
il ne vient pas de la loi — il vient de la hauteur de canevas (`360/800 = 0,450`
en théorie ; le canevas fait 804 px sous l'entête). **La loi, elle, est exacte :
`rotateSpeed = 1` partout.**

### LE RAPPORT MAXIMAL ENTRE IMAGES CONSÉCUTIVES AU FRANCHISSEMENT

Relevé **DANS la boucle** : `controls.update` est enveloppé, donc la valeur lue
est celle qui était en vigueur quand la loi de rotation s'est appliquée — pas un
état relu après coup.

| | descente relevée | pire rapport image → image | franchissement |
|---|---|---|---|
| avant | 1 810 images | **×1,0000** | 12 332 703 m → 11 373 125 m, `rotateSpeed` 1 → 1 |
| après | 1 809 images | **×1,0000** | 12 223 771 m → 11 264 894 m, `rotateSpeed` 1 → 1 |

⚠️ **ET C'EST LA PREMIÈRE CHOSE QUE J'AI CRUE PUIS RÉFUTÉE** — voir §④. Le
×66,67 n'était pas au franchissement du régime livré. Il l'était ailleurs, et le
correctif le ferme partout :

| régime | rapport au franchissement, AVANT | APRÈS |
|---|---|---|
| continu, lat 0° (porte à 12 931 170 m) | ×1,000 | ×1,000 |
| continu, lat 45,83° (porte à 9 009 884 m) | ×1,000 | ×1,000 |
| continu, lat 70° (porte à 4 422 720 m) | ×1,029 | ×1,000 |
| continu, lat 80° (porte à 2 245 474 m) | **×2,027** | ×1,000 |
| continu, lat 84° (porte à 1 351 675 m) | **×3,367** | ×1,000 |
| hérité `?terre=deux` (plongée à 8 000 m) | **×66,67** | ×1,000 |

**Deux des six lignes dépassaient le critère de 1,5, et le brief n'en connaissait
qu'une.** Ces chiffres sont calculés avec la loi même de l'application
(`niveauDArrivee` + `empriseBlocM`), pas avec un modèle — `test/vitesse-rotation.test.js`.

### CE QUI A ÉTÉ CHANGÉ, ET POURQUOI

`src/modes.js` : `clamp((orbAlt / R_GLOBE) × 1,4, 0,015, 1)` → **`1`**.

Le juge est le °/px, et il dit que le geste est **déjà le même** aux deux bouts
qu'Adrien juge parfaits — 0,447079 des deux côtés, même `OrbitControls`, même
loi. La loi d'altitude ne vivait que dans l'intervalle, c'est-à-dire le seul
endroit où le geste n'a jamais été jugé.

⚠️ **La réserve, publiée :** à basse altitude orbitale, tourner autour du centre
de la Terre (« on utilise le centre de la Terre comme point de rotation, excepté
en mode crop ») balaie 0,447° de longitude par pixel, soit ~50 km de sol. **À
l'écran, c'est pourtant exactement le geste de l'orbite haute** : le point de sol
au centre du cadre se déplace de `f × dθ` pixels quelle que soit l'altitude,
parce que le vecteur caméra → sol tourne du même angle des deux côtés. Ce qui
change avec l'altitude est le kilométrage, pas le geste. Et cet état n'est
atteignable qu'en régime hérité : en continu, la porte orbitale s'ouvre à
7–13 millions de mètres.

---

## ② LA HAUTEUR CAMÉRA − SOL

Geste relevé : glissé poussé **bien au-delà** de la course polaire, puis **360°
d'azimut EN RESTANT à la butée**, sur trois blocs z12 de montagne.

⛔ **Le lieu de départ ne prouve rien : il est plat.** Premier relevé, fait là :
hauteur minimale **+0,148 u**, zéro image sous le sol, et **le même nombre sur
trois gestes différents** — le sol sous la caméra ne variait pas d'un centimètre.
C'est un plan d'eau. Toutes les mesures ci-dessous sont donc au Mont-Blanc, au
Cervin et à l'Everest.

### AVANT — la caméra est dans la montagne

| bloc z12 | hauteur caméra − sol, minimum | images sous le sol |
|---|---|---|
| Mont-Blanc | **−11,7616 u** | **450 / 505** (89 %) |
| Cervin | −8,6115 u | 155 / 504 |
| Everest | **−11,8422 u** | 173 / 504 |

**−11,8422 unités** valent, à 462,8 m par unité sur ce bloc, **−5 481 m de relief
DESSINÉ**, soit **−2 740 m de relief RÉEL** (l'exagération unique vaut ×2). ⚠️
Les deux chiffres sont publiés : le premier est la profondeur dans la scène, le
second ce que ça vaut sur la carte.

### APRÈS — 15 configurations, 5 distances × 3 lieux, 7 569 images

| | avant | après |
|---|---|---|
| **hauteur minimale relevée** | **−11,8422 u** | **−0,9577 u** |
| en mètres dessinés | −5 481 m | −350 m |
| en mètres réels | −2 740 m | −175 m |
| images sous le sol | jusqu'à **450 / 505** sur un seul geste | **12 / 7 569** (0,16 %) |
| configurations à zéro image sous le sol | 0 / 12 | **8 / 15** |
| hauteur minimale sur la descente complète | 5,9608 u (mer, sans contrainte) | **1,0091 u** (= la marge, exactement) |

⛔ **JE N'ÉCRIS PAS « JAMAIS ».** Il reste **12 images sur 7 569**, une par geste
au plus, et jamais plus de **0,96 unité** sous la surface — c'est-à-dire dans la
bande de marge, pas dans la montagne. La réserve est ouverte au §⑤.

### CE QUI A ÉTÉ CHANGÉ

`88,2° = Math.PI × 0,49` est **une valeur de mode plat**, et le nombre qui lui
manquait n'est pas un facteur : ce sont **la distance et le relief**. La hauteur
de la caméra au-dessus de la cible vaut `d × cos φ` ; à la butée,
`cos(88,2°) = 0,0314`, donc **4,71 unités seulement à `d = 150`**, pendant qu'un
sommet du bloc en fait 16.

Nouveau module pur et testé **`src/monde/butee-sol.js`**, trois lois :

1. **`polaireMaxSol`** — on parcourt le chemin que la caméra emprunterait en
   s'inclinant (azimut constant, `φ` de 0 à 88,2°, 48 pas + dichotomie sur le
   dernier) et on s'arrête au dernier angle qui dégage la marge. `88,2°` reste
   le **plafond dur**, il n'est plus la loi.
2. **`distanceMinSol`** — un plancher de distance, parce que la butée d'angle ne
   peut rien quand la **cible est enterrée** : `_cibleVisee` pose
   `y = Y_CIBLE = −0,3` — une constante de plus — là où le sol monte à 14 unités.
   Le plancher lit le sol sur **le cercle que la cible décrit autour de l'axe du
   bloc**, à des angles ABSOLUS, donc il est **invariant par la rotation** (voir
   §③) ; il est plafonné par `maxDistance`.
3. **le redressement après le pivot** (`redresserSurLeSol`, `main.js`) — parce
   que R13 fait tourner la caméra autour de **l'axe du bloc**, pas de la cible :
   avec une cible à 20 unités de l'axe et 10,7° d'azimut par pas de souris, la
   translation vaut **~3,7 unités par image**, et la caméra change de montagne
   entre deux images. On recalcule après le pivot et on **réduit `φ` à distance
   constante**.

`⛔ MARGE_SOL_U = 1` n'est pas choisi : `planProche` sature à `NEAR_MAX = 0,5`
(`loi-altitude.js`), donc une marge plus petite laisserait le sol traverser le
plan de coupe avant de toucher la caméra. La marge vaut **deux fois** le plan
proche saturé, et un test le vérifie.

⚠️ **La butée ne claque pas.** Pas d'angle polaire maximal d'une image à la
suivante, hors téléportations du banc : **1,3 à 4,7°**, et la loi elle-même varie
de moins de **3,675°** (un pas de grille) par image sur une course complète —
la dichotomie du dernier pas a été ajoutée exactement pour ça (sans elle, la
grille rendait **14,700° en une image**).

---

## ③ `veille-repos` NE VOIT RIEN, ET D16 ter TIENT

`SEUIL_BOUGE_LOG = 1e-4`. Relevé `|Δ ln(distance caméra→cible)|` sur chaque
glissé, après convergence du damping (150 images, bouton tenu) :

| glissé | `|Δ ln d|` | contre le seuil |
|---|---|---|
| bloc, horizontal 100 px | **0,00000** | — |
| bloc, vertical 100 px | **1,11e-15** | 9,0 × 10¹⁰ fois sous le seuil |
| orbite, huit altitudes | 0 à **2,22e-16** | ≥ 4,5 × 10¹¹ fois sous le seuil |

**Le maximum relevé, toutes poses confondues, est 1,11e-15 — soit 1/90 000 000 000
du seuil.** C'est le bruit du `double`, pas un mouvement.

⚠️ **Et ce n'est pas un hasard de réglage** : aucun des trois correctifs n'écrit
`controls.target`, et aucun ne change la distance sous rotation.
`polaireMaxSol` borne un ANGLE ; le redressement réduit `φ` **autour de la
cible, à rayon constant** ; le plancher de distance lit le sol sur un cercle
**invariant** par la rotation rigide (mesuré : un échantillonnage qui tournait
avec la cible faisait varier le plancher de **0,2500 unité par tour** — c'est ce
premier jet qui aurait dépensé D16 ter, et un test le verrouille).

**D16 ter** — la bascule de trois quarts arrive au bloc, pas avant. Inclinaison
au nadir local relevée par image sur toute la portion orbitale de la descente :

| | inclinaison maximale EN ORBITE |
|---|---|
| R13 (971 images) | 0,000057° |
| R23 avant (1 810 images) | 0,000001° |
| **R23 après (1 809 images)** | **0,000002°** |

La traversée pose toujours le nadir et met la bascule en attente : rien n'a
bougé.

---

## ④ LE TROISIÈME DÉFAUT — LA TRANSITION À SENS UNIQUE

Signalé par le coordinateur en cours de tâche, **reproduit**, **mesuré**,
**corrigé**.

⛔ **Il ne se reproduit PAS si l'on dézoome à la pente d'arrivée** — 349 images,
13 niveaux, l'orbite atteinte. C'est le cas le plus favorable, et c'est celui que
mes deux premiers bancs avaient pris. **Il faut coucher la vue vers l'horizon**,
c'est-à-dire faire ce que fait un utilisateur :

| geste de dézoom | images | orbite atteinte | niveaux | état final |
|---|---|---|---|---|
| pente d'arrivée, AVANT | 349 | oui | 13 | z3 → orbite |
| **couchée vers l'horizon, AVANT** | **1 500** | ⛔ **JAMAIS** | 2 | z11, `d = 150 / plafond 150`, **budget figé à 0,68782** |
| pente d'arrivée, APRÈS | 360 | oui | 13 | z3 → orbite |
| **couchée vers l'horizon, APRÈS** | **338** | ✅ **oui** | 12 | z3 → orbite |

Un niveau vaut `ln 2 = 0,69315`. **Il manquait 0,00533, définitivement.**

### LE FACTEUR, ÉTABLI AVANT DE DÉCIDER (le coordinateur l'a demandé)

⛔ **Je n'ai PAS remonté `maxDistance`, et je n'ai pas touché `SEUIL_MORT_M`.**
Le facteur demandé est celui-ci : `distance = (camY − yCible) / cos φ`. À la
butée polaire `cos(88,2°) = 0,0314` ; à la pente d'arrivée, `0,68774`. **La même
altitude coûte 21,9 fois plus de distance quand la vue est couchée.** Donc
`maxDistance = 150` borne une **distance** là où ce qu'il faut borner est une
**altitude** — c'est exactement la famille de `0,49π`, et c'est pour ça que ni la
butée ni le seuil ne sont le bon endroit.

### LE CORRECTIF

`_applyZoom` (`src/modes.js`) : **le compteur de niveau encaisse l'INTENTION du
geste, pas le déplacement clippé** ; la butée continue de tenir la caméra. Le
franchissement DIVISE la distance par deux (`poseApresNiveau` conserve
l'altitude de fond) : il fait donc lui-même la place que la butée refuse. Et
l'élan ne meurt plus sur une butée qui va s'ouvrir — sinon le franchissement
redeviendrait dépendant d'un re-défilement, c'est-à-dire le cran que la Tâche M
a supprimé, revenu par la fenêtre.

⚠️ **Asymétrique, et volontairement** : vers l'extérieur il y a toujours un
niveau (un cran plus large, ou la porte orbitale) ; vers l'intérieur, au zoom
fin, il n'y a plus rien à affiner, donc le compteur ne court pas. Neuf tests
(`test/retour-orbite.test.js`) sur la machine à modes réelle, dont le témoin
« hors régime continu, RIEN ne change ».

**Effet de bord mesuré et voulu** : la descente atteint désormais le zoom fin au
lieu de s'arrêter à `minDistance` du niveau courant — le même défaut, dans
l'autre sens, se refermait aussi.

---

## ⑤ CE QUE J'AI CRU PUIS RÉFUTÉ

**Neuf choses, et les trois premières ont changé la tâche.**

1. ⛔ **« Le saut de ×66,67 est au franchissement. »** Faux dans le régime livré.
   La porte orbitale est GÉOMÉTRIQUE (`niveauDArrivee`) et s'ouvre entre **7 et
   13 millions de mètres** ; le genou de la loi tombait à `R_GLOBE / 1,4 =
   4 550 714 m`. **`rotateSpeed` valait donc déjà 1 des deux côtés** : 1 810
   images relevées, pire rapport image à image **×1,0000**. Le ×66,67 est réel,
   mais dans le régime hérité `?terre=deux` (plongée à 8 000 m). ⚡ **En
   revanche, le brief ratait un cas qu'il ne pouvait pas connaître : aux hautes
   latitudes le bloc rétrécit en `cos(lat)`, la porte descend sous le genou, et
   le rapport atteignait ×2,027 à 80° et ×3,367 à 84° — dans le régime livré.**

2. ⛔ **« `Input.dispatchMouseEvent` type `mouseWheel` n'atteint pas l'appli —
   0 cran sur 175. »** Réfuté : **40 crans tirés, 40 reçus** par
   `modes._zoomGesture` (compteur posé sur le gestionnaire lui-même). ⚡ **Le
   vrai coupable est le voile d'accueil**, `.ce-hubveil` (z-index 56,
   `pointer-events: auto`) : `document.elementFromPoint(640, 400)` rend
   `BUTTON.ce-wm-btn`, et un compteur posé sur le canevas relève **0
   `pointerdown` sur 20 gestes tirés**. Il ne mange pas que la molette, **il
   mange TOUS les gestes** — et pas seulement le premier, contrairement à ce que
   note la sonde R13. Levé le voile, tout arrive. *(La sonde R13 « marchait »
   parce que son premier glissé CLIQUAIT le bouton du voile et le refermait.)*

3. ⛔ **« Mon premier relevé de butée est bon. »** Il rendait **59,330° d'angle
   polaire, identique sur six relevés à quatre lieux différents** : c'était la
   pose d'ouverture, jamais touchée. Six chiffres cohérents et tous faux.

4. ⛔ **« Le lieu de départ vaut comme lieu de mesure. »** Il est plat.
   Hauteur minimale **+0,148 u**, zéro image sous le sol — et le même nombre sur
   trois gestes, ce qui aurait dû se voir tout de suite. Le défaut ② y est
   structurellement invisible.

5. ⛔ **« La butée polaire suffit à sortir la caméra du sol. »** Après ce seul
   correctif : **−7,3730 u** encore, sur 276 images de 504. Cause : la rotation
   **rigide** de R13 tourne autour de l'axe du bloc, pas de la cible, et déplace
   la caméra de ~3,7 unités par image. D'où le redressement APRÈS le pivot.

6. ⛔ **« Et là ça suffit. »** Non : **−5,0982 u sur 504 images de 504** à
   `d = 6`, avec une butée qui rendait 0 sans rien pouvoir. Cause : **la cible
   est enterrée** (`Y_CIBLE = −0,3`, encore une constante de mode plat). D'où le
   plancher de distance.

7. ⛔ **« Le sommet du disque de rayon `d` est la bonne borne. »** À `d = 6` avec
   un sommet à 16 unités, cette borne **interdit toute inclinaison** — elle
   supprime la vue de trois quarts, qui EST le produit. On suit le CHEMIN de la
   caméra, pas le maximum du bloc.

8. ⛔ **« Échantillonner le cercle en partant de la cible est invariant. »** Il
   variait de **0,2500 unité par tour**, donc le plancher bougeait pendant un
   glissé, donc `OrbitControls` aurait écrêté le rayon — **c'est-à-dire dépensé
   D16 ter**. Angles absolus : invariance exacte, et un test la verrouille.

9. ⛔ **« Mon relevé d'inclinaison est bon. »** Il rendait **21,26° en orbite**
   là où D16 ter en attend 0,000057. Je mesurais l'angle du vecteur
   cible → caméra contre l'axe `y` du monde, c'est-à-dire **la latitude du point
   survolé**. En orbite la verticale locale est le RAYON. Corrigé : 0,000002°.

⚠️ **Et une chose que je n'ai pas eu à réfuter, parce que je ne l'ai pas
employée :** l'avertissement du coordinateur sur `palier.signaux.ecran = [0, 0]`.
Aucune de mes mesures ne dépend du palier machine — ni le °/px (loi
d'`OrbitControls` et hauteur de canevas), ni la hauteur sol (géométrie), ni le
budget de niveau. Le point reste ouvert pour qui mesurera du coût.

---

## ⑥ RÉSERVES OUVERTES

1. ⛔ **12 images sur 7 569 restent sous le sol**, jamais plus de **0,9577
   unité** (−350 m dessinés, −175 m réels), une par geste au plus. Elles
   subsistent après avoir sorti le redressement de la branche `surface` (ce qui
   les a fait tomber de −3,5735 u à −0,9577 u). **La piste non close** : une
   écriture de caméra qui appelle `controls.update()` elle-même et se fait
   relever avant le redressement de l'image suivante. Pour la fermer, il faut
   instrumenter chaque site d'écriture de `camera.position` en mode surface, pas
   seulement `controls.update`.

2. ⛔ **`Y_CIBLE = −0,3` est une constante de mode plat, et c'est la CAUSE
   PROFONDE du §②.** La cible devrait être sur le sol. Je ne l'ai pas touchée :
   elle est câblée dans `poseFranchissement`, `distancePourAltitudeFond`,
   `poseFonduArrivee` et les lois d'altitude, et la déplacer est un chantier à
   part. Le plancher de distance est un contournement mesuré, pas une réparation.

3. ⚠️ **`minDistance` a désormais un second site d'écriture** (la boucle
   d'image de `main.js`), alors que la Tâche 1b avait rassemblé les quatre
   recopies littérales dans `Modes._poseButees`. Ce site-ci est une **loi** dans
   un module pur et testé, et elle doit courir par image parce que le relief sous
   la cible change quand la fenêtre glisse. `_poseButees` reste le seul endroit
   qui pose la valeur de base, passée en `plancher`. **C'est un choix, il se
   discute.**

4. ⚠️ **Le coût par image n'a pas été chiffré.** Les trois lois échantillonnent
   le terrain **48 + 14 + 32 = 94 fois par image** en mode surface. C'est un
   appel de closure par échantillon, aucune allocation — mais ce n'est pas
   mesuré, et un « coût indiscernable de zéro » non mesuré est exactement ce que
   `lecons-campagne-R.md` §② reproche.

---

## ⑦ LES CHIFFRES DE CLÔTURE

| | valeur |
|---|---|
| `npm test` | **4 456 tests · 0 échec** (base à battre : 4 422) |
| tests ajoutés | **34** en 3 fichiers |
| `npm run audit:tests` | **232 listés · 232 sur disque · aucun écart** |
| fichiers de test inscrits dans `package.json` | `butee-sol`, `vitesse-rotation`, `retour-orbite` |

### FICHIERS TOUCHÉS

| fichier | quoi |
|---|---|
| `src/monde/butee-sol.js` | **neuf** — module pur : `polaireMaxSol`, `distanceMinSol`, `POLAIRE_MAX_DURE`, `MARGE_SOL_U` |
| `src/modes.js` | `rotateSpeed = 1` en orbite · le budget de niveau encaisse l'intention · `POLAIRE_MAX_DURE` au lieu du littéral |
| `src/main.js` | butée polaire et plancher de distance par image · redressement après le pivot · `POLAIRE_MAX_DURE` au lieu du littéral |
| `scripts/sonde-vitesse-r23.mjs` | **neuf** — l'instrument (°/px par glissé et par image, hauteur sol, remontée, témoins) |
| `test/butee-sol.test.js`, `test/vitesse-rotation.test.js`, `test/retour-orbite.test.js` | **neufs** |
| `package.json` | la liste explicite des tests |

⛔ **Rien touché dans le périmètre des trois autres agents** : ni le nuanceur de
`src/globe.js`, ni `habillage-crop.js`, ni `light-panel.js`, ni les nuages.
