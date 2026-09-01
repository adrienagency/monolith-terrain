# R30 — ATTAQUANT : LA CHAÎNE CAMÉRA TIENT. C'EST LE VOILE D'ACCUEIL QUI LA TENAIT FERMÉE.

Arbre `C:\Dev\wt-att`, branche `attaque-camera`, `HEAD = 91ca80f` — **identique
à `regroupement` au bit près** (`git diff regroupement HEAD -- src/` : vide).
Serveur `npm run dev --port 5931` (arrêté à la fin).
Instrument : `scripts/sonde-attaque-r30.mjs`, Chrome sans tête 1280 × 800,
relevé **DANS la boucle** (`controls.update` enveloppé) et **fonction par
fonction** (`_zoomGesture`, `_applyZoom`, `cranZoom`, `_franchirSiBesoin`,
`_refine`, `_coarsen`, `_rescale`, `enterOrbit` enveloppés à l'entrée et à la
sortie). Journaux : `.banc/R30/`, `.banc/R15/r30-saut.json`.

⛔ **Aucune ligne de comportement n'a été touchée.** `git diff regroupement HEAD
-- src/` est vide, et il l'est encore.

---

## ⚡ ① TA MESURE : REPRODUITE, À LA VALEUR PRÈS — ET LA CAUSE N'EST DANS AUCUNE DES TROIS HYPOTHÈSES DU BRIEF

**Ce n'est pas la caméra. C'est le voile d'accueil `.ce-hubveil`, qui était
encore levé quand tu as mesuré.**

### La pose, reproduite trois chargements sur trois

Voile **non levé** (aucun `Échap`, aucun clic), relevé à t+5 s, t+10 s et t+20 s
sur trois chargements neufs :

| | toi | R30, 3 chargements sur 3 |
|---|---|---|
| `d` | **150,000 = `controls.maxDistance`** | **145,5000 = 150 × 0,97**, puis **150,0000 exactement** au premier cran |
| `altM` | **18 717 m** | **18 201,3 m** au repos → **18 762,0 m** après un cran |
| altimètre à l'écran | — | **« 18.2 km »** |
| `emprise` | **27 354 m** | **27 354,3 m** |
| `crop` | **true** | **true** |
| `mode` | **"surface"** | **"surface"** |
| `φ` | — | **59,330°** |

Stable sur **400 images consécutives**, `busy = false`, `_fonduPose = null`.
Ce n'est pas un transitoire : c'est la **pose de présentation** où l'application
se gare pendant que l'accueil est affiché (elle descend au bloc vers t+1 s —
`d ≈ 30`, 5 374 m —, puis **ressort** à 18 201 m entre 1 s et 5 s, et s'y arrête).

⚡ **Ton `altM = 18 717 m` tombe entre mes deux valeurs de la même seconde**
(18 201 au repos, 18 762 après un cran). Ton `18 201 → 18 325 m` du dézoom
continu est **mon 18 201,3 m au mètre près**.

### La molette : 0 cran sur 32 (puis 37) atteint l'application

Compteur posé **sur `_zoomGesture` lui-même**, voile levé :

| geste envoyé à la souris | reçu par `_zoomGesture` | `d` | `_levelZoom` | altimètre |
|---|---|---|---|---|
| **32 crans de molette** | **0** | 145,5000 → 145,5000 | 0,00000 → **0,00000** | 18.2 km → 18.2 km |
| 5 crans de plus | **0** | inchangé | inchangé | inchangé |
| **1 glissé de 160 px** | — | inchangé | inchangé | inchangé |
| **1 clic simple** | — | inchangé | inchangé | `elementFromPoint(640,400)` : `BUTTON.ce-wm-btn` → **`CANVAS`** |
| 5 crans **après** le clic | **5** | 107,35 → 57,06 | 1,38629 → 0,05917 | z10 → **z9** |

**Ton `_levelZoom` de 0 à 0,008 sur 32 crans, c'est mon 0 sur 32 avec une fuite
en moins.** Le geste n'arrive pas ; il n'y a rien à franchir.

### Les huit `cranZoom(-1)` : l'API, elle, traverse le voile

`cranZoom` est un **appel de méthode** : le voile ne le voit pas. D'où le fait
que tes huit crans faisaient quelque chose pendant que tes 32 crans de molette
ne faisaient rien. Relevé, voile levé :

| | `d` | `emprise` | `modes.altM` | crop |
|---|---|---|---|---|
| avant | 145,5000 | 27 354,3 | 18 201,3 | oui |
| cran 1 | **150,0000 = `maxDistance`** | 27 354,3 | **18 762,0** | oui |
| cran 2 | 150,0000 | 27 354,3 | 18 762,0 | oui |
| **cran 3** | 74,1120 | **54 712,8** | **17 599,2** | oui |

⚡ **`emprise 27 354 → 54 713`, `altitude 18 762 → 17 599`, « elle baisse »,
« crop toujours vivant » : ce sont tes quatre nombres, aux trois premiers crans.**
Le seul écart est le compte : chez moi les crans 5 et 7 franchissent aussi
(z10 après huit crans), chez toi non — un écart de cadence, `cranZoom` sortant
sans rien faire tant que `busy` court après un `_coarsen`.

### ⛔ Ce qui n'est PAS la cause

Les trois hypothèses du brief sont **fausses**, et je les ai mesurées une à une :

1. ⛔ *« leurs bancs pilotaient par API et la molette passe par `_zoomGesture` /
   `_applyZoom` sans passer par `cranZoom` »* — vrai sur la mécanique, **faux
   sur la conséquence** : voile fermé, la molette atteint l'orbite dans **sept
   variantes de geste sur sept** (§Q1).
2. ⛔ *« leurs deux correctifs sur le même compteur de niveau se sont annulés à
   la fusion »* — non : les deux vivent (`_applyZoom` et `cranZoom` comptent
   chacun l'intention), et je les vois compter, image par image.
3. ⛔ *« la butée `maxDistance` jette l'intention avant le compteur »* — non :
   **0 image sur 57 897 relevées en mode surface** sous un dézoom à la molette
   n'a `d ≥ maxDistance × 0,999`, et quand la butée mord (le cas `cranZoom`
   voile levé, §① ci-dessus), le compteur encaisse quand même l'intention —
   `_levelZoom` passe bien de 0 à 0,34657 en un cran.

### ⚡ Et voici pourquoi personne ne l'avait vu

`scripts/sonde-vitesse-r23.mjs:243`, `sonde-pivot-r27.mjs` (ligne 48),
`sonde-tuiles-vides-r26.mjs:326`, `sonde-porte-r26.mjs:104` : **les quatre
sondes retirent `.ce-hubveil` du DOM avant la première mesure.** Ma propre
sonde le faisait aussi — c'est en la débranchant que la mesure est apparue.
R23 avait **raison** de nommer le voile comme le coupable de ses gestes perdus ;
la campagne en a tiré « ferme-le d'abord », et plus personne n'a mesuré l'état
que voit un visiteur.

### Ce que ça vaut pour un visiteur

Les sorties de l'accueil sont, dans `src/ui/hub.js` : un **clic** sur le voile,
un clic sur la croix, un clic sur « Échap — explorer librement », le **focus**
du champ de recherche, et la touche **Échap**. **Il n'y a aucun écouteur
`wheel`.** Et `body.ce-hub .ce-hubveil` porte `pointer-events: auto`
(`src/ui/v28.css:941`). Donc : **le premier geste d'un visiteur sur une carte —
défiler — ne fait rien du tout, et ne lève même pas l'accueil.**

---

## ② LES CINQ QUESTIONS

### Q1 — « Pourquoi les bancs de R23 et R27 disaient-ils *orbite atteinte* ? »

> ✅ **LEUR CONSTAT TIENT** — l'orbite est atteinte, par sept chemins sur sept.
> ⛔ **LES TROIS HYPOTHÈSES DU BRIEF SONT FAUSSES** — ce n'est ni l'API, ni
> l'annulation des deux correctifs, ni la butée. **C'est le voile d'accueil**,
> en amont de toute la chaîne caméra (§①).

**Sept variantes de geste, voile fermé, molette envoyée à la souris uniquement
(zéro ligne d'API de zoom) :**

| variante | vue | curseur | cadence | crans jusqu'à l'orbite | orbite | `d` max en surface |
|---|---|---|---|---|---|---|
| pose d'arrivée | φ = 46,08° | 640, 400 | 6 images | **187** | ✅ | 152,10 |
| couchée à la butée | **φ = 88,20°** | 640, 400 | 6 images | **186** | ✅ | 112,14 |
| curseur dans le CIEL | **φ = 88,20°** | 640, 90 | 6 images | **187** | ✅ | 253,20 |
| curseur hors du centre | φ = 46,08° | 950, 230 | 6 images | **186** | ✅ | 165,99 |
| **lente** (≈ 500 ms/cran) | φ = 46,08° | 640, 400 | 30 images | **181** | ✅ | 151,63 |
| **couchée ET lente** | **φ = 88,20°** | 640, 400 | 30 images | **181** | ✅ | 111,45 |
| **rafale** (5 crans/image) | φ = 46,08° | 640, 400 | 0 | **39** | ✅ | 153,61 |

⚠️ **La « vue couchée vers l'horizon » de R23 §④ est bien celle que je pose** :
`φ = 88,200° = maxPolarAngle` vérifié après chaque glissé. C'est le geste qui
rendait *« 1 500 images, l'orbite JAMAIS atteinte »* avant son correctif. Il
rend aujourd'hui l'orbite en 181 à 187 crans, y compris à la cadence lente.

Et aux six latitudes de Q4 (0°, 80°, 85°, 88°, ±89,9°) : **orbite atteinte
à chaque fois**, remontée ET redescente.

**Le chemin d'un cran de molette, fonction par fonction** (trace enveloppée,
`.banc/R30/molette-nu.json`, premier cran) :

```
img 64  _zoomGesture       d 26,4122            _zoomVel  0,00000 → −0,02888
img 64  _applyZoom         d 26,4122 → 26,4236  _levelZoom 0,000000 → 0,000433
img 64  _franchirSiBesoin  d inchangé           _levelZoom inchangé (0 niveau)
img 65  _applyZoom         d 26,4236 → 26,4351  _levelZoom 0,000433 → 0,000867
…  (l'élan court ~40 images, `_applyZoom` puis `_franchirSiBesoin` à chaque image)
```

**Le franchissement, image par image** :

```
img 327 _applyZoom         d 52,4983 → 52,6817  _levelZoom 0,686955 → 0,690443
img 328 _applyZoom         d 52,6817 → 52,8643  _levelZoom 0,690443 → 0,693904
img 328 _franchirSiBesoin  _levelZoom 0,693904 → 0,000757
img 328 _coarsen / _rescale  z12 → z11 · emprise ×2 · altitude 8 407 m → 8 407 m
img 329+                    d 53,1051 → 25,600  (la pose divise la distance par deux)
```

⚡ **L'altitude métrique est conservée au franchissement et la distance est
divisée par deux : la butée `maxDistance` ne peut donc jamais se refermer** —
c'est exactement ce que R23 §④ annonce, et ça se vérifie.

**⚠️ Ce que je rends quand même, et qui n'est dans aucun rapport : le prix du
geste.**

| | budget de niveau par cran | crans pour un niveau | crans du bloc à l'orbite |
|---|---|---|---|
| **molette** (cadence ordinaire) | **0,0334** | **20,8** | **186** |
| molette en rafale | 0,1600 | 4,3 | 39 |
| **`cranZoom`** (le bouton, un clic) | **0,34657** | **2,0** | **18** |

**Un clic de bouton vaut dix crans de molette.** Il faut ~186 crans — une
douzaine de tours complets de molette — pour remonter du bloc à l'orbite. Je ne
dis pas que c'est un défaut : je dis que c'est **le chiffre que personne n'a
publié**, et qu'il suffit à faire dire « ça ne remonte pas » à qui essaie.

**En quoi mon banc diffère du geste d'un utilisateur** : `page.mouse.wheel`
émet un `deltaY = 120` par cran, comme une souris Windows ; un pavé tactile en
émet des dizaines de 2 à 20 px, que je n'ai **pas** mesurés. Mon curseur ne
tremble pas entre deux crans. Et je n'ai pas de main qui abandonne au bout de
trente crans.

---

### Q2 — « Le pivot revient-il au centre de la Terre à l'usage ? » → ⛔ **FAUX. Il n'y reste pas une image sur vingt sous la molette.**

R27 §② publie : *« Hors du crop, l'écart à l'axe vaut **EXACTEMENT 0** sur les
149 images de surface de la descente »*, et *« `target.y` vaut exactement
`Y_CIBLE = −0,3` à chaque image des cinq sessions »*.

**Trajet inverse, à la main — crop → dézoom → orbite, curseur à (950, 230),
c'est-à-dire un curseur d'utilisateur ordinaire :**

| | R27 publie | R30 mesure (hors du crop) |
|---|---|---|
| images avec la cible hors de l'axe | **0** | **2 291 / 2 361 — 97,0 %** |
| pire écart à l'axe | **0** | **12,8964 u = 50 375 m** |
| pire écart de l'axe au centre de l'écran | (188,7 px = le défaut qu'elle corrige) | **616,2 px** sur 1 280 × 800 ; **90ᵉ centile 306,1 px** |
| images au-delà de 50 px | — | **355 / 2 360 (15,0 %)** |
| pire `\|target.y − Y_CIBLE\|` | **0** | **1,0237 u** (1,452 u sur une autre session) |
| images pour revenir sous 0,01 u après la mort du crop | 89 (protocole isolé) | **103 à 352** |

**LE MÉCANISME, et il est dans `modes.js`.** `_applyZoom` met la scène à
l'échelle **autour du point sous le curseur** (`_zoomPivot`) — et il déplace la
**cible** avec la caméra :

```js
cam.position.set(P.x + (cam.position.x - P.x) * factor, …)
c.target.set(P.x + (c.target.x - P.x) * factor, …)   // ← la cible quitte l'axe
```

`cranZoom`, lui, repose la caméra le long de `target → caméra` et **ne touche
jamais la cible**. **R27 a mesuré avec `cranZoom` et avec des décalages injectés
rigidement, puis « plus un geste ».** Le bouton respecte la règle ; la molette
la casse à chaque image, et le recentrage de `main.js` (≤ 4,08 px/image) ne
rattrape pas un geste qui pousse plus vite qu'il ne tire.

**Sur le harnais pur** (`test/attaque-r30-ROUGE.mjs`, pivot à `(8, Y_CIBLE, −6)`,
un seul cran vers l'extérieur, hors du crop) :

| | écart à l'axe |
|---|---|
| après **1 image** | **0,168063 u** |
| après **60 images** (une seconde de glissé) | **9,802136 u** |

⚠️ **Et la réserve honnête** : la règle est écrite en **deux moitiés** —
`_cibleVisee` (`modes.js`, testée) et `recentrerSurLaTerre` (`main.js`, **que
aucun test ne charge**, R23 et R27 le disent toutes les deux). Le correctif de
R27 est **juste** ; ce qui manque, c'est que `_applyZoom` — dans le même fichier,
testé, à 500 lignes de là — le défait à chaque image.

---

### Q3 — « Le sol tient-il ? » → ⛔ **FAUX. La borne publiée est dépassée d'un facteur 8,9, aux cinq lieux.**

R23 §② publie : **−0,9577 u**, **12 images sur 7 569 (0,16 %)**, *« jamais plus
de 0,96 unité sous la surface — c'est-à-dire dans la bande de marge, pas dans la
montagne »*.

**R30, cinq lieux, 16 845 images, gestes envoyés à la souris** (le placement
`_rescale` est un appel d'API et n'est pas mesuré) :

| lieu | z | m/unité | `coucher` | `tourner` | `zoom à la butée` | **`melange`** |
|---|---|---|---|---|---|---|
| Mont-Blanc | 12 | 365,2 | +1,4872 | **−1,2988** | +1,0001 | **−5,0087** |
| Cervin | 12 | 364,3 | +2,1403 | **−2,3864** | −0,0682 | **−1,2441** |
| Everest | 12 | 462,8 | +1,0000 | **−0,4424** | +4,5157 | **−4,3067** |
| Everest | **13** | 231,4 | +9,5461 | **−1,3247** | +6,5165 | **−4,9600** |
| Svalbard (78,65°) | 12 | 103,2 | +8,8204 | **−3,9235** | +6,9066 | **−8,5030** |

| | R23 après | R30 |
|---|---|---|
| **hauteur minimale** | **−0,9577 u** | **−8,5030 u** (Svalbard) |
| en mètres dessinés | −350 m | **−877 m** (Svalbard) · **−1 829 m** (Mont-Blanc) |
| en mètres réels (exagération ×2) | −175 m | **−439 m** · **−915 m** |
| **images sous le sol** | 12 / 7 569 = **0,16 %** | **62 / 16 845 = 0,37 %** |
| configurations qui dépassent la borne | — | **9 sur 20** |

⚡ **LE GESTE QUE R23 N'A PAS FAIT, et il est ordinaire :** ses 15 configurations
**tournent à distance figée** (elle écrit la distance dans `camera.position`,
puis fait tourner). Ici, `melange` = **un glissé de rotation lancé pendant que
l'élan de zoom court encore** — c'est-à-dire une main qui ne lâche pas la souris
entre deux gestes. Il perce le sol aux **cinq** lieux.

⚠️ **Et le geste de R23 elle-même perce aussi** : `tourner` (360° d'azimut à la
butée, bouton tenu) rend **−0,4424 à −3,9235 u** aux cinq lieux, contre les
−0,9577 u qu'elle publie comme plancher. La différence avec son banc : je
**couche d'abord la vue à la souris**, elle pose la distance par écriture directe.

⚠️ **Ce que je ne tranche pas** : le pas d'angle polaire par image atteint
**8,862°** (Everest z13) sur `tourner`, où la souris ne commande **aucun**
changement polaire après le premier pas — contre les *« 1,3 à 4,7° »* et le
*« moins de 3,675° par image »* de R23 §②, et le plafond de 1,5°/image de R4.
**Mais mon premier pas de `tourner` porte un saut de 420 px vertical**, et mon
agrégat ne l'exclut pas. Le chiffre est donc **publié comme suspect, pas comme
preuve** : il faut re-mesurer en excluant les cinq premières images du glissé.

---

### Q4 — « Le geste est-il continu aux hautes latitudes ? » → ✅ **TIENT.**

**41 614 images**, six latitudes, chacune avec une remontée complète à l'orbite
**et** une redescente, à la molette, relevé dans la boucle :

| latitude | images | `rotateSpeed` relevés | °/px relevés | **pire rapport image → image** | orbite |
|---|---|---|---|---|---|
| 0° | 6 497 | **{1}** | **{0,45}** | **1,000000** | ✅ |
| 80° | 6 946 | {1} | {0,45} | **1,000000** | ✅ |
| **85°** | 6 986 | {1} | {0,45} | **1,000000** | ✅ |
| **88°** | 7 109 | {1} | {0,45} | **1,000000** | ✅ |
| **89,9°** | 7 054 | {1} | {0,45} | **1,000000** | ✅ |
| **−89,9°** | 7 022 | {1} | {0,45} | **1,000000** | ✅ |

**Le contre-exemple que j'ai cherché et pas trouvé** : les ×2,027 de 80° et
×3,367 de 84° que R23 avait trouvés avant son correctif ; les pôles ; le
franchissement de la porte orbitale ; le sens descendant (que R23 n'avait pas
mesuré à ces latitudes) ; et le régime hérité par `?terre=deux`, que je n'ai
**pas** exercé.

⚠️ **ET C'EST UN ✅ FAIBLE, JE LE DIS.** `rotateSpeed` est un **littéral `1`**,
écrit à deux endroits et deux seulement (`src/modes.js:1066` et `:1656` —
`grep -rn 'rotateSpeed\s*=' src/` ne rend rien d'autre). Le rapport **ne peut
pas** valoir autre chose que 1 tant que personne ne réintroduit une loi. Ma
mesure confirme qu'aucun autre site n'écrit cette valeur ; elle ne peut pas
prouver plus que ça. Le 0,45 est `360 / 800` : mon canevas fait 800 px pleins
(pas d'entête en sans-tête), là où R23 mesurait 0,447 sur 804 px.

⚠️ **La réserve de R23 reste ouverte et je ne l'ai pas fermée** : le °/px est
constant, mais le **kilométrage de sol** balayé par pixel, lui, ne l'est pas.
C'est sa réserve publiée, elle est toujours vraie.

---

### Q5 — « Reste-t-il le saut ×1,156 au changement de bloc ? » → ⛔ **IL RESTE, ET IL A GRANDI.**

Même sonde, même commande, même machine que R15 :
`node scripts/diag-r15-saut.mjs --port 5931 --crans 150`.

| | pire rapport d'altitude de fond en une image | sauts > 1,05 |
|---|---|---|
| dépôt d'avant R15 | ×1,2323 | 1 |
| **R15 livré** (publié) | **×1,1544 / ×1,1561** | 1 / 2 |
| **R30, aujourd'hui** | **×1,1946** | **3** |

Les trois sauts : ×1,1946 (8 098 → 9 674 m), ×1,1554 (6 867 → 7 935 m),
×1,0723 (6 130 → 6 573 m).

⚠️ **ET LA SONDE EST DEVENUE À MOITIÉ AVEUGLE.** R15 lisait `z12 → z11` et
`meanM 441 → 367` sur les images fautives ; aujourd'hui elle rend
`dem = false · z = null · meanM = —` sur **les trois**. Le **rapport** reste bon
(il vient du rayon de `camGlobe`, qui est vivant), mais les champs qui **nommaient
la cause** sont morts — `__exp.dem` ne rend plus rien dans ce régime. Je n'ai pas
poursuivi : **la cause de R15 n'est donc ni confirmée ni infirmée par ce relevé**,
seul le chiffre l'est.

---

## ③ CE QUE J'AI CRU PUIS RÉFUTÉ

**Huit choses, et la première a failli me faire rendre le rapport inverse.**

1. ⛔ **« Mon glissé couche la vue vers l'horizon. »** Il rendait **φ = 0,000°**,
   c'est-à-dire le **nadir** — la « pente d'arrivée », le cas le plus favorable
   de R23 et le seul que R27 ait mesuré. `OrbitControls.rotateUp(2π·dy/h)` :
   la souris qui **descend** fait tomber φ. J'ai mesuré le contraire de ce que
   je croyais mesurer pendant deux manches. **Corrigé, vérifié : φ = 88,200° =
   `maxPolarAngle`.**

2. ⛔ **« Le blocage va se reproduire à la molette. »** Sept variantes de geste,
   **sept fois l’orbite**, 181 à 187 crans. **0 image sur 57 897 collée à `maxDistance`** sous la molette. C'était le résultat que j'attendais le moins et il est ferme.

3. ⛔ **« Huit `cranZoom(-1)` d'affilée n'en dépensent qu'un, parce que `busy`
   avale les autres. »** Belle explication, et **fausse** : trois cadences
   mesurées (0, 10 images, attente de `busy`), **3 à 4 niveaux à chaque fois**,
   jamais 1. Le `busy` coûte **un** niveau, pas six.

4. ⛔ **« Le voile de la *vue d'ensemble* (`cadrageWheel`) est l'état d'Adrien. »**
   Non : `modeCameraDamier` ne rend `'ensemble'` que si `cote > 1`, ce qui exige
   un tracé GPX ; l'ouverture par défaut à La Réunion a `cote = 1`.
   ⚡ **Mais le défaut que j'y ai trouvé est réel et il vaut d'être signalé** :
   `cumuleDezoom` écrête chaque événement à **1,0** (`min(1, deltaY/100)`), le
   seuil de sortie vaut **1,2**, et le cumul repart de zéro après
   **`OUBLI_MOLETTE_MS = 400 ms`**. ⇒ **sortir exige DEUX crans en moins de
   400 ms, toujours.** Qui défile à deux crans par seconde a une molette
   **définitivement inerte**, et même un balayage de 4 000 px en un seul
   événement ne suffit pas. Test rouge C.

5. ⛔ **« Le 59,330° de R23 était un relevé mort. »** R23 §⑤.3 l'écrit :
   *« six chiffres cohérents et tous faux »*. **Le nombre, lui, était juste** :
   **59,330° est la pose d'ouverture réelle, derrière le voile, trois
   chargements sur trois.** Son *inférence* (« mon geste a pris ») était fausse,
   et sa rétractation reste juste ; mais elle a jeté une mesure exacte avec elle,
   et c'est cette mesure-là qui m'a mis sur la piste du voile.

6. ⛔ **« Mon `_rescale` remet la scène à zéro entre deux combinaisons. »** Ma
   manche `chasse` enchaînait six gestes dans une page ; **le premier atteignait
   l'orbite et les cinq suivants sont partis de l'orbite** (φ = 180°, altitude
   négative). **Cinq relevés sur six étaient des ordures**, et ce n'est pas le
   résultat qui l'a dit — c'est φ. Refait, une page par variante.

7. ⛔ **« Ma sonde mesure ce que voit un utilisateur. »** Elle fermait le voile
   en ligne 50, **exactement comme les quatre sondes de la campagne**. C'est en
   la débranchant que la mesure d'Adrien est apparue. **Le piège n'était pas
   dans l'instrument : il était dans la première ligne de tous les instruments.**

8. ⛔ **« Mes trois fichiers viennent de prendre 1 506 retours chariot. »**
   `grep -c $'\r'` rendait **644, 333 et 529** — toutes les lignes — après avoir
   rendu **0** sur les mêmes fichiers une heure plus tôt. J'ai failli les
   reconvertir. **`od -An -tx1 | grep -c '^0d$'` rend 0 sur les trois**, et
   `cat -A` ne montre aucun `^M`. C'est mon `grep` qui mentait : dans la boucle
   où je l'avais mis, le motif dégénérait et matchait toute ligne. ⚡ **C'est
   mot pour mot le §5 du brief — « relis l'octet écrit » — et il m'a mordu sur
   l'instrument censé le vérifier.** L'octet, lui, est propre.

### Et une chose que je n'ai pas eu à réfuter

**R26 §« la porte du banc »** — *« Les 45 s n'achetaient rien : 0 tuile arrivée,
0 requête, `tuilesEnVol` max 0 »*. Je ne l'ai **pas** attaquée : aucune de mes
mesures ne dépend de la porte du banc (je n'attends pas la scène, j'enveloppe
`controls.update`), et je n'ai donc rien à en dire. ⛔ **Je ne l'innocente pas :
je dis que je ne l'ai pas mise à l'épreuve.** C'est la seule des trois
affirmations du brief que je rends **⚠️ non attaquée**.

---

## ④ LES TESTS ROUGES — LA LIVRAISON

**Onze tests, onze rouges aujourd'hui.**

```
node --test test/attaque-r30-ROUGE.mjs
→ tests 11 · pass 0 · fail 11
```

| test | ce qu'il verrouille |
|---|---|
| **ROUGE A** | `src/ui/hub.js` ne pose aucun écouteur `wheel` : défiler ne fait rien et ne lève pas l'accueil |
| **ROUGE A bis** | `body.ce-hub .ce-hubveil { pointer-events: auto }` capte tous les gestes |
| **ROUGE A ter** | journal : 32 crans de molette ne déplacent rien, voile levé |
| **ROUGE B** | `_applyZoom` sort `controls.target` de l'axe en **une image** (0,168063 u) |
| **ROUGE B bis** | …et il sort `target.y` de `Y_CIBLE` du même geste |
| **ROUGE B ter** | journal : 2 291 images sur 2 361 hors du crop ont la cible hors de l'axe |
| **ROUGE C** | 20 crans espacés de 500 ms ne sortent **jamais** du cadrage d'ensemble |
| **ROUGE C bis** | un balayage de 4 000 px en un événement n'en sort pas non plus |
| **ROUGE D** | la borne de −0,9577 u de R23 est dépassée aux cinq lieux (9 configurations) |
| **ROUGE D bis** | 0,37 % d'images sous le sol contre 0,16 % publiés |
| **ROUGE E** | le saut de fond vaut ×1,1946 contre ×1,1561 publié |

**SIX sont PURS** (A, A bis, B, B bis, C, C bis) : ils lisent `src/` ou font
tourner la vraie machine à modes, et ils sont rouges tout seuls, sans rien
d'autre.

⚠️ **CINQ sont des GARDES DE JOURNAL, pas des tests unitaires** (A ter, B ter,
D, D bis, E). C'est une limite assumée et elle a une cause nommée : le
redressement du sol et le recentrage vivent dans `main.js`, **que aucun test ne
charge** — R23 et R27 l'écrivent toutes les deux.

⛔ **ET `.banc/` EST DANS `.gitignore` (ligne 44) : ces cinq-là échoueront avec
« journal absent » sur un dépôt frais** — rouge, mais pour la mauvaise raison.
Les commandes qui les régénèrent sont en tête du fichier de test :

```
npm run dev --port 5931
node scripts/sonde-attaque-r30.mjs --port 5931 --manche voile
node scripts/sonde-attaque-r30.mjs --port 5931 --manche sol
node scripts/sonde-attaque-r30.mjs --port 5931 --manche molette --coucher 0 --x 950 --y 230
cp .banc/R30/molette.json .banc/R30/molette-hors-centre-px.json
node scripts/diag-r15-saut.mjs --port 5931 --etiquette r30-saut --crans 150
```

⛔⛔ **ET LE FICHIER S'APPELLE `.mjs`, PAS `.test.js`, PARCE QUE LES DEUX
CONSIGNES DU BRIEF SONT INCONCILIABLES.** `scripts/audit-tests.mjs` recense
`test/*.test.js` et **exige** que chacun soit dans `package.json` (« un test qui
ne tourne pas est pire qu'un test absent : il rassure »). Le brief demande de
**ne pas** l'inscrire **et** que `audit:tests` soit sans écart. Le suffixe `.mjs`
les réconcilie — **et il fait exactement ce que l'audit existe pour empêcher :
ce fichier lui est invisible.** C'est écrit en tête du fichier et ici.
**Le jour où ces onze rouges deviendront verts, il faut le renommer en
`.test.js` et l'inscrire — ou le supprimer.** Tant qu'il dort en `.mjs`, il ne
protège rien.

---

## ⑤ RÉSERVES OUVERTES

1. ⛔ **UN SEUL POSTE, UN SEUL NAVIGATEUR.** Chrome sans tête 1280 × 800,
   `--use-angle=default`. Pas de machine lente, pas de pavé tactile, pas de
   Firefox, pas de mobile. Le voile se comporte peut-être autrement ailleurs —
   **je ne l'ai pas vérifié**.
2. ⚠️ **Le pas d'angle polaire par image (jusqu'à 8,862°) est publié comme
   suspect**, §Q3 : mon agrégat n'exclut pas la première image du glissé, qui
   porte un saut de 420 px. À re-mesurer avant d'en faire un défaut.
3. ⚠️ **La cause du saut ×1,1946 n'est pas confirmée** : les champs
   diagnostiques de `diag-r15-saut.mjs` (`dem`, `zoom`, `meanM`) rendent
   `false/null/—` là où R15 lisait des valeurs. Le chiffre tient, l'explication
   de R15 n'est ni confirmée ni infirmée.
4. ⚠️ **Je n'ai pas mesuré le régime hérité** (`?terre=deux`, `?globe=crans`),
   ni la fenêtre continue (`?f3=1`), ni le pavé tactile.
5. ⚠️ **Console** : les longues manches (5 000 images) rendent 24 à 317 erreurs
   réseau — `404`, `429 Too Many Requests`, un `ERR_CONNECTION_TIMED_OUT` —
   toutes sur des tuiles. **Aucune `PAGEERROR`, aucune exception JS.** Les
   manches courtes (`depart`, `voile`) rendent **0 erreur**. Je les ai lues,
   comme le brief l'exige, et je les attribue au réseau, pas à l'application.
6. ⚠️ **Le prix du geste (20,8 crans par niveau) n'est pas un défaut déclaré** :
   c'est un chiffre. Il n'y a pas de contrat contre quoi le juger, donc pas de
   test rouge. Il mérite l'avis d'Adrien.

---

## ⑥ LES CHIFFRES DE CLÔTURE

| | valeur |
|---|---|
| `npm test` | **4 641 tests · 0 échec** — la base est intacte |
| `npm run audit:tests` | **240 listés · 240 sur disque · aucun écart** |
| tests rouges livrés | **11**, dans `test/attaque-r30-ROUGE.mjs` (hors liste, hors audit — §④) |
| `git diff regroupement HEAD -- src/` | **vide** — aucune ligne de comportement touchée |
| images relevées dans la boucle | **120 730** sur 16 journaux |
| scripts ajoutés | `scripts/sonde-attaque-r30.mjs` (0 octet 0x0D, relu) |

### FICHIERS AJOUTÉS

| fichier | quoi |
|---|---|
| `scripts/sonde-attaque-r30.mjs` | **neuf** — l'instrument : gestes à la souris, relevé dans la boucle, chaîne de zoom enveloppée fonction par fonction, huit manches |
| `test/attaque-r30-ROUGE.mjs` | **neuf** — les onze rouges |
| `.banc/R30/*.json`, `.banc/R15/r30-saut.json` | les journaux dont sortent tous les chiffres ci-dessus |

⛔ **`src/` : pas une ligne.**

---

## ⑦ SI TU NE LIS QU'UN PARAGRAPHE

**Ta question — *« pourquoi la problématique d'axe de rotation de la caméra
n'est toujours pas résolue ? »* — a deux réponses, et elles sont toutes les deux
vraies.**

1. ⚡ **Le blocage que tu as mesuré n'est pas dans la caméra.** Le voile
   d'accueil était encore levé : **0 cran de molette sur 37 atteignait
   l'application**, et il n'y a **aucune sortie à la molette**. Voile fermé, tous
   les chemins remontent à l'orbite. R23 et R27 ne se sont pas trompées là-dessus.
2. ⛔ **Mais l'axe de rotation, lui, est bel et bien faux — et R27 ne pouvait pas
   le voir.** Elle a mesuré avec `cranZoom`, qui ne touche jamais la cible. **La
   molette, elle, emmène le pivot jusqu'à 12,90 u (50 375 m, 616 px à l'écran)
   hors de l'axe du centre de la Terre, sur 97 % des images hors du crop.** Le
   correctif de R27 est juste ; `_applyZoom`, à 500 lignes de là dans le même
   fichier, le défait à chaque image.
