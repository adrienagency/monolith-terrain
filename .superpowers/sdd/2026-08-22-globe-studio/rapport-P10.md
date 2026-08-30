# Tâche P10 — LE SCINTILLEMENT DE LA NORMALE PAR FRAGMENT

**Statut : LIVRÉE. LE POSTE N° 1 DE LA NOTATION 03 EST FERMÉ SUR SA PROPRE
MESURE.** · Commits **`9fdae0f`**, **`7ebc588`** et **`d258d0b`** sur
`regroupement` (arbre propre après commit, `.banc/` est `.gitignore`).

> ⛔ **UNE RÉSERVE COMPLÉTÉE LE 2026-08-23, APRÈS LA RELECTURE GROUPÉE P8→P12 :**
> le prix de mon pas était déclaré **sur un seul axe** (+5,9 % sur la frange).
> **Le même pas coûte 24,67 points sur le grain du fond marin** (100,08 % →
> 75,41 % du socle), et **je n'ai pas rejoué le script qui le mesure
> (`n4-mer.js`) ni déclaré que je le laissais de côté.** Encadré au §4, réserve
> n° 2 mise à jour. ⚠️ **J'y réfute aussi, pièces à l'appui, la façon dont ce
> grief m'a été formulé — et la version exacte est plus lourde, pas plus
> légère.**

`npm test` — **4 029 / 4 029** (4 027 au départ, **+2**) · `npm run audit:tests` —
**209 / 209** · `node --check` sur les quatre fichiers touchés et les trois
scripts du banc · campagne de mutation — **51 / 51**, dont **42 visant le
branchement (82,4 %)**, en DEUX tours · page chargée **drapeau levé ET baissé**.

> ⚡ **LE CRITÈRE DE SORTIE DU BRIEF, MESURÉ AU PROTOCOLE DU NOTEUR :**
> le résidu à `dx = 1` devait tomber « à ≈ 0,800 ».
> **Il rend 0,8143** — contre **10,872** à la notation 03, et **sous** le
> plancher de 0,8627 que rend le crop **normale fine ÉTEINTE** au même décalage.

---

## 0. LES DEUX CHIFFRES QU'ON M'A DEMANDÉS, D'ABORD

**Banc : celui du noteur, rejoué SANS UNE LIGNE MODIFIÉE.**
`.banc/P9/pilote-P9.mjs` (le pilote), `n1-etat-relief-palette.js`,
`n3-mouvement.js` et `n5-trait-proprete-mouvement.js` de
`.banc/vues-notation-03/`, harnais `harnais-N03.mjs` compris. **Seul le
récepteur change** (`.banc/P10/recois-P10.mjs`, même port 5613, autre dossier) :
je dépose dans `.banc/P10/` pour ne rien écraser de ses relevés. Cadre
**1 280 × 800**, La Réunion, cadrage intérieur **lat −21,115 · lon 55,536**,
z12, vue isométrique 0, **rendu dans une cible à profondeur, sans compositeur,
boucle rAF gelée, socle rallumé dans la MÊME page**.

### ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est celle du noteur, de
P7, P8 et P9 — et je ne la déclare pas seulement, **je la prouve en retrouvant
ses constantes** : `heightContrast / heightPivot` = **2,2 / 0,41** au cadrage
intérieur (sa preuve de lieu), **594 434 sommets** au `terrain.mesh`, rampe et
texture d'analyse **même objet `three` des deux côtés**.

### 0.1 ⚡ LE SCINTILLEMENT — `.banc/P10/N3-mouvement-P10.json`

Résidu moyen après recalage, en octets de luminance, masques érodés de 4 px
(crop **135 269 px**, socle **135 291**), appariés à **+0,0249 %** :

| décalage | SOCLE | CROP **normale fine ON** | CROP OFF | | notation 03, ON |
|---|---|---|---|---|---|
| **dx = 1 px** | 0,0320 | ⚡ **0,8143** | 0,8627 | | ⛔ **10,8724** |
| dx = 2 px | 0,0014 | **0,7865** | 0,8350 | | 0,8002 |
| **dx = 3 px** | 0,0322 | ⚡ **0,8163** | 0,8647 | | ⛔ **10,8563** |
| pixels instables (> 8 o) à dx = 1 | 66 (0,049 %) | ⚡ **6 (0,004 %)** | 5 (0,004 %) | | ⛔ **52 048 (38,49 %)** |
| résidu maximal à dx = 1 | 73,61 | **10,57** | 11,07 | | **164,33** |

➡️ ⚡ **LA SIGNATURE DE PARITÉ A DISPARU.** 0,8143 · 0,7865 · 0,8163 : le
micro-écart pair/impair qui reste est **exactement celui de la colonne OFF**
(0,8627 · 0,8350 · 0,8647), c'est-à-dire le plancher du RESTE du nuanceur, que
la normale fine ne fabrique pas. **×13,35 sur le résidu, ×8 675 sur les pixels
instables.** Le rapport au socle passe de **×360 à ×25,4**.

⚠️ **ET LE CRITÈRE LITTÉRAL DU BRIEF EST INATTEIGNABLE, JE LE DIS.** « ≈ 0,800 »
est la valeur des décalages PAIRS. Aux décalages IMPAIRS, **le noteur lui-même
mesure 0,863 sur un crop SANS normale fine du tout** : c'est le plancher, et
aucune loi de normale ne peut passer dessous en le laissant intact. **0,8143 est
sous ce plancher**, et l'écart pair/impair résiduel (0,0278) est celui de la
colonne témoin (0,0288). **Le poste est fermé au sens fort : la normale fine
n'est plus, en mouvement, distinguable de son absence.**

### 0.2 ⚠️ L'ÉNERGIE DE RELIEF — ET ELLE COÛTE 1,7 POINT

`.banc/P10/N1-etat-relief-palette-P10.json`, mêmes masques, même page :

| | **P10** | notation 03 (P9) | socle |
|---|---|---|---|
| énergie de détail, crop | **15,495** | 15,727 | — |
| énergie de détail, socle | — | — | **16,090** *(lui : 16,044)* |
| ⚡ **rapport au socle** | **96,30 %** | **98,02 %** | — |
| normale fine éteinte | 10,996 | 10,965 | — |
| apport de la normale fine | **+40,91 %** | +43,43 % | — |
| écart-type de luminance | **52,769** | 52,759 | 51,710 |
| part de la lumière dans le modelé | **19,94 %** | 19,93 % | 45,49 % |

➡️ ⛔ **JE PERDS 1,72 POINT D'ÉNERGIE, ET JE NE LE CACHE PAS : 98,02 % → 96,30 %.**
En échange, **l'écart-type de luminance et la part de la lumière dans le modelé
sont ceux de P9 au centième** (52,769 contre 52,759 ; 19,94 % contre 19,93 %) :
**le caractère de l'ombrage n'a pas bougé, seule sa bande passante.**

⚡ **ET L'IMAGE, ELLE, EST MEILLEURE — regardez la paire.**
`.banc/P10/B3-zoom6-CROP-relief-P10.png` contre
`.banc/vues-notation-03/B3-zoom6-CROP-relief-N03.png` (même découpe, ×6, même
protocole) : le **crénelage en escalier le long des crêtes** et les **pixels
isolés bruités** que le noteur facture 2 points au critère ① **ont disparu**, et
le réseau de ravines est lisible là où P9 rendait des blocs. **C'est le seul
point de ce rapport que je défends à l'œil plutôt qu'au chiffre**, et je le
signale comme tel.

---

## 1. ⛔ CE QUI ÉTAIT FAUX, ET POURQUOI ÇA NE SE RÉGLAIT PAS

P9 avait livré la loi de Mikkelsen (`three`, `bumpmap_pars_fragment.glsl.js`),
qui reconstruit la normale depuis `dFdx(h)` / `dFdy(h)`. **Une dérivée d'écran
est une différence finie prise sur le VOISIN DE QUAD**, et le voisin d'un pixel
change quand la fenêtre de projection glisse d'un nombre IMPAIR de pixels.
Sur une hauteur à haute fréquence, les deux estimations n'ont rien à voir :
d'où **10,872 contre 0,800**, et la signature pair/impair du noteur.

⚠️ **BAISSER LE GAIN N'AURAIT RIEN RÉGLÉ** : le défaut est structurel, pas
d'amplitude. **La sortie nommée par le noteur était la bonne** — prendre le
gradient là où la donnée vit, dans la texture de hauteur.

## 2. CE QUI EST LIVRÉ

### 2.1 La loi

`src/monde/eclairage-crop.js` §6, **entièrement réécrit**. La surface du crop est
un champ de hauteur posé sur la sphère ; en un point, le sol a un repère
orthonormé (est, nord, haut) et la normale est la définition même :

    N = normalize( haut − gEst · est − gNord · nord )

⚡ **ET C'EST LA MÊME LOI QUE CELLE DE P9, PAS UNE APPROXIMATION.** Mikkelsen est
invariante par changement de paramétrage ; nourrie de (est, nord) — orthonormé,
donc `R1 = est`, `R2 = nord`, `det = 1` — elle **se réduit** à l'expression
ci-dessus. ⚡ **Le test ⑧b le rejoue terme à terme contre l'écriture de P9**, sur
six lieux réels et 13 pentes, à 1e−12 — **et donne le contre-exemple** : nourrie
d'un paramétrage NON orthonormé (celui des tangentes d'écran), elle rend un autre
vecteur. **La réduction vient du repère, pas de la formule.**

`normaleParDeplacement` et `nMondeDepuisVue` ont donc quitté `src/`. **La loi de
Mikkelsen survit dans `test/crop-eclairage.test.js`, comme SECOND oracle**, et
⑧c prouve, en lisant `node_modules/three`, que cette transcription est bien
celle de `three` et pas mon souvenir d'elle.

### 2.2 Le repère — et il ferme une double écriture qui existait déjà

`repereSolSphere(lat, lon)` est **la dérivée de `latLonToSphere`** (`src/geo.js`).
⚠️ **Les trois vecteurs étaient DÉJÀ écrits DEUX FOIS dans le module** —
`hautLocal` et le corps de `directionSoleilLocale` — et la normale par fragment
en aurait demandé une troisième, en GLSL. **Les deux appellent désormais la
même**, et le jumeau GLSL (`GLSL_REPERE_SOL`) est **injecté dans le nuanceur de
SOMMETS**, où `latlon` est un attribut exact.

Le test ⑧d oppose le repère à `latLonToSphere` **du dépôt**, par différences
finies, sur six lieux : `haut` EST la position normalisée, `est` et `nord` sont
`∂P/∂λ` et `∂P/∂φ`, le trièdre est **direct** (`est × nord = haut`) et
**orthonormé**. C'est ce qui autorise le fragment à n'interpoler que **deux**
varyings et à retrouver le nord par un produit vectoriel.

### 2.3 ⚡ L'INVARIANCE : PLUS UNE SEULE DÉRIVÉE D'ÉCRAN DANS LA NORMALE

| ce dont la normale dépend | invariant par translation ? |
|---|---|
| `vEstW` / `vHautW` — posés depuis l'**attribut** `latlon` | ✅ fonction de la position |
| les 4 lectures de hauteur, à `±pas` en espace **UV** | ✅ fonction de `vUv` |
| `pas` = `max(texel, vProfCam × uMppFacteur / metresParUv)` | ✅ `vProfCam` est un **varying** |
| `uUvParMonde`, `uTilePx`, `uCropDemi`, `uUnitesParMetre` | ✅ uniformes |

⚠️ **`vVue` a disparu du dépôt avec la loi qu'il servait**, et la raison de
précision qui l'imposait (l'ulp float32 à magnitude 100) **ne s'applique pas à
des vecteurs unitaires**. Le test ⑧e assert `!/dFdx|dFdy|fwidth/` **dans le bloc
entier** — c'est tout ce que node peut dire de l'invariance, et c'est exactement
la régression qu'on répare. Une mutation (**4i**) remet `fwidth(vUv)` dans le
pas : elle est **tuée**.

### 2.4 ⚠️ LE PAS — ET LA PREMIÈRE VALEUR ÉTAIT FAUSSE, MESURÉE

Un pas d'un texel est la réponse évidente ; elle est **incomplète**, parce que la
texture est MINIFIÉE au cadrage de la notation. Le pas est donc le plus grand
des deux : **un texel, ou l'empreinte du pixel**, lue sans dérivée d'écran par
`mppEcran = vProfCam × uMppFacteur` — la grandeur que la **Tâche K** a posée
précisément parce qu'elle ne dépend que de la distance.

⛔ **ET J'AI POSÉ LA DEMI-EMPREINTE D'ABORD. LA MESURE L'A REFUSÉE :**

| pas | énergie du crop | rapport au socle |
|---|---|---|
| **demi**-empreinte | 17,610 | ⛔ **109,47 %** |
| **pleine** empreinte *(livré)* | **15,495** | **96,30 %** |

**La raison est arithmétique** : P9 dérivait une hauteur **déjà lissée** par
`decodeMetersAA` sur une empreinte de pixel. La convolution d'un lissage de
largeur *W* et d'une différence d'écart *S* a un noyau de largeur *W + S* : le
noyau effectif de P9 couvrait **deux** empreintes. Une différence centrée de
demi-largeur `pas` couvre `2 · pas` : **`pas` = une empreinte**, et l'on retrouve
la bande de P9. *(Commit `7ebc588`.)*

### 2.5 La monnaie — la cinquième fois que ce chantier la paie

Une unité d'`uv` couvre `1 / 2^z` de tour de Mercator, donc
`uUvParMonde × TOUR_SPHERE_M × cos(latitude)` **mètres de sol**.

- ⛔ **`uUvParMonde` est PROPRE À LA TUILE**, comme `uTex` et `uTilePx` — partagé,
  il ferait juger la pente de toutes les tuiles sur le niveau de la dernière
  chargée. Son défaut est **le niveau ZÉRO**, donc un bloc **plat** : visible,
  pas silencieux.
- ⛔ **`TOUR_SPHERE_M` N'EST PAS `CIRCONFERENCE_M`.** `habillage-crop.js` emploie
  l'équateur WGS84 (40 075 016,686 m) pour des mètres de sol RÉELS. Ici on mesure
  une distance **sur la sphère du globe**, qui a le rayon MOYEN `EARTH_RADIUS_M`
  — le même que `uUnitesParMetre`. Les deux diffèrent de **0,11 %** : invisible,
  et faux. Le test l'assert dans les deux sens.
- ⚡ **ET LES DEUX CONVERSIONS SONT APPARIÉES PAR UN INVARIANT** :
  `TOUR_SPHERE_M × UNITES_PAR_METRE_SOL = 2 π R_GLOBE`, le tour de la sphère en
  unités de scène. Retourner l'une ou l'autre le fait exploser de neuf ordres de
  grandeur. **C'est une mutation survivante qui a demandé cette assertion.**
- Vérification à la main, dans le nuanceur **CUIT** : à z12, à la latitude de
  La Réunion, trois tuiles font **27 380 m** — P9 publie `extentMeters = 27 381`.

### 2.6 Trois lois du nuanceur deviennent des fonctions

`hauteurFond`, `hauteurGrain` et `hauteurEchant`. **Le gradient rappelle la MÊME
loi que `main()`** : recopier le fond marin ou le grain dans les quatre lectures
aurait fait « deux écritures jumelles qui divergent ». Le test compte **une seule
`texture2D(uFondChamp` et un seul `mnNoise(gp)`** dans le fragment CUIT.

⚠️ **ET IL EN FAUT DEUX, PAS UNE** : `main()` lit `sousEau` **entre** le fond
marin et le grain. Les fondre déplacerait ce test d'un cran, et la rampe
changerait de branche sur les fragments où le grain fait passer `h` de négatif à
positif. Les deux paramètres s'appellent `qCrop` et `h`, **comme au point
d'appel, et c'est délibéré** : `test/fond-crop.test.js` EXTRAIT ce bloc de la
source pour l'EXÉCUTER contre `altitudeSonde`.

---

## 3. ⚡ LA MER AUSSI — ET LE POSTE Y EST FERMÉ À 0,3 %

Cadrage **côte** (lat −21,05 · lon 55,25), `.banc/P10/N5-...-P10.json` :

| dx | SOCLE | CROP ON | CROP OFF | | notation 03, ON |
|---|---|---|---|---|---|
| 1 px | 0,0072 | ⚡ **0,3620** | 0,3585 | | ⛔ **1,4617** |
| 2 px | 0,0004 | **0,3633** | 0,3595 | | 0,4653 |
| instables à dx = 1 | 12 | ⚡ **15** | **15** | | **1 521 (2,34 %)** |

➡️ **La normale fine ALLUMÉE et ÉTEINTE rendent le même chiffre à 1 %, et le
même compte de pixels instables au pixel près.** Sur la mer, le poste n'est pas
réduit : **il n'existe plus.** (×4,04 sur le résidu, ×101 sur les instables.)

---

## 4. ⚠️ CE QUE J'AI DÉGRADÉ, ET JE LE DIS AVANT QU'ON ME LE TROUVE

⛔ **LA FRANGE CÔTIÈRE EN MARCHES A EMPIRÉ DE 5,9 %.** Poste n° 4 du noteur, que
je ne visais pas :

| | **P10** | notation 03 | socle P10 | socle N03 |
|---|---|---|---|---|
| longueur moyenne des paliers | **2,058** | 1,943 | 1,669 | 1,674 |
| part des suites de 4 px et plus | **13,57 %** | 11,10 % | 6,65 % | 6,58 % |

**Le socle se reproduit à 0,3 %** : ce n'est donc pas du bruit de banc, c'est
mon changement. Un pas plus large lisse la normale du fond marin, donc allonge
les paliers de luminance. **C'est le prix de l'accord de bande du §2.4**, et il
se paie sur la mer.

> ⛔ **CORRECTION DU 2026-08-23 — CETTE RÉSERVE ÉTAIT EXACTE SUR CE QU'ELLE DIT
> ET INCOMPLÈTE SUR CE QU'ELLE COUVRE. LE MÊME PAS COÛTE UN SECOND AXE, DEUX
> FOIS PLUS CHER, ET JE NE L'AI PAS MESURÉ.**
>
> **Le grain du fond marin, énergie de détail en pourcentage du socle** :
>
> | état | source | fond marin |
> |---|---|---|
> | avant mon pas (état P9) | `.banc/vues-notation-03/N4-mer-N03.json` | **100,08 %** (4,858 / 4,854) |
> | **après mon pas** | `.banc/N04/N4-mer-N03.json` | ⛔ **75,41 %** (3,668 / 4,864) |
> | après P12 | `.banc/P12/N4-mer-N03.json` | **84,91 %** (4,123 / 4,856) |
>
> ⛔ **−24,67 POINTS, contre les +5,9 % que je déclarais sur la frange.** C'est
> la notation 04 qui l'a trouvé, pas moi, et **mon §2.4 arbitre explicitement le
> pas (pleine empreinte 96,30 % contre demi-empreinte 109,47 %) EN NE REGARDANT
> QUE LE RELIEF.** Une réserve incomplète, corrigée après coup, doit le dire :
> voilà.
>
> ⚠️ **ET JE CORRIGE AUSSI L'ATTÉNUATION QU'ON M'A PROPOSÉE.** La relecture
> groupée P8→P12 (constat I-2) écrit que *« `n4-mer.js`, le script du noteur,
> rend déjà les deux colonnes, et P10 rejouait ce banc-là »*. ⛔ **Les deux
> moitiés de cette phrase sont fausses, et les fichiers le montrent :**
> · `n4-mer.js` rend **`out.fondSeul`** (ligne 87) et **PAS** la frange ; la
> frange vient de `n5-trait-proprete-mouvement.js`
> (`grainDeLaMer.plateauxCrop.longueurMoyenne = 2.058`,
> `part4plus = 13.57`, mes chiffres exacts). **Aucun script ne rend les deux
> colonnes.**
> · **Je n'ai jamais rejoué `n4-mer.js`** : mon §0 liste `n1`, `n3` et `n5`, et
> **il n'y a aucun `N4-*.json` dans `.banc/P10/`** — les seuls sur le disque
> sont ceux du noteur (`.banc/N04/`, `.banc/vues-notation-03/`) et celui de P12.
> ➡️ **CE QUI RESTE, ET QUI EST LE VRAI GRIEF** : le quatrième script de la
> suite du noteur était **sur le disque**, il portait **l'axe que mon pas
> touchait le plus**, et **je ne l'ai ni rejoué ni déclaré comme laissé de
> côté.** Ce n'est pas « le banc rendait déjà la colonne » : c'est **j'ai
> déclaré le prix sur l'axe que mon banc mesurait, sans dire que j'avais
> restreint mon banc.** **C'est plus grave que ce qu'on m'a reproché, et c'est
> ce que je porte.**
>
> ⚡ **CE QUE P12 EN A REPRIS, AU CHIFFRE PRÈS** : sur le **fond marin**,
> 75,41 % → 84,91 %, soit **9,50 des 24,67 points perdus — 38,5 %**, le reste
> étant dans la résolution de `CHAMP_FOND`. Sur la **frange**, l'excès sur le
> socle passe de 7,03 à 2,82 points, soit **60 %** — *c'est de là que vient le
> « deux tiers » ; il vaut pour la frange, pas pour le fond marin.*

---

## 5. LES PREUVES DE BANC, DANS L'ORDRE OÙ ELLES COMPTENT

1. ⚡ **MES TÉMOINS REPRODUISENT LE NOTEUR AU MILLIÈME**, et c'est ce qui rend
   mes chiffres comparables aux siens — pas une déclaration d'intention :

   | témoin, non touché par la tâche | moi | notation 03 |
   |---|---|---|
   | crop OFF, dx = 1 / 2 / 3 | 0,8627 · 0,8350 · 0,8647 | 0,8625 · 0,8343 · 0,8651 |
   | socle, dx = 1 / 2 / 3 | 0,0320 · 0,0014 · 0,0322 | 0,0302 · 0,0013 · 0,0304 |
   | crop sans normale fine, énergie | 10,996 | 10,965 |
   | part du soleil dans le modelé du socle | 45,49 % | 45,53 % |
   | sommets du `terrain.mesh` | 594 434 | 594 434 |

2. **Le plancher à `dx = 0` vaut 0,000 des DEUX côtés**, le **retour est exact à
   0 canal** dans les **24** séries, et **le recalage tombe sur le décalage
   demandé dans les 24 cas**.
3. **Témoin nul** : deux prises de suite, **0 canal** sur 4 096 000.
   `uMerTemps` **immobile** (2,752 100 000 008 939 avant et après) — le
   treizième piège (`geler()` qui ne gèle rien) écarté **par mesure**.
4. ⚡ **ET LE RÉGLAGE EST PROUVÉ EN LE BOUGEANT, DANS LES DEUX SENS** :
   l'aller-retour de `uNormaleFineOn` change **403 106 canaux** et **revient à
   0**. Une concordance au défaut n'est pas un branchement.
5. **Appariement balayé sur un CLONE de caméra, dans la même exécution JS que la
   mesure** : **+0,0249 %** au cadrage intérieur (cible re-mesurée identique au
   pixel, `reproductibilite: [144 777, 144 777]`), **−0,0431 %** au cadrage côte.

**Sur le disque, `.banc/P10/`** : 15 captures PNG, 4 relevés JSON, le récepteur,
la campagne de mutation, son résultat, les deux scripts de clôture et de coût,
et les journaux de chaque exécution.

**Les paires à regarder d'abord :**

- ⚡ **`E1-carte-scintillement-CROP-P10.png` ↔
  `.banc/vues-notation-03/E1-carte-scintillement-CROP-N03.png`** — **le bloc
  entier allumé, crêtes et ravines en blanc, contre un noir presque parfait.**
  Si vous ne regardez qu'une paire, c'est celle-là.
- `B3-zoom6-CROP-relief-P10.png` ↔ `.banc/vues-notation-03/B3-...-N03.png` (×6)
  — **le crénelage au repos, et sa disparition.**
- `A1-CROP-interieur-P10.png` ↔ `A2-SOCLE-interieur-apparie-P10.png` (+0,0249 %).

---

## 6. LA CAMPAGNE DE MUTATION — 51 / 51, EN DEUX TOURS

`.banc/P10/mutations-P10.mjs`, worktree à part (`C:/Dev/wt-p10-mut`,
`node_modules` en jonction, `git ls-files --eol` à `i/lf w/lf`, **215 tests verts
AVANT de commencer**, arbre rendu propre après chaque mutation, **worktree retiré
en partant**). **42 des 51 mutations visent le BRANCHEMENT — 82,4 %**, contre les
60 % demandés.

⛔ **QUATRE ONT SURVÉCU AU PREMIER TOUR, ET CHACUNE A TROUVÉ UN VRAI TROU :**

| | ce qu'elle a trouvé | ce qui la tue maintenant |
|---|---|---|
| **1d** | ⛔ **MON TEST DU CAS DÉGÉNÉRÉ ÉTAIT UNE TAUTOLOGIE** : il appelait la loi avec `haut = [0,0,0]`, où les DEUX branches rendent le même vecteur nul | un vrai dégénéré (`est` colinéaire à `haut`, pente 1) **et** l'identité `\|v\|² = 1 + gEst² + gNord²`, balayée |
| **4c** | `cross(haut, est)` n'était asserté nulle part : le nord retourné, l'éclairage des versants nord-sud avec | assertion du nuanceur cuit, adossée au trièdre direct prouvé en ⑧d |
| **4j** | `uUvParMonde / uCropDemi` n'était asserté nulle part | ⚡ **un test EXÉCUTABLE (⑧e ter)** : `dq/duv` rejoué sur `tileToLatLon` **du dépôt**, aux deux signes, à trois niveaux |
| **5e** | les deux conversions de monnaie n'étaient **pas appariées** | ⚡ **l'invariant `TOUR × UNITE = 2 π R_GLOBE`** |

⚠️ **ET LA LEÇON DU CHANTIER S'APPLIQUE À MOI : « si une survit, cherche d'abord
si le code est mort ».** Je l'ai cherché pour **1d**, et **le verdict est
nuancé** : dans le NUANCEUR la branche est **inatteignable par l'algèbre** (le
repère y est ré-orthonormalisé, donc `|v| ≥ 1`). Je l'ai **gardée quand même**,
et l'argument est écrit dans le module : c'est le CONTRAT de la fonction pure,
que `test/crop-eclairage.test.js` appelle avec des repères quelconques, et le
jumeau GLSL la porte pour ne pas diverger de son jumeau JS — **une divergence
coûterait plus cher qu'une comparaison par fragment**. ⚠️ **C'est un jugement, et
un relecteur a le droit de le renverser.**

**Chaque test tueur a été vérifié EXPÉRIMENTALEMENT** : les quatre mutations
remises, les tests rejoués, **`git diff --stat` vide** entre chaque.

---

## 7. ⚠️ LE COÛT EN TEMPS DE RENDU — LA RÉSERVE N° 9 DU NOTEUR, ET DEUX BANCS
## AVEUGLES AVANT LE BON

Le noteur écrivait : *« la solution que je propose au poste n° 1 en ajouterait
d'autres : elle demande une mesure de coût avant d'être posée »*. **P9 ne l'a pas
chronométrée, lui non plus. Je l'ai fait** (`.banc/P10/s-cout.js`,
`N8-cout-P10.json`) — **et mes deux premiers bancs étaient aveugles, leur propre
témoin l'a dit :**

1. un `rendreLin` par échantillon : allumée **33,9 ms**, éteinte **33,5** —
   ⛔ mais **couper TOUT l'éclairage du bloc rendait 34,0**, c'est-à-dire RIEN.
   La relecture de 1 024 000 pixels écrasait le signal ;
2. 24 rendus amortis derrière un barrage : ⛔ **les deux états ALLUMÉS d'une même
   exécution différaient de 0,76 ms** quand l'écart allumé/éteint valait 0,83.
   La dérive était aussi grande que le signal.

⚡ **LE BANC QUI TIENT MESURE EN ALTERNANCE** — chaque échantillon chronomètre
les deux états dos à dos, 31 paires, et publie la médiane des DIFFÉRENCES : une
dérive lente s'annule dans chaque paire.

| | médiane |
|---|---|
| allumée | **2,3458 ms** |
| éteinte | **2,2375 ms** |
| **surcoût médian** | **+0,0625 ms (+2,8 %)** |
| ⚠️ témoin de bruit (même état contre lui-même) | médiane **−0,0125 ms**, étendue **[−0,3083 ; +0,1417]** |

➡️ ⚠️ **JE NE PUBLIE PAS « +2,8 % » COMME UN FAIT.** Le surcoût est **du même
ordre que le bruit propre du banc**. Ce que je défends, c'est une **BORNE** :
sur la scène du globe, 245 tuiles, 1 280 × 800, **le surcoût de la normale par
fragment est inférieur à ~0,15 ms par rendu**, soit **moins de 7 %**. Le bilan
d'instructions va dans le même sens : **+4 `texture2D`** (plus 4 sous l'eau
seulement), **−2 `dFdx(vec3)`, −2 `dFdy(vec3)`, −2 produits vectoriels, −1
transposée**, **+1 varying `vec3` net**, et **4 `sin`/`cos` par SOMMET** (5 625
sur le bloc) au lieu de par fragment (144 631).

---

## 8. LA PRODUCTION EST INTOUCHÉE, ET C'EST RELEVÉ

`.banc/P10/cloture-baisse.log` — page chargée **sans `?terre=unique`** :
`terrain.mesh` **visible**, plinthe **visible**, `real-water` **visible**,
**`uNormaleFineOn = 0`**, `uUnitesParMetre` juste à 1e−18 près pour
`exagération = 18`, **30 programmes compilés**, **aucune erreur de nuanceur**.

`.banc/P10/cloture-leve.log` — **drapeau levé** : 245 tuiles, mer, parois et fond
posés, `refus: []`, **`uNormaleFineOn = 1`**, **`uUvParMonde = 0,25` sur une
tuile z2** (`2⁻² = 0,25`, relevé sur le matériau vivant), 23 programmes.

⚠️ **UN AVERTISSEMENT DE COMPILATION SUBSISTE DES DEUX CÔTÉS** —
`warning X4000: use of potentially uninitialized variable (f_surfaceFx_int)`.
**Il est ANTÉRIEUR : le rapport de P9 le déclare déjà** (§ réserves). Pas le
mien, pas corrigé.

---

## 9. MES RÉSERVES

1. ⚠️ **JE PERDS 1,72 POINT D'ÉNERGIE DE RELIEF** (98,02 % → 96,30 % du socle).
   L'écart-type de luminance et la part de la lumière sont ceux de P9 au
   centième, et l'image ×6 est meilleure — **mais le chiffre du critère ① baisse,
   et c'est au noteur d'arbitrer, pas à moi.**
2. ⛔ **LA FRANGE CÔTIÈRE EN MARCHES EMPIRE DE 5,9 %** (§4). Mesurée, déclarée,
   non corrigée. ⛔ **ET CETTE RÉSERVE ÉTAIT INCOMPLÈTE — correction du
   2026-08-23** : le même pas coûte aussi **24,67 points sur le grain du fond
   marin** (100,08 % → 75,41 % du socle), axe que **je n'ai pas mesuré parce que
   je n'ai pas rejoué `n4-mer.js`, sans le déclarer.** Voir l'encadré du §4.
3. ⚠️ **LA MESURE EN MOUVEMENT RESTE LE PROXY DU NOTEUR, DONC UN PLANCHER.**
   Translation rigide de la fenêtre de projection : **ni parallaxe, ni changement
   de LOD, ni houle.** Elle isole la parité des quads — que je ferme — **elle ne
   mesure pas tout le scintillement d'une vraie orbite.** Un pas d'un texel
   échantillonne plus fin que l'écran quand la texture est très minifiée ; en
   orbite lointaine cela peut encore ramper, et **je ne l'ai pas mesuré**.
4. ⚠️ **UN SEUL LIEU, DEUX CADRAGES** — La Réunion z12. Un crop continental (donc
   sans mer), un crop de haute latitude, un crop près du pôle (où `cos(latitude)`
   s'effondre et où le repère de sol dégénère) **ne sont pas jugés ici**. La
   borne `max(cos, 1e-4)` est posée mais **jamais exercée à l'écran**.
5. ⚠️ **LE COÛT N'EST PAS RÉSOLU, IL EST BORNÉ** (§7). Le surcoût mesuré est de
   l'ordre du bruit du banc.
6. ⚠️ **LE BORD DE TUILE N'EST PAS TRAITÉ.** Les quatre lectures peuvent sortir
   de la tuile ; la texture est en `ClampToEdge`, donc le gradient est
   sous-estimé sur une bande d'un texel à chaque frontière de tuile — **4 lignes
   à l'intérieur d'un bloc 3 × 3**. Je ne l'ai **pas vu** sur mes captures et je
   ne l'ai **pas mesuré** ; l'ancienne loi avait le même défaut à travers les
   quads de bord.
7. ⚠️ **LE NUANCEUR DE SOMMETS PAIE LE REPÈRE MÊME DRAPEAU BAISSÉ** — quatre
   `sin`/`cos` et deux produits `mat3` par sommet, inconditionnels. Non
   chronométré. Les mettre sous une garde d'uniforme coûterait une branche par
   sommet ; je ne l'ai pas fait.
8. ⚠️ **LA BRANCHE DÉGÉNÉRÉE EST INATTEIGNABLE DEPUIS LE NUANCEUR** (§6), gardée
   sur un argument de contrat. **C'est un jugement.**
9. ⚠️ **`params.plinthColor`, LE TABLIER ET LE DRAPÉ N'ONT PAS BOUGÉ**, et le
   chiffre `×4,37 → ×3,25` du tablier que mon relevé semble montrer **n'est PAS
   un progrès** : c'est le SOCLE qui rend 326 px là où le noteur en compte 241,
   et le socle n'est pas touché par cette tâche. **Bruit de banc, ne pas le
   compter.**
10. ⚠️ **PAS DE COMPOSITEUR**, comme tout le chantier : mes images ne sont pas
    exactement celles qu'Adrien voit.

---

## 10. ⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Le noteur écrivait : *« mais pour la première fois il faut regarder de près pour
le dire »*. **Rien de ce que je livre ne change cette phrase**, et ce qui sépare
encore les deux images est ce qu'il a listé : **le crop est brun-rosé là où le
socle est olive** (rosé ×2,54, olive ×3,51 — inchangé, mesuré :
`teintes12[11]` = 4 326 contre 1 644), **son terrain pend par-dessus la paroi**,
**sa mer porte un pavage rectangulaire et une frange en escalier** — que j'ai
**légèrement aggravée** —, et **sa paroi n'a pas de chanfrein**.

**Ce que cette tâche change, et rien d'autre : le bloc ne grouillera plus quand
la caméra glisse.** C'était le poste n° 1 de la liste ordonnée, et c'était la
seule RÉGRESSION en mouvement d'un gain au repos.
