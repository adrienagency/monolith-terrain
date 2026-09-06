# PA — OÙ PART LE TEMPS D'IMAGE AUJOURD'HUI

**Commit mesuré : `f558ed8`** (« Fusion MER2 : la mer se coupe a plat a la jupe,
la houle hors emprise n'est plus calculee »), branche `perf-mesure`, arbre
`C:\Dev\wt-pa`. `git diff -- src/` **vide**. Tous les chiffres de ce rapport
sortent de cette base-là, relevés le 2026-09-04. **Aucun n'est recopié d'un
rapport antérieur.**

## Le banc, écrit d'abord — c'est lui qui se compare, pas le seul chiffre

| | |
|---|---|
| machine | Chrome sans tête (`--headless=new`), **ANGLE / NVIDIA RTX 3080, D3D11** — lu, pas supposé |
| toile | **1600 × 1000, densité 1** (`renderer.getPixelRatio() === 1`) |
| serveur | **Vite de développement**, `127.0.0.1:8711` — modules non minifiés. ⚠️ **Le coût JS est donc un majorant** ; le coût GPU, lui, est identique à la production. |
| réseau | **localhost** — le réseau est gratuit sur ce banc, seuls les **octets** et le **nombre de requêtes** se transportent |
| régime | écran d'accueil renvoyé (Échap, centre de la vue vérifié = `CANVAS`), pointeur en mouvement continu pendant TOUTE la mesure |
| relevé | **320 à 5 600 images consécutives par scène**, jamais une seule ; p50 / p95 / p99 / max |
| instruments | `scripts/banc-pa-budget.mjs`, `scripts/sonde-pa-emprise.mjs`, `scripts/sonde-pa-densite.mjs` — **enveloppes posées à l'exécution depuis la page, aucune ligne de `src/` touchée** |

**Cinq scènes**, pas trois : la carte **qu'on laisse tranquille** et la carte
**qu'on manipule** ne sont pas le même régime (la veille du repos met le crop
seul dès que l'échelle cesse de bouger), et confondre les deux aurait été la
faute la plus facile de ce banc.

① `orbite` · ①bis `orbite-geste` (glissé continu) · ② `descente` (vol vers
Chamonix 45,92 / 6,87 z12) · ③ `crop` (posé, au repos) · ③bis `crop-geste`
(glissé continu dans le crop).

**Deux bancs de cadence** : `vsync` (60 Hz, le régime de l'écran d'Adrien) et
`sans vsync` (`--disable-gpu-vsync --disable-frame-rate-limit`, pour voir le
plafond réel). **Deux bancs de CPU** : ×1 et ×4
(`Emulation.setCPUThrottlingRate`).

---

## ① LE BUDGET D'UNE IMAGE, POSTE PAR POSTE

### CPU ×1, vsync 60 Hz — le régime d'aujourd'hui sur la machine d'Adrien

| scène | images | période p50 / p99 | **CPU fil principal p50 / p99** | GPU p50 / p99 | appels | triangles | tas JS |
|---|---|---|---|---|---|---|---|
| ① orbite | 483 | 16,7 / **17,0** ms | **2,5 / 5,9** ms | 3,03 / 5,02 ms | 53 | 222 943 | 226 Mo |
| ①bis orbite-geste | 483 | 16,7 / 16,8 | **2,4 / 4,6** | 2,53 / 4,13 | 51 | 207 621 | 299 Mo |
| ② descente | 718 | 16,7 / **83,6** | **2,7 / 99,3** | 3,26 / 6,34 | 47 | 104 201 | 376 Mo |
| ③ crop | 486 | 16,7 / 16,9 | **3,0 / 6,9** | **5,70 / 6,67** | 47 | 104 177 | 260 Mo |
| ③bis crop-geste | 483 | 16,7 / 16,8 | **2,9 / 5,0** | 5,32 / 6,55 | 46 | 102 809 | 267 Mo |

**Sur cette machine, hors descente, l'application tient les 60 images/s sans
jamais rater une image** — période p99 = 16,9 ms, c'est-à-dire le vsync lui-même.
Elle consomme **3 ms de fil principal et 5,7 ms de GPU sur un budget de
16,7 ms : 52 % de marge**.

### CPU ×4, vsync 60 Hz — le proxy « machine quatre fois plus lente »

| scène | période p50 / p99 | **CPU p50 / p99** | GPU p50 / p99 | tâches longues (n / la plus longue) |
|---|---|---|---|---|
| ① orbite | 16,7 / **33,2** | **8,2 / 29,1** | 4,55 / 11,91 | 0 |
| ①bis orbite-geste | 16,7 / **33,4** | **10,2 / 35,1** | 3,69 / 10,09 | 0 |
| ② descente | 16,7 / **400,1** | **11,4 / 413,9** | 3,18 / 11,20 | **20 / 1 995 ms** |
| ③ crop | 16,7 / **116,7** | **20,9 / 113,7** | 4,05 / 13,41 | **6 / 102 ms** |
| ③bis crop-geste | 16,7 / **33,4** | **15,1 / 37,1** | 4,02 / 9,11 | 0 |

**À ×4, le crop passe sous les 60 i/s : 20,9 ms de CPU pour 16,7 ms de budget.**
La cadence effective tombe à **31,8 i/s** dans le crop et **24 i/s** pendant la
descente. **Et le GPU n'a pas bougé** (4 ms) : c'est le fil principal, seul, qui
a mangé le budget.

### La répartition du fil principal, par scène (moyennes par image)

Postes mesurés par enveloppe **sur les fonctions elles-mêmes**, jamais par une
sonde posée après ; « reste de `tick` » est la différence entre le temps CPU
total de l'image et la somme des postes nommés.

**③ crop, CPU ×4** (image de 20,9 ms) :

| poste | moy | p99 | part |
|---|---|---|---|
| `composer.render` (rendu + chaîne de post-traitement) | **7,30 ms** | 23,0 | 35 % |
| `veilleCrop.maj` → `contexteCrop` | **4,19 ms** | 9,9 | 20 % |
| `globe.update` (parcours du quadtree, streaming, maillage) | 1,39 ms | 4,2 | 7 % |
| `clouds.update` | 0,46 ms | 2,2 | 2 % |
| `modes.update` + `controls.update` + `places.refresh` + cartouches | 0,92 ms | — | 4 % |
| reste de `tick` (estompage, seuil, mer du crop, caméra de fond, mise au point, matrices) | 18,05 ms\* | — | — |

\* la somme des postes dépasse la moyenne CPU parce que le « reste » est calculé
sur la moyenne et que la scène contient six à-coups de 50 à 102 ms ; l'ordre de
grandeur des postes nommés, lui, est stable.

**② descente, CPU ×4** (image de 11,4 ms p50, 414 ms p99) : `composer.render`
4,33 ms · `veilleCrop.maj` 1,59 ms (**p99 5,0 ms, et jusqu'à 160 ms sur une image
à ×1**) · `globe.update` 0,90 ms · **reste 32 ms** — et ce reste, c'est la
construction du bloc, détaillée au §③.

**① orbite, CPU ×4** : `composer.render` 5,05 ms · `globe.update` 0,89 ms ·
`veilleCrop.maj` **0,02 ms** (le crop n'existe pas) · reste 9,0 ms.

### Le GPU — mesuré, pas estimé

`EXT_disjoint_timer_query_webgl2` **est disponible** sur ce contexte et a été posé
autour de `composer.render()` (donc **jusqu'au rendu, pas jusqu'au `return`** :
le téléversement des sommets et les passes de post-traitement sont dedans).
**Zéro événement `GPU_DISJOINT` sur l'ensemble des bancs** — les relevés sont
valides.

⚠️ **Deux lectures du GPU coexistent et diffèrent d'un facteur 10 sur la MÊME
scène** : l'orbite rend **3,03 ms** à 60 Hz et **0,30 ms** sans vsync. Ce n'est
pas le travail qui change, c'est **l'état d'horloge de la carte** : à 60 i/s sur
une scène légère, la 3080 redescend en veille et chaque image se paie plus cher.
Les deux chiffres sont vrais dans leur régime ; **c'est celui à 60 Hz qui décrit
ce qu'Adrien a sous les yeux**, et c'est celui du tableau.

---

## ② LE VERDICT « BORNÉ PAR QUOI », PAR SCÈNE

| scène | CPU ×1 | CPU ×4 | le vrai patron |
|---|---|---|---|
| ① **orbite** | **rien ne borne** — 2,5 ms CPU + 3,0 ms GPU sur 16,7 (marge 66 %) | **CPU** (8–10 ms), GPU 4 ms | **fil principal**, et il est déjà loin du plafond |
| ② **descente** | **fil principal**, par à-coups : p50 2,7 ms mais **19 tâches longues, la plus longue 482 ms** | **fil principal**, **1 995 ms** de blocage | **fil principal, en une seule tâche** — la construction du bloc |
| ③ **crop** (travail) | **GPU**, de peu : 5,7 ms GPU contre 3,0 ms CPU | **CPU**, franchement : 20,9 ms contre 4,05 ms | **ça bascule avec la machine** — voir ci-dessous |

**La part de chacun, dans le crop, CPU ×1, 60 Hz** : GPU 5,7 ms (34 % du budget),
fil principal 3,0 ms (18 %), **inactif 48 %** — le profil V8 le confirme
indépendamment (`(idle)` 77 % du temps échantillonné). **Réseau : nul** (3
requêtes en 8 s). **Mémoire : stable** (260 Mo de tas, 332 géométries,
353 textures, aucune dérive sur les cinq scènes).

**La bascule est le résultat le plus utile de ce banc.** Le crop est
**borné par le GPU sur une machine rapide** et **borné par le fil principal dès
que la machine ralentit d'un facteur 4** — et les deux bornes ne se soignent pas
avec les mêmes remèdes. Toute proposition qui ne dit pas *pour quelle classe de
machine* elle est faite se trompera de moitié des utilisateurs.

### Ce que le GPU paie vraiment : des PIXELS, pas des triangles

**47 appels de dessin et 104 000 triangles** : c'est dérisoire. Une carte de 2015
avale ça. Si le GPU met quand même 5,7 ms, ce n'est donc pas la géométrie.
Balayage de la densité de rendu, **même session, même pose, seule la densité
change** (`scripts/sonde-pa-densite.mjs`, sans vsync pour que la carte reste à
pleine horloge) :

| densité | toile | pixels | **GPU p50** | CPU de `composer.render` | appels | triangles |
|---|---|---|---|---|---|---|
| 0,50 | 800 × 500 | 0,40 Mpx (×0,25) | 0,82 ms (**×0,24**) | 0,5 ms | 47 | 104 201 |
| 0,75 | 1200 × 750 | 0,90 Mpx (×0,56) | 1,92 ms (**×0,56**) | 0,5 ms | 47 | 104 153 |
| 1,00 | 1600 × 1000 | 1,60 Mpx (×1,00) | 3,42 ms (×1,00) | 0,5 ms | 47 | 104 141 |
| 1,50 | 2400 × 1500 | 3,60 Mpx (×2,25) | 8,41 ms (**×2,46**) | 0,5 ms | 47 | 104 117 |
| 2,00 | **2427 × 1517** (plafonné) | 3,68 Mpx (×2,30) | 6,05 ms (×1,77) | 0,6 ms | 47 | 104 177 |

**Le temps GPU suit la surface rendue, presque au coefficient près : environ
2,1 ms par mégapixel.** Le CPU du rendu, lui, ne bouge pas d'un dixième. La
scène est **bornée par le fragment**, c'est-à-dire par la chaîne de
post-traitement et les nuanceurs de surface — **pas par le nombre de tuiles, pas
par les appels de dessin**.

⚠️ **Et le plafond proportionnel d'`applyRenderSize` fonctionne** : demander une
densité 2 sur cette toile ne rend pas 6,4 Mpx mais 3,68 — le garde-fou mord déjà.

---

## ③ LES CINQ POSTES LES PLUS CHERS, NOMMÉS AU FICHIER ET À LA FONCTION

Temps **propre** (self time) du fil principal, profileur V8 par échantillonnage
à 200 µs, CPU ×4.

### 1. `contexteCrop` — `src/main.js:6204`

**12,3 % du fil principal dans le crop au repos (1 173 ms sur 9,5 s), 14,7 % dans
le crop qu'on manipule (1 286 ms).** C'est le **premier poste JS nommé de
l'application en régime de travail**, devant tout le reste.

Il est appelé **à chaque image** par `veilleCrop.maj`
(`src/monde/branchement-crop.js:1001`), qui construit l'objet entier, en dérive
une signature `lat|lon|zoom|tuilesParBloc`, et **dans l'immense majorité des
images constate que la signature n'a pas changé**. L'enveloppe mesurée sur la
porte donne **4,19 ms par image en moyenne à ×4 (p99 9,9 ms), soit 20 % de
l'image**. En orbite, le même poste vaut **0,02 ms** : tout ce coût naît avec le
crop.

### 2. `composer.render` — la chaîne de post-traitement et la traversée de scène

**35 % de l'image dans le crop à ×4 (7,30 ms).** Son temps propre se décompose,
au profil, en `uniformMatrix4fv` (jusqu'à **33,9 %** du fil principal en régime
sans vsync), `setProgram`, `projectObject`, `updateMatrixWorld`
(`node_modules/three` → `chunk-5FLUPYUX.js:30634 / 30377 / 4784`) : c'est
**la traversée du graphe de scène et la pose des uniformes, rejouées passe après
passe**, pour 47 appels de dessin seulement.

### 3. La construction du bloc — le poste le plus cher de la descente

Sur les 14,5 s de descente à ×4, temps propre :

| fonction | fichier | ms | part |
|---|---|---|---|
| `noise` | `src/noise.js:41` | **1 417** | 9,8 % |
| `natGris` | `src/monde/eclairage-crop.js:154` | **989** | 6,8 % |
| `gridNormals` | `src/grid-normals.js:76` | **530** | 3,7 % |
| `pousse` | `src/plinth.js:280` | 396 | 2,7 % |
| `_tuileLaPlusFine` | `src/globe.js:7411` | 276 | 1,9 % |
| `resampleCatmullRom` | `src/bathy.js:645` | 251 | 1,7 % |
| `_ecrireRelief` | `src/terrain.js:2411` | 238 | 1,6 % |
| `sampleHeights` | `src/globe.js:3825` | 214 | 1,5 % |
| `fbm` | `src/noise.js:98` | 197 | 1,4 % |
| `buildSlabWalls` | `src/plinth.js:232` | 174 | 1,2 % |
| `fuseBathymetry` | `src/bathy.js:264` | 163 | 1,1 % |

**Soit 4,8 secondes de fil principal sur 14,5 — un tiers de la descente**, et
c'est **du calcul par sommet en JavaScript synchrone** : bruit, teinte par
sommet, normales, parois de plinthe, fusion bathymétrique.

### 4. `getBoundingClientRect` via `projectionSaisie` — `src/main.js:13824`

**10,1 % du fil principal (868 ms sur 8,6 s) pendant un glissé en orbite.** La
fonction lit la boîte du canevas **à chaque échantillon de pointeur** ; chaque
lecture force une remise en page synchrone. Ce poste n'existe **que** pendant un
geste — c'est-à-dire exactement quand on ne peut pas se permettre de le payer.

### 5. `globe.update` — `src/globe.js:8977` (et `_traverse` `:9219`,
`_enfantAcquis` `:9673`, `_tuileLaPlusFine` `:7411`)

**0,9 à 1,4 ms par image à ×4** — 7 % de l'image dans le crop, 1,9–2,8 % du
profil en orbite. **Le parcours du quadtree n'est pas le problème** : il est
propre, borné, et coûte cinq fois moins que `contexteCrop`. C'est un résultat
utile en soi, parce que c'est là que l'intuition envoie chercher.

---

## ④ LA PLUS LONGUE TÂCHE UNIQUE DE CHAQUE SCÈNE — celle qu'Adrien RESSENT

`PerformanceObserver` sur les `longtask`, à 60 Hz.

| scène | CPU ×1 | CPU ×4 | ce qui la compose |
|---|---|---|---|
| ① orbite / ①bis orbite-geste | **aucune** | **aucune** | — |
| ② **descente** | **19 tâches, la plus longue 482 ms** (puis 272, 167, 149) | **20 tâches, la plus longue 1 995 ms** (puis 811, 435, 388, 376) | la construction du bloc (§③.3) **et** `veilleCrop.maj`, mesuré à **160,8 ms sur une seule image** (une autre à 42,8 ms, une autre à 38,0 ms) |
| ③ crop | **aucune** | **6 tâches, la plus longue 102 ms** | `contexteCrop` + `composer.render` |
| ③bis crop-geste | aucune | aucune | — |

**Une seule scène produit des à-coups, et c'est la descente.** L'image la plus
chère du banc ×1 est à **530 ms de fil principal**, dont **38 ms dans
`veilleCrop.maj`** et **8,2 ms dans `composer.render`** — le reste étant la
construction du bloc. À ×4, la même chose dure **deux secondes pleines** : ce
n'est plus un à-coup, c'est un gel.

⚠️ **`veilleCrop.maj` à 160 ms sur une image, c'est la pose du crop.** Quand la
signature change (naissance ou déménagement), `poserTout` → `rafraichirForme` →
`rafraichirHabillage` s'exécutent **dans l'image**, sans découpage. Le crop est
né **3 fois** pendant le vol de référence (`cropBascules = 3`) : pas de
clignotement, mais **trois blocages de cet ordre** par descente.

---

## ⑤ RÉSEAU ET MÉMOIRE

**Réseau, compté par le protocole CDP** (`Network.loadingFinished`) — jamais par
`getEntriesByType('resource')`, qui plafonne à 250 entrées.

| fenêtre | requêtes | octets | nature |
|---|---|---|---|
| démarrage (jusqu'à la pose) | **405** | **48,6 Mo** | 272 modules JS (banc de développement), 61 png, 18 jpg, 16 webp |
| ① orbite (8 s) | 91 | 6,2 Mo | 91 png (tuiles d'altitude) |
| ②&nbsp;**descente (14 s)** | **332** | **41,8 Mo** | **261 png d'altitude**, 67 webp, 1 json |
| ③ crop (8 s) | 3 | 0,6 Mo | — |

**42 mégaoctets et 332 requêtes pour une descente de quatorze secondes.** Sur
localhost c'est gratuit ; sur une ligne à 20 Mbit/s, ces mêmes octets demandent
**dix-sept secondes** — le réseau deviendrait alors la borne de la scène ②, et
lui seul. ⚠️ **Ce banc ne peut pas le prouver** (il tourne en local) ; ce qu'il
établit, c'est le **volume**, qui, lui, se transporte.

⚠️ **Un signe que le streaming est lui aussi bridé par le fil principal** : à
CPU ×4, la même descente ne tire plus que **170 requêtes / 15,0 Mo** dans la même
fenêtre — **trois fois moins**. Ce n'est pas le réseau qui a ralenti, c'est le
fil qui n'a plus eu le temps de réclamer.

**Mémoire.** Tas JS de **226 à 376 Mo** selon la scène, **sans dérive** sur
l'ensemble d'un banc (orbite 226 → crop 260 → crop-geste 267). `renderer.info` :
**332 géométries, 353 textures, 28 programmes** — le nombre de programmes reste
constant, donc **aucune recompilation de nuanceur en régime**. **La mémoire ne
borne rien**, sur aucune des cinq scènes.

⚠️ **Sauf un point, qui mérite d'être posé** : dans le crop, la scène retient
**2 053 268 triangles invisibles pour 253 586 visibles** — 5 objets pesant
1 268 116 triangles dans `scene` (le bloc de surface, caché derrière le crop) et
394 objets pesant 785 152 triangles dans `sceneGlobe`. Rien de tout cela n'est
dessiné, donc rien de tout cela ne coûte une image ; mais **c'est huit fois plus
de géométrie résidente que de géométrie utile**, et c'est de la mémoire vidéo.

---

## ⑥ CE QUI A DÉJÀ ÉTÉ GAGNÉ AUJOURD'HUI — remesuré, pour savoir d'où l'on part

⛔ **Je n'ai PAS construit l'arbre d'avant les fusions du jour, donc je ne
publie aucun delta.** Ce serait la faute que ce chantier a déjà payée : un
chiffre d'« avant » recopié d'un rapport dont le banc n'est plus celui-ci. Ce qui
suit est **l'état du jour, relevé** (`scripts/sonde-pa-emprise.mjs`, Chamonix
z12, crop posé, au repos) — c'est le point de départ que les deux autres agents
doivent utiliser.

| grandeur | relevé sur `f558ed8` |
|---|---|
| crop posé | oui, **zoom 12**, fenêtre **3 × 3** tuiles, centre 45,9206 / 6,8994 |
| **naissances du crop sur un vol complet** | **3** (`cropBascules`) — pas de clignotement ; la porte de repos ne bascule pas en boucle |
| état de repos atteint | oui (`cropRepos = true`) après ~26 s sans geste |
| maillage du crop | **131 072 triangles** (un seul objet) |
| **`crop-mer`** (la mer coupée à la jupe) | **10 232 triangles** — **7,8 % du maillage du crop** |
| `crop-parois` | 13 260 triangles |
| `cloud-shell` | 12 096 triangles |
| tuiles de globe dessinées | **38**, feuilles à **z13**, 1 344 triangles chacune |
| calottes `cap-n` / `cap-s` | 2 208 triangles chacune |
| **par image, effectivement dessiné** | **47 appels · 104 177 triangles** |
| géométries / textures / programmes | 332 / 353 / **28** |

**Ce qu'il faut retenir de cette section : le budget géométrique est déjà réglé.**
La mer ne pèse plus que 10 000 triangles, le crop tient en un objet, et
l'application ne fait plus que **47 appels de dessin par image**. Continuer à
tailler dans les triangles ne rendra rien — le §② dit pourquoi : **le GPU paie des
pixels, et le CPU paie `contexteCrop` et la construction du bloc.**

---

## ⑦ CE QUE J'AI CRU, PUIS RÉFUTÉ

**1. « Le crop a un à-coup de 100 ms toutes les 200 ms. » — FAUX, c'était mon
banc.** Le premier relevé montrait, dans le crop, un pic régulier de **100 à
370 ms passé DANS `composer.render`, avec un GPU à 2,5 ms** : 34 tâches longues
en 8 secondes, 67 pendant un geste. J'ai failli écrire que c'était la panne
qu'Adrien ressent. **Cause réelle : `--disable-frame-rate-limit`.** À 300–600
images/s le tampon de commandes du pilote sature et le fil principal se met à
bloquer dans un appel GL quelconque — le profil montrait d'ailleurs `disable`,
`frontFace`, `depthMask` et `bindTexture` en tête du temps propre, ce qui n'a
aucun sens pour du travail réel. **Le même banc, vsync rendu : p99 CPU 6,9 ms,
zéro tâche longue.** L'à-coup n'existait que parce que je mesurais.

**2. « L'image dessine 1 appel et 1 triangle. » — Le compteur était remis à zéro
sous ma sonde.** `renderer.info` s'auto-réinitialise à **chaque** `render()` ;
lu après `composer.render()`, il ne rend que la dernière passe de
post-traitement — un quad plein écran. Mon premier tableau annonçait donc
sérieusement « 1 appel, 1 triangle » par image. Corrigé par
`renderer.info.autoReset = false` et une remise à zéro manuelle, une fois par
image, **après** lecture. La vraie valeur est **47 à 53 appels**.

**3. Mon propre instrument gonflait le CPU d'un facteur six.** La récolte des
requêtes temporelles GPU (`getQueryParameter(QUERY_RESULT_AVAILABLE)` +
`getParameter(GPU_DISJOINT_EXT)`) tournait **à chaque image** : elle synchronise
le pipeline. Le crop se mesurait alors à **14,0 ms de CPU p50**. Récolte ramenée
à une image sur huit : **2,4 ms**. Le même code, la même scène, **×5,8 d'écart** —
et le premier chiffre était parfaitement plausible.

**4. La scène que j'appelais « orbite » n'était pas l'orbite.** La pose de
démarrage n'est pas orbitale : le premier banc a étiqueté « ① orbite » une vue
de **surface à 4 416 m, crop posé**. La mesure était juste ; **le nom était
faux**, ce qui est pire. Le banc appelle désormais `modes.enterOrbit(12e6)`
explicitement **et vérifie `modes.mode` avant de relever**.

**5. « Le GPU met 3 ms en orbite. » — Vrai à 60 Hz, faux dans l'absolu.** La même
scène rend **0,30 ms** sans vsync et **3,03 ms** à 60 Hz. Ce n'est pas le travail
qui change : c'est l'horloge de la carte, qui redescend en veille entre deux
images sur une scène légère. J'ai gardé les deux et dit lequel décrit l'écran
d'Adrien — un seul des deux aurait été un faux plancher dans un sens ou dans
l'autre.

**6. Ce que je n'ai PAS pu mesurer, et pourquoi.** ⛔ Le **réseau réel** (banc en
localhost : je publie le volume, pas la latence). ⛔ La **densité > 1**
au-delà du plafond d'`applyRenderSize`, qui écrête à 3,68 Mpx sur cette toile. ⛔
Le **coût en production** du JavaScript : le banc tourne sur le serveur de
développement, donc les chiffres CPU nommés sont des **majorants**. ⛔ Un
**avant/après** des fusions du jour : je n'ai pas construit l'arbre antérieur, et
je refuse de recopier un chiffre d'un autre banc.

---

## ⑧ CE QUE CE BANC ÉTABLIT, EN QUATRE PHRASES

1. **Sur une machine rapide, à densité 1, l'application ne rate aucune image hors
   descente** : 3 ms de CPU et 5,7 ms de GPU sur 16,7 ms.
2. **Le seul défaut ressenti aujourd'hui est la descente** : 19 à 20 tâches
   longues, jusqu'à **482 ms** (×1) et **1 995 ms** (×4), faites de calcul par
   sommet synchrone (`noise`, `natGris`, `gridNormals`, `plinth`, `bathy`) et de
   la pose du crop (`veilleCrop.maj`, jusqu'à 160 ms sur une image).
3. **Le GPU paie des pixels, pas des triangles** : 2,1 ms par mégapixel, mesuré
   sur cinq densités, à 47 appels de dessin constants. **L'échelle de rendu est
   le levier GPU ; il n'y a pas de levier géométrique restant.**
4. **La borne change de nature avec la machine** : le crop est GPU sur une 3080
   et **fil principal dès ×4**, où `contexteCrop` seul prend **20 % de l'image**.

---

### Vérifications exigées par le brief

| | |
|---|---|
| `git diff -- src/` | **vide** |
| `npm test` | **4 899 réussis · 0 échec** (263 fichiers, 31,8 s) |
| `npm run audit:tests` | **263 listés · 263 sur disque — aucun écart** |
| fichiers ajoutés | `scripts/banc-pa-budget.mjs`, `scripts/sonde-pa-emprise.mjs`, `scripts/sonde-pa-densite.mjs`, ce rapport — **rien dans `src/`** |
| traces brutes | `.banc/PA/budget-x1-vsync.json`, `budget-x4-vsync.json`, `budget-x1.json`, `frames-*.json` (une ligne par image), `emprise.json`, `densite.json` |
