# Tâche P8 — L'EXPOSITION DES PAROIS ET LA FRANGE EN MARCHES : deux demi-lignes manquantes

**Statut : LIVRÉE, ET AUCUN DES DEUX POSTES N'EST FERMÉ.** · Commits **`1051fe2`**,
**`64501f6`**, **`a0a600a`** sur `regroupement` (HEAD **`a0a600a`**, arbre propre après
commit).
`npm test` — **4 021 / 4 021** (4 014 au départ, **+7**) · `npm run audit:tests` — **209 / 209** ·
campagne de mutation — **37 / 37**, dont **25 visant le branchement** (67,6 %), **deux mutations
retirées comme NEUTRES plutôt que comptées**, et **une survivante qui a trouvé du CODE MORT**.

> **Le brief :** *« face sombre 26,63 contre 15,88 au socle — 1,68× trop claire »* ·
> *« contraste entre faces 2,008 contre 3,045 — 1,52× trop faible »* · *« LE VRAI ESCALIER,
> ET IL EST SUR LA FRANGE, PAS SUR LE FOND »*.

**Les deux causes sont nommées, mesurées, et prouvées EN LES BOUGEANT DES DEUX CÔTÉS. Et le
brief se trompe sur la seconde — je le dis d'entrée, parce que c'est ce qui a fait perdre puis
gagner du temps.**

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Tout est dans `.banc/P8/` — 59 captures, 17 relevés JSON, le harnais, les deux pilotes, la
campagne et les quinze scripts de page.** Cadre **1 280 × 800 = 1 024 000 px**, La Réunion z12,
`fov = 33`, vue isométrique 0, **socle RALLUMÉ DANS LA MÊME PAGE**, rendu **sans compositeur**
dans une cible **à profondeur**, **boucle rAF coupée**.

### ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE — et vérifiée au lieu d'être supposée

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255, **sans
exposition, sans ACES, sans transfert sRVB**. C'est le seul des trois looks que la notation-02
a calibrés sur le socle.

⚡ **ET LE RENDU DANS UNE CIBLE DÉSARME LA COURBE — MESURÉ, PAS LU.** `three`
(`WebGLPrograms.js:164`) n'arme la tonalité que si `currentRenderTarget === null`. J'ai poussé
`renderer.toneMapping` à `ACESFilmicToneMapping` en pleine mesure : **le socle rend 15,88 /
48,36 / 30,684, au centième, comme à `NoToneMapping`** (`S4-direct-P8.json`, U1). Sans ça, un
`MeshPhysicalMaterial` aurait été tonemappé et le `ShaderMaterial` du crop non — **une
treizième façon dont un banc ment, écartée par une mesure de trois lignes.**

### Le triptyque à regarder

- **`H1-zoom6-CROP-avant-P8.png` → `J4-zoom6-CROP-frange-APRES-P8.png` → `H2-zoom6-SOCLE-P8.png`**
  (×6, la même découpe, la même seconde). AVANT : le long de la côte, une bande pâle LARGE dont
  le bord extérieur est **un escalier de dents à arêtes verticales et à 45°**. APRÈS : une frange
  qui épouse la côte, à bord doux. SOCLE : un liseré cyan étroit et continu.
- **`K5-zoom-CROP-arete-FINAL-P8.png` ↔ `K6-zoom-SOCLE-arete-FINAL-P8.png`** — les parois
  terracotta, face sombre contre face sombre.
- **`G2-zoom6-CROP-sans-nappe-P8.png`** — **le fond marin du crop, nappe éteinte : PARFAITEMENT
  LISSE, aucune dent.** C'est cette image qui a retourné toute l'enquête.
- **`J3-zoom6-CROP-repli-neutralise-P8.png`** — le correctif neutralisé : **les dents
  reviennent, aux mêmes endroits.**

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, sur MES deux cadrages :

1. ⛔ **LA FACE SOMBRE DE LA PAROI RESTE 1,125 FOIS TROP CLAIRE ET LE CONTRASTE 1,22 FOIS TROP
   FAIBLE.** J'ai fermé **82 %** du premier écart et **46 %** du second ; **le reste a une
   cause nommée et mesurée (§2.4), et je ne l'ai pas fermée.**
2. ⛔ **LA FRANGE N'EST PAS CELLE DU SOCLE.** Le glacis clair du crop occupe **9,74 %** de sa
   mer contre **8,24 %** au socle, et son bord reste plus mou que le fil du socle. **Ce qui a
   disparu, c'est la PÉRIODICITÉ ; la largeur, non.**
3. ⛔ **LE RELIEF DU CROP RESTE BRUN-ROSÉ ET LISSE là où le socle est olive et ravineux** —
   manque n° 5, autre tâche. Visible d'un coup d'œil sur `K5` contre `K6`.
4. ⛔ **LA MER DU CROP N'A TOUJOURS AUCUN BLEU PROFOND** — manque n° 2, autre tâche. Sur
   l'intersection des deux masques : secteur 210–240°, **242 pixels** pour le crop contre
   **11 310** pour le socle.
5. ⛔ **LES DEUX LAMES DE RIDEAU DE P7 SONT TOUJOURS LÀ**, visibles en bas à gauche de
   `K5-zoom-CROP-arete-FINAL-P8.png`. Ce n'était pas ma tâche ; je confirme qu'elles n'ont pas
   bougé.
6. ⚠️ **Je n'ai rien mesuré EN MOUVEMENT** (§8, réserve n° 5).

---

## 1. LA CALIBRATION — ET C'EST ELLE QUI AUTORISE TOUT LE RESTE

⚠️ **LE SCRIPT DU NOTEUR N'EST PAS SUR LE DISQUE**, seulement ses résultats
(`D-parois-N02.json`). J'ai donc **réécrit sa convention de percentiles**, explicitement
(luminance Rec. 709 sur l'octet linéaire, percentiles sur la liste triée sans interpolation,
`contraste = p80 / p20`), **et je l'ai confrontée à ses chiffres du SOCLE avant de juger quoi
que ce soit** — le socle n'a pas bougé, c'est l'étalon. C'est le geste de P7, qui a validé sa
convention de jupes sur les 2 186 px / 12 langues du noteur.

| | le noteur | moi | écart |
|---|---|---|---|
| socle p10 / p20 / p50 | 15,88 / 15,88 / 15,88 | **15,88 / 15,88 / 15,88** | **0,000 %** |
| socle p80 / p90 | 48,36 / 48,36 | **48,36 / 48,36** | **0,000 %** |
| socle contraste | 3,0453 | **3,0453** | **0,000 %** |
| crop p10 / p20 / p50 | 25,21 / 26,63 / 29,84 | **25,21 / 26,63 / 29,84** | **0,000 %** |
| crop p80 / contraste | 53,47 / 2,0079 | **53,47 / 2,0079** | **0,000 %** |

➡️ **Ma convention EST la sienne, des deux côtés, au centième.** (`S1-parois-P8.json`.)

---

## 2. LE MANQUE N° 3 — LA PAROI DU CROP EMPRUNTAIT L'AMBIANTE DU RELIEF

### 2.1 ⛔ LA CAUSE TIENT DANS UNE MOITIÉ DE LIGNE DE `three` QUE P3 AVAIT DÉJÀ CITÉE

`sonde-ambiante.js` porte depuis P3 :

```js
if ( material.isMeshStandardMaterial && material.envMap === null
     && scene.environment !== null )
    m_uniforms.envMapIntensity.value = scene.environmentIntensity;
```

et en tire, **à raison**, qu'`envMapIntensity` est du code MORT sur le relief
(`terrain.material.envMap === null`, relevé). ⚡ **L'AUTRE MOITIÉ N'AVAIT JAMAIS ÉTÉ TIRÉE :
LA PAROI DU SOCLE, ELLE, A SON PROPRE `envMap`.** `plinth.setEnvMap` l'annonce en toutes
lettres — *« give the socle walls their own studio env map (overrides scene.environment for
this material only… while the terrain keeps the neutral room env) »* — et `main.js` lui pose
`makeSocleEnvMap(renderer)`, **une pièce SOMBRE** (fond `0x15171d`, sol noir) à
`envMapIntensity = 1`.

**Relevé dans la page vivante** (`S1`, `S3`) : `params.plinthPbr = 'terracotta'`,
`wallMat.envMap.uuid = 40858be0…` **≠** `scene.environment.uuid = 36ad4238…`,
`wallMat.envMapIntensity = 1` contre `scene.environmentIntensity = 0,395`.

**Les deux ambiantes, sondées par la sonde DU DÉPÔT, au même instant** — irradiance versée à
plat sur un mur VERTICAL (`ndu = 0`, donc la moyenne des deux) :

| | R | V | B |
|---|---|---|---|
| relief (`scene.environment` × 0,395) | **1,5265** | 1,5265 | 1,5265 |
| paroi (`wallMat.envMap` × 1) | **0,9892** | 0,9467 | 0,9311 |
| ⛔ rapport | **1,543** | 1,612 | 1,639 |

**La paroi du crop prenait la première.**

### 2.2 ⚡ PROUVÉ EN LE BOUGEANT DES DEUX CÔTÉS, ALLER-RETOUR EXACT CHAQUE FOIS

*(une concordance au défaut n'est pas un branchement — la leçon de P6)*

| témoin | face sombre | contraste | retour |
|---|---|---|---|
| départ, **SOCLE** | 15,88 | 3,0453 | — |
| ⚡ **on retire son studio à la paroi DU SOCLE** (elle retombe sur `scene.environment`, la source du crop) | **38,11** | **1,4051** | **exact** |
| départ, **CROP** | 26,63 | 2,0079 | — |
| ⚡ **on donne l'ambiante DE LA PAROI au crop** | **17,87** | **2,4902** | **exact** |
| témoin aberrant : `uParoiCielIrr = (20, 0, 0)` | 54,21, moyRGB R **254,68** | — | **exact** |
| témoin croisé : on bouge `uCielIrr` (les TUILES) | **17,87 — la paroi ne bouge pas** | — | **exact** |

➡️ **Le socle privé de son studio dépasse le crop ; le crop rendu à son studio rejoint le
socle. La cause est nommée dans les deux sens.** (`S3-ambiante-P8.json`.)

### 2.3 ⚡ ET SUR LE MÊME MAILLAGE, LA LOI DU CROP EST EXACTE À +1 % SUR LA FACE CLAIRE

**L'expérience qui exclut la géométrie et le repère** : on pose un CLONE du matériau vivant du
crop — **donc le MÊME texte de nuanceur** — sur la paroi **DU SOCLE**, dans la scène du socle,
avec la même caméra (`S2`, `S4`).

| sur la paroi DU SOCLE | face sombre | face claire | contraste |
|---|---|---|---|
| matériau du socle (`MeshPhysicalMaterial`) | **15,88** | **48,36** | 3,0453 |
| loi du crop + ambiante **du relief** (l'état d'avant) | **30,76** | 58,24 | 1,8934 |
| ⚡ loi du crop + ambiante **de la paroi** | **20,65** | **48,84** | 2,3651 |

➡️ **La face CLAIRE tombe à +1,0 % du socle.** Et la décomposition terme à terme, sur ce même
maillage :

| | loi du crop | socle |
|---|---|---|
| direct seul (Lambert) | **28,19** | **28,19** *(spéculaire coupé)* |
| direct seul, tel quel | 28,19 | **30,40** |
| ambiante seule, face sombre | 20,65 | 15,88 |

⚡ **LE TERME DIRECT DU CROP EST EXACT AU CENTIÈME** : 28,19 des deux côtés. Les **2,21** que le
socle a en plus sont le **spéculaire diélectrique** de `MeshPhysicalMaterial` — mesuré en le
coupant (`specularIntensity = 0` fait tomber le socle de 15,88 / 48,36 à **14,88 / 44,29**,
aller-retour exact).

### 2.4 ⛔ CE QUI RESTE, ET JE NE L'AI PAS FERMÉ

**Après le correctif, dans la source** (`S15`) :

| cadrage | face sombre crop / socle | rapport | *avant* | contraste crop / socle | rapport | *avant* |
|---|---|---|---|---|---|---|
| **intérieur** (celui du noteur), apparié à **+0,0537 %** | **17,87 / 15,88** | **1,1253** | *1,6769* | **2,4902 / 3,0453** | **1,2229** | *1,5166* |
| **côte**, apparié à **−0,1437 %** | 18,80 / 15,88 | 1,1839 | — | 2,4388 / 3,0453 | 1,2487 | — |

➡️ **82 % de l'écart d'exposition fermé, 46 % de l'écart de contraste.** Et voici **la cause du
reste, mesurée et non devinée** :

- ⛔ **LE STUDIO DE LA PAROI EST DIRECTIONNEL EN AZIMUT, ET `mix(sol, ciel, 0.5·ndu+0.5)` NE
  SAIT PAS LE DIRE.** La loi portée est du **premier ordre en `N·haut` SEULEMENT**. Or, sur le
  socle, l'environnement seul (lampes coupées) rend **12,32 sur la face sombre et 14,61 sur la
  face claire** — deux azimuts, deux valeurs. Le modèle, lui, rend **la même valeur aux deux**,
  et cette valeur est **~28 % trop haute** parce que la sonde moyenne les azimuts que sa bille
  lui montre. **Fermer ce poste demande une base du premier ordre COMPLÈTE (quatre `vec3` au
  lieu de deux), donc une sonde à deux rendus et un repère est/nord dans le nuanceur des
  parois. Je ne l'ai pas fait, et ce n'est pas une décision de confort : c'est un changement
  qui touche aussi l'ambiante des TUILES.**
- ⚠️ **LE SPÉCULAIRE DIÉLECTRIQUE** vaut **7,3 %** du terme direct et **6,3 %** de la face
  sombre. Non porté.

---

## 3. ⛔ LE MANQUE N° 4 — ET LE BRIEF SE TROMPE SUR LA CAUSE

Le brief, citant le noteur : *« Sa piste, à vérifier avant de coder : porter la frange par
`uCoastMask` (résolution du MNT) plutôt que par le champ. »* Et le noteur : *« C'est LA
RÉSOLUTION DU CHAMP. »*

**⛔ CE N'EST NI L'UN NI L'AUTRE. Six expériences, chacune à aller-retour, dans la même page.**

| expérience | ce qu'elle devait montrer | ce qu'elle a montré |
|---|---|---|
| ⚡ **nappe éteinte** | le fond marin porte les dents | **AUCUNE DENT — le fond du crop est parfaitement lisse** (`G2`) |
| `uFondOn = 0` | le champ du fond les porte | plateaux 2,145 → 2,077 : **rien** |
| champ du fond en **NEAREST** | le filtrage les durcit | 2,145 → 2,081 : **rien** |
| masque de côte éteint | le masque les porte | 2,145 → 2,125 : **rien** |
| masque de côte en **LINÉAIRE** | idem | **0 changement** |
| ⚡ **`vProfondeur` ET `vFonduRive` recalculés PAR FRAGMENT** | l'interpolation par sommet les porte | **LES MÊMES DENTS, AUX MÊMES ENDROITS** (`F1` contre `F3`) |

➡️ **Les dents naissent de la NAPPE, et pas de son maillage.** ⚠️ **J'ai gardé une heure sur
l'hypothèse « interpolation par sommet » parce qu'elle collait à la période mesurée (11 px
contre 8,11 px de pas de calotte, soit 11,5 px sur une ligne d'écran horizontale à 45°). Elle
est FAUSSE, et c'est l'A/B par fragment qui l'a dit. Je la retire.**

### 3.1 ⚡ CE QUI MANQUE EST UNE DEMI-LIGNE D'`ocean.js`

```glsl
// real bathymetry when the tiles carry it; distance-to-shore as the
// stand-in where the sea floor is a flat 0 m plain (fine zooms)
float depth = max(uWaterY - f.r, f.g * 1.6);
```

La calotte du crop écrivait `vProfondeur = max(-champ.r, 0.0)` — **la bathymétrie SEULE, sans
le secours**. Or son champ n'en porte presque pas.

⚡ **MESURÉ SUR LE CHAMP VIVANT** (`S13-donnee-P8.json`) : le tableau fait 385 nœuds, soit
**128 par largeur de bloc** — mais **l'autocorrélation de sa DÉRIVÉE SECONDE pique à 3 nœuds**
(force 0,261), et **25,8 %** des nœuds d'eau ont une dérivée seconde négligeable. **La donnée
vraie est trois fois plus grossière que la grille : ~43 échantillons en travers de 10,4 km, un
tous les 240 m.** Le commentaire de `CHAMP_FOND` l'annonçait déjà (« la bathymétrie plafonne à
`BATHY_BASE_ZMAX = 8` — soit 48 pixels de donnée vraie en travers »). **Le glacis de lagon, qui
vit sur les 15 % premiers du budget de profondeur, était donc peint sur un plateau à paliers.**

### 3.2 ⚠️ ET J'ÉTENDS LE REPLI PLUS LOIN QU'`ocean.js` — C'EST UN ÉCART, JE LE DIS

`ocean.js` réserve `depth` à l'ALPHA et garde la bathymétrie SEULE pour le corps de l'eau, avec
un avertissement : *« profondeur reelle (bathymetrie seule - pas le proxy distance-au-rivage,
c'etait lui le halo) »*. **Quatre variantes mesurées, même page, même seconde** (`S12`) :

| | glacis clair | force périodique |
|---|---|---|
| départ | 11,71 % | 0,2195 |
| **V4 — le repli sur l'ALPHA seule** *(la lettre d'`ocean.js`)* | **11,72 %** | **0,2395** |
| V5 — le repli sur le GLACIS seul | 9,69 % | 0,048 |
| ⚡ **V6 — sur les deux** | **9,68 %** | **0,021** |
| V7 — témoin : le préambule seul, aucune substitution | 11,71 % | 0,2542 |
| **SOCLE** | **7,97 %** | **aucun pic** |

➡️ ⛔ **LES DENTS VIVENT DANS LE GLACIS, PAS DANS L'ALPHA.** La lettre d'`ocean.js`, appliquée
seule, **ne déplace rien**. Le socle peut s'en passer parce que son champ couvre le bloc à
**384 texels** (relevé) là où celui du crop en met **128 sur trois largeurs de bloc**.
**Le halo qu'`ocean.js` redoute reste un risque DÉCLARÉ : il ne s'est pas montré à mes deux
cadrages, et je ne l'ai pas cherché ailleurs.**

### 3.3 APRÈS, DANS LA SOURCE — et le témoin est EXACT

**Neutraliseur MINIMAL** : `vProfondeurEau = vProfondeur` dans le nuanceur de sommet, une
ligne, rien d'autre (`S15`).

| sur la mer du crop, cadrage côte, apparié à **−0,1437 %** | avec le repli | **sans** | socle |
|---|---|---|---|
| glacis clair | **9,74 %** | 11,74 % | **8,24 %** |
| force périodique de `\|d²L\|` | **−0,0237** | **0,2155** | **aucun pic** |
| **aller-retour** | — | **0 canal sur 4 096 000** | — |

⛔ **ET LE PRIX, MESURÉ AVEC LE MÊME TÉMOIN, SUR L'INTERSECTION DES DEUX MASQUES DE MER**
(75 079 px) :

| | avec le repli | sans | socle |
|---|---|---|---|
| ⚠️ énergie de détail | **1,881** | 2,045 | **3,384** |
| ⚠️ écart-type de luminance | **33,789** | 40,967 | **38,206** |
| ⚡ luminance moyenne | **81,516** | 85,172 | **59,535** |
| bleu profond (210–240°) | 242 | 242 | **11 310** |

➡️ **Le repli coûte 8,0 % de l'énergie de détail de la mer et 17,5 % de son écart-type de
luminance — c'est une petite RÉGRESSION sur le manque n° 2, qui n'est pas ma tâche, et je la
déclare.** En échange, l'excès de clarté de la mer tombe de **+43,1 % à +36,9 %**. **Je ne
prétends pas que le solde est positif sur le manque n° 2 ; je dis ce qu'il coûte et ce qu'il
rend.**

---

## 4. ⛔ CE QUE JE N'AI PAS PRIS, ET JE LE DIS FRANCHEMENT

**LE CHANFREIN D'ARÊTE HAUTE ET LE CONGÉ BAS NE SONT PAS PORTÉS.** Le brief l'autorisait *« QUE
si l'exposition est fermée et que tu as le temps »*. ⛔ **L'exposition n'est pas fermée** (§2.4 :
1,125× et 1,22× restants, cause nommée mais non traitée), **et je n'ai pas le temps.** Le
liseré lumineux d'arête basse du socle est visible sur `K6-zoom-SOCLE-arete-FINAL-P8.png` ; sur
`K5`, l'arête du crop reste vive. **Les 50 vignettes de matière restent orphelines elles aussi.**

---

## 5. LES TESTS ET LA CAMPAGNE DE MUTATION

**+7 tests** : `test/crop-eclairage.test.js` ⑦a/⑦b/⑦c (3, l'ambiante de paroi),
`test/ecume-mer.test.js` ⑦a/⑦b/⑦c/⑦d (4, le repli et son branchement dans les deux nuanceurs).
**Et cinq tests EXISTANTS resserrés** — ⑥a (l'identité des uniformes de paroi), ④c et ④j
(`contexteCrop` lit le MATÉRIAU, et les 29 champs surveillés lisent une source vivante), ④d
(l'aller-retour prend désormais les deux uniformes de paroi), ⑨h de `crop-habillage`.

Ce qu'ils gardent, et **pourquoi les précédents ne le gardaient pas** :

- ⑥a exigeait `m.uniforms.uCielIrr === g.uniforms.uCielIrr`. **C'était l'assertion qui
  VERROUILLAIT LE DÉFAUT** : elle rendait vert exactement l'état que le noteur mesurait à 1,68×.
  Elle exige désormais l'inverse, **et le contraire** (`notEqual` sur les uniformes des tuiles).
- ④c interdisait `envMapIntensity` dans `contexteCrop`. **Vrai pour le relief, faux pour la
  paroi.** L'interdiction est resserrée sur `ambianteIntensite` seule, et la ligne de la paroi
  est désormais exigée.
- ⑦d de `ecume-mer` garde **ce qui ne DOIT PAS lire le repli** autant que ce qui doit : la
  terre (`discard`), le déclin côtier et le critère de déferlement. **Trois mutations tuées par
  ces trois assertions-là.**

### La campagne — `.banc/P8/mutations-P8.mjs`, worktree `C:/Dev/wt-p8-mut`, **retiré en partant**

`node_modules` en **jonction** ; **`git ls-files --eol` vérifié `i/lf w/lf`** sur les **neuf**
fichiers en jeu — aucun faux survivant possible.

**37 mutations sémantiques, dont 25 visant le BRANCHEMENT (67,6 %).**

- **Premier tour : 34 / 37**, trois survivantes.
- ⛔ **DEUX ONT ÉTÉ RETIRÉES COMME NEUTRES PLUTÔT QUE COMPTÉES**, et c'est écrit dans le fichier :
  - **5c** — le défaut MONDE de `uParoiCielIrr` remplacé par un littéral `(0, 0, 0)`.
    `ECLAIRAGE_MONDE.cielIrr` **VAUT** `[0, 0, 0]` : la mutation change la SOURCE du défaut sans
    changer une valeur. **La compter aurait fait croire à un trou de test.** Remplacée par une
    qui mord — on RETIRE l'uniforme —, et ⑥a exige désormais qu'il EXISTE.
  - **6c** — la borne `Math.max(0, distance)` de `profondeurEau`. ⚡ **LA SURVIVANTE AVAIT
    RAISON, ET ELLE A TROUVÉ DU CODE MORT** : `p` est déjà borné à zéro et `unite > 0`, donc une
    distance négative rend un produit négatif que le `Math.max` **extérieur** écarte de toute
    façon. `ocean.js` n'en a pas non plus (`f.g * 1.6`, nu). **Retirée de la source** — du JS et
    du GLSL —, pas gardée pour rassurer. **Le neuvième code mort de ce chantier trouvé par une
    survivante.** Remplacée par la borne qui, elle, mord : celle sur la PROFONDEUR.
- ⛔ **UNE SEULE VRAIE SURVIVANTE, ET C'ÉTAIT UN TROU** : **4f**, `retirerHabillage` qui oublie
  de rendre `uParoiCielIrr`. Le ④d de `crop-eclairage` ne prenait pas les deux uniformes de
  paroi dans son aller-retour. Il les prend.
- **Second tour : 37 / 37, aucune survivante, aucune non appliquée.**
  `.banc/P8/resultat-mutations-P8.json`.
- **Chaque mutation est remise sur le disque, les tests rejoués pour confirmer l'échec, puis le
  fichier restauré** ; `git diff --stat` du worktree vérifié **vide** avant retrait.

---

## 6. CLÔTURE

- `npm test` — **4 021 / 4 021** (4 014 au départ, **+7**).
- `npm run audit:tests` — **209 / 209**, aucun écart.
- `node --check` — vert sur les neuf fichiers touchés.
- **CRLF, SUR TOUTE LA PLAGE DE MES COMMITS** — `git diff --stat 6373339..HEAD` et
  `git diff --ignore-cr-at-eol --stat 6373339..HEAD` rendent **exactement le même compte** :
  **548 insertions, 11 suppressions, 9 fichiers**.
- **Arbre propre après commit**, **worktree de mutation retiré** (`git worktree list` ne le
  porte plus, le dossier n'existe plus, la jonction non plus).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terrain.mesh.visible = true`, plinthe visible, `real-water` visible avec ses **deux**
  maillages, **aucune mer ni paroi de crop**, `_baseYCrop = null`, **946 tuiles dont 740
  portent leur jupe**, 30 programmes, **zéro erreur grave** (recherche
  `shader|GLSL|program|Uncaught|TypeError|ReferenceError`).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : `terreUnique = true`, terrain et plinthe
  cachés, mer et parois du crop bâties, `_baseYCrop = −0,120 084 8`, 175 tuiles, 26 programmes,
  **0 erreur, 0 grave**.
- **Appariement du bloc entier**, balayé sur un **CLONE** de la caméra du socle, dans la même
  exécution JS que la mesure : cadrage intérieur **+0,053 7 %**, cadrage côte **−0,143 7 %** —
  soit **19 fois** et **7 fois** mieux que le 1 % demandé. **Deux mesures du même `k` rendent le
  même compte au pixel** (212 586 puis 212 586 ; 215 487 puis 215 487).
- ⚡ **PLANCHER DE BRUIT MESURÉ : 0 canal sur 4 096 000** après vingt rendus intercalés, et
  `uMerTemps` identique au dernier chiffre. Témoin nul : **0 canal**.

---

## 7. ⚡ LA TREIZIÈME FAÇON DONT UN BANC MENT, ET CELLE QUE J'AI ÉVITÉE DE JUSTESSE

**`P4.geler()` ne remplace que `requestAnimationFrame`.** Or `tick()` (`main.js`) se réarme
ainsi :

```js
if (document.hidden) tickTimer = setTimeout(tick, 40)
else rafId = requestAnimationFrame(tick)
```

➡️ ⛔ **DANS UN ONGLET CACHÉ, `geler()` NE GÈLE RIEN.** Mon pilote rend la page VISIBLE
(`document.visibilityState = 'visible'`, relevé), donc le gel mord — **et je l'ai vérifié au
lieu de le supposer** : `uMerTemps` ne bouge pas d'un chiffre entre le début et la fin d'une
série, et le plancher de bruit vaut 0. **Un agent qui piloterait un onglet caché mesurerait la
houle en croyant mesurer son correctif.** (`.banc/P8/NOTE-VOLET.txt`.)

---

## 8. MES RÉSERVES

1. ⛔ **AUCUN DES DEUX POSTES N'EST FERMÉ, ET LE PREMIER A UNE CAUSE NOMMÉE QUE JE N'AI PAS
   TRAITÉE.** Face sombre **1,125×** (contre 1,677 avant), contraste **1,22×** trop faible
   (contre 1,517). Le reste est **la directionnalité en AZIMUT du studio de la paroi** —
   mesurée : l'environnement seul rend **12,32** sur une face et **14,61** sur l'autre, quand le
   modèle du premier ordre en `N·haut` leur donne la même valeur, ~28 % trop haute. **Fermer
   demande une base du premier ordre complète**, donc une sonde à deux rendus et un repère
   est/nord dans le nuanceur — **et ça touche aussi l'ambiante des tuiles.**
2. ⛔ **J'AI ÉTENDU LE REPLI PLUS LOIN QU'`ocean.js`, CONTRE SON PROPRE AVERTISSEMENT.** Il
   réserve le proxy à l'alpha (« c'etait lui le halo ») ; je le pose aussi sur le glacis, parce
   que **posé sur la seule alpha il ne déplace rien** (11,72 % contre 11,71 %). **Le halo n'est
   pas apparu à mes deux cadrages ; je ne l'ai pas cherché ailleurs, et un crop sur un plateau
   continental peu profond est exactement le cas où il pourrait sortir.**
3. ⛔ **LE REPLI COÛTE 8,0 % DE L'ÉNERGIE DE DÉTAIL DE LA MER ET 17,5 % DE SON ÉCART-TYPE DE
   LUMINANCE.** C'est une régression sur le manque n° 2, qui n'est pas ma tâche. Mesurée avec le
   témoin exact, aller-retour à 0 canal. **En échange l'excès de clarté tombe de +43,1 % à
   +36,9 %. Je ne défends pas un solde, je publie les deux.**
4. ⚠️ **UNE HYPOTHÈSE RETIRÉE, ET ELLE M'A COÛTÉ UNE HEURE.** « Les dents viennent de
   l'interpolation par sommet sur la calotte » collait à la période mesurée (11 px contre
   11,5 px attendus). **L'A/B par fragment l'a réfutée : mêmes dents, mêmes endroits.** Retirée.
5. ⚠️ **DEUX CHIFFRES RETIRÉS.**
   - `S7` publiait une mesure « par fragment » qui était en fait celle de la **nappe éteinte** :
     sa rustine ne compilait pas (`uMerPortee : redefinition`). Le relevé fautif reste sur le
     disque (`S7-nappe-P8.json`) plutôt que d'être effacé, et **`S8` puis `S12` le remplacent
     avec un témoin de compilation** (on recompte les pixels de nappe).
   - `S6` publiait un « pas d'écran » calculé sur `uCropDemi`, qui est en coordonnées de TUILE
     et non en unités de scène — il rendait **1,6 px de largeur de bloc** pour un bloc qui en
     fait **519**. Retiré, remplacé par la largeur MESURÉE sur la boîte du masque.
6. ⚠️ **UN ALLER-RETOUR INEXACT, DÉCLARÉ.** Mes scripts de diagnostic qui remplaçaient un
   `varying` par un global dans le nuanceur de FRAGMENT rendaient **10 451 à 32 171 canaux**
   d'écart au retour, au lieu de zéro. **Je n'en connais pas la cause.** Le neutraliseur MINIMAL
   (une ligne du nuanceur de sommet) rend **0 canal**, et **tous les verdicts publiés au §3.3
   reposent sur celui-là**, pas sur les rustines.
7. ⚠️ **JE N'AI PAS MESURÉ LA DENSITÉ DE DONNÉE VRAIE DU CHAMP DU SOCLE.** `terrain.sample` est
   une fonction, sa grille n'est pas exposée. Mon « le socle peut s'en passer » repose sur ce
   que j'ai relevé — **son `uField` couvre le bloc à 384 texels contre 128 sur trois largeurs
   pour le crop** — **et pas sur sa densité de bathymétrie, que je n'ai pas mesurée.**
8. ⚠️ **UN SEUL LIEU, DEUX CADRAGES.** Tout est sur La Réunion z12, aux deux endroits de
   notation-01/02. **Un crop continental (pas de mer, donc pas de frange) ne prend le chemin que
   par test, pas à l'écran.** Un crop de haute latitude non plus.
9. ⚠️ **TOUT EST AU REPOS, BOUCLE GELÉE.** Aucune donnée sur le battement de la frange en
   mouvement, ni sur la paroi quand le soleil tourne.
10. ⚠️ **LE COÛT N'EST PAS CHRONOMÉTRÉ.** Le repli ajoute **un varying** et un `max` par sommet
    de calotte (37 249 sommets) ; l'ambiante de paroi ajoute **une sonde de plus par texture**
    (64 × 64, deux rendus, mise en cache par `WeakMap`) et **deux uniformes**. **Je n'ai
    chronométré ni l'un ni l'autre.** Je préfère le dire que d'annoncer « négligeable ».
11. ⛔ **CE BANC N'EST PAS LA PAGE QU'ADRIEN REGARDE** — Chrome piloté, autre profil (§7).

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/P8/` — **59 captures PNG**, **17 relevés JSON**, `harnais-P8.mjs` (il **IMPORTE**
`../P7/harnais-P7.mjs` → N02 → P5 → P4 → P3, il ne les recopie pas ; il n'écrit que le profil
de percentiles, les plateaux, la période et les marches), `pilote-P8.mjs`, `pilote-bas-P8.mjs`,
`recois-P8.mjs` (port 5611), `mutations-P8.mjs`, `resultat-mutations-P8.json`,
`NOTE-VOLET.txt`, et les quinze scripts de page `s1` à `s15`.

**Les paires à regarder d'abord :**

- `H1-zoom6-CROP-avant-P8.png` ↔ `J4-zoom6-CROP-frange-APRES-P8.png` ↔ `H2-zoom6-SOCLE-P8.png`
  — **l'escalier, sa disparition, et le socle à côté**
- `J3-zoom6-CROP-repli-neutralise-P8.png` — **le témoin : les dents reviennent**
- `G2-zoom6-CROP-sans-nappe-P8.png` — **le fond marin seul, lisse : l'image qui a retourné
  l'enquête**
- `F1-zoom6-CROP-frange-P8.png` ↔ `F3-zoom6-CROP-frange-PARFRAGMENT-P8.png` — **l'A/B qui a
  RÉFUTÉ l'hypothèse du maillage : mêmes dents, mêmes endroits**
- `K5-zoom-CROP-arete-FINAL-P8.png` ↔ `K6-zoom-SOCLE-arete-FINAL-P8.png` — **les parois, et le
  chanfrein du socle que le crop n'a toujours pas**
- `K1-CROP-FINAL-P8.png` ↔ `K2-SOCLE-apparie-FINAL-P8.png` — **les deux blocs entiers**
- `C1-CROP-cote-P8.png` ↔ `I7-CROP-cote-V6-P8.png` — **le bloc entier, avant et après, même
  cadrage**
