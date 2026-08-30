# Tâche P6 — L'INVENTAIRE : soixante-dix-sept paramètres, et vingt qui n'étaient branchés nulle part

**Statut : LIVRÉE.** · Commits **`d9b2213`**, **`6979b36`**, **`9275686`**, **`f78cb3f`** sur
`regroupement` (arbre propre après commit, worktree de mutation retiré).
`npm test` — **4 001 / 4 001** (3 965 au départ, **+36**) · `npm run audit:tests` — **209 / 209** ·
campagne de mutation — **72 / 72**, dont **57 visant le branchement (79,2 %)**.

> **Le brief :** *« UN PARAMÈTRE EXISTE, IL A UN DÉFAUT, ET PERSONNE NE L'A JAMAIS BRANCHÉ.
> Ta tâche est de les trouver TOUS EN UNE FOIS, au lieu d'attendre qu'ils se révèlent un par un. »*

**Ils sont trouvés. Il y en avait vingt, pas trois.** Et le motif est plus large que décrit : il ne
suffit pas qu'un paramètre soit branché, **il faut qu'il arrive dans la BONNE MONNAIE** — le plus
gros défaut visuel de cette tâche est une valeur juste, branchée par P5, dans la mauvaise unité.

---

## 0. ⚡ LE TABLEAU — CE QUE LA TÂCHE DEMANDAIT, ET IL COMPTE AUTANT QUE LE RESTE

**`.banc/P6/TABLEAU-P6.json`** — les 77 lignes, avec la valeur du crop ET celle du socle, **lues
dans la MÊME PAGE, à la MÊME SECONDE** (La Réunion z12, `?terre=unique`, 2026-08-22).

| classement | compte |
|---|---:|
| **⛔ JAMAIS BRANCHÉS, trouvés et FERMÉS par P6** | **20** |
| ✅ déjà branchés et concordants (Tâches C, P2, P3, P4, P5) | **39** |
| ✅ branchés par CONVERSION d'unité (C, P5, P6) | **4** |
| ⚠️ **NON FERMÉS — la liste ordonnée du §7** | **11** |
| **sans homologue** (le socle n'a pas l'équivalent) | **3** |
| **total inventorié** | **77** |

**Les vingt fermés :**

| famille | paramètre | AVANT | socle vivant |
|---|---|---|---|
| soleil | **direction du soleil de la MER** | ⛔ la CAMÉRA | le soleil du bloc |
| soleil | **direction du soleil des PAROIS** | ⛔ la CAMÉRA | le soleil du bloc |
| soleil | **terminateur jour/nuit sur les parois** | ⛔ actif → **aplat beige** | le socle n'a pas de nuit |
| soleil | irradiance soleil / ciel / sol des parois | ⛔ absentes (3 lignes) | celles des tuiles |
| soleil | **couleur du soleil de la mer** | ⛔ `#ffffff` **en dur** | `#fff7e6` |
| lame | **transparence** | ⛔ **aucun terme** | `0,57` |
| lame | **soleil sur l'eau** | ⛔ **aucun terme** | `0,72` |
| lame | **jour / nuit** | ⛔ **aucun terme** | `1` |
| lame | **clapot de normale** | ⛔ **aucun terme** | `0,75` |
| lame | **glacis clair** | ⛔ défaut du module | `#88d2e1` |
| lame | **bleu du large** | ⛔ défaut du module | `#184465` |
| mer | ⚡ **MONNAIE de la houle** | ⛔ **121,6 fois trop haute** | unités de socle |
| mer | **échelle de spectre** | ⛔ `0,42` **en dur** | `0,231` |
| mer | **spectre de houle** | ⛔ tirage au hasard | `seaSeed = 9879` |
| forme | **rayon d'arrondi** | ⛔ **0 — un carré à angles VIFS** | `0,08` |
| forme | **exposant de superellipse** | ⛔ `2` | `4,4` |
| forme | **demi-côté de référence** | ⛔ `28` en dur | `uSlabHalf` vivant |
| forme | **profondeur du bloc** | ⛔ `7 / 56` **gelée** | `plinth.depth` |

---

## 1. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

Tout est dans **`.banc/P6/`**. Cadre **1 280 × 800**, La Réunion z12, `fov = 33`, **socle RALLUMÉ
DANS LA MÊME PAGE** (le protocole du noteur), rendu **sans compositeur** dans une cible **à
profondeur**, **boucle rAF coupée**.

**Le triptyque à regarder :**

- **`A1-CROP-bloc-APRES-P6.png` → `B1-CROP-bloc-FINAL-P6.png` → `B2-SOCLE-bloc-apparie-FINAL-P6.png`.**
  A1 : la mer est striée de **grands rubans pâles à bords en escalier**. B1 : une mer bleu-canard
  continue, un liseré blanc au trait de côte, des parois terracotta **éclairées**. B2 : le socle,
  apparié à **+0,0024 %**.
- ⚡ **`D2-CROP-mer-sans-houle.png` ↔ `D4-CROP-mer-houle-convertie.png`** — **c'est la preuve de
  cette tâche.** Les rubans disparaissent quand on coupe la houle, **et aussi quand on la
  convertit en unités de scène en la gardant**.
- **`K1-CROP-fond-nu-zoom-P6.png`** — nappe éteinte : le fond marin ne porte **aucun ruban**. Ils
  venaient donc de la NAPPE, pas du fond.
- **`Z1/Z2` et `B3`** — le même coin de mer, ×3, avant et après, contre le socle.

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Sur `B1` contre `B2`, ce qui reste, et je le nomme au lieu de conclure au succès :

1. ⛔ **LE FLANC EST TOUJOURS EN ESCALIER, ET LA MER Y DESCEND EN MARCHES.** Sur tout le secteur
   sud-est, la nappe tombe en gradins jusqu'à la paroi au lieu de s'arrêter net. **C'est le
   dominant nommé par P5, et il n'a pas bougé** — c'est une autre tâche, et il se voit plus que
   tout ce que je viens de fermer.
2. ⛔ **LE FOND MARIN DU CROP EST DEUX FOIS ET DEMIE MOINS DÉTAILLÉ.** Mesuré sur l'intersection
   des deux masques de mer : écart horizontal moyen **1,271 contre 3,219**, énergie de détail
   **1,279 contre 3,684**. La mer du socle porte des ravines sous-marines fines et un moutonnement
   ; celle du crop est lisse. Trois causes, aucune fermée : la **résolution du champ** (réserve de
   P5), la **réfraction** et les **caustiques** (§7).
3. ⚠️ **La paroi du crop est plus claire que celle du socle**, et son contraste entre les deux
   faces est plus faible. La couleur est juste (`c06a44` des deux côtés), la loi d'irradiance est
   celle des tuiles — **je n'ai pas mesuré l'écart d'exposition, et je ne l'invente pas.**

---

## 2. ⛔ LE SOLEIL DU BLOC N'ATTEIGNAIT NI LA MER NI LES PAROIS — ET P3 L'AVAIT ÉCRIT

P3 a trouvé que **le soleil du globe est la CAMÉRA** : `main.js` repose
`globe.setSunDir(camGlobe.position tournée de 42°)` à chaque image. Elle a corrigé **les tuiles**
et a laissé les deux autres nuanceurs dessus.

**Relevé le 2026-08-22, au même instant dans la même page :**

| | direction |
|---|---|
| `uSunDir` (mer ET parois du crop) | **(0,2305 · −0,3687 · 0,9005)** — ⛔ **sous l'horizon** |
| direction de la caméra du globe | (0,7723 · **−0,3687** · 0,5173) — le même `y` |
| soleil de la scène | **(0,4392 · +0,5629 · −0,7001)** |
| `uSoleilDir` (tuiles, depuis P3) | (0,8906 · 0,4485 · 0,0748) |

⚡ **ET C'EST LE GRAND APLAT BEIGE DE LA RÉSERVE N° 1 DE P5.** Le nuanceur des parois portait
`mix(uShadowColor, col, 0,10 + 0,90 × day)` — le terminateur jour/nuit de la PLANÈTE — avec
`uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil laisse à `day ≈ 0` rend donc
**exactement la couleur du fond**. Ce n'était pas une paroi mal éclairée : **c'était l'ombre de la
planète appliquée à un objet de studio.**

**Ce qui est posé :** les parois prennent `irradianceCrop`, **la MÊME fonction et les MÊMES
uniformes que les tuiles**, sur un albédo `uParoiCouleur × occlusion de contact` — ce que le socle
fait déjà avec un `MeshPhysicalMaterial` rugosité 0,95, métal 0, `vertexColors`. Et le terminateur
ne franchit plus la frontière du bloc, **exactement l'argument que P3 écrit déjà pour les tuiles**.

⚠️ **`GLSL_IRRADIANCE` a été DÉTACHÉ, pas recopié** : `GLSL_ECLAIRAGE` dépend de `natLuminance`
(injecté par `GLSL_NATUREL`), que le nuanceur NU des parois n'a pas. Le morceau est extrait, et
`GLSL_ECLAIRAGE` l'interpole — **une écriture, deux lecteurs** (test ⑥c).

---

## 3. ⛔ LA LAME D'EAU : QUATRE RÉGLAGES QUI N'AVAIENT AUCUN PARAMÈTRE POUR ARRIVER

**C'est la réserve n° 2 de P5**, qu'elle avait mesurée sans pouvoir l'attribuer : *« la
concentration de luminance vaut 80,97 % côté crop contre 30,33 % au socle […] presque tout l'écart
vit dans la NAPPE. Je n'ai pas fait cette mesure et je ne l'invente pas. »*

**Elle vit dans quatre uniformes que le nuanceur de la calotte ne portait PAS DU TOUT :**

| | socle vivant | ce que la calotte en faisait |
|---|---|---|
| `uTransp` | **0,57** | ⛔ rien — la lame était **1,556 fois trop opaque** (`mix(1,15 ; 0,26 ; 0,57) = 0,6427`), et **3,85 fois** à tirette pleine |
| `uSunFx` | **0,72** | ⛔ rien — **28 % de glint de trop** |
| `uDetail` | **0,75** | ⛔ rien — **aucun clapot de normale** |
| `uDayLight` | 1 | ⛔ rien — la mer du crop **ne s'éteint pas la nuit** |

⚠️ **ET LE NEUTRE NE POUVAIT PAS ÊTRE « LA CALOTTE D'AVANT » — c'est démontré, pas affirmé**
(test ⑧d, exécuté). Le nuanceur d'avant portait `mix(0,45 ; 0,95)` **sans** le facteur de tirette
(ce qui exige `transparence = 0,1685`) **et** le glacis de lagon à plein régime (ce qui exige
`transparence ≥ 0,35`). Les deux ne peuvent pas être vraies ensemble : **c'est la signature d'une
loi tronquée, pas d'un réglage.** Le neutre retenu est celui des `??` de `waterMaterial`.

### ⚡ ET LES DEUX COULEURS DE LA LAME ONT FAILLI DIRE « BRANCHÉ »

`poserMer` porte un paramètre **`couleurs`** depuis la Tâche F. **Aucun appelant ne l'a jamais
passé.** Au relevé, les deux côtés rendaient **`#88d2e1` / `#184465`, au caractère près** — parce
que `params.lakeColor` valait justement le défaut du module.

⛔ **LE TÉMOIN L'A DIT.** `params.lakeColor` posé à `#c81e1e` dans la page vivante :

| | crop | socle |
|---|---|---|
| avant | `#88d2e1` / `#184465` | `#88d2e1` / `#184465` |
| **pendant** | **`#88d2e1` / `#184465`** — n'a pas bougé d'un bit | **`#a77572` / `#1e3350`** |
| retour | `#88d2e1` / `#184465` | `#88d2e1` / `#184465` |

➡️ ⚡ **UNE CONCORDANCE AU DÉFAUT N'EST PAS UN BRANCHEMENT.** C'est la leçon de méthode de cette
tâche, et elle vaut aussi pour **`profondeur`** (`7 / 56` sont `params.plinthDepth` et
`TERRAIN_SIZE` **à leur valeur d'usine**) : témoin `plinth.depth 7 → 21`, `baseY` passe de
**−0,120 085** à **−0,227 377**, retour exact.

---

## 4. ⚡ LE DÉFAUT LE PLUS GROS N'ÉTAIT PAS UN PARAMÈTRE ABSENT — C'ÉTAIT UNE MONNAIE

**Trouvé À L'ÉCRAN, pas dans le code.** Sur `A1-CROP-bloc-APRES-P6.png`, une fois la lame d'eau
correctement transparente, la mer du crop s'est révélée striée de **grands rubans pâles à bords en
escalier**. Trois A/B à témoin nul (0 canal d'écart à l'aller-retour), même page, boucle coupée :

| essai | résultat |
|---|---|
| nappe **éteinte** (`K1`) | ⛔ **le fond marin nu n'a AUCUN ruban** → ils viennent de la nappe |
| `uMerHoule = 0` (`D2`) | ⛔ **les rubans disparaissent entièrement** |
| `uMerHoule × uMerUnite` (`D4`) | ⚡ **ils disparaissent AUSSI, et la houle reste** |

⛔ **`uMerHoule` VAUT CE QUE VAUT `uWaveH` DU SOCLE, C'EST-À-DIRE DES UNITÉS DE SOCLE** ;
`oceanGerstner` ajoute cette amplitude aux coordonnées d'un maillage qui est en **UNITÉS DE
SCÈNE**. Relevé : `uMerUnite = 0,008 227`, donc `uMerHoule = 2` valait **121,6 fois** l'amplitude
du socle. Le déplacement **HORIZONTAL** — que l'écrêtage de déferlement (`0,78 × profondeur`) ne
borne pas — atteignait plusieurs fois la largeur du bloc : **le maillage se repliait sur lui-même**,
et l'interpolation de `vProfondeur` sur des sommets mélangés peignait ces rubans.

⚠️ **ET C'EST P5 QUI L'A AGGRAVÉ, EN AYANT RAISON.** Elle a branché `uMerHoule` de 0,5 à 2 — la
bonne valeur — sans convertir l'unité, et l'a donc multiplié par quatre. **C'est exactement la
faute que P4 a réparée sur la tavelure (« indexée dans la mauvaise monnaie ») et P5 sur le budget
du fond (la calotte au lieu du bloc).** ⚡ **`uMerLambda`, lui, était DÉJÀ converti : c'est cette
asymétrie qui l'a rendu invisible pendant cinq tâches.**

➡️ **Le motif du brief est plus large que décrit, et c'est ma correction au cahier des charges :
il ne suffit pas de demander « ce paramètre est-il branché ». Il faut demander « arrive-t-il dans
la monnaie du lecteur ».** Un paramètre non branché saute aux yeux quand on le cherche ; un
paramètre branché dans la mauvaise unité a l'air correct dans tous les relevés de valeurs — le mien
comme celui de P5 — et ne se voit **qu'à l'écran**.

### La réserve n° 3 de P5, fermée du même geste

Elle écrivait : *« le socle vit à `lenSea = LEN_SCALE × clamp(waveScale) = 0,231` pendant que le
crop dérive la sienne de `ECHELLE_HOULE_UNITES = 0,42` EN DUR. Le spectre du crop est 1,818 fois
plus étiré. Je ne l'ai pas fermé parce que les deux vivent dans des systèmes d'unités
différents. »* ⚡ **Le système de conversion existait : c'est `uMerUnite`**, celui de la tavelure.
Relevé : **1,695 fois** (le rapport bouge avec `waveScale`, ce qui est précisément pourquoi il doit
être LU). `uMerLambda` vaut désormais `0,001 900 428` des deux côtés.

---

## 5. LA FORME DU BLOC — UN CARRÉ À ANGLES VIFS CONTRE UN SQUIRCLE

`poserCrop` porte `half`, `corner` et `expo` **depuis la Tâche A**. Personne ne les a jamais passés.
`construireParoisCrop` porte `profondeur` **depuis la Tâche B**. Personne non plus.

| | crop | socle |
|---|---|---|
| rayon d'arrondi normalisé | ⛔ **0** | **0,08** (`uSlabCorner 2,24 / uSlabHalf 28`) |
| exposant de superellipse | ⛔ **2** (arc de cercle) | **4,4** (squircle) |
| profondeur, en fraction de la largeur | `7 / 56` **gelée** | `plinth.depth / 2 × uSlabHalf` |

⚡ **LA TÂCHE P4 AVAIT MÊME RELEVÉ LE ZÉRO EN PASSANT** — son commentaire dans `MER_FRAG` dit
« relevé sur la page vivante : `uCropCoin` vaut ZERO » — **sans y voir un branchement absent.**
`parois-crop.js` §4 l'écrivait déjà noir sur blanc : *« `cornerR` → `forme.coin`, le rayon
NORMALISÉ que `poserCrop` pose déjà »*. Il le posait, personne ne le lui donnait.

⚠️ **LA FORME EST SURVEILLÉE PAR IMAGE, À PART DE LA SIGNATURE DE LIEU, ET C'EST UN CALCUL DE
COÛT.** `signature` déclenche `poserTout`, donc un champ de mer de 385² et un balayage de rampe de
128² **à chaque image d'un glissement de tirette**. `rafraichirForme` ne rejoue que **`crop` et
`parois`** — et **la mer suit sans être rebâtie** parce que son matériau PARTAGE `uCropCoin` et
`uCropCoinN` avec les tuiles. ⚠️ **La rampe, elle, n'est PAS rejouée, et je le dis** : son
amplitude bouge d'un cheveu quand l'arrondi change, et elle se remesure au prochain déplacement.

---

## 6. LES MESURES — ET LEURS DÉNOMINATEURS

**Cadrage apparié à `+0,0024 %`** (soit **416 fois** mieux que le 1 % demandé), balayé sur un
**CLONE** de la caméra du socle que l'application ne voit jamais. **Témoin d'aller-retour : 0 canal
sur 3 072 000**, et ce zéro n'est pas un banc vide — cacher le bloc change **249 499 pixels**.

### ⚡ LA MESURE QUE P5 LAISSAIT OUVERTE

Concentration de luminance sur le **masque de la mer** (part des pixels portée par les 16 valeurs
les plus fréquentes) — **la mesure de P5, refaite avec SON harnais** :

| | crop | socle |
|---|---|---|
| **P5 (2026-08-22, avant)** | **80,97 %** | **30,33 %** |
| **P6 (après)** | **48,50 %** | **30,25 %** |

➡️ **L'excès passe de +50,64 points à +18,25 : l'écart est réduit de 64 %.** ⚠️ **Et ce qui rend
la comparaison légitime, c'est que le SOCLE se reproduit à 0,08 point** (30,33 → 30,25) : ce n'est
pas mon protocole qui a changé.

### ⛔ ET LE DÉNOMINATEUR, PARCE QUE CE CHANTIER S'Y EST FAIT PRENDRE TROIS FOIS

Le masque de mer du socle fait **86 984 px**, celui du crop **61 936** : la nappe du socle déborde
loin du bloc pendant que celle du crop s'arrête à la frontière. **Deux pourcentages sur ces deux
masques comparent deux ÉTENDUES, pas deux mers.** Toutes les lignes ci-dessous sont donc mesurées
sur leur **INTERSECTION** — **52 641 px**, soit 85,0 % du masque du crop et 60,5 % de celui du socle :

| | crop | socle | |
|---|---|---|---|
| concentration (16 valeurs) | 56,14 % | 44,96 % | crop +11,2 pts |
| luminance moyenne | 147,08 | 136,22 | crop **+8,0 %** *(notation-01 : +42,0 %)* |
| saturation moyenne | 0,2842 | 0,3000 | socle **+5,6 %** *(notation-01 : +40,6 %)* |
| écume (L > 200, sat < 0,25) | 0,96 % | 8,66 % | ⚠️ **le crop en a moins que le socle** *(notation-01 : ×7,7 en trop)* |
| ⛔ **écart horizontal moyen** | **1,271** | **3,219** | socle **×2,53** |
| ⛔ **énergie de détail** | **1,279** | **3,684** | socle **×2,88** |

➡️ **Les quatre critères de couleur sont refermés à moins de 12 % ; les deux critères de DÉTAIL
LOCAL ne le sont pas du tout.** C'est ce qui reste, et le §7 dit d'où ça vient.

### ⚠️ CE QUE L'A/B DIT, ET CE QU'IL NE DIT PAS

A/B à témoin nul (0 canal), même page, boucle coupée, sur les quatre réglages de la lame :

| état | concentration | luminance |
|---|---|---|
| **vivant** (0,57 / 0,72 / 1 / 0,75) | **48,52 %** | 142,80 |
| **neutre d'`ocean.js`** (0,4 / 1 / 1 / 0,6) | 59,04 % | 129,91 |
| ⛔ **clapot coupé** (`uMerDetail = 0`) | **48,53 %** | 142,80 |

⛔ **LE CLAPOT DE NORMALE NE DÉPLACE RIEN À CETTE ALTITUDE, ET JE NE LE PORTE PAS À MON CRÉDIT.**
0,01 point sur 48,5. À 17,8 km, sa cellule fait ~1,5 pixel des deux côtés : elle s'aliase. **Il est
branché, sa monnaie est vérifiée (`uMerUnite`, la même que la tavelure), et il ne se verra que de
près.** Le reste de l'écart entre le vivant et le neutre est la transparence.

⚠️ **Et je n'ai PAS pu mesurer « le crop d'avant P6 »** : le nuanceur d'avant portait une loi
tronquée qu'aucune valeur d'uniforme ne reproduit (§3). La seule comparaison avant/après valable
est celle avec les chiffres de P5, ci-dessus.

⚠️ **UNE PRÉCAUTION VÉRIFIÉE, ET J'AI FAILLI LA MANQUER** : la mer du socle échantillonne une
**passe de capture** (`uSceneTex`). Relevée à `null` avant tout rendu, elle rendrait un fond NOIR
et fausserait tout le côté socle. **`onBeforeRender` la remplit dès le premier rendu du socle
rallumé** — vérifié à `true` ensuite, et **les deux premiers rendus de chaque série sont jetés**
pour cette raison. Sans ça, mon premier balayage de `k` rendait 94 578 px puis 29 376 au pas
suivant : un banc qui ment de façon parfaitement plausible.

---

## 7. ⚠️ LA LISTE ORDONNÉE — CE QUI N'EST PAS FERMÉ, PAR ÉCART VISUEL

C'est elle qui sert aux tâches suivantes. **Onze postes, mesurés ou nommés, aucun deviné.**

### 1️⃣ LE FLANC EN ESCALIER ET LA MER QUI Y DESCEND EN MARCHES — *le dominant, inchangé*

Sur `B1-CROP-bloc-FINAL-P6.png`, tout le secteur sud-est : la nappe tombe en gradins jusqu'à la
paroi. **P5 l'a nommé comme le nouveau dominant, il l'est resté**, et c'est maintenant ce qui saute
le plus aux yeux. *Autre tâche (jupes et parois).*

### 2️⃣ LE DÉTAIL LOCAL DE LA MER — *mesuré à ×2,5, et trois causes nommées*

Écart horizontal **1,271 contre 3,219**, énergie de détail **1,279 contre 3,684**, sur des masques
appariés. Trois causes, aucune fermée, **et je ne sais pas laquelle domine** :

- ⛔ **la RÉFRACTION** (`uRefract = 0,34`) — la passe de capture du socle tord le fond marin sous
  l'eau et lui ajoute toute sa variation. **Le crop n'a aucune passe de capture** ; en poser une
  demande un rendu supplémentaire de `sceneGlobe`. *Le poste le plus cher, et probablement le plus
  gros.*
- ⛔ **les CAUSTIQUES** (`uCaustics = 2,4`, `uSeabedCaustics = 1`) — le socle en peint sur les
  fonds clairs. Le crop n'en a pas. *Coût moyen : la fonction `caustic` d'`ocean.js` est portable.*
- ⚠️ **la RÉSOLUTION du champ** (129 nœuds en travers du bloc contre 1 536 px de MNT) — **la
  réserve n° 4 de P5, inchangée, et son argument de coût tient toujours** (tripler `CHAMP_FOND`
  coûte neuf fois `remplirHauteurs`).

### 3️⃣ L'INTERVALLE DES COURBES DE NIVEAU — *le curseur de l'utilisateur est ignoré*

Relevé : crop **250 m** (dérivé de l'amplitude locale) contre socle **0,29** — **et ce ne sont pas
les mêmes unités** : le socle mesure en unités de scène sur un relief déjà exagéré. `contourInterval`
est un curseur du panneau « Carte », et **le crop ne le lit pas du tout**. ⚠️ **Invisible
aujourd'hui** (`uContourOpacity = 0` des deux côtés — la correction de justice du noteur), **et
faux dès qu'on allume les courbes.** *La fermeture demande sa propre mesure de conversion.*

### 4️⃣ LA MATIÈRE DES PAROIS — *la couleur est juste, la matière non*

Les 50 vignettes de matière, le verre, le givre, la diffusion (SSS), **le chanfrein du haut** et
**l'arrondi vertical du bas** (`SOCLE_CHANFREIN`, `SOCLE_ARRONDI` dans `plinth.js`) : rien n'est
porté. Le crop a maintenant la bonne loi d'éclairage et la bonne couleur ; il n'a ni relief
d'arête ni matière. *`parois-crop.js` §4 dit déjà lesquelles des douze options passent.*

### 5️⃣ L'OMBRE PORTÉE — *0 pixel contre 26 729 (2,61 % du cadre) sur le socle*

Manque n° 5 du noteur, inchangé. `passeFond.skipShadowMapUpdate = true` dit que ce n'était pas
prévu. *Rien n'ancre le bloc au sol.*

### 6️⃣ LE GRAIN DE RELIEF — *`grainForceM` laissé à zéro, et c'est écrit dans `main.js`*

`poserHabillage` porte `grainForceM` et `grainEchelle` ; `contexteCrop` ne les passe pas, et le
commentaire l'assume : *« rien dans les réglages du socle ne s'y traduit en mètres de relief sans
une mesure qu'on n'a pas faite »*. **Toujours vrai.** `params.detailScale = 0,8` vit côté socle.

### 7️⃣ LA GRILLE MÉTRIQUE DU SOCLE — *non portée du tout*

`gridStep = 5`, `gridColor = #242220`, `gridOpacity`. Le crop porte un **graticule 10°** à `0,16`
codé en dur, qui n'a pas d'homologue et qu'aucune ligne ne traverse à l'échelle d'un bloc.
⚠️ **Invisible aujourd'hui** (`gridOpacity = 0`), **faux dès qu'on allume la grille.**

### 8️⃣ LE RELÈVEMENT DU PLAN D'EAU — *`uLift = 0,693`, sans homologue*

Le socle relève sa nappe ; la calotte pose la sienne au niveau zéro avec son propre epsilon de
coplanarité. **Deux mécaniques différentes pour le même service** — à trancher, pas à recopier.

---

## 8. LES TESTS ET LA CAMPAGNE DE MUTATION

**+36 tests, tous EXÉCUTÉS sauf ceux qui se déclarent de SOURCE**, dans cinq fichiers :
`ecume-mer` (⑧a-⑧l), `mer-sphere` (⑭a-⑭m), `crop-branche` (⑧a-⑧h), `crop-eclairage` (⑥a-⑥c).

- **⑧a-⑧c** `lameEauDuSocle` champ par champ, avec le débordement et le `NaN` ;
- ⚡ **⑧d** **la démonstration qu'aucune transparence ne reproduit le nuanceur d'avant** — c'est
  la justification du neutre, et elle est exécutée, pas affirmée ;
- **⑧e-⑧f** `opaciteEau` bornée et monotone sur 10 000 points, **et le GLSL confronté à son jumeau
  JS sur 3 000 points** ;
- **⑧g-⑧h** aucune des cinq formules ne reparaît dans `ocean.js` ni dans `globe.js`, **et les deux
  fichiers les APPELLENT** ;
- **⑧k** les trois lois `vec3` (que le traducteur `float` ne prend pas), **chaque motif avec son
  témoin de rougissement** ;
- **⑭a-⑭e** `majReglagesMer` un réglage à la fois, le demi-couple, le spectre par référence ;
- **⑭f-⑭i** le coin normalisé et borné, le partage de `uCropCoin` avec la mer, la profondeur en
  fraction ;
- **⑭j-⑭k** l'échelle de spectre, convertie **d'un seul côté** ;
- **⑥a** `_materiauParois` **exécutée** : les six uniformes partagés, **avec le témoin** (un
  uniforme qui n'a rien à faire là ne doit PAS l'être).

### La campagne — `.banc/mutations-P6.mjs`, worktree `C:/Dev/wt-p6-mut`, **retiré en partant**

`node_modules` en **jonction** ; **`git ls-files --eol` vérifié `i/lf w/lf`** sur les huit fichiers
touchés — aucun faux survivant possible.

**72 mutations sémantiques, dont 57 visant le BRANCHEMENT (79,2 %).**

- **Premier tour : 60 / 72**, onze survivantes et une non appliquée.
  ⚡ **CINQ des onze visaient le MÊME nuanceur : celui des parois n'était gardé par RIEN.**
- ⛔ **ET UNE DES ONZE ÉTAIT NEUTRE, JE LE DIS PLUTÔT QUE DE LA COMPTER.** « le plancher de Fresnel
  tombe AVANT l'écrêtage » — `max(clamp(x), y)` contre `clamp(max(x, y))` — est **mathématiquement
  identique** tant que `y` reste entre les deux bornes ; or `fresnel` est écrêté à 0,5, donc
  `y ≤ 0,25`, et `0,05 ≤ 0,25 ≤ 0,97`. **Ce n'était pas un trou de test.** Le test ⑧l le démontre
  maintenant sur 40 000 points — **et montre au passage que l'écrêtage lui-même est INERTE là où le
  glacis est plein**, ce que personne n'avait vu. La mutation a été réécrite pour être sémantique.
- **Second tour : 72 / 72, 0 survivante, 0 non appliquée.**
  `.banc/P6/resultat-mutations-P6.json`. **Chaque mutation est écrite sur le disque, les tests
  rejoués pour confirmer l'échec, puis le fichier restauré** ; `git diff --stat` du worktree
  vérifié **vide** avant retrait.

---

## 9. CLÔTURE

- `npm test` — **4 001 / 4 001** (3 965 au départ, **+36**, aucun retiré).
- `npm run audit:tests` — **209 listés · 209 sur disque, aucun écart**.
- `node --check` — vert sur les huit fichiers de production et les quatre de test.
- **CRLF** — `git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent **exactement le même
  compte**, sur la plage entière `4a182a3..HEAD` **et commit par commit sur les quatre**.
- **Arbre propre après commit** · **worktree de mutation retiré** (`git worktree list` ne le porte
  plus, le dossier n'existe plus).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `refus = []`, **23 programmes, 0 non exécutable, aucune erreur JS ni de compilation**.
  `uCropCoin = 0,08` et `uCropCoinN = 4,4` **= le socle** · lame `0,57 / 0,72 / 1 / 0,75` **= le
  socle** · `uMerPeu`/`uMerFond` **= le socle** · `uSunColor = #fff7e6` **= le socle** ·
  `uMerLambda = 0,001 900 428` **= `uLenScale × uMerUnite`** · spectre **PARTAGÉ** ·
  parois `uEclairageOn = 1` et `uSoleilIrr` **partagé avec les tuiles**.
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  socle plat **visible**, plinthe visible, `real-water` visible avec ses **deux** maillages,
  **`real-water-sea` et `real-water-skirt` compilés et exécutables** (c'est ce qui garde ma
  retouche d'`ocean.js`), `uCropOn = 0`, `uHabOn = 0`, `uMerRampeOn = 0`, `uEclairageOn = 0`,
  **aucune mer ni paroi de crop**, `uCropCoin = 0` et `uCropCoinN = 2` (**le carré vif d'avant, au
  bit près**), `uMerFondBudgetM = 6 000`, `uOcean* = #dce8ec / #7fa8b8 / #31576b` (les défauts du
  module), `uParoiCouleur = #d8d4cc`, **24 programmes, 0 non exécutable, aucune erreur**.

---

## 10. MES RÉSERVES

1. ⛔ **LE FLANC EN ESCALIER EST TOUJOURS LE DOMINANT, ET IL EST MAINTENANT PLUS SEUL.** J'ai fermé
   la couleur, l'éclairage et la houle ; ce qui reste à l'œil, c'est la GÉOMÉTRIE du bord. **Je ne
   l'ai pas touché** (autre tâche) mais il est plus visible que ce que je viens de réparer.
2. ⚠️ **LE DÉTAIL LOCAL DE LA MER N'EST PAS FERMÉ, ET J'AI TROIS CAUSES SANS SAVOIR LAQUELLE
   DOMINE.** Réfraction, caustiques, résolution du champ (§7.2). **Je n'ai pas fait la mesure qui
   les sépare, et je ne l'invente pas.**
3. ⚠️ **LE CLAPOT DE NORMALE NE SE VOIT PAS À CETTE ALTITUDE — MESURÉ À 0,01 POINT.** Il est
   branché et sa monnaie est vérifiée, mais **je n'ai aucune preuve visuelle qu'il serve**, et je
   ne le compte pas dans le gain.
4. ⚠️ **AUCUNE MESURE DE COÛT, PAS UNE MILLISECONDE.** J'ajoute par image quatre affectations,
   deux `Color.copy`, deux affectations de tableau et une lecture de forme ; et **par fragment de
   mer, DEUX ÉVALUATIONS DE BRUIT** pour le clapot, sur toute la nappe. Le socle les paie aussi,
   mais **le déclarer négligeable serait exactement ce que P3 a refusé de faire.**
5. ⚠️ **LA VEILLE DE FORME NE REJOUE PAS LA RAMPE**, et son amplitude dépend un peu de l'arrondi.
   Elle se remesure au prochain déplacement. **Dit ici plutôt que découvert.**
6. ⚠️ **UN SEUL LIEU, ET UNE SEULE ALTITUDE.** Tout est sur La Réunion, z12, 17,8 km. Un crop
   continental (pas de mer) retombe sur les neutres — **vérifié par test, pas à l'écran**. Une
   palette autre que celle du gabarit d'ouverture n'est vérifiée que par test.
7. ⚠️ **TOUT EST AU REPOS.** La houle défile maintenant à la bonne vitesse (P5) **et à la bonne
   amplitude** (P6) ; **je n'ai aucune capture en mouvement**, donc rien sur le battement ni sur
   les coutures. C'est la même réserve que P5, et elle porte maintenant sur une grandeur que j'ai
   changée de deux ordres de magnitude.
8. ⚠️ **LE NEUTRE DE LA HOULE A CHANGÉ DE 121,6 FOIS POUR UN CROP SANS SOCLE À LIRE** (banc, test,
   crop continental). C'est voulu — l'ancien était faux — mais **ce n'est plus « le dépôt au bit
   près »**, et D13 §① dit que ce cérémonial n'est plus obligatoire. **Je le dis plutôt que de le
   laisser découvrir.**
9. ⚠️ **AUCUNE PREUVE BIT-À-BIT DU SOCLE.** `ocean.js` est modifié (trois lois extraites,
   transcrites terme pour terme et confrontées à leurs jumeaux par ⑧f et ⑧g). Ce qui les garde,
   ce sont ces tests **exécutés** et le relevé « drapeau baissé » du §9 — **pas une comparaison
   d'images.** P3 a montré que le plancher de bruit inter-chargement (jusqu'à 33,28 %) y est plus
   grand que l'effet.
10. ⚠️ **`uMerUnite` EST UNE ÉCHELLE HORIZONTALE, ET JE L'APPLIQUE À UNE AMPLITUDE VERTICALE.**
    C'est juste parce que le repère local de la calotte est isotrope (les mêmes unités de scène en
    x, y et z) et que le socle l'est aussi. **Je l'ai vérifié par lecture et par l'image, pas par
    une mesure de hauteur de vague en mètres.**

---

## 11. CE QUI RESTE SUR LE DISQUE

`.banc/P6/` — **`TABLEAU-P6.json`** (les 77 lignes du §0), `AVANT-inventaire-P6.json`,
`APRES-lot1-P6.json`, `APRES-mer-P6.json`, `APRES-mer-intersection-P6.json`, `FINAL-mer-P6.json`,
`AB-lame-eau-P6.json`, `resultat-mutations-P6.json` — **huit relevés** — et **douze captures** :
`A1/A2` (le bloc avant/socle), `B1/B2/B3` (le bloc final/socle/zoom), `Z1/Z2` (la mer ×3 des deux
côtés), `K1` (le fond nu), `D1/D2/D3/D4` (les quatre A/B de la houle et de la peinture).
Outils : `.banc/P6/sonde-P6.txt` (l'inventaire), `.banc/P6/tableau-P6.txt` (le tableau),
`.banc/P6/recois-P6.mjs` (récepteur, port 5606), `.banc/mutations-P6.mjs`.
Le rendu et les mesures **réutilisent `harnais-P5.mjs`** (qui importe P4, qui importe P3) — ils ne
sont pas réécrits.
