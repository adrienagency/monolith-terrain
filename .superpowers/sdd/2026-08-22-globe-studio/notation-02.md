# NOTATION 02 — le crop face au socle d'avant la sphère, après cinq tâches

**Agent noteur · 2026-08-22 · `C:\Dev\wt-merge`, branche `regroupement`,
HEAD `f78cb3f3805d02a0f60671db33f4edb300cbaa1f` (`f78cb3f`), arbre propre avant ET après,
aucune source touchée.**

> ⚠️ **C'EST CET ÉTAT-LÀ QUI EST NOTÉ.** `f78cb3f` est le dernier commit de la Tâche P6
> (« les six trous que la campagne de mutation a trouvés »). Si un implémenteur committe
> par-dessus pendant que vous lisez, cette note ne juge pas son travail.

**Toutes les captures et tous les chiffres de ce rapport sont les miens**, pris ce jour, et
laissés dans **`.banc/vues-notation-02/`** (50 fichiers : 25 captures PNG, 17 relevés JSON, le
harnais et les deux serveurs). Cadre **1 280 × 800 = 1 024 000 px**, La Réunion, z12, vue
isométrique 0, `fov = 33`, rendu dans une **cible à profondeur**, **sans compositeur**,
**boucle rAF gelée**.

**Note globale : 5,3 / 10, contre 3,5 / 10 à la notation 01.** Le détail est au §4, et
⚡ **la liste de ce qui manque est au §5 — c'est elle qui sert.**

---

## 0. ⚡ CE QUE J'AI DÛ RÉGLER AVANT DE POUVOIR COMPARER LES DEUX NOTES

### 0.1 Le protocole de mon prédécesseur, repris tel quel — et il tient

Sous `?terre=unique` le socle **est caché, pas détruit** : je le rallume **dans la même page**
et je rends les deux blocs **à la même seconde**. Relevé au même instant
(`.banc/vues-notation-02/B-etat-vivant-N02.json`) :

| | valeur |
|---|---|
| `terrain.mesh` | **594 434 sommets** — le même compte que notation-01 |
| rampe | `terrain.mapUniforms.uRampTex.value.uuid` **===** `globe.uniforms.uRampCrop.value.uuid` |
| texture d'analyse | **le même objet `three`**, uuid identique |
| soleil | `#fff7e6`, intensité **3,742 990 6** — **le chiffre de notation-01 au dernier digit** |
| hémisphère | ciel `#85c2eb`, sol `#4a3a2a`, intensité **0,810 498 4** — idem |

⚠️ **`===` sur les UNIFORMES rend `false` aujourd'hui** (les porteurs ont été dédoublés
depuis) : **c'est l'égalité des `uuid` des TEXTURES qui fait foi**, et elle est vraie. Je le
dis parce qu'un noteur pressé aurait conclu « la palette n'est plus partagée » et se serait
trompé.

**Je n'ai pas réécrit le banc** : mon harnais (`.banc/vues-notation-02/harnais-N02.mjs`)
**importe `../harnais-P5.mjs` → `P4` → `P3`**, où les mesures de notation-01 sont déjà
transcrites (`P3.mesures`, `P4.mesuresMer`, `P5.terrasses`). Une seconde écriture aurait fait
deux bancs qui divergent. Ce que j'ajoute est listé en tête du fichier.

### 0.2 ⚡ LE CADRAGE DE NOTATION-01 EST RETROUVÉ, ET IL SE PROUVE

`bilan-notation.json` donne ses deux lieux exacts. Je m'y suis remis :

| cadrage | lieu | preuve indépendante |
|---|---|---|
| **intérieur** | lat **−21,115** · lon **55,536** · z12 · iso 0 | `heightContrast/heightPivot` retombent sur **2,2 / 0,41** — ⚡ **exactement la réserve n° 6 de notation-01**, qui s'étonnait de ne pas avoir les 2,5 / 0,65 de P2. Ce sont des valeurs d'ombrage AUTO : elles dépendent du lieu. Retomber dessus au centième prouve que je suis à son endroit. |
| **côte** | lat **−21,05** · lon **55,25** · z12 · iso 0 | `2,5 / 0,58` (il ne l'avait pas relevé) |

⛔ **Et j'ai d'abord noté au mauvais endroit.** Ma première série était sur le lieu d'ouverture
(−21,26 / 55,74, celui de P5 et P6) : le masque y contient le **fond marin**, donc un tiers de
pixels turquoise que le cadrage « tout terre » de notation-01 n'a pas. **Cette série-là est
retirée** ; elle ne survit que comme donnée de calibration (`CAL-*`, `I1`–`I4`).

### 0.3 ⛔ LE LOOK DE NOTATION-01 N'EST PAS CELUI QUE CROYAIT LE CHANTIER, ET ÇA CHANGE TOUT

Son script n'est pas sur le disque. J'ai donc calculé **trois looks sur LE MÊME tampon
linéaire**, au même endroit, et je les ai confrontés à **ses chiffres du socle** — le socle
étant le seul étalon qui n'a pas bougé :

| look | socle moyRGB | énergie de détail |
|---|---|---|
| **ACES(exposition)** — celui de P3/P4/P5/P6 | [183,48 · 175,52 · 167,48] | **4,202** |
| sRVB direct | [181,29 · 171,41 · 160,05] | **5,755** |
| ⚡ **octet linéaire** | **[125,12 · 111,50 · 95,47]** | **14,883** |
| **notation-01** | **[114,04 · 87,73 · 67,35]** | **16,435** |

➡️ **Seul l'octet linéaire est du bon ordre** : énergie à **−9,4 %**, écart-type de luminance à
**+3,0 %** (52,06 contre 50,54). Les deux autres ratent l'énergie **d'un facteur 3 à 4** : noter
avec eux aurait comparé des chiffres qui ne parlent pas de la même image. **Et l'œil le
confirme** : `CAL-SOCLE-interieur-LINEAIRE.png` retrouve le socle olive et terracotta de
`vues-notation/DUO-SOCLE-interieur-apparie.png`, là où `CAL-SOCLE-interieur-ACES.png` rend un
bloc délavé. **Toute la notation ci-dessous est en octet linéaire.**

⚡ **ET LE PONT QUI FERME LA DÉMONSTRATION.** Le crop d'aujourd'hui, **lumière des tuiles
coupée** (`uEclairageOn = 0`, aller-retour à 0 canal), rend :

| | crop 2026 lumière coupée | **crop de notation-01** |
|---|---|---|
| hors de la bande orange | **0,10 %** | **0,26 %** |
| pixels quasi neutres | **1,00 %** | **1,30 %** |

➡️ **Le crop que notation-01 a noté EST le crop d'aujourd'hui avec la lumière éteinte.** Les
deux notes parlent bien du même objet.

### 0.4 ⚠️ LA RÉSERVE QUI BORNE TOUTE COMPARAISON DE COULEUR ENTRE LES DEUX NOTES

**Mon socle ne reproduit PAS les chiffres de COULEUR du socle de notation-01 :**

| | moi | notation-01 |
|---|---|---|
| énergie de détail | 14,883 | 16,435 — **−9,4 %, ça va** |
| écart-type de luminance | 52,06 | 50,54 — **+3,0 %, ça va** |
| ⛔ saturation moyenne | **0,2050** | **0,4536** |
| ⛔ part de neutres | **24,84 %** | **7,44 %** |
| ⛔ hors bande orange | 11,21 % | 16,92 % |

Lumières identiques au dernier digit, rampe et analyse partagées, `mapTint = 0,68` :
l'écart vient de l'**état de palette du chargement**, exactement ce que notation-01 lui-même
avertissait à son §0. ➡️ **Les valeurs ABSOLUES de couleur des deux notes ne se comparent pas.
Seuls les ÉCARTS crop ↔ socle, mesurés DANS la même page, se comparent.** C'est sous cette
règle que le §3 est écrit, et je la rappelle à chaque ligne où elle mord.

---

## 1. LA PREUVE D'APPARIEMENT

`applyIsoView` dérive de `controls.maxDistance` : à caméra identique les deux blocs
n'occupent pas la même fraction du cadre. **Chez moi le piège mord dans l'autre sens que chez
mon prédécesseur** — à `k = 1` le socle rend **148 414 px** contre **194 591** au crop, soit
**×0,763** en aire (lui mesurait ×1,362). C'est la distance de départ des deux caméras qui
diffère d'un chargement à l'autre, **et c'est précisément pourquoi on balaie au lieu de
supposer.**

**Trois appariements, tous mesurés dans la même exécution JS que la mesure qu'ils servent :**

| cadrage / masque | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| **intérieur**, surface seule | 194 591 px | **194 597 px** | 0,8793 | **+0,003 08 %** |
| **bloc entier** (tuiles + nappe + parois) | 214 655 px | **214 659 px** | 0,9804 | **+0,001 86 %** |
| **côte** (surface + nappe, sans parois) | 129 430 px | **129 408 px** | 1,2699 | **−0,017 %** |

➡️ **325 fois, 538 fois et 59 fois mieux que le 1 % demandé.** Le meilleur est au niveau de P6
(+0,0024 %) et de notation-01 (+0,0032 %).

- La fraction est comptée **en CACHANT le bloc et en comptant ce qui change** — jamais l'alpha
  (`getClearAlpha()` vaut 1).
- Le balayage tourne sur un **CLONE** de la caméra du socle, que l'application ne voit jamais.
  **Deux mesures du même `k` rendent le même compte au pixel** (196 668 puis 196 668 ;
  220 969 puis 220 969).
- ⚡ **L'appariement intérieur se reproduit à l'identique sur DEUX chargements séparés** :
  `k = 0,8793` rend **194 597** les deux fois, contre une cible de **194 591** les deux fois.

⚠️ **ET UNE INSTABILITÉ QUE JE DÉCLARE PARCE QU'ELLE M'A EU.** Entre deux évaluations
successives, le masque du crop a sauté **une fois** de 194 591 à 230 345 px (+18,4 %) puis y
est revenu, alors que la boucle était gelée et la caméra fixe. **Toute mesure appariée de ce
rapport est donc prise dans la MÊME exécution JS que son balayage**, et le compte y est
re-mesuré deux fois. Le seul chiffre qui a été balayé dans une exécution et mesuré dans une
autre est le témoin d'éclairage du §5-⑤ — **et c'est un témoin sur un seul côté, où
l'appariement n'entre pas.**

---

## 2. LA PREUVE DE TÉMOIN NUL

Sur **3 072 000 canaux** (1 024 000 px × 3), deux prises consécutives du même état :

| témoin | canaux différents |
|---|---|
| crop, cadrage intérieur | **0** |
| crop, cadrage côte | **0** |
| crop, après re-chargement de la page | **0** |
| aller-retour de la couleur des parois | **0** |
| aller-retour de l'éclairage des tuiles | **0** |
| aller-retour des réglages de la lame d'eau | **0** |
| aller-retour des lumières du socle | mesures **identiques champ par champ** |

**Et ce zéro n'est pas un banc vide** : cacher le bloc change **194 591**, **214 655** et
**129 412** px selon le masque. Le chemin est le rendu de la scène seule dans une **cible à
profondeur** (⚠️ le canevas de la page a `depth: false`), **sans compositeur, donc sans le
grain de pellicule animé**, **boucle rAF coupée** (⚠️ la mer est animée).

⚠️ **Un piège de plus, rencontré et déclaré** : le volet du navigateur n'étant pas affiché, la
page ouvre à `innerWidth = 0`, `camera.aspect = null` et **`veilleCrop.refus` à quatre
maillons**. Rendue à 1 280 × 800 et rechargée, tout revient (`refus = []`). **Un noteur qui
n'aurait pas regardé aurait noté un écran vide.** Et à la côte, geler trop tôt m'a rendu
`refus = ['fond','parois','rampe','mer']` : **j'ai rechargé et attendu que la chaîne pose avant
de geler.**

---

## 3. LES SIX NOTES — LES MÊMES CRITÈRES, LES MÊMES MESURES

### ① Richesse du relief — **6 → 6 / 10** *(inchangé)*

**Mesure**, cadrage intérieur, masques appariés à **+0,003 08 %** :

| | crop | socle | | notation-01 |
|---|---|---|---|---|
| énergie de détail | **9,780** | **14,883** | crop = **65,7 %** du socle | crop = **71,0 %** (11,661 / 16,435) |
| écart-type de luminance | 48,338 | 52,062 | socle **+7,7 %** | socle **+12,6 %** |
| luminance moyenne | 102,89 | 113,24 | socle +10,1 % | socle +9,0 % |

➡️ **Le rapport d'énergie ne s'est pas amélioré : 71,0 % → 65,7 %.** Mon bloc est 10 % plus
petit à l'écran que le sien (194 591 px contre 216 061), ce qui joue contre moi de quelques
points ; **je ne réclame donc pas une régression, je constate qu'il n'y a pas de progrès
mesurable sur ce critère.** L'écart-type de luminance, lui, s'est resserré (12,6 % → 7,7 %).

⚡ **ET J'AI LA CAUSE, MESURÉE DES DEUX CÔTÉS DANS LA MÊME PAGE, retour exact :**

| expérience | énergie avant | énergie après | chute |
|---|---|---|---|
| **socle, soleil coupé** | 14,830 | 8,099 | **−45,39 %** *(notation-01 : −43,3 %)* |
| **crop, `uEclairageOn = 0`** | 9,780 | 9,367 | **−4,22 %** |

➡️ ⚡ **LA CORRECTION LA PLUS UTILE DE CETTE NOTE.** notation-01 écrivait : *« l'hémisphère
fabrique la couleur ; le soleil fabrique le relief. Le crop n'a ni l'un ni l'autre. »*
**Il a maintenant la moitié COULEUR et pas la moitié RELIEF** : couper sa lumière lui retire
**98 % de sa richesse de teinte** (5,10 % → 0,10 % hors orange) et **97 % de ses neutres**
(32,23 % → 1,00 %) **mais seulement 4,2 % de son modelé**. Sur le socle, le soleil en fabrique
**45 %**. **Le terme d'éclairage est branché ; ce qu'il éclaire n'a pas le relief du socle.**

### ② Palette et contraste — **3 → 7 / 10** *(le plus gros gain, et de loin)*

Histogramme de teinte en 12 secteurs de 30°, mêmes masques appariés :

| | crop | socle | | notation-01 |
|---|---|---|---|---|
| pixels **hors** de la bande orange | **9 929** (5,10 %) | **21 817** (11,21 %) | socle **×2,20** | socle **×65** |
| **secteurs de teinte à ZÉRO sur le crop** | **2** | 2 | égalité | **6** contre 0 |
| pixels quasi neutres (sat < 0,10) | **32,23 %** | 24,84 % | ⚡ **le crop en a PLUS** | socle **×5,7** |
| écart-type de saturation | 0,1589 | 0,1782 | socle **+12,1 %** | socle **+30,6 %** |
| saturation moyenne | 0,1697 | 0,2050 | socle +20,8 % | crop +2,8 % |

➡️ **Le crop n'est plus monochrome.** notation-01 écrivait : *« six secteurs sur douze sont à
ZÉRO PIXEL sur le crop… toute son image tient dans deux secteurs de teinte. »* Il en a
aujourd'hui **dix sur douze occupés, comme le socle**, et le facteur hors-orange tombe de
**×65 à ×2,20**. Le déficit de neutres (×5,7) est non seulement comblé, il est **inversé**.

⚠️ **Ce qui reste, et je le nomme** : le socle garde **+20,8 % de saturation** et **×2,20 de
masse hors orange**, et ça se voit — sur `E4-zoom-SOCLE-arete-N02.png` le relief est olive et
vert, sur `E3-zoom-CROP-arete-N02.png` il est brun-rosé. **Le crop a la bonne loi de lumière
mais pas encore toute la peinture.**

⚠️ **Et la borne du §0.4 mord ici** : ×65 et ×2,20 sont deux rapports mesurés dans deux pages
dont la palette diffère. **Le sens et l'ordre de grandeur du progrès ne font aucun doute ; le
facteur exact « ×30 de mieux » n'est pas une grandeur que je défends.**

### ③ Trait et bordure — **3 → 5 / 10**

**La correction de justice de notation-01 tient, je l'ai revérifiée** : `uContourOpacity` vaut
**0 des deux côtés**. Les courbes de niveau ne comptent pas contre le crop.

**Ce qui a été réparé, et je l'ai regardé sur ma propre découpe :**

- ⚡ **Le débordement de la nappe par-dessus la paroi a DISPARU côté terre.** Sur
  `E3-zoom-CROP-arete-N02.png` (×3), la surface rencontre la paroi le long d'**une seule arête
  franche** — c'est exactement ce que notation-01 reprochait à `zoom-CROP-base.png` (« deux
  arêtes au lieu d'une, et un porte-à-faux »).
- **La forme du bloc est celle du socle** : `uCropCoin = 0,08` contre `uSlabCorner/uSlabHalf =
  2,24 / 28 = 0,08`, et `uCropCoinN = 4,4` contre `4,4`. Le carré à angles vifs de
  `DUO-CROP-interieur.png` est devenu le squircle du socle.

**Ce qui casse la note :**

- ⛔ **Côté MER, l'arête est pire que jamais** : la nappe déborde sur la paroi sur
  **41 949 px** contre **428 px** au socle — **×98** (`M-nappe-contre-paroi-N02.json`). Voir ④
  et ⑥.
- ⛔ **La frange côtière est QUANTIFIÉE EN MARCHES.** `L3-zoom-CROP-frange-N02.png` contre
  `L4-zoom-SOCLE-frange-N02.png`, même échelle : le liseré du crop est un escalier de blocs
  carrés le long du trait de côte ; celui du socle est un fil fin et continu.
- ⚠️ **`contourInterval` reste dans la mauvaise monnaie** : crop **200 m**, socle **0,29**
  (unités de scène). **Invisible aujourd'hui, faux dès qu'on allume les courbes** — le
  non-fermé n° 3 de P6, confirmé au relevé.

### ④ La mer — **2 → 5 / 10**

⚠️ **LE DÉNOMINATEUR D'ABORD, parce que ce chantier s'y est fait prendre trois fois.** Le
masque de mer du socle fait **48 306 px**, celui du crop **69 911** : deux étendues
différentes. **Les chiffres qui comptent sont sur leur INTERSECTION — 45 418 px**, soit 65,0 %
du masque du crop et 94,0 % de celui du socle.

| sur l'intersection des deux masques de mer | crop | socle | |
|---|---|---|---|
| écume (L > 200, sat < 0,25) | **0,000 %** | 0,002 % | ⚡ **le défaut n° 3 de notation-01 est fermé** |
| luminance moyenne | **90,20** | **55,22** | ⛔ crop **+63,4 %** |
| saturation moyenne | 0,4655 | 0,5096 | socle **+9,5 %** *(notation-01 : +40,6 %)* |
| teinte 210–240° (bleu profond) | ⛔ **0** | **7 375** | le crop n'a **aucun** bleu profond |
| ⛔ énergie de détail | **2,583** | **3,823** | socle **×1,48** |
| ⛔ écart horizontal moyen | **1,759** | **3,479** | socle **×1,98** |
| concentration de luminance (16 valeurs) | 45,91 % | 44,96 % | crop **+0,95 point** |

**Et sur le masque du BLOC apparié** (la mesure de notation-01, composition différente,
donc à lire avec prudence) :

| | crop | socle | | notation-01 |
|---|---|---|---|---|
| écume | **5 822** (4,50 %) | 1 634 (1,26 %) | crop **×3,56** | crop **×7,74** |
| luminance moyenne | 105,68 | 67,19 | crop **+57,3 %** | crop **+42,0 %** |
| saturation moyenne | 0,3982 | 0,5160 | socle **+29,6 %** | socle **+40,6 %** |

➡️ **Trois choses sont réparées et deux ne le sont pas.**
Réparées : **l'écume n'est plus 7,7 fois trop étendue** (elle est à zéro sur les pixels
communs) ; **la nappe n'est plus « en plaques »** ; **l'excès de concentration de luminance,
que P5 mesurait à +50,64 points et P6 à +18,25, tombe à +0,95 point chez moi.**
Pas réparées : **la mer du crop est 63,4 % trop claire, elle n'a AUCUN pixel de bleu profond
là où le socle en a 16,2 %, et son détail local vaut la moitié** (×1,48 en énergie, ×1,98 en
marche horizontale). Regardez `L3` contre `L4` : le socle porte un moutonnement fin et des
ravines sous-marines, le crop est lisse.

⚠️ **P6 annonçait « 2,5 à 2,9 fois plus faible ». Je mesure 1,48 à 1,98 fois.** Ce n'est pas
la même page ni le même lieu que lui — **je ne dis pas qu'il s'est trompé, je dis que sur MON
cadrage l'écart est plus petit que celui qu'il a publié, et qu'il reste réel.**

### ⑤ Les parois et la base — **2 → 5 / 10**

⚡ **LE MANQUE N° 2 DE NOTATION-01 EST FERMÉ, ET JE LE PROUVE EN LE BOUGEANT** (parce qu'une
concordance au défaut n'est pas un branchement — la leçon de P6) :

| | avant | **pendant le témoin** | après |
|---|---|---|---|
| `plinth.wallMat.color` (socle) | `#c06a44` | **`#c81e1e`** | `#c06a44` |
| `uParoiCouleur` (crop) | `#c06a44` | ⚡ **`#c81e1e`** | `#c06a44` |
| `_parois.material.uniforms.uCol` | `#c06a44` | ⚡ **`#c81e1e`** | `#c06a44` |

**203 333 canaux changent, l'aller-retour rend 0.** La paroi du crop ne lit plus
`params.plinthColor` figé à la construction : **elle suit la couleur VIVANTE de la paroi du
socle.** (`H-temoin-parois-N02.json`)

⛔ **CE QUI N'EST PAS FERMÉ, ET P6 DISAIT NE PAS L'AVOIR MESURÉ — JE LE MESURE**
(`D-parois-N02.json`, masques de parois seules par extinction, `k = 0,9804`) :

| | crop | socle | |
|---|---|---|---|
| face sombre (p20 de luminance) | **26,63** | **15,88** | ⛔ le crop est **1,68 fois trop clair** |
| face claire (p80) | 53,47 | 48,36 | +10,6 % |
| **contraste entre les deux faces** (p80/p20) | **2,008** | **3,045** | ⛔ **1,52 fois trop faible** |
| profil de la face | dégradé (p10 25,21 → p50 29,84) | **deux valeurs plates** (p10 = p20 = p50 = 15,88) | |

➡️ **La réserve n° 3 de P6 est levée : l'écart d'exposition vaut 1,68 sur la face à l'ombre et
1,52 sur le contraste inter-faces.** Le socle rend **deux aplats francs** ; le crop rend deux
faces trop proches l'une de l'autre.

**Et il manque toujours la matière** : sur `E4-zoom-SOCLE-arete-N02.png` on voit **un fin
liseré lumineux le long de l'arête basse** — le chanfrein du socle. Sur
`E3-zoom-CROP-arete-N02.png`, **rien** : la paroi est un aplat.

⚠️ **L'OMBRE PORTÉE N'EST PAS NOTABLE AUJOURD'HUI, ET JE REFUSE DE COMPTER 0 CONTRE 26 729.**
Relevé dans la page vivante : **`params.shadowMode = 'off'`**, **`sun.castShadow = false`**,
**aucun receveur d'ombre visible** sous `?terre=unique` (`receiveShadow` ne vit que dans le
groupe `plinth`). Mesuré : **silhouette + ombre = silhouette, des DEUX côtés, à 0 px près.**
Témoin : `shadowMode` poussé à `dynamic`, `castShadow` à `true`, `ground-info` rallumé, carte
d'ombres forcée, matériaux recompilés → **toujours 0 px, retour exact.** ➡️ **L'état de page de
notation-01 avait l'ombre allumée, le mien ne l'a pas. C'est la même correction de justice que
ses courbes de niveau, et elle joue en faveur du crop.** Le poste reste dans la liste du §5.

### ⑥ Propreté — **3 → 3 / 10** *(inchangé, et maintenant chiffré)*

**Le banc est propre** (§2). **L'image ne l'est pas**, et je remplace le comptage à l'œil de
notation-01 par une mesure (`F-jupes-N02.json`, `M-nappe-contre-paroi-N02.json`) :

| | crop | socle | |
|---|---|---|---|
| pixels de tuiles **sous** le bas de la paroi | **2 186** | **3** | **×729** |
| **langues distinctes** | **12** | 1 (un liseré d'antialiasing) | notation-01 en comptait « au moins six » à l'œil |
| pixels de nappe **dans la bande de la paroi** (le tablier) | **41 949** | **428** | **×98** |
| lames de mer pendantes, comptées sur `L1` | **4** | 0 | notation-01 en comptait **4** |

**Ce qui s'est amélioré** : la bande d'écume « quantifiée en plaques à bords durs » a disparu
(§④). **Ce qui n'a pas bougé** : les jupes. `E1-zoom-CROP-base-N02.png` montre cinq langues
pâles qui pendent dans le vide sur une seule découpe de 320 × 200.

⚠️ **Je ne note toujours PAS le clignotement** : toutes mes prises sont **au repos**, boucle
gelée. Je n'ai aucune donnée sur le battement en mouvement. **Même réserve que notation-01, et
je préfère la répéter que d'inventer une note.**

---

## 4. LA NOTE GLOBALE — **5,3 / 10, contre 3,5 / 10**

**Même pondération que notation-01**, le relief comptant double parce que c'est la plus grande
surface de l'image :

| critère | note 01 | **note 02** | écart | la mesure qui le justifie |
|---|---|---|---|---|
| ① Richesse du relief | 6 | **6** | **=** | énergie 65,7 % du socle contre 71,0 % ; sa lumière ne fabrique que **4,2 %** du modelé (socle : **45,4 %**) |
| ② Palette et contraste | 3 | **7** | **+4** | hors-orange **×65 → ×2,20** ; secteurs vides **6 → 2** ; neutres ×5,7 en défaut → **excédent** |
| ③ Trait et bordure | 3 | **5** | **+2** | le débordement terre a disparu (une seule arête) ; forme = squircle du socle ; mais frange en marches et nappe qui déborde ×98 |
| ④ La mer | 2 | **5** | **+3** | écume **×7,74 → 0** ; saturation **+40,6 % → +9,5 %** ; mais **+63,4 %** de luminance, **0** pixel de bleu profond, détail **×1,48–1,98** |
| ⑤ Les parois et la base | 2 | **5** | **+3** | couleur juste **et prouvée en la bougeant** ; mais face sombre **×1,68** trop claire, contraste **×1,52** trop faible, pas de chanfrein |
| ⑥ Propreté | 3 | **3** | **=** | plaques d'écume parties ; **12 langues / 2 186 px** de jupes contre 3 px, tablier de mer **×98** |

`(6×2 + 7 + 5 + 5 + 5 + 3) / 7 = 5,29` → **5,3 / 10**. Moyenne simple : **5,2**.

**⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE**, et il faut regarder
`J1-CROP-cote-N02.png` à côté de `J2-SOCLE-cote-apparie-N02.png` pour le voir en une seconde :
le socle est un objet posé, à mer profonde et arête unique ; le crop est un bloc dont la mer
déborde par-dessus le mur et pend en lames.

**⚠️ MAIS LE PROGRÈS EST RÉEL ET IL EST MESURÉ.** Les cinq tâches ont fermé, chiffres à
l'appui, trois des cinq manques de notation-01 : **la couleur des parois** (prouvée en la
bougeant), **l'éclairage** (branché, il fabrique toute la couleur du crop) et **l'écume**
(de 7,7 fois trop à zéro). **+1,8 point.**

---

## 5. ⚡ CE QUI MANQUE LE PLUS — LA LISTE ORDONNÉE

Rangée par **écart visuel mesuré**, pas par facilité.

### 1️⃣ LA NAPPE DE MER QUI DÉBORDE LA PAROI, ET LES JUPES — *le dominant, inchangé depuis notation-01*

**C'est ce qui saute aux yeux sur ma capture, et c'est mesuré :** la nappe occupe **41 949 px
dans la bande verticale de la paroi** contre **428 px** au socle (**×98**), avec **4 lames
bleu-vert qui pendent dans le vide** ; et les tuiles ajoutent **2 186 px en 12 langues
distinctes** sous le bas du mur, contre **3 px** au socle.
Sur `P1-zoom6-CROP-nappe-paroi-N02.png` (×6) la nappe forme **un tablier pâle à bord festonné
qui passe derrière la paroi** ; sur `P2-zoom6-SOCLE-nappe-paroi-N02.png`, **une seule arête
nette, un fil cyan, rien qui pend.**

⚠️ **UNE NUANCE CONTRE LE CHANTIER, ET JE LA DIS.** P5 et P6 nomment ce dominant « le flanc
EST en ESCALIER, la mer y descend en GRADINS ». **À MON cadrage (celui de notation-01), ce
n'est pas un escalier** : le bord du tablier est **lobé et arrondi**, pas en marches. **Je n'ai
pas rejoué LEUR cadrage (−21,26 / 55,74), je ne réfute donc pas leurs gradins — je constate que
le défaut dominant, ici, est un porte-à-faux, pas un escalier.** *(L'escalier, lui, je le
trouve ailleurs : dans la frange côtière, poste n° 4.)*

**Où ça vit** : `poserMer` (`globe.js`, maillage `crop-mer`) face à `construireParoisCrop` et
à l'anneau haut de la paroi ; les jupes de tuiles dans `_buildMesh` (`globe.js:4127-4162`,
`skirtDrop` borné par `JUPE_MAX`, l. 473).
**Ce que ça coûte** : **cher** pour la nappe — un accord de géométrie à trois (plan de mer,
surface du crop, haut de paroi), pas un réglage. **Faible à moyen** pour les jupes : les couper
à l'intérieur du crop, où les tuiles sont jointives et où elles ne servent à rien.

### 2️⃣ LE DÉTAIL ET LA PROFONDEUR DE LA MER — *mesuré, et une cause nouvelle*

Sur l'intersection des deux masques : énergie **2,583 contre 3,823** (socle ×1,48), écart
horizontal **1,759 contre 3,479** (socle ×1,98). **Et une mesure que personne n'avait
faite : le crop n'a AUCUN pixel dans le secteur 210–240°**, là où le socle en a **7 375
(16,2 %)** — **il n'a pas de bleu profond du tout**, et sa mer est **63,4 % trop claire.**

**Trois causes nommées par P6 restent ouvertes** (réfraction `uRefract = 0,34` — le crop n'a
aucune passe de capture ; caustiques `uCaustics` ; résolution du champ), **et j'en ajoute une
quatrième, plus simple et probablement moins chère** : *le bleu profond manque en TEINTE, pas
en détail.* Une passe de réfraction n'ajoutera pas un secteur de teinte absent. ⚠️ **Je n'ai
pas identifié quel terme écrase le fond, et je ne l'invente pas** : le relevé est
`K-mer-intersection-N02.json`, la question est « d'où vient le plancher de luminance ».
**Ce que ça coûte** : la teinte, **faible à moyen** (une loi de profondeur à confronter) ; la
réfraction, **cher** ; les caustiques, **moyen** (la fonction d'`ocean.js` est portable).

### 3️⃣ LA MATIÈRE ET LE RELIEF DES PAROIS — *la couleur est juste, l'exposition et la matière non*

**Chiffré ici pour la première fois** : face sombre **26,63 contre 15,88** (le crop est
**1,68 fois trop clair**), contraste inter-faces **2,008 contre 3,045** (**1,52 fois trop
faible**). Le socle rend **deux aplats plats** ; le crop, deux faces trop proches. Et il n'a
**ni chanfrein haut ni arrondi bas** (`SOCLE_CHANFREIN`, `SOCLE_ARRONDI` dans `plinth.js`),
ni aucune des **50 vignettes de matière** (verre, givre, SSS).

**Où ça vit** : `_materiauParois` (`globe.js`) et son terme d'irradiance repris de
`eclairage-crop.js` ; `parois-crop.js` §4 dit déjà lesquelles des douze options passent.
**Ce que ça coûte** : **faible** pour l'exposition — un facteur à re-dériver contre les deux
aplats du socle, qui sont **deux constantes mesurables** (15,88 et 48,36). **Moyen** pour le
chanfrein et l'arrondi. **Cher et non prioritaire** pour les 50 matières.

### 4️⃣ LA FRANGE CÔTIÈRE QUANTIFIÉE EN MARCHES — *le vrai « escalier », et il est ailleurs qu'annoncé*

`L3-zoom-CROP-frange-N02.png` contre `L4-zoom-SOCLE-frange-N02.png`, même échelle, même
seconde : le liseré du crop est **une suite de blocs carrés** le long du trait de côte ; celui
du socle est **un fil fin qui épouse la côte**. C'est **la résolution du champ** — la réserve
n° 4 de P5 et le troisième point du non-fermé n° 2 de P6 — **mais elle se voit sur la FRANGE,
pas sur le fond marin**, et c'est un endroit où elle est bien plus visible.

**Où ça vit** : le champ cuit vers `globe.js:3120-3128` (129 nœuds en travers du bloc contre
1 536 px de MNT) et le déclin côtier normalisé qui en dépend.
**Ce que ça coûte** : tripler `CHAMP_FOND` coûte neuf fois `remplirHauteurs` — **cher**.
⚡ **Mais le trait de côte, lui, a déjà un masque à la résolution du MNT (`uCoastMask`,
`uMargeCoteM`)** : faire porter la frange par CE masque plutôt que par le champ serait
**moyen**, et fermerait le poste sans payer les neuf fois.

### 5️⃣ LE DERNIER TIERS DE LA RICHESSE DU RELIEF — *et la lumière n'est PLUS la réponse*

Le crop rend **65,7 %** de l'énergie de détail du socle. ⛔ **Et le levier que notation-01
désignait est désormais tiré sans effet** : couper l'éclairage du crop ne lui coûte que
**4,22 %** de son modelé, quand couper le soleil du socle lui en coûte **45,39 %**. **Le crop
est éclairé et reste plat.** Ce qui reste est donc dans ce que la lumière éclaire : normales,
grain de relief, texture d'analyse.

**Où ça vit** : `poserHabillage` porte **`grainForceM` et `grainEchelle` ; `contexteCrop` ne
les passe pas** — le non-fermé n° 6 de P6, dont le commentaire assume : *« rien dans les
réglages du socle ne s'y traduit en mètres de relief sans une mesure qu'on n'a pas faite »*.
`params.detailScale = 0,8` vit côté socle.
**Ce que ça coûte** : **moyen**, et ⚠️ **la mesure de conversion manquante est le vrai
travail**, pas le branchement.

### Et derrière, dans l'ordre

6️⃣ **L'ombre portée** — ⚠️ **non notable aujourd'hui** (`shadowMode = 'off'`, `castShadow =
false`, aucun receveur visible : **0 px des deux côtés**) ; `passeFond.skipShadowMapUpdate =
true` dit que ce n'était pas prévu. **À rouvrir dans un état de page où le socle, lui, porte
son ombre.**
7️⃣ **`contourInterval` dans la mauvaise monnaie** (crop 200 m, socle 0,29) — invisible tant que
`uContourOpacity = 0`, **faux dès qu'on allume les courbes**.
8️⃣ **La grille métrique du socle** (`gridStep`, `gridColor`, `gridOpacity`) — non portée ;
invisible tant que `gridOpacity = 0`.
9️⃣ **Le cartouche au sol, les effets de surface, le scanner** — non portés du tout, et
je ne les ai pas mesurés : **ils n'apparaissent sur aucune de mes captures, des deux côtés.**

---

## 6. MES RÉSERVES

1. ⚠️ **LES VALEURS ABSOLUES DE COULEUR DES DEUX NOTES NE SE COMPARENT PAS** (§0.4) : mon socle
   rend saturation 0,205 et 24,84 % de neutres, le sien 0,4536 et 7,44 %. **Seuls les écarts
   crop ↔ socle mesurés dans une même page se comparent**, et c'est ainsi que le §4 est écrit.
   La conséquence pratique : le « ×65 → ×2,20 » du critère ② est **un progrès certain dont le
   facteur exact n'est pas défendable**.
2. ⚠️ **UN SEUL LIEU, DEUX CADRAGES.** Tout est sur La Réunion, aux deux endroits de
   notation-01. **Je n'ai pas rejoué le cadrage de P5 et P6** (−21,26 / 55,74) : leur « flanc en
   escalier » n'est donc ni confirmé ni réfuté à leur endroit. Un crop continental ou de haute
   latitude n'est pas jugé ici.
3. ⚠️ **TOUT EST AU REPOS, BOUCLE GELÉE.** Aucune donnée sur le clignotement, le battement des
   alentours ou les coutures en mouvement. Le critère ⑥ ne note que les défauts statiques.
4. ⚠️ **PAS DE COMPOSITEUR.** Il s'applique identiquement aux deux (`composer.addPass(passeFond,
   0)` met `sceneGlobe` dans le même compositeur), donc il ne biaise pas la comparaison, **mais
   mes images ne sont pas exactement celles qu'Adrien voit.**
5. ⛔ **UN SAUT DE MASQUE NON EXPLIQUÉ.** Une fois, boucle gelée et caméra fixe, le masque du
   crop est passé de 194 591 à 230 345 px puis y est revenu. **Je n'en connais pas la cause.**
   Toutes les mesures appariées sont donc prises dans la même exécution JS que leur balayage.
6. ⛔ **MON PROPRE TÉMOIN A ABÎMÉ L'ÉTAT UNE FOIS, ET JE LE DIS.** Un premier essai de témoin sur
   la lame d'eau appelait `poserMer(contexteCrop().mer)` — qui **ne porte pas** les réglages de
   look — et a fait tomber `uMerTransp` de 0,57 à 0,40 **sans le restaurer**. **Aucune mesure de
   ce rapport n'a été prise dans cet état** (toutes les mesures de mer le précèdent), et
   `majReglagesMer` l'a réparé. Le relevé fautif reste sur le disque
   (`N-temoin-lakeColor-N02.json`) plutôt que d'être effacé.
7. ⚠️ **UN TÉMOIN NON CONCLUANT, GARDÉ COMME TEL.** `params.lakeColor` poussé à `#c81e1e` n'a
   rien bougé **des deux côtés** : avec la boucle gelée, l'applicateur de palette de
   l'application ne tourne pas. **Ce n'est pas une preuve d'absence de branchement.** Le témoin
   qui conclut est le suivant : uniformes VIVANTS du socle déplacés (`uTransp` 0,57 → 0,13,
   `uShallowT` → `#c81e1e`) **puis `majReglagesMer`, le chemin de `main.js:11998`** → le crop
   suit à `0,13` et `#c81e1e`, **208 403 canaux changent, retour à 0.** *(La lame d'eau est donc
   branchée, et prouvée en la bougeant.)*
8. ⚠️ **JE N'AI PAS MESURÉ « le crop d'avant les cinq tâches ».** Comme P6, je n'ai que les
   chiffres publiés de notation-01, sous la borne du point 1.

---

## 7. CE QUI RESTE SUR LE DISQUE

`.banc/vues-notation-02/` — **25 captures PNG**, **17 relevés JSON**, le harnais
(`harnais-N02.mjs`, qui importe `../harnais-P5.mjs`) et le récepteur (`recois-N02.mjs`,
port 5607). `Z-bilan-notation-02.json` rassemble le protocole, la calibration et les
appariements.

**Les paires à regarder d'abord :**

- `A1-CROP-interieur-N02.png` ↔ `A2-SOCLE-interieur-apparie-N02.png` (**+0,003 08 %**)
- `C1-CROP-bloc-entier-N02.png` ↔ `C2-SOCLE-bloc-entier-apparie-N02.png` (**+0,001 86 %**) —
  **les parois terracotta du crop, et les jupes qui dépassent**
- `J1-CROP-cote-N02.png` ↔ `J2-SOCLE-cote-apparie-N02.png` (**−0,017 %**) — **le dominant**
- `P1-zoom6-CROP-nappe-paroi-N02.png` ↔ `P2-zoom6-SOCLE-nappe-paroi-N02.png` (×6) — le tablier
  et les lames pendantes contre l'arête unique
- `L3-zoom-CROP-frange-N02.png` ↔ `L4-zoom-SOCLE-frange-N02.png` — **la frange en marches**
- `E3-zoom-CROP-arete-N02.png` ↔ `E4-zoom-SOCLE-arete-N02.png` — l'arête réparée, le chanfrein
  manquant
- `CAL-SOCLE-interieur-LINEAIRE.png` ↔ `CAL-SOCLE-interieur-ACES.png` — **la calibration du
  look, en une image**
