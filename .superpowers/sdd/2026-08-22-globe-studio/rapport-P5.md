# Tâche P5 — LE FOND MARIN : ce n'était pas la donnée, c'était la loi de couleur

**Statut : LIVRÉE.** · Commits **`61de597`** et **`4a182a3`** sur `regroupement`
(arbre propre après commit).
`npm test` — **3 965 / 3 965** (3 947 au départ, **+18**) · `npm run audit:tests` — **209 / 209** ·
campagne de mutation — **38 / 38**, dont **26 visant le branchement**.

> **La Tâche P4, 2026-08-22 :** *« LE FOND MARIN DU CROP EST EN TERRASSES […] la mer est
> parcourue de gradins pâles à bords droits […] C'est de la SURFACE, pas de la mer. »*
> **Mon brief :** *« la bathymétrie du crop est quantifiée en marches ».*

⛔ **ELLE NE L'EST PAS, ET C'EST LA PREMIÈRE CHOSE QUE J'AI MESURÉE.** Le champ du crop rend
**5 299 valeurs distinctes sur 5 448 nœuds d'eau**, sa pente moyenne est celle du MNT du socle à
**9,4 %** près, et sa courbure à **73 à 79 %** de la sienne en eau moyenne et profonde. Il n'y
avait **aucune marche dans la donnée**. Les « gradins pâles » étaient **deux entrées de la loi de
COULEUR**, et **aucune des deux n'était calculée : elles étaient posées, à des défauts que
personne n'avait jamais remplacés.**

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Tout est dans `.banc/vues-P5/` — 26 captures et 4 relevés**, `bilan-P5.json`,
`releves-bruts-P5.json` et `source-bathy-P5.json` compris. Cadre **1 280 × 800**, La Réunion z12,
`fov = 33`, **socle RALLUMÉ DANS LA MÊME PAGE** (le protocole du noteur), rendu **sans
compositeur** dans une cible **à profondeur**, **boucle rAF coupée**, cadrages appariés à
**+0,0122 %**.

**Le triptyque à regarder :**

- **`A1-CROP-bloc.png` → `L1-CROP-bloc-APRES.png` → `L2-SOCLE-bloc-apparie.png`.**
  AVANT : la mer est une plaque **blanc-gris** au ras de la côte, qui couvre la moitié de l'eau et
  dont le bord est un escalier de texels ; le large est bleu marine. APRÈS : une mer bleu-canard
  continue, un **liseré blanc fin collé au trait de côte**, et un **haut-fond turquoise** au coin
  sud-est. SOCLE : la même chose, un ton plus clair.
- ⚡ **`K1-CROP-fond-nu-zoom.png` ↔ `K2-SOCLE-fond-nu-zoom.png`** (découpes ×4, **nappe d'eau
  ÉTEINTE des deux côtés**) — **c'est la preuve de cette tâche.** Le même turquoise-menthe, le même
  plateau côtier, les mêmes ravines sous-marines aux mêmes endroits. Celles du socle sont plus
  nettes ; les couleurs, elles, ne se distinguent plus.
- **`D1-CROP-mer-zoom.png` ↔ `D2-SOCLE-mer-zoom.png` ↔ `L3` ↔ `L4`** — le même coin de mer, avant
  et après, contre le socle.
- **`G1-PAROIS-seules.png` / `G3-bloc-sans-parois.png`** — les deux pièces isolées, qui montrent
  d'où vient le grand aplat beige du flanc est (réserve n° 1).

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, mesuré :

1. ⛔ **LE BLOC N'EST PAS UNE BOÎTE PLEINE.** Sur `L1`, tout le secteur est du bloc est un aplat
   **beige** à arête en escalier, avec les jupes de tuiles qui pendent dessous ; le socle y a une
   paroi terracotta continue. Isolé (`G1-PAROIS-seules.png`) : c'est **la face de la paroi du
   crop**, que la nappe de mer ne recouvre pas jusqu'à la frontière. *Jupes et parois — autres
   tâches.*
2. ⛔ **LA LAME D'EAU DU CROP EST PLUS SOMBRE ET PLUS OPAQUE QUE CELLE DU SOCLE**, et c'est elle,
   pas le fond, qui porte l'essentiel de ce qui reste. Sur le masque de la mer, la concentration de
   luminance (part des pixels portée par les 16 valeurs les plus fréquentes) vaut **80,97 % côté
   crop contre 30,33 % côté socle** — **et elle n'a pas bougé** quand j'ai branché l'état de mer.
   Sur le fond marin NU, la même mesure rend **40,14 % contre 38,73 %**. ➡️ **Le « plat » est dans
   la NAPPE, pas dans le fond.** *Nommé, pas fermé — voir la réserve n° 2.*
3. **Le fond marin du crop reste plus lisse localement** : écart horizontal moyen **1,55 contre
   2,46** sur le fond nu, et courbure à 71 m **1,27 à 1,96 fois** moindre. C'est la résolution du
   champ (129 nœuds en travers du bloc contre 1 536 pixels de MNT), et je dis §4 pourquoi je ne
   l'ai pas touchée.
4. ⚠️ **Un seul lieu, tout au repos, sans compositeur** (réserves n° 4 et 5).

---

## 1. LE CADRAGE — APPARIÉ, ET LE TÉMOIN EST NUL

`k` est balayé sur un **CLONE** de la caméra du socle, que l'application ne voit jamais.

| | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| bloc entier (tuiles + nappe + parois) | 253 108 px | **253 139 px** | **0,982** | **+0,0122 %** |

➡️ **82 fois mieux que le 1 % demandé.** Deux prises consécutives du même état rendent **0 pixel**
de différence sur 1 024 000. Balayage complet dans `.banc/vues-P5/bilan-cadrage.json`.

⚠️ **Tous les A/B de ce rapport sont des allers-retours vérifiés** : la valeur est remise, la scène
re-rendue, et l'écart avec la première prise compté. **Il vaut 0 partout**, des deux côtés.

---

## 2. ⛔ LA PREMIÈRE MESURE ÉTAIT FAUSSE, ET JE LA RETIRE

**J'ai d'abord mesuré la « rugosité » du fond marin des deux côtés et trouvé le champ du crop
5 à 7 fois plus lisse que le MNT du socle** (0,102 contre 0,789 en différence seconde à un pas de
17,8 m). J'allais en faire la cause.

⛔ **C'EST UN ARTEFACT DE QUANTIFICATION, ET LE TÉMOIN LE DIT.** `dem.data` est un **`Int16Array`
en mètres ENTIERS** (`src/dem-quant.js`). Le même champ du crop **arrondi au mètre** rend
**0,531** de rugosité là où le MNT du socle en rend **0,526** — c'est-à-dire **la même chose**.
La totalité de l'écart en eau profonde était **le bruit d'arrondi du socle**, pas du relief.

**Mesuré proprement, sur une fenêtre de 71 m qui dilue l'arrondi, 4 141 sondes :**

| bande | courbure du MNT socle | courbure du champ crop | rapport | n |
|---|---|---|---|---|
| −30 à −300 m | 19,224 | 9,832 | **1,96** | 297 |
| −300 à −900 m | 3,217 | 2,391 | **1,35** | 2 474 |
| sous −900 m | 1,132 | 0,895 | **1,27** | 1 370 |

Et la **PENTE** (542 sondes réparties sur toute l'emprise) : **22,545 contre 20,421**, soit
**−9,4 %**.

➡️ **Le fond marin du crop est le même relief que celui du socle, à un lissage de bande côtière
près.** `releves-bruts-P5.json`.

### ⚠️ LA SOURCE, ELLE, EST BIEN EN MARCHES — ET LE DÉPÔT LE SAVAIT DÉJÀ

`public/data/bathy/8/167/143.png` (GEBCO_2026, La Réunion) décodé : **613 valeurs distinctes sur
65 536 pixels**, **98,1 % de multiples de 8 mètres**, **canal B à zéro sur tous les pixels**.
`src/bathy.js` l'écrit noir sur blanc dans l'en-tête de `smoothSeaFloor` : *« La quantification en
profondeur du tuileur (pas de 4 m puis 8 m) ajoute ses propres terrasses par-dessus. »*

⚡ **Mais elles n'arrivent jamais jusqu'au champ** : `peindreBathyTuile` agrandit en **Catmull-Rom**
et `fuseBathymetry` mélange, exactement comme pour le socle. **8 m de pas sur un budget de 2 116 m
valent 0,13 % de la rampe, soit 0,7 texel sur les 512 de la table** — invisible, et vérifié par
les 5 299 valeurs distinctes du champ. **La donnée n'était pas le problème, et je le dis plutôt que
d'aller lisser quelque chose qui n'en avait pas besoin.** (`source-bathy-P5.json`.)

---

## 3. ⛔ LES DEUX VRAIES CAUSES : DEUX ENTRÉES POSÉES, JAMAIS BRANCHÉES

### ① LES TROIS COULEURS DE LA RAMPE NAUTIQUE — un paramètre que PERSONNE n'a jamais passé

`poserMer` portait, depuis la Tâche F, un paramètre **`couleursFond`**. **Aucun appelant ne l'a
jamais passé** — ni `contexteCrop().mer`, ni `branchement-crop.js`, ni un test. La calotte vivait
donc sur `RAMPE_NAUTIQUE`, qui n'est **pas la palette** mais **le défaut de `terrain.js`**
(`params.oceanShallow ?? '#dce8ec'`).

**Relevé au même instant dans la page vivante :**

| | haut-fond | moyen | abysse |
|---|---|---|---|
| **socle** (`terrain.mapUniforms`) | **`#c8f2e4`** | **`#62cfc1`** | **`#136e7d`** |
| **crop** (`globe.uniforms`) | `#dce8ec` | `#7fa8b8` | `#31576b` |

⚡ **Le socle ne vit jamais sur ces défauts** : `main.js` y écrit `params.ocean*` à chaque palette,
et le panneau « Sea » y écrit en plus un fond de `SEABEDS` — le gabarit d'ouverture pose
**« lagoon »**, qui est mot pour mot le triplet du socle relevé ci-dessus.

⛔ **C'est la MÊME faute que la couleur des parois (manque n° 2 du noteur) et que `uSky` (P4), au
même endroit du même objet** : un défaut de module gelé dans un uniforme que personne ne repose.

### ② LE BUDGET DU FOND — la calotte au lieu du bloc

Le socle pose `uSeaRange = (0 − dem.minM) × demScale`, et `dem` couvre **exactement le bloc**.
`poserMer` posait `champ.profMaxM`, mesuré sur **la calotte**, trois fois plus large.

| | budget |
|---|---|
| socle (`−dem.minM`) | **2 116 m** |
| crop, avant | **3 510,49 m** |
| crop, après (`profondeurMaxDuCrop`) | **2 116,27 m** — soit **0,013 %** du socle |

➡️ **×1,658, et ça DOUBLE la frange pâle.** Le segment clair de la rampe (`d01 < 0,45`,
`uOceanShallow` → `uOceanMid`) couvrait **38,88 %** des 5 448 nœuds d'eau du crop avec le budget de
la calotte, et **19,81 %** avec celui du crop. **Ce sont les gradins pâles.**

### ⚡ LES DEUX ENSEMBLE : LA COULEUR DU FOND DEVIENT CELLE DU SOCLE, À 1/255 PRÈS

Rampe évaluée à sept profondeurs, sur la table du socle et sur celle du crop :

| profondeur | crop AVANT | **crop APRÈS** | **socle** |
|---|---|---|---|
| −30 m | (205, 222, 228) | **(178, 234, 220)** | **(178, 235, 221)** |
| −300 m | (167, 195, 206) | **(122, 215, 201)** | **(123, 215, 201)** |
| −1 000 m | (120, 160, 177) | **(67, 169, 167)** | **(68, 170, 167)** |
| −1 500 m | (102, 142, 159) | **(43, 140, 146)** | **(44, 140, 146)** |
| −2 100 m | (84, 123, 141) | **(19, 110, 125)** | **(20, 111, 126)** |

➡️ **Au plus 1 unité sur 255 par canal**, et le reliquat est la différence entre `uOceanDepth`
(2 106,77 m, mesuré par `poserRampe`) et `−dem.minM` (2 116 m) : **la même grandeur, mesurée par
deux balayages de finesse différente**. AVANT, à −1 500 m, l'écart au socle valait **(58, 2, 13)**
— **23 % du canal rouge**.

### CE QUE ÇA DONNE SUR LE MASQUE DE LA MER, MÊME PAGE, MÊME SECONDE

| | **AVANT** | **APRÈS** | **socle** |
|---|---|---|---|
| pixels quasi neutres (sat < 0,10) | **4,20 %** | **0,75 %** | 0,50 % |
| saturation moyenne | 0,4056 | 0,4355 | 0,3184 |
| écume (critère du noteur) | 6,619 % | 6,391 % | 6,331 % |
| secteurs de teinte 2 à 5 (turquoise) | **1** px | **2 989** px | 5 830 px |
| secteurs 0 à 1 (ORANGE) | **493** px | **0** px | 0 px |

➡️ ⚡ **Il y avait 493 pixels ORANGE dans la mer du crop et zéro dans celle du socle.** Ils ont
disparu. **Et sur le fond marin NU, la luminance moyenne rend 183,89 contre 184,64 au socle —
0,4 % d'écart.**

---

## 4. CE QUE JE N'AI PAS FAIT, ET POURQUOI — dit, pas caché

| poste | état |
|---|---|
| **la résolution du champ** (129 nœuds en travers du bloc contre 1 536 px de MNT) | ⛔ **LAISSÉE, ET C'EST UN CHOIX MESURÉ.** Elle coûte 1,27 à 1,96 fois la courbure, presque tout dans la bande **−30 à −300 m**, qui ne fait que **297 sondes sur 4 141**. La monter demande de tripler `CHAMP_FOND` (385² → 1 153²), donc **neuf fois** le coût de `remplirHauteurs` (déjà +21 à +29,5 ms à n = 768, mesuré par la Tâche 6 sexies) et de `distanceRivage`, **pour une source qui plafonne à 460 m**. ⚠️ **Et surtout : ce n'est PAS ce qu'on voit** — le fond nu rend 40,14 % de concentration contre 38,73 % au socle. **Régler ça aurait été soigner le mesurable au lieu du visible.** |
| **l'échelle de longueur de houle** | ⛔ **NON BRANCHÉE, ET C'EST UN ÉCART MESURÉ** — réserve n° 3. |
| **la transparence de la lame d'eau** | ⛔ **NON TOUCHÉE** — c'est le plus gros reste, et il a sa propre mesure à faire (réserve n° 2). |

---

## 5. LE SECOND LOT — L'ÉTAT DE MER, ET IL Y AVAIT SIX ÉCARTS, PAS DEUX

Le brief : *« `chop` 0,7 contre 1, `uFoamScale` 0,35 contre 1 — deux mers différentes. »*
**Relevé au même instant dans la page vivante : SIX sur SIX diffèrent.**

| | crop (défaut de `poserMer`) | socle (vivant) | rapport |
|---|---|---|---|
| houle / `uWaveH` | 0,5 | **2** | ×4 |
| chop / `uChop` | 0,7 | **1** | ×1,43 |
| écume / `uFoam` | 0,931 | **1,9** | ×2,04 |
| échelle d'écume / `uFoamScale` | 0,35 | **1** | ×2,86 |
| brillance / `uGloss` | 149 | **110** | |
| ⚡ **vitesse / `uSpeedMul`** | **1** *(codé en dur)* | **0,4** | **×2,5** |

⚡ **LA VITESSE N'AVAIT PAS ÉTÉ NOMMÉE**, ni par le brief ni par P4 : `poserMer` écrivait
`uMerVitesse: { value: 1 }` **en dur** quand `ocean.js` pose `(params.seaSpeed ?? 1) × 0,4`. **La
houle du crop défilait deux fois et demie trop vite** — ça ne se voit pas sur une capture au repos,
et ça se voit tout de suite en mouvement.

### ⚠️ ET BRANCHER LA HOULE TELLE QUELLE L'AURAIT RENDUE 2,5 FOIS TROP HAUTE

`ocean.js` appelle `oceanGerstner(xz, uTime, **uWaveH × uViewCalm**, …)` et donne `uWaveH` **BRUT**
à `shoreSurf`. La calotte passait `uMerHoule` aux deux. Poser `uMerHoule = 2` sans le facteur
aurait donné **2** là où le socle donne **0,808** (`uViewCalm = 0,4039` relevé au même instant).
**L'expression d'`ocean.js` est transcrite terme pour terme** dans `MER_VERT`, et `uMerCalmeVue`
**est déjà l'uniforme que P4 a branché** — pas un second. ⚠️ **Son neutre vaut 1**, donc sans mer de
socle à lire, le facteur ne change rien : le dépôt reste au bit près.

**Vu à l'écran des deux façons** (`H1-CROP-tout-branche-houle-calme.png` contre
`H2-…-houle-brute.png`) avant de choisir.

---

## 6. CE QUI A ÉTÉ FAIT — UN SEUL ÉCRIVAIN, ET DEUX LOIS PURES DE PLUS

**`majReglagesMer` (globe.js) devient l'écrivain UNIQUE** des six réglages d'état de mer **et** des
trois couleurs de fond, **par image**, depuis les uniformes **VIVANTS** du socle. C'est le maillon
que P4 avait posé pour les deux accalmies, élargi.

Le fil, maillon par maillon :

`Ocean.reglagesMer` (accesseur, **LIT** ses propres uniformes) + les trois `terrain.mapUniforms.uOcean*`
**lus un par un** → `main.js`, **juste après `setView`, à la même image** → `globe.majReglagesMer`
→ six uniformes de la mer et trois des tuiles.

- **`etatMerDuSocle`** et **`ETAT_MER_NEUTRE`** (`monde/ecume-mer.js`, module **pur, aucune
  importation**) ;
- **`couleursFondDuSocle`** et **`profondeurMaxDuCrop`** (`monde/mer-sphere.js`, pur).

⚠️ **PAR IMAGE ET NON PAR LE CONTEXTE, ET C'EST UNE QUESTION DE FRAÎCHEUR** : une palette ou un
fond de `SEABEDS` changent **sans déplacer le crop**, donc sans rejouer `poserMer`. Passer par
`contexteCrop` aurait laissé la mer sur l'ancienne palette jusqu'au prochain déplacement — c'est
exactement ce que `rampe2D` a coûté à la Tâche P2. Par image, c'est **trois `Color.copy` et six
affectations**.

⛔ **ET QUATRE PARAMÈTRES MORTS SONT PARTIS** : `couleursFond`, `houle`, `chop`, `ecumeEchelle` ont
quitté la signature de `poserMer`. D13 §① le demande — « plus de paramètre de compatibilité à
traîner » — et deux écrivains pour une grandeur, dont un muet, c'est la faute que D13 §③ nomme.

⛔ **ET `globe.js` NE TRANSCRIT PLUS `chopLook`.** Il portait `1.9 * chop * chop` et
`240 - 130 * chop`, une **seconde écriture** d'une loi qui vit dans `ocean.js` — et que le panneau
« Effets » peut changer. `uMerEcume` et `uMerBrillance` arrivent maintenant de `uFoam` et `uGloss`,
**lus**. Le test ⑦e le garde.

### ⛔ UN TEST DU DÉPÔT A ATTRAPÉ MA PREMIÈRE ÉCRITURE

`test/damier-uniformes.test.js` ③ interdit de céder `terrain.mapUniforms` **en bloc** à qui que ce
soit — « un module qui la reçoit écrit dedans quand il veut, et aucune des deux autres propriétés
de ce fichier ne le voit passer ». Ma première version passait la poignée entière à
`couleursFondDuSocle`. **Elle prend désormais trois couleurs, lues une par une**, comme
`contexteCrop` le fait déjà. **Le test l'a dit à la première exécution de `npm test`.**

---

## 7. LES TESTS ET LA CAMPAGNE DE MUTATION

`test/mer-sphere.test.js` — **+12** (section ⑬) ; `test/ecume-mer.test.js` — **+6** (section ⑦),
plus quatre réécrits. **Tous EXÉCUTÉS**, aucun gardé par un simple `grep` :

- **⑬a-c** `profondeurMaxDuCrop`, **avec son témoin** — le dehors du champ DOIT être nettement plus
  profond que le dedans, sinon le test ne distingue rien ; la borne est vérifiée **inclusive à
  `q = ±1`** et exclusive au-delà, la convention d'`uvFond` et de `MER_VERT` ;
- **⑬d-e** `poserMer` sur un champ **qui sépare les deux mesures** (le bouchon des autres tests
  remplit à −500 m partout : les deux y coïncident, et c'est le cas dégénéré) ;
- **⑬f-g** les trois couleurs, **jamais un demi-triplet**, **copiées et non partagées** ;
- **⑬h-i** les six réglages **un par un**, avec vérification que **les cinq autres n'ont pas
  bougé** — c'est ce qui tue une mutation qui échangerait deux affectations ;
- **⑬j** l'expression de la houle, confrontée à `ocean.js` **relu sur le disque** ;
- **⑬k-l** les paramètres morts, et `retirerMer` qui rend les couleurs (l'uniforme est **partagé
  par toutes les tuiles** : le laisser sur la palette du crop repeindrait tous les océans du monde
  en vue orbitale) ;
- **⑦a-f** `etatMerDuSocle` **champ par champ**, le neutre **re-dérivé depuis `chopLook` relu sur
  le disque**, et l'**unicité de l'écrivain** des six uniformes.

⚠️ **ET LE BOUCHON DE COULEUR DU BANC A ÉTÉ REFAIT** : celui du dépôt ne portait qu'un `set()`
**vide**. Une `majReglagesMer` qui n'aurait rien copié serait passée sans un mot — la classe
d'erreur que P4 nomme (« une assertion qui prouve qu'un texte est là »).

### La campagne — `.banc/mutations-P5.mjs`, worktree `C:/Dev/wt-p5-mut`, **retiré en partant**

`node_modules` en **jonction** vers l'arbre principal ; **`git ls-files --eol` vérifié `i/lf w/lf`**
sur les cinq fichiers touchés — aucun faux survivant possible.

**38 mutations sémantiques, dont 26 visant le BRANCHEMENT.**

- **Premier tour : 37 / 38.** Une survivante.
- ⛔ **ET ELLE ÉTAIT NEUTRE, JE LE DIS PLUTÔT QUE DE LA COMPTER.** « le fond n'est plus passé du
  tout » insérait `fond: null` **après** l'étalement mais **avant** la vraie clé `fond:` — et dans
  un littéral d'objet **la dernière clé gagne**. Elle ne changeait rien du tout : un faux survivant,
  pas un trou de test. Réécrite pour retirer vraiment l'argument.
- **Second tour : 38 / 38, 0 non appliquée.** `.banc/resultat-mutations-P5.json`.
  **Chaque mutation est remise sur le disque, les tests rejoués pour confirmer l'échec, puis le
  fichier restauré** ; `git diff --stat` du worktree vérifié **vide** avant retrait.

---

## 8. CLÔTURE

- `npm test` — **3 965 / 3 965** (3 947 au départ, **+18**, aucun retiré).
- `npm run audit:tests` — **209 listés · 209 sur disque, aucun écart**.
- `node --check` — vert sur `src/globe.js`, `src/ocean.js`, `src/main.js`,
  `src/monde/mer-sphere.js`, `src/monde/ecume-mer.js`, `test/mer-sphere.test.js`,
  `test/ecume-mer.test.js`.
- **CRLF** — `git diff --cached --stat` et `git diff --cached --ignore-cr-at-eol --stat` rendent
  **exactement le même compte** sur les deux commits.
- **Arbre propre après commit**, **worktree de mutation retiré** (`git worktree list` ne le porte
  plus, le dossier n'existe plus).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terrain.mesh.visible = true`, plinthe visible, `real-water` visible avec ses **deux** maillages,
  **aucune mer ni paroi de crop**, `uMerRampeOn = 0`, les trois `uOcean*` **rendus au défaut du
  module**, `uMerFondBudgetM = 6 000` (le défaut mondial), **31 programmes, zéro erreur**
  (recherche `shader|GLSL|program|Uncaught|TypeError|ReferenceError|Error`).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : mer et fond posés,
  `uMerFondBudgetM = 2 116,273`, `uOcean* = #c8f2e4 / #62cfc1 / #136e7d` — **identiques à
  `terrain.mapUniforms`** —, `uMerHoule = 2`, `uMerChop = 1`, `uMerEcume = 1,9`,
  `uMerEcumeEchelle = 1`, `uMerBrillance = 110`, `uMerVitesse = 0,4`, **23 programmes, zéro
  erreur**.

---

## 9. MES RÉSERVES

1. ⛔ **LE BLOC N'EST TOUJOURS PAS UNE BOÎTE PLEINE, ET C'EST CE QUI SAUTE LE PLUS AUX YEUX
   MAINTENANT.** Sur `L1-CROP-bloc-APRES.png`, le flanc est du bloc est un grand aplat **beige** à
   arête en escalier — la face de la paroi du crop, que la nappe de mer ne recouvre pas jusqu'à la
   frontière —, doublé des jupes de tuiles qui pendent. Le socle y a une paroi terracotta continue.
   **Je ne l'ai pas touché** (jupes et parois sont d'autres tâches) mais **c'est plus visible que
   ce que je viens de réparer**, et je préfère le nommer que le laisser découvrir.
2. ⚠️ **LA LAME D'EAU N'EST PAS CELLE DU SOCLE, ET C'EST LE PLUS GROS RESTE.** Sur le masque de la
   mer, la concentration de luminance vaut **80,97 % côté crop contre 30,33 % au socle** ; sur le
   fond marin NU, **40,14 % contre 38,73 %**. ➡️ **Presque tout l'écart vit dans la NAPPE.** La mer
   du socle AJOUTE de la variation (écart horizontal 2,46 → 3,36 quand on la pose) ; celle du crop
   en RETIRE (1,55 → 1,37). Suspects non mesurés : la transparence (`uMerSeuilEau`, `uMerProfMax`,
   le glacis de lagon), les caustiques, les normales de clapot. **Je n'ai pas fait cette mesure et
   je ne l'invente pas.**
3. ⚠️ **L'ÉCHELLE DE LONGUEUR DE HOULE N'EST PAS BRANCHÉE, ET L'ÉCART EST MESURÉ.** Le socle vit à
   `lenSea = LEN_SCALE × clamp(waveScale) = 0,42 × 0,55 = **0,231**` — une valeur qui dépend de
   l'échelle verticale du bloc — pendant que le crop dérive la sienne de `ECHELLE_HOULE_UNITES =
   0,42` **en dur** (`echelleHouleM`). **Le spectre du crop est donc 1,818 fois plus étiré.** Je ne
   l'ai pas fermé parce que les deux vivent dans des systèmes d'unités différents (`uLenScale` en
   unités de scène du socle, `uMerLambda` en unités locales du crop) et que le refermer demande sa
   propre mesure — celle-là même que P4 dit avoir manqué de faire sur l'état de mer.
4. ⚠️ **UN SEUL LIEU.** Tout est sur La Réunion, z12. Un crop **continental** (pas de mer) retombe
   sur le neutre — vérifié par test (⑬e, ⑦b), **pas à l'écran**. Un crop de haute latitude non plus.
   Et une palette **autre que « lagoon »** n'est vérifiée que par test.
5. ⚠️ **TOUT EST AU REPOS, ET LA VITESSE EST PRÉCISÉMENT CE QUI NE SE VOIT PAS AU REPOS.** J'ai
   corrigé `uMerVitesse` de 1 à 0,4 en m'appuyant sur la source d'`ocean.js` et sur un relevé
   d'uniforme, **pas sur une comparaison de mouvement**. Le reste de mes captures ne dit rien du
   battement, ni du clignotement, ni des coutures en mouvement.
6. ⚠️ **LA MER LOINTAINE DE LA CALOTTE SATURE MAINTENANT PLUS TÔT.** Le budget étant celui du crop
   (2 116 m) et non celui de la calotte (3 510 m), tout ce qui est plus profond que 2 116 m au-delà
   de la frontière rend **exactement `uOceanDeep`**. C'est le prix de l'accord avec le socle, qui
   n'a rien du tout au-delà de son bloc. **Sur La Réunion cette zone est estompée et je ne l'ai pas
   vue changer ; ailleurs, je ne sais pas.**
7. ⚠️ **LE COÛT N'EST PAS MESURÉ.** `majReglagesMer` fait par image trois `Color.copy` et six
   affectations de plus, et `_cuireChampMer` un balayage supplémentaire de 148 225 nœuds à chaque
   cuisson. **Je n'ai chronométré ni l'un ni l'autre**, et je préfère le dire que d'annoncer
   « négligeable ».
8. ⚠️ **AUCUNE PREUVE BIT-À-BIT DU SOCLE.** Trois fichiers de production sont touchés
   (`ocean.js`, `main.js`, plus les deux modules) ; ce qui les garde, ce sont les tests **exécutés**
   du §7 et le relevé « drapeau baissé » du §8, **pas une comparaison d'images** — P4 a montré que
   le plancher de bruit inter-chargement (jusqu'à 33,28 %) y est plus grand que l'effet.

---

## 10. CE QUI RESTE SUR LE DISQUE

`.banc/harnais-P5.mjs` (il **IMPORTE** `harnais-P4.mjs`, qui importe `harnais-P3.mjs`) ·
`.banc/serveur-vues-P5.mjs` (port 5603) · `.banc/png-P5.mjs` (décodeur PNG minimal : le dépôt n'a
aucun paquet qui sache lire une tuile bathy) · `.banc/mutations-P5.mjs` ·
`.banc/resultat-mutations-P5.json` · `.banc/vues-P5/` — **26 captures** et **4 relevés bruts**
(`bilan-P5.json`, `bilan-cadrage.json`, `releves-bruts-P5.json`, `source-bathy-P5.json`), qui
portent chacun des chiffres de ce rapport.
