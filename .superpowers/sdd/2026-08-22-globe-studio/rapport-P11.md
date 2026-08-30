# Tâche P11 — LA PEINTURE ROSÉE, ET LE TERRAIN QUI DRAPE LA PAROI

**Statut : LIVRÉE. LE MANQUE N° 5 EST FERMÉ SUR SA PROPRE MESURE ; LE MANQUE
N° 2 EST ENTAMÉ, PAS FERMÉ, ET SON RESTE A UNE CAUSE NOMMÉE ET CHIFFRÉE.**
Commits **`a2ad723`**, **`6890c78`**, **`6d535be`**, **`bd03cc6`** et
**`bf03bfe`** sur `regroupement` (arbre propre après commit, `.banc/` est
`.gitignore`).

`npm test` — **4 055 / 4 055** (4 029 au départ, **+26**) ·
`npm run audit:tests` — **210 / 210** · `node --check` sur les quatre fichiers
de `src/` touchés, les six fichiers de test et les deux scripts du banc ·
campagne de mutation — **71 / 71**, dont **59 visant le branchement (83,1 %)**,
en **TROIS tours** · page chargée **drapeau levé ET baissé**.

---

## 0. LES DEUX CHIFFRES QU'ON M'A DEMANDÉS, D'ABORD

**Banc : celui du noteur, rejoué SANS UNE LIGNE MODIFIÉE.** `.banc/P9/pilote-P9.mjs`
(le pilote), `n1-etat-relief-palette.js`, `n3-mouvement.js` et
`n5-trait-proprete-mouvement.js` de `.banc/vues-notation-03/`, harnais
`harnais-N03.mjs` compris. **Seul le récepteur change** (`.banc/P11/recois-P11.mjs`,
même port 5613, autre dossier). Cadre **1 280 × 800**, La Réunion, cadrage
intérieur **lat −21,115 · lon 55,536** et cadrage côte **lat −21,05 · lon 55,25**,
z12, vue isométrique 0, **rendu dans une cible à profondeur, sans compositeur,
boucle rAF gelée, socle rallumé dans la MÊME page**.

### ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est celle du noteur, de
P7, P8, P9 et P10 — et je la prouve en retrouvant ses constantes :
`heightContrast / heightPivot` = **2,2 / 0,41** au cadrage intérieur (sa preuve
de lieu), **594 434 sommets** au `terrain.mesh`, rampe et texture d'analyse
**même objet `three` des deux côtés**, témoin nul à **0 canal sur 4 096 000**,
`uMerTemps` **immobile** aux deux relevés.

### 0.1 ⚡ LA PALETTE — `.banc/P11/N1-etat-relief-palette-N03.json`

Masques appariés à **+0,0007 %** (cible 144 688, socle 144 689), même page,
même seconde. La colonne « avant » est le relevé de P10 au même script et au
même cadrage (`.banc/P10/N1-etat-relief-palette-P10.json`).

| secteur de teinte | **avant** | **après** | **SOCLE** |
|---|---|---|---|
| 0–30° rouge-orangé | 73 949 | **57 083** | **57 166** |
| **30–60° ocre** | 12 219 | **33 257** | **34 725** |
| **60–90° OLIVE** | **2 691** | **10 938** | **9 999** |
| **90–120° vert** | 290 | **5 282** | **4 150** |
| **330–360° ROSÉ** | **4 326** | **2 260** | **1 625** |
| pixels quasi neutres | 34,88 % | **24,18 %** | **25,00 %** |
| masse hors-orange | 5,59 % | **13,38 %** | 11,49 % |
| saturation moyenne | 0,1711 | **0,2374** | 0,2051 |

| rapport du noteur | notation 03 | après P10 | **après P11** |
|---|---|---|---|
| hors-orange, socle / crop | **×1,975** | ×1,977 | ⚡ **×0,859** |
| saturation, socle / crop | +17,6 % | +17,9 % | ⚡ **−13,6 %** |

➡️ ⚡ **L'OLIVE PASSE DE ×3,71 EN FAVEUR DU SOCLE À ×1,09 EN FAVEUR DU CROP**, et
**les neutres tombent à 0,8 point du socle** (24,18 contre 25,00) là où le
noteur mesurait 9,6 points d'écart. ⚠️ **Et ça DÉPASSE** : le crop est désormais
**15,7 % plus saturé** que le socle et porte **16 % de hors-orange en trop**. Le
signe s'est inversé, l'amplitude a peu bougé sur la saturation. **Je le déclare
au §5, réserve n° 1.**

### 0.2 ⚡ LE RÉSIDU EN MOUVEMENT — `.banc/P11/N3-mouvement-N03.json`

**C'est la preuve que je n'ai pas réintroduit le scintillement que P10 a fermé.**
Masques érodés de 4 px (crop **135 489**, socle **135 174**), appariés à
**−0,0276 %**, **plancher à `dx = 0` mesuré à 0,000 des deux côtés**, **retour
exact à 0 canal dans les 24 séries**, **recalage tombant sur le décalage demandé
dans les 24 cas**.

| décalage | SOCLE | **CROP normale fine ON** | CROP OFF | | P10 |
|---|---|---|---|---|---|
| **dx = 1 px** | 0,0302 | ⚡ **0,8175** | 0,8664 | | 0,8143 |
| dx = 2 px | 0,0013 | 0,7803 | 0,8276 | | 0,7865 |
| **dx = 3 px** | 0,0305 | ⚡ **0,8195** | 0,8680 | | 0,8163 |
| pixels instables (> 8 o) à dx = 1 | 48 | **11** | 16 | | 6 |
| résidu maximal à dx = 1 | 94,08 | **15,08** | 15,15 | | 10,57 |

➡️ ⚡ **AUCUNE SIGNATURE DE PARITÉ N'EST REVENUE** : 0,8175 · 0,7803 · 0,8195,
et le micro-écart pair/impair reste **celui de la colonne OFF** (0,8664 ·
0,8276 · 0,8680). **Le résidu de la normale fine reste SOUS son propre plancher
sans elle**, exactement comme P10 l'avait livré.

⚠️ **ET IL MONTE UN PEU, JE NE LE CACHE PAS** : 0,8143 → 0,8175 (**+0,4 %**),
pixels instables 6 → 11, résidu maximal 10,57 → 15,08. **La cause est
arithmétique et elle est la mienne** : la pente de la rampe est multipliée par
**3,12** (§1.2), donc tout ce qui bougeait déjà d'un octet de couleur en bouge
maintenant de trois. **La colonne OFF, qui ne porte aucune normale fine, monte
de la même façon** (0,8627 → 0,8664), et `cropSansEclairage` aussi
(0,8350 → 0,8547) : ce n'est pas la normale, c'est la rampe. **Sur la mer,
cadrage côte, rien ne bouge du tout** : 0,3620 → 0,3615 à dx = 1, socle 0,0072 →
0,0061.

---

## 1. ⛔ LE MANQUE N° 5 — ET CE N'ÉTAIT PAS « LA COMPOSITION DE L'OMBRAGE »

### 1.1 Ce que j'ai coupé en deux avant de chercher

Le noteur donnait une clé : *« la rampe est LE MÊME OBJET `three` des deux
côtés — c'est la COMPOSITION DE L'OMBRAGE. »* **Il a raison de dire que ce n'est
pas la rampe. Il se trompe sur l'ombrage, et la mesure le dit.**

`albedo × irradiance / π = pixel`. On peut donc rendre **l'albédo seul** en
posant, des DEUX côtés, une irradiance NEUTRE d'exactement `π` : côté crop
`uSoleilIrr = 0`, `uCielIrr = uSolIrr = (π, π, π)` ; côté socle soleil éteint,
hémisphère blanc d'intensité `π`, `scene.environment` débranché, spéculaire
coupé. **Aller-retour à 0 canal des deux côtés**, 523 617 et 599 735 canaux
déplacés par le témoin (`.banc/P11/D1-palette-P11.json`) :

| secteur | crop, ALBÉDO SEUL | socle, ALBÉDO SEUL |
|---|---|---|
| 30–60° ocre | **3 626** | **27 866** |
| 60–90° olive | ⛔ **0** | **4 199** |
| 330–360° rosé | **7 510** | 1 433 |

➡️ ⛔ **L'ÉCART VIT DANS L'ALBÉDO, PAS DANS L'IRRADIANCE.** Irradiance
neutralisée, le crop n'a **pas un seul pixel d'olive**. L'ombrage n'y est pour
rien : il ATTÉNUE l'écart (rosé ×5,2 sur l'albédo nu, ×2,6 sur l'image vivante).

### 1.2 ⛔ LA CAUSE : UNE ANCRE, ET ELLE N'EST JUSTE QUE SI LE CROP A DE LA MER

Le nuanceur écrivait, depuis la Tâche P2 :

```glsl
float hNormRelief = clamp((h + uOceanDepth) / max(uLandMax + uOceanDepth, uPlancherRampeM), 0.0, 1.0);
```

en justifiant l'égalité par *« le minimum du relief du crop EST `-uOceanDepth`
(`rampe-crop.js` : `profondeur = -min(0, minM)`) »*. **C'est vrai d'un crop qui a
de la mer, et faux de tous les autres.** `uOceanDepth` est un **BUDGET DE
PROFONDEUR** : sans un seul point sous le niveau de la mer, `echelleRampe` rend
le **PLANCHER DE DIVISION** — un aveu, pas une grandeur —, `echelle-continue.js`
§4 refuse (**à raison**) d'ancrer une mesure dégénérée, et l'uniforme garde la
valeur **MONDIALE de 6 000 m**.

⚡ **RELEVÉ DANS LA PAGE VIVANTE, LE 2026-08-23** (`D2-ancre-basse-P11.json`) —
La Réunion, cadrage intérieur, **un bloc entièrement terrestre** :

| | posé | mesuré (`globe._rampe`) |
|---|---|---|
| `uLandBas` / `terreBas` | 130 | 107,464 |
| `uLandMax` / `terreHaut` | 3 026 | 3 009,642 |
| **`uOceanDepth` / `profondeur`** | ⛔ **6 000** | **0,0175** *(le plancher)* |

Et le socle, au même instant : `uHeightRange = [−4,945 ; 7,161]` unités pour
`uSeaY = −5,409` — **un MNT dont le minimum est AU-DESSUS du niveau de la mer**.

**Ce que ça donne, en arithmétique** (contraste 2,2) :

| | crop, avant | socle |
|---|---|---|
| hNorm du niveau de la mer | **0,6647** | **négatif** |
| plancher de pivot | **0,6847** | 0,02 |
| pivot retenu | ⛔ **0,6847** | **0,41** |
| `rampT` à h = 0 m | ⛔ **0,48** | **0** |

➡️ ⛔ **LE CROP N'ATTEIGNAIT JAMAIS LA MOITIÉ BASSE DE SA PROPRE TABLE** — c'est
l'olive et l'ocre du socle, ×3,51 et ×2,82, que le crop remplaçait par du rosé.

⚡ **ET C'EST PROUVÉ EN LE BOUGEANT, DANS LES DEUX SENS, ALLER-RETOUR À 0 CANAL**
(une concordance au défaut n'est pas un branchement) :

| secteur | ancre à **−6 000** *(le départ)* | ancre à **+130** *(la loi du socle)* | ancre à **−12 000** | SOCLE |
|---|---|---|---|---|
| 60–90° olive | 2 689 | ⚡ **10 930** | ⛔ **7** | 9 964 |
| 90–120° vert | 297 | ⚡ **5 286** | ⛔ **0** | 4 202 |
| 330–360° rosé | 4 310 | **2 259** | ⛔ **8 217** | 1 646 |
| hors-orange | 5,58 % | **13,37 %** | 5,71 % | 11,05 % |

**416 563 et 428 907 canaux déplacés, retour à 0 canal les deux fois.**

⚠️ **ET UNE PREMIÈRE VERSION DE CE BANC A CORROMPU SON PROPRE ÉTAT.** Elle
appelait `poserRampe({ echelle: _rampe })` « pour voir » au milieu de la mesure :
tous les aller-retours d'après comparaient à une image de départ périmée
(**414 647 canaux de retour, deux fois le même nombre**). **Le chiffre a été
jeté et la mesure refaite.** C'est écrit dans le script, pour que ce ne soit
jamais une surprise.

### 1.3 Ce qui est livré

**Une cinquième grandeur ancrée, `creux` = `terreBas − minM`.** Deux propriétés,
et aucune n'est de confort :

- **POSITIVE** — la courbe d'ancrage mélange en `log1p(max(0, v))`
  (`echelle-continue.js` §6) : un champ négatif y serait écrasé à zéro **sans
  qu'aucune erreur ne soit levée** ;
- **RELATIVE À `terreBas`** — `terreBas − creux` rend `minM` au bit près, et il
  le rend **ENCORE après interpolation**, parce que les deux champs glissent
  ensemble sur la même courbe.

⚡ **ET ELLE N'A PAS DE CAS DÉGÉNÉRÉ** : `creux = 0` n'est pas « je ne sais pas »,
c'est « aucun point de ce crop ne descend sous sa terre la plus basse » — un
FAIT, mesuré sur les mêmes `pas²` points que `terreBas`. C'est pourquoi
`champsUtiles` **ne lui applique PAS le test du plancher**, et le dit en toutes
lettres.

Le nuanceur lit `uReliefBas`, et **son défaut `RAMPE_MONDE` vaut `−6 000`**,
c'est-à-dire `−profondeur`, c'est-à-dire **l'écriture d'avant P11 au bit près**.
`test/crop-rampe.test.js` ②e le rejoue sur 2 001 hauteurs par `Object.is`, et la
clôture drapeau baissé le relève dans la page (§4).

⚡ **ET LE MÊME CORRECTIF RÉPARE TROIS LECTEURS D'UN COUP**, parce qu'ils lisent
tous `hNormRelief` : la rampe (`natRampT`), l'humidité et **la limite des arbres**
(`natHumiditeY` — elle tombait à **2 304 m** au lieu de 2 794, le socle étant à
2 778), et le voile aérien (`natVoile`). Plus `natGris`, la valeur par sommet du
socle, qui ne parcourait que la tranche `[0,67 ; 0,96]` de sa propre loi.

---

## 2. ⛔ LE MANQUE N° 2 — CE N'EST PAS LA JUPE, ET JE L'AI MESURÉ

### 2.1 La jupe est hors de cause, et le témoin est à 0 canal

Le noteur cite `_buildMesh` et `JUPE_MAX`. **P7 avait déjà divisé les jupes par
2 186 ; le brief de P11 disait « ce qui reste est autre chose ». Il a raison.**

`.banc/P11/d3-paroi.js` **éteint les jupes dans la page vivante** — il retire
leurs triangles du tampon d'indices par `setDrawRange`, tuile par tuile, sur les
**176 tuiles** concernées — puis remet :

| | avec jupes | **sans jupes** |
|---|---|---|
| pixels de tuiles | 144 741 | 144 594 |
| `dansLaBande` (la mesure du noteur) | **54 430** | **54 356** |
| canaux du témoin | — | **1 183** |
| **retour** | — | ⚡ **0 canal** |

➡️ ⛔ **LA JUPE VAUT 0,14 % DU POSTE.** Le reste est la surface elle-même.

### 2.2 ⛔ CE QUI RESTE : DEUX SURFACES QUI DEVRAIENT ÊTRE LA MÊME

L'anneau haut de la paroi se posait sur `globe.hauteurSurface`, c'est-à-dire sur
la **TEXTURE** de hauteur (256 texels par tuile, bilinéaire), à **256 points par
côté**. Le GPU, lui, dessine le **MAILLAGE** de la tuile : `segmentsTuile(z)`
quads, soit **vingt-quatre à z12**, donc **vingt-cinq sommets par côté**. Les
deux ne peuvent pas coïncider.

**Mesuré sur les 1 020 points de l'anneau, page vivante**
(`.banc/P11/M1-bord-avant.json`) :

| écart anneau − maillage | mètres | pixels d'écran |
|---|---|---|
| moyenne | −1,86 | −0,061 |
| **moyenne des valeurs absolues** | **18,94** | **0,650** |
| p05 / p95 | −54,10 / +46,68 | −1,79 / +1,63 |
| **extrêmes** | ⛔ **−270,57 / +202,44** | ⛔ **−9,77 / +7,27** |

➡️ **ET LE SIGNE CHANGE, C'EST TOUT LE DÉFAUT.** Là où l'anneau passe SOUS le
maillage, la surface pend par-dessus l'arête haute — le « drapé » du noteur. Là
où il passe au-dessus, on voit du mur là où le socle montre du terrain.

### 2.3 Ce qui est livré

`hauteurDessinee` rejoue la loi de nœud de `_buildMesh` — `altitudeMaillage ∘
sampleHeights`, **au lat/lon de CHAQUE nœud** — et l'interpole comme le tampon
d'indices : la diagonale est `b–c`, c'est-à-dire `su + sv = 1`, parce que
`_buildMesh` écrit `indices.push(a, c, b, b, c, d)`. La paroi la lit.

⚠️ **ET `poserRampe` RESTE SUR `hauteurSurface`, DÉLIBÉRÉMENT.** Le nuanceur
colore par `decodeMetersAA(vUv)` : il lit la donnée à SA résolution, et c'est ce
qui fait la richesse du crop. **La géométrie lit le maillage, la couleur lit la
donnée** — deux questions différentes, et les confondre est ce qui a produit le
drapé. `test/maillage-tuile.test.js` ⑤b tue la mutation qui bascule les deux.

`gridFor` devient `segmentsTuile` dans un module pur : elle a **deux** lecteurs
depuis que la paroi relit la grille, et une table recopiée diverge en silence.

⚠️ **L'INTERPOLATION EST CELLE DES HAUTEURS, PAS CELLE DES POSITIONS, ET LA
FLÈCHE EST MESURÉE, PAS SUPPOSÉE** : le GPU interpole des points 3D, donc le
rayon dessiné passe SOUS l'interpolation des rayons, de `d² / (8 R)` —
**3,3 mm** à z12. `test/maillage-tuile.test.js` ③a et ③b la confrontent à
`latLonToSphere` **du dépôt** et exigent moins d'un centimètre.

### 2.4 ⛔ CE QUE ÇA RAPPORTE À L'ÉCRAN, ET C'EST MODESTE

**Les nombres du CROP seul — ils ne dépendent d'aucun appariement** (cadrage
intérieur, `M1-bord-avant.json` contre `M1-bord-apres.json`) :

| | avant | **après** | socle |
|---|---|---|---|
| pixels de paroi | 68 201 | **67 699** | 60 252 |
| pixels de surface | 144 741 | 144 688 | 152 038 |
| **part de paroi dans le bloc** | **32,099 %** | **31,942 %** | **28,37 %** |
| `dansLaBande` | 54 430 | **53 130** | 2 722 |

➡️ ⛔ **J'AI FERMÉ 4,2 % DE L'ÉCART DE PART DE PAROI** (3,73 → 3,56 points), et
**2,4 % du `dansLaBande`**. **Ce n'est pas la fermeture du poste, et je ne la
revendique pas.**

⚡ **LE RESTE A UNE CAUSE NOMMÉE ET CHIFFRÉE, ET ELLE EST CHÈRE** : la
**RÉSOLUTION** du maillage. Le socle porte **594 434 sommets** sur son bloc (res
768 sur trois tuiles de 256 texels : **un sommet par pixel de MNT**) ; le crop en
porte **5 625** (9 × 25²). **Sa silhouette est donc 10,7 fois plus grossière**, et
une corde tendue par-dessus une ravine étroite passe TOUJOURS au-dessus d'elle :
la surface perd de l'aire au profit du mur, systématiquement. **Fermer ce
poste-là, c'est payer les 594 434 sommets du socle** — ou une part d'entre eux
sur les seules tuiles du crop, `tuileDansCrop` sachant déjà les désigner.
**Je ne l'ai pas fait, et ce n'est pas une décision de confort : c'est un
changement de budget de géométrie qui demande sa propre mesure de coût.**

---

## 3. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

`.banc/P11/A1-CROP-interieur-N03.png` contre
`.banc/P11/A2-SOCLE-interieur-apparie-N03.png`, **rendus à la même seconde, dans
la même page, masques appariés à +0,0007 %.** Le témoin d'avant est
`.banc/P10/A1-CROP-interieur-P10.png`, pris au même protocole par P10.

**Ce qui a changé, et ça saute aux yeux :** le crop de P10 est une île de Mars —
brun-rosé uniforme, du littoral au sommet, sans une trace de vert. Le crop de
P11 a **les ravines olive**, **les plateaux ocre**, **les rouges chauds du
cirque** et **les blancs des crêtes**, aux mêmes endroits que le socle. **La
famille de couleurs est la même.** C'est le changement d'image le plus visible
que j'aie vu sur ce chantier.

**Ce qui sépare encore les deux images, à l'œil, sur MES captures :**

1. ⛔ **LE CROP EST PLUS CLAIR ET PLUS CONTRASTÉ.** Luminance moyenne **122,99
   contre 113,32** (+8,5 %), écart-type **59,83 contre 51,85** (+15,4 %). Les
   blancs des crêtes brûlent là où le socle garde du gris, et les verts sont
   plus francs. **C'est le prix de mon correctif, §5 réserve n° 1.**
2. ⛔ **LA PAROI DU CROP EST UN ROUGE VIF LÀ OÙ CELLE DU SOCLE EST UN BORDEAUX
   SOMBRE.** Ce n'est pas de moi — c'est le reste que P8 déclare ne pas avoir
   fermé (l'azimut du studio, `mix(sol, ciel, 0.5·ndu+0.5)` qui ne sait dire que
   `N·haut`). **Je le confirme intact.**
3. ⛔ **LA SILHOUETTE DU BLOC RESTE GROSSIÈRE.**
   `M1-masques-zoom-CROP-apres.png` contre `M1-masques-zoom-SOCLE-avant.png`
   (rouge = paroi, vert = surface, ×3, même fenêtre) : le socle porte des
   AIGUILLES fines — ses ravines coupent le mur au pixel — quand le crop rend
   une courbe lisse. **Les créneaux et les encoches de 3 à 10 px ont disparu**
   (comparer avec `D4-masques-zoom-CROP-P11.png`, pris avant le correctif) ;
   **la finesse, non.** §2.4.
4. ⚠️ **LA FRANGE CÔTIÈRE EST EXACTEMENT OÙ P10 L'A LAISSÉE.** §5, réserve n° 4.

---

## 4. LA CLÔTURE, ET ELLE EST RELEVÉE DANS LA PAGE

**Drapeau LEVÉ** (`.banc/P11/cloture-leve.log`) : 245 tuiles, mer, parois et fond
posés, `refus: []`, 174 jupes retaillées, `uNormaleFineOn = 1`,
`uUnitesParMetre` juste à 1e−18 près, **28 programmes compilés**, **aucune erreur
de nuanceur**. Et le relevé qui compte :

```
uReliefBas = 130    terreBas 130 − creux 0    identité vérifiée dans la page
sonde du maillage 813,07 m   sonde de la texture 723,60 m   écart 89,48 m
```

⚡ **Les deux sondes rendent bien deux nombres différents dans l'application
vivante** : ce n'est pas une distinction de papier.

**Drapeau BAISSÉ** (`.banc/P11/cloture-baisse.log`) : `terrain.mesh` **visible**,
plinthe **visible**, `real-water` **visible**, `uNormaleFineOn = 0`,
34 programmes, aucune erreur. Et :

```
uReliefBas = -6000 = -uOceanDepth      neutreMonde : VRAI
échelle posée : terreBas 0 · terreHaut 5600 · profondeur 6000 · creux 6000
```

➡️ ⚡ **LA PRODUCTION REND L'ANCRE D'AVANT LA TÂCHE P11, AU BIT PRÈS.**

⚠️ **UN AVERTISSEMENT DE COMPILATION SUBSISTE DES DEUX CÔTÉS** —
`warning X4000: use of potentially uninitialized variable (f_surfaceFx_int)`.
**Il est ANTÉRIEUR** : P9 le déclare, P10 le redéclare. Pas le mien, pas corrigé.

---

## 5. LA CAMPAGNE DE MUTATION — 71 / 71, EN TROIS TOURS

`.banc/P11/mutations-P11.mjs`, worktree à part (`C:/Dev/wt-p11-mut`,
`node_modules` en jonction, `git ls-files --eol` à `i/lf w/lf` sur les sept
fichiers en jeu, **480 tests verts AVANT de commencer**, arbre rendu propre après
chaque mutation, **worktree retiré en partant**). **59 des 71 mutations visent le
BRANCHEMENT — 83,1 %**, contre les 82,4 % de P10.

### ⛔ DIX SURVIVANTES AU PREMIER TOUR (44 / 54), ET CHACUNE A TROUVÉ UN VRAI TROU

| | ce qu'elle a trouvé | ce qui la tue maintenant |
|---|---|---|
| **1d** | le `max(0, …)` du creux : **inatteignable depuis `mesurerRelief`** (`minM ≤ minTerreM` par construction) — mais `echelleRampe` est **exportée**, et ce fichier de test lui passe trois mesures écrites à la main | l'algèbre est **rejouée** sur deux reliefs, ET la garde est **exercée** par une mesure incohérente. ⚠️ **La branche n'est pas morte : elle défend un appelant qui existe** |
| **2e** | `①d` ne comparait que **trois champs sur cinq** : sans ancre, l'ancre basse retombait à zéro sur toute la planète | `creux` entre dans la boucle, plus l'identité `terreBas − creux = −profondeur` |
| **4f** | le plancher de pivot **écrasait le réglage d'utilisateur** — l'assertion ne portait que sur `natPlancherPivot` | l'expression entière, `max(uHeightPivot, …)`, **des deux côtés** (globe et `terrain.js`) |
| **4g** | ⛔ **la DÉCLARATION de l'uniforme** : aucun test ne lisait le fragment pour y chercher ses déclarations, et le défaut ne se serait vu **qu'au chargement de la page** | ⚡ **un test GÉNÉRIQUE** : tout uniforme LU par le fragment doit y être DÉCLARÉ — il vaut pour les 40 et plus, pas seulement le mien |
| **5e** | « pas de NaN » ne prouvait rien : sans le plancher `max(1, G)`, la loi lit un nœud **hors de la tuile** et rend quand même un nombre | l'ÉGALITÉ avec une grille à une seule cellule |
| **6c** | `altitudeMaillage` contre `altitudeSonde` : la paroi repassait **SOUS sa propre surface** en mer | une tuile toute en mer, sans fond : le maillage écrête à zéro, la sonde rend le brut |
| **6d** | le fond marin lu **au point demandé** au lieu du NŒUD : une seconde loi | un champ **plus fin que le maillage** (129 nœuds pour 24 quads) — sous cette finesse-là les deux lois coïncident à 2·10⁻⁹, et le test ne prouvait rien |
| **7b** | `lat` et `lon` **échangés** à l'appel : ⑤a comptait les appels, pas leurs arguments | les arguments, prouvés contre `latLonDeLocal` **du dépôt** |
| **7c** | la liste de tuiles **rebâtie à chaque point** (deux millions d'itérations) | le compte des appels à `tuilesAvecHauteurs`, et il en faut UN |
| **8b** | `_buildMesh` posant sur une **autre grille** que celle que la sonde relit : ③a comparait la géométrie à `interpolerMaille` avec un `G` choisi par le TEST | ⚡ **⑥c apparie les deux côtés** — les deux lectures viennent du dépôt |

### ⛔ TROIS AU SECOND TOUR (60 / 63), DONT UNE QUI N'EN ÉTAIT PAS UNE

**6j** (la sonde débranchée du fond) survivait parce que **⑥b comparait la sonde
à ELLE-MÊME** — son attendu était bâti avec `hauteurDessinee` aux nœuds. **6k**
(la liste jetée par `hauteurSurface`) a demandé le même compteur côté rampe.

⚠️ **ET `8b` N'ÉTAIT PAS UNE SURVIVANTE : C'ÉTAIT UNE MUTATION NEUTRE, ET JE LA
CORRIGE PLUTÔT QUE DE LA COMPTER.** `segmentsTuile(z + 1)` rend le **MÊME 24** à
z12, le seul zoom du banc — elle ne changeait rien. Elle devient
`segmentsTuile(z) + 1`, et elle meurt.

### ⛔ UNE AU TROISIÈME TOUR (70 / 71), ET ELLE EST SOUS MA TÂCHE

**10f** — `this._baseYCrop = solide.baseY * 2` **survivait**.
`test/mer-sphere.test.js` ⑫h exigeait `/this\._baseYCrop = solide\.baseY/` :
**une assertion de CHAÎNE**, et la mutation passait à travers. Avec elle **le
fond du rideau d'eau (Tâche P4) ET le plancher des jupes (Tâche P7)**, qui le
lisent tous les deux.

⚠️ **CE CHEMIN N'EST PAS DE LA TÂCHE P11 : il est SOUS elle**, et c'est
précisément pour ça que la campagne l'a visé. Le test ⑤d **EXÉCUTE**
`construireParoisCrop` sur un globe minimal et confronte `_baseYCrop` au solide
bâti à part — **l'oracle est `construireSolideCrop`, pas une expression
recopiée.**

**Chaque test tueur a été vérifié EXPÉRIMENTALEMENT** : mutation remise, tests
rejoués, `git status --short` et `git diff --stat` **vides** entre chaque, et le
troisième tour rend **71 / 71** sur la liste complète.

---

## 6. MES RÉSERVES

1. ⛔ **JE DÉPASSE LA CIBLE SUR TROIS MESURES, ET LE SIGNE S'INVERSE.** Le crop
   est désormais **+15,7 % de saturation**, **+16 % de hors-orange** et
   **+16,3 % d'énergie de détail** par rapport au socle, là où il était
   respectivement **−15 %**, **−49 %** et **−4 %**. **Sur la saturation,
   l'amplitude de l'écart n'a donc PAS baissé — seul son sens a changé** (×1,179
   avant, ×1,157 après, à l'envers). **Sur la distribution de teinte, en
   revanche, le gain est massif et il ne s'inverse pas** : le secteur dominant
   tombe à **0,1 %** du socle (57 083 contre 57 166), l'ocre à 4,2 %, les neutres
   à 0,8 point. ⚠️ **Le critère ② du noteur pèse la saturation ET la masse
   hors-orange : c'est à lui d'arbitrer, pas à moi.**
   ⚡ **ET LA CAUSE DU DÉPASSEMENT EST NOMMÉE, PAS DEVINÉE** : la pente de la
   rampe est multipliée par **3,12** (l'amplitude passe de 9 026 à 2 896 m), donc
   la couleur du crop — qui se calcule sur `decodeMetersAA(vUv)`, **à la
   résolution de la TEXTURE** — restitue trois fois plus de variation qu'avant,
   pendant que le socle, lui, colore sur son maillage. **Les deux Terres n'ont
   pas la même bande passante de couleur ; jusqu'ici la pente écrasée le
   cachait.** Je n'ai pas mesuré la part exacte du grain (`uGrainForceM`) dans
   ce surplus, et je ne l'invente pas.
2. ⛔ **LE MANQUE N° 2 N'EST PAS FERMÉ : J'EN AI FERMÉ 4,2 %.** §2.4. Le reste
   est la résolution du maillage — **72 segments par côté de bloc contre 768** —
   et le fermer coûte les 594 434 sommets du socle. **Chiffré, non payé.**
3. ⛔ **MON BANC A CORROMPU SON PROPRE ÉTAT UNE FOIS**, et le chiffre a été jeté
   (§1.2). Le garde qui l'a rattrapé est le retour à 0 canal, exigé partout.
   ⚠️ **Et `.banc/P11/m2-anneau.js`, qui devait lire l'anneau BÂTI dans la
   géométrie vivante, RATE SA LECTURE** — son propre témoin le dit (« NI L'UN NI
   L'AUTRE — la lecture est fausse », les deux colonnes valant −1 387 m). **Je
   laisse le script et son verdict sur le disque plutôt que de publier ce qu'il
   rend.** La preuve du branchement est ailleurs, et elle est exécutée
   (`test/maillage-tuile.test.js` ⑤a, ⑤c, ⑥c).
4. ⚠️ **LA DETTE DE P10 EST INTACTE, ET C'EST MESURÉ.** La frange côtière rend
   **paliers 2,060 · suites de 4 px et plus 13,58 %** contre **2,058 · 13,57 %**
   chez P10 ; le socle rend **1,675 · 6,66 %** contre **1,669 · 6,65 %**.
   **Ni aggravée, ni repayée.** Je ne l'ai pas prise : elle vit dans le pas du
   gradient de la normale fine (§2.4 de `rapport-P10.md`), c'est-à-dire dans
   l'accord de bande que P10 a délibérément choisi, et la toucher rouvrirait son
   poste n° 1. **Ce n'est pas un oubli, c'est un refus motivé.**
5. ⚠️ **LE TABLIER DE MER MONTE DE 1 060 À 1 236 px** au cadrage côte
   (`bandeDuMur.crop.nappe.dansLaBande`). **La bande du mur a changé de
   définition avec l'anneau** — c'est la même mesure sur une autre bande, et je
   ne sais pas la partager entre « la bande a bougé » et « la nappe déborde
   plus ». ⚠️ **Le chiffre du SOCLE, lui, bouge de 326 à 617 px entre deux
   exécutions sans que rien ne le touche** : je ne publie donc **aucun rapport**
   sur ce poste. C'est la réserve n° 9 de P10, reconfirmée.
6. ⛔ **LA RUGOSITÉ DU BORD QUE J'AI VOULU MESURER N'EST PAS DÉFENDABLE.** Mon
   `hautDuMur` rend **56,18 px de saut moyen** côté crop contre **6,20** côté
   socle, et ce rapport **ne bouge pas** avec le correctif (54,70 après). Je
   soupçonne la bande de couverture semi-transparente du bord du crop de laisser
   voir la paroi tout le long de la silhouette, y compris au loin — donc la
   grandeur ne mesure pas ce que son nom dit. **Je la retire.** Ce que je
   défends sur ce poste est l'AIRE (§2.4), qui ne dépend d'aucun appariement.
7. ⚠️ **LE RÉSIDU EN MOUVEMENT MONTE DE 0,4 %** (§0.2), et sa cause est la mienne
   (la pente de rampe ×3,12). **Il reste sous le plancher du crop sans normale
   fine**, donc la fermeture de P10 tient — mais **le chiffre n'est plus le
   sien**, et c'est à dire.
8. ⚠️ **UN SEUL LIEU, DEUX CADRAGES** — La Réunion z12. ⛔ **ET CETTE FOIS LA
   RÉSERVE MORD** : mon correctif change de comportement selon que le crop A ou
   N'A PAS de mer, et **je n'ai mesuré à l'écran QUE le cas sans mer** (le
   cadrage intérieur). Le cas avec mer est celui où l'ancienne loi était JUSTE
   — les tests le couvrent (`①i`, `⑤d bis`), **l'écran non**.
9. ⚠️ **JE N'AI PAS CHRONOMÉTRÉ LE COÛT.** `hauteurDessinee` fait **quatre
   `sampleHeights` et quatre `tileToLatLon` par point d'anneau** là où
   `hauteurSurface` en faisait un, sur **1 020 points, à l'arrêt seulement**
   (décision 5). L'ordre de grandeur est petit et la fonction ne tourne pas par
   image — **mais ce n'est pas une mesure, et P10 a montré ce que valent les
   estimations non mesurées sur ce chantier.**
10. ⚠️ **PAS DE COMPOSITEUR**, comme tout le chantier : mes images ne sont pas
    exactement celles qu'Adrien voit.
11. ⚠️ **LE BORD DE TUILE N'EST PAS TRAITÉ**, et c'est la réserve n° 6 de P10
    reprise : quand l'anneau tombe exactement sur `tx + 1`, `_tuileLaPlusFine`
    l'attribue à la tuile VOISINE (intervalle semi-ouvert), et les deux tuiles y
    lisent leur propre texel de bord. **Le test le déclare au lieu de le
    masquer** (⑥c). Non mesuré à l'écran.

---

## 7. CE QUI RESTE SUR LE DISQUE

`.banc/P11/` — **39 captures PNG**, **12 relevés JSON**, le récepteur, les cinq
scripts de diagnostic (`d1` à `d5`), les deux scripts de mesure (`m1`, `m2`), le
script de clôture, la campagne de mutation et son résultat, et les journaux de
chaque exécution. **Le pilote est celui de P9, réemployé tel quel.**

**Les paires à regarder d'abord :**

- ⚡ **`A1-CROP-interieur-N03.png` ↔ `.banc/P10/A1-CROP-interieur-P10.png`** —
  **le même bloc, le même protocole, avant et après.** Si vous ne regardez
  qu'une paire, c'est celle-là : l'île de Mars redevient une île.
- `A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`
  (**+0,0007 %**) — le crop contre le socle, à la même seconde
- `D2-crop-ancre-12000-P11.png` — **le témoin poussé DANS L'AUTRE SENS** : ancre
  à 12 000 m, sept pixels d'olive sur tout le bloc
- `D1-albedo-CROP-P11.png` ↔ `D1-albedo-SOCLE-P11.png` — **les deux albédos nus,
  irradiance neutralisée à π des deux côtés** : la mesure du §1.1 en une image
- `M1-masques-zoom-CROP-apres.png` ↔ `D4-masques-zoom-CROP-P11.png` — **le
  raccord paroi/surface, après et avant** (rouge = paroi, vert = surface)
- `M1-masques-zoom-CROP-apres.png` ↔ `M1-masques-zoom-SOCLE-avant.png` — **la
  courbe lisse du crop contre les aiguilles du socle** : ce qui reste, en une
  image
- `D3-crop-sans-jupe-P11.png` — le crop **jupes éteintes**, 1 183 canaux de
  différence sur 4 096 000

---

## 8. ⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

**Mais ce qui les sépare a changé de nature.** Le noteur écrivait : *« le crop
est brun-rosé là où le socle est olive, son terrain pend par-dessus la paroi, sa
mer porte un pavage rectangulaire et une frange en escalier, et sa paroi n'a pas
de chanfrein. »*

**Le premier de ces quatre est fermé** — l'olive est là, l'ocre est là, les
neutres sont là, et je le mesure sur son propre banc. **Le deuxième est entamé
de 4,2 %** : les créneaux du raccord ont disparu, la finesse de la silhouette
non, et son prix est chiffré. **Les deux derniers n'ont pas bougé** — ce
n'était pas ma tâche, et je confirme qu'ils sont intacts.

⛔ **CE QUI SÉPARE ENCORE LES DEUX IMAGES, À L'ŒIL, SUR MES CAPTURES :** le crop
est **plus clair et plus contrasté** que le socle, sa **silhouette est dix fois
plus grossière**, sa **paroi est un rouge vif contre un bordeaux**, sa **mer
porte toujours son pavage et sa frange en marches**, et son **arête n'a toujours
pas de chanfrein**.
