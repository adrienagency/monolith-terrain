# GRA — LE MÊME BLOC DOIT AVOIR LA MÊME COULEUR, QUEL QUE SOIT LE ZOOM

Arbre `C:\Dev\wt-gra`, branche `rampe-grade`. `npm test` : **4 817 · 0 échec**
(seuil du brief : ≥ 4 799). `npm run audit:tests` : **258 = 258, aucun écart**.
Serveur : `npm run dev -- --host 127.0.0.1 --port 7643`, arrêté en partant.
Pilote : ANGLE / SwiftShader (headless), relevé dans chaque banc.

---

## ⓪ LES LIGNES QUE JE TOUCHE — pour la fusion à la main

⚠️ **`wt-cib` est dans `globe.js` sur `_priorite` / `_request` / `_pump`. Aucune
de mes lignes ne s'en approche.** Mes régions, en numérotation d'APRÈS :

| fichier | lignes | ce que j'y fais |
|---|---|---|
| `src/globe.js` | **53–59** | l'import de `gradeCrop` / `gradeBlocEffectif` |
| `src/globe.js` | **5090–5108** | 4 paramètres de plus à `poserHabillage` |
| `src/globe.js` | **5355–5395** | l'arbitrage : mémorise l'entrée du socle, rappelle l'écrivain |
| `src/globe.js` | **5693–5697** | `retirerHabillage` lâche `_gradeSocle` |
| `src/globe.js` | **5887–5909** | `poserRampe` calcule `_gradeBlocM` et garde `_mesureBloc` |
| `src/globe.js` | **5984–6019** | le rappel dans `_poserUniformesRampe` + `_majGradeBloc` |
| `src/globe.js` | **6051–6055** | `retirerRampe` lâche `_gradeBlocM` |
| `src/monde/rampe-crop.js` | §② et §⑨ | l'histogramme du crop, `gradeCrop`, `gradeBlocEffectif` |
| `src/main.js` | `contexteCrop`, 4 champs | ce que le socle transmet encore |
| `src/monde/branchement-crop.js` | liste de veille, 4 entrées | pour qu'ils soient reposés |

⚠️ **`block-grid.js:1239-1242` NE M'ÉCRASE PAS, VÉRIFIÉ.** Ces lignes recopient
`uHeightContrast` / `uHeightPivot` du matériau CENTRE du socle vers les 24
dalles VOISINES du socle (`um` ← `uc`) : c'est un aller socle → socle. Le globe
n'y apparaît pas. Rien à changer.

---

## ① ⛔ CE QUE J'AI CRU PUIS RÉFUTÉ — ET LA PREMIÈRE RÉFUTATION EST CELLE DU BRIEF

### ⓵ « Le crop est toujours z13, ses ancres n'ont pas bougé d'un octet. »
### ⛔ FAUX. L'emprise du bloc QUADRUPLE tous les deux crans de zoom.

C'est la phrase de R31 §⑥, reprise mot pour mot par le brief, et **elle
confond « les uniformes n'ont pas bougé » avec « le bloc n'a pas bougé »**.
Relevé le 2026-09-04, `globe._crop.demi` et le relief que l'emprise contient
(`.banc/GRA/domaines-diag2.json`, La Réunion) :

| | z13 | z11 | z9 |
|---|---|---|---|
| `_crop.demi` (Mercator) | 0,000183 | **0,000732** | **0,002930** |
| largeur au sol | 13,7 km | 54,8 km | **219 km** |
| relief mesuré dans l'emprise | [533,7 ; 3 057,2] m | [−1 827 ; 3 005,5] | **[−4 913 ; 2 848,8]** |

➡️ **À z9 le bloc contient 4,9 km de fond océanique que le bloc z13 n'a jamais
vus.** Les uniformes `[uReliefBas ; uLandMax]`, eux, restaient à
`[539,6 ; 3 052,3]` — non parce que le bloc était le même, mais parce que
**`ancrerMesure` (`echelle-continue.js`) GÈLE un cran d'altitude déjà mesuré**
(« déjà mesuré à ce cran — il garde sa valeur »), et que les trois zooms
tombaient dans le même cran. C'est un SECOND défaut, chiffré au §⑦.

⚡ **Conséquence sur la tâche : « le même bloc à trois zooms » n'existe pas.**
Exiger la même couleur sur trois terrains différents reviendrait à exiger qu'une
carte ignore son propre relief. Ce que le brief demande vraiment est écrit dans
sa propre phrase : *« ouvrir le même lieu **DEPUIS** z13, z11 et z9 doit donner
la même image du bloc »* — une **indépendance au CHEMIN**. C'est ce que je livre,
et c'est mesuré au §③. `test/grade-bloc.test.js` ⑥a verrouille la réfutation.

### ⓶ « La direction B (convertir à l'entrée) suffit. »
### ⛔ Elle laisse 52 % de dérive. Le chiffre est au §②.

### ⓷ « Le pivot du socle, lu dans `uHeightRange`, est en mètres. »
### ⛔ Non : `uHeightRange` est en UNITÉS DE SCÈNE.

`diag-r31-domaines.mjs` calcule `pivotSocleM = heightRange[0] + pivot × amp` et
l'annonce « en mètres ». Or `amp` vaut **20,8 à z13 pour 2 513 m de relief** :
c'est la hauteur du bloc en unités de scène, pas une altitude. La colonne
« pivot socle » de R31 ne veut rien dire. Le vrai pivot du socle en mètres passe
par `dem.minM` / `dem.maxM` — et c'est LUI qui a départagé les deux directions.

### ⓸ « Le coin arrondi écarte 21 % des points du balayage. »
### ⛔ Vrai d'un coin PLEIN, faux du réglage par défaut : 4 points sur 16 384.

Je l'avais écrit dans la docstring de `histogrammeDesHauteurs` comme si c'était
le cas courant. Au réglage du socle (`coin = 2,24/28`, `expo = 4,4`) la
superellipse écarte **0,02 %** ; c'est au coin maximal qu'elle écarte `1 − π/4`
= 21,5 % (relevé 21,3 % au pas 64). **C'est le test qui l'a dit, pas moi** :
`grade-bloc.test.js` ②b a échoué sur mon `assert.ok(vus < n²)`. La docstring
porte maintenant les deux chiffres et le nom du test qui les exerce.

### ⓹ « L'écart d'image en pixels, pleine résolution, est le juge. »
### ⛔ Cet instrument existe, il a tourné, et il ne décide RIEN.

`scripts/diag-gra-pixels.mjs` est laissé sur le disque, avec son témoin nul
(0 pixel, l'instrument est sain). Trois passages :

| | pixels différant de plus de 2/255 |
|---|---|
| sans `params.animations = false` | **69,4 %** entre deux captures de loi IDENTIQUE |
| avec | 14 à 22 % entre chemins de loi identique |
| z13 avant vs après, La Réunion, **pivot et fenêtre égaux au dixième de mètre** | **81,0 %** |

➡️ **Un banc qui bouge de 81 % là où la grandeur mesurée ne bouge pas de zéro ne
mesure pas la grandeur.** Nuages, houle, écume, champ d'étoiles et ordre
d'arrivée des tuiles ne se rejouent pas d'une session à l'autre — c'est le piège
que le brief nomme (« le pixel n'est déterministe qu'en orbite ») et il est plus
large que ce que `animations = false` referme. **Le juge déterministe est
l'INDICE DE RAMPE**, celui-là même que R31 a identifié (« les deux régimes
lisent la MÊME table ; ce qui ne suivait pas, c'est l'indice ») :
`scripts/diag-gra-loi.mjs`, §③.

### ⓺ « `_poserUniformesRampe` peut écrire le grade, et `poserHabillage` aussi. »
### ⛔ Deux écrivains pour un uniforme — le défaut que ce site existe pour avoir supprimé.

Le grade dépend de deux sources qui n'arrivent pas ensemble (le socle, et le
domaine réévalué **par image**). Première écriture : les deux sites posaient.
Corrigé : `_majGradeBloc` est **l'écrivain unique**, les deux sites le
RAPPELLENT. `grade-bloc.test.js` ⑤c compte les écritures de `u.uHeightPivot`
dans `globe.js` et échoue à la quatrième.

---

## ② LA DIRECTION — A, ET C'EST UN CHIFFRE QUI TRANCHE

Le brief laisse le choix entre **A** (grader sur le domaine où l'on consomme) et
**B** (convertir à l'entrée). `scripts/diag-gra-domaines.mjs` a séparé les deux
causes de la dérive, ce que R31 n'avait pas fait — en exprimant le pivot du
socle **en mètres, par son propre MNT** (`dem.minM` / `dem.maxM`) :

| La Réunion | z13 | z11 | z9 |
|---|---|---|---|
| pivot **rendu** (avant) | 1 519,5 m | 1 946,7 | **2 323,6** |
| pivot du **socle**, en mètres | 1 519,2 m | **897,2** | **728,3** |

➡️ ① **désaccord de domaines** : +1 595 m à z9 (2 323,6 − 728,3) ;
➡️ ② **regradation** : −791 m (1 519,2 → 728,3), parce qu'`applyAutoShade`
regrade sur un MNT qui couvre 219 km au lieu de 13,7.

⛔ **La direction B supprime ① et laisse ② : 791 m de dérive à La Réunion
(52 %), 1 693 m à l'Everest (28 %), contre les ≤ 2 % demandés.** Aucune
conversion ne peut l'atteindre, parce que **le grade du socle décrit un autre
relief**. C'est le chiffre qui tranche : **direction A**.

⚡ **Et A n'est pas une invention : R28 l'a déjà faite pour le MONDE.**
`GRADE_MONDE` (`rampe-crop.js`) grade `[−6 000 ; 5 600]` — le domaine que le
nuanceur consomme — avec la MÊME fonction `gradeForDem`, sous le titre
« l'échelle compte, et s'y tromper est silencieux ». **Le crop était le seul
régime resté à emprunter le grade d'un autre relief.**

### La conversion, écrite avec son facteur

A est appliquée, mais il RESTE une conversion — celle du grade du bloc vers le
domaine vivant du nuanceur — et le brief exige qu'elle soit écrite. Elle est
dans `gradeBlocEffectif` (`rampe-crop.js` §⑨) :

    pivotM   = pivotBlocM + (pivotSocle − pivotAutoSocle) × socleAmpM
    fenêtreM = fenêtreBlocM × (contrasteAutoSocle / contrasteSocle)

    heightPivot    = (pivotM − uReliefBas) / (uLandMax − uReliefBas)
    heightContrast = (uLandMax − uReliefBas) / fenêtreM

Le facteur de contraste par rapport à la valeur du socle vaut
`ampGlobeM / socleAmpM` — relevé à La Réunion : **1,000** à z13, **0,511** à
z11, **0,315** à z9. C'est exactement le facteur qui manquait, et son absence
valait 805 m de pivot.

⚠️ **`gradeCrop` rend des MÈTRES, pas un `hNorm`, et c'est la décision qui évite
de rejouer le défaut un étage plus bas** : `majEchelleRampe` fait glisser
`[uReliefBas ; uLandMax]` **par image**. Un `hNorm` figé au moment de la mesure
serait consommé plus tard dans un domaine qui a bougé. Un mètre ne dépend
d'aucun domaine. `grade-bloc.test.js` ③c et ④c le verrouillent.

---

## ③ LE CRITÈRE — TROIS LIEUX, TROIS CHEMINS, MÊME VUE D'ARRIVÉE

`scripts/diag-gra-chemins.mjs` → `.banc/GRA/{avant,apres}/chemins.json`.
On part de Sydney (pour vider les ancres), on fait le détour par z11 ou z9, puis
**on arrive TOUJOURS sur la même vue z13**. Animations coupées, rails cachés,
heure gelée, **une seule session par colonne**.

### Le pivot rendu, en mètres

| lieu | depuis z13 | depuis z11 | depuis z9 | étendue |
|---|---|---|---|---|
| **La Réunion — avant** | 1 517,9 | **96,6** | **155,5** | **1 421 m (94 %)** |
| La Réunion — **après** | 1 517,9 | **1 517,9** | **1 517,9** | **0,0 m (0,00 %)** |
| **Everest — avant** | 6 183,4 | **4 390,1** | **2 971,9** | **3 212 m (52 %)** |
| Everest — **après** | 6 145,4 | **6 145,4** | **6 145,4** | **0,0 m (0,00 %)** |
| **Pays-Bas — avant** | 0,5 | 5,8 | 2,7 | 5,3 m |
| Pays-Bas — **après** | 1,8 | **1,8** | 2,7 | **0,9 m** |

### La fenêtre utile, en mètres

| lieu | depuis z13 | depuis z11 | depuis z9 |
|---|---|---|---|
| La Réunion — avant | 1 051,5 | **2 013,2** | **3 240,4** |
| La Réunion — **après** | 1 051,5 | **1 051,5** | **1 051,5** |
| Everest — avant | 1 902,1 | **3 177,7** | **4 146,5** |
| Everest — **après** | 2 002,2 | **2 002,2** | **2 002,2** |
| Pays-Bas — avant | 2,0 | 5,8 | 11,4 |
| Pays-Bas — **après** | 2,5 | 2,4 | 2,5 |

### Le juge déterministe : l'écart d'INDICE DE RAMPE

`scripts/diag-gra-loi.mjs` rejoue la ligne du nuanceur (plancher de pivot de R28
compris) depuis les uniformes vivants, **sur la tranche d'altitude qui existe
vraiment dans le bloc** (R31 §① : un balayage large surestime), et rend
`max |rampT_a(h) − rampT_b(h)|`. **Un texel de la table vaut 1/512 = 0,00195.**

| paire | avant | après |
|---|---|---|
| La Réunion, z13 vs depuis-z11 | **0,945 — 484 texels** | **0,00000 — 0 texel** |
| La Réunion, z13 vs depuis-z9 | 0,758 — 388 texels | **0,00000 — 0** |
| Everest, z13 vs depuis-z11 | 0,765 — 392 texels | **0,00000 — 0** |
| Everest, z13 vs depuis-z9 | **1,000 — 512 texels (LA RAMPE ENTIÈRE)** | **0,00000 — 0** |
| Pays-Bas, z13 vs depuis-z11 | 1,000 — 512 texels | 0,027 — 13,7 texels |
| Pays-Bas, z13 vs depuis-z9 | 0,610 — 313 texels | 0,371 — 190 texels |

➡️ **Sur les deux lieux de relief, l'indice est identique au chemin près, à
ZÉRO texel — pas « sous le seuil », zéro.** Le résidu des Pays-Bas n'est pas le
grade : c'est le domaine gelé du §⑦, chiffré et laissé ouvert.

---

## ④ z13 — CE QUI A BOUGÉ, ET DE COMBIEN

⛔ **Je ne peux pas écrire « identique au bit », et je préfère le chiffre.**

| lieu, vue z13 directe | pivot avant | pivot après | écart |
|---|---|---|---|
| **La Réunion** | 1 517,9 m | 1 517,9 m | **0,0 m — 0,00 %** |
| Everest | 6 183,4 m | 6 145,4 m | **38,0 m — 0,61 %** |
| Pays-Bas | 0,5 m | 1,8 m | 1,3 m (sur un bloc de 24 m) |

| fenêtre utile | avant | après | écart |
|---|---|---|---|
| La Réunion | 1 047,0 → 1 051,5 m | | 0,43 % |
| Everest | 1 902,1 → 2 002,2 m | | 5,3 % |
| Pays-Bas | 1,8 → 2,5 m | | 0,7 m |

**Pourquoi ça bouge, et pourquoi le nouveau z13 est le plus juste.** Le grade est
désormais lu sur **le relief du BLOC** — 16 380 points sur la superellipse, ceux
qui sont réellement dessinés — au lieu du **MNT chargé**, la boîte entière, coins
compris. `mesurerRelief` fait déjà exactement cet argument pour les extrema :
*« un pic qui tombe dans un coin arrondi du crop n'est pas dessiné : le compter
dans l'amplitude étirerait la rampe sur un relief invisible »*. Le pivot ne
pouvait pas y échapper. **À La Réunion les deux jeux coïncident et l'écart est
nul ; à l'Everest ils diffèrent de 0,61 % du pivot, soit 1,0 % du domaine.**
C'est **sous le seuil de 2 % que le brief pose lui-même** pour l'invariance.

**Les captures avant/après pour Adrien** — mêmes lieux, mêmes vues, animations
coupées et rails cachés :

    .banc/GRA/avant/vues/{reunion,everest,paysbas}-z{13,11,9}.png
    .banc/GRA/apres/vues/{reunion,everest,paysbas}-z{13,11,9}.png

et, pour l'invariance de chemin :

    .banc/GRA/{avant,apres}/{reunion,everest,paysbas}-depuis-z{13,11,9}.png

⚠️ **Ces captures se REGARDENT, elles ne se comparent pas pixel à pixel** —
§①⓹ dit pourquoi.

---

## ⑤ LE CURSEUR « OMBRAGE » — SON SENS EST INTACT, LA COURBE EST TRACÉE

`scripts/diag-gra-curseur.mjs` traîne « Pivot d'altitude » de 0 à 1 par pas de
0,05, **exactement comme `create-panel.js` le fait** (`params[key] = v ;
u()[uni].value = v`), et relève le pivot RENDU sur le bloc à z13.

**La Réunion, z13 — pivot rendu, en mètres :**

| curseur | 0,00 | 0,20 | 0,40 | 0,60 | 0,80 | 1,00 |
|---|---|---|---|---|---|---|
| **avant** | 590 | 1 042 | 1 545 | 2 047 | 2 550 | 3 052 |
| **après** | 590 | 1 035 | 1 543 | 2 051 | 2 559 | 3 067 |
| écart | 0 | 7 | 2 | 4 | 9 | 15 |

**L'Everest, z13 :**

| curseur | 0,00 | 0,20 | 0,40 | 0,60 | 0,80 | 1,00 |
|---|---|---|---|---|---|---|
| **avant** | 5 004 | 5 689 | 6 450 | 7 211 | 7 971 | 8 732 |
| **après** | 5 004 | 5 644 | 6 415 | 7 186 | 7 957 | 8 728 |

➡️ **Même origine, même pente, même sens, monotone des deux côtés.** L'écart
maximal vaut **15 m sur 2 477 m de course (0,6 %)** à La Réunion et **64 m sur
3 728 (1,7 %)** à l'Everest.

⚠️ **UNE SEULE CHOSE CHANGE, ET IL FAUT LA DIRE : LA COURSE DE LA TIRETTE SUIT
DÉSORMAIS L'AMPLITUDE DU SOCLE, PAS CELLE DU BLOC.** Aux Pays-Bas — le seul des
trois où les deux diffèrent vraiment, le bloc faisant 24 m et le MNT 36 — la
tirette poussée à fond monte le pivot à **32 m au lieu de 20**. C'est la
définition que le curseur a toujours eue **sur le socle** (« le milieu de la
rampe à x % du relief chargé »), désormais tenue à l'identique sur le bloc ; à La
Réunion et à l'Everest l'effet est de 1,0 % et 1,3 %. `grade-bloc.test.js` ④d
et ④e verrouillent le sens (mêmes mètres que le socle) et la monotonie.

⚠️ **`applyAutoShade` ne se contredit plus entre zooms**, et pas parce qu'on l'a
figé : il continue de grader **le socle** sur le MNT chargé, ce qui est juste —
à z9 le socle montre vraiment 219 km. Ce qui a changé, c'est que **le bloc ne
lui emprunte plus son grade** ; il ne reprend du socle que **l'écart entre le
curseur et l'auto**, c'est-à-dire le geste d'Adrien, et rien d'autre. Curseur au
repos, cet écart vaut **exactement zéro** (`pivotSocle === pivotAutoSocle`,
`grade-bloc.test.js` ④b).

---

## ⑥ CE QUI A ÉTÉ ÉCRIT, ET POURQUOI LÀ

1. **`mesurerRelief` rend maintenant une DISTRIBUTION**, pas seulement des
   extrema : un histogramme de 1 024 cases et une moyenne. Le pivot est une
   médiane et le contraste une largeur de bande — sans histogramme, le bloc ne
   peut pas se grader lui-même. Coût : un `Float32Array` de `pas²` = 16 384
   flottants (64 Ko), dans une fonction **qui ne tourne qu'à l'arrêt** et qui
   interroge déjà `hauteurSurface` 16 384 fois.
2. **`histogrammeDesHauteurs`** — jumeau de `elevationHistogram`, et il ne peut
   PAS l'appeler : le tampon est surdimensionné, et biner ses zéros compterait
   de faux points au niveau de la mer (§①⓸ pour le chiffre exact).
3. **`gradeCrop(mesure)`** → `{ pivotM, fenetreM }`, **en mètres**, par la
   fonction du dépôt `gradeForDem` — celle du curseur, pas une seconde règle.
4. **`gradeBlocEffectif(...)`** → la conversion dans le domaine vivant, avec la
   composition du curseur. Trois cas, dont **le premier est le chemin du dépôt
   au bit près** : sans grade de bloc (banc, test, `poserRampe({ echelle })`),
   les valeurs du socle passent TELLES QUELLES.
5. **`globe._majGradeBloc()`** — l'écrivain unique, rappelé par `poserHabillage`
   (le socle a parlé) et par `_poserUniformesRampe` (le domaine a bougé).
6. **`contexteCrop` transmet quatre champs de plus**, et ils sont dans la liste
   de veille : `pivotAutoSocle`, `contrasteAutoSocle` changent à chaque
   `applyAutoShade`, `socleBasM` / `socleAmpM` **à chaque zoom** — c'est
   précisément ce que la tâche répare.

---

## ⑦ ⛔ CE QUE J'AI TROUVÉ EN PASSANT ET QUE JE NE CORRIGE PAS

**`[uReliefBas ; uLandMax]` reste ANCRÉ sur le premier cran d'altitude visité.**
`ancrerMesure` (`echelle-continue.js`) refuse de réécrire un cran déjà mesuré
(« déjà mesuré à ce cran — il garde sa valeur ») et `oublierAncres` n'est appelé
qu'au changement de LIEU, jamais de zoom. Arrivée à z13 depuis z9, le domaine
consommé vaut donc :

| lieu | domaine juste (z13) | domaine gelé (venu de z9) |
|---|---|---|
| La Réunion | [533,7 ; 3 057,2] | [−4 928,1 ; 2 848,8] |
| Pays-Bas | [−3,9 ; 20,0] | **[−31,1 ; 105,4]** |

⚠️ **Mon grade y est insensible — c'est tout l'intérêt des mètres** : le pivot
rendu vaut 1 517,9 m dans les trois cas à La Réunion. **Mais le PLANCHER DE
PIVOT de R28**, lui, se calcule sur ce domaine (`natPlancherPivot((0 −
uReliefBas) / amp)`) et mord alors trop haut : aux Pays-Bas, 2,7 m au lieu de
1,8, soit **0,371 d'indice de rampe — 190 texels**. C'est le résidu du §③.

⛔ **Je ne le corrige pas ici, et je dis pourquoi** : c'est l'ÉCHELLE, pas le
GRADE ; il vit dans `echelle-continue.js` (Tâche K bis) et dans la politique
d'ancrage de R31 ; et le toucher repeindrait le bloc à toutes les altitudes, y
compris z13. **C'est une tâche à part, et elle est chiffrée ci-dessus.**
`grade-bloc.test.js` ⑥b la verrouille pour qu'elle ne se perde pas.

---

## ⑧ AUTRES RÉSERVES

- ⚠️ **Les bancs tournent sous SwiftShader** (`--enable-unsafe-swiftshader`).
  Aucune grandeur mesurée ici n'est un temps ni un pixel de GPU : ce sont des
  uniformes JS et une loi rejouée en JS. Le pilote ne les touche pas — mais les
  **captures**, elles, sont des images SwiftShader.
- ⚠️ **Aucune texture, aucun sampler, aucun uniforme GLSL ajouté.** La
  correction est entièrement côté JS : le nuanceur n'a pas changé d'un
  caractère, et `crop-naturel.test.js` ⑤d, qui EXTRAIT son expression, le
  vérifie sans avoir été modifié. Le coût GPU est donc **nul par construction**,
  et il n'y avait rien à mesurer avec `/threejs-optimisation`.
- ⚠️ **Le coût CPU ajouté est un `Float32Array` de 64 Ko et deux passes sur
  16 384 points, à l'arrêt seulement.** Non mesuré au chronomètre : le balayage
  qu'il accompagne coûte déjà 10,8 ms (`PAS_MESURE`, tableau de convergence du
  dépôt) et il est dominé par 16 384 appels à `hauteurSurface`.
- ⚠️ **Les Pays-Bas restent le lieu fragile**, et pour deux raisons cumulées :
  24 m d'amplitude, donc le moindre mètre pèse ; et le domaine gelé du §⑦, qui
  y mord le plus fort. Les écarts en POURCENTAGE y sont trompeurs — je donne les
  mètres.
- ⚠️ **`_mesureBloc` est gardé sur le globe** (7 scalaires, sans l'histogramme)
  pour que les bancs puissent distinguer « le grade dérive » de « le relief lu
  dérive ». Sans lui, le §① n'aurait pas été trouvé.
- ⚠️ **Six tables factices ont été complétées** (`crop-rampe`,
  `echelle-continue`, `maillage-tuile`, `crop-habillage`, `crop-naturel`,
  `grille-crop`). Elles empruntent `_majGradeBloc` au VRAI prototype et portent
  `uReliefBas` / `uLandMax` : **la table factice suit l'écrivain, elle ne le
  contourne pas** — un bouchon aurait laissé passer une pose qui n'écrit rien.

---

## ⑨ LES INSTRUMENTS, POUR LA SUITE

| script | ce qu'il mesure |
|---|---|
| `scripts/diag-gra-domaines.mjs` | le pivot rendu et la fenêtre utile, en mètres, à trois zooms — plancher de pivot compris ; **c'est lui qui a départagé A et B**, et il capture les vues |
| `scripts/diag-gra-chemins.mjs` | l'invariance au CHEMIN : même vue z13, atteinte depuis trois zooms, dans la même session |
| `scripts/diag-gra-loi.mjs` | **le juge** : l'écart d'indice de rampe entre deux chemins, en texels, sur la tranche réelle du bloc |
| `scripts/diag-gra-curseur.mjs` | la courbe du curseur « Ombrage », 21 crans, avant/après |
| `scripts/diag-gra-pixels.mjs` | ⛔ **l'instrument RÉFUTÉ** — laissé sur le disque avec son témoin nul et ses trois passages, pour qu'on ne le rebâtisse pas |

---

## ⑩ LES COMMITS

- **GRA étape 1** — les instruments, et le départage chiffré de A contre B.
- **GRA étape 2** — le grade du bloc : l'histogramme, les deux fonctions pures,
  l'écrivain unique.
- **GRA étape 3** — les tests, les six tables factices, `package.json`.
