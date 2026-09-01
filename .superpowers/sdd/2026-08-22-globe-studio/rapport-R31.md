# R31 — LE LIEN ENTRE LE CROP ET LA GRANDE ÉCHELLE

Arbre `C:\Dev\wt-ech`, branche `echelle-rampe`. Trois commits.
`npm test` : **4 647 · 0 échec** (base à battre : 4 641). `npm run audit:tests` :
**240 = 240, aucun écart**. Pilote : ANGLE / NVIDIA RTX 3080 (D3D11), relevé
dans chaque mesure. Serveur : `npm run dev` sur **5731**, arrêté en partant.

---

## ⓪ EN UNE PHRASE

**Les couleurs du gabarit s'appliquaient déjà de loin — le brief a raison, et je
l'ai vérifié : les deux régimes lisent la MÊME table `uRampCrop`. Ce qui ne
suivait pas, c'est l'échelle d'altitude, donc l'INDICE avec lequel on lit cette
table ; l'écart entre les deux vaut ΔE 18 à 63 sur la même terre, et il se
referme désormais continûment avec l'altitude de la caméra.**

---

## ① L'ÉCART ENTRE LES DEUX RÉGIMES — LE CHIFFRE QUI DÉCIDE S'IL Y A UNE TÂCHE

`scripts/diag-r31-ecart.mjs` → `.banc/R31/ecart-avant.json`. Uniformes VIVANTS,
table 2D relue **octet par octet**, les DEUX lois d'indice rejouées en JS sur les
MÊMES hauteurs de sol, lues dans la MÊME table, ligne médiane (`Y = 0,5`, le
neutre de `natHumiditeY` hors analyse). **ΔE = CIE76 L\*a\*b\* D65** — écrit en
toutes lettres parce que ce n'est pas un écart RGB ; le seuil de perception
courant vaut **2,3**.

Régime du monde, lu dans le module et non recopié : `reliefBas −6 000`,
`landMax 5 600`, `pivot 0,56`, `contraste 4,5`.

| lieu (crop vivant) | h = 0 m | h = 300 m | h = 800 m | h = 1 200 m |
|---|---|---|---|---|
| **La Réunion** z13 (île volcanique, 10 864 m) | **18,0** | **25,4** | **38,5** | 45,6 |
| **Pays-Bas** z13 (plaine, 6 138 m) | 3,5 | **33,1** | 52,4 | 63,3 |
| **Everest** z13 (haute montagne, 12 411 m) | 18,0 | **25,4** | 38,5 | 45,6 |
| **Bornéo** z13 (plaine côtière, 7 274 m) | 18,0 | **35,8** | 52,4 | 63,3 |

Aux trois altitudes obtenues par trois zooms (z13 / z11 / z9), le ΔE **médian sur
la tranche d'altitude qui existe vraiment dans le crop** :

| | z13 | z11 | z9 |
|---|---|---|---|
| La Réunion, tranche [540 ; 3 052] m | **20,7** | **30,4** | **33,3** |
| Bornéo, tranche [0 ; 324] m | **36,2** | **37,6** | **37,1** |
| Pays-Bas, tranche [0 ; 20] m | **47,7** | **47,7** | **47,7** |

➡️ **Huit à vingt fois le seuil de perception. Ce n'est pas une nuance : c'est
une autre carte.** Il y a une tâche.

⚠️ **ET LE BALAYAGE LARGE (0 → 4 000 m) SURESTIME.** Comparer deux couleurs à
3 000 m au-dessus d'un crop dont la terre plafonne à 324 m, c'est comparer deux
couleurs que personne ne voit. Le tableau ci-dessus est donc **borné à
`[max(0, uReliefBas) ; uLandMax]`**, le relief réel de l'emprise ; le balayage
large ne sert qu'au départage.

---

## ② LA LOI DE RECOLLAGE, ET À QUELLE ALTITUDE ELLE OPÈRE

    float rampTMonde = natRampTMonde(h);
    rampT = mix(rampT, rampTMonde, uRecollage);   // ⟵ R31
    rampT = mix(rampTMonde, rampT, dedansCrop);   // ⟵ R28, INCHANGÉ, et TOUJOURS LE DERNIER

avec, dans `src/monde/rampe-crop.js` §⑦ :

    poidsRecollage(alt) = smoothstep( log2(alt) , de 11 à 15 )
    CRAN_RECOLLAGE_BAS  = 11  →  2 048 m
    CRAN_RECOLLAGE_HAUT = 15  → 32 768 m

**En français : l'indice de rampe du crop glisse vers celui du monde à mesure que
la caméra monte. En bas c'est l'affiche d'Adrien au bit près ; en haut la même
terre porte déjà la couleur qu'elle aura après la mort du bloc.**

### Pourquoi ces deux altitudes-là, et pas deux nombres choisis

- **2 048 m = 2¹¹, la station de l'affiche.** `globe.js` chiffre déjà la
  couverture du bloc « à la station 2 km ». C'est la vue de composition, celle
  qu'Adrien règle : `mix(x, y, 0.0)` vaut `x·1 + y·0`, donc **elle ne bouge pas
  d'un bit**.
- **32 768 m = 2¹⁵**, et il tombe **entre les deux seuils de vie du crop** :
  `SEUIL_NAISSANCE_M` = 32 274 m, `SEUIL_MORT_M` = 40 343 m (`seuil-socle.js`,
  relevés). ⚡ **C'est la condition qui interdit une marche** : `retirerRampe`
  bascule tout le régime d'un coup à la mort du crop, et cette bascule n'est
  visible que si le recollage n'est pas fini. Il l'est. `crop-rampe.test.js` ⑧b
  l'EXÉCUTE contre `seuil-socle.js` au lieu de le promettre.
- **Le cran, pas le mètre.** `echelle-continue.js` mesure déjà l'altitude en
  `log2` ; une rampe linéaire en mètres aurait dépensé tout son intervalle dans
  les cent premiers mètres du recul.

### Ce que le poids vaut aux altitudes de travail — relevé, pas calculé

| lieu | `altitudeCadrageM()` | `uRecollage` vivant |
|---|---|---|
| Pays-Bas | ~6 000 m | **0,346** |
| Bornéo | ~7 400 m | **0,435** |
| Everest | 8 819 m | 0,540 |
| La Réunion | 9 316 m | **0,569** |

### Pourquoi on mélange l'INDICE et pas deux couleurs

Avant écrêtage, les deux lois sont **affines en `h`** ; leur mélange l'est aussi.
La courbe reste croissante **pour tout poids** — seules sa pente et son origine
changent. Aucune inversion n'est possible, et **une seule lecture de texture**
suffit. Le mélange porte sur les valeurs **écrêtées** : le résultat reste dans
[0 ; 1] sans second écrêtage, et l'aplat disparaît quand même — *un plat mélangé
à une fonction strictement croissante est strictement croissant*.

---

## ③ L'APLAT VERT, AVANT / APRÈS — À L'ÉCRAN, PLEINE RÉSOLUTION

`scripts/diag-r31-vues.mjs` → `.banc/R31/vues.json`, PNG dans `.banc/R31/vues/`.
**A/B APPARIÉ DANS LA MÊME PAGE** : à chaque vue, une capture avec le poids
vivant, une avec `uRecollage = 0` — c'est-à-dire exactement le nuanceur d'avant.
⛔ **`majEchelleRampe` réécrit l'uniforme à chaque image** (le faux zéro qui a
coûté un tour de banc à R28) : elle est **gelée** pendant la bascule, et le banc
vérifie que le zéro a tenu. **Témoin nul : 0 pixel sur les quatre vues.**
1 280 × 800, moyenne de 5 images, animations coupées, rails cachés.

| vue | alt | `uRecollage` | bascule | **verts avant → après** | dont bougés | gradient sur les verts | cases pour la moitié des verts |
|---|---|---|---|---|---|---|---|
| **La Réunion z13** | 10 864 m | 0,569 | 101 091 px (9,9 %), 14,1/255 | 153 030 → **142 685** (−6,8 %) | 6,8 % | 21,39 → 20,64 | 24 → 21 |
| **La Réunion z12** | 10 627 m | 0,569 | 419 414 px (41,0 %), 13,0/255 | 248 614 → **137 412 (−44,7 %)** | **48,9 %** | 25,28 → **20,81** | 56 → 25 |
| **Bornéo z13** | 9 331 m | 0,569 | 104 884 px (10,2 %), 6,9/255 | 254 351 → **212 832** (−16,3 %) | 25,4 % | 22,99 → 21,72 | 44 → 39 |
| **Bornéo z10** | 9 612 m | 0,569 | 498 053 px (48,6 %), 24,0/255 | 466 103 → **440 969** (−5,4 %) | 10,3 % | 22,77 → 22,64 | 33 → 30 |

**Et à l'étage de la loi, l'aplat au sens strict — l'intervalle d'altitudes où
l'indice est CONSTANT, donc où la terre reçoit une seule couleur :**

| lieu (tranche du crop) | avant | après |
|---|---|---|
| La Réunion z13 | **460 m** | **0 m** |
| La Réunion z11 | **980 m** | **0 m** |
| La Réunion z9 | **1 530 m** | **0 m** |
| Bornéo z13 | **90 m** | **0 m** |
| Bornéo z9 | **50 m** | **0 m** |
| Pays-Bas z13 | 10 m | **0 m** |

Étalement de la tranche basse à La Réunion, en couleur : **0 → 300 m passait de
ΔE 0 (un plat) à ΔE 4,36 ; 0 → 600 m à ΔE 8,83.**

⚠️ **LA LECTURE HONNÊTE DE « cases pour la moitié des verts : 56 → 25 ».** Le
nombre BAISSE : les verts restants sont plus homogènes. Ce n'est pas un aplat qui
revient, c'est le contraire — **la surface verte a perdu 45 %**, et ce qui est
parti est la terre de moyenne altitude, désormais brune. Ce qui reste est la
tranche basse réelle. C'est exactement « réduit à une fine bande de plaine
littorale ».

⚠️ **BORNÉO Z10 EST LA VUE OÙ L'EFFET EST LE PLUS FAIBLE (−5,4 %), ET LA MESURE
DIT POURQUOI** : seuls **10,3 %** des verts d'avant ont changé, alors que 48,6 %
de l'image change. Hors de l'emprise, `uRecollage` ne peut RIEN faire —
`dedansCrop` vaut zéro et le régime du monde a déjà la main depuis R28. À z10 le
bloc est petit à l'écran : la majorité des verts n'est pas du crop.

---

## ④ LE COÛT GPU

`scripts/diag-r31-cout.mjs` → `.banc/R31/cout.json`, `cout3/cout.json`.
**Protocole de R28 sans une règle changée** : `EXT_disjoint_timer_query_webgl2`,
jamais `gl.finish()`, **témoin de validité ×16 fragments**, **40 rendus de chauffe
après CHAQUE recompilation**, ordre A/B tournant, 24 paires de 60 rendus,
`GPU_DISJOINT_EXT` vérifié à chaque requête. Les deux variantes vivent **dans la
même page** : la variante « sans » retire **la seule ligne de recollage** —
`rampTMonde` reste calculé, puisque le mélange `dedansCrop` en a besoin. **Ce que
le banc pèse est donc exactement un `mix`.**

| altitude | témoin ×16 fragments | AVEC | SANS | **différence APPARIÉE, médiane** | part |
|---|---|---|---|---|---|
| crop z13 (10,9 km, 158 tuiles) | **×6,89** | 0,3679 ± 0,0977 ms | 0,4774 ± 0,5586 ms | **+0,0004 ms** | +0,09 % |
| z10 (9,6 km, 890 tuiles) | **×5,49** | 1,5537 ± 0,0896 ms | 1,5214 ± 0,0539 ms | **+0,0206 ms** | +1,36 % |
| orbite 300 km (1 069 tuiles) | ×1,44 ⚠️ | 0,4820 ± 0,3025 ms | 0,4763 ± 0,1804 ms | −0,0036 ms | −0,76 % |

Reproduit sur un premier passage (témoin z10 **×7,37**) : **+0,0352 ms**, +2,03 %.

➡️ **Le surcoût est nul à la vue de crop et vaut +0,02 à +0,035 ms par image de
tuiles à z10, soit 1,4 à 2,0 % de la passe de tuiles — 0,12 à 0,21 % d'un budget
d'image de 16,7 ms.**

⚠️ **RÉSERVES, ET ELLES SONT DANS LE TABLEAU.**
- Le témoin à 300 km vaut **×1,44**, sous le seuil de crédibilité de R20
  (×16 fragments ⇒ ×8,2) : à cette altitude la passe n'est pas limitée par les
  fragments. **Cette ligne est un ordre de grandeur, pas une mesure.**
- Aucun des trois témoins n'atteint ×8,2. Les deux premiers (×6,89, ×5,49) sont
  du même ordre que ceux que R28 a acceptés (×6,58, ×7,09) ; le troisième non.
- ⚠️ **Et le +0,0206 ms de z10 dépasse de deux ordres de grandeur le coût ALU
  théorique de deux opérations** (≈0,07 µs pour un million de fragments sur ce
  pilote). Ce que le banc voit là est plus probablement un effet de
  recompilation ou de pression de registres que le mélange lui-même. **Dans les
  deux cas, c'est 0,2 % du budget d'image.**
- Un second passage lancé **pendant `npm test`** a rendu des témoins ×3,75 /
  ×1,85 / ×1,17 et des σ de 2,0 ms : il est cité pour mémoire et **n'est pas
  compté**.

---

## ⑤ CE QUE J'AI CRU PUIS RÉFUTÉ

**① « Il faut retrancher le sol du crop à l'altitude. »** ⛔ **Faux, et livré
faux pendant un tour de banc.** J'avais écrit `hauteurSurSolCrop(altitudeM,
echelle)` = `altitudeM − terreBas`, en m'appuyant sur `modes.altM` : 6 138 m aux
Pays-Bas contre 15 094 m à l'Everest, donc « l'Everest se croirait plus loin
parce que son sol est haut ». **Mais ce qui arrive à la loi n'est pas
`modes.altM`, c'est `altitudeCadrageM()`** — `altitudeSurfaceM({ camY,
extentMeters, … })`, une hauteur au-dessus de la SURFACE du bloc, la même
grandeur sur laquelle `seuil-socle.js` fait naître et mourir le crop. Retourné
depuis le poids posé : **9 316 m à La Réunion (sol 540 m) et 8 819 m à l'Everest
(sol 4 928 m)** — les deux à neuf kilomètres, quand leurs altitudes d'ellipsoïde
diffèrent de 4,2 km. La soustraction était donc **double**, et elle faisait
tomber le poids de 0,54 à **0,14** sur le seul lieu haut. **La fonction est
retirée, pas corrigée** ; ⑧c la tient.

**② « Compter les pixels à ΔE < 2 du premier texel du LUT mesure l'aplat. »**
⛔ **Faux, et l'instrument a rendu ZÉRO des deux côtés sur les quatre vues** —
exactement le piège que le brief nomme (« un banc différentiel ne distingue pas
"rien n'a changé" de "tout est cassé pareil" »). La table n'est pas la dernière
étape : l'éclairage, le peigne des crêtes, l'albédo et le voile passent après
elle, et **aucun pixel de l'écran ne porte le texel nu**. Le juge livré mesure
l'aplat par ce qu'il EST — une surface verte (`a* < −2`) et sa variation locale.

**③ « L'écart entre les deux régimes se mesure sur un balayage 0 → 4 000 m. »**
⛔ Trompeur. Il comparait des couleurs à 3 000 m au-dessus d'un crop dont la terre
plafonne à 324 m. Borné à `[max(0, uReliefBas) ; uLandMax]`, l'écart médian
change du tout au tout : à Bornéo il passe de **0** (le balayage large tombe dans
la zone où les deux régimes saturent ensemble à 1) à **36,2**. Le chiffre honnête
est le second.

**④ « Le premier relevé de `uRecollage` prouve que la loi vit. »** ⛔ Non : il
rendait la **même valeur à seize décimales** à trois altitudes différentes, et
zéro à l'Everest. `diag-r31-sonde.mjs` a montré que la méthode marche bien, mais
que l'entrée est `altitudeCadrageM()` — dérivée de la largeur du BLOC, qui est
toujours z13. **Un uniforme qui ne bouge pas quand son entrée bouge n'est pas
stable : il n'est pas réévalué — ou bien on regarde la mauvaise entrée.** C'était
le second cas, et c'est ce qui a mis à jour le ①.

**⑤ « La bande verte est un choix de palette. »** ⛔ **Pas entièrement, et R28
l'avait posée comme telle.** À La Réunion z13 la saturation couvrait **460 m de
la propre tranche du crop** — pas une couleur, un intervalle d'altitudes écrasé
sur un seul texel. C'est de la mécanique, pas du goût, et le recollage l'a
supprimée sans toucher à `#93a074`.

---

## ⑥ ⛔ CE QUE J'AI TROUVÉ EN PASSANT ET QUE JE NE CORRIGE PAS — ET C'EST UN VRAI DÉFAUT

`scripts/diag-r31-domaines.mjs` → `.banc/R31/domaines.json`.

**`uHeightPivot` et `uHeightContrast` sont GRADÉS sur le domaine du SOCLE
(`terrain.mapUniforms.uHeightRange`, l'amplitude du MNT chargé, qui suit le ZOOM
de la carte) et CONSOMMÉS sur le domaine du GLOBE (`[uReliefBas ; uLandMax]`, le
relief de l'emprise z13 du crop, qui NE suit PAS le zoom).**

`globe.js` affirme que la conversion est exacte, et cite « un écart de 0,0029 sur
le `hNorm` du niveau de la mer ». **Ce relevé a été fait à z12/z13, et il n'y est
vrai qu'à z12/z13.** Les deux domaines, mesurés au même instant :

| écart du `hNorm` du niveau de la mer, SOCLE vs GLOBE | z13 | z12 | z11 | z10 | z9 |
|---|---|---|---|---|---|
| La Réunion | **−0,007** | −0,181 | −0,545 | −0,778 | **−0,835** |
| Bornéo | −0,244 | +0,027 | −0,034 | +0,085 | −0,153 |
| Everest | **−0,002** | −0,314 | −0,964 | −1,261 | **−1,271** |

Conséquence visible, sur un bloc **identique** (le crop est toujours z13, ses
ancres n'ont pas bougé d'un octet entre z13 et z9) :

| La Réunion, crop [539,6 ; 3 052,3] m | z13 | z11 | z9 |
|---|---|---|---|
| pivot rendu, en mètres | 1 519 | 1 947 | **2 324** |
| fenêtre utile | 1 047 m | 866 m | **513 m** |

➡️ **Le même bloc porte trois échelles de couleur différentes selon le zoom de la
carte sous-jacente — 805 m d'écart de pivot sur un relief qui n'a pas changé.**
C'est, à la lettre, « il n'y a pas de lien entre le crop et la grande échelle ».

⛔ **Je ne le corrige pas ici, et je dis pourquoi** : la correction change le
BLOC — donc l'affiche — à tous les zooms sauf z13, elle touche `uHeightPivot`,
qui est un **réglage d'Adrien** (curseur « Ombrage », auto-gradation
`applyAutoShade`), et elle sort du recollage demandé. **C'est une tâche à part,
et elle est chiffrée ci-dessus.**

---

## ⑦ CE QUI RESTE DU RESSORT D'ADRIEN

⛔ **Je n'ai pas touché `#93a074`.** La butée basse de la palette, relue octet par
octet dans la table VIVANTE du gabarit d'ouverture, vaut aujourd'hui
`rgb(150, 168, 131)`. Après recollage, **il reste du vert au niveau de la mer** —
c'est le bas de sa rampe, et c'est son choix. Ce qui a disparu, c'est que ce vert
couvrait **jusqu'à 1 530 m d'altitude d'un seul aplat**.

Deux leviers restent à lui, tous deux chiffrés :
1. **la butée basse elle-même** — la changer déplacerait le littoral de TOUS ses
   gabarits enregistrés ;
2. **le désaccord de domaines du §⑥** — 805 m de pivot sur un bloc immobile.

---

## ⑧ AUTRES RÉSERVES

- ⚠️ **Le recollage sature à 32 768 m au-dessus de la surface du bloc.** La
  condition « avant la mort du crop » tient tant que le bloc reste sous
  `SEUIL_MORT_M` — la marge est de **7 575 m**, et `⑧b` la vérifie. Aucun bloc de
  10,4 km sur Terre n'a son point le plus bas au-dessus de ce niveau.
- ⚠️ **La butée de caméra plafonne l'altitude autour de 18 km tant qu'un crop
  vit** (`plan-fusion.md`, constat ①, revérifié : `diag-r28-fumee.mjs` relève
  `altM = 18 201 m`). Le poids n'atteint donc **1** qu'à la mort du crop
  elle-même ; à 18 km il vaut ≈ 0,88. **Le résidu de marche est ce qui reste entre
  0,88 et 1, non mesuré à l'écran** — la manœuvre demanderait de filmer une
  transition, pas un état.
- ⚠️ **Deux agents travaillent sur la caméra** (`wt-sor`, `wt-att`). Si la butée
  change, le poids maximal atteint change avec elle — **la loi, elle, ne bouge
  pas**, elle est bornée par les seuils de `seuil-socle.js`.
- ⚠️ **`mix` aux bornes.** `mix(x, y, 0.0)` vaut `x·1 + y·0` et rend `x` au bit
  près ; `mix(x, y, 1.0)` n'est pas garanti bit-à-bit égal à `y` selon
  l'écriture du pilote. L'écart possible est d'un ULP, invisible sur huit bits.
  **Je le dis plutôt que de l'écrire « au bit près » des deux côtés.**
- ⚠️ **Le poids est calibré en PLEINE QUALITÉ** (`ombres: dynamic`, `grain: true`,
  `pixelRatio: 1`, relevé dans chaque mesure). Il ne dépend d'aucune grandeur de
  rendu, donc un palier dégradé ne le change pas — mais ce n'est pas mesuré.
- ⚠️ **Bornéo z10 a rendu 466 103 verts sur un passage et 484 912 sur un autre
  (4 %)**, sur une scène immobile. C'est la classe du transitoire ~0,17 / 0,33
  déjà consignée (R21), cause non identifiée. **Les écarts de moins de 5 % sur
  cette vue ne décident de rien** — c'est pourquoi le verdict s'appuie sur
  « 10,3 % des verts ont bougé », qui est une mesure appariée.
- ⚠️ **Aucun sampler ajouté** : le compte reste à 12 sur 16.

---

## ⑨ LES INSTRUMENTS, POUR LA SUITE

| script | ce qu'il mesure |
|---|---|
| `scripts/diag-r31-ecart.mjs` | l'écart des DEUX régimes au même point du sol, ΔE CIE76, table relue octet par octet, borné à la tranche réelle du crop. Il lit `uRecollage` dans la page au lieu de le recalculer |
| `scripts/diag-r31-domaines.mjs` | les deux domaines de normalisation côte à côte — c'est lui qui a trouvé le §⑥ |
| `scripts/diag-r31-vues.mjs` | l'aplat vert à l'écran, A/B **apparié dans la même page** avec gel de `majEchelleRampe`, témoin nul obligatoire, pleine résolution |
| `scripts/diag-r31-cout.mjs` | la minuterie du pilote, témoin de validité, 40 chauffes, ordre tournant, différences appariées — une seule substitution, la ligne de recollage |
| `scripts/diag-r31-sonde.mjs` | **la porte** : l'uniforme est-il réévalué, et sur quelle entrée ? Il a réfuté ①. |

---

## ⑩ LES COMMITS

- `bdb63b4` — R31 étape 1 : les instruments, et l'écart chiffré à ΔE 18–63.
- `0702221` — R31 étape 2 : le recollage — la loi, l'uniforme, le nuanceur.
- `7507dd1` — R31 étape 3 : les tests, et trois tables factices complétées.
