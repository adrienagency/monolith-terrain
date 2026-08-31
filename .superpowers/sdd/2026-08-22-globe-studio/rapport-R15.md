# R15 — LA CAMÉRA PASSAIT SOUS LE BLOC PARCE QUE L'ANCRE ÉTAIT À LA MER

**Arbre** `C:\Dev\wt-mont`, branche `sous-le-bloc`, base `7cc5a96`.
**Matériel** ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800.
**Serveur** `npm run dev -- --port 5555 --strictPort`, **mode sphère par défaut**
(`http://localhost:5555/`, aucun paramètre).

> ⛔ **Aucun chiffre de ce rapport ne vient du brief.** Tous ont été relevés sur
> ce poste, et les traces sont dans `.banc/R15/` et `.banc/D16/R15-*`.

---

# ⚡ EN UNE PHRASE

> **`poseFond` posait le plan `y = 0` du bloc sur la sphère de rayon `R_GLOBE`,
> c'est-à-dire au NIVEAU DE LA MER, alors que ce plan vaut l'altitude MOYENNE du
> bloc — la caméra de fond était donc enfoncée de cette moyenne, et sous les
> montagnes elle finissait sous un sol dessiné en `FrontSide`, qui ne dessine
> rien par en dessous.**

---

# ① LE SEUIL EXACT — ce n'est pas une altitude, c'est une ÉGALITÉ

**La mesure, `.banc/R15/AVANT.json`, `flyTo(lieu, 16)`, attente 16 s :**

| lieu | emprise (m) | `altitudeCadrageM()` | `dem.meanM` | `nCouleurs` | verdict |
|---|---|---|---|---|---|
| Amsterdam | 1 120,41 | **1 029** | 1 | 158 | ✅ bloc |
| Sahara (25,45 N · 30,55 E) | 1 656,19 | **1 521** | 74 | 469 | ✅ bloc |
| Denver | 1 410,97 | **1 296** | 1 600 | 36 | ⛔ VIDE |
| Mexico | 1 730,48 | **1 589** | 2 235 | 37 | ⛔ VIDE |
| Cusco | 1 783,80 | **1 638** | 3 360 | 39 | ⛔ VIDE |
| Lhassa | 1 594,13 | **1 464** | 3 659 | 37 | ⛔ VIDE |
| Mont-Blanc | 1 278,19 | **1 174** | 4 483 | 36 | ⛔ VIDE |

> ⚡ **L'écran se vide dès que `dem.meanM > altitudeCadrageM()`.** Sept lieux sur
> sept, sans exception.

**Et `altitudeCadrageM()` vaut `0,918408 × emprise`** — le même rapport aux
**six décimales** aux sept lieux, parce que la caméra de surface est **collée à
la butée** : `distBloc = 150,000` et `camY = 102,86169718661748` partout. Ce
rapport est `(150 × 18/√(18²+19²) − 0,3) / (56 × 2)`, c'est-à-dire
`DISTANCE_MAX_SURFACE`, `PENTE_ARRIVEE`, `Y_CIBLE`, `TERRAIN_SIZE` et
l'exagération, et rien d'autre.

⚠️ **C'est pourquoi l'encadrement 884 m / 1 600 m de l'attaquant ne se refermait
pas** : l'emprise porte `cos(lat)`, donc le seuil vaut **1 029 m à Amsterdam et
1 638 m à Cusco**. **Il n'y a pas de nombre unique à écrire.** Ses deux bornes
étaient prises à deux latitudes différentes.

## La mesure de pixels, parce que « vide » était oculaire

`scripts/diag-r15.mjs` capture, redonne la PNG à un canevas 2D **dans la page**,
et mesure la **fenêtre centrale** (x ∈ [0,20 ; 0,72[, y ∈ [0,11 ; 0,79[ — aucun
pixel d'IHM), réduite à 128 px de large (le canevas moyenne par aire, ce qui tue
le grain du fond).

⚠️ **Mesurée sur l'image ENTIÈRE, la grandeur ne sépare rien** : énergie 4,19
pour un écran vide contre 5,49 pour un bloc dessiné, soit ×1,3 — c'est le texte
de l'interface qu'on mesure. Sur la fenêtre centrale :

| | écran vide | bloc dessiné |
|---|---|---|
| **`nCouleurs`** (bins 5 bits/canal) | **36 – 39** | **158 – 478** |
| `energie` (gradient moyen, 0-255) | 1,89 – 1,93 | 4,43 – 8,30 |
| `ecartType` de luminance | 10,30 – 10,35 | 22,5 – 45,2 |
| couleur moyenne | **208,200,188 aux cinq** | variable |

➡️ **Le critère retenu : `nCouleurs ≤ 45` = écran vide, `≥ 100` = bloc dessiné.**
Facteur ≥ 4 entre les deux régimes, aucun recouvrement.

---

# ② QUI REPLAFONNE — `controls.maxDistance`, et la caméra y est DÉJÀ collée

`.banc/R15/RECUL.json`, Mont-Blanc z16, recul ×4 à la main :

| | distance au but | altitude de `camGlobe` au-dessus de la mer |
|---|---|---|
| avant | **150,000** | 2 348 m |
| après `camera.position.set(×4)` **sans** `controls.update()` | 600,000 | **9 420 m** |
| après `controls.update()` | **150,000** | **2 348 m** |

> ⚡ **Le replafonneur est `controls.maxDistance = DISTANCE_MAX_SURFACE = 150`
> (`main.js:1416`, `loi-altitude.js:41`), appliqué par `OrbitControls.update()`
> dans la même image.** L'attaquant appelait `controls.update()` : c'est pour ça
> qu'il lisait 2 348 → 2 348.

⚠️ **Et la pose, elle, suivait bien la caméra** (2 348 → 9 420 m sans `update`) :
`poseFond` n'était pas le replafonneur.

⛔ **C'est ça qui décide de la tâche** : à z16 la caméra est **déjà à la butée**
aux sept lieux. **L'usager ne peut pas s'en sortir en dézoomant.** La correction
ne pouvait donc pas être « laisser la caméra monter » — il fallait corriger la
POSE.

---

# ③ LE MÉCANISME, ET LE CONTRE-ESSAI QUI L'A TRANCHÉ

`camGlobe` sortait à **`altitudeCadrageM()` mètres au-dessus de la MER**,
exactement — mesuré aux sept lieux, `camAltReelle − altCadrage` valant 0 à
0,25 m près (le résidu est le second ordre du déport horizontal, `(k·r)²/2R`).

**L'essai décisif** (`.banc/R15/DECALE.json`) : on laisse la caméra du BLOC
exactement où elle est, et on décale **seulement** `camGlobe` radialement, en
détournant `camGlobe.position.set` depuis la sonde — **`src/` non touché**.

| décalage | altitude réelle | marge / sol | `nCouleurs` | `energie` |
|---|---|---|---|---|
| aucun | 1 174 m | **−3 630 m** | **36** | 1,92 |
| **`dem.meanM` = 4 483 m** | 5 657 m | **+853 m** | **402** | **6,90** |
| 6 000 m | 7 174 m | +2 370 m | 38 | 1,92 |
| 10 000 m | 11 174 m | +6 370 m | 36 | 1,95 |

➡️ **À `dem.meanM` exactement, le bloc apparaît.** Au-dessus, il repart : la
translation n'est juste que pour cette valeur-là — au-delà, la caméra est bien
au-dessus du sol mais son axe (inchangé) vise à côté du crop.

⚠️ **Ma dichotomie sur la HAUTEUR de la caméra du bloc a échoué, et c'était
attendu** (`.banc/R15/DICHO-LHASSA.json`) : reculer la caméra du bloc jusqu'à
`+2 218 m` au-dessus du sol laisse l'écran vide, parce que l'axe continue de
viser la cible, qui est à `Y_CIBLE` du plan du bloc — donc **3 662 m sous le
sol**. À ×4 le crop est à 3,66 km hors de l'axe pour une demi-image de 0,98 km.
**Reculer ne répare rien : ce n'est pas une question de hauteur, c'est une
question d'ancre.**

---

# ④ LA CORRECTION, EN UNE PHRASE

> **`poseFond` reçoit désormais `altitudeAncreM` — l'altitude que vaut le plan
> `y = 0` du bloc — et pose l'ancre à `R_GLOBE + h × (R_GLOBE / EARTH_RADIUS_M)
> × exagération` au lieu de `R_GLOBE`.**

⛔ **Ce n'est pas une butée, et rien ne claque.** La hauteur au-dessus du sol
redevient `altitudeCadrageM()` **exactement**, à toute altitude — vérifié à
`1e-9` près par le test. Aucune constante nouvelle n'entre au dépôt : la loi de
montée est `dispScale` de `globe.js` `_buildMesh` et `uUnitesParMetre` de
`setExaggeration`, **mot pour mot**, et le test la réapparie aux deux.

## ⚠️ Deux pièges rencontrés, mesurés, bouchés

**① `dem` DISPARAÎT PENDANT CHAQUE CRAN.** Première rédaction : `dem.meanM` avec
la garde de `surfaceCamAltMeters`. Relevé image par image
(`.banc/R15/saut-APRES.json`) : `dem` passe à `null` sur **huit à seize images à
chaque cran**, l'ancre retombait à la mer, et **la caméra de fond plongeait puis
remontait — ×2,3245 puis ×3,0876 d'altitude en une image**, dix sauts > 1,05 sur
une descente. La source retenue est donc `terrain.fenetreBornee.moyenneM`, avec
`dem.meanM` en repli — **exactement le couple de `largeurBlocM()`**, et c'est
déjà pour ça qu'`altitudeCadrageM()` ne bougeait pas d'un mètre pendant ces mêmes
images (8 705 → 8 668 m). Après : **un seul saut > 1,05, et il est plus petit
qu'au dépôt** (voir ⑥).

**② `near` SE MET À MESURER UNE ALTITUDE AU LIEU D'UNE HAUTEUR.** `plansFond`
calculait `near = (d − R_GLOBE) × 0,2` : tant que l'ancre était à `R_GLOBE`,
c'était la hauteur au-dessus du sol par accident. En relevant l'ancre, `near`
serait passé de **0,00737 à 0,03552** au Mont-Blanc, pour un sol visé à
**0,05367** unité de globe — **les deux tiers du chemin**. Rapport
`near / distance` calculé : **0,662 au Mont-Blanc · 0,781 à 5 500 m de sol moyen
· 1,073 à 8 000 m**, où il passe DEVANT le sol. `plansFond` prend donc
`rayonDuSol`, et `near` retrouve **0,007372** — la valeur relevée au navigateur
avant R15 (`0,007371809724509149`). ⚠️ **`far` reste mesuré depuis `R_GLOBE`** :
il doit contenir le limbe opposé de la sphère nue.

---

# ⑤ LES SIX LIEUX (+ un) — `.banc/R15/APRES2.json`, captures dans `.banc/R15/img-APRES2/`

| lieu | sol moyen | camGlobe (réel) | **marge / sol** | `nCouleurs` AVANT → APRÈS | `energie` |
|---|---|---|---|---|---|
| **Amsterdam** (témoin ✅) | 1 m | 1 030 m | +1 028 m | 158 → **171** | 4,45 |
| **Sahara** (témoin ✅) | 74 m | 1 596 m | +1 516 m | 469 → **478** | 8,08 |
| **Denver** | 1 600 m | 2 896 m | **+1 300 m** | **36 → 347** | 5,53 |
| **Mexico** | 2 235 m | 3 824 m | **+1 596 m** | **37 → 318** | 7,12 |
| **Cusco** | 3 360 m | 4 999 m | **+1 662 m** | **39 → 279** | 4,77 |
| **Lhassa** | 3 659 m | 5 123 m | **+1 466 m** | **37 → 318** | 7,02 |
| **Mont-Blanc** | 4 483 m | 5 657 m | **+853 m** | **36 → 431** | 6,93 |

**0 erreur de page.** Les deux témoins négatifs ne bougent pas (158 → 171,
469 → 478 : le bruit de deux sessions).

**Et le balayage des paliers au Mont-Blanc** (`.banc/R15/PALIERS-MB.json`,
captures `img-PALIERS-MB/`) — z12 à z17, tous dessinés, marge toujours positive :

| | z12 | z13 | z14 | z15 | z16 | z17 |
|---|---|---|---|---|---|---|
| `altitudeCadrageM()` | 3 685 | 3 936 | 3 717 | 2 348 | 1 174 | 587 |
| sol moyen | 2 416 | 3 004 | **3 766** | **4 192** | **4 483** | **4 671** |
| marge APRÈS | +1 401 | +2 152 | +2 681 | +1 736 | +853 | +454 |
| `nCouleurs` | 237 | 318 | 326 | 373 | 428 | 391 |

➡️ **Le basculement d'avant la correction tombait entre z13 et z14** (3 936 > 3 004,
puis 3 717 < 3 766) : c'est exactement la descente z12 → z15 à la molette que
l'attaquant décrit.

---

# ⑥ LA CONTINUITÉ — les chiffres acquis, rejoués

`scripts/sonde-d16.mjs` / `scripts/lit-sonde-d16.mjs`, **non modifiés**.

| grandeur | dépôt (rejoué ici) | après R15 |
|---|---|---|
| `dIncl` bloc MAX, **descente** | **0,000057292°** | **0,000057298°** |
| `dIncl` bloc MAX, **remontée** | — | **0,000056660°** |
| **sortie d'orbite, rapport d'altitude** | 1,0063 | **1,006346856991219** (n973) |
| `dVisee` camGlobe MAX, descente | 0,19839° | 0,23110° (**< 0,5**, aucun franchissement) |
| rapport alt. de fond MAX, descente | 1,0313 | **1,0293** |
| rapport alt. cadrage MAX | 1,0186 | 1,0187 |
| erreurs de page | 0 | **0** |

⚠️ **`dIncl` bloc et `dVisee` bloc ne PEUVENT pas bouger** : ils mesurent la
caméra du BLOC, et la correction ne touche que `camGlobe` et son plan proche.
Les deux relevés le confirment (5,7292e-5 puis 5,7298e-5 : 6e-15 d'écart).

**Et le pire saut d'altitude de fond sur une molette continue de 150 crans**
(`scripts/diag-r15-saut.mjs`, relevé à CHAQUE image par un `rAF` posé après celui
de l'application) :

| | pire rapport en une image | sauts > 1,05 |
|---|---|---|
| **dépôt** (`saut-AVANT`) | **×1,2323** | 1 |
| première rédaction (`dem.meanM` seul) | ⛔ **×3,0876** | 10 |
| **livré** (`saut-CORRIGE` / `saut-FINAL`) | **×1,1544 / ×1,1561** | 1 / 2 |

➡️ **Le livré est SOUS le dépôt**, sur le même geste et la même machine.

**Tests : 4 355 → 4 362, 4 362 passent, 0 échec. `npm run audit:tests` : 224 = 224.**
Les sept ajouts sont dans `test/frontiere-rendu.test.js`.

⚠️ **Un test du dépôt a mordu, et il avait raison** :
`test/fenetre-branchee.test.js` ①b recense les lecteurs de `lireExageration`. Ma
première rédaction en ajoutait un seizième dans `main.js` comme *repli*. **Le
repli a été supprimé plutôt que le compte relevé** : sans exagération du globe,
l'ancre reste à `R_GLOBE`, c'est-à-dire le comportement du dépôt — pas une valeur
devinée.

---

# ⑦ FICHIERS TOUCHÉS

**Modifiés (3) :**
- `src/monde/frontiere-rendu.js` — `rayonAncre()` (neuf, exporté) ;
  `poseFond` prend `altitudeAncreM` / `exageration` (**défauts 0 et 1 : les
  appelants existants sont inchangés au bit près, test ⑤**) ; `plansFond` prend
  `rayonDuSol` (défaut `R_GLOBE`).
- `src/main.js` — `altitudeAncreBlocM()` (neuf, à côté de `largeurBlocM()`) ;
  `majCameraFond()` passe `altitudeAncreM` + `exageration` à **ses deux**
  `poseFond` (caméra ET disque solaire — sinon le soleil se décale par rapport à
  la caméra) et `rayonDuSol` à `plansFond`.
- `test/frontiere-rendu.test.js` — 7 tests R15.

**Ajoutés (sondes, aucune ligne de `src/`) :**
`scripts/diag-r15.mjs`, `scripts/diag-r15-saut.mjs`, et les deux copies de
l'attaquant reprises de `C:\Dev\wt-merge` : `scripts/diag-attaque-vide.mjs`,
`scripts/sonde-attaque-d16.mjs`.

⛔ **`src/map/aerial-layer.js` et `src/map/water-layer.js` : PAS TOUCHÉS.**
⛔ `scripts/sonde-d16.mjs` et `scripts/lit-sonde-d16.mjs` : **pas touchés.**

---

# ⚠️ MES RÉSERVES

1. ⛔ **UN SEUL POSTE**, RTX 3080 / D3D11 / Chrome sans tête 1280 × 800. Pas de
   machine lente, pas de réseau lent, pas de second GPU.
2. ⚠️ **IL RESTE UN SAUT DE ×1,1561, ET JE SAIS D'OÙ IL VIENT SANS L'AVOIR
   RÉPARÉ.** Au vrai changement de bloc, le plan `y = 0` se déplace pour de bon
   (moyenne 441 → 367 → 605 → 657 → 939 → 1 149 m sur la descente de référence),
   et `_rescale` repose la caméra à la même hauteur **au-dessus du plan**, pas au-
   dessus du sol : son altitude absolue saute donc de `Δ(moyenne) × exagération`.
   **La caméra de fond ne fait que le rapporter fidèlement.** Le réparer voudrait
   dire toucher `modes.js` / `_rescale`, c'est-à-dire la grandeur que R1 interdit
   de mélanger avec `meanM` — **hors de cette tâche, et je ne l'ai pas fait.**
   Il est **plus petit qu'au dépôt** (1,1561 contre 1,2323), donc je le laisse.
3. ⚠️ **`exageration` DU GLOBE ET DU BLOC : ÉGALES, MESURÉES, PAS PROUVÉES.**
   Relevées à **2** aux deux bouts sur les sept lieux. Si elles divergeaient un
   jour, l'ancre suivrait le globe et la jambe verticale suivrait le bloc :
   **je n'ai pas mesuré ce régime.**
4. ⚠️ **`terrain.fenetreBornee.moyenneM` ET `dem.meanM` : je n'ai pas mesuré leur
   écart** quand les deux existent. Les relevés APRÈS donnent
   `camAlt − altCadrage` égal à `dem.meanM` au mètre près aux sept lieux, donc
   ils coïncident **là** — pas ailleurs, à ma connaissance.
5. ⚠️ **LE CARTOUCHE N'A PAS BOUGÉ, ET JE NE L'AI PAS VÉRIFIÉ À L'ŒIL.**
   `ancrageCartouche` appelle `poseFond` **sans** `altitudeAncreM` (test ⑥ :
   sortie identique au bit près), parce qu'il suit le repère des parois du crop,
   posé sur la SPHÈRE NUE (`parois-crop.js` §2). **C'est cohérent par lecture de
   code, pas par capture.**
6. ⚠️ **`altitudeFondRenduM()` (le crochet de `enterOrbit`) MONTE désormais de
   `moyenne × exagération`.** À la sortie d'orbite (23,5 millions de mètres)
   c'est 0,04 % et le rapport acquis 1,0063 est inchangé au 12ᵉ chiffre. **Je
   n'ai pas mesuré de sortie d'orbite depuis un plateau à 4 000 m.**
7. ⚠️ **LE MONT-BLANC À z16 REMPLIT L'ÉCRAN ET DÉBORDE PAR LE BAS**
   (`img-APRES2/mont-blanc-z16.png`). Ce n'est **pas** la correction : à z16 le
   bloc fait 1 278 m de large pour 1 028 m de relief, ×2 d'exagération — une
   aiguille de 2 km sur 1,3 km. **Le cadrage du bloc est celui du dépôt, et je ne
   l'ai pas touché.** z12 à z15 sont bien cadrés.
8. ⚠️ **JE N'AI PAS MESURÉ LA DESCENTE DEPUIS L'ORBITE AU-DESSUS DE L'HIMALAYA**
   (le scénario `ATT-himalaya` de l'attaquant, celui de la paroi terracotta). Le
   balayage z12 → z17 au Mont-Blanc en tient lieu, et il est propre — **mais ce
   n'est pas le même geste**, et la dérive de veille orbitale (1,876°/s) n'a donc
   jamais eu à être gelée dans mes essais : `flyTo` vise directement.
9. ⚠️ **LES QUATRE AUTRES RUPTURES DE L'ATTAQUANT SONT INTACTES** — clic
   ×2,2287, absence de plafond par image, machine lente, mort du crop au
   Spitzberg. **Hors périmètre, non traitées, non mesurées ici.**
