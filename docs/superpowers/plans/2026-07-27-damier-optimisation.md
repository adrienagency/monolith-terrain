# Damier de blocs — rapport de mesure et plan d'optimisation

**Date** : 2026-07-27
**Cas mesuré** : recherche « Le Var » → isoler → zoom z11 (8 dalles) → z12 (23 dalles + centre).
Mode Naturel, résolution centrale 1024, source Mapterhorn (tuiles 512 px), MNT 1536².

---

## Le résultat en une phrase

**Le damier n'est pas lent parce qu'il calcule trop, il est lent parce qu'il
redemande 6 145 fois au réseau ce qu'il a déjà.** 96 % des requêtes du damier
sont des doublons. Le reste — géométrie, textures, mémoire — coûte cher aussi,
mais rien n'approche ce facteur-là.

| | mesuré |
|---|---:|
| temps pour bâtir un damier de 24 dalles | **101 s** |
| requêtes émises | **6 405**, dont **260 uniques** |
| dont une seule tuile bathy demandée | **2 070 fois** |
| tas JS au pic | **1 762 Mo** (1 980 Mo relevé sur un damier détruit) |
| CPU bloquant, fil principal | ≈ **41 s** cumulées |

---

## La réponse à la proposition d'Adrien

> « Un bloc central qui serait un composant au niveau de tout ce qui doit être
> utilisé par les autres blocs. »

**C'est déjà vrai pour le plus coûteux, et ça ne rapporte plus rien.** Le
programme GLSL compilé est unique : les 24 matériaux résolvent tous vers le
programme n° 61 (`usedTimes = 16`), parce que la clé de cache — les 31 753
caractères d'`onBeforeCompile` — est identique. Le matériau des murs de socle
est partagé aussi. `renderer.info.programs` passe de 27 à 32 en ajoutant 23
dalles : les cinq programmes de plus ne sont pas des variantes de terrain.

**Ce qui reste à mutualiser est réel mais modeste** : 51 Mo et 1,9 s (§3.1).
**Ce qui ne peut pas l'être** — les six samplers d'emprise — pèse 34,25 Mo sur
les 36,4 Mo de textures d'une dalle. Là le levier n'est pas le partage, c'est
la **taille** : ces textures sont taillées 4 à 5 fois plus fin que le maillage
qui les porte.

Autrement dit : l'idée est juste, elle a déjà été appliquée là où elle payait
le plus, et le gisement d'économies est ailleurs.

---

## Où part le temps

### Une dalle, décomposée

| phase | ms |
|---|---:|
| réseau, 9 tuiles terrarium 512 px | 207 |
| décodage + terrarium → Float32 | 13 |
| **sous-total « charger un MNT »** | **220** |
| `_buildCell` bloquant | **960** |
| — dont `_buildAnalysis` | **387** |
| — dont `rebuild()` procédural **jeté aussitôt** | **176** |
| — dont `rebuild()` avec MNT | 148 |
| — dont `_buildSeaMask` | 81 |
| — dont rugosité + rampe, **refaites à l'identique** | 80 |
| **attente réelle par dalle** | **≈ 4 300** |

Le MNT coûte 220 ms à charger et la dalle en attend **4,3 s**. L'écart est
l'embouteillage réseau : 6 405 requêtes concurrentes se mettent en file.

### Tout le travail CPU est sériel, sur le fil principal

Cadence observée : une dalle toutes les ~4,3 s, arrivées à 15,7 s / 25,0 s /
29,5 s / 35,9 s / … / 101,4 s.

---

## Où part la mémoire

### Par dalle voisine (55,4 Mo)

| poste | Mo |
|---|---:|
| `uCoastMask` 2048² RGBA | 16,00 |
| `uAnalysis` 1536² RGBA + mips | 12,00 |
| géométrie (385² sommets, 294 912 tri) | 9,59 |
| MNT `Float32Array` 1536² | 9,00 |
| `uRegionMask` 1024² | 4,00 |
| `uSeaMask` 1536² R8 | 2,25 |
| rugosité + bump 512² | 2,00 |
| murs de socle | 0,40 |
| rampe 512×64 | 0,13 |

Bloc central (résolution 1024) : ≈ **125 Mo**, dont 68,09 Mo de géométrie pour
2 097 152 triangles.

| état | total ≈ | tas JS mesuré |
|---|---:|---:|
| 1 dalle | 110 Mo | 190 Mo |
| 9 dalles | 570 Mo | **791 Mo** |
| 24 dalles | 1 400 Mo | **1 599 Mo**, pic **1 762 Mo** |

Sur un Chrome 64 bits la limite pratique est de 2 à 4 Go. **Le damier plein
flirte avec le plafond du navigateur** — c'est la raison la plus sérieuse
d'agir, devant la vitesse.

---

## Le plan, ordonné par gain mesuré sur risque

### Phase 1 — Le réseau · gain ≈ 75 s sur 101 s, 92 % des requêtes

C'est **quatre-vingts pour cent du bénéfice total** pour la plus petite
surface de code. À faire avant tout le reste ; les phases suivantes ne se
mesureront correctement qu'une fois celle-ci passée.

**T1 · Dimensionner le cache de MNT sur le damier réel.**
Aujourd'hui : `DEM_CACHE_BYTES = 32 Mo`, un MNT en tuiles 512 px pèse
9 437 184 o, donc `⌊32·1024²/9 437 184⌋ = 3 → max(4, 3) = 4 entrées`.
Vérifié à l'exécution : `blockGrid._demCache.size === 4` pendant que
`this.cells` détient **207 Mo** de MNT vivants. On protège 32 Mo de cache
devant 207 Mo déjà en mémoire. Le cache doit être borné par le **nombre de
dalles du damier** (25), pas par un budget d'octets hérité d'un autre usage.
→ *Conséquence mesurée aujourd'hui : 322 appels de `_loadCellDem` pour 23
dalles, facteur 13,6.*

**T2 · Mémoriser les tuiles bathy trouvées, pas seulement les échecs.**
`loadBathyPatch` ne mémorise que `bathyMisses`. Une tuile **trouvée** est
re-téléchargée à chaque MNT : **2 070 requêtes pour un seul fichier**. Et elle
est attendue avant que `loadDem` ne rende la main.

**T3 · Dédupliquer les requêtes en vol.**
Une table des promesses en cours, clé = URL. Le cache actuel garde des
promesses non résolues puis les évince, ce qui relance le même chargement.

**Vérification de phase** : nombre de requêtes et durée totale pour le damier
du Var à z12. Cible : moins de 500 requêtes, moins de 30 s.

---

### Phase 2 — Le travail jeté · gain ≈ 10 s CPU, 230 Mo de churn

**T4 · Ne pas construire la géométrie procédurale qu'on va remplacer.**
`_buildCell` fait `new Terrain(p)` — qui `rebuild()` **sans MNT** (bruit FBM
sur 148 225 sommets, 176 ms, 9,59 Mo) — puis `setDem()` et `rebuild()` à
nouveau. Compteurs : `Terrain.rebuild` **46 appels pour 23 dalles**,
`rebuildRoughness` **46 pour 23**, `rebuildRamp` **46 pour 23**.
→ 4,2 s et 230 Mo d'allocations jetées sur un damier plein.

**T5 · Annuler les chargements devenus inutiles.**
`_syncId` invalide le *résultat* mais aucun `fetch` : il n'y a pas d'
`AbortController` dans `dem.js`. Mesuré : passer en mode isolé a déclenché
**31 `_buildCell` pour 8 dalles finales** (23 construites pour rien, 22 s de
CPU), et un changement de zoom a détruit un damier de 23 dalles déjà bâties
(tas 1 980 → 798 Mo).

---

### Phase 3 — La taille des textures · gain ≈ 480 Mo

Une voisine est maillée à 384 (6,9 sommets par unité-monde) et porte un masque
côtier en 2048² (36,6 px/unité) et une analyse en 1536² (27,4 px/unité).

**T6 · Diviser par deux le côté des textures de dalle voisine.**
→ −12 Mo/dalle sur le côtier (**−276 Mo**), −9 Mo/dalle sur l'analyse
(**−207 Mo**), et ~290 ms de CPU en moins par dalle sur `_buildAnalysis`
(387 ms aujourd'hui, 9,3 s sur le damier).

**T7 · Ne pas rasteriser un masque de découpe uniforme.**
Mesuré sur le contour du Var (12 polygones, 2 304 sommets, grille 40×40 par
dalle) : couverture moyenne **83 %**, et **15 dalles sur 25 sont couvertes à
100 %**. Leur masque 1024² est uniformément blanc. 14 voisines + le centre
paient **72 Mo pour encoder un seul bit**.
→ Un booléen remplace la texture quand la dalle est pleine ou vide.

*Un atlas unique, en revanche, ne rapporte rien : les 24 masques couvrent des
emprises différentes, il n'y a pas de redondance de contenu. Ce serait un choix
de résolution (7,3 px/unité contre 18,3 aujourd'hui), pas une déduplication.*

---

### Phase 4 — Le partage résiduel · gain 51 Mo + 1,9 s

**T8 · Partager rampe, rugosité et bump depuis le bloc central.**
Vérifié en comparant les `image.data` de deux cellules : `uRampTex` (512×64)
et `roughnessMap` (512²) sont **identiques octet pour octet** — le seed de
rugosité est `params.seed + 777`, commun à tous. `bumpMap` est un `clone()` :
il partage le tableau en RAM mais reste une **texture GPU distincte**, donc un
second téléversement de 1 Mo.
→ 2,13 Mo × 24 = **51 Mo**, et 80 ms de CPU par dalle payés **deux fois**.

**T9 · Mutualiser le matériau et les uniformes constants.**
24 `MeshPhysicalMaterial` distincts, chacun avec 78 uniformes dont 7 samplers.
**68 des 78 sont strictement identiques d'une dalle à l'autre** (couleurs,
contours, grille, fx, mer, scan, brume, matière). Ne sont réellement propres à
un bloc que `uBlockOffset` et les six samplers d'emprise.
→ ≈ 3 700 téléversements d'uniformes par frame évités.
*Chantier plus délicat : à faire en dernier, et seulement si les phases
précédentes n'ont pas suffi.*

---

### Phase 5 — La jupe · gain ≈ 5 s

**T10 · Mémoriser le tracé par dalle.**
`rebuildRegionSkirt` retrace **toutes** les dalles à chaque arrivée, le
plancher étant commun. Coût mesuré d'un `traceSkirt` sur un masque 1024² à
`SKIRT_GRID = 300` : 10,7 ms de `getImageData` + 7,8 ms de marching squares
(360 000 taps bilinéaires) + 1,6 ms d'échantillonnage = **≈ 20 ms/dalle**.
Croissance des tâches longues observée : 82 → 118 → 180 → 243 → 306 → **398
ms**, soit ~16 ms par dalle — les deux mesures concordent.
→ ∑ 20·n pour n = 1..23 ≈ **5,5 s** aujourd'hui, **0,5 s** si le tracé est
mémorisé par dalle (il ne dépend que du masque et du sampler de cette dalle).

---

## Ce qu'il ne faut PAS faire

**Ne pas commencer par le rendu.** À 8 dalles la scène tient les 61 fps
(bridés vsync). Une dalle ajoute 6,2 draw calls et 575 259 triangles par frame
— la scène est parcourue ~2 fois (passe principale + ombres). Le damier plein
aligne 6,78 M triangles contre 2,10 M pour le bloc central, soit 3,2 fois le
héros pour du contexte, mais **le rendu n'est pas le goulot** : le chargement
l'est.

**Ne pas chasser les dalles hors zone.** `cellsForParts` fait son travail : sur
le Var à z12, la seule dalle vide (2,2) n'est pas créée. La perte réelle est de
17 % de surface peinte puis rejetée en fragment. C'est le poste le plus faible.

**Ne pas s'inquiéter de la VRAM avant la RAM.** Après `clear()`, seules 17
géométries et 90 textures sur 23 dalles étaient réellement résidentes GPU : le
culling écarte 8 blocs sur 24. La pression VRAM est bien moindre que les
1,4 Go de RAM — mais ce 1,4 Go, lui, est réel.

---

## Ce qui n'a pas pu être mesuré

1. **fps réel à 23 dalles.** Le panneau a cessé de compositer en cours de
   session. Les chiffres à 0 et 8 dalles sont mesurés en `requestAnimationFrame`
   et fiables ; **les 208 draw calls et 17,6 Mtri à 23 dalles sont une
   extrapolation** du delta par dalle.
2. **La VRAM réelle du pilote** — aucune extension WebGL de mesure disponible.
3. **`rasterizeMask` et `rebuildRegionSkirt` en direct** : ce sont des closures
   de `main.js`, non patchables depuis la console. Le coût de jupe vient d'une
   réimplémentation fidèle, recoupée avec la croissance des tâches longues.
4. **La répartition des 4,3 s d'attente** entre latence réseau et file
   d'attente du navigateur.
5. `PerformanceObserver('longtask')` a **sous-compté** (7,2 s rapportées contre
   22 s chronométrées directement), l'onglet étant en arrière-plan. Les
   wrappers directs font foi.

---

## Hors damier, mais sur le même chemin critique

Pendant le vol vers Le Var, le globe a émis **1 222 requêtes AWS z3–z7 pour
501 URL uniques** (721 doublons). Et une requête Overpass a duré **43,8 s**
(3 requêtes, 130 s cumulés — c'est la recherche de sommet, déjà repoussée hors
du chemin de la recherche). Ce n'est pas `block-grid.js`, mais ça occupe la
même connexion et le même fil pendant que le damier se construit.
