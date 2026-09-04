# RAMP — LA RAMPE CESSE DE SE RE-NORMALISER, ET DEVIENT UNE OPTION

Branche `rampe-fixe`, arbre `C:\Dev\wt-ramp`, serveur Vite `127.0.0.1:9341`.
`npm test` : **5 000 · 0**. `npm run audit:tests` : *aucun écart* (271 listés,
271 sur disque). **8 mutations posées, 8 tuées.**

---

## LA RÉPONSE À ADRIEN, EN FRANÇAIS SIMPLE

**C'est fait, et par défaut.** Une couleur veut maintenant dire une altitude,
la même à toutes les échelles. Quand tu descends d'un cran, la carte gagne du
détail et **ne change plus de couleur**.

La case existe pour revenir en arrière : **Terrain → Ombrage →
« Re-normaliser la teinte »**, décochée par défaut. Cochée, tu retrouves
exactement le comportement d'avant — vérifié **au bit**, sur dix crans.

Le curseur « Teinte hypsométrique » n'a pas bougé et garde son sens : à 0, plus
de couleur d'altitude du tout ; au maximum, le même effet qu'avant. Ce qu'on a
éteint, c'est la re-normalisation, pas la couleur.

---

## ① CE QUE J'AI TROUVÉ EN PLUS DE SUR — ET QUI CHANGE LE CORRECTIF

SUR a nommé la cause : `uHeightRange` est réécrit avec le min/max du bloc à
chaque cran. ⚡ **C'est vrai, et ce n'est que la moitié.** En composant les deux
lignes du nuanceur (`terrain.js:1009` puis `natRampT`), la couleur d'une
altitude `h` ne dépend pas de `uHeightRange` : elle dépend de **deux grandeurs
en mètres**, et d'elles seules —

```
rampT(h) = 0,5 + (h − pivotM) / fenetreM
  pivotM   = minM + uHeightPivot × (maxM − minM)
  fenetreM = (maxM − minM) / uHeightContrast
```

Or `applyAutoShade` **regrade** à chaque chargement (`gradeForDem` sur
`dem.minM/maxM`). **Figer `uHeightRange` seul n'aurait donc rien réparé** : le
pivot serait reparti tout seul. C'est la raison pour laquelle le correctif ne
touche PAS `uHeightRange`, et corrige les deux réglages qui le traversent.

**La mesure, Alpes suisses `46,0122 / 7,8223`, neuf crans**
(`.banc/RAMP-AVANT/crans.json`, code d'origine) :

| cran | m/texel | amplitude du MNT | **pivotM** | **fenetreM** |
|---|---|---|---|---|
| 0 | 26,54 | 3 930 m | 2 578,4 m | **1 637,5 m** |
| 3 | 13,27 | 3 505 m | 2 841,4 m | 1 593,2 m |
| 5 | 6,64 | 2 239 m | 3 037,3 m | 1 017,7 m |
| 7 | 3,32 | 1 250 m | 2 993,0 m | 657,9 m |
| 9 | 1,66 | 799 m | 2 740,7 m | **380,5 m** |

⚡ **`fenetreM` est divisée par 4,30** : les huit teintes s'étalent sur quatre
fois moins de dénivelé, donc elles saturent — c'est le « voile coloré ». Le
pivot, lui, se promène sur **458,9 m**.

---

## ② LE CRITÈRE — ET LE PIÈGE DE MESURE QUE J'AI PAYÉ

⛔ **La moyenne RGB d'une fenêtre d'écran NE MESURE PAS LA RAMPE, et j'ai
d'abord cru le contraire.** Un cran change le CADRAGE : entre le cran 0 et le
cran 9 la caméra passe de 3 744 m à 292 m d'altitude, le carré central ne montre
plus le même sol. La chroma bougeait de **32,6/255 avant** et de **32,6/255
après** — sur un correctif qui rend pourtant la loi rigoureusement constante.
J'ai failli conclure que le correctif ne servait à rien.

⚡ **Le chiffre, c'est la couleur que le nuanceur donne à une ALTITUDE.** On
rejoue sa loi sur les uniformes vivants et on lit la **vraie** table de rampe
(`uRampTex`) — même protocole que `test/crop-rampe.test.js`, qui extrait
l'expression du nuanceur plutôt que d'en réécrire une seconde.

⚠️ **Et on ne compare que les altitudes présentes à TOUS les crans.** Le
nuanceur écrête `hNorm` à [0 ; 1] : demander la couleur de 3 800 m dans un bloc
qui culmine à 3 260 rend 131/255 d'écart qui ne disent rien de la loi. Le
domaine commun aux dix crans est **[2 461 ; 3 260] m**.

| | option cochée (= le dépôt d'avant) | **défaut : rampe fixe** |
|---|---|---|
| pivotM sur 9 crans | 2 578,4 → 3 037,3 m (**étendue 459 m**) | **2 622,8 m partout — étendue 0,0 m** |
| fenetreM sur 9 crans | 380,5 → 1 637,5 m (**×4,30**) | **1 633,3 m partout — ×1,00** |
| ⚡ **couleur d'une altitude, deux crans VOISINS** | **130/255** (3 000 m, crans 8→9) | ⚡ **0/255** |
| ⚡ **couleur d'une altitude, sur les 9 crans** | **168/255** (3 000 m) | ⚡ **0/255** |

Le critère du brief était **≤ 2 niveaux/255**. Le relevé est **0** — pas
« sous le seuil » : **identique**.

---

## ③ LA RÉFÉRENCE — DÉRIVÉE, ET POURQUOI CE N'EST PAS 5 600 m

Le brief demandait de vérifier le plafond du globe avant de le reprendre.
⛔ **Il ne convient pas, et le calcul le dit.**

Aux Alpes, le nuage d'altitudes du bloc tient dans 3 930 m ; la rampe planétaire
`[−6 000 ; 5 600]` en couvre **11 600**. Un gabarit qui pose `heightPivot: 0,42`
viserait alors **−1 128 m** au lieu de 1 344 m, et son `heightContrast` devrait
être **multiplié par 2,95** pour rendre la même image. **Un plafond planétaire
ne déplace pas la rampe des gabarits : il la détruit** — et « l'identité de tous
les templates est d'abord une rampe de couleur ».

⚡ **La question « quel plafond ? quel plancher ? et sous la mer ? » n'a donc pas
de bonne réponse sous cette forme.** La référence du socle n'est pas une paire
d'altitudes planétaires : **c'est une emprise géographique.** Trois contraintes,
et une seule forme les tient toutes les trois :

| contrainte | pourquoi |
|---|---|
| ① invariante par cran | sinon on n'a rien réparé |
| ② fonction du **lieu** | sinon les gabarits perdent leur identité |
| ③ indépendante du **chemin** | le piège de TUILE : 35 % de saturation d'écart selon qu'on arrive direct ou par paliers |

➡️ **Un carré au sol de côté fixe, centré sur la carte. `COTE_REF_M = 40 000 m`.**

**40 km est mesuré, pas choisi** : c'est l'emprise du MNT au **zoom d'arrivée**
du produit — relevé **40 770 m** à z11 aux Alpes, puis 20 385 · 10 192 · 5 096 ·
2 548 m aux crans suivants. Deux conséquences, et ce sont les deux qu'on veut :

- **au zoom d'arrivée et au-dessus**, le carré tient dans le MNT : la référence
  s'y recalcule à l'identique cran après cran, **et un dézoomage ne la déplace
  pas non plus**. C'est ce qui la distingue d'un « on garde le premier grade
  vu » : celui-là serait le CHEMIN, pas le LIEU.
- **au-delà**, le MNT est plus petit que le carré : il n'y a plus rien à
  regrader, et la référence tient toute seule.

**Et sous la mer ?** Rien de spécial, et c'est une propriété, pas un oubli : la
rampe bathymétrique du nuanceur ne passe pas par `hNorm` du tout — elle lit
`(uSeaY − y) / uSeaRange`, deux uniformes dérivés du niveau de la mer et de la
profondeur du MNT, que ce chantier ne touche pas. Le plancher de pivot
(`pivotFloor`, `terrain.js:1047`) reste calculé sur `uSeaY` et `uHeightRange`,
tous deux restés vivants : un pivot transposé sous le niveau de la mer y est
encore remonté, exactement comme avant.

---

## ④ CE QUE J'ABROGE — DIT EXPLICITEMENT

⛔ **Je n'abroge PAS la décision 4 du 2026-08-21** (« la rampe de couleur se
calcule SUR LE CROP, et les alentours la suivent »). Je l'ai lue avant d'écrire
une ligne : elle porte sur le **globe**, elle est implémentée dans
`src/monde/rampe-crop.js`, et elle dit exactement ce que ce chantier fait —
**une référence géographique fixe plutôt qu'une référence qui suit la vue**.
Ce chantier l'ÉTEND au socle, il ne la contredit pas. `rampe-crop.js` n'est pas
modifié d'une ligne.

⛔ **J'abroge la prémisse d'appelant de `src/relief-grade.js`** : « les 4
réglages sont dérivés du relief RÉELLEMENT chargé ». Le module ne change pas
d'une ligne ; **ce qu'on lui donne à lire change**. Son en-tête porte
l'amendement, daté, avec le chiffre qui le motive (168/255).

⚠️ **Et je note que SUR le suggérait déjà** — « garder `uHeightRange` sur une
amplitude *géographique* stable pendant une descente » — mais que sa
recommandation nommait `uHeightRange`, ce qui n'aurait pas suffi (§①).

---

## ⑤ LES GABARITS DE LA BOUTIQUE — UN PAR UN, AVEC LES CAPTURES

⛔ **PREMIER CONSTAT, ET IL EST MÉTHODOLOGIQUE : LA DIFF D'ÉCRAN NE SAIT PAS
RÉPONDRE ICI.** J'ai posé un **témoin** — deux captures dans les mêmes
conditions, sans rien changer — et il est du **même ordre** que la mesure :

| gabarit | Δmax avant/après | Δmax **témoin** (rien changé) |
|---|---|---|
| iceland | 145/255 | **166/255** |
| fallout-wastelands | 124/255 | 115/255 |
| denali | 198/255 | 198/255 |
| toothpaste | 187/255 | **190/255** |
| boutique:isolated | 168/255 | 153/255 |
| boutique:the-main-stuff | 150/255 | **152/255** |

La scène bouge toute seule — nuages, houle, caustiques, course du soleil.
**Trois témoins sur six dépassent la mesure, un l'égale.** Conclure quoi que ce soit de ces
chiffres aurait été un faux constat. On lit donc, là aussi, **la couleur d'une
altitude**.

### Au zoom d'arrivée (z11) — le prix du correctif sur les gabarits

| gabarit | pivotM avant → après | ⚡ **Δ couleur d'une altitude** |
|---|---|---|
| fallout-wastelands | 2 264,0 → 2 270,0 m | **2/255** (2 400 m) |
| toothpaste | 2 499,8 → 2 505,2 m | **3/255** (2 000 m) |
| denali | 2 342,6 → 2 348,4 m | **5/255** (2 800 m) |
| iceland | 2 617,7 → 2 622,8 m | **7/255** (2 800 m) |
| ⚠️ boutique:isolated | 2 578,4 → 2 622,8 m | ⚠️ **19/255** (3 200 m) |
| ⚠️ boutique:the-main-stuff | 2 578,4 → 2 622,8 m | ⚠️ **19/255** (3 200 m) |

**Les quatre gabarits du dépôt tiennent le critère à 2–7/255.** Leur pivot est
posé en dur, donc il ne bouge que du décalage entre le MNT entier et le carré de
40 km : **5 à 6 mètres sur une fenêtre de 1 000 m**, soit 0,5 %.

⚠️ **LES DEUX GABARITS DE LA BOUTIQUE SONT AU-DESSUS DU CRITÈRE : 19/255.** Ils
laissent l'Ombrage auto piloter le pivot, et le grade auto se déplace de
**2 578,4 → 2 622,8 m**, soit **44 m** — c'est-à-dire **exactement un cran du
curseur « Pivot d'altitude »** (`relief-grade.js` arrondit le pivot au
centième : 0,48 → 0,49, et 0,01 × 3 930 m = 39 m). Le carré de référence couvre
98,1 % du MNT à z11 : ce sont les 1,9 % de bord, qui portent les extrema, qui
déplacent le grade d'un cran.

⛔ **JE NE TRANCHE PAS.** Les captures sont dans `.banc/RAMP-GABARITS/`
(`<gabarit>-avant.png`, `-apres.png`, `-temoin.png`). Trois voies, si Adrien
juge que 19/255 est trop :
1. **agrandir `COTE_REF_M`** au-delà de l'emprise d'arrivée (41 km) → au zoom
   d'arrivée le grade redevient celui d'aujourd'hui **au bit**, mais la
   référence n'est plus recalculable que sur un dézoom, donc la propriété ③
   (indépendance du chemin) s'affaiblit ;
2. **retirer l'arrondi au centième** de `heightPivot` dans `relief-grade.js` —
   c'est lui qui transforme 5 m de décalage réel en 39 m de saut ;
3. **ne rien changer** : 19/255 sur UNE altitude d'un gabarit, contre 105 à
   182/255 gagnés six crans plus bas (ci-dessous).

### Six crans plus bas (`.banc/RAMP-GABARITS-C6/`) — ce que les gabarits GAGNENT

| gabarit | pivotM avant → après | ⚡ Δ couleur d'une altitude |
|---|---|---|
| iceland | 3 082,1 → **2 622,8 m** | **110/255** |
| fallout-wastelands | 2 880,6 → **2 270,0 m** | **182/255** |
| denali | 2 925,4 → **2 348,4 m** | **61/255** |
| toothpaste | 3 014,9 → **2 505,2 m** | **127/255** |
| boutique:isolated | 3 037,3 → **2 505,2 m** | **105/255** |
| boutique:the-main-stuff | 3 037,3 → **2 544,4 m** | **100/255** |

⚡ **Le « après » de chaque gabarit est EXACTEMENT sa valeur du zoom d'arrivée.**
C'est la propriété qu'on voulait : le gabarit garde son identité en descendant,
au lieu de la perdre de 100 à 180 niveaux.

---

## ⑥ LE RETARD DE ~300 ms — TRAITÉ À PART, ET CHIFFRÉ

⚡ **La sonde a trouvé plus que le retard : elle a trouvé que le réglage ne
suivait pas du tout.** Échantillonnage par image sur une descente de six crans
(`.banc/RAMP-FLASH/`) :

| | changements d'amplitude | changements de réglage | images à l'ancienne loi |
|---|---|---|---|
| **option cochée** (le dépôt d'avant) | 7 | **2** | **14 à 27** (médiane 530 ms) |
| **rampe fixe, avant le rendez-vous** | 7 | 2 | idem |
| ⚡ **rampe fixe, défaut du jour** | 7 | **4** | ⚡ **0** |

**La cause :** `terrain.js` pose `uHeightRange` en **quatre** endroits
(`majResFenetre`, le pas de fenêtre, `rafraichirFenetre`, `rebuild`) alors que
`applyAutoShade` ne tourne qu'à la fin d'un chargement complet. Entre les deux,
l'image portait la loi de l'amplitude PRÉCÉDENTE. Le correctif est un
rendez-vous : `this._surAmplitude?.()` après chacune des quatre poses, branché
sur `appliqueRampeFixe`. **0 image portant l'ancien réglage.**

⚠️ **Les 3 changements d'amplitude restés sans repose ne sont pas un reliquat** :
`uHeightRange` est en UNITÉS MONDE, et un changement d'exagération multiplie ses
deux bornes — `hNorm` est alors inchangé, donc il n'y a rien à reposer. Je l'ai
vérifié avant de conclure ; j'avais d'abord compté ces trois-là comme un défaut.

---

## ⑦ CE QUI NE RÉGRESSE PAS — VÉRIFIÉ, PAS SUPPOSÉ

- ⛔ **`uHeightRange` n'est pas figé.** Il ne sert pas qu'à la couleur :
  `traffic.js:235` y lit l'altitude du plus haut sommet pour poser les avions,
  et le balayage (`terrain.js:1397`) y prend son plan. Ses **quatre** poses sont
  intactes, et un test le verrouille.
- **Le curseur « Teinte hypsométrique »** (`mapTint` → `uTint`) n'est pas touché :
  à 0 pas de couleur, au maximum le même effet qu'avant à amplitude égale. La
  courbe est celle d'avant, puisque la ligne du nuanceur est celle d'avant.
- **« Ombrage auto »** et les quatre curseurs fonctionnent. ⚠️ Les deux curseurs
  de rampe passent désormais par `poseRampeReglage` : ils écrivent dans le
  domaine de RÉFÉRENCE, sinon toucher un curseur aurait relâché la rampe.
- **La référence se pose même quand l'Ombrage auto est éteint** — sans quoi une
  carte ouverte en manuel n'aurait eu aucune référence et l'option par défaut
  aurait été morte pour elle.
- **Le grade auto part au globe dans le domaine VIVANT** (`shadeGradeVivant`) :
  `gradeBlocEffectif` compare `pivotSocle` (l'uniforme, transposé) à
  `pivotAutoSocle`. Les laisser dans deux domaines différents aurait fabriqué un
  « geste d'Adrien » fantôme de plusieurs centaines de mètres — le désaccord de
  R31 §⑥, réinventé.
- **Coût :** deux divisions par pose d'amplitude. La passe d'histogramme est
  **plus courte** qu'avant (2 271 049 texels au lieu de 2 359 296 au cran 0, et
  identique ensuite). `diffuseDuCentre` est gardé par un test d'égalité, donc il
  ne repasse pas sur 24 dalles par image pour rien.

---

## ⑧ LES TESTS MORDENT — 8 MUTATIONS, 8 TUÉES

`test/rampe-fixe.test.js`, **18 tests**, inscrit dans `package.json`
(`audit:tests` sans écart).

| mutation | ce qu'elle arrache | verdict |
|---|---|---|
| M1 | le court-circuit « même domaine → même nombre » | ✅ tuée (`Object.is`) |
| M2 | `transpose` rend l'identité (le dépôt d'avant) | ✅ tuée |
| M3 | `statsFenetre` bine le MNT entier | ✅ tuée |
| M4 | `couvre` toujours vrai (la référence se repose à chaque cran) | ✅ tuée |
| M5 | pas de repose des uniformes quand il n'y a rien à regrader | ✅ tuée |
| M6 | l'option allumée par défaut | ✅ tuée |
| M7 | un des quatre rendez-vous de `terrain.js` retiré | ✅ tuée |
| M8 | le rendez-vous débranché dans `main.js` | ✅ tuée |

⚠️ **Quatre tests portent sur le SOURCE et non sur le module pur**, et c'est
délibéré : un module parfaitement testé mais **débranché** rendrait exactement le
défaut d'avant sans qu'une seule ligne ne rougisse — c'est le piège nommé par le
brief (« une garde est restée verte avec le cœur du correctif arraché »).

---

## ⑨ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Il suffit de figer `uHeightRange` sur une référence fixe. »** ⛔ **FAUX**,
   et c'était l'orientation naturelle du brief. `applyAutoShade` regrade sur
   `dem.minM/maxM` : le pivot serait reparti tout seul. **La grandeur à figer
   n'est pas le domaine, c'est la loi en mètres (`pivotM`, `fenetreM`).** Et
   figer `uHeightRange` aurait fait voler les avions à l'altitude d'une
   constante de rampe (`traffic.js:235`).

2. **« Prendre `uLandMax = 5 600 m` comme le globe. »** ⛔ Réfuté par le calcul,
   §③ : sur un bloc alpin, `heightPivot: 0,42` viserait −1 128 m au lieu de
   1 344 m. Un plafond planétaire détruit les gabarits.

3. **« La moyenne RGB de l'écran mesure la rampe. »** ⛔ Réfuté par la mesure
   elle-même : 32,6/255 d'étendue AVANT comme APRÈS, parce que le cran change le
   cadrage. J'ai failli conclure que le correctif ne servait à rien. **Le témoin
   à deux captures identiques est ce qui a tranché** — et il montre que même sur
   les gabarits, la diff d'écran est noyée dans les nuages et la houle.

4. **« La fenêtre de référence est exactement centrée. »** ⛔ Faux, et c'est le
   test qui l'a dit avant le rapport : `1 536 − 1 507 = 29`, un reste impair, une
   marge à 15 texels et l'autre à 14. J'avais écrit l'égalité stricte.

5. **« Cocher l'option peut jeter la référence, elle ne sert plus. »** ⛔ **Défaut
   trouvé par la sonde des gabarits** : la référence ne se repose que sur un MNT
   d'au moins 40 km, donc **décocher la case six crans plus bas ne la retrouvait
   plus** et la rampe redevenait libre en silence. Cinq gabarits sur six
   rendaient « avant » et « après » identiques — le correctif éteint sans le
   dire. `domaineRef()` suffit à l'ignorer ; on ne jette plus rien.

6. **« Les 3 poses d'amplitude sans repose de réglage sont un reliquat du
   flash. »** ⛔ Non : `uHeightRange` est en unités MONDE, un changement
   d'exagération multiplie ses deux bornes et laisse `hNorm` intact.

7. **Deux gardes du dépôt m'ont mordu, et elles avaient raison :**
   `test/damier-uniformes.test.js` ① sur un alias `const mu =
   terrain.mapUniforms` (une cession en bloc de la poignée), et ② parce que
   `appliqueRampeFixe` ne prévenait pas les dalles voisines — la couture se
   serait vue pile sur la jointure.

---

## ⑩ LA LIMITE QUI RESTE, ET ELLE EST NOMMÉE

⚠️ **UNE SEULE DÉPENDANCE AU CHEMIN SUBSISTE.** Si une session commence
**directement** à un zoom plus fin que 40 km sans jamais voir ce niveau, la
première référence est posée sur ce MNT étroit (`!rampeRef` — mieux vaut une
référence étroite que pas de couleur du tout). Elle est ensuite **stable pour
toute la descente**, donc le défaut d'Adrien ne revient pas ; mais deux chemins
d'arrivée différents peuvent donner deux références.

**La fermeture propre est écrite et ne demande pas de nouvelle donnée** : lier la
référence du socle au crop, c'est-à-dire à `mesurerRelief` / `gradeCrop` de
`src/monde/rampe-crop.js`, qui mesurent déjà une emprise géographique fixe,
indépendante du zoom **et** du chemin. C'est la même direction A que la Tâche
GRA a prise pour le bloc du globe. À chiffrer sur un chantier à part.

---

## FICHIERS

**Code** — `src/rampe-fixe.js` (nouveau, pur) · `src/main.js`
(`rampeRenormalise`, `majRampeRef`, `appliqueRampeFixe`, `shadeGradeVivant`,
`setRampeRenormalise`, `poseRampeReglage`, le branchement `_surAmplitude`) ·
`src/terrain.js` (quatre rendez-vous, **aucune ligne de nuanceur touchée**) ·
`src/ui/create-panel.js` (la case + le détour des deux curseurs de rampe) ·
`src/relief-grade.js` (en-tête amendé, **aucun calcul touché**).

**Tests** — `test/rampe-fixe.test.js`, inscrit dans `package.json`.

**Sondes** — `scripts/sonde-ramp.mjs` (les crans, la loi en mètres, la couleur
d'une altitude) · `scripts/sonde-ramp-gabarits.mjs` (les gabarits avant/après
avec témoin) · `scripts/sonde-ramp-flash.mjs` (le retard, par image).

**Mesures et captures** — `.banc/RAMP-AVANT/` (code d'origine, dix crans) ·
`.banc/RAMP-APRES/` · `.banc/RAMP-RENORM/` (l'option cochée, identique à
`RAMP-AVANT` au bit) · `.banc/RAMP-GABARITS/` et `.banc/RAMP-GABARITS-C6/` ·
`.banc/RAMP-FLASH/`.
