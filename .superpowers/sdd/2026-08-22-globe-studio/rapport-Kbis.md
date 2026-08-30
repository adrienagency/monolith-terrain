# Tâche K bis — L'ÉCHELLE DE COULEUR CONTINUE

**Statut : LIVRÉE.** Commit unique **`d6d6478`** sur `regroupement` (arbre propre après).
`npm test` **3 745 / 3 745** · `npm run audit:tests` **204 / 204** · `node --check` vert sur les
cinq fichiers touchés · page chargée **drapeau levé ET baissé**, aucune erreur de console.
Campagne de mutation **35 / 35**, dont **22 visent le BRANCHEMENT** et non la loi.

---

## 1. La mesure AVANT — et elle dit autre chose que ce que je croyais

Descente réelle, application vivante, La Réunion,
`?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, `fov` lu **en direct à 33**,
six stations. **Données brutes laissées sur le disque : `.banc/vues-Kbis/AV-descente.json`**,
dépouillées par **`.banc/bilan-Kbis.mjs`**. Aucun chiffre de ce rapport ne vient d'ailleurs.

| station | mode | altitude | `uCropOn` | `uLandBas` | `uLandMax` | `uOceanDepth` | `uMerFondBudgetM` |
|---|---|---|---|---|---|---|---|
| ORB | orbital | 3 000 000 m | **1** | 0 | 2 584,4 | 2 106,771 | 3 510,5 |
| Z4 | surface | 189 119 m | **0** | 0 | 5 600,0 | 6 000,000 | 6 000,0 |
| Z6 | surface | 26 720 m | 1 | 0 | 2 457,3 | 5 639,500 | 6 228,0 |
| Z9 | surface | 6 339 m | 1 | 0 | 2 848,8 | 4 913,000 | 6 028,0 |
| Z11 | surface | 8 001 m | 1 | 0 | 3 005,5 | 1 827,149 | 6 028,0 |
| Z13 | surface | 9 564 m | 1 | **533,7** | 3 057,2 | **0,009** | 4 415,2 |

**Trois faits que le brief n'avait pas :**

1. ⛔ **`uOceanDepth` ne « rétrécit » pas : il S'EFFONDRE à 8,7 millimètres.** Au crop de Z13 il
   n'y a plus un seul point sous le niveau de la mer, donc `echelleRampe` rend son PLANCHER DE
   DIVISION. Toute la mer sature alors sur le premier texel.
2. ⛔ **`uLandBas` saute de 0 à 533,7 m** — le crop de Z13 n'a plus de littoral. **Tout ce qui est
   sous 534 m s'écrase sur la première teinte de terre**, c'est-à-dire le vert. C'est un second
   mécanisme du vert d'Adrien, distinct de celui du brief.
3. ⚠️ **Le quatrième nombre, `uMerFondBudgetM`, était HORS du périmètre nommé — et c'est LUI qui
   peint la mer.** Dès que `poserMer` a pris (`uMerRampeOn = 1`), le fond marin ne lit plus
   `uRamp` du tout : il lit la rampe NAUTIQUE indexée par `uMerFondBudgetM`. Il bouge de
   6 228 → 4 415 m, ce qui déplace `dMer01` de **0,248**. Le laisser dehors aurait laissé
   l'essentiel du turquoise intact. **Il est traité.**

**Écart maximal de couleur, pour une hauteur physique donnée, entre stations.**
⚠️ **DEUX MONNAIES, JAMAIS ADDITIONNÉES** : `t` indexe une table de 512 couleurs (`uRamp`),
`dMer01` interpole trois couleurs en linéaire.

| jeu de stations | `t` AVANT | texels | `dMer01` AVANT |
|---|---|---|---|
| les six | 0,3499 | 179 / 512 | 0,2480 |
| surface, crop posé (Z6, Z9, Z11, Z13) | 0,3499 | 179 / 512 | 0,1394 |
| profondes (Z9, Z11, Z13) | 0,3499 | 179 / 512 | 0,1273 |

---

## 2. La loi retenue — ni figée, ni re-mesurée

`src/monde/echelle-continue.js`, module PUR (n'importe qu'`exageration-continue.js`, pour ses
pentes de Fritsch–Carlson — **une seule écriture de la cubique monotone dans le dépôt**).

- **Les mesures ne sont plus POSÉES, elles sont ANCRÉES** sous un cran d'altitude
  `Math.round(log2(mètres))`. ⚠️ **Le pas 1 vient du dépôt** : `STEP_IN = STEP_OUT = Math.LN2`
  (`modes.js:171-172`) — un cran de l'escalier d'Adrien vaut un facteur 2.
- **Une ancre s'écrit une seule fois par cran.** Redescendre au même endroit rend donc la même
  couleur qu'à la descente précédente.
- **Ce que le nuanceur reçoit est la valeur d'une COURBE**, évaluée par image
  (`Globe.majEchelleRampe`, une ligne dans `majSeuilSocle`), monotone, C¹, sans dépassement,
  **plate hors du domaine ancré** — on n'extrapole jamais un relief jamais vu.
- **Le mélange se fait en `log1p`** : ce sont des échelles, donc la moyenne qui a un sens est la
  géométrique ; et `log1p` est le seul logarithme défini en 0, ce que `terreBas = 0` exige.
- ⛔ **Une mesure DÉGÉNÉRÉE n'est pas une ancre.** Le `0,009 m` de Z13 est un « je ne sais pas »,
  pas « la mer est plate » — c'est la doctrine que `mesurerRelief` porte déjà pour la couverture,
  appliquée au contenu.
- **Un déménagement jette les ancres, un cran de zoom NON** (test géométrique dans `poserCrop`).

**Et `h == 0` quitte la branche terre** : nouvel uniforme `uMerZeroSousEau`, **0 par défaut** —
même garde que `uCropOn`, `uHabOn`, `uMerRampeOn` et `uMppFacteur` de la Tâche K. Allumé au seul
site `contexteCrop`, sous `?terre=unique`.

---

## 3. La mesure APRÈS — même harnais, même chemin de capture

`.banc/vues-Kbis/AP-descente.json`, même descente, même dépouillement.

| station | altitude | `uLandBas` | `uLandMax` | `uOceanDepth` | `uMerFondBudgetM` |
|---|---|---|---|---|---|
| Z6 | 26 720 m | 0 | 2 457,3 | 5 639,500 | 6 228,0 |
| Z9 | 6 124 m | 0 | 2 809,4 | 4 812,498 | 6 046,6 |
| Z11 | 8 198 m | 0 | 2 848,8 | 4 733,819 | 6 028,0 |
| Z13 | 10 529 m | **0** | 2 820,9 | **4 789,115** | **6 041,1** |

| jeu de stations | `t` AVANT → APRÈS | texels | `dMer01` AVANT → APRÈS |
|---|---|---|---|
| les six | 0,3499 → 0,3018 | 179 → 154 | 0,2480 → 0,2480 |
| **surface, crop posé** | **0,3499 → 0,0727** | **179 → 37** | **0,1394 → 0,0121** |
| **profondes (Z9/Z11/Z13)** | **0,3499 → 0,0064** | **179 → 3** | **0,1273 → 0,0012** |

⚠️ **L'ÉCART RÉSIDUEL N'EST PAS NUL, ET JE NE PRÉTENDS PAS QU'IL L'EST.** Il vaut **3 texels sur
512** entre Z9, Z11 et Z13 — là où Adrien regarde — et **37 texels** sur toute la descente de
surface. Deux causes, assumées :
- **la première visite d'un cran neuf déplace encore la courbe.** On ne peut pas connaître le
  relief d'un lieu avant de l'avoir mesuré ; ce qu'on peut, c'est ne le mesurer qu'une fois par
  facteur 2 d'altitude.
- **entre deux crans ancrés, la courbe glisse.** C'est le prix de la troisième voie ; l'annuler
  demanderait de figer l'échelle, c'est-à-dire la régression déjà rejetée.

**Et le gain local est conservé**, recompté : sur La Réunion (0 → 3 070 m), la rampe MONDIALE
occupe **182 texels sur 512**, la rampe posée au sol **332** — **×1,82**.
⚠️ **Je ne reprends pas le « 163 contre 368, ×2,26 » de la Tâche C** : recompté avec le sommet réel
du Piton des Neiges et la loi d'aujourd'hui, la rampe mondiale rend **182**, pas 163. Son compte
rendu ne donne pas l'altitude sur laquelle elle comptait. **Ce rapport cite ses propres chiffres.**

---

## 4. La preuve côté GPU — témoin à ZÉRO PIXEL, et une mesure RETIRÉE

`.banc/vues-Kbis/GPU-Kbis.json`. On CACHE le terme et on compte **ce qui CHANGE**, sur le même
cadre, au même instant. Cadre 1 623 × 765, **1 241 595 pixels**.

| | pixels changés | % | amplitude moyenne |
|---|---|---|---|
| **témoin — deux rendus synchrones** | **0** | **0 %** | — |
| `uMerZeroSousEau` 1 → 0 | **3 457** | 0,278 % | 8,0 / 255 |
| retour à 1 | **0** | 0 % | — |

⚠️ **UN TÉMOIN NUL EST SOIT UNE PREUVE, SOIT UN BANC QUI NE REND RIEN — ICI C'EST UNE PREUVE** :
la variante change 3 457 pixels **dans les mêmes conditions, sur le même cadre**, et le retour
revient à zéro exactement.

⛔ **UN SECOND A/B EST RETIRÉ, ET C'EST MOI QUI LE RETIRE.** Je voulais mesurer côté GPU ce que
vaut l'échelle (uniformes bruts de Z13 contre la courbe). **Son témoin est SALE** : une fois la
chaîne de post-traitement pleinement rallumée par le gouverneur, **deux rendus SYNCHRONES et
identiques diffèrent sur 98,6 % des pixels**, amplitude moyenne 12,1/255. Grain de pellicule à 0,
vignette à 0, animations coupées, occlusion ambiante coupée : le témoin reste à 98,6 %. Moyenner
huit images par variante le ramène à 84,3 % — et la variante, elle, rend 85,7 %. **Les deux ne se
distinguent pas.** Les chiffres **98,7 %** et **85,7 %** sont donc retirés, pas remplacés.
**Ce qui reste mesuré sur l'échelle vient des uniformes relevés, pas du GPU.**

---

## 5. CE QUE J'AI VU À L'ÉCRAN

Six captures AVANT et six APRÈS, **même méthode de capture des deux côtés**, dans
`.banc/vues-Kbis/` (`AV-*.png`, `AP-*.png`).

- **Z13 — c'est là que ça se voit, et ça se voit beaucoup.** AVANT : le cadre est occupé par **un
  champ gris clair uniforme** d'un bord à l'autre, le bloc n'est plus qu'une tache délavée au
  milieu. C'est la mer saturée par `uOceanDepth = 0,009 m` : toute profondeur rend le même texel.
  APRÈS : **le champ gris a disparu**, les alentours redeviennent un dégradé chaud de planète qui
  s'estompe, et le bloc se lit — relief, vallées, sommets clairs.
- **Z6 — rien n'a bougé, et c'est le résultat attendu** : à ce cran l'ancre est posée par la
  mesure elle-même, donc la courbe rend exactement ce que le dépôt posait. Les deux images sont
  superposables. **C'est le témoin de non-régression.**
- **Z9, Z11 — presque superposables** aussi ; l'écart de 3 texels ne se voit pas à l'œil sur une
  capture. **Le dire est plus honnête que de prétendre le montrer.**
- **Le vert.** À ce cadrage (isométrique, La Réunion, bloc côtier), le plan de mer exactement à
  `h = 0` occupe peu de pixels : 0,278 % du cadre changent quand on éteint la bascule. **Je n'ai
  donc PAS vu « le grand aplat vert disparaître » à l'écran sur cette vue-ci** — j'ai vu 3 457
  pixels changer, et j'ai vérifié la loi au texel près (`uRamp[179] = rgb(147, 160, 116)`, un
  olive vert, contre `uOceanShallow`, un bleu pâle). **La vue au nadir, où l'aplat occupe le
  cadre, n'a pas été refaite : c'est une réserve, pas une preuve.**

---

## 6. CE QUE JE NE FERME PAS — et je ne prétends pas le fermer

1. ⛔ **La mer autour du bloc reste un patchwork de plaques droites.** Très visible sur `AP-Z13`
   et sur la vue vive à Z12 : des quadrilatères à arêtes franches dans la moitié mer du bloc.
   C'est la dégradation **par sommet** selon la distance caméra (`globe.js:148-157`), **hors de
   mon périmètre**. Mon banc la DISTINGUE de ce que je change : elle est identique pixel pour
   pixel entre `uMerZeroSousEau` à 0 et à 1, et elle est là AVANT comme APRÈS.
2. ⛔ **La mer au large est un champ presque BLANC troué de flaques bleu foncé** (voir `AV-Z06` et
   `AP-Z06`, identiques). Ce n'est pas moi : c'est déjà l'image du dépôt. La cause probable est la
   rampe nautique (`uOceanShallow` très pâle) appliquée sur un fond bathymétrique très grossier à
   cette emprise. **Non diagnostiqué, non touché.**
3. ⛔ **À l'ORBITE, le crop reste POSÉ et la planète entière porte la rampe du dernier bloc.**
   Relevé : `uCropOn = 1` à **3 000 km d'altitude**, avec `uLandMax = 2 584 m` — donc tout sommet
   au-dessus de 2 584 m est blanc et tout océan plus profond que 2 107 m sature. `veilleCrop.maj`
   sort sur `if (!modeSurface) return pose` et **`poserMode(false)` n'est apparemment jamais
   appelé**. C'est pour cette raison que la colonne « les six » du §3 ne s'améliore quasiment pas.
   **C'est un défaut réel, il n'est pas de cette tâche, et il n'est pas corrigé.**
4. ⚠️ **Le résidu de 3 texels n'est pas zéro** — répété ici parce que le critère d'Adrien, lui,
   dit « la même couleur ». La loi le tient **exactement** tant qu'un seul cran est mesuré
   (test ①e), et à 3 texels près sur sa descente réelle.
5. ⚠️ **Un seul lieu mesuré.** Toute la campagne est sur La Réunion. Un crop alpin intérieur, où
   `terreBas` vaut 400 m et où il n'y a jamais eu de mer, n'a **pas** été mesuré — la loi devrait
   y garder l'échelle de mer du dernier cran qui en voyait, mais **je ne l'ai pas vu à l'écran**.
6. ⚠️ **Le périmètre a débordé, et je le dis.** Le brief nommait `rampe-crop.js` et `globe.js` ;
   la mesure a montré que **le nombre qui peint réellement la mer** (`uMerFondBudgetM`) est posé
   par `poserMer`, et que `sousEauCrop` (`habillage-crop.js`) porte la loi jumelle du prédicat.
   Les deux sont dans le commit. **Rien du mode plat n'est touché** : ni `terrain.js`, ni
   `plinth.js`, ni `ocean.js`, ni le chemin bloc.

---

## 7. Vérifications de clôture

- `npm test` — **3 745 / 3 745** (3 717 au départ, +28).
- `npm run audit:tests` — **204 / 204**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/main.js`, `src/monde/echelle-continue.js`,
  `src/monde/exageration-continue.js`, `src/monde/habillage-crop.js`.
- **CRLF** : `git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent **exactement le
  même compte** — 1 242 insertions, 21 suppressions, 11 fichiers. **Aucun faux diff.**
- **Mutation : 35 / 35**, `.banc/mutations-Kbis.mjs`, dans un `git worktree` à part **retiré en
  partant**. ⚠️ **Trois ont survécu au premier tour, et les trois étaient des tests de
  BRANCHEMENT insuffisants** — pas des lois manquantes :
  - *la borne `terreHaut ≥ terreBas + plancher` disparaît* : mon jeu d'ancres à deux points ne
    l'atteignait jamais. Il faut **cinq ancres à crans irréguliers** pour inverser l'amplitude ;
    un balayage de 40 000 jeux aléatoires en a trouvé un qui descend à **−320,7 m**, et c'est
    lui qui est dans le test.
  - *le déménagement se juge sur la PLUS PETITE demi-largeur* : mon test reposait le crop au
    centre EXACT, où `Math.max` et `Math.min` répondent pareil. Le cas réel est le centre **calé
    sur la grille de tuiles**, qui glisse de plus d'une demi-largeur fine.
  - *`sousEauCrop` applique l'option AUSSI sous le masque* : je ne testais que la branche de
    repli.
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree`) : `uCropOn = 0`,
  `uMerZeroSousEau = 0`, `uMppFacteur = 0`, `uLandBas/uLandMax/uOceanDepth/uMerFondBudgetM` =
  `0 / 5600 / 6000 / 6000`, **zéro ancre**, socle plat visible, **aucune erreur de console**.
- **Page chargée, drapeau LEVÉ** : la chaîne se pose, `refus` se vide, **une** ancre au cran 14,
  `uMerZeroSousEau = 1`, uniformes posés par la courbe. Aucune erreur.

## 8. Ce qui reste sur le disque

`.banc/harnais-Kbis.js` (le harnais, avec la POMPE qui contourne l'étranglement des minuteurs d'un
onglet caché — sans elle une descente de six stations n'aboutit jamais) ·
`.banc/serveur-vues-Kbis.mjs` · `.banc/bilan-Kbis.mjs` · `.banc/rejoue-Kbis.mjs` ·
`.banc/mutations-Kbis.mjs` · `.banc/vues-Kbis/` (12 captures, `AV-descente.json`,
`AP-descente.json`, `GPU-Kbis.json`).
