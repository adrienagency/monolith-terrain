# NOTATION 05 — le crop face au socle d'avant la sphère, après treize tâches

**Agent noteur · 2026-08-23 · `C:\Dev\wt-merge`, branche `regroupement`,
HEAD `536f7a68d2fbaf050eade45768f1810dc90994d5`**
(« tache P13 : deux survivantes de plus, et la marge d eau du socle n etait
gardee par rien »), **arbre propre AVANT et APRÈS** (`git status --porcelain`
vide aux deux bouts), **aucune source touchée**.

> ⚠️ **C'EST CET ÉTAT-LÀ QUI EST NOTÉ.** `536f7a6` est le dernier commit de la
> Tâche P13. Si un implémenteur committe par-dessus pendant que vous lisez,
> cette note ne juge pas son travail.

**Toutes les captures et tous les chiffres de ce rapport sont les miens**, pris
ce jour, et laissés dans **`.banc/vues-notation-05/`** (**45 captures PNG**,
**11 relevés JSON**, le récepteur, le marqueur de serveur, les journaux de
chaque exécution, et **les quatre scripts que j'ajoute**). Cadre
**1 280 × 800 = 1 024 000 px**, La Réunion, z12, vue isométrique 0, rendu dans
une **cible à profondeur**, **sans compositeur**, **boucle rAF gelée**, **socle
rallumé dans la MÊME page**.

**Note globale : 7,3 / 10**, contre **6,7** (note 04), **6,6** (03), **5,3**
(02) et **3,5** (01).

⚡ **ET LE +0,6 CACHE, LUI AUSSI, DEUX MOUVEMENTS DE SENS CONTRAIRE.** P12 a
fermé le poste n° 1 de la note 04 (l'exposition) et rendu les deux tiers du
poste n° 2 (le grain du fond marin) : **quatre critères montent**. P13 a livré
le poste n° 5 — le chanfrein, **le seul manque inchangé depuis la note 01** —
et **a ouvert la plus grosse plaie visible de cette note** : ⛔ **vingt-trois
traînées pâles sur le mur, contre sept avant elle et quatre au socle, mesurées
dans la MÊME page à la MÊME seconde.** Le critère ⑥ perd deux points.

**Les trois aveux de P13 sont au §7, le verdict sur « poste 2 = poste 4 » au
§8, la liste ordonnée au §9, et la question d'Adrien — ce qui est rattrapable
et ce qui ne l'est pas — au §10.**

---

## 0. CE QUE J'AI RÉGLÉ AVANT DE POUVOIR NOTER

### 0.1 ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est celle des notes 02,
03 et 04, de P7 à P13. **Et je ne la déclare pas seulement, je la prouve en
retrouvant des constantes que je n'ai pas choisies**, relevées dans ma page :

| témoin | moi | l'attendu du chantier |
|---|---|---|
| `heightContrast / heightPivot`, cadrage intérieur | **2,2 / 0,41** | preuve de lieu de la note 02 |
| `heightContrast / heightPivot`, cadrage côte | **2,5 / 0,58** | idem |
| sommets de `terrain.mesh` | **594 434** | notes 01 à 04, P10 à P12 |
| rampe et texture d'analyse | **même objet `three`** | note 03 §0.2 |
| `uSoleilIrr` du crop | 3,755 610 283 463 997 · 3,493 133 904 470 355 8 · 2,971 806 681 980 299 7 | ⚡ **identique** à N04 et P12 |
| soleil du socle | `#fff7e6`, intensité **3,755 610 283 463 997** | idem |
| hémisphérique du socle | ciel `#85c2eb` / sol `#4a3a2a`, **0,812 601 713 910 666 3** | idem |
| ⚖️ `uContourOpacity`, crop et socle | **0 / 0**, aux deux cadrages | la correction de justice |
| ⚖️ `params.shadowMode` | **`off`** | idem |

### 0.2 Le protocole, repris tel quel, et le banc n'est PAS réécrit

Sous `?terre=unique` le socle **est caché, pas détruit** (`main.js:4544`, la
liste « ce qui disparaît avec le socle ») : je le rallume dans la même page et
je rends les deux blocs **à la même seconde**.

⚡ **J'AI REJOUÉ LES SCRIPTS DES AUTRES SANS EN MODIFIER UNE LIGNE** :
`n1`, `n2`, `n3`, `n4`, `n5` et `n6` de `.banc/vues-notation-03/` (harnais
`harnais-N03.mjs` compris), **et `p1-chanfrein.js` et `p4-trainees.js` de
P13**, eux aussi intacts. Le pilote est celui de P9 (`.banc/P9/pilote-P9.mjs`),
réemployé tel quel. **Seul le récepteur change** (`recois-N05.mjs`, même port
5613, autre dossier), exactement comme P10, P11, N04, P12 et P13 l'ont fait.

⚠️ **CONSÉQUENCE À LIRE AVANT LES JSON** : les scripts du noteur portent
`head: 'ac58500'` **en dur** et ceux de P13 déposent des noms en `-P13`. Ces
champs sont LEURS étiquettes, pas la mienne. **Le HEAD réellement noté est
`536f7a6`**, vérifié par `git rev-parse` avant et après, et **prouvé sur le
serveur** : j'ai déposé `.banc/vues-notation-05/marqueur.txt` sur le disque et
l'ai relu par `http://localhost:5503/.banc/vues-notation-05/marqueur.txt` —
même contenu. `src/globe.js` servi et sur disque portent tous deux **6
occurrences** de `uReliefBas` (l'uniforme de P11) et
`src/monde/parois-crop.js` **3 occurrences** de `fractionChanfrein` (celui de
P13). **Le serveur sert bien CE worktree, avec le travail de P13 dedans.**

### 0.3 Les deux cadrages sont ceux des quatre notes précédentes

| cadrage | lieu | preuve | mer ? |
|---|---|---|---|
| **intérieur** | lat **−21,115** · lon **55,536** · z12 · iso 0 | `hc/hp = 2,2 / 0,41`, 245 tuiles, `refus: []` | ⛔ non |
| **côte** | lat **−21,05** · lon **55,25** · z12 · iso 0 | `hc/hp = 2,5 / 0,58`, 256 tuiles, `refus: []` | ⚡ oui |

---

## 1. LES PREUVES — APPARIEMENT, TÉMOIN NUL, MOUVEMENT

### 1.1 L'appariement, balayé sur un CLONE de caméra, DANS LA MÊME EXÉCUTION JS

`applyIsoView` dérive de `controls.maxDistance` : à caméra identique les deux
blocs n'occupent pas la même fraction du cadre (**×1,362 en aire** à la note 01).
**On balaie donc au lieu de supposer**, en deux passes (`apparier`, pas 0,005
puis 0,0005), en **cachant le bloc et en comptant ce qui change** — jamais
l'alpha (`getClearAlpha()` vaut 1).

| script / masque | cible (crop) | socle | `k` | **écart** |
|---|---|---|---|---|
| **N1** — surface seule, intérieur | 145 892 | **145 847** | 1,0055 | **−0,0308 %** |
| **N2** — bloc entier, intérieur | 207 157 | **207 128** | 0,9975 | ⚡ **−0,0140 %** |
| **V1** — bloc entier, intérieur *(le mien)* | 207 157 | **207 130** | 0,9975 | ⚡ **−0,0130 %** |
| **V2** — bloc entier, intérieur *(le mien)* | 207 157 | **207 128** | 0,9975 | **−0,0140 %** |
| **N4** — bloc entier, côte | 210 914 | **210 856** | 1,0005 | **−0,0275 %** |
| **N5** — bloc entier, côte | 210 915 | **210 854** | 1,0005 | **−0,0289 %** |
| **P1 de P13**, rejoué chez moi | 210 914 | **210 859** | 1,0005 | **−0,0261 %** |
| **V3** — bloc entier, côte, **état livré** *(le mien)* | 210 913 | **210 857** | 1,0005 | **−0,0266 %** |
| **V3** — bloc entier, côte, **arêtes vives rebâties** | 215 584 | **215 492** | 0,9900 | **−0,0427 %** |

➡️ **De 23 à 77 fois mieux que le 1 % demandé.** La cible re-mesurée après le
balayage rend le même compte au pixel (145 892 → 145 892 ; 207 157 → 207 157 ;
210 914 → 210 914), et deux mesures du même `k` rendent le même compte
(145 847 / 145 847).

⛔ **ET JE N'ATTEINS PAS LE +0,0007 % QU'ON M'ANNONCE, ET JE DIS POURQUOI.**
Ce chiffre est celui de la note 04 sur le masque de SURFACE au cadrage
intérieur, dont la cible valait alors **144 688 px**. **Elle vaut aujourd'hui
145 892 — +0,83 %, +1 204 px** — et ce n'est pas du bruit : N04 **et** P12
relèvent 144 688 au pixel près, et le saut tombe exactement sur P13. **C'est le
premier signe des jupes de tuiles qui sortent de derrière le mur rentré**
(§7.2). Mon meilleur appariement est **−0,0130 %**, mon pire **−0,0427 %** ;
tous sont sous 0,05 %.

### 1.2 Le témoin nul, et le temps de la mer immobile

Sur **4 096 000 canaux** (1 024 000 px × 4) :

| témoin | canaux différents |
|---|---|
| crop, cadrage intérieur, deux prises de suite (N1, V1, V2) | **0** à chaque fois |
| crop, cadrage côte, deux prises de suite (N4, N5, V3) | **0** à chaque fois |
| **après 10 rendus intercalés** (N6) | **0** |
| aller-retour de `uEclairageOn` · `uNormaleFineOn` · lumières du socle | **0 / 0 / 0** |
| aller-retour de la couleur VIVANTE des parois (186 331 canaux d'effet) | **0** |
| aller-retour de `setViewOffset`, dx = 0…3, des deux côtés | **0** dans les **24** séries |
| aller-retour de l'extinction des jupes par `setDrawRange` (V1, V2) | **0 / 0** |
| **rebâtissage des parois aux arêtes vives puis retour** (V2, V3) | ⚡ **0 / 0** |
| aller-retour du même rebâtissage dans `p1-chanfrein.js` de P13 | ⛔ **1 174** — §7.3 |

⚡ **ET LE TEMPS DE LA MER, RELEVÉ À CHAQUE PAS.** `uMerTemps` vaut
**2,699 999 999 999 998 4** aux deux relevés de N1, **2,799 999 999 999 998** aux
**quatre** relevés de l'aller-retour serré de N6 (`merImmobile: true`), et
**2,835 500 000 014 899 3** avant **et** après tout le A/B de V3. **Le
huitième piège du brief — `geler()` ne remplace que `requestAnimationFrame`,
`tick()` se réarme en `setTimeout` — est écarté par mesure, dans les exécutions
où il compte.**

**Et ce zéro n'est pas un banc vide** : cacher le bloc change 145 892, 207 157,
210 914 px selon le masque ; couper `uEclairageOn` déplace **617 905** canaux et
`uNormaleFineOn` **407 978** ; l'aller-retour serré de N6 en déplace **408 069** ;
le rebâtissage aux arêtes vives **45 355**.

### 1.3 ⚡ LA MESURE EN MOUVEMENT — ET LA PARITÉ N'EST PAS REVENUE

Décalage d'un nombre **entier** de pixels par `setViewOffset`, recalage
**cherché** de −3 à +3, masques érodés de 4 px (**crop 134 716 px, socle
136 343**). **Plancher à `dx = 0` : 0,000 des DEUX côtés. Le recalage tombe sur
le décalage demandé dans les 24 cas. Retour exact à 0 canal dans les 24
séries.**

**Cadrage intérieur, masque des tuiles, résidu moyen en octets de luminance :**

| décalage | **SOCLE** | **CROP, normale fine ON** | CROP OFF | | ⚡ état attendu | note 04 |
|---|---|---|---|---|---|---|
| **dx = 1 px** | **0,0286** | ⚡ **0,8250** | 0,8718 | | **≈ 0,8248** · socle **≈ 0,0287** | 0,8180 · 0,0321 |
| dx = 2 px | 0,0010 | **0,7921** | 0,8380 | | | 0,7798 · 0,0014 |
| **dx = 3 px** | **0,0287** | **0,8256** | 0,8728 | | | 0,8196 · 0,0324 |
| pixels instables à dx = 1 | **53** | ⚡ **10** | 7 | | | 11 · 66 |
| résidu maximal à dx = 1 | 51,11 | **14,29** | 13,44 | | | 72,68 · 15,08 |

➡️ ⚡ **L'ÉTAT ATTENDU EST RETROUVÉ À 0,02 % ET 0,3 % PRÈS.**
⚡ **AUCUNE SIGNATURE DE PARITÉ** : le micro-écart pair/impair du crop
(0,8250 · 0,7921 · 0,8256) est **exactement** celui de la colonne OFF
(0,8718 · 0,8380 · 0,8728) — c'est le plancher du RESTE du nuanceur, pas une
signature de maillage. **Le crop rend cinq fois moins de pixels instables que
le socle**, et son résidu reste **SOUS** son propre plancher sans normale fine.

**Et sur la mer, cadrage côte** (masques érodés crop 64 710, socle 64 493) :
`dx = 1` → socle **0,0077**, crop ON **0,3887**, OFF **0,3534** ; `dx = 2` →
**0,3916**, donc **plat, donc sans parité** ; **1 pixel instable contre 7 au
socle**. ⚠️ Le crop y reste **10 % au-dessus de sa propre colonne OFF** : c'est
le pas resserré de P12, qui l'a déclaré (sa réserve n° 6 en donne la borne).

⚠️ **CE QUE CETTE MESURE NE DIT TOUJOURS PAS** (réserve reprise telle quelle des
notes 03 et 04, de P12 et de P13) : c'est un **PROXY** et un **PLANCHER**. Une
translation rigide de la fenêtre de projection isole la parité des quads ; elle
ne contient **ni parallaxe, ni changement de LOD, ni houle**.

---

## 2. ① RICHESSE DU RELIEF — **6 → 6 → 8 → 8 → 9 / 10** *(+1)*

Cadrage intérieur, masques appariés à **−0,0308 %**, octet linéaire :

| | crop | socle | rapport | | note 04 | note 03 |
|---|---|---|---|---|---|---|
| **énergie de détail** | **18,095** | 16,073 | ⛔ **+12,58 %** | | ⛔ +16,32 % | −1,98 % |
| **écart-type de luminance** | **55,766** | 51,704 | **+7,86 %** | | ⛔ +15,41 % | +2,38 % |
| luminance moyenne | 109,057 | 113,592 | ⚡ **−3,99 %** | | +8,53 % | −10,4 % |
| **part de la lumière dans le modelé** | ⛔ **22,32 %** | **45,51 %** | ⛔ **s'éloigne** | | 25,75 / 45,91 | 19,93 / 45,53 |
| apport de la normale fine | **+43,44 %** | — | | | +39,08 % | +43,43 % |
| crénelage en escalier des crêtes | **absent** | — | fermé par P10 | | fermé | ⛔ présent |

⚡ **CE QUI FAIT MONTER LA NOTE, ET JE LE VOIS SUR MA PROPRE PAIRE.** Sur
`A1-CROP-interieur-N03.png` contre `A2-SOCLE-interieur-apparie-N03.png`, pris à
la même seconde : **les crêtes du crop ne brûlent plus.** C'est très exactement
le défaut que la note 04 facturait un point entier — « les blancs des crêtes
brûlent là où le socle garde du gris ». **Les deux dépassements qui le
portaient sont divisés par 1,3 et par 2** (énergie ×1,163 → **×1,126** ;
écart-type ×1,154 → **×1,079**), et la luminance moyenne a **changé de signe**
(+8,53 % → **−3,99 %**). Le crénelage reste fermé sur `B3-zoom6`. **Le 9 que la
note 03 annonçait « sans le crénelage » et que la note 04 refusait « à cause du
dépassement » est mérité aujourd'hui.**

⛔ **CE QUI L'EMPÊCHE D'ALLER PLUS HAUT, ET C'EST DEUX CHOSES.**

1. **L'énergie de détail reste à +12,58 %.** Le critère de sortie que la note 04
   avait posé — *« `energieDetail` ET `saturationSocleSurCrop` reviennent à 1,00
   ENSEMBLE »* — n'est **rempli qu'à moitié** : la saturation y est
   (**0,9702**), l'énergie non (**1,1258**). ⚡ **Et P12 dit où est le reste, par
   la mesure** : l'albédo NU du crop porte déjà **+6,15 %** d'énergie de plus que
   celui du socle, quand l'irradiance est juste à 0,35 % sur les normales du
   relief. **Ce qui reste n'est plus de la lumière, c'est la pente de rampe
   ×3,12 de P11.**
2. ⛔ **ET LE MÉCANISME S'EST ÉLOIGNÉ, PAS RAPPROCHÉ.** **22,32 % du modelé du
   crop vient de la lumière, contre 45,51 % au socle** — c'était 25,75 % à la
   note 04. **P12 a payé son accord d'exposition d'un demi-point de mécanisme :
   en baissant l'environnement, elle a réduit la part que la lumière prend dans
   le relief.** Le crop met encore plus son modelé dans la couleur qu'avant. **Ce
   n'est pas visible aujourd'hui, et ce sera le plafond de ce critère.**

---

## 3. ② PALETTE ET CONTRASTE — **3 → 7 → 7 → 8 → 9 / 10** *(+1)*

Histogramme de teinte en 12 secteurs de 30°, masques appariés à **−0,0308 %** :

| secteur | **crop** | **SOCLE** | rapport | | note 04 | note 03 |
|---|---|---|---|---|---|---|
| 0–30° rouge-orangé | **56 111** | 57 820 | ⚡ **0,970** | | 0,998 | 1,299 |
| 30–60° ocre | **34 013** | 35 194 | ⚡ **0,966** | | 0,958 | 0,354 |
| **60–90° olive** | **10 177** | 9 995 | ⚡ **1,018** | | 1,094 | ⛔ 0,285 |
| 90–120° vert | **4 258** | 4 238 | ⚡ **1,005** | | 1,273 | ⛔ 0,071 |
| **330–360° rosé** | 2 340 | 1 722 | ⛔ **1,359** | | 1,393 | ⛔ 2,540 |
| pixels quasi neutres | 26,23 % | 25,15 % | **+1,08 point** | | −0,81 pt | +9,26 pt |
| masse hors-orange | 12,00 % | 11,08 % | **+8,30 %** | | ⛔ +16,43 % | −49,4 % |
| **saturation moyenne** | **0,2080** | **0,2018** | ⚡ **+3,07 %** | | ⛔ +15,75 % | ⛔ −15,0 % |
| secteurs de teinte vides | **2** | 3 | égalité | | 2 / 3 | 2 / 3 |
| **distance de variation totale des teintes** | | | ⚡ **0,0146** | | 0,0287 | ⛔ 0,2903 |

*(La distance de variation totale est calculée par moi, à la même formule, sur
les cinq relevés `N1-…json` du chantier : 0,2903 à la note 03, 0,0287 à P11 et
à la note 04, 0,0160 à P12, **0,0146** ici. C'est la meilleure du chantier.)*

⚡ **LA RÉSERVE QUE LA NOTE 04 AVAIT ÉCRITE CONTRE ELLE-MÊME EST LEVÉE.** Elle
disait : *« Sur la saturation prise seule, P11 a raison contre elle-même :
l'amplitude n'a baissé que de 11 %, le signe a juste tourné. Si Adrien veut
noter la saturation seule, la tâche P11 n'a rien gagné sur ce point-là. »*
**P12 la ramène de +15,75 % à +3,07 % — l'amplitude est divisée par 5,1, et
cette fois sans contrepartie sur la teinte** (0,0287 → 0,0146, elle aussi
divisée par deux). Les quatre secteurs qui portent la masse sont maintenant à
**3,4 % / 3,4 % / 1,8 % / 0,5 %** du socle. ⚡ **Sur ce critère, l'écart entre le
crop et le socle a cessé d'être un écart de peinture.**

⛔ **CE QUI RESTE, ET J'EN FACTURE LE POINT MANQUANT.** Le **rosé à ×1,36** est
le dernier secteur franchement faux — il l'était déjà à ×1,39 à la note 04, il
n'a pas bougé, et personne ne l'a nommé. La masse hors-orange dépasse encore de
**8,3 %**, les neutres d'un point, et le crop est désormais **4,0 % trop
SOMBRE** — un signe neuf. ⚠️ **P12 en donne un suspect qu'elle refuse d'affirmer
faute d'avoir isolé le spéculaire du socle dans sa page** (P3 le mesure à 4,0 %
du pixel ; l'ordre de grandeur colle au signe et à l'amplitude). **Je ne l'ai
pas isolé non plus.**

---

## 4. ③ TRAIT ET BORDURE — **3 → 5 → 6 → 5 → 6 / 10** *(+1)*

⚖️ **LA CORRECTION DE JUSTICE TIENT, REVÉRIFIÉE DANS LA PAGE** :
`uContourOpacity` vaut **0 des deux côtés**, aux deux cadrages. Les courbes de
niveau ne comptent pas contre le crop.

### 4.1 La frange côtière — mieux que la note 04, moins bien que P12

| cadrage côte, sur l'intersection des masques de mer | crop | socle | | P12 | note 04 | note 03 |
|---|---|---|---|---|---|---|
| **longueur moyenne des paliers** | **2,069** | 1,674 | | ⚡ 1,837 / 1,670 | ⛔ 2,060 / 1,670 | 1,943 / 1,674 |
| **part des suites de 4 px et plus** | ⛔ **10,14 %** | **6,62 %** | excès **3,52 pt** | ⚡ 9,36 / 6,54 → 2,82 | ⛔ 13,57 / 6,45 → 7,12 | 11,10 / 6,58 → 4,52 |
| longueur maximale d'un palier | ⛔ **33** | 18 | | 17 / 12 | 15 / 15 | 11 / 19 |

⚡ **P12 A BIEN PAYÉ LES DEUX TIERS DE LA DETTE QU'ELLE ANNONCE** — l'excès sur
le socle passe de 7,12 points à 2,82, soit divisé par 2,5, exactement comme elle
l'écrit. ⛔ **MAIS P13 EN A REPRIS UN QUART, ET JE LE PROUVE DANS LA MÊME
PAGE** (§7.2). Vu sur `J1-zoom-CROP-frange-N03.png` contre `J2-…SOCLE-…`, même
échelle, même seconde : **le socle rend un lagon turquoise large, continu et
finement texturé, qui se dégrade doucement vers le bleu marine ; le crop rend un
sillon étroit et un trait de côte en marches**, plus courtes que celles de la
note 04, plus longues que celles de P12.

### 4.2 ⚡ LES ARÊTES DU BLOC — LE CHANFREIN EST LÀ, ET IL EST DU MAUVAIS CÔTÉ

Profil de luminance sous l'arête, normalisé par la médiane du mur, 728 colonnes.
**Je reproduis les chiffres de P13 à la troisième décimale, sur son script rejoué
sans une ligne modifiée.**

| depuis l'arête **HAUTE**, d = | 0 | 1 | 2 | 3 | **excès de la ligne de crête** |
|---|---|---|---|---|---|
| ⚡ **CROP, livré** | **1,5825** | 0,7661 | 0,7175 | 0,7046 | ⚡ **+58,25 %** |
| CROP, arêtes vives *(même seconde)* | 0,9420 | 0,6826 | 0,6774 | 0,6745 | **−5,80 %** |
| ⛔ **SOCLE** | **0,5732** | 0,6424 | 0,6481 | 0,6509 | ⛔ **−42,68 %** |

⛔ **ET C'EST LA CORRECTION LA PLUS DÉSAGRÉABLE DE CETTE NOTE, PARCE QU'ELLE EST
D'ABORD CONTRE MOI.** De la note 01 à la note 04, le noteur a écrit quatre fois :
*« un fin liseré lumineux court sur TOUTE l'arête haute de la paroi du socle ; sur
le crop l'arête est franche, noire et nue »*. **P13 a regardé la capture avant de
conclure, et a trouvé que la ligne orange du socle court le long de l'arête
BASSE.** ⚡ **Elle a raison, et ma mesure le confirme : sur l'arête HAUTE, le
socle est 42,7 % PLUS SOMBRE que son mur.**

➡️ **Conséquence que P13 n'a pas tirée de ses propres colonnes** : le crop
d'AVANT P13 était à **−5,80 %**, soit **36,9 points** du socle ; le crop livré
est à **+58,25 %**, soit **100,9 points**. ⛔ **Sur l'arête haute, P13 a
multiplié l'erreur par 2,7.** La géométrie du chanfrein est bien celle du socle
(0,16/56 et 0,9/56, `FRACTION_CHANFREIN` et `FRACTION_ARRONDI`,
`parois-crop.js:292-295`, face à `SOCLE_CHANFREIN = 0.16` et
`SOCLE_ARRONDI = 0.9`, `plinth.js:42-92`) — **c'est son ÉCLAIRAGE qui ne l'est
pas**, et P13 le dit elle-même au §3.2 : *« le congé du crop est de la géométrie
qui attend son éclairage. »* **La phrase vaut pour les deux arêtes.**

⚠️ **JE NE FACTURE PAS CE POSTE À P13 SEULE.** Le noteur a demandé pendant quatre
notes un liseré clair sur la mauvaise arête, sur la foi d'une capture mal lue.
P13 a livré contre la description, découvert l'erreur, et l'a publiée. **La
faute est partagée, et c'est le noteur qui l'a introduite.**

### 4.3 La silhouette, et ce que je retire de la charge de la note 04

| | crop | socle | |
|---|---|---|---|
| parois, cadrage intérieur | **62 388 px** | 58 826 | |
| tuiles dans la bande verticale du mur, intérieur | **56 685** | **2 660** | ×21,3 |
| nappe dans la bande du mur, côte | ⛔ **2 039** | **0** | ⛔ |
| `contourInterval` | **200** (mètres) | **0,29** (unités de scène) | ⛔ toujours faux |

⛔ **LA SILHOUETTE N'A PAS BOUGÉ D'UN CRAN, ET C'EST LE PLUS GROS POSTE DE CE
CRITÈRE.** Sur `D1-zoom-CROP-arete-N03.png` contre `D2-…SOCLE-…` (×3, même
fenêtre, même seconde) : **le socle coupe son mur en aiguilles fines, une par
ravine ; le crop rend une courbe polygonale.** Chiffré à la source :
`segmentsTuile(z)` rend **24** pour z ≥ 6 (`src/monde/maillage-tuile.js:82-87`),
et le bloc fait 3 tuiles de côté — soit **72 segments par côté de bloc contre
les 768 du socle : ⛔ 10,7 fois plus grossier PAR AXE.** *(C'est un rapport de
SEGMENTS ; je ne reprends aucun compte de sommets, la note 04 ayant retiré le
sien.)*

⚖️ **ET JE RETIRE UNE CHARGE DE LA NOTE 04 : LES EAUX INTÉRIEURES.** Elle
relevait un réseau hydrographique bleu sur le relief du socle (secteur 210–240° :
socle **692**, crop 100) et l'absence totale du même sur le crop, **en déclarant
elle-même que le socle ne le dessine pas d'un chargement à l'autre**. **Dans mes
cinq pages, le socle n'en dessine aucun** : secteur 210–240°, socle **17**, crop
**271** — le crop en a seize fois plus que le socle. ⛔ **Je ne peux donc pas
juger ce poste, et je refuse de le compter contre le crop tant que personne ne
sait faire dessiner ce réseau au socle de façon reproductible.** *(P12 relève
18 au même secteur, ce qui fait deux chargements sur trois sans réseau.)*

**Net : +1.** La frange revient de 7,12 à 3,52 points d'excès et le chanfrein
existe enfin ; la silhouette, `contourInterval` et la nappe dans la bande du mur
n'ont pas bougé ou ont empiré, et les arêtes lisent moins bien qu'avant P13.

---

## 5. ④ LA MER — **2 → 5 → 7 → 5 → 6 / 10** *(+1)*

⚠️ **LE DÉNOMINATEUR D'ABORD** : masque de mer du crop **75 457 px**, du socle
**76 509** ; tout est mesuré sur leur **INTERSECTION : 74 199 px**.

| sur l'intersection | crop | socle | rapport | | P12 | note 04 | note 03 |
|---|---|---|---|---|---|---|---|
| **énergie de détail du FOND MARIN seul** | **4,084** | 4,833 | ⚡ **84,50 %** | | 84,91 % | ⛔ 75,41 % | 100,08 % |
| énergie de détail de la mer composée | 2,425 | 3,425 | **70,80 %** | | 71,95 % | 69,61 % | 80,4 % |
| écart horizontal moyen | 2,127 | 3,200 | **66,47 %** | | 68,1 % | ⛔ 60,6 % | 72,2 % |
| **luminance, région comparable** | 71,731 | 66,925 | ⚡ **+7,18 %** | | +6,45 % | ⛔ +18,26 % | +16,71 % |
| luminance, tout le masque | | | **+17,33 %** | | +16,24 % | ⛔ +29,05 % | +27,54 % |
| bleu profond, région comparable | ⛔ **115** | 835 | | | 229 / 841 | 73 / 846 | 2 828 / 824 |
| écume (L > 200, sat < 0,25) | ⛔ **14** | **1** | | | ⛔ 12 / 0 | 1 / 1 | 1 / 1 |
| **pavage : pic de période sur la nappe** | ⛔ **11 px (0,163)** | **0 à 0,048** | | | ⛔ 11 px (0,1565) | 15 px (0,0828) | 0 |

⚡ **LE POSTE N° 2 DE LA NOTE 04 EST RENDU AUX DEUX TIERS, ET JE LE CONFIRME À
0,4 POINT PRÈS DE CE QUE P12 ANNONCE.** Le grain du fond marin, tombé à
**75,41 %**, rend **84,50 %** (P12 annonce 84,91 %). La clarté de la lame d'eau
sur la région comparable, qui valait **+18,26 %**, vaut **+7,18 %** (P12 :
+6,45 %). L'écart horizontal remonte de 60,6 % à **66,5 %**. ⚡ **Et le socle se
reproduit à +0,3 %** sur le grain (4,856 chez P12, **4,833** chez moi) : ce
n'est pas du bruit de banc.

⛔ **CE QUI EMPÊCHE LE 7 DE LA NOTE 03 DE REVENIR, ET C'EST TROIS CHOSES
MESURÉES.**

1. ⛔ **LE PAVAGE RECTANGULAIRE A DOUBLÉ ET IL RESTE DOUBLÉ.** Pic normalisé
   **0,163** contre 0,0828 à la note 04. **P12 l'avait déclaré avant qu'on le lui
   trouve** (0,1565), et **j'ai vérifié que P13 n'y est pour rien** : au même
   cadrage, dans la même page, l'état aux arêtes vives rend **0,1498** contre
   **0,1602** pour l'état livré. **C'est le prix de P12, entièrement.** Il est
   franchement visible sur `J1` et sur `F1-CROP-cote-N03.png` : la nappe du large
   porte des bandes et des coutures verticales que le socle n'a pas à cette
   amplitude.
   ⚠️ **ET LE SOCLE N'EST PAS À ZÉRO, MAIS JE NE SAIS PAS À COMBIEN.** Le même
   instrument (`periode` de `n5`) lui rend **0** dans deux de mes exécutions et
   **0,0483** dans une troisième ; P13 relève **0,0337**, P12 relève **0,0339**
   avec un second instrument. ⛔ **Je publie la fourchette 0–0,048 et je ne
   défends aucun rapport précis** — c'est la correction que la note 04 et P12 ont
   toutes deux portée sur elles-mêmes, et elle tient.
2. ⛔ **L'ÉCUME EST PASSÉE DE 1 À 14 PIXELS** (socle 1). P12 l'a déclarée à 12 en
   réserve n° 5, sans l'expliquer. **Je la retrouve à 14, donc elle est stable et
   elle n'est toujours pas expliquée.**
3. ⛔ **LE BLEU PROFOND S'ÉLOIGNE À NOUVEAU** : 115 px sur la région comparable
   contre 835 au socle, quand P12 en rendait 229. **Le crop a maintenant sept
   fois moins de bleu profond que le socle là où les deux ont un fond.**

---

## 6. ⑤ LES PAROIS ET LA BASE — **2 → 5 → 6 → 6 → 7 / 10** *(+1)*

⚡ **LA COULEUR EST JUSTE, ET JE LA PROUVE EN LA BOUGEANT** (je bouge la couleur
VIVANTE du matériau de paroi du socle, pas `params.plinthColor`) :
`plinth.wallMat.color` et `uParoiCouleur` passent ensemble de `#c06a44` à
`#c81e1e` et reviennent. **186 331 canaux changent, l'aller-retour rend 0.**
*(`params.plinthColor` vaut toujours `#d8d4cc` : c'est le matériau qui est lu,
pas le paramètre.)*

| profil de paroi, en percentiles (protocole P8), cadrage intérieur | crop | socle | rapport | | P12 | note 04 |
|---|---|---|---|---|---|---|
| **face sombre (p20)** | ⛔ **18,87** | **15,88** | ⛔ **×1,188** | | ⚡ ×1,072 | ×1,125 |
| **face claire (p80)** | ⚡ **46,85** | 48,15 | ⚡ **−2,70 %** | | −11,3 % | −8,0 % |
| **contraste inter-faces** | **2,4828** | **3,0321** | socle **×1,221** | | ×1,208 | ×1,224 |
| étendue du masque | 62 388 | 58 826 | | | 67 703 / 60 152 | 67 699 / 60 151 |

⚡ **CE QUI FAIT MONTER LA NOTE, ET C'EST LE POSTE QUE LE NOTEUR RÉCLAME DEPUIS
LA NOTE 01.**

1. **LE CHANFREIN ET LE CONGÉ SONT LÀ, ET DANS LA MONNAIE DU SOCLE.** Le profil
   passe de 2 rangs à 7, **39 780 sommets dé-indexés contre 9 180**, arc à 3
   segments et **normales analytiques** (`normalesParois`) au lieu de
   `computeVertexNormals`. Sur `P5-zoom6-CROP-base-AVEC-P13.png` (×6) contre
   `P6-…SANS-…` rebâti à la même seconde : **une ligne orange court le long de
   l'arête haute, là où il n'y avait rien.** ⚠️ **Elle est POINTILLÉE**, le
   chanfrein faisant ~2 px à ce cadrage — P13 le déclare, et je le vois.
2. ⚡ **LA FACE CLAIRE EST TROIS FOIS PLUS PROCHE.** −8,0 % à la note 04, −11,3 %
   chez P12, **−2,70 % ici**. C'est la plus grande surface visible du mur, et
   c'est le meilleur relevé du chantier sur cette grandeur.
3. **LE PROFIL EST REDEVENU BINAIRE, COMME CELUI DU SOCLE.** Les percentiles du
   crop rendent **deux valeurs** (18,87 / 46,85) là où P12 en rendait cinq
   (15,88 / 17,02 / 18,66 / 42,72 / 45,21) — c'est la normale de FACE de P13, et
   c'est **structurellement** la loi du socle (15,88 / 48,15).
4. **ET L'OCCLUSION DE CONTACT NE BAVE PLUS SUR TOUT LE MUR.** Le rang ② borne
   la bande à 12 % ; sans lui elle s'interpolait sur 100 % de la hauteur.
   ⚠️ **Le chiffre est celui de P13 (octet cuit 243 contre 207 à mi-bande), pas
   le mien : je ne l'ai pas mesuré.**

⛔ **CE QUI N'EST PAS FERMÉ, ET LE PREMIER POINT EST UNE RÉGRESSION.**

- ⛔ **LA FACE SOMBRE S'EST ÉLOIGNÉE** : ×1,072 chez P12 → **×1,188** ici. **P13
  a repris ce que l'accord d'exposition de P12 avait gagné sur cette grandeur, et
  ne le dit pas** — sa réserve n° 8 affirme les chiffres de paroi « inchangés au
  millième par rapport à la note 04 », ce qui est vrai du contraste (2,4779 →
  2,4828) mais **saute par-dessus P12**, dont le p20 était le meilleur du
  chantier.
- ⛔ **LE CONTRASTE INTER-FACES NE BOUGE PAS** : socle **×1,221**, contre ×1,224,
  ×1,223 et ×1,208 aux quatre relevés précédents. **Quatre tâches d'éclairage, et
  cette grandeur-là n'a jamais bougé de 1,5 %.**
- ⛔ **LE LISERÉ DE BASE DU SOCLE N'EST PAS REPRODUIT — ET LA BASE DU CROP S'EN
  EST ÉLOIGNÉE.** §7.1.

⚖️ **L'OMBRE PORTÉE N'EST PAS NOTABLE, REMESURÉE** : `params.shadowMode = 'off'`,
silhouette + ombre = silhouette **des DEUX côtés à 0 px près** (crop
207 157 → 207 157 ; socle 206 072 → 206 072 ; retour exact). **0 contre 0.**

---

## 7. ⚖️ MON VERDICT SUR LES TROIS AVEUX DE P13

### 7.1 ⛔ « Le liseré de BASE n'est pas reproduit » — **VRAI, ET PIRE QUE DÉCLARÉ**

| profil depuis l'arête **BASSE**, d = | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **SOCLE** | 0,7109 | ⚡ **0,9609** | 0,6908 | 0,6255 |
| CROP **livré** | ⛔ **0,3702** | 0,5513 | 0,6537 | 0,6622 |
| CROP **arêtes vives** *(même seconde)* | **0,5817** | 0,5856 | 0,5900 | 0,5987 |

⚡ **JE REPRODUIS LES DOUZE VALEURS DE P13 À LA QUATRIÈME DÉCIMALE**, sur son
script rejoué intact. **Son aveu est exact** : le socle a un vrai pic à la ligne
1 (0,711 → **0,961** → 0,691) ; le crop rend une montée monotone.

⛔ **ET J'AJOUTE LA SOUSTRACTION QU'ELLE N'A PAS FAITE, SUR SES PROPRES
COLONNES.** À `d = 0`, le crop d'AVANT P13 valait **0,5817** ; le crop livré vaut
**0,3702** ; le socle **0,7109**. ➡️ **Le congé a éloigné la base du crop de son
modèle : l'erreur passe de 0,129 à 0,341, soit ×2,6.** À `d = 1`, même sens
(0,5856 → 0,5513, socle 0,9609). **Ce n'est donc pas seulement « non
reproduit » : c'est reculé.** ⚠️ **Et la cause est celle que P13 nomme —
« c'est de l'éclairage, pas de la géométrie » —, elle est vraie, et elle est le
poste n° 4 de ma liste.**

### 7.2 ⛔ « Cinq traînées pâles, régression d'apparence » — **VRAI, ET LARGEMENT SOUS-ESTIMÉ**

**J'ai posé mon propre détecteur** (`.banc/vues-notation-05/v1-trainees-colonnes.js`
et `v2-trainees-avant-apres.js`) : pour chaque colonne d'écran où le mur est
présent, luminance moyenne du mur, moins la **médiane glissante sur 21
colonnes** ; une traînée est une suite de colonnes dont le résidu dépasse
**2 octets**. **Le même détecteur et le même seuil des deux côtés**, cadrage
intérieur, socle apparié à **−0,0130 %**, témoin nul **0 canal**.

| état, MÊME PAGE, MÊME SECONDE | traînées | colonnes en traînée | pic max | résidu moyen | jupes couvrant du mur |
|---|---|---|---|---|---|
| ⛔ **CROP livré (`536f7a6`)** | ⛔ **23** | ⛔ **68** | **12,51** | ⛔ **0,961** | **903 px** *(1,45 % du mur)* |
| **CROP, arêtes vives rebâties** | **7** | **10** | 16,25 | **0,442** | **411 px** *(0,61 %)* |
| CROP livré, **jupes éteintes** | **10** | **14** | 9,59 | 0,665 | — |
| CROP vives, jupes éteintes | 8 | 11 | 16,25 | 0,561 | — |
| ⚡ **SOCLE** | **4** | **10** | 5,71 | **0,336** | — |

**Retour au canal : 0 sur 4 096 000, à l'extinction des jupes ET au rebâtissage
des parois.**

➡️ ⛔ **P13 A MULTIPLIÉ PAR 3,3 LE NOMBRE DE TRAÎNÉES ET PAR 6,8 LES COLONNES
QU'ELLES OCCUPENT ; LE RÉSIDU DE COLONNE PASSE DE ×1,32 À ×2,86 CELUI DU
SOCLE.** ⚡ **Et la cause qu'elle prouve est la bonne** : jupes éteintes, on
retombe de 23 à 10 traînées et de 68 à 14 colonnes — **les jupes en portent 13
sur 16 et 54 sur 58.** ⚡ **Et le témoin est décisif : AVANT P13, éteindre les
jupes ne changeait rien (7 → 8, 10 → 11).** **Ce ne sont pas les jupes qui ont
changé, c'est le mur qui s'est retiré de devant elles.**

⛔ **DEUX CHOSES QUE JE CORRIGE DANS SON RAPPORT.**

- **« Cinq »** est le compte d'une découpe ×6 au cadrage côte. **Au cadrage
  intérieur, à l'échelle 1:1, il y en a vingt-trois**, et elles sont visibles
  sur `A1-CROP-interieur-N03.png` **sans aucun zoom**. **C'est le seul défaut de
  cette note qui se voit à taille réelle.** Mettez `A1` à côté de
  `V6-CROP-interieur-AVANT-P13-N05.png` — le même crop, la même page, la même
  seconde, aux arêtes vives : **le mur y est propre.**
- ⛔ **« Elles ne couvrent pas plus qu'avant » est vrai à SON cadrage et faux à
  l'autre.** À la côte je retrouve son ordre de grandeur (**6 175 px** contre
  6 669, soit 7,42 % du mur contre 7,63 %) ; **au cadrage intérieur elles
  couvrent 903 px contre 411, soit ×2,2 — et 1,45 % du mur contre 0,61 %.**

⚡ **ET UN TROISIÈME EFFET, QU'ELLE N'A PAS VU** : c'est le même mécanisme qui
fait sauter le masque de surface du crop de **144 688 à 145 892 px** (§1.1) et
la nappe de mer dans la bande du mur de **1 224 à 2 039** au cadrage côte, contre
un socle qui rend **0**.

⚠️ **UNE CHOSE À SON CRÉDIT, ET JE LA DIS** : sa réparation du plancher de jupe
(`_rayonPlancherCrop`, `globe.js:5015`) **tient**. À la côte, `sousLeMur` rend
**0 px / 0 langue** dans mon relevé, là où son propre `P4-trainees-P13.json`
(pris avant le commit `d1f946d`) portait **82 px / 4 langues**. Au cadrage
intérieur il reste **4 px / 1 langue** — **contre 11 px / 1 langue au socle dans
la même page.** **Sur ce point-là le crop est plus propre que son modèle.**

### 7.3 ⚠️ « Retour d'A/B non nul : 574 canaux » — **VRAI, ET PAS REPRODUCTIBLE**

| aller-retour du rebâtissage des parois | canaux du témoin | **retour** |
|---|---|---|
| `p1-chanfrein.js` de P13, **son relevé** | 45 365 | **574** *(1,3 %)* |
| `p1-chanfrein.js` de P13, **rejoué chez moi** | 45 355 | ⛔ **1 174** *(2,6 %)* |
| `p4-trainees.js` de P13, **rejoué chez moi** | — | ⚡ **0** |
| `v2-trainees-avant-apres.js` *(le mien)* | 45 355 | ⚡ **0** |
| `v3-frange-avant-apres.js` *(le mien)* | — | ⚡ **0** |

➡️ **Son aveu est honnête, et il est plus grand qu'elle ne le mesure : mon
propre relevé du même script rend le double du sien.** ⚡ **Mais il est
INTERMITTENT, pas systématique** — trois autres aller-retours du même
rebâtissage, dont deux à moi, rendent **0 canal**. **Ce n'est donc pas un biais
qui pousse dans un sens ; c'est du bruit d'ordre de dessin**, et l'hypothèse de
P13 (l'ordre des tuiles à couverture douce quand le maillage quitte et rejoint
le groupe) reste la seule sur la table. ⚡ **Il ne menace aucun de ses chiffres
de chanfrein** : je les reproduis **à la troisième décimale sur les vingt-quatre
valeurs des trois profils**, dans une exécution où le retour valait le double du
sien.

---

## 8. ⚖️ MON VERDICT SUR « LE POSTE 2 ET LE POSTE 4 SONT LE MÊME POSTE »

P12 conclut : *« Le poste n° 2 et le poste n° 4 du noteur ne sont pas deux
postes : c'est le même, et il s'appelle `CHAMP_FOND = 384`. »*

⚖️ **VERDICT : À MOITIÉ VRAI, ET LA MOITIÉ FAUSSE COÛTE UN POSTE.**

### 8.1 ⚡ Ce qu'elle a raison de fusionner, et c'est un vrai apport

Le **reliquat** du poste 2 — les 15,5 % de grain de fond marin que le pas ne
peut pas racheter — **et le PAVAGE** sont bien une seule et même chose, et c'est
la résolution du champ cuit. **Sa démonstration tient et je la retrouve** :

- son balayage du pas montre que le grain **plafonne à 85,1 %** quand le pas
  descend à un texel, pendant que le pavage **explose à 0,1345** ;
- son argument physique est juste et il est écrit dans la source
  (`globe.js:1757-1774`) : sous l'eau la hauteur ne vient pas du MNT mais du
  champ cuit, **385 nœuds sur `2 × uFondPortee`**, soit une maille de **213 m** à
  La Réunion z12 — **six texels de MNT**. Ce champ est **MAGNIFIÉ**. *« Aucun pas
  ne peut produire un détail que la donnée n'a pas »* ;
- et l'état livré le confirme : grain **84,50 %**, pavage **0,163**.

⚡ **Sur ce point, P12 apprend au chantier quelque chose que la note 04 n'avait
pas vu : elle rangeait le pavage au poste 4 et le grain au poste 2 comme deux
causes ; c'en est une.**

### 8.2 ⛔ Ce qu'elle a tort de fusionner : la FRANGE n'est pas ce poste

**Le poste 4 de la note 04 s'intitule « LA FRANGE EN MARCHES ET LE PAVAGE
RECTANGULAIRE ».** ⛔ **La frange n'est pas `CHAMP_FOND`, et j'ai trois preuves.**

1. ⛔ **LE BALAYAGE DE P12 LE DIT CONTRE ELLE.** Sous le seul levier qu'elle a
   bougé, **la frange répond de façon monotone** (14,22 → 13,61 → 12,42 → 10,90
   → 9,22 %) et **le pavage ne répond pas du tout** (0,0546 → 0,0685 → 0,0468 →
   0,0767 → 0,1345 — il descend, remonte, redescend, explose). **Deux grandeurs
   qui ne covarient pas sous le levier commun ne sont pas un seul poste.**
2. ⛔ **LA NOTE 04 AVAIT DÉJÀ NOMMÉ UN AUTRE LEVIER, ET PERSONNE NE L'A PRIS** :
   *« le trait de côte a déjà un masque à la résolution du MNT (`uCoastMask`,
   `uMargeCoteM`, tous deux allumés et posés dans ma page) ; faire porter la
   frange par CE masque plutôt que par le champ ferme la moitié visible du poste
   sans payer les neuf fois »*. **Je vérifie qu'ils sont toujours allumés et
   posés** (`globe.js:1016-1018`). **P12 ne l'a pas essayé et ne le mentionne
   pas.**
3. ⚡ **ET VOICI MA PREUVE À MOI, ET C'EST LA PLUS COURTE.** Dans la même page,
   à la même seconde, appariement refait pour chaque état, **retour 0 canal** :

| cadrage côte, frange sur l'intersection des masques de mer | **part des suites de 4 px et plus** | longueur moyenne | longueur max |
|---|---|---|---|
| ⛔ **état livré `536f7a6`** | **10,16 %** *(socle 6,72)* — excès **3,44 pt** | **2,069** | ⛔ **33** |
| ⚡ **parois rebâties aux ARÊTES VIVES** | **9,20 %** *(socle 6,33)* — excès **2,87 pt** | **1,825** | **14** |

➡️ ⛔ **P13 A DÉGRADÉ LA FRANGE DE 20 % SANS TOUCHER NI À `CHAMP_FOND`, NI AU PAS
DU GRADIENT, NI À LA MER — rien qu'en rentrant le mur.** **Si la frange était
`CHAMP_FOND`, une décision de géométrie de paroi n'aurait pas pu la déplacer.**

⚠️ **ET CE N'EST PAS UN ACCIDENT DE CHARGEMENT** : deux relevés indépendants pris
après P13 avec le script `n5` intact — **celui de P13 elle-même**
(`.banc/P13/N5-…json`, **10,09 %**) **et le mien** (**10,14 %**) — s'accordent
contre le **9,36 %** de P12, pendant que le socle se reproduit à ±0,4 point
(6,45 / 6,54 / 6,62 / 6,72 / 6,90 sur cinq exécutions). **Et le A/B ci-dessus le
tranche dans une seule page.**

⛔ **JE SIGNALE AU PASSAGE QUE P13 AVAIT CE CHIFFRE ET NE L'A PAS PUBLIÉ.** Sa
réserve n° 8 dit *« je n'ai rien mesuré sur les autres postes du noteur »*, mais
son propre dossier `.banc/P13/` contient `N5-trait-proprete-mouvement-N03.json`,
qui porte `part4plus: 10.09` contre le 9,36 de P12. **Le relevé était fait ; il
n'a pas été lu.**

### 8.3 ⚖️ L'énoncé que je propose à la place

> **Le poste 2 (le reliquat de grain du fond marin) et la MOITIÉ « pavage » du
> poste 4 sont un seul poste, et il s'appelle `CHAMP_FOND = 384`.**
> **La moitié « frange » du poste 4 est un TROISIÈME poste, et il a maintenant
> DEUX causes prouvées, indépendantes l'une de l'autre : le pas du gradient (P12,
> mesuré) et la géométrie du mur du crop (moi, mesuré).**

---

## 9. ⚡ LA LISTE ORDONNÉE DE CE QUI MANQUE

Rangée par **écart visuel mesuré**, pas par facilité.

### 1️⃣ ⛔ LES VINGT-TROIS TRAÎNÉES DE JUPE SUR LE MUR — *neuve, régression, et la seule visible à 1:1*

**23 traînées / 68 colonnes / résidu 0,961**, contre **7 / 10 / 0,442** avant
P13 et **4 / 10 / 0,336** au socle. Cause prouvée par extinction (13 des 16
traînées de plus). Visible sans zoom sur `A1`.

**Où ça vit** : la jupe d'une tuile pend **à l'aplomb du bord de la tuile**,
donc au rayon de l'anneau ; le mur est désormais `FRACTION_CHANFREIN = 0,16/56`
**en dedans à toute hauteur** (`src/monde/parois-crop.js:292`).
`_rayonPlancherCrop` (`src/globe.js:5015`) a corrigé la **LONGUEUR** de la jupe,
pas son **décalage LATÉRAL**. ⚠️ **Aucun réglage de longueur ne peut réparer un
décalage latéral — P13 le dit et elle a raison.**
**Ce que ça coûte** : **moyen**, et **P13 a déjà nommé les deux sorties** :
supprimer la jupe des tuiles que la frontière du crop **traverse** (leur service
anti-fente y est couvert par le mur), ou rentrer les tuiles de `ch` — **ce qui
rouvrirait l'accord surface/paroi que `parois-crop.js` §3 protège**. ⚡ **La
première est locale et n'ouvre rien ; c'est par elle qu'il faut commencer.**
⚡ **Et la preuve de sortie est déjà écrite** : mon `v2-trainees-avant-apres.js`
doit rendre le compte du socle, jupes allumées.

### 2️⃣ ⛔ LE PAVAGE RECTANGULAIRE ET LE RELIQUAT DE GRAIN — *un seul poste, et c'est le plus cher de tous*

Pavage **0,163** contre un socle entre **0 et 0,048** ; grain du fond marin
**84,50 %**. **Doublé depuis la note 04, et j'ai prouvé que P13 n'y est pour
rien** (0,1498 aux arêtes vives).

**Où ça vit** : `CHAMP_FOND = 384`, `src/globe.js:579`.
**Ce que ça coûte** : ⛔ **CHER, ET PLUS CHER QUE « NEUF FOIS `remplirHauteurs` ».**
Le commentaire de la constante (`globe.js:570-578`) déclare **deux** obstacles
que ni la note 04 ni P12 ne comptent : **①** `SHORE_SURF_GLSL` porte
**`1.0 / 384.0` EN DUR** pour son pas de gradient — *« une autre résolution
déformerait la houle de côte sans que rien ne le signale »* — donc c'est un
changement **couplé**, pas un simple remplissage ; **②** *« c'est déjà plus fin
que la source : la bathymétrie plafonne à `BATHY_BASE_ZMAX = 8`, soit 48 pixels
de donnée vraie en travers du bloc. Monter plus haut ne peindrait que de
l'interpolation, pour quatre fois la mémoire. »*
⛔ **Si ce commentaire dit vrai, ce poste ne se ferme PAS en montant la
résolution — il se ferme en changeant de source bathymétrique, ou pas du
tout.** ⚠️ **Je ne l'ai pas vérifié moi-même ; je signale que la constante que
tout le monde propose de tripler porte, sur elle, l'argument qui l'interdit.**

### 3️⃣ ⛔ LA SILHOUETTE, DIX FOIS TROP GROSSIÈRE — *inchangée depuis la note 01*

`D1-zoom-CROP-arete-N03.png` contre `D2-…SOCLE-…`, ×3, même fenêtre, même
seconde : **le socle coupe son mur en aiguilles fines, une par ravine ; le crop
rend une courbe polygonale.**

**Où ça vit** : `segmentsTuile(z)` rend **24** pour z ≥ 6
(`src/monde/maillage-tuile.js:82-87`) ; le bloc fait 3 tuiles de côté, soit
**72 segments par côté contre les 768 du socle — ×10,7 par axe.**
**Ce que ça coûte** : ⛔ **CHER.** Changement de budget de géométrie sur les
seules tuiles du crop (`tuileDansCrop` sait déjà les désigner), qui demande **sa
propre mesure de coût**. **Treize tâches, personne ne l'a prise, et personne ne
l'a chiffrée en millisecondes.**

### 4️⃣ ⛔ L'ÉCLAIRAGE DE LA PAROI — *le liseré de base, le contraste ×1,22, et la face sombre*

Quatre grandeurs, un seul poste : le socle a un **vrai pic à la base**
(0,711 → 0,961 → 0,691), le crop une montée monotone qui a **reculé** avec P13
(0,5817 → 0,3702 à `d = 0`) ; le contraste inter-faces reste à **×1,221** après
quatre tâches d'éclairage ; la face sombre est repartie à **×1,188** ; et
l'arête haute dépasse maintenant de **+58 %** un socle qui est à **−43 %**.

**Où ça vit** : la paroi du socle est un `MeshPhysicalMaterial` sous les trois
sources du studio ; celle du crop est un nuanceur qui applique `irradianceCrop`
(`src/monde/eclairage-crop.js`), avec ses uniformes de paroi
`uParoiCielIrr` / `uParoiSolIrr`. ⚡ **Et P12 a déjà nommé le plafond, par la
mesure** (sa réserve n° 2) : `mix(sol, ciel, 0,5·ndu + 0,5)` est **une DROITE**,
et l'irradiance vraie **a un genou** (0,807 à `ndu = −0,5` ; 1,025 à 0 ; 1,959 à
+0,9). ⛔ **Une paroi est verticale, `ndu ≈ 0` — exactement là où la droite est
la plus fausse (+26,8 % à `ndu = −0,5`).**
**Ce que ça coûte** : **moyen à cher** — c'est un changement de MODÈLE
d'éclairage, pas un gain. ⚡ **Mais c'est le poste à meilleur effet de levier de
toute cette liste** : il touche ⑤ **et** les arêtes de ③ **et** le mécanisme de
① (22,3 % contre 45,5 %) en une seule fois.

### 5️⃣ ⛔ LA FRANGE EN MARCHES — *deux causes prouvées, aucune payée en entier*

**10,16 % contre 6,72 % au socle**, excès **3,44 points** — mieux que la note 04
(7,12), moins bien que P12 (2,82).

**Où ça vit, et c'est double** : **①** le pas du gradient — P12 l'a mesuré et
payé aux deux tiers, et **refuse le dernier tiers avec motif** *(le resserrer
encore rachèterait du pavage)*, **et je trouve ce refus fondé** ; **②** la
géométrie du mur — **c'est moi qui l'isole**, 9,20 → 10,16 % dans la même page ;
elle vient avec le poste 1️⃣ et se fermera avec lui.
⚡ **ET LA ROUTE MOINS CHÈRE RESTE CELLE QUE LA NOTE 02 A TROUVÉE ET QUE
PERSONNE N'A PRISE** : `uCoastMask` / `uMargeCoteM` (`globe.js:1016-1018`), tous
deux **allumés et posés** dans ma page, portent déjà le trait de côte à la
résolution du MNT. **Ce que ça coûte : moyen.**

### Et derrière, dans l'ordre

6️⃣ **L'énergie de détail à +12,58 %** — dans l'ALBÉDO, pas dans la lumière
(P12 : +6,15 % sur l'albédo nu), c'est-à-dire la pente de rampe ×3,12 de P11.
**Faible à essayer**, ⚠️ **avec l'avertissement de la note 04 : ne pas baisser un
gain sans regarder la teinte — c'est ce qui ferait retomber le critère ② de 9 à
8.**
7️⃣ **Le rosé à ×1,36** — dernier secteur de teinte franchement faux (1 393 à la
note 04, **1 359** ici : il n'a jamais bougé, et personne ne l'a nommé).
8️⃣ **L'écume à 14 px contre 1** — déclarée par P12 (12), retrouvée par moi (14),
**expliquée par personne**.
9️⃣ **Le bleu profond sur le fond : 115 contre 835** — s'éloigne depuis P12 (229).
🔟 **`contourInterval` dans la mauvaise monnaie** — crop **200 m**, socle
**0,29 unité de scène**. ⚖️ Invisible tant que `uContourOpacity = 0` des deux
côtés, **faux dès qu'on allume les courbes**. Le non-fermé n° 3 de P6, non
touché par sept tâches.
1️⃣1️⃣ **Les 2 039 px de nappe de mer dans la bande du mur** (socle 0) — +66 %
depuis P12, même mécanisme que le poste 1️⃣.
⚖️ **RETIRÉ DE LA LISTE : les eaux intérieures.** Le socle ne les dessine dans
aucune de mes cinq pages (§4.3). **Je ne charge pas le crop d'un manque que je ne
peux pas montrer.**
**Puis les non portés du tout, que je n'ai mesurés sur AUCUNE capture, des deux
côtés** : cartouche au sol, effets de surface, scanner, grille métrique
(`gridOpacity = 0` des deux côtés), 50 matières de parois.

---

## 10. ⚡ LA QUESTION D'ADRIEN — CE QUI EST RATTRAPABLE, ET CE QUI NE L'EST PAS

**C'est la seule partie de cette note qui sert à décider. Je la donne critère par
critère, et je nomme le levier à chaque fois.**

### ⚡ RATTRAPABLES À COÛT RAISONNABLE — dans l'ordre où je les prendrais

| critère | ce qui reste | le levier | coût |
|---|---|---|---|
| **⑥ Propreté** *(5)* | les 23 traînées, la nappe dans la bande | **quelles tuiles portent une jupe** — décision locale, `_rayonPlancherCrop` voisin | ⚡ **faible à moyen** |
| **② Palette** *(9)* | rosé ×1,36, −4,0 % de luminance | un gain et un secteur de rampe ; le suspect du −4 % est nommé (spéculaire du socle, 4,0 % chez P3) | ⚡ **faible** |
| **① Relief** *(9)* | énergie +12,58 % | la **pente de rampe ×3,12 de P11** — P12 a prouvé que ce n'est plus la lumière | ⚡ **faible**, avec la garde sur la teinte |
| **③ moitié frange** *(6)* | excès 3,44 pt | `uCoastMask` / `uMargeCoteM`, **déjà allumés et posés**, jamais employés pour ça | **moyen** |

➡️ ⚡ **LE PREMIER DE CETTE LISTE EST DE LOIN LE MEILLEUR RAPPORT DU CHANTIER.**
Les traînées sont **une seule décision de géométrie locale**, elles sont **la
seule chose de cette note qui se voie à taille réelle**, elles valent **deux
points de ⑥**, et **le banc qui les mesure existe déjà** (`v2`, et il porte son
témoin nul). **C'est trois quarts d'un point de note globale pour une
correction locale.**
⚡ **Et les trois suivantes ensemble valent environ un point de plus, sans qu'aucune
ne demande de rebrancher quoi que ce soit.** **Un état à 8,3 / 10 est atteignable
sans chantier.**

### ⛔ CHANTIERS HORS DE PROPORTION — et deux d'entre eux ne sont pas du même genre

| critère | ce qui reste | pourquoi c'est hors de proportion |
|---|---|---|
| **③ la silhouette** *(le plus gros reste de ③)* | ×10,7 par axe | **Un changement de budget de géométrie sur un quadtree vivant.** ×114 en triangles sur les tuiles du crop. Aucune des treize tâches ne l'a chiffré en millisecondes, et **le chantier n'a JAMAIS chronométré un seul coût de rendu** — c'est la réserve que les notes 03, 04, P10, P11, P12 et P13 écrivent toutes les six. **On ne peut pas décider ça sans une mesure de coût qui n'existe pas.** |
| **④ le pavage / `CHAMP_FOND`** *(le plus gros reste de ④)* | pavage ×3 à ∞ le socle | ⛔ **Ce n'est pas « cher », c'est peut-être IMPOSSIBLE DANS CETTE DIRECTION.** Le commentaire de la constante dit **①** que `SHORE_SURF_GLSL` porte `1.0/384.0` en dur (changement couplé, régression silencieuse de la houle) et **②** que 384 est **déjà plus fin que la source** (48 px de bathymétrie vraie en travers du bloc). **Tripler le champ peindrait de l'interpolation.** ➡️ **La vraie question n'est pas « combien coûte 1 152 », c'est « d'où vient la bathymétrie ».** |
| **⑤ l'éclairage de la paroi** *(le reste de ⑤ et des arêtes de ③)* | contraste ×1,22, face sombre ×1,19, liseré de base, arête haute à +58 % contre −43 % | **P12 a mesuré le plafond : le nuanceur du crop modélise l'irradiance par une DROITE, et la vraie a un genou** — le pire écart tombe exactement sur `ndu ≈ 0`, c'est-à-dire sur une paroi verticale. **Le fermer veut dire changer le modèle** (intégrale d'hémisphère, ou une petite table), pas régler un coefficient. |

➡️ ⚡ **ET SI ADRIEN NE DEVAIT EN OUVRIR QU'UN SEUL DES TROIS, C'EST LE
TROISIÈME.** C'est le seul dont le gain se répartit sur **trois critères à la
fois** : il ferme le reste de ⑤, il ferme les deux arêtes de ③, et il attaque le
seul reste profond de ① — **22,32 % du modelé du crop vient de la lumière contre
45,51 % au socle**, et c'est ce chiffre-là, plus qu'aucun autre, qui explique
pourquoi le crop lit encore comme une image peinte et le socle comme un objet
éclairé. ⚠️ **Les deux autres achètent chacun un seul critère, et l'un des deux
achète peut-être du vide.**

---

## 11. LA NOTE GLOBALE — **7,3 / 10**, contre 6,7 puis 6,6 puis 5,3 puis 3,5

**Même pondération que les quatre notes précédentes**, le relief comptant double
parce que c'est la plus grande surface de l'image.

| critère | 01 | 02 | 03 | 04 | **05** | écart | la mesure qui le justifie |
|---|---|---|---|---|---|---|---|
| ① Richesse du relief | 6 | 6 | 8 | 8 | **9** | **+1** | énergie **+16,32 % → +12,58 %**, écart-type **+15,41 % → +7,86 %**, luminance **+8,53 % → −3,99 %** ; crêtes qui ne brûlent plus sur `A1` ; ⛔ mécanisme **25,75 % → 22,32 %** (socle 45,51 %) |
| ② Palette et contraste | 3 | 7 | 7 | 8 | **9** | **+1** | saturation **+15,75 % → +3,07 %** (÷5,1) ; distance de teinte **0,0287 → 0,0146** ; olive **1,094 → 1,018**, vert **1,273 → 1,005** ; ⛔ rosé **×1,36** inchangé |
| ③ Trait et bordure | 3 | 5 | 6 | 5 | **6** | **+1** | frange **13,57 % → 10,14 %** (excès 7,12 → 3,52 pt) ; ⚡ chanfrein **livré** (+58,25 %) ; ⛔ mais socle **−42,68 %** sur la même arête ; silhouette **×10,7 par axe** inchangée ; ⚖️ eaux intérieures **retirées de la charge** |
| ④ La mer | 2 | 5 | 7 | 5 | **6** | **+1** | grain du fond **75,41 % → 84,50 %** ; clarté **+18,26 % → +7,18 %** ; ⛔ pavage **0,0828 → 0,163** (socle 0–0,048), écume **1 → 14**, bleu profond **229 → 115** |
| ⑤ Les parois et la base | 2 | 5 | 6 | 6 | **7** | **+1** | ⚡ chanfrein + congé **livrés**, 39 780 sommets contre 9 180, bande d'AO 12 % au lieu de 100 % ; face claire **−8,0 % → −2,70 %** ; ⛔ face sombre **×1,072 → ×1,188**, contraste **×1,221** inchangé, liseré de base **reculé** |
| ⑥ Propreté | 3 | 3 | 4 | 7 | **5** | ⛔ **−2** | clignotement **toujours fermé** (0,8250 contre 0,0286, 10 instables contre 53, aucune parité) ; ⛔ traînées **7 → 23** et colonnes **10 → 68** (socle 4 / 10), pavage doublé, nappe dans la bande **1 224 → 2 039** (socle 0) |

`(9×2 + 9 + 6 + 6 + 7 + 5) / 7 = 7,286` → **7,3 / 10**. Moyenne simple : **7,0**.

**⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE.** *(C'est la dix-neuvième fois
que cette phrase est écrite sur ce chantier.)* Mettez
`A1-CROP-interieur-N03.png` à côté de `A2-SOCLE-interieur-apparie-N03.png` : **la
tonalité et la famille de couleurs sont les mêmes** — c'est l'acquis de P12, et
il est grand ; **le bloc a maintenant un pied arrondi et une arête chanfreinée**
— c'est l'acquis de P13, et il attendait depuis la note 01. Ce qui sépare encore
les deux images, à l'œil, **sur MES captures**, dans l'ordre où ça saute aux
yeux :

1. ⛔ **le mur du crop est rayé de vingt-trois traînées pâles verticales ; celui
   du socle est un aplat** — et **c'est neuf, c'est la seule chose visible sans
   zoom, et le même crop rebâti aux arêtes vives dans la même page n'en a que
   sept** ;
2. ⛔ **la silhouette du crop est une courbe polygonale là où le socle a des
   aiguilles**, une par ravine ;
3. ⛔ **la mer du crop est une plaque à bandes rectangulaires bordée d'un sillon
   en marches, là où le socle a un lagon large et continu** ;
4. ⛔ **la paroi du socle porte une ligne orange continue à sa BASE ; celle du
   crop porte une ligne orange pointillée à son SOMMET** — deux arêtes
   différentes, et c'est le noteur qui a demandé la mauvaise.

---

## 12. MES RÉSERVES

1. ⛔ **UN SEUL LIEU, DEUX CADRAGES.** La Réunion z12. Un crop continental, un
   crop de haute latitude, un crop à plateau peu profond ne sont toujours pas
   jugés — réserve n° 1 des notes 03 et 04, de P12 et de P13, **jamais levée**.
2. ⚠️ **LA MESURE EN MOUVEMENT RESTE UN PROXY ET UN PLANCHER** : translation
   rigide de la fenêtre de projection, **ni parallaxe, ni LOD, ni houle**.
3. ⛔ **MON SOCLE DE RÉFÉRENCE N'EST PAS BIT POUR BIT CELUI DES NOTES
   PRÉCÉDENTES.** Énergie de détail **16,073** contre 16,101 (P12) et 16,287
   (N04) ; `dansLaBande` **2 660** contre 2 191 et 2 149 (**+21 %**) ; résidu de
   mouvement **0,0286** contre 0,0303 et 0,0321 ; secteur 210–240° **17** contre
   18 et 692 ; pavage **0 / 0,048** selon l'exécution ; `sousLeMur` **11 px** là
   où N04 et P12 relèvent 0. **C'est le bruit inter-chargement du chantier, et
   il borne toutes mes comparaisons À TRAVERS LES NOTES.** ⚠️ **Mes comparaisons
   crop ↔ socle, et mes deux A/B avant/après P13, sont toutes prises dans la même
   page à la même seconde, et c'est la seule raison pour laquelle elles valent
   quelque chose.**
4. ⚠️ **JE N'AI PAS ATTEINT LE +0,0007 % D'APPARIEMENT QU'ON M'ANNONCE** (§1.1).
   La cible sur laquelle il avait été obtenu a changé de 0,83 % sous P13. Mes
   écarts vont de **−0,0130 % à −0,0427 %**.
5. ⚠️ **LES VALEURS ABSOLUES DE COULEUR NE SE COMPARENT PAS D'UNE NOTE À
   L'AUTRE** (règle de la note 02 §0.4). Seuls les ÉCARTS crop ↔ socle mesurés
   dans une même page se comparent, et c'est ainsi que les §2 à §6 sont écrits.
6. ⚠️ **LE ×21,3 DU DRAPÉ N'EST PAS UNE GRANDEUR QUE JE DÉFENDS.** Le
   dénominateur bouge tout seul (2 149 / 2 191 / 2 660 au même cadrage, trois
   exécutions). Je le donne comme ordre de grandeur, comme les notes 03 et 04, et
   **je ne publie aucun rapport sur le tablier de mer.**
7. ⚠️ **LE PAVAGE DU SOCLE EST HORS DE MA PORTÉE.** Deux instruments, quatre
   lectures, quatre résultats (0 · 0 · 0,0337 · 0,0483). **Je publie la
   fourchette et je ne conclus pas.**
8. ⚠️ **JE N'AI PAS MESURÉ L'OCCLUSION DE CONTACT** que je porte au crédit de ⑤ :
   le 243 contre 207 à mi-bande est **le chiffre de P13**, pas le mien.
9. ⚠️ **JE N'AI PAS REJOUÉ `d1-palette.js` DE P11** sur l'albédo nu. Le +6,15 %
   d'énergie d'albédo que je cite au §2 est **celui de P12**, pas le mien ; ce qui
   est de moi est le **+12,58 %** de l'image vivante.
10. ⚠️ **JE N'AI CHRONOMÉTRÉ AUCUN COÛT EN TEMPS DE RENDU**, pas plus que les
    notes 03 et 04, P10, P11, P12 et P13. **Sept rapports d'affilée déclarent la
    même absence, et le §10 dit ce qu'elle empêche de décider.**
11. ⚠️ **PAS DE COMPOSITEUR.** Il s'applique identiquement aux deux, donc il ne
    biaise aucun écart, **mais mes images ne sont pas exactement celles qu'Adrien
    voit.**
12. ⚠️ **LES DEUX MASQUES DE PAROI N'ONT PAS LA MÊME ÉTENDUE** (crop 62 388 px,
    socle 58 826). Le profil se compare en **percentiles**, comme P8 l'a défini —
    et c'est d'autant plus nécessaire depuis P13, dont le congé retire du masque
    le bas du mur, qui en est la partie la plus sombre : **la moyenne de
    luminance du mur du crop monte de 28,96 à 32,39 pour cette seule raison, et
    je ne m'en sers pas.**
13. ⚠️ **LES DÉCOUPES ×3 ET ×6 NE MONTRENT PAS LE MÊME MORCEAU DE TERRAIN** (le
    socle est à `k = 1,0055` ou 0,9975, donc recadré). **Je m'en sers pour juger
    la TEXTURE et la présence d'un trait, jamais pour comparer un pixel à un
    pixel.**
14. ⚡ **LA PRODUCTION EST INTOUCHÉE, RELEVÉ** (`run-production.log`, page
    chargée **sans `?terre=unique`**) : terrain **visible** (591 361 sommets),
    plinthe **visible**, **`uCropOn = uHabOn = uEclairageOn = uNormaleFineOn =
    uMppFacteur = 0`**, **`uSoleilIrr = uCielIrr = uSolIrr = (0,0,0)`**,
    **`uReliefBas = −6 000 = −uOceanDepth`**, `uContourOpacity = 0`,
    `shadowMode = off`. **Tout ce que cette note juge vit derrière le drapeau.**

---

## 13. CE QUI RESTE SUR LE DISQUE

`.banc/vues-notation-05/` — **45 captures PNG**, **11 relevés JSON**, le
récepteur (`recois-N05.mjs`, port 5613), le marqueur de serveur
(`marqueur.txt`), les journaux de chaque exécution, et **les quatre scripts que
j'ajoute** :

- `v1-trainees-colonnes.js` — **le détecteur de traînées**, passé sur les deux
  murs dans la même page, et la cause reprise par extinction des jupes ;
- `v2-trainees-avant-apres.js` — **le même, plus l'état d'AVANT P13 rebâti dans
  la même page** : c'est lui qui transforme « il y en a beaucoup » en « il y en
  a 23 contre 7 » ;
- `v3-frange-avant-apres.js` — **la frange mesurée dans les deux états, avec
  l'appariement refait pour chacun** : c'est lui qui réfute la fusion des postes
  2 et 4 ;
- `v4-production.js` — la clôture, drapeau baissé.

Le pilote est celui de P9 (`.banc/P9/pilote-P9.mjs`), **réemployé tel quel** ;
`n1` à `n6` sont ceux de la notation 03 et `p1-chanfrein.js` / `p4-trainees.js`
ceux de P13, **tous rejoués sans une ligne modifiée**.

**Les paires à regarder d'abord :**

- ⛔ **`A1-CROP-interieur-N03.png` ↔ `V6-CROP-interieur-AVANT-P13-N05.png`** —
  **le même crop, la même page, la même seconde, avec et sans le chanfrein.**
  Vingt-trois traînées contre sept, à taille réelle. **Si vous ne regardez
  qu'une paire, c'est celle-là.**
- ⚡ **`A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`**
  (−0,0308 %) — **la même tonalité, et le mur rayé contre l'aplat.**
- ⚡ **`V2-zoom-CROP-mur-AVEC-jupes-N05.png` ↔ `V3-…SANS-jupes-N05.png` ↔
  `V4-zoom-SOCLE-mur-N05.png`** (×3, même fenêtre, même seconde) — **la cause
  prouvée en trois images** : jupes éteintes, le mur redevient propre et le
  liseré de chanfrein reste.
- ⚡ **`P5-zoom6-CROP-base-AVEC-P13.png` ↔ `P6-…SANS-…` ↔ `P7-zoom6-SOCLE-base-P13.png`**
  (×6) — **le liseré pointillé du HAUT du crop contre le liseré continu du BAS
  du socle.** Les postes 4️⃣ et 1️⃣ en trois images.
- ⛔ **`J1-zoom-CROP-frange-N03.png` ↔ `J2-zoom-SOCLE-frange-N03.png`** —
  **l'escalier et la plaque à bandes contre le lagon continu.** Le poste 2️⃣ et la
  moitié du 5️⃣ en une image.
- **`D1-zoom-CROP-arete-N03.png` ↔ `D2-zoom-SOCLE-arete-N03.png`** (×3) — **la
  courbe polygonale contre les aiguilles.** Le poste 3️⃣ en une image.
