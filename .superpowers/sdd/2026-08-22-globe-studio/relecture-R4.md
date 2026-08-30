# Relecture R4 — LA POSE DE CAMÉRA NE SAUTE PLUS

**Conformité au brief : ❌ partielle, et assumée.**
**Qualité : à corriger** — le code tient, le RAPPORT porte un chiffre faux qui
rassure à tort le donneur d'ordre, et neuf mutations survivent à 4 202 tests.

Arbre `C:\Dev\wt-merge`, branche `regroupement`, base `d366a40`, commits
`9af9b4f` + `6876607`. `npm test` : **4 202 tests, 0 échec** (rejoué).
`npm run audit:tests` : **216 listés · 216 sur disque · aucun écart** (rejoué).
`test/zoom-continu.test.js` figure bien dans la liste explicite de `package.json`
(il y était déjà : aucun fichier de test neuf n'a été ajouté).
Le paquet `paquet-R4.diff` correspond au dépôt au caractère près (stat rejoué).

---

## 0. LES TROIS RÉFUTATIONS — UNE LIGNE CHACUNE

- **① « le saut de pose est à la naissance du crop » → SA RÉFUTATION TIENT.**
  Vérifiée sur la trace : `avant-max.json`, images 2089 → 2090, `uCropOn` 0 → 1 à
  `alt = 32 270 m`, inclinaison **54,0466° → 54,0466°**, identiques à quatre
  décimales.
- **② « une surcouche sombre assombrit le DOM » → SA RÉFUTATION TIENT, et elle
  tient plus solidement qu'il ne le dit.** Rejouée avec mon propre code et mes
  propres zones ; j'ai en plus une preuve qu'il n'a pas utilisée. **Le défaut que
  tu as affirmé à Adrien comme un fait n'existe pas.**
- **③ « fondre la géométrie du bloc ne rachète rien » → SA RÉFUTATION TIENT POUR
  LES PAROIS, et pour elles seules.** Le retrait du 43 % est complet et propre ;
  mais le même banc a mesuré **le fond du crop à 49,08, soit 5,5 fois le plancher
  de bruit**, et le fond est de la géométrie lui aussi. La conclusion large
  « la géométrie n'a rien à racheter » n'est pas établie.

---

## 1. CE QUE J'AI VÉRIFIÉ, ET COMMENT

### 1.1 Les traces existent, et tous les chiffres de tête en sortent

`.banc/` est gitignoré ; les traces y sont bien, et je les ai lues :
`avant-max.json` (3 072 images), `apres-max.json` (2 984), `apres-prod.json`
(1 671), `img-avant-max/` et `img-apres-max/` (61 captures chacun),
`claquement/` (6 PNG + 6 `.raw`). **Aucun chiffre du rapport n'est sans source
consultable.** Recalculs, tous concordants :

| chiffre annoncé | recalculé par moi | source |
|---|---|---|
| plongée : 46,548° en 1 image, image 346, 5 977 km | **46,5482°, idx 346, altM 5 976 652** | `avant-max.json` |
| 11 sauts > 1° avant | **11** | idem |
| crop : 54,047° → 54,047° | **54,0466° → 54,0466°** | idem, idx 2089/2090 |
| dérive 19,5°, 34,52° → 54,05° | **19,524°, 34,522° → 54,047°** | idem |
| 4,12° sur une image de 118 ms | **4,1188°, dt = 118 ms, idx 278** | `apres-max.json` |
| 13 sauts > 1° après | **13** | idem |
| **0,0215° après le balayage** | **0,021455°** (pas 304 → 305) | idem |
| plage 46,527° → 46,548° | **46,5267° → 46,548158°** | idem |
| balayage 43 images / 1 592 ms | **44 images / 1 608 ms** (idx 261 → 305) | idem |
| plafond `dt` écrêté : 4,23° | **4,232°** = 84,6 °/s × 0,05 s | calcul |
| plancher de bruit 8,97 / 44,0 % | **8,97 / 44,0 %** | `claquement/*.raw` |
| sans parois 9,59 / 46,4 % | **9,59 / 46,4 %** | idem |
| planète nue 55,96 / 89,8 % | **55,96 / 89,8 %** | idem |
| le test de branchement échoue à −8,329° sur le code d'avant | **−8,329°** | rejoué |

⚠️ **Sur le `0,0215°`** : il n'est pas dans la fenêtre que j'aurais prise. Sa
fenêtre « après le balayage » commence une image plus tôt que la mienne ; à la
lecture stricte, le plus grand pas après le balayage vaut **0,00000°** et
l'inclinaison ne prend plus qu'**une seule valeur**, 46,548158°, sur toute la fin
de la descente. **Le chiffre publié est donc réel et conservateur** — il rend le
résultat moins bon qu'il n'est. C'est le bon sens du retrait.

### 1.2 ① — l'identification `90° − atan(18/19)` : ce n'est PAS une concordance

C'est une **identité géométrique**, pas un chiffre qui tombe juste.
`PENTE_ARRIVEE = { y: 18, z: 19 }` (`src/loi-altitude.js:53`), la caméra
d'arrivée est posée le long de `(0, 18, 19)` depuis une cible qui est à son
aplomb ; l'angle au nadir local vaut donc `acos(18/√(18²+19²)) = atan(19/18)
= 90° − atan(18/19)`, par construction, quelle que soit l'altitude.

Calculé : **46,548157698978°**. Relevé dans la trace : **46,548157698978194°**.
**Treize décimales.** L'identification est plus forte que « au centième près ».

⛔ **Mais le chiffre imprimé est faux.** Le rapport, deux blocs de commentaire
(`src/monde/zoom-continu.js` §4 ter, `src/modes.js` `DUREE_FONDU_POSE_S`) et deux
tolérances de test écrivent **46,551°**. `90 − atan(18/19)` vaut **46,5482°**,
pas 46,551. Sans conséquence (les tolérances sont 0,01 et 0,05, et l'écart est de
0,003°), mais c'est un chiffre faux répété six fois.

### 1.3 ① bis — le compte de franchissements est faux, et il minimise le défaut

Le §0 annonce « franchissements de niveau tournant la caméra : **7 sur 7** →
**0 sur 10** ». La trace en contient **onze** de chaque côté :

| avant (`avant-max.json`) | après (`apres-max.json`) |
|---|---|
| z3→z4 **−10,394°**, z4→z5 −1,632°, z5→z6 +2,571°, z6→z7 +1,294°, z7→z8 +2,594°, z8→z9 +4,937°, z9→z10 **+8,128°** | z3→z4 … z13→z14 : **0,0000° les onze** |
| **et quatre que le rapport n'a pas listés** : z10→z11 −0,970°, z11→z12 −3,544°, z12→z13 **−6,807°**, z13→z14 **+6,067°** | |

Le tableau du §1 ① s'arrête à la naissance du crop sans le dire. La fourchette
réelle est **0,97° à 10,39° sur onze franchissements**, pas « 1,29° à 10,39° sur
sept ». Le correctif, lui, les ferme **tous les onze** — le résultat est meilleur
que ce qui est écrit, mais « 7 sur 7 » se présente comme un compte complet.

### 1.4 ② — j'ai rejoué la mesure, et j'ai cherché la faille

**Mon instrument, mon code, mes zones**, sur les 39 JPEG :

| ce que je mesure | t01–t23 | t24 | **t25** | t26 | t27–t37 | **t38 / t39** |
|---|---|---|---|---|---|---|
| « Publier » (DOM opaque) | 138,3–140,8 | 138,3 | **138,7** | 137,5 | 138,3–140,5 | **108,8 / 108,9** |
| canevas (centre) | 137–185 | 62,0 | 55,7 | 56,4 | 40–101 | 29,9 / 29,6 |
| panneau « Explorer » (translucide) | 29–95 | 48,2 | 49,0 | 48,0 | 35–87 | 33,8 / 33,8 |
| barre d'URL de Chrome — **luminance** | 228,2–229,2 | 228,6 | 228,5 | 227,7 | 228,0–228,5 | 228,5 / 228,0 |
| barre d'URL de Chrome — **netteté** (var. du laplacien) | 4 038–4 957 | 4 056 | **2 001** | 3 041 | 4 480–4 855 | 4 604 / 4 656 |
| barre d'ONGLETS de Chrome — **netteté** | 102–556 | 184 | **107** | 128 | 84–412 | 55 / 70 |

**Le bouton « Publier » est bel et bien opaque** : `.ce-pillbtn.accent {
background: var(--ce-accent) }` avec `--ce-accent: #ea580c`
(`src/ui/v28.css:344` et `:12`) — une couleur pleine, sans alpha. Il ne peut pas
montrer la scène derrière lui.

Son témoin positif est réel : à `t38` le panneau Paramètres pose un vrai voile et
le bouton tombe de **139 à 108,8**. À `t24`, `t25` et `t26` il ne bouge pas d'un
niveau.

⚡ **Et j'ai une preuve qu'il n'a pas utilisée, plus forte que la sienne** : à
`t25` ce n'est pas seulement la barre d'URL qui perd sa netteté, c'est **toute la
fenêtre de Chrome** — barre d'URL 4 700 → **2 001**, barre d'onglets 247 →
**107**. Une page web ne peut flouter ni l'une ni l'autre. C'est la vidéo.

⚠️ **Et la date du brief est fausse aussi** : l'assombrissement n'est pas à `t25`,
il est **entre `t23` et `t24`** (canevas **183 → 62**, en une seconde de vidéo).
`t25` est simplement une image floue dans une séquence déjà sombre.

**La faille que j'ai cherchée, et ce qu'elle vaut.** Un `backdrop-filter` sur un
ancêtre ne repeint pas le bouton : l'instrument est donc **aveugle à un voile qui
serait posé au-dessus du canevas mais SOUS la barre d'outils**. Cette hypothèse
n'est pas exclue par la seule mesure du bouton. Elle est en revanche rendue
inutile par la cause identifiée et mesurée dans l'application : j'ai revérifié
sur ses propres captures de descente que le canevas passe de **165 à 97 en une
image** entre `img-avant-max/041-c164-alt35377.png` et `042-c168-alt30487.png`,
pendant que « Publier » reste à **154** et « Mes créations » à **204 → 196**.
C'est la naissance du crop, à 32,3 km, et rien d'autre.

`_whiteout` est correctement écarté, pour les deux raisons données :
`.whiteout { background: #ffffff }` (`src/style.css:590`) et `_whiteout` est
court-circuité sous le drapeau (`src/modes.js:641`).

### 1.5 ③ — le retrait du 43 % est complet, la conclusion large ne l'est pas

**Le chiffre retiré n'a pas fui.** « 43 % » apparaît exactement deux fois dans
tout le livrable, et les deux fois comme citation explicitement retirée :
`rapport-R4.md:135` et `scripts/sonde-claquement.mjs:148`. Nulle part comme
chiffre vivant. ✅

**J'ai poussé sa mesure plus loin que lui.** Son cadre est le centre de l'écran ;
j'ai comparé **toute la capture 1280×800**, bloc par bloc (grille 8×5, blocs de
160²). « Sans parois » reste à **1 à 2 niveaux** du témoin de même état dans
**les quarante blocs**. Les parois ne sont pas seulement absentes du cadre de
mesure : elles ne sont nulle part à l'écran. Sa conclusion est juste.

⛔ **Mais le même banc a mesuré un second maillon GÉOMÉTRIQUE, et il pèse.**
Recalculé par moi sur les `.raw` :

| état | écart moyen |Δ| | % > 8 niveaux |
|---|---|---|
| témoin (rien touché) | 8,97 | 44,0 % |
| sans parois | 9,59 | 46,4 % |
| **sans fond du crop** | **49,08** | **82,8 %** |
| sans style | 52,07 | 88,7 % |
| planète nue | 55,96 | 89,8 % |

Le fond du crop est de la géométrie, pas du style — et il vaut **5,5 fois le
plancher de bruit**. Le rapport l'écarte au motif que le démontage à chaud laisse
la scène incohérente. J'ai regardé `2-sans-fond.png` : c'est vrai, l'image est
cassée, l'argument est recevable. **Mais alors la géométrie n'est pas soldée, et
le rapport ne le dit nulle part** : il conclut sur les parois seules et écrit
« un fondu des parois seules n'aurait rien à racheter » (juste), puis « le
claquement est ailleurs » (non démontré pour le fond).

⚠️ **Et la décomposition ne vaut que pour UNE scène** : le banc part du lieu de
démarrage par défaut, qui est **en pleine mer**. `0-crop-entier.png` est un aplat
bleu-vert, `4-planete-nue.png` l'aplat olive de D15 : les 55,96 mesurent
essentiellement « la mer contre l'olive ». Sur une scène de terre — Zagora, ce
que filme Adrien — la répartition peut être tout autre. Ce n'est pas dit.

### 1.6 Les 7 tests neufs : aucun `return` muet, aucune tautologie

Les 46 tests de `test/zoom-continu.test.js` passent, dont les 7 de la section ⑪.
Aucun n'est vide : chacun est tué par au moins une mutation (§1.7). Le test
`⑪ MUTATION` fait bien son travail — j'ai rejoué le geste du dépôt d'avant et le
test de branchement échoue à **−8,329°**, exactement le chiffre annoncé.

⚠️ **Trois assertions de TEXTE SOURCE subsistent** dans la section ⑥, mises à jour
pour la nouvelle signature :
`assert.match(SRC_MODES, /_suivreEmprise\(cibleAvant = null\) \{/)` et deux
sœurs. Elles ne prouvent rien du comportement et casseront à la première
renommée. Le comportement est couvert ailleurs (⑨, ⑪), donc ce n'est pas un
trou — c'est un coût d'entretien que ce chantier a déjà payé.

### 1.7 CAMPAGNE DE MUTATION — 26 mutations, 17 tuées, **9 SURVIVANTES**

Vingt-six mutations sur les deux lois pures (`poseFranchissement`,
`poseFonduArrivee`) et sur leurs points d'appel dans `src/modes.js`. Chacune
passée d'abord contre `test/zoom-continu.test.js`, puis **les survivantes
rejouées contre les 4 202 tests**. Aucune n'est rattrapée par le reste de la
suite.

**Tuées (17)** — le cœur des deux lois est bien tenu : direction lue sur la
mauvaise cible, ré-ancrage sur la mauvaise cible, signe de pente, conversion
d'emprise sautée, `yCible` ignorée, balayage supprimé, balayage inversé,
altitude modifiée pendant le balayage, gardes de dégénérescence des deux lois,
`_suivreEmprise` appelée sans `cibleAvant`, `cibleAvant` lue **après** la
réécriture de la cible, armement du fondu supprimé, sortie sans emprise
mémorisée rétablie, durée du balayage à 0,01 s, armement hors régime continu,
fondu figé à zéro.

**Survivantes (9), et il faut les nommer :**

| mutation | ce qu'elle défait | le trou |
|---|---|---|
| **Z5** `const d = brute` | la distance n'est plus bornée à `[minDistance, maxDistance]` | rien ne vérifie l'écrêtage de `poseFranchissement` |
| **Z6** garde `penteMin` retirée | la visée rasante n'est plus refusée dans le franchissement | la garde jumelle du fondu, elle, est testée |
| **Z13** `const e = avancement` | l'avancement n'est plus borné à [0,1] | aucun test ne passe `avancement` hors bornes |
| **M4** `\|\| this._fonduPose` retiré de `_franchirSiBesoin` | **la garde que le §4 justifie sur dix lignes** | rien ne rejoue un franchissement pendant le balayage |
| **M5** `if (avant === emprise) return` | **la 1re des « deux gardes ajoutées, chacune pour un cas mesuré »** | le cas « emprise déjà convertie pendant l'`await` » n'est pas rejoué |
| **M7** `empriseAvant: avant` | **la 2e — le repli sans emprise mémorisée** ; sa moitié « ne pas sortir » est testée, sa moitié « ne pas convertir » ne l'est pas | |
| **M9** courbe d'adoucissement → linéaire | le facteur de pointe ×2 **dont `DUREE_FONDU_POSE_S` est dérivée** | le test ne mesure que « pas < 3° », que le linéaire passe aussi |
| **M10** garde `direction.y > 1e-3` de `_armerFonduPose` | une arrivée rasante s'arme quand même | |
| **M11** garde `minDistance × 1,05` de `_armerFonduPose` | **c'est la réserve 2 du rapport** | la garde qui exclut le cas « plongée par clic sur un palier fin » n'est protégée par rien |

⛔ **Le point qui pique : les quatre ajouts défensifs que le rapport présente
comme des nécessités MESURÉES sur l'application (M4, M5, M7, M11) sont
exactement ceux qu'aucun test ne protège.** Un successeur qui les trouve
« inutiles » les enlèvera, et la suite restera verte.

### 1.8 La garantie de production — vérifiée en A/B, pas déduite

`src/modes.js` n'est pas derrière le drapeau : je l'ai traité comme le fichier le
plus risqué du lot.

**Lecture du code.** Chaque comportement neuf est derrière `_continu()` :
`_suivreEmprise` sort au même endroit qu'avant hors drapeau ; `_franchirSiBesoin`
sort déjà sur `!_continu()` avant de lire `_fonduPose` ; `_armerFonduPose` sort
sur `!_continu()` ; le bloc de balayage de `update` lit un `_fonduPose` qui reste
`null` ; `cibleAvant` n'est cloné que dans la branche `continu`. `poseApresNiveau`
n'est plus importée dans `modes.js` et n'y est plus référencée (elle reste
exportée et employée dans `zoom-continu.js:443`).

**Mesure.** J'ai fait l'A/B moi-même, sur GPU réel, serveur `5527` :
descente drapeau baissé (`?f3=0`, 90 crans) sur `HEAD`, puis
`git checkout d366a40 -- src/modes.js src/monde/zoom-continu.js`, même descente,
puis restauration. **Les deux traces sont indiscernables** :

| | `relec-prod-avant2` (d366a40) | `relec-prod-apres2` (HEAD) |
|---|---|---|
| inclinaisons distinctes | 0,000° / 46,548° / 59,330° | **identiques** |
| événements | `surface→orbital` à 60 000 km, `zoom 12→17`, `orbital→surface` **0,000° → 46,548° en 1 image** | **identiques** |
| erreurs de page | 0 | 0 |
| `uCropOn` max / `estompe` max / `veilleCrop.bascules` | 0 / 0 / 0 | 0 / 0 / 0 |

Et la mutation qui retire la garde `_continu()` de `_armerFonduPose` (M12) est
tuée par le test `⑪ DRAPEAU BAISSÉ`. **La production est bien rigoureusement
inchangée.** (Traces : `.banc/R4/relec-prod-avant2.json`,
`relec-prod-apres2.json`. Arbre rendu propre après coup.)

### 1.9 LE PAS DE POINTE SUR GPU RÉEL — je l'ai mesuré, et la réserve 3 tombe

Le brief me demandait de le mesurer si je le pouvais. Je l'ai fait, deux fois.

**D'abord, la prémisse de la réserve est fausse.** J'ai lu
`WEBGL_debug_renderer_info` dans les deux configurations :

    Chrome VISIBLE            → ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 …, D3D11)
    Chrome SANS TÊTE du banc  → ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 …, D3D11)

`--enable-unsafe-swiftshader` **autorise** SwiftShader, il ne l'impose pas.
**Le banc tournait déjà sur le GPU réel.** « Chrome sans tête tourne en
SwiftShader » est faux sur cette machine.

**Ensuite, la mesure.** Descente rejouée en Chrome **visible**, drapeau levé, sur
le port 5527, deux fois :

| | balayage | **pas de pointe** | image | pas > 1,5° | pas > 3° |
|---|---|---|---|---|---|
| `relecture-gpu` | 39 images / 1 749 ms | **4,069°** | 195 ms | **11** | **6** |
| `relecture-gpu2` | 37 images / 1 657 ms | **3,893°** | 182 ms | **12** | **5** |

Le `4,12°` du banc n'est donc **pas** un artefact de banc : c'est ce qui se passe
sur une RTX 3080, parce que la plongée est exactement le moment où
l'application est le plus occupée à charger la surface. Les images longues
existent sur vrai matériel, et l'écrêtage `dt ≤ 0,05` les convertit en pas de 4°.

**Enfin, le `0,97°/image` annoncé n'est dérivable de rien.** La table du rapport
lui-même donne **1,41°** à 60 Hz ; la simulation exacte de la courbe du code
donne **1,389°** à 60 Hz (0,97° demanderait ≈ 87 Hz) ; la mesure sur GPU réel
donne **4,07°**. Les trois se contredisent, et c'est la mesure qui gagne.

⚠️ **Conséquence sur le test.** `assert.ok(plusGrandPas < 3)` **ne peut pas
échouer** : le banc de `machine()` alimente un `dt` parfait de `1/60`, où le pas
vaut 1,389°. Dans l'application réelle, le balayage franchit 3° **cinq à six
fois**. Le garde-fou chiffré ne garde rien.

### 1.10 Le cadeau pour R6 — CONFIRMÉ, avec une réserve que R6 doit connaître

`uEstompage` est bien un paramètre **continu**, et il est bien porté par l'alpha
du fragment :

    float couvertureTuile = mix(1.0, dedans, estompeTuile);   // globe.js:1496
    gl_FragColor = vec4(col, couvertureCrop);                  // globe.js:2073

Le commentaire du dépôt le dit dans le même sens : « HORS du crop l'opacité vaut
`1 − estompage` ; DEDANS elle reste 1 ». Relevé confirmé dans la trace : à
l'image 2090, **`estompe = 0,2213`**, puis montée continue jusqu'à 1.
**« Le dehors se fond déjà, c'est le dedans qui surgit » est exact.** ✅

⚠️ **Mais le paramètre continu est derrière une porte BINAIRE** :

    float estompeTuile = uEstompageOn > 0.5 ? uEstompage : 1.0;   // globe.js:1492

`uEstompageOn` vaut 0 par défaut, est posé à 1 par `poserEstompage`
(`globe.js:3222`) et remis à 0 par `retirerEstompage` (`globe.js:3274`) — donc un
interrupteur 0/1 de la même famille que `uCropOn`. R6 s'appuiera sur le
paramètre : qu'il n'oublie pas la porte.

---

## 2. ARBITRAGE DES RÉSERVES DÉCLARÉES

**« Le claquement de contenu reste entier » — ABANDON JUSTIFIÉ, pas renoncement
déguisé.** `regle-D15.md` recadre R4 explicitement : « il ne reste à fondre que
la géométrie du bloc (la découpe, les parois) ». La découpe se fond déjà
(`uEstompage`, §1.10, confirmé) ; les parois sont sous le plancher de bruit
(§1.5, confirmé et élargi à tout l'écran). Le reste est du style, que D15 confie
à R6. Et l'argument de code tient seul : `uCropOn` n'est pas un gain mais une
porte (`if (uCropOn > 0.5)`, `globe.js:1421`), avec six interrupteurs frères, sur
un nuanceur partagé par toutes les tuiles du globe — un fondu croisé demanderait
d'évaluer deux apparences par fragment. **« Ce n'est pas une étape, c'est une
tâche » est le bon verdict.** Un seul manque : le fond du crop (§1.5).

**« Le balayage dure 1,1 s pendant lesquelles la caméra tient la main » —
ACCEPTABLE COMME DÉFAUT, mais il faut le montrer avant de le clore.** Adrien a
accepté *une* transition, pas *celle-là* ; le rapport le dit et nomme la
constante. Ce qui n'est PAS acceptable, c'est la promesse qui l'accompagne : ce
qu'Adrien verra n'est pas « un balayage à 0,97°/image », c'est **1,7 s contenant
cinq ou six pas de 3° à 4°**. C'est une autre question de produit, et il faut la
lui poser dans ces termes-là.

**« Le pas de pointe de 4,12° est le plafond du banc sans tête » — RÉFUTÉE PAR LA
MESURE**, §1.9 : 4,07° et 3,89° sur GPU réel, prémisse SwiftShader fausse.

**« Le claquement est intact, Adrien le reverra » — honnête, et c'est bien la
moitié du titre.** Le brief demandait neuf étapes ; l'étape 5 (le fondu) n'est
pas faite et l'étape 4 (test rouge sur la continuité du **contenu**) est livrée
sur la continuité de la **pose**. Les deux sont déclarées sans détour. L'étape 3
est réfutée, et la réfutation tient. **Conformité partielle et assumée.**

---

## 3. LES CONSTATS

### CRITIQUE

1. **La réserve 3 dit à Adrien qu'il verra 0,97°/image ; mesuré sur son GPU, il
   verra 4,07°.** La prémisse (« Chrome sans tête tourne en SwiftShader ») est
   fausse — le banc était déjà sur la RTX 3080 —, le chiffre contredit la table
   de dérivation du rapport lui-même (1,41° à 60 Hz) et la simulation exacte
   (1,389°), et le garde-fou censé le tenir (`assert.ok(plusGrandPas < 3)`) ne
   peut pas échouer parce que le banc alimente un `dt` parfait de `1/60` alors
   que le balayage réel franchit 3° cinq à six fois. **Un chiffre non mesuré,
   présenté comme rassurant, sur la seule grandeur qu'Adrien va juger à l'œil.**

### IMPORTANT

2. **Neuf mutations sur vingt-six survivent aux 4 202 tests** (Z5, Z6, Z13, M4,
   M5, M7, M9, M10, M11) — et **quatre d'entre elles sont exactement les gardes
   que le rapport présente comme des nécessités mesurées** (la garde de
   `_franchirSiBesoin`, les « deux gardes ajoutées », la garde `minDistance` de
   la réserve 2). Rien ne les protège d'un successeur qui les jugera inutiles.
3. **③ conclut sur les parois et généralise à la géométrie** : le même banc a
   mesuré le **fond du crop à 49,08**, soit 5,5 fois le plancher de bruit, et le
   fond est de la géométrie. Le rapport l'écarte comme incohérent — c'est
   recevable — mais ne dit nulle part que la part géométrique n'est donc pas
   soldée.
4. **Le compte de franchissements est faux et minimise le défaut d'avant** :
   « 7 sur 7 » et « 0 sur 10 » alors que la trace en contient **onze de chaque
   côté**, dont quatre non listés (−0,97°, −3,54°, −6,81°, +6,07°). Le correctif
   les ferme tous les onze — le résultat est meilleur que ce qui est écrit, mais
   le compte se présente comme complet.

### MINEUR

5. **`90° − atan(18/19) = 46,551°` est faux** : la valeur exacte est
   **46,54816°**, répétée à tort six fois (rapport, deux blocs de commentaire,
   deux tolérances de test). L'identification, elle, est **exacte à treize
   décimales** — plus forte que « au centième près ».
6. **La décomposition du claquement ne vaut que pour une scène**, le lieu de
   démarrage par défaut, **en pleine mer** : le « 55,96 » mesure pour l'essentiel
   « la mer contre l'aplat olive ». Non dit.
7. **Trois assertions de texte source subsistent** en section ⑥ sur la signature
   de `_suivreEmprise` — sans valeur de preuve, et cassables par une renommée.
8. **Le cadeau pour R6 est derrière une porte binaire** : `uEstompage` est
   continu, mais `estompeTuile = uEstompageOn > 0.5 ? uEstompage : 1.0`
   (`globe.js:1492`) est un interrupteur 0/1, comme `uCropOn`. À dire à R6.
9. **« Le canevas perd 31 % de la plage de luminance »** : c'est 79 niveaux sur
   les 255 de l'échelle, pas une baisse relative de 31 % (qui vaut 46 %).
   Formulation seulement — le calcul est juste.

### RIEN À SIGNALER (vérifié, et propre)

- Les traces de `.banc/R4/` sont bien sur disque et **tous** les chiffres du
  rapport en sortent ; aucun n'est sans source consultable.
- Le retrait du « 43 % des pixels » est **complet** : le nombre n'apparaît que
  deux fois, les deux fois comme citation explicitement retirée.
- Les 7 tests neufs mordent sur le comportement ; aucun `return` muet ; le test
  `MUTATION` empêche bien la tautologie, à −8,329° vérifiés.
- `npm test` : 4 202 / 0. `npm run audit:tests` : 216 = 216, aucun écart.
  `test/zoom-continu.test.js` est dans la liste explicite de `package.json`.
- **La production est rigoureusement inchangée**, vérifiée par A/B sur GPU réel
  contre `d366a40`, pas déduite.
- L'étape 7 (le segment au-dessus de 1 600 km) est bien comblée : les deux
  relevés partent de `MAX_ALT_M`, et le segment est vide — vérifié sur trace.
- Le paquet livré correspond au dépôt au caractère près.

---

## 4. CE QUE JE DEMANDE AVANT DE CLORE

1. **Retirer ou remplacer le « 0,97°/image sur GPU réel »** de la réserve 3 par
   le relevé : **4,07° sur RTX 3080, cinq à six pas au-dessus de 3° par
   balayage**, et corriger la prémisse SwiftShader. Et resserrer le test : soit
   il alimente un `dt` non uniforme, soit il ne prétend pas garder un seuil.
2. **Corriger `46,551°` en `46,5482°`** aux six endroits, et dire que
   l'identification est exacte, pas approchée.
3. **Corriger le compte de franchissements** : onze avant, onze après.
4. **Une ligne dans le §1 ③** disant que le fond du crop pèse 49,08 et n'est pas
   fondu non plus, et une ligne disant que le banc a mesuré **une** scène,
   en pleine mer.
5. **Un test par garde survivante**, au moins pour M4, M5 et M11 — les trois que
   le rapport défend le plus longuement.

⛔ **Ce que je ne demande pas** : de refaire le fondu de contenu. La réfutation ③
et le §5 tiennent, D15 a recadré, et le code du fondu de style n'a pas été écrit —
il n'y a rien à défaire côté R6.
