# Rapport R11 — « les couleurs et le style du bloc doivent s'appliquer à toute la sphère »

**Statut : livré.** Arbre `C:\Dev\wt-pal`, branche `palette-globe`, commit `b0f827d` sur `9ffe101`.
**4 302 tests passent** (base 4 297 + 5 neufs) · `npm run audit:tests` : **221 listés · 221 sur disque · aucun écart**.

---

## ⚡ En une phrase

**Le vert d'Adrien n'est pas une moyenne : c'est le BAS de la rampe.** L'axe Y (l'humidité) pèse
**ΔE 2,89** dans un écart de 20 à 26 ; ce qui fait l'écart, c'est l'axe X — et l'axe X est fait de
**deux uniformes**. Le correctif ne coûte aucune donnée neuve. L'analyse globale, elle, est
**infaisable, et je le chiffre** : elle confirme le renoncement de R6.

---

## ⛔ Deux choses du brief que la mesure a réfutées — je les mets en tête

### 1. « Hors du crop, l'analyse retombe sur `vec4(0.5)` […] le vert d'Adrien est une moyenne »

**Faux, et c'est mesuré.** L'humidité neutralisée seule sur le bloc déplace la couleur de
**ΔE 2,89 en moyenne** (max 21,3). Les bornes en valent **25,82** et la loi d'axe X **20,76**.
Le neutre `vec4(0.5)` de `globe.js:1792` existe bien, mais **il n'explique pas ce qu'Adrien voit** :
le vert vient de ce que `hNorm = h / 5600` écrase la médiane des terres (**478 m mesurés**) à
`hNorm = 0,085`, c'est-à-dire sur le premier arrêt de la rampe — `#93a074`, l'olive.

### 2. « Le branchement de l'échelle continue manque peut-être » (piste du coordinateur)

**Réfutée, et j'ai failli publier le contraire.** `globe._echelleContinue.ancres` est une **`Map`** ;
je l'ai d'abord sondée avec `Object.keys()`, qui rend `[]` sur une `Map`, et j'ai conclu « zéro ancre,
jamais nourri ». J'avais même écrit le correctif dans `main.js` avant de voir que `contexteCrop`
**pose déjà** `ctx.rampe = { altitudeM, zeroSousEau: true }` (ligne 5489) — ma clé, plus haut dans
le littéral, était écrasée. **Le correctif a été retiré ; `git status` sur `main.js` est revenu propre
avant toute mesure.** Relevé correct :

```
globe._echelleContinue.ancres.size = 1
ancres = { 12 : { terreBas 0, terreHaut 2584,35, profondeur 2096,89, creux 2096,89, fondBudget 2116,27 } }
```

Et l'ancrage **tient** sur le chemin qu'Adrien regarde. Dézoom continu au même lieu, Sri Lanka,
sans téléportation :

| altitude | `uLandMax` | `uHeightContrast` | `uHeightPivot` |
|---|---|---|---|
| 3 995 m | 1 460,8 | 3 | 0,15 |
| 5 590 m | 1 460,8 | 3 | 0,15 |
| 7 847 m | 1 460,8 | 3 | 0,15 |
| 10 740 m | 1 460,8 | 3 | 0,15 |

**×2,7 d'altitude, échelle rigoureusement constante.** L'échelle continue fait son travail.

⚠️ **Ce qui bouge, c'est la TÉLÉPORTATION** : `flyTo` passe par l'orbite, donc `retirerCrop`, donc
`oublierAncres`. Les deux relevés que le coordinateur demandait, obtenus ainsi :

| station | `uLandBas` | `uLandMax` | `uReliefBas` | `uOceanDepth` |
|---|---|---|---|---|
| **Z10** | 0,01 m | **2 460,5 m** | −78,1 m | 78,1 m |
| **Z11** | 10,5 m | **1 460,8 m** | 10,5 m | 6 000 m |

**×1,68 sur l'échelle pour le même terrain** — mais **par un aller-retour en orbite**, pas par un
zoom continu. La cause n'est donc pas un cran trop large : c'est la **mort du crop**, qui efface les
ancres *et* rend `uRampCropOn` à zéro. C'est exactement la frontière sphère / bloc.

---

## Étape 1 — la décomposition de l'écart

**Protocole.** Sri Lanka **6,4156 / 80,6643**, `?terre` par défaut (sphère), une seule caméra, un seul
instant : les six configurations sont rendues par `composer.render(0)` **dans le même appel
JavaScript**, donc rien d'autre ne bouge entre elles. Grain coupé (`NoiseEffect.blendMode.opacity = 0`)
parce qu'il anime son bruit et polluerait chaque différence. Métrique **ΔE (CIE76, Lab)** sur
**103 090 pixels**, vue **0 % mer** (vérifié : aucun pixel `B > R + 15`).

### Laisser-un-de-côté, depuis l'état BLOC — c'est l'attribution qui compte

| poste neutralisé | ΔE moyen | ΔE max | RGB moyen obtenu |
|---|---|---|---|
| **les bornes** (`uLandBas`/`uLandMax`/`uReliefBas` → monde) | **25,82** | 53,7 | 166, 131, 118 |
| **la loi d'axe X** (`uHeightContrast`→1, `uHeightPivot`→0,5) | **20,76** | 44,5 | 179, 155, 137 |
| le peigné (`uTexShade`→0) | 4,06 | 26,6 | 198, 192, 188 |
| le voile aérien (`uHazeAmt`→0) | 3,92 | 34,7 | 188, 178, 174 |
| **l'humidité** (`uWetK`/`uExpoK`→0) | **2,89** | 21,3 | 196, 192, 187 |

### Ajout-un-à-un, depuis l'état SPHÈRE

| poste ajouté seul | ΔE moyen | ΔE max |
|---|---|---|
| la loi d'axe X seule | 25,53 | 41,1 |
| les bornes seules | 16,72 | 41,9 |
| le peigné seul | 10,38 | 29,6 |

⚠️ **Les deux tableaux ne s'additionnent pas, et c'est le résultat.** Bornes et loi se compensent
partiellement (l'une pousse vers le brun, l'autre ramène vers le pâle) : la somme des marches vaut
55,4 pour un écart total SPHÈRE→BLOC de **16,75**. **On ne publie donc pas la somme** — on publie
les deux lectures, et la moins favorable à ma thèse (l'ajout seul) donne encore **25,53 pour l'axe X
contre un plafond de 10,38 pour tout ce que l'analyse peut apporter**.

### Pourquoi, en arithmétique

Palette d'ouverture, arrêts `#93a074` (p = 0, olive) → `#efe6d4` (p = 1, crème).

* **Sphère** : `p = h / 5600`. Sri Lanka sous 500 m ⇒ `p < 0,09` ⇒ **le premier arrêt**. L'olive.
* **Bloc** : `uLandMax = 1 460,75`, `pivot 0,15`, `contraste 3` ⇒ à 500 m, `p = 1,0` ⇒ **le crème**.

➡️ **Ce n'est pas deux palettes ni deux tables : c'est le même arrêt de rampe atteint par deux
indices qui diffèrent d'un facteur dix.**

---

## Étape 2 — la part gratuite, portée et mesurée

Les bornes ET la loi sont des **uniformes**. Portées hors crop :

**`src/monde/rampe-crop.js` §⑤** — `HYPSO_MONDE_M` : l'hypsométrie des terres, **mesurée**, pas reprise.
Balayage de la couverture **mondiale complète** du MNT de production (terrarium AWS, 256 px/tuile),
pondéré `cos(latitude)` (Mercator), terres émergées seules :

| zoom | tuiles | échecs | part de terre | p08 | p50 | p92 |
|---|---|---|---|---|---|---|
| z3 | 64 | 0 | 33,58 % | 53 m | **478 m** | 3 018 m |
| z4 | 256 | 0 | 33,39 % | 53 m | 483 m | 3 023 m |

**Les deux résolutions s'accordent à 1 %.** ⚠️ **On publie z3, la moins fine des deux.**

`GRADE_MONDE` est **dérivé par `gradeForDem`** — la règle du dépôt, **importée, pas recopiée** — et
rend **`heightContrast = 4,5`, `heightPivot = 0,56`**.

⛔ **Le piège d'échelle, et il est silencieux.** Le nuanceur indexe `natRampT` sur `hNormRelief`,
normalisé sur `[uReliefBas ; uLandMax]` = **`[−6 000 ; 5 600]` fond marin compris**. Un grade calculé
sur les seules terres aurait rendu `pivot 0,085` — et peint la planète entière avec le haut de la
rampe. Le test ⑦b verrouille l'échelle.

**Ce que ça ferme, mesuré à l'écran** (même caméra, même seconde, sphère avant → sphère après) :
**ΔE moyen 10,05, max 64,1** sur 103 090 pixels dont ~40 % de mer inchangée.

**Et à l'écran, au lieu d'Adrien** (Étape 6) :

* **avant** — Sri Lanka en **aplat vert olive**, mer turquoise. Le relief se lit à l'ombrage, pas à
  la couleur. C'est la capture d'Adrien, reproduite.
* **après** — plaine sable, piémont brun, **hautes terres brun foncé, sommets blancs**, mer turquoise
  inchangée. La planche hypsométrique du bloc, sur la sphère.

Les deux images sont produites **au même instant, à la même caméra**, en basculant les quatre
uniformes — pas par deux voyages de caméra.

---

## Étape 3 — l'analyse globale : trois pistes, tranchées par la mesure

### Piste A — par tuile, avec marge : **arithmétiquement possible, économiquement morte**

Les rayons sont en **mètres**, convertis en texels et **écrêtés** (`terrain-analysis.js:198`) :
`wetness` = `clamp(round(1000/mpp), 1, 96)`, `aspect` = `clamp(round(500/mpp), 1, 48)`.
⚠️ **`textureShade` n'a pas de rayon en mètres du tout** : 6 octaves, dernier flou à `r·2` avec
`r = 2⁵`, soit **64 texels quel que soit le zoom**. C'est lui qui plancher la marge.

Tuile de globe = **256 texels** (relevé dans l'application : `tile.size = 256`, `heights.length = 65 536`).

| zoom | m/texel | rayon `wetness` | rayon `aspect` | rayon `texShade` | **marge** | champ à cuire | texels |
|---|---|---|---|---|---|---|---|
| z2 | 39 136 | 1 | 1 | 64 | **64** | 384² | ×2,25 |
| z11 | 76,4 | 13 | 7 | 64 | **64** | 384² | ×2,25 |
| z13 | 19,1 | 52 | 26 | 64 | **64** | 384² | ×2,25 |
| **z14–z15** | 9,6 – 4,8 | **96** (écrêté) | 48 | 64 | **96** | **448²** | **×3,06** |

➡️ **La marge tient : 64 texels au plus grossier, 96 au plus fin, jamais plus d'un anneau de tuiles.**
La piste ne meurt donc pas sur le voisinage. Elle meurt sur deux autres choses :

⛔ **1. Le coût, et c'est du CPU.** Mesuré dans la page vivante, `analyzeDem` sur le MNT réel
sous-échantillonné, meilleur de 3 après chauffe :

| côté cuit | ms CPU |
|---|---|
| 256² (tuile nue) | 10,2 |
| 384² (tuile + 64) | 21,6 |
| **448² (tuile + 96)** | **28,4** |
| 512² | 41,8 |

Relevé au même instant : **1 700 tuiles vivantes** dans le quadtree, dont **176 au niveau visible**
(z11) et 412 à z12. Même en ne cuisant que le niveau visible : **176 × 28,4 ms = 5,0 s de CPU**.
Pour le cache entier : **48 s**. Et le cache tourne à chaque déplacement.
⚠️ **`gl.finish()` n'a rien à faire ici** : ce coût n'est pas du fragment, c'est de la cuisson —
mesuré en `performance.now()` autour de l'appel, comme le brief le demande.

⛔ **2. `robustScale`, et la marge ne le répare pas.** `textureShade` et `wetness` divisent par le
**p95 de leur propre champ** (`terrain-analysis.js:152`). Par tuile, ce p95 est celui de la tuile :
deux tuiles voisines aux reliefs différents normaliseraient différemment, et **le peigné changerait
d'intensité à chaque bord de tuile — avec une marge parfaite**. C'est une statistique **globale**,
pas un voisinage ; l'élargir ne l'atteint pas.

### Piste B — une analyse basse résolution GLOBALE : **morte par arithmétique**

La question du brief — « l'humidité est une grandeur de ~1 km : a-t-elle besoin de la pleine
résolution ? » — a deux réponses, et **les deux sont non**.

**① Le champ mondial n'existe pas.** Pour que le rayon d'1 km fasse ne serait-ce qu'**un** texel, il
faut `mpp ≤ 1 000 m` :

| texels par rayon | m/texel | champ mondial | RGBA |
|---|---|---|---|
| 1 (caricature : un 3×3) | 1 000 | 40 075 × 20 038 | **3,2 Go** |
| 4 (le minimum honnête) | 250 | 160 300 × 80 150 | **51,4 Go** |

**Un champ mondial qui porte une grandeur d'1 km n'est pas une texture.**

**② Et sous-échantillonner ne conserve pas la grandeur.** Mesuré sur le MNT vivant (1 536², 37,98 m/px),
analyse pleine contre analyse réduite ré-échantillonnée en bilinéaire à la taille pleine, écart moyen
en 0–255 par canal, et l'écart induit sur l'axe Y du LUT (`natHumiditeY`, `wetK = 0,96`, `expoK = 0,02`) :

| cible | ms | R peigné | G ombrage | B humidité | A exposition | **Δ`wetY`** |
|---|---|---|---|---|---|---|
| 768 (½) | 114 | 10,2 | 7,9 | 2,3 | 3,9 | **0,089** |
| 384 (¼) | 30 | 18,0 | 13,7 | 6,7 | 2,9 | **0,249** |
| 192 (⅛) | 15 | 26,6 | 17,7 | 11,0 | 12,9 | **0,411** |
| **154 (1/10)** | 12 | 28,6 | 18,6 | 15,2 | 8,3 | **0,561** |
| 96 (1/16) | 12 | 34,1 | 20,2 | 21,0 | 18,6 | **0,781** |

⚠️ **À un dixième, l'axe Y se trompe de 0,561 — plus de la MOITIÉ de la hauteur du LUT (36 lignes sur
64).** Ce n'est pas « un peu plus grossier », c'est une autre humidité. La cause est double : le gain
`GAIN_HUMIDITE = 4,86` amplifie l'erreur, et `robustScale` renormalise différemment à chaque
résolution. **Le brief supposait que la basse résolution suffirait ; elle ne suffit pas.**

### Piste C — renoncer à l'axe Y hors du crop, et rapprocher les deux lignes : **retenue**

C'est ce qui est livré, et **le chiffre de l'Étape 1 le justifie** : l'axe Y vaut **ΔE 2,89** sur un
écart de 20 à 26. **On abandonne 2,89 et on ferme le reste.** Hors crop, `uAnalysisOn = 0` ⇒
`natHumiditeY(0,5 ; 0,5 ; …) = 0,5` **exactement**, c'est-à-dire la **ligne médiane** du LUT,
c'est-à-dire la rampe historique — pas un neutre inventé.

⛔ **Le voile aérien ne suit pas non plus, et c'est délibéré** : `natVoile` lit `fd = length(qCrop)`,
une distance au centre du crop. Sans crop, `qCrop` est la dernière emprise **morte** — le voile
peindrait un dégradé centré sur un lieu qu'on a quitté. Il reste à `NATUREL_MONDE.hazeAmt = 0`.

**➡️ R6 avait raison, et la question est close avec des chiffres :** marge 64–96 texels (faisable),
`robustScale` global (non réparable par la marge), 5,0 s de CPU pour le seul niveau visible,
champ mondial 3,2 à 51 Go, et Δ`wetY` = 0,561 à un dixième.

---

## Étape 4 — la couture, et c'est le juge

**⚡ Le correctif n'introduit AUCUNE couture de rampe, et la raison est structurelle :**
`uLandBas`, `uLandMax`, `uReliefBas`, `uHeightContrast`, `uHeightPivot` et `uRampCrop` vivent dans
`this.uniforms`, que `_materialFor` étale dans **chaque** matériau de tuile. Quand un crop est posé,
la planète entière prend son échelle et son grade ; quand il meurt, la planète entière prend
`GRADE_MONDE`. **À aucun instant deux lois ne cohabitent sur l'image.** Vérifié dans l'application :
crop posé ⇒ `uLandMax 1 460,75 · hc 3 · hp 0,15` **partout**, y compris hors crop.

**La seule marche restante est celle de l'analyse**, et elle **préexiste à cette tâche** :
`dansCrop = step(max(|qCrop.x|, |qCrop.y|), 1)` est un échelon dur d'un texel. Mesurée à l'écran
(`uAnalysisOn` 1 → 0, même caméra, même seconde) :

| grandeur | valeur |
|---|---|
| ΔE moyen de la marche | **5,81** |
| ΔE max | 26,7 |
| part des pixels au-dessus du seuil de perception (ΔE > 2,3) | 82,6 % |

⚠️ **Elle est franche, et je ne la maquille pas.** Ce qui la rend supportable aujourd'hui n'est pas
son amplitude, c'est **où elle tombe** : exactement sur le bord géométrique du bloc, là où
`uEstompageOn` estompe déjà la planète alentour. **Ce n'est pas un argument que j'ai mesuré comme
suffisant** — c'est une observation, et je la laisse en réserve plutôt qu'en conclusion.

**⛔ Ce que je n'ai pas fait :** mesurer la marche *le long du bord*, pixel par pixel, avec la caméra
cadrée sur la frontière. La machine à modes de l'onglet caché ne m'a pas laissé stabiliser ce cadrage
(voir Réserves). Le chiffre ci-dessus est la **hauteur de la marche**, pas sa **largeur à l'écran**.

---

## Étape 5 — le coût

**Le correctif livré ne coûte rien de mesurable** : deux `float` et un `sampler2D` déjà lié, écrits
seulement quand ils changent. `_majRampeMonde` tourne dans `update()` et **sort en deux comparaisons**
quand rien n'a bougé ; il ne fait **aucune** cuisson.

Le coût chiffré de cette tâche est celui de la piste refusée, et **c'est du CPU, pas du fragment** —
10,2 / 21,6 / **28,4** / 41,8 ms pour 256² / 384² / 448² / 512², `performance.now()` autour de
`analyzeDem`, meilleur de 3 après chauffe. `gl.finish()` n'entre pas ici : rien de tout cela n'est
dessiné.

---

## Fichiers touchés

| fichier | ce qui change |
|---|---|
| `src/monde/rampe-crop.js` | **+104 lignes** : `HYPSO_MONDE_M`, `histogrammeDesQuantiles()`, `GRADE_MONDE` (dérivé par `gradeForDem`), + l'import de `../relief-grade.js` |
| `src/globe.js` | import `GRADE_MONDE` ; champ `this._rampeMonde = null` (constructeur) ; **`poserRampeMonde()`** et **`_majRampeMonde()`** (nouvelles, avant `retirerHabillage`) ; 4 lignes de `retirerHabillage` ; **1 appel en tête de `update()`** |
| `src/main.js` | **une seule ligne de code** + son commentaire, juste après `globe = new Globe({…})` (~ligne 4243) : `globe.poserRampeMonde(terrain.mapUniforms.uRampTex)` |
| `test/crop-rampe.test.js` | ⑥b élargi (règle des listes) ; **⑦a–⑦e** ajoutés |

⚠️ **Pour la fusion avec `C:\Dev\wt-vue`** : mon `src/main.js` **ne touche ni la caméra ni aucune passe
de rendu**. C'est **un ajout d'une ligne** après la construction du globe, dans une zone qu'une
réécriture de caméra n'a aucune raison de visiter. Aucun conflit attendu.

## Tests

`npm test` → **4 302 tests, 4 302 pass, 0 fail** (base 4 297 + 5 neufs : ⑦a, ⑦b, ⑦c, ⑦d, ⑦e).
`npm run audit:tests` → **221 listés · 221 sur disque · aucun écart** — `crop-rampe.test.js` était
**déjà** dans la liste explicite de `package.json`, les cinq tests neufs tournent donc réellement.

Ce qu'ils tiennent : ⑦a l'histogramme à trois pics rend les trois quantiles au pas près (c'est ce qui
autorise à ne pas recopier la règle de cadrage) · ⑦b `GRADE_MONDE` est bien celui de `gradeForDem`
**dans l'échelle du nuanceur**, et son pivot passe au-dessus de `natPlancherPivot` · ⑦c sans porteur,
le globe est celui d'avant **au bit près**, et il suit le **remplacement** de la texture · ⑦d le crop
garde la main tant qu'il vit (sans quoi `update()` écraserait le grade local 60 fois par seconde) ·
⑦e `retirerHabillage` lâche toujours l'analyse (12 Mo) et **ne** rallume **pas** le voile.

## Commits

* **`b0f827d`** — R11 — les couleurs du bloc sur toute la sphère : mesure, puis deux uniformes.

---

## Réserves — ce que je n'ai pas fermé

1. **⛔ Le grade du monde change l'aspect de la sphère, et beaucoup.** `pivot 0,56 / contraste 4,5`
   place le niveau de la mer à `rampT = 0,31` : **les deux arrêts les plus verts de la palette
   d'ouverture (`#93a074`, `#b0b981`) ne sont plus atteints par aucune terre.** C'est la conséquence
   directe de la règle du dépôt (`relief-grade.js`, `SPAN = 1,15`) appliquée à l'hypsométrie réelle —
   la médiane des terres est basse et la queue est longue. **Ce n'est pas un réglage de mon goût,
   mais c'est un parti pris qu'Adrien doit voir avant qu'on le garde.** Si le vert lui manque, le
   levier honnête est `HYPSO_MONDE_M` → non ; c'est `SPAN`, ou un plafond de contraste propre au monde.

2. **La marche de l'analyse reste franche** — ΔE 5,81 moyen, 82,6 % des pixels au-dessus du seuil de
   perception. Elle **préexistait**, je ne l'ai ni créée ni réduite, et je n'ai pas pu mesurer sa
   **largeur** à l'écran faute de cadrage stable sur la frontière.

3. **`GRADE_MONDE` est figé sur `RAMPE_MONDE`.** Il est recalculé à l'import par `gradeForDem`, donc
   il suit `terreBas` / `terreHaut` / `creux` si on les change — mais **pas** l'hypsométrie, qui est
   une mesure gelée. Si la source de MNT change, `HYPSO_MONDE_M` doit être re-balayé (la procédure
   est dans le §⑤).

4. **Le pilotage de la caméra dans un onglet caché est un piège méthodologique**, et il m'a coûté du
   temps : `rAF` tombe à ~2 images / 3,6 s, `tick()` bascule sur `setTimeout(40)` que Chrome écrête à
   ~1 s. J'ai pompé les images en rejouant `visibilitychange` (le repli du dépôt) et avancé les
   voyages par `modes.update(1/30)` en boucle synchrone. **Les mesures de couleur, elles, n'en
   dépendent pas** : elles se font toutes dans un unique appel synchrone `composer.render(0)` +
   `drawImage`, exactement comme `saveCurrentTemplate` le fait déjà (`main.js:6516`).

5. **Une sonde fausse a failli produire un faux résultat** (`Object.keys` sur une `Map`). Je l'ai
   attrapée parce que le correctif que j'en tirais était déjà écrit et que la relecture du code a
   montré la clé `rampe` existante. **C'est écrit en tête de ce rapport plutôt qu'effacé.**
