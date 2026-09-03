# PF3 — LA MER ET LES EFFETS N'EXISTENT QU'EN MODE CROP — rapport

Arbre `C:\Dev\wt-pp3`, branche `perf-crop-seul`. Base : `regroupement` à `a0b968e` (R32, PF1, PF2, PF4, PF4 bis, R33/R34 fusionnés). **`npm test` : 4 732 · 0** (4 722 de base + 10) · **`audit:tests` : 249 listés · 249 sur disque, aucun écart.**

> **Adrien, 2026-09-01 :** *« La mer et les effets n'apparaissent qu'en mode crop. »*

## 1. Ce que c'est devenu dans le code

**Un prédicat** — `dedansCrop()` (`main.js`) : `veilleCrop.pose` sous `terre unique` ; la vue de surface sans le drapeau (l'ancien bloc plat).

**Une fonction** — `poserRegimeCrop()` (`main.js`), la SEULE à écrire `aoPass.enabled` et l'opacité du grain :

```
aoPass.enabled = dedans && params.ssaoEnabled && params._aoTierOk !== false   (bâtie à la demande, dans le crop seulement)
grain.blendMode.opacity.value = dedans ? params.grain : 0
```

**Deux instants** — la naissance et la mort du crop, par un crochet neuf `surBascule(pose)` de `creerVeilleCrop` (`monde/branchement-crop.js`), appelé une fois à chacune, **jamais à un déménagement, jamais sur une image stable** (`test/regime-crop.test.js` ①). Plus les événements qui changent la DEMANDE : bascule d'occlusion et curseur de grain du panneau (`syncEffets`), gabarit (`applyLook`), palier machine (`perf.js` écrit `params` puis rappelle le régime — il n'écrit plus sur les objets), changement de mode (`setEffectsEnabled`).

**Retiré** — l'interrupteur par image de `tick()` : `aoPass.enabled = ssaoEnabled && tierOk && surface && !busy`, réécrit soixante fois par seconde, et qui allumait l'occlusion sur la planète entre 32 km et l'orbite. `test/regime-crop.test.js` ② interdit son retour (lecture de source : deux écrivains de `aoPass.enabled` — la naissance éteinte et le régime — et aucun dans `tick()`).

**Pas touché** — la profondeur de champ : **active à tous les zooms, orbite comprise (D20)**. `setEffectsEnabled` ne l'éteint plus à l'entrée en orbite ; `camEffets.near/far` restent à R34. Seul le palier machine (`perf.js`, palier ≥ 2) peut encore la couper.

**La mer** — rien à écrire : la houle, l'écume et la réfraction vivent sur la calotte du crop (`poserMer` / `retirerMer`, maillons de la chaîne du crop). Hors crop `globe._mer` est `null`, `_merRefractRT` est rendue, le grab pass n'a pas de maillage pour se déclencher — mesuré : `mer false · merRT false` à 130 km et en orbite dans toutes les cellules. L'océan hors crop est la bathymétrie peinte par le nuanceur de tuile (`dedansCrop = 0` → branches uniformes). Le nuanceur de tuile contient bien `GLSL_ECUME` (ligne 283 de `globe.js`) mais sa lecture est gardée par `dedansCrop > 0`.

**Aucun objet de scène déplacé ni recréé** par la bascule : rien à `updateMatrix()` (PF4 bis).

## 2. Le banc

`scripts/profil-pf3.mjs` (rejouable ; `profil-pf1.mjs` n'existait pas quand j'ai commencé, la mienne est décrite ici). Deux arbres servis en même temps : `C:\Dev\wt-pp3-avant` (worktree figé sur `regroupement`, port 6232) et `C:\Dev\wt-pp3` (port 6231), donc **avant et après sur la même base**, rejoués après chaque fusion.

- Chrome sans tête, ANGLE D3D11 sur RTX 3080, `--disable-frame-rate-limit --disable-gpu-vsync` (sinon toute cellule rapide rend 16,7 ms), `?cadence=pleine` (PF4 ne dessine plus qu'une image sur 2 en orbite au repos : ce banc pèse UNE image composée).
- Trois postes, **posés par valeur** : crop z13 à **4 999 m**, surface hors crop z9 à **130 000 m**, orbite **2 000 km**. Trois machines : la mienne ; CPU ×4 ; CPU ×6 + dpr 2 (le palier plafonne à pixelRatio 1,89 → 2 419×1 512). **Palier fixé à 0** et gouverneur rendu muet pour la durée du banc (sous ×4 il descendait au palier 3 en cours de relevé : pixelRatio 0,85, grain 0 — deux relevés ne mesuraient plus la même image). `window.__palierMachine` relevé : palier 0 partout.
- Par passe de `composer.passes` : temps GPU (`EXT_disjoint_timer_query_webgl2`, une requête par passe, séquentielles), temps CPU de soumission, appels et triangles (`renderer.info`, delta par passe), `enabled`. **≥ 30 images consécutives, p50/p99**, les 5 premières jetées. Témoin de validité : mêmes images à ×4 fragments (pixelRatio ×2) — valide sur « mienne » et ×4 (×2 à ×4 sur les passes plein écran) ; **non valide sur x6dpr2** (×0,3–0,7 : le pixelRatio est plafonné à 2 par `viewport.js`, ×2 ne s'applique pas) — les lignes GPU de x6dpr2 sont données mais ne se compareront pas au témoin. ⚠️ Sous CPU ×6 la carte tourne à vide 95 % du temps et rend des temps GPU gonflés d'un relevé à l'autre (5 → 24 ms sur la même scène) ; c'est la fréquence de la carte, pas le compositeur.
- Pixels : `readPixels` après `composer.render` dans la même tâche, `animations = false`, **phase du grain (`EffectMaterial.time`) remise à 0** avant capture. Témoin : deux rendus au même état = 0 pixel dans toutes les cellules.
- Erreurs GL : `getError` après chaque image composée — **0 sur toutes les images** (toutes cellules, avant comme après, ≥ 30 images chacune) : c'est le correctif de PF4, ma réorganisation n'y change rien et n'a créé aucune texture de profondeur.

## 3. Le tableau par passe et par mode — avant / après

**Ce que la chaîne contient sous `terre unique`** (vérifié dans la page) : `PasseFond[globe]` → `RenderPass[bloc]` **désactivée (0 appel, 0 triangle, 0 ms — la « seconde passe » de D16 ne coûte plus rien)** → `EffectPass(SMAA+Exposure+ToneMapping+HueSaturation+BrightnessContrast+Noise+Vignette)`. Pas de `ClearPass` (elle ne vit que sous `?terre=deux`). N8AO et la passe de profondeur de champ n'existent que quand l'utilisateur les demande.

### 3.1 Réglages par défaut (look de démarrage : grain 0,26, pas d'occlusion, pas de bokeh)

GPU p50 en ms par passe, ma machine (1 280×800) :

| poste | passe | avant | après |
|---|---|---|---|
| crop 5 km | PasseFond | 1,335 | 1,328 |
| | EffectPass finale | 0,073 | 0,072 |
| surface 130 km | PasseFond | 0,322 | 0,326 |
| | EffectPass finale (grain 0,26 → **0**) | 0,121 | 0,123 |
| orbite 2 000 km | PasseFond | 0,282 | 0,251 |
| | EffectPass finale (grain 0 → 0) | 0,112 | 0,100 |

Σ GPU p50 / temps d'image (rAF) p50 / p99, en ms — les trois machines :

| machine | poste | Σ GPU p50 avant→après | rAF p50 avant→après | rAF p99 avant→après |
|---|---|---|---|---|
| mienne | crop | 1,410 → 1,401 | 8,80 → 8,90 | 14,80 → 14,70 |
| mienne | surface | 0,443 → 0,450 | 8,90 → 8,60 | 11,20 → 13,50 |
| mienne | orbite | 0,393 → 0,353 | 7,80 → 7,90 | 11,80 → 12,60 |
| ×4 | crop | 1,407 → 1,434 | 37,50 → 37,30 | 47,20 → 57,20 |
| ×4 | surface | 1,134 → 0,980 | 40,90 → 40,70 | 57,20 → 57,20 |
| ×4 | orbite | 1,001 → 0,992 | 39,00 → 39,90 | 54,70 → 47,60 |
| ×6 dpr2 | crop | 28,19 → 28,13 | 206,9 → 209,2 | 264,5 → 290,2 |
| ×6 dpr2 | surface | 7,47 → 7,27 | 188,7 → 188,5 | 249,5 → 213,5 |
| ×6 dpr2 | orbite | 7,21 → 7,21 | 176,2 → 176,5 | 195,3 → 196,9 |

**Lecture honnête : par défaut, le gain hors crop est dans le bruit de mesure.** Le seul effet actif hors crop par défaut était le grain (0,26, look de démarrage), et il est un effet FUSIONNÉ dans la passe finale : l'éteindre change l'image (§4) mais pas le coût de la passe (§5). Le temps d'image hors crop est celui de `PasseFond` et du CPU — le terrain de PF1/PF2/PF4, pas du compositeur.

### 3.2 Effets demandés par l'utilisateur (occlusion + grain 0,2 + bokeh 4) — le cas que la règle vise

GPU p50 en ms par passe, ma machine :

| poste | passe | avant | après |
|---|---|---|---|
| crop 5 km | PasseFond | 1,334 | 1,336 |
| | N8AO | 0,141 | 0,141 |
| | DoF | 0,381 | 0,378 |
| | EffectPass finale | 0,061 | 0,062 |
| surface 130 km | PasseFond | 0,169 | 0,185 |
| | **N8AO** | **0,153 (on)** | **0 (désactivée)** |
| | DoF (D20 : reste) | 0,384 | 0,404 |
| | EffectPass finale (grain 0,2 → 0) | 0,061 | 0,076 |
| orbite 2 000 km | PasseFond | 0,265 | 0,175 |
| | N8AO | 0 (off) | 0 (off) |
| | **DoF (D20 : s'allume en orbite)** | **0 (off)** | **0,410 (on)** |
| | EffectPass finale | 0,087 | 0,075 |

| machine | poste | Σ GPU p50 avant→après | rAF p50 avant→après | rAF p99 avant→après |
|---|---|---|---|---|
| mienne | crop | 1,924 → 1,924 | 9,50 → 9,00 | 14,80 → 9,40 |
| mienne | surface | 0,770 → 0,668 | 8,60 → 8,70 | 10,20 → 13,70 |
| mienne | orbite | 0,378 → 0,657 | 8,10 → 8,40 | 13,30 → 14,20 |
| ×4 | crop | 2,958 → 2,473 | 37,80 → 38,70 | 51,10 → 53,50 |
| ×4 | surface | **3,596 → 2,580** (N8AO 0,793 → 0) | 44,20 → 41,80 | 55,90 → 54,40 |
| ×4 | orbite | 1,075 → 2,816 (DoF 0 → 1,89, D20) | 39,20 → 42,40 | 41,30 → 58,70 |
| ×6 dpr2 | crop | 29,26 → 29,14 | 196,0 → 192,7 | 292,2 → 302,6 |
| ×6 dpr2 | surface | **22,63 → 15,36** (N8AO 7,02 → 0) | 203,7 → 196,9 | 240,1 → 221,5 |
| ×6 dpr2 | orbite | 7,31 → 16,44 (DoF 0 → 9,49, D20) | 186,1 → 195,6 | 218,8 → 215,3 |

**Le gain hors crop est celui de la passe d'occlusion, qui ne tourne plus : 0,15 ms (1 280×800, RTX 3080) à 7 ms (2 419×1 512 sous ×6) par image, coût 0 après — pas « intensité 0 ».** Le crop, lui, ne bouge pas (Σ GPU identique à 1 % près, mêmes passes actives).

**L'orbite coûte PLUS après, et c'est D20, pas PF3** : la profondeur de champ que l'ancien code coupait en orbite y est maintenant active (0,41 ms ici, 1,9 ms à ×4, 9,5 ms à 2 419×1 512). C'est la règle d'Adrien du 2026-09-01 (« le flou est l'exception »), appliquée ; je l'écris pour que personne ne lise ce surcoût comme une régression de PF3.

### 3.3 GPU logiciel (SwiftShader, palier 3, pixelRatio 0,85, 1 088×680) — effets demandés

Voir §8 (relevé en cours au moment de l'écriture ; les chiffres y sont ajoutés tels quels).

## 4. Ce que voit l'œil — les pixels

**A/B dans la même session** (`--pixelab`, méthode PF4) : sur la page « après », image du régime (A), puis l'ÉTAT que l'ancien code posait rejoué à la main (grain à `params.grain` en surface / 0 en orbite, occlusion sur `ssaoEnabled && surface`, bokeh coupé en orbite), image (B), puis retour au régime. Témoin (deux rendus au même état) = 0 pixel partout ; retour au régime = 0 pixel partout.

| poste | réglages | régime → ancien code | pixels changés (> 4 niveaux) | max | moyen |
|---|---|---|---|---|---|
| **crop 5 km** | défaut | grain 0,26 → 0,26 | **0 / 1 024 000** | 0 | 0 |
| **crop 5 km** | effets | ao on, dof on, grain 0,2 → identique | **0 / 1 024 000** | 0 | 0 |
| surface 130 km | défaut | grain 0 → 0,26 | 792 604 (77,4 %) | 24 | 10,04 |
| surface 130 km | effets | ao off → on, grain 0 → 0,2 | 729 226 (71,2 %) | 56 | 7,86 |
| orbite 2 000 km | défaut | grain 0 → 0 | **0** | 0 | 0 |
| orbite 2 000 km | effets | dof on → off (D20) | 635 275 (62,0 %) | 195 | 9,50 |

**Le crop n'a pas bougé d'un pixel** : 0 sur 1 024 000, avec et sans effets. Entre deux SESSIONS (arbre avant / arbre après, même pose par valeur) le crop rend 0,004 à 7 % de pixels à moyenne < 1 niveau, concentrés sur la mer et les caustiques (phase de `uMerTemps` acquise avant le gel) — l'orbite, elle, rend **0 pixel sur 3 machines** entre sessions ; c'est pourquoi la preuve du crop est faite en session.

**Hors crop, quelque chose y était dessiné qui ne devait pas l'être — et je dis quoi :** le **grain du look de démarrage (0,26)** sur la planète à 130 km — 77 % des pixels, ±24 niveaux, un bruit neuf à chaque image (c'est aussi ce qui interdisait tout rendu à la demande : PF1 l'a vu, PF4 le débloque par le même geste) ; et, quand l'utilisateur l'a demandée, **l'occlusion ambiante N8AO sur la planète** (`aoRadius` 2,2 en unités de globe = 140 km de rayon : un assombrissement qui n'a aucun sens à cette échelle). En orbite, la différence est le bokeh rallumé (D20).

## 5. Le grain à opacité 0 : « une passe à intensité 0 coûte son plein prix » — mesuré

Le grain n'est pas une passe, c'est un effet fusionné dans le programme de la passe finale (tons, SMAA…), qui doit tourner de toute façon. A/B en session (protocole R31 : 40 rendus de chauffe après chaque recompilation, ordre tournant, différences appariées, médiane) — A = grain présent à opacité 0 (ce que fait le régime hors crop), B = grain EXCLU du programme (`BlendFunction.DST`, postprocessing 6.39 ne l'intègre pas) :

| relevé | 1 280×800 | 2 419×1 512 |
|---|---|---|
| base R32+PF2+PF4 | +0,014 ms (14,5 % de la passe, tours 0,074–0,124 ms) | −0,24 ms (bruit : −15 %) |
| base précédente | +0,004 ms (3,8 %) | +0,117 ms (7,6 %) |
| base finale | +0,005 ms (3,9 %, tours 0,072–0,306 ms) | — |

**Le plein prix du grain à 0, c'est 4 à 15 centièmes de milliseconde sur une passe de 0,07–0,12 ms** — sous le bruit de la minuterie sur x6dpr2. Un second programme (une `EffectPass` sans `NoiseEffect`, `enabled` en alternance) coûterait une compilation au premier basculement — une marche visible à la bascule pour gagner 0,01 ms. Je ne l'ai pas fait, et c'est écrit dans `poserRegimeCrop`.

## 6. La bascule — sans marche

Descente à la molette depuis 130 km à travers `SEUIL_NAISSANCE_M` (32 274 m), remontée à travers `SEUIL_MORT_M` (40 343 m), pixels changés d'une image à la suivante (> 4 niveaux, sur 1 024 000), effets demandés :

| | image −3 | −2 | −1 | **bascule** | +1 | +2 | +3 |
|---|---|---|---|---|---|---|---|
| avant, naissance (31 936 m) | 264 140 | 250 586 | 250 672 | **1 020 941** | 388 732 | 151 161 | 143 080 |
| après, naissance (31 895 m) | 295 024 | 265 456 | 253 539 | **1 022 579** | 241 223 | 102 602 | 111 308 |
| avant, mort (40 500 m) | 112 993 | 140 249 | 144 858 | **1 021 010** | 210 429 | 126 891 | 115 997 |
| après, mort (40 407 m) | 98 785 | 122 419 | 143 220 | **1 021 352** | 208 910 | 96 162 | 102 507 |

Même chose par défaut (grain 0 ↔ 0,26) : 1 022 801 / 1 021 788 à la naissance, 1 021 727 / 1 022 230 à la mort. **L'image de la bascule repeint tout l'écran avant comme après (99,8 %)** — c'est la naissance du crop elle-même (parois, fond, estompage) ; ce que le régime ajoute dans cette même image (occlusion, grain) ne se distingue pas dans le compte, et les images ±3 sont au fond de mouvement (p50 43–53 k px avec effets, 291–307 k par défaut). **Aucune image supplémentaire de marche, aucun fondu nécessaire** : l'état du compositeur change dans l'image où le crop apparaît, jamais dans une autre. (Le relevé « après » ci-dessus est sur la base finale ; « avant » sur la base R32+PF2+PF4 — la bascule ne dépend d'aucun des deux.)

## 7. Ce que j'ai cru, puis réfuté

1. **« La mer simulée tourne peut-être hors crop »** — non : elle est un maillon de la chaîne du crop, `globe._mer` est `null` hors crop, la cible de réfraction est rendue. Il n'y avait rien à couper ; il fallait le mesurer et le dire.
2. **« Le compositeur porte encore une seconde caméra + `ClearPass` pour un sprite »** — plus depuis D16-a : `RenderPass[bloc]` est désactivée (0 appel), `ClearPass` n'existe que sous `?terre=deux`. Coût 0 ; vérifié dans la page, pas dans le fichier.
3. **« Une passe à intensité 0 coûte son plein prix »** — vrai pour une passe (N8AO : 0,15–7 ms, maintenant 0), **faux pour un effet fusionné** : le grain à 0 vaut 0,004–0,014 ms. Le remplacer par un second programme aurait coûté une compilation à la bascule.
4. **« `flyTo` / `_rescale` placeront la caméra »** — `__exp.flyTo(lat, lon, 9)` depuis la surface laisse la caméra à **NaN** (camY, altM) — un défaut à donner à PF4/caméra ; `_rescale` en mode continu ne déplace pas la caméra. La molette, elle, posait chaque relevé à une altitude différente (5 668 vs 5 020 m) et, pire, à une **exagération** différente (les ancres de l'échelle continue dépendent des crans visités) : 80 % de pixels différents entre deux « mêmes » poses. La pose est maintenant posée par valeur, par itération sur `altitudeCadrageM()` (`__exp.dem` est nul sous `terre unique`).
5. **« Deux images figées sont comparables entre sessions »** — le grain avance `EffectMaterial.time` à chaque image AVANT le gel : 78 % de pixels « changés » sur deux images identiques. Remis à 0 avant capture. Et même ainsi, seule l'orbite est déterministe entre sessions (mer, nuages, caustiques) : la preuve du crop est faite en session.
6. **« Le palier est fixe pendant un relevé »** — sous ×4 le gouverneur descendait au palier 1 puis 3 en cours de banc (pixelRatio 0,85, grain 0). Palier fixé à 0 et gouverneur muet pendant le banc ; `__palierMachine` relevé à part.
7. **« Le premier chargement après `npm run dev` est comme les autres »** — vite ré-optimise ses dépendances au premier chargement et recharge la page en cours de pose : un relevé entier faux (crop absent, 16 tuiles). Le serveur est chauffé par deux requêtes avant tout banc.
8. **« Le temps GPU par passe se compare d'un relevé à l'autre »** — pas sous ×6 : la carte, sollicitée 5 % du temps, rend 5 ms ou 24 ms pour la même scène selon sa fréquence. Les comparaisons tiennent sur « mienne » et ×4 ; sur x6dpr2 seul l'état des passes (on/off) et les pixels sont probants.
9. **`GL_INVALID_OPERATION` par image** — 0 erreur sur toutes les images de toutes les cellules : c'est le correctif de PF4 (SMAA sans DEPTH), pas le mien ; ma réorganisation ne crée aucune texture de profondeur.

## 8. GPU logiciel et A/B du grain sur la base finale

(section remplie ci-dessous par le relevé, tel quel)

### 8.1 GPU logiciel — SwiftShader (Vulkan, Subzero), palier 3, pixelRatio 0,85, 1 088×680, effets demandés, 12 images

La minuterie du pilote n'y rend pas toujours (`undefined` sur le crop) ; ce qui compte ici est le **temps d'image** (rAF), tout est sur le CPU. Le poste crop y est resté à 8 889 m (l'itération sur `altitudeCadrageM()` n'a pas pris sur ce pilote) — même pose avant et après.

| poste | état avant → après | rAF p50 avant → après | rAF p99 avant → après |
|---|---|---|---|
| crop 8,9 km | ao on, dof on, grain 0,2 (identique) | 623,7 → 616,7 ms | 705,7 → 634,3 ms |
| **surface 130 km** | ao **on → off**, grain 0,2 → 0, dof on | **621,9 → 559,6 ms (−10 %)** | 653,8 → 588,6 ms |
| orbite 2 000 km | dof **off → on** (D20), ao off, grain 0 | **291,0 → 538,4 ms (+85 %)** | 300,1 → 557,1 ms |

**Sur une machine sans carte, hors crop, la passe d'occlusion coûtait 62 ms par image ; elle coûte 0.** Et la même mesure dit ce que D20 coûte là où PF1 a dit que ça pèse : **la profondeur de champ active en orbite vaut +247 ms par image sur GPU logiciel** (0,41 ms sur RTX 3080). Ce n'est pas mon périmètre — c'est la règle de l'exception — mais c'est le chiffre qu'il faut avoir sous les yeux avant de laisser le bokeh allumé par défaut sur un portable sans carte (il est éteint par défaut : `bokehEnabled: false`, et le palier ≥ 2 le coupe).

### 8.2 A/B du grain sur la base finale (1 280×800, RTX 3080)

Tours A (grain présent à opacité 0) / B (grain exclu du programme) : 0,114/0,091 · 0,306/0,091 · 0,106/0,100 · 0,095/0,101 · 0,094/0,099 · 0,072/0,079 ms — **médiane des différences appariées +0,005 ms, 3,9 % de la passe finale**. Même conclusion que §5 : le grain à 0 ne vaut pas un second programme.

## 9. Commits (branche `perf-crop-seul`, au-dessus de `regroupement` a0b968e)

- `7e45e44` PF3 : la mer et les effets n'existent qu'en mode crop — un prédicat, une fonction, pas d'interrupteur par image (branchement-crop, main, perf, effects-panel, test/regime-crop, sonde)
- `de97153`, `e46c90d`, `f56e4af`, `b665228`, `c4e4e82` : fusions successives de `regroupement` (R34, PF1, PF4, R32+PF2, PF4 bis) — conflits sur la liste de tests de `package.json` et sur la ligne `warmupPrograms(...)` (accalmie de PF4 + état initial du régime), résolus en gardant les deux
- le dernier commit : la sonde `scripts/profil-pf3.mjs` (pose par valeur, phase du grain, cadence pleine, `--pixelab`, `--grainAB`, `--swiftshader`) et ce rapport

## 10. À donner aux autres

- **PF4 / caméra** : `__exp.flyTo(lat, lon, 9)` depuis la surface laisse `camera.position` et `modes.altM` à **NaN** (reproduit deux fois sur l'arbre figé, `animations = false`). Non corrigé ici, hors périmètre.
- **D20** : la profondeur de champ active en orbite coûte **+247 ms par image sur GPU logiciel** (0,41 ms sur RTX 3080, 1,9 ms à ×4, 9,5 ms à 2 419×1 512). Le bokeh est éteint par défaut et le palier ≥ 2 le coupe ; à garder en tête si un gabarit l'allume.
- **PF4 (rendu à la demande)** : hors crop le grain est maintenant à 0 — plus de bruit neuf par image hors crop ; dans le crop, il reste ce qu'Adrien règle.
