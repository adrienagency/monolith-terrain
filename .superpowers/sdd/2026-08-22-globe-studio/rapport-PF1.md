# RAPPORT PF1 — LE PROFIL : qui consomme, chiffré, sur une machine lente

Branche `perf-profil`, arbre `C:\Dev\wt-pp1`, 2026-09-01. Aucune ligne de `src/`
touchée. Le banc est `scripts/profil-pf1.mjs` ; ses relevés bruts sont sous
`traces-PF1/` (un JSON par machine, `pf1-<machine>.json`, plus le premier
passage `profil-2026-09-01-19-53-34.json`).

## 0. Le banc — ce qu'il est, en quoi il diffère de la production

- **Chrome sans tête 152** (`--headless=new`), ANGLE D3D11 sur **RTX 3080**,
  `--disable-frame-rate-limit --disable-gpu-vsync` (sinon toutes les cellules
  rendent 16,7 ms), viewport **1280×720**, serveur `vite` sur le port 6210 (dev,
  pas le build). Lieu : La Réunion (−21,115 ; 55,536), le crop z13 de R31.
- **Trois postes** : surface hors crop **129 960 m** (`altitudeCadrageM`, cible
  130 000, écart 0,0 %), crop **5 000 m** (écart 0,0 %, `globe._crop` posé),
  orbite **2 000 000 m** (`modes.altM`, écart 0,0 %). Trois **machines** :
  `mienne` (×1, densité 1) · `x4` (CDP `setCPUThrottlingRate` 4, **mesuré ×4,31**
  par boucle JS calibrée) · `x6r` (×6, **mesuré ×6,64–6,73**, `deviceScaleFactor`
  2 ⇒ tampon **2560×1440**). Plus un profil **GPU logiciel** (`--use-angle=swiftshader`,
  palier machine 3 ⇒ pixelRatio 0,85, tampon 1088×612).
- **Palier fixé à 0** (`aq.setTier(0, true)`, `aq.update` neutralisé) après
  relevé : `window.__palierMachine.palier` = 0 sur D3D11, **3 (ESSENTIEL)** sur
  SwiftShader ; `signaux.ecran` rend **[800, 600]** en sans-tête (pas [0, 0]
  comme dans le panneau de session : c'est l'écran virtuel).
- **Par cellule** : 40 images de chauffe jetées, **60 images consécutives** en
  quatre phases — ANIMÉ (état actuel : rotation propre, houle, grain),
  PASSES (une requête GPU par passe), FIGÉ (`params.animations = false` ⇒
  `dtAmb = 0`), MOUVEMENT (0,25°/image en orbite, 0,3 % de la distance par image
  en surface). GPU par `EXT_disjoint_timer_query_webgl2`, une requête par
  `composer.render` ou par passe. CPU par enveloppes **exclusives** (pile) sur
  ce que `__exp` expose et sur les prototypes du globe ; `tick` = total du rappel
  rAF, `reste` = ce que les enveloppes ne nomment pas ; le décodage des tuiles
  court **hors du tick** (microtâches) et est compté à part.
- ⚠️ **Le banc n'était pas seul sur la machine** : 17 à 33 processus Chrome
  d'autres agents (PF3 lançait sa propre sonde, une `vite build` tournait) ont
  cohabité avec les passages. **Les cellules ×4/×6 varient jusqu'à ×1,8 d'un
  passage à l'autre** (x4 surface : 12,3 puis 21,7 ms). Ce qui est stable entre
  les deux passages, et c'est la livraison, c'est **la répartition** — le même
  consommateur en tête, dans le même ordre. Les deux passages sont donnés ;
  **la valeur la moins favorable fait foi**.

## ① Le budget d'une image — cadence p50 / p99 (ms), état actuel (animé)

| poste | mienne (×1) | x4 (×4) | x6r (×6 + pixelRatio 2) | GPU logiciel (SwiftShader) |
|---|---|---|---|---|
| **orbite 2 000 km** | 2,6 / 10,7 (p1 : 1,8 / 6,0) | **31,9 / 60,2** (p1 : 16,0 / 34,7) | 22,0 / 48,7 (p1 : **49,1 / 76,9**) | — (voir § 0, relance) |
| **surface 130 km** | 2,7 / 9,9 (p1 : 2,3 / 11,0) | **21,7 / 35,5** (p1 : 12,3 / 14,8) | **32,6 / 51,9** (p1 : 33,1 / 52,3) | cadence 3,6 / 10,2 mais **GPU 290 / 321** |
| **crop 5 km** | 4,9 / 9,9 (p1 : 3,6 / 7,1) | 12,8 / 16,5 (p1 : 14,1 / **31,6**) | **48,5 / 248,7** (p1 : 25,1 / 36,2) | — |

`p1` = premier passage (même banc, moins d'enveloppes). Tick CPU p50 des cellules
lentes : x4 15,2 / 10,1 / 15,2 ms ; x6r 24,2 / 35,6 / 15,0 ms (surface / crop /
orbite). **GPU p50 sur la RTX 3080 : 0,21 à 2,71 ms dans toutes les cellules.**

**La lecture** : sur une carte D3D11 réelle, **l'image est bornée par le CPU
principal, pas par le GPU**, à tous les postes — le GPU tient dans 1 à 6 % de
l'image. La machine « portable Retina lent » (×6 + densité 2) est à **30–50 ms
par image (20–30 i/s)** au repos ; Google Earth y tient 60. Sur GPU logiciel,
c'est l'inverse : 290 ms de fragments par image (**3,4 i/s**), dont **85 % dans
`PasseFond`** (le nuanceur des tuiles) et 15 % dans la passe d'effets.

Décomposition par cellule (moyennes, ms, part de la cadence moyenne) :

| cellule | cadence moy | tick | `rendu.objets` | `composer.render` hors dessin | `globe._traverse` | `reste` | hors-tick (décodage + maillage) | GPU p50 |
|---|---|---|---|---|---|---|---|---|
| x4 surface | 21,6 | 15,2 | **7,79 (36 %)** | 4,61 (21 %) | 1,48 (7 %) | 1,24 (6 %) | 0 | 0,21 (1 %) |
| x4 crop | 12,9 | 10,1 | 2,39 (19 %) | 2,62 (20 %) | 0,34 (3 %) | **3,41 (26 %)** | 0 | 0,79 (6 %) |
| x4 orbite | 32,3 | 15,2 | **7,57 (23 %)** | 5,51 (17 %) | 1,46 (5 %) | 0,89 (3 %) | **3,11 (10 %)** | 0,27 (1 %) |
| x6r surface | 32,7 | 24,2 | **13,37 (41 %)** | 5,79 (18 %) | 2,07 (6 %) | 1,90 (6 %) | 0 | 0,85 (3 %) |
| x6r crop | 75,7 | 35,6 | 11,60 (15 %) | 13,65 (18 %) | 2,54 (3 %) | **21,00 (28 %)** | 0 | 2,71 (4 %) |
| x6r orbite | 24,4 | 15,0 | **7,07 (29 %)** | 4,59 (19 %) | 1,30 (5 %) | 0,85 (3 %) | 0,89 (4 %) | 1,45 (6 %) |

`rendu.objets` = `WebGLRenderer.renderBufferDirect` : le coût **par objet
dessiné** (setProgram, téléversement des uniformes, draw). `composer.render`
hors dessin = tout `renderer.render` qui n'est pas un objet : `updateMatrixWorld`
de la scène, `projectObject`, tri, lumières. Les autres enveloppes (modes,
controls, nuages, sommets, bateaux, eau, étiquettes, trafic, `aq`, ombres…)
pèsent **chacune < 1 ms sur ×6**, sauf `nuages.update` au crop (0,6–3,7 ms).

**GPU par passe** (moyenne, ms) — trois passes dans le compositeur, deux actives
(`0:PasseFond` = `RenderPass(sceneGlobe)`, `1:RenderPass(off)` = l'ancienne
`passeSurface`, `2:EffectPass[SMAA+Exposure+ToneMapping+HueSaturation+
BrightnessContrast+Noise+Vignette]`). Ni N8AO ni DOF n'étaient dans la chaîne
(`bokehEnabled: false`, `ssao` faux au palier 0) :

| cellule | PasseFond | EffectPass | dessin (appels / triangles) |
|---|---|---|---|
| mienne surface / crop / orbite | 0,45 / 0,59 / 0,45 | 0,19 / 0,61 / 0,09 | 103 / 24 / 64 appels · 117 k / 138 k / 122 k tri |
| x6r surface / crop / orbite | 0,96 / 2,75 / 1,17 | 2,22 / 1,39 / 1,55 | 93 / 24 / 66 appels |
| SwiftShader surface | **291,1** | **53,2** | 90 appels · 117 k tri |

⚠️ **Le témoin de validité** (×4 rendus dans une requête ⇒ ×N de temps) rend
×1,6 à ×4,1 **sur la machine non ralentie** — la minuterie mesure bien des
fragments, pas la soumission. **Sous ralentissement CPU, il rend ×5 à ×175** :
la requête `TIME_ELAPSED` englobe les trous pendant lesquels le GPU attend un
CPU ×4/×6. Les colonnes GPU des cellules ralenties sont donc des **bornes
supérieures** — et elles restent minuscules, ce qui suffit à la conclusion.

**Mémoire** : tas JS 270–570 Mo (`usedJSHeapSize`, plat sur 20 s : le
ramasse-miettes tient). Côté GPU (`renderer.info.memory`) : surface 160 textures
/ 165 géométries, crop 163–184 / 143–155, **orbite 297 → 637 textures** et
269 → 600 géométries **pendant la cellule** : le cache passe de 602 à **982
tuiles** sans que l'utilisateur touche à rien (voir ③). Une tuile ≈ 256 Ko de
texture RGBA8 + 256 Ko de hauteurs Float32 + un canevas 256² retenu par
`CanvasTexture` ≈ 0,75 Mo ; `cacheMax` 1 700 ⇒ jusqu'à ~1,3 Go.

**Réseau (CDP `Network.*`)** : démarrage 394–422 requêtes, 46,8–60,2 Mo ;
pose surface 130 km 314–322 req, 29–41 Mo (**35–49 s** sur ×4/×6) ; crop 39–47
req, 13–15 Mo ; orbite 191–244 req, 15–19 Mo. **Au repos en orbite : 20–41
requêtes par 60 images** (la rotation propre). En mouvement (15° d'orbite) :
21–64 requêtes pendant le geste et **102–132 après** qu'il a cessé, 9,5–13,5 Mo.

## ② Le classement des consommateurs (part du temps d'image, moyenne ×4/×6)

**Surface 130 km et orbite 2 000 km** (même ordre dans les six cellules, et dans
les deux passages) :

1. **Le dessin des tuiles, objet par objet — 23 à 41 %.** 64–103 appels par
   image, **une instance de matériau par tuile** (330 à 637 `ShaderMaterial`
   vivants, **128 uniformes chacun**). Le profil V8 le nomme : `uniformMatrix4fv`
   11–13 % des échantillons, `WebGLUniforms.upload` 9 %, `setProgram` 2 %,
   `drawElements` 2 %. Soit ≈ 21 µs réels par appel de dessin.
2. **`renderer.render` hors dessin — 17 à 21 %.** `updateMatrixWorld` seul vaut
   5–9 % des échantillons V8 : `scene.updateMatrixWorld()` recompose la matrice
   de **chaque** maillage de tuile, visibles ou non (346 à 982 par image), puis
   `projectObject` les parcourt tous (2 %).
3. **`globe._traverse` — 5 à 7 %** (+ `_enfantsPresents` 2 % V8), 1,3–2,1 ms
   sur ×6 pour 374–982 tuiles visitées.
4. **Le chargement, en orbite seulement — 10 %** (`_buildMesh` hors tick 2,7 ms
   ×4 ; `getImageData` 0,4 ; `_pump` 0,7) — entretenu par la rotation propre.
5. Le GPU — 1 à 6 %. Tout le reste — modes, controls, nuages, sommets, eau,
   étiquettes, `aq`, ombres (la carte d'ombre n'est pas redessinée : 0,01 ms) —
   **< 4 % cumulés**.
6. Ce qui n'est ni JS ni GPU (cadence − tick − GPU : 6 à 16 ms sur ×4/×6) : la
   composition, le `present`, le ramasse-miettes.

**Crop 5 km** — l'ordre change :

1. **`reste` — 26 à 28 %** : le profil V8 le nomme **`contexteCrop` (main.js:5937)
   : 14,1 % des échantillons**, appelé **à chaque image** par `veilleCrop.maj`
   (`branchement-crop.js:887`) uniquement pour recomposer une signature
   `lat|lon|zoom|tuilesParBloc` — en construisant tout le contexte d'habillage
   (`environnementEffectif`, masques, matières…) au passage.
2. `renderer.render` hors dessin 18–20 % (le cache garde **406–442 tuiles** au
   crop pour **24 appels** : `updateMatrixWorld`/`projectObject` les parcourent
   toutes ; scissor/bindFramebuffer/blit 9 % V8).
3. `rendu.objets` 15–19 %. 4. `nuages.update` 4–5 %. 5. GPU 4–6 %.

## ③ Le coût du « rien »

| cellule | ANIMÉ (état actuel) p50 | FIGÉ (`dtAmb = 0`) p50 | ce que coûte l'animation ambiante | l'écran change-t-il ? |
|---|---|---|---|---|
| x4 orbite | 31,9 | 17,2 | **+14,7 ms** (la rotation propre : 36 req / 60 images, +252 tuiles, `_buildMesh` 2,7 ms/image) | animé : oui · figé : **non** |
| x6r orbite | 22,0 | 20,8 | +1,2 (p1 : 49,1 → 30,0, +19) | oui · **non** |
| x4 surface | 21,7 | 22,4 | 0 (bruit) | oui · **non** |
| x6r surface | 32,6 | 24,4 | +8,2 (p1 : 0) | oui · **non** |
| x4 crop | 12,8 | 13,4 | 0 (bruit) | oui · **non** |
| x6r crop | 48,5 | 24,3 | +24 (transitoire, voir ⑤-9) | oui · **non** |
| mienne crop | 4,9 | 4,5 | +0,4 | oui · **non** |

« L'écran change-t-il » : somme de trois images **consécutives de la boucle de
l'application** lues par `readPixels`. Animé, elles diffèrent toutes (grain,
houle, rotation). Figé, **elles sont identiques au bit** dans les neuf
cellules — et l'application les a pourtant rendues, à 13–24 ms de CPU chacune.

**Ce que vaudrait le rendu à la demande** : au repos figé, **100 % du tick**
(13 à 24 ms par image sur ×4/×6, soit un cœur entier à 40–75 i/s) et 100 % du
GPU. Mais **à l'état actuel il n'y a jamais de repos** : la rotation propre
(`main.js`, `applyAxisAngle(UP, dtAmb × 0,035)` après 3 s) change l'image et
**charge des tuiles** — en 20 s d'orbite immobile, 160–180 tuiles et 114–130
textures de plus, 20–41 requêtes par 60 images. Et le grain de film (`Noise`)
change chaque pixel à chaque image même caméra fixe. Un rendu à la demande n'a de
sens qu'avec ces deux-là gelés au repos ; Google Earth n'a ni l'un ni l'autre.

## ④ Ce que font Google Earth et Cesium, et que nous ne faisons pas — chiffré ici

| technique | ce qu'on fait aujourd'hui | poste attaqué | gain plausible, depuis ces mesures |
|---|---|---|---|
| **Rendu à la demande** (`requestRenderMode`, GE ne rend pas sans changement) | `grep requestRenderMode\|needsRender` = 0 ; boucle rAF inconditionnelle | tout le tick au repos | **13–24 ms/image → 0** au repos sur ×4/×6 (③), à condition de geler grain + rotation propre au repos ; aucun gain en mouvement |
| **Un matériau partagé, peu d'uniformes par tuile** (Cesium : un programme par fournisseur, uniformes par tuile en dizaines ; GE : un nuanceur) | 330–637 matériaux, 128 uniformes chacun, 64–103 draws | `rendu.objets` 23–41 % | `uniformMatrix4fv` + `upload` = **20–22 % des échantillons V8** ; un matériau partagé + `onBeforeRender` pour 4–6 uniformes par tuile en rend l'essentiel : **≈ 15–25 % de l'image** ; le fusionnement des draws (un atlas) irait plus loin |
| **Tuiles statiques** (`matrixAutoUpdate = false`, culling en amont) | matrices recomposées chaque image pour 346–982 maillages, visibles ou non | `composer.render` hors dessin | `updateMatrixWorld` **5–9 %** de l'image ; le cache au crop (406–442 tuiles pour 24 draws) double la traversée |
| **SSE** (erreur d'espace-écran : `géoErreur × h / (2 d tan(fov/2))` > 2 px) | `chord / dist > 0,38`, **aveugle au fov et au viewport** — à fov 30°, h 720 c'est ≈ 2 px/texel ; à densité 2 (h 1 440) **le même nombre de tuiles (374 = 374)** | qualité, pas temps | **0 ms gagné** ici : une vraie SSE chargerait *plus* sur Retina (×2 en 1 440 lignes) et *moins* sur un téléphone. C'est un levier de justesse ; le levier de perf est en dessous |
| **File de priorité par distance au centre de l'écran + tronc de vue, en tas** | priorité = `ratio` (corde/distance, pas le centre de l'écran) ; **`queue.sort` à chaque `shift` dans la boucle `while` de `_pump`** ; frustum + horizon dans `_traverse` (fait) | `_pump` + tuiles hors champ | `_pump` 0,5–1,2 ms/image en orbite ×4/×6, **8,2 ms** dans une image lente ; un tas ou un tri unique par image : −2 % ; le centre d'abord ne change pas le temps, il change ce qui arrive **premier** (la demande d'Adrien) |
| **Annulation des requêtes hors champ** | `_purgerFile` ne purge que sous contre-pression, qui **ne se déclenche jamais** (`_refusFile` = 0, `PLAFOND_FILE` 256 jamais atteint) ; `AbortController` refusé (justifié : `_tileMemo` partagé) | réseau + `_buildMesh` | après 15° d'orbite, **102–132 requêtes sur 134–196 (≈ 70–84 %) arrivent une fois le geste fini** ; purger la file à chaque image (pas seulement sous pression) supprime ces tuiles et leurs 0,8–4,5 ms/image de maillage |
| **Décodage hors du fil principal** (Worker + `createImageBitmap`) | `createImageBitmap` (hors fil, fait) puis **`getImageData` + `_buildMesh` sur le fil principal** | hors-tick 10 % en orbite | **3,1 ms/image ×4, jusqu'à 4,8 ms ×6** pendant un mouvement ; p99 6,5 ms. Un Worker rend ces images à leur cadence de repos |
| **Compression de textures GPU** (KTX2/BC, Cesium ; GE : formats natifs) | `CanvasTexture` RGBA8 256², sans mipmap (terrarium : la mip corromprait les hauteurs) | mémoire GPU, pas temps | les hauteurs ne se compressent pas en lossy ; un canal **R16/float** (÷2) ou une texture de hauteurs partagée + bande passante réduite ; **0 ms sur le tick**, 160–640 textures → −50 % de VRAM |
| `preserveDrawingBuffer` off · `powerPreference: 'high-performance'` | déjà : non posé (défaut false) · déjà posé (`main.js:1168`) | — | 0 |
| **Fusion des passes** | faite pour `terre unique` (`fusionDesPasses` : `PasseFond` + une `EffectPass` de sept effets ; `passeSurface` désactivée, plus de `ClearPass`) | GPU | GPU RTX ≤ 2,7 ms : rien à prendre ; **sur GPU logiciel l'EffectPass vaut 53 ms (15 %) et `PasseFond` 291 ms (85 %)** : c'est le nuanceur de tuile, pas la chaîne, qui coûte sur un GPU faible |

**Le comparatif en une ligne** : Google Earth sur portable à GPU intégré tient
60 i/s parce qu'il **ne rend rien au repos**, dessine ses tuiles avec **un**
nuanceur et des uniformes par tuile comptés sur les doigts, et **ne charge pas
ce qu'on ne regarde plus**. Ici, au repos, un portable ×6 dépense 24 ms par
image pour redessiner une image identique, dont 41 % à re-téléverser 128
uniformes par tuile, et charge 160 tuiles en 20 s pour une rotation que
personne n'a demandée.

## ⑤ Les bugs qui coûtent — pour PF4

1. **`GL_INVALID_OPERATION` (0x502) à chaque image, attribué à la passe** : après
   `2:EffectPass` — le blit de profondeur `DEPTH_COMPONENT24 → 32F` déjà tracé.
   Présent dans les 9 cellules ; **la console de Chrome n'en montre rien**
   (`glConsole` = 0) — seul `gl.getError()` après la passe le voit.
2. **`contexteCrop()` reconstruit à chaque image au crop** (`main.js:5937`, appelé
   par `branchement-crop.js:887` pour une signature) : **14,1 % des échantillons
   V8 au crop**, le cœur du `reste` 26–28 %. Un cache sur `(centre, zoom)` ou une
   signature calculée sans le contexte le rend à ~0.
3. **`_pump` trie la file à chaque `shift`** (`globe.js:7707`, `sort` dans le
   `while`) : O(n log n) par tuile tirée, 0,5–1,2 ms/image en orbite ×4/×6, 8,2 ms
   dans une image lente.
4. **La rotation propre charge sans fin** : +252 tuiles / 60 images en orbite ×4,
   +160–180 tuiles et +114–130 textures par 20 s de repos, 20–41 requêtes par 60
   images ; le cache va vers `cacheMax` 1 700 (~1,3 Go) sans geste.
5. **Un matériau par tuile, 128 uniformes** (`_buildMesh`) : le premier
   consommateur (23–41 %). Pas un bug de logique, un bug de coût.
6. **Aucune tuile en `matrixAutoUpdate = false`** : 346–982 recompositions de
   matrice par image pour des objets qui ne bougent jamais (5–9 % V8).
7. **Le cache ne se vide pas au crop** : 406–442 tuiles gardées pour 24 draws ;
   traversée, `updateMatrixWorld` et `projectObject` les paient toutes.
8. **Le décodage des hauteurs et le maillage sur le fil principal**
   (`getImageData` + `_buildMesh`) : 3–5 ms/image en mouvement sur ×4/×6, p99 6,5.
9. **Transitoire au crop sur ×6** : premier passage 25,1 / 36,2 ms, second
   **48,5 / 248,7 ms avec 27 tâches longues (3,3 s) dans les 60 premières
   images**, disparues à la phase suivante (24,3 / 34,5). Les trois images les
   plus lentes : `reste` 117 ms + `composer.render` 75 ms + `_traverse` 18 ms.
   Soit un travail différé qui suit l'arrivée au crop (analyse de relief,
   cuisson), soit la charge concurrente du moment. **Non reproduit, non
   tranché** — à rejouer sur machine calme : `node scripts/profil-pf1.mjs
   --machines x6r --postes crop`.
10. **La profondeur de champ est ÉTEINTE dans toutes les cellules**
    (`bokehEnabled: false` au démarrage) : ce profil ne contient pas le DOF que
    D20 veut à tous les zooms. PF3 doit le peser en le rallumant
    (`params.bokehEnabled = true` puis relancer la sonde).
11. **Pas de recompilation en usage** : `renderer.info.programs` stable dans
    chaque cellule (23–28) ; les p99 ne viennent pas des nuanceurs.
12. **Pas d'allocation notable dans la boucle** : tas plat sur 60 images et sur
    20 s ; les p99 (7–11 ms sur ×1) sont des images où `rendu.objets` passe de
    1 à 6–8 ms — un blocage de soumission côté pilote, pas du JS.

## La sonde rejouable

    npm run dev -- --port 6210 --strictPort
    node scripts/profil-pf1.mjs --port 6210                  # 3 machines × 3 postes, ~12 min
    node scripts/profil-pf1.mjs --machines x6r --postes crop # une cellule
    node scripts/profil-pf1.mjs --cpuprofile                 # + le profil V8 par poste
    node scripts/profil-pf1.mjs --swiftshader --images 20    # + le GPU logiciel (long)

Sortie : un JSON par exécution (`traces-PF1/profil-<date>.json` ou `--sortie`),
et le tableau ① sur la sortie standard. Pour un avant/après : deux exécutions,
même port, même machine **calme**, et comparer `cellules[].anim.cadence` et
`cellules[].anim.cpu` — les enveloppes ont les mêmes noms d'une exécution à
l'autre. `puppeteer-core` n'est pas dans `package.json` ; le script le cherche
dans `node_modules` puis dans `C:/Dev/wt-*/node_modules`.

## Ce que j'ai cru, puis réfuté

- **Que mes sous-minuteries donnaient le tick.** La pile exclusive rendait
  `tick` = 0,00 ms (tout le temps allait aux enfants). Corrigé : `tick` en total,
  `reste` en exclusif. Le premier passage porte cette erreur ; ses cadences
  restent valables, ses `tick` ne le sont pas.
- **Que `altitudeCadrageM()` disait l'altitude en orbite.** Elle a rendu
  **−5 786 m** à 2 000 km : en orbite seule `modes.altM` fait foi. Les cellules
  d'orbite du premier passage étaient bien à 2 000 km (vérifié dans le JSON),
  mais marquées « non comparables » à tort.
- **Que « deux rendus à la main identiques » prouvait l'inutilité de l'image.**
  Animé ou figé, deux `composer.render(0)` consécutifs rendent la même image —
  parce que `dt = 0` dans les deux. La seule preuve est sur **la boucle de
  l'application** : animé, trois images consécutives diffèrent ; figé, elles sont
  identiques. C'est celle du ③.
- **Que le témoin GPU > ×4 était une erreur de minuterie.** Il l'est sous
  ralentissement CPU (×5 à ×175 : la requête englobe les attentes du GPU), pas
  sur ×1 (×1,6–4,1). Les colonnes GPU ralenties sont des bornes supérieures ; la
  conclusion « le GPU n'est pas le goulot sur une carte réelle » tient dans les
  deux sens.
- **Que le GPU compterait sur machine lente.** Sur la RTX, ≤ 2,7 ms dans neuf
  cellules ; c'est le CPU principal qui borne. Il faut un GPU logiciel pour
  inverser (290 ms). Un GPU intégré réel est entre les deux ; **c'est là, et
  seulement là, que les coupes de fragments de PF3 rapportent**.
- **Que « le crop tourne 36 tuiles » (socle).** Le crop **dessine 24 objets** et
  **garde 406–442 tuiles en cache** ; le chiffre du socle est un nombre de draws
  d'une autre époque, pas l'occupation. Les traversées paient l'occupation.
- **Que le premier passage suffisait.** Les cellules ×4 ont bougé de ×1,8 sous
  la charge des autres agents ; la répartition n'a pas bougé. Un chiffre de ce
  rapport se compare **à un chiffre de la même sonde sur une machine calme**, pas
  à lui-même d'un jour à l'autre.
- **Que la console signalerait les erreurs GL.** Zéro message pour une erreur
  par image ; il faut `getError()` après chaque passe.
