# NOTATION 03 — le crop face au socle d'avant la sphère, après neuf tâches

**Agent noteur · 2026-08-23 · `C:\Dev\wt-merge`, branche `regroupement`,
HEAD `ac58500` (« tache P9 : la projection des tangentes etait du code mort »),
arbre propre AVANT et APRÈS, aucune source touchée.**

> ⚠️ **C'EST CET ÉTAT-LÀ QUI EST NOTÉ.** Si un implémenteur committe par-dessus
> pendant que vous lisez, cette note ne juge pas son travail. `ac58500` est le
> dernier commit de la Tâche P9.

**Toutes les captures et tous les chiffres de ce rapport sont les miens**, pris
ce jour, et laissés dans **`.banc/vues-notation-03/`** (**29 captures PNG**,
**7 relevés JSON**, le harnais, le récepteur et les sept scripts de page).
Cadre **1 280 × 800 = 1 024 000 px**, La Réunion, z12, vue isométrique 0,
`fov = 33`, rendu dans une **cible à profondeur**, **sans compositeur**,
**boucle rAF gelée**, **socle rallumé dans la MÊME page**.

**Note globale : 6,6 / 10**, contre **5,3** à la notation 02 et **3,5** à la
notation 01. Le détail est au §5, et ⚡ **la liste de ce qui manque est au §6 —
c'est elle qui sert.**

---

## 0. CE QUE J'AI RÉGLÉ AVANT DE POUVOIR NOTER

### 0.1 ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est la consigne du brief
et le look de P7, P8 et P9.

⚡ **ET MON BANC LE PROUVE EN RETROUVANT DES CONSTANTES QU'IL N'A PAS CHOISIES.**
Le profil de paroi du socle rend chez moi **p20 = 15,88 · p80 = 48,36 · contraste
= 3,0453** — **les trois valeurs sur lesquelles P8 a calibré `profilParois`, au
centième**. Et l'énergie de détail du socle rend **16,044**, entre les 16,435 de
notation-01 et les 14,883 de notation-02. **Je suis sur la même image qu'eux.**

### 0.2 Le protocole, repris tel quel — il tient

Sous `?terre=unique` le socle **est caché, pas détruit** (`main.js:4544`). Je le
rallume dans la même page et je rends les deux blocs **à la même seconde**.
Relevé au même instant (`N1-etat-relief-palette-N03.json`) :

| | valeur relevée |
|---|---|
| `terrain.mesh` | **594 434 sommets** — le compte de notation-01 ET de notation-02 |
| rampe | `terrain.mapUniforms.uRampTex.uuid === globe.uniforms.uRampCrop.uuid` → **vrai** |
| texture d'analyse | **le même objet `three`**, uuid identique |
| soleil | `#fff7e6`, intensité **3,742 990 612 571 732 7** |
| hémisphère | ciel `#85c2eb`, sol `#4a3a2a`, intensité **0,810 498 435 428 622 2** |
| `heightContrast / heightPivot` | **2,2 / 0,41** au cadrage intérieur — ⚡ **la preuve de lieu de notation-02**, retrouvée au centième |

**Je n'ai pas réécrit le banc** : `harnais-N03.mjs` **importe
`../P9/harnais-P9.mjs` → P8 → P7 → N02 → P5 → P4 → P3**. Ce que j'ajoute est
listé en tête du fichier : le dépôt sur 5613, l'appariement en deux passes,
l'érosion de masque, la luminance, et ⚡ **la mesure EN MOUVEMENT** (§4).

### 0.3 Les deux cadrages sont ceux des deux notes précédentes

| cadrage | lieu | preuve |
|---|---|---|
| **intérieur** | lat **−21,115** · lon **55,536** · z12 · iso 0 | `hc/hp = 2,2 / 0,41` |
| **côte** | lat **−21,05** · lon **55,25** · z12 · iso 0 | `hc/hp = 2,5 / 0,58` — **les valeurs que notation-02 publie pour ce lieu** |

---

## 1. LA PREUVE D'APPARIEMENT

`applyIsoView` dérive de `controls.maxDistance` : à caméra identique les deux
blocs n'occupent pas la même fraction du cadre. **Chez moi le piège mord peu**
(le socle rend ×0,98 à ×1,01 selon le masque) — **et c'est précisément pourquoi
on balaie au lieu de supposer** : notation-01 mesurait ×1,362, notation-02
×0,763.

**Quatre appariements, chacun balayé sur un CLONE de la caméra du socle, DANS LA
MÊME EXÉCUTION JS que la mesure qu'il sert :**

| script / masque | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| **N1** — surface seule, intérieur | 144 631 px | **144 648 px** | 1,0095 | **+0,0118 %** |
| **N2** — bloc entier, intérieur | 212 472 px | **212 378 px** | 0,9855 | **−0,0442 %** |
| **N4** — bloc entier, côte | 215 797 px | **215 710 px** | 0,9895 | **−0,0403 %** |
| **N5** — bloc entier, côte (rejoué) | 215 797 px | **215 708 px** | 0,9895 | **−0,0412 %** |

➡️ **85, 23, 25 et 24 fois mieux que le 1 % demandé.**

- La fraction est comptée **en CACHANT le bloc et en comptant ce qui change** —
  jamais l'alpha (`getClearAlpha()` vaut 1).
- **Deux mesures du même `k` rendent le même compte au pixel** : 144 648 puis
  144 648 (`reproductibilite` dans N1).
- **La cible re-mesurée après le balayage rend le même compte** : 144 631 puis
  144 631 ; 212 472 puis 212 472 ; 215 797 puis 215 797. **Le saut de masque de
  +18,4 % que notation-02 déclarait ne s'est pas produit chez moi.**
- L'appariement du cadrage côte se **reproduit d'une exécution à l'autre**
  (N4 : `k = 0,9895` → 215 710 ; N5, page rechargée : 215 708).

---

## 2. LA PREUVE DE TÉMOIN NUL, ET LE TEMPS DE LA MER IMMOBILE

Sur **4 096 000 canaux** (1 024 000 px × 4) :

| témoin | canaux différents |
|---|---|
| crop, cadrage intérieur, deux prises de suite | **0** |
| crop, cadrage côte, deux prises de suite | **0** |
| **après 20 rendus intercalés** | **0** |
| **après 10 rendus du SOCLE intercalés** | **0** |
| aller-retour de `uEclairageOn` | **0** |
| aller-retour de `uNormaleFineOn` | **0** |
| aller-retour des lumières du socle | **0** |
| aller-retour de la couleur des parois | **0** |
| aller-retour de `setViewOffset` (dx = 0, 1, 2, 3), des deux côtés | **0** à chaque fois |

⚡ **ET LE TEMPS DE LA MER, RELEVÉ À CHAQUE PAS** (`N6-retours-N03.json`) :
`uMerTemps` vaut **2,750 500 000 014 9** aux **quatre** relevés d'un aller-retour
complet — `merImmobile: true`. Le treizième piège (`geler()` qui ne gèle rien)
est **écarté par mesure**, dans l'exécution où il compte.

**Et ce zéro n'est pas un banc vide** : cacher le bloc change **144 631**,
**212 472** et **215 797** px selon le masque ; couper `uNormaleFineOn` change
**401 290** canaux ; couper `uEclairageOn`, **634 696** ; bouger la couleur des
parois, **204 516**.

⚠️ **DEUX RÉSIDUS INTER-RENDUS QUE JE N'EXPLIQUE PAS, ET QUE JE DÉCLARE.** Deux
fois — dans N4 (**9 747 canaux**, 0,24 %) et dans N6 §3 (**134 214 canaux**) —
deux prises qui devaient être identiques ne l'étaient pas. **J'ai écrit un
script pour le pincer** (`n7-diagnostic.js`, huit étapes : deux prises de suite,
aller-retour de normale fine, `P4.merCrop`, extinction manuelle de la nappe,
nouvelle référence) : **il rend 0 aux huit étapes**, `uMerTemps` immobile. **Je
ne reproduis donc pas la cause et je ne l'invente pas.** Sa portée est bornée :
les deux résidus valent **2,9 %** et **39 %** de l'effet qu'ils encadraient
(340 581 canaux), et **aucun verdict de cette note n'en dépend** — toutes mes
comparaisons crop ↔ socle sont des paires prises **au même instant**, et
l'aller-retour de normale fine le plus serré (§1 de N6) rend **0**.

⚠️ **Une chose bouge ENTRE deux exécutions de script** : `uMerTemps` passe de
2,752 à 2,802 d'un `page.evaluate` au suivant. **Le gel ne tient que dans une
exécution** — c'est déjà la règle du chantier, et toutes mes paires y sont.

---

## 3. LES SIX NOTES — LES MÊMES CRITÈRES, LES MÊMES MESURES

### ① Richesse du relief — **6 → 6 → 8 / 10** *(+2)*

**Mesure**, cadrage intérieur, masques appariés à **+0,0118 %**, octet linéaire :

| | crop | socle | | note 02 | note 01 |
|---|---|---|---|---|---|
| **énergie de détail** | **15,727** | **16,044** | ⚡ **crop = 98,02 % du socle** | 65,7 % | 71,0 % |
| écart-type de luminance | **52,759** | 51,532 | ⚡ **crop +2,4 %** | socle +7,7 % | socle +12,6 % |
| luminance moyenne | 101,479 | 113,302 | socle +11,6 % | +10,1 % | +9,0 % |

➡️ ⚡ **LE MANQUE N° 5 DE LA NOTE 02 EST FERMÉ SUR SA PROPRE MESURE**, et je
retrouve les deux chiffres de P9 **sans les lui emprunter** : normale fine
éteinte, le crop rend **10,965**, soit **68,34 %** du socle (P9 publie
**68,3 %**) ; rallumée, **98,02 %** (P9 publie **97,9 %**). **L'apport de la
normale par fragment vaut +43,43 % d'énergie de détail**, aller-retour à
**0 canal**.

⚠️ **ET LE MÉCANISME N'EST TOUJOURS PAS CELUI DU SOCLE, JE LE DIS COMME P9 :**

| | crop | socle |
|---|---|---|
| part de la lumière dans le modelé | **19,93 %** | **45,53 %** |
| énergie, éclairage coupé | 12,592 | 8,739 |

**Le crop met son modelé dans la couleur, le socle dans l'ombre.** L'énergie
totale y est ; la façon de la fabriquer, non.

⛔ **CE QUI COÛTE LES DEUX POINTS QUI RESTENT, ET JE L'AI VU SUR MA PROPRE
DÉCOUPE.** Sur `B3-zoom6-CROP-relief-N03.png` (×6), le relief du crop porte un
**crénelage en escalier le long des crêtes** et des **pixels isolés bruités**
que `B4-zoom6-SOCLE-relief-N03.png` n'a pas — c'est le « léger crénelage » que
P9 déclare dans sa réserve n° 4, et il est visible **au repos**. Sans lui je
mettais 9.

### ② Palette et contraste — **3 → 7 → 7 / 10** *(inchangé)*

Histogramme de teinte en 12 secteurs de 30°, mêmes masques appariés :

| | crop | socle | | note 02 |
|---|---|---|---|---|
| pixels **hors** de la bande orange | 8 047 (**5,56 %**) | 15 880 (**10,98 %**) | socle **×1,975** | ×2,20 |
| secteurs de teinte vides | **2** | 3 | égalité | 2 contre 2 |
| pixels quasi neutres (sat < 0,10) | **34,50 %** | 25,24 % | le crop en a plus | idem |
| saturation moyenne | 0,1711 | 0,2013 | socle **+17,6 %** | +20,8 % |
| écart-type de saturation | 0,1649 | 0,1696 | socle **+2,8 %** | +12,1 % |

**Aucune des quatre tâches livrées depuis la note 02 ne visait la palette, et la
mesure le confirme : rien n'a bougé de façon défendable** (×2,20 → ×1,975 tombe
sous la réserve de palette de la note 02 §0.4).

⚡ **CE QUE J'AJOUTE, PARCE QUE PERSONNE NE L'AVAIT PUBLIÉ : OÙ VA LA MASSE.**

| secteur | crop | socle | |
|---|---|---|---|
| 0–30° (rouge-orangé) | **74 265** | 57 185 | crop ×1,30 |
| 30–60° (ocre) | 12 422 | **35 075** | socle **×2,82** |
| 60–90° (**olive / vert**) | 2 820 | **9 899** | socle **×3,51** |
| 90–120° | 295 | **4 153** | socle ×14,1 |
| 330–360° (**rosé**) | **4 224** | 1 663 | crop **×2,54** |

➡️ **Le « relief brun-rosé là où le socle est olive » que P9 nomme au §0 est
chiffré ici : le socle a 3,5 fois plus d'olive, le crop 2,5 fois plus de rosé.**
Ce n'est pas la rampe (même objet `three` des deux côtés, §0.2) : c'est la
composition de l'ombrage.

### ⚠️ ③ Trait et bordure — **3 → 5 → 6 / 10** *(+1)*

⚖️ **LA CORRECTION DE JUSTICE TIENT, REVÉRIFIÉE** : `uContourOpacity` vaut **0
des deux côtés**. Les courbes de niveau ne comptent pas contre le crop.

**Ce qui a été réparé, et je l'ai mesuré :**

| | crop | socle | | note 02 |
|---|---|---|---|---|
| pixels de **nappe** dans la bande verticale de la paroi (le tablier), côte | **1 053** | **241** | **×4,37** | **×98** |
| lames de mer **sous** le bas du mur | **0** | 0 | égalité | 4 contre 0 |

➡️ ⚡ **Le tablier de mer passe de ×98 à ×4,37.** C'est le gain le plus net de
la note.

**Ce qui casse la note, et c'est nouveau :**

- ⛔ **AU CADRAGE INTÉRIEUR, C'EST LE TERRAIN QUI DRAPE LA PAROI** : **54 379 px**
  de tuiles dans la bande verticale du mur, contre **2 722** au socle — **×20**.
  On le voit en une seconde sur `A1-CROP-interieur-N03.png` : une jupe brune
  continue pend par-dessus l'arête ouest et sud. `A2-SOCLE-interieur-apparie-N03.png`,
  pris à la même seconde, n'a que quelques pointes fines.
  ⚠️ **Réserve honnête** : cette mesure compte aussi le terrain simplement situé
  devant le mur à l'écran, et le masque de paroi du crop est 13 % plus grand que
  celui du socle. **Le facteur exact n'est pas une grandeur que je défends ; le
  défaut, lui, se voit.**
- ⛔ **LA FRANGE CÔTIÈRE EST TOUJOURS QUANTIFIÉE.** `J1-zoom-CROP-frange-N03.png`
  contre `J2-zoom-SOCLE-frange-N03.png`, même échelle, même seconde : le liseré
  du crop est une suite de blocs le long du trait de côte, celui du socle est
  large, continu et turquoise. Chiffré : longueur moyenne des paliers de
  luminance **1,943 contre 1,674**, part des suites de 4 px et plus
  **11,10 % contre 6,58 %**.
- ⚠️ **`contourInterval` reste dans la mauvaise monnaie** : crop **200** (mètres),
  socle **0,29** (unités de scène). **Invisible aujourd'hui, faux dès qu'on
  allume les courbes.** Le non-fermé n° 3 de P6, toujours ouvert.

### ④ La mer — **2 → 5 → 7 / 10** *(+2)*

⚠️ **LE DÉNOMINATEUR D'ABORD.** Masque de mer du crop **76 127 px**, du socle
**78 163** ; **tout est mesuré sur leur INTERSECTION : 75 110 px.**

| sur l'intersection | crop | socle | | note 02 |
|---|---|---|---|---|
| écume (L > 200, sat < 0,25) | **1** | **1** | ⚡ **égalité** | 0 contre 0,002 % |
| luminance moyenne | 76,124 | 59,688 | crop **+27,5 %** | +63,4 % |
| saturation moyenne | 0,4735 | 0,4989 | socle **+5,4 %** | +9,5 % |
| énergie de détail | 2,722 | 3,387 | socle **×1,244** | ×1,48 |
| écart horizontal moyen | 2,179 | 3,017 | socle **×1,384** | ×1,98 |
| bleu profond (210–240°) | **3 067** | 11 238 | *(voir §4 bis)* | 0 contre 7 375 |

⚡ **ET LE FOND MARIN SEUL, NAPPE ÉTEINTE DES DEUX CÔTÉS :**

| | crop | socle | |
|---|---|---|---|
| **énergie de détail du fond marin** | **4,858** | **4,854** | ⚡ **+0,08 %** |
| luminance du fond marin | 130,104 | 107,965 | crop +20,5 % |

➡️ ⚡ **LE FOND MARIN DU CROP A EXACTEMENT LE GRAIN DE CELUI DU SOCLE.** Le
« fond parfaitement lisse » de P8 n'existe plus. P9 publie 4,848 contre 4,839 à
son cadrage ; je mesure 4,858 contre 4,854 au mien.

**Ce qui n'est pas réparé, et je le nomme :** la mer composée reste **+16,7 %
trop claire** sur la région comparable (§4 bis), son détail vaut **80 %** de
celui du socle, sa frange est un escalier (③), et ⛔ **elle porte un PAVAGE
RECTANGULAIRE au large**, visible sur `F1-CROP-cote-N03.png` et à ×6 sur
`J3-zoom6-CROP-nappe-paroi-N03.png` — les nœuds du champ de fond en travers du
bloc. Le socle n'en a pas.

### ⑤ Les parois et la base — **2 → 5 → 6 / 10** *(+1)*

⚡ **LA COULEUR EST JUSTE, ET JE LA PROUVE EN LA BOUGEANT** (une concordance au
défaut n'est pas un branchement) — **et je bouge la couleur VIVANTE de la paroi
du socle, pas `params.plinthColor`, puis je repasse par le chemin de
l'application** (`poserHabillage(contexteCrop().habillage)`) :

| | avant | **pendant le témoin** | après |
|---|---|---|---|
| `plinth.wallMat.color` (socle) | `#c06a44` | **`#c81e1e`** | `#c06a44` |
| `uParoiCouleur` (crop) | `#c06a44` | ⚡ **`#c81e1e`** | `#c06a44` |
| `contexteCrop().habillage.paroiCouleur` | `#c06a44` | — | `#c06a44` |

**204 516 canaux changent, l'aller-retour rend 0.** *(`params.plinthColor` vaut
toujours `#d8d4cc` : c'est bien le matériau qui est lu, pas le paramètre.)*

⚡ **ET L'EXPOSITION S'EST RESSERRÉE, MESURÉE COMME P8 L'A DÉFINIE :**

| | crop | socle | | note 02 |
|---|---|---|---|---|
| face sombre (p20) | **17,87** | **15,88** | crop **×1,125** trop clair | **×1,68** |
| face claire (p80) | 44,50 | 48,36 | crop −8,0 % | +10,6 % |
| contraste inter-faces (p80/p20) | **2,490** | **3,045** | socle **×1,223** | **×1,52** |

**Ce qui manque toujours** : ⛔ **le chanfrein**. Sur
`J4-zoom6-SOCLE-nappe-paroi-N03.png` (×6) on voit **un fin liseré lumineux le
long de l'arête haute** de la paroi ; sur `J3-zoom6-CROP-nappe-paroi-N03.png`,
pris à la même seconde, **rien** — l'arête est franche et nue. Ni l'arrondi bas,
ni aucune des 50 matières.

⚖️ **L'OMBRE PORTÉE N'EST PAS NOTABLE, ET JE REPRENDS LA CORRECTION DE JUSTICE
DE LA NOTE 02 APRÈS L'AVOIR REMESURÉE** : `params.shadowMode = 'off'`,
`sun.castShadow = false`, et **silhouette + ombre = silhouette, des DEUX côtés,
à 0 px près** (crop 215 797 → 215 797 ; socle 211 074 → 211 074 ; retour exact
des deux côtés, `N6-retours-N03.json`). **0 contre 0. Ça ne compte pas contre le
crop.**

### ⑥ Propreté — **3 → 3 → 4 / 10** *(+1, et l'arithmétique est explicite)*

**Le banc est propre** (§2). **L'image l'est devenue en STATIQUE, et elle ne
l'est pas en MOUVEMENT.**

**Les défauts statiques que les deux notes précédentes comptaient :**

| | crop | socle | | note 02 |
|---|---|---|---|---|
| pixels de tuiles **sous** le bas de la paroi (intérieur) | **1** | 0 | ⚡ **fermé** | **2 186** contre 3 |
| **langues distinctes** | **1** | 0 | ⚡ **fermé** | **12** contre 1 |
| lames de mer pendantes sous le mur (côte) | **0** | 0 | ⚡ **fermé** | 4 contre 0 |
| écume en plaques | **absente** | — | fermé depuis la note 02 | — |

⚠️ **UNE NUANCE CONTRE MON PROPRE CHIFFRE, ET JE LA DIS.** `sousLeMur = 0` ne
veut pas dire « plus rien ne pend ». Sur `J3-zoom6-CROP-nappe-paroi-N03.png` je
compte **deux lames bleu sombre** qui descendent dans la paroi, et **quatre à
cinq** sur `F1-CROP-cote-N03.png`. Elles restent **DANS** la bande verticale du
mur, donc la mesure de la note 02 ne les voit pas. **Le compte à zéro est exact
et incomplet ; la capture dit le reste.**

### ⚡ ET LE CLIGNOTEMENT, POUR LA PREMIÈRE FOIS MESURÉ — VOIR §4

notation-01, notation-02, P8 et P9 écrivent tous « je n'ai rien mesuré en
mouvement ». **Je l'ai mesuré, et c'est mauvais** : le crop rend **10,872**
octets de résidu là où le socle en rend **0,030** — **360 fois plus** — et
**38,5 % de ses pixels de surface** bougent de plus de 8 octets pour un
déplacement de caméra d'**un seul pixel**.

**L'arithmétique de la note ⑥ est donc :** défauts statiques quasi tous fermés
(la note passerait à 7), **clignotement mesuré à 360 fois le socle** (−3).
**Net : 4 / 10.**

---

## 4. ⚡ LA MESURE EN MOUVEMENT — CE QUE PERSONNE N'AVAIT FAIT

### 4.1 Comment on mesure un scintillement sans horloge

**Le problème du chantier** : la mer est animée, le grain de pellicule aussi.
Deux prises à des instants différents diffèrent pour des raisons qui n'ont rien
à voir avec ce qu'on cherche. C'est pour cela que **tout** ici est mesuré au
repos.

**La sortie** : on n'a pas besoin du TEMPS, il suffit du DÉPLACEMENT. Je décale
la caméra d'un nombre **ENTIER de pixels** avec `setViewOffset` — **sans
parallaxe, sans toucher un seul angle, sans avancer l'horloge**. L'image rendue
devrait alors être l'image de départ, **translatée d'autant**. Ce qui RESTE
après recalage est le scintillement.

- ⚠️ **Le recalage est CHERCHÉ, pas supposé** : j'essaie tous les décalages de
  −3 à +3 et je publie celui qui minimise. **Il tombe sur le décalage demandé
  dans les 24 cas.**
- ⚠️ **Le masque est ÉRODÉ de 4 px** : sur la silhouette, un décalage découvre du
  fond, et la rasterisation n'y est pas invariante. 135 230 px de surface
  retenus côté crop, 135 174 côté socle.
- ⚡ **Le plancher est mesuré : à `dx = 0`, le résidu vaut 0,000 des DEUX côtés.**
  Sans ce chiffre le reste ne voudrait rien dire.

### 4.2 Le résultat, cadrage intérieur, masque des tuiles

**Résidu moyen après recalage, en octets de luminance** (mêmes masques, même
page, même seconde) :

| décalage | **SOCLE** | **CROP, normale fine ON** | **CROP, normale fine OFF** |
|---|---|---|---|
| **dx = 1 px** | **0,030** | ⛔ **10,872** | 0,863 |
| **dx = 2 px** | 0,001 | ⚡ **0,800** | 0,834 |
| **dx = 3 px** | 0,030 | ⛔ **10,856** | 0,865 |
| pixels instables (> 8 octets) à dx = 1 | **50** (0,037 %) | ⛔ **52 048 (38,49 %)** | 5 (0,004 %) |
| résidu maximal à dx = 1 | 94,15 | **164,33** | 10,36 |

➡️ ⚡ **LA SIGNATURE EST SANS AMBIGUÏTÉ, ET ELLE NOMME LA CAUSE.** Le résidu du
crop est **énorme aux décalages IMPAIRS et nul aux PAIRS**. Un décalage pair
conserve la **parité des quads 2 × 2** sur lesquels le GPU évalue `dFdx`/`dFdy` ;
un décalage impair la retourne. **C'est exactement le mécanisme d'une normale
reconstruite par dérivée d'écran** — celle que P9 a livrée. À décalage pair, le
crop est **aussi stable que tout le reste** (0,800 contre 0,834 sans la normale
fine) : ce n'est donc pas « le crop est bruité », c'est **la parité**.

**Les deux témoins internes le confirment :**
- **normale fine ÉTEINTE** : 0,863 · 0,834 · 0,865 — **aucune signature de
  parité**. Le rapport à l'état livré est de **×12,6**.
- **socle** : 0,030 · 0,001 · 0,030 — **invariant par translation**, comme doit
  l'être une normale par sommet. Rapport : ⛔ **×360**.

### 4.3 Et sur la mer, au cadrage côte

| décalage | SOCLE | CROP normale fine ON | CROP normale fine OFF |
|---|---|---|---|
| dx = 1 px | **0,0076** | ⛔ **1,4617** | 0,3568 |
| dx = 2 px | 0,0008 | 0,4653 | 0,3599 |
| pixels instables à dx = 1 | 10 (0,015 %) | **1 521 (2,34 %)** | 15 (0,023 %) |

➡️ Même signature de parité, **×192 le socle**, mais **beaucoup plus faible en
valeur absolue** : la mer scintille bien moins que le relief.

### 4.4 Les cartes, pour le voir et pas seulement le compter

`E1-carte-scintillement-CROP-N03.png` peint le résidu recalé (échelle : × 8,
saturé à 255). **Tout le bloc s'allume**, les crêtes et les ravines en blanc.
`E3-carte-scintillement-SOCLE-N03.png`, même échelle, même seconde : **noir, à
une poignée de points près.** **C'est l'image de ce qui va grouiller dès que la
caméra glisse.**

### 4.5 ⚠️ CE QUE CETTE MESURE NE DIT PAS

**C'est un PROXY, et je le borne.** Une translation rigide de la fenêtre de
projection isole **la parité des quads** ; elle ne contient **ni parallaxe, ni
changement de LOD, ni mouvement de la houle**. Une vraie orbite ajoutera ces
trois-là. ⚠️ **Le chiffre publié est donc un PLANCHER du scintillement réel, pas
un plafond.** Et il ne dit rien de la fréquence temporelle perçue, qui dépend de
la vitesse de la caméra.

---

## 5. LA NOTE GLOBALE — **6,6 / 10**, contre 5,3 puis 3,5

**Même pondération que les deux notes précédentes**, le relief comptant double
parce que c'est la plus grande surface de l'image.

| critère | note 01 | note 02 | **note 03** | écart | la mesure qui le justifie |
|---|---|---|---|---|---|
| ① Richesse du relief | 6 | 6 | **8** | **+2** | énergie **65,7 % → 98,02 %** du socle ; écart-type de luminance crop **+2,4 %** ; mais crénelage visible au repos et modelé fabriqué à **19,9 %** par la lumière contre **45,5 %** |
| ② Palette et contraste | 3 | 7 | **7** | **=** | hors-orange **×2,20 → ×1,975**, saturation **+20,8 % → +17,6 %** — sous la réserve de palette ; olive **×3,51** au socle, rosé **×2,54** au crop |
| ③ Trait et bordure | 3 | 5 | **6** | **+1** | tablier de mer **×98 → ×4,37** ; mais terrain qui drape la paroi **×20**, frange en marches (paliers 1,943 contre 1,674), `contourInterval` faux |
| ④ La mer | 2 | 5 | **7** | **+2** | fond marin à **+0,08 %** du grain du socle ; écume **1 contre 1** ; détail **×1,48 → ×1,244** ; excès de clarté **+16,7 %** sur la région comparable ; mais pavage rectangulaire visible |
| ⑤ Les parois et la base | 2 | 5 | **6** | **+1** | face sombre **×1,68 → ×1,125**, contraste **×1,52 → ×1,223**, couleur prouvée en la bougeant ; mais toujours aucun chanfrein |
| ⑥ Propreté | 3 | 3 | **4** | **+1** | jupes **2 186 px / 12 langues → 1 px / 1 langue** ; ⛔ **clignotement enfin mesuré : ×360 le socle, 38,5 % des pixels instables** |

`(8×2 + 7 + 6 + 7 + 6 + 4) / 7 = 6,571` → **6,6 / 10**. Moyenne simple : **6,3**.

**⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE — mais pour la première fois il
faut regarder de près pour le dire.** Mettez `A1-CROP-interieur-N03.png` à côté
de `A2-SOCLE-interieur-apparie-N03.png` : le relief est du même ordre de
richesse, la paroi est de la même terracotta, la forme est la même. Ce qui
sépare encore les deux images, à l'œil, sur MES captures : **le crop est
brun-rosé là où le socle est olive**, **son terrain pend par-dessus la paroi**,
**sa mer porte un pavage rectangulaire et une frange en escalier**, et **sa
paroi n'a pas de chanfrein**.

**⚠️ ET LE PROGRÈS EST RÉEL, MESURÉ, ET IL EST GRAND.** Les quatre tâches ont
fermé, chiffres à l'appui : le **rideau d'eau et les jupes** (2 186 px → 1 px,
tablier ×98 → ×4,37), l'**exposition des parois** (×1,68 → ×1,125), le **grain du
fond marin** (à +0,08 % du socle) et le **relief** (65,7 % → 98,0 %).
**+1,3 point.**

**⛔ ET IL A UN PRIX QUE PERSONNE N'AVAIT VU, PARCE QUE PERSONNE N'AVAIT MESURÉ
EN MOUVEMENT.** La normale par fragment qui ferme le relief au repos est **la
seule pièce non invariante par translation de tout le bloc**. Elle est le
premier poste de la liste ci-dessous.

---

## 6. ⚡ CE QUI MANQUE LE PLUS — LA LISTE ORDONNÉE

Rangée par **écart visuel mesuré**, pas par facilité.

### 1️⃣ ⛔ LE SCINTILLEMENT DE LA NORMALE PAR FRAGMENT — *nouveau, et c'est le n° 1*

**10,872 octets de résidu contre 0,030 au socle (×360), 38,49 % des pixels de
surface au-delà de 8 octets, pour UN pixel de déplacement de caméra**, avec la
signature de parité qui nomme la cause (§4.2). **C'est le seul poste de cette
note qui soit une RÉGRESSION en mouvement d'un gain au repos.**

**Où ça vit** : `normaleFineCrop` dans `src/monde/eclairage-crop.js` §6
(l. 581-600), appelée à `src/globe.js:1586-1590` sous `uNormaleFineOn`, avec
`dFdx(vVue)` / `dFdy(vVue)` et les dérivées d'écran de la hauteur.
**Ce que ça coûte** : ⚠️ **on ne le règle pas, on change de loi.** Un gain plus
faible ne fait que réduire l'amplitude d'un défaut qui est **structurel** (la
parité des quads). La sortie est de prendre le gradient **dans l'espace de la
TEXTURE de hauteur** — quatre lectures aux texels voisins, avec
`uUnitesParMetre` qui est déjà posé et vérifié au dernier bit — au lieu des
dérivées d'écran. **Moyen** : deux à quatre `texture()` de plus par fragment de
tuile, contre deux `dFdx` de `vec3` et deux produits vectoriels retirés.
⚡ **Et la preuve est déjà écrite** : le poste est fermé le jour où
`serieDecalage` rend, à `dx = 1`, le résidu qu'il rend à `dx = 2` (**0,800**).
Le harnais est `.banc/vues-notation-03/harnais-N03.mjs` §3, le script
`n3-mouvement.js`.

### 2️⃣ LE TERRAIN QUI DRAPE LA PAROI, ET LES LAMES DE MER QUI PENDENT

**54 379 px de tuiles dans la bande du mur contre 2 722 (×20)** au cadrage
intérieur, **1 053 px de nappe contre 241 (×4,37)** au cadrage côte, plus **deux
à cinq lames** que la mesure ne compte pas parce qu'elles restent dans la bande.
C'est ce qui empêche encore le bloc de se lire comme **un objet**. **Le poste
n° 1 des deux notes précédentes est très largement entamé, pas fermé.**

**Où ça vit** : les jupes de tuiles dans `_buildMesh` (`src/globe.js:4127-4162`,
`skirtDrop` borné par `JUPE_MAX`, l. 473) ; la nappe dans `poserMer` face à
`construireParoisCrop` et à l'anneau haut de la paroi.
**Ce que ça coûte** : **faible à moyen** pour les jupes de tuiles au bord du bloc
(P7 les a déjà remontées à l'intérieur : il reste le bord). **Cher** pour
l'accord à trois de la nappe, comme les deux notes précédentes l'écrivaient.

### 3️⃣ LA LAME D'EAU 1,34 FOIS TROP CLAIRE — *la piste n° 1 de P9, et elle vaut les 16,7 % qui restent*

Le fond marin du crop a **le grain du socle à +0,08 %** et **la bonne couleur à
la bonne profondeur** (P9 §2.3). Ce qui reste — **+16,7 % de clarté et 80 % du
détail sur la mer composée** — vit dans la **lame d'eau**, dont P9 mesure qu'elle
est **1,34 fois trop claire à opacité (0,603 contre 0,609) et teinte (210-225°)
égales**, facteur uniforme sur les trois canaux, **cause non identifiée**.
**Je n'ai pas rejoué son A/B à trois fonds et je ne prétends donc pas confirmer
ce facteur** — je constate qu'après sa tâche l'écart de clarté est **+16,7 %**
sur la région comparable, et **+27,5 %** sur tout le masque.

**Où ça vit** : le matériau de `crop-mer` (`poserMer`, `src/globe.js`) face à
`real-water` du socle ; la recette d'extraction est `.banc/P9/s3-lame.js`.
**Ce que ça coûte** : inconnu tant que le terme n'est pas trouvé. **La mesure
existe déjà** — c'est la moitié la moins chère du travail.

### 4️⃣ LA FRANGE CÔTIÈRE EN MARCHES, ET LE PAVAGE RECTANGULAIRE DE LA MER

Deux visages d'une même cause : **la résolution du champ de fond** (128 nœuds en
travers du bloc). La frange : paliers de luminance **1,943 contre 1,674**, part
des suites de 4 px et plus **11,10 % contre 6,58 %**, et l'escalier se voit sur
`J1` contre `J2`. Le pavage : visible au large sur `F1` et à ×6 sur `J3` ; le
socle n'en a pas.

**Où ça vit** : le champ cuit vers `src/globe.js:3120-3128`, et le déclin côtier
qui en dépend.
**Ce que ça coûte** : tripler `CHAMP_FOND` coûte neuf fois `remplirHauteurs` —
**cher**. ⚡ **La route moins chère est celle que la note 02 avait déjà trouvée**
et que personne n'a prise : **le trait de côte a déjà un masque à la résolution
du MNT** (`uCoastMask`, `uMargeCoteM`) ; faire porter la frange par CE masque
plutôt que par le champ est **moyen**, et ferme la moitié visible du poste sans
payer les neuf fois.

### 5️⃣ LA PEINTURE : LE CROP EST ROSÉ LÀ OÙ LE SOCLE EST OLIVE

Socle **×2,82** dans l'ocre (30-60°), **×3,51** dans l'olive (60-90°),
**×14** dans le vert (90-120°) ; crop **×2,54** dans le rosé (330-360°).
Saturation du socle **+17,6 %**, masse hors-orange **×1,975**. ⚠️ **Ce n'est PAS
la rampe** : rampe et texture d'analyse sont **le même objet `three` des deux
côtés**, vérifié par uuid à la même seconde. C'est la **composition de
l'ombrage** — et P9 mesure que la couleur nue du crop est déjà **plus riche** que
celle du socle (10,250 contre 8,723), donc il y a **trop** de peinture, mal
répartie en teinte.

**Où ça vit** : la chaîne `col = …` du nuanceur de fragment des tuiles
(`src/globe.js`, ~l. 1039-1240) et le terme d'irradiance de
`src/monde/eclairage-crop.js` ; côté socle, `mapTint` et la lumière
d'hémisphère (ciel `#85c2eb`, **sol `#4a3a2a`** — c'est le SOL brun qui manque
sans doute le plus).
**Ce que ça coûte** : **moyen**, et ⚠️ **le vrai travail est l'accord
d'exposition**, pas le branchement — la faute que D13 §③ demande d'éviter.

### Et derrière, dans l'ordre

6️⃣ **Le chanfrein et l'arrondi des parois** (`SOCLE_CHANFREIN`, `SOCLE_ARRONDI`
dans `plinth.js`) — visibles sur `J4`, absents sur `J3`. **Moyen.**
7️⃣ **`contourInterval` dans la mauvaise monnaie** (crop 200 m, socle 0,29 unité
de scène) — invisible tant que `uContourOpacity = 0` des deux côtés, **faux dès
qu'on allume les courbes**. **Faible.**
8️⃣ **L'ombre portée** — ⚠️ **non notable aujourd'hui**, remesurée : 0 px des deux
côtés, retour exact. **À rouvrir dans un état de page où le socle porte son
ombre**, pas avant.
9️⃣ **La grille métrique** (`gridStep`, `gridColor`, `gridOpacity`) — non portée,
invisible tant que `gridOpacity = 0`.
🔟 **Non portés du tout, et je ne les ai pas mesurés parce qu'ils n'apparaissent
sur AUCUNE de mes captures, des deux côtés** : le cartouche au sol, les effets de
surface, le scanner, les 50 matières de parois.

---

## 7. ⛔ LA CORRECTION QUE P9 M'OPPOSE : ELLE TIENT, ET JE CORRIGE LA NOTE 02

La note 02 écrivait, critère ④ : *« teinte 210–240° (bleu profond) : **0** au
crop, **7 375** au socle — le crop n'a **aucun** bleu profond »*, et
*« la mer du crop est **63,4 %** trop claire »*.

P9 §2.4 répond que ce comptage est biaisé. **Je l'ai refait moi-même, avec SON
critère — « le socle a-t-il quelque chose sous sa mer ? », c'est-à-dire son fond
rendu nappe éteinte à trois canaux nuls — sur MES masques, à MON cadrage, dans
MA page** (`N4-mer-N03.json`, `n4-mer.js`) :

| sur l'intersection des deux masques de mer (**75 110 px**) | pixels | socle lum. | socle bleu profond | crop lum. | crop bleu profond |
|---|---|---|---|---|---|
| ⛔ **le socle compose sur du VIDE** | **10 876 (14,48 %)** | **17,70** | ⛔ **10 414** | 65,30 | 239 |
| **les deux ont un fond marin** | **64 234** | **66,80** | **824** | **77,96** | ⚡ **2 828** |
| tout le masque | 75 110 | 59,69 | 11 238 | 76,12 | 3 067 |

**Mes chiffres contre ceux de P9, indépendamment mesurés :**

| | P9 | **moi** | écart |
|---|---|---|---|
| part de l'intersection où le socle compose sur du vide | 14,51 % | **14,48 %** | 0,2 % |
| part du bleu profond du socle qui vit là | 92,3 % | **92,67 %** | 0,4 % |
| bleu profond sur la région comparable, crop contre socle | 2 824 / 864 | **2 828 / 824** | 0,1 % / 4,6 % |
| pixels du crop eux aussi vides dans cette région | 175 | **177** | 1,1 % |
| excès de clarté sur la région comparable | +16,8 % | **+16,71 %** | 0,5 % |

➡️ ⚡ **LA CORRECTION EST CONFIRMÉE, ET JE LA DIS SANS DÉTOUR.**

1. **Le chiffre « 0 contre 7 375 » de la note 02 comparait une mer à une
   silhouette sur 14,5 % de sa surface**, et c'est là que vivait **92,7 %** du
   bleu profond du socle.
2. ⛔ **Sur la région où les DEUX côtés ont vraiment un fond marin, le crop a
   PLUS de bleu profond que le socle : 2 828 contre 824.** L'affirmation « le
   crop n'a AUCUN bleu profond » est **fausse aujourd'hui**, et elle était
   **mal pesée** quand elle a été écrite.
3. **L'excès de clarté vaut +16,71 %, pas +63,4 %** — et le chiffre « tout le
   masque » (+27,5 %) est lui-même tiré vers le haut par la même région.

⚡ **ET JE LE VOIS, PAS SEULEMENT JE LE COMPTE.** `G1-carte-socle-sans-fond-N03.png`
peint en **rouge** les 10 876 pixels en question : c'est **une bande étroite le
long de l'arête LOINTAINE du bloc**, là où le plan d'eau du socle dépasse sa
propre silhouette de terrain. Ce n'est pas une mer, c'est un bord.

⚠️ **ET JE REPRENDS LA RÉSERVE DE P9 PLUTÔT QUE DE LA TAIRE** : le « vide » est
la couleur de nettoyage **du banc** ; dans l'application cette bande composerait
sur le fond de page. **Je n'affirme donc pas que le socle a un défaut là.**
J'affirme, plus étroitement et cela suffit : **sur 14,48 % de l'intersection on
ne compare pas deux mers, et c'est là que vivait le chiffre-titre de la note
02.**

⚖️ **En toute justice pour mon prédécesseur** : sa règle du dénominateur —
« tout se mesure sur l'intersection » — est celle qui a rendu la correction
possible. Le biais n'est pas dans sa méthode, il est **d'un cran plus fin que ce
que sa méthode voyait**.

---

## 8. MES RÉSERVES

1. ⚠️ **UN SEUL LIEU, DEUX CADRAGES.** Tout est sur La Réunion z12, aux deux
   endroits de notation-01 et notation-02. **Un crop continental (donc sans
   mer), un crop de haute latitude, un crop à plateau peu profond ne sont pas
   jugés ici.**
2. ⚠️ **LA MESURE EN MOUVEMENT EST UN PROXY, ET C'EST UN PLANCHER.** §4.5 :
   translation rigide de la fenêtre de projection, sans parallaxe, sans LOD qui
   change, sans houle. Elle isole la parité des quads — le mécanisme dominant —
   **elle ne mesure pas tout le scintillement d'une vraie orbite.**
3. ⛔ **DEUX RÉSIDUS INTER-RENDUS NON EXPLIQUÉS** (9 747 et 134 214 canaux), **non
   reproduits** par les huit étapes de `n7-diagnostic.js` qui rendent 0. §2 dit
   leur portée : aucun verdict n'en dépend.
4. ⚠️ **PAS DE COMPOSITEUR.** Il s'applique identiquement aux deux
   (`composer.addPass(passeFond, 0)` met `sceneGlobe` dans le même compositeur),
   donc il ne biaise aucun écart, **mais mes images ne sont pas exactement celles
   qu'Adrien voit.**
5. ⚠️ **LES VALEURS ABSOLUES DE COULEUR NE SE COMPARENT PAS D'UNE NOTE À
   L'AUTRE** (règle de notation-02 §0.4). Seuls les ÉCARTS crop ↔ socle mesurés
   dans une même page se comparent, et c'est ainsi que le §5 est écrit. **Le sens
   du « ×2,20 → ×1,975 » du critère ② n'est donc PAS un progrès que je défends :
   je le lis comme « rien n'a bougé ».**
6. ⚠️ **LES DEUX MASQUES DE PAROI N'ONT PAS LA MÊME ÉTENDUE** (crop 68 301 px,
   socle 60 252). Le profil se compare en **percentiles**, comme P8 l'a défini,
   pas en surface — mais le **×20** du critère ③ est, lui, une surface, et je le
   déclare comme un ordre de grandeur.
7. ⚠️ **LES DEUX DÉCOUPES ×6 DU RELIEF NE MONTRENT PAS LE MÊME MORCEAU DE
   TERRAIN** (le socle est à `k = 1,0095`, donc recadré). **Je m'en sers pour
   juger la TEXTURE, jamais pour comparer un pixel à un pixel.**
8. ⚠️ **JE N'AI PAS REJOUÉ L'A/B À TROIS FONDS DE P9** sur la lame d'eau. Le
   « 1,34 fois trop claire » du poste n° 3 est **son chiffre, pas le mien** ; ce
   qui est de moi est le **+16,71 %** qui reste sur la région comparable.
9. ⚠️ **JE N'AI PAS MESURÉ LE COÛT EN TEMPS DE RENDU.** P9 déclare un varying et
   quatre dérivées de plus par fragment de tuile, non chronométrés. **Je ne les
   chronomètre pas non plus**, et la solution que je propose au poste n° 1 en
   ajouterait d'autres : **elle demande une mesure de coût avant d'être posée.**
10. ⚠️ **LA PRODUCTION EST INTOUCHÉE, RELEVÉ** : drapeau baissé,
    `uNormaleFineOn = 0`. Tout ce que cette note juge vit derrière le drapeau.

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/vues-notation-03/` — **29 captures PNG**, **7 relevés JSON**, le harnais
(`harnais-N03.mjs`, qui **importe** `../P9/harnais-P9.mjs` → P8 → P7 → N02 → P5
→ P4 → P3 ; il n'écrit que `apparier`, `luminance`, `masqueErode`,
`residuDecalage` et `serieDecalage`), le récepteur (`recois-N03.mjs`, port 5613)
et les sept scripts de page `n1` à `n7`. Le pilote est celui de P9,
**réemployé tel quel** (`.banc/P9/pilote-P9.mjs`, avec `--lat` / `--lon`).

**Les paires à regarder d'abord :**

- ⚡ **`E1-carte-scintillement-CROP-N03.png` ↔ `E3-carte-scintillement-SOCLE-N03.png`**
  — **la carte de ce qui va grouiller en mouvement, et le noir d'en face.** Si
  vous ne regardez qu'une paire, c'est celle-là.
- `A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`
  (**+0,0118 %**) — les deux blocs, le relief à parité, le rosé contre l'olive,
  et le terrain qui drape la paroi
- `A3-CROP-sans-normale-fine-N03.png` — **le même crop à 68,3 %**, pour voir ce
  que P9 a apporté
- `F1-CROP-cote-N03.png` ↔ `F2-SOCLE-cote-apparie-N03.png` (**−0,0403 %**) — les
  deux mers
- ⚡ `G1-carte-socle-sans-fond-N03.png` — **les 14,48 % où le socle compose sa mer
  sur du vide**, la correction du §7 en une image
- `J3-zoom6-CROP-nappe-paroi-N03.png` ↔ `J4-zoom6-SOCLE-nappe-paroi-N03.png` (×6)
  — le tablier, les deux lames, le pavage — contre l'arête unique, le fil cyan et
  **le chanfrein**
- `J1-zoom-CROP-frange-N03.png` ↔ `J2-zoom-SOCLE-frange-N03.png` — **la frange en
  marches contre la frange continue**
- `B3-zoom6-CROP-relief-N03.png` ↔ `B4-zoom6-SOCLE-relief-N03.png` (×6) — **le
  crénelage au repos**
