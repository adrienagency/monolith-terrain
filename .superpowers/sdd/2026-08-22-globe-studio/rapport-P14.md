# RAPPORT P14 — les traînées de jupe fermées, et deux des trois « rattrapables » réfutés par la mesure

**Statut : DONE_WITH_CONCERNS.**
**Branche `regroupement`, `C:\Dev\wt-merge`, départ `536f7a6`, livré `17ddd41`**
(+ ce rapport). **Arbre propre** (`git status --porcelain` vide hors `.banc/`,
qui est dans `.gitignore:44`).

**Une ligne de test : `npm test` → 4 115 tests, 0 échec** (4 105 au départ,
**+10**) · **`audit:tests` 211 / 211, aucun écart** · **`node --check`** sur les
quatre fichiers touchés · **page chargée drapeau LEVÉ** (cinq exécutions du
pilote, `refus: []`, mer et parois posées à chaque fois) **ET BAISSÉ**
(`.banc/P14/run-production.log`, §8).

> ⚡ **CE QUE JE LIVRE ET CE QUE JE NE LIVRE PAS.**
> **Le poste ① (les 23 traînées) est fermé** : **23 → 9** au banc du noteur
> rejoué sans une ligne modifiée, colonnes **68 → 13**, résidu **0,961 → 0,604**.
> ⛔ **Les postes ② et ③ ne sont PAS « faibles », et je le prouve en les
> mesurant** : le +12,58 % d'énergie **n'est pas la rampe de P11** (les deux
> rampes ne diffèrent que de **2,4 %** d'amplitude, pas de ×3,12), et les −4 %
> de luminance **sont le SPÉCULAIRE DU SOCLE**, que j'isole pour la première
> fois du chantier — **c'est-à-dire le poste 4️⃣ du noteur, celui qu'il classe
> hors de proportion.** ⚠️ **Un état à 8,3 / 10 n'est donc PAS atteignable sans
> rien rebrancher ; ce qui l'était valait environ trois quarts de point, et je
> l'ai pris.**

---

## 0. LE PROTOCOLE, ET CE QUI LE PROUVE

**Tout est rendu dans la MÊME page, à la MÊME seconde, socle rallumé**
(`main.js:4544`), **cible à profondeur**, **sans compositeur**, **boucle rAF
gelée**, **octet linéaire déclaré** (`N02.lookLineaire` : `clamp[0,1]` du tampon
linéaire × 255, sans exposition, sans ACES, sans transfert sRVB).

⚡ **JE N'AI RÉÉCRIT AUCUN BANC.** `n1`, `n2`, `n3`, `n5` de
`.banc/vues-notation-03/`, `v2-trainees-avant-apres.js` et `v3-frange-avant-apres.js`
de `.banc/vues-notation-05/`, `p1-chanfrein.js` et `p4-trainees.js` de
`.banc/P13/`, le pilote de P9 : **rejoués tels quels, pas une ligne modifiée.**
Seul le récepteur change (`recois-P14.mjs`, même port 5613, dossier `.banc/P14/`),
comme P10, P11, N04, P12, P13 et le noteur l'ont tous fait.

**Le serveur sert bien CE worktree** : `.banc/P14/marqueur.txt` déposé sur le
disque porte `536f7a68d2fbaf050eade45768f1810dc90994d5` et il est relu identique
par `http://localhost:5503/.banc/P14/marqueur.txt`.

⚠️ **Les JSON des scripts rejoués portent les étiquettes de leurs auteurs**
(`head: 'ac58500'`, noms en `-N03` / `-P13` / `-N05`). Ce sont LEURS champs, pas
les miens. **Le HEAD réellement mesuré est `536f7a6` pour la ligne de départ et
`17ddd41` pour l'état livré.**

**Appariements obtenus, tous sous 0,03 %** : surface intérieur **−0,0138 %**
(cible 144 797, re-mesurée 144 797, deux mesures du même `k` rendant 144 777 et
144 777) · bloc entier intérieur **−0,0140 %** · bloc entier côte **−0,0256 %**
et **−0,0275 %**. **Témoin nul : 0 canal sur 4 096 000**, aux deux cadrages, et
**plancher de bruit 0 canal après 20 rendus intercalés**. `uMerTemps` vaut
**2,701 899 999 991 057 6** avant et après le relevé n1, **2,829 099 999 994 038**
au cadrage côte : la mer est immobile dans les exécutions où ça compte.

---

## 1. ⛔ LE POSTE ① — LES 23 TRAÎNÉES, ET LA ROUTE QUE DEUX NOTEURS NOMMAIENT ÉTAIT VIDE

### 1.1 La ligne de départ, reproduite au chiffre

`v2-trainees-avant-apres.js` du noteur, **rejoué sans une ligne modifiée sur
`536f7a6`** (`.banc/P14/run-base-v2.log`) :

```
{"crop":23,"socle":4,"sansJupes":10,"avantP13":7,"retourJupes":0,"retourRebati":0}
```

⚡ **Ses cinq comptes, au chiffre près.** Sa mesure est donc la mienne, et tout
ce qui suit se compare à elle.

### 1.2 ⛔ CE QUE J'AI TROUVÉ EN CHERCHANT LA TUILE FAUTIVE — ET C'EST UNE RÉFUTATION

P13 nommait la sortie, le noteur l'a reprise et l'a classée **« locale et
n'ouvre rien ; c'est par elle qu'il faut commencer »** :

> *« supprimer la jupe des tuiles que la frontière du crop TRAVERSE (leur
> service anti-fente y est couvert par le mur) »*

⛔ **CETTE ROUTE EST VIDE, ET ELLE EST MESURÉE VIDE**
(`.banc/P14/D1-jupes-qui-P14.json`, extinction par classe puis **tuile par
tuile**, retour **0 canal** à chaque essai) :

| jupes éteintes | traînées | colonnes | résidu |
|---|---|---|---|
| aucune — l'état livré `536f7a6` | **23** | 68 | 0,961 |
| ⛔ **les 14 tuiles que la frontière TRAVERSE** | ⛔ **23** | ⛔ **68** | ⛔ **0,961** |
| ⚡ **les 46 tuiles ENTIÈREMENT DEDANS** | ⚡ **10** | **14** | 0,665 |
| les 116 tuiles DEHORS | 23 | 68 | 0,961 |
| toutes | 10 | 14 | 0,665 |

**Pourquoi la route est vide** : `assietteCrop` (`main.js:4857`) tire l'emprise
du crop de `terrain.fenetreBornee.emprise`, **c'est-à-dire de la fenêtre du
socle**, donc **alignée sur la grille de tuiles par construction**. Relevé dans
ma page : `cx = 0,654 174 804 687 5`, `demi = 0,000 366 210 937 5`, ce qui tombe
**exactement** sur les tuiles z13 **5356…5361 × 4584…4589**. ⛔ **Aucune tuile
n'est traversée.** Les 14 que mon test de traversée désigne sont les **ancêtres
grossiers du quadtree** (z2, z3, z12), dont la BOÎTE contient l'emprise — ils ont
des sommets de bord à **|u| = 519** (`.banc/P14/D3-uv-bord-P14.json`).

➡️ **Ce qui raye le mur, ce sont les tuiles de BORD du crop, celles dont l'anneau
EST la frontière.** Les neuf premières contributrices, tuile par tuile, sont
`z13 x=5361 y=4585…4589` (le côté est) et `z13 x=5357…5361 y=4589` (le côté sud)
— **les deux faces visibles en vue isométrique**, pour 168, 104, 101, 80, 72, 70,
65, 53 et 49 px de mur couverts chacune.

### 1.3 ⚡ CE QUE J'AI LIVRÉ — ET LA MOITIÉ DU GAIN EST UN QUAD, PAS UNE DISTANCE

Deux fonctions pures dans `src/monde/parois-crop.js` :

- **`jupeHorsDuMur(u, v, retrait)`** — le sommet de bord tombe-t-il dans la
  **BANDE** `1 ± retrait` des coordonnées locales du crop ? ⚠️ **Une BANDE, pas
  un demi-plan** : sans la borne du dehors, les ancêtres à |u| = 519 perdraient
  toute leur jupe pour un mur à cinq cents demi-côtés de là.
- **`jupesEffacees(locaux, retrait)`** — marque, puis **DILATE D'UN CRAN** le
  long de l'anneau (cyclique).

`src/globe.js` pose `_retraitJupeCrop = chanfrein / (largeur / 2)`, **la monnaie
de `_retraitBaseCrop` et de `mer-sphere.js`**, et `_retaillerJupe` **efface** la
jupe des sommets marqués (elle se replie sur son propre sommet de bord, donc en
triangles d'aire nulle). **L'idempotence survit** : l'effacement se calcule lui
aussi depuis le sommet de BORD.

⚡ **LA DILATATION N'EST PAS UNE PRÉCAUTION : ELLE VAUT AUTANT QUE LA COUPE.**
Balayage du retrait, **dix valeurs, une seule page, retour 0 canal**
(`.banc/P14/D2-balayage-retrait-P14.json`) :

| retrait | traînées | colonnes | résidu | masque de paroi |
|---|---|---|---|---|
| `0` — le dépôt | **23** | 68 | 0,961 | 62 388 |
| `0,25·ch` … `2·ch` — **la frontière seule** | **17** | 23 | 0,641 | 62 847 |
| `3·ch` … `8·ch` — **la frontière ET son voisin** | ⚡ **9** | **13** | **0,604** | 63 038 |

**Le compte est un ESCALIER à deux marches, et les marches tombent exactement
sur les anneaux de sommets du maillage** (`1`, puis `1 − 1/72` : `segmentsTuile
= 24` sur un crop de 3 tuiles de demi-côté). La seconde marche est le **QUAD DE
TRANSITION** — celui qui joint un sommet effacé à son voisin resté entier, et qui
descend en biais **à cheval sur la face interne du mur**.
➡️ **Dilater d'un cran atteint la seconde marche SANS dépendre de la finesse du
maillage**, là où un `3 × ch` en dur ne la tiendrait qu'à `segmentsTuile = 24`.
**Après la dilatation, le balayage est un PLATEAU de `0,25·ch` à `8·ch`** : le
résultat ne dépend plus de la valeur du retrait, seulement de sa présence.

### 1.4 ⚡ LE COMPTE DE TRAÎNÉES, MESURÉ AU BANC DU NOTEUR

`v2-trainees-avant-apres.js`, **rejoué intact sur `17ddd41`**, cadrage intérieur,
socle apparié à **−0,0140 %**, témoin nul **0 canal**, retours **0 / 0** :

| état, MÊME PAGE, MÊME SECONDE | traînées | colonnes | pic max | résidu | jupes couvrant du mur |
|---|---|---|---|---|---|
| ⛔ **crop `536f7a6`** *(le départ)* | **23** | **68** | 12,51 | **0,961** | **903 px** |
| ⚡ **crop `17ddd41`** *(livré)* | ⚡ **9** | ⚡ **13** | **9,59** | ⚡ **0,604** | ⚡ **253 px** |
| crop, jupes ÉTEINTES *(le plancher)* | 10 | 14 | 9,59 | 0,665 | — |
| crop, arêtes vives *(avant P13)* | 7 | 10 | 16,25 | 0,442 | 411 px |
| **SOCLE** | **4** | **10** | 5,71 | **0,336** | — |

⚡ **TROIS CHOSES QUE CE TABLEAU DIT, ET QUE JE NE VEUX PAS QU'ON ME PRÊTE.**

1. **L'état livré passe SOUS le plancher de l'extinction totale des jupes**
   (9 / 13 / 0,604 contre 10 / 14 / 0,665). **Il n'y a plus rien à gagner du côté
   des jupes** : c'est la définition d'un poste fermé.
2. **Le pic maximal du livré (9,59) est EXACTEMENT celui de l'état sans jupes** —
   et la traînée qui le porte (`x = 998`, 5 colonnes) est présente dans les DEUX.
   **Plus aucune jupe n'est dans le maximum.** Les huit autres traînées restantes
   font **1 colonne** chacune, pic 2,0 à 3,2.
3. ⛔ **JE N'ATTEINS PAS LE COMPTE DU SOCLE, ET LE NOTEUR L'AVAIT POSÉ COMME
   PREUVE DE SORTIE** (« mon `v2` doit rendre le compte du socle, jupes
   allumées »). **Le socle est à 4 ; je suis à 9.** ⚠️ **Les 5 de plus ne sont pas
   des jupes** — ils survivent à leur extinction complète : c'est la variation
   propre du mur du crop, et elle relève du poste ④ du noteur (l'éclairage de la
   paroi), pas de celui-ci.

**Les jupes couvrent 253 px de mur contre 903** — **et contre 411 px dans l'état
d'avant P13**, donc **sous** la dette d'origine.

### 1.5 ⚠️ ET CE QUE ÇA COÛTE AU CADRAGE CÔTE — MESURÉ, DANS LA MÊME PAGE

⛔ **Je refuse de comparer mes chiffres de côte à ceux du noteur : ce sont deux
chargements**, et sa réserve n° 3 borne exactement ça. **J'ai donc fait l'A/B**
(`.banc/P14/D7-cote-avant-apres-P14.json` : on éteint `_retraitJupeCrop`, on
rappelle `_retaillerJupes()`, on remesure, on rallume ; **retour 0 canal**) :

| cadrage côte, MÊME PAGE | avec le retrait *(livré)* | sans *(le dépôt)* | socle |
|---|---|---|---|
| masque de paroi | ⚡ **84 269** | 83 356 | — |
| tuiles dans la bande du mur | ⚡ **5 904** | 7 173 | — |
| **nappe de mer dans la bande** | ⛔ **2 350** | **2 037** | — |
| **frange, part des suites de 4 px et plus** | ⛔ **10,56 %** | **10,07 %** | **6,85 %** |
| longueur maximale d'un palier | ⛔ **37** | 33 | 19 |
| `sousLeMur`, nappe **et** tuiles | **0 / 0** | 0 / 0 | — |

➡️ ⚠️ **JE DÉCLARE LE COÛT, ET JE DIS CE QUE J'EN PENSE.** Au cadrage côte, le
retrait **découvre 913 px de mur** que les jupes cachaient. Ce qui était derrière
elles — de la nappe de mer, du trait de côte — entre alors dans les compteurs :
**+313 px de nappe dans la bande, +0,49 point de frange.** ⚠️ **Rien de neuf
n'est DESSINÉ de travers** : `sousLeMur` reste à **0 / 0 langue** des deux côtés,
et les tuiles dans la bande DESCENDENT de 7 173 à 5 904. **Ce sont des compteurs
qui voient plus de vérité, pas un défaut qui apparaît.** ⚠️ **Mais je ne peux pas
le prouver au-delà de ça, et c'est ma réserve n° 2.**

---

## 2. ⛔ LE POSTE ③ — LE +12,58 % D'ÉNERGIE N'EST PAS LA RAMPE DE P11, ET JE LE MESURE

Le noteur : *« l'énergie de détail reste à +12,58 %… ce qui reste n'est plus de
la lumière, c'est la pente de rampe ×3,12 de P11 »*, classé **faible**.
⚠️ **Il m'ordonnait même de ne pas aller voir du côté de l'éclairage.**

### 2.1 ⛔ LES DEUX LOIS DE RAMPE, MESURÉES DANS LA MÊME PAGE

`.banc/P14/D4-rampe-P14.json`, cadrage intérieur, appariement **−0,0138 %** :

| | le CROP | le SOCLE |
|---|---|---|
| loi | `(h − uReliefBas) / (uLandMax − uReliefBas)` | `(y − uHeightRange.x) / (uHeightRange.y − uHeightRange.x)` |
| ancre basse | **130 m** | `uHeightRange.x = −4,945 17` u → **113,65 m** |
| ancre haute | `uLandMax = 3 026 m` | `uHeightRange.y = 7,161 09` u → **3 080,65 m** |
| **amplitude** | ⚡ **2 896 m** | ⚡ **2 967 m** |
| pivot / contraste | 0,41 / 2,2 | 0,41 / 2,2 |

*(La conversion du socle est faite avec sa propre échelle mesurée,
`unitesParM = (range.y − range.x) / (dem.maxM − dem.minM)` = **0,004 080 30**,
`dem = [100 ; 3 067] m`, `uSeaY = −5,408 91`.)*

➡️ ⛔ **LES DEUX RAMPES NE DIFFÈRENT QUE DE 2,4 % D'AMPLITUDE.** Le ×3,12 de P11
est le rapport du crop **à lui-même avant P11**, pas au socle. **Une pente 2,4 %
plus raide ne peut pas produire +12,58 % d'énergie de détail.**

### 2.2 ⛔ ET LE BALAYAGE DE L'ANCRE LE CONFIRME — NEUF VALEURS, RETOUR 0 CANAL

| `uReliefBas` | amplitude | **énergie / socle** | rosé / socle | distance de teinte |
|---|---|---|---|---|
| ⚡ **130** *(le livré)* | 2 896 m | **1,1249** | 1,424 | ⚡ **0,0157** |
| **59** *(la pente EXACTE du socle)* | 2 967 m | ⚡ **1,1181** | ⛔ **1,637** | ⛔ 0,0234 |
| −170 | 3 196 m | 1,0983 | ⛔ 2,291 | 0,0705 |
| −620 | 3 646 m | 1,1083 | ⛔ 2,444 | 0,0797 |
| −1 370 | 4 396 m | ⛔ 1,1972 | 1,328 | 0,1132 |
| −2 870 | 5 896 m | ⛔ 1,1971 | 0,534 | 0,1179 |
| +430 | 2 596 m | 1,1467 | 0,846 | 0,0940 |
| +880 | 2 146 m | 1,1566 | 0,516 | ⛔ 0,2563 |
| +1 630 | 1 396 m | **1,0964** | 0,077 | ⛔ **0,4920** |

➡️ ⛔ **AUCUNE VALEUR NE FERME LE POSTE.** Le minimum du balayage est **+9,64 %**,
et il coûte une distance de teinte **multipliée par 31** (0,0157 → 0,4920), ce qui
ferait tomber le critère ② de 9 à bien moins que 8.
➡️ ⚡ **ALIGNER EXACTEMENT LA PENTE SUR CELLE DU SOCLE (ancre 59) N'ACHÈTE QUE
0,6 POINT D'ÉNERGIE ET AGGRAVE LE ROSÉ DE 1,424 À 1,637.**
➡️ ⚡ **LA VALEUR LIVRÉE PAR P11 EST DÉJÀ L'OPTIMUM DE CE LEVIER SUR LA TEINTE** :
0,0157 est la meilleure distance des neuf.

### 2.3 ⚡ ET VOICI OÙ IL VIT — EXTINCTION APPARIÉE, LE MÊME POSTE DES DEUX CÔTÉS

`.banc/P14/D5-energie-P14.json`, **retours 0 / 0 partout** :

| ce qu'on éteint | **énergie crop / socle** |
|---|---|
| *(rien — l'état livré)* | **1,1111** |
| peigne des crêtes, **des deux côtés** | ⛔ 1,1436 *(s'éloigne)* |
| analyse, **des deux côtés** | ⛔ 1,1524 *(s'éloigne)* |
| voile aérien, **des deux côtés** | 1,1028 |
| grain de relief du crop | **1,1111** *(effet strictement nul — P9 avait raison)* |
| habillage du crop | **1,1111** *(effet strictement nul)* |
| rampe du crop | 1,0485 |
| éclairage du crop | 0,8630 |
| ⚡ **normale fine du crop** | ⚡ **0,7746** |

➡️ ⚡ **LE POSTE ③ EST LA NORMALE FINE DE P10.** L'éteindre fait passer le crop de
**+11 % à −22,5 %** — **ce n'est PAS l'unique poste dont l'extinction traverse
1,00** : « éclairage du crop éteint » le traverse aussi (**0,863**, ligne du même
tableau). Mais cet état-là est DÉGÉNÉRÉ, pas une comparaison à isopoids : couper
l'éclairage éteint la scène elle-même, et le **rosé** (même JSON) s'y effondre à
**0,003**, quasi achromatique, contre **1,384** pour la normale fine éteinte et
**1,424** pour l'état livré — l'écart d'énergie n'y mesure plus une texture, il
mesure l'absence de lumière. **La normale fine reste le seul LEVIER isolable à un
seul bouton dont l'extinction traverse 1,00 sur un état comparable** — un poste
qu'on peut couper sans éteindre la scène.
**C'est aussi le poste que le noteur porte AU CRÉDIT du crop** (+43,44 % d'apport,
crénelage en escalier fermé, **5 fois moins de pixels instables que le socle en
mouvement**), et **il n'a pas de réglage d'intensité** : `uNormaleFineOn` est un
interrupteur, pas un gain.

➡️ ⛔ **JE NE LE TOUCHE PAS, ET C'EST UNE DÉCISION, PAS UN OUBLI.** Le baisser
rendrait à `energieDetail` sa valeur de 1,00 **en rouvrant le crénelage que P10 a
fermé** et en dégradant le critère ⑥. **Ce n'est pas « un gain à baisser » ; c'est
un arbitrage entre le critère ① et le critère ⑥, et il appartient à Adrien.**

---

## 3. ⛔ LE POSTE ② — LES −4 % SONT LE SPÉCULAIRE DU SOCLE, ET JE L'ISOLE

Le noteur : *« le crop est 4,0 % trop SOMBRE — un signe neuf. P12 en donne un
suspect qu'elle refuse d'affirmer faute d'avoir isolé le spéculaire du socle dans
sa page. **Je ne l'ai pas isolé non plus.** »* P12, sa réserve : *« je n'ai pas
rendu le socle spéculaire éteint dans MA page »*. P3 le mesure à 4,0 % **sur une
sonde sphérique**, jamais sur le socle.

⚡ **C'EST LE CINQUIÈME MANQUE DE LA NOTATION 05, ET IL EST MAINTENANT MESURÉ.**
Le socle est un `MeshPhysicalMaterial` (`terrain.js:191`, relevé vivant :
`roughness = 1`, `metalness = 0`, `specularIntensity = 1`, `bumpScale = 0,33`,
carte de rugosité **présente**, carte de relief **présente**).
`.banc/P14/D6-speculaire-P14.json`, cadrage intérieur, **retours 0 / 0** :

| état du SOCLE, même page, même seconde | **écart de luminance crop − socle** | énergie | rosé / socle | canaux du témoin |
|---|---|---|---|---|
| *(l'état livré)* | ⛔ **−3,94 %** | 1,1250 | **1,421** | — |
| ⚡ **spéculaire ÉTEINT** (`specularIntensity = 0`) | ⚡ **−1,30 %** | 1,1434 | ⚡ **1,203** | **424 828** |
| micro-relief éteint (`bumpScale = 0`) | −3,99 % | 1,1478 | 1,445 | 348 542 |
| **les deux éteints** | ⚡ **−1,35 %** | 1,1655 | 1,226 | 400 133 |
| environnement éteint (`envMapIntensity = 0`) | −3,94 % | 1,1250 | 1,421 | ⛔ **0** |

➡️ ⚡ **DEUX TIERS DES −4 % SONT LE SPÉCULAIRE DU SOCLE** : l'écart passe de
**−3,94 % à −1,30 %** quand on l'éteint, sur **424 828 canaux déplacés** et un
retour exact. **Le suspect que trois rapports nomment sans le prouver est
confirmé, sur le socle lui-même.**
➡️ ⚡ **ET IL PORTE AUSSI UNE PART DU ROSÉ** : le rapport tombe de **1,421 à
1,203** quand le socle perd son spéculaire — c'est-à-dire qu'une partie de
l'« excès de rosé » du crop est en réalité **du rosé que le spéculaire du socle
lave vers le neutre**.

⛔ **CONSÉQUENCE, ET ELLE DÉPLACE LE POSTE.** Reproduire ça côté crop veut dire
**ajouter un terme spéculaire à `irradianceCrop`**, c'est-à-dire **changer le
MODÈLE d'éclairage** — exactement ce que le noteur classe **hors de proportion**
au poste 4️⃣. ➡️ **Le critère ② n'est donc PAS « faible » : c'est le poste
d'éclairage, vu par une autre grandeur.** **Le classer « un gain et un secteur de
rampe » était faux, et le balayage du §2.2 le confirme du côté de la rampe.**

⚠️ **ET UN CODE MORT TROUVÉ EN PASSANT** : `envMapIntensity = 0,15` sur le
matériau du socle **ne déplace pas un seul canal** — le matériau **n'a pas
d'`envMap`** (`aEnvMap: false`). **Onzième code mort de ce chantier.**

---

## 4. ⛔ LA DETTE DU LISERÉ DE BASE — NOMMÉE, MESURÉE, ET HORS DE MON PÉRIMÈTRE

`p1-chanfrein.js` de P13, **rejoué intact**, cadrage côte, 728 colonnes, socle
apparié à **−0,0275 %** :

| profil depuis l'arête **BASSE**, d = | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **SOCLE** | **0,7109** | ⚡ **0,9609** | 0,6908 | 0,6255 |
| CROP **livré `17ddd41`** | ⛔ **0,3683** | 0,5439 | 0,6492 | 0,6581 |
| CROP **arêtes vives** *(même seconde)* | **0,5817** | 0,5855 | 0,5900 | 0,5987 |

⚡ **Je reproduis les douze valeurs du noteur à la quatrième décimale**
(0,3702 → 0,3683 pour le crop livré, le reste au bit). ➡️ ⛔ **MON TRAVAIL NE
DÉPLACE PAS CETTE DETTE D'UN MILLIÈME** : le retrait latéral touche les jupes des
tuiles, pas la paroi.

⚠️ **ET JE RÉPONDS À LA QUESTION QU'ON ME POSE : NON, JE NE PEUX PAS LA RENDRE EN
RENTRANT LE MUR, ET LA MESURE DIT POURQUOI.** L'état **arêtes vives** — celui qui
n'a **aucun** congé — rend **0,5817** ; le congé de P13 le fait tomber à
**0,3683**. **Donc la géométrie du congé EST le levier**, et pourtant elle éloigne
au lieu de rapprocher : ⛔ **le socle ne rend pas une montée monotone, il rend un
PIC** (0,711 → **0,961** → 0,691), **et un pic est ce qu'une droite ne sait pas
faire.** `mix(sol, ciel, 0,5·ndu + 0,5)` est une droite ; l'irradiance vraie a un
genou (P12, sa réserve n° 2 : 0,807 à `ndu = −0,5`, 1,025 à 0, 1,959 à +0,9).
➡️ ⚡ **C'EST DE L'ÉCLAIRAGE, P13 AVAIT RAISON, ET C'EST HORS PÉRIMÈTRE.** Aucune
géométrie de congé ne fabriquera un pic sous une loi affine.

---

## 5. ⚠️ LE POSTE ④ (LA MOITIÉ FRANGE) — NON PRIS, ET JE DIS CE QUE J'EN SAIS

**`uCoastMask` / `uMargeCoteM` restent allumés, posés, et jamais employés pour
la frange.** Je ne l'ai pas pris : les trois postes du §1 à §3 ont pris tout mon
budget, et **deux d'entre eux se sont révélés être des réfutations, pas des
corrections** — c'est-à-dire du travail de mesure et non de code.

**Ce que j'apporte quand même à ce poste, mesuré :**

- `v3-frange-avant-apres.js` du noteur, **rejoué intact sur `17ddd41`**, A/B des
  parois dans la même page, retour **0 canal** : **livré 10,52 %, arêtes vives
  9,17 %, socle 6,56 / 6,58.** ⚡ **La preuve du noteur tient sur mon état livré :
  le mur rentré de P13 dégrade bien la frange de ~1,3 point sans toucher ni au
  champ ni au pas.** Son §8.2 est confirmé, pas seulement reproduit.
- ⚠️ **Et mon propre retrait en ajoute 0,49** (§1.5), sur des pixels qui étaient
  cachés par les jupes. **Le poste 5️⃣ du noteur s'aggrave donc légèrement dans
  l'état que je livre**, et je ne le cache pas.

---

## 6. ⚡ LE RÉSIDU EN MOUVEMENT — L'ÉTAT ATTENDU EST ATTEINT, ET JE LE PUBLIE

`n3-mouvement.js` de la notation 03, **rejoué intact**, `setViewOffset` d'un
nombre **entier** de pixels, recalage cherché de −3 à +3, masques érodés de 4 px
(**crop 134 677, socle 135 291**). **Plancher à `dx = 0` : 0,000 des DEUX côtés.
Le recalage tombe sur le décalage demandé dans les 24 cas. Retour 0 canal dans
les 24 séries.**

| cadrage intérieur, masque des tuiles | **SOCLE** | **CROP, normale fine ON** | CROP OFF | ⚡ état attendu |
|---|---|---|---|---|
| **dx = 1 px** | **0,0320** | ⚡ **0,8250** | 0,8718 | crop **≈ 0,8250** · socle **≈ 0,0286** |
| dx = 2 px | 0,0014 | **0,7923** | 0,8380 | |
| **dx = 3 px** | **0,0322** | **0,8260** | 0,8728 | |
| pixels instables à dx = 1 | ⛔ **66** | ⚡ **10** | 7 | |
| résidu maximal à dx = 1 | 72,89 | **14,29** | 13,44 | |

➡️ ⚡ **LE CROP EST À 0,8250 AU CHIFFRE ANNONCÉ.** ⚠️ **Mon socle rend 0,0320 et
non 0,0286** : c'est dans la fourchette inter-chargement du chantier (0,0286 /
0,0303 / 0,0321 sur trois notes), et c'est la réserve n° 3 du noteur.
➡️ ⚡ **AUCUNE SIGNATURE DE PARITÉ** : le micro-écart pair/impair du crop
(0,8250 · 0,7923 · 0,8260) est **exactement** celui de sa colonne OFF
(0,8718 · 0,8380 · 0,8728), donc c'est le plancher du reste du nuanceur, **pas
une signature de maillage**. **Le crop rend 6,6 fois moins de pixels instables
que le socle**, et son résidu reste **SOUS** son propre plancher sans normale
fine.
**Et sur la mer, cadrage côte** (masques érodés crop 65 384, socle 64 496) :
`dx = 1` → socle **0,0063**, crop ON **0,3860**, OFF 0,3506 ; `dx = 2` → **0,3895**,
donc **plat, donc sans parité** ; **1 pixel instable contre 4 au socle.**

⚠️ **CE QUE CETTE MESURE NE DIT PAS**, réserve reprise telle quelle des notes 03
et 04, de P12, de P13 et du noteur : c'est un **PROXY** et un **PLANCHER**. Une
translation rigide de la fenêtre de projection isole la parité des quads ; elle
ne contient **ni parallaxe, ni changement de LOD, ni houle**.

---

## 7. CE QUE J'AI VU CÔTE À CÔTE AVEC LE SOCLE

Toutes ces paires sont dans `.banc/P14/`, prises **dans la même page, à la même
seconde, socle apparié**.

1. ⚡ **`V6-CROP-interieur-AVANT-P13-N05.png` ↔ `A1-CROP-interieur-N03.png`** —
   **le mur du crop est redevenu un aplat.** À taille réelle, la chose que le
   noteur décrit comme « la seule visible sans zoom » n'y est plus : les huit
   traînées restantes font une colonne chacune, avec un pic de 2 à 3 octets sur un
   mur dont la médiane est à 46,85.
2. ⚡ **`V2-zoom-CROP-mur-AVEC-jupes-N05.png` ↔ `V3-…SANS-jupes-N05.png` ↔
   `V4-zoom-SOCLE-mur-N05.png`** (×3, même fenêtre) — **les deux premières sont
   maintenant presque indiscernables**, et c'est le sens du 9 contre 10 : éteindre
   les jupes ne change plus rien parce qu'elles ne dépassent plus.
3. ⛔ **`A1` ↔ `A2-SOCLE-interieur-apparie-N03.png`** — **la tonalité et la
   famille de couleurs sont les mêmes** (acquis de P12, et il tient : saturation
   +3,17 %, distance de teinte 0,0157), **mais le socle lit comme un objet éclairé
   et le crop comme une image peinte.** 22,33 % du modelé du crop vient de la
   lumière contre **45,46 %** au socle. **C'est le chiffre qui reste, et c'est le
   seul qui explique ce qu'on voit.**
4. ⛔ **`P5-zoom6-CROP-base-AVEC-P13.png` ↔ `P7-zoom6-SOCLE-base-P13.png`** (×6) —
   **la ligne orange du socle court, continue, le long de son arête BASSE ; celle
   du crop est pointillée et elle est en HAUT.** Inchangé, et §4 dit pourquoi.
5. ⛔ **`J1-zoom-CROP-frange-N03.png` ↔ `J2-…SOCLE-…`** — **le lagon large et
   continu du socle contre le sillon en marches et la plaque à bandes du crop.**
   Inchangé, et un peu pire (§1.5).
6. ⛔ **`D1-zoom-CROP-arete-N03.png` ↔ `D2-…SOCLE-…`** (×3) — **la courbe
   polygonale contre les aiguilles.** Intouché : la silhouette ×10,7 par axe est
   hors périmètre et personne n'a toujours chronométré son coût.

**Et les grandeurs de paroi n'ont pas bougé d'un millième**, ce qui est la preuve
que je n'ai touché QUE les jupes : p20 **18,87**, p80 **46,85**, contraste
**2,4828**, face claire **0,973**, face sombre **1,188**, contraste socle/crop
**1,221** — **les six chiffres du noteur, au quatrième chiffre.** `sousLeMur` des
tuiles : **4 px / 1 langue** au cadrage intérieur, **0 px / 0 langue** à la côte,
contre **11 px / 1 langue** au socle dans la même page.

---

## 8. LA CLÔTURE

- **`npm test` : 4 115 tests, 0 échec** (`.banc/P14/npm-test-3.log`). **+10** :
  neuf de comportement sur la borne latérale, un sur la voisine du dehors.
- **`audit:tests` : 211 listés · 211 sur disque · aucun écart.**
- **`node --check`** sur `src/globe.js`, `src/monde/parois-crop.js`,
  `test/crop-parois.test.js`, `test/globe-precision.test.js`.
- **Arbre propre**, avant et après (`.banc/` est dans `.gitignore:44`).
- **Page chargée drapeau LEVÉ** : cinq exécutions du pilote de P9, chacune exigeant
  `veilleCrop.refus = []`, mer et parois bâties, caméra arrêtée, trois relevés
  identiques à 2 s d'intervalle.
- **Page chargée drapeau BAISSÉ** (`.banc/P14/run-production.log`, page ouverte
  **sans `?terre=unique`**) : terrain **visible**, **591 361 sommets**, plinthe
  **visible**, `uCropOn = uHabOn = uEclairageOn = uNormaleFineOn = uMppFacteur = 0`,
  `uSoleilIrr = uCielIrr = uSolIrr = (0, 0, 0)`, `uReliefBas = −6 000 = −uOceanDepth`,
  `uContourOpacitySocle = 0`, `shadowMode = off`. ⚡ **Identique au relevé de
  clôture du noteur, champ pour champ. La production est intouchée.**

### La campagne de mutation — **23 / 24, et la survivante est ÉQUIVALENTE, vérifiée**

**24 mutations sémantiques, posées EN PLACE**, tests rejoués sur **huit fichiers**,
source d'origine reposée puis **`git diff --stat` vérifié VIDE entre chacune** et
à la fin (`.banc/P14/mutations-P14.mjs`, `resultat-mutations-P14.json`).
**19 des 24 visent le BRANCHEMENT** (79 %) : la bande, la dilatation, la monnaie
du retrait, les deux gardes, la lecture du sommet, la pose et la remise à nul.

⛔ **DEUX SURVIVANTES AU PREMIER TOUR, ET CHACUNE A SERVI.**

| survivante | ce qu'elle a montré |
|---|---|
| **M11** — retirer la garde `retrait > 0` de `jupesEffacees` | ⚡ **DU CODE MORT.** `jupeHorsDuMur` porte déjà son propre neutre : la garde ne changeait **rien**, et aucun test ne pouvait la distinguer. **Retirée** (`17ddd41`), et remplacée par une mutation qui, elle, mord (la marque posée sur le voisin). **Dixième code mort de ce chantier trouvé par une survivante.** |
| **M23** — lire les locaux sur le sommet de **JUPE** au lieu du **BORD** | ⚡ **ÉQUIVALENTE, ET JE L'AI VÉRIFIÉ AU LIEU DE L'AFFIRMER** (`.banc/P14/verif-M23.mjs`) : le rabattement est **radial depuis le centre de la planète**, donc il conserve la (lat, lon). Écart maximal mesuré sur l'anneau : **1,52·10⁻⁸ en (u, v)**, contre une bande de **5,71·10⁻³** — **375 000 fois plus étroit que ce qu'il faudrait pour changer une décision.** |

⚡ **ET LA MUTATION QUI M'A FAIT ÉCRIRE UN TEST** : **M19** (sauter la garde
`rPlancher > 0`) survivait tant que je n'avais pas mesuré **la tuile JUSTE DEHORS
du crop, celle qui partage sa frontière**. Elle existe (z13 5362), `tuileDansCrop`
la refuse, et **sans la garde elle perdait sa jupe au bord même du bloc, là où le
niveau de détail change**. Le test la nomme, et M19 meurt.

---

## 9. MES RÉSERVES

1. ⛔ **JE N'ATTEINS PAS LE COMPTE DU SOCLE SUR LES TRAÎNÉES** (9 contre 4), et
   le noteur en avait fait sa preuve de sortie. ⚠️ **Les 5 de plus survivent à
   l'extinction TOTALE des jupes** (le plancher est à 10) : **ce ne sont pas des
   jupes**, mais je ne les ai pas identifiés, et je ne prétends pas que le poste
   est fermé au sens où il l'entendait.
2. ⚠️ **MON RETRAIT COÛTE 0,49 POINT DE FRANGE ET 313 PX DE NAPPE DANS LA BANDE
   AU CADRAGE CÔTE** (§1.5, A/B dans la même page, retour 0 canal). **J'affirme
   que ce sont des compteurs qui voient les 913 px que les jupes cachaient**
   (`sousLeMur` reste à 0 des deux côtés, les tuiles dans la bande DESCENDENT),
   **mais je ne l'ai pas prouvé pixel par pixel.**
3. ⛔ **UN SEUL LIEU, DEUX CADRAGES.** La Réunion z12. **Et cette fois ce n'est
   pas seulement une réserve de forme** : **l'alignement de l'emprise du crop sur
   la grille de tuiles est le fait dont dépend tout mon §1.2.** Il vient de
   `assietteCrop`, donc il est structurel — **mais si la fenêtre continue 3×3 le
   rompait un jour, la frontière traverserait des tuiles et `jupeHorsDuMur`
   couperait alors les sommets d'une tuile qui vit AUSSI dehors.** Ma bande
   `1 ± retrait` limite les dégâts ; **je ne l'ai pas mesuré sur un crop non
   aligné, parce que je n'ai pas su en fabriquer un.**
4. ⚠️ **JE N'AI CHRONOMÉTRÉ AUCUN COÛT EN TEMPS DE RENDU.** Huitième rapport
   d'affilée. Mon changement ajoute deux `asin`/`atan2` par sommet de bord des
   seules tuiles du crop (~60 tuiles × 96 sommets, à chaque pose de parois), **et
   je ne l'ai pas mesuré en millisecondes.**
5. ⚠️ **MES VALEURS DE SOCLE NE SONT PAS CELLES DU NOTEUR**, et ça borne toute
   comparaison À TRAVERS les notes : énergie **16,086** / **16,288** selon
   l'exécution contre 16,073 chez lui ; rosé **1 647** / **1 650** contre 1 722 ;
   résidu de mouvement **0,0320** contre 0,0286 ; frange du socle **6,56** à
   **6,85** contre 6,62 à 6,72. ⚡ **Mes comparaisons crop ↔ socle et tous mes A/B
   sont pris dans la même page à la même seconde, et c'est la seule raison pour
   laquelle ils valent quelque chose.**
6. ⚠️ **LE +6,15 % D'ÉNERGIE D'ALBÉDO NU EST LE CHIFFRE DE P12, PAS LE MIEN.**
   Je n'ai pas rejoué `d1-palette.js` de P11. Ce qui est de moi, ce sont les deux
   amplitudes de rampe (§2.1), le balayage de l'ancre (§2.2) et l'extinction
   appariée (§2.3).
7. ⚠️ **PAS DE COMPOSITEUR**, comme toutes les notes : il s'applique
   identiquement aux deux côtés, donc il ne biaise aucun écart, **mais mes images
   ne sont pas exactement celles qu'Adrien voit.**
8. ⚠️ **LE MASQUE DE PAROI A GRANDI DE 62 388 À 63 038 PX** au cadrage intérieur
   (et de 83 356 à 84 269 à la côte) : **c'est le mur découvert**, et il change le
   dénominateur de toutes les grandeurs de paroi. **Les percentiles, eux, n'ont
   pas bougé d'un millième** (§7), ce qui dit que le mur découvert ressemble au
   mur qu'on voyait déjà.
9. ⚠️ **JE N'AI PAS MESURÉ LE COMPTE DE TRAÎNÉES AU CADRAGE CÔTE.** Le noteur n'en
   publie pas (il y mesure une couverture, pas un compte), donc je n'avais pas de
   ligne de départ à quoi le comparer.

---

## 10. ⚡ CE QUE JE CORRIGE DU CAHIER DES CHARGES, ET CE QUE JE PROPOSE ENSUITE

**Trois corrections, toutes mesurées :**

1. ⛔ **« Supprimer la jupe des tuiles que la frontière TRAVERSE » désigne
   l'ensemble vide** — l'emprise du crop est celle du socle, donc alignée sur la
   grille. **La bonne unité n'est pas la tuile, c'est le SOMMET, et il faut y
   ajouter son voisin d'anneau.**
2. ⛔ **Le +12,58 % d'énergie n'est pas la rampe ×3,12 de P11 : c'est la NORMALE
   FINE de P10**, un gain que le noteur porte lui-même au crédit du crop. **Ce
   n'est pas un poste « faible », c'est un arbitrage ① contre ⑥.**
3. ⛔ **Les −4 % de luminance et une bonne part du rosé sont le SPÉCULAIRE DU
   SOCLE** — mesuré sur le socle, pas sur une sonde. **Le critère ② rejoint donc
   le poste d'éclairage, que le noteur classe hors de proportion.**

**Ce que je prendrais ensuite, dans cet ordre :**

- **1️⃣ L'ÉCLAIRAGE DE LA PAROI** — le noteur avait raison de dire que c'est le
  meilleur effet de levier, et **mes mesures l'agrandissent** : il ferme ⑤, les
  deux arêtes de ③, **le liseré de base** (§4), **les −4 % de luminance et une
  part du rosé de ②** (§3), **et le 22,33 % contre 45,46 % de ①**. ⚡ **Cinq
  critères sur six, pas trois.**
- **2️⃣ La moitié frange de ③ par `uCoastMask`** — toujours pas prise, et ma
  livraison lui coûte 0,49 point qu'elle rachèterait.
- ⛔ **Ni la silhouette ni `CHAMP_FOND`** tant que personne n'a chronométré un
  coût de rendu et vérifié l'argument bathymétrique que la constante porte
  elle-même.

---

## 11. CE QUI RESTE SUR LE DISQUE

`.banc/P14/` — **worktree partagé, dossier à part, rien d'écrasé** :

- `recois-P14.mjs` (port 5613), `marqueur.txt`, `serveur.log`, les journaux de
  chaque exécution ;
- **mes sept scripts** : `d1-jupes-qui.js` (l'extinction tuile par tuile qui
  réfute la route de P13) · `d2-balayage-retrait.js` (l'escalier à deux marches)
  · `d3-uv-bord.js` (où tombent les sommets de bord, et les |u| = 519 des
  ancêtres) · `d4-rampe.js` (les deux lois de rampe et le balayage de l'ancre) ·
  `d5-energie.js` (l'extinction appariée qui trouve la normale fine) ·
  `d6-speculaire.js` (le spéculaire du socle isolé) · `d7-cote-avant-apres.js`
  (le coût à la côte, en A/B) ;
- `mutations-P14.mjs` + `resultat-mutations-P14.json`, et `verif-M23.mjs` qui
  prouve l'équivalence de la survivante ;
- les captures et relevés des scripts rejoués (`A1`…`A3`, `B1`…`B4`, `V1`…`V6`,
  `P1`…`P9`, `N1`…`N6`, `D7-zoom-CROP-mur-cote-P14.png`).

**Les deux paires à regarder d'abord :**

- ⚡ **`V2-zoom-CROP-mur-AVEC-jupes-N05.png` ↔ `V4-zoom-SOCLE-mur-N05.png`** —
  **le mur du crop contre l'aplat du socle, après.**
- ⛔ **`A1-CROP-interieur-N03.png` ↔ `A2-SOCLE-interieur-apparie-N03.png`** — **ce
  qui sépare encore les deux images n'est plus une rayure, c'est une lumière.**
