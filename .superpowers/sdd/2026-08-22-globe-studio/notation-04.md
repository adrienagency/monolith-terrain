# NOTATION 04 — le crop face au socle d'avant la sphère, après onze tâches

**Agent noteur · 2026-08-23 · `C:\Dev\wt-merge`, branche `regroupement`,
HEAD `bf03bfe20e8c791654e1b06495daa0dd67f78180`**
(« tache P11 : une survivante a demasque une assertion de NOM, sous ma tache »),
**arbre propre AVANT et APRÈS** (`git status --porcelain` vide aux deux bouts),
**aucune source touchée**.

> ⚠️ **C'EST CET ÉTAT-LÀ QUI EST NOTÉ.** Si un implémenteur committe par-dessus
> pendant que vous lisez, cette note ne juge pas son travail. `bf03bfe` est le
> dernier commit de la Tâche P11.

**Toutes les captures et tous les chiffres de ce rapport sont les miens**, pris
ce jour, et laissés dans **`.banc/N04/`** (**46 captures PNG**, **10 relevés
JSON**, le récepteur et les trois scripts que j'ajoute). Cadre
**1 280 × 800 = 1 024 000 px**, La Réunion, z12, vue isométrique 0, rendu dans
une **cible à profondeur**, **sans compositeur**, **boucle rAF gelée**, **socle
rallumé dans la MÊME page**.

**Note globale : 6,7 / 10**, contre **6,6** (note 03), **5,3** (note 02) et
**3,5** (note 01). ⚡ **Et le +0,1 cache deux mouvements de sens contraire de
plus d'un point chacun** : le §6 le détaille, le §7 dit quoi faire.

**Les trois choses qu'on m'a demandé de trancher sont aux §3 (l'arbitrage du
dépassement), §4 (le cas AVEC mer) et §2 (la réfutation de ma clé de la note
03). Elles ne donnent pas toutes raison au noteur que j'étais.**

---

## 0. CE QUE J'AI RÉGLÉ AVANT DE POUVOIR NOTER

### 0.1 ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est celle de la note 03,
de P7, P8, P9, P10 et P11 — **et je ne la déclare pas seulement, je la prouve en
retrouvant des constantes que je n'ai pas choisies** :

| témoin, relevé dans ma page | moi | l'attendu du chantier |
|---|---|---|
| `heightContrast / heightPivot`, cadrage intérieur | **2,2 / 0,41** | la preuve de lieu de la note 02 |
| `heightContrast / heightPivot`, cadrage côte | **2,5 / 0,58** | idem |
| sommets de `terrain.mesh` | **594 434** | notes 01, 02, 03, P10, P11 |
| rampe et texture d'analyse | **même objet `three`**, uuid identique | note 03 §0.2 |
| profil de paroi du socle, p20 / p80 / contraste | **15,88 / 48,15 / 3,032** | P8 a calibré `profilParois` sur 15,88 / 48,36 / 3,045 |
| `uContourOpacity`, crop et socle | **0 / 0** | ⚖️ la correction de justice |

### 0.2 Le protocole, repris tel quel, et le banc n'est PAS réécrit

Sous `?terre=unique` le socle **est caché, pas détruit** (`main.js:4544`) : je le
rallume dans la même page et je rends les deux blocs **à la même seconde**.

⚡ **J'AI REJOUÉ LES SIX SCRIPTS DE LA NOTATION 03 SANS EN MODIFIER UNE LIGNE**
(`n1` à `n6` de `.banc/vues-notation-03/`, harnais `harnais-N03.mjs` compris,
pilote `.banc/P9/pilote-P9.mjs` réemployé tel quel), **plus `d1-palette.js` de
P11**, lui aussi intact. **Seul le récepteur change** (`.banc/N04/recois-N04.mjs`,
même port 5613, autre dossier), exactement comme P10 et P11 l'ont fait.

⚠️ **CONSÉQUENCE À LIRE AVANT LES JSON** : les scripts du noteur portent
`head: 'ac58500'` **en dur**, celui de P11 `head: 'd258d0b'`. Ces champs sont LEURS
étiquettes, pas la mienne. **Le HEAD réellement noté est `bf03bfe`**, vérifié par
`git rev-parse` avant et après, et **prouvé sur le serveur** : j'ai déposé
`.banc/N04/marqueur.txt` sur le disque et l'ai relu par
`http://localhost:5503/.banc/N04/marqueur.txt` — même contenu, donc **le serveur
de développement sert bien CE worktree**. `src/globe.js` servi et sur disque
portent tous deux **6 occurrences** de `uReliefBas`, l'uniforme que P11 vient
d'ajouter. Mes trois scripts à moi (`v1`, `v2`, `v3`) portent `head: 'bf03bfe'`.

### 0.3 Les deux cadrages sont ceux des trois notes précédentes

| cadrage | lieu | preuve | mer ? |
|---|---|---|---|
| **intérieur** | lat **−21,115** · lon **55,536** · z12 · iso 0 | `hc/hp = 2,2 / 0,41` | ⛔ **NON** (`profondeur` retombe sur le plancher) |
| **côte** | lat **−21,05** · lon **55,25** · z12 · iso 0 | `hc/hp = 2,5 / 0,58` | ⚡ **OUI** (`profondeur = 1 317,58 m`) |

⚡ **C'est cette colonne de droite qui fait le §4.**

---

## 1. LES PREUVES — APPARIEMENT, TÉMOIN NUL, MOUVEMENT

### 1.1 L'appariement, balayé sur un CLONE de caméra, DANS LA MÊME EXÉCUTION JS

`applyIsoView` dérive de `controls.maxDistance` : à caméra identique les deux
blocs n'occupent pas la même fraction du cadre (**×1,362 en aire** à la note 01,
×0,763 à la note 02). **On balaie donc au lieu de supposer.**

| script / masque | cible (crop) | socle | `k` | **écart** |
|---|---|---|---|---|
| **N1** — surface seule, intérieur | 144 688 px | **144 689 px** | 1,0090 | ⚡ **+0,0007 %** |
| **N2** — bloc entier, intérieur | 211 946 px | **211 925 px** | 0,9865 | **−0,0099 %** |
| **N4** — bloc entier, côte | 215 630 px | **215 711 px** | 0,9895 | **+0,0376 %** |
| **N5** — bloc entier, côte (rejoué) | 215 636 px | **215 713 px** | 0,9895 | **+0,0357 %** |
| **V1** — surface seule, côte *(le mien)* | 128 067 px | **128 023 px** | 0,9585 | **−0,0344 %** |
| **V3** — surface seule, intérieur *(le mien)* | 144 688 px | **144 648 px** | 1,0095 | **−0,0276 %** |
| **D1 de P11**, rejoué chez moi | 144 688 px | **144 648 px** | 1,0095 | **−0,0276 %** |

➡️ **De 27 à 1 430 fois mieux que le 1 % demandé.** La fraction est comptée **en
CACHANT le bloc et en comptant ce qui change** — jamais l'alpha
(`getClearAlpha()` vaut 1). **La cible re-mesurée après le balayage rend le même
compte au pixel** (144 688 → 144 688 ; 215 630 → 215 630 ; 128 067 → 128 067), et
**deux mesures du même `k` rendent le même compte** (144 689 / 144 689 ;
128 023 / 128 023).

⚠️ **Le balayage ne retombe pas toujours sur le même `k`** : 1,0090 à N1 et
1,0095 à V3, deux exécutions du même cadrage. Les deux sont sous 0,03 % ; je le
signale parce que c'est la seule irrégularité d'appariement de la journée.

### 1.2 Le témoin nul, et le temps de la mer immobile

Sur **4 096 000 canaux** (1 024 000 px × 4) :

| témoin | canaux différents |
|---|---|
| crop, cadrage intérieur, deux prises de suite (N1, V2, V3) | **0** à chaque fois |
| crop, cadrage côte, deux prises de suite (N4, N5, V1) | **0** à chaque fois |
| **après 20 rendus intercalés** | **0** |
| **après 10 rendus intercalés** (N6) | **0** |
| aller-retour de `uEclairageOn` · `uNormaleFineOn` · lumières du socle | **0 / 0 / 0** |
| aller-retour de la couleur des parois (202 726 canaux d'effet) | **0** |
| aller-retour de `setViewOffset`, dx = 0…3, des deux côtés | **0** dans les **24** séries |
| aller-retour de `uReliefBas`, trois valeurs, deux cadrages | **0** aux **cinq** essais |
| aller-retour de l'irradiance neutralisée à π (523 335 et 599 060 canaux d'effet) | **0 / 0** |

⚡ **ET LE TEMPS DE LA MER, RELEVÉ À CHAQUE PAS.** `uMerTemps` vaut
**2,702 099 999 994 038** aux deux relevés de N1 et
**2,843 899 999 991 057 5** aux **quatre** relevés de l'aller-retour serré de N6
— `merImmobile: true`. Le treizième piège (`geler()` qui ne gèle rien) est
**écarté par mesure, dans l'exécution où il compte**.

**Et ce zéro n'est pas un banc vide** : cacher le bloc change 144 688, 211 946,
215 630 et 128 067 px selon le masque ; couper `uEclairageOn` et `uNormaleFineOn`
déplace des centaines de milliers de canaux ; l'aller-retour serré de N6 en
déplace **337 771**.

⚠️ **ET LE RÉSIDU INEXPLIQUÉ DE LA NOTATION 03 SE REPRODUIT — JE LE DÉCLARE.**
Le témoin de normale fine de `n4-mer.js` rend un retour de **9 957 canaux**
(0,24 %) là où la note 03 en relevait **9 747** au même script. Ce n'était donc
pas un accident : c'est **systématique dans ce script-là**, et ni la note 03 ni
moi ne le reproduisons hors de lui (`n7-diagnostic.js` rendait 0 à ses huit
étapes ; mon N6 rend **0 canal sur la mer ET hors de la mer**). **Aucun verdict de
cette note n'en dépend** : toutes mes comparaisons crop ↔ socle sont des paires
prises au même instant.

### 1.3 ⚡ LA MESURE EN MOUVEMENT — ET LA PARITÉ N'EST PAS REVENUE

Décalage d'un nombre **entier** de pixels par `setViewOffset`, recalage
**cherché** de −3 à +3, masques érodés de 4 px (**crop 135 489 px, socle
133 127**). **Plancher à `dx = 0` : 0,000 des DEUX côtés. Le recalage tombe sur le
décalage demandé dans les 24 cas. Retour exact à 0 canal dans les 24 séries.**

**Cadrage intérieur, masque des tuiles, résidu moyen en octets de luminance :**

| décalage | **SOCLE** | **CROP, normale fine ON** | CROP OFF | crop sans éclairage | | note 03, ON |
|---|---|---|---|---|---|---|
| **dx = 1 px** | **0,0321** | ⚡ **0,8180** | 0,8670 | 0,8547 | | ⛔ **10,8724** |
| dx = 2 px | 0,0014 | **0,7798** | 0,8277 | 0,8093 | | 0,8002 |
| **dx = 3 px** | **0,0324** | ⚡ **0,8196** | 0,8687 | 0,8587 | | ⛔ **10,8563** |
| pixels instables (> 8 o) à dx = 1 | 66 | ⚡ **11** | 16 | 17 | | ⛔ **52 048 (38,49 %)** |
| résidu maximal à dx = 1 | 72,68 | **15,08** | 15,15 | 14,99 | | 164,33 |

➡️ ⚡ **AUCUNE SIGNATURE DE PARITÉ. L'ÉTAT ATTENDU EST RETROUVÉ À 0,06 % PRÈS**
(on m'annonçait **≈ 0,8175** à dx = 1 ; je mesure **0,8180**). Le micro-écart
pair/impair du crop (0,8180 · 0,7798 · 0,8196) est **exactement celui de la
colonne OFF** (0,8670 · 0,8277 · 0,8687), c'est-à-dire le plancher du RESTE du
nuanceur : **la normale fine n'est plus, en mouvement, distinguable de son
absence.** Le rapport au socle passe de **×360 à ×25,5**, et les pixels instables
de **52 048 à 11 — soit SIX FOIS MOINS QUE LE SOCLE LUI-MÊME (66).**

⚠️ **Le socle rend 0,0321 là où la note 03 mesurait 0,0302** (+6,3 %) : c'est le
bruit inter-chargement du témoin, et il borne la précision de cette colonne.

**Et sur la mer, cadrage côte** (masques érodés crop 65 065, socle 66 119) :

| décalage | SOCLE | CROP ON | CROP OFF | | note 03, ON |
|---|---|---|---|---|---|
| dx = 1 px | 0,0076 | ⚡ **0,3617** | 0,3581 | | ⛔ **1,4617** |
| dx = 2 px | 0,0005 | **0,3654** | 0,3619 | | 0,4653 |
| instables à dx = 1 | 11 | ⚡ **9** | 15 | | 1 521 (2,34 %) |

➡️ **ON et OFF rendent le même chiffre à 1 %, et moins de pixels instables que le
socle. Sur la mer aussi, le poste n'est pas réduit : il n'existe plus.**

⚠️ **CE QUE CETTE MESURE NE DIT TOUJOURS PAS** (réserve de la note 03, reprise
telle quelle) : c'est un **PROXY** et un **PLANCHER**. Une translation rigide de
la fenêtre de projection isole la parité des quads ; elle ne contient **ni
parallaxe, ni changement de LOD, ni houle**.

---

## 2. ⚡ LA CORRECTION QUE P11 M'OPPOSE : ELLE TIENT, ET JE LA DIS FRANCHEMENT

**J'écrivais, note 03 §3 ② et §6.5** : *« Ce n'est pas la rampe (même objet
`three` des deux côtés) : c'est la COMPOSITION DE L'OMBRAGE. »*

P11 §1.1 a coupé la chaîne en deux — `albédo × irradiance / π = pixel` — a posé
une irradiance neutre d'exactement `π` des deux côtés, et a mesuré que
**l'irradiance neutralisée, le crop n'avait PAS UN SEUL pixel d'olive** (0 contre
4 199 au socle). **L'écart vivait dans l'ALBÉDO.**

⚡ **JE L'AI VÉRIFIÉ EN REJOUANT SON PROPRE SCRIPT, `.banc/P11/d1-palette.js`,
SANS EN MODIFIER UNE LIGNE, DANS MA PAGE, À MON HEAD** (`.banc/N04/D1-*.png`,
`D1-palette-P11.json`, `sortie-d1-rejoue.log`). Aller-retour **0 canal des deux
côtés**, témoins à **523 335** et **599 060** canaux — P11 publie 523 617 et
599 735, soit **0,05 % et 0,11 % d'écart : je suis sur son instrument et sur son
image.**

| secteur, **ALBÉDO SEUL** (irradiance = π des deux côtés) | crop, **AVANT** P11 *(son relevé)* | crop, **APRÈS** P11 *(le mien)* | **SOCLE** *(le mien)* |
|---|---|---|---|
| 0–30° rouge-orangé | — | **70 383** | 70 963 |
| 30–60° ocre | **3 626** | ⚡ **28 247** | 27 895 |
| **60–90° OLIVE** | ⛔ **0** | ⚡ **3 807** | 4 184 |
| 330–360° rosé | **7 510** | **1 535** | 1 431 |
| saturation moyenne | — | **0,1824** | **0,1832** |
| moyenne RGB | — | 106,36 / 91,84 / 78,57 | 105,67 / 91,13 / 77,79 |

➡️ ⛔ **MA CLÉ DE LA NOTE 03 ÉTAIT FAUSSE, ET JE LA RETIRE.** Le rosé-contre-olive
n'était pas la composition de l'ombrage : c'était l'albédo, et P11 l'a prouvé
avant de le réparer. **Aujourd'hui l'albédo du crop et celui du socle sont
d'accord à 0,44 % sur la saturation, à 0,65–1,01 % sur la moyenne RGB, et à
0,0058 de distance de variation totale sur la distribution de teinte.**
**L'ombrage n'y était pour rien ; il atténuait l'écart.**

⚡ **ET LA MÊME MESURE, REJOUÉE APRÈS SA CORRECTION, DIT QUELQUE CHOSE DE NEUF —
C'EST MA CONTRIBUTION À CE POSTE :**

| | crop / socle |
|---|---|
| **ALBÉDO seul** : distance de teinte (variation totale) | **0,0058** |
| **ALBÉDO seul** : moyenne RGB | **+0,65 % · +0,78 % · +1,01 %** |
| **ALBÉDO seul** : saturation | **−0,44 %** |
| **IMAGE VIVANTE** : distance de teinte | **0,0189 à 0,0289** |
| **IMAGE VIVANTE** : moyenne RGB | ⛔ **+8,48 % · +8,18 % · +8,42 %** |
| **IMAGE VIVANTE** : saturation | ⛔ **+15,75 %** |

➡️ ⚡ **L'ALBÉDO EST ACCORDÉ. TOUT LE DÉPASSEMENT QUI RESTE EST DANS
L'IRRADIANCE** — et il est **uniforme sur les trois canaux à 0,3 point près**
(×1,0848 / ×1,0818 / ×1,0842), ce qui **exclut une faute de teinte** et désigne
**un terme de gain**. **La phrase « c'est l'ombrage » redevient vraie
aujourd'hui — mais sur un AUTRE poste que celui où je l'avais écrite, et
seulement parce que P11 a d'abord retiré l'albédo de l'équation.** C'est le poste
n° 1 du §7.

---

## 3. ⚡ VOLET A — MON ARBITRAGE SUR LE DÉPASSEMENT

**La question de P11** : *« Dépasser de 16 % vaut-il mieux que manquer de
97 % ? Au noteur d'arbitrer. »*

### 3.1 Je refuse d'arbitrer sur un scalaire, et je dis pourquoi

Le critère ② ne demande pas « la saturation est-elle la bonne ». Il demande
**« la rampe, les teintes, la lisibilité des altitudes »** — c'est-à-dire **OÙ SE
TROUVE LA MASSE DE COULEUR**. La grandeur qui répond à cette question est la
**distance entre les deux distributions de teinte**, sur les douze secteurs que
le critère emploie déjà et sur les masques appariés. Je la publie, et elle est
calculée depuis les relevés du script du noteur, non modifié.

**Distance de variation totale entre la teinte du crop et celle du socle**
(0 = distributions identiques ; 1 = disjointes) :

| état | source du relevé | **distance** |
|---|---|---|
| notation 03 (`ac58500`) | `.banc/vues-notation-03/N1-…json` | ⛔ **0,1859** |
| après P10 (`d258d0b`) | `.banc/P10/N1-…json` | ⛔ **0,1855** |
| après P11 (`bf03bfe`) | `.banc/P11/N1-…json` | **0,0189** |
| **après P11, MA mesure** | `.banc/N04/N1-…json` | ⚡ **0,0189** |
| **après P11, MA mesure, autre chargement** | `.banc/N04/D1-palette-P11.json` | **0,0289** |

➡️ ⚡ **JE REPRODUIS LE RELEVÉ DE P11 À LA QUATRIÈME DÉCIMALE, INDÉPENDAMMENT.
L'ERREUR DE DISTRIBUTION EST DIVISÉE PAR 6,4 À 9,8.**

### 3.2 Et le détail, quantité par quantité, en erreur multiplicative

`|ln(crop / socle)|` — 0 = accord parfait, insensible au sens de l'écart :

| quantité | note 03 | **note 04 (moi)** | |
|---|---|---|---|
| 0–30° rouge-orangé | 0,2613 | ⚡ **0,0019** | ÷ 137 |
| 30–60° ocre | 1,0380 | ⚡ **0,0425** | ÷ 24 |
| **60–90° olive** | 1,2557 | ⚡ **0,0895** | ÷ 14 |
| 90–120° vert | 2,6446 | **0,2413** | ÷ 11 |
| 330–360° rosé | 0,9322 | **0,3314** | ÷ 2,8 |
| masse hors-orange | 0,6805 | **0,1522** | ÷ 4,5 |
| **saturation moyenne** | 0,1625 | ⛔ **0,1462** | **÷ 1,11 seulement** |
| **somme palette** | **6,9748** | ⚡ **1,0050** | **÷ 6,94** |
| | | | |
| **énergie de détail** *(critère ①)* | 0,0200 | ⛔ **0,1512** | **× 7,6** |
| **écart-type de luminance** *(critère ①)* | 0,0235 | ⛔ **0,1434** | **× 6,1** |
| luminance moyenne | 0,1102 | **0,0819** | ÷ 1,35 |

### 3.3 ⚖️ MON ARBITRAGE, EN TROIS PHRASES

1. ⚡ **LE DÉPASSEMENT EST ACCEPTÉ, ET LARGEMENT.** Dépasser de 16 % vaut
   **mieux** que manquer de 71 à 100 % : sur la grandeur que le critère ② mesure
   — où se trouve la masse de couleur — l'erreur est **divisée par 6,9**, le
   secteur dominant tombe à **0,2 %** du socle (57 047 contre 57 156), l'olive à
   **9,4 %**, les neutres à **0,81 point** (24,19 % contre 25,00 %). Et **je le
   vois** : `A1-CROP-interieur-N03.png` contre `A2-SOCLE-…` a la même famille de
   couleurs, ravines olive et plateaux ocre compris, là où la note 03 décrivait
   une île de Mars. **Le critère ② monte de 7 à 8.**

2. ⛔ **MAIS IL N'EST PAS GRATUIT, ET JE LE FACTURE.** Le dépassement **déplace
   l'erreur du critère ② vers le critère ①**, où elle est **multipliée par 7,6**
   (énergie de détail 0,980 → **1,163**) et par **6,1** (écart-type de luminance
   1,024 → **1,154**). Ce n'est pas une abstraction : sur ma capture `A1`, **les
   blancs des crêtes brûlent** là où le socle garde du gris. **Le critère ① ne
   monte donc pas**, alors que la fermeture du crénelage par P10 valait à elle
   seule le 9 que la note 03 annonçait. **Solde net du dépassement : +1 point, pas
   +2.**

3. ⚡ **ET IL EST RÉPARABLE SANS RIEN REBRANCHER, CE QUI EST LA VRAIE RAISON DE
   L'ACCEPTER.** Les quatre dépassements — énergie **+16,3 %**, contraste
   **+15,4 %**, saturation **+15,8 %**, hors-orange **+16,4 %** — ont **le même
   signe et la même amplitude**, et le §2 les localise **entièrement dans
   l'irradiance**, l'albédo étant accordé à 0,8 %. **C'est un accord
   d'exposition, pas un branchement.** Le contraire — un albédo faux — aurait
   demandé de tout refaire.

⚠️ **CE QUE MON ARBITRAGE NE DIT PAS.** Sur la **saturation prise seule**, P11
a raison contre elle-même : l'amplitude n'a baissé que de **11 %**, le signe a
juste tourné. **Si Adrien veut noter la saturation seule, la tâche P11 n'a rien
gagné sur ce point-là.** Je maintiens que ce n'est pas ce que le critère mesure,
mais je ne cache pas que le choix de la grandeur est mon choix, et qu'il porte
l'arbitrage.

---

## 4. ⛔ VOLET B — LE CAS AVEC MER : LE RISQUE DÉCLARÉ EST LEVÉ

**La réserve n° 8 de P11** : *« Mon correctif change de comportement selon que le
crop A ou N'A PAS de mer, et je n'ai mesuré à l'écran QUE le cas sans mer. Le cas
avec mer est celui où l'ancienne loi était JUSTE — les tests le couvrent, l'écran
non. »*

**La Réunion en a**, au cadrage côte de toutes les notations précédentes. **Je
l'ai mesuré à l'écran, dans les deux cas, et je le prouve EN LE BOUGEANT, DANS
LES DEUX SENS.** Scripts `.banc/N04/v1-ancre-avec-mer.js` et
`v2-ancre-sans-mer.js`, relevés `V1-ancre-avec-mer-N04.json` et
`V2-ancre-sans-mer-N04.json`.

### 4.1 Ce que la page vivante porte, aux deux cadrages

| | **CÔTE — AVEC mer** | **INTÉRIEUR — SANS mer** |
|---|---|---|
| `terreBas` mesuré | **0** | 107,463 867 187 5 |
| `terreHaut` mesuré | 2 017,995 117 187 5 | 3 009,641 601 562 5 |
| **`profondeur` mesurée** | ⚡ **1 317,580 230 712 890 6** | ⛔ **0,017 466 033 592 535 575** *(le PLANCHER)* |
| **`creux` mesuré** | **1 317,580 230 712 890 6** | **0** |
| `uOceanDepth` posé | 1 317,580 230 712 890 6 | ⛔ **6 000** *(la valeur MONDIALE)* |
| **`uReliefBas` posé** | **−1 317,580 230 712 890 6** | **130** |
| **la loi d'AVANT P11 (`−uOceanDepth`)** | **−1 317,580 230 712 890 6** | **−6 000** |
| ⚡ **ÉCART ENTRE LES DEUX LOIS** | ⚡ **0,000 000 0 m** | ⛔ **6 130 m** |
| `rampT` au niveau de la mer, **nouvelle loi** | **0,395 008 384 847 985 5** | **−0,044 889 502 762 430 94** |
| `rampT` au niveau de la mer, **loi d'avant** | **0,395 008 384 847 985 5** | ⛔ **0,664 746 288 499 889 3** |

⚡ **AVEC MER, LES DEUX LOIS RENDENT LE MÊME NOMBRE AUX SEIZE CHIFFRES.**
`Object.is(terreBas − creux, uReliefBas)` rend **vrai**, et
`terreBas − creux = minM = −uOceanDepth`. **Sans mer, elles diffèrent de 6 130 m
et le pivot passe de 0,665 à 0,041** — je retrouve le **0,6647** que P11 publie,
sans le lui emprunter.

### 4.2 ⚡ ET C'EST PROUVÉ EN BOUGEANT L'UNIFORME, PAS EN LISANT SA VALEUR

Une concordance au défaut n'est pas un branchement. J'ai donc posé `uReliefBas`
à trois valeurs, rendu, compté, remis, et re-rendu :

| cadrage | ancre posée | **canaux déplacés / 4 096 000** | retour |
|---|---|---|---|
| **CÔTE (avec mer)** | **la loi d'avant P11 (−1 317,58)** | ⚡ **0** | **0** |
| **CÔTE** | −12 000 | **379 595** | **0** |
| **CÔTE** | `terreBas` (= 0) | **369 176** | **0** |
| **INTÉRIEUR (sans mer)** | **la loi d'avant P11 (−6 000)** | ⛔ **416 420** | **0** |
| **INTÉRIEUR** | −12 000 | **426 293** | **0** |

⚡ **ZÉRO PIXEL. AU CADRAGE OÙ LE CROP A DE LA MER, LA CORRECTION DE P11 EST UNE
NON-OPÉRATION, BIT POUR BIT, À L'ÉCRAN.** Et **le témoin n'est pas vide** : les
deux autres valeurs y déplacent 379 595 et 369 176 canaux, avec retour exact.
**Les deux PNG font d'ailleurs le même nombre d'octets** —
`V1-CROP-cote-livre.png` et `V1-CROP-cote-ancre-avant-P11.png`, **379 178 octets
chacun**.

⚡ **ET AU CADRAGE SANS MER, LE MÊME UNIFORME REFAIT L'IMAGE DE LA NOTATION 03 À
LUI TOUT SEUL** :

| sous l'ancre… | hors-orange | saturation | olive (60–90°) | rosé (330–360°) | énergie |
|---|---|---|---|---|---|
| **livrée (`bf03bfe`)** | **13,39 %** | **0,2374** | **10 941** | **2 261** | **18,945** |
| **la loi d'avant P11** | **5,60 %** | **0,1712** | **2 693** | **4 337** | **15,510** |
| *(la notation 03, pour mémoire)* | *5,56 %* | *0,1711* | *2 820* | *4 224* | *15,727* |

➡️ **Un seul uniforme, et l'île de Mars revient.** C'est la preuve la plus courte
que la palette et le dépassement ont **une seule cause**, et que cette cause est
celle que P11 nomme.

### 4.3 ⚖️ MON VERDICT SUR LE CAS AVEC MER

⚡ **LE RISQUE DÉCLARÉ EST LEVÉ, À L'ÉCRAN, SUR LE LIEU DE TOUTES LES NOTATIONS
PRÉCÉDENTES. P11 a eu raison de le déclarer et raison de ne pas l'affirmer sans
mesure ; la mesure lui donne raison sur le fond.**

⚠️ **ET JE BORNE MOI-MÊME CE VERDICT, EN TROIS POINTS.**

1. **L'algèbre dit pourquoi, et jusqu'où** : `uReliefBas = terreBas − max(0,
   terreBas − minM) = min(terreBas, minM) = minM`, puisque `terreBas = minTerreM
   ≥ minM` par construction. La loi d'avant rend `−max(−min(0, minM), p)`. **Les
   deux coïncident dès que `minM ≤ −p`.** Ici `p = 0,017 466 m`. ⛔ **Le seul cas
   avec mer qui pourrait encore diverger est un crop dont le point le plus bas
   serait entre −0,0175 m et 0 m** — une lame d'eau de moins de deux
   centimètres. **Je ne l'ai pas atteint et je ne l'invente pas ; je dis
   simplement que c'est là, et là seulement, que la dichotomie subsiste.**
2. ⛔ **UN SEUL LIEU, DEUX CADRAGES.** La Réunion z12. Un crop continental, un
   crop de haute latitude, un crop à plateau peu profond ne sont toujours pas
   jugés. **Ce que je lève, c'est la réserve « avec mer », pas la réserve « un
   seul lieu ».**
3. ⚡ **ET LE VOLET B A RAPPORTÉ PLUS QUE LA LEVÉE D'UN RISQUE.** Puisque l'ancre
   ne change **rien** au cadrage côte, **tout ce qui a bougé sur la mer depuis la
   notation 03 vient d'ailleurs** — et le §5 ④ montre que c'en est beaucoup, et
   dans le mauvais sens.

---

## 5. LES SIX NOTES — LES MÊMES CRITÈRES, LES MÊMES MESURES

### ① Richesse du relief — **6 → 6 → 8 → 8 / 10** *(=, et pour d'autres raisons)*

Cadrage intérieur, masques appariés à **+0,0007 %**, octet linéaire :

| | crop | socle | | note 03 | note 02 |
|---|---|---|---|---|---|
| **énergie de détail** | **18,945** | 16,287 | ⛔ **crop +16,32 %** | crop 98,02 % | 65,7 % |
| écart-type de luminance | **59,827** | 51,837 | ⛔ **crop +15,41 %** | +2,4 % | socle +7,7 % |
| luminance moyenne | 122,983 | 113,314 | crop **+8,53 %** | socle +11,6 % | +10,1 % |
| part de la lumière dans le modelé | **25,75 %** | **45,91 %** | ⚡ **+5,8 points vers le socle** | 19,93 / 45,53 | — |
| apport de la normale fine | **+39,08 %** | — | | +43,43 % | — |

⚡ **CE QUI EST FERMÉ, ET JE L'AI VU SUR MA PROPRE DÉCOUPE.** Sur
`B3-zoom6-CROP-relief-N03.png` (×6), **le crénelage en escalier le long des
crêtes et les pixels isolés bruités ONT DISPARU** — c'est le défaut que je
facturais **deux points** à la note 03 (« sans lui je mettais 9 »), et le réseau
de ravines est lisible. **La note ① devrait donc passer à 9.**

⛔ **CE QUI L'EN EMPÊCHE, ET C'EST NOUVEAU.** Le crop rend maintenant **+16,3 %
d'énergie de détail et +15,4 % d'écart-type de luminance** de plus que le socle,
là où la note 03 mesurait **−2,0 %** et **+2,4 %**. En erreur multiplicative,
**× 7,6 et × 6,1**. Sur `A1` contre `A2`, pris à la même seconde : **les crêtes
du crop brûlent en blanc pur** quand celles du socle gardent un gris-beige.
**Le progrès et la régression se valent : la note reste à 8.**

⚠️ **Et le mécanisme n'est toujours pas celui du socle**, même s'il s'en
rapproche : **25,75 % du modelé du crop vient de la lumière, contre 45,91 % au
socle** (note 03 : 19,93 contre 45,53). Le crop met encore son modelé dans la
couleur.

### ② Palette et contraste — **3 → 7 → 7 → 8 / 10** *(+1 — voir l'arbitrage §3)*

Histogramme de teinte en 12 secteurs de 30°, masques appariés à **+0,0007 %** :

| secteur | **crop** | **SOCLE** | rapport | | note 03 |
|---|---|---|---|---|---|
| 0–30° rouge-orangé | **57 047** | **57 156** | ⚡ **0,998** | | 1,299 |
| 30–60° ocre | **33 276** | 34 721 | ⚡ **0,958** | | 0,354 |
| **60–90° olive** | **10 939** | 10 002 | ⚡ **1,094** | | ⛔ 0,285 |
| 90–120° vert | 5 285 | 4 152 | **1,273** | | ⛔ 0,071 |
| **330–360° rosé** | **2 262** | 1 624 | **1,393** | | ⛔ 2,540 |
| pixels quasi neutres | **24,19 %** | **25,00 %** | ⚡ **−0,81 point** | | +9,26 points |
| masse hors-orange | 13,39 % | 11,50 % | ⛔ **+16,4 %** | | −49,4 % |
| saturation moyenne | 0,2374 | 0,2051 | ⛔ **+15,75 %** | | −15,0 % |
| secteurs de teinte vides | **2** | 3 | égalité | | 2 / 3 |
| **distance de variation totale** | | | ⚡ **0,0189** | | ⛔ **0,1859** |

➡️ ⚡ **LE MANQUE N° 5 DE LA NOTE 03 EST FERMÉ.** L'erreur de distribution est
divisée par **6,9 à 9,8**, l'olive et l'ocre sont là, les neutres sont à
**0,81 point**. ⛔ **Et il dépasse de 16 %.** L'arbitrage est au §3 : **+1, pas
+2**, parce que le dépassement est facturé au critère ①.

### ③ Trait et bordure — **3 → 5 → 6 → 5 / 10** *(−1)*

⚖️ **LA CORRECTION DE JUSTICE TIENT, REVÉRIFIÉE DANS LA PAGE** :
`uContourOpacity` vaut **0 des deux côtés**, aux deux cadrages. Les courbes de
niveau ne comptent pas contre le crop.

| | crop | socle | | note 03 |
|---|---|---|---|---|
| tuiles dans la bande verticale du mur, **intérieur** | **53 130** | **2 149** | ×24,7 | 54 379 / 2 722 |
| nappe dans la bande du mur, **côte** | **1 235** | **332** | ×3,72 | 1 053 / 241 |
| **frange : longueur moyenne des paliers** | ⛔ **2,06** | **1,67** | | 1,943 / 1,674 |
| **frange : part des suites de 4 px et plus** | ⛔ **13,57 %** | **6,45 %** | | 11,10 % / 6,58 % |
| `contourInterval` | **200** (mètres) | **0,29** (unités de scène) | ⛔ faux | idem |

⛔ **CE QUI FAIT BAISSER LA NOTE : LA FRANGE CÔTIÈRE A EMPIRÉ DEPUIS LA NOTE 03,
ET JE LA VOIS.** `J1-zoom-CROP-frange-N03.png` contre `J2-…SOCLE-…`, même
échelle, même seconde : **le socle rend un lagon turquoise large, continu et
finement texturé, qui se dégrade doucement vers le bleu profond ; le crop rend
un ESCALIER de grands blocs rectangulaires** et une mer plate sans grain. Chiffré,
**la part des suites de 4 px et plus passe de 11,10 % à 13,57 % (+22 %)** pendant
que **le socle se reproduit à 2 %** (6,58 → 6,45). **P10 l'a déclarée
(« empiré de 5,9 %, c'est le prix de l'accord de bande »), P11 l'a mesurée
intacte et refusée avec motif. Elle n'a toujours pas été payée.**

⚡ **CE QUI EST RÉPARÉ, ET JE LE VOIS AUSSI.** `D1-zoom-CROP-arete-N03.png`
contre `D2-…SOCLE-…` (×3, même fenêtre, même seconde) : **les créneaux et
encoches de 3 à 10 px du raccord paroi/surface ont disparu** — c'est le travail
de P11, et son ampleur mesurée est celle qu'elle revendique (**part de paroi dans
le bloc 32,10 % → 31,88 %, soit 4,2 % de l'écart au socle**). ⛔ **Mais l'image
dit le reste : le socle coupe son mur en AIGUILLES FINES, une par ravine, quand
le crop rend une COURBE POLYGONALE LISSE.** Le raccord est propre et il est faux.

⚠️ **ET LE ×24,7 N'EST PAS UNE GRANDEUR QUE JE DÉFENDS.** Le dénominateur bouge
tout seul : le socle rend **2 722** px à la note 03 et **2 149** chez moi
(−21 %) au cadrage intérieur, et **241 / 326 / 671 / 984** en quatre exécutions au
cadrage côte. **Je le donne comme ordre de grandeur, comme la note 03 le faisait,
et je ne publie aucun rapport sur le tablier de mer** — c'est la réserve n° 9 de
P10 et la n° 5 de P11, re-confirmées.

⚠️ **UNE DIFFÉRENCE QUE JE VOIS ET QUE PERSONNE N'AVAIT NOMMÉE : LES EAUX
INTÉRIEURES.** Sur `A2` et `F2` (socle), **un réseau hydrographique bleu court
sur tout le relief** — dense au cadrage côte, visible à ×6 sur `B4`. Sur `A1` et
`F1` (crop), pris à la même seconde : **aucun**. Chiffré sur le masque de surface
apparié, secteur 210–240° : socle **692**, crop **100**. ⚠️ **JE LE DÉCLARE AVEC
SA FAIBLESSE** : le réseau du socle est **instable d'un chargement à l'autre** —
il est là dans deux de mes trois pages, absent de la troisième, et
`.banc/N04/v3-eaux-interieures.js` montre qu'éteindre `uSeaMaskOn` sur le socle
ne change **rien** (0 canal) dans la page où il est absent. **Je ne sais donc pas
quelle couche le porte, et je ne l'affirme pas. Ce que j'affirme, plus
étroitement : dans les pages où le socle le dessine, le crop n'en a jamais un
seul pixel.**

### ④ La mer — **2 → 5 → 7 → 5 / 10** *(−2, et c'est la plus mauvaise nouvelle de cette note)*

⚠️ **LE DÉNOMINATEUR D'ABORD** : masque de mer du crop **76 136 px**, du socle
**79 868** ; tout est mesuré sur leur **INTERSECTION : 75 071 px**.

| sur l'intersection | crop | socle | | **note 03** |
|---|---|---|---|---|
| écume (L > 200, sat < 0,25) | **1** | **1** | ⚡ **égalité tenue** | 1 / 1 |
| **énergie de détail du FOND MARIN seul** | ⛔ **3,668** | **4,864** | ⛔ **crop 75,41 %** | ⚡ **100,08 %** |
| énergie de détail de la mer composée | 2,368 | 3,402 | crop 69,6 % | 80,4 % |
| écart horizontal moyen | 1,852 | 3,058 | crop 60,6 % | 72,2 % |
| luminance, région comparable | 79,278 | 67,039 | ⛔ **+18,26 %** | +16,71 % |
| bleu profond, région comparable | ⛔ **73** | 846 | | **2 828 / 824** |
| pavage : pic de période sur la nappe | ⛔ **15 px (0,0828)** | **aucun** | | 0 / 0 |

➡️ ⛔ **LE POSTE QUE LA NOTATION 03 DÉCLARAIT FERMÉ À +0,08 % EST ROUVERT À
−24,6 %.** Le grain du fond marin du crop, qui valait **100,08 %** de celui du
socle, n'en vaut plus que **75,41 %** — et **le socle se reproduit à +0,2 %**
(4,854 → 4,864), donc **ce n'est pas du bruit de banc**.

⚡ **ET J'EN NOMME LA CAUSE PAR UNE MESURE, PAS PAR UNE HYPOTHÈSE.** Le témoin de
normale fine du script du noteur, rejoué tel quel :

| **normale fine ÉTEINTE** | note 03 | **moi** |
|---|---|---|
| énergie du fond marin | 2,089 | **2,099** |
| énergie de la mer composée | 1,891 | **1,897** |
| bleu profond | 248 | **245** |

➡️ ⛔ **NORMALE FINE ÉTEINTE, LES DEUX ÉTATS SONT IDENTIQUES À 0,5 % PRÈS. LE
MATÉRIAU DE LA MER N'A PAS CHANGÉ : TOUTE LA PERTE EST DANS LA NORMALE FINE.**
L'apport de la normale sur le fond marin passe de **+132,6 %** (P9) à
**+74,7 %** (P10) — c'est **le pas élargi que P10 a choisi et défendu au §2.4 de
son rapport**, qui coûte sur la mer ce qu'il a gagné sur le relief. **P10 a
déclaré ce prix sur la frange ; il ne l'a pas mesuré sur le grain du fond, et il
y est deux fois plus grand.** ⚡ **Et la nouvelle ancre de P11 est hors de cause,
prouvé : au cadrage côte elle déplace 0 canal (§4.2).**

⚠️ **ET ÇA CORRIGE UNE LECTURE DE MA NOTE 03.** J'écrivais que « sur la région
comparable, le crop a PLUS de bleu profond que le socle : 2 828 contre 824 ».
C'était vrai ce jour-là — mais ce bleu profond était **fabriqué par la normale
bruitée de P9** : normale fine éteinte, il valait déjà **248**. P10 a retiré le
bruit, et il est retombé à **73**. **Ma correction de la note 02 reste juste sur
son fond** (92,47 % du bleu profond du socle vit sur les 14,48 % où il compose
sur du vide — je retrouve 92,67 % et 14,48 % de la note 03), **mais l'argument
« le crop en a plus » ne tient plus, et il tenait à un défaut.**

**Ce qui n'est pas réparé** : la mer reste **+18,3 % trop claire** sur la région
comparable, son détail vaut **70 %** de celui du socle, sa frange est un escalier
(③), et ⛔ **elle porte toujours son PAVAGE RECTANGULAIRE**, désormais **mesuré**
et pas seulement vu : pic de périodicité à **15 px**, amplitude normalisée
**0,0828**, quand le socle n'en a **aucun** dans la même exécution. Il est
franchement visible sur `F1-CROP-cote-N03.png` et sur `J1`.

### ⑤ Les parois et la base — **2 → 5 → 6 → 6 / 10** *(=)*

⚡ **LA COULEUR EST JUSTE, ET JE LA PROUVE EN LA BOUGEANT** (je bouge la couleur
VIVANTE du matériau de paroi du socle, pas `params.plinthColor`) :

| | avant | **pendant le témoin** | après |
|---|---|---|---|
| `plinth.wallMat.color` (socle) | `#c06a44` | **`#c81e1e`** | `#c06a44` |
| `uParoiCouleur` (crop) | `#c06a44` | ⚡ **`#c81e1e`** | `#c06a44` |

**202 726 canaux changent, l'aller-retour rend 0.** *(`params.plinthColor` vaut
toujours `#d8d4cc` : c'est le matériau qui est lu, pas le paramètre.)*

| profil de paroi, en percentiles (P8) | crop | socle | | note 03 | note 02 |
|---|---|---|---|---|---|
| face sombre (p20) | **17,87** | **15,88** | crop ×1,125 | ×1,125 | ×1,68 |
| face claire (p80) | 44,28 | 48,15 | crop −8,0 % | −8,0 % | +10,6 % |
| contraste inter-faces | **2,478** | **3,032** | socle ×1,224 | ×1,223 | ×1,52 |

➡️ **Rien n'a bougé de mesurable depuis la note 03, et je ne prétends pas le
contraire.** La note reste à 6.

⛔ **CE QUI MANQUE TOUJOURS, ET C'EST LA PAIRE LA PLUS NETTE DE MA JOURNÉE : LE
CHANFREIN.** Sur `J4-zoom6-SOCLE-nappe-paroi-N03.png` (×6) **et** sur
`D2-zoom-SOCLE-arete-N03.png` (×3), **un fin liseré lumineux court sur TOUTE
l'arête haute de la paroi**. Sur `J3` et `D1`, pris à la même seconde,
**l'arête est franche, noire et nue**. Ni l'arrondi bas, ni aucune des
50 matières. **Inchangé depuis la note 01.**

⚖️ **L'OMBRE PORTÉE N'EST PAS NOTABLE, REMESURÉE** : `params.shadowMode = 'off'`,
silhouette + ombre = silhouette **des DEUX côtés à 0 px près** (crop
215 636 → 215 636 ; socle 211 074 → 211 074 ; retour exact). **0 contre 0. Ça ne
compte pas contre le crop.**

### ⑥ Propreté — **3 → 3 → 4 → 7 / 10** *(+3, et l'arithmétique est explicite)*

| défauts statiques | crop | socle | | note 03 | note 02 |
|---|---|---|---|---|---|
| tuiles **sous** le bas du mur (intérieur) | **1** | 0 | fermé | 1 | 2 186 |
| **langues distinctes** | **1** | 0 | fermé | 1 | 12 |
| lames de mer sous le mur (côte) | **0** | 0 | fermé | 0 | 4 |
| écume en plaques | **absente** | — | fermé | — | — |

**L'arithmétique de la note 03 était** : statique quasi fermé (**7**),
clignotement à **×360** le socle (**−3**), net **4**.
**La mienne est** : statique quasi fermé (**7**), clignotement **fermé au sens
fort** (§1.3 : ×25,5 le socle, **11 pixels instables contre 66 au socle**,
**aucune signature de parité**, résidu **sous le plancher du crop sans normale
fine**) → **le −3 tombe**. Restent deux plaies visibles que je facture ensemble
**−1** :

- ⛔ **le PAVAGE RECTANGULAIRE de la mer**, désormais chiffré (pic 15 px,
  0,0828 ; socle aucun) — c'est exactement « plaques et coutures », le mot du
  brief ;
- ⚠️ **les lames qui pendent DANS la bande du mur** : j'en compte **deux** sur
  `J3-zoom6-CROP-nappe-paroi-N03.png` (×6) et **quatre** sur `F1-CROP-cote-N03.png`.
  **`sousLeMur = 0` reste exact et reste incomplet** — la mesure ne les voit pas
  parce qu'elles restent dans la bande. La capture dit le reste.

**Net : 7 / 10.** ⚡ **C'est le plus grand gain de cette note, et il est entier au
crédit de P10.**

---

## 6. LA NOTE GLOBALE — **6,7 / 10**, contre 6,6 puis 5,3 puis 3,5

**Même pondération que les trois notes précédentes**, le relief comptant double
parce que c'est la plus grande surface de l'image.

| critère | 01 | 02 | 03 | **04** | écart | la mesure qui le justifie |
|---|---|---|---|---|---|---|
| ① Richesse du relief | 6 | 6 | 8 | **8** | **=** | crénelage **fermé** (vu sur `B3`) **mais** énergie **98,0 % → 116,3 %** et écart-type **+2,4 % → +15,4 %** ; part de la lumière **19,9 % → 25,8 %** (socle 45,9 %) |
| ② Palette et contraste | 3 | 7 | 7 | **8** | **+1** | distance de teinte **0,1859 → 0,0189** (÷ 9,8) ; olive **×0,285 → ×1,094** ; neutres **+9,26 → −0,81 point** ; ⛔ saturation **−15,0 % → +15,8 %**, amplitude ÷ 1,11 seulement |
| ③ Trait et bordure | 3 | 5 | 6 | **5** | **−1** | frange **11,10 % → 13,57 %** de suites longues (socle 6,45 %) ; créneaux du raccord **fermés** mais silhouette lisse contre aiguilles (`D1`/`D2`) ; `contourInterval` toujours faux ; eaux intérieures absentes |
| ④ La mer | 2 | 5 | 7 | **5** | **−2** | grain du fond marin **100,08 % → 75,41 %**, cause prouvée (normale fine éteinte : 2,089 / 2,099) ; détail **80 % → 70 %** ; clarté **+16,7 % → +18,3 %** ; pavage **mesuré** (15 px) |
| ⑤ Les parois et la base | 2 | 5 | 6 | **6** | **=** | p20 ×1,125, contraste ×1,224 — **au millième de la note 03** ; couleur prouvée en la bougeant ; **toujours aucun chanfrein** |
| ⑥ Propreté | 3 | 3 | 4 | **7** | **+3** | scintillement **×360 → ×25,5**, pixels instables **52 048 → 11** (socle 66), **aucune signature de parité** ; reste le pavage et 2 à 4 lames |

`(8×2 + 8 + 5 + 5 + 6 + 7) / 7 = 6,714` → **6,7 / 10**. Moyenne simple : **6,5**.

⛔ **ET LE +0,1 EST TROMPEUR : IL CACHE +4 ET −3.** Deux tâches ont livré, et
**les deux ont fermé leur poste** : P10 a fermé le n° 1 de ma note 03 (le
scintillement, +3 au critère ⑥), P11 a fermé le n° 5 (la peinture, +1 au critère
②). **Ce qui reprend les points, ce sont deux effets de bord qu'aucune des deux
ne visait** : **le pas élargi de P10 coûte le grain du fond marin (−2) et la
frange (−1)**, et **la pente de rampe ×3,12 de P11 coûte l'exposition du relief
(elle empêche le +1 du critère ①)**. **Les deux tâches ont déclaré un prix ;
aucune des deux n'en connaissait toute l'étendue.**

**⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE.** Mettez
`A1-CROP-interieur-N03.png` à côté de `A2-SOCLE-interieur-apparie-N03.png` : la
famille de couleurs est **la même** — c'est neuf, et c'est grand. Ce qui sépare
encore les deux images, à l'œil, **sur MES captures** : **le crop est plus clair
et plus contrasté, ses crêtes brûlent** ; **sa silhouette est une courbe lisse là
où le socle a des aiguilles** ; **sa paroi est un rouge vif sans chanfrein contre
un bordeaux à liseré** ; **sa mer est une plaque plate à pavage rectangulaire et
sa frange un escalier, là où le socle a un lagon continu** ; **et son relief ne
porte aucune rivière.**

---

## 7. ⚡ CE QUI MANQUE LE PLUS — LA LISTE ORDONNÉE

Rangée par **écart visuel mesuré**, pas par facilité.

### 1️⃣ ⛔ L'ACCORD D'EXPOSITION — *nouveau n° 1, et c'est le moins cher de la liste*

**Quatre dépassements de même signe et de même amplitude** : énergie de détail
**+16,32 %**, écart-type de luminance **+15,41 %**, saturation **+15,75 %**,
masse hors-orange **+16,43 %**. Sur `A1`, **les crêtes brûlent**.

⚡ **ET LA MOITIÉ DU TRAVAIL EST DÉJÀ FAITE, PARCE QUE LE §2 DIT OÙ ÇA N'EST
PAS.** Irradiance neutralisée à π des deux côtés, **l'albédo du crop et celui du
socle sont d'accord à 0,44 % de saturation, 0,65–1,01 % de moyenne RGB et 0,0058
de distance de teinte**. **Le terme fautif est donc entièrement dans
l'irradiance**, et il est **uniforme sur les trois canaux à 0,3 point près**
(×1,0848 / ×1,0818 / ×1,0842).

**Où ça vit** : `uSoleilIrr` = (3,756 · 3,493 · 2,972), `uCielIrr` =
(2,838 · 3,086 · 3,322), `uSolIrr` = (0,470 · 0,448 · 0,433) dans
`src/monde/eclairage-crop.js`, face au couple du socle — directionnelle
`#fff7e6` d'intensité **3,7556** et hémisphérique ciel `#85c2eb` / **sol
`#4a3a2a`** d'intensité **0,8126**. ⚠️ **Et la réserve de P8 est le suspect
nommé** : `mix(sol, ciel, 0.5·ndu + 0.5)` ne sait dire que `N·haut`, donc le sol
brun n'arrive pas où il devrait.
**Ce que ça coûte** : **faible** — un terme de gain, aucun rebranchement.
⚡ **Et la preuve est déjà écrite** : le poste est fermé le jour où
`rapports.energieDetail` **et** `saturationSocleSurCrop` de
`n1-etat-relief-palette.js` reviennent à **1,00 ensemble**, sans que la distance
de teinte remonte au-dessus de 0,03. ⚠️ **Ne pas baisser un gain sans regarder la
teinte : c'est exactement ce qui ferait retomber le critère ② de 8 à 7.**

### 2️⃣ ⛔ LE GRAIN DU FOND MARIN, PERDU DE 24,6 % — *une régression, et elle est chiffrée et attribuée*

**Le poste que la note 03 déclarait fermé à +0,08 % rend aujourd'hui 75,41 %.**
Le socle se reproduit à **+0,2 %**, donc ce n'est pas du bruit.
**Attribution prouvée** : normale fine **éteinte**, les deux états rendent
**2,089** et **2,099** — identiques. **Toute la perte est dans la normale fine**,
et l'ancre de P11 est hors de cause (**0 canal** au cadrage côte, §4.2).

**Où ça vit** : le **PAS** du gradient, `normaleFineCrop` dans
`src/monde/eclairage-crop.js` §6 — `max(un texel, l'empreinte du pixel)`, le
choix que P10 défend au §2.4 de son rapport (pleine empreinte contre demi, il a
mesuré 96,30 % contre 109,47 % **sur le relief** et n'a pas regardé la mer).
**Ce que ça coûte** : **faible à mesurer** (le banc existe : `n4-mer.js`, et il
rend déjà les deux colonnes), **moyen à régler** — c'est le même arbitrage de
bande passante, **refait cette fois avec la mer dans la balance**. ⚠️ **Il
n'est pas gratuit non plus** : c'est le pas qui a fermé le poste n° 1 de la
note 03, et le §1.3 dit ce qu'on risque en y touchant.

### 3️⃣ LA SILHOUETTE DIX FOIS TROP GROSSIÈRE, ET LE TERRAIN QUI DRAPE ENCORE

`D1-zoom-CROP-arete-N03.png` contre `D2-zoom-SOCLE-arete-N03.png`, ×3, même
fenêtre, même seconde : **le socle coupe son mur en aiguilles fines, une par
ravine ; le crop rend une courbe polygonale lisse.** Chiffré : paroi **67 699 px**
contre **60 151**, part de paroi dans le bloc **31,88 %** contre **28,37 %**,
tuiles dans la bande **53 130** contre **2 149**.

**Où ça vit** : `segmentsTuile(z)` — **25 sommets par côté**, soit **72 segments
par côté de bloc contre les 768 du socle : ⛔ 10,7 fois plus grossier PAR AXE.**

> ⛔ **CORRECTION DU 2026-08-23 — J'AI REPRIS ICI UN CHIFFRE DE P9 QUE LE RELEVÉ
> DE P9 DÉMENT.** J'écrivais *« soit 5 625 sur le bloc, contre les 594 434 du
> socle »*. **`S5-relief-P9.json` porte `crop.sommets = 29 978`**, avec
> `tuilesTouchees = 66` et `quadsParTuile = 64` : la sonde compte la pyramide
> de tuiles EMPILÉE (`tuilesCrop()`, `.banc/P7/harnais-P7.mjs:96`, rend TOUS les
> niveaux du quadtree), pas les 9 tuiles du bloc. Et le commentaire de cette
> sonde déclarait l'attente *« 9 x 25 x 25 = 5 625 au plus »* — **la garde a
> sonné sans être rapportée**, ni par P9, ni par moi qui ai recopié son chiffre.
> ➡️ **Le « cent cinq fois » (594 434 / 5 625) est retiré** : il comparait une
> MESURE à un CALCUL DE GÉOMÉTRIE — le défaut endémique des dénominateurs que
> le §0 du plan nomme — et 9 × 25² compte deux fois les sommets des arêtes
> partagées, ce que 768² ne fait pas.
> ⚡ **LE POSTE 3️⃣ NE BOUGE PAS D'UN CRAN** : il repose sur ce que j'ai mesuré
> moi-même — paroi **67 699 px contre 60 151**, tuiles dans la bande **53 130
> contre 2 149**, et les deux captures `D1`/`D2` — et sur le **×10,7 par axe**,
> qui est un rapport de SEGMENTS, indépendant de tout compte de sommets.
> *(Relecture groupée P8→P12, constat I-1.)*
**Ce que ça coûte** : ⛔ **CHER, et P11 l'a chiffré sans le payer** : c'est un
changement de budget de géométrie, sur les seules tuiles du crop
(`tuileDansCrop` sait déjà les désigner), qui demande **sa propre mesure de
coût**. **P11 en a fermé 4,2 %** en faisant lire à la paroi le MAILLAGE et non la
TEXTURE ; le reste est la résolution.

### 4️⃣ LA FRANGE EN MARCHES ET LE PAVAGE RECTANGULAIRE DE LA MER

Deux visages d'une même cause. **La frange** : paliers **2,06 contre 1,67**,
suites de 4 px et plus **13,57 % contre 6,45 %** — **aggravée de 22 % depuis la
note 03**, et le socle se reproduit à 2 %. Vue sur `J1` contre `J2` : un escalier
de gros blocs contre un lagon continu. **Le pavage** : mesuré pour la première
fois, **pic de période à 15 px, amplitude normalisée 0,0828**, quand le socle n'en
a **aucun** dans la même exécution ; visible au large sur `F1` et sur `J1`.
⚠️ **PRÉCISION DU 2026-08-23 : cet « aucun » est le relevé de MON instrument
(`n5`, `periodeSocle.pic = 0`), et un SECOND instrument dit autre chose.** P12 a
mesuré le même socle avec `e2-pas-mer-pavage.js` et trouve **`pic: 19,
picNormalise: 0,0339`** ; sa capture `F2-SOCLE-cote-apparie-N03.png` porte des
bandes verticales visibles à l'œil. **Je ne réconcilie pas les deux — deux
cadrages, deux fenêtres — mais je ne défends plus l'absolu : le socle n'est pas
à zéro sur cette grandeur.** *(Relecture groupée P8→P12, constat I-4.)*

**Où ça vit** : la frange vit dans **le même pas de gradient que le poste 2** —
P10 le dit, P11 le confirme et **refuse avec motif** de le reprendre (« la
toucher rouvrirait son poste n° 1 »), **et c'est un refus que je trouve fondé**.
Le pavage vit dans la résolution du champ cuit (`src/globe.js:3120-3128`).
**Ce que ça coûte** : tripler `CHAMP_FOND` coûte neuf fois `remplirHauteurs` —
**cher**. ⚡ **La route moins chère reste celle que la note 02 avait trouvée et
que personne n'a prise** : le trait de côte a déjà un masque à la résolution du
MNT (`uCoastMask`, `uMargeCoteM`, tous deux **allumés et posés** dans ma page) ;
faire porter la frange par CE masque plutôt que par le champ est **moyen**, et
ferme la moitié visible du poste sans payer les neuf fois.

### 5️⃣ LE CHANFREIN ET L'ARRONDI DES PAROIS — *inchangé depuis la note 01*

Sur `J4` (×6) **et** `D2` (×3), un **fin liseré lumineux** court sur toute
l'arête haute du mur du socle. Sur `J3` et `D1`, pris à la même seconde, **rien**.
C'est, avec la couleur de la mer, ce qui fait le plus lire le crop comme « pas
tout à fait le même objet ».

**Où ça vit** : `SOCLE_CHANFREIN` et `SOCLE_ARRONDI` dans `plinth.js`, face à
`construireParoisCrop`.
**Ce que ça coûte** : **moyen**. Aucune des onze tâches ne l'a pris.

### Et derrière, dans l'ordre

6️⃣ **La lame d'eau trop claire** — **+18,26 %** sur la région comparable
(+16,71 % à la note 03), facteur uniforme sur les trois canaux selon P9, **cause
non identifiée**. La recette d'extraction est `.banc/P9/s3-lame.js`. **Coût
inconnu ; la mesure est déjà là.**
7️⃣ **Les eaux intérieures** — le socle dessine un réseau hydrographique bleu sur
son relief, le crop **aucun** (692 px contre 100 sur le masque apparié).
⚠️ **Instable d'un chargement à l'autre côté socle, et je ne sais pas quelle
couche le porte** : à confirmer avant d'être pris.
8️⃣ **Les 2 à 4 lames de mer qui pendent DANS la bande du mur** — invisibles à la
mesure `sousLeMur`, visibles sur `J3` (×6) et `F1`.
9️⃣ **`contourInterval` dans la mauvaise monnaie** — crop **200 m**, socle
**0,29 unité de scène**. ⚖️ Invisible tant que `uContourOpacity = 0` des deux
côtés, **faux dès qu'on allume les courbes**. Le non-fermé n° 3 de P6.
🔟 **L'ombre portée** — ⚖️ **non notable, remesurée** : 0 px des deux côtés,
retour exact. **À rouvrir dans un état de page où le socle porte son ombre**, pas
avant. Puis la **grille métrique** (`gridOpacity = 0` des deux côtés), et les
**non portés du tout** que je n'ai mesurés sur AUCUNE capture, des deux côtés :
cartouche au sol, effets de surface, scanner, 50 matières de parois.

---

## 8. MES RÉSERVES

1. ⛔ **UN SEUL LIEU, DEUX CADRAGES.** La Réunion z12. ⚡ **Le §4 lève la réserve
   « avec mer » ; il ne lève pas celle-ci.** Un crop continental, un crop de haute
   latitude, un crop à plateau peu profond ne sont toujours pas jugés.
2. ⚠️ **LA MESURE EN MOUVEMENT RESTE UN PROXY ET UN PLANCHER** (§1.3) : sans
   parallaxe, sans LOD, sans houle. Elle isole la parité des quads — le mécanisme
   dominant — pas tout le scintillement d'une vraie orbite.
3. ⛔ **LE RÉSIDU INEXPLIQUÉ DE LA NOTATION 03 SE REPRODUIT** : **9 957 canaux**
   au témoin de normale fine de `n4-mer.js`, contre 9 747 chez elle. **Systématique
   dans ce script, non reproduit ailleurs** (mon N6 rend 0 sur la mer ET hors de
   la mer). Aucun verdict n'en dépend, toutes mes paires étant prises au même
   instant.
4. ⛔ **MON SOCLE DE RÉFÉRENCE N'EST PAS BIT POUR BIT CELUI DE LA NOTATION 03.**
   Deux de mes trois pages lui dessinent un réseau hydrographique que ses captures
   n'ont pas (**692 px, 0,48 % du masque de surface**), et son énergie de détail
   rend **16,287** chez moi contre **16,044** chez elle (**+1,5 %**), son résidu
   de mouvement **0,0321** contre **0,0302** (**+6,3 %**), sa `dansLaBande`
   **2 149** contre **2 722** (**−21 %**). **C'est le bruit inter-chargement du
   chantier, et il borne toutes mes comparaisons À TRAVERS LES NOTES.** ⚠️ **Mes
   comparaisons crop ↔ socle, elles, sont toutes prises dans la même page à la
   même seconde, et c'est la seule raison pour laquelle elles valent quelque
   chose.**
5. ⚠️ **LE ×24,7 DU DRAPÉ ET LE TABLIER DE MER NE SONT PAS DES GRANDEURS.** Leurs
   dénominateurs bougent de 21 % à 300 % entre exécutions sans que rien ne les
   touche. **Je ne publie aucun rapport sur le tablier**, et je donne le drapé
   comme un ordre de grandeur.
6. ⚠️ **JE N'AI PAS REJOUÉ L'A/B À TROIS FONDS DE P9** sur la lame d'eau. Le
   « 1,34 fois trop claire » du poste n° 6 est **son chiffre, pas le mien** ; ce
   qui est de moi est le **+18,26 %** qui reste sur la région comparable.
7. ⚠️ **JE N'AI CHRONOMÉTRÉ AUCUN COÛT EN TEMPS DE RENDU**, pas plus que les
   notes 03, P10 et P11. Les trois postes que je propose (gain d'irradiance, pas
   du gradient, masque de côte) sont donnés en ordre de grandeur d'effort, **pas
   en millisecondes**.
8. ⚠️ **PAS DE COMPOSITEUR.** Il s'applique identiquement aux deux
   (`composer.addPass(passeFond, 0)`), donc il ne biaise aucun écart, **mais mes
   images ne sont pas exactement celles qu'Adrien voit.**
9. ⚠️ **LES VALEURS ABSOLUES DE COULEUR NE SE COMPARENT PAS D'UNE NOTE À
   L'AUTRE** (règle de la note 02 §0.4). Seuls les ÉCARTS crop ↔ socle mesurés
   dans une même page se comparent, et c'est ainsi que les §3, §5 et §6 sont
   écrits.
10. ⚠️ **LES DEUX MASQUES DE PAROI N'ONT PAS LA MÊME ÉTENDUE** (crop 67 699 px,
    socle 60 151). Le profil se compare en **percentiles**, comme P8 l'a défini.
11. ⚠️ **LES DÉCOUPES ×6 NE MONTRENT PAS LE MÊME MORCEAU DE TERRAIN** (le socle
    est à `k = 1,009`, donc recadré). **Je m'en sers pour juger la TEXTURE, jamais
    pour comparer un pixel à un pixel.**
12. ⚠️ **LE BALAYAGE D'APPARIEMENT NE RETOMBE PAS TOUJOURS SUR LE MÊME `k`**
    (1,0090 à N1, 1,0095 à V3, même cadrage). Les deux sont sous 0,03 %, et je le
    signale plutôt que de le taire.
13. ⚠️ **LA PRODUCTION EST INTOUCHÉE, RELEVÉ** : drapeau baissé,
    `uReliefBas = −6 000 = −uOceanDepth`, `uNormaleFineOn = 0`. **Tout ce que
    cette note juge vit derrière le drapeau.**

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/N04/` — **46 captures PNG**, **10 relevés JSON**, le récepteur
(`recois-N04.mjs`, port 5613), le marqueur de serveur (`marqueur.txt`), les
journaux de chaque exécution, et **les trois scripts que j'ajoute** :

- `v1-ancre-avec-mer.js` — **le volet B, cas AVEC mer** : l'échelle vivante,
  l'identité de l'ancre, et l'ancre bougée dans les deux sens ;
- `v2-ancre-sans-mer.js` — **le même, cas SANS mer**, pour que la dichotomie soit
  mesurée des deux côtés dans MA page ;
- `v3-eaux-interieures.js` — la tentative d'attribuer le réseau hydrographique du
  socle, **et son échec, laissé sur le disque avec son verdict**.

Le pilote est celui de P9 (`.banc/P9/pilote-P9.mjs`), **réemployé tel quel**, les
scripts `n1` à `n6` sont ceux de la notation 03 et `d1-palette.js` celui de P11,
**tous rejoués sans une ligne modifiée**.

**Les paires à regarder d'abord :**

- ⚡ **`A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`**
  (**+0,0007 %**) — **la même famille de couleurs pour la première fois**, et
  aussi les crêtes qui brûlent. Si vous ne regardez qu'une paire, c'est celle-là.
- ⚡ **`D1-zoom-CROP-arete-N03.png` ↔ `D2-zoom-SOCLE-arete-N03.png`** (×3) —
  **la courbe lisse du crop contre les aiguilles du socle**, et le liseré de
  chanfrein que seul le socle porte. **Les postes 3 et 5 en une image.**
- ⚡ **`J1-zoom-CROP-frange-N03.png` ↔ `J2-zoom-SOCLE-frange-N03.png`** —
  **l'escalier contre le lagon**, et le pavage rectangulaire du crop. **Le poste
  4 en une image.**
- **`E1-carte-scintillement-CROP-N03.png` ↔ `E3-…SOCLE-…`** — **la carte de la
  note 03 s'allumait entièrement ; celle-ci est noire.** Le poste n° 1 de la note
  03, fermé, en une image.
- ⚡ **`V1-CROP-cote-livre.png` ↔ `V1-CROP-cote-ancre-avant-P11.png`** —
  **379 178 octets chacun, 0 canal d'écart** : le volet B, en deux fichiers.
- **`V2-CROP-interieur-livre.png` ↔ `V2-CROP-interieur-ancre-avant-P11.png`** —
  **le même uniforme, l'autre cadrage : 416 420 canaux.** L'île de Mars revient.
- **`D1-albedo-CROP-P11.png` ↔ `D1-albedo-SOCLE-P11.png`** *(déposés par le
  script de P11 rejoué chez moi)* — **les deux albédos nus, irradiance
  neutralisée à π des deux côtés, aujourd'hui d'accord à 0,44 %.**
- **`F1-CROP-cote-N03.png` ↔ `F2-SOCLE-cote-apparie-N03.png`** — les deux mers,
  et le réseau de rivières que seul le socle porte.
