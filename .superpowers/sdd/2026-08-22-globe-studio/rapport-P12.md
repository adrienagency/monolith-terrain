# Tâche P12 — L'ACCORD D'EXPOSITION, ET LE GRAIN DU FOND MARIN

**Statut : LES DEUX POSTES SONT LIVRÉS. Le n° 1 est fermé sur sa propre mesure ;
le n° 2 est ramené de −24,6 % à −15,1 %, et son reste a une cause nommée,
chiffrée et non payée.**
Commits **`e4d4ae4`**, **`16b0be7`**, **`b3f6c10`** et **`6063c5e`** sur `regroupement`
(arbre propre après commit, `.banc/` est `.gitignore`).

`npm test` — **4 082 / 4 082** (4 055 au départ, **+27**) ·
`npm run audit:tests` — **211 / 211** · `node --check` sur les quatre fichiers
de `src/` touchés, les trois fichiers de test et les six scripts du banc ·
campagne de mutation — **58 / 58**, dont **47 visant le branchement (81,0 %)**,
en **TROIS tours** · page chargée **drapeau levé ET baissé** ·
⚠️ **deux chiffres retirés de mes propres en-têtes** parce que je ne les avais
pas rendus (§7 réserve n° 13).

> ⚡ **LES DEUX CHIFFRES QU'ON M'A DEMANDÉS, EN UNE LIGNE CHACUN :**
> **le résidu en mouvement** vaut **0,8245 à `dx = 1`** et **0,8258 à `dx = 3`**,
> tous deux **sous le plancher du crop sans normale fine** (0,8713 / 0,8726),
> **10 pixels instables contre 49 au socle** ;
> **le grain du fond marin** vaut **84,91 % du socle**, contre **72,45 %** avant
> mon second commit et **75,41 %** à la notation 04.

> ⛔ **DEUX CORRECTIONS PORTÉES LE 2026-08-23, APRÈS LA RELECTURE GROUPÉE
> P8→P12 — ET AUCUNE NE TOUCHE UNE MESURE :**
> **①** le témoin de `D3-hemisphere-P12.json` annonçait « aller-retour à 0
> canal » ; **son fichier dit `retour: 933`** (§1.2). **②** le §2.3 écrivait
> « le socle n'en a aucun » sur le pavage ; **`E2-pas-mer-pavage-P12.json` dit
> `picNormalise: 0,0339`, et `F2-SOCLE-cote-apparie-N03.png` le montre.**
> ⚡ **Les deux affirmations que ces témoins portent — le ×2,18 entre les deux
> moitiés de sphère et le doublement du pavage — TIENNENT** ; c'est leur
> emballage qui était faux, et il est réécrit sur la source.
> ⚠️ **Un trou de COUVERTURE a été fermé au même tour** : le cœur de mon
> correctif (quelle bande est le ciel, laquelle est le sol) n'était gardé que
> par deux `assert.match` sur le texte source. **Cinq tests de comportement
> l'exécutent désormais** (`test/atlas-normales.test.js` ⑤a–⑤e). **Le code
> livré, lui, était juste** — voir `rapport-correction-P812.md`.

---

## 0. LE BANC, ET IL N'EST PAS RÉÉCRIT

**Celui du noteur, rejoué SANS UNE LIGNE MODIFIÉE** : `.banc/P9/pilote-P9.mjs`
(le pilote), `n1-etat-relief-palette.js`, `n2-parois-jupes.js`,
`n3-mouvement.js`, `n4-mer.js` et `n5-trait-proprete-mouvement.js` de
`.banc/vues-notation-03/`, harnais `harnais-N03.mjs` compris, **plus
`d1-palette.js` de P11**, lui aussi intact. **Seul le récepteur change**
(`.banc/P12/recois-P12.mjs`, même port 5613, autre dossier) — exactement comme
P10, P11 et le noteur l'ont fait. Cadre **1 280 × 800**, La Réunion, cadrage
intérieur **lat −21,115 · lon 55,536** et cadrage côte **lat −21,05 · lon
55,25**, z12, vue isométrique 0, **rendu dans une cible à profondeur, sans
compositeur, boucle rAF gelée, socle rallumé dans la MÊME page**.

### ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est celle du noteur, de
P7 à P11 — et je la prouve en retrouvant ses constantes : `heightContrast /
heightPivot` = **2,2 / 0,41** au cadrage intérieur et **2,5 / 0,58** au cadrage
côte, **594 434 sommets** au `terrain.mesh`, rampe et texture d'analyse **même
objet `three`**, `uContourOpacity` = **0 des deux côtés**, témoin nul à **0
canal sur 4 096 000**, `uMerTemps` **immobile** aux deux relevés du plancher.

⛔ **CE QUE JE N'AI PAS FAIT, ET IL FAUT LE LIRE AVANT MES COLONNES.** Mes trois
premiers scripts (`d1-irradiance`, `d2-sonde`, `d3-hemisphere`) ont tourné sur
son HEAD `bf03bfe`, source intouchée ; les suivants, non. **Je n'ai donc PAS
refait chez moi ses quatre chiffres-titres avant de les déplacer**, et toute
colonne « notation 04 » de ce rapport est **SON relevé, pas le mien**. Les
tâches P10 et P11 avaient reproduit les témoins du noteur au millième ; moi non,
et c'est une faiblesse de ce rapport, pas une économie.

⚡ **CE QUE J'AI, EN REVANCHE, RETROUVÉ À LA SEIZIÈME DÉCIMALE**, sur son HEAD,
dans ma page, sans le lui emprunter (`.banc/P12/D1-irradiance-P12.json` contre
`.banc/N04/D1-palette-P11.json`) :

| relevé | lui | moi |
|---|---|---|
| `uSoleilIrr` | 3,755 610 283 463 997 · 3,493 133 904 470 355 8 · 2,971 806 681 980 299 7 | ⚡ **identique** |
| `uCielIrr` | 2,837 949 368 013 761 3 · 3,085 735 120 343 507 · 3,322 438 188 689 158 5 | ⚡ **identique** |
| `uSolIrr` | 0,469 686 842 010 539 45 · 0,448 423 688 619 087 · 0,432 855 828 871 015 5 | ⚡ **identique** |
| sommets du `terrain.mesh` | 594 434 | **594 434** |
| `heightContrast / heightPivot` | 2,2 / 0,41 | **2,2 / 0,41** |
| `params.shadowMode` | `off` | **`off`** |

⚡ **ET UN SECOND APPARIEMENT, CELUI-LÀ PRIS APRÈS MES DEUX COMMITS, ET IL EST
BIT POUR BIT** : `n1` rend aussi le crop **ÉCLAIRAGE COUPÉ**, c'est-à-dire le
chemin que mon travail ne touche pas. Son relevé et le mien :

| crop, `uEclairageOn = 0` | lui *(`bf03bfe`)* | moi *(`b3f6c10`)* |
|---|---|---|
| énergie de détail | 14,066 | ⚡ **14,066** |
| luminance moyenne / écart-type | 103,783 / 51,957 | ⚡ **103,783 / 51,957** |
| saturation moyenne | 0,3672 | ⚡ **0,3672** |
| masse hors-orange | 9,45 % | ⚡ **9,45 %** |
| quatre premiers secteurs de teinte | 79 178 · 48 579 · 10 019 · 3 648 | ⚡ **identiques à l'unité** |

➡️ ⚡ **DEUX CHARGEMENTS DE PAGE, DEUX HEAD DIFFÉRENTS, ET PAS UN PIXEL D'ÉCART
SUR LE CHEMIN NON ÉCLAIRÉ.** C'est à la fois la preuve que mon banc EST le sien
et le témoin le plus fort de ce rapport : **mes deux commits ne touchent que la
lumière.**

**Ce sont ces deux appariements-là que je revendique, et rien de plus.**

---

## 1. ⚡ POSTE N° 1 — L'ACCORD D'EXPOSITION : UN SEUL DES TROIS TERMES

### 1.1 Ce que j'ai mesuré avant de toucher à quoi que ce soit

Le noteur écrivait : *« TOUT LE DÉPASSEMENT RESTANT EST DANS L'IRRADIANCE,
uniforme sur les trois canaux (×1,0848 / ×1,0818 / ×1,0842). C'est UN TERME DE
GAIN. »* ⚡ **Il a raison, et il ne dit pas LEQUEL des trois termes.**

L'irradiance du crop est `soleil · max(ndl,0) + mix(sol, ciel, 0,5·ndu + 0,5)`.
Pour la départager, il faut mesurer l'irradiance que le SOCLE reçoit **sur une
normale donnée**, ce qui ne demande ni terrain ni mer : il faut un objet dont on
CHOISIT les normales. J'ai donc posé devant la caméra un **ATLAS DE NORMALES** —
1 600 quads remplissant le cadre, chacun portant une normale constante
`(r cos φ, ny, r sin φ)`, la sphère entière balayée uniformément en `ny` et en
azimut, matériau du socle à albédo blanc (`.banc/P12/d1-irradiance.js`,
`D1-irradiance-P12.json`).

⚡ **ET L'ATLAS EST VALIDÉ TROIS FOIS, SUR DES GRANDEURS QUE JE N'AI PAS
CHOISIES :**

| témoin | attendu | mesuré |
|---|---|---|
| terme de soleil, contre la formule analytique | l'égalité | ⚡ **×1,0003** |
| terme d'hémisphère, contre `hemi.color × intensité` | l'égalité | ⚡ **(0,1231 · 0,2363 · 0,3468)** contre **(0,12314 · 0,23639 · 0,34697)** |
| albédo NOIR, tout allumé | 0 partout | ⚡ **0,000000** |
| somme des trois termes contre le rendu tout-allumé | l'égalité | **0,085 %** |
| aller-retour de tout l'état, image du crop | 0 canal | **0** |

**Et le verdict, sur les 1 600 normales :**

| terme | formule du crop | mesure du socle | rapport |
|---|---|---|---|
| soleil directionnel | 0,9388 | 0,9385 | ⚡ **×1,0003** |
| lampe hémisphérique | 0,1231 | 0,1231 | ⚡ **exact** |
| **environnement** | **1,5307** | **1,1985** | ⛔ **×1,2772** |

➡️ ⚡ **LES DEUX LAMPES SONT JUSTES. TOUT LE DÉPASSEMENT VIT DANS
L'ENVIRONNEMENT, ET IL Y VAUT +27,7 %.** Et c'est cohérent avec le fait que le
noteur trouve l'écart uniforme sur les trois canaux : **l'environnement de ce
studio est rigoureusement neutre** (irradiance mesurée `(1,1985 · 1,1985 ·
1,1985)`), donc toute erreur sur lui est neutre par construction.

### 1.2 ⛔ LA CAUSE : LA SONDE NE VOYAIT QU'UNE MOITIÉ DE SPHÈRE

`coefAmbiante` (`src/sonde-ambiante.js`, Tâche P3) posait une **BILLE** regardée
de côté par une caméra **orthographique**, et régressait l'irradiance sur la
coordonnée d'écran `sy`. Son argument est juste — pour une sphère unité vue
ainsi, `N·haut` **est** `sy`. ⛔ **Mais il ne dit rien du reste : les normales
visibles sont toutes celles du demi-espace `Nz > 0`, pondérées par l'aire
d'ÉCRAN.**

⚡ **ET L'ENVIRONNEMENT N'EST PAS INVARIANT PAR ROTATION AUTOUR DE LA VERTICALE
— MESURÉ, PAS SUPPOSÉ** (`.banc/P12/d3-hemisphere.js`, `D3-hemisphere-P12.json`) :

> ⛔ **CORRECTION DU 2026-08-23 — CETTE PARENTHÈSE ANNONÇAIT « aller-retour à 0
> canal, témoin nul à 0 ». LE FICHIER DIT AUTRE CHOSE, ET C'EST LE CHIFFRE DU
> FICHIER QUI FAIT FOI.** `D3-hemisphere-P12.json` porte **`temoinNul: 0`** —
> celui-là est exact — et **`retour: 933`**. **933 canaux sur 4 096 000**
> (1 280 × 800 × 4), soit **0,023 % du cadre** ; `retour` et `temoinNul` sont
> calculés par la MÊME expression (`ecart(Iref, imgCrop())`,
> `d3-hemisphere.js:37/40/180`), ils sont donc directement comparables et je ne
> pouvais pas publier 0 pour l'un en lisant 933 dans l'autre.
> ⚠️ **À QUOI IL SE COMPARE, ET POURQUOI IL NE MENACE RIEN** : ma propre
> réserve n° 9 déclare la bande **862 à 9 503 canaux** pour les aller-retours
> qui contiennent un `await` — `d3-hemisphere.js` en contient un
> (`await import('/src/sonde-ambiante.js')`, ligne 42) — contre **0** pour ceux
> qui n'en contiennent pas. **933 est le bas de ma propre bande de bruit**, et
> il est **sans commune mesure** avec ce que ce fichier porte : 146,1 %
> d'amplitude d'azimut et **×2,18** entre les deux moitiés de sphère. Le
> `retour` de `d1-irradiance.js`, lui, vaut bien **0** (`retour: {canaux: 0}`) :
> c'est de là que la formule « 0 canal » a été recopiée à tort.
> ➡️ **La mesure tient ; c'était le témoin de propreté qui était mal rapporté,
> et c'est exactement le témoin que porte l'affirmation la plus lourde de cette
> tâche.** *(Relecture groupée P8→P12, constat C-1.)*


| `ndu` | irradiance moyenne | min selon l'azimut | max | **amplitude** |
|---|---|---|---|---|
| −0,5 | 0,8074 | 0,6792 | 1,1167 | 54,2 % |
| **+0,3** | **1,3154** | **0,7225** | **2,6446** | ⛔ **146,1 %** |
| +0,9 | 1,9587 | 1,3744 | 2,7780 | 71,7 % |

**Les deux moitiés de sphère rendent donc deux droites différentes**, et je les
ai calculées **avec l'algèbre de la sonde, sur la même grille** :

| régression | ciel | sol |
|---|---|---|
| demi-sphère AVANT (celle que la sonde voyait) | **6,827** | 1,048 |
| demi-sphère ARRIÈRE | ⛔ **3,133** | 1,255 |
| *(la sonde livrée, rappelée dans la page)* | *6,683* | *1,045* |

➡️ ⚡ **×2,18 SUR LE TERME DE CIEL SELON LE CÔTÉ D'OÙ ON REGARDE.** La sonde
livrée retombe à **2,2 %** de la moitié qu'elle voyait : **son rendu était juste,
son ÉCHANTILLONNAGE était faux.**

⚠️ **ET J'AI D'ABORD ÉCARTÉ L'AUTRE HYPOTHÈSE, CELLE DU BRANCHEMENT PÉRIMÉ**
(`.banc/P12/d2-sonde.js`) : la sonde **rappelée dans la page vivante** rend
`ciel = 6,682 655 160 527 412`, `sol = 1,045 155 476 580 222 2`, et les
uniformes en portent **exactement** la même chose une fois l'hémisphère
retranché — **écart nul aux quinze décimales**. Le branchement était fidèle ;
c'est le nombre qui était faux.

### 1.3 ⚠️ ET LA SECONDE FAUTE EST UNE FAUTE DE MONNAIE — LA CINQUIÈME

**`ciel` et `sol` ne sont pas les coefficients d'un ajustement : ce sont deux
IRRADIANCES AUX PÔLES.** L'appelant les ADDITIONNE à `hemi.color` et
`hemi.groundColor` (`globe.js`, `poserEclairage`), et le nuanceur évalue
`mix(sol, ciel, 0,5·ndu + 0,5)` — la loi de `getHemisphereLightIrradiance` de
three, où `skyColor` est **par définition** l'irradiance à `ndu = +1`. Y verser
l'extrapolation d'une droite des moindres carrés met une valeur juste dans la
mauvaise monnaie.

⚡ **ET CE N'EST PAS UN ARGUMENT DE STYLE : LES TROIS LECTURES POSSIBLES
DONNENT TROIS RÉSULTATS, ET LA MESURE TRANCHE.** Irradiance totale du crop
contre celle du socle, **sur les normales du relief** (`ndu ≥ 0,7`, là où vit la
surface) :

| ce qu'on verse dans `ciel` / `sol` | rapport crop / socle |
|---|---|
| la droite des moindres carrés d'une DEMI-sphère *(l'état livré par P3)* | ⛔ **×1,1429** — **rendu** |
| ⚡ **les deux PÔLES** *(ce que je livre)* | ⚡ **×0,9954** — **rendu** |
| la droite des moindres carrés de la sphère ENTIÈRE | **×0,9618** — ⚠️ **calculée**, pas rendue |

⚠️ **LES DEUX PREMIÈRES LIGNES SONT DES RENDUS, LA TROISIÈME EST UN CALCUL, ET
JE NE LES MÉLANGE PAS.** Les deux premières sont l'atlas rendu dans la page,
avant et après le correctif, à `specularIntensity = 0` des deux côtés — donc sur
l'irradiance PURE, la seule colonne mesurée deux fois. La troisième évalue la
formule du crop — une fonction analytique connue — avec les coefficients de la
régression sphérique, contre la MÊME irradiance mesurée : **je n'ai jamais posé
cette variante-là dans la page.**

⚡ **Et sur le DIFFUS RÉEL du socle** (`specularIntensity = 1` moins le rendu à
albédo noir — ce que le relief reçoit vraiment, facteur d'énergie de three
compris), l'état livré rend **×1,0035**.

**Les pôles ne sont pas le choix commode : c'est le seul des trois qui retombe
sur le socle.**

### 1.4 Ce qui est livré

**`src/monde/atlas-normales.js`** — module **PUR** (ni DOM, ni three, ni fetch),
vérifiable sous node : la géométrie des faces, les plages de lecture et la
réduction `E = π · (blanc − noir)`. **`src/sonde-ambiante.js`** rend **deux
faces, deux normales** — `(0, +1, 0)` et `(0, −1, 0)` — et lit chacune sur sa
bande. Il n'y a plus d'échantillonnage à biaiser.

⚡ **ET LES DEUX CONVERSIONS SONT APPARIÉES PAR UN INVARIANT**, la parade que
P10 a posée pour la monnaie du gradient : `facesAtlas` dit **où** chaque normale
est dessinée, `bandesLecture` dit **où** on la lit, et rien ne les tenait
ensemble. `test/atlas-normales.test.js` ②b l'écrit une fois : **le centre de
chaque ligne lue doit tomber STRICTEMENT à l'intérieur de la face de sa bande**,
et il le vérifie sur cinq tailles de tampon. ⚠️ **C'est cet invariant qui a
attrapé une faute de monnaie de ma part** : ma première marge était un nombre de
LIGNES en dur, juste à `COTE = 64` et faux à 256, où la couture fait 6,4 lignes.

⚡ **ET LA SONDE PUBLIE SON PROPRE TÉMOIN.** Tous les pixels d'une bande portent
la MÊME normale, donc le même nombre : `dispersion` vaut **0** sur les DEUX
textures dans la page vivante (relief et paroi). Un écart non nul dirait qu'un
pixel de couture, de bord ou de fond est entré dans la moyenne.

⚠️ **ET LE SPÉCULAIRE N'EST PAS COUPÉ SUR LA SONDE, DÉLIBÉRÉMENT.** three
atténue le diffus INDIRECT par `1 − max(totalScattering)` — **mesuré 0,991 dans
la page** (`D4-verif-irradiance-P12.json`, irradiance pure contre diffus réel).
Ce facteur, le relief du socle le subit ; la soustraction blanc − noir le
retient. Poser `specularIntensity = 0` aurait rendu l'irradiance « pure » et le
crop serait ressorti presque 1 % trop clair.

### 1.5 ⚡ CE QUE ÇA VAUT, AU PROTOCOLE DU NOTEUR

Masques appariés, socle rallumé dans la même page, même seconde :

| | notation 04 | **P12** | socle |
|---|---|---|---|
| **irradiance sur `ndu ≥ 0,7`** *(atlas ; pure / diffus réel)* | ⛔ **×1,1429** | ⚡ **×0,9954 / ×1,0035** | — |
| moyenne RGB, crop / socle | ⛔ **+8,48 / +8,18 / +8,42 %** | **−3,44 / −3,71 / −4,34 %** | — |
| **saturation moyenne** | ⛔ **+15,75 %** | ⚡ **+3,07 %** | 0,2019 |
| écart-type de luminance | ⛔ **+15,41 %** | **+8,11 %** | 51,728 |
| énergie de détail | ⛔ **+16,32 %** | **+12,47 %** | 16,101 |
| masse hors-orange | ⛔ **+16,43 %** | **+9,2 %** | 11,05 % |
| pixels quasi neutres | 24,19 % *(socle 25,00)* | **26,24 %** | **25,19 %** |
| **distance de variation totale des teintes** | **0,0289** | ⚡ **0,0160** | — |
| secteurs de teinte vides | 2 / 3 | **2 / 3** | — |

⚡ **ET L'ALBÉDO NU NE BOUGE PAS D'UN CENTIÈME** — c'est le témoin qui prouve
que je n'ai touché QUE l'irradiance. `d1-palette.js` de P11 rejoué tel quel,
irradiance neutralisée à π des deux côtés, aller-retour **0 canal des deux
côtés**, témoins à **522 449** et **598 461** canaux :

| albédo SEUL | avant *(son relevé)* | après *(le mien)* |
|---|---|---|
| énergie de détail du crop | 8,164 | **8,166** |
| saturation moyenne du crop | 0,1824 | **0,1834** |
| moyenne RGB du crop | 106,363 / 91,837 / 78,574 | **106,431 / 91,876 / 78,588** |

⚠️ **CETTE PAIRE-LÀ EST INTER-CHARGEMENT, DONC ELLE VAUT MOINS QUE L'AUTRE**
(réserve n° 9 du noteur : les valeurs absolues de couleur ne se comparent pas
d'une note à l'autre). ⚡ **Le témoin qui vaut vraiment est celui du §0** : le
crop **éclairage coupé** rend les mêmes six grandeurs **au chiffre près** chez
lui et chez moi. Les deux disent la même chose ; seul le second le prouve.

⚠️ **CE QUE ÇA NE FERME PAS, ET LE NOTEUR AVAIT POSÉ LES DEUX BORNES ENSEMBLE.**
Son critère de sortie était *« `energieDetail` ET `saturationSocleSurCrop`
reviennent à 1,00 ENSEMBLE »*. **La saturation y est (0,9702), l'énergie non
(1,1247).** ⛔ **Et je peux dire pourquoi, par la mesure et pas par une
hypothèse : ce qui reste n'est PAS de l'irradiance.** L'albédo nu du crop porte
déjà **+6,15 %** d'énergie de détail de plus que celui du socle (8,166 contre
7,693, mesuré au protocole de P11), et l'irradiance, elle, est maintenant juste
à **0,35 %** sur les normales du relief. **Le reste du critère ① est dans la
peinture, pas dans la lumière** — c'est-à-dire dans la pente de rampe ×3,12 de
P11, exactement là où le noteur l'avait située au §6, mais pas sous le poste où
il l'avait rangée.

⚠️ **ET LE CROP EST MAINTENANT 3,9 % TROP SOMBRE, PAS TROP CLAIR.** J'ai cherché
d'où ça vient plutôt que de le laisser passer : **le relief du socle porte un
spéculaire que le crop n'a pas**, et P3 l'a mesuré à **4,0 %** de son pixel
(`0,0089 sur 0,2237`). L'ordre de grandeur colle au signe et à l'amplitude. **Je
ne l'affirme pas comme cause unique : je n'ai pas isolé le spéculaire du socle
dans cette page, et je le dis en réserve n° 3.**

---

## 2. ⛔ POSTE N° 2 — LE GRAIN DU FOND MARIN

### 2.1 ⚡ LE PAS EST BIEN LA CAUSE, ET JE LE PROUVE EN LE BOUGEANT

Le noteur attribue la perte au **pas élargi de P10** — *« normale fine éteinte,
les deux états sont identiques (2,089 / 2,099) »*. **Il le dit sans l'avoir
bougé.** Je l'ai bougé, dans les deux sens.

`pas = max(1 / uTilePx, vProfCam × uMppFacteur / metresParUv)` : `uMppFacteur`
en est l'unique levier, et il est vivant. ⛔ **MAIS IL N'EST PAS QUE ÇA, ET
C'EST LE PIÈGE DE CE BANC** : le même `mppEcran` sert au fondu de minification
des courbes **et à l'ancrage du grain de papier**. Les courbes ne comptent pas
(`uContourOpacity = 0` des deux côtés, relevé) ; le grain, si — on multiplie
donc `uGrainParPixel` par LE MÊME facteur, de sorte que `grainP` ne bouge pas
d'un bit. **Sans cette compensation, le banc aurait mesuré le grain de papier et
l'aurait appelé « fond marin ».** Le témoin le dit : à facteur 1, l'aller-retour
rend **0 canal sur l'image ET sur le fond seul**, et les autres facteurs
déplacent **191 081 à 294 925** canaux.

**Balayage, cadrage côte et cadrage intérieur** (`.banc/P12/e1-pas-mer.js`,
`e2-pas-mer-pavage.js`, `e3-pas-relief.js`) :

| facteur du pas | ×2 | **×1 (livré P10)** | ×0,5 | ×0,25 | un texel |
|---|---|---|---|---|---|
| **grain du fond marin** *(% du socle)* | 66,5 | ⛔ **72,5** | 77,7 | 81,9 | ⚡ **85,1** |
| **frange : suites de 4 px et plus** | 14,22 % | ⛔ **13,61 %** | 12,42 % | 10,90 % | ⚡ **9,22 %** |
| **énergie du relief** *(% du socle)* | 93,4 | **112,5** | 128,6 | 140,5 | ⛔ **145,7** |
| **pavage : pic normalisé** | 0,0546 | **0,0685** | 0,0468 | 0,0767 | ⛔ **0,1345** |
| résidu à `dx = 1` | 0,8395 | 0,8244 | 0,8150 | 0,8105 | 0,8411 |

➡️ ⛔ **LE PAS EST BIEN LA CAUSE, ET UN PAS UNIQUE NE PEUT PAS SATISFAIRE LES
DEUX** : le relief veut ×1,5 (101,1 %), la mer veut zéro (85,1 %).

### 2.2 ⚡ ET L'ARGUMENT DE P10 EST UN ARGUMENT SUR LE MNT, RIEN D'AUTRE

P10 §2.4 : *« la texture de hauteur est MINIFIÉE au cadrage de la notation, une
différence centrée à un texel échantillonnerait plus fin que ce que l'écran peut
porter »*. **Vrai — pour une hauteur lue dans le MNT.**

⛔ **SOUS L'EAU, LA HAUTEUR NE VIENT PAS DU MNT.** `hauteurFond` l'ÉCRASE par le
champ cuit : **385 nœuds sur `2 × uFondPortee` demi-côtés de crop**, soit à La
Réunion z12 une maille de **213 m** — **six texels de MNT**. Ce champ-là est
**MAGNIFIÉ**, pas minifié : il n'a aucun détail sous le pixel, donc **il n'y a
rien à filtrer**, et l'empreinte ne fait que perdre de la pente.

**Livré** : la condition qui décide de la hauteur est **NOMMÉE** (`surLeFond`) et
lue par ses **deux** lecteurs — `hauteurFond` et le pas du gradient. La recopier
aurait fait « deux écritures jumelles qui divergent ».

⚡ **ET ELLE EST STABLE PAR LA COMPOSITION, CE QUI EST CE QUI PERMET DE LA
RELIRE APRÈS** : quand elle est vraie, `hauteurFond` rend `min(champ, 0)`, donc
`h ≤ 0`, donc elle reste vraie ; quand elle est fausse parce que `h > 0`,
`hauteurFond` ne touche pas `h`, donc elle reste fausse.
`test/fond-crop.test.js` ⑩a **l'EXÉCUTE** sur le bloc extrait de la source, sur
**700 combinaisons**, et vérifie que le balayage voit **les deux côtés** — un
test qui ne rencontrerait jamais « vrai » passerait aussi sur une condition
toujours fausse.

⚠️ **ET `fondMarin` EST RELEVÉ AVANT LE GRAIN, PARCE QUE LE GRAIN CHANGE LE
SIGNE.** `hauteurGrain` ajoute un bruit **SIGNÉ** : une butte de terre à un
mètre au-dessus de l'eau peut en ressortir négative, et le pas basculerait sur
la loi de la mer en pleine terre. **Cette mutation-là ne se voit sur AUCUNE
capture de la notation** (`uGrainForceM = 0` au cadrage mesuré) : elle se tue
par l'ordre **et par le compte** (§4, survivante 5g).

### 2.3 ⚡ CE QUE ÇA VAUT, ET CE QUE ÇA COÛTE

| cadrage côte, sur l'intersection des masques | notation 04 | **P12** | socle |
|---|---|---|---|
| **énergie de détail du FOND MARIN seul** | ⛔ **3,668 (75,41 %)** | ⚡ **4,123 (84,91 %)** | **4,856** |
| énergie de détail de la mer composée | 2,368 (69,61 %) | **2,444 (71,95 %)** | 3,397 |
| écart horizontal moyen | 1,852 (60,6 %) | **2,081 (68,1 %)** | 3,055 |
| **frange : longueur moyenne des paliers** | ⛔ **2,060** | ⚡ **1,837** | **1,670** |
| **frange : part des suites de 4 px et plus** | ⛔ **13,57 %** | ⚡ **9,36 %** | **6,54 %** |
| **luminance de la mer, région comparable** | ⛔ **+18,26 %** | ⚡ **+6,45 %** | — |
| luminance sur tout le masque | +29,0 % | **+16,2 %** | — |
| bleu profond | 256 | **409** | 11 219 |
| écume (L > 200, sat < 0,25) | 1 / 1 | ⛔ **12 / 0** | — |
| **pavage : pic de période** | **15 px (0,0828)** | ⛔ **11 px (0,1565)** | **19 px (0,0339)** — *corrigé, voir ci-dessous* |

⚡ **DEUX DES TROIS PLAIES DE LA MER VONT VERS LE SOCLE, ET LA DETTE VOISINE EST
PAYÉE AUX DEUX TIERS** : la frange que P10 avait aggravée de 5,9 % et que le
noteur mesurait à +22 % depuis la note 03 **revient de 13,57 % à 9,36 %** —
l'excès sur le socle passe de **7,03 points à 2,82**, soit **divisé par 2,5**.

> ⛔ **CORRECTION DU 2026-08-23 — J'AI ÉCRIT « LE SOCLE N'EN A AUCUN », ET DEUX
> DE MES PROPRES PIÈCES DISENT LE CONTRAIRE.** Je m'appuyais sur
> `N5-…-N03.json` (`periodeSocle.pic = 0`). ⛔ **Mais mon autre relevé du même
> état porte `socle.pavage = {pic: 19, picNormalise: 0,0339}`**
> (`.banc/P12/E2-pas-mer-pavage-P12.json`) — le message du commit `16b0be7`
> cite d'ailleurs ce 0,0339 ouvertement, donc rien n'était caché ; c'est la
> phrase du rapport qui sur-affirmait. ⚡ **Et ma propre capture le montre à
> l'œil** : sur `F2-SOCLE-cote-apparie-N03.png`, la mer du socle porte des
> bandes verticales franchement visibles. **La capture était plus honnête que
> la légende.**
> ➡️ **L'ABSOLU TOMBE, LE DOUBLEMENT TIENT.** Le bon énoncé est : le socle en
> porte **0,0339**, l'état d'avant **0,0828** au noteur et **0,0685** à moi sur
> le MÊME état, et ce que je livre **0,1565** — donc **×1,9 contre le chiffre
> du noteur, ×2,3 contre le mien** (c'est ce ×2,3 que ma réserve n° 4 oppose
> aux 17 % de bruit inter-chargement) **et ×4,6 contre le socle**. **Le prix
> reste déclaré, il est simplement chiffré contre un socle qui n'est pas à
> zéro.** ⚠️ **Et ma réserve n° 4 disait déjà que ce pic « saute de 11 à 19 px
> selon les exécutions » — 19 px est très exactement le pic que `e2` relève sur
> le SOCLE. Je n'avais pas fait le rapprochement.**
> ⚠️ **Et les deux instruments ne mesurent pas la même chose** : `periodeSocle`
> de `n5` et `pavage` de `e2` rendent deux pics sur deux cadrages — je n'ai pas
> refait l'appariement, donc je ne réconcilie pas 0 et 19, **je publie les
> deux et je dis lequel contredit ma phrase.** *(Relecture groupée P8→P12,
> constat I-4.)*

⛔ **ET LE PRIX EST DÉCLARÉ AVANT QU'ON ME LE TROUVE : LE PAVAGE RECTANGULAIRE
DOUBLE** (0,0828 → 0,1565 ; le socle, lui, en porte **0,0339** — *l'« aucun »
qui figurait ici est corrigé juste au-dessus*). ⚡ **Et je peux dire
pourquoi** : ce que le pas resserré rend n'est pas du relief, **c'est la FACETTE
de la bilinéaire du champ**. Le champ ne porte rien sous 213 m ; un pas fin en
révèle les arêtes de maille, un pas large les fond. **Aucun pas ne peut produire
un détail que la donnée n'a pas.**

⚠️ **LE VRAI CORRECTIF DE CE POSTE-LÀ EST DONC AILLEURS, ET IL EST CHER** : la
résolution de `CHAMP_FOND` (384). Le noteur l'a chiffré — **tripler coûte neuf
fois `remplirHauteurs`** — et je ne l'ai pas payé.

⚠️ **ET LE 100,08 % DE LA NOTE 03 N'EST PAS UN ÉTALON, JE LE DIS.** Le noteur
l'écrit lui-même au §5-④ : le bleu profond de P9 « était fabriqué par la normale
bruitée ». **Le grain que P9 rendait était en partie le scintillement que P10 a
fermé.** Viser 100 % en resserrant encore reviendrait à racheter du bruit —
c'est exactement l'échange que le brief interdit.

### 2.4 ⚡ ET LE SCINTILLEMENT NE REVIENT À AUCUN PAS

**C'est le piège nommé du brief, et il est écarté par la mesure, pas par la
promesse.** Balayage complet, cadrage intérieur, masques érodés de 4 px (crop
**135 489**, socle **135 174**), **plancher à `dx = 0` à 0,000 des deux côtés**,
**retour exact à 0 canal**, **recalage tombant sur le décalage demandé** :

| facteur du pas | ×0 | ×0,25 | ×0,5 | ×0,75 | **×1** | ×1,5 | ×2 |
|---|---|---|---|---|---|---|---|
| résidu à `dx = 1` | 0,8411 | 0,8105 | 0,8150 | 0,7927 | **0,8244** | 0,8046 | 0,8395 |
| résidu à `dx = 3` | 0,8464 | 0,8125 | 0,8178 | 0,7982 | **0,8259** | 0,8090 | 0,8413 |
| pixels instables | 7 | 8 | 8 | 9 | **10** | 11 | 8 |

➡️ ⚡ **LE RÉSIDU NE DÉPEND PAS DU PAS, ET C'EST STRUCTUREL : LA LOI DE P10 EST
INVARIANTE PAR CONSTRUCTION.** Ce n'est pas son pas qui tenait le scintillement,
c'est le fait qu'aucune dérivée d'écran n'entre plus dans la normale. **On peut
donc arbitrer la bande passante sans jamais rouvrir le poste n° 1 de la note
03** — et c'est, je crois, la chose la plus utile que cette tâche apprend au
chantier.

**L'état livré, au protocole du noteur :**

| cadrage intérieur | SOCLE | **CROP, normale fine ON** | CROP OFF | crop sans éclairage |
|---|---|---|---|---|
| **`dx = 1 px`** | 0,0303 | ⚡ **0,8245** | 0,8713 | 0,8547 |
| `dx = 2 px` | 0,0014 | **0,7920** | 0,8378 | 0,8093 |
| **`dx = 3 px`** | 0,0306 | ⚡ **0,8258** | 0,8726 | 0,8587 |
| pixels instables à `dx = 1` | **49** | ⚡ **10** | 7 | 17 |
| résidu maximal à `dx = 1` | 94,08 | **14,29** | 13,44 | 14,99 |

➡️ **Aucune signature de parité** (0,8245 · 0,7920 · 0,8258, et le micro-écart
pair/impair est celui de la colonne OFF), **le résidu reste SOUS le plancher du
crop sans normale fine**, et les pixels instables sont **cinq fois moins
nombreux qu'au socle**. **Sur la mer** (cadrage côte, masques érodés crop
65 067, socle 66 180) : `dx = 1` **0,3924** contre 0,3568 sans normale fine et
0,0071 au socle, **8 pixels instables contre 10 au socle**, `dx = 2` 0,3945 —
**plat, donc sans parité**.

⚠️ **ET LA MER MONTE UN PEU, JE NE LE CACHE PAS** : 0,3617 → 0,3924 (**+8,5 %**),
et l'écart à sa propre colonne OFF passe de 1 % à 10 %. **C'est le pas resserré,
et c'est le même signal que le grain qu'il rend.** Il reste sous le compte
d'instables du socle.

---

## 3. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

`.banc/P12/A1-CROP-interieur-N03.png` contre `A2-SOCLE-interieur-apparie-N03.png`,
**rendus à la même seconde, dans la même page, masques appariés à −0,0276 %**.
Le témoin d'avant est `.banc/N04/A1-CROP-interieur-N03.png`, pris au même
protocole par le noteur.

**Ce qui a changé, et ça se voit sans chercher :** le crop de la note 04 est
**délavé** — ses crêtes brûlent en blanc pur, ses ocres virent au crème, et
l'ensemble flotte au-dessus du socle en valeur. **Le mien tient la même
tonalité que le socle** : les blancs des crêtes gardent du gris, les ravines
olive et les plateaux ocre sont aux mêmes endroits et à la même intensité, et
les rouges chauds du cirque ne débordent plus. **C'est la première paire du
chantier où je dois regarder la silhouette et la paroi pour dire laquelle est
laquelle.**

**Ce qui sépare encore les deux images, à l'œil, sur MES captures :**

1. ⛔ **LA SILHOUETTE.** Le socle coupe son mur en **aiguilles fines, une par
   ravine** ; le crop rend une **courbe polygonale lisse**. C'est le poste n° 3
   du noteur, les 5 625 sommets contre 594 434, et je ne l'ai pas pris.
2. ⛔ **LE CHANFREIN.** Sur `J4` et `D2` (socle), un fin liseré lumineux court
   sur toute l'arête haute de la paroi. Sur `J3` et `D1`, **rien**. Inchangé
   depuis la note 01, et je ne l'ai pas pris.
3. ⛔ **LA MER.** `F1` contre `F2` : le socle a un **large lagon turquoise
   continu** qui se dégrade doucement vers un **bleu marine profond** ; le crop
   a une nappe **plus claire et plus plate**, dont le bleu profond n'occupe
   qu'un liseré, et **son large porte des bandes rectangulaires et des coutures
   verticales** — le pavage, et il est plus visible qu'avant.
4. ⚡ **MAIS LA FRANGE, ELLE, S'EST RAPPROCHÉE.** `J1` (P12) contre
   `.banc/N04/J1` : les **gros blocs rectangulaires en escalier** du trait de
   côte sont cassés en marches plus courtes, et le sillon bleu qui longe la côte
   est plus continu. `J2` (socle) reste plus fin que les deux.
5. ⛔ **AUCUNE RIVIÈRE.** Le réseau hydrographique bleu que le socle dessine sur
   son relief est toujours absent du crop.
6. ⚠️ **LES LAMES QUI PENDENT.** Sur `F1`, la nappe d'eau laisse encore pendre
   des langues sous son plan au bord gauche du bloc. `sousLeMur = 0` reste exact
   et reste incomplet, comme le noteur l'a dit.

---

## 4. LA CAMPAGNE DE MUTATION — 58 / 58, EN TROIS TOURS

`.banc/P12/mutations-P12.mjs`, worktree à part (`C:/Dev/wt-p12-mut`,
`node_modules` en jonction, `git ls-files --eol` à `i/lf w/lf` sur les six
fichiers en jeu, **110 tests verts AVANT de commencer**, arbre rendu propre
après chaque mutation, **`git status --porcelain` vide et worktree RETIRÉ en
partant**). **47 des 58 mutations visent le BRANCHEMENT — 81,0 %.**

⛔ **QUATRE ONT SURVÉCU AU PREMIER TOUR, ET CHACUNE A TROUVÉ UN VRAI TROU :**

| | ce qu'elle a trouvé | ce qui la tue maintenant |
|---|---|---|
| **1i** | ⛔ **MON TEST D'ENROULEMENT LISAIT L'ORDRE DES COINS, PAS L'INDEX** : il supposait `[0,1,2]` et `[0,2,3]`, et la mutation a retourné les deux triangles dans `idx.set(...)`. **Or c'est l'index que le GPU parcourt**, et c'est lui qui décide de `gl_FrontFacing`. | ①f parcourt `f.index` et calcule le signe sur les sommets qu'il désigne |
| **4j** | ⛔ **LES PLAGES DE LECTURE ÉTAIENT CALCULÉES DEUX FOIS** — dans `coefAmbiante` et dans `_sondeInterne`. La mutation a changé la première, et l'assertion a **retrouvé la chaîne dans la seconde**. | une seule écriture (`const BANDES`), et ④a **compte** les occurrences |
| **5g** | ⛔ **« RELEVÉ AVANT LE GRAIN » NE SE VERROUILLE PAS PAR L'ORDRE** : la mutation a **AJOUTÉ** une seconde affectation après le grain, le premier relevé était toujours là, l'ordre tenait. | ⑩d compte les affectations de `fondMarin` — il doit y en avoir **exactement une**, et **deux** occurrences du nom en tout |
| **4l** | ⚡ **CODE MORT.** Elle remettait `_atlas.frustumCulled` à `true` et **rien n'a bougé** — la sphère englobante de l'atlas contient l'origine, que le tronc de la caméra contient aussi : **l'objet n'est jamais écrêté.** | **la ligne est RETIRÉE**, et sa place prise par la garde `!renderer \|\| !envTexture`, qui n'était assertée nulle part |

⚠️ **ET LA LEÇON DU CHANTIER S'APPLIQUE À MOI DEUX FOIS.** La première :
« si une survit, cherche d'abord si le code est mort » — **4l est le onzième
code mort trouvé par une survivante sur ce chantier**, et je l'ai retiré plutôt
que de lui écrire un argument. La seconde : **trois états du renderer que la
sonde emprunte n'étaient assertés nulle part** (`autoClear`, la couleur
d'effacement, la cible). Le §0 du plan liste `autoClear === false` comme la
PREMIÈRE façon dont un banc a menti sur ce chantier, et `PasseFond` a déjà avalé
`shadowMap.needsUpdate` une fois. **Les quatre le sont maintenant.**

⚡ **ET LA SONDE, APRÈS RETRAIT DE LA LIGNE MORTE, REND LE MÊME NOMBRE À LA
QUINZIÈME DÉCIMALE** dans la page vivante (`5,011 946 666 118 892` /
`2,149 922 011 121 361 3`) : la preuve que la ligne ne portait rien.

**Chaque test tueur est vérifié EXPÉRIMENTALEMENT** : la campagne applique la
mutation, rejoue la liste de dix fichiers, remet la source, et le worktree rend
`git status --porcelain` vide à la fin.

---

## 5. LA PRODUCTION EST INTOUCHÉE, ET C'EST RELEVÉ

`.banc/P12/cloture-baisse.log` — page chargée **sans `?terre=unique`** :
`terrain.mesh` **visible**, plinthe **visible**, `real-water` et `water`
**visibles**, **`uCropOn = uHabOn = uEclairageOn = uNormaleFineOn =
uMppFacteur = 0`**, **`uSoleilIrr = uCielIrr = uSolIrr = uParoiCielIrr =
uParoiSolIrr = (0,0,0)`**, **`uReliefBas = −6 000 = −uOceanDepth`**,
30 programmes, aucune erreur de nuanceur.

`.banc/P12/cloture-leve.log` — **drapeau levé** : 245 tuiles, `refus: []`, mer et
parois posées, **`uNormaleFineOn = 1`**, **`uMppFacteur = 55,505`**, la sonde à
**dispersion 0** sur les DEUX textures (relief et paroi), 26 programmes.

⚠️ **UN AVERTISSEMENT DE COMPILATION SUBSISTE DES DEUX CÔTÉS** —
`warning X4000: use of potentially uninitialized variable (f_surfaceFx_int)`.
**Il est ANTÉRIEUR** : P9 le déclare déjà, P10 aussi. Pas le mien, pas corrigé.

---

## 6. ⚡ UN EFFET DE BORD QUE JE N'AI PAS VISÉ, ET IL EST BON

Le correctif d'irradiance touche AUSSI la paroi, qui prend son propre
environnement depuis la Tâche P8 — et **P8 avait laissé sa face sombre 12,5 %
trop claire** :

| profil de paroi, en percentiles | notation 04 | **P12** | socle |
|---|---|---|---|
| **face sombre (p20)** | ⛔ **17,87** *(×1,125)* | ⚡ **17,02** *(×1,072)* | **15,88** |
| face claire (p80) | 44,28 *(−8,0 %)* | **42,72** *(−11,3 %)* | 48,15 |
| **contraste inter-faces** | **2,478** *(socle ×1,224)* | **2,510** *(socle ×1,208)* | **3,032** |

➡️ **L'erreur sur la face sombre est divisée par 1,7**, le contraste se
rapproche d'un point et demi de pourcent — ⚠️ **et la face claire s'éloigne de
3,3 points.** **Je ne revendique pas ce poste** : c'est un effet de bord, il est
mesuré, et il va dans le bon sens sur les deux grandeurs que P8 avait nommées.

⚠️ **Et il tombe exactement où mon §1.3 annonçait le pire** : une paroi est
verticale, `ndu ≈ 0`, et c'est là que la droite des pôles s'écarte le plus de la
vérité. **La mesure a donné tort à ma prévision, et je publie la mesure.**

---

## 7. MES RÉSERVES

1. ⛔ **UN SEUL LIEU, DEUX CADRAGES.** La Réunion z12. Un crop continental, un
   crop de haute latitude, un crop à plateau peu profond ne sont pas jugés.
   ⚠️ **Et l'environnement de ce studio est NEUTRE** : c'est ce qui rend
   l'erreur de la sonde uniforme sur les trois canaux ici. **Sous un ciel HDRI
   coloré, la même faute aurait été une faute de TEINTE**, et le noteur ne
   l'aurait pas classée « terme de gain ». Mon correctif la ferme dans les deux
   cas, mais je n'ai mesuré que le cas neutre.
2. ⛔ **LE MODÈLE DU NUANCEUR RESTE UNE DROITE, ET L'IRRADIANCE VRAIE N'EN EST
   PAS UNE.** Mesurée : 0,807 à `ndu = −0,5`, 1,025 à `ndu = 0`, 1,959 à
   `ndu = +0,9` — un genou. Sur les normales du relief la droite des pôles
   retombe à **+0,08 %** ; **à `ndu = −0,5` elle dépasse encore de +26,8 %**, et
   c'est ce qui reste de mon ×1,107 sur la sphère entière. **C'est la limite de
   `mix(sol, ciel, 0,5·ndu+0,5)`, la réserve que P8 a nommée. Elle n'est pas
   fermée.**
3. ⚠️ **LES 3,9 % DE SOUS-EXPOSITION QUI RESTENT SONT ATTRIBUÉS PAR ORDRE DE
   GRANDEUR, PAS ISOLÉS.** Je les rapproche du spéculaire du socle (4,0 % chez
   P3) ; **je n'ai pas rendu le socle spéculaire éteint dans MA page**, et je ne
   l'affirme donc pas.
4. ⛔ **LE PAVAGE DOUBLE, ET C'EST UN ÉCHANGE, PAS UN PROGRÈS PARTOUT.** Deux
   grandeurs de la mer vont vers le socle (grain, frange), une s'en éloigne
   (pavage). ⚠️ **Et la mesure du pavage est bruyante** : le noteur relève
   0,0828 là où je relève 0,0685 sur le MÊME état, soit **17 % d'écart
   inter-chargement**, et son pic saute de 11 à 19 px selon les exécutions.
   **Le doublement (×2,3) est au-dessus de ce bruit ; le classement fin des
   réglages intermédiaires ne l'est pas.**
5. ⚠️ **L'ÉCUME PASSE DE 1 À 12 PIXELS** (socle 0 à 1) sur 75 095. C'est douze
   pixels, c'est mesuré, c'est dans le mauvais sens, et je ne l'ai pas expliqué.
6. ⚠️ **LA MESURE EN MOUVEMENT RESTE LE PROXY DU NOTEUR, DONC UN PLANCHER** :
   translation rigide de la fenêtre de projection, **ni parallaxe, ni changement
   de LOD, ni houle**.
7. ⚠️ **JE N'AI CHRONOMÉTRÉ AUCUN COÛT EN TEMPS DE RENDU**, pas plus que les
   notes 03 et 04, P10 et P11. La sonde tourne **une fois par texture** et rend
   deux images de 64 × 64 ; le pas du fond marin est une **ternaire de plus par
   fragment**, sans lecture supplémentaire. **Je le donne en ordre de grandeur,
   pas en millisecondes.**
8. ⛔ **LE `100,08 %` DE LA NOTE 03 N'EST PAS UN ÉTALON ATTEIGNABLE
   HONNÊTEMENT** (§2.3). Ce que je livre est **84,91 %** ; **le reste est dans
   la résolution du champ, et il coûte neuf fois `remplirHauteurs`.**
9. ⚠️ **DEUX DE MES ALLER-RETOURS D'IMAGE NE SONT PAS À ZÉRO, ET JE SAIS
   POURQUOI.** Ceux qui contiennent un `await` (import dynamique, envoi d'une
   capture) rendent **862 à 9 503 canaux** sur 4 096 000 ; ceux qui n'en
   contiennent pas rendent **0**. ⚡ **C'est le cinquième piège du chantier —
   `geler()` ne remplace que `requestAnimationFrame`, et `tick()` se réarme en
   `setTimeout` : un `await` rend la main à la boucle d'événements et la mer
   avance.** **Aucun verdict n'en dépend** : tous les aller-retours d'UNIFORME
   de ce rapport sont mesurés sans `await` entre les deux rendus, et ils rendent
   **0**.
10. ⚠️ **PAS DE COMPOSITEUR**, comme tout le chantier : mes images ne sont pas
    exactement celles qu'Adrien voit.
11. ⚠️ **MON SOCLE DE RÉFÉRENCE N'EST PAS BIT POUR BIT CELUI DE LA NOTATION
    04** — son énergie rend 16,101 contre 16,287 (**−1,1 %**), sa `dansLaBande`
    2 191 contre 2 149, et son secteur de teinte 210–240° 18 contre 692 (le
    réseau hydrographique que le noteur déclare instable). **C'est le bruit
    inter-chargement du chantier, et il borne toutes mes comparaisons À TRAVERS
    LES NOTES.** Mes comparaisons crop ↔ socle, elles, sont toutes prises dans
    la même page à la même seconde.
12. ⚠️ **L'ATLAS DE NORMALES EST UN INSTRUMENT NEUF, ET JE LE DIS.** Il pose des
    quads plats portant des normales choisies : trois témoins indépendants le
    valident (soleil ×1,0003, hémisphère exact, albédo noir à 0, somme des
    termes à 0,085 %), **mais aucune tâche avant moi ne l'a employé.**
13. ⛔ **J'AI PUBLIÉ DEUX CHIFFRES QUE JE N'AVAIS PAS RENDUS, ET JE LES AI
    RETIRÉS** (commit `6063c5e`). Les en-têtes des deux modules annonçaient
    « ×1,0006 avec les deux pôles » : c'était une **prédiction**, calculée à la
    main depuis l'atlas mesuré, jamais un rendu. Les valeurs rendues sont
    **×0,9954** (irradiance pure) et **×1,0035** (diffus réel). ⚠️ **Et la
    variante « moindres carrés de la sphère entière » (×0,9618) n'a JAMAIS été
    posée dans la page** : elle est calculée, et elle est désormais marquée
    comme telle partout où elle apparaît.
14. ⚠️ **`contourInterval` EST TOUJOURS DANS LA MAUVAISE MONNAIE** (crop 200 m,
    socle 0,29 unité), et `uContourOpacity` vaut 0 des deux côtés. Non touché.

---

## 8. ⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

**C'est la dix-huitième fois que cette phrase est écrite dans ce chantier, et
elle est encore vraie.** Ce qui a changé, c'est la nature de ce qui reste : le
crop n'est plus **une autre exposition du même terrain** — il est le **même
terrain sous une silhouette et une mer qui ne sont pas les siennes**.

Ce qui sépare encore les deux images, sur MES captures, dans l'ordre où ça
saute aux yeux : **la silhouette lisse contre les aiguilles** ; **la paroi
franche contre le liseré de chanfrein** ; **la nappe plate à pavage
rectangulaire contre le lagon continu** ; **et le relief sans une rivière**.

**Ce que cette tâche change, et rien d'autre : le bloc a la lumière du socle, et
son fond marin a repris deux tiers de ce que le pas de P10 lui avait pris.**

---

## 9. CE QUI RESTE SUR LE DISQUE

`.banc/P12/` — **36 captures PNG**, **14 relevés JSON**, le récepteur
(`recois-P12.mjs`, port 5613), le marqueur, les journaux de chaque exécution, la
campagne de mutation et son résultat, et **les six scripts que j'ajoute** :

- `d1-irradiance.js` — **l'atlas de normales**, l'irradiance du socle terme par
  terme, et les trois témoins qui la valident ;
- `d2-sonde.js` — **la sonde rappelée dans la page**, opposée à ce que les
  uniformes portent : c'est lui qui écarte l'hypothèse du branchement périmé ;
- `d3-hemisphere.js` — **les deux moitiés de sphère**, la dépendance à l'azimut,
  et la régression de la sonde rejouée sur chacune ;
- `d4-verif-irradiance.js` — la vérification après correctif, **irradiance pure
  contre diffus réel**, qui mesure le facteur d'énergie de three ;
- `e1-pas-mer.js`, `e2-pas-mer-pavage.js`, `e3-pas-relief.js` — **le balayage du
  pas**, avec le grain, le pavage, la frange, le relief et le mouvement dans la
  même balance ;
- `c1-cloture.js` — la clôture, drapeau levé et baissé.

**Les paires à regarder d'abord :**

- ⚡ **`A1-CROP-interieur-N03.png` ↔ `.banc/N04/A1-CROP-interieur-N03.png`** —
  **le même crop, avant et après l'accord d'exposition.** Les crêtes qui
  brûlaient ne brûlent plus. Si vous ne regardez qu'une paire, c'est celle-là.
- ⚡ **`A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`**
  (−0,0276 %) — **la même tonalité pour la première fois**, et la silhouette qui
  les sépare encore.
- ⚡ **`J1-zoom-CROP-frange-N03.png` ↔ `.banc/N04/J1-…`** — **l'escalier de la
  frange, cassé.** Et à côté, `J2` (socle), qui reste plus fin que les deux.
- ⛔ **`F1-CROP-cote-N03.png` ↔ `F2-SOCLE-cote-apparie-N03.png`** — **le pavage
  rectangulaire du crop, plus visible qu'avant**, contre le lagon du socle. **Le
  prix de cette tâche, en une image.**
- **`K1-zoom-CROP-frange-pas-livre.png` ↔ `K2-zoom-CROP-frange-pas-texel.png`
  ↔ `K3-zoom-SOCLE-frange.png`** — les deux pas et le socle, **même fenêtre,
  même seconde**.
- **`D1-albedo-CROP-P11.png` ↔ `D1-albedo-SOCLE-P11.png`** *(le script de P11
  rejoué)* — **les deux albédos nus, inchangés par cette tâche à 0,02 % près.**

---

## 10. ⚡ CE QUE JE CORRIGE DANS LE CAHIER DES CHARGES

Le brief dit : *« Trouve d'où vient le facteur 1,084, et branche-le. »**
⚠️ **Il n'y avait rien à brancher.** Le branchement était fidèle au bit près —
`.banc/P12/d2-sonde.js` le prouve en rappelant la sonde dans la page et en
retrouvant les uniformes à la quinzième décimale. **Ce qui était faux, c'est
l'INSTRUMENT** : une sonde qui regardait la moitié d'une sphère et appelait le
résultat une moyenne. **Le poste n'était pas un branchement absent, c'était une
mesure fausse depuis onze tâches — et c'est plus inquiétant, parce qu'un
branchement absent finit par se voir, alors qu'un nombre plausible ne se voit
jamais.**

Et le brief dit du poste n° 2 : *« la cause est PROUVÉE… c'est LE PAS ÉLARGI ».*
⚡ **La cause est confirmée — je l'ai bougée dans les deux sens — mais elle est
moins profonde que le poste.** Le pas explique 12,5 des 24,6 points perdus ; les
douze autres sont dans la **résolution du champ cuit**, et le pas ne peut les
rendre qu'en rendant les facettes de sa bilinéaire. **Le poste n° 2 et le
poste n° 4 du noteur (le pavage) ne sont pas deux postes : c'est le même, et il
s'appelle `CHAMP_FOND = 384`.**
