# RAPPORT PF2 — LA PRIORITÉ : le visible d'abord, le centre de l'écran d'abord

Branche `perf-priorite` (arbre `C:\Dev\wt-pp2`), fusionnée avec `regroupement`
(PF1, PF4). Terrain : `src/globe.js` — `_traverse`, `_request`, la file,
l'éviction, et le décodage de `fetchTile`. Rien dans `modes.js`, le compositeur
ni les effets.

> Adrien : *« Ce qui est visible doit toujours être calculé en premier. Ce qui
> est au centre de l'écran est la priorité. »*

## 0. LE BANC — sans lui, aucun chiffre ci-dessous ne se compare à rien

**Sonde** : `scripts/profil-pf2.mjs` (celle de PF1 n'existait pas quand j'ai
commencé ; la mienne est décrite en tête de fichier). Chrome sans tête
`--headless=new --use-angle=default`, 1280×720, pixelRatio 1, RTX 3080 (ANGLE
D3D11), palier machine **0** (relevé à chaque mesure — `signaux.ecran` rend
bien `[800, 600]`, l'écran dégénéré du socle), réseau classé « lent » par
l'app (1,4–1,6 Mb/s mesurés par elle). Le réseau est compté au protocole CDP
(`Network.requestWillBeSent` / `loadingFinished`), par hôte et par phase.

⚠️ **La machine était PARTAGÉE** pendant toute la campagne : cinq agents (PF1,
PF3, PF4, deux caméra) y faisaient tourner leurs propres Chrome et leurs
builds — un `vite build` a pris 7 min 30 au lieu de 1 min, une réponse de tuile
28 à 44 s au p99. Les temps absolus (netteté, vol, rAF) sont donc bruités ;
**les fractions, les comptes et les ordres** ne le sont pas. Les paires
avant/après sont **entrelacées** (avant, après, avant, après…) pour que le bruit
tombe des deux côtés.

**Ce que la sonde relève, DANS `update()` et non après** (une sonde posée après
lit un état écrasé — §3 de la compétence) :
- à chaque tuile devenue prête (`_buildMesh`) : son rang d'arrivée, si elle est
  dans le **tronc** (horizon + tronc de vue, rejoués avec la caméra de l'image),
  si son centre projeté tombe dans le **tiers central** (|x| ≤ ⅓ et |y| ≤ ⅓ en
  NDC), sa distance NDC au centre (`dNdc`), si elle est **encore demandée** par
  le parcours courant, son temps de vol, et le temps passé en vol **après** être
  sortie du champ ;
- à chaque image : le coût de `_traverse` (somme des appels racine), de
  `update`, `zCentre` (le niveau de la tuile DESSINÉE sous le centre de
  l'écran — rayon caméra → sphère → lat/lon → tuile), la file, le vol, le
  crédit, et le **cache par état, dans et hors du tronc** ;
- la cadence rAF, les tâches longues (`PerformanceObserver`), un microbanc du
  décodage terrarium sur le fil principal.

**Trois gestes**, dans le mode natif (la sphère est le mode de démarrage) :
- `descente` : altitude posée à 2 200–2 300 km au **bouton** (`modes.cranZoom`,
  ×√2 le cran), file vidée, puis **rafale de molette** (un événement toutes les
  40 ms) jusqu'à 20 km — 150 événements, 6 s ;
- `rotation` : glissé **gauche** de 400 px à 1 500 km ;
- `glisse` : glissé **droit** (le pan) de 400 px à 1 500 km ;
- `cache` : 15 min d'usage (glissés + zooms aller-retour), relevés à 1/5/15 min.

**Première image nette au centre** = après l'arrêt du geste, l'instant où
`zCentre` atteint sa valeur finale et n'en redescend plus.

## 1. CE QUE J'AI MESURÉ AVANT D'ÉCRIRE UNE LIGNE (le chiffre à battre)

Dev, RTX 3080, descente 2 274 km → 20 km (`.banc/PF2/avant-dev-descente.json`) :

| | avant |
|---|---|
| 20 premières arrivées dans le tronc | **80 %** |
| 20 premières dans le tiers central | **0 %** |
| distance NDC moyenne des 20 premières | **1,415** — le COIN de l'écran (1,0 = le bord) |
| toutes : dans le tronc / tiers central | 66 % / 0,8 % |
| encore utiles à l'arrivée | 81,7 % |
| demandes hors du tronc | **20,1 %** |
| première image nette au centre | z10 → z13, 1 427 ms après l'arrêt |
| requêtes / octets | 649 / 23,5 Mio |
| `_traverse` p50 / p99 | 0,3 / 0,8 ms |

Glissé gauche à 1 500 km (`avant-dev-rotation.json`) : **164 demandes, 99,4 %
hors du tronc**, 94 requêtes, 7,1 Mio — pour un geste qui **n'a pas déplacé la
caméra du globe d'un pixel** (déplacement mesuré : 0 u ; le glissé gauche
tourne la caméra principale autour du bloc, azimut 0 → −3,1 rad, et la caméra
que le globe voit ne bouge pas). Le geste lève seulement le repos du crop
(`_cropSeul`), le parcours s'étend au tronc, et le tronc réclame de l'invisible.

### Pourquoi — trois défauts, tous dans `_traverse` / `_request` / `_pump`

1. **La pompe partait en plein parcours.** `_request` appelait `_pump()` à
   chaque enfilement : les six créneaux (`MAX_CONCURRENT`) d'une image allaient
   aux **premières tuiles visitées** — l'ordre des seize racines, pas celui de
   l'écran. Le tri de la file ne pouvait départager que ce qui restait.
2. **La priorité était `chord / dist` du PARENT**, identique pour ses quatre
   enfants, figée à l'enfilement. Sur une vue de trois quarts, `chord / dist`
   favorise le premier plan — le BAS de l'image — jamais le centre.
3. **Le parent passait le tronc par sa sphère, et cette sphère est grasse.**
   Rayon = demi-diagonale, dans toutes les directions, donc aussi vers le ciel
   où un carreau n'a rien. Un tronc qui rase une tuile par-dessus (tout le
   pourtour d'une vue oblique) coupe la sphère du parent sans toucher celle
   d'aucun enfant : le parent « voulait » quatre enfants qu'aucun écran ne
   montrerait, et la règle sans-trou **attendait** ces quatre-là avant de
   dessiner le raffinement. C'est le 99,4 % de la rotation.

Et PF1 a chiffré, de son côté, le `queue.sort` **dans le `while`** de `_pump`
(0,5–1,2 ms par image, 8 ms en pointe) et « 70–84 % des requêtes d'un geste
arrivent après le geste ».

## 2. LES CORRECTIFS, DANS L'ORDRE OÙ ILS ONT ÉTÉ APPLIQUÉS — et pourquoi cet ordre

**Réduire ce qui entre AVANT de trier, trier AVANT de tailler le cache.** Le
socle le dit (l'inverse a donné ×14 de requêtes) et la mesure ici le confirme :
un tri posé sur une file où 20 % des entrées sont invisibles trie de
l'invisible.

| # | correctif | commit |
|---|---|---|
| ① | **un enfant hors du champ n'est ni demandé, ni attendu.** Chaque enfant est jugé par SA sphère (`_dansLeChamp`, la même question que celle posée à la tuile parcourue) ; la règle sans-trou ne compte que les enfants dans le champ — le `TileSelectionResult.CULLED` de Cesium. Quand la caméra tourne et fait entrer un enfant `empty`, la règle retombe sur le parent (porteuse, en cache) et l'enfant part. `lastUsed` n'est posé que sur les enfants du champ : un enfant hors champ resté en file est purgé à l'image suivante, un `empty` hors champ est évinçable au rang 0. | 082b5a6 |
| ② | **la pompe se tait pendant le parcours** (`_enParcours`) et part en fin d'`update()`, après purge, reclassement et éviction, sur une file complète — le `RequestScheduler.update()` de Cesium. Un seul `sort` par pompe (celui de PF1). | 082b5a6 |
| ③ | **la clé de la file est la distance écran du BORD de la tuile au centre de l'écran** (`_priorite` : centre projeté moins rayon projeté, via `_matVue` et `projectionMatrix[5]`) ; à égalité, le plus grossier d'abord. Racines (1e9), socle (1e9 / 9e8) et réessai (0) gardent leur valeur fixe — `_request(t)` sans priorité = suivie. | 082b5a6 |
| ④ | **les priorités suivies sont recalculées à chaque image** (`_reclasserFile`, dans la boucle que `_purgerFile` fait déjà) avec la caméra du moment. | 082b5a6 |
| ⑤ | **la boîte orientée** (`boiteTuile` : repère est/nord/haut au centre, extrêmes de la nappe nue sur 16 points du contour + le centre ; relief et jupe ajoutés à l'usage sur l'axe haut, avec le débord `marge × sin θ` en est/nord) — après la sphère, qui reste le premier filtre. L'`OrientedBoundingBox` de Cesium. | 57be020 |
| ⑥ | **le cache souple** : en mouvement, `porteuses + 600` places, hystérésis 100, LRU par les rangs existants ; **jamais au repos du crop** (`_cropSeul`), où le dézoom doit rester gratuit (Tâche N, `veille-repos` ⑦ — 112 tuiles sur 792 rendues au premier essai, test rouge, corrigé). Le `tileCacheSize` de Cesium. | 57be020 |
| ⑦ | **le décodage terrarium hors du fil principal** : `src/monde/decodeur-terrarium.js`, un Worker par globe, OffscreenCanvas, bitmap **cloné** (jamais transféré — `_tileMemo` le partage avec le damier), hauteurs et ImageBitmap **transférés** ; repli sur le fil principal sans Worker, et **une seule formule** `hauteursTerrarium` pour les deux chemins. Vérifié en navigateur : 0 repli sur 559 tuiles. | 57be020 |

Ce que chaque correctif a coûté ou rendu est au §3. Les tests (`test/globe-priorite.test.js`,
9 tests) verrouillent chacun d'eux ; une campagne de mutation a retiré sept fois
un correctif (pompe pendant le parcours, enfants hors champ demandés, file
jamais reclassée, priorité = ratio du parent, boîte jamais consultée, boîte
sans marge est/nord, cache souple débranché) : **sept fois le test rougit**.

## 3. AVANT / APRÈS

Builds de production (`vite build` de `HEAD` avant PF2 = « avant », de `57be020` =
« après »), servis par la sonde elle-même (`--dist`), Chrome sans tête, RTX 3080,
machine partagée. Traces brutes : `.banc/PF2/*.json` (ignoré par git ; une
ligne par image, 200 premières arrivées, réseau par hôte).


**Descente 2 200 km → 20 km, builds, CPU ×1** — médiane de 3 × 3 tirages entrelacés (valeurs entre parenthèses)

| grandeur | avant | après |
|---|---|---|
| 20 premières arrivées dans le tronc (%) | 100 (80 · 100 · 100) | 100 (100 · 100 · 100) |
| 20 premières dans le tiers central (%) | 0 (0 · 0 · 0) | 0 (0 · 0 · 0) |
| distance NDC moyenne des 20 premières (1 = le bord) | 1,2 (1,23 · 1,2 · 1,18) | 1,17 (1,18 · 1,17 · 1,06) |
| toutes les arrivées dans le tronc (%) | 68 (68,1 · 65,1 · 68) | 76,4 (72,1 · 76,4 · 77,7) |
| demandes hors du tronc (%) | 18,5 (19,8 · 18,5 · 16,5) | 5,5 (7,2 · 5,5 · 4,7) |
| encore utiles à l’arrivée (%) | 80,1 (80,1 · 81,7 · 77,9) | 66,5 (63,9 · 66,5 · 67,3) |
| première image nette au centre, ms après l’arrêt | 2 184 (2 184 · 2 011 · 2 267) | 2 463 (2 804 · 2 159 · 2 463) |
| niveau final au centre | 13 (13 · 13 · 13) | 13 (13 · 13 · 13) |
| requêtes par descente | 638 (613 · 638 · 679) | 594 (635 · 582 · 594) |
| Mio par descente | 21,73 (20,4 · 21,73 · 22,38) | 16,26 (15,88 · 16,67 · 16,26) |
| tuiles arrivées | 744 (722 · 744 · 765) | 648 (648 · 639 · 651) |
| `_traverse` p50 (ms) | 0,3 (0,2 · 0,3 · 0,3) | 0,3 (0,6 · 0,3 · 0,3) |
| `_traverse` p99 (ms) | 1,1 (1,1 · 1 · 1,3) | 1,2 (1,7 · 0,9 · 1,2) |
| `update` p50 (ms) | 0,5 (0,4 · 0,5 · 0,5) | 0,5 (1,2 · 0,5 · 0,5) |
| `update` p99 (ms) | 1,3 (1,3 · 1,1 · 1,4) | 2,1 (2,6 · 1,5 · 2,1) |
| `_buildMesh` p50 (ms) | 1,2 (1,2 · 1,3 · 1,2) | 1,3 (1,6 · 1,3 · 1,2) |
| `_buildMesh` p99 (ms) | 3,4 (3,3 · 3,8 · 3,4) | 2,9 (3,7 · 2,9 · 2,6) |
| maillages par image p99 (ms) | 13,8 (13,8 · 15,2 · 12,7) | 8,7 (9,7 · 8,2 · 8,7) |
| maillages par image max (ms) | 195 (202 · 195 · 195) | 217 (259 · 217 · 178) |
| rAF p99 (ms) | 329 (306 · 329 · 343) | 327 (418 · 321 · 327) |
| tâches longues (n) | 46 (44 · 50 · 46) | 56 (77 · 54 · 56) |
| tâches longues Σ (ms) | 7 696 (7 129 · 7 696 · 7 883) | 8 809 (16 952 · 8 809 · 8 794) |
| dessinées à centre hors écran, max par image | 131 (131 · 130 · 133) | 104 (79 · 104 · 107) |
| cache max | 1 145 (1 185 · 1 145 · 1 140) | 806 (810 · 806 · 806) |
| prêtes hors tronc à la fin | 487 (447 · 487 · 496) | 328 (238 · 333 · 328) |
| créneaux en vol hors champ (% du temps de créneau) | 19,07 (19,07 · 20,92 · 17,98) | 8,13 (14,67 · 8,13 · 7,52) |
| rang d’arrivée de la tuile sous le centre, par niveau (0 = la première) | z7:∅ z8:0 z9:1 z10:84 z11:∅ z12:∅ / z7:∅ z8:3 z9:0 z10:3 z11:∅ z12:∅ / z7:∅ z8:1 z9:4 z10:118 z11:∅ z12:∅ | z7:∅ z8:1 z9:1 z10:3 z11:22 z12:0 / z7:∅ z8:3 z9:0 z10:1 z11:22 z12:0 / z7:∅ z8:0 z9:0 z10:2 z11:20 z12:0 |
| dNdc des 5 premières arrivées, z7→z12 (médiane sur les niveaux) | 0,96 · 0,62 · 0,61 | 0,49 · 0,39 · 0,39 |

**Descente, CPU ×4 (`Emulation.setCPUThrottlingRate`)** — un tirage chacun

| grandeur | avant | après |
|---|---|---|
| 20 premières arrivées dans le tronc (%) | 55 | 100 |
| 20 premières dans le tiers central (%) | 0 | 0 |
| distance NDC moyenne des 20 premières (1 = le bord) | 1,5 | 1,22 |
| toutes les arrivées dans le tronc (%) | 66,3 | 72,7 |
| demandes hors du tronc (%) | 27,1 | 6,7 |
| encore utiles à l’arrivée (%) | 82,7 | 58,7 |
| première image nette au centre, ms après l’arrêt | 4 084 | 16 754 |
| niveau final au centre | 13 | 13 |
| requêtes par descente | 825 | 529 |
| Mio par descente | 23,65 | 15,33 |
| tuiles arrivées | 1 255 | 630 |
| `_traverse` p50 (ms) | 1,8 | 1,1 |
| `_traverse` p99 (ms) | 5,5 | 3,6 |
| `update` p50 (ms) | 2,8 | 1,8 |
| `update` p99 (ms) | 7,3 | 5,9 |
| `_buildMesh` p50 (ms) | 5,8 | 5,9 |
| `_buildMesh` p99 (ms) | 32 | 11,9 |
| maillages par image p99 (ms) | 44,4 | 31,8 |
| maillages par image max (ms) | 1 586 | 1 060 |
| rAF p99 (ms) | 992 | 1 143 |
| tâches longues (n) | 148 | 117 |
| tâches longues Σ (ms) | 46 845 | 63 296 |
| dessinées à centre hors écran, max par image | 359 | 50 |
| cache max | 1 437 | 770 |
| prêtes hors tronc à la fin | 460 | 205 |
| créneaux en vol hors champ (% du temps de créneau) | 24,61 | 22,54 |
| rang d’arrivée de la tuile sous le centre, par niveau (0 = la première) | z7:1 z8:7 z9:39 z10:∅ z11:∅ z12:∅ | z7:5 z8:3 z9:1 z10:1 z11:11 z12:0 |
| dNdc des 5 premières arrivées, z7→z12 (médiane sur les niveaux) | 1,93 | 0,48 |

**Rotation (glissé gauche, 400 px, 1 500 km — caméra du globe immobile)** — un tirage chacun

| grandeur | avant | après |
|---|---|---|
| 20 premières arrivées dans le tronc (%) | 5 | 85 |
| 20 premières dans le tiers central (%) | 0 | 0 |
| distance NDC moyenne des 20 premières (1 = le bord) | 2,39 | 1,95 |
| toutes les arrivées dans le tronc (%) | 10,3 | 75,6 |
| demandes hors du tronc (%) | 100 | 0 |
| encore utiles à l’arrivée (%) | 75,9 | 48,8 |
| première image nette au centre, ms après l’arrêt | 13 | 14 |
| niveau final au centre | 7 | 7 |
| requêtes par descente | 87 | 40 |
| Mio par descente | 6,76 | 3,3 |
| tuiles arrivées | 87 | 41 |
| `_traverse` p50 (ms) | 0,2 | 0,2 |
| `_traverse` p99 (ms) | 0,9 | 0,4 |
| `update` p50 (ms) | 0,4 | 0,2 |
| `update` p99 (ms) | 1,1 | 1 |
| `_buildMesh` p50 (ms) | 1,2 | 1 |
| `_buildMesh` p99 (ms) | 2,1 | 3,1 |
| maillages par image p99 (ms) | 4,3 | 3,5 |
| maillages par image max (ms) | 5,6 | 3,5 |
| rAF p99 (ms) | 325 | 316 |
| tâches longues (n) | 0 | 0 |
| tâches longues Σ (ms) | 0 | 0 |
| dessinées à centre hors écran, max par image | 20 | 8 |
| cache max | 461 | 388 |
| prêtes hors tronc à la fin | 185 | 28 |
| créneaux en vol hors champ (% du temps de créneau) | 33,98 | 2,3 |
| rang d’arrivée de la tuile sous le centre, par niveau (0 = la première) | z7:∅ | z7:∅ |
| dNdc des 5 premières arrivées, z7→z12 (médiane sur les niveaux) | 1,75 | 1,07 |

**Cache, 15 min d’usage** (glissés + zooms aller-retour, builds) — tuiles PRÊTES hors du tronc / cache total / requêtes cumulées

| jalon | avant | après |
|---|---|---|
| 60 s | 114 hors tronc · 223 dedans · cache 453 · 34 req, 2.5 Mio · alt 1843 km | 11 hors tronc · 213 dedans · cache 362 · 24 req, 1.8 Mio · alt 1836 km |
| 300 s | 233 hors tronc · 195 dedans · cache 509 · 125 req, 8.2 Mio · alt 879 km | 72 hors tronc · 190 dedans · cache 409 · 64 req, 4.2 Mio · alt 905 km |
| 900 s | 614 hors tronc · 151 dedans · cache 842 · 570 req, 47.8 Mio · alt 142 km | 346 hors tronc · 141 dedans · cache 688 · 356 req, 30.7 Mio · alt 152 km |

Décodage terrarium sur le fil principal (microbanc dans la page, médiane de 7) : **256² 1.9 ms · 512² 3.6 ms** — c’est ce que ⑦ déplace dans le Worker.


### Lecture

**L'ordre.** Sur la descente, les 20 premières tuiles sont **toutes** dans le
tronc (80–100 % → 100 %, trois tirages sur trois ; 55 % → 100 % à CPU ×4), et
la tuile sous le centre de l'écran arrive **au rang 0 à 3 à chaque niveau de
z8 à z12** après, contre le rang 84 et 118 à z10 avant (deux tirages sur trois)
et « jamais » à z11–z12. La distance NDC des cinq premières arrivées de chaque
niveau tombe de 0,6–0,96 à 0,39–0,49 : les premières tuiles d'un niveau
tombent désormais **au centre**, plus au bord. Le tiers central reste à 0 %
sur les 20 premières dans les deux cas — voir §4.6 : les 20 premières sont des
z6 qui couvrent chacune un quart d'écran, leur centre ne peut pas tomber dans
un neuvième d'écran ; la grandeur juste est le rang par niveau.

**Ce qui entre.** Les demandes hors du tronc passent de 18,5 % à 5,5 % (27 % →
6,7 % à ×4) — et les 5 % qui restent sont **toutes** du flux du socle (§4.7).
Requêtes par descente : 638 → 594 (−7 %), octets **21,7 → 16,3 Mio (−25 %)**,
tuiles arrivées 744 → 648 ; à CPU ×4, **825 → 529 requêtes, 1 255 → 630
tuiles**. Rotation (caméra du globe immobile) : **87 → 40 requêtes, 6,8 → 3,3
Mio, 100 % → 0 % de demandes hors du tronc**. Les tuiles dessinées dont le
centre est hors de l'écran : 131 → 104 par image au pire (359 → 50 à ×4) — la
boîte orientée en écarte, mais pas tout : ce qui reste est aux bords, centre
juste dehors, surface dedans.

**Le cache.** En descente, le cache culmine à 806 tuiles au lieu de 1 145, et
finit avec 328 prêtes hors tronc au lieu de 487. Sur 15 min d'usage : **11 /
72 / 346 tuiles prêtes hors tronc à 1 / 5 / 15 min, contre 114 / 233 / 614**,
pour un cache de 688 contre 842 — et **356 requêtes (30,7 Mio) contre 570
(47,8 Mio)** : rendre les tuiles hors champ n'a pas fait re-télécharger plus,
il a fait télécharger moins (ce qu'on ne demande plus pèse davantage que ce
qu'on redemande). Ce n'était pas une fuite — le plafond dur tenait à 1 700 —
mais une occupation : trois quarts du cache pour des tuiles invisibles, chacune
avec sa texture.

**Le CPU.** `_traverse` : 0,3 / 1,1 ms (p50 / p99) avant, 0,3 / 1,2 ms après à
CPU ×1 — la boîte orientée coûte ce que le tri de la file rend ; à ×4,
**1,8 / 5,5 → 1,1 / 3,6 ms**, parce que le parcours visite moins. `update` :
0,5 / 1,3 → 0,5 / 2,1 ms (le reclassement et la taille sont dedans). Le
maillage : `_buildMesh` p99 3,4 → 2,9 ms, **par image p99 13,8 → 8,7 ms** (à ×4 :
p99 32 → 11,9 ms la tuile, 44 → 32 ms par image) — c'est le décodage sorti du
fil principal (1,9 ms la 256², 3,6 ms la 512² sur ce banc-ci, 4 et 6,5 ms
sur le banc partagé de la veille). Les tâches longues (Σ 7–9 s, 46–56 par
descente, max ≈ 200 ms) **ne bougent pas** : elles ne sont pas le globe, ce
sont les rechargements du bloc à chaque niveau (PF4 / caméra).

**La netteté au centre.** 2 184 → 2 463 ms après l'arrêt (médiane de 3 ; les
trois tirages : 2 184 / 2 011 / 2 267 contre 2 804 / 2 159 / 2 463), et le
niveau final au centre est z13 des deux côtés. **Ce chiffre est dominé par le
réseau partagé** : le temps de vol médian d'une tuile était 156–226 ms sur les
tirages « avant » et 226–487 ms sur les tirages « après » entrelacés (p99
26–33 s des deux côtés), et à CPU ×4 le tirage « après » a subi un vol médian
de **2 126 ms contre 420 ms** — d'où ses 16,8 s de netteté, qui mesurent la
file de six créneaux sur un réseau cinq fois plus lent, pas le code. Ce que le
code change se lit dans l'ordre : la tuile du centre part dans la première
salve de chaque niveau ; ce qu'il ne change pas, c'est le débit.

**Ce qui a empiré, et pourquoi.** « Encore utiles à l'arrivée » : 80 → 66 %.
C'est la conséquence attendue du centre d'abord : les tuiles du bord partent
**en dernier** dans chaque niveau, donc arrivent quand la descente a déjà
resserré le champ — avant, elles partaient en premier et arrivaient encore
utiles… pendant que le centre attendait. Le temps de créneau passé en vol hors
champ tombe pourtant de 19 % à 8 % : la purge et le reclassement à chaque image
font que ce qui part est utile au départ ; ce qui reste est le vol lui-même,
que seule l'annulation (§5) rendrait.


## 4. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« `enterOrbit` pose l'orbite de départ. »** Faux sous les drapeaux levés :
   la sphère EST le mode `surface` continu, et le premier cran de molette
   ramène de l'orbite au mode surface (`arretCran: 1` au premier tour de la
   sonde). L'altitude se pose au bouton (`cranZoom`), dans le mode natif.
2. **« Un événement de molette est un cran. »** Non : `_zoomGesture` ajoute une
   IMPULSION à une vitesse inertielle ; 80 événements à 160 ms ont porté la
   caméra de 4,85 km à 56 km (×1,015 l'événement). Un vrai défilement en
   envoie vingt par seconde — d'où la rafale à 40 ms.
3. **« `cranZoom(+1)` dézoome. »** Il zoome (×1/√2) : la première pose a
   plongé à 102 m.
4. **« Le glissé gauche déplace la vue du globe. »** Il tourne la caméra
   principale autour du bloc ; la caméra que le globe voit ne bouge pas (0 u).
   Le pan est le bouton droit — et il est **borné et élastique** à 1 500 km
   (lon 53,44° → 52,59° puis retour) : 1 à 8 tuiles, quel que soit le code.
   Le « glissé » du brief n'existe donc pas comme geste de planète dans ce
   produit ; ce qui existe est mesuré (rotation, pan borné).
5. **« `tuilesEnVol() === 0` dit que la planète est chargée. »** Sur certaines
   vues il ne retombe jamais à zéro : des `empty` fraîches que le parcours
   redemande à chaque image sans les obtenir (double 404 → quarantaine, 10 s,
   puis rebelote). La porte de la sonde est « rien en vol, rien en file, et le
   compte de prêtes ne bouge plus depuis 1,5 s ».
6. **« Le tiers central est un bon dénominateur. »** Il est trop étroit pour
   des tuiles de niveau bas (une z6 à 2 000 km couvre un quart de l'écran) :
   la fraction reste ≈ 0 avant comme après, même quand l'ordre s'est
   inversé. La grandeur qui bouge est **la distance NDC moyenne des premières
   arrivées** et **le rang d'arrivée de la tuile sous le centre, par niveau**
   — les deux sont dans le rapport.
7. **« Toutes les demandes hors tronc viennent de `_traverse`. »** Après ①,
   les 2–5 % qui restent sont **toutes** du flux du socle (priorités 1e9 / 9e8,
   `demanderEmprise`, `aussi` = l'emprise de mer à z6, dNdc 6) — hors de mon
   périmètre, signalé.
8. **« Le maillage étalé sous budget (⑧) passe. »** Mesuré : 121 tuiles
   bâties dans la même image (315 ms) juste après un gel de 300 ms du fil
   principal. J'ai écrit le `processTerrainQueue` (file des décodées, budget
   4 ms par image, centre d'abord) — **25 tests dans six fichiers** supposent
   qu'une tuile est prête dès sa réponse (`tuilesPretes`, la mémoire de tuiles,
   la transition gratuite, les racines dessinées à la première image). Retiré
   plutôt que de réécrire 25 contrats à 1 h du matin ; la mesure et le dessin
   sont au §5.
9. **« La SSE vraie est un gain de vitesse. »** PF1 l'a chiffrée : 0 ms gagné,
   et plus de tuiles sur Retina. Je ne l'ai pas écrite ; la clé de la file
   (distance écran du bord de la tuile) en tient le seul aspect qui compte ici
   — l'ordre.

## 5. CE QUI RESTE, CHIFFRÉ

- **L'annulation en vol** (`AbortController`) : mesuré, les créneaux passés en
  vol après être sortis du champ valent **24 % du temps de créneau** d'une
  descente (32 s sur 135 s de six créneaux, avant ; 16 s sur 156 s après —
  le réseau partagé fait l'essentiel du p99). `fetchTile` refuse le `signal`
  pour deux raisons écrites (promesse partagée par URL avec le damier ; le
  `.catch` réessaie) : la porte est `memo-tuiles-mnt.js` (un compteur de
  demandeurs par URL, abandon quand le dernier part), hors du périmètre PF2.
- **Le maillage étalé** (⑧, §4.8) : à écrire avec ses 25 tests.
- **L'emprise de mer du flux** (`aussi`, 9e8) demande des tuiles à dNdc 6.
- **Les 404 Mapterhorn en mer** : 679 sur 1 704 requêtes d'une descente en
  dev (40 %), chacune suivie d'un second aller-retour AWS. Un 404 à z pourrait
  router ses descendants vers AWS sans les essayer.
- **Le socle** : les tâches longues (52–78 par descente, Σ 10–13 s, max 666 ms)
  ne sont pas le globe (`_buildMesh` p99 8 ms, `_traverse` p99 ≤ 2 ms) — ce
  sont les rechargements du bloc (PF4 / caméra).

## 6. TESTS ET COMMITS

- `npm test` : **4 697 · 0 échec (base `regroupement` 4 688 + 9 tests PF2)** · `npm run audit:tests` : **246 listés · 246 sur disque, aucun écart**
  (`test/globe-priorite.test.js` inscrit dans la liste explicite ; l'union à la
  fusion, aucun test perdu).
- Commits sur `perf-priorite` : `082b5a6` (①–④ + sonde + test), `57be020`
  (⑤⑥⑦), `c11a80f` et `4f62fc0` (fusions de `regroupement`), puis le rapport.
- Serveur de dev 6123 arrêté en partant.
