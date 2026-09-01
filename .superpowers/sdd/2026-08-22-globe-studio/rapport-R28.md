# R28 — UN SEUL STYLE POUR TOUTE LA TERRE, ET LA BANDE VERTE DES CÔTES

Arbre `C:\Dev\wt-sty`, branche `style-monde`. Trois commits.
`npm test` : **4 622 · 0 échec** (base à battre : 4 607). `npm run audit:tests` :
**239 = 239, aucun écart**. Pilote : ANGLE / NVIDIA RTX 3080 (D3D11), palier
**PLEINE QUALITÉ** relevé DANS chaque mesure (`ombres: dynamic`, `grain: true`,
`pixelRatio: 1`) — l'avertissement du brief sur `__palierMachine` est honoré.

---

## ⓪ EN UNE PHRASE

**Le vert n'est pas une couche posée sur les côtes : c'est le BAS de la table de
couleur, et `natRampT` y envoyait toute la terre basse — celle du crop comme
celle de la planète entière, parce que quatre uniformes mesurés sur une île sont
partagés par les 1 700 matériaux de tuile du globe.**

---

## ① LA BANDE VERTE — LA CAUSE, À L'ÉTAGE DU NUANCEUR, AVEC SON CHIFFRE

### L'étage

`src/globe.js`, bloc `if (uRampCropOn > 0.5 && !sousEau)` :

    float rampT = natRampT(hNormRelief, pivot, uHeightContrast);
    col = texture2D(uRampCrop, vec2(rampT, wetY)).rgb;

`natRampT` vaut `clamp(0,5 + (hNorm − pivot) · contraste, 0, 1)`. **Sa fenêtre
utile vaut `1 / contraste`** en hauteur normalisée : au-dessous, `rampT = 0`,
c'est-à-dire **le premier texel du LUT**, c'est-à-dire la première butée de la
palette. Dans le gabarit d'ouverture (`public/templates/defaults/shibustart.json`,
`look.rampStops[0]`), cette butée est **`#93a074`**.

### Le chiffre

Relevé dans l'application vivante — uniformes vivants, **les deux tables de
couleur relues OCTET PAR OCTET** (`uRamp` est un `<canvas>` 512×1, `uRampCrop`
une `DataTexture` `flipY = false`), la loi du nuanceur rejouée en JS sur un
balayage d'altitudes : `scripts/diag-r28-bande.mjs` → `.banc/R28/bande.json`.

| | La Réunion z12 | Bornéo z10 | Bornéo z13 |
|---|---|---|---|
| `uReliefBas` / `uLandMax` | 107,5 / 3 009,6 m | −93,2 / 3 957,3 m | −66,7 / 650,6 m |
| `uHeightPivot` / `uHeightContrast` | 0,41 / 2,2 | 0,14 / 3,3 | 0,44 / 6,4 |
| fenêtre utile `1/contraste` | 1 319 m | 1 227 m | **112,1 m** |
| **`rampT` saturé à 0 jusqu'à** | **637,8 m** | — | **192,9 m** |
| `rampT` saturé à 1 à partir de | 1 815 m | 1 087,5 m | 304,9 m |

➡️ **À La Réunion, TOUTE terre de 0 à 637,8 m — partout sur la planète — recevait
une seule couleur : `rgb(147, 160, 115)` = `#93a074`, un olive vert.**

À Bornéo z10 il n'y a pas de saturation, mais la lecture du LUT vivant dit la
même chose autrement — voici la couleur rendue, altitude par altitude :

| h | 0 m | 50 m | 100 m | 200 m | 300 m | 500 m | 800 m |
|---|---|---|---|---|---|---|---|
| `rampT` | 0,114 | 0,155 | 0,195 | 0,277 | 0,358 | 0,521 | 0,766 |
| couleur | — | 179,186,128 | 186,187,129 | 201,191,133 | 201,173,114 | 187,130,79 | 120,65,42 |

**Les 300 premiers mètres tiennent dans les 36 % bas de la table, qui sont ses
verts ; à 500 m on est déjà dans les bruns.** La plaine côtière de Bornéo est
sous 350 m sur des dizaines de kilomètres : d'où une bande verte qui suit le
littoral. C'est mot pour mot la capture ① d'Adrien.

### La preuve par élimination — aucun autre étage ne peut faire du vert

Sur les uniformes relevés au même instant : `uSolOn = 0` (pas d'occupation du
sol), `uSlopeTint = 0` (nul en mode Naturel, et c'est `uColorMode` qui le dit),
`uPhotoMonde = 0`, `uAerialOn = 0`, `uGrainForceM = 0`. Restent le peigne — un
**soft light**, qui ne touche que la luminance — et le voile aérien, qui tire
vers `uHazeColor = #b9c6d6`, un **bleu-gris**. ⛔ **Le seul étage du nuanceur qui
peut poser un vert est la table de rampe.**

### ⚠️ ET LA BANDE EST DES DEUX CÔTÉS DE LA FRONTIÈRE — ce que j'ai cru puis réfuté

Ma première lecture était que la bande vivait **hors** du crop, par fuite des
quatre uniformes sur la planète. **Mesuré, c'est faux là où Adrien regarde.**
Bornéo z10, témoin nul à **0 pixel**, `scripts/diag-r28-fuites.mjs` : basculer le
grade du crop vers celui du monde change **510 392 pixels**, et **la correction
livrée en change 6**. Autrement dit : à cette altitude, **tous ces pixels sont
DANS le crop**. L'estompage efface les alentours dès que le bloc vit, et la vue
« moyenne » d'Adrien est presque entièrement du crop.

➡️ **La correction livrée règle la moitié HORS crop** (elle est réelle et
mesurée, §②) ; **la moitié DANS le crop est un arbitrage de palette, chiffré au
§⑦, que je ne tranche pas seul.**

---

## ② CE QUI FUYAIT SUR LA PLANÈTE — mesuré à l'écran, par construction

Manœuvre de R21 : deux images au même instant, l'uniforme suspect remplacé par sa
valeur de monde dans la seconde. **Tout pixel qui diffère est un pixel du régime
du crop, par construction.** Témoin nul **0 pixel**, retour A/C **0 pixel**.
Bornéo z10, pleine résolution 1 280 × 800 (`.banc/R28/avant/fuites.json`).

| poste basculé vers le monde | pixels | % image | écart moyen SUR EUX | σ luminance |
|---|---|---|---|---|
| ancres `uReliefBas` / `uLandMax` | 903 607 | 88,24 % | 13,05 / 255 | 32,58 → 32,16 |
| grade `uHeightPivot` / `uHeightContrast` | 510 392 | 49,84 % | 9,83 / 255 | 32,58 → 31,79 |
| **voile aérien éteint** | **509 975** | **49,80 %** | **20,55 / 255** | **32,66 → 35,21** |
| **budget du fond marin** | **371 592** | **36,29 %** | **24,77 / 255** | 32,66 → 25,94 |

⚠️ **LE PREMIER TOUR DE CE BANC A RENDU 0 PIXEL SUR LES ANCRES ET SUR LA MER, ET
C'ÉTAIT UN FAUX ⛔.** `majEchelleRampe` (l'échelle continue de la Tâche K bis)
**réécrit ces uniformes à chaque image** : le banc poussait une valeur qu'un autre
écrivain reposait soixante fois par seconde. Il a fallu geler
`_poserUniformesRampe` pendant la bascule. *Un banc qui mesure zéro parce que sa
valeur ne survit pas à une image se croit concluant.*

⚠️ **ET LE TÉMOIN A FAIT SON TRAVAIL** : au premier passage à Bornéo il rendait
**50 416 pixels** (la scène chargeait encore). Le banc redemande désormais le
témoin jusqu'à ce qu'il soit nul.

**Ce que ces chiffres disent, en français :**

- le voile aérien lisait `fd = length(qCrop)`, une distance au **centre du crop**.
  Hors emprise elle dépasse 1, le `clamp` la fige à 1, et le voile s'appliquait
  **à pleine distance sur toute la planète** — 20,55/255 de lavage, et **σ qui
  MONTE de 2,5 quand on l'éteint** : il ne teintait pas, il **aplatissait**. C'est
  la moitié de « l'aplat vert olive uniforme, **sans relief** » de sa capture ② ;
- le fond marin peignait tout l'océan du globe sur le budget du crop — **113,3 m
  à Bornéo**. Au-delà du plateau continental, tout saturait sur `uOceanDeep`, d'un
  seul aplat : le « **sans bathymétrie** » de la même capture, et exactement
  l'inverse de sa capture ④.

---

## ③ LE DÉPARTAGE ÉCRIT — CE QUI DEVIENT GLOBAL, CE QUI RESTE BORNÉ, ET POURQUOI

Le départage se fait sur **`dedansCrop`** — la couverture douce de la
superellipse que les parois, l'albédo et l'éclairage suivent déjà. Le fondu est
donc celui du bord du bloc : **aucune couture à inventer**, et l'intérieur du crop
ne bouge pas d'un pixel (vérifié : §⑤).

### ✅ DEVENU GLOBAL — la donnée existe pour toute tuile

| poste | ce qui le rend possible | la mesure qui l'autorise |
|---|---|---|
| **le régime de rampe** (`natRampTMonde`) | `RAMPE_MONDE` + `GRADE_MONDE` sont des CONSTANTES, dérivées d'un balayage mondial du MNT. Le LUT lu est celui du SOCLE, pas une texture de crop | l'axe Y (l'humidité) est le seul à venir de l'analyse, et **hors crop il rend sa MÉDIANE** — `natHumiditeY(0,5 ; 0,5 ; …) = 0,5` exactement, donc la rampe historique. ΔE **2,89** contre 25,82 pour les bornes et 20,76 pour la loi X |
| **le budget du fond marin** | `RAMPE_MONDE.profondeur`, une constante | 371 592 px, 24,77/255 (§②) |
| **le peigne des crêtes** (`uTexShade`) | se recalcule depuis `uTex`, la texture de hauteur que **chaque tuile porte déjà** | **UNE lecture de texture de plus**, parce que la normale par fragment lit déjà les quatre voisins. Coût mesuré : §④ |

⚠️ **`POSTES_MONDE` (le départage de D15 codé en dur) portait un motif FAUX sur
`uRampCropOn`** : *« `uRampCrop` indexé sur `uAnalysis` en Y »*. L'axe Y n'a
jamais rien empêché — c'est la mesure ci-dessus. Corrigé, et le test l'EXÉCUTE au
lieu de le déclarer.

### ⛔ RESTE BORNÉ AU CROP — la donnée n'existe que sur l'emprise

| poste | pourquoi il ne peut pas être global |
|---|---|
| `uCoastMask` (le trait de côte) | **une seule texture cuite sur l'emprise**. Non touchée |
| `uAnalysis` (le peigne cuit, l'humidité) | idem. Et le laplacien FRACTIONNAIRE multi-échelle du socle est **meilleur** que celui d'ici : là où l'analyse existe, c'est elle qui peint (`uTexShade × (1 − partAnalyse)`) |
| `uSol` (l'occupation du sol) | idem — et `sUv` est bâti sur `qCrop` : hors emprise il sort de [0 ; 1] et la mosaïque, en ClampToEdge, prolongeait sa dernière ligne sur toute la planète estompée. **Borné.** ⚠️ Non mesuré à l'écran (`solOn = 0` dans le gabarit livré) : garde de cohérence D15, pas correction d'un défaut observé |
| `uAerial` (la photo aérienne du bloc) | déjà borné avant cette tâche |
| **le voile aérien** | ce n'est pas une texture, et c'est justement pourquoi personne ne l'avait vu : sa distance `fd` est une **distance au centre du crop**, elle n'a aucun sens ailleurs. `retirerHabillage` l'écrivait déjà pour le crop MORT ; personne ne l'avait tiré pour le crop VIVANT. **Borné** (49,80 % de l'image, §②) |

### ⚡ LE PEIGNE DU MONDE — la seule pièce vraiment neuve, et son prix compté d'avance

La normale par fragment lit **quatre** hauteurs voisines pour sa différence
centrée. Un laplacien discret demande **les mêmes quatre plus le centre** : le
peigne du monde coûte donc **une lecture**, pas cinq. Trois précautions, chacune
avec sa raison :

- **le centre se RELIT, il ne se reprend pas à `h`** — `h` passe par
  `decodeMetersAA`, un lissage à cinq taps ; comparer un centre lissé à des
  voisins bruts aurait mesuré le lissage, pas le relief ;
- **le signe est inversé** — `Σvoisins − 4·centre` est positif dans un TALWEG, le
  canal du socle est positif sur une croupe CONVEXE. D'où `4·centre − Σvoisins` ;
- **le même `k` que la pente** — la courbure sort en *écart de pente*, sans
  dimension : indépendante du niveau de tuile, de la latitude et de l'exagération.

⛔ **Ce n'est PAS le même opérateur que celui du socle, et c'est écrit dans le
code** : ordre 2 à une seule échelle ici, laplacien fractionnaire multi-échelle
là-bas. Le crop garde le sien, le monde prend celui-ci.

---

## ④ LE COÛT GPU, AUX TROIS ALTITUDES

`scripts/diag-r28-cout.mjs` → `.banc/R28/cout.json`.
**`EXT_disjoint_timer_query_webgl2`**, jamais `gl.finish()`. Passe brute de
`sceneGlobe` / `camGlobe`, hors compositeur. **40 rendus de chauffe après chaque
recompilation**, ordre des variantes **tournant** (A/B puis B/A), **24 paires**
de 60 rendus par altitude, `GPU_DISJOINT_EXT` vérifié à chaque requête.

Les deux variantes vivent **dans la même page** : on réécrit le fragment des
matériaux de tuile (centre supprimé, `natPeigneMonde` neutralisé, pose désarmée)
et on recompile. Comparer deux chargements aurait comparé deux jeux de tuiles.

| altitude | témoin ×16 fragments | AVEC peigne | SANS | **différence APPARIÉE, médiane** | part |
|---|---|---|---|---|---|
| crop z13 (10,9 km) | **×6,58** | 0,4976 ± 0,0142 ms | 0,5170 ± 0,1647 ms | **+0,0170 ms** | +3,29 % |
| z10 (9,6 km, 890 tuiles) | **×7,09** | 1,5454 ± 0,0513 ms | 1,5388 ± 0,0433 ms | **+0,0145 ms** | +0,94 % |
| orbite 300 km (1 069 tuiles) | ×1,39 ⚠️ | 0,5260 ± 0,3754 ms | 0,4358 ± 0,1070 ms | **+0,0134 ms** | +3,07 % |

⚠️ **C'EST LA MÉDIANE DES DIFFÉRENCES APPARIÉES, PAS UN ÉCART DE MOYENNES**, et
la distinction n'est pas cosmétique : les moyennes appariées valent
+0,0066 ± 0,062 ms et +0,090 ± 0,385 ms — **la dispersion vaut vingt fois
l'effet**. Les deux variantes du même tour, elles, ont vu la même dérive
thermique et le même jeu de tuiles.

➡️ **Le surcoût est de +0,013 à +0,017 ms par image de tuiles, aux trois
altitudes, soit 1 à 3 %.** Il est **plat en absolu**, ce qui est exactement la
signature attendue d'*une lecture de texture et une poignée d'ALU*. Sur un budget
d'image de 16,7 ms, **aucune atténuation par distance n'est nécessaire pour le
coût.**

⚠️ **RÉSERVE, ET ELLE EST DANS LE TABLEAU** : le témoin de validité vaut **×1,39
à 300 km** — sous le seuil de crédibilité de R20 (×16 fragments ⇒ ×8,2). À cette
altitude la passe n'est pas limitée par les fragments (l'écran est presque tout
océan et ciel). **La ligne « orbite » est donc à prendre pour un ordre de
grandeur, pas pour une mesure.** Les deux autres sont valides (×6,58 et ×7,09).

### ⚡ L'ATTÉNUATION QUI EST QUAND MÊME NÉCESSAIRE — mais pour la QUALITÉ, pas pour le coût

**La courbure n'est pas invariante d'échelle, contrairement à la pente.** `dhU·k`
est une pente : sans dimension. `laplacien·k` est une *différence de pente sur le
pas*, et elle **grandit avec le pas**, donc avec la distance. À 60 km le peigne
sature. Mesuré, gradient moyen de l'image (base sans peigne : **13,600**) :

| `GAIN_PEIGNE_MONDE` | 0,25 | 1 | 8 |
|---|---|---|---|
| gradient à 60 km | **34,48** | 49,28 | 57,35 |

Un facteur **32** sur le gain ne fait que **×1,66** sur le rendu : l'opérateur est
saturé. **Livré à 0,25** — la plus douce des trois valeurs mesurées qui produisent
l'effet, et la plus proche du gradient de la vue rapprochée (24,1).

---

## ⑤ LES CAPTURES — AVANT / APRÈS, PLEINE RÉSOLUTION 1 280 × 800

`.banc/R28/vues/avant/*.png` et `.banc/R28/vues/apres-g025/*.png`, sept vues,
même protocole des deux côtés (`scripts/diag-r28-vues.mjs`, moyenne sur 5 images,
animations coupées, rails d'interface cachés, `__palierMachine` relevé dans
chaque ligne).

| vue | fichier | gradient avant → après | σ avant → après |
|---|---|---|---|
| Bornéo vue moyenne (18,1 km) | `borneo-moyenne.png` | 26,287 → 26,315 | 32,89 → 32,86 |
| Bornéo côte (9,9 km) | `borneo-cote.png` | 24,183 → 24,211 | 33,90 → 34,01 |
| La Réunion loin (6,7 km) | `reunion-loin.png` | 19,099 → 19,169 | 39,35 → 39,45 |
| La Réunion près (10,9 km) | `reunion-pres.png` | 24,120 → 24,165 | 35,68 → 35,68 |
| **orbite 60 km** | `orbite-60km.png` | **13,600 → 34,480 (+153 %)** | 50,98 → 54,30 |
| **orbite 300 km** | `orbite-300km.png` | **4,600 → 5,237 (+13,8 %)** | 23,41 → 23,76 |
| globe entier (1 200 km) | `globe.png` | 6,052 → 6,101 (+0,8 %) | 21,17 → 21,20 |

⚡ **LES QUATRE VUES DE CROP NE BOUGENT PAS** (0,1 % à 0,4 %, sous le bruit de
banc) : **la correction ne touche pas au bloc, qui est le style qu'Adrien
aime.** Ce sont les trois vues sans crop qui changent — et elles changent
exactement là où il regarde.

⚠️ **`orbite-60km.png` est la paire à regarder d'abord** : avant, un relief lisse
et cireux ; après, les crêtes peignées, la texture de sa capture ③ à 60 km
d'altitude. Et `orbite-300km.png` montre l'eau demandée : bathymétrie turquoise
de la vue orbitale autour d'une île hypsométrique complète.

⚠️ **LES QUATRE SITUATIONS DU BRIEF SONT COUVERTES, AVEC UN ÉCART ASSUMÉ** :
« La Réunion vue éloignée » n'existe pas telle qu'il l'a filmée. **La butée de
caméra plafonne l'altitude tant qu'un crop vit** (constat ① de `plan-fusion.md`),
et l'estompage efface les alentours dès que le bloc grandit. J'ai donc ajouté
**deux altitudes orbitales intermédiaires (60 km et 300 km)** : c'est là que vit
son « au-dessus de Z10 », pas à 1 200 km où l'écran est presque tout océan.

---

## ⑥ CE QUE J'AI CRU PUIS RÉFUTÉ

**① « La bande verte est une fuite du crop sur la planète. »** ⛔ Faux là où il
regarde. Bornéo z10, témoin nul à 0 pixel : basculer le grade change 510 392
pixels et la correction livrée en change **6**. Tous ces pixels sont **dans** le
crop. La fuite existe et elle est mesurée (§②), mais l'estompage la rend presque
invisible tant qu'un bloc vit.

**② « `laplacien · k` est sans dimension, comme `dhU · k`. »** ⛔ Faux. Une
différence PREMIÈRE sur le pas est une pente ; une différence SECONDE est une
pente-par-pas, qui grandit avec le pas donc avec la distance. Conséquence
mesurée : un facteur 32 sur le gain ne change le rendu que de ×1,66 — l'opérateur
est saturé à 60 km. C'est ce qui a fixé le gain à 0,25 au lieu de 8.

**③ « Il faut un PLAFOND de pivot, jumeau du plancher. »** ⛔ Non livré, et c'est
mesuré. `plancherPivot` empêche le pivot de descendre sous le niveau de la mer ;
j'ai cru qu'il manquait la borne symétrique. Calculée sur les **cinq** vues
relevées, elle **ne mord que dans une seule** (Bornéo z13), et là elle échange un
tablier vert de 193 m contre une rampe de 111 m avec du blanc plat au-dessus.
**Elle déplace la fenêtre, elle ne l'élargit pas** — le vrai levier est
`heightContrast`, qui est un réglage d'Adrien. Non tranché seul (§⑦).

**④ « Pousser un uniforme suffit à le mesurer. »** ⛔ Non : `majEchelleRampe`
réécrit `uReliefBas`, `uLandMax`, `uOceanDepth` et `uMerFondBudgetM` **à chaque
image**. Premier tour du banc : **0 pixel** sur deux postes qui en valent 903 607
et 371 657. Un faux ⛔ complet.

**⑤ « Un descripteur d'image entière peut juger si le loin ressemble au près. »**
⛔ Confondu : à 60 km la caméra tombe sur une chaîne de montagnes, à 300 km sur
une île dans l'océan, près sur un bloc avec parois et fond de studio. Les
cadrages diffèrent, donc la distance entre descripteurs mélange le style et le
sujet. Le juge utilisable est la **bascule appariée à cadrage fixe**
(`uTexShade` 0 ↔ 1), et c'est elle qui donne les chiffres du §⑤.

**⑥ « `enterOrbit(alt)` place la caméra à `alt`. »** ⛔ Pas si elle est déjà en
orbite : trois appels d'affilée à 60 000, 300 000 et 1 200 000 m ont tous rendu
**60 000 m**. Le banc pose désormais `orbAltTarget`, et l'unité est **dérivée** du
couple (`orbAlt`, `altM`) lu dans la page.

**⑦ « Rien ne se dessine. »** ⛔ Mon propre instrument de fumée l'a annoncé sur
une page **saine** : `readPixels` hors du `requestAnimationFrame` lit un tampon
déjà effacé (`moy = 0`, `sigma = 0`, `calls = 1`). Corrigé — et gardé, parce que
la vraie panne qu'il attrape, elle, est réelle : voir ⑧.

**⑧ Ce que la leçon de R25 a effectivement rattrapé.** `${GAIN_PEIGNE_MONDE}`
rendait `8`, un ENTIER : GLSL n'a pas trouvé la surcharge, **le fragment refusait
de se lier, et plus une seule tuile ne se dessinait**. Aucun banc différentiel
n'aurait vu la différence. **C'est la console qui l'a dit.** Le test ⑤b verrouille
désormais le `.toFixed(2)`.

**⑨ ⛔ ET UNE SURVIVANTE DÉJÀ COMMITÉE, TROUVÉE EN PASSANT.**
`test/crop-rampe.test.js` portait `matchAll(/<0x08>from '…'/g)` — un `\b` écrit
par un script d'édition et devenu **retour arrière**. La regex ne pouvait rien
trouver, `matchAll` rendait toujours une liste vide, et `assert.equal(…, 0)`
passait quoi qu'il arrive : la garde *« relief-grade.js doit rester une feuille »*
était **inopérante**. **Quatrième occurrence de cet incident sur ce chantier, la
première qui dormait dans un test commité.** Rendue, vérifiée en la cassant.
⚠️ Et je l'ai repayée moi-même dans mon propre script Python le quart d'heure
suivant, sur `\b` hors chaîne brute. **`grep | cat -A` est la seule parade.**

---

## ⑦ CE QUE JE NE TRANCHE PAS SEUL — ARBITRAGE POUR ADRIEN

⛔ **DANS LE CROP, LE TABLIER VERT RESTE, ET C'EST UNE DÉCISION DE PALETTE, PAS
UN DÉFAUT DE CODE.** Deux leviers, chiffrés :

1. **La butée basse de la palette.** `look.rampStops[0] = #93a074`, un olive vert
   **à l'altitude zéro**. Toute terre proche du rivage la reçoit, sur toute la
   planète et sur tous les gabarits. La changer (un beige, un sable) supprime la
   bande partout, immédiatement — **mais déplace la couleur du littoral de TOUS
   les gabarits enregistrés**, donc l'aspect du travail de design d'Adrien. Même
   classe d'arbitrage que `cloudAltitude`.
2. **`heightContrast` et son auto-gradation.** La fenêtre utile de la rampe vaut
   `1 / contraste`. Sur un petit crop, l'auto-gradation rend jusqu'à **6,4**
   (Bornéo z13), soit **112 m de fenêtre pour 717 m d'amplitude** : tout ce qui
   est en dessous est une seule couleur, tout ce qui est au-dessus en est une
   autre. Un plafond sur le contraste des petits crops est possible ; il
   changerait le bloc, donc l'affiche.

➡️ **Je livre la moitié qui est sans risque** (la planète hors crop reprend son
propre régime, et le style de près l'habille) **et je pose la moitié qui touche
au design.**

---

## ⑧ AUTRES RÉSERVES

- ⚠️ **La Réunion z9 ne se stabilise jamais** : sept témoins nuls d'affilée entre
  **0,07 % et 1,71 % de pixels**, écart moyen ~1,2/255, sur une scène immobile.
  C'est la classe du transitoire ~0,17/0,33 déjà consignée, cause non identifiée.
  **Les mesures prises à cette vue ne valent rien** et ne sont pas citées ici.
- ⚠️ **Le témoin de coût à 300 km vaut ×1,39** — voir §④.
- ⚠️ **`mix` aux bornes.** `mix(a, b, 1.0)` n'est pas garanti bit-à-bit égal à `b`
  selon l'écriture du pilote. Les trois mélanges posés sont bornés par
  `dedansCrop`, qui vaut exactement 1 bien à l'intérieur du bloc ; l'écart
  possible est d'un ULP, invisible sur huit bits. **Ce n'est donc pas « au bit
  près » dans le crop, et je le dis plutôt que de l'écrire.** La mesure §⑤ le
  confirme à 0,1 % près sur les quatre vues de crop.
- ⚠️ **Le peigne du monde est un laplacien d'ordre 2**, plus nerveux que le
  fractionnaire du socle. Il est calibré à 0,25 sur trois altitudes ; une machine
  plus lente, un `pixelRatio` différent ou un palier dégradé changeraient le pas
  et donc la force. **Non mesuré hors PLEINE QUALITÉ.**
- ⚠️ **`GAIN_OMBRE_MONDE` (1,10) n'a pas été balayé** comme `GAIN_PEIGNE_MONDE` :
  il porte `n·L − haut·L`, borné à ±1 par construction, et il n'a donc pas le
  problème d'échelle du premier. Il reste un choix, pas une mesure.

---

## ⑨ LES INSTRUMENTS, POUR LA SUITE

| script | ce qu'il mesure |
|---|---|
| `scripts/diag-r28-bande.mjs` | les uniformes vivants + **les deux LUT relus octet par octet**, et la loi du nuanceur rejouée sur un balayage d'altitudes. C'est lui qui nomme la couleur d'une altitude |
| `scripts/diag-r28-fuites.mjs` | la manœuvre de R21 sur la colorisation : témoin nul obligatoire et redemandé, **gel de `_poserUniformesRampe`**, pleine résolution |
| `scripts/diag-r28-fumee.mjs` | **la porte** : la console de nuanceur, le compte de triangles, σ de l'image. Un fragment qui ne se lie plus passe tous les bancs différentiels |
| `scripts/diag-r28-vues.mjs` | les sept vues, leurs PNG pleine résolution et leur descripteur à quatre grandeurs |
| `scripts/diag-r28-cout.mjs` | la minuterie du pilote, témoin de validité, 40 chauffes, ordre tournant, différences appariées |
